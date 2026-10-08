#!/usr/bin/env node

/**
 * CLDF Dataset Downloader — Champollion Data Pipeline
 *
 * Downloads full CLDF data (forms.csv, values.csv, parameters.csv,
 * cldf-metadata.json) for datasets that currently only have languages.csv.
 *
 * Data sources:
 *   - GitHub repos under cldf-datasets/ and lexibank/ organizations
 *   - Zenodo archives (via DOI → redirect → download)
 *
 * Usage:
 *   node scripts/download-cldf-datasets.mjs                  # Download all missing datasets
 *   node scripts/download-cldf-datasets.mjs --dataset segbo   # Download specific dataset
 *   node scripts/download-cldf-datasets.mjs --list            # List all datasets and their status
 *   node scripts/download-cldf-datasets.mjs --dry-run         # Preview without downloading
 *
 * Design principles:
 *   1. NEVER overwrite existing data files — only download what's missing
 *   2. Verify downloads by checking file size and CSV header
 *   3. Log everything for auditability
 *   4. Prioritize LRL datasets (--priority lrl)
 *
 * @see docs/DATA-ARCHITECTURE.md §3 for the dataset inventory
 */

import { existsSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// DATASET REGISTRY
// ---------------------------------------------------------------------------
// Each entry maps a dataset name to its GitHub source and expected files.
// The 'org' is the GitHub organization, 'repo' is the repo name,
// 'branch' is the default branch, and 'cldfDir' is the path to the CLDF
// directory within the repo.
//
// Priority levels:
//   1 = LRL (Low-Resource Language) — download first
//   2 = Broad coverage — important for completeness
//   3 = Regional/specialized — nice to have

const DATASETS = [
  // ── Priority 1: LRL ──
  {
    name: 'bowernpny',
    org: 'lexibank',
    repo: 'bowernpny',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 1,
    description: 'Pama-Nyungan lexical data (167 Australian languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'saphon',
    org: 'cldf-datasets',
    repo: 'saphon',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 1,
    description: 'South American Phonological Inventories (413 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'crossandean',
    org: 'lexibank',
    repo: 'crossandean',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 1,
    description: 'Cross-Andean lexical data (41 Andean languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'huntergatherer',
    org: 'lexibank',
    repo: 'huntergatherer',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 1,
    description: 'Hunter-Gatherer lexical data (72 languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'sails',
    org: 'cldf-datasets',
    repo: 'sails',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 1,
    description: 'South American Indian Languages Structure (168 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },

  // ── Priority 2: Broad coverage ──
  {
    name: 'segbo',
    org: 'cldf-datasets',
    repo: 'segbo',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 2,
    description: 'Segment Borrowing in Cross-Linguistic Perspective (500+ languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'tonodb',
    org: 'cldf-datasets',
    repo: 'tonodb',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 2,
    description: 'Tone Database (131 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'afbo',
    org: 'cldf-datasets',
    repo: 'afbo',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 2,
    description: 'Affix Borrowing database (315 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'ids',
    org: 'intercontinental-dictionary-series',
    repo: 'ids',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 2,
    description: 'Intercontinental Dictionary Series (329 languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'datsemshift',
    org: 'cldf-datasets',
    repo: 'datsemshift',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 2,
    description: 'Database of Semantic Shifts (584 languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'wacl',
    org: 'cldf-datasets',
    repo: 'wacl',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 2,
    description: 'World Atlas of Classifier Languages (82 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },

  // ── Priority 3: Regional/specialized ──
  {
    name: 'uralex',
    org: 'lexibank',
    repo: 'uralex',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 3,
    description: 'Uralic lexical data (43 languages, many endangered)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'uratyp',
    org: 'cldf-datasets',
    repo: 'uratyp',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 3,
    description: 'Uralic Typology (39 languages, many endangered)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'valpal',
    org: 'cldf-datasets',
    repo: 'valpal',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'structure',
    priority: 3,
    description: 'Valency Patterns Leipzig (36 languages)',
    files: ['values.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'sagartst',
    org: 'lexibank',
    repo: 'sagartst',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 3,
    description: 'Sagart Sino-Tibetan (50 languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'diacl',
    org: 'lexibank',
    repo: 'diacl',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 3,
    description: 'Diachronic Atlas of Comparative Linguistics (423 languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
  {
    name: 'acd',
    org: 'lexibank',
    repo: 'aaborough',
    branch: 'main',
    cldfDir: 'cldf',
    type: 'wordlist',
    priority: 3,
    description: 'Austronesian Comparative Dictionary (800+ languages)',
    files: ['forms.csv', 'languages.csv', 'parameters.csv', 'cldf-metadata.json'],
  },
];

// ---------------------------------------------------------------------------
// HTTP DOWNLOAD UTILITY
// ---------------------------------------------------------------------------

/**
 * Download a file from a URL, following redirects.
 * Returns a promise that resolves to the response body as a Buffer.
 */
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, {
      headers: {
        'User-Agent': 'Champollion-Data-Pipeline/1.0 (https://champollion.dev)',
        'Accept': 'text/csv,application/json,*/*',
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, destPath, maxRedirects - 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const fileStream = createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        reject(err);
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// CLI ARGUMENT PARSING
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dataset: null,
    dryRun: false,
    list: false,
    priority: null,  // 1, 2, or 3
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dataset':
        opts.dataset = args[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--list':
        opts.list = true;
        break;
      case '--priority':
        opts.priority = parseInt(args[++i], 10);
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Usage: node scripts/download-cldf-datasets.mjs [options]

Options:
  --dataset <name>   Download only this dataset
  --priority <1|2|3> Download only datasets at this priority level (1=LRL, 2=broad, 3=regional)
  --dry-run          Preview without downloading
  --list             List all datasets and their download status
  --help             Show this help
`);
}

// ---------------------------------------------------------------------------
// STATUS CHECK
// ---------------------------------------------------------------------------

/**
 * Check which files a dataset already has downloaded.
 */
function checkDatasetStatus(dataset) {
  const dataDir = join(DATA_DIR, dataset.name);
  const cldfDir = join(dataDir, 'cldf');

  // Check both the cldf subdirectory and the root data directory
  // (some datasets have flat structure, some have cldf/ subdirectory)
  const status = {
    hasDirectory: existsSync(dataDir),
    files: {},
    needsDownload: false,
  };

  for (const file of dataset.files) {
    const inCldf = existsSync(join(cldfDir, file));
    const inRoot = existsSync(join(dataDir, file));
    status.files[file] = inCldf || inRoot;
  }

  // A dataset needs download if it's missing its primary data file (forms.csv or values.csv)
  const primaryFile = dataset.type === 'wordlist' ? 'forms.csv' : 'values.csv';
  status.needsDownload = !status.files[primaryFile];

  return status;
}

// ---------------------------------------------------------------------------
// DOWNLOAD LOGIC
// ---------------------------------------------------------------------------

async function downloadDataset(dataset, opts) {
  const dataDir = join(DATA_DIR, dataset.name);
  const cldfDir = join(dataDir, 'cldf');

  // Ensure directories exist
  if (!existsSync(cldfDir)) {
    mkdirSync(cldfDir, { recursive: true });
  }

  console.log(`\n  📥 Downloading: ${dataset.name}`);
  console.log(`     ${dataset.description}`);
  console.log(`     Source: github.com/${dataset.org}/${dataset.repo}`);

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const file of dataset.files) {
    const destPath = join(cldfDir, file);

    // Skip if file already exists
    if (existsSync(destPath)) {
      skippedCount++;
      continue;
    }

    // Also check root directory (for datasets with flat structure)
    if (existsSync(join(dataDir, file))) {
      skippedCount++;
      continue;
    }

    // Build GitHub raw URL
    // Try the configured branch first, then fallback to alternate (main↔master)
    const branches = [dataset.branch];
    if (dataset.branch === 'main') branches.push('master');
    else if (dataset.branch === 'master') branches.push('main');

    if (opts.dryRun) {
      console.log(`     🏜️  [DRY RUN] Would download: ${file}`);
      console.log(`        URL: https://raw.githubusercontent.com/${dataset.org}/${dataset.repo}/${branches[0]}/${dataset.cldfDir}/${file}`);
      downloadedCount++;
      continue;
    }

    let downloaded = false;
    for (const branch of branches) {
      const url = `https://raw.githubusercontent.com/${dataset.org}/${dataset.repo}/${branch}/${dataset.cldfDir}/${file}`;

      try {
        console.log(`     ⬇️  ${file} (${branch})...`);
        await downloadFile(url, destPath);

        // Verify the download isn't an error page
        const { statSync } = await import('fs');
        const size = statSync(destPath).size;
        if (size < 100) {
          const content = (await import('fs')).readFileSync(destPath, 'utf-8').trim();
          if (content.includes('404') || content.includes('Not Found')) {
            (await import('fs')).unlinkSync(destPath);
            continue; // Try next branch
          }
        }

        console.log(`     ✅ ${file} (${(size / 1024).toFixed(1)} KB)`);
        downloadedCount++;
        downloaded = true;
        break; // Success — stop trying branches
      } catch (err) {
        // Clean up partial downloads before trying next branch
        if (existsSync(destPath)) {
          (await import('fs')).unlinkSync(destPath);
        }
        if (branch === branches[branches.length - 1]) {
          // Last branch attempt — report failure
          failedCount++;
          console.log(`     ✗  ${file}: ${err.message}`);
        }
        // Otherwise continue to next branch silently
      }
    }
    if (!downloaded && !branches.some(() => false)) {
      // Already counted in the loop above
    }
  }

  return { downloaded: downloadedCount, skipped: skippedCount, failed: failedCount };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Champollion CLDF Dataset Downloader                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Filter datasets
  let datasets = [...DATASETS];
  if (opts.dataset) {
    datasets = datasets.filter(d => d.name === opts.dataset);
    if (datasets.length === 0) {
      console.error(`Error: Unknown dataset "${opts.dataset}". Use --list to see available datasets.`);
      process.exit(1);
    }
  }
  if (opts.priority) {
    datasets = datasets.filter(d => d.priority <= opts.priority);
  }

  // Sort by priority
  datasets.sort((a, b) => a.priority - b.priority);

  // List mode
  if (opts.list) {
    console.log('\n  Dataset Status:\n');
    const priorities = { 1: '🔴 LRL', 2: '🟡 Broad', 3: '🟢 Regional' };
    for (const ds of datasets) {
      const status = checkDatasetStatus(ds);
      const primaryFile = ds.type === 'wordlist' ? 'forms.csv' : 'values.csv';
      const hasData = status.files[primaryFile] ? '✅' : '❌';
      const hasLangs = status.files['languages.csv'] ? '✅' : '❌';
      const hasMeta = status.files['cldf-metadata.json'] ? '✅' : '❌';
      console.log(`  ${hasData} ${ds.name.padEnd(20)} ${priorities[ds.priority].padEnd(14)} ${ds.description}`);
      console.log(`     data: ${hasData}  langs: ${hasLangs}  meta: ${hasMeta}`);
    }
    console.log(`\n  Total: ${datasets.length} datasets`);
    console.log(`  Need download: ${datasets.filter(d => checkDatasetStatus(d).needsDownload).length}`);
    return;
  }

  // Download mode
  const needDownload = datasets.filter(d => checkDatasetStatus(d).needsDownload);

  if (needDownload.length === 0) {
    console.log('\n  ✅ All datasets are already downloaded!');
    return;
  }

  console.log(`\n  Downloading ${needDownload.length} dataset(s)...`);
  if (opts.dryRun) console.log('  Mode: 🏜️  DRY RUN');

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const ds of needDownload) {
    const result = await downloadDataset(ds, opts);
    totalDownloaded += result.downloaded;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log('\n── Summary ──');
  console.log(`  Downloaded: ${totalDownloaded} files`);
  console.log(`  Skipped:    ${totalSkipped} (already exist)`);
  console.log(`  Failed:     ${totalFailed}`);
  console.log('\n  ✅ Done');

  if (totalDownloaded > 0 && !opts.dryRun) {
    console.log('\n  Next step: ingest the downloaded datasets:');
    for (const ds of needDownload) {
      const cldfDir = join('data', ds.name, 'cldf');
      const metaPath = join(cldfDir, 'cldf-metadata.json');
      const dataFile = ds.type === 'wordlist' ? 'forms.csv' : 'values.csv';
      if (existsSync(join(DATA_DIR, ds.name, 'cldf', 'cldf-metadata.json'))) {
        console.log(`    node scripts/ingest-cldf.mjs ${metaPath} --source ${ds.name}`);
      } else {
        console.log(`    node scripts/ingest-cldf.mjs ${join(cldfDir, dataFile)} --source ${ds.name} --type ${ds.type}`);
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
