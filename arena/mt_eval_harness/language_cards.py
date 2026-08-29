"""
Language Card Index — Single source of truth for all language metadata.

Python equivalent of cli/lib/registers.js. Loads language card JSON files
from cli/shared/language-cards/ and builds lookup indexes for:
    - code → card (primary ISO 639-3 codes)
    - alias → code (ISO 639-1 codes, legacy codes, regional variants)
    - name → code (human-readable language names, case-insensitive)

ALL language resolution in the Python harness goes through this module.
No hardcoded language maps anywhere else. If you find one, delete it
and route through here instead.

Architecture mirrors registers.js:
    1. _ensure_loaded() scans all card JSON files once on first access
    2. Builds _cards, _aliases, _name_index dictionaries
    3. resolve_code() follows the same chain: direct → alias → base locale
    4. resolve_name() provides fuzzy name-to-code lookup
    5. get_card() returns full card with 'extends' inheritance resolved

Performance:
    Loading 7,928 cards takes ~200ms on a modern machine. This happens
    once per process. All subsequent lookups are O(1) dict access.

ADDING A NEW LANGUAGE:
    Just create the language card JSON file. This module will pick it up
    automatically — no code changes needed.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal state — populated lazily by _ensure_loaded()
# ---------------------------------------------------------------------------

# Primary card registry: ISO 639-3 code → raw card dict
_cards: dict[str, dict[str, Any]] = {}

# Parent/genus/family cards: code → raw card dict
# e.g., "genus-cree", "family-algonquian"
_parent_cards: dict[str, dict[str, Any]] = {}

# Alias → primary code. Built from each card's 'aliases' field.
# e.g., "fr" → "fra", "no" → "nob", "iw" → "heb"
_aliases: dict[str, str] = {}

# Lowercase language name → primary code. Built from each card's 'name' field.
# e.g., "french" → "fra", "plains cree" → "crk"
_name_index: dict[str, str] = {}

# Resolved (inheritance-merged) card cache
_resolved_cache: dict[str, dict[str, Any]] = {}

# Load guard — ensures we only scan the filesystem once
_loaded: bool = False

# Discovered cards directory path (cached after first find)
_cards_dir: Path | None = None

# How cards were loaded (set by _ensure_loaded):
#   'repo'   — a local language-cards directory (monorepo dev, MT_EVAL_CARDS_DIR,
#              or an npm-style install). _cards holds full cards.
#   'remote' — fetched from Supabase (a standalone `pip install`). _cards holds
#              a LITE manifest (code/name/aliases/iso639_1) for resolution; full
#              cards are fetched lazily per code by get_card() and cached.
#   'none'   — not yet loaded.
_mode: str = "none"

# Remote-index disk cache (mirrors config.py's registry cache). The compact
# index is cached so resolution doesn't re-fetch every process; full detail
# blobs are fetched live per code (in-memory cache only).
_REMOTE_INDEX_CACHE = Path.home() / ".cache" / "gds-mt-eval" / "cards-index.json"
_REMOTE_INDEX_TTL = 24 * 3600  # seconds — refresh at most once a day


def _cards_dir_override() -> Path | None:
    """An explicit local cards dir from the environment, if set + real.

    MT_EVAL_CARDS_DIR is the canonical name; CHAMPOLLION_CARDS_DIR is honored as
    an alias so a user who installs both tools can point them at one directory
    (interop). Lets a dev or air-gapped user run fully offline against a local
    checkout instead of fetching from Supabase.
    """
    for var in ("MT_EVAL_CARDS_DIR", "CHAMPOLLION_CARDS_DIR"):
        val = os.environ.get(var)
        if val:
            p = Path(val).expanduser()
            if p.is_dir():
                return p
            logger.warning("%s=%s is not a directory — ignoring.", var, val)
    return None


def _is_air_gapped() -> bool:
    """True when network card fetches are disabled by the environment.

    Reuses the harness's existing air-gap toggle (MT_EVAL_NO_REMOTE_REGISTRY,
    used by config.py) and honors the CLI's CHAMPOLLION_OFFLINE as an alias.
    Air-gapped + no local cards dir → fail loud (we never fabricate an empty
    index).
    """
    for var in ("MT_EVAL_NO_REMOTE_REGISTRY", "CHAMPOLLION_OFFLINE"):
        if os.environ.get(var, "").lower() in ("1", "true", "yes"):
            return True
    return False


# ---------------------------------------------------------------------------
# Cards directory discovery
# ---------------------------------------------------------------------------

def _find_cards_dir() -> Path | None:
    """Auto-detect the language cards directory.

    Search strategy:
        0. Explicit override: MT_EVAL_CARDS_DIR / CHAMPOLLION_CARDS_DIR
        1. Walk up from this file's location to find the monorepo root,
           then check cli/shared/language-cards/
        2. Walk up from CWD (handles running from any subdirectory)
        3. npm install fallback: node_modules/champollion/shared/language-cards/

    Returns None if no local directory is found — _ensure_loaded() then fetches
    cards from Supabase (or fails loud), per the dynamic-from-source rule.
    """
    # Strategy 0: explicit local override (dev / air-gapped / interop).
    override = _cards_dir_override()
    if override is not None:
        return override

    # Strategy 1: Relative to this file (most reliable in monorepo)
    # This file: <monorepo>/arena/mt_eval_harness/language_cards.py
    # Cards:     <monorepo>/cli/shared/language-cards/
    this_dir = Path(__file__).resolve().parent          # mt_eval_harness/
    arena_dir = this_dir.parent                         # arena/
    monorepo_root = arena_dir.parent                    # Champollion/

    candidate = monorepo_root / "cli" / "shared" / "language-cards"
    if candidate.is_dir():
        return candidate

    # Strategy 2: Walk up from CWD
    cwd = Path.cwd()
    check = cwd
    for _ in range(10):
        for sub in [
            check / "cli" / "shared" / "language-cards",
            check / "shared" / "language-cards",
        ]:
            if sub.is_dir():
                return sub
        check = check.parent

    # Strategy 3: npm install fallback
    npm_path = cwd / "node_modules" / "champollion" / "shared" / "language-cards"
    if npm_path.is_dir():
        return npm_path

    return None


# ---------------------------------------------------------------------------
# Lazy loading
# ---------------------------------------------------------------------------

def _ensure_loaded() -> None:
    """Load all language card JSON files on first access. Idempotent.

    Scans the cards directory recursively, building three indexes:
        _cards:      code → card (primary ISO 639-3 codes)
        _aliases:    alias → code (from card 'aliases' field + iso639_1)
        _name_index: lowercase name → code (from card 'name' field)

    Parent/genus/family cards go into _parent_cards for inheritance.
    """
    global _loaded, _cards_dir, _mode
    if _loaded:
        return

    _cards_dir = _find_cards_dir()
    if _cards_dir is None:
        # No local card directory — the standard standalone `pip install`
        # situation. Per the project rule (dynamic-from-source + fail-loud,
        # NEVER a silent empty index), fetch the resolution index from Supabase
        # and raise loudly if it's unreachable. Full cards are fetched lazily
        # per code by get_card(). This REPLACES the old silent degrade that set
        # _loaded=True with empty indexes and returned codes/None as-is.
        _load_remote_index()      # sets _mode='remote', or raises
        _loaded = True
        return

    card_count = 0
    alias_count = 0

    for p in _cards_dir.rglob("*.json"):
        try:
            card = _normalize_card(json.loads(p.read_text(encoding="utf-8")))
            code = card.get("code")
            if not code:
                continue

            # Parent/genus/family cards go into separate registry
            is_parent = (
                "genera" in p.parts
                or code.startswith("family-")
                or code.startswith("genus-")
                or code.startswith("macrolanguage-")
            )

            if is_parent:
                _parent_cards[code] = card
            else:
                _cards[code] = card
                card_count += 1

                # Build alias index from card's 'aliases' field
                for alias in card.get("aliases", []):
                    _aliases[alias] = code
                    alias_count += 1

                # Also index iso639_1 as an alias if present and not
                # already the primary code
                iso1 = card.get("iso639_1")
                if iso1 and iso1 != code and iso1 not in _aliases:
                    _aliases[iso1] = code
                    alias_count += 1

                # Build name index (case-insensitive).
                #
                # A LOCALE MUST NOT CLAIM ITS LANGUAGE'S NAME. `eng-GH` is
                # English as spoken in Ghana and carries the name "English",
                # so once locale cards joined the corpus the last one indexed
                # won and looking up "English" returned `eng-GH` — silently
                # retargeting a translation to a locale nobody asked for.
                #
                # The bare name belongs to the language. Locales are reached
                # by their tags, and a locale that ever needs a distinct
                # display name ("Canadian French") can claim it then, because
                # that name would not collide.
                name = card.get("name", "")
                if name:
                    is_locale = isinstance(card.get("locale"), dict) and card["locale"].get("language")
                    key = name.lower()
                    if not is_locale:
                        _name_index[key] = code
                    elif key not in _name_index:
                        # Recorded only if nothing else claims it, so a locale
                        # never displaces a language but an orphan name still
                        # resolves somewhere.
                        _name_index[key] = code

        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load language card %s: %s", p, e)

    _mode = "repo"
    _loaded = True
    logger.debug(
        "Language card index: %d cards, %d aliases, %d parent cards from %s",
        card_count, alias_count, len(_parent_cards), _cards_dir,
    )


# ---------------------------------------------------------------------------
# Remote (Supabase) loading — standalone `pip install` path
# ---------------------------------------------------------------------------

def is_attributed(value) -> bool:
    """True when a field carries an attribution envelope rather than a value.

    The atlas wraps a field as ``{agreement, consensus?, values:[{value,
    source}]}`` wherever its sources disagree, so a consumer that reads the
    field raw gets a dict where it expected a scalar. That is how a family
    name ended up inside a Python ``set`` and raised "unhashable type: dict".
    """
    return (
        isinstance(value, dict)
        and isinstance(value.get("agreement"), str)
        and "values" in value
    )


def display(value, on_disagreement: str | None = None, prefer_source: str | None = None):
    """The single displayable value for a field, or ``None`` if there is none.

    Mirrors ``display()`` in cli/lib/cards/reader.js, including its refusal:
    on genuine disagreement it returns ``None`` rather than electing a winner
    among sources, because "when sources disagree, show all of them
    attributed" is a standing rule of this project.

    Two explicit opt-outs, each taken with eyes open:

    ``prefer_source`` picks the claim from a named source — for a caller whose
    question really is "what does Glottolog say?" rather than "what is true".
    ``on_disagreement='first'`` takes the first recorded claim, deterministic
    because the store orders values, and appropriate only for IDENTITY fields
    where having no value at all is worse than having a labelled one.
    """
    if not is_attributed(value):
        return value
    if prefer_source:
        for v in value.get("values") or []:
            src = str(v.get("source") or "")
            if src.startswith(prefer_source):
                return v.get("value")
    if "consensus" in value:
        return value["consensus"]
    if on_disagreement == "first" and value.get("values"):
        return (value["values"] or [{}])[0].get("value")
    return None


def attributions(value) -> list[dict]:
    """Every claim a field carries, as ``[{value, source}]``.

    A plain value reports one claim with no source, so a caller can treat both
    shapes uniformly instead of branching on which corpus it was handed.
    """
    if is_attributed(value):
        return [v for v in (value.get("values") or []) if isinstance(v, dict)]
    if value is None:
        return []
    return [{"value": value, "source": None}]


def is_disputed(value) -> bool:
    """True when the sources genuinely disagree about this field."""
    if not is_attributed(value):
        return False
    if "consensus" in value:
        return False
    seen = {json.dumps(v.get("value"), sort_keys=True) for v in attributions(value)}
    return len(seen) > 1


def _normalize_card(card):
    """Adapt an atlas-shaped card to the field vocabulary this runtime reads.

    The Python twin of cli/lib/cards/reader.js normalizeCard, applied at the
    ONE load site for the same reason: the atlas keeps its honest names
    (endonym, textDirection, codeAliases, scripts[]) and its attribution
    envelopes, and the runtime grew up on the old corpus's flat names. The
    first unadapted run failed 179 tests, starting with a name envelope
    hitting ``.lower()``. Old-shape cards pass through untouched.

    What it refuses to invent, same as the JS twin: an absent text direction
    stays absent (only 162 languages have one asserted — defaulting would
    fabricate a fact for ~7,700), and only CLDR's two known direction values
    map to the runtime's enum.
    """
    if not isinstance(card, dict):
        return card

    def _display(v, first_on_dispute=False):
        return display(v, on_disagreement="first" if first_on_dispute else None)

    # name is IDENTITY: on the 439 languages whose registries disagree, the
    # first recorded value labels the card, deterministically; the full
    # disagreement stays available to anything that claims rather than labels.
    if isinstance(card.get("name"), dict):
        card["name"] = _display(card["name"], first_on_dispute=True)
    if card.get("nativeName") is None and card.get("endonym") is not None:
        v = _display(card["endonym"], first_on_dispute=True)
        if v is not None:
            card["nativeName"] = v
    if card.get("aliases") is None and isinstance(card.get("codeAliases"), list):
        card["aliases"] = card["codeAliases"]
    if card.get("script") is None:
        # From the CITED full tag, never scripts[0]: that list is
        # deterministic-alphabetical and its head once made English's primary
        # script DESERET. A one-entry list cannot misorder.
        tag = _display(card.get("bcp47FullTag"), first_on_dispute=True)
        m = re.match(r"^[a-z]{2,3}-([A-Z][a-z]{3})\b", tag) if isinstance(tag, str) else None
        if m:
            card["script"] = m.group(1)
        elif isinstance(card.get("scripts"), list) and len(card["scripts"]) == 1:
            only = card["scripts"][0]
            card["script"] = only if isinstance(only, str) else (only or {}).get("code")
    if card.get("dir") is None and card.get("script") \
            and not isinstance(card.get("textDirection"), str):
        # The SCRIPT's direction is CLDR's own scriptMetadata `rtl`, pinned —
        # a cited derivation, not a default (see the JS twin).
        rtl = _script_rtl()
        if rtl and card["script"] in rtl:
            card["dir"] = "rtl" if rtl[card["script"]] else "ltr"
    if card.get("dir") is None and isinstance(card.get("textDirection"), str):
        card["dir"] = {"left-to-right": "ltr", "right-to-left": "rtl"}.get(card["textDirection"])
        if card["dir"] is None:
            del card["dir"]
    if card.get("iso639_3") is None \
            and isinstance((card.get("locale") or {}).get("language"), str):
        # A locale's ISO 639-3 identity is its LANGUAGE's: fra-CA is French.
        # The locale block names the parent explicitly — a lookup, not a parse.
        card["iso639_3"] = card["locale"]["language"]
    if card.get("iso639_3") is None and isinstance(card.get("code"), str)             and len(card["code"]) == 3 and card["code"].isalpha():
        card["iso639_3"] = card["code"]

    # ISO 639-3 publishes the TYPE as a word ("Living"); the old corpus stored
    # its initial and consumers count living languages with isoType == "L".
    # Same bridge as the JS twin (reader.js) — without it the count is
    # silently zero.
    if card.get("isoType") is None and isinstance(card.get("isoLanguageType"), str) \
            and card["isoLanguageType"]:
        card["isoType"] = card["isoLanguageType"][0].upper()
        fs_map = card.get("_fieldSources")
        if isinstance(fs_map, dict) and "isoLanguageType" in fs_map \
                and "isoType" not in fs_map:
            fs_map["isoType"] = fs_map["isoLanguageType"]
    # isoScope stays the atlas's legible word; the registry letter every
    # consumer tests (== "M" for a macrolanguage hub) is offered ALONGSIDE it.
    if card.get("isoScopeInitial") is None and isinstance(card.get("isoScope"), str) \
            and card["isoScope"]:
        card["isoScopeInitial"] = card["isoScope"][0].upper()

    # SPEAKER ESTIMATES: the envelope IS the list. Its values[] become the
    # array-of-estimates shape both display layers were written for — one
    # entry per source, never flattened to a single number. Values convert to
    # numbers only when they really are numbers; a range or qualified figure
    # stays verbatim rather than becoming NaN's Python cousin.
    if is_attributed(card.get("speakerEstimates")):
        claims = card["speakerEstimates"].get("values") or []
        out_estimates = []
        for c in claims:
            raw = (c or {}).get("value")
            count = raw
            if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                count = raw
            elif isinstance(raw, str) and raw.strip():
                try:
                    n = float(raw)
                    count = int(n) if n.is_integer() else n
                except ValueError:
                    count = raw
            entry = {"count": count, "source": (c or {}).get("source")}
            if (c or {}).get("year"):
                entry["date"] = c["year"]
            # The claim's own scope note ("BC only", "L1 speakers") travels
            # with it — same rule as the JS twin.
            if (c or {}).get("note"):
                entry["note"] = c["note"]
            out_estimates.append(entry)
        card["speakerEstimates"] = out_estimates

    # VITALITY: one display tier, from ONE named source, never a merge. The
    # bridge reads the FIRST source in the declared authority order
    # (shared/catalogue/vitality-scales.json) that has an assessment and maps
    # that source's own words on that source's own scale. A language nobody
    # assesses stays unknown — a silence must not read as reassurance.
    if card.get("vitality") is None and card.get("endangerment") is not None:
        scales = _vitality_scales()
        if scales:
            claims = attributions(card["endangerment"])
            for source in scales.get("authorityOrder", []):
                hit = next(
                    (c for c in claims
                     if str(c.get("source") or "").startswith(source)),
                    None,
                )
                if hit is None:
                    continue
                tier = (scales.get("scales", {}).get(source, {})
                        .get("map", {}).get(str(hit.get("value")).strip()))
                if not tier:
                    continue
                card["vitality"] = {
                    "unescoStatus": tier,
                    "assessedBy": hit.get("source"),
                    "note": "champollion-derived: one display tier read from a "
                            "single cited assessment. The full set of "
                            "assessments stays on `endangerment`.",
                }
                fs_map = card.get("_fieldSources")
                if isinstance(fs_map, dict) and "vitality" not in fs_map:
                    fs_map["vitality"] = [f"derived:{hit.get('source')}"]
                break

    # dataSources: the atlas stamps provenance per FIELD; the licence sweep
    # reads the flat card-level list. The union of the per-field stamps is the
    # same claim, assembled rather than duplicated.
    if card.get("dataSources") is None and isinstance(card.get("_fieldSources"), dict):
        all_sources = set()
        for v in card["_fieldSources"].values():
            for s in (v if isinstance(v, list) else [v]):
                if isinstance(s, str):
                    all_sources.add(s)
        if all_sources:
            card["dataSources"] = sorted(all_sources)

    # methodSupport: the atlas projects EVIDENCE ({total, byTier, named[]});
    # this runtime reads the legacy flat map, including nllb's FLORES code.
    # Services come from the named entries (uncapped in the projection so
    # absence is honest). The open families come from the superseded curated
    # lists — kept in method-coverage.json for exactly this pre-cutover
    # window — and the FLORES code is the published convention itself,
    # iso639_3 + "_" + script, the same convention the tag resolver parses.
    ms = card.get("methodSupport")
    if isinstance(ms, dict) and isinstance(ms.get("named"), list):
        legacy_keys = {
            "google-translate": "googleTranslate",
            "deepl": "deepl",
            "microsoft-translator": "microsoftTranslator",
            "libretranslate": "libreTranslate",
            "apertium": "apertium",
        }
        flat = {v: {"supported": False} for v in legacy_keys.values()}
        for n in ms["named"]:
            key = legacy_keys.get(n.get("variant"))
            if key and n.get("value") == "service":
                flat[key] = {"supported": True}
        code3 = card.get("iso639_3") or card.get("code")
        fam = _superseded_families()
        for fam_key in ("nllb", "madlad", "m2m100", "opus"):
            covered = code3 in fam.get(fam_key, set())
            flat[fam_key] = {"supported": covered}
            if fam_key == "nllb" and covered and card.get("script"):
                flat["nllb"]["code"] = f"{code3}_{card['script']}"
        flat["llm"] = {"supported": True}
        card["methodSupportEvidence"] = ms
        card["methodSupport"] = flat

    # metricModelSupport: same adaptation. The atlas records "which metric
    # model lists this language" as attributed values with a metric variant;
    # the runtime reads a flat map. xlmr membership IS the high tier — the
    # paper publishes the list, not per-language scores (tierMeaning on the
    # register entry).
    mms = card.get("metricModelSupport")
    if isinstance(mms, dict) and isinstance(mms.get("values"), list):
        flat_m = {}
        for v in mms["values"]:
            var = v.get("variant")
            if not var:
                continue
            if var == "xlmr":
                flat_m[var] = {"tier": "high", "model": v.get("value")}
            else:
                # `supported` because presence in the register IS the claim —
                # except the publisher's PIVOTS (eng/fra for AfriCOMET), which
                # are in the list as the languages pairs run through, not as
                # targets. The register marks them; treating a pivot as a
                # target would recommend africomet for French.
                pivots = _metric_pivots().get(var, set())
                code3_m = card.get("iso639_3") or card.get("code")
                flat_m[var] = {
                    "supported": code3_m not in pivots,
                    "model": v.get("value"),
                }
                if code3_m in pivots:
                    flat_m[var]["pivot"] = True
                if var == "africomet":
                    qe = _metric_qe_models().get(var)
                    if qe:
                        flat_m["qe"] = dict(flat_m[var], model=qe)
        card["metricModelSupport"] = flat_m

    # Prompts and register/formality presets are CONFIG (gate 3): declared in
    # shared/catalogue, attached at read time, never cited as fact. The JS
    # runtime does this in its one migration seam; this is the Python twin. A
    # card that already carries registers keeps them — during migration the
    # live corpus still does, and a card's own values are never replaced.
    ev = _eval_config_for(card.get("code"))
    if ev:
        for k, v in ev.items():
            card.setdefault(k, v)

    if not card.get("registers"):
        preset = _register_preset_for(card.get("code"))
        if preset:
            card["registers"] = preset.get("registers")
            f = dict(card.get("formality") or {})
            if preset.get("system"):
                f.setdefault("system", preset["system"])
            if preset.get("default"):
                f.setdefault("default", preset["default"])
            if f:
                card["formality"] = f
    return card


_SCRIPT_RTL = None


def _script_rtl():
    global _SCRIPT_RTL
    if _SCRIPT_RTL is None:
        _SCRIPT_RTL = {}
        # Walk up from the cards dir when resolved, and ALWAYS also from this
        # module file — normalize_card is a public API and must not depend on
        # load order (same rule as _vitality_scales).
        roots = [r for r in (_cards_dir, Path(__file__).resolve().parent)
                 if r is not None]
        for start in roots:
            root = start
            for _ in range(6):
                for c in (root / "cli" / "data" / "cldr-supplemental" / "scriptMetadata.json",
                          root / "data" / "cldr-supplemental" / "scriptMetadata.json"):
                    try:
                        m = json.loads(c.resolve().read_text(encoding="utf-8"))["scriptMetadata"]
                        _SCRIPT_RTL = {k: v.get("rtl") == "YES" for k, v in m.items()}
                        return _SCRIPT_RTL
                    except (OSError, ValueError, KeyError):
                        continue
                root = root.parent
    return _SCRIPT_RTL


_VITALITY_SCALES = None


def _vitality_scales():
    """The endangerment-scale decision (authority order + vocabularies).

    Python twin of reader.js _vitalityScales(). Resolution: the
    CHAMPOLLION_SHARED_DIR override (forge precedent) first, then the same
    walk-up used by every other shared/catalogue read here. Returns False when
    the file is unreachable — the vitality bridge is then silently skipped,
    matching the JS twin's sentinel (same behavior both runtimes: a published
    install without the catalogue simply leaves `vitality` unbridged).
    """
    global _VITALITY_SCALES
    if _VITALITY_SCALES is not None:
        return _VITALITY_SCALES
    override = os.environ.get("CHAMPOLLION_SHARED_DIR")
    if override:
        try:
            _VITALITY_SCALES = json.loads(
                (Path(override) / "catalogue" / "vitality-scales.json")
                .resolve().read_text(encoding="utf-8"))
            return _VITALITY_SCALES
        except (OSError, ValueError):
            pass
    # Walk up from the cards dir when one is resolved, and ALWAYS also from
    # this module file (arena/mt_eval_harness/ → repo root two parents up) —
    # the JS twin resolves relative to its own module for exactly this reason:
    # normalize_card is a public API and must not depend on load order.
    roots = [r for r in (_cards_dir, Path(__file__).resolve().parent) if r is not None]
    for start in roots:
        root = start
        for _ in range(6):
            for c in (root / "shared" / "catalogue" / "vitality-scales.json",
                      root / "cli" / "shared" / "catalogue" / "vitality-scales.json"):
                try:
                    _VITALITY_SCALES = json.loads(c.resolve().read_text(encoding="utf-8"))
                    return _VITALITY_SCALES
                except (OSError, ValueError):
                    continue
            root = root.parent
    _VITALITY_SCALES = False
    return _VITALITY_SCALES


def _catalogue_json(filename):
    """Resolve and parse a shared/catalogue file, or None when unreachable.

    Walks up from the cards dir when one is resolved, and ALWAYS also from
    this module file — the same two-root rule as _vitality_scales and
    _script_rtl, for the same reason: normalize_card is a public API and must
    not depend on load order. Five catalogue caches used to walk only from
    `_cards_dir`, so a direct normalize_card call (forge's load_card) before
    any harness card load permanently poisoned them EMPTY — an in-process
    `forge score` after `cards.discover` silently lost the crk LYSS referee.
    """
    roots = [r for r in (_cards_dir, Path(__file__).resolve().parent)
             if r is not None]
    for start in roots:
        root = start
        for _ in range(6):
            for c in (root / "shared" / "catalogue" / filename,
                      root / "cli" / "shared" / "catalogue" / filename):
                try:
                    return json.loads(c.resolve().read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
            root = root.parent
    return None


_METRIC_QE = None


def _metric_qe_models():
    """qeModel per metric key, from the register."""
    global _METRIC_QE
    if _METRIC_QE is None:
        _METRIC_QE = {}
        data = _catalogue_json("metric-coverage.json")
        for m in (data or {}).get("models", []):
            if m.get("qeModel"):
                _METRIC_QE[m["key"]] = m["qeModel"]
    return _METRIC_QE


_METRIC_PIVOTS = None


def _metric_pivots():
    """Per-metric pivot sets from metric-coverage.json, cached."""
    global _METRIC_PIVOTS
    if _METRIC_PIVOTS is None:
        _METRIC_PIVOTS = {}
        data = _catalogue_json("metric-coverage.json")
        for m in (data or {}).get("models", []):
            _METRIC_PIVOTS[m["key"]] = set(m.get("pivots", []))
    return _METRIC_PIVOTS


_EVAL_CONFIG = None


def _eval_config_for(code):
    """Per-language eval wiring from card-config.json — OURS, gate 3."""
    global _EVAL_CONFIG
    if _EVAL_CONFIG is None:
        data = _catalogue_json("card-config.json")
        _EVAL_CONFIG = {k: v for k, v in (data or {}).get("evalConfig", {}).items()
                        if not k.startswith("_")}
    return _EVAL_CONFIG.get(code) if code else None


_REGISTER_PRESETS = None


def _register_preset_for(code):
    """register-presets.json lookup: bespoke per-language, else shared via assignment."""
    global _REGISTER_PRESETS
    if _REGISTER_PRESETS is None:
        _REGISTER_PRESETS = {"shared": {}, "byLanguage": {}, "assignment": {}}
        data = _catalogue_json("register-presets.json")
        if data:
            for k in ("shared", "byLanguage", "assignment"):
                _REGISTER_PRESETS[k] = data.get(k, {})
    if not code:
        return None
    by = _REGISTER_PRESETS["byLanguage"].get(code)
    if by:
        return by
    key = _REGISTER_PRESETS["assignment"].get(code)
    return _REGISTER_PRESETS["shared"].get(key) if key else None


_SUPERSEDED_FAMILIES = None


def _superseded_families():
    """The open-model language lists from method-coverage.json, cached.

    These entries are marked supersededBy in the file — a fetched source now
    carries the same coverage — but they REMAIN there for this exact consumer
    during the migration window; deleting them early broke a working CLI once.
    """
    global _SUPERSEDED_FAMILIES
    if _SUPERSEDED_FAMILIES is None:
        _SUPERSEDED_FAMILIES = {}
        data = _catalogue_json("method-coverage.json")
        try:
            for m in (data or {}).get("methods", []):
                _SUPERSEDED_FAMILIES[m["key"]] = set(m.get("iso6393", []))
        except KeyError:
            pass
    return _SUPERSEDED_FAMILIES


def _load_remote_index() -> None:
    """Populate the resolution indexes from Supabase (remote/standalone mode).

    Builds _cards as a LITE manifest (code → {code, name, aliases, iso639_1}),
    plus _aliases and _name_index, from the compact trading_card_index. Full
    cards are fetched lazily per code by get_card(). Sets _mode='remote'.

    Disk-cached with a TTL (mirrors config.py's registry cache). FAIL-LOUD:
    when the index is unreachable and no cache exists (and we are not air-gapped
    with a local dir), raises LanguageCardsUnavailable — we never continue atop
    an empty, fabricated index.
    """
    global _mode
    from mt_eval_harness import language_cards_remote as _remote

    if _is_air_gapped():
        raise _remote.LanguageCardsUnavailable(
            "No local language-card directory was found and remote fetching is "
            "disabled (MT_EVAL_NO_REMOTE_REGISTRY / CHAMPOLLION_OFFLINE). Set "
            "MT_EVAL_CARDS_DIR to a cli/shared/language-cards checkout, or unset "
            "the air-gap flag so cards can be fetched from Supabase. Refusing to "
            "run without a language-card index (fail-loud, never fabricate one)."
        )

    rows = _read_remote_index_cache()
    if rows is None:
        try:
            rows = _remote.fetch_index_rows()
        except _remote.LanguageCardsUnavailable:
            stale = _read_remote_index_cache(ignore_ttl=True)
            if stale is not None:
                logger.warning(
                    "Could not refresh the language-card index from Supabase; "
                    "using the stale cached index at %s.", _REMOTE_INDEX_CACHE,
                )
                rows = stale
            else:
                raise
        else:
            _write_remote_index_cache(rows)

    for row in rows:
        code = row.get("code")
        if not code:
            continue
        _cards[code] = {
            "code": code,
            "name": row.get("name"),
            "aliases": row.get("aliases") or [],
            "iso639_1": row.get("iso639_1"),
            "_lite": True,
        }
        for alias in row.get("aliases") or []:
            _aliases[alias] = code
        iso1 = row.get("iso639_1")
        if iso1 and iso1 != code and iso1 not in _aliases:
            _aliases[iso1] = code
        name = row.get("name") or ""
        if name:
            _name_index[name.lower()] = code

    _mode = "remote"
    logger.debug(
        "Language card index (remote): %d codes, %d aliases from Supabase.",
        len(_cards), len(_aliases),
    )


def _read_remote_index_cache(*, ignore_ttl: bool = False) -> list[dict[str, Any]] | None:
    """Read the cached remote index, or None if absent / stale / unreadable."""
    if not _REMOTE_INDEX_CACHE.is_file():
        return None
    if not ignore_ttl:
        age = time.time() - _REMOTE_INDEX_CACHE.stat().st_mtime
        if age >= _REMOTE_INDEX_TTL:
            return None
    try:
        data = json.loads(_REMOTE_INDEX_CACHE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) and data else None
    except (OSError, json.JSONDecodeError):
        return None


def _write_remote_index_cache(rows: list[dict[str, Any]]) -> None:
    try:
        _REMOTE_INDEX_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _REMOTE_INDEX_CACHE.write_text(json.dumps(rows), encoding="utf-8")
    except OSError as exc:
        logger.debug("Could not write card-index cache: %s", exc)


def _get_card_remote(code: str) -> dict[str, Any] | None:
    """Fetch + cache a full card from Supabase (remote mode).

    ``code`` must already be resolved (canonical). Returns None when the
    language genuinely has no card (it is absent from the index). Raises
    LanguageCardsUnavailable on a network/server error — we never report
    "no card" because of an outage.
    """
    from mt_eval_harness import language_cards_remote as _remote

    if code in _resolved_cache:
        return _resolved_cache[code]
    # The index lists every published code, so absence means "no such card" —
    # answer None without a network round-trip.
    if code not in _cards:
        return None
    detail = _remote.fetch_detail_card(code)
    if detail is None:
        return None
    _resolved_cache[code] = detail
    return detail


# ---------------------------------------------------------------------------
# Public API — Code Resolution
# ---------------------------------------------------------------------------

def resolve_code(code: str) -> str:
    """Resolve any language code/alias to its canonical ISO 639-3 code.

    Resolution chain (mirrors JS resolveCode() in registers.js):
        1. Direct match: 'fra' → 'fra' (already canonical)
        2. Alias match:  'fr'  → 'fra' (from card aliases field)
        3. Base locale:  'fr-CA' → 'fr' → 'fra' (strip region subtag)
        4. No match:     returns the input unchanged

    Args:
        code: Language code, alias, or regional variant to resolve.

    Returns:
        Canonical ISO 639-3 code, or the input code if no resolution found.
    """
    _ensure_loaded()

    # Direct match — already canonical
    if code in _cards:
        return code

    # Alias match
    if code in _aliases:
        return _aliases[code]

    # Base locale fallback: "fr-CA" → try "fra-CA" (resolved base + region),
    # then "fr" → "fra" (base only)
    if "-" in code:
        parts = code.split("-", 1)
        base = parts[0]
        region = parts[1]

        # Try resolving the base and recombining: "fr-CA" → "fra-CA"
        resolved_base = None
        if base in _cards:
            resolved_base = base
        elif base in _aliases:
            resolved_base = _aliases[base]

        if resolved_base:
            regional = f"{resolved_base}-{region}"
            if regional in _cards:
                return regional
            # Regional variant not found — fall back to base language
            return resolved_base

    # No resolution found — return as-is
    return code


def resolve_name(name: str) -> str | None:
    """Resolve a human-readable language name to its ISO 639-3 code.

    Case-insensitive lookup against all loaded language card names.
    Also handles parenthetical suffixes: "Plains Cree (nêhiyawêwin, SRO)"
    will try "plains cree (nêhiyawêwin, sro)" first, then "plains cree".

    Args:
        name: Human-readable language name.

    Returns:
        ISO 639-3 code, or None if no match found.
    """
    _ensure_loaded()

    lower = name.strip().lower()

    # Direct name match
    if lower in _name_index:
        return _name_index[lower]

    # Try stripping parenthetical suffix:
    # "Plains Cree (nêhiyawêwin, SRO)" → "plains cree"
    if "(" in lower:
        base_name = lower.split("(")[0].strip()
        if base_name in _name_index:
            return _name_index[base_name]

    return None


# ---------------------------------------------------------------------------
# Public API — Card Access
# ---------------------------------------------------------------------------

def _resolve_card_with_inheritance(code: str) -> dict[str, Any] | None:
    """Resolve a card with its full extends inheritance chain.

    Recursively merges parent cards (genus → family → card) following
    the 'extends' field. Caches resolved cards for performance.
    """
    if code in _resolved_cache:
        return _resolved_cache[code]

    # Find the raw card (could be in _cards or _parent_cards)
    raw = _cards.get(code) or _parent_cards.get(code)
    if raw is None:
        return None

    resolved = dict(raw)

    # Resolve inheritance
    parent_code = raw.get("extends")
    if parent_code:
        parent_card = _resolve_card_with_inheritance(parent_code)
        if parent_card:
            resolved = _deep_merge(parent_card, resolved)
        else:
            logger.warning(
                "Language card '%s' extends unknown card '%s'.",
                code, parent_code,
            )

    _resolved_cache[code] = resolved
    return resolved


def _deep_merge(parent: dict, child: dict) -> dict:
    """Deep merge two card dicts (child overrides parent).

    Semantics match the JS _deepMerge() in registers.js:
        - null/None in child → inherit from parent
        - objects merge recursively
        - arrays in child replace parent arrays entirely
        - Identity fields (code, extends, aliases, iso639_1, iso639_3)
          always use child's value
    """
    _IDENTITY_FIELDS = {"code", "extends", "_migration", "aliases", "iso639_1", "iso639_3"}
    merged = dict(parent)

    for key, value in child.items():
        # Identity fields: always use child's value
        if key in _IDENTITY_FIELDS:
            merged[key] = value
            continue

        # None in child means "inherit from parent"
        if value is None:
            continue

        # Recursive merge for nested dicts (not lists)
        if (
            isinstance(value, dict)
            and key in merged
            and isinstance(merged[key], dict)
        ):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value

    return merged


def get_card(code: str) -> dict[str, Any] | None:
    """Get the full language card for a code, with inheritance resolved.

    Follows aliases and resolves the 'extends' chain. Returns None if
    no card exists for this language.

    Args:
        code: Language code, alias, or regional variant.

    Returns:
        Complete language card dict with parent fields merged, or None.
    """
    _ensure_loaded()
    resolved = resolve_code(code)
    if _mode == "remote":
        # In remote mode _cards holds a lite manifest; the full card is the
        # pre-resolved (extends-merged) detail blob, fetched + cached lazily.
        return _get_card_remote(resolved)
    return _resolve_card_with_inheritance(resolved)


def get_name(code: str) -> str | None:
    """Get the human-readable display name for a language code.

    A script-suffixed corpus code (``cmn-Hans``) whose exact card misses
    resolves through its BASE code — the script split is a corpus labeling
    detail, the language is the same — and the script is annotated on the
    name ("Mandarin Chinese (Hans script)") so prompts stay honest about
    what the corpus is written in. An exact variant card (``cmn-Hant``)
    still wins when one exists.

    Args:
        code: Language code, alias, regional variant, or code-Script tag.

    Returns:
        Language name (e.g., "French", "Plains Cree"), or None.
    """
    _ensure_loaded()
    resolved = resolve_code(code)
    # Serve the name from the index entry when available — in remote mode this
    # avoids a detail fetch just for a label. The 'name' field is not inherited,
    # so the index/lite value matches the resolved card.
    entry = _cards.get(resolved)
    if isinstance(entry, dict) and entry.get("name"):
        return entry["name"]
    card = get_card(code)
    if card and card.get("name"):
        return card["name"]
    # Structural ISO 15924 script-subtag fallback (base card + annotation).
    m = re.match(r"^([a-z]{2,3})-([A-Z][a-z]{3})$", (code or "").strip())
    if m:
        base_name = get_name(m.group(1))
        if base_name:
            return f"{base_name} ({m.group(2)} script)"
    return None


def get_all_codes() -> list[str]:
    """Get all primary language codes (not aliases).

    Returns:
        List of ISO 639-3 codes for all loaded cards.
    """
    _ensure_loaded()
    return list(_cards.keys())


def get_cards_dir() -> Path | None:
    """Get the discovered language cards directory path.

    Returns None if cards haven't been loaded or directory wasn't found.
    """
    _ensure_loaded()
    return _cards_dir


# ---------------------------------------------------------------------------
# Public API — Metric Model Support
#
# These functions query the 'metricModelSupport' field on language cards.
# They replace the hardcoded _XLMR_HIGH_RESOURCE and _AFRICOMET_LANGUAGES
# sets that previously lived in metrics_comet.py. The SSOT is now the
# language card JSON files, enriched by enrich-metric-model-support.mjs.
# ---------------------------------------------------------------------------

def is_xlmr_high_resource(code: str) -> bool:
    """Check if a language has high XLM-R representation.

    Languages with high XLM-R representation produce more reliable COMET
    scores. Languages NOT in this set may have noisier COMET scores due
    to weaker XLM-R embeddings.

    Source: XLM-R paper (Conneau et al., 2020) — top-100 languages
    by CommonCrawl training data volume.

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        True if the language is in XLM-R's top tier.
    """
    card = get_card(code)
    if card is None:
        return False

    mms = card.get("metricModelSupport")
    if mms is None:
        return False

    xlmr = mms.get("xlmr")
    return isinstance(xlmr, dict) and xlmr.get("tier") == "high"


def has_africomet(code: str) -> bool:
    """Check if a language has AfriCOMET training data.

    Languages with AfriCOMET support get better evaluation scores
    from masakhane/africomet-mtl than from default wmt22-comet-da,
    because AfriCOMET was trained with human judgments for these
    specific languages.

    Source: Wan et al. (2022) + Masakhane evaluation datasets.

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        True if AfriCOMET was trained with human judgment data
        for this language.
    """
    card = get_card(code)
    if card is None:
        return False

    mms = card.get("metricModelSupport")
    if mms is None:
        return False

    africomet = mms.get("africomet")
    return isinstance(africomet, dict) and africomet.get("supported") is True


def get_metric_model_for(code: str) -> str | None:
    """Get the recommended COMET model for a language, if any.

    Checks the language card's metricModelSupport field for
    language-specific model recommendations.

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        Model identifier string (e.g., "masakhane/africomet-mtl")
        if a specialized model is recommended, or None to use the
        default COMET model.
    """
    card = get_card(code)
    if card is None:
        return None

    mms = card.get("metricModelSupport")
    if mms is None:
        return None

    # AfriCOMET takes priority (it's a specialized model)
    africomet = mms.get("africomet")
    if isinstance(africomet, dict) and africomet.get("supported"):
        return africomet.get("model")

    # Future: check for IndicCOMET, etc.

    return None


def get_qe_model_for(code: str) -> str | None:
    """Get the recommended REFERENCE-FREE QE model for a language, if any.

    Reads ``metricModelSupport.qe.model`` (card SSOT). Returns None when no QE
    model is declared — the no-reference profile then scores from deterministic
    signals alone (test-pinned: it does NOT fail loud; see
    test_scoring_ssot.TestNoReferenceDeterministic), with tester.py printing a
    loud warning that such a composite carries no adequacy signal.
    Example: ``masakhane/africomet-qe-stl`` (African langs).

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        QE model identifier, or None if the card declares no QE model.
    """
    card = get_card(code)
    if card is None:
        return None
    mms = card.get("metricModelSupport")
    if mms is None:
        return None
    qe = mms.get("qe")
    if isinstance(qe, dict) and qe.get("supported"):
        return qe.get("model")
    return None


# ---------------------------------------------------------------------------
# Public API — Scoring Profile resolution (SCORING_SPEC §4.3)
#
# The composite is no longer chosen by a single has_fst boolean. Each language
# resolves to a NAMED profile in scoring.PROFILE_REGISTRY. This is the SSOT
# entry point publish.py uses instead of the old Profile A/B switch.
# ---------------------------------------------------------------------------

def resolve_scoring_profile(
    code: str, *, fst_ran: bool = False, has_references: bool = True
) -> str:
    """Resolve the composite scoring profile for a language (SCORING_SPEC §4.3).

    Resolution order (first match wins):
        1. An explicit ``scoringProfile.basis`` on the card, when it names a known
           profile (inherited through ``extends`` via get_card). An invalid
           declared basis fails loud.
        2. ``no-reference`` when the run has NO gold reference (``has_references``
           is False) — reference-based metrics can't be computed, so scoring leans
           on reference-free signals (qe_score REQUIRED, FST, behavioral).
        3. ``fst-coverage`` when a finite-state analyzer scored this run.
        4. ``surface-only`` otherwise.

    Neural adequacy (COMET/AfriCOMET, AfriCOMET-QE) is never part of a composite
    profile — it is computed and reported separately (scoring.NEURAL_METRICS).

    Args:
        code: Language code (any format — resolved via resolve_code).
        fst_ran: Whether an FST produced an acceptance rate for this run.
        has_references: Whether this run has gold references. False routes to the
            reference-free ``no-reference`` profile.

    Returns:
        A profile name guaranteed to exist in scoring.PROFILE_REGISTRY.
    """
    # Local import avoids a module-level cycle (scoring imports nothing here).
    from mt_eval_harness.scoring import PROFILE_REGISTRY

    card = get_card(code) if code else None
    if card:
        sp = card.get("scoringProfile")
        if isinstance(sp, dict) and sp.get("basis") is not None:
            basis = sp.get("basis")
            # A declared-but-invalid basis is a card error — fail loud rather
            # than silently ignoring it and scoring under a different profile.
            if not (isinstance(basis, str) and basis in PROFILE_REGISTRY):
                raise ValueError(
                    f"Language card {code!r} declares scoringProfile.basis="
                    f"{basis!r}, which is not a known profile "
                    f"({sorted(PROFILE_REGISTRY)}). Fix the card — we do not "
                    f"silently ignore an invalid declared scoring profile."
                )
            return basis

    # Default cascade (no explicit basis on the card). All profiles are
    # DETERMINISTIC — neural metrics are never in a composite (reported separately):
    #   1. no-reference when this run has NO gold reference (reference-based
    #      metrics can't be computed; uses FST + behavioral deterministic signals).
    #   2. fst-coverage when an FST actually scored this run.
    #   3. surface-only otherwise.
    if not has_references:
        return "no-reference"
    if fst_ran:
        return "fst-coverage"
    return "surface-only"


# ---------------------------------------------------------------------------
# Public API — FST Install Info
#
# These functions query the 'resources.fsts[0].install' field on language
# cards.  They replace the hardcoded GIELLALT_FST_REGISTRY that previously
# lived in plugins/fst_installer.py.  The SSOT is now the language card
# JSON files, enriched in Phase 4 of the SSOT migration.
# ---------------------------------------------------------------------------

def get_fst_install_info(code: str) -> dict[str, Any] | None:
    """Get FST install metadata for a language, if any.

    Reads the first entry in ``resources.fsts[]`` and returns its
    ``install`` sub-object.  Returns None if the card doesn't exist,
    has no ``resources.fsts``, or has no ``install`` block.

    The returned dict has the shape::

        {
            "repo":          "giellalt/lang-crk",
            "format":        "giellalt-nightly-apt",
            # -- giellalt-nightly-apt (the CURRENT GiellaLT channel) --
            "aptPool":       "https://apertium.projectjj.com/apt/nightly/pool/main/g/giella-crk/",
            "debFile":       "giella-crk_0.2.0+g4278~e1f96fea-1~sid1_all.deb",  # the pin
            "debSha256":     "de10b471...",           # verified before extraction
            "langCommit":    "e1f96fea...",           # upstream source commit
            "include":       ["crk-strict-analyzer-giellaltbuild.hfstol", ...],
            "stripSuffix":   "-giellaltbuild",
            # -- legacy-zip / divvun-macos-pkg --
            "releaseTag":    "fst-v2021.7.8",         # optional
            "assetPattern":  "plains-cree-fsts-",      # optional
            "bundlePattern": "no.divvun...",            # optional (divvun-macos-pkg)
            "maturity":      "production"               # optional
        }

    ⚠️ ``releaseTag`` is a POINT IN TIME, not "latest". GitHub Releases is not
    GiellaLT/ALTLab's distribution channel — they ship continuously and their
    release tags are vestigial. crk sat on a 2021 tag for five years; see
    ``plugins/fst_installer.py`` for what that cost.

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        Install metadata dict, or None if no FST install info exists.
    """
    card = get_card(code)
    if card is None:
        return None

    resources = card.get("resources")
    if not resources or not isinstance(resources, dict):
        return None

    fsts = resources.get("fsts")
    if not fsts or not isinstance(fsts, list) or len(fsts) == 0:
        return None

    install = fsts[0].get("install")
    if not install or not isinstance(install, dict):
        return None

    return install


# ---------------------------------------------------------------------------
# Public API — Eval Pack Requirements
#
# Eval packs declare the Python dependencies, FST requirements, and
# post-install steps needed to evaluate a specific language. The SSOT
# is the `evalPack` field on each language card. The harness reads this
# generically — no language-specific code needed.
# ---------------------------------------------------------------------------

def get_eval_pack(code: str) -> dict[str, Any] | None:
    """Get eval pack requirements for a language, if any.

    Reads the ``evalPack`` field from the language card. Returns None if
    the card doesn't exist or has no eval pack defined.

    The returned dict has the shape::

        {
            "pythonDeps": {
                "pyhfst": "pyhfst>=1.4",
                "requests": "requests>=2.28"
            },
            "postInstall": [
                {"command": "spacy download en_core_web_md", "label": "..."}
            ],
            "requiresFst": true,
            "description": "Human-readable description"
        }

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        Eval pack dict, or None if no eval pack is defined.
    """
    card = get_card(code)
    if card is None:
        return None
    return card.get("evalPack")


def get_eval_metrics(code: str) -> dict[str, Any] | None:
    """Get language-specific evaluation metrics declared on the card.

    Reads the ``evalMetrics`` field from the language card. Returns None if
    the card doesn't exist or has no eval metrics defined.

    The returned dict maps metric short names to their declarations::

        {
            "lyss-eq": {
                "module": "champollion_lyss.crk.metrics",
                "class": "CrkLinterMetric",
                "description": "LYSS deterministic variant-class equivalence linter"
            },
            "lyss-sem": {
                "module": "champollion_lyss.crk.metrics",
                "class": "CrkSemanticMetric",
                "dependencies": ["spacy>=3.7"],
                "spacy_models": ["en_core_web_md"],
                "description": "LYSS FST-based semantic validator"
            }
        }

    ``module`` is a FULL importable path into an EXTERNAL eval-standard package
    (the harness core ships no language-specific scorer code). The package is
    fetched on demand via the card's ``evalStandard`` (see get_eval_standard and
    plugin_discovery._ensure_eval_standard_installed) — no hardcoded language
    knowledge in the harness.

    Args:
        code: Language code (any format — resolved via resolve_code).

    Returns:
        Dict of metric declarations, or None if no eval metrics defined.
    """
    card = get_card(code)
    if card is None:
        return None
    return card.get("evalMetrics")


def get_eval_standard(code: str) -> dict[str, Any] | None:
    """Get the external eval-standard package declaration for a language.

    Reads the ``evalStandard`` field — how to fetch the package that PROVIDES
    this language's ``evalMetrics`` (e.g. ``champollion-lyss`` for Cree). The
    harness core ships NO language-specific scorer code; it installs the declared
    package on demand (by design: auto-fetch like FSTs/COMET).

    Shape::

        {
            "package": "champollion-lyss",
            "import":  "champollion_lyss",
            "pip":     "champollion-lyss @ git+https://github.com/.../champollion-LYSS.git@main",
            "description": "..."
        }

    Returns the dict, or None when the card declares no external eval standard
    (its evalMetrics modules are then expected to be importable already).
    """
    card = get_card(code)
    if card is None:
        return None
    return card.get("evalStandard")


# Public name for the ONE Python card adapter. External callers (forge,
# corpora-builder, audit scripts) import this rather than the underscored
# internal, so the adapter surface is a declared API, not a reach-in.
normalize_card = _normalize_card
