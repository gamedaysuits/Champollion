import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isICUString,
  parseICU,
  extractTranslatableSegments,
  reassembleICU,
  getRequiredPluralCategories,
} from '../lib/icu.js';

// =================================================================
// isICUString — fast detection
// =================================================================

test('isICUString: detects simple argument', () => {
  assert.ok(isICUString('Hello, {name}!'));
});

test('isICUString: detects plural', () => {
  assert.ok(isICUString('{count, plural, one {# item} other {# items}}'));
});

test('isICUString: detects select', () => {
  assert.ok(isICUString('{gender, select, male {He} female {She} other {They}}'));
});

test('isICUString: detects selectordinal', () => {
  assert.ok(isICUString('{floor, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'));
});

test('isICUString: rejects plain text', () => {
  assert.ok(!isICUString('Hello world'));
  assert.ok(!isICUString('No braces here'));
  assert.ok(!isICUString(''));
});

test('isICUString: rejects non-string input', () => {
  assert.ok(!isICUString(null));
  assert.ok(!isICUString(42));
  assert.ok(!isICUString(undefined));
});

test('isICUString: detects multiple simple arguments', () => {
  assert.ok(isICUString('{firstName} {lastName}'));
});

// =================================================================
// parseICU — AST generation
// =================================================================

test('parseICU: parses simple text', () => {
  const ast = parseICU('Hello world');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'text');
  assert.equal(ast[0].value, 'Hello world');
});

test('parseICU: parses simple argument', () => {
  const ast = parseICU('Hello, {name}!');
  assert.equal(ast.length, 3);
  assert.equal(ast[0].type, 'text');
  assert.equal(ast[0].value, 'Hello, ');
  assert.equal(ast[1].type, 'argument');
  assert.equal(ast[1].name, 'name');
  assert.equal(ast[2].type, 'text');
  assert.equal(ast[2].value, '!');
});

test('parseICU: parses plural', () => {
  const ast = parseICU('{count, plural, one {# document} other {# documents}}');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'plural');
  assert.equal(ast[0].name, 'count');
  assert.ok('one' in ast[0].options);
  assert.ok('other' in ast[0].options);
});

test('parseICU: parses select', () => {
  const ast = parseICU('{gender, select, male {He} female {She} other {They}}');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'select');
  assert.equal(ast[0].name, 'gender');
  assert.ok('male' in ast[0].options);
  assert.ok('female' in ast[0].options);
  assert.ok('other' in ast[0].options);
});

test('parseICU: parses text before and after argument', () => {
  const ast = parseICU('Welcome, {name}. You have {count} messages.');
  // text("Welcome, ") + arg(name) + text(". You have ") + arg(count) + text(" messages.")
  assert.equal(ast.length, 5);
  assert.equal(ast[0].type, 'text');
  assert.equal(ast[0].value, 'Welcome, ');
  assert.equal(ast[1].type, 'argument');
  assert.equal(ast[1].name, 'name');
  assert.equal(ast[2].type, 'text');
  assert.equal(ast[2].value, '. You have ');
  assert.equal(ast[3].type, 'argument');
  assert.equal(ast[3].name, 'count');
  assert.equal(ast[4].type, 'text');
  assert.equal(ast[4].value, ' messages.');
});

test('parseICU: handles exact match categories (=0, =1)', () => {
  const ast = parseICU('{count, plural, =0 {no items} =1 {one item} other {# items}}');
  assert.equal(ast[0].type, 'plural');
  assert.ok('=0' in ast[0].options);
  assert.ok('=1' in ast[0].options);
  assert.ok('other' in ast[0].options);
});

test('parseICU: handles empty string', () => {
  const ast = parseICU('');
  assert.equal(ast.length, 0);
});

test('parseICU: handles null input', () => {
  const ast = parseICU(null);
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'text');
});

// =================================================================
// extractTranslatableSegments — leaf text extraction
// =================================================================

test('extractTranslatableSegments: extracts text from simple string', () => {
  const ast = parseICU('Hello, {name}!');
  const segments = extractTranslatableSegments(ast);
  // "Hello, " and "!" are text nodes
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, 'Hello, ');
  assert.equal(segments[1].text, '!');
});

test('extractTranslatableSegments: extracts text from plural options', () => {
  const ast = parseICU('{count, plural, one {# document} other {# documents}}');
  const segments = extractTranslatableSegments(ast);

  // Each plural option has "# document" / "# documents" — the # is kept
  // but segments with only # and whitespace are skipped
  assert.ok(segments.length >= 2, `Expected at least 2 segments, got ${segments.length}`);

  const texts = segments.map(s => s.text);
  assert.ok(texts.some(t => t.includes('document')));
  assert.ok(texts.some(t => t.includes('documents')));
});

test('extractTranslatableSegments: extracts text from select options', () => {
  const ast = parseICU('{gender, select, male {He liked this} female {She liked this} other {They liked this}}');
  const segments = extractTranslatableSegments(ast);

  const texts = segments.map(s => s.text);
  assert.ok(texts.some(t => t.includes('He liked this')));
  assert.ok(texts.some(t => t.includes('She liked this')));
  assert.ok(texts.some(t => t.includes('They liked this')));
});

test('extractTranslatableSegments: paths are unique and addressable', () => {
  const ast = parseICU('{count, plural, one {# item} other {# items}}');
  const segments = extractTranslatableSegments(ast);

  const paths = segments.map(s => s.path);
  // All paths should be unique
  assert.equal(new Set(paths).size, paths.length, 'All paths should be unique');

  // Paths should include category info
  assert.ok(paths.some(p => p.includes('plural.one')));
  assert.ok(paths.some(p => p.includes('plural.other')));
});

test('extractTranslatableSegments: does not extract argument names', () => {
  const ast = parseICU('{name} has {count} items');
  const segments = extractTranslatableSegments(ast);

  // Only text nodes, not arguments
  for (const seg of segments) {
    assert.ok(!seg.text.includes('{'), 'Segments should not contain braces');
  }
});

// =================================================================
// reassembleICU — round-trip integrity
// =================================================================

test('reassembleICU: round-trips simple argument string', () => {
  const original = 'Hello, {name}!';
  const ast = parseICU(original);
  const segments = extractTranslatableSegments(ast);

  // Simulate translation: keep segments unchanged
  const translatedMap = new Map();
  for (const seg of segments) {
    translatedMap.set(seg.path, seg.text);
  }

  const result = reassembleICU(ast, translatedMap);
  assert.equal(result, original);
});

test('reassembleICU: round-trips plural string', () => {
  const original = '{count, plural, one {# document} other {# documents}}';
  const ast = parseICU(original);
  const segments = extractTranslatableSegments(ast);

  const translatedMap = new Map();
  for (const seg of segments) {
    translatedMap.set(seg.path, seg.text);
  }

  const result = reassembleICU(ast, translatedMap);
  assert.equal(result, original);
});

test('reassembleICU: applies translated text correctly', () => {
  const original = 'Hello, {name}!';
  const ast = parseICU(original);
  const segments = extractTranslatableSegments(ast);

  // Translate "Hello, " → "Bonjour, " and "!" → " !"
  const translatedMap = new Map();
  for (const seg of segments) {
    if (seg.text === 'Hello, ') {
      translatedMap.set(seg.path, 'Bonjour, ');
    } else {
      translatedMap.set(seg.path, ' !');
    }
  }

  const result = reassembleICU(ast, translatedMap);
  assert.equal(result, 'Bonjour, {name} !');
});

test('reassembleICU: preserves plural structure with translations', () => {
  const original = '{count, plural, one {# document} other {# documents}}';
  const ast = parseICU(original);
  const segments = extractTranslatableSegments(ast);

  // Translate to French
  const translatedMap = new Map();
  for (const seg of segments) {
    if (seg.text.includes('documents')) {
      translatedMap.set(seg.path, '# documents');
    } else if (seg.text.includes('document')) {
      translatedMap.set(seg.path, '# document');
    }
  }

  const result = reassembleICU(ast, translatedMap);
  assert.ok(result.includes('plural'));
  assert.ok(result.includes('one'));
  assert.ok(result.includes('other'));
  assert.ok(result.includes('{count'));
});

test('reassembleICU: preserves select structure with translations', () => {
  const original = '{gender, select, male {He} female {She} other {They}}';
  const ast = parseICU(original);
  const segments = extractTranslatableSegments(ast);

  // Translate to French
  const translatedMap = new Map();
  for (const seg of segments) {
    if (seg.text === 'He') translatedMap.set(seg.path, 'Il');
    else if (seg.text === 'She') translatedMap.set(seg.path, 'Elle');
    else if (seg.text === 'They') translatedMap.set(seg.path, 'Iels');
  }

  const result = reassembleICU(ast, translatedMap);
  assert.ok(result.includes('select'));
  assert.ok(result.includes('Il'));
  assert.ok(result.includes('Elle'));
  assert.ok(result.includes('Iels'));
});

// =================================================================
// getRequiredPluralCategories — language card integration
// =================================================================

test('getRequiredPluralCategories: returns categories from French card', () => {
  const categories = getRequiredPluralCategories('fr');
  assert.ok(Array.isArray(categories));
  assert.ok(categories.includes('one'));
  assert.ok(categories.includes('other'));
});

test('getRequiredPluralCategories: returns 6 categories for Arabic', () => {
  const categories = getRequiredPluralCategories('ar');
  assert.ok(Array.isArray(categories));
  assert.ok(categories.includes('zero'));
  assert.ok(categories.includes('one'));
  assert.ok(categories.includes('two'));
  assert.ok(categories.includes('few'));
  assert.ok(categories.includes('many'));
  assert.ok(categories.includes('other'));
});

test('getRequiredPluralCategories: falls back to [other] for unknown locale', () => {
  const categories = getRequiredPluralCategories('xx-unknown');
  assert.deepEqual(categories, ['other']);
});

test('getRequiredPluralCategories: falls back for conlang without plural rules', () => {
  const categories = getRequiredPluralCategories('tlh');
  // Klingon might not have plural rules defined — should get ['other']
  assert.ok(Array.isArray(categories));
  assert.ok(categories.includes('other'));
});
