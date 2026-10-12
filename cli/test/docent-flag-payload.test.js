/**
 * Community flagging — the browser half of the contract
 * (`cli/website/src/utils/docentClient.js`, migration 074, practice 13).
 *
 * A reader who believes a published run card is wrong files a `flag` ticket
 * naming that card's id. Everything asserted here is the *client* half of the
 * three-way contract; the Deno half lives in
 * `mt-eval-arena/supabase/functions/submit-ticket/lib_test.ts` and the DB half
 * in migration 074. `arena/tests/test_ticket_kinds_parity.py` proves the three
 * kind vocabularies agree.
 *
 * Two rules are load-bearing and are asserted, not assumed:
 *   1. A flag ALWAYS carries a run card id — the client refuses to build or
 *      post one without it, rather than round-tripping a 400.
 *   2. No flag COUNT is ever rendered. A count is a gaming surface; the only
 *      public consequence of an upheld flag is the card's trust becoming
 *      `disqualified`. This file asserts that the two flag-aware UI modules
 *      contain no count/tally rendering.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  FLAG_KIND,
  FLAG_REQUEST_EVENT,
  RUN_CARD_ID_PATTERN,
  buildFlagPayload,
  isRunCardId,
  requestRunCardFlag,
  submitTicket,
  ticketErrorText,
} from '../website/src/utils/docentClient.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCENT = path.join(HERE, '..', 'website', 'src', 'components', 'Docent', 'index.js');
const LEADERBOARD = path.join(HERE, '..', 'website', 'src', 'pages', 'leaderboard.js');

const CARD_ID = '2f1b7c84-9a0e-5d3f-8b61-0c4e7a9d1234';

describe('isRunCardId — the 074 shape rule', () => {
  it('accepts a run card id and nothing looser', () => {
    assert.equal(isRunCardId(CARD_ID), true);
    assert.equal(isRunCardId(CARD_ID.toUpperCase()), false, 'stored ids are lower-case');
    assert.equal(isRunCardId(CARD_ID.slice(0, 35)), false, 'too short');
    assert.equal(isRunCardId(`${CARD_ID}0`), false, 'too long');
    assert.equal(isRunCardId('g'.repeat(36)), false, 'non-hex');
    assert.equal(isRunCardId(''), false);
    assert.equal(isRunCardId(undefined), false);
  });

  it('is the same literal pattern the edge function enforces', () => {
    // Not "a uuid regex" — the exact CHECK from migration 074.
    assert.equal(RUN_CARD_ID_PATTERN.source, '^[0-9a-f-]{36}$');
  });
});

describe('buildFlagPayload — the exact body a flag posts', () => {
  it('builds the full payload', () => {
    const payload = buildFlagPayload({
      runCardId: CARD_ID,
      message: '  The corpus sha does not match the registry entry.  ',
      contactEmail: 'reader@example.org',
      locale: 'en',
      pageUrl: 'https://champollion.dev/leaderboard',
    });
    assert.deepEqual(payload, {
      kind: 'flag',
      subject_run_card_id: CARD_ID,
      message: 'The corpus sha does not match the registry entry.',
      source: 'docent-flag',
      contact_email: 'reader@example.org',
      locale: 'en',
      page_url: 'https://champollion.dev/leaderboard',
    });
  });

  it('omits the optional fields rather than sending empty ones', () => {
    const payload = buildFlagPayload({ runCardId: CARD_ID, message: 'gamed metric' });
    assert.deepEqual(Object.keys(payload).sort(), [
      'kind',
      'message',
      'source',
      'subject_run_card_id',
    ]);
    assert.equal(payload.source, 'docent-flag', 'default source names the door');
  });

  it('refuses a flag with no card and a flag with no reason', () => {
    assert.throws(
      () => buildFlagPayload({ runCardId: 'nope', message: 'x' }),
      /run card id/,
    );
    assert.throws(
      () => buildFlagPayload({ runCardId: CARD_ID, message: '   ' }),
      /must state a reason/,
    );
  });
});

describe('submitTicket — flag guards run before the network', () => {
  let calls;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, id: 7, emailed: false }),
      };
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('posts a well-formed flag to submit-ticket', async () => {
    const res = await submitTicket(
      buildFlagPayload({ runCardId: CARD_ID, message: 'contaminated corpus' }),
    );
    assert.equal(res.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/functions\/v1\/submit-ticket$/);
    assert.equal(calls[0].body.kind, 'flag');
    assert.equal(calls[0].body.subject_run_card_id, CARD_ID);
    assert.equal(calls[0].body.message, 'contaminated corpus');
  });

  it('refuses a flag with no subject card without calling the network', async () => {
    const res = await submitTicket({ kind: FLAG_KIND, message: 'this is wrong' });
    assert.equal(res.ok, false);
    assert.match(res.error, /must name the run card/);
    assert.equal(calls.length, 0, 'no request is made');
  });

  it('refuses a subject card on any other kind', async () => {
    const res = await submitTicket({
      kind: 'correction',
      message: 'typo',
      subject_run_card_id: CARD_ID,
    });
    assert.equal(res.ok, false);
    assert.match(res.error, /only accepted on a 'flag'/);
    assert.equal(calls.length, 0);
  });

  it('leaves an ordinary ticket exactly as it was', async () => {
    const res = await submitTicket({ kind: 'question', message: 'how do I publish?' });
    assert.equal(res.ok, true);
    assert.equal(calls[0].body.source, 'docent-form', 'the default source is unchanged');
    assert.equal('subject_run_card_id' in calls[0].body, false);
  });
});

describe('a refused flag says why, in the server\'s own words', () => {
  // The flag kind and `tickets.subject_run_card_id` arrive together in
  // migration 074. Against a live database without it the insert fails and the
  // edge function hands PostgREST's words back; against an undeployed function
  // the platform answers 404 NOT_FOUND with no `error` key at all. Either way
  // the flag was NOT filed, and a visitor must be told that — never "please
  // try again", which would present a lane that is not running as a hiccup.
  const PGRST_MISSING_COLUMN =
    'the database rejected this ticket: {"code":"PGRST204","message":' +
    '"Column \'subject_run_card_id\' of relation \'tickets\' does not exist"}';

  it('names the lane and quotes the database when 074 is not applied', () => {
    const text = ticketErrorText({ error: PGRST_MISSING_COLUMN }, 400, FLAG_KIND);
    assert.match(text, /not running on this deployment/i, 'says the lane is not live');
    assert.match(text, /was not filed/i, 'says the flag did not land');
    assert.ok(text.includes(PGRST_MISSING_COLUMN), 'quotes the server verbatim');
    assert.match(text, /info@champollion\.dev/, 'names a route that works');
  });

  it('does the same when the ticket function is not deployed at all', () => {
    // The platform's own 404 shape: `message`, no `error`.
    const text = ticketErrorText(
      { code: 'NOT_FOUND', message: 'Requested function was not found' },
      404,
      FLAG_KIND,
    );
    assert.match(text, /not running on this deployment/i);
    assert.ok(text.includes('Requested function was not found'));
  });

  it('passes an unrelated refusal through unchanged rather than blaming 074', () => {
    const rate = 'too many messages from this address — try again in an hour.';
    assert.equal(ticketErrorText({ error: rate }, 429, FLAG_KIND), rate);
    assert.equal(ticketErrorText({ error: 'validation: message is empty' }, 400, 'question'),
      'validation: message is empty');
  });

  it('never invents a reason when the server gave none', () => {
    assert.match(ticketErrorText({}, 503, 'question'), /not reachable right now \(503\)/);
    assert.equal(ticketErrorText({}, 418, 'question'), 'request failed (418)');
  });

  describe('end to end through submitTicket', () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('surfaces the database\'s refusal of a flag', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: PGRST_MISSING_COLUMN }),
      });
      const res = await submitTicket(
        buildFlagPayload({ runCardId: CARD_ID, message: 'contaminated corpus' }),
      );
      assert.equal(res.ok, false);
      assert.equal(res.status, 400);
      assert.match(res.error, /not running on this deployment/i);
      assert.ok(res.error.includes('subject_run_card_id'));
    });

    it('reports the thrown reason instead of a bare "network error"', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };
      const res = await submitTicket(
        buildFlagPayload({ runCardId: CARD_ID, message: 'gamed metric' }),
      );
      assert.equal(res.ok, false);
      assert.equal(res.status, 0);
      assert.ok(res.error.includes('Failed to fetch'), 'the throw is not swallowed');
    });
  });

  it('the docent shows the server text rather than a generic failure', () => {
    const src = readFileSync(DOCENT, 'utf8');
    assert.match(
      src,
      /setTStatus\(\{ok: false, text: res\.error \|\|/,
      'the form surfaces res.error before any fallback of its own',
    );
  });
});

describe('requestRunCardFlag — the seam a run-card view uses', () => {
  const realWindow = globalThis.window;
  afterEach(() => {
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
  });

  it('dispatches the flag-request event with the card id', () => {
    const seen = [];
    globalThis.window = {
      dispatchEvent: (e) => {
        seen.push(e);
        return true;
      },
    };
    const ok = requestRunCardFlag({ runCardId: CARD_ID, label: 'gpt-5 / eng>crk' });
    assert.equal(ok, true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].type, FLAG_REQUEST_EVENT);
    assert.equal(seen[0].detail.runCardId, CARD_ID);
    assert.equal(seen[0].detail.label, 'gpt-5 / eng>crk');
  });

  it('refuses to open a form that could not be submitted', () => {
    const seen = [];
    globalThis.window = { dispatchEvent: (e) => seen.push(e) };
    const errors = [];
    const realError = console.error;
    console.error = (...args) => errors.push(args.join(' '));
    try {
      assert.equal(requestRunCardFlag({ runCardId: 'not-an-id' }), false);
    } finally {
      console.error = realError;
    }
    assert.equal(seen.length, 0, 'nothing dispatched');
    assert.equal(errors.length, 1, 'and it says so out loud');
  });
});

describe('no public flag count anywhere', () => {
  // The plan forbids it in as many words: a count is a gaming surface. This is
  // a source-level guard so a later "helpful" badge cannot slip in unnoticed.
  const FORBIDDEN = [
    /flag[_a-zA-Z]*[Cc]ount/,
    /[Cc]ount[_a-zA-Z]*[Ff]lag/,
    /flags?\s*:\s*\d/,
    /flagged by \d/,
  ];

  for (const [name, file] of [['Docent', DOCENT], ['leaderboard', LEADERBOARD]]) {
    it(`${name} renders no flag tally`, () => {
      const src = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN) {
        assert.equal(re.test(src), false, `${name} must not render ${re}`);
      }
    });
  }

  it('the flag affordance lives only inside an expanded run card', () => {
    const src = readFileSync(LEADERBOARD, 'utf8');
    assert.match(src, /requestRunCardFlag/, 'the leaderboard opens the flag form');
    assert.match(
      src,
      /if \(!isRunCardId\(entry\?\.id\)\) return null;/,
      'a row without a run card id gets no affordance',
    );
  });

  it('the docent offers `flag` only with a card in context', () => {
    const src = readFileSync(DOCENT, 'utf8');
    assert.match(src, /subjectRequired: true/, 'flag is marked as needing a subject');
    assert.match(
      src,
      /TICKET_KINDS\.filter\(\s*\(k\) => !k\.subjectRequired \|\| flagSubject,?\s*\)/,
      'the picker hides subject-requiring kinds until a subject exists',
    );
  });
});
