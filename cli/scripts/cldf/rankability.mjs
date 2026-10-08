/**
 * rankability.mjs — may a corpus decide a ranking, and if not, why.
 *
 * WHAT THIS REPLACES
 *   Four crk datasets carry a hand-set `quarantined` flag so they can never
 *   rank, enforced beneath every client by migration 022's trigger. The flags
 *   are real protection and they are also a hand-maintained list: nothing
 *   recomputes them, nothing checks them, and a fifth dataset with the same
 *   problem would simply not be caught.
 *
 *   So the rules are stated and recomputed every build. The existing flags are
 *   NOT assumed correct — the build reports which the rules catch and which they
 *   do not, and a miss is a finding to look at rather than a list to preserve.
 *
 * THE ORDER IS THE POINT
 *   Founder correction, 2026-08-06: those sets were flagged for LICENCE reasons,
 *   not merely for being improper subsets. So licence is asked first, and it is
 *   asked as a question about permission rather than about quality:
 *
 *     1. LICENCE     may we use it this way at all, and do we actually know?
 *     2. POWER       can it resolve a difference of the size being claimed?
 *     3. REDUNDANCY  is it a slice of something else already indexed, or a split
 *                    we made up rather than one the publisher defined?
 *
 *   A corpus fails at the first rule it fails. Reporting "underpowered" about a
 *   corpus we are not licensed to rank at all would answer a question nobody
 *   should have reached.
 *
 * NOT KNOWING IS NOT PERMISSION
 *   An unestablished licence blocks exactly as a restrictive one does. That is
 *   the standing rule in this repo — "we do not guess on a rights-holder's
 *   behalf" — and it is the rule that makes the whole licence lane meaningful.
 */

/** Bumped when the RULES change, not when a corpus does. */
export const DERIVATION_VERSION = 'v1';

export const RANKABLE = Object.freeze({
  YES: 'rankable',
  NO: 'not-rankable',
});

export const BLOCKED_BY = Object.freeze({
  LICENCE: 'licence',
  POWER: 'power',
  REDUNDANCY: 'redundancy',
});

/**
 * Decide whether a corpus may settle a ranking.
 *
 * @param {object} corpus
 * @param {string|null} corpus.licence            SPDX or LicenseRef
 * @param {boolean|null} corpus.licenceEstablished  false when terms are unknown
 * @param {boolean} [corpus.rankingPermitted]     an explicit rights-holder refusal
 * @param {number|null} corpus.minimumDetectableEffect  from power.py, may be null
 * @param {string|null} corpus.mdeMetric
 * @param {string|null} corpus.mdeParameterSource 'measured' | 'prior'
 * @param {string|null} corpus.subsetOf           another indexed corpus id
 * @param {boolean|null} corpus.publisherDefinedSplit
 * @param {object} [opts]
 * @param {number} [opts.claimedMargin]  the difference a ranking asserts it can see
 * @returns {{rankable: string, blockedBy: string|null, because: string,
 *            checks: object[], derivationVersion: string}}
 */
export function rankability(corpus, opts = {}) {
  const {
    licence = null,
    licenceEstablished = null,
    rankingPermitted = true,
    minimumDetectableEffect = null,
    mdeMetric = null,
    mdeParameterSource = null,
    subsetOf = null,
    publisherDefinedSplit = null,
  } = corpus ?? {};
  const { claimedMargin = 1.0 } = opts;

  const checks = [];
  const fail = (blockedBy, because) => ({
    rankable: RANKABLE.NO,
    blockedBy,
    because,
    checks,
    derivationVersion: DERIVATION_VERSION,
  });

  // ── 1. Licence ───────────────────────────────────────────────────────────
  if (licenceEstablished === false || !licence) {
    checks.push({ check: BLOCKED_BY.LICENCE, passed: false });
    return fail(
      BLOCKED_BY.LICENCE,
      'the terms could not be established, and not knowing is not permission — '
      + "we do not guess on a rights-holder's behalf",
    );
  }
  if (!rankingPermitted) {
    checks.push({ check: BLOCKED_BY.LICENCE, passed: false });
    return fail(BLOCKED_BY.LICENCE, `${licence} does not permit this use`);
  }
  checks.push({ check: BLOCKED_BY.LICENCE, passed: true, licence });

  // ── 2. Power ─────────────────────────────────────────────────────────────
  if (minimumDetectableEffect === null) {
    checks.push({ check: BLOCKED_BY.POWER, passed: false, mde: null });
    return fail(
      BLOCKED_BY.POWER,
      'no effect size reaches the target power on this corpus, so it cannot settle a '
      + 'comparison on its own',
    );
  }
  if (minimumDetectableEffect > claimedMargin) {
    checks.push({ check: BLOCKED_BY.POWER, passed: false, mde: minimumDetectableEffect });
    return fail(
      BLOCKED_BY.POWER,
      `it can resolve a difference of ${minimumDetectableEffect}${mdeMetric ? ` ${mdeMetric}` : ''} `
      + `at best, and the ranking claims to see ${claimedMargin}`
      + (mdeParameterSource === 'prior'
        ? ' — computed from borrowed parameters, so the true figure may be worse'
        : ''),
    );
  }
  checks.push({
    check: BLOCKED_BY.POWER,
    passed: true,
    mde: minimumDetectableEffect,
    parameterSource: mdeParameterSource,
  });

  // ── 3. Redundancy ────────────────────────────────────────────────────────
  if (subsetOf) {
    checks.push({ check: BLOCKED_BY.REDUNDANCY, passed: false, subsetOf });
    return fail(
      BLOCKED_BY.REDUNDANCY,
      `it is a subset of ${subsetOf}, which is already indexed — ranking both counts one `
      + 'body of evidence twice, and the easier slice usually wins',
    );
  }
  if (publisherDefinedSplit === false) {
    checks.push({ check: BLOCKED_BY.REDUNDANCY, passed: false, publisherDefinedSplit: false });
    return fail(
      BLOCKED_BY.REDUNDANCY,
      'the split is ours, not the publisher\'s, so a score on it is not comparable to '
      + 'anyone else\'s score on the same-named corpus',
    );
  }
  checks.push({ check: BLOCKED_BY.REDUNDANCY, passed: true });

  return {
    rankable: RANKABLE.YES,
    blockedBy: null,
    because: `licensed for the use, resolves ${minimumDetectableEffect}`
      + `${mdeMetric ? ` ${mdeMetric}` : ''} against a claimed margin of ${claimedMargin}, `
      + 'and is not a slice of something else indexed',
    checks,
    derivationVersion: DERIVATION_VERSION,
  };
}

/**
 * Check the rules against a set of hand-set flags.
 *
 * Reports agreement in BOTH directions rather than reconciling them: a flag the
 * rules do not catch may mean the rules are too loose OR that the flag was
 * wrong, and only a person can tell which. Silently adopting either answer is
 * how a hand-maintained list survives a rebuild that was meant to replace it.
 *
 * @param {Array<{id: string}>} corpora        each with the rankability inputs
 * @param {Set<string>} flagged                ids currently flagged by hand
 * @param {object} [opts]
 */
export function auditAgainstFlags(corpora, flagged, opts = {}) {
  const caught = [];
  const missed = [];
  const newlyBlocked = [];
  for (const c of corpora) {
    const r = rankability(c, opts);
    const blocked = r.rankable === RANKABLE.NO;
    if (flagged.has(c.id)) (blocked ? caught : missed).push({ id: c.id, verdict: r });
    else if (blocked) newlyBlocked.push({ id: c.id, verdict: r });
  }
  return { caught, missed, newlyBlocked };
}
