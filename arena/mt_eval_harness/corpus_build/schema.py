# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
Corpus JSON schema — dataclass definitions for corpus entries and corpora.

These dataclasses define the canonical structure of a corpus JSON file.
They are intentionally plain dataclasses (not Pydantic, not attrs) so
the package has zero dependencies beyond the standard library for its
core data model. This makes it safe to import schema.py in any context
without pulling in third-party validators.

Design decisions:
    - ``provenance`` and ``metadata`` are untyped dicts because different
      source adapters provide different provenance fields. Constraining
      them to a fixed schema would force adapters to leave fields blank.
    - ``segment`` is a free string, not an enum, because downstream users
      may define their own segment names beyond the three defaults.
    - ``to_dict()`` / ``from_dict()`` are explicit methods rather than
      relying on ``dataclasses.asdict()`` because asdict recurses into
      nested dataclasses and dicts in ways that can produce surprising
      results with non-trivial metadata dicts.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Import VALID_DOMAINS for validation. This creates a dependency on
# domain_classifier, which is acceptable because schema validation
# should enforce the domain taxonomy — a CorpusEntry with an invalid
# domain code is a bug that must be caught at construction time.
from mt_eval_harness.corpus_build.domain_classifier import VALID_DOMAINS


@dataclass
class CorpusEntry:
    """A single parallel text entry in the corpus.

    Attributes:
        id: Unique entry ID, typically ``{adapter_name}_{source_id}``.
        source: Source text (usually English).
        reference: Human-authored reference translation in the target language.
        domain: One of the valid domain codes (e.g. ``"conv"``, ``"legal"``);
            see VALID_DOMAINS / shared/domain-taxonomy.json.
        difficulty: Integer difficulty tier from 1 (basic) to 5 (advanced).
        register: Writing register — ``"conversational"``, ``"formal"``,
            ``"technical"``, etc.
        provenance: Origin metadata. Expected keys: ``source_name``,
            ``source_id``, ``license``, ``url``.
        metadata: Arbitrary additional metadata from the source adapter.
    """

    id: str
    source: str
    reference: str
    domain: str
    difficulty: int
    register: str
    provenance: dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate fields at construction time.

        Catches invalid domain codes, out-of-range difficulty tiers,
        and empty required text fields. These are programming errors
        (not user input errors) so they raise ValueError immediately.
        """
        if not self.id:
            raise ValueError("CorpusEntry.id must not be empty")
        if not self.source:
            raise ValueError("CorpusEntry.source must not be empty")
        if not self.reference:
            raise ValueError("CorpusEntry.reference must not be empty")
        if self.domain not in VALID_DOMAINS:
            raise ValueError(
                f"CorpusEntry.domain '{self.domain}' is not a valid domain. "
                f"Valid domains: {sorted(VALID_DOMAINS)}"
            )
        if not (1 <= self.difficulty <= 5):
            raise ValueError(
                f"CorpusEntry.difficulty must be 1-5, got {self.difficulty}"
            )
        if not self.register:
            raise ValueError("CorpusEntry.register must not be empty")

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict suitable for JSON output.

        We build the dict explicitly rather than using
        ``dataclasses.asdict()`` to avoid its recursive deep-copy
        behavior on nested dicts, which can silently mutate custom
        dict subclasses or ordered dicts from source adapters.
        """
        return {
            "id": self.id,
            "source": self.source,
            "reference": self.reference,
            "domain": self.domain,
            "difficulty": self.difficulty,
            "register": self.register,
            "provenance": self.provenance,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CorpusEntry:
        """Deserialize from a plain dict (e.g. parsed JSON).

        Args:
            data: Dictionary with keys matching the CorpusEntry fields.

        Returns:
            A new CorpusEntry instance.

        Raises:
            KeyError: If any required field is missing from ``data``.
        """
        return cls(
            id=data["id"],
            source=data["source"],
            reference=data["reference"],
            domain=data["domain"],
            difficulty=data["difficulty"],
            register=data["register"],
            provenance=data["provenance"],
            metadata=data.get("metadata", {}),
        )


@dataclass
class Corpus:
    """A complete evaluation corpus containing parallel text entries.

    This is the top-level structure written to (and read from) corpus
    JSON files. It carries both the entries themselves and the metadata
    needed to identify, version, and reproduce the corpus.

    Attributes:
        corpus_id: Stable identifier for this corpus
            (e.g. ``"tatoeba-eng-fra-v1"``).
        version: Semantic version string for the corpus contents.
        language_pair: Dict with ``source`` and ``target`` ISO 639-3 codes.
        segment: Corpus segment type — ``"development"``,
            ``"held_out"``, or ``"gold_standard"``.
        created: ISO 8601 timestamp of when the corpus was generated.
        entry_count: Number of entries. Stored explicitly so readers can
            validate without iterating the full entry list.
        domains: Sorted list of unique domain codes present in the corpus.
        entries: The parallel text entries.
        provenance: Overall provenance metadata for the corpus as a whole.
    """

    corpus_id: str
    version: str
    language_pair: dict[str, str]
    segment: str
    created: str
    entry_count: int
    domains: list[str]
    entries: list[CorpusEntry]
    provenance: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize the entire corpus to a plain dict.

        Entries are serialized via their own ``to_dict()`` methods to
        maintain consistent serialization logic in one place.
        """
        return {
            "corpus_id": self.corpus_id,
            "version": self.version,
            "language_pair": self.language_pair,
            "segment": self.segment,
            "created": self.created,
            "entry_count": self.entry_count,
            "domains": self.domains,
            "entries": [entry.to_dict() for entry in self.entries],
            "provenance": self.provenance,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Corpus:
        """Deserialize from a plain dict (e.g. parsed JSON).

        Args:
            data: Dictionary with keys matching the Corpus fields.
                The ``entries`` value must be a list of dicts, each
                parseable by ``CorpusEntry.from_dict()``.

        Returns:
            A new Corpus instance with fully deserialized entries.

        Raises:
            KeyError: If any required field is missing from ``data``.
        """
        entries = [CorpusEntry.from_dict(e) for e in data["entries"]]

        return cls(
            corpus_id=data["corpus_id"],
            version=data["version"],
            language_pair=data["language_pair"],
            segment=data["segment"],
            created=data["created"],
            entry_count=data["entry_count"],
            domains=data["domains"],
            entries=entries,
            provenance=data["provenance"],
        )

    def to_json(self, path: str | Path, *, indent: int = 2) -> None:
        """Write the corpus to a JSON file.

        Args:
            path: File path to write to. Parent directories must exist.
            indent: JSON indentation level. Defaults to 2 for human
                readability without excessive file size.

        The file is written with ``ensure_ascii=False`` so that
        non-Latin scripts (e.g. Cree syllabics, Arabic, CJK) are
        preserved as-is rather than escaped to ``\\uXXXX`` sequences.
        This makes the output files readable in any text editor.
        """
        output_path = Path(path)
        output_path.write_text(
            json.dumps(self.to_dict(), indent=indent, ensure_ascii=False),
            encoding="utf-8",
        )
