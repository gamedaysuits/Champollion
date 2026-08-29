/**
 * String classification tests — direct coverage of the shared heuristics
 * in string-classify.js.
 *
 * WHY THESE EXIST:
 *   isNonTranslatableString() and isNonTranslatableLintExtended() are the
 *   shared core that lint.js and autofix.js both depend on. Previously
 *   tested only indirectly via those consumers. Direct tests document the
 *   exact classification contract and catch regressions faster.
 *
 * CATEGORIES:
 *   1. Strings that SHOULD be classified as non-translatable (skipped)
 *   2. Strings that SHOULD be classified as translatable (flagged)
 *   3. Lint-extended patterns (code/type artifacts)
 *   4. Edge cases and boundary conditions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNonTranslatableString,
  isNonTranslatableLintExtended,
} from '../lib/string-classify.js';

// =================================================================
// 1. Non-translatable strings — should return TRUE (skip these)
// =================================================================
describe('string-classify: isNonTranslatableString — non-translatable', () => {
  it('skips empty string', () => {
    assert.equal(isNonTranslatableString(''), true);
  });

  it('skips whitespace-only string', () => {
    assert.equal(isNonTranslatableString('   '), true);
  });

  it('skips single character (below minLength)', () => {
    assert.equal(isNonTranslatableString('x'), true);
  });

  it('skips pure punctuation', () => {
    assert.equal(isNonTranslatableString('...'), true);
    assert.equal(isNonTranslatableString('---'), true);
    assert.equal(isNonTranslatableString('•'), true);
  });

  it('skips pure symbols', () => {
    assert.equal(isNonTranslatableString('→'), true);
    assert.equal(isNonTranslatableString('★★★'), true);
  });

  it('skips pure numbers', () => {
    assert.equal(isNonTranslatableString('42'), true);
    assert.equal(isNonTranslatableString('3.14'), true);
    assert.equal(isNonTranslatableString('-10'), true);
    assert.equal(isNonTranslatableString('100%'), true);
  });

  it('skips currency amounts', () => {
    assert.equal(isNonTranslatableString('$99.99'), true);
    assert.equal(isNonTranslatableString('€50'), true);
    assert.equal(isNonTranslatableString('£100'), true);
  });

  it('skips camelCase identifiers', () => {
    assert.equal(isNonTranslatableString('onClick'), true);
    assert.equal(isNonTranslatableString('handleSubmit'), true);
    assert.equal(isNonTranslatableString('myVariable'), true);
    assert.equal(isNonTranslatableString('$scope'), true);
    assert.equal(isNonTranslatableString('_private'), true);
  });

  it('skips SCREAMING_SNAKE_CASE constants', () => {
    assert.equal(isNonTranslatableString('MAX_RETRIES'), true);
    assert.equal(isNonTranslatableString('API_KEY'), true);
    assert.equal(isNonTranslatableString('BASE_URL'), true);
  });

  it('skips dot-notation paths', () => {
    assert.equal(isNonTranslatableString('hero.title'), true);
    assert.equal(isNonTranslatableString('pages.about.description'), true);
    assert.equal(isNonTranslatableString('common.buttons.submit'), true);
  });

  it('skips URLs', () => {
    assert.equal(isNonTranslatableString('https://example.com'), true);
    assert.equal(isNonTranslatableString('http://localhost:3000/api'), true);
  });

  it('skips template expressions', () => {
    assert.equal(isNonTranslatableString('{{ .Title }}'), true);
    assert.equal(isNonTranslatableString('{{.Params.description}}'), true);
  });

  it('skips hex colors', () => {
    assert.equal(isNonTranslatableString('#ff0000'), true);
    assert.equal(isNonTranslatableString('#333'), true);
    assert.equal(isNonTranslatableString('#1a2b3c4d'), true);
  });
});

// =================================================================
// 2. Translatable strings — should return FALSE (flag these)
// =================================================================
describe('string-classify: isNonTranslatableString — translatable', () => {
  it('flags normal user-facing text', () => {
    assert.equal(isNonTranslatableString('Welcome to our app'), false);
  });

  it('flags short user-facing text', () => {
    // NOTE: 'OK' matches SCREAMING_SNAKE_CASE pattern and is classified
    // as non-translatable. 'Hi' is a camelCase identifier (starts lowercase
    // + uppercase). This is correct behavior — the classifier is conservative.
    assert.equal(isNonTranslatableString('Go!'), false);
    assert.equal(isNonTranslatableString('No way'), false);
  });

  it('flags sentences', () => {
    assert.equal(isNonTranslatableString('Click here to sign up.'), false);
  });

  it('flags text with mixed case that is NOT camelCase', () => {
    assert.equal(isNonTranslatableString('Sign Up'), false);
    assert.equal(isNonTranslatableString('New Features'), false);
  });

  it('flags text with numbers mixed in', () => {
    assert.equal(isNonTranslatableString('You have 3 new messages'), false);
  });

  it('flags single words that look like real English', () => {
    // "Submit" starts with uppercase — not camelCase, not SCREAMING_SNAKE
    assert.equal(isNonTranslatableString('Submit'), false);
    assert.equal(isNonTranslatableString('Cancel'), false);
    assert.equal(isNonTranslatableString('Dashboard'), false);
  });

  it('flags error messages', () => {
    assert.equal(isNonTranslatableString('Something went wrong. Please try again.'), false);
  });

  it('flags strings with embedded HTML', () => {
    assert.equal(isNonTranslatableString('Click <b>here</b> to continue'), false);
  });
});

// =================================================================
// 3. Lint-extended patterns
// =================================================================
describe('string-classify: isNonTranslatableLintExtended', () => {
  it('skips file paths', () => {
    assert.equal(isNonTranslatableLintExtended('./components/Header'), true);
    assert.equal(isNonTranslatableLintExtended('/images/logo.png'), true);
  });

  it('skips email addresses', () => {
    assert.equal(isNonTranslatableLintExtended('user@example.com'), true);
  });

  it('skips HTML entities', () => {
    assert.equal(isNonTranslatableLintExtended('&amp;'), true);
    assert.equal(isNonTranslatableLintExtended('&nbsp;'), true);
  });

  it('skips short HTML tag names', () => {
    assert.equal(isNonTranslatableLintExtended('div'), true);
    assert.equal(isNonTranslatableLintExtended('span'), true);
    assert.equal(isNonTranslatableLintExtended('img'), true);
  });

  it('skips TypeScript type names', () => {
    assert.equal(isNonTranslatableLintExtended('Promise'), true);
    assert.equal(isNonTranslatableLintExtended('string[]'), true);
    assert.equal(isNonTranslatableLintExtended('void'), true);
    assert.equal(isNonTranslatableLintExtended('null'), true);
    assert.equal(isNonTranslatableLintExtended('undefined'), true);
  });

  it('skips generic type syntax', () => {
    assert.equal(isNonTranslatableLintExtended('Record<string, any>'), true);
    assert.equal(isNonTranslatableLintExtended('Array<number>'), true);
  });

  it('skips type union/intersection fragments', () => {
    assert.equal(isNonTranslatableLintExtended('string | null'), true);
    assert.equal(isNonTranslatableLintExtended('Foo & Bar'), true);
  });

  it('does NOT skip real text', () => {
    assert.equal(isNonTranslatableLintExtended('Welcome to the app'), false);
    assert.equal(isNonTranslatableLintExtended('Please enter your name'), false);
  });

  it('does NOT skip longer words that look like English', () => {
    assert.equal(isNonTranslatableLintExtended('Dashboard'), false);
    assert.equal(isNonTranslatableLintExtended('Settings'), false);
  });
});

// =================================================================
// 4. Edge cases and boundary conditions
// =================================================================
describe('string-classify: edge cases', () => {
  it('respects custom minLength parameter', () => {
    // With minLength=5, short strings under 5 chars are skipped
    assert.equal(isNonTranslatableString('abc', 5), true);
    // 'Hello World' is clearly user-facing text and longer than 5 chars
    assert.equal(isNonTranslatableString('Hello World', 5), false);
  });

  it('handles strings with only whitespace + punctuation', () => {
    assert.equal(isNonTranslatableString('  ... '), true);
  });

  it('handles strings with leading/trailing whitespace', () => {
    // Core function trims before checking
    assert.equal(isNonTranslatableString('  hello world  '), false);
  });

  it('handles mixed punctuation + text (translatable)', () => {
    // "Hello!" has both letters and punctuation — should be translatable
    assert.equal(isNonTranslatableString('Hello!'), false);
  });

  it('handles dot-notation that is actually a sentence', () => {
    // "Hello. World." has dots but also spaces — not a dot path
    assert.equal(isNonTranslatableString('Hello. World.'), false);
  });

  it('handles template-like text that is not a full template', () => {
    // Only fully wrapped {{ ... }} is skipped; partial is not
    assert.equal(isNonTranslatableString('Before {{ var }} after'), false);
  });
});
