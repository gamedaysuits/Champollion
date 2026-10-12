/**
 * Tests for the Champollion MCP server results tools (public leaderboard).
 *
 * Runs with the Node.js built-in test runner (node --test). Uses mock rows
 * and asserts the pure URL builder / row mapper / formatter — no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildResultsUrl,
  mapResultRow,
  formatResults,
  formatRunCard,
  formatChrf,
  sanitize,
  RESULTS_SORT,
  DEFAULT_SORT,
  TRUST_DISPLAY,
  LEGACY_COMPOSITE_LABEL,
} from '../src/tools/results.js';

/** The retired quality-tier vocabulary — never printed on a score surface. */
const TIER_WORDS = ['baseline', 'emerging', 'functional', 'deployable', 'fluent'];
const assertNoTier = (text, where) => {
  for (const w of TIER_WORDS) {
    assert.doesNotMatch(text, new RegExp(`\\b${w}\\b`, 'i'), `${where} printed the tier "${w}"`);
  }
};

// A mock run_cards row as PostgREST would return it — a LEGACY card (no
// scoring_standard), still carrying the retired composite and a tier.
const MOCK_ROW = {
  id: 'eng-zul-dev-v1__anthropic_claude-haiku-4.5__naive',
  submitter: 'alice',
  model_slug: 'anthropic/claude-haiku-4.5',
  condition: 'naive',
  dataset_id: 'eng-zul-dev-v1',
  language_pair: 'eng>zul',
  composite_score: 0.4231,
  quality_tier: 'functional',
  trust: 'unverified',
  chrf_plus_plus: 38.12,
  chrf_ci_lower: 35.9,
  chrf_ci_upper: 40.33,
  exact_match_rate: 0.04,
  spbleu: '14.2',
  corpus_bleu: 12.4,
  comet_score: 0.71,
  ter: 0.66,
  total_cost_usd: 0.0104,
  cost_per_entry_usd: 0.0001,
  run_timestamp: '2026-06-18T12:34:56Z',
  submitted_at: '2026-06-18T12:35:00Z',
};

// ================================================================
// buildResultsUrl
// ================================================================
describe('buildResultsUrl', () => {
  it('defaults: selects, excludes disqualified, sorts chrF++ desc, limits 20', () => {
    const url = new URL(buildResultsUrl());
    assert.equal(url.pathname, '/rest/v1/run_cards');
    const select = url.searchParams.get('select');
    for (const col of ['chrf_plus_plus', 'chrf_ci_lower', 'chrf_ci_upper', 'corpus_bleu', 'ter', 'comet_score',
      'spbleu:run_card->scores->>spbleu', 'scoring_standard:run_card->scores->>scoring_standard']) {
      assert.ok(select.includes(col), `select reads ${col}`);
    }
    assert.ok(!select.includes('quality_tier'), 'no tier is read');
    assert.equal(DEFAULT_SORT, 'chrf');
    assert.equal(url.searchParams.get('trust'), 'neq.disqualified');
    assert.equal(url.searchParams.get('order'), 'chrf_plus_plus.desc.nullslast');
    assert.equal(url.searchParams.get('limit'), '20');
    // No filters → no language_pair / model_slug params
    assert.equal(url.searchParams.get('language_pair'), null);
    assert.equal(url.searchParams.get('model_slug'), null);
  });

  it('builds an exact-pair filter when both languages are given', () => {
    const url = new URL(buildResultsUrl({ source_language: 'ENG', target_language: 'Zul' }));
    // Codes are lowercased
    assert.equal(url.searchParams.get('language_pair'), 'eq.eng>zul');
  });

  it('builds a source-only prefix filter', () => {
    const url = new URL(buildResultsUrl({ source_language: 'fra' }));
    assert.equal(url.searchParams.get('language_pair'), 'like.fra>%');
  });

  it('builds a target-only suffix filter', () => {
    const url = new URL(buildResultsUrl({ target_language: 'yor' }));
    assert.equal(url.searchParams.get('language_pair'), 'like.%>yor');
  });

  it('builds a case-insensitive model substring filter', () => {
    const url = new URL(buildResultsUrl({ model: 'Haiku' }));
    assert.equal(url.searchParams.get('model_slug'), 'ilike.*Haiku*');
  });

  it('maps sort keys to the right column and direction', () => {
    assert.equal(
      new URL(buildResultsUrl({ sort: 'ter' })).searchParams.get('order'),
      'ter.asc.nullslast',
    );
    assert.equal(
      new URL(buildResultsUrl({ sort: 'chrf' })).searchParams.get('order'),
      'chrf_plus_plus.desc.nullslast',
    );
    assert.equal(
      new URL(buildResultsUrl({ sort: 'date' })).searchParams.get('order'),
      'run_timestamp.desc.nullslast',
    );
  });

  it('falls back to chrF++ for an unknown sort key', () => {
    const url = new URL(buildResultsUrl({ sort: 'bogus' }));
    assert.equal(url.searchParams.get('order'), 'chrf_plus_plus.desc.nullslast');
  });

  it('keeps the legacy composite key for old calls (nulls last)', () => {
    const url = new URL(buildResultsUrl({ sort: 'composite' }));
    assert.equal(url.searchParams.get('order'), 'composite_score.desc.nullslast');
  });

  it('respects an explicit limit', () => {
    const url = new URL(buildResultsUrl({ limit: 5 }));
    assert.equal(url.searchParams.get('limit'), '5');
  });

  it('every RESULTS_SORT entry produces a valid order clause', () => {
    for (const key of Object.keys(RESULTS_SORT)) {
      const order = new URL(buildResultsUrl({ sort: key })).searchParams.get('order');
      const { column, dir } = RESULTS_SORT[key];
      assert.equal(order, `${column}.${dir}.nullslast`);
    }
  });
});

// ================================================================
// sanitize
// ================================================================
describe('sanitize', () => {
  it('strips PostgREST-significant characters', () => {
    // The dangerous chars ,()*% are removed; surviving letters concatenate.
    assert.equal(sanitize('eng,(or)*%'), 'engor');
    assert.doesNotMatch(sanitize('eng,(or)*%'), /[%,()*]/);
  });

  it('returns null for blank or nullish input', () => {
    assert.equal(sanitize('   '), null);
    assert.equal(sanitize(''), null);
    assert.equal(sanitize(null), null);
    assert.equal(sanitize(undefined), null);
  });

  it('keeps slug-safe characters', () => {
    assert.equal(sanitize('anthropic/claude-haiku-4.5'), 'anthropic/claude-haiku-4.5');
  });

  it('blocks injection via the language filter', () => {
    // A comma would otherwise inject a second PostgREST filter.
    const url = new URL(buildResultsUrl({ source_language: 'eng,trust.eq.verified' }));
    assert.equal(url.searchParams.get('language_pair'), 'like.engtrust.eq.verified>%');
  });
});

// ================================================================
// mapResultRow
// ================================================================
describe('mapResultRow', () => {
  it('maps a raw row to the compact scored shape', () => {
    const m = mapResultRow(MOCK_ROW);
    assert.equal(m.id, MOCK_ROW.id);
    assert.equal(m.model, 'anthropic/claude-haiku-4.5');
    assert.equal(m.pair, 'eng>zul');
    assert.equal(m.chrf, 38.12);
    assert.deepEqual(m.chrf_ci, [35.9, 40.33]);
    assert.equal(m.spbleu, 14.2);
    assert.deepEqual(m.diagnostics, { exact_match: 0.04, fst_acceptance: null });
    // Legacy card: the composite survives only as legacy_composite; no tier.
    assert.equal(m.legacy_composite, 0.4231);
    assert.equal(m.composite, undefined);
    assert.equal(m.qualityTier, undefined);
    assert.equal(m.author, 'alice');
    assert.equal(m.date, '2026-06-18');
  });

  it('maps the trust enum to a display value', () => {
    assert.equal(mapResultRow({ ...MOCK_ROW, trust: 'verified' }).trust, TRUST_DISPLAY.verified);
    assert.equal(mapResultRow({ ...MOCK_ROW, trust: 'unverified' }).trust, 'self-benchmarked');
    // Unknown / missing trust defaults to self-benchmarked (never "verified")
    assert.equal(mapResultRow({ ...MOCK_ROW, trust: undefined }).trust, 'self-benchmarked');
  });

  it('tolerates missing optional fields', () => {
    const m = mapResultRow({ id: 'x', language_pair: 'eng>yor' });
    assert.equal(m.model, '?');
    assert.equal(m.chrf, null);
    assert.equal(m.chrf_ci, null);
    assert.equal(m.legacy_composite, null);
    assert.equal(m.author, 'anonymous');
    assert.equal(m.date, null);
  });

  it('falls back to submitted_at when run_timestamp is absent', () => {
    const m = mapResultRow({ ...MOCK_ROW, run_timestamp: null });
    assert.equal(m.date, '2026-06-18');
  });
});

// ================================================================
// formatResults
// ================================================================
describe('formatResults', () => {
  it('renders an empty-board message with a call to action', () => {
    const text = formatResults([]);
    assert.match(text, /No scored results/);
    assert.match(text, /run_benchmark/);
    assert.match(text, /leaderboard/i);
  });

  it('renders ranked lines led by chrF++ with its CI', () => {
    const rows = [mapResultRow(MOCK_ROW)];
    const text = formatResults(rows);
    assert.match(text, /^Top 1 scored result by chrF\+\+:/);
    assert.match(text, /#1/);
    assert.match(text, /eng→zul  chrF\+\+ 38\.1 \[35\.9, 40\.3\]  BLEU 12\.4 · spBLEU 14\.2 · TER 0\.7 · COMET 0\.710/);
    assert.match(text, /claude-haiku-4\.5/);
    assert.match(text, /self-benchmarked/);
    assert.match(text, /by alice/);
    // Diagnostics apart; the legacy composite only under its retired name.
    assert.match(text, /diagnostics: EM 0\.04/);
    assert.match(text, /legacy composite \(retired\) 0\.423/);
    assert.doesNotMatch(text, /(^|[^y] )composite \d/m, 'no bare composite score');
    assert.match(text, /Scoring standard\/1: chrF\+\+ with its 95% bootstrap CI is the headline/);
    assertNoTier(text, 'get_results');
  });

  it('a standard/1 card shows no composite at all', () => {
    const m = mapResultRow({ ...MOCK_ROW, scoring_standard: 'standard/1', composite_score: 0.9 });
    assert.equal(m.legacy_composite, null);
    assert.doesNotMatch(formatResults([m]), /legacy composite \(retired\) \d/);
  });

  it('sorting by the legacy key says what it is', () => {
    const text = formatResults([mapResultRow(MOCK_ROW)], { sort: 'composite' });
    assert.match(text, /^Top 1 scored result by legacy composite \(retired\):/);
    assert.match(text, /not a ranking of quality — sort by chrf/);
  });

  it('renders an em dash for a missing headline', () => {
    const rows = [mapResultRow({ id: 'x', language_pair: 'eng>yor', model_slug: 'm', condition: 'naive' })];
    const text = formatResults(rows);
    assert.match(text, /chrF\+\+ —/);
    assert.equal(formatChrf(47.5, [45.9, 49.0]), 'chrF++ 47.5 [45.9, 49.0]');
  });

  it('get_run_card leads with the headline, names a legacy composite, and prints no tier', () => {
    const card = {
      id: 'x', chrf_plus_plus: 5.5, chrf_ci_lower: 4.9, chrf_ci_upper: 6.1, composite_score: 0.62,
      run_card: { scores: { composite: 0.62, quality_tier: 'functional', chrf_plus_plus: 5.5 } },
    };
    const text = formatRunCard(card);
    assert.match(text, /^Headline \(scoring standard\/1\): chrF\+\+ 5\.5 \[4\.9, 6\.1\]/);
    assert.match(text, new RegExp(`composite_score 0\\.620 is the ${LEGACY_COMPOSITE_LABEL.replace(/[()]/g, '\\$&')}`));
    assert.match(text, /retired quality-tier field is omitted/);
    assertNoTier(text, 'get_run_card');
    const std = formatRunCard({ chrf_plus_plus: 40, run_card: { scores: { scoring_standard: 'standard/1', primary_metric: 'chrf_plus_plus' } } });
    assert.match(std, /Scored under standard\/1; primary metric chrf_plus_plus\./);
    assert.doesNotMatch(std, /legacy composite/);
  });
});

// ================================================================
// Unknown cost is rendered as unknown — never $0 (harness: unpriced/local
// runs publish total_cost_usd = null with cost_unknown: true).
// ================================================================
describe('cost unknown', () => {
  it('a null total_cost_usd maps to "unknown"', () => {
    const row = mapResultRow({ ...MOCK_ROW, total_cost_usd: null });
    assert.equal(row.cost_usd, null);
    assert.equal(row.cost_label, 'unknown');
  });

  it('the listing shows "cost unknown" and explains it is not $0', () => {
    const rows = [mapResultRow(MOCK_ROW), mapResultRow({ ...MOCK_ROW, id: 'x', total_cost_usd: null })];
    const text = formatResults(rows, { sort: 'cost' });
    assert.match(text, /cost \$0\.0104/);
    assert.match(text, /cost unknown/);
    // one row reads as one (Round 7: counts agree with their verbs)
    assert.match(text, /1 row has cost "unknown" — the harness could not price it /);
    assert.match(text, /Unknown is not \$0; it sorts LAST by cost/);
    assert.doesNotMatch(text, /cost \$0\.0000/);
    const two = formatResults([...rows, mapResultRow({ ...MOCK_ROW, id: 'y', total_cost_usd: null })], { sort: 'cost' });
    assert.match(two, /2 rows have cost "unknown" — the harness could not price them /);
    assert.match(two, /they sort LAST by cost/);
    assert.match(two, /^Top 3 scored results by cost:/);
  });
});
