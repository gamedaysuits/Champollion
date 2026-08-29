/**
 * CLDF StructureDataset export — pure builders (no I/O).
 *
 * These functions turn rows from the Champollion facts DB (the SSOT) into the
 * tables of a valid CLDF StructureDataset: languages.csv, parameters.csv,
 * values.csv, codes.csv, sources.bib and the StructureDataset-metadata.json
 * descriptor. They perform no file or database I/O — `cli/scripts/export-cldf.mjs`
 * reads the DB + cards and calls these — so every builder is trivially unit
 * testable (see cli/test/cldf-export.test.js).
 *
 * Round-trip framing (docs/DATA-ARCHITECTURE.md §4):
 *   download-cldf-datasets.mjs → ingest-cldf.mjs → [facts DB] → export-cldf.mjs (this)
 *
 * Design notes
 * ────────────
 *  • IDENTIFIERS ARE COLLISION-SAFE. CLDF requires every table ID to be unique
 *    and to match `[a-zA-Z0-9_\-]+`, and every *_ID reference to resolve. We
 *    therefore assign IDs up front (assignLanguageIds / assignParameterIds /
 *    assignSourceKeys) and pass the resulting maps into the row builders, so the
 *    LanguageTable/ParameterTable/CodeTable and the ValueTable references they
 *    point at are guaranteed consistent. This is why the builder signatures take
 *    id-maps rather than re-deriving ids per table.
 *  • PROVENANCE IS PRESERVED, NEVER REWRITTEN. A fact whose source is
 *    'champollion-derived' is emitted with Source = the champollion-derived bib
 *    key and keeps its `[derived from <upstream>]` note in the Comment column.
 *    It is never re-attributed to the upstream's name. Mirrors the doctrine in
 *    cli/scripts/audit-fact-provenance.mjs.
 *  • EXPORT FROM THE FACTS DB, NOT FROM CARD JSON. Card JSON is lossy/ambiguous
 *    for typed values; the DB carries value_type + per-fact provenance. Cards
 *    are used ONLY for language-level metadata (name, glottocode, coordinates).
 *
 * @module cldf-export
 */

import { CLDF_TYPES, CLDF_DATASET_TYPES, CLDF_PROPERTIES } from './cldf-terms.mjs';

// ---------------------------------------------------------------------------
// SLUG + COLLISION-SAFE ID ASSIGNMENT
// ---------------------------------------------------------------------------

/**
 * Slugify an arbitrary string to `[a-z0-9_]` (CLDF/BibTeX-safe). Strips
 * diacritics, lowercases, collapses runs of non-alphanumerics to '_'. Returns
 * '' for input that contains no Latin alphanumerics (callers supply a fallback).
 */
export function slug(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/\p{M}/gu, '') // strip combining marks (diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Stable composite key for a (domain, property) parameter. */
export function paramKey(domain, property) {
  return JSON.stringify([domain, property]);
}

function uniquify(base, used) {
  let id = base, i = 1;
  while (used.has(id)) id = `${base}-${++i}`;
  used.add(id);
  return id;
}

/**
 * Assign a unique CLDF Language ID per language code. Prefers the Glottocode
 * (so crk → "plai1258"); falls back to the ISO 639-3 code when the glottocode
 * is missing or shared by more than one code (ISO codes are globally unique).
 *
 * @param {Array<{code:string, glottocode?:string}>} records
 * @returns {Map<string,string>} language_code → Language_ID
 */
export function assignLanguageIds(records) {
  const glottoCount = new Map();
  for (const r of records) {
    const g = (r.glottocode || '').trim();
    if (g) glottoCount.set(g, (glottoCount.get(g) || 0) + 1);
  }
  const map = new Map();
  const used = new Set();
  // Pass 1: glottocode when it is present AND unique within the export set.
  for (const r of records) {
    const g = (r.glottocode || '').trim();
    if (g && glottoCount.get(g) === 1 && /^[a-zA-Z0-9_-]+$/.test(g)) {
      map.set(r.code, g);
      used.add(g);
    }
  }
  // Pass 2: everyone else gets a unique id derived from their (unique) ISO code.
  for (const r of records) {
    if (map.has(r.code)) continue;
    const base = slug(r.code) || slug(r.glottocode) || 'lang';
    map.set(r.code, uniquify(base, used));
  }
  return map;
}

/**
 * Assign a unique CLDF Parameter ID per (domain, property) pair.
 * @param {Array<{domain:string, property:string}>} params
 * @returns {Map<string,string>} paramKey(domain,property) → Parameter_ID
 */
export function assignParameterIds(params) {
  const map = new Map();
  const used = new Set();
  for (const p of params) {
    const key = paramKey(p.domain, p.property);
    if (map.has(key)) continue;
    let base = `${slug(p.domain)}__${slug(p.property)}`;
    if (base === '__' || base === '') base = 'param';
    map.set(key, uniquify(base, used));
  }
  return map;
}

/**
 * Assign a unique BibTeX/source key per source label.
 * @param {Array<string|{source:string}>} sources
 * @returns {Map<string,string>} source label → bib key
 */
export function assignSourceKeys(sources) {
  const map = new Map();
  const used = new Set();
  for (const s0 of sources) {
    const source = typeof s0 === 'string' ? s0 : s0.source;
    if (map.has(source)) continue;
    const base = slug(source) || 'source';
    map.set(source, uniquify(base, used));
  }
  return map;
}

/** Deterministic CLDF Code ID for a (parameter, raw-code) pair. */
export function codeId(paramId, rawCode) {
  return `${paramId}-${slug(rawCode) || 'x'}`;
}

/**
 * True only for a bare ISO 639-3 individual-language code shape (three lowercase
 * letters). Champollion's `code` namespace is wider than ISO 639-3 — it also
 * holds hub cards (`family-*`, `genus-*`, `macrolanguage-*`), BCP-47 regional
 * variants (`fra-CA`, `cmn-Hant`) and conlangs (`x-yoda`). Those are real
 * entities with facts, but they are NOT ISO 639-3 codes, so the CLDF
 * `ISO639P3code` column must be left blank for them (their `code` still drives
 * the Language_ID). This keeps `cldf validate` warning-free.
 */
export function isIso639_3(code) {
  return /^[a-z]{3}$/.test(code || '');
}

// ---------------------------------------------------------------------------
// NORMALIZERS + NOTE PARSING
// ---------------------------------------------------------------------------

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Normalize a language card OR a `languages`-table row into one shape.
 * Cards carry coordinates as { coordinates: { lat, lng } }; DB rows carry flat
 * `lat`/`lng`. Either is accepted.
 */
export function normalizeLanguageRecord(src) {
  let lat = null, lng = null;
  if (src.coordinates && typeof src.coordinates === 'object') {
    lat = num(src.coordinates.lat);
    lng = num(src.coordinates.lng);
  }
  if (lat == null) lat = num(src.lat);
  if (lng == null) lng = num(src.lng);
  return {
    code: src.code,
    name: src.name || src.code,
    glottocode: src.glottocode || '',
    macroarea: src.macroarea || '',
    lat,
    lng,
  };
}

/**
 * Extract the raw categorical code from a fact's `notes`. The ingester writes
 * `code:<Code_ID>` (e.g. "code:1A-1"), sometimes combined as "comment | code:X".
 * Returns the code string, or null.
 */
export function parseCodeFromNotes(notes) {
  if (!notes) return null;
  const m = String(notes).match(/code:\s*([^|\s]+)/);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// TABLE COLUMN SPECS — single source of truth for CSV headers + csvw columns
// ---------------------------------------------------------------------------

const ID_DATATYPE = { base: 'string', format: '[a-zA-Z0-9_\\-]+' };

/**
 * Each table's columns, in order. `prop` (a CLDF term URI) marks a standard
 * CLDF column; columns without `prop` are Champollion extension columns.
 * `foreignKeys` are [localColumn, targetResource, targetColumn] triples.
 */
export const TABLES = [
  {
    name: 'values',
    url: 'values.csv',
    conformsTo: CLDF_TYPES.VALUE_TABLE,
    columns: [
      { name: 'ID',           prop: CLDF_PROPERTIES.ID,            datatype: ID_DATATYPE, required: true },
      { name: 'Language_ID',  prop: CLDF_PROPERTIES.LANGUAGE_REF,  datatype: 'string', required: true },
      { name: 'Parameter_ID', prop: CLDF_PROPERTIES.PARAMETER_REF, datatype: 'string', required: true },
      { name: 'Value',        prop: CLDF_PROPERTIES.VALUE,         datatype: 'string', null: [''] },
      { name: 'Code_ID',      prop: CLDF_PROPERTIES.CODE_REF,      datatype: 'string', null: [''] },
      { name: 'Source',       prop: CLDF_PROPERTIES.SOURCE,        datatype: 'string', separator: ';' },
      { name: 'Source_URL',   datatype: 'string' },
      { name: 'Confidence',   datatype: 'string' },
      { name: 'Value_Type',   datatype: 'string' },
      { name: 'Comment',      prop: CLDF_PROPERTIES.COMMENT,       datatype: 'string' },
    ],
    primaryKey: ['ID'],
    foreignKeys: [
      ['Language_ID', 'languages.csv', 'ID'],
      ['Parameter_ID', 'parameters.csv', 'ID'],
      ['Code_ID', 'codes.csv', 'ID'],
    ],
  },
  {
    name: 'languages',
    url: 'languages.csv',
    conformsTo: CLDF_TYPES.LANGUAGE_TABLE,
    columns: [
      { name: 'ID',           prop: CLDF_PROPERTIES.ID,        datatype: ID_DATATYPE, required: true },
      { name: 'Name',         prop: CLDF_PROPERTIES.NAME,      datatype: 'string' },
      { name: 'ISO639P3code', prop: CLDF_PROPERTIES.ISO639P3,  datatype: 'string' },
      { name: 'Glottocode',   prop: CLDF_PROPERTIES.GLOTTOCODE, datatype: 'string' },
      { name: 'Macroarea',    prop: CLDF_PROPERTIES.MACROAREA, datatype: 'string' },
      { name: 'Latitude',     prop: CLDF_PROPERTIES.LATITUDE,  datatype: { base: 'decimal', minimum: -90, maximum: 90 }, null: [''] },
      { name: 'Longitude',    prop: CLDF_PROPERTIES.LONGITUDE, datatype: { base: 'decimal', minimum: -180, maximum: 180 }, null: [''] },
    ],
    primaryKey: ['ID'],
  },
  {
    name: 'parameters',
    url: 'parameters.csv',
    conformsTo: CLDF_TYPES.PARAMETER_TABLE,
    columns: [
      { name: 'ID',          prop: CLDF_PROPERTIES.ID,          datatype: ID_DATATYPE, required: true },
      { name: 'Name',        prop: CLDF_PROPERTIES.NAME,        datatype: 'string' },
      { name: 'Description', prop: CLDF_PROPERTIES.DESCRIPTION, datatype: 'string' },
      { name: 'Value_Type',  datatype: 'string' },
    ],
    primaryKey: ['ID'],
  },
  {
    name: 'codes',
    url: 'codes.csv',
    conformsTo: CLDF_TYPES.CODE_TABLE,
    columns: [
      { name: 'ID',           prop: CLDF_PROPERTIES.ID,            datatype: ID_DATATYPE, required: true },
      { name: 'Parameter_ID', prop: CLDF_PROPERTIES.PARAMETER_REF, datatype: 'string', required: true },
      { name: 'Name',         prop: CLDF_PROPERTIES.NAME,          datatype: 'string' },
      { name: 'Description',  prop: CLDF_PROPERTIES.DESCRIPTION,   datatype: 'string' },
    ],
    primaryKey: ['ID'],
    foreignKeys: [
      ['Parameter_ID', 'parameters.csv', 'ID'],
    ],
  },
];

/** Ordered column names for a table (CSV header order). */
export function tableColumnNames(tableName) {
  const t = TABLES.find((x) => x.name === tableName);
  if (!t) throw new Error(`unknown CLDF table: ${tableName}`);
  return t.columns.map((c) => c.name);
}

// ---------------------------------------------------------------------------
// ROW BUILDERS
// ---------------------------------------------------------------------------

/**
 * @param {Array<object>} records  language cards and/or `languages` rows
 * @param {Map<string,string>} langIdByCode  from assignLanguageIds
 * @returns {Array<object>} languages.csv rows
 */
export function buildLanguageTable(records, langIdByCode) {
  const rows = [];
  const seen = new Set();
  for (const src of records) {
    const r = normalizeLanguageRecord(src);
    const id = langIdByCode.get(r.code);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      ID: id,
      Name: r.name,
      ISO639P3code: isIso639_3(r.code) ? r.code : '',
      Glottocode: r.glottocode,
      Macroarea: r.macroarea,
      Latitude: r.lat == null ? '' : String(r.lat),
      Longitude: r.lng == null ? '' : String(r.lng),
    });
  }
  return rows;
}

/**
 * @param {Array<{domain:string, property:string, value_type?:string}>} params  distinct parameters
 * @param {Map<string,string>} paramIdMap  from assignParameterIds
 * @param {Map<string,string>} [descByProperty]  optional property → description (P2)
 * @returns {Array<object>} parameters.csv rows
 */
export function buildParameterTable(params, paramIdMap, descByProperty = new Map()) {
  const rows = [];
  const seen = new Set();
  for (const p of params) {
    const id = paramIdMap.get(paramKey(p.domain, p.property));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      ID: id,
      Name: p.property,
      Description: descByProperty.get(p.property) || '',
      Value_Type: p.value_type || p.valueType || '',
    });
  }
  return rows;
}

/**
 * The heart of the export: one ValueTable row per fact, with resolvable
 * Language_ID / Parameter_ID / Code_ID / Source references. Facts whose
 * language or parameter cannot be resolved are skipped (the CLI logs the count
 * — fail-loud, never silent on aggregate). Source provenance is preserved
 * verbatim; derived facts keep their `[derived from …]` note in Comment.
 *
 * @param {Array<object>} factRows  facts-table rows
 * @param {{langIdByCode:Map, paramIdMap:Map, sourceKeyMap:Map}} maps
 * @returns {Array<object>} values.csv rows
 */
export function buildValueTable(factRows, { langIdByCode, paramIdMap, sourceKeyMap }) {
  const rows = [];
  const counter = new Map(); // `${langId}|${paramId}` → running n
  for (const f of factRows) {
    const langId = langIdByCode.get(f.language_code);
    const paramId = paramIdMap.get(paramKey(f.domain, f.property));
    if (!langId || !paramId) continue; // unresolvable reference → skip
    const rawCode = parseCodeFromNotes(f.notes);
    const ck = `${langId}|${paramId}`;
    const n = (counter.get(ck) || 0) + 1;
    counter.set(ck, n);
    rows.push({
      ID: `${langId}-${paramId}-${n}`,
      Language_ID: langId,
      Parameter_ID: paramId,
      Value: f.value == null ? '' : String(f.value),
      Code_ID: rawCode ? codeId(paramId, rawCode) : '',
      Source: sourceKeyMap.get(f.source) || '',
      Source_URL: f.source_url || '',
      Confidence: f.confidence || '',
      Value_Type: f.value_type || '',
      Comment: f.notes || '',
    });
  }
  return rows;
}

/**
 * CodeTable (P2): one row per distinct (parameter, raw-code). The human-readable
 * label is the fact `value` (the ingester stores labels, not bare codes). IDs
 * match codeId() so every ValueTable.Code_ID resolves.
 *
 * @param {Array<{domain:string, property:string, value:any, notes?:string, code?:string}>} codeRows
 * @param {Map<string,string>} paramIdMap
 * @returns {Array<object>} codes.csv rows
 */
export function buildCodeTable(codeRows, paramIdMap) {
  const rows = [];
  const seen = new Set();
  for (const c of codeRows) {
    const paramId = paramIdMap.get(paramKey(c.domain, c.property));
    const rawCode = c.code != null ? c.code : parseCodeFromNotes(c.notes);
    if (!paramId || !rawCode) continue;
    const id = codeId(paramId, rawCode);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      ID: id,
      Parameter_ID: paramId,
      Name: c.value == null ? '' : String(c.value),
      Description: '',
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// sources.bib
// ---------------------------------------------------------------------------

function bibValue(v) {
  // BibTeX field values: drop braces (we wrap in {}), collapse newlines.
  return String(v == null ? '' : v).replace(/[{}]/g, '').replace(/\s*\n\s*/g, ' ').trim();
}

function bibEntry(key, source, url, license) {
  const isDerived = source === 'champollion-derived';
  const fields = [];
  fields.push(`  title = {${bibValue(isDerived
    ? 'Champollion-derived values (computed; see per-value "[derived from <upstream>]" notes)'
    : source)}}`);
  fields.push(`  author = {${bibValue(isDerived ? 'Champollion' : source)}}`);
  if (url) fields.push(`  url = {${bibValue(url)}}`);

  const note = [];
  if (isDerived) note.push('Champollion derivation — not an assertion by any upstream dataset');
  if (license) {
    if (license.license_spdx) note.push(`License: ${license.license_spdx}`);
    else if (license.license_url) note.push(`License: ${license.license_url}`);
    if (license.attribution) note.push(`Attribution: ${license.attribution}`);
    if (license.non_commercial_only) note.push('Non-commercial use only');
    if (license.requires_sharealike) note.push('ShareAlike required');
  }
  if (note.length) fields.push(`  note = {${bibValue(note.join('. '))}}`);

  return `@misc{${key},\n${fields.join(',\n')}\n}`;
}

/**
 * Build a deduplicated BibTeX sources file: one @misc entry per distinct source.
 *
 * @param {Array<string|{source:string, source_url?:string}>} sources
 * @param {Map<string,string>} sourceKeyMap  from assignSourceKeys
 * @param {Map<string,object>} [licenses]  source → source_licenses row (P2)
 * @returns {string} BibTeX text
 */
export function buildSourcesBib(sources, sourceKeyMap, licenses = new Map()) {
  const seen = new Set();
  const entries = [];
  for (const s0 of sources) {
    const source = typeof s0 === 'string' ? s0 : s0.source;
    const key = sourceKeyMap.get(source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const url = typeof s0 === 'object' ? (s0.source_url || '') : '';
    entries.push(bibEntry(key, source, url, licenses.get(source)));
  }
  return entries.join('\n\n') + (entries.length ? '\n' : '');
}

// ---------------------------------------------------------------------------
// metadata descriptor
// ---------------------------------------------------------------------------

function toCsvwColumn(c) {
  const out = { name: c.name };
  if (c.datatype) out.datatype = c.datatype;
  if (c.prop) out.propertyUrl = c.prop;
  if (c.separator) out.separator = c.separator;
  if (c.null) out.null = c.null;
  if (c.required) out.required = true;
  return out;
}

/**
 * Build the StructureDataset-metadata.json descriptor (a plain JS object).
 * Mirrors the canonical CLDF metadata shape (see any StructureDataset-metadata
 * .json under cli/data/) so `cldf validate` recognises the module and checks
 * referential integrity.
 */
export function buildMetadata({
  id = 'champollion',
  title = 'Champollion Language Facts (CLDF StructureDataset)',
  license = 'CC-BY-4.0',
  accessURL = '',
  citation = 'Champollion — open translation infrastructure for low-resource languages. Per-source licenses and citations in sources.bib.',
} = {}) {
  return {
    '@context': ['http://www.w3.org/ns/csvw', { '@language': 'en' }],
    'dc:conformsTo': CLDF_DATASET_TYPES.STRUCTURE,
    'dc:source': 'sources.bib',
    'dc:title': title,
    'dc:license': license,
    'dc:bibliographicCitation': citation,
    ...(accessURL ? { 'dcat:accessURL': accessURL } : {}),
    'rdf:ID': id,
    'rdf:type': 'http://www.w3.org/ns/dcat#Distribution',
    tables: TABLES.map((t) => ({
      url: t.url,
      'dc:conformsTo': t.conformsTo,
      tableSchema: {
        columns: t.columns.map(toCsvwColumn),
        ...(t.foreignKeys
          ? {
              foreignKeys: t.foreignKeys.map(([col, resource, refcol]) => ({
                columnReference: [col],
                reference: { resource, columnReference: [refcol] },
              })),
            }
          : {}),
        primaryKey: t.primaryKey,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV serialization (RFC-4180 minimal quoter — no new dependency)
// ---------------------------------------------------------------------------

/** Quote a single CSV field if it contains a comma, quote, or newline. */
export function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize one row (array of values) to a CSV line (no trailing newline). */
export function csvLine(values) {
  return values.map(csvField).join(',');
}

/**
 * Serialize a whole table (header + rows) to a CSV string. Convenient for the
 * small tables and for tests; the CLI streams large tables with csvLine().
 *
 * @param {string} tableName  one of TABLES[].name
 * @param {Array<object>} rows  row objects keyed by CLDF column name
 */
export function serializeCsv(tableName, rows) {
  const names = tableColumnNames(tableName);
  const lines = [csvLine(names)];
  for (const row of rows) lines.push(csvLine(names.map((n) => row[n])));
  return lines.join('\n') + '\n';
}
