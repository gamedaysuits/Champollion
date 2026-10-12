import json

import pytest

from nmt_forge.errors import LedgerError
from nmt_forge.ledger import Ledger


def test_chain_verifies_and_grows(tmp_path):
    led = Ledger(tmp_path / "ledger.jsonl")
    led.append("register", set="s1", role="test")
    led.append("read", set="s1", purpose="audit")
    assert led.verify_chain() == 2
    entries = led.entries()
    assert entries[0]["prev"] == "genesis"
    assert entries[1]["prev"] == entries[0]["entry_hash"]


def test_tampered_entry_breaks_chain(tmp_path):
    led = Ledger(tmp_path / "ledger.jsonl")
    led.append("register", set="s1", role="test")
    led.append("read", set="s1", purpose="score")
    lines = led.path.read_text().splitlines()
    doc = json.loads(lines[0])
    doc["set"] = "s2"  # rewrite history
    lines[0] = json.dumps(doc)
    led.path.write_text("\n".join(lines) + "\n")
    with pytest.raises(LedgerError):
        led.verify_chain()


def test_deleted_entry_breaks_chain(tmp_path):
    led = Ledger(tmp_path / "ledger.jsonl")
    for i in range(3):
        led.append("read", set="s1", purpose="audit", i=i)
    lines = led.path.read_text().splitlines()
    led.path.write_text("\n".join([lines[0], lines[2]]) + "\n")
    with pytest.raises(LedgerError):
        led.verify_chain()


def test_spend_report(tmp_path):
    led = Ledger(tmp_path / "ledger.jsonl")
    led.append("register", set="s1", role="sealed")
    led.append("read", set="s1", purpose="audit")
    led.append("read", set="s1", purpose="score", config_hash="abc")
    led.append("score", set="s1", config_hash="abc")
    led.append("sealed-spend", set="s1", config_hash="abc")
    led.append("read", set="other", purpose="score")
    rep = led.spend_report("s1")
    assert rep["reads_by_purpose"] == {"audit": 1, "score": 1}
    assert rep["score_events"] == 1
    assert rep["sealed_spends"] == 1
    assert rep["distinct_configs"] == ["abc"]
    assert led.sealed_spent("s1") and not led.sealed_spent("other")


def test_find_filters(tmp_path):
    led = Ledger(tmp_path / "ledger.jsonl")
    led.append("read", set="a", purpose="score")
    led.append("read", set="b", purpose="audit")
    assert len(led.find("read", set="a")) == 1
    assert len(led.find("read")) == 2
    assert led.find("prereg") == []
