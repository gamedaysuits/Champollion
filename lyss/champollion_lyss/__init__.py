"""Champollion-LYSS — community language-validation plugins for the MT Eval Harness.

LYSS = language-validation plugins: FST-gated linters and semantic validators that
serve as the *referee* for MT evaluation (they live with the language, not with any
translation method). The MT Eval Harness fetches and loads these on demand, driven by
a language card's ``evalMetrics`` / ``evalStandard`` declaration — so the harness core
stays strictly language-neutral and ships no language-specific scorer code.

This package ships CODE only — no licensed corpus / dictionary data. Language-specific
data (e.g. the Cree gloss map) is operator-provided locally or fetched from a public
API at runtime; it is never bundled here.
"""

__version__ = "0.1.2"
"""champollion-lyss version. Keep in sync with pyproject.toml [project].version."""
