"""Round 4 synthetic researcher (+ school and hospital personas) findings.

1. A local method-plugin run was recorded — and fingerprinted — as
   api_provider "openrouter", with "naive" in its run id.
3. The contest id came from --name while every help text said "Contest slug".
4. An air-gapped node had no way to record a custodian's approval of an
   entrant's offline proposal, and run-method ran a pending proposal anyway.
5. Copied-through output on an acceptor-only FST language earned composite
   credit with no caveat.
6. Minor: inline coaching temp path in the publish payload; wrong install
   hints; --results-visibility dropped by prepare --no-register; cost wording
   and float token counts; the service-key message; register's auth hint.
7. The translation cache held a protected corpus's sentences unmarked.
8. An unresolvable --target-lang dropped every plugin (and the glossary).
9. Plugin runs displayed LLM-only settings.
"""

from __future__ import annotations

import asyncio
import base64
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

from mt_eval_harness.config import (
    RunConfig,
    coaching_label,
    recorded_api_provider,
)

ROOT = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# Shared: a small method plugin and a corpus
# ---------------------------------------------------------------------------

PLUGIN_SRC = '''
class StubMethod:
    calls = []

    def __init__(self, manifest=None, method_dir=None):
        pass

    @property
    def name(self):
        return "stub-plugin"

    def method_card(self):
        return {"name": "Stub", "method_id": "stub-plugin", "class": "pipeline",
                "paradigm": "neural-nmt"}

    async def translate(self, entries, config):
        StubMethod.calls.append(len(entries))
        return [{"id": e["id"], "predicted": e["source"].upper(),
                 "latency_s": 0.0,
                 "usage": {"prompt_tokens": 410.33333333,
                           "completion_tokens": 205.6666667},
                 "error": None, "tool_calls": [], "tool_call_count": 0,
                 "metadata": {"model": "local-nllb"}} for e in entries]
'''


def _plugin(tmp_path: Path) -> Path:
    d = tmp_path / "stubplug"
    d.mkdir(exist_ok=True)
    (d / "method.json").write_text(json.dumps({
        "name": "Stub", "method_id": "stub-plugin", "class": "pipeline",
        "entry_point": "stub:StubMethod", "version": "1.0.0"}))
    (d / "stub.py").write_text(PLUGIN_SRC)
    return d


def _corpus(tmp_path: Path, name="corpus.json", n=4, marked=False) -> Path:
    corpus = tmp_path / name
    corpus.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"},
                    "license": "CC-BY-4.0"},
        "entries": [{"id": str(i), "source": f"hello {i}",
                     "reference": f"bonjour {i}"} for i in range(n)]}))
    if marked:
        Path(str(corpus) + ".champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
    return corpus


def _run_plugin(tmp_path: Path, **cfg_extra):
    from mt_eval_harness.publish import assemble_run_card
    from mt_eval_harness.runner import execute_run
    cfg = RunConfig(method_path=str(_plugin(tmp_path)),
                    corpus_path=str(cfg_extra.pop("corpus", None)
                                    or _corpus(tmp_path)),
                    target_lang="French", output_dir=str(tmp_path / "out"),
                    cache_dir=str(tmp_path / "cache"), dataset="all",
                    **cfg_extra)
    log = asyncio.run(execute_run(cfg))
    report = next((tmp_path / "out").glob("*_report.json"))
    card, _id, _fp = assemble_run_card(report)
    return log, card, report


# ---------------------------------------------------------------------------
# 1. The provider a run records
# ---------------------------------------------------------------------------

class TestRecordedProvider:
    def test_rule(self):
        assert recorded_api_provider({"provider": "openrouter"}) == "openrouter"
        assert recorded_api_provider(
            {"provider": "openrouter", "mt_method": "deepl"}) == "deepl"
        assert recorded_api_provider(
            {"provider": "openrouter", "method_path": "/p"}) == "method-plugin"
        assert recorded_api_provider(
            {"provider": "openrouter", "method_path": "/p",
             "attest_local_transport": True}) == "local"

    def test_plugin_run_records_and_fingerprints_method_plugin(self, tmp_path):
        log, card, _ = _run_plugin(tmp_path)
        assert log["config"]["provider"] == "method-plugin"
        assert card["api_provider"] == "method-plugin"
        assert card["fingerprint"]["components"]["api_provider"] == "method-plugin"
        # The run id names the method class, never the LLM prompt condition.
        assert "_pipeline_" in log["run_id"] and "naive" not in log["run_id"]
        assert card["condition"] == "pipeline"

    def test_attested_local_plugin_records_local(self, tmp_path):
        log, card, _ = _run_plugin(tmp_path, attest_local_transport=True)
        assert log["config"]["provider"] == "local"
        assert card["api_provider"] == "local"
        assert card["fingerprint"]["components"]["api_provider"] == "local"
        assert log["config"]["transmission_policy"][
            "local_transport_attested"] is True

    def test_old_plugin_log_publishes_the_honest_provider(self, tmp_path):
        """A run log written before the runner recorded it says openrouter;
        publish derives the true value (and so does the linter)."""
        from mt_eval_harness.publish import assemble_run_card
        log, _card, report = _run_plugin(tmp_path)
        log_path = Path(json.loads(report.read_text())["source_log"])
        raw = json.loads(log_path.read_text())
        raw["config"]["provider"] = "openrouter"   # the pre-fix record
        log_path.write_text(json.dumps(raw))
        card, _, fp = assemble_run_card(report)
        assert card["api_provider"] == "method-plugin"
        spec = importlib.util.spec_from_file_location(
            "lint_run_reports", ROOT / "scripts" / "lint_run_reports.py")
        lint = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(lint)
        assert lint.compute_fingerprint(raw) == fp

    def test_attestation_is_recorded_on_a_cleared_corpus(self):
        from mt_eval_harness.transmission_policy import (
            MODE_CLEARED, TransmissionPolicy, enforce_transmission_policy)
        prov = enforce_transmission_policy(
            TransmissionPolicy(MODE_CLEARED, "cleared"), provider_name=None,
            provider_supports_restricted=True, provider_basis="x",
            has_external_method=True, attest_local_transport=True)
        assert prov["local_transport_attested"] is True

    def test_llm_run_id_keeps_its_prompt_condition(self):
        from mt_eval_harness.runner import _build_run_id
        rid = _build_run_id(RunConfig(dataset="all", prompt_version="naive"))
        assert "_naive_" in rid


# ---------------------------------------------------------------------------
# 3. ONE contest identifier
# ---------------------------------------------------------------------------

class TestContestId:
    def test_validate(self):
        from mt_eval_harness.contest import validate_contest_id
        assert validate_contest_id("eng-crk-open-2026") == "eng-crk-open-2026"
        for bad in ("My Task", "my_task", "-x", "a/b", ""):
            with pytest.raises(ValueError, match="not a contest id"):
                validate_contest_id(bad)

    def test_manifest_id_and_legacy(self):
        from mt_eval_harness.contest_prep import (
            contest_id_is_legacy, contest_id_of)
        new = {"contest": {"id": "mytask", "slug": "mytask",
                           "name": "My Task 2026"}}
        old = {"contest": {"slug": "mytask", "name": "My Task 2026"}}
        assert contest_id_of(new) == "mytask" and not contest_id_is_legacy(new)
        # A pre-fix manifest keeps the id its contest was registered under.
        assert contest_id_of(old) == "my-task-2026" and contest_id_is_legacy(old)

    def test_prepare_refuses_a_non_slug(self, tmp_path):
        from mt_eval_harness.contest_prep import ContestPrepError, prepare_contest
        with pytest.raises(ContestPrepError, match="not a contest id"):
            prepare_contest(master_corpus_path=_corpus(tmp_path), slug="My Task",
                            name="My Task", source_lang="eng",
                            target_lang="fra", dev_size=1, secret_size=1,
                            seed=1, qualifier_threshold=10, license_id="CC0-1.0",
                            plaintext_refs=True, authorization_model="blanket",
                            out_dir=tmp_path / "o")

    def test_register_creates_the_contest_under_the_slug(self, monkeypatch):
        import mt_eval_harness.contest as contest_mod
        import mt_eval_harness.contest_prep as prep
        import mt_eval_harness.sovereign_service as svc
        seen = {}
        monkeypatch.setattr(svc, "service_request", lambda *a, **k: [{}])
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: seen.update(kw) or {"id": kw["contest_id"]})
        manifest = {
            "prepared_at": "2026-10-03T00:00:00+00:00",
            "contest": {"id": "mytask", "slug": "mytask",
                        "name": "My Task 2026", "language_pair": "eng>crk",
                        "authorization_model": "per-submission",
                        "intake_daily_limit": 5},
            "custodian_group_id": "g",
            "qualifier": {"qualifier_id": "q", "corpus_card_id": "q",
                          "threshold": 1.0, "metric": "composite",
                          "year": 2026},
            "secret": None, "blind": None,
        }
        record = prep.register_prepared(manifest)
        assert seen["contest_id"] == "mytask" and record["id"] == "mytask"

    def test_node_init_from_a_new_manifest_uses_the_slug(self, tmp_path):
        from mt_eval_harness.contest_node import node_config_from_contest
        out = tmp_path / "mytask"
        (out / "local").mkdir(parents=True)
        (out / "public").mkdir()
        dev = out / "public" / "dev.json"
        dev.write_text("{}")
        sec = out / "local" / "sec.sealed.json"
        sec.write_text("sealed")
        (out / "local" / "manifest.json").write_text(json.dumps({
            "contest": {"id": "mytask", "slug": "mytask",
                        "name": "My Task 2026", "language_pair": "eng>crk"},
            "qualifier": {"qualifier_id": "q", "corpus_card_id": "q",
                          "threshold": 1.0, "metric": "composite",
                          "year": 2026, "corpus_file": str(dev)},
            "secret": {"sealed_set_id": "eval-eng-crk-mytask-secret-v1",
                       "corpus_sealed_artifact": str(sec),
                       "sealed_block": {"keyScheme": "single-keypair-wave1"}},
            "holdout": None, "test_suites": []}))
        text, notes = node_config_from_contest(out)
        assert list(json.loads(text)["contests"]) == ["mytask"]
        assert any("--slug given to `contest prepare`" in n for n in notes)

    def test_every_contest_positional_says_contest_id(self):
        from mt_eval_harness.cli import build_parser
        from mt_eval_harness.contest_policy import CONTEST_ID_HELP
        text = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness", "contest", "qualify",
             "--help"], capture_output=True, text=True, cwd=ROOT,
            env={"PYTHONPATH": str(ROOT), "PATH": "/usr/bin:/bin",
                 "COLUMNS": "200"}).stdout
        assert "Contest id" in text and "Contest slug" not in text
        assert "Contest slug" not in (ROOT / "mt_eval_harness" / "cli.py").read_text()
        assert "--slug" in CONTEST_ID_HELP
        assert build_parser() is not None


# ---------------------------------------------------------------------------
# 4. Offline custodian approval on an air-gapped node
# ---------------------------------------------------------------------------

from test_node_airgap import (  # noqa: E402  (fixtures + constants)
    AIRGAP_NODE,
    CONTEST_ID,
    PARTICIPANT,
    SECRET_SET,
    world,  # noqa: F401  (pytest fixture)
)


def _node_key(tmp_path: Path) -> Path:
    """A node signing key as `mt-eval node keygen` writes it (private half
    only — the public half is derived when a decision is verified)."""
    from mt_eval_harness.sovereign.threshold_seal import generate_signing_keypair
    pair = generate_signing_keypair()
    key = tmp_path / "score-sign.key.json"
    key.write_text(json.dumps({"keyId": pair["keyId"],
                               "privateKeyDerB64": pair["privateKeyDerB64"]}))
    return key


def _offline_proposal(world, tmp_path, monkeypatch) -> str:
    import mt_eval_harness.method_bundle as mb
    from test_method_bundle import (
        CLEAN_DOCKERFILE, CLEAN_METHOD, DECLARATIONS, install_qualifier_stub)
    from test_method_bundle import QUALIFIER_ID as MB_QUALIFIER_ID
    install_qualifier_stub(monkeypatch)

    def explode(*a, **kw):
        raise AssertionError("offline mode must not touch the network")
    monkeypatch.setattr(mb, "_api_request", explode)
    monkeypatch.setattr(mb, "get_session", explode)
    monkeypatch.setattr(mb, "_storage_upload", explode)
    src = tmp_path / "method-src"
    src.mkdir()
    (src / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
    out = mb.submit_method(
        contest_id=CONTEST_ID, method_dir=src, dockerfile=dockerfile,
        method_name="acme-nmt-v3", method_version="3.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        developer_name="Test Dev", developer_email=PARTICIPANT,
        agree=True, node_id=AIRGAP_NODE, secret_set_id=SECRET_SET,
        language_pair="qaa>qab", bundle_out=tmp_path / "usb",
        offline=True, scratch_dir=tmp_path / "scratch",
        offline_qualifier_id=MB_QUALIFIER_ID, offline_threshold=50.0,
        **DECLARATIONS)
    return out["request_id"]


class TestOfflineApproval:
    def _setup(self, world, tmp_path, monkeypatch):
        world["airgap"]["signing_key"] = str(_node_key(tmp_path))
        # A runtime this machine cannot have: a code entry cannot pass the
        # node's checks, and a sealed run stops at the node-setup check —
        # AFTER the approval gate.
        world["airgap"]["contests"][CONTEST_ID]["sandbox"] = {
            "runtime": "no-such-container-runtime-xyz"}
        rid = _offline_proposal(world, tmp_path, monkeypatch)
        return rid, Path(world["airgap"]["airgap"]["state_dir"])

    @staticmethod
    def _node_checks_pass(world, rid):
        """The node's own checks before approval (Round 5): a container
        runtime, and the public gate declared in node.json, re-executed."""
        from mt_eval_harness import airgap_transport as at
        from test_node_airgap import DEV_CORPUS, QUALIFIER_ROW
        from test_sandbox_runner import FakeRuntime
        c = world["airgap"]["contests"][CONTEST_ID]
        c["sandbox"] = {"runtime": "docker"}
        c["qualifier"] = {k: QUALIFIER_ROW[k] for k in (
            "qualifier_id", "corpus_card_id", "threshold", "metric", "year")}
        c["dev_corpus"] = str(DEV_CORPUS)
        state = at.run_imported(rid, config_path="airgap",
                                runner=FakeRuntime())
        c["sandbox"] = {"runtime": "no-such-container-runtime-xyz"}
        return state

    def test_import_approve_run_gate(self, world, tmp_path, monkeypatch, capsys):
        from mt_eval_harness import airgap_transport as at
        rid, state_dir = self._setup(world, tmp_path, monkeypatch)
        assert at.import_bundle(tmp_path / "usb", config_path="airgap") == [rid]
        out = capsys.readouterr().out
        assert "PENDING custodian approval" in out
        assert f"node run-method {rid} --offline` re-executes" in out
        assert f"node approve {rid} --offline" in out

        # Round 5: no approval before the node's own checks (the guide's
        # Step 9 order) — and the refusal names the step to run first.
        with pytest.raises(at.AirgapTransportError,
                           match=rf"run-method {rid} --offline` first"):
            at.decide_offline(rid, decision="approve", actor="custodian-a",
                              config_path="airgap")
        rows = at.list_offline("airgap")
        assert rows[0]["authorization"].startswith("awaiting the node's checks")
        assert "run-method" in rows[0]["next"]

        # The node cannot run a code entry here: the check refuses as a node
        # problem, nothing is recorded, the request stays imported.
        with pytest.raises(at.AirgapTransportError,
                           match="No container runtime") as exc:
            at.run_imported(rid, config_path="airgap")
        assert "still imported" in str(exc.value)
        with pytest.raises(at.AirgapTransportError, match="cannot be approved"):
            at.decide_offline(rid, decision="approve", actor="custodian-a",
                              config_path="airgap")

        state = self._node_checks_pass(world, rid)
        assert state["status"] == "imported"
        nv = state["node_verification"]
        assert nv["container_runtime"] == "docker"
        assert nv["qualifier"]["measured"] >= nv["qualifier"]["threshold"]
        ledger = at._local_ledger(state_dir)
        assert ledger.replay_state()["requests"][rid]["state"] == "pending"
        assert at.list_offline("airgap")[0]["authorization"] == \
            "node checks passed; awaiting custodian approval"

        res = at.decide_offline(rid, decision="approve", actor="custodian-a",
                                config_path="airgap")
        assert (state_dir / rid / "approval.json").is_file()
        assert (state_dir / rid / "approval.json.sig.json").is_file()
        record = json.loads((state_dir / rid / "approval.json").read_text())
        assert record["node_verification_row_hash"] == nv["ledger_row_hash"]
        assert ledger.verify_chain()["ok"]
        assert ledger.replay_state()["requests"][rid]["state"] == "authorized"
        assert res["decision"] == "authorized"

        # Approved: run-method passes the approval gate and re-runs every
        # check — here it stops at the container-runtime check, still
        # imported.
        with pytest.raises(at.AirgapTransportError,
                           match="No container runtime") as exc:
            at.run_imported(rid, config_path="airgap")
        assert "still imported" in str(exc.value)
        assert at.list_offline("airgap")[0]["authorization"] == \
            "custodian-approved here"

    def test_a_proposal_with_no_declared_gate_is_never_put_to_a_custodian(
            self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        from test_sandbox_runner import FakeRuntime
        rid, _ = self._setup(world, tmp_path, monkeypatch)
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        world["airgap"]["contests"][CONTEST_ID]["sandbox"] = {
            "runtime": "docker"}
        with pytest.raises(at.AirgapTransportError,
                           match="declares no public qualifier gate"):
            at.run_imported(rid, config_path="airgap", runner=FakeRuntime())
        with pytest.raises(at.AirgapTransportError, match="cannot be approved"):
            at.decide_offline(rid, decision="approve", actor="custodian-a",
                              config_path="airgap")

    def test_a_qualifier_miss_is_refused_before_any_custodian(
            self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        from test_node_airgap import DEV_CORPUS, QUALIFIER_ROW
        from test_sandbox_runner import FakeRuntime
        rid, state_dir = self._setup(world, tmp_path, monkeypatch)
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        c = world["airgap"]["contests"][CONTEST_ID]
        c["sandbox"] = {"runtime": "docker"}
        c["qualifier"] = {**{k: QUALIFIER_ROW[k] for k in (
            "qualifier_id", "corpus_card_id", "metric", "year")},
            "threshold": 50.0}
        c["dev_corpus"] = str(DEV_CORPUS)
        state = at.run_imported(rid, config_path="airgap",
                                runner=FakeRuntime("garbage"))
        assert state["status"] == "rejected"
        assert "qualifier not met" in state["reason"]
        rep = at._local_ledger(state_dir).replay_state()["requests"][rid]
        assert rep["state"] == "denied"
        with pytest.raises(at.AirgapTransportError, match="only an imported"):
            at.decide_offline(rid, decision="approve", actor="custodian-a",
                              config_path="airgap")

    def test_tampered_approval_is_refused(self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        rid, state_dir = self._setup(world, tmp_path, monkeypatch)
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        self._node_checks_pass(world, rid)
        at.decide_offline(rid, decision="approve", actor="custodian-a",
                          config_path="airgap")
        rec = state_dir / rid / "approval.json"
        rec.write_text(rec.read_text().replace("custodian-a", "someone-else"))
        with pytest.raises(at.AirgapTransportError,
                           match="does not verify"):
            at.run_imported(rid, config_path="airgap")

    def test_a_different_key_does_not_verify(self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        rid, _ = self._setup(world, tmp_path, monkeypatch)
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        self._node_checks_pass(world, rid)
        at.decide_offline(rid, decision="approve", actor="custodian-a",
                          config_path="airgap")
        other = tmp_path / "other"
        other.mkdir()
        world["airgap"]["signing_key"] = str(_node_key(other))
        with pytest.raises(at.AirgapTransportError, match="signing key"):
            at.run_imported(rid, config_path="airgap")

    def test_deny_stages_a_rejection(self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        rid, state_dir = self._setup(world, tmp_path, monkeypatch)
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        at.decide_offline(rid, decision="deny", actor="custodian-a",
                          reason="not this round", config_path="airgap")
        state = json.loads((state_dir / rid / "state.json").read_text())
        assert state["status"] == "rejected"
        assert "not this round" in state["reason"]
        with pytest.raises(at.AirgapTransportError, match="rejected"):
            at.run_imported(rid, config_path="airgap")
        with pytest.raises(at.AirgapTransportError, match="only an imported"):
            at.decide_offline(rid, decision="approve", actor="x",
                              config_path="airgap")

    def test_no_signing_key_no_decision(self, world, tmp_path, monkeypatch):
        from mt_eval_harness import airgap_transport as at
        rid, state_dir = self._setup(world, tmp_path, monkeypatch)
        world["airgap"].pop("signing_key")
        at.import_bundle(tmp_path / "usb", config_path="airgap")
        with pytest.raises(at.AirgapTransportError, match="signing_key"):
            at.decide_offline(rid, decision="approve", actor="custodian-a",
                              config_path="airgap")
        # Refused before touching the ledger beyond the arrival record.
        rep = at._local_ledger(state_dir).replay_state()["requests"][rid]
        assert rep["state"] == "pending" and not rep["votes"]

    def test_a_staged_request_needs_no_second_decision(self, world, tmp_path):
        from mt_eval_harness import airgap_transport as at
        with pytest.raises(at.AirgapTransportError, match="no pending decision"):
            state_dir = Path(world["airgap"]["airgap"]["state_dir"])
            (state_dir / "authreq-x").mkdir(parents=True)
            (state_dir / "authreq-x" / "state.json").write_text(json.dumps({
                "request_id": "authreq-x", "status": "imported",
                "origin": "stage-request",
                "request": {"state": "authorized", "fingerprint": "f"}}))
            world["airgap"]["signing_key"] = str(_node_key(tmp_path))
            at.decide_offline("authreq-x", decision="approve", actor="c",
                              config_path="airgap")

    def test_no_state_is_not_an_export_shape(self, tmp_path):
        from mt_eval_harness import airgap_transport as at
        with pytest.raises(at.AirgapTransportError, match="arrived in state"):
            at.offline_authorization("r", {"request": {}}, tmp_path, {})

    def test_cli_offline_flags_exist(self):
        from mt_eval_harness.cli import build_parser
        p = build_parser()
        a = p.parse_args(["node", "approve", "authreq-1", "--actor", "c",
                          "--offline"])
        assert a.offline is True
        assert p.parse_args(["node", "list", "--offline"]).offline is True
        assert p.parse_args(["node", "deny", "r", "--actor", "c",
                             "--reason", "x", "--offline"]).offline is True

    def test_service_key_message_points_offline(self):
        from mt_eval_harness.sovereign_service import NO_SERVICE_KEY_MESSAGE
        assert "--offline" in NO_SERVICE_KEY_MESSAGE
        assert "node approve" in NO_SERVICE_KEY_MESSAGE
        assert len(NO_SERVICE_KEY_MESSAGE) < 800


# ---------------------------------------------------------------------------
# 5. Source copies on an acceptor-only FST language
# ---------------------------------------------------------------------------

class TestSourceCopyCaveat:
    def test_acceptor_reweighting_puts_45_percent_on_fst(self):
        """Founder-owned weights, unchanged: with morphology, semantic,
        equivalence and terminology absent, FST acceptance carries
        0.25/0.55 of the composite (the reproduction's own values)."""
        from mt_eval_harness.scoring import compute_composite_score
        scores = {"fst_acceptance_rate": 0.24666666666666667,
                  "chrf_plus_plus": 11.26, "code_switching_rate": 0.9,
                  "hallucination_rate": 0.1, "exact_match_rate": 0.0}
        with_fst = compute_composite_score(scores, profile="fst-coverage")
        no_fst = compute_composite_score(
            {k: v for k, v in scores.items() if k != "fst_acceptance_rate"},
            profile="surface-only")
        assert round(with_fst, 4) == 0.2337 and round(no_fst, 4) == 0.1663
        fst_only = compute_composite_score(
            {"fst_acceptance_rate": 1.0, "chrf_plus_plus": 0.0,
             "code_switching_rate": 1.0, "hallucination_rate": 1.0,
             "exact_match_rate": 0.0}, profile="fst-coverage")
        assert round(fst_only, 4) == round(0.25 / 0.55, 4)

    def test_caveat_fires_on_disguised_copies_and_skips_correct_ones(self):
        from mt_eval_harness import score_caveats as sc
        entries = ([{"source": "Thank you very much!",
                     "predicted": "Thánk yóú véry múch", "expected": "Giitu."}] * 3
                   + [{"source": "Oslo", "predicted": "Oslo",
                       "expected": "Oslo"}]     # copying is right here
                   + [{"source": "Hello", "predicted": "Bures",
                       "expected": "Bures"}])
        stats = sc.source_copies(entries)
        assert stats == {"considered": 4, "copies": 3, "copy_share": 0.75,
                         "share_bound": 0.5, "correct_copies_excluded": 1,
                         "flagged": True}
        (cav,) = sc.collect({"entries": entries})
        assert cav["kind"] == "source_copy" and cav["severity"] == "major"
        assert len(cav["message"]) <= sc.MESSAGE_CAP
        assert sc.short_label(cav) == "75% source copies"
        assert sc.collect({"entries": entries[3:]}) == []

    def test_caveat_travels_to_the_published_card(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        from mt_eval_harness.tester import analyze_run_log
        results = [{"id": i, "source": f"Good morning friend {i}",
                    "expected": f"Buorre iđit {i}",
                    "predicted": f"Good morning friend {i}"} for i in range(4)]
        log = {"run_id": "copy", "harness_version": "0.2.0",
               "config": {"model": "m", "provider": "local",
                          "target_lang": "Northern Sami", "target_code": "sme",
                          "dataset_id": "x"},
               "results": results,
               "provenance": {"corpus_sha256": "a" * 64}}
        lp = tmp_path / "copy.json"
        lp.write_text(json.dumps(log))
        rp = tmp_path / "copy_report.json"
        report = analyze_run_log(log, output_path=rp, metric_plugins=None,
                                 compute_ci=False, source_log_path=str(lp))
        assert [c["kind"] for c in report["score_caveats"]] == ["source_copy"]
        card, _, _ = assemble_run_card(rp)
        assert card["score_caveats"][0]["kind"] == "source_copy"


# ---------------------------------------------------------------------------
# 6. Minor
# ---------------------------------------------------------------------------

class TestMinor:
    def test_inline_coaching_never_publishes_a_path(self):
        assert coaching_label({"coaching_file": "/tmp/coaching_x.txt",
                               "coaching_label": "inline coaching"}) == \
            "inline coaching"
        assert coaching_label({"coaching_file": "/Users/me/c/coach.json"}) == \
            "coach.json"
        assert coaching_label({}) is None

    def test_cli_sets_the_inline_label(self):
        from mt_eval_harness.cli import args_to_config, build_parser
        args = build_parser().parse_args(
            ["run", "--corpus", "x.json", "--coaching", "be concise"])
        cfg = args_to_config(args)
        assert cfg.coaching_label == "inline coaching"
        assert Path(cfg.coaching_file).name.startswith("coaching_")

    def test_install_hints_name_the_distribution(self):
        for f in ("cli.py", "runner.py", "publish.py"):
            text = (ROOT / "mt_eval_harness" / f).read_text()
            assert "'mt-eval[" not in text
            assert "reinstall mt-eval." not in text

    def test_no_register_records_and_register_applies(self, tmp_path):
        from mt_eval_harness.contest_prep import (
            record_registration_choices, resolve_registration_choices)
        mpath = tmp_path / "manifest.json"
        mpath.write_text(json.dumps({"contest": {"id": "t"}}))
        manifest = {"contest": {"id": "t"}, "manifest_path": str(mpath)}
        record_registration_choices(manifest, {
            "results_visibility": "immediate", "anonymize_until_close": True,
            "primary_metric": "bleu"})
        on_disk = json.loads(mpath.read_text())
        assert on_disk["registration"]["results_visibility"] == "immediate"
        reg, notes = resolve_registration_choices(
            on_disk, {k: None for k in on_disk["registration"]})
        assert reg["results_visibility"] == "immediate"
        assert reg["anonymize_until_close"] is True
        assert any("results_visibility" in n for n in notes)
        reg2, notes2 = resolve_registration_choices(
            on_disk, {"results_visibility": "hidden_until_close"})
        assert reg2["results_visibility"] == "hidden_until_close"
        assert any("replaces" in n for n in notes2)

    def test_register_flags_default_to_unset(self):
        from mt_eval_harness.cli import build_parser
        a = build_parser().parse_args(
            ["contest", "register", "--manifest", "m.json"])
        assert a.results_visibility is None and a.visibility is None
        assert a.anonymize_until_close is None and a.closed_intake is None

    def test_tokens_are_integers_and_cost_has_one_label(self, tmp_path):
        log, card, _ = _run_plugin(tmp_path)
        totals = card["totals"]
        assert isinstance(totals["prompt_tokens"], int)
        assert totals["prompt_tokens"] == 4 * 410
        assert totals["cost_label"] == "unknown (plugin prices its own calls)"
        from mt_eval_harness.run_card import cost_label
        assert cost_label(None, {"provider": "local"},
                          {"endpoint_locality": "loopback"}) == \
            "$0 API cost (runs on this machine)"

    def test_register_auth_hint_names_no_foreign_flag(self, monkeypatch):
        import mt_eval_harness.auth as auth_mod
        import mt_eval_harness.contest_prep as prep
        import mt_eval_harness.sovereign_service as svc
        monkeypatch.setattr(svc, "assert_not_prod", lambda: None)

        def headless():
            raise SystemExit("Authentication required, but this is a "
                             "non-interactive shell")
        monkeypatch.setattr(auth_mod, "get_session", headless)
        with pytest.raises(SystemExit) as exc:
            prep.register_prepared_self_serve({"contest": {"id": "t"}})
        assert "--no-publish" not in str(exc.value)
        assert "contest register --manifest" in str(exc.value)
        src = (ROOT / "mt_eval_harness" / "auth.py").read_text()
        assert "run with \"\n" not in src and "--no-publish to skip" not in src


# ---------------------------------------------------------------------------
# 7. The cache keeps a protected corpus's entries marked and apart
# ---------------------------------------------------------------------------

class TestProtectedCache:
    def _cfg(self, tmp_path, corpus):
        return RunConfig(corpus_path=str(corpus), cache_dir=str(tmp_path / "c"),
                         target_lang="French", dataset="all")

    def test_protected_entries_are_marked_and_isolated(self, tmp_path):
        from mt_eval_harness.cache import ResultCache, cache_protection
        from mt_eval_harness.corpus_loader import marked_local_only
        marked = _corpus(tmp_path, "secret.json", marked=True)
        plain = _corpus(tmp_path, "plain.json")
        other = _corpus(tmp_path, "other.json", n=5, marked=True)
        meta = {"transmission": "local-only"}

        cfg = self._cfg(tmp_path, marked)
        prot = cache_protection(cfg, dataset_meta=meta,
                                corpus_sha256="a" * 64)
        assert prot["mark"]["transmission"] == "local-only"
        cache = ResultCache(cfg, protection=prot)
        cache.put("hello 0", {"id": "0", "predicted": "bonjour 0"})
        assert "protected" in cache.cache_dir.parts
        (entry,) = [f for f in cache.cache_dir.glob("*.json")
                    if not f.name.endswith(".champollion.json")]
        assert marked_local_only(entry)       # the loaders read it as protected
        assert cache.get("hello 0")["predicted"] == "bonjour 0"
        assert cache.stats()["total_files"] == 1

        # An unmarked corpus with the same config never sees it …
        pcfg = self._cfg(tmp_path, plain)
        assert cache_protection(pcfg, dataset_meta={},
                                corpus_sha256="b" * 64) is None
        assert ResultCache(pcfg).get("hello 0") is None
        # … nor does another protected corpus.
        ocfg = self._cfg(tmp_path, other)
        oprot = cache_protection(ocfg, dataset_meta=meta,
                                 corpus_sha256="c" * 64)
        assert ResultCache(ocfg, protection=oprot).get("hello 0") is None

    def test_runner_uses_the_protected_namespace(self, tmp_path, monkeypatch,
                                                 capsys):
        """A local-only corpus run (through a local-attested plugin): the
        runner builds its cache with the corpus's protection, and says so."""
        import mt_eval_harness.runner as runner_mod
        from mt_eval_harness.cache import ResultCache
        seen = []

        def spy(config, protection=None):
            seen.append(protection)
            return ResultCache(config, protection=protection)
        monkeypatch.setattr(runner_mod, "ResultCache", spy)
        corpus = _corpus(tmp_path, marked=True)
        cfg = RunConfig(method_path=str(_plugin(tmp_path)),
                        corpus_path=str(corpus), target_lang="French",
                        output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all",
                        attest_local_transport=True)
        asyncio.run(runner_mod.execute_run(cfg))
        assert seen and seen[-1]["mark"]["transmission"] == "local-only"
        assert seen[-1]["corpus_key"]
        assert "protected namespace" in capsys.readouterr().out

    def test_an_ordinary_run_has_no_protection(self, tmp_path, monkeypatch):
        import mt_eval_harness.runner as runner_mod
        from mt_eval_harness.cache import ResultCache
        seen = []

        def spy(config, protection=None):
            seen.append(protection)
            return ResultCache(config, protection=protection)
        monkeypatch.setattr(runner_mod, "ResultCache", spy)
        _run_plugin(tmp_path)
        assert seen == [None]

    def test_a_sealed_plugin_run_needs_the_attestation(self, tmp_path):
        """The plugin lane's gate: a local-only corpus through a plugin is
        refused without --attest-local-transport (it used to be judged as
        the default OpenRouter LLM, so the attestation could never apply)."""
        from mt_eval_harness.runner import execute_run
        cfg = RunConfig(method_path=str(_plugin(tmp_path)),
                        corpus_path=str(_corpus(tmp_path, marked=True)),
                        target_lang="French", output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all")
        with pytest.raises(RuntimeError, match="attest-local-transport"):
            asyncio.run(execute_run(cfg))


# ---------------------------------------------------------------------------
# 8. Target language: code beats name; generic plugins always load
# ---------------------------------------------------------------------------

class TestTargetLanguage:
    def test_code_beats_name(self):
        from mt_eval_harness.plugin_discovery import _detect_lang_code
        assert _detect_lang_code({"target_lang": "Ambala_Ayta",
                                  "target_lang_code": "abc"}) == "abc"
        assert _detect_lang_code({"target_lang": "Zzzz Nowhere",
                                  "target_code": "abc"}) == "abc"

    def test_unresolved_target_still_loads_the_generic_plugins(self, tmp_path,
                                                               capsys):
        from mt_eval_harness.plugin_discovery import discover_metric_plugins
        g = tmp_path / "terms.json"
        g.write_text(json.dumps({"fever": "lagnat"}))
        plugins = discover_metric_plugins(
            {"target_lang": "Zzzz Nowhere Language", "glossary_file": str(g)},
            skip_fst=True)
        names = {type(p).__name__ for p in plugins}
        assert {"CodeSwitchingPlugin", "HallucinationPlugin",
                "TerminologyPlugin", "WritingStyleMetric"} <= names
        term = next(p for p in plugins if type(p).__name__ == "TerminologyPlugin")
        assert term._glossary == {"fever": ["lagnat"]}
        out = capsys.readouterr().out
        assert "'Zzzz Nowhere Language'" in out and "--target-lang-code" in out
        assert "Config keys present" not in out

    def test_unavailable_opt_in_metric_refuses_up_front(self):
        from mt_eval_harness.metrics_metricx import HAS_METRICX
        from mt_eval_harness.plugin_discovery import preflight_scoring_inputs
        if HAS_METRICX:
            pytest.skip("MetricX is installed here")
        with pytest.raises(SystemExit, match="mt-eval-harness\\[metricx\\]"):
            preflight_scoring_inputs({"compute_metricx": True,
                                      "target_code": "fra"})

    def test_missing_style_profile_refuses_before_spending(self, tmp_path):
        from mt_eval_harness.runner import execute_run
        plugin = _plugin(tmp_path)
        cfg = RunConfig(method_path=str(plugin),
                        corpus_path=str(_corpus(tmp_path)),
                        target_lang="French", output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all",
                        style_profile=str(tmp_path / "missing.json"))
        with pytest.raises(SystemExit, match="style-profile"):
            asyncio.run(execute_run(cfg))
        assert not (tmp_path / "out").exists() or \
            not list((tmp_path / "out").glob("*.json"))


# ---------------------------------------------------------------------------
# 9. Only the settings that applied
# ---------------------------------------------------------------------------

class TestSettingsThatApplied:
    def test_rows(self):
        from mt_eval_harness.run_card import run_settings_rows
        plugin = dict(run_settings_rows({"method_path": "/p", "batch_size": 8}))
        assert set(plugin) == {"Batch size", "LLM settings"}
        assert "translate() call" in plugin["Batch size"]
        llm = dict(run_settings_rows({"temperature": 0.3, "max_tokens": 9}))
        assert llm["Temperature"] == "0.3" and llm["Max tokens"] == "9"

    def test_plugin_run_card_shows_no_llm_settings(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        log, _card, report = _run_plugin(tmp_path)
        log_path = Path(json.loads(report.read_text())["source_log"])
        text = render_run_card(log_path, report)
        assert "Temperature" not in text and "Max tokens" not in text
        assert "LLM settings" in text
        # The stored card keeps the fields (fingerprint + database read them).
        assert "temperature" in _card and "max_tokens" in _card
