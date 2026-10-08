"""The scoring node never reaches the network for language-card metadata.

`publish.assemble_run_card` names a run's language pair through the
language-card SSOT. With no local card directory that read used to go out to
the trading-card index over HTTP, and on a node it is wrong in BOTH
directions (measured on the Lima guests, 2026-09-07 —
docs/SOVEREIGN_SMOKE_2026-09-07.md):

  - air-gapped, the fetch fails and the whole scoring dies;
  - CONNECTED, it silently SUCCEEDS — so the act of scoring a sealed contest
    tells the index host that a sealed run is happening.

So the node lane binds itself to a LOCAL index at startup
(`language_cards.require_local_cards`, driven by node.json's `cards_dir`) and
a node with no index REFUSES, naming the missing configuration. These tests
hold that line: no outbound call on any node path, and a refusal — never a
fabricated empty catalogue — when the cards are not there.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import contest_node
from mt_eval_harness import language_cards as lc
from mt_eval_harness import language_cards_remote as lcr


@pytest.fixture(autouse=True)
def _clean_card_state(monkeypatch):
    """No binding, no indexes, and any network fetch is a test failure."""
    lc.reset_state()
    for var in ("MT_EVAL_NO_REMOTE_REGISTRY", "CHAMPOLLION_OFFLINE",
                "MT_EVAL_CARDS_DIR", "CHAMPOLLION_CARDS_DIR"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(lc, "_read_remote_index_cache", lambda **kw: None)
    monkeypatch.setattr(lc, "_write_remote_index_cache", lambda rows: None)
    yield
    lc.reset_state()


@pytest.fixture
def fetches(monkeypatch):
    """Record every remote card fetch the code under test attempts."""
    calls: list[str] = []

    def _index(**kw):
        calls.append("index")
        raise AssertionError(
            "the node lane fetched the language-card index over the network")

    def _detail(code, **kw):
        calls.append(f"detail:{code}")
        raise AssertionError("the node lane fetched a card over the network")

    monkeypatch.setattr(lcr, "fetch_index_rows", _index)
    monkeypatch.setattr(lcr, "fetch_detail_card", _detail)
    return calls


def cards_dir(tmp_path, *codes: str):
    d = tmp_path / "cards"
    d.mkdir(exist_ok=True)
    for code in codes:
        (d / f"{code}.json").write_text(
            json.dumps({"code": code, "name": code.upper()}), encoding="utf-8")
    return d


def write_node_cfg(tmp_path, **extra):
    cfg = {
        "node_id": "test-node-1",
        "contests": {"c1": {"secret_set_id": "eval-s-v1",
                            "secret_artifact": "/x/a.sealed.json",
                            "custody": "threshold-quorum"}},
    }
    cfg.update(extra)
    p = tmp_path / "node.json"
    p.write_text(json.dumps(cfg), encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# require_local_cards — the binding itself
# ---------------------------------------------------------------------------

def test_binding_reads_the_declared_dir_and_never_the_network(tmp_path, fetches):
    d = cards_dir(tmp_path, "crk", "eng")
    assert lc.require_local_cards(d, reason="test") == d
    assert lc.get_card("crk")["name"] == "CRK"
    assert lc._mode == "repo"
    assert fetches == []


def test_bound_process_refuses_instead_of_fetching(tmp_path, monkeypatch,
                                                   fetches):
    """Bound, then the index is gone: a refusal, not an outbound request."""
    d = cards_dir(tmp_path, "crk")
    lc.require_local_cards(d, reason="node config /x/node.json")
    lc.get_card("crk")  # loads from disk

    # The drive is unplugged mid-life. The remote path must NOT be the
    # fallback — it is the thing this binding exists to prevent.
    for f in d.iterdir():
        f.unlink()
    d.rmdir()
    lc._reset_indexes()
    with pytest.raises(lcr.LanguageCardsUnavailable) as exc:
        lc.resolve_code("crk")
    assert "cards_dir" in str(exc.value)
    assert "node config /x/node.json" in str(exc.value)
    assert fetches == []


def test_binding_refuses_an_empty_directory(tmp_path, fetches):
    """An existing but empty index is not a catalogue either."""
    empty = tmp_path / "cards"
    empty.mkdir()
    with pytest.raises(lcr.LanguageCardsUnavailable, match="no language cards"):
        lc.require_local_cards(empty, reason="test")
    assert fetches == []


def test_binding_refuses_a_missing_directory(tmp_path, fetches):
    with pytest.raises(lcr.LanguageCardsUnavailable, match="not a directory"):
        lc.require_local_cards(tmp_path / "nope", reason="test")
    assert fetches == []


def test_binding_survives_a_failed_rebind(tmp_path, fetches):
    """A bad rebind must not silently unbind the process."""
    good = cards_dir(tmp_path, "crk")
    lc.require_local_cards(good, reason="test")
    with pytest.raises(lcr.LanguageCardsUnavailable):
        lc.require_local_cards(tmp_path / "nope", reason="test")
    assert lc._local_only is True
    assert lc.get_card("crk")["name"] == "CRK"
    assert fetches == []


def test_no_local_index_anywhere_is_a_refusal(monkeypatch, fetches):
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    with pytest.raises(lcr.LanguageCardsUnavailable) as exc:
        lc.require_local_cards(None, reason="node config /x/node.json")
    msg = str(exc.value)
    assert "cards_dir" in msg and "MT_EVAL_CARDS_DIR" in msg
    assert fetches == []


# ---------------------------------------------------------------------------
# load_node_config — the node declares its index, or refuses at startup
# ---------------------------------------------------------------------------

def test_node_config_binds_its_declared_cards_dir(tmp_path, fetches):
    d = cards_dir(tmp_path, "crk", "eng", "fra")
    cfg = contest_node.load_node_config(
        write_node_cfg(tmp_path, cards_dir=str(d)))
    assert cfg["cards_dir"] == str(d)
    assert lc._local_only is True
    assert lc.get_card("fra")["name"] == "FRA"
    assert fetches == []


def test_node_config_refuses_a_missing_cards_dir(tmp_path, fetches):
    p = write_node_cfg(tmp_path, cards_dir=str(tmp_path / "not-here"))
    with pytest.raises(contest_node.NodeConfigError, match="not a directory"):
        contest_node.load_node_config(p)
    assert fetches == []


def test_node_config_refuses_an_empty_cards_dir(tmp_path, fetches):
    empty = tmp_path / "cards"
    empty.mkdir()
    p = write_node_cfg(tmp_path, cards_dir=str(empty))
    with pytest.raises(contest_node.NodeConfigError, match="no language cards"):
        contest_node.load_node_config(p)
    assert fetches == []


def test_node_config_refuses_when_no_index_resolves(tmp_path, monkeypatch,
                                                    fetches):
    """The measured failure: no cards, no network. Startup refusal, by name."""
    monkeypatch.setattr(lc, "_find_cards_dir", lambda: None)
    with pytest.raises(contest_node.NodeConfigError) as exc:
        contest_node.load_node_config(write_node_cfg(tmp_path))
    assert "cards_dir" in str(exc.value)
    assert fetches == []


def test_node_config_falls_back_to_the_env_declared_dir(tmp_path, monkeypatch,
                                                        fetches):
    """MT_EVAL_CARDS_DIR is how the deploy kit declares it; still no network."""
    d = cards_dir(tmp_path, "crk", "eng")
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(d))
    cfg = contest_node.load_node_config(write_node_cfg(tmp_path))
    assert cfg["cards_dir"] == str(d)
    assert fetches == []


# ---------------------------------------------------------------------------
# The path that leaked: publish's language resolution, on a bound node
# ---------------------------------------------------------------------------

def test_publish_language_resolution_stays_local(tmp_path, fetches):
    """The exact read assemble_run_card makes, with a node's binding in force."""
    from mt_eval_harness import publish

    d = cards_dir(tmp_path, "crk")
    contest_node.load_node_config(write_node_cfg(tmp_path, cards_dir=str(d)))
    assert publish._resolve_lang_to_code("crk") == "crk"
    # A language this node does NOT carry resolves to the honest sentinel —
    # it does not go looking for one on the network.
    assert publish._resolve_lang_to_code("Yoruba") == "?"
    assert fetches == []
