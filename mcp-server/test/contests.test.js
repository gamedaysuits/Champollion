/**
 * list_contests / get_contest — read-only, bounded, honest about RLS, and
 * never a channel for an entrant's email.
 *
 * Every read goes through an injected fetch: no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listContests, getContest, formatContestList, formatContest,
  FROZEN_PROMISE_KEYS, promisesDigest, extractPromises,
} from '../src/tools/contests.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** A fetch double routing by table name; records every URL. */
function routed(tables) {
  const urls = [];
  const impl = async (url) => {
    urls.push(String(url));
    const table = String(url).split('/rest/v1/')[1].split('?')[0];
    const body = typeof tables[table] === 'function' ? tables[table](String(url)) : (tables[table] ?? []);
    if (body instanceof Error) throw body;
    const status = body?.status ?? 200;
    const payload = body?.status ? body.body : body;
    return { ok: status < 400, status, text: async () => JSON.stringify(payload) };
  };
  return { impl, urls };
}

const OPEN = {
  id: 'crk-school-2026',
  name: 'Plains Cree school sentences',
  description: 'Sealed test set held by the community.',
  corpus_id: 'sealed-crk-school-v1',
  language_pair: 'eng>crk',
  visibility: 'public',
  status: 'open',
  use_context: 'non-commercial',
  lane: 'sealed',
  intake_open: true,
  shared_task_id: null,
  created_at: '2026-09-20T00:00:00Z',
  metadata: {
    primary_metric: 'chrf_plus_plus',
    results_visibility: 'immediate',
    tie_test: 'bootstrap',
    alpha: 0.05,
    prize_terms: { disposition: 'pass_to_holders' },
    anonymize_until_close: false,
    some_free_form_key: 'not a promise',
  },
};

describe('list_contests', () => {
  it('an empty public network is reported as such — not as an error', async () => {
    const { impl } = routed({ contests: [], shared_tasks: [] });
    const r = await listContests({ fetchImpl: impl });
    const text = formatContestList(r);
    assert.match(text, /No contests are visible to an anonymous reader/);
    assert.match(text, /team contests are never anon-readable/);
  });

  it('filters by language on either side of the pair', async () => {
    const other = { ...OPEN, id: 'yor-1', language_pair: 'eng>yor' };
    const { impl } = routed({ contests: [OPEN, other], shared_tasks: [] });
    const r = await listContests({ language: 'crk', fetchImpl: impl });
    assert.equal(r.total, 1);
    assert.equal(r.contests[0].id, 'crk-school-2026');
    assert.match(formatContestList(r), /ranks on chrF\+\+,/);
  });

  it('never selects created_by (an email)', async () => {
    const { impl, urls } = routed({ contests: [OPEN], shared_tasks: [] });
    await listContests({ fetchImpl: impl });
    assert.ok(urls.every((u) => !/created_by/.test(decodeURIComponent(u))), urls.join('\n'));
  });
});

describe('get_contest', () => {
  it('not visible → says why (team contests / nonexistent) and where to look', async () => {
    const { impl } = routed({ contests: [] });
    const r = await getContest('nope', { fetchImpl: impl });
    assert.equal(r.status, 'not-visible');
    assert.match(formatContest(r), /TEAM contest/);
    assert.match(formatContest(r), /list_contests/);
  });

  it('open + immediate: phases (active window), promises + digest, interim scores — never emails', async () => {
    const now = Date.parse('2026-10-03T00:00:00Z');
    const { impl, urls } = routed({
      contests: [OPEN],
      contest_phases: [
        { name: 'practice', starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z', max_submissions: null, max_submissions_per_day: 5 },
        { name: 'evaluation', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z', max_submissions: 3, max_submissions_per_day: 1 },
      ],
      contest_submissions: [
        { run_card_id: 'rc-1', team: null, submitter_label: 'Team Maskwa', submitted_at: '2026-10-02', is_primary: true, track: 'constrained', phase: 'evaluation' },
      ],
      run_cards: [{ id: 'rc-1', model_slug: 'local/forge-crk-v1', trust: 'verified', chrf_plus_plus: 41.2, chrf_ci_lower: 39.5, chrf_ci_upper: 42.8 }],
    });
    const r = await getContest('crk-school-2026', { fetchImpl: impl, now });
    assert.equal(r.status, 'ok');
    const text = formatContest(r);
    assert.match(text, /▶ evaluation/);
    assert.match(text, /tie_test: bootstrap/);
    assert.match(text, /terms digest: sha256 [0-9a-f]{64}/);
    assert.doesNotMatch(text, /some_free_form_key/, 'only PROMISE keys are terms');
    assert.match(text, /INTERIM scores/);
    assert.match(text, /Team Maskwa/);
    // Scoring standard/1: the metric by name, with its CI.
    assert.match(text, /chrF\+\+ 41\.2 \[39\.5, 42\.8\]/);
    assert.ok(urls.some((u) => decodeURIComponent(u).includes('chrf_ci_lower,chrf_ci_upper')), 'the CI is read with the score');
    for (const u of urls) {
      assert.doesNotMatch(decodeURIComponent(u), /submitted_by|created_by/, `email column read: ${u}`);
    }
  });

  it('hidden_until_close: no scores, and says deferred results are not anon-readable', async () => {
    const hidden = { ...OPEN, metadata: { ...OPEN.metadata, results_visibility: 'hidden_until_close' } };
    const { impl, urls } = routed({ contests: [hidden], contest_phases: [], contest_submissions: [{ run_card_id: 'rc-1' }] });
    const r = await getContest(hidden.id, { fetchImpl: impl });
    assert.match(formatContest(r), /HIDDEN until close/);
    assert.match(formatContest(r), /no anonymous read/);
    assert.ok(!urls.some((u) => u.includes('/run_cards')), 'no score read while hidden');
  });

  it('anonymize_until_close hides entrant labels while open', async () => {
    const anon = { ...OPEN, metadata: { ...OPEN.metadata, anonymize_until_close: true } };
    const { impl } = routed({
      contests: [anon], contest_phases: [],
      contest_submissions: [{ run_card_id: 'rc-1', submitter_label: 'Team Maskwa' }],
      run_cards: [{ id: 'rc-1', model_slug: 'm', chrf_plus_plus: 40 }],
    });
    const text = formatContest(await getContest(anon.id, { fetchImpl: impl }));
    assert.doesNotMatch(text, /Team Maskwa/);
    assert.match(text, /labels are hidden until close/);
  });

  it('closed: renders the FROZEN final ranking with CIs and tie groups', async () => {
    const closed = {
      ...OPEN, status: 'closed',
      metadata: {
        ...OPEN.metadata,
        closed_at: '2026-11-02T00:00:00Z',
        closed_by: 'organizer@example.org',
        final_ranking: {
          metric: 'chrf_plus_plus',
          entries: [
            { rank: 1, tie_group: 1, submitter_label: 'Team Maskwa', model_slug: 'm1', primary: { metric: 'chrf_plus_plus', value: 44.1, ci_lower: 42.0, ci_upper: 46.0 } },
            { rank: 1, tie_group: 1, pseudonym: 'entrant-7f3a', model_slug: 'm2', primary: { value: 43.5 } },
          ],
        },
      },
    };
    const { impl } = routed({ contests: [closed], contest_phases: [], contest_submissions: [] });
    const text = formatContest(await getContest(closed.id, { fetchImpl: impl }));
    assert.match(text, /FINAL ranking/);
    assert.match(text, /#1 \(tie group 1\)\s+Team Maskwa\s+m1\s+chrF\+\+ 44\.1 \[42, 46\]/);
    assert.match(text, /entrant-7f3a/);
    assert.doesNotMatch(text, /organizer@example\.org/, 'closed_by is an email — never shown');
  });

  it('scoring standard/1: an undeclared metric is chrF++ (said to be the default); a legacy composite contest is labelled retired', async () => {
    const undeclared = { ...OPEN, id: 'undeclared', metadata: { results_visibility: 'immediate' } };
    const legacy = { ...OPEN, id: 'legacy', metadata: { ...OPEN.metadata, primary_metric: 'composite' } };
    const list = formatContestList(await listContests({ fetchImpl: routed({ contests: [undeclared, legacy], shared_tasks: [] }).impl }));
    assert.match(list, /undeclared — .* ranks on chrF\+\+ \(the default; none declared\)/);
    assert.match(list, /legacy — .* ranks on legacy composite \(retired\)/);

    const { impl } = routed({
      contests: [legacy],
      contest_submissions: [{ run_card_id: 'rc-9', submitter_label: 'Old Team', is_primary: true }],
      run_cards: [{ id: 'rc-9', model_slug: 'm', trust: 'unverified', composite_score: 0.62, quality_tier: 'functional' }],
    });
    const text = formatContest(await getContest('legacy', { fetchImpl: impl }));
    assert.match(text, /legacy composite \(retired\) 0\.62/);
    for (const w of ['baseline', 'emerging', 'functional', 'deployable', 'fluent']) {
      assert.doesNotMatch(text, new RegExp(`\\b${w}\\b`, 'i'), `tier "${w}" printed`);
    }
  });

  it('a dead network is a readable error, not a TypeError', async () => {
    const { impl } = routed({ contests: new TypeError('fetch failed') });
    await assert.rejects(getContest('x', { fetchImpl: impl }), /could not reach the public contest tables/);
  });
});

describe('promises', () => {
  it('the digest is key-order independent and changes when a promise changes', () => {
    const a = promisesDigest({ alpha: 0.05, tie_test: 'ar', prize_terms: { disposition: 'retain_ip', x: 1 } });
    const b = promisesDigest({ prize_terms: { x: 1, disposition: 'retain_ip' }, tie_test: 'ar', alpha: 0.05 });
    const c = promisesDigest({ alpha: 0.01, tie_test: 'ar', prize_terms: { disposition: 'retain_ip', x: 1 } });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it('extractPromises keeps primary_metric + the frozen keys only', () => {
    assert.deepEqual(Object.keys(extractPromises(OPEN.metadata)).sort(),
      ['alpha', 'anonymize_until_close', 'primary_metric', 'prize_terms', 'results_visibility', 'tie_test']);
  });

  it('FROZEN_PROMISE_KEYS mirrors arena contest_policy.py (the Python SSOT)', (t) => {
    const policy = resolve(__dirname, '../../arena/mt_eval_harness/contest_policy.py');
    if (!existsSync(policy)) { t.skip('arena not in this checkout'); return; }
    const src = readFileSync(policy, 'utf-8');
    const block = src.match(/FROZEN_PROMISE_KEYS[^=]*=\s*\(([\s\S]*?)\n\)/);
    assert.ok(block, 'could not find FROZEN_PROMISE_KEYS in contest_policy.py');
    const keys = [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...FROZEN_PROMISE_KEYS], keys);
  });
});

describe('filter hygiene', () => {
  it('run-card ids with underscores survive; PostgREST syntax does not', async () => {
    const { impl, urls } = routed({
      contests: [OPEN], contest_phases: [],
      contest_submissions: [{ run_card_id: 'eng-crk-x__local_forge-v1__naive' }, { run_card_id: 'evil),or=(id.neq.0' }],
      run_cards: [],
    });
    await getContest(OPEN.id, { fetchImpl: impl });
    const rc = decodeURIComponent(urls.find((u) => u.includes('/run_cards')));
    assert.match(rc, /eng-crk-x__local_forge-v1__naive/);
    assert.doesNotMatch(rc, /or=\(/);
  });
});
