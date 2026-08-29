/**
 * Method recommendation for a language pair — the routing evidence surface.
 *
 * JS port of arena/mt_eval_harness/recommend.py (the spec — keep the two in
 * sync; its test contract lives in arena/tests/test_recommend.py and is
 * mirrored in test/recommend.test.js). `champollion recommend SRC TGT`
 * answers the practical question a translator-integrator actually has:
 * "I need to translate SRC→TGT — what are my options, what does the published
 * evidence say, and what can I actually run right now?" — while refusing to
 * overclaim.
 *
 * Three evidence tiers are consulted, all offline (shared/ artifacts — no
 * network, no credentials):
 *
 *   1. Dispatchable methods — shared/method-registry.json (the cross-runtime
 *      SSOT, via lib/method-manifest.js): every engine/provider with per-
 *      method AVAILABILITY resolved live (is its API key set? is it
 *      harness-only? is its license commercial-ready?). Key resolution reads
 *      the registry's credential_env metadata (key pairs require ALL vars;
 *      config vars like AWS_REGION never count) reconciled with
 *      lib/methods/provider-env.js so the verdict matches exactly what the
 *      method loaders read (canonical name + aliases, process.env AND .env
 *      files) — see resolveAvailability for the precedence.
 *   2. Curated cited results — shared/catalogue/external-results.json
 *      (bundled into the npm package via sync:shared): hand-verified
 *      published datapoints (cited ≠ reproduced), direction-exact.
 *   3. Bulk cited results — shared/catalogue/external-mt-index.json: the
 *      machine-imported best-published-score index (OPUS-MT leaderboard
 *      family), RELATIVE-ONLY lane by construction. NOT bundled into the
 *      npm package (1.6 MB) — available in monorepo checkouts; packaged
 *      installs degrade to an explicit note.
 *
 * HONESTY CONTRACT (the whole point):
 *   - Cited evidence orders methods relative to each other on a memorized
 *     public benchmark — never absolute quality, never a deployment ranking.
 *   - Evidence and dispatchability are DIFFERENT axes: the best-evidenced
 *     model for a pair may not be runnable in Champollion, and may be
 *     NC-licensed (excluded from commercial-lane recommendations). The two
 *     are joined only with explicit caveats.
 *   - No evidence → say exactly that, and point at the runnable corpora so
 *     the user can MEASURE rather than guess.
 *   - Missing artifacts (packaged installs) → each tier degrades to an
 *     explicit "not available" note, never silently.
 *
 * Pure logic over the shared artifacts; loaders take explicit fixtures so
 * tests can inject them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMethodManifest, cliNameFor } from './method-manifest.js';
import { providerEnvNames } from './methods/provider-env.js';
import { getEnvOrFileVar } from './api-key.js';
import { LANE_RELATIVE_ONLY, laneForGrade, normalizeGrade } from './contamination-lane.js';

// ---------------------------------------------------------------------------
// Shared-artifact resolution (mirrors method-manifest.js's loader)
// ---------------------------------------------------------------------------

/**
 * Find shared/catalogue/<filename>: package-bundled copy first
 * (cli/shared/catalogue/, shipped in the npm package), then the
 * monorepo-root SSOT. Returns null when neither exists — callers render an
 * explicit "not available" note, never a silent skip.
 *
 * @param {string} filename
 * @returns {string|null}
 */
function cataloguePath(filename) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '..', 'shared', 'catalogue', filename),
    path.resolve(__dirname, '..', '..', 'shared', 'catalogue', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** @returns {object|null} parsed JSON, or null when the path is null/unreadable */
function loadCatalogueJson(filename) {
  const p = cataloguePath(filename);
  if (p === null) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — dispatchable methods + live availability
// ---------------------------------------------------------------------------

/**
 * Resolve one method-registry entry to a live availability verdict.
 *
 * Returns { status, detail } where status ∈:
 *   ready        — invocable right now (needed env key present, or none needed)
 *   needs-key    — adapter exists; set one of the named env vars
 *   local-setup  — local engine; needs the optional install/extra
 *
 * Readiness is judged on the entry's CREDENTIAL vars only — the registry
 * `env` list also names non-credential config vars (AWS_REGION, *_ENDPOINT)
 * the adapter reads, and those must never make a method read "ready" (a
 * region is not auth). The var list is picked in this order:
 *   1. `credential_env` + `credential_env_all: true` (key-pair auth: EVERY
 *      var required — AWS id + secret, Lara id + secret). Beats PROVIDER_ENV,
 *      whose any-of semantics fit alias lists, not pairs.
 *   2. PROVIDER_ENV (lib/methods/provider-env.js) when the provider is
 *      registered there: exactly the surface the method loaders read
 *      (canonical + aliases, incl. names the registry doesn't carry), any-of.
 *   3. `credential_env` (any-of) — the registry's declared credential subset,
 *      for providers with no PROVIDER_ENV entry (harness-only engines).
 *   4. The raw registry `env` list (every var is a credential).
 *
 * @param {string} name - Canonical registry name (e.g. 'google-translate')
 * @param {object} entry - The method-registry entry
 * @param {object} [opts]
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests;
 *   null/omitted = live resolution via process.env AND .env files
 * @param {string} [opts.cwd] - Project root for .env lookup (live mode)
 * @returns {{status: string, detail: string}}
 */
function resolveAvailability(name, entry, { env = null, cwd = undefined } = {}) {
  const credVars = Array.isArray(entry.credential_env) ? entry.credential_env : null;
  const needAll = entry.credential_env_all === true && credVars !== null;
  const providerNames = providerEnvNames(name);
  const envVars = needAll ? credVars
    : providerNames.length > 0 ? providerNames
      : (credVars ?? entry.env ?? []);
  const extra = entry.optional_extra;
  const extraNote = extra ? ` (requires pip extra '${extra}')` : '';

  if (entry.kind === 'local-model') {
    return {
      status: 'local-setup',
      detail: extra
        ? `local engine — install extra '${extra}'`
        : 'local engine — see homepage for setup',
    };
  }
  if (envVars.length === 0) {
    return { status: 'ready', detail: `no credentials required${extraNote}` };
  }
  const get = env === null ? (n) => getEnvOrFileVar(n, cwd) : (n) => env[n];
  const present = envVars.filter((n) => get(n));
  if (needAll) {
    const missing = envVars.filter((n) => !get(n));
    if (missing.length === 0) {
      return { status: 'ready', detail: `${envVars.join(' + ')} are set${extraNote}` };
    }
    const qualifier = present.length > 0
      ? ` (${present[0]} alone is not enough)`
      : ' (all required)';
    return { status: 'needs-key', detail: `set ${missing.join(' + ')}${qualifier}${extraNote}` };
  }
  if (present.length > 0) {
    return { status: 'ready', detail: `${present[0]} is set${extraNote}` };
  }
  return { status: 'needs-key', detail: `set ${envVars.join(' or ')}${extraNote}` };
}

/**
 * Tier-1 rows: every registry method with availability + lane verdicts.
 *
 * useContext ∈ {'non-commercial', 'commercial'}: the commercial lane is
 * STRICT (mirrors the harness's license lane) — a method whose
 * commercialReady is not true is excluded-with-reason, never silently
 * dropped. Entries whose runtimes exclude 'cli' are flagged harness-only
 * and point at mt-eval (mirrors translate.js's findHarnessOnlyEntry).
 *
 * @param {string} useContext
 * @param {object} [opts]
 * @param {object|null} [opts.manifest] - Fixture manifest for tests
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests
 * @param {string} [opts.cwd]
 * @returns {object[]}
 */
function dispatchableMethods(useContext, { manifest = undefined, env = null, cwd = undefined } = {}) {
  const m = manifest !== undefined ? manifest : loadMethodManifest();
  if (!m || !m.entries) return [];
  const rows = [];
  for (const [name, entry] of Object.entries(m.entries)) {
    const avail = resolveAvailability(name, entry, { env, cwd });
    const runtimes = entry.runtimes || ['harness', 'cli'];
    const harnessOnly = Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli');
    let laneOk = true;
    let laneNote = null;
    if (useContext === 'commercial' && entry.commercialReady !== true) {
      laneOk = false;
      laneNote = `excluded from the commercial lane — license: ${entry.license || 'unknown'}`;
    }
    rows.push({
      method: name,
      cli_name: cliNameFor(name, entry),
      kind: entry.kind ?? null,
      paradigm: entry.paradigm ?? null,
      license: entry.license ?? null,
      commercial_ready: entry.commercialReady === true,
      runtimes,
      harness_only: harnessOnly,
      runtime_note: harnessOnly
        ? `harness-only — no CLI adapter; run it with: mt-eval run --method ${name}`
        : null,
      availability: avail.status,
      availability_detail: avail.detail,
      lane_ok: laneOk,
      lane_note: laneNote,
      cost_note: entry.cost_note ?? null,
    });
  }
  const order = { 'ready': 0, 'needs-key': 1, 'local-setup': 2 };
  rows.sort((a, b) =>
    (a.lane_ok === b.lane_ok ? 0 : a.lane_ok ? -1 : 1)
    || ((order[a.availability] ?? 9) - (order[b.availability] ?? 9))
    || a.method.localeCompare(b.method));
  return rows;
}

// ---------------------------------------------------------------------------
// Tier 2 — curated cited results (direction-exact)
// ---------------------------------------------------------------------------

/**
 * Direction-exact curated datapoints + the cited-methods index.
 *
 * Rows carry per-datapoint provenance; ranking across different
 * (benchmark, metric) buckets is deliberately NOT performed — metric
 * variants are incomparable (metric_variant_flag).
 *
 * @param {string} src - ISO 639-3 source code
 * @param {string} tgt - ISO 639-3 target code
 * @param {object|null} [catalogue] - Fixture for tests; omit to load the
 *   shared artifact
 * @returns {{rows: object[], methodsIndex: Object<string, object>}}
 */
function curatedEvidence(src, tgt, catalogue = undefined) {
  const cat = catalogue !== undefined
    ? catalogue
    : loadCatalogueJson('external-results.json');
  if (!cat || Object.keys(cat).length === 0) return { rows: [], methodsIndex: {} };
  const methodsIndex = {};
  for (const m of cat.methods || []) {
    if (m && m.id != null) methodsIndex[m.id] = m;
  }
  const rows = [];
  for (const r of cat.results || []) {
    const pair = r.pair || {};
    if (pair.source !== src || pair.target !== tgt) continue;
    const grade = normalizeGrade((r.signal_strength || {}).contamination);
    rows.push({
      tier: 'curated',
      model: r.model ?? null,
      benchmark: r.benchmark ?? null,
      metric: r.metric ?? null,
      value: r.value ?? null,
      lower_is_better: r.lower_is_better === true,
      grade: (r.signal_strength || {}).grade ?? null,
      lane: grade ? laneForGrade(grade) : LANE_RELATIVE_ONLY,
      verified: r.verified === true,
      citation: r.citation ?? null,
      source_url: r.source_url ?? null,
      method_ref: r.method_ref ?? null,
    });
  }
  return { rows, methodsIndex };
}

// ---------------------------------------------------------------------------
// Tier 3 — bulk cited index (relative-only by construction)
// ---------------------------------------------------------------------------

/** Strip a FLORES-style script suffix: 'ace_Arab' → 'ace'. */
function baseCode(code) {
  return code.split('_', 1)[0];
}

/**
 * Best-published rows for the pair from the bulk index.
 *
 * Pair keys are upstream codes (may carry script suffixes); we match on the
 * script-stripped base and surface the exact upstream key on each row so
 * nothing is silently relabelled.
 *
 * @param {string} src
 * @param {string} tgt
 * @param {object} [opts]
 * @param {object|null} [opts.index] - Fixture for tests
 * @param {number} [opts.maxRows]
 * @returns {{rows: object[], meta: object}}
 */
function bulkEvidence(src, tgt, { index = undefined, maxRows = 8 } = {}) {
  const idx = index !== undefined ? index : loadCatalogueJson('external-mt-index.json');
  if (!idx || Object.keys(idx).length === 0) return { rows: [], meta: {} };
  const models = idx.models || [];
  const posture = idx.contamination_posture || {};
  const rows = [];
  for (const [key, cells] of Object.entries(idx.pairs || {})) {
    const sep = key.indexOf('-');
    const s = sep === -1 ? key : key.slice(0, sep);
    const t = sep === -1 ? '' : key.slice(sep + 1);
    if (baseCode(s) !== src || baseCode(t) !== tgt) continue;
    for (const [testset, metrics] of Object.entries(cells)) {
      for (const [metric, cell] of Object.entries(metrics)) {
        const [modelIdx, value] = cell;
        const model = (Number.isInteger(modelIdx) && modelIdx < models.length)
          ? models[modelIdx]
          : String(modelIdx);
        rows.push({
          tier: 'bulk',
          pair_key: key,
          model,
          benchmark: testset,
          metric,
          value,
          lane: LANE_RELATIVE_ONLY,
          posture: posture[testset] ?? null,
        });
      }
    }
  }
  rows.sort((a, b) =>
    a.benchmark.localeCompare(b.benchmark)
    || a.metric.localeCompare(b.metric)
    || a.pair_key.localeCompare(b.pair_key));
  const meta = {
    provider: idx.provider ?? null,
    provenance: idx.provenance ?? null,
    truncated: rows.length > maxRows,
    total_rows: rows.length,
  };
  return { rows: rows.slice(0, maxRows), meta };
}

// ---------------------------------------------------------------------------
// Tier 4 — metric-reliability evidence (which metric to BELIEVE for the target)
// ---------------------------------------------------------------------------

/**
 * Per-target-family metric↔human correlation evidence (workstream B3).
 *
 * Answers a different question from tiers 1–3: not "which SYSTEM scores
 * best" but "which METRIC can you trust to score output in this target
 * language". Sourced from shared/catalogue/metric-reliability.json — the
 * champollion-derived correlations between automatic metrics and the WMT
 * Metrics-task human judgments (wmt19–wmt25); methodology spec:
 * https://champollion.dev/docs/network/specifications/metric-reliability
 *
 * Fail-honest: an absent index, or a target no WMT campaign ever judged,
 * yields an explicit note — never a silent skip, never borrowed numbers.
 *
 * @param {string} tgt
 * @param {object|null} [reliability] - Fixture for tests
 * @returns {{section: object|null, notes: string[]}}
 */
function metricReliabilityEvidence(tgt, reliability = undefined) {
  const rel = reliability !== undefined
    ? reliability
    : loadCatalogueJson('metric-reliability.json');
  if (!rel) {
    return {
      section: null,
      notes: ['Metric-reliability index not bundled in the npm package — '
        + 'metric-trust tier skipped explicitly. See the methodology spec at '
        + 'https://champollion.dev/docs/network/specifications/metric-reliability, '
        + 'or run from a monorepo checkout (or `mt-eval recommend`) for the '
        + 'full evidence.'],
    };
  }
  const languages = rel.languages || {};
  let code = null;
  let info = null;
  for (const key of Object.keys(languages).sort()) {
    const entry = languages[key] || {};
    if (tgt === key || tgt === entry.iso639_3) {
      code = key;
      info = entry;
      break;
    }
  }
  if (info === null) {
    return {
      section: null,
      notes: [`No WMT human-judgment meta-evaluation covers target '${tgt}' `
        + '(directly or via its family) — metric choice for this language is '
        + 'UNMEASURED. Treat every metric as unvalidated there; prefer '
        + 'metrics with morphology-robust behaviour and validate locally '
        + 'where possible.'],
    };
  }
  const notes = [];
  const family = info.family || 'Unclassified';
  const famBlock = (rel.families || {})[family] || {};
  const metricsOut = [];
  for (const [metricId, levels] of Object.entries(famBlock.metrics || {}).sort()) {
    const sysE = levels.sys || {};
    const segE = levels.seg || {};
    metricsOut.push({
      metric: metricId,
      sys_pearson: sysE.pearson_weighted_mean ?? null,
      sys_pairwise_accuracy: sysE.pairwise_accuracy_weighted_mean ?? null,
      sys_n_pairs: sysE.n_pairs ?? null,
      seg_kendall: segE.kendall_tau_b_weighted_mean ?? null,
      seg_n_pairs: segE.n_pairs ?? null,
    });
  }
  metricsOut.sort((a, b) =>
    (b.sys_pearson ?? -2) - (a.sys_pearson ?? -2)
    || a.metric.localeCompare(b.metric));
  const exactPairs = [...new Set((rel.cells || [])
    .filter((c) => c.tgt === code && c.preferred)
    .map((c) => c.pair))].sort();
  if (exactPairs.length === 0) {
    notes.push(`Family-level metric evidence only: the '${family}' `
      + `correlations come from other ${family} target languages, never from `
      + `'${tgt}' itself — transfer within a family is an assumption, not a `
      + 'measurement.');
  }
  if ((rel.license_lane || {}).commercial_ok === false) {
    notes.push('Metric-reliability evidence rides a non-commercial hold (the '
      + 'upstream WMT judgment data license is unstated, founder review '
      + 'pending) — cite it in research lanes only.');
  }
  return {
    section: {
      target_code: code,
      target_iso639_3: info.iso639_3 ?? null,
      target_family: family,
      exact_pairs_measured: exactPairs,
      family_metrics: metricsOut,
      provenance: rel.provenance ?? null,
    },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble the full recommendation payload for one directed pair.
 *
 * The payload shape mirrors the harness's `mt-eval recommend --json` output
 * (snake_case keys) so machine consumers see one cross-runtime contract.
 *
 * @param {string} src
 * @param {string} tgt
 * @param {object} [opts]
 * @param {string} [opts.useContext]
 * @param {object|null} [opts.manifest] - Fixture for tests
 * @param {object|null} [opts.curated] - Fixture for tests
 * @param {object|null} [opts.bulk] - Fixture for tests
 * @param {object|null} [opts.reliability] - Fixture for tests
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests
 * @param {string} [opts.cwd]
 * @returns {object}
 */
function recommend(src, tgt, {
  useContext = 'non-commercial',
  manifest = undefined,
  curated = undefined,
  bulk = undefined,
  reliability = undefined,
  env = null,
  cwd = undefined,
} = {}) {
  const methods = dispatchableMethods(useContext, { manifest, env, cwd });
  const { rows: curatedRows, methodsIndex: citedMethods } = curatedEvidence(src, tgt, curated);
  const { rows: bulkRows, meta: bulkMeta } = bulkEvidence(src, tgt, { index: bulk });
  const { section: reliabilitySection, notes: reliabilityNotes } =
    metricReliabilityEvidence(tgt, reliability);

  // Join: which cited models are dispatchable / commercially deployable?
  const evidencedModels = [];
  const seen = new Set();
  for (const row of curatedRows) {
    const ref = row.method_ref;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const m = citedMethods[ref] || {};
    evidencedModels.push({
      id: ref,
      name: m.name ?? null,
      runnable_in_champollion: m.runnable_in_champollion === true,
      commercial_use: m.commercial_use ?? null,
      license: m.license ?? null,
    });
  }

  const notes = [
    'Cited evidence orders methods RELATIVE to each other on memorized '
    + 'public benchmarks — it is never absolute quality and never a '
    + 'deployment ranking (relative-comparison-only lane).',
    'Evidence and runnability are different axes: the best-evidenced '
    + 'model may not be dispatchable here, and NC-licensed weights are '
    + 'excluded from commercial-lane recommendations.',
  ];
  if (curated === undefined && cataloguePath('external-results.json') === null) {
    notes.push('Curated cited-results index not available in this install — '
      + 'tier skipped explicitly.');
  }
  if (bulk === undefined && cataloguePath('external-mt-index.json') === null) {
    notes.push('Bulk published-results index not bundled in the npm package '
      + '(1.6 MB) — tier skipped explicitly. Browse it at '
      + 'https://champollion.dev/catalogue, or run from a monorepo checkout '
      + '(or `mt-eval recommend`) for the full index.');
  }
  if (curatedRows.length === 0 && bulkRows.length === 0) {
    notes.push(
      `NO published evidence indexed for ${src}→${tgt}. That is the `
      + 'honest answer — measure instead of guessing: '
      + `\`mt-eval corpora --source ${src} --target ${tgt}\` lists runnable `
      + 'benchmarks, `mt-eval run` produces your own scored evidence.');
  }
  notes.push(...reliabilityNotes);

  return {
    pair: { source: src, target: tgt },
    use_context: useContext,
    runnable_methods: methods,
    curated_evidence: curatedRows,
    bulk_evidence: bulkRows,
    bulk_meta: bulkMeta,
    evidenced_models: evidencedModels,
    metric_reliability: reliabilitySection,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Human-readable rendering of a recommend() payload (mirrors the harness's
 * render_text, plus CLI-name and harness-only annotations).
 *
 * @param {object} payload
 * @returns {string}
 */
function renderText(payload) {
  const p = payload.pair;
  const out = [
    `Method guidance — ${p.source} → ${p.target}   (lane: ${payload.use_context})`,
    '',
  ];

  out.push('Runnable methods (shared/method-registry.json):');
  if (payload.runnable_methods.length === 0) {
    out.push('  (method registry not available in this install)');
  }
  const badges = {
    'ready': 'READY     ',
    'needs-key': 'NEEDS KEY ',
    'local-setup': 'LOCAL     ',
  };
  for (const m of payload.runnable_methods) {
    // Show the name a champollion.config.json actually uses when it differs
    // from the canonical registry name (e.g. openrouter → llm).
    const shown = m.cli_name && m.cli_name !== m.method
      ? `${m.method} (cli: ${m.cli_name})`
      : m.method;
    let line;
    if (!m.lane_ok) {
      line = `  EXCLUDED  ${shown.padEnd(22)}${m.lane_note}`;
    } else {
      const badge = badges[m.availability] || '?         ';
      line = `  ${badge}${shown.padEnd(22)}${m.availability_detail}`;
      if (m.license) line += `   [${m.license}]`;
    }
    out.push(line);
    if (m.runtime_note) out.push(`            ↳ ${m.runtime_note}`);
  }

  out.push('');
  out.push('Published evidence for this pair (cited — never reproduced '
    + 'by us; relative ordering only):');
  if (payload.curated_evidence.length === 0 && payload.bulk_evidence.length === 0) {
    out.push('  none indexed.');
  }
  for (const r of payload.curated_evidence) {
    const v = r.verified ? 'verified' : 'UNVERIFIED';
    out.push(`  [curated/${v}] ${r.benchmark} ${r.metric}=${r.value} — `
      + `${r.model}  (grade ${r.grade}; ${r.citation})`);
  }
  for (const r of payload.bulk_evidence) {
    out.push(`  [bulk] ${r.benchmark} ${r.metric}=${r.value} — ${r.model}  `
      + `(pair key ${r.pair_key})`);
  }
  if (payload.bulk_meta.truncated) {
    out.push(`  … ${payload.bulk_meta.total_rows} bulk rows total `
      + '(showing best-per-bucket head).');
  }

  if (payload.evidenced_models.length > 0) {
    out.push('');
    out.push('Evidenced models vs. dispatchability:');
    for (const m of payload.evidenced_models) {
      const bits = [];
      bits.push(m.runnable_in_champollion
        ? 'runnable in Champollion'
        : 'NOT dispatchable here yet');
      if (m.commercial_use === false) bits.push('weights NC — non-commercial only');
      out.push(`  ${m.name || m.id}: ${bits.join('; ')}`);
    }
  }

  const rel = payload.metric_reliability;
  if (rel) {
    const fmt = (v) => (v === null || v === undefined
      ? '    —'
      : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`);
    out.push('');
    out.push(`Metric trust for the target (family: ${rel.target_family} — `
      + 'WMT human-judgment correlations; which metric to believe):');
    for (const m of rel.family_metrics) {
      const n = m.sys_n_pairs ?? m.seg_n_pairs ?? 0;
      out.push(`  ${m.metric.padEnd(18)} sys-Pearson ${fmt(m.sys_pearson)}   `
        + `seg-Kendall ${fmt(m.seg_kendall)}   (${n} pair(s))`);
    }
    const measured = rel.exact_pairs_measured.length > 0
      ? rel.exact_pairs_measured.join(', ')
      : 'none — family-level only';
    out.push(`  directly measured pairs for this target: ${measured}`);
  }

  out.push('');
  for (const n of payload.notes) {
    out.push(`⚠ ${n}`);
  }
  return out.join('\n');
}

export {
  cataloguePath,
  resolveAvailability,
  dispatchableMethods,
  curatedEvidence,
  bulkEvidence,
  metricReliabilityEvidence,
  recommend,
  renderText,
};
