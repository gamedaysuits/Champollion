"""Round 11 synthetic-researcher fixes in the sovereign-contest commands.

Three frictions from one persona run (a researcher rehearsing a North Sami
contest on one machine, its contest database not reachable):

  6. `contest qualify`'s "Contest '<id>' not found on this endpoint" named
     only endpoints. The fully offline route (--offline-qualifier-id +
     --offline-threshold) existed in --help but in neither the error nor the
     doc's "offline, in one command" example. The error (and its siblings:
     no contest lane, no active qualifier, unreachable database) now prints
     that command, filled in with the entrant's own arguments — the threshold
     never filled in, the qualifier id only as what prepare makes it.
  7. `contest validate` on a bundle packaged with `submit-method --system
     rules-v1` warned "none for SME Rules": it looked the receipt up by the
     bundle's method name. A packed bundle carries the receipt it was
     packaged with; validate now checks against that copy, finds the local
     receipt it came from by matching every copied field, and names its
     system. It also says where the qualifier id and threshold it used came
     from.
  8. `contest prepare --no-register` printed the contest id and recorded
     flags but not the rows and digests registration would send. It now
     prints the registration plan, built by the SAME functions both
     registrars send with — so the self-serve door's silent drop of
     ``shared_task_id`` surfaced and is fixed with it.

Synthetic qaa>qab fixtures and the shipped Lane B example only. No network:
every REST call is monkeypatched, and the CLI subprocesses point
MT_EVAL_SUPABASE_URL at a closed local port.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from mt_eval_harness import contest_intake, contest_prep as prep
from mt_eval_harness import contest_validate as cv
from mt_eval_harness.contest_declarations import (
    QUALIFIER_MANIFEST_FIELDS,
    qualifier_block_from_receipt,
)
from mt_eval_harness.contest_qualify import (
    QualifierError,
    find_receipt_for_block,
    qualify,
)
from mt_eval_harness.method_bundle import build_manifest, build_method_bundle

from test_sandbox_runner import toy_translate

ARENA = Path(__file__).resolve().parents[1]
EXAMPLE = ARENA / "examples" / "lane-b-toy-method"
FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
DEV_ID = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))["dataset"][
    "corpus_id"]
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
CONTEST = "synth-r11"
#: A port nothing listens on: any network call a CLI subprocess makes fails
#: fast and locally, never reaching a real contest database.
CLOSED_ENDPOINT = "http://127.0.0.1:1"


def _dev_entries() -> list[dict]:
    return json.loads(DEV_CORPUS.read_text(encoding="utf-8"))["entries"]


def _hyps(path: Path, translate=toy_translate) -> Path:
    path.write_text("\n".join(translate(e["source"]) for e in _dev_entries())
                    + "\n", encoding="utf-8")
    return path


def _offline(threshold: float = 35.0) -> dict:
    return {"qualifier_id": QUALIFIER_ID, "threshold": threshold,
            "corpus_card_id": DEV_ID, "language_pair": "qaa>qab"}


def _quiet(fn, *a, **kw):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **kw)


def _subprocess_env(home: Path) -> dict:
    env = dict(os.environ)
    env["HOME"] = str(home)
    env["MT_EVAL_SUPABASE_URL"] = CLOSED_ENDPOINT
    return env


# ---------------------------------------------------------------------------
# 6. qualify's not-found / unreachable errors name the offline route.
# ---------------------------------------------------------------------------

_COLUMN_MISSING = RuntimeError(
    'Supabase API error (400): {"code":"42703","details":null,"hint":null,'
    '"message":"column contests.authorization_model does not exist"}')

_OPEN_CONTEST = {"id": CONTEST, "status": "open", "corpus_id": "corp",
                 "language_pair": "qaa>qab", "authorization_model": "open",
                 "intake_open": True}


class TestQualifyNamesTheOfflineRoute:
    def _refusal(self, tmp_path, monkeypatch, api, dev_corpus=DEV_CORPUS):
        monkeypatch.setattr(contest_intake, "_api_request", api)
        hyps = _hyps(tmp_path / "my dev hyps.txt")
        with pytest.raises(QualifierError) as exc:
            _quiet(qualify, CONTEST, dev_hyp_path=hyps,
                   dev_corpus_path=dev_corpus, system_label="acme nmt",
                   method_class="pipeline",
                   receipt_dir=tmp_path / "receipts")
        assert not (tmp_path / "receipts").exists(), (
            "a refused qualify writes no receipt")
        return str(exc.value), hyps

    @staticmethod
    def _command(msg: str) -> list[str]:
        """The printed command, continuation joined, as argv."""
        lines = msg.splitlines()
        i = next(n for n, line in enumerate(lines)
                 if line.strip().startswith("mt-eval contest qualify"))
        joined = lines[i].strip().rstrip("\\") + " " + lines[i + 1].strip()
        return shlex.split(joined)

    def test_not_found_prints_the_offline_command(self, tmp_path,
                                                  monkeypatch):
        msg, hyps = self._refusal(
            tmp_path, monkeypatch,
            lambda method, table, params=None, **kw: [])
        assert "not found on this endpoint" in msg
        argv = self._command(msg)
        assert argv[:4] == ["mt-eval", "contest", "qualify", CONTEST]
        # The entrant's own arguments, shell-quoted (a path with spaces).
        assert argv[argv.index("--dev") + 1] == str(hyps)
        assert argv[argv.index("--system") + 1] == "acme nmt"
        assert argv[argv.index("--method-class") + 1] == "pipeline"
        # The qualifier id is the dev corpus's own id (prepare's naming) and
        # is labelled as such; the threshold is never filled in.
        assert argv[argv.index("--offline-qualifier-id") + 1] == DEV_ID
        assert argv[argv.index("--offline-threshold") + 1] == "<threshold>"
        assert "dataset.corpus_id" in msg and "never guessed" in msg

    def test_unreachable_database_prints_it_too(self, tmp_path, monkeypatch):
        def refused(method, table, params=None, **kw):
            raise RuntimeError("Network error contacting Supabase: "
                               "<urlopen error [Errno 61] Connection refused>")
        msg, _ = self._refusal(tmp_path, monkeypatch, refused)
        assert "Could not read contest" in msg and "Connection refused" in msg
        assert "--offline-qualifier-id" in msg and "--offline-threshold" in msg

    def test_no_contest_lane_prints_it_too(self, tmp_path, monkeypatch):
        def missing(method, table, params=None, **kw):
            raise _COLUMN_MISSING
        msg, _ = self._refusal(tmp_path, monkeypatch, missing)
        assert "contest lane" in msg.lower()
        assert "--offline-threshold <threshold>" in msg

    def test_no_active_qualifier_prints_it_too(self, tmp_path, monkeypatch):
        def no_qualifier(method, table, params=None, **kw):
            return [_OPEN_CONTEST] if table == "contests" else []
        msg, _ = self._refusal(tmp_path, monkeypatch, no_qualifier)
        assert "no ACTIVE qualifier" in msg
        assert "--offline-qualifier-id" in msg

    def test_a_contest_that_says_no_gets_no_offline_route(self, tmp_path,
                                                          monkeypatch):
        """A closed contest is THERE and refusing; offering a way around its
        database would be offering a way around its answer."""
        def closed(method, table, params=None, **kw):
            return [dict(_OPEN_CONTEST, status="closed")]
        msg, _ = self._refusal(tmp_path, monkeypatch, closed)
        assert "not accepting submissions" in msg
        assert "--offline-threshold" not in msg

    def test_a_published_threshold_is_quoted_not_filled_in(self, tmp_path,
                                                           monkeypatch):
        dev = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))
        dev["dataset"]["description"] = (
            "Synth — public dev set / qualifier v2026. A method must reach "
            "42.5 on the 0-100 qualifier scale on this set.")
        copy = tmp_path / "dev.json"
        copy.write_text(json.dumps(dev), encoding="utf-8")
        msg, _ = self._refusal(tmp_path, monkeypatch,
                               lambda method, table, params=None, **kw: [],
                               dev_corpus=copy)
        assert "must reach 42.5" in msg, "the organizer's words are quoted"
        assert "--offline-threshold <threshold>" in msg
        assert "--offline-threshold 42.5" not in msg

    def test_the_printed_command_runs_offline(self, tmp_path, monkeypatch):
        """The command the error prints, with the organizer's threshold put
        in, is a working `contest qualify` (parsed by the real parser, run
        the way the handler runs it)."""
        from mt_eval_harness.cli import build_parser
        msg, hyps = self._refusal(
            tmp_path, monkeypatch,
            lambda method, table, params=None, **kw: [])
        argv = self._command(msg)
        argv[argv.index("<threshold>")] = "35"
        args = build_parser().parse_args(argv[1:])
        assert args.contest_command == "qualify"
        assert args.offline_threshold == 35.0
        assert args.offline_qualifier_id == DEV_ID

        def no_network(*a, **kw):
            raise AssertionError("the offline route touched the network")
        monkeypatch.setattr(contest_intake, "_api_request", no_network)
        receipt = _quiet(
            qualify, args.contest_id, dev_hyp_path=args.dev,
            dev_corpus_path=args.dev_corpus, system_label=args.system,
            method_class=args.method_class,
            receipt_dir=tmp_path / "receipts",
            offline_qualifier={"qualifier_id": args.offline_qualifier_id,
                               "threshold": args.offline_threshold,
                               "corpus_card_id": DEV_ID,
                               "language_pair": "qaa>qab"})
        assert receipt["passed"] is True and receipt["system"] == "acme nmt"

    def test_cli_not_found_exit_and_message(self, tmp_path):
        """End to end through the CLI against a closed local port: a
        non-zero exit and the offline command on screen."""
        hyps = _hyps(tmp_path / "dev.txt")
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "qualify", CONTEST, "--dev", str(hyps), "--dev-corpus",
             str(DEV_CORPUS), "--system", "toy", "--method-class",
             "pipeline"],
            capture_output=True, text=True, timeout=300, check=False,
            env=_subprocess_env(tmp_path))
        out = proc.stdout + proc.stderr
        assert proc.returncode != 0
        assert "--offline-qualifier-id" in out and "--offline-threshold" in out


# ---------------------------------------------------------------------------
# 7. validate checks a packed bundle against the receipt it carries.
# ---------------------------------------------------------------------------

def _bundle_manifest(receipt: dict, method_name: str = "Toy Rules") -> dict:
    return build_manifest(
        method_name=method_name, method_version="1.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="rule-based",
        description="Synthetic qaa>qab rule; proves the pipe, not quality.",
        developer_name="Champollion example",
        developer_email="example@example.test", agreement_signed=True,
        corpus_id="eval-qaa-qab-synth-secret-v1", source_lang="qaa",
        target_lang="qab",
        constraints={"track": "constrained", "parameterCount": 1,
                     "weightsLicense": "LicenseRef-Champollion-Example",
                     "weightsPublic": True,
                     "trainingData": "None — a hand-written rule."},
        submission={"isPrimary": True,
                    "description": "Word-swap rule; a pipeline smoke test.",
                    "methodReleaseUrl": None},
        qualifier=qualifier_block_from_receipt(receipt))


@pytest.fixture(scope="module")
def _packaged(tmp_path_factory):
    """Two systems qualified once per module (scoring is the slow part):
    'toy-v1' and an echo. The bundle — named "Toy Rules", as the persona's
    was "SME Rules" — is packaged with toy-v1's receipt."""
    root = tmp_path_factory.mktemp("r11-packaged")
    receipts = root / "receipts"
    good = _hyps(root / "toy.txt")
    echo = _hyps(root / "echo.txt", lambda s: s)
    packaged = _quiet(qualify, CONTEST, dev_hyp_path=good,
                      dev_corpus_path=DEV_CORPUS, system_label="toy-v1",
                      method_class="pipeline", receipt_dir=receipts,
                      offline_qualifier=_offline())
    with pytest.raises(QualifierError):
        # An echo is refused — and its receipt is still written.
        _quiet(qualify, CONTEST, dev_hyp_path=echo,
               dev_corpus_path=DEV_CORPUS, system_label="echo",
               method_class="pipeline", receipt_dir=receipts,
               offline_qualifier=_offline())
    built = build_method_bundle(
        method_dir=EXAMPLE / "method", dockerfile=EXAMPLE / "Dockerfile",
        manifest=_bundle_manifest(packaged), out_path=root / "method.tar.gz")
    return Path(built["path"]), good, receipts, packaged


class TestValidateUsesTheCarriedReceipt:
    """Two systems qualified (the persona had 'stub-naive' and 'rules-v1');
    the bundle was packaged with the receipt of 'toy-v1'."""

    @pytest.fixture
    def setup(self, tmp_path, _packaged):
        """The module's bundle and hypotheses, with a private copy of the
        receipts (a test may re-qualify)."""
        bundle, good, receipts, packaged = _packaged
        mine = tmp_path / "receipts"
        shutil.copytree(receipts, mine)
        return bundle, good, mine, packaged

    def _validate(self, tmp_path, bundle, hyps, receipts, **kw):
        return _quiet(cv.validate, bundle, work_dir=tmp_path / "w",
                      contest_id=CONTEST, dev_hyp_path=hyps,
                      dev_corpus_path=DEV_CORPUS, receipt_dir=receipts, **kw)

    @staticmethod
    def _receipt_findings(result):
        return [f for f in result["findings"]
                if f["check"] == "qualifier receipt"]

    def test_the_receipt_the_bundle_carries_is_found_by_its_contents(
            self, tmp_path, setup):
        bundle, hyps, receipts, _ = setup
        assert len(list((receipts / CONTEST).glob("*.json"))) == 2
        result = self._validate(tmp_path, bundle, hyps, receipts)
        found = self._receipt_findings(result)
        assert [f["severity"] for f in found] == ["INFO"], found
        assert "the receipt this bundle carries (system 'toy-v1'" in \
            found[0]["detail"]
        assert "Several systems" not in json.dumps(result["findings"])
        assert result["ok"] is True

    def test_threshold_source_is_stated(self, tmp_path, setup):
        bundle, hyps, receipts, _ = setup
        fromrcpt = next(f for f in self._validate(
            tmp_path, bundle, hyps, receipts)["findings"]
            if f["check"] == "qualifier")
        assert "from the receipt this bundle carries" in fromrcpt["detail"]
        flagged = next(f for f in self._validate(
            tmp_path, bundle, hyps, receipts, qualifier_id=QUALIFIER_ID,
            threshold=35.0)["findings"] if f["check"] == "qualifier")
        assert "from --offline-qualifier-id / --offline-threshold" in \
            flagged["detail"]

    def test_a_system_naming_another_receipt_warns(self, tmp_path, setup):
        bundle, hyps, receipts, _ = setup
        result = self._validate(tmp_path, bundle, hyps, receipts,
                                system_label="echo")
        details = [f["detail"] for f in self._receipt_findings(result)
                   if f["severity"] == "WARN"]
        assert any("--system 'echo' names a different receipt" in d
                   for d in details), details
        # Still checked against what the node reads: toy-v1's receipt.
        assert any("system 'toy-v1'" in f["detail"] and f["severity"] == "INFO"
                   for f in self._receipt_findings(result))

    def test_requalifying_after_packaging_warns(self, tmp_path, setup):
        bundle, hyps, receipts, _ = setup
        _quiet(qualify, CONTEST, dev_hyp_path=hyps,
               dev_corpus_path=DEV_CORPUS, system_label="toy-v1",
               method_class="pipeline", receipt_dir=receipts,
               offline_qualifier=_offline())
        result = self._validate(tmp_path, bundle, hyps, receipts)
        assert any("EARLIER receipt for system 'toy-v1'" in f["detail"]
                   and f["severity"] == "WARN"
                   for f in self._receipt_findings(result))

    def test_a_bundle_qualified_elsewhere_is_checked_against_its_copy(
            self, tmp_path, setup):
        bundle, hyps, _receipts, _ = setup
        result = self._validate(tmp_path, bundle, hyps,
                                tmp_path / "empty-receipts")
        found = self._receipt_findings(result)
        assert any("matches no receipt under" in f["detail"] for f in found)
        assert any(f["detail"].startswith("matches the receipt this bundle "
                                          "carries (scored")
                   for f in found)
        assert result["ok"] is True
        assert not (tmp_path / "empty-receipts").exists(), (
            "validate writes no receipt")

    def test_validate_writes_and_moves_nothing(self, tmp_path, setup):
        bundle, hyps, receipts, _ = setup
        before = sorted(p.name for p in receipts.rglob("*.json"))
        self._validate(tmp_path, bundle, hyps, receipts, system_label="echo")
        assert sorted(p.name for p in receipts.rglob("*.json")) == before

    def test_find_receipt_for_block_needs_every_field(self, tmp_path, setup):
        _bundle, _hyps_, receipts, packaged = setup
        block = qualifier_block_from_receipt(packaged)
        path, receipt = find_receipt_for_block(CONTEST, block, receipts)
        assert receipt["system"] == "toy-v1"
        for field in QUALIFIER_MANIFEST_FIELDS:
            tampered = dict(block)
            tampered[field] = "something else"
            assert find_receipt_for_block(CONTEST, tampered, receipts) is None
        assert find_receipt_for_block(CONTEST, {"score": 1}, receipts) is None

    def test_cli_validate_on_the_packed_bundle(self, tmp_path, setup):
        """The persona's command, verbatim in shape: no --system."""
        bundle, hyps, receipts, _ = setup
        proc = subprocess.run(
            [sys.executable, "-m", "mt_eval_harness.cli", "contest",
             "validate", str(bundle), "--contest", CONTEST, "--dev",
             str(hyps), "--dev-corpus", str(DEV_CORPUS), "--receipt-dir",
             str(receipts), "--json"],
            capture_output=True, text=True, timeout=300, check=False,
            env=_subprocess_env(tmp_path))
        assert proc.returncode == 0, proc.stdout + proc.stderr
        result = json.loads(proc.stdout)
        warns = [f["detail"] for f in result["warns"]
                 if f["check"] == "qualifier receipt"]
        assert warns == [], warns
        assert any("system 'toy-v1'" in f["detail"]
                   for f in result["findings"]
                   if f["check"] == "qualifier receipt")


# ---------------------------------------------------------------------------
# 8. The registration plan is the registration payload.
# ---------------------------------------------------------------------------

def _prepared_manifest(shared_task_id: str | None = None) -> dict:
    return {
        "prepared_at": "2026-10-04T00:00:00+00:00",
        "contest": {
            "id": CONTEST, "slug": CONTEST, "name": "Synthetic R11",
            "language_pair": "qaa>qab",
            "authorization_model": "per-submission",
            "intake_daily_limit": 5,
            "shared_task_id": shared_task_id,
        },
        "sizes": {"dev": 3, "blind": 0, "secret": 30, "holdout": 12},
        "custodian_group_id": "grp-r11",
        "qualifier": {
            "qualifier_id": QUALIFIER_ID, "corpus_card_id": QUALIFIER_ID,
            "threshold": 42.5, "metric": "composite", "year": 2026,
        },
        "blind": None,
        "secret": {
            "sealed_set_id": "eval-qaa-qab-synth-r11-secret-v1",
            "sealed_block": {"cipher": "x25519-hkdf-sha256+aes-256-gcm",
                             "ciphertextDigest": "e" * 64,
                             "keyScheme": "single-keypair-wave1",
                             "aad": "champollion-sealed:v1|card=x|group=y",
                             "artifactRef": "/local/path/never/sent.json"},
        },
        "holdout": {
            "sealed_set_id": "eval-qaa-qab-synth-r11-holdout-v1",
            "sealed_block": {"cipher": "x25519-hkdf-sha256+aes-256-gcm",
                             "ciphertextDigest": "f" * 64,
                             "keyScheme": "single-keypair-wave1"},
        },
        "test_suites": [{
            "suite_id": "eval-thirdparty-diag-v1",
            "corpus_card_id": "eval-thirdparty-diag-v1",
            "publisher": "Third Party Diagnostics",
            "url": "https://example.test/diag-v1",
            "sha256": "a" * 64,
        }],
    }


CHOICES = dict(prep.REGISTRATION_DEFAULTS, visibility="private",
               results_visibility="hidden_until_close",
               prize_terms={"disposition": "retain_ip",
                            "retention": "retain_sealed_audit"})
EMAIL = "org@example.org"


def _wire_self_serve(monkeypatch, calls):
    """Every REST call the self-serve registrar and the real create_contest
    make, captured; the session is synthetic; the service lane is a
    tripwire."""
    import mt_eval_harness.auth as auth_mod
    import mt_eval_harness.contest as contest_mod
    import mt_eval_harness.sovereign_service as svc
    metadata: dict = {}

    def fake_api(method, path, data=None, params=None, session=None,
                 prefer=None):
        calls.append((method, path, data, params))
        if method == "GET" and path == "sealed_sets":
            sid = params["sealed_set_id"].split("eq.", 1)[1]
            return [{"sealed_set_id": sid, "status": "active"}]
        if method == "GET" and path == "contests":
            return [{"metadata": dict(metadata)}]
        if method == "POST" and path == "contests":
            metadata.update(data["metadata"])
            return [{"id": data["id"]}]
        if method == "PATCH" and path == "contests":
            if "metadata" in (data or {}):
                metadata.clear()
                metadata.update(data["metadata"])
            return [{"id": CONTEST}]
        return []

    session = {"access_token": "tok", "user": {"email": EMAIL}}

    def tripwire(*a, **kw):
        raise AssertionError("self-serve must never use the service key")

    monkeypatch.setattr(contest_mod, "_api_request", fake_api)
    monkeypatch.setattr(contest_mod, "get_session", lambda: session)
    monkeypatch.setattr(auth_mod, "get_session", lambda: session)
    monkeypatch.setattr(svc, "service_request", tripwire)
    monkeypatch.setattr(svc, "assert_not_prod", lambda: None)


def _register_self_serve(manifest: dict, choices: dict) -> None:
    """`contest register`'s two sending calls, as the CLI handler makes
    them."""
    from mt_eval_harness.cli import _record_prize_terms
    record = prep.register_prepared_self_serve(
        manifest, visibility=choices["visibility"],
        use_context=choices["use_context"],
        description=choices["description"],
        open_intake=choices["open_intake"],
        primary_metric=choices["primary_metric"],
        metric_model=choices["metric_model"],
        power_pilot=choices["power_pilot"],
        results_visibility=choices["results_visibility"],
        anonymize_until_close=bool(choices["anonymize_until_close"]))
    _record_prize_terms(record["id"], choices["prize_terms"], self_serve=True)


class TestRegistrationPlan:
    def test_the_plan_is_exactly_what_self_serve_registration_sends(
            self, monkeypatch):
        manifest = _prepared_manifest(shared_task_id="edition-2026")
        plan = prep.registration_plan(manifest, CHOICES, created_by=EMAIL)
        calls: list = []
        _wire_self_serve(monkeypatch, calls)
        _quiet(_register_self_serve, manifest, CHOICES)

        writes = [(m, p, d) for m, p, d, _ in calls if m in ("POST", "PATCH")]
        direct = [s for s in plan if s["method"] in ("POST", "PATCH")]
        merges = [s for s in plan if s["method"] == "MERGE"]
        sent_direct = [w for w in writes
                       if not (w[0] == "PATCH" and "metadata" in w[2])]
        assert [(s["method"], s["table"], s["row"]) for s in direct] == \
            sent_direct, "the plan's rows are the rows sent, in order"
        metadata_patches = [w[2]["metadata"] for w in writes
                            if w[0] == "PATCH" and "metadata" in w[2]]
        assert len(metadata_patches) == len(merges)
        for step, sent in zip(merges, metadata_patches):
            assert step["row"].items() <= sent.items(), (
                "every merged key is in the metadata written back")

    def test_service_lane_sends_the_same_builders(self, monkeypatch):
        import mt_eval_harness.contest as contest_mod
        import mt_eval_harness.sovereign_service as svc
        manifest = _prepared_manifest()
        calls: list = []
        monkeypatch.setattr(
            svc, "service_request",
            lambda method, path, **kw: calls.append(
                (method, path, kw.get("data"))) or (
                [{"metadata": {}}] if method == "GET" else []))
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: calls.append(("CREATE", kw))
                            or {"id": CONTEST})
        _quiet(prep.register_prepared, manifest, open_intake=True,
               visibility="private", primary_metric="chrf_plus_plus",
               results_visibility="hidden_until_close")
        sealed = [c[2] for c in calls
                  if c[0] == "POST" and c[1] == "sealed_sets"]
        assert sealed == prep.sealed_set_rows(manifest)
        assert all("created_by" not in r and "quarantined" not in r
                   for r in sealed)
        created = next(c[1] for c in calls if c[0] == "CREATE")
        assert created == prep.prepared_contest_args(manifest, CHOICES)

    def test_self_serve_attaches_the_recorded_edition(self, monkeypatch):
        """`contest register` used to leave shared_task_id out of its policy
        PATCH, silently dropping the edition prepare recorded."""
        calls: list = []
        _wire_self_serve(monkeypatch, calls)
        _quiet(_register_self_serve,
               _prepared_manifest(shared_task_id="edition-2026"), CHOICES)
        policy = next(d for m, p, d, _ in calls
                      if m == "PATCH" and "authorization_model" in (d or {}))
        assert policy["shared_task_id"] == "edition-2026"

    def test_the_printed_plan_lists_exactly_the_payload_fields(self):
        manifest = _prepared_manifest()
        plan = prep.registration_plan(manifest, CHOICES)
        text = prep.format_registration_plan(plan)
        field_lines = [ln for ln in text.splitlines()
                       if ln.startswith("           ")]
        assert len(field_lines) == sum(len(s["row"]) for s in plan)
        for step in plan:
            for key in step["row"]:
                assert any(ln.split()[0] == key for ln in field_lines), key
        # Digests whole, the custodian group, the qualifier id + threshold,
        # the sealed row counts, and who signs.
        for needle in ("e" * 64, "f" * 64, "grp-r11", QUALIFIER_ID, "42.5",
                       "30 sealed rows", "12 sealed rows",
                       prep.SIGN_IN_PLACEHOLDER):
            assert needle in text, needle
        # What the manifest holds but registration never sends.
        assert "artifactRef" not in text and "/local/path" not in text
        assert "champollion-sealed:v1" not in text, "the AAD is not sent"


def _cli_available() -> bool:
    if shutil.which("node") is None:
        return False
    try:
        prep.find_champollion_cli()
        return True
    except prep.ContestPrepError:
        return False


@pytest.mark.skipif(not _cli_available(),
                    reason="node + cli/bin/cli.js needed for the seal step")
def test_cli_no_register_prints_the_plan_and_no_sealed_text(tmp_path):
    keys = tmp_path / "keys"
    proc = subprocess.run(
        prep.find_champollion_cli() + ["seal-corpus", "keygen", "--out",
                                       str(keys)],
        capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    pub = next(keys.glob("*.pub.json"))
    proc = subprocess.run(
        [sys.executable, "-m", "mt_eval_harness.cli", "contest", "prepare",
         "--corpus", str(DEV_CORPUS), "--slug", CONTEST, "--name",
         "Synthetic R11", "--pair", "qaa>qab", "--dev-size", "2",
         "--secret-size", "3", "--sealed-holdout-size", "1", "--seed", "11",
         "--qualifier-threshold", "42.5", "--custodian-group", "grp-r11",
         "--threshold-pubkey", str(pub), "--license", "CC0-1.0",
         "--out", str(tmp_path / "out"), "--no-register",
         "--prize-disposition", "retain_ip"],
        capture_output=True, text=True, timeout=300, check=False,
        env=_subprocess_env(tmp_path))
    out = proc.stdout + proc.stderr
    assert proc.returncode == 0, out
    assert "Registration plan" in out
    manifest = json.loads((tmp_path / "out" / "local" / "manifest.json")
                          .read_text(encoding="utf-8"))
    for key in ("secret", "holdout"):
        assert manifest[key]["sealed_block"]["ciphertextDigest"] in out
    # No sentence of the corpus — sealed or released — is printed.
    for e in _dev_entries():
        assert e["source"] not in out and e["reference"] not in out
