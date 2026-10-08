import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeepLMethod } from '../lib/methods/deepl.js';

describe('DeepLMethod', () => {
  it('constructor sets correct name', () => {
    const method = new DeepLMethod();
    assert.equal(method.name, 'deepl');
  });

  it('getQualityTier returns standard', () => {
    const method = new DeepLMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('getProvenance returns DeepL info', () => {
    const method = new DeepLMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 1);
    assert.ok(prov.resources[0].name.includes('DeepL'));
  });

  it('estimateCost returns valid cost', () => {
    const method = new DeepLMethod();
    const cost = method.estimateCost(10);
    assert.equal(cost.currency, 'USD');
    assert.ok(cost.estimatedCost > 0);
  });

  it('translate returns null when no API key is set', async () => {
    const original = process.env.DEEPL_API_KEY;
    delete process.env.DEEPL_API_KEY;

    const method = new DeepLMethod();
    const result = await method.translate(
      ['hello'],
      { hello: 'Hello' },
      { target: 'fr', source: 'en' },
      {}
    );
    assert.equal(result, null);

    if (original) process.env.DEEPL_API_KEY = original;
  });

  it('translates successfully with mock fetch (free endpoint)', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let requestBody = null;

    globalThis.fetch = async (url, options) => {
      fetchCalled = true;
      assert.ok(url.includes('api-free.deepl.com/v2/translate'));
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          translations: [{ text: 'Bonjour' }]
        })
      };
    };

    try {
      const method = new DeepLMethod();
      const result = await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'fr', source: 'en' },
        { deeplApiKey: 'test-key:fx' }
      );

      assert.ok(fetchCalled);
      assert.deepEqual(result, { hello: 'Bonjour' });
      assert.deepEqual(requestBody.text, ['Hello']);
      assert.equal(requestBody.target_lang, 'FR');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('respects formality mapping', async () => {
    const originalFetch = globalThis.fetch;
    let formalityValue = null;

    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      formalityValue = body.formality;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          translations: [{ text: 'Bonjour' }]
        })
      };
    };

    try {
      const method = new DeepLMethod();

      // Case 1: French formal-vous → 'prefer_more'
      // WHY: The fr.json card declares formal-vous.deeplFormality = 'prefer_more'.
      // registerPreset holds the key name; register holds prompt text.
      await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'fr', source: 'en', registerPreset: 'formal-vous' },
        { deeplApiKey: 'test-key' }
      );
      assert.equal(formalityValue, 'prefer_more');

      // Case 2: French casual-tu → 'prefer_less'
      // WHY: The fr.json card declares casual-tu.deeplFormality = 'prefer_less'.
      await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'fr', source: 'en', registerPreset: 'casual-tu' },
        { deeplApiKey: 'test-key' }
      );
      assert.equal(formalityValue, 'prefer_less');

      // Case 3: Language without DeepL formality support → 'default'
      // WHY: Swahili's card has deeplFormality=false, so the formality lookup
      // is skipped entirely and we get the default value.
      await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'sw', source: 'en' },
        { deeplApiKey: 'test-key' }
      );
      assert.equal(formalityValue, undefined);

      // Case 4: Japanese formal-keigo → 'prefer_more' (non-T-V bug fix)
      // WHY: DeepL supports formality for Japanese (keigo system, not T-V).
      // The ja.json card declares formal-keigo.deeplFormality = 'prefer_more'.
      await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'ja', source: 'en', registerPreset: 'formal-keigo' },
        { deeplApiKey: 'test-key' }
      );
      assert.equal(formalityValue, 'prefer_more');

      // Case 5: Spanish neutral-latam → formality omitted (neutral)
      // WHY: The es.json card declares neutral-latam.deeplFormality = 'default'.
      // When formality is 'default', the DeepL method intentionally omits it
      // from the request body — sending it would be redundant.
      await method.translate(
        ['hello'],
        { hello: 'Hello' },
        { target: 'es', source: 'en', registerPreset: 'neutral-latam' },
        { deeplApiKey: 'test-key' }
      );
      assert.equal(formalityValue, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
