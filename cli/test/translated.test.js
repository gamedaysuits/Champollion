/**
 * TranslatedMethod (Lara) — adapter unit tests.
 *
 * The Lara SDK signs requests itself, so these tests never touch the network
 * or the SDK: a fake client is injected via the `laraClient` option and the
 * credential paths are exercised through env vars.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TranslatedMethod, TRANSLATED_MAX_BATCH } from '../lib/methods/translated.js';

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
}

describe('TranslatedMethod', () => {
  it('constructor sets the method name', () => {
    const method = new TranslatedMethod();
    assert.equal(method.name, 'translated');
  });

  it('resolves the credential pair from env', () =>
    withEnv({ LARA_ACCESS_KEY_ID: 'id-1', LARA_ACCESS_KEY_SECRET: 'sec-1' }, () => {
      const method = new TranslatedMethod();
      assert.deepEqual(method._resolveCredentials({}), { id: 'id-1', secret: 'sec-1' });
    }));

  it('credentials are null when either half is missing', () =>
    withEnv({ LARA_ACCESS_KEY_ID: 'id-1', LARA_ACCESS_KEY_SECRET: undefined }, () => {
      const method = new TranslatedMethod();
      assert.equal(method._resolveCredentials({}), null);
    }));

  it('translates via an injected client, preserving key order', async () => {
    const calls = [];
    const fake = {
      translate: async (texts, src, tgt) => {
        calls.push({ texts, src, tgt });
        return { translation: texts.map((t) => `[${tgt}] ${t}`) };
      },
    };
    const method = new TranslatedMethod({ laraClient: fake });
    const result = await method.translate(
      ['a', 'b'],
      { a: 'Hello', b: 'World' },
      { source: 'en', target: 'fr' },
      {},
    );
    assert.deepEqual(result, { a: '[fr] Hello', b: '[fr] World' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].src, 'en');
    assert.equal(calls[0].tgt, 'fr');
  });

  it('chunks batches at the configured size', async () => {
    const calls = [];
    const fake = {
      translate: async (texts) => {
        calls.push(texts.length);
        return { translation: texts.map(() => 'x') };
      },
    };
    const method = new TranslatedMethod({ laraClient: fake });
    const keys = Array.from({ length: 7 }, (_, i) => `k${i}`);
    const flat = Object.fromEntries(keys.map((k) => [k, `text ${k}`]));
    await method.translate(keys, flat, { target: 'de', batchSize: 3 }, {});
    assert.deepEqual(calls.sort(), [1, 3, 3]);
  });

  it('returns null and skips the batch on length mismatch', async () => {
    const fake = { translate: async () => ({ translation: ['only-one'] }) };
    const method = new TranslatedMethod({ laraClient: fake });
    const result = await method.translate(
      ['a', 'b'],
      { a: 'Hello', b: 'World' },
      { target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });

  it('returns null when the client throws (batch isolated, never thrown)', async () => {
    const fake = { translate: async () => { throw new Error('boom'); } };
    const method = new TranslatedMethod({ laraClient: fake });
    const result = await method.translate(['a'], { a: 'Hello' }, { target: 'fr' }, {});
    assert.equal(result, null);
  });

  it('translateContent returns the single translation', async () => {
    const fake = { translate: async (texts) => ({ translation: [`FR:${texts[0]}`] }) };
    const method = new TranslatedMethod({ laraClient: fake });
    const out = await method.translateContent('Hello content', { target: 'fr' }, {});
    assert.ok(out && out.startsWith('FR:'));
  });

  it('checkReadiness is false without the pair, true with it', () =>
    withEnv({ LARA_ACCESS_KEY_ID: undefined, LARA_ACCESS_KEY_SECRET: undefined }, () => {
      const method = new TranslatedMethod();
      const notReady = method.checkReadiness({});
      assert.equal(notReady.ready, false);
      assert.ok(notReady.reason.includes('LARA_ACCESS_KEY_ID'));
      return withEnv(
        { LARA_ACCESS_KEY_ID: 'id', LARA_ACCESS_KEY_SECRET: 'sec' },
        () => {
          assert.equal(new TranslatedMethod().checkReadiness({}).ready, true);
        },
      );
    }));

  it('never invents pricing', () => {
    const est = new TranslatedMethod().estimateCost(100);
    assert.equal(est.estimatedCost, null);
    assert.ok(est.note.length > 0);
  });

  it('provenance is proprietary and commercial-ready', () => {
    const prov = new TranslatedMethod().getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources[0].name.includes('Lara'));
  });

  it('exports a sane default batch cap', () => {
    assert.ok(TRANSLATED_MAX_BATCH > 0 && TRANSLATED_MAX_BATCH <= 128);
  });
});
