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
OPUS source adapter for the corpora builder.

OPUS (https://opus.nlpl.eu/) is a collection of translated texts from the
web, covering dozens of parallel corpora across hundreds of language pairs.
Most OPUS corpora are available in TMX (Translation Memory eXchange) format,
an XML standard for storing translation pairs.

Design decision: **no automatic downloads**.  Unlike Tatoeba (which has a
simple bulk-download API), OPUS requires users to accept per-corpus license
terms on their website before downloading.  Automating that acceptance
would violate those terms and surprise users.  So this adapter *only*
reads from local TMX files that the user has already downloaded and
accepted the license for.

TMX structure
-------------
A TMX file wraps translation pairs in ``<tu>`` (translation unit) elements,
each containing one ``<tuv>`` (translation unit variant) per language::

    <tu>
      <tuv xml:lang="en"><seg>Hello world</seg></tuv>
      <tuv xml:lang="de"><seg>Hallo Welt</seg></tuv>
    </tu>

The ``xml:lang`` attribute identifies the language.  This adapter extracts
the ``<seg>`` text for the requested source and target languages.

Domain mapping
--------------
Many OPUS sub-corpora have a well-known domain (e.g. Europarl is
parliamentary proceedings → ``"gov"``).  ``OPUS_DOMAIN_MAP`` maps corpus
names to domain codes so downstream classifiers have a strong starting
signal.
"""

from __future__ import annotations

import hashlib
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from .base import RawEntry, SourceAdapter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain mapping
# ---------------------------------------------------------------------------

# Maps OPUS corpus names (case-insensitive lookup via ``_lookup_domain()``)
# to the project's 16-code domain taxonomy.
#
# WHY each mapping is what it is:
# - GNOME/KDE4/Ubuntu: software UI translations → "ui"
# - QED: educational video subtitles → "edu"
# - OpenSubtitles: film/TV subtitles → "subtitles" (NOT "conv", because
#   subtitle text is scripted dialogue, not spontaneous conversation)
# - Bible/bible-uedin: scripture → "religious" (NOT "literary", because
#   religious text has distinct register and terminology)
# - ELRC/Europarl: EU & government documents → "gov"
# - ECB: European Central Bank publications → "financial"
# - EMEA: European Medicines Agency → "medical"
# - EUbookshop: EU Bookshop publications → "literary" (mixed genres but
#   predominantly book-length prose)
# - JRC-Acquis: EU legal acquis → "legal"
# - PHP/KDE4doc: software documentation → "tech"
# - GlobalVoices: citizen journalism → "news"
# - TED2020/TEDtalks: educational talks → "edu"
# - MultiUN: UN documents → "gov"
# - DGT: EU DG Translation → "gov"
# - Tanzil: Quran translations → "religious"
OPUS_DOMAIN_MAP: dict[str, str] = {
    # Software UI
    "gnome":        "ui",
    "kde4":         "ui",
    "ubuntu":       "ui",
    # Education
    "qed":          "edu",
    "ted2020":      "edu",
    "tedtalks":     "edu",
    # Subtitles
    "opensubtitles":     "subtitles",
    "opensubtitles2018": "subtitles",
    "opensubtitles2016": "subtitles",
    # Religious
    "bible":        "religious",
    "bible-uedin":  "religious",
    "tanzil":       "religious",
    # Government / institutional
    "elrc":         "gov",
    "europarl":     "gov",
    "multiun":      "gov",
    "dgt":          "gov",
    # Financial
    "ecb":          "financial",
    # Medical
    "emea":         "medical",
    # Literary
    "eubookshop":   "literary",
    # Legal
    "jrc-acquis":   "legal",
    # Technical
    "php":          "tech",
    "kde4doc":      "tech",
    # News
    "globalvoices": "news",
}


def _lookup_domain(corpus_name: str) -> str | None:
    """Resolve an OPUS corpus name to a domain code.

    Lookup is case-insensitive because OPUS naming conventions are not
    consistent about capitalisation (e.g. ``"OpenSubtitles"`` vs
    ``"opensubtitles"``).

    Returns ``None`` when no mapping exists. The caller (cli.py) will
    then fall through to the keyword-based domain classifier, which
    is the correct behavior — we should never tag entries with
    a domain code that doesn't exist in the taxonomy.
    """
    return OPUS_DOMAIN_MAP.get(corpus_name.lower())


# ---------------------------------------------------------------------------
# TMX XML namespace handling
# ---------------------------------------------------------------------------

# TMX files may or may not use the XML namespace for ``xml:lang``.
# ElementTree represents it as ``{http://www.w3.org/XML/1998/namespace}lang``.
_XML_LANG_ATTR = "{http://www.w3.org/XML/1998/namespace}lang"


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class OpusAdapter(SourceAdapter):
    """Fetch parallel text pairs from a local OPUS TMX file.

    Conforms to the ``SourceAdapter`` ABC: ``name`` and ``license`` are
    class-level attributes, and ``fetch()`` accepts ``source_lang`` and
    ``target_lang`` as arguments with source-specific config in ``**kwargs``.
    """

    name: str = "opus"
    license: str = "varies-by-corpus"

    def fetch(
        self,
        source_lang: str,
        target_lang: str,
        **kwargs: Any,
    ) -> list[RawEntry]:
        """Read and parse parallel entries from a local OPUS TMX file.

        Keyword Args:
            corpus_name (str):
                Name of the OPUS sub-corpus (e.g. ``"Europarl"``, ``"GNOME"``).
                Used for domain lookup and provenance. **Required.**
            file_path (str | Path):
                Path to the local TMX file. **Required.**
            license_id (str):
                SPDX-style license for this corpus (e.g. ``"CC-BY-SA-4.0"``).
                **Required** — OPUS corpora carry different licenses.
            min_words (int):
                Minimum whitespace-delimited tokens in source text. Default 1.
            max_words (int):
                Maximum whitespace-delimited tokens in source text. Default 200.

        Returns:
            Deduplicated, filtered list of ``RawEntry`` objects.

        Raises:
            ValueError: If required kwargs are missing or invalid.
            FileNotFoundError: If the TMX file does not exist.
        """
        # --- Extract and validate required kwargs ---
        corpus_name: str | None = kwargs.get("corpus_name")
        if not corpus_name or not corpus_name.strip():
            raise ValueError(
                "OpusAdapter.fetch() requires 'corpus_name' kwarg "
                "(e.g. corpus_name='Europarl')"
            )
        corpus_name = corpus_name.strip()

        file_path_raw = kwargs.get("file_path")
        if file_path_raw is None:
            raise ValueError(
                "OpusAdapter.fetch() requires 'file_path' kwarg "
                "pointing to a local TMX file"
            )
        file_path = Path(file_path_raw)
        if not file_path.exists():
            raise FileNotFoundError(
                f"OPUS TMX file not found at {file_path}"
            )

        license_id: str | None = kwargs.get("license_id")
        if not license_id or not license_id.strip():
            raise ValueError(
                "OpusAdapter.fetch() requires 'license_id' kwarg "
                "(e.g. license_id='CC-BY-SA-4.0'). OPUS corpora carry "
                "different licenses — check the OPUS website for yours."
            )
        license_id = license_id.strip()

        min_words: int = kwargs.get("min_words", 1)
        max_words: int = kwargs.get("max_words", 200)

        if min_words < 0:
            raise ValueError(f"min_words must be >= 0, got {min_words}")
        if max_words < min_words:
            raise ValueError(
                f"max_words ({max_words}) must be >= min_words ({min_words})"
            )

        # --- Resolve domain from corpus name ---
        # Returns None for unmapped corpora — the keyword classifier in
        # cli.py will handle domain assignment for those entries.
        known_domain = _lookup_domain(corpus_name)

        # --- Build language code variants for TMX matching ---
        source_variants = _lang_code_variants(source_lang)
        target_variants = _lang_code_variants(target_lang)

        logger.info(
            "Parsing OPUS TMX (%s) at %s [%s → %s]",
            corpus_name, file_path, source_lang, target_lang,
        )

        # --- Parse TMX and collect entries ---
        seen_pairs: set[tuple[str, str]] = set()
        results: list[RawEntry] = []
        skipped_count = 0
        entry_index = 0

        context = ET.iterparse(str(file_path), events=("end",))

        for _event, element in context:
            if element.tag != "tu":
                continue

            source_text = ""
            target_text = ""

            for tuv in element.findall("tuv"):
                lang_attr = _get_lang_attr(tuv)
                if lang_attr is None:
                    continue

                lang_lower = lang_attr.lower()
                seg = tuv.find("seg")
                if seg is None or seg.text is None:
                    continue

                text = seg.text.strip()

                if lang_lower in source_variants:
                    source_text = text
                elif lang_lower in target_variants:
                    target_text = text

            # Free memory — critical for multi-GB TMX files.
            element.clear()

            # --- Filter pipeline ---

            # 1. Empty texts.
            if not source_text or not target_text:
                skipped_count += 1
                continue

            # 2. Untranslated pairs.
            if source_text == target_text:
                skipped_count += 1
                continue

            # 3. Word-count bounds on the SOURCE side.
            word_count = len(source_text.split())
            if word_count < min_words or word_count > max_words:
                skipped_count += 1
                continue

            # 4. Exact-duplicate suppression.
            pair_key = (source_text, target_text)
            if pair_key in seen_pairs:
                skipped_count += 1
                continue
            seen_pairs.add(pair_key)

            # --- Build the entry ---
            entry_index += 1
            # Generate a stable source_id from corpus name + content hash.
            # This ensures IDs are unique and deterministic.
            content_hash = hashlib.sha256(
                f"{source_text}|{target_text}".encode("utf-8")
            ).hexdigest()[:12]
            source_id = f"{corpus_name}_{content_hash}"

            results.append(RawEntry(
                source_text=source_text,
                target_text=target_text,
                source_id=source_id,
                metadata={
                    "corpus_name": corpus_name,
                    "license": license_id,
                    "url": f"https://opus.nlpl.eu/{corpus_name}.php",
                    "known_domain": known_domain,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                },
            ))

        logger.info(
            "OPUS %s: yielded %d entries, skipped %d",
            corpus_name, len(results), skipped_count,
        )
        return results


# ---------------------------------------------------------------------------
# TMX helper functions
# ---------------------------------------------------------------------------

def _get_lang_attr(tuv_element: ET.Element) -> str | None:
    """Extract the language attribute from a ``<tuv>`` element.

    TMX files express language in two ways:
    * ``xml:lang="en"``  → stored by ElementTree as the namespaced key
    * ``lang="en"``      → plain attribute (some exporters omit the ns)

    We check both so we don't silently skip data from files that use
    the non-namespaced form.
    """
    lang = tuv_element.get(_XML_LANG_ATTR)
    if lang is not None:
        return lang
    # Fallback: plain ``lang`` attribute (non-namespaced).
    return tuv_element.get("lang")


# ---------------------------------------------------------------------------
# Language code helpers
# ---------------------------------------------------------------------------

# Mapping from ISO 639-3 three-letter codes to ISO 639-1 two-letter codes
# for the languages most commonly found in OPUS.
#
# WHY we need this: OPUS TMX files almost always use two-letter codes in
# their xml:lang attributes, but the adapter's public API uses ISO 639-3
# (three-letter) codes for consistency with the rest of the corpora builder.
# We need to match both representations.
_ISO_639_3_TO_1: dict[str, str] = {
    "afr": "af", "ara": "ar", "bul": "bg", "ben": "bn",
    "cat": "ca", "ces": "cs", "cym": "cy", "dan": "da",
    "deu": "de", "ell": "el", "eng": "en", "spa": "es",
    "est": "et", "eus": "eu", "fas": "fa", "fin": "fi",
    "fra": "fr", "gle": "ga", "glg": "gl", "guj": "gu",
    "heb": "he", "hin": "hi", "hrv": "hr", "hun": "hu",
    "hye": "hy", "ind": "id", "isl": "is", "ita": "it",
    "jpn": "ja", "kat": "ka", "kaz": "kk", "kan": "kn",
    "kor": "ko", "lit": "lt", "lav": "lv", "mkd": "mk",
    "mal": "ml", "mar": "mr", "msa": "ms", "mlt": "mt",
    "nep": "ne", "nld": "nl", "nob": "nb", "nno": "nn",
    "nor": "no", "pan": "pa", "pol": "pl", "por": "pt",
    "ron": "ro", "rus": "ru", "sin": "si", "slk": "sk",
    "slv": "sl", "sqi": "sq", "srp": "sr", "swe": "sv",
    "swa": "sw", "tam": "ta", "tel": "te", "tha": "th",
    "tur": "tr", "ukr": "uk", "urd": "ur", "vie": "vi",
    "cmn": "zh", "zho": "zh",
    "yue": "yue",  # Cantonese — no ISO 639-1 code, stays 3-letter
}


def _lang_code_variants(iso639_3: str) -> set[str]:
    """Build the set of language code forms that might appear in TMX xml:lang.

    Returns a set containing the original three-letter code AND its
    two-letter equivalent (if one exists), all lowercased.

    This lets us match ``xml:lang="en"`` when the adapter was constructed
    with ``source_lang="eng"``, without forcing callers to know which
    code-length the TMX file uses.
    """
    lowered = iso639_3.lower()
    variants = {lowered}

    two_letter = _ISO_639_3_TO_1.get(lowered)
    if two_letter is not None:
        variants.add(two_letter)

    return variants
