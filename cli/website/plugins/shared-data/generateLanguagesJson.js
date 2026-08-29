/**
 * Generates `data/languages.json` — the fully-resolved language card dataset.
 *
 * This is a build-time port of the resolution logic that used to live in
 * `src/utils/languageLoader.js` via webpack `require.context`. Bundling
 * ~8,000 JSON cards into webpack output added ~200 MB of JS to every locale
 * build; instead we resolve once here and the frontend fetches the result
 * at runtime from `/data/languages.json`.
 *
 * Resolution rules (identical to the old runtime loader):
 *   - Every top-level `*.json` in shared/language-cards/ is a concrete card.
 *   - `genera/*.json` are abstract genus/family cards, inherited via the
 *     card's `extends` field (recursively, e.g. crk → genus-cree →
 *     family-algonquian) using a deep merge where the child wins.
 *   - Output is sorted alphabetically by English name (localeCompare).
 */

const path = require('path');
const fs = require('fs-extra');

// ── The website is the FIFTH consumer, and the one users see ────────────────
// The CLI, arena, forge and mcp each normalise atlas-shaped cards at their one
// load site. This plugin read them RAW, which after cutover meant `name` was an
// attribution envelope and `nativeName` did not exist — every language would
// have rendered `[object Object]` with a blank endonym, across 8,686 pages,
// and Docusaurus's own gate would not have noticed because it only counts
// files. Same adapter, same rules: absent stays absent, disagreement is not
// silently resolved except where identity demands a label.
//
// Inlined rather than imported from cli/lib/cards/reader.js because this file
// runs inside Docusaurus's CommonJS plugin loader and that module is ESM. The
// parity test in cli/test/website-card-adapter.test.js holds the two together.
function displayValue(v, {firstOnDispute = false} = {}) {
  if (v && typeof v === 'object' && typeof v.agreement === 'string' && Array.isArray(v.values)) {
    if ('consensus' in v) return v.consensus;
    return firstOnDispute ? v.values[0]?.value : undefined;
  }
  return v;
}

/**
 * The SHARED card adapter, plus the flattening only a display layer needs.
 *
 * This file used to carry its own copy of normalizeCard — a second adapter,
 * which drifted from the first exactly as you would expect. The shared one
 * grew `vitality` (bridged from the cited endangerment scales) and turned the
 * speakerEstimates envelope back into the array this site renders; the copy
 * here did neither, so the public catalogue published a null endangerment on
 * every entry and the "sources differ, all shown" block vanished from every
 * page. Nine readers, one shape: the copy is gone.
 *
 * Loaded with a dynamic import because the Docusaurus plugin loader is
 * CommonJS and the reader is ESM. Cached, since this runs once per card.
 */
let _sharedReader = null;
async function sharedReader() {
  if (!_sharedReader) {
    _sharedReader = await import('../../../lib/cards/reader.js');
  }
  return _sharedReader;
}

async function adaptCard(card) {
  if (!card || typeof card !== 'object') return card;
  const {normalizeCard: shared} = await sharedReader();
  const out = shared(card);

  // Carry PROVENANCE across the renames the shared adapter performs. The
  // site's cite-only filter drops any field with no source — correctly — so a
  // renamed field that left its citation behind would be silently deleted from
  // every page. The shared reader is a runtime adapter and has no reason to
  // know about that filter; this layer does.
  const carry = (from, to) => {
    if (out[to] !== undefined && out._fieldSources?.[from] && !out._fieldSources[to]) {
      out._fieldSources[to] = out._fieldSources[from];
    }
  };
  carry('endonym', 'nativeName');
  carry('codeAliases', 'aliases');
  carry('textDirection', 'dir');
  carry('isoLanguageType', 'isoType');

  // `isoScope` reaches this layer as the registry's letter, because every
  // consumer here tests it that way (`=== 'M'` for a macrolanguage hub).
  if (typeof out.isoScope === 'string' && out.isoScope.length > 1) {
    out.isoScope = out.isoScope.charAt(0).toUpperCase();
  }

  // Any envelope still standing would reach a page as "[object Object]".
  // Flatten the agreed ones; leave a genuine dispute undefined rather than
  // pick a winner among sources. speakerEstimates is NOT here — the shared
  // reader already turned it into the array of cited claims this site renders,
  // which is the whole point of showing that sources differ.
  //
  // RECURSIVE, deliberately: envelopes live at leaves inside nested objects
  // too — classification.family is the big one (7,812 cards). The top-level
  // sweep alone never saw it, and the miss was masked for a whole release by
  // the provenance filter deleting `classification` outright: fix the filter,
  // and the envelope walks straight onto every page.
  const flatten = (node, depth = 0) => {
    if (depth > 6 || node === null || typeof node !== 'object') return node;
    if (typeof node.agreement === 'string' && Array.isArray(node.values)) {
      return displayValue(node);
    }
    if (Array.isArray(node)) return node.map((x) => flatten(x, depth + 1));
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) continue;
      const flat = flatten(v, depth + 1);
      if (flat === undefined) delete node[k];
      else node[k] = flat;
    }
    return node;
  };
  for (const [k, v] of Object.entries(out)) {
    if (k.startsWith('_') || k === 'speakerEstimates') continue;
    const flat = flatten(v);
    if (flat === undefined) delete out[k];
    else out[k] = flat;
  }
  return out;
}

function deepMerge(parent, child) {
  if (!parent) return child || {};
  if (!child) return parent || {};

  const result = {...parent};
  for (const [key, value] of Object.entries(child)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      parent[key] &&
      typeof parent[key] === 'object' &&
      !Array.isArray(parent[key])
    ) {
      result[key] = deepMerge(parent[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function readJsonFilesIn(dir) {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => path.join(dir, e.name));
  const cards = [];
  for (const file of files) {
    try {
      cards.push(await adaptCard(await fs.readJson(file)));
    } catch (e) {
      console.warn(`[shared-data] Failed to parse ${file}: ${e.message}`);
    }
  }
  return cards;
}

/**
 * Returns true when `outFile` is up to date relative to every source file.
 * Avoids regenerating ~80 MB of JSON for each of the 13 locale builds.
 */
async function isFresh({cardsDir, generaDir, outFile}) {
  if (!(await fs.pathExists(outFile))) return false;
  const outMtime = (await fs.stat(outFile)).mtimeMs;
  for (const dir of [cardsDir, generaDir]) {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue;
      const {mtimeMs} = await fs.stat(path.join(dir, e.name));
      if (mtimeMs > outMtime) return false;
    }
  }
  return true;
}

// ── Cite-only DISPLAY filter ─────────────────────────────────────────────
// Champollion is an INDEX, not an authority: the website may display a language
// fact ONLY if it traces to an external authority or a labeled deterministic
// derivation (text-direction from script, macroarea from coordinates, …). A
// value we asserted ourselves (`manual-curation` / `champollion-derived`) or one
// with no source is removed from THIS display copy. The SSOT cards
// (cli/shared/language-cards) keep the full data — the CLI runtime needs some of
// it (formality, aliases, plural categories) — so we strip the projection, never
// the source. Deterministic-derivation fields (dir/macroarea/scripts/
// scriptUnicodeName/orthographicStatus) and identity (name/script) are never in
// the checked set, so they are always kept.
const DISPLAY_FACT_FIELDS = new Set([
  'nativeName', 'alternateNames', 'aliases', 'glottocode', 'classification', 'isIsolate',
  'coordinates', 'countries', 'regions', 'arealContext', 'speakerEstimates', 'vitality',
  'dialectCount', 'formality', 'registers', 'gender', 'codeSwitching', 'linguisticChallenges',
  'contactInfluences', 'rules', 'typologicalProfile', 'phonologicalInventory', 'encyclopedic',
  'culturalAphorism', 'varieties', 'numeralSystem', 'colexificationProfile',
  'firstDocumented', 'lastDocumented', 'documentationDepth', 'digitalPresence',
]);
const __srcList = (e) =>
  e == null ? [] : typeof e === 'string' ? [e] : Array.isArray(e) ? e.flatMap(__srcList) : Object.values(e).flatMap(__srcList);
// A source value may be a COMBINED string ("manual-curation+segbo-2020+afbo-2024")
// — split it so a field that cites real authorities alongside curation still
// counts as authority-backed (don't over-strip authority-backed combined fields).
const __parts = (s) => String(s).split(/[+]/).map((p) => p.trim()).filter(Boolean);
const __isInternalPart = (p) =>
  /^(champollion-derived|manual-curation|template-generated|estimate|not-populated|cleanup|api-verification|derived-from-card-data|sync-eval)/i.test(p);
// The derived family, aligned with the card-integrity rules' R6 stamp regex
// (^(champollion-)?derived([:-]|$)): `champollion-derived-v1` is the atlas's
// own stamp for deterministic derivations from cited data (PHOIBLE medians,
// coordinate walks). This detector once accepted only the `derived:`/
// `derived-from-` spellings, so the linter blessed a stamp the display filter
// then stripped — phonologicalInventory vanished from every page while R6
// stayed green.
const __isDerivedFromCited = (s) =>
  /^(champollion-)?derived([:\-]|$)/i.test(String(s)) || /derived-from-|derived:/i.test(String(s));

/** AUTHORITY (cites a real source) | DERIVED (deterministic from cited data) | CURATED | UNSOURCED */
function classifyProvenance(fsEntry) {
  const ss = __srcList(fsEntry);
  if (!ss.length) return 'UNSOURCED';
  const parts = ss.flatMap(__parts);
  if (parts.some((p) => !__isInternalPart(p) && !__isDerivedFromCited(p))) return 'AUTHORITY';
  if (parts.some(__isDerivedFromCited)) return 'DERIVED';
  return 'CURATED';
}

function stripUnsourcedForDisplay(card) {
  const fsrc = card._fieldSources || {};
  const out = {...card};
  for (const key of Object.keys(out)) {
    if (key.startsWith('_') || !DISPLAY_FACT_FIELDS.has(key)) continue;
    const v = out[key];
    const has = v != null && !(Array.isArray(v) && !v.length) &&
      !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (!has) continue;
    // Provenance can live in _fieldSources[key], in _fieldSources under the
    // field's DOTTED sub-keys (the atlas stamps per-leaf: classification.family,
    // coordinates.lat, phonologicalInventory.consonants — there is often no
    // flat entry at all), OR inside the object itself (e.g. gender.source =
    // "wals-44A"). Consider all three. Missing the dotted form silently
    // deleted classification, phonology, coordinates and typology from every
    // page payload after the cutover — four fact families gone, no error,
    // which is exactly the silent-zero class this file's own comments warn
    // about.
    const dotted = Object.keys(fsrc)
      .filter((k) => k.startsWith(`${key}.`))
      .map((k) => fsrc[k]);
    const inObjSource = (v && typeof v === 'object' && !Array.isArray(v) && typeof v.source === 'string') ? v.source : null;
    const cls = classifyProvenance([fsrc[key], ...dotted, inObjSource].filter((x) => x != null));
    if (cls === 'CURATED' || cls === 'UNSOURCED') delete out[key]; // not displayed (kept in SSOT)
  }
  return out;
}

// The atlas release this plugin was written against. THE one pinned
// requireAtlas() consumer, deliberately: this file carries an inlined CJS
// envelope handler (displayValue) that is exactly the thing that drifts when
// the corpus is rebuilt, and its output is regenerated per release — so
// bumping this pin is part of the release act, alongside the shadow diff.
// The runtime loaders (registers.js, language_cards.py, the MCP server) stay
// UNpinned on purpose: they read through the living adapter, and a hard pin
// there would break every install on every data refresh. The corpus-wide
// uniformity lint covers the drift they actually risk.
const EXPECTED_ATLAS = '2026.9.0';

async function generateLanguagesJson({cardsDir, outFile}) {
  const generaDir = path.join(cardsDir, 'genera');

  if (await isFresh({cardsDir, generaDir, outFile})) {
    return;
  }

  console.log('[shared-data] Generating languages.json from', cardsDir);

  {
    // Refuse to build the site's language dataset from a corpus this plugin
    // was not written against. Old-shape cards (no _atlas stamp) pass — the
    // migration-window contract — but a STAMPED corpus must be the pinned
    // release.
    const {requireAtlas} = await sharedReader();
    const sample = (await fs.readdir(cardsDir))
      .find((f) => f.endsWith('.json') && f !== 'language-tree.json');
    if (sample) {
      const card = await fs.readJson(path.join(cardsDir, sample));
      if (card?._atlas) requireAtlas(card, EXPECTED_ATLAS);
    }
  }

  // 1. Load genus/family abstract cards (inheritance parents)
  const parentCards = new Map();
  for (const card of await readJsonFilesIn(generaDir)) {
    if (card.code) parentCards.set(card.code, card);
  }

  // 2. Recursively resolve `extends` chains
  const resolveCard = (card) => {
    let resolved = {...card};
    if (card.extends) {
      const parent = parentCards.get(card.extends);
      if (parent) {
        const resolvedParent = resolveCard(parent);
        resolved = deepMerge(resolvedParent, card);
      } else {
        console.warn(
          `[shared-data] Card '${card.code}' extends unknown parent '${card.extends}'`,
        );
      }
    }
    return resolved;
  };

  // 3. Load and resolve all concrete language cards (top-level only).
  // The cards directory also holds reference data files that are not cards
  // (e.g. language-tree.json, the Glottolog classification tree, which has
  // only a `_meta` key) — anything without a `code` is not a card.
  const allJson = await readJsonFilesIn(cardsDir);
  const withCode = allJson.filter((card) => typeof card.code === 'string' && card.code);
  if (withCode.length !== allJson.length) {
    console.log(
      `[shared-data] Skipped ${allJson.length - withCode.length} non-card JSON file(s) (no 'code' field)`,
    );
  }

  // THE SITE INDEXES LANGUAGES. A LOCALE IS NOT ONE.
  //
  // The corpus also holds 8,675 locale cards — `fra-CA` is French projected
  // onto Canada, carrying French's facts and French's name. Passing them
  // through made languages.json 17,360 entries, and since it is the single
  // input to lang-index, the catalogue, the channel and the wall, every one of
  // those surfaces listed each language once per territory it is spoken in.
  //
  // Locales matter — they are real translation targets and the CLI resolves
  // them — they are just not rows in a language atlas. If the site ever wants
  // locale pages, that is an addition to make deliberately, not a side effect
  // of reading a directory.
  const cardJson = withCode.filter((card) => !card.locale?.language);
  const localeCount = withCode.length - cardJson.length;
  if (localeCount) {
    console.log(`[shared-data] Excluded ${localeCount} locale card(s) — `
      + 'a locale is a projection of its language, not a separate one');
  }
  const resolved = cardJson.map(resolveCard).map(stripUnsourcedForDisplay);

  // 4. Sort alphabetically by English name
  resolved.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  await fs.ensureDir(path.dirname(outFile));
  await fs.writeJson(outFile, resolved);
  console.log(`[shared-data] Wrote ${resolved.length} resolved cards to ${outFile}`);
}

// adaptCard/displayValue are exported for cli/test/website-card-adapter.test.js
// — the parity test the header comment promises, holding this file's inline
// envelope handling to the shared reader's semantics.
// stripUnsourcedForDisplay is exported for website-languages-data.test.js —
// the filter that once silently deleted four fact families from every page.
module.exports = {
  generateLanguagesJson, deepMerge, adaptCard, displayValue,
  stripUnsourcedForDisplay,
};
