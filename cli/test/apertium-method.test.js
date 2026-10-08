import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getMethod } from '../lib/translate.js';
import { ApertiumMethod } from '../lib/methods/apertium.js';

// Apertium CLI adapter — rule-based, keyless, GET + responseData. No network.

describe('ApertiumMethod (rule-based, keyless)', () => {
  const ENV = ['APERTIUM_API_URL', 'APERTIUM_API_KEY'];
  const saved = {};
  beforeEach(() => { for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is registered and resolves via getMethod', () => {
    const m = getMethod('apertium');
    assert.equal(m.name, 'apertium');
    assert.ok(m instanceof ApertiumMethod);
  });

  it('resolves the default public endpoint', () => {
    assert.equal(new ApertiumMethod()._resolveEndpoint(), 'https://apertium.org/apy');
  });

  it('strips a trailing /translate from APERTIUM_API_URL', () => {
    process.env.APERTIUM_API_URL = 'https://my.apy.example/translate/';
    assert.equal(new ApertiumMethod()._resolveEndpoint(), 'https://my.apy.example');
  });

  it('builds a langpair GET URL with markUnknown=no', () => {
    const url = new ApertiumMethod()._buildUrl('https://apertium.org/apy', 'en|es', 'Hello, world.', null);
    assert.ok(url.startsWith('https://apertium.org/apy/translate?'));
    assert.match(url, /langpair=en%7Ces/); // pipe URL-encoded
    assert.match(url, /markUnknown=no/);
    assert.match(url, /q=Hello/);
  });

  it('includes ?key= only when an api key is set', () => {
    const withKey = new ApertiumMethod()._buildUrl('https://x/apy', 'en|es', 'hi', 'SECRET');
    assert.match(withKey, /key=SECRET/);
    const noKey = new ApertiumMethod()._buildUrl('https://x/apy', 'en|es', 'hi', null);
    assert.doesNotMatch(noKey, /key=/);
  });

  it('cost is free ($0) for the public API', () => {
    assert.equal(new ApertiumMethod().estimateCost(100).estimatedCost, 0);
  });

  it('is GPL / not commercial-ready in provenance', () => {
    const p = new ApertiumMethod().getProvenance();
    assert.equal(p.commercialReady, false);
    assert.ok(p.flags.includes('rule-based'));
  });
});
