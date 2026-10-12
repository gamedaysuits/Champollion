"""convention-lint — one output orthography, checked, not hoped (guard #5).

The catalogued failure: training targets were deliberately duplicated across
four spelling conventions (circumflex ``nikî-nipân`` / macron ``nikī-nipān``
/ plain-e / spaced preverbs). The model learned they were interchangeable and
MIXED them WITHIN single sentences — a pathology no metric in the loop was
watching for. The fix (measured in the reference work): canonicalize ONCE at
data-build time, train on a single convention, normalize at the boundaries
(scoring, ingest), and keep a mixed-convention metric in the battery so a
regression shows up as a number.

A :class:`ConventionSpec` names an orthographic convention by its marker
characters (or a regex). Language packs ship their conventions; the linter is
language-agnostic.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from ..errors import ConventionError


@dataclass(frozen=True)
class ConventionSpec:
    """A detectable orthographic convention.

    Either ``chars`` (any of these characters ⇒ the convention is present in a
    text) or ``pattern`` (regex search). Example (Plains Cree long vowels):
    ``ConventionSpec("circumflex", chars="âêîôûÂÊÎÔÛ")`` vs
    ``ConventionSpec("macron", chars="āēīōūĀĒĪŌŪ")``.
    """

    name: str
    chars: str = ""
    pattern: str = ""

    def __post_init__(self):
        if not self.chars and not self.pattern:
            raise ValueError(f"ConventionSpec {self.name!r} needs chars or pattern")

    def present_in(self, text: str) -> bool:
        if self.chars and set(self.chars) & set(text):
            return True
        return bool(self.pattern and re.search(self.pattern, text))


@dataclass
class ConventionReport:
    n_texts: int
    counts: dict[str, int]          # convention name → texts where present
    mixed_indices: list[int]        # texts containing ≥2 conventions
    dominant: str | None            # most frequent convention, if any

    @property
    def mixed_rate(self) -> float:
        return len(self.mixed_indices) / self.n_texts if self.n_texts else 0.0

    def to_manifest(self) -> dict:
        return {
            "guard": "convention-lint",
            "n_texts": self.n_texts,
            "counts": self.counts,
            "mixed": len(self.mixed_indices),
            "mixed_rate": round(self.mixed_rate, 6),
            "dominant": self.dominant,
        }


def lint(texts: list[str], specs: list[ConventionSpec]) -> ConventionReport:
    counts: dict[str, int] = {s.name: 0 for s in specs}
    mixed: list[int] = []
    for i, t in enumerate(texts):
        present = [s.name for s in specs if s.present_in(t)]
        for name in present:
            counts[name] += 1
        if len(present) >= 2:
            mixed.append(i)
    dominant = max(counts, key=lambda n: counts[n]) if any(counts.values()) else None
    return ConventionReport(
        n_texts=len(texts), counts=counts, mixed_indices=mixed, dominant=dominant
    )


def mixed_convention_rate(texts: list[str], specs: list[ConventionSpec]) -> float:
    """The standing output metric: fraction of texts mixing ≥2 conventions.

    A model trained on canonical targets should score ~0 here; the reference
    baseline measured 0–2.7% pre-fix. Watch it per decode batch.
    """
    return lint(texts, specs).mixed_rate


def assert_single_convention(
    texts: list[str],
    specs: list[ConventionSpec],
    *,
    max_mixed_fraction: float = 0.0,
    context: str = "training targets",
) -> ConventionReport:
    """The data-build gate: one convention corpus-wide, zero mixed rows.

    Fails if (a) any single text mixes conventions beyond the tolerance, or
    (b) different texts use different conventions (corpus-level mixing —
    the deliberate-augmentation mistake).
    """
    report = lint(texts, specs)
    if report.mixed_rate > max_mixed_fraction:
        i = report.mixed_indices[0]
        raise ConventionError(
            f"{context}: {len(report.mixed_indices)} texts "
            f"({report.mixed_rate:.2%}) mix conventions within one text "
            f"(first at row {i})",
            why="a model trained on mixed conventions emits mixed conventions "
                "— measured pathology, not a hypothetical",
            fix="canonicalize targets ONCE at data-build time with the pack's "
                "canonicalizer; do not augment targets across orthographies",
        )
    present = [n for n, c in report.counts.items() if c > 0]
    if len(present) >= 2:
        raise ConventionError(
            f"{context}: corpus mixes conventions across rows — "
            + ", ".join(f"{n}: {report.counts[n]}" for n in present),
            why="convention augmentation teaches the model that conventions "
                "are interchangeable; it will mix them inside sentences",
            fix="pick ONE canonical convention (the pack declares it), map "
                "all rows through pack.canonicalize at build time, and "
                "normalize references the same way at scoring",
        )
    return report
