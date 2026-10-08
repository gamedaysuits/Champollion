#!/usr/bin/env python3
"""ISO 639 code resolution — the single home for code-SCOPE logic in arena.

Upstream corpora label data with a mix of ISO 639-3 individual codes
(``cmn``), macrolanguage codes (``ara``), ISO 639-5 collective codes
(``ber``), retired codes (``kzj``), and script-suffixed BCP-47-style tags
(``cmn-Hans``). Those labels are metadata to RESOLVE, never truths to obey
or discard (docs/LANGUAGE_TAXONOMY.md, Position 4 v2 — the three-tier
resolution framework). This module supplies the MECHANICAL tier:

  * :func:`parse_code`         — split one optional ISO 15924 script subtag;
  * :func:`classify`           — individual | macrolanguage | collective |
                                 special | retired | unknown, from the pinned
                                 official tables (never guessed);
  * :func:`retirement_successor` — the successor code for clean, unambiguous
                                 retirements (merges/changes/duplicates);
                                 splits return None: choosing a side of a
                                 split is a variety judgment, not mechanics;
  * :func:`resolve_side`       — the per-side ``language_resolution`` stamp
                                 build_registry.py attaches to every dataset;
  * :func:`is_active_member`   — pin validation (a varietyResolution pin
                                 must name an ACTIVE INDIVIDUAL member of
                                 the macro it resolves).

Inputs are the pinned official snapshots (see their READMEs):

  cli/data/iso639-3/iso-639-3.tab               (SIL — scope/type/names)
  cli/data/iso639-3/iso-639-3-macrolanguages.tab (SIL — M-table)
  cli/data/iso639-3/iso-639-3_Retirements.tab    (SIL — retired elements)
  cli/data/iso639-5/iso639-5.tsv                 (LOC — collective codes)

Classification is POSITIVE-EVIDENCE only: a code absent from every table is
``unknown``, never assumed to be anything. No language facts live in this
file (SSOT rule) — only parsers over the pinned data.
"""
from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
MONOREPO = ARENA.parent
ISO3_DIR = MONOREPO / "cli" / "data" / "iso639-3"
ISO3_TAB = ISO3_DIR / "iso-639-3.tab"
ISO3_MACRO_TAB = ISO3_DIR / "iso-639-3-macrolanguages.tab"
ISO3_RETIRE_TAB = ISO3_DIR / "iso-639-3_Retirements.tab"
ISO5_TSV = MONOREPO / "cli" / "data" / "iso639-5" / "iso639-5.tsv"

#: base code (2-3 lowercase letters) + optional ISO 15924 script subtag
#: (four letters, titlecase — matched structurally, e.g. Hans/Latn/Wara).
_CODE_RE = re.compile(r"^([a-z]{2,3})(?:-([A-Z][a-z]{3}))?$")

#: Scope letters in iso-639-3.tab → classification vocabulary.
_SCOPE_CLASS = {"I": "individual", "M": "macrolanguage", "S": "special"}

#: Retirement reasons with a mechanical single successor when Change_To is
#: set: C change, D duplicate, M merge. S (split) never — picking one side
#: of a split is a variety judgment (tier 2, founder-recorded), and N
#: (non-existent) has nothing to succeed it.
_CLEAN_RETIREMENT_REASONS = frozenset({"C", "D", "M"})


def _read_tab(path: Path) -> list[dict]:
    """Read one official tab/tsv snapshot. FAIL LOUD on a missing file —
    resolving against a partial table silently misclassifies codes."""
    if not path.is_file():
        raise FileNotFoundError(
            f"pinned ISO table missing: {path} — see its README for the "
            f"official source; refusing to classify codes against a "
            f"partial dataset"
        )
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


@lru_cache(maxsize=1)
def _iso3_table() -> dict[str, dict]:
    return {
        row["Id"]: {
            "scope": (row.get("Scope") or "").strip(),
            "type": (row.get("Language_Type") or "").strip(),
            "ref_name": (row.get("Ref_Name") or "").strip(),
        }
        for row in _read_tab(ISO3_TAB)
        if row.get("Id")
    }


@lru_cache(maxsize=1)
def _macro_members() -> dict[str, frozenset]:
    """Macro code → frozenset of ACTIVE individual member codes
    (I_Status 'A' only — 'R' rows are retired memberships)."""
    members: dict[str, set] = {}
    for row in _read_tab(ISO3_MACRO_TAB):
        macro, ind = row.get("M_Id"), row.get("I_Id")
        if macro and ind and (row.get("I_Status") or "").strip() == "A":
            members.setdefault(macro, set()).add(ind)
    return {m: frozenset(v) for m, v in members.items()}


@lru_cache(maxsize=1)
def _retirements() -> dict[str, dict]:
    return {
        row["Id"]: {
            "reason": (row.get("Ret_Reason") or "").strip(),
            "change_to": (row.get("Change_To") or "").strip() or None,
            "ref_name": (row.get("Ref_Name") or "").strip(),
        }
        for row in _read_tab(ISO3_RETIRE_TAB)
        if row.get("Id")
    }


@lru_cache(maxsize=1)
def _collectives() -> dict[str, str]:
    """ISO 639-5 collective code → English label (LOC snapshot)."""
    return {
        row["code"]: (row.get("Label (English)") or "").strip()
        for row in _read_tab(ISO5_TSV)
        if row.get("code")
    }


def parse_code(code: str) -> tuple[str, str | None]:
    """``'cmn-Hans'`` → ``('cmn', 'Hans')``; ``'eng'`` → ``('eng', None)``.

    A token that does not match the base(+script) shape is returned
    whole with no script — classification will call it unknown."""
    token = (code or "").strip()
    m = _CODE_RE.match(token)
    if not m:
        return token, None
    return m.group(1), m.group(2)


def classify(base: str) -> str:
    """Positive-evidence classification of a BASE code (no script subtag).

    Order: the current ISO 639-3 table wins (a live code is never
    'retired'); then the retirements table; then ISO 639-5 collectives;
    else unknown."""
    if not base:
        return "unknown"
    entry = _iso3_table().get(base)
    if entry:
        return _SCOPE_CLASS.get(entry["scope"], "unknown")
    if base in _retirements():
        return "retired"
    if base in _collectives():
        return "collective"
    return "unknown"


def retirement_successor(base: str) -> str | None:
    """Successor for a cleanly-retired code (C/D/M with Change_To), else
    None. Follows chained retirements a few hops (a successor that was
    itself later retired), never loops."""
    seen: set[str] = set()
    current = base
    successor = None
    while current in _retirements() and current not in seen:
        seen.add(current)
        row = _retirements()[current]
        if row["reason"] not in _CLEAN_RETIREMENT_REASONS or not row["change_to"]:
            return None
        successor = row["change_to"]
        current = successor
    return successor


def iso_ref_name(base: str) -> str | None:
    """Official Ref_Name for a live or retired code (naming fallback)."""
    entry = _iso3_table().get(base)
    if entry and entry["ref_name"]:
        return entry["ref_name"]
    retired = _retirements().get(base)
    if retired and retired["ref_name"]:
        return retired["ref_name"]
    label = _collectives().get(base)
    return label or None


def is_active_member(macro: str, individual: str) -> bool:
    """True when ``individual`` is an ACTIVE member of macro ``macro`` and
    is itself an individual-scope code — the pin-validation predicate."""
    return (
        individual in _macro_members().get(macro, frozenset())
        and classify(individual) == "individual"
    )


def macro_members(macro: str) -> frozenset:
    return _macro_members().get(macro, frozenset())


def resolve_side(code: str, variety_pin: str | None = None) -> dict:
    """The per-side ``language_resolution`` stamp for one raw registry code.

    Returns ``{"resolved", "scope", "script", "via"}``:

      * ``resolved`` — the ACTIVE INDIVIDUAL ISO 639-3 code this side
        benchmark-resolves to, or None when resolution is not mechanical
        (macro/collective/special/unknown without a pin, or a split/dead
        retirement);
      * ``scope`` — the classification of the BASE code as labeled;
      * ``script`` — the stripped ISO 15924 subtag, if any;
      * ``via`` — how ``resolved`` was reached: None (identity),
        ``"script-strip"``, ``"retirement:<old>><new>"``,
        ``"variety-pin"`` — or None when unresolved.

    ``variety_pin`` is a pre-VALIDATED tier-2 pin (build_registry.py
    hard-validates with :func:`is_active_member` before passing it);
    it applies only to macro-scope sides."""
    base, script = parse_code(code)
    scope = classify(base)
    resolved: str | None = None
    via: str | None = None

    if scope == "individual":
        resolved = base
        via = "script-strip" if script else None
    elif scope == "retired":
        successor = retirement_successor(base)
        if successor and classify(successor) == "individual":
            resolved = successor
            via = f"retirement:{base}>{successor}"
    elif scope == "macrolanguage" and variety_pin:
        resolved = variety_pin
        via = "variety-pin"

    return {"resolved": resolved, "scope": scope, "script": script,
            "via": via}
