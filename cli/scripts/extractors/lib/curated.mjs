/**
 * curated — pinning the SSOTs we maintain ourselves.
 *
 * THE PROBLEM "NO FETCHER, NO SOURCE" DOES NOT SOLVE
 *   Some of what a card must say is not fetched from anywhere. `method-registry.json`
 *   is the SSOT for translation methods, read by both the Python harness and the
 *   JS CLI; nobody upstream publishes it, because we write it. The same is true
 *   of the licence corrections, the domain taxonomy, and the human knowledge the
 *   plan's curated lane is meant to hold.
 *
 *   Those files cannot have a DOI or an upstream commit. That does NOT make them
 *   exempt from provenance — it makes their provenance different: a curated file
 *   is pinned to ITS OWN CONTENT and to the commit that last changed it. Both are
 *   verifiable, and both change when someone edits the file, which is the whole
 *   point.
 *
 * WHY NOT JUST READ THE FILE
 *   Because then a fact derived from it carries no release, and "which bytes said
 *   this" has no answer — exactly the state 3.97M facts were already in. A
 *   curated file that anyone can edit needs MORE provenance than a DOI-pinned
 *   dataset, not less: there is no upstream to check it against.
 *
 * WHAT MAKES A CURATED FACT DISTINGUISHABLE
 *   `source` is prefixed `curated:`. The classifier already treats that prefix as
 *   internal, so a hand-maintained value can never be stamped with an upstream's
 *   name — which is the laundering that let 25 cards carry prose typed into a
 *   script literal under `["wals-2024","grambank-1.0.3","phoible-2.0"]`.
 *
 * @module extractors/lib/curated
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../../db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..', '..');

/**
 * Register a release for a repo-tracked curated file.
 *
 * The pin is the file's sha256. The commit that last touched it is recorded
 * alongside, so an editor is identifiable — a curated value's accountability is
 * a person and a commit, where a dataset's is a publisher and a DOI.
 *
 * @param {object} db          open database
 * @param {string} relPath     repo-relative path, e.g. 'shared/method-registry.json'
 * @param {string} sourceName  the `curated:` source name facts will carry
 */
export function pinCuratedFile(db, relPath, sourceName) {
  const abs = path.join(REPO, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`[${sourceName}] ${relPath} not found — nothing to pin.`);
  }
  const bytes = fs.readFileSync(abs);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  let commit = null;
  let lastChanged = null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%H%x00%cI', '--', relPath],
      { cwd: REPO, encoding: 'utf-8' }).trim();
    if (out) [commit, lastChanged] = out.split('\0');
  } catch { /* not a repo, or the file is untracked — the sha256 still pins it */ }

  if (!commit) {
    // Untracked means unreviewable: nobody can see what changed or who changed
    // it. Say so in the release rather than letting it look equivalent.
    process.stderr.write(
      `  ⚠ ${relPath} is not tracked in git, so its release records content only — `
      + 'no commit, no author, no diff.\n',
    );
  }

  const releaseId = db.insertSourceRelease({
    source: sourceName,
    version: JSON.parse(bytes.toString('utf-8')).version?.toString() ?? null,
    commitSha: commit,
    doi: null,
    sha256,
    fetchedAt: lastChanged ?? new Date().toISOString(),
    fetchedBy: 'curated (maintained in-repo)',
    sourceUrl: `repo:${relPath}`,
    licenseSpdx: null,
    notes: commit
      ? `curated file, last changed by ${commit.slice(0, 8)}`
      : 'curated file, UNTRACKED — content-pinned only',
  });
  if (!releaseId) throw new Error(`[${sourceName}] could not register a curated release`);
  return { releaseId, sha256, commit, lastChanged, data: JSON.parse(bytes.toString('utf-8')) };
}

/**
 * A writer for entity facts (corpus / method / metric / run cards).
 *
 * Mirrors the language Extraction deliberately: same status vocabulary, same
 * release pin, same wholesale-replace on commit. A second card type built on a
 * second set of rules is how two sources of truth start.
 */
export class EntityExtraction {
  constructor({ source, entityType, extractor, releaseId, retrievedAt, db }) {
    this.source = source;
    this.entityType = entityType;
    this.extractor = extractor;
    this.releaseId = releaseId;
    this.retrievedAt = retrievedAt;
    this.db = db;
    this._entities = new Map();
    this._pending = [];
    this.counts = { asserted: 0, absent: 0, skipped: 0 };
  }

  entity(id, name) {
    this._entities.set(id, { id, entityType: this.entityType, name });
    return id;
  }

  assert({ id, domain, property, value, valueType = 'string', variant = '',
    raw = null, url = null, confidence = 'verified', notes = null }) {
    if (value === null || value === undefined || value === '') {
      this.counts.skipped++;
      return null;
    }
    this._pending.push({
      entity_id: id, domain, property, variant,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      value_type: typeof value === 'object' ? 'json' : valueType,
      status: 'asserted', source: this.source, source_release_id: this.releaseId,
      source_url: url, source_raw: raw === null ? null : String(raw),
      confidence, retrieved_at: this.retrievedAt, created_by: this.extractor, notes,
    });
    this.counts.asserted++;
    return this._pending.length - 1;
  }

  /** "We maintain this registry and it records nothing here" — a real state. */
  absent({ id, domain, property, status = 'not_attested', variant = '', notes = null }) {
    this._pending.push({
      entity_id: id, domain, property, variant, value: null, value_type: 'string',
      status, source: this.source, source_release_id: this.releaseId,
      source_url: null, source_raw: null, confidence: 'verified',
      retrieved_at: this.retrievedAt, created_by: this.extractor, notes,
    });
    this.counts.absent++;
    return this._pending.length - 1;
  }

  commit() {
    const insertEntity = this.db._db.prepare(
      'INSERT INTO entities (id, entity_type, name) VALUES (@id, @entityType, @name) '
      + 'ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type, name=excluded.name',
    );
    const insertFact = this.db._db.prepare(`
      INSERT OR REPLACE INTO entity_facts
        (entity_id, domain, property, value, value_type, status, source,
         source_release_id, source_url, source_raw, confidence, retrieved_at,
         created_by, notes, variant)
      VALUES
        (@entity_id, @domain, @property, @value, @value_type, @status, @source,
         @source_release_id, @source_url, @source_raw, @confidence, @retrieved_at,
         @created_by, @notes, @variant)
    `);
    this.db.transaction(() => {
      // Wholesale, exactly as the language path: a re-run is authoritative, so a
      // removed registry entry actually disappears instead of outliving its file.
      this.db._db.prepare('DELETE FROM entity_facts WHERE source = ? AND created_by = ?')
        .run(this.source, this.extractor);
      for (const e of this._entities.values()) insertEntity.run(e);
      for (const f of this._pending) insertFact.run(f);
    });
    const n = this._pending.length;
    this._pending = [];
    return { written: n, entities: this._entities.size, ...this.counts };
  }
}

/** Open a curated extraction against a repo-tracked file. */
export function openCurated({ file, source, entityType, extractor, db = null }) {
  const conn = db ?? openDatabase();
  const { releaseId, data, sha256, commit, lastChanged } = pinCuratedFile(conn, file, source);
  const x = new EntityExtraction({
    source, entityType, extractor, releaseId,
    retrievedAt: lastChanged ?? new Date().toISOString(), db: conn,
  });
  x.data = data;
  x.pin = { sha256, commit };
  x._ownsDb = !db;
  return x;
}
