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
License confirmation and download utilities for the corpora builder.

Before downloading any data from external sources, the user must confirm
they accept the license terms.  This module provides the prompt UI and
download orchestration.

Design decision: WE NEVER REDISTRIBUTE DATA.
We distribute build scripts.  The user downloads data directly from the
source, accepts the license by doing so, and builds corpora locally.
This sidesteps all redistribution licensing concerns.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class LicenseInfo:
    """Metadata about a data source's license, shown before download."""
    source_name: str        # e.g., "Tatoeba"
    license_id: str         # e.g., "CC-BY-2.0"
    license_url: str        # e.g., "https://creativecommons.org/licenses/by/2.0/"
    source_url: str         # e.g., "https://tatoeba.org"
    download_url: str       # The actual file URL being downloaded


# Pre-defined license info for known sources
TATOEBA_LICENSE = LicenseInfo(
    source_name="Tatoeba",
    license_id="CC-BY-2.0",
    license_url="https://creativecommons.org/licenses/by/2.0/",
    source_url="https://tatoeba.org",
    download_url="",  # Filled per-pair
)


def confirm_download(license_info: LicenseInfo, *, auto_yes: bool = False) -> bool:
    """Prompt the user to confirm a download and its license terms.

    Shows the source, license, and URL.  Returns True if the user
    confirms, False otherwise.  If ``auto_yes`` is True, skips the
    prompt and returns True (for CI/automation with --yes flag).

    Args:
        license_info: Metadata about what's being downloaded and under
            what license.
        auto_yes: If True, skip the interactive prompt.

    Returns:
        True if the user confirms (or auto_yes), False otherwise.
    """
    print()
    print(f"  Source:  {license_info.source_name} ({license_info.source_url})")
    print(f"  License: {license_info.license_id} ({license_info.license_url})")
    if license_info.download_url:
        print(f"  URL:     {license_info.download_url}")
    print()
    print("  You are responsible for complying with this license.")

    if auto_yes:
        print("  --yes flag set, proceeding automatically.")
        return True

    try:
        response = input("  Download and build corpus? [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        # Non-interactive environment or user interrupted
        print("\n  Cancelled.")
        return False

    return response == "y"


def confirm_batch_download(
    license_info: LicenseInfo,
    pair_count: int,
    *,
    auto_yes: bool = False,
) -> bool:
    """Prompt once for a batch of downloads from the same source.

    For batch builds, we show one confirmation covering all pairs
    from the same source/license.

    Args:
        license_info: Metadata about the source and license.
        pair_count: Number of language pairs that will be downloaded.
        auto_yes: If True, skip the interactive prompt.

    Returns:
        True if the user confirms (or auto_yes), False otherwise.
    """
    print()
    print(f"  This will download data for {pair_count} language pair(s).")
    print(f"  Source:  {license_info.source_name} ({license_info.source_url})")
    print(f"  License: {license_info.license_id} ({license_info.license_url})")
    print()
    print("  You are responsible for complying with this license.")

    if auto_yes:
        print("  --yes flag set, proceeding automatically.")
        return True

    try:
        response = input("  Confirm download for all pairs? [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n  Cancelled.")
        return False

    return response == "y"


def build_tatoeba_url(source_lang: str, target_lang: str) -> str:
    """Construct the Tatoeba download URL for a language pair.

    Uses the OPUS Tatoeba Challenge mirror which provides stable,
    versioned downloads of bilingual sentence pairs.

    Previous URL pattern (per_language) returned 404 as of mid-2026.
    The OPUS mirror at object.pouta.csc.fi hosts the same data with
    stable URLs.

    The two language codes are sorted alphabetically in the filename
    (convention: the pair file always lists the alphabetically-first
    language first).

    Args:
        source_lang: ISO 639-3 source language code (e.g., "eng").
        target_lang: ISO 639-3 target language code (e.g., "fra").

    Returns:
        Full download URL for the pair's tar file.
    """
    # Sort codes alphabetically (OPUS convention)
    lang1, lang2 = sorted([source_lang, target_lang])
    return (
        f"https://object.pouta.csc.fi/Tatoeba-Challenge-v2023-09-26/"
        f"{lang1}-{lang2}.tar"
    )

