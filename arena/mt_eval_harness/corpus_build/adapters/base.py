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
Abstract base class for source adapters.

Every data source (Tatoeba, OPUS, CSV, etc.) implements this interface
to fetch and parse parallel text entries. The adapter pattern isolates
source-specific download logic, authentication, parsing, and error
handling behind a uniform API.

Design decisions:
    - ``SourceAdapter`` is an ABC rather than a Protocol because adapters
      carry state (``name``, ``license``) and we want to enforce that
      subclasses declare these attributes. Protocols are better for
      structural subtyping of method signatures; ABCs are better when
      you also need required attributes and want clear error messages
      at class definition time (not at call site).
    - ``RawEntry`` is deliberately minimal — just the parallel texts,
      a source ID, and a metadata dict. All downstream enrichment
      (domain classification, difficulty estimation) happens in the
      pipeline, not in the adapter. This keeps adapters focused on
      one job: fetching data.
    - ``fetch()`` returns a plain list rather than a generator because
      most sources return bounded datasets (a few thousand entries max),
      and the pipeline needs random access for stratified sampling.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawEntry:
    """A single parallel text pair as fetched from a source.

    This is the adapter's output format — the rawest useful representation
    of a parallel entry before any enrichment or classification.

    Attributes:
        source_text: Text in the source language (typically English).
        target_text: Text in the target language.
        source_id: An identifier unique within the source dataset.
            Combined with the adapter name to produce the corpus-wide
            unique ID (e.g. ``"tatoeba_12345"``).
        metadata: Arbitrary additional fields from the source.
            Examples: contributor username, creation date, sentence
            pair confidence score. Stored as-is in the final corpus
            entry's ``metadata`` field.
    """

    source_text: str
    target_text: str
    source_id: str
    metadata: dict[str, Any] = field(default_factory=dict)


class SourceAdapter(ABC):
    """Abstract base class for parallel text source adapters.

    Subclasses must set ``name`` and ``license`` as class-level
    attributes and implement the ``fetch()`` method.

    Attributes:
        name: Short identifier for this source (e.g. ``"tatoeba"``).
            Used as a prefix in corpus entry IDs and in provenance
            metadata.
        license: SPDX license identifier for the source data
            (e.g. ``"CC-BY-2.0"``). Stored in each entry's provenance
            so downstream users know the terms under which the data
            can be used.
    """

    name: str
    license: str

    @abstractmethod
    def fetch(
        self,
        source_lang: str,
        target_lang: str,
        **kwargs: Any,
    ) -> list[RawEntry]:
        """Download and parse parallel entries from this source.

        Implementations should handle:
            - Downloading the raw data (or reading from a local file)
            - Parsing the source format (TSV, XML, CSV, etc.)
            - Deduplicating entries if the source contains duplicates
            - Basic validation (non-empty texts, valid encoding)

        Implementations should NOT:
            - Classify domains (that's ``domain_classifier``'s job)
            - Estimate difficulty (that's ``difficulty_estimator``'s job)
            - Filter by word count (that's the CLI pipeline's job)
            - Sample or stratify (that's the CLI pipeline's job)

        Args:
            source_lang: ISO 639-3 code for the source language
                (e.g. ``"eng"``).
            target_lang: ISO 639-3 code for the target language
                (e.g. ``"fra"``).
            **kwargs: Adapter-specific arguments. For example, the OPUS
                adapter accepts ``corpus_name`` to select a sub-corpus;
                the CSV adapter accepts ``csv_path`` for the file path.

        Returns:
            A list of RawEntry instances. May be empty if the source
            has no data for the requested language pair.

        Raises:
            ConnectionError: If the source cannot be reached.
            ValueError: If the language pair is not supported by
                this source.
        """
        ...

    def build_provenance(self, source_id: str, url: str = "") -> dict[str, str]:
        """Build a standard provenance dict for an entry from this source.

        Provides a consistent provenance structure across all adapters.
        Adapters can override this if they need additional provenance
        fields, but the base implementation covers the four standard
        fields expected by ``CorpusEntry.provenance``.

        Args:
            source_id: The entry's identifier within this source.
            url: Optional URL pointing to the original entry.

        Returns:
            Dict with keys: ``source_name``, ``source_id``, ``license``,
            ``url``.
        """
        return {
            "source_name": self.name,
            "source_id": source_id,
            "license": self.license,
            "url": url,
        }
