"""Analyzer protocol + the round-trip law.

The law (verbatim from the reference FST factory): every generated surface
form is round-trip verified — ``generate(analysis)`` then
``analyze(surface)`` must recover the same analysis. Nothing that fails the
round trip is ever emitted. The synthesis engine enforces this for every
open-class unit of every emitted row; packs cannot opt out.

Analyzers are ADAPTERS over external tools (e.g. a GiellaLT FST via pyhfst).
License boundary: FST model files are upstream artifacts (often AGPL) that
the USER fetches under the upstream's terms; forge never bundles them — an
adapter that can't find its model raises :class:`~nmt_forge.errors.
ResourceMissing` with fetch instructions.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Protocol, runtime_checkable


@runtime_checkable
class Analyzer(Protocol):
    def analyses(self, surface: str) -> list[str]:
        """Non-error analyses for a surface word ([] if unknown)."""
        ...

    def generate(self, analysis: str) -> str | None:
        """Surface form for an analysis string, or None."""
        ...


def generate_verified(analyzer: Analyzer, analysis: str) -> str | None:
    """Generate + round-trip: the surface must analyze back to the SAME
    analysis string, else None. The one law every emitted unit obeys."""
    surface = analyzer.generate(analysis)
    if not surface:
        return None
    return surface if analysis in analyzer.analyses(surface) else None


def accepts(analyzer: Analyzer, surface: str) -> bool:
    """Does the analyzer know this surface at all? (for literals/whole-text)."""
    return bool(analyzer.analyses(surface))


class TableAnalyzer:
    """Deterministic analyzer over explicit tables — the pack developer's
    test double (hermetic tests need no FST binary) and a legitimate backend
    for rule-tabulated micro-languages.

    ``forms`` maps analysis → surface; the inverse index is built for
    ``analyses``. ``ambiguous`` may add extra analyses per surface (to test
    round-trip failures: generation that lands on a surface whose preferred
    analysis differs). ``accepted`` adds closed-class surfaces that analyze
    (as themselves) without being generatable.
    """

    def __init__(
        self,
        forms: Mapping[str, str],
        *,
        accepted: Iterable[str] = (),
        ambiguous: Mapping[str, list[str]] | None = None,
    ):
        self._forms = dict(forms)
        self._by_surface: dict[str, list[str]] = {}
        for analysis, surface in self._forms.items():
            self._by_surface.setdefault(surface, []).append(analysis)
        for surface, extra in (ambiguous or {}).items():
            self._by_surface.setdefault(surface, []).extend(extra)
        for word in accepted:
            self._by_surface.setdefault(word, []).append(f"{word}+Ipc")

    def analyses(self, surface: str) -> list[str]:
        return list(self._by_surface.get(surface, []))

    def generate(self, analysis: str) -> str | None:
        return self._forms.get(analysis)
