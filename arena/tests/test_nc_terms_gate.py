"""
Tests for the run-time non-commercial-terms gate in cli._enforce_nc_terms_gate.

The gate is POSITIVE-NC-ONLY (never blocks a corpus it can't confirm is NC) and
fails loud for agents/CI while recording an acknowledgment for the flag path.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from mt_eval_harness.cli import _enforce_nc_terms_gate


def _args(**kw):
    base = {"json": False, "non_interactive": False, "accept_nc_terms": False}
    base.update(kw)
    return SimpleNamespace(**base)


def _config(corpus_path="eval-some-corpus", ack=None):
    return SimpleNamespace(corpus_path=corpus_path, nc_terms_acknowledgment=ack)


def _patch_license(monkeypatch, license_str):
    monkeypatch.setattr(
        "mt_eval_harness.license_use.resolve_corpus_license",
        lambda corpus, registry_path=None: (license_str, corpus),
    )


def test_permissive_corpus_is_never_gated(monkeypatch):
    _patch_license(monkeypatch, "CC-BY-4.0")
    cfg = _config()
    _enforce_nc_terms_gate(_args(json=True), cfg)  # no exit
    assert cfg.nc_terms_acknowledgment is None


def test_unknown_license_is_never_gated(monkeypatch):
    _patch_license(monkeypatch, None)
    cfg = _config()
    _enforce_nc_terms_gate(_args(json=True), cfg)  # no exit, no block
    assert cfg.nc_terms_acknowledgment is None


def test_nc_corpus_with_flag_records_acknowledgment(monkeypatch):
    _patch_license(monkeypatch, "CC-BY-NC-4.0")
    cfg = _config(corpus_path="eval-nc-corpus")
    _enforce_nc_terms_gate(_args(accept_nc_terms=True), cfg)
    ack = cfg.nc_terms_acknowledgment
    assert ack and ack["kind"] == "non-commercial-terms"
    assert ack["via"] == "flag"
    assert ack["license"] == "CC-BY-NC-4.0"
    assert ack["corpus"] == "eval-nc-corpus"


def test_nc_corpus_agent_without_flag_fails_loud(monkeypatch, capsys):
    _patch_license(monkeypatch, "CC-BY-NC-SA-4.0")
    cfg = _config()
    with pytest.raises(SystemExit) as exc:
        _enforce_nc_terms_gate(_args(json=True), cfg)
    assert exc.value.code == 2
    payload = json.loads(capsys.readouterr().out)
    assert payload["error"] == "nc-terms-required"
    assert payload["license"] == "CC-BY-NC-SA-4.0"


def test_already_acknowledged_is_a_noop(monkeypatch):
    # The guided flow pre-attaches an acknowledgment; the gate must not re-prompt.
    _patch_license(monkeypatch, "CC-BY-NC-4.0")
    existing = {"kind": "non-commercial-terms", "via": "guided"}
    cfg = _config(ack=existing)
    _enforce_nc_terms_gate(_args(json=True), cfg)
    assert cfg.nc_terms_acknowledgment is existing


def test_no_corpus_is_a_noop(monkeypatch):
    _patch_license(monkeypatch, "CC-BY-NC-4.0")
    cfg = _config(corpus_path=None)
    _enforce_nc_terms_gate(_args(json=True), cfg)
    assert cfg.nc_terms_acknowledgment is None
