/**
 * cldf-values.test.js — the one writer, and what it refuses.
 *
 * Seventeen near-identical INSERT statements across fourteen handlers became
 * one. These tests hold the invariants that were previously enforced in each
 * handler's own copy, or — mostly — in none of them.
 *
 * The `Variant` column is the reason this exists. Counted across the handlers it
 * held six different things: a method key, a dataset name, a script code, the
 * language a label is written in, the territory a status applies in, and an
 * ORDINAL used only to keep `ancestry` in order. Its meaning depended on which
 * parameter the row belonged to, so nothing could join it back to what it named.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseCSVObjects } from '../scripts/lib/csv.mjs';
import { openAtlas, loadParameters } from '../scripts/cldf/schema.mjs';
import {
  valueWriter, valueId, assertSubjectIntegrity, SUBJECT, VARIANT, STATUS,
} from '../scripts/cldf/values.mjs';

const REPO = path.join(import.meta.dirname, '..', '..');
const parameters = parseCSVObjects(
  fs.readFileSync(path.join(REPO, 'shared', 'cldf', 'parameters.csv'), 'utf-8'),
  { file: 'parameters.csv' },
).rows;

function scratch(name) {
  const file = path.join(REPO, 'build', `test-values-${name}.db`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = openAtlas({ fresh: true, file });
  loadParameters(db, parameters);
  db.prepare("INSERT INTO cldf_languages (ID, Name) VALUES ('crk','Plains Cree')").run();
  db.prepare(`INSERT INTO cldf_contributions (ID, Type, Name)
              VALUES ('flores-plus','corpus','FLORES+'), ('opus-mt','method','OPUS-MT')`).run();
  db.prepare(`INSERT INTO cldf_sources (ID, License, Redistributable, Commercial_Use)
              VALUES ('src-a','CC-BY-4.0',1,1)`).run();
  const done = () => { db.close(); fs.rmSync(file, { force: true }); };
  return { db, done };
}

const writerFor = (db, subjectType = SUBJECT.LANGUAGE) =>
  valueWriter(db, { sourceId: 'src-a', createdBy: 'test', subjectType });

describe('a value is about a subject, not only a language', () => {
  test('languages, corpora and methods travel the same table', () => {
    const { db, done } = scratch('subjects');
    writerFor(db)('crk', 'endangerment', 'threatened');
    writerFor(db, SUBJECT.CORPUS)('flores-plus', 'endangerment', 'x');
    writerFor(db, SUBJECT.METHOD)('opus-mt', 'endangerment', 'y');
    const rows = db.prepare('SELECT Subject_Type, COUNT(*) n FROM cldf_values GROUP BY Subject_Type')
      .all();
    assert.equal(rows.length, 3, 'all three subject types write to one table');
    done();
  });

  test('a subject that resolves in no node table is caught', () => {
    // The constraint SQLite cannot express: a foreign key whose target depends
    // on another column. Without this check a typo'd subject id is simply a
    // fact about nothing.
    const { db, done } = scratch('integrity');
    writerFor(db)('crk', 'endangerment', 'threatened');
    assert.equal(assertSubjectIntegrity(db).ok, true);

    writerFor(db)('nonexistent-language', 'endangerment', 'threatened');
    const bad = assertSubjectIntegrity(db);
    assert.equal(bad.ok, false);
    assert.equal(bad.dangling[0].Subject_ID, 'nonexistent-language');
    done();
  });

  test('a corpus id used as a language subject is caught', () => {
    // It exists — in the WRONG table. A check that only asked "does this id
    // exist anywhere" would pass it.
    const { db, done } = scratch('wrongtable');
    writerFor(db)('flores-plus', 'endangerment', 'threatened');
    assert.equal(assertSubjectIntegrity(db).ok, false);
    done();
  });

  test('an unknown subject type is refused', () => {
    const { db, done } = scratch('badsubject');
    assert.throws(
      () => valueWriter(db, { sourceId: 'src-a', createdBy: 't', subjectType: 'planet' }),
      /unknown subject type/,
    );
    done();
  });
});

describe('variant discriminates; sequence orders', () => {
  test('the same parameter takes several values when the variant differs', () => {
    const { db, done } = scratch('variants');
    const w = writerFor(db);
    w('crk', 'methodSupport', 'service', { variantType: VARIANT.METHOD, variantId: 'google' });
    w('crk', 'methodSupport', 'open', { variantType: VARIANT.METHOD, variantId: 'nllb' });
    assert.equal(db.prepare("SELECT COUNT(*) n FROM cldf_values WHERE Parameter_ID='methodSupport'")
      .get().n, 2);
    done();
  });

  test('half a variant is refused', () => {
    // A type with no id, or an id with no type, resolves against nothing —
    // which is the state the old single column left every consumer in.
    const { db, done } = scratch('halfvariant');
    const w = writerFor(db);
    assert.throws(() => w('crk', 'methodSupport', 'x', { variantType: VARIANT.METHOD }),
      /must be given together/);
    assert.throws(() => w('crk', 'methodSupport', 'x', { variantId: 'google' }),
      /must be given together/);
    done();
  });

  test('an ordinal masquerading as a discriminator is refused, and says so', () => {
    // `ancestry` used variant: String(i).padStart(2,'0'). The error names the
    // right column rather than letting the mistake back in.
    const { db, done } = scratch('ordinal');
    assert.throws(
      () => writerFor(db)('crk', 'ancestry', 'algi1248', { variantType: 'ordinal', variantId: '00' }),
      /use sequence/,
    );
    done();
  });

  test('sequence orders a list without becoming part of its identity', () => {
    // Reordering must not look like a set of new facts, so Sequence is
    // deliberately absent from the value id and from the unique key.
    const { db, done } = scratch('sequence');
    const a = valueId({
      source: 'src-a', subjectType: 'language', subjectId: 'crk', parameter: 'ancestry',
      variantType: null, variantId: null, value: 'algi1248',
    });
    writerFor(db)('crk', 'ancestry', 'algi1248', { sequence: 0 });
    const row = db.prepare("SELECT * FROM cldf_values WHERE Parameter_ID='ancestry'").get();
    assert.equal(row.ID, a, 'the id does not depend on position');
    assert.equal(row.Sequence, 0, 'but the position is kept');
    done();
  });
});

describe('absence is a value, and it is checked here first', () => {
  test('an absence carrying a value is refused by name', () => {
    // The schema CHECK catches this too, but it cannot say WHICH parameter, and
    // a constraint failure ten frames deep is a poor way to learn a handler
    // mislabelled an absence.
    const { db, done } = scratch('absencevalue');
    assert.throws(
      () => writerFor(db)('crk', 'toneCount', '5', { status: STATUS.NOT_ATTESTED }),
      /toneCount.*neither an absence nor a fact/s,
    );
    done();
  });

  test('an empty asserted value writes nothing rather than an empty string', () => {
    const { db, done } = scratch('emptyassert');
    const w = writerFor(db);
    for (const empty of [null, undefined, '']) {
      assert.equal(w('crk', 'endangerment', empty), false);
    }
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cldf_values').get().n, 0);
    done();
  });

  test('both absence kinds are distinguishable on the row', () => {
    const { db, done } = scratch('absencekinds');
    const w = writerFor(db);
    w.absent('crk', 'toneCount', STATUS.NOT_ATTESTED);
    w.absent('crk', 'caseCount', STATUS.NOT_SURVEYED);
    const kinds = db.prepare('SELECT Status FROM cldf_values ORDER BY Parameter_ID').all()
      .map((r) => r.Status);
    assert.deepEqual(kinds, ['not_surveyed', 'not_attested']);
    done();
  });

  test('an unknown status is refused', () => {
    const { db, done } = scratch('badstatus');
    assert.throws(() => writerFor(db)('crk', 'toneCount', null, { status: 'maybe' }),
      /unknown status/);
    done();
  });
});

describe('a value cannot be written without provenance', () => {
  test('no source, no writer', () => {
    const { db, done } = scratch('nosource');
    assert.throws(() => valueWriter(db, { createdBy: 't' }), /sourceId/);
    assert.throws(() => valueWriter(db, { sourceId: 'src-a' }), /createdBy/);
    done();
  });

  test('the same claim from the same source is written once', () => {
    const { db, done } = scratch('idempotent');
    const w = writerFor(db);
    w('crk', 'endangerment', 'threatened');
    w('crk', 'endangerment', 'threatened');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cldf_values').get().n, 1,
      'a rebuild from identical pins must not multiply rows');
    done();
  });
});

describe('the discriminator vocabulary is declared twice and must agree', () => {
  // values.mjs says which axis a handler MEANT; the schema CHECK says the store
  // will not hold one nobody declared. Two declarations is deliberate — adding
  // an axis should be a decision made in both places — but two declarations
  // that drift give you a handler writing a variant the store silently refuses,
  // which surfaced exactly once as a build failure three sources deep.
  test('values.mjs and the schema CHECK enumerate the same axes', async () => {
    const { VARIANT } = await import('../scripts/cldf/values.mjs');
    const schema = fs.readFileSync(
      path.join(import.meta.dirname, '..', 'scripts', 'cldf', 'schema.mjs'), 'utf-8',
    );
    const m = /Variant_Type IN \(([^)]*)\)/s.exec(schema);
    assert.ok(m, 'the schema must enumerate Variant_Type');
    const inSchema = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    assert.deepEqual(
      inSchema, Object.values(VARIANT).sort(),
      'the value layer and the store disagree about which discriminators exist',
    );
  });
});
