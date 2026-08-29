"""
Publish — Assemble run cards from TestReports and submit to the leaderboard.

This is the final step in the eval pipeline:
    mt-eval run   →  RunLog      (raw translations)
    mt-eval test  →  TestReport  (scored results)
    mt-eval publish → Supabase   (leaderboard entry)

The publish command:
    1. Reads a TestReport JSON and its source RunLog
    2. Assembles a Run Card (config + scores + provenance)
    3. Computes a fingerprint hash (deterministic identity)
    4. Computes a run_card_hash (tamper seal)
    5. Derives a deterministic UUID from the fingerprint
    6. Authenticates via OAuth (GitHub or Google)
    7. Upserts the row to Supabase (deduplicated by fingerprint)
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from mt_eval_harness.auth import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    get_session,
    get_submitter_name,
)


# ---------------------------------------------------------------------------
# Production-write guard (audit C1)
# ---------------------------------------------------------------------------
#
# `mt-eval publish` writes into the live leaderboard's run_cards table. The
# generic confirmation (`-y` / auto_confirm) is meant to skip the "are you
# sure?" prompt for scripted/batch work — it is NOT consent to mutate PROD.
# A reflex keystroke (a `y` at the post-run prompt, `run --publish`, or
# `publish <report> -y`) must never silently insert into the production
# project. So a real write to the PROD project requires a SEPARATE, explicit
# opt-in, distinct from `-y`:
#
#   - env  MT_EVAL_ALLOW_PROD=1            (CI / intentional batch publishes)
#   - flag --prod / --yes-prod            (interactive intentional publish)
#
# Writes to a non-prod project (a staging branch reached via the
# MT_EVAL_SUPABASE_URL override) are never gated — only the prod URL is.
# `--dry-run` previews the payload and makes no network call at all.

# The production project URL. This is the default in auth.py; we hardcode the
# host here (rather than comparing against SUPABASE_URL, which is itself
# env-overridable) so that pointing MT_EVAL_SUPABASE_URL at prod still trips
# the guard.
PROD_SUPABASE_HOST = "sjdomynysdljkbemupqa.supabase.co"


def _is_prod_target() -> bool:
    """True when the active Supabase URL points at the production project."""
    return PROD_SUPABASE_HOST in SUPABASE_URL


def _prod_write_opted_in(yes_prod: bool = False) -> bool:
    """Whether the caller has explicitly opted in to a PROD write.

    Distinct from the generic `-y` / auto_confirm: opt-in is either the
    MT_EVAL_ALLOW_PROD=1 env var or an explicit --prod/--yes-prod flag.
    """
    if yes_prod:
        return True
    return os.environ.get("MT_EVAL_ALLOW_PROD", "").strip() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Anonymous intake (founder directive 2026-07-13: OAuth optional, not
# required). Anonymous publishes go through the submit-run edge function
# (mt-eval-arena/supabase/functions/submit-run), which validates, rate-limits
# per IP, and inserts with the service role as submitter='anonymous',
# owner_uid=NULL, trust='unverified' — the DB integrity triggers still fire.
# ---------------------------------------------------------------------------

def _anon_submit_url() -> str:
    """The submit-run edge function URL. Env-overridable so a staging branch
    or self-hosted node can point the anonymous lane elsewhere; defaults to
    the active Supabase project (which itself honors MT_EVAL_SUPABASE_URL)."""
    return os.environ.get(
        "MT_EVAL_ANON_SUBMIT_URL",
        f"{SUPABASE_URL}/functions/v1/submit-run",
    )


# ---------------------------------------------------------------------------
# Language pair helpers — uses language_cards SSOT
# ---------------------------------------------------------------------------
#
# Previously contained a hardcoded 17-entry _LANG_CODES dict that could
# only resolve names for a handful of languages. Deleted in v8 — all
# resolution now goes through language_cards which indexes all 7,928 cards.

from mt_eval_harness.language_cards import (
    resolve_code as _lc_resolve_code,
    resolve_name as _lc_resolve_name,
    resolve_scoring_profile as _resolve_scoring_profile,
)


def _resolve_lang_to_code(name_or_code: str) -> str:
    """Resolve a language name or code to its ISO 639-3 code.

    Tries multiple strategies via the language_cards SSOT:
        1. Direct code/alias resolution (e.g., "fr" → "fra", "crk" → "crk")
        2. Name resolution (e.g., "French" → "fra", "Plains Cree" → "crk")
        3. Name with parenthetical stripped (e.g., "French (Canada)" → "fra")
        4. Unresolvable name → the "?" sentinel (NO first-3-chars guess)

    Returns "?" when the name cannot be resolved to a real ISO code via the
    SSOT — never a guessed code. Guessing "Igbo"[:3] → "igb" (Ebira's code)
    silently drives a wrong-language scoring profile, so we fail honest instead.
    This replaces the old hardcoded _LANG_CODES dict.
    """
    cleaned = name_or_code.strip()
    if not cleaned:
        return "?"

    # Try as code/alias first
    resolved = _lc_resolve_code(cleaned)
    if resolved != cleaned:
        return resolved

    # Try as name
    code = _lc_resolve_name(cleaned)
    if code:
        return code

    # Try stripping parenthetical annotation:
    # "Plains Cree (nêhiyawêwin, SRO)" → "Plains Cree"
    if "(" in cleaned:
        base_name = cleaned.split("(")[0].strip()
        code = _lc_resolve_name(base_name)
        if code:
            return code
        # Also try the base as a code
        resolved = _lc_resolve_code(base_name)
        if resolved != base_name:
            return resolved

    # If it's already a short code-like string, return as-is
    if len(cleaned) <= 3 and cleaned.isalpha():
        return cleaned.lower()

    # Could NOT resolve to an ISO code via the SSOT. Do NOT guess from the
    # first 3 chars of the name ("Igbo"[:3] → "igb" is Ebira's code) — that
    # silently drives a wrong-language scoring profile. Return the unknown
    # sentinel; the scoring path falls back to generic surface scoring and
    # pair-building prefers the corpus's own ISO codes.
    return "?"


def _load_corpus_self_meta(config: dict) -> dict:
    """Read self-describing metadata from the run's corpus file, if present.

    Curated corpora built by champollion-corpora-builder embed their own
    identity: top-level corpus_id, language_pair (with ISO 639-3 codes),
    version, and provenance.license. For a pip-installed harness this is
    the only reliable metadata source — the datasets registry and the
    language-cards SSOT are monorepo files, not package data — so corpus
    self-metadata is preferred when resolving dataset ids, language pairs,
    and corpus licenses.

    Returns {} when the corpus file is missing or unreadable (publish may
    run from a different cwd than the run; that must never block it).
    """
    corpus_path = config.get("corpus_path") or ""
    if not corpus_path:
        return {}
    path = Path(corpus_path)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _build_language_pair(config: dict, corpus_meta: dict | None = None) -> str:
    """Build a compact language pair string like 'eng>crk'.

    Prefers the ISO 639-3 codes embedded in the corpus file itself
    (authoritative, and immune to name-resolution fallbacks like
    "Igbo"[:3] → "igb", which is Ebira's code). Falls back to resolving
    the configured language names via the language-cards SSOT.
    """
    pair = (corpus_meta or {}).get("language_pair") or {}
    src_code = (pair.get("source") or "").strip().lower()
    tgt_code = (pair.get("target") or "").strip().lower()
    if src_code and tgt_code:
        return f"{src_code}>{tgt_code}"

    src = config.get("source_lang", "").strip()
    tgt = config.get("target_lang", "").strip()

    src_code = _resolve_lang_to_code(src) if src else "?"
    tgt_code = _resolve_lang_to_code(tgt) if tgt else "?"

    return f"{src_code}>{tgt_code}"


# ---------------------------------------------------------------------------
# Corpus license passthrough — datasets registry lookup
# ---------------------------------------------------------------------------

def _lookup_registry_entry(dataset_id: str) -> dict | None:
    """Look up a dataset's full entry in the datasets registry.

    Matches by dataset id or alias. Returns the raw registry entry dict,
    or None when the dataset is not registered (or the registry is missing —
    e.g. a standalone pip install without the bundled registry).
    """
    if not dataset_id:
        return None

    from mt_eval_harness.config import load_registry

    try:
        registry = load_registry()
    except (FileNotFoundError, json.JSONDecodeError):
        return None

    for entry in registry.get("datasets", []):
        if entry.get("id") == dataset_id or dataset_id in entry.get("aliases", []):
            return entry

    return None


def _should_upsert_dataset(dataset_id: str) -> bool:
    """Whether publish should attempt a datasets-table upsert for this run.

    Only for an UNREGISTERED / ad-hoc corpus. A registered dataset's row
    already exists server-side (synced from the registry), its license +
    attribution already travel on the run card's ``corpus_license`` column, and
    the anon/standard RLS policy forbids writing the ``datasets`` table — so a
    POST would only ever return a non-fatal 403 that reads as alarming in the
    happy path. Skipping it keeps the queue/MCP publish path 403-free.
    """
    return bool(dataset_id) and _lookup_registry_entry(dataset_id) is None


def _method_plugin_id(config: dict, provenance: dict) -> str:
    """Method identity for a method-plugin run ('' when no method_path).

    The (fixed) runner relabels ``config.model`` to the plugin's method_id,
    so for current run logs the plain ``config.get("model")`` fallback in the
    caller is already honest. This helper covers the OLDER run logs, where
    ``config.model`` still carries the phantom default LLM slug: when the
    plugin shipped a method card, its method_id (embedded in provenance by
    build_run_log) is the honest label. Returns '' when the run used no
    method plugin, or when no card identity is available — the caller's
    fallback ladder then applies.
    """
    if not (config.get("method_path") or "").strip():
        return ""
    card = provenance.get("method_card") or {}
    return (card.get("method_id") or "").strip()


def _resolve_dataset_id(config: dict, corpus_meta: dict | None = None) -> str:
    """Resolve the registry dataset id for a run's corpus.

    Older RunLogs record only the segment filter in config["dataset"]
    (e.g. "all", "dev") and leave config["dataset_id"] empty, so run
    cards historically published with a meaningless dataset id. When no
    explicit dataset_id is set, fall back to matching the corpus file's
    basename against the registry entries' path/local_path so the run
    card references the real dataset (and inherits its license).

    Resolution order:
        1. config["dataset_id"] (explicit — always wins)
        2. the corpus file's own top-level "corpus_id" (self-describing
           curated corpora — works for pip installs with no registry)
        3. registry entry whose path/local_path basename matches
           config["corpus_path"]'s basename
        4. the corpus file's stem (still queue-matchable)
        5. config["dataset"] (legacy segment-filter fallback)
    """
    explicit = config.get("dataset_id", "")
    if explicit:
        return explicit

    self_id = ((corpus_meta or {}).get("corpus_id") or "").strip()
    if self_id:
        return self_id

    corpus_path = config.get("corpus_path") or ""
    if corpus_path:
        from mt_eval_harness.config import load_registry

        basename = Path(corpus_path).name
        try:
            registry = load_registry()
        except (FileNotFoundError, json.JSONDecodeError):
            registry = {}
        stem = Path(corpus_path).stem
        for entry in registry.get("datasets", []):
            for key in ("path", "local_path"):
                entry_path = entry.get(key)
                if entry_path and Path(entry_path).name == basename:
                    return entry["id"]
            # Fallback: corpus filename stem matches the id or an alias
            # (covers local-only corpora with no registered path).
            if stem == entry.get("id") or stem in entry.get("aliases", []):
                return entry["id"]
        # No registry match (e.g. pip install with no bundled registry):
        # the corpus file stem is still meaningful and queue-matchable —
        # never publish the segment filter ("all"/"dev") as a dataset id.
        if stem:
            return stem

    return config.get("dataset", "")


def registry_entry_for_run(
    dataset_id: str,
    corpus_path: str = "",
    dataset: str = "",
    corpus_meta: dict | None = None,
) -> tuple[str, dict | None]:
    """Resolve a run's registry dataset id AND entry, path fallback included.

    Returns ``(dataset_id, entry)``; ``entry`` is None when the corpus is
    genuinely unregistered.

    The direct id lookup alone is not enough for the transmission gate. A
    REGISTERED corpus run by file path (``--corpus arena/datasets/curated/
    eng-crk-dev-v1.json``) resolves no id: ``canonical_registry_id()`` matches
    ids/aliases only, and the built corpus envelopes carry ``dataset.name``,
    not ``dataset.id``. The run then fell through to the UNREGISTERED branch
    of ``resolve_transmission_policy`` — privacy-pinned ``no-train`` — for
    corpora the registry marks quarantined or consent-required. So the gate
    also walks ``_resolve_dataset_id``'s path/basename ladder, which run-card
    publishing has always used to find the very same entry.
    """
    entry = _lookup_registry_entry(dataset_id) if dataset_id else None
    if entry is not None:
        return dataset_id, entry
    resolved = _resolve_dataset_id(
        {"dataset_id": dataset_id, "corpus_path": corpus_path,
         "dataset": dataset},
        corpus_meta,
    )
    if resolved and resolved != dataset_id:
        entry = _lookup_registry_entry(resolved)
        if entry is not None:
            return resolved, entry
    return dataset_id, None


def _lookup_corpus_license(dataset_id: str) -> dict | None:
    """Look up a dataset's license + attribution in the datasets registry.

    The registry (arena/datasets/registry.json, bundled with the harness)
    records a `license` (SPDX-ish string) and `source` (attribution) for
    every registered evaluation corpus. Run cards embed these so every
    leaderboard row carries its corpus license obligations — part of the
    project's line-level license tracking policy.

    Matches by dataset id or alias. Returns:
        {"license": str | None, "attribution": str | None} on a registry hit,
        None when the dataset is not registered (or the registry is missing —
        e.g. a standalone pip install without the bundled registry).
    """
    entry = _lookup_registry_entry(dataset_id)
    if entry is None:
        return None
    return {
        "license": entry.get("license"),
        "attribution": entry.get("source"),
    }


# ---------------------------------------------------------------------------
# Corpus-content redistribution gate ("publish results without exposing data")
# ---------------------------------------------------------------------------
# Publishing a run ALWAYS uploads the aggregate run card (scores + corpus
# sha256 + size + license). Uploading per-entry *content* (the source and
# human reference text) into the world-readable run_card_entries table is a
# separate act: it redistributes corpus CONTENT. We gate it so that:
#   • restricted corpora (non-commercial, no-derivatives, sealed held-out /
#     gold-standard, quarantined) NEVER have their text exposed — closing the
#     EdTeKLA / Wolvengrey / held-out leak path; and
#   • an unregistered / own / private corpus defaults to SCORES-ONLY — the
#     owner publishes verifiable aggregate results without exposing the data
#     (the "register your own / private corpora, publish results
#     without exposing the data" pillar; e.g. a foundation reporting a model
#     on confidential legal text it cannot share).
# Fail-safe: when the redistribution status is unknown, content is WITHHELD.

# License tokens that mean the corpus text may NOT be redistributed publicly.
_NONREDISTRIBUTABLE_LICENSE_TOKENS = frozenset({"nc", "nd"})
_NONREDISTRIBUTABLE_LICENSE_SUBSTRINGS = (
    "noncommercial", "non-commercial", "noderiv", "no-deriv",
    "noderivatives", "proprietary", "restricted", "wolvengrey",
    "all rights reserved",
)
# License families whose content IS cleared for public redistribution.
_REDISTRIBUTABLE_LICENSE_PREFIXES = (
    "cc-by", "cc0", "cc-zero", "public domain", "publicdomain", "pd-",
    "mit", "apache", "bsd", "odc-by", "odbl", "gpl", "lgpl", "mpl",
    "unlicense", "the unlicense",
)


def _license_is_redistributable(license_str: str | None) -> bool:
    """True only when a corpus's CONTENT is cleared for public redistribution.

    Conservative by design: an unknown/empty license returns False so corpus
    text is never exposed by default. NC / ND / proprietary / restricted
    licenses are always False, even if they also start with a permissive-
    looking prefix (e.g. ``CC-BY-NC-SA`` → False).
    """
    if not license_str:
        return False
    low = license_str.strip().lower()
    if any(sub in low for sub in _NONREDISTRIBUTABLE_LICENSE_SUBSTRINGS):
        return False
    tokens = set(re.split(r"[^a-z0-9]+", low))
    if tokens & _NONREDISTRIBUTABLE_LICENSE_TOKENS:
        return False
    # Anchored prefix match ONLY. A substring test here is a fail-open:
    # "mit" occurs inside "li*mit*ed" and "per*mit*ted", so bespoke
    # restrictive grants ("Limited Use License", "Usage permitted for
    # research only") would classify as redistributable.
    return any(low.startswith(p) for p in _REDISTRIBUTABLE_LICENSE_PREFIXES)


def _entry_content_publishable(
    registry_entry: dict | None,
    *,
    scores_only: bool,
    override: bool,
) -> tuple[bool, str]:
    """Decide whether per-entry corpus CONTENT may be uploaded publicly.

    Returns ``(allowed, reason)``. The aggregate run card publishes
    regardless; this only controls exposure of the raw source/reference text.
    NC / no-deriv / held-out / gold-standard / quarantined corpora are NEVER
    publishable and cannot be overridden from the client. The DB backstop is
    migration 033's ``run_card_entries_content_guard`` BEFORE INSERT/UPDATE
    trigger, which mirrors this function beneath every client and key (and is
    even stricter: it fail-safe-rejects an unregistered corpus, since at the DB
    we cannot honour the ``override`` below). ``override`` only lifts the default
    withholding of an *unregistered* corpus whose license we cannot confirm.
    """
    if scores_only:
        return False, "scores-only mode (--scores-only/--private): corpus content withheld"
    entry = registry_entry or {}
    seg = (entry.get("segment") or "").strip().lower()
    lic = entry.get("license")
    if entry.get("quarantine"):
        reason = entry.get("quarantine_reason") or "quarantined"
        return False, f"dataset is quarantined ({reason}) — corpus content withheld"
    if seg in ("held_out", "gold_standard"):
        return False, f"segment '{seg}' is sealed — corpus content withheld"
    if not _license_is_redistributable(lic):
        if registry_entry is None:
            if override:
                return True, ("unregistered corpus, --publish-entries override: "
                              "caller affirms redistribution rights")
            return False, ("unregistered/own corpus (license unconfirmed) — content "
                           "withheld by default; pass --publish-entries only if you "
                           "hold redistribution rights to post the text publicly")
        return False, (f"license '{lic or 'unknown'}' is not redistribution-cleared "
                       "(non-commercial / no-deriv / restricted) — corpus content withheld")
    return True, "redistribution-cleared (permissive license, open segment)"


# ---------------------------------------------------------------------------
# Coaching-prompt content gate (the 051 method-artifact exemption)
# ---------------------------------------------------------------------------
# Migration 051 shape-guards the world-readable run_card blob but exempts
# `system_prompt_used` (up to 64 KB) as the submitter's OWN method artifact —
# and the DB cannot scan that text against corpus content it refuses to host
# (never-host doctrine). A coached prompt that embeds corpus pairs would
# therefore publish restricted text through the one legitimately long field.
# This client-side scan is the enforcement point: it compares the prompt
# against the report's own source/reference pairs before anything is posted.
#
# A pair counts as EMBEDDED only when BOTH its source and its reference
# appear in the prompt (a grammar prompt legitimately mentions single words
# or English phrases; the leak signature is the aligned pair). Thresholds:
#   • sealed dataset (quarantined / held-out / gold-standard): ≥1 pair refuses;
#   • other restricted datasets: ≥3 pairs, or any sentence-length pair
#     (source ≥ 15 chars), refuses; 1–2 short pairs warn.
# Redistribution-cleared corpora are not scanned — their entries publish
# openly anyway. `--redact-coaching` publishes with the prompt text replaced
# by a marker (the sha256 provenance field is untouched).

_COACHING_SCAN_MIN_CHARS = 4          # ignore degenerate one/two-letter items
_COACHING_SCAN_SENTENCE_CHARS = 15    # a pair this long is a verbatim copy
_COACHING_SCAN_PAIR_LIMIT = 3         # systematic embedding threshold


def _normalize_for_scan(text: str) -> str:
    """Whitespace-collapsed, casefolded form for substring comparison."""
    return re.sub(r"\s+", " ", str(text or "")).strip().casefold()


def _coaching_prompt_pair_hits(
    prompt_text: str,
    entries: list[dict],
) -> list[dict]:
    """Report entries whose source AND reference both appear in the prompt."""
    prompt_norm = _normalize_for_scan(prompt_text)
    if not prompt_norm:
        return []
    hits = []
    for entry in entries or []:
        src = _normalize_for_scan(entry.get("source", ""))
        ref = _normalize_for_scan(
            entry.get("expected", "") or entry.get("reference", "")
        )
        if (len(src) >= _COACHING_SCAN_MIN_CHARS
                and len(ref) >= _COACHING_SCAN_MIN_CHARS
                and src in prompt_norm and ref in prompt_norm):
            hits.append({
                "id": entry.get("id"),
                "source_chars": len(src),
            })
    return hits


def _coaching_prompt_content_gate(
    run_card: dict,
    entries: list[dict],
    registry_entry: dict | None,
    *,
    redact: bool,
    owner_override: bool = False,
) -> None:
    """Refuse (or redact) a publish whose prompt embeds restricted pairs.

    Mutates ``run_card`` in place when redacting. Raises SystemExit on a
    violation without ``redact``. No-op for redistribution-cleared corpora,
    and for an UNREGISTERED corpus published with the --publish-entries
    owner affirmation (the author who may post the pairs themselves may
    also quote them in their own coaching prompt). A registered restricted
    corpus is always scanned — no override.
    """
    entry = registry_entry or {}
    seg = (entry.get("segment") or "").strip().lower()
    sealed = bool(entry.get("quarantine")) or seg in ("held_out", "gold_standard")
    cleared = (registry_entry is not None
               and not sealed
               and _license_is_redistributable(entry.get("license")))
    if cleared:
        return
    if registry_entry is None and owner_override:
        return

    prompt_text = run_card.get("system_prompt_used") or ""
    hits = _coaching_prompt_pair_hits(prompt_text, entries)
    if not hits:
        return

    sentence_hits = [h for h in hits
                     if h["source_chars"] >= _COACHING_SCAN_SENTENCE_CHARS]
    violation = (bool(hits) if sealed
                 else (len(hits) >= _COACHING_SCAN_PAIR_LIMIT
                       or bool(sentence_hits)))
    ids = ", ".join(str(h["id"]) for h in hits[:10])

    if not violation:
        print(
            f"\n  ⚠ Coaching-prompt scan: {len(hits)} corpus pair(s) "
            f"(entry ids {ids}) appear verbatim in system_prompt_used. "
            "Below the refusal threshold — publishing, but consider removing "
            "corpus pairs from coaching for a restricted dataset."
        )
        return

    if redact:
        sha = run_card.get("system_prompt_sha256") or ""
        run_card["system_prompt_used"] = (
            f"[REDACTED --redact-coaching: prompt embedded {len(hits)} "
            f"source/reference pair(s) of a restricted corpus (entry ids "
            f"{ids}); full prompt stays in the local RunLog; "
            f"sha256={sha}]"
        )
        print(
            f"\n  🔒 Coaching prompt REDACTED on the published card — it "
            f"embedded {len(hits)} restricted corpus pair(s) (entry ids "
            f"{ids}). The sha256 provenance field is unchanged."
        )
        return

    print(
        f"\n  ✗ COACHING-PROMPT CONTENT GATE: system_prompt_used embeds "
        f"{len(hits)} source/reference pair(s) of this "
        f"{'sealed' if sealed else 'restricted'} corpus (entry ids {ids}).\n"
        "    Publishing it would post restricted corpus content through the "
        "run card's method-artifact field\n"
        "    (never-host doctrine, champollion.dev/docs/network/sovereignty/data-sovereignty). Options:\n"
        "      • re-run with coaching that does not copy corpus pairs, or\n"
        "      • publish with --redact-coaching (card keeps the prompt's "
        "sha256, text replaced by a marker)."
    )
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# Git provenance
# ---------------------------------------------------------------------------

def _detect_git_provenance() -> dict | None:
    """Auto-detect git repo URL and commit hash.

    Runs from the harness's own directory. Returns None if git is
    unavailable or we're not inside a git repo.
    """
    import subprocess

    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        if commit.returncode != 0:
            return None

        repo = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=5,
        )

        dirty = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=5,
        )

        return {
            "type": "git",
            "commit": commit.stdout.strip(),
            "repo": repo.stdout.strip() if repo.returncode == 0 else None,
            "dirty": bool(dirty.stdout.strip()) if dirty.returncode == 0 else None,
        }
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # git not installed or timed out
        return None


# ---------------------------------------------------------------------------
# Composite score — imports from scoring.py (code mirror of SCORING_SPEC §4)
# ---------------------------------------------------------------------------
# Weight tables, normalization rules, tier thresholds, and composite logic
# live in scoring.py — the single code authority that mirrors SCORING_SPEC.md.
# publish.py consumes these; it does not define its own.

from mt_eval_harness.scoring import (
    compute_composite_score,
    classify_quality_tier,
    cost_adjusted_score,
    morph_counts as _morph_counts,
)
# Coverage floor for the FST-derived morphological_accuracy: below this fraction
# of analyzable predicted words being lemma-matched to the reference, the metric
# is too sparse to enter the composite (publish reports coverage transparently
# instead of scoring a misleading number). Defined in the metric's plugin home.
from mt_eval_harness.plugins.giellalt_fst import (
    MORPH_COVERAGE_FLOOR as _MORPH_COVERAGE_FLOOR,
)


# ---------------------------------------------------------------------------
# Pre-publish integrity gate (pre-launch audit 2026-06-13, blocking #3)
# ---------------------------------------------------------------------------

class PublishIntegrityError(Exception):
    """Raised when a run card fails a pre-publish integrity check.

    These are hard gates: a run that fails them must not reach the public
    board. They are the client-runnable complement to the un-bypassable DB
    triggers (migrations 022 quarantine, 023 score ranges).
    """


def verify_corpus_integrity(run_card: dict) -> list[str]:
    """Gate a run card against corpus-integrity fraud before publish.

    Stops the two attacks the 2026-06-13 board wipe was caused by:
      1. Vacuous runs (nothing actually evaluated) — hard fail.
      2. Running a DIFFERENT corpus than claimed — enforced via sha-parity
         against the authoritative in-repo registry pin. A submitter
         computes their own corpus_sha256, but they cannot change the
         registry, so a mismatch means the published corpus is not the
         registered one. This check ACTIVATES automatically once the
         registry pins shas (today many are null — see registry rework /
         audit #DB2); it is a no-op, with a warning, where no sha is pinned.

    Returns a list of non-fatal warnings. Raises PublishIntegrityError on a
    hard violation.
    """
    warnings: list[str] = []
    dataset = run_card.get("dataset", {})
    scores = run_card.get("scores", {})

    # 1. Vacuous-run block.
    evaluated = scores.get("evaluated")
    total = dataset.get("entry_count") or scores.get("total") or 0
    if evaluated is not None and evaluated <= 0:
        raise PublishIntegrityError(
            f"Refusing to publish a vacuous run: {evaluated} entries evaluated. "
            f"A run with no scored entries (e.g. an invalid model id producing "
            f"all errors) cannot go on the board."
        )
    if total <= 0:
        raise PublishIntegrityError(
            "Refusing to publish: corpus entry_count is 0."
        )

    # 2. sha-parity against the authoritative registry pin.
    dataset_id = dataset.get("id")
    run_sha = (dataset.get("sha256") or "").strip()
    entry = _lookup_registry_entry(dataset_id) if dataset_id else None
    registry_sha = (entry or {}).get("sha256")
    if registry_sha:  # only enforce where the registry actually pins a sha
        if not run_sha:
            raise PublishIntegrityError(
                f"Dataset '{dataset_id}' is sha-pinned in the registry "
                f"({registry_sha[:12]}…) but this run reports no corpus sha. "
                f"Cannot verify you ran the registered corpus."
            )
        if run_sha != registry_sha:
            raise PublishIntegrityError(
                f"Corpus sha mismatch for '{dataset_id}': run={run_sha[:12]}… "
                f"vs registry={registry_sha[:12]}…. The corpus you evaluated is "
                f"not the registered one; publication blocked."
            )
    elif entry is not None:
        warnings.append(
            f"Dataset '{dataset_id}' has no sha pinned in the registry yet — "
            f"corpus integrity cannot be fully verified (sha-parity will arm "
            f"once the registry is sha-pinned)."
        )

    # 3. Entry-count parity against the registry's declared size.
    #
    # When the registry declares a dataset size AND the sha is pinned
    # (meaning this is a well-known, verified dataset), reject runs that
    # evaluated fewer than 95% of the expected entries — this catches
    # accidental partial runs (e.g. 100/436) while allowing the small
    # tolerance needed for filtered entries or skipped duplicates.
    #
    # For unpinned datasets (custom/unregistered): warn only, don't block.
    registry_size = (entry or {}).get("size")
    if registry_size and registry_size > 0 and evaluated is not None:
        coverage = evaluated / registry_size
        if registry_sha and coverage < 0.95:
            raise PublishIntegrityError(
                f"Partial run: evaluated {evaluated}/{registry_size} entries "
                f"({coverage:.0%}) for sha-pinned dataset '{dataset_id}'. "
                f"The registry expects ~{registry_size} entries; runs below "
                f"95% coverage cannot be published. If this is intentional "
                f"(e.g. a filtered subset), register it as a separate dataset."
            )
        elif not registry_sha and coverage < 0.95:
            warnings.append(
                f"Partial run: evaluated {evaluated}/{registry_size} entries "
                f"({coverage:.0%}) for '{dataset_id}'. This will become a "
                f"hard block once the registry sha is pinned."
            )

    return warnings


# ---------------------------------------------------------------------------
# Run Card assembly
# ---------------------------------------------------------------------------

def _build_metric_availability(
    *,
    scores: dict,
    plugin_metrics: dict,
    has_fst: bool,
    morph_accuracy: float | None,
    morph_coverage: float | None,
    morph_floor: float,
    has_glossary: bool,
    has_references: bool,
    metricx_requested: bool,
) -> dict:
    """Explain each NULL/degraded metric on the run card.

    A null score is ambiguous — it can mean the language does not use this metric,
    an optional dependency was missing, coverage fell below the composite floor, the
    metric is opt-in and was not requested, or it is not implemented yet. Returns
    {canonical_metric_id: reason} for exactly the metrics that are NOT a plain
    computed value; a metric absent from this block was computed normally. Each
    reason is "<prefix>: <detail>" with prefix in {not_applicable, unavailable,
    below_coverage_floor, not_run, not_implemented, not_computed} so it stays
    machine-parseable. Mirrors the morph_in_composite precedent: a small derived
    disclosure block — no new metric, no scoring effect.
    """
    avail: dict[str, str] = {}

    def _null(key: str) -> bool:
        return scores.get(key) is None

    # An FST that ran but errored (pyhfst missing / transducer absent) fails honest
    # with an `error` on its aggregate — distinguish that from a language that has
    # no FST at all.
    fst_error = None
    for _k in ("giellalt_fst_validity", "fst_analyzer"):
        _d = plugin_metrics.get(_k)
        if isinstance(_d, dict) and _d.get("error"):
            fst_error = _d.get("error")
            break

    # Structural (FST) family.
    if not has_fst:
        avail["fst_acceptance_rate"] = (
            f"unavailable: {fst_error}" if fst_error
            else "not_applicable: no GiellaLT FST installed/declared for this language"
        )
    if morph_accuracy is None:
        if not has_fst:
            avail["morphological_accuracy"] = avail["fst_acceptance_rate"]
        else:
            avail["morphological_accuracy"] = (
                "not_computed: no predicted word lemma-matched the reference"
            )
    elif morph_coverage is None or morph_coverage < morph_floor:
        cov = "None" if morph_coverage is None else f"{morph_coverage:.2f}"
        avail["morphological_accuracy"] = (
            f"below_coverage_floor: coverage {cov} < {morph_floor} "
            f"(advisory value reported, excluded from composite)"
        )

    # Language-card-declared proxies.
    if _null("equivalent_match_rate"):
        avail["equivalent_match_rate"] = (
            "not_applicable: no equivalence linter declared on this language's card"
        )
    if _null("semantic_score"):
        avail["semantic_score"] = (
            "not_applicable: no semantic validator declared on this language's card"
        )

    # Behavioral: terminology needs a glossary to be meaningful.
    if _null("terminology_adherence"):
        avail["terminology_adherence"] = (
            "not_applicable: no coaching glossary supplied (metric inactive)"
            if not has_glossary
            else "not_computed: no glossary terms occurred in the source"
        )

    # Neural lane (reported separately, never composited).
    if _null("comet_score"):
        avail["comet_score"] = (
            "unavailable: COMET not computed (unbabel-comet not installed or no "
            "model resolved for this language)"
        )
    if _null("qe_score"):
        avail["qe_score"] = (
            "not_run: reference-based run (reference-free QE runs only when the "
            "corpus has no references)"
            if has_references
            else "unavailable: no QE model for this language or unbabel-comet missing"
        )
    if _null("metricx_score"):
        avail["metricx_score"] = (
            "unavailable: MetricX requested but the 'metricx' extra/model is missing"
            if metricx_requested
            else "not_run: MetricX is opt-in (pass --metricx)"
        )

    # Opt-in / informational comparators.
    if _null("fuse_score"):
        avail["fuse_score"] = (
            "not_run: FUSE is opt-in (--fuse) or its LaBSE ('fuse') extra is missing"
        )
    if _null("style_consistency_rate"):
        avail["style_consistency_rate"] = (
            "not_applicable: no style profile or register metadata for this run"
        )

    # Planned metrics (specified, never computed yet).
    avail["orthographic_accuracy"] = (
        "not_implemented: planned (needs per-language orthographic rule sets)"
    )
    avail["consistency_score"] = (
        "not_implemented: planned (cross-entry term consistency)"
    )

    return avail


def assemble_run_card(
    report_path: str | Path,
    method_card_path: str | Path | None = None,
) -> tuple[dict, str, str]:
    """Assemble a complete run card from a TestReport + its source RunLog.

    The run card is the atomic unit of evaluation defined in BENCHMARK_SPEC
    §3. It records the complete configuration, scores, cost, and speed of
    a single evaluation run: one method, one model, one configuration,
    one dataset.

    This function merges data from two sources:
        - The RunLog (raw results + config + provenance)
        - The TestReport (scored analysis: chrF++, BLEU, exact match, etc.)

    And computes:
        - Composite score (§4.2 weighted average)
        - Quality tier (§5 threshold classification)
        - Token aggregates (from per-entry usage data)
        - Latency percentiles (median, p95)
        - Fingerprint hash (§3.8 reproducibility identifier)
        - Run card hash (§3.9 tamper seal)

    Args:
        report_path: Path to the TestReport JSON.
        method_card_path: Optional path to a method card JSON.

    Returns:
        (run_card, deterministic_uuid, fingerprint_hash) tuple.

    Raises:
        FileNotFoundError if the report or its source RunLog is missing.
    """
    report_path = Path(report_path)
    report = json.loads(report_path.read_text(encoding="utf-8"))

    # Load the source RunLog.
    # First try the path recorded in the report, then fall back to
    # deriving it from the report filename (foo_report.json → foo.json).
    source_log_path = None
    if report.get("source_log"):
        candidate = Path(report["source_log"])
        if candidate.exists():
            source_log_path = candidate

    if source_log_path is None:
        # Convention: report is <run_id>_report.json, run log is <run_id>.json
        inferred = report_path.with_name(
            report_path.stem.replace("_report", "") + ".json"
        )
        if inferred.exists():
            source_log_path = inferred

    if source_log_path is None:
        raise FileNotFoundError(
            f"Source RunLog not found.\n"
            f"  Tried: {report.get('source_log', '(not set)')}\n"
            f"  And:   {report_path.stem.replace('_report', '')}.json"
        )

    run_log = json.loads(source_log_path.read_text(encoding="utf-8"))
    config = run_log.get("config", {})
    overall = report.get("overall", {})

    # Vacuous runs (every entry errored) score nothing — their 0.0 rates are
    # computed over zero evaluated entries. Refuse to mint a card for one.
    if overall.get("evaluated", 0) == 0:
        raise ValueError(
            f"Refusing to assemble a run card for {report_path}: evaluated=0 "
            f"({overall.get('error_count', '?')}/{overall.get('total_entries', '?')} "
            "entries errored). Re-run the evaluation; vacuous runs are never "
            "publishable."
        )

    # Provenance block (from runs using the updated pipeline.py).
    # Falls back to empty dict for legacy RunLogs that predate provenance.
    provenance = run_log.get("provenance", {})
    dataset_meta = provenance.get("dataset_meta", {})
    # Self-describing metadata from the corpus file itself (corpus_id,
    # ISO-coded language_pair, provenance.license). Empty dict when the
    # corpus file isn't reachable from the publish cwd.
    corpus_meta = _load_corpus_self_meta(config)

    # Load the method card. Precedence: an explicit --method-card file, else the
    # one the runner embedded in the RunLog provenance — self-contained MT
    # engines and method plugins self-describe their class/paradigm there
    # (runner.py passes method.method_card() into build_run_log). Without this
    # fallback an MT run published method_class/paradigm = NULL even though the
    # engine declared both at run time, so the leaderboard's method-axis filter
    # couldn't classify it (the dress-rehearsal bug).
    method_card = None
    if method_card_path:
        mc_path = Path(method_card_path)
        if not mc_path.exists():
            raise FileNotFoundError(f"Method card not found: {mc_path}")
        method_card = json.loads(mc_path.read_text(encoding="utf-8"))
    elif provenance.get("method_card"):
        method_card = provenance["method_card"]

    # -------------------------------------------------------------------
    # Token aggregation from per-entry usage data (§3.5)
    # -------------------------------------------------------------------
    results = run_log.get("results", [])

    prompt_tokens = 0
    completion_tokens = 0
    reasoning_tokens = 0
    cached_tokens = 0

    for r in results:
        usage = r.get("usage", {})
        prompt_tokens += usage.get("prompt_tokens", 0)
        completion_tokens += usage.get("completion_tokens", 0)
        # reasoning_tokens is nested under completion_tokens_details
        # in the OpenRouter response format
        ct_details = usage.get("completion_tokens_details", {})
        reasoning_tokens += ct_details.get("reasoning_tokens", 0)
        pt_details = usage.get("prompt_tokens_details", {})
        cached_tokens += pt_details.get("cached_tokens", 0)

    # -------------------------------------------------------------------
    # Latency percentiles (§3.6)
    # -------------------------------------------------------------------
    latencies = sorted(
        r.get("latency_s", 0)
        for r in results
        if not r.get("error")
    )
    n_latencies = len(latencies)

    avg_latency = round(sum(latencies) / n_latencies, 3) if n_latencies else None
    median_latency = round(
        latencies[n_latencies // 2], 3
    ) if n_latencies else None
    p95_latency = round(
        latencies[min(int(n_latencies * 0.95), n_latencies - 1)], 3
    ) if n_latencies else None

    # -------------------------------------------------------------------
    # FST acceptance — merge from plugin metrics or standalone FST report
    # -------------------------------------------------------------------
    plugin_metrics = overall.get("plugin_metrics", {})

    # Check TestReport plugin metrics first (integrated FST plugin)
    fst_acceptance_rate = None
    fst_accepted_count = None
    morph_accuracy = None      # FST-derived morphological_accuracy (active, coverage-gated)
    morph_coverage = None      # fraction of analyzable predicted words lemma-matched
    fst_version_info = None    # FST release + pyhfst version (set when FST data present)

    # giellalt_fst_validity is the canonical FST metric key.
    # Also check legacy fst_analyzer for pre-plugin standalone reports.
    for fst_key in ("giellalt_fst_validity", "fst_analyzer"):
        fst_data = plugin_metrics.get(fst_key, {})
        if fst_data and not fst_data.get("error"):
            # GiellaLT and CRK FST use 'avg_fst_validity';
            # legacy fst_analyzer uses 'acceptance_rate'.
            # Explicit None checks — 0.0 is a valid value (all words invalid)
            # and must NOT fall through to the legacy key.
            rate = fst_data.get("avg_fst_validity")
            if rate is None:
                rate = fst_data.get("acceptance_rate")
            fst_acceptance_rate = rate
            # GiellaLTFSTMetric uses 'total_valid_words';
            # legacy fst_analyzer uses 'accepted'
            count = fst_data.get("total_valid_words")
            if count is None:
                count = fst_data.get("accepted")
            fst_accepted_count = count
            # morphological_accuracy + coverage (FST-derived, lemma-matched).
            # Reported as ADVISORY — see the run-card scores note below.
            morph_accuracy = fst_data.get("morphological_accuracy")
            morph_coverage = fst_data.get("morph_coverage")
            # FST release + pyhfst version (GiellaLTFSTMetric.version_info());
            # carried into the run card below (sacrebleu_signatures precedent).
            fst_version_info = fst_data.get("fst_version_info")
            break

    # If no FST data in TestReport, check for standalone _fst.json file
    # alongside the report (produced by the method's own eval scripts)
    if fst_acceptance_rate is None:
        fst_report_path = report_path.with_name(
            report_path.stem.replace("_report", "_fst") + ".json"
        )
        if fst_report_path.exists():
            try:
                fst_report = json.loads(
                    fst_report_path.read_text(encoding="utf-8")
                )
                fst_acceptance_rate = fst_report.get(
                    "fst_overall_acceptance_rate"
                )
                fst_accepted_count = fst_report.get("fst_total_accepted")
            except (json.JSONDecodeError, KeyError) as exc:
                # WARNING: This switches composite scoring to Profile B
                # (no-FST weights) because fst_acceptance_rate stays None.
                print(
                    f"  ⚠ FST report at {fst_report_path} is malformed "
                    f"({exc}). Composite will use no-FST weights."
                )

    has_fst = fst_acceptance_rate is not None

    # -------------------------------------------------------------------
    # Extract equivalent_match_rate from any equivalence-linter plugin
    #
    # Language-card-declared linter plugins (e.g. CrkLinterMetric for
    # Plains Cree) emit `is_equivalence_linter: True` plus
    # `equivalent_match_rate` in their aggregate output. We discover
    # the FIRST plugin that carries these flags — same generic pattern
    # used by run_card.py (L253-266). No language is hardcoded.
    # -------------------------------------------------------------------
    equivalent_match_rate = None
    equivalent_match_count = None

    # LYSS provenance envelope (roles.py): any LYSS plugin aggregate carries
    # lyss_role / lyss_version / tool_versions. Collected once here and
    # published as run_card["lyss_provenance"] (sibling of fst_provenance) so
    # a LYSS-scored run card records exactly which standard + tools ruled.
    lyss_provenance = None
    for _plug_key, _plug_data in plugin_metrics.items():
        if not isinstance(_plug_data, dict) or _plug_data.get("error"):
            continue
        if _plug_data.get("lyss_role"):
            if lyss_provenance is None:
                lyss_provenance = {
                    "lyss_version": _plug_data.get("lyss_version"),
                    "roles": {},
                }
            lyss_provenance["roles"][_plug_data["lyss_role"]] = {
                "plugin": _plug_key,
                "canonical_metric": _plug_data.get("lyss_canonical_metric"),
                "tool_versions": _plug_data.get("tool_versions"),
            }

    for _plug_key, _plug_data in plugin_metrics.items():
        if not isinstance(_plug_data, dict) or _plug_data.get("error"):
            continue
        # Match by role envelope (primary), explicit legacy flag, or shape
        # (rate + variant_class_counts) — oldest reports carry only the shape.
        is_equiv = (
            _plug_data.get("lyss_role") == "eq"
            or _plug_data.get("is_equivalence_linter")
            or (
                "equivalent_match_rate" in _plug_data
                and "variant_class_counts" in _plug_data
            )
        )
        if is_equiv:
            equivalent_match_rate = _plug_data.get("equivalent_match_rate")
            if equivalent_match_rate is not None:
                evaluated = overall.get("evaluated", 0)
                equivalent_match_count = round(equivalent_match_rate * evaluated)
            break  # first match wins (one equivalence linter per language)

    # -------------------------------------------------------------------
    # Extract semantic_score from any semantic-validator plugin (§4.2)
    #
    # Semantic-validator plugins (e.g. CrkSemanticMetric for Plains Cree)
    # emit `semantic_verdict_counts` in their aggregate output. We
    # discover the FIRST plugin carrying this field — no language hardcoded.
    #
    # Verdict weights reflect semantic fidelity (conservative baseline):
    #   EXACT_MATCH  → 1.0  (identical output)
    #   VALID        → 1.0  (correct lemmas, inflection/order variation)
    #   GRAMMAR_ISSUES  → 0.7  (right lemmas, structural grammar issues)
    #   PARTIAL      → 0.4  (some correct, some missing/wrong)
    #   INCOMPLETE   → 0.3  (compressed — missing content)
    #   WRONG        → 0.0  (genuinely incorrect lemma choices)
    #   NO_OUTPUT    → 0.0  (nothing generated)
    #   ERROR        → 0.0  (validation itself failed)
    # -------------------------------------------------------------------
    semantic_score = None

    _SEMANTIC_VERDICT_WEIGHTS = {
        "EXACT_MATCH": 1.0,
        "VALID": 1.0,
        "GRAMMAR_ISSUES": 0.7,
        "PARTIAL": 0.4,
        "INCOMPLETE": 0.3,
        "WRONG": 0.0,
        "NO_OUTPUT": 0.0,
        "ERROR": 0.0,
    }

    for _sem_key, _sem_data in plugin_metrics.items():
        if not isinstance(_sem_data, dict) or _sem_data.get("error"):
            continue
        # Role envelope is the primary marker; the data field doubles as the
        # legacy discovery flag (pre-envelope reports carry only the counts).
        if _sem_data.get("lyss_role") not in (None, "sem"):
            continue
        verdict_counts = _sem_data.get("semantic_verdict_counts")
        if verdict_counts:
            total_judged = sum(verdict_counts.values())
            if total_judged > 0:
                weighted_sum = sum(
                    count * _SEMANTIC_VERDICT_WEIGHTS.get(verdict, 0.0)
                    for verdict, count in verdict_counts.items()
                )
                semantic_score = round(weighted_sum / total_judged, 4)
            break  # first match wins (one semantic validator per language)

    # -------------------------------------------------------------------
    # Extract behavioral metrics from plugin aggregates
    #
    # These are computed by language-agnostic plugins (CodeSwitching,
    # Hallucination, Terminology) and need to be fed into the composite.
    # scoring.py handles the inversion (1 - rate) for code_switching and
    # hallucination, so we pass raw rates here.
    # -------------------------------------------------------------------
    code_switching_rate = None
    cs_data = plugin_metrics.get("code_switching", {})
    if cs_data and not cs_data.get("error"):
        code_switching_rate = cs_data.get("avg_code_switching_rate")

    hallucination_rate = None
    hall_data = plugin_metrics.get("hallucination", {})
    if hall_data and not hall_data.get("error"):
        hallucination_rate = hall_data.get("avg_hallucination_rate")

    terminology_adherence = None
    term_data = plugin_metrics.get("terminology", {})
    if term_data and not term_data.get("error"):
        terminology_adherence = term_data.get("avg_terminology_adherence")

    # Writing style (informational only — NOT in composite)
    style_consistency_rate = None
    ws_data = plugin_metrics.get("writing_style", {})
    if ws_data and not ws_data.get("error"):
        style_consistency_rate = ws_data.get("style_consistency_rate")

    # -------------------------------------------------------------------
    # Composite score (SCORING_SPEC §4)
    # -------------------------------------------------------------------
    # Build a dict of available metrics in their NATIVE scales.
    # scoring.py handles normalization (chrF++ ÷ 100, inversions)
    # internally — we pass raw values here.
    corpus_chrf = overall.get("corpus_chrf")
    composite_inputs = {
        # chrF++ in sacrebleu native 0–100 scale; scoring.py normalizes
        "chrf_plus_plus": corpus_chrf,
        "exact_match_rate": overall.get("exact_match_rate"),
        "fst_acceptance_rate": fst_acceptance_rate,
        # LYSS-eq: wired from CrkLinterMetric when available, else None
        "equivalent_match_rate": equivalent_match_rate,
        # LYSS-sem: wired from CrkSemanticMetric when available, else None
        "semantic_score": semantic_score,
        # Behavioral metrics — wired from plugin aggregates
        "code_switching_rate": code_switching_rate,
        "hallucination_rate": hallucination_rate,
        "terminology_adherence": terminology_adherence,
        # NOTE: neural metrics (comet_score, qe_score) are deliberately NOT here —
        # the composite is DETERMINISTIC (scoring.NEURAL_METRICS). They are computed
        # and stored separately on the run card + their own DB columns (the "Neural
        # metrics" block below), never folded into the composite. (By design.)
        # morphological_accuracy (FST-derived, lemma-matched). ACTIVE in the
        # fst-coverage composite (2026-06-16; migration 029 applied dev+prod, verifier
        # re-derives it). SUPPLIED coverage-gated: the value only when morph_coverage ≥
        # MORPH_COVERAGE_FLOOR (else None → excluded + advisory), so a too-sparse run
        # never carries a misleading number into the composite.
        "morphological_accuracy": (
            morph_accuracy
            if (morph_coverage is not None and morph_coverage >= _MORPH_COVERAGE_FLOOR)
            else None
        ),
        # orthographic_accuracy stays unsupplied (no per-language rule sets yet).
    }

    # Resolve the card-driven scoring profile (SCORING_SPEC §4.3). The default
    # reproduces the legacy has_fst → Profile A/B behavior; a card may override
    # via scoringProfile.basis. fst_ran = did an FST score this run? has_references
    # = did it have gold references (False → the reference-free no-reference profile).
    _scoring_target = config.get("target_lang", "")
    _scoring_lang_code = (
        _resolve_lang_to_code(_scoring_target) if _scoring_target else ""
    )
    if _scoring_target and _scoring_lang_code == "?":
        print(
            f"  ⚠ Could not resolve target language '{_scoring_target}' to an "
            f"ISO code via the language-cards SSOT — using generic surface "
            f"scoring (no language-specific FST/profile applied)."
        )
    _has_references = bool(overall.get("has_references", True))
    scoring_profile = _resolve_scoring_profile(
        _scoring_lang_code, fst_ran=has_fst, has_references=_has_references
    )

    composite = compute_composite_score(
        composite_inputs, profile=scoring_profile
    )
    quality_tier = classify_quality_tier(composite)

    # -------------------------------------------------------------------
    # Cost
    # -------------------------------------------------------------------
    # total_cost_usd may be None = cost UNKNOWN (un-priceable model). Keep it
    # None through to the card rather than coercing to 0 — an unknown cost and
    # a free run must stay distinguishable on the leaderboard.
    total_cost_usd = run_log.get("total_cost_usd")
    entry_count = overall.get("total_entries", 0)
    cost_per_entry = round(
        total_cost_usd / entry_count, 6
    ) if (entry_count and total_cost_usd is not None) else None

    # -------------------------------------------------------------------
    # Cost-adjusted score (SCORING_SPEC §6.3)
    # Rewards methods that achieve good composite scores efficiently.
    # -------------------------------------------------------------------
    cas = cost_adjusted_score(composite, cost_per_entry)

    # -------------------------------------------------------------------
    # Assemble the run card (BENCHMARK_SPEC §3)
    # -------------------------------------------------------------------

    # Detect git provenance from the harness repo
    git_provenance = _detect_git_provenance()

    # Condition label (§3.2). The CLI now derives prompt_version="coached"
    # when coaching is supplied with the default --prompt, but run logs
    # produced before that change (or by direct API use) still say "naive"
    # even though a coaching prompt replaced the naive system prompt at
    # runtime. Relabel from provenance so the published condition reflects
    # what actually ran. Explicit non-default labels are preserved.
    condition = config.get("prompt_version", "")
    if condition == "naive" and provenance.get("coaching_prompt"):
        condition = "coached"

    run_card = {
        # §3.1 Top-level
        "run_id": run_log.get("run_id", ""),
        "harness_version": run_log.get("harness_version", ""),
        "timestamp": run_log.get("timestamp_start", ""),
        "elapsed_seconds": run_log.get("elapsed_s"),

        # §3.2 Method configuration
        # All parameters that could affect translation quality are recorded
        # here so that published results can be fully understood and compared.
        # A self-contained MT engine (--method google-translate, deepl, …) does
        # its own translation and leaves the LLM `model` field at its default.
        # The fixed runner relabels config.model to the engine id, but prefer
        # mt_method here too so even a run log minted by an older runner names
        # the engine on the leaderboard instead of the leftover LLM slug.
        # Method-plugin runs (--method path/to/dir) are the same shape: the
        # fixed runner relabels config.model to the plugin's method_id, and
        # for run logs minted by older runners the provenance method card's
        # method_id (when the plugin shipped one) overrides the phantom
        # default LLM slug. The fingerprint hashes run_card["model_slug"], so
        # it stays consistent with whatever lands here.
        "model_slug": (config.get("mt_method")
                       or _method_plugin_id(config, provenance)
                       or config.get("model", "")),
        "model_id": (config.get("mt_method")
                     or _method_plugin_id(config, provenance)
                     or config.get("_model_id", config.get("model", ""))),
        # Real API provider from the run config (openrouter/openai/anthropic/
        # gemini/…), not a hardcoded assumption. config.to_dict() always
        # includes it, so a direct-vendor run is no longer mislabeled.
        "api_provider": config.get("provider"),
        "condition": condition,
        "temperature": config.get("_effective_temperature",
                                  config.get("temperature", 0)),
        "max_tokens": config.get("max_tokens"),
        "system_prompt_sha256": provenance.get("system_prompt_sha256", ""),
        "system_prompt_used": provenance.get("system_prompt_used", ""),
        "coaching_data_sha256": provenance.get("coaching_prompt_sha256") or None,
        # FST release + pyhfst version, captured by GiellaLTFSTMetric.version_info()
        # and carried on its aggregate output (sacrebleu_signatures precedent). The
        # top-level string is the transducer RELEASE tag (benchmark-spec §3.2
        # fst_version); the full provenance rides in the fst_provenance block.
        "fst_version": (fst_version_info or {}).get("fst_release"),
        "fst_provenance": fst_version_info,
        # LYSS standard provenance (roles.py envelope): which LYSS version +
        # per-role tool versions ruled this run. None when no LYSS plugin ran.
        "lyss_provenance": lyss_provenance,
        "tools_enabled": config.get("tools_enabled", False),
        "batch_size": config.get("batch_size", 25),
        "concurrency": config.get("concurrency"),

        # §3.3 Dataset reference
        "dataset": {
            "id": _resolve_dataset_id(config, corpus_meta),
            "version": dataset_meta.get("version")
                or corpus_meta.get("version"),
            "language_pair": _build_language_pair(config, corpus_meta),
            "source_lang": config.get("source_lang", ""),
            "target_lang": config.get("target_lang", ""),
            "sha256": provenance.get("corpus_sha256", ""),
            "entry_count": entry_count,
        },

        # §3.4 Scores (quality) — all automated metrics, see §1.1
        "scores": {
            "total": entry_count,
            "evaluated": overall.get("evaluated", 0),
            "exact_matches": overall.get("exact_match_count", 0),
            "exact_match_rate": overall.get("exact_match_rate", 0),
            # Wired from CrkLinterMetric: exact OR acceptable-variant matches
            "equivalent_matches": equivalent_match_count,
            "equivalent_match_rate": equivalent_match_rate,
            "fst_accepted": fst_accepted_count,
            "fst_acceptance_rate": fst_acceptance_rate,
            # FST-derived morphological_accuracy (lemma-matched) + its coverage.
            # ACTIVE in the fst-coverage composite (verifier-re-derived); enters the
            # composite only when coverage ≥ MORPH_COVERAGE_FLOOR, else advisory.
            # morph_in_composite reflects whether it ACTUALLY scored (active AND
            # coverage ≥ floor) for this run.
            "morphological_accuracy": morph_accuracy,
            "morph_coverage": morph_coverage,
            "morph_in_composite": _morph_counts(
                morph_accuracy, morph_coverage, floor=_MORPH_COVERAGE_FLOOR
            ),
            "chrf_plus_plus": corpus_chrf,
            # TER: Translation Edit Rate (sacrebleu) — lower is better.
            # Excluded from composite (Appendix A: correlates with chrF++,
            # including both would double-count surface similarity).
            "ter": overall.get("corpus_ter"),
            # Comparability sidecar (reported, NOT in composite): spBLEU (FLORES-200
            # tokenizer) + plain chrF (word_order=0) for apples-to-apples against
            # FLORES / NLLB / WMT published tables.
            "spbleu": overall.get("corpus_spbleu"),
            "chrf_plain": overall.get("corpus_chrf_plain"),
            # SacreBLEU signatures (reproducibility) — the full per-metric
            # signature strings (tokenizer, smoothing, case, nrefs, sacreBLEU
            # version) so any published surface score (chrF++/BLEU/spBLEU/TER)
            # can be re-derived. Reported, never composited. The leaderboard
            # reads these from the run_card JSONB on row expand.
            "sacrebleu_signatures": overall.get("sacrebleu_signatures"),
            # FUSE-style comparator (opt-in, reported, NOT in composite) — an
            # UNTRAINED reimplementation of the AmericasNLP-2025 FUSE approach.
            "fuse_score": overall.get("fuse_score"),
            "fuse_components": overall.get("fuse_components"),
            "fuse_untrained": overall.get("fuse_untrained"),
            # Length ratio: avg(len(predicted) / len(expected)) across entries.
            # Diagnostic, not a quality signal — ideal is 1.0.
            "length_ratio": overall.get("avg_length_ratio"),
            # Wired from CrkSemanticMetric: weighted verdict score (0.0–1.0)
            "semantic_score": semantic_score,
            # §2.4 Behavioral metrics — raw rates, always persisted.
            # These feed into composite scoring (scoring.py handles inversion)
            # and must be stored for retroactive rescoring.
            "code_switching_rate": code_switching_rate,
            "hallucination_rate": hallucination_rate,
            "terminology_adherence": terminology_adherence,
            # §2.5 Writing style (informational — NOT in composite)
            "style_consistency_rate": style_consistency_rate,
            # SCORING_SPEC §4.3: which named profile produced the composite
            # (e.g. "fst-coverage", "surface-only"). Makes the composite's
            # weighting auditable per row on the leaderboard.
            "scoring_profile": scoring_profile,
            "composite": composite,
            "cost_adjusted": cas,
            "quality_tier": quality_tier,
            "errors": overall.get("error_count", 0),
            "by_difficulty": report.get("by_difficulty", {}),
            "by_domain": report.get("by_domain", {}),
            "by_provenance": {},                 # not yet tracked
            # Latency stats (§3.6)
            "avg_latency_seconds": avg_latency,
            "median_latency_seconds": median_latency,
            "p95_latency_seconds": p95_latency,
        },

        # §3.5 Totals (cost)
        "totals": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "reasoning_tokens": reasoning_tokens,
            "cached_tokens": cached_tokens,
            "total_cost_usd": total_cost_usd,
            # Original price of cache-hit entries — total_cost_usd is the
            # ACTUAL spend of this run (by design: # cached runs report accurately, original price alongside).
            "cached_cost_usd": run_log.get("cached_cost_usd", 0),
            "cost_per_entry_usd": cost_per_entry,
        },

        # Additional context
        "cache_hits": run_log.get("cache_hits", 0),
        "by_segment": report.get("by_segment", {}),
        "provenance": git_provenance,
        "method_card": method_card,

        # §3.7 Canonical MethodConfig — the exact config shape used by
        # champollion.config.json, method.json, and export-config.
        # Leaderboard --install reads this block directly so the installed
        # plugin uses the exact same config that produced these results.
        "method_config": {
            "model": config.get("_model_id", config.get("model", "")),
            "temperature": config.get("_effective_temperature",
                                      config.get("temperature", 0)),
            "batchSize": config.get("batch_size", 25),
            "register": provenance.get("register_used", None),
            "coachingFile": config.get("coaching_file", None),
            "coachingPrompt": None,  # Resolved at runtime — not persisted
            "promptContext": provenance.get("prompt_context_used", None),
            "qualityTier": quality_tier,
        },

        # Additional scores not in spec but useful
        "corpus_bleu": overall.get("corpus_bleu"),
    }

    # -------------------------------------------------------------------
    # Corpus license passthrough (project licensing policy)
    #
    # Embed the corpus license + attribution from the datasets registry
    # so every published run carries its license obligations. Nullable —
    # unregistered datasets publish fine, with a warning, so ad-hoc
    # corpora (--corpus path/to/file.json) are not blocked.
    # -------------------------------------------------------------------
    license_info = _lookup_corpus_license(run_card["dataset"]["id"])
    if license_info is None and corpus_meta:
        # Registry unavailable or dataset unregistered (typical for a
        # pip-installed harness) — fall back to the license the corpus
        # file carries in its own provenance block.
        corpus_prov = corpus_meta.get("provenance") or {}
        self_license = (corpus_prov.get("license") or "").strip()
        if self_license:
            attribution = (corpus_prov.get("source_url") or "").strip()
            license_info = {
                "license": self_license,
                "attribution": attribution or None,
            }
    if license_info is None:
        run_card["corpus_license"] = None
        run_card["corpus_attribution"] = None
        print(
            f"  ⚠ Dataset '{run_card['dataset']['id']}' is not in the "
            f"datasets registry — corpus_license/corpus_attribution will "
            f"be null. Register it in arena/datasets/registry.json to "
            f"track license obligations."
        )
    else:
        run_card["corpus_license"] = license_info["license"]
        run_card["corpus_attribution"] = license_info["attribution"]

    # -------------------------------------------------------------------
    # Contamination lane (SSOT: mt_eval_harness.contamination)
    #
    # A HIGH-contamination corpus (e.g. FLORES+, in essentially every frontier
    # model's training data) is relative-comparison-only: its scores rank
    # methods against each other on THIS corpus, never as absolute quality.
    # Stamp the grade + the derived relative_only flag onto the run card so the
    # record carries its own lane — the leaderboard and any downstream consumer
    # read it without re-deriving. Travels inside the run_card JSONB (no new
    # top-level DB column required). Nullable: unregistered/ungraded corpora are
    # treated as rankable on absolute quality.
    # -------------------------------------------------------------------
    try:
        from mt_eval_harness import contamination as _contam
    except ImportError as exc:
        raise RuntimeError(
            "contamination module missing — mt_eval_harness/contamination.py is "
            "the SSOT that stamps a run's score_lane (absolute-quality vs "
            "relative-comparison-only). Refusing to publish without it; a "
            "HIGH-contamination corpus could otherwise be published as absolute "
            "quality. Reinstall the harness: "
            "pip install --force-reinstall mt-eval."
        ) from exc
    _registry_entry = _lookup_registry_entry(run_card["dataset"]["id"])
    _contam_grade = _contam.normalize_grade(
        (_registry_entry or {}).get("contamination")
    )
    if _contam_grade is None and corpus_meta:
        _contam_grade = _contam.normalize_grade(corpus_meta.get("contamination"))
    run_card["dataset"]["contamination"] = _contam_grade
    run_card["contamination"] = _contam_grade
    # score_lane / relative_only fail safe via contamination.py: an unknown or
    # absent grade (_contam_grade is None) is stamped relative-comparison-only,
    # never absolute-quality. The lane decision is centralized — do NOT re-derive
    # it here, or the two could drift.
    run_card["relative_only"] = _contam.is_relative_only(_contam_grade)
    run_card["score_lane"] = _contam.lane_for_grade(_contam_grade)

    # -------------------------------------------------------------------
    # Throughput / speed metrics (SCORING_SPEC §7)
    #
    # These are derived from existing RunLog fields. They are NOT in the
    # composite — they measure speed, not quality.
    # -------------------------------------------------------------------
    elapsed_s = run_log.get("elapsed_s")
    total_tokens = prompt_tokens + completion_tokens

    tokens_per_second = None
    if elapsed_s and elapsed_s > 0 and total_tokens > 0:
        tokens_per_second = round(total_tokens / elapsed_s, 2)

    entries_per_minute = None
    if elapsed_s and elapsed_s > 0 and entry_count > 0:
        entries_per_minute = round(entry_count / (elapsed_s / 60), 2)

    # cost_per_source_char: normalize cost by total source characters.
    # Comparable across languages with different tokenization.
    total_source_chars = sum(
        len(r.get("source", "")) for r in results
    )
    cost_per_source_char = None
    if total_source_chars > 0 and total_cost_usd is not None and total_cost_usd > 0:
        cost_per_source_char = round(
            total_cost_usd / total_source_chars, 8
        )

    # tokens_per_entry: average token consumption per corpus entry.
    # Useful for comparing model verbosity across methods.
    tokens_per_entry = None
    if entry_count > 0 and total_tokens > 0:
        tokens_per_entry = round(total_tokens / entry_count, 2)

    # cost_per_1k_tokens: normalize cost by token volume.
    # Comparable across providers with different pricing models.
    cost_per_1k_tokens = None
    if total_tokens > 0 and total_cost_usd is not None and total_cost_usd > 0:
        cost_per_1k_tokens = round(
            total_cost_usd / total_tokens * 1000, 6
        )

    run_card["scores"]["tokens_per_second"] = tokens_per_second
    run_card["scores"]["entries_per_minute"] = entries_per_minute
    run_card["totals"]["cost_per_source_char"] = cost_per_source_char
    run_card["totals"]["tokens_per_entry"] = tokens_per_entry
    run_card["totals"]["cost_per_1k_tokens"] = cost_per_1k_tokens

    # --- Neural metrics (SEPARATE lane — NOT in the deterministic composite) ---
    # COMET/AfriCOMET adequacy + AfriCOMET-QE reference-free QE. Computed, stored,
    # and surfaced on their own (their own scores keys + DB columns); they never
    # enter the composite (scoring.NEURAL_METRICS; design decision).
    if overall.get("comet_score") is not None:
        run_card["scores"]["comet_score"] = overall["comet_score"]
        run_card["scores"]["comet_model"] = overall.get("comet_model", "")
        run_card["scores"]["comet_low_resource_warning"] = overall.get(
            "comet_low_resource_warning", False
        )
    else:
        run_card["scores"]["comet_score"] = None

    # Reference-free QE (neural; reported separately, not composited)
    run_card["scores"]["qe_score"] = overall.get("qe_score")
    run_card["scores"]["qe_model"] = overall.get("qe_model")
    run_card["scores"]["has_references"] = bool(overall.get("has_references", True))

    # MetricX-24 (neural; reported separately, NOT composited). LOWER-IS-BETTER
    # error metric (0–25) — the direction is stored alongside the score so any
    # consumer (leaderboard, exports) sorts ASCENDING, never like COMET/chrF++.
    # Lives in the run_card JSON scores block; a dedicated top-level DB column is a
    # follow-up (pairs with the COMET-surface chip — see the comet_score row note).
    if overall.get("metricx_score") is not None:
        run_card["scores"]["metricx_score"] = overall["metricx_score"]
        run_card["scores"]["metricx_model"] = overall.get("metricx_model", "")
        run_card["scores"]["metricx_lower_is_better"] = overall.get(
            "metricx_lower_is_better", True
        )
        run_card["scores"]["metricx_score_max"] = overall.get("metricx_score_max", 25.0)
        run_card["scores"]["metricx_qe_mode"] = overall.get("metricx_qe_mode", False)
        run_card["scores"]["metricx_low_resource_warning"] = overall.get(
            "metricx_low_resource_warning", False
        )
    else:
        run_card["scores"]["metricx_score"] = None

    # --- Metric availability disclosure (null-metric reasons) ---
    # A null metric is ambiguous: language does not use it / optional dependency
    # missing / coverage below floor / opt-in not requested / not implemented.
    # Make the reason explicit so no consumer conflates those. Derived block —
    # no new metric, no scoring effect (morph_in_composite precedent).
    run_card["scores"]["metric_availability"] = _build_metric_availability(
        scores=run_card["scores"],
        plugin_metrics=plugin_metrics,
        has_fst=has_fst,
        morph_accuracy=morph_accuracy,
        morph_coverage=morph_coverage,
        morph_floor=_MORPH_COVERAGE_FLOOR,
        has_glossary=bool(config.get("glossary")),
        has_references=bool(overall.get("has_references", True)),
        metricx_requested=bool(config.get("compute_metricx")),
    )

    # (morphological_accuracy / morph_coverage / morph_in_composite are set in the
    # run_card["scores"] literal above — they are in scope at construction time,
    # unlike the conditionally-computed comet/qe scores added here.)

    # Add bootstrap confidence intervals if computed. The composite CI from the
    # test step bootstraps over chrF/exact/FST with a profile guessed from FST
    # presence — it does NOT know the card-resolved profile or the full metric set,
    # so it can't bracket the headline composite. Recompute it HERE, where the
    # resolved `scoring_profile` + the full `composite_inputs` are known, so the CI
    # matches the deterministic composite exactly (same profile + metric set; only
    # the per-entry-derivable metrics vary across resamples — the rest are held at
    # their corpus value via base_scores). Neural metrics never enter (deterministic).
    cis = overall.get("confidence_intervals", {})
    if cis:
        _ci_entries = [e for e in report.get("entries", []) if not e.get("error")]
        if _ci_entries:
            from dataclasses import asdict as _asdict
            from functools import partial as _partial
            from mt_eval_harness.confidence import bootstrap_ci as _bootstrap_ci
            from mt_eval_harness.significance import composite_score as _composite_score
            _comp_ci = _bootstrap_ci(
                _ci_entries,
                metric_fn=_partial(
                    _composite_score,
                    profile=scoring_profile,
                    base_scores=composite_inputs,
                ),
                metric_name="composite_score",
            )
            cis = dict(cis)
            cis["composite_score"] = _asdict(_comp_ci)
        run_card["scores"]["confidence_intervals"] = cis

    # -------------------------------------------------------------------
    # Fingerprint — deterministic identity for deduplication (§3.8)
    #
    # Per BENCHMARK_SPEC §3.8, the fingerprint is the SHA-256 of:
    #   dataset.sha256 + model_slug + condition + system_prompt_sha256
    #   + temperature + harness_version
    #
    # Two runs with identical fingerprints used the same experimental
    # setup. Differences are due to API non-determinism or provider
    # model updates.
    #
    # NOTE: condition is the DERIVED label (coached runs whose config
    # still says "naive" are relabelled "coached" above), so a legacy
    # coached run log republished after that change fingerprints as
    # "coached" — a different hash/UUID than its original "naive"-labelled
    # publish. This is intentional: the old label misrepresented the
    # setup. True naive baselines are unaffected.
    # -------------------------------------------------------------------
    # batch_size and tools_enabled are included because they materially
    # affect output quality — a batch_size=25 run produces different
    # translations than batch_size=1, and tool-augmented runs use a
    # fundamentally different prompting strategy.
    fingerprint_components = {
        "dataset_sha256": run_card["dataset"]["sha256"],
        "model_slug": run_card["model_slug"],
        "condition": run_card["condition"],
        "system_prompt_sha256": run_card["system_prompt_sha256"],
        "temperature": run_card["temperature"],
        "batch_size": run_card["batch_size"],
        "tools_enabled": run_card["tools_enabled"],
        "harness_version": run_card["harness_version"],
    }

    fp_json = json.dumps(
        fingerprint_components, sort_keys=True, ensure_ascii=False
    )
    fingerprint_hash = hashlib.sha256(fp_json.encode()).hexdigest()

    run_card["fingerprint"] = {
        "hash": fingerprint_hash,
        "components": fingerprint_components,
    }

    # -------------------------------------------------------------------
    # Run card hash — tamper seal (§3.9)
    # Computed AFTER fingerprint is set but BEFORE the hash field itself.
    # -------------------------------------------------------------------
    run_card["run_card_hash"] = ""  # placeholder so JSON structure is stable
    card_json = json.dumps(run_card, sort_keys=True, ensure_ascii=False)
    run_card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()

    # -------------------------------------------------------------------
    # Deterministic UUID — derived from the fingerprint hash.
    # Same experiment always gets the same UUID → upsert deduplicates.
    # -------------------------------------------------------------------
    card_id = str(uuid.uuid5(uuid.NAMESPACE_URL, fingerprint_hash))

    return run_card, card_id, fingerprint_hash


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def _to_percentage(rate: float) -> float:
    """Convert a 0.0–1.0 rate to a 0–100 percentage for display.

    Handles the case where the rate is already in percentage form
    (i.e., > 1.0) by returning it as-is.
    """
    if rate is None:
        return None
    if rate > 1.0:
        return round(rate, 1)
    return round(rate * 100, 1)



def _extract_lyss_verdicts(plugin_metrics: dict | None) -> dict:
    """Extract per-entry LYSS verdicts from plugin_metrics for SQL columns.

    Maps each plugin's per-entry output key to the denormalized column
    defined in migration 006 (run_card_entries table). Returns only
    non-None values to avoid overwriting NULLs with explicit None
    (Supabase treats them differently).

    Plugin discovery is by output field shape, not by hardcoded plugin
    name — any language's equivalence linter or semantic validator will
    be picked up automatically:
        giellalt_fst_validity.fst_validity_rate → fst_valid (bool)
        <any plugin>.equivalent_match            → equivalent_match (bool)
        <any plugin>.semantic_verdict             → semantic_verdict (str)
        code_switching.code_switching_rate        → code_switching_detected (bool)
        hallucination.hallucination_rate          → hallucination_detected (bool)
    """
    if not plugin_metrics:
        return {}

    verdicts = {}

    # Helper: safely get a plugin result as dict, skipping non-dict values
    # (e.g., an error string stored by a failed plugin run).
    def _get_dict(key: str) -> dict:
        val = plugin_metrics.get(key)
        return val if isinstance(val, dict) else {}

    # FST validity: rate == 1.0 means all words valid.
    # giellalt_fst_validity is the sole canonical FST metric key.
    fst = _get_dict("giellalt_fst_validity")
    if "fst_validity_rate" in fst:
        verdicts["fst_valid"] = fst["fst_validity_rate"] == 1.0

    # Linter equivalence: discover any plugin emitting `equivalent_match`.
    for _pk, _pd in plugin_metrics.items():
        if isinstance(_pd, dict) and "equivalent_match" in _pd:
            verdicts["equivalent_match"] = bool(_pd["equivalent_match"])
            break

    # Semantic verdict: discover any plugin emitting `semantic_verdict`.
    for _pk, _pd in plugin_metrics.items():
        if isinstance(_pd, dict) and "semantic_verdict" in _pd:
            verdicts["semantic_verdict"] = _pd["semantic_verdict"]
            break

    # Code-switching: any rate > 0 means switching detected
    cs = _get_dict("code_switching")
    if "code_switching_rate" in cs:
        verdicts["code_switching_detected"] = cs["code_switching_rate"] > 0

    # Hallucination: any rate > 0 means hallucination detected
    hall = _get_dict("hallucination")
    if "hallucination_rate" in hall:
        verdicts["hallucination_detected"] = hall["hallucination_rate"] > 0

    return verdicts


def _extract_method_taxonomy(run_card: dict) -> dict:
    """Derive the method-taxonomy columns from a run card's method card.

    Two orthogonal axes land as top-level run_cards columns for SQL-level
    leaderboard filtering and sorting:

      - ``method_class`` — *how* a method translates (raw-llm, coached-llm,
        pipeline, custom-plugin, api, human).
      - ``paradigm`` — the algorithmic *paradigm* (rule-based, statistical,
        neural-nmt, llm, hybrid, human, unknown), independent of class. This
        is what makes "rule-based vs neural vs llm" comparable: a rule-based
        Apertium pipeline and Google's api differ here even when their class
        collides. See config.VALID_PARADIGMS and migration 030.

    Both are nullable. A harness-native run (no method card) yields None for
    each; a pre-paradigm card yields method_class only. A NULL paradigm reads
    as "unknown" downstream.
    """
    card = run_card.get("method_card") or {}
    return {
        "method_class": card.get("class"),
        "paradigm": card.get("paradigm"),
    }


def _derive_llm_taxonomy(run_card: dict) -> dict:
    """Derive method_class + paradigm for a harness-native run with no card.

    A run published without a method card is a direct LLM call (the harness's
    own translate path). The provider's class/paradigm live in the shared
    method/provider registry SSOT (shared/method-registry.json, also consumed
    by the CLI), keyed by the run's ``api_provider`` (openrouter/openai/…). A
    coached run is the distinct ``coached-llm`` class on the same ``llm``
    paradigm. Falls back to raw-llm/llm when the SSOT isn't reachable (a
    standalone pip install has no ``shared/``) or the provider is unlisted —
    a no-method-card run is an LLM call by construction, so that default is
    safe and never leaves the column NULL.
    """
    provider = (run_card.get("api_provider") or "").strip().lower()
    method_class = None
    paradigm = None
    try:
        from mt_eval_harness.method_manifest import manifest_entries
        entry = manifest_entries(kind="llm-provider").get(provider) or {}
        method_class = entry.get("method_class")
        paradigm = entry.get("paradigm")
    except Exception:
        # A malformed/absent SSOT must never block a publish — fall through to
        # the safe LLM default below.
        pass
    method_class = method_class or "raw-llm"
    paradigm = paradigm or "llm"
    if run_card.get("condition") == "coached" and method_class == "raw-llm":
        method_class = "coached-llm"
    return {"method_class": method_class, "paradigm": paradigm}


def _resolve_method_taxonomy(run_card: dict) -> dict:
    """Resolve the method_class + paradigm columns actually written to a row.

    Precedence:
      1. An embedded method card self-describes both axes — MT engines and
         method plugins (class=api/pipeline/…, paradigm=neural-nmt/rule-based/…).
         A pre-paradigm card yields method_class only; paradigm stays None
         (reads as "unknown" downstream), matching ``_extract_method_taxonomy``.
      2. No method card → a harness-native LLM run; derive from the config
         (provider + condition) via ``_derive_llm_taxonomy``.

    ``_extract_method_taxonomy`` stays a pure card→columns mapping (its unit
    contract); this is the publish-time resolver that fills the LLM gap so the
    leaderboard's method-axis filters can classify *every* run instead of the
    all-NULL columns the dress rehearsal exposed.
    """
    if run_card.get("method_card"):
        return _extract_method_taxonomy(run_card)
    return _derive_llm_taxonomy(run_card)


# ---------------------------------------------------------------------------
# Row validation — required NOT NULL columns (see DATABASE_SCHEMA.md)
# ---------------------------------------------------------------------------

# Columns that are NOT NULL in run_cards with no DB default, and that must
# carry a real (non-empty) value for the row to make sense on the leaderboard.
REQUIRED_ROW_FIELDS = (
    "id",
    "submitter",
    "affirmation",
    "trust",
    "model_slug",
    "dataset_id",
    "language_pair",
    "harness_version",
    "run_card",
    "fingerprint_hash",
)

# NOT NULL columns where an empty string is technically valid (e.g. a run
# without a prompt_version has condition "") — only None/missing is an error.
REQUIRED_NOT_NULL_FIELDS = (
    "condition",
)

# Nullable columns that are explicitly OPTIONAL: a None value must never
# block a publish. corpus_license/corpus_attribution (migration 015) are
# null for datasets missing from arena/datasets/registry.json — assembly
# prints a warning instead of failing, so ad-hoc corpora stay publishable.
OPTIONAL_NULLABLE_FIELDS = (
    "corpus_license",
    "corpus_attribution",
)


def validate_row(row: dict) -> list[str]:
    """Check a Supabase run_cards row for required NOT NULL fields.

    Returns a list of field names that are missing, None, or empty
    (empty string / empty dict). An empty list means the row is valid.

    This guards against posting rows that the DB would reject (NOT NULL
    violations) or that would render as blank leaderboard entries.
    """
    problems = []

    for field in REQUIRED_ROW_FIELDS:
        value = row.get(field)
        if value is None:
            problems.append(field)
        elif isinstance(value, str) and not value.strip():
            problems.append(field)
        elif isinstance(value, dict) and not value:
            problems.append(field)

    for field in REQUIRED_NOT_NULL_FIELDS:
        if row.get(field) is None:
            problems.append(field)

    # OPTIONAL_NULLABLE_FIELDS are deliberately NOT checked: a null
    # corpus_license/corpus_attribution is valid (unregistered dataset)
    # and must not block the publish.

    return problems


# ---------------------------------------------------------------------------
# Resilient POST — retry with exponential backoff
# ---------------------------------------------------------------------------

# 3 attempts with 1s/2s/4s exponential backoff between retries.
UPSERT_MAX_ATTEMPTS = 3
UPSERT_BACKOFF_S = (1, 2, 4)


def _upsert_with_retry(
    req: urllib.request.Request,
    timeout: int = 15,
    max_attempts: int = UPSERT_MAX_ATTEMPTS,
) -> dict:
    """POST a prepared request to Supabase, retrying transient failures.

    Retries on HTTP 5xx and network-level errors (URLError, timeouts)
    with exponential backoff. 4xx responses are real errors (bad payload,
    auth, RLS rejection) — those fail immediately with the response body.

    Args:
        req: A fully-prepared urllib Request (headers + body set).
        timeout: Per-attempt socket timeout in seconds.
        max_attempts: Total number of attempts (including the first).

    Returns:
        The parsed JSON response body.

    Raises:
        SystemExit on a 4xx response or after all attempts are exhausted.
    """
    last_error = "unknown error"

    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            if exc.code < 500:
                # Client error — retrying won't help. Show the body so the
                # user can see what Supabase rejected (RLS, schema, auth).
                print(f"\n  ❌ Publish failed ({exc.code}): {body}")
                raise SystemExit(1)
            last_error = f"HTTP {exc.code}: {body[:200]}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            # Network-level failure: DNS, connection refused, timeout.
            last_error = f"network error: {exc}"

        if attempt < max_attempts:
            delay = UPSERT_BACKOFF_S[min(attempt - 1, len(UPSERT_BACKOFF_S) - 1)]
            print(
                f"  ⚠ Attempt {attempt}/{max_attempts} failed "
                f"({last_error}). Retrying in {delay}s..."
            )
            time.sleep(delay)

    print(f"\n  ❌ Publish failed after {max_attempts} attempts ({last_error})")
    raise SystemExit(1)


def _fetch_existing_card(card_id: str) -> dict | None:
    """Return the existing run_cards row for this id, or None.

    Read-only anon GET — run_cards SELECT is public. Network errors are
    treated as "not found" so a flaky pre-flight never blocks a publish;
    the upsert itself remains the authoritative gate.
    """
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/run_cards"
        f"?id=eq.{urllib.parse.quote(card_id)}"
        "&select=id,submitter,submitted_at,trust",
        headers={"apikey": SUPABASE_ANON_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read())
            return rows[0] if rows else None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None


def _upsert_run_card(
    req: urllib.request.Request,
    card_id: str,
    timeout: int = 15,
) -> dict:
    """POST the run-card upsert, treating a LOST concurrency race as success.

    ``publish_to_supabase`` already does a duplicate pre-flight
    (``_fetch_existing_card``) and the row id is a DETERMINISTIC fingerprint
    UUID, so the normal path never mints a second row for the same experiment.
    But two contributors running the SAME queue item simultaneously can BOTH
    pass the pre-flight (neither has published yet) and then both upsert.
    Submissions are immutable — migration 019 dropped the UPDATE policy on
    run_cards — so the loser's upsert hits the now-existing row and RLS
    rejects it with a 403, which ``_upsert_with_retry`` surfaces as
    ``SystemExit``.

    That is NOT a real failure: the result IS on the board, published by the
    other worker microseconds earlier. Re-check and, if the row now exists,
    return it as an idempotent success instead of failing the publish — so two
    simultaneous runs of one item never produce a duplicate row OR a spurious
    error. A genuine 4xx (bad payload, real RLS rejection, integrity gate)
    leaves no row behind, so it still re-raises.
    """
    try:
        return _upsert_with_retry(req, timeout=timeout)
    except SystemExit:
        existing = _fetch_existing_card(card_id)
        if existing is not None:
            print(
                "\n  ✓ This exact run was just published by another "
                "contributor (concurrency race) — treating as done; no "
                "duplicate row was created."
            )
            return existing
        raise


def build_run_card_row(
    run_card: dict,
    card_id: str,
    fingerprint_hash: str,
    *,
    submitter: str,
    trust: str = "unverified",
    affirmation: str | None = None,
) -> dict:
    """Build the Supabase ``run_cards`` row for an assembled run card.

    The one row-shape SSOT, shared by BOTH publish paths:
      * ``publish_to_supabase`` (user OAuth; trust is always 'unverified' —
        the DB INSERT RLS for authenticated users requires it; elevated tiers
        come only from service_role);
      * the organizer scoring node (``contest_node.py``, service_role), which
        passes ``trust='verified'`` — the reference holder scored the run
        deterministically itself (founder decision 2026-07-07). The METHOD
        label stays participant-claimed either way; that honesty lives on the
        run card / method card, not in the trust tier.

    Rate fields are raw 0.0–1.0 (migration 023 CHECKs). ``trust`` must be in
    migration 021's vocabulary.
    """
    if trust not in ("unverified", "verified", "disqualified"):
        raise ValueError(
            f"trust {trust!r} is not in the migration-021 vocabulary "
            f"(unverified/verified/disqualified).")

    scores = run_card["scores"]
    dataset = run_card["dataset"]
    totals = run_card["totals"]
    cis = scores.get("confidence_intervals", {})

    return {
        "id": card_id,
        "submitter": submitter,
        "affirmation": affirmation or (
            f"Results generated by mt-eval harness v{run_card['harness_version']} "
            f"and submitted by {submitter} via CLI."
        ),
        # Trust tier (migration 021 CHECK). CLI submissions are always
        # 'unverified' (INSERT RLS enforces it); 'verified' arrives only via
        # service_role (the verifier, or the organizer scoring node).
        "trust": trust,
        "model_slug": run_card["model_slug"],
        "condition": run_card["condition"],
        "dataset_id": dataset["id"],
        "language_pair": dataset.get("language_pair", "unknown>unknown"),
        "harness_version": run_card["harness_version"],
        "chrf_plus_plus": scores.get("chrf_plus_plus"),
        "corpus_bleu": run_card.get("corpus_bleu"),
        "exact_match_rate": scores.get("exact_match_rate"),
        "fst_acceptance_rate": scores.get("fst_acceptance_rate"),
        # Equivalent match rate — from CrkLinterMetric (nullable)
        "equivalent_match_rate": scores.get("equivalent_match_rate"),
        # Semantic score — from CrkSemanticMetric (nullable, 0.0–1.0)
        "semantic_score": scores.get("semantic_score"),
        # Composite score and quality tier (§4.2, §5)
        "composite_score": scores.get("composite"),
        "quality_tier": scores.get("quality_tier"),
        # COMET — nullable, None if unbabel-comet is not installed
        "comet_score": scores.get("comet_score"),
        # MetricX-24 (LOWER-IS-BETTER neural metric) is reported in the run_card
        # JSON scores block (run_card["scores"]["metricx_score"]), not as a
        # top-level column here — a dedicated column + migration is a follow-up
        # (pairs with the COMET-surface chip). Adding the key here without the
        # column would break the insert, so it is deliberately omitted.
        # Reference-free QE (no-reference profile) — nullable. Requires DB
        # migration 028 (qe_score, has_references columns).
        "qe_score": scores.get("qe_score"),
        "has_references": scores.get("has_references", True),
        # Morphological accuracy (FST-derived, lemma-matched) + its coverage —
        # nullable. Columns added by migration 029 (applied dev + prod 2026-06-16).
        # ACTIVE in the fst-coverage composite; the verifier re-derives
        # morphological_accuracy from the card-pinned FST against the canonical
        # corpus (fail-closed if absent, like COMET).
        "morphological_accuracy": scores.get("morphological_accuracy"),
        "morph_coverage": scores.get("morph_coverage"),
        # Confidence intervals — nullable numeric fields
        "chrf_ci_lower": cis.get("corpus_chrf", {}).get("ci_lower") if cis else None,
        "chrf_ci_upper": cis.get("corpus_chrf", {}).get("ci_upper") if cis else None,
        "exact_match_ci_lower": cis.get("exact_match_rate", {}).get("ci_lower") if cis else None,
        "exact_match_ci_upper": cis.get("exact_match_rate", {}).get("ci_upper") if cis else None,
        "fst_ci_lower": cis.get("fst_acceptance_rate", {}).get("ci_lower") if cis else None,
        "fst_ci_upper": cis.get("fst_acceptance_rate", {}).get("ci_upper") if cis else None,
        "composite_ci_lower": cis.get("composite_score", {}).get("ci_lower") if cis else None,
        "composite_ci_upper": cis.get("composite_score", {}).get("ci_upper") if cis else None,
        # Cost + timing
        "total_cost_usd": totals["total_cost_usd"],
        "cost_per_entry_usd": totals.get("cost_per_entry_usd"),
        "elapsed_seconds": run_card.get("elapsed_seconds"),
        "avg_latency_seconds": scores.get("avg_latency_seconds"),
        "corpus_size": scores.get("total"),
        # Full run card JSON — the complete record
        "run_card": run_card,
        "fingerprint_hash": fingerprint_hash,
        "api_provider": run_card.get("api_provider"),
        "run_timestamp": run_card.get("timestamp"),
        # Quality-affecting parameters as top-level columns for
        # leaderboard filtering and sorting. These are also in
        # the run_card JSON but top-level columns enable SQL queries.
        "batch_size": run_card.get("batch_size"),
        "temperature": run_card.get("temperature"),
        "max_tokens": run_card.get("max_tokens"),
        # Method taxonomy — method_class (raw-llm, coached-llm, pipeline, api,
        # …) plus the orthogonal paradigm axis (rule-based, neural-nmt, llm, …).
        # Top-level columns for the leaderboard's method-axis filter. Resolved
        # from the embedded method card (MT engines/plugins) or derived from the
        # run config for a harness-native LLM run — never left NULL for a real
        # run. See _resolve_method_taxonomy / migration 030.
        **_resolve_method_taxonomy(run_card),
        # New surface metrics — TER and length ratio
        "ter": scores.get("ter"),
        "length_ratio": scores.get("length_ratio"),
        # Throughput metrics
        "tokens_per_second": scores.get("tokens_per_second"),
        "entries_per_minute": scores.get("entries_per_minute"),
        "cost_per_source_char": totals.get("cost_per_source_char"),
        # Latency statistics — top-level columns for leaderboard sorting.
        # These exist in the run_card JSON scores block but also need
        # to be top-level for SQL queries (CLI migration 20260528024953).
        "median_latency_seconds": scores.get("median_latency_seconds"),
        "p95_latency_seconds": scores.get("p95_latency_seconds"),
        # Token efficiency metrics (SCORING_SPEC §6.1, §6.2)
        "tokens_per_entry": totals.get("tokens_per_entry"),
        "cost_per_1k_tokens": totals.get("cost_per_1k_tokens"),
        # §2.4 Behavioral metrics — top-level columns for SQL queryability.
        # Stored as raw rates (0.0–1.0), not percentages.
        "code_switching_rate": scores.get("code_switching_rate"),
        "hallucination_rate": scores.get("hallucination_rate"),
        "terminology_adherence": scores.get("terminology_adherence"),
        # §2.5 Writing style (informational only — not in composite)
        "style_consistency_rate": scores.get("style_consistency_rate"),
        # Corpus license passthrough (migration 015) — nullable TEXT columns.
        # Sourced from arena/datasets/registry.json at assembly time; null
        # for unregistered datasets (a warning was printed during assembly).
        "corpus_license": run_card.get("corpus_license"),
        "corpus_attribution": run_card.get("corpus_attribution"),
    }


def publish_to_supabase(
    report_path: str | Path,
    method_card_path: str | Path | None = None,
    auto_confirm: bool = False,
    scores_only: bool = False,
    publish_entries_override: bool = False,
    dry_run: bool = False,
    yes_prod: bool = False,
    anonymous: bool = False,
    redact_coaching: bool = False,
) -> dict:
    """Authenticate (or not), assemble a run card, and publish to the board.

    This is the main entry point for the 'mt-eval publish' command.

    Args:
        report_path: Path to the TestReport JSON file.
        method_card_path: Optional path to a method card JSON file.
        auto_confirm: If True, skip the confirmation prompt (for
                      scripted/batch publishing via --yes). This is NOT
                      consent to write to PROD — see ``yes_prod``.
        dry_run: If True, assemble and PRINT the run-card payload but make
                 NO network call (no auth, no upsert). Returns the would-be
                 row dict for inspection.
        yes_prod: Explicit opt-in to write to the PRODUCTION project,
                  distinct from ``auto_confirm``. A real (non-dry) write to
                  prod proceeds only when this is True OR MT_EVAL_ALLOW_PROD
                  is set in the environment; otherwise we refuse and exit
                  non-zero WITHOUT contacting Supabase.
        anonymous: Publish WITHOUT an account (founder directive 2026-07-13:
                   OAuth optional, not required). No auth flow runs; the
                   payload goes to the submit-run edge function, which
                   inserts it as submitter='anonymous', owner_uid=NULL,
                   trust='unverified' under the same DB integrity triggers.
                   Until that function is deployed on the target host, this
                   path fails honestly with the report path and re-publish
                   command — work is never silently lost.

    Returns:
        The upserted Supabase row as a dict (or the assembled would-be row
        when ``dry_run`` is True; or the intake function's result dict when
        ``anonymous`` is True).

    Raises:
        SystemExit on auth failure, Supabase errors, or a non-dry prod write
        without the explicit opt-in.
        AnonymousRateLimitError when the anonymous intake's per-IP/global
        window is closed (429 with a long retry_after) — callers defer or
        render the recovery command; the report on disk is never lost.
    """
    # --- Production-write guard (audit C1) ---
    # Refuse a non-dry prod write that has no explicit opt-in, BEFORE we
    # authenticate or touch the network. Dry-runs are always allowed (they
    # never write). Non-prod targets (staging branch) are never gated.
    print("=" * 60)
    print("MT Eval Harness — Publish to Leaderboard")
    print("=" * 60)

    if not dry_run and _is_prod_target() and not _prod_write_opted_in(yes_prod):
        print(
            "\n  ✗ Refusing to write to PRODUCTION without an explicit opt-in.\n"
            "    This is a live-leaderboard write, not a dry run. The generic\n"
            "    -y/--yes flag does NOT authorize a prod write.\n"
            "\n    To preview the payload without writing:\n"
            "        mt-eval publish <report> --dry-run\n"
            "    To intentionally write to prod, opt in explicitly:\n"
            "        mt-eval publish <report> --prod\n"
            "      or set MT_EVAL_ALLOW_PROD=1 in the environment.\n"
        )
        raise SystemExit(2)

    # --- Authenticate ---
    # Skipped entirely on a dry run — no network, no cached-credential read.
    # Skipped on an anonymous publish too: no account is needed (the
    # submit-run intake forces the identity server-side regardless).
    if dry_run:
        access_token = None
        submitter = "(dry-run — not authenticated)"
        print("\n  DRY RUN — assembling payload only; no network call will be made.")
    elif anonymous:
        access_token = None
        submitter = "anonymous"
        print("\n  Publishing ANONYMOUSLY — no account; the leaderboard will "
              "show submitter 'anonymous'.")
        print("  (Sign in instead — publish without --anonymous — to have "
              "this run credited to you.)")
    else:
        session = get_session()
        access_token = session["access_token"]
        submitter = get_submitter_name(session)

    # --- Assemble run card ---
    print("\n  Assembling run card...")
    run_card, card_id, fingerprint_hash = assemble_run_card(
        report_path, method_card_path
    )

    # --- Pre-publish integrity gate (audit blocking #3) ---
    # Hard-fail vacuous runs and corpus-sha mismatches before anything
    # reaches the board. Complements the un-bypassable DB triggers.
    try:
        for w in verify_corpus_integrity(run_card):
            print(f"  ⚠ {w}")
    except PublishIntegrityError as e:
        print(f"\n  ✗ INTEGRITY GATE FAILED: {e}")
        raise SystemExit(1)

    # --- Coaching-prompt content gate ---
    # system_prompt_used is 051's method-artifact exemption; scan it against
    # this run's own source/reference pairs so a coached prompt cannot carry
    # restricted corpus content onto the public board. Runs in every mode
    # (scores-only and dry-run included — the card field publishes either
    # way, and the preview should mirror the real publish).
    _scan_report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    _coaching_prompt_content_gate(
        run_card,
        _scan_report.get("entries", []),
        _lookup_registry_entry((run_card.get("dataset") or {}).get("id")),
        redact=redact_coaching,
        owner_override=publish_entries_override,
    )

    # --- Method card wizard ---
    # If no method card was provided and we're interactive, offer the wizard.
    # The wizard creates a method card dict that gets embedded in the run card.
    # A dry run is non-interactive (no prompts): skip the wizard offer.
    if method_card_path is None and not auto_confirm and not dry_run:
        if "method_card" not in run_card or run_card.get("method_card") is None:
            print("\n  No method card attached to this run.")
            offer = input("  Create one now? [Y/n] ").strip().lower()
            if not offer or offer == "y":
                from mt_eval_harness.method_card_wizard import run_wizard
                card = run_wizard(submitter=submitter)
                if card:
                    run_card["method_card"] = card
                    run_card["condition"] = card.get("class", run_card.get("condition", "unknown"))

    scores = run_card["scores"]
    dataset = run_card["dataset"]
    totals = run_card["totals"]

    # --- Build the Supabase row (shared builder — SSOT with the organizer
    # node's service-role publish path in contest_node.py) ---
    row = build_run_card_row(run_card, card_id, fingerprint_hash,
                             submitter=submitter)
    exact_match_rate = row["exact_match_rate"]
    equiv_rate = row["equivalent_match_rate"]
    fst_rate = row["fst_acceptance_rate"]
    cis = scores.get("confidence_intervals", {})

    # --- Preview ---
    print(f"\n  Submitter:     {submitter}")
    print(f"  Model:         {run_card['model_slug']}")
    print(f"  Condition:     {run_card['condition']}")
    print(f"  Batch size:    {run_card.get('batch_size', '?')}")
    print(f"  Temperature:   {run_card.get('temperature', '?')}")
    print(f"  Max tokens:    {run_card.get('max_tokens', '?')}")
    print(f"  Dataset:       {dataset['id']} ({scores.get('total', '?')} entries)")
    if run_card.get("corpus_license"):
        print(f"  License:       {run_card['corpus_license']}")
    # Show entry count — entries will be stored individually in run_card_entries
    report_data = json.loads(Path(report_path).read_text(encoding="utf-8"))
    entry_count = len(report_data.get("entries", []))
    if entry_count:
        print(f"  Entries:       {entry_count} (will be stored individually)")
    print(f"  chrF++:        {scores.get('chrf_plus_plus', 'N/A')}")
    if cis and cis.get("corpus_chrf"):
        ci = cis["corpus_chrf"]
        print(f"    95% CI:      [{ci['ci_lower']:.1f} – {ci['ci_upper']:.1f}]")
    print(f"  BLEU:          {run_card.get('corpus_bleu', 'N/A')}")
    if scores.get("ter") is not None:
        print(f"  TER:           {scores['ter']:.2f}")
    if scores.get("length_ratio") is not None:
        print(f"  Length Ratio:  {scores['length_ratio']:.4f}")
    if scores.get("comet_score") is not None:
        warning = " ⚠️  low-resource" if scores.get("comet_low_resource_warning") else ""
        comet_model = scores.get("comet_model")
        model_tag = f" ({comet_model})" if comet_model else ""
        print(f"  COMET-22:      {scores['comet_score']:.4f}{model_tag}{warning}")
    if scores.get("metricx_score") is not None:
        # LOWER is better (error score, 0–25); ↓ marks the direction explicitly.
        warning = " ⚠️  low-resource" if scores.get("metricx_low_resource_warning") else ""
        qe = " (QE)" if scores.get("metricx_qe_mode") else ""
        metricx_model = scores.get("metricx_model")
        model_tag = f" ({metricx_model})" if metricx_model else ""
        print(
            f"  MetricX-24 ↓:  {scores['metricx_score']:.3f}  "
            f"(lower=better, 0–25){qe}{model_tag}{warning}"
        )
    _sigs = scores.get("sacrebleu_signatures") or {}
    if _sigs:
        print("  SacreBLEU signatures (reproducibility):")
        for _sk in ("chrf", "bleu", "spbleu", "ter", "chrf_plain"):
            if _sigs.get(_sk):
                print(f"    {_sk:<10} {_sigs[_sk]}")
    print(f"  Exact Match:   {exact_match_rate:.1%}" if exact_match_rate is not None else "  Exact Match:   —")
    if equiv_rate is not None:
        print(f"  Equiv Match:   {equiv_rate:.1%}")
    if fst_rate is not None:
        print(f"  FST Accept:    {fst_rate:.1%}")
    if scores.get("semantic_score") is not None:
        print(f"  Semantic:      {scores['semantic_score']:.4f}")
    composite = scores.get("composite")
    if composite is not None:
        print(f"  Deterministic: {composite:.4f} ({scores.get('quality_tier', 'unscored')})  [composite — neural shown separately]")
    cost_adj = scores.get("cost_adjusted")
    if cost_adj is not None:
        print(f"  Cost-adjusted: {cost_adj:.4f}")
    _tc = totals.get("total_cost_usd")
    print(f"  Cost:          ${_tc:.4f}" if _tc is not None
          else "  Cost:          unknown (model not priced)")
    if totals.get("cost_per_entry_usd"):
        print(f"  Cost/entry:    ${totals['cost_per_entry_usd']:.6f}")
    if totals.get("cost_per_source_char"):
        print(f"  Cost/src char: ${totals['cost_per_source_char']:.8f}")
    if scores.get("tokens_per_second") is not None:
        print(f"  Tokens/sec:    {scores['tokens_per_second']:.1f}")
    if scores.get("entries_per_minute") is not None:
        print(f"  Entries/min:   {scores['entries_per_minute']:.1f}")
    print(f"  Fingerprint:   {fingerprint_hash[:16]}...")
    print(f"  UUID:          {card_id}")

    # --- Dry run: print the assembled payload and stop (no network) ---
    if dry_run:
        # Surface the same NOT-NULL validation we'd run before a real post,
        # so a dry-run preview also flags an incomplete card — but make NO
        # network call (no duplicate pre-flight, no upsert).
        problems = validate_row(row)
        print("\n  --- DRY RUN: run-card payload (NOT published) ---")
        print(json.dumps(row, indent=2, default=str, sort_keys=True))
        if problems:
            print("\n  ⚠ This card is incomplete and would be REJECTED on a real publish:")
            for field in problems:
                print(f"       - {field}")
        target = "PRODUCTION" if _is_prod_target() else "non-prod (staging)"
        print(
            f"\n  DRY RUN complete — nothing was written. Target would be: {target}."
            "\n  Re-run without --dry-run (and with --prod / MT_EVAL_ALLOW_PROD for "
            "prod) to publish."
        )
        return row

    # --- Confirm ---
    if auto_confirm:
        print("\n  Auto-confirmed (--yes)")
    else:
        confirm = input("\n  Publish these results? [Y/n] ").strip().lower()
        if confirm and confirm != "y":
            print("  Cancelled.")
            raise SystemExit(0)

    # --- Validate before posting ---
    # Catch rows the DB would reject (NOT NULL violations) before we
    # spend a network round-trip — and before partial publishes happen.
    problems = validate_row(row)
    if problems:
        print("\n  ❌ Run card is incomplete — missing or empty required fields:")
        for field in problems:
            print(f"       - {field}")
        print("  Nothing was published. Fix the report/run log and retry.")
        raise SystemExit(1)

    # --- Duplicate pre-flight ---
    # The card id is a deterministic UUID over the experiment fingerprint,
    # and submissions are immutable by design: migration 019 removed the
    # UPDATE policy on run_cards, so an upsert that hits an existing row is
    # rejected by RLS with an opaque 403 ("USING expression"). Check first
    # and explain, instead of failing.
    existing = _fetch_existing_card(card_id)
    if existing is not None:
        print(
            "\n  ✓ This exact experiment is already on the leaderboard "
            "(submissions are immutable):"
        )
        print(f"      id:           {card_id}")
        print(f"      submitter:    {existing.get('submitter', '?')}")
        print(f"      submitted at: {existing.get('submitted_at', '?')}")
        print(
            "    Nothing to publish. Run the experiment with a different "
            "model/corpus/condition,\n    or contact a moderator if this "
            "card needs correction."
        )
        # Same marker the anonymous intake uses for its idempotent-duplicate
        # response, so batch callers (republish_directory) can tally
        # "already on the board" without guessing from row keys.
        return {**existing, "already_published": True}

    # --- Anonymous lane: one POST to the submit-run intake function ---
    # The function validates, rate-limits per IP, and inserts with the
    # service role (submitter='anonymous', owner_uid=NULL); the quarantine /
    # score-integrity / sha-parity / content-guard triggers still fire.
    # Entries ride the same request, pre-gated by the identical client-side
    # content check the authed path uses (the 033 trigger is the backstop).
    if anonymous:
        report_data = json.loads(Path(report_path).read_text(encoding="utf-8"))
        entries = report_data.get("entries", [])
        _ds_id = (run_card.get("dataset") or {}).get("id")
        _reg = _lookup_registry_entry(_ds_id) if _ds_id else None
        _allow_entries, _gate_reason = _entry_content_publishable(
            _reg, scores_only=scores_only, override=publish_entries_override,
        )
        entry_rows = (_build_entry_rows(card_id, entries)
                      if (entries and _allow_entries) else [])

        print("\n  Publishing (anonymous intake)...")
        result = _post_anonymous(row, entry_rows, report_path)

        if result.get("already_published"):
            print("\n  ✓ This exact experiment is already on the leaderboard "
                  "(submissions are immutable) — nothing new to publish.")
            return result

        print("\n  ✅ Published to leaderboard!")
        if entries and not _allow_entries:
            print(f"  🔒 Per-entry corpus content WITHHELD — {_gate_reason}.")
            print(f"     Published: scores + corpus sha256 + size (run card).")
            print(f"     NOT uploaded: the {len(entries)} source/reference rows.")
        elif result.get("entries_withheld_reason"):
            print("  🔒 Per-entry corpus content WITHHELD by the database "
                  "content guard:")
            print(f"     {str(result['entries_withheld_reason'])[:200]}")
        elif entry_rows:
            print(f"  ✅ {result.get('entries_published', 0)}/{len(entry_rows)} "
                  f"entries published")
        else:
            print("  ℹ No per-entry data found in report (entries list empty)")

        print(f"     https://champollion.dev/leaderboard")
        print()
        print("  🙏 Thank you for your contribution to the Champollion Project!")
        print("     Published as submitter 'anonymous' — sign in next time to")
        print("     have your runs attributed to you. Results are live on the")
        print("     leaderboard immediately and join the network mesh at its")
        print("     next regeneration.")
        print("=" * 60)
        return result

    # --- Upsert ---
    print("\n  Publishing...")
    data = json.dumps(row).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/run_cards",
        data=data,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            # Upsert: if a row with the same id exists, update it.
            # This handles re-runs of the same experiment gracefully.
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
        method="POST",
    )

    # Idempotent under concurrency: if another contributor published this exact
    # run between our pre-flight and this upsert, the RLS-rejected retry is
    # recovered as the existing row (no duplicate) rather than a hard failure.
    result = _upsert_run_card(req, card_id, timeout=15)

    print(f"\n  ✅ Published to leaderboard!")

    # --- Upsert dataset metadata ---
    # Populate the datasets table organically — every publish writes the
    # corpus metadata so the leaderboard can filter by language pair
    # without digging into the run_card JSONB blob.
    #
    # SCHEMA NOTE: The live datasets table was created by CLI migration
    # 20260528024953 (with version NOT NULL, segment CHECK, scalar domain).
    # Arena migration 011 adds difficulty_min/max, domains[], segments[],
    # updated_at. This upsert is compatible with BOTH pre-011 and post-011
    # schemas because PostgREST ignores unknown columns in the payload.
    dataset = run_card.get("dataset", {})
    dataset_id = dataset.get("id", "")

    # Load report data from disk (needed for dataset metadata and per-entry publishing)
    report_data = json.loads(Path(report_path).read_text(encoding="utf-8"))

    # Attempt a datasets-table upsert ONLY for an unregistered / ad-hoc corpus.
    # A registered dataset's row already exists server-side and anon RLS forbids
    # writing it, so a POST would only ever return a non-fatal (but alarming)
    # 403 — see _should_upsert_dataset.
    if _should_upsert_dataset(dataset_id):
        # Extract corpus metadata from the loaded report
        by_difficulty = report_data.get("by_difficulty", {})
        difficulty_levels = [
            int(k) for k in by_difficulty.keys() if k.isdigit()
        ] if by_difficulty else []
        by_domain = report_data.get("by_domain", {})
        by_segment = report_data.get("by_segment", {})

        # PostgREST TEXT[] format: {"val1","val2"} not ["val1","val2"]
        # json.dumps converts Python lists to JSON arrays, which PostgREST
        # accepts for TEXT[] columns when Content-Type is application/json.
        domain_list = list(by_domain.keys()) if by_domain else []
        segment_list = list(by_segment.keys()) if by_segment else []

        dataset_row = {
            "id": dataset_id,
            "name": dataset_id,
            # version is NOT NULL in the CLI schema (until migration 011
            # relaxes it), so we must provide a fallback.
            "version": dataset.get("version") or "unknown",
            "source_language": dataset.get("source_lang", "en"),
            "target_language": dataset.get("target_lang", ""),
            "language_pair": dataset.get("language_pair", ""),
            "entry_count": dataset.get("entry_count"),
            "sha256": dataset.get("sha256", ""),
            # Arena-specific columns (added by migration 011).
            # PostgREST silently ignores unknown columns, so this is
            # safe to send even before 011 is applied.
            "difficulty_min": min(difficulty_levels) if difficulty_levels else None,
            "difficulty_max": max(difficulty_levels) if difficulty_levels else None,
            "domains": domain_list,
            "segments": segment_list,
        }
        try:
            ds_data = json.dumps(dataset_row).encode()
            ds_req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/datasets",
                data=ds_data,
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates",
                },
                method="POST",
            )
            with urllib.request.urlopen(ds_req, timeout=10) as ds_resp:
                ds_resp.read()
            print(f"  ✅ Dataset '{dataset_id}' registered")
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            # Non-fatal — the datasets table is secondary metadata.
            # The run_card (primary) is already published.
            err_detail = ""
            if hasattr(e, "read"):
                err_detail = f": {e.read().decode()[:200]}"
            print(f"  ⚠ Dataset upsert skipped ({e}{err_detail})")

    # --- Publish per-entry data (gated) ---
    # Per-entry drill-down requires uploading the corpus source + reference
    # text into the world-readable run_card_entries table — a redistribution
    # of corpus CONTENT. The aggregate run card above is already published;
    # here we only decide whether to ALSO expose the raw text. Restricted
    # corpora (NC / no-deriv / sealed held-out / quarantined) and
    # unregistered/own corpora default to scores-only, so a private corpus's
    # results publish without its data ever leaving the owner's machine.
    entries = report_data.get("entries", [])
    _ds_id = (run_card.get("dataset") or {}).get("id")
    _reg = _lookup_registry_entry(_ds_id) if _ds_id else None
    _allow_entries, _gate_reason = _entry_content_publishable(
        _reg, scores_only=scores_only, override=publish_entries_override,
    )

    if entries and _allow_entries:
        print(f"  Publishing {len(entries)} per-entry results...")
        _publish_entries(
            card_id=card_id,
            entries=entries,
            access_token=access_token,
        )
    elif entries and not _allow_entries:
        print(f"  🔒 Per-entry corpus content WITHHELD — {_gate_reason}.")
        print(f"     Published: scores + corpus sha256 + size (run card).")
        print(f"     NOT uploaded: the {len(entries)} source/reference rows.")
        print(f"     This run is owner-attested (self-reported, unverifiable):")
        print(f"     it will not reach the server-verified or prize tiers.")
    else:
        print("  ℹ No per-entry data found in report (entries list empty)")

    print(f"     https://champollion.dev/leaderboard")
    print()
    print("  🙏 Thank you for your contribution to the Champollion Project!")
    print("     Your results are live on the leaderboard immediately.")
    print("     They will appear in the network mesh visualization at")
    print("     its next regeneration.")
    print("=" * 60)

    return result


def _build_entry_rows(card_id: str, entries: list[dict]) -> list[dict]:
    """Transform TestReport entries into run_card_entries rows.

    The ONE entry-row shape, shared by both publish paths: the authed REST
    inserts (``_publish_entries``) and the anonymous edge-function payload
    (``_post_anonymous``). The submit-run edge function allowlists exactly
    these keys (functions/submit-run/lib.ts ALLOWED_ENTRY_COLUMNS) — change
    them together.
    """
    rows = []
    for entry in entries:
        row = {
            "run_card_id": card_id,
            "entry_id": str(entry.get("id", "")),
            "source": entry.get("source", ""),
            "expected": entry.get("expected", ""),
            "raw_predicted": entry.get("raw_predicted"),
            "predicted": entry.get("predicted", ""),
            "segment": entry.get("segment", ""),
            "difficulty": entry.get("difficulty"),
            "domain": entry.get("domain", ""),
            "exact_match": bool(entry.get("exact_match", False)),
            "chrf_score": entry.get("chrf_score"),
            "bleu_score": entry.get("bleu_score"),
            "latency_s": entry.get("latency_s"),
            "cost_usd": entry.get("cost_usd"),
            "tool_call_count": entry.get("tool_call_count", 0),
            "error": entry.get("error"),
            "plugin_metrics": entry.get("plugin_metrics", {}),
            # Per-entry LYSS verdicts — denormalized from plugin_metrics
            # for SQL-level filtering without JSONB path queries.
            # These columns mirror migration 006 additions to run_card_entries.
            **_extract_lyss_verdicts(entry.get("plugin_metrics", {})),
        }
        rows.append(row)
    return rows


# 3 attempts with the same 1s/2s/4s base backoff as the authed upsert, plus
# full jitter (see _backoff_delay) so simultaneous contributors retrying in
# lockstep don't re-collide on every step.
ANON_POST_MAX_ATTEMPTS = 3

# A 429 whose server-stated retry window exceeds this is a HARD cap — the
# submit-run intake's per-IP hourly window answers retry_after_seconds=3600
# and the global daily window 86400 (functions/submit-run/index.ts). Sleeping
# that out inline would stall a queue batch for hours, so _post_anonymous
# raises AnonymousRateLimitError instead and the caller defers. A 429 with a
# short or unstated window (a proxy/CDN blip) retries inline like a 5xx.
ANON_RETRY_MAX_WAIT_S = 30.0

# One anonymous intake POST at a time, process-wide. The queue runner's
# worker pool completes items in bursts; serializing the POSTs here means a
# burst of finishes can never fan out into simultaneous requests against the
# per-IP window (2026-07-19 $100 wave: 349 runs completed, 76 published).
_ANON_PUBLISH_LOCK = threading.Lock()


class AnonymousRateLimitError(RuntimeError):
    """The submit-run intake answered 429 with a retry window too long to
    wait out inline (its per-IP hourly / global daily anonymous cap).

    Carries ``retry_after_seconds`` (server-stated; None if unstated) so each
    caller can handle it honestly: the queue lane defers remaining publishes
    and prints ONE end-of-batch re-publish block, the CLI prints the recovery
    command and exits non-zero. The report on disk is never lost either way.
    """

    def __init__(self, message: str, retry_after_seconds: float | None = None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


def _backoff_delay(attempt: int, schedule: tuple = UPSERT_BACKOFF_S) -> float:
    """Exponential base from ``schedule`` plus full jitter: [base, 2*base).

    Jitter matters on this endpoint: queue workers finish in bursts, and N
    clients retrying on the same fixed 1s/2s/4s ladder re-collide on every
    step; spreading each step over [base, 2*base) breaks the lockstep.
    """
    base = schedule[min(attempt - 1, len(schedule) - 1)]
    return base + random.uniform(0.0, base)


def _parse_rate_limit(
    exc: urllib.error.HTTPError, body: str
) -> tuple[str, float | None]:
    """(message, retry_after_seconds) from a submit-run 429 response.

    The edge function sends JSON ``{ok:false, error:<msg>,
    retry_after_seconds: 3600|86400}`` and NO Retry-After header
    (functions/submit-run/index.ts); a fronting proxy/CDN may instead send a
    non-JSON body with a Retry-After header. Body first, header fallback,
    else (body, None) — an unstated window is treated as transient.
    """
    msg = body
    retry_after: float | None = None
    try:
        parsed = json.loads(body)
        if isinstance(parsed, dict):
            msg = parsed.get("error") or body
            ra = parsed.get("retry_after_seconds")
            if isinstance(ra, (int, float)) and not isinstance(ra, bool) \
                    and ra >= 0:
                retry_after = float(ra)
    except ValueError:
        pass
    if retry_after is None and exc.headers is not None:
        header = (exc.headers.get("Retry-After") or "").strip()
        if header.isdigit():
            retry_after = float(header)
    return msg, retry_after


def _post_anonymous(
    row: dict,
    entry_rows: list[dict],
    report_path: str | Path,
) -> dict:
    """POST one anonymous submission to the submit-run edge function.

    Returns the function's JSON result. Fails HONESTLY: every failure path
    names the on-disk report and the exact re-publish command, so anonymous
    work is never silently lost — including the interim window before the
    founder deploys the function (a 404 from the functions host).

    Transient failures — 5xx, network errors, and 429s with a short or
    unstated retry window — retry with exponential backoff + jitter
    (``_backoff_delay``). A 429 carrying the intake's real window
    (``retry_after_seconds`` 3600/86400: the per-IP hourly / global daily
    cap) raises :class:`AnonymousRateLimitError` immediately instead of
    hammering a closed window.

    POSTs are serialized process-wide (``_ANON_PUBLISH_LOCK``): concurrent
    queue workers can never burst the intake with simultaneous requests.
    """
    with _ANON_PUBLISH_LOCK:
        return _post_anonymous_serialized(row, entry_rows, report_path)


def _post_anonymous_serialized(
    row: dict,
    entry_rows: list[dict],
    report_path: str | Path,
) -> dict:
    url = _anon_submit_url()
    payload: dict = {"run_card_row": row}
    if entry_rows:
        payload["entries"] = entry_rows
    data = json.dumps(payload).encode()
    recover = (
        f"    Your report is saved at: {report_path}\n"
        f"    Publish later with: mt-eval publish {report_path} --anonymous --prod\n"
        f"    (or sign in for attributed publishing: "
        f"mt-eval publish {report_path} --prod)"
    )

    last_error = "unknown error"
    last_rate_limit: tuple[str, float | None] | None = None
    for attempt in range(1, ANON_POST_MAX_ATTEMPTS + 1):
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            if exc.code == 404:
                # The function is not deployed on this host (Supabase answers
                # 404 for an unknown function). Interim state — be honest.
                print(
                    "\n  ✗ Anonymous publishing is not yet enabled on this "
                    "host\n    (the submit-run intake function is not "
                    "deployed)."
                )
                print(recover)
                raise SystemExit(1)
            if exc.code == 429:
                msg, retry_after = _parse_rate_limit(exc, body)
                if (retry_after is not None
                        and retry_after > ANON_RETRY_MAX_WAIT_S):
                    # The intake's hourly/daily window. Waiting it out inline
                    # would stall the caller for hours — defer, don't hammer.
                    raise AnonymousRateLimitError(msg, retry_after)
                last_rate_limit = (msg, retry_after)
                last_error = f"HTTP 429: {msg[:160]}"
            elif exc.code < 500:
                print(
                    f"\n  ✗ Anonymous publish rejected ({exc.code}): "
                    f"{body[:300]}"
                )
                print(recover)
                raise SystemExit(1)
            else:
                last_rate_limit = None
                last_error = f"HTTP {exc.code}: {body[:200]}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_rate_limit = None
            last_error = f"network error: {exc}"

        if attempt < ANON_POST_MAX_ATTEMPTS:
            delay = _backoff_delay(attempt)
            if last_rate_limit is not None and last_rate_limit[1]:
                # Honor a short server-stated window when it exceeds our step.
                delay = max(delay, last_rate_limit[1])
            print(
                f"  ⚠ Attempt {attempt}/{ANON_POST_MAX_ATTEMPTS} failed "
                f"({last_error}). Retrying in {delay:.1f}s..."
            )
            time.sleep(delay)

    if last_rate_limit is not None:
        # Every retry landed on 429 — the window is closed; let callers defer.
        raise AnonymousRateLimitError(last_rate_limit[0], last_rate_limit[1])

    print(
        f"\n  ✗ Anonymous publish failed after {ANON_POST_MAX_ATTEMPTS} "
        f"attempts ({last_error})."
    )
    print(recover)
    raise SystemExit(1)


def find_republishable_reports(root: str | Path) -> list[Path]:
    """Every ``*_report.json`` under ``root`` (recursive), oldest first.

    The queue runner writes each item's report to its own subdirectory under
    ``eval/logs/harness/queue/``; this collects a whole batch (or several)
    for ``mt-eval publish --republish-dir``. Oldest-first so a re-publish
    drains in run order. A file path is accepted too (a one-report "dir").
    """
    root = Path(root)
    if root.is_file():
        return [root] if root.name.endswith("_report.json") else []
    if not root.is_dir():
        return []
    return sorted(
        (p for p in root.rglob("*_report.json") if p.is_file()),
        key=lambda p: (p.stat().st_mtime, str(p)),
    )


def republish_directory(
    root: str | Path,
    *,
    anonymous: bool = False,
    yes_prod: bool = False,
    scores_only: bool = False,
    publish_entries_override: bool = False,
    dry_run: bool = False,
    redact_coaching: bool = False,
) -> dict:
    """Publish every report under ``root`` — the ONE-command recovery for a
    queue batch whose auto-publishes hit the anonymous rate limit
    (2026-07-19 $100 wave: 349 runs completed, 76 published, 273 scattered
    per-item re-publish hints).

    Already-published reports are skipped by the read-only duplicate
    pre-flight — no rate-limit slot is spent on them — so pointing this at
    the whole queue output tree is safe across batches. Publishing stops
    honestly at the anonymous cap: the remaining reports are counted, and
    the SAME command re-run later picks up exactly where this left off.

    Returns ``{"total", "published", "already", "failed", "deferred"}``
    where failed is ``[(path, reason)]`` and deferred is ``[path, ...]``.
    """
    reports = find_republishable_reports(root)
    summary: dict = {"total": len(reports), "published": 0, "already": 0,
                     "failed": [], "deferred": []}
    if not reports:
        print(f"  No *_report.json found under {root} — nothing to publish.")
        return summary

    # The C1 prod-write guard, checked ONCE up front — letting each report
    # hit publish_to_supabase's own guard would record hundreds of identical,
    # misleading "failures" instead of one clear refusal.
    if not dry_run and _is_prod_target() and not _prod_write_opted_in(yes_prod):
        print(
            "\n  ✗ Refusing to write to PRODUCTION without an explicit "
            "opt-in.\n    Re-run with --prod (or MT_EVAL_ALLOW_PROD=1), or "
            "preview one report\n    first: mt-eval publish <report> "
            "--dry-run\n"
        )
        raise SystemExit(2)

    print(f"  Re-publishing {len(reports)} report(s) from {root}"
          f"{' (anonymous)' if anonymous else ''} — already-published runs "
          f"are skipped.")
    for i, rp in enumerate(reports):
        print(f"\n  [{i + 1}/{len(reports)}] {rp}")
        try:
            result = publish_to_supabase(
                rp,
                auto_confirm=True,
                scores_only=scores_only,
                publish_entries_override=publish_entries_override,
                dry_run=dry_run,
                yes_prod=yes_prod,
                anonymous=anonymous,
                redact_coaching=redact_coaching,
            )
            # Both duplicate paths — the read-only pre-flight and the
            # anonymous intake's idempotent response — carry this marker.
            if isinstance(result, dict) and result.get("already_published"):
                summary["already"] += 1
            else:
                summary["published"] += 1
        except KeyboardInterrupt:
            raise
        except AnonymousRateLimitError as exc:
            summary["deferred"] = [str(p) for p in reports[i:]]
            print(f"\n  ⏸ The anonymous intake's rate limit is reached: {exc}")
            print(f"    Stopping here — {len(summary['deferred'])} report(s) "
                  f"remain on disk, nothing is lost.")
            break
        except SystemExit as exc:
            summary["failed"].append((str(rp), f"exit {exc.code}"))
        except Exception as exc:
            summary["failed"].append((str(rp), str(exc)[:160]))

    print(f"\n{'=' * 60}")
    print(f"  Re-publish complete: {summary['published']} published, "
          f"{summary['already']} already on the board, "
          f"{len(summary['failed'])} failed, "
          f"{len(summary['deferred'])} still waiting on the rate limit.")
    if summary["deferred"]:
        print("    The anonymous window admits a few cards per hour per "
              "connection —")
        print("    re-run this same command later to publish the rest"
              + (", or sign in\n    (drop --anonymous) for unlimited, "
                 "attributed publishing." if anonymous else "."))
    for path, reason in summary["failed"][:10]:
        print(f"    ✗ {path}: {reason}")
    if len(summary["failed"]) > 10:
        print(f"    … and {len(summary['failed']) - 10} more failures")
    return summary


def _publish_entries(
    card_id: str,
    entries: list[dict],
    access_token: str,
) -> None:
    """Batch-insert per-entry results into run_card_entries.

    Uses Supabase's upsert (ON CONFLICT) so re-publishes are idempotent.
    Entries are sent in batches of 50 to avoid request size limits.

    Args:
        card_id: The run_card ID (foreign key).
        entries: List of entry dicts from the TestReport.
        access_token: Supabase JWT for authenticated writes.
    """
    BATCH_SIZE = 50

    rows = _build_entry_rows(card_id, entries)

    # Batch insert — send rows in chunks to avoid payload limits
    total_inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        data = json.dumps(batch).encode()

        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/run_card_entries",
            data=data,
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                # Insert-only entries: migration 024 made run_card_entries
                # INSERT-only (dropped the open authenticated UPDATE policy so
                # one user can't rewrite another's per-entry rows). Re-publish
                # stays idempotent via ignore-duplicates (ON CONFLICT DO
                # NOTHING) — no UPDATE rights required. New cards never
                # conflict (the duplicate pre-flight returns early), so this
                # only skips the rare partial-re-publish case.
                "Prefer": "resolution=ignore-duplicates",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp.read()  # Consume response
            total_inserted += len(batch)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            # Warn but don't fail — the run_card is already published.
            # Per-entry data is secondary; we can retry later.
            print(
                f"  ⚠ Entry batch {i // BATCH_SIZE + 1} failed "
                f"({exc.code}): {body[:200]}"
            )
        except (urllib.error.URLError, OSError) as exc:
            # Network-level failure (DNS, connection refused, timeout).
            # Don't crash — the run_card is already published and the
            # entries can be re-published via `mt-eval publish --force`.
            print(
                f"  ⚠ Entry batch {i // BATCH_SIZE + 1} failed "
                f"(network error): {exc}"
            )

    if total_inserted > 0:
        print(f"  ✅ {total_inserted}/{len(rows)} entries published")
    elif rows:
        print(
            f"  ⚠ All {len(rows)} entries failed to publish. "
            f"Re-run with `mt-eval publish --force` to retry."
        )

