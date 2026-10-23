"""leak-audit — screen any corpus against every registered eval set.

What counts as a leak, in plain words (this is also what the CLI prints):

  whole-file      the corpus file IS a registered eval file (sha256 equal) —
                  training on the test file itself; refused outright.
  exact           the row's SOURCE or TARGET is identical to an eval row's,
                  after case/punctuation/spacing normalization (and a pack
                  canonicalizer, if any). DROPPED. The target-side lane is
                  forge's addition — target sharing is exactly how the crk
                  textbook leaked.
  near-duplicate  the row's TARGET overlaps an eval ANSWER at token-set
  answer          Jaccard ≥ 0.6 (diacritics folded, so spelling variants
                  count) AND the difference is only words ADDED or REMOVED —
                  one contains the other — or the two are ≥ 0.9 identical.
                  The model would be shown (most of) the answer. DROPPED.
                  (crk 2026-07-12: same-domain documents share reworded
                  lines; "otânisa wâpamêyiwa iskwêwa" is a fragment of the
                  test answer "john otânisa wâpamêyiwa iskwêwa".)

What is KEPT on purpose (reported, never removed by clean() — unless the
caller asks for drop_test_twins, below):

  template        the TARGET overlaps an eval answer ≥ 0.6 but each side has
  sibling         a word the other lacks — a SUBSTITUTION ("I see the dog" vs
                  "I see the cat"). The model must still produce the word it
                  never saw in that frame: in-distribution practice, not the
                  answer. Templated school/textbook corpora are full of these
                  (a synthetic user lost 1,258 of 1,600 pairs to them before
                  2026-10). The eval rows that have such a sibling are listed
                  so scoring can report the strict subset (the template
                  optimism) instead of hiding it.
  same prompt,    the SOURCE near-duplicates an eval source but the target is
  different       a different answer — a legitimate minimal contrast
  answer          (crk 2026-07-13: 24/44 of forge's first gold flags were
                  this false positive).

What clean(..., drop_test_twins=True) ALSO drops (the CLI's
``--drop-test-twins``, with ``--clean-to``):

  test twin       the row is a NEAR-TWIN of a registered test/sealed row:
                  identical, or token-set Jaccard ≥ NEAR_TWIN_JACCARD on the
                  source or the target side — the measure the near-twin
                  forecast and the battery's strict score use, so the cleaned
                  file forecasts zero twins. For a FIXED test set (teacher-
                  written, registered, not carved by split) whose every row
                  has a template twin in training, keeping siblings as
                  practice makes the test score recall of training phrases,
                  and ``split --near-dupe`` cannot help — forge did not carve
                  that test set (school user, Round 4, 2026-10: 200/200
                  teacher-written rows twinned, chrF++ 67.08 read as recall
                  on every output, no lever). Refused when it would leave
                  nothing to train on.

pair_mode="target-anchored" (default) is the above. pair_mode="either-side"
restores the pre-2026-07-13 behavior (Jaccard ≥ threshold on EITHER side is
fatal, no template distinction) for callers that want it.

DETERMINISM: the screen iterates eval sets by name and eval rows in file
order, never in hash order, and records EVERY set a row hits (a row that
near-dupes both the dev and the test set counts in both). Same corpus + same
registered sets ⇒ byte-identical report, across processes and
PYTHONHASHSEED values. (Before 2026-10 the per-set counts depended on string
hash order and changed between runs.)

The screen earned its keep in the reference work: the Okimāsis harvest
(489/489 lines caught — it IS the gold textbook), the Elections
mini-guides (27/27), Little Cree Books (46/46). Run it on every harvest,
every synthetic corpus, and every backtranslation mono file.

Manifests are content-free (counts, row indices, key hashes) — audit
artifacts must be committable without hosting corpus text. The human
rendering (:func:`render_audit`) may quote CORPUS rows (the user's own
training data) as examples; it never prints eval-set text, and it never
quotes a corpus row that matched a SEALED set. Nor does it quote a row when
the harness withholds text for the corpus itself or for the set the row
matched (local-only, sealed, consent-required — ``nmt_forge.privacy``): a
row that matched a private test answer IS (most of) that answer. Those are
shown by line number, with one line saying why; ``show_text`` (the CLI's
``--show-text``, for a person at the terminal) lifts it.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from ..canonical import (
    Canonicalizer,
    canonical_key,
    detect_target_field,
    fold_key,
    jaccard,
    key_hash,
    sha256_file,
    similarity_units,
)
from ..errors import LeakageError, TrainingWouldBeEmpty
from ..registry import load_rows
from ..workspace import Workspace

_INDEX_CAP = 50  # row indices kept per (set, lane) in the report
_EXAMPLE_CAP = 5  # examples kept per lane

#: The near-twin threshold (token-set Jaccard, side-matched). ONE number for
#: the before-training forecast, the battery's near-dupe lane (the strict
#: score export reports) and drop_test_twins — so the rows a user is warned
#: about are the rows the option drops, and the cleaned file forecasts zero
#: twins. ``ci_scoring`` re-exports it.
NEAR_TWIN_JACCARD = 0.6

#: lanes that clean() removes, and the ones it keeps on purpose
FATAL_LANES = ("exact_source", "exact_target", "near_dupe")
KEPT_LANES = ("near_dupe_template", "near_dupe_source_only")

LANE_EXPLANATIONS = {
    "exact_source": "identical PROMPT: the row's source equals an eval row's "
                    "source (after case/punctuation/spacing normalization)",
    "exact_target": "identical ANSWER: the row's target equals an eval row's "
                    "reference (after case/punctuation/spacing normalization)",
    "near_dupe": "near-duplicate ANSWER: the row's target overlaps an eval "
                 "answer and only adds/removes words (or is ≥{fatal:.0%} "
                 "identical, diacritics folded) — the model would be shown "
                 "(most of) the answer",
    "near_dupe_template": "template sibling: shares a sentence frame with an "
                          "eval answer but swaps a word each way ('I see the "
                          "dog' vs 'I see the cat') — the model must still "
                          "produce the word it never saw; practice, not the "
                          "answer",
    "near_dupe_source_only": "similar prompt, different answer: the source "
                             "near-duplicates (but is not identical to) an "
                             "eval source and the target is a different "
                             "answer — a minimal contrast. An IDENTICAL "
                             "prompt is dropped whatever its answer",
}


def _empty_set_stats(role: str) -> dict:
    return {
        "role": role,
        "exact_source": 0,
        "exact_target": 0,
        "near_dupe": 0,
        "near_dupe_template": 0,
        "near_dupe_source_only": 0,
        "row_indices": [],
        "key_hashes": [],
        "eval_rows_with_template_sibling": [],
    }


@dataclass
class AuditReport:
    corpus_rows: int
    params: dict
    per_set: dict[str, dict] = field(default_factory=dict)
    whole_file_match: str | None = None
    leaking_row_indices: set[int] = field(default_factory=set)
    informational_row_indices: set[int] = field(default_factory=set)
    template_row_indices: set[int] = field(default_factory=set)
    # per lane: up to _EXAMPLE_CAP content-free example records
    # {row, set, role, eval_row, similarity, relation}
    examples: dict[str, list[dict]] = field(default_factory=dict)
    # set by clean(..., drop_test_twins=True): what plan_twin_drop dropped
    # (content-free: counts, row indices, forecasts). None = not asked.
    test_twins: dict | None = None
    # the near-twin forecast against the cleaned rows (registered set →
    # NearTwin), measured by that same plan; kept out of the manifest
    near_twin_after: dict | None = field(default=None, repr=False)

    def twin_row_indices(self) -> set[int]:
        """Rows drop_test_twins removed (beyond the leak lanes)."""
        return set((self.test_twins or {}).get("removed_row_indices", ()))

    def removed_row_indices(self) -> set[int]:
        """Every row the cleaned file leaves out: leaks + test twins."""
        return self.leaking_row_indices | self.twin_row_indices()

    @property
    def total_hits(self) -> int:
        return sum(
            s["exact_source"] + s["exact_target"] + s["near_dupe"]
            for s in self.per_set.values()
        )

    def fatal_hits(self) -> dict[str, dict]:
        """Hits against test/sealed sets — the ones assert_clean refuses on."""
        return {
            n: s for n, s in self.per_set.items()
            if s["role"] in ("test", "sealed")
            and (s["exact_source"] or s["exact_target"] or s["near_dupe"])
        }

    def kept_row_indices(self) -> set[int]:
        """Rows reported but deliberately kept (template + source-only),
        minus any drop_test_twins removed."""
        return (self.informational_row_indices
                | self.template_row_indices) - self.removed_row_indices()

    def to_manifest(self) -> dict:
        doc = {
            "guard": "leak-audit",
            "corpus_rows": self.corpus_rows,
            "whole_file_match": self.whole_file_match,
            "per_set": self.per_set,
            "leaking_rows": len(self.leaking_row_indices),
            "template_rows": len(self.template_row_indices
                                 - self.leaking_row_indices),
            "informational_rows": len(self.informational_row_indices
                                      - self.leaking_row_indices),
            "kept_rows_reported": len(self.kept_row_indices()),
            "examples": self.examples,
            "lanes": {
                "dropped": list(FATAL_LANES),
                "kept": list(KEPT_LANES),
            },
            "params": self.params,
        }
        if self.test_twins is not None:
            doc["test_twins"] = self.test_twins
        return doc


def _eval_index(eval_sets: dict[str, dict], min_tokens: int):
    """Exact-key sets + an inverted unit index for near-dupe candidates.

    Built in a FIXED order — sets by name, keys in eval-file row order (or
    sorted, for prebuilt key sets without row maps) — so candidate iteration
    never depends on string hash order. Units are computed on the
    diacritic-FOLDED key: a spelling variant of an answer is still that
    answer. Whitespace tokens where the language has them, character n-grams
    where it doesn't (see canonical.similarity_units) — the screen must not
    go silently inert for spaceless scripts.
    """
    exact: dict[str, dict[str, set[str]]] = {}
    # (set, side, units, eval_row)
    unitsets: list[tuple[str, str, frozenset[str], int | None]] = []
    unit_index: dict[str, list[int]] = {}
    for name in sorted(eval_sets):
        ks = eval_sets[name]
        exact[name] = {"source": ks["source"], "target": ks["target"]}
        for side in ("source", "target"):
            row_map = ks.get(f"{side}_rows")
            ordered = (sorted(row_map.items(), key=lambda kv: kv[1])
                       if row_map else [(k, None) for k in sorted(ks[side])])
            for key, eval_row in ordered:
                units = similarity_units(fold_key(key), min_tokens=min_tokens)
                if units:
                    idx = len(unitsets)
                    unitsets.append((name, side, units, eval_row))
                    for u in units:
                        unit_index.setdefault(u, []).append(idx)
    return exact, unitsets, unit_index


def _relation(corpus_units: frozenset[str], eval_units: frozenset[str],
              j: float, fatal_jaccard: float) -> str:
    """How a ≥-threshold pair differs: 'contains' (the row holds the whole
    answer), 'fragment' (the row is part of the answer), 'near-identical'
    (≥ fatal_jaccard), or 'substitution' (each side has a word the other
    lacks — a template sibling)."""
    if eval_units <= corpus_units:
        return "contains"
    if corpus_units <= eval_units:
        return "fragment"
    if j >= fatal_jaccard:
        return "near-identical"
    return "substitution"


def leak_audit(
    corpus: list[dict] | str | Path,
    workspace_or_sets: Workspace | dict[str, dict],
    *,
    jaccard_threshold: float = 0.6,
    fatal_jaccard: float = 0.9,
    min_tokens: int = 3,
    canonicalizer: Canonicalizer | None = None,
    source_field: str = "source",
    target_field: str | None = None,
    roles: tuple[str, ...] = ("dev", "test", "sealed"),
    pair_mode: str = "target-anchored",
) -> AuditReport:
    """Audit a corpus (rows or a file path) against registered eval sets.

    ``workspace_or_sets`` is a :class:`Workspace` (all registered sets of the
    given roles are screened) or a prebuilt ``{name: {"source": set,
    "target": set, "role": str}}`` mapping (optionally with
    ``source_rows``/``target_rows`` key→row-index maps).
    """
    corpus_path: Path | None = None
    if isinstance(corpus, (str, Path)):
        corpus_path = Path(corpus)
        rows = load_rows(corpus_path)
    else:
        rows = corpus
    if target_field is None:
        target_field = detect_target_field(rows)

    whole_file: str | None = None
    if isinstance(workspace_or_sets, Workspace):
        if corpus_path is not None:
            hit = workspace_or_sets.registry.entry_for_file(corpus_path)
            if hit is not None:
                whole_file = hit[0]
        eval_sets = workspace_or_sets.registry.key_sets(
            roles=roles, canonicalizer=canonicalizer
        )
    else:
        eval_sets = workspace_or_sets

    if pair_mode not in ("target-anchored", "either-side"):
        raise ValueError(f"unknown pair_mode {pair_mode!r}")
    params = {
        "jaccard_threshold": jaccard_threshold,
        "fatal_jaccard": fatal_jaccard,
        "min_tokens": min_tokens,
        "roles": list(roles),
        "source_field": source_field,
        "target_field": target_field,
        "pair_mode": pair_mode,
        "diacritics_folded_for_near_dupe": True,
        "corpus_sha256": sha256_file(corpus_path) if corpus_path else None,
        "sets_screened": {n: {"role": eval_sets[n]["role"],
                              "rows": eval_sets[n].get("rows")}
                          for n in sorted(eval_sets)},
    }
    report = AuditReport(corpus_rows=len(rows), params=params,
                         whole_file_match=whole_file)
    if whole_file is not None:
        # no row-level work needed; the whole file is an eval file
        report.leaking_row_indices = set(range(len(rows)))

    exact, unitsets, unit_index = _eval_index(eval_sets, min_tokens)
    per_set: dict[str, dict] = {
        name: _empty_set_stats(eval_sets[name]["role"])
        for name in sorted(eval_sets)
    }
    template_eval_rows: dict[str, set[int]] = {n: set() for n in per_set}
    dropped_rows: dict[str, set[int]] = {n: set() for n in per_set}
    # the dropped rows by kind (disjoint: exact beats near-dupe per set) —
    # COPIES of an eval row (its prompt or its answer, verbatim after
    # normalization) and near-duplicates of an answer, plus the distinct
    # eval rows the copies reproduce. Round 13 hospital persona: the audit
    # called all 90 rows it dropped for an 80-row dev set "your dev set's
    # own rows"; 80 were the dev rows, 10 near-duplicates of their answers.
    copy_rows: dict[str, set[int]] = {n: set() for n in per_set}
    copied_eval_rows: dict[str, set[int]] = {n: set() for n in per_set}
    near_dupe_rows: dict[str, set[int]] = {n: set() for n in per_set}
    unmapped_copies: set[str] = set()

    def _record(name: str, lane: str, i: int, key: str, *,
                eval_row: int | None = None, similarity: float | None = None,
                relation: str | None = None) -> None:
        s = per_set[name]
        s[lane] += 1
        if len(s["row_indices"]) < _INDEX_CAP:
            s["row_indices"].append(i)
            s["key_hashes"].append(key_hash(key))
        if lane == "near_dupe_source_only":
            report.informational_row_indices.add(i)
        elif lane == "near_dupe_template":
            report.template_row_indices.add(i)
            if eval_row is not None:
                template_eval_rows[name].add(eval_row)
        else:
            report.leaking_row_indices.add(i)
            dropped_rows[name].add(i)
            if lane == "near_dupe":
                near_dupe_rows[name].add(i)
            else:
                copy_rows[name].add(i)
                if eval_row is not None:
                    copied_eval_rows[name].add(eval_row)
                else:           # a set given without row maps: unknown
                    unmapped_copies.add(name)
        ex = report.examples.setdefault(lane, [])
        if len(ex) < _EXAMPLE_CAP:
            rec = {"row": i, "set": name, "role": s["role"],
                   "eval_row": eval_row}
            if similarity is not None:
                rec["similarity"] = round(similarity, 3)
            if relation is not None:
                rec["relation"] = relation
            ex.append(rec)

    def _matches_per_set(units: frozenset[str], side: str
                         ) -> dict[str, list[tuple[float, frozenset, int | None]]]:
        """Every eval line on ``side`` at or above the threshold, per set, in
        eval-index order (never hash order)."""
        counts: Counter = Counter()
        for u in sorted(units):
            for idx in unit_index.get(u, ()):
                counts[idx] += 1
        found: dict[str, list[tuple[float, frozenset, int | None]]] = {}
        for idx in sorted(counts):
            name, ev_side, ev_units, eval_row = unitsets[idx]
            if ev_side != side:
                continue
            # cheap upper bound before the exact Jaccard
            if counts[idx] / min(len(units), len(ev_units)) < jaccard_threshold:
                continue
            j = jaccard(units, ev_units)
            if j >= jaccard_threshold:
                found.setdefault(name, []).append((j, ev_units, eval_row))
        return found

    for i, row in enumerate(rows):
        s_key = canonical_key(str(row.get(source_field, "")), canonicalizer)
        t_key = canonical_key(str(row.get(target_field, "")), canonicalizer)
        exact_sets: set[str] = set()
        for name in per_set:
            ks = exact[name]
            if s_key and s_key in ks["source"]:
                _record(name, "exact_source", i, s_key,
                        eval_row=(eval_sets[name].get("source_rows") or {}
                                  ).get(s_key))
                exact_sets.add(name)
            if t_key and t_key in ks["target"]:
                _record(name, "exact_target", i, t_key,
                        eval_row=(eval_sets[name].get("target_rows") or {}
                                  ).get(t_key))
                exact_sets.add(name)

        t_units = similarity_units(fold_key(t_key), min_tokens=min_tokens)
        s_units = similarity_units(fold_key(s_key), min_tokens=min_tokens)
        t_found = _matches_per_set(t_units, "target") if t_units else {}
        s_found = _matches_per_set(s_units, "source") if s_units else {}

        def _best(matches):
            # highest overlap, earliest eval row on ties
            return max(matches, key=lambda m: (m[0], -(m[2] or 0)))

        for name in per_set:
            if name in exact_sets:
                continue  # exact beats near-dupe; don't double-count
            if name in t_found:
                matches = t_found[name]
                rated = [(m, _relation(t_units, m[1], m[0], fatal_jaccard))
                         for m in matches]
                fatal = [(m, r) for m, r in rated if r != "substitution"]
                if fatal or pair_mode == "either-side":
                    # ANY eval answer this row contains / is a fragment of /
                    # nearly equals makes it a leak — not just the closest one
                    (j, _, eval_row), rel = max(
                        fatal or rated, key=lambda mr: (mr[0][0],
                                                        -(mr[0][2] or 0)))
                    _record(name, "near_dupe", i, t_key, eval_row=eval_row,
                            similarity=j, relation=rel)
                else:
                    j, _, eval_row = _best(matches)
                    _record(name, "near_dupe_template", i, t_key,
                            eval_row=eval_row, similarity=j,
                            relation="substitution")
                    template_eval_rows[name].update(
                        m[2] for m in matches if m[2] is not None)
                continue
            if name in s_found:
                j, ev_units, eval_row = _best(s_found[name])
                if pair_mode == "target-anchored":
                    # answer differs → minimal contrast, not a leak:
                    # informational lane (never fatal, never removed)
                    _record(name, "near_dupe_source_only", i, s_key,
                            eval_row=eval_row, similarity=j)
                else:
                    _record(name, "near_dupe", i, s_key, eval_row=eval_row,
                            similarity=j,
                            relation=_relation(s_units, ev_units, j,
                                               fatal_jaccard))

    for name, ev_rows in template_eval_rows.items():
        per_set[name]["eval_rows_with_template_sibling"] = sorted(ev_rows)
        # distinct corpus rows --clean-to drops because of THIS set (a row
        # can hit several lanes, so the lane counts above may sum higher)
        per_set[name]["dropped_rows"] = len(dropped_rows[name])
        # ... split by kind: copy_rows + near_dupe_rows == dropped_rows;
        # copied_eval_rows = how many of the set's own rows those copies
        # reproduce (fewer than copy_rows when the corpus repeats a row)
        per_set[name]["copy_rows"] = len(copy_rows[name])
        per_set[name]["copied_eval_rows"] = (
            None if name in unmapped_copies else len(copied_eval_rows[name]))
        per_set[name]["near_dupe_rows"] = len(near_dupe_rows[name])
    report.per_set = per_set
    return report


def near_twin_flags(
    eval_rows: list[dict],
    corpus: list[dict] | str | Path,
    *,
    jaccard_threshold: float = NEAR_TWIN_JACCARD,
    min_tokens: int = 3,
    canonicalizer: Canonicalizer | None = None,
    source_field: str = "source",
    target_field: str | None = None,
    eval_source_field: str = "source",
    eval_target_field: str | None = None,
) -> dict:
    """Flag EVAL rows that have a near-twin (or exact twin) in ``corpus``.

    The reverse direction of :func:`leak_audit`: instead of asking which
    corpus rows leak, this asks which eval rows a trained model has already
    seen a sibling of — the rows whose scores carry an optimism bound.
    Comparison is side-matched (eval source vs corpus sources, eval target vs
    corpus targets) at the same Jaccard threshold as the audit.

    Returns a content-free dict: ``{"indices": set[int], "params": {...}}``
    (row indices into ``eval_rows``; no sentence text — same discipline as
    the audit manifests).
    """
    if isinstance(corpus, (str, Path)):
        corpus = load_rows(corpus)
    if target_field is None:
        target_field = detect_target_field(corpus)
    if eval_target_field is None:
        eval_target_field = detect_target_field(eval_rows)

    def _index(rows: list[dict], f: str):
        exact: set[str] = set()
        unitsets: list[frozenset[str]] = []
        unit_index: dict[str, set[int]] = {}
        for r in rows:
            key = canonical_key(str(r.get(f, "")), canonicalizer)
            if key:
                exact.add(key)
            units = similarity_units(key, min_tokens=min_tokens)
            if units:
                idx = len(unitsets)
                unitsets.append(units)
                for u in units:
                    unit_index.setdefault(u, set()).add(idx)
        return exact, unitsets, unit_index

    sides = {
        eval_source_field: _index(corpus, source_field),
        eval_target_field: _index(corpus, target_field),
    }

    flagged: set[int] = set()
    for i, row in enumerate(eval_rows):
        for ev_f, (exact, unitsets, unit_index) in sides.items():
            key = canonical_key(str(row.get(ev_f, "")), canonicalizer)
            if key and key in exact:
                flagged.add(i)
                break
            units = similarity_units(key, min_tokens=min_tokens)
            if not units:
                continue
            counts = Counter()
            for u in units:
                for idx in unit_index.get(u, ()):
                    counts[idx] += 1
            hit = False
            for idx, shared in counts.items():
                cu = unitsets[idx]
                if shared / min(len(units), len(cu)) < jaccard_threshold:
                    continue
                if jaccard(units, cu) >= jaccard_threshold:
                    hit = True
                    break
            if hit:
                flagged.add(i)
                break
    return {
        "indices": flagged,
        "params": {
            "jaccard_threshold": jaccard_threshold,
            "min_tokens": min_tokens,
            "corpus_rows": len(corpus),
        },
    }


def near_twin_corpus_rows(
    eval_rows: list[dict],
    corpus: list[dict] | str | Path,
    *,
    jaccard_threshold: float = NEAR_TWIN_JACCARD,
    min_tokens: int = 3,
    canonicalizer: Canonicalizer | None = None,
    source_field: str = "source",
    target_field: str | None = None,
    eval_source_field: str = "source",
    eval_target_field: str | None = None,
) -> set[int]:
    """The CORPUS rows that are a near-twin (or exact twin) of any eval row —
    :func:`near_twin_flags` seen from the corpus side.

    The relation is symmetric (identical canonical key, or token-set Jaccard
    ≥ ``jaccard_threshold``, source against source and target against
    target), so this IS ``near_twin_flags`` with the roles swapped: drop
    every row returned here and ``near_twin_flags`` finds no eval row with a
    twin in what is left. Returns row indices into ``corpus`` (no text).
    """
    if isinstance(corpus, (str, Path)):
        corpus = load_rows(corpus)
    if not corpus or not eval_rows:
        return set()
    if target_field is None:
        target_field = detect_target_field(corpus)
    if eval_target_field is None:
        eval_target_field = detect_target_field(eval_rows)
    return near_twin_flags(
        corpus, eval_rows, jaccard_threshold=jaccard_threshold,
        min_tokens=min_tokens, canonicalizer=canonicalizer,
        source_field=eval_source_field, target_field=eval_target_field,
        eval_source_field=source_field, eval_target_field=target_field,
    )["indices"]


def plan_twin_drop(
    rows: list[dict],
    workspace: Workspace,
    *,
    exclude: set[int] | frozenset[int] = frozenset(),
    roles: tuple[str, ...] = ("test", "sealed"),
    source_field: str = "source",
    target_field: str | None = None,
    canonicalizer: Canonicalizer | None = None,
) -> tuple[dict, dict[str, dict]]:
    """Which training rows are near-twins of a registered test/sealed row,
    and what dropping them does to the near-twin forecast.

    ``rows`` is the corpus; ``exclude`` the rows already leaving it (the leak
    lanes). Each registered set is read ONCE, through the registry's audited
    path (purpose ``audit`` — ledgered, never a spend), and compared at
    :data:`NEAR_TWIN_JACCARD` — the forecast's own threshold.

    Returns ``(plan, after)``: ``plan`` is content-free — ``{jaccard_threshold,
    rows_considered, dropped, rows_left, removed_row_indices (0-based, into
    rows), per_set: {name: {role, n, twin_rows, near_twin_rows_before,
    near_twin_rows_after, strict_n_before, strict_n_after}}, near_twin_before:
    {name: NearTwin}}``; ``after`` is the forecast against the rows left
    (``{name: NearTwin}``, empty when none are left). A training row that
    twins rows of two sets counts once in ``dropped``, once per set in
    ``twin_rows``.
    """
    from .ci_scoring import near_twin_forecast

    if target_field is None:
        target_field = detect_target_field(rows)
    keep = [i for i in range(len(rows)) if i not in exclude]
    candidate = [rows[i] for i in keep]
    sets: dict[str, tuple[dict, list[dict]]] = {}
    twins: set[int] = set()
    twin_rows: dict[str, int] = {}
    for name in workspace.registry.names(roles=roles):
        entry = workspace.registry.get(name)
        ev = workspace.registry.open_eval(name, "audit")
        sets[name] = (entry, ev)
        hit = {keep[j] for j in near_twin_corpus_rows(
            ev, candidate, jaccard_threshold=NEAR_TWIN_JACCARD,
            canonicalizer=canonicalizer, source_field=source_field,
            target_field=target_field,
            eval_source_field=entry["source_field"],
            eval_target_field=entry["target_field"])}
        twin_rows[name] = len(hit)
        twins |= hit
    left = [rows[i] for i in keep if i not in twins]

    def _forecast(entry: dict, ev: list[dict], corpus: list[dict]) -> dict:
        return {"role": entry["role"], **near_twin_forecast(
            ev, corpus, eval_source_field=entry["source_field"],
            eval_target_field=entry["target_field"],
            source_field=source_field, target_field=target_field,
            canonicalizer=canonicalizer, jaccard_threshold=NEAR_TWIN_JACCARD)}

    before = {n: _forecast(e, ev, candidate) for n, (e, ev) in sets.items()}
    after = ({n: _forecast(e, ev, left) for n, (e, ev) in sets.items()}
             if left else {})
    per_set = {}
    for name, (entry, ev) in sets.items():
        b, a = before[name], after.get(name)
        per_set[name] = {
            "role": entry["role"], "n": len(ev), "twin_rows": twin_rows[name],
            "near_twin_rows_before": b["near_twin_rows"],
            "near_twin_rows_after": a["near_twin_rows"] if a else None,
            "strict_n_before": b["strict_n"],
            "strict_n_after": a["strict_n"] if a else None,
        }
    plan = {
        "jaccard_threshold": NEAR_TWIN_JACCARD,
        "rows_considered": len(candidate),
        "dropped": len(twins),
        "rows_left": len(left),
        "removed_row_indices": sorted(twins),
        "per_set": per_set,
        "near_twin_before": before,
    }
    return plan, after


def assert_clean(
    corpus,
    workspace_or_sets,
    **kwargs,
) -> AuditReport:
    """Audit and REFUSE on any hit against a test/sealed set (or whole-file).

    Dev-set hits are reported but not fatal — dev is iteration data; keeping
    train and dev disjoint is split-guard's job at carve time.
    """
    report = leak_audit(corpus, workspace_or_sets, **kwargs)
    if report.whole_file_match is not None:
        raise LeakageError(
            f"this corpus file IS the registered eval set "
            f"{report.whole_file_match!r} (content hash identical)",
            why="training on the test file itself makes every score on it "
                "meaningless",
            fix="remove it from the training mix; if you meant to train on a "
                "dev carve, point at the train side `nmt-forge split` wrote "
                "(data/split/train.jsonl)",
        )
    fatal = report.fatal_hits()
    if fatal:
        detail = "; ".join(
            f"{name}: {s['exact_source']} identical prompt(s), "
            f"{s['exact_target']} identical answer(s), "
            f"{s['near_dupe']} near-duplicate answer(s)"
            + (f" — plus {s['near_dupe_template']} template sibling(s) and "
               f"{s['near_dupe_source_only']} similar-prompt/different-answer "
               "row(s), which are KEPT"
               if (s.get("near_dupe_template")
                   or s.get("near_dupe_source_only")) else "")
            for name, s in fatal.items()
        )
        raise LeakageError(
            f"corpus leaks into {len(fatal)} test/sealed set(s) — {detail}",
            why="a training row that IS (or contains, or is a fragment of) a "
                "test answer turns its score into a memory test; the crk "
                "screen caught 489/489 Okimāsis lines this way — the harvest "
                "WAS the textbook",
            fix="nmt-forge leak-audit <corpus> --clean-to <corpus.clean.jsonl> "
                "drops exactly those rows and explains each kind (template "
                "siblings are kept); then train on the cleaned file (library: "
                "nmt_forge.guards.leak_audit.clean(...))",
        )
    return report


def clean(
    corpus,
    workspace_or_sets,
    *,
    manifest_path: str | Path | None = None,
    drop_test_twins: bool = False,
    **kwargs,
) -> tuple[list[dict], AuditReport]:
    """Return rows surviving the audit + the report; optionally write manifest.

    The manifest is the audit trail: committing it next to a corpus is how a
    later reader knows the screen ran and what it removed.

    ``drop_test_twins`` (needs a :class:`Workspace`) also drops the rows that
    are near-twins of a registered test/sealed row (:func:`plan_twin_drop`);
    ``report.test_twins`` says how many and what the forecast became, and
    ``report.near_twin_after`` is the forecast against the survivors. If that
    would leave no row to train on it raises :class:`TrainingWouldBeEmpty`
    BEFORE anything is written.
    """
    corpus_path: Path | None = Path(corpus) if isinstance(corpus, (str, Path)) else None
    report = leak_audit(corpus, workspace_or_sets, **kwargs)
    rows = load_rows(corpus_path) if corpus_path is not None else corpus
    if drop_test_twins:
        if not isinstance(workspace_or_sets, Workspace):
            raise ValueError("drop_test_twins needs a Workspace: twins are "
                             "measured against the registered test/sealed "
                             "sets' rows, not prebuilt key sets")
        plan, after = plan_twin_drop(
            rows, workspace_or_sets, exclude=report.leaking_row_indices,
            source_field=kwargs.get("source_field", "source"),
            target_field=report.params["target_field"],
            canonicalizer=kwargs.get("canonicalizer"))
        if plan["dropped"] and not plan["rows_left"]:
            sets = ", ".join(plan["per_set"])
            raise TrainingWouldBeEmpty(
                f"dropping the training rows that are near-twins of your "
                f"test set ({sets}) would leave NOTHING to train on: all "
                f"{plan['rows_considered']:,} row(s) left after the leak "
                "screen are near-twins of a test row. Nothing was written",
                why="every training sentence shares its frame with a test "
                    "sentence, so whatever this corpus teaches, the test set "
                    "already contains it — there is no training set that "
                    "leaves this test set measuring translation",
                fix="get test sentences written independently of this corpus "
                    "(by someone who has not seen it) and register them "
                    "(`nmt-forge registry add <name> <file> --role test`); "
                    "or clean without --drop-test-twins and report the test "
                    "score as recall of training phrases, as forge will say "
                    "it is",
            )
        report.test_twins = plan
        report.near_twin_after = after
    removed = report.removed_row_indices()
    survivors = [r for i, r in enumerate(rows) if i not in removed]
    manifest = report.to_manifest()
    manifest["rows_removed"] = len(rows) - len(survivors)
    manifest["rows_kept"] = len(survivors)
    manifest["removed_row_indices"] = sorted(removed)
    if manifest_path is not None:
        Path(manifest_path).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return survivors, report


# -- human rendering ------------------------------------------------------------

def _clip(text: str, n: int = 70) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 1] + "…"


def _lane_totals(report: AuditReport) -> dict[str, int]:
    """Hits per lane summed over sets (a row hitting two sets counts twice
    here; the DROPPED/KEPT headlines count distinct rows)."""
    return {lane: sum(st[lane] for st in report.per_set.values())
            for lane in FATAL_LANES + KEPT_LANES}


def render_twin_drop(plan: dict) -> list[str]:
    """Plain-language lines for :func:`plan_twin_drop`'s plan: how many rows
    drop_test_twins dropped, per test set, and what the strict subset (test
    rows with no twin in training) went from and to."""
    thr = plan["jaccard_threshold"]
    lines = ["", f"ALSO DROPPED by --drop-test-twins: {plan['dropped']:,} "
                 "row(s) — near-twins of a test row (identical, or sharing "
                 f"≥ {thr:.0%} of their words on the source or the target "
                 "side: the measure the test-score near-twin check uses)"]
    if not plan["dropped"]:
        lines.append("  none — no training row is a near-twin of a test row")
    for name, st in plan["per_set"].items():
        after = (st["strict_n_after"] if st["strict_n_after"] is not None
                 else "no training rows")
        lines.append(
            f"  {name} ({st['role']}): {st['twin_rows']:,} training row(s) "
            f"dropped · strict subset: {st['strict_n_before']} → {after} of "
            f"{st['n']} test rows")
    if plan["dropped"]:
        lines.append(
            f"  training keeps {plan['rows_left']:,} of "
            f"{plan['rows_considered']:,} row(s). Without this option rows "
            "like these stay in training as practice (template siblings); "
            "against a FIXED test set they turn its score into recall of "
            "training phrases. Fewer rows to learn from — but the test score "
            "now measures sentences the model has not seen a twin of.")
    return lines


def default_clean_path(corpus) -> str:
    """Where the verdict's fix command writes the cleaned file:
    ``<corpus stem>.clean.jsonl`` beside the corpus."""
    c = Path(str(corpus))
    return str(c.with_name(c.stem + ".clean.jsonl"))


def default_twin_free_path(corpus, clean_to=None) -> str:
    """Where the twin-free corpus goes: beside the all-data clean file, named
    ``<name>.notwins.jsonl`` (``corpus.clean.jsonl`` → ``corpus.notwins.jsonl``,
    the guide's name) — NEVER the all-data file itself.

    Round 10 (hospital persona): the SEVERE verdict's fix reused the plain
    audit's ``--clean-to`` path, so running it as printed overwrote the corpus
    the all-data model trains on with the twin-free one."""
    base = Path(str(clean_to)) if clean_to else Path(default_clean_path(corpus))
    name = base.name
    for suffix in (".clean.jsonl", ".notwins.jsonl", ".jsonl", ".tsv"):
        if name.endswith(suffix):
            stem = name[: -len(suffix)]
            break
    else:
        stem = base.stem
    return str(base.with_name((stem or "corpus") + ".notwins.jsonl"))


#: Index lists the ``--json`` payload shortens by default (Round 10: an
#: agent's leak-audit answer was thousands of tokens of row numbers before
#: the verdict). The audit file written beside the cleaned corpus keeps them
#: in full; ``--full-indices`` prints them in full.
INDEX_LIST_KEYS = ("row_indices", "key_hashes",
                   "eval_rows_with_template_sibling", "removed_row_indices")
INDEX_PREVIEW = 5


def summarize_indices(doc, keep: int = INDEX_PREVIEW):
    """A copy of a leak-audit payload with every long index list replaced by
    ``{"count": n, "first": [the first ``keep``]}`` — a different shape on
    purpose, so a consumer that expected the full list fails loudly instead
    of reading five items as all of them. Lists of ``keep`` or fewer stay
    lists. Nothing else changes."""
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if (k in INDEX_LIST_KEYS and isinstance(v, list)
                    and len(v) > keep):
                out[k] = {"count": len(v), "first": v[:keep]}
            else:
                out[k] = summarize_indices(v, keep)
        return out
    if isinstance(doc, list):
        return [summarize_indices(v, keep) for v in doc]
    return doc


def dev_leak_breakdown(report: AuditReport) -> dict:
    """The rows an audit drops because of the registered DEV set(s), by
    kind — counts only: ``{leaking_rows, copy_rows, copied_eval_rows,
    duplicate_rows, near_dupe_rows, registered_rows}``.

    ``copy_rows`` are copies of a dev row (its prompt or its answer,
    verbatim after normalization); ``copied_eval_rows`` how many distinct
    dev rows they reproduce, so ``duplicate_rows`` are the corpus's extra
    copies; ``near_dupe_rows`` near-duplicates of a dev answer (they hold
    it, are part of it, or are ≥ ``fatal_jaccard`` identical) — NOT the dev
    set's rows. Round 13 hospital persona: an 80-row dev set and "90 of the
    leaking rows are your registered dev set's own rows" — 80 were, 10 were
    near-duplicates of their answers. Audits written before the split by
    kind existed count every dropped row as a copy."""
    dev = [st for st in report.per_set.values() if st.get("role") == "dev"]
    leaking = sum(st.get("dropped_rows", 0) for st in dev)
    if all("copy_rows" in st for st in dev):
        copies = sum(st["copy_rows"] for st in dev)
        # a set screened without row maps cannot tell repeats apart
        copied = (copies if any(st.get("copied_eval_rows") is None
                                for st in dev)
                  else sum(st["copied_eval_rows"] for st in dev))
        near = sum(st.get("near_dupe_rows", 0) for st in dev)
    else:
        copies, copied, near = leaking, leaking, 0
    screened = (report.params or {}).get("sets_screened") or {}
    registered = sum(int(v.get("rows") or 0) for v in screened.values()
                     if v.get("role") == "dev") or None
    return {"leaking_rows": leaking, "copy_rows": copies,
            "copied_eval_rows": copied,
            "duplicate_rows": max(0, copies - copied),
            "near_dupe_rows": near, "registered_rows": registered}


def dev_leak_phrase(dev: dict, *, finite: bool = False) -> str:
    """What the dev-matching rows are, after "<N> of them" (``finite``:
    after "<N> of the leaking rows", with a verb) — exact by kind: the dev
    rows themselves, extra copies of them, near-duplicates of their
    answers (:func:`dev_leak_breakdown`)."""
    copies, near = dev["copy_rows"], dev["near_dupe_rows"]
    dups = dev["duplicate_rows"]
    if not near and not dups:
        return ("are your registered dev set's own rows" if finite
                else "your registered dev set's own rows")
    reg = dev.get("registered_rows")
    parts = []
    if copies:
        parts.append(
            f"{copies:,} {'are ' if finite else ''}copies of its own rows"
            + (f" ({copies - dups:,} the rows themselves, {dups:,} "
               f"duplicate{'s' if dups != 1 else ''})" if dups else ""))
    if near:
        parts.append(
            f"{near:,} {'are ' if finite else ''}near-duplicate"
            f"{'s' if near != 1 else ''} of its answers (each contains a dev "
            "answer, is part of one, or is near-identical to one — not a dev "
            "row itself)")
    head = ("match your registered dev set" if finite
            else "matching your registered dev set")
    return (head + (f" ({reg:,} rows)" if reg else "") + ": "
            + " and ".join(parts))


def audit_verdict(report: AuditReport, near_twin: dict[str, dict] | None, *,
                  corpus, clean_to: str | None = None,
                  drop_test_twins: bool = False,
                  carve_check: dict | None = None) -> dict:
    """The audit's decision in one place — what an agent (or a person) reads
    FIRST: one plain sentence, the key numbers, the fix command, and (when
    most test rows have a twin in training) how to choose between an
    all-data model and a twin-free one.

    ``near_twin`` is the forecast against the rows that will be TRAINED on
    (survivors after ``--clean-to``; the corpus minus its leaks otherwise).
    Content-free: counts, set names, paths.
    """
    from .ci_scoring import (AUDIT_BEFORE_SPLIT_NOTE, TWIN_DECISION_NOTE,
                             near_twin_headline)

    corpus = str(corpus)
    leaks = len(report.leaking_row_indices)
    twins = len(report.twin_row_indices())
    dev = dev_leak_breakdown(report)
    dev_rows = dev["leaking_rows"]
    head = near_twin_headline(near_twin or {})
    numbers = {"rows_screened": report.corpus_rows,
               ("leaking_rows_dropped" if clean_to else
                "leaking_rows_would_drop"): leaks,
               # copies of the registered dev rows (the rows themselves, and
               # any repeat of one); the near-duplicates of their answers
               # are counted apart — never called "the dev set's own rows"
               "dev_set_rows_among_them": dev["copy_rows"],
               "dev_set_near_duplicates_among_them": dev["near_dupe_rows"],
               "dev_set_leaking_rows": dev_rows,
               "dev_set_rows_registered": dev["registered_rows"],
               "test_rows_with_near_twin": (
                   {n: {"n": f["n"], "near_twin_rows": f["near_twin_rows"],
                        "strict_n": f["strict_n"]}
                    for n, f in (near_twin or {}).items() if f.get("checked")}
                   or None)}
    if clean_to:
        numbers["near_twin_rows_dropped"] = twins if drop_test_twins else None
        numbers["rows_kept"] = report.corpus_rows - len(
            report.removed_row_indices())
    if report.whole_file_match:
        return {"severity": "severe",
                "summary": (f"This file IS the registered eval set "
                            f"{report.whole_file_match!r} (identical content) — "
                            "do not train on it."),
                "numbers": numbers, "fix": None, "fix_note": None,
                "decision": None, "audit_order": None}
    sentences = []
    severe = bool(head and head["severe"])
    if head and head["severe"]:
        after = " that will be trained on" if clean_to else ""
        if head["near_twin_rows"] == head["n"]:
            sentences.append(
                f"All {head['n']} test rows of {head['set']} have a "
                f"near-twin in the training data{after}: the test score "
                "would measure recall of training phrases, not translation.")
        else:
            sentences.append(
                f"{head['near_twin_rows']} of {head['n']} test rows of "
                f"{head['set']} ({head['share']:.0%}) have a near-twin in the "
                f"training data{after}: the test score would mostly measure "
                f"recall of training phrases; only {head['strict_n']} row(s) "
                "would measure translation.")
    if clean_to:
        dropped = (f"Dropped {leaks:,} leaking row(s)"
                   + (f" and {twins:,} near-twin row(s)" if drop_test_twins
                      else "")
                   + f"; {numbers['rows_kept']:,} kept → {clean_to}.")
        sentences.append(dropped)
        if drop_test_twins and dev_rows:
            # the documented order (twin-free audit AFTER the split): the
            # twin-free model keeps the registered dev set, so its rows
            # leave the twin-free training file — intended, not a warning
            sentences.append(
                f"{dev_rows:,} of the leaking rows "
                + dev_leak_phrase(dev, finite=True)
                + ". The twin-free model keeps that dev set, so they leave "
                  "its training file, as intended.")
        if drop_test_twins and head and not severe:
            sentences.append(
                f"{head['set']}: {head['strict_n']} of {head['n']} test rows "
                "now have no near-twin in training — the score on them "
                "measures translation of unseen sentences.")
    elif leaks:
        sentences.append(
            f"{leaks:,} row(s) would be dropped as leaks (an eval answer or "
            "prompt in the corpus)"
            + (f", {dev_rows:,} of them " + dev_leak_phrase(dev)
               if dev_rows else "") + ".")
    elif not severe:
        sentences.append("No row would be dropped"
                         + (f"; {head['near_twin_rows']} of {head['n']} test "
                            f"rows of {head['set']} have a near-twin in "
                            "training (the strict score on the rest is the "
                            "generalization number)."
                            if head and head["near_twin_rows"] else
                            " and no test row has a near-twin in training."))
    fix = fix_note = None
    if severe and not drop_test_twins:
        # its OWN file: the plain audit's clean_to is the all-data corpus,
        # and the all-data model still trains on it (Round 10)
        fix = (f"nmt-forge leak-audit {corpus} --clean-to "
               f"{default_twin_free_path(corpus, clean_to)} --drop-test-twins")
        if carve_check and carve_check.get("chained"):
            # Round 7: the near-dupe re-split cannot work where the
            # templates chain into one group — never recommend it there
            fix_note = (
                "for a fixed, registered test set. A test side you carved "
                f"with split: --near-dupe {NEAR_TWIN_JACCARD} is no fix on "
                f"this corpus ({carve_check['message']}; a carve hands that "
                "group whole to one side) — write test sentences independently of the training "
                "material and register them, or re-split with capped groups "
                f"(--near-dupe {NEAR_TWIN_JACCARD} --max-group <about half "
                "the test size>; some twins stay, and the split counts them)")
        else:
            fix_note = ("for a fixed, registered test set; a test side you "
                        "carved with split is fixed by re-splitting with "
                        f"--near-dupe {NEAR_TWIN_JACCARD} instead")
    elif leaks and not clean_to:
        fix = (f"nmt-forge leak-audit {corpus} --clean-to "
               f"{default_clean_path(corpus)}")
    severity = ("severe" if severe else
                "warning" if (leaks and not clean_to)
                or (head and head["near_twin_rows"]) else "clean")
    return {
        "severity": severity,
        "summary": " ".join(sentences),
        "numbers": numbers,
        "fix": fix,
        "fix_note": fix_note,
        "decision": (TWIN_DECISION_NOTE
                     if severe or (drop_test_twins and twins) else None),
        "near_dupe_carve_check": carve_check,
        # only where it applies (Round 10): a twin-free audit run after the
        # split — the guide's order — drops the dev rows on purpose
        "audit_order": (AUDIT_BEFORE_SPLIT_NOTE
                        if dev_rows and not drop_test_twins else None),
    }


def render_verdict(verdict: dict) -> list[str]:
    """The verdict block printed right under the audit's headline."""
    mark = {"severe": "⚠ ", "warning": "", "clean": ""}[verdict["severity"]]
    lines = ["", f"{mark}VERDICT: {verdict['summary']}"]
    if verdict.get("fix"):
        lines.append(f"  fix: {verdict['fix']}")
        if verdict.get("fix_note"):
            lines.append(f"       ({verdict['fix_note']})")
    if verdict.get("decision"):
        lines.append(f"  {verdict['decision']}.")
    if verdict.get("audit_order"):
        lines.append(f"  Order: {verdict['audit_order']}.")
    return lines


def render_audit(report: AuditReport, rows: list[dict] | None = None, *,
                 corpus_name: str = "corpus", show_examples: bool = True,
                 source_field: str = "source",
                 target_field: str | None = None,
                 survivors_path: str | None = None,
                 manifest_path: str | None = None,
                 near_twin: dict[str, dict] | None = None,
                 withheld: dict[str, str] | None = None,
                 corpus_withheld: str = "",
                 show_text: bool = False,
                 verdict: dict | None = None) -> str:
    """The plain-language account of an audit: what would be dropped and why,
    what is kept on purpose and why, with examples.

    ``verdict`` (:func:`audit_verdict`) is printed right under the headline,
    so the decisive finding — e.g. every test row has a near-twin in training
    — is read first, with its fix.

    ``near_twin`` (``ci_scoring.registered_near_twin_forecast`` of the rows
    that will be TRAINED on) adds what the kept template siblings will do to
    each test score — said before training, not after export.

    Examples quote CORPUS rows (the user's own data) by 1-based line number;
    eval-set text is never printed, and a corpus row that matched a SEALED
    set is shown by line number only. ``withheld`` (set name → the harness's
    reason) and ``corpus_withheld`` (the corpus's own reason) say whose
    sentences must not be printed: such rows are shown by line number, and
    one line near the top says why — unless ``show_text``.
    """
    tf = target_field or report.params.get("target_field") or "target"
    sets = report.params.get("sets_screened") or {
        n: {"role": s["role"], "rows": None} for n, s in report.per_set.items()}
    set_desc = ", ".join(
        f"{n} [{v['role']}" + (f", {v['rows']} rows]" if v.get("rows") else "]")
        for n, v in sets.items()) or "NO registered eval sets"
    lines = [f"leak-audit: {corpus_name} — {report.corpus_rows:,} rows screened "
             f"against {set_desc}"]
    withheld = withheld or {}
    hidden: dict[str, str] = {}   # label → reason, for the one note line
    if report.whole_file_match:
        lines += ["",
                  f"THIS FILE IS the registered eval set "
                  f"{report.whole_file_match!r} (identical content) — every "
                  "row would be dropped. Do not train on an eval file."]
        return "\n".join(lines)
    if not sets:
        lines += ["", "nothing to screen against — register your dev/test "
                      "sets first (nmt-forge registry add …, or split "
                      "--register)."]
        return "\n".join(lines)
    if verdict:
        lines += render_verdict(verdict)

    totals = _lane_totals(report)
    fatal_j = report.params.get("fatal_jaccard", 0.9)
    jt = report.params.get("jaccard_threshold", 0.6)

    def per_set_breakdown(lane: str) -> str:
        bits = [f"{n} ({st['role']}): {st[lane]}"
                for n, st in report.per_set.items() if st[lane]]
        return " · ".join(bits)

    def example_lines(lane: str) -> list[str]:
        out = []
        if not show_examples:
            return out
        for ex in report.examples.get(lane, [])[:3]:
            where = (f"{ex['set']} row {ex['eval_row'] + 1}"
                     if ex.get("eval_row") is not None else ex["set"])
            how = []
            if ex.get("relation"):
                how.append({"contains": "contains the whole answer",
                            "fragment": "is a fragment of the answer",
                            "near-identical": "is near-identical to the answer",
                            "substitution": "swaps word(s)"}[ex["relation"]])
            if ex.get("similarity") is not None:
                how.append(f"overlap {ex['similarity']:.2f}")
            tail = f" ({'; '.join(how)})" if how else ""
            text = ""
            private = ("" if show_text else
                       corpus_withheld or withheld.get(ex["set"], ""))
            if ex["role"] == "sealed":
                text = " (text not shown: matched a SEALED set)"
            elif private:
                if corpus_withheld:
                    hidden[corpus_name] = corpus_withheld
                else:
                    hidden[ex["set"]] = private
            elif rows is not None:
                field_name = (source_field if lane in
                              ("exact_source", "near_dupe_source_only")
                              else tf)
                text = f' "{_clip(rows[ex["row"]].get(field_name, ""))}"'
            out.append(f"      e.g. line {ex['row'] + 1}{text} → {where}{tail}")
        return out

    dropped = len(report.leaking_row_indices)
    lines += ["", f"DROPPED by --clean-to: {dropped:,} row(s) — the model "
                  "would see an eval answer (or prompt)"]
    if not dropped:
        lines.append("  none")
    for lane in FATAL_LANES:
        if not totals.get(lane):
            continue
        expl = LANE_EXPLANATIONS[lane].format(fatal=fatal_j)
        lines.append(f"  • {expl}")
        lines.append(f"      {per_set_breakdown(lane)}")
        lines += example_lines(lane)

    tw = report.test_twins
    if tw is not None:
        lines += render_twin_drop(tw)

    kept = report.kept_row_indices()
    reported = ((report.informational_row_indices
                 | report.template_row_indices) - report.leaking_row_indices)
    if tw is None:
        lines += ["", f"KEPT on purpose (reported, never removed): "
                      f"{len(kept):,} row(s)"]
    else:
        lines += ["", f"KEPT on purpose: {len(kept):,} row(s) — of the "
                      f"{len(reported):,} reported below, "
                      f"{len(reported) - len(kept):,} were near-twins of a "
                      "test row and are dropped above"]
    if not reported:
        lines.append("  none")
    for lane in KEPT_LANES:
        if not totals.get(lane):
            continue
        lines.append(f"  • {LANE_EXPLANATIONS[lane]}")
        lines.append(f"      {per_set_breakdown(lane)}")
        lines += example_lines(lane)
        if lane == "near_dupe_template":
            flagged = {n: len(st["eval_rows_with_template_sibling"])
                       for n, st in report.per_set.items()
                       if st["eval_rows_with_template_sibling"]
                       and st["role"] in ("test", "sealed")}
            # (after --drop-test-twins the forecast below says what is left)
            if flagged and tw is None:
                lines.append(
                    "      → eval rows with a template sibling in this corpus: "
                    + ", ".join(f"{n}: {k}" for n, k in flagged.items())
                    + ". Kept rows are fine for TRAINING, but every test row "
                      "with a sibling is a row the model can answer from "
                      "memory — see what that does to the test score below. "
                      '"near_dupe_corpus": "<train file>" in the config\'s '
                      "eval block makes the battery report show the strict "
                      "subset next to the full score. With a FIXED test set "
                      "(registered, not carved by split), --clean-to "
                      "<notwins.jsonl> --drop-test-twins (its own file, beside "
                      "the all-data one) drops the training rows that are "
                      "near-twins of it.")

    if near_twin:
        from .ci_scoring import render_near_twin_forecast

        lines += [""] + render_near_twin_forecast(
            near_twin, decision=not (verdict and verdict.get("decision")))

    lines += ["", "How to read this: overlap = shared words ÷ all words "
                  f"(Jaccard, diacritics folded); near-duplicates start at "
                  f"{jt:.0%}. Exact = identical after case/punctuation/"
                  "spacing normalization. Same corpus + same registered sets "
                  "⇒ the same result, every run."]
    if survivors_path:
        gone = len(report.removed_row_indices())
        lines.append(f"Cleaned: {report.corpus_rows - gone:,} row(s) kept → "
                     f"{survivors_path}"
                     + (f" (audit manifest: {manifest_path})"
                        if manifest_path else ""))
    elif verdict and verdict.get("fix"):
        lines.append(f"Next: {verdict['fix']}")
    elif dropped:
        lines.append("To drop them: nmt-forge leak-audit <corpus> --clean-to "
                     "<corpus.clean.jsonl>")
    if hidden:
        from ..privacy import combine, note

        # said once, right under the headline: why the examples below are
        # line numbers without their text
        lines[1:1] = ["", note(combine(hidden))]
    return "\n".join(lines)
