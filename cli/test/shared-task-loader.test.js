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
  formatPair,
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
