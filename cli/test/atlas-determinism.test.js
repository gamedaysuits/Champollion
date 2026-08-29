/**
 * atlas-determinism.test.js — same pins in, same bytes out.
 *
 * The atlas claims that an identical set of pinned sources produces an
 * identical set of cards. That claim is the only thing that lets anyone else
 * check our work: without it, "rebuild it yourself and compare" is not an
 * offer we can make, and every number we publish has to be taken on trust.
 *
 * IT ALREADY HOLDS, AND THAT IS WHY THIS TEST EXISTS
 *   A review reported determinism as broken — `builtAt` inside `contentHash`,
 *   so the hash would drift daily. Checked against the running build, it was
 *   wrong: `project.mjs` already keeps the build date off cards on purpose, and
 *   two builds from identical pins produced the same hash to the character.
 *
 *   So there was no bug. There was also no test, which is why a plausible claim
 *   that there WAS one could not be dismissed in less than two full rebuilds.
 *   The property was true by care rather than by construction, and care is not
 *   inherited by the next person who edits the projector.
 *
 * WHY IT DOES NOT REBUILD
 *   A build is ~127 seconds; proving it twice is over four minutes, which is
 *   too slow to run on every commit and would therefore end up skipped. So this
 *   tests the PROPERTY rather than the procedure: the projector is handed two
 *   different build dates and must return byte-identical cards. That is the
 *   exact thing a timestamp leak would break, and it runs in seconds.
 *
 *   The full end-to-end check stays available and is documented below; it is
 *   the acceptance step, not the unit gate.
 *
 *     node cli/scripts/cldf/build-atlas.mjs && node cli/scripts/cldf/build-atlas.mjs
 *     # the two reported `content hash` lines must match
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPO = path.join(import.meta.dirname, '..', '..');
const ATLAS_DB = path.join(REPO, 'cli', 'data', 'atlas.db');

const digest = (cards) => {
  const h = createHash('sha256');
  for (const [code, card] of [...cards].sort(([a], [b]) => a.localeCompare(b))) {
    h.update(code).update(JSON.stringify(card));
  }
  return h.digest('hex');
};

describe('the projector does not leak the clock into a card', () => {
  let projectCards; let db;

  before(async () => {
    if (!fs.existsSync(ATLAS_DB)) return;
    ({ projectCards } = await import('../scripts/cldf/project.mjs'));
    const { openAtlas } = await import('../scripts/cldf/schema.mjs');
    // `{}` deliberately, NOT `{fresh:true}` — that deletes the store. The
    // projector reads the parameter registry out of the db itself, so nothing
    // else needs loading here.
    db = openAtlas({});
  });

  test('two different build dates produce byte-identical cards', (t) => {
    if (!fs.existsSync(ATLAS_DB)) {
      t.skip('no atlas.db — run build-atlas.mjs first');
      return;
    }
    // The two dates are deliberately far apart. A leak that only shows up
    // across a month or year boundary is still a leak.
    const a = projectCards(db, { version: 'test', builtAt: '2020-01-01' });
    const b = projectCards(db, { version: 'test', builtAt: '2031-12-31' });

    assert.equal(
      digest(a.cards), digest(b.cards),
      'Cards differ when only the build date differs, so `same pins in, same bytes out` '
      + 'is false and nobody can reproduce our output to check it. Find what carried the '
      + 'timestamp — `project.mjs` keeps it off cards on purpose and something has '
      + 'started passing it through.',
    );
  });

  test('the atlas stamp on a card carries a version and no date', (t) => {
    if (!fs.existsSync(ATLAS_DB)) {
      t.skip('no atlas.db — run build-atlas.mjs first');
      return;
    }
    const { cards } = projectCards(db, { version: 'test', builtAt: '2020-01-01' });
    const [, card] = [...cards][0] ?? [];
    assert.ok(card, 'the projector returned no cards at all');
    assert.ok(card._atlas?.version, 'a card must say which atlas version produced it');
    // A card must be traceable to a build. `builtAt` would do that AND destroy
    // reproducibility; the version resolves to a date in ATLAS-RELEASE.json, so
    // nothing is lost.
    assert.deepEqual(
      Object.keys(card._atlas).sort(), ['version'],
      '`_atlas` carries something besides `version`. If it is a date, it makes two builds '
      + 'from identical pins differ by the calendar.',
    );
  });
});
