"""Contest lane, synthetic researcher persona, Round 2 (2026-10-03).

  4. The dev set `contest prepare --license CC-BY-4.0` released was read as
     UNLICENSED by `mt-eval run` ("NO-TRAIN corpus … no cleared license on
     the envelope") and by `contest qualify` ("has no recorded licence"):
     prepare wrote `dataset.provenance.license`, every reader reads
     `dataset.license`. One shape now, tested end to end.
  5. `--qualifier-threshold` help said "before the blind set is scored" and
     the released dev set said it "gates scoring on the blind set" with
     --blind-size 0. Current vocabulary, only sets that exist, and the 0–100
     scale stated wherever a threshold is set or printed.
  6. `contest submit-method` failed three times for a stdlib-only rule-based
     method: the weights flags were mandatory with no weights to describe;
     --track constrained needed --training-data-file, said nowhere up front;
     and `my-method/method/translate.py` with --entrypoint
     method/translate.py was "not among the packed files". The runbook's own
     example layout is packaged here, from the runbook's own command.
"""

from __future__ import annotations

import io
import json
import re
import shlex
import sys
import tarfile
from pathlib import Path
from unittest.mock import patch

import pytest

from mt_eval_harness import contest_prep as prep
from mt_eval_harness import method_bundle as mb
from mt_eval_harness.config import RunConfig
from mt_eval_harness.contest_declarations import constraints_findings
from mt_eval_harness.corpus_loader import load_corpus
from mt_eval_harness.method_bundle import MethodBundleError, resolve_entrypoint
from mt_eval_harness.method_index import index_record
from mt_eval_harness.transmission_policy import (
    MODE_CLEARED, MODE_CONSENT_REQUIRED, resolve_transmission_policy,
)

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
MASTER = FIXTURES / "corpus_dev.json"
RUNBOOK = (Path(__file__).resolve().parents[2] / "cli" / "website" / "docs"
           / "network" / "sovereignty" / "run-a-sovereign-contest.md")


def _prepare(tmp_path, **over):
    kwargs = dict(master_corpus_path=MASTER, slug="synth",
                  name="Synthetic Open 2026", source_lang="qaa",
                  target_lang="qab", dev_size=3, blind_size=3, seed=7,
                  qualifier_threshold=35.0, license_id="CC-BY-4.0",
                  out_dir=tmp_path / "contest", plaintext_refs=True,
                  authorization_model="blanket")
    kwargs.update(over)
    return prep.prepare_contest(**kwargs)


# ---------------------------------------------------------------------------
# 4. one licence shape, prepare → run → qualify
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("licence,mode", [
    ("CC-BY-4.0", MODE_CLEARED),
    ("LicenseRef-Our-Community-Terms", MODE_CONSENT_REQUIRED)])
def test_the_released_dev_set_is_read_with_its_licence(tmp_path, licence, mode):
    manifest = _prepare(tmp_path, license_id=licence)
    dev_file = Path(manifest["qualifier"]["corpus_file"])
    assert json.loads(dev_file.read_text())["dataset"]["license"] == licence
    config = RunConfig(corpus_path=str(dev_file), source_lang="qaa",
                       target_lang="qab")
    _, meta = load_corpus(config)
    assert meta["license"] == licence
    assert resolve_transmission_policy("", corpus_meta=meta).mode == mode


def test_contest_qualify_records_the_released_licence(tmp_path, capsys):
    from mt_eval_harness.contest_qualify import qualify
    manifest = _prepare(tmp_path)
    q = manifest["qualifier"]
    dev_file = Path(q["corpus_file"])
    refs = [e["reference"] for e in json.loads(dev_file.read_text())["entries"]]
    hyps = tmp_path / "dev-hyps.txt"
    hyps.write_text("\n".join(refs) + "\n", encoding="utf-8")
    receipt = qualify("synth-open-2026", dev_hyp_path=hyps,
                      dev_corpus_path=dev_file, system_label="acme",
                      method_class="pipeline",
                      receipt_dir=tmp_path / "receipts",
                      offline_qualifier={
                          "qualifier_id": q["qualifier_id"],
                          "corpus_card_id": q["corpus_card_id"],
                          "threshold": q["threshold"],
                          "language_pair": "qaa>qab", "year": q["year"]})
    out = capsys.readouterr().out
    assert receipt["passed"] is True
    assert "no recorded licence" not in out
    # 5: the printed threshold names its scale. Scoring standard/1: the
    # qualifier score is corpus chrF++ (0-100), nothing blended in.
    assert "chrF++ 0-100 qualifier scale" in out
    assert "corpus chrF++" in out
    assert "as a run card's 0-1 composite" not in out


def test_a_dev_set_released_before_the_fix_is_still_read(tmp_path):
    """Files already released carry dataset.provenance.license; reading it
    keeps a LicenseRef set consent-required instead of unlicensed."""
    old = tmp_path / "old-dev.json"
    old.write_text(json.dumps({
        "dataset": {"corpus_id": "eval-qaa-qab-x-qualifier-v2026",
                    "provenance": {"license": "LicenseRef-Old-Terms"}},
        "entries": [{"id": 0, "source": "a", "reference": "b"}]}))
    _, meta = load_corpus(RunConfig(corpus_path=str(old), source_lang="qaa",
                                    target_lang="qab"))
    assert meta["license"] == "LicenseRef-Old-Terms"


# ---------------------------------------------------------------------------
# 5. vocabulary + scale
# ---------------------------------------------------------------------------

def _dev_description(manifest):
    return json.loads(Path(manifest["qualifier"]["corpus_file"]).read_text()
                      )["dataset"]["description"]


@pytest.mark.parametrize("secret,holdout,blind,names,absent", [
    (True, True, False, ["the sealed set and the sealed holdout"], ["blind"]),
    (True, False, False, ["the sealed set"], ["blind", "holdout"]),
    (False, False, True, ["blind set", "diagnostic"], ["sealed set"]),
])
def test_the_dev_set_names_only_sets_that_exist(secret, holdout, blind,
                                                names, absent):
    text = prep.dev_set_description(
        "Synthetic Open 2026", year=2026, threshold=35, has_secret=secret,
        has_holdout=holdout, has_blind=blind)
    for n in names:
        assert n in text
    for a in absent:
        assert a not in text
    assert "35 on the chrF++ 0-100 qualifier scale (corpus chrF++" in text
    assert "composite" not in text   # scoring standard/1: retired
    assert "0.35" not in text   # Round 3: no claimed card-composite twin


def test_a_prepared_blind_diagnostic_is_described_as_one(tmp_path):
    text = _dev_description(_prepare(tmp_path))
    assert "blind set (the organizer's diagnostic round)" in text
    assert "gates scoring on the blind set" not in text


def test_prepare_help_states_the_scale_and_current_terms(capsys):
    from mt_eval_harness.cli import main
    with patch.object(sys, "argv", ["mt-eval", "contest", "prepare", "--help"]):
        with pytest.raises(SystemExit):
            main()
    help_text = " ".join(capsys.readouterr().out.split())
    # The options section (the usage line names the flag first).
    i = help_text.rindex("--qualifier-threshold QUALIFIER_THRESHOLD")
    entry = help_text[i:i + 500]
    assert "blind" not in entry
    assert "sealed set" in entry and "0-100 chrF++" in entry
    # Scoring standard/1: the qualifier score is corpus chrF++, nothing
    # blended in — no "35 here is 0.35 there".
    assert "corpus chrF++" in entry and "nothing blended in" in entry
    assert "0.35" not in entry


# ---------------------------------------------------------------------------
# 6. submit-method: the runbook's own example, packaged
# ---------------------------------------------------------------------------

CONTEST = "synth-open-2026"
QUALIFIER = "eval-qaa-qab-synth-qualifier-v2026"
STDLIB_METHOD = """#!/usr/bin/env python3
import sys

for line in sys.stdin:
    words = line.split()
    print(" ".join(reversed(words)))
"""


def _runbook_offline_example() -> list[str]:
    """The runbook's weightless offline submit-method command, as argv."""
    text = RUNBOOK.read_text(encoding="utf-8")
    blocks = re.findall(r"```bash\n(.*?)```", text, flags=re.S)
    (block,) = [b for b in blocks if "submit-method" in b
                and "--parameter-count 0" in b and "--offline" in b]
    return shlex.split(block.replace("\\\n", " "))


def _runbook_layout(root: Path, *, nested: bool = False) -> None:
    """The layout the runbook draws: my-method/translate.py, Dockerfile and
    training-data.txt beside it."""
    md = root / "my-method"
    target = md / "method" if nested else md
    target.mkdir(parents=True)
    (target / "translate.py").write_text(STDLIB_METHOD, encoding="utf-8")
    (root / "Dockerfile").write_text("FROM python:3.11-slim\n",
                                     encoding="utf-8")
    (root / "training-data.txt").write_text("none — rule-based\n",
                                            encoding="utf-8")


def _receipt(receipt_dir: Path, threshold: float = 35.0) -> None:
    receipt_dir.mkdir(parents=True, exist_ok=True)
    (receipt_dir / f"{CONTEST}.json").write_text(json.dumps({
        "receiptVersion": "1", "contestId": CONTEST, "qualifierId": QUALIFIER,
        "devCorpusSha256": "a" * 64, "hypothesesSha256": "b" * 64,
        "metric": "chrf_plus_plus", "score": 61.5, "threshold": threshold,
        "passed": True, "harnessVersion": "0.2.0",
        "scoredAt": "2026-10-03T12:00:00+00:00", "selfReported": True,
        "note": "self-scored"}), encoding="utf-8")


def _run_cli(argv, tmp_path, monkeypatch):
    from mt_eval_harness.cli import main
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    monkeypatch.chdir(tmp_path)

    def explode(*a, **kw):
        raise AssertionError("an offline submission must not touch the network")
    monkeypatch.setattr(mb, "_api_request", explode)
    monkeypatch.setattr(mb, "get_session", explode)
    monkeypatch.setattr(mb, "_storage_upload", explode)
    with patch.object(sys, "argv", ["mt-eval", *argv]):
        main()


def _bundle_manifest(exchange: Path) -> tuple[dict, set[str]]:
    (tarball,) = exchange.rglob("method.tar.gz")
    with tarfile.open(fileobj=io.BytesIO(tarball.read_bytes()),
                      mode="r:gz") as tar:
        names = set(tar.getnames())
        manifest = json.loads(tar.extractfile("manifest.json").read())
    return manifest, names


def test_the_runbooks_weightless_offline_example_packages(tmp_path,
                                                         monkeypatch):
    argv = _runbook_offline_example()
    assert argv[:3] == ["mt-eval", "contest", "submit-method"]
    subs = {"<contest-id>": CONTEST,
            "<organizer-advertised-node-id>": "org-node-1",
            "<sealed-set-id>": "eval-qaa-qab-synth-secret-v1",
            "<published-qualifier-id>": QUALIFIER}
    argv = [subs.get(a, a) for a in argv[1:]]
    assert not [a for a in argv if a.startswith("<")], argv
    _runbook_layout(tmp_path)
    _receipt(tmp_path / "receipts")
    _run_cli(argv + ["--receipt-dir", str(tmp_path / "receipts")],
             tmp_path, monkeypatch)
    manifest, names = _bundle_manifest(tmp_path / "exchange")
    assert manifest["method"]["entrypoint"] == "method/translate.py"
    assert "method/translate.py" in names
    c = manifest["constraints"]
    assert c["parameterCount"] == 0
    assert c["weightsLicense"] is None and c["weightsPublic"] is None
    assert manifest["target"]["languagePair"] == {"source": "eng",
                                                  "target": "crk"}


def test_weights_flags_are_still_required_for_a_weighted_method(
        tmp_path, monkeypatch, capsys):
    argv = [a if a != "0" else "78000000" for a in
            [{"<contest-slug>": CONTEST,
              "<organizer-advertised-node-id>": "org-node-1",
              "<sealed-set-id>": "eval-qaa-qab-synth-secret-v1",
              "<published-qualifier-id>": QUALIFIER}.get(a, a)
             for a in _runbook_offline_example()[1:]]]
    _runbook_layout(tmp_path)
    with pytest.raises(SystemExit):
        _run_cli(argv, tmp_path, monkeypatch)
    err = capsys.readouterr().err
    assert "--weights-license" in err and "--weights-public" in err
    assert "--parameter-count 0" in err


def test_the_entrypoint_is_a_path_inside_method_dir(tmp_path):
    _runbook_layout(tmp_path)
    md = tmp_path / "my-method"
    assert resolve_entrypoint(md, "translate.py") == "method/translate.py"
    # The runbook's bundle spelling names the same file.
    assert resolve_entrypoint(md, "method/translate.py") == "method/translate.py"


def test_the_personas_nested_layout_resolves_to_its_real_bundle_path(tmp_path):
    """my-method/method/translate.py + --entrypoint method/translate.py: the
    file is inside --method-dir at method/translate.py, so it is packed (and
    run) as method/method/translate.py — not refused."""
    _runbook_layout(tmp_path, nested=True)
    md = tmp_path / "my-method"
    assert resolve_entrypoint(md, "method/translate.py") == \
        "method/method/translate.py"


def test_a_missing_entrypoint_names_every_path_it_looked_for(tmp_path):
    md = tmp_path / "my-method"
    md.mkdir()
    with pytest.raises(MethodBundleError) as exc:
        resolve_entrypoint(md, "method/translate.py")
    msg = str(exc.value)
    assert str(md / "method" / "translate.py") in msg
    assert str(md / "translate.py") in msg


def test_an_ambiguous_entrypoint_is_refused_with_both_readings(tmp_path):
    _runbook_layout(tmp_path)
    md = tmp_path / "my-method"
    (md / "method").mkdir()
    (md / "method" / "translate.py").write_text(STDLIB_METHOD)
    with pytest.raises(MethodBundleError, match="ambiguous") as exc:
        resolve_entrypoint(md, "method/translate.py")
    assert "--entrypoint translate.py" in str(exc.value)
    assert "--entrypoint method/method/translate.py" in str(exc.value)
    assert resolve_entrypoint(md, "method/method/translate.py") == \
        "method/method/translate.py"


def test_a_weightless_declaration_is_valid_and_indexable():
    manifest = {"method": {"name": "rules", "version": "1"},
                "developer": {"name": "R"},
                "target": {"languagePair": {"source": "eng", "target": "crk"}},
                "constraints": {"track": "constrained", "parameterCount": 0,
                                "weightsLicense": None, "weightsPublic": None,
                                "trainingData": "none — rule-based"},
                "submission": {"isPrimary": True, "description": "",
                               "methodReleaseUrl": None}}
    assert constraints_findings(manifest) == []
    record = index_record(manifest, method_sha="c" * 64)
    assert record["licence"] is None and record["parameterCount"] == 0


def test_a_weighted_declaration_still_needs_its_licence():
    manifest = {"constraints": {"track": "unconstrained",
                                "parameterCount": 1000,
                                "weightsLicense": None, "weightsPublic": None,
                                "trainingData": ""},
                "submission": {"isPrimary": True, "description": "",
                               "methodReleaseUrl": None}}
    details = " ".join(f["detail"] for f in constraints_findings(manifest))
    assert "weightsLicense is required" in details
    assert "weightsPublic must be true or false" in details


def test_submit_method_help_states_every_requirement(capsys):
    from mt_eval_harness.cli import main
    with patch.object(sys, "argv", ["mt-eval", "contest", "submit-method",
                                    "--help"]):
        with pytest.raises(SystemExit):
            main()
    text = " ".join(capsys.readouterr().out.split())
    for need in ("--track", "--parameter-count 0", "--training-data-file",
                 "--offline-qualifier-id", "--pair", "--weights-license"):
        assert need in text
