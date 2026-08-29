/**
 * license-gate.mjs — one place that answers "may we use this source's data in a
 * COMMERCIAL or REDISTRIBUTED context?"
 *
 * Champollion is an open, non-commercial aggregator of public linguistic data:
 * in that lane every source may be used WITH attribution (NonCommercial licenses
 * explicitly permit non-commercial use). This module is NOT about that lane — it
 * exists to protect the two narrow lanes where licenses actually bite:
 *
 *   1. the future paid routing API (commercial use), and
 *   2. any bulk redistribution / re-publication of the dataset.
 *
 * It classifies each `facts.source` into a license tier and exposes booleans the
 * exporter (and, later, the API) use to exclude restricted data BY DEFAULT.
 * Fail-safe: an unknown / unstated / mixed source is treated as RESTRICTED.
 *
 * USE-BASED eligibility (isUsageAllowed): "prize", "API", and "commercial" are
 * ORTHOGONAL attributes, not one bucket. A NonCommercial license gates
 * COMMERCIAL use + redistribution specifically — it does NOT gate non-commercial
 * use. So a non-commercial prize MAY use an NC dataset; a commercial / API use
 * may NOT. Callers pass a use descriptor (use_context + redistribution) and the
 * gate answers from the descriptor + the license tier. (By design.)
 *
 * License data is read from the monorepo register `shared/licenses.json`
 * (generated from the facts DB) with `shared/license-corrections.json` overlaid
 * (Champollion's resolved determinations — see that file + docs/LICENSING.md).
 *
 * @module license-gate
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve the license register from the BUNDLED copy first (cli/shared/, present
// in the published npm package and in the monorepo after `npm run sync:shared`),
// then fall back to the monorepo-root SSOT (../../shared) for an unsynced dev
// checkout. The package layout is champollion/{lib,shared}/, so from lib/ the
// bundled register is one level up; in the monorepo it is two (cli/lib → root).
const BUNDLED_SHARED = join(__dirname, '..', 'shared');
const ROOT_SHARED = join(__dirname, '..', '..', 'shared');
const SHARED = existsSync(join(BUNDLED_SHARED, 'licenses.json')) ? BUNDLED_SHARED : ROOT_SHARED;
const LICENSES_PATH = join(SHARED, 'licenses.json');
const CORRECTIONS_PATH = join(SHARED, 'license-corrections.json');
// The upstream evidence chain — outranks both layers above. See loadLicenseRegister().
const EVIDENCE_PATH = join(SHARED, 'license-evidence.json');

// ---------------------------------------------------------------------------
// TIERS — the result of classifying a license. Only 'permissive' is safe for
// the commercial + redistribution lanes; everything else is restricted there.
// ---------------------------------------------------------------------------
export const TIERS = {
  PERMISSIVE: 'permissive',       // CC-BY / CC0 / MIT / Apache / Unicode / public-domain facts
  NONCOMMERCIAL: 'noncommercial', // CC-BY-NC* — open project only
  SHAREALIKE: 'sharealike',       // CC-BY-SA / GPL / AGPL — copyleft
  NODERIVATIVES: 'noderivatives', // *-ND
  RESTRICTED_NOREDIST: 'restricted-noredist', // e.g. SIL ISO 639-3 terms (use ok, no table redistribution)
  MIXED: 'mixed',                 // per-item licenses (OPUS/PARADISEC/ELAR/HF) — metadata only
  UNSTATED: 'unstated',           // looked, no public license found
  DERIVED: 'derived',             // champollion-derived — inherits its upstream(s)
  UNKNOWN: 'unknown',             // not in the register at all
};

const PERMISSIVE_EXACT = new Set([
  'LICENSEREF-CHAMPOLLION-OWN', 'LICENSEREF-FACTUALDATA', 'LICENSEREF-IANA',
  'LICENSEREF-PUBLICDOMAIN', 'MIT',
]);

/** Is this SPDX string a permissive, freely-redistributable license (attribution at most)? */
export function isPermissiveSpdx(spdx) {
  if (!spdx) return false;
  const s = String(spdx).toUpperCase();
  // Anything restrictive disqualifies, regardless of the CC-BY prefix.
  if (s.includes('-NC') || s.includes('-SA') || s.includes('-ND')) return false;
  if (s.includes('GPL')) return false; // copyleft
  if (/UNCONFIRMED|UNSTATED|NO-PUBLIC|MIXED|SIL-TERMS|PROPRIETARY/.test(s)) return false;
  if (s.startsWith('CC-BY')) return true;   // CC-BY-2.0/3.0/4.0
  if (s.startsWith('CC0')) return true;
  if (s.startsWith('APACHE')) return true;
  if (s.startsWith('UNICODE')) return true;
  if (s.startsWith('BSD')) return true;
  if (s === 'CC') return false;             // bare "CC" = unspecified version → unsafe
  return PERMISSIVE_EXACT.has(s);
}

/**
 * Classify a single license record (the per-source object from the register).
 * Pure — no I/O. Returns { tier, commercialSafe, redistributable, label, ... }.
 */
export function classifyLicense(record) {
  if (!record) {
    return {
      tier: TIERS.UNKNOWN, commercialSafe: false, redistributable: false,
      nonCommercialUseAllowed: false, license_spdx: null,
    };
  }
  const spdx = record.license_spdx || null;
  const s = String(spdx || '').toUpperCase();
  const nc = !!record.non_commercial_only;
  const sa = !!record.requires_sharealike || s.includes('-SA') || s.includes('GPL');
  const redistAllowed = record.allows_redistribution !== 0 && record.allows_redistribution !== false;

  // Tier by the SPDX string first (most specific), then fall back to the raw
  // non_commercial_only flag, then 'unknown'. This keeps an license-unstated
  // source labelled 'unstated' even though we also flag it NC for safety.
  let tier;
  if (s === 'LICENSEREF-CHAMPOLLION-DERIVED') tier = TIERS.DERIVED;
  else if (s.includes('-NC')) tier = TIERS.NONCOMMERCIAL;
  else if (s.includes('-ND')) tier = TIERS.NODERIVATIVES;
  else if (sa) tier = TIERS.SHAREALIKE;
  else if (s.includes('SIL-TERMS')) tier = TIERS.RESTRICTED_NOREDIST;
  // Two founder rulings, 2026-08-01. Both mean the same thing mechanically —
  // we may STATE what we derived, we may not REDISTRIBUTE the source — which is
  // exactly RESTRICTED_NOREDIST. They are named separately because the
  // reasoning differs and a reader deserves to see which applies.
  //
  //   ARCHIVE-CATALOGUE-COUNTS — a count of items held by a public archive
  //     catalogue (OLAC, AILLA, PARADISEC, Kaipuleohone) is a statable fact.
  //     We store "N documented items exist here", never a document.
  //   CITATION-ONLY — a fact may be stated with its source cited, even when the
  //     source is a copyrighted book we hold no licence to. No text from the
  //     work is reproduced. Replaced two pseudo-licences that had asserted
  //     allows_redistribution = 1 over copyrighted works.
  //
  // Before these rulings both fell through to UNKNOWN, where the audit kept
  // reporting them as awaiting a determination that had already been made.
  else if (s.includes('ARCHIVE-CATALOGUE-COUNTS') || s.includes('CITATION-ONLY')) {
    tier = TIERS.RESTRICTED_NOREDIST;
  }
  // NOTE: PER-DATASET / PER-WORDNET are deliberately NOT mapped here.
  //
  // They were briefly folded into MIXED (commit 82b7ec7c0) so the audit would
  // stop calling them "unlicensed". That was papering over the hole. An
  // umbrella id saying "terms are per-dataset" is not a licence — it is a
  // POINTER to 143 member datasets, 142 of which already have their own
  // register entry with a real SPDX id. Labelling the pointer MIXED made the
  // report tidy while leaving 1,293 card-citations of NC / ND / GPL /
  // UNCONFIRMED members stamped with one permissive-looking umbrella.
  //
  // They now fall through to UNKNOWN — fail-safe, and visibly unresolved —
  // and resolveUmbrella() below expands them to the members that actually
  // carry the terms. See cli/scripts/audit-license-gate.mjs.
  else if (s.includes('MIXED')) tier = TIERS.MIXED;
  else if (/UNCONFIRMED|UNSTATED|NO-PUBLIC/.test(s) || s === 'CC') tier = TIERS.UNSTATED;
  else if (isPermissiveSpdx(spdx)) tier = TIERS.PERMISSIVE;
  else if (nc) tier = TIERS.NONCOMMERCIAL; // backstop: flagged NC without an -NC SPDX
  else tier = TIERS.UNKNOWN;

  const permissive = tier === TIERS.PERMISSIVE;
  return {
    tier,
    license_spdx: spdx,
    license_url: record.license_url || null,
    attribution: record.attribution || null,
    requiresAttribution: !!record.requires_attribution,
    // Only clearly-permissive data is safe to sell or to bulk-redistribute.
    commercialSafe: permissive,
    redistributable: permissive && redistAllowed,
    // May this license be USED in a NON-COMMERCIAL, non-redistributing context
    // (e.g. an academic eval run, a non-commercial prize)? This is the lane an
    // -NC license explicitly permits: NonCommercial / ShareAlike / NoDerivatives
    // / use-but-no-redistribute (SIL) all allow non-commercial *use* even though
    // they are NOT commercial-safe. Mixed / unstated / unknown stay fail-safe
    // restricted (we cannot confirm the terms). See isUsageAllowed().
    nonCommercialUseAllowed: NC_USABLE_TIERS.has(tier),
  };
}

// Tiers whose license PERMITS non-commercial, non-redistributing use. (DERIVED
// is handled separately in isUsageAllowed — its eligibility is the AND over its
// upstreams.) Mixed / unstated / unknown are deliberately excluded: fail-safe.
const NC_USABLE_TIERS = new Set([
  TIERS.PERMISSIVE, TIERS.NONCOMMERCIAL, TIERS.SHAREALIKE,
  TIERS.NODERIVATIVES, TIERS.RESTRICTED_NOREDIST,
]);

// ---------------------------------------------------------------------------
// Register loading (shared/licenses.json + corrections overlay), cached.
// ---------------------------------------------------------------------------
let _register = null;

function readSources(path) {
  if (!existsSync(path)) return {};
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    return j.sources || {};
  } catch {
    return {};
  }
}

/**
 * Load (and cache) the merged license register.
 *
 * THREE LAYERS, weakest to strongest:
 *
 *   1. shared/licenses.json      — the generated base. 212 of its 333 entries
 *                                  were written by populate-licenses.mjs's
 *                                  pattern-matching, which fabricated versions
 *                                  and dropped ND clauses. Frozen under the
 *                                  standing wholesale-regen hold.
 *   2. shared/license-corrections.json — human determinations, each with a
 *                                  recorded `_basis`. These fill gaps the base
 *                                  gets wrong or leaves unstated.
 *   3. shared/license-evidence.json    — what the UPSTREAM ACTUALLY SAYS:
 *                                  Zenodo deposit records, shipped LICENSE
 *                                  files, CLDF metadata. Built by
 *                                  cli/scripts/build-license-evidence.mjs.
 *
 * Evidence outranks a correction ONLY WHEN IT IS MORE RESTRICTIVE.
 *
 * That asymmetry is the whole point. A correction claiming MORE freedom than
 * the upstream granted is wrong and must be overridden — that is how
 * grollemundbantu came to be commercial-safe when its depositor said
 * CC-BY-NC, and how nts lost its NoDerivatives clause. But a correction
 * claiming LESS freedom than the grant allows is not an error at all: it is a
 * policy choice about our own conduct, and we are always free to bind
 * ourselves more tightly than a licence requires.
 *
 * ELCat is the case that forced this rule. Its correction's own `_basis`
 * reads: "cldf-datasets/elcat metadata declares CC-BY-4.0, but kept
 * NonCommercial as a conservative, sovereignty-aware call (endangered-language
 * data)." The upstream licence was already known; NC was chosen deliberately
 * for endangered-language data. A naive "evidence always wins" layer silently
 * repealed a sovereignty decision — which is precisely the kind of quiet
 * loosening this whole audit exists to prevent.
 *
 * Where evidence is silent (96 sources have no identifiable upstream
 * statement), corrections govern: a documented negative finding beats nothing.
 *
 * Evidence only overwrites the licence FACTS (spdx + obligation flags). It
 * never touches attribution, urls or notes, which the register carries and the
 * evidence layer does not.
 */

/**
 * How much a record restricts us. Higher = tighter. Used only to decide which
 * layer wins; never exposed as a licence fact.
 */
function _restrictionScore(rec) {
  if (!rec) return -1;
  const s = String(rec.license_spdx || '').toUpperCase();
  const unresolved = !s || s === 'UNVERIFIED' || s === 'UNCONFIRMED' || /UNSTATED/.test(s);
  return (unresolved ? 16 : 0)
    + (rec.no_derivatives ? 8 : 0)
    + (rec.non_commercial_only ? 4 : 0)
    + (rec.requires_sharealike ? 2 : 0)
    + (rec.allows_redistribution === 0 ? 1 : 0);
}
export function loadLicenseRegister({ reload = false } = {}) {
  if (_register && !reload) return _register;
  const base = readSources(LICENSES_PATH);
  const corrections = readSources(CORRECTIONS_PATH);
  const evidence = readSources(EVIDENCE_PATH);
  const merged = new Map();
  for (const [source, rec] of Object.entries(base)) merged.set(source, rec);
  for (const [source, rec] of Object.entries(corrections)) {
    merged.set(source, { ...(merged.get(source) || {}), ...rec, source });
  }
  for (const [source, rec] of Object.entries(evidence)) {
    const spdx = rec?.resolved?.spdx;
    if (!spdx) continue;   // UNVERIFIED — leave the lower layers in place
    const f = rec.resolved.flags || {};
    const current = merged.get(source) || {};
    const fromEvidence = {
      ...current,
      source,
      license_spdx: spdx,
      // `redistribution: null` means unknown and must not read as permission.
      allows_redistribution: f.redistribution === true ? 1 : 0,
      requires_attribution: f.attribution ? 1 : 0,
      requires_sharealike: f.sharealike ? 1 : 0,
      non_commercial_only: f.nonCommercial ? 1 : 0,
      no_derivatives: f.noDerivatives ? 1 : 0,
      _evidenceBasis: rec.resolved.basis,
      _evidenceConflict: rec.conflict ? true : undefined,
    };

    // Only let evidence LOOSEN nothing. If the standing record already binds us
    // more tightly than the upstream grant does, that is a deliberate choice
    // (see the ELCat note above) and it stands — but we still record what the
    // upstream actually says, so the gap between "what we may do" and "what we
    // choose to do" is visible rather than lost.
    if (_restrictionScore(current) > _restrictionScore(fromEvidence)) {
      merged.set(source, {
        ...current,
        _upstreamSpdx: spdx,
        _upstreamBasis: rec.resolved.basis,
        _moreRestrictiveThanUpstream: true,
      });
      continue;
    }
    merged.set(source, fromEvidence);
  }
  _register = merged;
  return merged;
}

/** Raw license record for a source (corrections win), or null if unknown. */
export function getLicense(source, opts) {
  return loadLicenseRegister(opts).get(source) || null;
}

/** Classification for a source label. */
export function classifySource(source, opts) {
  return classifyLicense(getLicense(source, opts));
}

/** Parse `[derived from X]` upstream labels out of a fact's notes. */
export function parseDerivedFrom(notes) {
  if (!notes) return [];
  const out = [];
  const re = /\[derived from ([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(String(notes))) !== null) {
    for (const part of m[1].split(/[,+]/)) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * May this fact's source be used in the COMMERCIAL lane (the paid API)?
 * For champollion-derived facts, pass `derivedFrom` (parsed from notes) — the
 * result is the AND over every upstream (a derived value is only as free as its
 * least-free input).
 */
export function isCommercialSafe(source, { derivedFrom = null, opts } = {}) {
  const cls = classifySource(source, opts);
  if (cls.tier === TIERS.DERIVED) {
    const ups = derivedFrom && derivedFrom.length ? derivedFrom : null;
    if (!ups) return false; // unknown provenance → conservative
    return ups.every((u) => classifySource(u, opts).commercialSafe);
  }
  return cls.commercialSafe;
}

/** May this fact's source be bulk-REDISTRIBUTED (e.g. a public data bundle)? */
export function isRedistributable(source, { derivedFrom = null, opts } = {}) {
  const cls = classifySource(source, opts);
  if (cls.tier === TIERS.DERIVED) {
    const ups = derivedFrom && derivedFrom.length ? derivedFrom : null;
    if (!ups) return false;
    return ups.every((u) => classifySource(u, opts).redistributable);
  }
  return cls.redistributable;
}

// ---------------------------------------------------------------------------
// Use-based eligibility — "may THIS USE touch this source's data?"
// ---------------------------------------------------------------------------
//
// Project doctrine: "prize", "API", and "commercial" are
// ORTHOGONAL attributes, not one restricted bucket. A NonCommercial license
// (CC-BY-NC / CC-BY-NC-SA) gates COMMERCIAL use + REDISTRIBUTION specifically —
// it does NOT gate non-commercial use. So a non-commercial prize (an
// open-source-solution prize, or a corporation funding a prize for private /
// internal use) MAY use an NC dataset; a commercial / for-profit / API-served
// use may NOT.
//
// Eligibility is therefore computed from a USE descriptor — `use_context`
// ('commercial' | 'non-commercial') and `redistribution` (boolean) — combined
// with the dataset's license tier, instead of a coarse lane name:
//
//   NC dataset  →  ALLOWED  when use_context='non-commercial' AND no redistribution
//               →  BLOCKED  when use_context='commercial' OR redistribution required
//
// Fail-safe throughout: an unknown / unstated / mixed license is treated as
// restricted in EVERY context. EdTeKLA / sovereignty corpora are quarantined a
// layer above this (registry flag + DB trigger) and never rank in ANY lane —
// this use-based nuance applies only to general NC sets.

/** The two recognized use contexts. */
export const USE_CONTEXTS = {
  COMMERCIAL: 'commercial',
  NON_COMMERCIAL: 'non-commercial',
};

/** Does this SPDX string carry a NonCommercial restriction? Pure (no I/O). */
export function isNonCommercialSpdx(spdx) {
  if (!spdx) return false;
  const s = String(spdx).toUpperCase();
  return s.includes('-NC') || s.includes('NONCOMMERCIAL') || s.includes('NON-COMMERCIAL');
}

/**
 * Is a given USE of a source's data allowed?
 *
 * @param {string} source            facts.source label (or champollion-derived)
 * @param {object} [o]
 * @param {('commercial'|'non-commercial')} [o.use_context='non-commercial']
 *        The intended use. Anything other than 'non-commercial' is treated as
 *        'commercial' (the most restrictive reading — fail-safe).
 * @param {boolean} [o.redistribution=false] Does the use REDISTRIBUTE the data
 *        (re-publish / bundle the corpus content)? Only permissive licenses ever
 *        clear redistribution; an NC license never does.
 * @param {string[]|null} [o.derivedFrom] Upstreams for a champollion-derived
 *        source (parsed from notes). A derived value is only as free as its
 *        least-free input under the SAME terms.
 * @returns {{allowed:boolean, reason:string, tier:string, license_spdx:string|null,
 *           use_context:string, redistribution:boolean}}
 */
export function isUsageAllowed(source, {
  use_context = USE_CONTEXTS.NON_COMMERCIAL,
  redistribution = false,
  derivedFrom = null,
  opts,
} = {}) {
  // Normalize: only the exact 'non-commercial' token earns the relaxed lane;
  // any other value (including a typo or undefined) falls back to 'commercial'.
  const ctx = use_context === USE_CONTEXTS.NON_COMMERCIAL
    ? USE_CONTEXTS.NON_COMMERCIAL
    : USE_CONTEXTS.COMMERCIAL;
  const cls = classifySource(source, opts);

  // champollion-derived: AND over every upstream, under the SAME use terms.
  if (cls.tier === TIERS.DERIVED) {
    const ups = derivedFrom && derivedFrom.length ? derivedFrom : null;
    if (!ups) {
      return {
        allowed: false,
        reason: 'champollion-derived value with unknown provenance — fail-safe restricted',
        tier: cls.tier, license_spdx: cls.license_spdx, use_context: ctx, redistribution,
      };
    }
    const allowed = ups.every(
      (u) => isUsageAllowed(u, { use_context: ctx, redistribution, opts }).allowed,
    );
    return {
      allowed,
      reason: allowed
        ? 'derived value cleared (every upstream allows this use)'
        : 'derived value blocked (an upstream restricts this use)',
      tier: cls.tier, license_spdx: cls.license_spdx, use_context: ctx, redistribution,
    };
  }

  let allowed;
  let reason;
  if (redistribution) {
    allowed = cls.redistributable;
    reason = allowed
      ? 'redistribution cleared (permissive, redistribution-allowed)'
      : `redistribution requires a permissive, redistribution-cleared license; '${cls.tier}' does not qualify`;
  } else if (ctx === USE_CONTEXTS.COMMERCIAL) {
    allowed = cls.commercialSafe;
    reason = allowed
      ? 'commercial use cleared (permissive)'
      : `commercial use blocked: '${cls.tier}' license is not commercial-safe`;
  } else {
    // non-commercial, no redistribution — the lane an -NC license permits
    allowed = cls.nonCommercialUseAllowed;
    reason = allowed
      ? 'non-commercial use permitted (no redistribution)'
      : `non-commercial eligibility unconfirmed for '${cls.tier}' license — fail-safe restricted`;
  }
  return {
    allowed, reason, tier: cls.tier, license_spdx: cls.license_spdx,
    use_context: ctx, redistribution,
  };
}

/**
 * UI helper: a short license tag for attribution display.
 * e.g. { label: 'CC-BY-NC · D-PLACE Ethnographic Atlas', tier, url }.
 */
export function licenseTag(source, opts) {
  const rec = getLicense(source, opts);
  const cls = classifyLicense(rec);
  const name = (rec && rec.attribution) ? rec.attribution.split(/[.,(]/)[0].trim() : source;
  const spdx = cls.license_spdx && cls.license_spdx !== 'LicenseRef-Unstated'
    ? cls.license_spdx.replace(/^LicenseRef-/, '')
    : 'license unstated';
  return { label: `${spdx} · ${name}`, tier: cls.tier, license_spdx: cls.license_spdx, url: cls.license_url };
}
