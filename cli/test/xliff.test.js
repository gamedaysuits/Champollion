import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportXLIFF,
  importXLIFF,
  escapeXML,
  unescapeXML,
} from '../lib/xliff.js';

// =================================================================
// XML escaping
// =================================================================

test('escapeXML: escapes all 5 XML entities', () => {
  assert.equal(escapeXML('&'), '&amp;');
  assert.equal(escapeXML('<'), '&lt;');
  assert.equal(escapeXML('>'), '&gt;');
  assert.equal(escapeXML('"'), '&quot;');
  assert.equal(escapeXML("'"), '&apos;');
});

test('escapeXML: handles mixed content', () => {
  assert.equal(escapeXML('A & B <C>'), 'A &amp; B &lt;C&gt;');
});

test('unescapeXML: reverses escapeXML', () => {
  const original = 'Tom & Jerry\'s <"adventure">';
  assert.equal(unescapeXML(escapeXML(original)), original);
});

// =================================================================
// exportXLIFF — generation
// =================================================================

test('exportXLIFF: generates valid XLIFF 1.2 header', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'key': 'Hello' },
    targetFlat: { 'key': 'Bonjour' },
  });

  assert.ok(xliff.includes('<?xml version="1.0"'));
  assert.ok(xliff.includes('version="1.2"'));
  assert.ok(xliff.includes('source-language="en"'));
  assert.ok(xliff.includes('target-language="fr"'));
  assert.ok(xliff.includes('tool-id="champollion"'));
});

test('exportXLIFF: includes source and target values', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'greeting': 'Hello' },
    targetFlat: { 'greeting': 'Bonjour' },
  });

  assert.ok(xliff.includes('<source>Hello</source>'));
  assert.ok(xliff.includes('<target state="translated">Bonjour</target>'));
});

test('exportXLIFF: marks untranslated keys as state="new"', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'key': 'Hello' },
    targetFlat: {},
  });

  assert.ok(xliff.includes('state="new"'));
});

test('exportXLIFF: escapes special characters in keys and values', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'key.with "quotes"': 'Value with <html> & "entities"' },
    targetFlat: {},
  });

  assert.ok(xliff.includes('&amp;'));
  assert.ok(xliff.includes('&lt;html&gt;'));
});

test('exportXLIFF: includes multiple trans-units', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'de',
    sourceFlat: { 'k1': 'Hello', 'k2': 'World', 'k3': 'Goodbye' },
    targetFlat: { 'k1': 'Hallo', 'k2': 'Welt' },
  });

  // Should have 3 trans-unit elements
  const unitCount = (xliff.match(/<trans-unit/g) || []).length;
  assert.equal(unitCount, 3);
});

test('exportXLIFF: uses custom original filename', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'k': 'v' },
    targetFlat: {},
    original: 'messages.json',
  });

  assert.ok(xliff.includes('original="messages.json"'));
});

// =================================================================
// importXLIFF — parsing
// =================================================================

test('importXLIFF: round-trips through export/import', () => {
  const sourceFlat = { 'greeting': 'Hello', 'farewell': 'Goodbye' };
  const targetFlat = { 'greeting': 'Bonjour', 'farewell': 'Au revoir' };

  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat,
    targetFlat,
  });

  const { translations, metadata } = importXLIFF(xliff);

  assert.equal(metadata.sourceLocale, 'en');
  assert.equal(metadata.targetLocale, 'fr');
  assert.equal(translations['greeting'], 'Bonjour');
  assert.equal(translations['farewell'], 'Au revoir');
});

test('importXLIFF: skips empty target elements', () => {
  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat: { 'k1': 'Hello', 'k2': 'World' },
    targetFlat: { 'k1': 'Bonjour' },  // k2 has no target
  });

  const { translations } = importXLIFF(xliff);
  assert.equal(translations['k1'], 'Bonjour');
  assert.ok(!('k2' in translations), 'Empty target should be excluded');
});

test('importXLIFF: unescapes XML entities in translations', () => {
  const sourceFlat = { 'html': 'Use <b> & "quotes"' };
  const targetFlat = { 'html': 'Utiliser <b> & "guillemets"' };

  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat,
    targetFlat,
  });

  const { translations } = importXLIFF(xliff);
  assert.equal(translations['html'], 'Utiliser <b> & "guillemets"');
});

test('importXLIFF: handles Unicode content', () => {
  const sourceFlat = { 'greeting': 'Hello' };
  const targetFlat = { 'greeting': 'こんにちは' };

  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'ja',
    sourceFlat,
    targetFlat,
  });

  const { translations } = importXLIFF(xliff);
  assert.equal(translations['greeting'], 'こんにちは');
});

test('importXLIFF: handles keys with dots and brackets', () => {
  const sourceFlat = { 'app.errors[0].message': 'Error occurred' };
  const targetFlat = { 'app.errors[0].message': 'Erreur survenue' };

  const xliff = exportXLIFF({
    sourceLocale: 'en',
    targetLocale: 'fr',
    sourceFlat,
    targetFlat,
  });

  const { translations } = importXLIFF(xliff);
  assert.equal(translations['app.errors[0].message'], 'Erreur survenue');
});

test('importXLIFF: returns empty translations for empty XLIFF', () => {
  const { translations, metadata } = importXLIFF('<?xml version="1.0"?><xliff/>');
  assert.equal(Object.keys(translations).length, 0);
});
