/**
 * Tilde MT Translation Method — European-developed neural MT via the Tilde MT
 * REST API. Mirrors the harness TildeMethod
 * (arena/mt_eval_harness/methods/tilde.py): same endpoint, env var, body, and
 * response shape, so config is interchangeable between CLI and harness.
 *
 *   Endpoint: POST https://translate.tilde.ai/api/translate/text
 *   Auth:     header  X-Api-Key: <key>
 *   Env:      TILDE_API_KEY (free trial key at translate.tilde.ai/access-keys)
 *   Body:     { srcLang, trgLang, domain:"general", text:[...], termCollections:[] }
 *   Response: json.translations[i].translation
 *   Locale:   ISO 639-1.
 */

import { TranslationMethod } from './base.js';
import { getEnvOrFileVar } from '../api-key.js';
import { DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { fetchWithRetry } from './fetch-with-retry.js';
import { pMap } from '../concurrent.js';

const TILDE_API_URL = 'https://translate.tilde.ai/api/translate/text';
const TILDE_TIMEOUT_MS = 15000;
const TILDE_MAX_BATCH = 25;

class TildeMethod extends TranslationMethod {
  constructor(options = {}) {
    super('tilde', options);
  }

  _resolveApiKey(options = {}) {
    return options.tildeApiKey
      || getEnvOrFileVar('TILDE_API_KEY')
      || getEnvOrFileVar('TILDE_API_KEY', options.cwd);
  }

  async _translateBatch(apiKey, orderedKeys, sourceTexts, srcLang, trgLang, batchNum) {
    const res = await fetchWithRetry(TILDE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        srcLang, trgLang, domain: 'general', text: sourceTexts, termCollections: [],
      }),
    }, { label: `Tilde batch ${batchNum}`, timeoutMs: TILDE_TIMEOUT_MS });

    if (!res) return null;
    if (!res.ok) {
      const body = await res.text();
      output.error(`Tilde batch ${batchNum}: ${res.status} — ${body.slice(0, 200)}`);
      return null;
    }
    const json = await res.json();
    const translations = json?.translations;
    if (!Array.isArray(translations) || translations.length !== orderedKeys.length) {
      output.error(`Tilde batch ${batchNum}: response length mismatch`);
      return null;
    }
    const result = {};
    for (let i = 0; i < orderedKeys.length; i++) {
      result[orderedKeys[i]] = translations[i]?.translation;
    }
    return result;
  }

  async translate(keys, sourceFlat, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);
    if (!apiKey) {
      output.warn('Tilde: no API key (TILDE_API_KEY) — skipping.');
      return null;
    }
    const srcLang = pairConfig.source || 'en';
    const trgLang = pairConfig.target;
    const maxBatch = pairConfig.batchSize || options.batchSize || TILDE_MAX_BATCH;
    const allTranslated = {};

    const chunks = [];
    for (let i = 0; i < keys.length; i += maxBatch) chunks.push(keys.slice(i, i + maxBatch));

    await pMap(chunks, async (chunk, idx) => {
      const orderedKeys = [];
      const sourceTexts = [];
      for (const key of chunk) {
        const val = sourceFlat[key];
        if (typeof val === 'string' && val) { orderedKeys.push(key); sourceTexts.push(val); }
      }
      if (!sourceTexts.length) return;
      const r = await this._translateBatch(apiKey, orderedKeys, sourceTexts, srcLang, trgLang, idx + 1);
      if (r) Object.assign(allTranslated, r);
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  async translateContent(prompt, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);
    if (!apiKey) return null;
    const body = extractContentBody(prompt);
    if (!body.trim()) return null;
    const r = await this._translateBatch(
      apiKey, ['__content__'], [body], pairConfig.source || 'en', pairConfig.target, 'content',
    );
    return r ? r['__content__'] : null;
  }

  checkReadiness(context) {
    const apiKey = this._resolveApiKey(context || {});
    if (!apiKey) {
      return {
        ready: false,
        reason: 'No Tilde API key (TILDE_API_KEY). Free trial key at https://translate.tilde.ai/access-keys.',
      };
    }
    return { ready: true };
  }

  estimateCost(_keyCount) {
    // Tilde pricing is plan-based; per-character cost is not published, so we
    // do not fabricate one (fail-honest — null, not a guessed $).
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'tilde-proprietary',
      note: 'Tilde pricing is plan-based (free trial 250K chars); per-char cost not published.',
    };
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [{ name: 'Tilde MT API', license: 'Proprietary (Tilde ToS)', type: 'api' }],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    return [
      '  Tilde MT (European neural MT):',
      '   1. Sign up: https://tilde.ai/translate/machine-translation-api/ (free trial 250K chars).',
      '   2. Create an access key: https://translate.tilde.ai/access-keys',
      '   3. export TILDE_API_KEY=...  (or add to .env.local)',
    ];
  }
}

export { TildeMethod };
