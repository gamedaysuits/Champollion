#!/usr/bin/env node
/**
 * Translation method test suite — validates the pluggable method system.
 *
 * Tests cover:
 *   - TranslationMethod base class contract
 *   - LLMMethod prompt building and key-type inference
 *   - LLMCoachedMethod fallback behavior
 *   - Method registry lookup in translate.js
 *   - Provenance reporting
 *   - Script conversion (SRO→Syllabics, Latin→Cyrillic)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { TranslationMethod } from '../lib/methods/base.js';
import { LLMMethod, buildPrompt, isUnsafeKey, inferKeyTypes } from '../lib/methods/llm.js';
import { DeepLMethod } from '../lib/methods/deepl.js';
import { LLMCoachedMethod } from '../lib/methods/llm-coached.js';
import { getMethod, METHOD_REGISTRY } from '../lib/translate.js';
import { getProvenance, isCommercialReady, auditProvenance, formatProvenanceReport } from '../lib/provenance.js';
import { sroToSyllabics, latinToCyrillicSr, convertScript, hasScriptConverter, getConverterInfo } from '../lib/scripts.js';

// =================================================================
// LLMMethod retry cascade (M3)
//
// The advertised cascade is batch → half → individual. The retry BUDGET
// (maxRetries) should gate only the recoverable batch/half RETRY ROUNDS —
// the terminal individual-key leaves must each get their one final attempt
// regardless of budget. Before the fix, every per-key call counted against
// the budget, so at defaults (maxRetries=3, batchSize=80) a single parse
// failure recovered 1 key and abandoned the other 79.
// =================================================================
describe('LLMMethod retry cascade — budget gates rounds, not per-key leaves', () => {
  it('an 80-key batch with one malformed key still translates the other 79', async () => {
    const method = new LLMMethod();

    const keys = Array.from({ length: 80 }, (_, i) => `k${i}`);
    const toTranslate = {};
    for (const k of keys) toTranslate[k] = `src-${k}`;
    const BAD_KEY = 'k42';

    // Simulate a model that:
    //   - fails to parse ANY multi-key batch (forces the split cascade), and
    //   - succeeds on single keys, EXCEPT the one genuinely-bad key.
    const batchFn = async (batch) => {
      const batchKeys = Object.keys(batch);
      if (batchKeys.length > 1) {
        return { _parseError: true };
      }
      const [key] = batchKeys;
      if (key === BAD_KEY) {
        return { _parseError: true };
      }
      return { [key]: `translated-${key}` };
    };

    // This scenario deliberately fans out into 80 per-key calls — lift the
    // fan-out cap so it exercises budget semantics, not the cap.
    const result = await withKeyFanout('100', () => method._translateWithCascade(
      toTranslate,
      { name: 'Test', register: 'neutral' },
      { maxRetries: 3, batchNum: 1, model: 'x' }, // DEFAULT_MAX_RETRIES = 3
      batchFn,
    ));

    assert.ok(result, 'cascade should recover most keys, not return null');
    const recovered = Object.keys(result);
    // All 79 good keys must come back; only the genuinely-bad key is dropped.
    assert.equal(recovered.length, 79, `expected 79 recovered, got ${recovered.length}`);
    assert.ok(!(BAD_KEY in result), 'the genuinely-malformed key is the only drop');
    assert.equal(result.k0, 'translated-k0');
    assert.equal(result.k79, 'translated-k79');
  });
});

// Run fn with CHAMPOLLION_MAX_KEY_FANOUT set (undefined = unset), restoring after.
async function withKeyFanout(value, fn) {
  const prev = process.env.CHAMPOLLION_MAX_KEY_FANOUT;
  if (value === undefined) delete process.env.CHAMPOLLION_MAX_KEY_FANOUT;
  else process.env.CHAMPOLLION_MAX_KEY_FANOUT = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.CHAMPOLLION_MAX_KEY_FANOUT;
    else process.env.CHAMPOLLION_MAX_KEY_FANOUT = prev;
  }
}

// =================================================================
// LLMMethod per-key fan-out cap (CHAMPOLLION_MAX_KEY_FANOUT)
//
// After half-batch parse failures, the cascade falls back to one API call
// per key. The cap bounds those terminal calls across the whole cascade
// invocation: at most N individual calls, ONE summary warn, and skipped
// keys simply absent from the result (→ existing failed-key retry lane).
// =================================================================
describe('LLMMethod per-key fan-out cap', () => {
  function makeUnparseableWorld(keyCount) {
    const toTranslate = {};
    for (let i = 0; i < keyCount; i++) toTranslate[`k${i}`] = `src-k${i}`;
    let singleCalls = 0;
    // Multi-key batches never parse; single keys succeed (counted).
    const batchFn = async (batch) => {
      const batchKeys = Object.keys(batch);
      if (batchKeys.length > 1) return { _parseError: true };
      singleCalls++;
      return { [batchKeys[0]]: `translated-${batchKeys[0]}` };
    };
    return { toTranslate, batchFn, getSingleCalls: () => singleCalls };
  }

  function captureWarns() {
    const warns = [];
    const realError = console.error;
    console.error = (msg) => { warns.push(String(msg)); };
    return { warns, restore: () => { console.error = realError; } };
  }

  it('defaults to 16 individual calls and warns once about the skipped keys', async () => {
    const method = new LLMMethod();
    const { toTranslate, batchFn, getSingleCalls } = makeUnparseableWorld(40);

    const { warns, restore } = captureWarns();
    let result;
    try {
      result = await withKeyFanout(undefined, () => method._translateWithCascade(
        toTranslate,
        { name: 'Test', register: 'neutral' },
        { maxRetries: 3, batchNum: 1, model: 'x' },
        batchFn,
      ));
    } finally {
      restore();
    }

    assert.equal(getSingleCalls(), 16, 'individual calls must stop at the default cap');
    assert.ok(result, 'the capped keys that DID run must still come back');
    assert.equal(Object.keys(result).length, 16);

    const capWarns = warns.filter((w) => w.includes('CHAMPOLLION_MAX_KEY_FANOUT'));
    assert.equal(capWarns.length, 1, `expected exactly one cap summary warn, got: ${JSON.stringify(capWarns)}`);
    assert.ok(capWarns[0].includes('16 key(s) translated individually'), capWarns[0]);
    assert.ok(capWarns[0].includes('24 skipped'), capWarns[0]);
    assert.ok(capWarns[0].includes('retry next sync'), capWarns[0]);
  });

  it('honors an explicit cap value', async () => {
    const method = new LLMMethod();
    const { toTranslate, batchFn, getSingleCalls } = makeUnparseableWorld(12);

    const { restore } = captureWarns();
    let result;
    try {
      result = await withKeyFanout('5', () => method._translateWithCascade(
        toTranslate,
        { name: 'Test', register: 'neutral' },
        { maxRetries: 3, batchNum: 1, model: 'x' },
        batchFn,
      ));
    } finally {
      restore();
    }

    assert.equal(getSingleCalls(), 5);
    assert.equal(Object.keys(result).length, 5);
  });

  it('0 disables the per-key fallback entirely (zero individual calls)', async () => {
    const method = new LLMMethod();
    const { toTranslate, batchFn, getSingleCalls } = makeUnparseableWorld(8);

    const { warns, restore } = captureWarns();
    let result;
    try {
      result = await withKeyFanout('0', () => method._translateWithCascade(
        toTranslate,
        { name: 'Test', register: 'neutral' },
        { maxRetries: 3, batchNum: 1, model: 'x' },
        batchFn,
      ));
    } finally {
      restore();
    }

    assert.equal(getSingleCalls(), 0, 'no individual calls with fan-out disabled');
    assert.equal(result, null, 'nothing recovered → null → failed-key machinery');
    const capWarns = warns.filter((w) => w.includes('CHAMPOLLION_MAX_KEY_FANOUT'));
    assert.equal(capWarns.length, 1);
    assert.ok(capWarns[0].includes('8 skipped'), capWarns[0]);
  });
});

// =================================================================
// getSetupHelp reads .env.local, not bare process.env (L11)
//
// A key that lives only in .env.local (not exported to the shell) must be
// discovered by getSetupHelp — otherwise, after a real 401, the CLI wrongly
// reports "Missing API Key" and points the user at the wrong fix.
// =================================================================
describe('getSetupHelp respects .env.local (not just process.env)', () => {
  function withEnvLocal(keyName, keyValue, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-l11-'));
    const prevCwd = process.cwd();
    const hadEnv = Object.prototype.hasOwnProperty.call(process.env, keyName);
    const prevEnv = process.env[keyName];
    // Ensure the key is NOT in the environment — only in the file.
    delete process.env[keyName];
    try {
      fs.writeFileSync(path.join(dir, '.env.local'), `${keyName}=${keyValue}\n`, 'utf-8');
      process.chdir(dir);
      return fn();
    } finally {
      process.chdir(prevCwd);
      if (hadEnv) process.env[keyName] = prevEnv;
      else delete process.env[keyName];
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('LLMMethod: key only in .env.local is NOT reported as missing', () => {
    const help = withEnvLocal('OPENROUTER_API_KEY', 'sk-or-v1-fromfile', () => {
      return new LLMMethod().getSetupHelp();
    });
    const text = help.join('\n');
    assert.doesNotMatch(text, /Missing API Key/i,
      'A key present in .env.local must not be reported as missing');
  });

  it('DeepLMethod: key only in .env.local is NOT reported as missing', () => {
    const help = withEnvLocal('DEEPL_API_KEY', 'deepl-fromfile:fx', () => {
      return new DeepLMethod().getSetupHelp();
    });
    const text = help.join('\n');
    assert.doesNotMatch(text, /Missing API Key/i,
      'A key present in .env.local must not be reported as missing');
  });

  it('LLMMethod: still reports Missing API Key when no key anywhere', () => {
    const prevCwd = process.cwd();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-l11-empty-'));
    const had = Object.prototype.hasOwnProperty.call(process.env, 'OPENROUTER_API_KEY');
    const prev = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      process.chdir(dir);
      const text = new LLMMethod().getSetupHelp().join('\n');
      assert.match(text, /Missing API Key/i);
    } finally {
      process.chdir(prevCwd);
      if (had) process.env.OPENROUTER_API_KEY = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =================================================================
// TranslationMethod base class
// =================================================================
describe('TranslationMethod base class', () => {
  it('throws on unimplemented translate()', async () => {
    const base = new TranslationMethod('test');
    await assert.rejects(
      () => base.translate([], {}, {}, {}),
      { message: /not implemented by test/ }
    );
  });

  it('returns null for unsupported translateContent()', async () => {
    const base = new TranslationMethod('test');
    const result = await base.translateContent('prompt', {}, {});
    assert.equal(result, null);
  });

  it('returns unknown cost estimate by default', () => {
    const base = new TranslationMethod('test');
    const cost = base.estimateCost(100);
    assert.equal(cost.estimatedCost, null, 'Unknown methods return null, not zero');
    assert.equal(cost.currency, 'USD');
    assert.equal(cost.source, 'none');
  });

  it('returns standard quality tier by default', () => {
    const base = new TranslationMethod('test');
    assert.equal(base.getQualityTier(), 'standard');
  });

  it('returns clean provenance by default', () => {
    const base = new TranslationMethod('test');
    const prov = base.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 0);
    assert.equal(prov.flags.length, 0);
  });
});

// =================================================================
// LLMMethod
// =================================================================
describe('LLMMethod', () => {
  it('has the correct name', () => {
    const method = new LLMMethod();
    assert.equal(method.name, 'llm');
  });

  it('returns standard quality tier', () => {
    const method = new LLMMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns cost estimate from OpenRouter pricing', async () => {
    const method = new LLMMethod();
    const cost = await method.estimateCost(100);
    // The pricing module fetches from OpenRouter. If online, returns a real
    // number; if offline, returns null. Either way, the shape is valid.
    assert.equal(cost.currency, 'USD');
    assert.ok(typeof cost.source === 'string' && cost.source.length > 0);
    assert.ok(typeof cost.note === 'string' && cost.note.length > 0, 'Should include explanatory note');
  });

  it('returns null when no API key is provided', async () => {
    const method = new LLMMethod();
    const result = await method.translate(['test.key'], { 'test.key': 'Hello' }, {
      name: 'French',
      register: 'Standard.',
    }, { apiKey: null });
    assert.equal(result, null);
  });
});

// =================================================================
// LLMCoachedMethod
// =================================================================
describe('LLMCoachedMethod', () => {
  it('has the correct name', () => {
    const method = new LLMCoachedMethod();
    assert.equal(method.name, 'llm-coached');
  });

  it('returns high quality tier', () => {
    const method = new LLMCoachedMethod();
    assert.equal(method.getQualityTier(), 'high');
  });

  it('returns cost estimate with coaching overhead', async () => {
    const coached = new LLMCoachedMethod();
    const cost = await coached.estimateCost(100);
    // Coached uses the same OpenRouter pricing but with a 2.5x input multiplier.
    assert.equal(cost.currency, 'USD');
    assert.ok(typeof cost.source === 'string' && cost.source.length > 0);
  });
});

// =================================================================
// Method Registry
// =================================================================
describe('METHOD_REGISTRY', () => {
  it('contains llm method', () => {
    assert.ok(METHOD_REGISTRY['llm']);
  });

  it('contains llm-coached method', () => {
    assert.ok(METHOD_REGISTRY['llm-coached']);
  });

  it('getMethod returns LLMMethod for "llm"', () => {
    const method = getMethod('llm');
    assert.equal(method.name, 'llm');
  });

  it('getMethod returns LLMCoachedMethod for "llm-coached"', () => {
    const method = getMethod('llm-coached');
    assert.equal(method.name, 'llm-coached');
  });

  it('getMethod throws descriptive error for unknown methods', () => {
    assert.throws(
      () => getMethod('nonexistent'),
      /Unknown translation method "nonexistent"/,
    );
  });
});

// =================================================================
// Provenance
// =================================================================
describe('Provenance', () => {
  it('llm method is commercially ready', () => {
    assert.equal(isCommercialReady('llm'), true);
  });

  it('fst-gated method is not commercially ready', () => {
    assert.equal(isCommercialReady('fst-gated'), false);
  });

  it('unknown methods default to NOT commercially ready (fail-safe)', () => {
    // Reversed 2026-08-12 with the routing-time gate: an unrecorded method
    // must not be silently cleared for a commercial route. See
    // lib/commercial-eligibility.js rule 4.
    assert.equal(isCommercialReady('totally-new-method'), false);
  });

  it('auditProvenance flags blocked pairs', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm' }],
      ['en:crk', { method: 'fst-gated' }],
    ]);

    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, false);
    assert.ok(audit.blockedPairs.includes('en:crk'));
    assert.ok(audit.flags.includes('PROPRIETARY_DATASET'));
  });

  it('auditProvenance returns allClear for clean configs', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm' }],
      ['en:de', { method: 'llm' }],
    ]);

    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, true);
    assert.equal(audit.blockedPairs.length, 0);
  });

  it('formatProvenanceReport produces readable output', () => {
    const pairs = new Map([
      ['en:crk', { method: 'fst-gated' }],
    ]);

    const report = formatProvenanceReport(pairs);
    assert.ok(report.includes('PROVENANCE WARNINGS'));
    assert.ok(report.includes('fst-gated'));
  });
});

// =================================================================
// Script Converters
// =================================================================
describe('Script converters', () => {
  it('sroToSyllabics converts basic syllables', () => {
    // "ni" → ᓂ, "ya" → ᔭ
    const result = sroToSyllabics('niya');
    assert.ok(result.includes('ᓂ'), 'Should convert ni');
    assert.ok(result.includes('ᔭ'), 'Should convert ya');
  });

  it('sroToSyllabics handles the th digraph', () => {
    // "th" should map to ᖧ, not ᐟᐦ (t+h separately)
    const result = sroToSyllabics('th');
    assert.equal(result, 'ᖧ');
  });

  it('sroToSyllabics preserves spaces and punctuation', () => {
    const result = sroToSyllabics('ni, ka.');
    assert.ok(result.includes(','), 'Should preserve comma');
    assert.ok(result.includes('.'), 'Should preserve period');
    assert.ok(result.includes(' '), 'Should preserve space');
  });

  it('latinToCyrillicSr converts basic text', () => {
    assert.equal(latinToCyrillicSr('a'), 'а');
    assert.equal(latinToCyrillicSr('b'), 'б');
  });

  it('latinToCyrillicSr handles digraphs', () => {
    assert.equal(latinToCyrillicSr('lj'), 'љ');
    assert.equal(latinToCyrillicSr('nj'), 'њ');
    assert.equal(latinToCyrillicSr('dž'), 'џ');
  });

  it('latinToCyrillicSr preserves non-mapped characters', () => {
    const result = latinToCyrillicSr('test 123!');
    assert.ok(result.includes('123'));
    assert.ok(result.includes('!'));
  });

  it('convertScript uses the correct converter for crk', () => {
    const result = convertScript('ni', 'crk');
    assert.equal(result.converterUsed, 'SRO (Standard Roman Orthography) → Cree Syllabics');
    assert.ok(result.converted !== 'ni', 'Should be converted');
  });

  it('convertScript passes through for unknown locales', () => {
    const result = convertScript('hello', 'xx-unknown');
    assert.equal(result.converted, 'hello');
    assert.equal(result.converterUsed, null);
  });

  it('hasScriptConverter returns true for registered locales', () => {
    assert.equal(hasScriptConverter('crk'), true);
    assert.equal(hasScriptConverter('sr'), true);
  });

  it('hasScriptConverter returns false for unregistered locales', () => {
    assert.equal(hasScriptConverter('fr'), false);
  });

  it('getConverterInfo returns safe-to-serialize info', () => {
    const info = getConverterInfo('crk');
    assert.ok(info);
    assert.equal(info.type, 'deterministic');
    assert.ok(!info.converter, 'Should not include function reference');
  });

  it('getConverterInfo returns null for unknown locales', () => {
    assert.equal(getConverterInfo('xx'), null);
  });
});
