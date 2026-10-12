/**
 * plural-gap-redo.js — a plural message left incomplete is asked again by a
 * setup that has not tried it yet.
 *
 * THE FINDING (Round 13, Django persona): a local model left a Russian
 * plural entry without its few/many forms. Sync wrote the entry with the
 * "other" form standing in and marked it (`# champollion:` in a gettext
 * catalog; a missing ICU branch in JSON), and every later sync treated it as
 * done — including CI's, which runs a stronger hosted model. Every sync then
 * exited 2 until a person re-ran with a key or wrote the forms by hand, and
 * the CI workflow had no way to do either.
 *
 * THE RULE. A marked gap is not a translation. A sync asks for it again —
 * from the model, not the cache, which holds the incomplete answer — when it
 * runs a setup (method, model, register, coaching: the cache key) that has
 * not answered this message's current text yet:
 *   - the setup that wrote it is the one the lock records for the key
 *     (`by`), while the record still matches the value on disk (a person who
 *     edited the entry is never overruled);
 *   - the setups that answered it without the forms before are kept in the
 *     lock (`gaps`: source hash + method keys), so a local run and a CI run
 *     do not take turns paying for the same incomplete answer;
 *   - the pair's own fallback is part of the setup: a gap it left is not
 *     re-asked by the same configuration.
 * `--redo gaps` asks for every gap on disk, whoever left it (an explicit
 * redo). A setup that also leaves the forms out leaves the gap marked, as
 * before; the run exits 2.
 *
 * Shared by the sync and its cost estimate, so the estimate prices exactly
 * what is asked again.
 */

import { pluralGapsInFile } from './verify.js';
import { tmMethodKey } from './tm.js';
import { decodeWritten, shortSourceHash, valueHash } from './locale-state.js';

/**
 * The setups a gap record says answered this text without the forms.
 *
 * @param {object|undefined} record - LockState.of(code).gaps[lockKey]
 * @param {string} sourceValue
 * @returns {string[]}
 */
export function gapTriedBy(record, sourceValue) {
  if (!record || typeof record !== 'object' || typeof sourceValue !== 'string') return [];
  if (record.source !== shortSourceHash(sourceValue) || !Array.isArray(record.methods)) return [];
  return record.methods;
}

/**
 * Remember that `methodKey` answered this key's current text without a form
 * the language uses for ordinary counts.
 *
 * @param {object} localeState - LockState.of(code)
 * @param {string} lockKey
 * @param {string} sourceValue
 * @param {string} methodKey
 */
export function recordGap(localeState, lockKey, sourceValue, methodKey) {
  if (typeof sourceValue !== 'string' || !methodKey) return;
  localeState.gaps = localeState.gaps || {};
  const known = gapTriedBy(localeState.gaps[lockKey], sourceValue);
  localeState.gaps[lockKey] = { source: shortSourceHash(sourceValue), methods: [...new Set([...known, methodKey])] };
}

/**
 * Plural messages of one target file that this run asks for again.
 *
 * @param {object} p
 * @param {object} p.file - layout file ({ path, format, rel })
 * @param {object} p.expected - The target's expected map (source text per target key)
 * @param {object} p.targetFlat - Values on disk
 * @param {string} p.locale
 * @param {object} p.localeState - LockState.peek(code)
 * @param {(key: string) => string} p.lockKeyOf
 * @param {object} p.pairConfig
 * @param {boolean} [p.all] - `--redo gaps`: every gap on disk
 * @returns {{ keys: string[], gaps: Array<{ key: string, missing: string[], marked: boolean }>,
 *   by: Object<string, string|null>, missing: Object<string, string[]> }}
 *   keys — target keys to ask again; gaps — every gap in the file; by — the
 *   setup that left each asked key (null: no record); missing — its forms
 */
export function planGapRedo({ file, expected, targetFlat, locale, localeState, lockKeyOf, pairConfig, all = false }) {
  const out = { keys: [], gaps: [], by: {}, missing: {} };
  if (!file || !targetFlat) return out;
  try { out.gaps = pluralGapsInFile({ file, expected, targetFlat, locale }); } catch { out.gaps = []; }
  if (out.gaps.length === 0) return out;
  const current = tmMethodKey(pairConfig);
  const fallback = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
  for (const g of out.gaps) {
    const src = expected[g.key];
    const value = targetFlat[g.key];
    if (typeof src !== 'string' || typeof value !== 'string') continue;
    const lk = lockKeyOf(g.key);
    // Who wrote what is on disk — only while the record still describes it.
    const record = decodeWritten(localeState?.written?.[lk]);
    const writer = record && record.source === shortSourceHash(src) && record.value === valueHash(value)
      ? (localeState?.by?.[lk] || null) : null;
    if (!all) {
      if (!writer) continue;                                  // unknown, or a person's edit: never automatic
      if (writer === current || writer === fallback) continue; // this setup left it
      if (gapTriedBy(localeState?.gaps?.[lk], src).includes(current)) continue; // tried already
    }
    out.keys.push(g.key);
    out.by[g.key] = writer;
    out.missing[g.key] = g.missing;
  }
  return out;
}
