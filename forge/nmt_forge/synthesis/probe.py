"""Paradigm probe — the analyzer's tag grammar, not our intuition, is the
arbiter (the reference factory's standing rule, kept verbatim).

Guessing which tag combinations a generator supports produces silent holes
(combos that never generate) and silent garbage (combos that generate
unverified forms). The probe replaces guessing: candidate analysis templates
are tried against exemplar lemmas, and only combos that GENERATE AND
ROUND-TRIP are ever used by templates.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from pathlib import Path

from .analyzer import Analyzer, generate_verified


def probe_combos(
    analyzer: Analyzer,
    exemplars: Mapping[str, str],
    tag_templates: Mapping[str, Iterable[str]],
) -> dict[str, list[str]]:
    """Verified analysis templates per subclass.

    ``exemplars``: subclass → a representative lemma known to inflect
    regularly. ``tag_templates``: subclass → analysis templates containing
    ``{lemma}`` (e.g. ``"{lemma}+V+AI+Ind+3Sg"``). A template survives iff
    it generate-verifies for the exemplar.
    """
    out: dict[str, list[str]] = {}
    for subclass, templates in tag_templates.items():
        lemma = exemplars.get(subclass)
        if lemma is None:
            out[subclass] = []
            continue
        kept = []
        for t in templates:
            if generate_verified(analyzer, t.format(lemma=lemma)) is not None:
                kept.append(t)
        out[subclass] = kept
    return out


def write_probe_artifact(
    path: str | Path, combos: dict[str, list[str]], *, analyzer_id: str
) -> Path:
    """Cache a probe result with enough metadata to know when to re-probe."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "probe_version": 1,
        "analyzer_id": analyzer_id,
        "combos": combos,
        "counts": {k: len(v) for k, v in combos.items()},
    }
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    return path


def load_probe_artifact(path: str | Path, *, analyzer_id: str) -> dict[str, list[str]] | None:
    """Load a cached probe iff it was made by the SAME analyzer; else None
    (a stale probe silently re-used across analyzer versions is a hole)."""
    path = Path(path)
    if not path.exists():
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("analyzer_id") != analyzer_id:
        return None
    return doc["combos"]
