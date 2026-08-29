# Changelog

All notable changes to the MT Eval Harness (arena) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-06-16 — first public release

The inaugural public release of the harness (PyPI dist `mt-eval`, `pip install mt-eval-harness`).
Public versioning **starts here at 0.1.0**. The harness was matured through an
internal `3.x` series before this point; those entries are retained below under
*Pre-public internal history* for the record — nothing is scrubbed, the public
release sequence simply begins now. The feature set shipping in 0.1.0 is the
sum of everything documented in this file.

Highlights landed since the last internal cut:

### Added

- **Multi-provider LLM backend** — New `providers/` package with `LLMProvider` ABC and four implementations: OpenRouter (default), OpenAI, Anthropic, Gemini. Each provider handles message format translation, API key loading, pricing, and retry logic internally. Strategies are completely provider-agnostic. CLI flag: `--provider {openrouter,openai,anthropic,gemini}`.
- **Provider in config hash** — `RunConfig.config_hash()` now includes the provider, ensuring cache correctness when switching between OpenRouter and direct providers for the same model.
- **45 provider tests** — Registry, ABC compliance, message format conversion (OpenAI cache_control flattening, Anthropic system extraction, Gemini role mapping), API key loading, prefix stripping, pricing, and RunConfig integration.

### Changed

- **`publish.py` — generic plugin extraction** — Replaced hardcoded `crk_linter`/`crk_semantic` key lookups with flag-based discovery (`is_equivalence_linter`, `semantic_verdict_counts`). LYSS verdict extraction now probes any plugin's metrics dict. Any language with custom linters now gets full leaderboard coverage without code changes.
- **`publish.py` — entry-count enforcement** — `verify_corpus_integrity()` now enforces 95% entry-count coverage against sha-pinned dataset registry entries. Below-threshold runs are rejected with a clear error message.
- **`publish.py` — dynamic api_provider** — `api_provider` field in run cards is now pulled from the run config instead of hardcoded `"openrouter"`.
- **`config_exporter.py` — provider emission** — Export snippets include `provider` when non-default, keeping OpenRouter exports backward-compatible.
- **`runner.py` — provider-based key loading** — Uses `get_provider(config.provider)` for API key loading and pricing instead of direct `api.py` imports.
- **Strategies (single, batch, tool_call)** — Accept optional `provider` kwarg; use `provider.call()` when available, fall back to `call_openrouter()` for backward compatibility.

### Fixed

- **`config_exporter.py`** — `defaultMethod` now mapped from harness `prompt_version` via `_PROMPT_VERSION_TO_METHOD` instead of raw passthrough. Non-portable prompt versions (`custom`, `champollion`) emit a `_method_note` caveat. Validation against `_CLI_METHODS` prevents emitting configs that crash the CLI.

---

## Pre-public internal history

> These `3.x` versions were internal development milestones reached before the
> public `0.1.0` launch. They are kept verbatim as an honest engineering record;
> the public package's version line begins at 0.1.0 above.

## [3.0.0] — 2026-06-12

Stable release. Promotes 3.0.0-rc.1 with the post-rc hardening landed since 2026-06-07:

### Added

- **Fetch-from-source datasets** — EdTeKLA adapter rebuilds NC-licensed eval data byte-identically from the upstream repo at a pinned ref; corpus fetch-on-miss with license prompts and sha256 verification. EdTeKLA-derived data is no longer distributed in the repo.
- **Contribute queue** — `generate_sweep_queue.py` emits a 798-item public run queue with a curl-able static viewer; `run_baseline_sweep.py` gains parallel workers, manifest-based dedup, and a budget guard.
- **12 website locale-pair dev corpora** (Tatoeba, CC-BY-2.0) for the dogfood benchmark loop (`eng-{fra,deu,nld,tgl,spa,cmn,jpn,kor,por,tha,vie,arb}-dev-v1`).
- **Migrations 015–020** — corpus license columns, datasets RLS (held-out hidden), run_cards audit trail, language_experts, insert parity + trust hardening, advisor fixes.
- **Method validity spec** — dependency classes S/O/A1/A2/X across methods/benchmark/prize docs; dependency manifest in the method.json schema.
- **Coached-condition labeling** and multi-run parallelism in the harness; auth env overrides; contamination checker with quarantine flow.

### Changed

- `publish.py` hardened: retry/backoff, row validation, license passthrough, dataset metadata upsert, legacy dataset-id resolver, env-overridable Supabase target; idempotent `publish_all_reports.py` (staging-guarded).
- Test suite grown 534 → 592.

## [3.0.0-rc.1] — 2026-06-07

### Added

- **COMET bootstrap confidence intervals** — CIs for COMET scores are now computed using cached per-entry scores. This avoids running neural inference 1,000× per bootstrap iteration by caching the initial per-entry COMET scores and bootstrapping from those cached values. Implementation: `_comet_from_cached_scores()` in `confidence.py`.
- **AfriCOMET auto-selection** — For 35 African languages (yor, hau, ibo, amh, swa, kin, lug, wol, etc.), the harness automatically selects `masakhane/africomet-mtl` instead of the default `Unbabel/wmt22-comet-da`. This provides better correlation with human quality judgments for African language pairs. Implementation: `resolve_comet_model()` and `COMET_MODEL_REGISTRY` in `metrics_comet.py`.
- **Per-difficulty-tier CIs** — Bootstrap confidence intervals are now computed per difficulty tier (Tier 1–5), stored as `confidence_intervals_by_tier` in the report JSON. Implementation: `compute_per_tier_cis()` in `confidence.py`.
- **Difficulty tier display** — Console summary now includes a per-tier breakdown table showing Count, Exact Match %, chrF++, BLEU, and chrF++ CI per difficulty level, with human-readable labels (Easy → Expert).
- **COMET column in compare** — `compare.py` now includes COMET scores in the side-by-side comparison table. Column only appears when at least one report has COMET data.
- **`--comet-model` CLI override** — Explicit COMET model selection via config dict, overriding auto-selection.
- **`resolve_comet_model()` public API** — Exported from package. Priority: CLI override → language registry → default model.
- **`COMET_MODEL_REGISTRY` public API** — Extensible dict mapping language codes to COMET model names.
- **`mt-eval setup` wizard** — Interactive command that installs optional dependencies (COMET, FST) with explanations. Users never need to know pip commands. Also provides contextual install prompts during eval runs when an optional metric is missing. Flags: `--all`, `--comet`, `--fst`, `--status`.
- **Canonical MethodConfig schema** — All config surfaces (method.json, run cards, export-config, leaderboard publish/install) now use the same 8-field canonical shape: `model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier`. All fields are always present; unused values are `null`.
- **`mt-eval export-config`** — New command that generates a `champollion.config.json` snippet from a TestReport, bridging harness evaluation results back to production config.
- **`ChampollionRunConfig`** — Renamed from `ChampollionPromptConfig` (back-compat alias kept). Now includes all 8 canonical MethodConfig fields (Python snake_case): `model`, `temperature`, `batch_size`, `register`, `coaching_file`, `coaching_prompt`, `prompt_context`, `quality_tier`.
- **Shared model aliases** — Both Python harness and JS CLI now load model aliases from `shared/model-aliases.json`. Default model changed from `gemini-3.1-pro` to `gemini-pro` (alias).
- **Full `--champollion-config` import** — The `--champollion-config` flag now imports model, temperature, batchSize, and coaching data from the production config (not just register/prompt). Explicit CLI flags override imported values.
- **Coaching prompt parity** — `build_champollion_system_prompt()` now includes a coaching guidance block between register and rules, byte-identical to the JS `buildSystemMessage()` in `cli/lib/methods/llm.js`.
- **Run card `method_config` block** — `publish.py` now writes the full canonical MethodConfig to each published run card, enabling zero-reconstruction leaderboard install.

### Changed

- `compute_comet()` now accepts optional `model_name` parameter for explicit model selection.
- `tester.py` COMET section now resolves model via `resolve_comet_model()` before scoring.
- `tester.py` COMET missing-dep message replaced with interactive install prompt — users can install COMET right from the eval flow, no pip commands needed.
- `__init__.py` exports `resolve_comet_model` and `COMET_MODEL_REGISTRY`.

## [3.0.0-rc.0] — 2026-06-05

### Added

- Multi-model parallel runs via comma-separated `-m` flag.
- Four corpus formats: JSON, JSONL, TSV, parallel text.
- Champollion config interop (`--champollion-config`).
- Plugin architecture: MetricPlugin, PromptProvider, ToolProvider, PostTranslationHook.
- Bootstrap 95% confidence intervals for chrF++, exact_match_rate, composite.
- Paired bootstrap significance testing.
- HTML dashboard generator.
- Run comparison with regression/improvement tracking.
- Plugin export for champollion method deployment.
- COMET neural metric (optional, `pip install mt-eval-harness[comet]`).
- FST acceptance metric (optional, `pip install mt-eval-harness[fst]`).
- Leaderboard publish with OAuth PKCE authentication.
