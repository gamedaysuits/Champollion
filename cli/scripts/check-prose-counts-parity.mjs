#!/usr/bin/env node

/**
 * check-prose-counts-parity.mjs — hand-written counts ↔ machine SSOTs.
 *
 * WHY THIS EXISTS
 *   House standard (CLAUDE.md "Data over code"; founder 2026-07-19): NOTHING
 *   displayed is hand-typed — a shown value is either READ from its machine
 *   SSOT at build time (docusaurus.config.js customFields → SSOTCount), or
 *   covered by a parity check that hard-blocks drift at push time. This
 *   checker is the second half: it verifies the count-bearing PROSE that
 *   cannot execute a build-time read — the internal license doc, floor
 *   claims in published docs, and the social-card SVG source.
 *
 * WHAT IT CHECKS
 *   1. docs/LICENSING.md §"Card-Data Sources Rollup" against
 *      shared/licenses.json: the heading + "draws on N" totals, the
 *      315-card-data + 17-supplemental split (_generated.counts), the
 *      "as of" date (_generated.generatedAt), the restriction-flags line
 *      (non_commercial_only / requires_sharealike / allows_redistribution=false
 *      counts AND the named no-redistribution sources), and every row of the
 *      license-family table (classifier below; the Sources column must match
 *      the register exactly, and rows must sum to the register total).
 *   2. Lane-rule references to register flag totals ("N NC-flagged sources in
 *      the license register", "N share-alike-flagged sources …") — checked
 *      against the register itself, deliberately NEVER against the
 *      tc-licenses staging dump: staging tracks the live DB, which drifts
 *      from the register between adjudicated regens by design (the standing
 *      tc-licenses drift hold), so a staging comparison would hard-block
 *      pushes on drift that is known and held.
 *   3. Floor claims against the language-card SSOT: "more than N … tagged
 *      `modality: signed`" (what-counts-as-a-language) and "N+ sign languages"
 *      (who-benefits) must be TRUE floors (actual > N).
 *   4. Poster-stat claims in who-benefits ("Fewer than N of the world's M
 *      living languages") against cli/website/src/data/graph-poster.json
 *      (dedicatedLiving < N, livingTotal === M).
 *   5. The social-card SVG source (static/img/champollion-social-card.svg):
 *      every "N languages" figure must equal the language-card count — the
 *      PNG is regenerated from this SVG via scripts/generate-social-cards.mjs.
 *   6. Per-provider coverage counts in published docs prose against
 *      shared/catalogue/method-coverage.json (the cited per-method coverage
 *      SSOT): every registered "N languages" literal for Google / Microsoft /
 *      DeepL / NLLB-200 / Lara must equal that provider's SSOT count, and the
 *      retired stale phrasings ("~130 languages", "130+ languages" — the
 *      pre-2026-07-22 Google figure) must never reappear anywhere in
 *      cli/website/docs.
 *
 * EXIT CODES (same contract as check-datasets-doc-parity.mjs / the llms-full
 * builder, so scripts/champollion_sync_gate.sh treats them identically):
 *   0 = parity holds   3 = drift / required anchor missing (hard-block)
 *   1 = checker could not run (missing inputs, crash) — environmental
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Must match cli/lib/content-sync.js hashFileContent() exactly — this checker
// reads that module's lock file, so a different digest would silently call
// every mirror stale.
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf-8').digest('hex');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const LICENSES_PATHS = [
  path.join(ROOT, 'shared', 'licenses.json'),
  path.join(ROOT, 'cli', 'shared', 'licenses.json'),
];
const LICENSING_DOC = path.join(ROOT, 'docs', 'LICENSING.md');
const CARDS_DIR = path.join(ROOT, 'cli', 'shared', 'language-cards');
const WHAT_COUNTS_DOC = path.join(ROOT, 'cli', 'website', 'docs', 'network', 'context', 'what-counts-as-a-language.md');
const WHO_BENEFITS_DOC = path.join(ROOT, 'cli', 'website', 'docs', 'network', 'who-benefits.mdx');
const POSTER_JSON = path.join(ROOT, 'cli', 'website', 'src', 'data', 'graph-poster.json');
const SOCIAL_SVG = path.join(ROOT, 'cli', 'website', 'static', 'img', 'champollion-social-card.svg');

const problems = [];
const notes = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => problems.push(msg);

const int = (s) => parseInt(String(s).replace(/,/g, ''), 10);

function readOrDie(p, what) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch (err) {
    console.error(`could not read ${what} at ${p}: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Load the register (root SSOT first, bundled copy fallback — same order as
// docusaurus.config.js) and compute every figure the prose asserts.
// ---------------------------------------------------------------------------

const licensesPath = LICENSES_PATHS.find((p) => fs.existsSync(p));
if (!licensesPath) {
  console.error(`shared/licenses.json not found (tried: ${LICENSES_PATHS.join(', ')})`);
  process.exit(1);
}
let register;
try {
  register = JSON.parse(fs.readFileSync(licensesPath, 'utf-8'));
} catch (err) {
  console.error(`could not parse ${licensesPath}: ${err.message}`);
  process.exit(1);
}
const gen = register._generated || {};
const counts = gen.counts || {};
const entries = Object.entries(register.sources || {});
if (entries.length === 0 || !Number.isInteger(counts.total)) {
  console.error(`${licensesPath} has no sources/_generated.counts — refusing to verify against nothing`);
  process.exit(1);
}
if (counts.total !== entries.length) {
  bad(`register self-inconsistency: _generated.counts.total=${counts.total} but sources holds ${entries.length} entries`);
}
const generatedDate = String(gen.generatedAt || '').slice(0, 10);

const flagged = {
  nc: entries.filter(([, v]) => v.non_commercial_only === 1 || v.non_commercial_only === true),
  sa: entries.filter(([, v]) => v.requires_sharealike === 1 || v.requires_sharealike === true),
  noRedist: entries.filter(([, v]) => v.allows_redistribution === 0 || v.allows_redistribution === false),
};
const noRedistNames = flagged.noRedist.map(([k]) => k).sort();

// License-family classifier — mirrors the row definitions of the LICENSING.md
// summary table. Order matters (NC/SA before plain BY). An spdx no rule
// matches is a drift finding: the table has no row for it.
function familyBucket(spdx) {
  if (spdx == null || spdx === '') return 'none';
  if (spdx === 'UNCONFIRMED') return 'unconfirmed';
  if (/^CC-BY-NC-/.test(spdx)) return 'nc';
  if (/^CC-BY-SA-/.test(spdx)) return 'sa';
  // A bare, unversioned "CC" is NOT CC-BY. It used to be bucketed here, which
  // put `hayniecolorterms` in the public "CC-BY … OK with attribution" row —
  // while cli/lib/license-gate.mjs:82 refuses bare CC as unsafe ("unspecified
  // version") and shared/license-corrections.json resolves that very source to
  // LicenseRef-Unstated, non_commercial_only, allows_redistribution=0. The doc
  // was the outlier, and it erred toward MORE permissive than the runtime,
  // which is the direction that costs someone a license breach.
  if (spdx === 'CC') return 'unversioned-cc';
  if (/^CC-BY-\d/.test(spdx) || spdx === 'CC-BY') return 'by';
  if (/^CC0/.test(spdx)) return 'cc0';
  if (/^(GPL|AGPL|LGPL)-/.test(spdx)) return 'gpl';
  if (spdx === 'MIT' || /^Apache-/.test(spdx)) return 'permissive';
  if (/^Unicode-/.test(spdx)) return 'unicode';
  if (/^LicenseRef-/.test(spdx) || /^Custom/i.test(spdx)) return 'licenseref';
  return null;
}
const buckets = {};
for (const [name, v] of entries) {
  const b = familyBucket(v.license_spdx);
  if (b === null) {
    bad(`register source "${name}" has license_spdx "${v.license_spdx}" that fits NO family row of the LICENSING.md table — add a row/rule for it`);
    continue;
  }
  buckets[b] = (buckets[b] || 0) + 1;
}

// ---------------------------------------------------------------------------
// 1. docs/LICENSING.md rollup section
// ---------------------------------------------------------------------------

const licensingDoc = readOrDie(LICENSING_DOC, 'docs/LICENSING.md');

const heading = /### Card-Data Sources Rollup \(shared\/licenses\.json, ([\d,]+) sources\)/.exec(licensingDoc);
if (!heading) {
  bad('LICENSING.md rollup heading "### Card-Data Sources Rollup (shared/licenses.json, N sources)" not found — doc structure changed; update this checker WITH the doc');
} else if (int(heading[1]) !== counts.total) {
  bad(`LICENSING.md rollup heading says ${heading[1]} sources; register total is ${counts.total}`);
}

const drawsOn = /draws on ([\d,]+) registered upstream sources[^:]*: (\d+) floor sources from `shared\/license-register-floor\.json`[^)]*\) plus (\d+) supplemental/.exec(licensingDoc);
if (!drawsOn) {
  bad('LICENSING.md "draws on N registered upstream sources (…): X floor sources … plus Y supplemental" sentence not found');
} else {
  if (int(drawsOn[1]) !== counts.total) bad(`LICENSING.md "draws on ${drawsOn[1]}" ≠ register total ${counts.total}`);
  if (int(drawsOn[2]) !== counts.fromFloor) bad(`LICENSING.md says ${drawsOn[2]} floor sources; _generated.counts.fromFloor is ${counts.fromFloor}`);
  if (int(drawsOn[3]) !== counts.supplemental) bad(`LICENSING.md says ${drawsOn[3]} supplemental; _generated.counts.supplemental is ${counts.supplemental}`);
}

const asOf = /from `shared\/licenses\.json` as of (\d{4}-\d{2}-\d{2})/.exec(licensingDoc);
if (!asOf) {
  bad('LICENSING.md "from `shared/licenses.json` as of YYYY-MM-DD" stamp not found');
} else if (asOf[1] !== generatedDate) {
  bad(`LICENSING.md rollup says "as of ${asOf[1]}"; register _generated.generatedAt is ${generatedDate}`);
}

const flagsLine = /Restriction flags across all ([\d,]+): (\d+) sources `non_commercial_only`, (\d+) `requires_sharealike`, (\d+) `allows_redistribution = false` \(([^)]*)\)/.exec(licensingDoc);
if (!flagsLine) {
  bad('LICENSING.md "Restriction flags across all N: …" line not found');
} else {
  if (int(flagsLine[1]) !== counts.total) bad(`LICENSING.md flags line says "across all ${flagsLine[1]}"; register total is ${counts.total}`);
  if (int(flagsLine[2]) !== flagged.nc.length) bad(`LICENSING.md says ${flagsLine[2]} non_commercial_only; register has ${flagged.nc.length}`);
  if (int(flagsLine[3]) !== flagged.sa.length) bad(`LICENSING.md says ${flagsLine[3]} requires_sharealike; register has ${flagged.sa.length}`);
  if (int(flagsLine[4]) !== flagged.noRedist.length) bad(`LICENSING.md says ${flagsLine[4]} allows_redistribution=false; register has ${flagged.noRedist.length}`);
  const listedNames = (flagsLine[5].match(/`([^`]+)`/g) || []).map((s) => s.replace(/`/g, '')).sort();
  if (JSON.stringify(listedNames) !== JSON.stringify(noRedistNames)) {
    bad(`LICENSING.md no-redistribution names [${listedNames.join(', ')}] ≠ register [${noRedistNames.join(', ')}]`);
  }
}

// Family table — each row's Sources count must equal the classifier's bucket,
// and the rows must jointly cover every bucket.
const LABEL_TO_BUCKET = [
  ['CC-BY-SA', 'sa'],
  ['CC-BY-NC', 'nc'],
  ['CC-BY', 'by'],
  ['Unversioned', 'unversioned-cc'],
  ['CC0', 'cc0'],
  ['GPL', 'gpl'],
  ['MIT', 'permissive'],
  ['Unicode', 'unicode'],
  ['Custom / LicenseRef', 'licenseref'],
  ['UNCONFIRMED', 'unconfirmed'],
  ['none', 'none'],
];
const tableHeaderIdx = licensingDoc.indexOf('| License family | Sources |');
if (tableHeaderIdx === -1) {
  bad('LICENSING.md family table (| License family | Sources | …) not found');
} else {
  const lines = licensingDoc.slice(tableHeaderIdx).split('\n');
  const seenBuckets = new Set();
  let tableSum = 0;
  for (let i = 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const label = cells[0].replace(/[`*]/g, '');
    const n = int(cells[1]);
    tableSum += n;
    const match = LABEL_TO_BUCKET.find(([prefix]) => label.startsWith(prefix));
    if (!match) {
      bad(`LICENSING.md family-table row "${label}" matches no known bucket — update LABEL_TO_BUCKET WITH the table`);
      continue;
    }
    const [, bucket] = match;
    seenBuckets.add(bucket);
    const actual = buckets[bucket] || 0;
    if (n !== actual) {
      bad(`LICENSING.md family-table row "${label}" says ${n} sources; register has ${actual}`);
    }
  }
  for (const [bucket, n] of Object.entries(buckets)) {
    if (n > 0 && !seenBuckets.has(bucket)) {
      bad(`register has ${n} source(s) in the "${bucket}" family but the LICENSING.md table has no row for it`);
    }
  }
  if (tableSum !== counts.total) {
    bad(`LICENSING.md family-table Sources column sums to ${tableSum}; register total is ${counts.total}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Lane-rule references to register flag totals. Deliberately checked
// against the REGISTER only — never the tc-licenses staging dump, which
// tracks the live DB and legitimately drifts from the register between
// adjudicated regens (the standing tc-licenses drift hold). Prose must
// reference register totals, which are stable and verifiable.
// ---------------------------------------------------------------------------

for (const m of licensingDoc.matchAll(/(\d+) NC-flagged sources in the license register/g)) {
  if (int(m[1]) !== flagged.nc.length) {
    bad(`LICENSING.md says ${m[1]} NC-flagged sources in the register; register has ${flagged.nc.length}`);
  }
}
for (const m of licensingDoc.matchAll(/(\d+) share-alike-flagged sources in the license register/g)) {
  if (int(m[1]) !== flagged.sa.length) {
    bad(`LICENSING.md says ${m[1]} share-alike-flagged sources in the register; register has ${flagged.sa.length}`);
  }
}
// A stale-style reference ("N NC-flagged card-data sources") reappearing is
// itself drift: it reintroduces a claim no current SSOT can verify.
if (/NC-flagged card-data sources|\(FLORES\+, \d+ card-data sources\)/.test(licensingDoc)) {
  bad('LICENSING.md references "card-data sources" flag counts again — reword to register totals ("N NC-flagged sources in the license register"), which are SSOT-verifiable');
}

// ---------------------------------------------------------------------------
// 3 + 4 + 5. Card-SSOT floors, poster-stat claims, social-card SVG
// ---------------------------------------------------------------------------

if (!fs.existsSync(CARDS_DIR)) {
  console.error(`language-card SSOT not found at ${CARDS_DIR}`);
  process.exit(1);
}
const cardFiles = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.json') && f !== 'language-tree.json');
// LANGUAGES ONLY. The corpus also serves 8,675 locale projections (`fra-CA` is
// French in Canada, not a separate language); counting the files would make
// every public "N languages" figure roughly double, by counting French once
// per territory it is spoken in. A locale names its parent in `locale.language`.
const languageCardFiles = cardFiles.filter((f) => {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8'));
    return !c?.locale?.language;
  } catch { return true; } // unreadable → counted, and the JSON rule reports it
});
const cardCount = languageCardFiles.length;
/* The atlas cutover retired the hand-maintained `modality: "signed"` field, so
 * this read went to 0 and reported the floor claims as false. The signal did
 * not disappear — it moved to where it is CITED: Glottolog's own sign-language
 * node (sign1238) in classification.ancestry. Deriving it from there is the
 * more correct read under the provenance rule (a recoding we maintain is a
 * champollion-derived value; the upstream classification is the source), and
 * it is the fix this checker's own error message names — update the checker
 * when a surface legitimately moves, rather than editing prose to match a
 * field that stopped being written. */
const SIGNED_GLOTTOCODE = 'sign1238';
let signedCount = 0;
for (const f of cardFiles) {
  const text = fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8');
  if (/"modality"\s*:\s*"signed"/.test(text) || text.includes(SIGNED_GLOTTOCODE)) signedCount++;
}

const floorDocs = [
  [WHAT_COUNTS_DOC, /more than (\d+) of them, tagged/g],
  [WHO_BENEFITS_DOC, /(\d+)\+ sign languages/g],
];
for (const [docPath, pattern] of floorDocs) {
  if (!fs.existsSync(docPath)) {
    bad(`${path.relative(ROOT, docPath)} not found — floor-claim surface moved; update this checker`);
    continue;
  }
  const text = fs.readFileSync(docPath, 'utf-8');
  for (const m of text.matchAll(pattern)) {
    if (signedCount <= int(m[1])) {
      bad(`${path.relative(ROOT, docPath)} claims "more than ${m[1]}" signed languages; card SSOT has ${signedCount}`);
    }
  }
}

if (fs.existsSync(POSTER_JSON) && fs.existsSync(WHO_BENEFITS_DOC)) {
  try {
    const poster = JSON.parse(fs.readFileSync(POSTER_JSON, 'utf-8'));
    const dedicated = poster?.stats?.coverage?.dedicatedLiving;
    const living = poster?.stats?.livingTotal;
    const wb = fs.readFileSync(WHO_BENEFITS_DOC, 'utf-8');
    for (const m of wb.matchAll(/Fewer than ([\d,]+) of the world's ([\d,]+) living languages/g)) {
      if (!(Number.isInteger(dedicated) && dedicated < int(m[1]))) {
        bad(`who-benefits claims "Fewer than ${m[1]}" covered living languages; graph-poster dedicatedLiving is ${dedicated}`);
      }
      if (living !== int(m[2])) {
        bad(`who-benefits says "${m[2]} living languages"; graph-poster livingTotal is ${living}`);
      }
    }
  } catch (err) {
    bad(`could not parse ${POSTER_JSON}: ${err.message}`);
  }
} else if (!fs.existsSync(POSTER_JSON)) {
  notes.push('graph-poster.json absent — poster-stat prose checks skipped');
}

// ---------------------------------------------------------------------------
// 6. Seam hubs — the generated homepage-seam hub timeline must equal the
// coverage SSOT it was built from (regen drift blocks the push). Cited-only
// mirror of build-seam-hubs.mjs: every SSOT method with a positive count AND
// source_url+asOf must appear with the same count/tier/releaseDate/deployable.
// ---------------------------------------------------------------------------

const SEAM_HUBS_JSON = path.join(ROOT, 'cli', 'website', 'src', 'data', 'seam-hubs.json');
const METHOD_COVERAGE_PATHS = [
  path.join(ROOT, 'shared', 'catalogue', 'method-coverage.json'),
  path.join(ROOT, 'cli', 'shared', 'catalogue', 'method-coverage.json'),
];
const methodCoveragePath = METHOD_COVERAGE_PATHS.find((p) => fs.existsSync(p));
if (fs.existsSync(SEAM_HUBS_JSON) && methodCoveragePath) {
  try {
    const seamHubs = JSON.parse(fs.readFileSync(SEAM_HUBS_JSON, 'utf-8'));
    const coverage = JSON.parse(fs.readFileSync(methodCoveragePath, 'utf-8'));
    const byKey = new Map((seamHubs.hubs || []).map((h) => [h.key, h]));
    const expected = (coverage.methods || []).filter(
      (m) => typeof m.count === 'number' && m.count > 0 && m.source_url && m.asOf,
    );
    for (const m of expected) {
      const h = byKey.get(m.key);
      if (!h) {
        bad(`seam-hubs.json is missing cited method "${m.key}" — regenerate (node cli/scripts/build-seam-hubs.mjs)`);
        continue;
      }
      if (h.count !== m.count) bad(`seam-hubs.json ${m.key} count ${h.count} ≠ method-coverage ${m.count} — regenerate`);
      if (h.tier !== m.tier) bad(`seam-hubs.json ${m.key} tier ${h.tier} ≠ method-coverage ${m.tier} — regenerate`);
      if ((h.releaseDate || null) !== (m.releaseDate || null))
        bad(`seam-hubs.json ${m.key} releaseDate ${h.releaseDate} ≠ method-coverage ${m.releaseDate} — regenerate`);
      const hd = h.deployable ? h.deployable.count : null;
      const md = m.deployable && typeof m.deployable.count === 'number' ? m.deployable.count : null;
      if (hd !== md) bad(`seam-hubs.json ${m.key} deployable ${hd} ≠ method-coverage ${md} — regenerate`);
    }
    if (byKey.size !== expected.length) {
      bad(`seam-hubs.json has ${byKey.size} hubs; coverage SSOT has ${expected.length} cited methods — regenerate`);
    }
    if (seamHubs.asOf !== coverage.asOf) {
      bad(`seam-hubs.json asOf ${seamHubs.asOf} ≠ method-coverage asOf ${coverage.asOf} — regenerate`);
    }
  } catch (err) {
    bad(`could not parse seam-hubs/method-coverage: ${err.message}`);
  }
} else if (!fs.existsSync(SEAM_HUBS_JSON)) {
  notes.push('seam-hubs.json absent — seam-hub parity checks skipped');
}

const svg = readOrDie(SOCIAL_SVG, 'social-card SVG source');
let svgChecked = 0;
for (const m of svg.matchAll(/([\d,]+) languages/g)) {
  svgChecked++;
  if (int(m[1]) !== cardCount) {
    bad(`social-card SVG says "${m[1]} languages"; language-card SSOT has ${cardCount} — update the SVG and regenerate the PNG (scripts/generate-social-cards.mjs)`);
  }
}
if (svgChecked === 0) {
  bad('social-card SVG no longer carries an "N languages" figure — surface moved; update this checker');
}

// ---------------------------------------------------------------------------
// 6. Per-provider coverage counts in docs prose ↔ method-coverage.json.
// The SSOT is shared/catalogue/method-coverage.json (each provider's count
// imported cite-only from its published list, cited + dated). Docs pages are
// plain .md and cannot execute a build-time read, so their literals are
// registered here: each site's anchor must exist (a reworded page silently
// dropping the gate is itself drift) and every captured figure must equal the
// provider's SSOT count exactly.
// ---------------------------------------------------------------------------

const METHOD_COVERAGE_JSON = path.join(ROOT, 'shared', 'catalogue', 'method-coverage.json');
const DOCS_DIR = path.join(ROOT, 'cli', 'website', 'docs');

let methodCoverage;
try {
  methodCoverage = JSON.parse(fs.readFileSync(METHOD_COVERAGE_JSON, 'utf-8'));
} catch (err) {
  console.error(`could not read/parse ${METHOD_COVERAGE_JSON}: ${err.message}`);
  process.exit(1);
}
const providerCounts = Object.fromEntries(
  (methodCoverage.methods || []).map((m) => [m.key, m.count]),
);

// 6a. The SSOT must be self-consistent about WHAT KIND of number `count` is.
//     Settled 2026-08-16: `count` was silently two different quantities —
//     the provider's own published list length (Google 194, Microsoft 135) for
//     some entries, and OUR collapse to distinct ISO 639-3 base codes (OPUS 336,
//     MADLAD 415) for others. The 194-vs-187 gap was then read as a defect in
//     docs/PROVIDER_COUNT_VERIFICATION_2026-08-01.md §3.1 when it is just the
//     script/region collapse. Every entry now declares its basis, and this check
//     stops the ambiguity from creeping back.
const COUNT_BASES = new Set([
  'publisher-list-rows',
  'champollion-derived-enumeration',
  'publisher-stated-headline',
]);
const problemsBeforeBasisCheck = problems.length;
for (const m of methodCoverage.methods || []) {
  const n = Array.isArray(m.iso6393) ? m.iso6393.length : 0;
  if (!COUNT_BASES.has(m.countBasis)) {
    bad(`method-coverage.json "${m.key}": countBasis is ${JSON.stringify(m.countBasis)} — must be one of ${[...COUNT_BASES].join(' | ')}. A count with no declared basis is how "Google supports 187 languages" gets written.`);
    continue;
  }
  if (n === 0) {
    if (m.iso6393Count !== null) bad(`method-coverage.json "${m.key}": no enumerated iso6393 list, so iso6393Count must be null (got ${m.iso6393Count})`);
    if (m.countBasis !== 'publisher-stated-headline') bad(`method-coverage.json "${m.key}": countBasis "${m.countBasis}" claims a list, but iso6393 is empty`);
    continue;
  }
  if (m.iso6393Count !== n) bad(`method-coverage.json "${m.key}": iso6393Count ${m.iso6393Count} !== iso6393.length ${n} — the entry disagrees with itself`);
  if (m.countBasis === 'champollion-derived-enumeration' && m.count !== n) {
    bad(`method-coverage.json "${m.key}": countBasis is champollion-derived-enumeration but count ${m.count} !== enumeration ${n}`);
  }
  if (m.countBasis === 'publisher-list-rows' && m.count < n) {
    bad(`method-coverage.json "${m.key}": publisher list length ${m.count} is below our own enumeration ${n} — impossible; the collapse can only shrink a list`);
  }
}
if (problems.length === problemsBeforeBasisCheck) {
  ok(`method-coverage.json count semantics self-consistent (${(methodCoverage.methods || []).length} methods; every count declares its basis)`);
}

// [docs-relative path, anchor regex (one capture = the figure), provider key]
const PROVIDER_COUNT_SITES = [
  ['network/intro.md', /Google's Cloud Translation service lists ([\d,]+) languages/g, 'google-translate'],
  ['network/intro.md', /Meta's NLLB-200 covers ([\d,]+)/g, 'nllb'],
  ['network/how-it-works.md', /the ([\d,]+) languages on Google's Cloud Translation list/g, 'google-translate'],
  ['network/how-it-works.md', /the ([\d,]+) covered by NLLB-200/g, 'nllb'],
  ['network/getting-started/agent-guide.md', /Google's Cloud Translation, lists ([\d,]+) languages/g, 'google-translate'],
  ['network/community/low-resource-languages.md', /Google's Cloud Translation service lists ([\d,]+) languages/g, 'google-translate'],
  ['network/context/mt-field-briefing.md', /the ([\d,]+) on Google's Cloud Translation list/g, 'google-translate'],
  ['network/context/mt-field-briefing.md', /Cloud Translation API lists \*\*([\d,]+) languages\*\*/g, 'google-translate'],
  ['network/context/mt-field-briefing.md', /DeepL supports approximately ([\d,]+) languages/g, 'deepl'],
  ['network/context/mt-field-briefing.md', /supporting approximately \*\*([\d,]+) languages\*\*/g, 'deepl'],
  ['network/context/mt-field-briefing.md', /provides translation across \*\*([\d,]+) languages\*\*/g, 'microsoft-translator'],
  ['getting-started/installation.mdx', /High-volume key-value pairs, ([\d,]+) languages/g, 'google-translate'],
  ['getting-started/installation.mdx', /Azure, ([\d,]+) languages/g, 'microsoft-translator'],
  ['getting-started/installation.mdx', /Professional MT, ([\d,]+) languages/g, 'translated'],
  ['getting-started/installation.mdx', /key-value string pairs \(([\d,]+) languages\)/g, 'google-translate'],
  ['integrations/frameworks.md', /key-value string pairs \(([\d,]+) languages\)/g, 'google-translate'],
  ['guides/translation-methods.md', /Google Cloud Translation API v2 \(([\d,]+) languages\)/g, 'google-translate'],
  ['guides/translation-methods.md', /DeepL API with glossary support \(([\d,]+) languages\)/g, 'deepl'],
  ['guides/translation-methods.md', /Azure Cognitive Services Translator \(([\d,]+) languages\)/g, 'microsoft-translator'],
  ['guides/translation-methods.md', /adaptive MT \(([\d,]+) languages\)/g, 'translated'],
  ['guides/translation-methods.md', /Supports ([\d,]+) languages out of the box/g, 'google-translate'],
  ['guides/translation-methods.md', /Supports ([\d,]+) languages, including some that Google Translate/g, 'microsoft-translator'],
  ['reference/supported-languages.md', /Neural MT baseline\. ([\d,]+) languages\./g, 'google-translate'],
];

const providerSiteCache = new Map();
for (const [rel, pattern, provider] of PROVIDER_COUNT_SITES) {
  const docPath = path.join(DOCS_DIR, rel);
  if (!Number.isInteger(providerCounts[provider])) {
    bad(`method-coverage.json has no integer count for provider "${provider}" — SSOT shape changed; update this checker WITH it`);
    continue;
  }
  if (!providerSiteCache.has(docPath)) {
    if (!fs.existsSync(docPath)) {
      bad(`docs/${rel} not found — provider-count surface moved; update this checker WITH it`);
      providerSiteCache.set(docPath, null);
      continue;
    }
    providerSiteCache.set(docPath, fs.readFileSync(docPath, 'utf-8'));
  }
  const text = providerSiteCache.get(docPath);
  if (text === null) continue;
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) {
    bad(`docs/${rel}: anchor ${pattern} not found — the ${provider} coverage claim was reworded; update this checker WITH the page`);
    continue;
  }
  for (const m of matches) {
    if (int(m[1]) !== providerCounts[provider]) {
      bad(`docs/${rel} says "${m[1]} languages" for ${provider}; method-coverage.json count is ${providerCounts[provider]}`);
    }
  }
}

// The stale pre-2026-07-22 Google figures must never reappear in any
// published docs page (same reasoning as the "card-data sources" ban above:
// they are claims no current SSOT can verify).
const walkDocs = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walkDocs(p);
  return /\.(md|mdx)$/.test(e.name) ? [p] : [];
});
for (const docFile of walkDocs(DOCS_DIR)) {
  const text = fs.readFileSync(docFile, 'utf-8');
  if (/~130 languages|130\+ languages/.test(text)) {
    bad(`${path.relative(ROOT, docFile)} reintroduces the stale "~130 / 130+ languages" Google figure — use the method-coverage.json count (google: ${providerCounts['google-translate']}) and register the site in PROVIDER_COUNT_SITES`);
  }
}

// ---------------------------------------------------------------------------
// 7. Translated locale mirrors of the count-bearing pages.
//
// WHY: check 6 walks cli/website/docs only — English. That scope hole is how
// the retired "~130 languages" Google figure survived in all 12 locales long
// after English moved to the register count: the ban never looked at them.
//
// A locale mirror cannot be checked the way English is. The claim around the
// number is translated, so only the DIGITS survive intact — and digits alone
// are a bad witness: on the prose pages "13B parameters" renders as `130億`
// and "513 million" as `5億1,300万`, either of which a naive numeral ban would
// call drift. So this check does not try to re-verify translated prose.
//
// It asserts the property that actually matters — TRANSLATION CURRENCY —
// using the machine record built for exactly that: .champollion-content.lock,
// which stores the SHA-256 of the English source each mirror was translated
// from. A mirror whose hash still matches was translated from today's English
// and therefore has no excuse for carrying a retired figure → hard-block. A
// mirror whose hash has drifted is pending a `champollion sync` and may carry
// ANY stale fact, not just these two; re-flagging it per-numeral would be
// noise, so it is counted and reported instead.
//
// Deliberately NOT hard-blocking on staleness: clearing the backlog costs a
// paid translation run, and a gate must not conscript the founder's API spend
// as the price of a push. Set CHAMPOLLION_I18N_PARITY=block to promote it once
// the backlog is cleared — no code change needed.
// ---------------------------------------------------------------------------

const I18N_DIR = path.join(ROOT, 'cli', 'website', 'i18n');
const CONTENT_LOCK = path.join(ROOT, 'cli', 'website', '.champollion-content.lock');
const I18N_BLOCKS = process.env.CHAMPOLLION_I18N_PARITY === 'block';

// Pages whose mirrors are safe to scan by numeral: the count-bearing pages
// that carry ONLY register-checked figures. Every entry must also be a
// check-6 site (asserted below) so the two lists cannot silently diverge.
// mt-field-briefing.md is deliberately absent — it is a check-6 site, but its
// prose also carries model sizes and corpus counts whose digits collide.
const I18N_SCANNED_PAGES = [
  'network/intro.md',
  'network/how-it-works.md',
  'network/getting-started/agent-guide.md',
  'network/community/low-resource-languages.md',
];

// Figures retired from English that must never reappear in a CURRENT mirror.
// Separators cover the locale forms actually in the tree: 1,300 / 1.300 /
// 1 300 (incl. NBSP + narrow NBSP).
//
// CJK magnitude suffixes are excluded from the bare-130 ban: "1.3M sentence
// pairs" legitimately renders as 130万 (ja/zh) / 130만 (ko) — a CORRECT
// figure that merely shares digits with the retired count. This is exactly
// the "13B → 130億" collision the header comment predicted; the ban now
// requires the digits to stand alone, not lead a myriad/hundred-million
// numeral (万/萬/亿/億/억/만).
const RETIRED_LOCALE_FIGURES = [
  [/(?<!\d)130(?!\d)(?![\s  ]?[万萬亿億억만])/g, `the pre-2026-07-22 Google Translate count (register says ${providerCounts['google-translate']})`],
  [/(?<!\d)1[,.    ]300(?!\d)/g, 'the retired "~1,300 at OMT-1600\'s lowest resource tiers" figure — the paper publishes no per-language tier table; the long-tail figure is ~1,200, marked as our arithmetic'],
];

const check6Pages = new Set(PROVIDER_COUNT_SITES.map(([rel]) => rel));
for (const rel of I18N_SCANNED_PAGES) {
  if (!check6Pages.has(rel)) {
    bad(`I18N_SCANNED_PAGES lists docs/${rel}, which is not a check-6 provider-count site — the two registries drifted; reconcile them`);
  }
}

let contentLock = null;
try {
  contentLock = JSON.parse(fs.readFileSync(CONTENT_LOCK, 'utf-8'));
} catch (err) {
  notes.push(`.champollion-content.lock unreadable (${err.message}) — locale-mirror currency unverified`);
}

if (contentLock && fs.existsSync(I18N_DIR)) {
  const locales = fs.readdirSync(I18N_DIR, {withFileTypes: true})
    .filter((e) => e.isDirectory() && e.name !== 'en')
    .map((e) => e.name)
    .sort();

  let current = 0;
  let stale = 0;
  let absent = 0;
  const staleByPage = new Map();

  for (const rel of I18N_SCANNED_PAGES) {
    const srcPath = path.join(DOCS_DIR, rel);
    if (!fs.existsSync(srcPath)) continue; // check 6 already reported it
    const srcHash = sha256(fs.readFileSync(srcPath, 'utf-8'));

    for (const locale of locales) {
      const mirror = path.join(I18N_DIR, locale, 'docusaurus-plugin-content-docs', 'current', rel);
      if (!fs.existsSync(mirror)) { absent++; continue; }

      if (contentLock[`docusaurus:docs/${rel}:${locale}`] !== srcHash) {
        stale++;
        staleByPage.set(rel, (staleByPage.get(rel) || 0) + 1);
        continue; // pending a sync — its figures are not claimed to be current
      }

      current++;
      const text = fs.readFileSync(mirror, 'utf-8');
      for (const [pattern, why] of RETIRED_LOCALE_FIGURES) {
        const hits = [...text.matchAll(pattern)];
        if (hits.length > 0) {
          bad(`i18n/${locale}/…/${rel} is CURRENT per the content lock but still carries ${why} (${hits.length} occurrence(s)) — the translation disagrees with its own source`);
        }
      }
    }
  }

  if (absent > 0) notes.push(`${absent} locale mirror(s) of count-bearing pages do not exist yet — never translated`);
  if (stale > 0) {
    const worst = [...staleByPage].sort((a, b) => b[1] - a[1])
      .map(([rel, n]) => `${rel} ×${n}`).join(', ');
    const msg = `${stale} of ${stale + current} locale mirror(s) of count-bearing pages are STALE against their English source `
      + `(${worst}) — their figures are NOT guaranteed to match the register. Clear with \`champollion sync\` in cli/website `
      + `(a paid run: \`champollion sync --dry\` prices it), then set CHAMPOLLION_I18N_PARITY=block to make this a hard gate.`;
    if (I18N_BLOCKS) bad(msg); else notes.push(msg);
  }
  if (current > 0) {
    ok(`${current} current locale mirror(s) of count-bearing pages carry no retired figures`);
  }
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

for (const n of notes) console.log(`  ℹ ${n}`);
if (problems.length > 0) {
  console.error(`\n✗ prose counts ↔ SSOT PARITY FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nFix the prose to match the machine SSOTs (shared/licenses.json, the card SSOT, graph-poster.json, shared/catalogue/method-coverage.json)');
  console.error('— or, if a surface legitimately moved, update cli/scripts/check-prose-counts-parity.mjs WITH it.');
  process.exit(3);
}
ok(`LICENSING.md rollup matches the register (${counts.total} sources; flags nc=${flagged.nc.length} sa=${flagged.sa.length} noredist=${flagged.noRedist.length})`);
ok(`floor claims hold (signed languages: ${signedCount} in ${cardCount} cards)`);
ok(`social-card SVG figure matches the card SSOT (${cardCount})`);
ok(`per-provider coverage counts in docs prose match method-coverage.json (${PROVIDER_COUNT_SITES.length} registered sites; google=${providerCounts['google-translate']} microsoft=${providerCounts['microsoft-translator']} deepl=${providerCounts.deepl} nllb=${providerCounts.nllb} translated=${providerCounts.translated})`);
console.log(`✓ prose counts match the machine SSOTs`);
