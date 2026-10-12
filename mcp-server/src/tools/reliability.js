/**
 * Metric-reliability tool — which automatic metric can you TRUST for a
 * target language?
 *
 * Backed by shared/catalogue/metric-reliability.json: champollion-derived
 * correlations between automatic MT metrics (BLEU, spBLEU, chrF, chrF++,
 * COMET, MetricX) and the WMT Metrics-task human judgments (DA/MQM/ESA,
 * wmt19–wmt25), rolled up per TARGET-language family. Methodology spec:
 * https://champollion.dev/docs/network/specifications/metric-reliability
 *
 * Honesty contract (mirrors mt_eval_harness.recommend tier 4):
 *   - A language no WMT campaign ever judged returns an explicit
 *     "unmeasured" answer listing what IS covered — never borrowed numbers.
 *   - Family-level evidence that doesn't include the exact language carries
 *     a transfer caveat: within-family transfer is an assumption.
 *   - The index rides a non-commercial hold (upstream data license
 *     unstated, not yet reviewed) — every answer says so, in user-facing
 *     words (no internal review wording reaches the user).
 *
 * The index is the monorepo's shared/catalogue/metric-reliability.json, and
 * the champollion npm package ships a synced copy (cli/shared/catalogue/ via
 * `npm run sync:shared`) — so an npm install of this server reads it through
 * the `champollion` dependency. Only when neither is reachable does the tool
 * degrade to an explicit "not available" answer.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { getLanguage } from './language-card.js';
import { count } from './plural.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

/** Candidate paths to the reliability index; first hit wins. Monorepo first,
 *  then the copy inside the installed champollion package (resolved through
 *  Node's own resolver — never a guessed node_modules path). */
function indexPaths() {
  const paths = [
    resolve(__dirname, '../../../shared/catalogue/metric-reliability.json'),
    resolve(__dirname, '../../shared/catalogue/metric-reliability.json'),
  ];
  try {
    paths.push(resolve(dirname(require.resolve('champollion')), 'shared', 'catalogue', 'metric-reliability.json'));
  } catch { /* no installed champollion package */ }
  return paths;
}
const INDEX_PATHS = indexPaths();

let _cache;

/** Load (and cache) the reliability index; null when not available. */
export async function loadReliabilityIndex() {
  if (_cache !== undefined) return _cache;
  for (const p of INDEX_PATHS) {
    try {
      _cache = JSON.parse(await readFile(p, 'utf8'));
      return _cache;
    } catch {
      // try the next candidate
    }
  }
  _cache = null;
  return _cache;
}

/** Test hook: override / clear the cached index. */
export function _setReliabilityIndexForTests(value) {
  _cache = value;
}

/**
 * Resolve a user query (ISO code, WMT code, or family name) against the
 * index. Returns { kind: 'language'|'family'|'none', code?, info?, family? }.
 */
export function resolveReliabilityQuery(index, query) {
  const q = String(query || '').trim();
  const languages = index.languages || {};
  for (const [key, entry] of Object.entries(languages)) {
    if (q.toLowerCase() === key.toLowerCase()
      || q.toLowerCase() === String((entry || {}).iso639_3 || '').toLowerCase()) {
      return { kind: 'language', code: key, info: entry, family: (entry || {}).family || 'Unclassified' };
    }
  }
  for (const family of Object.keys(index.families || {})) {
    if (q.toLowerCase() === family.toLowerCase()) {
      return { kind: 'family', family };
    }
  }
  return { kind: 'none' };
}

/**
 * Every cited family claim on a language's card, through get_language's own
 * card resolution (the CLI's resolver + the adapter) — never a bare read. A
 * disagreement between sources stays a disagreement: nothing is elected.
 *
 * @param {string} code
 * @param {object} [deps]  passed to getLanguage (index, champollion)
 * @returns {Promise<{claims: {value: string, source: string|null}[], problem: string|null}>}
 */
export async function cardFamilyClaims(code, deps = {}) {
  const r = await getLanguage(code, deps);
  if (r.status !== 'ok') {
    return { claims: [], problem: `language card not resolved (${r.status}): ${r.note || code}` };
  }
  const claims = (r.summary?.family || [])
    .filter((c) => typeof c?.value === 'string' && c.value)
    .map((c) => ({ value: c.value, source: c.source ?? null }));
  return claims.length
    ? { claims, problem: null }
    : { claims: [], problem: `the language card for '${code}' records no family` };
}

/** 'Uralic (glottolog-v5.3, wals-v2020.5)' — every claim, grouped by value. */
function claimsText(claims) {
  const byValue = new Map();
  for (const c of claims) {
    if (!byValue.has(c.value)) byValue.set(c.value, []);
    byValue.get(c.value).push(c.source || 'source not recorded');
  }
  return [...byValue].map(([v, srcs]) => `${v} (${srcs.join(', ')})`).join('; ');
}

/**
 * Build the reliability answer for a target language or family query.
 *
 * A language WMT never judged is looked up by FAMILY when `familyClaims` is
 * given (the server passes cardFamilyClaims): its card's family claims are
 * matched exactly against the index's family roll-ups. One evidenced family
 * → that roll-up with the claims behind it and the transfer caveat; sources
 * naming two different evidenced families → no pick, unmeasured. (Before,
 * Northern Sami was told no evidence covered it right above a list naming
 * Uralic — its own family — as evidenced: the family was never looked up.)
 * Twin of mt_eval_harness.recommend.metric_reliability_evidence.
 *
 * @param {string} target - ISO 639 code, WMT pair code, or family name.
 * @param {object|null} [index] - Fixture for tests; defaults to the tracked index.
 * @param {object} [opts]
 * @param {Function} [opts.familyClaims] - async code → {claims, problem}
 * @returns {Promise<object>} structured answer (see formatReliability).
 */
export async function metricReliability(target, index = undefined, { familyClaims = null } = {}) {
  const idx = index !== undefined ? index : await loadReliabilityIndex();
  if (!idx) {
    return {
      status: 'index-unavailable',
      note: 'metric-reliability.json is not reachable from this install (looked '
        + 'in the monorepo and in the champollion package) — reinstall the server '
        + 'so its champollion dependency is intact. '
        + 'Methodology + data: '
        + 'https://champollion.dev/docs/network/specifications/metric-reliability',
    };
  }
  let hit = resolveReliabilityQuery(idx, target);
  let familyBasis = null;
  if (hit.kind === 'none') {
    const unmeasured = (why) => ({
      status: 'unmeasured',
      target,
      note: `No WMT human-judgment meta-evaluation covers '${target}'${why} — `
        + 'metric choice for this language is UNMEASURED. Treat every metric '
        + 'as unvalidated there and validate locally where possible.',
      measured_families: Object.keys(idx.families || {}).sort(),
      measured_languages: Object.keys(idx.languages || {}).sort(),
    });
    if (typeof familyClaims !== 'function') return unmeasured('');
    const { claims = [], problem = null } = (await familyClaims(target)) || {};
    if (problem) return unmeasured(` directly, and its family could not be checked (${problem})`);
    const evidenced = [...new Set(claims.map((c) => c.value)
      .filter((v) => Object.hasOwn(idx.families || {}, v)))].sort();
    if (evidenced.length === 0) {
      return unmeasured(` directly or via its family (per its language card: ${claimsText(claims)} `
        + '— no WMT-judged target language in that family)');
    }
    if (evidenced.length > 1) {
      return unmeasured(' directly, and its language card\'s family sources disagree between '
        + `families that each have evidence (${claimsText(claims)}) — Champollion does not `
        + 'pick between sources');
    }
    hit = { kind: 'language-family', family: evidenced[0] };
    familyBasis = {
      via: 'language-card',
      claims,
      matched_sources: claims.filter((c) => c.value === evidenced[0]).map((c) => c.source),
    };
  }
  const family = hit.family;
  const famBlock = (idx.families || {})[family] || {};
  const metrics = [];
  for (const [metricId, levels] of Object.entries(famBlock.metrics || {})) {
    const sysE = levels.sys || {};
    const segE = levels.seg || {};
    metrics.push({
      metric: metricId,
      sys_pearson: sysE.pearson_weighted_mean ?? null,
      sys_pairwise_accuracy: sysE.pairwise_accuracy_weighted_mean ?? null,
      sys_n_pairs: sysE.n_pairs ?? null,
      seg_kendall: segE.kendall_tau_b_weighted_mean ?? null,
      seg_n_pairs: segE.n_pairs ?? null,
    });
  }
  metrics.sort((a, b) =>
    (b.sys_pearson ?? -2) - (a.sys_pearson ?? -2)
    || a.metric.localeCompare(b.metric));
  const exactPairs = hit.kind === 'language'
    ? [...new Set((idx.cells || [])
        .filter((c) => c.tgt === hit.code && c.preferred)
        .map((c) => c.pair))].sort()
    : [];
  return {
    status: 'ok',
    query_kind: hit.kind,
    target,
    target_code: hit.code ?? null,
    target_family: family,
    exact_pairs_measured: exactPairs,
    metrics,
    ...(familyBasis ? { family_basis: familyBasis } : {}),
    family_pairs: famBlock.n_pairs ?? null,
    license_note: (idx.license_lane || {}).commercial_ok === false
      ? 'Non-commercial evidence lane: the upstream WMT human-judgment data '
        + 'states no license, and its use beyond research has not yet been '
        + 'reviewed — cite in research lanes only.'
      : null,
    provenance: idx.provenance ?? null,
  };
}

/** Human-readable rendering of a metricReliability() answer. */
export function formatReliability(r) {
  if (r.status === 'index-unavailable') return r.note;
  if (r.status === 'unmeasured') {
    return [
      r.note,
      '',
      `Families with WMT human-judgment evidence: ${r.measured_families.join(', ')}.`,
      `Directly judged target languages (WMT codes): ${r.measured_languages.join(', ')}.`,
    ].join('\n');
  }
  const fmt = (v) => (v === null || v === undefined
    ? '   — '
    : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`);
  const out = [];
  const basis = r.family_basis;
  const scope = r.query_kind === 'family'
    ? `family '${r.target_family}'`
    : basis
      ? `'${r.target}' (family: ${claimsText(basis.claims.filter((c) => c.value === r.target_family))}, `
        + 'per its language card)'
      : `'${r.target}' (family: ${r.target_family})`;
  out.push(`Metric trust for ${scope} — correlation with WMT human judgment `
    + '(higher = the metric agrees with human raters more; sys = ranking '
    + 'whole systems, seg = scoring individual sentences):');
  if (r.metrics.length === 0) {
    out.push('  (no metric cells for this family — evidence gap)');
  }
  for (const m of r.metrics) {
    const n = m.sys_n_pairs ?? m.seg_n_pairs ?? 0;
    out.push(`  ${m.metric.padEnd(18)} sys-Pearson ${fmt(m.sys_pearson)}   `
      + `seg-Kendall ${fmt(m.seg_kendall)}   (${count(n, 'language pair')})`);
  }
  if (basis && basis.claims.some((c) => c.value !== r.target_family)) {
    out.push(`  ⚠ The card's family sources disagree (${claimsText(basis.claims)}); only `
      + `'${r.target_family}' names a family this index rolls up, so the numbers above rest `
      + 'on that classification alone.');
  }
  if (r.query_kind === 'language' || r.query_kind === 'language-family') {
    out.push(r.exact_pairs_measured.length > 0
      ? `  Directly judged pairs for this language: ${r.exact_pairs_measured.join(', ')}.`
      : '  ⚠ No WMT campaign judged this exact language — the numbers above '
        + 'come from other languages in the same family; within-family '
        + 'transfer is an assumption, not a measurement.');
  }
  out.push('');
  out.push('Methodology (definitions, inclusions/exclusions, reproduction): '
    + 'https://champollion.dev/docs/network/specifications/metric-reliability');
  if (r.license_note) out.push(`⚠ ${r.license_note}`);
  return out.join('\n');
}
