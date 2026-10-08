#!/usr/bin/env node

/**
 * download-enrichment-data.mjs — Phase 2: Download external data for enrichment
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Downloads external data sources needed by the enrichment pipeline.
 * Each source is independent — failures in one source won't block others.
 * All downloaded data is saved to cli/data/ for offline use by enrichment scripts.
 *
 * Sources (no authentication required):
 *   1. Wikipedia editions — Wikimedia SiteMatrix API
 *   2. Keyman keyboards   — Keyman Cloud API v4.0
 *   3. OPUS languages     — OPUS NLP API
 *   4. Lexibank languages — GitHub raw CSV (lexibank-analysed CLDF)
 *   5. ELCat languages    — GitHub raw CSV (Endangered Languages Catalogue)
 *   6. Universal Dependencies — GitHub API (paginated repo listing)
 *
 * Usage:
 *   node scripts/download-enrichment-data.mjs                    # all sources
 *   node scripts/download-enrichment-data.mjs --source wiki      # just Wikipedia
 *   node scripts/download-enrichment-data.mjs --source keyman    # just Keyman
 *   node scripts/download-enrichment-data.mjs --source opus      # just OPUS
 *   node scripts/download-enrichment-data.mjs --source lexibank  # just Lexibank
 *   node scripts/download-enrichment-data.mjs --source elcat     # just ELCat
 *   node scripts/download-enrichment-data.mjs --source ud        # just UD
 *   node scripts/download-enrichment-data.mjs --list             # show available sources
 *
 * Idempotent: Yes — overwrites previously downloaded data with fresh copies.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');

// ---------------------------------------------------------------------------
// HTTP helpers — using native https to avoid external dependencies.
// The pipeline policy (ENRICHMENT-PIPELINE.md) mandates zero runtime deps.
// ---------------------------------------------------------------------------

/**
 * Fetch a URL and return the response body as a string.
 * Follows up to 5 redirects (GitHub raw URLs often 302).
 *
 * @param {string} url - URL to fetch
 * @param {object} [options] - Extra options
 * @param {object} [options.headers] - Additional request headers
 * @param {number} [options.maxRedirects] - Max redirects to follow (default: 5)
 * @returns {Promise<{ body: string, statusCode: number, headers: object }>}
 */
function fetchUrl(url, options = {}) {
  const maxRedirects = options.maxRedirects ?? 5;

  return new Promise((resolve, reject) => {
    const requestHeaders = {
      'User-Agent': 'Champollion-Enrichment-Pipeline/1.0',
      ...options.headers,
    };

    https.get(url, { headers: requestHeaders }, (res) => {
      // Handle redirects (302, 301, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        // Consume the response body to free the socket
        res.resume();
        // Resolve relative redirect URLs against the original URL
        const redirectTarget = new URL(res.headers.location, url).href;
        fetchUrl(redirectTarget, { ...options, maxRedirects: maxRedirects - 1 })
          .then(resolve)
          .catch(reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({ body, statusCode: res.statusCode, headers: res.headers });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Fetch a URL and parse the response as JSON.
 * Throws on non-200 responses with a descriptive message.
 *
 * @param {string} url - URL to fetch
 * @param {object} [options] - Passed to fetchUrl
 * @returns {Promise<object>} Parsed JSON
 */
async function fetchJson(url, options = {}) {
  const { body, statusCode } = await fetchUrl(url, options);
  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode} from ${url}\n${body.slice(0, 300)}`);
  }
  return JSON.parse(body);
}

/**
 * Fetch a URL and return the raw text body.
 * Throws on non-200 responses.
 *
 * @param {string} url - URL to fetch
 * @param {object} [options] - Passed to fetchUrl
 * @returns {Promise<string>} Response body
 */
async function fetchText(url, options = {}) {
  const { body, statusCode } = await fetchUrl(url, options);
  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode} from ${url}\n${body.slice(0, 300)}`);
  }
  return body;
}

/**
 * Ensure a directory exists, creating it and any parents if needed.
 *
 * @param {string} dirPath - Absolute path to directory
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format byte count as a human-readable string.
 *
 * @param {number} bytes
 * @returns {string} e.g. "1.2 MB", "345 KB"
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Source definitions — each source is a self-contained download function
// ---------------------------------------------------------------------------

const SOURCES = {
  wiki: {
    name: 'Wikipedia editions',
    description: 'Wikimedia SiteMatrix — all Wikipedia language editions',
    outputPath: 'data/wikipedia-editions.json',
    download: downloadWikipedia,
  },
  keyman: {
    name: 'Keyman keyboards',
    description: 'Keyman Cloud API — keyboard availability per language',
    outputPath: 'data/keyman-keyboards.json',
    download: downloadKeyman,
  },
  opus: {
    name: 'OPUS languages',
    description: 'OPUS NLP — parallel corpus language coverage',
    outputPath: 'data/opus-languages.json',
    download: downloadOpus,
  },
  lexibank: {
    name: 'Lexibank languages',
    description: 'Lexibank CLDF — lexical database language list',
    outputPath: 'data/lexibank/languages.csv',
    download: downloadLexibank,
  },
  elcat: {
    name: 'ELCat languages',
    description: 'Endangered Languages Catalogue — endangerment + language data',
    outputPath: 'data/elcat/ (languages.csv + values.csv)',
    download: downloadElcat,
  },
  ud: {
    name: 'Universal Dependencies',
    description: 'UD treebanks — parsed corpus availability per language',
    outputPath: 'data/ud-treebanks.json',
    download: downloadUniversalDependencies,
  },
};

// ---------------------------------------------------------------------------
// 1. Wikipedia editions — SiteMatrix API
// ---------------------------------------------------------------------------

/**
 * Downloads the Wikimedia SiteMatrix, which lists every Wikipedia edition
 * with its language code and local name. We save the raw response so the
 * enrichment script can extract per-wiki article counts later if needed.
 */
async function downloadWikipedia() {
  const url = 'https://meta.wikimedia.org/w/api.php?action=sitematrix&format=json';
  console.log(`     Fetching: ${url}`);

  const data = await fetchJson(url);

  // The SiteMatrix response has numeric keys for each language group
  // Count how many Wikipedia editions we found
  const sitematrix = data.sitematrix;
  let editionCount = 0;

  for (const key of Object.keys(sitematrix)) {
    // Numeric keys are language groups, "count" and "specials" are metadata
    if (/^\d+$/.test(key)) {
      const group = sitematrix[key];
      // Each group has a "site" array — look for Wikipedia entries
      if (Array.isArray(group.site)) {
        const hasWiki = group.site.some(s => s.code === 'wiki');
        if (hasWiki) editionCount++;
      }
    }
  }

  const outputPath = path.join(DATA_DIR, 'wikipedia-editions.json');
  ensureDir(path.dirname(outputPath));

  const outputContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, outputContent + '\n', 'utf-8');

  const fileSize = Buffer.byteLength(outputContent, 'utf-8');
  console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
  console.log(`     Size: ${formatBytes(fileSize)} — ${editionCount} Wikipedia editions found`);
}

// ---------------------------------------------------------------------------
// 2. Keyman keyboards — Cloud API v4.0
// ---------------------------------------------------------------------------

/**
 * Downloads the Keyman keyboard availability index. Lists all languages
 * that have at least one Keyman keyboard available.
 */
async function downloadKeyman() {
  const url = 'https://api.keyman.com/cloud/4.0/languages';
  console.log(`     Fetching: ${url}`);

  const data = await fetchJson(url);

  // The Keyman response nests language data as { languages: { languages: [...] } }
  // where the inner array contains per-language keyboard availability entries
  const languageEntries = data?.languages?.languages;
  const languageCount = Array.isArray(languageEntries) ? languageEntries.length : 0;

  const outputPath = path.join(DATA_DIR, 'keyman-keyboards.json');
  ensureDir(path.dirname(outputPath));

  const outputContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, outputContent + '\n', 'utf-8');

  const fileSize = Buffer.byteLength(outputContent, 'utf-8');
  console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
  console.log(`     Size: ${formatBytes(fileSize)} — ${languageCount} languages with keyboards`);
}

// ---------------------------------------------------------------------------
// 3. OPUS languages — NLP API
// ---------------------------------------------------------------------------

/**
 * Downloads the list of all languages available in the OPUS parallel corpus
 * collection. Used to determine which language pairs have parallel training data.
 */
async function downloadOpus() {
  const url = 'https://opus.nlpl.eu/opusapi/?languages=true';
  console.log(`     Fetching: ${url}`);

  const data = await fetchJson(url);

  // OPUS returns { "languages": ["af", "am", ...] }
  const languageCount = Array.isArray(data.languages) ? data.languages.length : 0;

  const outputPath = path.join(DATA_DIR, 'opus-languages.json');
  ensureDir(path.dirname(outputPath));

  const outputContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, outputContent + '\n', 'utf-8');

  const fileSize = Buffer.byteLength(outputContent, 'utf-8');
  console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
  console.log(`     Size: ${formatBytes(fileSize)} — ${languageCount} languages in OPUS`);
}

// ---------------------------------------------------------------------------
// 4. Lexibank languages — GitHub raw CSV
// ---------------------------------------------------------------------------

/**
 * Downloads the Lexibank languages CSV from the lexibank-analysed repo.
 * Contains standardized language metadata across many lexical databases.
 */
async function downloadLexibank() {
  const url = 'https://raw.githubusercontent.com/lexibank/lexibank-analysed/main/cldf/languages.csv';
  console.log(`     Fetching: ${url}`);

  const body = await fetchText(url);

  // Count languages from CSV lines (minus header)
  const lines = body.split('\n').filter(l => l.trim());
  const languageCount = Math.max(0, lines.length - 1);

  const outputPath = path.join(DATA_DIR, 'lexibank', 'languages.csv');
  ensureDir(path.dirname(outputPath));

  fs.writeFileSync(outputPath, body, 'utf-8');

  const fileSize = Buffer.byteLength(body, 'utf-8');
  console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
  console.log(`     Size: ${formatBytes(fileSize)} — ${languageCount} languages`);
}

// ---------------------------------------------------------------------------
// 5. ELCat languages — GitHub raw CSVs (languages + values)
// ---------------------------------------------------------------------------

/**
 * Downloads both the languages and values CSVs from the Endangered Languages
 * Catalogue (ELCat) CLDF dataset. The values file contains endangerment
 * assessments and other coded properties.
 */
async function downloadElcat() {
  const baseUrl = 'https://raw.githubusercontent.com/cldf-datasets/elcat/main/cldf';

  const files = [
    { url: `${baseUrl}/languages.csv`, filename: 'languages.csv' },
    { url: `${baseUrl}/values.csv`,    filename: 'values.csv' },
  ];

  const outputDir = path.join(DATA_DIR, 'elcat');
  ensureDir(outputDir);

  for (const file of files) {
    console.log(`     Fetching: ${file.url}`);

    const body = await fetchText(file.url);

    const lines = body.split('\n').filter(l => l.trim());
    const rowCount = Math.max(0, lines.length - 1);

    const outputPath = path.join(outputDir, file.filename);
    fs.writeFileSync(outputPath, body, 'utf-8');

    const fileSize = Buffer.byteLength(body, 'utf-8');
    console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
    console.log(`     Size: ${formatBytes(fileSize)} — ${rowCount} rows`);
  }
}

// ---------------------------------------------------------------------------
// 6. Universal Dependencies — GitHub API (paginated)
// ---------------------------------------------------------------------------

/**
 * Downloads the list of all Universal Dependencies treebank repos from GitHub.
 * UD repos follow the naming convention UD_{Language}-{Treebank}, which lets
 * us extract language coverage. Paginates through all pages (100 repos/page).
 */
async function downloadUniversalDependencies() {
  console.log('     Fetching: GitHub API — UniversalDependencies repos (paginated)');

  const allRepos = [];
  let page = 1;
  const perPage = 100;

  // GitHub API requires a User-Agent header
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Paginate until we get fewer repos than perPage (meaning last page)
  while (true) {
    const url = `https://api.github.com/orgs/UniversalDependencies/repos?per_page=${perPage}&page=${page}`;
    console.log(`     Fetching page ${page}: ${url}`);

    const repos = await fetchJson(url, { headers });

    if (!Array.isArray(repos)) {
      // GitHub might return an error object instead of an array
      throw new Error(`Unexpected GitHub API response: ${JSON.stringify(repos).slice(0, 300)}`);
    }

    allRepos.push(...repos);

    // If we got fewer than perPage results, we've reached the last page
    if (repos.length < perPage) break;

    page++;

    // Safety valve — UD has ~300 repos, so 10 pages is more than enough
    if (page > 10) {
      console.log('     ⚠ Hit 10-page limit, stopping pagination');
      break;
    }
  }

  // Filter to only UD_ repos and extract structured data
  const udRepos = allRepos
    .filter(r => r.name.startsWith('UD_'))
    .map(repo => {
      // Parse repo name: UD_{Language}-{Treebank}
      // Some language names contain hyphens (e.g., UD_Old_Church_Slavonic-PROIEL)
      // The treebank name is always after the LAST hyphen
      const nameWithoutPrefix = repo.name.replace('UD_', '');
      const lastHyphen = nameWithoutPrefix.lastIndexOf('-');

      let language, treebank;
      if (lastHyphen > 0) {
        language = nameWithoutPrefix.substring(0, lastHyphen).replace(/_/g, ' ');
        treebank = nameWithoutPrefix.substring(lastHyphen + 1);
      } else {
        // No treebank suffix (shouldn't happen for real UD repos, but be safe)
        language = nameWithoutPrefix.replace(/_/g, ' ');
        treebank = null;
      }

      return {
        repo: repo.name,
        language,
        treebank,
        url: repo.html_url,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
      };
    });

  // Count unique languages across all treebanks
  const uniqueLanguages = new Set(udRepos.map(r => r.language));

  const output = {
    _downloadedAt: new Date().toISOString(),
    _source: 'https://github.com/UniversalDependencies',
    totalRepos: allRepos.length,
    udTreebanks: udRepos.length,
    uniqueLanguages: uniqueLanguages.size,
    treebanks: udRepos,
  };

  const outputPath = path.join(DATA_DIR, 'ud-treebanks.json');
  ensureDir(path.dirname(outputPath));

  const outputContent = JSON.stringify(output, null, 2);
  fs.writeFileSync(outputPath, outputContent + '\n', 'utf-8');

  const fileSize = Buffer.byteLength(outputContent, 'utf-8');
  console.log(`     Saved: ${path.relative(CLI_ROOT, outputPath)}`);
  console.log(`     Size: ${formatBytes(fileSize)} — ${udRepos.length} treebanks across ${uniqueLanguages.size} languages`);
}

// ---------------------------------------------------------------------------
// CLI — argument parsing and orchestration
// ---------------------------------------------------------------------------

function printList() {
  console.log('\n  📦 Available enrichment data sources:\n');
  for (const [key, source] of Object.entries(SOURCES)) {
    console.log(`     ${key.padEnd(10)} ${source.name}`);
    console.log(`     ${''.padEnd(10)} ${source.description}`);
    console.log(`     ${''.padEnd(10)} → ${source.outputPath}`);
    console.log();
  }
}

async function main() {
  const args = process.argv.slice(2);

  // --list: show available sources and exit
  if (args.includes('--list')) {
    printList();
    process.exit(0);
  }

  // --source <name>: download only the specified source
  const sourceArg = args.find((a, i) => args[i - 1] === '--source');
  const sourcesToRun = sourceArg
    ? [sourceArg]
    : Object.keys(SOURCES);

  // Validate source names
  for (const key of sourcesToRun) {
    if (!SOURCES[key]) {
      console.error(`\n  ❌ Unknown source: "${key}"`);
      console.error(`     Available: ${Object.keys(SOURCES).join(', ')}`);
      console.error(`     Use --list for details.\n`);
      process.exit(1);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📥 Download Enrichment Data — Phase 2');
  console.log(`  Sources: ${sourcesToRun.join(', ')}`);
  console.log(`  Output:  ${path.relative(process.cwd(), DATA_DIR)}/`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = { success: [], failed: [] };

  for (const key of sourcesToRun) {
    const source = SOURCES[key];
    console.log(`  ┌─ ${source.name}`);
    console.log(`  │  ${source.description}`);

    try {
      await source.download();
      results.success.push(key);
      console.log(`  └─ ✅ Done\n`);
    } catch (err) {
      results.failed.push(key);
      console.error(`  │  ❌ Error: ${err.message}`);
      console.error(`  └─ Failed\n`);
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Summary: ${results.success.length} succeeded, ${results.failed.length} failed`);
  if (results.success.length > 0) {
    console.log(`  ✅ ${results.success.join(', ')}`);
  }
  if (results.failed.length > 0) {
    console.log(`  ❌ ${results.failed.join(', ')}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Exit with error code if any source failed
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main();
