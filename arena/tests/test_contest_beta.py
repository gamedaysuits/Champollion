"""Smoke tests for scripts/contest_beta.py — the local-stack contest driver.

No database, no Docker, no network: these cover the parts that must be right
BEFORE the script is allowed anywhere near a stack — its argument surface, the
refusals it makes without touching anything, and the synthetic corpus it
generates at run time (which is the reason nothing has to be tracked).

The live end-to-end run is the acceptance command in the organizer guest:

    contest_beta.py --target local --json-out … --cleanup
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ARENA_DIR = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_DIR / "scripts" / "contest_beta.py"


def _load():
    """Import the script by path — scripts/ is not a package."""
    spec = importlib.util.spec_from_file_location("contest_beta_under_test",
                                                  SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def beta():
    return _load()


class TestArgumentSurface:
    def test_target_is_required(self, beta):
        with pytest.raises(SystemExit):
            beta.parse_args([])

    def test_local_defaults(self, beta):
        args = beta.parse_args(["--target", "local"])
        assert args.target == "local"
        assert args.cleanup is False        # opt-in: nothing is deleted by default
        assert args.json_out is None
        assert args.out_dir is None
        assert args.status_env is None

    def test_flags_parse(self, beta, tmp_path):
        args = beta.parse_args([
            "--target", "local", "--cleanup",
            "--json-out", str(tmp_path / "r.json"),
            "--out-dir", str(tmp_path / "work"),
            "--status-env", str(tmp_path / "status.env")])
        assert args.cleanup is True
        assert args.json_out.endswith("r.json")
        assert args.status_env.endswith("status.env")

    def test_unknown_target_is_rejected_by_argparse(self, beta):
        with pytest.raises(SystemExit):
            beta.parse_args(["--target", "staging"])


class TestTargetRefusals:
    """`--target local` is the only live target (R2)."""

    def test_prod_refuses_with_the_r2_reason(self, beta):
        with pytest.raises(beta.StageFailure) as exc:
            beta.resolve_target("prod")
        message = str(exc.value)
        assert "REFUSED" in message
        assert "sovereign hosting" in message
        assert "--target local" in message
        assert "no live-project counterpart" in message

    def test_dev_refuses_and_says_why(self, beta):
        with pytest.raises(beta.StageFailure) as exc:
            beta.resolve_target("dev")
        assert "no Docker" in str(exc.value)

    def test_local_is_accepted(self, beta):
        assert beta.resolve_target("local") == {"target": "local"}

    def test_prod_refusal_happens_before_any_network_call(self, beta,
                                                          monkeypatch):
        """`run()` must not reach the stack resolution on a refused target."""
        def explode(*_a, **_k):  # pragma: no cover — must never run
            raise AssertionError("contest_beta touched the network on --target prod")
        monkeypatch.setattr(beta, "resolve_stack", explode)
        monkeypatch.setattr(beta, "rest", explode)
        report = beta.run(beta.parse_args(["--target", "prod"]))
        assert report["ok"] is False
        assert [s["status"] for s in report["stages"]] == ["FAIL"]
        assert report["stages"][0]["name"] == "target"
        assert report["cleanup"] == {"mode": "nothing-to-clean"}

    def test_main_exits_2_on_a_refused_target(self, beta, capsys):
        assert beta.main(["--target", "prod"]) == 2
        assert "FAILED at stage: target" in capsys.readouterr().err


class TestNonLoopbackRefusal:
    def test_a_non_loopback_url_is_refused(self, beta, monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_URL",
                           "https://sjdomynysdljkbemupqa.supabase.co")
        monkeypatch.setenv("MT_EVAL_SUPABASE_ANON_KEY", "anon")
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "service")
        with pytest.raises(beta.StageFailure) as exc:
            beta.resolve_stack(None)
        assert "not loopback" in str(exc.value)

    def test_a_loopback_url_is_accepted(self, beta, monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_URL", "http://127.0.0.1:54321")
        monkeypatch.setenv("MT_EVAL_SUPABASE_ANON_KEY", "anon")
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "service")
        stack = beta.resolve_stack(None)
        assert stack["url"] == "http://127.0.0.1:54321"
        assert stack["source"] == "environment"

    def test_a_missing_status_env_names_the_file_to_create(self, beta,
                                                           monkeypatch, tmp_path):
        for var in ("MT_EVAL_SUPABASE_URL", "MT_EVAL_SUPABASE_ANON_KEY",
                    "MT_EVAL_SUPABASE_SERVICE_KEY"):
            monkeypatch.delenv(var, raising=False)
        with pytest.raises(beta.StageFailure) as exc:
            beta.resolve_stack(str(tmp_path / "absent.env"))
        assert "absent.env" in str(exc.value)
        assert "reset.sh" in str(exc.value)

    def test_status_env_is_read_when_the_environment_is_empty(self, beta,
                                                              monkeypatch,
                                                              tmp_path):
        for var in ("MT_EVAL_SUPABASE_URL", "MT_EVAL_SUPABASE_ANON_KEY",
                    "MT_EVAL_SUPABASE_SERVICE_KEY"):
            monkeypatch.delenv(var, raising=False)
        status = tmp_path / "status.env"
        status.write_text(
            'API_URL="http://127.0.0.1:54321"\n'
            'ANON_KEY="anon-key"\n'
            'SERVICE_ROLE_KEY="service-key"\n', encoding="utf-8")
        stack = beta.resolve_stack(str(status))
        assert stack == {"url": "http://127.0.0.1:54321", "anon": "anon-key",
                         "service": "service-key", "source": str(status)}


class TestSyntheticCorpus:
    """Nothing is tracked: the corpus is generated, and the toy rule that
    generates it is the rule examples/lane-b-toy-method implements."""

    def test_toy_rule_matches_the_example(self, beta):
        assert beta.toy_translate("mira sol volu") == "sol miravo"
        example = (ARENA_DIR / "examples" / "lane-b-toy-method"
                   / "method" / "translate.py").read_text(encoding="utf-8")
        assert "vo" in example  # the suffix the rule appends

    def test_master_is_deterministic_and_unique(self, beta):
        a = beta.synthetic_master(24, seed=20260907)
        b = beta.synthetic_master(24, seed=20260907)
        assert a == b
        assert len({e["source"] for e in a}) == 24
        assert all(e["reference"] == beta.toy_translate(e["source"]) for e in a)

    def test_the_corpus_is_never_written_into_the_repo(self, beta):
        source = SCRIPT.read_text(encoding="utf-8")
        assert "tests/fixtures" not in source
        assert "master.json" in source  # written under --out-dir only


class TestEmailLeakGuard:
    def test_json_emails_finds_every_address(self, beta):
        assert beta.json_emails({"submitter": "someone@example.test"}) == [
            "someone@example.test"]
        assert beta.json_emails({"submitter_label": "Toy Swap"}) == []
        assert beta.json_emails(
            {"a": ["x@y.test"], "b": {"c": "x@y.test"}}) == ["x@y.test"]


class TestCleanupIsOptIn:
    def test_without_cleanup_nothing_is_deleted(self, beta, monkeypatch):
        def explode(*_a, **_k):  # pragma: no cover
            raise AssertionError("cleanup ran without --cleanup")
        monkeypatch.setattr(beta, "rest", explode)
        args = beta.parse_args(["--target", "local"])
        result = beta._cleanup(args, {"stack": {"url": "http://127.0.0.1:54321"},
                                      "contest_id": "zzbeta-1"})
        assert result["mode"] == "kept"
        assert "zzbeta-1" in result["note"]

    def test_cleanup_only_touches_what_the_run_created(self, beta, monkeypatch):
        calls = []
        args = beta.parse_args(["--target", "local", "--cleanup"])
        state = {
            "stack": {"url": "http://127.0.0.1:54321"},
            "contest_id": "zzbeta-1",
            "qualifier_id": "qual-zzbeta-1",
            "sealed_set_ids": ["eval-qaa-qab-zzbeta-1-secret-v1"],
            "published_card_ids": ["card-1"],
            "entries": [{"request_id": "authreq-1"}],
        }
        monkeypatch.setattr(beta, "rest", lambda stack, path, **kw:
                            calls.append((kw.get("method"), path)))
        result = beta._cleanup(args, state)
        assert result["mode"] == "deleted"
        assert all(method == "DELETE" for method, _ in calls)
        joined = " ".join(path for _, path in calls)
        # Only this run's ids appear — never an unqualified DELETE.
        assert "zzbeta-1" in joined and "authreq-1" in joined
        assert "card-1" in joined
        for _, path in calls:
            assert "=" in path.split("?", 1)[1], f"unqualified delete: {path}"


class TestReportShape:
    def test_a_refused_run_still_writes_a_report(self, beta, tmp_path):
        out = tmp_path / "report.json"
        beta.run(beta.parse_args([
            "--target", "prod", "--json-out", str(out),
            "--out-dir", str(tmp_path / "work")]))
        doc = json.loads(out.read_text(encoding="utf-8"))
        assert doc["ok"] is False
        assert doc["target"] == "prod"
        assert doc["stages"][0]["name"] == "target"
        assert "traceback" in doc
