"""Tests for mt_eval_harness.recommend — the routing evidence surface.

The honesty contract is the test surface: availability resolution, STRICT
commercial-lane exclusion, direction-exactness of curated evidence,
relative-only framing of bulk evidence, the evidenced-vs-dispatchable split,
and the explicit no-evidence state.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.contamination import LANE_RELATIVE_ONLY
from mt_eval_harness.recommend import (
    bulk_evidence,
    curated_evidence,
    dispatchable_methods,
    metric_reliability_evidence,
    recommend,
    render_text,
    resolve_availability,
)

MANIFEST = {
    "entries": {
        "google-translate": {
            "kind": "mt-api", "paradigm": "neural-nmt",
            "env": ["GOOGLE_TRANSLATE_API_KEY", "GOOGLE_API_KEY"],
            "license": "Proprietary (Google ToS)", "commercialReady": True,
        },
        "libretranslate": {
            "kind": "mt-api", "paradigm": "neural-nmt",
            "env": ["LIBRETRANSLATE_API_URL"],
            "license": "AGPL-3.0", "commercialReady": False,
        },
        "local-model": {
            "kind": "local-model", "paradigm": "neural-nmt",
            "optional_extra": "local-models",
            "license": "Per-model", "commercialReady": False,
            "runtimes": ["harness"],
        },
        "amazon-translate": {
            "kind": "mt-api", "paradigm": "neural-nmt",
            "env": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
            "credential_env": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
            "credential_env_all": True,
            "optional_extra": "aws",
            "license": "Proprietary (AWS)", "commercialReady": True,
            "runtimes": ["harness"],
        },
    }
}

CURATED = {
    "results": [
        {
            "model": "NLLB-200-3.3B", "benchmark": "FLORES-200 devtest",
            "metric": "chrF++", "value": 41.2, "verified": True,
            "citation": "NLLB Team (2022)", "source_url": "https://x",
            "method_ref": "nllb-200",
            "pair": {"source": "eng", "target": "yor"},
            "signal_strength": {"grade": "B", "contamination": "HIGH"},
        },
        {   # reverse direction — must NOT match eng→yor
            "model": "NLLB-200-3.3B", "benchmark": "FLORES-200 devtest",
            "metric": "chrF++", "value": 55.0, "verified": True,
            "citation": "NLLB Team (2022)", "source_url": "https://x",
            "method_ref": "nllb-200",
            "pair": {"source": "yor", "target": "eng"},
            "signal_strength": {"grade": "B", "contamination": "HIGH"},
        },
    ],
    "methods": [
        {"id": "nllb-200", "name": "NLLB-200", "commercial_use": False,
         "license": "CC-BY-NC-4.0", "runnable_in_champollion": False},
    ],
}

BULK = {
    "models": ["Tatoeba-MT-models/eng-yor/opus-2021", "other/model"],
    "contamination_posture": {"flores200-devtest": "HIGH — relative-only"},
    "pairs": {
        "eng-yor": {"flores200-devtest": {"chrf_pp": [0, 24.3], "bleu": [0, 5.0]}},
        "eng_Latn-zul": {"flores200-devtest": {"bleu": [1, 12.0]}},
    },
}


class TestAvailability:
    def test_key_present_is_ready(self):
        r = resolve_availability(
            MANIFEST["entries"]["google-translate"],
            env={"GOOGLE_API_KEY": "x"},
        )
        assert r["status"] == "ready"
        assert "GOOGLE_API_KEY" in r["detail"]

    def test_key_absent_names_the_vars(self):
        r = resolve_availability(
            MANIFEST["entries"]["google-translate"], env={},
        )
        assert r["status"] == "needs-key"
        assert "GOOGLE_TRANSLATE_API_KEY" in r["detail"]

    def test_local_model_is_local_setup(self):
        r = resolve_availability(MANIFEST["entries"]["local-model"], env={})
        assert r["status"] == "local-setup"

    def test_api_with_pip_extra_is_not_local(self):
        """amazon-translate: an API that ALSO needs a pip extra — must stay
        on the env-key axis, with the extra as a note."""
        r = resolve_availability(MANIFEST["entries"]["amazon-translate"], env={})
        assert r["status"] == "needs-key"
        assert "pip extra 'aws'" in r["detail"]

    def test_config_var_alone_is_never_ready(self):
        """AWS_REGION is config, not a credential — a region-only environment
        (very common) must stay needs-key, never 'READY — AWS_REGION is set'."""
        r = resolve_availability(
            MANIFEST["entries"]["amazon-translate"],
            env={"AWS_REGION": "us-east-1"},
        )
        assert r["status"] == "needs-key"
        assert "AWS_REGION" not in r["detail"]  # never advertised as the fix

    def test_key_pair_requires_both(self):
        """credential_env_all: the AWS key PAIR — the id alone is not auth."""
        r = resolve_availability(
            MANIFEST["entries"]["amazon-translate"],
            env={"AWS_ACCESS_KEY_ID": "AKIA..."},
        )
        assert r["status"] == "needs-key"
        assert "AWS_SECRET_ACCESS_KEY" in r["detail"]
        assert "alone is not enough" in r["detail"]

    def test_key_pair_complete_is_ready(self):
        r = resolve_availability(
            MANIFEST["entries"]["amazon-translate"],
            env={"AWS_ACCESS_KEY_ID": "a", "AWS_SECRET_ACCESS_KEY": "s"},
        )
        assert r["status"] == "ready"
        assert "AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY" in r["detail"]

    def test_credential_subset_excludes_config_vars(self):
        """microsoft-style entry: REGION/ENDPOINT stay in env for the adapter,
        but only the declared credential_env vars count toward readiness
        (any-of — they are canonical-key aliases, not a pair)."""
        entry = {
            "kind": "mt-api",
            "env": ["MICROSOFT_TRANSLATOR_API_KEY", "AZURE_TRANSLATOR_KEY",
                    "MICROSOFT_TRANSLATOR_REGION", "MICROSOFT_TRANSLATOR_ENDPOINT"],
            "credential_env": ["MICROSOFT_TRANSLATOR_API_KEY",
                               "AZURE_TRANSLATOR_KEY"],
        }
        region_only = resolve_availability(
            entry, env={"MICROSOFT_TRANSLATOR_REGION": "westus"})
        assert region_only["status"] == "needs-key"
        alias_key = resolve_availability(
            entry, env={"AZURE_TRANSLATOR_KEY": "k"})
        assert alias_key["status"] == "ready"
        assert "AZURE_TRANSLATOR_KEY" in alias_key["detail"]


class TestLane:
    def test_commercial_lane_is_strict(self):
        rows = dispatchable_methods("commercial", manifest=MANIFEST, env={})
        by = {r["method"]: r for r in rows}
        assert by["google-translate"]["lane_ok"] is True
        assert by["libretranslate"]["lane_ok"] is False
        assert "AGPL" in by["libretranslate"]["lane_note"]

    def test_non_commercial_lane_includes_all(self):
        rows = dispatchable_methods("non-commercial", manifest=MANIFEST, env={})
        assert all(r["lane_ok"] for r in rows)

    def test_excluded_sorted_last(self):
        rows = dispatchable_methods("commercial", manifest=MANIFEST, env={})
        assert rows[-1]["lane_ok"] is False


class TestCuratedEvidence:
    def test_direction_exact(self):
        rows, _ = curated_evidence("eng", "yor", catalogue=CURATED)
        assert len(rows) == 1
        assert rows[0]["value"] == 41.2

    def test_reverse_direction_separate(self):
        rows, _ = curated_evidence("yor", "eng", catalogue=CURATED)
        assert len(rows) == 1
        assert rows[0]["value"] == 55.0

    def test_high_contamination_maps_to_relative_lane(self):
        rows, _ = curated_evidence("eng", "yor", catalogue=CURATED)
        assert rows[0]["lane"] == LANE_RELATIVE_ONLY

    def test_missing_catalogue_degrades_empty(self):
        rows, idx = curated_evidence("eng", "yor", catalogue={})
        assert rows == [] and idx == {}


class TestBulkEvidence:
    def test_pair_rows_resolve_model_names(self):
        rows, meta = bulk_evidence("eng", "yor", index=BULK)
        assert {r["metric"] for r in rows} == {"chrf_pp", "bleu"}
        assert rows[0]["model"].startswith("Tatoeba-MT-models/")
        assert all(r["lane"] == LANE_RELATIVE_ONLY for r in rows)

    def test_script_suffix_keys_match_base(self):
        rows, _ = bulk_evidence("eng", "zul", index=BULK)
        assert len(rows) == 1
        # the exact upstream key is surfaced, never silently relabelled
        assert rows[0]["pair_key"] == "eng_Latn-zul"

    def test_no_rows_for_unknown_pair(self):
        rows, _ = bulk_evidence("eng", "quy", index=BULK)
        assert rows == []


class TestAssembly:
    def _payload(self, src="eng", tgt="yor"):
        return recommend(src, tgt, manifest=MANIFEST, curated=CURATED,
                         bulk=BULK, env={})

    def test_evidenced_models_join_flags_nc_and_undispatchable(self):
        p = self._payload()
        assert len(p["evidenced_models"]) == 1
        m = p["evidenced_models"][0]
        assert m["runnable_in_champollion"] is False
        assert m["commercial_use"] is False

    def test_no_evidence_state_is_explicit(self):
        p = self._payload("eng", "quy")
        assert p["curated_evidence"] == [] and p["bulk_evidence"] == []
        assert any("NO published evidence" in n for n in p["notes"])
        assert any("mt-eval corpora" in n for n in p["notes"])

    def test_relative_only_notice_always_present(self):
        p = self._payload()
        assert any("never absolute quality" in n for n in p["notes"])

    def test_render_text_smoke(self):
        text = render_text(self._payload())
        assert "eng → yor" in text
        assert "NEEDS KEY" in text
        assert "relative ordering only" in text
        text2 = render_text(self._payload("eng", "quy"))
        assert "none indexed" in text2


RELIABILITY = {
    "languages": {
        "iu": {"iso639_3": "iku", "family": "Eskimo-Aleut", "genus": "Inuit"},
        "de": {"iso639_3": "deu", "family": "Indo-European", "genus": "Global German"},
    },
    "families": {
        "Eskimo-Aleut": {
            "n_pairs": 1,
            "metrics": {
                "comet_score": {
                    "sys": {"n_cells": 1, "n_pairs": 1, "weight": 10,
                            "pairs": ["wmt20:en-iu"],
                            "pearson_weighted_mean": 0.8598,
                            "pairwise_accuracy_weighted_mean": 0.8},
                    "seg": {"n_cells": 1, "n_pairs": 1, "weight": 5000,
                            "pairs": ["wmt20:en-iu"],
                            "kendall_tau_b_weighted_mean": 0.21},
                },
                "bleu": {
                    "sys": {"n_cells": 1, "n_pairs": 1, "weight": 10,
                            "pairs": ["wmt20:en-iu"],
                            "pearson_weighted_mean": 0.1629},
                },
            },
        },
    },
    "cells": [
        {"pair": "en-iu", "tgt": "iu", "preferred": True},
        {"pair": "en-de", "tgt": "de", "preferred": True},
    ],
    "license_lane": {"commercial_ok": False, "note": "founder review pending"},
    "provenance": "champollion-derived [derived from mt-metrics-eval]",
}


class TestMetricReliability:
    def test_exact_language_hit_orders_metrics_by_sys_pearson(self):
        section, notes = metric_reliability_evidence("iu", RELIABILITY)
        assert section["target_family"] == "Eskimo-Aleut"
        assert section["exact_pairs_measured"] == ["en-iu"]
        ids = [m["metric"] for m in section["family_metrics"]]
        assert ids == ["comet_score", "bleu"]  # sorted by sys-Pearson desc
        assert section["family_metrics"][0]["sys_pearson"] == 0.8598
        # Direct measurement exists -> no family-transfer caveat, but the
        # non-commercial hold is always surfaced.
        assert not any("assumption" in n for n in notes)
        assert any("non-commercial hold" in n for n in notes)

    def test_iso639_3_lookup_works(self):
        section, _ = metric_reliability_evidence("iku", RELIABILITY)
        assert section is not None and section["target_code"] == "iu"

    def test_unmeasured_language_is_explicit(self):
        section, notes = metric_reliability_evidence("crk", RELIABILITY)
        assert section is None
        assert any("UNMEASURED" in n for n in notes)

    def test_family_transfer_caveat_when_no_exact_pair(self):
        rel = dict(RELIABILITY)
        rel["cells"] = [{"pair": "en-de", "tgt": "de", "preferred": True}]
        section, notes = metric_reliability_evidence("iu", rel)
        assert section["exact_pairs_measured"] == []
        assert any("assumption, not a measurement" in n for n in notes)

    def test_recommend_payload_carries_section_and_render_shows_it(self):
        p = recommend("eng", "iu", manifest=MANIFEST, curated=CURATED,
                      bulk=BULK, reliability=RELIABILITY, env={})
        assert p["metric_reliability"]["target_family"] == "Eskimo-Aleut"
        assert any("non-commercial hold" in n for n in p["notes"])
        text = render_text(p)
        assert "Metric trust for the target" in text
        assert "comet_score" in text and "+0.86" in text
        assert "directly measured pairs for this target: en-iu" in text

    def test_absent_index_is_an_explicit_note(self, monkeypatch):
        import mt_eval_harness.recommend as rec
        monkeypatch.setattr(rec, "catalogue_path", lambda name: None)
        section, notes = rec.metric_reliability_evidence("iu", None)
        assert section is None
        assert any("skipped explicitly" in n for n in notes)


class TestTargetCoverage:
    """READY meant 'no key missing' and read as 'works for your language'
    (Round 1: Apertium READY for English→Ayta). Coverage comes from the
    publishers' own lists; never guessed."""

    COVERAGE = {"methods": [
        {"key": "deepl", "iso6393": ["fra", "deu"]},
        {"key": "translated", "iso6393": []},
    ]}

    def _row(self, name, tgt):
        from mt_eval_harness.recommend import dispatchable_methods
        manifest = {"entries": {
            "deepl": {"kind": "mt-api", "env": ["DEEPL_API_KEY"]},
            "translated": {"kind": "mt-api", "env": ["LARA_ACCESS_KEY_ID"]},
            "apertium": {"kind": "mt-api", "env": ["APERTIUM_API_URL"], "keyless": True,
                         "default_base_url": "https://apertium.org/apy"},
            "local": {"kind": "llm-provider", "env": ["LOCAL_API_BASE"], "keyless": True},
        }}
        rows = dispatchable_methods("non-commercial", manifest=manifest, env={},
                                    tgt=tgt, coverage=self.COVERAGE)
        return next(r for r in rows if r["method"] == name)

    def test_listed_and_not_listed(self):
        assert self._row("deepl", "fra")["target_coverage"] == "listed"
        assert self._row("deepl", "abc")["target_coverage"] == "not-listed"

    def test_unknown_is_said_not_guessed(self):
        assert self._row("apertium", "abc")["target_coverage"] == "unknown"
        assert "count, not a list" in self._row("translated", "abc")["target_coverage_note"]

    def test_llms_take_any_language_unmeasured(self):
        r = self._row("local", "abc")
        assert r["target_coverage"] == "any" and "unmeasured" in r["target_coverage_note"]

    def test_recorded_unsupported_is_never_ready_and_not_indexed_only_when_unrecorded(self):
        from mt_eval_harness.recommend import dispatchable_methods
        manifest = {"entries": {"apertium": {
            "kind": "mt-api", "env": ["APERTIUM_API_URL"], "keyless": True,
            "default_base_url": "https://apertium.org/apy"}}}
        row = lambda card: dispatchable_methods(  # noqa: E731
            "non-commercial", manifest=manifest, env={}, tgt="xyz",
            coverage=self.COVERAGE, card_support=card)[0]
        r = row(lambda code, method: False)
        assert (r["availability"], r["target_coverage"]) == ("unsupported", "not-listed")
        assert r["key_availability"] == "ready"
        r = row(lambda code, method: None)
        assert (r["availability"], r["target_coverage"]) == ("unverified", "unknown")
        assert "not indexed" in r["target_coverage_note"]

    # Round 5, hospital persona (en→abc): Apertium READY while nothing
    # recorded its coverage of abc. READY means known to cover the pair.
    _KEYLESS = {"apertium": {"kind": "mt-api", "env": ["APERTIUM_API_URL"], "keyless": True,
                             "default_base_url": "https://apertium.org/apy"}}

    def _pair_row(self, src, tgt, card, coverage=None, extra=None):
        manifest = {"entries": {**self._KEYLESS, **(extra or {})}}
        rows = dispatchable_methods("non-commercial", manifest=manifest, env={}, src=src,
                                    tgt=tgt, coverage=coverage or self.COVERAGE,
                                    card_support=card)
        return rows

    def test_unindexed_coverage_is_unverified_never_ready(self):
        r = self._pair_row("eng", "abc", lambda code, method: None)[0]
        assert (r["availability"], r["target_coverage"]) == ("unverified", "unknown")
        assert r["key_availability"] == "ready"
        assert "no key needed" in r["availability_detail"]

    def test_coverage_confirmed_on_both_sides_is_ready(self):
        r = self._pair_row("eng", "fra", lambda code, method: True)[0]
        assert (r["target_coverage"], r["source_coverage"]) == ("listed", "listed")
        assert r["availability"] == "ready"

    def test_unconfirmed_source_side_is_unverified(self):
        r = self._pair_row("eng", "fra", lambda code, method: True if code == "fra" else None)[0]
        assert (r["target_coverage"], r["source_coverage"]) == ("listed", "unknown")
        assert r["availability"] == "unverified"

    def test_disagreeing_records_leave_a_keyless_method_unverified(self):
        both = {"methods": [{"key": "apertium", "iso6393": ["eng", "fra"]}]}
        r = self._pair_row("eng", "fra", lambda code, method: False if code == "fra" else None,
                           coverage=both)[0]
        assert r["target_coverage"] == "disputed"
        assert r["availability"] == "unverified"

    def test_missing_key_stays_needs_key_and_unverified_sorts_after_ready(self):
        rows = self._pair_row("eng", "abc", lambda code, method: None, extra={
            "amazon-translate": {"kind": "mt-api", "env": ["AWS_ACCESS_KEY_ID"]},
            "local": {"kind": "llm-provider", "env": ["LOCAL_API_BASE"], "keyless": True}})
        assert [(r["availability"], r["method"]) for r in rows] == [
            ("ready", "local"), ("unverified", "apertium"), ("needs-key", "amazon-translate")]
        from mt_eval_harness.recommend import render_text
        p = recommend("eng", "abc", manifest={"entries": self._KEYLESS}, env={}, curated={},
                      bulk={}, reliability={}, coverage=self.COVERAGE,
                      card_support=lambda code, method: None)
        text = render_text(p)
        assert "UNVERIFIED  apertium" in text
        assert "READY       apertium" not in text
        assert "? language coverage not indexed — check the service" in text

    def test_real_abc_card_apertium_is_unverified(self):
        """`recommend eng abc` said READY apertium; abc's card has no
        methodSupport and method-coverage.json has no Apertium list."""
        from mt_eval_harness.recommend import card_method_support
        assert card_method_support("abc", "apertium") is None
        p = recommend("eng", "abc", env={}, curated={}, bulk={}, reliability={})
        ap = next(m for m in p["runnable_methods"] if m["method"] == "apertium")
        assert (ap["availability"], ap["target_coverage"]) == ("unverified", "unknown")
        for m in p["runnable_methods"]:
            if m["availability"] == "ready":
                assert m["target_coverage"] in ("listed", "any"), m["method"]

    def test_real_crk_card_and_recommend_agree_on_apertium(self):
        """Persona finding: `card crk` said apertium ✗ unsupported while
        `recommend eng crk` said READY … coverage not indexed."""
        from mt_eval_harness.recommend import card_method_support, render_text
        assert card_method_support("crk", "apertium") is False
        p = recommend("eng", "crk", env={}, curated={}, bulk={}, reliability={})
        ap = next(m for m in p["runnable_methods"] if m["method"] == "apertium")
        assert ap["availability"] == "unsupported"
        assert ap["target_coverage"] == "not-listed"
        assert "language card" in ap["target_coverage_note"]
        assert "UNSUPPORTED apertium" in render_text(p)
