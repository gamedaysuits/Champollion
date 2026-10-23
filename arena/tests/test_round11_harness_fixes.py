"""Round 11 synthetic personas (researcher eng>sme; Cree school eng>crk;
hospital qaa): the harness fixes.

1. A CODE given as --target-lang ("sme") reached the naive prompt word for
   word: "Translate the given English text to sme." It is now named from its
   language card (the card adapter), the header says so, the run log records
   it, and the prompt sha / cache key / fingerprint follow the new text. A
   code no card names stays a code, with a warning.
2. The dry run and the run header show the prompt: the built-in one whole, a
   coaching file by its first line and hash, and that it REPLACES the
   built-in prompt; a coaching text that names neither the target language
   nor its code is warned about. How coaching composes is unchanged.
5. Every printed quality tier reads "quality tier: <tier>" (since the
   scoring standard, 2026-10-04: no new output prints a tier at all).
13. A self-declared NONE contamination grade is never called "ungraded".
14. `mt-eval compare` writes to a neutral place, never one run's folder, and
    the corpus's mark still follows the file.
15. A card with several scripts and no --target-script: the references'
    script share (an aggregate) picks the dominant one, said and recorded; a
    remote (published) card's {name, source} scripts are read too.
18. The run header and dry run name the cache folder and what it holds.
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness import prompt_plan as pp


def _quiet(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = fn(*a, **kw)
    return result, buf.getvalue()


def _jsonl(tmp_path: Path, rows, name="test.jsonl") -> Path:
    p = tmp_path / name
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
                 + "\n", encoding="utf-8")
    return p


SME_ROWS = [{"id": "t1", "source": "Thank you.", "reference": "Giitu."},
            {"id": "t2", "source": "Good morning.", "reference": "Buorre iđit."}]
CRK_LATN = [{"id": "c1", "source": "Hello.", "reference": "tânisi."},
            {"id": "c2", "source": "Thank you.", "reference": "kinanâskomitin."}]
CRK_MIXED = [{"id": "c1", "source": "Hello.", "reference": "tânisi kiya."},
             {"id": "c2", "source": "Thank you.", "reference": "ᑭᓇᓈᐢᑯᒥᑎᐣ"}]


class CapturingStrategy:
    """The model: echoes each source, and keeps the system prompt it got."""
    def __init__(self):
        self.prompts: list[str] = []

    async def execute(self, *, entries, system_prompt="", **_):
        self.prompts.append(system_prompt)
        return [{"id": e["id"], "predicted": e["source"], "latency_s": 0.0,
                 "usage": {}, "error": None, "tool_calls": [],
                 "tool_call_count": 0, "metadata": {}} for e in entries], 0


@pytest.fixture
def capture(monkeypatch):
    from mt_eval_harness import runner
    strat = CapturingStrategy()
    monkeypatch.setattr(runner, "resolve_strategy", lambda *a, **k: strat)
    return strat


def _run(tmp_path, corpus, **kw):
    from mt_eval_harness.runner import execute_run
    cfg = dict(dataset="all", corpus_path=str(corpus), model="stub-1",
               provider="local", base_url="http://127.0.0.1:11434/v1",
               source_lang="English", skip_fst=True, skip_eval_standard=True,
               cache_dir=str(tmp_path / "cache"),
               output_dir=str(tmp_path / "out"))
    cfg.update(kw)
    config = RunConfig(**cfg)
    result, out = _quiet(lambda: asyncio.run(execute_run(config)))
    return config, result, out


# ===========================================================================
# 1. a code is named from its card before it reaches the prompt
# ===========================================================================

class TestCodeShapedTargetIsNamed:
    def test_code_shapes(self):
        assert pp.is_code_shaped("sme") and pp.is_code_shaped("crk-Cans")
        assert pp.is_code_shaped("fr") and pp.is_code_shaped("cmn_Hans")
        for name in ("Northern Sami", "Ewe", "Plains Cree (SRO)", "cree", ""):
            assert not pp.is_code_shaped(name), name

    def test_resolved_through_the_card(self):
        r = pp.resolve_language_name("sme")
        assert r["resolved"] and r["name"] == "Northern Sami" and r["code"] == "sme"

    def test_private_use_and_unknown_stay_codes_with_why(self):
        q = pp.resolve_language_name("qaa")
        assert not q["resolved"] and q["name"] == "qaa"
        assert "private-use" in q["why"]
        z = pp.resolve_language_name("zzx")
        assert not z["resolved"] and "no language card names it" in z["why"]

    def test_apply_names_and_records(self):
        cfg = RunConfig(model="m", target_lang="sme", source_lang="eng")
        lines = pp.apply_language_names(cfg)
        assert cfg.target_lang == "Northern Sami" and cfg.source_lang == "English"
        assert cfg.target_code == "sme"
        assert cfg.target_lang_resolution["given"] == "sme"
        assert any("the code 'sme' resolved through its language card" in l
                   for l in lines)
        # a name is left alone; a second pass changes nothing
        assert pp.apply_language_names(cfg) == []

    def test_unresolved_code_warns_and_says_the_prompt_carries_it(self):
        cfg = RunConfig(model="m", target_lang="qaa")
        (line,) = pp.apply_language_names(cfg)
        assert line.lstrip().startswith("⚠ Target lang: 'qaa'")
        assert 'the prompt will say "qaa"' in line
        assert "--target-lang <the language's name>" in line
        assert cfg.target_lang == "qaa" and cfg.target_code == "qaa"

    def test_prompt_and_cache_key_follow_the_name(self):
        from mt_eval_harness.runner import build_naive_prompt
        coded = RunConfig(model="m", target_lang="sme", source_lang="English")
        named = RunConfig(model="m", target_lang="sme", source_lang="English")
        pp.apply_language_names(named)
        assert build_naive_prompt(coded).endswith(
            "English text to sme. Output ONLY the translation, nothing else. "
            "No explanations, no notes.")
        assert "to Northern Sami." in build_naive_prompt(named)
        assert coded.config_hash() != named.config_hash()

    def test_the_run_prompts_with_the_name_and_says_so(self, tmp_path, capture):
        config, _, out = _run(tmp_path, _jsonl(tmp_path, SME_ROWS),
                              target_lang="sme", target_lang_code="sme")
        assert "Target lang: Northern Sami — the code 'sme' resolved" in out
        (prompt,) = capture.prompts
        assert "to Northern Sami." in prompt and " to sme." not in prompt
        log = json.loads(next((tmp_path / "out").glob("run_*[!t].json"))
                         .read_text(encoding="utf-8"))
        res = log["config"]["target_lang_resolution"]
        assert res["given"] == "sme" and res["name"] == "Northern Sami"
        import hashlib
        assert log["provenance"]["system_prompt_sha256"] == hashlib.sha256(
            prompt.encode("utf-8")).hexdigest()

    def test_the_card_says_where_the_name_came_from(self, tmp_path, capture):
        from mt_eval_harness.run_card import render_run_card
        _run(tmp_path, _jsonl(tmp_path, SME_ROWS), target_lang="sme")
        log = next(p for p in (tmp_path / "out").glob("run_*.json")
                   if not p.name.endswith("_report.json"))
        card = render_run_card(log)
        assert "Northern Sami (named from the code sme by its" in card
        for line in card.splitlines():
            assert len(line) <= 2 + 72, f"box broken: {line!r}"
        # a naive run's card shows the built-in prompt itself
        flat = " ".join(card.split())
        assert "the harness's built-in prompt" in flat


# ===========================================================================
# 2. the prompt is shown; a coaching file replaces it, and is checked
# ===========================================================================

class TestThePromptIsShown:
    def test_dry_run_shows_the_builtin_prompt(self, tmp_path):
        _, result, out = _run(tmp_path, _jsonl(tmp_path, SME_ROWS),
                              target_lang="sme", dry_run=True)
        line = next(l for l in out.splitlines() if "Prompt text:" in l)
        assert ("\"You are a translator. Translate the given English text to "
                "Northern Sami. Output ONLY the translation") in line
        assert result["prompt"]["kind"] == "naive"
        assert "Northern Sami" in result["prompt"]["text"]

    def test_coaching_replaces_and_a_silent_file_is_warned(self, tmp_path):
        coach = tmp_path / "coach.md"
        coach.write_text("Be careful with cases.\nUse short sentences.\n")
        _, result, out = _run(tmp_path, _jsonl(tmp_path, SME_ROWS),
                              target_lang="sme", coaching_file=str(coach),
                              dry_run=True)
        assert "coach.md REPLACES the harness's built-in prompt" in out
        assert 'first line: "Be careful with cases."' in out
        # Round 13: one plain verdict replaces "Not sent: … must say".
        assert "Not sent" not in out
        assert ("⚠ Coaching:   coach.md: it replaces the built-in \"You are a "
                "translator." in out)
        assert ("but names neither Northern Sami nor its code (sme)"
                in out)
        assert result["prompt"]["replaces_builtin"] is True
        assert result["prompt"]["names_target"] is False
        assert "text" not in result["prompt"]   # never the coaching text

    @pytest.mark.parametrize("text", [
        "# Northern Sami guidance\n", "Write davvisamegiella.\n",
        "Translate into SME.\n", "Northern Sámi, please.\n"])
    def test_naming_it_any_cited_way_counts(self, tmp_path, text):
        coach = tmp_path / "c.md"
        coach.write_text(text, encoding="utf-8")
        cfg = RunConfig(model="m", target_lang="sme", coaching_file=str(coach),
                        prompt_version="coached")
        pp.apply_language_names(cfg)
        plan = pp.prompt_plan(cfg)
        assert plan["kind"] == "coaching" and plan["names_target"] is True

    def test_coaching_composition_is_unchanged(self, tmp_path):
        """The file is sent as written — this round only SHOWS it."""
        from mt_eval_harness.runner import load_system_prompt
        coach = tmp_path / "c.md"
        coach.write_text("Only this.\n")
        cfg = RunConfig(model="m", target_lang="Northern Sami",
                        coaching_file=str(coach), prompt_version="coached")
        assert load_system_prompt(cfg) == "Only this.\n"

    def test_plan_for_is_what_the_mcp_probe_asks(self, tmp_path):
        plan = pp.plan_for(target_lang="sme", source_lang="English")
        assert plan["kind"] == "naive" and "to Northern Sami." in plan["text"]
        assert plan["target_resolution"]["resolved"] is True


# ===========================================================================
# 5. the tier is labelled as a tier
# ===========================================================================

def test_composite_lines_label_the_tier():
    # Scoring standard/1 retired the tiers: the label helper survives for
    # legacy reading, but the card's line for a legacy report names the
    # stored composite as retired and prints NO tier at all.
    from mt_eval_harness.run_card import composite_card_lines
    from mt_eval_harness.scoring import quality_tier_label
    assert quality_tier_label("baseline") == "quality tier: baseline"
    assert quality_tier_label(None) == "quality tier: unscored"
    lines = composite_card_lines({"published_composite": {
        "score": 0.252, "quality_tier": "baseline",
        "scoring_profile": "surface-only"}})
    text = " ".join(" ".join(lines).split())
    assert "Legacy composite" in text and "retired" in text
    assert "baseline" not in text and "quality tier" not in text
    for line in lines:
        assert len(line) <= 2 + 72, f"box broken: {line!r}"


def test_terminal_summary_and_publish_preview_print_no_tier():
    import inspect
    from mt_eval_harness import publish, tester
    assert "quality_tier_label" not in inspect.getsource(tester)
    assert "quality_tier_label" not in inspect.getsource(publish)


# ===========================================================================
# 13. NONE is a self-declared grade, never "ungraded"
# ===========================================================================

class TestNoneIsSelfDeclared:
    def test_phrases(self):
        from mt_eval_harness import contamination as c
        none = c.grade_phrase(None, "NONE")
        assert "ungraded" not in none and "self-declared" in none
        assert "LOW" in c.grade_note(None, "NONE")
        assert c.grade_note("LOW", "LOW") is None
        assert c.grade_phrase(None).startswith("ungraded contamination: no grade")
        assert c.grade_phrase("HIGH") == "HIGH contamination"
        # the lane itself is unchanged
        assert c.lane_for_grade("NONE") == c.LANE_RELATIVE_ONLY
        assert c.lane_for_grade("LOW") == c.LANE_ABSOLUTE

    def test_notice(self):
        from mt_eval_harness import contamination as c
        assert "self-declared" in c.relative_only_notice(None, "x", stated="NONE")
        assert "ungraded" in c.relative_only_notice(None, "x")

    def test_publish_preview_reads_the_card(self, tmp_path, capsys,
                                            monkeypatch):
        from mt_eval_harness import publish
        from test_publish import _write_pair
        monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
        report_path = _write_pair(tmp_path, "r11")
        log_path = Path(json.loads(report_path.read_text())["source_log"])
        log = json.loads(log_path.read_text())
        log.setdefault("provenance", {}).setdefault("dataset_meta", {})[
            "contamination"] = "NONE"
        log_path.write_text(json.dumps(log))
        card, _, _ = publish.assemble_run_card(report_path)
        assert card["contamination"] is None            # the lane's reading
        assert card["dataset"]["contamination_stated"] == "NONE"
        publish.publish_to_supabase(report_path, dry_run=True)
        out = capsys.readouterr().out
        lane = next(l for l in out.splitlines()
                    if l.strip().startswith("Score lane:"))
        assert "NONE contamination, self-declared" in lane
        assert "ungraded" not in lane
        assert "NONE is a self-declared grade" in out


# ===========================================================================
# 14. compare writes to a neutral place; the mark follows
# ===========================================================================

class TestCompareOutputPath:
    def test_shared_folder_keeps_beside(self, tmp_path):
        from mt_eval_harness.compare import default_comparison_path
        a, b = tmp_path / "results" / "a_report.json", tmp_path / "results" / "b_report.json"
        from mt_eval_harness.compare import comparison_filename
        assert default_comparison_path([a, b]) == (
            tmp_path / "results" / comparison_filename([a, b])).resolve()

    def test_run_folders_get_a_comparisons_folder_above(self, tmp_path):
        from mt_eval_harness.compare import default_comparison_path
        res = tmp_path / "data" / "results"
        a = res / "mcp-run-1" / "a_report.json"
        b = res / "mcp-run-2" / "b_report.json"
        from mt_eval_harness.compare import comparison_filename
        assert default_comparison_path([a, b]) == (
            res.resolve() / "comparisons" / comparison_filename([a, b]))
        c = tmp_path / "school" / "export-x" / "evaluation" / "runlog_report.json"
        assert default_comparison_path([a, b, c]) == (
            tmp_path.resolve() / "comparisons" / comparison_filename([a, b, c]))

    def test_nothing_in_common_falls_back_to_cwd(self, tmp_path):
        from mt_eval_harness.compare import default_comparison_path
        from mt_eval_harness.compare import comparison_filename
        paths = ["/a/x_report.json", "/b/y_report.json"]
        out = default_comparison_path(paths, cwd=tmp_path)
        assert out == tmp_path / "comparisons" / comparison_filename(paths)

    def test_the_mark_follows_the_comparison(self, tmp_path, capture):
        from mt_eval_harness.compare import run_compare
        corpus = _jsonl(tmp_path, SME_ROWS, name="nurse.jsonl")
        (tmp_path / "nurse.jsonl.champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
        reports = []
        for n in ("1", "2"):
            _run(tmp_path, corpus, target_lang="Northern Sami",
                 output_dir=str(tmp_path / "results" / f"mcp-run-{n}"),
                 temperature=0.0 if n == "1" else 0.1)
            reports.append(next((tmp_path / "results" / f"mcp-run-{n}")
                                .glob("*_report.json")))
        _quiet(run_compare, [str(r) for r in reports])
        from mt_eval_harness.compare import comparison_filename
        out = (tmp_path / "results" / "comparisons"
               / comparison_filename([str(r) for r in reports]))
        assert out.is_file()
        side = Path(str(out) + ".champollion.json")
        assert side.is_file()
        assert "local-only" in side.read_text()
        for r in reports:
            assert not (r.parent / "comparison.json").exists()


# ===========================================================================
# 15. the references' script; remote card scripts
# ===========================================================================

class TestScriptFromReferences:
    def test_shares_are_counts_only(self):
        t = pp.reference_script_shares(["tânisi", "ᑕᓂᓯ"], ["Cans", "Latn"])
        assert t["letters"] == 9 and set(t) == {"letters", "shares", "other"}
        assert t["shares"]["Latn"] == pytest.approx(6 / 9)
        assert t["shares"]["Cans"] == pytest.approx(3 / 9)

    def test_dominant_script_is_prompted_said_and_recorded(self, tmp_path,
                                                           capture):
        config, _, out = _run(tmp_path, _jsonl(tmp_path, CRK_LATN),
                              target_lang="Plains Cree", target_lang_code="crk")
        assert "references are 100% Latn → prompting for Latn" in out
        assert config.target_script == "Latn"
        src = config.target_script_source
        assert src["chosen"] == "Latn" and src["from"] == "references"
        assert "Write the translation in the Latn script" in capture.prompts[0]
        assert "tânisi" not in out    # no sentence is ever printed for it

    def test_mixed_references_choose_nothing_and_warn_once(self, tmp_path,
                                                           capture):
        config, _, out = _run(tmp_path, _jsonl(tmp_path, CRK_MIXED),
                              target_lang="Plains Cree", target_lang_code="crk")
        assert config.target_script == ""
        assert out.count("references are mixed") == 1
        assert "written in 2 scripts per its card" not in out  # not twice

    def test_a_given_script_wins(self, tmp_path, capture):
        config, _, out = _run(tmp_path, _jsonl(tmp_path, CRK_LATN),
                              target_lang="Plains Cree", target_lang_code="crk",
                              target_script="Cans")
        assert config.target_script == "Cans"
        assert config.target_script_source is None
        assert "prompting for" not in out

    def test_plan_for_reads_a_file_for_the_share_only(self, tmp_path):
        f = _jsonl(tmp_path, CRK_LATN)
        plan = pp.plan_for(target_lang="Plains Cree", target_code="crk",
                           corpus_path=str(f))
        assert plan["script"]["chosen"] == "Latn"
        assert "tânisi" not in json.dumps(plan, ensure_ascii=False)
        assert "Latn script" in plan["text"]

    def test_published_projection_scripts_are_read(self):
        from mt_eval_harness import language_cards as lc
        card = {"scripts": [{"name": "Cans", "source": "x"},
                            {"name": "Latn", "source": "y"}]}
        assert lc.script_codes(card) == ["Cans", "Latn"]
        lc._bridge_script_entries(card)
        assert [s["code"] for s in card["scripts"]] == ["Cans", "Latn"]
        assert lc.script_codes({"scripts": ["Latn"]}) == ["Latn"]


# ===========================================================================
# 18. the cache is named
# ===========================================================================

class TestTheCacheIsNamed:
    def test_header_names_the_folder_and_what_it_holds(self, tmp_path, capture):
        _, _, out = _run(tmp_path, _jsonl(tmp_path, SME_ROWS),
                         target_lang="Northern Sami")
        line = next(l for l in out.splitlines()
                    if l.strip().startswith("Cache: ") and "existing entries" in l)
        assert str(tmp_path / "cache") in line
        assert "copies of the corpus's sentences" in out

    def test_dry_run_names_it_and_the_mark(self, tmp_path):
        corpus = _jsonl(tmp_path, SME_ROWS, name="nurse.jsonl")
        (tmp_path / "nurse.jsonl.champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
        _, _, out = _run(tmp_path, corpus, target_lang="Northern Sami",
                         dry_run=True)
        line = next(l for l in out.splitlines()
                    if l.strip().startswith("Cache:") and "entries" in l)
        assert "protected" in line and "each carrying this corpus's mark" in line


# ===========================================================================
# 19. declared open models: one rule in the CLI and the harness (parity)
# ===========================================================================

class TestDeclaredModelsParity:
    REPO = Path(__file__).resolve().parents[2]

    def test_ct2_onnx_gguf_are_not_offered(self):
        from mt_eval_harness.recommend import declared_model_candidates
        card = {"methodSupportEvidence": {"total": 6, "named": [
            {"value": "open", "variant": "hf:org/model-a", "source": "s"},
            {"value": "open", "variant": "hf:org/model-a-ct2-int8", "source": "s"},
            {"value": "open", "variant": "hf:org/madlad400-10b-ct2", "source": "s"},
            {"value": "open", "variant": "hf:org/model-onnx", "source": "s"},
            {"value": "open", "variant": "hf:org/model-GGUF", "source": "s"},
            {"value": "service", "variant": "google-translate", "source": "s"}]}}
        d = declared_model_candidates("xyz", get_card=lambda c: card)
        assert [c["id"] for c in d["candidates"]] == ["org/model-a"]
        assert len(d["not_loadable"]) == 4 and d["declared_total"] == 6

    def test_recommend_carries_the_section(self):
        from mt_eval_harness.recommend import recommend, render_text
        declared = {"declared_total": 1, "listed": 1, "loadable": 1,
                    "not_loadable": [], "problem": None,
                    "candidates": [{"id": "org/m", "claim": "model-card-declared",
                                    "source": "s"}]}
        p = recommend("eng", "xyz", env={}, curated={}, bulk={}, reliability={},
                      declared=declared)
        assert p["declared_models"]["candidates"][0]["id"] == "org/m"
        assert "Open models whose model card declares xyz" in render_text(p)

    @pytest.mark.parametrize("code", ["crk", "sme", "yor"])
    def test_same_candidates_as_the_cli(self, code):
        import shutil
        import subprocess
        node = shutil.which("node")
        cli = self.REPO / "cli" / "lib" / "recommend.js"
        if not node or not cli.is_file():
            pytest.skip("node or the CLI is not in this checkout")
        script = (f"import({json.dumps(cli.as_uri())}).then(m => "
                  f"process.stdout.write(JSON.stringify(m.declaredModelCandidates("
                  f"{json.dumps(code)}))))")
        r = subprocess.run([node, "-e", script], capture_output=True, text=True,
                           timeout=60, cwd=str(self.REPO / "cli"))
        assert r.returncode == 0, r.stderr
        js = json.loads(r.stdout)
        from mt_eval_harness.recommend import declared_model_candidates
        py = declared_model_candidates(code)
        for key in ("declared_total", "listed", "loadable", "not_loadable"):
            assert py[key] == js[key], key
        assert [c["id"] for c in py["candidates"]] == [c["id"] for c in js["candidates"]]
