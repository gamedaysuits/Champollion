#!/usr/bin/env node

/**
 * download-glottolog-med.mjs
 * ────────────────────────────────────────────────────────────────
 * Downloads the Glottolog CLDF tables used by the enrichment
 * pipeline:
 *   - values.csv    → cli/data/glottolog/cldf-values.csv (gitignored;
 *                     MED + AES + other per-language parameters;
 *                     aes-values.csv is derived from it by
 *                     derive-aes-values.mjs)
 *   - languages.csv → cli/data/glottolog/cldf-languages.csv (tracked;
 *                     macroarea, ISO codes, documentation years)
 *
 * DATA SOURCE (PINNED):
 *   Glottolog CLDF v5.3 — the version every card's provenance labels
 *   ('glottolog-5.3' / 'glottolog-cldf-5.3') refer to. Do NOT fetch
 *   the floating master branch: it drifts from the labels.
 *
 * INTEGRITY:
 *   Downloads are validated BEFORE writing: Content-Length is checked
 *   against the received bytes, and the CSV must parse rectangular
 *   (every record has the header's column count) with a sane record
 *   count. A truncated transfer therefore fails loudly instead of
 *   silently corrupting the data lane — cldf-languages.csv shipped
 *   truncated at 29% (7,873 of 27,177 records, cut mid-record) until
 *   2026-07-19 because no such check existed.
 *
 * IDEMPOTENCY:
 *   Overwrites previous downloads with fresh, validated copies.
 *
 * Usage:
 *   node scripts/download-glottolog-med.mjs
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { parseCSV } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');

const GLOTTOLOG_CLDF_TAG = 'v5.3';
const BASE_URL = `https://raw.githubusercontent.com/glottolog/glottolog-cldf/${GLOTTOLOG_CLDF_TAG}/cldf`;

const DOWNLOADS = [
  {
    name: 'values.csv',
    url: `${BASE_URL}/values.csv`,
    outputPath: path.join(DATA_DIR, 'glottolog', 'cldf-values.csv'),
    // v5.3 has 144,887 value records across 8 columns
    minRecords: 140_000,
  },
  {
    name: 'languages.csv',
    url: `${BASE_URL}/languages.csv`,
    outputPath: path.join(DATA_DIR, 'glottolog', 'cldf-languages.csv'),
    // v5.3 has 27,177 languoid records across 15 columns
    minRecords: 27_000,
  },
];


// ═══════════════════════════════════════════════════════════════
//  HTTP Helper
//  Uses native https to avoid external dependencies.
//  Follows redirects (GitHub raw URLs often 302).
// ═══════════════════════════════════════════════════════════════

function fetchUrl(url, options = {}) {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 120_000; // 2 minute timeout for large files

  return new Promise((resolve, reject) => {
    const requestHeaders = {
      'User-Agent': 'Champollion-Enrichment-Pipeline/1.0',
      ...options.headers,
    };

    const req = https.get(url, { headers: requestHeaders }, (res) => {
      // Handle redirects (302, 301, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        res.resume();
        const redirectTarget = new URL(res.headers.location, url).href;
        fetchUrl(redirectTarget, { ...options, maxRedirects: maxRedirects - 1 })
          .then(resolve)
          .catch(reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Guard against truncated transfers: if the server declared a
        // length, the bytes received must match it exactly.
        const declared = res.headers['content-length'];
        if (declared !== undefined && Number(declared) !== buf.length) {
          reject(new Error(
            `Truncated transfer for ${url}: received ${buf.length} bytes, Content-Length was ${declared}`
          ));
          return;
        }
        resolve({ body: buf.toString('utf-8'), statusCode: res.statusCode, headers: res.headers });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs / 1000}s`));
    });
  });
}


// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

async function fetchAndValidate({ name, url, minRecords }) {
  console.log(`  Source: ${url}`);
  console.log('  ⏳ Downloading...');

  const { body, statusCode } = await fetchUrl(url);
  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode} for ${name} — response preview: ${body.slice(0, 200)}`);
  }

  // Validate BEFORE anything is written so a bad transfer never clobbers
  // a good file: must parse rectangular against its own header, with a
  // sane record count.
  const records = parseCSV(body, { file: name });
  const columns = records[0]?.length ?? 0;
  parseCSV(body, { file: name, expectColumns: columns });
  const dataRecords = records.length - 1;
  if (dataRecords < minRecords) {
    throw new Error(
      `${name}: only ${dataRecords.toLocaleString()} records (expected ≥ ${minRecords.toLocaleString()}) — transfer looks partial`
    );
  }

  console.log(`  ✅ ${name}: ${dataRecords.toLocaleString()} records × ${columns} columns, ${formatBytes(body.length)}\n`);
  return { body, records };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📥 Download Glottolog CLDF ${GLOTTOLOG_CLDF_TAG} tables (values + languages)`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Fetch + validate everything first; write only when all passed.
    let valuesRecords = null;
    const validated = [];
    for (const dl of DOWNLOADS) {
      const { body, records } = await fetchAndValidate(dl);
      validated.push({ dl, body });
      if (dl.name === 'values.csv') valuesRecords = records;
    }
    for (const { dl, body } of validated) {
      ensureDir(path.dirname(dl.outputPath));
      fs.writeFileSync(dl.outputPath, body, 'utf-8');
      console.log(`  💾 wrote ${path.relative(CLI_ROOT, dl.outputPath)}`);
    }
    console.log('');

    // Parameter breakdown for the values table (record-based — line-based
    // counting misreads the multi-line quoted comments in AES records).
    const header = valuesRecords[0];
    const paramIdx = header.indexOf('Parameter_ID');
    const byParam = new Map();
    for (let i = 1; i < valuesRecords.length; i++) {
      const p = valuesRecords[i][paramIdx];
      byParam.set(p, (byParam.get(p) || 0) + 1);
    }

    console.log('  values.csv parameter breakdown:');
    console.log('  ─────────────────────────────────────');
    for (const [param, n] of [...byParam.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(param).padEnd(20)} ${n.toLocaleString()}`);
    }
    console.log('\n  Next: node scripts/derive-aes-values.mjs  (regenerates aes-values.csv)');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error(`  ❌ Download failed: ${err.message}\n`);
    console.error('  ℹ  No files were overwritten. The existing data files remain usable:');
    console.error('     • data/glottolog/aes-values.csv (AES data)');
    console.error('     • data/glottolog/cldf-languages.csv (documentation years)');
    console.error('     Run enrich-documentation-med.mjs — it works without cldf-values.csv.\n');
    process.exit(1);
  }
}

main();
