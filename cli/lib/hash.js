/**
 * Source content hash manifest — detects when English copy changes.
 *
 * HOW IT WORKS:
 *   After each successful sync, we store a SHA-256 hash of every source
 *   value in a lock file (.champollion.lock). On the next sync, we
 *   compare the current source values against the stored hashes. Any
 *   key whose hash differs means the English copy changed and all
 *   translations for that key are now stale.
 *
 * WHY:
 *   Without this, changing "Ship your product" to "Launch your product"
 *   in en.json leaves every target locale with the old translation.
 *   The diff engine only detects missing keys and [EN] fallbacks — not
 *   content mutations. This hash layer closes that gap automatically.
 *
 * FILE FORMAT:
 *   .champollion.lock is JSON, committed to version control so that all
 *   developers and CI share the same baseline. Version 1 (every lock before
 *   0.4.0, and still what a project with no per-locale record writes) maps
 *   each source key to the SHA-256 of its source text:
 *
 *   { "nav.home": "a1b2c3...", "nav.about": "d4e5f6..." }
 *
 *   Version 2 nests that map under "source" and adds what sync knows per
 *   target locale (lib/locale-state.js):
 *
 *   {
 *     "version": 2,
 *     "source": { "nav.home": "a1b2c3..." },
 *     "locales": {
 *       "fr": {
 *         "written": { "nav.home": "<12 hex of the source>:<12 hex of the value>" },
 *         "pending": { "nav.about": "--redo all --fresh-on-model-change" },
 *         "refused": { "nav.cta": { "source": "<12 hex>", "methods": ["llm|m|formal|"], "on": "2026-10-03" } },
 *         "forms": { "items_many": "many:<12 hex of the value>" },
 *         "gaps": { "files": { "source": "<12 hex>", "methods": ["local|stub-1|formal|"] } },
 *         "by": { "llm|google/gemini-3.5-flash|formal|": ["nav.home"] }
 *       }
 *     }
 *   }
 *
 *   written — the value sync left in the file for each key and the source
 *             text it translated: a value that no longer matches was edited
 *             by hand; a source that no longer matches means the translation
 *             is out of date.
 *   pending — keys a redo (--redo all, --redo keys:, a model switch) could not
 *             finish; the next plain sync asks for them once more.
 *   refused — keys whose current source text the quality gate refused from
 *             these methods; a plain sync does not send them to the same
 *             method again (it would bill the same answer).
 *   forms   — borrowed i18next plural forms (French `items_many`, translated
 *             from the English `items_other` text) the model was asked for AS
 *             that form, with the fingerprint of the value its answer left.
 *             verify reads it to tell "the model wrote `_many` like `_other`"
 *             from "filled from `_other`" using committed files only. Older
 *             versions of the CLI ignore it.
 *   gaps    — plural messages a setup (method key) answered without a form
 *             the language uses for ordinary counts, per current source text:
 *             a sync with another setup asks for them again, and one that
 *             already tried does not (lib/plural-gap-redo.js). Written only
 *             when there is one; older versions of the CLI ignore it.
 *   by      — which method key (method|model|register|coaching) produced the
 *             value `written` records for each key — the model that answered,
 *             or the one whose cache entry served it. `status` names the
 *             model behind the files from it; a value with no `by` (written
 *             before 0.4.0) is attributed from the cache, or "model unknown"
 *             when several models cached the same text. Older versions of
 *             the CLI ignore it.
 *
 *   readManifest() returns the source map for either version, so every
 *   reader of "which source changed" is unchanged; writeManifest() keeps the
 *   per-locale part of an existing lock unless it is given a new one.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const LOCK_FILENAME = '.champollion.lock';

/**
 * Compute a SHA-256 hash of a value.
 * Non-string values are JSON-serialized before hashing to ensure
 * deterministic comparison for arrays, numbers, booleans, etc.
 *
 * @param {*} value - The value to hash
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashValue(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Build a hash manifest from a flattened source locale.
 * Maps each key to the SHA-256 hash of its value.
 *
 * @param {object} sourceFlat - Flattened source locale (key → value)
 * @returns {object} Hash manifest (key → hash)
 */
function buildHashManifest(sourceFlat) {
  const manifest = {};
  for (const [key, value] of Object.entries(sourceFlat)) {
    manifest[key] = hashValue(value);
  }
  return manifest;
}

/**
 * Detect keys whose source content has changed since the last sync.
 * Compares the current source values against a previously stored manifest.
 *
 * Returns only keys that:
 *   - Exist in BOTH the current source AND the previous manifest
 *   - Have a DIFFERENT hash (meaning the English copy changed)
 *
 * Keys that are new (not in the old manifest) are already caught by
 * the "missing" detection in diffLocale. Keys that were removed are
 * irrelevant — they won't be translated anyway.
 *
 * @param {object} sourceFlat - Current flattened source locale
 * @param {object} oldManifest - Previously stored hash manifest
 * @returns {string[]} Keys whose source content changed
 */
function detectChangedKeys(sourceFlat, oldManifest) {
  const changed = [];
  for (const [key, value] of Object.entries(sourceFlat)) {
    const oldHash = oldManifest[key];
    // Only flag keys that existed before AND have a different hash.
    // New keys (not in oldManifest) are handled by diffLocale's "missing" logic.
    if (oldHash && oldHash !== hashValue(value)) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Read the hash manifest from disk.
 * Returns an empty object if the file doesn't exist (first run).
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Hash manifest (key → hash), or {} if no lock file
 */
function readManifest(cwd) {
  return readLock(cwd).source;
}

/** Lock format written when there is per-locale state to record. */
const LOCK_VERSION = 2;

/**
 * Split parsed lock JSON into its source map and per-locale state.
 * Version 1 (a flat key → hash map) has no per-locale state.
 *
 * @param {*} data - Parsed .champollion.lock
 * @returns {{ source: object, locales: object }}
 */
function splitLock(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('not a JSON object');
  }
  // Version 2 is recognised by its shape: a v1 lock maps keys to hash
  // STRINGS, so a numeric "version" next to an object "source" cannot be one.
  if (typeof data.version === 'number' && data.source && typeof data.source === 'object' && !Array.isArray(data.source)) {
    if (data.version > LOCK_VERSION) {
      throw new Error(`written by a newer champollion (lock version ${data.version}; this version reads up to ${LOCK_VERSION}) — upgrade champollion`);
    }
    const locales = data.locales && typeof data.locales === 'object' && !Array.isArray(data.locales) ? data.locales : {};
    return { source: { ...data.source }, locales };
  }
  return { source: { ...data }, locales: {} };
}

/**
 * Read the whole lock: the source-hash map and the per-locale state
 * (lib/locale-state.js). Fails loud on an unreadable file, like readManifest.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ source: object, locales: object, exists: boolean }}
 */
function readLock(cwd) {
  const lockPath = path.join(cwd, LOCK_FILENAME);

  if (!fs.existsSync(lockPath)) {
    return { source: {}, locales: {}, exists: false };
  }

  try {
    return { ...splitLock(JSON.parse(fs.readFileSync(lockPath, 'utf-8'))), exists: true };
  } catch (err) {
    // FAIL LOUD. Returning {} means "no key has ever been synced", so the
    // very next sync treats every key as changed and re-translates the whole
    // project at full API cost. A `[WARN]` that says "it will be regenerated"
    // reads as routine housekeeping and gives no hint of that bill.
    // Treating it as missing loses track of which translations are out of
    // date: nothing counts as changed (detectChangedKeys needs an old hash),
    // so every existing translation is kept even where its source moved.
    // (An earlier message claimed the opposite — a full re-translation —
    // which is not what the code does.)
    if (process.env.CHAMPOLLION_ALLOW_CACHE_RESET === '1') {
      console.error(
        `[WARN] ${LOCK_FILENAME} is unreadable (${err.message}). `
        + `CHAMPOLLION_ALLOW_CACHE_RESET=1 — treating it as missing: missing keys are `
        + `translated, but translations whose source changed are NOT detected this run. `
        + `Use \`champollion sync --redo all\` to rebuild (cached text is free).`,
      );
      return { source: {}, locales: {}, exists: false };
    }
    const e = new Error(
      `Lock file is unreadable: ${err.message}\n\n`
      + `  ${lockPath}\n\n`
      + `Refusing to continue: without it, sync cannot tell which existing `
      + `translations are out of date, and would silently keep stale ones.\n\n`
      + `  • Restore the file from version control if you can, or\n`
      + `  • delete it and run \`champollion sync --redo all\` once (cached `
      + `translations are served free; only text the cache has never seen is billed), or\n`
      + `  • re-run with CHAMPOLLION_ALLOW_CACHE_RESET=1 to continue without it.`,
    );
    e.code = 'CHAMPOLLION_LOCK_UNREADABLE';
    throw e;
  }
}

/**
 * Write the hash manifest to disk.
 * Sorts keys alphabetically for stable, diff-friendly output.
 *
 * The per-locale state (lib/locale-state.js) is written alongside when there
 * is any: `locales` replaces it; omitted, the state already in the lock is
 * kept (the Docusaurus path writes only source hashes). With no per-locale
 * state the file stays in the version-1 flat form, byte for byte.
 *
 * @param {string} cwd - Project root directory
 * @param {object} manifest - Hash manifest (key → hash)
 * @param {object} [locales] - Per-locale state to record (see the header)
 */
function writeManifest(cwd, manifest, locales = undefined) {
  const lockPath = path.join(cwd, LOCK_FILENAME);
  let state = locales;
  if (state === undefined) {
    try {
      state = fs.existsSync(lockPath) ? splitLock(JSON.parse(fs.readFileSync(lockPath, 'utf-8'))).locales : {};
    } catch {
      state = {};
    }
  }
  const sorted = sortKeys(manifest);
  const cleanLocales = {};
  for (const code of Object.keys(state || {}).sort()) {
    const entry = state[code];
    if (!entry || typeof entry !== 'object') continue;
    const out = {};
    for (const part of ['written', 'pending', 'refused', 'forms', 'gaps', 'by']) {
      if (entry[part] && typeof entry[part] === 'object' && Object.keys(entry[part]).length > 0) {
        out[part] = sortKeys(entry[part]);
      }
    }
    if (Object.keys(out).length > 0) cleanLocales[code] = out;
  }
  const body = Object.keys(cleanLocales).length > 0
    ? { version: LOCK_VERSION, source: sorted, locales: cleanLocales }
    : sorted;
  fs.writeFileSync(lockPath, JSON.stringify(body, null, 2) + '\n', 'utf-8');
}

/** A copy of an object with its own keys in sorted order. */
function sortKeys(obj) {
  const sorted = {};
  for (const key of Object.keys(obj || {}).sort()) sorted[key] = obj[key];
  return sorted;
}

export {
  hashValue,
  buildHashManifest,
  detectChangedKeys,
  readManifest,
  readLock,
  writeManifest,
  LOCK_FILENAME,
  LOCK_VERSION,
};
