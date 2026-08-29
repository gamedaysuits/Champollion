#!/usr/bin/env node
/**
 * Direct provider test suite — validates OpenAI, Anthropic, Gemini methods.
 *
 * Tests cover:
 *   - Constructor and naming
 *   - Cost estimation with model variants
 *   - Quality tier and provenance
 *   - No-key early return
 *   - Coaching cache initialization
 *   - Registry lookup via getMethod()
 *   - Coaching integration: loadCoachingData, system message augmentation,
 *     dictionary hint injection, content coaching block, cache behavior
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { OpenAIMethod } from '../lib/methods/openai.js';
import { AnthropicMethod } from '../lib/methods/anthropic.js';
import { GeminiMethod } from '../lib/methods/gemini.js';
import { getMethod } from '../lib/translate.js';
import {
  loadCoachingData,
  findDictionaryMatches,
  buildCoachedSystemMessage,
  buildContentCoachingBlock,
} from '../lib/methods/llm-coached.js';
import { buildSystemMessage } from '../lib/methods/llm.js';

// Pricing is drawn live from OpenRouter in production. These tests assert
// RELATIVE cost ordering (haiku < sonnet < opus), so they pin the offline
// fallback table — otherwise a live repricing could flip an assertion and
// fail a build for a reason that has nothing to do with the code.
process.env.CHAMPOLLION_PRICING_OFFLINE = '1';

// =================================================================
// OpenAIMethod
// =================================================================
describe('OpenAIMethod', () => {
  it('has the correct name', () => {
    const method = new OpenAIMethod();
    assert.equal(method.name, 'openai');
  });

  it('initializes coaching cache', () => {
    const method = new OpenAIMethod();
    assert.ok(method._coachingCache instanceof Map, 'Should have a Map coaching cache');
    assert.equal(method._coachingCache.size, 0, 'Cache should start empty');
  });

  it('returns standard quality tier', () => {
    const method = new OpenAIMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns correct provenance', () => {
    const method = new OpenAIMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 1);
    assert.ok(prov.resources[0].name.includes('OpenAI'));
    assert.equal(prov.flags.length, 0);
  });

  it('returns cost estimate for default model', async () => {
    const method = new OpenAIMethod();
    const cost = await method.estimateCost(100);
    assert.equal(cost.currency, 'USD');
    assert.match(cost.source, /^pinned-table/);
    assert.ok(typeof cost.estimatedCost === 'number');
    assert.ok(cost.estimatedCost > 0, 'Cost should be positive');
    assert.ok(cost.note.includes('gpt-4o'));
  });

  it('returns cheaper estimate for mini model', async () => {
    const method = new OpenAIMethod();
    const fullCost = await method.estimateCost(100, { model: 'gpt-4o' });
    const miniCost = await method.estimateCost(100, { model: 'gpt-4o-mini' });
    assert.ok(miniCost.estimatedCost < fullCost.estimatedCost,
      'Mini model should be cheaper');
  });

  it('returns null when no API key is provided', async (t) => {
    // Skip if a real key exists in process.env or .env.local — the no-key
    // path can't be tested when getEnvOrFileVar finds a key via process.cwd()
    const { getEnvOrFileVar } = await import('../lib/api-key.js');
    if (getEnvOrFileVar('OPENAI_API_KEY')) return t.skip('OPENAI_API_KEY is set');

    const method = new OpenAIMethod();
    const result = await method.translate(
      ['test.key'],
      { 'test.key': 'Hello' },
      { name: 'French', register: 'Standard.', target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });

  it('returns null for translateContent when no API key is provided', async (t) => {
    const { getEnvOrFileVar } = await import('../lib/api-key.js');
    if (getEnvOrFileVar('OPENAI_API_KEY')) return t.skip('OPENAI_API_KEY is set');

    const method = new OpenAIMethod();
    const result = await method.translateContent(
      'Translate this text.',
      { name: 'French', register: 'Standard.', target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });
});

// =================================================================
// AnthropicMethod
// =================================================================
describe('AnthropicMethod', () => {
  it('has the correct name', () => {
    const method = new AnthropicMethod();
    assert.equal(method.name, 'anthropic');
  });

  it('initializes coaching cache', () => {
    const method = new AnthropicMethod();
    assert.ok(method._coachingCache instanceof Map);
    assert.equal(method._coachingCache.size, 0);
  });

  it('returns standard quality tier', () => {
    const method = new AnthropicMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns correct provenance', () => {
    const method = new AnthropicMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources[0].name.includes('Anthropic'));
  });

  it('returns cost estimate for sonnet (default)', async () => {
    const method = new AnthropicMethod();
    const cost = await method.estimateCost(100);
    assert.equal(cost.currency, 'USD');
    assert.match(cost.source, /^pinned-table/);
    assert.ok(cost.estimatedCost > 0);
    assert.ok(cost.note.includes('claude'));
  });

  it('returns cheaper estimate for haiku model', async () => {
    const method = new AnthropicMethod();
    const sonnetCost = await method.estimateCost(100, { model: 'claude-sonnet-4-6' });
    const haikuCost = await method.estimateCost(100, { model: 'claude-haiku-4-5' });
    assert.ok(haikuCost.estimatedCost < sonnetCost.estimatedCost,
      'Haiku should be cheaper than Sonnet');
  });

  it('returns more expensive estimate for opus model', async () => {
    const method = new AnthropicMethod();
    const sonnetCost = await method.estimateCost(100, { model: 'claude-sonnet-4-6' });
    const opusCost = await method.estimateCost(100, { model: 'claude-opus-4-7' });
    assert.ok(opusCost.estimatedCost > sonnetCost.estimatedCost,
      'Opus should be more expensive than Sonnet');
  });

  it('returns null when no API key is provided', async (t) => {
    const { getEnvOrFileVar } = await import('../lib/api-key.js');
    if (getEnvOrFileVar('ANTHROPIC_API_KEY')) return t.skip('ANTHROPIC_API_KEY is set');

    const method = new AnthropicMethod();
    const result = await method.translate(
      ['test.key'],
      { 'test.key': 'Hello' },
      { name: 'French', register: 'Standard.', target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });
});

// =================================================================
// GeminiMethod
// =================================================================
describe('GeminiMethod', () => {
  it('has the correct name', () => {
    const method = new GeminiMethod();
    assert.equal(method.name, 'gemini');
  });

  it('initializes coaching cache', () => {
    const method = new GeminiMethod();
    assert.ok(method._coachingCache instanceof Map);
    assert.equal(method._coachingCache.size, 0);
  });

  it('returns standard quality tier', () => {
    const method = new GeminiMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns correct provenance', () => {
    const method = new GeminiMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources[0].name.includes('Gemini'));
  });

  it('returns cost estimate for flash (default)', async () => {
    const method = new GeminiMethod();
    const cost = await method.estimateCost(100);
    assert.equal(cost.currency, 'USD');
    assert.match(cost.source, /^pinned-table/);
    assert.ok(cost.estimatedCost >= 0);
    assert.ok(cost.note.includes('gemini'));
  });

  it('returns more expensive estimate for pro model', async () => {
    const method = new GeminiMethod();
    const flashCost = await method.estimateCost(100, { model: 'gemini-2.5-flash' });
    const proCost = await method.estimateCost(100, { model: 'gemini-2.5-pro' });
    assert.ok(proCost.estimatedCost > flashCost.estimatedCost,
      'Pro should be more expensive than Flash');
  });

  it('returns null when no API key is provided', async (t) => {
    const { getEnvOrFileVar } = await import('../lib/api-key.js');
    if (getEnvOrFileVar('GEMINI_API_KEY')) return t.skip('GEMINI_API_KEY is set');

    const method = new GeminiMethod();
    const result = await method.translate(
      ['test.key'],
      { 'test.key': 'Hello' },
      { name: 'French', register: 'Standard.', target: 'fr' },
      {},
    );
    assert.equal(result, null);
  });
});

// =================================================================
// Registry integration
// =================================================================
describe('METHOD_REGISTRY — direct providers', () => {
  it('getMethod returns OpenAIMethod for "openai"', () => {
    const method = getMethod('openai');
    assert.equal(method.name, 'openai');
    assert.ok(method instanceof OpenAIMethod);
  });

  it('getMethod returns AnthropicMethod for "anthropic"', () => {
    const method = getMethod('anthropic');
    assert.equal(method.name, 'anthropic');
    assert.ok(method instanceof AnthropicMethod);
  });

  it('getMethod returns GeminiMethod for "gemini"', () => {
    const method = getMethod('gemini');
    assert.equal(method.name, 'gemini');
    assert.ok(method instanceof GeminiMethod);
  });
});

// =================================================================
// Coaching integration — functional tests
//
// These tests exercise the actual coaching code paths with real
// temp files to prove the integration works end-to-end.
// =================================================================
describe('Direct providers — coaching integration', () => {
  let tmpDir;
  let coachingDir;

  const SAMPLE_COACHING = {
    grammar_rules: ['Use formal register.', 'Avoid contractions.'],
    dictionary: {
      'welcome': 'bienvenue',
      'settings': 'paramètres',
    },
    style_notes: 'Professional tone, suitable for enterprise software.',
  };

  beforeEach(() => {
    // Create a temp directory with coaching data
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-coaching-test-'));
    coachingDir = path.join(tmpDir, '.champollion', 'coaching');
    fs.mkdirSync(coachingDir, { recursive: true });
    fs.writeFileSync(
      path.join(coachingDir, 'fr.json'),
      JSON.stringify(SAMPLE_COACHING, null, 2),
    );
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -- loadCoachingData standalone function --

  it('loadCoachingData loads and parses coaching file correctly', () => {
    const cache = new Map();
    const coaching = loadCoachingData(coachingDir, 'fr', cache);

    assert.ok(coaching, 'Should load coaching data');
    assert.deepEqual(coaching.grammar_rules, SAMPLE_COACHING.grammar_rules);
    assert.deepEqual(coaching.dictionary, SAMPLE_COACHING.dictionary);
    assert.equal(coaching.style_notes, SAMPLE_COACHING.style_notes);
  });

  it('loadCoachingData returns null for nonexistent locale', () => {
    const cache = new Map();
    const coaching = loadCoachingData(coachingDir, 'de', cache);
    assert.equal(coaching, null);
  });

  it('loadCoachingData caches results — survives file deletion', () => {
    const cache = new Map();

    // First call loads from disk
    const first = loadCoachingData(coachingDir, 'fr', cache);
    assert.ok(first);
    assert.equal(cache.size, 1, 'Cache should have 1 entry');

    // Delete the file to prove the second call uses cache, not disk
    fs.unlinkSync(path.join(coachingDir, 'fr.json'));
    const second = loadCoachingData(coachingDir, 'fr', cache);
    assert.ok(second, 'Should return cached data even after file deletion');
    assert.deepEqual(second, first);
  });

  it('loadCoachingData caches null for missing locales', () => {
    const cache = new Map();
    loadCoachingData(coachingDir, 'de', cache);
    assert.equal(cache.size, 1, 'Should cache the null result');
    assert.equal(cache.get(`${coachingDir}:de`), null);
  });

  it('loadCoachingData returns null for null/undefined locale', () => {
    const cache = new Map();
    assert.equal(loadCoachingData(coachingDir, null, cache), null);
    assert.equal(loadCoachingData(coachingDir, undefined, cache), null);
  });

  it('loadCoachingData normalizes missing fields to safe defaults', () => {
    // Write a coaching file with only grammar_rules — no dictionary or style
    fs.writeFileSync(
      path.join(coachingDir, 'de.json'),
      JSON.stringify({ grammar_rules: ['Use formal Sie form.'] }),
    );

    const cache = new Map();
    const coaching = loadCoachingData(coachingDir, 'de', cache);

    assert.ok(coaching);
    assert.deepEqual(coaching.grammar_rules, ['Use formal Sie form.']);
    assert.deepEqual(coaching.dictionary, {}, 'Missing dictionary should default to empty object');
    assert.equal(coaching.style_notes, '', 'Missing style_notes should default to empty string');
  });

  it('loadCoachingData handles malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(coachingDir, 'bad.json'), '{ not valid json');

    const cache = new Map();
    // Suppress the warning output during testing
    const origError = console.error;
    console.error = () => {};
    try {
      const coaching = loadCoachingData(coachingDir, 'bad', cache);
      assert.equal(coaching, null, 'Should return null for malformed JSON');
      assert.equal(cache.get(`${coachingDir}:bad`), null, 'Should cache null for bad file');
    } finally {
      console.error = origError;
    }
  });

  // -- buildCoachedSystemMessage vs buildSystemMessage --

  it('buildCoachedSystemMessage includes grammar rules and style notes', () => {
    const langConfig = { name: 'French', register: 'Professional.' };
    const systemMsg = buildCoachedSystemMessage(langConfig, SAMPLE_COACHING);

    assert.ok(systemMsg.includes('French'), 'Should mention language');
    assert.ok(systemMsg.includes('GRAMMAR RULES'), 'Should include grammar section');
    assert.ok(systemMsg.includes('Use formal register.'), 'Should include grammar rule');
    assert.ok(systemMsg.includes('STYLE GUIDE'), 'Should include style section');
    assert.ok(systemMsg.includes('Professional tone'), 'Should include style content');
  });

  it('standard system message does NOT contain coaching data', () => {
    const langConfig = { name: 'French', register: 'Professional.' };
    const standardMsg = buildSystemMessage(langConfig);

    assert.ok(!standardMsg.includes('GRAMMAR RULES'), 'Standard message should not have grammar');
    assert.ok(!standardMsg.includes('STYLE GUIDE'), 'Standard message should not have style');
  });

  // -- findDictionaryMatches --

  it('findDictionaryMatches finds terms in source values', () => {
    const toTranslate = {
      'hero.title': 'Welcome to our platform',
      'nav.settings': 'Account settings',
    };
    const matches = findDictionaryMatches(toTranslate, SAMPLE_COACHING.dictionary);

    assert.ok(matches.length > 0, 'Should find at least one match');
    const termNames = matches.map(m => m.term);
    assert.ok(termNames.includes('welcome') || termNames.includes('settings'),
      'Should match "welcome" or "settings"');
  });

  it('findDictionaryMatches returns empty for no matches', () => {
    const toTranslate = { 'key1': 'Something completely different' };
    const matches = findDictionaryMatches(toTranslate, SAMPLE_COACHING.dictionary);
    assert.deepEqual(matches, []);
  });

  it('findDictionaryMatches returns empty for empty dictionary', () => {
    const toTranslate = { 'key': 'Hello world' };
    assert.deepEqual(findDictionaryMatches(toTranslate, {}), []);
    assert.deepEqual(findDictionaryMatches(toTranslate, null), []);
  });

  // -- buildContentCoachingBlock --

  it('buildContentCoachingBlock includes grammar rules for content', () => {
    const block = buildContentCoachingBlock(SAMPLE_COACHING);

    assert.ok(block.includes('grammar rules'), 'Should mention grammar rules');
    assert.ok(block.includes('Use formal register.'), 'Should include rule text');
    assert.ok(block.includes('STYLE GUIDE'), 'Should include style');
  });

  it('buildContentCoachingBlock returns empty string when no coaching data', () => {
    const block = buildContentCoachingBlock({
      grammar_rules: [],
      dictionary: {},
      style_notes: '',
    });
    assert.equal(block, '', 'Should return empty string for empty coaching');
  });

  // -- Provider coaching cache integration --

  it('OpenAIMethod coaching cache is used across multiple loadCoachingData calls', () => {
    const method = new OpenAIMethod();

    // Populate the cache (simulating what translate() does internally)
    const coaching = loadCoachingData(coachingDir, 'fr', method._coachingCache);
    assert.ok(coaching, 'Should load coaching data into provider cache');
    assert.equal(method._coachingCache.size, 1, 'Provider cache should have 1 entry');

    // Load again — should hit cache
    const cached = loadCoachingData(coachingDir, 'fr', method._coachingCache);
    assert.deepEqual(cached, coaching, 'Should return same cached data');
    assert.equal(method._coachingCache.size, 1, 'Cache size should not grow');
  });

  it('each provider has independent coaching caches', () => {
    const openai = new OpenAIMethod();
    const anthropic = new AnthropicMethod();
    const gemini = new GeminiMethod();

    loadCoachingData(coachingDir, 'fr', openai._coachingCache);
    assert.equal(openai._coachingCache.size, 1);
    assert.equal(anthropic._coachingCache.size, 0, 'Anthropic cache should be independent');
    assert.equal(gemini._coachingCache.size, 0, 'Gemini cache should be independent');
  });

  it('coaching cache stores both hits and misses', () => {
    const gemini = new GeminiMethod();

    loadCoachingData(coachingDir, 'fr', gemini._coachingCache);
    assert.equal(gemini._coachingCache.size, 1);

    // Load nonexistent locale — cache grows but returns null
    const deCoaching = loadCoachingData(coachingDir, 'de', gemini._coachingCache);
    assert.equal(deCoaching, null);
    assert.equal(gemini._coachingCache.size, 2, 'Should cache both found and missing');
  });
});
