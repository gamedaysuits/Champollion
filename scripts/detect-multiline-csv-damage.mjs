#!/usr/bin/env node
// Detect multi-line-quoted-CSV damage across datasets ingested by ingest-cldf.mjs.
//
// Replicates ingest-cldf.mjs's file discovery per source, then scans every CSV
// the ingester would read (data table + languages/parameters/codes) for logical
// rows containing embedded newlines (quote-parity accumulation). Any such row
// was mis-parsed by the pre-b6b4e2409 line-based reader (truncated row +
// garbage fragment rows), so the dataset needs delete + re-ingest.
//
// Usage: node detect-multiline-damage.mjs <repo-root> <sources.txt> <out.json>

import { readFileSync, existsSync, createReadStream, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';

const [, , repoRoot, sourcesFile, outFile] = process.argv;
if (!repoRoot || !sourcesFile || !outFile) {
  console.error('usage: node detect-multiline-damage.mjs <repo-root> <sources.txt> <out.json>');
  process.exit(1);
}

const DATA_DIR = join(repoRoot, 'cli', 'data');
const META_CANDIDATES = [
  'cldf-metadata.json',
  'Wordlist-metadata.json',
  'StructureDataset-metadata.json',
  'Generic-metadata.json',
];
// CLDF table-type URIs (mirror cli/lib/cldf-terms.mjs values)
const T = {
  LANGUAGE: 'http://cldf.clld.org/v1.0/terms.rdf#LanguageTable',
  PARAMETER: 'http://cldf.clld.org/v1.0/terms.rdf#ParameterTable',
  CODE: 'http://cldf.clld.org/v1.0/terms.rdf#CodeTable',
  FORM: 'http://cldf.clld.org/v1.0/terms.rdf#FormTable',
  VALUE: 'http://cldf.clld.org/v1.0/terms.rdf#ValueTable',
};

function findRecursive(base, names, maxDepth) {
  // breadth-first so the shallowest match wins
  const queue = [{ dir: base, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (entries.includes(name)) return join(dir, name);
    }
    if (depth >= maxDepth) continue;
    for (const e of entries) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory()) queue.push({ dir: p, depth: depth + 1 });
      } catch {}
    }
  }
  return null;
}

// Resolve the set of CSV files ingest-cldf.mjs would read for --source <src>.
function resolveFiles(src) {
  const base = join(DATA_DIR, src);
  if (!existsSync(base)) return { missing: true };

  // 1. ingester auto-discovery: metadata in <base>/cldf/
  let metaPath = null;
  for (const cand of META_CANDIDATES) {
    const p = join(base, 'cldf', cand);
    if (existsSync(p)) {
      metaPath = p;
      break;
    }
  }
  let mode = 'metadata-auto';
  // 2. direct CSV in <base>/cldf/
  if (!metaPath) {
    const formsP = join(base, 'cldf', 'forms.csv');
    const valuesP = join(base, 'cldf', 'values.csv');
    if (existsSync(formsP) || existsSync(valuesP)) {
      const dataPath = existsSync(formsP) ? formsP : valuesP;
      return legacyFiles(src, dataPath, 'direct-csv-auto');
    }
    // 3. nonstandard layout (e.g. autotyp/data/cldf): recursive search
    metaPath = findRecursive(base, META_CANDIDATES, 5);
    mode = 'metadata-explicit';
    if (!metaPath) {
      const dataPath = findRecursive(base, ['forms.csv', 'values.csv'], 5);
      if (dataPath) return legacyFiles(src, dataPath, 'direct-csv-explicit');
      return { missing: true, dirExists: true };
    }
  }

  // metadata mode: read table URLs
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    return { missing: true, metaPath, parseError: String(e) };
  }
  const baseDir = dirname(metaPath);
  const tables = {};
  for (const table of meta.tables || []) {
    tables[table['dc:conformsTo'] || ''] = join(baseDir, table.url);
  }
  const files = {};
  for (const [key, uri] of [
    ['languages', T.LANGUAGE],
    ['parameters', T.PARAMETER],
    ['codes', T.CODE],
  ]) {
    if (tables[uri] && existsSync(tables[uri])) files[key] = tables[uri];
  }
  // main() ingests FormTable if present, else ValueTable
  if (tables[T.FORM] && existsSync(tables[T.FORM])) files.data = tables[T.FORM];
  else if (tables[T.VALUE] && existsSync(tables[T.VALUE])) files.data = tables[T.VALUE];
  return { mode, metaPath, files };
}

function legacyFiles(src, dataPath, mode) {
  const dir = dirname(dataPath);
  const files = { data: dataPath };
  for (const aux of ['languages', 'parameters', 'codes']) {
    const p = join(dir, `${aux}.csv`);
    if (existsSync(p)) files[aux] = p;
  }
  return { mode, files };
}

// Scan one CSV: count logical rows that span multiple physical lines.
async function scanFile(filePath) {
  let pending = false; // inside an open quoted field spanning lines
  let physicalInRow = 0;
  let multilineRows = 0;
  let fragmentLines = 0; // physical lines beyond the first of a logical row
  let logicalRows = 0;
  const rl = createInterface({
    input: createReadStream(filePath, 'utf-8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    let quotes = 0;
    for (let i = 0; i < line.length; i++) if (line[i] === '"') quotes++;
    if (pending) {
      physicalInRow++;
      fragmentLines++;
      if (quotes % 2 === 1) {
        pending = false;
        logicalRows++;
        multilineRows++;
        physicalInRow = 0;
      }
    } else {
      if (quotes % 2 === 1) {
        pending = true;
        physicalInRow = 1;
      } else {
        logicalRows++;
      }
    }
  }
  if (pending) {
    // unterminated final row
    logicalRows++;
    multilineRows++;
  }
  return { multilineRows, fragmentLines, logicalRows };
}

const sources = readFileSync(sourcesFile, 'utf-8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const report = {};
let affectedCount = 0;
for (const src of sources) {
  const resolved = resolveFiles(src);
  if (resolved.missing) {
    report[src] = { status: 'MISSING', ...resolved };
    console.log(`${src}: MISSING (no dataset files found)`);
    continue;
  }
  const fileReports = {};
  let affected = false;
  for (const [kind, path] of Object.entries(resolved.files)) {
    const r = await scanFile(path);
    fileReports[kind] = { path: path.replace(repoRoot + '/', ''), ...r };
    if (r.multilineRows > 0) affected = true;
  }
  report[src] = {
    status: affected ? 'AFFECTED' : 'clean',
    mode: resolved.mode,
    metaPath: resolved.metaPath ? resolved.metaPath.replace(repoRoot + '/', '') : undefined,
    files: fileReports,
  };
  if (affected) {
    affectedCount++;
    const parts = Object.entries(fileReports)
      .filter(([, r]) => r.multilineRows > 0)
      .map(([k, r]) => `${k}:${r.multilineRows}`)
      .join(' ');
    console.log(`${src}: AFFECTED (${parts})`);
  }
}

writeFileSync(outFile, JSON.stringify(report, null, 2));
const missing = Object.values(report).filter((r) => r.status === 'MISSING').length;
const clean = Object.values(report).filter((r) => r.status === 'clean').length;
console.log(`\nTotal: ${sources.length} sources — ${affectedCount} AFFECTED, ${clean} clean, ${missing} missing`);
