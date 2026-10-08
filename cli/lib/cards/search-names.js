/**
 * search-names.js — the names a language is FOUND by, for the bundled manifest.
 *
 * An npm install ships the full card for ~1,150 core languages only; every
 * other language is a manifest entry in shared/cards-fallback.json. That entry
 * used to carry the displayed name and code aliases and nothing else, so an
 * install could not find Innu (moe) by "Montagnais" — the alternate name
 * ISO 639-3 records — nor 1,543 languages by their endonyms nor 411 by the
 * name another registry gives them (Round 11). The repo corpus found them all.
 *
 * This module turns a card's recorded names into the manifest's compact
 * search-name list, and back:
 *
 *   - which names: every value of the `name` envelope (each registry's name),
 *     every value of the `endonym` envelope, and `alternateNames` (ISO 639-3's
 *     list) — read through the card adapter's `attributions()`, each with the
 *     source that records it;
 *   - deduplicated the way search compares names (`foldForSearch`, the same
 *     fold as the MCP server's normalizeForMatch): a name that folds to the
 *     displayed name or a code alias is dropped (search already finds it), and
 *     names that fold alike are kept once — the first spelling, cited to the
 *     sources that record exactly that spelling (never to a source that wrote
 *     it differently);
 *   - each name's sources kept compactly: `[text, ref, ref, …]`, where a ref
 *     indexes the bundle's `nameRefs` table of `[field, source]` pairs
 *     (three sources × three fields today — a source id is written once, not
 *     once per name).
 *
 * A search name is for FINDING a language. Anything a result shows from one
 * carries its field and source (decodeSearchNames returns both), so the
 * result can say how it matched and cite it.
 */

import { attributions, isAttributed } from './reader.js';

/** Card fields whose values are names a language is known by, in card order. */
export const SEARCH_NAME_FIELDS = Object.freeze(['name', 'endonym', 'alternateNames']);

/**
 * Fold a string the way language search compares names: Unicode-decompose,
 * drop combining marks, lowercase, collapse every run of non-letters/digits
 * to one space. "Èdè Yorùbá" → "ede yoruba"; "Ta'Izzi-Adeni" → "ta izzi adeni".
 * Must stay identical to normalizeForMatch in mcp-server/src/tools/languages.js
 * (a test there holds the two together).
 *
 * @param {unknown} s
 * @returns {string}
 */
export function foldForSearch(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A bare lowercase 2–3 letter string is a code, not a name ("Ata" is a name). */
const CODE_LIKE = /^[a-z]{2,3}$/;

/** The sources a card stamps on a flat field (`_fieldSources`). */
function stampedSources(card, field) {
  const v = card?._fieldSources?.[field];
  return (Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s);
}

/**
 * Every recorded name on a RAW card (before normalizeCard flattens `name`),
 * each with the field and source that record it.
 *
 * @param {object} raw  a card as stored (attribution envelopes intact)
 * @returns {Array<{text: string, field: string, source: string|null}>}
 */
export function searchNameClaims(raw) {
  const out = [];
  for (const field of SEARCH_NAME_FIELDS) {
    const value = raw?.[field];
    if (value === null || value === undefined) continue;
    // An envelope names each value's source; a flat value (alternateNames is
    // a plain list) carries the sources the card stamps on the field.
    const stamped = isAttributed(value) ? null : stampedSources(raw, field);
    for (const claim of attributions(value)) {
      const values = Array.isArray(claim?.value) ? claim.value : [claim?.value];
      const sources = stamped ?? [claim?.source];
      for (const v of values) {
        if (typeof v !== 'string' || !v.trim()) continue;
        const text = v.trim();
        if (field === 'alternateNames' && CODE_LIKE.test(text)) continue;
        for (const s of sources.length ? sources : [null]) {
          out.push({ text, field, source: typeof s === 'string' && s ? s : null });
        }
      }
    }
  }
  return out;
}

/**
 * The `nameRefs` table for a set of claims: every `[field, source]` pair that
 * occurs, sorted (so the bundle is deterministic), and the lookup that turns
 * a pair into its index.
 *
 * @param {Iterable<{field: string, source: string|null}>} claims
 * @returns {{ table: Array<[string, string|null]>, ref: (field: string, source: string|null) => number }}
 */
export function buildRefTable(claims) {
  const keys = new Set();
  for (const { field, source } of claims) keys.add(JSON.stringify([field, source ?? null]));
  const sorted = [...keys].sort();
  const index = new Map(sorted.map((k, i) => [k, i]));
  return {
    table: sorted.map((k) => JSON.parse(k)),
    ref: (field, source) => {
      const i = index.get(JSON.stringify([field, source ?? null]));
      if (i === undefined) throw new Error(`no name ref for [${field}, ${source}] — build the table from the same claims`);
      return i;
    },
  };
}

/**
 * The compact search-name list for one manifest entry.
 *
 * @param {Array<{text: string, field: string, source: string|null}>} claims
 *   from searchNameClaims()
 * @param {{ exclude?: string[], ref: (field: string, source: string|null) => number }} opts
 *   exclude: names search already reaches (the displayed name, code aliases)
 * @returns {Array<Array<string|number>>}  [[text, ref, …], …] — empty when
 *   the card records no name search would not already find
 */
export function encodeSearchNames(claims, { exclude = [], ref }) {
  const reached = new Set(exclude.map(foldForSearch).filter(Boolean));
  const byFold = new Map();
  for (const { text, field, source } of claims) {
    const key = foldForSearch(text);
    if (!key || reached.has(key)) continue;
    let entry = byFold.get(key);
    if (!entry) {
      entry = { text, refs: [] };
      byFold.set(key, entry);
    }
    // Cited only to the sources that record THIS spelling: a source that wrote
    // "kweyol" is not quoted as writing "Kwéyòl". The other spelling folds the
    // same, so search loses nothing by keeping one.
    if (text !== entry.text) continue;
    const r = ref(field, source);
    if (!entry.refs.includes(r)) entry.refs.push(r);
  }
  return [...byFold.values()].map((e) => [e.text, ...e.refs]);
}

/**
 * Read a manifest entry's search names back, each with its field and sources.
 *
 * @param {object} entry  a manifest entry ({ n, a, d, s })
 * @param {Array<[string, string|null]>} refs  the bundle's `nameRefs`
 * @returns {Array<{text: string, fields: Array<{field: string, sources: string[]}>}>}
 *   fields in first-cited order; an unknown ref is skipped, never guessed
 */
export function decodeSearchNames(entry, refs) {
  const out = [];
  for (const tuple of Array.isArray(entry?.s) ? entry.s : []) {
    if (!Array.isArray(tuple) || typeof tuple[0] !== 'string') continue;
    const fields = [];
    for (const r of tuple.slice(1)) {
      const pair = Array.isArray(refs) ? refs[r] : undefined;
      if (!Array.isArray(pair) || typeof pair[0] !== 'string') continue;
      let f = fields.find((x) => x.field === pair[0]);
      if (!f) {
        f = { field: pair[0], sources: [] };
        fields.push(f);
      }
      if (typeof pair[1] === 'string' && pair[1] && !f.sources.includes(pair[1])) f.sources.push(pair[1]);
    }
    if (fields.length) out.push({ text: tuple[0], fields });
  }
  return out;
}
