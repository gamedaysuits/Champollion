/**
 * csv.mjs — shared RFC-4180 CSV utilities for the data scripts.
 * ────────────────────────────────────────────────────────────────
 * Character-stream parser: quoted fields may contain commas, escaped
 * quotes (""), and EMBEDDED NEWLINES. Line-based parsing (split('\n'),
 * readline, per-line regexes) silently truncates multi-line records —
 * that defect corrupted the Glottolog AES lane (see
 * derive-aes-values.mjs). Every CSV consumer in scripts/ should parse
 * through this module, not ad-hoc.
 *
 * Fail-loud: `expectColumns` makes ragged records (the signature of a
 * truncated or mis-derived file) a hard error instead of silent bad data.
 */

/**
 * Parse CSV text into an array of records (arrays of raw field strings).
 * Fields are NOT trimmed — callers trim where meaningful, so
 * parse→serialize round-trips byte-identically.
 *
 * @param {string} content - full CSV text (LF or CRLF)
 * @param {object} [opts]
 * @param {number} [opts.expectColumns] - if set, throw when any record
 *   has a different field count (ragged = corrupt/truncated input)
 * @param {string} [opts.file] - label used in error messages
 * @returns {string[][]} records, including the header record
 */
export function parseCSV(content, opts = {}) {
  const { expectColumns, file = 'CSV' } = opts;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch; // commas and newlines inside quotes are literal
      }
    } else if (ch === '"' && field.length === 0) {
      inQuotes = true; // opening quote at field start
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && content[i + 1] === '\n')) {
      if (ch === '\r') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error(
      `${file}: unterminated quoted field at end of input — file is truncated mid-record`
    );
  }

  // Strip UTF-8 BOM from the first header cell if present
  if (rows.length > 0 && rows[0].length > 0 && rows[0][0].startsWith('﻿')) {
    rows[0][0] = rows[0][0].slice(1);
  }

  if (expectColumns !== undefined) {
    for (let r = 0; r < rows.length; r++) {
      if (rows[r].length !== expectColumns) {
        throw new Error(
          `${file}: record ${r + 1} has ${rows[r].length} fields, expected ${expectColumns} ` +
          `(starts: ${JSON.stringify(rows[r][0] ?? '').slice(0, 60)}) — ` +
          `ragged records mean the file is corrupt or truncated`
        );
      }
    }
  }

  return rows;
}

/**
 * Parse CSV text into { header, rows } where each row is an object keyed
 * by header column names. Strict by default: every record must have
 * exactly as many fields as the header.
 *
 * @param {string} content - full CSV text
 * @param {object} [opts]
 * @param {string} [opts.file] - label used in error messages
 * @returns {{ header: string[], rows: Array<Record<string, string>> }}
 */
export function parseCSVObjects(content, opts = {}) {
  const records = parseCSV(content, { file: opts.file });
  if (records.length === 0) {
    throw new Error(`${opts.file || 'CSV'}: empty file`);
  }
  const header = records[0];
  // Enforce rectangularity against the header (re-check here rather than
  // in parseCSV so the error can name the offending record either way).
  parseCSV(content, { file: opts.file, expectColumns: header.length });

  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = records[r][c];
    rows.push(obj);
  }
  return { header, rows };
}

/**
 * Serialize records (arrays of strings) to RFC-4180 CSV text with LF
 * line endings and minimal quoting — a field is quoted only when it
 * contains a comma, quote, or newline (matches the upstream csvw style,
 * so unchanged records round-trip byte-identically).
 *
 * @param {Array<Array<string|number|null|undefined>>} rows
 * @returns {string} CSV text ending with a trailing newline
 */
export function serializeCSV(rows) {
  const out = [];
  for (const row of rows) {
    out.push(
      row
        .map((v) => {
          const s = v === null || v === undefined ? '' : String(v);
          if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
          return s;
        })
        .join(',')
    );
  }
  return out.join('\n') + '\n';
}
