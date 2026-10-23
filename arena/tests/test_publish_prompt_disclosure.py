"""What happens to the prompt on publish is said, and a private corpus keeps it.

Regressions (2026-10-03):
  * synthetic researcher: in scores-only mode the dry-run summary said the
    sentence text was withheld, and nothing about the full coaching/system
    prompt (``system_prompt_used``) that still rides the card.
  * synthetic Cree-school persona: a coached run on a LOCAL-ONLY corpus put
    the whole coaching prompt — 40 of the school's own sentence pairs — in
    the payload. A local-only corpus now redacts a coached/custom prompt by
    default and says so.
  * `--redact-coaching` did nothing when the prompt held no corpus pair, so
    it was not a way to keep a prompt private; now it always redacts.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import publish
from mt_eval_harness.publish import _coaching_prompt_content_gate
from test_publish import _write_pair_with_provenance  # noqa: F401

COACHING = "Here are our sentences: tânisi = hello; ekosi = that's it. " * 8


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)


def _report(tmp_path, name, *, local_only: bool, prompt: str = COACHING):
    extra = {"system_prompt_used": prompt,
             "coaching_prompt": prompt, "coaching_prompt_sha256": "c" * 64}
    if local_only:
        extra["dataset_meta"] = {"transmission": "local-only"}
    return _write_pair_with_provenance(tmp_path, name, extra)


def _dry_run(report, **kw):
    return publish.publish_to_supabase(str(report), dry_run=True,
                                       auto_confirm=True, **kw)


def test_scores_only_dry_run_says_the_prompt_is_published(tmp_path, capsys):
    row = _dry_run(_report(tmp_path, "open", local_only=False), scores_only=True)
    out = capsys.readouterr().out
    assert (f"system/coaching prompt ({len(COACHING):,} characters) IS published"
            in out)
    assert "--redact-coaching" in out
    assert row["run_card"]["system_prompt_used"] == COACHING


def test_redact_coaching_always_redacts_and_the_summary_says_so(tmp_path, capsys):
    row = _dry_run(_report(tmp_path, "red", local_only=False),
                   scores_only=True, redact_coaching=True)
    out = capsys.readouterr().out
    card = row["run_card"]
    assert card["system_prompt_used"].startswith("[REDACTED --redact-coaching")
    assert "tânisi" not in json.dumps(row, ensure_ascii=False)
    assert card["system_prompt_sha256"]          # provenance kept
    assert "Prompt:        REDACTED on the card" in out


def test_local_only_corpus_redacts_the_coaching_prompt_by_default(tmp_path, capsys):
    row = _dry_run(_report(tmp_path, "school", local_only=True))
    out = capsys.readouterr().out
    assert row["run_card"]["system_prompt_used"].startswith("[REDACTED local-only")
    assert "tânisi" not in json.dumps(row, ensure_ascii=False)
    assert "redacted on the published card by default".lower() in out.lower()
    assert "Prompt:        REDACTED on the card" in out


def test_local_only_leaves_the_harness_naive_template_alone():
    card = {"system_prompt_used": "Translate from English to Plains Cree.",
            "system_prompt_sha256": "s", "condition": "naive",
            "coaching_data_sha256": None}
    assert _coaching_prompt_content_gate(card, [], None, redact=False,
                                         local_only=True) is None
    assert card["system_prompt_used"].startswith("Translate")
