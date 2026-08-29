import { TranslationMethod } from './base.js';
import { getEnvOrFileVar } from '../api-key.js';
import { DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { estimateProviderCost } from './provider-pricing.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { fetchWithRetry } from './fetch-with-retry.js';
import { pMap } from '../concurrent.js';

const LIBRETRANSLATE_REQUEST_TIMEOUT_MS = 15000;

class LibreTranslateMethod extends TranslationMethod {
  constructor(options = {}) {
    super('libretranslate', options);
  }

  // ── API resolution helpers ──────────────────────────────────────

  /**
   * Resolve the LibreTranslate API endpoint URL.
   * Falls back to localhost:5000 for self-hosted instances.
   * @param {object} options - Caller-provided options
   * @returns {string}
   */
  _resolveApiEndpoint(options) {
    return options.libretranslateApiUrl
      || getEnvOrFileVar('LIBRETRANSLATE_API_URL')
      || getEnvOrFileVar('LIBRETRANSLATE_API_URL', options.cwd)
      || 'http://localhost:5000/translate';
  }

  /**
   * Resolve the LibreTranslate API key (optional for self-hosted).
   * @param {object} options - Caller-provided options
   * @returns {string|null}
   */
  _resolveApiKey(options) {
    return options.libretranslateApiKey
      || getEnvOrFileVar('LIBRETRANSLATE_API_KEY')
      || getEnvOrFileVar('LIBRETRANSLATE_API_KEY', options.cwd);
  }

  /**
   * Translate a batch of key-value pairs via LibreTranslate API.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { apiKey, batchSize }
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const apiEndpoint = this._resolveApiEndpoint(options);
    const apiKey = this._resolveApiKey(options);

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';
    const allTranslated = {};

    const maxSegments = pairConfig.batchSize || options.batchSize || 64;

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

      const result = await this._translateBatchWithRetry({
        apiEndpoint,
        apiKey,
        orderedKeys,
        sourceTexts,
        sourceLocale,
        targetLocale,
        batchNum: idx + 1,
      });

      if (result) {
        Object.assign(allTranslated, result);
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Translate freeform Markdown content via LibreTranslate API.
   *
   * Same protect/restore approach — ⟦PROTECTED_N⟧ placeholders shield
   * code blocks and shortcodes from the translation engine.
   *
   * @param {string} prompt - Complete translation prompt from buildContentPrompt()
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - {}
   * @returns {string|null} Translated text, or null on failure
   */
  async translateContent(prompt, pairConfig, options) {
    const apiEndpoint = this._resolveApiEndpoint(options);
    const apiKey = this._resolveApiKey(options);

    // Extract the Markdown body from the translation prompt
    const bodyText = extractContentBody(prompt);
    if (!bodyText.trim()) return null;

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';

    const body = {
      q: bodyText,
      source: sourceLocale,
      target: targetLocale,
      format: 'text',
    };
    if (apiKey) {
      body.api_key = apiKey;
    }

    const response = await fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, {
      label: 'LibreTranslate content',
      timeoutMs: LIBRETRANSLATE_REQUEST_TIMEOUT_MS * 2,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`LibreTranslate content: ${response.status} — ${errorBody}`);
      return null;
    }

    const json = await response.json();
    if (!json?.translatedText) {
      output.error('LibreTranslate content: empty response');
      return null;
    }

    return json.translatedText;
  }

  /**
   * Preflight check: verify the LibreTranslate server is reachable.
   *
   * Unlike cloud APIs that just need a key check, LibreTranslate is
   * self-hosted — the server might not be running. We probe it here
   * so the user gets a clear "server is down" message at startup instead
   * of cryptic fetch errors deep in the translation loop.
   */
  async checkReadiness(context) {
    const endpointUrl = this._resolveApiEndpoint(context);

    // The /translate endpoint base — try to reach the API root
    const baseUrl = endpointUrl.replace(/\/translate\/?$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/languages`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ready: false,
          reason:
            `LibreTranslate server at ${baseUrl} responded with ${response.status}.\n` +
            `  Check that LibreTranslate is running and accessible.`,
        };
      }
      return { ready: true };
    } catch (err) {
      return {
        ready: false,
        reason:
          `Cannot reach LibreTranslate server at ${baseUrl}.\n` +
          `  ${err.name === 'AbortError' ? 'Connection timed out.' : err.message}\n` +
          `  Start LibreTranslate: docker run -ti --rm -p 5000:5000 libretranslate/libretranslate`,
      };
    }
  }

  estimateCost(keyCount) {
    return estimateProviderCost('libretranslate', keyCount);
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'LibreTranslate API',
          license: 'AGPL-3.0 (Self-hosted)',
          type: 'api',
        },
      ],
      // AGPL-3.0 — matches shared/method-registry.json (commercialReady:
      // false) and docs/MT_SYSTEMS_UNDER_TEST.md. This said `true` until
      // 2026-08-12 while declaring AGPL in the same object; the CLAUDE.md
      // AGPL boundary makes that a licence-boundary defect, not a nuance.
      // Non-commercial use is unaffected — that lane is not gated.
      commercialReady: false,
      flags: ['COPYLEFT_AGPL'],
    };
  }

  getSetupHelp() {
    // LibreTranslate is self-hosted — there's no "missing key" case,
    // just a "can't connect" case. Always show the connection guide.
    return [
      '',
      '  ┌─ LibreTranslate Connection Failed ──────────────────────────────┐',
      '  │ Could not connect to LibreTranslate API.                         │',
      '  │                                                                  │',
      '  │ Default endpoint: http://localhost:5000/translate                 │',
      '  │                                                                  │',
      '  │ To use a remote instance:                                        │',
      '  │   export LIBRETRANSLATE_API_URL=https://your-instance/translate   │',
      '  │   export LIBRETRANSLATE_API_KEY=... (if required)                 │',
      '  │                                                                  │',
      '  │ Self-host: docker run -p 5000:5000 libretranslate/libretranslate  │',
      '  └──────────────────────────────────────────────────────────────────┘',
    ];
  }

  async _translateBatchWithRetry({
    apiEndpoint,
    apiKey,
    orderedKeys,
    sourceTexts,
    sourceLocale,
    targetLocale,
    batchNum,
  }) {
    const body = {
      q: sourceTexts,
      source: sourceLocale,
      target: targetLocale,
      format: 'text',
    };

    if (apiKey) {
      body.api_key = apiKey;
    }

    const response = await fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, {
      label: `LibreTranslate batch ${batchNum}`,
      timeoutMs: LIBRETRANSLATE_REQUEST_TIMEOUT_MS,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`LibreTranslate batch ${batchNum}: ${response.status} — ${errorBody}`);
      return null;
    }

    const json = await response.json();
    const translatedText = json?.translatedText;

    if (!translatedText || (Array.isArray(translatedText) && translatedText.length !== orderedKeys.length)) {
      output.error(`LibreTranslate batch ${batchNum}: Response format or length mismatch`);
      return null;
    }

    const result = {};
    if (Array.isArray(translatedText)) {
      for (let i = 0; i < orderedKeys.length; i++) {
        result[orderedKeys[i]] = translatedText[i];
      }
    } else if (orderedKeys.length === 1 && typeof translatedText === 'string') {
      // If LibreTranslate returned a single string for a single item batch
      result[orderedKeys[0]] = translatedText;
    } else {
      output.error(`LibreTranslate batch ${batchNum}: Unexpected translatedText format`);
      return null;
    }

    const charCount = sourceTexts.reduce((sum, t) => sum + t.length, 0);
    output.progress(`  ✓ LibreTranslate batch ${batchNum} (${orderedKeys.length} keys, ${charCount} chars)`);

    return result;
  }
}

export { LibreTranslateMethod };
