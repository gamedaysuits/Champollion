/**
 * LLM Translation Method — direct LLM prompting via OpenRouter.
 *
 * This is the default translation method and the foundation all other
 * methods build on. It extracts the existing translateBatch/translateRawContent
 * logic from the v2 translate.js into a proper method class.
 *
 * HOW IT WORKS:
 *   1. Receives keys + source values from the orchestrator
 *   2. Chunks them into batches (default 80 keys per batch)
 *   3. Builds a register-steered prompt per batch
 *   4. Sends to OpenRouter with exponential backoff retry
 *   5. Validates response (only accept keys we sent, block prototype pollution)
 *   6. Returns merged results
 *
 * PROMPT CACHING:
 *   The prompt is split into two parts:
 *     - system message: register, rules, UI context (identical across batches)
 *     - user message: JSON payload (varies per batch)
 *   This enables provider-level prompt caching (Anthropic, Gemini) on the
 *   system preamble, reducing token costs by 30-50% for large syncs.
 *
 * RETRY CASCADE:
 *   On JSON parse failure (malformed model output), the cascade retries:
 *     1. Full batch (original size)
 *     2. Half-batches (split in two, retry each half)
 *     3. Individual keys (batchSize=1) — capped per cascade invocation by
 *        CHAMPOLLION_MAX_KEY_FANOUT (default 16, 0 disables the per-key
 *        fallback). Keys beyond the cap are skipped with one summary warn
 *        and retry on the next sync via the failed-key machinery.
 *   Each level is tried before escalating to the next. A maxRetries budget
 *   cap prevents infinite token spend on the batch/half rounds.
 *
 * COST PROFILE: ~$0.01 per 1k keys at GPT-4o-mini pricing.
 * QUALITY TIER: standard — no post-processing or verification.
 */

import { TranslationMethod } from './base.js';
import { REQUEST_TIMEOUT_MS, sleep } from './http-utils.js';
import { callOpenRouter, callOpenRouterJSON } from './openrouter-client.js';
import { estimateOpenRouterCost } from './openrouter-pricing.js';
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_BATCH_SIZE, DEFAULT_TEMPERATURE, DEFAULT_MAX_RETRIES, DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { isUnsafeKey } from '../security.js';
import { pMap } from '../concurrent.js';
import { output } from '../output.js';
import { getEnvOrFileVar } from '../api-key.js';


/** Default per-cascade cap on individual-key fallback calls (see below). */
const DEFAULT_MAX_KEY_FANOUT = 16;

/**
 * Resolve the per-key fallback fan-out cap.
 *
 * CHAMPOLLION_MAX_KEY_FANOUT bounds how many INDIVIDUAL-KEY API calls one
 * cascade invocation may fan out into after half-batch parse failures.
 * Unset/empty → 16; 0 → per-key fallback disabled entirely; anything
 * non-numeric or negative falls back to the default (fail-safe, not free).
 *
 * @returns {number}
 */
function maxKeyFanout() {
  const raw = process.env.CHAMPOLLION_MAX_KEY_FANOUT;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_MAX_KEY_FANOUT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_KEY_FANOUT;
  return Math.floor(n);
}

class LLMMethod extends TranslationMethod {
  constructor(options = {}) {
    super('llm', options);
  }

  /**
   * Translate a batch of key-value pairs via OpenRouter.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {object} pairConfig - Pair config (method, model, register, name, etc.)
   * @param {object} options - { apiKey, batchSize }
   * @returns {object|null} Map of key → translated value, or null if all failed
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const { apiKey } = options;
    const batchSize = pairConfig.batchSize || options.batchSize || DEFAULT_BATCH_SIZE;
    const model = pairConfig.model || options.model || DEFAULT_OPENROUTER_MODEL;
    const maxRetries = pairConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!apiKey) {
      output.warn('LLM translate: no API key provided — skipping batch.');
      return null;
    }

    const langConfig = {
      name: pairConfig.name,
      register: pairConfig.register,
      // Language-specific gender guidance from the card (e.g., écriture inclusive
      // for French, Doppelpunkt notation for German). Falls back to a generic
      // rule in buildSystemMessage when null.
      genderGuidance: pairConfig.genderGuidance || null,
      // User-provided global context (e.g., "This is a developer tool README").
      // Injected into the system message to give the LLM domain awareness.
      promptContext: pairConfig.promptContext || null,
      // Coaching prompt text — free-text instructions read from a coaching file.
      // Injected between register and rules in the system message.
      coachingPrompt: pairConfig.coachingPrompt || null,
    };

    // Build the system message once — identical across all batches for this locale.
    // This enables provider-level prompt caching (Anthropic, Gemini).
    const systemMessage = buildSystemMessage(langConfig);

    const allTranslated = {};

    // ── Parallel batch execution ───────────────────────────────────────
    // Fire all batch chunks concurrently (up to 4 in parallel).
    // Each batch cascades independently on parse failure (full → half →
    // individual), so parallelism doesn't break the retry logic.
    // Object.assign on allTranslated is safe: keys don't overlap across
    // batches, and JS property assignment is synchronous between awaits.
    const batchChunks = [];
    for (let i = 0; i < keys.length; i += batchSize) {
      batchChunks.push({ chunk: keys.slice(i, i + batchSize), offset: i });
    }

    let completedKeys = 0;
    await pMap(batchChunks, async ({ chunk, offset }, idx) => {
      const toTranslate = {};
      for (const key of chunk) {
        toTranslate[key] = sourceFlat[key];
      }

      const result = await this._translateWithCascade(toTranslate, langConfig, {
        apiKey,
        model,
        batchNum: idx + 1,
        maxRetries,
        systemMessage,
        temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
        descriptions: options.descriptions || null,
      }, this._callOpenRouterBatch.bind(this));

      if (result) {
        Object.assign(allTranslated, result);
      }

      // Progress callback — report cumulative completion
      completedKeys += chunk.length;
      if (options.onProgress) {
        options.onProgress(
          Math.min(completedKeys, keys.length),
          keys.length,
        );
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Translate freeform content (Markdown body, etc.) via OpenRouter.
   *
   * Uses a two-round escalation strategy for reliability:
   *   Round 1 (standard): 4 attempts, 2× base timeout (60s), normal backoff
   *   Round 2 (escalated): If round 1 fails, 10s cool-down, then 4 attempts
   *     with 4× base timeout (120s). Handles long docs where the model needs
   *     more time to generate the full output.
   *
   * Total worst-case: 8 API attempts before returning null.
   *
   * @param {string} prompt - Complete translation prompt
   * @param {object} pairConfig - Pair config
   * @param {object} options - { apiKey }
   * @returns {string|null} Translated text, or null on failure
   */
  async translateContent(prompt, pairConfig, options) {
    const { apiKey } = options;
    const model = pairConfig.model || options.model || DEFAULT_OPENROUTER_MODEL;
    if (!apiKey) {
      output.warn('LLM translateContent: no API key provided — skipping.');
      return null;
    }

    // Round 1: standard timeout (2× base = 60s)
    const result = await callOpenRouter({
      prompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 2,
      label: 'Content',
    });

    if (result) return result;

    // Round 2: escalated — longer cool-down and 4× timeout (120s).
    // This handles long documents where the model needs more generation
    // time, or transient API issues that resolve after a longer pause.
    output.warn('⟳ Content: standard retries exhausted — escalating with extended timeout...');
    await sleep(10_000);

    return callOpenRouter({
      prompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 4,
      label: 'Content (escalated)',
    });
  }

  /**
   * Cost estimation — fetches live per-token pricing from OpenRouter.
   *
   * The pricing module fetches once per process and caches.
   * Falls back to 'unknown' if offline or the model isn't found.
   *
   * @param {number} keyCount - Number of keys to translate
   * @param {object} [pairConfig] - Pair config containing the model ID
   */
  async estimateCost(keyCount, pairConfig = {}) {
    const model = pairConfig.model || DEFAULT_OPENROUTER_MODEL;
    return estimateOpenRouterCost(keyCount, model, { coached: false });
  }

  checkReadiness(context) {
    if (!context.apiKey) {
      return { ready: false, reason: 'No OpenRouter API key (OPENROUTER_API_KEY).' };
    }
    return { ready: true };
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    // Resolve through the same env-or-file lookup the runtime uses, so a key
    // that only lives in .env.local doesn't get misreported as "Missing API
    // Key" after a real 401 — that would point the user at the wrong fix.
    const apiKey = getEnvOrFileVar('OPENROUTER_API_KEY');
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ The LLM method requires an OpenRouter API key.                │',
        '  │                                                                │',
        '  │ 1. Sign up at https://openrouter.ai (free tier available)      │',
        '  │ 2. Run: export OPENROUTER_API_KEY=sk-or-v1-...                │',
        '  │ 3. Or add to .env.local: OPENROUTER_API_KEY=sk-or-v1-...      │',
        '  │                                                                │',
        '  │ Alternative: use Google Translate instead (key-value only):    │',
        '  │   export GOOGLE_TRANSLATE_API_KEY=...                          │',
        '  │   champollion sync --method google-translate                  │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('OpenRouter dashboard');
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  /**
   * Retry cascade for a single batch.
   *
   * On JSON parse failure (model returned garbage), the cascade:
   *   1. Retries the full batch once
   *   2. Splits into two half-batches and retries each
   *   3. Falls back to individual key translation (batchSize=1)
   *
   * The maxRetries budget limits total cascade depth to prevent
   * infinite token spend on a language the model genuinely can't handle.
   *
   * This method is also used by LLMCoachedMethod via composition — the
   * coached method passes its own batch function that injects dictionary
   * hints into the prompt.
   *
   * @param {object} toTranslate - Key-value map to translate
   * @param {object} langConfig - { name, register }
   * @param {object} options - { apiKey, model, batchNum, maxRetries, systemMessage }
   * @param {Function} batchFn - (toTranslate, options) => Promise<result>
   *   The function that makes a single batch API call.
   * @param {string} label - Prefix for log messages (e.g., '' or 'Coached ')
   * @returns {object|null} Validated key-value map, or null
   */
  async _translateWithCascade(toTranslate, langConfig, options, batchFn, label = '') {
    const { maxRetries } = options;
    let retriesUsed = 0;

    // Attempt 1: Full batch
    const result = await batchFn(toTranslate, options);

    // Success — return the result
    if (result && !result._parseError) return result;

    // API failure (null) — nothing to retry with smaller batches
    if (!result) return null;

    // Parse error — start the cascade
    retriesUsed++;
    if (retriesUsed > maxRetries) {
      this._logCascadeExhausted(toTranslate, options, label);
      return null;
    }

    const keys = Object.keys(toTranslate);

    // Attempt 2: Half-batches (only if batch has >1 key)
    if (keys.length > 1) {
      const mid = Math.ceil(keys.length / 2);
      const firstHalf = {};
      const secondHalf = {};
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (i < mid) firstHalf[key] = toTranslate[key];
        else secondHalf[key] = toTranslate[key];
      }

      output.warn(`⟳ ${label}Batch ${options.batchNum}: parse error — splitting ${keys.length} keys into halves (${Object.keys(firstHalf).length} + ${Object.keys(secondHalf).length})...`);

      // Per-key fallback fan-out cap, counted across THIS cascade invocation
      // (both halves share it). The retry budget gates batch/half rounds;
      // this cap bounds the terminal per-key leaves so a big batch that
      // parses badly can't fan out into one API call per key (80 calls at
      // default batch size). Skipped keys return null and flow into the
      // existing failed-key machinery — they retry on the next sync.
      const fanoutCap = maxKeyFanout();
      let fanoutTranslated = 0;
      let fanoutFailed = 0;
      let fanoutSkipped = 0;

      const merged = {};
      for (const half of [firstHalf, secondHalf]) {
        retriesUsed++;
        if (retriesUsed > maxRetries) {
          this._logCascadeExhausted(half, options, label);
          break;
        }

        const halfResult = await batchFn(half, options);

        if (halfResult && !halfResult._parseError) {
          Object.assign(merged, halfResult);
        } else if (halfResult?._parseError) {
          // Half-batch also failed — try individual keys.
          //
          // Terminal per-key calls do NOT count against the retry budget.
          // The budget gates how many batch/half RETRY ROUNDS we attempt
          // (the recoverable splitting cascade); once we've reached the
          // individual-key leaves there is nothing left to split, so each
          // key gets its one final attempt regardless of budget. Counting
          // them made the advertised batch→half→individual cascade
          // structurally unreachable at defaults (maxRetries=3, batchSize=80):
          // a single parse failure would exhaust the budget after recovering
          // just one key and abandon the other 79. The only bound on the
          // per-key leaves is the fan-out cap above (CHAMPOLLION_MAX_KEY_FANOUT).
          if (fanoutCap > 0) {
            output.warn(`⟳ ${label}Half-batch parse error — falling back to individual keys...`);
          }
          for (const [key, value] of Object.entries(half)) {
            if (fanoutTranslated + fanoutFailed >= fanoutCap) {
              fanoutSkipped++;
              continue;
            }
            const singleResult = await batchFn({ [key]: value }, options);
            if (singleResult && !singleResult._parseError) {
              fanoutTranslated++;
              Object.assign(merged, singleResult);
            } else {
              fanoutFailed++;
              output.error(`Key "${key}" failed even as individual ${label.toLowerCase().trim() || 'LLM'} translation.`);
            }
          }
        }
        // halfResult === null (API failure) — skip this half, nothing to retry
      }

      if (fanoutSkipped > 0) {
        output.warn(
          `${label}Batch ${options.batchNum}: per-key fallback capped at ${fanoutCap} ` +
          `(CHAMPOLLION_MAX_KEY_FANOUT) — ${fanoutTranslated} key(s) translated individually, ` +
          `${fanoutSkipped} skipped; skipped keys will retry next sync.`
        );
      }

      return Object.keys(merged).length > 0 ? merged : null;
    }

    // Single key that failed to parse — one more try
    retriesUsed++;
    if (retriesUsed > maxRetries) {
      this._logCascadeExhausted(toTranslate, options, label);
      return null;
    }

    const retryResult = await batchFn(toTranslate, options);
    if (retryResult && !retryResult._parseError) return retryResult;

    this._logCascadeExhausted(toTranslate, options, label);
    return null;
  }

  /**
   * Make a single OpenRouter batch call.
   * Builds the user message (JSON payload) and delegates to openrouter-client.
   */
  async _callOpenRouterBatch(toTranslate, options) {
    const { apiKey, model, batchNum, systemMessage, temperature } = options;
    const userMessage = buildUserMessage(toTranslate, options.descriptions || undefined);

    return callOpenRouterJSON({
      prompt: userMessage,
      systemMessage,
      apiKey,
      model,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      label: `Batch ${batchNum}`,
      expectedKeys: new Set(Object.keys(toTranslate)),
      isUnsafeKey,
    });
  }

  /**
   * Log cascade exhaustion with actionable guidance.
   *
   * @param {object} toTranslate - The keys that failed
   * @param {object} options - { batchNum, maxRetries }
   * @param {string} label - Prefix for log messages (e.g., 'Coached ')
   */
  _logCascadeExhausted(toTranslate, options, label = '') {
    const keys = Object.keys(toTranslate);
    output.error(`${label}Batch ${options.batchNum}: retry cascade exhausted (${options.maxRetries} max).`);
    output.error(`${keys.length} key(s) could not be translated.`);
    if (!label) {
      output.error(`Consider increasing maxRetries or using a more capable model:`);
      output.error(`"languages": { "<code>": { "model": "google/gemini-2.5-pro", "batchSize": 5, "maxRetries": 5 } }`);
    }
  }
}

// -----------------------------------------------------------------
// Prompt building — split into system (cached) + user (per-batch)
// -----------------------------------------------------------------

/**
 * Build the system message preamble (cached across batches).
 *
 * Contains: role definition, register, gender guidance, prompt context, translation rules.
 * This is identical for every batch targeting the same locale,
 * so providers cache it automatically after the first batch.
 *
 * Gender guidance: When the language card provides specific guidance
 * (e.g., écriture inclusive for French), it replaces the generic rule.
 * This ensures Hindi, Arabic, etc. get language-appropriate advice
 * instead of a one-size-fits-all line.
 *
 * Prompt context: User-provided global context about the project/content
 * being translated (e.g., "This is a developer tool for i18n"). Injected
 * after the role line to give the LLM domain awareness.
 *
 * @param {object} langConfig - { name, register, genderGuidance?, promptContext? }
 * @returns {string} System message
 */
function buildSystemMessage(langConfig) {
  // Use language-specific gender guidance when available from the card,
  // otherwise fall back to a generic rule for unknown languages.
  const genderRule = langConfig.genderGuidance
    ? `- Gender: ${langConfig.genderGuidance}`
    : '- When gender is ambiguous, prefer gender-neutral forms or the most inclusive option available in ' + langConfig.name + '.';

  // Inject user-provided promptContext to give the LLM domain awareness.
  // This is set in the top-level config and flows through the pair graph.
  const contextBlock = langConfig.promptContext
    ? `\nContext: ${langConfig.promptContext}\n`
    : '';

  // Coaching guidance: free-text instructions read from a coaching file.
  // This sits between the register line and the rules block so the LLM
  // treats it as authoritative style/domain guidance rather than a mere hint.
  const coachingBlock = langConfig.coachingPrompt
    ? `\nCoaching guidance:\n${langConfig.coachingPrompt}\n`
    : '';

  return `You are translating UI strings for a web/mobile application from English to ${langConfig.name}.
${contextBlock}
Register/tone: ${langConfig.register}
${coachingBlock}
Rules:
- Translate ONLY the values, keep the keys exactly as-is.
- Proper nouns (product names, company names, place names) should NOT be translated.
- Technical terms and role descriptions that are industry-standard should stay in English.
${genderRule}
- Respect the UI element type: button labels should be concise, descriptions can be natural-length, error messages should be clear and direct.
- Quotation marks inside a translated value: use the target language's typographic quotation marks (e.g. “…”, «…», 「…」); if you must use ASCII double quotes, escape them as \\" so the JSON stays valid.
- Return ONLY valid JSON, no markdown fences, no explanation.`;
}

/**
 * Build the user message (varies per batch).
 *
 * Contains: UI context hints for key names + the JSON payload.
 * This changes with every batch, so it's never cached.
 *
 * Descriptions: When Docusaurus {message, description} files provide
 * developer-written descriptions (e.g., "The title of the blog page"),
 * those are included as additional context hints. This helps the LLM
 * disambiguate polysemous terms — e.g., "Post" as "submit" vs "blog post".
 *
 * @param {object} toTranslate - Key-value map to translate
 * @param {object} [descriptions] - Optional key→description map from Docusaurus
 * @returns {string} User message
 */
function buildUserMessage(toTranslate, descriptions) {
  const typeHints = inferKeyTypes(toTranslate);

  // Merge auto-inferred type hints with Docusaurus descriptions.
  // Description context is appended after the type hint for richer context.
  if (descriptions && typeof descriptions === 'object') {
    for (const [key, desc] of Object.entries(descriptions)) {
      if (key in toTranslate && typeof desc === 'string' && desc.length > 0) {
        // Check if we already have a type hint for this key
        const existingIdx = typeHints.findIndex(h => h.startsWith(`- "${key}":`));
        if (existingIdx >= 0) {
          // Append description to existing type hint
          typeHints[existingIdx] += ` — "${desc}"`;
        } else {
          // No type hint inferred — add description-only hint
          typeHints.push(`- "${key}": ${desc}`);
        }
      }
    }
  }

  const hintsBlock = typeHints.length > 0
    ? `UI context for these keys:\n${typeHints.join('\n')}\n\n`
    : '';

  return `${hintsBlock}${JSON.stringify(toTranslate, null, 2)}`;
}

/**
 * Build a combined prompt (legacy interface for backward compat).
 *
 * Used by tests and any code that calls buildPrompt() directly.
 * New code should use buildSystemMessage() + buildUserMessage() separately.
 */
function buildPrompt(toTranslate, langConfig) {
  return `${buildSystemMessage(langConfig)}\n\n${buildUserMessage(toTranslate)}`;
}

/**
 * Infer UI element types from key naming patterns.
 */
const KEY_TYPE_PATTERNS = [
  { pattern: /(?:^|\.)(?:.*(?:btn|button|cta|action|submit|cancel|confirm|dismiss))/i, type: 'button label — keep concise' },
  { pattern: /(?:^|\.)(?:.*(?:title|heading|h[1-6]))/i, type: 'heading/title' },
  { pattern: /(?:^|\.)(?:.*(?:description|desc|subtitle|summary|body|paragraph))/i, type: 'description text — natural length OK' },
  { pattern: /(?:^|\.)(?:.*(?:error|warning|validation|alert))/i, type: 'error/status message — be clear and direct' },
  { pattern: /(?:^|\.)(?:.*(?:placeholder|hint))/i, type: 'input placeholder — keep very short' },
  { pattern: /(?:^|\.)(?:.*(?:label|field))/i, type: 'form label' },
  { pattern: /(?:^|\.)(?:.*(?:tooltip|popover|help))/i, type: 'tooltip/help text' },
  { pattern: /(?:^|\.)(?:.*(?:toast|notification|snackbar))/i, type: 'notification message' },
  { pattern: /(?:^|\.)(?:.*(?:nav|menu|tab|breadcrumb|link))/i, type: 'navigation element — keep concise' },
  { pattern: /(?:^|\.)(?:.*(?:modal|dialog))/i, type: 'dialog/modal text' },
];

function inferKeyTypes(toTranslate) {
  const hints = [];
  for (const key of Object.keys(toTranslate)) {
    for (const { pattern, type } of KEY_TYPE_PATTERNS) {
      if (pattern.test(key)) {
        hints.push(`- "${key}": ${type}`);
        break;
      }
    }
  }
  return hints;
}

export { LLMMethod, buildPrompt, buildSystemMessage, buildUserMessage, isUnsafeKey, inferKeyTypes };
