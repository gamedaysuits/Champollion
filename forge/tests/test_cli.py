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
        "--out", str(tmp_path / "split"), "--register", "toy",
    )
    assert code == 0
    manifest = json.loads(out)
    assert manifest["verified"].startswith("0 shared")

    code, out, _ = _run(capsys, "--workspace", ws_dir, "registry", "list")
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
                        str(corpus))
    assert code == 0 and json.loads(out)["per_set"]["ev"]["exact_source"] == 1
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
                        "--set", "ev")
    assert code == 0 and json.loads(out)["set"] == "ev"
