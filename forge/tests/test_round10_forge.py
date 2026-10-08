"""Round 10 synthetic personas (hospital: an unconfirmed Ayta variety under
the private-use code qaa, a nurse-checked local-only test set, an all-data
and a twin-free model; school: eng→crk; researcher: eng→sme), 2026-10-04.

2. After a SEVERE verdict the fix wrote `--drop-test-twins` output to the
   plain audit's own `--clean-to` — the corpus the all-data model trains on.
   The fix now names its own file (`corpus.notwins.jsonl`), and leak-audit
   refuses to replace a file a config, a run or a registered split uses, or
   another audit's output, unless `--overwrite`.
5. The twin-free audit run after the split (the guide's order) printed
   "audit BEFORE splitting". The note is now said only where it applies.
6. `--json` (and so the MCP tool) carried thousands of row indices. Long
   index lists are summarized ({count, first}); the audit file beside the
   cleaned corpus keeps them, and `--full-indices` prints them.
7. preflight told the all-data config to drop its test twins after the
   twin-free companion existed. It now says the two-model state: this score
   is recall, quote the twin-free one beside it.
16. A split written to another --out left config.json naming a missing
   train file, silently. split says so, with the exact edit; preflight's
   training-data fix names the split's train side.
17. preflight passed, then run refused on decode headroom and on a leak
   audit. preflight now runs run's own checks (the dev fence's content
   check, build_mix's data guards, the headroom guard) with run's severity.
9. `prereg new` says which model the prediction judges (name it after the
   model; export picks it with --prereg) when it is written.
12. DEPLOY.md asked for a CHAMPOLLION_API_KEY a loopback serve does not need.
14. forge discover from the public card index says that index may lack the
   resources the full card cites.
15. `init --pair eng>crk` was silently replaced by eng-<code>.
18. A forge export's model/ folder had no documented path to a contest's
   declarative lane: DEPLOY.md §6 names the files, architecture and the
   parameter count the lane checks.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import json
from pathlib import Path

from nmt_forge.guards.leak_audit import (default_twin_free_path,
                                         summarize_indices)
from nmt_forge.workspace import Workspace
from tests.conftest import write_jsonl
from tests.test_cli import _twinned_project
from tests.test_private_text import _run
from tests.test_round9_forge import _project_config
from tests.test_cards import fixture_cards  # noqa: F401 — a fixture
from tests.test_export_layout import hf_export  # noqa: F401 — a fixture


def _audit(capsys, ws_dir, corpus, *extra):
    code, out, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                          str(corpus), *extra, "--json")
    return code, json.loads(out) if out.strip() else None, err


# -- 2. the twin-free corpus gets its own file --------------------------------

def test_default_twin_free_path_is_never_the_all_data_file():
    assert default_twin_free_path("data/x.tsv", "corpus.clean.jsonl") == \
        "corpus.notwins.jsonl"
    assert default_twin_free_path("data/x.tsv", "out/kept.jsonl") == \
        "out/kept.notwins.jsonl"
    assert default_twin_free_path("data/pairs.tsv") == \
        "data/pairs.notwins.jsonl"
    for clean in ("corpus.clean.jsonl", "a.jsonl", "b.tsv", "c"):
        assert default_twin_free_path("x.tsv", clean) != clean


def test_the_severe_fix_names_its_own_file(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    clean = tmp_path / "corpus.clean.jsonl"
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))
    assert code == 0, err
    v = doc["verdict"]
    assert v["severity"] == "severe"
    assert v["fix"] == (f"nmt-forge leak-audit {corpus} --clean-to "
                        f"{tmp_path / 'corpus.notwins.jsonl'} --drop-test-twins")
    assert str(clean) not in v["fix"]


def test_drop_test_twins_refuses_to_overwrite_the_all_data_corpus(tmp_path,
                                                                 capsys):
    """The hospital's near miss: the fix, run as printed, would have written
    the twin-free corpus over the all-data one."""
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    clean = tmp_path / "corpus.clean.jsonl"
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))[0] == 0
    before = clean.read_bytes()
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(clean),
                            "--drop-test-twins")
    assert code == 2
    text = doc["error"]["text"]
    assert "that file is in use" in text
    assert "the all-data clean corpus an earlier leak-audit wrote" in text
    assert f"--clean-to {tmp_path / 'corpus.notwins.jsonl'} --drop-test-twins" \
        in text
    assert "--overwrite" in text
    assert clean.read_bytes() == before, "nothing was written"
    assert not (tmp_path / "config-notwins.json").exists()
    # on purpose, it is allowed
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(clean),
                            "--drop-test-twins", "--overwrite")
    assert code == 0, err


def test_a_split_or_a_run_protects_the_file_it_read(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)
    clean = tmp_path / "corpus.clean.jsonl"
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))[0] == 0
    code, out, err = _run(capsys, "--workspace", ws_dir, "split", str(clean),
                          "--test", "0", "--dev", "10", "--seed", "1",
                          "--out", str(tmp_path / "data" / "split"),
                          "--register", "project", "--json")
    assert code == 0, err
    manifest = json.loads((tmp_path / "data" / "split" /
                           "split-manifest.json").read_text())
    assert Path(manifest["source_corpus"]["path"]) == clean.resolve()
    assert len(manifest["source_corpus"]["sha256"]) == 64
    # re-auditing the full corpus into the split's source: refused
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))
    assert code == 2
    assert "the split that registered project-dev was carved from it" in \
        doc["error"]["text"]

    # the twin-free audit, re-run after the split into its own file while
    # only its config points at it: the guide's order, allowed
    free = tmp_path / "corpus.notwins.jsonl"
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(free),
                            "--drop-test-twins")
    assert code == 0, err
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(free),
                            "--drop-test-twins")
    assert code == 0, err
    # …until a run trained on it
    run_dir = Path(ws_dir) / "runs" / "free-run"
    run_dir.mkdir(parents=True)
    (run_dir / "run-manifest.json").write_text(json.dumps({
        "run_name": "crk-nmt-cpu-tiny-notwins",
        "config": {"data": {"gold": ["corpus.notwins.jsonl"]}}}))
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(free),
                            "--drop-test-twins")
    assert code == 2
    assert "run crk-nmt-cpu-tiny-notwins trained on it" in doc["error"]["text"]


def test_a_new_file_is_never_refused(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to",
                            str(tmp_path / "fresh.jsonl"))
    assert code == 0, err


# -- 5. the order note only where it applies ----------------------------------

def _split_project(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)
    clean = tmp_path / "corpus.clean.jsonl"
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))[0] == 0
    code, out, err = _run(capsys, "--workspace", ws_dir, "split", str(clean),
                          "--test", "0", "--dev", "10", "--seed", "1",
                          "--out", str(tmp_path / "data" / "split"),
                          "--register", "project")
    assert code == 0, err
    return ws_dir, corpus


def test_the_twin_free_audit_after_the_split_carries_no_order_warning(
        tmp_path, capsys):
    ws_dir, corpus = _split_project(tmp_path, capsys)
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to",
                            str(tmp_path / "corpus.notwins.jsonl"),
                            "--drop-test-twins")
    assert code == 0, err
    v = doc["verdict"]
    assert v["numbers"]["dev_set_rows_among_them"] > 0
    assert v["audit_order"] is None
    assert "registered dev set's own rows" in v["summary"]
    assert "as intended" in v["summary"]
    code, text, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                           str(corpus), "--clean-to",
                           str(tmp_path / "corpus.notwins.jsonl"),
                           "--drop-test-twins", "--no-examples")
    assert "audit BEFORE splitting" not in text


def test_a_plain_audit_after_the_split_still_says_the_order(tmp_path, capsys):
    ws_dir, corpus = _split_project(tmp_path, capsys)
    code, doc, err = _audit(capsys, ws_dir, corpus)
    assert code == 0, err
    assert doc["verdict"]["numbers"]["dev_set_rows_among_them"] > 0
    assert doc["verdict"]["audit_order"].startswith("audit BEFORE splitting")


# -- 6. a compact answer by default -------------------------------------------

def test_summarize_indices_shapes():
    doc = {"per_set": {"t": {"row_indices": list(range(9)), "key_hashes": ["a"],
                             "eval_rows_with_template_sibling": list(range(6))}},
           "removed_row_indices": list(range(100)),
           "test_twins": {"removed_row_indices": [1, 2]},
           "other": list(range(50))}
    out = summarize_indices(doc)
    assert out["per_set"]["t"]["row_indices"] == {"count": 9,
                                                  "first": [0, 1, 2, 3, 4]}
    assert out["per_set"]["t"]["key_hashes"] == ["a"]
    assert out["per_set"]["t"]["eval_rows_with_template_sibling"]["count"] == 6
    assert out["removed_row_indices"]["count"] == 100
    assert out["test_twins"]["removed_row_indices"] == [1, 2]
    assert out["other"] == list(range(50)), "only the index lists"
    assert doc["removed_row_indices"] == list(range(100)), "a copy"


def test_json_is_compact_by_default_and_full_on_request(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys, n_test=40)
    free = tmp_path / "free.jsonl"
    code, doc, err = _audit(capsys, ws_dir, corpus, "--clean-to", str(free),
                            "--drop-test-twins")
    assert code == 0, err
    assert doc["indices"]["summarized"] is True
    assert doc["indices"]["full_lists"].endswith("free.audit.json")
    assert doc["removed_row_indices"]["count"] == 44
    assert doc["test_twins"]["removed_row_indices"]["count"] == 40
    ts = doc["per_set"]["hosp-test"]["eval_rows_with_template_sibling"]
    assert isinstance(ts, dict) and ts["count"] == 40
    # the audit file keeps every index
    audit = json.loads((tmp_path / "free.audit.json").read_text())
    assert len(audit["removed_row_indices"]) == 44
    assert len(audit["test_twins"]["removed_row_indices"]) == 40
    # the compact answer is a fraction of the full one
    full_code, full, err = _audit(capsys, ws_dir, corpus, "--clean-to",
                                  str(free), "--drop-test-twins",
                                  "--full-indices", "--overwrite")
    assert full_code == 0, err
    assert full["indices"] == {"summarized": False}
    assert len(full["removed_row_indices"]) == 44
    assert len(json.dumps(doc)) < len(json.dumps(full))
    # without --clean-to: summarized too, and --manifest keeps them in full
    man = tmp_path / "plain.audit.json"
    code, doc, err = _audit(capsys, ws_dir, corpus, "--manifest", str(man))
    assert code == 0, err
    assert doc["indices"]["full_lists"] == str(man)
    ts = json.loads(man.read_text())["per_set"]["hosp-test"][
        "eval_rows_with_template_sibling"]
    assert isinstance(ts, list) and len(ts) == 40


def test_the_workspace_is_untouched_by_a_refusal(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    clean = tmp_path / "corpus.clean.jsonl"
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))[0] == 0
    before = len(Workspace(ws_dir).ledger.entries())
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean),
                  "--drop-test-twins")[0] == 2
    assert len(Workspace(ws_dir).ledger.entries()) == before, \
        "a refused audit reads nothing (no audit read is ledgered)"




# -- 7. the two-model state ----------------------------------------------------

def test_preflight_names_the_two_model_state_instead_of_a_fix(tmp_path,
                                                              capsys,
                                                              monkeypatch):
    from nmt_forge.advisor import preflight

    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)
    clean = tmp_path / "corpus.clean.jsonl"
    assert _audit(capsys, ws_dir, corpus, "--clean-to", str(clean))[0] == 0
    assert _run(capsys, "--workspace", ws_dir, "split", str(clean), "--test",
                "0", "--dev", "10", "--seed", "1", "--out",
                str(tmp_path / "data" / "split"), "--register",
                "project")[0] == 0
    monkeypatch.chdir(tmp_path)
    ws = Workspace(ws_dir)
    before = {g.name: g for g in preflight(ws, "run", "config.json")}
    g = before["test-near-twins"]
    assert g.warning and "--drop-test-twins" in g.fix   # no companion yet
    # the twin-free companion is written: the all-data warning changes
    assert _audit(capsys, ws_dir, corpus, "--clean-to",
                  str(tmp_path / "corpus.notwins.jsonl"),
                  "--drop-test-twins")[0] == 0
    gates = {g.name: g for g in preflight(ws, "run", "config.json")}
    g = gates["test-near-twins"]
    assert g.ok and g.warning
    assert "ALL-DATA model of the two-model route" in g.detail
    assert "recall of training phrases" in g.detail
    assert "config-notwins.json" in g.detail
    assert "quote its score beside this one, never this one alone" in g.detail
    assert "--drop-test-twins" not in g.fix
    assert g.fix == ("train the twin-free model too: nmt-forge preflight run "
                     "--config config-notwins.json && nmt-forge run "
                     "config-notwins.json")
    # the twin-free config itself: no near-twins, no two-model talk
    free = {g.name: g for g in preflight(ws, "run", "config-notwins.json")}
    assert not free["test-near-twins"].warning
    assert "two-model" not in free["test-near-twins"].detail


# -- 16. a split the config does not read --------------------------------------

def test_split_to_another_out_says_the_config_misses_it(tmp_path, capsys,
                                                        monkeypatch):
    from nmt_forge.advisor import preflight

    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    _project_config(tmp_path, ws_dir)          # gold: data/split/train.jsonl
    code, out, err = _run(capsys, "--workspace", ws_dir, "split", str(corpus),
                          "--test", "0", "--dev", "10", "--seed", "1",
                          "--out", str(tmp_path / "data"), "--register",
                          "project", "--json")
    assert code == 0, err
    c = json.loads(out)["config_check"]
    assert c["ok"] is False
    assert c["missing"] == ["data/split/train.jsonl"]
    assert c["wrote"] == "data/train.jsonl"
    assert c["fix"] == ('in config.json set data.gold to ["data/train.jsonl"] '
                        'and eval.near_dupe_corpus to "data/train.jsonl", or '
                        "carve again with --out data/split (the path "
                        "config.json names)")
    code, text, err = _run(capsys, "--workspace", ws_dir, "split", str(corpus),
                           "--test", "0", "--dev", "10", "--seed", "1",
                           "--out", str(tmp_path / "data"), "--register",
                           "project")
    assert "⚠ config.json trains on data/split/train.jsonl, which does not " \
        "exist" in text
    # preflight's training-data gate names the same file
    monkeypatch.chdir(tmp_path)
    g = {g.name: g for g in preflight(Workspace(ws_dir), "run",
                                      "config.json")}["training-data"]
    assert not g.ok
    assert 'set config data.gold to ["data/train.jsonl"]' in g.fix
    # the default --out: nothing to say
    code, out, err = _run(capsys, "--workspace", ws_dir, "split", str(corpus),
                          "--test", "0", "--dev", "10", "--seed", "1",
                          "--out", str(tmp_path / "data" / "split"),
                          "--register", "project", "--allow-rotate", "--json")
    assert code == 0, err
    assert json.loads(out)["config_check"]["ok"] is True


# -- 17. preflight and run apply the same gates ---------------------------------

def _pf_project(tmp_path, *, dev_rows, gold_rows, test_rows=None,
                max_new_tokens=256):
    ws = Workspace(tmp_path / ".forge")
    dev = write_jsonl(tmp_path / "dev.jsonl", dev_rows)
    ws.registry.register("project-dev", dev, "dev")
    if test_rows:
        test = write_jsonl(tmp_path / "test.jsonl", test_rows)
        ws.registry.register("project-test", test, "test")
    gold = write_jsonl(tmp_path / "train.jsonl", gold_rows)
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "pf", "workspace": str(tmp_path / ".forge"),
        "data": {"gold": [str(gold)], "dev": "project-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": max_new_tokens}}))
    return ws, cfg


def _gold(n=12):
    return [{"source": f"gol{i} ab cd", "target": f"tar{i} ef gh"}
            for i in range(n)]


def test_preflight_refuses_the_headroom_run_refuses(tmp_path):
    import pytest

    from nmt_forge.advisor import preflight
    from nmt_forge.errors import GenerationHeadroomError
    from nmt_forge.training.run import run

    long_ref = " ".join(f"w{i}" for i in range(200))       # 200 tokens (dummy)
    ws, cfg = _pf_project(
        tmp_path, gold_rows=_gold(),
        dev_rows=[{"source": "dev one", "target": long_ref},
                  {"source": "dev two", "target": "short ref"}])
    g = {g.name: g for g in preflight(ws, "run", cfg)}["generation-headroom"]
    assert not g.ok
    assert "max_new_tokens=256 but the longest reference is 200 tokens" in \
        g.detail
    assert "raise decode.max_new_tokens to ≥ 300" in g.fix
    with pytest.raises(GenerationHeadroomError, match="need ≥ 300"):
        run(cfg)
    # raised to the bound: both pass
    raw = json.loads(cfg.read_text())
    raw["decode"]["max_new_tokens"] = 300
    cfg.write_text(json.dumps(raw))
    g = {g.name: g for g in preflight(ws, "run", cfg)}["generation-headroom"]
    assert g.ok and "300 ≥ 300" in g.detail


def test_preflight_refuses_the_leak_run_refuses(tmp_path):
    import pytest

    from nmt_forge.advisor import preflight
    from nmt_forge.errors import LeakageError
    from nmt_forge.training.run import run

    test_rows = [{"source": f"tst{i} qq rr", "target": f"ans{i} ss tt"}
                 for i in range(5)]
    leaky = _gold() + [{"source": "anything at all", "target": "ans1 ss tt"}]
    ws, cfg = _pf_project(tmp_path, gold_rows=leaky, test_rows=test_rows,
                          dev_rows=[{"source": "dv a", "target": "dv b"}])
    gates = {g.name: g for g in preflight(ws, "run", cfg)}
    g = gates["leak-audit"]
    assert not g.ok and not g.warning
    assert "run would refuse: corpus leaks into 1 test/sealed set(s)" in \
        g.detail
    assert "nmt-forge leak-audit <file> --clean-to" in g.fix
    with pytest.raises(LeakageError):
        run(cfg)


def test_a_green_preflight_is_a_run_that_starts(tmp_path):
    from nmt_forge.advisor import preflight
    from nmt_forge.training.run import run

    ws, cfg = _pf_project(tmp_path, gold_rows=_gold(),
                          dev_rows=[{"source": "dv a", "target": "dv b c"}])
    gates = preflight(ws, "run", cfg)
    assert all(g.ok for g in gates), [g.to_json() for g in gates if not g.ok]
    names = {g.name for g in gates}
    assert {"leak-audit", "training-mix", "generation-headroom",
            "dev-fence"} <= names
    run(cfg)        # the dummy backend trains in a moment


def test_the_dev_fence_gate_checks_content_like_run(tmp_path):
    from nmt_forge.advisor import preflight

    test_rows = [{"source": f"tst{i} qq", "target": f"ans{i} ss"}
                 for i in range(3)]
    ws, cfg = _pf_project(tmp_path, gold_rows=_gold(), test_rows=test_rows,
                          dev_rows=[{"source": "tst1 qq", "target": "x y"}])
    g = {g.name: g for g in preflight(ws, "run", cfg)}["dev-fence"]
    assert not g.ok
    assert "overlaps registered test set 'project-test'" in g.detail


# -- 9. the prereg says which model it judges, when it is written ---------------

def test_prereg_new_names_the_export_flag(tmp_path, capsys):
    from tests.test_private_text import _registered

    ws_dir, tsv, entry = _registered(tmp_path, capsys)
    preds = tmp_path / "p.json"
    preds.write_text(json.dumps([{"metric": "chrf++", "expect": "low",
                                  "rationale": "x"}]))
    code, out, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                          "all-data", "--eval-set", "project-test",
                          "--predictions", str(preds), "--json")
    assert code == 0, err
    doc = json.loads(out)
    assert doc["export_with"] == "--prereg all-data"
    assert doc["binding_preregs"] == ["all-data"]
    assert "name each preregistration after the model it predicts" in \
        doc["model_note"]
    assert "refuses without --prereg" not in doc["model_note"]
    code, text, err = _run(capsys, "--workspace", ws_dir, "prereg", "new",
                           "notwins", "--eval-set", "project-test",
                           "--predictions", str(preds))
    assert code == 0, err
    assert "model: name each preregistration after the model it predicts " \
        "('notwins' here)" in text
    assert "--prereg notwins --out <dir>" in text
    assert "2 preregistrations now bind 'project-test' (all-data, notwins): " \
        "export refuses without --prereg" in text


# -- 12 + 18. DEPLOY.md: no needless key; the way into a contest ----------------

def test_deploy_md_key_and_contest_section(hf_export):
    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    assert "any value without one" not in deploy
    assert "No key is needed for the server started above" in deploy
    assert "export CHAMPOLLION_API_KEY=<that\ntoken>" in deploy \
        or "export CHAMPOLLION_API_KEY=<that token>" in deploy
    assert '"apiKey": "${YOUR_VAR}"' in deploy
    sec = deploy.split("## 6. Enter it in a sovereign contest (Lane A)")[1]
    assert "`config.json generation_config.json model.safetensors " \
        "tokenizer.json tokenizer_config.json`" in sec
    assert "Leave out `forge-model.json`" in sec
    assert "mt-eval contest submit-model <contest-id> --model-dir lane-a" in sec
    # the stand-in weights have no readable header: said, never guessed
    assert "--parameter-count <the count the weights file stores>" in sec
    assert "--architecture <config.json architectures[0]>" in sec


def test_contest_section_reads_the_real_files(tmp_path):
    import struct

    from nmt_forge.export import contest_section, safetensors_parameter_count

    header = json.dumps({"__metadata__": {"format": "pt"},
                         "a": {"dtype": "F32", "shape": [2, 3],
                               "data_offsets": [0, 24]},
                         "b": {"dtype": "F32", "shape": [4],
                               "data_offsets": [24, 40]}}).encode()
    w = tmp_path / "model.safetensors"
    w.write_bytes(struct.pack("<Q", len(header)) + header + b"\0" * 40)
    assert safetensors_parameter_count(w) == 10
    (tmp_path / "config.json").write_text(json.dumps(
        {"architectures": ["MarianMTModel"]}))
    sec = contest_section(tmp_path, ["DEPLOY.md", "champollion-plugin",
                                     "config.json", "forge-model.json",
                                     "model.safetensors"])
    assert "`config.json model.safetensors`" in sec
    assert "--architecture MarianMTModel" in sec
    assert "--parameter-count 10" in sec
    assert "`10` is the count `model.safetensors` stores" in sec
    assert "cp " in sec and "forge-model.json lane-a" not in sec
    assert "no safetensors weights" in contest_section(tmp_path, ["config.json"])


# -- 14. the public index may lack what the full card cites ----------------------

def test_discover_from_the_public_index_says_it_may_lack_resources(
        monkeypatch, fixture_cards):
    from nmt_forge import cards

    card, _ = cards.resolve_card("qaa", fixture_cards)
    bare = {k: v for k, v in card.items()
            if k not in ("encyclopedic", "lexicalResources", "resources",
                         "documentation")}
    monkeypatch.setattr(cards, "resolve_card", lambda code, path=None: (
        bare, f"{cards.PUBLIC_INDEX_SOURCE} (Champollion trading_card_detail, "
              "code=qaa; via mt-eval-harness)"))
    r = cards.discover("qaa", check_registry=False)
    assert "dictionaries" in r.unknowns
    assert "the public card index, which can lack resources the full card " \
        "cites" in r.unknowns_note
    assert "champollion network card qaa --json > cards/qaa.json" in \
        r.unknowns_note
    assert "note: this card came from the public card index" in \
        cards.format_report(r)
    # a card read from a directory: no such note
    monkeypatch.undo()
    r2 = cards.discover("qaa", fixture_cards, check_registry=False)
    assert r2.unknowns_note is None


# -- 15. both pair notations; nothing replaced silently ---------------------------

def test_init_pair_accepts_both_notations_and_refuses_the_rest(tmp_path,
                                                               fixture_cards):
    import pytest

    from nmt_forge.errors import ForgeError
    from nmt_forge.scaffold import init_project, parse_pair

    assert parse_pair("eng-crk") == ("eng", "crk")
    assert parse_pair("eng>crk") == ("eng", "crk")
    assert parse_pair(" fra → qaa ") == ("fra", "qaa")
    assert parse_pair("eng->crk") == ("eng", "crk")
    for bad in ("crk", "eng>", "crk-Cans-x", "eng>crk>fra"):
        with pytest.raises(ForgeError, match="is not a language pair"):
            parse_pair(bad)
    s = init_project("qaa", tmp_path / "p", pair="fra>qaa",
                     cards_path=fixture_cards)
    cfg = json.loads((tmp_path / "p" / "config.json").read_text())
    assert (cfg["language"]["source"], cfg["language"]["target"]) == \
        ("fra", "qaa")
    assert s["language"]["code"] == "qaa"
    with pytest.raises(ForgeError):
        init_project("qaa", tmp_path / "q", pair="fra_qaa",
                     cards_path=fixture_cards)
    assert not (tmp_path / "q").exists(), "refused before anything is written"


def test_export_declares_the_decode_length_it_measured_with(tmp_path):
    from nmt_forge.export import declare_decode_length

    gen = tmp_path / "generation_config.json"
    gen.write_text(json.dumps({"_from_model_config": True,
                               "decoder_start_token_id": 0}))
    d = declare_decode_length(tmp_path, 384)
    assert d["max_new_tokens"] == 384
    written = json.loads(gen.read_text())
    assert written["max_new_tokens"] == 384
    assert written["_from_model_config"] is False
    assert written["decoder_start_token_id"] == 0
    # a length the model already declares is the author's choice: kept
    gen.write_text(json.dumps({"max_length": 128}))
    assert declare_decode_length(tmp_path, 384) is None
    assert json.loads(gen.read_text()) == {"max_length": 128}
    # nothing to write into: nothing written
    gen.unlink()
    assert declare_decode_length(tmp_path, 384) is None
    assert not gen.exists()


def test_the_hf_export_declares_it(hf_export):
    gen = json.loads((hf_export["out"] / "model" /
                      "generation_config.json").read_text())
    assert gen["max_new_tokens"] > 0
    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    assert "`generation_config.json` declares `max_new_tokens`" in deploy
