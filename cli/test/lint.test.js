/**
 * Lint engine tests — framework detection, hardcoded string scanning,
 * cross-referencing, and coverage reporting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  detectFramework,
  extractI18nCalls,
  extractHardcodedStrings,
  shouldFlagString,
  findDeadKeys,
  findFuzzyMatch,
  walkDir,
  loadIgnorePatterns,
  FRAMEWORKS,
  GENERIC_FRAMEWORK,
} from '../lib/lint.js';

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'lint');

// -----------------------------------------------------------------
// Framework detection
// -----------------------------------------------------------------

describe('detectFramework', () => {
  it('detects next-intl from package.json', () => {
    const fw = detectFramework(path.join(FIXTURES, 'nextintl'));
    assert.equal(fw.name, 'next-intl');
  });

  it('detects Hugo from hugo.toml', () => {
    const fw = detectFramework(path.join(FIXTURES, 'hugo'));
    assert.equal(fw.name, 'Hugo');
  });

  it('returns generic for unknown projects', () => {
    const fw = detectFramework(path.join(FIXTURES));
    assert.equal(fw.name, 'generic');
  });
});

// -----------------------------------------------------------------
// shouldFlagString
// -----------------------------------------------------------------

describe('shouldFlagString', () => {
  it('flags multi-word user-facing text', () => {
    assert.equal(shouldFlagString('Welcome to my portfolio', 2), true);
    assert.equal(shouldFlagString('Get in Touch', 2), true);
    assert.equal(shouldFlagString('Built with Next.js', 2), true);
  });

  it('ignores short strings', () => {
    assert.equal(shouldFlagString('x', 2), false);
    assert.equal(shouldFlagString('', 2), false);
  });

  it('ignores camelCase identifiers', () => {
    assert.equal(shouldFlagString('heroSection', 2), false);
    assert.equal(shouldFlagString('onClick', 2), false);
  });

  it('ignores SCREAMING_SNAKE constants', () => {
    assert.equal(shouldFlagString('API_KEY', 2), false);
    assert.equal(shouldFlagString('MAX_RETRIES', 2), false);
  });

  it('ignores dot-notation paths', () => {
    assert.equal(shouldFlagString('hero.title', 2), false);
    assert.equal(shouldFlagString('pages.about.description', 2), false);
  });

  it('ignores URLs', () => {
    assert.equal(shouldFlagString('https://example.com', 2), false);
    assert.equal(shouldFlagString('http://localhost:3000', 2), false);
  });

  it('ignores file paths', () => {
    assert.equal(shouldFlagString('/images/logo.png', 2), false);
    assert.equal(shouldFlagString('./components/Header', 2), false);
  });

  it('ignores pure punctuation', () => {
    assert.equal(shouldFlagString('|', 2), false);
    assert.equal(shouldFlagString('---', 2), false);
    assert.equal(shouldFlagString('•', 2), false);
  });

  it('ignores numbers', () => {
    assert.equal(shouldFlagString('42', 2), false);
    assert.equal(shouldFlagString('100%', 2), false);
    assert.equal(shouldFlagString('$29.99', 2), false);
  });

  it('ignores emails', () => {
    assert.equal(shouldFlagString('hello@example.com', 2), false);
  });

  it('ignores hex colors', () => {
    assert.equal(shouldFlagString('#ff0000', 2), false);
    assert.equal(shouldFlagString('#333', 2), false);
  });

  it('ignores short HTML tag-like words', () => {
    assert.equal(shouldFlagString('div', 2), false);
    assert.equal(shouldFlagString('span', 2), false);
  });

  // --- TypeScript type signature filters ---
  it('ignores TypeScript primitive type names', () => {
    assert.equal(shouldFlagString('Promise', 2), false);
    assert.equal(shouldFlagString('string', 2), false);
    assert.equal(shouldFlagString('number', 2), false);
    assert.equal(shouldFlagString('boolean', 2), false);
    assert.equal(shouldFlagString('void', 2), false);
    assert.equal(shouldFlagString('null', 2), false);
    assert.equal(shouldFlagString('undefined', 2), false);
  });

  it('ignores TypeScript generic types', () => {
    assert.equal(shouldFlagString('Promise<void>', 2), false);
    assert.equal(shouldFlagString('Array<string>', 2), false);
    assert.equal(shouldFlagString('Record<string, any>', 2), false);
    assert.equal(shouldFlagString('string[]', 2), false);
  });

  it('ignores type annotation fragments', () => {
    assert.equal(shouldFlagString('}): Promise', 2), false);
    assert.equal(shouldFlagString('): string', 2), false);
    assert.equal(shouldFlagString('}): void', 2), false);
  });

  it('ignores type union/intersection patterns', () => {
    assert.equal(shouldFlagString('string | null', 2), false);
    assert.equal(shouldFlagString('Foo & Bar', 2), false);
  });
});

// -----------------------------------------------------------------
// extractI18nCalls
// -----------------------------------------------------------------

describe('extractI18nCalls', () => {
  it('extracts t() calls from JSX', () => {
    const content = `
      const t = useTranslations('hero');
      return <h1>{t('title')}</h1>;
    `;
    const keys = extractI18nCalls(content, FRAMEWORKS['next-intl']);
    assert.ok(keys.has('title'));
    assert.ok(keys.has('hero'));
  });

  it('extracts Hugo i18n calls', () => {
    const content = `<a href="/">{{ i18n "home" }}</a><p>{{ T "greeting" }}</p>`;
    const keys = extractI18nCalls(content, FRAMEWORKS.hugo);
    assert.ok(keys.has('home'));
    assert.ok(keys.has('greeting'));
  });

  it('returns empty set for no calls', () => {
    const keys = extractI18nCalls('<h1>Just text</h1>', FRAMEWORKS['next-intl']);
    assert.equal(keys.size, 0);
  });
});

// -----------------------------------------------------------------
// extractHardcodedStrings
// -----------------------------------------------------------------

describe('extractHardcodedStrings', () => {
  it('detects JSX text content', () => {
    const content = '<h1>Welcome to my portfolio</h1>';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.text === 'Welcome to my portfolio'));
  });

  it('detects hardcoded placeholder attributes', () => {
    const content = '<input placeholder="Search the site..." />';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.ok(results.some(r => r.text === 'Search the site...'));
    assert.ok(results.some(r => r.context === 'attr:placeholder'));
  });

  it('detects hardcoded alt attributes', () => {
    const content = '<img alt="My profile photo" src="/photo.jpg" />';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.ok(results.some(r => r.text === 'My profile photo'));
  });

  it('ignores import lines', () => {
    const content = "import { useTranslations } from 'next-intl';";
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.equal(results.length, 0);
  });

  it('ignores comment lines', () => {
    const content = '// This is a comment with text';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.equal(results.length, 0);
  });

  it('ignores className values', () => {
    const content = '<div className="hero-section large-text">';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.equal(results.length, 0);
  });

  it('does not flag JSX expressions', () => {
    const content = '<h1>{t("title")}</h1>';
    const results = extractHardcodedStrings(content, 'test.tsx', FRAMEWORKS['next-intl'], 2);
    assert.equal(results.length, 0);
  });

  it('detects hardcoded text in Hugo templates', () => {
    const content = '<h1>Welcome to our site</h1>';
    const results = extractHardcodedStrings(content, 'layout.html', FRAMEWORKS.hugo, 2);
    assert.ok(results.some(r => r.text === 'Welcome to our site'));
  });

  it('skips TypeScript signature lines like "): Promise<Response>"', () => {
    const content = [
      'export async function POST(req: Request',
      '): Promise<Response> {',
      '  return new Response("ok");',
      '}',
    ].join('\n');
    const results = extractHardcodedStrings(content, 'route.ts', FRAMEWORKS['next-intl'], 2);
    // Should NOT flag "): Promise<Response>" fragments
    const texts = results.map(r => r.text);
    assert.ok(!texts.some(t => t.includes('Promise')), `Unexpected TS type flagged: ${JSON.stringify(texts)}`);
  });
});

// -----------------------------------------------------------------
// findDeadKeys
// -----------------------------------------------------------------

describe('findDeadKeys', () => {
  it('identifies keys not referenced in source', () => {
    const i18nKeys = new Set(['title', 'about']);
    const localeKeys = {
      'hero.title': 'Welcome',
      'nav.about': 'About',
      'unused.legacy': 'Old content',
    };
    const dead = findDeadKeys(i18nKeys, localeKeys);
    assert.ok(dead.includes('unused.legacy'));
    // hero.title should NOT be dead because 'title' matches via namespace
    assert.ok(!dead.includes('hero.title'));
  });

  it('returns empty for fully referenced keys', () => {
    const i18nKeys = new Set(['hero.title', 'nav.about']);
    const localeKeys = { 'hero.title': 'Welcome', 'nav.about': 'About' };
    const dead = findDeadKeys(i18nKeys, localeKeys);
    assert.equal(dead.length, 0);
  });
});

// -----------------------------------------------------------------
// findFuzzyMatch
// -----------------------------------------------------------------

describe('findFuzzyMatch', () => {
  it('finds exact value match', () => {
    const entries = [['hero.title', 'Welcome to my portfolio']];
    const match = findFuzzyMatch('Welcome to my portfolio', entries);
    assert.ok(match);
    assert.equal(match.key, 'hero.title');
    assert.equal(match.confidence, 'exact');
  });

  it('returns null for no match', () => {
    const entries = [['hero.title', 'Something completely different']];
    const match = findFuzzyMatch('Welcome to my portfolio', entries);
    assert.equal(match, null);
  });

  it('handles case-insensitive matching', () => {
    const entries = [['cta.action', 'Get In Touch']];
    const match = findFuzzyMatch('get in touch', entries);
    assert.ok(match);
    assert.equal(match.key, 'cta.action');
  });
});

// -----------------------------------------------------------------
// walkDir
// -----------------------------------------------------------------

describe('walkDir', () => {
  it('finds files with matching extensions', () => {
    const dir = path.join(FIXTURES, 'nextintl', 'src');
    const files = walkDir(dir, ['.tsx', '.jsx'], ['node_modules']);
    assert.ok(files.length >= 3);
    assert.ok(files.some(f => f.endsWith('good.tsx')));
    assert.ok(files.some(f => f.endsWith('bad.tsx')));
  });

  it('respects ignore patterns', () => {
    const dir = path.join(FIXTURES, 'nextintl');
    const files = walkDir(dir, ['.json'], ['messages']);
    // Should find package.json but NOT messages/en.json
    assert.ok(files.some(f => f.endsWith('package.json')));
    assert.ok(!files.some(f => f.includes('messages')));
  });

  it('returns empty for non-existent dir', () => {
    const files = walkDir('/nonexistent/path', ['.tsx'], []);
    assert.equal(files.length, 0);
  });
});

// -----------------------------------------------------------------
// Integration: fixture scanning
// -----------------------------------------------------------------

describe('fixture integration', () => {
  it('good.tsx produces zero hardcoded strings', () => {

    const content = fs.readFileSync(
      path.join(FIXTURES, 'nextintl', 'src', 'good.tsx'), 'utf-8'
    );
    const results = extractHardcodedStrings(content, 'good.tsx', FRAMEWORKS['next-intl'], 2);
    assert.equal(results.length, 0, `Expected 0 hardcoded strings but found: ${JSON.stringify(results)}`);
  });

  it('bad.tsx produces multiple hardcoded strings', () => {

    const content = fs.readFileSync(
      path.join(FIXTURES, 'nextintl', 'src', 'bad.tsx'), 'utf-8'
    );
    const results = extractHardcodedStrings(content, 'bad.tsx', FRAMEWORKS['next-intl'], 2);
    assert.ok(results.length >= 3, `Expected >=3 hardcoded strings but found ${results.length}`);
    // Should catch the heading, paragraph, button, placeholder, alt
    const texts = results.map(r => r.text);
    assert.ok(texts.includes('Welcome to my portfolio'));
    assert.ok(texts.includes('Get in Touch'));
  });

  it('no-i18n.tsx has hardcoded content and no framework import', () => {

    const content = fs.readFileSync(
      path.join(FIXTURES, 'nextintl', 'src', 'no-i18n.tsx'), 'utf-8'
    );
    const fw = FRAMEWORKS['next-intl'];
    const hardcoded = extractHardcodedStrings(content, 'no-i18n.tsx', fw, 2);
    assert.ok(hardcoded.length > 0);
    // Check framework import is missing
    assert.ok(!fw.frameworkImport.test(content));
  });

  it('Hugo good.html has zero hardcoded strings', () => {

    const content = fs.readFileSync(
      path.join(FIXTURES, 'hugo', 'layouts', 'good.html'), 'utf-8'
    );
    const results = extractHardcodedStrings(content, 'good.html', FRAMEWORKS.hugo, 2);
    // Should only find template expressions, not flaggable text
    const flagged = results.filter(r => shouldFlagString(r.text, 2));
    assert.equal(flagged.length, 0, `Expected 0 but found: ${JSON.stringify(flagged)}`);
  });

  it('Hugo bad.html detects hardcoded text', () => {

    const content = fs.readFileSync(
      path.join(FIXTURES, 'hugo', 'layouts', 'bad.html'), 'utf-8'
    );
    const results = extractHardcodedStrings(content, 'bad.html', FRAMEWORKS.hugo, 2);
    assert.ok(results.length > 0);
    const texts = results.map(r => r.text);
    assert.ok(texts.some(t => t.includes('Welcome to our site')));
  });
});

// -----------------------------------------------------------------
// .champollionignore
// -----------------------------------------------------------------

describe('loadIgnorePatterns', () => {
  it('returns empty array when no .champollionignore exists', () => {
    const patterns = loadIgnorePatterns(path.join(FIXTURES));
    assert.deepEqual(patterns, []);
  });

  it('parses patterns from .champollionignore file', () => {

    const tmpDir = path.join(FIXTURES, '_ignore_test');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.champollionignore'), [
      '# Admin tools',
      'admin',
      'games/',
      '',
      '# Build artifacts',
      'dist',
    ].join('\n'));

    const patterns = loadIgnorePatterns(tmpDir);
    assert.deepEqual(patterns, ['admin', 'games/', 'dist']);

    // Cleanup
    fs.unlinkSync(path.join(tmpDir, '.champollionignore'));
    fs.rmdirSync(tmpDir);
  });
});
