"""Round 13 synthetic-user findings — harness side.

Researcher (eng→sme), Cree school (crk) and hospital (eng→qaa) personas.
Each class names the finding it pins.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import compare as cmp
from mt_eval_harness import prompt_plan as pp
from mt_eval_harness.plugins import giellalt_fst as gf
from mt_eval_harness.plugins.giellalt_fst import (
    FST_ACCEPTANCE_METHOD,
    GiellaLTFSTMetric,
    case_variants,
)


# ---------------------------------------------------------------------------
# Item 1 — FST acceptance penalised correct capitals (researcher, sme, MAJOR)
# ---------------------------------------------------------------------------

class _CaseSensitiveAcceptor:
    """Models the installed sme speller acceptor (speller-sme v4.5.2): it
    accepts "mun" and rejects "Mun"; proper nouns are listed capitalised
    ("Oslo" yes, "oslo" no); its ALL-CAPS path accepts some words ("MUN")
    and not others ("GIITU") — all observed with pyhfst on the real file."""

    VOCAB = {"mun", "don", "giitu", "boađe", "Oslo", "MUN", "lean", "dás"}

    def lookup(self, word):
        return [(word, 0.0)] if word in self.VOCAB else []


class _TaggedAnalyzer:
    """Models ALTLab's strict crk analyser: tagged analyses, lower case only
    ("tânisi" yes, "Tânisi" no)."""

    VOCAB = {"tânisi": "tânisi+Ipc", "maskwa": "maskwa+N+A+Sg",
             "niya": "niya+Pron+Pers+1Sg"}

    def lookup(self, word):
        a = self.VOCAB.get(word)
        return [(a, 0.0)] if a else []


def _metric(transducer, lang="sme", fst_dir="/nonexistent"):
    m = GiellaLTFSTMetric(lang_code=lang, fst_dir=Path(fst_dir))
    m._analyzer = transducer
    return m


class TestCaseVariants:
    @pytest.mark.parametrize("word, expected", [
        ("mun", ["mun"]),
        ("Mun", ["Mun", "mun"]),
        ("GIITU", ["GIITU", "Giitu", "giitu"]),
        ("OSLO", ["OSLO", "Oslo", "oslo"]),
        ("Boađe", ["Boađe", "boađe"]),
        ("Kihci-manitow", ["Kihci-manitow", "kihci-manitow"]),
        ("oslo", ["oslo"]),            # never upward: no "Oslo" retry
        ("eLLe", ["eLLe"]),            # mixed case not starting upper
        ("A", ["A", "a"]),             # one letter: Titlecase rule
        ("", [""]),
    ])
    def test_variants(self, word, expected):
        assert case_variants(word) == expected


class TestCaseFallback:
    def test_sentence_initial_capital_is_accepted_and_recorded(self):
        m = _metric(_CaseSensitiveAcceptor())
        r = m.compute({"predicted": "Mun lean dás.", "expected": "mun lean dás"})
        assert r["fst_valid_words"] == 3 and r["fst_invalid_words"] == []
        assert r["fst_case_folded_words"] == [{"word": "Mun", "accepted_as": "mun"}]

    def test_capitalising_a_sentence_never_lowers_acceptance(self):
        """Method B = method A with capitalised sentence starts: same score."""
        m = _metric(_CaseSensitiveAcceptor())
        a = m.compute({"predicted": "mun lean dás", "expected": ""})
        b = m.compute({"predicted": "Mun lean dás.", "expected": ""})
        assert a["fst_validity_rate"] == b["fst_validity_rate"] == 1.0

    def test_all_caps_and_as_given_forms(self):
        m = _metric(_CaseSensitiveAcceptor())
        r = m.compute({"predicted": "MUN GIITU OSLO", "expected": ""})
        assert r["fst_valid_words"] == 3
        # MUN is accepted as written — not recorded as folded.
        assert r["fst_case_folded_words"] == [
            {"word": "GIITU", "accepted_as": "giitu"},
            {"word": "OSLO", "accepted_as": "Oslo"}]

    def test_lower_case_proper_noun_stays_rejected(self):
        m = _metric(_CaseSensitiveAcceptor())
        r = m.compute({"predicted": "oslo", "expected": ""})
        assert r["fst_valid_words"] == 0 and r["fst_invalid_words"] == ["oslo"]

    def test_aggregate_names_the_method_and_counts_folds(self, tmp_path):
        m = _metric(_CaseSensitiveAcceptor(), fst_dir=tmp_path)
        agg = m.aggregate([m.compute({"predicted": "Mun lean", "expected": ""}),
                           m.compute({"predicted": "Don dás", "expected": ""})])
        assert agg["fst_acceptance_method"] == FST_ACCEPTANCE_METHOD
        assert agg["fst_version_info"]["acceptance_method"] == FST_ACCEPTANCE_METHOD
        assert agg["total_case_folded_words"] == 2
        assert agg["total_valid_words"] == 4

    def test_tagged_crk_analyzer_gets_the_same_fallback(self):
        """The crk path is the same plugin over a tagged analyser — the
        fallback applies to acceptance AND the lemma-matched morphology, in
        the prediction and the reference alike."""
        m = _metric(_TaggedAnalyzer(), lang="crk")
        r = m.compute({"predicted": "Tânisi. Maskwa", "expected": "Tânisi maskwa"})
        assert r["fst_valid_words"] == 2
        assert r["morph_analyzable_words"] == 2
        assert r["morph_tagged_words"] == 2
        assert r["morph_covered_words"] == 2 and r["morph_correct_words"] == 2

    def test_run_card_provenance_carries_the_method(self, tmp_path):
        (tmp_path / "provenance.json").write_text(json.dumps(
            {"release_tag": "speller-sme/v4.5.2", "kind": "acceptor"}))
        m = _metric(_CaseSensitiveAcceptor(), fst_dir=tmp_path)
        info = m.version_info()
        assert info["acceptance_method"] == "case-fallback/1"
        assert info["fst_release"] == "speller-sme/v4.5.2"


class TestCompareNamesTheFstMethod:
    @staticmethod
    def _pm(method):
        fst = {"avg_fst_validity": 0.1, "corpus_validity_rate": 0.1,
               "total_valid_words": 1, "total_words_checked": 10}
        if method:
            fst["fst_acceptance_method"] = method
        return {"giellalt_fst_validity": fst}

    def test_method_read_from_report(self):
        assert cmp.fst_acceptance_method(self._pm("case-fallback/1")) == "case-fallback/1"
        assert cmp.fst_acceptance_method(self._pm(None)) == \
            cmp.FST_METHOD_BEFORE_CASE_FALLBACK
        assert cmp.fst_acceptance_method({}) is None
        assert cmp.fst_acceptance_method(
            {"giellalt_fst_validity": {"error": "FST unavailable"}}) is None

    def test_mixed_methods_are_said_and_same_methods_are_not(self):
        old = {"fst_acceptance_method": cmp.FST_METHOD_BEFORE_CASE_FALLBACK}
        new = {"fst_acceptance_method": "case-fallback/1"}
        text = " ".join(" ".join(cmp.fst_method_note(["A", "B"],
                                                     [old, new])).split())
        assert "computed different ways" in text
        assert "A case-sensitive/0 (case-sensitive" in text
        assert "B case-fallback/1" in text
        assert "mt-eval test" in text
        assert cmp.fst_method_note(["A", "B"], [new, new]) == []
        assert cmp.fst_method_note(["A", "B"], [new, {}]) == []


# ---------------------------------------------------------------------------
# Item 16 — the coached dry-run verdict (Cree school)
# ---------------------------------------------------------------------------

class TestCoachingVerdict:
    BASE = {"kind": "coaching", "coaching_file": "/x/coach.md",
            "builtin": "You are a translator. Translate the given English "
                       "text to Plains Cree. Output ONLY the translation.",
            "chars": 10, "sha256": "ab" * 32}

    def _lines(self, **plan):
        return pp.prompt_plan_lines({**self.BASE, **plan},
                                    target_name="Plains Cree",
                                    target_code="crk",
                                    show_coaching_line=False)

    def test_named_is_one_pass_line(self):
        lines = self._lines(names_target=True, named_as="Plains Cree")
        text = "\n".join(lines)
        assert "Not sent" not in text and "must say" not in text
        verdict = [l for l in lines if "Coaching:" in l]
        assert len(verdict) == 1
        assert verdict[0].strip().startswith("✓ Coaching:")
        assert 'replaces the built-in "You are a translator.' in verdict[0]
        assert "names Plains Cree — the model is told" in verdict[0]

    def test_named_by_code_says_how(self):
        line = [l for l in self._lines(names_target=True, named_as="crk")
                if "Coaching:" in l][0]
        assert 'names Plains Cree (as "crk")' in line

    def test_not_named_is_one_warning_line(self):
        lines = self._lines(names_target=False, named_as=None)
        verdict = [l for l in lines if "Coaching:" in l]
        assert len(verdict) == 1 and verdict[0].strip().startswith("⚠ Coaching:")
        assert "names neither Plains Cree nor its code (crk)" in verdict[0]

    def test_unknown_target_says_not_checked(self):
        line = [l for l in self._lines(names_target=None) if "Coaching:" in l][0]
        assert "✓" not in line and "⚠" not in line
        assert "was not checked" in line

    def test_plan_records_which_name_matched(self, tmp_path):
        from mt_eval_harness.config import RunConfig
        coach = tmp_path / "c.md"
        coach.write_text("Translate into SME.\n", encoding="utf-8")
        cfg = RunConfig(model="m", target_lang="sme", coaching_file=str(coach),
                        prompt_version="coached")
        pp.apply_language_names(cfg)
        plan = pp.prompt_plan(cfg)
        assert plan["names_target"] is True
        assert pp._fold(plan["named_as"]) == "sme"


# ---------------------------------------------------------------------------
# Item 12 — "Yes *" beside Δ +0.00 [+0.00, +0.00] (hospital + school)
# ---------------------------------------------------------------------------

from mt_eval_harness import significance as sig  # noqa: E402
from mt_eval_harness.significance import SignificanceResult  # noqa: E402


def _res(name, a, b, d, lo, hi, p, significant, winner=None):
    return SignificanceResult(name, a, b, d, p, 1000, 0.95, significant,
                              winner, lo, hi, "approximate_randomization")


def _row(table: str, metric: str) -> str:
    return next(l for l in table.splitlines() if f" {metric}" in l
                and ("Yes" in l or " No " in l or "?†" in l))


class TestTinyDeltaDisplay:
    def test_tiny_real_delta_gets_more_decimals(self):
        """The hospital persona's numbers: spBLEU 0.0684 vs 0.0673."""
        r = _res("corpus_spbleu", 0.0684, 0.0673, 0.0011, 0.0001, 0.0021,
                 0.035, True, "A")
        table = sig.format_significance_table([r], notes=False)
        row = _row(table, "corpus_spbleu")
        assert "+0.0011" in row and "[+0.0001, +0.0021]" in row
        assert "0.0684" in row and "0.0673" in row
        assert "+0.00 " not in row and "[+0.00," not in row
        assert "Yes *" in row
        assert "shown with more decimals" in table

    def test_large_delta_keeps_two_decimals(self):
        r = _res("corpus_chrf", 30.1, 25.0, 5.1, 3.0, 7.2, 0.001, True, "A")
        row = _row(sig.format_significance_table([r], notes=False), "corpus_chrf")
        assert "+5.10" in row and "[+3.00, +7.20]" in row
        assert sig.display_places(r) == 2

    def test_identical_values_are_not_significant(self):
        """A test on identical systems: Δ exactly 0 → p = 1, "No"."""
        entries = [{"id": i, "predicted": "abc", "expected": "abd",
                    "source": "s"} for i in range(20)]
        r = sig.paired_approximate_randomization(
            entries, entries, sig.corpus_spbleu, n_trials=200,
            metric_name="corpus_spbleu", n_bootstrap_ci=200)
        assert r.delta == 0 and r.p_value == 1.0 and not r.significant
        row = _row(sig.format_significance_table([r], notes=False),
                   "corpus_spbleu")
        assert "Yes" not in row and " No " in row

    def test_never_yes_beside_a_zero_interval(self):
        r = _res("corpus_ter", 90.0, 91.0, -1.0, 0.0, 0.0, 0.01, True, "A")
        table = sig.format_significance_table([r], notes=False)
        row = _row(table, "corpus_ter")
        assert "Yes" not in row and "?†" in row and "—†" in row
        assert "exactly [0, 0]" in table

    def test_stored_values_never_round_a_real_difference_to_zero(self):
        assert sig._keep(0.00004) == 4e-05
        assert sig._keep(0.00123456) == 0.0012
        assert sig._keep(0.0) == 0.0
        assert sig._keep(-0.000012345) == -1.234e-05


# ---------------------------------------------------------------------------
# Items 3–5 — contest prepare: group-disjoint split, releasable folder, terms
# ---------------------------------------------------------------------------

import hashlib  # noqa: E402

from mt_eval_harness import contest_prep as prep  # noqa: E402
from mt_eval_harness import release_folder as rf  # noqa: E402


def _fake_seal(*, plaintext_path, card_id, artifact_out, card_block_out, **kw):
    Path(artifact_out).write_text("sealed", encoding="utf-8")
    block = {"keyScheme": "single-keypair-wave1", "thresholdKeyId": "k1"}
    Path(card_block_out).write_text(json.dumps(block), encoding="utf-8")
    return block


def _master(tmp_path, rows, name="master.json", dataset_extra=None):
    p = tmp_path / name
    p.write_text(json.dumps({
        "dataset": {"corpus_id": "master",
                    "language_pair": {"source": "qaa", "target": "qab"},
                    **(dataset_extra or {})},
        "entries": [{"id": i, "source": s, "reference": r}
                    for i, (s, r) in enumerate(rows)]}), encoding="utf-8")
    return p


def _rows(n, prefix="row"):
    return [(f"{prefix} source {i}", f"{prefix} reference {i}")
            for i in range(n)]


def _prepare(tmp_path, monkeypatch, master, **over):
    monkeypatch.setattr(prep, "seal_file_via_cli", _fake_seal)
    kwargs = dict(master_corpus_path=master, slug="synth",
                  name="Synthetic Open 2026", source_lang="qaa",
                  target_lang="qab", dev_size=4, secret_size=10,
                  holdout_size=6, seed=7, qualifier_threshold=35.0,
                  license_id="CC-BY-4.0", custodian_group_id="cg",
                  threshold_pubkey="unused.pub.json",
                  out_dir=tmp_path / "contest")
    kwargs.update(over)
    return prep.prepare_contest(**kwargs)


def _keys(rows):
    return ({prep._norm_text(e["source"]) for e in rows}
            | {prep._norm_text(e["reference"]) for e in rows})


class TestGroupDisjointSplit:
    def test_no_repeats_gives_the_row_split_it_always_gave(self):
        """A master with no repeated sentence: byte-identical to the old
        row-disjoint split (same shuffle, same slices)."""
        import random
        entries = [{"source": f"s{i}", "reference": f"r{i}"} for i in range(30)]
        shuffled = list(entries)
        random.Random(42).shuffle(shuffled)
        old = (shuffled[:5], shuffled[5:13], shuffled[13:20], shuffled[20:24])
        stats = {}
        new = prep.split_corpus(entries, dev_size=5, blind_size=8,
                                secret_size=7, holdout_size=4, seed=42,
                                stats=stats)
        assert tuple(new) == old
        assert stats["method"] == "group-disjoint/1"
        assert stats["multi_row_groups"] == 0

    def test_repeated_sentences_never_straddle_tiers(self):
        rows = _rows(10)
        # Twins by source, by reference, and near-twins (case, punctuation,
        # spacing) — the researcher's 4/30 + 2/10 leak.
        entries = [{"source": s, "reference": r} for s, r in rows]
        entries += [{"source": "ROW SOURCE 1!", "reference": "other a"},
                    {"source": "other b", "reference": "row  reference 2."},
                    {"source": "row source 3", "reference": "row reference 3"}]
        stats = {}
        dev, blind, secret, holdout = prep.split_corpus(
            entries, dev_size=3, secret_size=6, holdout_size=2, seed=5,
            stats=stats)
        assert stats["multi_row_groups"] == 3
        for sealed in (secret, holdout):
            assert not (_keys(sealed) & _keys(dev))
        assert not (_keys(secret) & _keys(holdout))

    def test_transitive_groups_are_one_group(self):
        entries = [{"source": "a", "reference": "x"},
                   {"source": "a", "reference": "y"},
                   {"source": "b", "reference": "y"},
                   {"source": "c", "reference": "z"}]
        assert prep.duplicate_groups(entries) == [[0, 1, 2], [3]]

    def test_unsplittable_master_is_refused_with_counts_and_fix(self):
        entries = [{"source": f"s{i}", "reference": f"r{i}"}
                   for i in range(10)] * 2          # every row twice
        with pytest.raises(prep.ContestPrepError) as exc:
            prep.split_corpus(entries, dev_size=5, secret_size=10,
                              holdout_size=5, seed=7)
        msg = str(exc.value)
        assert "20 rows share a source or a reference" in msg
        assert "10 groups of 2 to 2" in msg
        assert "Fix: remove the 10 repeated rows" in msg

    def test_prepare_records_the_split_and_leaks_nothing(self, tmp_path,
                                                          monkeypatch, capsys):
        rows = _rows(10) * 2                        # 20 rows, 10 twin pairs
        manifest = _prepare(tmp_path, monkeypatch, _master(tmp_path, rows))
        assert manifest["split"]["method"] == "group-disjoint/1"
        assert manifest["split"]["multi_row_groups"] == 10
        dev_hits = [f for f in manifest["sealed_overlap"]["findings"]
                    if f["public_set"].startswith("the released dev set")]
        assert dev_hits == []
        assert "ALREADY PUBLIC" not in capsys.readouterr().out


class TestReleasableFolder:
    def test_prepare_marks_public_and_the_marker_is_found(self, tmp_path,
                                                          monkeypatch):
        manifest = _prepare(tmp_path, monkeypatch,
                            _master(tmp_path, _rows(20)))
        public = tmp_path / "contest" / "public"
        assert (public / rf.MARKER).is_file()
        assert manifest["releasable_dir"] == str(public)
        assert rf.releasable_root(public / "results" / "x") == public.resolve()
        assert rf.releasable_root(tmp_path / "contest" / "runs") is None
        assert rf.runs_dir_for(public) == tmp_path / "contest" / "runs"

    def test_nested_releasable_folders_give_the_outermost(self, tmp_path):
        outer = tmp_path / "c" / "public"
        inner = outer / "sub" / "public"
        inner.mkdir(parents=True)
        rf.write_marker(outer, contest_id="c")
        rf.write_marker(inner, contest_id="c2")
        root = rf.releasable_root(inner / "results")
        assert root == outer.resolve()
        assert rf.releasable_root(rf.runs_dir_for(root)) is None

    def test_a_contest_prepared_before_the_marker_is_found(self, tmp_path):
        public = tmp_path / "old" / "public"
        public.mkdir(parents=True)
        (tmp_path / "old" / "local").mkdir()
        (tmp_path / "old" / "local" / "manifest.json").write_text("{}")
        assert rf.releasable_root(public / "results") == public.resolve()
        assert rf.releasable_root(tmp_path / "elsewhere" / "public") is None

    @pytest.mark.parametrize("flag", ["--output-dir", "--cache-dir"])
    def test_run_refuses_to_write_into_it(self, tmp_path, flag, capsys):
        import sys
        from unittest.mock import patch
        from mt_eval_harness.cli import main
        public = tmp_path / "c" / "public"
        public.mkdir(parents=True)
        rf.write_marker(public, contest_id="c")
        corpus = _master(public, _rows(3), name="dev.json")
        other = ("--cache-dir" if flag == "--output-dir" else "--output-dir")
        argv = ["mt-eval", "run", "--corpus", str(corpus), "--model", "m",
                "--provider", "local", flag, str(public / "results"),
                other, str(tmp_path / "elsewhere"), "--dry-run"]
        with patch.object(sys, "argv", argv), pytest.raises(SystemExit) as e:
            main()
        assert e.value.code == 2
        err = capsys.readouterr().err
        assert "marked releasable" in err
        assert str(tmp_path / "c" / "runs") in err


class TestReleasedTerms:
    def _registered(self, tmp_path, rows, *, card):
        master = _master(tmp_path, rows)
        card_path = tmp_path / "card.json"
        card_path.write_text(json.dumps(card), encoding="utf-8")
        sha = hashlib.sha256(master.read_bytes()).hexdigest()
        Path(str(master) + ".champollion.json").write_text(json.dumps(
            {"transmission": "local-only", "card": "card.json",
             "sha256": sha, "license": "CC-BY-2.0"}), encoding="utf-8")
        return master

    CARD = {"id": "eval-qaa-qab-master-v1", "license": {"spdx": "CC-BY-2.0"},
            "doNotTrain": True, "exposureTier": "local-only",
            "usageRestrictions": {"redistribution": "prohibited"}}

    def test_master_card_terms_reach_the_released_file(self, tmp_path,
                                                       monkeypatch):
        master = self._registered(tmp_path, _rows(20), card=self.CARD)
        manifest = _prepare(tmp_path, monkeypatch, master,
                            license_id="CC-BY-2.0")
        dev = json.loads(Path(manifest["qualifier"]["corpus_file"])
                         .read_text(encoding="utf-8"))["dataset"]
        assert dev["license"] == "CC-BY-2.0"
        assert dev["do_not_train"] is True
        assert dev["transmission"] == "local-only"
        assert "eval-qaa-qab-master-v1" in dev["terms_from"]["do_not_train"]
        terms = manifest["release_terms"]
        assert terms["redistribution"]["value"] == "prohibited"
        lines = "\n".join(prep.release_terms_lines(terms))
        assert "do_not_train:  true" in lines
        assert "releasing public/ IS redistribution" in lines

    @pytest.mark.parametrize("usage", [None, {}, {"redistribution": None},
                                       "absent"])
    def test_licence_forbidding_redistribution_warns_without_usage(
            self, tmp_path, usage):
        # register-corpus's card shape: license.redistribution comes from the
        # licence; usageRestrictions may be absent, empty or null-valued.
        card = {"id": "eval-qaa-qab-master-v1",
                "license": {"spdx": "CC-BY-NC-ND-4.0", "redistribution": False},
                "doNotTrain": True, "transmission": "local-only"}
        if usage != "absent":
            card["usageRestrictions"] = usage
        master = self._registered(tmp_path, _rows(5), card=card)
        terms = prep.master_release_terms(master)
        assert terms["redistribution"]["value"] == "prohibited"
        assert "license.redistribution: false" in terms["redistribution"]["from"]
        lines = "\n".join(prep.release_terms_lines(
            {**terms, "do_not_train": True,
             "do_not_train_from": "card", "license": "CC-BY-NC-ND-4.0"}))
        assert "releasing public/ IS redistribution" in lines

    def test_old_card_shape_still_warns_and_permissive_licence_does_not(
            self, tmp_path):
        master = self._registered(tmp_path, _rows(5), card=self.CARD)
        assert prep.master_release_terms(master)["redistribution"]["value"] \
            == "prohibited"
        free = {"id": "eval-qaa-qab-master-v1",
                "license": {"spdx": "CC-BY-4.0", "redistribution": True}}
        master2 = self._registered(tmp_path / "f", _rows(5), card=free) \
            if (tmp_path / "f").mkdir() is None else None
        assert prep.master_release_terms(master2)["redistribution"] is None

    def test_release_cannot_loosen_do_not_train(self, tmp_path, monkeypatch):
        master = self._registered(tmp_path, _rows(20), card=self.CARD)
        with pytest.raises(prep.ContestPrepError, match="loosens"):
            _prepare(tmp_path, monkeypatch, master, do_not_train=False)

    def test_unstated_master_takes_the_flag_or_says_so(self, tmp_path,
                                                       monkeypatch):
        m = _prepare(tmp_path, monkeypatch, _master(tmp_path, _rows(20)))
        dev = json.loads(Path(m["qualifier"]["corpus_file"])
                         .read_text(encoding="utf-8"))["dataset"]
        assert "do_not_train" not in dev and "transmission" not in dev
        assert "not stated" in "\n".join(
            prep.release_terms_lines(m["release_terms"]))
        m2 = _prepare(tmp_path, monkeypatch, _master(tmp_path, _rows(20)),
                      do_not_train=True, out_dir=tmp_path / "c2")
        dev2 = json.loads(Path(m2["qualifier"]["corpus_file"])
                          .read_text(encoding="utf-8"))["dataset"]
        assert dev2["do_not_train"] is True
        assert dev2["terms_from"]["do_not_train"] == "--do-not-train true"


# ---------------------------------------------------------------------------
# Items 6–7 — qualify: one account of the outputs; a pass names what is left
# ---------------------------------------------------------------------------

from mt_eval_harness import contest_qualify  # noqa: E402
from mt_eval_harness import run_card as rc  # noqa: E402

QFIX = Path(__file__).parent / "fixtures" / "contest_synthetic"
QDEV = QFIX / "corpus_dev.json"


def _wire(monkeypatch, threshold=50.0):
    monkeypatch.setattr(
        contest_qualify, "_resolve_qualifier",
        lambda cid, offline: {
            "contest": {"id": cid, "language_pair": "qaa>qab"},
            "qualifier": {"qualifier_id": "eval-qaa-qab-synth-qualifier-v2026",
                          "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
                          "threshold": threshold, "metric": "composite",
                          "year": 2026},
            "offline": False,
        })


def _run_log(tmp_path, *, config, name="runlog.json"):
    data = json.loads(QDEV.read_text(encoding="utf-8"))
    results = [{"id": e["id"], "source": e["source"],
                "expected": e["reference"], "predicted": e["reference"],
                "cost_usd": None, "latency_s": 0.01}
               for e in data["entries"]]
    p = tmp_path / name
    p.write_text(json.dumps({
        "run_id": "run_x", "config": config, "total_cost_usd": None,
        "provenance": {"endpoint_locality": {"loopback": True,
                                             "host": "127.0.0.1"}},
        "results": results}), encoding="utf-8")
    return p


class TestQualifyOneAccount:
    def test_outputs_from_a_harness_run_log_are_never_outside(self, tmp_path,
                                                              monkeypatch,
                                                              capsys):
        _wire(monkeypatch)
        log = _run_log(tmp_path, config={"model": "stub-1",
                                         "provider": "local",
                                         "base_url": "http://127.0.0.1:1/v1"})
        contest_qualify.qualify(
            "synth-open-2026", dev_hyp_path=log, dev_corpus_path=QDEV,
            system_label="stub", method_class="raw-llm",
            receipt_dir=tmp_path / "r")
        out = capsys.readouterr().out
        assert "made outside the harness" not in out
        assert "made by the harness in run log run_x (stub-1)" in out
        assert "Produced by: harness LLM, model stub-1" in out

    def test_outputs_line_and_cost_read_the_source_run(self):
        cfg = {"provider": "external",
               "outputs_from_run": {"kind": "run log", "run_id": "run_x",
                                    "model": "stub-1",
                                    "cost_label": "$0 API cost (runs on this machine)"}}
        assert "made by the harness in run log run_x" in rc.outputs_line(cfg)
        label = rc.cost_label(None, cfg, {})
        assert label.startswith("$0 API cost (runs on this machine) — as the "
                                "harness run log run_x recorded it")
        plain = {"provider": "external"}
        assert rc.outputs_line(plain) == rc.EXTERNAL_OUTPUTS_NA
        assert rc.cost_label(None, plain, {}).startswith(
            "unknown (outputs made outside the harness")

    def test_harness_llm_pass_says_it_is_not_an_entry_yet(self, tmp_path,
                                                          monkeypatch, capsys):
        _wire(monkeypatch)
        log = _run_log(tmp_path, config={"model": "stub-1",
                                         "provider": "local"})
        contest_qualify.qualify(
            "synth-open-2026", dev_hyp_path=log, dev_corpus_path=QDEV,
            system_label="stub", method_class="raw-llm",
            receipt_dir=tmp_path / "r")
        out = capsys.readouterr().out
        assert "you may now submit" not in out
        assert "not a method you can submit" in out
        assert "these outputs are not an entry yet" in out

    def test_a_plugin_that_imports_urllib_is_flagged_at_qualify(
            self, tmp_path, monkeypatch, capsys):
        _wire(monkeypatch)
        mdir = tmp_path / "plugin"
        mdir.mkdir()
        (mdir / "translate.py").write_text(
            "import urllib.request\n\ndef translate(x):\n    return x\n")
        log = _run_log(tmp_path, config={"model": "stub-1",
                                         "method_path": str(mdir)})
        receipt = contest_qualify.qualify(
            "synth-open-2026", dev_hyp_path=log, dev_corpus_path=QDEV,
            system_label="plug", method_class="custom-plugin",
            receipt_dir=tmp_path / "r")
        out = capsys.readouterr().out
        assert receipt["passed"] is True          # the verdict is unchanged
        assert "would refuse" in out and "network library import" in out
        assert "will refuse the method as it stands" in out

    def test_a_clean_plugin_and_a_plain_file_name_the_submit_checks(
            self, tmp_path, monkeypatch, capsys):
        _wire(monkeypatch)
        mdir = tmp_path / "plugin"
        mdir.mkdir()
        (mdir / "translate.py").write_text("def translate(x):\n    return x\n")
        log = _run_log(tmp_path, config={"model": "m", "method_path": str(mdir)})
        contest_qualify.qualify(
            "synth-open-2026", dev_hyp_path=log, dev_corpus_path=QDEV,
            system_label="plug", method_class="custom-plugin",
            receipt_dir=tmp_path / "r")
        out = capsys.readouterr().out
        assert "passes the static scan" in out
        assert "Submitting checks more before anything is sent" in out


# ---------------------------------------------------------------------------
# Item 13 — 'eng>?' for a private-use target (hospital, eng>qaa)
# ---------------------------------------------------------------------------

from mt_eval_harness import publish as pub  # noqa: E402


class TestPrivateUsePair:
    HOSPITAL = {"source_lang": "English",
                "target_lang": "Ayta (variety not yet confirmed)",
                "source_code": "eng", "target_code": "qaa",
                "target_lang_code": "qaa"}

    def test_the_runs_own_private_use_code_is_the_pair(self):
        assert pub._build_language_pair(self.HOSPITAL, {}) == "eng>qaa"
        assert pub._build_language_pair(self.HOSPITAL, None) == "eng>qaa"

    def test_private_use_codes_resolve_to_themselves(self):
        assert pub._resolve_lang_to_code("qaa") == "qaa"
        assert pub._resolve_lang_to_code("QTZ") == "qtz"

    def test_corpus_codes_still_win_and_names_still_resolve(self):
        assert pub._build_language_pair(
            self.HOSPITAL, {"language_pair": {"source": "eng",
                                              "target": "abc"}}) == "eng>abc"
        assert pub._build_language_pair(
            {"source_lang": "English", "target_lang": "Plains Cree"},
            {}) == "eng>crk"


class TestVerifierReproducesTheCardsMethod:
    def test_method_read_from_the_cards_run_card(self):
        from mt_eval_harness import verifier as v
        assert v.card_fst_acceptance_method({}) is None
        assert v.card_fst_acceptance_method(
            {"run_card": {"fst_provenance": {"acceptance_method":
                                             "case-fallback/1"}}}) == "case-fallback/1"
        assert v.card_fst_acceptance_method(
            {"run_card": json.dumps({"fst_provenance": {
                "acceptance_method": "case-fallback/1"}})}) == "case-fallback/1"

    def test_old_cards_are_rescored_case_sensitively(self):
        m = _metric(_CaseSensitiveAcceptor())
        old = GiellaLTFSTMetric(lang_code="sme", fst_dir=Path("/nonexistent"),
                                case_fallback=False)
        old._analyzer = _CaseSensitiveAcceptor()
        entry = {"predicted": "Mun lean", "expected": ""}
        assert m.compute(entry)["fst_valid_words"] == 2
        assert old.compute(entry)["fst_valid_words"] == 1
        assert old.aggregate([old.compute(entry)])["fst_acceptance_method"] \
            == gf.FST_ACCEPTANCE_METHOD_CASE_SENSITIVE

    def test_an_unknown_method_is_refused_not_rescored(self):
        from mt_eval_harness import verifier as v
        assert v._make_morph_scorer("crk", "case-fallback/99") is None
