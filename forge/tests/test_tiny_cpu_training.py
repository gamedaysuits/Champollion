"""The CPU path, for real: a TINY transformer trained from scratch, exported,
and served to the champollion api contract — in CI time, no download.

This is the north-star loop at toy scale ("a Cree model for our school" on a
laptop): split → preregister → `run` (hf-scratch) → `export` (prereg-gated
test score + mt-eval TestReport + self-contained model) → `serve` →
`POST /translate` — then the cpu-finetune path (`hf-seq2seq` on a pretrained
base: here the model just exported, so nothing is downloaded). The model is a few thousand parameters and learns almost
nothing; what is tested is that every step is REAL — real tokenizer trained
on the train side only, real Seq2SeqTrainer on CPU, real checkpoint
selection by a dev generation metric, real decode from the exported files.

It runs in a SUBPROCESS with a clean PYTHONPATH: the suite is often invoked
with PYTHONPATH=../arena, which exposes arena/datasets/ as a fake
`datasets` package that crashes the Hugging Face Trainer — exactly the
environment forge itself must not depend on.

Skipped (with the install command) when the [hf] extra is absent.
"""

import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

FORGE_DIR = Path(__file__).resolve().parents[1]
_NEEDED = ("torch", "transformers", "accelerate", "tokenizers")
_MISSING = [m for m in _NEEDED if importlib.util.find_spec(m) is None]

pytestmark = pytest.mark.skipif(
    bool(_MISSING),
    reason=f"needs the [hf] extra ({', '.join(_MISSING)} missing): "
           "pip install 'nmt-forge[hf]'")

SCRIPT = r'''
import json, sys, threading, urllib.request
from pathlib import Path
from nmt_forge.cli import main

def run(*argv):
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = main(list(argv) + ["--json"])
    text = buf.getvalue()
    if code != 0:
        print(text, file=sys.stderr)
        raise SystemExit(f"{argv[:2]} exited {code}")
    return json.loads(text)

nouns = ["zub", "kef", "mol", "tav", "rin", "gesh", "pom", "lud", "sav", "nek"]
verbs = [("I see the", "niwap"), ("I hear the", "nipet"), ("I feed the", "nitas")]
adjs = [("big", "misi"), ("small", "apis"), ("old", "kise"), ("new", "oski")]
rows = [{"source": f"{ve} {ae} {n}", "target": f"{vc} {ac}-{n}"}
        for ve, vc in verbs for ae, ac in adjs for n in nouns]
Path("corpus.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")

split = run("split", "corpus.jsonl", "--test", "20", "--dev", "20",
            "--seed", "3", "--out", "data/split", "--register", "project")
Path("predictions.json").write_text(json.dumps([
    {"metric": "chrf++", "expect": "low — a toy model", "rationale": "CI smoke"},
    {"metric": "chrf++", "direction": "increase", "baseline_score": 0.0,
     "margin": 0.0, "rationale": "chrF++ is never below zero"}]))
run("prereg", "new", "p1", "--eval-set", "project-test",
    "--predictions", "predictions.json")
Path("config.json").write_text(json.dumps({
    "run_name": "tiny", "workspace": ".forge",
    "language": {"source": "eng", "target": "qaa", "target_name": "Toylang"},
    "data": {"gold": ["data/split/train.jsonl"], "dev": "project-dev"},
    "mix": {"gold_upweight": 1, "kind_cap": None, "seed": 1},
    "model": {"backend": "hf-scratch", "device": "cpu", "vocab_size": 120,
              "d_model": 32, "layers": 1, "heads": 2, "ffn_dim": 64,
              "max_len": 64, "lr": 3e-3, "epochs": 3, "batch_size": 16,
              "grad_accum": 1, "time_budget_hours": 1, "seed": 1},
    "selection": {"metric": "generation:chrf++", "top_k": 2},
    "decode": {"max_new_tokens": 48},
    "eval": {"battery": "project-test", "n_bootstrap": 50,
             "near_dupe_corpus": "data/split/train.jsonl"},
}))
pre = run("preflight", "run", "--config", "config.json")
trained = run("run", "config.json")
exported = run("export", trained["manifest"], "--out", "export")

from nmt_forge.serve import build_server
httpd, model = build_server("export/model", port=0)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
req = urllib.request.Request(
    f"http://127.0.0.1:{httpd.server_address[1]}/translate",
    data=json.dumps({"source_locale": "en", "target_locale": "qaa",
                     "keys": {"a": "I see the big zub",
                              "b": "I feed the old kef"}}).encode(),
    headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as r:
    served = json.loads(r.read())
# app strings with placeholders + the CLI's content block-batch prompt,
# through the REAL model: the structure must come back, whatever it says
req = urllib.request.Request(
    f"http://127.0.0.1:{httpd.server_address[1]}/translate",
    data=json.dumps({"source_locale": "en", "target_locale": "qaa",
                     "keys": {"p": "I see the big zub: {name}",
                              "icu": "{n, plural, one {# old kef} other {# old kefs}}"}}).encode(),
    headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as r:
    served_placeholders = json.loads(r.read())
req = urllib.request.Request(
    f"http://127.0.0.1:{httpd.server_address[1]}/v1/chat/completions",
    data=json.dumps({"messages": [{"role": "user", "content":
        "You are translating Markdown content. Rules: echo markers.\n\n"
        "⟦SEG_0⟧\n# I see the big zub\n\n⟦SEG_1⟧\n- I feed the old kef\n"
        "- I hear the new mol"}]}).encode(),
    headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as r:
    served_markdown = json.loads(r.read())["choices"][0]["message"]["content"]
httpd.shutdown()
checked = run("prereg", "check", "p1")      # no --results: the ledger's export

# the cpu-finetune path (hf-seq2seq on a PRETRAINED base), without a
# download: fine-tune the model we just exported, as if it were an opus-mt
cfg = json.loads(Path("config.json").read_text())
cfg["run_name"] = "tiny-finetune"
cfg["model"] = {"backend": "hf-seq2seq", "base": str(Path("export/model").resolve()),
                "device": "cpu", "lr": 1e-3, "epochs": 2, "batch_size": 16,
                "grad_accum": 1, "max_src": 64, "max_tgt": 64,
                "time_budget_hours": 1, "seed": 1}
Path("config-ft.json").write_text(json.dumps(cfg))
finetuned = run("run", "config-ft.json")
print(json.dumps({"split": split, "preflight": pre, "run": trained,
                  "export": exported, "served": served,
                  "served_placeholders": served_placeholders,
                  "served_markdown": served_markdown, "checked": checked,
                  "finetuned": finetuned}))
'''


def test_tiny_scratch_model_trains_exports_and_serves_on_cpu(tmp_path):
    cards = tmp_path / "cards"
    cards.mkdir()
    # the one card the export needs, as `champollion network card eng --json` writes it
    (cards / "eng.json").write_text(json.dumps(
        {"code": "eng", "name": "English", "iso639_1": "en",
         "aliases": ["en"]}))
    (cards / "qaa.json").write_text(json.dumps(
        {"code": "qaa", "name": "Toylang"}))
    env = {k: v for k, v in os.environ.items()
           if k not in ("PYTHONPATH", "MT_EVAL_CARDS_DIR",
                        "CHAMPOLLION_CARDS_DIR")}
    env.update(PYTHONPATH=str(FORGE_DIR), NMT_FORGE_NO_MONITOR="1",
               MT_EVAL_CARDS_DIR=str(cards), TOKENIZERS_PARALLELISM="false",
               HF_HUB_OFFLINE="1")
    res = subprocess.run([sys.executable, "-c", SCRIPT], cwd=tmp_path, env=env,
                         capture_output=True, text=True, timeout=600)
    assert res.returncode == 0, res.stderr[-4000:]
    out = json.loads(res.stdout.strip().splitlines()[-1])

    assert all(g["ok"] for g in out["preflight"]), out["preflight"]
    run = out["run"]
    assert run["backend"] == "hf-scratch"
    assert "chrf++" in run["dev_report"]["scores"]          # CIs, always
    assert "ci_lower" in run["dev_report"]["scores"]["chrf++"]
    manifest = json.loads(Path(run["manifest"]).read_text())
    tok = manifest["stages"][0]["backend_info"]["tokenizer"]
    assert tok["trained_on"].startswith("TRAIN rows only")
    assert tok["train_rows"] == len(json.loads(
        "[" + ",".join((tmp_path / "data/split/train.jsonl")
                       .read_text().splitlines()) + "]"))

    exp = out["export"]
    assert exp["evaluated"] and exp["model_included"]
    model_dir = Path(tmp_path / exp["model_dir"]) if not Path(
        exp["model_dir"]).is_absolute() else Path(exp["model_dir"])
    names = {p.name for p in model_dir.iterdir()}
    assert "config.json" in names and "tokenizer.json" in names
    assert not names & {"optimizer.pt", "trainer_state.json"}  # deploy only
    # the deployable directory: weights, tokenizer, settings, card — the
    # test set's RunLog/TestReport live in export/evaluation/, never here
    assert {"forge-model.json", "DEPLOY.md", "champollion-plugin"} <= names
    assert not names & {"runlog.json", "runlog_report.json", "harness",
                        "eval", "evaluation"}
    assert Path(exp["harness_report"]).parent.name == "evaluation"
    report = json.loads((tmp_path / exp["harness_report"]).read_text()
                        if not Path(exp["harness_report"]).is_absolute()
                        else Path(exp["harness_report"]).read_text())
    assert "corpus_chrf" in report["overall"]
    method = json.loads((tmp_path / "export" / "model" / "champollion-plugin"
                         / "method.json").read_text())
    assert method["type"] == "api" and method["endpoint"].endswith("/translate")
    assert method["locales"] == ["qaa"]

    served = out["served"]
    assert set(served["translations"]) == {"a", "b"}
    assert all(isinstance(v, str) for v in served["translations"].values())

    # item 2: placeholders and the ICU skeleton survive the real model
    tr = out["served_placeholders"]["translations"]
    # (what the toy model SAYS may be anything, even empty; the structure is
    # the guarantee)
    assert tr["p"].endswith(" {name}") and tr["p"].count("{") == 1
    assert re.fullmatch(r"\{n, plural, one \{# [^{}#]*\} "
                        r"other \{# [^{}#]*\}\}", tr["icu"]), tr["icu"]
    # item 1: the CLI's block-batch prompt comes back block for block
    md = out["served_markdown"]
    assert re.fullmatch(r"⟦SEG_0⟧\n# [^\n]*\n\n⟦SEG_1⟧\n- [^\n]*\n- [^\n]*",
                        md), md

    # items 3 + 4: export carries the prereg verdicts and the near-twin
    # reading — in its summary, forge-model.json, DEPLOY.md, the TestReport
    verdicts = {r["predicted"]: r["verdict"] for r in exp["prereg"]["verdicts"]}
    assert verdicts == {"low — a toy model": "manual", "increase": "held"}
    assert out["checked"] == exp["prereg"]["verdicts"]
    nt = exp["near_twin"]
    assert nt["checked"] and nt["n"] == 20 and nt["message"]
    fm = json.loads((tmp_path / "export" / "model" / "forge-model.json")
                    .read_text())
    assert fm["test_report"]["near_twin"] == nt
    assert fm["test_report"]["prereg"]["id"] == "p1"
    deploy = (tmp_path / "export" / "model" / "DEPLOY.md").read_text()
    head = deploy.split("## 1. Serve it")[0]
    assert "## What was measured" in head and "Test set `project-test`" in head
    assert nt["message"][1:40] in head
    assert "Preregistered predictions (`p1`): 1 held" in head
    assert "## 3. What `serve` protects" in deploy
    assert "--redo keys:" in deploy and "--method <method>" in deploy
    assert report["overall"]["nmt_forge_near_twin_rows"] == nt["near_twin_rows"]
    assert report["overall"]["nmt_forge_score_caveat"] == nt["message"]

    ft = out["finetuned"]
    assert ft["backend"] == "hf-seq2seq"
    assert "chrf++" in ft["dev_report"]["scores"]
    # the fine-tuned checkpoint carries its tokenizer (offline, exportable)
    assert (Path(ft["selected_path"]) / "tokenizer.json").is_file()
