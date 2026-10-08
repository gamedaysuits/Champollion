"""Run outputs and caches are kept out of git.

Regression (synthetic Cree-school persona, 2026-10-03): the default output
dir (eval/logs/harness) and cache dir (eval/cache/harness) sit inside the
user's project and hold copies of the test sentences — one `git add --all`
from being committed. mt-eval now drops a `.gitignore` containing `*` into
the directories it creates and into its own defaults (never over an
existing one, never into a directory the user already had).
"""

from __future__ import annotations

import os
import shutil
import subprocess

import pytest

from mt_eval_harness.cache import PRIVATE_DIR_GITIGNORE, ResultCache, ensure_private_dir
from mt_eval_harness.config import DEFAULT_CACHE_DIR, DEFAULT_OUTPUT_DIR, RunConfig
from mt_eval_harness.pipeline import write_run_log


def _log(run_id="r1"):
    return {"run_id": run_id, "results": [{"source": "tânisi", "expected": "hello"}]}


def test_a_new_output_dir_is_ignored(tmp_path):
    out = tmp_path / "runs" / "new"
    write_run_log(_log(), str(out))
    assert (out / ".gitignore").read_text() == PRIVATE_DIR_GITIGNORE
    assert PRIVATE_DIR_GITIGNORE.rstrip().endswith("*")


def test_the_default_dirs_are_ignored_even_if_they_already_exist(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / DEFAULT_OUTPUT_DIR).mkdir(parents=True)     # made by an older run
    write_run_log(_log(), DEFAULT_OUTPUT_DIR)
    assert (tmp_path / DEFAULT_OUTPUT_DIR / ".gitignore").is_file()
    ResultCache(RunConfig(cache_dir=DEFAULT_CACHE_DIR))
    assert (tmp_path / DEFAULT_CACHE_DIR / ".gitignore").is_file()


def test_a_directory_the_user_already_had_is_left_alone(tmp_path):
    mine = tmp_path / "results"
    mine.mkdir()
    write_run_log(_log(), str(mine))
    assert not (mine / ".gitignore").exists()


def test_an_existing_gitignore_is_never_overwritten(tmp_path):
    d = tmp_path / "x"
    d.mkdir()
    (d / ".gitignore").write_text("!keep.json\n")
    ensure_private_dir(d, harness_default=True)
    assert (d / ".gitignore").read_text() == "!keep.json\n"


def test_cache_root_is_ignored_not_just_its_hash_dir(tmp_path):
    root = tmp_path / "cache"
    cache = ResultCache(RunConfig(cache_dir=str(root)))
    assert (root / ".gitignore").is_file()
    assert cache.cache_dir.parent == root


@pytest.mark.skipif(shutil.which("git") is None, reason="git not installed")
def test_git_add_all_does_not_pick_up_run_outputs(tmp_path):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True, env=env)
    write_run_log(_log(), str(tmp_path / "eval" / "logs" / "harness"))
    subprocess.run(["git", "add", "--all"], cwd=tmp_path, check=True, env=env)
    staged = subprocess.run(["git", "diff", "--cached", "--name-only"],
                            cwd=tmp_path, check=True, env=env,
                            capture_output=True, text=True).stdout
    assert staged.strip() == ""
