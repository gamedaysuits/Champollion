"""Plains Cree (nêhiyawêwin) LYSS eval standard — the referee metrics.

Exposes the harness MetricPlugin classes the crk language card loads:
    - CrkLinterMetric    (lyss-eq)  — deterministic variant-class equivalence linter
    - CrkSemanticMetric  (lyss-sem) — FST-lemma + itwêwina-gloss + spaCy content-word
                                      overlap. Gloss data is fetched live from the
                                      itwêwina API and cached locally; NEVER bundled.

Extracted from the harness wheel into this public package so the harness core stays
language-neutral and fetches language standards on demand.

DATA SOVEREIGNTY (see the package NOTICE file):
    The Cree validation standard and any Plains Cree language data are treated as the
    property of the nêhiyaw language community and offered for NON-COMMERCIAL,
    community-benefit use (relational-trust governance in progress).
    This package bundles NO dictionary or corpus data: glosses are fetched live from
    the public itwêwina API (cached do-not-redistribute) only after the operator
    acknowledges the IP terms, and the FST is downloaded and invoked as a separate
    tool. When those can't be served, scores are reported as unavailable — never
    fabricated (human-validated data only). The small inline grammar facts here are
    widely-published, multi-sourced common knowledge, cited not extracted.
"""

from champollion_lyss.crk.metrics import CrkLinterMetric, CrkSemanticMetric

# Discovery descriptor for the ``champollion.eval_standards`` entry-point group.
# Per-run loading is card-driven (the crk card's evalMetrics names module + class);
# this descriptor lets the harness ENUMERATE installed eval standards without first
# importing the heavy metric machinery.
EVAL_STANDARD = {
    "language": "crk",
    "metrics": {
        "lyss-eq": CrkLinterMetric,
        "lyss-sem": CrkSemanticMetric,
    },
}

__all__ = ["CrkLinterMetric", "CrkSemanticMetric", "EVAL_STANDARD"]
