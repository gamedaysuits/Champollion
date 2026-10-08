/**
 * LLM-Coached Translation Method — grammar/dictionary-injected LLM prompting.
 *
 * This method sits between raw LLM translation and a full FST-gated pipeline.
 * It injects developer-provided linguistic hints into the prompt before each
 * translation batch, giving the LLM explicit guidance for languages where
 * naive prompting produces frequent errors.
 *
 * TWO COACHING CHANNELS (both honored):
 *   a) Free-text coaching PROMPT — `coachingFile`/`coachingPrompt` on the pair
 *      config. This is what the harness export carries (config_exporter.py emits
 *      `coachingFile`), and it rides in the system message exactly as the plain
 *      `llm` method injects it. If a coaching file/prompt is CONFIGURED but
 *      cannot be loaded (missing/unreadable/empty), this method FAILS LOUD — it
 *      must never silently degrade a coached run to an uncoached one (that would
 *      publish a different system than the harness validated).
 *   b) Structured coaching DATA — .champollion/coaching/<locale>.json with
 *      grammar_rules, a dictionary, and style_notes. Per-batch dictionary
 *      matches are injected as REQUIRED TERMINOLOGY hints.
 *
 * PROVIDER-AGNOSTIC:
 *   The actual API call is dispatched on `pairConfig.provider` so a coached run
 *   validated against openai / anthropic / gemini / local in the harness is
 *   reproducible on the CLI — not just OpenRouter. The provider only swaps the
 *   HTTP transport; the coached system message is built once and shared.
 *
 * FALLBACK (uncoached) is reached ONLY when NO coaching is configured at all
 *   (no coachingFile/coachingPrompt AND no structured file) — the documented
 *   "coached method, no coaching yet" path, routed to the chosen provider.
 *
 * COACHING DATA FORMAT (.champollion/coaching/<locale>.json):
 *   {
 *     "grammar_rules": [
 *       "French adjectives agree in gender and number with the noun",
 *       "Use 'vous' for formal contexts, 'tu' for informal"
 *     ],
 *     "dictionary": {
 *       "dashboard": "tableau de bord",
 *       "deployment": "déploiement",
 *       "settings": "paramètres"
 *     },
 *     "style_notes": "Prefer active voice. Avoid anglicisms where a native French term exists."
 *   }
 *
 * WHY .champollion/ AND NOT localesDir/:
 *   Coaching data is a development tool artifact, not a deployable asset.
 *   Locale files in localesDir/ get bundled into the app. Coaching hints
 *   are tool configuration — they live in the project's .champollion/ directory,
 *   following the same convention as .husky/, .eslintrc/, etc.
 *
 * COST PROFILE: ~$0.02–0.04 per 1k keys (longer prompts from coaching context)
 * QUALITY TIER: high
 */

import path from 'node:path';
import fs from 'node:fs';
import { TranslationMethod } from './base.js';
import { callOpenRouterJSON } from './openrouter-client.js';
import { isCapturing, PREVIEW_KEY } from './request-capture.js';
import { estimateOpenRouterCost } from './openrouter-pricing.js';

// Re-use the LLM method's infrastructure (prompt building, key validation, cascade)
import { LLMMethod, inferKeyTypes, isUnsafeKey, buildSystemMessage, buildUserMessage, promptSettingsFor } from './llm.js';
// The coaching file + glossary helpers live in coaching-data.js (llm.js uses
// them too); re-exported below under their old names.
import { DEFAULT_COACHING_DIR, loadCoachingData, findDictionaryMatches, projectGlossary } from './coaching-data.js';
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_BATCH_SIZE, DEFAULT_COACHED_TEMPERATURE, DEFAULT_MAX_RETRIES, DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { pMap } from '../concurrent.js';
import { requireExactModelId } from '../models.js';
import { output } from '../output.js';

/**
 * Direct-provider methods a coached run can dispatch to (in addition to the
 * default OpenRouter path). Imported lazily inside _getProviderMethod() because
 * direct-llm.js already imports from THIS module — a static import would form a
 * cycle. Mirrors the provider set the harness export emits (config_exporter.py).
 */
const DIRECT_PROVIDER_MODULES = {
  openai:    { module: './openai.js',    export: 'OpenAIMethod' },
  anthropic: { module: './anthropic.js', export: 'AnthropicMethod' },
  gemini:    { module: './gemini.js',    export: 'GeminiMethod' },
  local:     { module: './local.js',     export: 'LocalMethod' },
};

/**
 * Every transport a coached (or plain llm) pair can name in `provider`.
 * pairs.js validates config against this list, so an unknown provider fails at
 * pair-graph build time instead of silently riding OpenRouter.
 */
const COACHED_PROVIDERS = ['openrouter', ...Object.keys(DIRECT_PROVIDER_MODULES)];

/**
 * Normalize a pair config's `provider` to a lowercase key. Absent/blank → the
 * default OpenRouter path, matching config_exporter.py (which only emits
 * `provider` when it is non-default).
 *
 * @param {string|null|undefined} provider
 * @returns {string}
 */
function normalizeProvider(provider) {
  const p = (provider == null ? '' : String(provider)).trim().toLowerCase();
  return p || 'openrouter';
}

/**
 * Resolve the free-text coaching prompt for a coached run.
 *
 * Precedence:
 *   1. pairConfig.coachingPrompt — already-resolved text (config.js and the
 *      harness export read the coaching file into this field).
 *   2. pairConfig.coachingFile — read the file on demand (relative to cwd).
 *
 * FAIL-LOUD CONTRACT: when a coaching file/prompt is *configured* but cannot be
 * turned into usable text (file missing, unreadable, or empty), this THROWS.
 * The coached method must never silently degrade to an uncoached run when the
 * operator asked for coaching — doing so would run a different system than the
 * one validated in the harness. The plain "llm" method is the explicit choice
 * for an intentionally-uncoached run.
 *
 * @param {object} pairConfig
 * @param {object} options
 * @returns {{ configured: boolean, text: string|null }}
 */
function resolveCoachingPrompt(pairConfig, options) {
  const hasFile = typeof pairConfig.coachingFile === 'string' && pairConfig.coachingFile.trim().length > 0;
  const promptText = typeof pairConfig.coachingPrompt === 'string' ? pairConfig.coachingPrompt.trim() : '';

  // Already-resolved coaching text wins.
  if (promptText) {
    return { configured: true, text: promptText };
  }

  // A coaching file is named but no text was resolved — read it now, and FAIL
  // LOUD on any problem rather than running uncoached.
  if (hasFile) {
    const cwd = options.cwd || process.cwd();
    const coachingPath = path.isAbsolute(pairConfig.coachingFile)
      ? pairConfig.coachingFile
      : path.resolve(cwd, pairConfig.coachingFile);

    let raw;
    try {
      raw = fs.readFileSync(coachingPath, 'utf-8');
    } catch (err) {
      throw new Error(
        `llm-coached: coachingFile "${pairConfig.coachingFile}" is configured but could not be read ` +
        `(${err.code || err.message}; resolved to ${coachingPath}). ` +
        `Refusing to run UNCOACHED — fix the path, or switch this pair to the plain "llm" method ` +
        `if you intend an uncoached run.`
      );
    }

    const text = raw.trim();
    if (!text) {
      throw new Error(
        `llm-coached: coachingFile "${pairConfig.coachingFile}" (${coachingPath}) is empty. ` +
        `Refusing to run UNCOACHED — add coaching guidance, or switch this pair to the plain "llm" method.`
      );
    }
    return { configured: true, text };
  }

  // No free-text coaching configured.
  return { configured: false, text: null };
}

class LLMCoachedMethod extends TranslationMethod {
  constructor(options = {}) {
    super('llm-coached', options);
    this.acceptsKeyInstructions = true; // prompt "UI context" lines (lib/methods/base.js)
    this.supportsRequestPreview = true; // its transport reports to request-capture.js
    this._coachingCache = new Map();
    // The pair's transport, known at construction (getMethod passes the pair
    // config) so preflight and cost estimation — which receive no pairConfig
    // of their own — check the provider the run will actually call.
    this._provider = normalizeProvider(options.provider);
  }

  /**
   * Translate a batch of key-value pairs with coaching augmentation.
   *
   * Strategy:
   *   1. Resolve the free-text coaching prompt (coachingFile/coachingPrompt).
   *      FAILS LOUD if configured but unloadable — never silently uncoached.
   *   2. Load structured coaching data (.champollion/coaching/<locale>.json).
   *   3. If NEITHER is configured, run the plain (uncoached) method for the
   *      chosen provider (documented fallback).
   *   4. Otherwise build the coached system message once and dispatch the API
   *      call to the provider named by pairConfig.provider (openrouter default,
   *      or openai/anthropic/gemini/local).
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {object} pairConfig - Pair config (method, provider, model, register, name, coachingFile, etc.)
   * @param {object} options - { apiKey, batchSize, cwd }
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const provider = normalizeProvider(pairConfig.provider);

    // ── Resolve coaching ───────────────────────────────────────────────
    // 1. Free-text coaching prompt (coachingFile/coachingPrompt). FAILS LOUD
    //    if a coaching file/prompt is configured but cannot be loaded — the
    //    coached method must never silently fall through to an uncoached run.
    const coachingPromptInfo = resolveCoachingPrompt(pairConfig, options); // throws on bad file

    // 2. Structured coaching data (.champollion/coaching/<locale>.json).
    const targetLocale = pairConfig.target || pairConfig.locale;
    const cwd = options.cwd || process.cwd();
    const coachingDir = options.coachingDir || path.join(cwd, DEFAULT_COACHING_DIR);
    const structured = this._loadCoachingData(coachingDir, targetLocale);

    const coachingConfigured = coachingPromptInfo.configured || Boolean(structured);

    // No coaching configured at all → run the plain (uncoached) method for the
    // chosen provider. This is the documented "coached method, no coaching yet"
    // path — NOT the silent-drop bug (dropping coaching that WAS configured),
    // which resolveCoachingPrompt() above now makes impossible.
    if (!coachingConfigured) {
      output.info(`No coaching configured for "${targetLocale}" (no coachingFile/coachingPrompt, no ${coachingDir}/${targetLocale}.json).`);
      output.info('Running the standard (uncoached) LLM method. Add coaching for better results.');
      // For OpenRouter, construct LLMMethod synchronously (no `await`) so the
      // pipeline reaches fetch() within the same microtask — preserving the
      // original fallback's timing. Direct providers need the lazy import.
      const plain = provider === 'openrouter'
        ? new LLMMethod()
        : await this._getProviderMethod(provider);
      return plain.translate(keys, sourceFlat, pairConfig, options);
    }

    // ── Build the coached system message ONCE ──────────────────────────
    // The free-text coaching prompt rides in the system message via
    // langConfig.coachingPrompt (exactly as the plain llm.js method injects
    // it), so it is part of EVERY batch and can never be silently dropped —
    // including for the openai/anthropic/gemini/local providers below.
    // The same reading of the pair as every LLM method (llm.js
    // promptSettingsFor) — it used to leave out the protected terms — with
    // the coaching prompt this method resolved itself.
    const langConfig = promptSettingsFor(pairConfig, { coachingPrompt: coachingPromptInfo.text });
    const systemMessage = structured
      ? buildCoachedSystemMessage(langConfig, structured)
      : buildSystemMessage(langConfig);
    // The glossary each batch is told about: the coaching file's dictionary,
    // else the project's (the same file, unless a plugin brings its own).
    const glossary = (structured && Object.keys(structured.dictionary).length > 0)
      ? structured.dictionary
      : projectGlossary(pairConfig, options, this._coachingCache);

    const batchSize = pairConfig.batchSize || options.batchSize || DEFAULT_BATCH_SIZE;
    const maxRetries = pairConfig.maxRetries ?? DEFAULT_MAX_RETRIES;

    // ── Provider dispatch ──────────────────────────────────────────────
    if (provider === 'openrouter') {
      // A request preview needs no key: it is shown, never sent.
      const apiKey = options.apiKey || (isCapturing() ? PREVIEW_KEY : null);
      if (!apiKey) {
        output.warn('LLM-Coached translate: no API key provided — skipping batch.');
        return null;
      }
      // Exact slugs only (founder ruling 2026-10-05): refused before anything is sent.
      const model = requireExactModelId(pairConfig.model || options.model || DEFAULT_OPENROUTER_MODEL);
      const llm = new LLMMethod();
      const batchFn = (batch, opts) => this._callCoachedBatch(batch, glossary, opts, pairConfig);
      return this._runCoachedBatches(llm, keys, sourceFlat, langConfig, {
        apiKey, model, maxRetries, systemMessage, batchSize, descriptions: options.descriptions || null,
      }, batchFn);
    }

    // Direct provider (openai / anthropic / gemini / local). Reuses the direct
    // method's transport + JSON parsing (_callProviderBatch) and shared cascade
    // (_translateWithCascade), but with the coached system message WE built —
    // so the coaching prompt is honored, not the default uncoached system.
    const directMethod = await this._getProviderMethod(provider);
    const apiKey = directMethod._resolveApiKey(options) || (isCapturing() ? PREVIEW_KEY : null);
    if (!apiKey) {
      output.warn(`LLM-Coached translate (${provider}): no API key — set ${directMethod._getApiKeyEnvVar()}. Skipping batch.`);
      return null;
    }
    // The provider's own name for the model; an OpenRouter slug is mapped or
    // refused (direct-llm.js resolveModelId), never sent to it as is.
    const model = directMethod.resolveModelId(pairConfig.model || options.model || directMethod._getDefaultModel(), { cwd });
    if (!isCapturing()) await directMethod._validateModel(model, apiKey, cwd); // DX warnings only; never blocks
    const temperature = pairConfig.temperature ?? DEFAULT_COACHED_TEMPERATURE;
    const batchFn = (batch, opts) => directMethod._callProviderBatch(batch, opts);
    return this._runCoachedBatches(directMethod, keys, sourceFlat, langConfig, {
      apiKey, model, maxRetries, systemMessage, batchSize,
      glossary, temperature, descriptions: options.descriptions || null, cwd,
    }, batchFn);
  }

  /**
   * Run the coached batch loop against a chosen method (OpenRouter LLMMethod or
   * a direct provider). Shared by every provider branch so the parallel-batch +
   * retry-cascade behavior is identical regardless of transport.
   *
   * @param {import('./llm.js').LLMMethod} method - Method whose _translateWithCascade + batchFn drive the calls
   * @param {string[]} keys - Keys to translate
   * @param {object} sourceFlat - Source values
   * @param {object} langConfig - { name, register, coachingPrompt, ... }
   * @param {object} baseOptions - { apiKey, model, maxRetries, systemMessage, batchSize, ... }
   * @param {Function} batchFn - (toTranslate, options) => Promise<result>
   * @returns {Promise<object|null>}
   */
  async _runCoachedBatches(method, keys, sourceFlat, langConfig, baseOptions, batchFn) {
    const { batchSize } = baseOptions;
    const allTranslated = {};

    const batchChunks = [];
    for (let i = 0; i < keys.length; i += batchSize) {
      batchChunks.push(keys.slice(i, i + batchSize));
    }

    await pMap(batchChunks, async (chunk, idx) => {
      const toTranslate = {};
      for (const key of chunk) {
        toTranslate[key] = sourceFlat[key];
      }

      const result = await method._translateWithCascade(
        toTranslate,
        langConfig,
        { ...baseOptions, batchNum: idx + 1 },
        batchFn,
        'Coached ',
      );

      if (result) {
        Object.assign(allTranslated, result);
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Resolve the underlying TranslationMethod for a provider name.
   *
   * 'openrouter' (default) → LLMMethod. Direct providers are imported lazily to
   * avoid a static import cycle (direct-llm.js already imports from this file).
   *
   * @param {string} provider - Normalized provider name
   * @returns {Promise<import('./base.js').TranslationMethod>}
   */
  async _getProviderMethod(provider) {
    if (provider === 'openrouter') return new LLMMethod();
    const spec = DIRECT_PROVIDER_MODULES[provider];
    if (!spec) {
      throw new Error(
        `llm-coached: unknown provider "${provider}". ` +
        `Supported providers: openrouter, ${Object.keys(DIRECT_PROVIDER_MODULES).join(', ')}.`
      );
    }
    const mod = await import(spec.module);
    return new mod[spec.export]();
  }

  /**
   * Translate freeform content with coaching context.
   *
   * For content translation, we prepend coaching style notes and grammar
   * rules to the existing prompt (which already contains the content).
   */
  async translateContent(prompt, pairConfig, options) {
    const provider = normalizeProvider(pairConfig.provider);

    // Same fail-loud coaching resolution as translate(): a configured coaching
    // file/prompt that cannot be loaded throws rather than running uncoached.
    const coachingPromptInfo = resolveCoachingPrompt(pairConfig, options); // throws on bad file

    const targetLocale = pairConfig.target || pairConfig.locale;
    const cwd = options.cwd || process.cwd();
    const coachingDir = options.coachingDir || path.join(cwd, DEFAULT_COACHING_DIR);
    const structured = this._loadCoachingData(coachingDir, targetLocale);

    const coachingConfigured = coachingPromptInfo.configured || Boolean(structured);
    const targetMethod = await this._getProviderMethod(provider);

    if (!coachingConfigured) {
      // Documented uncoached fallback — still routed to the chosen provider.
      return targetMethod.translateContent(prompt, pairConfig, options);
    }

    // Build the coaching block (free-text prompt + structured grammar/style)
    // and prepend it ourselves so coaching is applied for ANY provider.
    const blocks = [];
    if (coachingPromptInfo.text) {
      blocks.push(`Coaching guidance:\n${coachingPromptInfo.text}`);
    }
    if (structured) {
      const structuredBlock = buildContentCoachingBlock(structured);
      if (structuredBlock) blocks.push(structuredBlock);
    }
    const coachingBlock = blocks.join('\n\n');
    const augmentedPrompt = coachingBlock ? `${coachingBlock}\n\n${prompt}` : prompt;

    // The plain methods send a content prompt as they get it, so the
    // coaching is prepended once, here, whichever provider carries it.
    return targetMethod.translateContent(augmentedPrompt, pairConfig, options);
  }

  /**
   * Cost estimation — same as LLM but with coached:true flag
   * for the 2.5x input token multiplier (grammar/dictionary injection).
   * A direct provider prices through its own method (and `local` honestly
   * returns null) — never through OpenRouter's rate for a model it isn't
   * sending to OpenRouter.
   *
   * @param {number} keyCount - Number of keys to translate
   * @param {object} [pairConfig] - Pair config containing the model ID
   */
  async estimateCost(keyCount, pairConfig = {}, context = {}) {
    const provider = normalizeProvider(pairConfig.provider ?? this._provider);
    if (provider !== 'openrouter') {
      const directMethod = await this._getProviderMethod(provider);
      return directMethod.estimateCost(keyCount, pairConfig, context);
    }
    const model = pairConfig.model || DEFAULT_OPENROUTER_MODEL;
    return estimateOpenRouterCost(keyCount, model, { coached: true });
  }

  /**
   * Preflight: the credential the run needs is the chosen provider's, not
   * OpenRouter's. A coached openai pair must pass with only OPENAI_API_KEY set,
   * and must fail (naming OPENAI_API_KEY) without it.
   */
  async checkReadiness(context) {
    if (this._provider !== 'openrouter') {
      const directMethod = await this._getProviderMethod(this._provider);
      return directMethod.checkReadiness(context);
    }
    if (!context.apiKey) {
      return { ready: false, reason: 'No OpenRouter API key (OPENROUTER_API_KEY).' };
    }
    return { ready: true };
  }

  getQualityTier() {
    return 'high';
  }

  getProvenance() {
    return {
      resources: [
        { name: 'User-provided coaching data', license: 'project-local', type: 'dictionary/grammar' },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  /**
   * Load coaching data for a locale, with caching.
   * Thin wrapper around the standalone loadCoachingData() function.
   *
   * @param {string} coachingDir - Path to coaching data directory
   * @param {string} locale - Target locale code
   * @returns {object|null} Coaching data, or null if not found
   */
  _loadCoachingData(coachingDir, locale) {
    return loadCoachingData(coachingDir, locale, this._coachingCache);
  }

  // NOTE: The coached cascade (_translateCoachedWithCascade) was removed.
  // Coached translation now delegates to LLMMethod._translateWithCascade
  // via composition, passing _callCoachedBatch as the batchFn parameter.
  // This eliminates ~80 lines of duplicated cascade logic.

  /**
   * Make a single coached API call via the shared OpenRouter client.
   * Builds per-batch user message with dictionary hints, uses shared system message.
   */
  async _callCoachedBatch(toTranslate, glossary, options, pairConfig = {}) {
    const { apiKey, model, batchNum, systemMessage } = options;

    // The user message every LLM method sends (llm.js buildUserMessage): the
    // glossary terms this batch contains (none when only a free-text
    // coaching prompt is configured and the project has no glossary), the
    // per-key instructions (plural forms, ICU categories, gettext context,
    // gate feedback), then the batch.
    const userMessage = buildUserMessage(toTranslate, options.descriptions || undefined, glossary || null);

    return callOpenRouterJSON({
      prompt: userMessage,
      systemMessage,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_COACHED_TEMPERATURE, // Lower than standard for coached (more deterministic)
      label: `Coached batch ${batchNum}`,
      xTitle: 'champollion (coached)',
      expectedKeys: new Set(Object.keys(toTranslate)),
      isUnsafeKey,
    });
  }

}

// -----------------------------------------------------------------
// Coached prompt building
// -----------------------------------------------------------------

/**
 * Build the system message for coached translation (cached across batches).
 *
 * Contains: base translation rules + coaching context (grammar, style).
 * Dictionary hints are NOT included here because they vary per batch
 * (only terms present in that batch's values are injected).
 *
 * @param {object} langConfig - { name, register }
 * @param {object} coaching - { grammar_rules, dictionary, style_notes }
 * @returns {string} System message for prompt caching
 */
function buildCoachedSystemMessage(langConfig, coaching) {
  // Start with the base system message (register + rules)
  let system = buildSystemMessage(langConfig);

  // Append coaching context
  const coachingParts = [];

  if (coaching.grammar_rules.length > 0) {
    coachingParts.push(
      'GRAMMAR RULES (follow strictly):',
      ...coaching.grammar_rules.map(r => `  • ${r}`)
    );
  }

  if (coaching.style_notes) {
    coachingParts.push(
      '',
      `STYLE GUIDE: ${coaching.style_notes}`
    );
  }

  if (coachingParts.length > 0) {
    system += `\n\n--- COACHING CONTEXT ---\n${coachingParts.join('\n')}\n--- END COACHING ---`;
  }

  return system;
}

/**
 * Build a combined coached prompt (legacy interface for backward compat).
 *
 * Used by tests that call buildCoachedPrompt() directly.
 * New code should use buildCoachedSystemMessage() + per-batch user message.
 *
 * @param {Object<string, string>} toTranslate - Key-value map to translate
 * @param {{ name: string, register: string }} langConfig - Target language info
 * @param {import('../types.js').CoachingData} coaching - Coaching data
 * @returns {string} Combined system + user prompt
 */
function buildCoachedPrompt(toTranslate, langConfig, coaching) {
  const system = buildCoachedSystemMessage(langConfig, coaching);

  // Build user message with dictionary hints + UI context + JSON payload
  const dictHints = findDictionaryMatches(toTranslate, coaching.dictionary);
  const typeHints = inferKeyTypes(toTranslate);

  let userMessage = '';
  if (dictHints.length > 0) {
    userMessage += 'REQUIRED TERMINOLOGY (use these exact translations):\n';
    userMessage += dictHints.map(h => `  • "${h.term}" → "${h.translation}"`).join('\n');
    userMessage += '\n\n';
  }
  if (typeHints.length > 0) {
    userMessage += `UI context for these keys:\n${typeHints.join('\n')}\n\n`;
  }
  userMessage += JSON.stringify(toTranslate, null, 2);

  return `${system}\n\n${userMessage}`;
}

/**
 * Build a coaching context block for freeform content translation.
 *
 * Lighter than the key-value version — only grammar and style, no dictionary
 * matching (content is too freeform for term-level matching).
 *
 * @param {import('../types.js').CoachingData} coaching - Coaching data
 * @returns {string} Coaching context block, or empty string if no data
 */
function buildContentCoachingBlock(coaching) {
  const parts = [];

  if (coaching.grammar_rules.length > 0) {
    parts.push(
      'IMPORTANT — Follow these grammar rules:',
      ...coaching.grammar_rules.map(r => `  • ${r}`)
    );
  }

  if (coaching.style_notes) {
    parts.push('', `STYLE GUIDE: ${coaching.style_notes}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

export {
  LLMCoachedMethod,
  COACHED_PROVIDERS,
  normalizeProvider,
  loadCoachingData,
  buildCoachedPrompt,
  buildCoachedSystemMessage,
  buildContentCoachingBlock,
  findDictionaryMatches,
  DEFAULT_COACHING_DIR,
};
