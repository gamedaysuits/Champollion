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
  cardFamilyClaims,
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

// Round-3 synthetic researcher, eng→sme: the tool listed Uralic as an
// evidenced family, then said no evidence covered Northern Sami — a Uralic
// language. The family was never looked up; now the card's family is.
describe('metricReliability — a language WMT never judged, by its card family', () => {
  const claims = (...pairs) => async () => ({
    claims: pairs.map(([value, source]) => ({ value, source })), problem: null,
  });

  it('one evidenced family → that roll-up, its sources, the transfer caveat', async () => {
    const r = await metricReliability('sme', RELIABILITY, {
      familyClaims: claims(['Eskimo-Aleut', 'glottolog-v5.3'], ['Eskimo-Aleut', 'wals-v2020.5']),
    });
    assert.equal(r.status, 'ok');
    assert.equal(r.query_kind, 'language-family');
    assert.equal(r.target_family, 'Eskimo-Aleut');
    assert.equal(r.target_code, null);
    assert.deepEqual(r.exact_pairs_measured, []);
    assert.deepEqual(r.family_basis.matched_sources, ['glottolog-v5.3', 'wals-v2020.5']);
    const text = formatReliability(r);
    assert.ok(text.includes('Eskimo-Aleut (glottolog-v5.3, wals-v2020.5), per its language card'));
    assert.ok(text.includes('assumption, not a measurement'));
    assert.ok(!text.includes('UNMEASURED'));
  });

  it('disputed family: every source shown, the evidence rests on the matching one', async () => {
    const r = await metricReliability('yor', RELIABILITY, {
      familyClaims: claims(['Inuit-Yupik', 'src-a'], ['Eskimo-Aleut', 'src-b']),
    });
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.family_basis.matched_sources, ['src-b']);
    const text = formatReliability(r);
    assert.ok(text.includes('Inuit-Yupik (src-a); Eskimo-Aleut (src-b)'));
  });

  it('two evidenced families named by different sources → no pick, unmeasured', async () => {
    const rel = { ...RELIABILITY, families: { ...RELIABILITY.families, Uralic: { metrics: {} } } };
    const r = await metricReliability('zzz', rel, {
      familyClaims: claims(['Uralic', 'src-a'], ['Eskimo-Aleut', 'src-b']),
    });
    assert.equal(r.status, 'unmeasured');
    assert.ok(r.note.includes('does not pick'));
  });

  it('family without evidence names the family; an unresolved card never claims a check', async () => {
    const algic = await metricReliability('crk', RELIABILITY, {
      familyClaims: claims(['Algic', 'glottolog-v5.3']),
    });
    assert.equal(algic.status, 'unmeasured');
    assert.ok(algic.note.includes('directly or via its family'));
    assert.ok(algic.note.includes('Algic (glottolog-v5.3)'));
    const none = await metricReliability('xyz', RELIABILITY, {
      familyClaims: async () => ({ claims: [], problem: 'no card' }),
    });
    assert.equal(none.status, 'unmeasured');
    assert.ok(none.note.includes('could not be checked (no card)'));
    assert.ok(!none.note.includes('via its family'));
  });

  it('real index + real card: sme gets the Uralic roll-up it is listed beside', async (t) => {
    const idx = await loadReliabilityIndex();
    if (!idx) {
      t.skip('metric-reliability.json not reachable (packaged checkout)');
      return;
    }
    const fc = await cardFamilyClaims('sme');
    if (fc.problem) {
      t.skip(`sme card not resolvable here: ${fc.problem}`);
      return;
    }
    assert.ok(Object.hasOwn(idx.families, 'Uralic'));
    const r = await metricReliability('sme', undefined, { familyClaims: cardFamilyClaims });
    assert.equal(r.status, 'ok');
    assert.equal(r.target_family, 'Uralic');
    assert.ok(r.metrics.length > 0);
  });
});
