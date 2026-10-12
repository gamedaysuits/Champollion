"""``nmt-forge export`` — from a trained run to something the ecosystem uses.

One command, two bridges, written into two folders that never mix:

1. **champollion** — ``<out>/model/``, THE deployable directory and nothing
   else: weights + tokenizer (no optimizer state, LoRA merged), a
   ``forge-model.json`` that records what it is, how to serve it and how it
   was measured (numbers only), a ``DEPLOY.md`` with the exact commands and
   a champollion plugin manifest (``champollion-plugin/method.json``,
   ``type: api``) pointing at ``nmt-forge serve``. It holds no corpus text:
   copy it to a server and nothing of the test set goes along.
   ``nmt-forge serve <out>/model`` exposes the champollion api-method
   contract (``POST /translate``) and an OpenAI-compatible
   ``POST /v1/chat/completions``.
2. **mt-eval** — ``<out>/evaluation/``, the evidence: the test battery is
   decoded with the run's dev-selected checkpoint and scored (prereg-gated,
   ledgered, CIs — exactly ``nmt-forge evaluate``), and the same rows are
   written as an mt-eval RunLog + TestReport by the harness's own writers,
   scored with the metric battery ``mt-eval run`` loads for the target
   language (what it could not compute is listed, with the command that
   computes it). These files carry the test set's sentences: DEPLOY.md and
   the folder's own README say never to copy it with the model, and when the
   test set is marked (local-only, sealed, a declared licence) every file
   carries the mark as a ``.champollion.json`` sidecar.

Why two folders (synthetic school persona, Round 3, 2026-10-03): the
RunLog and TestReport used to sit inside the folder DEPLOY.md called "a
self-contained, offline model", so copying the model to a server shipped
the community's teacher-checked test set with it; only a README one level
down said otherwise. Exports written before then (forge-model.json at the
export root, weights in ``model/``) are still read by ``serve`` and
``prereg check`` (:func:`find_forge_model`).

Honesty rules: the export carries the run's dev report AND (when evaluated)
the test battery with its CIs; the caveats (small data, template optimism,
"an NMT model does not follow instructions") are written into the manifest
and DEPLOY.md, not left to the reader's optimism. A sealed set is one-shot:
evaluating it here spends it — re-exporting refuses, use ``--no-eval``.
"""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from . import __version__ as FORGE_VERSION
from .errors import ForgeError
from .guards.ci_scoring import DROP_TWINS_COMMAND
from .training.backends import (
    HF_BACKENDS,
    TRAINER_STATE_FILES,
    TRAINER_STATE_PREFIXES,
)
from .training.config import RunConfig
from .workspace import Workspace

#: /2 (2026-10-03): forge-model.json lives IN the deployable model
#: directory (``model_dir: "."``) and the evaluation evidence beside it;
#: /1 kept it at the export root next to ``model/``, ``eval/`` and
#: ``harness/``. Readers resolve ``model_dir`` and every evidence pointer
#: relative to the forge-model.json, so both read the same way.
EXPORT_FORMAT = "nmt-forge-model/2"
DEFAULT_PORT = 8378

FORGE_MODEL = "forge-model.json"
#: the deployable directory: weights, tokenizer, serving settings, the card
MODEL_SUBDIR = "model"
#: the evaluation evidence: the test set's text — never deployed
EVALUATION_SUBDIR = "evaluation"
#: inside the model dir: ONLY the champollion plugin manifest, because
#: `champollion plugin install <dir>` copies the whole directory into the
#: app project's .champollion/methods/ (weights and all, if pointed at the
#: model dir — and, before 2026-10-03, the test set's RunLog too)
PLUGIN_SUBDIR = "champollion-plugin"


#: Said wherever forge suggests exporting one of several runs (the run's
#: NEXT / RUN EXIT lines, status, NEXT_STEPS.md): a school with an all-data
#: and a twin-free model exported the twin-free one first "to be safe"
#: (Round 7) — it did not need to.
EXPORT_ORDER_NOTE = (
    "export order does not matter: each model gets its own folder, and "
    "whichever is exported second, the all-data model's DEPLOY.md ends up "
    "citing the twin-free model's score (a later export updates the earlier "
    "one's DEPLOY.md)")


def workspace_run_count(workspace: Workspace | None) -> int:
    """Trained runs in the workspace (run directories holding a manifest)."""
    if workspace is None or not workspace.runs_dir.is_dir():
        return 0
    return sum(1 for d in workspace.runs_dir.iterdir()
               if d.is_dir() and ((d / "run-manifest.json").is_file()
                                  or (d / "manifest.json").is_file()))


def suggest_export_dir(run_name: str | None, *,
                       workspace: Workspace | None = None,
                       base: str | Path | None = None) -> str:
    """The ``--out`` forge suggests for exporting a run: ``export/`` while it
    is free and the workspace holds ONE run; with two or more runs, a
    run-named folder from the start (``export-<run>/``, then
    ``export-<run>-2/``, …), so no printed command sends two models to the
    same folder; and once ``export/`` holds another export, run-named too.

    A folder is taken when it exists and is not empty, or when the
    workspace's ledger records an export to it — checked against the
    directory forge runs in (``base``, default the current one) and the
    project directory the workspace sits in. After a second run, every
    command forge printed used to say ``--out export/``: the folder already
    holding the first model (Round 6 school persona)."""
    roots = [Path(base).resolve() if base else Path.cwd().resolve()]
    if workspace is not None and workspace.root.parent not in roots:
        roots.append(workspace.root.parent)
    recorded = set()
    if workspace is not None:
        for e in workspace.ledger.find("export"):
            if e.get("dir"):
                recorded.add(Path(e["dir"]).resolve())

    def taken(rel: str) -> bool:
        for root in roots:
            p = (root / rel).resolve()
            if p in recorded:
                return True
            if p.exists() and (not p.is_dir() or any(p.iterdir())):
                return True
        return False

    if not taken("export") and workspace_run_count(workspace) < 2:
        return "export/"
    slug = _kebab(run_name) if run_name else "run"
    name, i = f"export-{slug}", 2
    while taken(name):
        name, i = f"export-{slug}-{i}", i + 1
    return f"{name}/"


def find_forge_model(path) -> Path | None:
    """The forge-model.json an export path leads to, or None.

    ``path`` may be the file itself, the deployable model directory
    (``<export>/model``), the export directory (→ its ``model/``, or its
    ``evaluation/`` for a ``--no-model`` export) or an export written before
    2026-10-03 (forge-model.json at its root)."""
    p = Path(path)
    if p.is_file():
        return p if p.name == FORGE_MODEL else None
    for cand in (p / FORGE_MODEL, p / MODEL_SUBDIR / FORGE_MODEL,
                 p / EVALUATION_SUBDIR / FORGE_MODEL):
        if cand.is_file():
            return cand
    return None

CAVEATS = [
    "An NMT model translates text; it does not follow instructions. "
    "Register/tone prompts, coaching files and glossaries that the "
    "champollion CLI sends to LLM methods are IGNORED by this model.",
    "Scores are on YOUR test set only. A small test set means wide "
    "confidence intervals — read the intervals, not the point score.",
    "If your training data and test set share sentence templates, scores "
    "carry template optimism; the battery report's '(strict)' rows show "
    "the clean subset when eval.near_dupe_corpus is set. With a fixed test "
    f"set, `{DROP_TWINS_COMMAND}` takes its near-twins out of the training "
    "data.",
    "Machine translation of a low-resource language needs a speaker's "
    "review before anything ships to readers.",
]


def _kebab(text: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return out or "model"


def _locales_for(code: str) -> list[str]:
    """The code plus the aliases the language card records (e.g. eng → en),
    best-effort through the harness resolver; never fatal."""
    out = [code] if code else []
    if not code:
        return out
    try:
        from .cards import resolve_card

        card, _ = resolve_card(code)
        for alias in [card.get("iso639_1"), *(card.get("aliases") or [])]:
            if isinstance(alias, str) and alias and alias not in out:
                out.append(alias)
    except Exception:
        pass
    return out


def _copy_model(src: Path, dst: Path, model_cfg: dict) -> dict:
    """Copy a checkpoint dir minus trainer state; merge a LoRA adapter into
    its base so the export loads with nothing but transformers."""
    if not src.is_dir():
        raise ForgeError(
            f"the selected checkpoint is not on disk: {src}\n"
            "  fix: re-run `nmt-forge run` (the run dir was moved or pruned)")
    dst.mkdir(parents=True, exist_ok=True)
    if (src / "adapter_config.json").is_file():
        from peft import PeftModel
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        base = AutoModelForSeq2SeqLM.from_pretrained(model_cfg["base"])
        merged = PeftModel.from_pretrained(base, str(src)).merge_and_unload()
        merged.save_pretrained(str(dst))
        tok_src = src if any((src / f).is_file() for f in
                             ("tokenizer.json", "tokenizer_config.json")) \
            else model_cfg["base"]
        AutoTokenizer.from_pretrained(str(tok_src)).save_pretrained(str(dst))
        return {"lora_merged": True}
    copied = []
    for f in sorted(src.iterdir()):
        if f.name in TRAINER_STATE_FILES or f.name.startswith(
                TRAINER_STATE_PREFIXES):
            continue
        if f.is_file():
            shutil.copy2(f, dst / f.name)
            copied.append(f.name)
    if not any(n in copied for n in ("tokenizer.json", "tokenizer_config.json",
                                     "sentencepiece.bpe.model", "source.spm")):
        # a pretrained base's tokenizer (checkpoints written before forge
        # saved tokenizers alongside): save it in so the export is offline
        from transformers import AutoTokenizer

        kwargs = {}
        if model_cfg.get("src_lang"):
            kwargs = {"src_lang": model_cfg["src_lang"],
                      "tgt_lang": model_cfg.get("tgt_lang")}
        AutoTokenizer.from_pretrained(model_cfg["base"], **kwargs) \
            .save_pretrained(str(dst))
        copied.append("tokenizer (from base)")
    return {"lora_merged": False, "files": copied}


#: the only strings a deployable benchmarks entry keeps (identity, not data)
_BENCHMARK_STRINGS = ("date", "model", "harness_version")


def _deployable_benchmarks(entry: dict) -> dict:
    """The harness exporter's benchmarks entry, numbers only.

    It copies every plugin aggregate verbatim — lists and dicts included
    (the terminology plugin's most-missed glossary terms, a register
    distribution, FST provenance), and a plugin's aggregate may name words
    from the test set. method.json sits in the deployable model directory,
    which carries no corpus text, so it keeps numbers, booleans, nulls and
    the identity strings; the full TestReport stays in the evaluation
    folder."""
    out = {}
    for key, value in (entry or {}).items():
        if value is None or isinstance(value, (bool, int, float)):
            out[key] = value
        elif isinstance(value, str) and key in _BENCHMARK_STRINGS:
            out[key] = value
    return out


def _method_manifest(name: str, *, endpoint: str, locales: list[str],
                     report_path: Path | None, description: str) -> dict:
    """A champollion plugin manifest (type ``api``). When a harness
    TestReport exists, the benchmarks block comes from the HARNESS's own
    TestReport→method.json mapping (its exporter), not a forge copy."""
    manifest: dict = {
        "name": name,
        "type": "api",
        "version": "1.0.0",
        "description": description,
        "endpoint": endpoint,
        "locales": locales,
        # A trained NMT model translates; it cannot follow the quality gate's
        # feedback, so champollion sends a refused string straight to the
        # pair's fallback instead of asking this model again.
        "acceptsInstructions": False,
        "provenance": {
            "resources": [{"name": f"nmt-forge model ({name})",
                           "license": "trained on the user's own data — "
                                      "see forge-model.json data_rights",
                           "type": "model"}],
            "commercialReady": False,
            "flags": ["license-unclear"],
        },
    }
    if report_path is not None and report_path.is_file():
        try:
            from . import _harness

            _harness.load_harness()
            from mt_eval_harness import exporter as hx

            build = getattr(hx, "_build_manifest", None)
            if build is not None:
                hm = build(json.loads(report_path.read_text(encoding="utf-8")),
                           hx.ExportConfig(name=name, method_type="api",
                                           locales=locales[:1]))
                manifest["benchmarks"] = {
                    loc: _deployable_benchmarks(entry)
                    for loc, entry in (hm.get("benchmarks") or {}).items()}
                manifest["config"] = hm.get("config", {})
        except Exception as e:      # benchmarks are optional; say why absent
            manifest["benchmarks_note"] = f"not attached: {e}"
    validate = None
    try:
        from mt_eval_harness import exporter as hx

        validate = getattr(hx, "_validate_manifest", None)
    except Exception:
        pass
    if validate is not None:
        errors = validate(manifest)
        if errors:
            raise ForgeError("the champollion plugin manifest would fail "
                             "champollion validation: " + "; ".join(errors))
    return manifest


DEPLOY_TEMPLATE = """\
# Deploying `{name}` ({source} → {target})

This directory is the deployable model, exported by nmt-forge
{forge_version} from run `{run}` (config hash `{config_hash}`): the weights
and tokenizer, `forge-model.json` (serving settings, and what was measured —
as numbers), this file, and the champollion plugin manifest in
`{plugin_subdir}/`. It runs offline and holds no sentence from your test set.

## What to copy — and what never to copy

{copy_rule}

## What was measured — read this first

{headline}

## 1. Serve it

```bash
python3 -m pip install 'nmt-forge[hf]'          # torch + transformers (CPU is fine)
nmt-forge serve {dir}                # http://127.0.0.1:{port}
```

`serve` binds to 127.0.0.1. To expose it on a network, give it a token:
`NMT_FORGE_SERVE_TOKEN=$(openssl rand -hex 24) nmt-forge serve {dir} --host 0.0.0.0`.
If port {port} is taken, pick another with `--port` and use that port in the
endpoints below.

## 2a. Use it from the champollion CLI — `api` method (recommended)

```json
{{
  "inputLocale": "{source_locale}",
  "pairs": {{
    "{source_locale}:{target}": {{
      "method": "api",
      "endpoint": "http://127.0.0.1:{port}/translate",
      "acceptsInstructions": false
    }}
  }}
}}
```

{fallback_section}

`fallback.method` is any champollion method but this same server (a fallback
identical to its pair stops the sync). It needs what that method needs — a
`local` fallback needs an OpenAI-compatible server running on this machine
(`LOCAL_API_BASE` sets its address), an `llm-coached` fallback needs
`OPENROUTER_API_KEY` — and it SENDS those strings to that method's server.
What it writes is that method's output, not this model's: `sync` prints a
`[FALLBACK]` line per pair, and the Translation Memory records which method
produced each value. `--method` on the command line overrides the pair's own
method only; the fallback keeps what the config says.

Then, with either config:

```bash
npx champollion sync
```

No key is needed for the server started above: `serve` on 127.0.0.1 with no
token accepts the CLI's requests, and the CLI sends no key to a loopback
endpoint. A key is needed only when the server was started WITH a token —
`--token`, or `NMT_FORGE_SERVE_TOKEN` (required with a non-loopback
`--host`): give the CLI the same value, `export CHAMPOLLION_API_KEY=<that
token>` before `sync`, or `"apiKey": "${{YOUR_VAR}}"` on the pair.

Or install the bundled plugin manifest (`{plugin_subdir}/method.json`, type
`api`): `npx champollion plugin install {dir}/{plugin_subdir}` and set
`"methodPlugin": "{name}"` on the pair. (Point it at `{plugin_subdir}/`, never
at this directory: `plugin install` copies the whole directory it is given
into your app project's `.champollion/methods/`.)

## 2b. Or as an OpenAI-compatible endpoint — `local` method

```bash
LOCAL_API_BASE=http://127.0.0.1:{port}/v1 npx champollion sync --method local
```

The model cannot follow instructions, so the server reads the CLI's
requests by their shape: the JSON object of app strings comes back with the
same keys, and a Markdown content file's blocks (or its whole body) come
back translated with their structure intact. A pair's `fallback` (§2a)
applies here too.

## 3. What `serve` protects

A model trained on plain sentences drops placeholders and garbles markup,
so the server never shows them to it. Copied verbatim around the model's
output:

- placeholders: `{{name}}`, `{{0}}`, `{{n, number}}`, `{{{{name}}}}`, printf
  `%s` / `%d` / `%(name)s` / `%1$s` / `%%`, Rails `%{{count}}` / `%<name>s`,
  i18next `$t(key)`, vue-i18n `@:key`;
- ICU `plural` / `select` / `selectordinal`: the variable, the keyword,
  every selector, `offset:`, `#` and the braces — each branch's text is
  translated on its own and put back in its branch;
- HTML/JSX tags and entities, inline code, URLs, e-mail addresses and the
  CLI's own `⟦…⟧` placeholders;
- Markdown structure: headings, list and task markers, quotes, tables (cell
  by cell), `:::` admonitions, emphasis markers, link and image targets (the
  link text is translated), fenced and indented code blocks, blank lines.

The model sees only the text between them, one sentence at a time (a
paragraph hard-wrapped over several lines in a document is joined first;
the line breaks of an app string are kept). The price: text on either side
of a placeholder is translated as separate pieces, so word order around it
follows the source — the structure is guaranteed, fluency around it is not.

## 4. Strings this model cannot do

`champollion sync` checks every translation with its quality gate. An
output that damages a placeholder or a plural/select, turns a short label
into a long sentence ("length inflation"), repeats itself, echoes the
source or empties it is REFUSED: the key is not written (a new key stays
missing from the locale file, a changed key keeps its old value), sync's
"Failure summary" counts it, the next sync tries again, and
`npx champollion verify` lists the missing keys. A content block the model
returned nothing for is written as `[EN] `-prefixed source and the file is
retried on the next sync.

To fill those keys on every sync, set the pair's `fallback` (§2a). To fill
them once with another method — for just those keys:

```bash
npx champollion sync --pair {source_locale}:{target} --method <method> --redo keys:<key1>,<key2>
```

`--method` overrides the configured method for that one run (the config is
untouched); `--redo keys:` re-queues exactly the named keys (a comma inside
a key name is written `\\,`). For a content file use
`--redo files:<path as sync prints it>`. Or translate them by hand — or
export them for a reviewer with `npx champollion xliff export --locale
{target}` and bring the reviewed file back with `npx champollion xliff
import <file>`. Whatever fills them is that method's (or person's) output,
not this model's: keep a note of which keys you filled that way.

## 5. What this model is — read before shipping

{caveats}

Dev set (checkpoint selection): `{dev_set}` — {dev_scores}
{test_line}

{evidence_line}

## 6. Enter it in a sovereign contest (Lane A)

{contest_section}
"""


def declare_decode_length(model_dir: Path, max_new_tokens: int) -> dict | None:
    """Write ``max_new_tokens`` — the decode cap forge selected and scored
    the model with — into the exported ``generation_config.json``, unless
    the model already declares a length (``max_new_tokens`` / ``max_length``
    — the model author's choice stands). Engines that honour the model's
    own declaration (transformers' ``generate``, the harness's local-model
    adapter, a contest node's declarative engine) then decode as forge
    measured. Returns what was declared, or None (no generation config, an
    unreadable one, or a length already declared)."""
    path = model_dir / "generation_config.json"
    if not path.is_file() or not max_new_tokens:
        return None
    try:
        gen = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(gen, dict) or gen.get("max_new_tokens") \
            or gen.get("max_length"):
        return None
    gen["max_new_tokens"] = int(max_new_tokens)
    # an edited config is no longer the one derived from the model config
    gen["_from_model_config"] = False
    path.write_text(json.dumps(gen, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8")
    return {"max_new_tokens": int(max_new_tokens),
            "why": "the decode cap forge selected and scored the model with "
                   "(config decode.max_new_tokens)"}


#: Files in model/ that are NOT part of a contest entry: forge's own card
#: (this model's test-set scores and local paths), this file and the
#: champollion plugin manifest. A Lane A entry is the model's data files.
NOT_IN_A_CONTEST_ENTRY = ("forge-model.json", "DEPLOY.md", PLUGIN_SUBDIR)


def safetensors_parameter_count(path: Path) -> int | None:
    """The parameter count a ``.safetensors`` file STORES: the sum of its
    tensors' sizes, read from the header (the measure the contest's
    declarative lane checks a declared count against — a tied weight is
    stored once). None when the file cannot be read."""
    import struct

    try:
        with open(path, "rb") as fh:
            (n,) = struct.unpack("<Q", fh.read(8))
            header = json.loads(fh.read(n).decode("utf-8"))
    except (OSError, ValueError, struct.error):
        return None
    total = 0
    for name, meta in header.items():
        if name == "__metadata__" or not isinstance(meta, dict):
            continue
        size = 1
        for d in meta.get("shape") or []:
            size *= int(d)
        total += size
    return total


def contest_section(model_dir: Path, files: list[str]) -> str:
    import shlex

    """DEPLOY.md §6: from this export to `mt-eval contest submit-model` —
    which files make the entry, its architecture and the parameter count the
    lane will check, read from the files themselves (Round 10 researcher:
    model/ as written was refused, and no doc joined the two)."""
    entry = [f for f in files if f not in NOT_IN_A_CONTEST_ENTRY]
    arch = None
    try:
        cfg = json.loads((model_dir / "config.json").read_text(
            encoding="utf-8"))
        archs = cfg.get("architectures") or []
        arch = archs[0] if archs else None
    except (OSError, json.JSONDecodeError):
        pass
    weights = next((f for f in entry if f.endswith(".safetensors")), None)
    count = (safetensors_parameter_count(model_dir / weights)
             if weights else None)
    if not entry or weights is None:
        return ("This export carries no safetensors weights, so it cannot be "
                "entered in a contest's declarative lane (Lane A) as it is.")
    copy = " ".join(entry)
    return (
        "A sovereign contest's declarative lane takes the model as DATA — "
        "its weights, config and tokenizer — and runs it on the organizer's "
        "node; nothing else is sent. Put exactly these files in a folder of "
        f"their own: `{copy}`. Leave out `forge-model.json` (it holds this "
        "model's scores on YOUR test set, and local paths), this file and "
        f"`{PLUGIN_SUBDIR}/` — none of them is part of an entry.\n\n"
        "```bash\n"
        "mkdir -p lane-a\n"
        "cp " + " ".join(shlex.quote(str(model_dir / f)) for f in entry)
        + " lane-a/\n"
        "mt-eval contest submit-model <contest-id> --model-dir lane-a \\\n"
        f"  --architecture {arch or '<config.json architectures[0]>'} "
        "--paradigm neural-nmt \\\n"
        + (f"  --parameter-count {count} \\\n" if count is not None else
           "  --parameter-count <the count the weights file stores> \\\n")
        + "  …   # name, version, track, training data, licence, node id: "
          "see the contest's terms\n"
        "```\n\n"
        + (f"`{count:,}` is the count `{weights}` stores (the sum of its "
           "tensors, read from the header) — the number the lane checks a "
           "declared count against, so declare it as is. "
           if count is not None else "")
        + "`generation_config.json` declares `max_new_tokens`, the decode "
          "length forge scored the model with, so an engine that honours the "
          "model's own declaration decodes as forge measured. "
        + "The full submission walk-through: "
          "https://champollion.dev/docs/network/sovereignty/run-a-sovereign-contest")


def _fallback_json(source_locale: str, target: str, port: int,
                   fallback: str) -> str:
    """One champollion.config.json example: this model's `api` pair with
    ``fallback`` (a JSON object, written as-is)."""
    return (
        "```json\n{\n"
        f'  "inputLocale": "{source_locale}",\n'
        '  "pairs": {\n'
        f'    "{source_locale}:{target}": {{\n'
        '      "method": "api",\n'
        f'      "endpoint": "http://127.0.0.1:{port}/translate",\n'
        '      "acceptsInstructions": false,\n'
        f'      "fallback": {fallback}\n'
        "    }\n  }\n}\n```")


def local_only_reason(mark: dict | None) -> str:
    """Why this export's project keeps its text on this machine — its test
    set's terms (the harness's mark: a steward's local-only sidecar or card
    tier, or a sealed segment) — or "" when they say nothing of the kind."""
    m = mark or {}
    if str(m.get("transmission") or "").lower() == "local-only":
        return "your test set is marked local-only (its card or sidecar)"
    if m.get("segment"):
        return f"your test set is sealed (segment {m['segment']})"
    return ""


def fallback_section(*, source_locale: str, target: str, port: int,
                     fallback_model: str, local_only: str = "") -> str:
    """DEPLOY.md §2a's fallback: a hosted second opinion first, or — when
    the project keeps its text on this machine — ONLY machine-local
    fallbacks first, saying why (Round 9 hospital persona: a local-only
    project's DEPLOY.md offered nothing but a hosted `llm-coached` one)."""
    intro = ("With a **fallback** for the strings this model cannot translate "
             "safely (§4): the quality gate refuses them, and the pair's "
             "`fallback` sends exactly those strings — once — to a second "
             "method, whose output passes the same gate.")
    local = _fallback_json(source_locale, target, port,
                           '{ "method": "local", "model": "<your local model>" }')
    second = _fallback_json(
        source_locale, target, port,
        f'{{ "method": "api", "endpoint": "http://127.0.0.1:{port + 1}'
        '/translate" }')
    hosted = _fallback_json(
        source_locale, target, port,
        f'{{ "method": "llm-coached", "model": "{fallback_model}" }}')
    if local_only:
        return "\n\n".join([
            intro,
            f"**Keep the fallback on this machine:** {local_only}, so this "
            "project's sentences stay here — and a fallback SENDS every "
            "string it gets to its server. Make it a model you run yourself: "
            "`local` sends to an OpenAI-compatible server on this machine "
            "(Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` sets the "
            "address) at $0 API cost:",
            local,
            "or a second model exported by nmt-forge, served on its own port "
            f"(`nmt-forge serve <its export>/model --port {port + 1}`):",
            second,
            "A hosted model (`\"method\": \"llm-coached\"`) is usually the "
            "stronger second opinion for a low-resource language, but it "
            "sends the app's strings to its provider: use one only if the "
            "people who own this data agree that the app's text may leave "
            "the machine."])
    return "\n\n".join([
        intro, hosted,
        "If no text may leave your machines, make the fallback a model you "
        "run there: `{ \"method\": \"local\", \"model\": \"<your local "
        "model>\" }` sends to an OpenAI-compatible server on this machine "
        "(Ollama, llama.cpp, vLLM; `LOCAL_API_BASE` sets the address), at "
        "$0 API cost."])


def _score_line(scores: dict) -> str:
    """A battery ``scores`` dict as scoring standard/1 says it: chrF++
    with its 95% CI first, the secondary standard metrics beside it, the
    rest labelled diagnostics (``scoring_standard.score_line``)."""
    from .scoring_standard import score_line

    return score_line(scores)


def _sentence(text: str) -> str:
    text = text.strip()
    return (text[:1].upper() + text[1:]).rstrip(".") + "." if text else ""


def _set_label(test_report: dict) -> str:
    """`<dataset id>` (forge set `<name>`) — the id mt-eval knows the set by
    first, forge's registry name beside it; just `<name>` when they agree."""
    name = test_report["eval_set"]
    did = test_report.get("dataset_id")
    if did and did != name:
        return f"`{did}` (forge set `{name}`)"
    return f"`{name}`"


def _coverage_line(coverage: dict | None) -> str:
    """The metric battery in one paragraph: what the TestReport carries and
    what it does not (and why) — never a silent omission."""
    if not coverage:
        return ""
    line = ("mt-eval metrics in the TestReport: "
            + (", ".join(coverage["computed"]) or "none") + ".")
    if coverage["not_computed"]:
        line += (" **Not computed:** " + "; ".join(
            f"{m['metric']} — {m['why']}" for m in coverage["not_computed"])
            + ". The command that computes each is in the evaluation "
              "folder's README.md and in `forge-model.json` "
              "(`harness.metrics`).")
    return line


#: The exact model slug DEPLOY.md's fallback example names — the champollion
#: CLI's default OpenRouter model (cli/lib/config.js DEFAULT_OPENROUTER_MODEL;
#: tests/test_export_layout.py pins the two together). An exact slug, never a
#: short alias: founder ruling 2026-10-05, no aliasing for any model.
# The champollion CLI's default (shared/model-defaults.json, role "translate").
from mt_eval_harness.model_defaults import default_model as _default_model  # noqa: E402
FALLBACK_EXAMPLE_MODEL = _default_model("translate")


def _fallback_example_model() -> str:
    """The example fallback model id DEPLOY.md writes — an exact slug that
    the harness's own check accepts (no retired alias, no floating id)."""
    from . import _harness

    _harness.load_harness()
    from mt_eval_harness.config import exact_model_refusal

    refusal = exact_model_refusal(FALLBACK_EXAMPLE_MODEL, openrouter=True)
    if refusal:
        raise ForgeError(
            f"DEPLOY.md's fallback example model is not an exact slug: {refusal}")
    return FALLBACK_EXAMPLE_MODEL


#: DEPLOY.md blocks forge may rewrite after the export (a person's prereg
#: verdict, a twin-free sibling exported later): delimited by HTML comments,
#: invisible in rendered Markdown.
_BLOCK_OPEN = "<!-- nmt-forge:{name} -->"
_BLOCK_CLOSE = "<!-- /nmt-forge:{name} -->"
_HEADLINE_HEADING = "## What was measured — read this first\n\n"


def _block(name: str, text: str) -> str:
    return (f"{_BLOCK_OPEN.format(name=name)}\n{text}\n"
            f"{_BLOCK_CLOSE.format(name=name)}")


#: In a DEPLOY.md written before blocks existed: the paragraphs each block
#: replaces (the first one found takes the block; the others are removed —
#: e.g. "train a twin-free model" once one is cited).
_LEGACY_PARAGRAPHS = {
    "prereg": ("Judged against preregistration `",),
    "twin-free": ("Choosing between the two models:",
                  "For a test score that measures translation:"),
}


def _replace_block(doc: str, name: str, text: str) -> str:
    """``doc`` with block ``name`` replaced by ``text``. A DEPLOY.md written
    before blocks existed has the block's paragraph(s) replaced
    (:data:`_LEGACY_PARAGRAPHS`), or — when there is none — the block
    inserted at the top of the "What was measured" section."""
    opn, cls = _BLOCK_OPEN.format(name=name), _BLOCK_CLOSE.format(name=name)
    i, j = doc.find(opn), doc.find(cls)
    if i >= 0 and j > i:
        return doc[:i] + _block(name, text) + doc[j + len(cls):]
    k = doc.find(_HEADLINE_HEADING)
    if k < 0:
        raise ForgeError("DEPLOY.md has no 'What was measured' section to "
                         "update")
    k += len(_HEADLINE_HEADING)
    end = doc.find("\n## ", k)
    end = len(doc) if end < 0 else end
    paras = doc[k:end].split("\n\n")
    placed, kept = False, []
    for para in paras:
        if any(para.startswith(pre) for pre in _LEGACY_PARAGRAPHS.get(name,
                                                                      ())):
            if not placed:
                kept.append(_block(name, text))
                placed = True
            continue
        kept.append(para)
    if not placed:
        kept.insert(0, _block(name, text))
    return doc[:k] + "\n\n".join(kept) + doc[end:]


def score_caveats_block_text(score_caveats: list | None) -> str:
    """DEPLOY.md's ``score-caveats`` block: every caveat mt-eval wrote on
    this export's score, in its words (forge's own near-twin reading is the
    paragraph above it) — "" when there is none to say."""
    from .harness_caveats import markdown_lines

    return "\n\n".join(markdown_lines(score_caveats))


#: §5's test line, and what a major caveat adds to it
_TEST_LINE = "Test battery: "
_TEST_LINE_POINTER = (" — ⚠ mt-eval qualifies this score: read its SCORE "
                      "CAVEAT under \"What was measured\" before quoting it")


def refresh_score_caveats(doc: str, score_caveats: list | None,
                          near_twin: dict | None = None) -> str:
    """``doc`` (a DEPLOY.md) with its ``score-caveats`` block set to
    ``score_caveats`` — inserted under the score (after forge's near-twin
    paragraph, else the score line) in a DEPLOY.md written before the block
    existed — and §5's test line pointing at a major one. Used whenever
    forge rewrites an existing DEPLOY.md (a twin-free citation, a person's
    prereg verdict), so an export from before Round 13 gains the caveats
    the harness wrote into its TestReport all along. Unchanged when there
    is nothing to say and no block to clear."""
    from .harness_caveats import majors

    text = score_caveats_block_text(score_caveats)
    opn = _BLOCK_OPEN.format(name="score-caveats")
    if opn in doc:
        doc = _replace_block(doc, "score-caveats", text)
    elif text:
        k = doc.find(_HEADLINE_HEADING)
        if k < 0:
            raise ForgeError("DEPLOY.md has no 'What was measured' section "
                             "to update")
        k += len(_HEADLINE_HEADING)
        end = doc.find("\n## ", k)
        end = len(doc) if end < 0 else end
        paras = doc[k:end].split("\n\n")
        anchors = []
        if near_twin and near_twin.get("message"):
            msg = _sentence(near_twin["message"])
            anchors = [msg, f"**{msg}**"]
        at = next((i for i, para in enumerate(paras)
                   if para.strip() in anchors), None)
        if at is None:
            at = next((i for i, para in enumerate(paras)
                       if para.startswith("Test set ")), -1)
        paras.insert(at + 1, _block("score-caveats", text))
        doc = doc[:k] + "\n\n".join(paras) + doc[end:]
    if majors(score_caveats):
        out = []
        for line in doc.split("\n"):
            if (line.startswith(_TEST_LINE)
                    and not line.endswith(_TEST_LINE_POINTER)):
                line += _TEST_LINE_POINTER
            out.append(line)
        doc = "\n".join(out)
    return doc


def _prereg_paragraph(prereg: dict, export_dir) -> str:
    """The DEPLOY.md prereg line: computed verdicts, and any person's
    recorded verdict counted apart as a person's."""
    from .guards.preregister import counts_text, verdict_counts

    rows = prereg["verdicts"]
    text = (f"Judged against preregistration `{prereg['id']}` "
            f"({prereg.get('bound_by') or 'the prereg this test read was admitted under'}): "
            f"{counts_text(verdict_counts(rows))} — "
            f"`nmt-forge prereg check {prereg['id']} --results {export_dir}`.")
    after = prereg.get("after_reads")
    if after:
        text += (f"\n\n**Not blind predictions:** {_sentence(after['text'])} "
                 "Read the verdicts above as checks against scores that were "
                 "already known, not as predictions that came first.")
    human = [r for r in rows if r.get("verdict") == "manual"
             and r.get("human_verdict")]
    for r in human:
        hv = r["human_verdict"]
        text += (f"\n\n- prediction #{r.get('number')} ({r['metric']}: "
                 f"\"{r['predicted']}\"): **{hv['verdict'].upper()}** — a "
                 f"human verdict by {hv['by']}, {hv['ts']}, recorded in the "
                 "workspace ledger (not computed by forge)"
                 + (f"; note: {hv['note']}" if hv.get("note") else ""))
    return text




def workspace_exports(ws: Workspace) -> list[dict]:
    """Every export the workspace ledger records — the latest per directory
    — that is still on disk: ``{dir, fm (forge-model.json path), doc}``."""
    latest: dict[str, dict] = {}
    for e in ws.ledger.find("export"):
        if e.get("dir"):
            latest[str(Path(e["dir"]).resolve())] = e
    out = []
    for d in latest:
        fm = find_forge_model(d)
        if fm is None:
            continue
        try:
            doc = json.loads(fm.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        out.append({"dir": d, "fm": fm, "doc": doc})
    return out


def _sibling_summary(x: dict) -> dict:
    from .harness_caveats import for_export
    from .scoring_standard import for_export as headline_for_export, short

    doc = x["doc"]
    tr = doc.get("test_report") or {}
    return {"name": doc.get("name"), "run": (doc.get("run") or {}).get("name"),
            # what mt-eval says qualifies that model's score, verbatim — it
            # travels with every citation of the score (Round 13)
            "score_caveats": for_export(x["fm"], doc)["score_caveats"],
            "export_dir": x["dir"],
            "model_dir": (str(x["fm"].parent)
                          if doc.get("model_dir") == "." else None),
            "test_set": tr.get("set"), "n": tr.get("n"),
            # the standard/1 headline — corpus chrF++ with its CI, from
            # that export's mt-eval TestReport (never the first metric
            # listed, never a composite)
            "score": short(headline_for_export(x["fm"], doc)),
            "deploy": (str(x["fm"].parent / "DEPLOY.md")
                       if (x["fm"].parent / "DEPLOY.md").is_file() else None)}


def _twin_free(tr: dict) -> bool:
    nt = tr.get("near_twin") or {}
    return bool(nt.get("checked")) and nt.get("near_twin_rows") == 0


def twin_free_siblings(ws: Workspace, test_set: str, *,
                       exclude_dir=None) -> list[dict]:
    """Other exports in the workspace that scored ``test_set`` with NO test
    row twinned in their training data — the number to quote beside an
    inflated score (Round 6 hospital persona: the full model's DEPLOY.md
    said "never quote the inflated score alone" and named no twin-free
    model, although one was exported from the same workspace)."""
    skip = Path(exclude_dir).resolve() if exclude_dir else None
    out = []
    for x in workspace_exports(ws):
        if skip is not None and Path(x["dir"]) == skip:
            continue
        tr = x["doc"].get("test_report") or {}
        if tr.get("set") == test_set and _twin_free(tr):
            s = _sibling_summary(x)
            if s["score"]:
                out.append(s)
    return out


def _sibling_caveats(siblings: list[dict], *, markdown: bool,
                     attribute: bool = True) -> list[str]:
    """Each cited sibling's harness caveats, in the harness's words, said
    to be THAT model's (the inflated export's own caveats sit just above
    them in DEPLOY.md) — by name when several are cited."""
    from .harness_caveats import markdown_lines, text_lines

    out = []
    for s in siblings:
        lines = (markdown_lines(s.get("score_caveats")) if markdown
                 else text_lines(s.get("score_caveats")))
        name = f"`{s['name']}`" if markdown else str(s["name"])
        if not attribute and len(siblings) == 1:
            out += lines          # the sentence around it names the model
            continue
        whose = f"{name}'s" if len(siblings) > 1 else "that model's"
        out += [f"On {whose} test output — {ln}" for ln in lines]
    return out


def _siblings_major(siblings: list[dict]) -> bool:
    from .harness_caveats import majors

    return any(majors(s.get("score_caveats")) for s in siblings)


def _twin_free_paragraph(siblings: list[dict], test_report: dict,
                         near_twin: dict) -> str:
    """DEPLOY.md's citation of the twin-free model(s) for an inflated one —
    with every caveat mt-eval wrote on the cited score, beside it. A score
    with a MAJOR harness caveat is never "the number to quote" bare, nor
    said to measure how a model handles unseen sentences (Round 13: the
    cited twin-free model gave one of 9 outputs for 150 different
    sources)."""
    from .harness_caveats import QUOTE_WITH_CAVEAT

    from .scoring_standard import cite

    cites = []
    for s in siblings:
        where = s["model_dir"] or s["export_dir"]
        cites.append(f"`{s['name']}` (run `{s['run']}`, {where}): "
                     f"{cite(s['score'])}")
    strict = (" (and this model's own strict subset, above)"
              if near_twin.get("strict") else "")
    one = len(cites) == 1
    major = _siblings_major(siblings)
    caveats = _sibling_caveats(siblings, markdown=True)
    what = (f", labelled as such{strict}: it measures how a model trained "
            "this way handles sentences it has not seen."
            if not major else
            f", labelled as such{strict}, on sentences "
            + ("its" if one else "their")
            + " training never saw — and mt-eval's caveat above qualifies "
              "it: quote the caveat with the score, every time.")
    return ("**The number to quote for new sentences"
            + (f" — but {QUOTE_WITH_CAVEAT}" if major else "") + ":** "
            + "the twin-free " + ("model" if one else "models")
            + " trained in this workspace — " + "; ".join(cites)
            + f" — on this same test set ({_set_label(test_report)}, "
              f"n={test_report['n']}), with no test row twinned in "
            + ("its" if one else "their") + " training data."
            + ("".join(f"\n\n{c}" for c in caveats) + "\n\n"
               if caveats else " ")
            + "That score is "
            + ("that model's" if one else "those models'") + what
            + " This model's own score above is inflated by the twins — "
              "quote the two side by side, never this one alone.")


def twin_free_cited_advice(siblings: list[dict]) -> str:
    """``near_twin.advice`` for an inflated export once a twin-free model of
    the same test set is exported in the workspace: cite it — never "drop
    the twins and retrain" for a model that already exists (Round 8 school
    persona: the all-data export's advice still said retrain, although the
    twin-free model was exported first and DEPLOY.md cited it)."""
    from .scoring_standard import cite

    cites = []
    for s in siblings:
        cites.append(f"{s['name']} (run {s['run']}, "
                     f"{s['model_dir'] or s['export_dir']}): "
                     f"{cite(s['score'])}")
    one = len(cites) == 1
    caveats = _sibling_caveats(siblings, markdown=False, attribute=False)
    if _siblings_major(siblings):
        return ("a twin-free model of this test set is already exported in "
                "this workspace — " + "; ".join(cites) + " — with no test "
                "row twinned in " + ("its" if one else "their")
                + " training data, but mt-eval qualifies "
                + ("its" if one else "their") + " score: "
                + " ".join(caveats) + " Quote "
                + ("that model's score" if one else "those scores")
                + ", labelled as " + ("that model's" if one else "theirs")
                + " and WITH that caveat, beside this one — never this "
                "model's score alone, and never that one without its caveat")
    return ("a twin-free model of this test set is already exported in this "
            "workspace — " + "; ".join(cites) + " — with no test row "
            "twinned in " + ("its" if one else "their") + " training data. "
            + ("".join(c + " " for c in caveats))
            + "Quote " + ("that model's score" if one else "those scores")
            + ", labelled as " + ("that model's" if one else "theirs")
            + ", beside this one as how a model trained this way handles "
            "new sentences — that number already exists. Never quote this "
            "model's score alone")


def _cite_siblings(near_twin: dict, siblings: list[dict]) -> dict:
    """``near_twin`` with its advice replaced by the twin-free citation,
    and the cited exports named (``twin_free_cited``) — the planned-model
    note (:func:`twin_free_planned`) goes: that model is exported now."""
    return {**{k: v for k, v in near_twin.items()
               if k != "twin_free_planned"},
            "advice": twin_free_cited_advice(siblings),
            "twin_free_cited": [s["export_dir"] for s in siblings]}


def twin_free_planned(ws: Workspace, test_set: str, *, this_manifest,
                      judged_by: str | None = None) -> dict | None:
    """The twin-free model of ``test_set`` this workspace already PLANNED —
    the corpus and config ``leak-audit --drop-test-twins`` wrote, the
    preregistration that judges it, the run that trained it — when it is not
    exported yet (an exported one is cited by :func:`twin_free_siblings`).
    None when no twin-free corpus was written for ``test_set``.

    Round 12 (school and hospital personas): the all-data export's advice
    said "drop the twins, retrain, and preregister the new run with
    --allow-after-reads" although the twin-free model was planned AND
    preregistered before any read — in one project trained too — only not
    exported yet. Following it would have written a needless after-reads
    preregistration, said beside every verdict from then on.

    ``{companion_config, clean_to, prereg, prereg_before_reads, trained,
    runs: [{run, manifest, export_cmd}], next}`` — paths and ids only."""
    from .advisor import (_prereg_arg, _rel_to, _resolve_project_path,
                          _same_path, reaudit_command, snapshot)
    from .guards.preregister import after_reads_info, find_for

    s = snapshot(ws)
    st = (s.get("leak_audits") or {}).get(test_set) or {}
    tf = st.get("twin_free")
    if not tf:
        return None
    project = ws.root.parent
    clean = _resolve_project_path(ws, tf["clean_to"])
    runs = [r for r in s.get("runs") or []
            if clean in (r.get("training_files") or [])
            and not _same_path(r["manifest"], this_manifest)]
    if any(r.get("exported") for r in runs):
        return None              # exported: twin_free_siblings cites it
    cc = tf.get("companion_config")
    companion = _rel_to(cc, project) if cc else None
    # its preregistration: pinned to the companion config, else the one
    # binding the set that is not this export's (named after it, if several)
    try:
        docs = find_for(ws, test_set)
    except Exception:
        docs = []
    pinned_hash = None
    if cc:
        from .training.config import RunConfig

        try:
            pinned_hash = RunConfig.from_file(cc).hash()
        except Exception:
            pinned_hash = None
    ids = [d["id"] for d in docs if d.get("id")]
    pinned = [d["id"] for d in docs
              if pinned_hash and d.get("config_hash") == pinned_hash]
    # the preregs left once this export's own is set aside (unknown → none)
    rest = [i for i in ids if i != judged_by] if judged_by else []
    prereg = (pinned[0] if pinned else rest[0] if len(rest) == 1 else None)
    if prereg is None and runs:
        flag = _prereg_arg(ws, s, runs[-1])[0]
        if flag and "<" not in flag:
            prereg = flag.split()[-1]
    if prereg is None and cc and len(rest) > 1:
        from .advisor import _named_after

        try:
            name = json.loads(Path(cc).read_text(encoding="utf-8")).get(
                "run_name")
        except (OSError, json.JSONDecodeError, AttributeError):
            name = None
        named = [i for i in rest if name and _named_after(i, name)]
        prereg = named[0] if len(named) == 1 else None
    before = None
    if prereg:
        try:
            before = after_reads_info(ws, prereg) is None
        except Exception:
            before = None
    run_items = []
    for r in runs:
        out_dir = suggest_export_dir(r["run"], workspace=ws)
        flag = (f" --prereg {prereg}" if prereg
                else _prereg_arg(ws, s, r)[0])
        run_items.append({"run": r["run"], "manifest": r["manifest"],
                          "export_cmd": f"nmt-forge export {r['manifest']}"
                                        f"{flag} --out {out_dir}"})
    if run_items:
        nxt = run_items[-1]["export_cmd"]
    elif companion:
        stale = (f"{reaudit_command(ws, tf)} && "
                 if tf.get("predates_dev") else "")
        nxt = (f"{stale}nmt-forge preflight run --config {companion} && "
               f"nmt-forge run {companion}")
    else:
        nxt = None
    return {"companion_config": cc, "clean_to": tf["clean_to"],
            "prereg": prereg, "prereg_before_reads": before,
            "trained": bool(run_items), "runs": run_items, "next": nxt}


def twin_free_planned_advice(planned: dict, test_set: str) -> str:
    """``near_twin.advice`` for an export whose twin-free sibling is
    planned (:func:`twin_free_planned`) but not exported: name it and its
    actual next step — never a new after-reads preregistration when its own
    was written before the reads."""
    clean = Path(str(planned["clean_to"])).name
    cfg = (Path(str(planned["companion_config"])).name
           if planned.get("companion_config") else None)
    what = (f"{cfg}, trained on {clean}" if cfg else f"trained on {clean}")
    pre = planned.get("prereg")
    if pre and planned.get("prereg_before_reads"):
        judged = (f"judged by preregistration {pre}, written before any "
                  "scoring read — no new preregistration is needed")
    elif pre:
        judged = (f"judged by preregistration {pre} (written after scoring "
                  "reads, under --allow-after-reads — said beside its "
                  "verdicts)")
    else:
        judged = ("no preregistration names it yet: write one before its "
                  f"first score (`nmt-forge prereg new notwins --eval-set "
                  f"{test_set} --predictions <file> --allow-after-reads` — "
                  "this test set has been scored now)")
    if planned.get("trained"):
        runs = ", ".join(r["run"] for r in planned["runs"])
        step = (f"it is trained (run {runs}) but not exported: "
                f"`{planned['next']}`")
    elif planned.get("next"):
        step = (f"it is not trained yet: `{planned['next']}`, then export it"
                + (f" with --prereg {pre}" if pre else ""))
    else:
        step = "it is not trained yet"
    return (f"the twin-free model of this test set is already planned in "
            f"this workspace — {what}, {judged}; {step}. Its score (no test "
            "row twinned in its training data) is the number to quote "
            "beside this one; never quote this model's score alone")


def _twin_block_text(near_twin: dict | None, siblings: list[dict],
                     test_report: dict) -> str | None:
    """What DEPLOY.md's twin block says: the twin-free sibling(s) to quote,
    or — with none — how to get a twin-free number. None when this export's
    score is not inflated."""
    if not near_twin or not near_twin.get("recall_not_translation"):
        return None
    if siblings:
        return _twin_free_paragraph(siblings, test_report, near_twin)
    from .guards.ci_scoring import TWIN_DECISION_NOTE

    parts = []
    if near_twin.get("advice"):
        parts.append(_sentence(near_twin["advice"]))
    parts.append(_sentence(TWIN_DECISION_NOTE))
    return "\n\n".join(parts)


def _headline(test_report: dict | None, near_twin: dict | None,
              prereg: dict | None, export_dir, dev_set, dev_scores,
              coverage: dict | None = None, *,
              siblings: list[dict] | None = None,
              dev_saturation: dict | None = None,
              harness_reads: dict | None = None,
              score_caveats: list | None = None,
              headline: dict | None = None) -> str:
    """DEPLOY.md's first section: the test number WITH its caveats — the
    near-twin share and the strict score travel with it, never apart; every
    caveat mt-eval wrote on it (``score_caveats``, verbatim: a near-constant
    output, length, copies); the twin-free sibling to quote when this score
    is inflated, with ITS caveats; a saturated dev set; and which metrics
    the mt-eval report does and does not carry.

    ``headline``: the scoring standard's headline (``scoring_standard``):
    the mt-eval TestReport's corpus chrF++ with its 95% bootstrap CI and
    sacreBLEU signature, the secondary standard metrics beside it — the
    number this DEPLOY.md quotes first. Without one, the battery's own
    chrF++ (a single-group read) stands in, said as such."""

    sat = []
    if dev_saturation:
        sat = [f"**Dev set saturated:** {_sentence(dev_saturation['message'])}"
               f" To fix it: {_sentence(dev_saturation['advice'])}"]
    if not test_report:
        return "\n\n".join([
            "Not evaluated on a test set (exported with `--no-eval`). "
            f"The only score is the dev set's (`{dev_set}`: "
            f"{_score_line(dev_scores)}), and the dev set chose the "
            "checkpoint — it is not a test result."] + sat)
    from .scoring_standard import HEADLINE_NOTE, from_scores

    groups = test_report.get("groups") or {}
    if headline is None and len(groups) == 1:
        headline = from_scores(next(iter(groups.values())).get("scores"))
    from .scoring_standard import score_line

    if len(groups) == 1:
        # the headline above already gives this read's chrF++
        rest = score_line(next(iter(groups.values())).get("scores"),
                          primary=False)
        scores = (f"Also on this read (forge's battery): {rest}."
                  if rest else "")
    else:
        scores = ("Per group (forge's battery, same read): "
                  + "; ".join(f"{g}: {_score_line(r.get('scores'))}"
                              for g, r in groups.items()) + ".")
    head = (headline or {}).get("text") or "chrF++ —"
    sig = (headline or {}).get("signature")
    beside = (headline or {}).get("secondary_text")
    lines = [f"Test set {_set_label(test_report)} (n={test_report['n']}): "
             f"**{head}** — {HEADLINE_NOTE}"
             + (f"; sacreBLEU signature `{sig}`" if sig else "")
             + (f". Beside it, never blended: {beside}" if beside else "")
             + "."] + ([scores] if scores else [])
    if near_twin:
        msg = _sentence(near_twin["message"])
        lines.append(f"**{msg}**" if near_twin["recall_not_translation"]
                     else msg)
    # what mt-eval says qualifies THIS score, in its own words, right under
    # it (Round 13: a near-constant output no forge surface mentioned) — a
    # block, so a DEPLOY.md forge rewrites later carries them too
    cav = score_caveats_block_text(score_caveats)
    if cav:
        lines.append(_block("score-caveats", cav))
    if near_twin:
        twin = _twin_block_text(near_twin, siblings or [], test_report)
        if twin:
            lines.append(_block("twin-free", twin))
    before_reg = (harness_reads or {}).get("before_registration") or []
    if harness_reads and (harness_reads.get("reads") or before_reg):
        said = []
        if harness_reads.get("reads"):
            kinds = ", ".join(f"{p} ×{n}" for p, n in
                              sorted(harness_reads["by_purpose"].items()))
            said.append(f"{harness_reads['reads']}× ({kinds}; recorded in "
                        "its read log beside the file)")
        if before_reg:
            # found in mt-eval's RunLogs at registration; never counted
            said.append(f"{len(before_reg)}× before forge registered the "
                        "file (found in mt-eval's run logs: "
                        + ", ".join(r["run_id"] for r in before_reg[:3])
                        + (" …" if len(before_reg) > 3 else "")
                        + "; not counted by forge's read accounting)")
        lines.append(
            f"**Not a first look:** before this score, `mt-eval` had already "
            f"scored this test file {' and '.join(said)}. Every read of a "
            "test set can steer later choices — count them when you judge "
            "this number.")
    if prereg:
        lines.append(_block("prereg", _prereg_paragraph(prereg, export_dir)))
    lines += sat
    cov = _coverage_line(coverage)
    if cov:
        lines.append(cov)
    return "\n\n".join(lines)


def refresh_deploy_prereg(ws: Workspace, prereg_id: str) -> list[str]:
    """Rewrite the prereg block of every export's DEPLOY.md judged against
    ``prereg_id`` with the person-recorded verdicts (after `nmt-forge
    prereg verdict`). Returns the DEPLOY.md paths updated."""
    from .guards import preregister

    updated = []
    for x in workspace_exports(ws):
        tr = x["doc"].get("test_report") or {}
        pre = tr.get("prereg") or {}
        deploy = x["fm"].parent / "DEPLOY.md"
        if pre.get("id") != prereg_id or not deploy.is_file():
            continue
        # rows stored before numbering existed get their numbers here
        rows = [{**r, "number": r.get("number") or i}
                for i, r in enumerate(pre.get("verdicts") or [], 1)]
        rows = preregister.attach_human_verdicts(ws, prereg_id, rows)
        text = deploy.read_text(encoding="utf-8")
        # exports written before the override was recorded: read it live
        after = pre.get("after_reads") or preregister.after_reads_info(
            ws, prereg_id)
        try:
            new = _replace_block(text, "prereg", _prereg_paragraph(
                {**pre, "verdicts": rows, "after_reads": after}, x["dir"]))
            new = _refresh_own_caveats(new, x)
        except ForgeError as e:
            updated.append(f"{deploy} NOT updated: {e}")
            continue
        if new != text:
            deploy.write_text(new, encoding="utf-8")
            updated.append(str(deploy))
    return updated


def cite_in_inflated_siblings(ws: Workspace, this: dict) -> list[str]:
    """After a twin-free export: rewrite the twin block of every inflated
    export of the same test set already in the workspace, so its DEPLOY.md
    names this model's score as the number to quote — and the near-twin
    advice in its forge-model.json, which said "drop the twins and retrain"
    for a model that now exists (Round 8). Returns one path per export
    updated (its DEPLOY.md, or its forge-model.json when only that changed
    or it has no DEPLOY.md), ledgered as ``deploy-note``; a file that could
    not be rewritten is returned as ``"<path> NOT updated: <why>"``."""
    updated = []
    for x in workspace_exports(ws):
        if Path(x["dir"]) == Path(this["export_dir"]).resolve():
            continue
        tr = x["doc"].get("test_report") or {}
        nt = tr.get("near_twin") or {}
        if (tr.get("set") != this["test_set"]
                or not nt.get("recall_not_translation")):
            continue
        siblings = twin_free_siblings(ws, tr["set"], exclude_dir=x["dir"])
        if not siblings:
            continue
        changed: list[str] = []
        fm_note = _cite_in_forge_model(x, nt, siblings)
        if fm_note and " NOT updated: " in fm_note:
            updated.append(fm_note)          # said, never swallowed
        elif fm_note:
            changed.append(fm_note)
        deploy = x["fm"].parent / "DEPLOY.md"
        if deploy.is_file():
            label_tr = {"eval_set": tr.get("set"), "n": tr.get("n"),
                        "dataset_id": tr.get("dataset_id")}
            text = deploy.read_text(encoding="utf-8")
            try:
                new = _replace_block(
                    text, "twin-free",
                    _twin_free_paragraph(siblings, label_tr, nt))
                # its OWN score's caveats too (a DEPLOY.md written before
                # Round 13 never carried them)
                new = _refresh_own_caveats(new, x)
            except ForgeError as e:
                # said, never swallowed: the export itself is complete
                updated.append(f"{deploy} NOT updated: {e}")
            else:
                if new != text:
                    deploy.write_text(new, encoding="utf-8")
                    changed.insert(0, str(deploy))
        if changed:
            ws.ledger.append("deploy-note", dir=x["dir"],
                             kind="twin-free-sibling", files=changed,
                             **({"deploy": str(deploy)}
                                if str(deploy) in changed else {}),
                             cites=[s["export_dir"] for s in siblings])
            updated.append(changed[0])
    return updated


def _refresh_own_caveats(doc: str, x: dict) -> str:
    """:func:`refresh_score_caveats` with an export's own harness caveats
    (forge-model.json, else its TestReport)."""
    from .harness_caveats import for_export

    tr = x["doc"].get("test_report") or {}
    return refresh_score_caveats(
        doc, for_export(x["fm"], x["doc"])["score_caveats"],
        tr.get("near_twin"))


def _cite_in_forge_model(x: dict, near_twin: dict,
                         siblings: list[dict]) -> str | None:
    """Rewrite an inflated export's forge-model.json near-twin advice to
    cite ``siblings``. Returns its path when rewritten, None when it already
    said so, or ``"<path> NOT updated: <why>"`` (said, never swallowed)."""
    cited = _cite_siblings(near_twin, siblings)
    if (near_twin.get("advice") == cited["advice"]
            and near_twin.get("twin_free_cited") == cited["twin_free_cited"]):
        return None
    doc = dict(x["doc"])
    doc["test_report"] = {**(doc.get("test_report") or {}),
                          "near_twin": cited}
    try:
        x["fm"].write_text(json.dumps(doc, indent=2, ensure_ascii=False)
                           + "\n", encoding="utf-8")
    except OSError as e:
        return f"{x['fm']} NOT updated: {type(e).__name__}: {e}"
    return str(x["fm"])


def _battery_mark(cfg: RunConfig) -> dict:
    """The terms of the config's test battery file (for an export that did
    not read it, `--no-eval`), or {} — never fatal: DEPLOY.md then shows
    the hosted fallback first, as for an unmarked set."""
    battery = (cfg.eval_battery or {}).get("battery")
    if not battery:
        return {}
    try:
        from .privacy import carried_mark

        entry = Workspace(cfg.workspace).registry.get(battery)
        return carried_mark(entry["path"])
    except Exception:
        return {}


def _terms_text(mark: dict | None) -> str:
    return ", ".join(f"{k} {v}" for k, v in (mark or {}).items())


def _copy_rule(evaluated: bool, mark: dict | None) -> str:
    """DEPLOY.md's "what to copy" section."""
    if not evaluated:
        return ("Copy this folder, and only it, to the machine that serves "
                "the model. This export was not scored on a test set "
                "(`--no-eval`), so there is no evaluation folder beside it.")
    text = (
        f"Copy this folder — `{MODEL_SUBDIR}/` — and only it, to the machine "
        f"that serves the model.\n\n`../{EVALUATION_SUBDIR}/` beside it is "
        "the evaluation evidence: your test set's sentences, the model's "
        "translations of them, and the battery and mt-eval reports. It is "
        "not part of the model, and the model never reads it. **Never copy "
        f"`../{EVALUATION_SUBDIR}/` with the model** — not to a server, a "
        "shared drive, a container image or a repository. Keep it with your "
        "test set, under the test set's terms.")
    if mark:
        text += (f" Your test set is marked ({_terms_text(mark)}): every file "
                 f"in `../{EVALUATION_SUBDIR}/` carries that mark as a "
                 "`.champollion.json` sidecar, so the mark travels if a file "
                 "is moved — moving them is still the leak this rule "
                 "prevents.")
    return text


EXPORT_README = """\
# nmt-forge export of run `{run}`

{model_line}
{evaluation_line}
"""

EVALUATION_README = """\
# Evaluation evidence for `{name}` — do not copy this folder with the model

This folder holds your test set's text: {evidence_for}. Keep it with your
test set, under the test set's terms: never on the serving machine, a shared
drive, a container image or in a repository.{mark_line}

- `battery-hyps.jsonl` — the model's translation of every test sentence.
- `battery-hyps-battery.json` / `battery-hyps-battery.md` — forge's battery
  report: scores with 95% confidence intervals, per group, and the
  Diagnosis & Recommendations.
- `runlog.json` — an mt-eval RunLog (sources, references, outputs), built by
  mt-eval-harness's own `build_run_log` from forge's one gated read of the
  test set.
- `runlog_report.json` — the mt-eval TestReport, computed by
  mt-eval-harness's own `analyze_run_log` with the metric plugins
  `mt-eval run` loads for this language.
- `analysis.log` — what the harness printed while it chose the metrics and
  scored.{forge_model_line}

## Metrics

{coverage}

`config.dataset_id` in the RunLog and TestReport is the id `mt-eval` knows
the set by (its registered corpora card's id, when it has one); nmt-forge's
own name for it is `provenance.nmt_forge.set` / `overall.nmt_forge_set`.
The files record the test set's terms (`config.transmission_policy`,
`provenance.dataset_meta`): for a local-only, sealed or consent-required
test set, `mt-eval` keeps its sentences off its terminal output too.

Use them with mt-eval:

    mt-eval compare runlog_report.json <another_report.json>
    mt-eval export runlog_report.json --name <plugin-name> --type llm --locales <code>

(Publishing to the public board is a separate, deliberate act with its own
integrity gates — a private test set is not a public benchmark.)
"""


def _coverage_block(coverage: dict | None) -> str:
    """The evaluation README's metric list: computed, and every metric not
    computed with why and the one command that computes it."""
    if not coverage:
        return "No mt-eval report was written."
    lines = ["Computed: " + (", ".join(coverage["computed"]) or "none")
             + "."]
    if not coverage["not_computed"]:
        lines.append("\nEvery metric `mt-eval run` would compute for this "
                     "language is in the report.")
        return "\n".join(lines)
    lines.append("\nNot computed (also listed in the TestReport's "
                 "`overall.nmt_forge_metrics_not_computed`):\n")
    for m in coverage["not_computed"]:
        lines.append(f"- **{m['metric']}** — {m['why']}")
        if m.get("command"):
            lines.append(f"\n      {m['command']}\n")
            if m.get("note"):
                lines.append(f"  ({m['note']})")
        elif m.get("note"):
            lines.append(f"  ({m['note']})")
    lines.append("\nRun from the directory you ran `nmt-forge export` in. "
                 "`mt-eval test` re-scores the outputs already written "
                 "(no second decode) into `runlog_report_full.json`, beside "
                 "the report forge wrote.")
    return "\n".join(lines)


def export_run(run_manifest_path: str | Path, out_dir: str | Path, **kw
               ) -> dict:
    """Package a run (see module docstring). Returns a content-free summary.

    All-or-nothing: if any step fails, the directory this call created (or
    emptied with ``force``) is removed again — a half-written export
    (an evaluation but no model, or a model with no forge-model.json) must
    never look deployable. The model is copied BEFORE the test set is read,
    so a packaging failure never costs a sealed set's one read."""
    out = Path(out_dir)
    state = {"own": not out.exists() or not any(out.iterdir())}
    try:
        return _export_run(run_manifest_path, out, state=state, **kw)
    except BaseException:
        if state["own"] and out.exists():
            shutil.rmtree(out, ignore_errors=True)
        raise


def _rel(path: Path, base: Path) -> str:
    """``path`` relative to ``base``, POSIX-style (forge-model.json's
    pointers are relative to the forge-model.json itself)."""
    import os

    return Path(os.path.relpath(path, base)).as_posix()


def _export_run(run_manifest_path: str | Path, out_dir: str | Path, *,
                state: dict, config_path: str | Path | None = None,
                evaluate_battery: bool = True, include_model: bool = True,
                endpoint: str | None = None, port: int = DEFAULT_PORT,
                name: str | None = None, force: bool = False,
                glossary: str | Path | None = None,
                prereg_id: str | None = None) -> dict:
    rmpath = Path(run_manifest_path)
    try:
        run_manifest = json.loads(rmpath.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise ForgeError(f"{rmpath}: not a readable run manifest ({e})") from e
    if "selected_checkpoint" not in run_manifest:
        raise ForgeError(f"{rmpath}: not a run manifest (no "
                         "selected_checkpoint) — pass the run-manifest.json "
                         "written by `nmt-forge run`")
    cfg = (RunConfig.from_file(config_path) if config_path
           else RunConfig.from_dict(run_manifest["config"]))
    backend = (cfg.model or {}).get("backend")
    if include_model and backend not in HF_BACKENDS:
        raise ForgeError(
            f"backend {backend!r} produced no model weights to export\n"
            "  why: the dummy backend is a test double — there is nothing to "
            "deploy\n"
            "  fix: train with an HF preset (nmt-forge init <code> --model "
            "cpu-tiny), or export the evaluation only with --no-model")
    if evaluate_battery and not cfg.eval_battery:
        raise ForgeError(
            "the config has no eval block, so there is no test battery "
            "to evaluate\n"
            '  fix: add "eval": {"battery": "<registered test set>"} to '
            "the config, or export with --no-eval (model only, no "
            "mt-eval report)")
    if glossary and not evaluate_battery:
        raise ForgeError(
            "--glossary scores terminology in the mt-eval report, and "
            "--no-eval writes none\n"
            "  fix: drop --glossary, or drop --no-eval")

    out = Path(out_dir)
    if out.exists() and any(out.iterdir()):
        if not force:
            held = find_forge_model(out)
            held_run = None
            if held is not None:
                try:
                    held_run = (json.loads(held.read_text(encoding="utf-8"))
                                .get("run") or {}).get("name")
                except (OSError, json.JSONDecodeError):
                    held_run = None
            fresh = suggest_export_dir(
                run_manifest.get("run_name") or cfg.run_name,
                workspace=Workspace(cfg.workspace))
            raise ForgeError(
                f"{out} exists and is not empty"
                + (f" — it holds the export of run {held_run!r}"
                   if held_run else "") + "\n"
                "  why: an export is one run's model + its measurements; "
                "mixing two exports in one directory would mislabel both\n"
                f"  fix: export this run to a fresh folder — --out {fresh} "
                f"(nmt-forge export {rmpath} --out {fresh}) — or pass "
                "--force to REPLACE what is there"
                + (f" (run {held_run!r}'s model and evaluation would be "
                   "deleted)" if held_run else ""))
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    state["own"] = True       # created or emptied here: ours to clean up
    lang = cfg.language or {}
    target = str(lang.get("target") or "")
    source = str(lang.get("source") or "")
    run_name = run_manifest.get("run_name") or cfg.run_name
    config_hash = run_manifest.get("config_hash") or cfg.hash()
    model_name = _kebab(name or f"nmt-forge-{run_name}")
    model_dir = out / MODEL_SUBDIR
    eval_dir = out / EVALUATION_SUBDIR
    summary: dict = {"export_dir": str(out), "name": model_name,
                     "run": run_name, "config_hash": config_hash,
                     "evaluated": False, "model_included": include_model}

    # the model first: a failed copy or LoRA merge refuses before the test
    # set is read (a sealed set has one read)
    model_info: dict = {}
    if include_model:
        model_info = _copy_model(Path(run_manifest["selected_path"]),
                                 model_dir, cfg.model)
        # the decode length forge measured with, declared where any engine
        # reads it — a contest node's declarative engine included (Round 10
        # researcher: the node decoded a forge model at transformers' default
        # length, ~20 tokens, while forge selected it at its own cap)
        declared = declare_decode_length(model_dir,
                                         cfg.decode.max_new_tokens)
        if declared:
            model_info["generation_config"] = declared
        summary["model_dir"] = str(model_dir)

    # forge-model.json sits in the deployable directory; without a model,
    # beside the evidence; with neither, at the export root
    fm_dir = (model_dir if include_model
              else eval_dir if evaluate_battery else out)

    test_report = None
    outside_reads = None
    harness = None
    score_caveats = None
    headline = None
    near_twin = None
    prereg_block = None
    coverage = None
    mark = None
    siblings: list[dict] = []
    # the run's dev reading: a saturated dev set chose nothing (Round 6)
    from .guards.ci_scoring import run_dev_saturation

    dev_sat = run_dev_saturation(run_manifest)
    summary["dev_saturation"] = dev_sat
    if evaluate_battery:
        from .training.evaluate import evaluate

        eval_dir.mkdir(exist_ok=True)
        report, paths = evaluate(
            rmpath, config_path=config_path,
            out_hyps=eval_dir / "battery-hyps.jsonl",
            harness_out=eval_dir, glossary=glossary, command="export",
            prereg_id=prereg_id)
        test_report = report.to_manifest()
        from .guards import preregister
        from .guards.ci_scoring import near_twin_summary

        near_twin = near_twin_summary(test_report)
        # reads mt-eval made of this test file before this score (the read
        # log beside the file): this score is then not a first look
        outside_reads = Workspace(cfg.workspace).registry.harness_reads(
            report.eval_set)
        summary["harness_reads"] = outside_reads
        if report.prereg_id:
            # the prereg the gate admitted this very read under — verdicts
            # from this report, so `export` closes the prereg loop itself
            pws = Workspace(cfg.workspace)
            prereg_block = {
                "id": report.prereg_id,
                "bound_by": report.prereg_bound_by,
                # a person's verdicts already recorded (a re-export) ride
                # along, labelled as theirs
                "verdicts": preregister.attach_human_verdicts(
                    pws, report.prereg_id, preregister.check(
                        preregister.load(pws, report.prereg_id),
                        subsets=preregister.scores_by_subset(test_report))),
                # written after scoring reads (--allow-after-reads): said
                # beside the verdicts everywhere (Round 9), else null
                "after_reads": preregister.after_reads_info(
                    pws, report.prereg_id)}
        if near_twin.get("recall_not_translation"):
            # the twin-free model(s) already exported from this workspace
            # on the same test set: THE number to quote beside this one
            siblings = twin_free_siblings(Workspace(cfg.workspace),
                                          report.eval_set, exclude_dir=out)
            if siblings:
                # the summary, forge-model.json and the MCP result cite the
                # twin-free model instead of advising a retrain
                near_twin = _cite_siblings(near_twin, siblings)
        if not siblings and near_twin.get("advice"):
            # a twin-free model planned (and preregistered, perhaps trained)
            # but not exported yet: its next step, never "retrain and
            # preregister with --allow-after-reads" (Round 12)
            try:
                planned = twin_free_planned(
                    Workspace(cfg.workspace), report.eval_set,
                    this_manifest=rmpath, judged_by=report.prereg_id)
            except Exception as e:     # the test set is read already: an
                # advice lookup must not fail the export — said, not hidden
                planned = None
                near_twin = {**near_twin, "twin_free_planned_error":
                             f"{type(e).__name__}: {e}"}
            if planned:
                near_twin = {**near_twin, "twin_free_planned": planned,
                             "advice": twin_free_planned_advice(
                                 planned, report.eval_set)}
        coverage = paths.get("harness_metrics")
        mark = paths.get("mark")
        # what the harness says qualifies this score — verbatim, relayed in
        # the summary, forge-model.json and DEPLOY.md (None: it wrote none)
        score_caveats = paths.get("harness_score_caveats")
        # the scoring standard's headline (standard/1): the TestReport's
        # corpus chrF++ with its 95% CI and sacreBLEU signature — the one
        # number the summary, forge-model.json and DEPLOY.md quote first
        headline = paths.get("harness_headline")
        if headline is None and len(test_report["groups"]) == 1:
            from .scoring_standard import from_scores

            headline = from_scores(
                next(iter(test_report["groups"].values())).get("scores"))
        harness = {"runlog": _rel(eval_dir / "runlog.json", fm_dir),
                   "test_report": _rel(eval_dir / "runlog_report.json",
                                       fm_dir),
                   "harness_version": paths.get("harness_version"),
                   "metrics": coverage}
        summary.update(evaluated=True, battery=report.eval_set,
                       dataset_id=report.dataset_id or report.eval_set,
                       dataset_id_source=report.dataset_id_source,
                       headline=headline,
                       evaluation_dir=str(eval_dir),
                       battery_report=paths["manifest"],
                       harness_report=paths.get("harness_report"),
                       harness_runlog=paths.get("harness_runlog"),
                       harness_metrics=coverage,
                       evaluation_mark=mark,
                       evaluation_sidecars=paths.get("sidecars", []),
                       test_weighted={k: v for k, v in report.weighted.items()
                                      if isinstance(v, (int, float))},
                       test_groups={g: r.get("scores") for g, r in
                                    test_report["groups"].items()},
                       near_twin=near_twin, prereg=prereg_block,
                       twin_free_siblings=siblings,
                       score_caveats=score_caveats,
                       # the hypotheses `nmt-forge compare` takes as
                       # --hyps-a/--hyps-b (Round 13: the summary named the
                       # reports, and the persona guessed this file)
                       hypotheses=str(eval_dir / "battery-hyps.jsonl"),
                       compare_hint=(
                           "nmt-forge compare --eval-set "
                           f"{report.eval_set} --hyps-a "
                           f"{eval_dir / 'battery-hyps.jsonl'} --hyps-b "
                           "<another export>/evaluation/battery-hyps.jsonl "
                           "--label-a <this model> --label-b <the other>"))

    source_locales = _locales_for(source)
    target_locales = _locales_for(target)
    endpoint = endpoint or f"http://127.0.0.1:{port}/translate"
    decode = {"max_new_tokens": cfg.decode.max_new_tokens,
              "num_beams": cfg.decode.num_beams,
              "hook": cfg.decode.hook}
    serve_params = {k: cfg.model[k] for k in
                    ("max_src", "max_tgt", "src_lang", "tgt_lang", "max_len")
                    if k in (cfg.model or {})}

    if include_model:
        plugin_dir = model_dir / PLUGIN_SUBDIR
        plugin_dir.mkdir(exist_ok=True)
        method = _method_manifest(
            model_name, endpoint=endpoint, locales=target_locales,
            report_path=(eval_dir / "runlog_report.json"
                         if harness else None),
            description=f"nmt-forge {backend} model {run_name} "
                        f"({source}→{target}), served by `nmt-forge serve`")
        (plugin_dir / "method.json").write_text(
            json.dumps(method, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
        test_line = ""
        if test_report:
            from .harness_caveats import majors

            from .scoring_standard import score_line

            tgroups = test_report["groups"]
            rest = ("; battery: " + "; ".join(
                f"{g}: {_score_line(r.get('scores'))}"
                for g, r in tgroups.items()) if len(tgroups) > 1 else
                (lambda r: f"; also {r}" if r else "")(score_line(
                    next(iter(tgroups.values())).get("scores"),
                    primary=False)))
            test_line = (f"Test battery: {_set_label(test_report)} "
                         f"(n={test_report['n']}) — headline "
                         f"{(headline or {}).get('text') or 'chrF++ —'}"
                         " (corpus chrF++, 95% CI)" + rest)
            if majors(score_caveats):
                test_line += _TEST_LINE_POINTER
        dev_set = (run_manifest.get("dev_set") or {}).get("name")
        dev_scores = (run_manifest.get("dev_report") or {}).get("scores")
        deploy_source_locale = (source_locales[1] if len(source_locales) > 1
                                else source or "en")
        # the test set's terms decide which fallback DEPLOY.md shows first
        local_only = local_only_reason(mark if test_report else
                                       _battery_mark(cfg))
        summary["fallback"] = ("local" if local_only else "hosted")
        summary["local_only"] = local_only or None
        evidence_line = (
            "The evaluation evidence — forge's battery report and the "
            "mt-eval RunLog + TestReport — is in "
            f"`../{EVALUATION_SUBDIR}/` beside this folder (never copied "
            f"with it): `mt-eval compare ../{EVALUATION_SUBDIR}/"
            "runlog_report.json <other report>` compares this model with any "
            "other mt-eval run." if test_report else "")
        (model_dir / "DEPLOY.md").write_text(DEPLOY_TEMPLATE.format(
            name=model_name, source=source or "?", target=target or "?",
            forge_version=FORGE_VERSION, run=run_name,
            config_hash=config_hash[:12], dir=model_dir, port=port,
            plugin_subdir=PLUGIN_SUBDIR,
            source_locale=deploy_source_locale,
            copy_rule=_copy_rule(bool(test_report), mark),
            headline=_headline(test_report, near_twin, prereg_block, out,
                               dev_set, dev_scores, coverage,
                               siblings=siblings, dev_saturation=dev_sat,
                               harness_reads=outside_reads,
                               score_caveats=score_caveats,
                               headline=headline),
            caveats="\n".join(f"- {c}" for c in CAVEATS),
            dev_set=dev_set, dev_scores=_score_line(dev_scores)
            + (" — ⚠ SATURATED: checkpoint selection had nothing to choose "
               "between; this is not evidence the model is perfect (see "
               "\"What was measured\")" if dev_sat else ""),
            test_line=test_line, evidence_line=evidence_line,
            fallback_section=fallback_section(
                source_locale=deploy_source_locale, target=target or "?",
                port=port, fallback_model=_fallback_example_model(),
                local_only=local_only),
            contest_section=contest_section(
                model_dir, sorted(p.name for p in model_dir.iterdir()
                                  if p.is_file()))),
            encoding="utf-8")
        summary.update(method_manifest=str(plugin_dir / "method.json"),
                       deploy=str(model_dir / "DEPLOY.md"),
                       serve=f"nmt-forge serve {model_dir}")

    fm = {
        "format": EXPORT_FORMAT,
        "name": model_name,
        "exported_utc": datetime.now(timezone.utc).isoformat(
            timespec="seconds"),
        "nmt_forge_version": FORGE_VERSION,
        "run": {"name": run_name, "config_hash": config_hash,
                "manifest": str(rmpath.resolve()),
                "selected_checkpoint": run_manifest.get("selected_checkpoint"),
                "backend": backend,
                "base": (cfg.model or {}).get("base"),
                "git_commit": run_manifest.get("git_commit")},
        "language": {"source": source, "target": target,
                     "target_name": lang.get("target_name"),
                     "source_locales": source_locales,
                     "target_locales": target_locales},
        # relative to THIS file: "." = the directory it sits in
        "model_dir": "." if include_model else None,
        "model_params": serve_params,
        "model_export": model_info,
        "decode": decode,
        "dev_report": {"set": run_manifest.get("dev_set"),
                       "scores": (run_manifest.get("dev_report") or {})
                       .get("scores"),
                       "saturation": dev_sat},
        "test_report": ({"set": test_report["eval_set"],
                         "dataset_id": test_report.get("dataset_id")
                         or test_report["eval_set"],
                         "dataset_id_source":
                             test_report.get("dataset_id_source"),
                         "n": test_report["n"],
                         # scoring standard/1: THE number — corpus chrF++,
                         # its 95% bootstrap CI and sacreBLEU signature, the
                         # secondary standard metrics beside it; no
                         # composite, no quality tier
                         "scoring_standard": (headline or {}).get(
                             "scoring_standard"),
                         "headline": headline,
                         "groups": {g: r.get("scores") for g, r in
                                    test_report["groups"].items()},
                         "strict_groups": {g: r.get("scores") for g, r in
                                           test_report.get("strict_groups",
                                                           {}).items()},
                         "weighted": test_report["weighted"],
                         "strict_overall": (test_report.get("strict_overall")
                                            or {}).get("scores"),
                         "near_twin": near_twin,
                         # mt-eval's caveats on this score, verbatim (None:
                         # the TestReport carries none) — status, report,
                         # compare and a later twin-free citation read them
                         "score_caveats": score_caveats,
                         "prereg": prereg_block,
                         "harness_reads": outside_reads,
                         "battery_manifest": _rel(
                             eval_dir / "battery-hyps-battery.json", fm_dir)}
                        if test_report else None),
        "harness": harness,
        # where the test set's text went — NOT deployed with the model
        "evaluation": ({"dir": _rel(eval_dir, fm_dir), "deployed": False,
                        "note": "the test set's sentences and the model's "
                                "outputs on them: they stay on the machine "
                                "that exported the model and are never "
                                "copied with it",
                        "mark": mark}
                       if test_report else None),
        "data_rights": cfg.data_rights,
        "caveats": CAVEATS,
        "serve": ({"command": f"nmt-forge serve {model_dir}",
                   "endpoint": endpoint,
                   "openai_base": endpoint.rsplit("/translate", 1)[0] + "/v1"}
                  if include_model else None),
    }
    fm_dir.mkdir(parents=True, exist_ok=True)
    (fm_dir / FORGE_MODEL).write_text(
        json.dumps(fm, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary["forge_model"] = str(fm_dir / FORGE_MODEL)

    if test_report:
        (eval_dir / "README.md").write_text(EVALUATION_README.format(
            name=model_name,
            evidence_for=(
                "the evidence behind the numbers in "
                f"`../{MODEL_SUBDIR}/forge-model.json` and "
                f"`../{MODEL_SUBDIR}/DEPLOY.md`. It is not part of the model "
                f"— the model in `../{MODEL_SUBDIR}/` was exported without "
                "it and runs without it" if include_model else
                "the evidence behind the numbers in `forge-model.json` "
                "(exported with `--no-model`, so there is no model beside "
                "it)"),
            mark_line=(f"\n\nThe test set is marked ({_terms_text(mark)}): "
                       "every file here carries that mark as a "
                       "`.champollion.json` sidecar, so it travels with the "
                       "file." if mark else ""),
            forge_model_line=(
                "\n- `forge-model.json` — what was measured, as numbers "
                "(exported with `--no-model`: there is no model to deploy)."
                if not include_model else ""),
            coverage=_coverage_block(coverage)), encoding="utf-8")
    model_line = (
        f"- `{MODEL_SUBDIR}/` — the model to deploy. Copy this folder, and "
        "only this folder, to the machine that serves it: weights, "
        "tokenizer, `forge-model.json` (serving settings, and what was "
        "measured — as numbers), `DEPLOY.md` (how to serve it and use it "
        f"from the champollion CLI) and `{PLUGIN_SUBDIR}/method.json`. It "
        "holds no sentence from your test set."
        if include_model else
        f"- no `{MODEL_SUBDIR}/`: exported with `--no-model` — there is "
        "nothing to deploy.")
    evaluation_line = (
        f"- `{EVALUATION_SUBDIR}/` — the evidence: your test set's "
        "sentences, the model's translations of them, the battery report "
        "and the mt-eval RunLog + TestReport. It stays on this machine, "
        "under your test set's terms. **Never copy it with the model** — "
        "not to a server, a shared drive, a container image or a "
        "repository." if test_report else
        f"- no `{EVALUATION_SUBDIR}/`: exported with `--no-eval` — the "
        "model was not scored on a test set.")
    (out / "README.md").write_text(EXPORT_README.format(
        run=run_name, model_line=model_line,
        evaluation_line=evaluation_line), encoding="utf-8")

    ws = Workspace(cfg.workspace)
    ws.ledger.append("export", run=run_name, config_hash=config_hash,
                     run_manifest=str(rmpath.resolve()),
                     dir=str(out.resolve()),
                     model_dir=(str(model_dir.resolve()) if include_model
                                else None),
                     evaluated=summary["evaluated"],
                     model_included=include_model)
    if test_report and _twin_free({"near_twin": near_twin}):
        # a twin-free model: the inflated exports of this test set already
        # in the workspace now name its score as the number to quote
        summary["cited_in"] = cite_in_inflated_siblings(ws, {
            "export_dir": str(out), "test_set": report.eval_set})
    return summary
