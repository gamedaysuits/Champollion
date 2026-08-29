/**
 * sealed-qualifier.mjs — the PUBLIC QUALIFIER paired to a sealed test set.
 *
 * A sealed (community-controlled secret) test set is precious: every evaluation
 * against it leaks a little signal, and custodian approval is a real,
 * low-frequency act (M-of-N, community-custodian multisig plan M2, docs/governance). So a
 * method must EARN the right to even *propose* a sealed run by first clearing a
 * disjoint, fully public twin — the **qualifier**.
 *
 * The qualifier is:
 *   • PUBLIC-tier (CC-BY / CC0 / share-alike) — admitted through the SAME gate
 *     as any public corpus (gatePublicRegistration, corpus-registration.mjs).
 *     A non-redistributable or unconfirmed license can never be a qualifier.
 *   • DISJOINT from the sealed set (no shared entries) — drawn from the same
 *     distribution so clearing it is meaningful, but sharing no sentences so it
 *     leaks nothing about the sealed content. Author-attested (we never see
 *     either side's content to verify), recorded on the card.
 *   • YEARLY-ROTATED (vYYYY). Each year a fresh qualifier supersedes the last;
 *     the prior year is FROZEN for history (immutable, kept so old results stay
 *     interpretable). A qualifier whose vintage is behind the current year is
 *     STALE — it has been public long enough that contamination/overfitting
 *     risk rises, so we surface a contamination-risk badge.
 *
 * The load-bearing rule is `isEligibleForSealedRun`: below the qualifier
 * threshold (or no qualifier cleared at all) ⇒ NOT eligible to request a sealed
 * run. Pure functions, no I/O — dates/years are injected so the logic is
 * deterministic and testable.
 *
 * @module sealed-qualifier
 */

import { gatePublicRegistration } from './corpus-registration.mjs';

/**
 * Default qualifier clearance threshold. Expressed on the public leaderboard's
 * composite 0–100 scale; communities/contests may override per qualifier. This
 * is a floor placeholder, not a claim about any specific pair's difficulty —
 * callers should set a calibrated threshold for real qualifiers.
 */
export const DEFAULT_QUALIFIER_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Versioning — vYYYY yearly rotation.
// ---------------------------------------------------------------------------

/** `2026` → `'v2026'`. */
export function qualifierVersionTag(year) {
  const y = parseInt(year, 10);
  if (!Number.isInteger(y) || y < 2000 || y > 9999) {
    throw new Error(`Qualifier year must be a 4-digit year (got ${year}).`);
  }
  return `v${y}`;
}

/** `'v2026'` (or an id ending in `-v2026`) → `2026`, else null. */
export function parseQualifierYear(input) {
  const m = String(input || '').match(/v(\d{4})(?:$|[^0-9])/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Derive a qualifier card id paired to a sealed set.
 * Shape: eval-<src>-<tgt>-<slug>-qualifier-vYYYY (public-tier, runnable).
 *
 * @param {{source:string, target:string, slug?:string, year:number}} o
 * @returns {string}
 */
export function buildQualifierId({ source, target, slug, year }) {
  const tag = slug && String(slug).length ? slug : 'sealed';
  return `eval-${source}-${target}-${tag}-qualifier-${qualifierVersionTag(year)}`;
}

// ---------------------------------------------------------------------------
// The license gate — a qualifier MUST be public-eligible (it is itself public).
// Reuses the one public-registration gate; no parallel rule.
// ---------------------------------------------------------------------------

/**
 * May this license back a PUBLIC qualifier? (Same admission as any public
 * corpus.) NC / ND / unconfirmed licenses are blocked.
 *
 * @param {object} licenseOption a resolveLicense() result
 * @returns {{allowed:boolean, tier:string, reason:string}}
 */
export function gateQualifier(licenseOption) {
  const gate = gatePublicRegistration(licenseOption);
  if (gate.allowed) return gate;
  return {
    allowed: false,
    tier: gate.tier,
    reason: `A qualifier is public by definition, so it needs a redistribution-cleared (CC-BY/CC0/share-alike) license. ${gate.reason}`,
  };
}

// ---------------------------------------------------------------------------
// Eligibility — the gate every sealed-run proposal passes BEFORE custodians are
// ever bothered. Fail-safe: anything unconfirmed ⇒ NOT eligible.
// ---------------------------------------------------------------------------

/**
 * Is a method eligible to PROPOSE a run against the sealed set?
 *
 * Requires a paired qualifier, a recorded score on it, and that score meeting
 * the threshold. A stale qualifier still gates (you must clear the *current*
 * qualifier), so we also report staleness for the caller to surface.
 *
 * @param {object} o
 * @param {string|null} [o.qualifierId]   the paired public qualifier (required)
 * @param {number|null} [o.score]         the method's score on that qualifier
 * @param {number} [o.threshold]          clearance threshold (default DEFAULT_QUALIFIER_THRESHOLD)
 * @param {number|null} [o.qualifierYear] vintage year of the qualifier the score was earned on
 * @param {number|null} [o.currentYear]   the active qualifier year (for staleness)
 * @returns {{eligible:boolean, reason:string, threshold:number, score:(number|null),
 *            stale:boolean, badge:(object|null)}}
 */
export function isEligibleForSealedRun({
  qualifierId = null, score = null, threshold = DEFAULT_QUALIFIER_THRESHOLD,
  qualifierYear = null, currentYear = null,
} = {}) {
  const thr = Number(threshold);
  const badge = (qualifierYear != null && currentYear != null)
    ? qualifierContaminationBadge({ qualifierYear, currentYear })
    : null;
  const stale = !!(badge && badge.stale);

  if (!qualifierId) {
    return { eligible: false, reason: 'No public qualifier is paired with this sealed set — a sealed run cannot be proposed without one.', threshold: thr, score: null, stale, badge };
  }
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return { eligible: false, reason: `Method has not cleared the public qualifier (${qualifierId}) yet — run it on the qualifier first.`, threshold: thr, score: null, stale, badge };
  }
  const s = Number(score);
  if (s < thr) {
    return { eligible: false, reason: `Method scored ${s} on the public qualifier (${qualifierId}); the sealed-run threshold is ${thr}. Not eligible to propose a sealed run.`, threshold: thr, score: s, stale, badge };
  }
  return { eligible: true, reason: `Method cleared the public qualifier (${qualifierId}) at ${s} ≥ ${thr} — eligible to PROPOSE a sealed run (still requires M-of-N custodian approval).`, threshold: thr, score: s, stale, badge };
}

// ---------------------------------------------------------------------------
// Staleness → contamination-risk badge.
// ---------------------------------------------------------------------------

/**
 * Contamination-risk badge for a qualifier given its vintage vs the active year.
 * A current-year qualifier is fresh (no badge). Each year behind raises risk:
 * 1 year ⇒ MEDIUM, 2+ ⇒ HIGH — it has been public long enough that training-set
 * contamination and overfitting to the public twin become real.
 *
 * @param {{qualifierYear:number, currentYear:number}} o
 * @returns {{stale:boolean, ageYears:number, risk:('NONE'|'LOW'|'MEDIUM'|'HIGH'),
 *            badge:(string|null), reason:string}}
 */
export function qualifierContaminationBadge({ qualifierYear, currentYear }) {
  const qy = parseInt(qualifierYear, 10);
  const cy = parseInt(currentYear, 10);
  if (!Number.isInteger(qy) || !Number.isInteger(cy)) {
    throw new Error('qualifierContaminationBadge needs integer years.');
  }
  const age = cy - qy;
  if (age <= 0) {
    return { stale: false, ageYears: Math.max(0, age), risk: 'NONE', badge: null, reason: `Qualifier v${qy} is current — fresh.` };
  }
  const risk = age >= 2 ? 'HIGH' : 'MEDIUM';
  return {
    stale: true,
    ageYears: age,
    risk,
    badge: `⚠ STALE QUALIFIER (v${qy}, ${age} yr${age === 1 ? '' : 's'} old)`,
    reason: `Qualifier v${qy} is ${age} year${age === 1 ? '' : 's'} behind the active v${cy}; public exposure raises contamination/overfitting risk (${risk}). Rotate to v${cy}.`,
  };
}

// ---------------------------------------------------------------------------
// Rotation — supersede with a fresh year; FREEZE the prior for history.
// ---------------------------------------------------------------------------

/**
 * Rotate a qualifier to a new year. The previously-active qualifier is FROZEN
 * (marked immutable, retained for history) and the new year becomes active.
 *
 * @param {object} o
 * @param {{source:string, target:string, slug?:string}} o.pair
 * @param {number} o.newYear
 * @param {object|null} [o.current]   the currently-active qualifier descriptor (or null for first-ever)
 * @param {object[]} [o.frozen]       already-frozen prior qualifiers
 * @param {number} [o.threshold]
 * @returns {{active:object, frozen:object[]}}
 */
export function rotateQualifier({ pair, newYear, current = null, frozen = [], threshold = DEFAULT_QUALIFIER_THRESHOLD }) {
  const ny = parseInt(newYear, 10);
  if (current) {
    const currentYear = current.year ?? parseQualifierYear(current.id);
    if (currentYear != null && ny <= currentYear) {
      throw new Error(`Cannot rotate to v${ny}: it is not newer than the active qualifier v${currentYear}.`);
    }
  }
  const nextFrozen = [...frozen];
  if (current) {
    nextFrozen.push({ ...current, status: 'frozen', frozen: true });
  }
  const active = {
    id: buildQualifierId({ source: pair.source, target: pair.target, slug: pair.slug, year: ny }),
    year: ny,
    version: qualifierVersionTag(ny),
    tier: 'public',
    status: 'active',
    frozen: false,
    threshold: Number(threshold),
  };
  return { active, frozen: nextFrozen };
}
