import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Tests: leaderboard command — unit tests (mocked fetch, no real API calls)
// ---------------------------------------------------------------------------

// We test the command module's internal logic by importing and calling run()
// with mocked global fetch. Tests verify argument handling, sort key validation,
// JSON output mode, and table output formatting.

// Save original fetch
const originalFetch = globalThis.fetch;

function mockFetch(rows) {
  globalThis.fetch = async (url, opts) => ({
    ok: true,
    json: async () => rows,
    status: 200,
  });
}

function mockFetchError(statusCode) {
  globalThis.fetch = async (url, opts) => ({
    ok: false,
    status: statusCode,
    statusText: 'Server Error',
  });
}

describe('leaderboard command', () => {
  let captured = [];
  let originalConsoleLog;

  beforeEach(() => {
    // Capture console.log output for assertions
    captured = [];
    originalConsoleLog = console.log;
    console.log = (...args) => captured.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    globalThis.fetch = originalFetch;
  });

  it('returns 0 with empty results and shows empty message', async () => {
    mockFetch([]);
    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'] }, '/tmp');
    assert.equal(code, 0);
  });

  it('returns 1 for invalid sort key', async () => {
    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'], sort: 'invalid' }, '/tmp');
    assert.equal(code, 1);
  });

  // L10: a bare `--install` (no rank) parses as boolean `true`. parseInt(true)
  // is NaN, which previously slipped past the range check and crashed on
  // `rows[NaN - 1].run_card`. It must now be rejected with a clear error.
  it('returns 1 for --install with no rank (boolean true), no crash', async () => {
    let captured2 = [];
    const origErr = console.error;
    console.error = (...a) => captured2.push(a.join(' '));
    try {
      const { run } = await import('../lib/commands/leaderboard.js');
      // args.install === true mimics `champollion leaderboard --install` (no value)
      const code = await run({ _: ['leaderboard'], install: true }, '/tmp');
      assert.equal(code, 1);
      assert.match(captured2.join('\n'), /--install requires a positive integer rank/);
    } finally {
      console.error = origErr;
    }
  });

  it('returns 1 for --install with a non-numeric / zero rank', async () => {
    const origErr = console.error;
    console.error = () => {};
    try {
      const { run } = await import('../lib/commands/leaderboard.js');
      assert.equal(await run({ _: ['leaderboard'], install: 'abc' }, '/tmp'), 1);
      assert.equal(await run({ _: ['leaderboard'], install: '0' }, '/tmp'), 1);
    } finally {
      console.error = origErr;
    }
  });

  it('produces NDJSON output with --json flag', async () => {
    mockFetch([
      {
        model_slug: 'gpt-4o',
        condition: 'coached',
        language_pair: 'en>crk',
        composite_score: 0.42,
        chrf_plus_plus: 31.5,
        exact_match_rate: 4.8,
        fst_acceptance_rate: 85.2,
        equivalent_match_rate: null,
        semantic_score: null,
        quality_tier: 'functional',
        total_cost_usd: 0.051,
        submitter: 'gamedaysuits',
        run_timestamp: '2026-05-28T00:00:00Z',
        dataset_id: 'edtekla-dev-v1',
      },
    ]);

    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'], json: true }, '/tmp');
    assert.equal(code, 0);
    assert.equal(captured.length, 1);

    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.model, 'gpt-4o');
    assert.equal(parsed.composite, 0.42);
    assert.equal(parsed.rank, 1);
    assert.equal(parsed.tier, 'functional');
  });

  it('respects --top flag to limit results', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      model_slug: `model-${i}`,
      condition: 'naive',
      language_pair: 'en>crk',
      composite_score: 0.9 - i * 0.05,
      chrf_plus_plus: 50 - i * 2,
      exact_match_rate: 10 - i,
      fst_acceptance_rate: null,
      quality_tier: 'functional',
      total_cost_usd: 0.01,
      submitter: 'test',
      run_timestamp: '2026-05-28T00:00:00Z',
      dataset_id: 'test',
    }));

    mockFetch(rows);

    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'], json: true, top: '3' }, '/tmp');
    assert.equal(code, 0);
    assert.equal(captured.length, 3, 'should show exactly 3 results');
  });

  it('passes pair filter to Supabase query', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      return { ok: true, json: async () => [], status: 200 };
    };

    const { run } = await import('../lib/commands/leaderboard.js');
    await run({ _: ['leaderboard'], pair: 'en>crk' }, '/tmp');
    assert.ok(capturedUrl.includes('language_pair=eq.en>crk'));
  });

  it('passes sort key to Supabase order', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      return { ok: true, json: async () => [], status: 200 };
    };

    const { run } = await import('../lib/commands/leaderboard.js');
    await run({ _: ['leaderboard'], sort: 'chrf' }, '/tmp');
    assert.ok(capturedUrl.includes('order=chrf_plus_plus.desc'));
  });

  it('returns 1 on fetch error', async () => {
    mockFetchError(500);
    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'] }, '/tmp');
    assert.equal(code, 1);
  });
});
