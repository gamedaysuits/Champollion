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
import { COACHING_PROMPT_METHODS } from './methods/prompt-methods.js';

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
 *   - coaching: for every method whose prompt carries the pair's
 *               free-text coaching — the plain LLM methods (llm, local,
 *               openai, anthropic, gemini) and llm-coached — a short hash of
 *               the coaching TEXT (lib/pairs.js reads a pair's, a language's
 *               or a fallback's own coachingFile into coachingPrompt; config.js
 *               the top-level one), plus, for llm-coached, any structured
 *               plugin coachingData. So an edit of the file re-translates.
 *               Only an llm-coached pair built without resolution (a library
 *               caller) falls back to the path; it reads the file itself.
 *               '' for the methods that send no coaching (api, the MT
 *               engines) — a coaching file there changes nothing.
 *               Until 2026-10 only llm-coached was keyed on it: a `local`
 *               fallback's coaching file never reached its prompt nor its
 *               key, and `--redo all` served the uncoached text (Round 10,
 *               school persona). Older entries made with the SAME coaching
 *               text stay reachable (adoptLegacyCoachingKeys).
 *
 * Changing any component makes old entries unreachable (a cache miss, so
 * the API is consulted) WITHOUT nuking valid entries for other pairs —
 * which is why callers must use this instead of bumping TM_VERSION.
 *
 * @param {object} pairConfig - Pair config (method, model, register, registerPreset, coaching*)
 * @returns {string} Stable method-key string, e.g. "llm|google/gemini-3.5-flash|formal|"
 */
/** origin + path of an endpoint URL ('' when absent or unparseable). */
function _endpointIdentity(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return '';
  try {
    const u = new URL(endpoint);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function tmMethodKey(pairConfig) {
  const method = pairConfig.method || 'llm';
  // An `api` pair's system is its ENDPOINT (or its method plugin), not the
  // global default model it inherits but never calls — a trained model served
  // by nmt-forge was cached under "google/gemini-…" (synthetic review). Only
  // origin + path: a query string or credentials must never land in the cache.
  // Older entries keyed the old way are still served by model carry-over.
  const model = method === 'api'
    ? (pairConfig.methodPlugin || _endpointIdentity(pairConfig.endpoint) || pairConfig.model || '')
    : (pairConfig.model || '');

  let register = pairConfig.registerPreset
    || (typeof pairConfig.register === 'string' && pairConfig.register.length > 0
      ? _shortHash(pairConfig.register)
      : '');
  // Gender guidance the config chose (its own instruction, or none): another
  // prompt, so another cache entry. The catalogue's default adds nothing, so
  // every existing entry keeps its key.
  if (pairConfig.genderGuidanceSource === 'off') register += '+gender-off';
  else if (pairConfig.genderGuidanceSource === 'config' && typeof pairConfig.genderGuidance === 'string') {
    register += `+gender-${_shortHash(pairConfig.genderGuidance)}`;
  }

  return `${method}|${model}|${register}|${_coachingSegment(method, pairConfig, pairConfig.coachingPrompt)}`;
}

/**
 * The coaching part of a method key: a short hash of the coaching text the
 * method's prompt carries ('' when it carries none).
 *
 * @param {string} method
 * @param {object} pairConfig
 * @param {string|null|undefined} promptText - The coaching text to fingerprint
 * @param {{ plainKeyed?: boolean }} [opts] - false: the plain LLM methods
 *   are not keyed (how keys were made before 2026-10 — legacyMethodKey)
 * @returns {string}
 */
function _coachingSegment(method, pairConfig, promptText, { plainKeyed = true } = {}) {
  if (!COACHING_PROMPT_METHODS.has(method)) return '';
  if (method !== 'llm-coached' && !plainKeyed) return '';
  const parts = [];
  if (typeof promptText === 'string' && promptText.trim().length > 0) {
    parts.push(promptText);
  } else if (method === 'llm-coached' && typeof pairConfig.coachingFile === 'string' && pairConfig.coachingFile.trim().length > 0) {
    // Unresolved (a pair built by a library caller): llm-coached reads the
    // file itself, so its path stands for it. The plain methods read only
    // the resolved text — without it they send no coaching.
    parts.push(`file:${pairConfig.coachingFile}`);
  }
  if (method === 'llm-coached' && pairConfig.coachingData) {
    parts.push(JSON.stringify(pairConfig.coachingData));
  }
  return parts.length > 0 ? _shortHash(parts.join('\x00')) : '';
}

/**
 * The method key this pair's entries were made under before its coaching
 * was keyed the way tmMethodKey keys it now — or null when that is the same
 * key, or when the coaching those entries were made with is not the
 * coaching the pair has now (they were made with other text: not reusable).
 *
 * Before 2026-10 the plain LLM methods kept '' as coaching whatever their
 * prompt carried, and llm-coached fingerprinted a pair's own coachingFile by
 * its PATH. lib/pairs.js records on each pair the coaching text that
 * version would have SENT (`_legacyCoachingSent`): the top-level or inline
 * coaching it did send; never a language's, pair's or fallback's own
 * coachingFile for a plain method, which it never read.
 *
 * @param {object} pairConfig - Resolved pair (lib/pairs.js)
 * @returns {string|null}
 */
function legacyMethodKey(pairConfig) {
  if (!pairConfig || !Object.prototype.hasOwnProperty.call(pairConfig, '_legacyCoachingSent')) return null;
  const now = typeof pairConfig.coachingPrompt === 'string' && pairConfig.coachingPrompt.trim() ? pairConfig.coachingPrompt.trim() : null;
  const then = typeof pairConfig._legacyCoachingSent === 'string' && pairConfig._legacyCoachingSent.trim() ? pairConfig._legacyCoachingSent.trim() : null;
  if (now !== then) return null;
  const current = tmMethodKey(pairConfig);
  const [method, model, register] = current.split('|');
  const legacy = `${method}|${model}|${register}|${_coachingSegment(method, pairConfig, pairConfig._legacyCoachingPrompt, { plainKeyed: false })}`;
  return legacy === current ? null : legacy;
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
 * Model carry-over: a model switch reuses existing translations.
 *
 * tmMethodKey folds the model into every key, which on its own would make a
 * model switch strand the whole cache — every unchanged block in a re-queued
 * file would be re-translated and re-billed (the 2026-08 dogfood run priced
 * 70k such entries). Founder direction 2026-10-01: switching model is NOT a
 * reason to pay for a full re-translation. So on an exact miss, lookups fall
 * back to the same source text translated under a DIFFERENT MODEL with the
 * same method, register and coaching. Anything else that shapes output
 * (method, register, coaching) still misses — those changes exist to get
 * different text.
 *
 * Carried entries are served through the same gates as any TM hit
 * (lookupTMValidated evicts the entry that actually served). Opt out per run
 * with setModelCarryover(tm, false) — the CLI's --fresh-on-model-change.
 */
const _NO_CARRYOVER = Symbol('tm-no-model-carryover');
// --fresh / --no-tm: nothing is SERVED from the cache this run, but what the
// run pays for is still STORED. These used to swap in a throwaway empty TM,
// so a fresh re-translation was never cached and a later --redo served the
// older text back (synthetic review, 2026-10-03). Never serialized.
const _NO_READS = Symbol('tm-no-reads');

/**
 * Serve nothing from this TM for the rest of the run (writes still land).
 * @param {object} tm
 * @param {boolean} enabled - false = reads off
 */
function setTMReads(tm, enabled) {
  tm[_NO_READS] = !enabled;
}
const _SIBLINGS = Symbol('tm-model-siblings');
const _CARRIED = Symbol('tm-carried-hits');
const _BYPASS = Symbol('tm-bypass');

/**
 * Make lookups for these (locale, source text) pairs MISS for the rest of
 * this run — `sync --retranslate <glob>`: the named files are translated
 * fresh even though the TM holds their text. New translations are still
 * stored (replacing the old entries), so the next run is cached again.
 *
 * @param {object} tm - TM object
 * @param {string} locale - Target locale
 * @param {Iterable<string>} sourceTexts - Fields, body and block sources
 */
function bypassTMFor(tm, locale, sourceTexts) {
  if (!tm[_BYPASS]) tm[_BYPASS] = new Set();
  for (const text of sourceTexts) {
    if (typeof text === 'string' && text) tm[_BYPASS].add(`${locale}\x00${text}`);
  }
}

/**
 * Enable (default) or disable model carry-over for this TM object.
 *
 * @param {object} tm - TM object
 * @param {boolean} enabled - false = only exact-model hits are served
 */
function setModelCarryover(tm, enabled) {
  tm[_NO_CARRYOVER] = !enabled;
}

/**
 * How many lookups on this TM object were served by model carry-over.
 *
 * @param {object} tm - TM object
 * @returns {number}
 */
function carriedHitCount(tm) {
  return tm[_CARRIED] || 0;
}

/**
 * The model whose entry a lookup of (source, locale, method) would be served
 * from by model carry-over — null when the lookup misses or hits the exact
 * model. Read-only: counts no hit. Lets a run say "reused from the previous
 * model" only when it actually reuses something (Round 5, Next.js persona).
 *
 * @param {object} tm
 * @param {string} sourceValue - Text as cached
 * @param {string} locale
 * @param {string} method - Full method key (tmMethodKey)
 * @returns {string|null} The earlier model's name ('(none)' when it had none)
 */
function carriedFromModel(tm, sourceValue, locale, method) {
  const found = _findEntry(tm, sourceValue, locale, method);
  if (!found || !found.carried) return null;
  return found.methodKey.split('|')[1] || '(none)';
}

/** "method|model|register|coaching" → "locale\0method|register|coaching" (null if not 4-part). */
function _siblingGroup(locale, methodKey) {
  const parts = methodKey.split('|');
  if (parts.length !== 4) return null;
  return `${locale}\x00${parts[0]}|${parts[2]}|${parts[3]}`;
}

/** Lazily index the method keys present per (locale, model-less key). */
function _siblingIndex(tm) {
  if (!tm[_SIBLINGS]) {
    const index = new Map();
    for (const [k, entry] of Object.entries(tm)) {
      if (k === '_meta' || !entry || typeof entry.m !== 'string' || typeof entry.l !== 'string') continue;
      const group = _siblingGroup(entry.l, entry.m);
      if (group === null) continue;
      if (!index.has(group)) index.set(group, new Set());
      index.get(group).add(entry.m);
    }
    tm[_SIBLINGS] = index;
  }
  return tm[_SIBLINGS];
}

/**
 * Find the entry that serves (source, locale, method): the exact key first,
 * then — unless carry-over is off — the newest entry for the same text
 * under another model. Returns the method key that actually holds it so a
 * failed validation evicts the right entry.
 *
 * @returns {{ text: string, methodKey: string, carried: boolean } | null}
 */
function _findEntry(tm, sourceValue, locale, method) {
  if (tm[_NO_READS]) return null;
  if (tm[_BYPASS] && tm[_BYPASS].has(`${locale}\x00${sourceValue}`)) return null;
  const exact = tm[cacheKey(sourceValue, locale, method)];
  if (exact && typeof exact.t === 'string') return { text: exact.t, methodKey: method, carried: false };
  // The same setup's entries from before its coaching was keyed (same
  // method, model, register and coaching TEXT): this pair's own work.
  const legacy = _legacyKeyOf(tm, locale, method);
  if (legacy) {
    const old = tm[cacheKey(sourceValue, locale, legacy)];
    // methodKey: the entry that holds it (what a failed check evicts);
    // writer: the setup that made it, today's key (what the lock records).
    if (old && typeof old.t === 'string') return { text: old.t, methodKey: legacy, writer: method, carried: false };
  }
  if (tm[_NO_CARRYOVER]) return null;

  const groups = [_siblingGroup(locale, method), legacy ? _siblingGroup(locale, legacy) : null].filter(Boolean);
  let best = null;
  for (const group of groups) {
    for (const other of _siblingIndex(tm).get(group) || []) {
      if (other === method || other === legacy) continue;
      const entry = tm[cacheKey(sourceValue, locale, other)];
      if (entry && typeof entry.t === 'string' && (!best || String(entry.ts) > String(best.entry.ts))) {
        best = { entry, methodKey: other };
      }
    }
  }
  return best ? { text: best.entry.t, methodKey: best.methodKey, carried: true } : null;
}

// ── Coaching keys from before 2026-10 ────────────────────────────────

/**
 * Once per cache written before coaching was keyed: remember, in the cache
 * itself, which of its keys (legacyMethodKey) hold THIS setup's work —
 * method, model, register and the coaching text the pair has now. Lookups
 * then serve those entries for the current key, so an upgrade re-translates
 * nothing and no file is reported as "written by another coaching"
 * (canonicalWriterKey).
 *
 * ONCE: the first run that loads such a cache records it and marks the cache
 * `coachingKeyed`; a new cache is marked from the start. After that a key
 * with an empty coaching part is just an uncoached entry, so coaching added
 * or edited later is a change — it re-translates (what the key is for). A
 * pair whose coaching the old version never sent (a fallback's own
 * coachingFile with a plain method) gets no record: its old entries were
 * made without that coaching. What cannot be known: old entries made before
 * a coaching that was added in the same upgrade are taken as made with it —
 * as the old version served them.
 *
 * @param {object} tm
 * @param {Iterable<object>} pairConfigs - Resolved pairs (fallbacks are visited too)
 * @returns {number} records added
 */
function adoptLegacyCoachingKeys(tm, pairConfigs) {
  if (!tm || tm._meta?.coachingKeyed) return 0;
  let added = 0;
  const visit = (pc) => {
    if (!pc || typeof pc.target !== 'string') return;
    const legacy = legacyMethodKey(pc);
    if (!legacy) return;
    if (!_localeMethodKeys(tm, pc.target).has(legacy)) return;
    tm._meta.coachingKeys = tm._meta.coachingKeys || {};
    tm._meta.coachingKeys[pc.target] = tm._meta.coachingKeys[pc.target] || {};
    tm._meta.coachingKeys[pc.target][tmMethodKey(pc)] = legacy;
    added++;
  };
  tm._meta = tm._meta || {};
  for (const pc of pairConfigs || []) {
    visit(pc);
    visit(pc?.fallback);
  }
  tm._meta.coachingKeyed = true;
  _markDirty(tm);
  return added;
}

/** The pre-2026-10 key recorded for (locale, current key), or null. */
function _legacyKeyOf(tm, locale, method) {
  const legacy = tm?._meta?.coachingKeys?.[locale]?.[method];
  return typeof legacy === 'string' && legacy !== method ? legacy : null;
}

/**
 * The key a writer recorded in the lock (`by`) stands for today: a key from
 * before coaching was keyed, for a setup adoptLegacyCoachingKeys recorded,
 * reads as that setup's current key — the same model kept, so an earlier
 * model stays an earlier model. Any other key is returned as it is.
 *
 * @param {object} tm
 * @param {string} locale
 * @param {string} methodKey
 * @returns {string}
 */
function canonicalWriterKey(tm, locale, methodKey) {
  const records = tm?._meta?.coachingKeys?.[locale];
  if (!records || typeof methodKey !== 'string') return methodKey;
  const parts = methodKey.split('|');
  if (parts.length !== 4) return methodKey;
  for (const [current, legacy] of Object.entries(records)) {
    if (legacy === methodKey) return current;
    const c = current.split('|');
    const l = legacy.split('|');
    if (c.length !== 4 || l.length !== 4) continue;
    // Same method, register and old coaching, another model: that model's
    // entry under today's coaching key.
    if (parts[0] === l[0] && parts[2] === l[2] && parts[3] === l[3]) return `${c[0]}|${parts[1]}|${c[2]}|${c[3]}`;
  }
  return methodKey;
}

/**
 * What a lookup of (source, locale, method) would serve — exact model, else
 * model carry-over — without counting a carried hit. Honors --fresh and
 * --retranslate (null when reads are off). For reports that must not change
 * the run's tallies.
 *
 * @returns {string|null}
 */
function peekTM(tm, sourceValue, locale, method) {
  const found = _findEntry(tm, sourceValue, locale, method);
  return found ? found.text : null;
}

/**
 * The method key of the entry a lookup of (source, locale, method) serves
 * from — `method` itself on an exact hit, another model's key on a carried
 * one — or null on a miss. Read-only. Lets sync record which model wrote a
 * value it served from the cache (lib/locale-state.js `by`).
 *
 * @returns {string|null}
 */
function servingMethodKey(tm, sourceValue, locale, method) {
  const found = _findEntry(tm, sourceValue, locale, method);
  if (!found) return null;
  return found.writer || canonicalWriterKey(tm, locale, found.methodKey);
}

/**
 * Every translation the cache holds for (source text, locale), under ANY
 * method key — the proof that a value on disk is something the pipeline
 * produced (lib/locale-state.js: a value with no written-record counts as
 * Champollion's only when the cache holds it). Read-only: ignores the
 * --fresh read switch and --retranslate bypass, counts no carry-over hit.
 *
 * @param {object} tm
 * @param {string} sourceValue - Text as cached (lib/tm-evict.js tmSourceText)
 * @param {string} locale
 * @returns {Set<string>}
 */
function tmTranslationsOf(tm, sourceValue, locale) {
  const out = new Set();
  if (!tm || typeof sourceValue !== 'string') return out;
  for (const mk of _localeMethodKeys(tm, locale)) {
    const entry = tm[cacheKey(sourceValue, locale, mk)];
    if (entry && typeof entry.t === 'string') out.add(entry.t);
  }
  return out;
}

/**
 * The method keys whose cache entry for (source text, locale) holds exactly
 * `value` — who could have produced a value on disk. Read-only.
 *
 * @param {object} tm
 * @param {string} sourceValue - Text as cached
 * @param {string} locale
 * @param {string} value
 * @returns {string[]}
 */
function tmMethodKeysHolding(tm, sourceValue, locale, value) {
  const out = [];
  if (!tm || typeof sourceValue !== 'string' || typeof value !== 'string') return out;
  for (const mk of _localeMethodKeys(tm, locale)) {
    const entry = tm[cacheKey(sourceValue, locale, mk)];
    // A key from before coaching was keyed reads as its setup's today.
    if (entry && entry.t === value) out.push(canonicalWriterKey(tm, locale, mk));
  }
  return [...new Set(out)];
}

/**
 * Every translation text the cache holds for a locale (any source, any
 * method). For a value whose source has since changed — its old text is
 * known only by hash — "the cache holds this exact text" is the remaining
 * proof that the pipeline wrote it. Read-only.
 *
 * @param {object} tm
 * @param {string} locale
 * @returns {Set<string>}
 */
function tmTranslationSet(tm, locale) {
  const out = new Set();
  for (const [k, entry] of Object.entries(tm || {})) {
    if (k === '_meta' || !entry || entry.l !== locale || typeof entry.t !== 'string') continue;
    out.add(entry.t);
  }
  return out;
}

/**
 * Cached translations of these texts that this pair can NOT reuse because
 * they were made with another method, register or coaching (a different
 * MODEL alone is reused — model carry-over). Switching method (local → llm)
 * showed "0 served from the cache" with no reason (Round 4, Next.js
 * persona); this is the reason, counted. Read-only.
 *
 * @param {object} tm
 * @param {object} pairConfig
 * @param {string[]} texts - Texts as cached (lib/tm-evict.js tmSourceText)
 * @returns {Array<{ methodKey: string, count: number }>} most first
 */
function findOtherMethodEntries(tm, pairConfig, texts) {
  const locale = pairConfig.target;
  const current = tmMethodKey(pairConfig);
  const [method, , register, coaching] = current.split('|');
  const counts = new Map();
  for (const mk of _localeMethodKeys(tm, locale)) {
    if (mk === current) continue;
    const parts = mk.split('|');
    // Same method, register and coaching = a sibling model: carry-over reuses it.
    if (parts.length === 4 && parts[0] === method && parts[2] === register && parts[3] === coaching) continue;
    let n = 0;
    for (const text of texts) if (tm[cacheKey(text, locale, mk)]) n++;
    if (n > 0) counts.set(mk, n);
  }
  return [...counts.entries()].map(([methodKey, count]) => ({ methodKey, count })).sort((a, b) => b.count - a.count);
}

const _LOCALE_KEYS = Symbol('tm-locale-method-keys');
/** Method keys present per locale, indexed once per TM object. */
function _localeMethodKeys(tm, locale) {
  if (!tm[_LOCALE_KEYS]) {
    const index = new Map();
    for (const [k, entry] of Object.entries(tm)) {
      if (k === '_meta' || !entry || typeof entry.m !== 'string' || typeof entry.l !== 'string') continue;
      if (!index.has(entry.l)) index.set(entry.l, new Set());
      index.get(entry.l).add(entry.m);
    }
    tm[_LOCALE_KEYS] = index;
  }
  return tm[_LOCALE_KEYS].get(locale) || new Set();
}

/**
 * Look up a cached translation — exact model first, then (by default) the
 * same text under another model; see "Model carry-over" above.
 *
 * @param {object} tm - TM object (from loadTM)
 * @param {string} sourceValue - Source language value
 * @param {string} locale - Target locale code
 * @param {string} method - Translation method name
 * @returns {string|null} Cached translation, or null for cache miss
 */
function lookupTM(tm, sourceValue, locale, method) {
  const found = _findEntry(tm, sourceValue, locale, method);
  if (!found) return null;
  if (found.carried) tm[_CARRIED] = (tm[_CARRIED] || 0) + 1;
  return found.text;
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
 * @param {{ countCarry?: boolean }} [opts] - countCarry false: a look before
 *   serving (the content lanes' repeat check) — a carried hit is counted
 *   when it is served, not twice
 * @returns {string|null} Validated cached translation, or null
 */
function lookupTMValidated(tm, sourceValue, locale, method, isValid, { countCarry = true } = {}) {
  const found = _findEntry(tm, sourceValue, locale, method);
  if (!found) return null;
  if (isValid(sourceValue, found.text)) {
    if (found.carried && countCarry) tm[_CARRIED] = (tm[_CARRIED] || 0) + 1;
    return found.text;
  }
  // Evict the entry that actually served — for a carried hit that is the
  // OTHER model's entry; evicting the exact key would leave it to re-fail.
  evictTM(tm, sourceValue, locale, found.methodKey);
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
  const prior = tm[key];
  const stats = _changeStats(tm);
  if (!prior) stats.added++;
  else if (prior.t !== translation) stats.replaced++;
  else stats.refreshed++;
  tm[key] = {
    t: translation,
    ts: new Date().toISOString(),
    l: locale,   // locale code — enables per-locale stats and filtering
    m: method,   // method name — enables per-method stats
  };
  if (tm[_LOCALE_KEYS]) {
    if (!tm[_LOCALE_KEYS].has(locale)) tm[_LOCALE_KEYS].set(locale, new Set());
    tm[_LOCALE_KEYS].get(locale).add(method);
  }
  if (tm[_SIBLINGS]) {
    const group = _siblingGroup(locale, method);
    if (group !== null) {
      if (!tm[_SIBLINGS].has(group)) tm[_SIBLINGS].set(group, new Set());
      tm[_SIBLINGS].get(group).add(method);
    }
  }
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
    _changeStats(tm).removed++;
    _markDirty(tm);
    return true;
  }
  return false;
}

// What this run did to the cache — never serialized. "+0 this sync" after a
// --fresh redo read as if nothing was saved, when every entry had been
// replaced by the new translation (Round 3, Django persona).
const _STATS = Symbol('tm-change-stats');
function _changeStats(tm) {
  if (!tm[_STATS]) tm[_STATS] = { added: 0, replaced: 0, refreshed: 0, removed: 0 };
  return tm[_STATS];
}

/**
 * Entries this TM object gained, replaced (new text for the same source,
 * locale and method), re-stored with identical text, or removed since load.
 *
 * @param {object} tm
 * @returns {{ added: number, replaced: number, refreshed: number, removed: number }}
 */
function tmChangeStats(tm) {
  return { ..._changeStats(tm) };
}

/**
 * One line for the end of a sync: how big the cache is and what changed.
 * e.g. "12 entries — 2 added, 6 replaced with a new translation, 1 removed".
 *
 * @param {object} tm
 * @returns {string}
 */
function describeTMChanges(tm) {
  const { added, replaced, refreshed, removed } = _changeStats(tm);
  const parts = [`${added} added`];
  if (replaced > 0) parts.push(`${replaced} replaced with a new translation`);
  if (refreshed > 0) parts.push(`${refreshed} re-translated to the same text`);
  if (removed > 0) parts.push(`${removed} removed`);
  return `${tmSize(tm)} entries — ${parts.join(', ')}`;
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
      // Every entry of this cache is keyed with its coaching (tmMethodKey):
      // nothing in it is from before, so nothing is adopted
      // (adoptLegacyCoachingKeys).
      coachingKeyed: true,
    },
  };
}

// -----------------------------------------------------------------
// Exports
// -----------------------------------------------------------------

/**
 * Find TM entries a MODEL SWITCH stranded.
 *
 * tmMethodKey folds the model into every key on purpose (a new model should
 * not be served the old one's output by accident). The cost of that rule is
 * silent: after a model change, every entry for the pair becomes unreachable
 * and the next sync prices — and bills — a full re-translation of text that
 * never changed. The 2026-08 dogfood run hit this with 70k entries.
 *
 * The recovery already exists (`champollion tm seed` re-keys the on-disk
 * translations under the current method key, for free); what was missing is
 * anyone noticing. This reports, per target locale, entries whose method key
 * is identical to the current one EXCEPT for the model segment. Pure — the
 * caller decides how to say it.
 *
 * COUNTS ONLY WHAT THE PROJECT STILL USES when `sourceTexts` is given: an
 * entry for a string since edited or deleted cannot be reused, and counting
 * it announced "12 cached translations will be reused" for a project with
 * 10 keys (Round 3, Next.js persona).
 *
 * @param {object} tm - TM object (from loadTM)
 * @param {Iterable<object>} pairConfigs - Resolved pair configs for this run
 * @param {{ sourceTexts?: Iterable<string>|null, every?: boolean }} [options] - the texts the
 *   project's current source strings are cached under (lib/tm-evict.js
 *   tmSourceText); omitted = count every entry. `every`: report each locale
 *   where an earlier model holds entries at all (no "more than the current
 *   model" threshold, switches marked done included)
 * @returns {Array<{ target: string, currentModel: string, current: number,
 *   stranded: Array<{ model: string, count: number }> }>} Locales where some
 *   other model holds more entries than the current one. Empty when none.
 */
function findModelSwitchStrandedEntries(tm, pairConfigList, { sourceTexts = null, every = false } = {}) {
  // Iterated twice below — an iterator (Map#values()) would be empty the 2nd time.
  const pairConfigs = [...pairConfigList];
  // Count entries per (locale, method key) once.
  const counts = new Map();
  const methodKeysByLocale = new Map();
  for (const [k, entry] of Object.entries(tm)) {
    if (k === '_meta' || !entry || typeof entry.m !== 'string' || typeof entry.l !== 'string') continue;
    const id = `${entry.l}\x00${entry.m}`;
    counts.set(id, (counts.get(id) || 0) + 1);
    if (!methodKeysByLocale.has(entry.l)) methodKeysByLocale.set(entry.l, new Set());
    methodKeysByLocale.get(entry.l).add(entry.m);
  }
  // Restricted to the current source: count, per (locale, method key), the
  // current texts that method key holds a translation for.
  if (sourceTexts) {
    const texts = [...new Set(sourceTexts)].filter(t => typeof t === 'string');
    counts.clear();
    const targets = new Set(pairConfigs.map(pc => pc.target));
    for (const locale of targets) {
      for (const mk of methodKeysByLocale.get(locale) || []) {
        let n = 0;
        for (const text of texts) if (tm[cacheKey(text, locale, mk)]) n++;
        if (n > 0) counts.set(`${locale}\x00${mk}`, n);
      }
    }
  }

  const report = [];
  for (const pairConfig of pairConfigs) {
    const target = pairConfig.target;
    const currentKey = tmMethodKey(pairConfig);
    // Fully re-translated under this model already (sync records it after
    // --redo all --fresh-on-model-change): the switch is done, nothing to say.
    // `every`: a locale where any earlier model holds entries, whatever the
    // counts — for a run that serves one of them (Round 13: a string reverted
    // to text only the earlier model had translated).
    if (!every && tm._meta?.switchedTo?.[target] === currentKey) continue;
    const [method, currentModel, register, coaching] = currentKey.split('|');
    const current = counts.get(`${target}\x00${currentKey}`) || 0;
    const stranded = [];
    for (const [id, count] of counts) {
      const [locale, methodKey] = id.split('\x00');
      if (locale !== target || methodKey === currentKey) continue;
      const parts = methodKey.split('|');
      if (parts.length !== 4) continue;
      if (parts[0] === method && parts[2] === register && parts[3] === coaching && parts[1] !== currentModel) {
        stranded.push({ model: parts[1], count });
      }
    }
    stranded.sort((a, b) => b.count - a.count);
    // Only worth saying when another model holds MORE than the current one:
    // a few leftovers after a deliberate switch are not news.
    if (stranded.length > 0 && (every || stranded[0].count > current)) {
      report.push({ target, currentModel, current, stranded });
    }
  }
  return report;
}

/**
 * What an earlier model's cache holds for one pair, counted ONCE per thing
 * so a total and its per-model breakdown always add up.
 *
 * `findModelSwitchStrandedEntries` counts, per earlier model, every string
 * that model holds — two earlier models that both translated a string count
 * it twice, and a model's count includes strings the current model has too.
 * A notice that summed the first model's count and then listed every model's
 * said "12 cached translation(s)" above per-model counts adding up to 30
 * (Round 11, Next.js persona).
 *
 * With `sourceTexts` it counts STRINGS of the current source that only an
 * earlier model translated (what carry-over would serve), each under the
 * model carry-over would serve it from (the newest entry, as lookups pick).
 * Without them (a project whose Markdown blocks share the cache) strings
 * cannot be told apart, so it counts cache ENTRIES per earlier model, and
 * the total is their sum.
 *
 * @param {object} tm
 * @param {object} pairConfig - The resolved pair
 * @param {Array<{ model: string }>} stranded - The pair's row from findModelSwitchStrandedEntries
 * @param {{ sourceTexts?: Iterable<string>|null }} [options]
 * @returns {{ unit: 'strings'|'entries', total: number, byModel: Array<{ model: string, count: number }> }}
 */
function reusableFromEarlierModels(tm, pairConfig, stranded, { sourceTexts = null } = {}) {
  if (!sourceTexts) {
    const byModel = stranded.map(s => ({ model: s.model, count: s.count }));
    return { unit: 'entries', total: byModel.reduce((n, s) => n + s.count, 0), byModel };
  }
  const target = pairConfig.target;
  const currentKey = tmMethodKey(pairConfig);
  const [method, , register, coaching] = currentKey.split('|');
  const earlierKeys = stranded.map(s => ({ model: s.model, methodKey: [method, s.model, register, coaching].join('|') }));
  const counts = new Map();
  let total = 0;
  for (const text of new Set(sourceTexts)) {
    if (typeof text !== 'string' || tm[cacheKey(text, target, currentKey)]) continue;
    let best = null;
    for (const k of earlierKeys) {
      const entry = tm[cacheKey(text, target, k.methodKey)];
      if (entry && typeof entry.t === 'string' && (!best || String(entry.ts) > String(best.ts))) best = { ts: entry.ts, model: k.model };
    }
    if (!best) continue;
    counts.set(best.model, (counts.get(best.model) || 0) + 1);
    total++;
  }
  const byModel = [...counts].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count);
  return { unit: 'strings', total, byModel };
}

/**
 * A method key in words, for reports: "llm|google/gemini-3.5-flash|formal-vous|"
 * → "llm · model google/gemini-3.5-flash · register formal-vous". `tm stats`
 * printed the raw key (Round 3, Next.js persona). Legacy bare keys ("llm")
 * are returned as they are.
 *
 * @param {string} methodKey
 * @returns {string}
 */
function describeMethodKey(methodKey) {
  const parts = String(methodKey).split('|');
  if (parts.length !== 4) return String(methodKey);
  const [method, model, register, coaching] = parts;
  const bits = [method || 'llm'];
  if (model) bits.push(`model ${model}`);
  if (register) bits.push(`register ${register}`);
  if (coaching) bits.push(`coaching ${coaching}`);
  return bits.join(' · ');
}

/**
 * Whether a writer key (the lock's `by`) is the pair's FALLBACK: 'current'
 * for the fallback as it is set up now, 'earlier' for the same fallback as it
 * was set up before — another model, register or coaching of the fallback's
 * method (and, when the pair and its fallback share a method, the fallback's
 * model) — else null. Values the fallback wrote are its by design; one its
 * earlier setup wrote is re-translated by a redo (Round 10, school persona:
 * a coaching file added to a `local` fallback).
 *
 * @param {object} pairConfig - Resolved pair with its `fallback`
 * @param {string} methodKey
 * @returns {'current'|'earlier'|null}
 */
function fallbackWriterOf(pairConfig, methodKey) {
  const fb = pairConfig?.fallback;
  if (!fb || typeof methodKey !== 'string') return null;
  const fbKey = tmMethodKey(fb);
  if (methodKey === fbKey) return 'current';
  const parts = methodKey.split('|');
  const fbParts = fbKey.split('|');
  if (parts.length !== 4 || parts[0] !== fbParts[0]) return null;
  if (fb.method === pairConfig.method && parts[1] !== fbParts[1]) return null;
  // The pair's own setup (same method, register and coaching) is the pair's.
  const own = tmMethodKey(pairConfig).split('|');
  if (fb.method === pairConfig.method && parts[2] === own[2] && parts[3] === own[3]) return null;
  return 'earlier';
}

/**
 * Which models produced the values a target file holds now. After a model
 * switch without a full re-translation the files mix two models' text, and
 * nothing said so (Round 3, Next.js persona: `status`).
 *
 * The lock's record comes first: `writtenBy` (lib/locale-state.js `by`) is
 * the method key that produced the value sync last wrote, and is used when
 * that value is still the one on disk. A value with no record (written
 * before 0.4.0) is attributed from the cache: the entry under this pair's
 * method, register and coaching — any model — whose text IS that value.
 * When several models cached the identical text, the value is "model
 * unknown": the older answer used to win, and `status` named a model that
 * had not written the files (Round 6, Next.js persona).
 *
 * Values produced by the pair's own fallback are not counted (they are the
 * fallback's by design); a value no record or entry explains (hand-written,
 * older than the cache) is not attributed.
 *
 * @param {object} tm
 * @param {object} pairConfig - Resolved pair config (target, method, model, fallback, …)
 * @param {Iterable<{ text?: string, texts?: string[], value: string, writtenBy?: string|null }>} items -
 *   cached-under text(s) (lib/tm-evict.js), the value on disk, and the
 *   lock's record of who wrote it when it is current
 * @returns {Array<{ model: string, keys: number, current: boolean, unknown?: true, candidates?: string[] }>} most keys first
 */
function modelsBehindValues(tm, pairConfig, items) {
  const target = pairConfig.target;
  const currentKey = tmMethodKey(pairConfig);
  const fallbackKey = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
  const group = _siblingGroup(target, currentKey);
  const sameGroup = (mk) => mk === currentKey || (group !== null && _siblingGroup(target, mk) === group);
  const modelOf = (mk) => mk.split('|')[1] || '(none)';
  const label = (mk) => (sameGroup(mk) ? modelOf(mk) : describeMethodKey(mk));
  const buckets = new Map();
  const add = (id, make) => {
    if (!buckets.has(id)) buckets.set(id, make());
    buckets.get(id).keys++;
  };
  for (const item of items) {
    const { value } = item;
    if (typeof value !== 'string') continue;
    if (typeof item.writtenBy === 'string' && item.writtenBy) {
      if (item.writtenBy === fallbackKey || fallbackWriterOf(pairConfig, item.writtenBy)) continue;
      add(item.writtenBy, () => ({ model: label(item.writtenBy), keys: 0, current: item.writtenBy === currentKey }));
      continue;
    }
    const texts = Array.isArray(item.texts) ? item.texts : [item.text];
    const holders = new Set();
    for (const text of texts) {
      if (typeof text !== 'string') continue;
      for (const mk of _localeMethodKeys(tm, target)) {
        if (!sameGroup(mk)) continue;
        const entry = tm[cacheKey(text, target, mk)];
        if (entry && entry.t === value) holders.add(mk);
      }
    }
    if (holders.size === 1) {
      const mk = [...holders][0];
      add(mk, () => ({ model: label(mk), keys: 0, current: mk === currentKey }));
    } else if (holders.size > 1) {
      const candidates = [...new Set([...holders].map(modelOf))].sort();
      add(`?${candidates.join('\u0000')}`, () => ({ model: 'model unknown', keys: 0, current: false, unknown: true, candidates }));
    }
  }
  return [...buckets.values()].sort((a, b) => b.keys - a.keys);
}

export {
  peekTM,
  servingMethodKey,
  tmMethodKeysHolding,
  findOtherMethodEntries,
  tmTranslationsOf,
  tmTranslationSet,
  describeMethodKey,
  modelsBehindValues,
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
  tmChangeStats,
  describeTMChanges,
  cacheKey,
  tmMethodKey,
  legacyMethodKey,
  adoptLegacyCoachingKeys,
  canonicalWriterKey,
  fallbackWriterOf,
  findModelSwitchStrandedEntries,
  reusableFromEarlierModels,
  setModelCarryover,
  setTMReads,
  bypassTMFor,
  carriedHitCount,
  carriedFromModel,
  TM_VERSION,
  TM_DIR,
  TM_FILENAME,
};
