"""Shared pytest fixtures + import setup for the champollion-lyss test suite.

All tests run fully OFFLINE: the itwêwina API, the FST, and spaCy are mocked, so
the scorer logic is covered without network access or binary/model downloads.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make `champollion_lyss` importable without an editable install (the package
# root is lyss/, the parent of this tests/ directory).
_PKG_ROOT = Path(__file__).resolve().parent.parent
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))

from champollion_lyss.crk import _ip_notice  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_ip_gate(tmp_path, monkeypatch):
    """Every test starts with a clean IP-gate state, an isolated ack marker (never
    the real ~/.mt-eval), and no acknowledgment env vars — so cases are
    deterministic and the real home directory is never written."""
    monkeypatch.setattr(_ip_notice, "_ACK_MARKER", tmp_path / ".crk-ip-acknowledged")
    for var in ("CHAMPOLLION_LYSS_ACCEPT_IP", "CI", "MT_EVAL_AUTO_SETUP"):
        monkeypatch.delenv(var, raising=False)
    _ip_notice._reset_state_for_tests()
    yield
    _ip_notice._reset_state_for_tests()


# --------------------------------------------------------------------------
# Fake spaCy nlp — mimics the slice of the API extract_content_words() uses:
# nlp(text) -> iterable of tokens with .lemma_ / .pos_ / .is_stop. Content words
# are tagged NOUN (kept); a small stoplist is tagged DET+is_stop (dropped).
# --------------------------------------------------------------------------

_STOP = {
    "the", "a", "an", "s", "he", "she", "it", "to", "on", "of", "and",
    "is", "are", "i", "you", "s/he", "him", "her", "they",
}


class _FakeToken:
    def __init__(self, lemma: str, pos: str, is_stop: bool):
        self.lemma_ = lemma
        self.pos_ = pos
        self.is_stop = is_stop


def make_fake_nlp():
    def nlp(text):
        toks = []
        for w in str(text).split():
            w2 = w.strip(".,;:!?").lower()
            if not w2:
                continue
            stop = w2 in _STOP
            toks.append(_FakeToken(w2, "DET" if stop else "NOUN", stop))
        return toks

    return nlp


@pytest.fixture
def fake_nlp():
    return make_fake_nlp()
