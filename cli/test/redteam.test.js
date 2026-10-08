#!/usr/bin/env node
/**
 * champollion RED TEAM test suite
 *
 * Probes edge cases, adversarial inputs, and failure modes that
 * the happy-path suite doesn't cover. Categories:
 *
 *   1. Flatten — pathological inputs (empty strings, dots in keys, deep nesting)
 *   2. Diff — boundary conditions (empty locales, identical content, prefix collisions)
 *   3. Config — malformed configs, missing fields, type coercion
 *   4. Translate — prompt injection, malformed API responses
 *   5. Sync — filesystem edge cases, concurrent writes
 *
 * Run: node test/redteam.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as nodeParseArgs } from 'node:util';

import { flattenKeys, setNestedValue } from '../lib/flatten.js';
import { diffLocale, diffLabel } from '../lib/diff.js';
import { resolveConfig, autoDetectLanguages, generateConfigTemplate } from '../lib/config.js';
import { DEFAULT_REGISTERS, getAllLanguageCodes, getLanguageCard } from '../lib/registers.js';
import { buildPrompt, isUnsafeKey, inferKeyTypes } from '../lib/translate.js';
import { loadApiKey, runSync } from '../lib/sync.js';

// =================================================================
// 1. FLATTEN — Pathological inputs
// =================================================================
describe('RED TEAM: flattenKeys edge cases', () => {
  it('handles keys with dots in them (ambiguous paths)', () => {
    // WHY: If a user has {"a.b": "value"} at the top level,
    // flattenKeys produces "a.b" which is indistinguishable from {a:{b:"value"}}
    const result = flattenKeys({ 'a.b': 'dotted' });
    assert.equal(result['a.b'], 'dotted');
  });

  it('handles empty string keys', () => {
    const result = flattenKeys({ '': 'empty key' });
    assert.equal(result[''], 'empty key');
  });

  it('handles empty string values', () => {
    const result = flattenKeys({ key: '' });
    assert.equal(result['key'], '');
  });

  it('handles unicode keys and values', () => {
    const result = flattenKeys({ '日本語': { 'キー': '値' } });
    assert.equal(result['日本語.キー'], '値');
  });

  it('handles very deep nesting (100 levels)', () => {
    let obj = { leaf: 'deep' };
    for (let i = 0; i < 100; i++) {
      obj = { [`level${i}`]: obj };
    }
    const result = flattenKeys(obj);
    const keys = Object.keys(result);
    assert.equal(keys.length, 1);
    assert.equal(result[keys[0]], 'deep');
  });

  it('handles mixed types at same level', () => {
    const result = flattenKeys({
      str: 'hello',
      num: 42,
      bool: false,
      nil: null,
      arr: [1, 2, 3],
      nested: { inner: 'value' },
    });
    assert.equal(result['str'], 'hello');
    assert.equal(result['num'], 42);
    assert.equal(result['bool'], false);
    assert.equal(result['nil'], null);
    assert.deepEqual(result['arr'], [1, 2, 3]);
    assert.equal(result['nested.inner'], 'value');
    // 'nested' itself should NOT be a key (it's an object, not a leaf)
    assert.equal(result['nested'], undefined);
  });

  it('handles numeric string keys', () => {
    const result = flattenKeys({ '0': { '1': 'indexed' } });
    assert.equal(result['0.1'], 'indexed');
  });
});

// =================================================================
// 2. setNestedValue — Adversarial paths
// =================================================================
describe('RED TEAM: setNestedValue edge cases', () => {
  it('handles empty string path segment', () => {
    const obj = {};
    setNestedValue(obj, '.a', 'value');
    // Should create { "": { a: "value" } }
    assert.equal(obj['']['a'], 'value');
  });

  it('overwrites a primitive with a nested object path', () => {
    // WHY: If "a" was a string, then setting "a.b" should overwrite it with an object
    const obj = { a: 'was-a-string' };
    setNestedValue(obj, 'a.b', 'nested');
    assert.equal(obj.a.b, 'nested');
  });

  it('handles very long dot-notation paths', () => {
    const obj = {};
    const longPath = Array.from({ length: 50 }, (_, i) => `k${i}`).join('.');
    setNestedValue(obj, longPath, 'deep');

    let current = obj;
    for (let i = 0; i < 49; i++) {
      current = current[`k${i}`];
      assert.ok(typeof current === 'object', `Level ${i} should be object`);
    }
    assert.equal(current['k49'], 'deep');
  });
});

// =================================================================
// 3. DIFF — Boundary conditions
// =================================================================
describe('RED TEAM: diffLocale edge cases', () => {
  it('handles both source and target being empty', () => {
    const diff = diffLocale({}, {});
    assert.equal(diff.missing.length, 0);
    assert.equal(diff.needsTranslation.length, 0);
    assert.equal(diff.extra.length, 0);
    assert.equal(diff.toProcess.length, 0);
  });

  it('handles empty source with populated target', () => {
    const diff = diffLocale({}, { 'a': 'orphan', 'b': 'stale' });
    assert.equal(diff.missing.length, 0);
    assert.equal(diff.extra.length, 2);
  });

  it('handles empty target with populated source', () => {
    const source = { 'a': 'hello', 'b': 'world' };
    const diff = diffLocale(source, {});
    assert.equal(diff.missing.length, 2);
    assert.equal(diff.toProcess.length, 2);
  });

  it('does not double-count keys that are both missing AND [EN]-prefixed', () => {
    // A key can't be both missing AND [EN]-prefixed, because if it exists
    // with [EN] prefix, it's not missing. This tests the set logic.
    const source = { 'a': 'hello', 'b': 'world' };
    const target = { 'a': '[EN] hello' };
    const diff = diffLocale(source, target);
    // 'a' is in needsTranslation, 'b' is missing
    // toProcess should be 2, not 3
    assert.equal(diff.toProcess.length, 2);
  });

  it('handles values that accidentally look like fallback prefix', () => {
    // WHY: If a legitimate English value starts with "[EN] ",
    // it would be incorrectly flagged as needing translation
    const source = { 'key': '[EN] This is actually the real value' };
    const target = { 'key': '[EN] This is actually the real value' };
    const diff = diffLocale(source, target);
    // This IS a known limitation — it will flag it
    assert.equal(diff.needsTranslation.length, 1);
    // Documenting this as a known edge case
  });

  it('handles non-string values correctly (numbers, booleans, null)', () => {
    const source = { 'count': 42, 'active': true, 'nothing': null };
    const target = { 'count': 42, 'active': true, 'nothing': null };
    const diff = diffLocale(source, target);
    // Non-string values can't have [EN] prefix, should be clean
    assert.equal(diff.needsTranslation.length, 0);
    assert.equal(diff.toProcess.length, 0);
  });

  it('handles non-string values with [EN] prefix correctly', () => {
    const source = { 'count': 42 };
    const target = { 'count': '[EN] 42' }; // Somehow got stringified with prefix
    const diff = diffLocale(source, target);
    // The target has a string starting with [EN], so it's flagged
    assert.equal(diff.needsTranslation.length, 1);
  });
});

// =================================================================
// 4. CONFIG — Malformed inputs
// =================================================================
describe('RED TEAM: resolveConfig edge cases', () => {
  const tmpDir = path.join(import.meta.dirname, 'fixtures', '_tmp_config_test');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // A malformed config must FAIL LOUD, not fall back to defaults.
  //
  // These two previously asserted the opposite ("should fall back to
  // defaults", down to the exact default model). That fallback was the bug:
  // the user wrote a config precisely so inputLocale/localesDir/model would
  // NOT be the defaults, so silently substituting them translates the wrong
  // locales with the wrong model and bills for it — after printing only a
  // `[WARN]`. "Survives" here means fails clearly and actionably, not
  // proceeds on quietly wrong settings.
  it('REFUSES a completely malformed config file — no silent default fallback', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      'THIS IS NOT JSON AT ALL {{{',
      'utf-8'
    );
    assert.throws(
      () => resolveConfig({}, tmpDir),
      (err) => {
        assert.equal(err.code, 'CHAMPOLLION_CONFIG_PARSE');
        // The message must name the file and say why we stopped.
        assert.match(err.message, /champollion\.config\.json/);
        assert.match(err.message, /will not fall back to default settings/);
        return true;
      },
    );
  });

  it('REFUSES an empty config file', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      '',
      'utf-8'
    );
    // An empty file is not valid JSON. It is also indistinguishable from a
    // half-written one, so it gets the same refusal rather than defaults.
    assert.throws(
      () => resolveConfig({}, tmpDir),
      (err) => err.code === 'CHAMPOLLION_CONFIG_PARSE',
    );
  });

  it('survives a config with unexpected types', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      JSON.stringify({
        inputLocale: 12345,        // Should be string
        batchSize: 'not-a-number',  // Should be number
        languages: 'not-an-array',  // Should be array or object
      }),
      'utf-8'
    );
    // Should not throw
    const config = resolveConfig({}, tmpDir);
    assert.equal(config.inputLocale, 12345); // Passes through — no validation
  });

  it('handles config with extra unknown fields gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      JSON.stringify({
        inputLocale: 'en',
        unknownField: 'should be ignored',
        anotherRandom: { nested: true },
      }),
      'utf-8'
    );
    const config = resolveConfig({}, tmpDir);
    assert.equal(config.inputLocale, 'en');
    // Unknown fields pass through but shouldn't break anything
    assert.equal(config.unknownField, 'should be ignored');
  });

  it('handles object-style languages with mixed formats', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      JSON.stringify({
        languages: {
          fr: 'Custom French register',
          de: { name: 'Deutsch', register: 'Formal register' },
          xx: { register: 'Unknown language' },
          yy: 42, // Invalid type for language entry
        },
      }),
      'utf-8'
    );
    const config = resolveConfig({}, tmpDir);
    // resolveLanguages keys by raw user code, not canonical 639-3.
    // Card lookups still use canonical codes internally for metadata.
    assert.equal(config.resolvedLanguages.fr.register, 'Custom French register');
    assert.equal(config.resolvedLanguages.de.name, 'Deutsch');
    assert.equal(config.resolvedLanguages.xx.name, 'xx'); // Falls back to code
    // yy with value 42 (number) should be skipped silently
    assert.equal(config.resolvedLanguages.yy, undefined);
  });
});

// =================================================================
// 5. CONFIG — generateConfigTemplate
// =================================================================
describe('RED TEAM: generateConfigTemplate', () => {
  it('produces valid JSON', () => {
    const template = generateConfigTemplate('./my-locales', 'es');
    assert.doesNotThrow(() => JSON.parse(template));
    const parsed = JSON.parse(template);
    assert.equal(parsed.inputLocale, 'es');
    assert.equal(parsed.localesDir, './my-locales');
  });

  it('uses defaults for undefined arguments', () => {
    const template = generateConfigTemplate(undefined, undefined);
    const parsed = JSON.parse(template);
    assert.equal(parsed.inputLocale, 'en');
    assert.equal(parsed.localesDir, './locales');
  });
});

// =================================================================
// 6. AUTO-DETECT — Edge cases
// =================================================================
describe('RED TEAM: autoDetectLanguages', () => {
  const tmpDir = path.join(import.meta.dirname, 'fixtures', '_tmp_detect_test');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores non-locale files in locales directory', () => {
    fs.writeFileSync(path.join(tmpDir, 'fr.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'not a locale');
    fs.writeFileSync(path.join(tmpDir, 'data.yaml'), 'also not');
    fs.writeFileSync(path.join(tmpDir, 'en.json'), '{}');

    const config = { inputLocale: 'en', localesDir: tmpDir };
    const detected = autoDetectLanguages(config);
    assert.ok(detected['fr'], 'Should detect fr.json');
    assert.ok(!detected['readme'], 'Should not detect txt files');
    // v2.0: YAML files are now valid locale formats and should be detected
    assert.ok(detected['data'], 'Should detect data.yaml as a locale file');
  });

  it('excludes source locale from detected languages', () => {
    fs.writeFileSync(path.join(tmpDir, 'en.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'fr.json'), '{}');

    const config = { inputLocale: 'en', localesDir: tmpDir };
    const detected = autoDetectLanguages(config);
    assert.ok(!detected['en'], 'Should not include source locale');
    assert.ok(detected['fr'], 'Should include non-source locales');
  });

  it('handles unknown language codes gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'en.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'xx-custom.json'), '{}');

    const config = { inputLocale: 'en', localesDir: tmpDir };
    const detected = autoDetectLanguages(config);
    // Unknown codes should get the code itself as the name
    assert.equal(detected['xx-custom'].name, 'xx-custom');
    assert.equal(detected['xx-custom'].register, 'Professional register.');
  });

  it('handles empty locales directory', () => {
    const config = { inputLocale: 'en', localesDir: tmpDir };
    const detected = autoDetectLanguages(config);
    assert.deepEqual(detected, {});
  });

  it('handles nonexistent locales directory', () => {
    const config = { inputLocale: 'en', localesDir: '/tmp/does-not-exist-12345' };
    const detected = autoDetectLanguages(config);
    assert.deepEqual(detected, {});
  });
});

// =================================================================
// 7. SYNC — loadApiKey edge cases
// =================================================================
describe('RED TEAM: loadApiKey', () => {
  const tmpDir = path.join(import.meta.dirname, 'fixtures', '_tmp_apikey_test');


  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('strips double quotes from .env.local values', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'OPENROUTER_API_KEY="sk-or-v1-quoted-key"',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'sk-or-v1-quoted-key');
  });

  it('strips single quotes from .env.local values', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      "OPENROUTER_API_KEY='sk-or-v1-single-quoted'",
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'sk-or-v1-single-quoted');
  });

  it('skips comment lines in .env files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      '# This is a comment\n# OPENROUTER_API_KEY=wrong\nOPENROUTER_API_KEY=correct-key',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'correct-key');
  });

  it('handles .env.local with blank lines', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      '\n\n  \nOPENROUTER_API_KEY=key-with-blanks\n\n',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'key-with-blanks');
  });

  it('falls back to .env when .env.local is missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      'OPENROUTER_API_KEY=from-dotenv',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'from-dotenv');
  });

  it('returns null when no key found anywhere', () => {
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, null);
  });

  it('prefers environment variable over .env.local', () => {
    const saved = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'from-env-var';
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'OPENROUTER_API_KEY=from-file',
      'utf-8'
    );
    try {
      const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
      assert.equal(key, 'from-env-var');
    } finally {
      if (saved) {
        process.env.OPENROUTER_API_KEY = saved;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  it('handles keys with equals signs in the value', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'OPENROUTER_API_KEY=sk-or-v1-key=with=equals',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'sk-or-v1-key=with=equals');
  });

  it('handles export prefix in .env files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'export OPENROUTER_API_KEY=sk-or-v1-exported-key',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'sk-or-v1-exported-key');
  });

  it('handles export prefix combined with quotes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'export OPENROUTER_API_KEY="sk-or-v1-export-quoted"',
      'utf-8'
    );
    const key = loadApiKey({ apiKeyEnvVar: 'OPENROUTER_API_KEY' }, tmpDir);
    assert.equal(key, 'sk-or-v1-export-quoted');
  });
});

// =================================================================
// 8. SYNC — Fallback mode with empty target files
// =================================================================
describe('RED TEAM: sync with empty/new locale files', () => {
  const tmpDir = path.join(import.meta.dirname, 'fixtures', '_tmp_empty_sync');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // Source with a few keys
    fs.writeFileSync(path.join(tmpDir, 'en.json'), JSON.stringify({
      greeting: 'Hello',
      farewell: 'Goodbye',
    }));
    // Empty target (brand new locale)
    fs.writeFileSync(path.join(tmpDir, 'fr.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does NOT write [EN]-prefixed fallbacks without API key (loud failure)', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const logs = [];
    const origLog = console.log;
    const origWrite = process.stdout.write;
    console.log = (...args) => logs.push(args.join(' '));
    process.stdout.write = (s) => logs.push(s);

    try {
      // Without fallback mode (removed), sync should fail at preflight
      // or during translation — not silently write garbage
      try {
        await runSync({
          cwd: import.meta.dirname,
          cliArgs: { dir: tmpDir },
        });
      } catch (err) {
        // Expected: preflight or translation error
        assert.ok(err.message, 'Error should have a message');
      }

      // Regardless of the path taken, fr.json should NOT have [EN] prefixes
      const frUpdated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'fr.json'), 'utf-8'));
      // It should either be unchanged (empty {}) or not have [EN] garbage
      const values = Object.values(frUpdated).filter(v => typeof v === 'string');
      for (const val of values) {
        assert.ok(!val.startsWith('[EN] '), `Should not have [EN] prefix, got: ${val}`);
      }
    } finally {
      console.log = origLog;
      process.stdout.write = origWrite;
      if (saved) process.env.OPENROUTER_API_KEY = saved;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });
});

// =================================================================
// 9. REGISTERS — Completeness and consistency
// =================================================================
describe('RED TEAM: registers integrity', () => {
  it('no register has an empty name', () => {
    for (const [code, reg] of Object.entries(DEFAULT_REGISTERS)) {
      assert.ok(reg.name.length > 0, `${code} has empty name`);
    }
  });

  it('no register has an empty register instruction', () => {
    for (const [code, reg] of Object.entries(DEFAULT_REGISTERS)) {
      assert.ok(reg.register.length > 0, `${code} has empty register`);
    }
  });

  it('register codes are unique', () => {
    const codes = Object.keys(DEFAULT_REGISTERS);
    const unique = new Set(codes);
    assert.equal(codes.length, unique.size, 'Duplicate register codes found');
  });

  it('register names are unique (excluding aliases and ISO 639-1/639-3 pairs)', () => {
    // WHY: Aliases (e.g., 'no' → 'nb', 'iw' → 'he') correctly share
    // names with their primary card. ISO 639-3 three-letter codes
    // (e.g., 'jpn', 'bul', 'ces') also legitimately share names with
    // their ISO 639-1 two-letter equivalents ('ja', 'bg', 'cs').
    // Regional variants (e.g., 'fr-CA' / 'fra-CA') are also valid pairs.
    // We only flag duplicates where both codes have the same length
    // AND neither is a known alias variant.
    // ISO/glottocode twins the SOURCES do not link. Welding two spine rows
    // because their names match would invent an identity no registry asserts,
    // so these pairs are exempt — with evidence, and SELF-EXPIRING: the guard
    // below fails the moment the sources DO link a pair, so a fixed upstream
    // gap cannot hide behind a stale exemption.
    const twins = JSON.parse(fs.readFileSync(new URL(
      '../../shared/cldf/unlinked-name-twins.json', import.meta.url,
    ), 'utf-8')).pairs;
    const twinPairs = new Set(twins.flatMap((t) => [`${t.iso}|${t.glottocode}`, `${t.glottocode}|${t.iso}`]));
    for (const t of twins) {
      const card = getLanguageCard(t.iso);
      if (card && card.glottocode === t.glottocode) {
        realDupesGuard: {
          throw new Error(`unlinked-name-twins: ${t.iso} now carries glottocode `
            + `${t.glottocode} — the sources linked them, so the exemption is stale. `
            + 'Remove the pair; the spine should merge these rows.');
        }
      }
    }
    const primaryCodes = getAllLanguageCodes();
    const seen = new Map(); // name → first code that claimed it
    const realDupes = [];
    for (const code of primaryCodes) {
      const name = DEFAULT_REGISTERS[code]?.name;
      if (!name) continue;
      if (seen.has(name)) {
        const other = seen.get(name);
        // Extract base codes (strip regional suffixes like -CA, -TW)
        const baseA = code.split('-')[0];
        const baseB = other.split('-')[0];
        // ISO 639-1/639-3 pair: one base is 2 chars, the other is 3 chars
        const isIsoPair =
          (baseA.length === 2 && baseB.length === 3) ||
          (baseA.length === 3 && baseB.length === 2);
        // Known same-language pairs with same base length
        // (tgl = Tagalog, fil = Filipino — same language per 1987 Philippine decree)
        const KNOWN_ALIASES = new Set(['tgl-fil', 'fil-tgl']);
        const isKnownAlias = KNOWN_ALIASES.has(`${baseA}-${baseB}`);
        // A LOCALE SHARES ITS LANGUAGE'S NAME BY DESIGN. `aaa-NG` is Ghotuo
        // as spoken in Nigeria — the same language, so the same name. This
        // rule exists to catch two DISTINCT languages colliding on a name;
        // a locale and its parent are not two languages. Detected by the
        // shared base code, so it cannot mask a genuine collision between
        // unrelated codes.
        const isLocaleOfSameLanguage = baseA === baseB && code !== other;
        if (!isIsoPair && !isKnownAlias && !isLocaleOfSameLanguage) {
        if (twinPairs.has(`${baseA}|${baseB}`)) continue;
          realDupes.push(`${code} == ${other} → "${name}"`);
        }
      } else {
        seen.set(name, code);
      }
    }
    assert.equal(realDupes.length, 0,
      `Unexpected duplicate register names:\n  ${realDupes.join('\n  ')}`);
  });
});

// =================================================================
// 10. CLI arg parser — Edge cases
//
// These tests validate the util.parseArgs-based parser from cli.js.
// We replicate the same parseArgs configuration here to test it
// in isolation without spawning a child process.
// =================================================================
describe('RED TEAM: CLI arg parsing edge cases', () => {
  // Mirror the parser configuration from bin/cli.js

  function parseArgs(argv) {
    const { values, positionals } = nodeParseArgs({
      args: argv.slice(2),
      strict: false,
      allowPositionals: true,
      options: {
        dry:         { type: 'boolean' },
        help:        { type: 'boolean', short: 'h' },
        version:     { type: 'boolean', short: 'v' },
        'no-verify': { type: 'boolean' },
        yes:         { type: 'boolean', short: 'y' },
        'warn-only': { type: 'boolean' },
        undo:        { type: 'boolean' },
        verbose:     { type: 'boolean' },
        config:      { type: 'string' },
        dir:         { type: 'string' },
        source:      { type: 'string' },
        model:       { type: 'string' },
        method:      { type: 'string' },
        format:      { type: 'string' },
        out:         { type: 'string' },
        src:         { type: 'string' },
        'force-keys':{ type: 'string' },
      },
    });
    return { _: positionals, ...values };
  }

  it('handles --flag at end of argv (boolean)', () => {
    const args = parseArgs(['node', 'cli.js', 'sync', '--dry']);
    assert.equal(args.dry, true);
    assert.deepEqual(args._, ['sync']);
  });

  it('handles --key value pairs', () => {
    const args = parseArgs(['node', 'cli.js', '--model', 'anthropic/claude']);
    assert.equal(args.model, 'anthropic/claude');
  });

  it('handles multiple flags', () => {
    const args = parseArgs(['node', 'cli.js', 'sync', '--dry', '--model', 'x']);
    assert.equal(args.dry, true);
    assert.equal(args.model, 'x');
  });

  it('handles consecutive boolean flags', () => {
    const args = parseArgs(['node', 'cli.js', '--dry', '--verbose']);
    assert.equal(args.dry, true);
    assert.equal(args.verbose, true);
  });

  it('defaults to empty positionals', () => {
    const args = parseArgs(['node', 'cli.js']);
    assert.deepEqual(args._, []);
  });

  it('handles subcommand positionals (plugin install)', () => {
    const args = parseArgs(['node', 'cli.js', 'plugin', 'install', './dir/']);
    assert.deepEqual(args._, ['plugin', 'install', './dir/']);
  });

  it('handles --force-keys with comma-separated values', () => {
    const args = parseArgs(['node', 'cli.js', 'sync', '--force-keys', 'a.title,a.subtitle']);
    assert.equal(args['force-keys'], 'a.title,a.subtitle');
    assert.deepEqual(args._, ['sync']);
  });
});

// =================================================================
// 11. ROUND-TRIP — flatten → setNestedValue consistency
// =================================================================
describe('RED TEAM: flatten/unflatten round-trip', () => {
  it('round-trips a complex nested object', () => {
    const original = {
      nav: { home: 'Home', about: 'About', nested: { deep: 'Value' } },
      pages: { home: { title: 'Title', cta: 'Click' } },
      simple: 'Top-level',
    };

    const flat = flattenKeys(original);
    const rebuilt = {};
    for (const [key, value] of Object.entries(flat)) {
      setNestedValue(rebuilt, key, value);
    }

    assert.deepEqual(rebuilt, original);
  });

  it('round-trips with numeric and boolean values', () => {
    const original = {
      meta: { count: 42, active: true, empty: null },
    };

    const flat = flattenKeys(original);
    const rebuilt = {};
    for (const [key, value] of Object.entries(flat)) {
      setNestedValue(rebuilt, key, value);
    }

    assert.deepEqual(rebuilt, original);
  });
});

// =================================================================
// v1.3.0 — Security: Prototype pollution guard
// =================================================================
describe('RED TEAM: prototype pollution guard', () => {
  it('isUnsafeKey detects __proto__', () => {
    assert.equal(isUnsafeKey('__proto__'), true);
  });

  it('isUnsafeKey detects nested __proto__', () => {
    assert.equal(isUnsafeKey('some.path.__proto__.evil'), true);
  });

  it('isUnsafeKey detects constructor', () => {
    assert.equal(isUnsafeKey('constructor'), true);
  });

  it('isUnsafeKey detects prototype', () => {
    assert.equal(isUnsafeKey('some.prototype.method'), true);
  });

  it('isUnsafeKey allows normal keys', () => {
    assert.equal(isUnsafeKey('nav.home'), false);
    assert.equal(isUnsafeKey('pages.about.title'), false);
    assert.equal(isUnsafeKey('footer.copyright'), false);
  });

  it('isUnsafeKey allows keys that contain but are not equal to unsafe segments', () => {
    // "construction" contains "constructor" but isn't the segment itself
    assert.equal(isUnsafeKey('pages.construction.title'), false);
    assert.equal(isUnsafeKey('ui.prototyping.label'), false);
  });
});

// =================================================================
// v1.3.0 — buildPrompt: UI context and string-type hints
// =================================================================
describe('RED TEAM: buildPrompt v1.3.0 improvements', () => {
  const langConfig = { name: 'French', register: 'Formal French. Use vous-form.' };

  it('includes UI context in the prompt', () => {
    const prompt = buildPrompt({ 'nav.home': 'Home' }, langConfig);
    assert.ok(prompt.includes('UI strings for a web/mobile application'),
      'Prompt should mention UI context');
  });

  it('includes gender-neutrality instruction', () => {
    const prompt = buildPrompt({ 'nav.home': 'Home' }, langConfig);
    assert.ok(prompt.includes('gender-neutral'),
      'Prompt should include gender-neutrality guidance');
  });

  it('includes the register instruction', () => {
    const prompt = buildPrompt({ 'nav.home': 'Home' }, langConfig);
    assert.ok(prompt.includes('Formal French. Use vous-form.'),
      'Prompt should include the register');
  });

  it('includes the JSON payload', () => {
    const prompt = buildPrompt({ 'nav.home': 'Home' }, langConfig);
    assert.ok(prompt.includes('"nav.home"'),
      'Prompt should include the key');
    assert.ok(prompt.includes('"Home"'),
      'Prompt should include the value');
  });

  it('includes UI element type instruction', () => {
    const prompt = buildPrompt({ 'nav.home': 'Home' }, langConfig);
    assert.ok(prompt.includes('button labels should be concise'),
      'Prompt should include UI element type guidance');
  });
});

// =================================================================
// v1.3.0 — inferKeyTypes: string-type inference from key names
// =================================================================
describe('RED TEAM: inferKeyTypes', () => {
  it('detects button keys', () => {
    const hints = inferKeyTypes({ 'form.submitBtn': 'Submit' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('button label'));
  });

  it('detects CTA keys', () => {
    const hints = inferKeyTypes({ 'hero.cta': 'Get Started' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('button label'));
  });

  it('detects title/heading keys', () => {
    const hints = inferKeyTypes({ 'pages.about.title': 'About Us' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('heading'));
  });

  it('detects description keys', () => {
    const hints = inferKeyTypes({ 'meta.description': 'A great app' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('description'));
  });

  it('detects error message keys', () => {
    const hints = inferKeyTypes({ 'form.email.error': 'Invalid email' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('error'));
  });

  it('detects placeholder keys', () => {
    const hints = inferKeyTypes({ 'search.placeholder': 'Search...' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('placeholder'));
  });

  it('detects navigation keys', () => {
    const hints = inferKeyTypes({ 'nav.dashboard': 'Dashboard' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('navigation'));
  });

  it('detects tooltip keys', () => {
    const hints = inferKeyTypes({ 'settings.darkMode.tooltip': 'Toggle dark mode' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('tooltip'));
  });

  it('returns empty for generic keys', () => {
    const hints = inferKeyTypes({ 'app.version': '1.0.0' });
    assert.equal(hints.length, 0, 'Generic keys should not get type hints');
  });

  it('handles multiple keys with mixed types', () => {
    const hints = inferKeyTypes({
      'form.submitBtn': 'Submit',
      'pages.title': 'Welcome',
      'app.version': '1.0.0',
      'form.email.placeholder': 'Enter email',
    });
    // 3 of 4 keys should match (app.version is generic)
    assert.equal(hints.length, 3);
  });

  it('first match wins for ambiguous keys', () => {
    // "submit" matches button pattern — should not also match label
    const hints = inferKeyTypes({ 'form.submit': 'Go' });
    assert.equal(hints.length, 1);
    assert.ok(hints[0].includes('button'));
  });
});

// =================================================================
// v1.3.0 — Register completeness (enriched + new languages)
// =================================================================
describe('RED TEAM: v1.3.0 register enhancements', () => {
  it('Filipino register includes code-switching guidance', () => {
    const tl = DEFAULT_REGISTERS['tl'];
    assert.ok(tl, 'tl register should exist');
    assert.ok(tl.register.toLowerCase().includes('taglish'),
      'Filipino register should mention Taglish code-switching');
  });

  it('RTL registers have dir=rtl metadata', () => {
    // WHY: RTL direction is now stored as structured metadata in the
    // language card's dir field, not baked into register prompt text.
    // The register prompt focuses on linguistic guidance only.
    const rtlCodes = ['ar', 'fa', 'he', 'ur'];
    for (const code of rtlCodes) {
      const reg = DEFAULT_REGISTERS[code];
      assert.ok(reg, `${code} register should exist`);
      assert.ok(
        reg.dir === 'rtl',
        `${code} register should have dir=rtl (got dir=${reg.dir})`
      );
    }
  });

  it('new v1.3.0 languages are present', () => {
    const newLangs = ['bg', 'cs', 'da', 'fi', 'sk'];
    for (const code of newLangs) {
      const reg = DEFAULT_REGISTERS[code];
      assert.ok(reg, `${code} register should exist`);
      assert.ok(reg.name, `${code} should have a name`);
      assert.ok(reg.register, `${code} should have a register`);
    }
  });

  it('contains 42+ language definitions after language card migration', () => {
    const count = Object.keys(DEFAULT_REGISTERS).length;
    assert.ok(count >= 42, `Expected 42+ registers, got ${count}`);
  });

  it('Japanese register mentions formality nuance', () => {
    const ja = DEFAULT_REGISTERS['ja'];
    assert.ok(ja.register.includes('です/ます'), 'Should mention polite form');
    assert.ok(
      ja.register.toLowerCase().includes('plain form') || ja.register.includes('する'),
      'Should mention plain form for short UI elements'
    );
  });

  it('gendered European languages have card-level inclusivity guidance', () => {
    // Gender guidance moved from register presets to card.gender.inclusiveGuidance
    // so it can be injected into buildSystemMessage() as a single source of truth.
    // This test verifies the card-level guidance exists for all gendered European languages.
    const genderedCodes = ['fr', 'es', 'de', 'it', 'pt'];
    for (const code of genderedCodes) {
      const card = getLanguageCard(code);
      assert.ok(card, `${code} language card should exist`);
      assert.ok(
        card.gender && card.gender.inclusiveGuidance,
        `${code} card should have gender.inclusiveGuidance`
      );
      assert.ok(
        card.gender.inclusiveGuidance.length > 20,
        `${code} gender guidance should be substantive (not just a placeholder)`
      );
    }
  });
});
