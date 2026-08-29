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


def load_system_prompt(
    config: RunConfig,
    prompt_providers: list | None = None,
) -> str:
    """Load the system prompt based on config.prompt_version.

    Checks built-in versions first, then falls through to registered
    plugin providers.
    """
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

    errors = config.validate(prompt_versions=available_prompts)
    if errors:
        for e in errors:
            print(f"  CONFIG ERROR: {e}")
        raise ValueError(f"Invalid config: {'; '.join(errors)}")

    # Canonicalize the model slug to the resolved OpenRouter id. Aliases and
    # shorthand ("gemini-flash", "gpt-5.5") are conveniences for humans; if
    # they leak into the run log they become the published model_slug, and
    # one model fragments across leaderboard rows and fingerprints.
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
    # (an engine name isn't in MODEL_REGISTRY, so it maps to itself).
    if is_mt:
        config.model = config.mt_method

    # Method plugins (--method path/to/dir) are the same shape of bug: the
    # plugin translates, the LLM `model` field is never used, and the run
    # would otherwise be persisted/published as the phantom default LLM.
    # Relabel to the plugin's method_id (from its method.json; falls back to
    # the plugin dir basename) so the run log, report, and published card
    # name the method that actually ran.
    is_method_plugin = bool(getattr(config, "method_path", None)) and not is_mt
    if is_method_plugin:
        config.model = config.method_id

    print("=" * 60)
    print("MT Eval Harness — Run Execution")
    print("=" * 60)
    if is_mt:
        print(f"  System:      {config.mt_method}  (self-contained MT engine)")
    elif is_method_plugin:
        print(f"  System:      {config.method_id}  (method plugin: {config.method_path})")
    else:
        print(f"  Model:       {config.model} → {config.model_id}")
    print(f"  Prompt:      {config.prompt_version}")
    print(f"  Temperature: {config.effective_temperature}")
    print(f"  Dataset:     {config.dataset}")
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
        print(f"\n  Provider:    {config.provider} (not contacted — dry run)")
    else:
        # Use the provider system to load the correct API key.
        # For "openrouter" (default), this calls the same load_api_key()
        # from api.py. For direct providers, it loads the vendor-specific key.
        provider = get_provider(config.provider, base_url=getattr(config, "base_url", None))
        api_key = provider.load_api_key()
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
            "pip install --force-reinstall mt-eval."
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
        print("\n  " + _contam.relative_only_notice(contam_grade, contam_dataset_id))

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
    config.transmission_policy = enforce_transmission_policy(
        _policy,
        provider_name=(None if method is not None
                       else (provider.name if provider is not None
                             else "openrouter")),
        provider_supports_restricted=(
            provider.supports_restricted_transmission
            if provider is not None else True),
        provider_basis=(
            provider.transmission_basis if provider is not None
            else "OpenRouter routing pinned to data_collection=deny providers"),
        has_external_method=method is not None,
        attest_local_transport=config.attest_local_transport,
        # Locality must be PROVEN from the endpoint, never inferred from the
        # provider name: --provider local --base-url https://… (or a
        # LOCAL_API_BASE/OPENAI_API_BASE env) points "local" at a remote host.
        local_transport_verified=(
            method is None
            and provider is not None
            and provider.name == "local"
            and getattr(provider, "is_loopback_endpoint", lambda: False)()
        ),
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
                f"\n  Transmission policy: {_policy.mode.upper()} corpus "
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

    # --- Corpus SHA-256 for reproducibility (BENCHMARK_SPEC §3.3) ---
    # Hash the corpus file so run cards can pin results to a specific
    # dataset version. If the corpus changes, the hash changes, and
    # old run cards are flagged as non-comparable.
    corpus_sha256 = ""
    if config.corpus_path and Path(config.corpus_path).exists():
        corpus_sha256 = hashlib.sha256(
            Path(config.corpus_path).read_bytes()
        ).hexdigest()

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
        est_cost, est_basis = estimate_run_cost(
            corpus, config, system_prompt=_est_prompt,
            cache=ResultCache(config),
        )
        print("\n  DRY RUN — config + corpus validated OK, no API calls.")
        print(f"  Would process {len(corpus)} entries.")
        if est_cost is not None:
            print(f"  Est. cost:   ~${est_cost:.4f} ({est_basis})")
        else:
            print(f"  Est. cost:   unknown — {est_basis}")
        print("  (Scoring tools / eval packs are verified at real run time, "
              "not in a dry run.)")
        if relative_only:
            print(f"  Lane: {_contam.LANE_RELATIVE_ONLY} "
                  f"({contam_grade} contamination — relative comparison only).")
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
        }

    # --- Load method plugin if specified ---
    # config.method_path takes precedence over the method parameter.
    # When a method is loaded, the harness delegates translation to it
    # and the system prompt / batching / tools are irrelevant.
    if is_mt and method is None:
        from mt_eval_harness.methods.registry import get_mt_method
        # Forward `--model` to MT adapters that name a concrete model — the
        # local-model adapter's "the usual way": `--method local-model --model
        # facebook/nllb-200-distilled-600M` (or a CTranslate2 model dir), no
        # LOCAL_MODEL_ID env needed. A model id/path always contains a "/" (or
        # is an existing path); the LLM `--model` default ("gemini-pro") and
        # registry shortnames never do, so this never mis-forwards to the
        # cloud-API adapters (which ignore the option anyway).
        mt_options: dict = {}
        model_slug = (getattr(config, "model", "") or "").strip()
        if model_slug and ("/" in model_slug or Path(model_slug).exists()):
            mt_options["model"] = model_slug
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
        from mt_eval_harness.method_loader import load_method
        method = load_method(config.method_path)
        print(f"  Method:      {method.name} (from {config.method_path})")
        card = method.method_card()
        if card:
            print(f"  Method ID:   {card.get('method_id', 'unknown')}")
            print(f"  Method class: {card.get('class', 'unknown')}")

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
        print(f"  System prompt: {len(system_prompt):,} chars (sha256: {system_prompt_sha256[:12]}...)")

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
    cache = ResultCache(config)
    cache_stats = cache.stats()
    print(f"  Cache: {cache_stats.get('total_files', 0)} existing entries")

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
        if method is not None and provider is None:
            est_cost, est_basis = None, (
                "self-contained method — no LLM token pricing"
            )
        else:
            est_cost, est_basis = estimate_run_cost(
                corpus, config, system_prompt=system_prompt,
                pricing=pricing or None, cache=cache,
            )
        if est_cost is not None:
            print(f"  Est. cost:   ~${est_cost:.4f} ({est_basis})")
        else:
            print(f"  Est. cost:   unknown — {est_basis}")
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

    # Collect coaching prompt text for provenance
    coaching_text = None
    coaching_sha = None
    if config.coaching_file:
        try:
            coaching_text = Path(config.coaching_file).read_text(encoding="utf-8")
            coaching_sha = hashlib.sha256(coaching_text.encode("utf-8")).hexdigest()
        except FileNotFoundError:
            print(f"  ⚠ Coaching file not found: {config.coaching_file}")

    run_id = _build_run_id(config)
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
        coaching_prompt=coaching_text,
        coaching_prompt_sha256=coaching_sha,
    )

    output_path = write_run_log(run_log, config.output_dir)

    # A run where every entry errored has nothing to score — its report
    # would be all vacuous 0.0 rates. Keep the log for forensics, but fail
    # the run loudly so automation (sweep drivers, queue contributors)
    # never analyzes or publishes it.
    error_count = sum(1 for r in enriched if r.get("error"))
    if enriched and error_count == len(enriched):
        first_error = next(r["error"] for r in enriched if r.get("error"))
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
    print(f"  Elapsed:      {elapsed:.1f}s")
    cached_note = f"  (+${cached_cost:.4f} original price of cached entries)" if cached_cost else ""
    # Free / consumer-MT engines (libretranslate, apertium, …) have no LLM token
    # price, so total_cost is None — show "n/a", never crash the run summary.
    cost_label = f"${total_cost:.4f}" if total_cost is not None else "n/a (unpriceable engine)"
    print(f"  Total cost:   {cost_label}{cached_note}")
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

    # --- Publish ---
    # `run --publish` asked for a non-interactive one-step publish — do it
    # directly (auto-confirmed, same content-safety gating as `mt-eval publish`)
    # so it also works under --json / CI. Otherwise offer the interactive
    # prompt, which is skipped under --json (it would pollute the JSON output or
    # block on a redirected input()).
    if getattr(config, "auto_publish", False):
        try:
            from mt_eval_harness.publish import publish_to_supabase
            publish_to_supabase(str(report_path), auto_confirm=True)
        except Exception as e:
            # Publishing is optional — never block the run.
            print(f"  ✗ Publish failed: {e}")
            print(f"  → Retry with: mt-eval publish {report_path.name}")
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

    return run_log


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_run_id(config: RunConfig) -> str:
    """Build a human-readable run ID from config.

    Ends with a 6-hex-char entropy suffix: timestamps are second-granular,
    and two runs of the same model+condition starting in the same second
    used to collide on the log filename — each overwrote half of the
    other's run/report pair, corrupting both (2026-06-11 sweep).
    """
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # Sanitize model name: full slugs like "google/gemini-3.1-pro-preview"
    # contain slashes that would create nested directories in the run log path.
    # display_model labels self-contained MT runs by their engine (e.g.
    # "google-translate") instead of the unused default LLM slug.
    model_short = config.display_model.replace("/", "_").replace("-", "").replace(".", "")
    prompt = config.prompt_version.replace(".", "")

    parts = [f"run_{ts}_{model_short}_{prompt}_{config.dataset}"]

    if config.tools_enabled:
        parts.append("tools")
    if config.post_hooks:
        parts.append("hooks")
    if config.batch_size > 1:
        parts.append(f"b{config.batch_size}")
    if config.run_name:
        parts.append(config.run_name)
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
