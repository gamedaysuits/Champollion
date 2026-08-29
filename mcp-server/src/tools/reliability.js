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
 *     unstated, founder review pending) — every answer says so.
 *
 * The index is monorepo-tracked (deliberately NOT npm-bundled); outside a
 * monorepo checkout the tool degrades to an explicit "not available" answer.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Candidate paths to the reliability index; first hit wins. */
const INDEX_PATHS = [
  resolve(__dirname, '../../../shared/catalogue/metric-reliability.json'),
  resolve(__dirname, '../../shared/catalogue/metric-reliability.json'),
];

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
 * Build the reliability answer for a target language or family query.
 *
 * @param {string} target - ISO 639 code, WMT pair code, or family name.
 * @param {object|null} [index] - Fixture for tests; defaults to the tracked index.
 * @returns {Promise<object>} structured answer (see formatReliability).
 */
export async function metricReliability(target, index = undefined) {
  const idx = index !== undefined ? index : await loadReliabilityIndex();
  if (!idx) {
    return {
      status: 'index-unavailable',
      note: 'metric-reliability.json is monorepo-tracked and not reachable '
        + 'from this install — no metric-trust evidence available here. '
        + 'Methodology + data: '
        + 'https://champollion.dev/docs/network/specifications/metric-reliability',
    };
  }
  const hit = resolveReliabilityQuery(idx, target);
  if (hit.kind === 'none') {
    return {
      status: 'unmeasured',
      target,
      note: `No WMT human-judgment meta-evaluation covers '${target}' — `
        + 'metric choice for this language is UNMEASURED. Treat every metric '
        + 'as unvalidated there and validate locally where possible.',
      measured_families: Object.keys(idx.families || {}).sort(),
      measured_languages: Object.keys(idx.languages || {}).sort(),
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
    family_pairs: famBlock.n_pairs ?? null,
    license_note: (idx.license_lane || {}).commercial_ok === false
      ? 'Non-commercial evidence lane: the upstream WMT judgment data '
        + 'license is unstated (founder review pending) — cite in research '
        + 'lanes only.'
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
  const scope = r.query_kind === 'family'
    ? `family '${r.target_family}'`
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
      + `seg-Kendall ${fmt(m.seg_kendall)}   (${n} language pair(s))`);
  }
  if (r.query_kind === 'language') {
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
