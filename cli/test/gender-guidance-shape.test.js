/**
 * gender-guidance-shape.test.js — the shape, not the prose.
 *
 * v1 of this file mapped 103 ISO codes to 103 English sentences. That is the
 * exact shape of one side of a split translation corpus, and
 * `scripts/corpus_content_scan.py` correctly flagged it — a dict of >=4 entries
 * where >=60% of values are sentence prose and >=60% of keys are language codes.
 * It hard-blocked the pre-push gate, which blocks everything downstream of it.
 *
 * The reshape is not a workaround for the scanner. Guidance is SHARED — 11
 * family statements reach more than three thousand languages — so keying it by
 * the set it applies to is the accurate model, and it stops resembling a corpus
 * because it stops being shaped like one.
 *
 * These tests hold that shape. Reverting to a code-keyed map would pass every
 * other test in the suite and take the gate down again.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(
  import.meta.dirname, '..', '..', 'shared', 'catalogue', 'gender-guidance.json',
);
const guidance = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

/** The scanner's own test, restated: a langcode-keyed map of prose. */
function isCodeKeyedProseMap(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const strs = Object.entries(node).filter(([, v]) => typeof v === 'string');
  if (strs.length < 4) return false;
  const prose = strs.filter(([, v]) => v.trim().split(/\s+/).length >= 5).length;
  if (prose < 4 || prose < 0.6 * strs.length) return false;
  const codeish = strs.filter(([k]) => /^[a-z]{2,3}$/.test(k.trim())).length;
  return codeish >= 0.6 * strs.length;
}

describe('gender guidance is keyed by what it applies to', () => {
  test('the file is a scope-tagged list, not a map', () => {
    assert.ok(Array.isArray(guidance.entries), 'entries[] is the shape');
    assert.equal(guidance.byLanguage, undefined, 'the v1 byLanguage map is gone');
    assert.equal(guidance.byFamily, undefined, 'the v1 byFamily map is gone');
  });

  test('no node anywhere is a language-code-keyed map of prose', () => {
    // Walked recursively, because the fault was one nested key deep and a
    // top-level check would have missed it.
    const walk = (node, at) => {
      assert.ok(!isCodeKeyedProseMap(node),
        `${at} is a {language-code: prose} map — the shape the corpus scanner `
        + 'blocks, and the shape that took down the pre-push gate');
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, `${at}.${k}`);
      }
    };
    walk(guidance, 'gender-guidance');
  });

  test('every entry says what it applies to and carries text', () => {
    for (const e of guidance.entries) {
      assert.ok(['family', 'genus', 'language'].includes(e.scope), `bad scope: ${e.scope}`);
      assert.ok(Array.isArray(e.appliesTo) && e.appliesTo.length, 'appliesTo must name targets');
      assert.ok(typeof e.guidance === 'string' && e.guidance.length > 0, 'guidance required');
    }
  });

  test('genus entries are carried but explicitly not applied', () => {
    // A genus sits below a family and needs an ancestry match rather than a
    // name lookup. Carrying them with applied:false keeps the gap visible;
    // dropping them would hide 23 unwired statements.
    const genus = guidance.entries.filter((e) => e.scope === 'genus');
    assert.ok(genus.length, 'genus entries are recorded');
    for (const e of genus) assert.equal(e.applied, false, `${e.appliesTo} must be marked unapplied`);
  });

  test('the file says its own provenance is unverified', () => {
    // These texts came from the previous corpus and cite nothing, while making
    // claims Grambank and WALS actually answer. The warning stays until they
    // are re-derived, so nobody mistakes them for evidence.
    assert.match(JSON.stringify(guidance._provenanceWarning ?? ''), /cite nothing|derivable/i);
  });
});
