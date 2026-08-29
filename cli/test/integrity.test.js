/**
 * Integrity linter tests — placeholder preservation, encoding,
 * cross-locale parity, and orphaned key detection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  extractPlaceholders,
  comparePlaceholders,
  checkEncoding,
  findUntranslatedCopies,
  isLocaleInvariant,
  findOrphanedKeys,
  auditLocalePair,
  formatIntegrityReport,
  hasBOM,
} from '../lib/integrity.js';

// -----------------------------------------------------------------
// extractPlaceholders
// -----------------------------------------------------------------

describe('extractPlaceholders', () => {
  it('extracts simple ICU placeholders', () => {
    const result = extractPlaceholders('Hello, {name}! You have {count} messages.');
    assert.deepEqual(result, ['count', 'name']);
  });

  it('extracts React-intl XML tags', () => {
    const result = extractPlaceholders('Read our <link>terms</link> and <bold>policy</bold>.');
    assert.deepEqual(result, ['<bold>', '<link>']);
  });

  it('handles mixed placeholders and tags', () => {
    const result = extractPlaceholders('{name}, click <link>here</link>');
    assert.deepEqual(result, ['<link>', 'name']);
  });

  it('returns empty for strings without placeholders', () => {
    const result = extractPlaceholders('Just a plain string');
    assert.deepEqual(result, []);
  });

  it('returns empty for non-strings', () => {
    assert.deepEqual(extractPlaceholders(null), []);
    assert.deepEqual(extractPlaceholders(42), []);
    assert.deepEqual(extractPlaceholders(undefined), []);
  });

  it('handles ICU plural syntax', () => {
    const result = extractPlaceholders('{count, plural, one {# item} other {# items}}');
    assert.ok(result.includes('count'));
  });
});

// -----------------------------------------------------------------
// comparePlaceholders
// -----------------------------------------------------------------

describe('comparePlaceholders', () => {
  it('detects missing placeholders in translation', () => {
    const result = comparePlaceholders(
      'Hello {name}, you have {count} items',
      'Bonjour {name}, vous avez des articles'
    );
    assert.deepEqual(result.missing, ['count']);
    assert.deepEqual(result.extra, []);
  });

  it('detects extra placeholders in translation', () => {
    const result = comparePlaceholders(
      'Hello {name}',
      'Bonjour {name}, bienvenue {user}'
    );
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.extra, ['user']);
  });

  it('returns empty when placeholders match', () => {
    const result = comparePlaceholders(
      'Hello {name}',
      'Bonjour {name}'
    );
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.extra, []);
  });

  it('handles strings with no placeholders', () => {
    const result = comparePlaceholders('Hello world', 'Bonjour le monde');
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.extra, []);
  });
});

// -----------------------------------------------------------------
// checkEncoding
// -----------------------------------------------------------------

describe('checkEncoding', () => {
  it('detects BOM marker', () => {
    const issues = checkEncoding('\uFEFFHello');
    assert.ok(issues.some(i => i.name === 'BOM (Byte Order Mark)'));
    assert.ok(issues.some(i => i.severity === 'error'));
  });

  it('detects zero-width space', () => {
    const issues = checkEncoding('Hello\u200BWorld');
    assert.ok(issues.some(i => i.name === 'Zero-Width Space (ZWSP)'));
  });

  it('detects replacement character (encoding error)', () => {
    const issues = checkEncoding('Hello\uFFFDWorld');
    assert.ok(issues.some(i => i.name === 'Replacement Character (encoding error)'));
    assert.ok(issues.some(i => i.severity === 'error'));
  });

  it('detects LTR/RTL override (dangerous)', () => {
    const issues = checkEncoding('Hello\u202EWorld');
    assert.ok(issues.some(i => i.name === 'Right-to-Left Override'));
    assert.ok(issues.some(i => i.severity === 'error'));
  });

  it('returns empty for clean strings', () => {
    const issues = checkEncoding('Hello World! こんにちは 🎉');
    assert.deepEqual(issues, []);
  });

  it('returns empty for non-strings', () => {
    assert.deepEqual(checkEncoding(42), []);
    assert.deepEqual(checkEncoding(null), []);
  });
});

// -----------------------------------------------------------------
// isLocaleInvariant
// -----------------------------------------------------------------

describe('isLocaleInvariant', () => {
  it('marks URLs as invariant', () => {
    assert.equal(isLocaleInvariant('https://example.com'), true);
    assert.equal(isLocaleInvariant('http://localhost:3000'), true);
  });

  it('marks emails as invariant', () => {
    assert.equal(isLocaleInvariant('hello@example.com'), true);
  });

  it('marks pure numbers as invariant', () => {
    assert.equal(isLocaleInvariant('42'), true);
    assert.equal(isLocaleInvariant('$29.99'), true);
  });

  it('marks short codes as invariant', () => {
    assert.equal(isLocaleInvariant('en'), true);
    assert.equal(isLocaleInvariant('USD'), true);
  });

  it('marks brand names as invariant', () => {
    assert.equal(isLocaleInvariant('GitHub'), true);
    assert.equal(isLocaleInvariant('Google'), true);
  });

  it('does NOT mark real text as invariant', () => {
    assert.equal(isLocaleInvariant('Welcome to our site'), false);
    assert.equal(isLocaleInvariant('Get in touch'), false);
  });

  it('marks empty strings as invariant', () => {
    assert.equal(isLocaleInvariant(''), true);
    assert.equal(isLocaleInvariant('  '), true);
  });
});

// -----------------------------------------------------------------
// findUntranslatedCopies
// -----------------------------------------------------------------

describe('findUntranslatedCopies', () => {
  it('detects identical source/target values', () => {
    const source = { 'hero.title': 'Welcome to our site', 'nav.home': 'Home' };
    const target = { 'hero.title': 'Welcome to our site', 'nav.home': 'Accueil' };
    const copies = findUntranslatedCopies(source, target, 'fr');
    assert.deepEqual(copies, ['hero.title']);
  });

  it('ignores locale-invariant values', () => {
    const source = { 'url': 'https://example.com', 'brand': 'GitHub' };
    const target = { 'url': 'https://example.com', 'brand': 'GitHub' };
    const copies = findUntranslatedCopies(source, target, 'fr');
    assert.deepEqual(copies, []);
  });

  it('returns empty when everything is translated', () => {
    const source = { 'title': 'Hello' };
    const target = { 'title': 'Bonjour' };
    const copies = findUntranslatedCopies(source, target, 'fr');
    assert.deepEqual(copies, []);
  });
});

// -----------------------------------------------------------------
// findOrphanedKeys
// -----------------------------------------------------------------

describe('findOrphanedKeys', () => {
  it('finds keys in target but not source', () => {
    const source = { 'title': 'Hello' };
    const target = { 'title': 'Bonjour', 'legacy.old': 'Ancien' };
    const orphans = findOrphanedKeys(source, target);
    assert.deepEqual(orphans, ['legacy.old']);
  });

  it('returns empty when target is a subset of source', () => {
    const source = { 'title': 'Hello', 'sub': 'World' };
    const target = { 'title': 'Bonjour' };
    const orphans = findOrphanedKeys(source, target);
    assert.deepEqual(orphans, []);
  });
});

// -----------------------------------------------------------------
// auditLocalePair
// -----------------------------------------------------------------

describe('auditLocalePair', () => {
  it('catches placeholder issues', () => {
    const source = { 'greeting': 'Hello {name}' };
    const target = { 'greeting': 'Bonjour' };
    const audit = auditLocalePair(source, target, 'fr');
    assert.equal(audit.placeholderIssues.length, 1);
    assert.deepEqual(audit.placeholderIssues[0].missing, ['name']);
  });

  it('catches encoding issues', () => {
    const source = { 'title': 'Hello' };
    const target = { 'title': '\uFEFFBonjour' };
    const audit = auditLocalePair(source, target, 'fr');
    assert.equal(audit.encodingIssues.length, 1);
  });

  it('catches untranslated copies', () => {
    const source = { 'msg': 'Welcome to our platform' };
    const target = { 'msg': 'Welcome to our platform' };
    const audit = auditLocalePair(source, target, 'fr');
    assert.equal(audit.copies.length, 1);
  });

  it('catches orphaned keys', () => {
    const source = { 'title': 'Hello' };
    const target = { 'title': 'Bonjour', 'removed': 'Legacy' };
    const audit = auditLocalePair(source, target, 'fr');
    assert.equal(audit.orphans.length, 1);
  });

  it('returns clean audit for perfect translations', () => {
    const source = { 'title': 'Hello {name}' };
    const target = { 'title': 'Bonjour {name}' };
    const audit = auditLocalePair(source, target, 'fr');
    assert.equal(audit.placeholderIssues.length, 0);
    assert.equal(audit.encodingIssues.length, 0);
    assert.equal(audit.copies.length, 0);
    assert.equal(audit.orphans.length, 0);
  });
});

// -----------------------------------------------------------------
// formatIntegrityReport
// -----------------------------------------------------------------

describe('formatIntegrityReport', () => {
  it('shows pass message for clean audit', () => {
    const report = formatIntegrityReport('fr', {
      placeholderIssues: [],
      encodingIssues: [],
      copies: [],
      orphans: [],
    });
    assert.ok(report.includes('All checks passed'));
  });

  it('includes placeholder issues in report', () => {
    const report = formatIntegrityReport('fr', {
      placeholderIssues: [{ key: 'greeting', missing: ['name'], extra: [], sourceVal: 'Hi {name}', targetVal: 'Bonjour' }],
      encodingIssues: [],
      copies: [],
      orphans: [],
    });
    assert.ok(report.includes('PLACEHOLDER'));
    assert.ok(report.includes('greeting'));
    assert.ok(report.includes('name'));
  });

  it('includes encoding issues in report', () => {
    const report = formatIntegrityReport('fr', {
      placeholderIssues: [],
      encodingIssues: [{ key: 'title', value: '\uFEFFHello', issues: [{ name: 'BOM', severity: 'error' }] }],
      copies: [],
      orphans: [],
    });
    assert.ok(report.includes('ENCODING'));
  });
});

// -----------------------------------------------------------------
// REGRESSION M2: integrity REPORTS a BOM instead of dying on it
// -----------------------------------------------------------------
describe('REGRESSION M2: BOM reporting in integrity', () => {
  it('hasBOM detects a UTF-8 BOM', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-bom-int-'));
    const withBom = path.join(dir, 'fr.json');
    const noBom = path.join(dir, 'en.json');
    fs.writeFileSync(withBom, '﻿{"a":"x"}', 'utf-8');
    fs.writeFileSync(noBom, '{"a":"x"}', 'utf-8');
    assert.equal(hasBOM(withBom), true);
    assert.equal(hasBOM(noBom), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('auditLocalePair surfaces BOM-prefixed files when paths are passed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-bom-audit-'));
    const targetFile = path.join(dir, 'fr.json');
    const sourceFile = path.join(dir, 'en.json');
    fs.writeFileSync(targetFile, '﻿{"a":"x"}', 'utf-8'); // BOM on target
    fs.writeFileSync(sourceFile, '{"a":"x"}', 'utf-8');
    const audit = auditLocalePair({ a: 'x' }, { a: 'y' }, 'fr', { sourceFile, targetFile });
    assert.deepEqual(audit.bomFiles, [targetFile]);
    const report = formatIntegrityReport('fr', audit);
    assert.ok(report.includes('BYTE ORDER MARK'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports no BOM issue when files are clean (and when no paths given)', () => {
    const auditNoPaths = auditLocalePair({ a: 'x' }, { a: 'y' }, 'fr');
    assert.deepEqual(auditNoPaths.bomFiles, []);
  });
});
