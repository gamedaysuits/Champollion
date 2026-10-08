"""Tests for the dataset-selection UX: guided + agent (non-interactive) modes.

Covers the `corpora` subcommand (table + JSON), the no-hang guarantee in
non-interactive contexts, the guided-mode gate, the contamination-attestation
recording (flag + guided), gated-corpus handling, and the structured
machine-readable error output.
"""

from __future__ import annotations

import json
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from mt_eval_harness import cli, interactive
from mt_eval_harness.cli import build_parser, args_to_config, cmd_corpora


# ---------------------------------------------------------------------------
# Parser wiring
# ---------------------------------------------------------------------------

def test_corpora_subcommand_parses():
    args = build_parser().parse_args(
        ["corpora", "--source", "eng", "--target", "tel", "--json"])
    assert args.command == "corpora"
    assert args.source == "eng" and args.target == "tel" and args.json is True


def test_run_has_selection_flags():
    args = build_parser().parse_args([
        "run", "--corpus", "x", "--attest-no-training", "--accept-terms",
        "--non-interactive", "--json"])
    assert args.attest_no_training is True
    assert args.accept_terms is True
    assert args.non_interactive is True
    assert args.json is True


# ---------------------------------------------------------------------------
# `corpora` subcommand — JSON + table, never interactive
# ---------------------------------------------------------------------------

def _run_cmd_corpora(**kw) -> tuple[int, str]:
    defaults = {"source": None, "target": None, "list_sources": False,
                "json": False, "include_quarantined": False}
    defaults.update(kw)
    args = SimpleNamespace(**defaults)
    buf = StringIO()
    with patch("sys.stdout", buf):
        code = cmd_corpora(args)
    return code, buf.getvalue()


def _run_cmd_list(**kw) -> tuple[int, str]:
    buf = StringIO()
    with patch("sys.stdout", buf):
        code = cli.cmd_list("datasets", **kw)
    return code, buf.getvalue()


# ---------------------------------------------------------------------------
# Quarantined pairs explain themselves (eng→crk is catalogued, never runnable)
# ---------------------------------------------------------------------------

def test_corpora_eng_crk_json_counts_hidden_quarantined():
    code, out = _run_cmd_corpora(source="eng", target="crk", json=True)
    assert code == 0
    d = json.loads(out)
    assert d["count"] == 0
    assert d["hidden_quarantined"] >= 2
    assert "eval-eng-crk-edtekla-dev-v1" in d["hidden_quarantined_ids"]


def test_corpora_eng_crk_table_names_hidden_entries():
    code, out = _run_cmd_corpora(source="eng", target="crk", json=False)
    assert code == 0
    assert "none runnable" in out
    assert "eval-eng-crk-edtekla-dev-v1" in out
    assert "--include-quarantined" in out
    assert "none found" not in out


def test_corpora_include_quarantined_lists_with_reasons():
    code, out = _run_cmd_corpora(
        source="eng", target="crk", json=True, include_quarantined=True)
    assert code == 0
    d = json.loads(out)
    assert d["count"] >= 2 and d["hidden_quarantined"] == 0
    dev = next(c for c in d["corpora"] if c["id"] == "eval-eng-crk-edtekla-dev-v1")
    assert dev["quarantine"] is True
    assert dev["availability"] == "quarantined"
    assert "EdTeKLA" in dev["quarantine_reason"]


def test_corpora_partial_source_reports_quarantined_only_targets():
    code, out = _run_cmd_corpora(source="eng", json=True)
    assert code == 0
    d = json.loads(out)
    assert "crk" in d["quarantined_only_targets"]
    assert "crk" not in d["targets"]


# ---------------------------------------------------------------------------
# `list datasets` — bounded, filterable, honest availability
# ---------------------------------------------------------------------------

def test_list_parser_accepts_dataset_flags():
    args = build_parser().parse_args([
        "list", "datasets", "--source", "eng", "--target", "yor",
        "--family", "tatoeba", "--include-quarantined", "--limit", "5",
        "--all", "--json"])
    assert args.what == "datasets" and args.source == "eng"
    assert args.target == "yor" and args.family == "tatoeba"
    assert args.include_quarantined is True and args.limit == 5
    assert args.all is True and args.json is True


def test_list_datasets_default_is_bounded_and_honest():
    code, out = _run_cmd_list()
    assert code == 0
    rows = [l for l in out.splitlines() if l.startswith("  eval-")]
    assert 0 < len(rows) <= 60
    assert "private" not in out
    assert "quarantined hidden" in out
    assert "Showing 1–60 of" in out


def test_list_datasets_json_shape_and_filters():
    from mt_eval_harness import corpora_browse
    code, out = _run_cmd_list(source="eng", target="yor", as_json=True)
    assert code == 0
    d = json.loads(out)
    assert {"count", "shown", "hidden_quarantined", "filters", "datasets"} <= set(d)
    assert d["filters"] == {"source": "eng", "target": "yor"}
    assert d["datasets"], "eng→yor has runnable corpora in the bundled registry"
    assert all(x["source"] == "eng" and x["target"] == "yor" for x in d["datasets"])
    assert all(x["availability"] in corpora_browse.AVAILABILITY_VALUES
               for x in d["datasets"])
    assert all(x["family"] for x in d["datasets"])


def test_list_datasets_long_ids_render_untruncated():
    code, out = _run_cmd_list(as_json=True, show_all=True)
    d = json.loads(out)
    longest = max(d["datasets"], key=lambda x: len(x["id"]))
    assert len(longest["id"]) > 25, "the registry has ids longer than the old 25-char column"
    code, table = _run_cmd_list(source=longest["source"], target=longest["target"])
    assert longest["id"] in table


def test_list_datasets_quarantined_hidden_by_default_and_counted():
    code, out = _run_cmd_list(source="eng", target="crk", as_json=True)
    d = json.loads(out)
    assert code == 0 and d["count"] == 0 and d["hidden_quarantined"] >= 2
    code, out = _run_cmd_list(
        source="eng", target="crk", as_json=True, include_quarantined=True)
    d = json.loads(out)
    assert d["count"] >= 2 and d["hidden_quarantined"] == 0
    assert all(x["availability"] == "quarantined" for x in d["datasets"])


def test_list_datasets_unknown_family_is_structured_error():
    code, out = _run_cmd_list(family="no-such-family", as_json=True)
    assert code == 2
    d = json.loads(out)
    assert d["error"] == "unknown-family"
    assert "flores" in d["families"]


def test_corpora_json_for_pair():
    code, out = _run_cmd_corpora(source="eng", target="tel", json=True)
    assert code == 0
    data = json.loads(out)
    assert data["source"] == "eng" and data["target"] == "tel"
    assert data["count"] >= 1
    assert any(c["id"].startswith("eval-in22") for c in data["corpora"])


def test_corpora_table_for_pair():
    code, out = _run_cmd_corpora(source="eng", target="tel", json=False)
    assert code == 0
    assert "Corpora available" in out


def test_corpora_missing_args_is_structured_error():
    code, out = _run_cmd_corpora(json=True)
    assert code == 2
    assert json.loads(out)["error"] == "missing-args"


def test_corpora_list_sources_json():
    code, out = _run_cmd_corpora(list_sources=True, json=True)
    assert code == 0
    assert "eng" in json.loads(out)["sources"]


def test_corpora_partial_source_lists_targets():
    code, out = _run_cmd_corpora(source="eng", json=True)
    assert code == 0
    assert "tel" in json.loads(out)["targets"]


# ---------------------------------------------------------------------------
# Guided-mode gate — never prompts in non-interactive contexts (no hang)
# ---------------------------------------------------------------------------

def _run_args(**overrides):
    args = build_parser().parse_args(["run"])
    for k, v in overrides.items():
        setattr(args, k, v)
    return args


def test_guided_blocked_when_non_tty():
    args = _run_args()
    with patch("sys.stdin") as si, patch("sys.stdout") as so:
        si.isatty.return_value = False
        so.isatty.return_value = True
        assert interactive.should_run_guided(args) is False


def test_guided_blocked_when_json():
    args = _run_args(json=True)
    with patch("sys.stdin") as si, patch("sys.stdout") as so:
        si.isatty.return_value = True
        so.isatty.return_value = True
        assert interactive.should_run_guided(args) is False


def test_guided_blocked_when_non_interactive_flag():
    args = _run_args(non_interactive=True)
    with patch("sys.stdin") as si, patch("sys.stdout") as so:
        si.isatty.return_value = True
        so.isatty.return_value = True
        assert interactive.should_run_guided(args) is False


def test_guided_blocked_when_corpus_given():
    args = _run_args(corpus="some-id")
    with patch("sys.stdin") as si, patch("sys.stdout") as so:
        si.isatty.return_value = True
        so.isatty.return_value = True
        assert interactive.should_run_guided(args) is False


def test_guided_allowed_when_tty_and_no_corpus():
    args = _run_args()
    with patch("sys.stdin") as si, patch("sys.stdout") as so:
        si.isatty.return_value = True
        so.isatty.return_value = True
        assert interactive.should_run_guided(args) is True


# ---------------------------------------------------------------------------
# Contamination attestation — the single builder + both paths
# ---------------------------------------------------------------------------

def test_make_attestation_none_when_not_attested():
    assert interactive.make_attestation("id", attested=False, via="flag") is None


def test_make_attestation_shape():
    att = interactive.make_attestation("corpus-x", attested=True, via="flag")
    assert att["attested"] is True
    assert att["corpus"] == "corpus-x"
    assert att["via"] == "flag"
    assert "trained" in att["statement"].lower()
    assert att["attested_at"]  # iso timestamp present


def test_args_to_config_records_flag_attestation():
    args = build_parser().parse_args(
        ["run", "--corpus", "eval-in22-conv-v1-eng-tel", "--attest-no-training"])
    config = args_to_config(args)
    att = config.contamination_attestation
    assert att and att["attested"] is True
    assert att["corpus"] == "eval-in22-conv-v1-eng-tel"
    assert att["via"] == "flag"


def test_args_to_config_no_attestation_without_flag():
    args = build_parser().parse_args(["run", "--corpus", "x"])
    assert args_to_config(args).contamination_attestation is None


def test_args_to_config_uses_prebuilt_guided_attestation():
    args = build_parser().parse_args(["run", "--corpus", "x"])
    args._attestation = {"attested": True, "via": "guided", "corpus": "x"}
    assert args_to_config(args).contamination_attestation["via"] == "guided"


# ---------------------------------------------------------------------------
# Attestation surfaces in the run log provenance
# ---------------------------------------------------------------------------

def test_attestation_surfaced_in_run_log_provenance():
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.pipeline import build_run_log

    att = interactive.make_attestation("c", attested=True, via="flag")
    config = RunConfig(corpus_path="c.json", contamination_attestation=att)
    log = build_run_log(
        config, enriched_results=[], run_id="r1",
        timestamp_start="2026-06-19T00:00:00Z", elapsed_s=1.0,
        cache_hits=0, total_cost=0.0)
    assert log["provenance"]["contamination_attestation"] == att
    # Also captured in the serialized config.
    assert log["config"]["contamination_attestation"] == att


def test_runconfig_roundtrips_attestation():
    from mt_eval_harness.config import RunConfig

    att = {"attested": True, "via": "flag"}
    config = RunConfig(contamination_attestation=att)
    restored = RunConfig.from_dict(config.to_dict())
    assert restored.contamination_attestation == att


# ---------------------------------------------------------------------------
# Guided flow — orchestration with mocked prompts (no real terminal)
# ---------------------------------------------------------------------------

def test_guided_flow_records_corpus_and_attestation(monkeypatch):
    """A happy-path guided selection sets corpus + attestation on args."""
    info = {
        "id": "eval-eng-tel-tatoeba-dev-v1", "size": 200,
        "contamination": "NONE", "domain": "mixed", "license": "CC-BY-2.0",
        "gated": False,
    }
    monkeypatch.setattr(
        interactive.corpora_browse, "available_source_langs", lambda: ["eng"])
    monkeypatch.setattr(
        interactive.corpora_browse, "available_targets_for_source",
        lambda s: ["tel"])
    monkeypatch.setattr(
        interactive.corpora_browse, "list_corpora_for_pair", lambda s, t: [info])
    monkeypatch.setattr(
        interactive.corpora_browse, "format_corpora_table", lambda *a: "")
    # Drive the prompts deterministically.
    monkeypatch.setattr(interactive, "_prompt_lang_code",
                        lambda msg, valid: "eng" if "Source" in msg else "tel")
    monkeypatch.setattr(interactive, "prompt_choice", lambda msg, choices: info)
    monkeypatch.setattr(interactive, "prompt_confirm", lambda msg, default=False: True)

    args = SimpleNamespace(
        corpus=None, source_code="", target_code="", accept_terms=False)
    assert interactive.run_guided(args) is True
    assert args.corpus == "eval-eng-tel-tatoeba-dev-v1"
    assert args.attest_no_training is True
    assert args._attestation["via"] == "guided"
    assert args.source_code == "eng" and args.target_code == "tel"


def test_guided_flow_aborts_when_attestation_declined(monkeypatch):
    info = {"id": "ds", "size": 10, "contamination": "LOW", "domain": "x",
            "license": "Y", "gated": False}
    monkeypatch.setattr(
        interactive.corpora_browse, "available_source_langs", lambda: ["eng"])
    monkeypatch.setattr(
        interactive.corpora_browse, "available_targets_for_source",
        lambda s: ["tel"])
    monkeypatch.setattr(
        interactive.corpora_browse, "list_corpora_for_pair", lambda s, t: [info])
    monkeypatch.setattr(
        interactive.corpora_browse, "format_corpora_table", lambda *a: "")
    monkeypatch.setattr(interactive, "_prompt_lang_code",
                        lambda msg, valid: "eng" if "Source" in msg else "tel")
    monkeypatch.setattr(interactive, "prompt_choice", lambda msg, choices: info)
    # Decline the attestation.
    monkeypatch.setattr(interactive, "prompt_confirm", lambda msg, default=False: False)

    args = SimpleNamespace(corpus=None, source_code="", target_code="")
    assert interactive.run_guided(args) is False
    assert args.corpus is None


def test_guided_gated_shows_terms_and_proceeds_with_token(monkeypatch, capsys):
    info = {"id": "eval-in22-conv-v1-eng-tel", "size": 1503,
            "contamination": "LOW", "domain": "conversational",
            "license": "CC-BY-4.0", "gated": True,
            "terms_url": "https://huggingface.co/datasets/ai4bharat/IN22-Conv",
            "token_env": "HF_TOKEN"}
    monkeypatch.setattr(
        interactive.corpora_browse, "available_source_langs", lambda: ["eng"])
    monkeypatch.setattr(
        interactive.corpora_browse, "available_targets_for_source",
        lambda s: ["tel"])
    monkeypatch.setattr(
        interactive.corpora_browse, "list_corpora_for_pair", lambda s, t: [info])
    monkeypatch.setattr(
        interactive.corpora_browse, "format_corpora_table", lambda *a: "")
    monkeypatch.setattr(interactive, "_prompt_lang_code",
                        lambda msg, valid: "eng" if "Source" in msg else "tel")
    monkeypatch.setattr(interactive, "prompt_choice", lambda msg, choices: info)
    monkeypatch.setattr(interactive, "prompt_confirm", lambda msg, default=False: True)
    # Pretend a token is present.
    monkeypatch.setattr(interactive, "_resolve_token", lambda env: "hf_tok")

    args = SimpleNamespace(corpus=None, source_code="", target_code="",
                           accept_terms=False)
    assert interactive.run_guided(args) is True
    out = capsys.readouterr().out
    assert "GATED" in out
    assert "huggingface.co/datasets/ai4bharat/IN22-Conv" in out
    assert "HF_TOKEN" in out
    assert args.accept_terms is True
