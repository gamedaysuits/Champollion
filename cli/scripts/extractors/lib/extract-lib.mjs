/**
 * extract-lib — source bytes → facts, with the release they came from attached.
 *
 * WHERE THIS SITS
 *     sources → [fetch+pin] → [EXTRACT] → fact store → [project] → cards
 *
 *   The fetchers established WHICH BYTES. Extractors turn those bytes into
 *   facts. The projector turns facts into cards. This file is the shared floor
 *   under the middle step, and it exists to make two things impossible.
 *
 * IMPOSSIBLE #1 — a fact with no release.
 *   All 3,972,064 facts in the store today carry `source_release_id = NULL`.
 *   They were written by scripts, several of which no longer exist, from bytes
 *   nobody recorded. Every one of them cites a source NAME, which looks like
 *   provenance and is not: a name cannot tell you which release, so nothing
 *   derived from it can be re-derived or checked.
 *
 *   `openExtraction()` therefore REFUSES to start unless the source has a
 *   verified SNAPSHOT, and every fact it writes carries that release's id. An
 *   extractor cannot forget, because it never gets the chance.
 *
 * IMPOSSIBLE #2 — a derived value wearing an upstream's name.
 *   The house rule is that anything Champollion computes is a Champollion
 *   derivation, not an assertion by the dataset it was computed from. The old
 *   convention recorded this in prose — `notes: "[derived from glottolog-5.0]"`
 *   — which nothing could follow or invalidate. `derive()` writes
 *   `source = 'champollion-derived'` and records real lineage edges to the
 *   input facts, so "why does the card say that" resolves to rows.
 *
 * ABSENCE
 *   `absent()` records that a source was consulted and had nothing, as distinct
 *   from never being consulted. That distinction is the one whose absence let
 *   `orthographicStatus: "unwritten"` be published about 1,318 languages
 *   because WE had failed to harvest a script.
 *
 * @module extractors/lib/extract-lib
 */

import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../../db.mjs';
import { DATA_ROOT, readSnapshot, verify } from '../../fetchers/lib/fetch-lib.mjs';
import { parseCSVObjects } from '../../lib/csv.mjs';

/**
 * Read a CLDF StructureDataset's standard tables.
 *
 * Every dataset the Zenodo fetcher pins shares this shape — languages.csv,
 * parameters.csv, codes.csv, values.csv — which is the whole reason one fetcher
 * could serve 198 of them, and the reason four extractors can share one reader
 * instead of four hand-rolled CSV loops that drift apart.
 *
 * Uses the RFC-4180 reader deliberately. These files carry quoted, multi-line
 * descriptions (ELCat's endangerment prose runs to paragraphs); a line-based
 * split silently shreds them, which is what the 2026-07-19 multiline-CSV damage
 * was.
 */
export function readCldf(dir, tables = ['languages', 'parameters', 'codes', 'values']) {
  const out = {};
  for (const t of tables) {
    const p = path.join(DATA_ROOT, dir, `${t}.csv`);
    if (!fs.existsSync(p)) { out[t] = []; continue; }
    out[t] = parseCSVObjects(fs.readFileSync(p, 'utf-8'), { file: `${dir}/${t}.csv` }).rows;
  }
  return out;
}

/**
 * CLDF keys languages by its own ID; we key facts by the spine's code.
 *
 * The spine keys a language by its ISO 639-3 code when it has one and by
 * glottocode otherwise. A CLDF dataset may give either, or both, or a different
 * one — Grambank ships `Glottocode` populated and `ISO639P3code` EMPTY for
 * nearly every row, so taking the first non-empty field yields `abkh1244` where
 * the spine holds `abk`.
 *
 * Getting that wrong is not a small mistake: it silently discarded 429,446 of
 * Grambank's 441,663 facts as "off-spine" on the first run — 97% of the dataset,
 * reported as a coverage gap rather than a resolution bug. So resolution goes
 * through the spine itself, which knows both keys for every language.
 *
 * Rows resolving to NEITHER are counted and reported; a dataset row that cannot
 * be tied to a language is coverage we do not have and must not appear to.
 *
 * @param {Extraction} x  supplies the spine's own code/glottocode index
 */
export function codeIndex(languages, x) {
  const map = new Map();
  let unresolvable = 0;
  for (const l of languages) {
    const code = x.resolveCode(l.ISO639P3code, l.Glottocode);
    if (!code) { unresolvable++; continue; }
    map.set(l.ID, code);
  }
  return { map, unresolvable };
}

/**
 * Extract a CLDF feature dataset (WALS, Grambank, and their kin).
 *
 * These are grids: one row per (language, feature), the value being a code
 * whose meaning lives in codes.csv. The extraction is mechanical, so sharing it
 * keeps two datasets from drifting into two different ideas of what a feature
 * fact is.
 *
 * EVERY feature is extracted, not a chosen subset. Which of them a CARD shows
 * is the field spec's decision, made once and reviewably; deciding it inside an
 * extractor would bury a display choice in an ingest path — and would mean the
 * fact store could not answer a question nobody had thought of yet.
 *
 * UNKNOWN IS NOT ABSENT. Grambank writes "?" where a coder looked and could not
 * determine the value. That is a survey result and is recorded as
 * `not_attested`, distinct from a language the dataset never covered.
 *
 * @param {object}   opts
 * @param {object}   opts.x        an open Extraction
 * @param {string}   opts.domain   fact domain for these features
 * @param {Function} opts.urlFor   (languageId) => source URL
 * @param {Function} [opts.skip]   (parameter) => true to leave a feature out
 */
export function extractFeatures({ x, dir, domain, urlFor, skip = null }) {
  const { languages, parameters, codes, values } = readCldf(dir);
  const { map, unresolvable } = codeIndex(languages, x);

  const param = new Map(parameters.map((p) => [p.ID, p]));
  const codeName = new Map(codes.map((c) => [c.ID, c.Name]));

  let written = 0;
  let unknown = 0;
  for (const v of values) {
    const code = map.get(v.Language_ID);
    if (!code) continue;
    const p = param.get(v.Parameter_ID);
    if (!p) continue;
    if (skip && skip(p)) continue;

    const raw = (v.Value ?? '').trim();
    const label = v.Code_ID ? codeName.get(v.Code_ID) : null;

    if (raw === '' || raw === '?') {
      x.absent({
        code, domain, property: v.Parameter_ID, status: 'not_attested',
        notes: `${p.Name} — coded but not determinable from the available description`,
      });
      unknown++;
      continue;
    }
    x.assert({
      code, domain, property: v.Parameter_ID,
      value: label ?? raw, raw, url: urlFor(v.Language_ID),
      notes: p.Name + (v.Comment ? ` — ${String(v.Comment).slice(0, 200)}` : ''),
    });
    written++;
  }
  return { written, unknown, unresolvable, features: parameters.length,
    languages: map.size };
}

/**
 * The spine codes that a REGISTRY actually established.
 *
 * `languages` deliberately carries 47 rows no registry produced — 38 genera/
 * card templates, 5 private-use conlangs, 4 BCP-47 locale variants — because
 * removing them is a scope decision, not a loader's. ingest-base reports them.
 *
 * An extractor that writes a fact for every spine row gives those entries
 * content, which turns them into published cards. `family-algic` shipped with
 * nothing but methodSupport booleans; "does Google Translate support the Algic
 * family" is not a fact about anything.
 *
 * The test is IDENTITY, not presence. `macrolanguage-ara` carries
 * iso639_3 = 'ara', so a "has an ISO code" check passes it — and it is a
 * duplicate of the real `ara` card under a template name. A real language's
 * code IS its identifier; a template's merely points at one.
 */
export function registryCodes(db) {
  return new Set(
    db._db.prepare('SELECT code, iso639_3, glottocode FROM languages').all()
      .filter((r) => r.code === r.iso639_3 || r.code === r.glottocode)
      .map((r) => r.code),
  );
}

/**
 * Begin an extraction run for one source.
 *
 * @param {object} opts
 * @param {string} opts.source     the name facts will carry (e.g. 'glottolog')
 * @param {string} opts.dir        its directory under cli/data
 * @param {string} opts.extractor  path of the calling extractor, for created_by
 * @param {object} [opts.db]       an open database, if the caller owns one
 */
export function openExtraction({ source, dir, extractor, db = null }) {
  const snap = readSnapshot(dir);
  if (!snap) {
    throw new Error(
      `[${source}] cli/data/${dir}/SNAPSHOT.json is missing, so there is no release `
      + 'to attach these facts to. Run the fetcher first — extracting without a pin '
      + 'is how 3.97M unattributable facts came to exist.',
    );
  }
  if (!snap.pin?.value && !snap.pin?.doi) {
    throw new Error(`[${source}] SNAPSHOT carries no pin. ${snap.notes ?? ''}`.trim());
  }
  const v = verify(dir);
  if (!v.ok) {
    throw new Error(
      `[${source}] the files on disk no longer match SNAPSHOT.json — `
      + `${v.problems.map((p) => `${p.path}: ${p.why}`).join('; ')}. `
      + 'Extracting now would attribute these bytes to a release they are not.',
    );
  }

  const owned = !db;
  const conn = db ?? openDatabase();
  const releaseId = conn.insertSourceRelease({
    source,
    version: snap.pin.value ?? null,
    commitSha: snap.pin.kind === 'commit' ? snap.pin.value : null,
    doi: snap.pin.doi ?? null,
    sha256: snap.files[0]?.sha256 ?? null,
    fetchedAt: snap.fetchedAt,
    fetchedBy: snap.fetchedBy,
    sourceUrl: snap.upstream,
    licenseSpdx: snap.license,
    notes: snap.pin.date ? `release published ${snap.pin.date}` : null,
  });
  if (!releaseId) throw new Error(`[${source}] could not register a source release`);

  return new Extraction({ source, dir, extractor, snap, releaseId, db: conn, owned });
}

class Extraction {
  constructor({ source, dir, extractor, snap, releaseId, db, owned }) {
    this.source = source;
    this.dir = dir;
    this.extractor = extractor;
    this.snap = snap;
    this.releaseId = releaseId;
    this.db = db;
    this._owned = owned;
    this.counts = { asserted: 0, absent: 0, derived: 0, skipped: 0 };
    this._pending = [];

    // ── The spine decides what a language code IS ────────────────────────
    //
    // `facts.language_code` is a foreign key into `languages`, which
    // ingest-base builds from ISO 639-3 and Glottolog. A source may well
    // mention codes that are not in it — ISO's retirements table is entirely
    // about codes ISO no longer has, and Glottolog cites codes retired years
    // ago. Those rows are not defects in the source; they are simply outside
    // what we index.
    //
    // The FK will reject them, which is correct. What would NOT be correct is
    // catching that and moving on: a source whose rows are being dropped needs
    // to say so, or the extraction silently covers less than it appears to.
    const spine = this.db._db.prepare('SELECT code, glottocode FROM languages').all();
    this._knownCodes = new Set(spine.map((r) => r.code));
    // A language's glottocode is a second key onto the same spine row. Without
    // this, any dataset that identifies languages by glottocode looks entirely
    // off-spine.
    this._byGlottocode = new Map();
    for (const r of spine) if (r.glottocode) this._byGlottocode.set(r.glottocode, r.code);
    this.offSpine = new Map();     // code -> how many facts were dropped for it
  }

  /**
   * Resolve whatever identifiers a dataset gives to the spine's own code.
   * Tries the ISO code, then the glottocode, then treats either as a spine key
   * in its own right (a glottocode-keyed language has no ISO code to try).
   */
  resolveCode(isoCode, glottocode) {
    if (isoCode && this._knownCodes.has(isoCode)) return isoCode;
    if (glottocode && this._byGlottocode.has(glottocode)) return this._byGlottocode.get(glottocode);
    if (glottocode && this._knownCodes.has(glottocode)) return glottocode;
    return isoCode || glottocode || null;
  }

  /** True when the spine carries this code; records the miss when it does not. */
  _onSpine(code, property) {
    if (this._knownCodes.has(code)) return true;
    if (!this.offSpine.has(code)) this.offSpine.set(code, { n: 0, properties: new Set() });
    const e = this.offSpine.get(code);
    e.n++;
    e.properties.add(property);
    return false;
  }

  /** A short, honest account of what did not make it in. */
  offSpineReport() {
    const codes = [...this.offSpine.keys()].sort();
    return {
      codes: codes.length,
      facts: [...this.offSpine.values()].reduce((n, e) => n + e.n, 0),
      sample: codes.slice(0, 8),
    };
  }

  /** The release's own retrieval date — not wall-clock, so re-runs are stable. */
  get retrievedAt() { return this.snap.fetchedAt; }

  get citation() { return this.snap.citation ?? null; }

  /**
   * Record a value the source ASSERTS.
   *
   * `raw` is the source's own string before any normalisation. Keeping it is
   * what let the audit prove numeralbank's `Base` column was empty for 2,005
   * languages that nonetheless got a base — without the raw value there was
   * nothing to compare the stored value against.
   */
  assert({ code, domain, property, value, valueType = 'string', variant = '',
    raw = null, url = null, confidence = 'verified', notes = null }) {
    if (value === null || value === undefined || value === '') {
      this.counts.skipped++;
      return null;
    }
    if (!this._onSpine(code, property)) return null;
    this._pending.push({
      languageCode: code, domain, property, variant,
      value: String(value), valueType, status: 'asserted',
      source: this.source, sourceReleaseId: this.releaseId,
      sourceUrl: url, sourceRaw: raw === null ? null : String(raw),
      confidence, retrievedAt: this.retrievedAt, createdBy: this.extractor, notes,
    });
    this.counts.asserted++;
    return this._pending.length - 1;
  }

  /**
   * Record that the source was consulted and asserts nothing here.
   *
   * `not_attested` — it covers this language and records no value.
   * `not_surveyed` — it does not cover this language at all.
   * Collapsing these two is how our own harvest gap became a claim about a
   * language.
   */
  absent({ code, domain, property, status = 'not_attested', valueType = 'string',
    variant = '', notes = null }) {
    if (!this._onSpine(code, property)) return null;
    this._pending.push({
      languageCode: code, domain, property, variant,
      value: null, valueType, status,
      source: this.source, sourceReleaseId: this.releaseId,
      sourceUrl: null, sourceRaw: null,
      confidence: 'verified', retrievedAt: this.retrievedAt,
      createdBy: this.extractor, notes,
    });
    this.counts.absent++;
    return this._pending.length - 1;
  }

  /**
   * Record a value WE computed. Never carries the upstream's name.
   *
   * @param {Array<number>} inputIds fact ids this was computed from — written
   *   as lineage edges so the derivation can be followed and invalidated.
   */
  derive({ code, domain, property, value, valueType = 'string', variant = '',
    from = null, inputIds = [], notes = null }) {
    if (value === null || value === undefined || value === '') {
      this.counts.skipped++;
      return null;
    }
    if (!this._onSpine(code, property)) return null;
    this._pending.push({
      languageCode: code, domain, property, variant,
      value: String(value), valueType, status: 'asserted',
      source: 'champollion-derived', sourceReleaseId: this.releaseId,
      sourceUrl: null, sourceRaw: null,
      confidence: 'api-derived', retrievedAt: this.retrievedAt,
      createdBy: this.extractor,
      notes: notes ?? (from ? `[derived from ${from}]` : null),
      _lineage: inputIds,
    });
    this.counts.derived++;
    return this._pending.length - 1;
  }

  /**
   * Write everything in one transaction, then the lineage edges.
   *
   * Lineage needs the ids the inserts produce, so it is a second pass — but
   * inside the same transaction, because a derived fact whose lineage did not
   * land is a derived fact that lies about being followable.
   */
  commit({ replaceSource = true } = {}) {
    const rows = this._pending;
    this.db.transaction(() => {
      if (replaceSource) {
        // Projection is WHOLESALE, never merge-only. ~52 of the 64 old
        // generators skipped any field already populated, which meant a wrong
        // value could never be corrected by re-running and a retracted upstream
        // claim was never removed. Clearing this source's rows first is what
        // makes a re-run authoritative rather than additive.
        this.db._db.prepare('DELETE FROM facts WHERE source = ? AND created_by = ?')
          .run(this.source, this.extractor);
        this.db._db.prepare(
          "DELETE FROM facts WHERE source = 'champollion-derived' AND created_by = ?",
        ).run(this.extractor);
      }
      const ids = rows.map((r) => {
        this.db.insertFact(r);
        return this.db._db.prepare(
          'SELECT id FROM facts WHERE language_code=? AND domain=? AND property=? '
          + 'AND source=? AND variant=?',
        ).get(r.languageCode, r.domain, r.property, r.source, r.variant)?.id ?? null;
      });
      for (let i = 0; i < rows.length; i++) {
        const lineage = rows[i]._lineage;
        if (!lineage?.length || ids[i] == null) continue;
        this.db.recordLineage(ids[i], lineage.map((ix) => ids[ix]).filter((x) => x != null));
      }
    });
    const n = rows.length;
    this._pending = [];
    return { written: n, ...this.counts, releaseId: this.releaseId };
  }

  close() { if (this._owned) this.db.close(); }
}
