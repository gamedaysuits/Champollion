/**
 * Translated (Lara) — professional MT via Translated's Lara Translate API.
 *
 *   Endpoint: official @translated/lara SDK (REST /v2/translate under the
 *             hood; requests are HMAC-signed by the SDK — we never hand-roll
 *             the signature)
 *   Auth:     LARA_ACCESS_KEY_ID + LARA_ACCESS_KEY_SECRET (dashboard →
 *             Settings → API Keys at laratranslate.com)
 *   Codes:    BCP-47; base ISO 639-1 codes are accepted and auto-resolve to
 *             the default regional locale (en → en-US), so we pass our locale
 *             codes through unchanged.
 *   Batch:    the SDK accepts string arrays; we chunk to keep request sizes
 *             polite and failures isolated.
 *
 * ModernMT note: Translated is sunsetting ModernMT into Lara (API-compatible
 * migration path until end of 2026); this adapter targets Lara only.
 */

import { TranslationMethod } from './base.js';
import { getEnvOrFileVar } from '../api-key.js';
import { DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { pMap } from '../concurrent.js';

const TRANSLATED_MAX_BATCH = 50;

class TranslatedMethod extends TranslationMethod {
  constructor(options = {}) {
    super('translated', options);
    this._client = options.laraClient || null; // injectable for tests
  }

  // ── Credential / client resolution ─────────────────────────────

  /**
   * Resolve the Lara access-key pair from options, env vars, or .env files.
   * @param {object} options - Caller-provided options
   * @returns {{id: string, secret: string}|null}
   */
  _resolveCredentials(options = {}) {
    const id = options.laraAccessKeyId
      || getEnvOrFileVar('LARA_ACCESS_KEY_ID')
      || getEnvOrFileVar('LARA_ACCESS_KEY_ID', options.cwd);
    const secret = options.laraAccessKeySecret
      || getEnvOrFileVar('LARA_ACCESS_KEY_SECRET')
      || getEnvOrFileVar('LARA_ACCESS_KEY_SECRET', options.cwd);
    return id && secret ? { id, secret } : null;
  }

  /**
   * Lazily construct the official Lara SDK client. The SDK owns request
   * signing (HMAC over the request envelope), retries, and endpoint choice.
   * @param {object} options
   * @returns {Promise<object|null>} Translator instance or null
   */
  async _getClient(options = {}) {
    if (this._client) return this._client;
    const creds = this._resolveCredentials(options);
    if (!creds) return null;
    let lara;
    try {
      lara = await import('@translated/lara');
    } catch {
      output.error(
        'Translated (Lara): the @translated/lara SDK is not installed — '
        + 'run `npm install` in the champollion package.',
      );
      return null;
    }
    const { Credentials, Translator } = lara;
    this._client = new Translator(new Credentials(creds.id, creds.secret));
    return this._client;
  }

  // ── Translation ────────────────────────────────────────────────

  /**
   * Translate one chunk of texts. Returns the translations array (in input
   * order) or null on failure — callers treat null as a skipped batch.
   */
  async _translateBatch(client, sourceTexts, sourceLocale, targetLocale, batchNum) {
    try {
      const result = await client.translate(sourceTexts, sourceLocale, targetLocale);
      const translations = Array.isArray(result?.translation)
        ? result.translation
        : [result?.translation];
      if (translations.length !== sourceTexts.length) {
        output.error(
          `Translated batch ${batchNum}: response length mismatch `
          + `(sent ${sourceTexts.length}, got ${translations.length})`,
        );
        return null;
      }
      return translations;
    } catch (err) {
      output.error(`Translated batch ${batchNum}: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Translate a batch of key-value pairs via the Lara API.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { laraAccessKeyId, laraAccessKeySecret, batchSize }
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const client = await this._getClient(options);
    if (!client) {
      output.warn(
        'Translated (Lara): no credentials (LARA_ACCESS_KEY_ID / '
        + 'LARA_ACCESS_KEY_SECRET) — skipping.',
      );
      return null;
    }

    const sourceLocale = pairConfig.source || 'en';
    const targetLocale = pairConfig.target;
    const maxSegments = pairConfig.batchSize || options.batchSize || TRANSLATED_MAX_BATCH;
    const allTranslated = {};

    const batchChunks = [];
    for (let i = 0; i < keys.length; i += maxSegments) {
      batchChunks.push(keys.slice(i, i + maxSegments));
    }

    await pMap(batchChunks, async (chunk, idx) => {
      const orderedKeys = [];
      const sourceTexts = [];
      for (const key of chunk) {
        const val = sourceFlat[key];
        if (val && typeof val === 'string') {
          orderedKeys.push(key);
          sourceTexts.push(val);
        }
      }
      if (sourceTexts.length === 0) return;

      const translations = await this._translateBatch(
        client, sourceTexts, sourceLocale, targetLocale, idx + 1,
      );
      if (!translations) return;
      for (let i = 0; i < orderedKeys.length; i++) {
        if (typeof translations[i] === 'string') {
          allTranslated[orderedKeys[i]] = translations[i];
        }
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Translate freeform Markdown content via Lara.
   * @param {string} prompt - Content prompt (body extracted before sending)
   * @param {import('../types.js').PairConfig} pairConfig
   * @param {object} options
   * @returns {Promise<string|null>}
   */
  async translateContent(prompt, pairConfig, options) {
    const client = await this._getClient(options);
    if (!client) return null;
    const body = extractContentBody(prompt);
    if (!body.trim()) return null;
    const translations = await this._translateBatch(
      client, [body], pairConfig.source || 'en', pairConfig.target, 'content',
    );
    return translations ? translations[0] : null;
  }

  // ── Metadata ───────────────────────────────────────────────────

  checkReadiness(context) {
    const creds = this._resolveCredentials(context || {});
    if (!creds) {
      return {
        ready: false,
        reason: 'No Lara credentials (LARA_ACCESS_KEY_ID + LARA_ACCESS_KEY_SECRET). '
          + 'Create an API key at laratranslate.com → Settings → API Keys.',
      };
    }
    return { ready: true };
  }

  estimateCost(_keyCount) {
    // Proprietary per-character pricing behind Translated's plans; never
    // invent a number (Project rule: never invent pricing).
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'translated-lara-proprietary',
      note: 'Lara pricing is plan-based; per-character cost not published.',
    };
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'Translated Lara Translate API',
          license: 'Proprietary (Translated ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    return [
      '  Translated (Lara) — professional MT API, 200+ languages:',
      '   1. Sign up: https://laratranslate.com',
      '   2. Settings → API Keys → create an access key',
      '   3. export LARA_ACCESS_KEY_ID=...  LARA_ACCESS_KEY_SECRET=...',
      '      (or add both to .env.local)',
    ];
  }
}

export { TranslatedMethod, TRANSLATED_MAX_BATCH };
