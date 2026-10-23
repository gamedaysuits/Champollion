"""--hooks and --fst-retries are refused, not silently ignored.

Found 2026-10-09 (framework-core inventory): `mt-eval run --hooks fst_gate`
printed "Hooks: fst_gate" and tagged the run id "_hooks", but the command line
has no hook registry, so execute_run() received no hook objects and applied
nothing. `--fst-retries N` was parsed, fingerprinted and printed, and no code
ever read it. Both now refuse with the reason; a Python caller that passes
real hook objects still gets its hooks.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from mt_eval_harness.cli import args_to_config, build_parser
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run


def _corpus(tmp_path):
    path = tmp_path / "c.json"
    path.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"},
                    "license": "CC-BY-4.0"},
        "entries": [{"id": str(i), "source": f"hello {i}",
                     "reference": f"bonjour {i}"} for i in range(3)]}))
    return path


def _config(tmp_path, **kw):
    return RunConfig(provider="openrouter", corpus_path=str(_corpus(tmp_path)),
                     target_lang="French", output_dir=str(tmp_path / "out"),
                     cache_dir=str(tmp_path / "cache"), dataset="all", **kw)


def test_fst_retries_is_refused_by_validate(tmp_path):
    errors = _config(tmp_path, fst_retries=3).validate()
    assert any("--fst-retries 3 is not implemented" in e for e in errors)


def test_zero_fst_retries_is_not_an_error(tmp_path):
    errors = _config(tmp_path).validate()
    assert not any("fst-retries" in e for e in errors)


def test_a_named_hook_nobody_supplied_is_refused(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with pytest.raises(ValueError) as ei:
        asyncio.run(execute_run(_config(tmp_path, post_hooks=["fst_gate"])))
    msg = str(ei.value)
    assert "hook 'fst_gate'" in msg and "no hook registry" in msg


def test_cli_hooks_flag_reaches_the_refusal(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    args = build_parser().parse_args(
        ["run", "--corpus", str(_corpus(tmp_path)), "--hooks", "fst_gate"])
    config = args_to_config(args)
    assert config.post_hooks == ["fst_gate"]
    with pytest.raises(ValueError, match="no hook registry"):
        asyncio.run(execute_run(config))


def test_inert_flags_are_hidden_from_help():
    text = build_parser().format_help()
    run_help = [a for a in build_parser()._subparsers._group_actions[0].choices["run"]._actions]
    shown = {o for a in run_help if a.help != "==SUPPRESS==" for o in a.option_strings}
    assert "--hooks" not in shown and "--fst-retries" not in shown
    assert text  # the top-level help still renders


class _Recorder:
    name = "recorder"

    def __init__(self):
        self.seen = 0

    async def process(self, entry, result, config, api_fn=None):
        self.seen += 1
        return result


def test_a_supplied_hook_passes_the_check(tmp_path, monkeypatch):
    """The refusal only fires for unsupplied names: a supplied hook object
    clears the check (the run then stops later, at the missing API key)."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    from mt_eval_harness.providers import openrouter as openrouter_provider

    def missing():
        raise RuntimeError("OPENROUTER_API_KEY not found (test)")
    monkeypatch.setattr(openrouter_provider, "_load_api_key", missing)
    with pytest.raises(RuntimeError, match="not found"):
        asyncio.run(execute_run(_config(tmp_path, post_hooks=["recorder"]),
                                post_hooks=[_Recorder()]))
