"""The bundled model-defaults copy is the shared file, and every default is exact."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import model_defaults as md
from mt_eval_harness.config import DEFAULT_MODEL, exact_model_refusal

BUNDLED = Path(md.__file__).parent / "data" / "model-defaults.json"
SHARED = Path(__file__).resolve().parents[2] / "shared" / "model-defaults.json"


def test_bundled_copy_matches_shared():
    if not SHARED.exists():
        pytest.skip("shared/model-defaults.json not found (standalone install)")
    assert json.loads(BUNDLED.read_text()) == json.loads(SHARED.read_text()), (
        "mt_eval_harness/data/model-defaults.json has drifted from shared/model-defaults.json — copy it.")


def test_harness_default_comes_from_the_file():
    assert DEFAULT_MODEL == md.default_model("harness")


def test_every_default_is_an_exact_id():
    for role, spec in md.model_defaults().items():
        model = spec["model"]
        assert exact_model_refusal(model, openrouter=spec["provider"] == "openrouter") is None, f"{role}: {model}"


def test_unknown_role_fails_loud():
    with pytest.raises(md.ModelDefaultsError):
        md.default_model("nope")


def test_bundled_retired_aliases_match_shared():
    shared = Path(__file__).resolve().parents[2] / "shared" / "retired-model-aliases.json"
    if not shared.exists():
        pytest.skip("shared/ not present (standalone install)")
    bundled = Path(md.__file__).parent / "data" / "retired-model-aliases.json"
    assert json.loads(bundled.read_text()) == json.loads(shared.read_text())
