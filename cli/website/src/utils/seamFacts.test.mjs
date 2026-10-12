/**
 * Guard: the homepage seam's displayed numbers are real SSOT reads.
 * seamFacts must agree with the build products it wraps, every hub must be
 * cited, and the floor phrasings must remain true of the data.
 *
 * Run: node --test cli/website/src/utils/seamFacts.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import poster from '../data/graph-poster.json' with {type: 'json'};
import hubData from '../data/seam-hubs.json' with {type: 'json'};
import {
  LIVING_TOTAL,
  COVERED_LIVING,
  SERVICE_LIVING,
  UNCOVERED_LIVING,
  GAP_SPEAKERS_RAW,
  GAP_FLOOR_LABEL,
  LIVING_FLOOR_LABEL,
  HUBS,
  HUBS_AS_OF,
  fmt,
} from './seamFacts.mjs';

test('facts are verbatim poster-stat reads', () => {
  assert.equal(LIVING_TOTAL, poster.stats.livingTotal);
  assert.equal(COVERED_LIVING, poster.stats.coverage.dedicatedLiving);
  assert.equal(SERVICE_LIVING, poster.stats.coverage.serviceLiving);
  assert.equal(UNCOVERED_LIVING, poster.stats.coverage.uncoveredLiving);
  assert.equal(GAP_SPEAKERS_RAW, poster.stats.coverageGap.uncoveredSpeakerSumRaw);
});

test('floor phrasings remain true of the data', () => {
  assert.ok(LIVING_TOTAL > 7000, 'living floor');
  assert.match(LIVING_FLOOR_LABEL, /7,000/);
  assert.ok(GAP_SPEAKERS_RAW >= 1_000_000_000, 'billion floor');
  assert.match(GAP_FLOOR_LABEL, /billion/);
  assert.ok(SERVICE_LIVING <= COVERED_LIVING, 'tiers nest');
  assert.ok(COVERED_LIVING < LIVING_TOTAL, 'coverage is partial');
});

test('every hub is cited (source_url + asOf) with a positive claimed count', () => {
  assert.equal(HUBS, hubData.hubs);
  assert.ok(HUBS.length >= 6);
  for (const h of HUBS) {
    assert.ok(h.key && h.label, `hub identity: ${JSON.stringify(h)}`);
    assert.ok(h.source_url && h.asOf, `hub ${h.key} must be cited`);
    assert.ok(Number.isFinite(h.count) && h.count > 0, `hub ${h.key} count`);
    assert.ok(h.tier === 'service' || h.tier === 'open', `hub ${h.key} tier`);
    if (h.deployable) {
      assert.ok(Number.isFinite(h.deployable.count) && h.deployable.count > 0, `hub ${h.key} deployable count`);
      assert.ok(h.deployable.source_url, `hub ${h.key} deployable claim must be cited`);
      assert.ok(h.deployable.count <= h.count, `hub ${h.key} deployable exceeds claimed coverage`);
    }
    if (h.releaseDate) {
      assert.match(h.releaseDate, /^\d{4}(-\d{2}){0,2}$/, `hub ${h.key} releaseDate format`);
    }
  }
  assert.ok(HUBS_AS_OF, 'coverage-list asOf stamp present');
});

test('fmt uses en-US grouping', () => {
  assert.equal(fmt(7077), '7,077');
  assert.equal(fmt(552), '552');
});
