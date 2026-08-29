/**
 * CLDF export test suite — exercises the pure builders in lib/cldf-export.mjs
 * with fixture facts + cards (no database needed), validates the ATLAS-emitted
 * StructureDataset (build/atlas/cldf/champollion-atlas/) when a build exists,
 * and, when the `cldf` CLI is installed, shells out to `cldf validate` for a
 * real conformance check. (The legacy export-cldf.mjs CLI is retired —
 * 2026-08-18, champollion.db retirement B7 — and must refuse to run.)
 *
 * The builders are pure (rows in → rows out), so those tests need no database.
 *
 * @see cli/lib/cldf-export.mjs
 * @see cli/scripts/cldf/build-atlas.mjs
 * @see docs/CLDF_EXPORT_SPEC.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  slug,
  paramKey,
  isIso639_3,
  assignLanguageIds,
  assignParameterIds,
  assignSourceKeys,
  parseCodeFromNotes,
  buildLanguageTable,
  buildParameterTable,
  buildValueTable,
  buildCodeTable,
  buildSourcesBib,
  buildMetadata,
  serializeCsv,
  tableColumnNames,
} from '../lib/cldf-export.mjs';
import { CLDF_TYPES, CLDF_DATASET_TYPES, CLDF_PROPERTIES } from '../lib/cldf-terms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

/** Minimal RFC-4180 CSV parser for round-trip assertions in tests. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function cldfAvailable() {
  try { execFileSync('cldf', ['--help'], { stdio: 'ignore' }); return true; } catch { return false; }
}

// ── Fixtures ───────────────────────────────────────────────────────────────

// crk: glottocode + coordinates; yor: a simple second language.
const CARDS = [
  { code: 'crk', name: 'Plains Cree', glottocode: 'plai1258', macroarea: 'North America', coordinates: { lat: 51.2437, lng: -110.463 } },
  { code: 'yor', name: 'Yoruba', glottocode: 'yoru1245', macroarea: 'Africa', coordinates: { lat: 7.15, lng: 3.67 } },
];

// A spread of fact shapes: categorical-with-code, derived-with-upstream-note,
// a value containing a comma (CSV quoting), and a plain boolean.
const FACTS = [
  { language_code: 'crk', domain: 'typology', property: 'Order of Subject, Object and Verb', value: 'No dominant order', value_type: 'string', source: 'wals', source_url: 'https://wals.info', confidence: 'api-derived', notes: 'code:81A-7' },
  { language_code: 'crk', domain: 'phonology', property: 'consonants', value: '21', value_type: 'integer', source: 'champollion-derived', source_url: '', confidence: 'cross-validated', notes: 'Median of 4 PHOIBLE inventories [derived from phoible-2.0]' },
  { language_code: 'crk', domain: 'typology', property: 'Noun incorporation', value: 'true', value_type: 'boolean', source: 'grambank-1.0.3', source_url: 'https://grambank.clld.org', confidence: 'api-derived', notes: null },
  { language_code: 'yor', domain: 'typology', property: 'Tone', value: 'Complex tone system', value_type: 'string', source: 'wals', source_url: 'https://wals.info', confidence: 'api-derived', notes: 'comment about tone | code:13A-3' },
];

const distinctParams = () => {
  const seen = new Map();
  for (const f of FACTS) {
    const k = paramKey(f.domain, f.property);
    if (!seen.has(k)) seen.set(k, { domain: f.domain, property: f.property, value_type: f.value_type });
  }
  return [...seen.values()];
};
const distinctSources = () => {
  const seen = new Map();
  for (const f of FACTS) if (!seen.has(f.source)) seen.set(f.source, { source: f.source, source_url: f.source_url });
  return [...seen.values()];
};

function buildAll() {
  const langIdByCode = assignLanguageIds(CARDS);
  const paramIdMap = assignParameterIds(distinctParams());
  const sourceKeyMap = assignSourceKeys(distinctSources());
  return {
    langIdByCode, paramIdMap, sourceKeyMap,
    langRows: buildLanguageTable(CARDS, langIdByCode),
    paramRows: buildParameterTable(distinctParams(), paramIdMap),
    valueRows: buildValueTable(FACTS, { langIdByCode, paramIdMap, sourceKeyMap }),
    codeRows: buildCodeTable(FACTS.filter((f) => /code:/.test(f.notes || '')), paramIdMap),
    bib: buildSourcesBib(distinctSources(), sourceKeyMap),
    metadata: buildMetadata({}),
  };
}

// ── slug / id assignment ─────────────────────────────────────────────────────

describe('slug + id assignment', () => {
  it('slug produces CLDF/BibTeX-safe ids', () => {
    assert.equal(slug('Order of Subject, Object and Verb'), 'order_of_subject_object_and_verb');
    assert.equal(slug('grambank-1.0.3'), 'grambank_1_0_3');
    assert.match(slug('Tone'), /^[a-z0-9_]+$/);
  });

  it('parameter ids are unique even when properties slug-collide', () => {
    const params = [
      { domain: 'typology', property: 'Foo, Bar' },
      { domain: 'typology', property: 'Foo Bar' }, // same slug as above
    ];
    const map = assignParameterIds(params);
    const ids = [...map.values()];
    assert.equal(new Set(ids).size, ids.length, 'all parameter ids must be unique');
  });

  it('language id prefers glottocode but falls back to ISO when shared', () => {
    const recs = [
      { code: 'crk', glottocode: 'plai1258' },
      { code: 'cwd', glottocode: 'plai1258' }, // shares glottocode with crk
    ];
    const map = assignLanguageIds(recs);
    assert.equal(new Set(map.values()).size, 2, 'shared glottocode must not collide');
    assert.ok(['crk', 'cwd'].includes(map.get('cwd')) || map.get('cwd') !== 'plai1258');
  });
});

describe('parseCodeFromNotes', () => {
  it('extracts a bare code', () => assert.equal(parseCodeFromNotes('code:6'), '6'));
  it('extracts a code combined with a comment', () => assert.equal(parseCodeFromNotes('a comment | code:13A-3'), '13A-3'));
  it('returns null when absent', () => assert.equal(parseCodeFromNotes('just a comment'), null));
  it('returns null for empty notes', () => assert.equal(parseCodeFromNotes(null), null));
});

// ── LanguageTable ────────────────────────────────────────────────────────────

describe('buildLanguageTable', () => {
  it('uses Glottocode as ID and keeps ISO in ISO639P3code', () => {
    const { langRows } = buildAll();
    const crk = langRows.find((r) => r.ISO639P3code === 'crk');
    assert.equal(crk.ID, 'plai1258', 'crk Language_ID must be its glottocode');
    assert.equal(crk.Name, 'Plains Cree');
    assert.equal(crk.Macroarea, 'North America');
    assert.equal(crk.Latitude, '51.2437');
  });

  it('falls back to ISO code as ID when a card has no glottocode', () => {
    const recs = [{ code: 'xyz', name: 'Test', glottocode: '' }];
    const langIdByCode = assignLanguageIds(recs);
    const rows = buildLanguageTable(recs, langIdByCode);
    assert.equal(rows[0].ID, 'xyz');
    assert.equal(rows[0].Glottocode, '');
  });
});

// ── ParameterTable ───────────────────────────────────────────────────────────

describe('buildParameterTable', () => {
  it('one row per distinct parameter, Name is the property', () => {
    const { paramRows } = buildAll();
    assert.equal(paramRows.length, distinctParams().length);
    assert.ok(paramRows.every((r) => r.ID && r.Name));
    assert.ok(paramRows.some((r) => r.Name === 'Tone' && r.Value_Type === 'string'));
  });
});

// ── ValueTable (the heart) ───────────────────────────────────────────────────

describe('buildValueTable', () => {
  it('every fact appears with resolvable Language_ID and Parameter_ID', () => {
    const { valueRows, langRows, paramRows } = buildAll();
    assert.equal(valueRows.length, FACTS.length);
    const langIds = new Set(langRows.map((r) => r.ID));
    const paramIds = new Set(paramRows.map((r) => r.ID));
    for (const v of valueRows) {
      assert.ok(langIds.has(v.Language_ID), `Language_ID ${v.Language_ID} resolves`);
      assert.ok(paramIds.has(v.Parameter_ID), `Parameter_ID ${v.Parameter_ID} resolves`);
    }
  });

  it('a categorical fact (code:…) populates Code_ID, resolving to a CodeTable row', () => {
    const { valueRows, codeRows } = buildAll();
    const codeIds = new Set(codeRows.map((r) => r.ID));
    const coded = valueRows.filter((v) => v.Code_ID);
    assert.ok(coded.length >= 2, 'fixtures include code:81A-7 and code:13A-3');
    for (const v of coded) assert.ok(codeIds.has(v.Code_ID), `Code_ID ${v.Code_ID} resolves to codes.csv`);
  });

  it('a champollion-derived fact keeps its [derived from] note and is NOT re-attributed', () => {
    const { valueRows, sourceKeyMap } = buildAll();
    const derived = valueRows.find((v) => /derived from/.test(v.Comment));
    assert.ok(derived, 'derived fact present');
    assert.match(derived.Comment, /\[derived from phoible-2\.0\]/);
    assert.equal(derived.Source, sourceKeyMap.get('champollion-derived'));
    assert.doesNotMatch(derived.Source, /phoible/, 'must NOT be attributed to the upstream');
  });

  it('serialization quotes values containing commas', () => {
    const { valueRows } = buildAll();
    const csv = serializeCsv('values', valueRows);
    assert.match(csv, /"No dominant order"|No dominant order/);
    // The parameter NAME "Order of Subject, Object and Verb" lives in parameters.csv;
    // confirm the comma-bearing value path is quoted when present.
    const withComma = serializeCsv('values', [{ ...valueRows[0], Value: 'a, b, c' }]);
    assert.match(withComma, /"a, b, c"/);
  });
});

// ── CodeTable ────────────────────────────────────────────────────────────────

describe('buildCodeTable', () => {
  it('deduplicates by (parameter, code) and uses the value label as Name', () => {
    const { codeRows } = buildAll();
    const ids = codeRows.map((r) => r.ID);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(codeRows.some((r) => r.Name === 'No dominant order'));
  });
});

// ── sources.bib ──────────────────────────────────────────────────────────────

describe('buildSourcesBib', () => {
  it('is deduplicated: N distinct sources → N @misc entries', () => {
    const { bib } = buildAll();
    const n = (bib.match(/^@misc\{/gm) || []).length;
    assert.equal(n, distinctSources().length);
  });

  it('champollion-derived bib entry is a derivation, not an upstream citation', () => {
    const { bib } = buildAll();
    assert.match(bib, /@misc\{champollion_derived,[\s\S]*?Champollion derivation/);
  });
});

// ── metadata ─────────────────────────────────────────────────────────────────

describe('buildMetadata', () => {
  it('parses as JSON and declares the four tables', () => {
    const { metadata } = buildAll();
    const round = JSON.parse(JSON.stringify(metadata));
    assert.equal(round['dc:conformsTo'], 'http://cldf.clld.org/v1.0/terms.rdf#StructureDataset');
    const urls = round.tables.map((t) => t.url).sort();
    assert.deepEqual(urls, ['codes.csv', 'languages.csv', 'parameters.csv', 'values.csv']);
  });

  it('ValueTable declares foreign keys to languages, parameters and codes', () => {
    const { metadata } = buildAll();
    const vt = metadata.tables.find((t) => t['dc:conformsTo'].endsWith('ValueTable'));
    const fkTargets = vt.tableSchema.foreignKeys.map((fk) => fk.reference.resource).sort();
    assert.deepEqual(fkTargets, ['codes.csv', 'languages.csv', 'parameters.csv']);
  });
});

// ── P1 acceptance: real `cldf validate` (skip-gated on CLI availability) ──────

describe('cldf validate (conformance)', () => {
  it('the generated dataset passes `cldf validate` with exit 0', (t) => {
    if (!cldfAvailable()) {
      t.skip('cldf CLI not installed (pip install pycldf). Manual: cldf validate <out>/StructureDataset-metadata.json');
      return;
    }
    const { langRows, paramRows, valueRows, codeRows, bib, metadata } = buildAll();
    const dir = mkdtempSync(join(tmpdir(), 'champollion-cldf-test-'));
    try {
      writeFileSync(join(dir, 'languages.csv'), serializeCsv('languages', langRows));
      writeFileSync(join(dir, 'parameters.csv'), serializeCsv('parameters', paramRows));
      writeFileSync(join(dir, 'values.csv'), serializeCsv('values', valueRows));
      writeFileSync(join(dir, 'codes.csv'), serializeCsv('codes', codeRows));
      writeFileSync(join(dir, 'sources.bib'), bib);
      writeFileSync(join(dir, 'StructureDataset-metadata.json'), JSON.stringify(metadata, null, 2));
      // Throws (non-zero exit) if validation fails.
      execFileSync('cldf', ['validate', join(dir, 'StructureDataset-metadata.json')], { stdio: 'pipe' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── ISO639P3code hygiene (hub cards / variants / conlangs) ───────────────────

describe('isIso639_3 + ISO639P3code column', () => {
  it('recognises only bare 3-letter ISO 639-3 shapes', () => {
    assert.ok(isIso639_3('crk'));
    assert.ok(isIso639_3('yor'));
    assert.ok(!isIso639_3('fra-CA'));
    assert.ok(!isIso639_3('family-algic'));
    assert.ok(!isIso639_3('x-yoda'));
    assert.ok(!isIso639_3('cmn-Hant'));
    assert.ok(!isIso639_3(''));
  });

  it('blanks ISO639P3code for non-ISO codes but still exports them under a valid ID', () => {
    const recs = [
      { code: 'x-yoda', name: 'Yoda-speak', glottocode: '' },
      { code: 'family-algic', name: 'Algic (family)', glottocode: 'algi1248' },
      { code: 'fra-CA', name: 'French (Canada)', glottocode: '' },
    ];
    const ids = assignLanguageIds(recs);
    const rows = buildLanguageTable(recs, ids);
    for (const r of rows) {
      assert.equal(r.ISO639P3code, '', `${r.Name} must have blank ISO639P3code`);
      assert.match(r.ID, /^[a-zA-Z0-9_-]+$/, 'ID stays CLDF-valid');
    }
    // Glottocode is still preserved when present.
    assert.equal(rows.find((r) => r.Name === 'Algic (family)').Glottocode, 'algi1248');
  });
});

// ── CSV round-trip (serialization fidelity) ──────────────────────────────────

describe('CSV serialization round-trips', () => {
  it('preserves values containing commas, quotes and newlines', () => {
    const rows = [
      { ID: 'a-b-1', Language_ID: 'a', Parameter_ID: 'b', Value: 'a, b, c', Code_ID: '', Source: 's', Source_URL: '', Confidence: '', Value_Type: 'string', Comment: 'has "quotes" and\nnewline' },
    ];
    const csv = serializeCsv('values', rows);
    const parsed = parseCsv(csv);
    const header = parsed[0];
    assert.deepEqual(header, tableColumnNames('values'));
    const rec = Object.fromEntries(header.map((h, i) => [h, parsed[1][i]]));
    assert.equal(rec.Value, 'a, b, c');
    assert.equal(rec.Comment, 'has "quotes" and\nnewline');
  });

  it('handles json-typed values and empty fields without corruption', () => {
    const facts = [
      { language_code: 'crk', domain: 'meta', property: 'profile', value: '{"a":1,"b":[2,3]}', value_type: 'json', source: 'champollion-derived', source_url: '', confidence: 'unverified', notes: null },
    ];
    const langIds = assignLanguageIds([{ code: 'crk', glottocode: 'plai1258' }]);
    const pIds = assignParameterIds([{ domain: 'meta', property: 'profile' }]);
    const sKeys = assignSourceKeys([{ source: 'champollion-derived' }]);
    const rows = buildValueTable(facts, { langIdByCode: langIds, paramIdMap: pIds, sourceKeyMap: sKeys });
    const parsed = parseCsv(serializeCsv('values', rows));
    const rec = Object.fromEntries(parsed[0].map((h, i) => [h, parsed[1][i]]));
    assert.equal(rec.Value, '{"a":1,"b":[2,3]}');
    assert.equal(rec.Value_Type, 'json');
    assert.equal(rec.Code_ID, '');
  });
});

// ── ingest-refactor regression guard ─────────────────────────────────────────

describe('cldf-terms shared vocabulary (ingest refactor guard)', () => {
  it('exposes the constants ingest-cldf.mjs depends on, with correct URIs', () => {
    assert.equal(CLDF_TYPES.VALUE_TABLE, 'http://cldf.clld.org/v1.0/terms.rdf#ValueTable');
    assert.equal(CLDF_TYPES.LANGUAGE_TABLE, 'http://cldf.clld.org/v1.0/terms.rdf#LanguageTable');
    assert.equal(CLDF_TYPES.PARAMETER_TABLE, 'http://cldf.clld.org/v1.0/terms.rdf#ParameterTable');
    assert.equal(CLDF_TYPES.CODE_TABLE, 'http://cldf.clld.org/v1.0/terms.rdf#CodeTable');
    assert.equal(CLDF_DATASET_TYPES.STRUCTURE, 'http://cldf.clld.org/v1.0/terms.rdf#StructureDataset');
    assert.equal(CLDF_PROPERTIES.LANGUAGE_REF, 'http://cldf.clld.org/v1.0/terms.rdf#languageReference');
    assert.equal(CLDF_PROPERTIES.PARAMETER_REF, 'http://cldf.clld.org/v1.0/terms.rdf#parameterReference');
    assert.equal(CLDF_PROPERTIES.GLOTTOCODE, 'http://cldf.clld.org/v1.0/terms.rdf#glottocode');
    // export-only additions present:
    assert.equal(CLDF_PROPERTIES.CODE_REF, 'http://cldf.clld.org/v1.0/terms.rdf#codeReference');
    assert.equal(CLDF_PROPERTIES.LATITUDE, 'http://cldf.clld.org/v1.0/terms.rdf#latitude');
  });

  it('the refactored ingester still parses (syntax + imports resolve)', () => {
    // node --check throws on parse/resolve failure.
    execFileSync('node', ['--check', join(CLI_ROOT, 'scripts', 'ingest-cldf.mjs')], { stdio: 'pipe' });
  });
});

// ── the ATLAS CLDF export (build/atlas/cldf/champollion-atlas) ────────────────
//
// The legacy export-cldf.mjs CLI is retired (2026-08-18, champollion.db
// retirement B7): the atlas IS CLDF and cli/scripts/cldf/build-atlas.mjs
// emits the canonical StructureDataset. This suite validates that emitted
// dataset when a build exists, hard-fails when a build exists but is
// malformed, and skips with a LOUD message when no build directory exists.

describe('atlas CLDF export (build/atlas/cldf/champollion-atlas)', () => {
  const REPO_ROOT = join(CLI_ROOT, '..');
  const atlasCldf = join(REPO_ROOT, 'build', 'atlas', 'cldf', 'champollion-atlas');
  const ARTIFACTS = ['languages.csv', 'parameters.csv', 'values.csv', 'codes.csv',
    'sources.bib', 'StructureDataset-metadata.json'];

  it('the emitted StructureDataset is present and structurally sound', (t) => {
    if (!existsSync(atlasCldf)) {
      t.skip('NO ATLAS CLDF BUILD at build/atlas/cldf/champollion-atlas/ — '
        + 'nothing validated. Run `node cli/scripts/cldf/build-atlas.mjs` to '
        + 'emit the dataset; a skipped run here is NOT a conformance verdict.');
      return;
    }

    // A build that exists but is incomplete/malformed is a hard failure.
    for (const f of ARTIFACTS) {
      assert.ok(existsSync(join(atlasCldf, f)), `${f} present in the emitted dataset`);
    }

    const metadata = JSON.parse(readFileSync(join(atlasCldf, 'StructureDataset-metadata.json'), 'utf8'));
    assert.equal(metadata['dc:conformsTo'], 'http://cldf.clld.org/v1.0/terms.rdf#StructureDataset');
    const urls = metadata.tables.map((tbl) => tbl.url).sort();
    for (const u of ['codes.csv', 'languages.csv', 'parameters.csv', 'values.csv']) {
      assert.ok(urls.includes(u), `metadata declares ${u}`);
    }

    // Referential integrity on a sample of values.csv (values.csv is ~90 MB;
    // the FULL check is `cldf validate` below when the CLI is installed).
    const idsOf = (file, col) => {
      const rows = parseCsv(readFileSync(join(atlasCldf, file), 'utf8'));
      const h = rows[0];
      const ci = h.indexOf(col);
      assert.ok(ci >= 0, `${file} has a ${col} column`);
      return new Set(rows.slice(1).map((r) => r[ci]).filter(Boolean));
    };
    const langSet = idsOf('languages.csv', 'ID');
    const paramSet = idsOf('parameters.csv', 'ID');
    const codeSet = idsOf('codes.csv', 'ID');

    const SAMPLE_BYTES = 4 * 1024 * 1024;
    const fd = readFileSync(join(atlasCldf, 'values.csv'), { encoding: 'utf8', flag: 'r' });
    const sample = fd.length > SAMPLE_BYTES
      ? fd.slice(0, fd.lastIndexOf('\n', SAMPLE_BYTES)) : fd;
    const vrows = parseCsv(sample);
    const vh = vrows[0];
    const iLang = vh.indexOf('Language_ID'), iParam = vh.indexOf('Parameter_ID'),
      iCode = vh.indexOf('Code_ID'), iSource = vh.indexOf('Source');
    assert.ok(iLang >= 0 && iParam >= 0 && iSource >= 0, 'values.csv header is CLDF-shaped');
    assert.ok(vrows.length > 1000, 'values sample carries rows');
    const bib = readFileSync(join(atlasCldf, 'sources.bib'), 'utf8');
    const bibKeys = new Set([...bib.matchAll(/^@\w+\{([^,]+),/gm)].map((m) => m[1]));
    for (const r of vrows.slice(1)) {
      assert.ok(langSet.has(r[iLang]), `Language_ID ${r[iLang]} resolves`);
      assert.ok(paramSet.has(r[iParam]), `Parameter_ID ${r[iParam]} resolves`);
      if (r[iCode]) assert.ok(codeSet.has(r[iCode]), `Code_ID ${r[iCode]} resolves`);
      if (r[iSource]) {
        for (const key of r[iSource].split(';')) {
          assert.ok(bibKeys.has(key.trim()), `Source ${key} resolves to sources.bib`);
        }
      }
    }

    // The canonical conformance checker, when available.
    if (cldfAvailable()) {
      execFileSync('cldf', ['validate', join(atlasCldf, 'StructureDataset-metadata.json')], { stdio: 'pipe' });
    } else {
      t.diagnostic('cldf CLI not installed — structural checks ran, `cldf validate` skipped');
    }
  });

  it('the retired export-cldf.mjs CLI refuses with guidance (exit 2)', () => {
    const script = join(CLI_ROOT, 'scripts', 'export-cldf.mjs');
    let code = 0, stderr = '';
    try {
      execFileSync('node', [script], { stdio: 'pipe' });
    } catch (err) {
      code = err.status;
      stderr = String(err.stderr);
    }
    assert.equal(code, 2, 'retired exporter must refuse, not run');
    assert.match(stderr, /build-atlas\.mjs/, 'refusal names the replacement');
  });
});
