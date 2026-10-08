"""
Run Harness — Core execution engine for translation experiments.

This is the orchestrator that ties together:
    - Dataset loading (JSON, JSONL, TSV, parallel text — via corpus_loader)
    - System prompt loading (built-in + plugin providers, including champollion interop)
    - Strategy resolution (single, batch, tool-call, plugin process)
    - Pipeline shared concerns (enrichment, RunLog, progress)

The runner delegates actual translation to strategy modules
(mt_eval_harness.strategies), keeping this file focused on
orchestration and coordination.

┌──────────────────────────────────────────────────────────────┐
│  HOW TO RUN MULTI-MODEL BENCHMARKS:                            │
│                                                                │
│  Use execute_multi_run(configs) — NOT a for-loop over           │
│  execute_run(). Each model gets its own aiohttp session and     │
│  semaphore, so different providers don't compete for rate       │
│  limits. A 14-model benchmark runs in ~15 minutes parallel     │
│  vs ~3.5 hours sequential.                                     │
│                                                                │
│  Defaults come from HARNESS_DEFAULTS in config.py.             │
│  batch_size=25, max_tokens=32768, concurrency=8, cache=on.     │
└──────────────────────────────────────────────────────────────┘

Design decisions:
    - Strategies are resolved via a factory, not if/elif dispatch.
      Each mode is independently testable and extensible.
    - Process plugins are first-class: the built-in LLM caller is
      just the default strategy. Any pipeline can register via the
      TranslationMethod protocol for identical evaluation.
    - All errors are captured (never thrown) so a partial run still
      produces usable data.
    - Progress reporting uses simple print() — no dependency on
      rich/tqdm to keep the harness zero-dependency beyond aiohttp.
    - Language-specific logic (prompts, tools, post-processing hooks)
      is injected via plugin protocols, not imported directly.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp

from mt_eval_harness.config import RunConfig, TranslationMethod
from mt_eval_harness.cache import ResultCache
from mt_eval_harness.api import (
    load_api_key,
    call_openrouter,
    fetch_pricing,
    estimate_run_cost,
)
from mt_eval_harness.providers import get_provider
from mt_eval_harness.strategies import resolve_strategy
from mt_eval_harness.pipeline import (
    enrich_results,
    build_run_log,
    write_run_log,
)


# ---------------------------------------------------------------------------
# Dataset loading — delegated to corpus_loader for multi-format support
# ---------------------------------------------------------------------------

from mt_eval_harness.corpus_loader import load_corpus  # noqa: F401

# load_corpus(config) is now imported from corpus_loader.py.
# It supports: harness JSON, JSONL, TSV, and parallel text files.
# See corpus_loader.py for format detection and normalization logic.


# Minimal default prompt — projects should register their own via PromptProvider.
# Accepts target_lang to tell the model WHAT language to translate into.
# Without a target language, models guess based on vibes — which leads to
# Japanese, Spanish, or "please specify the target language" responses.
DEFAULT_NAIVE_PROMPT_TEMPLATE = (
    "You are a translator. Translate the given {source_lang} text to {target_lang}. "
    "Output ONLY the translation, nothing else. No explanations, no notes."
)

# Legacy fallback for callers that don't set target_lang
DEFAULT_NAIVE_PROMPT_GENERIC = (
    "You are a translator. Translate the given text to the target language. "
    "Output ONLY the translation, nothing else. No explanations, no notes."
)


def build_naive_prompt(config: RunConfig) -> str:
    """Build the naive system prompt, interpolating language pair if set.

    If config.target_lang is set, produces a specific prompt like:
        "Translate the given English text to Plains Cree (nêhiyawêwin, SRO)."
    If not set, falls back to the generic "target language" wording.
    """
    if config.target_lang:
        source = config.source_lang or "source"
        return DEFAULT_NAIVE_PROMPT_TEMPLATE.format(
            source_lang=source,
            target_lang=config.target_lang,
        )
    return DEFAULT_NAIVE_PROMPT_GENERIC


def script_instruction(config: RunConfig) -> str:
    """The line every harness prompt ends with when --target-script names
    the script the output must be in ("" without one). Appended to the
    naive prompt, a coaching file's text and a plugin provider's prompt
    alike — the user asked for the script, whichever prompt carries it; the
    prompt's sha256 (and so the cache key and the fingerprint) records it."""
    script = (getattr(config, "target_script", "") or "").strip()
    if not script:
        return ""
    return (f"Write the translation in the {script} script (ISO 15924 code "
            f"{script}).")


def script_choice_note(config: RunConfig) -> str | None:
    """A note when the target's card lists more than one script and the
    run names none — the model then picks, and a reference written in the
    other script scores near zero for the wrong reason (Round 9, Plains
    Cree: Cans syllabics or Latn SRO). None when a script is given, the run
    is an MT engine / method plugin (no harness prompt), or the card lists
    at most one script."""
    if (getattr(config, "target_script", "") or config.mt_method
            or (config.method_path or "").strip()):
        return None
    if getattr(config, "target_script_source", None):
        # the references were read and found mixed: that warning (with the
        # shares) was already printed — prompt_plan.script_from_references
        return None
    from mt_eval_harness.config import target_card_scripts
    scripts, label = target_card_scripts(config)
    if len(scripts) < 2:
        return None
    return (f"Script: {label} is written in {len(scripts)} scripts per its "
            f"card ({', '.join(scripts)}) and the prompt names none, so the "
            f"model picks one — a reference in the other script then scores "
            f"near zero. Pass --target-script <{'|'.join(scripts)}> (the "
            f"script your references are written in).")


def load_system_prompt(
    config: RunConfig,
    prompt_providers: list | None = None,
) -> str:
    """Load the system prompt based on config.prompt_version, ending with
    the --target-script line when one is set (:func:`script_instruction`).

    Checks built-in versions first, then falls through to registered
    plugin providers.
    """
    prompt = _load_system_prompt(config, prompt_providers)
    line = script_instruction(config)
    return f"{prompt.rstrip()}\n\n{line}" if line else prompt


def _load_system_prompt(
    config: RunConfig,
    prompt_providers: list | None = None,
) -> str:
    version = config.prompt_version

    # Coaching file takes precedence over prompt_version.
    # This is the modern replacement for custom_prompt_path — if a user
    # passes --coaching-file, their coaching prompt should be used even
    # if --prompt is left at the default "naive".
    if config.coaching_file:
        path = Path(config.coaching_file)
        if path.exists():
            return path.read_text(encoding="utf-8")
        raise ValueError(
            f"Coaching file not found: {config.coaching_file}"
        )

    # Built-in: naive (only used if no coaching file is provided)
    if version == "naive":
        return build_naive_prompt(config)

    # Built-in: coached — the auto-derived label when --coaching-file or
    # --coaching is passed with the default --prompt. The coaching branch
    # above already returned the prompt text; reaching here means no
    # coaching source is configured.
    if version == "coached":
        raise ValueError(
            "prompt_version='coached' requires --coaching-file or --coaching."
        )

    # Built-in: custom file (legacy — use coaching_file instead)
    if version == "custom":
        coaching_path = config.custom_prompt_path
        if coaching_path:
            return Path(coaching_path).read_text(encoding="utf-8")
        raise ValueError(
            "prompt_version='custom' requires custom_prompt_path or "
            "--coaching-file to be set."
        )

    # Plugin providers
    if prompt_providers:
        for provider in prompt_providers:
            if version in provider.list_versions():
                return provider.load(version, config)

    raise ValueError(
        f"Unknown prompt version: '{version}'. "
        f"Built-in: naive, custom. "
        f"Register a PromptProvider plugin for custom versions."
    )


def _endpoint_locality(provider, in_process_method) -> str | None:
    """Where the model runs, when it provably runs HERE: ``loopback`` for a
    --provider local endpoint on this machine, ``in-process`` for the
    harness's own adapter (local-model); None otherwise. One reading for the
    pre-spend estimate, the dry run and the RunLog provenance the run card's
    cost rule reads (run_card.cost_label)."""
    if (provider is not None and getattr(provider, "name", "") == "local"
            and getattr(provider, "is_loopback_endpoint", lambda: False)()):
        return "loopback"
    if in_process_method:
        return "in-process"
    return None


def _engine_model_record(identity: dict) -> dict:
    """The engine-model record a run stores (engine_model.from_run reads it
    back): the identity as resolved, a plain JSON-safe dict."""
    return {k: v for k, v in dict(identity or {}).items() if v is not None}


def _engine_model_lines(identity: dict) -> list[str]:
    """The header lines naming the model an engine will load."""
    from mt_eval_harness.engine_model import header_lines
    return header_lines(identity)


def _cost_config(config) -> dict:
    """The config fields the cost rule reads (run_card.cost_label)."""
    return {"provider": getattr(config, "provider", None),
            "mt_method": getattr(config, "mt_method", None),
            "method_path": getattr(config, "method_path", None)}


def _cost_provenance(config, provider, in_process_method) -> dict:
    """The provenance the cost rule reads BEFORE a run (the dry run's and the
    pre-spend "Est. cost" line): where the model runs (_endpoint_locality)
    and, for a method plugin, the dependency class its method.json declares
    (method_loader.plugin_dependency_record) — the same two fields the RunLog
    records, so the estimate and the total say a plugin's cost one way
    (an S plugin read "unknown" before and after its run — synthetic
    researcher, Round 12)."""
    prov = {"endpoint_locality": _endpoint_locality(provider,
                                                    in_process_method)}
    method_path = getattr(config, "method_path", None)
    if method_path and not getattr(config, "mt_method", None):
        from mt_eval_harness.method_loader import plugin_dependency_record
        record = plugin_dependency_record(method_path)
        if record is not None:
            prov["method_plugin"] = record
    return prov


def _enforce_max_cost(
    config: RunConfig, est_cost: float | None, est_basis: str
) -> None:
    """Abort BEFORE any spend when the pre-spend estimate breaks --max-cost.

    Unknown ≠ free (the queue_runner.select_items budget discipline): with a
    cap set, an un-priceable model aborts too — a fabricated $0 estimate
    would wave every unknown-cost run through the cap. No cap set → no-op.

    Raises RuntimeError (with a machine-readable ``kind`` attribute, which
    the CLI's --json error path surfaces as the error type).
    """
    max_cost = getattr(config, "max_cost", None)
    if max_cost is None:
        return
    if est_cost is None:
        exc = RuntimeError(
            f"--max-cost {max_cost:g} is set but the cost estimate is "
            f"UNKNOWN ({est_basis}). Unknown ≠ free — refusing to start. "
            f"Re-run without --max-cost to proceed without a cap."
        )
        exc.kind = "max-cost-unknown"
        raise exc
    if est_cost > max_cost:
        exc = RuntimeError(
            f"estimated cost ~${est_cost:.4f} exceeds --max-cost "
            f"${max_cost:g} — aborting before any API spend. "
            f"Estimate basis: {est_basis}. Raise the cap or shrink the run "
            f"(--ids / --dataset / a smaller corpus)."
        )
        exc.kind = "max-cost-exceeded"
        raise exc


# ---------------------------------------------------------------------------
# Main execution engine
# ---------------------------------------------------------------------------

async def execute_run(
    config: RunConfig,
    method: TranslationMethod | None = None,
    prompt_providers: list | None = None,
    tool_provider: Any | None = None,
    post_hooks: list | None = None,
    metric_plugins: list | None = None,
) -> dict:
    """Execute a full harness run.

    This is the main entry point. It:
        1. Validates config
        2. Loads corpus + system prompt
        3. Resolves the correct execution strategy
        4. Delegates translation to the strategy
        5. Enriches results with corpus metadata + costs
        6. Writes the RunLog to disk

    Args:
        config: Full run configuration.
        method: Optional custom TranslationMethod plugin.
                If None, uses built-in LLM translation.
                Can also be loaded from config.method_path.
        prompt_providers: Optional list of PromptProvider plugins
                          for custom system prompt versions.
        tool_provider: Optional ToolProvider plugin for tool-calling.
        post_hooks: Optional list of PostTranslationHook plugins.
        metric_plugins: Reserved for future use (passed to tester).

    Returns:
        The complete RunLog dict (also written to disk).
    """
    # --- Validate ---
    available_prompts = ["naive", "custom", "coached"]
    if prompt_providers:
        for pp in prompt_providers:
            available_prompts.extend(pp.list_versions())

    # A dry run runs the real run's eval-pack gate checks and collects their
    # verdicts here instead of being stopped by them (reported below).
    eval_pack_checks: list[dict] = []
    errors = config.validate(prompt_versions=available_prompts,
                             eval_pack_report=eval_pack_checks)
    if errors:
        for e in errors:
            print(f"  CONFIG ERROR: {e}")
        raise ValueError(f"Invalid config: {'; '.join(errors)}")

    # The model slug is exact as written: validate() refused any retired
    # alias, floating id or (on OpenRouter) vendor-less name, so the run log's
    # model — the published model_slug — is the one id this model has, and
    # one model never fragments across leaderboard rows and fingerprints
    # (founder ruling 2026-10-05: exact slugs only, no aliasing).
    config.model = config.model_id

    # Self-contained MT systems (google-translate, deepl, …) translate with
    # their own engine and never use the LLM `model` field — so the banner,
    # run id, and --json summary must label the run by the MT method, not the
    # leftover default LLM slug. (config.display_model encodes that choice.)
    is_mt = bool(getattr(config, "mt_method", ""))

    # …and the persisted `model` field must agree. Left at the canonicalized
    # default LLM slug above, it becomes the run log's config.model and, at
    # publish time, the run_cards.model_slug — so a `--method google-translate`
    # run shows up on the leaderboard as a Gemini LLM run (the dress-rehearsal
    # bug). Relabel model to the engine id so the on-disk artifact and the
    # published card both name the system that actually ran. display_model
    # already preferred mt_method for the banner/run-id; this aligns the
    # persisted model with it, and config.model_id resolves to the same id
    # (model_id is the model as written).
    if is_mt:
        # The model an engine is GIVEN (-m), kept as config.method_model
        # BEFORE config.model becomes the engine id — the same rule as a
        # plugin's (below). Overwriting it first meant `--method local-model
        # -m ./my-model` never reached the adapter, which then downloaded and
        # ran its old default (opus-mt-en-es) and recorded no model at all
        # (synthetic researcher, Round 10). Only an engine that runs a model
        # it is given (takes_model: local-model) keeps it; every other engine
        # translates with its own model, so -m is said to be unused and is
        # never recorded as if it had been.
        from mt_eval_harness.config import DEFAULT_MODEL
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
        given = (config.method_model or "").strip()
        if not given and config.model != DEFAULT_MODEL:
            given = config.model
        _engine_cls = MT_METHOD_REGISTRY.get(config.mt_method)
        if getattr(_engine_cls, "takes_model", False):
            config.method_model = given
        else:
            if given:
                print(f"  Note: -m {given} is not used — {config.mt_method} "
                      f"translates with its own model.")
            config.method_model = ""
        config.model = config.mt_method

    # Method plugins (--method path/to/dir) are the same shape of bug: the
    # plugin translates, the LLM `model` field is never used, and the run
    # would otherwise be persisted/published as the phantom default LLM.
    # Relabel to the plugin's method_id (from its method.json; falls back to
    # the plugin dir basename) so the run log, report, and published card
    # name the method that actually ran.
    is_method_plugin = bool(getattr(config, "method_path", None)) and not is_mt
    if is_method_plugin:
        # …but the model the user handed the plugin (-m) is kept, as
        # config.method_model, BEFORE config.model becomes the method id.
        # Overwriting it here used to mean the plugin never saw -m and the
        # run card and fingerprint dropped it: the same plugin on two models
        # published one fingerprint (synthetic researcher, Round 5). The CLI
        # sets method_model when -m was given; an API caller who set a
        # non-default model is read as having given it (the default LLM slug
        # is the phantom this relabel exists to remove, never a choice).
        from mt_eval_harness.config import DEFAULT_MODEL
        given = (config.method_model or "").strip()
        if not given and config.model != DEFAULT_MODEL:
            given = config.model
        config.method_model = given
        config.model = config.method_id

    # …and the provider: an engine or a plugin carried the text, not the
    # harness's default LLM proxy. Left at "openrouter", a fully local plugin
    # run was recorded — and fingerprinted — as an OpenRouter run (synthetic
    # researcher, Round 4). config.recorded_api_provider is the one rule
    # (publish and lint_run_reports derive the same value for older logs).
    # The provider object itself is never built for these runs (below), so
    # this changes what is RECORDED, nothing that is called.
    if is_mt or is_method_plugin:
        from mt_eval_harness.config import recorded_api_provider
        config.provider = recorded_api_provider(config)

    print("=" * 60)
    print("MT Eval Harness — Run Execution")
    print("=" * 60)
    if is_mt:
        print(f"  System:      {config.mt_method}  (self-contained MT engine)")
        if config.method_model:
            print(f"  Model given: {config.method_model}  (-m/--model; the "
                  f"model that loads is named below)")
    elif is_method_plugin:
        print(f"  System:      {config.method_id}  (method plugin: {config.method_path})")
        print("  Model given: " + (
            f"{config.method_model}  (the plugin reads it as config.method_model)"
            if config.method_model else "none (-m/--model not given)"))
    else:
        print(f"  Model:       {config.model} → {config.model_id}")
    # An MT engine or a method plugin translates by itself — the harness's
    # prompt conditions (naive/coached/custom) never reach it.
    print("  Prompt:      " + (
        "n/a (the method translates by itself; no harness prompt)"
        if is_mt or is_method_plugin else config.prompt_version))
    print(f"  Dataset:     {config.dataset}")
    if is_mt or is_method_plugin:
        # The LLM-only settings never reach an engine or a plugin; say so
        # once instead of listing defaults it does not use.
        from mt_eval_harness.run_card import LLM_SETTINGS_NA
        print(f"  Batch size:  {config.batch_size} entries per translate() call")
        print(f"  LLM settings: {LLM_SETTINGS_NA}")
    else:
        print(f"  Temperature: {config.effective_temperature}")
        print(f"  Batch size:  {config.batch_size}")
        print(f"  Max tokens:  {config.max_tokens}")
        print(f"  Concurrency: {config.concurrency}")
        print(f"  Tools:       {'enabled' if config.tools_enabled else 'disabled'}")
        if config.tools_enabled and config.tools_list:
            print(f"  Tool list:   {', '.join(config.tools_list)}")
    print(f"  Hooks:       {', '.join(config.post_hooks) if config.post_hooks else 'none'}")
    print(f"  Cache:       {'enabled' if config.cache_enabled else 'disabled'}")

    # --- Load ---
    # Self-contained MT systems (google-translate, deepl, …) carry their own
    # vendor key and need no LLM provider — skip the provider key load (and the
    # pricing fetch below) so an MT-only run doesn't wrongly require an
    # OpenRouter/LLM key. A --dry-run is an offline pre-flight and likewise
    # must not demand a key — it loads + validates the corpus, then returns
    # AFTER the validation block below (so a config that would fail at real-run
    # time also fails the dry run, instead of being false-greened).
    dry_provider = None  # the dry run's never-contacted provider (gate only)
    if is_mt:
        provider = None
        api_key = None
        print(f"\n  Provider:    {config.mt_method} (self-contained MT system — no LLM key needed)")
    elif is_method_plugin:
        # Method plugins are black boxes: source text in, translation out.
        # They handle their own credentials (if any), so demanding an
        # OpenRouter/LLM key here was a wall in front of keyless plugins.
        provider = None
        api_key = None
        print(f"\n  Provider:    {config.method_id} (method plugin — no LLM key needed; "
              f"the plugin handles its own credentials)")
    elif config.dry_run:
        provider = None
        api_key = None
        # Built, never contacted: the transmission gate below must judge the
        # endpoint THIS run would use. Without it a dry run of `--provider
        # local --base-url https://api.groq.com/…` was judged as the default
        # provider and told to "run locally instead" (synthetic hospital
        # persona, 2026-10-03). An unknown provider name fails here exactly as
        # the real run would.
        dry_provider = get_provider(config.provider,
                                    base_url=getattr(config, "base_url", None))
        print(f"\n  Provider:    {config.provider} (not contacted — dry run)")
    else:
        # Use the provider system to load the correct API key.
        # For "openrouter" (default), this calls the same load_api_key()
        # from api.py. For direct providers, it loads the vendor-specific key.
        # The KEY is loaded only after the transmission policy below: a
        # corpus that may not leave this machine must be refused for THAT
        # reason, not for a missing key — otherwise the user adds a key and
        # only then learns the data was never allowed out (synthetic Cree-
        # school persona, local-only sidecar, 2026-10-03).
        provider = get_provider(config.provider, base_url=getattr(config, "base_url", None))
        api_key = None
        endpoint = getattr(provider, "base_url", None)
        if endpoint:
            print(f"\n  Provider:    {provider.name} (endpoint: {endpoint})")
        else:
            print(f"\n  Provider:    {provider.name}")

    corpus, dataset_meta = load_corpus(config)
    print(f"\n  Loaded {len(corpus)} entries")

    # Resolve language codes/names the corpus didn't already surface through
    # corpus_loader — e.g. a wrapped dataset_meta.language_pair, the
    # --target-lang-code interop flag, or JSONL/TSV/parallel corpora. This used
    # to be gated on `is_mt`, so a PLAIN LLM run against a codes-only corpus
    # (GlobalVoices, the bundled eng-fra example) had no target-language name
    # to prompt with and aborted at the validation gate below. MT and LLM runs
    # alike need this, so it runs unconditionally now.
    lp = (dataset_meta or {}).get("language_pair") or {}
    # Position 4 v2: run mechanics (prompt names, eval packs) prefer the
    # registry's RESOLVED individual codes when stamped — a cmn-Hans-labeled
    # corpus prompts as Mandarin Chinese, not the raw tag. The run card
    # still records the corpus's upstream-faithful language_pair.
    lr = (dataset_meta or {}).get("language_resolution") or {}

    def _resolved_side(side: str):
        return (lr.get(side) or {}).get("resolved") or lp.get(side)

    if not config.source_code and _resolved_side("source"):
        config.source_code = _resolved_side("source")
    if not config.target_code and _resolved_side("target"):
        config.target_code = _resolved_side("target")
    if not config.target_code and getattr(config, "target_lang_code", ""):
        config.target_code = config.target_lang_code
    # A CODE given where the prompt needs a NAME (--target-lang sme) is
    # resolved to the language's name through its card, and said; with no
    # card the code stays and the run warns (prompt_plan, Round 11: the
    # naive prompt read "Translate the given English text to sme.").
    from mt_eval_harness.prompt_plan import apply_language_names
    for _line in apply_language_names(config):
        print(_line)
    # Final fallback: derive a human-readable target/source NAME from the ISO
    # code (offline, via the bundled language cards). MT engines translate by
    # code so the bare code is acceptable; the LLM prompt reads better with a
    # real name. Falls back to the code itself when the card lookup misses.
    if not config.target_lang.strip() and config.target_code:
        from mt_eval_harness.language_cards import get_name
        config.target_lang = get_name(config.target_code) or config.target_code
    if not config.source_lang.strip() and config.source_code:
        from mt_eval_harness.language_cards import get_name
        config.source_lang = get_name(config.source_code) or config.source_code

    # The script, when the target's card lists several and the run names
    # none: read off the references as an aggregate share (never a
    # sentence) and the dominant one prompted for, said and recorded.
    from mt_eval_harness.prompt_plan import script_from_references
    for _line in script_from_references(config, corpus):
        print(_line)

    # Scoring inputs the run asked for (--glossary, --style-profile) are
    # honoured or refused HERE, before anything is spent; and an unresolved
    # target language is said up front (the generic metrics still run).
    from mt_eval_harness.plugin_discovery import preflight_scoring_inputs
    preflight_scoring_inputs(config.to_dict())

    # --- Contamination lane (SSOT: mt_eval_harness.contamination) ---
    # A HIGH-contamination corpus (e.g. FLORES+, in essentially every frontier
    # model's training data) is relative-comparison-only: its scores rank
    # methods against each other on THIS corpus, never as absolute quality.
    # Surface that up front so a run is never silently read as an absolute
    # measurement. Data-driven from the dataset's registry `contamination`
    # grade (falls back to a grade the corpus envelope itself carries).
    try:
        from mt_eval_harness import contamination as _contam
    except ImportError as exc:
        raise RuntimeError(
            "contamination module missing — mt_eval_harness/contamination.py is "
            "the SSOT that decides whether a score is absolute-quality or "
            "relative-comparison-only. Refusing to run a benchmark without it "
            "(a HIGH-contamination corpus could otherwise be scored as absolute "
            "quality). Reinstall the harness: "
            "python3 -m pip install --force-reinstall mt-eval-harness."
        ) from exc
    from mt_eval_harness.config import canonical_registry_id
    contam_dataset_id = config.dataset_id or canonical_registry_id(
        config.corpus_path or config.dataset or ""
    )
    contam_grade = _contam.grade_for_dataset(contam_dataset_id)
    if not contam_grade and dataset_meta:
        contam_grade = _contam.normalize_grade(dataset_meta.get("contamination"))
    relative_only = _contam.is_relative_only(contam_grade)
    if relative_only:
        # A registered card's own statement (e.g. NONE = private/unpublished)
        # is reported as what it is, never as "ungraded/unknown".
        print("\n  " + _contam.relative_only_notice(
            contam_grade, contam_dataset_id,
            stated=(dataset_meta or {}).get("contamination"),
            source=(dataset_meta or {}).get("contamination_source")))

    # --- Transmission policy (SSOT: mt_eval_harness.transmission_policy) ---
    # Decide BEFORE any API call whether this corpus may leave the machine
    # at all, and under which channel discipline. Modes: cleared / no-train
    # (plain standard NC — OpenRouter pinned to data_collection=deny,
    # first-party APIs, or local) / consent-required (LicenseRef, modified,
    # bespoke, unstated grants — remote evaluation REFUSES until the
    # rights-holder's permission is recorded on the dataset entry) / sealed
    # (held-out, gold-standard, quarantined — remote always refuses).
    # champollion.dev/docs/network/sovereignty/data-sovereignty §"Transmission to model APIs" is the rule.
    from mt_eval_harness.transmission_policy import (
        enforce_transmission_policy,
        resolve_transmission_policy,
    )
    # The entry lookup walks the path/basename ladder too: a REGISTERED corpus
    # run by file path resolves no id from canonical_registry_id(), and the
    # built envelopes carry `dataset.name` rather than `dataset.id`, so the
    # gate used to see "unregistered" and run EdTeKLA remotely under no-train.
    from mt_eval_harness.publish import registry_entry_for_run
    _tp_dataset_id, _tp_entry = registry_entry_for_run(
        config.dataset_id or contam_dataset_id or "",
        corpus_path=config.corpus_path or "",
        dataset=config.dataset or "",
        corpus_meta=dataset_meta,
    )
    _policy = resolve_transmission_policy(
        _tp_dataset_id,
        registry_entry=_tp_entry,
        corpus_meta=dataset_meta,
        allow_data_collection_unregistered=config.allow_data_collection,
    )
    # The provider the gate judges: the live one, or (dry run) the one the
    # real run would build — same endpoint, never contacted.
    _gate = provider if provider is not None else dry_provider
    # An engine or a plugin owns its transport. The plugin object is loaded
    # further down, so `method` is still None here for a --method <dir> or
    # --method <engine> run — and the gate used to judge such a run as the
    # DEFAULT OpenRouter LLM: --attest-local-transport could never apply to
    # a plugin, and an engine's no-train channel was stamped "OpenRouter
    # pinned to data_collection=deny" although no OpenRouter call was made
    # (found with the synthetic researcher's Round 4 plugin finding).
    _external = method is not None or is_mt or is_method_plugin
    # …except the harness's OWN in-process adapter (local-model): it runs the
    # model in this process, so nothing leaves the machine and no operator
    # attestation is needed. Read off the adapter class (in_process_transport)
    # — a passed-in method object or a plugin directory never qualifies.
    _in_process = None
    if is_mt and method is None:
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
        _cls = MT_METHOD_REGISTRY.get(config.mt_method)
        if _cls is not None and getattr(_cls, "in_process_transport", False):
            _in_process = config.mt_method
            _external = False
    config.transmission_policy = enforce_transmission_policy(
        _policy,
        provider_name=(None if _external
                       else (_gate.name if _gate is not None
                             else "openrouter")),
        provider_supports_restricted=(
            _gate.supports_restricted_transmission
            if _gate is not None else True),
        provider_basis=(
            _gate.transmission_basis if _gate is not None
            else "OpenRouter routing pinned to data_collection=deny providers"),
        has_external_method=_external,
        attest_local_transport=config.attest_local_transport,
        # Locality must be PROVEN from the endpoint, never inferred from the
        # provider name: --provider local --base-url https://… (or a
        # LOCAL_API_BASE/OPENAI_API_BASE env) points "local" at a remote host.
        local_transport_verified=(
            not _external
            and _gate is not None
            and _gate.name == "local"
            and getattr(_gate, "is_loopback_endpoint", lambda: False)()
        ),
        endpoint=(getattr(_gate, "base_url", None)
                  if not (_external or _in_process) else None),
        in_process_method=_in_process,
    )
    if _policy.mode != "cleared":
        _tp = config.transmission_policy
        if _tp.get("channel") == "external-method" and not _tp.get("enforced"):
            print(
                "\n  ⚠ TRANSMISSION POLICY (restricted corpus): "
                f"{_policy.reason}.\n"
                "    This run delegates transport to an external method — the "
                "no-train channel rule\n"
                "    (champollion.dev/docs/network/sovereignty/data-sovereignty) cannot be enforced by the "
                "harness here. Ensure the\n"
                "    method's transport does not retain or train on inputs."
            )
        else:
            print(
                f"\n  Transmission policy: {_policy.label.upper()} corpus "
                f"({_policy.reason})."
                f"\n    Channel: {_tp.get('channel_basis') or _tp.get('channel') or 'n/a'}."
            )
        # Outputs of a restricted corpus are machine DERIVATIVES of its
        # sentences. The local report/RunLog may hold them for scoring;
        # publishing content is separately gated; distribution is not.
        config.transmission_policy["derivative_notice"] = (
            "Predictions in this run are machine derivatives of restricted "
            "corpus sentences. They stay in the local report for scoring; "
            "do not distribute them (champollion.dev/docs/network/sovereignty/data-sovereignty)."
        )
        print("    Note: outputs are machine derivatives of restricted "
              "corpus text — local scoring only, do not distribute.")

    # The provider's credential, now that the corpus is known to be allowed
    # on this channel (see the provider block above for why it waits).
    if provider is not None:
        api_key = provider.load_api_key()

    # --- Corpus SHA-256 for reproducibility (BENCHMARK_SPEC §3.3) ---
    # Hash the corpus file so run cards can pin results to a specific
    # dataset version. If the corpus changes, the hash changes, and
    # old run cards are flagged as non-comparable.
    corpus_sha256 = ""
    if config.corpus_path and Path(config.corpus_path).exists():
        corpus_sha256 = hashlib.sha256(
            Path(config.corpus_path).read_bytes()
        ).hexdigest()

    # --- Cache protection (cache.cache_protection) ---
    # A local-only / sealed / consent-required corpus gets its own cache
    # namespace (keyed by the corpus and its terms, under protected/) and a
    # mark on every cache file, so the cache never shows its sentences
    # unmarked and never serves them to a run on another corpus.
    from mt_eval_harness.cache import cache_protection
    _cache_protection = cache_protection(
        config, dataset_meta=dataset_meta, corpus_sha256=corpus_sha256,
        corpus=corpus)

    # --- Post-load validation ---
    # An empty selection must abort BEFORE any API/log activity. The common
    # cause is positional --ids against a corpus with string ids (Tatoeba
    # corpora use 'tatoeba_<sentence-id>'); the old code fell through and
    # crashed on corpus[0] while trying to print a different error.
    if not corpus:
        print(
            f"\n  ❌ ERROR: 0 entries selected from {config.corpus_path}."
            f"\n  If you passed --ids, they must match the corpus's own id"
            f"\n  values (e.g. 'tatoeba_2289'), not positional indices."
            f"\n  Use --dataset all to run the full corpus."
        )
        raise SystemExit(1)

    # Catch field name mismatches before burning money on API calls.
    ref_count = sum(1 for e in corpus if e.get(config.target_field))
    if ref_count == 0:
        print(
            f"\n  ❌ ERROR: No entries have a '{config.target_field}' field."
            f"\n  Your corpus uses different field names."
            f"\n  Available fields: {sorted(corpus[0].keys())}"
            f"\n  Set --target-field to the correct field name, or fix the corpus."
        )
        raise SystemExit(1)
    elif ref_count < len(corpus):
        print(f"  ⚠ WARNING: {len(corpus) - ref_count}/{len(corpus)} entries "
              f"are missing the '{config.target_field}' field.")

    # Check for missing IDs — required for result tracking
    id_count = sum(1 for e in corpus if "id" in e)
    if id_count == 0:
        print(
            f"\n  ❌ ERROR: No entries have an 'id' field."
            f"\n  Add sequential IDs to your corpus entries."
        )
        raise SystemExit(1)

    # Target language is required — without it, models guess (often
    # incorrectly) and the entire run is wasted money.
    # Checked here (after load_corpus) because corpus metadata may
    # auto-populate target_lang during loading.
    if not config.target_lang.strip():
        tgt = config.target_code or config.target_lang_code
        if tgt:
            from mt_eval_harness.language_cards import get_name
            hint = (
                f"\n  The corpus declares target code '{tgt}' but no language "
                f"name could be resolved — pass --target-lang explicitly "
                f"(e.g. --target-lang '{get_name(tgt) or tgt}')."
            )
        else:
            hint = "\n  Pass --target-lang <language>, e.g. --target-lang French."
        print(
            "\n  ❌ ERROR: target_lang is required." + hint +
            "\n  Without it, the model guesses the target language "
            "and usually gets it wrong."
        )
        raise SystemExit(1)

    # --- The model an engine runs (local-model) ---
    # Decided HERE, after the corpus named the pair and before the dry run
    # returns, so a dry run refuses exactly what the real run would: no model
    # given (there is no default model), a path that is not a directory, an
    # OPUS-MT pair model whose id names another pair. What it resolves —
    # the hub id, or the directory and a sha256 over its files — is printed
    # now and recorded on the run log, the run card and the fingerprint.
    engine_model = None
    if is_mt and method is None:
        from mt_eval_harness.methods.base_http_mt import MTConfigError
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
        _engine_cls = MT_METHOD_REGISTRY.get(config.mt_method)
        if getattr(_engine_cls, "takes_model", False):
            try:
                engine_model = _engine_cls.resolve_identity(
                    {"model": config.method_model},
                    source_code=config.source_code or "",
                    target_code=config.target_code or "",
                    allow_pair_mismatch=bool(getattr(
                        config, "allow_model_pair_mismatch", False)))
            except MTConfigError as exc:
                raise ValueError(str(exc)) from exc
            config.engine_model = _engine_model_record(engine_model)
            for _line in _engine_model_lines(engine_model):
                print(_line)

    # --- Dry run: stop here, AFTER config + corpus validation ---
    # A dry run is a pre-flight, not a syntax check: it must fail on exactly
    # what a real run would. Returning earlier (the old behaviour, before the
    # provider key load and the validation block above) false-greened broken
    # configs — an unresolved target_lang, wrong field names, an empty
    # selection — so --dry-run "passed" on runs that then died for real.
    if config.dry_run:
        # Pre-spend cost estimate. A dry run is OFFLINE (no API calls), so
        # this prices against the embedded fallback table, not live pricing —
        # est_basis carries the heuristic. The prompt load is best-effort:
        # a broken prompt config keeps failing at real-run time as before
        # (the dry-run pass/fail surface is unchanged by the estimate).
        _est_prompt = ""
        if not is_mt:
            try:
                _est_prompt = load_system_prompt(config, prompt_providers)
            except (ValueError, OSError):
                pass  # estimate without the prompt; the real run reports it
        _dry_cache = ResultCache(config, protection=_cache_protection)
        est_cost, est_basis = estimate_run_cost(
            corpus, config, system_prompt=_est_prompt, cache=_dry_cache,
        )
        print("\n  DRY RUN — config + corpus validated OK, no API calls.")
        print(f"  Would process {len(corpus)} entries.")
        # Same rule as the real run's estimate and total
        # (run_card.cost_estimate_label → cost_label).
        from mt_eval_harness.run_card import cost_estimate_label
        print("  Est. cost:   " + cost_estimate_label(
            est_cost, est_basis, _cost_config(config),
            _cost_provenance(config, dry_provider, _in_process)))
        # What the run will be instructed with and scored against — the
        # coaching file and the glossary, by path, or "none" (synthetic
        # user, Round 7: the summary named neither).
        coaching_path, glossary_path, glossary_status = _dry_run_inputs(config)
        if is_mt or is_method_plugin:
            coaching_text = ("n/a (the method translates by itself; no "
                             "harness prompt)")
        elif not coaching_path:
            coaching_text = "none"
        else:
            coaching_text = (f"{config.coaching_label} ({coaching_path})"
                             if config.coaching_label else coaching_path)
            if not Path(coaching_path).exists():
                coaching_text += "  — NOT FOUND: the real run stops on it"
        print(f"  Coaching:    {coaching_text}")
        # The prompt itself: the built-in one shown whole, a coaching file by
        # its first line and hash, and whether it replaces the built-in
        # prompt (it does) — plus a warning when the coaching text never
        # names the target language (Round 11 researcher: neither the plan
        # nor the card showed what the model was told).
        _prompt_plan = None
        if not (is_mt or is_method_plugin):
            from mt_eval_harness.prompt_plan import (
                prompt_plan, prompt_plan_lines)
            _prompt_plan = prompt_plan(config, prompt_providers)
            # A protected corpus's coaching file is shown by hash only
            # (prompt_plan.COACHING_LINE_WITHHELD — Round 12 school).
            for _line in prompt_plan_lines(
                    _prompt_plan, show_coaching_line=not _cache_protection,
                    **_target_names(config)):
                print(_line)
        if glossary_path:
            from_coaching = not config.glossary_file
            print(f"  Glossary:    {glossary_path}"
                  + (" (its dictionary)" if from_coaching else "")
                  + f" — {glossary_status}")
        else:
            # run_glossary says "no glossary (metric inactive) — <hint>"
            hint = glossary_status.split(" — ", 1)[-1]
            print(f"  Glossary:    none (terminology adherence inactive) — "
                  f"{hint}")
        if _dry_cache.enabled:
            print(f"  Cache:       {_dry_cache.cache_dir}/ "
                  f"({_dry_cache.stats().get('total_files', 0)} entries) — the "
                  f"model's output per source sentence, reused by a re-run; "
                  f"copies of the corpus's sentences"
                  + (", each carrying this corpus's mark"
                     if _cache_protection else "")
                  + " (git-ignored; --cache-dir moves it, --no-cache skips it)")
        else:
            print("  Cache:       disabled (--no-cache)")
        # The eval pack: the SAME check the real run makes (it stops on a
        # missing piece before translating), reported here without failing
        # the dry run. Lines start with EVAL PACK: for agents to find.
        from mt_eval_harness.config import (
            eval_pack_json, eval_pack_lines, eval_pack_status,
            merge_eval_pack_statuses,
        )
        pack = merge_eval_pack_statuses(eval_pack_checks)
        blocks_run = pack is not None
        if pack is None and config.target_code:
            # The gate saw no target language (a corpus file run with no
            # --target-lang / --target-lang-code): the corpus named it. The
            # real run is not stopped then, but scoring still needs the pack.
            from mt_eval_harness.corpus_loader import marked_local_only
            pack = eval_pack_status(
                {"id": Path(config.corpus_path).stem if config.corpus_path
                       else "(inline)",
                 "language_pair": {"target": config.target_code}},
                card_metrics_withheld=marked_local_only(
                    config.corpus_path, config.source_file,
                    config.reference_file),
                skip_fst=config.skip_fst,
                skip_eval_standard=config.skip_eval_standard)
        for line in eval_pack_lines(pack, blocks_run=blocks_run,
                                    language_label=config.target_lang):
            print(line)
        _script_note = script_choice_note(config)
        if _script_note:
            print(f"  ⚠ {_script_note}")
        elif (getattr(config, "target_script", "")
              and not getattr(config, "target_script_source", None)):
            print(f"  Script:      {config.target_script} — the prompt asks "
                  f"for it (--target-script)")
        if relative_only:
            _stated_grade = (dataset_meta or {}).get("contamination")
            _said = _contam.grade_phrase(contam_grade, _stated_grade)
            print(f"  Lane: {_contam.LANE_RELATIVE_ONLY} "
                  f"({_said} — relative comparison only).")
            if _contam.grade_note(contam_grade, _stated_grade):
                print(f"        {_contam.grade_note(contam_grade, _stated_grade)}")
        # The cap applies to a dry run too — a pre-flight must fail on
        # exactly what a real run would (see the block comment above).
        _enforce_max_cost(config, est_cost, est_basis)
        return {
            "dry_run": True,
            "entry_count": len(corpus),
            "est_cost_usd": est_cost,
            "est_basis": est_basis,
            "contamination": contam_grade,
            "relative_only": relative_only,
            "lane": _contam.lane_for_grade(contam_grade),
            "coaching_file": None if (is_mt or is_method_plugin) else coaching_path,
            "prompt": _prompt_summary(_prompt_plan),
            "glossary_file": glossary_path,
            "glossary": glossary_status,
            "eval_pack": eval_pack_json(pack, blocks_run=blocks_run),
        }

    # --- Load method plugin if specified ---
    # config.method_path takes precedence over the method parameter.
    # When a method is loaded, the harness delegates translation to it
    # and the system prompt / batching / tools are irrelevant.
    method_plugin = None   # code identity of a --method <dir> plugin (below)
    if is_mt and method is None:
        from mt_eval_harness.methods.registry import get_mt_method
        # Hand `-m` to an engine that runs the model it is given (local-model:
        # `--method local-model -m facebook/nllb-200-distilled-600M`, or a
        # transformers / CTranslate2 model directory), with the identity
        # resolved above so a large directory is hashed once. This used to
        # read config.model — which the relabel above had already turned into
        # the engine id, so -m never arrived (Round 10).
        mt_options: dict = {}
        if engine_model is not None:
            mt_options = {"model": config.method_model,
                          "model_identity": engine_model}
        method = get_mt_method(config.mt_method, **mt_options)
        print(f"  Method:      {method.name} (MT system '{config.mt_method}')")
        card = method.method_card() if hasattr(method, "method_card") else None
        if card:
            # Fail loud if a method ships an off-taxonomy card. Otherwise it
            # publishes an invalid method_class/paradigm and silently drops off
            # the leaderboard's method-axis filters (see VALID_METHOD_CLASSES /
            # VALID_PARADIGMS). This is the guard that would have caught the
            # old "machine-translation-api" class bug.
            from mt_eval_harness.config import validate_method_card
            card_errors = validate_method_card(card)
            if card_errors:
                raise ValueError(
                    f"MT method '{config.mt_method}' has an invalid method card:\n"
                    + "\n".join(f"  - {e}" for e in card_errors)
                )
            print(f"  Method ID:   {card.get('method_id', 'unknown')}")
            print(f"  Method class: {card.get('class')} / paradigm: {card.get('paradigm')}")
    elif config.method_path and method is None:
        from mt_eval_harness.method_loader import load_method, plugin_provenance
        method = load_method(config.method_path)
        print(f"  Method:      {method.name} (from {config.method_path})")
        card = method.method_card()
        if card:
            print(f"  Method ID:   {card.get('method_id', 'unknown')}")
            print(f"  Method class: {card.get('class', 'unknown')} / "
                  f"paradigm: {card.get('paradigm') or 'unknown'}")
        # load_method fills in the optional protocol members a plugin left
        # out (name from method.json, a method card built from method.json)
        # — say so, so the author knows where the label came from.
        defaulted = getattr(method, "harness_defaulted", None) or []
        if defaulted:
            print(f"  Method card: the plugin defines no "
                  f"{' / '.join(m + ('()' if m == 'method_card' else '') for m in defaulted)}"
                  f" — taken from method.json")
        # Which code produced the translations: the plugin's declared version
        # and a sha256 over its files. Without it a plugin run published with
        # method_version / method_sha256 null (synthetic researcher, 2026-10-03).
        method_plugin = plugin_provenance(config.method_path)
        # The model it was handed (-m), recorded with the code identity: both
        # are part of what the run card says ran and of its fingerprint.
        method_plugin["model_given"] = config.method_model or None
        print(f"  Method code: sha256 {method_plugin['sha256'][:12]}… over "
              f"{len(method_plugin['files'])} file(s); version "
              f"{method_plugin['version'] or 'not declared in method.json'}")
        deps = method_plugin.get("dependencies")
        print("  Dependencies: " + (
            "not declared in method.json" if deps is None
            else (f"{len(deps)} declared" if isinstance(deps, list)
                  else "declared, but not as the list the methods spec "
                       "defines — recorded as written")
                 + (f" (dependency class {method_plugin['dependency_class']})"
                    if method_plugin.get("dependency_class") else "")))

    # --- System prompt capture (BENCHMARK_SPEC §3.2) ---
    # The full prompt text and its SHA-256 are stored in the RunLog
    # for reproducibility. Two runs with different prompts will have
    # different hashes, even if all other config is identical.
    system_prompt = ""
    system_prompt_sha256 = ""
    if method is None:
        system_prompt = load_system_prompt(config, prompt_providers)
        system_prompt_sha256 = hashlib.sha256(
            system_prompt.encode("utf-8")
        ).hexdigest()
        config.rendered_prompt_sha256 = system_prompt_sha256
        print(f"  System prompt: {len(system_prompt):,} chars (sha256: {system_prompt_sha256[:12]}...)")
        from mt_eval_harness.prompt_plan import prompt_plan, prompt_plan_lines
        for _line in prompt_plan_lines(prompt_plan(config, prompt_providers),
                                       show_coaching_line=not _cache_protection,
                                       **_target_names(config)):
            print(_line)
        if (getattr(config, "target_script", "")
                and (getattr(config, "target_script_source", None) or {}).get("chosen")):
            print(f"  Script:      {config.target_script} (from the references' "
                  f"script shares; the prompt asks for it)")
        elif getattr(config, "target_script", ""):
            print(f"  Script:      {config.target_script} (--target-script; "
                  f"the prompt asks for it)")
        else:
            _script_note = script_choice_note(config)
            if _script_note:
                print(f"  ⚠ {_script_note}")

    # --- Resolve hooks ---
    active_hooks = []
    if post_hooks and config.post_hooks:
        hook_map = {h.name: h for h in post_hooks}
        for hook_name in config.post_hooks:
            if hook_name in hook_map:
                active_hooks.append(hook_map[hook_name])
            else:
                print(f"  WARNING: Hook '{hook_name}' not found in registered hooks")

    # --- Resolve strategy ---
    strategy = resolve_strategy(config, method, tool_provider)
    strategy_name = type(strategy).__name__
    print(f"  Strategy:    {strategy_name}")

    # --- Execute ---
    semaphore = asyncio.Semaphore(config.concurrency)
    cache = ResultCache(config, protection=_cache_protection)
    cache_stats = cache.stats()
    # Where the cache is and what it holds, said every run: it keeps copies
    # of the corpus's sentences (sources and the model's outputs), and an
    # MCP run used to leave one in the project root unannounced (Round 11
    # hospital persona).
    print(f"  Cache: {cache_stats.get('total_files', 0)} existing entries"
          + (f" in {cache.cache_dir}/" if cache.enabled else " (disabled)")
          + (" (protected namespace: entries carry this corpus's mark and "
             "serve only runs on this corpus)" if _cache_protection else ""))
    if cache.enabled:
        print("         the model's output per source sentence, reused by a "
              "re-run of the same setup; it holds copies of the corpus's "
              "sentences (git-ignored; delete the folder to remove them; "
              "--no-cache skips it, --cache-dir moves it)")

    timestamp_start = datetime.now(timezone.utc).isoformat()
    run_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        # Self-contained MT systems have no LLM provider → no token pricing.
        pricing = await provider.fetch_pricing(session, api_key) if provider is not None else {}

        # --- Pre-spend cost estimate + --max-cost gate ---
        # BEFORE the first translation call: estimate what this run will
        # spend (live pricing when available) and honor the cap. Without
        # --max-cost this is one informational line, nothing more. Method
        # plugins / MT engines estimate as UNKNOWN (their cost is their own).
        if method is not None and provider is None and (
                is_mt or is_method_plugin):
            # The engine's or the plugin's own basis (api.estimate_run_cost):
            # a plugin's is said in the terms of the dependency class its
            # method.json declares. This line used to read "self-contained
            # method" for every plugin, A1 included (Round 10).
            est_cost, est_basis = estimate_run_cost(corpus, config)
        elif method is not None and provider is None:
            est_cost, est_basis = None, (
                "a method object passed in by the caller — its cost is its "
                "own; no LLM token estimate"
            )
        else:
            est_cost, est_basis = estimate_run_cost(
                corpus, config, system_prompt=system_prompt,
                pricing=pricing or None, cache=cache,
            )
        # The one cost rule (run_card.cost_estimate_label → cost_label): a
        # model that provably runs here (loopback endpoint, or the harness's
        # own in-process adapter) has no API bill, so the estimate says "$0
        # API cost" — the same words the end-of-run total and the card use.
        # It used to say "unknown" here and "$0" at the end of the same run
        # (synthetic researcher, Round 4; the in-process adapter, Round 6).
        # Everything else unpriced stays "unknown"; the NUMBER stays None.
        from mt_eval_harness.run_card import cost_estimate_label
        print("  Est. cost:   " + cost_estimate_label(
            est_cost, est_basis, _cost_config(config),
            _cost_provenance(config, provider, _in_process)))
        _enforce_max_cost(config, est_cost, est_basis)

        # All strategies return (results, cache_hits)
        results, cache_hits = await strategy.execute(
            entries=corpus,
            config=config,
            session=session,
            api_key=api_key,
            semaphore=semaphore,
            system_prompt=system_prompt,
            hooks=active_hooks,
            cache=cache,
            provider=provider,
        )

    elapsed = time.monotonic() - run_start

    # --- Enrich + Build RunLog ---
    enriched, total_cost, cached_cost = enrich_results(
        results, corpus, config, pricing)

    # Collect method card if a method plugin was used
    method_card_data = None
    if method is not None and hasattr(method, "method_card"):
        method_card_data = method.method_card()
    # The model a plugin actually called, when it says (per-result metadata
    # "model", else a declared "model") — the run card otherwise named only
    # the plugin, never the model behind it.
    if method_plugin is not None:
        from mt_eval_harness.method_loader import load_manifest, models_called
        models, basis = models_called(
            enriched, method_card_data, load_manifest(config.method_path))
        method_plugin["models_called"] = models
        method_plugin["models_basis"] = basis

    # Collect coaching prompt text for provenance
    coaching_text = None
    coaching_sha = None
    if config.coaching_file:
        try:
            coaching_text = Path(config.coaching_file).read_text(encoding="utf-8")
            coaching_sha = hashlib.sha256(coaching_text.encode("utf-8")).hexdigest()
        except FileNotFoundError:
            print(f"  ⚠ Coaching file not found: {config.coaching_file}")

    # The model the engine actually loaded, now that it has: the identity
    # resolved before the run plus a hub model's revision and the decode
    # length that applied. Recorded in config (a TestReport carries it) and
    # in provenance (publish reads it for the card and the fingerprint).
    if engine_model is not None and hasattr(method, "model_identity"):
        config.engine_model = _engine_model_record(method.model_identity())

    run_id = _build_run_id(
        config, method_class=(method_card_data or {}).get("class"))
    run_log = build_run_log(
        config=config,
        enriched_results=enriched,
        run_id=run_id,
        timestamp_start=timestamp_start,
        elapsed_s=elapsed,
        cache_hits=cache_hits,
        total_cost=total_cost,
        cached_cost=cached_cost,
        system_prompt=system_prompt,
        system_prompt_sha256=system_prompt_sha256,
        corpus_sha256=corpus_sha256,
        dataset_meta=dataset_meta,
        method_card=method_card_data,
        method_plugin=method_plugin,
        coaching_prompt=coaching_text,
        coaching_prompt_sha256=coaching_sha,
    )
    # Where the model ran, when it provably ran HERE: a --provider local run
    # whose endpoint is loopback has no API bill. Recorded (not re-derived
    # later from an env that may have changed) so the run card can say
    # "$0 API cost" instead of "unknown price". The cost NUMBER stays None —
    # the machine's own compute is still unpriced.
    _locality = _endpoint_locality(provider, _in_process)
    if _locality:
        # loopback: a --provider local endpoint on this machine; in-process:
        # the harness's own adapter ran the model in this process
        run_log["provenance"]["endpoint_locality"] = _locality
    if getattr(config, "engine_model", None):
        run_log["provenance"]["engine_model"] = config.engine_model

    output_path = write_run_log(run_log, config.output_dir)

    # A run where every entry errored has nothing to score — its report
    # would be all vacuous 0.0 rates. Keep the log for forensics, but fail
    # the run loudly so automation (sweep drivers, queue contributors)
    # never analyzes or publishes it.
    error_count = sum(1 for r in enriched if r.get("error"))
    if enriched and error_count == len(enriched):
        first_error = next(r["error"] for r in enriched if r.get("error"))
        # A provider error carries the response body, which can quote the
        # request. For a corpus that may not reach an outside model, the
        # printed error keeps its words and loses the sentences (an agent
        # reading this terminal would send them on). The log keeps it whole.
        from mt_eval_harness.transmission_policy import (
            TEXT_WITHHELD_MODES, scrub_corpus_text,
        )
        if (config.transmission_policy or {}).get("mode") in TEXT_WITHHELD_MODES:
            first_error = scrub_corpus_text(first_error, [
                v for e in enriched
                for v in (e.get("source"), e.get("expected"),
                          e.get("raw_predicted"), e.get("predicted"))])
        print(f"\n  RUN FAILED: all {len(enriched)} entries errored.")
        print(f"  First error:  {str(first_error)[:200]}")
        print(f"  Forensic log: {output_path}")
        raise RuntimeError(
            f"Vacuous run: every entry errored (first: {str(first_error)[:120]}). "
            f"Log kept at {output_path} for forensics; do not analyze or publish it."
        )

    print(f"\n{'=' * 60}")
    print(f"  Run complete: {run_id}")
    print(f"  Entries:      {len(enriched)}")
    print(f"  Cache hits:   {cache_hits}")
    # the translation phase only (model calls), not start-up or scoring
    print(f"  Translation:  {elapsed:.1f}s (model calls only)")
    cached_note = f"  (+${cached_cost:.4f} original price of cached entries)" if cached_cost else ""
    # Free / consumer-MT engines (libretranslate, apertium, …) have no LLM token
    # price, so total_cost is None — show "n/a", never crash the run summary.
    from mt_eval_harness.run_card import run_cost_label
    print(f"  Total cost:   {run_cost_label(run_log)}{cached_note}")
    print(f"  Run log:      {output_path}")
    print("=" * 60)

    # --- Auto-score ---
    # Score the run immediately so users don't need a separate
    # 'mt-eval test' step. The report is written alongside the run log.
    from mt_eval_harness.tester import analyze_run_log
    from mt_eval_harness.plugin_discovery import discover_metric_plugins

    # Auto-discover language-specific metric plugins (e.g. GiellaLT FST).
    # We use skip_fst=True here because the translation has already completed —
    # blocking AFTER spending API credits would be a terrible UX. The FST gate
    # fires properly when the user runs 'mt-eval test' separately. During auto-
    # score, we just include whatever plugins are already installed.
    metric_plugins = discover_metric_plugins(
        run_log.get("config", {}),
        skip_fst=True,
        method_dir=config.method_path,
    )

    report_path = output_path.with_name(output_path.stem + "_report.json")
    report = analyze_run_log(
        run_log,
        output_path=report_path,
        metric_plugins=metric_plugins or None,
        source_log_path=str(output_path.resolve()),
    )

    # --- Test-set read log (read_log) ---
    # The corpus file has now been read AND scored. If nmt-forge registered
    # it as a workspace's test/sealed set, it left a <file>.reads.jsonl
    # beside it and counts every read in it — reads through the harness used
    # to go uncounted (synthetic researcher, Round 7). No log, nothing
    # written; a failed append warns and never fails the run.
    from mt_eval_harness.read_log import (
        read_log_path, read_recorded_line, record_read,
    )
    recorded: list[Path] = []   # corpus files whose read log got this read
    if isinstance(report, dict) and not report.get("error"):
        for corpus_file in _corpus_files_read(config):
            rec = record_read(corpus_file, command="run", purpose="benchmark",
                              run_id=run_id)
            if rec and not rec.get("error"):
                recorded.append(corpus_file)

    # --- Auto-print run card ---
    # Show a human-readable summary immediately after scoring so users
    # don't need to parse JSON or run 'mt-eval card' separately. Suppressed
    # under --json so the only thing on stdout is the JSON summary.
    if not config.json_mode:
        try:
            from mt_eval_harness.run_card import render_run_card
            print(render_run_card(output_path, report_path))
        except Exception as e:
            # Card rendering should never block the run — log and move on
            print(f"  ⚠️  Failed to render run card: {e}")
    for corpus_file in recorded:
        print(read_recorded_line(corpus_file))

    # --- Publish ---
    # `run --publish` asked for a non-interactive one-step publish — do it
    # directly (auto-confirmed, same content-safety gating as `mt-eval publish`)
    # so it also works under --json / CI. Otherwise offer the interactive
    # prompt, which is skipped under --json (it would pollute the JSON output or
    # block on a redirected input()).
    if getattr(config, "auto_publish", False):
        _auto_publish_report(config, report_path)
    elif not config.json_mode:
        try:
            from mt_eval_harness.cli import _prompt_publish
            _prompt_publish(report_path)
        except Exception:
            # Publishing is optional — never block the run
            pass

    # --- Machine-readable summary (for `mt-eval run --json`) ---
    # Attach an in-memory summary the CLI emits as JSON on success. Set AFTER
    # write_run_log() above, so the persisted run log on disk is unchanged;
    # this key only ever lives on the returned dict.
    run_log["_summary"] = {
        "run_id": run_id,
        "model": config.display_model,
        "corpus": config.corpus_path or "(parallel-text)",
        "entry_count": len(enriched),
        "error_count": error_count,
        "elapsed_s": round(elapsed, 1),
        "total_cost_usd": round(total_cost, 4) if total_cost is not None else None,
        "scores": report.get("overall", {}),
        # Contamination lane — HIGH-contamination corpora are relative-only and
        # must never be read as absolute quality (SSOT: contamination.py).
        "contamination": contam_grade,
        "relative_only": relative_only,
        "lane": _contam.lane_for_grade(contam_grade),
        "report_path": str(report_path),
        "run_log_path": str(output_path),
    }
    if recorded:
        # The test-set read logs this run appended to (read_log).
        run_log["_summary"]["read_logs"] = [str(read_log_path(p))
                                            for p in recorded]

    return run_log


def _target_names(config: RunConfig) -> dict:
    """The run's target language name and code, as a prompt-plan warning
    names them (prompt_plan.prompt_plan_lines)."""
    return {"target_name": (config.target_lang or "").strip(),
            "target_code": (config.target_code or config.target_lang_code
                            or "").strip()}


def _prompt_summary(plan: dict | None) -> dict | None:
    """The dry run's --json view of a prompt plan: what kind of prompt, its
    sha256 and length, and for a coaching file whether it replaces the
    built-in prompt and names the target — never the coaching text."""
    if not plan:
        return None
    keep = ("kind", "sha256", "chars", "coaching_file", "replaces_builtin",
            "names_target", "error")
    out = {k: plan[k] for k in keep if k in plan}
    if plan.get("kind") == "naive":
        out["text"] = plan.get("text")
    elif plan.get("kind") == "coaching":
        out["builtin_not_sent"] = plan.get("builtin")
    return out


def _dry_run_inputs(config: RunConfig) -> tuple[str | None, str | None, str]:
    """The coaching file and glossary a run will use, for the dry run's
    summary: (coaching path or None, glossary path or None, the glossary
    status in run_glossary's words). The glossary is decided by the rule
    scoring uses (plugin_discovery.run_glossary over the run's config):
    --glossary, else a JSON coaching file's ``dictionary`` — then the
    glossary path IS the coaching file. It was already validated
    (preflight_scoring_inputs)."""
    from mt_eval_harness.plugin_discovery import run_glossary
    coaching = config.coaching_file or config.custom_prompt_path or None
    glossary, status = run_glossary({"glossary_file": config.glossary_file,
                                     "coaching_file": config.coaching_file})
    if config.glossary_file:
        glossary_path = str(config.glossary_file)
    elif glossary and config.coaching_file:
        glossary_path = str(config.coaching_file)
    else:
        glossary_path = None
    return coaching, glossary_path, status


def _corpus_files_read(config: RunConfig) -> list[Path]:
    """The corpus file(s) on disk a run read: the corpus (a registry id is
    resolved to its file by validation), or the two files of a parallel-text
    run. Only existing files — nothing else can carry a read log."""
    paths = ([config.corpus_path] if config.corpus_path
             else [config.source_file, config.reference_file])
    return [Path(p) for p in paths if p and Path(p).is_file()]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_run_id(config: RunConfig, method_class: str | None = None) -> str:
    """Build a human-readable run ID from config.

    Ends with a 6-hex-char entropy suffix: timestamps are second-granular,
    and two runs of the same model+condition starting in the same second
    used to collide on the log filename — each overwrote half of the
    other's run/report pair, corrupting both (2026-06-11 sweep).

    The condition slot names what ran: the prompt condition for the
    harness's own LLM path, but a method plugin's METHOD CLASS (its card's
    ``class``, ``custom-plugin`` when it declares none) — no harness prompt
    ever reached a plugin, yet its run id said ``naive`` (synthetic
    researcher, Round 4). Publish labels the card's condition the same way.
    MT engines keep their prompt slot: their published condition is still
    "naive" (the queue's engine-coverage dedupe — a founder item).
    """
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # Sanitize model name: full slugs like "google/gemini-3.1-pro-preview"
    # contain slashes that would create nested directories in the run log path.
    # display_model labels self-contained MT runs by their engine (e.g.
    # "google-translate") instead of the unused default LLM slug.
    model_short = config.display_model.replace("/", "_").replace("-", "").replace(".", "")
    is_plugin = (bool((getattr(config, "method_path", None) or "").strip())
                 and not getattr(config, "mt_method", ""))
    if is_plugin:
        prompt = str(method_class or "custom-plugin")
    else:
        prompt = config.prompt_version.replace(".", "")

    # The run id becomes a FILENAME: anything outside [word . -] (a "/" in
    # --run-name or a dataset label, a space, a colon) would point the log
    # write at a directory that does not exist — and it fails only AFTER the
    # whole run has been paid for (synthetic researcher persona, 2026-10-03).
    def _safe(text) -> str:
        return re.sub(r"[^\w.-]+", "-", str(text)).strip("-") or "x"

    parts = [f"run_{ts}_{model_short}_{_safe(prompt)}_{_safe(config.dataset)}"]

    if config.tools_enabled:
        parts.append("tools")
    if config.post_hooks:
        parts.append("hooks")
    if config.batch_size > 1:
        parts.append(f"b{config.batch_size}")
    if config.run_name:
        parts.append(_safe(config.run_name))
    parts.append(secrets.token_hex(3))

    return "_".join(parts)


# ---------------------------------------------------------------------------
# Multi-model parallel execution
# ---------------------------------------------------------------------------

async def execute_multi_run(
    configs: list[RunConfig],
    prompt_providers: dict | None = None,
) -> list[dict | None]:
    """Execute multiple model runs in parallel.

    THIS IS THE RECOMMENDED WAY TO RUN MULTI-MODEL BENCHMARKS.

    Each config gets its own aiohttp session and concurrency semaphore,
    so models on different providers (Google, Anthropic, OpenAI, etc.)
    don't compete for rate limits. Wall-clock time = slowest single
    model, not sum of all models.

    Example:
        configs = [
            RunConfig(model="google/gemini-3.1-pro-preview", ...),
            RunConfig(model="anthropic/claude-opus-4.7", ...),
            RunConfig(model="openai/gpt-5.5", ...),
        ]
        results = await execute_multi_run(configs)
        # results: [RunLog_dict, RunLog_dict, RunLog_dict]

    Args:
        configs: List of RunConfig objects, typically one per model.
                 All other config fields (corpus, batch_size, etc.)
                 can vary per model if needed.
        prompt_providers: Optional prompt provider registry (for champollion
                          prompts). Passed through to each execute_run().

    Returns:
        List of RunLog dicts, one per config. Failed runs return None.
        Order matches the input configs list.
    """
    async def _safe_run(config: RunConfig) -> dict | None:
        """Execute a single model, catching exceptions to avoid
        killing the entire parallel batch on one failure.

        Returns a RunLog dict on success, or a dict with an 'error'
        key on failure (so callers can distinguish from None).
        """
        try:
            return await execute_run(config, prompt_providers=prompt_providers)
        except Exception as exc:
            model_label = config.model_id
            print(f"\n  ERROR [{model_label}]: {exc}")
            return {"error": str(exc), "model_id": model_label}

    print(f"\n  Launching {len(configs)} models in parallel...")
    return await asyncio.gather(*[_safe_run(c) for c in configs])


def _auto_publish_report(config, report_path) -> bool:
    """`run --publish`: publish the finished report, never killing the run.

    Passes the explicit production opt-in (--prod) and the sign-in-free
    intake (--anonymous) through to publish_to_supabase. Catches SystemExit
    as well as Exception: the prod-write guard raises SystemExit(2), and
    letting it escape discarded the run summary after the scores were already
    written — the old behaviour of every `run --publish` against the live
    board. Returns True when the publish went through.
    """
    prod = getattr(config, "publish_prod", False)
    anonymous = getattr(config, "publish_anonymous", False)
    retry = (f"mt-eval publish {report_path} --prod"
             + (" --anonymous" if anonymous else ""))
    try:
        from mt_eval_harness.publish import publish_to_supabase
        publish_to_supabase(str(report_path), auto_confirm=True,
                            yes_prod=prod, anonymous=anonymous)
        return True
    except (Exception, SystemExit) as e:
        print(f"  ✗ Publish failed: {e}")
        print(f"  → The scores are saved. Retry with: {retry}")
        return False
