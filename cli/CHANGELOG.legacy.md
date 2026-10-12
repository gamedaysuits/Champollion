# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.3.2] - 2026-05-27

### Added
- **`docs/METHOD_PLUGIN_SPEC.md`**: Created SSOT method plugin specification. Content sourced from `website/docs/reference/plugin-spec.md`, stripped of Docusaurus frontmatter. Resolves dangling README link.
- **`docs/SIGNIFICANCE_SPEC.md`**: Copied significance testing specification from `gds-mt-eval-harness/SIGNIFICANCE_SPEC.md` to the `docs/` SSOT directory. Harness copy retained.
- **`supabase/migrations/`**: Two migrations version-controlling the Supabase schema. Added 10 columns to `run_cards` (SCORING_SPEC §9.1: `composite_score`, `quality_tier`, `method_class`, `cost_per_1k_tokens`, `median_latency_seconds`, `p95_latency_seconds`, etc.). Created `datasets` table (metadata-only registry of evaluation corpora). Dropped `language_cards` table (language cards are JSON files loaded at build time, not DB data).
- **Git tags**: Created `v3.2.0`, `v3.3.0`, and `v3.3.1` tags on their respective commits.

### Fixed
- **Root file organization**: Moved 18 loose files (pitch decks, images, SVGs, research PDFs) from project root to `marketing/`, `diagrams/`, and `crk-translate/docs/research/`.
- **Stale harness docs**: Replaced 3 GDS-branded docs in `crk-translate/docs/internal/harness/` with redirect notes pointing to canonical `champollion/` versions.
- **Sovereignty language**: Updated `grant-proposal-guide.md` from a "guarantees" claim to non-achievement sovereignty phrasing per corrected project language. (The interim house term used here was itself later retired on 2026-07-20; the current house term is "sovereignty-aspirant".)
- **Deprecation notes**: Added deprecation warnings to `project-plan.md` (→ ROADMAP.md) and `revenue-model.md` (→ business-plan.md throughbill model).

### Added
- **`models` command** (`lib/commands/models.js`): Query available models from a provider's live API. `champollion models --method gemini` lists all models, helping users pick exact slugs. Read-only — does not modify config.
- **Centralized model service** (`lib/models.js`): Single source of truth for fetching available models from Gemini, OpenAI, and Anthropic APIs. In-memory cache prevents redundant API calls within a session.
- **Dynamic model picker in `init` wizard**: When selecting a direct provider (Gemini, OpenAI, Anthropic), the wizard now fetches real models from the API and shows a numbered picker. No more hardcoded model lists.
- **Parallel sync pipeline** (`lib/sync.js`): 10x speedup via concurrent locale-pair processing. Configurable via `jsonConcurrency` (default 200) and `contentConcurrency` (default 48). Translation pairs run in parallel, gated by concurrency limits.
- **Pre-commit i18n hook** (`.githooks/`): Automatically translates staged doc files on commit. Gracefully skips when `OPENROUTER_API_KEY` is not set. Both repos (champollion + arena) support this via `git config core.hooksPath .githooks`.
- **SSOT doc sync system** (`docs/` → Arena + Champollion sites): Scoring spec, benchmark spec, how-it-works, and history essay now have a canonical source in `docs/` with committed copies in the Arena and Champollion doc sites.
- **Three purpose-specific agent guides**: `docs/AGENTS.md` (redirect), `website/docs/guides/agent-guide.md` (for CLI users), `gds-mt-eval-harness/website/docs/getting-started/agent-guide.md` (for method researchers).
- **Full i18n site translation**: Champollion product site translated to 12 locales via dogfooding the CLI.
- **Untranslated detection in diff engine** (`lib/diff.js`): Diff now detects legacy `[EN]` markers and flags them for re-translation.
- **YAML format auto-detection** (`detectYAMLStyle()` in `lib/format.js`): Distinguishes Hugo i18n YAML (CLDR plural sub-keys only) from standard nested YAML by inspecting sub-key names.
- **Standard nested YAML serializer** (`flatToNestedYAML()` in `lib/format.js`): Writes proper tree-structured YAML without Hugo's `other:` wrapping. Used automatically when `detectYAMLStyle()` returns `'nested'`.
- **Version banner** (`output.banner()` in `lib/output.js`): Sync now prints `champollion v<version>` at startup, reading the version from `package.json` via `createRequire`. Suppressed in `quiet` and `json` modes.
- **Format detection logging** (`lib/sync.js`): Sync now logs `[INFO] Detected format: json (auto)` or `(config)` to show whether the file format was auto-detected or explicitly configured.
- **Framework detection logging** (`lib/sync.js`): When `contentDir` is set, sync logs `[INFO] Detected framework: Hugo` to confirm framework-aware sync is active.
- **Per-key progress bar** (`output.progressBar()` in `lib/output.js`): During translation, a `█░` progress bar renders inline showing `completed/total keys`. Uses `\r` carriage return for in-place updates. Suppressed in `quiet` and `json` modes.
- **`onProgress` callback** (`lib/methods/llm.js`): LLM method's `translate()` now fires an optional `onProgress(completed, total)` callback after each batch chunk completes (~30 keys), enabling real-time progress reporting. Threaded through `translate-pair.js` and wired to `progressBar()` in `sync.js`.

### Changed
- **Fail-loud architecture** (`lib/sync.js`): Removed `--fallback` flag and all `useFallback` code paths. Translation failures are now always errors with actionable messages — never silent write-and-move-on. Preflight check (`resolveRuntime`) validates API key and method readiness before starting.
- **`DEFAULT_MODEL` → `DEFAULT_OPENROUTER_MODEL`**: Renamed across 16 files to clarify this constant is the OpenRouter fallback, not a universal default. Direct providers (Gemini, OpenAI, Anthropic) now resolve their own default model from their method class at runtime.
- **Concurrency defaults**: `jsonConcurrency` bumped 50 → 200, `contentConcurrency` bumped 12 → 48.
- **Pair graph model resolution** (`pairs.js`): Direct-provider pairs now receive `model: null` instead of the OpenRouter slug. Each provider's method class handles model selection internally, preventing cross-provider slug confusion.
- **`writeLocaleFile()` signature**: New optional 5th parameter `yamlStyle` (`'hugo'|'nested'|null`) routes to the correct YAML serializer. Backward compatible — existing callers are unaffected.
- **`buildDefaultConfig()` is now `async`**: Fetches the top model from the provider API in `--yes` mode instead of hardcoding. Test updated accordingly.
- **YAML value quoting refactored**: Extracted `quoteYAMLValue()` from `flatToYAML()` — shared by both Hugo and nested serializers for consistent quoting behavior.
- **sync.js decomposition**: Broke the 1,145-line monolith into focused modules — `lib/cost-report.js` (cost estimation), `lib/docusaurus-sync.js` (Docusaurus pipeline), `lib/translate-pair.js` (shared TM→API→gate pipeline). sync.js is now 447 lines.
- **Output controller wiring**: `sync` command now routes all output through `lib/output.js`. `--json` flag emits NDJSON, `--quiet` suppresses informational messages.
- **Security consolidation**: `isUnsafeKey()` (prototype pollution guard) moved from `lib/methods/llm.js` to `lib/security.js` alongside `isPathContained()`. Security surface map documented in the module header.
- **Unknown method error**: `getMethod()` now throws a descriptive error for unrecognized translation method names instead of silently falling back to LLM. Prevents typos like `"gogle-translate"` from burning API spend on the wrong provider.
- **Method strategy docs**: `fst-gated` and `human-review` marked as `(planned)` in `lib/methods/base.js` instead of appearing as existing options.
- **npm package scope**: Internal spec files and artifacts now excluded from the published npm package.

### Fixed
- **Lint `walkDir` false exclusions** (`lib/lint.js`): `fullPath.includes(ig)` matched ignore patterns as substrings anywhere in the absolute path (e.g., `"test"` matched `/user/test-project/src/`). Now uses basename matching only (`entry.name === ig`).
- **YAML format mangling** (`lib/format.js`, `lib/sync.js`): Standard nested YAML files (e.g., `nav: { home: Home }`) were written back using Hugo's `other:` wrapping pattern. Sync now detects the source YAML style and preserves it on write.
- **`--json` and `--quiet` flags on sync**: Were parsed by the CLI but had no effect — now properly wired.
- **v2 backward compat**: `translateBatch()` defaults to `'llm'` when `pairConfig.method` is undefined (legacy callers that don't set a method field).
- **Broken `DEFAULT_MODEL` export** (`index.js`): Programmatic API was exporting a renamed constant — fixed.
- **Script converter locale exclusion**: `scriptConverter` locales (e.g., `crk-Cans`) were incorrectly included in `NON_LATIN_LOCALES` validation, causing false positives.
- **Font rendering** (`lib/fonts.js`): Fixed font loading for PUA-based script converters.

## [3.3.1] - 2026-05-24

### Added
- **Translation Memory** (`lib/tm.js`, `lib/commands/tm.js`): Cache translations keyed by SHA-256(source + locale + method). Subsequent syncs serve unchanged keys from `.champollion/tm.json` instead of calling the API. TM entries include locale (`l`) and method (`m`) metadata for per-locale management.
  - `champollion tm stats` — entry count, file size, per-locale breakdown
  - `champollion tm clear` — full or `--locale`-scoped clear with confirmation prompt (`--yes` to skip)
  - `--no-tm` flag on `sync` — bypass cache entirely (useful when switching providers)
- **XLIFF 1.2 interchange** (`lib/xliff.js`, `lib/commands/xliff.js`): Export/import translations for professional review in CAT tools (memoQ, SDL Trados, Phrase).
  - `champollion xliff export --locale fr` — generates `.champollion/xliff/fr.xliff`
  - `champollion xliff import .champollion/xliff/fr.xliff` — merges reviewed translations back (with `--dry` preview)
- **Terminology enforcement** (`lib/terminology.js`): Post-translation verification that coached dictionary terms appear in the LLM output. Reports violations as warnings, not blocking errors.
- **ICU MessageFormat support** (`lib/icu.js`): Parse, validate, and round-trip ICU plural/select strings. `integrity` command now checks plural category completeness per CLDR rules.
- **`status` command shows TM cache**: Entry count and file size displayed in the project summary header.
- **`init` wizard post-setup tips**: After writing config, the wizard now shows `tm stats` and `xliff export` examples with a cost-savings explanation.
- **Six new translation methods**: Direct API integrations for `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, and `gemini`. Zero external dependencies — all use Node.js built-in `fetch`.
- **Coaching support for direct LLM providers**: `openai`, `anthropic`, and `gemini` methods now load coaching data from `.champollion/coaching/<locale>.json`, injecting grammar rules into the system prompt and dictionary term overrides into per-batch user messages. Same coaching format as `llm-coached`.
- **Programmatic API** (`index.js`): New package entry point re-exports all method classes, orchestrator, configuration, sync pipeline, quality gate, coaching, TM, XLIFF, ICU, terminology, and integrity utilities.
- **Per-method onboarding**: `sync.js` now shows method-specific API key setup instructions with signup URLs when a key is missing (DeepL, Microsoft, LibreTranslate, OpenAI, Anthropic, Gemini).
- **Runtime model validation**: Direct LLM providers now validate model strings before making API calls. Catches OpenRouter-format strings, wrong-provider models, and deprecated model names — suggests alternatives.
- **`DirectLLMMethod` base class** (`lib/methods/direct-llm.js`): Shared base class for OpenAI, Anthropic, and Gemini. Subclasses implement only provider-specific HTTP details (~130 lines each vs ~300 before).
- **Model-aware quality tiers**: `getQualityTier()` now returns model-specific tiers.

### Changed
- **Shared retry helper** (`lib/methods/fetch-with-retry.js`): Extracted the common HTTP retry loop from all 4 non-LLM adapters into a single shared `fetchWithRetry()`. ~400 lines eliminated.
- **Setup help extraction** (`getSetupHelp()` on `TranslationMethod`): Moved method-specific setup guidance from a 125-line `if/else if` chain in `sync.js` into each method's own `getSetupHelp()` override. ~120 lines eliminated from sync.js.
- **Default model names updated**: Anthropic default changed to `claude-sonnet-4-6`. Gemini default changed to `gemini-2.5-flash`.
- **Error message standardization**: All providers now use consistent `[WARN] <Provider>: no API key — skipping.` format.
- **Documentation overhaul**: README, intro, quickstart, config, installation, CI/CD, troubleshooting all updated to reflect TM, XLIFF, and terminology features. Sidebar now includes all doc pages.

### Fixed
- **DeepL glossary retry budget** (`deepl.js`): Recursive fallback no longer resets the attempt counter.
- **`resolveRuntime` config mutation** (`sync.js`): CLI overrides no longer mutate the shared pairs map.
- **Content sync double-counting** (`sync.js`): Content-synced files no longer inflate final stats.


## [3.3.0] - 2026-05-22

### Added
- **Docusaurus i18n support**: Auto-detect Docusaurus projects and sync translations using the native `{message, description}` JSON format. New content discovery functions (`discoverDocusaurusContentFiles`, `getDocusaurusTargetPath`) support the Docusaurus directory-per-locale layout.
- **Docusaurus format helpers** (`lib/format.js`): `isDocusaurusJSON()` detects the `{message, description}` structure. `extractDocusaurusMessages()` and `injectDocusaurusMessages()` handle extraction and round-trip injection of translatable strings.
- **JSDoc type layer**: Comprehensive `@param`/`@returns` annotations across all exported functions. New `lib/types.js` provides shared typedefs (`ChampollionConfig`, `PairConfig`, `CLIArgs`, `CoachingData`, `DiffResult`). `jsconfig.json` enables IDE type-checking with zero runtime dependencies — no TypeScript compiler needed.
- **Short CLI flags**: `-h` (help), `-v` (version), `-y` (yes/skip wizard) — standard UNIX conventions.
- **Plugin precedence tracking**: `resolvePairs()` now tracks which fields were filled from system defaults (`_defaults` set). `resolvePluginForPair()` uses this to override only defaulted fields — explicit user configuration is never clobbered by a plugin.
- **Shared string classification** (`lib/string-classify.js`): Extracted common regex heuristics (URL detection, dot-notation, hex colors, template expressions) from `lint.js` and `autofix.js` into a shared module. Both consumers now use identical classification logic.
- **36 new tests** (702 → 738 at time of 3.3.0 release; current suite is 1502 tests).

### Changed
- **CLI parser**: Migrated from hand-rolled `argv` loop to Node.js built-in `util.parseArgs` with `strict: false`. Preserves all existing flag behavior while gaining proper type validation for known options.
- **Constants centralized**: `DEFAULT_MODEL` (`google/gemini-3.5-flash`) and `DEFAULT_BATCH_SIZE` (`30`) are now named exports from `config.js`. All consumers (`pairs.js`, `llm.js`, `llm-coached.js`, `translate.js`, `init.js`) import the constants instead of repeating inline literals. Changing the default model or batch size is now a single-line edit.
- **Coached cascade dedup**: `LLMCoachedMethod` now delegates its retry cascade to `LLMMethod.runCascade()` instead of duplicating the full cascade logic. The coached method only provides its custom `batchFn` and label.
- **CI stability**: Workflow matrix now uses `fail-fast: false` so a single flaky test doesn't cancel the entire matrix. Added `timeout-minutes: 5` as a safety net.

### Fixed
- **Missing Docusaurus exports**: `discoverDocusaurusContentFiles` and `getDocusaurusTargetPath` were referenced by `sync.js` but not committed to `content.js`, causing a `SyntaxError` on CI.

## [3.2.0] - 2026-05-14

### Added
- **Quality gate** (`lib/validate.js`): Deterministic validation runs before translations are written to disk. Five checks catch common MT failure modes:
  - Empty/blank output
  - Source echo (model returned the English input)
  - Hallucination loops (trigram repetition analysis, e.g., `"Qo' Qo' Qo'"`)
  - Length inflation (configurable `maxLengthRatio`, default 4×)
  - Script compliance (non-Latin locales must produce non-ASCII output)
- **Retry cascade**: On JSON parse failure, the translation batch automatically retries: full batch → half-batch → individual keys. Budget-capped via `maxRetries` (default 3) to prevent runaway token spend.
- **Prompt caching**: System/user message split across `llm.js`, `llm-coached.js`, and `openrouter-client.js`. The system message (register + rules) is identical across batches for a given locale, enabling provider-level prompt caching (Anthropic, Gemini).
- **Per-language config overrides**: Language definitions now support `model`, `batchSize`, `maxRetries`, and `script` fields. Inheritance chain: pair-level > language-level > global config > defaults.
- **`[GATE]` log prefix**: Quality gate failures are logged to stderr with `[GATE]` prefix, key name, reason, and value preview. No silent fallbacks.
- **Script converter pipeline**: Post-translation orthography conversion runs automatically in the sync pipeline for locales with registered converters. Five converters ship out of the box:
  - Plains Cree SRO → Syllabics (`crk`)
  - Serbian Latin → Cyrillic (`sr`)
  - Klingon Romanization → pIqaD (`tlh`, CSUR PUA)
  - Sindarin Latin → Tengwar, Mode of Beleriand (`x-elvish-s`, CSUR PUA)
  - Latin → Kryptonian (`x-kryptonian`, font-based cipher)
- **`fontNote` metadata**: `getConverterInfo()` now returns font-requirement metadata for PUA-based script converters, so consumers can display rendering instructions.
- **Live cost estimation** (`lib/methods/openrouter-pricing.js` → `lib/pairs.js` → `lib/sync.js`): Pre-sync cost estimates display per-pair breakdown (method, key count, approximate USD) with formatted table output. LLM and coached methods fetch live per-token pricing from the OpenRouter `/api/v1/models` endpoint (cached per-process). Google Translate returns documented rates ($20/1M chars). API returns server-determined. Cost estimation is gated on `OPENROUTER_API_KEY` presence — without a key, no paid translations occur so cost estimation is skipped. Non-blocking: errors in cost estimation never prevent translation.
- **Watch infrastructure hardening** (`lib/watch.js`):
  - Migrated from `fs.watch` (FSEvents) to `fs.watchFile` (stat polling, 500ms interval) for reliable detection across all platforms and filesystem types (including `/tmp` on macOS).
  - `startWatch` is now `async` — initial `runSync` is `await`ed before the watcher registers, eliminating the race condition where sync writes interfered with watcher initialization.
  - Returns a never-resolving Promise to block the CLI's `process.exit()` call, keeping the watch session alive until SIGINT.
  - `[WATCH] Ready` signal emitted after watcher is fully active, enabling deterministic test synchronization.
- **70 new tests** since v3.1.0 across coaching data, cost estimation, script converters, quality gate, retry cascade, and watch lifecycle. Suite total: **702 tests / 163 suites, 100% pass rate**.

### Changed
- `callOpenRouterJSON()` now returns `{ _parseError: true, rawContent, error }` on JSON parse failure instead of `null`. Callers can distinguish "API returned nothing" from "API returned garbage" and retry accordingly.
- `callOpenRouter()` accepts optional `systemMessage` parameter. When provided, messages array becomes `[system, user]` instead of `[user]`. Falls back to single-message format when absent (backward compatible).
- `PAIR_DEFAULTS` now includes `maxRetries: 3`.
- `--fallback` help text clarified: writes `[EN]-prefixed placeholders`, not real translations.
- `lib/commands/watch.js` now `await`s `startWatch()` to properly propagate the async lifecycle.

### Removed
- `test/benchmark/` purged from git history (1.1 GB of scraped site data). Files remain on disk for local dev; excluded from both git (`.gitignore`) and npm (`files` whitelist).

## [3.1.0] - 2026-05-13

### Added
- **`--method` CLI flag**: Override the default translation method from the command line (`llm`, `google-translate`, `api`).
- **Smart method detection**: If `GOOGLE_TRANSLATE_API_KEY` is set but no `OPENROUTER_API_KEY`, auto-switches to Google Translate.
- **Markdown safety warnings**: Google Translate method now warns when content translation falls back to LLM, explaining that Google Translate has no awareness of code blocks, shortcodes, or interpolation variables.
- **Register display**: `init` wizard shows the active register for each selected language. `status` command shows registers with `(default)` or `(custom)` labels.

### Changed
- **Config field standardized**: `inputLocale` is the canonical field. The deprecated `sourceLocale` alias has been removed.
- **Simplified config pipeline**: Removed v2→v3 auto-migration system (no external users to migrate).
- **Pairs use `defaultMethod`**: The pair graph respects the global `defaultMethod` config value, enabling CLI-driven and env-driven method selection.

### Removed
- `lib/migrate.js` — v2→v3 migration system (dead code).
- `sourceLocale` config alias — use `inputLocale` instead.
- v2 compatibility branch in translation dispatch.

## [3.0.0] - 2026-05-12

Initial public release. Per-pair translation engine with pluggable methods.

### Architecture
- **Pair graph** (`lib/pairs.js`): Each source→target pair is independently configurable with method, model, quality tier, batch size, and register.
- **Pluggable methods**: LLM (default), coached LLM, Google Translate, and remote API. Each pair can use a different method.
- **Plugin system** (`lib/plugins.js`): Install, remove, and validate pre-packaged translation recipes (JSON manifests, not code).
- **Pure ESM** with Node.js 20.11+ required.

### Translation Methods
- **LLM** (`lib/methods/llm.js`): Default method via OpenRouter with exponential backoff, key validation, and content-aware Markdown shielding.
- **Google Translate** (`lib/methods/google-translate.js`): Google Cloud Translation API v2 for key-value pairs. API key sent via header.
- **Coached LLM** (`lib/methods/llm-coached.js`): Grammar rules, dictionaries, and style notes injected into LLM prompts.
- **Remote API** (`lib/methods/api.js`): Thin HTTP client for community-hosted or IP-protected endpoints.
- **Script converters** (`lib/scripts.js`): Deterministic transliteration (Simplified↔Traditional Chinese, Cyrillic↔Latin Serbian) — zero-LLM, zero-cost.

### Formats & Content
- JSON, TOML, YAML locale files (auto-detected from file extensions).
- Hugo Markdown translation with front matter + body block protection (code fences, shortcodes, HTML).

### Developer Tools
- `sync`, `watch`, `audit`, `lint`, `wrap`, `seo`, `integrity`, `status`, `provenance`, `plugin` commands.
- Interactive `init` wizard with language preset groups and register display.
- Per-command `--help` for every command.
- JSON Schema for plugin manifests (`shared/schemas/champollion-plugin.schema.json`).

### Security
- Prototype pollution guard: `__proto__`, `constructor`, `prototype` rejected.
- Path containment: file writes validated to configured directories.
- Response validation: rejects hallucinated keys from LLM responses.
- Adversarial test suite (`test/redteam.test.js`).

### Quality
- 45+ language registers with culturally appropriate tones, RTL hints, and script directions.
- 651 tests across 148 suites — zero external dependencies.
