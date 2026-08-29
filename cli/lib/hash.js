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
 *   .champollion.lock is a JSON file mapping dot-notation keys to
 *   their SHA-256 hash. It should be committed to version control so
 *   that all developers and CI share the same baseline.
 *
 *   {
 *     "nav.home": "a1b2c3...",
 *     "nav.about": "d4e5f6...",
 *     ...
 *   }
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
  const lockPath = path.join(cwd, LOCK_FILENAME);

  if (!fs.existsSync(lockPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (err) {
    // FAIL LOUD. Returning {} means "no key has ever been synced", so the
    // very next sync treats every key as changed and re-translates the whole
    // project at full API cost. A `[WARN]` that says "it will be regenerated"
    // reads as routine housekeeping and gives no hint of that bill.
    if (process.env.CHAMPOLLION_ALLOW_CACHE_RESET === '1') {
      console.error(
        `[WARN] ${LOCK_FILENAME} is unreadable (${err.message}). `
        + `CHAMPOLLION_ALLOW_CACHE_RESET=1 — treating this as a first run; `
        + `every key will be re-translated at full cost.`,
      );
      return {};
    }
    const e = new Error(
      `Lock file is unreadable: ${err.message}\n\n`
      + `  ${lockPath}\n\n`
      + `Refusing to continue: treating this as a first run would mark every `
      + `key as changed and re-translate the whole project at full API cost.\n\n`
      + `  • Restore the file from version control if you can, or\n`
      + `  • delete it and re-run to accept the re-translation cost, or\n`
      + `  • re-run with CHAMPOLLION_ALLOW_CACHE_RESET=1 to do that in place.`,
    );
    e.code = 'CHAMPOLLION_LOCK_UNREADABLE';
    throw e;
  }
}

/**
 * Write the hash manifest to disk.
 * Sorts keys alphabetically for stable, diff-friendly output.
 *
 * @param {string} cwd - Project root directory
 * @param {object} manifest - Hash manifest (key → hash)
 */
function writeManifest(cwd, manifest) {
  const lockPath = path.join(cwd, LOCK_FILENAME);
  // Sort keys for deterministic output — makes git diffs clean
  const sorted = {};
  for (const key of Object.keys(manifest).sort()) {
    sorted[key] = manifest[key];
  }
  fs.writeFileSync(lockPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

export {
  hashValue,
  buildHashManifest,
  detectChangedKeys,
  readManifest,
  writeManifest,
  LOCK_FILENAME,
};
