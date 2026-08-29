import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import {
  LLMCoachedMethod,
  buildCoachedPrompt,
  buildContentCoachingBlock,
  findDictionaryMatches,
  DEFAULT_COACHING_DIR,
} from '../lib/methods/llm-coached.js';
import { LLMMethod } from '../lib/methods/llm.js';

// -----------------------------------------------------------------
// findDictionaryMatches
// -----------------------------------------------------------------

describe('llm-coached — findDictionaryMatches', () => {
  it('finds terms present in source values', () => {
    const toTranslate = {
      'settings.title': 'Dashboard settings',
      'deploy.button': 'Deploy now',
    };
    const dictionary = {
      'dashboard': 'tableau de bord',
      'deploy': 'déployer',
      'widget': 'widget',
    };

    const matches = findDictionaryMatches(toTranslate, dictionary);

    assert.equal(matches.length, 2);
    const terms = matches.map(m => m.term);
    assert.ok(terms.includes('dashboard'));
    assert.ok(terms.includes('deploy'));
  });

  it('matches case-insensitively', () => {
    const toTranslate = {
      'title': 'Welcome to the Dashboard',
    };
    const dictionary = {
      'dashboard': 'tableau de bord',
    };

    const matches = findDictionaryMatches(toTranslate, dictionary);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].term, 'dashboard');
  });

  it('returns empty array for empty dictionary', () => {
    const toTranslate = { 'key': 'value' };
    assert.deepEqual(findDictionaryMatches(toTranslate, {}), []);
    assert.deepEqual(findDictionaryMatches(toTranslate, null), []);
  });

  it('deduplicates matched terms', () => {
    const toTranslate = {
      'a': 'Dashboard overview',
      'b': 'Dashboard settings',
    };
    const dictionary = {
      'dashboard': 'tableau de bord',
    };

    const matches = findDictionaryMatches(toTranslate, dictionary);

    // "dashboard" appears in both values but should only be listed once
    assert.equal(matches.length, 1);
  });
});

// -----------------------------------------------------------------
// buildCoachedPrompt
// -----------------------------------------------------------------

describe('llm-coached — buildCoachedPrompt', () => {
  it('includes standard translation instructions', () => {
    const prompt = buildCoachedPrompt(
      { 'hero.title': 'Welcome' },
      { name: 'French', register: 'formal' },
      { grammar_rules: [], dictionary: {}, style_notes: '' }
    );

    assert.ok(prompt.includes('English to French'));
    assert.ok(prompt.includes('formal'));
    assert.ok(prompt.includes('"hero.title": "Welcome"'));
  });

  it('injects grammar rules into coaching context', () => {
    const coaching = {
      grammar_rules: [
        'Adjectives agree in gender and number',
        'Use vous for formal contexts',
      ],
      dictionary: {},
      style_notes: '',
    };

    const prompt = buildCoachedPrompt(
      { 'key': 'value' },
      { name: 'French', register: 'formal' },
      coaching
    );

    assert.ok(prompt.includes('GRAMMAR RULES'));
    assert.ok(prompt.includes('Adjectives agree'));
    assert.ok(prompt.includes('vous for formal'));
  });

  it('injects style notes into coaching context', () => {
    const coaching = {
      grammar_rules: [],
      dictionary: {},
      style_notes: 'Prefer active voice. Avoid anglicisms.',
    };

    const prompt = buildCoachedPrompt(
      { 'key': 'value' },
      { name: 'French', register: 'formal' },
      coaching
    );

    assert.ok(prompt.includes('STYLE GUIDE'));
    assert.ok(prompt.includes('Prefer active voice'));
  });

  it('injects matched dictionary terms as required terminology', () => {
    const coaching = {
      grammar_rules: [],
      dictionary: {
        'dashboard': 'tableau de bord',
        'settings': 'paramètres',
        'deploy': 'déployer',
      },
      style_notes: '',
    };

    const prompt = buildCoachedPrompt(
      { 'title': 'Dashboard settings' },
      { name: 'French', register: 'formal' },
      coaching
    );

    assert.ok(prompt.includes('REQUIRED TERMINOLOGY'));
    assert.ok(prompt.includes('"dashboard" → "tableau de bord"'));
    assert.ok(prompt.includes('"settings" → "paramètres"'));
    // "deploy" should NOT be in the prompt — it doesn't match any source value
    assert.ok(!prompt.includes('"deploy"'));
  });

  it('omits coaching block when all coaching data is empty', () => {
    const prompt = buildCoachedPrompt(
      { 'key': 'value' },
      { name: 'French', register: 'formal' },
      { grammar_rules: [], dictionary: {}, style_notes: '' }
    );

    assert.ok(!prompt.includes('COACHING CONTEXT'));
  });

  it('includes UI type hints from key inference', () => {
    const prompt = buildCoachedPrompt(
      { 'forms.submit.button': 'Submit form' },
      { name: 'French', register: 'formal' },
      { grammar_rules: [], dictionary: {}, style_notes: '' }
    );

    assert.ok(prompt.includes('button label'));
  });
});

// -----------------------------------------------------------------
// buildContentCoachingBlock
// -----------------------------------------------------------------

describe('llm-coached — buildContentCoachingBlock', () => {
  it('includes grammar rules and style notes', () => {
    const coaching = {
      grammar_rules: ['Rule one', 'Rule two'],
      dictionary: { 'ignored': 'for content' },
      style_notes: 'Keep it natural.',
    };

    const block = buildContentCoachingBlock(coaching);

    assert.ok(block.includes('Rule one'));
    assert.ok(block.includes('Rule two'));
    assert.ok(block.includes('Keep it natural'));
    // Dictionary is NOT included in content coaching
    assert.ok(!block.includes('ignored'));
  });

  it('returns empty string when no coaching data', () => {
    const block = buildContentCoachingBlock({
      grammar_rules: [],
      dictionary: {},
      style_notes: '',
    });

    assert.equal(block, '');
  });
});

// -----------------------------------------------------------------
// LLMCoachedMethod — coaching data loading
// -----------------------------------------------------------------

describe('llm-coached — coaching data loading', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-coaching-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('loads valid coaching data', () => {
    const coachingData = {
      grammar_rules: ['Test rule'],
      dictionary: { 'hello': 'bonjour' },
      style_notes: 'Be concise.',
    };
    fs.writeFileSync(
      path.join(tmpDir, 'fr.json'),
      JSON.stringify(coachingData),
      'utf-8'
    );

    const method = new LLMCoachedMethod();
    const loaded = method._loadCoachingData(tmpDir, 'fr');

    assert.deepEqual(loaded.grammar_rules, ['Test rule']);
    assert.deepEqual(loaded.dictionary, { 'hello': 'bonjour' });
    assert.equal(loaded.style_notes, 'Be concise.');
  });

  it('returns null when coaching file does not exist', () => {
    const method = new LLMCoachedMethod();
    const loaded = method._loadCoachingData(tmpDir, 'nonexistent');

    assert.equal(loaded, null);
  });

  it('returns null for null locale', () => {
    const method = new LLMCoachedMethod();
    assert.equal(method._loadCoachingData(tmpDir, null), null);
    assert.equal(method._loadCoachingData(tmpDir, undefined), null);
  });

  it('handles malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{ invalid json }', 'utf-8');

    const method = new LLMCoachedMethod();
    const loaded = method._loadCoachingData(tmpDir, 'bad');

    assert.equal(loaded, null);
  });

  it('normalizes missing fields to safe defaults', () => {
    // Coaching file with only some fields
    fs.writeFileSync(
      path.join(tmpDir, 'partial.json'),
      JSON.stringify({ grammar_rules: ['One rule'] }),
      'utf-8'
    );

    const method = new LLMCoachedMethod();
    const loaded = method._loadCoachingData(tmpDir, 'partial');

    assert.deepEqual(loaded.grammar_rules, ['One rule']);
    assert.deepEqual(loaded.dictionary, {});
    assert.equal(loaded.style_notes, '');
  });

  it('caches loaded coaching data', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'cached.json'),
      JSON.stringify({ grammar_rules: ['Cached rule'] }),
      'utf-8'
    );

    const method = new LLMCoachedMethod();

    // First load
    const first = method._loadCoachingData(tmpDir, 'cached');
    assert.deepEqual(first.grammar_rules, ['Cached rule']);

    // Delete the file — should still return cached value
    fs.unlinkSync(path.join(tmpDir, 'cached.json'));
    const second = method._loadCoachingData(tmpDir, 'cached');
    assert.deepEqual(second.grammar_rules, ['Cached rule']);
  });
});

// -----------------------------------------------------------------
// LLMCoachedMethod — interface compliance
// -----------------------------------------------------------------

describe('llm-coached — TranslationMethod interface', () => {
  it('has name "llm-coached"', () => {
    const method = new LLMCoachedMethod();
    assert.equal(method.name, 'llm-coached');
  });

  it('returns quality tier "high"', () => {
    const method = new LLMCoachedMethod();
    assert.equal(method.getQualityTier(), 'high');
  });

  it('returns provenance with coaching data resource', () => {
    const method = new LLMCoachedMethod();
    const prov = method.getProvenance();

    assert.equal(prov.commercialReady, true);
    assert.ok(prov.resources.length > 0);
    assert.ok(prov.resources[0].name.includes('coaching'));
  });

  it('acknowledges cost is model-dependent with coaching overhead', async () => {

    const coached = new LLMCoachedMethod();
    const coachedCost = await coached.estimateCost(100);

    // Now uses live OpenRouter pricing — returns real cost when online,
    // null when offline. Either way, the shape contract is valid.
    assert.equal(coachedCost.currency, 'USD');
    assert.ok(typeof coachedCost.source === 'string' && coachedCost.source.length > 0);
    assert.ok(typeof coachedCost.note === 'string' && coachedCost.note.length > 0,
      'Note should be present');
  });
});

// -----------------------------------------------------------------
// DEFAULT_COACHING_DIR
// -----------------------------------------------------------------

describe('llm-coached — DEFAULT_COACHING_DIR', () => {
  it('is .champollion/coaching', () => {
    assert.equal(DEFAULT_COACHING_DIR, '.champollion/coaching');
  });
});
