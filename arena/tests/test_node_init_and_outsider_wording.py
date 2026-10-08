"""An outside organizer can get a complete node config and act on every message.

Regressions (synthetic organizer persona, 2026-10-03):
  * `mt-eval node list` asked for "the service_role key of the DEV branch
    project" — internal wording nobody outside the project can act on. Other
    messages named repo paths a pip install does not have
    (arena/scripts/…, arena/legal/…).
  * The only node.json templates were this package's module docstring and
    the rehearsal's deploy/ files; neither declared a live `qualifier`, so
    the node skipped the public dev-set gate. `mt-eval node init` now writes
    a complete starter from the package, and a half/placeholder gate is
    refused at startup.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

import mt_eval_harness
from mt_eval_harness import contest_node, sovereign_service
from mt_eval_harness.cli import main
from mt_eval_harness.contest_node import NodeConfigError, load_node_config

PKG = Path(mt_eval_harness.__file__).resolve().parent


@pytest.fixture(autouse=True)
def _unbind_cards():
    """load_node_config binds the process to the node's local card index;
    drop that binding so later tests see the normal index again."""
    from mt_eval_harness import language_cards as lc
    lc.reset_state()
    yield
    lc.reset_state()


# ---------------------------------------------------------------------------
# node init
# ---------------------------------------------------------------------------

def test_template_ships_in_the_package_and_declares_the_whole_gate():
    assert contest_node.NODE_TEMPLATE_PATH.parent == PKG / "data"
    # pyproject's package-data glob is what puts it in the wheel.
    assert contest_node.NODE_TEMPLATE_PATH.match("data/*.json")
    tpl = json.loads(contest_node.node_template_text())
    (entry,) = tpl["contests"].values()
    assert {"qualifier", "dev_corpus", "secret_set_id",
            "secret_artifact"} <= set(entry)
    assert {"qualifier_id", "corpus_card_id", "threshold", "metric",
            "year"} <= set(entry["qualifier"])
    assert "node_id" in tpl and "cards_dir" in tpl


def _cli(*argv):
    with patch.object(sys, "argv", ["mt-eval", "node", *argv]):
        main()


def test_node_init_writes_once_and_never_overwrites(tmp_path, capsys):
    target = tmp_path / "node.json"
    _cli("init", "--config", str(target))
    assert json.loads(target.read_text()) == json.loads(
        contest_node.node_template_text())
    assert "manifest.json" in capsys.readouterr().out

    target.write_text('{"node_id": "mine"}')
    with pytest.raises(SystemExit):
        _cli("init", "--config", str(target))
    assert "already exists" in capsys.readouterr().err
    assert json.loads(target.read_text()) == {"node_id": "mine"}


def test_node_init_print_writes_nothing(tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(contest_node, "DEFAULT_CONFIG_PATH", tmp_path / "n.json")
    _cli("init", "--print")
    assert json.loads(capsys.readouterr().out)["contests"]
    assert not (tmp_path / "n.json").exists()


def test_missing_config_points_at_node_init(tmp_path):
    with pytest.raises(NodeConfigError, match="mt-eval node init"):
        load_node_config(tmp_path / "absent.json")


# ---------------------------------------------------------------------------
# the declared qualifier gate is whole or refused
# ---------------------------------------------------------------------------

def _config(tmp_path, **contest):
    cards = tmp_path / "cards"
    cards.mkdir(exist_ok=True)
    (cards / "qab.json").write_text(json.dumps({"code": "qab", "name": "Test"}))
    cfg = {"node_id": "n1", "cards_dir": str(cards),
           "contests": {"c1": {"secret_set_id": "eval-x-secret-v1", **contest}}}
    p = tmp_path / "node.json"
    p.write_text(json.dumps(cfg))
    return p


GATE = {"qualifier_id": "eval-x-qualifier-v2026", "corpus_card_id": "eval-x-dev",
        "threshold": 35.0, "metric": "composite", "year": 2026}


def test_the_unfilled_template_is_refused_at_startup(tmp_path):
    p = tmp_path / "node.json"
    p.write_text(contest_node.node_template_text())
    with pytest.raises(NodeConfigError, match=r"qualifier\.qualifier_id"):
        load_node_config(p)


def test_half_a_gate_is_refused(tmp_path):
    with pytest.raises(NodeConfigError, match="half a gate"):
        load_node_config(_config(tmp_path, qualifier=GATE))


@pytest.mark.parametrize("field, bad", [("threshold", None), ("threshold", 0),
                                        ("year", None), ("corpus_card_id", "")])
def test_a_gate_with_a_missing_value_is_refused(tmp_path, field, bad):
    with pytest.raises(NodeConfigError, match=field):
        load_node_config(_config(tmp_path, qualifier={**GATE, field: bad},
                                 dev_corpus="/data/dev.json"))


def test_a_whole_gate_loads(tmp_path):
    cfg = load_node_config(_config(tmp_path, qualifier=GATE,
                                   dev_corpus="/data/dev.json"))
    assert cfg["contests"]["c1"]["qualifier"]["threshold"] == 35.0


def test_no_declared_gate_still_loads(tmp_path):
    # The relay's exchange carries the gate; a node may declare none.
    assert load_node_config(_config(tmp_path))["contests"]["c1"]


# ---------------------------------------------------------------------------
# wording an outside organizer can act on
# ---------------------------------------------------------------------------

def test_missing_service_key_says_what_an_outsider_can_do(monkeypatch):
    monkeypatch.delenv("MT_EVAL_SUPABASE_SERVICE_KEY", raising=False)
    with pytest.raises(sovereign_service.ServiceConfigError) as ei:
        sovereign_service.service_key()
    msg = str(ei.value)
    assert "dev branch" not in msg.lower()
    assert "MT_EVAL_SUPABASE_URL" in msg
    assert "node stage-request" in msg and "--offline" in msg
    assert "--self-serve" in msg


def test_prod_guard_names_no_internal_process(monkeypatch):
    monkeypatch.setattr(sovereign_service, "SUPABASE_URL",
                        f"https://{sovereign_service._PROD_HOST}")
    monkeypatch.delenv("MT_EVAL_ALLOW_PROD", raising=False)
    with pytest.raises(sovereign_service.ServiceConfigError) as ei:
        sovereign_service.assert_not_prod()
    msg = str(ei.value).lower()
    assert "dev-branch" not in msg and "founder" not in msg
    assert "mt_eval_allow_prod" in msg


_INTERNAL = re.compile(r"dev[ -]branch|arena/scripts/|arena/datasets/|"
                       r"arena/legal/|monorepo|founder/steward|"
                       r"\bfounder\b", re.I)


def _user_facing_strings(path: Path):
    """String literals that are not docstrings (messages, help text)."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    docstrings = {
        id(node.body[0].value) for node in ast.walk(tree)
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                             ast.AsyncFunctionDef))
        and node.body and isinstance(node.body[0], ast.Expr)
        and isinstance(getattr(node.body[0], "value", None), ast.Constant)
    }
    for node in ast.walk(tree):
        if (isinstance(node, ast.Constant) and isinstance(node.value, str)
                and id(node) not in docstrings):
            yield node.lineno, node.value


def test_no_message_points_a_pip_user_at_internal_places():
    hits = []
    for path in sorted(PKG.rglob("*.py")):
        for line, text in _user_facing_strings(path):
            for m in _INTERNAL.finditer(text):
                # A public URL into the repo is fine; a bare repo path is not.
                if "https://github.com/" in text[max(0, m.start() - 80):m.start()]:
                    continue
                hits.append(f"{path.relative_to(PKG)}:{line}: {text.strip()[:100]!r}")
    assert not hits, "\n".join(hits)
