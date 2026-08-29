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
Champollion Corpora Builder
============================

Multi-source corpus construction tooling for the MT Eval Arena.

Imports human-authored parallel text from public sources, classifies each
entry by domain and difficulty, and outputs structured corpus JSON files
ready for evaluation.
"""

# Single source of truth for the package version.
# Kept here rather than read from importlib.metadata so the version is
# available in editable installs and before formal packaging.
__version__: str = "0.1.0"

# Identifying User-Agent for every upstream corpus download. Champollion
# fetches third-party corpora from source (Tatoeba Challenge/OPUS,
# GlobalVoices, etc.) rather than mirroring them — and a named UA makes that
# traffic legible and ATTRIBUTABLE to the data creators, so they can see the
# demand their work drives (e.g. for funding/impact reporting). Always set
# this on outbound requests to upstream sources; never fetch anonymously.
USER_AGENT: str = (
    f"champollion-corpora-builder/{__version__} "
    "(+https://champollion.dev; MT evaluation; thank you to the corpus authors)"
)
