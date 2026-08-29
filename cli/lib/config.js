/**
 * Config resolution — finds and merges configuration from multiple sources.
 *
 * Priority (highest to lowest):
 *   1. CLI flags (--source, --dir, --model, --method, etc.)
 *   2. Config file (champollion.config.json)
 *   3. Sensible defaults
 *
 * WHY: The goal is zero-config for simple cases (just drop your locale
 * files in a folder and go) while allowing full customization for
 * complex setups with custom registers, models, and batch sizes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_REGISTERS, getLanguageCard, getRegister, resolveCode } from './registers.js';
import { resolveModel } from './models.js';
import { validateNoTranslateConfig } from './no-translate.js';

const CONFIG_FILENAMES = ['champollion.config.json'];

// Canonical defaults — import these in any module that needs a fallback
// instead of hardcoding the string/number inline.
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3.5-flash';
const DEFAULT_BATCH_SIZE = 80;
// Max parallel API calls for JSON key-value translation. 50 is kind to
// free/low-tier keys on a zero-config first run (200 would hammer 429s).
// Single source of truth — sync.js + docusaurus-sync.js + the --json-concurrency
// help text all reference this so the documented default can't drift.
const DEFAULT_JSON_CONCURRENCY = 50;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_COACHED_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 3;  // Max cascade retries on batch parse failure (batch → half → individual)

/**
 * Default concurrency for method-internal API call parallelism.
 *
 * Controls how many pMap workers run within a single pair's translate().
 * This is SEPARATE from sync-level concurrency (jsonConcurrency /
 * contentConcurrency in sync.js) which controls how many locale pairs
 * translate in parallel.
 *
 * Lower values = kinder to rate limits. Higher values = faster batches.
 * Configurable via `methodConcurrency` in champollion.config.json.
 */
const DEFAULT_METHOD_CONCURRENCY = 4;

// Cost estimation heuristics — shared by all provider estimateCost() methods
// AND by the OpenRouter estimator (methods/openrouter-pricing.js). This is
// the ONE exported constant pair: the two used to disagree (60/10 here vs
// 200/30 in openrouter-pricing.js), so the same sync printed different
// estimates depending on which engine handled a pair.
//
// 200 in / 30 out is the defensible pair: real batch prompts carry the
// system message, register/style instructions, and the JSON envelope
// amortized across keys — measured payloads land near 200 input tokens per
// key, not 60. The cost preview also feeds the --max-cost fail-safe cap, so
// a 3x underestimate would let a capped run overspend; erring high is the
// safe direction for a pre-run gate.
// Character-based (API providers): ~25 chars per key average across UI strings.
const EST_INPUT_TOKENS_PER_KEY = 200;
const EST_OUTPUT_TOKENS_PER_KEY = 30;
const EST_CHARS_PER_KEY = 25;

const DEFAULTS = {
  version: 3,
  inputLocale: 'en',
  baseUrl: '',
  localesDir: './locales',
  contentDir: null,  // Hugo content directory (e.g. './content'). null = disabled.
  // Markdown body translation granularity: 'block' (default — segment the
  // body, TM-cache per block, one batched API call for the misses) or
  // 'page' (single whole-body prompt, still TM-threaded). Overridable per
  // pair. Validated in docusaurus-sync.js — anything else fails loud.
  contentSegmentation: 'block',
  promptContext: null, // Global context injected into all translation prompts (e.g. "This is a developer tool README")
  translatableFields: null,  // Override DEFAULT_TRANSLATABLE_FIELDS from content.js
  languages: [],
  // Keys whose correct translation is the source value, verbatim: dot-paths
  // and/or globs (e.g. ["**.url", "pages.software.*.repo"]). Matching keys are
  // copied to every target and never sent to a backend, gated, or billed.
  // See lib/no-translate.js for the pattern grammar and the reasoning.
  noTranslate: [],
  // Auto-detect source values that are nothing but a `scheme://` URL and
  // treat them as no-translate. On by default: a URL's correct translation
  // is the URL, but the source-echo gate rejects exactly that, so the default
  // behaviour has no correct outcome. Set false to translate URL-valued keys.
  noTranslateUrls: true,
  pairs: null,       // Advanced per-pair overrides (see pairs.js)
  model: DEFAULT_OPENROUTER_MODEL,
  defaultMethod: 'llm',     // Global default: llm, llm-coached, google-translate, api, deepl, microsoft-translator, libretranslate, openai, anthropic, gemini
  batchSize: DEFAULT_BATCH_SIZE,
  temperature: null,  // null = use method default (0.3 standard, 0.2 coached)
  coachingFile: null,  // Path to free-text coaching prompt file (relative to cwd)
  coachingPrompt: null,  // Resolved coaching prompt text (read from coachingFile at runtime)
  fallbackPrefix: '[EN] ',
  apiKeyEnvVar: 'OPENROUTER_API_KEY',
  format: 'auto',
  lint: {
    srcDir: null,       // Auto-detected from framework
    ignore: ['node_modules', '.next', 'dist', 'build', '.git', 'public', '.vercel'],
    minLength: 2,       // Minimum string length to flag
  },
  seo: {
    urlPattern: '/:locale/:path',
    pages: null,        // null = auto-detect from locale keys or explicit list
  },
  typegen: {
    output: null,       // null = disabled. e.g., './locales.d.ts'
    autoGenerate: false,
  },
};

/**
 * Parse and validate a concurrency CLI flag value.
 *
 * Rejects anything that isn't a finite integer >= 1. An invalid value
 * (0, negative, NaN, "abc") would otherwise reach the pMap worker pool,
 * spawn zero workers, write nothing, and silently "succeed".
 *
 * @param {string} raw - Raw flag value
 * @param {string} flagName - Flag name for the error message (e.g. '--json-concurrency')
 * @returns {number} Validated concurrency integer
 */
function parseConcurrency(raw, flagName) {
  const val = parseInt(raw, 10);
  if (!Number.isInteger(val) || val < 1) {
    throw new Error(`${flagName} must be a positive integer (got "${raw}").`);
  }
  return val;
}

/**
 * Resolve the full config by merging defaults → config file → CLI args.
 *
 * @param {import('./types.js').CLIArgs} cliArgs - Parsed CLI arguments
 * @param {string} cwd - Working directory to resolve paths from
 * @returns {import('./types.js').ChampollionConfig} Fully resolved config
 */
function resolveConfig(cliArgs = {}, cwd = process.cwd()) {
  // Start with defaults
  const config = { ...DEFAULTS };

  // Layer 2: config file
  let configPath;
  if (cliArgs.config) {
    configPath = path.resolve(cwd, cliArgs.config);
  } else {
    // Try each config filename in priority order
    configPath = CONFIG_FILENAMES
      .map(name => path.resolve(cwd, name))
      .find(p => fs.existsSync(p));
  }

  if (configPath && fs.existsSync(configPath)) {
    try {
      // Strip a leading UTF-8 BOM (U+FEFF) before parsing. A BOM-prefixed
      // config file (common from Windows editors) otherwise hard-crashes
      // JSON.parse with an opaque "Unexpected token" error.
      let configRaw = fs.readFileSync(configPath, 'utf-8');
      if (configRaw.charCodeAt(0) === 0xFEFF) configRaw = configRaw.slice(1);
      const fileConfig = JSON.parse(configRaw);

      // `skipKeys` is a documented synonym for `noTranslate` — canonicalize it
      // here so exactly one field name reaches every consumer. Both spellings
      // at once is ambiguous (which list wins?), so it fails loud rather than
      // silently dropping one of them.
      if (Object.prototype.hasOwnProperty.call(fileConfig, 'skipKeys')) {
        if (Object.prototype.hasOwnProperty.call(fileConfig, 'noTranslate')) {
          const e = new Error(
            `${path.basename(configPath)} sets BOTH "noTranslate" and "skipKeys" — `
            + 'they are the same field under two names. Keep one (prefer "noTranslate").',
          );
          e.code = 'CHAMPOLLION_CONFIG_INVALID';
          throw e;
        }
        fileConfig.noTranslate = fileConfig.skipKeys;
        delete fileConfig.skipKeys;
      }

      // Common misspellings / legacy names → correct field name
      const FIELD_ALIASES = {
        sourceLocale: 'inputLocale',
        sourceLang: 'inputLocale',
        source: 'inputLocale',
        locale: 'inputLocale',
        dir: 'localesDir',
        contentDirectory: 'contentDir',
        translatable: 'translatableFields',
        batch: 'batchSize',
        key: 'apiKeyEnvVar',
        apiKey: 'apiKeyEnvVar',
        provider: 'defaultMethod',
        concurrency: 'concurrency',  // valid — not in DEFAULTS but consumed by sync
        skipKeys: 'noTranslate',     // canonicalized above; alias kept for the hint
        noTranslateURLs: 'noTranslateUrls',
        neverTranslate: 'noTranslate',
      };

      // Warn on unknown config fields — prevents silent acceptance of
      // misspelled or unsupported fields that the user expects to work.
      const knownFields = new Set([...Object.keys(DEFAULTS), 'concurrency', 'jsonConcurrency', 'contentConcurrency']);
      for (const key of Object.keys(fileConfig)) {
        // Underscore-prefixed keys are comment/annotation fields — e.g. the
        // "_setup" hint emitted by `champollion init`, or user "_comment"
        // keys (already tolerated silently in per-pair configs).
        if (key.startsWith('_')) continue;
        if (!knownFields.has(key)) {
          const suggestion = FIELD_ALIASES[key];
          if (suggestion) {
            console.warn(`[WARN] Unknown config field "${key}" — did you mean "${suggestion}"?`);
          } else {
            console.warn(`[WARN] Unknown config field "${key}" in ${path.basename(configPath)} — this field has no effect. Check spelling or see docs for supported fields.`);
          }
        }
      }

      Object.assign(config, fileConfig);

      // Validate the no-translate fields against the file that set them, so
      // the error names the right place. A bad value must never fall through
      // to "translate everything" — that is the corruption path the feature
      // exists to close.
      validateNoTranslateConfig(config.noTranslate, config.noTranslateUrls);
    } catch (err) {
      // A field-level validation error is already specific and actionable —
      // wrapping it in "Could not parse" would misreport valid JSON as a
      // syntax error and send the user hunting for a trailing comma.
      if (err.code === 'CHAMPOLLION_CONFIG_INVALID') throw err;

      // FAIL LOUD. This was a `[WARN]` that fell through to the built-in
      // defaults: the Object.assign above never ran, so one trailing comma
      // silently replaced the user's inputLocale, localesDir, defaultMethod
      // AND model with defaults — and the run then translated the wrong
      // locales against the wrong model, at full API cost, having printed
      // only a warning the user had no reason to read as fatal.
      //
      // There is no "continue with defaults" that is ever what the user
      // wanted here: they wrote a config file precisely so these values
      // would not be the defaults. No opt-out — fix the JSON.
      const e = new Error(
        `Could not parse ${path.basename(configPath)}: ${err.message}\n\n`
        + `  ${configPath}\n\n`
        + `Champollion will not fall back to default settings — that would `
        + `translate a different set of locales with a different model than `
        + `your config asks for, and bill you for it. Fix the JSON syntax `
        + `(a trailing comma or unquoted key is the usual cause) and re-run.`,
      );
      e.code = 'CHAMPOLLION_CONFIG_PARSE';
      throw e;
    }
  }

  // Layer 3: CLI overrides
  if (cliArgs.source) config.inputLocale = cliArgs.source;
  if (cliArgs.dir) config.localesDir = cliArgs.dir;
  if (cliArgs.model) config.model = cliArgs.model;
  if (cliArgs.method) config.defaultMethod = cliArgs.method;
  // --batch-size: keys per translation API call. Accept both the CLI flag
  // spelling ('batch-size' from bin/cli.js parseArgs) and the programmatic
  // camelCase form (watch mode / tests pass cliArgs objects directly).
  // Validated like the concurrency flags: a 0/negative/NaN batch size would
  // otherwise slice zero-key batches and silently translate nothing.
  const rawBatchSize = cliArgs['batch-size'] ?? cliArgs.batchSize;
  if (rawBatchSize != null && rawBatchSize !== false && rawBatchSize !== '') {
    config.batchSize = parseConcurrency(String(rawBatchSize), '--batch-size');
  }
  if (cliArgs.format) config.format = cliArgs.format;
  if (cliArgs.temperature != null) config.temperature = parseFloat(cliArgs.temperature);
  if (cliArgs['content-dir']) config.contentDir = cliArgs['content-dir'];
  if (cliArgs['base-url']) config.baseUrl = cliArgs['base-url'];
  if (cliArgs['coaching-file']) config.coachingFile = cliArgs['coaching-file'];

  // Concurrency configuration — separate limits for JSON (lightweight) and
  // content (heavy markdown) API calls. --concurrency sets both (backward compat).
  //
  // Validate eagerly here (NOT inside the worker pool): an invalid value like
  // 0, a negative, or a non-number would otherwise make pMap spawn zero
  // workers, write nothing, and "succeed". This check runs in resolveConfig,
  // so it fires for --dry runs too. parseConcurrency throws a clear error.
  if (cliArgs.concurrency) {
    const val = parseConcurrency(cliArgs.concurrency, '--concurrency');
    config.jsonConcurrency = val;
    config.contentConcurrency = val;
  }
  if (cliArgs['json-concurrency']) {
    config.jsonConcurrency = parseConcurrency(cliArgs['json-concurrency'], '--json-concurrency');
  }
  if (cliArgs['content-concurrency']) {
    config.contentConcurrency = parseConcurrency(cliArgs['content-concurrency'], '--content-concurrency');
  }

  // Parse --force-keys: comma-separated dot-notation keys to force re-translate
  config.forceKeys = cliArgs['force-keys']
    ? cliArgs['force-keys'].split(',').map(k => k.trim()).filter(Boolean)
    : [];

  // Docusaurus auto-detection: if format is still 'auto' and docusaurus.config.js
  // exists in the project root, switch to 'docusaurus' mode and use the standard
  // Docusaurus i18n directory. This runs before path resolution so localesDir
  // is correctly resolved to an absolute path below.
  if (config.format === 'auto' && detectDocusaurus(cwd)) {
    config.format = 'docusaurus';
    // Only override localesDir if it's still the default './locales'.
    // If the user explicitly set localesDir in their config, respect that.
    if (config.localesDir === './locales' || config.localesDir === 'locales') {
      config.localesDir = './i18n';
    }
  }

  // Resolve localesDir and contentDir to absolute paths
  config.localesDir = path.resolve(cwd, config.localesDir);
  if (config.contentDir) {
    config.contentDir = path.resolve(cwd, config.contentDir);
  }

  // Resolve model alias (e.g., "gemini-flash" → "google/gemini-3.5-flash")
  config.model = resolveModel(config.model);

  // Coaching file: read the file contents into coachingPrompt if coachingFile is set.
  // This allows users to maintain coaching prompts as separate text files rather
  // than inlining long strings into champollion.config.json.
  if (config.coachingFile) {
    const coachingPath = path.resolve(cwd, config.coachingFile);
    if (fs.existsSync(coachingPath)) {
      config.coachingPrompt = fs.readFileSync(coachingPath, 'utf-8').trim();
    } else {
      console.error(`  [WARN] Coaching file not found: ${coachingPath}`);
    }
  }

  // Resolve the languages config into a normalized map:
  // { "fr": { name: "French", register: "..." }, ... }
  config.resolvedLanguages = resolveLanguages(config);

  return config;
}

/**
 * Normalizes the `languages` config into a consistent map.
 *
 * Supports three input formats:
 *   - Array of codes:    ["fr", "de", "ja"]
 *   - Object with registers: { "fr": "My custom French tone", "de": { register: "..." } }
 *   - Empty (auto-detect from directory)
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config with languages field
 * @returns {Object<string, import('./types.js').LanguageConfig>} Map of locale code → language config
 */
function resolveLanguages(config) {
  const resolved = {};
  const langs = config.languages;

   if (Array.isArray(langs) && langs.length > 0) {
    // Simple array: ["fr", "de", "ja"]
    for (const code of langs) {
      // Resolve aliases for card lookups (e.g., 'fr' → 'fra' for getLanguageCard)
      // but key the map by the RAW code the user provided. This ensures pair
      // keys built in pairs.js (e.g., 'en:fr') match user config.pairs entries.
      const canonical = resolveCode(code);
      const card = getLanguageCard(canonical);
      const defaultPresetKey = card?.formality?.default || null;
      resolved[code] = {
        name: card?.name || code,
        register: getRegister(canonical),
        // Store the preset key so consumers (e.g., DeepL) can look up
        // preset-specific metadata without reverse-matching prompt text.
        registerPreset: defaultPresetKey,
        dir: card?.dir || 'ltr',
        formalitySystem: card?.formality?.system || null,
      };
    }
  } else if (typeof langs === 'object' && !Array.isArray(langs) && Object.keys(langs).length > 0) {
    // Object form: { "fr": "Custom register", "de": { name: "German", register: "..." } }
    for (const [code, value] of Object.entries(langs)) {
      // Resolve aliases for card lookups but keep raw code as the map key
      // (same rationale as the array branch above).
      const canonical = resolveCode(code);
      const card = getLanguageCard(canonical);
      if (typeof value === 'string') {
        // Shorthand: could be a preset key OR custom register text.
        // getRegister() handles both — if it matches a preset key, returns
        // that preset's prompt; otherwise passes through as custom text.
        // Detect whether it's a known preset key to preserve for DeepL/etc.
        const isPresetKey = card?.registers?.[value] != null;
        resolved[code] = {
          name: card?.name || code,
          register: getRegister(canonical, value),
          registerPreset: isPresetKey ? value : null,
          dir: card?.dir || 'ltr',
          formalitySystem: card?.formality?.system || null,
        };
      } else if (typeof value === 'object') {
        // Full object form: extract all supported fields.
        // Fields beyond name/register flow through to the pair graph,
        // enabling per-language model/batchSize/maxRetries/script without
        // the more verbose `pairs` config syntax.
        const regValue = value.register || null;
        const isPresetKey = regValue && card?.registers?.[regValue] != null;
        resolved[code] = {
          name: value.name || card?.name || code,
          register: regValue
            ? getRegister(canonical, regValue)
            : getRegister(canonical),
          registerPreset: isPresetKey ? regValue : (regValue ? null : card?.formality?.default || null),
          dir: card?.dir || 'ltr',
          formalitySystem: card?.formality?.system || null,
          ...(value.method && { method: value.method }),
          ...(value.model && { model: value.model }),
          ...(value.batchSize && { batchSize: value.batchSize }),
          ...(value.maxRetries != null && { maxRetries: value.maxRetries }),
          ...(value.script && { script: value.script }),
          ...(value.scriptFallback && { scriptFallback: value.scriptFallback }),
        };
      }
    }
  }
  // If empty, auto-detection happens in sync.js by scanning the directory

  return resolved;
}

/**
 * Auto-detect target languages by scanning the locales directory
 * for locale files (JSON, TOML, or YAML) that aren't the source file.
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config
 * @returns {Object<string, import('./types.js').LanguageConfig & { filename: string }>} Map of locale code → language config with filename
 */
function autoDetectLanguages(config) {
  const detected = {};
  const inputLocale = config.inputLocale || 'en';

  if (!fs.existsSync(config.localesDir)) return detected;

  // Supported locale file extensions
  const LOCALE_EXTS = ['.json', '.toml', '.yaml', '.yml'];

  const files = fs.readdirSync(config.localesDir)
    .filter(f => {
      const ext = path.extname(f);
      return LOCALE_EXTS.includes(ext);
    })
    .sort();

  for (const file of files) {
    const ext = path.extname(file);
    const code = path.basename(file, ext);

    // Skip source locale
    if (code === inputLocale) continue;

    // Use language card for richer metadata, fall back to backward-compat proxy
    const canonical = resolveCode(code);
    const card = getLanguageCard(canonical);
    detected[code] = {
      name: card?.name || code,
      register: getRegister(canonical),
      registerPreset: card?.formality?.default || null,
      dir: card?.dir || 'ltr',
      formalitySystem: card?.formality?.system || null,
      filename: file,
    };
  }

  return detected;
}

/**
 * Generate a starter config file for `champollion init`.
 * Produces v3 format config.
 *
 * @param {string} [localesDir] - Locale files directory (default: './locales')
 * @param {string} [inputLocale] - Source locale code (default: 'en')
 * @returns {string} JSON string of the config template
 */
function generateConfigTemplate(localesDir, inputLocale) {
  return JSON.stringify({
    _setup: 'Add your target language codes to the languages array below. Example: ["fr", "de", "ja"]',
    version: 3,
    inputLocale: inputLocale || 'en',
    baseUrl: '',
    localesDir: localesDir || './locales',
    languages: [],
    model: DEFAULT_OPENROUTER_MODEL,
    batchSize: DEFAULT_BATCH_SIZE,
  }, null, 2);
}

/**
 * Detect if the current project is a Docusaurus site.
 *
 * Checks for the existence of docusaurus.config.js (or .ts) in the
 * given directory. This is the canonical marker for a Docusaurus project.
 *
 * @param {string} cwd - Project root to check
 * @returns {boolean} True if a Docusaurus config file exists
 */
function detectDocusaurus(cwd) {
  return (
    fs.existsSync(path.join(cwd, 'docusaurus.config.js')) ||
    fs.existsSync(path.join(cwd, 'docusaurus.config.ts'))
  );
}

export {
  resolveConfig,
  resolveLanguages,
  autoDetectLanguages,
  generateConfigTemplate,
  detectDocusaurus,
  CONFIG_FILENAMES,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_BATCH_SIZE,
  DEFAULT_JSON_CONCURRENCY,
  DEFAULT_TEMPERATURE,
  DEFAULT_COACHED_TEMPERATURE,
  EST_INPUT_TOKENS_PER_KEY,
  EST_OUTPUT_TOKENS_PER_KEY,
  EST_CHARS_PER_KEY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_METHOD_CONCURRENCY,
};
