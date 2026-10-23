#!/usr/bin/env node

/**
 * harvest-zenodo-cldf.mjs — fetch AUTHORITATIVE licence records from Zenodo.
 *
 * WHY THIS EXISTS
 *   The licence register was 3.6% verified. 212 of 333 entries were written by
 *   cli/scripts/populate-licenses.mjs::toSpdx(), a chain of String.includes()
 *   that fabricates version numbers (any BY-NC URL became "4.0", so datasets
 *   licensed BY-NC-2.0 are recorded as 4.0), passes raw strings through as SPDX
 *   ("CC"), and grants redistribution by default via
 *   `redistribution: !s.includes('PROPRIETARY')`. 15 more — Glottolog, Wikidata,
 *   WALS, Grambank, CLDR, our highest-traffic sources — have blank notes.
 *
 *   And none of the evidence was in git: zero upstream LICENSE files, zero CLDF
 *   metadata tracked. No claim in shared/licenses.json could be re-derived from
 *   the repository.
 *
 *   The CLDF ecosystem publishes to Zenodo, and a Zenodo record carries what we
 *   need as DATA rather than as a guess:
 *
 *     metadata.license.id   → the licence the depositor declared
 *     doi + conceptdoi      → a real version pin (GitHub `main` is not pinnable)
 *     metadata.version      → the released version string
 *     files[].checksum      → integrity, which the current curl path lacks
 *     creators, publication_date, title → the citation fields currently hand-typed
 *
 *   So this replaces guessing with retrieval, and its output is TRACKED: the
 *   harvested records ARE the evidence chain (plan A1), which is what makes
 *   every downstream licence claim re-checkable by someone who is not us.
 *
 * WHAT IT DOES NOT DO
 *   It does not decide anything. A Zenodo licence id we do not recognise is
 *   reported as `needsReview`, never mapped by resemblance — importing a
 *   second guessing layer to replace the first would be the same bug wearing a
 *   better hat. Mapping is an explicit table below; extending it is a
 *   deliberate, reviewable act.
 *
 * USAGE
 *   node cli/scripts/harvest-zenodo-cldf.mjs                 # harvest + write
 *   node cli/scripts/harvest-zenodo-cldf.mjs --check         # verify tracked copy is current
 *   node cli/scripts/harvest-zenodo-cldf.mjs --community X   # one community
 *
 * Exit: 0 ok · 1 could not run · 3 drift (with --check)
 *
 * @see shared/licenses.json
 * @see cli/scripts/populate-licenses.mjs  (the guessing this supersedes)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

export const source = 'zenodo-harvest';
export const dir = 'zenodo-harvest';

/**
 * What this source contributes, declared beside how it is fetched.
 *
 * It is not a dataset. It is the INDEX that turns a source name into a DOI, and
 * every CLDF pin in the atlas is exactly as current as the last time this ran.
 */
export const manifest = {
  module: '(index)',
  handler: null,
  license: 'LicenseRef-Zenodo-Record-Metadata',
  contributes: 'which release of each CLDF dataset is current upstream',
  // 16 requests and about half a minute. Cheap enough to re-ask weekly against
  // catalogues that publish continuously; not so cheap it should be unthrottled.
  refreshDays: 7,
  note:
    'The index, not a dataset — nothing is ingested from it. It resolves each CLDF '
    + "dataset's CURRENT release, which is what makes staleness detectable at all: a "
    + 'CLDF pin is a DOI and therefore immutable, so the question is never "have the '
    + 'bytes changed" but "is there a newer version". Until this became a source, '
    + 'nothing ran it and nothing recorded when it last ran, so 169 of 189 sources '
    + 'could have gone a year behind with no signal anywhere.',
};

const FILE = 'records.json';
const OUT = path.join(DATA_DIR, dir, FILE);

// The CLDF ecosystem's Zenodo communities. lexibank and cldf-datasets carry the
// bulk of what cli/data/ mirrors; clld and dictionaria carry the rest.
const COMMUNITIES = ['lexibank', 'cldf-datasets', 'clld', 'dictionaria'];

// Zenodo caps unauthenticated page size at 25 ("Please use authenticated
// requests to increase the limit to 100"). Anything larger is a hard 400, so
// this is the ceiling, not a preference.
// Count of non-dataset records skipped (software serving the data, not the data).
let skippedSoftware = 0;

const PAGE_SIZE = 25;
const UA = 'champollion-license-audit (https://champollion.dev)';

/**
 * Zenodo licence id → canonical SPDX.
 *
 * EXPLICIT, not derived. Zenodo ids are lowercase and mostly SPDX-shaped, so a
 * `.toUpperCase()` would appear to work — and would silently mint plausible
 * wrong answers for anything irregular, which is precisely how toSpdx() put
 * fabricated versions into the register. Anything absent here is surfaced for
 * review rather than guessed.
 */
const ZENODO_TO_SPDX = {
  'cc-by-4.0': 'CC-BY-4.0',
  'cc-by-3.0': 'CC-BY-3.0',
  'cc-by-2.0': 'CC-BY-2.0',
  'cc-by-sa-4.0': 'CC-BY-SA-4.0',
  'cc-by-sa-3.0': 'CC-BY-SA-3.0',
  'cc-by-nc-4.0': 'CC-BY-NC-4.0',
  'cc-by-nc-3.0': 'CC-BY-NC-3.0',
  'cc-by-nc-2.0': 'CC-BY-NC-2.0',
  'cc-by-nc-sa-4.0': 'CC-BY-NC-SA-4.0',
  'cc-by-nc-sa-3.0': 'CC-BY-NC-SA-3.0',
  'cc-by-nc-sa-2.0': 'CC-BY-NC-SA-2.0',
  // The ND family, all versions. Omitting cc-by-nc-nd-2.0 here left `nts`
  // unmapped, so its NoDerivatives clause fell out of the evidence chain and
  // the weaker CLDF reading (CC-BY-NC-2.0) won by default — reproducing, in a
  // new place, the exact clause-loss this whole pass exists to remove.
  'cc-by-nc-nd-4.0': 'CC-BY-NC-ND-4.0',
  'cc-by-nc-nd-3.0': 'CC-BY-NC-ND-3.0',
  'cc-by-nc-nd-2.0': 'CC-BY-NC-ND-2.0',
  'cc-by-nd-4.0': 'CC-BY-ND-4.0',
  'cc-by-nd-3.0': 'CC-BY-ND-3.0',
  'cc-by-nd-2.0': 'CC-BY-ND-2.0',
  'cc-zero': 'CC0-1.0',
  'cc0-1.0': 'CC0-1.0',
  // Zenodo legacy ids for licences that are otherwise unambiguous.
  'mit': 'MIT',
  'mit-license': 'MIT',
  'apache-2.0': 'Apache-2.0',
  'apache2.0': 'Apache-2.0',
  'gpl-3.0-only': 'GPL-3.0-only',
  'gpl-3.0-or-later': 'GPL-3.0-or-later',
  'gpl-3.0': 'GPL-3.0-only',
  'agpl-3.0-only': 'AGPL-3.0-only',
  'agpl-3.0-or-later': 'AGPL-3.0-or-later',
  'lgpl-3.0-only': 'LGPL-3.0-only',
  'bsd-3-clause': 'BSD-3-Clause',
  'bsd-2-clause': 'BSD-2-Clause',
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
};
const CHECK = process.argv.includes('--check');

async function fetchPage(community, page) {
  const url = `https://zenodo.org/api/records?communities=${encodeURIComponent(community)}`
    + `&size=${PAGE_SIZE}&page=${page}&sort=mostrecent`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Zenodo ${res.status} for ${community} p${page}`);
  return res.json();
}

/**
 * Derive the source key this record corresponds to in our register.
 *
 * The file key is the reliable signal — `lexibank/mixezoqueanvoices-v2.0.1.zip`
 * names the dataset directly. The GitHub related-identifier is the fallback.
 * Returns null rather than a guess when neither is conclusive; an unmatched
 * record is reported, not silently dropped.
 */
function deriveSourceKey(record) {
  for (const f of record.files || []) {
    const key = f.key || '';
    const base = key.split('/').pop() || '';
    const m = /^([A-Za-z0-9._-]+?)-v?\d[\d.]*(?:[a-z\d.-]*)?\.(zip|tar\.gz|tgz)$/.exec(base);
    if (m) return m[1].toLowerCase();
  }
  for (const rel of record.metadata?.related_identifiers || []) {
    const id = rel.identifier || '';
    const m = /github\.com\/[^/]+\/([^/\s]+)/.exec(id);
    if (m) return m[1].replace(/\.git$/, '').toLowerCase();
  }
  return null;
}

/**
 * Is this record the DATASET, or the software that serves it?
 *
 * The CLDF communities hold both. `clld/clics` is the web application that
 * serves CLICS; the colexification data our cards cite is `clics3`. Attaching
 * an app's licence to a dataset is exactly the mistake already recorded against
 * `moli-mandala` in the register — "this is the project website, not
 * necessarily the dataset" — and it is how a permissive code licence ends up
 * standing in for data terms that may be nothing like it.
 *
 * Zenodo states the type, so we read it rather than inferring from the name.
 */
function isDatasetRecord(record) {
  const t = record.metadata?.resource_type?.type;
  return t === 'dataset' || t === undefined;   // undefined: older records, keep + let review catch it
}

function normaliseRecord(record, community) {
  const m = record.metadata || {};
  const rawLicense = typeof m.license === 'string'
    ? m.license
    : (m.license?.id ?? m.license?.identifier ?? null);
  const zenodoId = rawLicense ? String(rawLicense).toLowerCase() : null;
  const spdx = zenodoId ? (ZENODO_TO_SPDX[zenodoId] ?? null) : null;

  return {
    sourceKey: deriveSourceKey(record),
    community,
    title: m.title || null,
    doi: record.doi || m.doi || null,
    conceptDoi: record.conceptdoi || m.conceptdoi || null,
    version: m.version || null,
    publicationDate: m.publication_date || null,
    license: {
      zenodoId,
      spdx,
      // The one thing this harvester must never do is invent an answer.
      needsReview: !!zenodoId && !spdx,
      absent: !zenodoId,
    },
    creators: (m.creators || []).map((c) => c.name).filter(Boolean),
    files: (record.files || []).map((f) => ({
      key: f.key, size: f.size, checksum: f.checksum,
    })),
    recordUrl: record.links?.self_html || record.links?.html || null,
  };
}

async function harvest(communities) {
  const out = [];
  skippedSoftware = 0;
  for (const community of communities) {
    let page = 1;
    let total = null;
    for (;;) {
      const body = await fetchPage(community, page);
      const hits = body.hits?.hits || [];
      if (total === null) {
        total = body.hits?.total ?? 0;
        console.log(`  ${community}: ${total} record(s)`);
      }
      for (const r of hits) {
        if (!isDatasetRecord(r)) { skippedSoftware += 1; continue; }
        out.push(normaliseRecord(r, community));
      }
      if (hits.length < PAGE_SIZE || out.length >= 10000) break;
      page += 1;
      // Be a polite API client; Zenodo is a public good.
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return out;
}

function buildDocument(records, { communities, mergeInto = null }) {
  // Keep the newest record per sourceKey — a dataset publishes many versions,
  // and the register needs one current answer plus a pinned DOI to reach it.
  const bySource = new Map();
  // A --community run harvests a SUBSET. Rebuilding `sources` from it alone
  // silently deleted the other ~67 entries while stamping all four communities
  // in the provenance block. Seeding from what is already on disk makes a
  // partial harvest an UPDATE rather than a truncation.
  if (mergeInto) {
    for (const [k, v] of Object.entries(mergeInto)) bySource.set(k, v);
  }
  for (const r of records) {
    if (!r.sourceKey) continue;
    const prev = bySource.get(r.sourceKey);
    if (!prev || (r.publicationDate || '') > (prev.publicationDate || '')) {
      bySource.set(r.sourceKey, r);
    }
  }
  const sources = {};
  for (const [k, v] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) sources[k] = v;

  const unmatched = records.filter((r) => !r.sourceKey).length;
  const needsReview = Object.values(sources).filter((r) => r.license.needsReview);
  const noLicense = Object.values(sources).filter((r) => r.license.absent);

  return {
    _generated: {
      by: 'cli/scripts/harvest-zenodo-cldf.mjs',
      note: 'AUTHORITATIVE licence evidence fetched from Zenodo. Tracked on purpose: '
        + 'this is the record that makes every downstream licence claim re-checkable. '
        + 'Do not hand-edit — re-run the harvester.',
      // What was ACTUALLY harvested, not the module constant. Writing the full
      // list after a --community run made the provenance block claim coverage
      // the run did not have.
      communities,
      // Without this nothing can be called stale, and `git log` was the only way
      // to find out how old the pins were.
      harvestedAt: new Date().toISOString(),
      counts: {
        recordsFetched: records.length,
        distinctSources: Object.keys(sources).length,
        unmatchedRecords: unmatched,
        licenseNeedsReview: needsReview.length,
        licenseAbsent: noLicense.length,
      },
    },
    sources,
  };
}

async function main() {
  const one = arg('--community');
  const communities = one ? [one] : COMMUNITIES;

  console.log('Harvesting Zenodo CLDF licence records…');
  let records;
  try {
    records = await harvest(communities);
  } catch (err) {
    console.error(`harvest-zenodo-cldf: could not reach Zenodo — ${err.message}`);
    return 1;
  }

  const onDisk = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf-8')) : null;
  const doc = buildDocument(records, {
    communities,
    mergeInto: one ? onDisk?.sources ?? null : null,
  });
  const text = JSON.stringify(doc, null, 2) + '\n';
  const c = doc._generated.counts;

  console.log(`\n  ${c.recordsFetched} record(s) → ${c.distinctSources} distinct source(s)`);
  if (skippedSoftware) {
    console.log(`  ${skippedSoftware} software record(s) skipped — an app's licence is not its dataset's licence`);
  }
  if (c.unmatchedRecords) console.log(`  ${c.unmatchedRecords} record(s) could not be matched to a source key`);
  if (c.licenseNeedsReview) {
    console.log(`\n  ⚠ ${c.licenseNeedsReview} licence id(s) not in the SPDX map — REVIEW, do not guess:`);
    for (const r of Object.values(doc.sources).filter((x) => x.license.needsReview)) {
      console.log(`      ${r.sourceKey.padEnd(30)} zenodo id: ${r.license.zenodoId}`);
    }
  }
  if (c.licenseAbsent) {
    console.log(`\n  ⚠ ${c.licenseAbsent} record(s) declare NO licence:`);
    for (const r of Object.values(doc.sources).filter((x) => x.license.absent).slice(0, 20)) {
      console.log(`      ${r.sourceKey.padEnd(30)} ${r.recordUrl || ''}`);
    }
  }

  if (CHECK) {
    if (!onDisk) {
      console.error(`\n${FILE} missing — run the harvester`);
      return 3;
    }
    const same = JSON.stringify(onDisk.sources) === JSON.stringify(doc.sources);
    if (!same) {
      console.error('\n✗ tracked Zenodo records are STALE vs upstream — re-run the harvester');
      return 3;
    }
    console.log('\n✓ tracked Zenodo licence records are current');
    return 0;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);

  // A SNAPSHOT so `--verify` re-hashes this like any other source. It had none,
  // which meant the index every CLDF pin depends on was the one file nothing
  // checked.
  writeSnapshot(dir, {
    source,
    upstream: `https://zenodo.org/api/records?communities=${communities.join('|')}`,
    license: 'LicenseRef-Zenodo-Record-Metadata',
    licenseUrl: 'https://about.zenodo.org/terms/',
    citation: `Zenodo community record metadata for ${communities.join(', ')}, `
      + `retrieved ${doc._generated.harvestedAt.slice(0, 10)}.`,
    pin: {
      kind: 'release',
      value: doc._generated.harvestedAt.slice(0, 10),
      doi: null,
      date: doc._generated.harvestedAt.slice(0, 10),
    },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(OUT).size,
      sha256: sha256File(OUT),
      url: 'https://zenodo.org/api/records',
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/zenodo-harvest.mjs',
    notes:
      `${c.distinctSources} distinct CLDF sources across ${communities.join(', ')}. `
      + 'THE INDEX, NOT A DATASET: nothing is ingested from it. It resolves which release '
      + "of each CLDF dataset is CURRENT upstream, which is the only way staleness is "
      + 'detectable at all — a CLDF pin is a DOI and therefore immutable, so the question '
      + 'is never "have the bytes changed" but "is there a newer version". '
      + `${c.licenseNeedsReview} licence id(s) are not in the SPDX map and are recorded as `
      + 'needing review rather than guessed.',
    distinctSources: c.distinctSources,
    communities,
  });
  console.log(`\nwrote ${path.relative(path.join(__dirname, '..', '..', '..'), OUT)}`);
  return 0;
}

/**
 * The standard fetcher interface.
 *
 * This module was a hand-run script for its whole life, so `--fetch`, `--verify`
 * and audit-sources.mjs all skipped it — and it is the index every CLDF pin
 * resolves through. Nothing recorded when it last ran, so 169 of 189 sources
 * could have drifted a year behind their upstreams with no signal anywhere.
 */
export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);
  const code = await main();
  if (code !== 0) throw new Error(`Zenodo harvest failed (exit ${code})`);
  return { verified: true, files: 1 };
}

// pathToFileURL, not string concatenation: this repo's path contains a space,
// which argv[1] carries raw while import.meta.url percent-encodes — the naive
// comparison never matched here and the CLI was a silent no-op.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
