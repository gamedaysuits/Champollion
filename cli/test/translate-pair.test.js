/**
 * translate-pair.test.js — TM ↔ quality-gate ordering and feedback retry.
 *
 * Regression suite for the poisoned-TM bug: the pipeline used to store API
 * output in the Translation Memory BEFORE the quality gate ran. A degenerate
 * response (e.g. "for translating" → "吗") was cached, then re-served on
 * every later sync — it failed the gate each time and the API was never
 * consulted again, so the key stayed English forever.
 *
 * Covers:
 *   1. Gate-failing API output never enters the TM.
 *   2. Gate failures get ONE feedback retry with the rejection reason
 *      injected into the per-key descriptions (a blind retry at
 *      temperature 0 returns byte-identical output).
 *   3. A poisoned TM hit is evicted on gate failure and healed in the
 *      same run via the feedback retry.
 *   4. Validated output IS stored and served from TM on the next run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { translateAndValidate } from '../lib/translate-pair.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { lookupTM, storeTM, tmMethodKey } from '../lib/tm.js';

// -----------------------------------------------------------------
// Scripted fake method — getMethod() constructs a fresh instance per
// call, so the response queue and call log live on the class itself.
// -----------------------------------------------------------------

class FakeMethod {
  async translate(keys, sourceFlat, pairConfig, options) {
    FakeMethod.calls.push({ keys: [...keys], options });
    const next = FakeMethod.responses.shift();
    return next ?? null;
  }
}
FakeMethod.calls = [];
FakeMethod.responses = [];

METHOD_REGISTRY['test-fake'] = FakeMethod;

function resetFake(...responses) {
  FakeMethod.calls = [];
  FakeMethod.responses = responses;
}

function freshTM() {
  return { _meta: { version: 1 } };
}

// zh pair — non-Latin locale, so the gate's script and length checks apply.
const PAIR_CONFIG = {
  target: 'zh',
  method: 'test-fake',
  name: 'Mandarin Chinese',
  register: 'professional',
};

// The pipeline keys TM entries on tmMethodKey(pairConfig) — the full
// method|model|register|coaching identity — never the bare method name.
const TM_KEY = tmMethodKey(PAIR_CONFIG);

const SOURCE = {
  'homepage.arena.titleLine2': 'for translating',
};
const KEY = 'homepage.arena.titleLine2';

async function run(tm, opts = {}) {
  return translateAndValidate([KEY], SOURCE, PAIR_CONFIG, 'en:zh', {
    apiKey: 'test-key',
    tm,
    targetCode: 'zh',
    ...opts,
  });
}

// -----------------------------------------------------------------
// 1. Gate-failing output never enters the TM
// -----------------------------------------------------------------

test('translateAndValidate: gate-failing API output is not stored in TM', async () => {
  const tm = freshTM();
  // Both the first attempt and the feedback retry return the degenerate
  // single-character output (deterministic model at temperature 0).
  resetFake({ [KEY]: '吗' }, { [KEY]: '吗' });

  const result = await run(tm);

  assert.equal(result.translated, null);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].key, KEY);
  assert.match(result.failures[0].reason, /short/);
  // The poison must NOT be cached — this is what used to strand the key.
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', TM_KEY), null);
});

// -----------------------------------------------------------------
// 2. Feedback retry — prompt changes, recovery accepted and cached
// -----------------------------------------------------------------

test('translateAndValidate: gate failure triggers ONE feedback retry with the rejection reason', async () => {
  const tm = freshTM();
  resetFake({ [KEY]: '吗' }, { [KEY]: '进行翻译' });

  const result = await run(tm, { descriptions: { [KEY]: 'Arena title line 2' } });

  // Two API rounds: initial + feedback retry.
  assert.equal(FakeMethod.calls.length, 2);

  // The retry prompt must carry the rejection context — that is the whole
  // point (a blind retry at temperature 0 is a no-op).
  const retryDesc = FakeMethod.calls[1].options.descriptions[KEY];
  assert.match(retryDesc, /Arena title line 2/);
  assert.match(retryDesc, /rejected by the quality gate/);
  assert.match(retryDesc, /吗/);

  // Recovery is accepted and cached.
  assert.deepEqual(result.translated, { [KEY]: '进行翻译' });
  assert.equal(result.failures.length, 0);
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', TM_KEY), '进行翻译');
});

// -----------------------------------------------------------------
// 3. Poisoned TM hits — evicted, then healed in the same run
// -----------------------------------------------------------------

test('translateAndValidate: poisoned TM hit is evicted and healed via feedback retry', async () => {
  const tm = freshTM();
  storeTM(tm, SOURCE[KEY], 'zh', TM_KEY, '吗'); // poison from a pre-fix run

  resetFake({ [KEY]: '进行翻译' });

  const result = await run(tm);

  // Served from TM (no initial API call), gate fails, entry evicted,
  // feedback retry is the only API round.
  assert.equal(result.tmHitCount, 1);
  assert.equal(FakeMethod.calls.length, 1);
  assert.deepEqual(FakeMethod.calls[0].keys, [KEY]);

  assert.deepEqual(result.translated, { [KEY]: '进行翻译' });
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', TM_KEY), '进行翻译');
});

test('translateAndValidate: poisoned TM hit is evicted even when no API key is available', async () => {
  const tm = freshTM();
  storeTM(tm, SOURCE[KEY], 'zh', TM_KEY, '吗');
  resetFake();

  const result = await run(tm, { apiKey: null });

  // No retry possible, but the poison must still be gone so the next
  // keyed run consults the API instead of re-serving the bad entry.
  assert.equal(result.translated, null);
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', TM_KEY), null);
});

// -----------------------------------------------------------------
// 4. Happy path — validated output cached, next run hits TM
// -----------------------------------------------------------------

test('translateAndValidate: validated output is cached and served from TM on the next run', async () => {
  const tm = freshTM();
  resetFake({ [KEY]: '进行翻译' });

  const first = await run(tm);
  assert.deepEqual(first.translated, { [KEY]: '进行翻译' });
  assert.equal(FakeMethod.calls.length, 1);

  resetFake(); // no responses queued — an API call would return null
  const second = await run(tm);
  assert.deepEqual(second.translated, { [KEY]: '进行翻译' });
  assert.equal(second.tmHitCount, 1);
  assert.equal(FakeMethod.calls.length, 0);
});

// -----------------------------------------------------------------
// 5. TM identity — model/register switches must MISS, not re-serve
// -----------------------------------------------------------------

test('translateAndValidate: switching model does not re-serve the old model\'s cached translation', async () => {
  const tm = freshTM();

  // Populate the cache with the flash-model pair.
  resetFake({ [KEY]: '进行翻译' });
  const flashPair = { ...PAIR_CONFIG, model: 'google/gemini-3.5-flash' };
  const first = await translateAndValidate([KEY], SOURCE, flashPair, 'en:zh', {
    apiKey: 'test-key', tm, targetCode: 'zh',
  });
  assert.deepEqual(first.translated, { [KEY]: '进行翻译' });
  assert.equal(FakeMethod.calls.length, 1);

  // Same source, same method — but a different model. Before tmMethodKey,
  // this served the flash-era entry; now it must consult the API again.
  resetFake({ [KEY]: '翻译文本' });
  const proPair = { ...PAIR_CONFIG, model: 'google/gemini-3.5-pro' };
  const second = await translateAndValidate([KEY], SOURCE, proPair, 'en:zh', {
    apiKey: 'test-key', tm, targetCode: 'zh',
  });
  assert.equal(second.tmHitCount, 0, 'a model switch must be a cache miss');
  assert.equal(FakeMethod.calls.length, 1, 'the API must be consulted for the new model');
  assert.deepEqual(second.translated, { [KEY]: '翻译文本' });

  // Both entries coexist under their own keys — no cache nuking.
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', tmMethodKey(flashPair)), '进行翻译');
  assert.equal(lookupTM(tm, SOURCE[KEY], 'zh', tmMethodKey(proPair)), '翻译文本');
});
