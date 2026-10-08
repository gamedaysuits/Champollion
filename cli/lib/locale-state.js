/**
 * locale-state.js — what sync knows about each target locale's values, kept
 * in .champollion.lock under "locales" (lib/hash.js has the file format).
 *
 * THREE GAPS THIS CLOSES (Round 4 synthetic developers, 2026-10-03):
 *
 *   1. A redo that could not finish was forgotten. `sync --redo all
 *      --fresh-on-model-change` refused 3 keys and said they "will be retried
 *      on the next sync"; the next sync did 0 keys (the keys exist on disk
 *      and their source is unchanged), so the model switch never completed
 *      and `status` said nothing. Now those keys are recorded as PENDING and
 *      the next plain sync asks for them again — from the model, not the
 *      cache (that was the point of the redo).
 *
 *   2. A hand-fixed translation was overwritten by `--redo all` (the very
 *      command the model-change notice recommends). The Markdown lane keeps
 *      a reviewer's edits (lib/content-review.js); key-value files now do the
 *      same: sync records a hash of each value it WRITES, and a value that no
 *      longer matches was changed by a person. Bulk redos keep it and say so;
 *      a redo that names the key replaces it; a source change replaces it too
 *      (the edit was for the old text) but prints the edited wording and
 *      appends it to .champollion-replaced-edits.jsonl, so it is never lost.
 *
 *   3. Refused keys were re-billed on every sync. The quality gate refused a
 *      key; nothing remembered it; the next sync sent it to the same paid
 *      model again, and again. Now a refusal is remembered per (key, source
 *      text, method key) and a plain sync holds the key back.
 *
 * And the record answers a question nothing could before: is this
 * translation out of date? A written-record whose source hash differs from
 * the current source text is a STALE translation (status, audit and verify
 * report it).
 *
 * PRECEDENCE — when are queued keys actually sent to the model?
 *   1. Named by `--redo keys:` / `--force-keys`, or queued by `--redo all`,
 *      or anything under `--fresh`: always sent (an explicit redo).
 *   2. PENDING (left by a redo that could not finish): the next plain sync
 *      asks for it once more, from the model, even when the cache holds an
 *      older model's text. That retry is the one the redo promised.
 *   3. REFUSED (the gate refused this method's translation of the key's
 *      current source text): held back — not sent again until a redo names
 *      it, the source text changes, or the method/model changes (a fallback
 *      method that has not refused it still gets it). A pending key whose
 *      retry is refused again joins this group: it stays pending (status
 *      shows it) but is not re-sent on every sync.
 *   The cache is always consulted first (free); holding back only stops a
 *   paid call.
 *
 * HAND EDITS — what a sync does with a value that is not what it wrote:
 *   - plain sync, source unchanged: never touched (as before);
 *   - `--redo all` / `--force`, a pending retry: KEPT, and the run says how
 *     many were kept and how to replace one (`--redo keys:<k>`);
 *   - `--redo keys:<k>` naming it: replaced (asked for by name) — the edited
 *     wording is printed and recorded first;
 *   - its SOURCE changed: replaced (the edit was for the old text) — printed
 *     and recorded in .champollion-replaced-edits.jsonl.
 *   A value with no written-record (written before this version, by hand, or
 *   by another tool) counts as Champollion's only when the cache holds that
 *   exact text for the key; otherwise it is treated as a person's (kept).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashValue } from './hash.js';
import { tmTranslationsOf, tmTranslationSet, tmMethodKey } from './tm.js';
import { tmProofTextsFor } from './tm-evict.js';
import { GATE_VERSION } from './validate.js';

/** Where replaced hand edits are recorded: the project root, tracked in git. */
export const REPLACED_EDITS_FILENAME = '.champollion-replaced-edits.jsonl';

/** 12 hex of the SHA-256 the source manifest stores for a source value. */
export function shortSourceHash(sourceValue) {
  return hashValue(sourceValue).slice(0, 12);
}

/** 12 hex of a value as it is in the file. */
export function valueHash(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex').slice(0, 12);
}

/** "<source hash>:<value hash>" — one written-record. */
export function encodeWritten(sourceValue, value) {
  return `${shortSourceHash(sourceValue)}:${valueHash(value)}`;
}

/** @returns {{ source: string, value: string }|null} */
export function decodeWritten(enc) {
  if (typeof enc !== 'string') return null;
  const m = /^([0-9a-f]{12}):([0-9a-f]{12})$/.exec(enc);
  return m ? { source: m[1], value: m[2] } : null;
}

/**
 * "<plural form>:<value hash>" — one forms-record: a borrowed i18next plural
 * form (French `count_many`, translated from the English `_other` text) that
 * the model was ASKED FOR as that form, and the fingerprint of the value its
 * answer left in the file. Committed in the lock, so whether "the model wrote
 * `_many` like `_other`" or "`_many` was filled from `_other`" is decided from
 * committed files alone — never from a machine's own cache (Round 7, i18next
 * persona: one commit passed `verify --strict` on one machine and failed on
 * another).
 */
export function encodeForm(form, value) {
  return `${form}:${valueHash(value)}`;
}

/** @returns {{ form: string, value: string }|null} */
export function decodeForm(enc) {
  if (typeof enc !== 'string') return null;
  const m = /^([a-z-]+):([0-9a-f]{12})$/.exec(enc);
  return m ? { form: m[1], value: m[2] } : null;
}

/**
 * The per-locale part of the lock, mutable for one run.
 *
 * @example
 *   const state = new LockState(readLock(cwd).locales);
 *   state.of('fr').written['nav.home'] = encodeWritten(src, value);
 *   writeManifest(cwd, manifest, state.toJSON());
 */
export class LockState {
  /** @param {object} [locales] - The lock's "locales" object */
  constructor(locales = {}) {
    this.locales = {};
    for (const [code, entry] of Object.entries(locales || {})) {
      if (!entry || typeof entry !== 'object') continue;
      // `by` is stored grouped ({ "<method key>": [keys…] }, compact and
      // diff-friendly) and held here per key.
      const by = {};
      for (const [methodKey, keys] of Object.entries(entry.by || {})) {
        if (Array.isArray(keys)) for (const k of keys) if (typeof k === 'string') by[k] = methodKey;
      }
      this.locales[code] = {
        written: { ...(entry.written || {}) },
        pending: { ...(entry.pending || {}) },
        refused: { ...(entry.refused || {}) },
        forms: { ...(entry.forms || {}) },
        // Plural messages answered without a form the language uses, per
        // key: { source, methods } (lib/plural-gap-redo.js).
        gaps: { ...(entry.gaps || {}) },
        by,
      };
    }
  }

  /** The state of one locale (created empty when absent). */
  of(code) {
    if (!this.locales[code]) this.locales[code] = { written: {}, pending: {}, refused: {}, forms: {}, gaps: {}, by: {} };
    if (!this.locales[code].forms) this.locales[code].forms = {};
    if (!this.locales[code].gaps) this.locales[code].gaps = {};
    return this.locales[code];
  }

  /** Read-only view (never creates an entry). */
  peek(code) {
    return this.locales[code] || { written: {}, pending: {}, refused: {}, forms: {}, gaps: {}, by: {} };
  }

  /**
   * Drop what no longer applies: locales the config no longer has, and keys
   * a locale's files no longer expect.
   *
   * @param {Map<string, Set<string>|null>} expectedByLocale - locale → its lock
   *   keys; null = a configured locale this run did not process (kept as is).
   *   A locale not in the map is no longer configured and is dropped.
   */
  prune(expectedByLocale) {
    for (const code of Object.keys(this.locales)) {
      if (!expectedByLocale.has(code)) { delete this.locales[code]; continue; }
      const keep = expectedByLocale.get(code);
      if (keep === null) continue;
      for (const part of ['written', 'pending', 'refused', 'forms', 'gaps', 'by']) {
        for (const k of Object.keys(this.locales[code][part] || {})) {
          if (!keep.has(k)) delete this.locales[code][part][k];
        }
      }
    }
  }

  /** The lock's "locales" object: `by` grouped by method key, keys sorted. */
  toJSON() {
    const out = {};
    for (const [code, entry] of Object.entries(this.locales)) {
      const grouped = {};
      for (const [k, methodKey] of Object.entries(entry.by || {})) {
        if (typeof methodKey !== 'string') continue;
        (grouped[methodKey] ||= []).push(k);
      }
      for (const keys of Object.values(grouped)) keys.sort();
      out[code] = {
        written: entry.written, pending: entry.pending, refused: entry.refused, forms: entry.forms || {},
        // Only when there is one: a lock without plural gaps stays as it was.
        ...(entry.gaps && Object.keys(entry.gaps).length > 0 && { gaps: entry.gaps }),
        by: grouped,
      };
    }
    return out;
  }
}

/**
 * Who wrote each value on disk, for one locale.
 *
 * @param {object} args
 * @param {object|null} args.tm - Loaded TM (the bootstrap proof); null = none
 * @param {string} args.locale
 * @param {object} args.written - LockState.of(locale).written
 * @returns {(lockKey: string, key: string, value: *, sourceValue: string, sourceChanged?: boolean) =>
 *   'machine'|'edited'|'unknown'}
 *   machine — what sync wrote (matches its record), or text the cache holds
 *             for the key (pipeline output — e.g. an older translation
 *             restored from git);
 *   edited  — differs from what sync wrote and is no pipeline output: a
 *             person changed it;
 *   unknown — no record and no cache proof (treated as a person's).
 */
export function createEditClassifier({ tm, locale, written, expansion = null }) {
  let everyTranslation = null;
  return (lockKey, key, value, sourceValue, sourceChanged = false) => {
    if (typeof value !== 'string') return 'machine';
    const record = decodeWritten(written[lockKey]);
    if (record && record.value === valueHash(value)) return 'machine';
    // Not what sync last wrote — but text the pipeline produced (an older
    // machine translation restored from git, damage an older version wrote)
    // is still machine text, never a person's.
    if (tm && typeof sourceValue === 'string') {
      // A borrowed plural form is proven by its own entry or — written by an
      // earlier version — by the entry it shared (lib/tm-evict.js).
      for (const text of tmProofTextsFor(key, sourceValue, expansion)) {
        if (tmTranslationsOf(tm, text, locale).has(value)) return 'machine';
      }
      // The source changed since: the old text is known only by its hash, so
      // the proof left is that the cache holds this exact translation text.
      if (sourceChanged) {
        if (!everyTranslation) everyTranslation = tmTranslationSet(tm, locale);
        if (everyTranslation.has(value)) return 'machine';
      }
    }
    return record ? 'edited' : 'unknown';
  };
}

/**
 * Does a refusal record hold this key back from `methodKey`?
 *
 * @param {object|undefined} record - LockState.of(code).refused[lockKey]
 * @param {string} sourceValue - Current source text of the key
 * @param {string} methodKey - tmMethodKey of the method about to be asked
 */
export function refusedBy(record, sourceValue, methodKey) {
  return !!record && typeof record === 'object' && record.source === shortSourceHash(sourceValue)
    && Array.isArray(record.methods) && record.methods.includes(methodKey);
}

/**
 * What a refusal record lets a run do with one unit (a key, a Markdown block,
 * a front-matter field, a whole page) of this source text: 'send' (ask the
 * pair's method), 'fallback-only' (the pair's method refused it; its fallback
 * has not), 'held' (not sent at all). THE rule, shared by every lane: the
 * key-value lane (planQueue), the Docusaurus UI strings, and the content
 * lanes (lib/content-refusals.js contentHolds).
 *
 * @param {object|undefined} record - { source, methods } (a refusal record)
 * @param {string} sourceValue - The unit's current source text
 * @param {object} pairConfig - The pair about to be asked (its `fallback` optional)
 * @returns {'send'|'fallback-only'|'held'}
 */
export function holdState(record, sourceValue, pairConfig) {
  // A refusal by an earlier gate lifts by itself (validate.js GATE_VERSION).
  if (!record || record.gate !== GATE_VERSION) return 'send';
  if (typeof sourceValue !== 'string' || !refusedBy(record, sourceValue, tmMethodKey(pairConfig))) return 'send';
  if (pairConfig.fallback && !refusedBy(record, sourceValue, tmMethodKey(pairConfig.fallback))) return 'fallback-only';
  return 'held';
}

/**
 * Remember that the gate refused `methods`' answers for one key's current
 * source text (merged with what an earlier run recorded for the same text).
 *
 * @param {object} localeState - LockState.of(code)
 * @param {string} lockKey
 * @param {string} sourceValue
 * @param {string[]} methods - Method keys whose answer was refused this run
 * @param {{ redo?: boolean }} [opts] - redo: refused under an explicit redo
 *   that leaves the key pending (the next plain sync gets one more try)
 */
export function recordRefusal(localeState, lockKey, sourceValue, methods, { redo = false } = {}) {
  if (!methods || methods.length === 0 || typeof sourceValue !== 'string') return;
  const prior = localeState.refused[lockKey];
  const src = shortSourceHash(sourceValue);
  const known = prior && prior.source === src && Array.isArray(prior.methods) ? prior.methods : [];
  localeState.refused[lockKey] = {
    source: src,
    methods: [...new Set([...known, ...methods])],
    on: new Date().toISOString().slice(0, 10),
    gate: GATE_VERSION,
    ...(redo && { redo: true }),
  };
}

/** "llm (model x/y)" — the method and model a message names. */
export function describeModel(pairConfig) {
  const model = pairConfig.method === 'api'
    ? (pairConfig.endpoint || pairConfig.methodPlugin || null)
    : pairConfig.model;
  return `${pairConfig.method}${model ? ` (${pairConfig.method === 'api' ? 'endpoint' : 'model'} ${model})` : ''}`;
}

const sampleOf = (keys, n = 3) => `${keys.slice(0, n).join(', ')}${keys.length > n ? `, +${keys.length - n} more` : ''}`;

/**
 * The warning for one file's keys held back — every key lane says it the
 * same way (the key-value files, Docusaurus UI strings).
 *
 * @param {object} p
 * @param {string} p.filename - The file as the run names it
 * @param {string[]} p.keys - Held keys, as a person names them
 * @param {object} p.pairConfig
 * @param {string} p.command - The `--redo keys:` command that asks again
 * @returns {string}
 */
export function describeHeldKeys({ filename, keys, pairConfig, command }) {
  return `${filename} — ${keys.length} key(s) held back (${sampleOf(keys)}): the quality gate refused `
    + `${describeModel(pairConfig)}'s translation of their current text on an earlier sync${pairConfig.fallback ? `, and the fallback's (${pairConfig.fallback.method})` : ''}, `
    + 'so they are not sent again (nothing billed; the cache is still read). '
    + `Ask again: \`${command}\`; or fill them another way — ${pairConfig.fallback ? 'another' : 'a'} "fallback" method on the pair, `
    + '"noTranslate" for text that stays as written, or write them in the file by hand.';
}

/** The note for keys only the pair's fallback is asked for. */
export function describeFallbackOnlyKeys({ filename, keys, pairConfig }) {
  return `${filename} — ${keys.length} key(s) go to the fallback (${pairConfig.fallback.method}) only: `
    + `${pairConfig.method} had its translation refused before (${sampleOf(keys)}).`;
}

/**
 * What the next sync does with a key this run could not translate, said with
 * the key: 'retry' (no usable answer — asked again), 'pending-retry' (an
 * explicit redo could not finish — asked once more), 'held' (refused by the
 * gate — held back).
 */
export function keyFateNote(fate, pairConfig) {
  return {
    retry: 'not translated (no usable answer) — the next sync asks again',
    'pending-retry': 'not translated — recorded as pending in .champollion.lock; the next sync asks the model once more',
    held: `refused by the quality gate — held back from now on (the next sync will not re-send it to ${pairConfig.method}; see the summary)`,
  }[fate];
}

/**
 * The end-of-run lines for keys held back from the next sync, with the
 * command per pair that asks again.
 *
 * @param {Array<{ pair: string, key: string }>} heldNext
 * @param {(keys: string[], pair: string) => string} commandFor - The `--redo keys:` command
 * @returns {string[]}
 */
export function describeHeldNext(heldNext, commandFor) {
  if (heldNext.length === 0) return [];
  const lines = [`  ${heldNext.length} key(s) are held back: the quality gate refused the method's translation of their current text, `
    + 'so the next sync will not send them to the same method again (it would bill the same answer). To ask again, name them:'];
  const byPair = new Map();
  for (const { pair, key } of heldNext) {
    if (!byPair.has(pair)) byPair.set(pair, []);
    byPair.get(pair).push(key);
  }
  for (const [pair, keys] of byPair) lines.push(`    \`${commandFor(keys.slice(0, 8), pair)}\`${keys.length > 8 ? ` (+${keys.length - 8} more)` : ''}`);
  lines.push('  Or fill them another way: a "fallback" method on the pair (it is asked for keys the pair\'s own method refused), '
    + '"noTranslate" for text that stays as written, or write them in the file by hand.');
  return lines;
}

/**
 * Decide what one target file's queued keys become. Shared by the sync and
 * the pre-run cost estimate, so the estimate prices exactly what the run
 * sends. Pure.
 *
 * @param {object} p
 * @param {import('./types.js').DiffResult} p.diff - diffLocale result, computed
 *   with the locale's pending keys among the forced ones
 * @param {object} p.sourceFlat - Expected source (target key space)
 * @param {object} p.targetFlat - Values on disk
 * @param {(key: string) => string} p.lockKeyOf - Target key → lock key
 * @param {object} p.localeState - LockState.of(code) (or .peek)
 * @param {Set<string>} p.named - Target keys named by --redo keys: / --force-keys
 * @param {boolean} p.bulk - --redo all / --force
 * @param {Set<string>} p.pending - Target keys pending from an unfinished redo
 * @param {boolean} p.fresh - --fresh / --no-tm (nothing is held back)
 * @param {object} p.pairConfig
 * @param {ReturnType<typeof createEditClassifier>} p.classify
 * @param {string} [p.fallbackPrefix]
 * @param {Set<string>|null} [p.redoGaps] - Target keys `--redo gaps` queued (lib/plural-gap-redo.js)
 * @returns {{ toProcess: string[], kept: string[], keptUnrecorded: string[], replacing: Array<{ key: string, value: string,
 *   why: 'source-changed'|'named', unrecorded: boolean }>, held: string[], heldFromPrimary: string[],
 *   pendingRetry: string[], forcedByRedo: Set<string> }}
 *   toProcess — what goes into the pipeline (the cache is consulted for all of it);
 *   kept — hand-edited values a bulk redo / pending retry leaves alone
 *     (keptUnrecorded: the ones with no written-record and no cache proof);
 *   replacing — hand-edited values this run replaces (printed and recorded);
 *   held — keys the pipeline must not send to the pair's method or its fallback;
 *   heldFromPrimary — keys only the fallback may be asked for;
 *   pendingRetry — pending keys retried now (sent to the model);
 *   pendingAll — every pending key (the cache is bypassed for all of them);
 *   forcedByRedo — keys this run queued by an explicit redo (pending if they fail)
 */
export function planQueue({
  diff, sourceFlat, targetFlat, lockKeyOf, localeState, named, bulk, pending, fresh, pairConfig, classify,
  fallbackPrefix = '[EN] ', redoGaps = null,
}) {
  const changed = new Set(diff.changed);
  const missing = new Set(diff.missing);
  const fallback = new Set(diff.needsTranslation);
  const echo = new Set(diff.untranslated);
  const forced = new Set(diff.forced);

  const out = {
    toProcess: [], kept: [], keptUnrecorded: [], replacing: [], held: [], heldFromPrimary: [], pendingRetry: [],
    pendingAll: [], forcedByRedo: new Set(),
  };

  for (const key of diff.toProcess) {
    const src = sourceFlat[key];
    const onDisk = targetFlat[key];
    const isNamed = named.has(key) && forced.has(key);
    // `--redo gaps` queues the plural messages left incomplete as a bulk
    // redo does: sent (never held back), a person's edit kept.
    const isBulk = (bulk || !!redoGaps?.has(key)) && forced.has(key);
    const isPending = !isNamed && !isBulk && pending.has(key);
    if (isNamed || isBulk) out.forcedByRedo.add(key);

    // ── A value a person wrote ────────────────────────────────────────
    const present = typeof onDisk === 'string' && onDisk.trim() !== '' && !missing.has(key)
      && !fallback.has(key) && !onDisk.startsWith(fallbackPrefix);
    if (present && typeof src === 'string') {
      const who = classify(lockKeyOf(key), key, onDisk, src, changed.has(key));
      if (who !== 'machine') {
        const onlyEcho = echo.has(key) && !changed.has(key) && !forced.has(key) && !pending.has(key);
        if (changed.has(key)) {
          out.replacing.push({ key, value: onDisk, why: 'source-changed', unrecorded: who === 'unknown' });
        } else if (isNamed) {
          out.replacing.push({ key, value: onDisk, why: 'named', unrecorded: who === 'unknown' });
        } else if (onlyEcho && who === 'unknown') {
          // An unstamped copy of the source with no record: the pre-populated
          // English this reason exists for (docusaurus write-translations,
          // a copied file). Translated, as before.
        } else {
          // A bulk redo, a pending retry — or a person who set the value
          // equal to the source on purpose: theirs to keep.
          out.kept.push(key);
          if (who === 'unknown') out.keptUnrecorded.push(key);
          continue;
        }
      }
    }

    // ── Refused before: hold back from the method that refused it ────
    let heldAll = false;
    if (!fresh && !isNamed && !isBulk && typeof src === 'string') {
      const record = localeState.refused[lockKeyOf(key)];
      const hold = holdState(record, src, pairConfig);
      const promisedRetry = isPending && record?.redo === true;
      if (hold !== 'send' && !promisedRetry) {
        if (hold === 'fallback-only') out.heldFromPrimary.push(key);
        else { out.held.push(key); heldAll = true; }
      }
    }

    if (isPending && !heldAll) out.pendingRetry.push(key);
    // Every pending key bypasses the cache, held back or not: the redo's
    // point was the current model's text, and model carry-over would serve
    // the old model's (silently "completing" the redo with the text it
    // set out to replace).
    if (isPending) out.pendingAll.push(key);
    out.toProcess.push(key);
  }
  return out;
}

/**
 * Append replaced hand edits to the project's record (tracked in git, next
 * to the lock — the .champollion/ cache folder is per machine and ignored).
 *
 * @param {string} cwd
 * @param {Array<object>} entries - { locale, file, key, editedValue, why, newSource }
 * @returns {string|null} The file's name, or null when nothing was written
 */
export function recordReplacedEdits(cwd, entries) {
  if (!entries || entries.length === 0) return null;
  const at = new Date().toISOString();
  const lines = entries.map(e => JSON.stringify({ at, ...e })).join('\n') + '\n';
  fs.appendFileSync(path.join(cwd, REPLACED_EDITS_FILENAME), lines, 'utf-8');
  return REPLACED_EDITS_FILENAME;
}

/**
 * How many replaced hand edits the project's record holds (status).
 *
 * @param {string} cwd
 * @returns {number}
 */
export function countReplacedEdits(cwd) {
  try {
    return fs.readFileSync(path.join(cwd, REPLACED_EDITS_FILENAME), 'utf-8').split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Per-locale health from the lock and the files: what `status`, `audit` and
 * `verify` report.
 *
 * @param {object} p
 * @param {object} p.layout - lib/locale-layout.js layout
 * @param {Array} p.units - loadSourceUnits(layout)
 * @param {string} p.inputLocale
 * @param {string} p.code - Target locale
 * @param {object} p.localeState - LockState.peek(code)
 * @param {object} p.manifest - The lock's source map
 * @param {object|null} p.tm - Loaded TM (proof for values with no record)
 * @param {object|null} p.pairConfig - The locale's pair (held-back check); null skips it
 * @param {object} p.helpers - { expectedForTarget, readLocaleFlat, lockKey, originKey, fallbackPrefix }
 * @returns {{ stale: string[], pending: Array<{ key: string, reason: string, held: boolean }>, held: string[] }}
 */
export function localeHealth({ layout, units, inputLocale, code, localeState, manifest, tm, pairConfig, helpers }) {
  const { expectedForTarget, readLocaleFlat, lockKey, originKey, fallbackPrefix = '[EN] ' } = helpers;
  const stale = [];
  const held = [];
  const pendingOut = [];
  const isHeld = (record, src) => !!pairConfig && holdState(record, src, pairConfig) === 'held';

  for (const unit of units) {
    let file;
    try { file = layout.fileFor(code, unit.ns); } catch { continue; }
    const { flat: expected, expansion } = expectedForTarget(unit, inputLocale, code);
    let target = {};
    if (file && fs.existsSync(file.path)) {
      try { target = readLocaleFlat(file) || {}; } catch { target = {}; }
    }
    for (const [key, src] of Object.entries(expected)) {
      if (typeof src !== 'string') continue;
      const lk = lockKey(layout, unit.ns, key);
      const value = target[key];
      const present = typeof value === 'string' && value.trim() !== '' && !value.startsWith(fallbackPrefix);
      if (present) {
        const record = decodeWritten(localeState.written[lk]);
        if (record) {
          if (record.source !== shortSourceHash(src)) stale.push(lk);
        } else {
          // No record (older lock): the source manifest — the hash of the
          // source the last successful sync translated — is the evidence,
          // unless the cache proves the value translates the current text.
          const srcKey = lockKey(layout, unit.ns, originKey(key, expansion));
          const sourceNow = unit.flat[originKey(key, expansion)];
          const old = manifest[srcKey];
          if (old && typeof sourceNow === 'string' && old !== hashValue(sourceNow)
              && !(tm && tmProofTextsFor(key, src, expansion).some(t => tmTranslationsOf(tm, t, code).has(value)))) {
            stale.push(lk);
          }
        }
      }
      const refusal = localeState.refused[lk];
      const keyHeld = isHeld(refusal, src);
      if (keyHeld && !localeState.pending[lk]) held.push(lk);
      if (localeState.pending[lk]) {
        pendingOut.push({ key: lk, reason: String(localeState.pending[lk]), held: keyHeld && refusal.redo !== true });
      }
    }
  }
  return { stale, pending: pendingOut, held };
}
