"""leak-audit — screen any corpus against every registered eval set.

Three lanes, all standing (mistakes #1 and #9 in the requirements ledger):

  whole-file  the corpus file IS a registered eval file (sha256 equal) —
              training on the test file itself; refused outright.
  exact       canonical-key hits, on BOTH sides: a corpus row whose SOURCE
              matches an eval source, or whose TARGET matches an eval target.
              The harness's contamination checker fingerprints pairs and
              sources; the TARGET-side lane is forge's addition — target
              sharing is exactly how the crk textbook leaked.
  near-dupe   token-set Jaccard ≥ 0.6 against eval lines with ≥ 3 tokens,
              SIDE-MATCHED (corpus source vs eval sources, corpus target vs
              eval targets). Measured necessary on crk (2026-07-12):
              same-domain documents share reworded lines.

TRANSLATION-AWARE FATALITY (pair_mode, 2026-07-13 — found by dogfooding on
crk): for a translation-pair corpus, leakage means the model has seen the
ANSWER. A row whose SOURCE near-dupes a test source but whose TARGET is a
different answer ("Are you going home?"→kiwî kîwân cî kiya vs test "why are
you going home?"→teneki ka wikiweyan; src J=0.80, tgt J=0.00) is a legitimate
minimal contrast, NOT a leak — 24/44 of forge's first crk gold flags were
this false positive. Under the default pair_mode="target-anchored":
  fatal          exact source, exact target, target-side near-dupe
  informational  source-only near-dupe (lane "near_dupe_source_only" —
                 reported in the manifest, never fatal, never removed by
                 clean()).
pair_mode="either-side" restores the old behavior for callers that want it
(e.g. auditing a monolingual file via a single field is unaffected either
way — one side, one lane).

The screen already earned its keep three times in the reference work: the
Okimāsis harvest (489/489 lines caught — it IS the gold textbook), the
Elections mini-guides (27/27), Little Cree Books (46/46). Run it on every
harvest, every synthetic corpus, and every backtranslation mono file.

Reports are content-free (counts, row indices, key hashes) — audit artifacts
must be committable without hosting corpus text.
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
    jaccard,
    key_hash,
    sha256_file,
    similarity_units,
)
from ..errors import LeakageError
from ..registry import load_rows
from ..workspace import Workspace

_INDEX_CAP = 50  # row indices kept per (set, lane) in the report


@dataclass
class AuditReport:
    corpus_rows: int
    params: dict
    per_set: dict[str, dict] = field(default_factory=dict)
    whole_file_match: str | None = None
    leaking_row_indices: set[int] = field(default_factory=set)
    informational_row_indices: set[int] = field(default_factory=set)

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

    def to_manifest(self) -> dict:
        return {
            "guard": "leak-audit",
            "corpus_rows": self.corpus_rows,
            "whole_file_match": self.whole_file_match,
            "per_set": self.per_set,
            "leaking_rows": len(self.leaking_row_indices),
            "informational_rows": len(self.informational_row_indices),
            "params": self.params,
        }


def _eval_index(eval_sets: dict[str, dict], min_tokens: int):
    """Build exact-key sets + an inverted unit index for near-dupe candidates.

    Units are whitespace tokens where the language has them and character
    n-grams where it doesn't (see canonical.similarity_units) — the screen
    must not go silently inert for spaceless scripts.
    """
    exact: dict[str, dict[str, set[str]]] = {}
    unitsets: list[tuple[str, str, frozenset[str]]] = []  # (set, side, units)
    unit_index: dict[str, set[int]] = {}
    for name, ks in eval_sets.items():
        exact[name] = {"source": ks["source"], "target": ks["target"]}
        for side in ("source", "target"):
            for key in ks[side]:
                units = similarity_units(key, min_tokens=min_tokens)
                if units:
                    idx = len(unitsets)
                    unitsets.append((name, side, units))
                    for u in units:
                        unit_index.setdefault(u, set()).add(idx)
    return exact, unitsets, unit_index


def leak_audit(
    corpus: list[dict] | str | Path,
    workspace_or_sets: Workspace | dict[str, dict],
    *,
    jaccard_threshold: float = 0.6,
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
    "target": set, "role": str}}`` mapping.
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
        "min_tokens": min_tokens,
        "roles": list(roles),
        "source_field": source_field,
        "target_field": target_field,
        "pair_mode": pair_mode,
        "corpus_sha256": sha256_file(corpus_path) if corpus_path else None,
    }
    report = AuditReport(corpus_rows=len(rows), params=params,
                         whole_file_match=whole_file)
    if whole_file is not None:
        # no row-level work needed; the whole file is an eval file
        report.leaking_row_indices = set(range(len(rows)))

    exact, unitsets, unit_index = _eval_index(eval_sets, min_tokens)
    per_set: dict[str, dict] = {
        name: {
            "role": ks["role"],
            "exact_source": 0,
            "exact_target": 0,
            "near_dupe": 0,
            "near_dupe_source_only": 0,
            "row_indices": [],
            "key_hashes": [],
        }
        for name, ks in eval_sets.items()
    }

    def _record(name: str, lane: str, i: int, key: str) -> None:
        s = per_set[name]
        s[lane] += 1
        if len(s["row_indices"]) < _INDEX_CAP:
            s["row_indices"].append(i)
            s["key_hashes"].append(key_hash(key))
        if lane == "near_dupe_source_only":
            report.informational_row_indices.add(i)
        else:
            report.leaking_row_indices.add(i)

    for i, row in enumerate(rows):
        s_key = canonical_key(str(row.get(source_field, "")), canonicalizer)
        t_key = canonical_key(str(row.get(target_field, "")), canonicalizer)
        matched_near: set[str] = set()
        for name, ks in exact.items():
            if s_key and s_key in ks["source"]:
                _record(name, "exact_source", i, s_key)
                matched_near.add(name)  # exact beats near-dupe; don't double-count
            if t_key and t_key in ks["target"]:
                _record(name, "exact_target", i, t_key)
                matched_near.add(name)
        # side-matched near-dupe: corpus source vs eval sources, corpus
        # target vs eval targets (consistent with near_twin_flags)
        for corpus_side, key in (("source", s_key), ("target", t_key)):
            units = similarity_units(key, min_tokens=min_tokens)
            if not units:
                continue
            counts = Counter()
            for u in units:
                for idx in unit_index.get(u, ()):
                    counts[idx] += 1
            for idx, shared in counts.items():
                name, ev_side, ev_units = unitsets[idx]
                if ev_side != corpus_side or name in matched_near:
                    continue
                # cheap upper bound before the exact Jaccard
                if shared / min(len(units), len(ev_units)) < jaccard_threshold:
                    continue
                if jaccard(units, ev_units) >= jaccard_threshold:
                    if (corpus_side == "source"
                            and pair_mode == "target-anchored"):
                        # answer differs → minimal contrast, not a leak:
                        # informational lane (never fatal, never removed)
                        _record(name, "near_dupe_source_only", i, key)
                    else:
                        _record(name, "near_dupe", i, key)
                        matched_near.add(name)
                    break

    report.per_set = per_set
    return report


def near_twin_flags(
    eval_rows: list[dict],
    corpus: list[dict] | str | Path,
    *,
    jaccard_threshold: float = 0.6,
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
                "dev carve, point at the train-side file from group_split()",
        )
    fatal = report.fatal_hits()
    if fatal:
        detail = "; ".join(
            f"{name}: {s['exact_source']}+{s['exact_target']} exact, "
            f"{s['near_dupe']} near-dupe"
            + (f" ({s['near_dupe_source_only']} source-only informational)"
               if s.get("near_dupe_source_only") else "")
            for name, s in fatal.items()
        )
        raise LeakageError(
            f"corpus leaks into {len(fatal)} test/sealed set(s) — {detail}",
            why="rows shared (even reworded ≥0.6 Jaccard) with a test set turn "
                "its scores into memory measurements; the crk screen caught "
                "489/489 Okimāsis lines this way — the harvest WAS the textbook",
            fix="drop the leaking rows with leak_audit.clean(...) and keep the "
                "audit manifest next to the corpus, or rebuild the harvest from "
                "eval-disjoint sources",
        )
    return report


def clean(
    corpus,
    workspace_or_sets,
    *,
    manifest_path: str | Path | None = None,
    **kwargs,
) -> tuple[list[dict], AuditReport]:
    """Return rows surviving the audit + the report; optionally write manifest.

    The manifest is the audit trail: committing it next to a corpus is how a
    later reader knows the screen ran and what it removed.
    """
    corpus_path: Path | None = Path(corpus) if isinstance(corpus, (str, Path)) else None
    report = leak_audit(corpus, workspace_or_sets, **kwargs)
    rows = load_rows(corpus_path) if corpus_path is not None else corpus
    survivors = [r for i, r in enumerate(rows) if i not in report.leaking_row_indices]
    manifest = report.to_manifest()
    manifest["rows_removed"] = len(rows) - len(survivors)
    manifest["rows_kept"] = len(survivors)
    if manifest_path is not None:
        Path(manifest_path).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return survivors, report
