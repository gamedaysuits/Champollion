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
import sys
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
)
from mt_eval_harness.config import coaching_label, recorded_api_provider
from mt_eval_harness.run_card import run_cost_label as _run_cost_label
from mt_eval_harness.run_card import run_total_cost as _run_total_cost


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

    # A private-use code (qaa–qtz) IS the code: no card exists for it by
    # design, so the lookups below can only fail on it (Round 13 hospital:
    # the publish preview showed 'eng>?' for an eng>qaa run).
    from mt_eval_harness.language_cards import is_private_use
    if is_private_use(cleaned):
        return cleaned.lower()

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

    # 'Ambala_Ayta' (a shell-safe spelling of a name) → 'Ambala Ayta'
    if "_" in cleaned:
        code = _lc_resolve_name(cleaned.replace("_", " "))
        if code:
            return code

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
    if not isinstance(pair, dict):
        pair = {}
    src_code = (pair.get("source") or "").strip().lower()
    tgt_code = (pair.get("target") or "").strip().lower()
    if src_code and tgt_code:
        return f"{src_code}>{tgt_code}"

    def side(code_from_corpus: str, code_keys: tuple, name_key: str) -> str:
        if code_from_corpus:
            return code_from_corpus
        # The run's OWN codes next (--target-lang-code / the resolved
        # source_code / target_code) — a private-use target (qaa–qtz) has no
        # card for its name to resolve through, and its code was recorded
        # all along (Round 13 hospital: 'eng>?' for an eng>qaa run).
        for key in code_keys:
            code = str(config.get(key) or "").strip()
            if code:
                resolved = _resolve_lang_to_code(code)
                if resolved != "?":
                    return resolved
        name = str(config.get(name_key) or "").strip()
        return _resolve_lang_to_code(name) if name else "?"

    src_code = side(src_code, ("source_code", "source_lang_code"), "source_lang")
    tgt_code = side(tgt_code, ("target_code", "target_lang_code"), "target_lang")
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


#: run_cards.model_slug is capped at 300 characters by the content guard
#: (migrations 051/063).
MODEL_SLUG_MAX = 300


def _outside_producer_id(config: dict, provenance: dict) -> str:
    """The system identity of a RunLog an OUTSIDE producer built, or ''.

    ``config.mt_method`` names a harness MT engine (google-translate,
    local-model, …) for a run the harness executed, and the engine IS the
    system. A RunLog another tool wrote may put its own label there instead:
    nmt-forge's `export` / `evaluate` write ``mt_method: "nmt-forge"`` for
    EVERY model it trains, so two different forge models published under one
    slug and merged on the board (synthetic researcher, Round 5). When the
    label names no registered harness engine, the method card the producer
    embedded (``provenance.method_card``, which forge validates with the
    harness's own check) names the system: its ``method_id``. '' otherwise —
    the caller's ladder applies unchanged.
    """
    mt = str(config.get("mt_method") or "").strip()
    if not mt:
        return ""
    from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
    if mt.lower() in MT_METHOD_REGISTRY:
        return ""
    card = provenance.get("method_card") or {}
    mid = str(card.get("method_id") or "").strip() if isinstance(card, dict) else ""
    if len(mid) > MODEL_SLUG_MAX:
        raise ValueError(
            f"the run's method card names method_id {mid[:60]!r}… "
            f"({len(mid)} characters), but a published model_slug is at most "
            f"{MODEL_SLUG_MAX} (migrations 051/063). Shorten the method id "
            f"(for nmt-forge, the run name) and rebuild the run log.")
    return mid


def _engine_model_label(config: dict, provenance: dict) -> str:
    """The model an engine that runs a given model loaded, as
    ``method_config.model`` names it ('' for every other run)."""
    from mt_eval_harness import engine_model as _em
    return _em.method_config_model(_em.from_run(config, provenance))


def _plugin_underlying_model(provenance: dict) -> str:
    """The model a method plugin called, as one label ('' when it exposed
    none). Several distinct models are listed comma-separated, sorted."""
    models = (provenance.get("method_plugin") or {}).get("models_called") or []
    return ", ".join(models)


def _plugin_model_given(config: dict, provenance: dict) -> str:
    """The model a method plugin was HANDED (-m/--model), '' when none.

    Recorded by the runner on provenance.method_plugin.model_given (and on
    config.method_model). A run log written before 2026-10-03 has neither:
    the runner overwrote -m with the method id before the plugin ran, so
    there is nothing honest to recover — '' (never a guess). An ENGINE run
    (local-model) also keeps -m in config.method_model, but what it records
    is the model that loaded (engine_model) — never this raw -m, which can be
    a local path."""
    if (config.get("mt_method") or "").strip():
        return ""
    mp = provenance.get("method_plugin") or {}
    return str(mp.get("model_given") or config.get("method_model") or "").strip()


def dependencies_sha256(deps) -> str | None:
    """sha256 of a plugin's declared ``dependencies`` (canonical JSON: sorted
    keys, no whitespace, UTF-8), or None when method.json declares none. An
    empty list hashes like any other declaration — "no external
    dependencies" is an affirmative statement (methods spec)."""
    if deps is None:
        return None
    canonical = json.dumps(deps, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


#: Longest dependency field carried onto a published card. Strings inside an
#: array of objects are capped at 500 characters by the database's aggregate
#: shape guard (migration 051); a longer value is named, not cut.
_DEPENDENCY_FIELD_CAP = 480


def _card_dependencies(deps):
    """A plugin's declared dependencies as the run card carries them.

    Each entry as method.json declares it, minus the free-text ``notes``
    (context, not identity — method.json keeps it, and the code hash covers
    it). A field longer than the shape guard allows is replaced by a pointer
    saying so, never silently truncated. Anything that is not the spec's list
    of objects is carried as written."""
    if not isinstance(deps, list):
        return deps
    out = []
    for dep in deps:
        if not isinstance(dep, dict):
            out.append(dep)
            continue
        item = {}
        for key, value in dep.items():
            if key == "notes":
                continue
            if isinstance(value, str) and len(value) > _DEPENDENCY_FIELD_CAP:
                value = (f"<{len(value)} characters — too long for the "
                         f"published card; see the plugin's method.json>")
            item[key] = value
        out.append(item)
    return out


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
    # The path ladder runs even when an id was given: an id that matches no
    # registry entry (a steward sidecar's / registered card's own id, or
    # --dataset-id) must never hide the entry the FILE itself resolves to —
    # a quarantined or consent-required corpus stays gated whatever it is
    # called (corpus_loader adopts registered card ids, 2026-10-03).
    for given in ((dataset_id, "") if dataset_id else ("",)):
        resolved = _resolve_dataset_id(
            {"dataset_id": given, "corpus_path": corpus_path,
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
    local_only: bool = False,
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
    # A steward's local-only mark (<file>.champollion.json) outranks every
    # flag: the sentences never leave this machine, and --publish-entries
    # cannot lift it. It used to guard model calls only — a publish dry-run
    # offered to upload a hospital's nurse-checked test set (2026-10-03).
    if local_only:
        return False, ("the data steward marked this corpus local-only — its "
                       "sentences never leave this machine (scores only; "
                       "--publish-entries cannot override this)")
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


def _is_local_only(run_card: dict) -> bool:
    """True when the run's corpus carries a steward's local-only mark."""
    return (run_card.get("dataset") or {}).get("transmission") == "local-only"


def local_only_publication(run_card: dict, report: dict | None = None,
                           *, prompt_redacted: str | None = None) -> dict:
    """Exactly which facts about a LOCAL-ONLY corpus a publish makes public,
    and which stay on this machine — read from the card publish would send
    (and the ``datasets`` row it would register), never described from
    memory. The preview showed the dataset id and licence of a local-only
    set but said neither that they would become public nor how others would
    read a score on a set they cannot see (synthetic Cree school, Round 12).

    Returns ``{"published": [...], "dataset_row": [...] | None,
    "withheld": [...], "reading": str}`` — short phrases; ``dataset_row``
    names what the public ``datasets`` row publish registers for an
    unregistered id carries (None for a registered dataset, whose row
    already exists)."""
    ds = run_card.get("dataset") or {}
    report = report or {}
    published = [f"its id {ds.get('id')!r}"]
    if ds.get("version"):
        published.append(f"version {ds['version']}")
    if ds.get("language_pair"):
        published.append(f"language pair {ds['language_pair']}")
    if ds.get("entry_count") is not None:
        published.append(f"size ({ds['entry_count']} entries)")
    if ds.get("sha256"):
        published.append(f"the corpus file's sha256 ({str(ds['sha256'])[:12]}…)")
    if run_card.get("corpus_license"):
        published.append(f"its licence {run_card['corpus_license']}")
    if run_card.get("corpus_attribution"):
        published.append("its attribution")
    if ds.get("contamination"):
        published.append(f"its contamination grade {ds['contamination']}")
    published.append("that it is marked local-only")
    segments = [k for k in (run_card.get("by_segment") or {}) if k]
    if segments:
        published.append("its segment names ("
                         + ", ".join(segments[:5])
                         + (", …" if len(segments) > 5 else "")
                         + ") with per-segment score aggregates")
    dataset_row = None
    if _should_upsert_dataset(ds.get("id") or ""):
        dataset_row = ["the same id (as its name)", "language pair",
                       "size", "sha256"]
        domains = [k for k in (report.get("by_domain") or {}) if k]
        if domains:
            dataset_row.append("domain names (" + ", ".join(domains[:5])
                               + (", …" if len(domains) > 5 else "") + ")")
        if segments:
            dataset_row.append("segment names")
        if report.get("by_difficulty"):
            dataset_row.append("difficulty range")
    withheld = ["every sentence — sources, references and outputs (the card "
                "is scores-only)",
                "the corpus file itself and its path on this machine"]
    if prompt_redacted:
        withheld.append("the coaching prompt's text (only its sha256 is "
                        "published)")
    reading = ("others see the score and the facts above for a test set "
               "they cannot open: it is self-benchmarked (trust "
               "'unverified'), nobody else can re-run it or check its "
               "references, and the sha256 lets only someone who holds the "
               "same file confirm it is that file")
    return {"published": published, "dataset_row": dataset_row,
            "withheld": withheld, "reading": reading}


def local_only_publication_lines(info: dict, width: int = 78) -> list[str]:
    """The preview's lines for :func:`local_only_publication`."""
    import textwrap

    def para(head: str, text: str) -> list[str]:
        return textwrap.wrap(f"{head} {text}", width=width,
                             initial_indent="    ",
                             subsequent_indent="      ")

    lines = ["  Local-only corpus — what this publish makes public, and what "
             "stays here:"]
    lines += para("Published with the score (metadata, no text):",
                  "; ".join(info["published"]) + ".")
    if info.get("dataset_row"):
        lines += para("Also registered:", "a public `datasets` row for this "
                      "unregistered id, carrying " + ", ".join(
                          info["dataset_row"]) + ".")
    lines += para("Stays on this machine:", "; ".join(info["withheld"]) + ".")
    lines += para("How others read it:", info["reading"] + ".")
    return lines


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
# by a marker (the sha256 provenance field is untouched) — whenever it is
# passed, not only when pairs are found: it used to do nothing on a prompt
# with no hits, so "pass --redact-coaching" was not a way to keep a prompt
# private. A LOCAL-ONLY corpus redacts a coached/custom prompt by default:
# its steward marked the work private, and a school's coaching prompt was
# its own sentence pairs (synthetic Cree-school persona, 2026-10-03).

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


def _prompt_is_the_runs_own(run_card: dict) -> bool:
    """True when the prompt is coaching / a custom prompt, not the harness's
    own naive template (which carries nothing but the language names)."""
    return bool(run_card.get("coaching_data_sha256")) or (
        (run_card.get("condition") or "naive") != "naive")


def _redact_prompt(run_card: dict, why: str) -> None:
    sha = run_card.get("system_prompt_sha256") or ""
    run_card["system_prompt_used"] = (
        f"[REDACTED {why}; full prompt stays in the local RunLog; sha256={sha}]")


def _coaching_prompt_content_gate(
    run_card: dict,
    entries: list[dict],
    registry_entry: dict | None,
    *,
    redact: bool,
    owner_override: bool = False,
    local_only: bool = False,
) -> str | None:
    """Refuse (or redact) a publish whose prompt embeds restricted pairs.

    Mutates ``run_card`` in place when redacting and returns why (None when
    the prompt publishes as is). ``redact`` (--redact-coaching) always
    redacts; ``local_only`` redacts a coached/custom prompt by default.
    Otherwise raises SystemExit on a violation. No-op for redistribution-
    cleared corpora, and for an UNREGISTERED corpus published with the
    --publish-entries owner affirmation (the author who may post the pairs
    themselves may also quote them in their own coaching prompt). A
    registered restricted corpus is always scanned — no override.
    """
    prompt_text = run_card.get("system_prompt_used") or ""
    if prompt_text and redact:
        hits = _coaching_prompt_pair_hits(prompt_text, entries)
        why = "--redact-coaching" + (
            f": prompt embedded {len(hits)} source/reference pair(s) of this "
            f"corpus (entry ids {', '.join(str(h['id']) for h in hits[:10])})"
            if hits else "")
        _redact_prompt(run_card, why)
        print(f"\n  🔒 Coaching prompt REDACTED on the published card "
              f"(--redact-coaching; {len(prompt_text):,} characters stay in "
              "the local RunLog). The sha256 provenance field is unchanged.")
        return why
    if prompt_text and local_only and _prompt_is_the_runs_own(run_card):
        why = ("local-only corpus: its steward marked the work private, so the "
               "coaching prompt does not leave this machine")
        _redact_prompt(run_card, why)
        print(f"\n  🔒 Coaching prompt REDACTED on the published card by "
              f"default — the corpus is local-only, so its {len(prompt_text):,}-"
              "character prompt stays on this machine. The sha256 is kept.")
        return why

    entry = registry_entry or {}
    seg = (entry.get("segment") or "").strip().lower()
    sealed = bool(entry.get("quarantine")) or seg in ("held_out", "gold_standard")
    cleared = (registry_entry is not None
               and not sealed
               and _license_is_redistributable(entry.get("license")))
    if cleared:
        return None
    if registry_entry is None and owner_override:
        return None

    hits = _coaching_prompt_pair_hits(prompt_text, entries)
    if not hits:
        return None

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
        return None

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
# Scoring standard — imports from scoring.py (code mirror of the scoring spec)
# ---------------------------------------------------------------------------
# A new run card is scored under the standard (scoring.SCORING_STANDARD,
# "standard/1"): corpus chrF++ with its 95% bootstrap CI and sacreBLEU
# signature is the headline; BLEU / spBLEU / TER / COMET ride beside it;
# everything else is a diagnostic. The weighted composite and the quality
# tiers are RETIRED — a new card publishes composite = None and
# quality_tier = None. publish.py never defines scoring of its own.

from mt_eval_harness.scoring import (
    SCORING_STANDARD,
    standard_score_fields,
)
# Coverage floor for the FST-derived morphological_accuracy: below this fraction
# of analyzable predicted words being lemma-matched to the reference, the
# diagnostic is reported as advisory (the legacy composite excluded it; the
# card still says why). Defined in the metric's plugin home.
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
    comet_reason: str | None = None,
) -> dict:
    """Explain each NULL/degraded metric on the run card.

    A null score is ambiguous — it can mean the language does not use this metric,
    an optional dependency was missing, coverage fell below the coverage floor, the
    metric is opt-in and was not requested, or it is not implemented yet. Returns
    {canonical_metric_id: reason} for exactly the metrics that are NOT a plain
    computed value; a metric absent from this block was computed normally. Each
    reason is "<prefix>: <detail>" with prefix in {not_applicable, unavailable,
    below_coverage_floor, not_run, not_implemented, not_computed} so it stays
    machine-parseable. Mirrors the morph_in_composite precedent: a small derived
    disclosure block — no new metric, no scoring effect.

    ``comet_reason``: why COMET produced no score, as the test step recorded
    it (``overall.comet_unavailable`` — tester / metrics_comet.
    comet_unavailable_reason, with the install command); a report written
    before it existed gets the generic reason.
    """
    avail: dict[str, str] = {}

    def _null(key: str) -> bool:
        return scores.get(key) is None

    # An FST that ran but errored (pyhfst missing / transducer absent) fails honest
    # with an `error` on its aggregate — distinguish that from a language that has
    # no FST at all.
    fst_error = None
    morph_reason = None
    for _k in ("giellalt_fst_validity", "fst_analyzer"):
        _d = plugin_metrics.get(_k)
        if isinstance(_d, dict) and _d.get("error"):
            fst_error = _d.get("error")
            break
        # An acceptor-only FST (a speller) measures acceptance but cannot
        # measure morphology; the plugin says why (giellalt_fst.aggregate).
        if isinstance(_d, dict) and _d.get("morph_unavailable_reason"):
            morph_reason = _d["morph_unavailable_reason"]

    # Structural (FST) family.
    if not has_fst:
        avail["fst_acceptance_rate"] = (
            f"unavailable: {fst_error}" if fst_error
            else "not_applicable: no GiellaLT FST installed/declared for this language"
        )
    if morph_accuracy is None:
        if not has_fst:
            avail["morphological_accuracy"] = avail["fst_acceptance_rate"]
        elif morph_reason:
            avail["morphological_accuracy"] = f"unavailable: {morph_reason}"
        else:
            avail["morphological_accuracy"] = (
                "not_computed: no predicted word lemma-matched the reference"
            )
    elif morph_coverage is None or morph_coverage < morph_floor:
        cov = "None" if morph_coverage is None else f"{morph_coverage:.2f}"
        avail["morphological_accuracy"] = (
            f"below_coverage_floor: coverage {cov} < {morph_floor} "
            f"(advisory value reported)"
        )

    # Language-card-declared proxies. A card's metrics that were deliberately
    # not loaded (plugin_discovery._WithheldCardMetric — a local-only/sealed
    # corpus must reach no outside service) say so; "not declared on this
    # language's card" would be false for them.
    withheld = sorted(k for k, d in plugin_metrics.items()
                      if isinstance(d, dict) and d.get("unavailable"))
    withheld_reason = (
        f"unavailable: {plugin_metrics[withheld[0]]['unavailable']} "
        f"(not loaded: {', '.join(withheld)})" if withheld else None)
    if _null("equivalent_match_rate"):
        avail["equivalent_match_rate"] = withheld_reason or (
            "not_applicable: no equivalence linter declared on this language's card"
        )
    if _null("semantic_score"):
        avail["semantic_score"] = withheld_reason or (
            "not_applicable: no semantic validator declared on this language's card"
        )

    # Behavioral: terminology needs a glossary to be meaningful.
    if _null("terminology_adherence"):
        avail["terminology_adherence"] = (
            "not_applicable: no coaching glossary supplied (metric inactive)"
            if not has_glossary
            else "not_computed: no glossary terms occurred in the source"
        )

    # Neural lane (reported separately, never blended into the headline).
    if _null("comet_score"):
        avail["comet_score"] = (
            f"unavailable: {comet_reason}" if comet_reason else
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
            "unavailable: MetricX requested but the 'metricx' extra/model is "
            "missing (python3 -m pip install 'mt-eval-harness[metricx]' plus "
            "the model code from github.com/google-research/metricx)"
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


def metric_availability_for_report(report: dict, run_log: dict,
                                   derived: dict) -> dict:
    """:func:`_build_metric_availability` for a TestReport, from the same
    :func:`derive_scores` readings :func:`assemble_run_card` uses — so the
    report (and the run card rendered from it) says why a metric is null in
    the words the published card will."""
    overall = report.get("overall") or {}
    config = run_log.get("config") or report.get("config") or {}
    scores = {
        "comet_score": overall.get("comet_score"),
        "qe_score": overall.get("qe_score"),
        "metricx_score": overall.get("metricx_score"),
        "fuse_score": overall.get("fuse_score"),
        "equivalent_match_rate": derived.get("equivalent_match_rate"),
        "semantic_score": derived.get("semantic_score"),
        "terminology_adherence": derived.get("terminology_adherence"),
        "style_consistency_rate": derived.get("style_consistency_rate"),
    }
    term_data = derived.get("term_data") or {}
    return _build_metric_availability(
        scores=scores,
        plugin_metrics=derived.get("plugin_metrics") or {},
        has_fst=bool(derived.get("has_fst")),
        morph_accuracy=derived.get("morph_accuracy"),
        morph_coverage=derived.get("morph_coverage"),
        morph_floor=_MORPH_COVERAGE_FLOOR,
        has_glossary=bool(term_data.get("glossary_size")
                          or config.get("glossary")
                          or config.get("glossary_file")),
        has_references=bool(overall.get("has_references", True)),
        metricx_requested=bool(config.get("compute_metricx")),
        comet_reason=overall.get("comet_unavailable"),
    )


FINGERPRINT_V2_FROM = (0, 2, 0)


def _version_tuple(version) -> tuple[int, ...]:
    parts = []
    for piece in str(version or "").split("."):
        digits = "".join(ch for ch in piece if ch.isdigit())
        if not digits:
            break
        parts.append(int(digits))
    return tuple(parts) or (0,)


def fingerprint_version_for(harness_version) -> int:
    """2 for run logs from harness >= 0.2.0, else 1 (their original id)."""
    return 2 if _version_tuple(harness_version) >= FINGERPRINT_V2_FROM else 1


def endpoint_host_sha256(base_url) -> str | None:
    """sha256 of the endpoint's lowercased host[:port], or None for the default."""
    if not base_url:
        return None
    from urllib.parse import urlparse
    parsed = urlparse(base_url if "//" in str(base_url) else f"//{base_url}")
    host = (parsed.hostname or "").lower()
    if parsed.port:
        host = f"{host}:{parsed.port}"
    return hashlib.sha256(host.encode("utf-8")).hexdigest() if host else None


def derive_scores(report: dict, run_log: dict,
                  report_path: str | Path | None = None) -> dict:
    """The diagnostic readings `mt-eval publish` records beside the headline.

    Under the scoring standard (scoring.SCORING_STANDARD) the headline is
    corpus chrF++ straight from the TestReport; this derives everything
    reported BESIDE it as a diagnostic — the FST, equivalence, semantic and
    behavioural readings — the one way :func:`assemble_run_card` and
    :func:`metric_availability_for_report` both read them.

    ``report_path`` locates a standalone ``<run>_fst.json`` next to the report
    (a method's own FST scoring); None skips that fallback. Returns a dict of
    the derived values plus ``scoring_standard``, and ``composite`` /
    ``quality_tier`` as None: the weighted composite and the quality tiers
    are retired (a legacy card's stored composite is re-derived by the
    verifier from the card itself, never from a report).
    """
    overall = report.get("overall", {}) or {}
    report_path = Path(report_path) if report_path else None

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
    if fst_acceptance_rate is None and report_path is not None:
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
                # The FST acceptance diagnostic stays None (reported as
                # unavailable); the chrF++ headline is unaffected.
                print(
                    f"  ⚠ FST report at {fst_report_path} is malformed "
                    f"({exc}). FST acceptance will be reported as unavailable."
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

    # Terminology adherence = matched / total glossary-term occurrences over
    # the entries that contain a term (scoring spec: "proportion of
    # prescribed terminology terms that appear in the output"), read from the
    # aggregate's counts — so a report written before the 2026-10-03 fix,
    # whose avg counted every term-free entry as 1.0, still publishes the
    # value its own counts support.
    from mt_eval_harness.plugins.terminology import corpus_adherence
    term_data = plugin_metrics.get("terminology", {})
    terminology_adherence = corpus_adherence(term_data)

    # Writing style (informational only — NOT in composite)
    style_consistency_rate = None
    ws_data = plugin_metrics.get("writing_style", {})
    if ws_data and not ws_data.get("error"):
        style_consistency_rate = ws_data.get("style_consistency_rate")

    # The headline (corpus chrF++) is the TestReport's own number; it is
    # carried, never recomputed here.
    corpus_chrf = overall.get("corpus_chrf")

    return {
        "plugin_metrics": plugin_metrics,
        "fst_acceptance_rate": fst_acceptance_rate,
        "fst_accepted_count": fst_accepted_count,
        "morph_accuracy": morph_accuracy,
        "morph_coverage": morph_coverage,
        "fst_version_info": fst_version_info,
        "has_fst": has_fst,
        "equivalent_match_rate": equivalent_match_rate,
        "equivalent_match_count": equivalent_match_count,
        "lyss_provenance": lyss_provenance,
        "semantic_score": semantic_score,
        "code_switching_rate": code_switching_rate,
        "hallucination_rate": hallucination_rate,
        "term_data": term_data,
        "terminology_adherence": terminology_adherence,
        "style_consistency_rate": style_consistency_rate,
        "corpus_chrf": corpus_chrf,
        "scoring_standard": SCORING_STANDARD,
        # Retired (scoring standard/1): no new run carries a composite or a
        # quality tier. Present as None so no reader mistakes absence for a
        # value it should compute.
        "composite": None,
        "quality_tier": None,
    }


#: Deprecated name of :func:`derive_scores` (it computed the retired
#: composite). Kept so an external caller keeps importing; it now returns
#: ``composite`` / ``quality_tier`` as None like derive_scores.
derive_composite = derive_scores


def composite_uses(metric: str, inputs: dict, profile) -> bool:
    """LEGACY (retired composite): True when ``metric`` entered a LEGACY
    card's composite: it has a value in ``inputs`` (a legacy run card's
    ``scores``), the card's ``profile`` weight table weighs it, and it is
    active — exactly the test compute_composite_score applied. Used only to
    describe a card published before the scoring standard."""
    from mt_eval_harness.scoring import INACTIVE_METRICS, resolve_weights

    value = (inputs or {}).get(metric)
    if (not profile or metric in INACTIVE_METRICS or isinstance(value, bool)
            or not isinstance(value, (int, float))):
        return False
    try:
        return bool(resolve_weights(profile).get(metric))
    except ValueError:
        return False


def glossary_composite_note(includes: dict[str, bool],
                            glossaries: dict[str, str | None]) -> str | None:
    """LEGACY (retired composite). The one sentence printed when a LEGACY
    card's composite included terminology adherence: which runs' do (and which
    glossary scored it), and that composites compare like for like only
    across runs scored with the same glossary — or none. ``includes`` and
    ``glossaries`` map a run label (a compare letter, or "this run") to
    whether its composite includes terminology / its glossary label. None
    when no composite includes it. Weights unchanged: the terminology weight
    is the scoring profile's (SCORING_SPEC §4)."""
    with_term = [k for k, v in includes.items() if v]
    if not with_term:
        return None
    without = [k for k, v in includes.items() if not v]
    return ("Composite includes terminology adherence — "
            + (", ".join(f"{k} ({glossaries.get(k) or 'a glossary'})"
                         for k in with_term) if len(includes) > 1
               else f"glossary {glossaries.get(with_term[0]) or 'recorded on the run'}")
            + (f"; {', '.join(without)} "
               + ("does" if len(without) == 1 else "do") + " not"
               if without else "")
            + ". Composites are comparable only between runs scored with "
              "the same glossary, or both with none (the glossary adds "
              "terminology adherence to the composite and reweights the "
              "rest).")


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

    And records, under the scoring standard (scoring.SCORING_STANDARD):
        - the headline: corpus chrF++ with its 95% bootstrap CI and
          sacreBLEU signature (``scores.scoring_standard`` = "standard/1",
          ``scores.primary_metric`` = "chrf_plus_plus")
        - BLEU / spBLEU / TER / COMET beside it, never blended
        - diagnostics, each on its own, and the score caveats
        - ``composite`` / ``quality_tier`` / ``cost_adjusted`` = None (retired)
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

    def _tok(value) -> int:
        # A token count is a whole number. A plugin that ESTIMATES usage
        # (characters / 4, …) reports floats, and summing them published
        # counts like 1234.0000001 (synthetic researcher, Round 4).
        try:
            return int(round(float(value or 0)))
        except (TypeError, ValueError):
            return 0

    for r in results:
        usage = r.get("usage") or {}
        prompt_tokens += _tok(usage.get("prompt_tokens"))
        completion_tokens += _tok(usage.get("completion_tokens"))
        # reasoning_tokens is nested under completion_tokens_details
        # in the OpenRouter response format
        ct_details = usage.get("completion_tokens_details") or {}
        reasoning_tokens += _tok(ct_details.get("reasoning_tokens"))
        pt_details = usage.get("prompt_tokens_details") or {}
        cached_tokens += _tok(pt_details.get("cached_tokens"))

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
    # Every diagnostic reading reported beside the headline — derive_scores()
    # is their one home (metric_availability_for_report reads the same).
    # -------------------------------------------------------------------
    _derived = derive_scores(report, run_log, report_path)
    plugin_metrics = _derived["plugin_metrics"]
    fst_acceptance_rate = _derived["fst_acceptance_rate"]
    fst_accepted_count = _derived["fst_accepted_count"]
    morph_accuracy = _derived["morph_accuracy"]
    morph_coverage = _derived["morph_coverage"]
    fst_version_info = _derived["fst_version_info"]
    has_fst = _derived["has_fst"]
    equivalent_match_rate = _derived["equivalent_match_rate"]
    equivalent_match_count = _derived["equivalent_match_count"]
    lyss_provenance = _derived["lyss_provenance"]
    semantic_score = _derived["semantic_score"]
    code_switching_rate = _derived["code_switching_rate"]
    hallucination_rate = _derived["hallucination_rate"]
    term_data = _derived["term_data"]
    terminology_adherence = _derived["terminology_adherence"]
    style_consistency_rate = _derived["style_consistency_rate"]
    corpus_chrf = _derived["corpus_chrf"]

    # -------------------------------------------------------------------
    # Cost
    # -------------------------------------------------------------------
    # total_cost_usd may be None = cost UNKNOWN (un-priceable model). Keep it
    # None through to the card rather than coercing to 0 — an unknown cost and
    # a free run must stay distinguishable on the leaderboard.
    # The one reading of what the run cost (run_card.run_total_cost): the
    # RunLog's recorded total, else the report's.
    total_cost_usd = _run_total_cost(run_log, report)
    entry_count = overall.get("total_entries", 0)
    cost_per_entry = round(
        total_cost_usd / entry_count, 6
    ) if (entry_count and total_cost_usd is not None) else None

    # Cost-adjusted score (legacy §6.3) was the composite divided by a cost
    # factor: it is retired with the composite. Cost is reported beside the
    # headline (totals), never folded into it.

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
    # A method plugin (--method <dir>) translates by itself: no harness prompt
    # condition ever applied, yet its run published as "naive" — the LLM
    # prompt vocabulary (synthetic researcher, 2026-10-03). It carries its
    # method class instead, the label the publish wizard already writes when
    # it attaches a card (run_card["condition"] = card["class"] below), so
    # no new vocabulary: run_cards.condition is free text (≤200 chars, 051),
    # the only condition CHECK is queue_items' (059/071), which a run card
    # never meets. An explicit non-default label is kept. MT engines
    # (--method google-translate …) still publish "naive": the queue's
    # engine-coverage dedupe was written around that (founder item).
    if (condition == "naive" and (config.get("method_path") or "").strip()
            and not config.get("mt_method")):
        condition = (method_card or {}).get("class") or "custom-plugin"

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
        # A RunLog an outside producer wrote (nmt-forge's export/evaluate:
        # mt_method "nmt-forge" for every model) is named by its embedded
        # method card instead (_outside_producer_id).
        "model_slug": (_outside_producer_id(config, provenance)
                       or config.get("mt_method")
                       or _method_plugin_id(config, provenance)
                       or config.get("model", "")),
        "model_id": (_outside_producer_id(config, provenance)
                     or config.get("mt_method")
                     or _method_plugin_id(config, provenance)
                     or config.get("_model_id", config.get("model", ""))),
        # The provider that carried the text (config.recorded_api_provider):
        # the run config's provider for the harness's own LLM path, the
        # engine id for an MT engine, and "local" / "method-plugin" for a
        # method plugin (attested local transport or not). A run log written
        # before the runner recorded it says "openrouter" for every engine
        # and plugin run — the default it was never sent through — so the
        # value is derived here, not copied. It is a v2 fingerprint
        # component, so a plugin run's card id changes with the fix (the
        # recorded value was false).
        "api_provider": recorded_api_provider(config),
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
            # A DIAGNOSTIC (scoring.DIAGNOSTIC_METRICS), never in the headline.
            # morph_in_composite is a legacy key (whether the retired composite
            # would have counted it); a standard/1 card always says False.
            "morphological_accuracy": morph_accuracy,
            "morph_coverage": morph_coverage,
            "morph_in_composite": False,
            # THE HEADLINE (scoring standard/1): corpus chrF++, 0–100. Its 95%
            # bootstrap CI is confidence_intervals.corpus_chrf and its
            # sacreBLEU signature sacrebleu_signatures.chrf.
            "chrf_plus_plus": corpus_chrf,
            # TER: Translation Edit Rate (sacrebleu) — lower is better. A
            # secondary standard metric, shown beside chrF++, never blended.
            "ter": overall.get("corpus_ter"),
            # Secondary standard metric: spBLEU (FLORES-200 tokenizer), plus
            # plain chrF (word_order=0), for apples-to-apples against FLORES /
            # NLLB / WMT published tables. Shown beside, never blended.
            "spbleu": overall.get("corpus_spbleu"),
            "chrf_plain": overall.get("corpus_chrf_plain"),
            # SacreBLEU signatures (reproducibility) — the full per-metric
            # signature strings (tokenizer, smoothing, case, nrefs, sacreBLEU
            # version) so any published surface score (chrF++/BLEU/spBLEU/TER)
            # can be re-derived. The leaderboard shows the chrF++ signature
            # beside the headline (run_card JSONB).
            "sacrebleu_signatures": overall.get("sacrebleu_signatures"),
            # FUSE-style comparator (opt-in, reported separately) — an
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
            # DIAGNOSTICS (scoring.DIAGNOSTIC_METRICS): reported separately,
            # never in the headline.
            "code_switching_rate": code_switching_rate,
            "hallucination_rate": hallucination_rate,
            "terminology_adherence": terminology_adherence,
            # §2.5 Writing style (diagnostic)
            "style_consistency_rate": style_consistency_rate,
            # The scoring standard: scoring_standard = "standard/1",
            # primary_metric = "chrf_plus_plus", and the retired composite /
            # quality_tier / cost_adjusted as None (scoring.standard_score_fields).
            **standard_score_fields(),
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
            # How to SAY that cost — the one rule (run_card.cost_label) the
            # terminal summary, the run card and the publish preview all use,
            # so a loopback-local run reads "$0 API cost" everywhere instead
            # of "$0" in one place and "unknown" in another. The number
            # above is never changed by it.
            "cost_label": _run_cost_label(run_log, report),
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
            # For a method plugin: the model it was handed (-m — what an
            # install passes to reproduce the run), else the model it
            # reported calling (provenance.method_plugin.models_called);
            # otherwise the run's model id, which for a plugin is its
            # method_id.
            # An engine that ran a model it was given (local-model): that
            # model, by hub id + revision or directory name + content hash
            # (engine_model.method_config_model — never a local path).
            "model": (_engine_model_label(config, provenance)
                      or _plugin_model_given(config, provenance)
                      or _plugin_underlying_model(provenance)
                      or config.get("_model_id", config.get("model", ""))),
            "temperature": config.get("_effective_temperature",
                                      config.get("temperature", 0)),
            "batchSize": config.get("batch_size", 25),
            "register": provenance.get("register_used", None),
            # A name, never a local path: "inline coaching" for --coaching
            # text (whose temp file used to be published as
            # /tmp/coaching_*.txt), else the coaching file's name.
            "coachingFile": coaching_label(config),
            "coachingPrompt": None,  # Resolved at runtime — not persisted
            "promptContext": provenance.get("prompt_context_used", None),
            # Retired with the quality tiers (scoring standard/1).
            "qualityTier": None,
        },

        # Additional scores not in spec but useful
        "corpus_bleu": overall.get("corpus_bleu"),
    }

    # -------------------------------------------------------------------
    # Method plugin identity (--method <dir>): which code, handed which
    # model, declaring which dependencies. Recorded by the runner on
    # provenance.method_plugin; carried here so the card says what ran, and
    # fingerprinted below. Absent for every other kind of run, and for a
    # plugin run log written before the runner recorded it.
    # -------------------------------------------------------------------
    # -------------------------------------------------------------------
    # The model an engine ran (--method local-model -m <model>): which model
    # loaded — the hub id and revision, or the directory's name and a sha256
    # over its files — and the decode length that applied. Absent for every
    # other run. A local-model run log written before Round 10 recorded none
    # (the runner dropped -m); it publishes with ``engine_model_unrecorded``
    # so the card says so instead of implying the engine had no model.
    # -------------------------------------------------------------------
    from mt_eval_harness import engine_model as _em
    _engine = _em.from_run(config, provenance)
    if _engine:
        run_card["engine_model"] = _em.public_block(_engine)
    elif _em.engine_requires_model(config):
        run_card["engine_model_unrecorded"] = (
            "this local-model run recorded no model: harness versions before "
            "Round 10 did not pass -m to the engine, which could then run "
            "Helsinki-NLP/opus-mt-en-es instead — re-run to publish a "
            "result that names its model")

    _mp = provenance.get("method_plugin")
    if isinstance(_mp, dict) and (config.get("method_path") or "").strip():
        run_card["method_plugin"] = {
            "version": _mp.get("version"),
            "code_sha256": _mp.get("sha256"),
            "model_given": _plugin_model_given(config, provenance) or None,
            "models_called": list(_mp.get("models_called") or []),
            "models_basis": _mp.get("models_basis"),
            "dependency_class": _mp.get("dependency_class"),
            "dependencies": _card_dependencies(_mp.get("dependencies")),
            "dependencies_sha256": dependencies_sha256(_mp.get("dependencies")),
        }

    # -------------------------------------------------------------------
    # Corpus license passthrough (project licensing policy)
    #
    # Embed the corpus license + attribution from the datasets registry
    # so every published run carries its license obligations. Nullable —
    # unregistered datasets publish fine, with a warning, so ad-hoc
    # corpora (--corpus path/to/file.json) are not blocked.
    # -------------------------------------------------------------------
    # The steward's own statement about this corpus: the sidecar next to the
    # file (`champollion register-corpus --data` writes it) as the run
    # recorded it, or as it reads now if the file is reachable.
    steward = {}
    try:
        from mt_eval_harness.corpus_loader import read_steward_sidecar
        if config.get("corpus_path"):
            steward = read_steward_sidecar(config["corpus_path"])
    except (ImportError, ValueError, OSError):
        steward = {}
    if (dataset_meta.get("transmission") == "local-only"
            or steward.get("transmission") == "local-only"):
        run_card["dataset"]["transmission"] = "local-only"

    license_info = _lookup_corpus_license(run_card["dataset"]["id"])
    if license_info is None:
        steward_license = (steward.get("license") or dataset_meta.get("license") or "").strip()
        if steward_license:
            license_info = {"license": steward_license, "attribution": None}
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
            f"  ⚠ Dataset '{run_card['dataset']['id']}' has no recorded "
            f"licence — corpus_license/corpus_attribution will be null. "
            f"Record it with `champollion register-corpus --data <file> "
            f"--license <id> …` (it writes the sidecar mt-eval reads)."
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
            "python3 -m pip install --force-reinstall mt-eval-harness."
        ) from exc
    _registry_entry = _lookup_registry_entry(run_card["dataset"]["id"])
    # The grade as each place STATES it, first stated wins — a NONE
    # normalizes to no grade (the fail-safe lane), but it is not "ungraded":
    # the card says what it says (contamination.grade_phrase).
    _stated = [str(m.get("contamination")).strip().upper()
               for m in (_registry_entry or {}, corpus_meta or {},
                         dataset_meta or {})
               if isinstance(m, dict) and m.get("contamination")]
    _contam_grade = _contam.normalize_grade(
        (_registry_entry or {}).get("contamination")
    )
    if _contam_grade is None and corpus_meta:
        _contam_grade = _contam.normalize_grade(corpus_meta.get("contamination"))
    if _contam_grade is None and dataset_meta:
        # The grade on the corpus's registered card, as the run recorded it
        # (corpus_loader.merge_steward_sidecar) — same lane rule as the runner.
        _contam_grade = _contam.normalize_grade(dataset_meta.get("contamination"))
    run_card["dataset"]["contamination"] = _contam_grade
    run_card["contamination"] = _contam_grade
    if _contam_grade is None and _stated:
        # Only when the stated grade differs from the lane's reading (NONE):
        # the record says the corpus was graded, and how, without changing
        # the lane (still decided by `contamination` above).
        run_card["dataset"]["contamination_stated"] = _stated[0]
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

    # --- Neural metrics (shown BESIDE the chrF++ headline, never blended) ---
    # COMET/AfriCOMET adequacy (a secondary standard metric, with its model id)
    # + AfriCOMET-QE reference-free QE. Computed, stored, and surfaced on their
    # own (their own scores keys + DB columns).
    if overall.get("comet_score") is not None:
        run_card["scores"]["comet_score"] = overall["comet_score"]
        run_card["scores"]["comet_model"] = overall.get("comet_model", "")
        run_card["scores"]["comet_low_resource_warning"] = overall.get(
            "comet_low_resource_warning", False
        )
    else:
        run_card["scores"]["comet_score"] = None

    # Reference-free QE (neural; reported separately)
    run_card["scores"]["qe_score"] = overall.get("qe_score")
    run_card["scores"]["qe_model"] = overall.get("qe_model")
    run_card["scores"]["has_references"] = bool(overall.get("has_references", True))

    # MetricX-24 (neural; reported separately). LOWER-IS-BETTER
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
        # The plugin's own record says whether a glossary was active (any
        # source: --glossary, a coaching dictionary, the API); a pre-fix
        # report falls back to what the config names.
        has_glossary=bool(
            (term_data or {}).get("glossary_size")
            or config.get("glossary") or config.get("glossary_file")),
        has_references=bool(overall.get("has_references", True)),
        metricx_requested=bool(config.get("compute_metricx")),
        comet_reason=overall.get("comet_unavailable"),
    )

    # (morphological_accuracy / morph_coverage / morph_in_composite are set in the
    # run_card["scores"] literal above — they are in scope at construction time,
    # unlike the conditionally-computed comet/qe scores added here.)

    # Bootstrap confidence intervals, as the test step computed them. The
    # headline's is confidence_intervals.corpus_chrf (95%, paired-bootstrap
    # resampling over segments — Koehn 2004). The retired composite's CI is
    # neither computed nor carried: a legacy report's segment_composite /
    # composite_score CI is dropped so no new card shows one.
    cis = overall.get("confidence_intervals", {})
    if cis:
        cis = {k: v for k, v in cis.items()
               if k not in ("composite_score", "segment_composite")}
        run_card["scores"]["confidence_intervals"] = cis

    # -------------------------------------------------------------------
    # Execution facts + per-test-suite aggregates (contract C4)
    #
    # An EXECUTOR (the sovereign node's sandbox, or the declarative engine)
    # measured these; the publisher only carries them. They are recorded on
    # the RunLog's provenance block by external_scoring.score_hypotheses and
    # copied here VERBATIM — this function never invents or derives them.
    #
    # Both keys are set only when the provenance carries them, so every card
    # minted by a lane that measures nothing (an API run, a self-reported
    # hypotheses submission) is byte-identical to before this block existed.
    # Reported, never ranked: runtime is not a quality signal and there is no
    # efficiency track (contest_rank.py, contract C7).
    # -------------------------------------------------------------------
    if provenance.get("execution") is not None:
        run_card["execution"] = provenance["execution"]
    if provenance.get("by_test_suite") is not None:
        run_card["by_test_suite"] = provenance["by_test_suite"]

    # What qualifies these scores (score_caveats) — nmt-forge's train/test
    # near-twin reading, the length-inflation check — carried on the card so
    # the leaderboard can show it beside the number. Stored inside the
    # run_card JSONB (no column, no migration); strings fit migration 051's
    # array-object cap. Never part of the fingerprint: it describes the
    # result, not the experiment. The scores are untouched.
    from mt_eval_harness import score_caveats as _score_caveats
    _caveats = _score_caveats.collect(report, run_log)
    if _caveats:
        run_card["score_caveats"] = _score_caveats.for_run_card(_caveats)

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

    # Fingerprint v2 (harness >= 0.2.0). v1 left out the channel and the
    # method version, so two DIFFERENT setups could share one card id — and
    # since rows are immutable, the second was refused as "already
    # published". v2 adds them. A run log from an older harness keeps v1, so
    # republishing it reproduces its original id.
    fingerprint_version = fingerprint_version_for(run_card.get("harness_version"))
    if fingerprint_version >= 2:
        fingerprint_components.update({
            "api_provider": run_card.get("api_provider"),
            # The endpoint's HOST, hashed: a raw base_url can carry internal
            # hostnames or credentials and the components are public.
            "endpoint_host_sha256": endpoint_host_sha256(config.get("base_url")),
            "max_tokens": run_card.get("max_tokens"),
            # A method plugin's declared version and file hash fill these when
            # no card version / contest submission sha exists — they were
            # null for every plugin run (synthetic researcher, 2026-10-03).
            "method_version": ((method_card or {}).get("version")
                               or (provenance.get("method_plugin") or {}).get("version")),
            "method_sha256": ((provenance.get("submission") or {}).get("method_sha")
                              or (provenance.get("method_plugin") or {}).get("sha256")),
        })
        # A method plugin run also carries the model it was HANDED (-m) and
        # its declared dependencies: without them the same plugin run on two
        # different models had one fingerprint (synthetic researcher, Round
        # 5). Plugin runs only — every other run's identity is unchanged.
        if ((config.get("method_path") or "").strip()
                and not config.get("mt_method")):
            fingerprint_components.update({
                "method_model": _plugin_model_given(config, provenance) or None,
                "method_dependencies_sha256": dependencies_sha256(
                    (provenance.get("method_plugin") or {}).get("dependencies")),
            })
        # An engine run on a GIVEN model (local-model) carries that model
        # and its content hash / revision: two models through one engine are
        # two experiments, not one card id (Round 10). Only such runs — every
        # other run's identity is unchanged.
        from mt_eval_harness import engine_model as _em
        fingerprint_components.update(_em.fingerprint_components(
            _em.from_run(config, provenance)))

    fp_json = json.dumps(
        fingerprint_components, sort_keys=True, ensure_ascii=False
    )
    fingerprint_hash = hashlib.sha256(fp_json.encode()).hexdigest()

    run_card["fingerprint"] = {
        "hash": fingerprint_hash,
        "components": fingerprint_components,
        "version": fingerprint_version,
    }

    # -------------------------------------------------------------------
    # Run card hash — tamper seal (§3.9)
    # Computed AFTER fingerprint is set but BEFORE the hash field itself.
    # -------------------------------------------------------------------
    seal_run_card(run_card)

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


def seal_run_card(run_card: dict) -> str:
    """Set ``run_card_hash`` (the tamper seal, §3.9) over the card as it stands.

    Call again after ANY change to the card: publish redacts the coaching
    prompt and may attach a method card after assembly, and a seal computed
    before those changes does not verify against the card that is stored
    (``scripts/lint_run_reports.py`` recomputes it).
    """
    run_card["run_card_hash"] = ""  # placeholder so JSON structure is stable
    card_json = json.dumps(run_card, sort_keys=True, ensure_ascii=False)
    run_card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
    return run_card["run_card_hash"]


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
        # Retired (scoring standard/1): a new card's composite and quality
        # tier are NULL — the columns stay for historical rows (migration 023
        # range-checks composite_score only when non-null; quality_tier is
        # nullable). The headline is chrf_plus_plus + its CI columns below.
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
        "composite_ci_lower": (cis.get("composite_score", {}).get("ci_lower")
                               if cis and scores.get("composite") is not None else None),
        "composite_ci_upper": (cis.get("composite_score", {}).get("ci_upper")
                               if cis and scores.get("composite") is not None else None),
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
        # §2.5 Writing style (diagnostic)
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
        # The preview names the identity the real publish would use: an
        # --anonymous dry run used to say "(dry-run — not authenticated)"
        # with no word of anonymity (synthetic researcher, Round 8).
        submitter = ("anonymous" if anonymous
                     else "(dry-run — not authenticated)")
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
    # A local-model run that names no model cannot say what produced its
    # numbers (before Round 10 the engine dropped -m and could run
    # opus-mt-en-es in its place). Never published as a result; a dry run
    # shows why.
    if run_card.get("engine_model_unrecorded"):
        msg = (f"✗ REFUSED: {run_card['engine_model_unrecorded']} "
               f"(`mt-eval run --method local-model -m <model>` with this "
               f"harness records it).")
        if dry_run:
            print(f"\n  {msg} A real publish stops here.")
        else:
            print(f"\n  {msg}")
            raise SystemExit(1)

    # --- Coaching-prompt content gate ---
    # system_prompt_used is 051's method-artifact exemption; scan it against
    # this run's own source/reference pairs so a coached prompt cannot carry
    # restricted corpus content onto the public board. Runs in every mode
    # (scores-only and dry-run included — the card field publishes either
    # way, and the preview should mirror the real publish).
    _scan_report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    prompt_redacted = _coaching_prompt_content_gate(
        run_card,
        _scan_report.get("entries", []),
        _lookup_registry_entry((run_card.get("dataset") or {}).get("id")),
        redact=redact_coaching,
        owner_override=publish_entries_override,
        local_only=_is_local_only(run_card),
    )

    # --- Method card wizard ---
    # If no method card was provided and we're interactive, offer the wizard.
    # The wizard creates a method card dict that gets embedded in the run card.
    # A dry run is non-interactive (no prompts): skip the wizard offer.
    # Without a terminal (an agent, CI) there is nobody to answer: say how to
    # attach one and carry on, instead of dying on EOFError mid-publish.
    if method_card_path is None and not auto_confirm and not dry_run:
        if "method_card" not in run_card or run_card.get("method_card") is None:
            print("\n  No method card attached to this run.")
            if not sys.stdin.isatty():
                print("  (Not a terminal, so no wizard. Attach one with "
                      "--method-card <file>.)")
                offer = "n"
            else:
                offer = input("  Create one now? [Y/n] ").strip().lower()
            if not offer or offer == "y":
                from mt_eval_harness.method_card_wizard import run_wizard
                card = run_wizard(submitter=submitter)
                if card:
                    run_card["method_card"] = card
                    run_card["condition"] = card.get("class", run_card.get("condition", "unknown"))

    # The prompt gate and the wizard above may have changed the card; the
    # stored card must carry a seal that verifies against what is stored.
    seal_run_card(run_card)

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
    if dry_run and anonymous:
        print("\n  Submitter:     anonymous — no sign-in; the board shows "
              "submitter 'anonymous' (the anonymous intake is rate-limited "
              "per IP)")
    elif dry_run:
        print(f"\n  Submitter:     the account `mt-eval` is signed in to "
              f"(none checked in a dry run; --anonymous publishes without one)")
    else:
        print(f"\n  Submitter:     {submitter}"
              + (" (no sign-in)" if anonymous else ""))
    # How the board will LIST the row, before the numbers: every publish
    # from this command is self-benchmarked — trust 'unverified' (the INSERT
    # policy and the anonymous intake both force it); 'verified' arrives only
    # from a reference holder's re-scoring or a contest node. And which score
    # lane the row lands in (contamination SSOT). Neither was said
    # (synthetic researcher, Round 8).
    print(f"  Trust:         {row.get('trust', 'unverified')} — listed as "
          f"self-benchmarked (you ran and scored it; 'verified' comes only "
          f"from a reference holder's re-scoring or a contest node)")
    from mt_eval_harness import contamination as _contam_lane
    _lane = run_card.get("score_lane") or _contam_lane.lane_for_grade(
        run_card.get("contamination"))
    _grade = _contam_lane.grade_phrase(
        run_card.get("contamination"),
        (run_card.get("dataset") or {}).get("contamination_stated"))
    if _lane == _contam_lane.LANE_ABSOLUTE:
        print(f"  Score lane:    {_lane} ({_grade} — ranked as absolute "
              f"quality)")
    else:
        print(f"  Score lane:    {_lane} ({_grade} — ranks methods against "
              f"each other on THIS corpus, never as absolute quality; only a "
              f"corpus graded LOW earns the absolute lane)")
        _note = _contam_lane.grade_note(
            run_card.get("contamination"),
            (run_card.get("dataset") or {}).get("contamination_stated"))
        if _note:
            print(f"                 {_note}")
    print(f"  Model:         {run_card['model_slug']}")
    print(f"  Condition:     {run_card['condition']}")
    # The method-card fields the board shows beside the scores (methods spec
    # §"Leaderboard display": class badge, paradigm, dependency class, tools,
    # open source, the code hash) and, for an engine, the model it ran. The
    # preview showed only Model and Condition, so "exactly what goes on the
    # board" was incomplete for a plugin or engine run (synthetic
    # researcher, Round 10).
    for _line in method_preview_lines(run_card, row):
        print(_line)
    # Only the settings that applied (run_card.run_settings_rows), read from
    # the run's own config: an engine or plugin shows its batch size and one
    # "n/a" line instead of LLM defaults it never used. The stored card
    # keeps every field (the fingerprint and the database read them).
    from mt_eval_harness.run_card import run_settings_rows
    _preview_cfg = dict(_scan_report.get("config") or {})
    _preview_cfg.setdefault("batch_size", run_card.get("batch_size"))
    _preview_cfg.setdefault("temperature", run_card.get("temperature"))
    _preview_cfg.setdefault("max_tokens", run_card.get("max_tokens"))
    for _key, _value in run_settings_rows(_preview_cfg):
        if _key in ("Prompt", "Concurrency", "Tools"):
            continue   # the condition line above already names the prompt
        print(f"  {_key + ':':<14} {_value}")
    print(f"  Dataset:       {dataset['id']} ({scores.get('total', '?')} entries)")
    if run_card.get("corpus_license"):
        print(f"  License:       {run_card['corpus_license']}")
    # A local-only corpus: exactly which of its facts go public with the
    # score, which stay here, and how others read a score on a set they
    # cannot see (local_only_publication; Round 12 Cree school).
    if _is_local_only(run_card):
        try:
            _lo_report = json.loads(Path(report_path).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _lo_report = {}
        for _line in local_only_publication_lines(local_only_publication(
                run_card, _lo_report, prompt_redacted=prompt_redacted)):
            print(_line)
    # Say exactly what happens to the sentence TEXT — the same gate the real
    # publish applies (_entry_content_publishable). "will be stored
    # individually" hid whether corpus content leaves the machine (synthetic
    # researcher persona, 2026-10-03).
    report_data = json.loads(Path(report_path).read_text(encoding="utf-8"))
    entry_count = len(report_data.get("entries", []))
    if entry_count:
        _ds = (run_card.get("dataset") or {}).get("id")
        _allow, _why = _entry_content_publishable(
            _lookup_registry_entry(_ds) if _ds else None,
            scores_only=scores_only, override=publish_entries_override,
            local_only=_is_local_only(run_card))
        if _allow:
            print(f"  Entries:       {entry_count} rows WITH their source + reference text "
                  f"will be uploaded to the public run_card_entries table ({_why})")
            # Show what that means — the first rows exactly as they would be
            # uploaded (the preview said "62 rows … go public" and showed none;
            # synthetic researcher, Round 3). Only reachable when the text is
            # publishable at all; the terminal-privacy rule is checked too, so
            # a local-only / sealed / consent-required run never prints here.
            from mt_eval_harness.transmission_policy import withheld_text_reason
            if not withheld_text_reason(report_data):
                for _line in _entry_preview_lines(
                        _build_entry_rows(card_id, report_data["entries"])):
                    print(_line)
        else:
            print(f"  Entries:       {entry_count} — sentence text WITHHELD, scores only ({_why})")
    # The prompt rides the card even when sentence text is withheld (it is
    # the method artifact migration 051 exempts) — say so, and how to keep
    # it private. Scores-only used to read as "nothing but numbers leave".
    _prompt = run_card.get("system_prompt_used") or ""
    if prompt_redacted:
        print(f"  Prompt:        REDACTED on the card — only its sha256 is published "
              f"({prompt_redacted})")
    elif _prompt:
        print(f"  Prompt:        the system/coaching prompt ({len(_prompt):,} characters) "
              "IS published with the card, also in scores-only mode — pass "
              "--redact-coaching to publish only its sha256")
    # Caveats BEFORE the numbers they qualify (score_caveats) — they also
    # publish, as run_card["score_caveats"], for the leaderboard to show.
    _caveats = run_card.get("score_caveats") or []
    if _caveats:
        from mt_eval_harness.score_caveats import caveat_lines, short_label
        for _line in caveat_lines(_caveats, width=78, indent="  ",
                                  tier_note=True):
            print(_line)
        print("  (published with the card as score_caveats)")
    # THE HEADLINE (scoring standard/1): corpus chrF++ with its 95% bootstrap
    # CI and sacreBLEU signature — the one number the board ranks by.
    from mt_eval_harness.scoring import (
        RETIRED_NOTE as _RETIRED_NOTE, format_primary as _format_primary,
        primary_signature as _primary_signature)
    _chrf_ci = (cis or {}).get("corpus_chrf") or {}
    print(f"  Headline:      {_format_primary(scores.get('chrf_plus_plus'), _chrf_ci.get('ci_lower'), _chrf_ci.get('ci_upper'))}"
          "  (corpus-level, 0-100; 95% bootstrap CI; the ranking metric)")
    _sigs = scores.get("sacrebleu_signatures") or {}
    _chrf_sig = _primary_signature(_sigs)
    if _chrf_sig:
        print(f"    signature:   {_chrf_sig}")
    if _caveats:
        # What limits the headline, said beside it (detail above).
        print("    ⚠ caveat:    "
              + "; ".join(short_label(c) for c in _caveats)
              + " (see above)")
    print("  Beside it (standard metrics, never blended into the headline):")
    print(f"  BLEU:          {run_card.get('corpus_bleu', 'N/A')}  (corpus-level)")
    # spBLEU publishes with the card (scores.spbleu) — the preview said
    # nothing of it (synthetic researcher, Round 7).
    if "spbleu" in scores:
        _sp = scores["spbleu"]
        print("  spBLEU:        " + (f"{_sp}  (corpus-level, FLORES-200 "
                                     "SentencePiece)" if _sp is not None
                                     else "not computed (FLORES-200 "
                                          "tokenizer unavailable)"))
    if scores.get("ter") is not None:
        print(f"  TER:           {scores['ter']:.2f}  (lower is better)")
    if scores.get("comet_score") is not None:
        warning = " ⚠️  low-resource" if scores.get("comet_low_resource_warning") else ""
        comet_model = scores.get("comet_model")
        model_tag = f" ({comet_model})" if comet_model else ""
        print(f"  COMET:         {scores['comet_score']:.4f}{model_tag}{warning}")
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
    if _sigs:
        print("  SacreBLEU signatures (reproducibility):")
        for _sk in ("chrf", "bleu", "spbleu", "ter", "chrf_plain"):
            if _sigs.get(_sk):
                print(f"    {_sk:<10} {_sigs[_sk]}")
    print("  Diagnostics (reported separately; never in the headline, never ranked):")
    print(f"  Exact Match:   {exact_match_rate:.1%}" if exact_match_rate is not None else "  Exact Match:   —")
    if equiv_rate is not None:
        print(f"  Equiv Match:   {equiv_rate:.1%}")
    if fst_rate is not None:
        print(f"  FST Accept:    {fst_rate:.1%}  (mean of per-entry rates)")
    if scores.get("semantic_score") is not None:
        print(f"  Semantic:      {scores['semantic_score']:.4f}")
    if scores.get("length_ratio") is not None:
        print(f"  Length Ratio:  {scores['length_ratio']:.4f}")
    if scores.get("terminology_adherence") is not None:
        # Which glossary scored it: two runs' terminology readings compare
        # only with the same glossary, or none (Round 9 researcher).
        from mt_eval_harness.plugin_discovery import glossary_label
        _gl = (glossary_label(report_data.get("glossary"))
               or (report_data.get("config") or {}).get("glossary_file")
               or "recorded on the run")
        print(f"  Terminology:   {scores['terminology_adherence']:.1%}  "
              f"(glossary {_gl}; compare only with runs scored with the "
              "same glossary)")
    if scores.get("composite") is not None:
        # Only a card assembled before the standard can carry one.
        print(f"  Legacy composite (retired): {scores['composite']:.4f} — "
              "not a headline, not ranked.")
    else:
        import textwrap
        for _line in textwrap.wrap(
                "Not shown: a composite or a quality tier. " + _RETIRED_NOTE,
                width=76,
                initial_indent="  ", subsequent_indent="  ",
                break_on_hyphens=False):
            print(_line)
    cost_adj = scores.get("cost_adjusted")
    if cost_adj is not None:
        print(f"  Cost-adjusted: {cost_adj:.4f}")
    _tc = totals.get("total_cost_usd")
    print(f"  Cost:          {totals.get('cost_label') or ('$%.4f' % _tc if _tc is not None else 'unknown')}")
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
    elif not sys.stdin.isatty():
        # An agent or CI job cannot answer the prompt; publishing is a
        # deliberate act, so it must say so — never a traceback, never a
        # silent yes.
        print("\n  ✗ Not published: there is no terminal to confirm in. Re-run "
              "with --yes to publish without the prompt (preview first with "
              "--dry-run).")
        raise SystemExit(1)
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
        fp = (run_card.get("fingerprint") or {})
        print(f"    \"Same experiment\" means fingerprint v{fp.get('version', 1)} "
              f"matched on: {', '.join(sorted(fp.get('components') or {}))}. "
              f"A setup that differs only outside these is the same experiment "
              f"to the board.")
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
            local_only=_is_local_only(run_card),
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
        local_only=_is_local_only(run_card),
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


#: How many per-entry rows the publish preview prints before "… and N more".
def method_preview_lines(run_card: dict, row: dict | None = None) -> list[str]:
    """The publish preview's method lines: what the board shows beside the
    scores (methods spec, "Leaderboard display") — the method and its card
    name, class badge and paradigm as the row will carry them, the
    dependency class, tools, open-source flag, a plugin's code hash and
    version and the model it was handed, and an engine's model.

    ``row`` is the Supabase row (``build_run_card_row``): its
    ``method_class`` / ``paradigm`` are the columns the board filters on,
    which may be derived (a harness LLM run has no method card)."""
    from mt_eval_harness import engine_model as _em
    from mt_eval_harness.method_loader import dependency_class_label

    card = run_card.get("method_card") or {}
    plugin = run_card.get("method_plugin") or {}
    row = row or {}
    method_class = row.get("method_class") or card.get("class")
    paradigm = row.get("paradigm") or card.get("paradigm") or "unknown"
    lines: list[str] = []
    if card:
        name = card.get("method_id") or "?"
        if card.get("name") and card.get("name") != name:
            name += f" ({card['name']})"
        lines.append(f"  Method:        {name} — class {method_class or '?'}, "
                     f"paradigm {paradigm}")
    else:
        lines.append(f"  Method:        the harness's own LLM call (no method "
                     f"card) — class {method_class or '?'}, paradigm "
                     f"{paradigm}, derived from the provider")
    if card or plugin:
        dep = card.get("dependency_class") or plugin.get("dependency_class")
        lines.append(f"  Dependency:    {dependency_class_label(dep)}")
        tools = card.get("tools_used")
        lines.append("  Tools:         " + (
            ", ".join(str(t) for t in tools) if tools else
            ("none" if isinstance(tools, list) else "not declared")))
        open_source = card.get("open_source")
        lines.append("  Open source:   " + (
            "yes" if open_source is True else "no" if open_source is False
            else "not declared"))
    if plugin:
        sha = plugin.get("code_sha256") or ""
        lines.append(f"  Code:          sha256 {sha[:16]}… over method.json + "
                     f"*.py; version "
                     f"{plugin.get('version') or 'not declared'}")
        lines.append("  Model given:   " + (plugin.get("model_given")
                                            or "none (-m/--model not given)"))
        if plugin.get("models_called"):
            lines.append(f"  Models called: "
                         f"{', '.join(plugin['models_called'])} "
                         f"({plugin.get('models_basis') or 'as reported'})")
    engine = run_card.get("engine_model")
    if engine:
        lines.append(f"  Engine model:  {_em.label(engine)}")
        if engine.get("pair_mismatch"):
            pm = engine["pair_mismatch"]
            lines.append(f"  ⚠ Pair:        the model is for "
                         f"{pm.get('model_pair')}, the run is "
                         f"{pm.get('run_pair')} (run on purpose)")
    elif run_card.get("engine_model_unrecorded"):
        lines.append(f"  Engine model:  NOT RECORDED — "
                     f"{run_card['engine_model_unrecorded']}")
    return lines


ENTRY_PREVIEW_ROWS = 3


def _entry_preview_lines(rows: list[dict], limit: int = ENTRY_PREVIEW_ROWS,
                         width: int = 70) -> list[str]:
    """The first ``limit`` run_card_entries rows as the preview prints them:
    id, source, reference and output (each cut to ``width`` characters, with
    '…'), then how many more follow. The caller decides whether the text may
    be shown at all (_entry_content_publishable + withheld_text_reason)."""
    def _cut(text) -> str:
        text = " ".join(str(text or "").split())
        return text if len(text) <= width else text[: width - 1] + "…"

    lines = [f"    First {min(limit, len(rows))} of {len(rows)} rows as they "
             "would be uploaded:"]
    for row in rows[:limit]:
        lines.append(f"      #{row.get('entry_id', '?')}  source:    "
                     f"{_cut(row.get('source'))}")
        lines.append(f"      {'':{len(str(row.get('entry_id', '?'))) + 1}}  "
                     f"reference: {_cut(row.get('expected'))}")
        lines.append(f"      {'':{len(str(row.get('entry_id', '?'))) + 1}}  "
                     f"output:    {_cut(row.get('predicted'))}")
    if len(rows) > limit:
        lines.append(f"      … and {len(rows) - limit} more")
    return lines


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

