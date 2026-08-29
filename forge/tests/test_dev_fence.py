import pytest

from nmt_forge.errors import DevFenceError
from nmt_forge.guards.dev_fence import DevFence
from tests.conftest import write_jsonl


def test_missing_dev_refuses_with_fix(ws):
    fence = DevFence(ws)
    with pytest.raises(DevFenceError) as e:
        fence.require_dev("nonexistent")
    msg = str(e.value)
    assert "fix:" in msg and "group_split" in msg


def test_test_role_refused_as_dev(ws, test_set):
    fence = DevFence(ws)
    with pytest.raises(DevFenceError, match="not 'dev'"):
        fence.require_dev("toy-test")


def test_happy_path_returns_rows_and_ledgers(ws, dev_set, test_set):
    fence = DevFence(ws)
    rows = fence.require_dev("toy-dev", config_hash="cfg1")
    assert len(rows) == len(dev_set)
    reads = ws.ledger.find("read", set="toy-dev", purpose="dev-selection")
    assert len(reads) == 1 and reads[0]["config_hash"] == "cfg1"


def test_file_copy_of_test_set_is_caught_by_content(ws, test_set, tmp_path):
    # cp test.jsonl dev.jsonl — identity checks can't catch it once renamed
    # and re-registered would refuse... so simulate a hand-built dev file that
    # CONTAINS test rows.
    sneaky = [{"source": r["source"], "reference": r["reference"]} for r in test_set[:3]]
    sneaky += [{"source": f"fresh dax {i}", "reference": f"daxin{i}"} for i in range(5)]
    p = write_jsonl(tmp_path / "sneaky-dev.jsonl", sneaky)
    ws.registry.register("sneaky-dev", p, "dev")
    fence = DevFence(ws)
    with pytest.raises(DevFenceError) as e:
        fence.require_dev("sneaky-dev")
    msg = str(e.value)
    assert "toy-test" in msg and "mistake #2" in msg


def test_check_rows_direct_use(ws, test_set):
    fence = DevFence(ws)
    # rows a user is about to hand to their own HF trainer as eval_dataset
    bad = [{"source": test_set[0]["source"], "target": "anything"}]
    with pytest.raises(DevFenceError):
        fence.check_rows(bad)
    ok = [{"source": "totally fresh dax", "target": "daxnew"}]
    fence.check_rows(ok)  # no raise


def test_empty_dev_refused(ws):
    fence = DevFence(ws)
    with pytest.raises(DevFenceError, match="empty"):
        fence.check_rows([])


def test_paraphrase_shares_target_is_caught(ws, test_set):
    # only the TARGET matches a test row (source is new) — still refused
    fence = DevFence(ws)
    bad = [{"source": "a brand new sentence", "target": test_set[0]["reference"]}]
    with pytest.raises(DevFenceError, match="target keys"):
        fence.check_rows(bad)
