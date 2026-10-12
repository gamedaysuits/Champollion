"""The IP / data-sovereignty consent gate (_ip_notice.acknowledge_ip)."""

from __future__ import annotations

import builtins

from champollion_lyss.crk import _ip_notice
from champollion_lyss.crk._ip_notice import acknowledge_ip


def test_env_acceptance_acknowledges_and_remembers(monkeypatch):
    monkeypatch.setenv("CHAMPOLLION_LYSS_ACCEPT_IP", "1")
    assert acknowledge_ip() is True
    assert _ip_notice._ACK_MARKER.exists()  # remembered for next time


def test_non_interactive_auto_consent():
    # No env, not interactive (CI / harness / piped stdin) → auto-consent so the
    # integrated path runs unattended. The notice is still emitted.
    assert acknowledge_ip(interactive=False) is True


def test_interactive_decline(monkeypatch):
    monkeypatch.setattr(builtins, "input", lambda *a, **k: "n")
    assert acknowledge_ip(interactive=True) is False
    assert not _ip_notice._ACK_MARKER.exists()


def test_interactive_accept(monkeypatch):
    monkeypatch.setattr(builtins, "input", lambda *a, **k: "y")
    assert acknowledge_ip(interactive=True) is True
    assert _ip_notice._ACK_MARKER.exists()


def test_remembered_marker_skips_prompt(monkeypatch):
    _ip_notice._ACK_MARKER.parent.mkdir(parents=True, exist_ok=True)
    _ip_notice._ACK_MARKER.write_text("ack", encoding="utf-8")

    def _boom(*a, **k):
        raise AssertionError("must not prompt when already acknowledged")

    monkeypatch.setattr(builtins, "input", _boom)
    assert acknowledge_ip(interactive=True) is True


def test_warning_is_always_emitted(monkeypatch, caplog):
    monkeypatch.setenv("CHAMPOLLION_LYSS_ACCEPT_IP", "1")
    with caplog.at_level("WARNING"):
        acknowledge_ip()
    assert any(
        "not openly licensed" in r.getMessage() or "community-owned" in r.getMessage()
        for r in caplog.records
    ), "the heavy IP notice must always be logged at WARNING"
