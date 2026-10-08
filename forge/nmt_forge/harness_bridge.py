"""The bridge from a forge evaluation to the rest of the ecosystem: an
mt-eval RunLog + TestReport.

forge's own battery manifest is forge-shaped (per-register CIs, the lint
diagnosis); ``mt-eval`` speaks RunLog/TestReport. Rather than imitate those
formats, forge hands its decoded rows to the HARNESS's own writers —
``mt_eval_harness.pipeline.build_run_log`` and
``mt_eval_harness.tester.analyze_run_log`` — so the files are exactly what
``mt-eval run`` would have produced for the same outputs: ``mt-eval
compare``, ``mt-eval export`` and the dashboard read them natively, and
every metric in the TestReport is the harness's computation, not forge's.

Discipline:
- the rows come from the SAME gated, ledgered read that produced forge's
  battery score (``score_battery(keep_entries=True)``) — building the
  harness report is not a second look at the test set;
- the RunLog/TestReport contain the eval set's text (sources, references,
  outputs). They are written only to the directory the user names, with a
  README saying so; never into the content-free workspace;
- the harness analysis never prompts: forge runs it with a non-interactive
  stdin (the harness offers to pip-install COMET on a TTY) and keeps its
  console summary in ``analysis.log`` instead of the forge output. If COMET
  is installed, the harness computes it, exactly as ``mt-eval`` would.
- the metric battery is the one ``mt-eval run`` loads for the target
  language: ``plugin_discovery.discover_metric_plugins`` (the FST when it is
  installed, the card's referee metrics unless the test set's terms withhold
  them, code-switching, hallucination, terminology when a glossary is given,
  writing style). It is discovered BEFORE the gated read, so a referee the
  harness cannot load refuses before a sealed set is spent. Whatever the
  report does not carry is listed — metric, why, and the one command that
  computes it (``metric_coverage``); nothing is left out silently. Before
  2026-10-03 the bridge passed no plugins at all, and a school's export had
  chrF++/BLEU/TER/exact match but no FST, hallucination or terminology score
  (synthetic school persona, Round 3).
"""

from __future__ import annotations

import contextlib
import io
import json
import shlex
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from . import _harness
from .errors import ForgeError

#: The harness's own corpus-level metrics an ``mt-eval run`` reports by
#: default (TestReport ``overall`` key → the name people know it by).
#: Opt-in comparators (FUSE, MetricX) and reference-free QE (computed only
#: for runs WITHOUT references) are not part of that default.
HARNESS_BASE_METRICS = (
    ("corpus_chrf", "chrF++"), ("corpus_bleu", "BLEU"), ("corpus_ter", "TER"),
    ("exact_match_rate", "exact match"), ("corpus_spbleu", "spBLEU"),
    ("corpus_chrf_plain", "chrF"), ("comet_score", "COMET"))

#: The harness's FST metric plugin (plugins/giellalt_fst.py ``name``).
FST_PLUGIN = "giellalt_fst_validity"
TERMINOLOGY_PLUGIN = "terminology"

HARNESS_README = """\
# mt-eval files for this nmt-forge evaluation

- `runlog.json` — an mt-eval RunLog (one result per eval row), built by
  mt-eval-harness's own `build_run_log` from forge's gated test read.
- `runlog_report.json` — the mt-eval TestReport, computed by
  mt-eval-harness's own `analyze_run_log`. Its headline is corpus chrF++
  (`overall.corpus_chrf`) with its 95% bootstrap CI
  (`overall.confidence_intervals.corpus_chrf`) and sacreBLEU signature
  (`overall.sacrebleu_signatures.chrf`) — scoring standard/1. BLEU, spBLEU,
  TER and COMET (if you installed it) are reported beside it, never blended;
  exact match and the plugin metrics are diagnostics.
- `analysis.log` — the harness's console summary of that analysis.

**These files contain your eval set's text** (sources and references) and
the model's outputs. Treat them under your test set's terms — do not commit
them or share them if the test set is private. They record those terms
(`config.transmission_policy`, `provenance.dataset_meta`): for a local-only,
sealed or consent-required test set, `mt-eval` keeps the sentences off its
terminal output too.

`config.dataset_id` is the id `mt-eval` knows the set by (its registered
corpora card's id, when it has one); nmt-forge's own name for it is
`provenance.nmt_forge.set` / `overall.nmt_forge_set`.

Use them with mt-eval:

    mt-eval compare runlog_report.json <another_report.json>
    mt-eval export runlog_report.json --name <plugin-name> --type llm --locales <code>

(Publishing to the public board is a separate, deliberate act with its own
integrity gates — a private test set is not a public benchmark.)
"""


def overall_caveat_fields(near_twin: dict) -> dict:
    """The near-twin reading as extra TestReport ``overall`` fields, named
    so nobody mistakes them for the harness's own: the harness, ``mt-eval
    compare``/``export`` and ``publish`` read ``overall`` by key and ignore
    keys they do not know, so these ride next to ``corpus_chrf`` without
    changing the run card — they exist so the caveat travels with the
    number (synthetic users, 2026-10: a 150/150 near-twinned test set
    showed a bare corpus_chrf 100.0 here)."""
    strict = near_twin.get("strict") or {}
    return {
        "nmt_forge_near_twin_checked": bool(near_twin.get("checked")),
        "nmt_forge_near_twin_rows": near_twin.get("near_twin_rows"),
        "nmt_forge_near_twin_share": near_twin.get("near_twin_share"),
        "nmt_forge_strict_n": near_twin.get("strict_n"),
        "nmt_forge_strict_corpus_chrf": strict.get("score"),
        "nmt_forge_strict_corpus_chrf_ci": (
            [strict["ci_lower"], strict["ci_upper"]]
            if "ci_lower" in strict else None),
        "nmt_forge_recall_not_translation": bool(
            near_twin.get("recall_not_translation")),
        "nmt_forge_score_caveat": near_twin.get("message"),
    }


#: How forge's in-process decode is described to the harness's transmission
#: record: nothing is sent anywhere, so every corpus class is admissible.
LOCAL_DECODE_BASIS = ("decoded in-process by nmt-forge on this machine — "
                      "nothing was transmitted")


def _local_transmission_record(path, dataset_id: str) -> dict:
    """The harness's transmission record for this forge decode: the corpus's
    resolved policy (``_harness.corpus_transmission_policy``) enforced for a
    verified-local channel. Recorded so ``mt-eval compare`` and every other
    harness reader of these files sees the corpus class — a local-only /
    sealed / consent-required set's sentences stay off their terminal too."""
    tp = _harness.transmission_policy_mod()
    policy = _harness.corpus_transmission_policy(path, dataset_id=dataset_id)
    return tp.enforce_transmission_policy(
        policy, provider_name="nmt-forge", provider_supports_restricted=True,
        provider_basis=LOCAL_DECODE_BASIS, has_external_method=False,
        local_transport_verified=True)


def _given_dataset_id(ident: dict) -> str:
    """The id to look the set up by in the mt-eval registry: only one the
    file's terms (or the registry) gave — forge's own set name is not a
    registry id."""
    from .registry import FORGE_NAME_SOURCE

    if ident.get("dataset_id_source") == FORGE_NAME_SOURCE:
        return ""
    return str(ident.get("dataset_id") or "")


@contextlib.contextmanager
def _harness_console(log: io.StringIO):
    """Run harness code without letting it prompt or print into forge's
    output: a non-interactive stdin (the harness asks to install COMET or
    an FST on a TTY) and stdout captured for ``analysis.log``."""
    saved_stdin = sys.stdin
    try:
        sys.stdin = io.StringIO("")
        with contextlib.redirect_stdout(log):
            yield
    finally:
        sys.stdin = saved_stdin


def discover_report_plugins(cfg, battery_entry: dict, *,
                            identity: dict | None = None,
                            glossary: str | Path | None = None) -> dict:
    """The metric plugins ``mt-eval run`` would load for this target and
    this test set — ``plugin_discovery.discover_metric_plugins`` itself,
    called with the config an ``mt-eval run`` on the file would record:
    the target language, the corpus path and its transmission record (so a
    local-only / sealed set's card referee is WITHHELD exactly as the
    harness withholds it), the glossary when one is given, and
    ``skip_fst=True`` — the FST when it is installed, as ``mt-eval run``
    scores (its auto-score never installs one).

    Call it BEFORE the gated read: a declared referee the harness cannot
    load, or an unreadable glossary, then refuses before anything is
    spent. Returns ``{"plugins", "lang_code", "fst_declared", "glossary",
    "glossary_status", "log"}`` — ``log`` is what the harness printed."""
    _harness.load_harness()
    from mt_eval_harness import language_cards as lc
    from mt_eval_harness import plugin_discovery as pd

    lang = cfg.language or {}
    target = str(lang.get("target") or lang.get("target_name") or "")
    ident = identity or {}
    config = {
        "target_lang": target,
        "target_lang_code": str(lang.get("target") or ""),
        "corpus_path": str(battery_entry["path"]),
        "transmission_policy": _local_transmission_record(
            battery_entry["path"], _given_dataset_id(ident)),
    }
    if glossary:
        config["glossary_file"] = str(glossary)
    log = io.StringIO()
    try:
        with _harness_console(log):
            plugins = pd.discover_metric_plugins(config, skip_fst=True)
            _, glossary_status = pd.run_glossary(config)
            lang_code = pd._detect_lang_code(config)
    except SystemExit as e:
        # the harness exits on an unreadable --glossary file
        raise ForgeError(
            f"{' '.join(str(e).split()).lstrip('✗ ')}\n"
            "  why: the terminology metric reads that file; a bad glossary "
            "must refuse before the test set is read, not after\n"
            '  fix: pass a JSON object {"source term": "translation" or '
            '["accepted", "forms"]}, or leave --glossary out') from None
    except (RuntimeError, ImportError, ValueError, TypeError, OSError) as e:
        # the harness REFUSES to score without a referee the card declares
        # when it cannot be loaded (its dependency missing, an install that
        # failed offline) — refused here, before the gated read
        raise ForgeError(
            f"the language card for {target!r} declares a referee metric "
            f"the harness cannot load ({type(e).__name__}: {e})\n"
            "  why: `mt-eval run` scores this language with it; an export "
            "without it would not be the harness's battery — and nothing has "
            "been read from your test set yet\n"
            f"  fix: install its dependencies (`mt-eval setup --lang "
            f"{lang.get('target') or target}`), then run export again") from e
    return {"plugins": list(plugins), "lang_code": lang_code,
            "fst_declared": bool(lang_code)
            and lc.get_fst_install_info(lang_code) is not None,
            "glossary": str(glossary) if glossary else None,
            "glossary_status": glossary_status, "log": log.getvalue()}


def _quoted(path) -> str:
    return shlex.quote(str(path))


def metric_coverage(report: dict, discovered: dict, *, runlog_path,
                    battery_path=None) -> dict:
    """What the TestReport carries and what it does not, from the report
    itself and the discovery that produced its plugins:
    ``{"computed": [names], "not_computed": [{"metric", "why", "command"}],
    "rescore_command"}``.

    ``command`` is the one command that computes the missing metric on the
    RunLog already written (``mt-eval test`` re-scores the same outputs; it
    is not a second decode), or None when nothing should compute it — a
    card referee the test set's terms withhold may not reach the outside
    service it can query. A plugin's own error text is scrubbed of the
    test set's sentences, marked or not (``privacy.scrub_text_of``): this
    list is written into forge-model.json, which sits in the deployable
    model directory.
    """
    from .privacy import scrub_text_of

    overall = report.get("overall") or {}
    plugin_metrics = overall.get("plugin_metrics") or {}
    full = Path(str(runlog_path)).with_name("runlog_report_full.json")
    glossary = discovered.get("glossary")
    rescore = (f"mt-eval test {_quoted(runlog_path)} --output {_quoted(full)}"
               + (f" --glossary {_quoted(glossary)}" if glossary else ""))
    with_glossary = (rescore if glossary
                     else rescore + " --glossary <glossary.json>")

    def scrubbed(text: str) -> str:
        return scrub_text_of(text, battery_path) if battery_path else text

    computed: list[str] = []
    missing: list[dict] = []
    for key, label in HARNESS_BASE_METRICS:
        if overall.get(key) is not None:
            computed.append(label)
            continue
        if key == "comet_score":
            from mt_eval_harness.metrics_comet import HAS_COMET

            if not HAS_COMET:
                missing.append({
                    "metric": label,
                    "why": "unbabel-comet is not installed, and the "
                           "harness computes COMET only when it is",
                    "command": f"mt-eval setup --comet && {rescore}"})
            else:
                missing.append({
                    "metric": label,
                    "why": "COMET produced no score for this run — "
                           "analysis.log says why",
                    "command": rescore})
        else:
            missing.append({"metric": label,
                            "why": "the harness produced no value — "
                                   "analysis.log says why",
                            "command": rescore})

    names = [getattr(p, "name", "") for p in discovered.get("plugins") or ()]
    code = discovered.get("lang_code")
    # ONE install command, the one every surface names (harness fst_state,
    # the eval-pack gate, the MCP plan): `mt-eval setup --lang <code>` —
    # it installs the pyhfst runtime and the pinned analyzer. Nothing
    # downloads by itself; `mt-eval test` then adds the score to the RunLog
    # already written, without a second decode (Round 9: export said
    # `mt-eval setup --fst`, everything else `--lang`).
    fst_setup = f"mt-eval setup --lang {code}" if code else "mt-eval setup --fst"
    if discovered.get("fst_declared") and FST_PLUGIN not in names:
        missing.append({
            "metric": f"{FST_PLUGIN} (FST word validity)",
            "why": f"the {code} language card lists a GiellaLT FST, but it "
                   "is not installed on this machine — an export scores with "
                   "it when it is, as `mt-eval run` does, and never installs "
                   "one",
            "command": f"{fst_setup} && {rescore}",
            "note": f"nothing downloads by itself: `{fst_setup}` installs "
                    "the FST (once per machine), then `mt-eval test` adds its "
                    "score to this RunLog without translating again"})
    for name in names:
        agg = plugin_metrics.get(name)
        if not isinstance(agg, dict) or not agg:
            missing.append({"metric": name,
                            "why": "the plugin returned no result",
                            "command": rescore})
        elif agg.get("unavailable"):
            # a card referee withheld by the test set's terms
            # (plugin_discovery._WithheldCardMetric)
            missing.append({
                "metric": name, "why": str(agg["unavailable"]),
                "command": None,
                "note": "no command computes it on this machine without "
                        "sending the test set's words to an outside service "
                        "— the test set's terms forbid that"})
        elif agg.get("error"):
            fix = (f"{fst_setup} && {rescore}" if name == FST_PLUGIN
                   else rescore)
            missing.append({"metric": name,
                            "why": scrubbed(str(agg["error"])),
                            "command": fix})
        elif agg.get("available") is False:
            reason = (agg.get("reason") or agg.get("unavailable_reason")
                      or agg.get("note") or "the plugin reported itself "
                      "unavailable")
            missing.append({"metric": name, "why": scrubbed(str(reason)),
                            "command": rescore})
        elif name == TERMINOLOGY_PLUGIN and \
                agg.get("avg_terminology_adherence") is None:
            if glossary:
                missing.append({
                    "metric": name,
                    "why": "no term of the glossary occurs in the test set's "
                           "sources",
                    "command": None})
            else:
                missing.append({
                    "metric": name,
                    "why": "no glossary was given, and terminology "
                           "adherence needs one",
                    "command": with_glossary})
        else:
            computed.append(name)
    return {"computed": computed, "not_computed": missing,
            "rescore_command": rescore}


def render_metric_coverage(coverage: dict | None, indent: str = "  "
                           ) -> list[str]:
    """The human lines for :func:`metric_coverage` (export / evaluate)."""
    if not coverage:
        return []
    lines = [f"{indent}mt-eval metrics computed: "
             + (", ".join(coverage["computed"]) or "none")]
    for m in coverage["not_computed"]:
        lines.append(f"{indent}NOT computed: {m['metric']} — {m['why']}")
        if m.get("command"):
            lines.append(f"{indent}  compute it: {m['command']}")
        elif m.get("note"):
            lines.append(f"{indent}  ({m['note']})")
    return lines


#: What a forge-trained model IS on the harness's method axes: a neural
#: seq2seq model run on this machine — the class/paradigm the method
#: registry gives a local NMT model (``local-model``: pipeline /
#: neural-nmt). Both are harness vocabulary (config.VALID_METHOD_CLASSES /
#: VALID_PARADIGMS); the class is also the run's published condition, as
#: the harness records any method that translates by itself — never the LLM
#: prompt condition "naive" (Round 5: the publish preview said "Condition:
#: naive" for a forge model).
FORGE_METHOD_CLASS = "pipeline"
FORGE_METHOD_PARADIGM = "neural-nmt"


def forge_method_card(*, run_name: str, config_hash: str, backend: str | None,
                      selected_checkpoint: str | None, src: str,
                      tgt: str) -> dict:
    """The method card a forge RunLog embeds (``provenance.method_card``):
    what translated, on the harness's own method axes, validated by the
    harness's own check."""
    import re

    from . import __version__ as forge_version

    slug = re.sub(r"[^a-z0-9]+", "-", f"nmt-forge-{run_name}".lower()).strip("-")
    card = {
        "method_id": slug or "nmt-forge",
        "name": f"nmt-forge model {run_name}",
        "class": FORGE_METHOD_CLASS,
        "paradigm": FORGE_METHOD_PARADIGM,
        "description": (f"an NMT model trained with nmt-forge {forge_version} "
                        f"({backend or 'unknown backend'}, {src or '?'}→"
                        f"{tgt or '?'}) on the user's own data, decoded on "
                        "this machine with its dev-selected checkpoint "
                        f"{selected_checkpoint or '?'}"),
        "version": config_hash[:12],
        "tools_used": [f"nmt-forge {forge_version}"],
    }
    from mt_eval_harness.config import validate_method_card

    errors = validate_method_card(card)
    if errors:
        raise ForgeError("forge's method card fails the harness's own "
                         "check: " + "; ".join(errors))
    return card


def _language_label(name, code, *, side: str) -> str:
    """The RunLog's language label: the config's name, else the harness's
    own name for the code (its card resolver), else the code. Never a
    placeholder — a run config that names no language says so."""
    if name:
        return str(name)
    if code:
        try:
            from mt_eval_harness.language_cards import get_name

            resolved = get_name(str(code))
        except Exception:                     # offline / no card index
            resolved = None
        return str(resolved or code)
    return f"unknown (the run config names no {side} language)"


def write_harness_report(entries: list[dict], *, out_dir: str | Path,
                         run_manifest: dict, run_manifest_path: str | Path,
                         cfg, battery: str, battery_entry: dict,
                         near_twin: dict | None = None,
                         identity: dict | None = None,
                         discovered: dict | None = None,
                         decode_seconds: float | None = None,
                         decode_started: str | None = None) -> dict:
    """Write ``runlog.json`` + ``runlog_report.json`` (+ README, log) for a
    scored battery. ``near_twin`` (``ci_scoring.near_twin_summary``) is
    written into the TestReport's ``overall`` as ``nmt_forge_*`` fields and
    into the RunLog's forge provenance.

    ``identity`` (``registry.dataset_identity``) names the set the way
    ``mt-eval`` does: its ``dataset_id`` (a registered card's id, read
    verbatim) is the RunLog's ``dataset_id``; forge's own set name rides
    along as ``nmt_forge_set``.

    ``discovered`` (:func:`discover_report_plugins`, run before the gated
    read) supplies the metric plugins the analysis scores with; without
    it they are discovered here. What the report lacks is listed in its
    ``overall`` (``nmt_forge_metrics_not_computed``) and returned.

    ``decode_seconds`` / ``decode_started``: the wall-clock of the decode
    that produced ``entries`` (measured by ``evaluate``) — the RunLog's
    elapsed time and per-row average latency. Without them the RunLog said
    0.0s (Round 5): the time it took to write the log, not to translate.

    Returns ``{"harness_runlog", "harness_report", "harness_version",
    "harness_metrics"}``."""
    if not entries:
        raise ForgeError(
            "no scored rows to bridge — the battery read returned nothing")
    _harness.load_harness()
    from mt_eval_harness.config import RunConfig as HarnessRunConfig
    from mt_eval_harness.pipeline import build_run_log
    from mt_eval_harness.tester import analyze_run_log

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    lang = cfg.language or {}
    src_code = str(lang.get("source") or "")
    tgt_code = str(lang.get("target") or "")
    run_name = run_manifest.get("run_name") or cfg.run_name
    config_hash = run_manifest.get("config_hash") or cfg.hash()
    model_label = f"nmt-forge/{run_name}@{config_hash[:12]}"

    from .registry import FORGE_NAME_SOURCE

    ident = identity or {"set": battery, "dataset_id": battery,
                         "dataset_id_source": FORGE_NAME_SOURCE}
    dataset_id = ident["dataset_id"]
    if discovered is None:
        discovered = discover_report_plugins(cfg, battery_entry,
                                             identity=ident)
    terms = _harness.corpus_terms(battery_entry["path"])
    given = _given_dataset_id(ident)
    # what an `mt-eval run` on this file records (envelope + steward sidecar
    # + registered card: transmission, segment, licence, id, corpus_card,
    # contamination), plus forge's own name for the set
    dataset_meta = {**terms["meta"], "id": dataset_id,
                    "nmt_forge_set": battery,
                    "dataset_id_source": ident.get("dataset_id_source"),
                    "role": battery_entry.get("role"),
                    "rows": battery_entry.get("rows")}
    dataset_meta.setdefault("source", "nmt-forge registered eval set")
    dataset_meta.setdefault("name", battery)
    # the run's pair, as ISO codes: publish reads a corpus envelope's
    # language_pair first, and resolving NAMES there fails on an install
    # without the card index (the published pair came out "?>…")
    if src_code and tgt_code and not dataset_meta.get("language_pair"):
        dataset_meta["language_pair"] = {"source": src_code, "target": tgt_code,
                                         "from": "the nmt-forge run config"}
    method_card = forge_method_card(
        run_name=run_name, config_hash=config_hash,
        backend=run_manifest.get("backend"),
        selected_checkpoint=run_manifest.get("selected_checkpoint"),
        src=src_code, tgt=tgt_code)
    hcfg = HarnessRunConfig(
        dataset_id=dataset_id,
        corpus_path=str(battery_entry["path"]),
        source_field=battery_entry["source_field"],
        target_field=battery_entry["target_field"],
        source_lang=_language_label(lang.get("source_name"), src_code,
                                    side="source"),
        target_lang=_language_label(lang.get("target_name"), tgt_code,
                                    side="target"),
        source_code=src_code,
        target_code=tgt_code,
        target_lang_code=tgt_code,
        model=model_label,
        provider="local",
        mt_method="nmt-forge",
        process_name="nmt-forge",
        run_name=run_name,
        temperature=0.0,
        cache_enabled=False,
        output_dir=str(out),
        # the condition a method that translates by itself publishes under
        # is its method class (publish keeps an explicit non-"naive" label)
        prompt_version=method_card["class"],
    )
    hcfg.transmission_policy = _local_transmission_record(
        battery_entry["path"], given)
    if discovered.get("glossary"):
        # recorded on the run, as `mt-eval run --glossary` records it, so a
        # later `mt-eval test` of this RunLog scores the same terms
        hcfg.glossary_file = str(Path(discovered["glossary"]).resolve())
    # the decode is batched: each row's latency is the batch average, so the
    # harness's mean latency is the true seconds per sentence
    per_row = (round(decode_seconds / len(entries), 4)
               if decode_seconds is not None else None)
    results = [
        {"id": e["id"], "source": e["source"], "expected": e["expected"],
         "predicted": e["predicted"], "raw_predicted": e["predicted"],
         "segment": e.get("segment", ""),
         "latency_s": per_row if per_row is not None else 0,
         "cost_usd": None, "cached": False, "error": None}
        for e in entries
    ]
    started = decode_started or datetime.now(timezone.utc).isoformat()
    t0 = time.monotonic()
    run_id = f"nmt-forge_{run_name}_{config_hash[:8]}"
    run_log = build_run_log(
        hcfg, results, run_id, started,
        (round(decode_seconds, 3) if decode_seconds is not None
         else time.monotonic() - t0),
        cache_hits=0, total_cost=None,
        corpus_sha256=battery_entry.get("sha256", ""),
        dataset_meta=dataset_meta,
        method_card=method_card,
    )
    # decoded in this process: no API was billed (the harness's cost rule
    # reads this; the cost number stays None — local compute is unpriced)
    run_log["provenance"]["endpoint_locality"] = "in-process"
    # forge's provenance rides along (the harness ignores unknown keys)
    run_log["provenance"]["nmt_forge"] = {
        "set": battery,
        "dataset_id": dataset_id,
        "run_manifest": str(Path(run_manifest_path).resolve()),
        "config_hash": config_hash,
        "selected_checkpoint": run_manifest.get("selected_checkpoint"),
        "backend": run_manifest.get("backend"),
        "dev_set": run_manifest.get("dev_set"),
        "decode_seconds": (round(decode_seconds, 3)
                           if decode_seconds is not None else None),
        "latency_note": ("elapsed_s is the wall-clock of the batched decode; "
                         "each row's latency_s is that time ÷ rows"
                         if decode_seconds is not None else
                         "decode time not measured (RunLog built outside "
                         "`nmt-forge evaluate`/`export`)"),
        "note": "decoded and scored by nmt-forge under its dev-fence and "
                "preregistration gate; this RunLog was built from that one "
                "ledgered read",
        **({"near_twin": near_twin} if near_twin is not None else {}),
    }
    runlog_path = out / "runlog.json"
    runlog_path.write_text(json.dumps(run_log, ensure_ascii=False, indent=2),
                           encoding="utf-8")
    report_path = out / "runlog_report.json"
    # what the harness printed while choosing the metrics opens the log
    log = io.StringIO(discovered.get("log") or "")
    log.seek(0, io.SEEK_END)
    # never let the harness prompt (it offers a COMET install on a TTY)
    with _harness_console(log):
        report = analyze_run_log(
            run_log, output_path=report_path,
            metric_plugins=discovered.get("plugins") or None,
            compute_ci=True, source_log_path=str(runlog_path.resolve()))
    (out / "analysis.log").write_text(log.getvalue(), encoding="utf-8")
    if not isinstance(report, dict) or "overall" not in report:
        raise ForgeError(
            f"mt-eval-harness did not produce a TestReport "
            f"({(report or {}).get('error', 'unknown error')}); see "
            f"{out / 'analysis.log'}")
    # forge's set name travels in the TestReport too (`prereg check
    # --results runlog_report.json` matches it against the prereg's set);
    # the harness reads `overall` by key and ignores names it does not know
    report["overall"]["nmt_forge_set"] = battery
    if near_twin is not None:
        report["overall"].update(overall_caveat_fields(near_twin))
    coverage = metric_coverage(report, discovered, runlog_path=runlog_path,
                               battery_path=battery_entry["path"])
    # what this report does NOT carry, said inside it — next to the
    # harness's own keys, which readers take by name
    report["overall"]["nmt_forge_metrics_computed"] = coverage["computed"]
    report["overall"]["nmt_forge_metrics_not_computed"] = \
        coverage["not_computed"]
    report_path.write_text(json.dumps(report, ensure_ascii=False,
                                      indent=2), encoding="utf-8")
    (out / "README.md").write_text(HARNESS_README, encoding="utf-8")
    from .harness_caveats import from_report
    from .scoring_standard import from_test_report

    return {"harness_runlog": str(runlog_path),
            "harness_report": str(report_path),
            "harness_version": _harness.harness_version(),
            "harness_metrics": coverage,
            # the scoring standard's headline (standard/1): this TestReport's
            # corpus chrF++ with its 95% bootstrap CI and sacreBLEU
            # signature, the secondary standard metrics beside it — what
            # the summary, forge-model.json and DEPLOY.md quote
            "harness_headline": from_test_report(report),
            # what the harness says qualifies these scores, verbatim (None:
            # it wrote no score_caveats key) — relayed by every surface that
            # shows the score (harness_caveats; Round 13)
            "harness_score_caveats": from_report(report)}
