#!/usr/bin/env node
/**
 * Content-preservation gate — the hollowing check.
 *
 * THE PRODUCTION BUG:
 *   A model with no vocabulary for a jargon-dense string deleted every letter
 *   it could not translate and left the source's punctuation and spacing
 *   skeleton standing:
 *
 *     "low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
 *     "the simple-builder approach"                  →  "  "
 *     "start here"                                   →  "" (U+200B only)
 *
 *   Every one of those passed the gate. Not empty (trim() only strips
 *   White_Space, and U+200B is category Cf), not an echo, not repetitive, and
 *   at 33% of source LENGTH comfortably above minLengthRatio (0.1). They were
 *   written to disk and — in the content lane — cached in the TM, so they
 *   re-served forever.
 *
 * WHY THE OBVIOUS FIX IS WRONG:
 *   "reject below X% alphanumeric density" is unshippable. The bug retains
 *   0.14 of its source's letters; "Getting started" → "入门" retains 0.14 too.
 *   Any threshold that catches one rejects Chinese, Japanese and Korean.
 *   The separating signal is not how much survived but where it came from:
 *   the hollowed output is a SUBSEQUENCE of its own source; a real
 *   translation shares essentially nothing with it. Both signals are required.
 *
 * These tests pin the bug, the CJK non-regression, and the conlang
 * non-regression (verified-good Klingon from the same production run must
 * keep passing — the vocabulary gap is a prompt problem, not a gate problem).
 *
 * Run: node --test test/content-preservation.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkContentPreservation,
  contentCharacters,
  isSubsequence,
  validateTranslations,
  DEFAULT_THRESHOLDS,
  MIN_MEASURABLE_CONTENT,
} from '../lib/validate.js';

/** Run one value through the full gate; return the failure reason or null. */
const gate = (source, translated, pairConfig = { target: 'tlh' }) => {
  const { failures } = validateTranslations({ k: translated }, { k: source }, pairConfig);
  return failures.length > 0 ? failures[0].reason : null;
};

// -----------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------
describe('contentCharacters', () => {
  it('keeps letters and digits, drops punctuation, spaces and symbols', () => {
    assert.deepEqual(contentCharacters('a-b · c1 !'), ['a', 'b', 'c', '1']);
  });

  it('drops invisible formatting characters', () => {
    assert.deepEqual(contentCharacters('a​b‎⁠'), ['a', 'b']);
  });

  it('NFC-normalizes so a decomposed ê counts as one character', () => {
    const composed = 'ê';               // U+00EA
    const decomposed = 'ê';       // e + COMBINING CIRCUMFLEX
    assert.deepEqual(contentCharacters(composed), contentCharacters(decomposed));
    assert.equal(contentCharacters(decomposed).length, 1);
  });

  it('handles astral characters as single code points', () => {
    assert.equal(contentCharacters('𝟏𝟐').length, 2);
  });
});

describe('isSubsequence', () => {
  it('is true when the needle is the haystack with characters deleted', () => {
    assert.equal(isSubsequence([...'êhiêi'], [...'nêhiyawêwin']), true);
    assert.equal(isSubsequence([], [...'anything']), true);
  });

  it('is false when order differs or characters are absent', () => {
    assert.equal(isSubsequence([...'ih'], [...'nêhiyawêwin']), false, 'order matters');
    assert.equal(isSubsequence([...'入门'], [...'gettingstarted']), false);
  });

  it('is case-insensitive — deleting while lowercasing is the same defect', () => {
    assert.equal(isSubsequence([...'abc'], [...'AxBxC']), true);
  });
});

// -----------------------------------------------------------------
// The bug
// -----------------------------------------------------------------
describe('checkContentPreservation — the hollowing bug', () => {
  it('rejects the production tagline, reporting the retained fraction', () => {
    const source = 'low-resource nmt · tokenizers · nêhiyawêwin';
    const result = checkContentPreservation(source, '   ·   · êhiêi');

    assert.ok(result, 'must be rejected');
    assert.match(result.reason, /content deleted/);
    assert.match(result.reason, /14%/);
    assert.ok(result.retention < 0.2);
  });

  it('rejects a value hollowed to punctuation and spaces alone', () => {
    const result = checkContentPreservation('the simple-builder approach', '  ·  ');
    assert.ok(result);
    assert.match(result.reason, /no translatable content/);
    assert.equal(result.retention, 0);
  });

  it('rejects a value hollowed to invisible characters alone', () => {
    // U+200B survives trim(), so this rendered as blank and passed the
    // old empty check.
    const result = checkContentPreservation('start here now', '​​');
    assert.ok(result);
    assert.match(result.reason, /no translatable content/);
  });

  it('the failure names the real cause, not a threshold to loosen', () => {
    const result = checkContentPreservation('low-resource nmt · tokenizers · nêhiyawêwin', '   ·   · êhiêi');
    assert.match(result.reason, /no vocabulary/);
  });
});

// -----------------------------------------------------------------
// Non-regression: dense scripts. A bare density rule breaks all of these.
// -----------------------------------------------------------------
describe('checkContentPreservation — dense scripts are NOT hollowing', () => {
  // Each of these retains a fraction at or below the bug's own 0.14 and must
  // still pass, which is precisely why density alone cannot be the rule.
  const TERSE = [
    ['Getting started', '入门', 'zh'],
    ['Frequently asked questions', '常见问题', 'zh'],
    ['Settings', '設定', 'ja'],
    ['Documentation', '文書', 'ja'],
    ['Search the documentation', '문서 검색', 'ko'],
  ];

  for (const [source, translated, locale] of TERSE) {
    it(`accepts ${locale}: "${source}" → "${translated}"`, () => {
      const retention = contentCharacters(translated).length / contentCharacters(source).length;
      assert.ok(
        retention <= 0.35,
        `precondition: this case must sit below the retention floor (got ${retention.toFixed(2)}) — otherwise it proves nothing`,
      );
      assert.equal(checkContentPreservation(source, translated), null);
    });
  }

  it('the bug and a correct Chinese translation are indistinguishable by density alone', () => {
    const bugRetention = contentCharacters('   ·   · êhiêi').length
      / contentCharacters('low-resource nmt · tokenizers · nêhiyawêwin').length;
    const zhRetention = contentCharacters('入门').length
      / contentCharacters('Getting started').length;

    assert.equal(bugRetention.toFixed(2), zhRetention.toFixed(2),
      'if these ever diverge, the two-signal design can be revisited');
    // …and the subsequence signal is what tells them apart.
    assert.ok(checkContentPreservation('low-resource nmt · tokenizers · nêhiyawêwin', '   ·   · êhiêi'));
    assert.equal(checkContentPreservation('Getting started', '入门'), null);
  });
});

// -----------------------------------------------------------------
// Non-regression: conlangs. Verified-good output from the same run.
// -----------------------------------------------------------------
describe('checkContentPreservation — correct conlang output still passes', () => {
  const GOOD = [
    ['Doing things with logic', "meqmo' vay' vita'"],
    ['Contact', "nuvpu' ti'ang"],
    ['the simple-builder approach', "chenmoHwI' ngeD Do'"],
  ];

  for (const [source, translated] of GOOD) {
    it(`accepts "${source}" → "${translated}"`, () => {
      assert.equal(checkContentPreservation(source, translated), null);
    });
  }

  it('a translation that keeps a proper noun is not hollowing', () => {
    assert.equal(checkContentPreservation('Champollion CLI reference', 'Champollion CLI référence'), null);
  });
});

// -----------------------------------------------------------------
// Boundaries
// -----------------------------------------------------------------
describe('checkContentPreservation — boundaries', () => {
  it('skips sources too short to measure', () => {
    // "Blog" has 4 content characters; a ratio over that is noise.
    assert.ok(contentCharacters('Blog').length < MIN_MEASURABLE_CONTENT);
    assert.equal(checkContentPreservation('Blog', '.'), null);
  });

  it('measures a source at exactly the threshold', () => {
    const source = 'abcdef';   // exactly MIN_MEASURABLE_CONTENT
    assert.equal(contentCharacters(source).length, MIN_MEASURABLE_CONTENT);
    assert.ok(checkContentPreservation(source, '...'));
  });

  it('a retention at or above the floor passes without consulting subsequence', () => {
    // A subsequence, but well above the floor — a legitimate shortening.
    const source = 'Champollion command line interface';
    const translated = 'Champollion CLI';
    assert.ok(contentCharacters(translated).length / contentCharacters(source).length >= DEFAULT_THRESHOLDS.minContentRetention);
    assert.equal(checkContentPreservation(source, translated), null);
  });

  it('the retention floor is configurable', () => {
    const source = 'low-resource nmt · tokenizers · nêhiyawêwin';
    // Drop the floor below the observed 0.14 and the same value passes.
    assert.equal(checkContentPreservation(source, '   ·   · êhiêi', 0.05), null);
  });
});

// -----------------------------------------------------------------
// Through the whole gate
// -----------------------------------------------------------------
describe('validateTranslations — hollowing reaches the gate', () => {
  it('rejects the hollowed tagline that used to be written to disk', () => {
    assert.match(
      gate('low-resource nmt · tokenizers · nêhiyawêwin', '   ·   · êhiêi'),
      /content deleted/,
    );
  });

  it('rejects an invisible-character value the old empty check let through', () => {
    const reason = gate('start here now', '​​');
    assert.match(reason, /empty translation \(only invisible formatting characters\)/);
  });

  it('still calls a plain whitespace value simply empty', () => {
    assert.equal(gate('start here now', '   '), 'empty translation');
  });

  it('does not disturb correct output in any of the affected locales', () => {
    assert.equal(gate('Doing things with logic', "meqmo' vay' vita'"), null);
    assert.equal(gate('Getting started', '入门', { target: 'zh' }), null);
    assert.equal(gate('the simple-builder approach', "l'approche du constructeur simple", { target: 'fr' }), null);
  });

  it('a per-pair minContentRetention override is honoured', () => {
    const { failures } = validateTranslations(
      { k: '   ·   · êhiêi' },
      { k: 'low-resource nmt · tokenizers · nêhiyawêwin' },
      { target: 'tlh', minContentRetention: 0.05 },
    );
    assert.deepEqual(failures, []);
  });

  it('the gate reports hollowing as its own reason, not as truncation', () => {
    // 33% of source LENGTH clears minLengthRatio (0.1), so "suspiciously
    // short" must not be what fires — the diagnosis has to be actionable.
    const reason = gate('low-resource nmt · tokenizers · nêhiyawêwin', '   ·   · êhiêi');
    assert.doesNotMatch(reason, /suspiciously short/);
  });
});
