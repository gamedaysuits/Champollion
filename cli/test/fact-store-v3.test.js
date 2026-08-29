/**
 * fact-store-v3 test suite — the three things the store could not do before.
 *
 * Each of these corresponds to wrong data the audit found in production, not
 * to a hypothetical. If any of them regresses, the same class of error returns.
 *
 *   MULTI-VALUE  UNIQUE(language_code, domain, property, source) meant a source
 *                asserting two speaker estimates silently REPLACED its own
 *                first one. speakerEstimates[] — 5,979 cards showing competing
 *                estimates attributed, which is the project's stated doctrine —
 *                could not round-trip through the store at all.
 *
 *   ABSENCE      `value TEXT NOT NULL` meant every row had to assert something,
 *                so "we looked and there is no documented script" and "nobody
 *                looked" were the same state. That conflation is how
 *                orthographicStatus:"unwritten" came to be published about
 *                1,318 languages — 1,059 living, with real speaker counts —
 *                because WE had failed to harvest a script.
 *
 *   PINS         Only 8 of 318 sources recorded any version. Without a pin you
 *                cannot say WHICH bytes a fact came from, so "regenerate from
 *                source" is unverifiable by construction.
 *
 * @see cli/scripts/db.mjs
 * @see cli/scripts/migrate-fact-store-v3.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { openDatabase } from '../scripts/db.mjs';

let dbPath;
let db;

const base = {
  languageCode: 'tst', domain: 'vitality', property: 'speakerCount',
  valueType: 'integer', source: 'linguameta', confidence: 'verified',
  retrievedAt: '2026-08-02T00:00:00Z', createdBy: 'fact-store-v3.test.js',
};

before(() => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'champ-v3-')), 'probe.db');
  db = openDatabase(dbPath);
  db.insertLanguage({ code: 'tst', name: 'Test Language' });
});

after(() => {
  try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('fact store v3 — multi-value', () => {
  it('keeps two estimates from the SAME source', () => {
    db.insertFact({ ...base, value: '4100', variant: '2024-estimate' });
    db.insertFact({ ...base, value: '34000', variant: '2016-estimate' });

    const rows = db._db.prepare(
      "SELECT value, variant FROM facts WHERE property = 'speakerCount' ORDER BY variant",
    ).all();
    assert.equal(rows.length, 2,
      'a source asserting two estimates must keep both — this is the constraint '
      + 'that made speakerEstimates[] unstorable');
    assert.deepEqual(rows.map((r) => r.value).sort(), ['34000', '4100']);
  });

  it('still collapses a genuine duplicate (same variant)', () => {
    db.insertFact({ ...base, property: 'dupTest', value: '1', variant: '' });
    db.insertFact({ ...base, property: 'dupTest', value: '2', variant: '' });
    const rows = db._db.prepare("SELECT value FROM facts WHERE property = 'dupTest'").all();
    assert.equal(rows.length, 1, 'same (lang, domain, property, source, variant) is still one row');
    assert.equal(rows[0].value, '2', 'last write wins, as before');
  });
});

describe('fact store v3 — absence is a fact', () => {
  it('records "we looked and found nothing" without asserting a value', () => {
    db.insertFact({
      ...base, domain: 'orthography', property: 'script', valueType: 'string',
      status: 'not_attested', source: 'scriptsource',
    });
    const row = db._db.prepare("SELECT value, status FROM facts WHERE property = 'script'").get();
    assert.equal(row.status, 'not_attested');
    assert.equal(row.value, null, 'an absence asserts nothing, so it stores nothing');
  });

  it('distinguishes not_attested from not_surveyed', () => {
    db.insertFact({
      ...base, domain: 'orthography', property: 'scriptB', valueType: 'string',
      status: 'not_surveyed', source: 'some-source-that-omits-this-language',
    });
    const row = db._db.prepare("SELECT status FROM facts WHERE property = 'scriptB'").get();
    assert.equal(row.status, 'not_surveyed',
      '"the source does not cover this language" is not the same claim as '
      + '"the source covers it and records nothing"');
  });

  it('REJECTS an absence that smuggles in a value', () => {
    assert.throws(
      () => db.insertFact({
        ...base, property: 'sneaky', value: 'ltr', status: 'not_surveyed',
      }),
      /asserts nothing/,
      'the whole point of the status column is that these two states stay distinct',
    );
  });

  it('still requires a value when the fact ASSERTS something', () => {
    assert.throws(
      () => db.insertFact({ ...base, property: 'noValue' }),
      /Missing required field 'value'/,
    );
  });

  it('rejects an unknown status rather than storing it', () => {
    assert.throws(
      () => db.insertFact({ ...base, property: 'badStatus', value: '1', status: 'probably' }),
      /Invalid status/,
    );
  });
});

describe('fact store v3 — source pins', () => {
  it('refuses a release that identifies nothing', () => {
    assert.throws(
      () => db.insertSourceRelease({ source: 'nopin', fetchedAt: '2026-08-02T00:00:00Z' }),
      /no pin/,
      'a release with no version, commit, DOI or checksum names no particular bytes',
    );
  });

  it('accepts any single pin and links a fact to it', () => {
    const id = db.insertSourceRelease({
      source: 'glottolog', version: '5.3', doi: '10.5281/zenodo.15525265',
      sha256: 'a'.repeat(64), fetchedAt: '2026-08-02T00:00:00Z', fetchedBy: 'test',
    });
    assert.ok(id > 0);

    db.insertFact({ ...base, property: 'pinned', value: '7', sourceReleaseId: id });
    const row = db._db.prepare(
      'SELECT f.source_release_id, r.doi, r.version FROM facts f '
      + 'JOIN source_releases r ON r.id = f.source_release_id '
      + "WHERE f.property = 'pinned'",
    ).get();
    assert.equal(row.version, '5.3');
    assert.equal(row.doi, '10.5281/zenodo.15525265',
      'a fact must be able to answer "which bytes said this"');
  });

  it('is idempotent — re-registering the same release reuses the row', () => {
    const args = {
      source: 'wals', version: '2020.4', fetchedAt: '2026-08-02T00:00:00Z',
    };
    const a = db.insertSourceRelease(args);
    const b = db.insertSourceRelease(args);
    assert.equal(a, b, 'a re-run must not multiply releases');
  });
});

describe('fact store v3 — derivation lineage', () => {
  it('records which facts a derived fact came from', () => {
    const inputs = db._db.prepare('SELECT id FROM facts LIMIT 2').all().map((r) => r.id);
    db.insertFact({ ...base, property: 'derivedThing', value: '99', source: 'champollion-derived' });
    const derived = db._db.prepare(
      "SELECT id FROM facts WHERE property = 'derivedThing'",
    ).get().id;

    db.recordLineage(derived, inputs);
    const edges = db._db.prepare(
      'SELECT input_fact_id FROM fact_lineage WHERE derived_fact_id = ?',
    ).all(derived).map((r) => r.input_fact_id);

    assert.deepEqual(edges.sort(), inputs.sort(),
      'replaces the prose convention notes:"[derived from glottolog-5.0]" with '
      + 'an edge that can actually be followed and invalidated');
  });
});

describe('fact store v3 — a fresh database is born correct', () => {
  it('applySchema produces the same shape the migration produces', () => {
    const cols = db._db.prepare('PRAGMA table_info(facts)').all().map((c) => c.name);
    for (const required of ['status', 'variant', 'source_release_id']) {
      assert.ok(cols.includes(required), `fresh schema is missing facts.${required}`);
    }
    const tables = db._db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
    ).all().map((t) => t.name);
    assert.ok(tables.includes('source_releases'));
    assert.ok(tables.includes('fact_lineage'));
  });
});
