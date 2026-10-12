"""`node init` has a slot for the sealed holdout, and `node ledger verify`
checks the config it says it checks.

Synthetic researcher persona, Round 2 (2026-10-03): the template written by
`mt-eval node init` had only secret_set_id/secret_artifact per contest —
nothing said where a sealed holdout goes — and `node ledger verify` passed a
config without it, printing only "chain verifies: 0 entries". The runbook
said verify "names the first value that is still wrong". Now the template
carries holdout_set_id + holdout_corpus, a leftover "<…>" anywhere is refused
by name, and verify prints what it checked (sets, gate, every declared file
present) before replaying the chain.
"""

from __future__ import annotations

import json
import sys
from unittest.mock import patch

import pytest

from mt_eval_harness import contest_node
from mt_eval_harness.cli import main
from mt_eval_harness.contest_node import (
    NodeConfigError,
    check_node_config,
    load_node_config,
)

GATE = {"qualifier_id": "eval-qaa-qab-x-qualifier-v2026",
        "corpus_card_id": "eval-qaa-qab-x-qualifier-v2026",
        "threshold": 35.0, "metric": "composite", "year": 2026}


@pytest.fixture(autouse=True)
def _unbind_cards():
    from mt_eval_harness import language_cards as lc
    lc.reset_state()
    yield
    lc.reset_state()


def _filled(tmp_path, **contest_over) -> dict:
    """A node.json filled in from a prepare manifest, files on disk."""
    cards = tmp_path / "cards"
    cards.mkdir(exist_ok=True)
    (cards / "qab.json").write_text(json.dumps({"code": "qab", "name": "Test"}))
    files = {}
    for name in ("secret.sealed.json", "holdout.sealed.json", "dev.json",
                 "score-sign.key.json"):
        f = tmp_path / name
        f.write_text("{}", encoding="utf-8")
        files[name] = str(f)
    contest = {
        "secret_set_id": "eval-qaa-qab-x-secret-v1",
        "secret_artifact": files["secret.sealed.json"],
        "holdout_set_id": "eval-qaa-qab-x-holdout-v1",
        "holdout_corpus": files["holdout.sealed.json"],
        "custody": "threshold-quorum",
        "corpus_version": "v1",
        "language_pair": "qaa>qab",
        "dev_corpus": files["dev.json"],
        "qualifier": dict(GATE),
    }
    contest.update(contest_over)
    contest = {k: v for k, v in contest.items() if v is not None}
    return {"node_id": "org-node-1", "cards_dir": str(cards),
            "contests": {"c1": contest},
            "signing_key": files["score-sign.key.json"],
            "airgap": {"state_dir": str(tmp_path / "airgap"),
                       "assert_airgap": True}}


def _write(tmp_path, cfg) -> str:
    p = tmp_path / "node.json"
    p.write_text(json.dumps(cfg), encoding="utf-8")
    return str(p)


def test_the_template_has_a_slot_for_the_sealed_holdout():
    tpl = json.loads(contest_node.node_template_text())
    (entry,) = tpl["contests"].values()
    assert {"holdout_set_id", "holdout_corpus"} <= set(entry)
    assert "holdout.corpus_sealed_artifact" in entry["holdout_corpus"]
    assert "0-100" in entry["_comment"]


def test_a_holdout_slot_left_unfilled_is_named(tmp_path):
    cfg = _filled(tmp_path)
    cfg["contests"]["c1"]["holdout_corpus"] = (
        "<path to the sealed holdout — manifest.json: "
        "holdout.corpus_sealed_artifact (delete if none)>")
    with pytest.raises(NodeConfigError, match="holdout"):
        load_node_config(_write(tmp_path, cfg))


@pytest.mark.parametrize("key", ["node_id", "signing_key"])
def test_a_leftover_placeholder_anywhere_is_refused_by_name(tmp_path, key):
    cfg = _filled(tmp_path)
    cfg[key] = "<fill me in>"
    with pytest.raises(NodeConfigError, match=key):
        load_node_config(_write(tmp_path, cfg))


def test_a_leftover_contest_placeholder_is_refused_by_its_path(tmp_path):
    cfg = _filled(tmp_path, secret_artifact="<path to the sealed secret set>")
    with pytest.raises(NodeConfigError, match=r"contests\.c1\.secret_artifact"):
        load_node_config(_write(tmp_path, cfg))


def test_check_reports_sets_gate_and_files(tmp_path):
    cfg = load_node_config(_write(tmp_path, _filled(tmp_path)))
    text = "\n".join(check_node_config(cfg))
    assert "sealed set eval-qaa-qab-x-secret-v1" in text
    assert "sealed holdout eval-qaa-qab-x-holdout-v1" in text
    assert "35.0 on the chrF++ 0-100 qualifier scale" in text
    for key in ("secret_artifact", "holdout_corpus", "dev_corpus",
                "signing_key"):
        assert key in text


def test_a_declared_file_that_is_not_here_is_refused(tmp_path):
    cfg = load_node_config(_write(tmp_path, _filled(
        tmp_path, secret_artifact=str(tmp_path / "missing.sealed.json"))))
    with pytest.raises(NodeConfigError, match="secret_artifact"):
        check_node_config(cfg)


def test_ledger_verify_says_what_it_checked_then_the_chain(tmp_path, capsys):
    path = _write(tmp_path, _filled(tmp_path))
    with patch.object(sys, "argv", ["mt-eval", "node", "ledger", "verify",
                                    "--config", path]):
        main()
    out = capsys.readouterr().out
    assert "every declared file is present" in out
    assert "sealed holdout eval-qaa-qab-x-holdout-v1" in out
    assert out.index("present") < out.index("chain verifies: 0 entries")


def test_ledger_verify_fails_on_a_missing_declared_file(tmp_path, capsys):
    cfg = _filled(tmp_path)
    cfg["signing_key"] = str(tmp_path / "nope.key.json")
    path = _write(tmp_path, cfg)
    with patch.object(sys, "argv", ["mt-eval", "node", "ledger", "verify",
                                    "--config", path]):
        with pytest.raises(SystemExit):
            main()
    assert "signing_key" in capsys.readouterr().err


def test_a_contest_without_a_holdout_loads_once_the_slots_are_deleted(tmp_path):
    cfg = load_node_config(_write(tmp_path, _filled(
        tmp_path, holdout_set_id=None, holdout_corpus=None)))
    assert "holdout_set_id" not in cfg["contests"]["c1"]
    assert "sealed holdout" not in "\n".join(check_node_config(cfg))
