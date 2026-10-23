"""The Python half of the cross-runtime card-adapter gate.

shared/test-fixtures/card-adapter/ holds golden atlas-shape fixture cards and
expected.json, the COMMITTED arbiter both runtimes must match.
cli/test/card-adapter-parity.test.js proves the JS reader still matches it;
this file proves ``normalize_card`` projects the SAME fixtures to the SAME
arbiter. A divergence in either adapter fails exactly one side, which names
the drifted runtime. Wired into scripts/ssot_parity_gate.sh.
"""

import json
from pathlib import Path

import pytest

from mt_eval_harness.language_cards import normalize_card

FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "card-adapter"

# The shared bridge vocabulary — the fields the two adapters promise to agree
# on. methodSupport/metricModelSupport flattening is deliberately NOT here:
# each runtime flattens in its own layer, a documented asymmetry.
CONTRACT = [
    "name", "nativeName", "aliases", "script", "dir", "isoType",
    "isoScopeInitial", "speakerEstimates", "vitality", "dataSources", "iso639_3",
]


def _project(card):
    return {k: card[k] for k in CONTRACT if card.get(k) is not None}


def _expected():
    return json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))


def _fixture_files():
    return sorted((FIXTURES / "cards").glob("*.json"))


def test_arbiter_covers_every_fixture():
    codes = sorted(f.stem for f in _fixture_files())
    assert sorted(_expected().keys()) == codes


@pytest.mark.parametrize("fixture", _fixture_files(), ids=lambda p: p.stem)
def test_projects_fixture_to_arbiter(fixture):
    card = json.loads(fixture.read_text(encoding="utf-8"))
    projected = _project(normalize_card(card))
    assert projected == _expected()[fixture.stem]
