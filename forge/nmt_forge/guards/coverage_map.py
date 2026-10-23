"""coverage-map — template inventory vs a grammar checklist (guard #6).

The catalogued failure: a million manufactured pairs in ~23 structural
shapes. It SOUNDED comprehensive; it was deep repetition of a narrow
inventory — no imperatives, no wh-questions, no possession, no relative
clauses, no inverse (core grammar for the reference language). The generator
could produce ALL of them; the templates never asked. Volume hid the gap.

The mechanism: a language pack ships a CHECKLIST transcribed from published
grammars (work-level citations — the discipline of the derivational rule
inventory: breadth-first from the grammar's chapters, NOT from an eval's gap
list). Every template declares which checklist phenomena it exercises. The
coverage map is then arithmetic: which phenomena have zero pairs, and how
concentrated the kind distribution is.
"""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from ..errors import CitationError, CoverageError


@dataclass(frozen=True)
class ChecklistItem:
    """One structural phenomenon a corpus should exercise, with its citation."""

    id: str
    name: str
    citation: str
    required: bool = False

    def __post_init__(self):
        if not self.citation.strip():
            raise CitationError(
                f"checklist item {self.id!r} has no citation — every phenomenon "
                "must name the published grammar it comes from (work-level, "
                "no invented page numbers)"
            )


@dataclass
class CoverageReport:
    per_item: dict[str, int]                 # checklist id → pair count
    missing: list[str]                       # ids with zero pairs
    missing_required: list[str]
    kind_counts: dict[str, int]
    unmapped_kinds: list[str]                # kinds claiming no phenomena
    top_kind_share: float
    kind_entropy: float                      # Shannon, in bits
    checklist: list[ChecklistItem] = field(default_factory=list, repr=False)

    def to_manifest(self) -> dict:
        return {
            "guard": "coverage-map",
            "per_item": self.per_item,
            "missing": self.missing,
            "missing_required": self.missing_required,
            "kinds": len(self.kind_counts),
            "kind_counts": dict(
                sorted(self.kind_counts.items(), key=lambda kv: -kv[1])
            ),
            "unmapped_kinds": self.unmapped_kinds,
            "top_kind_share": round(self.top_kind_share, 4),
            "kind_entropy_bits": round(self.kind_entropy, 3),
        }


def coverage(
    kind_counts: Mapping[str, int],
    kind_phenomena: Mapping[str, Iterable[str]],
    checklist: list[ChecklistItem],
) -> CoverageReport:
    """Compute coverage from a kind histogram + kind→phenomena declarations."""
    ids = {c.id for c in checklist}
    per_item: dict[str, int] = {c.id: 0 for c in checklist}
    unmapped: list[str] = []
    for kind, n in kind_counts.items():
        phen = list(kind_phenomena.get(kind, ()))
        if not phen:
            unmapped.append(kind)
            continue
        unknown = [p for p in phen if p not in ids]
        if unknown:
            raise CoverageError(
                f"kind {kind!r} declares unknown phenomena {unknown}",
                why="phenomena must be checklist ids, or coverage numbers lie",
                fix="add the phenomenon to the pack checklist (with its grammar "
                    "citation) or fix the template's phenomena declaration",
            )
        for p in phen:
            per_item[p] += n

    missing = [i for i, n in per_item.items() if n == 0]
    required = {c.id for c in checklist if c.required}
    total = sum(kind_counts.values())
    top_share = (max(kind_counts.values()) / total) if total else 0.0
    entropy = 0.0
    for n in kind_counts.values():
        if n:
            p = n / total
            entropy -= p * math.log2(p)
    return CoverageReport(
        per_item=per_item,
        missing=missing,
        missing_required=[i for i in missing if i in required],
        kind_counts=dict(kind_counts),
        unmapped_kinds=sorted(unmapped),
        top_kind_share=top_share,
        kind_entropy=entropy,
        checklist=checklist,
    )


def coverage_of_corpus(
    rows: Iterable[dict],
    kind_phenomena: Mapping[str, Iterable[str]],
    checklist: list[ChecklistItem],
    *,
    kind_field: str = "kind",
) -> CoverageReport:
    counts = Counter(str(r.get(kind_field, "?")) for r in rows)
    return coverage(counts, kind_phenomena, checklist)


def assert_no_missing_required(report: CoverageReport) -> None:
    if report.missing_required:
        cites = {c.id: c.citation for c in report.checklist}
        detail = "; ".join(f"{i} ({cites.get(i, '?')})" for i in report.missing_required)
        raise CoverageError(
            f"{len(report.missing_required)} required phenomena have ZERO "
            f"pairs: {detail}",
            why="volume hides structural gaps — the reference corpus had 1M "
                "pairs and no imperatives, questions, possession, or inverse; "
                "the generator could make all of them, the templates never asked",
            fix="add cited template kinds for the missing phenomena (see the "
                "checklist citations for the grammar sections to transcribe)",
        )
