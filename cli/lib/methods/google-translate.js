/**
 * Google Translate Method — Google Cloud Translation API v2.
 *
 * The universal baseline. Works out of the box with just a Google API key.
 * Zero prompt engineering, zero coaching data — pure neural MT. This gives
 * champollion a free/cheap option that supports 130+ languages.
 *
 * HOW IT WORKS:
 *   1. Reads GOOGLE_TRANSLATE_API_KEY from environment
 *   2. Chunks keys into batches (max 128 segments per Google API call)
 *   3. POSTs to Google Cloud Translation API v2 REST endpoint
 *   4. Maps Google's response array back to champollion's key-value format
 *   5. Returns translations
 *
 * WHY BUILT-IN (not a plugin):
 *   Google Translate is the universal i18n baseline. Every developer
 *   expects it. It should work with zero config — just an env var.
 *   No plugin install, no method manifest, no coaching data.
 *
 * COST PROFILE: ~$20 per 1M characters (Google's pricing)
 * QUALITY TIER: standard — no post-processing or verification
 *
 * ZERO DEPENDENCIES: Uses Node.js built-in fetch() against the REST API.
 */

import { TranslationMethod } from './base.js';
import { resolveProviderEnv, envNamesLabel } from './provider-env.js';
import { EST_CHARS_PER_KEY, DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { estimateProviderCost } from './provider-pricing.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { fetchWithRetry } from './fetch-with-retry.js';
import { pMap } from '../concurrent.js';

const GOOGLE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// Google's batch limit per request
const MAX_SEGMENTS_PER_REQUEST = 128;

// Google Translate responses are fast — use a shorter timeout than the default
const GOOGLE_REQUEST_TIMEOUT_MS = 15000;

class GoogleTranslateMethod extends TranslationMethod {
  constructor(options = {}) {
    super('google-translate', options);
  }

  // ── API resolution helpers ──────────────────────────────────────

  /**
   * Resolve the Google Cloud Translation API key.
   * Checks: options.googleApiKey, then the provider-env SSOT
   * (GOOGLE_TRANSLATE_API_KEY canonical, GOOGLE_API_KEY alias) across
   * process.env and .env / .env.local files.
   * @param {object} options - Caller-provided options
   * @returns {string|null}
   */
  _resolveApiKey(options) {
    return options.googleApiKey
      || resolveProviderEnv('google-translate', options.cwd).value;
  }

  /**
   * Translate a batch of key-value pairs via Google Cloud Translation API.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {import('../types.js').PairConfig} pairConfig - Pair config (target, source, etc.)
   * @param {object} options - { googleApiKey } or reads from env
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);

    if (!apiKey) {
      output.error('Google Translate: No API key found.');
      output.error('Set GOOGLE_TRANSLATE_API_KEY in your environment.');
      return null;
    }

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';
    const allTranslated = {};

    // Chunk keys into batches and translate in parallel
    const batchChunks = [];
    for (let i = 0; i < keys.length; i += MAX_SEGMENTS_PER_REQUEST) {
      batchChunks.push(keys.slice(i, i + MAX_SEGMENTS_PER_REQUEST));
    }

    await pMap(batchChunks, async (chunk, idx) => {
      // Build parallel arrays: ordered keys and their source values
      const orderedKeys = [];
      const sourceTexts = [];
      for (const key of chunk) {
        const value = sourceFlat[key];
        if (value && typeof value === 'string') {
          orderedKeys.push(key);
          sourceTexts.push(value);
        }
      }

      if (sourceTexts.length === 0) return;

      const result = await this._translateBatchWithRetry(
        orderedKeys,
        sourceTexts,
        sourceLocale,
        targetLocale,
        apiKey,
        idx + 1,
      );

      if (result) {
        Object.assign(allTranslated, result);
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Translate freeform Markdown content via Google Cloud Translation API.
   *
   * HOW: The caller (content.js) has already run protectBlocks() on the
   * Markdown body, replacing code blocks, shortcodes, inline code, and
   * HTML with ⟦PROTECTED_N⟧ placeholders. We send the protected text
   * through Google Translate as a single string. GT's neural engine
   * treats the Unicode sentinels as opaque tokens and passes them through.
   *
   * SAFETY NET: If GT mangles any placeholders (rare, but possible),
   * the caller's hasOrphanedPlaceholders() check catches the corruption
   * and falls back to the English body with a warning.
   *
   * @param {string} prompt - Complete translation prompt from buildContentPrompt()
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { googleApiKey }
   * @returns {string|null} Translated text, or null on failure
   */
  async translateContent(prompt, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);

    if (!apiKey) {
      output.error('Google Translate: No API key found for content translation.');
      output.error('Set GOOGLE_TRANSLATE_API_KEY in your environment.');
      return null;
    }

    // Extract the Markdown body from the translation prompt.
    // The prompt format (from content.js buildContentPrompt) ends with:
    //   ---\n<markdown body>
    const bodyText = extractContentBody(prompt);

    if (!bodyText.trim()) return null;

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';

    return this._translateSingleText(bodyText, sourceLocale, targetLocale, apiKey);
  }

  /**
   * Translate a single text string via Google Cloud Translation API v2.
   *
   * Simpler variant of _translateBatchWithRetry — sends one string,
   * returns one translated string. Used for content translation.
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLocale - Source language code
   * @param {string} targetLocale - Target language code
   * @param {string} apiKey - Google Cloud API key
   * @returns {string|null} Translated text, or null on failure
   */
  async _translateSingleText(text, sourceLocale, targetLocale, apiKey) {
    const response = await fetchWithRetry(GOOGLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        q: [text],
        source: normalizeLocaleForGoogle(sourceLocale),
        target: normalizeLocaleForGoogle(targetLocale),
        format: 'text',
      }),
    }, {
      label: 'Google Translate content',
      timeoutMs: GOOGLE_REQUEST_TIMEOUT_MS * 2,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`Google Translate content: ${describeGoogleError(response.status, errorBody)}`);
      return null;
    }

    const json = await response.json();
    const translations = json?.data?.translations;

    if (!translations || translations.length === 0) {
      output.error('Google Translate content: empty response');
      return null;
    }

    return translations[0].translatedText;
  }

  /**
   * Call Google Cloud Translation API v2 with retry.
   *
   * @param {string[]} orderedKeys - Keys in the same order as sourceTexts
   * @param {string[]} sourceTexts - Source values to translate
   * @param {string} sourceLocale - Source language code
   * @param {string} targetLocale - Target language code
   * @param {string} apiKey - Google Cloud API key
   * @param {number} batchNum - Batch number for logging
   * @returns {object|null} Map of key → translated value
   */
  async _translateBatchWithRetry(orderedKeys, sourceTexts, sourceLocale, targetLocale, apiKey, batchNum) {
    const response = await fetchWithRetry(GOOGLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API key sent via header (not query string) to avoid leaking in logs/proxies
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        q: sourceTexts,
        source: normalizeLocaleForGoogle(sourceLocale),
        target: normalizeLocaleForGoogle(targetLocale),
        format: 'text',
      }),
    }, {
      label: `Google batch ${batchNum}`,
      timeoutMs: GOOGLE_REQUEST_TIMEOUT_MS,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`Google batch ${batchNum}: ${describeGoogleError(response.status, errorBody)}`);
      return null;
    }

    const json = await response.json();
    const translations = json?.data?.translations;

    if (!translations || translations.length !== orderedKeys.length) {
      output.error(`Google batch ${batchNum}: Response length mismatch (expected ${orderedKeys.length}, got ${translations?.length || 0})`);
      return null;
    }

    // Map translations back to key-value pairs
    const result = {};
    for (let i = 0; i < orderedKeys.length; i++) {
      result[orderedKeys[i]] = translations[i].translatedText;
    }

    const charCount = sourceTexts.reduce((sum, t) => sum + t.length, 0);
    output.progress(`  ✓ Google batch ${batchNum} (${orderedKeys.length} keys, ${charCount} chars)`);

    return result;
  }

  /**
   * Estimate translation cost at Google's documented rate ($20/million chars).
   * Source: https://cloud.google.com/translate/pricing
   */
  estimateCost(keyCount) {
    return estimateProviderCost('google-translate', keyCount);
  }

  checkReadiness(context = {}) {
    // Resolve through the same SSOT the loader uses so readiness can never
    // pass under a name translate() won't read (or vice versa).
    const { value } = resolveProviderEnv('google-translate', context.cwd);
    if (!value) {
      return { ready: false, reason: `No Google Translate API key (${envNamesLabel('google-translate')}).` };
    }
    return { ready: true };
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'Google Cloud Translation API',
          license: 'Proprietary (Google ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    const { value: apiKey } = resolveProviderEnv('google-translate');
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Google Translate requires a Google Cloud API key.              │',
        '  │                                                                │',
        '  │ 1. Enable the Cloud Translation API in Google Cloud Console    │',
        '  │ 2. Create an API key under APIs & Services > Credentials       │',
        '  │ 3. Run: export GOOGLE_TRANSLATE_API_KEY=...                    │',
        '  │                                                                │',
        '  │ Note: Google Translate works for key-value pairs but cannot    │',
        '  │ safely translate Markdown content (no code block awareness).   │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('Google Cloud Console');
  }
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Turn a Google Cloud Translation API error response into an actionable
 * one-line message.
 *
 * WHY: Google returns HTTP 400 for BOTH "API key not valid" and "Bad language
 * pair" (an unsupported source→target combination). A bare `400 — <body>` log
 * leaves the user — and getSetupHelp's HTTP-status classifier — unable to tell
 * a key problem from an unsupported-pair problem; 400 isn't 401/403, so the
 * classifier falls through to "unknown" and the CLI wrongly tells the user to
 * "check billing/quota". Parsing the body's `reason`/`message` lets us name the
 * real cause.
 *
 * The body is JSON of the shape:
 *   { error: { code, message, status, errors: [{ message, reason }] } }
 * but we degrade gracefully if it isn't parseable.
 *
 * @param {number} status - HTTP status code
 * @param {string} errorBody - Raw response body text
 * @returns {string} A human-readable, status-prefixed error description
 */
function describeGoogleError(status, errorBody) {
  let parsed = null;
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    // Non-JSON body — fall through to the raw text below.
  }

  const err = parsed?.error;
  const reason = err?.errors?.[0]?.reason || '';
  const message = err?.message || '';
  const haystack = `${reason} ${message}`.toLowerCase();

  // Invalid / unauthorized API key. Google reports this as a 400 with
  // reason API_KEY_INVALID (not a 401), so we map it to an auth-style message.
  if (reason === 'API_KEY_INVALID' || haystack.includes('api key not valid')) {
    return `${status} — API key not valid. Re-check the GOOGLE_TRANSLATE_API_KEY value itself, not your account settings. ${message}`.trim();
  }

  // Unsupported source→target language pair. Google reports "Bad language pair"
  // (often with reason "invalid"/"badRequest"). This is a configuration error,
  // not a billing or key problem.
  if (haystack.includes('bad language pair')
    || haystack.includes('language pair')
    || haystack.includes('invalid value at \'target\'')
    || haystack.includes('invalid value at \'source\'')) {
    return `${status} — Unsupported language pair for Google Translate. ${message || 'Check that both the source and target locales are supported by Google Translate.'}`.trim();
  }

  // Any other error — surface the parsed message if we have one, else the raw body.
  return `${status} — ${message || errorBody}`;
}

/**
 * Normalize champollion locale codes to Google Translate codes.
 *
 * Google uses BCP-47 but with some quirks:
 *   - 'zh-TW' → 'zh-TW' (fine)
 *   - 'crk' → not supported by Google (will return error)
 *   - Some codes need mapping: 'he' ↔ 'iw', 'jw' ↔ 'jv'
 *
 * @param {string} locale - Champollion locale code
 * @returns {string} Google-compatible locale code
 */
function normalizeLocaleForGoogle(locale) {
  const GOOGLE_LOCALE_MAP = {
    'he': 'iw',   // Hebrew: BCP-47 is 'he', Google uses 'iw'
    'jv': 'jw',   // Javanese: BCP-47 is 'jv', Google uses 'jw'
  };
  return GOOGLE_LOCALE_MAP[locale] || locale;
}

export { GoogleTranslateMethod, normalizeLocaleForGoogle, describeGoogleError };
