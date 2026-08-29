#!/usr/bin/env node
/**
 * Format adapter test suite — TOML and YAML parsing/serialization.
 * Run: node test/format.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  detectFormat,
  detectFormatFromDir,
  getExtension,
  readLocaleFile,
  writeLocaleFile,
  parseTOMLToFlat,
  parseYAMLToFlat,
  flatToTOML,
  flatToYAML,
  flatToNestedYAML,
  detectYAMLStyle,
  groupFlatKeys,
  sectionsToFlat,
  isDocusaurusJSON,
  extractDocusaurusMessages,
  injectDocusaurusMessages,
} from '../lib/format.js';

// Helper: make an isolated temp dir under the OS temp root.
function mkTmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `champ-${label}-`));
}

// =================================================================
// 1. Format detection
// =================================================================
describe('Format detection', () => {
  it('detects TOML from file extension', () => {
    assert.equal(detectFormat('en.toml'), 'toml');
    assert.equal(detectFormat('/path/to/i18n/fr.toml'), 'toml');
  });

  it('detects YAML from .yaml extension', () => {
    assert.equal(detectFormat('en.yaml'), 'yaml');
  });

  it('detects YAML from .yml extension', () => {
    assert.equal(detectFormat('en.yml'), 'yaml');
  });

  it('defaults to JSON for .json and unknown extensions', () => {
    assert.equal(detectFormat('en.json'), 'json');
    assert.equal(detectFormat('en.txt'), 'json');
    assert.equal(detectFormat('en'), 'json');
  });

  it('returns correct file extensions', () => {
    assert.equal(getExtension('toml'), '.toml');
    assert.equal(getExtension('yaml'), '.yaml');
    assert.equal(getExtension('json'), '.json');
  });

  it('detects format from directory contents', () => {
    const hugoDir = path.join(import.meta.dirname, 'fixtures', 'hugo-i18n');
    assert.equal(detectFormatFromDir(hugoDir), 'toml');

    const yamlDir = path.join(import.meta.dirname, 'fixtures', 'yaml-locales');
    assert.equal(detectFormatFromDir(yamlDir), 'yaml');
  });

  it('defaults to JSON for nonexistent directory', () => {
    assert.equal(detectFormatFromDir('/tmp/does-not-exist-12345'), 'json');
  });
});

// =================================================================
// 2. TOML parsing
// =================================================================
describe('TOML parsing', () => {
  it('parses simple Hugo i18n TOML', () => {
    const toml = `[home]\nother = "Home"\n\n[about]\nother = "About Us"\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['home'], 'Home');
    assert.equal(flat['about'], 'About Us');
  });

  it('parses plural forms as dotted sub-keys', () => {
    const toml = `[items]\none = "{{ .Count }} item"\nother = "{{ .Count }} items"\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['items.one'], '{{ .Count }} item');
    assert.equal(flat['items.other'], '{{ .Count }} items');
    // Should NOT have a bare "items" key
    assert.equal(flat['items'], undefined);
  });

  it('handles three+ plural forms', () => {
    const toml = `[comments]\nzero = "No comments"\none = "1 comment"\nother = "{{ .Count }} comments"\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['comments.zero'], 'No comments');
    assert.equal(flat['comments.one'], '1 comment');
    assert.equal(flat['comments.other'], '{{ .Count }} comments');
  });

  it('skips comment lines', () => {
    const toml = `# This is a comment\n[home]\n# Another comment\nother = "Home"\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['home'], 'Home');
  });

  it('handles escaped quotes in values', () => {
    const toml = `[quote]\nother = "She said \\"hello\\""\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['quote'], 'She said "hello"');
  });

  it('handles single-quoted values (TOML literal strings)', () => {
    const toml = `[path]\nother = 'C:\\Users\\test'\n`;
    const flat = parseTOMLToFlat(toml);
    assert.equal(flat['path'], 'C:\\Users\\test');
  });

  it('handles empty TOML content', () => {
    const flat = parseTOMLToFlat('');
    assert.deepEqual(flat, {});
  });

  it('handles TOML with only comments', () => {
    const flat = parseTOMLToFlat('# Just a comment\n# Another one\n');
    assert.deepEqual(flat, {});
  });

  it('reads the Hugo fixture file correctly', () => {
    const fixturePath = path.join(import.meta.dirname, 'fixtures', 'hugo-i18n', 'en.toml');
    const flat = readLocaleFile(fixturePath, 'toml');
    assert.equal(flat['home'], 'Home');
    assert.equal(flat['welcome'], 'Welcome to our website');
    assert.equal(flat['items.one'], '{{ .Count }} item');
    assert.equal(flat['items.other'], '{{ .Count }} items');
  });

  it('returns empty object for nonexistent file', () => {
    const flat = readLocaleFile('/tmp/nope.toml', 'toml');
    assert.deepEqual(flat, {});
  });
});

// =================================================================
// 3. TOML serialization
// =================================================================
describe('TOML serialization', () => {
  it('serializes simple keys with [section] + other', () => {
    const toml = flatToTOML({ home: 'Home', about: 'About Us' });
    assert.ok(toml.includes('[home]'));
    assert.ok(toml.includes('other = "Home"'));
    assert.ok(toml.includes('[about]'));
    assert.ok(toml.includes('other = "About Us"'));
  });

  it('serializes plural keys under one section', () => {
    const toml = flatToTOML({ 'items.one': '1 item', 'items.other': '{{ .Count }} items' });
    assert.ok(toml.includes('[items]'));
    assert.ok(toml.includes('one = "1 item"'));
    assert.ok(toml.includes('other = "{{ .Count }} items"'));
    // Should NOT have [items.one] or [items.other] sections
    assert.ok(!toml.includes('[items.one]'));
  });

  it('escapes double quotes in values', () => {
    const toml = flatToTOML({ quote: 'She said "hello"' });
    assert.ok(toml.includes('other = "She said \\"hello\\""'));
  });

  it('round-trips simple keys', () => {
    const original = { home: 'Home', about: 'About Us', contact: 'Contact' };
    const toml = flatToTOML(original);
    const parsed = parseTOMLToFlat(toml);
    assert.deepEqual(parsed, original);
  });

  it('round-trips plural keys', () => {
    const original = { 'items.one': '1 item', 'items.other': '{{ .Count }} items' };
    const toml = flatToTOML(original);
    const parsed = parseTOMLToFlat(toml);
    assert.deepEqual(parsed, original);
  });

  it('round-trips mixed simple and plural keys', () => {
    const original = {
      home: 'Home',
      'items.one': '1 item',
      'items.other': '{{ .Count }} items',
      about: 'About',
    };
    const toml = flatToTOML(original);
    const parsed = parseTOMLToFlat(toml);
    assert.deepEqual(parsed, original);
  });
});

// =================================================================
// 4. YAML parsing
// =================================================================
describe('YAML parsing', () => {
  it('parses simple Hugo i18n YAML', () => {
    const yaml = `home:\n  other: Home\nabout:\n  other: About Us\n`;
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['home'], 'Home');
    assert.equal(flat['about'], 'About Us');
  });

  it('parses plural forms as dotted sub-keys', () => {
    const yaml = `items:\n  one: "{{ .Count }} item"\n  other: "{{ .Count }} items"\n`;
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['items.one'], '{{ .Count }} item');
    assert.equal(flat['items.other'], '{{ .Count }} items');
  });

  it('handles quoted values', () => {
    const yaml = `greeting:\n  other: "Hello, world!"\n`;
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['greeting'], 'Hello, world!');
  });

  it('handles single-quoted values', () => {
    const yaml = `greeting:\n  other: 'Hello'\n`;
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['greeting'], 'Hello');
  });

  it('skips comment lines', () => {
    const yaml = `# Comment\nhome:\n  # Another comment\n  other: Home\n`;
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['home'], 'Home');
  });

  it('handles empty YAML content', () => {
    const flat = parseYAMLToFlat('');
    assert.deepEqual(flat, {});
  });

  it('reads the YAML fixture file correctly', () => {
    const fixturePath = path.join(import.meta.dirname, 'fixtures', 'yaml-locales', 'en.yaml');
    const flat = readLocaleFile(fixturePath, 'yaml');
    assert.equal(flat['home'], 'Home');
    assert.equal(flat['welcome'], 'Welcome to our website');
    assert.equal(flat['items.one'], '{{ .Count }} item');
    assert.equal(flat['items.other'], '{{ .Count }} items');
  });
});

// =================================================================
// 5. YAML serialization
// =================================================================
describe('YAML serialization', () => {
  it('serializes simple keys', () => {
    const yaml = flatToYAML({ home: 'Home', about: 'About Us' });
    assert.ok(yaml.includes('home:'));
    assert.ok(yaml.includes('  other: Home'));
    assert.ok(yaml.includes('about:'));
    assert.ok(yaml.includes('  other: About Us'));
  });

  it('quotes values with special characters', () => {
    const yaml = flatToYAML({ count: '{{ .Count }} items' });
    // Should be quoted because of { and }
    assert.ok(yaml.includes('"{{ .Count }} items"'));
  });

  it('round-trips simple keys', () => {
    const original = { home: 'Home', about: 'About Us' };
    const yaml = flatToYAML(original);
    const parsed = parseYAMLToFlat(yaml);
    assert.deepEqual(parsed, original);
  });

  it('round-trips plural keys', () => {
    const original = { 'items.one': '1 item', 'items.other': '{{ .Count }} items' };
    const yaml = flatToYAML(original);
    const parsed = parseYAMLToFlat(yaml);
    assert.deepEqual(parsed, original);
  });
});

// =================================================================
// 6. groupFlatKeys utility
// =================================================================
describe('groupFlatKeys', () => {
  it('wraps simple keys as { other: value }', () => {
    const grouped = groupFlatKeys({ home: 'Home' });
    assert.deepEqual(grouped, { home: { other: 'Home' } });
  });

  it('groups plural sub-keys under parent', () => {
    const grouped = groupFlatKeys({ 'items.one': '1', 'items.other': 'many' });
    assert.deepEqual(grouped, { items: { one: '1', other: 'many' } });
  });

  it('does not treat non-plural dotted keys as plurals', () => {
    const grouped = groupFlatKeys({ 'nav.home': 'Home' });
    // "home" is not a CLDR plural form, so it should be its own section
    assert.deepEqual(grouped, { 'nav.home': { other: 'Home' } });
  });
});

// =================================================================
// 7. RED TEAM: Edge cases
// =================================================================
describe('RED TEAM: format edge cases', () => {
  it('handles TOML with no trailing newline', () => {
    const flat = parseTOMLToFlat('[home]\nother = "Home"');
    assert.equal(flat['home'], 'Home');
  });

  it('handles TOML with Windows line endings', () => {
    const flat = parseTOMLToFlat('[home]\r\nother = "Home"\r\n');
    assert.equal(flat['home'], 'Home');
  });

  it('handles TOML values with equals signs', () => {
    const flat = parseTOMLToFlat('[eq]\nother = "a = b = c"');
    assert.equal(flat['eq'], 'a = b = c');
  });

  it('handles TOML with escaped newlines in value', () => {
    const flat = parseTOMLToFlat('[multi]\nother = "line1\\nline2"');
    assert.equal(flat['multi'], 'line1\nline2');
  });

  it('handles YAML with colon in value (quoted)', () => {
    const flat = parseYAMLToFlat('time:\n  other: "Time: 3:00 PM"');
    assert.equal(flat['time'], 'Time: 3:00 PM');
  });

  it('handles YAML boolean-like values as strings', () => {
    const yaml = flatToYAML({ confirm: 'yes' });
    const parsed = parseYAMLToFlat(yaml);
    assert.equal(parsed['confirm'], 'yes');
  });

  it('handles empty string values in TOML', () => {
    const flat = parseTOMLToFlat('[empty]\nother = ""');
    assert.equal(flat['empty'], '');
  });

  it('handles empty string values in YAML round-trip', () => {
    const yaml = flatToYAML({ empty: '' });
    const parsed = parseYAMLToFlat(yaml);
    assert.equal(parsed['empty'], '');
  });
});

// =================================================================
// 8. Docusaurus format helpers
// =================================================================
describe('isDocusaurusJSON', () => {
  it('detects Docusaurus {message, description} format', () => {
    const data = {
      'theme.title': { message: 'Hello', description: 'The title' },
      'theme.tagline': { message: 'World', description: 'The tagline' },
    };
    assert.equal(isDocusaurusJSON(data), true);
  });

  it('rejects flat key-value JSON', () => {
    const data = { 'nav.home': 'Home', 'nav.about': 'About' };
    assert.equal(isDocusaurusJSON(data), false);
  });

  it('rejects nested JSON without message field', () => {
    const data = { nav: { home: 'Home', about: 'About' } };
    assert.equal(isDocusaurusJSON(data), false);
  });

  it('rejects empty objects', () => {
    assert.equal(isDocusaurusJSON({}), false);
  });

  it('rejects null and non-objects', () => {
    assert.equal(isDocusaurusJSON(null), false);
    assert.equal(isDocusaurusJSON('string'), false);
    assert.equal(isDocusaurusJSON(42), false);
  });

  it('rejects mixed format (some message, some string)', () => {
    const data = {
      'a': { message: 'Hello', description: 'desc' },
      'b': 'plain string',
    };
    // First 5 values sampled — 'b' is a string, not {message}, so false
    assert.equal(isDocusaurusJSON(data), false);
  });
});

describe('extractDocusaurusMessages', () => {
  it('extracts message values from {message, description} objects', () => {
    const data = {
      'theme.title': { message: 'Hello', description: 'The title' },
      'theme.tagline': { message: 'World', description: 'The tagline' },
    };
    const flat = extractDocusaurusMessages(data);
    assert.deepEqual(flat, { 'theme.title': 'Hello', 'theme.tagline': 'World' });
  });

  it('passes through plain string values', () => {
    const data = {
      'theme.title': { message: 'Hello', description: 'desc' },
      'simple.key': 'Plain value',
    };
    const flat = extractDocusaurusMessages(data);
    assert.equal(flat['theme.title'], 'Hello');
    assert.equal(flat['simple.key'], 'Plain value');
  });

  it('skips non-string, non-object values', () => {
    const data = {
      'a': { message: 'Hello', description: 'desc' },
      'b': 42,
      'c': null,
      'd': ['array'],
    };
    const flat = extractDocusaurusMessages(data);
    assert.deepEqual(flat, { 'a': 'Hello' });
  });

  it('handles empty input', () => {
    assert.deepEqual(extractDocusaurusMessages({}), {});
  });
});

describe('injectDocusaurusMessages', () => {
  it('replaces message values while preserving descriptions', () => {
    const source = {
      'theme.title': { message: 'Hello', description: 'The title' },
      'theme.tagline': { message: 'World', description: 'The tagline' },
    };
    const translated = { 'theme.title': 'Bonjour', 'theme.tagline': 'Monde' };
    const result = injectDocusaurusMessages(source, translated);
    assert.deepEqual(result, {
      'theme.title': { message: 'Bonjour', description: 'The title' },
      'theme.tagline': { message: 'Monde', description: 'The tagline' },
    });
  });

  it('falls back to original message when key not in translated map', () => {
    const source = {
      'a': { message: 'Hello', description: 'desc A' },
      'b': { message: 'World', description: 'desc B' },
    };
    const translated = { 'a': 'Bonjour' }; // 'b' not translated
    const result = injectDocusaurusMessages(source, translated);
    assert.equal(result['a'].message, 'Bonjour');
    assert.equal(result['b'].message, 'World'); // unchanged
    assert.equal(result['b'].description, 'desc B'); // preserved
  });

  it('preserves extra metadata fields in source objects', () => {
    const source = {
      'key': { message: 'Hello', description: 'desc', customField: 'keep me' },
    };
    const translated = { 'key': 'Bonjour' };
    const result = injectDocusaurusMessages(source, translated);
    assert.equal(result['key'].message, 'Bonjour');
    assert.equal(result['key'].customField, 'keep me');
  });

  it('handles plain string values in source', () => {
    const source = {
      'a': { message: 'Hello', description: 'desc' },
      'b': 'plain',
    };
    const translated = { 'a': 'Bonjour', 'b': 'simple' };
    const result = injectDocusaurusMessages(source, translated);
    assert.equal(result['a'].message, 'Bonjour');
    assert.equal(result['b'], 'simple');
  });

  it('round-trips: extract → inject with same data = identity', () => {
    const source = {
      'theme.title': { message: 'Hello', description: 'The title' },
      'theme.tagline': { message: 'World', description: 'The tagline' },
    };
    const flat = extractDocusaurusMessages(source);
    const result = injectDocusaurusMessages(source, flat);
    assert.deepEqual(result, source);
  });
});

// =================================================================
// 9. REGRESSION: M1 — nested YAML deeper than 2 levels
//    (parseYAMLToFlat must not silently drop middle keys)
// =================================================================
describe('REGRESSION M1: deep nested YAML round-trip', () => {
  it('parses 3-level nesting without dropping the middle key', () => {
    const yaml = 'nav:\n  menu:\n    home: Home\n    about: About\n  legal:\n    terms: Terms\n';
    const flat = parseYAMLToFlat(yaml);
    assert.equal(flat['nav.menu.home'], 'Home');
    assert.equal(flat['nav.menu.about'], 'About');
    assert.equal(flat['nav.legal.terms'], 'Terms');
  });

  it('round-trips nav.menu.home through write → read without losing levels', () => {
    const original = {
      'nav.menu.home': 'Home',
      'nav.menu.about': 'About',
      'nav.legal.terms': 'Terms',
      'nav.legal.privacy': 'Privacy',
    };
    const yaml = flatToNestedYAML(original);
    const parsed = parseYAMLToFlat(yaml);
    assert.deepEqual(parsed, original);
  });

  it('handles 4-level nesting', () => {
    const flat = parseYAMLToFlat('a:\n  b:\n    c:\n      d: deep\n');
    assert.equal(flat['a.b.c.d'], 'deep');
  });

  it('still collapses a lone Hugo "other" leaf to the parent key', () => {
    const flat = parseYAMLToFlat('home:\n  other: Home\n');
    assert.equal(flat['home'], 'Home');
    assert.ok(!('home.other' in flat));
  });

  it('detectYAMLStyle classifies deep nesting as nested, not hugo', () => {
    const yaml = 'nav:\n  menu:\n    home: Home\n';
    assert.equal(detectYAMLStyle(yaml), 'nested');
  });

  it('detectYAMLStyle still classifies a pure Hugo plural file as hugo', () => {
    const yaml = 'items:\n  one: "1 item"\n  other: "{{ .Count }} items"\n';
    assert.equal(detectYAMLStyle(yaml), 'hugo');
  });
});

// =================================================================
// 10. REGRESSION: M2 — BOM-prefixed locale files
// =================================================================
describe('REGRESSION M2: BOM-prefixed locale files', () => {
  it('reads a BOM-prefixed JSON file without crashing', () => {
    const dir = mkTmpDir('bom-json');
    const file = path.join(dir, 'en.json');
    fs.writeFileSync(file, '﻿{"home":"Home"}', 'utf-8');
    const data = readLocaleFile(file, 'json');
    assert.equal(data.home, 'Home');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads a BOM-prefixed TOML file (first key not lost)', () => {
    const dir = mkTmpDir('bom-toml');
    const file = path.join(dir, 'en.toml');
    fs.writeFileSync(file, '﻿[home]\nother = "Home"\n', 'utf-8');
    const data = readLocaleFile(file, 'toml');
    assert.equal(data.home, 'Home');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads a BOM-prefixed YAML file (first key not lost)', () => {
    const dir = mkTmpDir('bom-yaml');
    const file = path.join(dir, 'en.yaml');
    fs.writeFileSync(file, '﻿home:\n  other: Home\n', 'utf-8');
    const data = readLocaleFile(file, 'yaml');
    assert.equal(data.home, 'Home');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// =================================================================
// 11. REGRESSION: L6 — friendly error on malformed JSON
// =================================================================
describe('REGRESSION L6: friendly malformed-JSON error', () => {
  it('names the file and hints at a trailing comma', () => {
    const dir = mkTmpDir('badjson');
    const file = path.join(dir, 'fr.json');
    fs.writeFileSync(file, '{"a":"1","b":"2",}', 'utf-8'); // trailing comma
    assert.throws(
      () => readLocaleFile(file, 'json'),
      (err) => err.message.includes(file) && /trailing comma/.test(err.message)
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// =================================================================
// 12. REGRESSION: L7 — duplicate JSON/TOML key warnings
// =================================================================
describe('REGRESSION L7: duplicate key warnings', () => {
  it('warns on a duplicate JSON key (last-wins is not silent)', () => {
    const dir = mkTmpDir('dupjson');
    const file = path.join(dir, 'en.json');
    fs.writeFileSync(file, '{"home":"First","home":"Second"}', 'utf-8');
    const warnings = [];
    const orig = console.warn;
    console.warn = (m) => warnings.push(m);
    try {
      const data = readLocaleFile(file, 'json');
      assert.equal(data.home, 'Second'); // last-wins still the parse result
    } finally {
      console.warn = orig;
    }
    assert.ok(warnings.some(w => /Duplicate JSON key "home"/.test(w)));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not warn when keys are merely repeated across different objects', () => {
    const dir = mkTmpDir('nodupjson');
    const file = path.join(dir, 'en.json');
    // "other" appears under two distinct parents — not a duplicate.
    fs.writeFileSync(file, '{"a":{"other":"x"},"b":{"other":"y"}}', 'utf-8');
    const warnings = [];
    const orig = console.warn;
    console.warn = (m) => warnings.push(m);
    try {
      readLocaleFile(file, 'json');
    } finally {
      console.warn = orig;
    }
    assert.equal(warnings.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('warns on a duplicate TOML key within a section', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (m) => warnings.push(m);
    try {
      const flat = parseTOMLToFlat('[home]\nother = "First"\nother = "Second"\n');
      assert.equal(flat.home, 'Second');
    } finally {
      console.warn = orig;
    }
    assert.ok(warnings.some(w => /Duplicate TOML key "home\.other"/.test(w)));
  });
});

// =================================================================
// 13. REGRESSION: H7 bonus — atomic write (tmp + rename)
// =================================================================
describe('REGRESSION H7: atomic writeLocaleFile', () => {
  it('writes JSON content and leaves no temp file behind', () => {
    const dir = mkTmpDir('atomic');
    const file = path.join(dir, 'en.json');
    writeLocaleFile(file, { home: 'Home' }, 'json');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf-8')), { home: 'Home' });
    // No leftover *.tmp files.
    assert.ok(!fs.readdirSync(dir).some(f => f.endsWith('.tmp')));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not corrupt the existing file when the rename target is unwritable', () => {
    const dir = mkTmpDir('atomic-fail');
    // Make the target path a non-empty directory so renameSync throws EISDIR.
    const target = path.join(dir, 'en.json');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'sentinel'), 'x');
    assert.throws(() => writeLocaleFile(target, { home: 'Home' }, 'json'));
    // The directory (and its sentinel) survives untouched.
    assert.ok(fs.existsSync(path.join(target, 'sentinel')));
    // No stray temp file.
    assert.ok(!fs.readdirSync(dir).some(f => f.endsWith('.tmp')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
