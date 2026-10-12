"""SSOT language-card discovery — forge's answer to "what does this language
actually have to work with?", for any of the ~7,900 cards.

The cards are the single source of truth for language PROPERTIES and
resource EXISTENCE. forge never finds them itself: it asks the eval
harness's resolver (``mt_eval_harness.language_cards`` — the same one
``mt-eval`` uses), so a plain ``python3 -m pip install nmt-forge`` works anywhere:
``--cards-dir`` → ``$MT_EVAL_CARDS_DIR``/``$CHAMPOLLION_CARDS_DIR`` → a
checkout or ``node_modules/champollion`` above the working directory → the
public card index (cached; reused offline). Every card passes through the
harness adapter (``normalize_card``/``display``) — never a bare json.loads.
forge reads cards — never writes them (the language-card boundary invariant:
measured run results are FORBIDDEN on cards) — and turns one card into a
:class:`ResourceReport`: an honest inventory an amateur and their agent can
act on.

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

import copy
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from .errors import ResourceMissing

ENV_VAR = "CHAMPOLLION_CARDS_DIR"      # alias the harness also honors
HARNESS_ENV_VAR = "MT_EVAL_CARDS_DIR"  # the harness's canonical name

# One sentence an amateur (or a weak agent) can act on, wherever forge was
# installed from. Shared by every "no card" refusal below.
HOW_TO_GET_CARDS = (
    "forge reads language cards through the eval harness's own resolver, in "
    "this order: --cards-dir DIR → $MT_EVAL_CARDS_DIR (or "
    "$CHAMPOLLION_CARDS_DIR) → a Champollion checkout or "
    "node_modules/champollion above your working directory → the public card "
    "index (fetched on first use, cached for a day under ~/.mt-eval, reused "
    "when offline). Offline with no cache yet? Export the one card you need "
    "with the champollion CLI and point at it: `mkdir -p cards && npx "
    "champollion network card <code> --json > cards/<code>.json`, then pass "
    "--cards-dir cards"
)


def _lc():
    """The harness's language_cards module — the ONE Python card adapter
    and resolver. forge never re-implements card discovery."""
    from . import _harness

    return _harness.language_cards_mod()


def _dir_holds_cards(cand: Path) -> bool:
    return cand.is_dir() and any(cand.glob("*.json"))


def _env_cards_dir() -> tuple[str, Path] | None:
    for var in (HARNESS_ENV_VAR, ENV_VAR):
        val = os.environ.get(var)
        if val:
            return var, Path(val).expanduser()
    return None


def cards_dir(explicit: str | Path | None = None) -> Path | None:
    """The LOCAL language-cards directory in use, or None when cards come
    from the public card index (a standalone ``pip install`` far from any
    checkout).

    Order: explicit → $MT_EVAL_CARDS_DIR / $CHAMPOLLION_CARDS_DIR → the
    harness's own discovery (monorepo, working-directory walk-up,
    ``node_modules/champollion``) → None (remote index).

    An EXPLICIT path — argument or environment variable — that doesn't hold
    cards is an error, not a fallback: the user pointed somewhere specific;
    silently reading a different SSOT would be worse than failing.
    """
    if explicit:
        cand = Path(explicit).expanduser()
        if _dir_holds_cards(cand):
            return cand
        raise ResourceMissing(
            f"no language cards at the given path: {cand}",
            how_to_get=f"point --cards-dir at a directory of <code>.json cards "
                       f"(a checkout's cli/shared/language-cards, or cards "
                       f"exported with `champollion network card <code> --json`), or "
                       f"omit it to use ${HARNESS_ENV_VAR} / ${ENV_VAR} / the "
                       f"public card index",
        )
    env = _env_cards_dir()
    if env is not None:
        var, cand = env
        if _dir_holds_cards(cand):
            return cand
        raise ResourceMissing(
            f"${var}={cand} holds no language cards",
            how_to_get=f"point ${var} at a directory of <code>.json cards, or "
                       f"unset it to let forge use the public card index",
        )
    from . import _harness

    remote = _harness.language_cards_remote_mod()
    try:
        return _lc().get_cards_dir()
    except remote.LanguageCardsUnavailable as e:
        raise ResourceMissing(
            f"no language-card index is reachable: {e}",
            how_to_get=HOW_TO_GET_CARDS,
        ) from e


def is_private_use(code) -> bool:
    """ISO 639-3 reserves ``qaa``–``qtz`` for local (private) use: a code
    no registry assigns, so no language card can exist for it. The guide
    recommends one while the community has not yet confirmed which variety
    it speaks."""
    c = str(code or "").strip().lower()
    return (len(c) == 3 and c.isascii() and c.isalpha() and c[0] == "q"
            and "a" <= c[1] <= "t")


def private_use_note(code: str) -> str:
    """What a private-use code costs, and how to move to the real code
    later — said by discover, init --no-card and NEXT_STEPS.md alike."""
    return (
        f"forge knows nothing about this language: no card facts (script, "
        "direction, family), no FST (nothing checks words), no prior results "
        "(published benchmarks and corpora are keyed by real codes). When "
        "the community confirms the variety and its ISO 639-3 code, `nmt-"
        "forge discover <code>` shows what its card holds; then run `nmt-"
        "forge init <code>` (with the same --model) in the project "
        "directory: it rewrites "
        "config.json and NEXT_STEPS.md for the real code (re-apply any edits "
        "you made to config.json; .forge/ — your registered sets, "
        "preregistrations and runs — is kept), and the next run trains "
        f"under that code. A model already exported under {code} keeps "
        f"{code}")


def _sentence(text: str) -> str:
    text = text.strip()
    return text if text.endswith((".", "!", "?")) else text + "."


def _near_codes(code: str, known) -> list[str]:
    if is_private_use(code):
        return []          # a private-use code is never a misspelling
    prefix = code[:2]
    return sorted(c for c in known if isinstance(c, str)
                  and c.startswith(prefix) and "-" not in c)[:8]


def _missing_card(code: str, near: list[str]) -> ResourceMissing:
    if is_private_use(code):
        # Round 8 hospital persona: `discover qaa` answered "Near codes:
        # qahv1234" — a Glottolog code with nothing to do with the language
        return ResourceMissing(
            f"{code!r} is an ISO 639-3 private-use code (qaa–qtz are "
            "reserved for local use) — no language card exists for it, and "
            "it is not a misspelling, so there are no near codes to suggest",
            how_to_get=(
                f"train anyway: `nmt-forge init {code} --no-card --name "
                "'<Language name>'` scaffolds the project without a card "
                "(everything a card would say is then unknown). "
                + _sentence(private_use_note(code))),
        )
    return ResourceMissing(
        f"no language card for {code!r}",
        how_to_get="cards are keyed by ISO 639-3 INDIVIDUAL codes (a "
                   "macrolanguage like 'zho' resolves to members like "
                   "'cmn'). "
                   + (f"Near codes: {', '.join(near)}. " if near
                      else "Check the code on the card index. ")
                   + "A language the index doesn't have yet can still be "
                     f"trained: `nmt-forge init {code} --no-card --name "
                     "'<Language name>'` scaffolds without a card "
                     "(everything a card would say is then unknown)",
    )


def fst_status(code: str) -> dict | None:
    """Is the language's FST installed HERE — the harness's own look
    (``config.fst_state``: analyzer + pyhfst runtime, the setup command;
    installs nothing; forge has no probe of its own). None when the harness
    pins no FST for the code; ``{"error": …}`` when the check itself failed
    (said, never hidden).

    ``checked_in`` names the Python whose packages were looked at (the one
    nmt-forge runs in): the MCP server's language_overview and forge
    disagreed about pyhfst for crk (Round 13 school persona) — each looks
    in the Python it runs, and the user could not tell which install step
    was really needed."""
    import sys

    try:
        from . import _harness

        _harness.load_harness()
        from mt_eval_harness.config import fst_state
    except Exception as e:          # an older harness: say it was not checked
        return {"error": f"this eval harness cannot check it "
                         f"({type(e).__name__}: {e})",
                "checked_in": sys.executable}
    try:
        st = fst_state(code)
    except Exception as e:
        return {"error": f"the check failed ({type(e).__name__}: {e})",
                "checked_in": sys.executable}
    return None if st is None else {**st, "checked_in": sys.executable}


def no_card_report(code: str, name: str | None = None) -> "ResourceReport":
    """The honest report for a language with NO card: every field unknown,
    nothing invented. Used by ``init --no-card``."""
    report = ResourceReport(
        code=code, name=name or code,
        card_path=("none — ISO 639-3 private-use code (qaa–qtz): no card "
                   "exists for it (initialized with --no-card)"
                   if is_private_use(code) else
                   "none — no language card (initialized with --no-card)"))
    report.unknowns = ["card", "scripts", "analyzers", "dictionaries",
                       "grammars", "corpora", "eval datasets", "typology"]
    return report


# The public card index stores a card in TWO tables: trading_card_detail
# (the blob the harness's remote get_card returns) and trading_card_index
# (one row of identity fields — script, scripts, dir, native name …). The
# champollion CLI builds its card from BOTH (cli/lib/cards/remote.js,
# buildCardFromRemote); the detail blob alone carries no script, so a
# pip-installed forge said "scripts: unknown (card is silent)" for a card the
# CLI and the MCP server show as Latn (a synthetic hospital user, 2026-10).
# Same bridge as the CLI, field for field — index-row values FILL what the
# detail lacks and never overwrite it; no default is invented for an absent
# value (the CLI's `dir || 'ltr'` is deliberately not copied) — and then the
# ONE adapter (normalize_card), exactly as for every other card.
_INDEX_ROW_FIELDS = (
    ("script", "script"), ("scripts", "scripts"), ("dir", "dir"),
    ("native_name", "nativeName"), ("glottocode", "glottocode"),
    ("macroarea", "macroarea"), ("is_isolate", "isIsolate"),
    ("modality", "modality"), ("iso_type", "isoType"),
    ("iso_scope", "isoScope"), ("macrolanguage", "macrolanguage"),
    ("dialect_count", "dialectCount"),
)
_INDEX_ROWS: dict[str, dict | None] = {}


def _fetch_index_row(code: str) -> dict | None:
    """One trading_card_index row through the harness's own remote client
    (its endpoint, anon key, retries and not-JSON detection), or None when
    the index has no row. Raises the harness's LanguageCardsUnavailable on a
    failed read — a failed read is not an empty row."""
    import urllib.parse

    from . import _harness

    remote = _harness.language_cards_remote_mod()
    if not remote.is_valid_card_code(code):
        return None
    if code in _INDEX_ROWS:
        return _INDEX_ROWS[code]
    if hasattr(remote, "fetch_index_row"):   # harness >= the merge fix
        row = remote.fetch_index_row(code)
        _INDEX_ROWS[code] = row
        return row
    params = urllib.parse.urlencode(
        {"select": "*", "code": f"eq.{code}", "limit": "1"})
    try:
        rows = remote._get_json(
            f"{remote._REST_BASE}/trading_card_index?{params}", timeout=15.0)
    except remote.LanguageCardsUnavailable:
        raise
    except Exception as e:
        raise remote.LanguageCardsUnavailable(
            f"could not fetch the card-index row for {code!r} "
            f"({type(e).__name__}: {e})") from e
    row = rows[0] if isinstance(rows, list) and rows else None
    _INDEX_ROWS[code] = row
    return row


def _merge_index_row(card: dict, row: dict | None) -> dict:
    """Fill the identity fields the detail blob lacks from its index row."""
    if not row:
        return card
    for row_key, card_key in _INDEX_ROW_FIELDS:
        value = row.get(row_key)
        if value is None or value == [] or value == "":
            continue
        if card.get(card_key) in (None, [], ""):
            card[card_key] = value
    return card


#: How a card read from the public index names its source (resolve_card).
PUBLIC_INDEX_SOURCE = "public card index"


def resolve_card(code: str, cards_path: str | Path | None = None
                 ) -> tuple[dict, str]:
    """``(card, source)`` for one language — the card normalized through the
    harness adapter, and a human-checkable statement of where it came from
    (a file path, or the public card index)."""
    lc = _lc()
    directory: Path | None
    if cards_path or _env_cards_dir() is not None:
        directory = cards_dir(cards_path)
    else:
        directory = None
    if directory is not None:
        # A directory the user named (flag or env): read the one file, through
        # the adapter. This is also the lane for cards exported with
        # `champollion network card <code> --json`.
        path = directory / f"{code}.json"
        if not path.is_file():
            raise _missing_card(code, _near_codes(
                code, (p.stem for p in directory.glob(f"{code[:2]}*.json"))))
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as e:
            raise ResourceMissing(
                f"{path} is not valid JSON ({e})",
                how_to_get="re-export it: `champollion network card <code> --json > "
                           f"{path}`",
            ) from e
        return lc.normalize_card(raw), str(path)

    # Nothing named: the harness resolves (monorepo / working-directory
    # walk-up / node_modules / public index + cache + offline fallback).
    from . import _harness

    remote = _harness.language_cards_remote_mod()
    try:
        card = lc.get_card(code)
        local_dir = lc.get_cards_dir()
        # near codes are never suggested for a private-use code: skip the
        # whole-index listing they would come from
        known = (lc.get_all_codes()
                 if card is None and not is_private_use(code) else ())
    except remote.LanguageCardsUnavailable as e:
        raise ResourceMissing(
            f"no language-card index is reachable for {code!r}: {e}",
            how_to_get=HOW_TO_GET_CARDS,
        ) from e
    if card is None:
        raise _missing_card(code, _near_codes(code, known))
    # The harness caches resolved cards; forge annotates its copy.
    card = copy.deepcopy(card)
    if local_dir is None:
        # public index: the identity row completes the card (see
        # _INDEX_ROW_FIELDS) BEFORE the adapter derives from it
        try:
            card = _merge_index_row(
                card, _fetch_index_row(card.get("code") or code))
        except remote.LanguageCardsUnavailable as e:
            raise ResourceMissing(
                f"the card index answered for {code!r} but its identity row "
                f"(scripts, direction) could not be read: {e}",
                how_to_get=HOW_TO_GET_CARDS,
            ) from e
    card = lc.normalize_card(card)
    if local_dir is not None:
        source = str(local_dir / f"{card.get('code') or code}.json")
    else:
        source = (f"{PUBLIC_INDEX_SOURCE} (Champollion trading_card_detail, "
                  f"code={card.get('code') or code}; via mt-eval-harness)")
    return card, source


def load_card(code: str, cards_path: str | Path | None = None) -> dict:
    """Load one card by ISO 639-3 code (aliases resolve when the harness
    resolver is in use); on a miss, suggest near codes.

    Every card goes through the ONE Python adapter (the harness's
    language_cards.normalize_card) — same seam as the JS reader. Atlas cards
    carry attribution envelopes and renamed fields that a bare json.loads
    misreads; old-shape cards pass through the adapter untouched."""
    return resolve_card(code, cards_path)[0]


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
    # documentation.medLevel — Glottolog's most extensive description type
    # ("long grammar", "grammar sketch", "dictionary", …), cited
    documentation: dict | None = None
    opus: dict | None = None
    corpora: list[dict] = field(default_factory=list)
    eval_datasets: list[dict] = field(default_factory=list)
    referee: dict | None = None             # LYSS lanes (evalMetrics/evalStandard)
    typology_hints: dict = field(default_factory=dict)
    unknowns: list[str] = field(default_factory=list)
    # why an "unknown" may be the SOURCE's gap rather than the card's: the
    # public card index can lag the full card (Round 10: forge_discover said
    # dictionaries [] for crk while the CLI's card lists one) — or None
    unknowns_note: str | None = None
    registry_note: str | None = None
    metric_trust: dict | None = None       # WMT meta-eval reliability, or None
    nllb_code: str | None = None           # card methodSupport.nllb.code, if covered
    # whether the analyzer the card lists is USABLE HERE — the harness's own
    # look at this machine (config.fst_state: analyzer + pyhfst runtime
    # installed?, the setup command), or None when nothing was checked.
    # Existence on the card is not capability (Round 9: rung 4 was ticked
    # while the crk FST was not installed).
    fst: dict | None = None

    def ladder(self, *, test_withheld: str = ""
               ) -> list[tuple[int, bool | None, str]]:
        """(rung, attained?, one-liner). ``None`` = unknown, honestly.

        Rung 5 (the LYSS referee) is attained only when the card declares
        one AND its package is installed here; declared but not installed
        is ``False`` with the reason — never ticked (Round 7: NEXT_STEPS.md
        ticked it with champollion-lyss absent). ``test_withheld`` (the
        harness's reason a registered test set's text may not leave the
        machine) makes it unavailable for that test set too."""
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
            (3, bool(self.dictionaries or self.grammars
                     or self.grammar_documented()) or None,
             "dictionary (+ a published grammar) → a cited template pack is "
             "worth building"),
            (4, *self._analyzer_rung()),
            (5, *self._referee_rung(test_withheld)),
        ]

    def _analyzer_rung(self) -> tuple[bool | None, str]:
        """Rung 4: the card says an analyzer EXISTS; it is attained only
        when it is also USABLE HERE (installed, with its runtime — the
        harness's check). Exists-but-not-installed is ``False`` with the one
        install command (`mt-eval setup --lang <code>`, the command every
        surface names)."""
        text = "morphological analyzer → round-trip-VERIFIED synthesis"
        if not self.analyzers:
            return None, text
        names = ", ".join(str(a.get("name") or "?") for a in self.analyzers)
        st = self.fst
        if st and st.get("ready"):
            return True, (f"{text} (the card lists {names}; installed here: "
                          "analyzer + pyhfst runtime)")
        if st and st.get("missing"):
            how = st.get("setup_command")
            return False, (
                f"{text} — EXISTS (the card lists {names}) but is NOT usable "
                f"here: {' and '.join(st['missing'])} not installed"
                + (f" — `{how}` installs "
                   + ("it" if len(st['missing']) == 1 else "them")
                   if how else
                   " — it has no automatic install (see the language card's "
                   "FST install notes)"))
        why = ((st or {}).get("error")
               or "the eval harness pins no install for it on this machine")
        return False, (f"{text} — EXISTS (the card lists {names}); usable "
                       f"here is NOT confirmed: {why} (see the language "
                       "card's FST install notes)")

    def _referee_rung(self, test_withheld: str = "") -> tuple[bool | None, str]:
        text = ("LYSS referee → the language's own metric in scoring and "
                "checkpoint selection")
        if not self.referee:
            return None, text
        pkg = self.referee.get("package") or "the eval-standard package"
        outside = ("it can look words up on an outside service, so the "
                   "harness never loads it for a local-only or sealed test "
                   "set")
        if not self.referee.get("installed"):
            return False, (f"{text} — UNAVAILABLE here: the card declares "
                           f"`{pkg}` (an optional add-on with its own "
                           f"license), which is not installed (`python3 -m pip install "
                           f"'{pkg}'`); and {outside}")
        if test_withheld:
            return False, (f"{text} — UNAVAILABLE for your test set "
                           f"({test_withheld}): {outside}")
        return True, f"{text} (`{pkg}` installed; {outside})"

    def grammar_documented(self) -> bool:
        """True when the card's cited documentation level (Glottolog's
        "most extensive description") is a grammar of some length — the
        value's own words ("long grammar", "grammar", "grammar sketch"),
        never inferred from anything else."""
        level = (self.documentation or {}).get("med_level")
        return isinstance(level, str) and "grammar" in level.lower()

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
                      if e else _unregistered(did))
    return flags, None


def _unregistered(dataset_id: str) -> dict:
    """An eval id the card's wiring names but the mt-eval registry does not
    list: there is nothing under it to fetch or score. When the corpus card
    behind the id is reachable (a checkout / node_modules, through the
    harness's own corpora-card locator) its own words say WHY — e.g. a
    synthetic schema fixture that deliberately never enters the registry."""
    out = {"in_registry": False, "runnable": False,
           "note": "not in the mt-eval dataset registry"}
    try:
        from . import _harness

        _harness.load_harness()
        from mt_eval_harness.corpus_fetch import find_corpora_cards_dir

        d = find_corpora_cards_dir()
        corpus_card = (json.loads((d / f"{dataset_id}.json").read_text(
            encoding="utf-8")) if d is not None
            and (d / f"{dataset_id}.json").is_file() else None)
    except Exception:
        corpus_card = None
    if isinstance(corpus_card, dict):
        if corpus_card.get("fixture"):
            out["fixture"] = True
            out["reason"] = ("its corpus card marks it a synthetic schema "
                             "fixture — not a real corpus")
        elif corpus_card.get("quarantine"):
            out["quarantine"] = True
            out["reason"] = (corpus_card.get("quarantineReason")
                             or "its corpus card quarantines it")
    return out


def eval_dataset_line(e: dict) -> str:
    """One eval-dataset id, said plainly: can the user train on it, score
    with it, or neither — and what to do instead."""
    did = e["id"]
    if e.get("in_registry") is False:
        why = f" ({e['reason']})" if e.get("reason") else ""
        return (f"{did} — NOT RUNNABLE: {e.get('note')}{why}. There is no "
                "benchmark to fetch or score under this id (`nmt-forge "
                "registry add-harness` refuses it); ignore it and use your "
                "own test set: nmt-forge registry add <name> <file> --role "
                "test")
    bits = []
    if e.get("do_not_train"):
        bits.append("NEVER TRAIN ON THIS")
    if e.get("quarantine"):
        bits.append("quarantined: no score against it can be published or "
                    "ranked, and `registry add-harness` refuses it — not "
                    "usable as your test set either")
    elif e.get("do_not_train") is not None:
        bits.append("scoring only: `nmt-forge registry add-harness "
                    f"{did} --role test` fetches it from its source")
    if e.get("contamination"):
        bits.append(f"contamination: {e['contamination']}")
    if e.get("note") and not bits:
        bits.append(e["note"])
    return did + (f" — {'; '.join(bits)}" if bits else "")


def _load_raw_card(code):
    """A sibling card (e.g. a macrolanguage hub) through the same resolver
    and adapter as every other read — never a private filesystem walk.
    None when it can't be resolved: this is a best-effort derivation, and an
    unresolvable hub simply leaves the derived value unknown."""
    try:
        return resolve_card(code)[0]
    except Exception:
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


_ISO15924 = re.compile(r"^[A-Z][a-z]{3}$")


def _script_entries(card: dict) -> list[dict]:
    """The card's scripts as ``{code, …}`` entries, read through the
    adapter's vocabulary.

    Atlas cards list ISO 15924 codes (["Cans", "Latn"]); older cards carry
    objects ({code, name, primary}); the public index row names each script
    by its code ({name: "Latn", source}). ``card["script"]`` is the ADAPTER's
    primary script (normalize_card derives it from the card's cited full
    language tag, or a one-entry list — the same bridge the CLI's
    normalizeCard applies, which is why `champollion network card` shows it): it is
    marked primary, and stands in when the card lists no scripts[] at all.
    A multi-script card with no cited full tag gets no primary — never
    invented."""
    out: list[dict] = []
    for x in card.get("scripts") or []:
        if isinstance(x, dict):
            entry = dict(x)
            if not entry.get("code") and isinstance(entry.get("name"), str) \
                    and _ISO15924.match(entry["name"]):
                entry["code"] = entry["name"]
            if entry.get("code") or entry.get("name"):
                out.append(entry)
        elif x:
            out.append({"code": str(x)})
    primary = card.get("script")
    if isinstance(primary, str) and primary:
        if not any(e.get("primary") for e in out):
            hit = next((e for e in out if e.get("code") == primary), None)
            if hit is not None:
                hit["primary"] = True
            else:
                out.insert(0, {"code": primary, "primary": True})
    return out


def _field_sources(card: dict, path: str) -> list[str]:
    """The sources the card cites for one field (``_fieldSources``)."""
    fs = card.get("_fieldSources")
    if not isinstance(fs, dict):
        return []
    v = fs.get(path)
    return [x for x in (v if isinstance(v, list) else [v])
            if isinstance(x, str) and x]


def _snake(key: str) -> str:
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", key).lower()


def _cited_value(lc, card: dict, value, path: str,
                 fallback_sources: list[str] | None = None) -> dict:
    """One card field as ``{"value", "source"}`` through the harness
    adapter: an attribution envelope whose sources agree gives its
    consensus; one whose sources disagree (or that has no single
    displayable value) gives ``value: None, disputed: True`` and EVERY
    claim with its source — never an elected winner (the card-boundary
    rule the CLI's `card` command follows too)."""
    sources = _field_sources(card, path) or list(fallback_sources or [])
    cite = path + (f"; {', '.join(sources)}" if sources else "")
    if lc.is_attributed(value):
        if lc.is_disputed(value) or lc.display(value) is None:
            return {"value": None, "disputed": True, "source": cite,
                    "claims": [{"value": c.get("value"),
                                "source": c.get("source")}
                               for c in lc.attributions(value)]}
        value = lc.display(value)
    return {"value": value, "source": cite}


def discover(code: str, cards_path: str | Path | None = None,
             check_registry: bool = True) -> ResourceReport:
    """One card → an honest, actionable resource inventory."""
    card, source = resolve_card(code, cards_path)
    from . import _harness

    report = ResourceReport(
        code=code,
        name=card.get("name") or code,
        card_path=source,
        # family moved to classification.family at the atlas cutover (the old
        # top-level field is always absent now) and may be an attribution
        # envelope. Consensus-only display: forge REPORTS family, so a
        # disputed one is None → rendered "unknown" — absence over election.
        family=_harness.language_cards_mod().display(
            (card.get("classification") or {}).get("family")
        ),
        direction=_direction_of(card),
        scripts=_script_entries(card),
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

    # Dictionaries: the atlas's lexicalResources.dictionaries (what the
    # champollion CLI's `card` lists — a pip-installed forge said "card is
    # silent on dictionaries" for crk while `champollion network card crk`
    # listed dict-crk-eng; synthetic school persona, Round 3, 2026-10-03),
    # then the F5 schematized resources.dictionaries (carries
    # machineReadable/redistributable); the free-form encyclopedic block
    # only as a fallback for stale card trees.
    lex = card.get("lexicalResources")
    lex = lex if isinstance(lex, dict) else {}
    seen: set = set()
    for path, entries in (("lexicalResources.dictionaries",
                           lex.get("dictionaries")),
                          ("resources.dictionaries", res.get("dictionaries"))):
        sources = _field_sources(card, path)
        for d in entries if isinstance(entries, list) else ():
            if not isinstance(d, dict):
                continue
            key = (d.get("name"), d.get("url"))
            if key in seen:
                continue
            seen.add(key)
            report.dictionaries.append(
                {**d, "_field": path,
                 **({"_sources": sources} if sources else {})})
    if not report.dictionaries:
        enc_dicts = (((card.get("encyclopedic") or {}).get("resources") or {})
                     .get("dictionaries") or [])
        report.dictionaries = [
            {**d, "_field": "encyclopedic.resources.dictionaries"}
            for d in enc_dicts if isinstance(d, dict)
        ]

    report.grammars = [
        g for g in (res.get("grammars") or []) if isinstance(g, dict)
    ]
    # documentation.medLevel: Glottolog's most extensive description of the
    # language ("long grammar" for crk) — the CLI's "Documentation level"
    lc = _harness.language_cards_mod()
    doc = card.get("documentation")
    if isinstance(doc, dict) and doc.get("medLevel") not in (None, ""):
        cited = _cited_value(lc, card, doc["medLevel"],
                             "documentation.medLevel")
        report.documentation = {
            "med_level": cited["value"],
            **({"claims": cited["claims"]} if cited.get("disputed") else {}),
            "glottolog_reference": doc.get("medSourceId"),
            "sources": _field_sources(card, "documentation.medLevel"),
            "_field": "documentation.medLevel",
        }

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
    report.corpora = []
    for c in (res.get("corpora") or []):
        if not isinstance(c, dict):
            continue
        # atlas OPUS attestations are summarized in report.opus above; an
        # entry with no name at all has nothing to render
        if str(c.get("corpusId", "")).startswith("corpus:opus:"):
            continue
        entry = {k: c.get(k) for k in ("name", "type", "url", "exposure",
                                       "license") if c.get(k) is not None}
        if "name" not in entry and c.get("corpus"):
            entry["name"] = c["corpus"]
        if entry.get("name"):
            report.corpora.append(entry)

    ids = list(card.get("evalDatasets") or [])
    if not ids:
        # Atlas cards carry no eval wiring — that is OURS (gate 3), declared
        # in the shared config kernel and attached at read time, same as the
        # arena runtime does.
        ids = list(_eval_config_datasets(card.get("code")) or [])
    flags, note = (_registry_flags(ids) if check_registry else
                   ({}, "mt-eval registry not checked (--no-registry): "
                        "do_not_train/quarantine flags NOT verified"))
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
            # an OPTIONAL add-on — never a requirement to train: whether its
            # plugin modules import HERE decides whether `init` wires them
        }
        from .plugins import spec_importable

        specs = report.plugin_specs()
        report.referee["installed"] = bool(specs) and all(
            spec_importable(sp) for sp in specs)

    # Typology: EVERY feature the card carries, as the CLI's `card` prints
    # them — the atlas emits Grambank/WALS feature names (wordOrder,
    # verbalAlignment, verbSynthesis, …), and reading four fixed names made
    # forge call crk's twenty-feature profile "silent". Each value goes
    # through the adapter (envelopes resolved, disagreements shown whole)
    # and cites its field and sources.
    for block, path_prefix in ((card.get("typologicalProfile"),
                                "typologicalProfile"),
                               ((card.get("encyclopedic") or {})
                                .get("typology"), "encyclopedic.typology")):
        if not isinstance(block, dict):
            continue
        block_source = ([block["source"]] if isinstance(block.get("source"),
                                                         str) else None)
        for key, value in block.items():
            if key == "source" or key.startswith("_") or value is None \
                    or value == "" or value == {} or value == []:
                continue
            name = _snake(key)
            if name in report.typology_hints:
                continue    # the profile's own reading comes first
            report.typology_hints[name] = _cited_value(
                lc, card, value, f"{path_prefix}.{key}", block_source)

    report.metric_trust = metric_trust(code, report.family)
    if report.analyzers:
        report.fst = fst_status(code)

    nllb = ((card.get("methodSupport") or {}).get("nllb") or {})
    if isinstance(nllb, dict) and nllb.get("supported") and nllb.get("code"):
        report.nllb_code = str(nllb["code"])

    # absence is UNKNOWN — name what the card simply doesn't say
    for label, present in (
        ("scripts", bool(report.scripts)),
        ("analyzers", bool(fsts)),
        ("dictionaries", bool(report.dictionaries)),
        ("grammars", bool(report.grammars) or report.grammar_documented()),
        ("corpora", report.opus is not None or bool(report.corpora)),
        ("eval datasets", bool(ids)),
        ("typology", bool(report.typology_hints)),
    ):
        if not present:
            report.unknowns.append(label)
    lexical = [u for u in ("dictionaries", "grammars") if u in report.unknowns]
    if lexical and source.startswith(PUBLIC_INDEX_SOURCE):
        report.unknowns_note = (
            f"this card came from the public card index, which can lack "
            f"resources the full card cites (a published row older than "
            f"them) — so '{' and '.join(lexical)}: unknown' may be the "
            "index's gap, not the card's. The champollion CLI's own card may "
            "list them: `champollion network card "
            f"{report.code} --json > cards/{report.code}.json`, then "
            f"`nmt-forge discover {report.code} --cards-dir cards` reads it")
    return report


def _typology_text(value) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def format_report(report: ResourceReport, *, initialized: bool = False
                  ) -> str:
    """Amateur-readable rendering: inventory → ladder → next actions.

    ``initialized=True`` (the copy inside NEXT_STEPS.md, which `nmt-forge
    init` writes): the project exists, so the next actions never say "init"
    again — they point at the command order below."""
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
                     + (f" (fetch: {inst.get('repo')}"
                        + (f"@{inst['releaseTag']}" if inst.get("releaseTag")
                           else "") + ")"
                        if inst.get("repo") else ""))
    if report.analyzers:
        st = report.fst or {}
        where = (f" — checked in {st['checked_in']}"
                 if st.get("checked_in") else "")
        lines.append((
            "    installed here: yes (analyzer + pyhfst runtime)"
            if st.get("ready") else
            f"    installed here: NO — {' and '.join(st['missing'])} "
            "missing" + (f"; `{st['setup_command']}` installs "
                         + ("it" if len(st["missing"]) == 1 else "them")
                         if st.get("setup_command") else
                         "; no automatic install (the card's FST install "
                         "notes)")
            if st.get("missing") else
            "    installed here: not confirmed — "
            + (st.get("error") or "the eval harness pins no install for it"))
            + where)
    for f in report.other_fsts:
        lines.append(f"  other tool: {f.get('name')} ({f.get('type')}) — not a "
                     "morphological analyzer")
    for d in report.dictionaries:
        who = ", ".join(str(x) for x in (
            d.get("publisher"),
            (f"{d['license']}" + (" (licence NOT established)"
                                  if d.get("licenceEstablished") is False
                                  else "")) if d.get("license") else None)
            if x)
        lines.append(f"  dictionary: {d.get('name')}"
                     + (f" — {who}" if who else "")
                     + (f" (paired with {d['pairedWith']})"
                        if d.get("pairedWith") else "")
                     + (f" — {d['url']}" if d.get("url") else "")
                     + ("  [POINTER-ONLY: content not redistributable — "
                        "fetch from source, never copy]"
                        if d.get("redistributable") is False else "")
                     + (f"  [{d['_field']}"
                        + (f"; {', '.join(d['_sources'])}"
                           if d.get("_sources") else "") + "]"
                        if d.get("_sources") else ""))
    for g in report.grammars:
        cite = " ".join(str(p) for p in
                        (g.get("author"), f"({g['year']})." if g.get("year")
                         else None, g.get("title")) if p)
        lines.append(f"  grammar: {cite}"
                     + (f" — {g['url']}" if g.get("url") else ""))
    if report.documentation:
        doc = report.documentation
        level = doc.get("med_level")
        if level is None and doc.get("claims"):
            level = "sources differ — " + "; ".join(
                f"{c.get('value')} [{c.get('source')}]"
                for c in doc["claims"])
        ref = doc.get("glottolog_reference")
        lines.append(
            f"  documentation: {level} — the most extensive description of "
            "the language Glottolog records"
            + (f" (Glottolog reference {ref})" if ref else "")
            + f"  [{doc['_field']}"
            + (f"; {', '.join(doc['sources'])}" if doc.get("sources")
               else "") + "]")
    if report.opus:
        lines.append(f"  OPUS: {report.opus.get('corpora')} corpora, "
                     f"{report.opus.get('totalAlignmentPairs', '?')} aligned pairs")
    for c in report.corpora:
        bits = [b for b in (c.get("type"),
                            f"exposure: {c['exposure']}" if c.get("exposure")
                            else None) if b]
        lines.append(f"  corpus: {c.get('name')}"
                     + (f" ({', '.join(bits)})" if bits else ""))
    if report.eval_datasets:
        lines.append(f"  eval datasets ({len(report.eval_datasets)}):")
        for e in report.eval_datasets[:6]:
            lines.append(f"    {eval_dataset_line(e)}")
        if len(report.eval_datasets) > 6:
            lines.append(f"    … and {len(report.eval_datasets) - 6} more")
    if report.registry_note:
        lines.append(f"  ⚠ {report.registry_note}")
    if report.referee:
        pkg = report.referee.get("package")
        lines.append(
            f"  LYSS referee (OPTIONAL add-on with its own license — read it "
            f"before installing; training never needs it): {pkg} — "
            + ("installed: its lanes can join scoring and checkpoint "
               "selection:" if report.referee.get("installed") else
               f"NOT installed (`python3 -m pip install '{pkg}'` adds these lanes):"))
        for spec in report.plugin_specs():
            lines.append(f"    --plugin {spec}")
    for k, v in report.typology_hints.items():
        if v.get("disputed"):
            claims = "; ".join(
                f"{_typology_text(c.get('value'))} [{c.get('source')}]"
                for c in v.get("claims") or [])
            lines.append(f"  typology: {k} — sources differ, every value "
                         f"shown: {claims}  [{v['source']}]")
        else:
            lines.append(f"  typology: {k} = {_typology_text(v['value'])}  "
                         f"[{v['source']}]")
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
    if report.unknowns_note:
        lines.append(f"    note: {report.unknowns_note}")
    lines.append("")

    lines.append("THE ASSET LADDER — what this language can do TODAY:")
    for rung, attained, text in report.ladder():
        mark = "✓" if attained else ("?" if attained is None else "✗")
        lines.append(f"  {mark} rung {rung}: {text}")
    lines.append("")

    lines.append("NEXT ACTIONS:")
    if initialized:
        lines.append("  this project is initialized (config.json is here) — "
                     "follow 'The command order' below; `nmt-forge status` "
                     "names the next command at any point")
    else:
        lines.append("  1. nmt-forge init " + report.code + " — scaffold a "
                     "project (config.json + NEXT_STEPS.md) from this card")
        lines.append("  2. get a parallel corpus locally (fetch from its "
                     "source — forge never hosts corpus content)")
        lines.append("  3. nmt-forge split <corpus> --test N --dev M --seed S "
                     "--out data/split --register project, then: nmt-forge "
                     "run config.json")
    if not report.analyzers:
        lines.append("  note: no morphological analyzer on the card → verified "
                     "synthesis is off the menu until one exists; every guard "
                     "and the training loop work regardless")
    return "\n".join(lines)
