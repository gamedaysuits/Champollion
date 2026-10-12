"""A local-only corpus's sentences do not reach the terminal, and its refusals
name the real problem.

Synthetic hospital persona, Round 2 (2026-10-03):

  * `mt-eval compare a b --significance` on the nurse-checked LOCAL-ONLY test
    set printed per-entry was/now diffs with the sentences ("#105: The child
    washes the food after lunch."). The public guide is written for AI agents,
    and an agent reading the terminal sends it to its model provider — the
    tool's own output broke "does not leave this machine". Printed output now
    carries ids + chrF++; `--show-text` is the opt-in for a human; the written
    comparison file is unchanged.
  * `--provider local --base-url https://api.groq.com/openai/v1 --dry-run` was
    refused correctly but told to "Run locally instead: --provider local"
    (which WAS given) and called the local-only file "(sealed)". The refusal
    now names the endpoint and loopback rule, and the corpus's own tier.
"""

from __future__ import annotations

import asyncio
import json
import sys
from unittest.mock import patch

import pytest

from mt_eval_harness.compare import run_compare
from mt_eval_harness.config import RunConfig
from mt_eval_harness.transmission_policy import (
    MODE_SEALED,
    SCRUBBED,
    TransmissionPolicy,
    enforce_transmission_policy,
    resolve_transmission_policy,
    scrub_corpus_text,
    withheld_text_reason,
)

NURSE_SOURCE = "The child washes the food after lunch."
NURSE_REF = "Hinuhan ng bata ang pagkain pagkatapos ng tanghalian."
OLD_OUT = "Kumakain ang bata ng tanghalian."
NEW_OUT = "Hinuhan ng bata ang pagkain pagkatapos ng tanghalian."

LOCAL_ONLY_POLICY = {
    "mode": "sealed", "tier": "local-only", "restricted": True,
    "reason": "the data's steward marked it local-only (corpus metadata) — "
              "only a model on this machine may see it",
}


def _report(path, *, run_id, predicted, exact, chrf, policy=None,
            corpus_path=""):
    cfg = {"model": "local-llama", "prompt_version": "naive",
           "corpus_path": corpus_path}
    if policy is not None:
        cfg["transmission_policy"] = policy
    doc = {
        "run_id": run_id,
        "config": cfg,
        "overall": {"evaluated": 1, "exact_match_rate": float(exact),
                    "corpus_chrf": chrf, "total_cost_usd": None},
        "entries": [{"id": 105, "source": NURSE_SOURCE,
                     "expected": NURSE_REF, "predicted": predicted,
                     "exact_match": exact, "chrf_score": chrf}],
    }
    path.write_text(json.dumps(doc), encoding="utf-8")
    return path


def _pair(tmp_path, **kw):
    a = _report(tmp_path / "a_report.json", run_id="run-a",
                predicted=OLD_OUT, exact=False, chrf=41.2, **kw)
    b = _report(tmp_path / "b_report.json", run_id="run-b",
                predicted=NEW_OUT, exact=True, chrf=100.0, **kw)
    return a, b


# ---------------------------------------------------------------------------
# compare
# ---------------------------------------------------------------------------

def test_compare_withholds_local_only_sentences_and_prints_ids_and_scores(
        tmp_path, capsys):
    a, b = _pair(tmp_path, policy=LOCAL_ONLY_POLICY)
    out_file = tmp_path / "cmp.json"
    run_compare([str(a), str(b)], str(out_file))
    out = capsys.readouterr().out
    for sentence in (NURSE_SOURCE, NURSE_REF, OLD_OUT, NEW_OUT):
        assert sentence not in out
    assert "#105" in out and "41.2" in out and "100.0" in out
    assert "withheld" in out and "local-only" in out and "--show-text" in out
    # The file in the user's own results dir is unchanged: it keeps the text.
    written = json.loads(out_file.read_text(encoding="utf-8"))
    assert written["improvements"][0]["source"] == NURSE_SOURCE


def test_compare_show_text_is_the_human_opt_in(tmp_path, capsys):
    a, b = _pair(tmp_path, policy=LOCAL_ONLY_POLICY)
    run_compare([str(a), str(b)], str(tmp_path / "cmp.json"), show_text=True)
    out = capsys.readouterr().out
    assert NURSE_SOURCE[:50] in out and "was:" in out


def test_compare_reads_a_sidecar_mark_the_run_did_not_record(tmp_path, capsys):
    """A run older than the recorded policy, or a file marked after the run:
    the steward's mark on disk still withholds the text."""
    tsv = tmp_path / "nurse_checked_test.tsv"
    tsv.write_text(f"{NURSE_SOURCE}\t{NURSE_REF}\n", encoding="utf-8")
    (tmp_path / "nurse_checked_test.tsv.champollion.json").write_text(
        '{"transmission": "local-only"}', encoding="utf-8")
    a, b = _pair(tmp_path, corpus_path=str(tsv))
    run_compare([str(a), str(b)], str(tmp_path / "cmp.json"))
    assert NURSE_SOURCE not in capsys.readouterr().out


def test_compare_of_an_open_corpus_still_shows_the_diff(tmp_path, capsys):
    a, b = _pair(tmp_path, policy={"mode": "cleared", "reason": "CC-BY-4.0"})
    run_compare([str(a), str(b)], str(tmp_path / "cmp.json"))
    out = capsys.readouterr().out
    assert NURSE_SOURCE[:50] in out and "withheld" not in out


def test_compare_cli_accepts_show_text(tmp_path, capsys):
    from mt_eval_harness.cli import main
    a, b = _pair(tmp_path, policy=LOCAL_ONLY_POLICY)
    with patch.object(sys, "argv", ["mt-eval", "compare", str(a), str(b),
                                    "-o", str(tmp_path / "c.json"),
                                    "--show-text"]):
        main()
    assert NURSE_SOURCE[:50] in capsys.readouterr().out


@pytest.mark.parametrize("mode,withheld", [
    ("sealed", True), ("consent-required", True),
    ("no-train", False), ("cleared", False)])
def test_withheld_modes_are_the_modes_that_refuse_a_remote_model(mode, withheld):
    doc = {"config": {"transmission_policy": {"mode": mode, "reason": "x"}}}
    assert bool(withheld_text_reason(doc)) is withheld


def test_an_unreadable_sidecar_withholds_rather_than_unlocks(tmp_path):
    tsv = tmp_path / "t.tsv"
    tsv.write_text("a\tb\n", encoding="utf-8")
    (tmp_path / "t.tsv.champollion.json").write_text("{nope", encoding="utf-8")
    assert withheld_text_reason({"config": {"corpus_path": str(tsv)}})


# ---------------------------------------------------------------------------
# error text from a restricted run
# ---------------------------------------------------------------------------

def test_scrub_keeps_the_error_and_drops_the_sentences():
    msg = (f'HTTP 400: {{"error": "bad input: {NURSE_SOURCE}"}} '
           f'model not found')
    out = scrub_corpus_text(msg, [NURSE_SOURCE, NURSE_REF])
    assert NURSE_SOURCE not in out and SCRUBBED in out
    assert out.startswith("HTTP 400") and "model not found" in out


def test_scrub_catches_a_truncated_quote():
    truncated = "HTTP 400: prompt was: " + NURSE_REF[:30]
    out = scrub_corpus_text(truncated, [NURSE_REF])
    assert NURSE_REF[:30] not in out and SCRUBBED in out


def _local_only_tsv(tmp_path):
    tsv = tmp_path / "nurse_checked_test.tsv"
    tsv.write_text(f"{NURSE_SOURCE}\t{NURSE_REF}\n", encoding="utf-8")
    (tmp_path / "nurse_checked_test.tsv.champollion.json").write_text(
        '{"transmission": "local-only"}', encoding="utf-8")
    return tsv


def _local_config(tmp_path, tsv, **kw):
    return RunConfig(dataset="all", corpus_path=str(tsv), model="llama3.1",
                     prompt_version="naive", batch_size=1, provider="local",
                     target_lang="Tagalog", source_lang="English",
                     cache_dir=str(tmp_path / "cache"),
                     output_dir=str(tmp_path / "out"), **kw)


def test_a_failed_local_only_run_prints_its_error_without_the_sentences(
        tmp_path, capsys, monkeypatch):
    from mt_eval_harness import runner

    class EchoingStrategy:
        """A local server whose 400 body quotes the request."""
        async def execute(self, *, entries, **_):
            return [{"id": e["id"], "predicted": "",
                     "error": f"HTTP 400: could not translate "
                              f"'{e['source']}'"} for e in entries], 0

    monkeypatch.setattr(runner, "resolve_strategy",
                        lambda *a, **k: EchoingStrategy())
    tsv = _local_only_tsv(tmp_path)
    config = _local_config(tmp_path, tsv,
                           base_url="http://127.0.0.1:11434/v1")
    with pytest.raises(RuntimeError) as exc:
        asyncio.run(runner.execute_run(config))
    out = capsys.readouterr().out
    assert "HTTP 400: could not translate" in out
    assert NURSE_SOURCE not in out and NURSE_SOURCE not in str(exc.value)
    # The forensic log keeps the whole error.
    logs = list((tmp_path / "out").rglob("*.json"))
    assert any(NURSE_SOURCE in p.read_text(encoding="utf-8") for p in logs)


# ---------------------------------------------------------------------------
# the remote-endpoint refusal names the endpoint and the corpus's tier
# ---------------------------------------------------------------------------

def test_dry_run_with_a_remote_base_url_names_the_endpoint_and_tier(tmp_path):
    from mt_eval_harness.runner import execute_run
    tsv = _local_only_tsv(tmp_path)
    config = _local_config(tmp_path, tsv, dry_run=True,
                           base_url="https://api.groq.com/openai/v1")
    with pytest.raises(RuntimeError) as exc:
        asyncio.run(execute_run(config))
    msg = str(exc.value)
    assert "(local-only)" in msg and "(sealed)" not in msg
    assert "https://api.groq.com/openai/v1" in msg
    assert "loopback" in msg and "not on this machine" in msg
    assert "Run locally instead" not in msg


def test_dry_run_on_loopback_passes_the_gate(tmp_path):
    from mt_eval_harness.runner import execute_run
    tsv = _local_only_tsv(tmp_path)
    config = _local_config(tmp_path, tsv, dry_run=True,
                           base_url="http://127.0.0.1:11434/v1")
    assert asyncio.run(execute_run(config))["dry_run"] is True


def test_a_remote_provider_is_still_told_to_run_locally():
    policy = resolve_transmission_policy(
        "", corpus_meta={"transmission": "local-only"})
    assert policy.mode == MODE_SEALED and policy.label == "local-only"
    with pytest.raises(RuntimeError) as exc:
        enforce_transmission_policy(
            policy, provider_name="openrouter",
            provider_supports_restricted=True, provider_basis="x",
            has_external_method=False)
    assert "(local-only)" in str(exc.value)
    assert "--provider local" in str(exc.value)


def test_a_held_out_set_keeps_its_sealed_label():
    pol = TransmissionPolicy(MODE_SEALED, "segment 'held_out' is sealed")
    assert pol.label == "sealed" and "tier" not in pol.as_provenance()
