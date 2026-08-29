"""SSOT language-card discovery — forge's answer to "what does this language
actually have to work with?", for any of the ~7,900 cards.

The cards (``cli/shared/language-cards/*.json`` in the Champollion monorepo)
are the single source of truth for language PROPERTIES and resource
EXISTENCE. forge reads them — never writes them (the language-card boundary
invariant: measured run results are FORBIDDEN on cards) — and turns one card
into a :class:`ResourceReport`: an honest inventory an amateur and their
agent can act on.

Honesty rules, non-negotiable:
- **absence is UNKNOWN, never zero** — a card without a phonology block does
  not mean the language has no phonology; the report says "unknown";
- everything cites its card field path, so claims are checkable;
- eval datasets are cross-checked against the mt-eval registry's
  ``do_not_train``/``quarantine``/``contamination`` flags when the registry
  is reachable (and say so when it isn't).

The report ends in an **asset-ladder verdict** — the same tool for a
179-corpus language with no analyzer (French), a nearly-bare card (Navajo),
an RTL analyzer language (Arabic), or a polysynthetic language with an FST
and its own LYSS referee (Plains Cree):

    rung 1  parallel text        → train with every guard (no pack needed)
    rung 2  + monolingual text   → the tagged backtranslation lane
    rung 3  + dictionary+grammar → a template pack is worth building (cited)
    rung 4  + morph. analyzer    → round-trip-VERIFIED synthesis
    rung 5  + LYSS referee       → the language's own metric in scoring
                                   and checkpoint selection
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from .errors import ResourceMissing

ENV_VAR = "CHAMPOLLION_CARDS_DIR"


def cards_dir(explicit: str | Path | None = None) -> Path:
    """Locate the language-cards directory: explicit → $CHAMPOLLION_CARDS_DIR
    → monorepo walk-up (forge/ is a sibling of cli/).

    An EXPLICIT path that doesn't hold cards is an error, not a fallback —
    the user pointed somewhere specific; silently reading a different SSOT
    would be worse than failing."""
    if explicit:
        cand = Path(explicit)
        if cand.is_dir() and any(cand.glob("*.json")):
            return cand
        raise ResourceMissing(
            f"no language cards at the given path: {cand}",
            how_to_get=f"point at a checkout's cli/shared/language-cards, or "
                       f"omit the path to use ${ENV_VAR} / the monorepo walk-up",
        )
    candidates = []
    env = os.environ.get(ENV_VAR)
    if env:
        candidates.append(Path(env))
    candidates.append(
        Path(__file__).resolve().parents[2] / "cli" / "shared" / "language-cards"
    )
    for cand in candidates:
        if cand.is_dir() and any(cand.glob("*.json")):
            return cand
    raise ResourceMissing(
        "language-cards directory not found",
        how_to_get=f"set ${ENV_VAR} to a checkout's cli/shared/language-cards "
                   "(the Champollion monorepo SSOT), or run from inside the "
                   "monorepo",
    )


def load_card(code: str, cards_path: str | Path | None = None) -> dict:
    """Load one card by ISO 639-3 code; on a miss, suggest near codes."""
    directory = cards_dir(cards_path)
    path = directory / f"{code}.json"
    if not path.is_file():
        near = sorted(
            p.stem for p in directory.glob(f"{code[:2]}*.json")
        )[:8]
        raise ResourceMissing(
            f"no language card for {code!r}",
            how_to_get="cards are keyed by ISO 639-3 INDIVIDUAL codes (a "
                       "macrolanguage like 'zho' resolves to members like "
                       "'cmn'). "
                       + (f"Near codes here: {', '.join(near)}" if near
                          else "Check the code on the card index."),
        )
    # Every full card goes through the ONE Python adapter (the harness's
    # language_cards.normalize_card) — same seam as the JS reader. Atlas cards
    # carry attribution envelopes and renamed fields that a bare json.loads
    # misreads; old-shape cards pass through the adapter untouched.
    from . import _harness

    return _harness.language_cards_mod().normalize_card(
        json.loads(path.read_text(encoding="utf-8"))
    )


@dataclass
class ResourceReport:
    code: str
    name: str
    card_path: str
    family: str | None = None
    direction: str | None = None            # ltr | rtl | unknown
    scripts: list[dict] = field(default_factory=list)
    orthographic_status: str | None = None
    orthographies: list[dict] = field(default_factory=list)  # F5: structured conventions
    analyzers: list[dict] = field(default_factory=list)   # morphological analyzers
    other_fsts: list[dict] = field(default_factory=list)  # tokenizers, spellcheckers…
    dictionaries: list[dict] = field(default_factory=list)
    grammars: list[dict] = field(default_factory=list)     # F5: MED citation records
    opus: dict | None = None
    corpora: list[dict] = field(default_factory=list)
    eval_datasets: list[dict] = field(default_factory=list)
    referee: dict | None = None             # LYSS lanes (evalMetrics/evalStandard)
    typology_hints: dict = field(default_factory=dict)
    unknowns: list[str] = field(default_factory=list)
    registry_note: str | None = None
    metric_trust: dict | None = None       # WMT meta-eval reliability, or None

    def ladder(self) -> list[tuple[int, bool | None, str]]:
        """(rung, attained?, one-liner). ``None`` = unknown, honestly."""
        has_parallel = None
        if self.opus is not None or self.corpora:
            has_parallel = bool(
                (self.opus or {}).get("corpora") or
                any(c.get("type") == "parallel" for c in self.corpora)
            )
        has_mono = (any(c.get("type") == "monolingual" for c in self.corpora)
                    or None)
        return [
            (1, has_parallel,
             "parallel text → train with every guard (no pack needed)"),
            (2, has_mono,
             "monolingual text → the tagged backtranslation lane"),
            (3, bool(self.dictionaries or self.grammars) or None,
             "dictionary (+ a published grammar) → a cited template pack is "
             "worth building"),
            (4, bool(self.analyzers) or None,
             "morphological analyzer → round-trip-VERIFIED synthesis"),
            (5, bool(self.referee) or None,
             "LYSS referee → the language's own metric in scoring and "
             "checkpoint selection"),
        ]

    def plugin_specs(self) -> list[str]:
        """Ready-to-use ``module:Class`` specs from the card's evalMetrics."""
        if not self.referee:
            return []
        out = []
        for entry in self.referee.get("metrics", {}).values():
            module, cls = entry.get("module"), entry.get("class")
            if module and cls:
                out.append(f"{module}:{cls}")
        return out

    def canonical_orthography(self) -> dict | None:
        """The orthographies[] entry the card marks canonicalForMt, or None.

        This is the working form canon_chars normalization should target
        (e.g. crk: Latn/SRO with circumflex long vowels, NOT the primary
        display script). None = the card doesn't say — unknown, never a
        default."""
        for o in self.orthographies:
            if o.get("canonicalForMt") is True:
                return o
        return None


def _reliability_index() -> dict | None:
    """The WMT meta-eval metric-reliability index (monorepo SSOT), or None.

    Same walk-up posture as the cards: this is dev/monorepo data; a
    standalone install simply reports "reliability index unavailable"."""
    env = os.environ.get("CHAMPOLLION_SHARED_DIR")
    candidates = []
    if env:
        candidates.append(Path(env) / "catalogue" / "metric-reliability.json")
    candidates.append(Path(__file__).resolve().parents[2] / "shared"
                      / "catalogue" / "metric-reliability.json")
    for cand in candidates:
        if cand.is_file():
            try:
                return json.loads(cand.read_text(encoding="utf-8"))
            except Exception:
                return None
    return None


def metric_trust(code: str, family: str | None = None) -> dict | None:
    """Which automatic metrics track HUMAN judgment for this language?

    Resolves the language (or its family) in the WMT meta-eval reliability
    index and returns per-metric system-level correlations, or an explicit
    UNMEASURED answer. None when the index itself is unavailable. Research-
    lane evidence (upstream license under review) — never cite commercially.
    """
    index = _reliability_index()
    if index is None:
        return None
    langs = index.get("languages") or {}
    fams = index.get("families") or {}
    fam_name = None
    for key, rec in langs.items():
        if key == code or (rec or {}).get("iso639_3") == code:
            fam_name = (rec or {}).get("family")
            break
    if fam_name is None and family and family in fams:
        fam_name = family
    if fam_name is None or fam_name not in fams:
        return {"status": "unmeasured", "family": fam_name or family,
                "note": "no WMT campaign ever judged this language/family — "
                        "no automatic metric is validated here; chrF++ is "
                        "the convention and CIs still apply"}
    fam = fams[fam_name]
    metrics = {}
    for m, rec in (fam.get("metrics") or {}).items():
        sys_block = (rec or {}).get("sys") or {}
        r = next((sys_block[k] for k in
                  ("pearson_weighted_mean", "pearson_r", "r", "correlation")
                  if isinstance(sys_block.get(k), (int, float))), None)
        if r is not None:
            metrics[m] = round(float(r), 3)
    return {"status": "measured", "family": fam_name,
            "n_pairs": fam.get("n_pairs"), "metrics": metrics,
            "note": "research-lane evidence — never cite in commercial claims"}


def _registry_flags(ids: list[str]) -> tuple[dict[str, dict], str | None]:
    if not ids:
        return {}, None
    try:
        from . import _harness

        _harness.load_harness()
        from mt_eval_harness.config import load_registry

        by_id = {e.get("id"): e for e in load_registry().get("datasets", [])}
    except Exception as e:
        return {}, (f"mt-eval registry unreachable ({type(e).__name__}) — "
                    "do_not_train/quarantine flags NOT verified")
    flags = {}
    for did in ids:
        e = by_id.get(did)
        flags[did] = ({"do_not_train": e.get("do_not_train"),
                       "quarantine": bool(e.get("quarantine")),
                       "contamination": e.get("contamination")}
                      if e else {"note": "id not in registry"})
    return flags, None


def _load_raw_card(code):
    import json as _json, os as _os
    from pathlib import Path as _P
    d = _os.environ.get("CHAMPOLLION_CARDS_DIR")
    roots = [_P(d)] if d else []
    here = _P(__file__).resolve()
    roots += [here.parents[i] / "cli" / "shared" / "language-cards"
              for i in range(2, min(5, len(here.parents)))]
    for r in roots:
        p = r / f"{code}.json"
        try:
            return _json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
    return None


_SCRIPT_RTL_CACHE = None


def _direction_of(card):
    """dir, or a cited derivation of it — never a default.

    Order: the card's own dir; the per-locale CLDR orientation claim
    (textDirection); the SCRIPT's direction from CLDR's pinned scriptMetadata
    (`Arab` runs right-to-left is a fact about the script). Absent all three,
    absent — only 162 languages have a locale-level claim and defaulting the
    rest would fabricate a fact.
    """
    d = card.get("dir")
    if isinstance(d, str):
        return d
    td = card.get("textDirection")
    if isinstance(td, str):
        return {"left-to-right": "ltr", "right-to-left": "rtl"}.get(td)
    script = card.get("script")
    if not script:
        tag = card.get("bcp47FullTag")
        if isinstance(tag, dict):
            tag = tag.get("consensus") or (tag.get("values") or [{}])[0].get("value")
        if isinstance(tag, str):
            import re as _re
            m = _re.match(r"^[a-z]{2,3}-([A-Z][a-z]{3})\b", tag)
            if m:
                script = m.group(1)
    if not script:
        return _direction_via_cldr_equivalence(card)
    global _SCRIPT_RTL_CACHE
    if _SCRIPT_RTL_CACHE is None:
        _SCRIPT_RTL_CACHE = {}
        import json as _json
        from pathlib import Path as _P
        here = _P(__file__).resolve()
        for root in [here.parents[i] for i in range(2, min(6, len(here.parents)))]:
            c = root / "cli" / "data" / "cldr-supplemental" / "scriptMetadata.json"
            try:
                m = _json.loads(c.read_text(encoding="utf-8"))["scriptMetadata"]
                _SCRIPT_RTL_CACHE = {k: v.get("rtl") == "YES" for k, v in m.items()}
                break
            except (OSError, ValueError, KeyError):
                continue
    if script in _SCRIPT_RTL_CACHE:
        return "rtl" if _SCRIPT_RTL_CACHE[script] else "ltr"
    return _direction_via_cldr_equivalence(card)


def _direction_via_cldr_equivalence(card):
    """CLDR's alias table declares this code EQUIVALENT to its macrolanguage
    tag (the macrolanguage card carries canonicalisedMembers pointing back
    here — arb⇔ar). Reading the direction CLDR asserted for the canonical tag
    through CLDR's own equivalence is two citations chained, not macrolanguage
    propagation: no other member gains anything.
    """
    macro = card.get("macrolanguage")
    if not macro:
        return None
    mc = _load_raw_card(macro)
    cm = (mc or {}).get("canonicalisedMembers") or (mc or {}).get("canonicalisedMember")
    if isinstance(cm, dict):
        cm = cm.get("consensus")
    if mc and cm == card.get("code"):
        td = mc.get("textDirection")
        if isinstance(td, str):
            return {"left-to-right": "ltr", "right-to-left": "rtl"}.get(td)
    return None


_EVAL_CFG_CACHE = None


def _eval_config_datasets(code):
    """evalDatasets per language from shared/catalogue/card-config.json."""
    global _EVAL_CFG_CACHE
    if _EVAL_CFG_CACHE is None:
        _EVAL_CFG_CACHE = {}
        import json as _json
        from pathlib import Path as _P
        here = _P(__file__).resolve()
        for root in [here.parents[i] for i in range(2, min(6, len(here.parents)))]:
            for c in (root / "shared" / "catalogue" / "card-config.json",
                      root / "cli" / "shared" / "catalogue" / "card-config.json"):
                try:
                    data = _json.loads(c.read_text(encoding="utf-8"))
                    _EVAL_CFG_CACHE = {k: v
                                       for k, v in data.get("evalConfig", {}).items()
                                       if not k.startswith("_")}
                    e = _EVAL_CFG_CACHE.get(code) or {}
                    return e.get("evalDatasets")
                except (OSError, ValueError):
                    continue
    e = (_EVAL_CFG_CACHE.get(code) or {}) if code else {}
    return e.get("evalDatasets")


def _eval_config_entry(code):
    """The full evalConfig entry, ensuring the cache is populated."""
    _eval_config_datasets(code)
    return (_EVAL_CFG_CACHE or {}).get(code)


def discover(code: str, cards_path: str | Path | None = None,
             check_registry: bool = True) -> ResourceReport:
    """One card → an honest, actionable resource inventory."""
    directory = cards_dir(cards_path)
    card = load_card(code, directory)
    from . import _harness

    report = ResourceReport(
        code=code,
        name=card.get("name") or code,
        card_path=str(directory / f"{code}.json"),
        # family moved to classification.family at the atlas cutover (the old
        # top-level field is always absent now) and may be an attribution
        # envelope. Consensus-only display: forge REPORTS family, so a
        # disputed one is None → rendered "unknown" — absence over election.
        family=_harness.language_cards_mod().display(
            (card.get("classification") or {}).get("family")
        ),
        direction=_direction_of(card),
        scripts=list(card.get("scripts") or []),
        orthographic_status=card.get("orthographicStatus"),
    )

    # resources is the keyed object on current cards; a stale local card tree
    # may still carry the pre-2026-07-12 flat array — treat that as silent.
    res = card.get("resources")
    res = res if isinstance(res, dict) else {}

    report.orthographies = [
        o for o in (card.get("orthographies") or []) if isinstance(o, dict)
    ]

    fsts = res.get("fsts") or []
    for f in fsts:
        entry = {k: f.get(k) for k in
                 ("name", "type", "technology", "url", "license", "install")
                 if f.get(k) is not None}
        # Atlas-shaped entries carry {name, url, publisher} and no `type` —
        # the parameter they came from IS "finite-state morphological
        # analyser" (fstResource), so the type is the field's meaning, not a
        # guess, and the repo pointer is the url.
        if "type" not in f and f.get("publisher") and f.get("url"):
            entry["type"] = "morphological-analyzer"
            entry.setdefault("install", {"repo": f["url"]})
        (report.analyzers if entry.get("type") == "morphological-analyzer"
         else report.other_fsts).append(entry)

    # F5 schematized path first (carries machineReadable/redistributable);
    # free-form encyclopedic block as fallback for stale card trees.
    sch_dicts = res.get("dictionaries") or []
    if sch_dicts:
        report.dictionaries = [
            {**d, "_field": "resources.dictionaries"}
            for d in sch_dicts if isinstance(d, dict)
        ]
    else:
        enc_dicts = (((card.get("encyclopedic") or {}).get("resources") or {})
                     .get("dictionaries") or [])
        report.dictionaries = [
            {**d, "_field": "encyclopedic.resources.dictionaries"}
            for d in enc_dicts if isinstance(d, dict)
        ]

    report.grammars = [
        g for g in (res.get("grammars") or []) if isinstance(g, dict)
    ]

    report.opus = (card.get("corpusAvailability") or {}).get("opus")
    if report.opus is None:
        # Atlas cards carry the OPUS attestations themselves under
        # resources.corpora — one entry per corpus, each with the publisher's
        # own pair and alignment counts. The summary the old field held is a
        # count over them, OURS by the same rule every derived count follows.
        res_obj = card.get("resources")
        # The stale flat-array resources shape stays SILENT, not a crash — the
        # tolerance this file already promises two hundred lines up.
        res_corpora = res_obj.get("corpora") if isinstance(res_obj, dict) else None
        atlas_corpora = [c for c in (res_corpora or [])
                         if isinstance(c, dict)
                         and str(c.get("corpusId", "")).startswith("corpus:opus:")]
        if atlas_corpora:
            report.opus = {
                "corpora": len(atlas_corpora),
                "corpusNames": [c.get("corpus") for c in atlas_corpora],
                "totalAlignmentPairs": sum(c.get("alignmentPairsTotal") or 0
                                           for c in atlas_corpora),
            }
    report.corpora = [
        {k: c.get(k) for k in ("name", "type", "url", "exposure", "license")
         if c.get(k) is not None}
        for c in (res.get("corpora") or [])
    ]

    ids = list(card.get("evalDatasets") or [])
    if not ids:
        # Atlas cards carry no eval wiring — that is OURS (gate 3), declared
        # in the shared config kernel and attached at read time, same as the
        # arena runtime does.
        ids = list(_eval_config_datasets(card.get("code")) or [])
    flags, note = _registry_flags(ids) if check_registry else ({}, "not checked")
    report.registry_note = note
    report.eval_datasets = [{"id": i, **flags.get(i, {})} for i in ids]

    if not card.get("evalMetrics"):
        # Same kernel, same reason as evalDatasets above: the LYSS referee
        # wiring is OUR configuration, attached at read time on atlas cards.
        _ev = _eval_config_entry(card.get("code"))
        if _ev:
            for k in ("evalMetrics", "evalStandard"):
                if _ev.get(k) and not card.get(k):
                    card[k] = _ev[k]
    if card.get("evalMetrics"):
        report.referee = {
            "metrics": card["evalMetrics"],
            "package": (card.get("evalStandard") or {}).get("pip")
                       or (card.get("evalStandard") or {}).get("package"),
            "requires_fst": (card.get("evalPack") or {}).get("requiresFst"),
        }

    tp = card.get("typologicalProfile") or {}
    enc_typ = (card.get("encyclopedic") or {}).get("typology") or {}
    for key, value, src in (
        ("morphological_synthesis", tp.get("morphologicalSynthesis"),
         "typologicalProfile.morphologicalSynthesis (champollion-derived)"),
        ("inflectional_strategy", tp.get("inflectionalStrategy"),
         "typologicalProfile.inflectionalStrategy"),
        ("verb_synthesis", enc_typ.get("verbSynthesis"),
         "encyclopedic.typology.verbSynthesis"),
        ("noun_incorporation", enc_typ.get("nounIncorporation"),
         "encyclopedic.typology.nounIncorporation"),
    ):
        if value is not None:
            report.typology_hints[key] = {"value": value, "source": src}

    report.metric_trust = metric_trust(code, report.family)

    # absence is UNKNOWN — name what the card simply doesn't say
    for label, present in (
        ("scripts", bool(report.scripts)),
        ("analyzers", bool(fsts)),
        ("dictionaries", bool(report.dictionaries)),
        ("grammars", bool(report.grammars)),
        ("corpora", report.opus is not None or bool(report.corpora)),
        ("eval datasets", bool(ids)),
        ("typology", bool(report.typology_hints)),
    ):
        if not present:
            report.unknowns.append(label)
    return report


def format_report(report: ResourceReport) -> str:
    """Amateur-readable rendering: inventory → ladder → next actions."""
    lines = [f"{report.name} ({report.code})"
             + (f" · {report.family}" if report.family else "")
             + (f" · {report.direction}" if report.direction else "")]
    lines.append(f"card: {report.card_path}")
    lines.append("")

    lines.append("WHAT THE CARD SAYS EXISTS (absence = unknown, not zero):")
    if report.scripts:
        s = ", ".join(f"{x.get('name', x.get('code'))}"
                      + (" [primary]" if x.get("primary") else "")
                      for x in report.scripts)
        lines.append(f"  scripts: {s}"
                     + (f" · orthography: {report.orthographic_status}"
                        if report.orthographic_status else ""))
    for o in report.orthographies:
        bits = [o.get("script", "?")]
        if o.get("scheme"):
            bits.append(o["scheme"])
        if o.get("longVowelMarking"):
            bits.append(f"long vowels: {o['longVowelMarking']}")
        line = f"  orthography: {' · '.join(bits)}"
        if o.get("canonicalForMt") is True:
            line += "  ← CANONICAL working form (normalize into this)"
        elif o.get("canonicalForMt") is False:
            line += "  (display form, not the working form)"
        lines.append(line)
    for a in report.analyzers:
        inst = a.get("install") or {}
        lines.append(f"  analyzer: {a.get('name')}"
                     + (f" (fetch: {inst.get('repo')}@{inst.get('releaseTag')})"
                        if inst.get("repo") else ""))
    for f in report.other_fsts:
        lines.append(f"  other tool: {f.get('name')} ({f.get('type')}) — not a "
                     "morphological analyzer")
    for d in report.dictionaries:
        lines.append(f"  dictionary: {d.get('name')} — {d.get('url', '')}"
                     + ("  [POINTER-ONLY: content not redistributable — "
                        "fetch from source, never copy]"
                        if d.get("redistributable") is False else ""))
    for g in report.grammars:
        cite = " ".join(str(p) for p in
                        (g.get("author"), f"({g['year']})." if g.get("year")
                         else None, g.get("title")) if p)
        lines.append(f"  grammar: {cite}"
                     + (f" — {g['url']}" if g.get("url") else ""))
    if report.opus:
        lines.append(f"  OPUS: {report.opus.get('corpora')} corpora, "
                     f"{report.opus.get('totalAlignmentPairs', '?')} aligned pairs")
    for c in report.corpora:
        lines.append(f"  corpus: {c.get('name')} ({c.get('type')}"
                     + (f", exposure: {c.get('exposure')}" if c.get("exposure") else "")
                     + ")")
    if report.eval_datasets:
        lines.append(f"  eval datasets ({len(report.eval_datasets)}):")
        for e in report.eval_datasets[:6]:
            flag = ("NEVER TRAIN ON THIS" if e.get("do_not_train")
                    else "quarantined" if e.get("quarantine")
                    else e.get("note", ""))
            lines.append(f"    {e['id']}"
                         + (f" — {flag}" if flag else "")
                         + (f" (contamination: {e['contamination']})"
                            if e.get("contamination") else ""))
        if len(report.eval_datasets) > 6:
            lines.append(f"    … and {len(report.eval_datasets) - 6} more")
    if report.registry_note:
        lines.append(f"  ⚠ {report.registry_note}")
    if report.referee:
        lines.append(f"  LYSS referee: {report.referee.get('package')} — plugin "
                     "lanes for scoring AND checkpoint selection:")
        for spec in report.plugin_specs():
            lines.append(f"    --plugin {spec}")
    for k, v in report.typology_hints.items():
        lines.append(f"  typology: {k} = {v['value']}  [{v['source']}]")
    if report.metric_trust is None:
        lines.append("  metric trust: reliability index unavailable — "
                     "chrF++ is the convention; CIs still apply")
    elif report.metric_trust["status"] == "unmeasured":
        lines.append(f"  metric trust: UNMEASURED — {report.metric_trust['note']}")
    else:
        mt = report.metric_trust
        pairs = ", ".join(f"{m} r={r}" for m, r in
                          sorted(mt["metrics"].items(), key=lambda kv: -kv[1]))
        lines.append(f"  metric trust ({mt['family']}, WMT meta-eval): {pairs}")
        lines.append("    → prefer high-r metrics for checkpoint selection; "
                     "research-lane evidence only")
    if report.unknowns:
        lines.append(f"  unknown (card is silent): {', '.join(report.unknowns)}")
    lines.append("")

    lines.append("THE ASSET LADDER — what this language can do TODAY:")
    for rung, attained, text in report.ladder():
        mark = "✓" if attained else ("?" if attained is None else "✗")
        lines.append(f"  {mark} rung {rung}: {text}")
    lines.append("")

    lines.append("NEXT ACTIONS:")
    lines.append("  1. get a parallel corpus locally (fetch from its source — "
                 "forge never hosts corpus content)")
    lines.append("  2. nmt-forge split <corpus> --test N --dev M --seed S "
                 "--out data/split --register project")
    lines.append("  3. nmt-forge init " + report.code + " — scaffold a run "
                 "config from this card, then: nmt-forge run config.json")
    if not report.analyzers:
        lines.append("  note: no morphological analyzer on the card → verified "
                     "synthesis is off the menu until one exists; every guard "
                     "and the training loop work regardless")
    return "\n".join(lines)
