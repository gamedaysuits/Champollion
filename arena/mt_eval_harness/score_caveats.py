"""Score caveats — what qualifies a run's headline numbers, said next to them.

A score can be computed correctly and still not mean what its label says.
This module is the ONE reader of such qualifications; every surface that
shows a report's scores (the test summary, the run card, ``mt-eval compare``,
the dashboard, the publish preview) prints what it returns beside the
headline, and ``publish`` carries it onto the published run card as
``score_caveats`` so the leaderboard can show it too. It never changes a
score — it only states what limits it.

Under the scoring standard (scoring.SCORING_STANDARD, 2026-10-04) the
headline is corpus chrF++ and the weighted composite is retired. The
failures below were found while the composite was the headline — each one
inflated it through a reference-free diagnostic (FST acceptance,
code-switching, hallucination) — and the numbers in them are historical.
The caveats stay: they now say when a DIAGNOSTIC reads well for the wrong
reason, and they stay prominent beside the chrF++ headline.

Five caveats exist today:

``train_test_near_twin`` — written by nmt-forge, not computed here.
    ``nmt-forge export`` / ``evaluate`` checks every test row for a
    near-identical twin in the training data and writes the reading into the
    mt-eval files it produces (forge ``harness_bridge``): the RunLog's
    ``provenance.nmt_forge.near_twin`` (forge's ``near_twin_summary``) and
    the TestReport's ``overall.nmt_forge_*`` fields. When every test row has
    a twin, chrF++ 100 / "Deterministic 1.0000 (fluent)" measures recall of
    training phrases, not translation — and until 2026-10-03 the harness
    showed those numbers with no caveat (synthetic hospital persona, Round 3).

``length_inflation`` — computed here from the report's own entries.
    Outputs much longer than their references (a plugin's few-shot examples
    leaked into every output: length ratio 2.5–4×, TER 315) went unflagged
    (synthetic researcher, Round 3). The bound is the scoring spec's own for
    ``length_ratio`` — "inflation/hallucination (>2.0)" — applied to the
    corpus mean, or to a quarter or more of the scored entries.

``source_copy`` — computed here from the report's own entries.
    Outputs that ARE their source (compared through the one source-copy
    normalizer, ``text_compare.echo_compare_forms``: case, accents and
    punctuation folded away) still earn composite credit from every metric
    that does not compare against the reference. For a language whose FST is
    an acceptor-only speller (Northern Sami), FST acceptance carries ~45% of
    the composite once the absent metrics are re-weighted away, and the
    speller accepts capitalised and some English words; the hallucination
    detector gives a whole-output copy only its 0.1 echo weight. English
    copied through with accents stripped scored a composite of 0.250 against
    0.125 for the same output with no FST (synthetic researcher, Round 4).
    The weights are a founder decision and are unchanged; this caveat says,
    beside the headline, when most outputs are copies. An entry whose
    reference is itself the source (a name, a number) is left out — copying
    it is the right answer.

``length_deflation`` — computed here from the report's own entries.
    The mirror of ``length_inflation``: outputs much SHORTER than their
    references, i.e. words left out. FST acceptance (and code-switching)
    judge only the words an output contains, so a system that drops what it
    cannot translate raises them — and for an acceptor-only FST language FST
    acceptance carries ~45% of the composite. A 45-word lookup table that
    drops unknown words scored a published composite of 0.5481 on a 25-row
    eng→sme dev set (FST acceptance 0.76 × 0.455, chrF++ 11.8 × 0.273),
    against 0.2155–0.2351 for full-length stand-in-model outputs on the
    62-row Tatoeba eng→sme set; its outputs averaged 0.47× the reference
    length and 16 of 25 were under 0.5× (synthetic researcher, Round 6). The
    bound is the scoring spec's own for ``length_ratio`` —
    "truncation (<0.5)" — on the corpus mean, or on a quarter or more of the
    scored entries (the inflation rule's share). The caveat is ``major``
    when the report carries a metric that judges only the words present
    (FST acceptance, code-switching) and ``minor`` otherwise (the contest
    lane's chrF++ + exact match already count missing words). The weights
    are a founder decision and are unchanged.

``near_constant_output`` — computed here from the report's own entries.
    One output given for many DIFFERENT inputs. A toy phrase table that
    printed the same valid Sami sentence for 29 of 30 eng→sme dev inputs
    scored a card composite of 0.5073 with no caveat — more than twice an
    LLM run on the same set (0.2302) — because FST acceptance (~45% of an
    acceptor-only language's composite) credits a valid sentence wherever
    it appears, and a constant sentence of reference-like length trips
    neither the copy rule nor the length rules (synthetic researcher, Round
    12). An output counts as a cross-source repeat when enough distinct
    sources share it — 3 for an output of 3+ words, 5 for a 1–2-word one,
    because short answers ("Yes.", "Thank you.") legitimately recur — and an
    output equal to its own reference is a correct answer, not a repeat. The
    caveat fires when repeats cover a quarter or more of the distinct
    sources (and at least 5 of them). False-positive measurement
    (``arena/scripts/verify_near_constant_caveat.py``: the shipped rule over
    Google's mt-metrics-eval, WMT 2019–2025; counts only): of 2,161 real
    system outputs and references, the 5 it flags are all broken output —
    "####" for every row, a reference file of "nan", leftover "<seg id>"
    tags, "failed" for 149 rows, one word looped into 334-word outputs. On
    phrasebook-like subsets of the same data (sources of <= 2 / 4 / 6
    words: 828–1,389 sets) it flags only two of those same broken systems;
    the highest unflagged shares are 17% (a system answering 26 short
    sources with one filler phrase) and 11% (a reference set's own "thank
    you so much" for three sources). In 399,100 random 10–62-row test sets
    of short sources it flagged 5, all from two systems that answer many
    different sources with one output (a one-word fragment; leftover
    markup); without the length and source-count dependence (any two
    sources sharing an output) other real systems were flagged too. The weights are a founder decision and
    are unchanged; this caveat only says what the composite is measuring.

A caveat is a plain dict::

    {"kind": ..., "source": ..., "severity": "major" | "minor",
     "message": "<one sentence, ≤ MESSAGE_CAP chars>", ...numbers}

The published card stores them as a list of such objects; the database's
aggregate-only shape guard (migration 051) caps strings inside array objects
at 500 characters, hence ``MESSAGE_CAP``.
"""

from __future__ import annotations

import textwrap

#: Scoring spec, ``length_ratio``: "Detects truncation (<0.5) and
#: inflation/hallucination (>2.0)". An entry above this is inflated.
LENGTH_INFLATION_RATIO = 2.0
#: The run-level warning fires when the corpus mean exceeds the ratio, or when
#: at least this share of scored entries does (a mean can hide a quarter of
#: the outputs carrying an extra paragraph).
LENGTH_INFLATION_SHARE = 0.25

#: Scoring spec, ``length_ratio``: "Detects truncation (<0.5)". An entry
#: below this has lost words.
LENGTH_DEFLATION_RATIO = 0.5
#: The run-level deflation warning fires when the corpus mean is below the
#: ratio, or when at least this share of scored entries is (the inflation
#: rule's share: a mean can hide a quarter of the outputs losing half their
#: words).
LENGTH_DEFLATION_SHARE = 0.25

#: Strings inside an array of objects on a published run card are capped at
#: 500 characters by the database shape guard (migration 051).
MESSAGE_CAP = 480

#: The run-level source-copy caveat fires when at least this share of the
#: considered entries are copies of their source — "largely copies".
SOURCE_COPY_SHARE = 0.5

#: Near-constant output — the distinct-source counts that make one output a
#: CROSS-SOURCE REPEAT, by its length in words (after
#: text_compare.repeat_compare_key). An output of 3+ words given for 3 or
#: more DIFFERENT sources is a repeat; a short one (1–2 words: "Yes.",
#: "Thank you.") needs 5, because short answers legitimately recur. Set
#: from a false-positive measurement over real WMT system outputs
#: (arena/scripts/verify_near_constant_caveat.py; the numbers are in this
#: module's docstring).
NEAR_CONSTANT_MIN_SOURCES = 3
NEAR_CONSTANT_MIN_SOURCES_SHORT = 5
NEAR_CONSTANT_SHORT_WORDS = 2
#: The run-level near-constant caveat fires when the distinct sources whose
#: output is a cross-source repeat are at least this share of the considered
#: distinct sources (the length rules' "a quarter or more") ...
NEAR_CONSTANT_SHARE = 0.25
#: ... and at least this many (so 3 sources of a 6-row set never fire).
NEAR_CONSTANT_MIN_REPEATS = 5

NEAR_TWIN = "train_test_near_twin"
LENGTH_INFLATION = "length_inflation"
SOURCE_COPY = "source_copy"
LENGTH_DEFLATION = "length_deflation"
NEAR_CONSTANT = "near_constant_output"


def _cap(text: str) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= MESSAGE_CAP else text[: MESSAGE_CAP - 1] + "…"


# ---------------------------------------------------------------------------
# nmt-forge near-twin reading
# ---------------------------------------------------------------------------

def _near_twin_from_reading(nt: dict, total: int | None = None) -> dict | None:
    """A caveat from forge's ``near_twin_summary`` dict, or None when the
    reading is clean (checked, and no test row has a train-side twin)."""
    if not isinstance(nt, dict) or not nt.get("message"):
        return None
    checked = bool(nt.get("checked"))
    rows = nt.get("near_twin_rows")
    if checked and not rows:
        return None
    strict = nt.get("strict") if isinstance(nt.get("strict"), dict) else {}
    recall = bool(nt.get("recall_not_translation"))
    return {
        "kind": NEAR_TWIN,
        "source": "nmt-forge",
        "severity": "major" if recall else "minor",
        "checked": checked,
        "recall_not_translation": recall,
        "near_twin_rows": rows,
        "n": nt.get("n") or total,
        "near_twin_share": nt.get("near_twin_share"),
        "strict_n": nt.get("strict_n"),
        "strict_corpus_chrf": strict.get("score"),
        "strict_corpus_chrf_ci": (
            [strict["ci_lower"], strict["ci_upper"]]
            if "ci_lower" in strict and "ci_upper" in strict else None),
        "message": _cap(nt["message"]),
    }


def _near_twin_from_overall(overall: dict) -> dict | None:
    """The same caveat from the TestReport ``overall.nmt_forge_*`` fields
    (forge ``harness_bridge.overall_caveat_fields``)."""
    if not isinstance(overall, dict) or not overall.get("nmt_forge_score_caveat"):
        return None
    ci = overall.get("nmt_forge_strict_corpus_chrf_ci")
    strict = ({"score": overall.get("nmt_forge_strict_corpus_chrf"),
               "ci_lower": ci[0], "ci_upper": ci[1]}
              if isinstance(ci, (list, tuple)) and len(ci) == 2
              and overall.get("nmt_forge_strict_corpus_chrf") is not None
              else None)
    return _near_twin_from_reading({
        "checked": overall.get("nmt_forge_near_twin_checked"),
        "near_twin_rows": overall.get("nmt_forge_near_twin_rows"),
        "near_twin_share": overall.get("nmt_forge_near_twin_share"),
        "strict_n": overall.get("nmt_forge_strict_n"),
        "strict": strict,
        "recall_not_translation": overall.get("nmt_forge_recall_not_translation"),
        "message": overall.get("nmt_forge_score_caveat"),
    }, total=overall.get("evaluated") or overall.get("total_entries"))


def near_twin_caveat(report: dict | None = None,
                     run_log: dict | None = None) -> dict | None:
    """forge's near-twin caveat for a run, from its RunLog provenance (the
    full reading) or its TestReport ``overall`` fields; None when forge did
    not write one or its check found no twin."""
    prov = ((run_log or {}).get("provenance") or {}).get("nmt_forge") or {}
    found = _near_twin_from_reading(prov.get("near_twin"))
    if found is None and report:
        found = _near_twin_from_overall(report.get("overall") or {})
    return found


# ---------------------------------------------------------------------------
# Length inflation
# ---------------------------------------------------------------------------

def _length_ratios(entries: list[dict]) -> list[float]:
    """The harness's own per-entry ``length_ratio`` (tester.py: characters of
    output ÷ characters of reference) for every scored entry that has a
    reference. An empty output counts (ratio 0 — everything was dropped); an
    errored entry does not."""
    return [e.get("length_ratio") for e in entries or []
            if isinstance(e, dict) and not e.get("error")
            and (e.get("expected") or "").strip()
            and isinstance(e.get("length_ratio"), (int, float))
            and not isinstance(e.get("length_ratio"), bool)]


def length_inflation(entries: list[dict]) -> dict | None:
    """Length-inflation statistics over a report's scored entries.

    ``length_ratio`` per entry is the harness's own (tester.py: characters of
    output ÷ characters of reference). Returns ``{scored, mean_ratio,
    inflated_entries, inflated_share, ratio_bound, share_bound, flagged}``,
    or None when no entry has a reference to compare against.
    """
    ratios = _length_ratios(entries)
    if not ratios:
        return None
    inflated = sum(1 for r in ratios if r > LENGTH_INFLATION_RATIO)
    mean = sum(ratios) / len(ratios)
    share = inflated / len(ratios)
    return {
        "scored": len(ratios),
        "mean_ratio": round(mean, 4),
        "inflated_entries": inflated,
        "inflated_share": round(share, 4),
        "ratio_bound": LENGTH_INFLATION_RATIO,
        "share_bound": LENGTH_INFLATION_SHARE,
        "flagged": bool(mean > LENGTH_INFLATION_RATIO
                        or (inflated and share >= LENGTH_INFLATION_SHARE)),
    }


def length_inflation_caveat(stats: dict | None) -> dict | None:
    """A caveat from :func:`length_inflation` stats, or None when unflagged."""
    if not stats or not stats.get("flagged"):
        return None
    n, k = stats["scored"], stats["inflated_entries"]
    message = (
        f"outputs average {stats['mean_ratio']:.1f}× the reference length and "
        f"{k} of {n} scored entries ({stats['inflated_share']:.0%}) are over "
        f"{stats['ratio_bound']:g}× (the scoring spec's inflation bound) — "
        "the outputs carry text beyond a translation (leaked examples, notes "
        "or repeats); read the scores as measuring that, and check a few "
        "outputs before trusting them")
    return {
        "kind": LENGTH_INFLATION,
        "source": "mt-eval-harness",
        "severity": "major",
        "mean_length_ratio": stats["mean_ratio"],
        "inflated_entries": k,
        "scored_entries": n,
        "ratio_bound": stats["ratio_bound"],
        "share_bound": stats["share_bound"],
        "message": _cap(message),
    }


# ---------------------------------------------------------------------------
# Length deflation (words left out)
# ---------------------------------------------------------------------------

#: Diagnostics that judge only the words an output CONTAINS — leaving a
#: word out can only help them. Keyed by the plugin name in a report's
#: ``overall.plugin_metrics`` and the aggregate that carries the value.
#: (The FST keys are publish's own: giellalt_fst_validity, and the legacy
#: fst_analyzer of pre-plugin reports.)
_EMITTED_ONLY_METRICS = (
    ("giellalt_fst_validity", "avg_fst_validity", "FST acceptance"),
    ("fst_analyzer", "acceptance_rate", "FST acceptance"),
    ("code_switching", "avg_code_switching_rate", "code-switching"),
)


def emitted_only_metrics(overall: dict | None) -> list[str]:
    """Labels of the diagnostics in this report that score only the
    words present (FST acceptance, code-switching), in that order."""
    plugins = ((overall or {}).get("plugin_metrics") or {})
    found = []
    for plugin, key, label in _EMITTED_ONLY_METRICS:
        block = plugins.get(plugin)
        if (isinstance(block, dict) and not block.get("error")
                and isinstance(block.get(key), (int, float))
                and label not in found):
            found.append(label)
    return found


def length_deflation(entries: list[dict]) -> dict | None:
    """Length-deflation statistics over a report's scored entries — the
    mirror of :func:`length_inflation` at the scoring spec's truncation
    bound. Returns ``{scored, mean_ratio, short_entries, short_share,
    ratio_bound, share_bound, flagged}``, or None when no entry has a
    reference to compare against.
    """
    ratios = _length_ratios(entries)
    if not ratios:
        return None
    short = sum(1 for r in ratios if r < LENGTH_DEFLATION_RATIO)
    mean = sum(ratios) / len(ratios)
    share = short / len(ratios)
    return {
        "scored": len(ratios),
        "mean_ratio": round(mean, 4),
        "short_entries": short,
        "short_share": round(share, 4),
        "ratio_bound": LENGTH_DEFLATION_RATIO,
        "share_bound": LENGTH_DEFLATION_SHARE,
        "flagged": bool(mean < LENGTH_DEFLATION_RATIO
                        or (short and share >= LENGTH_DEFLATION_SHARE)),
    }


def length_deflation_caveat(stats: dict | None,
                            emitted_only: list[str] | None = None
                            ) -> dict | None:
    """A caveat from :func:`length_deflation` stats, or None when unflagged.

    ``emitted_only`` names the diagnostics in the report that judge only
    the words present (:func:`emitted_only_metrics`). With one, dropping
    words RAISES that diagnostic — ``major`` (it read as quality under the
    retired composite, and still reads well for the wrong reason); without
    (chrF++ and exact match only, which count what is missing) it is a
    ``minor`` note.
    """
    if not stats or not stats.get("flagged"):
        return None
    n, k = stats["scored"], stats["short_entries"]
    head = (f"outputs average {stats['mean_ratio']:.2f}× the reference "
            f"length and {k} of {n} scored entries ({stats['short_share']:.0%})"
            f" are under {stats['ratio_bound']:g}× (the scoring spec's "
            f"truncation bound) — words were left out")
    emitted_only = list(emitted_only or [])
    if emitted_only:
        names = " and ".join(emitted_only)
        one = len(emitted_only) == 1
        verb, them = ("judges", "it") if one else ("judge", "them")
        message = (
            f"{head}: {names} {verb} only the words an output contains, so "
            f"dropping what a system cannot translate raises {them}; do not "
            f"read {them} as quality beside runs that translate everything "
            "(the chrF++ headline, which weights recall, counts the missing "
            "words)")
        severity = "major"
    else:
        message = (
            f"{head}; chrF++ (which weights recall) and exact match count the "
            "missing words, but check a few outputs before comparing this run "
            "with full translations")
        severity = "minor"
    return {
        "kind": LENGTH_DEFLATION,
        "source": "mt-eval-harness",
        "severity": severity,
        "mean_length_ratio": stats["mean_ratio"],
        "short_entries": k,
        "scored_entries": n,
        "ratio_bound": stats["ratio_bound"],
        "share_bound": stats["share_bound"],
        "emitted_only_metrics": emitted_only,
        "message": _cap(message),
    }


# ---------------------------------------------------------------------------
# Source copies
# ---------------------------------------------------------------------------

def source_copies(entries: list[dict]) -> dict | None:
    """Source-copy statistics over a report's scored entries.

    An entry is a copy when its output equals its source under the shared
    source-copy normalizer (``text_compare.echo_compare_forms`` — the same
    test the hallucination plugin's echo signal makes, so the two can never
    disagree). Entries with an error, an empty output or an empty source are
    not considered, nor is an entry whose REFERENCE equals its source (a
    name, a number): copying is correct there. Returns ``{considered,
    copies, copy_share, share_bound, correct_copies_excluded, flagged}``, or
    None when no entry can be considered.
    """
    from mt_eval_harness.text_compare import echo_compare_forms

    considered = copies = excluded = 0
    for e in entries or []:
        if not isinstance(e, dict) or e.get("error"):
            continue
        src = str(e.get("source") or "")
        pred = str(e.get("predicted") or "")
        if not src.strip() or not pred.strip():
            continue
        ref = str(e.get("expected") or "")
        if ref.strip():
            r_src, r_ref = echo_compare_forms(src, ref)
            if r_src == r_ref:
                excluded += 1
                continue
        considered += 1
        a, b = echo_compare_forms(src, pred)
        if a == b:
            copies += 1
    if not considered:
        return None
    share = copies / considered
    return {
        "considered": considered,
        "copies": copies,
        "copy_share": round(share, 4),
        "share_bound": SOURCE_COPY_SHARE,
        "correct_copies_excluded": excluded,
        "flagged": bool(copies and share >= SOURCE_COPY_SHARE),
    }


def source_copy_caveat(stats: dict | None) -> dict | None:
    """A caveat from :func:`source_copies` stats, or None when unflagged."""
    if not stats or not stats.get("flagged"):
        return None
    n, k = stats["considered"], stats["copies"]
    message = (
        f"{k} of {n} scored outputs ({stats['copy_share']:.0%}) are copies "
        "of their source text (case, accents and punctuation ignored) — "
        "nothing was translated there, yet diagnostics that do not compare "
        "against the reference (FST acceptance, code-switching, "
        "hallucination) can score copied words; read those diagnostics as "
        "measuring copied text (the chrF++ headline compares against the "
        "reference)")
    return {
        "kind": SOURCE_COPY,
        "source": "mt-eval-harness",
        "severity": "major",
        "copies": k,
        "considered_entries": n,
        "copy_share": stats["copy_share"],
        "share_bound": stats["share_bound"],
        "message": _cap(message),
    }


def source_copy_refusal(entries: list[dict]) -> dict | None:
    """The source-copy rule as a QUALIFIER refusal, or None.

    The one rule above (``source_copies``: the shared source-copy
    normalizer, the same SOURCE_COPY_SHARE bound, entries whose reference IS
    the source left out) — applied where a score is a gate rather than a
    headline: a contest qualifier whose dev outputs are mostly copies of the
    source is refused whatever it scores (an English echo cleared a contest
    threshold an LLM-backed method missed — synthetic researcher, Round 5).
    This module still never changes a score; the gates that refuse call
    this (contest_qualify.qualify, sandbox_runner.verify_qualifier_by_
    execution, contest_node's dev gate). Returns ``{rule, reason, **stats}``.
    """
    stats = source_copies(entries)
    if not stats or not stats.get("flagged"):
        return None
    reason = (
        f"{stats['copies']} of {stats['considered']} dev outputs "
        f"({stats['copy_share']:.0%}) are copies of their source text (case, "
        f"accents and punctuation ignored; entries whose reference is the "
        f"source itself are not counted) — at or above the "
        f"{stats['share_bound']:.0%} bound, a system that mostly copies its "
        f"input is not translating, so it does not qualify, whatever its "
        f"score.")
    return {"rule": SOURCE_COPY, "reason": reason, **stats}


# ---------------------------------------------------------------------------
# Near-constant output (one output for many different inputs)
# ---------------------------------------------------------------------------

def _repeat_bound(words: int) -> int:
    """How many distinct sources must share an output of ``words`` words for
    it to count as a cross-source repeat (short answers recur legitimately)."""
    return (NEAR_CONSTANT_MIN_SOURCES_SHORT if words <= NEAR_CONSTANT_SHORT_WORDS
            else NEAR_CONSTANT_MIN_SOURCES)


def near_constant_outputs(entries: list[dict]) -> dict | None:
    """Near-constant-output statistics over a report's scored entries.

    Outputs and sources are compared in ``text_compare.repeat_compare_key``
    form (case, punctuation and spacing ignored; diacritics kept). An entry
    is considered when it has no error, a non-empty source and a non-empty
    output; the unit is the DISTINCT source, so a corpus that lists one
    sentence twice is not a repeat. An entry whose output equals its own
    reference is a correct answer, not a repeat (several sources whose
    reference really is "Yes." may all get "Yes."), and is left out of the
    repeat count — it stays in the denominator. An output is a cross-source
    repeat when at least :func:`_repeat_bound` distinct sources got it
    (3 for an output of 3+ words, 5 for a 1–2-word one). Returns
    ``{considered_sources, repeated_sources, repeat_share, repeated_outputs,
    top_output_sources, top_output_words, distinct_outputs,
    correct_repeats_excluded, share_bound, min_repeats, min_sources,
    min_sources_short, short_words, flagged}`` — counts only, never the text
    (a published run card carries this, and the outputs of a local-only
    corpus never leave the machine) — or None when nothing can be
    considered.
    """
    from mt_eval_harness.text_compare import repeat_compare_key

    sources: set[str] = set()
    groups: dict[str, set[str]] = {}
    outputs: set[str] = set()
    excluded = 0
    for e in entries or []:
        if not isinstance(e, dict) or e.get("error"):
            continue
        src = repeat_compare_key(str(e.get("source") or ""))
        out = repeat_compare_key(str(e.get("predicted") or ""))
        if not src or not out:
            continue
        sources.add(src)
        outputs.add(out)
        ref = repeat_compare_key(str(e.get("expected") or ""))
        if ref and ref == out:
            excluded += 1
            continue
        groups.setdefault(out, set()).add(src)
    if not sources:
        return None
    repeated = {o: s for o, s in groups.items()
                if len(s) >= _repeat_bound(len(o.split()))}
    repeated_sources = len(set().union(*repeated.values())) if repeated else 0
    top = max(groups.items(), key=lambda kv: len(kv[1]), default=("", set()))
    share = repeated_sources / len(sources)
    return {
        "considered_sources": len(sources),
        "repeated_sources": repeated_sources,
        "repeat_share": round(share, 4),
        "repeated_outputs": len(repeated),
        "top_output_sources": len(top[1]),
        "top_output_words": len(top[0].split()),
        "distinct_outputs": len(outputs),
        "correct_repeats_excluded": excluded,
        "share_bound": NEAR_CONSTANT_SHARE,
        "min_repeats": NEAR_CONSTANT_MIN_REPEATS,
        "min_sources": NEAR_CONSTANT_MIN_SOURCES,
        "min_sources_short": NEAR_CONSTANT_MIN_SOURCES_SHORT,
        "short_words": NEAR_CONSTANT_SHORT_WORDS,
        "flagged": bool(repeated_sources >= NEAR_CONSTANT_MIN_REPEATS
                        and share >= NEAR_CONSTANT_SHARE),
    }


def near_constant_caveat(stats: dict | None,
                         emitted_only: list[str] | None = None) -> dict | None:
    """A caveat from :func:`near_constant_outputs` stats, or None when
    unflagged. Always ``major``: outputs that do not depend on the input are
    not translations, whatever the metrics say. ``emitted_only`` names the
    diagnostics that judge an output without its reference
    (:func:`emitted_only_metrics`) — the ones a repeated valid sentence
    scores on, said in the message when the report carries them."""
    if not stats or not stats.get("flagged"):
        return None
    n, k = stats["considered_sources"], stats["repeated_sources"]
    top_n, top_w = stats["top_output_sources"], stats["top_output_words"]
    outs = stats["repeated_outputs"]
    head = (f"{k} of {n} distinct sources ({stats['repeat_share']:.0%}) got "
            + ("an output" if outs == 1 else f"one of {outs} outputs")
            + f" shared with other, different sources — the most repeated "
            f"({top_w} word{'s' if top_w != 1 else ''}) answers {top_n} of "
            f"them (case and punctuation ignored; outputs equal to their "
            f"reference not counted)")
    emitted_only = list(emitted_only or [])
    if emitted_only:
        names = " and ".join(emitted_only)
        tail = (f": the output does not follow the input, yet {names} "
                f"credit{'s' if len(emitted_only) == 1 else ''} a valid "
                "sentence every time it appears, so "
                + ("it rewards" if len(emitted_only) == 1 else "they reward")
                + " repeating it — read "
                + ("that diagnostic" if len(emitted_only) == 1
                   else "those diagnostics")
                + " as measuring that; the chrF++ headline compares against "
                "the reference")
    else:
        tail = ("; the output does not follow the input there — check a few "
                "outputs before reading any score as translation quality")
    return {
        "kind": NEAR_CONSTANT,
        "source": "mt-eval-harness",
        "severity": "major",
        "repeated_sources": k,
        "considered_sources": n,
        "repeat_share": stats["repeat_share"],
        "repeated_outputs": outs,
        "top_output_sources": top_n,
        "top_output_words": top_w,
        "share_bound": stats["share_bound"],
        "min_repeats": stats["min_repeats"],
        "min_sources": stats["min_sources"],
        "min_sources_short": stats["min_sources_short"],
        "emitted_only_metrics": emitted_only,
        "message": _cap(head + tail),
    }


# ---------------------------------------------------------------------------
# Collection + rendering
# ---------------------------------------------------------------------------

def collect(report: dict | None = None, run_log: dict | None = None) -> list[dict]:
    """Every caveat that qualifies a report's scores, major first.

    Reads, in order: forge's near-twin reading (RunLog provenance, else the
    TestReport ``overall`` fields, else a ``score_caveats`` entry the harness
    recorded at analysis time); the length-inflation check recomputed from
    the report's entries (so a report written before this check existed gets
    it too), else the one recorded in the report; the length-deflation check
    (words left out), likewise; and the source-copy check, likewise
    recomputed from the entries, else the recorded one.
    """
    report = report or {}
    stored = {c.get("kind"): c for c in report.get("score_caveats") or []
              if isinstance(c, dict) and c.get("kind")}
    out: list[dict] = []
    nt = near_twin_caveat(report, run_log) or stored.get(NEAR_TWIN)
    if nt:
        out.append(nt)
    entries = report.get("entries")
    if entries:
        li = length_inflation_caveat(length_inflation(entries))
    else:
        li = (length_inflation_caveat((report.get("overall") or {})
                                      .get("length_inflation"))
              or stored.get(LENGTH_INFLATION))
    if li:
        out.append(li)
    if entries:
        ld = length_deflation_caveat(
            length_deflation(entries),
            emitted_only_metrics(report.get("overall")))
    else:
        ld = (length_deflation_caveat(
                  (report.get("overall") or {}).get("length_deflation"),
                  emitted_only_metrics(report.get("overall")))
              or stored.get(LENGTH_DEFLATION))
    if ld:
        out.append(ld)
    sc = (source_copy_caveat(source_copies(entries)) if entries
          else stored.get(SOURCE_COPY))
    if sc:
        out.append(sc)
    # One output for many different inputs (Round 12 researcher: 29 of 30
    # dev outputs one valid Sami sentence scored a composite of 0.5073 with
    # no caveat, twice an LLM run's) — recomputed from the entries, else the
    # one recorded in the report.
    nc = (near_constant_caveat(near_constant_outputs(entries),
                               emitted_only_metrics(report.get("overall")))
          if entries else stored.get(NEAR_CONSTANT))
    if nc:
        out.append(nc)
    return sorted(out, key=lambda c: c.get("severity") != "major")


def short_label(caveat: dict) -> str:
    """A few words for a table cell: 'recall, not translation' / '3.1× length'."""
    if caveat.get("kind") == NEAR_TWIN:
        if caveat.get("recall_not_translation"):
            return "recall, not translation"
        if not caveat.get("checked"):
            return "near-twin check not run"
        share = caveat.get("near_twin_share")
        return (f"{share:.0%} test rows twinned" if isinstance(share, (int, float))
                else "test rows twinned")
    if caveat.get("kind") == LENGTH_INFLATION:
        return f"{caveat.get('mean_length_ratio', 0):.1f}× length inflation"
    if caveat.get("kind") == SOURCE_COPY:
        return f"{caveat.get('copy_share', 0):.0%} source copies"
    if caveat.get("kind") == LENGTH_DEFLATION:
        return (f"{caveat.get('mean_length_ratio', 0):.2f}× length — words "
                f"dropped")
    if caveat.get("kind") == NEAR_CONSTANT:
        return f"{caveat.get('repeat_share', 0):.0%} near-constant output"
    return caveat.get("kind") or "caveat"


def caveat_lines(caveats: list[dict], width: int = 76, indent: str = "  ",
                 first_indent: str | None = None,
                 tier_note: bool = False) -> list[str]:
    """Wrapped terminal lines: ``⚠ SCORE CAVEAT (nmt-forge): …``, each line
    at most ``width`` columns. ``first_indent`` (default ``indent``) starts
    each caveat — e.g. a run letter in ``compare``. ``tier_note`` adds, for
    a near-twin caveat on a surface that shows the headline, that the
    headline is computed as usual and what it does not measure (the name is
    historical: it used to speak of the retired quality tier). Empty list
    when there is nothing to say."""
    first = indent if first_indent is None else first_indent
    lines: list[str] = []
    for c in caveats or []:
        head = ("⚠ SCORE CAVEAT" if c.get("severity") == "major"
                else "⚠ score note")
        message = str(c.get("message", "")).rstrip()
        if message and message[-1] not in ".!?…":
            message += "."
        text = f"{head} ({c.get('source', '?')}): {message}"
        if (tier_note and c.get("kind") == NEAR_TWIN
                and c.get("recall_not_translation")):
            text += (" The chrF++ headline below is computed as usual; here "
                     "it does not measure translation.")
        wrapped = textwrap.wrap(
            text, width=max(20, width - max(len(first), len(indent) + 2)))
        for i, w in enumerate(wrapped):
            lines.append((first + w) if i == 0 else (indent + "  " + w))
    return lines


def for_run_card(caveats: list[dict]) -> list[dict]:
    """The caveats as stored on a published run card: plain JSON objects
    whose strings fit the database's aggregate-shape caps."""
    stored = []
    for c in caveats or []:
        item = {k: v for k, v in c.items() if v is not None}
        item["message"] = _cap(item.get("message", ""))
        stored.append(item)
    return stored
