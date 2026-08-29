"""MetricX-24 — LOWER-IS-BETTER neural metric, reported in the NEURAL lane only.

Mirrors test_comet.py: import-guard, result dataclass, model caching, and the
significance-compatible metric fn. Adds MetricX-specific coverage the model
download can't reach in CI:
  - the exact MetricX input template (ref-based vs QE),
  - the trailing-EOS strip,
  - the aggregation/result assembly (via a mocked inference fn — no weights),
  - the DIRECTION guard (lower-is-better), and
  - the invariant that metricx_score is neural (never in any composite profile).

The heavy mT5 inference (_predict_scores) needs the `metricx` extra; tests mock
_load_model / _predict_scores so nothing downloads.
"""

import pytest
from unittest.mock import patch, MagicMock

from mt_eval_harness.metrics_metricx import (
    HAS_METRICX,
    DEFAULT_METRICX_MODEL,
    DEFAULT_METRICX_TOKENIZER,
    METRICX_MAX_INPUT_LENGTH,
    METRICX_LOWER_IS_BETTER,
    METRICX_SCORE_MIN,
    METRICX_SCORE_MAX,
    MetricXResult,
    build_metricx_input,
    _strip_eos,
    compute_metricx,
    corpus_metricx,
)
from mt_eval_harness.scoring import PROFILE_REGISTRY, NEURAL_METRICS, compute_composite_score


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_entry(id: int, source: str, expected: str, predicted: str,
                error: str = None) -> dict:
    """Create a minimal entry dict matching TestReport format."""
    return {
        "id": id,
        "source": source,
        "expected": expected,
        "predicted": predicted,
        "exact_match": expected == predicted,
        "error": error,
    }


def _make_valid_entries(n: int = 10) -> list[dict]:
    return [
        _make_entry(
            i,
            source=f"Hello world {i}",
            expected=f"Bonjour le monde {i}",
            predicted=f"Bonjour le monde {i}",
        )
        for i in range(n)
    ]


# ---------------------------------------------------------------------------
# Availability + constants
# ---------------------------------------------------------------------------

class TestMetricXAvailability:
    def test_has_metricx_is_bool(self):
        assert isinstance(HAS_METRICX, bool)

    def test_default_model_constants(self):
        assert DEFAULT_METRICX_MODEL == "google/metricx-24-hybrid-large-v2p6"
        assert DEFAULT_METRICX_TOKENIZER == "google/mt5-xl"
        assert METRICX_MAX_INPUT_LENGTH == 1536

    def test_score_range_constants(self):
        assert METRICX_SCORE_MIN == 0.0
        assert METRICX_SCORE_MAX == 25.0


# ---------------------------------------------------------------------------
# Direction — the single most important property of this metric
# ---------------------------------------------------------------------------

class TestDirection:
    def test_lower_is_better_flag(self):
        # MetricX predicts an ERROR score: lower = better. This must be True.
        assert METRICX_LOWER_IS_BETTER is True

    def test_result_carries_direction(self):
        r = MetricXResult(
            corpus_score=3.2,
            per_entry_scores=[2.0, 4.4],
            model_name="m",
            tokenizer_name="t",
            n_entries=2,
            target_lang="fr",
        )
        assert r.lower_is_better is True
        assert r.score_max == 25.0
        assert r.qe_mode is False


# ---------------------------------------------------------------------------
# Input format — must match metricx24/predict.py exactly
# ---------------------------------------------------------------------------

class TestInputFormat:
    def test_reference_based_template(self):
        assert build_metricx_input("S", "H", "R") == "source: S candidate: H reference: R"

    def test_qe_template_omits_reference(self):
        assert build_metricx_input("S", "H", "R", qe=True) == "source: S candidate: H"

    def test_qe_ignores_reference_value(self):
        # In QE mode the reference is never emitted, even if supplied.
        assert "reference" not in build_metricx_input("S", "H", "anything", qe=True)


class TestStripEos:
    def test_strips_single_trailing_eos(self):
        assert _strip_eos([5, 6, 7, 1], eos_token_id=1) == [5, 6, 7]

    def test_keeps_when_no_trailing_eos(self):
        assert _strip_eos([5, 6, 7], eos_token_id=1) == [5, 6, 7]

    def test_only_strips_trailing_not_interior(self):
        # Strips just the final EOS; an interior EOS-valued token is left intact.
        assert _strip_eos([1, 5, 1], eos_token_id=1) == [1, 5]

    def test_noop_without_eos_id(self):
        assert _strip_eos([5, 6, 1], eos_token_id=None) == [5, 6, 1]


# ---------------------------------------------------------------------------
# compute_metricx — availability + filtering (no weights needed)
# ---------------------------------------------------------------------------

class TestComputeMetricX:
    def test_returns_none_when_unavailable(self):
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", False):
            assert compute_metricx(_make_valid_entries()) is None

    def test_returns_none_for_all_error_entries(self):
        # HAS_METRICX patched True so we reach the valid-filter; all-error → None,
        # and the (heavy) loader is never touched.
        entries = [_make_entry(0, "", "", "", error="fail")]
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model") as mock_load:
            assert compute_metricx(entries) is None
            mock_load.assert_not_called()

    def test_returns_none_for_empty_predictions(self):
        entries = [_make_entry(0, "hello", "bonjour", "")]
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model") as mock_load:
            assert compute_metricx(entries) is None
            mock_load.assert_not_called()

    def test_ref_based_requires_reference(self):
        # Without a reference and not in QE mode, the entry is filtered out.
        entries = [_make_entry(0, "hello", "", "bonjour")]
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model") as mock_load:
            assert compute_metricx(entries, qe=False) is None
            mock_load.assert_not_called()

    def test_qe_mode_scores_without_reference(self):
        # QE mode: source + hypothesis only. Mock the loader + inference so no
        # weights download; assert the result is assembled and flagged qe_mode.
        entries = [_make_entry(0, "hello", "", "bonjour")]
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model",
                   return_value=(MagicMock(), MagicMock())), \
             patch("mt_eval_harness.metrics_metricx._predict_scores",
                   return_value=[3.5]) as mock_predict, \
             patch("mt_eval_harness.metrics_metricx._is_xlmr_high_resource",
                   return_value=True):
            r = compute_metricx(entries, target_lang="fr", qe=True)
            assert r is not None
            assert r.qe_mode is True
            assert r.corpus_score == 3.5
            mock_predict.assert_called_once()


class TestComputeMetricXAggregation:
    """Mock inference → exercise corpus mean, rounding, and result fields."""

    def test_corpus_is_mean_of_per_entry(self):
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model",
                   return_value=(MagicMock(), MagicMock())), \
             patch("mt_eval_harness.metrics_metricx._predict_scores",
                   return_value=[2.0, 4.0, 6.0]), \
             patch("mt_eval_harness.metrics_metricx._is_xlmr_high_resource",
                   return_value=True):
            r = compute_metricx(_make_valid_entries(3), target_lang="fr",
                                model_name="google/metricx-24-hybrid-large-v2p6")
            assert r.corpus_score == 4.0
            assert r.per_entry_scores == [2.0, 4.0, 6.0]
            assert r.n_entries == 3
            assert r.model_name == "google/metricx-24-hybrid-large-v2p6"
            assert r.lower_is_better is True
            assert r.qe_mode is False

    def test_low_resource_warning_set_from_card(self):
        # Target not in the high-resource tier → low_resource_warning True.
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", True), \
             patch("mt_eval_harness.metrics_metricx._load_model",
                   return_value=(MagicMock(), MagicMock())), \
             patch("mt_eval_harness.metrics_metricx._predict_scores",
                   return_value=[5.0]), \
             patch("mt_eval_harness.metrics_metricx._is_xlmr_high_resource",
                   return_value=False):
            r = compute_metricx([_make_entry(0, "h", "b", "b")], target_lang="crk")
            assert r.low_resource_warning is True


# ---------------------------------------------------------------------------
# corpus_metricx — significance-compatible metric fn
# ---------------------------------------------------------------------------

class TestCorpusMetricXMetricFn:
    def test_returns_none_when_unavailable(self):
        # Absent → None (NOT 0.0). 0.0 is a real PERFECT MetricX score, so
        # "metric absent" must stay distinguishable. Mirrors corpus_comet().
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", False):
            assert corpus_metricx([]) is None

    def test_returns_none_for_empty(self):
        with patch("mt_eval_harness.metrics_metricx.HAS_METRICX", False):
            assert corpus_metricx(_make_valid_entries()) is None


# ---------------------------------------------------------------------------
# Model caching (mirrors test_comet.TestModelCaching)
# ---------------------------------------------------------------------------

class TestModelCaching:
    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        import mt_eval_harness.metrics_metricx as mx
        mx._cached = None
        mx._cached_key = None
        yield
        mx._cached = None
        mx._cached_key = None

    def test_cache_reused_on_second_call(self):
        import mt_eval_harness.metrics_metricx as mx
        sentinel = (MagicMock(), MagicMock())
        mx._cached = sentinel
        mx._cached_key = ("m", "t")
        # Cache hit returns immediately without importing the metricx stack.
        assert mx._load_model("m", "t") is sentinel

    def test_cache_set_after_load(self):
        import mt_eval_harness.metrics_metricx as mx
        mock_model = MagicMock()
        mock_tok = MagicMock()
        original_has = mx.HAS_METRICX
        mx.HAS_METRICX = True
        try:
            # Inject the import-guarded names as module attributes (the same
            # monkeypatch trick test_comet uses for download_model).
            mx.AutoTokenizer = MagicMock()
            mx.AutoTokenizer.from_pretrained = MagicMock(return_value=mock_tok)
            mx.MT5ForRegression = MagicMock()
            mx.MT5ForRegression.from_pretrained = MagicMock(return_value=mock_model)

            model, tok = mx._load_model("m", "t")

            assert model is mock_model
            assert tok is mock_tok
            assert mx._cached == (mock_model, mock_tok)
            assert mx._cached_key == ("m", "t")
        finally:
            mx.HAS_METRICX = original_has
            for attr in ("AutoTokenizer", "MT5ForRegression"):
                if isinstance(getattr(mx, attr, None), MagicMock):
                    delattr(mx, attr)

    def test_cache_invalidated_on_key_change(self):
        import mt_eval_harness.metrics_metricx as mx
        mx._cached = (MagicMock(), MagicMock())
        mx._cached_key = ("old-m", "old-t")
        new_model, new_tok = MagicMock(), MagicMock()
        original_has = mx.HAS_METRICX
        mx.HAS_METRICX = True
        try:
            mx.AutoTokenizer = MagicMock()
            mx.AutoTokenizer.from_pretrained = MagicMock(return_value=new_tok)
            mx.MT5ForRegression = MagicMock()
            mx.MT5ForRegression.from_pretrained = MagicMock(return_value=new_model)

            model, tok = mx._load_model("new-m", "new-t")
            assert model is new_model
            assert mx._cached_key == ("new-m", "new-t")
        finally:
            mx.HAS_METRICX = original_has
            for attr in ("AutoTokenizer", "MT5ForRegression"):
                if isinstance(getattr(mx, attr, None), MagicMock):
                    delattr(mx, attr)


# ---------------------------------------------------------------------------
# Neural-lane invariant — metricx_score is NEVER in any composite
# ---------------------------------------------------------------------------

class TestNeuralLaneInvariant:
    def test_metricx_in_neural_metrics(self):
        assert "metricx_score" in NEURAL_METRICS

    def test_metricx_not_in_any_profile(self):
        for name, weights in PROFILE_REGISTRY.items():
            for forbidden in ("metricx_score", "metricx"):
                assert forbidden not in weights, f"{forbidden} leaked into profile {name}"

    def test_supplying_metricx_never_moves_composite(self):
        # A MetricX score passed into ANY deterministic profile must not change the
        # composite — it is in no weight table (it is a separate neural metric).
        base = {"chrf_plus_plus": 80.0, "fst_acceptance_rate": 1.0}
        for profile in ("fst-coverage", "surface-only", "no-reference"):
            with_metricx = dict(base, metricx_score=3.0)
            assert (
                compute_composite_score(base, profile=profile)
                == compute_composite_score(with_metricx, profile=profile)
            )
