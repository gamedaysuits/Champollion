/**
 * seamFacts — the homepage seam's ONLY source of displayed numbers.
 *
 * Founder standard (NOTHING HARDCODED): every figure the scroll story renders
 * is a BUILD-TIME read of a machine SSOT, validated fail-loud here so a stale
 * or malformed build product breaks the build instead of shipping a wrong
 * number. Ledger rows in cli/website/CLAIMS.md map each figure to its source;
 * cli/scripts/check-prose-counts-parity.mjs guards drift pre-push.
 *
 * Sources:
 *   • src/data/graph-poster.json  .stats — emitted by
 *     plugins/shared-data/generateGraphJson.js from the card/coverage SSOTs
 *     (livingTotal, coverage tiers, the coverage-gap speaker sum).
 *   • src/data/seam-hubs.json — emitted by cli/scripts/build-seam-hubs.mjs
 *     from shared/catalogue/method-coverage.json (cited provider claims).
 *
 * Method docs (the captions' asterisks link to these):
 *   • /docs/network/context/coverage-counting     — how the covered tiers are counted
 *   • /docs/network/context/coverage-gap-estimate — the "more than a billion" floor
 */
// Import attributes: required by node ESM (the guard tests run this module
// under `node --test`), supported by webpack ≥5.9x (the site build).
import poster from '../data/graph-poster.json' with {type: 'json'};
import hubData from '../data/seam-hubs.json' with {type: 'json'};

/**
 * @typedef {Object} SeamHub
 * @property {string} key
 * @property {string} label
 * @property {number} count       claimed coverage (provider's own list)
 * @property {'service'|'open'} tier
 * @property {boolean} anyToAny
 * @property {string} source_url
 * @property {string} asOf
 * @property {string} [releaseDate]  ISO date, cited in the coverage SSOT
 * @property {{count: number, note: string|null, source_url: string}} [deployable]
 */

const fail = (msg) => {
  throw new Error(`[seamFacts] ${msg} — regenerate the build products (generateGraphJson / build-seam-hubs)`);
};

const stats = poster && poster.stats;
if (!stats || !stats.coverage || !stats.coverageGap) fail('graph-poster.json stats missing');

const num = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(`${name} is not a positive number (${v})`);
  return v;
};

/** Living languages in the index (poster stats.livingTotal). */
export const LIVING_TOTAL = num(stats.livingTotal, 'livingTotal');
/** Living languages with ANY dedicated MT engine (service OR open model). */
export const COVERED_LIVING = num(stats.coverage.dedicatedLiving, 'coverage.dedicatedLiving');
/** Living languages covered by a deployed consumer/API service. */
export const SERVICE_LIVING = num(stats.coverage.serviceLiving, 'coverage.serviceLiving');
/** Living languages with no dedicated MT engine at all. */
export const UNCOVERED_LIVING = num(stats.coverage.uncoveredLiving, 'coverage.uncoveredLiving');
/** Raw cited-speaker-estimate sum over uncovered living languages (blends L1/L2 — see method doc). */
export const GAP_SPEAKERS_RAW = num(stats.coverageGap.uncoveredSpeakerSumRaw, 'coverageGap.uncoveredSpeakerSumRaw');

// Sanity rails: the story's floor phrasings must stay true of the data, or
// the build fails and the copy gets revisited (never a silently-wrong floor).
if (LIVING_TOTAL <= 7000) fail(`livingTotal ${LIVING_TOTAL} no longer supports "more than 7,000"`);
if (COVERED_LIVING >= LIVING_TOTAL) fail('coveredLiving >= livingTotal');
if (SERVICE_LIVING > COVERED_LIVING) fail('serviceLiving > coveredLiving');
if (GAP_SPEAKERS_RAW < 1_000_000_000) fail(`coverage-gap sum ${GAP_SPEAKERS_RAW} no longer supports the "more than a billion" floor`);

/** The published conservative floor for the coverage gap (see method doc). */
export const GAP_FLOOR_LABEL = 'more than a billion';
/** The living-count floor phrasing the data is checked against above. */
export const LIVING_FLOOR_LABEL = 'more than 7,000';

/** @type {SeamHub[]} timeline-ordered, cited-only omnimodel hubs. */
export const HUBS = hubData.hubs;
if (!Array.isArray(HUBS) || HUBS.length < 6) fail('seam-hubs.json has too few hubs');
for (const h of HUBS) {
  if (!h.source_url || !h.asOf) fail(`hub ${h.key} is uncited`);
  num(h.count, `hub ${h.key} count`);
}

/** Coverage-list freshness stamp (method-coverage.json asOf). */
export const HUBS_AS_OF = hubData.asOf || fail('seam-hubs.json missing asOf');

/** The largest single coverage CLAIM on the hub timeline (the provider's own
 *  published list — a claim about breadth, never about quality). */
export const TOP_HUB = HUBS.reduce((m, h) => (h.count > m.count ? h : m));
/**
 * The `omni` caption's floor phrasing, checked against that claim the same way
 * the living/gap floors are checked — so the copy can never outrun the data.
 * R7 (founder): the beat must say the industry CLAIMS this breadth, not that
 * it delivers it; the shortfall in the provider's own numbers is rendered
 * beside the caption by HubColumn.
 */
export const HUB_CLAIM_FLOOR_LABEL = 'a thousand languages';
if (TOP_HUB.count < 1000) {
  fail(`top hub claim ${TOP_HUB.count} (${TOP_HUB.label}) no longer supports "${HUB_CLAIM_FLOOR_LABEL}"`);
}
if (!TOP_HUB.deployable || TOP_HUB.deployable.count >= TOP_HUB.count / 2) {
  fail(
    `${TOP_HUB.label} no longer self-reports a majority shortfall — the notWorking caption ` +
      '("most of that coverage is low quality at the margins") must be revisited against the source',
  );
}

/** House number formatting (en-US grouping — matches the rest of the site). */
export const fmt = (n) => n.toLocaleString('en-US');
