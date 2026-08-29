/**
 * Apertium Translation Method — free/open-source RULE-BASED MT via the public
 * Apertium APy REST API. Mirrors the harness ApertiumMethod
 * (arena/mt_eval_harness/methods/apertium.py): same endpoint, env vars, and
 * GET/responseData shape, so config is interchangeable between CLI and harness.
 *
 *   Endpoint: GET <base>/translate?langpair=<src>|<tgt>&q=<text>&markUnknown=no
 *             default https://apertium.org/apy
 *   Auth:     none (public). Keyed APy deployments accept ?key=<key>.
 *   Env:      APERTIUM_API_URL (optional), APERTIUM_API_KEY (optional)
 *   Locale:   pass-through (accepts ISO 639-1 'es' or 639-3 'spa')
 *   License:  GPL — called as a separate service, never bundled.
 *
 * Only installed pairs work (strongest on related languages). An uninstalled
 * pair returns HTTP 400 and is surfaced honestly, never faked.
 */

import { TranslationMethod } from './base.js';
import { getEnvOrFileVar } from '../api-key.js';
import { DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { extractContentBody } from './content-separator.js';
import { output } from '../output.js';
import { fetchWithRetry } from './fetch-with-retry.js';
import { pMap } from '../concurrent.js';

const APERTIUM_DEFAULT_BASE = 'https://apertium.org/apy';
const APERTIUM_USER_AGENT =
  'Champollion-MT-Eval/0.1 (+https://champollion.dev; champollion CLI)';
const APERTIUM_TIMEOUT_MS = 15000;

class ApertiumMethod extends TranslationMethod {
  constructor(options = {}) {
    super('apertium', options);
  }

  _resolveEndpoint(options = {}) {
    let ep = options.apertiumApiUrl
      || getEnvOrFileVar('APERTIUM_API_URL')
      || getEnvOrFileVar('APERTIUM_API_URL', options.cwd)
      || APERTIUM_DEFAULT_BASE;
    ep = ep.replace(/\/+$/, '');
    if (ep.endsWith('/translate')) ep = ep.slice(0, -'/translate'.length);
    return ep;
  }

  _resolveApiKey(options = {}) {
    return options.apertiumApiKey
      || getEnvOrFileVar('APERTIUM_API_KEY')
      || getEnvOrFileVar('APERTIUM_API_KEY', options.cwd);
  }

  _buildUrl(base, langpair, text, apiKey) {
    const params = new URLSearchParams({ langpair, q: text, markUnknown: 'no' });
    if (apiKey) params.set('key', apiKey);
    return `${base}/translate?${params.toString()}`;
  }

  async _translateOne(base, langpair, text, apiKey, label) {
    const res = await fetchWithRetry(
      this._buildUrl(base, langpair, text, apiKey),
      { method: 'GET', headers: { 'User-Agent': APERTIUM_USER_AGENT } },
      { label, timeoutMs: APERTIUM_TIMEOUT_MS },
    );
    if (!res) return null;
    if (!res.ok) {
      const body = await res.text();
      output.error(`Apertium ${label}: ${res.status} — ${body.slice(0, 200)}`);
      return null;
    }
    const json = await res.json();
    const translated = json?.responseData?.translatedText;
    return typeof translated === 'string' ? translated : null;
  }

  async translate(keys, sourceFlat, pairConfig, options) {
    const base = this._resolveEndpoint(options);
    const apiKey = this._resolveApiKey(options);
    const langpair = `${pairConfig.source || 'en'}|${pairConfig.target}`;
    const allTranslated = {};

    const items = keys.filter(
      (k) => typeof sourceFlat[k] === 'string' && sourceFlat[k],
    );
    await pMap(items, async (key) => {
      const out = await this._translateOne(base, langpair, sourceFlat[key], apiKey, `key ${key}`);
      if (out !== null) allTranslated[key] = out;
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  async translateContent(prompt, pairConfig, options) {
    const base = this._resolveEndpoint(options);
    const apiKey = this._resolveApiKey(options);
    const bodyText = extractContentBody(prompt);
    if (!bodyText.trim()) return null;
    const langpair = `${pairConfig.source || 'en'}|${pairConfig.target}`;
    return this._translateOne(base, langpair, bodyText, apiKey, 'content');
  }

  async checkReadiness(context) {
    const base = this._resolveEndpoint(context || {});
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${base}/listPairs`, {
        method: 'GET',
        headers: { 'User-Agent': APERTIUM_USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return { ready: false, reason: `Apertium API at ${base} responded ${res.status}.` };
      }
      return { ready: true };
    } catch (err) {
      return {
        ready: false,
        reason:
          `Cannot reach Apertium API at ${base}: ` +
          `${err.name === 'AbortError' ? 'timeout' : err.message}. ` +
          `Override with APERTIUM_API_URL or self-host APy.`,
      };
    }
  }

  estimateCost(_keyCount) {
    // The public Apertium API is free (rate-limited) — there is no per-character
    // charge, so $0 is honest here (unlike local LLMs, whose compute cost is
    // genuinely unknown).
    return {
      estimatedCost: 0,
      currency: 'USD',
      source: 'apertium-free-public-api',
      note: 'Apertium public API is free (rate-limited; self-host for volume).',
    };
  }

  getQualityTier() {
    return 'standard';
  }

  getProvenance() {
    return {
      resources: [
        { name: 'Apertium (rule-based MT)', license: 'GPL-3.0+', type: 'api' },
      ],
      commercialReady: false,
      flags: ['rule-based', 'gpl'],
    };
  }

  getSetupHelp() {
    return [
      '  Apertium (rule-based, free public API):',
      '   • No API key needed — uses https://apertium.org/apy by default.',
      '   • Only installed pairs work (strong on related languages, e.g. es↔ca, eng↔spa).',
      '   • Self-host or point elsewhere: export APERTIUM_API_URL=https://your-apy',
    ];
  }
}

export { ApertiumMethod };
