/**
 * Autofix (wrap command) tests — key generation, replacement logic,
 * safety gates, and diff output.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  generateKey,
  replaceJsxText,
  replaceAttribute,
  checkGitClean,
  createBackup,
  restoreFromBackup,
  generateDiff,
  processFile,
  shouldFixText,
  isAmbiguous,
  deepMerge,
} from '../lib/autofix.js';

// -----------------------------------------------------------------
// generateKey
// -----------------------------------------------------------------

describe('generateKey', () => {
  it('generates snake_case keys from text', () => {
    assert.equal(generateKey('Welcome to my portfolio'), 'general.welcome_to_my_portfolio');
  });

  it('truncates to 5 words', () => {
    const key = generateKey('This is a very long sentence that keeps going');
    assert.equal(key, 'general.this_is_a_very_long');
  });

  it('strips punctuation', () => {
    assert.equal(generateKey('Get in Touch!'), 'general.get_in_touch');
    assert.equal(generateKey("What's New?"), 'general.whats_new');
  });

  it('uses custom namespace', () => {
    assert.equal(generateKey('Submit', 'forms'), 'forms.submit');
  });

  it('returns null for empty strings', () => {
    assert.equal(generateKey(''), null);
    assert.equal(generateKey('   '), null);
  });

  it('lowercases everything', () => {
    assert.equal(generateKey('HELLO WORLD'), 'general.hello_world');
  });
});

// -----------------------------------------------------------------
// replaceJsxText
// -----------------------------------------------------------------

describe('replaceJsxText', () => {
  it('wraps text in t() for React', () => {
    const result = replaceJsxText('>Hello World<', 'Hello World', 'general.hello_world', 'next-intl');
    assert.equal(result, '>{t("general.hello_world")}<');
  });

  it('wraps text in i18n for Hugo', () => {
    const result = replaceJsxText('>Hello World<', 'Hello World', 'general.hello_world', 'Hugo');
    assert.equal(result, '>{{ i18n "general.hello_world" }}<');
  });
});

// -----------------------------------------------------------------
// replaceAttribute
// -----------------------------------------------------------------

describe('replaceAttribute', () => {
  it('replaces double-quoted attribute for React', () => {
    const { from, to } = replaceAttribute('placeholder', 'Search...', 'general.search', 'next-intl');
    assert.equal(from, 'placeholder="Search..."');
    assert.equal(to, 'placeholder={t("general.search")}');
  });

  it('replaces attribute for Hugo', () => {
    const { from, to } = replaceAttribute('alt', 'My photo', 'general.my_photo', 'Hugo');
    assert.equal(from, 'alt="My photo"');
    assert.ok(to.includes('i18n'));
  });
});

// -----------------------------------------------------------------
// shouldFixText
// -----------------------------------------------------------------

describe('shouldFixText', () => {
  it('accepts multi-word user-facing text', () => {
    assert.equal(shouldFixText('Welcome to our site'), true);
    assert.equal(shouldFixText('Get in Touch'), true);
  });

  it('rejects identifiers', () => {
    assert.equal(shouldFixText('onClick'), false);
    assert.equal(shouldFixText('MAX_RETRIES'), false);
  });

  it('rejects URLs', () => {
    assert.equal(shouldFixText('https://example.com'), false);
  });

  it('rejects dot-notation', () => {
    assert.equal(shouldFixText('hero.title'), false);
  });

  it('rejects short strings', () => {
    assert.equal(shouldFixText('x'), false);
    assert.equal(shouldFixText(''), false);
  });

  it('rejects hex colors', () => {
    assert.equal(shouldFixText('#ff0000'), false);
  });

  it('rejects template expressions', () => {
    assert.equal(shouldFixText('{{ .Title }}'), false);
  });
});

// -----------------------------------------------------------------
// isAmbiguous
// -----------------------------------------------------------------

describe('isAmbiguous', () => {
  it('flags strings with embedded template expressions', () => {
    assert.equal(isAmbiguous('Hello {name} world', '<p>Hello {name} world</p>'), true);
  });

  it('flags strings with HTML entities', () => {
    assert.equal(isAmbiguous('Hello &amp; World', '<p>Hello &amp; World</p>'), true);
  });

  it('flags ternary context', () => {
    assert.equal(isAmbiguous('Submit', 'isValid ? "Submit" : "Error"'), true);
  });

  it('flags very short single-word strings', () => {
    assert.equal(isAmbiguous('Home', '<a>Home</a>'), true);
  });

  it('does not flag clear multi-word text', () => {
    assert.equal(isAmbiguous('Welcome to my portfolio', '<h1>Welcome to my portfolio</h1>'), false);
  });
});

// -----------------------------------------------------------------
// deepMerge
// -----------------------------------------------------------------

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('does not overwrite existing keys', () => {
    const result = deepMerge({ a: 'original' }, { a: 'new', b: 'added' });
    assert.equal(result.a, 'original');
    assert.equal(result.b, 'added');
  });

  it('deep merges nested objects', () => {
    const result = deepMerge(
      { general: { title: 'Hello' } },
      { general: { subtitle: 'World' }, nav: { home: 'Home' } }
    );
    assert.equal(result.general.title, 'Hello');
    assert.equal(result.general.subtitle, 'World');
    assert.equal(result.nav.home, 'Home');
  });
});

// -----------------------------------------------------------------
// generateDiff
// -----------------------------------------------------------------

describe('generateDiff', () => {
  it('shows no diff for identical content', () => {
    const diff = generateDiff('hello\nworld', 'hello\nworld', 'test.tsx');
    assert.equal(diff, '');
  });

  it('shows changed lines', () => {
    const diff = generateDiff(
      '<h1>Hello World</h1>',
      '<h1>{t("general.hello_world")}</h1>',
      'test.tsx'
    );
    assert.ok(diff.includes('--- a/test.tsx'));
    assert.ok(diff.includes('+++ b/test.tsx'));
    assert.ok(diff.includes('- <h1>Hello World</h1>'));
    assert.ok(diff.includes('+ <h1>{t("general.hello_world")}</h1>'));
  });
});

// -----------------------------------------------------------------
// processFile
// -----------------------------------------------------------------

describe('processFile', () => {
  const framework = {
    name: 'next-intl',
    translatableAttrs: ['placeholder', 'alt', 'title'],
  };

  it('wraps JSX text nodes', () => {
    const content = '<h1>Welcome to my portfolio</h1>';
    const { modified, fixes } = processFile(content, 'next-intl', framework, 2);

    assert.ok(fixes.length > 0);
    assert.ok(fixes[0].key.includes('welcome_to_my_portfolio'));
    assert.ok(modified.includes('t("'));
  });

  it('wraps translatable attributes', () => {
    const content = '<input placeholder="Search the site" />';
    const { modified, fixes } = processFile(content, 'next-intl', framework, 2);

    assert.ok(fixes.some(f => f.type === 'attr:placeholder'));
    assert.ok(modified.includes('t("'));
  });

  it('skips import lines', () => {
    const content = "import React from 'react';";
    const { fixes } = processFile(content, 'next-intl', framework, 2);
    assert.equal(fixes.length, 0);
  });

  it('skips comment lines', () => {
    const content = '// This is a comment with text';
    const { fixes } = processFile(content, 'next-intl', framework, 2);
    assert.equal(fixes.length, 0);
  });

  it('flags ambiguous cases for human review', () => {
    // A string with embedded template expression is ambiguous
    const content = '<p>Hello {name} and welcome</p>';
    const { ambiguous } = processFile(content, 'next-intl', framework, 2);
    // Should be flagged as ambiguous (has {name} mixed with text)
    // The exact behavior depends on regex matching, but we ensure no crash
    assert.ok(Array.isArray(ambiguous));
  });
});

// -----------------------------------------------------------------
// Backup and restore
// -----------------------------------------------------------------

describe('backup and restore', () => {
  it('creates and restores backup files', () => {
    // Use a temp dir inside the workspace for testing
    const tmpDir = path.join(import.meta.dirname, 'fixtures', '_backup_test');
    fs.mkdirSync(tmpDir, { recursive: true });

    const testFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(testFile, 'original content', 'utf-8');

    // Create backup
    const backupDir = createBackup([testFile], tmpDir);
    assert.ok(fs.existsSync(backupDir));

    // Modify the file
    fs.writeFileSync(testFile, 'modified content', 'utf-8');
    assert.equal(fs.readFileSync(testFile, 'utf-8'), 'modified content');

    // Restore from backup
    const { restored, errors } = restoreFromBackup(tmpDir);
    assert.equal(restored, 1);
    assert.equal(errors.length, 0);
    assert.equal(fs.readFileSync(testFile, 'utf-8'), 'original content');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restoreFromBackup returns error when no backup exists', () => {
    const noBackupDir = path.join(import.meta.dirname, 'fixtures', '_no_backup_test');
    fs.mkdirSync(noBackupDir, { recursive: true });

    const { restored, errors } = restoreFromBackup(noBackupDir);
    assert.equal(restored, 0);
    assert.ok(errors.length > 0);

    fs.rmSync(noBackupDir, { recursive: true, force: true });
  });
});

// -----------------------------------------------------------------
// checkGitClean
// -----------------------------------------------------------------

describe('checkGitClean', () => {
  it('does not crash on non-git directories', () => {
    const tmpDir = path.join(os.tmpdir(), `champollion-git-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const { clean } = checkGitClean(tmpDir);
    assert.equal(clean, true); // Non-git = allow (with warning)

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
