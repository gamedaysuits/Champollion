#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'ingest-cldf.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: node cli/scripts/cldf/build-atlas.mjs (module dispatch: ingest-structure / ingest-structure-attestation / ingest-lexical)\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * Universal CLDF Ingester — Champollion v2 Database Pipeline
 *
 * Reads any CLDF dataset (Wordlist or StructureDataset) and writes its
 * data points to the v2 SQLite database as individually-cited facts.
 *
 * CLDF (Cross-Linguistic Data Formats) is the de facto standard for
 * comparative linguistics data. This script reads the machine-readable
 * metadata (cldf-metadata.json) to discover table schemas, column names,
 * and table filenames — so it works on ANY conforming dataset without
 * dataset-specific code.
 *
 * Usage:
 *   node scripts/ingest-cldf.mjs <path-to-metadata.json> [options]
 *
 * Examples:
 *   node scripts/ingest-cldf.mjs cli/data/abvd/cldf/cldf-metadata.json
 *   node scripts/ingest-cldf.mjs cli/data/dplace-ea/cldf/StructureDataset-metadata.json
 *   node scripts/ingest-cldf.mjs cli/data/autotyp/data/cldf/StructureDataset-metadata.json --dry-run
 *   node scripts/ingest-cldf.mjs cli/data/apics/values.csv --source apics --type structure
 *
 * Options:
 *   --dry-run       Preview changes without writing to database
 *   --lang <code>   Only ingest data for this ISO 639-3 code
 *   --limit <n>     Stop after ingesting n facts (for testing)
 *   --source <name> Override the dataset source label (default: directory name)
 *   --source-url <url>  Override the dataset URL for provenance
 *   --type <type>   Force dataset type: 'wordlist' or 'structure' (for non-CLDF CSVs)
 *   --verbose       Print every fact being inserted
 *
 * Design principles:
 *   1. METADATA-DRIVEN: Table filenames, column names, and dataset type
 *      are all read from cldf-metadata.json — nothing is hardcoded per-dataset.
 *   2. ADDITIVE ONLY: Uses INSERT OR REPLACE on (language_code, domain, property, source)
 *      unique constraint. Running twice is safe and idempotent.
 *   3. FAIL-LOUD: If a language can't be matched to our language registry,
 *      it's logged and counted — never silently skipped.
 *   4. FULL PROVENANCE: Every fact carries source, source_url, confidence,
 *      retrieved_at, and created_by.
 *   5. HUMAN-READABLE VALUES: categorical values are stored as their
 *      codes.csv label (e.g. WALS 84A code "6" → "No dominant order"),
 *      never as the bare numeric code. The original code is preserved in
 *      the fact's `notes` field as `code:<Code_ID>` for traceability.
 *
 * RE-INGEST NOTE (bare-code bug fix, 2026-06):
 *   Facts ingested before this fix via the legacy-CSV path (datasets that
 *   ship plain values.csv without cldf-metadata.json — notably WALS and
 *   APiCS) carry bare numeric codes as values because codes.csv was never
 *   loaded in that path. To repair existing rows, re-run (when no other
 *   pipeline holds the DB):
 *
 *     node cli/scripts/ingest-cldf.mjs cli/data/wals/values.csv  --source wals  --type structure --source-url https://wals.info
 *     node cli/scripts/ingest-cldf.mjs cli/data/apics/values.csv --source apics --type structure --source-url https://apics-online.info
 *
 *   INSERT OR REPLACE on (language_code, domain, property, source) makes
 *   this an in-place repair — no duplicate facts are created. Until then,
 *   the display layer joins codes through cli/shared/explainers/tc-features.json.
 *
 * @see docs/DATA-ARCHITECTURE.md §4 for the design specification
 * @see cli/scripts/db.mjs for the database API
 */

import { readFileSync, existsSync, createReadStream } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { openDatabase } from './db.mjs';
import { CLDF_TYPES, CLDF_DATASET_TYPES, CLDF_PROPERTIES } from '../lib/cldf-terms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CLDF table-type, dataset-type, and column-property URIs now live in the shared
// module cli/lib/cldf-terms.mjs (imported above) so the ingester and the CLDF
// exporter (export-cldf.mjs) read identical vocabulary. See that module's header.

// ---------------------------------------------------------------------------
// CLI ARGUMENT PARSING
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    metadataPath: null,
    dryRun: false,
    lang: null,
    limit: Infinity,
    sourceOverride: null,
    sourceUrlOverride: null,
    typeOverride: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--lang':
        opts.lang = args[++i];
        break;
      case '--limit':
        opts.limit = parseInt(args[++i], 10);
        break;
      case '--source':
        opts.sourceOverride = args[++i];
        break;
      case '--source-url':
        opts.sourceUrlOverride = args[++i];
        break;
      case '--type':
        opts.typeOverride = args[++i];
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        if (!opts.metadataPath && !args[i].startsWith('-')) {
          opts.metadataPath = args[i];
        }
    }
  }

  // Auto-discover metadata file if --source given but no explicit path
  if (!opts.metadataPath && opts.sourceOverride) {
    const sourceDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', opts.sourceOverride, 'cldf');
    const candidates = [
      'cldf-metadata.json',
      'Wordlist-metadata.json',
      'StructureDataset-metadata.json',
      'Generic-metadata.json',
    ];
    for (const candidate of candidates) {
      const candidatePath = join(sourceDir, candidate);
      if (existsSync(candidatePath)) {
        opts.metadataPath = candidatePath;
        break;
      }
    }
    // If still no metadata, check if we have raw CSVs to ingest directly
    if (!opts.metadataPath) {
      const formsPath = join(sourceDir, 'forms.csv');
      const valuesPath = join(sourceDir, 'values.csv');
      if (existsSync(formsPath) || existsSync(valuesPath)) {
        // Create a synthetic metadata path marker for direct CSV mode
        opts.metadataPath = existsSync(formsPath) ? formsPath : valuesPath;
        opts.directCsvMode = true;
        if (!opts.typeOverride) {
          opts.typeOverride = existsSync(formsPath) ? 'wordlist' : 'structure';
        }
      }
    }
  }

  if (!opts.metadataPath) {
    console.error('Error: No metadata file specified and could not auto-discover one.');
    printUsage();
    process.exit(1);
  }

  return opts;
}

function printUsage() {
  console.log(`
Usage: node scripts/ingest-cldf.mjs <path-to-metadata.json> [options]

Options:
  --dry-run          Preview without writing to database
  --lang <code>      Only ingest for this ISO 639-3 code
  --limit <n>        Stop after n facts (for testing)
  --source <name>    Override dataset source label
  --source-url <url> Override dataset URL
  --type <type>      Force type: 'wordlist' or 'structure'
  --verbose          Print every fact
  --help             Show this help
`);
}

// ---------------------------------------------------------------------------
// CSV PARSER — proper handling of quoted fields
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles escaped quotes ("") inside quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Read a CSV file and return an array of objects keyed by header names.
 * Uses proper CSV parsing (handles quoted fields, commas in values).
 */
async function readCSV(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️  CSV not found: ${filePath}`);
    return [];
  }

  const rows = [];
  let headers = null;
  // A quoted CSV field may contain literal newlines (ELCat comments do).
  // Physical lines are accumulated until the double-quote count is EVEN —
  // an odd count means a quoted field is still open and the logical row
  // continues on the next physical line. ("" escapes add two quotes, so
  // parity stays correct.) Without this, a multi-line row is parsed as a
  // truncated row plus garbage fragment rows, silently dropping trailing
  // columns like ELCat's `preferred` flag.
  let pending = null;

  const rl = createInterface({
    input: createReadStream(filePath, 'utf-8'),
    crlfDelay: Infinity,
  });

  const addRow = (logicalLine) => {
    if (!logicalLine.trim()) return;

    const fields = parseCSVLine(logicalLine);

    if (!headers) {
      headers = fields;
      return;
    }

    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] || '';
    }
    rows.push(row);
  };

  for await (const line of rl) {
    const candidate = pending === null ? line : `${pending}\n${line}`;
    let quotes = 0;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === '"') quotes++;
    }
    if (quotes % 2 === 1) {
      pending = candidate;
      continue;
    }
    pending = null;
    addRow(candidate);
  }
  // Unterminated final row (malformed file) — parse what we have rather
  // than silently dropping it.
  if (pending !== null) addRow(pending);

  return rows;
}

// ---------------------------------------------------------------------------
// CLDF METADATA PARSER
// ---------------------------------------------------------------------------

/**
 * Parse a CLDF metadata file and extract the information we need:
 * - Dataset type (Wordlist, StructureDataset, etc.)
 * - Table file paths and their CLDF types
 * - Column mappings (which column is Language_ID, Value, Form, etc.)
 * - Dataset citation and source URL
 */
function parseMetadata(metadataPath) {
  const raw = readFileSync(metadataPath, 'utf-8');
  const meta = JSON.parse(raw);
  const baseDir = dirname(metadataPath);

  // ── Identify dataset type ──
  const datasetType = meta['dc:conformsTo'] || 'unknown';

  // ── Extract citation info ──
  const citation = meta['dc:bibliographicCitation'] || '';
  const title = meta['dc:title'] || '';
  const identifier = meta['dc:identifier'] || '';
  const accessUrl = meta['dcat:accessURL'] || '';
  const datasetId = meta['rdf:ID'] || basename(dirname(metadataPath));
  const license = meta['dc:license'] || '';

  // ── Parse tables ──
  // Each table in CLDF metadata has:
  //   - url: the CSV filename
  //   - dc:conformsTo: the CLDF table type URI
  //   - tableSchema.columns: column definitions with propertyUrl
  const tables = {};

  for (const table of meta.tables || []) {
    const conformsTo = table['dc:conformsTo'] || '';
    const url = table.url;
    const filePath = join(baseDir, url);
    const extent = table['dc:extent'] || 0;

    // Build column name map: propertyUrl → actual column name
    // This lets us find "which column is the Language reference?" etc.
    const columnMap = {};
    for (const col of table.tableSchema?.columns || []) {
      if (col.propertyUrl) {
        columnMap[col.propertyUrl] = col.name;
      }
      // Also store by name for fallback
      columnMap[col.name] = col.name;
    }

    tables[conformsTo] = {
      filePath,
      url,
      extent,
      conformsTo,
      columnMap,
    };
  }

  return {
    datasetType,
    datasetId,
    title,
    citation,
    identifier,
    accessUrl,
    license,
    tables,
    baseDir,
  };
}

// ---------------------------------------------------------------------------
// LANGUAGE MATCHING
// ---------------------------------------------------------------------------

/**
 * Build a lookup map from dataset-internal Language_IDs to our ISO 639-3 codes.
 *
 * Strategy:
 *   1. Read the LanguageTable from the CLDF dataset
 *   2. For each row, try to match by ISO639P3code first, then Glottocode
 *   3. Return a Map: Language_ID → { isoCode, glottocode, name }
 */
async function buildLanguageMap(languageTable, db) {
  if (!languageTable || !existsSync(languageTable.filePath)) {
    console.warn('  ⚠️  No LanguageTable found — will try direct ISO code matching');
    return null;
  }

  const colMap = languageTable.columnMap;
  const idCol = colMap[CLDF_PROPERTIES.ID] || 'ID';
  const isoCol = colMap[CLDF_PROPERTIES.ISO639P3] || 'ISO639P3code';
  const glottoCol = colMap[CLDF_PROPERTIES.GLOTTOCODE] || 'Glottocode';
  const nameCol = colMap[CLDF_PROPERTIES.NAME] || 'Name';

  const rows = await readCSV(languageTable.filePath);
  const langMap = new Map();

  // Also build a glottocode → ISO lookup from our database
  const allLangs = db.getAllLanguages();
  const glottoToIso = new Map();
  for (const lang of allLangs) {
    if (lang.glottocode) {
      glottoToIso.set(lang.glottocode, lang.code);
    }
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedList = [];

  for (const row of rows) {
    const datasetId = row[idCol];
    const iso = row[isoCol] || '';
    const glotto = row[glottoCol] || '';
    const name = row[nameCol] || '';

    let resolvedIso = null;

    // Strategy 1: Direct ISO 639-3 code
    if (iso && iso.length === 3) {
      const lang = db.getLanguage(iso);
      if (lang) {
        resolvedIso = iso;
      }
    }

    // Strategy 2: Glottocode → ISO lookup from our database
    if (!resolvedIso && glotto) {
      const isoFromGlotto = glottoToIso.get(glotto);
      if (isoFromGlotto) {
        resolvedIso = isoFromGlotto;
      }
    }

    // Strategy 3: The dataset ID itself might be an ISO code
    if (!resolvedIso && datasetId && datasetId.length === 3) {
      const lang = db.getLanguage(datasetId);
      if (lang) {
        resolvedIso = datasetId;
      }
    }

    if (resolvedIso) {
      langMap.set(datasetId, { isoCode: resolvedIso, glottocode: glotto, name });
      matched++;
    } else {
      unmatched++;
      if (unmatchedList.length < 20) {
        unmatchedList.push(`${datasetId} (ISO: ${iso || '—'}, Glotto: ${glotto || '—'}, Name: ${name})`);
      }
    }
  }

  console.log(`  Language matching: ${matched} matched, ${unmatched} unmatched`);
  if (unmatchedList.length > 0) {
    console.log(`  First ${unmatchedList.length} unmatched:`);
    for (const u of unmatchedList) {
      console.log(`    ✗ ${u}`);
    }
    if (unmatched > 20) {
      console.log(`    ... and ${unmatched - 20} more`);
    }
  }

  return langMap;
}

// ---------------------------------------------------------------------------
// PARAMETER MAP
// ---------------------------------------------------------------------------

/**
 * Build a map from parameter IDs to human-readable names.
 * This makes fact properties readable (e.g., "GB020" → "Are there definite articles?")
 */
async function buildParameterMap(parameterTable) {
  if (!parameterTable || !existsSync(parameterTable.filePath)) {
    return new Map();
  }

  const colMap = parameterTable.columnMap;
  const idCol = colMap[CLDF_PROPERTIES.ID] || 'ID';
  const nameCol = colMap[CLDF_PROPERTIES.NAME] || 'Name';

  const rows = await readCSV(parameterTable.filePath);
  const paramMap = new Map();

  for (const row of rows) {
    paramMap.set(row[idCol], row[nameCol] || row[idCol]);
  }

  console.log(`  Loaded ${paramMap.size} parameter definitions`);
  return paramMap;
}

// ---------------------------------------------------------------------------
// CODE MAP (for StructureDatasets)
// ---------------------------------------------------------------------------

/**
 * Build a map from code IDs to human-readable value labels.
 * E.g., for WALS, "1" might map to "SVO" for parameter 81A.
 */
async function buildCodeMap(codeTable) {
  if (!codeTable || !existsSync(codeTable.filePath)) {
    return new Map();
  }

  const colMap = codeTable.columnMap;
  const idCol = colMap[CLDF_PROPERTIES.ID] || 'ID';
  const nameCol = colMap[CLDF_PROPERTIES.NAME] || 'Name';

  const rows = await readCSV(codeTable.filePath);
  const codeMap = new Map();

  for (const row of rows) {
    codeMap.set(row[idCol], row[nameCol] || row[idCol]);
  }

  return codeMap;
}

// ---------------------------------------------------------------------------
// PREFERRED-ROW FILTER
// ---------------------------------------------------------------------------

/**
 * Some datasets (ELCat) carry MULTIPLE value rows per (language, parameter)
 * with a `preferred` column marking the dataset's own current/authoritative
 * row. insertFact() is INSERT OR REPLACE on (language_code, domain, property,
 * source), so without filtering, whichever row happens to come LAST wins —
 * which is the upstream's preferred row only by luck. That misrepresents the
 * upstream (e.g. ELCat's preferred LEI for Plains Cree is "Severely
 * Endangered"; the last row was a non-preferred "Vulnerable").
 *
 * Rule: when the values table has a `preferred` column, rows with
 * preferred !== 'yes' are skipped for any (language, parameter) pair that
 * also has at least one preferred === 'yes' row. Pairs with no preferred
 * row keep every row (last still wins, as before).
 *
 * Returns null when the table has no `preferred` column (no filtering).
 */
function buildPreferredPairs(rows, langRefCol, paramRefCol) {
  if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], 'preferred')) {
    return null;
  }
  const pairs = new Set();
  for (const row of rows) {
    if (row.preferred === 'yes') {
      pairs.add(`${row[langRefCol]}\u0000${row[paramRefCol]}`);
    }
  }
  return pairs;
}

function skipNonPreferred(preferredPairs, row, langRefCol, paramRefCol) {
  return (
    preferredPairs !== null &&
    row.preferred !== 'yes' &&
    preferredPairs.has(`${row[langRefCol]}\u0000${row[paramRefCol]}`)
  );
}

// ---------------------------------------------------------------------------
// FACT INGESTION — Wordlists (FormTable)
// ---------------------------------------------------------------------------

async function ingestWordlist(dataTable, langMap, paramMap, opts, db, datasetInfo) {
  const colMap = dataTable.columnMap;
  const langRefCol = colMap[CLDF_PROPERTIES.LANGUAGE_REF] || 'Language_ID';
  const paramRefCol = colMap[CLDF_PROPERTIES.PARAMETER_REF] || 'Parameter_ID';
  const formCol = colMap[CLDF_PROPERTIES.FORM] || 'Form';
  const valueCol = colMap[CLDF_PROPERTIES.VALUE] || 'Value';
  const sourceCol = colMap[CLDF_PROPERTIES.SOURCE] || 'Source';
  const commentCol = colMap[CLDF_PROPERTIES.COMMENT] || 'Comment';

  const rows = await readCSV(dataTable.filePath);
  console.log(`  Read ${rows.length} form rows from ${basename(dataTable.filePath)}`);
  const preferredPairs = buildPreferredPairs(rows, langRefCol, paramRefCol);

  let inserted = 0;
  let skipped = 0;
  let noLang = 0;
  const now = new Date().toISOString();
  const source = opts.sourceOverride || datasetInfo.datasetId;
  const sourceUrl = opts.sourceUrlOverride || datasetInfo.accessUrl || datasetInfo.identifier || '';

  for (const row of rows) {
    if (inserted >= opts.limit) break;

    const dataLangId = row[langRefCol];
    const paramId = row[paramRefCol];
    const form = row[formCol] || row[valueCol] || '';

    if (!form || !dataLangId) {
      skipped++;
      continue;
    }

    if (skipNonPreferred(preferredPairs, row, langRefCol, paramRefCol)) {
      skipped++;
      continue;
    }

    // Resolve to ISO code
    let isoCode;
    if (langMap) {
      const resolved = langMap.get(dataLangId);
      if (!resolved) {
        noLang++;
        continue;
      }
      isoCode = resolved.isoCode;
    } else {
      // Fallback: assume dataLangId IS the ISO code
      isoCode = dataLangId;
    }

    // Skip if filtering by language
    if (opts.lang && isoCode !== opts.lang) continue;

    // Resolve parameter name
    const paramName = paramMap.get(paramId) || paramId || 'form';

    const fact = {
      languageCode: isoCode,
      domain: 'lexical',
      property: paramName,
      value: form,
      valueType: 'string',
      source,
      sourceUrl,
      sourceRaw: row[sourceCol] || null,
      confidence: 'api-derived',
      retrievedAt: now,
      createdBy: 'ingest-cldf.mjs',
      notes: row[commentCol] || null,
    };

    if (opts.verbose) {
      console.log(`    + ${isoCode} | ${paramName} = "${form}" [${source}]`);
    }

    if (!opts.dryRun) {
      try {
        db.insertFact(fact);
      } catch (err) {
        // Log but don't crash — some rows may have missing language entries
        if (err.message.includes('FOREIGN KEY')) {
          noLang++;
          continue;
        }
        throw err;
      }
    }
    inserted++;
  }

  return { inserted, skipped, noLang };
}

// ---------------------------------------------------------------------------
// FACT INGESTION — StructureDatasets (ValueTable)
// ---------------------------------------------------------------------------

async function ingestStructureDataset(dataTable, langMap, paramMap, codeMap, opts, db, datasetInfo) {
  const colMap = dataTable.columnMap;
  const langRefCol = colMap[CLDF_PROPERTIES.LANGUAGE_REF] || 'Language_ID';
  const paramRefCol = colMap[CLDF_PROPERTIES.PARAMETER_REF] || 'Parameter_ID';
  const valueCol = colMap[CLDF_PROPERTIES.VALUE] || 'Value';
  const sourceCol = colMap[CLDF_PROPERTIES.SOURCE] || 'Source';
  const commentCol = colMap[CLDF_PROPERTIES.COMMENT] || 'Comment';
  // Some datasets use Code_ID for categorical values
  const codeIdCol = colMap['Code_ID'] || 'Code_ID';

  const rows = await readCSV(dataTable.filePath);
  console.log(`  Read ${rows.length} value rows from ${basename(dataTable.filePath)}`);
  const preferredPairs = buildPreferredPairs(rows, langRefCol, paramRefCol);

  let inserted = 0;
  let skipped = 0;
  let noLang = 0;
  const now = new Date().toISOString();
  const source = opts.sourceOverride || datasetInfo.datasetId;
  const sourceUrl = opts.sourceUrlOverride || datasetInfo.accessUrl || datasetInfo.identifier || '';

  for (const row of rows) {
    if (inserted >= opts.limit) break;

    const dataLangId = row[langRefCol];
    const paramId = row[paramRefCol];
    let value = row[valueCol] || '';

    if (!value || !dataLangId || !paramId) {
      skipped++;
      continue;
    }

    if (skipNonPreferred(preferredPairs, row, langRefCol, paramRefCol)) {
      skipped++;
      continue;
    }

    // Resolve to ISO code
    let isoCode;
    if (langMap) {
      const resolved = langMap.get(dataLangId);
      if (!resolved) {
        noLang++;
        continue;
      }
      isoCode = resolved.isoCode;
    } else {
      isoCode = dataLangId;
    }

    if (opts.lang && isoCode !== opts.lang) continue;

    // Resolve parameter name
    const paramName = paramMap.get(paramId) || paramId;

    // Resolve code ID to human-readable value if available.
    // WHY: many StructureDatasets (WALS, APiCS, …) store categorical
    // values as bare codes ("6") whose human label ("No dominant order")
    // lives in codes.csv. Storing the bare code leaks raw codes all the
    // way to rendered language cards, so we always store the label and
    // keep the code in `notes` for traceability.
    const codeId = row[codeIdCol];
    let resolvedValue = value;
    let codeNote = null;
    if (codeId && codeMap.has(codeId)) {
      resolvedValue = codeMap.get(codeId);
      if (resolvedValue !== value) {
        codeNote = `code:${codeId}`;
      }
    }

    // Determine value type — from the RESOLVED value, not the raw code.
    // A label like "No dominant order" must be typed 'string' even though
    // the raw code "6" looks like an integer.
    let valueType = 'string';
    if (resolvedValue === '0' || resolvedValue === '1') {
      valueType = 'boolean';
    } else if (/^\d+$/.test(resolvedValue)) {
      valueType = 'integer';
    } else if (/^\d+\.\d+$/.test(resolvedValue)) {
      valueType = 'float';
    }

    const fact = {
      languageCode: isoCode,
      domain: 'typology',
      property: paramName,
      value: resolvedValue,
      valueType,
      source,
      sourceUrl,
      sourceRaw: row[sourceCol] || null,
      confidence: 'api-derived',
      retrievedAt: now,
      createdBy: 'ingest-cldf.mjs',
      notes: [row[commentCol], codeNote].filter(Boolean).join(' | ') || null,
    };

    if (opts.verbose) {
      console.log(`    + ${isoCode} | ${paramName} = "${resolvedValue}" [${source}]`);
    }

    if (!opts.dryRun) {
      try {
        db.insertFact(fact);
      } catch (err) {
        if (err.message.includes('FOREIGN KEY')) {
          noLang++;
          continue;
        }
        throw err;
      }
    }
    inserted++;
  }

  return { inserted, skipped, noLang };
}

// ---------------------------------------------------------------------------
// FALLBACK: Non-metadata CSV ingestion
// ---------------------------------------------------------------------------

/**
 * For datasets that don't have cldf-metadata.json but have standard CLDF-like
 * CSV files (languages.csv, values.csv, forms.csv), try to ingest them by
 * detecting file structure from column headers.
 */
async function ingestLegacyCSV(csvPath, opts, db) {
  const dir = dirname(csvPath);
  const csvName = basename(csvPath);
  const datasetName = opts.sourceOverride || basename(dir);

  console.log(`\n── Legacy CSV mode (no metadata) ──`);
  console.log(`  Dataset: ${datasetName}`);
  console.log(`  File: ${csvPath}`);

  // Try to find a languages.csv in the same directory
  const langCsvPath = join(dir, 'languages.csv');
  let langMap = null;
  if (existsSync(langCsvPath)) {
    const langRows = await readCSV(langCsvPath);
    langMap = new Map();

    const allLangs = db.getAllLanguages();
    const glottoToIso = new Map();
    for (const lang of allLangs) {
      if (lang.glottocode) glottoToIso.set(lang.glottocode, lang.code);
    }

    for (const row of langRows) {
      const id = row.ID || '';
      const iso = row.ISO639P3code || '';
      const glotto = row.Glottocode || '';
      const name = row.Name || '';

      let resolved = null;
      if (iso && iso.length === 3 && db.getLanguage(iso)) resolved = iso;
      if (!resolved && glotto && glottoToIso.has(glotto)) resolved = glottoToIso.get(glotto);
      if (!resolved && id.length === 3 && db.getLanguage(id)) resolved = id;

      if (resolved) langMap.set(id, { isoCode: resolved, glottocode: glotto, name });
    }
    console.log(`  Loaded ${langMap.size} language mappings from languages.csv`);
  }

  // Try to find parameters.csv
  const paramCsvPath = join(dir, 'parameters.csv');
  let paramMap = new Map();
  if (existsSync(paramCsvPath)) {
    const paramRows = await readCSV(paramCsvPath);
    for (const row of paramRows) {
      paramMap.set(row.ID || '', row.Name || row.ID || '');
    }
    console.log(`  Loaded ${paramMap.size} parameters from parameters.csv`);
  }

  // Try to find codes.csv — REQUIRED for human-readable categorical values.
  // BUG FIX: this path previously passed an empty code map, so WALS/APiCS
  // values were stored as bare numeric codes ("6" instead of
  // "No dominant order"). codes.csv maps Code_ID → label exactly like the
  // CodeTable in metadata-driven mode.
  const codeCsvPath = join(dir, 'codes.csv');
  let codeMap = new Map();
  if (existsSync(codeCsvPath)) {
    const codeRows = await readCSV(codeCsvPath);
    for (const row of codeRows) {
      codeMap.set(row.ID || '', row.Name || row.ID || '');
    }
    console.log(`  Loaded ${codeMap.size} value codes from codes.csv`);
  } else {
    console.warn('  ⚠️  No codes.csv found — categorical values will be stored as raw codes');
  }

  // Detect type from filename or header
  const isValues = csvName === 'values.csv' || csvName === 'data.csv' || opts.typeOverride === 'structure';
  const isForms = csvName === 'forms.csv' || opts.typeOverride === 'wordlist';

  if (isValues) {
    const fakeTable = {
      filePath: csvPath,
      columnMap: {
        Language_ID: 'Language_ID',
        Parameter_ID: 'Parameter_ID',
        Value: 'Value',
        Source: 'Source',
        Comment: 'Comment',
        Code_ID: 'Code_ID',
      },
    };
    const fakeInfo = {
      datasetId: datasetName,
      accessUrl: opts.sourceUrlOverride || '',
    };
    return ingestStructureDataset(fakeTable, langMap, paramMap, codeMap, opts, db, fakeInfo);
  } else if (isForms) {
    const fakeTable = {
      filePath: csvPath,
      columnMap: {
        Language_ID: 'Language_ID',
        Parameter_ID: 'Parameter_ID',
        Form: 'Form',
        Value: 'Value',
        Source: 'Source',
        Comment: 'Comment',
      },
    };
    const fakeInfo = {
      datasetId: datasetName,
      accessUrl: opts.sourceUrlOverride || '',
    };
    return ingestWordlist(fakeTable, langMap, paramMap, opts, db, fakeInfo);
  } else {
    console.error(`  ✗ Cannot determine dataset type for ${csvName}. Use --type wordlist|structure`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const metadataPath = resolve(opts.metadataPath);

  if (!existsSync(metadataPath)) {
    console.error(`Error: File not found: ${metadataPath}`);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Champollion Universal CLDF Ingester                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Input: ${metadataPath}`);
  if (opts.dryRun) console.log('  Mode:  🏜️  DRY RUN (no database writes)');
  if (opts.lang) console.log(`  Filter: --lang ${opts.lang}`);
  if (opts.limit < Infinity) console.log(`  Limit: ${opts.limit} facts`);

  // Open database
  const db = openDatabase();
  const dbStats = {
    langsBefore: db._stmts.countLanguages.get().count,
    factsBefore: db._stmts.countFacts.get().count,
  };

  // Check if this is a metadata file or a direct CSV
  const isMetadata = metadataPath.endsWith('.json');

  if (!isMetadata) {
    // Legacy CSV mode
    const result = await ingestLegacyCSV(metadataPath, opts, db);
    printResults(result, dbStats, db, opts);
    db.close();
    return;
  }

  // ── Parse CLDF metadata ──
  const meta = parseMetadata(metadataPath);

  console.log(`\n── Dataset Info ──`);
  console.log(`  ID:    ${meta.datasetId}`);
  console.log(`  Title: ${meta.title || '(none)'}`);
  console.log(`  Type:  ${meta.datasetType}`);
  console.log(`  URL:   ${meta.accessUrl || meta.identifier || '(none)'}`);
  console.log(`  Tables: ${Object.keys(meta.tables).length}`);
  for (const [type, table] of Object.entries(meta.tables)) {
    const typeName = type.split('#')[1] || type;
    console.log(`    - ${typeName}: ${table.url} (${table.extent || '?'} rows)`);
  }

  // ── Build language map ──
  console.log(`\n── Language Matching ──`);
  const langTable = meta.tables[CLDF_TYPES.LANGUAGE_TABLE];
  const langMap = await buildLanguageMap(langTable, db);

  // ── Build parameter map ──
  console.log(`\n── Parameters ──`);
  const paramTable = meta.tables[CLDF_TYPES.PARAMETER_TABLE];
  const paramMap = await buildParameterMap(paramTable);

  // ── Build code map ──
  const codeTable = meta.tables[CLDF_TYPES.CODE_TABLE];
  const codeMap = await buildCodeMap(codeTable);
  if (codeMap.size > 0) {
    console.log(`  Loaded ${codeMap.size} value codes`);
  }

  // ── Ingest data ──
  let result;

  // Determine which table to ingest
  const formTable = meta.tables[CLDF_TYPES.FORM_TABLE];
  const valueTable = meta.tables[CLDF_TYPES.VALUE_TABLE];

  if (formTable && existsSync(formTable.filePath)) {
    console.log(`\n── Ingesting Wordlist (FormTable) ──`);
    result = await ingestWordlist(formTable, langMap, paramMap, opts, db, meta);
  } else if (valueTable && existsSync(valueTable.filePath)) {
    console.log(`\n── Ingesting StructureDataset (ValueTable) ──`);
    result = await ingestStructureDataset(valueTable, langMap, paramMap, codeMap, opts, db, meta);
  } else {
    console.error('  ✗ No FormTable or ValueTable found in metadata');
    console.error('    Available tables:', Object.keys(meta.tables).map(t => t.split('#')[1]));
    db.close();
    process.exit(1);
  }

  printResults(result, dbStats, db, opts);
  db.close();
}

function printResults(result, dbStats, db, opts) {
  const factsAfter = db._stmts.countFacts.get().count;

  console.log(`\n── Results ──`);
  console.log(`  Facts processed:  ${result.inserted}`);
  console.log(`  Rows skipped:     ${result.skipped} (empty value or missing ID)`);
  console.log(`  No language match: ${result.noLang}`);
  console.log(`  DB facts before:  ${dbStats.factsBefore}`);
  console.log(`  DB facts after:   ${factsAfter}`);
  console.log(`  Net new facts:    ${factsAfter - dbStats.factsBefore}`);

  if (opts.dryRun) {
    console.log(`\n  🏜️  DRY RUN — no changes written to database`);
  } else {
    console.log(`\n  ✅ Done`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
