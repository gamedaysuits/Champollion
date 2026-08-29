"""LYSS role registry — the general layer of the LYSS eval-standard format.

LYSS is a per-language plug-in standard: each language ships its own
implementations (``champollion_lyss/<iso>/…``), but every implementation fills
one of a small set of language-NEUTRAL **roles**. This module is the single
place those roles are defined, so the harness, the metric registry
(``shared/metric-registry.json``), and every future language implementation
agree on what a LYSS plugin *is* without string-matching plugin names.

Roles (extensible):

``eq``
    Equivalence linter — "are these two strings equivalent under documented,
    dialectally-valid variation?" Canonical metric ``equivalent_match_rate``,
    declared on a card as ``lyss-eq``. Verdicts: EXACT / EQUIVALENT / MISS.

``sem``
    Semantic validator — verdict-weighted meaning preservation. Canonical
    metric ``semantic_score``, card key ``lyss-sem``.

``chrf``
    LYSS-normalized chrF++ comparator — chrF++ arithmetic over the linter's
    equivalence ruling. Canonical metric ``linted_chrf``, card key
    ``lyss-chrf``. NOT comparable to published chrF++ (comparator lane only).

Every LYSS plugin's ``aggregate()`` merges :func:`envelope` into its output.
The envelope is ADDITIVE: the legacy discovery flags
(``is_equivalence_linter``, ``semantic_verdict_counts``) are still emitted by
the plugins themselves so archived run cards and older harnesses keep working.
The harness (``publish.py``) discovers by ``lyss_role`` first and falls back
to the legacy flags.
"""

from __future__ import annotations

from champollion_lyss import __version__ as _LYSS_VERSION

# Role id -> contract. canonical_metric / card_key mirror
# shared/metric-registry.json (parity-tested in arena/tests/test_lyss_roles.py).
ROLES: dict[str, dict] = {
    "eq": {
        "canonical_metric": "equivalent_match_rate",
        "card_key": "lyss-eq",
        "aggregate_value_key": "equivalent_match_rate",
        "verdicts": ("EXACT", "EQUIVALENT", "MISS"),
        "legacy_discovery": "is_equivalence_linter",
    },
    "sem": {
        "canonical_metric": "semantic_score",
        "card_key": "lyss-sem",
        "aggregate_value_key": "semantic_verdict_counts",
        "verdicts": (
            "EXACT_MATCH", "VALID", "GRAMMAR_ISSUES", "PARTIAL",
            "INCOMPLETE", "WRONG", "NO_OUTPUT", "ERROR",
        ),
        "legacy_discovery": "semantic_verdict_counts",
    },
    "chrf": {
        "canonical_metric": "linted_chrf",
        "card_key": "lyss-chrf",
        "aggregate_value_key": "linted_chrf_mean",
        "verdicts": (),
        "legacy_discovery": None,  # activated 2026-07-07; envelope-only
    },
}


def envelope(role: str, tool_versions: dict | None = None) -> dict:
    """Return the standard LYSS aggregate envelope for ``role``.

    Merged into every LYSS plugin's ``aggregate()`` output so the harness can
    discover the plugin by role (language-neutral) and stamp tool provenance
    into the run card. Raises ``KeyError`` for an unknown role — a plugin
    claiming a role this registry doesn't define is a bug, not a fallback.
    """
    spec = ROLES[role]
    env = {
        "lyss_role": role,
        "lyss_version": _LYSS_VERSION,
        "lyss_canonical_metric": spec["canonical_metric"],
    }
    if tool_versions:
        env["tool_versions"] = tool_versions
    return env


def fst_tool_versions(lang_code: str = "crk") -> dict:
    """Best-effort tool-version stamp for FST-backed LYSS plugins.

    Reads the SAME installed transducer the harness provisions (via
    ``mt_eval_harness.plugins.fst_installer``), so the versions reported here
    are the versions that actually scored. Never raises — a metric aggregate
    must not die on provenance collection; missing pieces are simply absent
    (fail-honest: absence is visible, never faked).
    """
    versions: dict = {"champollion_lyss": _LYSS_VERSION}
    try:
        import pyhfst
        versions["pyhfst"] = getattr(pyhfst, "__version__", "unknown")
    except Exception:
        pass
    try:
        import json as _json
        from mt_eval_harness.plugins.fst_installer import (
            get_fst_cache_dir,
            find_analyzer_hfstol,
        )
        fst_dir = get_fst_cache_dir(lang_code)
        analyzer = find_analyzer_hfstol(fst_dir)
        if analyzer is not None:
            versions["fst_analyzer"] = analyzer.name
        prov = fst_dir / "provenance.json"
        if prov.exists():
            data = _json.loads(prov.read_text())
            # Keys as written by fst_installer._write_provenance
            for key in ("release_tag", "repo", "sha256", "format"):
                if data.get(key):
                    versions[f"fst_{key}"] = data[key]
    except Exception:
        pass
    return versions


def spacy_tool_versions(model_name: str | None = None) -> dict:
    """Best-effort spaCy version stamp for semantic-validator plugins."""
    versions: dict = {}
    try:
        import spacy
        versions["spacy"] = spacy.__version__
        if model_name:
            versions["spacy_model"] = model_name
    except Exception:
        pass
    return versions
