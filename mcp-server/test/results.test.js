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
  sanitize,
  RESULTS_SORT,
  TRUST_DISPLAY,
} from '../src/tools/results.js';

// A mock run_cards row as PostgREST would return it.
const MOCK_ROW = {
  id: 'eng-zul-dev-v1__anthropic_claude-haiku-4.5__naive',
  submitter: 'alice',
  model_slug: 'anthropic/claude-haiku-4.5',
  condition: 'naive',
  dataset_id: 'eng-zul-dev-v1',
  language_pair: 'eng>zul',
  composite_score: 0.4231,
  quality_tier: 'fair',
  trust: 'unverified',
  chrf_plus_plus: 38.12,
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
  it('defaults: selects, excludes disqualified, sorts composite desc, limits 20', () => {
    const url = new URL(buildResultsUrl());
    assert.equal(url.pathname, '/rest/v1/run_cards');
    assert.ok(url.searchParams.get('select').includes('composite_score'));
    assert.equal(url.searchParams.get('trust'), 'neq.disqualified');
    assert.equal(url.searchParams.get('order'), 'composite_score.desc.nullslast');
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

  it('falls back to composite for an unknown sort key', () => {
    const url = new URL(buildResultsUrl({ sort: 'bogus' }));
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
    assert.equal(m.composite, 0.4231);
    assert.equal(m.chrf, 38.12);
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
    assert.equal(m.composite, null);
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

  it('renders ranked lines for results', () => {
    const rows = [mapResultRow(MOCK_ROW)];
    const text = formatResults(rows, { sort: 'composite' });
    assert.match(text, /Top 1 scored result/);
    assert.match(text, /#1/);
    assert.match(text, /eng→zul/);
    assert.match(text, /composite 0\.423/);
    assert.match(text, /chrF\+\+ 38\.1/);
    assert.match(text, /claude-haiku-4\.5/);
    assert.match(text, /self-benchmarked/);
    assert.match(text, /by alice/);
  });

  it('renders an em dash for missing metrics', () => {
    const rows = [mapResultRow({ id: 'x', language_pair: 'eng>yor', model_slug: 'm', condition: 'naive' })];
    const text = formatResults(rows);
    assert.match(text, /composite —/);
  });
});
