/**
 * SSOT parity: the cq-v1 constants the JS twin exports
 * (cli/website/src/utils/connectionQuality.mjs) must equal the cross-runtime
 * SSOT shared/connection-quality.json, and the tracked website-local copy the
 * twin imports must equal that root SSOT byte-for-byte.
 *
 * This makes shared/connection-quality.json the ONE authority for the
 * connection-quality numbers: edit a value in the JSON but not derive the
 * website copy, or let the two drift, and this fails. The Python twin has its
 * mirror (arena/tests/test_connection_quality_ssot.py). Wired into
 * scripts/ssot_parity_gate.sh, and run by `npm test` (node --test test/*.test.js).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as cq from '../website/src/utils/connectionQuality.mjs';
import ROOT from '../../shared/connection-quality.json' with { type: 'json' };
import WEBSITE_COPY from '../website/src/utils/connection-quality.json' with { type: 'json' };

const SCALARS = [
  'N_FULL', 'L_HEALTHY', 'H_NOISE', 'RUNS_FULL', 'SIGNIFICANCE_N',
  'LAMBDA_JUNCTION', 'W_METRIC_UNMEASURED', 'COVER_BASE', 'COVER_STEP',
  'COVER_DOMAIN_CAP', 'COVER_REGISTER_CAP', 'COVER_MIN', 'RECENCY_FRESH_DAYS',
  'RECENCY_AGING_DAYS', 'W_RECENCY_FRESH', 'W_RECENCY_AGING', 'W_RECENCY_STALE',
  'HUMAN_N_FULL', 'HUMAN_REVIEWERS_FULL', 'FORMULA_VERSION', 'PROVENANCE',
];

test('cq-v1 SSOT: scalar exports equal shared/connection-quality.json', () => {
  for (const name of SCALARS) {
    assert.equal(cq[name], ROOT[name], `${name} drifted from the SSOT`);
  }
});

test('cq-v1 SSOT: array + object exports equal the SSOT', () => {
  assert.deepEqual(cq.BIN_EDGES, ROOT.BIN_EDGES);
  assert.deepEqual(cq.BIN_LABELS, ROOT.BIN_LABELS);
  assert.deepEqual(cq.W_CONTAM, ROOT.W_CONTAM);
  assert.deepEqual(cq.W_TRUST, ROOT.W_TRUST);
});

test('cq-v1 SSOT: set exports equal the SSOT arrays', () => {
  assert.deepEqual([...cq.DOMAIN_NO_CREDIT].sort(), [...ROOT.DOMAIN_NO_CREDIT].sort());
  assert.deepEqual(
    [...cq.DRIFT_EXEMPT_PARADIGMS].sort(),
    [...ROOT.DRIFT_EXEMPT_PARADIGMS].sort(),
  );
});

test('cq-v1 SSOT: derived UNKNOWN weights track the SSOT', () => {
  assert.equal(cq.W_CONTAM_UNKNOWN, ROOT.W_CONTAM.MEDIUM);
  assert.equal(cq.W_TRUST_UNKNOWN, ROOT.W_TRUST.unverified);
});

test('cq-v1 SSOT: tracked website copy equals the root SSOT', () => {
  // The twin imports the website-local copy; sync:shared derives it from the
  // root. If they diverge, the build would silently use stale constants.
  assert.deepEqual(WEBSITE_COPY, ROOT);
});
