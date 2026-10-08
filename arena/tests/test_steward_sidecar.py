"""A community's own test set can be marked local-only, in any format.

Synthetic hospital persona (2026-10-03): a sensitive TSV test set had no way
to say "never send me to an outside AI service" — protection depended on the
agent remembering to pick a local model. The steward sidecar
<file>.champollion.json closes that: the harness seals the corpus.
"""

import json

import pytest

from mt_eval_harness.corpus_loader import merge_steward_sidecar, read_steward_sidecar
from mt_eval_harness.transmission_policy import (
    MODE_NO_TRAIN, MODE_SEALED, enforce_transmission_policy, resolve_transmission_policy,
)


def _tsv(tmp_path, sidecar=None):
    f = tmp_path / "nurse_checked_test.tsv"
    f.write_text("Where does it hurt?\tSaan masakit?\n", encoding="utf-8")
    if sidecar is not None:
        (tmp_path / "nurse_checked_test.tsv.champollion.json").write_text(
            sidecar if isinstance(sidecar, str) else json.dumps(sidecar), encoding="utf-8")
    return f


def test_no_sidecar_means_no_extra_metadata(tmp_path):
    assert read_steward_sidecar(_tsv(tmp_path)) == {}


def test_local_only_sidecar_seals_the_corpus(tmp_path):
    f = _tsv(tmp_path, {"transmission": "local-only"})
    meta = merge_steward_sidecar(f, {})
    policy = resolve_transmission_policy("", corpus_meta=meta)
    assert policy.mode == MODE_SEALED
    assert "local-only" in policy.reason


def test_sealed_corpus_refuses_a_remote_provider_and_allows_loopback(tmp_path):
    meta = merge_steward_sidecar(_tsv(tmp_path, {"transmission": "local-only"}), {})
    policy = resolve_transmission_policy("", corpus_meta=meta)
    with pytest.raises(RuntimeError, match="refused"):
        enforce_transmission_policy(policy, provider_name="openrouter",
                                    provider_supports_restricted=True,
                                    provider_basis="openrouter", has_external_method=False)
    prov = enforce_transmission_policy(policy, provider_name="local",
                                       provider_supports_restricted=True,
                                       provider_basis="local", has_external_method=False,
                                       local_transport_verified=True)
    assert prov["enforced"] is True


def test_sidecar_cannot_loosen_a_declared_license(tmp_path):
    f = _tsv(tmp_path, {"license": "CC-BY-4.0"})
    meta = merge_steward_sidecar(f, {"license": "CC-BY-NC-4.0"})
    assert meta["license"] == "CC-BY-NC-4.0"
    assert resolve_transmission_policy("", corpus_meta=meta).mode == MODE_NO_TRAIN


def test_local_only_wins_over_allow_data_collection(tmp_path):
    meta = merge_steward_sidecar(_tsv(tmp_path, {"transmission": "local-only"}), {})
    policy = resolve_transmission_policy("", corpus_meta=meta, allow_data_collection_unregistered=True)
    assert policy.mode == MODE_SEALED


def test_an_unreadable_sidecar_fails_loud(tmp_path):
    with pytest.raises(ValueError, match="not skipped"):
        read_steward_sidecar(_tsv(tmp_path, "{not json"))


def test_unknown_transmission_value_is_refused(tmp_path):
    with pytest.raises(ValueError, match="local-only"):
        read_steward_sidecar(_tsv(tmp_path, {"transmission": "anywhere"}))


def test_local_model_cost_is_unknown_not_zero():
    """A local / unpriced model's report total is None ('unknown'), never $0."""
    from mt_eval_harness.tester import EntryMetrics, _compute_overall
    import dataclasses
    fields = {f.name for f in dataclasses.fields(EntryMetrics)}
    def em(cost):
        kw = {k: None for k in fields}
        kw.update(entry_id="e", error=None, cost_usd=cost, cached=False, exact_match=False,
                  latency_s=0.1, chrf_score=10.0, bleu_score=1.0, tool_call_count=0)
        return EntryMetrics(**{k: v for k, v in kw.items() if k in fields})
    unpriced = _compute_overall([em(None), em(None)])
    assert unpriced["total_cost_usd"] is None and unpriced["cost_unknown"] is True
    priced = _compute_overall([em(0.001), em(None)])
    assert priced["total_cost_usd"] == 0.001
