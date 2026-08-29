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
Tatoeba API adapter — fetches sentence pairs directly from tatoeba.org.

Uses Tatoeba's REST API to query translated sentence pairs by language.
No bulk downloads, no tars, no disk usage beyond the final corpus JSON.
Each request returns ~10 sentence pairs as JSON, paginated.

API endpoint: https://tatoeba.org/en/api_v0/search
Rate limit: ~1 req/sec (be polite, it's a community project)
License: CC-BY 2.0 (all Tatoeba content)
"""

from __future__ import annotations

import logging
import time
from typing import Any

import requests

from .base import RawEntry, SourceAdapter
from mt_eval_harness.corpus_build import USER_AGENT

logger = logging.getLogger(__name__)

# Tatoeba API returns max 10 results per page, caps search at 1000 results.
RESULTS_PER_PAGE = 10
MAX_API_RESULTS = 1000


class TatoebaAPIAdapter(SourceAdapter):
    """Fetch parallel sentence pairs from Tatoeba's REST API.

    Unlike the file-based TatoebaAdapter which downloads OPUS tars,
    this adapter queries Tatoeba directly. Each API call returns ~10
    sentence pairs as JSON. No files are downloaded to disk.

    Language codes: Tatoeba uses ISO 639-3 codes natively (eng, fra,
    cmn, yor, etc.). The probe_tatoeba module's _CARD_TO_TATOEBA
    mapping is NOT needed here — we can use the same codes but
    Tatoeba also accepts codes like srp, bos, nob directly.
    """

    name: str = "tatoeba"
    license: str = "CC-BY-2.0"

    # Polite delay between API requests (seconds)
    REQUEST_DELAY = 0.3

    def fetch(
        self,
        source_lang: str,
        target_lang: str,
        **kwargs: Any,
    ) -> list[RawEntry]:
        """Fetch sentence pairs from Tatoeba's search API.

        Paginates through the API to collect up to max_pairs entries.
        Each pair includes the source sentence, its best translation
        in the target language, and Tatoeba sentence IDs for provenance.

        Keyword Args:
            max_pairs (int): Maximum pairs to fetch. Default 300
                (overshoot target of 200 to allow for filtering).

        Returns:
            List of RawEntry with parallel texts and provenance metadata.
        """
        max_pairs: int = kwargs.get("max_pairs", 300)

        entries: list[RawEntry] = []
        seen_pairs: set[tuple[str, str]] = set()

        # Calculate pages needed (10 results per page)
        max_pages = min(
            (max_pairs + RESULTS_PER_PAGE - 1) // RESULTS_PER_PAGE,
            MAX_API_RESULTS // RESULTS_PER_PAGE,
        )

        for page in range(1, max_pages + 1):
            page_entries = self._fetch_page(
                source_lang, target_lang, page
            )

            if not page_entries:
                # No more results
                break

            for entry in page_entries:
                # Deduplicate by text content
                pair_key = (entry.source_text, entry.target_text)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                entries.append(entry)

            # Stop if we have enough
            if len(entries) >= max_pairs:
                break

            # Be polite to Tatoeba's servers
            time.sleep(self.REQUEST_DELAY)

        logger.info(
            "Tatoeba API: fetched %d unique pairs for %s→%s (%d pages)",
            len(entries), source_lang, target_lang, page,
        )
        return entries

    def _fetch_page(
        self,
        source_lang: str,
        target_lang: str,
        page: int,
    ) -> list[RawEntry]:
        """Fetch one page of results from the Tatoeba search API.

        The API returns sentences in the source language along with
        their translations. Each result can have multiple translations;
        we take the first one in the target language.

        Returns:
            List of RawEntry for this page, or empty list if no results.
        """
        url = "https://tatoeba.org/en/api_v0/search"
        params = {
            "from": source_lang,
            "to": target_lang,
            "page": page,
        }

        try:
            resp = requests.get(url, params=params, timeout=15,
                                 headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning(
                "Tatoeba API error on page %d for %s→%s: %s",
                page, source_lang, target_lang, exc,
            )
            return []

        data = resp.json()
        results = data.get("results", [])

        entries: list[RawEntry] = []
        for sentence in results:
            source_text = sentence.get("text", "").strip()
            source_id = str(sentence.get("id", ""))

            if not source_text:
                continue

            # Find the best translation in the target language.
            # The API nests translations as a list of lists
            # (grouped by directness: direct translations first,
            # then indirect translations).
            target_text, target_id = self._find_translation(
                sentence, target_lang
            )

            if not target_text:
                continue

            # Skip untranslated (source == target text)
            if source_text == target_text:
                continue

            entries.append(RawEntry(
                source_text=source_text,
                target_text=target_text,
                source_id=source_id,
                metadata={
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "target_sentence_id": target_id,
                    "provenance": self.build_provenance(
                        source_id=source_id,
                        url=f"https://tatoeba.org/en/sentences/show/{source_id}",
                    ),
                },
            ))

        return entries

    @staticmethod
    def _find_translation(
        sentence: dict, target_lang: str
    ) -> tuple[str, str]:
        """Extract the best translation for the target language.

        Tatoeba groups translations by directness:
        - translations[0] = direct translations
        - translations[1] = indirect translations (via a pivot language)

        We prefer direct translations. Within a group, we take the first.

        Returns:
            (target_text, target_id) or ("", "") if no translation found.
        """
        for group in sentence.get("translations", []):
            for trans in group:
                if trans is None:
                    continue
                lang = trans.get("lang", "")
                text = trans.get("text", "").strip()
                tid = str(trans.get("id", ""))
                if lang == target_lang and text:
                    return text, tid

        return "", ""
