"""``nmt-forge init`` — the amateur/agent front door.

Turns one language card into a ready-to-work project directory:

    project/
      .forge/            the workspace (registry, ledger, preregistrations)
      config.json        a starter run config PREFILLED from the card
                         (language block, LYSS plugin lanes when the card
                         declares a referee, sane guard defaults)
      NEXT_STEPS.md      the agent brief: what this language has, the asset
                         ladder, and the exact command order

The config deliberately points at eval-set names that DON'T EXIST YET
(``project-dev``/``project-test``) — running it before carving a split gets
the dev-fence's teaching refusal, which is the correct first lesson. The
scaffold never fetches data: corpora come from their sources, under their
terms (forge hosts nothing).
"""

from __future__ import annotations

import json
from pathlib import Path

from .cards import ResourceReport, discover, format_report
from .workspace import Workspace


def starter_config(report: ResourceReport, *, pair: str | None = None) -> dict:
    source, target = (pair.split("-", 1) if pair and "-" in pair
                      else ("eng", report.code))
    cfg: dict = {
        "run_name": f"{target}-baseline",
        "workspace": ".forge",
        "language": {
            "source": source,
            "target": target,
            "target_name": report.name,
            "direction": report.direction,
            "card": report.card_path,
        },
        "data": {
            "gold": ["data/split/train.jsonl"],
            "dev": "project-dev",
            "synthetic": [],
        },
        "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
        # schedule preset: auto-detects synthetic-heavy vs balanced from the
        # mix and derives the early-stop floor — never a magic flag
        "regime": "auto",
        "model": {"backend": "hf-seq2seq",
                  "base": "facebook/nllb-200-distilled-600M"},
        "selection": {"metric": "generation:chrf++", "top_k": 3},
        "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
    }
    specs = report.plugin_specs()
    if specs:
        cfg["selection"]["plugins"] = specs
        # prefer the language's own referee when the card declares one; the
        # first lane name is derived at run time — chrF++ stays the metric
        # until the user opts in, but the plugins are wired and reported
    return cfg


def next_steps(report: ResourceReport, cfg: dict) -> str:
    specs = report.plugin_specs()
    lines = [
        f"# Next steps — {report.name} ({report.code})",
        "",
        "This brief is written for you AND your agent. Everything below is",
        "honest to the language card (absence = unknown, never zero); every",
        "refusal you hit on the way explains itself with what/why/fix.",
        "",
        "## What this language has",
        "",
        "```",
        format_report(report),
        "```",
        "",
        "## The command order",
        "",
        "1. **Get a parallel corpus locally** (fetch from its source — forge",
        "   never hosts or redistributes corpus content). A corpus is a",
        "   `.jsonl` of `{\"source\": ..., \"target\": ...}` rows.",
        "2. **Carve an honest split** (group-disjoint; the dev slice drives",
        "   checkpoint selection so the test set never can):",
        "",
        "   ```bash",
        "   nmt-forge split corpus.jsonl --test 150 --dev 50 --seed 42 \\",
        "       --out data/split --register project",
        "   ```",
        "",
        "3. **Screen anything else you plan to train on** (harvests, mono",
        "   text): `nmt-forge leak-audit <file> --strict`",
        "4. **Train** — one command, everything manifested:",
        "   `nmt-forge run config.json`",
        "",
        "   **Monitoring a run (agents, read this):** launch `run` in the",
        "   background with output to a log file. Do NOT poll the log on a",
        "   timer — watch it for the only lines that matter:",
        "   `refused|Error|wall-clock|continuity|RUN EXIT`. Everything else",
        "   is progress noise; polling it burns your user's budget. A live",
        "   GUI panel opens automatically for the HUMAN (port 8377) — that",
        "   panel is theirs, not yours; never scrape it. Never invent a",
        "   time budget: set `model.time_budget_hours` from what your user",
        "   says, and let the wall-clock gate refuse a run that can't fit.",
        "   When the run exits: `nmt-forge evaluate <run-manifest>` closes",
        "   the loop (decode + score + diagnosis) in one command.",
        "5. **Before scoring the test set**, write your predictions down:",
        "   `nmt-forge prereg new first-run --eval-set project-test \\",
        "       --predictions preds.json`",
        "6. **Score** (CIs always): `nmt-forge score --eval-set project-test",
        "   --hyps decoded.txt" + (f" --plugin {specs[0]}" if specs else "") + "`",
        "",
        "## Where this can go (the asset ladder)",
        "",
    ]
    for rung, attained, text in report.ladder():
        mark = "✓" if attained else ("?" if attained is None else "—")
        lines.append(f"- {mark} rung {rung}: {text}")
    lines += [
        "",
        "Rungs marked `?` are things the card doesn't (yet) record — not",
        "things the language lacks. If you know of a resource the card",
        "misses, that's a card contribution, not a forge workaround.",
        "",
        "## Rules your agent should never bend",
        "",
        "- datasets flagged `do_not_train`/`quarantined` NEVER enter training",
        "- test sets are REAL DATA ONLY (synthetic rows are refused)",
        "- no number without its confidence interval",
        "- iterate on dev; test/sealed sets are spent through preregistration",
        "",
        "(Agents: the MCP tool `get_training_guardrails` carries the full",
        "rule set with the measured mistakes behind each rule.)",
    ]
    return "\n".join(lines) + "\n"


def init_project(
    code: str,
    directory: str | Path,
    *,
    pair: str | None = None,
    cards_path: str | Path | None = None,
) -> dict:
    """Scaffold a project dir from a card; returns a summary manifest."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    report = discover(code, cards_path)
    Workspace(directory / ".forge")  # creates registry/ledger/prereg dirs
    cfg = starter_config(report, pair=pair)
    cfg_path = directory / "config.json"
    cfg_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    steps_path = directory / "NEXT_STEPS.md"
    steps_path.write_text(next_steps(report, cfg), encoding="utf-8")
    return {
        "language": {"code": code, "name": report.name},
        "project": str(directory),
        "config": str(cfg_path),
        "next_steps": str(steps_path),
        "workspace": str(directory / ".forge"),
        "referee_plugins": report.plugin_specs(),
        "analyzers": [a.get("name") for a in report.analyzers],
        "note": "config points at project-dev/project-test — carve and "
                "register a split first (step 2 in NEXT_STEPS.md)",
    }
