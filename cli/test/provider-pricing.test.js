import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  LLM_RATES,
  estimateLlmCost,
  toOpenRouterId,
  pricingOffline,
} from '../lib/methods/provider-pricing.js';
import { AnthropicMethod } from '../lib/methods/anthropic.js';
import { OpenAIMethod } from '../lib/methods/openai.js';
import { GeminiMethod } from '../lib/methods/gemini.js';
import { EST_INPUT_TOKENS_PER_KEY, EST_OUTPUT_TOKENS_PER_KEY } from '../lib/config.js';

// The direct-LLM providers used to guess their per-token rate by substring
// (`model.includes('opus')` → $15/$75). That mispriced two ways: an
// unrecognized model silently got a tier default as though it were verified,
// and a repriced model kept a rate that no longer existed — Anthropic's opus
// branch was still charging retired Claude 3 Opus rates, a 3x overestimate
// presented to the user as fact.
//
// Rates are now DRAWN LIVE from OpenRouter with the table as an offline
// fallback, because the static table drifted too: on 2026-08-01 three rows
// disagreed with live, and gemini-2.5-flash was a 4x UNDER-estimate on output
// — the direction that lets a `--max-cost` run pass a cap it should fail.
//
// These tests run with CHAMPOLLION_PRICING_OFFLINE=1 so they are deterministic
// and make NO network calls; they pin the fallback table, the honest unknown,
// and the cross-provider guard. The id-mapping test below is pure string work
// and needs no network either.

let priorOffline;
before(() => {
  priorOffline = process.env.CHAMPOLLION_PRICING_OFFLINE;
  process.env.CHAMPOLLION_PRICING_OFFLINE = '1';
});
after(() => {
  if (priorOffline === undefined) delete process.env.CHAMPOLLION_PRICING_OFFLINE;
  else process.env.CHAMPOLLION_PRICING_OFFLINE = priorOffline;
});

describe('estimateLlmCost — exact-ID pricing, honest unknowns', () => {
  it('the suite really is offline, so nothing below can depend on the network', () => {
    assert.equal(pricingOffline(), true);
  });

  it('an unpriced model is UNKNOWN, never a substring guess and never $0', async () => {
    // Retired Claude 3 Opus. The old code matched `.includes('opus')` and
    // confidently priced it; there is no verified rate for it now.
    const r = await estimateLlmCost('anthropic', 'claude-3-opus-20240229', 1000);
    assert.equal(r.estimatedCost, null, 'must be null (unknown), not a number');
    assert.notEqual(r.estimatedCost, 0, 'unknown must never collapse to $0');
    assert.equal(r.source, 'anthropic-pricing-unknown');
    assert.match(r.note, /UNKNOWN \(not \$0\)/);
  });

  it('a model priced for another provider does not leak across providers', async () => {
    // gpt-4o is in the table, but not as an Anthropic model. The live draw
    // must not route around this guard via openai/gpt-4o either.
    const r = await estimateLlmCost('anthropic', 'gpt-4o', 1000);
    assert.equal(r.estimatedCost, null);
    assert.equal(r.source, 'anthropic-pricing-unknown');
  });

  it('prices a known model from its exact row when offline', async () => {
    const rate = LLM_RATES['claude-opus-4-8'];
    const expected =
      (1000 * EST_INPUT_TOKENS_PER_KEY * rate.input +
       1000 * EST_OUTPUT_TOKENS_PER_KEY * rate.output) / 1_000_000;

    const r = await estimateLlmCost('anthropic', 'claude-opus-4-8', 1000);
    assert.equal(r.estimatedCost, Math.round(expected * 10000) / 10000);
    assert.match(r.source, /^pinned-table/);
    assert.match(r.source, /live draw unavailable/);
  });

  it('the offline source says whether the pinned row was ever verified', async () => {
    const r = await estimateLlmCost('anthropic', 'claude-opus-4-8', 1000);
    assert.match(r.source, /verified 2026-/, 'a dated row must disclose its date');
  });

  it('current Opus is $5/$25 — NOT the retired Claude 3 Opus $15/$75', () => {
    // The specific regression: a 3x overestimate shown to the user as fact.
    for (const id of ['claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6']) {
      assert.equal(LLM_RATES[id].input, 5.00, `${id} input rate`);
      assert.equal(LLM_RATES[id].output, 25.00, `${id} output rate`);
    }
  });

  it('gemini-2.5-flash output is $2.50/1M — the 4x under-estimate is gone', () => {
    // Pinned at $0.60 until 2026-08-01. An under-estimate is the dangerous
    // direction: it lets a capped run exceed its cap.
    assert.equal(LLM_RATES['gemini-2.5-flash'].output, 2.50);
    assert.equal(LLM_RATES['gemini-2.5-flash'].input, 0.30);
  });

  it('every rate row is well-formed, positive, and dated', () => {
    for (const [id, rate] of Object.entries(LLM_RATES)) {
      assert.ok(['anthropic', 'openai', 'gemini'].includes(rate.provider), `${id} provider`);
      assert.ok(Number.isFinite(rate.input) && rate.input > 0, `${id} input`);
      assert.ok(Number.isFinite(rate.output) && rate.output > 0, `${id} output`);
      assert.ok(rate.output >= rate.input, `${id}: output should not be cheaper than input`);
      // An undated row is how the two wrong blocks survived. Every fallback
      // row must carry the date somebody last checked it.
      assert.match(rate.verified ?? '', /^\d{4}-\d{2}-\d{2}$/, `${id} needs a verified date`);
    }
  });
});

describe('toOpenRouterId — the mapping the live draw depends on', () => {
  // Verified against all 337 live OpenRouter models on 2026-08-01.
  it('writes Anthropic point releases with a dot, not a hyphen', () => {
    assert.equal(toOpenRouterId('claude-sonnet-4-6'), 'anthropic/claude-sonnet-4.6');
    assert.equal(toOpenRouterId('claude-haiku-4-5'), 'anthropic/claude-haiku-4.5');
    assert.equal(toOpenRouterId('claude-opus-4-8'), 'anthropic/claude-opus-4.8');
  });

  it('passes single-segment Anthropic versions through unchanged', () => {
    assert.equal(toOpenRouterId('claude-opus-5'), 'anthropic/claude-opus-5');
    assert.equal(toOpenRouterId('claude-sonnet-5'), 'anthropic/claude-sonnet-5');
  });

  it('prefixes OpenAI and Google 1:1', () => {
    assert.equal(toOpenRouterId('gpt-4o-mini'), 'openai/gpt-4o-mini');
    assert.equal(toOpenRouterId('gemini-2.5-pro'), 'google/gemini-2.5-pro');
  });

  it('returns null for an unrecognised family rather than inventing an id', () => {
    assert.equal(toOpenRouterId('llama-3-70b'), null);
    assert.equal(toOpenRouterId(''), null);
    assert.equal(toOpenRouterId(undefined), null);
  });

  it('maps every pinned row to a namespace matching its provider', () => {
    const ns = { anthropic: 'anthropic/', openai: 'openai/', gemini: 'google/' };
    for (const [id, rate] of Object.entries(LLM_RATES)) {
      const orId = toOpenRouterId(id);
      assert.ok(orId, `${id} must map to an OpenRouter id`);
      assert.ok(orId.startsWith(ns[rate.provider]), `${id} → ${orId} wrong namespace`);
    }
  });
});

describe('direct-LLM methods delegate to the pricing SSOT', () => {
  // Each provider previously named its default model TWICE — in
  // _getDefaultModel() and again as an inline `pairConfig.model || '...'`
  // fallback inside estimateCost() — so the two could drift and price a run
  // against a model it did not use. One constant now feeds both.
  const CASES = [
    ['anthropic', new AnthropicMethod()],
    ['openai', new OpenAIMethod()],
    ['gemini', new GeminiMethod()],
  ];

  for (const [provider, method] of CASES) {
    it(`${provider}: the default model is priced, and named in exactly one place`, async () => {
      const def = method._getDefaultModel();
      assert.ok(LLM_RATES[def], `default model "${def}" has no rate row`);
      assert.equal(LLM_RATES[def].provider, provider);

      // Omitting the model must price the SAME model _getDefaultModel() reports.
      const viaDefault = await method.estimateCost(1000, {});
      const viaExplicit = await method.estimateCost(1000, { model: def });
      assert.equal(viaDefault.estimatedCost, viaExplicit.estimatedCost);
      assert.match(viaDefault.source, /^pinned-table/);
    });

    it(`${provider}: an unknown model returns unknown, not a tier guess`, async () => {
      const r = await method.estimateCost(1000, { model: 'definitely-not-a-real-model' });
      assert.equal(r.estimatedCost, null);
      assert.equal(r.source, `${provider}-pricing-unknown`);
    });
  }

  it('gemini still discloses the free tier on a priced estimate only', async () => {
    const g = new GeminiMethod();
    assert.match((await g.estimateCost(1000, {})).note, /Free tier may apply/);
    // An unknown estimate must not claim a free tier applies to a price we
    // never computed.
    assert.doesNotMatch(
      (await g.estimateCost(1000, { model: 'nope' })).note,
      /Free tier may apply/,
    );
  });
});
