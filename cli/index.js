/**
 * champollion — Programmatic API entry point.
 *
 * Re-exports the public API surface for consumers who `import` the package
 * directly (e.g., custom build scripts, programmatic sync, or method class
 * extensions). The CLI (`bin/cli.js`) does NOT use this file — it calls
 * into `lib/` directly.
 *
 * EXPORTS:
 *   - Translation methods: LLM, DirectLLM, LLMCoached, GoogleTranslate, API,
 *     DeepL, MicrosoftTranslator, LibreTranslate, OpenAI, Anthropic, Gemini
 *   - Orchestrator: getMethod, translateBatch, translateRawContent
 *   - Configuration: resolveConfig, generateConfigTemplate, resolvePairs
 *   - Language cards: getLanguageCard, getLanguageReference, getRegister,
 *     getRegisterPresets, getFormality, getGenderGuidance, getAllLanguageCodes,
 *     resolveCode
 *   - Sync: runSync, runContentSync
 *   - One pair's pipeline: translateWithFallback, translateAndValidate,
 *     previewRequests, createFallbackBudget
 *   - Locale layout: discoverLocaleLayout, resolveLocaleFiles
 *   - Quality: validateTranslations
 *   - Utilities: loadApiKey, getEnvOrFileVar, costLabel
 */

// ── Translation method classes ─────────────────────────────────────
export { TranslationMethod } from './lib/methods/base.js';
export { LLMMethod } from './lib/methods/llm.js';
export { DirectLLMMethod } from './lib/methods/direct-llm.js';
export { LLMCoachedMethod } from './lib/methods/llm-coached.js';
export { GoogleTranslateMethod } from './lib/methods/google-translate.js';
export { APIMethod } from './lib/methods/api.js';
export { DeepLMethod } from './lib/methods/deepl.js';
export { MicrosoftTranslatorMethod } from './lib/methods/microsoft-translator.js';
export { LibreTranslateMethod } from './lib/methods/libretranslate.js';
export { OpenAIMethod } from './lib/methods/openai.js';
export { AnthropicMethod } from './lib/methods/anthropic.js';
export { GeminiMethod } from './lib/methods/gemini.js';

// ── Translation orchestrator ───────────────────────────────────────
export {
  getMethod,
  translateBatch,
  translateRawContent,
} from './lib/translate.js';

// ── Configuration & pair resolution ────────────────────────────────
export {
  resolveConfig,
  generateConfigTemplate,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_BATCH_SIZE,
} from './lib/config.js';
export { resolvePairs } from './lib/pairs.js';

// ── Writing systems (a pair's `script`) ────────────────────────────
// The same decision sync makes: a locale with two real orthographies (crk,
// sr) refuses until one is chosen; a chosen display script is produced by
// converting the working-script translation. The MCP translate tool uses
// these so it never picks an orthography sync would refuse to pick.
export {
  resolveTargetScript,
  formatScriptChoiceError,
  convertScript,
  applyScriptFallback,
  getConverterInfo,
} from './lib/scripts.js';

// ── Language cards & registers ─────────────────────────────────────
export {
  getLanguageCard,
  getLanguageReference,
  getRegister,
  getRegisterPresets,
  getFormality,
  getGenderGuidance,
  getAllLanguageCodes,
  getMethodSupport,
  resolveCode,
  // A code or a language NAME ("French") → the code to work in; with a
  // project's locales, the project's own spelling ("fr"). Never guesses.
  findLanguagesByName,
  resolveLanguageInput,
  // Dynamic card tier (packaged installs): warm the per-user cache up
  // front instead of paying a per-miss synchronous fetch.
  prefetchLanguageCards,
  getCardSourceInfo,
} from './lib/registers.js';

// Cache staleness check for the dynamic card tier (no-op in repo
// checkouts; TTL-gated; never throws). bin/cli.js runs this before
// every command — programmatic consumers can call it themselves.
export { maybeRefreshCardCache } from './lib/cards/refresh.js';

// The ONE card adapter + reader primitives, re-exported so out-of-repo
// consumers (the MCP server depends on this package for exactly this) read
// cards through the same seam as everything else. A ninth private reader is
// how the MCP server came to serve "[object Object]" for weeks.
export {
  AGREEMENT, attributions, atlasVersion, coverage, display,
  isAttributed, isDisputed, listCodes, normalizeCard, readCard, requireAtlas,
} from './lib/cards/reader.js';

// ── Sync pipeline ──────────────────────────────────────────────────
export { runSync, runContentSync } from './lib/sync.js';

// ── One pair's translation pipeline ────────────────────────────────
// What `champollion sync` and `serve` run for a batch of keys: cache →
// method → quality gate → cache, then the pair's fallback for what that
// left (a resolved pair from resolvePairs; `options.tm` from loadTM;
// `options.cwd` = the project directory, where methods read their key,
// endpoint, coaching and glossary). The MCP translate tool runs a project's
// fallback through it. createFallbackBudget caps a fallback under a cost.
export { translateWithFallback, translateAndValidate, previewRequests } from './lib/translate-pair.js';
export { createFallbackBudget } from './lib/fallback.js';

// ── Locale layout ───────────────────────────────────────────────────
// Which files make up each locale (flat, folder per locale, localesPattern)
// — the same answer sync, verify and xliff use, for build scripts and
// agents that need to find a project's locale files.
export { discoverLocaleLayout, resolveLocaleFiles } from './lib/locale-layout.js';

// ── Quality gate ───────────────────────────────────────────────────
// The shared-output rule (one text for several different sources) — the MCP
// translate tool holds its answers to it, as sync does.
export { validateTranslations, SharedOutputIndex, sharedOutputItems, sharedOutputReason } from './lib/validate.js';
// The index a sync of one locale starts with (the memorized sentences its
// cache remembers + what the project's files and pages already hold): the
// MCP translate tool, given a project_dir, refuses what sync would refuse.
export { projectSharedOutputIndex } from './lib/shared-output-seed.js';

// ── API key resolution ─────────────────────────────────────────────
export { loadApiKey, getEnvOrFileVar } from './lib/api-key.js';

// ── Cost wording ───────────────────────────────────────────────────
// One label for an estimate ("$0 API cost (runs on this machine)",
// "est. ~$0.0123"): the MCP translate tool names a price in the CLI's words.
export { costLabel, LOCAL_COST_LABEL } from './lib/cost-label.js';

// ── Coaching utilities (for custom method implementations) ─────────
export {
  loadCoachingData,
  findDictionaryMatches,
  buildCoachedSystemMessage,
  buildContentCoachingBlock,
  DEFAULT_COACHING_DIR,
} from './lib/methods/llm-coached.js';

// ── Translation Memory ─────────────────────────────────────────────
export {
  loadTM,
  saveTM,
  lookupTM,
  storeTM,
  partitionByTM,
  tmMethodKey,
  tmSize,
  // A project's cache from before coaching was keyed reads as sync reads it.
  adoptLegacyCoachingKeys,
  // Which setup wrote the entry a lookup serves (an earlier model's, under
  // model carry-over), and that key in words — so a cached answer can say
  // who wrote it when that is not the engine named (MCP translate).
  servingMethodKey,
  describeMethodKey,
} from './lib/tm.js';
// The text a key is cached under — a gettext msgctxt folded in
// ("msgctxt\u0004msgid" → "msgctxt\u0004<text>") — and which contexts a
// project's source gives each text: the MCP translate tool keys a context as
// sync does, and never writes a context-free entry for a text the project
// has only with a context.
export { tmSourceText, CONTEXT_SEPARATOR } from './lib/tm-evict.js';
export { sourceTextContexts } from './lib/source-contexts.js';

// ── XLIFF interchange ──────────────────────────────────────────────
export {
  exportXLIFF,
  importXLIFF,
} from './lib/xliff.js';

// ── ICU MessageFormat ──────────────────────────────────────────────
export {
  isICUString,
  parseICU,
  reassembleICU,
  extractTranslatableSegments,
  getRequiredPluralCategories,
} from './lib/icu.js';

// ── Terminology enforcement ────────────────────────────────────────
export { verifyTerminology } from './lib/terminology.js';

// ── Integrity auditing ─────────────────────────────────────────────
export {
  auditLocalePair,
  formatIntegrityReport,
  checkPluralCategories,
} from './lib/integrity.js';
