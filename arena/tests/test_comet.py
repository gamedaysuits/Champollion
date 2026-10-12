import pytest
from unittest.mock import patch, MagicMock
from mt_eval_harness.metrics_comet import (
    HAS_COMET,
    DEFAULT_COMET_MODEL,
    COMETResult,
    compute_comet,
    corpus_comet,
)
from mt_eval_harness.language_cards import (
    is_xlmr_high_resource,
    has_africomet,
    get_metric_model_for,
)


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
    """Create entries with source, expected, and predicted fields."""
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
# Test: COMET availability detection
# ---------------------------------------------------------------------------

class TestCOMETAvailability:
    """Verify the import guard works correctly."""

    def test_has_comet_is_bool(self):
        assert isinstance(HAS_COMET, bool)

    def test_default_model_constant(self):
        assert DEFAULT_COMET_MODEL == "Unbabel/wmt22-comet-da"


# ---------------------------------------------------------------------------
# Test: COMETResult dataclass
# ---------------------------------------------------------------------------

class TestCOMETResult:
    """Verify the result dataclass."""

    def test_fields(self):
        r = COMETResult(
            corpus_score=0.85,
            per_entry_scores=[0.8, 0.9],
            model_name="test-model",
            n_entries=2,
            target_lang="fr",
            low_resource_warning=False,
        )
        assert r.corpus_score == 0.85
        assert len(r.per_entry_scores) == 2
        assert r.low_resource_warning is False


# ---------------------------------------------------------------------------
# Test: low-resource language detection (SSOT-driven)
# ---------------------------------------------------------------------------

class TestLowResourceDetection:
    """Verify XLM-R coverage from language cards (metricModelSupport)."""

    def test_high_resource_languages(self):
        # Uses ISO 639-3 codes — data comes from language cards SSOT
        for lang in ["eng", "fra", "deu", "spa", "cmn", "jpn", "kor", "rus"]:
            assert is_xlmr_high_resource(lang), f"{lang} should be high-resource"

    def test_639_1_codes_resolve(self):
        # 639-1 codes should also work via resolve_code
        for lang in ["en", "fr", "de"]:
            assert is_xlmr_high_resource(lang), f"{lang} (639-1) should resolve"

    def test_low_resource_not_present(self):
        # Plains Cree is not in XLM-R top tier
        assert not is_xlmr_high_resource("crk")

    def test_africomet_languages(self):
        for lang in ["yor", "zul", "amh"]:
            assert has_africomet(lang), f"{lang} should have AfriCOMET"

    def test_non_african_no_africomet(self):
        assert not has_africomet("fra")
        assert not has_africomet("crk")

    def test_africomet_model_recommendation(self):
        model = get_metric_model_for("yor")
        assert model == "masakhane/africomet-mtl"

    def test_no_model_for_default(self):
        model = get_metric_model_for("fra")
        assert model is None

    def test_high_resource_optin_resolves_default_comet_model(self):
        # Task #9: when a high-resource (XLM-R-high) language opts into the
        # comet-validated profile, COMET resolves to the DEFAULT wmt22-comet-da
        # (validated on WMT high-resource pairs) — NOT AfriCOMET. This is what
        # makes the explicit opt-in produce a working, required comet_score.
        from mt_eval_harness.metrics_comet import resolve_comet_model, DEFAULT_COMET_MODEL
        assert is_xlmr_high_resource("deu")  # real card: German is XLM-R-high
        assert resolve_comet_model("deu") == DEFAULT_COMET_MODEL
        assert resolve_comet_model("fra") == DEFAULT_COMET_MODEL


# ---------------------------------------------------------------------------
# Test: compute_comet with mocked model
# ---------------------------------------------------------------------------

class TestComputeCOMETMocked:
    """Test compute_comet logic using a mocked COMET model."""

    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        """Reset module-level model cache between tests."""
        import mt_eval_harness.metrics_comet as mc
        mc._cached_model = None
        mc._cached_model_name = None
        yield
        mc._cached_model = None
        mc._cached_model_name = None

    def test_returns_none_when_comet_unavailable(self):
        """If HAS_COMET is False, compute_comet returns None."""
        with patch("mt_eval_harness.metrics_comet.HAS_COMET", False):
            result = compute_comet(_make_valid_entries())
            assert result is None

    def test_returns_none_for_empty_entries(self):
        """No valid entries → returns None."""
        if not HAS_COMET:
            pytest.skip("COMET not installed")

        entries = [
            _make_entry(0, "", "", "", error="fail"),
            _make_entry(1, "", "", "", error="fail"),
        ]
        with patch("mt_eval_harness.metrics_comet._load_model") as mock_load:
            result = compute_comet(entries)
            assert result is None
            mock_load.assert_not_called()

    def test_empty_prediction_is_scored_and_scores_stay_aligned(self):
        """An empty prediction is scored as an empty hypothesis (the chrF++
        population); per-entry scores are aligned to the entries passed in."""
        class _Out:
            def __init__(self, data):
                self.scores = [0.9 if d["mt"] else 0.1 for d in data]
                self.system_score = sum(self.scores) / len(self.scores)

        class _Model:
            def predict(self, data, gpus=0, **kwargs):
                self.seen = [d["mt"] for d in data]
                return _Out(data)

        model = _Model()
        entries = [
            _make_entry(0, "hello", "bonjour", "bonjour"),
            _make_entry(1, "cat", "chat", ""),
            _make_entry(2, "dog", "chien", "chien", error="boom"),
            _make_entry(3, "sun", "soleil", "soleil"),
        ]
        with patch("mt_eval_harness.metrics_comet.HAS_COMET", True), \
             patch("mt_eval_harness.metrics_comet._load_model", return_value=model):
            result = compute_comet(entries, target_lang="fr")
        assert model.seen == ["bonjour", "", "soleil"]
        assert result.n_entries == 3
        assert result.per_entry_scores == [0.9, 0.1, None, 0.9]
        assert result.corpus_score == pytest.approx((0.9 + 0.1 + 0.9) / 3, abs=1e-4)


# ---------------------------------------------------------------------------
# Test: corpus_comet metric function
# ---------------------------------------------------------------------------

class TestCorpusCOMETMetricFn:
    """Test the significance-compatible metric function."""

    def test_returns_none_when_unavailable(self):
        # COMET absent → None (NOT 0.0). 0.0 is a real worst-case system score;
        # "metric unavailable" must be distinguishable from it. Mirrors compute_qe().
        with patch("mt_eval_harness.metrics_comet.HAS_COMET", False):
            score = corpus_comet([])
            assert score is None

    def test_returns_none_for_empty(self):
        # No valid entries → None, same rationale as above (absent ≠ scored 0).
        with patch("mt_eval_harness.metrics_comet.HAS_COMET", False):
            score = corpus_comet(_make_valid_entries())
            assert score is None


# ---------------------------------------------------------------------------
# Test: model caching
# ---------------------------------------------------------------------------

_MISSING = object()


class TestModelCaching:
    """Verify that model loading is cached correctly."""

    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        import mt_eval_harness.metrics_comet as mc
        mc._cached_model = None
        mc._cached_model_name = None
        yield
        mc._cached_model = None
        mc._cached_model_name = None

    def test_cache_set_after_load(self):
        """After a successful load, the cache should be populated."""
        import mt_eval_harness.metrics_comet as mc

        mock_model = MagicMock()

        # Patch at the function level since comet may not be installed
        # and download_model/load_from_checkpoint won't be module attrs
        original_has = mc.HAS_COMET
        mc.HAS_COMET = True
        _saved = {n: getattr(mc, n, _MISSING)
                  for n in ("download_model", "load_from_checkpoint")}

        try:
            with patch.dict("sys.modules", {"comet": MagicMock()}):
                # Manually mock the functions used inside _load_model
                import types
                mc.download_model = MagicMock(return_value="/fake/path")
                mc.load_from_checkpoint = MagicMock(return_value=mock_model)

                model = mc._load_model("test-model")

                assert model is mock_model
                assert mc._cached_model is mock_model
                assert mc._cached_model_name == "test-model"
        finally:
            mc.HAS_COMET = original_has
            # Restore what was there. With COMET installed these are the REAL
            # functions — deleting them (the old cleanup) broke every later
            # test that loads a model; without COMET they did not exist.
            for _name, _orig in _saved.items():
                if _orig is _MISSING:
                    if hasattr(mc, _name):
                        delattr(mc, _name)
                else:
                    setattr(mc, _name, _orig)

    def test_cache_reused_on_second_call(self):
        """Second call with same model name should not re-download."""
        import mt_eval_harness.metrics_comet as mc

        mock_model = MagicMock()
        mc._cached_model = mock_model
        mc._cached_model_name = "test-model"

        # When the cache hits, _load_model returns immediately without
        # calling download_model at all, so no patching needed.
        model = mc._load_model("test-model")
        assert model is mock_model

    def test_cache_invalidated_on_model_change(self):
        """Different model name should trigger a new download."""
        import mt_eval_harness.metrics_comet as mc

        old_model = MagicMock()
        mc._cached_model = old_model
        mc._cached_model_name = "old-model"

        new_model = MagicMock()
        original_has = mc.HAS_COMET
        mc.HAS_COMET = True
        _saved = {n: getattr(mc, n, _MISSING)
                  for n in ("download_model", "load_from_checkpoint")}

        try:
            mc.download_model = MagicMock(return_value="/fake")
            mc.load_from_checkpoint = MagicMock(return_value=new_model)

            model = mc._load_model("new-model")
            assert model is new_model
            assert mc._cached_model_name == "new-model"
        finally:
            mc.HAS_COMET = original_has
            for _name, _orig in _saved.items():
                if _orig is _MISSING:
                    if hasattr(mc, _name):
                        delattr(mc, _name)
                else:
                    setattr(mc, _name, _orig)


# ---------------------------------------------------------------------------
# Test: tester.py attaches each COMET score to its own entry
# ---------------------------------------------------------------------------

def test_tester_report_keeps_comet_scores_on_their_own_entries(tmp_path):
    """End to end: an empty prediction in the middle of a run is scored, and no
    later entry inherits its neighbour's score (the pre-0.2 shift)."""
    from mt_eval_harness.tester import analyze_run_log

    class _Out:
        def __init__(self, data):
            self.scores = [0.9 if d["mt"] else 0.1 for d in data]
            self.system_score = sum(self.scores) / len(self.scores)

    class _Model:
        def predict(self, data, gpus=0, **kwargs):
            return _Out(data)

    run_log = {
        "run_id": "comet-align",
        "config": {"target_lang": "French", "target_lang_code": "fr"},
        "results": [
            {"id": 0, "source": "hello", "expected": "bonjour", "predicted": "bonjour", "error": None},
            {"id": 1, "source": "cat", "expected": "chat", "predicted": "", "error": None},
            {"id": 2, "source": "dog", "expected": "chien", "predicted": "chien", "error": None},
        ],
    }
    with patch("mt_eval_harness.metrics_comet.HAS_COMET", True), \
         patch("mt_eval_harness.metrics_comet._load_model", return_value=_Model()), \
         patch("mt_eval_harness.metrics_comet._is_xlmr_high_resource", return_value=True):
        report = analyze_run_log(run_log, output_path=tmp_path / "r.json", compute_ci=False)
    assert [e.get("comet_score") for e in report["entries"]] == [0.9, 0.1, 0.9]
    assert report["overall"]["comet_score"] == pytest.approx((0.9 + 0.1 + 0.9) / 3, abs=1e-4)


# ---------------------------------------------------------------------------
# Installing COMET: say why it cannot run, and prove an install imports
# ---------------------------------------------------------------------------

def test_python_blocker_names_the_reason(monkeypatch):
    from mt_eval_harness import metrics_comet as mc
    monkeypatch.setattr(mc, "COMET_MAX_PYTHON", (3, 0))
    reason = mc.comet_python_blocker()
    assert "functools._HashedSeq" in reason and "3.12 or 3.13" in reason
    monkeypatch.setattr(mc, "COMET_MAX_PYTHON", (99, 0))
    assert mc.comet_python_blocker() is None


def test_install_refuses_on_a_blocked_python(monkeypatch, capsys):
    from mt_eval_harness import metrics_comet as mc
    from mt_eval_harness import setup_wizard as sw
    monkeypatch.setattr(sw, "check_comet_installed", lambda: False)
    monkeypatch.setattr(mc, "COMET_MAX_PYTHON", (3, 0))
    called = []
    monkeypatch.setattr(sw, "_pip_install", lambda *a, **k: called.append(a) or True)
    assert sw.install_comet(interactive=False) is False
    assert not called
    assert "cannot run here" in capsys.readouterr().out


def test_install_that_does_not_import_is_a_failure(monkeypatch, capsys):
    import subprocess
    from mt_eval_harness import metrics_comet as mc
    from mt_eval_harness import setup_wizard as sw
    monkeypatch.setattr(sw, "check_comet_installed", lambda: False)
    monkeypatch.setattr(mc, "COMET_MAX_PYTHON", (99, 0))
    specs = []
    monkeypatch.setattr(sw, "_pip_install", lambda spec, desc: specs.append(spec) or True)
    monkeypatch.setattr(sw.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        a, 1, "", "ModuleNotFoundError: No module named 'pkg_resources'"))
    assert sw.install_comet(interactive=False) is False
    assert "setuptools<81" in specs[0]
    assert "does not import: ModuleNotFoundError" in capsys.readouterr().out
