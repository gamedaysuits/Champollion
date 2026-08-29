#!/usr/bin/env node

/**
 * Batch CLDF Dataset Downloader + Ingester
 *
 * Downloads CLDF data files from GitHub repos across multiple orgs
 * (lexibank, cldf-datasets) and ingests them via the universal
 * CLDF ingester (ingest-cldf.mjs).
 *
 * Tries main/master branches. Downloads forms.csv, values.csv,
 * languages.csv, parameters.csv, and metadata files.
 *
 * Usage:
 *   node scripts/batch-ingest-zenodo.mjs                # Full run
 *   node scripts/batch-ingest-zenodo.mjs --dry-run      # Preview
 *   node scripts/batch-ingest-zenodo.mjs --org lexibank  # Single org
 *
 * @see https://github.com/lexibank
 * @see https://github.com/cldf-datasets
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDatabase } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, org: null, verbose: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': opts.dryRun = true; break;
      case '--org': opts.org = args[++i]; break;
      case '--verbose': opts.verbose = true; break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// REPOS REGISTRY
// ---------------------------------------------------------------------------

/**
 * Datasets we've already ingested — skip these.
 * Kept as a Set for O(1) lookup.
 */
const ALREADY_INGESTED = new Set([
  // ── Original 33 sources ──
  'abvd', 'acd', 'afbo', 'apics', 'asjp', 'autotyp', 'bowernpny',
  'clics', 'crossandean', 'diacl', 'doreco', 'dplace', 'elcat', 'ewave',
  'grambank', 'huntergatherer', 'ids', 'northeuralex', 'numeralbank',
  'papuanvoices', 'phoible', 'sagartst', 'sails', 'saphon', 'segbo',
  'tonodb', 'uralex', 'uratyp', 'vanuatuvoices', 'wacl', 'wals', 'wold',
  'beidasinitic', 'concepticon', 'valpal', 'languageatlasofthepacificarea',
  // ── Batch 1 (113 repos) ──
  'davletshinaztecan','oskolskayatungusic','constenlachibchan','peirosaustroasiatic',
  'felekesemitic','ratcliffearabic','iecor','nls','pachechibchan','ideobank',
  'kitchensemitic','mattercariban','northperulex','walworthpolynesian','khalidasur',
  'chacontukanoan','walkerarawakan','lundgrenomagoa','savelyevturkic','robinsonap',
  'datsemshift','lairgyalrong','abvdoceanic','abvdphilippines','gerarditupi',
  'rutulbasiclexicon','transnewguineaorg','powerma','chaconcolumbian','cals',
  'leekoreanic','mcelhanonhuon','leeainu','lsi','deepadungpalaung','grollemundbantu',
  'csd','tuled','tppsr','utoaztecan','robbeetstriangulation','mcd','barlowkilliantomoip',
  'liunewari','barlowlote','smithborneo','johanssonsoundsymbolic','baf2',
  'mixtecansubgrouping','dhakalsouthwesttibetic','kraftchadic','duonglachi',
  'othanieljen','kleinewillinghoeferbikwinjen','berrywestpapuan','chacolanguages',
  'hantganbangime','lieberherrkhobwa','yanglalo','suntb','pharaocoracholaztecan',
  'nagarajakhasian','hsiuhmongmien','luangthongkumkaren','logos','leejaponic',
  'joophonosemantic','hubercolumbian','gravinachadic','alt','galuciotupi',
  'marrisonnaga','mannburmish','liljegrenhindukush','bendermicropower','mamtasouthasia',
  'magram','gramadapt','haspelmathindefpro','bonmannsymmetrical','sinnemakizeromarking',
  'siniticbetween','kortmannadverbial','gbabvd_vv','barlowhandandfive',
  'malchukovditransitives','gasttdir','dryerorder','nicholsdiversity','veselinovanegex',
  'reesinkgive','jacquesestimative','handschuhnames','barlownumeralsystems',
  'audersetinterrog','jipa','uclaphoneticslabarchive','teddi_sample','lapsyd','bdproto',
  'eurasianinventories','gata','glottolog-cldf','hueblerstability','crossandean_morphology',
  'tjukabodyparts','levshinadifferentialmarking','nts','andersonannotatedphoible',
  'tangclassifiers','normansinitic','easterdaysyllablestructure','petersonsouthasia',
  // ── Failed in batch 1 (no FormTable) ──
  'imtvault','tsezacp','biblesources','bowernpnygeo','chaomozhizhen',
  'rantanenurageo','lapollaqiang',
]);

/**
 * Repos to skip because they're tooling/meta, not data.
 */
const SKIP_REPOS = new Set([
  'pylexibank', 'pyetymdict', 'pytlopo', 'tlopo', 'lexibank-analysed',
  'cldf-datasets', 'cldf_meta', 'lgr', 'cookbook', 'template',
  'imtvault-legacy', 'autotypcldf', 'autotyp-cldf-v0.1', // dupes of autotyp
  'dplacetrees', // just phylogenetic trees, no language data
]);

// ---------------------------------------------------------------------------
// DOWNLOAD + INGEST
// ---------------------------------------------------------------------------

const CLDF_FILES = [
  'forms.csv', 'values.csv', 'languages.csv', 'parameters.csv',
  'contributions.csv', 'cognates.csv',
  'Wordlist-metadata.json', 'StructureDataset-metadata.json',
  'Generic-metadata.json', 'cldf-metadata.json',
];

/**
 * Attempt to download CLDF data files from GitHub.
 * Returns true if any data files were downloaded successfully.
 */
function downloadRepo(org, repo) {
  const dir = join(DATA_DIR, repo);
  const cldfDir = join(dir, 'cldf');
  mkdirSync(cldfDir, { recursive: true });

  let gotData = false;

  for (const branch of ['main', 'master']) {
    for (const file of CLDF_FILES) {
      const target = join(cldfDir, file);
      if (existsSync(target)) { gotData = true; continue; }

      const url = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/cldf/${file}`;
      try {
        execSync(`curl -sfL "${url}" -o "${target}"`, { timeout: 15000 });
        const size = parseInt(execSync(`wc -c < "${target}"`).toString().trim());
        if (size < 50) {
          execSync(`rm "${target}"`);
        } else {
          gotData = true;
        }
      } catch {
        try { execSync(`rm -f "${target}"`); } catch {}
      }
    }
    if (gotData) break;
  }

  return gotData;
}

/**
 * Ingest a downloaded repo via ingest-cldf.mjs.
 * Returns { success, newFacts }.
 */
function ingestRepo(repo) {
  try {
    const result = execSync(
      `node scripts/ingest-cldf.mjs --source ${repo}`,
      { timeout: 60000, cwd: join(__dirname, '..') }
    ).toString();

    const match = result.match(/Net new facts:\s+(\d[\d,]*)/);
    const newFacts = match ? parseInt(match[1].replace(/,/g, '')) : 0;
    return { success: true, newFacts };
  } catch (err) {
    return { success: false, newFacts: 0, error: err.message.slice(0, 100) };
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Batch CLDF Dataset Downloader + Ingester            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Fetch repos from GitHub orgs
  const orgs = opts.org ? [opts.org] : ['lexibank', 'cldf-datasets'];
  const allRepos = [];

  for (const org of orgs) {
    console.log(`\n  Fetching repos from ${org}...`);
    try {
      // Paginate through all pages (up to 300 repos per org)
      for (let page = 1; page <= 3; page++) {
        const raw = execSync(
          `curl -sL "https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated&page=${page}"`,
          { timeout: 15000 }
        ).toString();
        const repos = JSON.parse(raw);
        if (repos.length === 0) break;
        for (const r of repos) {
          const name = r.name;
          if (ALREADY_INGESTED.has(name.toLowerCase())) continue;
          if (SKIP_REPOS.has(name.toLowerCase())) continue;
          if (name.startsWith('.')) continue;
          allRepos.push({ org, name });
        }
      }
    } catch (err) {
      console.error(`  Error fetching ${org}: ${err.message}`);
    }
  }

  console.log(`\n  Total repos to process: ${allRepos.length}`);

  const db = openDatabase();
  const factsBefore = db._stmts.countFacts.get().count;

  let downloaded = 0;
  let ingested = 0;
  let failed = [];
  let totalNewFacts = 0;

  for (const { org, name } of allRepos) {
    if (opts.verbose) console.log(`\n  Processing ${org}/${name}...`);

    // Download
    const gotData = downloadRepo(org, name);
    if (!gotData) {
      if (opts.verbose) console.log(`    ✗ No CLDF data found`);
      continue;
    }
    downloaded++;

    if (opts.dryRun) {
      console.log(`  📥 ${org}/${name} — downloaded (dry run, not ingesting)`);
      continue;
    }

    // Ingest
    const result = ingestRepo(name);
    if (result.success && result.newFacts > 0) {
      console.log(`  ✅ ${name}: +${result.newFacts.toLocaleString()} facts`);
      ingested++;
      totalNewFacts += result.newFacts;
    } else if (result.success) {
      if (opts.verbose) console.log(`    ✓ ${name}: 0 new facts (all duplicates)`);
    } else {
      failed.push(name);
      if (opts.verbose) console.log(`    ⚠️ ${name}: ${result.error}`);
    }
  }

  const factsAfter = opts.dryRun ? factsBefore : db._stmts.countFacts.get().count;

  console.log('\n── Results ──');
  console.log(`  Repos processed:   ${allRepos.length}`);
  console.log(`  Downloaded:        ${downloaded}`);
  console.log(`  Successfully ingested: ${ingested}`);
  console.log(`  Failed:            ${failed.length}`);
  console.log(`  Total new facts:   ${totalNewFacts.toLocaleString()}`);
  console.log(`  DB facts before:   ${factsBefore.toLocaleString()}`);
  console.log(`  DB facts after:    ${factsAfter.toLocaleString()}`);
  console.log(`  Net new:           ${(factsAfter - factsBefore).toLocaleString()}`);
  if (failed.length > 0) {
    console.log(`  Failed repos: ${failed.join(', ')}`);
  }
  console.log('\n  ✅ Done');

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
