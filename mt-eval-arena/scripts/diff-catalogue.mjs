#!/usr/bin/env node

/**
 * diff-catalogue.mjs — the Gate-1 verification artifact for the atlas-backed
 * trading-card staging (Part B6 of the SSOT cutover).
 *
 * Compares the freshly staged catalogue (data/staging/, written by the
 * rewritten build-trading-card-data.mjs) against the prod golden baseline
 * (data/baseline-prod-2026-08/, fetched via build-data-from-supabase.mjs),
 * and refuses to pass until EVERY difference is classified.
 *
 * Modeled on cli/scripts/diff-projected-cards.mjs: a diff that nobody
 * classifies is a diff that hides its own regressions. The verdicts:
 *
 *   INTENDED      the change is expected and verified — a committed rule in
 *                 diff-rules.json names the field and the TRUE reason
 *                 (intended-fix and intended-drop are the rule's `bucket`)
 *   REGRESSION    a difference no rule covers — blocks (non-zero exit)
 *   UNPROJECTED   a baseline field entirely absent from staging with no rule
 *                 — work remaining, not (yet) data loss, reported separately
 *
 * What it checks:
 *   1. Set level — staged codes vs baseline codes (adds / retires)
 *   2. Per-code per-field diff over ALL index entries (both camelCase)
 *   3. Detail-blob TOP-LEVEL-KEY diff on a deterministic sample (--sample N,
 *      default 200, stride over sorted codes) plus every code in --codes
 *   4. Column checksums — md5 over sorted "code|value" lines per index
 *      column, baseline and staging (generalizes the 6f2e38106 manual
 *      verification); a matching pair proves the column byte-identical
 *
 * Output:
 *   data/staging/catalogue-diff-report.json  (machine)
 *   data/staging/catalogue-diff-report.md    (human)
 *
 * Usage:
 *   node scripts/diff-catalogue.mjs
 *   node scripts/diff-catalogue.mjs --baseline data/baseline-prod-2026-08 \
 *       --staging data/staging --sample 200 --codes crk,eng,fra
 *   node scripts/diff-catalogue.mjs --verify-upload [--target prod]
 *
 * --verify-upload (network; runs AFTER an upload rehearsal, not part of the
 *   offline gate): fetches live trading_card_index rows read-only with the
 *   anon key via cli/lib/cards/remote.js (same endpoints and env conventions
 *   as build-data-from-supabase.mjs — CHAMPOLLION_SUPABASE_URL /
 *   CHAMPOLLION_SUPABASE_ANON_KEY override the baked-in prod defaults in
 *   cli/lib/cards/env.js), maps them through the canonical
 *   indexRowToEntry() reconstruction (cli/website/scripts/lib/
 *   tc-index-remote.js), and byte-compares per column against staging.
 *   Detail rows are spot-checked for the --codes list only (full detail
 *   verification would move ~500MB). No writes, ever.
 *
 * Exit: 0 no regressions · 1 regressions to classify · 2 could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// ARGS
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
diff-catalogue.mjs — classify every difference between the staged catalogue
and the prod golden baseline. See the header comment for the full contract.

  --baseline <dir>   baseline dir (default: data/baseline-prod-2026-08)
  --staging <dir>    staging dir  (default: data/staging)
  --sample <N>       detail blobs to key-diff (default 200; deterministic
                     stride over sorted codes)
  --codes a,b,c      codes to FULL-diff at detail level (always included)
  --json             print the JSON report to stdout too
  --verify-upload    NETWORK MODE (post-rehearsal): fetch live
                     trading_card_index rows READ-ONLY with the anon key
                     (cli/lib/cards/remote.js — same endpoints/env as
                     build-data-from-supabase.mjs; override target via
                     CHAMPOLLION_SUPABASE_URL/CHAMPOLLION_SUPABASE_ANON_KEY),
                     reconstruct entries with indexRowToEntry(), and
                     byte-compare per column against staging. Detail rows are
                     spot-checked for --codes only. Never writes.

Exit codes: 0 clean · 1 REGRESSION bucket non-empty · 2 could not run
`);
  process.exit(0);
}

const BASELINE_DIR = path.resolve(flag('baseline', path.join(DATA_DIR, 'baseline-prod-2026-08')));
const STAGING_DIR = path.resolve(flag('staging', path.join(DATA_DIR, 'staging')));
const SAMPLE_N = Number(flag('sample', '200'));
const EXPLICIT_CODES = (flag('codes', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const JSON_OUT = argv.includes('--json');
const VERIFY_UPLOAD = argv.includes('--verify-upload');

// --rules exists for the test harness; real gate runs use the committed file.
const RULES_PATH = path.resolve(flag('rules', path.join(__dirname, 'diff-rules.json')));

for (const [label, p] of [['baseline', BASELINE_DIR], ['staging', STAGING_DIR]]) {
  if (!fs.existsSync(path.join(p, 'tc-index.json'))) {
    console.error(`ERROR: ${label} tc-index.json not found under ${p}`);
    process.exit(2);
  }
}
if (!fs.existsSync(RULES_PATH)) {
  console.error(`ERROR: rules file not found: ${RULES_PATH}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Deep key-sorted stringify, so {a,b} === {b,a} — object key ORDER is a
 *  serialization accident, not a data difference. Array order IS data. */
function canon(v) {
  if (v === undefined) return 'undefined';
  return JSON.stringify(sortKeys(v));
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
const isAbsent = (v) => v === undefined || v === null
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
const same = (a, b) => (isAbsent(a) && isAbsent(b)) || canon(a) === canon(b);
const md5 = (s) => createHash('md5').update(s).digest('hex');

function loadIndex(dir) {
  const entries = JSON.parse(fs.readFileSync(path.join(dir, 'tc-index.json'), 'utf-8'));
  const map = new Map();
  for (const e of entries) map.set(e.code, e);
  return map;
}
function fieldSetOf(map) {
  const s = new Set();
  for (const e of map.values()) for (const k of Object.keys(e)) s.add(k);
  return s;
}

// ---------------------------------------------------------------------------
// RULES
// ---------------------------------------------------------------------------

const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
const indexRules = rules.index || {};
const detailRules = rules.detail || {};
const ignoreIndex = new Set(rules.ignoreIndex || []);
const ignoreDetail = new Set(rules.ignoreDetail || []);

// ---------------------------------------------------------------------------
// 1+2. INDEX DIFF
// ---------------------------------------------------------------------------

const baseIdx = loadIndex(BASELINE_DIR);
const stagIdx = loadIndex(STAGING_DIR);

const report = {
  generatedAt: new Date().toISOString(),
  baselineDir: BASELINE_DIR,
  stagingDir: STAGING_DIR,
  codeSet: {
    baseline: baseIdx.size,
    staging: stagIdx.size,
    added: [...stagIdx.keys()].filter((c) => !baseIdx.has(c)).sort(),
    retired: [...baseIdx.keys()].filter((c) => !stagIdx.has(c)).sort(),
  },
  index: { fields: {}, buckets: { intended: 0, regression: 0, unprojected: 0, ignored: 0, identical: 0 } },
  detail: { sampledCodes: 0, keys: {}, buckets: { intended: 0, regression: 0, unprojected: 0, ignored: 0, identical: 0 } },
  checksums: {},
  verifyUpload: null,
};

const baseFields = fieldSetOf(baseIdx);
const stagFields = fieldSetOf(stagIdx);
const allFields = new Set([...baseFields, ...stagFields]);

const commonCodes = [...stagIdx.keys()].filter((c) => baseIdx.has(c)).sort();

for (const field of allFields) {
  if (ignoreIndex.has(field)) {
    report.index.fields[field] = { bucket: 'ignored', reason: 'listed in ignoreIndex' };
    continue;
  }
  const rule = indexRules[field] || null;
  const rec = {
    inBaseline: baseFields.has(field),
    inStaging: stagFields.has(field),
    rule: rule ? { bucket: rule.bucket, reason: rule.reason } : null,
    diffCount: 0,
    kinds: { changed: 0, filled: 0, emptied: 0 },
    examples: [],
  };

  // A baseline field the staging build never emits AT ALL: unprojected
  // unless a rule explicitly owns the drop.
  if (rec.inBaseline && !rec.inStaging && !rule) {
    rec.bucket = 'unprojected';
    for (const code of commonCodes) if (!isAbsent(baseIdx.get(code)[field])) rec.diffCount++;
    report.index.fields[field] = rec;
    continue;
  }

  for (const code of commonCodes) {
    const b = baseIdx.get(code)[field];
    const s = stagIdx.get(code)[field];
    if (same(b, s)) continue;
    rec.diffCount++;
    const kind = isAbsent(b) ? 'filled' : isAbsent(s) ? 'emptied' : 'changed';
    rec.kinds[kind]++;
    if (rec.examples.length < 3) {
      rec.examples.push({
        code, kind,
        baseline: JSON.stringify(b)?.slice(0, 160) ?? 'undefined',
        staging: JSON.stringify(s)?.slice(0, 160) ?? 'undefined',
      });
    }
  }

  if (rec.diffCount === 0) rec.bucket = 'identical';
  else if (rule) rec.bucket = 'intended';
  else rec.bucket = 'regression';
  report.index.fields[field] = rec;
}

for (const rec of Object.values(report.index.fields)) {
  report.index.buckets[rec.bucket === 'ignored' ? 'ignored' : rec.bucket]++;
}

// ---------------------------------------------------------------------------
// 3. DETAIL KEY-LEVEL DIFF (sampled + explicit)
// ---------------------------------------------------------------------------

const detailCodes = (() => {
  const both = commonCodes.filter((c) =>
    fs.existsSync(path.join(BASELINE_DIR, 'tc-lang', `${c}.json`))
    && fs.existsSync(path.join(STAGING_DIR, 'tc-lang', `${c}.json`)));
  const stride = Math.max(1, Math.floor(both.length / Math.max(1, SAMPLE_N)));
  const picked = new Set();
  for (let i = 0; i < both.length && picked.size < SAMPLE_N; i += stride) picked.add(both[i]);
  for (const c of EXPLICIT_CODES) if (both.includes(c)) picked.add(c);
  return [...picked].sort();
})();
report.detail.sampledCodes = detailCodes.length;
report.detail.codes = detailCodes.length <= 40 ? detailCodes : undefined;

for (const code of detailCodes) {
  const b = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, 'tc-lang', `${code}.json`), 'utf-8'));
  const s = JSON.parse(fs.readFileSync(path.join(STAGING_DIR, 'tc-lang', `${code}.json`), 'utf-8'));
  for (const key of new Set([...Object.keys(b), ...Object.keys(s)])) {
    if (ignoreDetail.has(key)) continue;
    if (same(b[key], s[key])) continue;
    const rule = detailRules[key] || null;
    const rec = (report.detail.keys[key] ??= {
      rule: rule ? { bucket: rule.bucket, reason: rule.reason } : null,
      diffCount: 0, kinds: { changed: 0, filled: 0, emptied: 0 }, examples: [],
    });
    rec.diffCount++;
    const kind = isAbsent(b[key]) ? 'filled' : isAbsent(s[key]) ? 'emptied' : 'changed';
    rec.kinds[kind]++;
    if (rec.examples.length < 2) {
      rec.examples.push({
        code, kind,
        baseline: JSON.stringify(b[key])?.slice(0, 160) ?? 'undefined',
        staging: JSON.stringify(s[key])?.slice(0, 160) ?? 'undefined',
      });
    }
  }
}
for (const rec of Object.values(report.detail.keys)) {
  rec.bucket = rec.rule ? 'intended' : 'regression';
  report.detail.buckets[rec.bucket]++;
}

// Full deep diff on the explicit codes (leaf-path level) so crk/eng/fra get
// more than a key-level look — differences roll up under their top-level key,
// which already carries the verdict; this just surfaces the leaf paths.
report.detail.explicitDeepDiff = {};
for (const code of EXPLICIT_CODES) {
  const bp = path.join(BASELINE_DIR, 'tc-lang', `${code}.json`);
  const sp = path.join(STAGING_DIR, 'tc-lang', `${code}.json`);
  if (!fs.existsSync(bp) || !fs.existsSync(sp)) continue;
  const paths = [];
  const walk = (b, s, prefix) => {
    if (same(b, s)) return;
    if (b && s && typeof b === 'object' && typeof s === 'object' && !Array.isArray(b) && !Array.isArray(s)) {
      for (const k of new Set([...Object.keys(b), ...Object.keys(s)])) walk(b[k], s[k], `${prefix}.${k}`);
    } else if (paths.length < 400) {
      paths.push(prefix);
    }
  };
  const b = JSON.parse(fs.readFileSync(bp, 'utf-8'));
  const s = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  for (const k of new Set([...Object.keys(b), ...Object.keys(s)])) {
    if (!ignoreDetail.has(k)) walk(b[k], s[k], k);
  }
  report.detail.explicitDeepDiff[code] = paths;
}

// ---------------------------------------------------------------------------
// 4. COLUMN CHECKSUMS
// ---------------------------------------------------------------------------

for (const field of [...allFields].sort()) {
  const col = (map) => md5(
    [...map.keys()].sort().map((c) => `${c}|${canon(map.get(c)[field])}`).join('\n'),
  );
  const b = col(baseIdx);
  const s = col(stagIdx);
  report.checksums[field] = { baseline: b, staging: s, match: b === s };
}

// ---------------------------------------------------------------------------
// 5. VERIFY-UPLOAD (network, read-only, optional)
// ---------------------------------------------------------------------------

async function verifyUpload() {
  const REPO = path.join(__dirname, '..', '..');
  const { fetchIndexRows, fetchDetailRow } =
    await import(path.join(REPO, 'cli', 'lib', 'cards', 'remote.js'));
  const { indexRowToEntry } =
    require(path.join(REPO, 'cli', 'website', 'scripts', 'lib', 'tc-index-remote.js'));

  console.log('  [verify-upload] fetching live trading_card_index (read-only, anon)…');
  const rows = await fetchIndexRows({ select: '*' });
  const live = new Map();
  for (const row of rows) live.set(row.code, indexRowToEntry(row));

  const result = {
    liveRows: rows.length,
    stagingRows: stagIdx.size,
    missingLive: [...stagIdx.keys()].filter((c) => !live.has(c)).sort().slice(0, 50),
    extraLive: [...live.keys()].filter((c) => !stagIdx.has(c)).sort().slice(0, 50),
    columnMismatches: {},
    detailSpotChecks: {},
  };

  // Column-level byte comparison over the RECONSTRUCTED entries. Note: the
  // reconstruction is lossy for a few fields by design (narrative is always
  // null; vitalityLevel/vitalityTrend/ancestryGlottocodes are not uploaded) —
  // exclude fields with no upload column rather than reporting phantom drift.
  const NOT_UPLOADED = new Set(['narrative', 'vitalityLevel', 'vitalityTrend', 'ancestryGlottocodes']);
  const codes = [...stagIdx.keys()].filter((c) => live.has(c)).sort();
  for (const field of [...stagFields].sort()) {
    if (NOT_UPLOADED.has(field)) continue;
    let n = 0; const ex = [];
    for (const code of codes) {
      if (same(stagIdx.get(code)[field], live.get(code)[field])) continue;
      n++;
      if (ex.length < 3) {
        ex.push({
          code,
          staging: JSON.stringify(stagIdx.get(code)[field])?.slice(0, 120),
          live: JSON.stringify(live.get(code)[field])?.slice(0, 120),
        });
      }
    }
    if (n > 0) result.columnMismatches[field] = { count: n, examples: ex };
  }

  for (const code of EXPLICIT_CODES) {
    const sp = path.join(STAGING_DIR, 'tc-lang', `${code}.json`);
    if (!fs.existsSync(sp)) continue;
    const row = await fetchDetailRow(code);
    result.detailSpotChecks[code] = !row
      ? { present: false }
      : { present: true, byteEqual: same(JSON.parse(fs.readFileSync(sp, 'utf-8')), row.detail) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// REPORT WRITERS
// ---------------------------------------------------------------------------

function writeMd() {
  const L = [];
  const idx = report.index;
  L.push('# Catalogue diff report — staging vs prod baseline');
  L.push('');
  L.push(`Generated: ${report.generatedAt}`);
  L.push(`Baseline: \`${BASELINE_DIR}\` (${report.codeSet.baseline} codes)`);
  L.push(`Staging:  \`${STAGING_DIR}\` (${report.codeSet.staging} codes)`);
  L.push('');
  L.push('## Code set');
  L.push('');
  L.push(`- Added: ${report.codeSet.added.length}${report.codeSet.added.length ? ` — ${report.codeSet.added.slice(0, 20).join(', ')}` : ''}`);
  L.push(`- Retired: ${report.codeSet.retired.length}${report.codeSet.retired.length ? ` — ${report.codeSet.retired.slice(0, 20).join(', ')}` : ''}`);
  L.push('');
  L.push('## Index fields');
  L.push('');
  L.push(`Buckets: intended ${idx.buckets.intended} · REGRESSION ${idx.buckets.regression} · unprojected ${idx.buckets.unprojected} · identical ${idx.buckets.identical} · ignored ${idx.buckets.ignored}`);
  L.push('');
  L.push('| Field | Bucket | Diffs | changed/filled/emptied | Reason |');
  L.push('|---|---|---:|---|---|');
  const order = Object.entries(idx.fields)
    .sort((a, b) => (b[1].diffCount ?? 0) - (a[1].diffCount ?? 0));
  for (const [f, r] of order) {
    if (r.bucket === 'identical' || r.bucket === 'ignored') continue;
    L.push(`| ${f} | ${r.bucket === 'regression' ? '**REGRESSION**' : r.bucket} | ${r.diffCount} | ${r.kinds ? `${r.kinds.changed}/${r.kinds.filled}/${r.kinds.emptied}` : ''} | ${r.rule?.reason ?? ''} |`);
  }
  L.push('');
  const identical = order.filter(([, r]) => r.bucket === 'identical').map(([f]) => f);
  L.push(`Identical columns (${identical.length}): ${identical.join(', ')}`);
  L.push('');
  L.push('### Exemplar diffs');
  L.push('');
  for (const [f, r] of order) {
    if (!r.examples?.length) continue;
    L.push(`**${f}** (${r.bucket}):`);
    for (const e of r.examples) L.push(`- \`${e.code}\` [${e.kind}] ${e.baseline} → ${e.staging}`);
    L.push('');
  }
  L.push(`## Detail blobs (top-level keys, ${report.detail.sampledCodes} codes sampled)`);
  L.push('');
  L.push(`Buckets: intended ${report.detail.buckets.intended} · REGRESSION ${report.detail.buckets.regression}`);
  L.push('');
  L.push('| Key | Bucket | Diffs (of sample) | changed/filled/emptied | Reason |');
  L.push('|---|---|---:|---|---|');
  for (const [k, r] of Object.entries(report.detail.keys).sort((a, b) => b[1].diffCount - a[1].diffCount)) {
    L.push(`| ${k} | ${r.bucket === 'regression' ? '**REGRESSION**' : r.bucket} | ${r.diffCount} | ${r.kinds.changed}/${r.kinds.filled}/${r.kinds.emptied} | ${r.rule?.reason ?? ''} |`);
  }
  L.push('');
  for (const [k, r] of Object.entries(report.detail.keys)) {
    if (!r.examples?.length) continue;
    L.push(`**${k}** (${r.bucket}):`);
    for (const e of r.examples) L.push(`- \`${e.code}\` [${e.kind}] ${e.baseline} → ${e.staging}`);
    L.push('');
  }
  L.push('## Column checksums (md5 over sorted `code|value` lines)');
  L.push('');
  L.push('| Column | Baseline | Staging | Match |');
  L.push('|---|---|---|---|');
  for (const [f, c] of Object.entries(report.checksums)) {
    L.push(`| ${f} | \`${c.baseline}\` | \`${c.staging}\` | ${c.match ? 'YES' : 'no'} |`);
  }
  L.push('');
  if (report.verifyUpload) {
    const v = report.verifyUpload;
    L.push('## Verify-upload (live Supabase vs staging)');
    L.push('');
    L.push(`Live rows: ${v.liveRows} · staging rows: ${v.stagingRows}`);
    L.push(`Missing live: ${v.missingLive.length} · extra live: ${v.extraLive.length}`);
    L.push(`Column mismatches: ${Object.keys(v.columnMismatches).length ? '' : 'none'}`);
    for (const [f, m] of Object.entries(v.columnMismatches)) {
      L.push(`- **${f}**: ${m.count} rows differ (e.g. ${JSON.stringify(m.examples[0])})`);
    }
    for (const [c, s] of Object.entries(v.detailSpotChecks)) {
      L.push(`- detail \`${c}\`: ${s.present ? (s.byteEqual ? 'byte-equal' : 'DIFFERS') : 'MISSING'}`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(STAGING_DIR, 'catalogue-diff-report.md'), L.join('\n'), 'utf-8');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

(async () => {
  if (VERIFY_UPLOAD) {
    try {
      report.verifyUpload = await verifyUpload();
    } catch (err) {
      console.error(`ERROR: --verify-upload failed: ${err.message}`);
      process.exit(2);
    }
  }

  fs.writeFileSync(
    path.join(STAGING_DIR, 'catalogue-diff-report.json'),
    JSON.stringify(report, null, 2), 'utf-8',
  );
  writeMd();
  if (JSON_OUT) console.log(JSON.stringify(report, null, 2));

  const idxReg = Object.entries(report.index.fields).filter(([, r]) => r.bucket === 'regression');
  const detReg = Object.entries(report.detail.keys).filter(([, r]) => r.bucket === 'regression');
  const unproj = Object.entries(report.index.fields).filter(([, r]) => r.bucket === 'unprojected');

  console.log(`\n  CATALOGUE DIFF — ${report.codeSet.staging} staged vs ${report.codeSet.baseline} baseline`);
  console.log(`    codes added/retired     : ${report.codeSet.added.length}/${report.codeSet.retired.length}`);
  console.log(`    index fields intended   : ${report.index.buckets.intended}`);
  console.log(`    index fields identical  : ${report.index.buckets.identical}`);
  console.log(`    index REGRESSIONS       : ${idxReg.length}${idxReg.length ? ` — ${idxReg.map(([f]) => f).join(', ')}` : ''}`);
  console.log(`    index unprojected       : ${unproj.length}${unproj.length ? ` — ${unproj.map(([f]) => f).join(', ')}` : ''}`);
  console.log(`    detail keys intended    : ${report.detail.buckets.intended} (over ${report.detail.sampledCodes} sampled codes)`);
  console.log(`    detail REGRESSIONS      : ${detReg.length}${detReg.length ? ` — ${detReg.map(([f]) => f).join(', ')}` : ''}`);
  if (report.verifyUpload) {
    console.log(`    verify-upload mismatches: ${Object.keys(report.verifyUpload.columnMismatches).length}`);
  }
  console.log(`\n  report: ${path.join(STAGING_DIR, 'catalogue-diff-report.{json,md}')}\n`);

  const uploadDirty = report.verifyUpload
    && (Object.keys(report.verifyUpload.columnMismatches).length > 0
      || report.verifyUpload.missingLive.length > 0
      || Object.values(report.verifyUpload.detailSpotChecks).some((s) => !s.present || s.byteEqual === false));
  process.exitCode = (idxReg.length || detReg.length || uploadDirty) ? 1 : 0;
})();
