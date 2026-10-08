/**
 * Unit tests for the homepage "Latest network runs" strip formatter
 * (cli/website/src/utils/recentRuns.mjs) — pure functions, no DOM/network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARQUEE_MIN_ROWS,
  RECENT_RUNS_LIMIT,
  dateLabel,
  formatRunChip,
  pairLabel,
  recentRunsUrl,
  scoreLabel,
  shortModel,
} from '../website/src/utils/recentRuns.mjs';

test('recentRunsUrl queries newest-first, excludes disqualified', () => {
  const url = recentRunsUrl('https://x.supabase.co');
  assert.ok(url.startsWith('https://x.supabase.co/rest/v1/run_cards?'));
  assert.match(url, /order=submitted_at\.desc/);
  assert.match(url, /trust=neq\.disqualified/);
  assert.match(url, new RegExp(`limit=${RECENT_RUNS_LIMIT}`));
  for (const col of ['language_pair', 'model_slug', 'chrf_plus_plus', 'submitted_at']) {
    assert.ok(url.includes(col), `missing column ${col}`);
  }
});

test('shortModel strips the provider prefix, passes engines through', () => {
  assert.equal(shortModel('anthropic/claude-haiku-4.5'), 'claude-haiku-4.5');
  assert.equal(shortModel('microsoft-translator'), 'microsoft-translator');
  assert.equal(shortModel(''), '?');
  assert.equal(shortModel(null), '?');
});

test('pairLabel uses names when known, codes otherwise', () => {
  const names = {eng: 'English', pam: 'Kapampangan'};
  assert.equal(pairLabel('eng>pam', names), 'English → Kapampangan');
  assert.equal(pairLabel('eng>zzz', names), 'English → zzz');
  assert.equal(pairLabel('eng>pam', null), 'eng → pam');
  assert.equal(pairLabel('garbage', names), 'garbage');
});

test('dateLabel is deterministic UTC, year only when it differs', () => {
  const now = new Date('2026-07-19T12:00:00Z');
  assert.equal(dateLabel('2026-07-19T03:04:05Z', now), 'Jul 19');
  assert.equal(dateLabel('2025-12-31T23:59:59Z', now), 'Dec 31 2025');
  assert.equal(dateLabel('not-a-date', now), '');
  assert.equal(dateLabel(undefined, now), '');
});

test('scoreLabel formats chrF++ to one decimal, dash when absent', () => {
  assert.equal(scoreLabel(17.74), 'chrF++ 17.7');
  assert.equal(scoreLabel(0), 'chrF++ 0.0');
  assert.equal(scoreLabel(null), '—');
  assert.equal(scoreLabel(undefined), '—');
});

test('formatRunChip assembles a chip and rejects unusable rows', () => {
  const now = new Date('2026-07-19T12:00:00Z');
  const chip = formatRunChip(
    {
      language_pair: 'eng>pam',
      model_slug: 'anthropic/claude-haiku-4.5',
      chrf_plus_plus: 17.74,
      submitted_at: '2026-07-19T03:00:00Z',
    },
    {eng: 'English', pam: 'Kapampangan'},
    now,
  );
  assert.deepEqual(chip, {
    pair: 'eng>pam',
    pairLabel: 'English → Kapampangan',
    model: 'claude-haiku-4.5',
    score: 'chrF++ 17.7',
    date: 'Jul 19',
  });
  assert.equal(formatRunChip(null, {}), null);
  assert.equal(formatRunChip({model_slug: 'x'}, {}), null);
});

test('marquee threshold stays sane relative to the fetch limit', () => {
  assert.ok(MARQUEE_MIN_ROWS <= RECENT_RUNS_LIMIT);
  assert.ok(MARQUEE_MIN_ROWS >= 2);
});

test('pairLabel accepts a Map (loadLanguageNameMap returns one)', () => {
  const map = new Map([['eng', 'English'], ['xho', 'Xhosa']]);
  assert.equal(pairLabel('eng>xho', map), 'English → Xhosa');
  assert.equal(pairLabel('eng>zzz', map), 'English → zzz');
});
