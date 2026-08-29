/**
 * Code resolution test suite — validates that resolveLanguages() keys its
 * output map by the raw user-provided code, NOT the canonical ISO 639-3 code.
 *
 * WHY: resolveCode('fr') → 'fra', but pair keys must use the raw code ('fr')
 * so that config.pairs entries like 'en:fr' merge correctly with the pair
 * graph built from config.languages. Using canonical codes caused duplicates.
 *
 * Also validates end-to-end: resolveConfig + resolvePairs with user-provided
 * pair overrides must produce a single merged pair, not two separate entries.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLanguages } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';

// =================================================================
// resolveLanguages — map key is raw code, not canonical
// =================================================================
describe('resolveLanguages — raw code keying', () => {
  it('array format: keys by raw code, not canonical', () => {
    const config = { languages: ['fr'] };
    const resolved = resolveLanguages(config);

    // The map key must be 'fr' (user-provided), not 'fra' (canonical)
    assert.ok(resolved['fr'], 'Map should have key "fr"');
    assert.equal(resolved['fra'], undefined, 'Map should NOT have key "fra"');
    assert.equal(resolved['fr'].name, 'French');
  });

  it('array format: multiple codes all use raw keys', () => {
    const config = { languages: ['fr', 'de', 'ja'] };
    const resolved = resolveLanguages(config);

    assert.ok(resolved['fr'], 'Should have "fr" not "fra"');
    assert.ok(resolved['de'], 'Should have "de" not "deu"');
    assert.ok(resolved['ja'], 'Should have "ja" not "jpn"');

    // None of the canonical codes should appear as keys
    assert.equal(resolved['fra'], undefined);
    assert.equal(resolved['deu'], undefined);
    assert.equal(resolved['jpn'], undefined);
  });

  it('array format: 639-3 codes stay as-is (no double resolution)', () => {
    const config = { languages: ['fra', 'deu'] };
    const resolved = resolveLanguages(config);

    // When the user already provides 639-3 codes, those should be the keys
    assert.ok(resolved['fra'], 'Should have "fra" as-is');
    assert.ok(resolved['deu'], 'Should have "deu" as-is');
  });

  it('object-string format: keys by raw code', () => {
    const config = { languages: { fr: 'casual-tu' } };
    const resolved = resolveLanguages(config);

    assert.ok(resolved['fr'], 'Map should have key "fr"');
    assert.equal(resolved['fra'], undefined, 'Map should NOT have key "fra"');
  });

  it('object-full format: keys by raw code', () => {
    const config = { languages: { fr: { name: 'French', register: 'casual-tu' } } };
    const resolved = resolveLanguages(config);

    assert.ok(resolved['fr'], 'Map should have key "fr"');
    assert.equal(resolved['fra'], undefined, 'Map should NOT have key "fra"');
    assert.equal(resolved['fr'].name, 'French');
  });

  it('still uses canonical codes for card lookups (register content is correct)', () => {
    const config = { languages: ['fr'] };
    const resolved = resolveLanguages(config);

    // Even though the key is 'fr', the register content should come from
    // the fra.json language card (resolved via canonical code)
    assert.ok(resolved['fr'].register.length > 10,
      'Register should be substantial text from the language card');
  });

  it('empty languages returns empty map', () => {
    const config = { languages: [] };
    const resolved = resolveLanguages(config);
    assert.deepEqual(resolved, {});
  });

  it('missing languages field returns empty map', () => {
    const config = {};
    const resolved = resolveLanguages(config);
    assert.deepEqual(resolved, {});
  });
});

// =================================================================
// End-to-end: pair override merging (no duplicates)
// =================================================================
describe('resolveLanguages + resolvePairs — pair override merging', () => {
  it('config.pairs "en:fr" merges with languages ["fr"] (no duplicate)', () => {
    // Simulate what resolveConfig produces (minus file I/O)
    const resolvedLanguages = resolveLanguages({ languages: ['fr'] });
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 80,
      resolvedLanguages,
      pairs: {
        'en:fr': { register: 'casual' },
      },
    };

    const pairs = resolvePairs(config);

    // There should be exactly ONE pair for French, not two
    assert.equal(pairs.size, 1, 'Should have exactly 1 pair, not 2 (no duplicate)');
    assert.ok(pairs.has('en:fr'), 'Pair key should be "en:fr"');
    assert.ok(!pairs.has('en:fra'), 'Should NOT have "en:fra" pair');

    // The override should have been applied
    const frPair = pairs.get('en:fr');
    assert.equal(frPair.register, 'casual', 'Register override should be applied');
    assert.equal(frPair.target, 'fr');
    assert.equal(frPair.source, 'en');
  });

  it('multiple languages with one pair override: correct merge', () => {
    const resolvedLanguages = resolveLanguages({ languages: ['fr', 'de', 'ja'] });
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 80,
      resolvedLanguages,
      pairs: {
        'en:de': { method: 'deepl' },
      },
    };

    const pairs = resolvePairs(config);

    // 3 languages → 3 pairs, with de overridden (not 4 with a duplicate)
    assert.equal(pairs.size, 3, 'Should have exactly 3 pairs');
    assert.equal(pairs.get('en:de').method, 'deepl', 'German pair should use deepl method');
    assert.equal(pairs.get('en:fr').method, 'llm', 'French pair should use default llm method');
  });
});
