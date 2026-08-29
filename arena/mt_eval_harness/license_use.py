"""
license_use — use-based (commercial vs non-commercial) license eligibility.

The Python mirror of ``cli/lib/license-gate.mjs``'s ``isUsageAllowed``. It exists
so the harness, the contest model, and the NC-terms acknowledgment gate all
answer ONE question consistently:

    "May THIS USE touch this dataset's content?"

Project doctrine: **"prize", "API", and "commercial" are ORTHOGONAL
attributes, not one restricted bucket.** A NonCommercial license (CC-BY-NC /
CC-BY-NC-SA) gates COMMERCIAL use + REDISTRIBUTION *specifically* — it does NOT
gate non-commercial use. So a non-commercial prize (an open-source-solution
prize, or a corporation funding a prize for private/internal use) MAY use an NC
dataset; a commercial / for-profit / API-served use may NOT.

Eligibility is computed from a USE descriptor — ``use_context`` ('commercial' |
'non-commercial') and ``redistribution`` (bool) — combined with the dataset's
license, instead of a coarse lane name:

    NC dataset  →  ALLOWED  when use_context='non-commercial' AND no redistribution
                →  BLOCKED  when use_context='commercial' OR redistribution required

Fail-safe throughout: an unknown / unstated / mixed / proprietary license is
treated as RESTRICTED in EVERY context.

This module is **orthogonal to quarantine.** EdTeKLA + crk sovereignty corpora
are hard-quarantined a layer above this (the registry ``quarantine`` flag +
migration 022's DB trigger) and never rank in ANY lane, commercial or not. The
use-based nuance here applies only to general NC sets (MAFAND, ELCat, …). See
``contest_dataset_eligible`` — quarantine always wins.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Use contexts
# ---------------------------------------------------------------------------

COMMERCIAL = "commercial"
NON_COMMERCIAL = "non-commercial"
USE_CONTEXTS = (COMMERCIAL, NON_COMMERCIAL)


def _norm_context(use_context: str | None) -> str:
    """Normalize a use context. Anything but the exact non-commercial token
    falls back to 'commercial' — the most restrictive reading (fail-safe)."""
    return NON_COMMERCIAL if use_context == NON_COMMERCIAL else COMMERCIAL


# ---------------------------------------------------------------------------
# License classification (string-level, mirrors license-gate.mjs)
# ---------------------------------------------------------------------------

def is_non_commercial(license_str: str | None) -> bool:
    """Does this license carry a NonCommercial restriction? (positive detection)"""
    if not license_str:
        return False
    s = str(license_str).upper()
    return "-NC" in s or "NONCOMMERCIAL" in s or "NON-COMMERCIAL" in s


def is_commercial_safe(license_str: str | None) -> bool:
    """Is this a permissive, commercial-safe license (attribution at most)?

    Mirrors ``isPermissiveSpdx`` in license-gate.mjs: anything with -NC / -SA /
    -ND, any copyleft (GPL), and anything unstated/mixed/proprietary is NOT
    commercial-safe, regardless of a CC-BY-looking prefix.
    """
    if not license_str:
        return False
    s = str(license_str).upper()
    if "-NC" in s or "-SA" in s or "-ND" in s:
        return False
    if "GPL" in s:  # copyleft
        return False
    if re.search(r"UNCONFIRMED|UNSTATED|NO-PUBLIC|MIXED|SIL-TERMS|PROPRIETARY|RESTRICTED", s):
        return False
    if s == "CC":  # bare "CC" = unspecified version → unsafe
        return False
    for prefix in ("CC-BY", "CC0", "APACHE", "UNICODE", "BSD", "MIT",
                   "PUBLIC DOMAIN", "PUBLICDOMAIN", "PD-"):
        if s.startswith(prefix):
            return True
    for known in ("LICENSEREF-CHAMPOLLION-OWN", "LICENSEREF-PUBLICDOMAIN",
                  "LICENSEREF-FACTUALDATA", "LICENSEREF-IANA"):
        if s.startswith(known):
            return True
    return False


def non_commercial_use_allowed(license_str: str | None) -> bool:
    """May this license be USED non-commercially (no redistribution)?

    The lane an -NC license explicitly permits. True for permissive,
    NonCommercial, ShareAlike, NoDerivatives, and use-but-no-redistribute
    (SIL) licenses. Mixed / unstated / unknown / proprietary stay fail-safe
    restricted — we cannot confirm the terms.
    """
    if not license_str:
        return False
    if is_commercial_safe(license_str):  # permissive
        return True
    s = str(license_str).upper()
    if is_non_commercial(license_str):  # NC
        return True
    if "-SA" in s or "GPL" in s:  # share-alike / copyleft (use is fine)
        return True
    if "-ND" in s or "NODERIV" in s:  # no-derivatives (reading/eval is not a derivative)
        return True
    if "SIL-TERMS" in s:  # use ok, redistribution not
        return True
    return False  # mixed / unstated / unknown / proprietary → fail-safe


def _is_redistributable(license_str: str | None) -> bool:
    """Reuse publish.py's redistribution SSOT (kept byte-aligned with the DB
    trigger in migration 033). Lazy import — only the redistribution path of
    is_usage_allowed needs it."""
    from mt_eval_harness.publish import _license_is_redistributable
    return _license_is_redistributable(license_str)


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

def is_usage_allowed(
    license_str: str | None,
    *,
    use_context: str = NON_COMMERCIAL,
    redistribution: bool = False,
) -> tuple[bool, str]:
    """Is a given USE of a dataset's content allowed under its license?

    Returns ``(allowed, reason)``. Fail-safe: an unknown/unstated/mixed license
    is restricted in every context.
    """
    ctx = _norm_context(use_context)

    if redistribution:
        ok = _is_redistributable(license_str)
        return ok, (
            "redistribution cleared (permissive, redistribution-allowed)"
            if ok else
            f"redistribution requires a permissive, redistribution-cleared license; "
            f"'{license_str or 'unstated'}' does not qualify"
        )

    if ctx == COMMERCIAL:
        ok = is_commercial_safe(license_str)
        return ok, (
            "commercial use cleared (permissive)"
            if ok else
            f"commercial use blocked: '{license_str or 'unstated'}' is not "
            f"commercial-safe (NonCommercial / unstated / restricted)"
        )

    # non-commercial, no redistribution — the lane an -NC license permits
    ok = non_commercial_use_allowed(license_str)
    return ok, (
        "non-commercial use permitted (no redistribution)"
        if ok else
        f"non-commercial eligibility unconfirmed for '{license_str or 'unstated'}' "
        f"— fail-safe restricted"
    )


# ---------------------------------------------------------------------------
# Contest / prize eligibility — quarantine ALWAYS wins
# ---------------------------------------------------------------------------

def contest_dataset_eligible(
    use_context: str,
    dataset_license: str | None,
    *,
    quarantined: bool = False,
) -> tuple[bool, str]:
    """May a contest with the given use_context rank runs on this dataset?

    Eligibility = the contest's ``use_context`` flag + the dataset license, with
    quarantine ALWAYS winning:

      * Quarantined → NEVER eligible, in ANY lane (the EdTeKLA / sovereignty hard
        floor; client-side mirror of migration 022's DB trigger).
      * Commercial lane → STRICT (fail-safe): only commercially-safe (permissive)
        datasets rank; NonCommercial / unstated / mixed / unknown are all blocked.
        This is where the NC restriction bites — an NC dataset cannot be ranked
        by a commercial / for-profit / API-served contest.
      * Non-commercial lane → the SAFE lane: permissive AND NonCommercial (and
        ShareAlike / NoDerivatives / own-or-unregistered) datasets all rank. Only
        quarantine blocks here, so the "register your own / private corpora"
        pillar keeps working and an NC dataset is usable for a non-commercial
        prize (project doctrine 2026-06-19).
    """
    if quarantined:
        return False, (
            "dataset is quarantined — it never ranks in any contest "
            "(commercial or non-commercial); enforced by migration 022's DB trigger"
        )
    if _norm_context(use_context) == COMMERCIAL:
        # Strict fail-safe: NC / unstated / unknown are not commercial-safe.
        return is_usage_allowed(
            dataset_license, use_context=COMMERCIAL, redistribution=False
        )
    return True, "eligible for the non-commercial lane"


# ---------------------------------------------------------------------------
# Corpus license resolution — for the run-time NC-terms gate
# ---------------------------------------------------------------------------

def _load_datasets(registry_path: Path | None) -> list[dict[str, Any]]:
    try:
        from mt_eval_harness.config import load_registry
        registry = load_registry(registry_path)
    except Exception:
        registry = {}
    return registry.get("datasets", []) if isinstance(registry, dict) else []


def _lookup_registry_entry(
    corpus_arg: str, datasets: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Find a registry dataset entry for a ``--corpus <id|path>`` argument:
    by id / alias first, then (for a path) by path basename / stem."""
    for entry in datasets:
        if entry.get("id") == corpus_arg or corpus_arg in (entry.get("aliases") or []):
            return entry
    p = Path(corpus_arg)
    base, stem = p.name, p.stem
    for entry in datasets:
        for key in ("path", "local_path"):
            ep = entry.get(key)
            if ep and Path(ep).name == base:
                return entry
        if stem == entry.get("id") or stem in (entry.get("aliases") or []):
            return entry
    return None


def resolve_corpus_license(
    corpus_arg: str | None,
    registry_path: Path | None = None,
) -> tuple[str | None, str | None]:
    """Resolve ``(license, dataset_id)`` for a ``--corpus <id|path>`` argument.

    Best-effort, no fetch: looks the corpus up in the bundled/remote registry
    (by id/alias, then by path basename/stem) and, for a real file path, reads
    the corpus's own ``provenance.license``. Returns ``(None, None)`` when the
    license can't be determined — the NC gate is positive-only (it never blocks
    a corpus it can't confirm is NC), so an unresolved license is treated as
    "not known to be NC".
    """
    if not corpus_arg:
        return None, None
    datasets = _load_datasets(registry_path)

    # A real file path that carries its own provenance license wins (works for a
    # pip-installed harness with no bundled registry).
    p = Path(corpus_arg)
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError, UnicodeDecodeError):
            data = None
        if isinstance(data, dict):
            lic = (data.get("provenance") or {}).get("license") or data.get("license")
            if lic:
                return lic, data.get("corpus_id")

    entry = _lookup_registry_entry(corpus_arg, datasets)
    if entry:
        return entry.get("license"), entry.get("id")
    return None, None


def corpus_is_quarantined(
    corpus_arg: str | None,
    registry_path: Path | None = None,
) -> bool:
    """Is the corpus flagged quarantined in the registry? (EdTeKLA / sovereignty
    floor.) Unregistered corpora return False — quarantine is a registry/DB
    property, and the DB trigger (migration 022) is the un-bypassable backstop."""
    if not corpus_arg:
        return False
    entry = _lookup_registry_entry(corpus_arg, _load_datasets(registry_path))
    return bool(entry.get("quarantine")) if entry else False


# ---------------------------------------------------------------------------
# NC-terms acknowledgment record (parallel to interactive.make_attestation)
# ---------------------------------------------------------------------------

NC_TERMS_STATEMENT = (
    "I acknowledge this dataset is licensed for NON-COMMERCIAL / research use "
    "only. I will use it (and any results) for non-commercial purposes, and I "
    "will not redistribute the corpus content."
)


def make_nc_acknowledgment(
    corpus: str | None,
    license_str: str | None,
    *,
    via: str,
) -> dict[str, Any]:
    """Build the NC-terms acknowledgment record recorded on the run.

    Surfaces in the run log so the leaderboard/trust UI can later show that the
    submitter acknowledged the dataset's non-commercial terms. ``via`` is
    "guided" | "flag" | "prompt".
    """
    return {
        "acknowledged": True,
        "kind": "non-commercial-terms",
        "statement": NC_TERMS_STATEMENT,
        "corpus": corpus,
        "license": license_str,
        "via": via,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }
