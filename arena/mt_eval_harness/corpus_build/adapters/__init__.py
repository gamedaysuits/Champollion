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
Source adapters for the corpora builder.

Each adapter implements the SourceAdapter ABC to fetch parallel text
from a specific data source (Tatoeba, OPUS, CSV, etc.).

Adapters are imported explicitly by name rather than auto-discovered,
because we want the dependency graph to stay obvious and predictable.
"""
