/**
 * schema.mjs — the atlas store, shaped as CLDF.
 *
 * WHY A NEW DATABASE FILE RATHER THAN A MIGRATION
 *   `cli/data/champollion.db` holds 5.66 M facts of which 3.95 M (69.9%) are
 *   unpinned sediment written by scripts that no longer exist. Migrating that
 *   forward would carry the sediment with it, and the whole point of this pass
 *   is that the store becomes a BUILD OUTPUT rather than an accumulation.
 *
 *   So the atlas gets its own file, built from zero on every run. The legacy
 *   database is not read, not migrated, and is deleted once the cutover sticks.
 *
 * WHY CLDF'S OWN TABLE AND COLUMN NAMES
 *   Cross-Linguistic Data Formats (Forkel et al. 2018) is what Glottolog, WALS,
 *   Grambank, PHOIBLE, Lexibank and DoReCo publish in. We were reading it and
 *   exporting it while keeping a bespoke `facts` table in the middle that
 *   re-solved problems the standard had already solved:
 *
 *     our `card-field-spec.json`  →  ParameterTable
 *     our `scaleBySource`         →  CodeTable  (one code set per parameter,
 *                                     which is THE standard way to say that two
 *                                     vocabularies differ without claiming the
 *                                     sources disagree)
 *     our `facts` rows            →  ValueTable (several rows per
 *                                     language+parameter IS attributed conflict)
 *     our `source_releases`       →  sources.bib
 *
 *   Using their names means `cldf validate` checks our referential integrity,
 *   `pycldf` reads our atlas, and a documentary linguist recognises the shape
 *   without a translation layer.
 *
 * WHAT THE STANDARD DOES NOT COVER, DECLARED AS EXTENSIONS
 *   CSVW permits additional columns and `cldf validate` accepts them. We add
 *   only what we genuinely need and say so, rather than bending a standard term
 *   to mean something it does not:
 *
 *     Status          asserted | not_attested | not_surveyed. The difference
 *                     between "we looked and there is none" and "nobody looked"
 *                     — which is exactly what `orthographicStatus:"unwritten"`
 *                     got wrong about 1,318 languages.
 *     Variant         multi-value discriminator (which method, which dataset),
 *                     so one concept stays one parameter instead of becoming
 *                     eleven near-identical fields.
 *     Value_Year      speaker estimates are year-dependent; an undated estimate
 *                     is not comparable to a dated one.
 *     Source_Release  the pin. A source NAME cannot say which bytes.
 *     Derived_From    lineage for champollion-derived values.
 *     Redistributable / Commercial_Use / Sovereignty_Status /
 *     Transmission_Consent
 *                     licence and sovereignty travel with each VALUE, because
 *                     that is the only place they can be enforced rather than
 *                     remembered.
 *
 * @see https://cldf.clld.org/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ATLAS_DB = path.join(__dirname, '..', '..', 'data', 'atlas.db');

/** Absence is a first-class value, so these are the only legal states. */
export const STATUS = Object.freeze({
  ASSERTED: 'asserted',
  NOT_ATTESTED: 'not_attested',
  NOT_SURVEYED: 'not_surveyed',
});

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── LanguageTable ────────────────────────────────────────────────────────────
-- The spine. Populated from ISO 639-3 + Glottolog, never from cards. The
-- standard columns are PROJECTED from cldf_values by each parameter's declared
-- Authority, so even a column CLDF expects to be flat still has provenance in
-- the value layer.
CREATE TABLE IF NOT EXISTS cldf_languages (
  ID            TEXT PRIMARY KEY,
  Name          TEXT,
  Glottocode    TEXT,
  ISO639P3code  TEXT,
  Macroarea     TEXT,
  Latitude      REAL,
  Longitude     REAL
);
CREATE INDEX IF NOT EXISTS ix_lang_glottocode ON cldf_languages(Glottocode);
CREATE INDEX IF NOT EXISTS ix_lang_iso ON cldf_languages(ISO639P3code);

-- ── ParameterTable ───────────────────────────────────────────────────────────
-- Loaded from shared/cldf/parameters.csv, which is authored and tracked. This
-- is the decision layer: what we are prepared to assert, and how it projects.
CREATE TABLE IF NOT EXISTS cldf_parameters (
  ID                    TEXT PRIMARY KEY,
  Subject               TEXT NOT NULL CHECK (Subject IN ('language','corpus','method')),
  Name                  TEXT NOT NULL,
  Description           TEXT NOT NULL,
  Datatype              TEXT NOT NULL,
  Upstream_Parameter_ID TEXT,
  Card_Field            TEXT NOT NULL,
  Projection_Rule       TEXT NOT NULL,
  Absence_Policy        TEXT NOT NULL,
  Disposition           TEXT NOT NULL,
  Authority             TEXT,
  Sources               TEXT
);

-- ── CodeTable ────────────────────────────────────────────────────────────────
-- Controlled vocabularies. Source_Scale names WHOSE vocabulary a code belongs
-- to, which is what keeps ELCat's "severely endangered" and Glottolog AES's
-- "moribund" from being reported as a disagreement when they are two scales.
CREATE TABLE IF NOT EXISTS cldf_codes (
  ID           TEXT PRIMARY KEY,
  Parameter_ID TEXT NOT NULL REFERENCES cldf_parameters(ID),
  Name         TEXT NOT NULL,
  Description  TEXT,
  Source_Scale TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_codes_param ON cldf_codes(Parameter_ID);

-- ── Sources (sources.bib, as a table) ────────────────────────────────────────
-- One row per pinned RELEASE, not per source name. Redistributable and
-- Commercial_Use are recorded here once and copied onto every value, so a
-- licence question is answered by a join rather than by a reviewer.
CREATE TABLE IF NOT EXISTS cldf_sources (
  ID              TEXT PRIMARY KEY,
  BibTeX_Type     TEXT NOT NULL DEFAULT 'misc',
  Title           TEXT,
  Author          TEXT,
  Year            TEXT,
  DOI             TEXT,
  URL             TEXT,
  Version         TEXT,
  License         TEXT NOT NULL,
  License_URL     TEXT,
  sha256          TEXT,
  Retrieved_At    TEXT,
  CLDF_Module     TEXT,
  Redistributable INTEGER NOT NULL,
  Commercial_Use  INTEGER NOT NULL
);

-- ── ContributionTable ────────────────────────────────────────────────────────
-- Corpora and methods, as CLDF's Generic module models them. They are NODES
-- like languages are: they have their own properties, and facts are asserted
-- about them.
--
-- They live here rather than in a second database because the old pipeline
-- proved the alternative: 'entities'/'entity_facts' in champollion.db carried
-- corpus and method cards with no pins, no ingestion contracts and no per-value
-- licence, purely because the atlas could not hold anything but a language.
CREATE TABLE IF NOT EXISTS cldf_contributions (
  ID           TEXT PRIMARY KEY,
  Type         TEXT NOT NULL CHECK (Type IN ('corpus','method')),
  Name         TEXT,
  Description  TEXT,
  Contributor  TEXT,
  Citation     TEXT
);
CREATE INDEX IF NOT EXISTS ix_contrib_type ON cldf_contributions(Type);

-- ── ValueTable ───────────────────────────────────────────────────────────────
-- Every fact, about any subject. Value is NULLABLE on purpose: an absence row
-- asserts that we looked and found nothing, which is information, and cannot be
-- expressed by a table that requires a value.
--
-- SUBJECT, NOT LANGUAGE. The column used to be 'Language_ID' with a foreign key
-- into cldf_languages, so nothing but a language could carry a fact. SQLite
-- cannot express a foreign key whose target depends on Subject_Type, so the
-- constraint moves to assertSubjectIntegrity() in values.mjs and runs at the end
-- of ingest — a check that names what dangles rather than one the schema silently
-- cannot make.
--
-- VARIANT CARRIED FIVE DIFFERENT THINGS. Counted across the handlers, one
-- 'Variant TEXT' column held: a method key (methodSupport), a dataset name
-- (lexicalResources), a script code (iso15924), the language a label is written
-- in (endonym), and — worst — an ordinal, 'String(i).padStart(2,'0')', purely to
-- keep 'ancestry' in order.
--
-- So the column's meaning depended on which parameter the row belonged to, which
-- is exactly the functional dependency that stops the table being properly
-- normalised, and why nothing could join a variant back to the thing it names.
--
-- It splits by JOB, not just in two:
--   Variant_Type/ID  a DISCRIMINATOR — which method, which corpus, which script,
--                    which label language. Says *which one*, so two rows are two
--                    facts rather than a disagreement.
--   Sequence         ORDER within a parameter. Says *where in the list*, and is
--                    NULL wherever order carries no meaning.
CREATE TABLE IF NOT EXISTS cldf_values (
  ID                   TEXT PRIMARY KEY,
  Subject_Type         TEXT NOT NULL CHECK (Subject_Type IN ('language','corpus','method')),
  Subject_ID           TEXT NOT NULL,
  Parameter_ID         TEXT NOT NULL REFERENCES cldf_parameters(ID),
  Value                TEXT,
  Code_ID              TEXT REFERENCES cldf_codes(ID),
  Comment              TEXT,
  Source               TEXT NOT NULL REFERENCES cldf_sources(ID),
  -- The vocabulary is enumerated HERE as well as in values.mjs on purpose: the
  -- application check says which discriminator a handler meant, and this one
  -- says the store will not hold a seventh nobody declared. Adding an axis has
  -- to be done in both places, which is the point -- a new meaning for this
  -- column is a decision, and the single overloaded Variant column this
  -- replaced is what happens when it is not.
  Variant_Type         TEXT CHECK (Variant_Type IS NULL OR
                                   Variant_Type IN ('method','corpus','metric','script',
                                                    'language','territory','resource',
                                                    'feature')),
  Variant_ID           TEXT,
  Sequence             INTEGER,
  Value_Year           INTEGER,
  Status               TEXT NOT NULL CHECK (Status IN ('asserted','not_attested','not_surveyed')),
  Confidence           TEXT,
  Derived_From         TEXT,
  Sovereignty_Status   TEXT,
  Transmission_Consent TEXT,
  Created_By           TEXT NOT NULL,
  CHECK ((Status = 'asserted') = (Value IS NOT NULL)),
  CHECK ((Variant_Type IS NULL) = (Variant_ID IS NULL))
);

-- COALESCE, not a bare column list: SQLite treats NULLs as distinct in a UNIQUE
-- constraint, which is how an earlier store came to hold every pin twice.
-- Sequence is NOT part of the key: reordering a list must not silently create a
-- duplicate of a value already present.
CREATE UNIQUE INDEX IF NOT EXISTS ux_values
  ON cldf_values(Subject_Type, Subject_ID, Parameter_ID, Source,
                 COALESCE(Variant_Type, ''), COALESCE(Variant_ID, ''), COALESCE(Value, ''));
CREATE INDEX IF NOT EXISTS ix_values_subject ON cldf_values(Subject_Type, Subject_ID);
CREATE INDEX IF NOT EXISTS ix_values_param ON cldf_values(Parameter_ID);
CREATE INDEX IF NOT EXISTS ix_values_source ON cldf_values(Source);
CREATE INDEX IF NOT EXISTS ix_values_variant ON cldf_values(Variant_Type, Variant_ID);

-- ── FormTable (sidecar) ──────────────────────────────────────────────────────
-- Per-form lexical data for the public catalogue's vocabulary explorer.
--
-- DELIBERATELY NOT cldf_values. Two reasons, both load-bearing:
--   1. A form is not a fact about a language. ingest-lexical.mjs's policy
--      stands: nothing typological is derived from a wordlist, and no per-form
--      data becomes a card field. Cards carry the AGGREGATE (lexicalResource);
--      this table is the resource's CONTENTS, served beside the card.
--   2. project.mjs loads every cldf_value into memory to build cards. 3.6M
--      forms would 8x that load for rows the projector must never read.
--
-- Forms are written ONLY for sources whose pinned license permits
-- redistribution (cldf_sources.Redistributable) — showing a form IS
-- redistribution, a stronger claim than counting. Withheld sources still get
-- their aggregate counts, and the withholding is logged per source.
--
-- Source is the pinned release id, which is the provenance upgrade over the
-- legacy store (champollion.db's 3.1M lexical rows all had NULL release pins).
CREATE TABLE IF NOT EXISTS cldf_forms (
  ID                TEXT PRIMARY KEY,   -- content hash: Source|Language_ID|Doculect|Gloss|Form
  Language_ID       TEXT NOT NULL,      -- spine code (FK-by-assertion to cldf_languages)
  Source            TEXT NOT NULL REFERENCES cldf_sources(ID),
  Doculect          TEXT,               -- upstream Language_ID (variety), when it differs
  Gloss             TEXT NOT NULL,      -- the dataset's own concept label, verbatim
  Concepticon_ID    TEXT,               -- normalized concept; NULL when the dataset maps none
  Concepticon_Gloss TEXT,
  Form              TEXT NOT NULL,
  Comment           TEXT
);
CREATE INDEX IF NOT EXISTS ix_forms_lang   ON cldf_forms(Language_ID);
CREATE INDEX IF NOT EXISTS ix_forms_source ON cldf_forms(Source);
`;

/**
 * Open the atlas store. `fresh: true` deletes the file first — the default for
 * a full build, because a store that accumulates across runs is the thing this
 * architecture exists to stop.
 *
 * @param {{fresh?: boolean, file?: string}} [opts]
 * @returns {import('better-sqlite3').Database}
 */
export function openAtlas({ fresh = false, file = ATLAS_DB } = {}) {
  if (fresh) {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${file}${suffix}`, { force: true });
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec(SCHEMA);
  return db;
}

/**
 * Load the authored parameter registry into the store.
 *
 * Refuses a registry whose parameters name a card field twice: two parameters
 * writing one field is how a card ends up carrying the same fact under two
 * names, which the founder's "not a bazillion fields that all mean the same
 * thing" rule exists to prevent.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string,string>>} rows - parsed parameters.csv
 * @returns {number} parameters loaded
 */
export function loadParameters(db, rows) {
  // Per SUBJECT, not globally. A corpus and a language may both have a `name`
  // field without either shadowing the other; what must never happen is two
  // parameters writing one field on one kind of card, which is how a card ends
  // up carrying the same fact under two names.
  const seenField = new Map();
  for (const r of rows) {
    const subject = r.Subject || 'language';
    const key = `${subject}:${r.Card_Field}`;
    if (seenField.has(key)) {
      throw new Error(
        `parameters.csv: "${r.ID}" and "${seenField.get(key)}" both project to `
        + `${subject} card field "${r.Card_Field}". One concept, one field.`,
      );
    }
    seenField.set(key, r.ID);
  }

  const insert = db.prepare(`
    INSERT INTO cldf_parameters
      (ID, Subject, Name, Description, Datatype, Upstream_Parameter_ID, Card_Field,
       Projection_Rule, Absence_Policy, Disposition, Authority, Sources)
    VALUES (@ID, @Subject, @Name, @Description, @Datatype, @Upstream_Parameter_ID, @Card_Field,
            @Projection_Rule, @Absence_Policy, @Disposition, @Authority, @Sources)
  `);
  db.transaction(() => {
    for (const r of rows) {
      insert.run({
        ID: r.ID,
        Subject: r.Subject || 'language',
        Name: r.Name,
        Description: r.Description,
        Datatype: r.Datatype,
        Upstream_Parameter_ID: r.Upstream_Parameter_ID || null,
        Card_Field: r.Card_Field,
        Projection_Rule: r.Projection_Rule,
        Absence_Policy: r.Absence_Policy,
        Disposition: r.Disposition,
        Authority: r.Authority || null,
        Sources: r.Sources || null,
      });
    }
  })();
  return rows.length;
}
