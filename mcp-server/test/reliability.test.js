/**
 * Tests for the get_metric_reliability tool logic (src/tools/reliability.js).
 *
 * Fixture-driven — same index shape as shared/catalogue/metric-reliability.json
 * (and the same fixture scenario as arena/tests/test_recommend.py
 * TestMetricReliability / cli/test/recommend.test.js tier 4). The final suite
 * exercises the real monorepo-tracked index when present.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadReliabilityIndex,
  metricReliability,
  formatReliability,
  resolveReliabilityQuery,
} from '../src/tools/reliability.js';

const RELIABILITY = {
  languages: {
    iu: { iso639_3: 'iku', family: 'Eskimo-Aleut', genus: 'Inuit' },
    de: { iso639_3: 'deu', family: 'Indo-European', genus: 'Global German' },
  },
  families: {
    'Eskimo-Aleut': {
      n_pairs: 1,
      metrics: {
        comet_score: {
          sys: {
            n_cells: 1, n_pairs: 1, weight: 10, pairs: ['wmt20:en-iu'],
            pearson_weighted_mean: 0.8598,
          },
          seg: {
            n_cells: 1, n_pairs: 1, weight: 5000, pairs: ['wmt20:en-iu'],
            kendall_tau_b_weighted_mean: 0.21,
          },
        },
        bleu: {
          sys: {
            n_cells: 1, n_pairs: 1, weight: 10, pairs: ['wmt20:en-iu'],
            pearson_weighted_mean: 0.1629,
          },
        },
      },
    },
  },
  cells: [
    { pair: 'en-iu', tgt: 'iu', preferred: true },
    { pair: 'en-de', tgt: 'de', preferred: true },
  ],
  license_lane: { commercial_ok: false, note: 'founder review pending' },
  provenance: 'champollion-derived [derived from mt-metrics-eval]',
};

describe('resolveReliabilityQuery', () => {
  it('matches WMT code, iso639-3, and family name (case-insensitive)', () => {
    assert.equal(resolveReliabilityQuery(RELIABILITY, 'iu').kind, 'language');
    assert.equal(resolveReliabilityQuery(RELIABILITY, 'IKU').code, 'iu');
    assert.equal(resolveReliabilityQuery(RELIABILITY, 'eskimo-aleut').kind, 'family');
    assert.equal(resolveReliabilityQuery(RELIABILITY, 'crk').kind, 'none');
  });
});

describe('metricReliability (fixture index)', () => {
  it('language hit: metrics sorted by sys-Pearson, exact pairs listed', async () => {
    const r = await metricReliability('iu', RELIABILITY);
    assert.equal(r.status, 'ok');
    assert.equal(r.target_family, 'Eskimo-Aleut');
    assert.deepEqual(r.metrics.map((m) => m.metric), ['comet_score', 'bleu']);
    assert.deepEqual(r.exact_pairs_measured, ['en-iu']);
    assert.ok(r.license_note.includes('Non-commercial'));
  });

  it('family query works without a language code', async () => {
    const r = await metricReliability('Eskimo-Aleut', RELIABILITY);
    assert.equal(r.status, 'ok');
    assert.equal(r.query_kind, 'family');
    assert.equal(r.metrics.length, 2);
  });

  it('unmeasured language is explicit and lists what IS covered', async () => {
    const r = await metricReliability('crk', RELIABILITY);
    assert.equal(r.status, 'unmeasured');
    assert.ok(r.note.includes('UNMEASURED'));
    assert.deepEqual(r.measured_families, ['Eskimo-Aleut']);
    const text = formatReliability(r);
    assert.ok(text.includes('UNMEASURED'));
    assert.ok(text.includes('Eskimo-Aleut'));
  });

  it('absent index degrades to an explicit answer, never a crash', async () => {
    const r = await metricReliability('iu', null);
    assert.equal(r.status, 'index-unavailable');
    assert.ok(formatReliability(r).includes('metric-reliability'));
  });

  it('formatReliability renders numbers, caveats, and the spec link', async () => {
    const text = formatReliability(await metricReliability('iu', RELIABILITY));
    assert.ok(text.includes('comet_score'));
    assert.ok(text.includes('+0.86'));
    assert.ok(text.includes('Directly judged pairs for this language: en-iu'));
    assert.ok(text.includes('specifications/metric-reliability'));
    assert.ok(text.includes('Non-commercial'));
    // Family-transfer caveat appears when the exact language was never judged.
    const rel = { ...RELIABILITY, cells: [{ pair: 'en-de', tgt: 'de', preferred: true }] };
    const text2 = formatReliability(await metricReliability('iu', rel));
    assert.ok(text2.includes('assumption, not a measurement'));
  });
});

describe('metricReliability (real monorepo index, when present)', () => {
  it('loads and answers for Inuktitut with the honesty notes intact', async (t) => {
    const idx = await loadReliabilityIndex();
    if (!idx) {
      t.skip('metric-reliability.json not reachable (packaged checkout)');
      return;
    }
    assert.equal(idx.provider, 'wmt-metrics-metaeval');
    const r = await metricReliability('iu');
    assert.equal(r.status, 'ok');
    assert.equal(r.target_family, 'Eskimo-Aleut');
    const comet = r.metrics.find((m) => m.metric === 'comet_score');
    const bleu = r.metrics.find((m) => m.metric === 'bleu');
    assert.ok(comet.sys_pearson > bleu.sys_pearson,
      'the Inuktitut headline finding: COMET must out-correlate BLEU');
  });
});
