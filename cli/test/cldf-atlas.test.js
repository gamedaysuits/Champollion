/**
 * cldf-atlas.test.js — the refusals that keep an indefensible value out.
 *
 * Each test here corresponds to a way the previous corpus went wrong. They are
 * not coverage for its own sake; they are the specific mistakes we know this
 * codebase makes, written down so it cannot make them again quietly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { parseCSVObjects } from '../scripts/lib/csv.mjs';
import { openAtlas, loadParameters } from '../scripts/cldf/schema.mjs';
import { spineResolver } from '../scripts/cldf/spine.mjs';
import { projectCards } from '../scripts/cldf/project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const CLDF_DIR = path.join(REPO, 'shared', 'cldf');

const parameters = parseCSVObjects(
  fs.readFileSync(path.join(CLDF_DIR, 'parameters.csv'), 'utf-8'),
  { file: 'parameters.csv' },
).rows;

/** A throwaway store with the parameter registry loaded. */
function scratch(name) {
  const file = path.join(REPO, 'build', `test-${name}.db`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = openAtlas({ fresh: true, file });
  loadParameters(db, parameters);
  db.prepare("INSERT INTO cldf_languages (ID, Name) VALUES ('crk','Plains Cree')").run();
  db.prepare(`INSERT INTO cldf_sources (ID, License, Redistributable, Commercial_Use)
              VALUES ('src-a','CC-BY-4.0',1,1), ('src-b','CC-BY-4.0',1,1)`).run();
  return { db, file };
}

/**
 * Values are keyed on a SUBJECT now, not a language — so corpora and methods
 * carry facts through the same table. The tests still say `Language_ID` because
 * that is what they are about; the helper translates, which keeps 30-odd cases
 * readable while the store stays general.
 */
const addValue = (db, o) => {
  const { Language_ID: lang, Variant_Type: vt = null, Variant_ID: vid = null, ...rest } = o;
  return db.prepare(`
    INSERT INTO cldf_values
      (ID, Subject_Type, Subject_ID, Parameter_ID, Value, Source,
       Variant_Type, Variant_ID, Status, Created_By)
    VALUES (@ID,'language',@Subject_ID,@Parameter_ID,@Value,@Source,
            @Variant_Type,@Variant_ID,@Status,'test')
  `).run({ Subject_ID: lang, Variant_Type: vt, Variant_ID: vid, ...rest });
};

describe('the parameter registry', () => {
  it('gives every parameter a card field, a rule and a decision', () => {
    for (const p of parameters) {
      assert.ok(p.ID, 'a parameter with no ID cannot be referenced by a value');
      assert.ok(p.Card_Field, `${p.ID} does not say where it lands on a card`);
      assert.ok(p.Projection_Rule, `${p.ID} does not say how it projects`);
      assert.ok(p.Disposition, `${p.ID} has no decision — undecided fields are how a `
        + 'cutover silently deletes work in progress');
    }
  });

  it('never lets two parameters write one card field on the same subject', () => {
    // "not a bazillion different fields that all mean the same thing" — the
    // same rule applied to the registry itself. typologicalProfile once carried
    // GB030 and hasGenderInPronouns, which were the same fact twice.
    //
    // SCOPED BY SUBJECT, and only since parameters stopped being all about
    // languages. A card has exactly one subject, so two parameters can only
    // collide on a card if they share one: `corpusPairCount` (pairs IN a
    // corpus) and `methodPairCount` (pairs a method SUPPORTS) both land on
    // `pairCount` and are different facts that no single card can both carry.
    // Global uniqueness was the right approximation while every parameter was
    // a language parameter and is simply the wrong check now — the scoping is
    // narrower than the invariant, not looser than it.
    const seen = new Map();
    for (const p of parameters) {
      const key = `${p.Subject || 'language'}|${p.Card_Field}`;
      assert.ok(!seen.has(key),
        `"${p.ID}" and "${seen.get(key)}" both write ${p.Card_Field} `
        + `on subject ${p.Subject || 'language'}`);
      seen.set(key, p.ID);
    }
  });

  it('reuses a card field across subjects only for parameters of the same name shape', () => {
    // The guard that keeps the scoping above honest. A field name shared across
    // subjects is fine, but each parameter must still be identifiable — two
    // subjects writing `pairCount` from parameters called `corpusPairCount` and
    // `methodPairCount` is legible; two both called `pairCount` would not be.
    const byField = new Map();
    for (const p of parameters) {
      if (!byField.has(p.Card_Field)) byField.set(p.Card_Field, []);
      byField.get(p.Card_Field).push(p);
    }
    for (const [field, ps] of byField) {
      if (ps.length < 2) continue;
      const ids = new Set(ps.map((p) => p.ID));
      assert.equal(
        ids.size, ps.length,
        `${ps.length} parameters write "${field}" but only ${ids.size} distinct ID(s): `
        + 'a field shared across subjects must still name which subject it came from',
      );
    }
  });

  it('names no measured score of method output', () => {
    // Lint R3: chrF/BLEU/COMET/TER and FST acceptance are run results keyed by
    // (method, dataset, metric) and belong on the leaderboard, never a card.
    const banned = /\b(chrf|bleu|comet|ter|fst[ -]?accept|accuracy|score)\b/i;
    for (const p of parameters) {
      assert.ok(!banned.test(p.ID), `parameter "${p.ID}" looks like a run result`);
      assert.ok(!banned.test(p.Card_Field), `field "${p.Card_Field}" looks like a run result`);
    }
  });

  it('sources a tone claim ONLY from PHOIBLE', () => {
    // Lint R1. WALS chapter 13A is also called "Tone", but a tone claim has
    // exactly one authority and Grambank has no tone feature at all.
    const tone = parameters.filter((p) => /tone/i.test(p.ID));
    assert.ok(tone.length, 'expected the registry to define tone somewhere');
    for (const p of tone) {
      for (const s of (p.Sources ?? '').split('|').filter(Boolean)) {
        assert.ok(['phoible', 'champollion-derived'].includes(s),
          `"${p.ID}" draws tone from "${s}" — PHOIBLE is the sole tone authority`);
      }
    }
  });

  it('attributes every derived parameter to champollion-derived', () => {
    for (const p of parameters) {
      if (p.Projection_Rule !== 'derived') continue;
      assert.equal(p.Sources, 'champollion-derived',
        `"${p.ID}" is derived but cites "${p.Sources}" — a value we compute must never `
        + "wear an upstream's name");
    }
  });

  it('keeps speakerCount a string, because sources publish bands', () => {
    // ELCat publishes 1-9, 10-99, 100-999, 1000-9999, 10000-99999 and the word
    // "Awakening". Six of its seven forms are not numbers. A midpoint would
    // manufacture a precision no source claims.
    const p = parameters.find((x) => x.ID === 'speakerCount');
    assert.equal(p.Datatype, 'string');
  });
});

describe('the retirement register', () => {
  it('is in step with the disposition register', () => {
    // Generated, never typed: a measured "0.0% unique" must not decay into a
    // remembered "almost no variation" and then into a judgement call.
    execFileSync('node',
      [path.join(REPO, 'cli', 'scripts', 'cldf', 'build-retired-parameters.mjs'), '--check'],
      { encoding: 'utf-8' });
  });

  it('accounts for every field: built, renamed, or retired', () => {
    // Three ways a field of the old corpus can be accounted for, and no fourth.
    // A field in none of them is one a cutover would silently delete.
    const retired = parseCSVObjects(
      fs.readFileSync(path.join(CLDF_DIR, 'retired-parameters.csv'), 'utf-8'),
      { file: 'retired-parameters.csv' },
    ).rows;
    const renamed = parseCSVObjects(
      fs.readFileSync(path.join(CLDF_DIR, 'renamed-fields.csv'), 'utf-8'),
      { file: 'renamed-fields.csv' },
    ).rows;
    const disposition = JSON.parse(fs.readFileSync(
      path.join(REPO, 'shared', 'card-field-disposition.json'), 'utf-8',
    ));
    const decided = new Set([
      ...parameters.map((p) => p.Card_Field.split('.')[0]),
      ...parameters.map((p) => p.ID),
      ...retired.map((r) => r.Card_Field),
      ...renamed.map((r) => r.Former_Field),
    ]);
    // A FOURTH ACCOUNTING, and it is not a loophole.
    //
    // The three registries above describe fields that come from a SOURCE — the
    // store ingests them, so each has a parameter row. A field the PROJECTOR
    // constructs has no source and therefore no parameter row, by design:
    // `locale` and `localeScoped` are built from an already-projected language
    // card, and the store's Subject_Type CHECK admits only language, corpus and
    // method precisely because a locale asserts nothing of its own.
    //
    // Registering them as parameters would have claimed the store can hold
    // locale-subject values, which it cannot — the attempt failed on that CHECK
    // constraint, which is the schema defending a real boundary.
    //
    // This is not a hole a field can fall through unnoticed: PROJECTED must be
    // written down, per field, in the disposition register, and
    // audit-field-disposition.mjs still requires every PROJECTED field to be
    // present in the actual build output.
    const fields = disposition.fields ?? disposition;
    const undecided = Object.keys(fields)
      .filter((f) => !decided.has(f) && fields[f]?.status !== 'PROJECTED');
    assert.deepEqual(undecided, [],
      'a field with no decision is one a cutover would silently delete');

    // The escape hatch is itself checked: a PROJECTED entry must say why it has
    // no parameter row, so the status cannot become a shrug.
    for (const [f, e] of Object.entries(fields)) {
      if (e?.status !== 'PROJECTED') continue;
      assert.match(e.why ?? '', /no parameter row|projector/i,
        `PROJECTED field '${f}' must record why it has no parameter row`);
    }
  });

  it('points every rename at a parameter that exists, or at nothing on purpose', () => {
    const renamed = parseCSVObjects(
      fs.readFileSync(path.join(CLDF_DIR, 'renamed-fields.csv'), 'utf-8'),
      { file: 'renamed-fields.csv' },
    ).rows;
    const ids = new Set(parameters.map((p) => p.ID));
    for (const r of renamed) {
      assert.ok(r.Note && r.Note.length > 10, `${r.Former_Field} renamed without saying why`);
      if (!r.Parameter_ID) continue; // deliberately not a parameter; the Note says so
      assert.ok(ids.has(r.Parameter_ID),
        `${r.Former_Field} points at "${r.Parameter_ID}", which is not a parameter`);
    }
  });

  it('gives every retirement a reason', () => {
    const retired = parseCSVObjects(
      fs.readFileSync(path.join(CLDF_DIR, 'retired-parameters.csv'), 'utf-8'),
      { file: 'retired-parameters.csv' },
    ).rows;
    for (const r of retired) {
      assert.ok(r.Retired_Reason && r.Retired_Reason.length > 20,
        `${r.ID} was dropped without saying why`);
    }
  });
});

describe('the store refuses what cannot be defended', () => {
  it('refuses an absence row that carries a value', () => {
    const { db, file } = scratch('absence');
    assert.throws(
      () => addValue(db, {
        ID: 'x', Language_ID: 'crk', Parameter_ID: 'hasTone',
        Value: 'false', Source: 'src-a', Status: 'not_attested',
      }),
      /CHECK constraint failed/,
      'an absence that asserts something is not an absence',
    );
    db.close(); fs.rmSync(file, { force: true });
  });

  it('refuses a duplicate absence, despite SQLite treating NULLs as distinct', () => {
    // The bug this guards: a plain UNIQUE over nullable columns let an earlier
    // store record every pin twice.
    const { db, file } = scratch('dupnull');
    const row = {
      Language_ID: 'crk', Parameter_ID: 'toneCount',
      Value: null, Source: 'src-a', Status: 'not_attested',
    };
    addValue(db, { ID: 'a', ...row });
    assert.throws(() => addValue(db, { ID: 'b', ...row }), /UNIQUE constraint failed/);
    db.close(); fs.rmSync(file, { force: true });
  });

  it('refuses a value whose source has no release row', () => {
    const { db, file } = scratch('nosource');
    assert.throws(
      () => addValue(db, {
        ID: 'x', Language_ID: 'crk', Parameter_ID: 'hasTone',
        Value: 'true', Source: 'never-registered', Status: 'asserted',
      }),
      /FOREIGN KEY constraint failed/,
      'a source NAME cannot say which bytes — only a release can',
    );
    db.close(); fs.rmSync(file, { force: true });
  });
});

describe('code resolution goes through the spine', () => {
  it('maps a glottocode-only row onto the spine ISO code', () => {
    // Grambank ships Glottocode populated and ISO639P3code EMPTY on nearly
    // every row. Taking the first non-empty field discarded 429,446 of 441,663
    // values as "off-spine" — 97%, reported as a coverage gap rather than a bug.
    const { db, file } = scratch('spine');
    db.prepare("UPDATE cldf_languages SET Glottocode='plai1258' WHERE ID='crk'").run();
    const r = spineResolver(db);
    assert.equal(r.resolve('', 'plai1258'), 'crk');
    assert.equal(r.resolve('crk', 'plai1258'), 'crk');
    assert.equal(r.resolve('zzz', 'zzzz9999'), null, 'an unresolvable row must be counted, not guessed');
    db.close(); fs.rmSync(file, { force: true });
  });
});

describe('projection', () => {
  it('calls one source saying several things multiple-assessments, not a conflict', () => {
    // ELCat does this on 2,497 language/parameter pairs and NONE of them are
    // two authorities disagreeing. Calling them "conflicting" would report a
    // dispute that does not exist.
    const { db, file } = scratch('assess');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'threatened', Source: 'src-a', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'vulnerable', Source: 'src-a', Status: 'asserted' });
    const { cards } = projectCards(db, { version: 't' });
    assert.equal(cards.get('crk').endangerment.agreement, 'multiple-assessments');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('calls two sources with different values a conflict, and keeps both', () => {
    const { db, file } = scratch('conflict');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'threatened', Source: 'src-a', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'vulnerable', Source: 'src-b', Status: 'asserted' });
    const { cards } = projectCards(db, { version: 't' });
    const e = cards.get('crk').endangerment;
    assert.equal(e.agreement, 'conflicting');
    assert.equal(e.values.length, 2, 'both values must survive — picking one destroys the evidence');
    assert.ok(!('consensus' in e), 'a conflict has no consensus to report');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('calls two SCALES incommensurable, not a conflict', () => {
    // ELCat says "awakening"; Glottolog AES has no such level. Reporting that
    // as a disagreement invents a dispute between two bodies who were answering
    // different questions. An earlier version keyed the scale lookup on the
    // source NAME while values carry the RELEASE id, so it never matched and
    // all 3,142 cross-scale pairs were labelled "conflicting".
    const { db, file } = scratch('scales');
    db.prepare(`INSERT INTO cldf_codes (ID, Parameter_ID, Name, Description, Source_Scale)
                VALUES ('endangerment-awakening','endangerment','awakening',NULL,'src-a'),
                       ('endangerment-moribund','endangerment','moribund',NULL,'src-b')`).run();
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'awakening', Source: 'src-a', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'moribund', Source: 'src-b', Status: 'asserted' });
    const e = projectCards(db, { version: 't' }).cards.get('crk').endangerment;
    assert.equal(e.agreement, 'incommensurable');
    assert.equal(e.values.length, 2);
    assert.ok(e.values.every((v) => v.scale), 'each value must name the scale it is on');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('casts a boolean parameter to a boolean, not the string "0"', () => {
    // "0" is truthy in JavaScript, so a consumer asking
    // `if (card.typologicalProfile.hasCoreCase)` would get the wrong answer on
    // every language where the feature is absent — which is most of them.
    const { db, file } = scratch('cast');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'hasCoreCase', Value: '0', Source: 'src-a', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'consonantCount', Value: '31', Source: 'src-a', Status: 'asserted' });
    const card = projectCards(db, { version: 't' }).cards.get('crk');
    assert.equal(card.typologicalProfile.hasCoreCase, false);
    assert.equal(card.phonologicalInventory.consonants, 31);
    db.close(); fs.rmSync(file, { force: true });
  });

  it('calls different VARIANTS different subjects, not a conflict', () => {
    // An endonym in Latin script and the same name in Arabic script is one name
    // written two ways, not two sources disagreeing. 376 endonym cards were
    // labelled "conflicting" before this distinction existed.
    //
    // This used to assert the same thing about methodSupport, which is now a
    // `tiered` field — one language can attract thousands of methods, so it
    // carries a shape rather than an agreement. The rule being protected is
    // unchanged; it just needs a parameter that still describes disagreement.
    const { db, file } = scratch('variants');
    db.prepare(`INSERT INTO cldf_values
      (ID,Subject_Type,Subject_ID,Parameter_ID,Value,Source,Variant_Type,Variant_ID,Status,Created_By)
      VALUES ('1','language','crk','endonym','nêhiyawêwin','src-a','language','en','asserted','test'),
             ('2','language','crk','endonym','ᓀᐦᐃᔭᐍᐏᐣ','src-a','language','cr','asserted','test')`).run();
    const e = projectCards(db, { version: 't' }).cards.get('crk').endonym;
    assert.equal(e.agreement, 'multiple-variants');
    assert.deepEqual(e.values.map((v) => v.variant), ['cr', 'en'],
      'the variant must reach the card, or a reader cannot tell the subjects apart');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('summarises a field one language can attract thousands of', () => {
    // English has 5,423 methods and the median language has 17. Listing all of
    // them buries the three fetched vendor entries under five thousand
    // unreviewed model cards, so the card carries the SHAPE plus the strongest
    // entries by name — and nothing is dropped from the atlas to achieve it.
    const { db, file } = scratch('tiered');
    const rows = [
      ['1', 'service', 'microsoft', 'fetched'],
      ['2', 'open', 'hf:someone/model-a', 'model-card-declared'],
      ['3', 'open', 'hf:someone/model-b', 'model-card-declared'],
    ];
    const ins = db.prepare(`INSERT INTO cldf_values
      (ID,Subject_Type,Subject_ID,Parameter_ID,Value,Source,Variant_Type,Variant_ID,
       Status,Confidence,Created_By)
      VALUES (?,'language','crk','methodSupport',?,'src-a','method',?,'asserted',?,'test')`);
    for (const r of rows) ins.run(...r);

    const m = projectCards(db, { version: 't' }).cards.get('crk').methodSupport;
    assert.equal(m.total, 3);
    assert.deepEqual(m.byTier, { fetched: 1, 'model-card-declared': 2 });
    assert.equal(m.named[0].confidence, 'fetched',
      'the strongest evidence must surface first, or it is buried by volume');
    assert.equal(m.truncated, false);
    db.close(); fs.rmSync(file, { force: true });
  });

  it('does not let an ABSENT variant split two sources that agree', () => {
    // LinguaMeta records an endonym with no script tag; Wikidata records one
    // tagged `ha`. Treating the absence of a tag as its own variant would call
    // two sources that agree "multiple-variants".
    const { db, file } = scratch('emptyvariant');
    db.prepare(`INSERT INTO cldf_values
      (ID,Subject_Type,Subject_ID,Parameter_ID,Value,Source,Variant_Type,Variant_ID,Status,Created_By)
      VALUES ('1','language','crk','endonym','Hausa','src-a',NULL,NULL,'asserted','test'),
             ('2','language','crk','endonym','Hausa','src-b','language','ha','asserted','test')`).run();
    const e = projectCards(db, { version: 't' }).cards.get('crk').endonym;
    assert.equal(e.agreement, 'unanimous');
    assert.equal(e.consensus, 'Hausa');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('never puts an absence on a card', () => {
    // A blank row on a web page asserts that there is nothing to know, when it
    // means we were not told.
    const { db, file } = scratch('absent');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'threatened', Source: 'src-a', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'toneCount', Value: null, Source: 'src-a', Status: 'not_attested' });
    const { cards } = projectCards(db, { version: 't' });
    const card = cards.get('crk');
    assert.ok(!('phonologicalInventory' in card), 'an absence must not become a field');
    assert.equal(card.coverage.notAttested, 1, 'but it must still be counted');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('gives no card to a language with no asserted value', () => {
    const { db, file } = scratch('nocard');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'toneCount', Value: null, Source: 'src-a', Status: 'not_surveyed' });
    const { cards } = projectCards(db, { version: 't' });
    assert.equal(cards.size, 0,
      'an empty card asserts a language is documented when all we have is a registry code');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('stamps a version but never a build date', () => {
    // A date in the card makes two builds from identical pins differ by the
    // calendar, which destroys the property that lets anyone check the atlas.
    const { db, file } = scratch('stamp');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'threatened', Source: 'src-a', Status: 'asserted' });
    const { cards } = projectCards(db, { version: 'v1.2.3' });
    const card = cards.get('crk');
    assert.deepEqual(card._atlas, { version: 'v1.2.3' });
    assert.ok(!/20\d\d-\d\d-\d\d/.test(JSON.stringify(card)), 'no date may reach a card');
    db.close(); fs.rmSync(file, { force: true });
  });

  it('is deterministic — same store in, same bytes out', () => {
    const { db, file } = scratch('determinism');
    addValue(db, { ID: '1', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'threatened', Source: 'src-b', Status: 'asserted' });
    addValue(db, { ID: '2', Language_ID: 'crk', Parameter_ID: 'endangerment', Value: 'vulnerable', Source: 'src-a', Status: 'asserted' });
    const a = JSON.stringify([...projectCards(db, { version: 'v' }).cards]);
    const b = JSON.stringify([...projectCards(db, { version: 'v' }).cards]);
    assert.equal(a, b);
    db.close(); fs.rmSync(file, { force: true });
  });
});

describe('method coverage asserts existence, never quality', () => {
  const coverage = JSON.parse(fs.readFileSync(
    path.join(REPO, 'shared', 'catalogue', 'method-coverage.json'), 'utf-8',
  ));

  it('never turns a count-only claim into per-language facts', () => {
    // `omt1600` claims 1,600 languages and publishes no list; `translated`
    // claims 200 and the same. Distributing either across languages we guessed
    // at would light up more of the atlas than every real method combined.
    const countOnly = coverage.methods.filter((m) => !(m.iso6393 ?? []).length);
    assert.ok(countOnly.length, 'expected at least one count-only method to guard against');
    for (const m of countOnly) {
      assert.ok(m.count > 0, `${m.key} is count-only but records no count`);
    }
  });

  it('carries the verification level on every method', () => {
    // confirmed / partially-confirmed / publisher-count-only / derived are
    // genuinely different amounts of checking. A card that showed them
    // identically would flatten that.
    const allowed = new Set(['confirmed', 'partially-confirmed', 'publisher-count-only', 'derived']);
    for (const m of coverage.methods) {
      assert.ok(allowed.has(m.verified),
        `${m.key} records verification "${m.verified}", which is outside the vocabulary`);
    }
  });

  it('records a tier, so a service is distinguishable from a downloadable model', () => {
    for (const m of coverage.methods) {
      assert.ok(['service', 'open'].includes(m.tier),
        `${m.key} has tier "${m.tier}" — a reader deciding what to do next needs to know `
        + 'whether there is a deployed service or a model they must run themselves');
    }
  });

  it('cites where each list came from and when it was read', () => {
    for (const m of coverage.methods) {
      if (!(m.iso6393 ?? []).length) continue;
      assert.ok(m.source_url, `${m.key} contributes per-language facts with no source URL`);
      assert.ok(m.asOf, `${m.key} does not say when its list was read`);
    }
  });
});

describe('licence terms are read, never assumed', () => {
  // These mirror the classifier in ingest-structure.mjs. They are duplicated
  // deliberately: if someone loosens the rule there, this fails and says so,
  // which is the entire point of a licence gate.
  const NO_DERIVATIVES = /(-ND-|-ND$|NoDerivat)/i;
  const NON_COMMERCIAL = /(-NC-|-NC$|NonCommercial)/i;
  const BESPOKE = /^LicenseRef-/i;
  const redistributable = (l) => !NO_DERIVATIVES.test(l) && !BESPOKE.test(l);

  it('treats a bespoke LicenseRef as NOT redistributable by default', () => {
    // CLAUDE.md: never interpret a modified/bespoke/unstated licence on the
    // rights-holder's behalf. SIL's ISO 639-3 terms permit incorporating the
    // code set and forbid a product that provides a means to redistribute it —
    // permission we may not infer from silence.
    assert.equal(redistributable('LicenseRef-SIL-ISO639-3-Terms'), false);
    assert.equal(redistributable('LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0'), false);
  });

  it('keeps no-derivatives and not-redistributable as DIFFERENT constraints', () => {
    // Conflating them is wrong in both directions: ND values must never be
    // ingested at all, while ISO 639-3 may be built on and must not be
    // republished. Refusing to ingest ISO would break the spine for no reason.
    assert.equal(NO_DERIVATIVES.test('CC-BY-NC-ND-4.0'), true);
    assert.equal(NO_DERIVATIVES.test('LicenseRef-SIL-ISO639-3-Terms'), false,
      'a bespoke licence is not automatically a no-derivatives one');
    assert.equal(redistributable('LicenseRef-SIL-ISO639-3-Terms'), false,
      'but it is still not redistributable');
  });

  it('lets a plain permissive licence through', () => {
    for (const l of ['CC-BY-4.0', 'CC0-1.0', 'CC-BY-3.0', 'Apache-2.0']) {
      assert.equal(redistributable(l), true, `${l} should be redistributable`);
      assert.equal(NON_COMMERCIAL.test(l), false);
    }
  });

  it('flags non-commercial without blocking ingest', () => {
    assert.equal(NON_COMMERCIAL.test('CC-BY-NC-4.0'), true);
    assert.equal(redistributable('CC-BY-NC-4.0'), true,
      'NC restricts the lane, not the redistribution — Champollion is non-commercial');
  });

  it('declares a licence for every source in the manifest, matching its SNAPSHOT', () => {
    // The manifest is a second copy of a licence fact, which is drift waiting to
    // happen — so it is a CHECK, not a duplicate. This caught PHOIBLE recorded
    // as CC-BY-SA-3.0 when its SNAPSHOT says CC-BY-3.0.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(CLDF_DIR, 'source-manifest.json'), 'utf-8'),
    );
    for (const [name, spec] of Object.entries(manifest.sources)) {
      const snapPath = path.join(REPO, 'cli', 'data', name, 'SNAPSHOT.json');
      if (!fs.existsSync(snapPath)) continue;
      const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
      // Case-insensitive, matching the gate itself: SPDX identifiers are
      // case-insensitive and two snapshots record "cc-by-4.0" in lower case.
      assert.equal(
        String(spec.license).toLowerCase(),
        String(snap.license ?? snap.licence).toLowerCase(),
        `${name}: manifest and SNAPSHOT disagree about the licence`,
      );
    }
  });
});

describe('nothing is migrated from the old corpus', () => {
  const cldfScripts = path.join(REPO, 'cli', 'scripts', 'cldf');

  it('no atlas script reads cli/shared/language-cards/', () => {
    // The failure this exists to stop: the previous corpus was moved into a
    // "curated" file stamped _migratedFrom and read back in as though it were a
    // source, so the generator reproduced unverifiable content under new
    // provenance.
    //
    // Comments and console output may NAME the path — build-atlas.mjs prints
    // "cards are not written to cli/shared/language-cards/", which is the
    // opposite of the offence. Only executable code that could open it counts,
    // so comments and console calls are stripped before the check.
    const executable = (src) => src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/console\.\w+\([\s\S]*?\);/g, '');

    // archive-legacy.mjs is the one script whose SUBJECT is the old corpus: it
    // records which parts of it are retired and which are deferred to cutover,
    // so it necessarily names the path in its data. It ingests nothing.
    const NOT_AN_INGESTER = new Set(['archive-legacy.mjs']);

    for (const f of fs.readdirSync(cldfScripts).filter((x) => x.endsWith('.mjs'))) {
      if (NOT_AN_INGESTER.has(f)) continue;
      const code = executable(fs.readFileSync(path.join(cldfScripts, f), 'utf-8'));
      assert.ok(!/language-cards/.test(code),
        `${f} reads the live card corpus. Cards are OUTPUT; reading them back is the `
        + 'laundering this rebuild exists to end.');
    }
  });

  it('keeps the exemption honest — the exempt script still must not READ cards', () => {
    // An exemption that is never checked is a hole. archive-legacy may NAME the
    // corpus; it may not open it.
    const src = fs.readFileSync(path.join(cldfScripts, 'archive-legacy.mjs'), 'utf-8');
    assert.ok(!/readFileSync\([^)]*language-cards|readdirSync\([^)]*language-cards/.test(src),
      'archive-legacy.mjs opens the live card corpus, which its exemption does not cover');
  });

  it('strips only prose — the gate still catches a real read', () => {
    // A gate that has been loosened needs its own proof, or the loosening is
    // indistinguishable from switching it off.
    const executable = (src) => src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/console\.\w+\([\s\S]*?\);/g, '');
    const offending = "const cards = fs.readdirSync('cli/shared/language-cards');";
    assert.ok(/language-cards/.test(executable(offending)),
      'the strip removed a genuine read — the gate would pass anything');
    assert.ok(!/language-cards/.test(executable("console.log('not language-cards');")));
  });

  it('no decision-layer INPUT carries _migratedFrom', () => {
    // Scoped to the files the build actually READS. shared/cldf/ also holds
    // RECORDS the build writes — retired-pipeline.json exists precisely to
    // explain what `_migratedFrom` was and why the file carrying it was
    // archived, and a register that may not name the thing it retired cannot
    // do its job.
    const INPUTS = [
      'parameters.csv', 'source-manifest.json', 'renamed-fields.csv',
      'retired-parameters.csv', 'source-expectations.json',
    ];
    for (const f of INPUTS) {
      const full = path.join(CLDF_DIR, f);
      if (!fs.existsSync(full)) continue;
      assert.ok(!fs.readFileSync(full, 'utf-8').includes('_migratedFrom'),
        `shared/cldf/${f} is a build INPUT carrying migrated content, not a source`);
    }
  });

  it('the archived laundering file is gone from the tree', () => {
    // Not merely unreferenced — absent. While it sat in shared/curated-facts/
    // anyone could wire it back in, and its own header made that look sanctioned.
    assert.ok(!fs.existsSync(path.join(REPO, 'shared', 'curated-facts', 'language-facts.json')),
      'the migrated corpus is still in the tree and can be wired back in');
    assert.ok(!fs.existsSync(path.join(REPO, 'cli', 'scripts', 'extractors', 'curated-language.mjs')),
      'the extractor that read the migrated corpus still exists');
  });
});
