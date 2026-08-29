/**
 * Champollion Language Facts Database — SQLite API
 *
 * ── RETIRED LANE (2026-08-18, champollion.db retirement B7) ────────────────
 * This is the accessor for the LEGACY champollion.db fact store, which no
 * card is built from — the atlas (cli/data/atlas.db, built by
 * cli/scripts/cldf/build-atlas.mjs) is the language-fact SSOT. Every CLI
 * entry that wrote through this module now refuses to run (see
 * shared/cldf/deprecations.json). The module itself stays importable because
 * cli/test/fact-store-v3.test.js exercises the v3 schema guarantees against
 * a temp database; do NOT wire new consumers to it.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * This module provides the interface between enrichment scripts and the
 * normalized facts database. Every piece of knowledge about a language
 * is stored as an individually-cited fact with full provenance.
 *
 * Design principles:
 *   1. Every fact MUST have a source, source_url, and retrieved_at timestamp
 *   2. No fact is written without explicit confidence classification
 *   3. Conflicting facts from different sources are detected automatically
 *   4. No source overrides another — disagreements are recorded, not resolved
 *
 * @module db
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'champollion.db');


// Valid confidence levels — each enrichment script must choose one
const VALID_CONFIDENCE = ['verified', 'api-derived', 'cross-validated', 'unverified'];

// Valid value types — determines how `value` TEXT is interpreted
const VALID_VALUE_TYPES = ['boolean', 'integer', 'float', 'string', 'json'];

// Fact status. 'asserted' is a claim; the other two are RECORDED ABSENCES —
// the distinction between "we looked and there is nothing" and "nobody looked",
// which the store previously could not express at all.
const VALID_STATUS = ['asserted', 'not_attested', 'not_surveyed'];

// ---------------------------------------------------------------------------
// DATABASE INITIALIZATION
// ---------------------------------------------------------------------------

/**
 * Opens (or creates) the SQLite database and ensures schema is applied.
 * Returns a wrapper object with all CRUD methods.
 *
 * @param {string} [dbPath] - Override default database path (useful for testing)
 * @returns {ChampollionDB}
 */
export function openDatabase(dbPath = null) {
  // RETIRED-LANE GUARD: opening the default path silently CREATED an empty
  // champollion.db when the store was absent — indistinguishable from data.
  // The store is retired; callers must now name a path explicitly (tests use
  // temp databases). Nothing may quietly resurrect the legacy store.
  if (!dbPath) {
    throw new Error(
      'openDatabase(): the default champollion.db path is RETIRED '
      + '(2026-08-18, retirement B7). Pass an explicit path (tests/temp DBs '
      + 'only) — the language-fact SSOT is cli/data/atlas.db. '
      + 'See shared/cldf/deprecations.json.',
    );
  }
  const db = new Database(dbPath);

  // Performance: WAL mode for concurrent reads during enrichment
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply schema if tables don't exist
  applySchema(db);

  return new ChampollionDB(db);
}

function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS languages (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      iso639_3 TEXT,
      glottocode TEXT,
      bcp47 TEXT,
      family TEXT,
      family_glottocode TEXT,
      genus TEXT,
      genus_glottocode TEXT,
      ancestry TEXT,
      macroarea TEXT,
      lat REAL,
      lng REAL,
      countries TEXT,
      is_isolate INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      source TEXT DEFAULT 'iso639-3-2024 + glottolog-5.3'
    );

    -- A pinned RELEASE of a source: the exact bytes a fact was read from.
    --
    -- Without this, "regenerate from source" has no defined meaning. Before
    -- 2026-08-02 only 8 of 318 sources recorded any version at all, and the
    -- version was smuggled into the source string ('grambank-1.0.3') or into
    -- prose notes ('[derived from glottolog-5.0]') — parseable by convention,
    -- enforced by nothing, and silently rewritten on every re-ingest.
    CREATE TABLE IF NOT EXISTS source_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      version TEXT,              -- upstream's own version string, verbatim
      commit_sha TEXT,           -- git commit, when the source is a repo
      doi TEXT,                  -- Zenodo/DataCite DOI, when one exists
      sha256 TEXT,               -- checksum of the fetched bytes
      fetched_at TEXT NOT NULL,
      fetched_by TEXT,           -- the fetcher script that produced it
      source_url TEXT,
      license_spdx TEXT,
      notes TEXT,
      UNIQUE(source, version, commit_sha, doi, sha256)
    );

    -- ── Non-language entities ────────────────────────────────────────────
    --
    -- The atlas publishes three kinds of card — language, corpus, method — and
    -- all three want the same guarantees: every value cited to a pinned
    -- release, disagreement preserved rather than resolved, absence
    -- expressible. Building corpus and method cards a second, different way
    -- would recreate exactly the drift this whole pass exists to remove.
    --
    -- The facts table keys on languages(code) via a hard foreign key, which is right
    -- for languages and cannot describe a corpus. Rather than weaken that key
    -- — a nullable or conditional FK would let a typo'd language code through
    -- silently — non-language entities get their own table with the same
    -- shape and their own referential integrity.
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('corpus','method','metric','run')),
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entity_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
      UNIQUE(entity_id, domain, property, source, variant)
    );

    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language_code TEXT NOT NULL REFERENCES languages(code),
      domain TEXT NOT NULL,
      property TEXT NOT NULL,
      -- NULLABLE as of v3. A fact may assert nothing: see the status column.
      value TEXT,
      value_type TEXT NOT NULL CHECK(value_type IN ('boolean','integer','float','string','json')),
      -- ABSENCE IS A FACT. 'asserted' = the source says this. 'not_attested' =
      -- we looked and the source covers this language but records nothing.
      -- 'not_surveyed' = the source does not cover this language at all.
      -- Conflating these is how orthographicStatus:"unwritten" came to be
      -- asserted about 1,318 languages because WE had failed to find a script.
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
      -- Discriminator for legitimately multi-valued facts. One source can
      -- assert several speaker estimates for one language, and the card must
      -- show all of them attributed. Under the old
      -- UNIQUE(language_code, domain, property, source) the second estimate
      -- silently REPLACED the first, so speakerEstimates[] (5,979 cards)
      -- could not round-trip through the store at all.
      variant TEXT NOT NULL DEFAULT '',
      UNIQUE(language_code, domain, property, source, variant)
    );

    -- Machine-checkable derivation edges, replacing the prose convention
    -- notes: "[derived from glottolog-5.0]". A derived fact can now be
    -- recomputed and invalidated when an input changes, instead of quietly
    -- outliving the value it was computed from.
    CREATE TABLE IF NOT EXISTS fact_lineage (
      derived_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      input_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      PRIMARY KEY (derived_fact_id, input_fact_id)
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language_code TEXT NOT NULL,
      property TEXT NOT NULL,
      fact_a_id INTEGER NOT NULL REFERENCES facts(id),
      fact_b_id INTEGER NOT NULL REFERENCES facts(id),
      resolution TEXT CHECK(resolution IN ('a_wins','b_wins','unresolved','manual')),
      resolved_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dynamic_cache (
      language_code TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content TEXT,
      content_url TEXT,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (language_code, content_type)
    );



    CREATE TABLE IF NOT EXISTS nearest_languages (
      language_code TEXT NOT NULL REFERENCES languages(code),
      neighbor_code TEXT NOT NULL REFERENCES languages(code),
      relationship TEXT NOT NULL,
      shared_depth INTEGER,
      distance_km REAL,
      PRIMARY KEY (language_code, neighbor_code)
    );

    CREATE TABLE IF NOT EXISTS natural_pairs (
      language_code TEXT PRIMARY KEY REFERENCES languages(code),
      pair_code TEXT NOT NULL,
      pair_name TEXT NOT NULL,
      rationale TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_licenses (
      source TEXT PRIMARY KEY,
      license_spdx TEXT,
      license_url TEXT,
      attribution TEXT,
      allows_redistribution INTEGER DEFAULT 1,
      requires_attribution INTEGER DEFAULT 1,
      requires_sharealike INTEGER DEFAULT 0,
      non_commercial_only INTEGER DEFAULT 0,
      dataset_url TEXT,
      dataset_version TEXT,
      notes TEXT,
      registered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_facts_lang ON facts(language_code);
    CREATE INDEX IF NOT EXISTS idx_facts_domain ON facts(domain, property);
    CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source);
    CREATE INDEX IF NOT EXISTS idx_facts_release ON facts(source_release_id);
    CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status) WHERE status <> 'asserted';
    CREATE INDEX IF NOT EXISTS idx_releases_source ON source_releases(source);

    -- (idx_releases_identity is created separately below — on a database that
    -- already contains duplicate releases it cannot be built, and a failure
    -- here would take down every consumer of the database.)

  `);

  // ── source_releases identity ──────────────────────────────────────────────
  //
  // The table-level UNIQUE(source, version, commit_sha, doi, sha256) does NOT
  // enforce what it appears to. In SQLite every NULL is distinct from every
  // other NULL, so a release carrying a version but no commit/doi/sha256 never
  // conflicts with an identical one, and INSERT OR IGNORE happily inserts a
  // duplicate. Not hypothetical: the first two real pins (sil-iso639-3 and
  // glottolog) were each stored twice before this index existed.
  //
  // Indexing the COALESCED tuple makes the constraint real, so identity is
  // enforced by the database rather than by every caller remembering to look
  // first. Guarded, because on a database that already holds duplicates the
  // index cannot be built — and failing here would take down every consumer
  // rather than the one place that can fix it.
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_identity ON source_releases(
        source, IFNULL(version,''), IFNULL(commit_sha,''), IFNULL(doi,''), IFNULL(sha256,'')
      );
    `);
  } catch (err) {
    if (!/UNIQUE constraint failed/.test(err.message)) throw err;
    console.warn(
      '[db] source_releases holds duplicate releases, so the identity index could '
      + 'not be created. De-duplicate it (keep MIN(id) per coalesced tuple) and '
      + 'reopen; until then, re-registering a release may create another row.',
    );
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lineage_input ON fact_lineage(input_fact_id);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
    CREATE INDEX IF NOT EXISTS idx_entity_facts_entity ON entity_facts(entity_id);
    CREATE INDEX IF NOT EXISTS idx_entity_facts_release ON entity_facts(source_release_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved
      ON conflicts(resolution) WHERE resolution = 'unresolved';
  `);
}

// ---------------------------------------------------------------------------
// DATABASE WRAPPER CLASS
// ---------------------------------------------------------------------------

class ChampollionDB {
  constructor(db) {
    this._db = db;
    this._groundTruth = null;

    // Prepare frequently-used statements
    this._stmts = {
      insertLanguage: db.prepare(`
        INSERT OR REPLACE INTO languages
          (code, name, iso639_3, glottocode, bcp47, family, family_glottocode,
           genus, genus_glottocode, ancestry, macroarea, lat, lng, countries,
           is_isolate, source)
        VALUES
          (@code, @name, @iso639_3, @glottocode, @bcp47, @family, @familyGlottocode,
           @genus, @genusGlottocode, @ancestry, @macroarea, @lat, @lng, @countries,
           @isIsolate, @source)
      `),

      insertFact: db.prepare(`
        INSERT OR REPLACE INTO facts
          (language_code, domain, property, value, value_type, status, source,
           source_release_id, source_url, source_raw, confidence, retrieved_at,
           created_by, notes, variant)
        VALUES
          (@languageCode, @domain, @property, @value, @valueType, @status, @source,
           @sourceReleaseId, @sourceUrl, @sourceRaw, @confidence, @retrievedAt,
           @createdBy, @notes, @variant)
      `),

      insertSourceRelease: db.prepare(`
        INSERT OR IGNORE INTO source_releases
          (source, version, commit_sha, doi, sha256, fetched_at, fetched_by,
           source_url, license_spdx, notes)
        VALUES
          (@source, @version, @commitSha, @doi, @sha256, @fetchedAt, @fetchedBy,
           @sourceUrl, @licenseSpdx, @notes)
      `),

      getSourceRelease: db.prepare(`
        SELECT * FROM source_releases
        WHERE source = ? AND IFNULL(version,'') = IFNULL(?,'')
          AND IFNULL(commit_sha,'') = IFNULL(?,'') AND IFNULL(doi,'') = IFNULL(?,'')
          AND IFNULL(sha256,'') = IFNULL(?,'')
      `),

      insertLineage: db.prepare(`
        INSERT OR IGNORE INTO fact_lineage (derived_fact_id, input_fact_id)
        VALUES (?, ?)
      `),

      getFact: db.prepare(`
        SELECT * FROM facts
        WHERE language_code = ? AND domain = ? AND property = ?
        ORDER BY confidence ASC
        LIMIT 1
      `),

      getFactBySource: db.prepare(`
        SELECT * FROM facts
        WHERE language_code = ? AND property = ? AND source = ?
      `),

      getFactsForLanguage: db.prepare(`
        SELECT * FROM facts WHERE language_code = ?
        ORDER BY domain, property
      `),

      getLanguage: db.prepare(`SELECT * FROM languages WHERE code = ?`),

      getAllLanguages: db.prepare(`SELECT * FROM languages ORDER BY code`),

      insertConflict: db.prepare(`
        INSERT INTO conflicts
          (language_code, property, fact_a_id, fact_b_id, resolution, notes)
        VALUES (@languageCode, @property, @factAId, @factBId, @resolution, @notes)
      `),

      getUnresolvedConflicts: db.prepare(`
        SELECT c.*, fa.source as source_a, fa.value as value_a,
               fb.source as source_b, fb.value as value_b
        FROM conflicts c
        JOIN facts fa ON c.fact_a_id = fa.id
        JOIN facts fb ON c.fact_b_id = fb.id
        WHERE c.resolution = 'unresolved'
        ORDER BY c.language_code
      `),



      insertNearestLanguage: db.prepare(`
        INSERT OR REPLACE INTO nearest_languages
          (language_code, neighbor_code, relationship, shared_depth, distance_km)
        VALUES (?, ?, ?, ?, ?)
      `),

      getNearestLanguages: db.prepare(`
        SELECT nl.*, l.name as neighbor_name,
          (SELECT value FROM facts WHERE language_code = nl.neighbor_code
           AND property = 'speakers' LIMIT 1) as neighbor_speakers
        FROM nearest_languages nl
        JOIN languages l ON nl.neighbor_code = l.code
        WHERE nl.language_code = ?
        ORDER BY nl.shared_depth DESC, nl.distance_km ASC
        LIMIT 50
      `),

      insertNaturalPair: db.prepare(`
        INSERT OR REPLACE INTO natural_pairs
          (language_code, pair_code, pair_name, rationale, source)
        VALUES (?, ?, ?, ?, ?)
      `),

      getNaturalPair: db.prepare(`
        SELECT * FROM natural_pairs WHERE language_code = ?
      `),

      countFacts: db.prepare(`SELECT COUNT(*) as count FROM facts`),
      countLanguages: db.prepare(`SELECT COUNT(*) as count FROM languages`),
      countConflicts: db.prepare(`
        SELECT COUNT(*) as count FROM conflicts WHERE resolution = 'unresolved'
      `),
    };
  }

  // ---- Languages ----

  /**
   * Insert or update a language in the base table.
   * This is Layer 0 — identity data from ISO 639-3 + Glottolog.
   */
  insertLanguage(lang) {
    this._stmts.insertLanguage.run({
      code: lang.code,
      name: lang.name,
      iso639_3: lang.iso639_3 || null,
      glottocode: lang.glottocode || null,
      bcp47: lang.bcp47 || null,
      family: lang.family || null,
      familyGlottocode: lang.familyGlottocode || null,
      genus: lang.genus || null,
      genusGlottocode: lang.genusGlottocode || null,
      ancestry: lang.ancestry ? JSON.stringify(lang.ancestry) : null,
      macroarea: lang.macroarea || null,
      lat: lang.lat ?? null,
      lng: lang.lng ?? null,
      countries: lang.countries ? JSON.stringify(lang.countries) : null,
      isIsolate: lang.isIsolate ? 1 : 0,
      source: lang.source || 'iso639-3-2024 + glottolog-5.3',
    });
  }

  getLanguage(code) {
    return this._stmts.getLanguage.get(code);
  }

  getAllLanguages() {
    return this._stmts.getAllLanguages.all();
  }

  // ---- Facts ----

  /**
   * Insert a fact about a language. This is the core write operation.
   *
   * MANDATORY fields (will throw if missing):
   *   - languageCode, domain, property, value, valueType
   *   - source, confidence, retrievedAt, createdBy
   *
   * @param {Object} fact
   * @throws {Error} If mandatory fields are missing or invalid
   */
  insertFact(fact) {
    const status = fact.status ?? 'asserted';
    if (!VALID_STATUS.includes(status)) {
      throw new Error(
        `[db.insertFact] Invalid status '${status}' for ` +
        `${fact.languageCode}/${fact.property}. Must be one of: ${VALID_STATUS.join(', ')}`
      );
    }

    // `value` is required only when the fact ASSERTS something. An absence
    // record ('not_attested' — the source covers this language and records
    // nothing; 'not_surveyed' — the source does not cover it) carries no
    // value, and forcing one is what made silence indistinguishable from a
    // finding.
    const required = ['languageCode', 'domain', 'property',
                      'valueType', 'source', 'confidence', 'retrievedAt', 'createdBy'];
    if (status === 'asserted') required.push('value');

    for (const field of required) {
      if (fact[field] === undefined || fact[field] === null) {
        throw new Error(
          `[db.insertFact] Missing required field '${field}' for ` +
          `${fact.languageCode}/${fact.domain}/${fact.property}. ` +
          `Every fact must have full provenance — no exceptions.`
        );
      }
    }

    // The inverse: an absence record must NOT smuggle a value in.
    if (status !== 'asserted' && fact.value !== undefined && fact.value !== null) {
      throw new Error(
        `[db.insertFact] status='${status}' but a value was supplied for ` +
        `${fact.languageCode}/${fact.property}. An absence asserts nothing.`
      );
    }

    if (!VALID_CONFIDENCE.includes(fact.confidence)) {
      throw new Error(
        `[db.insertFact] Invalid confidence '${fact.confidence}' for ` +
        `${fact.languageCode}/${fact.property}. Must be one of: ${VALID_CONFIDENCE.join(', ')}`
      );
    }

    if (!VALID_VALUE_TYPES.includes(fact.valueType)) {
      throw new Error(
        `[db.insertFact] Invalid valueType '${fact.valueType}' for ` +
        `${fact.languageCode}/${fact.property}. Must be one of: ${VALID_VALUE_TYPES.join(', ')}`
      );
    }

    return this._stmts.insertFact.run({
      languageCode: fact.languageCode,
      domain: fact.domain,
      property: fact.property,
      value: status === 'asserted' ? String(fact.value) : null,
      valueType: fact.valueType,
      status,
      source: fact.source,
      sourceReleaseId: fact.sourceReleaseId ?? null,
      sourceUrl: fact.sourceUrl || null,
      sourceRaw: fact.sourceRaw || null,
      confidence: fact.confidence,
      retrievedAt: fact.retrievedAt,
      createdBy: fact.createdBy,
      notes: fact.notes || null,
      // Discriminator for legitimately multi-valued facts (competing speaker
      // estimates from one source). Default '' preserves the old one-per-source
      // behaviour for every existing caller.
      variant: fact.variant ?? '',
    });
  }

  // ---- Source releases (the pin behind every fact) ----

  /**
   * Register a pinned release of a source and return its id.
   *
   * A fact without a release cannot answer "which bytes said this", which is
   * what makes "regenerate from source" checkable rather than aspirational.
   */
  insertSourceRelease(release) {
    for (const field of ['source', 'fetchedAt']) {
      if (!release[field]) {
        throw new Error(`[db.insertSourceRelease] Missing '${field}'.`);
      }
    }
    if (!release.version && !release.commitSha && !release.doi && !release.sha256) {
      throw new Error(
        `[db.insertSourceRelease] '${release.source}' has no pin. A release must carry ` +
        `at least one of version, commitSha, doi or sha256 — otherwise it identifies nothing.`
      );
    }
    const args = {
      source: release.source,
      version: release.version ?? null,
      commitSha: release.commitSha ?? null,
      doi: release.doi ?? null,
      sha256: release.sha256 ?? null,
      fetchedAt: release.fetchedAt,
      fetchedBy: release.fetchedBy ?? null,
      sourceUrl: release.sourceUrl ?? null,
      licenseSpdx: release.licenseSpdx ?? null,
      notes: release.notes ?? null,
    };
    // Look first. idx_releases_identity now enforces this in the database too,
    // but a pre-existing database may not have the index yet, and re-registering
    // the same release must be free either way.
    const existing = this._stmts.getSourceRelease.get(
      args.source, args.version, args.commitSha, args.doi, args.sha256,
    );
    if (existing) return existing.id;
    this._stmts.insertSourceRelease.run(args);
    const row = this._stmts.getSourceRelease.get(
      args.source, args.version, args.commitSha, args.doi, args.sha256,
    );
    return row ? row.id : null;
  }

  /** Record that `derivedFactId` was computed from `inputFactIds`. */
  recordLineage(derivedFactId, inputFactIds) {
    for (const inputId of inputFactIds) {
      this._stmts.insertLineage.run(derivedFactId, inputId);
    }
  }

  /**
   * Get the best fact for a language/domain/property (highest confidence).
   */
  getFact(code, domain, property) {
    return this._stmts.getFact.get(code, domain, property);
  }

  /**
   * Get a specific fact by language/property/source.
   */
  getFactBySource(code, property, source) {
    return this._stmts.getFactBySource.get(code, property, source);
  }

  /**
   * Get all facts for a language.
   */
  getFactsForLanguage(code) {
    return this._stmts.getFactsForLanguage.all(code);
  }

  // ---- Conflicts ----

  /**
   * Record a conflict between two facts.
   */
  insertConflict(languageCode, property, factAId, factBId, notes = null) {
    this._stmts.insertConflict.run({
      languageCode,
      property,
      factAId,
      factBId,
      resolution: 'unresolved',
      notes,
    });
  }

  getUnresolvedConflicts() {
    return this._stmts.getUnresolvedConflicts.all();
  }



  // ---- Relations ----

  insertNearestLanguage(code, neighborCode, relationship, sharedDepth, distanceKm) {
    this._stmts.insertNearestLanguage.run(code, neighborCode, relationship, sharedDepth, distanceKm);
  }

  getNearestLanguages(code) {
    return this._stmts.getNearestLanguages.all(code);
  }

  insertNaturalPair(code, pairCode, pairName, rationale, source) {
    this._stmts.insertNaturalPair.run(code, pairCode, pairName, rationale, source);
  }

  getNaturalPair(code) {
    return this._stmts.getNaturalPair.get(code);
  }

  // ---- Licensing ----

  registerSourceLicense(license) {
    if (!license.source) {
      throw new Error('[db.registerSourceLicense] source is required');
    }
    this._db.prepare(`
      INSERT OR REPLACE INTO source_licenses
        (source, license_spdx, license_url, attribution,
         allows_redistribution, requires_attribution,
         requires_sharealike, non_commercial_only,
         dataset_url, dataset_version, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      license.source,
      license.licenseSpdx || null,
      license.licenseUrl || null,
      license.attribution || null,
      license.allowsRedistribution !== false ? 1 : 0,
      license.requiresAttribution !== false ? 1 : 0,
      license.requiresSharealike ? 1 : 0,
      license.nonCommercialOnly ? 1 : 0,
      license.datasetUrl || null,
      license.datasetVersion || null,
      license.notes || null,
    );
  }

  getSourceLicense(source) {
    return this._db.prepare('SELECT * FROM source_licenses WHERE source = ?').get(source);
  }

  getAllSourceLicenses() {
    return this._db.prepare('SELECT * FROM source_licenses ORDER BY source').all();
  }

  getUnlicensedSources() {
    return this._db.prepare(`
      SELECT f.source, COUNT(*) as fact_count
      FROM facts f
      LEFT JOIN source_licenses sl ON f.source = sl.source
      WHERE sl.source IS NULL
      GROUP BY f.source
      ORDER BY fact_count DESC
    `).all();
  }

  // ---- Stats ----

  stats() {
    return {
      languages: this._stmts.countLanguages.get().count,
      facts: this._stmts.countFacts.get().count,
      unresolvedConflicts: this._stmts.countConflicts.get().count,
    };
  }

  // ---- Lifecycle ----

  /**
   * Run all operations within a transaction for atomicity.
   * Used by enrichment scripts to batch-insert facts.
   */
  transaction(fn) {
    return this._db.transaction(fn)();
  }

  close() {
    this._db.close();
  }
}

export default { openDatabase };
