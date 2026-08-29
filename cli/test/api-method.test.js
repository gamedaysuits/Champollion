import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { APIMethod } from '../lib/methods/api.js';

// -----------------------------------------------------------------
// Tests: APIMethod — unit tests (no real API calls)
// -----------------------------------------------------------------

describe('APIMethod', () => {
  it('constructor sets correct method name', () => {
    const method = new APIMethod();
    assert.equal(method.name, 'api');
  });

  it('constructor accepts plugin context options', () => {
    const method = new APIMethod({
      endpoint: 'https://api.example.com/v1/translate',
      methodName: 'crk-coached-v1',
      methodVersion: '1.2.0',
      qualityTier: 'research',
      provenance: {
        resources: [{ name: 'Custom Pipeline', license: 'proprietary' }],
        commercialReady: true,
        flags: [],
      },
    });

    assert.equal(method.endpoint, 'https://api.example.com/v1/translate');
    assert.equal(method.methodName, 'crk-coached-v1');
    assert.equal(method.methodVersion, '1.2.0');
    assert.equal(method.qualityTier, 'research');
  });

  it('getQualityTier returns tier from plugin context', () => {
    const method = new APIMethod({ qualityTier: 'research' });
    assert.equal(method.getQualityTier(), 'research');
  });

  it('getQualityTier defaults to standard', () => {
    const method = new APIMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('getProvenance returns plugin provenance when set', () => {
    const pluginProv = {
      resources: [{ name: 'Test Resource', license: 'MIT' }],
      commercialReady: true,
      flags: [],
    };
    const method = new APIMethod({ provenance: pluginProv });
    const prov = method.getProvenance();
    assert.deepEqual(prov, pluginProv);
  });

  it('getProvenance returns default info when no plugin provenance', () => {
    const method = new APIMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources[0].name.includes('Remote'));
  });

  it('estimateCost returns null (server-determined pricing)', () => {
    const method = new APIMethod();
    const cost = method.estimateCost(1000);
    assert.equal(cost.currency, 'USD');
    assert.equal(cost.estimatedCost, null, 'API pricing is server-determined');
    assert.equal(cost.source, 'server-determined');
  });

  it('translate returns null when no API key is set', async () => {
    const original = process.env.CHAMPOLLION_API_KEY;
    delete process.env.CHAMPOLLION_API_KEY;

    const method = new APIMethod();
    const result = await method.translate(
      ['hello.world'],
      { 'hello.world': 'Hello' },
      { target: 'crk', source: 'en' },
      {},
    );
    assert.equal(result, null);

    if (original) process.env.CHAMPOLLION_API_KEY = original;
  });

  it('translate returns null when no endpoint is configured', async () => {
    const original = process.env.CHAMPOLLION_API_KEY;
    process.env.CHAMPOLLION_API_KEY = 'test-key';

    const method = new APIMethod(); // No endpoint
    const result = await method.translate(
      ['hello.world'],
      { 'hello.world': 'Hello' },
      { target: 'crk', source: 'en' },
      {},
    );
    assert.equal(result, null);

    // Restore
    if (original) {
      process.env.CHAMPOLLION_API_KEY = original;
    } else {
      delete process.env.CHAMPOLLION_API_KEY;
    }
  });

  it('translateContent returns null (not supported)', async () => {
    const method = new APIMethod();
    const result = await method.translateContent('some prompt', {}, {});
    assert.equal(result, null);
  });
});
