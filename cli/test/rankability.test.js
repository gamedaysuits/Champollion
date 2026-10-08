/**
 * rankability.test.js — licence first, then power, then redundancy.
 *
 * The order is load-bearing and so is the refusal to treat an unknown licence
 * as a permissive one. Both were founder corrections, and both are the kind of
 * rule that quietly inverts if nobody holds it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  rankability, auditAgainstFlags, RANKABLE, BLOCKED_BY,
} from '../scripts/cldf/rankability.mjs';

/** A corpus that passes every rule. */
const clean = {
  id: 'flores-plus-devtest',
  licence: 'CC-BY-SA-4.0',
  licenceEstablished: true,
  rankingPermitted: true,
  minimumDetectableEffect: 0.9,
  mdeMetric: 'chrF++',
  mdeParameterSource: 'measured',
  subsetOf: null,
  publisherDefinedSplit: true,
};

describe('licence is asked first', () => {
  test('an established, permitting licence passes the gate', () => {
    assert.equal(rankability(clean).rankable, RANKABLE.YES);
  });

  test('an unestablished licence blocks exactly as a refusal does', () => {
    // Not knowing is not permission. This is the rule the whole licence lane
    // rests on, and the one most likely to be softened by someone in a hurry.
    const r = rankability({ ...clean, licenceEstablished: false });
    assert.equal(r.rankable, RANKABLE.NO);
    assert.equal(r.blockedBy, BLOCKED_BY.LICENCE);
    assert.match(r.because, /not knowing is not permission/);
  });

  test('a missing licence blocks', () => {
    assert.equal(rankability({ ...clean, licence: null }).blockedBy, BLOCKED_BY.LICENCE);
  });

  test('an explicit refusal blocks', () => {
    assert.equal(
      rankability({ ...clean, rankingPermitted: false }).blockedBy, BLOCKED_BY.LICENCE,
    );
  });

  test('licence is reported even when power would also fail', () => {
    // Answering "underpowered" about a corpus we may not rank at all answers a
    // question nobody should have reached.
    const r = rankability({
      ...clean, licenceEstablished: false, minimumDetectableEffect: null, subsetOf: 'x',
    });
    assert.equal(r.blockedBy, BLOCKED_BY.LICENCE);
    assert.equal(r.checks.length, 1, 'later rules are not even evaluated');
  });
});

describe('power, second', () => {
  test('a corpus that cannot reach the target power at any effect is blocked', () => {
    const r = rankability({ ...clean, minimumDetectableEffect: null });
    assert.equal(r.blockedBy, BLOCKED_BY.POWER);
  });

  test('a corpus too blunt for the claimed margin is blocked, and says both numbers', () => {
    // The median corpus card resolves about 4 chrF++. A leaderboard claiming to
    // see 1 must not be settled by it.
    const r = rankability({ ...clean, minimumDetectableEffect: 4.1 }, { claimedMargin: 1.0 });
    assert.equal(r.blockedBy, BLOCKED_BY.POWER);
    assert.match(r.because, /4\.1/);
    assert.match(r.because, /1/);
  });

  test('a borrowed parameter set is flagged in the reason', () => {
    const r = rankability(
      { ...clean, minimumDetectableEffect: 4.1, mdeParameterSource: 'prior' },
      { claimedMargin: 1.0 },
    );
    assert.match(r.because, /borrowed parameters/);
  });

  test('a sharper corpus passes the same margin', () => {
    assert.equal(
      rankability({ ...clean, minimumDetectableEffect: 0.5 }, { claimedMargin: 1.0 }).rankable,
      RANKABLE.YES,
    );
  });
});

describe('redundancy, last', () => {
  test('a subset of an indexed corpus is blocked', () => {
    // The crk incident in general form: an easy slice of a set already present
    // counts one body of evidence twice, and the easier slice usually wins.
    const r = rankability({ ...clean, subsetOf: 'edtekla-full' });
    assert.equal(r.blockedBy, BLOCKED_BY.REDUNDANCY);
    assert.match(r.because, /edtekla-full/);
  });

  test('a split we invented is blocked', () => {
    const r = rankability({ ...clean, publisherDefinedSplit: false });
    assert.equal(r.blockedBy, BLOCKED_BY.REDUNDANCY);
    assert.match(r.because, /not comparable/);
  });

  test('an unknown split provenance does not block on its own', () => {
    // null is "we have not established it", and redundancy is the one rule where
    // that is not itself disqualifying — unlike licence, nothing is being
    // claimed on a rights-holder's behalf.
    assert.equal(rankability({ ...clean, publisherDefinedSplit: null }).rankable, RANKABLE.YES);
  });
});

describe('the hand-set flags are checked, not trusted', () => {
  const corpora = [
    { ...clean, id: 'ok' },
    { ...clean, id: 'crk-62-sample', minimumDetectableEffect: null },
    { ...clean, id: 'crk-master', licenceEstablished: false },
    { ...clean, id: 'flagged-but-clean' },
  ];
  const flagged = new Set(['crk-62-sample', 'crk-master', 'flagged-but-clean']);

  test('it reports what the rules catch', () => {
    const a = auditAgainstFlags(corpora, flagged);
    assert.deepEqual(a.caught.map((c) => c.id).sort(), ['crk-62-sample', 'crk-master']);
  });

  test('a flag the rules do NOT catch is reported, not adopted', () => {
    // Either the rules are too loose or the flag was wrong. Only a person can
    // tell which, and silently keeping the flag would preserve the
    // hand-maintained list this is meant to replace.
    const a = auditAgainstFlags(corpora, flagged);
    assert.deepEqual(a.missed.map((c) => c.id), ['flagged-but-clean']);
  });

  test('a corpus the rules block that nobody had flagged is reported too', () => {
    const a = auditAgainstFlags(corpora, new Set(['crk-master']));
    assert.deepEqual(a.newlyBlocked.map((c) => c.id), ['crk-62-sample']);
  });

  test('every verdict carries its checks and a version', () => {
    const a = auditAgainstFlags(corpora, flagged);
    for (const { verdict } of [...a.caught, ...a.missed, ...a.newlyBlocked]) {
      assert.ok(verdict.checks.length);
      assert.ok(verdict.derivationVersion);
      assert.ok(verdict.because.length > 20);
    }
  });
});
