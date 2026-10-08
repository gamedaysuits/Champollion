"""Templates carry citations, or they don't exist (guard #6's front half).

A template kind is the unit of: coverage accounting, strata capping, and
provenance stamping. Declaring one requires (enforced at construction, i.e.
at pack import time — before any data is generated):

- ``kind``       a slug; the value stamped on every emitted row
- ``citation``   the published grammar the construction transcribes
                 (work-level; no invented page numbers — the discipline of
                 the reference derivational layer)
- ``phenomena``  which checklist items the kind exercises (coverage-map
                 needs this mapping to be declared, not inferred)

Targets are built from PIECES, not raw strings — that is what makes the
round-trip law non-optional:

    Unit(analysis)   the engine generates + round-trip verifies, or the row dies
    Lit(text)        a closed-class literal: must be analyzer-accepted or in
                     the pack's cited closed-class list; a bad Lit is a
                     TEMPLATE BUG and fails the build loudly
    Punct(text)      attaches to the preceding token (no space)
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from ..errors import CitationError
from .filters import Filter

_KIND_RE = re.compile(r"^[a-z0-9][a-z0-9_]*$")


@dataclass(frozen=True)
class Unit:
    analysis: str


@dataclass(frozen=True)
class Lit:
    text: str


@dataclass(frozen=True)
class Punct:
    text: str


TargetPiece = Unit | Lit | Punct


@dataclass
class Candidate:
    """One prospective pair from a template's realize function."""

    source: str
    target: tuple[TargetPiece, ...]
    lemma: str | None = None
    meta: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Template:
    kind: str
    citation: str
    phenomena: tuple[str, ...]
    realize: Callable[[object], Iterable[Candidate]]
    filters: tuple[Filter, ...] = ()

    def __post_init__(self):
        if not _KIND_RE.match(self.kind):
            raise CitationError(
                f"template kind {self.kind!r} must be a lowercase slug "
                "(it is stamped on every row and keys coverage/strata)"
            )
        if not self.citation.strip():
            raise CitationError(
                f"template kind {self.kind!r} declared without a citation — "
                "every template transcribes a published grammar construction "
                "and must say which (work-level citation)"
            )
        if not self.phenomena:
            raise CitationError(
                f"template kind {self.kind!r} declares no phenomena — "
                "coverage-map cannot account for kinds that don't say what "
                "they exercise"
            )


def template(
    kind: str,
    *,
    citation: str,
    phenomena: Iterable[str],
    filters: Iterable[Filter] = (),
) -> Callable[[Callable], Template]:
    """Decorator: a realize function becomes a Template (validated NOW)."""

    def deco(fn: Callable[[object], Iterable[Candidate]]) -> Template:
        return Template(
            kind=kind,
            citation=citation,
            phenomena=tuple(phenomena),
            realize=fn,
            filters=tuple(filters),
        )

    return deco
