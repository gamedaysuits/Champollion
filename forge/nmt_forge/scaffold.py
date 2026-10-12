"""``nmt-forge init`` — the amateur/agent front door.

Turns one language card into a ready-to-work project directory:

    project/
      .forge/            the workspace (registry, ledger, preregistrations)
      config.json        a starter run config PREFILLED from the card
                         (language block, the card's LYSS referee lanes ONLY
                         when that optional package is installed — a config
                         must pass its own preflight on a plain install —
                         sane guard defaults) and a model preset expanded
                         into explicit numbers
      NEXT_STEPS.md      the agent brief: what this language has, the asset
                         ladder, and the exact command order

The config deliberately points at eval-set names that DON'T EXIST YET
(``project-dev``/``project-test``) — running it before carving a split gets
the dev-fence's teaching refusal, which is the correct first lesson. The
scaffold never fetches data: corpora come from their sources, under their
terms (forge hosts nothing).

Model presets (``--model``): ``cpu-tiny`` (default — trains on a laptop CPU
in minutes, no download, weak by design), ``cpu-finetune`` (a small
pretrained Marian you name with ``--base``), ``nllb-600m`` (needs a GPU).
See :mod:`nmt_forge.training.presets` for what to honestly expect from each.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .cards import (ResourceReport, discover, format_report,
                    is_private_use, private_use_note)
from .errors import ForgeError
from .guards.ci_scoring import TWIN_DECISION_NOTE
from .training.schedule import DEFAULT_TIME_CEILING_HOURS
from .plugins import spec_importable
from .training.presets import DEFAULT_PRESET, MODEL_PRESETS, expand_preset
from .workspace import Workspace


#: Where the training guardrails are read: the MCP tool for an agent, the
#: public page for a person at a terminal (the same rules; forge has no
#: command that prints them).
GUARDRAILS_PAGE = ("https://champollion.dev/docs/network/getting-started/"
                   "training-honestly")
GUARDRAILS_READ = (f"agents: the MCP tool get_training_guardrails; at a "
                   f"terminal: {GUARDRAILS_PAGE}")

#: THE order of the steps before training when the community keeps its OWN
#: test set (the guide's route: teacher- or nurse-checked sentences in a
#: separate file). One source for init's note, NEXT_STEPS.md, status's
#: "initialized" advice and — through ``order`` in their ``--json`` — the
#: MCP hints; a test checks the public guide against it (Round 11: init's
#: note said "carve a split first" while its next step and the guide said
#: register, screen, predict). ``step`` is the stable key, ``tool`` the MCP
#: tool that runs it, ``marker`` the words that start the step's command in
#: a document (the guide check looks for them in this order).
STEP_ORDER: tuple[dict, ...] = (
    {"step": "register", "what": "register the test set",
     "command": "nmt-forge registry add {test} <your-test-file> --role test",
     "tool": "forge_register_eval", "marker": "nmt-forge registry add"},
    {"step": "leak-audit", "what": "screen the corpus against it",
     "command": "nmt-forge leak-audit <corpus> --clean-to corpus.clean.jsonl",
     "tool": "forge_leak_audit", "marker": "nmt-forge leak-audit"},
    {"step": "prereg",
     "what": "write the predictions: one preregistration per model you "
             "plan to train, named after it",
     "command": "nmt-forge prereg template --out predictions.json && "
                "nmt-forge prereg new <model> --eval-set {test} "
                "--predictions predictions.json",
     "tool": "forge_prereg_template → forge_prereg",
     "marker": "nmt-forge prereg new"},
    {"step": "baseline",
     "what": "only now benchmark existing models on the test set",
     "command": "mt-eval run --corpus <your-test-file> --source-lang "
                "<source> --target-lang <target> --provider <provider> "
                "--model <model> -o results",
     "tool": "run_benchmark", "marker": "mt-eval run"},
    # read once, before the split (Round 13 school persona: init's and
    # status's next steps went straight from the predictions to the split,
    # so the rules were read after splitting). No command: a step to READ,
    # by MCP tool or on the public page; no marker (the guide check finds
    # commands).
    {"step": "guardrails",
     "what": "read the training guardrails before splitting",
     "command": None,
     "read": GUARDRAILS_READ,
     "tool": "get_training_guardrails", "marker": None},
    {"step": "split", "what": "carve train/dev from the screened corpus",
     "command": "nmt-forge split corpus.clean.jsonl --test 0 --dev <N> "
                "--seed <S> --out data/split --register {prefix}",
     "tool": "forge_split", "marker": "nmt-forge split"},
    {"step": "train", "what": "check, then train",
     "command": "nmt-forge preflight run --config config.json && "
                "nmt-forge run config.json",
     "tool": "forge_preflight, then `nmt-forge run` in a terminal",
     "marker": "nmt-forge preflight run"},
)


def step_order(test: str = "project-test", prefix: str = "project"
               ) -> list[dict]:
    """:data:`STEP_ORDER` with the project's set names filled in (a step
    to read has no command: ``command`` None, ``read`` says where)."""
    return [{**s, "command": (s["command"].format(test=test, prefix=prefix)
                              if s.get("command") else None)}
            for s in STEP_ORDER]


def step_order_text() -> str:
    """The order in one line: ``register the test set → … → check, then
    train`` (step keys in brackets; a step to read says where)."""
    return " → ".join(f"{s['what']} ({s['step']}"
                      + (f" — {s['read']}" if s.get("read") else "") + ")"
                      for s in STEP_ORDER)


def referee_plan(report: ResourceReport) -> dict | None:
    """The card's referee lanes split by what this install can import.

    LYSS packages are OPTIONAL, separately licensed add-ons — never core, so
    never a requirement. ``wired`` lanes go into selection.plugins; the rest
    are named (package + install command) and left OUT of the config, which
    is then valid — and passes its own preflight — on a plain
    ``python3 -m pip install nmt-forge``."""
    specs = report.plugin_specs()
    if not specs:
        return None
    wired = [sp for sp in specs if spec_importable(sp)]
    package = (report.referee or {}).get("package")
    plan = {"package": package, "plugins": specs, "wired": wired,
            "installed": len(wired) == len(specs)}
    if len(wired) < len(specs):
        plan["note"] = (
            f"optional referee {package!r} is not installed, so its lanes "
            "are NOT in config.json — training does not need it. To add "
            f"them: python3 -m pip install '{package}' (read its license first), then "
            "list them under selection.plugins")
    return plan


def default_run_name(target: str, model_preset: str = DEFAULT_PRESET) -> str:
    """The run name `init` writes: ``<target>-nmt-<preset>`` (e.g.
    ``crk-nmt-cpu-tiny``) — a trained model, named for what it is, never
    "baseline" (the guide's word for the existing model measured first)."""
    return f"{target}-nmt-{model_preset}"


#: Arrows read as a pair separator (the harness's own notation is src>tgt).
_PAIR_ARROWS = ("->", "→", ">")
_HYPHEN_PAIR = re.compile(r"^([A-Za-z]{2,3})-([A-Za-z]{2,3})$")
PAIR_FORMS = ("eng-crk, or 'eng>crk' (quoted: an unquoted > is a shell "
              "redirect), or 'eng→crk'")


def parse_pair(text: str) -> tuple[str, str]:
    """``(source, target)`` from ``eng-crk``, ``eng>crk``, ``eng→crk`` or
    ``eng->crk`` — the forms the harness and the champollion CLI accept too.
    The hyphen form is a pair only when it is exactly two 2–3 letter codes
    (``crk-Cans`` is a code with a script subtag, not a pair).

    Round 10: ``--pair eng>crk`` (the harness's notation) had no ``-`` in it,
    so init silently fell back to ``eng-<code>`` — a pair the user did not
    ask for. Anything unreadable is now refused, never replaced."""
    raw = str(text or "").strip()
    for arrow in _PAIR_ARROWS:
        if arrow in raw:
            src, _, tgt = raw.partition(arrow)
            src, tgt = src.strip(), tgt.strip()
            if src and tgt and not any(a in tgt for a in _PAIR_ARROWS):
                return src, tgt
            break
    else:
        m = _HYPHEN_PAIR.match(raw)
        if m:
            return m.group(1), m.group(2)
    raise ForgeError(
        f"--pair {text!r} is not a language pair\n  fix: write it as "
        f"{PAIR_FORMS}")


def starter_config(report: ResourceReport, *, pair: str | None = None,
                   model_preset: str = DEFAULT_PRESET,
                   base: str | None = None) -> dict:
    source, target = (parse_pair(pair) if pair else ("eng", report.code))
    nllb_src = "eng_Latn" if source == "eng" else None
    model, decode = expand_preset(model_preset, base=base, nllb_src=nllb_src,
                                  nllb_tgt=report.nllb_code)
    cfg: dict = {
        # what the run IS — a trained NMT model of this preset. "<code>-
        # baseline" read as the guide's baseline (the existing model measured
        # BEFORE training) in exports, DEPLOY.md and mt-eval compare tables
        # (Round 8 hospital persona). Projects initialized earlier keep the
        # run_name their config.json already has.
        "run_name": default_run_name(target, model_preset),
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
        # gold_upweight sets gold's SHARE against synthetic rows. A new
        # project has none, so ×20 would only repeat the gold set twenty
        # times — 20× the epochs, turning "minutes on a CPU" into most of an
        # hour (2026-10-03). Raise it when a synthetic lane is added
        # (NEXT_STEPS.md says so; 20 was the reference project's ratio).
        "mix": {"gold_upweight": 1, "kind_cap": 0.15, "seed": 42},
        # schedule preset: auto-detects synthetic-heavy vs balanced from the
        # mix and derives the early-stop floor — never a magic flag
        "regime": "auto",
        "model": model,
        "selection": {"metric": "generation:chrf++", "top_k": 3},
        "decode": decode,
        # the eval battery `nmt-forge evaluate`/`export` decode and score —
        # prereg-gated, CI'd. near_dupe_corpus = the TRAIN file, so test
        # rows with a template sibling in training get a strict-subset score
        "eval": {"battery": "project-test", "by": "register",
                 "metrics": ["chrf++"],
                 "near_dupe_corpus": "data/split/train.jsonl"},
    }
    plan = referee_plan(report)
    if plan and plan["wired"]:
        # the language's own referee, when it is INSTALLED: chrF++ stays the
        # selection metric until the user opts in, but the lanes are wired
        # and reported. Not installed → left out (see referee_plan): a
        # scaffold must never write a config its own preflight refuses.
        cfg["selection"]["plugins"] = plan["wired"]
    return cfg


#: What init says about the time budget it does NOT write.
TIME_BUDGET_NOTE = (
    "no time budget is set (forge never invents one): a few minutes into "
    "`nmt-forge run`, the measured wall-clock projection is printed — ask "
    "your user how long they accept and add \"time_budget_hours\": <hours> "
    "to config.json → model; until then only forge's "
    f"{DEFAULT_TIME_CEILING_HOURS:g}h safety ceiling applies")


def _wrap_md(text: str, *, indent: str = "", width: int = 72) -> list[str]:
    """``text`` as indented Markdown lines (one paragraph)."""
    import textwrap

    return textwrap.wrap(text, width=width, initial_indent=indent,
                         subsequent_indent=indent)


def _private_use_section(code: str) -> list[str]:
    """NEXT_STEPS.md's word on a private-use code (qaa–qtz): what it costs
    and how to switch to the real code later. Empty for any other code."""
    if not is_private_use(code):
        return []
    return ["## A private-use code", "",
            *_wrap_md(f"`{code}` is an ISO 639-3 private-use code (qaa–qtz "
                      "are reserved for local use): no language card exists "
                      "for it. " + private_use_note(code) + "."),
            ""]


def next_steps(report: ResourceReport, cfg: dict, *, project_dir: str = ".",
               model_preset: str = DEFAULT_PRESET,
               test_withheld: str = "") -> str:
    preset = MODEL_PRESETS[model_preset]
    lines = [
        f"# Next steps — {report.name} ({report.code})",
        "",
        "This brief is written for you AND your agent. Everything below is",
        "honest to the language card (absence = unknown, never zero); every",
        "refusal you hit on the way explains itself with what/why/fix.",
        "",
        f"**Run every command from inside this project directory** "
        f"(`cd {project_dir}`): the config's paths (`.forge`, `data/…`) are",
        "relative to where you run forge. `nmt-forge status` shows the",
        "workspace in use and THE next command at any point.",
        "",
        "## What this language has",
        "",
        "```",
        format_report(report, initialized=True),
        "```",
        "",
        *_private_use_section(report.code),
        "## The model you are about to train",
        "",
        f"Preset `{model_preset}`: {preset['summary']}.",
        f"- needs: {preset['needs']}",
        f"- honest expectation: {preset['expect']}",
        "- every number is written out in `config.json` → `model`; change",
        "  them there (the config hash changes, so the run is a new run).",
        "- `mix.gold_upweight` is 1 because there is no synthetic data yet;",
        "  when you add a synthetic lane, raise it so your real sentences",
        "  keep their weight (the reference project used 20).",
        "- other presets: `nmt-forge init "
        + report.code + " --model cpu-finetune --base <hf-id>` (small",
        "  pretrained Marian, CPU) or `--model nllb-600m` (needs a GPU).",
        "",
        "## The command order",
        "",
        "1. **Get a parallel corpus locally** (fetch from its source — forge",
        "   never hosts or redistributes corpus content). A corpus is a",
        "   `.jsonl` of `{\"source\": ..., \"target\": ...}` rows.",
        "2. **Protect your test set, then carve the split — in this",
        "   order.** Your OWN test set (teacher-checked, private, sensitive)",
        "   stays out of the corpus, and every step before the benchmark",
        "   comes BEFORE any benchmark run on it:",
        "",
        *[f"   - **{s['step']}** — {s['what']}: "
          + (f"`{s['command']}`" if s.get("command") else s["read"])
          for s in step_order()],
        "",
        "   ```bash",
        "   nmt-forge registry add project-test my-test.jsonl --role test",
        "   nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl",
        "   nmt-forge prereg template --out predictions.json   # then edit it",
        "   nmt-forge prereg new all-data --eval-set project-test \\",
        "       --predictions predictions.json",
        "   # only now: benchmarks of existing models on the test set",
        "   nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \\",
        "       --out data/split --register project",
        "   ```",
        "",
        "   **No test set of your own?** Carve one from the corpus instead",
        "   of the first two steps (group-disjoint; the dev slice drives",
        "   checkpoint selection so the test set never can) — the",
        "   predictions still come before any score (step 4). The split also",
        "   says how many test rows have a near-twin in training — if most",
        "   do, the test score would measure recall of phrases, not",
        "   translation: add `--near-dupe 0.6` to hold out whole templates",
        "   (on a corpus whose templates chain into one group, split says so",
        "   and refuses — then `--max-group <N>` caps the groups), or write",
        "   an independent test set:",
        "",
        "   ```bash",
        "   nmt-forge split corpus.jsonl --test 150 --dev 100 --seed 42 \\",
        "       --out data/split --register project",
        "   ```",
        "",
        "   **Register the test set with forge BEFORE any benchmark run on",
        "   it** (`mt-eval run`, the MCP `run_benchmark`, a coached-model",
        "   comparison), so every read is counted: registering starts the",
        "   file's read log (`<file>.reads.jsonl`), and only runs after that",
        "   are in it. Already benchmarked on it? `registry add` lists the",
        "   earlier runs it finds in mt-eval's run logs as *reads before",
        "   registration (not counted)* — count them yourself when you judge",
        "   a test score.",
        "",
        "   **Write the predictions before the first benchmark, too.** A",
        "   benchmark is a scoring read, and `prereg new` refuses a",
        "   preregistration written after one (`--allow-after-reads` is only",
        "   for predictions truly written down before those reads — then",
        "   every report, export and DEPLOY.md says so). leak-audit's reads",
        "   are audit reads: screening first never blocks a prediction.",
        "",
        "   Read leak-audit's VERDICT line first (`--json`: the `verdict`",
        "   key). If it says most test rows have a near-twin in the corpus",
        "   (the test score would measure recall of training phrases), run",
        "   it again into its OWN file with `--drop-test-twins`:",
        "   `nmt-forge leak-audit corpus.jsonl --clean-to corpus.notwins.jsonl",
        "   --drop-test-twins` (never `--clean-to corpus.clean.jsonl`: the",
        "   all-data model trains on that, and leak-audit refuses to write",
        "   over it). It also drops the training rows that are near-twins of",
        "   your test set, says how many went, and writes the twin-free",
        "   model's config beside this one (`config-notwins.json`, never",
        "   overwritten) with the command that trains it. Run it once the",
        "   dev set is registered (after the split), so the dev rows leave",
        "   the twin-free file too. Each model gets its OWN preregistration,",
        "   named after it and written before any benchmark (`nmt-forge",
        "   prereg new notwins …`); `--prereg <id>` on export says which",
        "   judges which.",
        "",
        *_wrap_md(TWIN_DECISION_NOTE + ".", indent="   "),
        "",
        "   Audit BEFORE you split (the plain audit — the twin-free one",
        "   above comes after): once a dev set is registered, re-auditing",
        "   the full corpus drops the dev set's own rows too, and",
        "   re-splitting then carves a NEW dev set (split refuses that until",
        "   you pass `--allow-rotate`, and the ledger records the rotation).",
        "",
        "   Private? Mark it local-only FIRST (`champollion network register-corpus",
        "   --tier local-only --role test`, or",
        "   `echo '{\"transmission\": \"local-only\"}'",
        "   > my-test.jsonl.champollion.json`): forge then never prints its",
        "   sentences (line numbers, ids and scores instead — `--json` never",
        "   carries them), files carved from a marked corpus carry the mark,",
        "   and a registered card's id names the set in reports and exports.",
        "",
        "3. **Screen anything else you plan to train on** (harvests, mono",
        "   text): `nmt-forge leak-audit <file>` explains what it would drop",
        "   and why; `--clean-to <out.jsonl>` writes the survivors.",
        "4. **Write your predictions down BEFORE any test score exists** —",
        "   and before any benchmark of an existing model on the test set",
        "   (done already if you followed the own-test-set route above):",
        "",
        "   ```bash",
        "   nmt-forge prereg template --out predictions.json   # then edit it",
        "   nmt-forge prereg new all-data --eval-set project-test \\",
        "       --predictions predictions.json",
        "   ```",
        "",
        "5. **Check, then train** — `nmt-forge preflight run --config "
        "config.json`",
        "   lists every gate (including whether the training extra is",
        "   installed); when it's green: `nmt-forge run config.json`.",
        "",
        "   **Monitoring a run (agents, read this):** launch `run` in the",
        "   background with output to a log file. Do NOT poll the log on a",
        "   timer — watch it for the only lines that matter:",
        "   `refused|Error|wall-clock|continuity|RUN EXIT`. Everything else",
        "   is progress noise; polling it burns your user's budget. The",
        "   run's LAST line is always `RUN EXIT <code> (<outcome>) — …`:",
        "   0 finished (it names the next command), 2 refused, 1 crashed,",
        "   130 interrupted — wait for that line, not for silence",
        "   (`nmt-forge run config.json > run.log 2>&1 &`, then watch",
        "   run.log). A live GUI panel opens automatically for the HUMAN",
        "   (port 8377) — that panel is theirs, not yours; never scrape it.",
        "",
        "   **Time budget:** `config.json` sets none — forge never invents",
        "   one. A few minutes in, the run prints a measured `wall-clock`",
        "   projection (an EARLY estimate, then a steady-state one). Ask",
        "   your user how long they accept, then add",
        "   `\"time_budget_hours\": <hours>` to `config.json` → `model`; the",
        "   wall-clock gate then refuses a run that cannot fit. Until you",
        "   set one, only forge's "
        + f"{DEFAULT_TIME_CEILING_HOURS:g}h safety ceiling applies (it",
        "   stops a days-long run — it is not a budget anyone chose).",
        "   While it trains, `nmt-forge status` says `training` — wait;",
        "   never start a second run (`nmt-forge run` refuses while one",
        "   holds the workspace).",
        "6. **Evaluate + export in one step** (decodes the test set with the",
        "   dev-selected checkpoint, scores it with CIs — prereg-gated — and",
        "   packages the model + a harness report). It prints the verdict on",
        "   each preregistered prediction, and how many test sentences have a",
        "   near-twin in training (if most do, the score is recall of",
        "   training phrases, not translation — DEPLOY.md says so first):",
        "",
        "   ```bash",
        "   nmt-forge export .forge/runs/<run>/run-manifest.json \\",
        "       --prereg all-data --out export/",
        "   nmt-forge prereg check all-data      # the verdicts again, any time",
        "   ```",
        "",
        "   `--prereg` names the preregistration that judges this model.",
        "   With one preregistration on the test set export finds it",
        "   itself; with two (one per model) it refuses to guess, so name",
        "   each model's own. Pinning instead: `prereg new <id> …",
        "   --config-hash <hash>` binds a prediction to one config — the",
        "   full hash `nmt-forge preflight run --config <its config>`",
        "   prints; any later edit of that config (a time budget, say)",
        "   changes the hash and drops the pin, so naming it on export is",
        "   the simpler route.",
        "",
        "   Two models (e.g. one on all the data, one trained with",
        "   `--drop-test-twins`)? Export each to its own folder with its own",
        "   preregistration (`--prereg notwins --out",
        "   export-<run>/` for the twin-free one): as soon as",
        "   the workspace holds a second run, forge names run-named folders",
        "   (`export-<run>/`) in the run's NEXT line and in `nmt-forge",
        "   status`, and `export` never writes over another model's export",
        "   without `--force`. **The export order does not matter:** whichever",
        "   model is exported second, the all-data model's DEPLOY.md ends up",
        "   citing the twin-free model's score (a later export updates the",
        "   earlier one's DEPLOY.md).",
        "",
        "   A free-text prediction is yours to judge: record the",
        "   verdict with `nmt-forge prereg verdict all-data --prediction 2",
        "   --missed --by <name> --note \"…\"` (ledgered; shown as a human",
        "   verdict, never as a computed one).",
        "",
        "7. **Deploy** — serve the exported model and point the champollion",
        "   CLI at it (`export/model/DEPLOY.md` has the exact config, what",
        "   the server protects — placeholders, ICU plurals, Markdown — and",
        "   a fallback for strings the model cannot translate). Deploy",
        "   `export/model/` only: `export/evaluation/` holds your test",
        "   sentences and stays on this machine.",
        "",
        "   ```bash",
        "   nmt-forge serve export/model     # http://127.0.0.1:8378",
        "   ```",
        "",
    ]
    plan = referee_plan(report)
    if plan and plan["wired"]:
        lines += [
            "The card declares a LYSS referee for this language and it is",
            "installed: its lanes are wired into `selection.plugins`. Score",
            f"with it too: `nmt-forge score --eval-set project-test --hyps "
            f"<file> --plugin {plan['wired'][0]}`.",
            "",
        ]
    elif plan:
        lines += [
            "**Optional:** the card declares a LYSS referee for this",
            f"language — `{plan['package']}`, an add-on with its own license",
            "(read it before installing). It is NOT installed here, so",
            "`config.json` does not use it and nothing in this list needs it.",
            "To add its lanes later:",
            "",
            "```bash",
            f"python3 -m pip install '{plan['package']}'",
            "```",
            "",
            "then add these to `selection.plugins` in `config.json` (the",
            "config hash changes — it is a new run):",
            "",
            "```json",
            json.dumps(plan["plugins"], indent=2),
            "```",
            "",
        ]
    lines += ["## Where this can go (the asset ladder)", ""]
    for rung, attained, text in report.ladder(test_withheld=test_withheld):
        mark = "✓" if attained else ("?" if attained is None else "—")
        lines.append(f"- {mark} rung {rung}: {text}")
    lines += [
        "",
        "Rungs marked `?` are things the card doesn't (yet) record — not",
        "things the language lacks; a rung marked `—` says why it is not",
        "available here. If you know of a resource the card",
        "misses, that's a card contribution, not a forge workaround.",
        "",
        "## Rules your agent should never bend",
        "",
        "- datasets flagged `do_not_train`/`quarantined` NEVER enter training",
        "- test sets are REAL DATA ONLY (synthetic rows are refused)",
        "- no number without its confidence interval",
        "- iterate on dev; test/sealed sets are spent through preregistration",
        "- never read a local-only test file (no cat/head/open) and never pass",
        "  `--show-text`: what an agent reads goes to its model provider —",
        "  forge prints ids and scores for it instead",
        "",
        "(Agents: the MCP tool `get_training_guardrails` carries the full",
        "rule set with the measured mistakes behind each rule. Every forge",
        "command takes `--json` for a machine-readable result.)",
    ]
    return "\n".join(lines) + "\n"


def _test_withheld(ws: Workspace) -> str:
    """Why a test/sealed set already registered here may not leave the
    machine (the harness's reason), or "" — a re-init over a workspace that
    holds a local-only test set says the card referee cannot run on it."""
    for name in ws.registry.names(roles=("test", "sealed")):
        try:
            reason = ws.registry.text_withheld(name)
        except Exception:      # an unreadable sidecar is not 'no terms'
            reason = "its terms could not be read"
        if reason:
            return f"{name}: {reason}"
    return ""


def init_project(
    code: str,
    directory: str | Path,
    *,
    pair: str | None = None,
    cards_path: str | Path | None = None,
    model_preset: str = DEFAULT_PRESET,
    base: str | None = None,
    no_card: bool = False,
    name: str | None = None,
) -> dict:
    """Scaffold a project dir from a card; returns a summary manifest.

    ``no_card=True`` scaffolds a language the card index doesn't have yet
    (every card-derived fact is then UNKNOWN — nothing is invented)."""
    directory = Path(directory)
    if no_card:
        from .cards import no_card_report

        report = no_card_report(code, name)
    else:
        report = discover(code, cards_path)
    # expand the preset BEFORE touching disk: a bad --model/--base refuses
    # without leaving a half-made project behind
    cfg = starter_config(report, pair=pair, model_preset=model_preset,
                         base=base)
    directory.mkdir(parents=True, exist_ok=True)
    ws = Workspace(directory / ".forge")  # creates registry/ledger/prereg dirs
    cfg_path = directory / "config.json"
    cfg_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    steps_path = directory / "NEXT_STEPS.md"
    steps_path.write_text(next_steps(report, cfg, project_dir=str(directory),
                                     model_preset=model_preset,
                                     test_withheld=_test_withheld(ws)),
                          encoding="utf-8")
    preset = MODEL_PRESETS[model_preset]
    dev = (cfg.get("data") or {}).get("dev") or "project-dev"
    battery = (cfg.get("eval") or {}).get("battery") or "project-test"
    prefix = dev[:-4] if dev.endswith("-dev") else "project"
    return {
        "language": {"code": code, "name": report.name,
                     "card": report.card_path},
        "project": str(directory),
        "config": str(cfg_path),
        "next_steps": str(steps_path),
        "workspace": str(directory / ".forge"),
        "model_preset": model_preset,
        "model": {"backend": cfg["model"]["backend"],
                  "base": cfg["model"].get("base"),
                  "needs": preset["needs"],
                  "expect": preset["expect"],
                  # forge never invents a budget: none is written, and the
                  # run's measured projection is what the user decides from
                  "time_budget_hours": None,
                  "time_budget_note": TIME_BUDGET_NOTE},
        "referee_plugins": report.plugin_specs(),
        # what config.json actually wires (only importable lanes) and, when
        # some are left out, the optional package that would add them
        "referee": referee_plan(report),
        "analyzers": [a.get("name") for a in report.analyzers],
        # THE order (STEP_ORDER) — the same one NEXT_STEPS.md, status and
        # the guide give (Round 11: this note said "split first")
        "order": step_order(test=battery, prefix=prefix),
        "note": f"cd {directory} before running forge commands. Then, in "
                f"this order: {step_order_text()} — NEXT_STEPS.md step 2 has "
                f"the commands. No test set of your own? `nmt-forge split "
                f"<corpus> --test <M> --dev <N> --seed <S> --out data/split "
                f"--register {prefix}` carves and registers {battery} from "
                "the corpus instead of the first two steps; the predictions "
                "still come before any score",
    }
