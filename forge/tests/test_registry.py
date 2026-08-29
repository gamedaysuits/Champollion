import pytest

from nmt_forge.errors import RegistryError, SealedSetSpent
from tests.conftest import write_jsonl


def _eval_rows(n=6, tag=""):
    return [
        {"source": f"{tag}the vorp {i} sings", "reference": f"vorpa{i} kel"}
        for i in range(n)
    ]


def test_register_get_idempotent(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    e1 = ws.registry.register("e", p, "test")
    e2 = ws.registry.register("e", p, "test")
    assert e1["sha256"] == e2["sha256"]
    assert ws.registry.get("e")["role"] == "test"
    assert ws.registry.get("e")["target_field"] == "reference"
    assert ws.registry.names() == ["e"]
    assert len(ws.ledger.find("register", set="e")) == 1  # idempotent = one event


def test_register_refuses_silent_replacement(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    ws.registry.register("e", p, "test")
    p2 = write_jsonl(tmp_path / "e2.jsonl", _eval_rows(8))
    with pytest.raises(RegistryError, match="allow_rotate"):
        ws.registry.register("e", p2, "test")
    ws.registry.register("e", p2, "test", allow_rotate=True)
    assert ws.registry.get("e")["rows"] == 8
    assert len(ws.ledger.find("rotate", set="e")) == 1


def test_register_refuses_synthetic_rows_as_test(ws, tmp_path):
    for bad_row, marker in [
        ({"source": "<synth> the wug", "reference": "wugto"}, "tagged"),
        ({"source": "the wug", "reference": "wugto",
          "provenance": "champollion-derived [x]"}, "provenance"),
        ({"source": "the wug", "reference": "wugto", "synthetic": True}, "synthetic"),
    ]:
        rows = _eval_rows() + [bad_row]
        p = write_jsonl(tmp_path / f"bad-{marker}.jsonl", rows)
        with pytest.raises(RegistryError, match="REAL DATA ONLY"):
            ws.registry.register(f"bad-{marker}", p, "test")
        # the same rows are fine as TRAINING data concerns — and as dev
        ws.registry.register(f"ok-{marker}", p, "dev")


def test_open_eval_refuses_content_drift(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    ws.registry.register("e", p, "test")
    write_jsonl(p, _eval_rows(7))  # quiet edit after registration
    with pytest.raises(RegistryError, match="changed since registration"):
        ws.registry.open_eval("e", "audit")


def test_open_eval_ledgers_reads(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    ws.registry.register("e", p, "test")
    rows = ws.registry.open_eval("e", "audit", config_hash="c1")
    assert len(rows) == 6
    reads = ws.ledger.find("read", set="e")
    assert len(reads) == 1 and reads[0]["purpose"] == "audit"


def test_sealed_one_shot(ws, tmp_path):
    p = write_jsonl(tmp_path / "s.jsonl", _eval_rows())
    ws.registry.register("s", p, "sealed")
    ws.registry.open_eval("s", "score")           # first spend path: allowed
    ws.ledger.append("sealed-spend", set="s")     # the scorer marks the spend
    with pytest.raises(SealedSetSpent) as e:
        ws.registry.open_eval("s", "score")
    assert "override_respend" in str(e.value)
    # explicit, reasoned override works and is ledgered
    ws.registry.open_eval("s", "score", override_respend="founder said so")
    assert len(ws.ledger.find("override", set="s")) == 1
    # non-score purposes never spend-gate
    ws.registry.open_eval("s", "audit")


def test_bad_inputs(ws, tmp_path):
    with pytest.raises(RegistryError, match="role"):
        ws.registry.register("x", tmp_path / "nope.jsonl", "train")
    empty = tmp_path / "empty.jsonl"
    empty.write_text("")
    with pytest.raises(RegistryError, match="no rows"):
        ws.registry.register("x", empty, "test")
    with pytest.raises(RegistryError, match="no eval set named"):
        ws.registry.get("ghost")


def test_entry_for_file_by_path_and_sha(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    ws.registry.register("e", p, "test")
    assert ws.registry.entry_for_file(p)[0] == "e"
    copy = tmp_path / "copy.jsonl"
    copy.write_bytes(p.read_bytes())  # same content, different path
    assert ws.registry.entry_for_file(copy)[0] == "e"
    other = write_jsonl(tmp_path / "other.jsonl", _eval_rows(9))
    assert ws.registry.entry_for_file(other) is None


def test_key_sets_structure(ws, tmp_path):
    p = write_jsonl(tmp_path / "e.jsonl", _eval_rows())
    ws.registry.register("e", p, "test")
    ks = ws.registry.key_sets()
    assert set(ks) == {"e"}
    assert ks["e"]["role"] == "test"
    assert "the vorp 0 sings" in ks["e"]["source"]
    assert "vorpa0 kel" in ks["e"]["target"]
