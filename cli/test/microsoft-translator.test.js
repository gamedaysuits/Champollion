#!/usr/bin/env node
/**
 * Microsoft Translator method test suite.
 *
 * Tests cover:
 *   - Constructor and naming
 *   - Cost estimation
 *   - Quality tier and provenance
 *   - No-key early return
 *   - Registry lookup
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MicrosoftTranslatorMethod } from '../lib/methods/microsoft-translator.js';
import { getMethod } from '../lib/translate.js';

// =================================================================
// MicrosoftTranslatorMethod
// =================================================================
describe('MicrosoftTranslatorMethod', () => {
  it('has the correct name', () => {
    const method = new MicrosoftTranslatorMethod();
    assert.equal(method.name, 'microsoft-translator');
  });

  it('returns standard quality tier', () => {
    const method = new MicrosoftTranslatorMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns correct provenance', () => {
    const method = new MicrosoftTranslatorMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources[0].name.includes('Microsoft'));
    assert.equal(prov.flags.length, 0);
  });

  it('returns cost estimate', () => {
    const method = new MicrosoftTranslatorMethod();
    const cost = method.estimateCost(100);
    assert.equal(cost.currency, 'USD');
    assert.ok(typeof cost.source === 'string' && cost.source.length > 0);
  });

  it('returns null when no API key is provided', async (t) => {
    // Skip if a real key is discoverable — can't test the null path
    const { getEnvOrFileVar } = await import('../lib/api-key.js');
    if (getEnvOrFileVar('MICROSOFT_TRANSLATOR_API_KEY')) return t.skip('MICROSOFT_TRANSLATOR_API_KEY is set');

    const method = new MicrosoftTranslatorMethod();
    const origErr = console.error;
    console.error = () => {};
    try {
      const result = await method.translate(
        ['test.key'],
        { 'test.key': 'Hello' },
        { name: 'French', register: 'Standard.', target: 'fr', source: 'en' },
        { apiKey: null },
      );
      assert.equal(result, null);
    } finally {
      console.error = origErr;
    }
  });

  it('returns null for translateContent (unsupported)', async () => {
    const method = new MicrosoftTranslatorMethod();
    const result = await method.translateContent(
      'Translate this.',
      { name: 'French', register: 'Standard.', target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });
});

// =================================================================
// Endpoint resolution — MICROSOFT_TRANSLATOR_ENDPOINT
// (sovereign / private / custom-domain Azure deployments)
// =================================================================
describe('MicrosoftTranslatorMethod — endpoint resolution', () => {
  const DEFAULT_ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';

  function withEnv(value, fn) {
    const orig = process.env.MICROSOFT_TRANSLATOR_ENDPOINT;
    if (value === undefined) delete process.env.MICROSOFT_TRANSLATOR_ENDPOINT;
    else process.env.MICROSOFT_TRANSLATOR_ENDPOINT = value;
    try {
      return fn();
    } finally {
      if (orig === undefined) delete process.env.MICROSOFT_TRANSLATOR_ENDPOINT;
      else process.env.MICROSOFT_TRANSLATOR_ENDPOINT = orig;
    }
  }

  it('defaults to the global endpoint when nothing is set', (t) => {
    if (process.env.MICROSOFT_TRANSLATOR_ENDPOINT) return t.skip('MICROSOFT_TRANSLATOR_ENDPOINT is set');
    const method = new MicrosoftTranslatorMethod();
    assert.equal(method._resolveEndpoint({}), DEFAULT_ENDPOINT);
  });

  it('reads MICROSOFT_TRANSLATOR_ENDPOINT and appends /translate to a host base', () => {
    withEnv('https://sovereign.cognitiveservices.azure.com', () => {
      const method = new MicrosoftTranslatorMethod();
      assert.equal(
        method._resolveEndpoint({}),
        'https://sovereign.cognitiveservices.azure.com/translate',
      );
    });
  });

  it('accepts a full /translate path (with trailing slash) without doubling it', () => {
    withEnv('https://sovereign.cognitiveservices.azure.com/translate/', () => {
      const method = new MicrosoftTranslatorMethod();
      assert.equal(
        method._resolveEndpoint({}),
        'https://sovereign.cognitiveservices.azure.com/translate',
      );
    });
  });

  it('options.microsoftEndpoint takes precedence over the env var', () => {
    withEnv('https://from-env.example.com', () => {
      const method = new MicrosoftTranslatorMethod();
      assert.equal(
        method._resolveEndpoint({ microsoftEndpoint: 'https://from-option.example.com' }),
        'https://from-option.example.com/translate',
      );
    });
  });

  it('translate() POSTs to the resolved private endpoint, not the global one', async () => {
    const origKey = process.env.MICROSOFT_TRANSLATOR_API_KEY;
    const origFetch = global.fetch;
    let capturedUrl = null;
    process.env.MICROSOFT_TRANSLATOR_API_KEY = 'test-key-123';
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        async json() { return [{ translations: [{ text: 'Bonjour' }] }]; },
        async text() { return ''; },
      };
    };
    try {
      await withEnv('https://sovereign.cognitiveservices.azure.com', async () => {
        const method = new MicrosoftTranslatorMethod();
        const result = await method.translate(
          ['greeting'],
          { greeting: 'Hello' },
          { target: 'fr', source: 'en' },
          {},
        );
        assert.deepEqual(result, { greeting: 'Bonjour' });
        assert.ok(
          capturedUrl.startsWith('https://sovereign.cognitiveservices.azure.com/translate?'),
          `expected POST to the private endpoint, got: ${capturedUrl}`,
        );
        assert.ok(capturedUrl.includes('api-version=3.0'), `missing api-version: ${capturedUrl}`);
        assert.ok(
          capturedUrl.includes('from=en') && capturedUrl.includes('to=fr'),
          `missing locale params: ${capturedUrl}`,
        );
      });
    } finally {
      global.fetch = origFetch;
      if (origKey === undefined) delete process.env.MICROSOFT_TRANSLATOR_API_KEY;
      else process.env.MICROSOFT_TRANSLATOR_API_KEY = origKey;
    }
  });
});

// =================================================================
// Registry integration
// =================================================================
describe('METHOD_REGISTRY — microsoft-translator', () => {
  it('getMethod returns MicrosoftTranslatorMethod for "microsoft-translator"', () => {
    const method = getMethod('microsoft-translator');
    assert.equal(method.name, 'microsoft-translator');
    assert.ok(method instanceof MicrosoftTranslatorMethod);
  });
});
