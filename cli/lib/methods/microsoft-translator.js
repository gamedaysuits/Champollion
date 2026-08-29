import { TranslationMethod } from './base.js';
import { getEnvOrFileVar } from '../api-key.js';
import { resolveProviderEnv, envNamesLabel } from './provider-env.js';
import { EST_CHARS_PER_KEY, DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { estimateProviderCost } from './provider-pricing.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { fetchWithRetry } from './fetch-with-retry.js';
import { pMap } from '../concurrent.js';

// Global default endpoint base (no query string). A custom-domain / VNet /
// private-endpoint Azure resource overrides this via MICROSOFT_TRANSLATOR_ENDPOINT
// (see _resolveEndpoint). Kept separate from the api-version so we build the
// query the same way the Python harness adapter does
// (arena/mt_eval_harness/methods/microsoft_translator.py — _resolve_endpoint /
// _build_request), so a sovereign/private deployment that works there also
// works here.
const MICROSOFT_API_BASE = 'https://api.cognitive.microsofttranslator.com/translate';
const MICROSOFT_API_VERSION = '3.0';
const MICROSOFT_REQUEST_TIMEOUT_MS = 15000;

class MicrosoftTranslatorMethod extends TranslationMethod {
  constructor(options = {}) {
    super('microsoft-translator', options);
  }

  // ── API resolution helpers ──────────────────────────────────────

  /**
   * Resolve the Microsoft Translator API key from options, env vars, or .env files.
   * Checks the provider-env SSOT: MICROSOFT_TRANSLATOR_API_KEY (canonical),
   * then AZURE_TRANSLATOR_KEY (alias). Accepting the alias here is what keeps
   * the loader in step with readiness/doctor — a user who set only
   * AZURE_TRANSLATOR_KEY now actually runs instead of silently producing null.
   * @param {object} options - Caller-provided options
   * @returns {string|null}
   */
  _resolveApiKey(options) {
    return options.microsoftApiKey
      || resolveProviderEnv('microsoft-translator', options.cwd).value;
  }

  /**
   * Resolve the Azure region for the Translator resource.
   * @param {object} options - Caller-provided options
   * @returns {string|null}
   */
  _resolveRegion(options) {
    return options.microsoftRegion
      || getEnvOrFileVar('MICROSOFT_TRANSLATOR_REGION')
      || getEnvOrFileVar('MICROSOFT_TRANSLATOR_REGION', options.cwd);
  }

  /**
   * Resolve the Microsoft Translator /translate endpoint.
   *
   * Defaults to the global endpoint. A custom-domain / VNet / private-endpoint
   * (sovereign) resource sets MICROSOFT_TRANSLATOR_ENDPOINT to its own URL —
   * accepted either as a host base ("https://my-res.cognitiveservices.azure.com")
   * OR a full ".../translate" path; both normalize to the same value. This is
   * the SSOT env var the manifest declares and the Python harness honors
   * (_resolve_endpoint); without this the CLI silently hit the global server for
   * a private deployment.
   * @param {object} options - Caller-provided options
   * @returns {string} normalized endpoint base (no query string)
   */
  _resolveEndpoint(options = {}) {
    let ep = options.microsoftEndpoint
      || getEnvOrFileVar('MICROSOFT_TRANSLATOR_ENDPOINT')
      || getEnvOrFileVar('MICROSOFT_TRANSLATOR_ENDPOINT', options.cwd);
    if (!ep) return MICROSOFT_API_BASE;
    ep = ep.replace(/\/+$/, '');
    if (!ep.endsWith('/translate')) ep = `${ep}/translate`;
    return ep;
  }

  /**
   * Build the full request URL: <endpoint>?api-version=3.0&from=<src>&to=<tgt>.
   * @param {string} endpoint - Resolved endpoint base (from _resolveEndpoint)
   * @param {string} sourceLocale
   * @param {string} targetLocale
   * @returns {string}
   */
  _buildUrl(endpoint, sourceLocale, targetLocale) {
    const params = new URLSearchParams({
      'api-version': MICROSOFT_API_VERSION,
      from: sourceLocale,
      to: targetLocale,
    });
    return `${endpoint}?${params.toString()}`;
  }

  /**
   * Translate a batch of key-value pairs via Microsoft Translator API.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { apiKey, batchSize }
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);
    const region = this._resolveRegion(options);
    const endpoint = this._resolveEndpoint(options);

    if (!apiKey) {
      output.warn('Microsoft Translator: no API key — skipping.');
      return null;
    }

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';
    const allTranslated = {};

    // Microsoft supports up to 100 segments per request
    const maxSegments = pairConfig.batchSize || options.batchSize || 100;

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
        apiKey,
        region,
        endpoint,
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
   * Translate freeform Markdown content via Microsoft Translator API.
   *
   * Same protect/restore approach — ⟦PROTECTED_N⟧ placeholders shield
   * code blocks and shortcodes from the translation engine.
   *
   * @param {string} prompt - Complete translation prompt from buildContentPrompt()
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { apiKey }
   * @returns {string|null} Translated text, or null on failure
   */
  async translateContent(prompt, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);
    const region = this._resolveRegion(options);

    if (!apiKey) {
      output.warn('Microsoft Translator: no API key — skipping.');
      return null;
    }

    // Extract the Markdown body from the translation prompt
    const bodyText = extractContentBody(prompt);
    if (!bodyText.trim()) return null;

    const targetLocale = pairConfig.target;
    const sourceLocale = pairConfig.source || 'en';

    const endpoint = this._resolveEndpoint(options);
    const url = this._buildUrl(endpoint, sourceLocale, targetLocale);
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Ocp-Apim-Subscription-Key': apiKey,
    };
    if (region) {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ Text: bodyText }]),
    }, {
      label: 'Microsoft content',
      timeoutMs: MICROSOFT_REQUEST_TIMEOUT_MS * 2,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`Microsoft content: ${response.status} — ${errorBody}`);
      return null;
    }

    const json = await response.json();
    if (!json || json.length === 0 || !json[0].translations?.[0]?.text) {
      output.error('Microsoft content: empty response');
      return null;
    }

    return json[0].translations[0].text;
  }

  estimateCost(keyCount) {
    return estimateProviderCost('microsoft-translator', keyCount);
  }

  checkReadiness(context = {}) {
    // Resolve through the same SSOT the loader uses so readiness can never
    // pass under a name translate() won't read (or vice versa).
    const { value } = resolveProviderEnv('microsoft-translator', context.cwd);
    if (!value) {
      return { ready: false, reason: `No Microsoft Translator key (${envNamesLabel('microsoft-translator')}).` };
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
          name: 'Microsoft Translator API',
          license: 'Proprietary (Microsoft ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    const { value: apiKey } = resolveProviderEnv('microsoft-translator');
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Microsoft Translator requires an Azure subscription key.       │',
        '  │                                                                │',
        '  │ 1. Create a Translator resource in Azure Portal                │',
        '  │ 2. Run: export MICROSOFT_TRANSLATOR_API_KEY=...                │',
        '  │ 3. Set region: export MICROSOFT_TRANSLATOR_REGION=eastus        │',
        '  │                                                                │',
        '  │ Docs: https://learn.microsoft.com/azure/cognitive-services/     │',
        '  │       translator/quickstart-text-rest-api                       │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('Azure Portal');
  }

  async _translateBatchWithRetry({
    apiKey,
    region,
    endpoint,
    orderedKeys,
    sourceTexts,
    sourceLocale,
    targetLocale,
    batchNum,
  }) {
    const url = this._buildUrl(endpoint, sourceLocale, targetLocale);

    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Ocp-Apim-Subscription-Key': apiKey,
    };

    if (region) {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }

    const body = sourceTexts.map(text => ({ Text: text }));

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, {
      label: `Microsoft Translator batch ${batchNum}`,
      timeoutMs: MICROSOFT_REQUEST_TIMEOUT_MS,
    });

    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text();
      output.error(`Microsoft Translator batch ${batchNum}: ${response.status} — ${errorBody}`);
      return null;
    }

    const json = await response.json();

    if (!json || json.length !== orderedKeys.length) {
      output.error(`Microsoft Translator batch ${batchNum}: Response length mismatch (expected ${orderedKeys.length}, got ${json?.length || 0})`);
      return null;
    }

    const result = {};
    for (let i = 0; i < orderedKeys.length; i++) {
      result[orderedKeys[i]] = json[i].translations[0].text;
    }

    const charCount = sourceTexts.reduce((sum, t) => sum + t.length, 0);
    output.progress(`  ✓ Microsoft batch ${batchNum} (${orderedKeys.length} keys, ${charCount} chars)`);

    return result;
  }
}

export { MicrosoftTranslatorMethod };
