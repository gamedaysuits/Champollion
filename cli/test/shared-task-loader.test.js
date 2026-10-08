/**
 * sharedTaskLoader — the pure distiller half of the /shared-tasks page
 * (cli/website/src/utils/sharedTaskLoader.js): shared_tasks rows (migration
 * 046) + attached contests rows → edition objects, so one multi-pair
 * shared-task edition renders as ONE page grouping its per-pair contests.
 *
 * Only the pure functions are exercised here (grouping + pair formatting);
 * the fetch wrapper is the same graceful-degradation pattern as
 * contestLoader.js and needs a network to mean anything.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  groupContestsByEdition,
  mergeReportLinks,
  formatPair,
  formatStamp,
} from '../website/src/utils/sharedTaskLoader.js';

const EDITIONS = [
  {
    shared_task_id: 'americasnlp-2025',
    name: 'AmericasNLP 2025',
    organizer: 'AmericasNLP organizing committee',
    year: 2025,
    status: 'archived',
    description: '',
    default_authorization_model: 'blanket',
    default_intake_daily_limit: 5,
  },
  {
    shared_task_id: 'americasnlp-2026',
    name: 'AmericasNLP 2026',
    organizer: 'AmericasNLP organizing committee',
    year: 2026,
    status: 'active',
    description: 'Spanish into eleven Indigenous languages of the Americas.',
    default_authorization_model: 'blanket',
    default_intake_daily_limit: 5,
  },
];

const CONTESTS = [
  { id: 'c-quy', name: 'ES→QUY 2026', language_pair: 'spa>quy', status: 'closed', shared_task_id: 'americasnlp-2026' },
  { id: 'c-agr', name: 'ES→AGR 2026', language_pair: 'spa>agr', status: 'open', shared_task_id: 'americasnlp-2026' },
  { id: 'c-aym', name: 'ES→AYM 2026', language_pair: 'spa>aym', status: 'open', shared_task_id: 'americasnlp-2026' },
  // Belongs to an umbrella we cannot see — must be dropped, never mis-grouped.
  { id: 'c-orphan', name: 'Orphan', language_pair: 'spa>gn', status: 'open', shared_task_id: 'no-such-edition' },
];

describe('groupContestsByEdition', () => {
  it('groups per-pair contests under their edition, newest cycle first', () => {
    const editions = groupContestsByEdition(EDITIONS, CONTESTS);
    assert.equal(editions.length, 2);
    assert.equal(editions[0].sharedTaskId, 'americasnlp-2026');
    assert.equal(editions[1].sharedTaskId, 'americasnlp-2025');
    assert.equal(editions[0].contests.length, 3);
  });

  it('sorts a edition’s contests open-first, then by language pair', () => {
    const [current] = groupContestsByEdition(EDITIONS, CONTESTS);
    assert.deepEqual(
      current.contests.map((c) => c.id),
      ['c-agr', 'c-aym', 'c-quy'],
    );
  });

  it('keeps an announced edition with zero contests', () => {
    const editions = groupContestsByEdition(EDITIONS, []);
    assert.equal(editions.length, 2);
    assert.deepEqual(editions.map((e) => e.contests), [[], []]);
  });

  it('drops contests whose umbrella is not visible', () => {
    const editions = groupContestsByEdition(EDITIONS, CONTESTS);
    const allIds = editions.flatMap((e) => e.contests.map((c) => c.id));
    assert.ok(!allIds.includes('c-orphan'));
  });

  it('maps row fields onto the camelCase edition shape', () => {
    const [current] = groupContestsByEdition(EDITIONS, CONTESTS);
    assert.equal(current.name, 'AmericasNLP 2026');
    assert.equal(current.organizer, 'AmericasNLP organizing committee');
    assert.equal(current.year, 2026);
    assert.equal(current.defaultAuthorizationModel, 'blanket');
    assert.equal(current.defaultIntakeDailyLimit, 5);
    assert.equal(current.contests[0].languagePair, 'spa>agr');
  });

  it('degrades to [] on empty or missing inputs', () => {
    assert.deepEqual(groupContestsByEdition([], []), []);
    assert.deepEqual(groupContestsByEdition(null, null), []);
  });
});

describe('formatPair', () => {
  it('renders the arena.js pair convention', () => {
    assert.equal(formatPair('spa>quy'), 'SPA → QUY');
    assert.equal(formatPair(''), '?');
    assert.equal(formatPair(null), '?');
  });
});

/* --------------------------------------------------------------------------
   The edition report link + the close stamp (2026-09-06).

   Both are OPTIONAL data. `report_url` / `report_generated_at` only exist on a
   migrated database, and `closed_at` only exists once a contest has actually
   been closed. The rule for both is the same and is what these tests pin: when
   the value is absent the page shows NOTHING — never a placeholder link, never
   a guessed date.
   -------------------------------------------------------------------------- */

const REPORT_ROWS = [
  {
    shared_task_id: 'americasnlp-2026',
    report_url: 'https://example.org/americasnlp-2026-findings.pdf',
    report_generated_at: '2026-09-06T12:00:00+00:00',
  },
];

describe('mergeReportLinks', () => {
  it('folds the optional report columns onto their edition row', () => {
    const merged = mergeReportLinks(EDITIONS, REPORT_ROWS);
    const current = merged.find((e) => e.shared_task_id === 'americasnlp-2026');
    assert.equal(
      current.report_url,
      'https://example.org/americasnlp-2026-findings.pdf',
    );
    assert.equal(current.report_generated_at, '2026-09-06T12:00:00+00:00');
  });

  it('leaves editions with no report row untouched', () => {
    const merged = mergeReportLinks(EDITIONS, REPORT_ROWS);
    const older = merged.find((e) => e.shared_task_id === 'americasnlp-2025');
    assert.equal(older.report_url, undefined);
    assert.deepEqual(older, EDITIONS[0]);
  });

  it('is a no-op when the columns do not exist (pre-migration database)', () => {
    // The loader turns that failure into [] after logging the reason; the
    // page must then simply have no link, not a broken one.
    assert.deepEqual(mergeReportLinks(EDITIONS, []), EDITIONS);
    assert.deepEqual(mergeReportLinks(EDITIONS, null), EDITIONS);
  });

  it('degrades on empty inputs', () => {
    assert.deepEqual(mergeReportLinks(null, REPORT_ROWS), []);
  });
});

describe('groupContestsByEdition — report link', () => {
  it('exposes reportUrl / reportGeneratedAt when the row carries them', () => {
    const [current] = groupContestsByEdition(
      mergeReportLinks(EDITIONS, REPORT_ROWS),
      CONTESTS,
    );
    assert.equal(
      current.reportUrl,
      'https://example.org/americasnlp-2026-findings.pdf',
    );
    assert.equal(current.reportGeneratedAt, '2026-09-06T12:00:00+00:00');
  });

  it('nulls them when the columns are absent — never a placeholder', () => {
    const editions = groupContestsByEdition(EDITIONS, CONTESTS);
    for (const edition of editions) {
      assert.equal(edition.reportUrl, null);
      assert.equal(edition.reportGeneratedAt, null);
    }
  });
});

describe('groupContestsByEdition — close stamp', () => {
  const WITH_STAMP = [
    {
      id: 'c-quy',
      name: 'ES→QUY 2026',
      language_pair: 'spa>quy',
      status: 'closed',
      shared_task_id: 'americasnlp-2026',
      closed_at: '2026-09-06T12:00:00+00:00',
    },
    {
      id: 'c-agr',
      name: 'ES→AGR 2026',
      language_pair: 'spa>agr',
      status: 'open',
      shared_task_id: 'americasnlp-2026',
    },
  ];

  it('carries closed_at through as closedAt', () => {
    const [current] = groupContestsByEdition(EDITIONS, WITH_STAMP);
    const closed = current.contests.find((c) => c.id === 'c-quy');
    assert.equal(closed.closedAt, '2026-09-06T12:00:00+00:00');
  });

  it('nulls closedAt when the selector was refused or the contest is open', () => {
    const [current] = groupContestsByEdition(EDITIONS, WITH_STAMP);
    assert.equal(current.contests.find((c) => c.id === 'c-agr').closedAt, null);
    const [fallback] = groupContestsByEdition(EDITIONS, CONTESTS);
    for (const contest of fallback.contests) assert.equal(contest.closedAt, null);
  });
});

describe('formatStamp', () => {
  it('renders the calendar date of a timestamp', () => {
    assert.equal(formatStamp('2026-09-06T12:00:00+00:00'), '2026-09-06');
  });

  it('returns null rather than a fabricated date', () => {
    assert.equal(formatStamp(null), null);
    assert.equal(formatStamp(undefined), null);
    assert.equal(formatStamp(''), null);
    assert.equal(formatStamp('not a date'), null);
  });
});
