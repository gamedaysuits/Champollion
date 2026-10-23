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

  it('produces NDJSON output with --json flag (scoring standard/1 shape)', async () => {
    mockFetch([
      {
        // A LEGACY card: no run_card.scores.scoring_standard, a stored
        // composite and an old tier label in the DB.
        model_slug: 'gpt-4o',
        condition: 'coached',
        language_pair: 'en>crk',
        composite_score: 0.42,
        chrf_plus_plus: 31.5,
        chrf_ci_lower: 29.1,
        chrf_ci_upper: 33.8,
        corpus_bleu: 9.2,
        ter: 81.0,
        comet_score: 0.61,
        exact_match_rate: 4.8,
        fst_acceptance_rate: 85.2,
        equivalent_match_rate: null,
        semantic_score: null,
        quality_tier: 'functional',
        total_cost_usd: 0.051,
        submitter: 'gamedaysuits',
        run_timestamp: '2026-05-28T00:00:00Z',
        dataset_id: 'edtekla-dev-v1',
        run_card: { scores: { spbleu: 12.5 } },
      },
    ]);

    const { run } = await import('../lib/commands/leaderboard.js');
    const code = await run({ _: ['leaderboard'], json: true }, '/tmp');
    assert.equal(code, 0);
    assert.equal(captured.length, 1);

    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.model, 'gpt-4o');
    assert.equal(parsed.rank, 1);
    // Headline: chrF++ with its CI; the standard metrics beside it.
    assert.equal(parsed.primary_metric, 'chrf_plus_plus');
    assert.equal(parsed.chrF, 31.5);
    assert.deepEqual(parsed.chrF_ci, [29.1, 33.8]);
    assert.equal(parsed.bleu, 9.2);
    assert.equal(parsed.spbleu, 12.5);
    assert.equal(parsed.ter, 81.0);
    assert.equal(parsed.comet, 0.61);
    // Diagnostics apart.
    assert.deepEqual(parsed.diagnostics, { exactMatch: 4.8, fstAcceptance: 85.2, equivalentMatch: null, semanticScore: null });
    assert.equal(parsed.exactMatch, undefined, 'diagnostics are not top-level scores');
    // Legacy card: its composite only under the retired name; no tier at all.
    assert.equal(parsed.scoring_standard, null);
    assert.equal(parsed.legacy_composite, 0.42);
    assert.equal(parsed.composite, undefined);
    assert.equal(parsed.tier, undefined);
  });

  it('a standard/1 card has no composite to show, even if one is stored', async () => {
    mockFetch([{
      model_slug: 'm', condition: 'naive', language_pair: 'eng>crk', composite_score: 0.9,
      chrf_plus_plus: 40, run_card: { scores: { scoring_standard: 'standard/1', primary_metric: 'chrf_plus_plus' } },
    }]);
    const { run } = await import('../lib/commands/leaderboard.js');
    await run({ _: ['leaderboard'], json: true }, '/tmp');
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.scoring_standard, 'standard/1');
    assert.equal(parsed.legacy_composite, null);
  });

  it('the table leads with chrF++ [95% CI], groups diagnostics, and prints no tier label', async () => {
    const tiers = ['baseline', 'emerging', 'functional', 'deployable', 'fluent'];
    mockFetch(tiers.map((t, i) => ({
      model_slug: `model-${i}`, condition: 'naive', language_pair: 'eng>crk',
      composite_score: 0.9 - i * 0.1, quality_tier: t,
      chrf_plus_plus: 50 - i, chrf_ci_lower: 48 - i, chrf_ci_upper: 52 - i,
      exact_match_rate: 0.1, run_timestamp: '2026-05-28T00:00:00Z', run_card: { contamination: 'LOW' },
    })));
    const { run } = await import('../lib/commands/leaderboard.js');
    for (const sort of [undefined, 'composite']) {
      captured = [];
      const code = await run({ _: ['leaderboard'], ...(sort ? { sort } : {}) }, '/tmp');
      assert.equal(code, 0);
      const out = captured.join('\n');
      assert.match(out, /chrF\+\+ \[95% CI\]/);
      assert.match(out, /50\.0 \[48\.0, 52\.0\]/);
      assert.match(out, /diagnostics/);
      for (const t of tiers) assert.doesNotMatch(out, new RegExp(`\\b${t}\\b`, 'i'), `tier "${t}" printed (sort ${sort})`);
      if (sort === 'composite') {
        assert.match(out, /Sorted by: Legacy composite \(retired\)/);
      } else {
        assert.match(out, /Sorted by: chrF\+\+/);
        assert.doesNotMatch(out, /composite/i, 'the default view shows no composite at all');
      }
    }
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
    // The board stores eng>crk (ISO 639-3, as mt-eval publish writes it):
    // en resolves to eng, and the value is URL-encoded (Round 10).
    assert.equal(new URL(capturedUrl).searchParams.get('language_pair'), 'eq.eng>crk');
  });

  it('sorts by chrF++ descending, nulls last, by default', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => [], status: 200 };
    };
    const { run } = await import('../lib/commands/leaderboard.js');
    await run({ _: ['leaderboard'] }, '/tmp');
    assert.equal(new URL(capturedUrl).searchParams.get('order'), 'chrf_plus_plus.desc.nullslast');
  });

  it('TER sorts lowest first; the legacy composite key still works', async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => [], status: 200 };
    };
    const { run } = await import('../lib/commands/leaderboard.js');
    await run({ _: ['leaderboard'], sort: 'ter' }, '/tmp');
    await run({ _: ['leaderboard'], sort: 'composite' }, '/tmp');
    assert.equal(new URL(urls[0]).searchParams.get('order'), 'ter.asc.nullslast');
    assert.equal(new URL(urls[1]).searchParams.get('order'), 'composite_score.desc.nullslast');
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

describe('a gated run on the leaderboard', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('says its headline is what its gates let through, with the ungated score and refusal rate', async () => {
    const gatedRow = { id: 7, condition: 'raw', model_slug: 'x/y', language_pair: 'eng>rus', chrf_plus_plus: 40.1,
      run_card: { scores: { scoring_standard: 'standard/1', ungated_chrf_plus_plus: 44.6,
        gates: { chain_id: 'no-english-left', refused: 3, judged: 25, refusal_rate: 0.12 } } } };
    const plainRow = { id: 8, condition: 'raw', model_slug: 'x/z', language_pair: 'eng>rus', chrf_plus_plus: 39.0,
      run_card: { scores: { scoring_standard: 'standard/1' } } };
    const { run } = await import('../lib/commands/leaderboard.js');
    const lines = [];
    const log = console.log;
    const rawOut = (await import('../lib/output.js')).output;
    const raw = rawOut.raw;
    console.log = (...a) => lines.push(a.join(' '));
    rawOut.raw = (s) => lines.push(String(s));
    try {
      mockFetch([gatedRow, plainRow]);
      assert.equal(await run({ _: ['leaderboard'] }, '/tmp'), 0);
      mockFetch([gatedRow, plainRow]);
      assert.equal(await run({ _: ['leaderboard'], json: true }, '/tmp'), 0);
    } finally {
      console.log = log;
      rawOut.raw = raw;
    }
    const text = lines.join('\n');
    assert.match(text, /Gated runs — the headline is what their gates let through: #1 ungated 44\.6, 12\.0% refused \(no-english-left\)/);
    const json = lines.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    assert.deepEqual(json.find((r) => r.model === 'x/y').gated,
      { chain: 'no-english-left', refused: 3, judged: 25, refusalRate: 0.12, ungatedChrf: 44.6 });
    assert.equal(json.find((r) => r.model === 'x/z').gated, null);
  });
});

describe('leaderboard --install writes method/1', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('a ranked run becomes a method/1 file the CLI can run — its evidence, no tier, nothing dropped', async () => {
    const os = await import('node:os');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { readMethodDocument } = await import('../lib/framework/method.js');
    const { pluginFromMethod } = await import('../lib/plugins.js');
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-install-'));
    mockFetch([{ id: 41, condition: 'raw', model_slug: 'google/gemini-3.8-flash', language_pair: 'eng>fra',
      chrf_plus_plus: 61.2, chrf_ci_lower: 59.8, chrf_ci_upper: 62.5, corpus_size: 200, dataset_id: 'flores-dev',
      run_timestamp: '2026-10-01T00:00:00Z', api_provider: 'openrouter',
      run_card: { method_config: { model: 'google/gemini-3.8-flash', temperature: 0, batchSize: 40, register: 'formal' } } }]);
    const { run } = await import('../lib/commands/leaderboard.js');
    const log = console.log;
    console.log = () => {};
    let code;
    try {
      code = await run({ _: ['leaderboard'], install: '1' }, cwd);
    } finally {
      console.log = log;
    }
    assert.equal(code, 0);
    const dir = path.join(cwd, '.champollion', 'methods');
    const [name] = fs.readdirSync(dir);
    const doc = JSON.parse(fs.readFileSync(path.join(dir, name, 'method.json'), 'utf-8'));
    const read = readMethodDocument(doc);
    assert.deepEqual(read.errors, []);
    assert.equal(doc.kind, 'llm');
    assert.equal(doc.model, 'google/gemini-3.8-flash');
    assert.equal(doc.provider, 'openrouter', 'the provider it ranked with travels with it');
    assert.deepEqual(doc.pairs, [{ source: 'eng', target: 'fra' }]);
    assert.deepEqual(doc.decode, { temperature: 0, batch_size: 40 });
    assert.deepEqual(doc.evidence[0], { dataset: 'flores-dev', pair: { source: 'eng', target: 'fra' }, metric: 'chrF++',
      score: 61.2, ci: [59.8, 62.5], n: 200, date: '2026-10-01T00:00:00Z', run: '41' });
    assert.equal(doc['x-method-config'].register, 'formal', 'nothing of the run card is dropped');
    assert.equal(JSON.stringify(doc).includes('qualityTier'), false);
    assert.equal(pluginFromMethod(read).error, undefined, 'the CLI can run it');
  });
});
