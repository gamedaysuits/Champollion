/**
 * contamination.test.js — exposure, and the ways it must refuse to answer.
 *
 * The load-bearing tests are the ones about UNKNOWNS. A contamination score
 * that quietly treats "we could not check" as "clean" is worse than no score,
 * because it is confidently wrong in the direction that matters.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  contaminationIndex, EXPOSURE, WEB_PRESENCE, DERIVATION_VERSION,
} from '../scripts/cldf/contamination.mjs';

/** Everything known and everything pointing the same way. */
const exposed = {
  plainTextAvailable: true,
  licence: 'CC-BY-4.0',
  sourceAndReferenceTogether: true,
  publishedDate: '2021-01-01',
  modelCutoffs: [{ model: 'nllb-200', date: '2022-07-01' }],
  webPresence: { state: WEB_PRESENCE.CRAWLED, firstSeen: '2021-06-01' },
};

describe('an exposed corpus is reported as exposed', () => {
  test('public, permissive, bundled with its answers, crawled, older than the models', () => {
    const r = contaminationIndex(exposed);
    assert.equal(r.exposure, EXPOSURE.HIGH);
    assert.deepEqual(r.modelsPublishedAfter, ['nllb-200']);
    assert.equal(r.unknowns.length, 0);
  });

  test('a gated, restrictive, separately-held corpus is not', () => {
    const r = contaminationIndex({
      ...exposed,
      plainTextAvailable: false,
      licence: 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0',
      sourceAndReferenceTogether: false,
      webPresence: { state: WEB_PRESENCE.NOT_CAPTURED },
    });
    assert.equal(r.exposure, EXPOSURE.LOW);
  });

  test('every signal carries its own reason', () => {
    for (const s of contaminationIndex(exposed).signals) {
      assert.ok(s.signal, 'a signal must name itself');
      if (s.raises !== null) assert.ok(s.why, `${s.signal} must say why`);
    }
  });
});

describe('a failed check is never read as a clean result', () => {
  test('an unknown web presence cannot produce LOW', () => {
    // The real case: tatoeba.org 504s on every attempt, almost certainly
    // BECAUSE it has so many captures the query cannot complete. The failure
    // runs opposite to the answer, so treating it as absence would mark the
    // most exposed corpora cleanest.
    const r = contaminationIndex({
      plainTextAvailable: false,
      licence: 'LicenseRef-Restricted',
      sourceAndReferenceTogether: false,
      publishedDate: '2021-01-01',
      modelCutoffs: [{ model: 'm', date: '2023-01-01' }],
      webPresence: { state: WEB_PRESENCE.UNKNOWN, reason: 'HTTP 504 after 3 attempts' },
    });
    assert.notEqual(r.exposure, EXPOSURE.LOW);
    assert.equal(r.exposure, EXPOSURE.UNDETERMINED);
    assert.ok(r.unknowns.includes('webPresence'));
  });

  test('the unknown web-presence signal says why absence is not implied', () => {
    const r = contaminationIndex({
      ...exposed,
      webPresence: { state: WEB_PRESENCE.UNKNOWN, reason: 'HTTP 504' },
    });
    const web = r.signals.find((s) => s.signal === 'webPresence');
    assert.match(web.why, /NOT evidence of absence/);
    assert.match(web.why, /opposite/);
  });

  test('too few established signals is undetermined, not a guess', () => {
    const r = contaminationIndex({
      plainTextAvailable: true,
      licence: null,
      sourceAndReferenceTogether: null,
      publishedDate: null,
      modelCutoffs: [],
      webPresence: { state: WEB_PRESENCE.UNKNOWN },
    });
    assert.equal(r.exposure, EXPOSURE.UNDETERMINED);
    assert.match(r.because, /signals we do not have/);
  });

  test('an empty input answers undetermined rather than throwing', () => {
    // A corpus we know nothing about is a normal state during a rebuild, not
    // an error — but it must not come out as LOW.
    const r = contaminationIndex({});
    assert.equal(r.exposure, EXPOSURE.UNDETERMINED);
    assert.equal(r.unknowns.length, 5);
  });
});

describe('age settles it when it can', () => {
  test('a corpus newer than every indexed model is low, whatever else is true', () => {
    // BOUQuET is the live example: hand-built after the models it evaluates.
    // No amount of public availability puts it in a model that predates it.
    const r = contaminationIndex({
      ...exposed,
      publishedDate: '2026-03-01',
      modelCutoffs: [
        { model: 'nllb-200', date: '2022-07-01' },
        { model: 'madlad-400', date: '2023-09-01' },
      ],
    });
    assert.equal(r.exposure, EXPOSURE.LOW);
    assert.deepEqual(r.modelsPublishedAfter, []);
    assert.match(r.because, /predate/);
  });

  test('a model released after the corpus is named', () => {
    const r = contaminationIndex({
      ...exposed,
      publishedDate: '2020-01-01',
      modelCutoffs: [
        { model: 'old', date: '2019-01-01' },
        { model: 'new', date: '2024-01-01' },
      ],
    });
    assert.deepEqual(r.modelsPublishedAfter, ['new']);
  });

  test('no model list means age cannot settle anything', () => {
    const r = contaminationIndex({ ...exposed, modelCutoffs: [] });
    assert.ok(r.unknowns.includes('modelCutoffs'));
  });
});

describe('the verdict is auditable', () => {
  test('it carries a derivation version', () => {
    assert.equal(contaminationIndex(exposed).derivationVersion, DERIVATION_VERSION);
  });

  test('it explains itself in words', () => {
    for (const input of [exposed, {}, { ...exposed, licence: null }]) {
      assert.ok(contaminationIndex(input).because.length > 20);
    }
  });

  test('the same input always gives the same verdict', () => {
    // No randomness, no clock: two builds from one pinned snapshot must agree.
    const a = contaminationIndex(exposed);
    const b = contaminationIndex(exposed);
    assert.deepEqual(a, b);
  });

  test('a no-derivatives licence does not count as redistributable', () => {
    const r = contaminationIndex({ ...exposed, licence: 'CC-BY-NC-ND-4.0' });
    const lic = r.signals.find((s) => s.signal === 'licenceAllowsDerivatives');
    assert.equal(lic.value, false);
  });
});
