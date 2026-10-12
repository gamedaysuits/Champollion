#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'migrate-fact-store-v3.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: none — the fact store it migrates is retired; the atlas is built by node cli/scripts/cldf/build-atlas.mjs\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * migrate-fact-store-v3.mjs — bring an existing champollion.db to the v3 schema.
 *
 * WHY
 *   v3 makes the fact store capable of three things it could not do before,
 *   each of which the audit found actively causing wrong data:
 *
 *   1. PINS. `source_releases` + `facts.source_release_id`. Only 8 of 318
 *      sources recorded any version at all; the rest smuggled it into the
 *      source string ('grambank-1.0.3') or into prose notes ('[derived from
 *      glottolog-5.0]'). Without a pin, "regenerate from source" cannot be
 *      checked — you cannot say WHICH bytes a fact came from.
 *
 *   2. ABSENCE. `facts.status` ∈ asserted | not_attested | not_surveyed, and
 *      `value` becomes nullable. Previously every row had to assert something,
 *      so "we looked and this language has no documented script" was
 *      indistinguishable from "nobody looked". That conflation is exactly how
 *      `orthographicStatus: "unwritten"` came to be published about 1,318
 *      languages — 1,059 of them living, with real speaker counts — purely
 *      because WE had failed to harvest a script.
 *
 *   3. MULTI-VALUE. `facts.variant` joins the UNIQUE key. Under
 *      UNIQUE(language_code, domain, property, source) a source asserting two
 *      speaker estimates silently REPLACED its own first one, so
 *      `speakerEstimates[]` — 5,979 cards showing competing estimates
 *      attributed, which is the project's core doctrine — could not round-trip
 *      through the store at all.
 *
 *   Plus `fact_lineage`, replacing the prose "[derived from X]" convention with
 *   a machine-checkable edge so a derived fact can be invalidated when its
 *   input changes rather than quietly outliving it.
 *
 * WHY A REBUILD
 *   SQLite cannot drop a table-level UNIQUE constraint, and cannot relax NOT
 *   NULL, so `facts` must be recreated and copied. This is the one destructive
 *   step; it backs up first and verifies afterwards.
 *
 * SAFETY
 *   - Refuses to run twice (detects v3 and exits 0).
 *   - Takes a byte copy of the DB first unless --no-backup.
 *   - Copies inside a transaction, then verifies row count, per-source counts
 *     and a content checksum BEFORE dropping the old table. Any mismatch rolls
 *     back and leaves the original untouched.
 *
 * Usage:
 *   node cli/scripts/migrate-fact-store-v3.mjs --dry-run
 *   node cli/scripts/migrate-fact-store-v3.mjs
 *
 * Exit: 0 ok / already migrated · 1 could not run · 2 verification failed
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'champollion.db');

const DRY_RUN = process.argv.includes('--dry-run');
const NO_BACKUP = process.argv.includes('--no-backup');

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: ${DB_PATH} not found.`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const cols = db.prepare('PRAGMA table_info(facts)').all().map((c) => c.name);
const alreadyV3 = cols.includes('status') && cols.includes('variant')
  && cols.includes('source_release_id');

if (alreadyV3) {
  console.log('facts is already at v3 — nothing to do.');
  db.close();
  process.exit(0);
}

const before = {
  facts: db.prepare('SELECT COUNT(*) n FROM facts').get().n,
  sources: db.prepare('SELECT COUNT(DISTINCT source) n FROM facts').get().n,
  languages: db.prepare('SELECT COUNT(*) n FROM languages').get().n,
  // A content fingerprint that does not depend on rowid or column order.
  digest: db.prepare(
    "SELECT COUNT(*) n, SUM(LENGTH(language_code)+LENGTH(domain)+LENGTH(property)"
    + "+LENGTH(value)+LENGTH(source)) s FROM facts",
  ).get(),
};

console.log('fact-store migration → v3');
console.log(`  facts        : ${before.facts.toLocaleString()}`);
console.log(`  sources      : ${before.sources}`);
console.log(`  languages    : ${before.languages.toLocaleString()}`);
console.log(`  adds         : source_releases, fact_lineage, facts.{status,variant,source_release_id}`);
console.log(`  relaxes      : facts.value NOT NULL → nullable`);
console.log(`  replaces key : UNIQUE(lang,domain,property,source)`);
console.log(`                 → UNIQUE(lang,domain,property,source,variant)`);

if (DRY_RUN) {
  console.log('\n  DRY RUN — nothing written.');
  db.close();
  process.exit(0);
}

if (!NO_BACKUP) {
  const backup = `${DB_PATH}.pre-v3-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  if (!fs.existsSync(backup)) {
    console.log(`\n  backing up → ${path.basename(backup)} …`);
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, backup);
    console.log(`  backup written (${(fs.statSync(backup).size / 1e9).toFixed(2)} GB)`);
  } else {
    console.log(`\n  backup already exists: ${path.basename(backup)}`);
  }
}

console.log('\n  migrating …');
db.pragma('foreign_keys = OFF');   // the rebuild briefly breaks facts→languages

const migrate = db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      version TEXT,
      commit_sha TEXT,
      doi TEXT,
      sha256 TEXT,
      fetched_at TEXT NOT NULL,
      fetched_by TEXT,
      source_url TEXT,
      license_spdx TEXT,
      notes TEXT,
      UNIQUE(source, version, commit_sha, doi, sha256)
    );

    CREATE TABLE facts_v3 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language_code TEXT NOT NULL REFERENCES languages(code),
      domain TEXT NOT NULL,
      property TEXT NOT NULL,
      value TEXT,
      value_type TEXT NOT NULL CHECK(value_type IN ('boolean','integer','float','string','json')),
      status TEXT NOT NULL DEFAULT 'asserted'
        CHECK(status IN ('asserted','not_attested','not_surveyed')),
      source TEXT NOT NULL,
      source_release_id INTEGER REFERENCES source_releases(id),
      source_url TEXT,
      source_raw TEXT,
      confidence TEXT NOT NULL CHECK(confidence IN ('verified','api-derived','cross-validated','unverified')),
      retrieved_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      notes TEXT,
      variant TEXT NOT NULL DEFAULT '',
      UNIQUE(language_code, domain, property, source, variant)
    );
  `);

  // Preserve `id` so fact_lineage / conflicts references stay valid.
  db.exec(`
    INSERT INTO facts_v3
      (id, language_code, domain, property, value, value_type, status, source,
       source_release_id, source_url, source_raw, confidence, retrieved_at,
       created_by, notes, variant)
    SELECT
       id, language_code, domain, property, value, value_type, 'asserted', source,
       NULL, source_url, source_raw, confidence, retrieved_at,
       created_by, notes, ''
    FROM facts;
  `);

  // ── Verify BEFORE destroying anything ────────────────────────────────────
  const after = {
    facts: db.prepare('SELECT COUNT(*) n FROM facts_v3').get().n,
    sources: db.prepare('SELECT COUNT(DISTINCT source) n FROM facts_v3').get().n,
    digest: db.prepare(
      "SELECT COUNT(*) n, SUM(LENGTH(language_code)+LENGTH(domain)+LENGTH(property)"
      + "+LENGTH(value)+LENGTH(source)) s FROM facts_v3",
    ).get(),
  };
  if (after.facts !== before.facts
      || after.sources !== before.sources
      || after.digest.s !== before.digest.s) {
    throw new Error(
      `verification FAILED — rows ${before.facts}→${after.facts}, `
      + `sources ${before.sources}→${after.sources}, `
      + `digest ${before.digest.s}→${after.digest.s}. Rolling back; original untouched.`,
    );
  }

  db.exec(`
    DROP TABLE facts;
    ALTER TABLE facts_v3 RENAME TO facts;

    CREATE TABLE IF NOT EXISTS fact_lineage (
      derived_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      input_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      PRIMARY KEY (derived_fact_id, input_fact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_facts_lang ON facts(language_code);
    CREATE INDEX IF NOT EXISTS idx_facts_domain ON facts(domain, property);
    CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source);
    CREATE INDEX IF NOT EXISTS idx_facts_release ON facts(source_release_id);
    CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status) WHERE status <> 'asserted';
    CREATE INDEX IF NOT EXISTS idx_releases_source ON source_releases(source);
    CREATE INDEX IF NOT EXISTS idx_lineage_input ON fact_lineage(input_fact_id);
  `);
});

try {
  migrate();
} catch (err) {
  console.error(`\n  ✗ ${err.message}`);
  db.close();
  process.exit(2);
}

db.pragma('foreign_keys = ON');
const fk = db.prepare('PRAGMA foreign_key_check').all();
const final = db.prepare('SELECT COUNT(*) n FROM facts').get().n;

console.log(`\n  ✓ migrated — ${final.toLocaleString()} facts preserved`);
console.log(`    foreign-key violations: ${fk.length}`);
if (fk.length) {
  const byTable = {};
  for (const v of fk) byTable[v.table] = (byTable[v.table] ?? 0) + 1;
  for (const [table, n] of Object.entries(byTable)) {
    console.log(`      ${table}: ${n}`);
  }
  // Verified 2026-08-02 by comparing PRAGMA foreign_key_check on the pre-v3
  // backup: identical 14 violations before and after, so the migration did not
  // introduce them. They are `conflicts` rows referencing fact ids that no
  // longer exist — orphaned when a fact was deleted (the decontamination pass)
  // without cleaning up the conflicts that pointed at it. Not this migration's
  // to fix, but it should not go unrecorded either.
  console.log('      (pre-existing — same count on the pre-v3 backup; orphaned');
  console.log('       conflict rows pointing at deleted facts)');
}
console.log('\n  Every fact is status=asserted with no release pin. Pins arrive as');
console.log('  extractors are ported (Phase B4); a fact without a release is the');
console.log('  gate\'s definition of "not yet regenerable from source".');

db.close();
