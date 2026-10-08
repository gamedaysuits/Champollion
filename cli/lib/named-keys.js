/**
 * named-keys.js — keys named for a redo (`--redo keys:` / `--force-keys`)
 * must exist. ONE rule for every sync path (key-value files, Docusaurus UI
 * strings), so the two cannot drift apart.
 *
 * A name that matched nothing used to do nothing in silence ("fully synced
 * … 0 keys", exit 0 — in CI exactly a success), so a typo or a gettext msgid
 * that only exists WITH a context looked like a finished repair (Round 7,
 * Django persona). Now:
 *   - no name matches: the run stops before anything is translated or sent
 *     (exit 1), naming the closest keys that exist;
 *   - some names match: those are redone, then the run fails (exit 1)
 *     naming the rest — said again at the very end, where CI looks.
 *
 * Each lane says what its key space is (`known`) — the key-value lane adds
 * the plural forms a target gets and the namespace prefix; the Docusaurus
 * lane collects every source JSON file's message ids.
 */

import { fromTypedContext } from './locale-layout.js';
import { splitKeyList } from './redo.js';
import { output } from './output.js';
import { estimateCost } from './pairs.js';
import { costLabel } from './cost-label.js';
import { editDistance } from './edit-distance.js';

/** A key as a person reads and types it: the gettext context separator as ␄. */
export const shownKey = (k) => String(k).replace(/\u0004/g, '\u2404');

/** "`button␄Cancel` (or type button\x04Cancel)" — both spellings, for a key with a context. */
function bothSpellings(k) {
  const shown = shownKey(k);
  return /\u0004/.test(k) ? `\`${shown}\` (or type \`${String(k).replace(/\u0004/g, '\\x04')}\`)` : `\`${shown}\``;
}

/**
 * Which of the names match a key in `known`, and — for each that does not —
 * the closest keys that do: every context variant of a gettext msgid
 * (`button␄Cancel`, `status␄Cancel` for "Cancel"), the same key in another
 * case, near spellings.
 *
 * @param {string[]} names - As typed (␄ or \x04 for a gettext context)
 * @param {Set<string>} known - Every key a name may match, in the lane's key space
 * @param {object} [opts]
 * @param {(k: string) => string} [opts.bare] - A key without its namespace
 *   prefix (key-value layouts with several files); identity otherwise
 * @param {boolean} [opts.bareMatches] - A name with no namespace names that
 *   key in every file that has it
 * @returns {{ matched: string[], missed: Array<{ name: string, closest: string[] }> }}
 */
export function checkNamedKeys(names, known, { bare = (k) => k, bareMatches = false } = {}) {
  // A name with no namespace of its own (bare(name) === name) names that key
  // in every file that has it.
  const matches = (name) => known.has(name)
    || (bareMatches && bare(name) === name && [...known].some(k => bare(k) === name));
  const matched = [];
  const missed = [];
  for (const raw of names) {
    const name = fromTypedContext(raw);
    if (matches(name)) { matched.push(raw); continue; }
    const want = bare(name);
    const msgid = want.includes('\u0004') ? want.slice(want.indexOf('\u0004') + 1) : want;
    const lower = want.toLowerCase();
    const max = Math.max(2, Math.floor(want.length / 5));
    const scored = [];
    for (const k of known) {
      const kb = bare(k);
      const kMsgid = kb.includes('\u0004') ? kb.slice(kb.indexOf('\u0004') + 1) : kb;
      let score = null;
      if (kMsgid === msgid) score = 0; // the same msgid, with (another) context
      else if (kb.toLowerCase() === lower || kMsgid.toLowerCase() === msgid.toLowerCase()) score = 1;
      else {
        const d = editDistance(kb.toLowerCase(), lower, max);
        if (d <= max) score = 1 + d;
      }
      if (score !== null) scored.push([score, k]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    missed.push({ name: raw, closest: scored.slice(0, 8).map(([, k]) => k) });
  }
  return { matched, missed };
}

/** The error lines for named keys that matched nothing. */
export function describeUnmatchedKeys(missed, { flag }) {
  const lines = missed.map(({ name, closest }) => `${flag} names "${shownKey(fromTypedContext(name))}", which matches no key in the source files`
    + (closest.length > 0 ? ` — closest: ${closest.map(bothSpellings).join(', ')}` : ' (and nothing close to it)') + '.');
  if (missed.some(m => m.closest.some(k => k.includes('\u0004')))) {
    lines.push('A gettext entry with a context is named msgctxt␄msgid; type the ␄ as \\x04 if you cannot (both spellings work).');
  }
  return lines;
}

/** How the run's named keys were given, for its messages. */
export function namedKeyFlag(cliArgs) {
  return cliArgs.redo !== undefined ? '--redo keys:' : '--force-keys';
}

/**
 * The rule, applied before any work. With no name matching it throws (the
 * run exits 1, nothing translated or sent). With some matching, it prints
 * the misses, narrows `cliArgs['force-keys']` and `config.forceKeys` to the
 * names that exist, and returns the misses — the caller reports them again
 * at the end (reportUnmatchedKeys) and the run exits 1.
 *
 * @param {object} p
 * @param {object} p.cliArgs - Parsed CLI args (mutated: force-keys narrowed)
 * @param {object} p.config - Resolved config (mutated: forceKeys narrowed)
 * @param {Set<string>|(() => Set<string>)} p.known - The lane's key space (lazy: built only when keys are named)
 * @param {(k: string) => string} [p.bare]
 * @param {boolean} [p.bareMatches]
 * @returns {Array<{ name: string, closest: string[] }>} The names that matched nothing
 */
export function applyNamedKeyRule({ cliArgs, config, known, bare, bareMatches = false }) {
  const named = splitKeyList(cliArgs['force-keys'] || '');
  if (named.length === 0) return [];
  const keys = typeof known === 'function' ? known() : known;
  const { matched, missed } = checkNamedKeys(named, keys, { bare, bareMatches });
  if (missed.length === 0) return [];
  const lines = describeUnmatchedKeys(missed, { flag: namedKeyFlag(cliArgs) });
  if (matched.length === 0) {
    throw new Error(`${lines.join('\n')}\nNothing was translated or sent.`);
  }
  for (const l of lines) output.error(l);
  output.error(`Redoing the ${matched.length} named key(s) that exist; the run then fails (exit 1) for the ${missed.length} that do not.`);
  cliArgs['force-keys'] = matched.map(k => k.replace(/,/g, '\\,')).join(',');
  // --redo all / --force re-queues every key anyway; the narrowed names only
  // decide what a named redo replaces.
  config.forceKeys = cliArgs.force ? config.forceKeys : splitKeyList(cliArgs['force-keys']);
  return missed;
}

/** Said again at the end of the run, where a reader (or CI) looks for the verdict. */
export function reportUnmatchedKeys(missed, cliArgs) {
  if (!missed || missed.length === 0) return;
  for (const l of describeUnmatchedKeys(missed, { flag: namedKeyFlag(cliArgs) })) output.error(l);
}

/** The --json summary's `unmatchedKeys`: each name with the closest keys that exist. */
export function unmatchedKeysSummary(missed) {
  return (missed || []).map(m => ({ name: m.name, closest: m.closest.map(shownKey) }));
}

/**
 * Keys NAMED for a redo that the cache answered: the model was not asked, and
 * a redo without --fresh said nothing about it — the persona's `--redo
 * keys:<k>` wrote back the text it already had (Round 7, Django). Said, with
 * the --fresh command and what it costs — by every key lane (key-value files,
 * Docusaurus UI strings), in the same words.
 *
 * @param {object} p
 * @param {string} p.filename - The file as the run names it
 * @param {string[]} p.keys - The named keys the cache served
 * @param {string[]} [p.shown] - The same keys as a person names them (default: keys)
 * @param {object} [p.served] - key → the text the cache served
 * @param {object} [p.onDisk] - key → the text the file held before the run
 * @param {object} p.pairConfig
 * @param {string|null} [p.cwd]
 * @param {boolean} [p.dryRun]
 * @param {string} p.command - The `--redo keys: … --fresh` command that asks the model again
 */
export async function reportNamedFromCache({ filename, keys, shown = keys, served = {}, onDisk = {}, pairConfig, cwd = null, dryRun = false, command }) {
  if (keys.length === 0) return;
  const same = keys.filter(k => typeof served[k] === 'string' && served[k] === onDisk[k]);
  let price = 'cost unknown';
  try { price = costLabel(await estimateCost(keys.length, pairConfig, { cwd })); } catch { /* unknown */ }
  const sample = `${shown.slice(0, 3).join(', ')}${shown.length > 3 ? `, +${shown.length - 3} more` : ''}`;
  output.info(`${filename} — ${keys.length} key(s) named for a redo ${dryRun ? 'would be' : 'were'} served from the cache, `
    + `not asked again (${sample})${same.length === keys.length ? ' — the file already holds that text' : ''}: `
    + 'a redo re-checks and re-writes what the cache holds, at no cost. To ask the model again: '
    + `\`${command}\` (sends ${keys.length} key(s) — ${price}).`);
}
