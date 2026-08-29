"""
Fail-honest contract for the language-card loader (language_cards.py).

These tests pin the project rule — *dynamic-from-source + fail-loud, never a
silent empty index* — for the standalone (`pip install`) card path. They are
the regression guard the original silent-degrade bug never had: when no local
card directory exists, _ensure_loaded() used to set _loaded=True with EMPTY
indexes and return codes/None as-is, so a pip user silently mis-scored. Now it
fetches from Supabase and raises LanguageCardsUnavailable when unreachable.

All network + disk-cache access is mocked — these run fully offline.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import language_cards as lc
from mt_eval_harness import language_cards_remote as lcr


# A minimal stand-in for the trading_card_index resolution rows.
FAKE_INDEX = [
    {"code": "fra", "name": "French", "aliases": ["fr"], "iso639_1": "fr"},
    {"code": "crk", "name": "Plains Cree", "aliases": [], "iso639_1": None},
]

# Stand-in for the trading_card_detail blobs (already extends-resolved cards).
FAKE_DETAIL = {
    "fra": {"code": "fra", "name": "French", "iso639_1": "fr",
            "metricModelSupport": {"xlmr": {"tier": "high"}}},
    "crk": {"code": "crk", "name": "Plains Cree", "iso639_1": None,
            "evalStandard": {"package": "champollion-lyss"},
            "resources": {"fsts": [{"install": {"repo": "giellalt/lang-crk"}}]}},
}


@pytest.fixture(autouse=True)
def _reset_card_state(monkeypatch):
    """Start every test with empty card state and no real disk/network."""
    lc._cards.clear()
    lc._parent_cards.clear()
    lc._aliases.clear()
    lc._name_index.clear()
    lc._resolved_cache.clear()
    lc._loaded = False
    lc._cards_dir = None
    lc._mode = "none"
    # Never read or write the real on-disk index cache during tests.
    monkeypatch.setattr(lc, "_read_remote_index_cache", lambda **kw: None)
    monkeypatch.setattr(lc, "_write_remote_index_cache", lambda rows: None)
    for var in ("MT_EVAL_NO_REMOTE_REGISTRY", "CHAMPOLLION_OFFLINE",
                "MT_EVAL_CARDS_DIR", "CHAMPOLLION_CARDS_DIR"):
        monkeypatch.delenv(var, raising=False)
    yield
    lc._loaded = False
    lc._mode = "none"


# --------------------------------------------------------------------------
# The core fail-loud guarantees
# --------------------------------------------------------------------------

def test_no_local_dir_unreachable_source_raises_not_degrade(monkeypatch):
    """No local dir + index fetch fails → RAISE (the old silent degrade)."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)

    def boom(**kw):
        raise lcr.LanguageCardsUnavailable("network down")

    monkeypatch.setattr(lcr, "fetch_index_rows", boom)

    with pytest.raises(lcr.LanguageCardsUnavailable):
        lc.get_card("crk")
    # The bug was: _loaded=True with empty indexes. After a loud failure the
    # loader must NOT have marked itself loaded-but-empty.
    assert lc._loaded is False
    assert lc._mode != "remote"


def test_airgapped_with_no_local_dir_raises(monkeypatch):
    """Air-gapped (MT_EVAL_NO_REMOTE_REGISTRY) + no local dir → fail loud."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setenv("MT_EVAL_NO_REMOTE_REGISTRY", "1")
    with pytest.raises(lcr.LanguageCardsUnavailable):
        lc.resolve_code("crk")


def test_empty_index_is_fail_loud(monkeypatch):
    """A successful-but-empty index is refused, not silently accepted."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    # fetch_index_rows itself raises on zero rows; simulate that contract.
    monkeypatch.setattr(
        lcr, "fetch_index_rows",
        lambda **kw: (_ for _ in ()).throw(
            lcr.LanguageCardsUnavailable("zero rows")),
    )
    with pytest.raises(lcr.LanguageCardsUnavailable):
        lc.get_card("crk")


# --------------------------------------------------------------------------
# Remote happy path
# --------------------------------------------------------------------------

def test_remote_builds_resolution_index(monkeypatch):
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: list(FAKE_INDEX))
    monkeypatch.setattr(lcr, "fetch_detail_card",
                        lambda code, **kw: FAKE_DETAIL.get(code))

    # Alias + name resolution come from the compact index (no detail fetch).
    assert lc.resolve_code("fr") == "fra"
    assert lc.resolve_name("French") == "fra"
    assert lc._mode == "remote"
    assert set(lc.get_all_codes()) == {"fra", "crk"}
    assert lc.get_name("crk") == "Plains Cree"


def test_remote_get_card_fetches_full_card(monkeypatch):
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: list(FAKE_INDEX))
    monkeypatch.setattr(lcr, "fetch_detail_card",
                        lambda code, **kw: FAKE_DETAIL.get(code))

    card = lc.get_card("crk")
    assert card is not None
    assert card["evalStandard"]["package"] == "champollion-lyss"
    # eval-config accessors read the fetched card
    assert lc.get_fst_install_info("crk") == {"repo": "giellalt/lang-crk"}
    assert lc.is_xlmr_high_resource("fra") is True


def test_remote_caches_detail_fetch(monkeypatch):
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: list(FAKE_INDEX))
    calls = []
    monkeypatch.setattr(
        lcr, "fetch_detail_card",
        lambda code, **kw: (calls.append(code), FAKE_DETAIL.get(code))[1])
    lc.get_card("crk")
    lc.get_card("crk")
    assert calls == ["crk"]  # second lookup served from cache


# --------------------------------------------------------------------------
# Per-card semantics: absent ≠ outage
# --------------------------------------------------------------------------

def test_absent_code_returns_none_without_fetch(monkeypatch):
    """A code not in the index → None, with NO network round-trip."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: list(FAKE_INDEX))
    calls = []
    monkeypatch.setattr(
        lcr, "fetch_detail_card",
        lambda code, **kw: (calls.append(code), FAKE_DETAIL.get(code))[1])
    assert lc.get_card("zzz") is None
    assert calls == []  # absence is known from the index; no fetch


def test_detail_outage_raises_not_none(monkeypatch):
    """A network error fetching ONE card raises — never reports 'no card'."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    monkeypatch.setattr(lcr, "fetch_index_rows", lambda **kw: list(FAKE_INDEX))

    def boom(code, **kw):
        raise lcr.LanguageCardsUnavailable("detail fetch failed")

    monkeypatch.setattr(lcr, "fetch_detail_card", boom)
    lc.resolve_code("crk")  # index builds fine
    with pytest.raises(lcr.LanguageCardsUnavailable):
        lc.get_card("crk")


# --------------------------------------------------------------------------
# Local-dir paths still win and never touch the network
# --------------------------------------------------------------------------

def test_local_dir_wins_no_remote_fetch(monkeypatch, tmp_path):
    (tmp_path / "crk.json").write_text(
        json.dumps({"code": "crk", "name": "Plains Cree"}), encoding="utf-8")
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: tmp_path)
    called = []
    monkeypatch.setattr(lcr, "fetch_index_rows",
                        lambda **kw: called.append(1) or [])
    assert lc.resolve_code("crk") == "crk"
    assert lc._mode == "repo"
    assert lc.get_card("crk")["name"] == "Plains Cree"
    assert called == []  # repo mode never reaches the network


def test_cards_dir_env_override(monkeypatch, tmp_path):
    (tmp_path / "crk.json").write_text(
        json.dumps({"code": "crk", "name": "Plains Cree"}), encoding="utf-8")
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(tmp_path))
    assert lc._find_cards_dir() == tmp_path
    assert lc.get_card("crk")["name"] == "Plains Cree"
    assert lc._mode == "repo"
