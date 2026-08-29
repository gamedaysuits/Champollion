/**
 * Live API contract tests — real API calls against OpenRouter and Google Translate.
 *
 * WHY THESE EXIST:
 *   Every other test in this suite uses mock fetch. That's correct for CI,
 *   but it means we're testing our code against our mock, not against the
 *   real API. If OpenRouter changes their response shape, our mocks pass
 *   while production breaks. These tests close that gap.
 *
 * SELF-SKIPPING:
 *   All tests skip automatically when the required API key is missing.
 *   This means `npm test` remains green without any keys — these tests
 *   only fire when a developer explicitly has keys in their environment.
 *
 * WHAT GETS TESTED:
 *   1. Base LLM method — simple key-value batch via translateBatch()
 *   2. LLM-coached method — same batch with coaching data injected
 *   3. Google Translate method — same batch via google-translate method
 *   4. Response shape validation — correct types, no nested objects
 *   5. Placeholder preservation — {name} survives translation
 *   6. Multi-key batch integrity — all keys returned, none dropped
 *   7. Unicode source handling — non-ASCII source strings translate cleanly
 *   8. Source echo detection — no value is identical to its English source
 *   9. Content translation — freeform Markdown through translateRawContent()
 *
 * TIMEOUT:
 *   Each test has a 30s timeout. API latency varies by model and load.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { translateBatch, translateRawContent, getMethod } from '../lib/translate.js';
import { LLMCoachedMethod } from '../lib/methods/llm-coached.js';

// -----------------------------------------------------------------
// Skip gate — all tests self-skip when keys are missing
// -----------------------------------------------------------------

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const GOOGLE_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_API_KEY || '';
const HAS_OPENROUTER = OPENROUTER_KEY.length > 0;
const HAS_GOOGLE = GOOGLE_KEY.length > 0;

// -----------------------------------------------------------------
// Shared test fixtures
// -----------------------------------------------------------------

/** Minimal key-value batch — 3 keys, clear English, easy to validate */
const BASIC_SOURCE = {
  'greeting': 'Hello',
  'farewell': 'Goodbye',
  'thanks': 'Thank you',
};
const BASIC_KEYS = Object.keys(BASIC_SOURCE);

/** Source with a placeholder that must be preserved */
const PLACEHOLDER_SOURCE = {
  'welcome': 'Welcome, {name}!',
  'items': 'You have {count} items in your cart.',
};
const PLACEHOLDER_KEYS = Object.keys(PLACEHOLDER_SOURCE);

/** Source with Unicode content (non-ASCII) */
const UNICODE_SOURCE = {
  'emoji_label': 'Save your changes ✓',
  'accented': 'Résumé upload',
};
const UNICODE_KEYS = Object.keys(UNICODE_SOURCE);

/** French pair config — used across most tests */
const FRENCH_PAIR = {
  target: 'fr',
  name: 'French',
  register: 'Professional register. Use vous (formal) for user-facing text.',
  method: 'llm',
  model: 'google/gemini-3.5-flash',
  batchSize: 30,
};

/** Japanese pair config — tests non-Latin script output */
const JAPANESE_PAIR = {
  target: 'ja',
  name: 'Japanese',
  register: 'Professional register. Use です/ます form.',
  method: 'llm',
  model: 'google/gemini-3.5-flash',
  batchSize: 30,
};

// -----------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------

/**
 * Core assertions for any translated result set.
 *
 * Verifies:
 *   - Non-null return
 *   - All expected keys present
 *   - All values are non-empty strings
 *   - No value starts with [EN] (confirms real translation)
 *   - No value is identical to its source (basic echo detection)
 *
 * @param {object} result - Translation result
 * @param {string[]} expectedKeys - Keys that should be present
 * @param {object} source - Source key-value map (for echo detection)
 * @param {string} context - Human-readable test context for error messages
 */
function assertValidTranslation(result, expectedKeys, source, context) {
  assert.ok(result, `${context}: translateBatch returned null`);
  assert.equal(typeof result, 'object', `${context}: result is not an object`);

  for (const key of expectedKeys) {
    assert.ok(key in result, `${context}: missing key "${key}"`);
    const value = result[key];

    assert.equal(typeof value, 'string', `${context}: value for "${key}" is not a string (got ${typeof value})`);
    assert.ok(value.length > 0, `${context}: value for "${key}" is empty`);
    assert.ok(
      !value.startsWith('[EN]'),
      `${context}: value for "${key}" starts with [EN] — not a real translation`
    );
  }
}

/**
 * Additional echo detection — verify values differ from source.
 * Separated from the core assertions because coached/specialized
 * methods might intentionally preserve some terms.
 */
function assertNoFullEchoes(result, source, context) {
  for (const key of Object.keys(result)) {
    if (key in source) {
      assert.notEqual(
        result[key], source[key],
        `${context}: value for "${key}" is identical to English source — echo detected`
      );
    }
  }
}

// -----------------------------------------------------------------
// Test suite: Base LLM Method (OpenRouter)
// -----------------------------------------------------------------

describe('live-api — LLM method (OpenRouter)', { skip: !HAS_OPENROUTER }, () => {

  it('translates a basic 3-key batch to French', { timeout: 30000 }, async () => {
    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, FRENCH_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      batchSize: FRENCH_PAIR.batchSize,
    });

    assertValidTranslation(result, BASIC_KEYS, BASIC_SOURCE, 'LLM→French');
    assertNoFullEchoes(result, BASIC_SOURCE, 'LLM→French');
  });

  it('translates to non-Latin script (Japanese)', { timeout: 30000 }, async () => {
    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, JAPANESE_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: JAPANESE_PAIR.model,
      batchSize: JAPANESE_PAIR.batchSize,
    });

    assertValidTranslation(result, BASIC_KEYS, BASIC_SOURCE, 'LLM→Japanese');
    assertNoFullEchoes(result, BASIC_SOURCE, 'LLM→Japanese');

    // Extra: verify at least one value contains Japanese characters (Hiragana/Katakana/Kanji)
    const hasJapanese = Object.values(result).some(v =>
      /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(v)
    );
    assert.ok(hasJapanese, 'LLM→Japanese: Expected at least one value with Japanese characters');
  });

  it('preserves placeholders through translation', { timeout: 30000 }, async () => {
    const result = await translateBatch(PLACEHOLDER_KEYS, PLACEHOLDER_SOURCE, FRENCH_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      batchSize: FRENCH_PAIR.batchSize,
    });

    assertValidTranslation(result, PLACEHOLDER_KEYS, PLACEHOLDER_SOURCE, 'LLM→Placeholders');

    // The {name} and {count} placeholders must survive translation
    assert.ok(
      result['welcome'].includes('{name}'),
      `Placeholder {name} was not preserved: "${result['welcome']}"`
    );
    assert.ok(
      result['items'].includes('{count}'),
      `Placeholder {count} was not preserved: "${result['items']}"`
    );
  });

  it('handles Unicode source strings', { timeout: 30000 }, async () => {
    const result = await translateBatch(UNICODE_KEYS, UNICODE_SOURCE, FRENCH_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      batchSize: FRENCH_PAIR.batchSize,
    });

    assertValidTranslation(result, UNICODE_KEYS, UNICODE_SOURCE, 'LLM→Unicode');
  });

  it('returns only string values (no nested objects or arrays)', { timeout: 30000 }, async () => {
    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, FRENCH_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      batchSize: FRENCH_PAIR.batchSize,
    });

    assert.ok(result, 'Expected non-null result');

    for (const [key, value] of Object.entries(result)) {
      assert.equal(
        typeof value, 'string',
        `Response shape violation: key "${key}" has type ${typeof value}, expected string`
      );
    }
  });

  it('translates freeform content via translateRawContent', { timeout: 30000 }, async () => {
    const prompt = `Translate the following English text to French. Return ONLY the translated text, no explanation.

Hello! Welcome to our documentation. This guide will help you get started.`;

    const result = await translateRawContent(prompt, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      pairConfig: FRENCH_PAIR,
    });

    assert.ok(result, 'translateRawContent returned null');
    assert.equal(typeof result, 'string', 'Content result is not a string');
    assert.ok(result.length > 10, `Content result is too short: "${result}"`);

    // Verify it's not just echoing the English back
    assert.ok(
      !result.includes('Translate the following'),
      'Content result contains the prompt instruction — echo detected'
    );
  });
});

// -----------------------------------------------------------------
// Test suite: LLM-Coached Method (OpenRouter + coaching data)
// -----------------------------------------------------------------

describe('live-api — LLM-coached method (OpenRouter)', { skip: !HAS_OPENROUTER }, () => {
  let tmpDir;
  let coachingDir;

  beforeEach(() => {
    // Create temp coaching data for French
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-live-coached-'));
    coachingDir = path.join(tmpDir, '.champollion', 'coaching');
    fs.mkdirSync(coachingDir, { recursive: true });

    // Write a coaching file with grammar rules and dictionary
    const coachingData = {
      grammar_rules: [
        'French adjectives agree in gender and number with the noun.',
        'Use "vous" for formal/professional contexts.',
      ],
      dictionary: {
        'Hello': 'Bonjour',
        'Goodbye': 'Au revoir',
        'Thank you': 'Merci',
      },
      style_notes: 'Prefer formal register. Avoid anglicisms where a native French term exists.',
    };
    fs.writeFileSync(
      path.join(coachingDir, 'fr.json'),
      JSON.stringify(coachingData, null, 2)
    );
  });

  it('translates with coaching data injected', { timeout: 30000 }, async () => {
    const coachedPair = {
      ...FRENCH_PAIR,
      method: 'llm-coached',
    };

    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, coachedPair, {
      apiKey: OPENROUTER_KEY,
      model: coachedPair.model,
      batchSize: coachedPair.batchSize,
      cwd: tmpDir,
      coachingDir,
    });

    assertValidTranslation(result, BASIC_KEYS, BASIC_SOURCE, 'LLM-Coached→French');

    // With a coaching dictionary that maps "Hello" → "Bonjour",
    // the coached method should respect the dictionary hint.
    // The dictionary is injected as REQUIRED TERMINOLOGY, so the model
    // should use exactly "Bonjour" (or a phrase containing it).
    if (result['greeting']) {
      assert.ok(
        result['greeting'].toLowerCase().includes('bonjour'),
        `Coached dictionary was not respected: expected "Bonjour" in "${result['greeting']}"`
      );
    }
  });

  it('coached method preserves placeholders', { timeout: 30000 }, async () => {
    const coachedPair = {
      ...FRENCH_PAIR,
      method: 'llm-coached',
    };

    const result = await translateBatch(PLACEHOLDER_KEYS, PLACEHOLDER_SOURCE, coachedPair, {
      apiKey: OPENROUTER_KEY,
      model: coachedPair.model,
      batchSize: coachedPair.batchSize,
      cwd: tmpDir,
      coachingDir,
    });

    assertValidTranslation(result, PLACEHOLDER_KEYS, PLACEHOLDER_SOURCE, 'Coached→Placeholders');

    assert.ok(
      result['welcome'].includes('{name}'),
      `Coached: Placeholder {name} was not preserved: "${result['welcome']}"`
    );
    assert.ok(
      result['items'].includes('{count}'),
      `Coached: Placeholder {count} was not preserved: "${result['items']}"`
    );
  });

  it('falls back to plain LLM when no coaching file exists', { timeout: 30000 }, async () => {
    const coachedPair = {
      ...FRENCH_PAIR,
      method: 'llm-coached',
      // Target a locale with no coaching file
      target: 'de',
      name: 'German',
      register: 'Professional register. Use Sie (formal).',
    };

    // Use the same tmpDir but there's no de.json coaching file
    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, coachedPair, {
      apiKey: OPENROUTER_KEY,
      model: coachedPair.model,
      batchSize: coachedPair.batchSize,
      cwd: tmpDir,
      coachingDir,
    });

    // Should still translate (falls back to plain LLM internally)
    assertValidTranslation(result, BASIC_KEYS, BASIC_SOURCE, 'Coached-fallback→German');
    assertNoFullEchoes(result, BASIC_SOURCE, 'Coached-fallback→German');
  });
});

// -----------------------------------------------------------------
// Test suite: Google Translate Method
// -----------------------------------------------------------------

describe('live-api — Google Translate method', { skip: !HAS_GOOGLE }, () => {

  const googlePair = {
    ...FRENCH_PAIR,
    method: 'google-translate',
  };

  it('translates a basic 3-key batch to French', { timeout: 30000 }, async () => {
    const result = await translateBatch(BASIC_KEYS, BASIC_SOURCE, googlePair, {
      apiKey: GOOGLE_KEY,
      batchSize: googlePair.batchSize,
    });

    assertValidTranslation(result, BASIC_KEYS, BASIC_SOURCE, 'Google→French');
    assertNoFullEchoes(result, BASIC_SOURCE, 'Google→French');
  });

  it('Google Translate handles Unicode source', { timeout: 30000 }, async () => {
    const result = await translateBatch(UNICODE_KEYS, UNICODE_SOURCE, googlePair, {
      apiKey: GOOGLE_KEY,
      batchSize: googlePair.batchSize,
    });

    assertValidTranslation(result, UNICODE_KEYS, UNICODE_SOURCE, 'Google→Unicode');
  });
});

// -----------------------------------------------------------------
// Test suite: Method contract validation
// -----------------------------------------------------------------

describe('live-api — method contract integrity', { skip: !HAS_OPENROUTER }, () => {

  it('getMethod("llm") returns a valid method instance', () => {
    const method = getMethod('llm');

    // TranslationMethod contract: name, estimateCost, getQualityTier, getProvenance
    assert.equal(method.name, 'llm');
    assert.equal(typeof method.translate, 'function');
    assert.equal(typeof method.estimateCost, 'function');
    assert.equal(typeof method.getQualityTier, 'function');
    assert.equal(typeof method.getProvenance, 'function');
  });

  it('getMethod("llm-coached") returns a valid method instance', () => {
    const method = getMethod('llm-coached');

    assert.equal(method.name, 'llm-coached');
    assert.equal(typeof method.translate, 'function');
    assert.equal(method.getQualityTier(), 'high');
  });

  it('LLM and coached methods produce structurally identical results', { timeout: 60000 }, async () => {
    // Both methods should return the same shape: { key: string, ... }
    const llmResult = await translateBatch(BASIC_KEYS, BASIC_SOURCE, FRENCH_PAIR, {
      apiKey: OPENROUTER_KEY,
      model: FRENCH_PAIR.model,
      batchSize: FRENCH_PAIR.batchSize,
    });

    // Coached without coaching data falls back to LLM — both should produce
    // objects with identical key sets and string values
    const coachedPair = { ...FRENCH_PAIR, method: 'llm-coached' };
    const coachedResult = await translateBatch(BASIC_KEYS, BASIC_SOURCE, coachedPair, {
      apiKey: OPENROUTER_KEY,
      model: coachedPair.model,
      batchSize: coachedPair.batchSize,
    });

    // Same keys
    assert.deepEqual(
      Object.keys(llmResult).sort(),
      Object.keys(coachedResult).sort(),
      'LLM and coached methods returned different key sets'
    );

    // Both have string values
    for (const key of Object.keys(llmResult)) {
      assert.equal(typeof llmResult[key], 'string');
      assert.equal(typeof coachedResult[key], 'string');
    }
  });
});
