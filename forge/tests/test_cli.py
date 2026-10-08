import json

from nmt_forge.cli import main
from tests.conftest import toy_pairs, write_jsonl


def _run(capsys, *argv):
    code = main(list(argv))
    out = capsys.readouterr()
    return code, out.out, out.err


def test_split_register_score_flow(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    corpus = write_jsonl(tmp_path / "corpus.jsonl", toy_pairs(40))

    code, out, _ = _run(
        capsys, "--workspace", ws_dir, "split", str(corpus),
        "--test", "10", "--dev", "5", "--seed", "42",
        "--out", str(tmp_path / "split"), "--register", "toy", "--json",
    )
    assert code == 0
    manifest = json.loads(out)
    assert manifest["verified"].startswith("0 shared")

    code, out, _ = _run(capsys, "--workspace", ws_dir, "registry", "list",
                        "--json")
    assert code == 0
    reg = json.loads(out)
    assert reg["toy-test"]["role"] == "test" and reg["toy-dev"]["role"] == "dev"

    # scoring the test set without a prereg refuses (exit 2, fix on stderr)
    dev_rows = [json.loads(l) for l in (tmp_path / "split" / "test.jsonl")
                .read_text().splitlines()]
    hyps = tmp_path / "hyps.txt"
    hyps.write_text("\n".join(r["target"] for r in dev_rows))
    code, out, err = _run(capsys, "--workspace", ws_dir, "score",
                          "--eval-set", "toy-test", "--hyps", str(hyps))
    assert code == 2 and "preregister" in err

    preds = tmp_path / "preds.json"
    preds.write_text(json.dumps(
        [{"metric": "chrf++", "expect": "high", "rationale": "identity"}]))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "prereg", "new", "p1",
                        "--eval-set", "toy-test", "--predictions", str(preds))
    assert code == 0

    code, out, _ = _run(capsys, "--workspace", ws_dir, "score",
                        "--eval-set", "toy-test", "--hyps", str(hyps))
    assert code == 0 and "95% CI" in out


def test_evaluate_cli_closes_the_loop(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    # dev set (fence) + battery (test) + prereg, all via the CLI/library
    dev = write_jsonl(tmp_path / "dev.jsonl",
                      [{"source": f"d {i}", "reference": f"dref {i}"}
                       for i in range(6)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "toy-dev",
         str(dev), "--role", "dev")
    battery = write_jsonl(tmp_path / "battery.jsonl",
                          [{"id": f"b-{i}", "register": "textbook",
                            "source": f"s {i}", "reference": f"r {i} tok"}
                           for i in range(8)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "battery",
         str(battery), "--role", "test")
    preds = tmp_path / "preds.json"
    preds.write_text(json.dumps(
        [{"metric": "chrf++", "expect": "table", "rationale": "acc"}]))
    _run(capsys, "--workspace", ws_dir, "prereg", "new", "bp",
         "--eval-set", "battery", "--predictions", str(preds))

    gold = write_jsonl(tmp_path / "gold.jsonl",
                       [{"source": f"g {i}", "target": f"gt {i}"}
                        for i in range(6)])
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "cli-eval", "workspace": ws_dir,
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy"}, "selection": {"metric": "loss"},
        "decode": {"max_new_tokens": 32},
        "eval": {"battery": "battery", "by": "register", "n_bootstrap": 40},
    }))
    code, out, _ = _run(capsys, "--workspace", ws_dir, "run", str(cfg))
    assert code == 0
    # run prints [schedule-sanity] lines, then a JSON block, then the dev report
    start = out.index("{")
    man = json.loads(out[start:out.index("}", start) + 1])["manifest"]
    # --json: exactly one JSON document on stdout; the schedule chatter is
    # on stderr
    code, out_json, err = _run(capsys, "--workspace", ws_dir, "run",
                               str(cfg), "--json")
    assert code == 0
    payload = json.loads(out_json)
    assert payload["manifest"] == man and "dev_report" in payload
    assert "[schedule-sanity]" in err

    code, out, _ = _run(capsys, "evaluate", man, "--config", str(cfg))
    assert code == 0
    assert "Diagnosis" in out or "95% CI" in out or "textbook" in out
    assert "wrote" in out


def test_verify_split_cli_detects_leak(tmp_path, capsys):
    a = write_jsonl(tmp_path / "train.jsonl",
                    [{"source": "feed him", "target": "asamtoy"}])
    b = write_jsonl(tmp_path / "test.jsonl",
                    [{"source": "feed her", "target": "asamtoy"}])
    code, _, err = _run(capsys, "verify-split", str(a), str(b))
    assert code == 2 and "split-guard" in err

    c = write_jsonl(tmp_path / "test2.jsonl",
                    [{"source": "other thing", "target": "different"}])
    code, out, _ = _run(capsys, "verify-split", str(a), str(c))
    assert code == 0 and "OK" in out


def test_leak_audit_cli_strict(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    ev = write_jsonl(tmp_path / "ev.jsonl",
                     [{"source": f"the tozer {i} clearly", "reference": f"tozka{i}"}
                      for i in range(4)])
    _run(capsys, "--workspace", ws_dir, "registry", "add", "ev", str(ev),
         "--role", "test")
    corpus = write_jsonl(tmp_path / "corpus.jsonl",
                         toy_pairs(10) + [{"source": "the tozer 1 clearly",
                                           "target": "x"}])
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--json")
    assert code == 0 and json.loads(out)["per_set"]["ev"]["exact_source"] == 1
    # human rendering: what would be dropped, and why
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus))
    assert code == 0 and "DROPPED by --clean-to: 1 row" in out
    assert "identical PROMPT" in out
    code, _, err = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--strict")
    assert code == 2 and "leak-audit" in err


def test_discover_and_init_cli(tmp_path, capsys):
    from tests.test_cards import _write_card

    cards = tmp_path / "cards"
    _write_card(cards, "qaa", {
        "name": "Toylang A", "dir": "ltr",
        "scripts": [{"code": "Latn", "name": "Latin", "primary": True}],
        "resources": {"fsts": [{"name": "Toy FST",
                                "type": "morphological-analyzer"}]},
        "corpusAvailability": {"opus": {"corpora": 2}},
        "evalMetrics": {"toy-eq": {"module": "toy.metrics", "class": "ToyLinter"}},
        "evalStandard": {"pip": "toy-lyss"},
    })
    code, out, _ = _run(capsys, "discover", "qaa", "--cards-dir", str(cards),
                        "--no-registry")
    assert code == 0
    assert "ASSET LADDER" in out and "--plugin toy.metrics:ToyLinter" in out

    code, out, _ = _run(capsys, "init", "qaa", "--dir", str(tmp_path / "proj"),
                        "--cards-dir", str(cards))
    assert code == 0
    assert (tmp_path / "proj" / "NEXT_STEPS.md").exists()
    assert json.loads((tmp_path / "proj" / "config.json").read_text())[
        "language"]["target"] == "qaa"

    # unknown code: actionable, exit 2
    code, _, err = _run(capsys, "discover", "qzz", "--cards-dir", str(cards),
                        "--no-registry")
    assert code == 2 and "ISO 639-3" in err


def test_ledger_cli(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    ev = write_jsonl(tmp_path / "ev.jsonl",
                     [{"source": "a b c", "reference": "d e f"}] * 2)
    _run(capsys, "--workspace", ws_dir, "registry", "add", "ev", str(ev),
         "--role", "dev")
    code, out, _ = _run(capsys, "--workspace", ws_dir, "ledger", "verify")
    assert code == 0 and "intact" in out
    code, out, _ = _run(capsys, "--workspace", ws_dir, "ledger", "show",
                        "--set", "ev", "--json")
    assert code == 0 and json.loads(out)["set"] == "ev"


def test_resplit_conflict_refuses_before_writing_and_allow_rotate_rotates(
        tmp_path, capsys):
    """Round 5 (hospital): after leak-audit --clean-to, re-running split
    --register was refused because the dev set was already registered — but
    the refused split had ALREADY overwritten data/split/*, and its fix named
    a Python argument (allow_rotate=True) no CLI/MCP caller can pass."""
    ws_dir = str(tmp_path / ".forge")
    out_dir = tmp_path / "split"
    corpus = write_jsonl(tmp_path / "corpus.jsonl", toy_pairs(40))
    code, _, _ = _run(capsys, "--workspace", ws_dir, "split", str(corpus),
                      "--test", "0", "--dev", "6", "--seed", "1",
                      "--out", str(out_dir), "--register", "hosp")
    assert code == 0
    before = {p.name: p.read_bytes() for p in out_dir.iterdir()}
    # the dev set gets read (checkpoint selection) before the re-split
    from nmt_forge.workspace import Workspace
    Workspace(ws_dir).registry.open_eval("hosp-dev", "dev-selection")

    # a different corpus (the cleaned one): the dev carve changes
    cleaned = write_jsonl(tmp_path / "clean.jsonl", toy_pairs(30, "kept"))
    code, out, err = _run(capsys, "--workspace", ws_dir, "split", str(cleaned),
                          "--test", "0", "--dev", "6", "--seed", "1",
                          "--out", str(out_dir), "--register", "hosp",
                          "--json")
    assert code == 2
    error = json.loads(out)["error"]
    assert "nothing was written" in error["message"]
    assert "1× for dev-selection" in error["message"]    # reads are named
    assert "--allow-rotate" in error["fix"]
    assert "allow_rotate: true" in error["fix"]          # the MCP parameter
    assert "allow_rotate=True" not in error["text"]      # never a Python arg
    after = {p.name: p.read_bytes() for p in out_dir.iterdir()}
    assert after == before, "a refused split must not touch the old files"

    code, out, _ = _run(capsys, "--workspace", ws_dir, "split", str(cleaned),
                        "--test", "0", "--dev", "6", "--seed", "1",
                        "--out", str(out_dir), "--register", "hosp",
                        "--allow-rotate", "--json")
    assert code == 0
    payload = json.loads(out)
    rot = payload["registered"][0]["rotated_from"]
    assert rot["reads_by_purpose"] == {"dev-selection": 1}
    ws = Workspace(ws_dir)
    ev = ws.ledger.find("rotate", set="hosp-dev")
    assert len(ev) == 1 and ev[0]["replaces"]["reads_by_purpose"] == {
        "dev-selection": 1}
    # the earlier read is still on record under the set's name
    assert ws.ledger.spend_report("hosp-dev")["reads_by_purpose"][
        "dev-selection"] == 1
    # the registry entry matches the file on disk again
    ws.registry.open_eval("hosp-dev", "inspect")


def test_split_refuses_to_overwrite_another_registered_file(tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    out_dir = tmp_path / "split"
    corpus = write_jsonl(tmp_path / "corpus.jsonl", toy_pairs(40))
    _run(capsys, "--workspace", ws_dir, "split", str(corpus), "--test", "0",
         "--dev", "6", "--seed", "1", "--out", str(out_dir),
         "--register", "a")
    old = (out_dir / "dev.jsonl").read_bytes()
    code, out, _ = _run(capsys, "--workspace", ws_dir, "split",
                        str(write_jsonl(tmp_path / "c2.jsonl",
                                        toy_pairs(30, "other"))),
                        "--test", "0", "--dev", "6", "--seed", "1",
                        "--out", str(out_dir), "--json")
    assert code == 2
    error = json.loads(out)["error"]
    assert "would overwrite the file registered as 'a-dev'" in error["message"]
    assert "--register a --allow-rotate" in error["fix"]
    assert (out_dir / "dev.jsonl").read_bytes() == old


def _twinned_project(tmp_path, capsys, n_test=20, leaks=4):
    """A fixed, registered test set whose every row has a template twin in
    the corpus, plus ``leaks`` exact copies (the Round 5 hospital shape)."""
    ws_dir = str(tmp_path / ".forge")
    test = [{"source": f"do you have pain{i} in your arm today",
             "target": f"abc pai{i} armka tu"} for i in range(n_test)]
    twins = [{"source": f"do you have pain{i} in your arm now",
              "target": f"abc pai{i} armka ne"} for i in range(n_test)]
    other = [{"source": f"take pill number {i} with water",
              "target": f"pil{i} wa ta"} for i in range(60)]
    test_path = write_jsonl(tmp_path / "test.jsonl", test)
    corpus = write_jsonl(tmp_path / "corpus.jsonl",
                         twins + test[:leaks] + other)
    _run(capsys, "--workspace", ws_dir, "registry", "add", "hosp-test",
         str(test_path), "--role", "test")
    return ws_dir, corpus


def test_leak_audit_leads_with_the_near_twin_verdict(tmp_path, capsys):
    """Round 5: the first audit reported only the leaking rows up top; the
    decisive "every test row has a twin" forecast sat at the bottom (and
    deep in ~600 lines of JSON), so the user only acted on it at split time.
    """
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--json")
    assert code == 0
    doc = json.loads(out)
    assert next(iter(doc)) == "verdict", "the verdict is the first key"
    v = doc["verdict"]
    assert v["severity"] == "severe"
    assert v["summary"].startswith("All 20 test rows of hosp-test have a "
                                   "near-twin in the training data")
    assert "4 row(s) would be dropped as leaks" in v["summary"]
    assert v["fix"].endswith("--drop-test-twins")
    assert "--clean-to" in v["fix"] and str(corpus) in v["fix"]
    assert v["numbers"]["test_rows_with_near_twin"]["hosp-test"] == {
        "n": 20, "near_twin_rows": 20, "strict_n": 0}
    assert "deploy" in v["decision"] and "report both" in v["decision"]

    code, text, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                         str(corpus), "--no-examples")
    lines = text.splitlines()
    verdict_at = next(i for i, l in enumerate(lines) if "VERDICT:" in l)
    dropped_at = next(i for i, l in enumerate(lines)
                      if l.startswith("DROPPED"))
    assert verdict_at < dropped_at, "the verdict is read before the details"
    assert "--drop-test-twins" in lines[verdict_at + 1]
    assert lines[-1].startswith("Next: nmt-forge leak-audit")


def test_leak_audit_says_a_re_audit_after_split_drops_the_dev_rows(
        tmp_path, capsys):
    ws_dir = str(tmp_path / ".forge")
    corpus = write_jsonl(tmp_path / "corpus.jsonl", toy_pairs(40))
    _run(capsys, "--workspace", ws_dir, "split", str(corpus), "--test", "0",
         "--dev", "6", "--seed", "1", "--out", str(tmp_path / "split"),
         "--register", "p")
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--json")
    v = json.loads(out)["verdict"]
    assert v["numbers"]["dev_set_rows_among_them"] == 6
    assert "6 of them your registered dev set's own rows" in v["summary"]
    assert v["audit_order"].startswith("audit BEFORE splitting")
    assert "--allow-rotate" in v["audit_order"]


def test_leak_audit_clean_to_twin_drop_verdict(tmp_path, capsys):
    ws_dir, corpus = _twinned_project(tmp_path, capsys)
    clean = tmp_path / "clean.jsonl"
    code, out, _ = _run(capsys, "--workspace", ws_dir, "leak-audit",
                        str(corpus), "--clean-to", str(clean),
                        "--drop-test-twins", "--json")
    assert code == 0
    doc = json.loads(out)
    v = doc["verdict"]
    assert v["severity"] == "clean" and v["fix"] is None
    assert v["summary"].startswith("Dropped 4 leaking row(s) and 20 "
                                   "near-twin row(s); 60 kept")
    assert "20 of 20 test rows now have no near-twin" in v["summary"]
    # the manifest file name the MCP tool description gives
    assert doc["manifest"] == str(tmp_path / "clean.audit.json")
    assert (tmp_path / "clean.audit.json").exists()
