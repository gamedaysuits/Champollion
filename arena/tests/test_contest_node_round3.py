"""Contest + node lane, synthetic researcher persona, Round 3 (2026-10-03).

  1. `contest qualify` scored the dev outputs 4.39 while the dry-run card
     composite for the very same outputs was 0.2482, and every message said
     the threshold was "the composite x 100 — run cards show the same
     composite on 0-1". The qualifier composite is chrF++ and exact match
     only (the contest lane runs no metric plugins); the words now say so,
     and qualify prints its own makeup plus, for orientation, the card
     composite — labelled as the different number it is. The gate's
     computation is unchanged (which number SHOULD gate is a founder call).
     ANSWERED 2026-10-04 by scoring standard/1: neither composite gates;
     the qualifier score is corpus chrF++ (0-100), the card's headline.
  5. `node init` could not fill its values from the manifest `contest
     prepare` wrote; nine values were copied by hand. `--from-contest`.
  6. The stand-in "private" set was a copy of the public suite it declared,
     and nothing said so. Prepare now counts sealed rows that are already
     public (released dev set, blind source, declared suites) and warns.

Items 2-4 (resource defaults/refusals, a missing container runtime, where a
node's cards come from) are pinned in test_sandbox_runner.py,
test_node_airgap.py and test_cli.py beside the code paths they exercise.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from mt_eval_harness import contest_node, contest_prep as prep
from mt_eval_harness import contest_qualify
from mt_eval_harness.contest_node import (
    NodeConfigError,
    load_node_config,
    node_config_from_contest,
)
from mt_eval_harness.contest_qualify import qualify
from mt_eval_harness.external_scoring import sha256_file
from mt_eval_harness.qualifier_gate import QUALIFIER_SCALE, threshold_phrase

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"


# ---------------------------------------------------------------------------
# 1. what the qualifier score is
# ---------------------------------------------------------------------------

class TestTheQualifierSaysWhatItIs:
    """Round 3's persona saw qualify score 4.39 while the dry-run card
    composite for the very same outputs was 0.2482. Scoring standard/1
    (2026-10-04) answers the founder question that left open: neither
    composite gates — the qualifier score is corpus chrF++ (0-100), the
    same number an `mt-eval run` card headlines for the same outputs."""

    def test_the_threshold_phrase_names_the_chrf_scale(self):
        text = threshold_phrase(35)
        assert text.startswith("35 on the chrF++ 0-100 qualifier scale")
        assert "corpus chrF++" in text
        assert "composite" not in text
        assert "0.35" not in text
        assert "composite is retired and never gates" in QUALIFIER_SCALE
        assert "same number an `mt-eval run` card headlines" in QUALIFIER_SCALE

    def _qualify(self, tmp_path, corpus, hyps, pair, threshold=1.0):
        h = tmp_path / "hyps.txt"
        h.write_text("\n".join(hyps) + "\n", encoding="utf-8")
        cid = json.loads(Path(corpus).read_text(encoding="utf-8"))[
            "dataset"]["corpus_id"]
        return qualify("synth-open-2026", dev_hyp_path=h,
                       dev_corpus_path=corpus, system_label="acme",
                       method_class="pipeline",
                       receipt_dir=tmp_path / "receipts",
                       offline_qualifier={"qualifier_id": cid,
                                          "corpus_card_id": cid,
                                          "threshold": threshold,
                                          "language_pair": pair,
                                          "year": 2026})

    def test_qualify_prints_what_the_score_is_and_records_its_basis(
            self, tmp_path, capsys):
        refs = [e["reference"] for e in json.loads(
            DEV_CORPUS.read_text(encoding="utf-8"))["entries"]]
        hyps = refs[:-1] + ["something else entirely"]
        receipt = self._qualify(tmp_path, DEV_CORPUS, hyps, "qaa>qab")
        out = capsys.readouterr().out
        # Round 8: one gating number, no duplicate, no publish claim.
        assert (f"Qualifier score (what gates): chrF++ {receipt['score']}"
                in out)
        assert "what publish records" not in out
        assert "What it is: chrF++ 0-100 qualifier" in out
        assert "Diagnostic (never gates): exact match" in out
        # No composite makeup, no orientation composite: retired.
        assert "is made: profile" not in out and "for orientation" not in out
        basis = receipt["scoreBasis"]
        assert basis["scale"].startswith("chrF++ 0-100")
        # The receipt's score is exactly sacreBLEU's corpus chrF++.
        from sacrebleu.metrics import CHRF
        want = CHRF(word_order=2).corpus_score(hyps, [refs]).score
        assert receipt["score"] == round(want, 2)
        # …and what reaches a bundle manifest is unchanged (C1 fields only).
        from mt_eval_harness.contest_declarations import (
            qualifier_block_from_receipt,
        )
        assert "scoreBasis" not in qualifier_block_from_receipt(receipt)

    def test_the_score_is_the_card_headline_for_the_same_outputs(
            self, tmp_path):
        """The qualifier and an `mt-eval run` card agree now: both headline
        corpus chrF++ for the same outputs (the 4.39 vs 0.2482 gap is
        gone by construction)."""
        corpus = tmp_path / "eng-fra-dev.json"
        rows = [("The cat sleeps on the mat.", "Le chat dort sur le tapis."),
                ("I like green apples.", "J'aime les pommes vertes."),
                ("The river is very cold today.",
                 "La rivière est très froide aujourd'hui."),
                ("We will meet at noon.", "Nous nous verrons à midi.")]
        corpus.write_text(json.dumps({
            "dataset": {"corpus_id": "eval-eng-fra-synth-qualifier-v2026",
                        "language_pair": {"source": "eng", "target": "fra"},
                        "license": "CC0-1.0"},
            "entries": [{"id": i, "source": s, "reference": r}
                        for i, (s, r) in enumerate(rows)]}), encoding="utf-8")
        hyps = ["Le chat dort sur le tapis.", "I like green apples.",
                "La rivière est froide.", "Nous verrons midi."]
        receipt = self._qualify(tmp_path, corpus, hyps, "eng>fra")
        from sacrebleu.metrics import CHRF
        card_headline = CHRF(word_order=2).corpus_score(
            hyps, [[r for _s, r in rows]]).score
        assert receipt["score"] == round(card_headline, 2)

    def test_qualify_help_says_what_the_score_is(self, capsys):
        from mt_eval_harness.cli import main
        with patch.object(sys, "argv",
                          ["mt-eval", "contest", "qualify", "--help"]):
            with pytest.raises(SystemExit):
                main()
        text = " ".join(capsys.readouterr().out.split())
        assert "corpus chrF++" in text and "0-100" in text


# ---------------------------------------------------------------------------
# The pages say what the code does (parity-gated prose).
# ---------------------------------------------------------------------------

DOCS = (Path(__file__).resolve().parents[2] / "cli" / "website" / "docs"
        / "network" / "sovereignty")


class TestThePagesMatchTheCode:
    def test_resource_defaults_in_the_pages_are_the_templates(self):
        from mt_eval_harness.contest_declarations import (
            DEFAULT_REQUIREMENTS as r,
        )
        runbook = (DOCS / "run-a-sovereign-contest.md").read_text("utf-8")
        node = (DOCS / "sovereign-eval-node.md").read_text("utf-8")
        assert (f"`--ram-gb {r['ramGB']}`, `--disk-gb {r['diskGB']}`,\n"
                f"`--max-runtime-minutes {r['maxRuntimeMinutes']}`") in runbook
        assert (f"{r['ramGB']} GB RAM, {r['diskGB']} GB scratch,\n   "
                f"{r['maxRuntimeMinutes']} minutes per run") in node

    def test_the_runbook_states_the_qualifier_metric_the_code_uses(self):
        """Scoring standard/1: the qualifier score is corpus chrF++ — the
        page says so, and says a legacy composite qualifier is read on the
        chrF++ scale (qualifier_gate.resolve_qualifier_metric)."""
        from mt_eval_harness.qualifier_gate import (
            QUALIFIER_METRIC, resolve_qualifier_metric,
        )
        runbook = " ".join((DOCS / "run-a-sovereign-contest.md")
                           .read_text("utf-8").split())
        assert QUALIFIER_METRIC == "chrf_plus_plus"
        assert ("the qualifier score is **corpus chrF++** (sacreBLEU chrF, "
                "`word_order=2`)") in runbook
        assert "Nothing else is blended into it" in runbook
        assert "its threshold is read on the chrF++ scale" in runbook
        assert resolve_qualifier_metric("composite", 35)["note"]
        # The retired composite formula is gone from the page.
        assert "× exact match) /" not in runbook
        assert "0.35 on a card" not in runbook

    def test_the_card_command_the_pages_name_exists(self):
        src = (Path(__file__).resolve().parents[2] / "cli" / "lib"
               / "commands" / "card.js").read_text("utf-8")
        # The CLI names its network commands in their grouped form (the flat
        # `champollion card` still works); the pages use the same form.
        assert "champollion network card crk --json" in src
        runbook = (DOCS / "run-a-sovereign-contest.md").read_text("utf-8")
        assert ("champollion network card eng --json > node-cards/eng.json"
                in runbook)


# ---------------------------------------------------------------------------
# 5. node init --from-contest
# ---------------------------------------------------------------------------

def _prepared(tmp_path, *, holdout=True, suites=True, scheme="single-keypair-wave1"):
    """The files `contest prepare` leaves under --out (artifacts are
    placeholders — node init only resolves their paths)."""
    out = tmp_path / "mytask"
    (out / "local").mkdir(parents=True)
    (out / "public").mkdir()
    dev = out / "public" / "eval-eng-crk-mytask-qualifier-v2026.json"
    dev.write_text("{}", encoding="utf-8")
    secret = out / "local" / "eval-eng-crk-mytask-secret-v1.corpus.sealed.json"
    secret.write_text("sealed", encoding="utf-8")
    manifest = {
        "contest": {"slug": "mytask", "name": "My Task 2026",
                    "language_pair": "eng>crk"},
        # Recorded relative to wherever prepare ran.
        "qualifier": {"qualifier_id": "eval-eng-crk-mytask-qualifier-v2026",
                      "corpus_card_id": "eval-eng-crk-mytask-qualifier-v2026",
                      "threshold": 35.0, "metric": "composite", "year": 2026,
                      "corpus_file": "mytask/public/" + dev.name},
        "secret": {"sealed_set_id": "eval-eng-crk-mytask-secret-v1",
                   "corpus_sealed_artifact": "mytask/local/" + secret.name,
                   "sealed_block": {"keyScheme": scheme,
                                    "thresholdKeyId": "abc123"}},
        "holdout": None,
        "test_suites": [],
    }
    if holdout:
        h = out / "local" / "eval-eng-crk-mytask-holdout-v1.corpus.sealed.json"
        h.write_text("sealed", encoding="utf-8")
        manifest["holdout"] = {"sealed_set_id": "eval-eng-crk-mytask-holdout-v1",
                               "corpus_sealed_artifact": "mytask/local/" + h.name}
    if suites:
        manifest["test_suites"] = [{"suite_id": "eval-eng-crk-diag-v1",
                                    "corpus_card_id": "eval-eng-crk-diag-v1",
                                    "publisher": "Someone",
                                    "url": "https://example.test/diag",
                                    "sha256": "b" * 64}]
    (out / "local" / "manifest.json").write_text(json.dumps(manifest),
                                                 encoding="utf-8")
    return out


class TestNodeInitFromContest:
    def test_every_manifest_value_lands_in_its_key(self, tmp_path,
                                                   monkeypatch):
        out = _prepared(tmp_path)
        monkeypatch.chdir(tmp_path / "mytask" / "local")  # NOT where prepare ran
        text, notes = node_config_from_contest(out)
        cfg = json.loads(text)
        (cid, c), = cfg["contests"].items()
        assert cid == "my-task-2026"            # the id registration gives it
        assert c["language_pair"] == "eng>crk"
        assert c["secret_set_id"] == "eval-eng-crk-mytask-secret-v1"
        assert Path(c["secret_artifact"]).is_absolute()
        assert Path(c["secret_artifact"]).is_file()
        assert c["holdout_set_id"] == "eval-eng-crk-mytask-holdout-v1"
        assert Path(c["holdout_corpus"]).is_file()
        assert Path(c["dev_corpus"]).is_file()
        assert c["qualifier"] == {
            "qualifier_id": "eval-eng-crk-mytask-qualifier-v2026",
            "corpus_card_id": "eval-eng-crk-mytask-qualifier-v2026",
            "threshold": 35.0, "metric": "composite", "year": 2026}
        assert c["custody"] == "single-key"
        assert c["secret_privkey"].startswith("<") and "abc123" in c["secret_privkey"]
        assert c["test_suites"][0]["corpus_sha256"] == "b" * 64
        assert c["test_suites"][0]["corpus_path"].startswith("<")
        assert c["corpus_version"] == "v1"
        # What no manifest knows stays a placeholder ledger verify names.
        for key in ("node_id", "cards_dir", "signing_key"):
            assert cfg[key].startswith("<")
        assert any("contest id 'my-task-2026'" in n for n in notes)

    def test_no_holdout_drops_the_holdout_keys(self, tmp_path):
        text, _ = node_config_from_contest(
            _prepared(tmp_path, holdout=False) / "local" / "manifest.json",
            contest_id="mytask")
        (cid, c), = json.loads(text)["contests"].items()
        assert cid == "mytask"
        assert not {"holdout_set_id", "holdout_corpus"} & set(c)

    def test_a_ceremony_sealed_set_is_threshold_quorum(self, tmp_path):
        text, _ = node_config_from_contest(
            _prepared(tmp_path, scheme="shamir-gf256-3-of-5"))
        (c,) = json.loads(text)["contests"].values()
        assert c["custody"] == "threshold-quorum"
        assert "secret_privkey" not in c

    def test_filled_in_it_loads(self, tmp_path):
        text, _ = node_config_from_contest(_prepared(tmp_path, suites=False))
        cfg = json.loads(text)
        cards = tmp_path / "cards"
        cards.mkdir()
        (cards / "eng.json").write_text(json.dumps(
            {"code": "eng", "name": "English"}), encoding="utf-8")
        (cards / "crk.json").write_text(json.dumps(
            {"code": "crk", "name": "Plains Cree"}), encoding="utf-8")
        key = tmp_path / "k.json"
        key.write_text("{}", encoding="utf-8")
        cfg.update(node_id="org-node-1", cards_dir=str(cards),
                   signing_key=str(key))
        (c,) = cfg["contests"].values()
        c["secret_privkey"] = str(key)
        p = tmp_path / "node.json"
        p.write_text(json.dumps(cfg), encoding="utf-8")
        loaded = load_node_config(p)
        assert contest_node.check_node_config(loaded)

    def test_a_manifest_with_no_sealed_set_is_refused(self, tmp_path):
        out = _prepared(tmp_path)
        m = json.loads((out / "local" / "manifest.json").read_text())
        m["secret"] = None
        (out / "local" / "manifest.json").write_text(json.dumps(m))
        with pytest.raises(NodeConfigError, match="no sealed set"):
            node_config_from_contest(out)

    def test_the_cli_writes_it_and_prints_the_notes(self, tmp_path, capsys):
        from mt_eval_harness.cli import main
        out = _prepared(tmp_path)
        dest = tmp_path / "node.json"
        with patch.object(sys, "argv", [
                "mt-eval", "node", "init", "--from-contest", str(out),
                "--config", str(dest)]):
            main()
        printed = capsys.readouterr().out
        assert "filled from" in printed and "contest id" in printed
        assert json.loads(dest.read_text())["contests"]["my-task-2026"]


# ---------------------------------------------------------------------------
# 6. a sealed row that is already public is not sealed
# ---------------------------------------------------------------------------

def _fake_seal(*, plaintext_path, card_id, artifact_out, card_block_out, **kw):
    Path(artifact_out).write_text("sealed", encoding="utf-8")
    block = {"keyScheme": "single-keypair-wave1", "thresholdKeyId": "k1"}
    Path(card_block_out).write_text(json.dumps(block), encoding="utf-8")
    return block


def _master(tmp_path, rows, name="master.json"):
    p = tmp_path / name
    p.write_text(json.dumps({
        "dataset": {"corpus_id": "master",
                    "language_pair": {"source": "qaa", "target": "qab"}},
        "entries": [{"id": i, "source": s, "reference": r}
                    for i, (s, r) in enumerate(rows)]}), encoding="utf-8")
    return p


def _rows(n, prefix="row"):
    return [(f"{prefix} source {i}", f"{prefix} reference {i}")
            for i in range(n)]


class TestSealedOverlap:
    def test_counts_exact_and_normalized_matches(self):
        sealed = [{"source": "Thank you.", "reference": "Giitu."},
                  {"source": "thank  YOU", "reference": "x"},
                  {"source": "fresh", "reference": "new"}]
        public = [{"source": "Thank you.", "reference": "Giitu."}]
        c = prep.overlap_counts(sealed, public)
        assert c == {"rows": 2, "of": 3, "by_source": 2, "by_reference": 1,
                     "exact": 1}
        # A source-only public release cannot leak a reference.
        assert prep.overlap_counts(
            [{"source": "a", "reference": "Giitu."}], public,
            sides=("source",))["rows"] == 0

    def _prepare(self, tmp_path, monkeypatch, master, **over):
        monkeypatch.setattr(prep, "seal_file_via_cli", _fake_seal)
        kwargs = dict(master_corpus_path=master, slug="synth",
                      name="Synthetic Open 2026", source_lang="qaa",
                      target_lang="qab", dev_size=5, secret_size=10,
                      holdout_size=5, seed=7, qualifier_threshold=35.0,
                      license_id="CC-BY-4.0", custodian_group_id="cg",
                      threshold_pubkey="unused.pub.json",
                      out_dir=tmp_path / "contest")
        kwargs.update(over)
        return prep.prepare_contest(**kwargs)

    def _suite(self, tmp_path, rows):
        suite = _master(tmp_path, rows, name="suite.json")
        reg = tmp_path / "registry.json"
        reg.write_text(json.dumps({"registry_version": "t", "datasets": [{
            "id": "eval-qaa-qab-diag-v1",
            "language_pair": {"source": "qaa", "target": "qab"},
            "sha256": sha256_file(suite), "url": "https://example.test/d",
            "source": "Third Party", "license": "CC-BY-4.0"}]}),
            encoding="utf-8")
        return suite, reg

    def test_a_sealed_set_copied_from_the_declared_suite_is_flagged(
            self, tmp_path, monkeypatch, capsys):
        """The persona's case: the 'private' master IS the public suite."""
        rows = _rows(20)
        suite, reg = self._suite(tmp_path, rows)
        manifest = self._prepare(
            tmp_path, monkeypatch, _master(tmp_path, rows),
            test_suites=[f"eval-qaa-qab-diag-v1={suite}"], registry_path=reg)
        out = capsys.readouterr().out
        assert "SEALED ROWS THAT ARE ALREADY PUBLIC" in out
        assert ("eval-qaa-qab-synth-secret-v1: 10 of 10 rows also appear in "
                "test suite eval-qaa-qab-diag-v1") in out
        found = {(f["sealed_set"], f["public_set"]): f["rows"]
                 for f in manifest["sealed_overlap"]["findings"]}
        assert found[("eval-qaa-qab-synth-holdout-v1",
                      "test suite eval-qaa-qab-diag-v1")] == 5
        # The suite id recorded on the contest is the bare id.
        assert [s["suite_id"] for s in manifest["test_suites"]] == [
            "eval-qaa-qab-diag-v1"]

    def test_duplicates_across_the_split_are_refused_not_leaked(
            self, tmp_path, monkeypatch):
        # Every row twice, sizes 5/10/5: a 5-row dev set cannot be filled
        # with whole twin pairs, so a row-disjoint split had to put a twin of
        # a released dev row into a sealed set (it used to only warn). Since
        # Round 13 the split is group-disjoint and refuses instead, with the
        # counts and the fix (test_round13_harness_fixes covers the split).
        rows = _rows(10) * 2
        with pytest.raises(prep.ContestPrepError,
                           match="remove the 10 repeated rows"):
            self._prepare(tmp_path, monkeypatch, _master(tmp_path, rows))

    def test_a_clean_master_says_nothing(self, tmp_path, monkeypatch, capsys):
        manifest = self._prepare(tmp_path, monkeypatch,
                                 _master(tmp_path, _rows(20)))
        assert manifest["sealed_overlap"] == {"findings": [], "unchecked": []}
        assert "ALREADY PUBLIC" not in capsys.readouterr().out

    def test_a_suite_with_no_local_copy_is_reported_unchecked(
            self, tmp_path, monkeypatch, capsys):
        _suite, reg = self._suite(tmp_path, _rows(3, "other"))
        monkeypatch.setattr(prep, "_local_suite_copy",
                            lambda sid, registry_path=None: None)
        manifest = self._prepare(
            tmp_path, monkeypatch, _master(tmp_path, _rows(20)),
            test_suites=["eval-qaa-qab-diag-v1"], registry_path=reg)
        (u,) = manifest["sealed_overlap"]["unchecked"]
        assert u["public_set"] == "eval-qaa-qab-diag-v1"
        assert "downloads nothing" in u["reason"]
        out = capsys.readouterr().out
        assert "NOT checked for overlap" in out
        assert "--test-suite eval-qaa-qab-diag-v1=<your local copy>" in out

    def test_a_local_copy_with_other_bytes_is_refused(self, tmp_path,
                                                      monkeypatch):
        _suite, reg = self._suite(tmp_path, _rows(3, "other"))
        wrong = _master(tmp_path, _rows(3, "else"), name="wrong.json")
        with pytest.raises(prep.ContestPrepError, match="not the suite"):
            self._prepare(tmp_path, monkeypatch, _master(tmp_path, _rows(20)),
                          test_suites=[f"eval-qaa-qab-diag-v1={wrong}"],
                          registry_path=reg)
        assert not (tmp_path / "contest").exists()
