/**
 * Translation Memory (TM) — lightweight same-project cache.
 *
 * WHY THIS EXISTS:
 *   Without TM, re-running `champollion sync` after changing ONE English key
 *   re-translates every key that was modified, including keys that already
 *   have perfectly good translations from a previous run with the same
 *   source text. This wastes API tokens and adds latency.
 *
 *   Common scenarios this helps:
 *     1. Source key reverted to a previous value → TM provides instant hit
 *     2. Same phrase appears in multiple locale files → first translation cached
 *     3. Dry-run followed by real sync → second run reuses TM from first
 *     4. Developer iterating on a single file → only truly new keys hit the API
 *
 * HOW IT WORKS:
 *   TM is a JSON file at .champollion/tm.json in the project root.
 *
 *   Cache key: SHA-256(sourceValue + '\x00' + targetLocale + '\x00' + method)
 *   - Including the method ensures translations from Google Translate aren't
 *     served when the user switches to DeepL or a coached LLM model.
 *   - The null byte separator prevents "ab" + "c" colliding with "a" + "bc".
 *
 *   Cache value: { translation, timestamp }
 *   - timestamp is ISO-8601, used for informational/debugging purposes only.
 *   - No TTL — translations don't expire. Users can delete .champollion/tm.json
 *     to clear the cache entirely.
 *
 * STORAGE FORMAT:
 *   {
 *     "_meta": { "version": 1, "created": "2026-05-24T05:30:00Z" },
 *     "abc123...": { "t": "Bonjour", "ts": "2026-05-24T05:30:00Z" }
 *   }
 *
 *   Keys are abbreviated ('t' for translation, 'ts' for timestamp) to keep
 *   the file compact. At 50 languages × 500 keys = 25,000 entries, the file
 *   should be ~2-3 MB — comfortably manageable.
 *
 * USAGE:
 *   import { loadTM, saveTM, lookupTM, storeTM } from './tm.js';
 *
 *   const tm = loadTM(cwd);
 *   const cached = lookupTM(tm, sourceValue, 'fr', 'llm');
 *   if (cached) { use cached; }
 *   else { translate, then storeTM(tm, sourceValue, 'fr', 'llm', translated); }
 *   saveTM(cwd, tm);
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Current TM format version. If the format changes in a backward-incompatible
 * way, bump this to invalidate old caches.
 */
const TM_VERSION = 1;

/**
 * Default path relative to project root.
 */
const TM_DIR = '.champollion';
const TM_FILENAME = 'tm.json';

// -----------------------------------------------------------------
// Cache key generation
// -----------------------------------------------------------------

/**
 * Generate a cache key for a source value + locale + method triple.
 *
 * Uses SHA-256 truncated to 16 hex characters (64 bits). Collision probability
 * at 100k entries: ~3×10⁻¹⁰ — negligible. If a collision occurs, the worst
 * case is serving one wrong cached translation that would be overwritten on
 * the next sync anyway.
 *
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @returns {string} 16-char hex hash
 */
function cacheKey(sourceValue, locale, method) {
  const input = `${sourceValue}\x00${locale}\x00${method}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Short stable hash used inside tmMethodKey parts (register text, coaching).
 * 8 hex chars (32 bits) is plenty: it only needs to distinguish the handful
 * of register/coaching variants a single project cycles through, and a
 * collision merely re-serves a cached translation from another variant of
 * the SAME pair — the quality gate still stands between the TM and the file.
 *
 * @param {string} text - Text to fingerprint
 * @returns {string} 8-char hex hash
 */
function _shortHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

/**
 * Build the TM "method" key for a pair — the third component of cacheKey().
 *
 * WHY: the bare method name ("llm") is NOT enough to identify what shaped a
 * translation. Two runs with method "llm" but different models, registers,
 * or coaching prompts produce systematically different output. Keying the TM
 * on the bare method silently re-served old-style translations after the
 * user switched model (gemini-flash → gpt-4o), changed the register
 * (formal → casual-tu), or edited their coaching file — the exact situations
 * where a fresh translation is the whole point of the change.
 *
 * The key folds in everything on the pair config that shapes output:
 *   - method:   translation strategy (llm, llm-coached, google-translate, …)
 *   - model:    the specific model, when the method uses one ('' otherwise)
 *   - register: the preset key when known (human-readable), else a short
 *               hash of the custom register text ('' when unset)
 *   - coaching: for llm-coached pairs, a short hash of the resolved coaching
 *               prompt text (config.js reads coachingFile into
 *               coachingPrompt) plus any structured plugin coachingData.
 *               When only a coachingFile path is available (not yet
 *               resolved), the path is fingerprinted — a moved/renamed file
 *               still invalidates, though an in-place edit that bypassed
 *               config resolution would not. '' for non-coached methods.
 *
 * Changing any component makes old entries unreachable (a cache miss, so
 * the API is consulted) WITHOUT nuking valid entries for other pairs —
 * which is why callers must use this instead of bumping TM_VERSION.
 *
 * @param {object} pairConfig - Pair config (method, model, register, registerPreset, coaching*)
 * @returns {string} Stable method-key string, e.g. "llm|google/gemini-3.5-flash|formal|"
 */
function tmMethodKey(pairConfig) {
  const method = pairConfig.method || 'llm';
  const model = pairConfig.model || '';

  const register = pairConfig.registerPreset
    || (typeof pairConfig.register === 'string' && pairConfig.register.length > 0
      ? _shortHash(pairConfig.register)
      : '');

  let coaching = '';
  if (method === 'llm-coached') {
    const parts = [];
    if (typeof pairConfig.coachingPrompt === 'string' && pairConfig.coachingPrompt.trim().length > 0) {
      parts.push(pairConfig.coachingPrompt);
    } else if (typeof pairConfig.coachingFile === 'string' && pairConfig.coachingFile.trim().length > 0) {
      parts.push(`file:${pairConfig.coachingFile}`);
    }
    if (pairConfig.coachingData) {
      parts.push(JSON.stringify(pairConfig.coachingData));
    }
    if (parts.length > 0) {
      coaching = _shortHash(parts.join('\x00'));
    }
  }

  return `${method}|${model}|${register}|${coaching}`;
}

// -----------------------------------------------------------------
// TM lifecycle
// -----------------------------------------------------------------

/**
 * Load the translation memory from disk.
 *
 * Returns an empty TM object if the file doesn't exist or is corrupt.
 * Logs a warning on corruption but never throws — a missing TM
 * just means no cache hits (cold start).
 *
 * @param {string} cwd - Project root directory
 * @returns {object} TM object (mutable — callers add entries, then save)
 */
function loadTM(cwd) {
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);

  if (!fs.existsSync(tmPath)) {
    return _createEmptyTM();
  }

  try {
    const raw = fs.readFileSync(tmPath, 'utf-8');
    const data = JSON.parse(raw);

    // Version check — if format changed, start fresh
    if (!data._meta || data._meta.version !== TM_VERSION) {
      console.error(`     [TM] Cache version mismatch (expected ${TM_VERSION}). Starting fresh.`);
      return _createEmptyTM();
    }

    return data;
  } catch (err) {
    // FAIL LOUD. "Starting fresh" on an unreadable TM silently discards every
    // cached translation, so the next sync re-translates the entire project at
    // full API cost — a warning line is not adequate notice for a bill.
    //
    // A version mismatch above stays a warning: that path is expected on
    // upgrade, its cause is known, and there is genuinely nothing to preserve.
    // This path is different — the file is corrupt for an unknown reason, and
    // the cheap, correct move is usually to restore it, not to rebuild it.
    if (process.env.CHAMPOLLION_ALLOW_CACHE_RESET === '1') {
      console.error(
        `     [TM] ${tmPath} is unreadable (${err.message}). `
        + `CHAMPOLLION_ALLOW_CACHE_RESET=1 — starting fresh; `
        + `every key will be re-translated at full cost.`,
      );
      return _createEmptyTM();
    }
    const e = new Error(
      `Translation memory is unreadable: ${err.message}\n\n`
      + `  ${tmPath}\n\n`
      + `Refusing to continue: starting fresh would discard every cached `
      + `translation and re-translate the whole project at full API cost.\n\n`
      + `  • Restore the file from version control if you can, or\n`
      + `  • delete it and re-run to accept the re-translation cost, or\n`
      + `  • re-run with CHAMPOLLION_ALLOW_CACHE_RESET=1 to do that in place.`,
    );
    e.code = 'CHAMPOLLION_TM_UNREADABLE';
    throw e;
  }
}

/**
 * Save the translation memory to disk.
 *
 * Creates the .champollion/ directory if it doesn't exist.
 * Writes atomically (write to .tmp, rename) to prevent corruption
 * if the process is killed mid-write.
 *
 * @param {string} cwd - Project root directory
 * @param {object} tm - TM object to save
 */
function saveTM(cwd, tm) {
  const dirPath = path.join(cwd, TM_DIR);
  const tmPath = path.join(dirPath, TM_FILENAME);
  const tmpPath = tmPath + '.tmp';

  // Ensure .champollion/ directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const json = JSON.stringify(tm, null, 0); // compact — no pretty-printing
  fs.writeFileSync(tmpPath, json, 'utf-8');
  fs.renameSync(tmpPath, tmPath);
  tm[_DIRTY] = false;
}

/**
 * Look up a cached translation.
 *
 * @param {object} tm - TM object (from loadTM)
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @returns {string|null} Cached translation, or null for cache miss
 */
function lookupTM(tm, sourceValue, locale, method) {
  const key = cacheKey(sourceValue, locale, method);
  const entry = tm[key];
  if (entry && typeof entry.t === 'string') {
    return entry.t;
  }
  return null;
}

/**
 * Look up a cached translation and validate it before serving.
 *
 * WHY: a cache is a time machine — an entry stored before a quality gate
 * existed re-serves output that gate would reject today. The content lanes
 * hit this in production: front-matter and body values hollowed by a
 * pre-0.2.0 pipeline sat in the TM and were served back verbatim, forever,
 * because TM hits skipped the gates that had since been built. Validating at
 * READ time means every gate improvement retroactively cleans the cache —
 * no version bookkeeping, no migration.
 *
 * A hit that fails validation is EVICTED (so the next lookup is an honest
 * miss and the API is consulted) and reported as a miss to the caller.
 *
 * The validator is a callback so this module stays dependency-free: callers
 * bring whatever check fits their lane.
 *
 * @param {object} tm - TM object (mutated on eviction)
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @param {(source: string, cached: string) => boolean} isValid - True to serve
 * @returns {string|null} Validated cached translation, or null
 */
function lookupTMValidated(tm, sourceValue, locale, method, isValid) {
  const cached = lookupTM(tm, sourceValue, locale, method);
  if (cached === null) return null;
  if (isValid(sourceValue, cached)) return cached;
  evictTM(tm, sourceValue, locale, method);
  return null;
}

/**
 * Store a translation in the TM.
 *
 * @param {object} tm - TM object (mutated in place)
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @param {string} translation - Translated value to cache
 */
function storeTM(tm, sourceValue, locale, method, translation) {
  const key = cacheKey(sourceValue, locale, method);
  tm[key] = {
    t: translation,
    ts: new Date().toISOString(),
    l: locale,   // locale code — enables per-locale stats and filtering
    m: method,   // method name — enables per-method stats
  };
  _markDirty(tm);
}

/**
 * Evict a cached translation from the TM.
 *
 * Used by the quality gate: when a TM-served translation fails validation,
 * the entry must be removed — otherwise it is re-served (and re-fails) on
 * every future sync, and the API is never consulted again for that string.
 *
 * @param {object} tm - TM object (mutated in place)
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @returns {boolean} True if an entry existed and was removed
 */
function evictTM(tm, sourceValue, locale, method) {
  const key = cacheKey(sourceValue, locale, method);
  if (key in tm) {
    delete tm[key];
    _markDirty(tm);
    return true;
  }
  return false;
}

/**
 * Has this TM been mutated (store or evict) since load/save?
 *
 * Callers use this to decide whether saveTM is needed. A size comparison is
 * NOT equivalent: evicting a poisoned entry and re-storing its replacement
 * under the same cache key leaves the size unchanged, and an eviction-only
 * run shrinks it — both must still be persisted.
 *
 * @param {object} tm - TM object
 * @returns {boolean} True if the TM has unsaved changes
 */
function isTMDirty(tm) {
  return tm[_DIRTY] === true;
}

// Non-enumerable dirty marker — invisible to JSON.stringify and Object.keys,
// so it never leaks into the saved file or entry counts.
const _DIRTY = Symbol('tm-dirty');

function _markDirty(tm) {
  tm[_DIRTY] = true;
}

/**
 * Prune TM entries by category, mutating the loaded object in place.
 *
 * Categories:
 *   - legacy:   entries missing the `l`/`m` metadata fields (pre-v3.4 format).
 *     These can never be filtered per-locale or per-method, and predate the
 *     tmMethodKey cache-key scheme, so they are dead weight.
 *   - matching: entries whose cached translation matches `matching` (RegExp).
 *     This is the policy-eviction lane: when wording is banned AFTER entries
 *     were cached (house-term passes, renames), the source edit orphans the
 *     entries but does not remove them — and if the old source string ever
 *     reappears, the cache re-serves the banned translation. Same rationale
 *     as evictTM's quality-gate eviction, applied in bulk by content.
 *   - stale:    entries whose `ts` timestamp is older than `olderThanDays`.
 *
 * An entry matching several categories is counted once, under the first in
 * the order above. `_meta` is never touched. Callers decide persistence: for
 * a dry report just discard the mutated object; to actually prune, follow
 * with saveTM (the object is marked dirty here whenever anything was removed).
 *
 * @param {object} tm - TM object (from loadTM; mutated in place)
 * @param {object} [options]
 * @param {boolean} [options.legacy=true] - Remove entries missing l/m metadata
 * @param {RegExp|null} [options.matching=null] - Remove entries whose translation text matches
 * @param {number|null} [options.olderThanDays=null] - Remove entries older than N days (by ts)
 * @returns {{ removed: number, kept: number, byReason: { legacy: number, matching: number, stale: number } }}
 */
function pruneTM(tm, { legacy = true, matching = null, olderThanDays = null } = {}) {
  const byReason = { legacy: 0, matching: 0, stale: 0 };
  let kept = 0;

  const cutoff = olderThanDays !== null
    ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  for (const [key, entry] of Object.entries(tm)) {
    if (key === '_meta') continue;

    let reason = null;
    if (legacy && (!entry.l || !entry.m)) {
      reason = 'legacy';
    } else if (matching !== null && typeof entry.t === 'string' && _testFresh(matching, entry.t)) {
      reason = 'matching';
    } else if (cutoff !== null && typeof entry.ts === 'string' && entry.ts < cutoff) {
      reason = 'stale';
    }

    if (reason) {
      delete tm[key];
      byReason[reason]++;
    } else {
      kept++;
    }
  }

  const removed = byReason.legacy + byReason.matching + byReason.stale;
  if (removed > 0) _markDirty(tm);
  return { removed, kept, byReason };
}

/**
 * RegExp.test without sticky/global lastIndex carry-over between entries.
 * A caller-supplied /g or /y regex would otherwise skip matches on
 * subsequent entries and make pruning nondeterministic.
 */
function _testFresh(re, text) {
  if (re.global || re.sticky) re.lastIndex = 0;
  return re.test(text);
}

/**
 * Partition a set of keys into TM hits and TM misses.
 *
 * This is the main entry point for the sync pipeline:
 *   1. Load source values for the keys that need translation
 *   2. Check each against TM
 *   3. Return hits (reuse immediately) and misses (send to API)
 *
 * @param {object} tm - TM object
 * @param {object} sourceFlat - Full source key→value map
 * @param {string[]} keysToTranslate - Keys that need translation
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @returns {{ hits: object, misses: string[] }} hits is key→cached translation, misses is keys to translate
 */
function partitionByTM(tm, sourceFlat, keysToTranslate, locale, method) {
  const hits = {};
  const misses = [];

  for (const key of keysToTranslate) {
    const sourceValue = sourceFlat[key];
    if (typeof sourceValue !== 'string') {
      misses.push(key);
      continue;
    }

    const cached = lookupTM(tm, sourceValue, locale, method);
    if (cached !== null) {
      hits[key] = cached;
    } else {
      misses.push(key);
    }
  }

  return { hits, misses };
}

/**
 * Get the number of cached entries in a TM (excluding metadata).
 *
 * @param {object} tm - TM object
 * @returns {number} Entry count
 */
function tmSize(tm) {
  return Object.keys(tm).filter(k => k !== '_meta').length;
}

// -----------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------

function _createEmptyTM() {
  return {
    _meta: {
      version: TM_VERSION,
      created: new Date().toISOString(),
    },
  };
}

// -----------------------------------------------------------------
// Exports
// -----------------------------------------------------------------

export {
  loadTM,
  saveTM,
  lookupTM,
  lookupTMValidated,
  storeTM,
  evictTM,
  isTMDirty,
  pruneTM,
  partitionByTM,
  tmSize,
  cacheKey,
  tmMethodKey,
  TM_VERSION,
  TM_DIR,
  TM_FILENAME,
};
