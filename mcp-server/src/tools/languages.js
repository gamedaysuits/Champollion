/**
 * Language tools — search and browse Champollion language cards.
 *
 * Card data comes from ONE of three sources, tried in order:
 *   1. CHAMPOLLION_CARDS_DIR — explicit override (same variable the CLI and
 *      the Python harness honor). Set-but-unusable is an immediate error:
 *      the user pointed somewhere specific, and silently reading a different
 *      corpus would be worse than failing.
 *   2. The monorepo checkout's cli/shared/language-cards/ (full corpus).
 *   3. The champollion package's bundled shared/cards-fallback.json — the
 *      same bundle the published CLI runs on: 1,157 full cards plus a
 *      manifest of every concrete code → name/aliases and, for a language
 *      without a bundled card, every other name its card records (other
 *      registries' names, endonyms, ISO 639-3 alternate names, each with its
 *      source) — so the FULL catalogue is searchable by any recorded name
 *      offline, with rich fields on the core set and honest absences
 *      elsewhere.
 *
 * NOTHING is hardcoded and nothing degrades silently. This file used to
 * carry a hand-written 40-language FALLBACK_INDEX served with only a stderr
 * note — an agent outside the repo was told "No languages found" for ~7,887
 * real languages, indistinguishable from an authoritative answer (and the
 * published install crashed before even reaching it, because the adapter
 * import was a static repo-relative path). When no source resolves, the
 * server now REFUSES TO START, listing every path tried and the fix — the
 * same posture as translate.js's "refusing to start with an empty or
 * hand-guessed method surface". With `champollion` a real dependency, a
 * missing card surface always means a broken install, never a legitimate
 * degraded mode.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { count } from './plural.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// Monorepo layout: mcp-server/src/tools/ → repo root is three up.
const REPO_CLI = resolve(__dirname, '../../../cli');

/**
 * Resolve the ONE card adapter (cli/lib/cards/reader.js), monorepo checkout
 * first so development never resolves a stale registry install, then the
 * `champollion` dependency for published installs. A ninth private reader is
 * how this server came to serve "[object Object]" — the adapter is not
 * optional, so failing to find it is a startup error, not a fallback.
 *
 * @returns {Promise<{reader: object, packageRoot: string, source: string}>}
 */
async function resolveAdapter() {
  const attempts = [];

  const repoReader = resolve(REPO_CLI, 'lib/cards/reader.js');
  if (existsSync(repoReader)) {
    const reader = await import(pathToFileURL(repoReader).href);
    const scripts = await loadScriptConverters(REPO_CLI);
    return { reader, scripts, packageRoot: REPO_CLI, source: 'monorepo checkout' };
  }
  attempts.push(`${repoReader} (monorepo checkout — not present)`);

  let resolved = null;
  try {
    const entry = require.resolve('champollion');
    const reader = await import('champollion');
    resolved = { reader, packageRoot: dirname(entry), source: 'champollion package' };
  } catch (err) {
    attempts.push(`champollion package (${err.code ?? err.message})`);
  }
  if (resolved) {
    return { ...resolved, scripts: await loadScriptConverters(resolved.packageRoot) };
  }

  throw new Error(
    'Cannot resolve the champollion card adapter — refusing to start with no '
    + 'card surface. Tried:\n'
    + attempts.map((a) => `  - ${a}`).join('\n')
    + '\nFix: run inside the Champollion monorepo, or `npm install` in the '
    + 'MCP server directory so the `champollion` dependency is present.',
  );
}

/**
 * The CLI's script-converter registry (cli/lib/scripts.js), from the same
 * package the card adapter came from. It is what lets "nêhiyawêwin" find
 * Plains Cree, whose card records its endonym only in Cree Syllabics
 * (ᓀᐦᐃᔭᐍᐏᐣ): the search also matches the working-script form a registered
 * converter reads that name as — and says it is champollion's derivation.
 *
 * Imported by file path because the package's `exports` map only exposes
 * index.js, which re-exports the forward converter but not the registry or
 * the reverse. The file ships in the package (`files: lib/`), and in a
 * published install index.js already imports it — so a failure here is a
 * broken install, and the server refuses to start rather than search with a
 * name surface it silently lost.
 *
 * @param {string} packageRoot
 * @returns {Promise<{SCRIPT_CONVERTERS: object, converterKeyForLocale: Function, reverseScript: Function}>}
 */
async function loadScriptConverters(packageRoot) {
  const file = resolve(packageRoot, 'lib', 'scripts.js');
  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (err) {
    throw new Error(
      `Cannot load champollion's script converters from ${file} (${err.code ?? err.message}) — `
      + 'refusing to start: the language search matches names across scripts through them. '
      + 'Fix: reinstall so the champollion dependency ships intact.',
    );
  }
  const { SCRIPT_CONVERTERS, converterKeyForLocale, reverseScript } = mod;
  if (!SCRIPT_CONVERTERS || typeof SCRIPT_CONVERTERS !== 'object'
      || typeof converterKeyForLocale !== 'function' || typeof reverseScript !== 'function') {
    throw new Error(
      `${file} does not export SCRIPT_CONVERTERS, converterKeyForLocale and reverseScript — `
      + 'a champollion package this server cannot read names across scripts with. Refusing to start.',
    );
  }
  return { SCRIPT_CONVERTERS, converterKeyForLocale, reverseScript };
}

/**
 * The adapter functions an index entry is built with. `attributions` and
 * `isAttributed` are what keep a disputed field disputed on a result line.
 */
function adapterContext(reader) {
  const { normalizeCard, display, isDisputed, attributions, isAttributed } = reader;
  return { normalizeCard, display, isDisputed, attributions, isAttributed };
}

// ---------------------------------------------------------------------------
// Where a language is spoken — the facts that tell same-named languages apart
// ---------------------------------------------------------------------------

/** At most this many countries / alternate names on one search line. */
const COUNTRY_CAP = 4;
const ALT_NAME_CAP = 4;

/**
 * The sources a card stamps on one or more dotted field paths — the
 * `_fieldSources` stamp, or a `source` the value itself carries (the older
 * `coordinates: {lat, lng, source}` shape). A stamp the card has is always
 * used; "not stated" is only ever said of a card that states none.
 */
function stampedSources(card, paths) {
  const fs = card?._fieldSources;
  const out = [];
  const add = (s) => { if (typeof s === 'string' && s && !out.includes(s)) out.push(s); };
  if (fs && typeof fs === 'object') {
    for (const p of paths) {
      const v = fs[p];
      for (const s of (Array.isArray(v) ? v : [v])) add(s);
    }
  }
  if (!out.length) {
    for (const p of paths) {
      const v = p.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), card);
      if (v && typeof v === 'object' && !Array.isArray(v)) add(v.source);
    }
  }
  return out;
}

/**
 * Every claim of a card field as [{value, sources}], through the adapter: an
 * attribution envelope yields one claim per source (a dispute stays a
 * dispute — nothing is elected), a flat value yields one claim carrying the
 * sources the card stamps on it in `_fieldSources`.
 */
function claimsFor(card, field, paths, { attributions, isAttributed }) {
  const v = card?.[field];
  if (v === null || v === undefined || v === '') return [];
  if (isAttributed?.(v)) {
    return attributions(v)
      .filter((c) => c?.value !== null && c?.value !== undefined && c?.value !== '')
      .map((c) => ({ value: c.value, sources: c.source ? [c.source] : [] }));
  }
  return [{ value: v, sources: stampedSources(card, paths) }];
}

let _regionNames;
/**
 * "Philippines (PH)" for a country code. The cards carry ISO 3166-1 codes;
 * the English name is the runtime's own CLDR label for that code (the same
 * Intl.DisplayNames the website's language panel uses) — a presentation of
 * the cited code, never a new claim. Unknown codes stay bare codes.
 */
function countryLabel(code) {
  if (_regionNames === undefined) {
    try {
      _regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      _regionNames = null;
    }
  }
  let name = null;
  try {
    name = _regionNames?.of(code.toUpperCase()) ?? null;
  } catch {
    name = null;
  }
  return name && name.toUpperCase() !== code.toUpperCase() ? `${name} (${code})` : code;
}

/** "15.41°N 120.20°E" — or null when the point is not two real numbers. */
function formatPoint(p) {
  const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));
  const lat = num(p?.lat ?? p?.latitude);
  const lng = num(p?.lng ?? p?.lon ?? p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} `
    + `${Math.abs(lng).toFixed(2)}°${lng < 0 ? 'W' : 'E'}`;
}

/**
 * Where the card says a language is spoken: countries, Glottolog's point,
 * macroarea — each as {text, sources}. Six Ayta languages tie at the same
 * edit distance for "Atya"; their names alone do not say which community is
 * which, but their points do (Sorsogon Ayta sits ~4° east of the Zambales
 * ones).
 *
 * @returns {{facts: Array<{text: string, sources: string[]}>, disputed: boolean}}
 */
function locationOf(card, ctx) {
  const facts = [];
  for (const c of claimsFor(card, 'countries', ['countries'], ctx)) {
    const codes = (Array.isArray(c.value) ? c.value : [c.value])
      .map((x) => (typeof x === 'string' ? x : x?.code ?? x?.country))
      .filter((x) => typeof x === 'string' && x.trim());
    const shown = codes.slice(0, COUNTRY_CAP).map(countryLabel);
    if (codes.length > COUNTRY_CAP) shown.push(`+${codes.length - COUNTRY_CAP} more countries`);
    if (shown.length) facts.push({ text: shown.join(', '), sources: c.sources });
  }
  for (const c of claimsFor(card, 'coordinates', ['coordinates', 'coordinates.lat', 'coordinates.lng'], ctx)) {
    const point = formatPoint(c.value);
    if (point) facts.push({ text: point, sources: c.sources });
  }
  for (const c of claimsFor(card, 'macroarea', ['macroarea'], ctx)) {
    if (typeof c.value === 'string' && c.value.trim()) {
      facts.push({ text: `macroarea ${c.value}`, sources: c.sources });
    }
  }
  const disputed = ['countries', 'coordinates', 'macroarea']
    .some((f) => Boolean(ctx.isDisputed?.(card?.[f])));
  return { facts, disputed };
}

/** A Glottolog languoid identifier: four letters/digits, then four digits. */
const GLOTTOCODE_RE = /^[a-z0-9]{4}[0-9]{4}$/;

/**
 * The address of a language's record at Glottolog, from the glottocode its
 * card carries — or null when the card carries none (or something that is
 * not a glottocode). A glottocode is Glottolog's own identifier, so the link
 * is a pointer to the source, not a claim about the language: what that
 * record says, Glottolog says. Round 11 (hospital persona): six Ayta
 * candidates whose locations could not be cited had nothing else to be told
 * apart by.
 *
 * @param {unknown} glottocode
 * @returns {string|null}
 */
export function glottologRecordUrl(glottocode) {
  return typeof glottocode === 'string' && GLOTTOCODE_RE.test(glottocode)
    ? `https://glottolog.org/resource/languoid/id/${glottocode}`
    : null;
}

/** The glottocode a card carries (a plain string, or an envelope's agreed value). */
function glottocodeOf(card, { display, isAttributed } = {}) {
  const v = card?.glottocode;
  const code = isAttributed?.(v) ? display?.(v) : v;
  return glottologRecordUrl(code) ? code : null;
}

/**
 * Whether a card read from champollion.dev's published card tables carries
 * the atlas card's per-field citations. The upload script writes them into
 * the detail blob from 2026-10-04 on (build-trading-card-data.mjs); rows
 * uploaded before that carry none, and the card then holds at most the stamps
 * the CLI's own reader derives (`registers` from formality in remote.js,
 * `vitality` from endangerment in normalizeCard) — so any other key means the
 * row carries them.
 *
 * @param {object} card  the card as the CLI's registry returned it
 * @returns {boolean}
 */
const READER_DERIVED_STAMPS = new Set(['registers', 'vitality']);
export function publishedCarriesFieldSources(card) {
  const fs = card?._fieldSources;
  return Boolean(fs && typeof fs === 'object'
    && Object.keys(fs).some((k) => !READER_DERIVED_STAMPS.has(k)));
}

/**
 * Why a fact a card carries is not displayed: it has no source to cite —
 * said for the tier the card came from. A published row uploaded before the
 * tables carried per-field sources says exactly that (the card the row was
 * built from cites them; they arrive with the tables' next upload), never
 * that the fact has no source.
 *
 * @param {{tier?: string, publishedStamps?: boolean}} lang
 * @param {string} [it='it']  what the reason is about ("it" / "them")
 * @param {object} [opts]
 * @param {boolean} [opts.brief]  leave out why the projection lacks them
 *   (for a second mention on the same line)
 */
export function uncitedReason(lang, it = 'it', { brief = false } = {}) {
  if (lang?.tier !== 'published') return `this card states no source for ${it}`;
  if (lang.publishedStamps) return `the published card states no source for ${it}`;
  return `the published card projection carries no per-field source for ${it}`
    + (brief ? '' : ' (its rows were uploaded before champollion.dev\'s card tables carried per-field '
      + 'sources; those arrive with the tables\' next upload)');
}

/**
 * The card's alternate names (ISO 639-3's list), as attributed facts —
 * capped, with the overflow counted. Codes and the language's own name are
 * not alternate names.
 *
 * @returns {{facts: Array<{text: string, sources: string[]}>, more: number}}
 */
function alternateNamesOf(card, ctx) {
  const facts = [];
  const seen = new Set([String(card?.name ?? '').toLowerCase()]);
  let total = 0;
  for (const c of claimsFor(card, 'alternateNames', ['alternateNames'], ctx)) {
    for (const n of (Array.isArray(c.value) ? c.value : [c.value])) {
      // A bare lowercase 2–3 letter string is a code, not a name ("Ata" is a name).
      if (typeof n !== 'string' || !n.trim() || /^[a-z]{2,3}$/.test(n.trim())) continue;
      const key = n.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      total += 1;
      if (facts.length < ALT_NAME_CAP) facts.push({ text: n.trim(), sources: c.sources });
    }
  }
  return { facts, more: total - facts.length };
}

/**
 * Attributed facts on one line, grouped by source in first-seen order:
 * "Philippines (PH), 15.41°N 120.20°E [glottolog-v5.3]; macroarea Papunesia
 * [glottolog-cldf-v5.3]". A fact the card carries without a source stamp
 * says so instead of borrowing one.
 */
export function renderAttributed(facts, { unstamped = 'source not stated on this card' } = {}) {
  const groups = [];
  for (const f of facts) {
    const key = (f.sources ?? []).join(', ');
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, texts: [] };
      groups.push(g);
    }
    if (!g.texts.includes(f.text)) g.texts.push(f.text);
  }
  return groups
    .map((g) => `${g.texts.join(', ')} [${g.key || unstamped}]`)
    .join('; ');
}

/**
 * Every name a card records for a language, each with its source: the
 * registries' names (the `name` envelope — normalizeCard keeps only the
 * displayed one, so the claims are taken from the raw card BEFORE it is
 * normalized: `nameClaims`) and every endonym in the `endonym` envelope (a
 * community's own name is often not the one displayed: the Cree
 * macrolanguage's card shows ᓀᐦᐃᔭᐍᐏᐣ and also records nēhiyawēwin).
 *
 * @returns {Array<{text: string, field: 'name'|'endonym', source: string|null}>}
 */
function recordedNames(card, ctx, nameClaims = []) {
  const out = [];
  const seen = new Set();
  const add = (text, field, source) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const key = `${field}|${text.trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: text.trim(), field, source: source ?? null });
  };
  for (const c of nameClaims) add(c?.value, 'name', c?.source);
  for (const c of ctx.attributions?.(card?.endonym) ?? []) add(c?.value, 'endonym', c?.source);
  if (card?.nativeName) add(card.nativeName, 'endonym', null);
  return out;
}

/** The name claims of a RAW card (before normalizeCard flattens `name`). */
function rawNameClaims(raw, ctx) {
  return (ctx.attributions?.(raw?.name) ?? [])
    .map((c) => ({ value: c?.value, source: c?.source ?? null }));
}

// ---------------------------------------------------------------------------
// A recorded name read in another script — champollion's derivation, labelled
// ---------------------------------------------------------------------------

const _scriptRes = new Map();
/**
 * `\p{Script=<ISO 15924>}` for a script Unicode encodes (Latn, Cans, Cyrl),
 * or null for one it does not (pIqaD and Tengwar live in Private Use blocks).
 */
function scriptRegex(code) {
  if (typeof code !== 'string' || !code) return null;
  if (!_scriptRes.has(code)) {
    let re = null;
    try {
      re = new RegExp(`\\p{Script=${code}}`, 'u');
    } catch {
      re = null; // not a Unicode script property: no character can be tested against it
    }
    _scriptRes.set(code, re);
  }
  return _scriptRes.get(code);
}

/** A test for "this text has characters of the converter's display script". */
function displayScriptTest(conv) {
  const re = scriptRegex(conv?.toScript);
  if (re) return (s) => [...s].some((ch) => re.test(ch));
  if (Array.isArray(conv?.puaRange)) {
    const [lo, hi] = conv.puaRange;
    return (s) => [...s].some((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= lo && cp <= hi;
    });
  }
  return null;
}

/**
 * The working-script forms of a card's recorded names, read by the converter
 * the CLI registers for the language (resolved through the card, as the CLI
 * resolves it: `converterKeyForLocale`). Plains Cree's card records its
 * endonym only as ᓀᐦᐃᔭᐍᐏᐣ; the registered Cree Syllabics ⇄ SRO converter
 * reads it as nêhiyawêwin, so a search for the name a speaker types in Roman
 * letters finds the language — and every answer built on it says the spelling
 * is champollion's derivation, never a source's claim.
 *
 * Generic over the registry: any language with a converter whose reversal
 * yields text wholly in the converter's working script. A reading that leaves
 * display-script characters behind (a glyph the converter does not know), or
 * letters outside the working script, is not a reading and is dropped; a form
 * the card already records under any name is not added again.
 *
 * @returns {Array<{text: string, from: string, fromField: 'name'|'endonym',
 *   fromSource: string|null, fromScript: string, toScript: string}>}
 */
function derivedNamesOf(card, code, recorded, alsoKnown, scripts) {
  if (!scripts || !code) return [];
  const key = scripts.converterKeyForLocale(code, card);
  const conv = key ? scripts.SCRIPT_CONVERTERS[key] : null;
  // Only converters reverseScript can actually reverse (a library inverse, a
  // table, or arithmetic over a Private Use block).
  if (!conv || !(typeof conv.reverse === 'function' || Array.isArray(conv.map) || Array.isArray(conv.puaRange))) {
    return [];
  }
  const inDisplay = displayScriptTest(conv);
  const working = scriptRegex(conv.fromScript);
  if (!inDisplay || !working) return [];
  const known = new Set([...recorded.map((n) => n.text), ...alsoKnown]
    .filter((t) => typeof t === 'string').map(normalizeForMatch).filter(Boolean));
  const out = [];
  for (const n of recorded) {
    if (!inDisplay(n.text)) continue;
    const { reversed, unreversed } = scripts.reverseScript(n.text, key);
    const text = typeof reversed === 'string' ? reversed.normalize('NFC').trim() : '';
    if (!text || text === n.text || (Array.isArray(unreversed) && unreversed.length)) continue;
    if (inDisplay(text)) continue;
    if ([...text].some((ch) => /\p{L}/u.test(ch) && !working.test(ch))) continue;
    const folded = normalizeForMatch(text);
    if (!folded || known.has(folded)) continue;
    known.add(folded);
    out.push({
      text,
      from: n.text,
      fromField: n.field,
      fromSource: n.source ?? null,
      fromScript: conv.to,
      toScript: conv.from,
    });
  }
  return out;
}

/**
 * How a result line names a derived match: what it was derived from (with
 * that name's source), by what, and that no source on the card spells it so.
 * Provenance per the derived-values rule: champollion-derived, naming the
 * upstream the input came from — never the upstream's name alone.
 */
export function derivedNameNote(d) {
  const what = d.fromField === 'name' ? 'name' : 'endonym';
  return `the ${d.toScript} form of the card's ${d.fromScript} ${what} ${d.from}, by champollion's `
    + 'script converter; no source on this card records this spelling '
    + `[champollion-derived${d.fromSource ? ` from ${d.fromSource}` : `; the card states no source for that ${what}`}]`;
}

/** One index entry from a full (normalized) card. */
function entryFromCard(card, ctx, { nameClaims = [] } = {}) {
  const { display, isDisputed } = ctx;
  // Speaker estimates: ONE claim answers as itself; several claims answer as
  // the DISAGREEMENT, every value shown. Taking estimates[0] silently elected
  // ELCat's British-Columbia-only count as Plains Cree's total — 'speakers:
  // 10-99' on the flagship card, which is exactly the pick-a-winner move the
  // card boundary forbids.
  const claims = Array.isArray(card.speakerEstimates) ? card.speakerEstimates : [];
  const counts = [...new Set(claims.map((e) => e?.count).filter((c) => c != null && c !== ''))];
  const speakers = card.vitality?.speakerCount
    || (counts.length === 1 ? counts[0]
      : counts.length > 1 ? `${counts.join(' / ')} (sources differ)` : '');
  const fam = card.classification?.family;
  const code = card.code || card.iso639_3 || card.bcp47 || '';
  const aliases = [
    ...(Array.isArray(card.alternateNames) ? card.alternateNames : []),
    ...(Array.isArray(card.aliases) ? card.aliases : []),
  ];
  const names = recordedNames(card, ctx, nameClaims);
  return {
    code,
    name: card.name || '',
    endonym: card.nativeName || card.endonym || '',
    // display() yields the agreed value and nothing on a real dispute —
    // but 'disputed' and 'unknown' are different claims, so a genuine
    // disagreement says so instead of reading as ignorance.
    family: display(fam) || (isDisputed?.(fam) ? 'disputed' : ''),
    speakers,
    script: card.script || (Array.isArray(card.scripts) ? card.scripts[0] : '') || '',
    region: card.macroarea || '',
    typology: card.typologicalProfile?.verbSynthesis
      || card.typologicalProfile?.morphologicalSynthesis || '',
    // Documented alternate names so a language is findable by ANY of its
    // names — the same alias set the Atlas searches.
    aliases,
    isolate: card.isIsolate === true,
    // Every registry name and endonym, with its source: searchable, and a
    // result found through one of them says which (Round 5 school persona:
    // nêhiyawêwin found nothing).
    names,
    // Those names read in the working script of the language's registered
    // converter (Round 8: nêhiyawêwin found cre but never crk, whose card has
    // only ᓀᐦᐃᔭᐍᐏᐣ). Searchable, ranked after recorded names, and always
    // shown as champollion's derivation (derivedNameNote).
    derivedNames: derivedNamesOf(card, code, names,
      [card.name, card.nativeName, card.endonym, ...aliases], ctx.scripts),
    // ISO 639-3's macrolanguage link (and the card's scope), so a
    // macrolanguage result can name its member languages from the index.
    macrolanguage: typeof card.macrolanguage === 'string' ? card.macrolanguage : null,
    macrolanguageSources: stampedSources(card, ['macrolanguage']),
    isoScope: card.isoScope || null,
    // Where it is spoken + what else it is called, each fact with its source:
    // what lets a person pick between same-named languages in a result list.
    where: locationOf(card, ctx),
    alsoCalled: alternateNamesOf(card, ctx),
    // Glottolog's identifier for it: a result line whose location cannot be
    // cited links the Glottolog record instead (glottologRecordUrl).
    glottocode: glottocodeOf(card, ctx),
    // A full card stands behind this entry (vs a name-only manifest entry).
    lean: false,
    // Keep the full card for detailed lookups
    _raw: card,
  };
}

/** Build the index from a language-cards directory (full corpus). */
async function indexFromDir(dir, ctx) {
  const { normalizeCard } = ctx;
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('.'));

  const index = [];
  const cards = await Promise.allSettled(
    jsonFiles.map(async (f) => {
      const raw = JSON.parse(await readFile(join(dir, f), 'utf-8'));
      // The registries' names first: normalizeCard flattens `name` in place.
      const nameClaims = rawNameClaims(raw, ctx);
      // THROUGH THE ONE ADAPTER, like every other consumer.
      return { card: normalizeCard(raw), nameClaims };
    }),
  );

  for (const result of cards) {
    if (result.status !== 'fulfilled') continue;
    const { card, nameClaims } = result.value;
    if (!card || typeof card !== 'object') continue;
    // The cards dir also holds generated reference files (language-tree.json)
    // that are not cards — a card always carries a code and a name.
    if (!(card.code || card.iso639_3 || card.bcp47) || !card.name) continue;
    // A LOCALE IS NOT A LANGUAGE: fra-CA carries French's name and facts;
    // indexing the 8,675 locale cards would return one language a dozen
    // times for one query.
    if (card.locale?.language) continue;
    index.push(entryFromCard(card, ctx, { nameClaims }));
  }
  return index;
}

/**
 * Build the index from the CLI's bundled cards-fallback.json: full entries
 * for the ~1,157 bundled core cards, lean name/alias entries for every other
 * concrete language in the manifest. Lean entries answer "does Champollion
 * know this language, and by what name" honestly — with empty strings, never
 * invented facts — and the full card remains fetchable through the CLI.
 */
async function indexFromFallbackFile(file, ctx) {
  const { normalizeCard } = ctx;
  const bundle = JSON.parse(await readFile(file, 'utf-8'));
  const index = [];
  const seen = new Set();

  for (const raw of Object.values(bundle.cards ?? {})) {
    const nameClaims = rawNameClaims(raw, ctx);   // before normalizeCard flattens it
    const card = normalizeCard(raw);
    if (!(card.code || card.iso639_3 || card.bcp47) || !card.name) continue;
    // The bundle deliberately carries locale-variant cards (fra-CA,
    // cmn-Hant) for the CLI's resolution needs; a language index excludes
    // them by locale block AND by dashed code — some variant cards predate
    // the locale block.
    if (card.locale?.language) continue;
    const entry = entryFromCard(card, ctx, { nameClaims });
    if (entry.code.includes('-')) continue;
    index.push(entry);
    seen.add(entry.code);
  }
  const parents = new Set(Object.keys(bundle.parents ?? {}));
  for (const [code, m] of Object.entries(bundle.manifest ?? {})) {
    if (seen.has(code) || parents.has(code)) continue;
    // Dashed codes are locale projections (fra-CA) — not languages. (This
    // also skips the x-* constructed-script variants; their base cards are
    // in the bundled core set.)
    if (code.includes('-')) continue;
    if (!m?.n) continue;
    index.push({
      code,
      name: m.n,
      endonym: '',
      family: '',
      speakers: '',
      script: '',
      region: '',
      typology: '',
      aliases: Array.isArray(m.a) ? m.a : [],
      // Every other name the card records, each with its source: searchable,
      // and a result found through one says which name and cites it.
      names: manifestSearchNames(m, bundle.nameRefs),
      isolate: false,
      // Name-only: the bundle's manifest carries the names, not the card.
      // get_language materializes the full card through the CLI.
      lean: true,
    });
  }
  return index;
}

/** The manifest's card fields → the `field` a recorded name carries here. */
const MANIFEST_NAME_FIELD = { name: 'name', endonym: 'endonym', alternateNames: 'alternate' };

/**
 * A manifest entry's search names (`s`) as recorded names: one per name and
 * card field, citing every source that records that spelling. The format is
 * the CLI's (cli/lib/cards/search-names.js, described in the bundle's
 * `_meta.searchNames`): `[text, ref, …]`, each ref an index into the bundle's
 * `nameRefs` table of `[cardField, source]` pairs. A bundle built before the
 * manifest carried them has no `s` — the entry then has no other names, as
 * before; an unknown ref or field is skipped, never guessed.
 *
 * @returns {Array<{text: string, field: 'name'|'endonym'|'alternate', source: string|null}>}
 */
export function manifestSearchNames(entry, refs) {
  const out = [];
  for (const tuple of Array.isArray(entry?.s) ? entry.s : []) {
    if (!Array.isArray(tuple) || typeof tuple[0] !== 'string' || !tuple[0].trim()) continue;
    const byField = new Map();
    for (const r of tuple.slice(1)) {
      const pair = Array.isArray(refs) ? refs[r] : undefined;
      const field = Array.isArray(pair) ? MANIFEST_NAME_FIELD[pair[0]] : undefined;
      if (!field) continue;
      if (!byField.has(field)) byField.set(field, []);
      if (typeof pair[1] === 'string' && pair[1] && !byField.get(field).includes(pair[1])) {
        byField.get(field).push(pair[1]);
      }
    }
    for (const [field, sources] of byField) {
      out.push({ text: tuple[0].trim(), field, source: sources.join(', ') || null });
    }
  }
  return out;
}

/**
 * Load the language index. Resolution ladder in the module docstring; every
 * miss is recorded and a total miss THROWS with the full list — startup is
 * the right place to fail, because index.js awaits this before the MCP
 * handshake and a server that starts without languages would answer
 * "No languages found" as if it were a fact about the world.
 *
 * @param {object} [opts]  Test injection: `cardsDir` (strict, same semantics
 *   as CHAMPOLLION_CARDS_DIR), `fallbackFile`, `repoDir` (override the
 *   monorepo candidate).
 * @returns {Promise<object[]>}  Language index array
 */
export async function loadLanguageIndex(opts = {}) {
  const { reader, scripts, packageRoot, source } = await resolveAdapter();
  const adapterCtx = { ...adapterContext(reader), scripts };
  const attempts = [];

  // Tier 1 — explicit override: obey it or fail, never fall past it.
  const explicit = opts.cardsDir ?? process.env.CHAMPOLLION_CARDS_DIR;
  if (explicit) {
    const label = opts.cardsDir ? 'cardsDir option' : 'CHAMPOLLION_CARDS_DIR';
    let index;
    try {
      index = await indexFromDir(explicit, adapterCtx);
    } catch (err) {
      throw new Error(
        `${label} points at ${explicit}, which is not a readable card `
        + `directory (${err.code ?? err.message}). The override names a `
        + 'specific corpus; silently reading a different one would be worse '
        + 'than failing.',
      );
    }
    if (index.length === 0) {
      throw new Error(
        `${label} points at ${explicit}, which contains no language cards — `
        + 'a broken corpus, not a missing one.',
      );
    }
    process.stderr.write(`Loaded ${index.length} language cards from ${explicit} (${label})\n`);
    return index;
  }

  // Tier 2 — the monorepo's full corpus.
  const repoDir = opts.repoDir ?? resolve(REPO_CLI, 'shared/language-cards');
  if (existsSync(repoDir)) {
    const index = await indexFromDir(repoDir, adapterCtx);
    if (index.length === 0) {
      throw new Error(
        `${repoDir} exists but contains no language cards — a broken corpus `
        + '(a half-applied cutover?), not a missing one. Rebuild the cards or '
        + 'set CHAMPOLLION_CARDS_DIR.',
      );
    }
    process.stderr.write(`Loaded ${index.length} language cards from ${repoDir}\n`);
    return index;
  }
  attempts.push(`${repoDir} (monorepo corpus — not present)`);

  // Tier 3 — the champollion package's bundled fallback.
  const fallbackFile = opts.fallbackFile
    ?? process.env.CHAMPOLLION_CARDS_FALLBACK
    ?? join(packageRoot, 'shared', 'cards-fallback.json');
  if (existsSync(fallbackFile)) {
    const index = await indexFromFallbackFile(fallbackFile, adapterCtx);
    if (index.length === 0) {
      throw new Error(
        `${fallbackFile} parsed but yielded no language entries — a broken `
        + 'bundle, not a missing one.',
      );
    }
    process.stderr.write(
      `Loaded ${index.length} languages from the bundled fallback ${fallbackFile}\n`,
    );
    return index;
  }
  attempts.push(`${fallbackFile} (bundled cards-fallback.json — not present)`);

  throw new Error(
    'No language-card source resolved — refusing to start with an empty or '
    + `hand-guessed language surface (adapter came from the ${source}). Tried:\n`
    + attempts.map((a) => `  - ${a}`).join('\n')
    + '\nFix: set CHAMPOLLION_CARDS_DIR to a language-cards directory, run '
    + 'inside the Champollion monorepo, or reinstall so the champollion '
    + "dependency's bundled cards ship intact.",
  );
}

// ---------------------------------------------------------------------------
// Matching primitives
// ---------------------------------------------------------------------------

/**
 * Fold a string for matching: Unicode-decompose, drop combining marks,
 * lowercase, and collapse every run of non-letters/digits to one space.
 * "Èdè Yorùbá" → "ede yoruba"; "Mag-antsi Ayta" → "mag antsi ayta".
 *
 * @param {unknown} s
 * @returns {string}
 */
export function normalizeForMatch(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Cost of swapping two adjacent letters. Half an edit, on purpose: a swapped
 * pair is the commonest slip when a language name is typed from memory or
 * transliterated ("Atya" for Ayta), and pricing it below a substitution is
 * what lets the intended name outrank an unrelated one-letter neighbour
 * ("Atta"). Every answer that uses it says so.
 */
export const TRANSPOSITION_COST = 0.5;

/**
 * Optimal-string-alignment distance (restricted Damerau-Levenshtein):
 * insert / delete / substitute cost 1, adjacent transposition costs
 * TRANSPOSITION_COST. Returns Infinity as soon as the distance provably
 * exceeds `max` (the search calls this ~10⁵ times per query).
 *
 * @param {string} a
 * @param {string} b
 * @param {number} [max=Infinity]
 * @returns {number}
 */
export function editDistance(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m <= max ? m : Infinity;
  if (m === 0) return n <= max ? n : Infinity;
  let prev2 = null;
  let prev = new Array(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;
  for (let i = 1; i <= n; i += 1) {
    const cur = new Array(m + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + TRANSPOSITION_COST);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return Infinity;
    prev2 = prev;
    prev = cur;
  }
  return prev[m] <= max ? prev[m] : Infinity;
}

/** Largest edit distance a fuzzy match may have, by query length (letters). */
function fuzzyBudget(len) {
  if (len < 4) return 0;   // 2–3 letter strings are codes; every code is 1 edit from hundreds
  if (len <= 5) return 1;
  return 2;
}

/** How a recorded name's field reads on a result line. */
function recordedFieldLabel(field) {
  if (field === 'name') return 'name (another registry)';
  if (field === 'alternate') return 'alternate name';
  return 'endonym';
}

/** Strings a language is NAMED by (not its codes): name, endonym, alternate names. */
function namesOf(lang) {
  const out = [];
  if (lang.name) out.push({ text: lang.name, field: 'name' });
  if (lang.endonym) out.push({ text: lang.endonym, field: 'endonym' });
  for (const n of lang.names ?? []) {
    if (n.text !== lang.name && n.text !== lang.endonym) {
      out.push({ text: n.text, field: recordedFieldLabel(n.field), source: n.source || null });
    }
  }
  for (const a of Array.isArray(lang.aliases) ? lang.aliases : []) {
    // Code aliases ('cr', 'fra') are not names — fuzzy-matching them would
    // make every short query "close" to hundreds of codes.
    if (typeof a === 'string' && !/^[a-z]{2,3}$/i.test(a)) out.push({ text: a, field: 'alternate name' });
  }
  // Last: a recorded name read by the language's script converter — a match
  // on it always carries its derivation (derivedNameNote).
  for (const d of lang.derivedNames ?? []) out.push({ text: d.text, field: 'derived', derived: d });
  return out;
}

/**
 * Shortest query word that may stand for a longer word of a name it begins
 * ("north" for "northern"). Below four letters a word is code-like and begins
 * too many name words to be evidence (the fuzzy pass's own floor).
 */
export const WORD_START_MIN = 4;

/** Score one name against the folded query; Infinity when outside budget. */
function nameDistance(qNorm, qTokens, nameNorm, budget) {
  let best = editDistance(qNorm, nameNorm, budget);
  const tokens = nameNorm.split(' ').filter(Boolean);
  if (qTokens.length === 1) {
    for (const t of tokens) best = Math.min(best, editDistance(qNorm, t, budget));
  } else if (tokens.length >= qTokens.length) {
    // Every query word must find a close word in the name; the costs add.
    let sum = 0;
    for (const qt of qTokens) {
      let tokBest = Infinity;
      for (const t of tokens) tokBest = Math.min(tokBest, editDistance(qt, t, budget));
      sum += tokBest;
      if (sum > budget) break;
    }
    if (sum <= budget) best = Math.min(best, sum);
  }
  return best;
}

/**
 * A query of several words whose words are close to the name's words, except
 * that one or more of them is the START of a longer word of the name: "North
 * Sami" → "Northern Sami", "North Saami" → "Northern Sami" (Round 11
 * researcher: "North Sami" offered only North Fali). The words that are close
 * cost their edits as usual (within the same budget); a word-start costs no
 * edit but is never free evidence: at least one query word must be close to a
 * name word in its own right, a word-start must be WORD_START_MIN letters or
 * more, and the result line says which query word began which name word.
 *
 * Only for a name nameDistance did NOT already reach — so every match the
 * search made before keeps its distance; this only adds candidates.
 *
 * @returns {{distance: number, starts: Array<{query: string, word: string}>}|null}
 */
function wordStartMatch(qTokens, nameNorm, budget) {
  if (qTokens.length < 2) return null;
  const tokens = nameNorm.split(' ').filter(Boolean);
  if (tokens.length < qTokens.length) return null;
  let sum = 0;
  let close = 0;
  const starts = [];
  for (const qt of qTokens) {
    let tokBest = Infinity;
    for (const t of tokens) tokBest = Math.min(tokBest, editDistance(qt, t, budget - sum));
    if (tokBest !== Infinity) {
      sum += tokBest;
      close += 1;
      continue;
    }
    const word = qt.length >= WORD_START_MIN
      ? tokens.find((t) => t.length > qt.length && t.startsWith(qt)) : undefined;
    if (!word) return null;
    starts.push({ query: qt, word });
  }
  if (!starts.length || close === 0 || sum > budget) return null;
  return { distance: sum, starts };
}

/**
 * Search the language index for matches against a query string.
 *
 * Matches against: code, name, endonym, alternate names, family, region,
 * typology — case- and diacritic-insensitive substring. Ranked:
 *   0  exact code
 *   1  exact name / endonym / alternate name
 *   2  the query is a whole word of the name ("Cree" in "Plains Cree")
 *   3  name prefix
 *   4  anything else (family, region, …) in index order
 *
 * (Tier 4 is split internally: 4a = the query sits INSIDE a word of a name
 * — "atya" in "Matya" — and 4b = it matched the family/region/typology.)
 *
 * A name the card records only in another script also matches in the form
 * the language's registered script converter reads it as (`derivedNames`:
 * ᓀᐦᐃᔭᐍᐏᐣ → nêhiyawêwin) — an exact match on that form ranks right after
 * the exact matches on recorded names (evidence a source gives outranks our
 * derivation), and the result line says it is derived.
 *
 * Exact/substring only — `findLanguages` adds the fuzzy fallback.
 *
 * @param {object[]} index   Language index from loadLanguageIndex()
 * @param {string}   query   Search term
 * @param {number}   limit   Max results
 * @returns {object[]}       Matching languages
 */
export function searchLanguages(index, query, limit = 10) {
  return rankMatches(index, query, limit).flat().slice(0, limit);
}

/**
 * The tiered substring match behind searchLanguages:
 * [t0, t1, t1-derived, t2, t3, t4a, t4b].
 */
function rankMatches(index, query, limit) {
  const raw = String(query ?? '').trim().toLowerCase();
  const q = normalizeForMatch(query);
  const tiers = [[], [], [], [], [], [], []];
  if (!q && !raw) return tiers;
  const wordRe = new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);

  for (const lang of index) {
    const aliases = Array.isArray(lang.aliases) ? lang.aliases : [];
    const recorded = (lang.names ?? []).map((n) => n.text);
    const derived = (lang.derivedNames ?? []).map((d) => d.text);
    const searchable = normalizeForMatch([
      lang.code, lang.name, lang.endonym, lang.family,
      lang.region, lang.typology, ...aliases, ...recorded, ...derived,
    ].filter(Boolean).join(' '));

    const codeHit = lang.code && lang.code.toLowerCase() === raw;
    if (!codeHit && !(q && searchable.includes(q))) continue;

    const nameN = normalizeForMatch(lang.name);
    const derivedN = derived.map((t) => normalizeForMatch(t)).filter(Boolean);
    const named = [nameN, normalizeForMatch(lang.endonym),
      ...aliases.map((a) => normalizeForMatch(a)),
      ...recorded.map((t) => normalizeForMatch(t))].filter(Boolean);
    const anyName = [...named, ...derivedN];
    if (codeHit) {
      tiers[0].push(lang);
    } else if (named.includes(q)) {
      tiers[1].push(lang);
    } else if (derivedN.includes(q)) {
      tiers[2].push(lang);
    } else if (anyName.some((n) => wordRe.test(n))) {
      tiers[3].push(lang);
    } else if (nameN.startsWith(q)) {
      tiers[4].push(lang);
    } else if (anyName.some((n) => n.includes(q))) {
      tiers[5].push(lang);
    } else {
      tiers[6].push(lang);
    }

    // Enough candidates to fill the limit from the best tier alone.
    if (tiers[0].length >= limit) break;
  }
  return tiers;
}

/**
 * The search an agent actually wants: exact/substring first, and when that
 * finds NOTHING, the closest names by edit distance — "Atya" surfaces the
 * Ayta languages instead of "No languages found" — and when a query of
 * several words is not close to any name as a whole, its parts
 * (matchTerms): "Plains Cree nêhiyawêwin" → crk.
 *
 * Fuzzy matching compares names only (never codes), whole and word by word,
 * with a budget of 1 edit for 4–5 letter queries and 2 beyond (shorter
 * queries are codes and get no fuzzy pass at all).
 *
 * @param {object[]} index
 * @param {string}   query
 * @param {number}   [limit=10]
 * @returns {{
 *   match: 'exact'|'fuzzy'|'partial'|'none',
 *   results: object[],
 *   fuzzy: Array<{lang: object, matched: string, field: string, distance: number}>,
 *   partial?: Array<{lang: object, matched: object[], words: string[], whole: number,
 *     longest: number, covered: number, of: number}>,
 *   partialTied?: number,
 * }}
 */
/** macrolanguage code → its member entries in this index (cached per index). */
const _membersCache = new WeakMap();
function membersByMacrolanguage(index) {
  let m = _membersCache.get(index);
  if (!m) {
    m = new Map();
    for (const lang of index) {
      if (!lang?.macrolanguage) continue;
      if (!m.has(lang.macrolanguage)) m.set(lang.macrolanguage, []);
      m.get(lang.macrolanguage).push(lang);
    }
    _membersCache.set(index, m);
  }
  return m;
}

/**
 * The member languages of each macrolanguage among ``results``, read from
 * the members' own cards (their ISO 639-3 ``macrolanguage`` link, cited) —
 * so a search that lands on a macrolanguage (nēhiyawēwin → cre, Cree) also
 * names the languages under it (crk Plains Cree, …).
 */
export function macrolanguageMembers(index, results) {
  const byMacro = membersByMacrolanguage(index);
  const out = new Map();
  for (const lang of results ?? []) {
    const members = byMacro.get(lang?.code);
    if (members?.length) out.set(lang.code, members);
  }
  return out;
}

export function findLanguages(index, query, limit = 10) {
  const found = findLanguagesRanked(index, query, limit);
  found.members = macrolanguageMembers(index, found.results);
  return found;
}

/**
 * A query of several words that no name matches as a whole — "Plains Cree
 * nêhiyawêwin" is a name AND an endonym; "Yoruba xyzzy" a name and a slip —
 * matched part by part (Round 5 school persona: each half found its language,
 * the two together found nothing).
 *
 * A candidate's evidence, folded as the whole-string search folds (case,
 * diacritics, punctuation):
 *   - a recorded NAME all of whose words are words of the query (any order) —
 *     "Plains Cree" is one match covering two query words, never two loose
 *     words; a language's code (or code alias) as a query word counts the same;
 *   - a query word that is only one word of a longer name ("Cree" of
 *     "Swampy Cree") — weaker evidence.
 * Ranked by how many query words whole names/codes cover, then by the longest
 * whole name matched (a two-word name inside the query is stronger than two
 * one-word names), then by how many query words are covered at all, then the
 * language's own name before another recorded name, then index order. Ties
 * stay ties: the answer lists them and says so, never picks.
 *
 * @returns {{ hits: Array<{ lang: object, matched: Array<{text: string, field: string, source?: string|null}>,
 *   words: string[], whole: number, longest: number, covered: number, of: number }>,
 *   tied: number }} hits: the best `limit`; tied: how many candidates in the
 *   WHOLE index match as strongly as the first (a common word ties hundreds)
 */
function matchTerms(index, qTokens, limit) {
  if (qTokens.length < 2) return { hits: [], tied: 0 };
  const hits = [];
  index.forEach((lang, order) => {
    const whole = new Set();
    const covered = new Set();
    const matched = [];
    let longest = 0;
    let ownName = 1;
    const codes = [lang.code, ...(Array.isArray(lang.aliases) ? lang.aliases : [])]
      .filter((c) => typeof c === 'string' && /^[a-z]{2,3}$/i.test(c)).map((c) => c.toLowerCase());
    qTokens.forEach((t, i) => {
      if (!codes.includes(t)) return;
      whole.add(i);
      covered.add(i);
      matched.push({ text: t, field: 'code' });
      longest = Math.max(longest, 1);
    });
    for (const { text, field, source, derived } of namesOf(lang)) {
      const words = normalizeForMatch(text).split(' ').filter(Boolean);
      if (words.length === 0) continue;
      // Every word of the name at its own query position.
      const used = new Set();
      for (const w of words) {
        const at = qTokens.findIndex((t, i) => t === w && !used.has(i));
        if (at < 0) break;
        used.add(at);
      }
      if (used.size === words.length) {
        for (const i of used) { whole.add(i); covered.add(i); }
        if (!matched.some((m) => normalizeForMatch(m.text) === normalizeForMatch(text))) {
          matched.push({ text, field, ...(source ? { source } : {}), ...(derived ? { derived } : {}) });
        }
        if (field === 'name') ownName = 0;
        longest = Math.max(longest, words.length);
        continue;
      }
      qTokens.forEach((t, i) => { if (words.includes(t)) covered.add(i); });
    }
    if (covered.size === 0) return;
    const words = qTokens.filter((t, i) => covered.has(i) && !whole.has(i));
    hits.push({
      lang, matched, words: [...new Set(words)], whole: whole.size, longest, covered: covered.size,
      of: qTokens.length, ownName, order,
    });
  });
  hits.sort((a, b) => b.whole - a.whole || b.longest - a.longest || b.covered - a.covered
    || a.ownName - b.ownName || a.order - b.order);
  return {
    hits: hits.slice(0, limit).map(({ ownName, order, ...h }) => h),
    tied: hits.length ? hits.filter((h) => sameStrength(h, hits[0])).length : 0,
  };
}

/** Two part-by-part hits rank equal (the keys matchTerms sorts by). */
function sameStrength(a, b) {
  return a.whole === b.whole && a.longest === b.longest && a.covered === b.covered;
}

function findLanguagesRanked(index, query, limit) {
  const tiers = rankMatches(index, query, limit);
  const [t0, t1, t1Derived, t2, t3, inWord, other] = tiers;
  // A code, an exact name, a whole word, a name prefix, or a family/region
  // hit is an answer. A query that only turns up INSIDE other words ("atya"
  // in "Matya Samo") is not — it is usually a misspelling, so the closest
  // names are worth more than the accident, and both are returned.
  if (t0.length + t1.length + t1Derived.length + t2.length + t3.length + other.length > 0) {
    return { match: 'exact', results: tiers.flat().slice(0, limit), fuzzy: [] };
  }

  const qNorm = normalizeForMatch(query);
  const qTokens = qNorm.split(' ').filter(Boolean);
  // Nothing matches the whole query, even approximately: a query of several
  // words is matched part by part (see matchTerms).
  const byParts = () => {
    const { hits: partial, tied } = matchTerms(index, qTokens, limit);
    return partial.length
      ? { match: 'partial', results: partial.map((h) => h.lang), fuzzy: [], partial, partialTied: tied }
      : { match: 'none', results: [], fuzzy: [] };
  };
  const budget = fuzzyBudget(qNorm.replace(/ /g, '').length);
  if (budget === 0) {
    return inWord.length
      ? { match: 'exact', results: inWord.slice(0, limit), fuzzy: [] }
      : byParts();
  }

  const hits = [];
  index.forEach((lang, order) => {
    let best = null;
    for (const { text, field, source, derived } of namesOf(lang)) {
      const nameNorm = normalizeForMatch(text);
      let d = nameDistance(qNorm, qTokens, nameNorm, budget);
      let starts = [];
      if (d === Infinity) {
        // Not close as typed: a word of the query may begin a longer word
        // of the name ("north" → "northern"; wordStartMatch).
        const m = wordStartMatch(qTokens, nameNorm, budget);
        if (!m) continue;
        d = m.distance;
        starts = m.starts;
      }
      // Prefer the language's own name over an alternate name at equal cost,
      // and any recorded name over a derived (converter-read) one.
      const rank = field === 'name' ? 0 : field === 'derived' ? 2 : 1;
      if (!best || d < best.distance || (d === best.distance && starts.length < best.starts.length)
          || (d === best.distance && starts.length === best.starts.length && rank < best.rank)) {
        best = {
          lang, matched: text, field, distance: d, starts, rank, order,
          ...(source ? { source } : {}), ...(derived ? { derived } : {}),
        };
      }
    }
    if (best) hits.push(best);
  });
  // Edits first; at equal edits a name matched as typed outranks one a query
  // word only began ("north" of "northern").
  hits.sort((a, b) => a.distance - b.distance || a.starts.length - b.starts.length
    || a.rank - b.rank || a.order - b.order);
  const fuzzy = hits.slice(0, limit).map(({ rank, order, ...h }) => h);
  // Substring-inside-a-word hits the edit budget did not reach still count —
  // appended after the close names, never dropped.
  const seen = new Set(fuzzy.map((h) => h.lang));
  for (const lang of inWord) {
    if (fuzzy.length >= limit) break;
    if (seen.has(lang)) continue;
    fuzzy.push({ lang, matched: lang.name, field: 'substring', distance: null });
  }
  if (fuzzy.length === 0) return byParts();
  return {
    match: 'fuzzy',
    results: fuzzy.map((h) => h.lang),
    fuzzy,
  };
}

// ---------------------------------------------------------------------------
// Name-only results → full entries, and the result text
// ---------------------------------------------------------------------------

/** Name-only results filled in per search, at most, and how long it may take. */
export const LEAN_FETCH_MAX = 10;
export const LEAN_FETCH_BUDGET_MS = 6000;

/**
 * Fill in name-only (lean) results so each can say where it is spoken.
 *
 * An npm install's index knows most languages by NAME only (the bundle's
 * manifest). A query like "Atya" then returned six Ayta languages as six
 * bare names at the same distance — nothing to choose by, in the install
 * every outside user runs. Each lean result's card is materialized the way
 * get_language does it: the CLI's own async prefetch (published card tables,
 * read-only, cached in ~/.champollion/cards), never its synchronous
 * child-process fetch. Bounded: the first LEAN_FETCH_MAX lean results, in
 * parallel, within LEAN_FETCH_BUDGET_MS; a card that has not arrived by then
 * keeps downloading into the cache and the line says so. Repo checkouts have
 * no lean entries, so this is a no-op there.
 *
 * @param {object[]} langs  Result entries (lean ones are filled in).
 * @param {object} [opts]
 * @param {object|null} [opts.champollion]  The champollion package (tests inject one).
 * @param {number} [opts.budgetMs]
 * @param {number} [opts.max]
 * @returns {Promise<{upgraded: Map<string, object>, unresolved: Map<string, string>}>}
 *   upgraded: code → full entry; unresolved: code → why it is still name-only.
 */
export async function materializeLean(langs, {
  champollion, budgetMs = LEAN_FETCH_BUDGET_MS, max = LEAN_FETCH_MAX,
} = {}) {
  const upgraded = new Map();
  const unresolved = new Map();
  const lean = [...new Set((langs ?? []).filter((l) => l?.lean && l.code).map((l) => l.code))];
  if (!lean.length) return { upgraded, unresolved };

  const wanted = lean.slice(0, max);
  for (const code of lean.slice(max)) {
    unresolved.set(code, `only the first ${max} name-only results are filled in per search`);
  }

  let c = champollion;
  if (c === undefined) {
    const { loadChampollion } = await import('./translate.js');
    c = await loadChampollion();
  }
  if (!c || typeof c.getLanguageCard !== 'function' || typeof c.normalizeCard !== 'function') {
    for (const code of wanted) unresolved.set(code, 'the champollion package is not reachable from this install');
    return { upgraded, unresolved };
  }

  const mode = typeof c.getCardSourceInfo === 'function' ? c.getCardSourceInfo()?.mode : 'unknown';
  const ready = new Set();
  if (mode === 'repo') {
    // The whole corpus is already in memory: a read, never a fetch.
    for (const code of wanted) ready.add(code);
  } else if (mode === 'packaged' && typeof c.prefetchLanguageCards === 'function') {
    const settled = new Map();
    const runs = wanted.map((code) => Promise.resolve()
      .then(() => c.prefetchLanguageCards([code]))
      .then(
        (r) => { settled.set(code, r ?? {}); },
        (err) => { settled.set(code, { failed: [code], error: err?.message }); },
      ));
    let timer;
    const budget = new Promise((res) => {
      timer = setTimeout(res, budgetMs);
      timer.unref?.();
    });
    await Promise.race([Promise.all(runs), budget]);
    clearTimeout(timer);
    for (const code of wanted) {
      const r = settled.get(code);
      // One code per call, so the non-empty bucket is this code's outcome
      // (the CLI reports some buckets under the alias-resolved code).
      const outcome = r && ['fetched', 'skipped', 'missing', 'failed'].find((k) => r[k]?.length);
      if (!r) {
        unresolved.set(code, `its card did not arrive within ${Math.round(budgetMs / 1000)}s; it is still being cached`);
      } else if (outcome === 'fetched' || outcome === 'skipped') {
        // fetched now, or already bundled/cached (or offline: then only a
        // cached copy can answer, and getLanguageCard never fetches).
        ready.add(code);
      } else if (outcome === 'missing') {
        unresolved.set(code, 'champollion.dev publishes no card for it yet, only its name');
      } else {
        unresolved.set(code, 'fetching its card from champollion.dev failed (offline or unreachable)');
      }
    }
  } else {
    for (const code of wanted) unresolved.set(code, `the card registry is not loaded (mode: ${mode})`);
  }

  const ctx = adapterContext(c);
  for (const code of wanted) {
    if (!ready.has(code)) continue;
    let card;
    try {
      card = c.getLanguageCard(code);
    } catch (err) {
      unresolved.set(code, `reading its card failed: ${err.message}`);
      continue;
    }
    if (!card) {
      unresolved.set(code, 'no bundled or cached card on this machine, and none was fetched');
      continue;
    }
    // Clone before normalizing: normalizeCard mutates, and the registry
    // caches the composed card it handed out.
    const view = typeof structuredClone === 'function' ? structuredClone(card) : JSON.parse(JSON.stringify(card));
    const nameClaims = rawNameClaims(view, ctx);   // before normalizeCard flattens it
    const normalized = c.normalizeCard(view);
    if (normalized?.locale?.language) continue; // a locale is not a language
    const entry = entryFromCard(normalized, ctx, { nameClaims });
    entry.code = code;
    entry.tier = card._remote ? 'published' : mode;
    // Read from the card as the registry returned it (before normalizing).
    if (card._remote) entry.publishedStamps = publishedCarriesFieldSources(card);
    upgraded.set(code, entry);
  }
  return { upgraded, unresolved };
}

/** "family: …  speakers: …" — the facts a result line always carries. */
function factsOf(lang) {
  const fam = lang.isolate ? 'isolate' : (lang.family || 'not asserted');
  return `family: ${fam}  speakers: ${lang.speakers || 'no cited estimate'}`;
}

/** The indented second line of a full result: where it is spoken, other names. */
/**
 * The bracket a fact without a per-field stamp gets. A card from champollion.dev's
 * published card tables lost its stamps in that projection — the card itself
 * cites them, so "source not stated on this card" would be false there.
 */
function unstampedLabel(lang) {
  return lang.tier === 'published' && !lang.publishedStamps
    ? 'per-field source not carried by the published card projection'
    : 'source not stated on this card';
}

/** " · Glottolog record (glottocode x): <url>" — or '' when the card carries no glottocode. */
function glottologPointer(lang) {
  const url = glottologRecordUrl(lang?.glottocode);
  return url ? ` · Glottolog record (glottocode ${lang.glottocode}): ${url}` : '';
}

/** "members (ISO 639-3): crk Plains Cree, crl Northern East Cree, …". */
const MEMBER_CAP = 8;
function membersLine(members) {
  if (!members?.length) return null;
  const sources = [...new Set(members.flatMap((m) => m.macrolanguageSources ?? []))];
  const shown = members.slice(0, MEMBER_CAP).map((m) => `${m.code} ${m.name}`);
  if (members.length > MEMBER_CAP) shown.push(`+${members.length - MEMBER_CAP} more`);
  return `macrolanguage — member languages: ${shown.join(', ')}`
    + ` [${sources.join(', ') || 'source not stated on the member cards'}]`;
}

function detailOf(lang, members = null) {
  if (lang.where === undefined) return null;
  const parts = [];
  // Round 10 (hospital persona): every displayed language fact cites its
  // source. A location or alternate name this card carries WITHOUT one — the
  // published card projection drops the per-field stamps the atlas card has —
  // is not displayed; the line says how many were left out and why, never
  // borrowing a source and never calling the card itself unsourced.
  // Said briefly on every line; for a published row that predates per-field
  // sources, the note under the results says why once (formatSearchAnswer).
  const why = () => uncitedReason(lang, 'it', { brief: true })
    + (lang.tier === 'published' && !lang.publishedStamps ? ' (see the note below)' : '');
  const where = lang.where?.facts ?? [];
  const whereCited = where.filter((f) => f.sources?.length);
  const whereLeft = where.length - whereCited.length;
  // Round 11 (hospital persona): with every location withheld, six Ayta
  // candidates could be told apart only by speaker counts. A line that can
  // show no cited location links the language's Glottolog record (by the
  // glottocode its card carries) — a pointer to the source, never a claim.
  if (whereCited.length) {
    parts.push(`where: ${renderAttributed(whereCited)}${lang.where.disputed ? ' (sources differ; every claim shown)' : ''}`
      + (whereLeft ? ` (+${whereLeft} uncited location fact${whereLeft === 1 ? '' : 's'} not shown: ${why()})` : ''));
  } else if (where.length) {
    parts.push(`where: not shown — ${why()}; an uncited location is never displayed${glottologPointer(lang)}`);
  } else {
    parts.push(`where: not stated on this card${glottologPointer(lang)}`);
  }
  const alt = lang.alsoCalled?.facts ?? [];
  const altCited = alt.filter((f) => f.sources?.length);
  const altLeft = alt.length - altCited.length;
  const more = Math.max(lang.alsoCalled?.more ?? 0, 0);
  if (altCited.length) {
    parts.push(`also called: ${renderAttributed(altCited)}`
      + (more > 0 ? ` (+${more} more)` : '')
      + (altLeft ? ` (+${altLeft} uncited name${altLeft === 1 ? '' : 's'} not shown: ${why()})` : ''));
  } else if (alt.length) {
    parts.push(`other names: ${alt.length + more} recorded, not shown — ${why()}`);
  }
  const mem = membersLine(members);
  if (mem) parts.push(mem);
  return parts.join(' · ');
}

/**
 * What tells tied results apart, said truthfully: the cited location lines
 * when there are any; otherwise that nothing cited here does (a published
 * card's location carries no per-field source and is not shown) — and then
 * which lines link a Glottolog record to compare them by — or that
 * get_language fetches name-only entries.
 */
function tellApart(langs) {
  const cited = (l) => !l.lean && (l.where?.facts ?? []).some((f) => f.sources?.length);
  if (langs.some(cited)) return 'Where each is spoken (the indented lines) tells them apart';
  const full = langs.filter((l) => !l.lean);
  const linked = full.filter((l) => glottologRecordUrl(l.glottocode)).length;
  const records = linked === 0 ? ''
    : `${linked === langs.length ? 'each line' : `${linked} of the lines`} links the language's Glottolog record `
      + 'by its glottocode, to compare them at the source';
  const withheld = full.filter((l) => (l.where?.facts ?? []).length);
  if (withheld.length) {
    const projection = withheld.every((l) => l.tier === 'published' && !l.publishedStamps);
    return 'nothing cited here tells them apart (their locations '
      + (projection ? 'carry no per-field source in the published card projection'
        : 'carry no source on these cards')
      + ', so they are not shown)'
      + (records ? `; ${records},` : ' —')
      + ' and the community knows which variety it speaks';
  }
  return records ? `get_language on each shows what its card cites, and ${records}`
    : 'get_language on each shows what its card cites';
}

/**
 * The recorded name a query matched when it is NOT the displayed name or
 * endonym (another registry's name, a second endonym) — said on the result
 * line with its source, so "nêhiyawêwin → cre" is visibly a match on the
 * endonym Wikidata records, not a guess. When no recorded name matched but a
 * converter-read form did, that is returned as `{ derived }` — "nêhiyawêwin →
 * crk" is said to be champollion's reading of ᓀᐦᐃᔭᐍᐏᐣ, never a source's.
 */
function matchedRecordedName(lang, query) {
  const q = normalizeForMatch(query);
  if (!q) return null;
  const shown = new Set([lang.name, lang.endonym].filter(Boolean).map(normalizeForMatch));
  if (shown.has(q)) return null;
  for (const n of lang.names ?? []) {
    const t = normalizeForMatch(n.text);
    // The displayed name itself, as a registry records it, is not "another"
    // name ("Cree" in Plains Cree once read "matched its name in another
    // registry "Plains Cree"").
    if (shown.has(t)) continue;
    if (t === q || t.split(' ').includes(q)) return n;
  }
  // Only when nothing the card records contains the query: an alias or the
  // displayed name matching (a word of) it is the better-evidenced match.
  const recordedHit = [lang.name, lang.endonym, ...(Array.isArray(lang.aliases) ? lang.aliases : [])]
    .filter((x) => typeof x === 'string').map(normalizeForMatch)
    .some((t) => t === q || t.split(' ').includes(q));
  if (recordedHit) return null;
  for (const d of lang.derivedNames ?? []) {
    const t = normalizeForMatch(d.text);
    if (t === q || t.split(' ').includes(q)) return { derived: d };
  }
  return null;
}

/** "the endonym "X" [src]" / a derived form's note — what a match was on. */
function matchedVia(via, lang) {
  if (via.derived) return `matched "${via.derived.text}" — ${derivedNameNote(via.derived)}`;
  const what = via.field === 'name' ? 'name in another registry'
    : via.field === 'alternate' ? 'alternate name' : 'endonym';
  return `matched its ${what} "${via.text}" [${via.source || unstampedLabel(lang)}]`;
}

/**
 * The search_languages answer text.
 *
 * Every full result is two lines: code, name, family, speakers (and, for an
 * approximate match, what it matched); then where the language is spoken and
 * its other names, each with its source. When several names tie at the same
 * distance the header says so: picking between them is the user's call, and
 * the location line is what they pick by.
 *
 * @param {object} found  findLanguages() result.
 * @param {string} query
 * @param {object} [extra]  materializeLean() result.
 * @returns {string}
 */
export function formatSearchAnswer(found, query, { upgraded = new Map(), unresolved = new Map() } = {}) {
  if (found.match === 'none') {
    return `No language matches "${query}", even approximately. Try another `
      + 'spelling, the endonym, or an ISO 639-3 code. (Names in this index come '
      + 'from ISO 639-3, Glottolog and LinguaMeta; a community\'s own name for its '
      + 'language may not be recorded yet.)';
  }
  const view = (lang) => upgraded.get(lang.code) ?? lang;
  const members = found.members ?? new Map();
  const linesFor = (raw, suffix = '') => {
    const lang = view(raw);
    const via = !suffix ? matchedRecordedName(lang, query) : null;
    const viaText = via ? `  ← ${matchedVia(via, lang)}` : '';
    if (lang.lean) {
      // A name-only entry found through another of its names says which, and
      // cites it (the manifest keeps each name's source).
      const why = unresolved.get(lang.code);
      return [`${lang.code}  ${lang.name}  — name-only entry in this install's bundled `
        + `index${why ? ` (${why})` : ''}; get_language ${lang.code} fetches the full cited card${suffix}${viaText}`];
    }
    const head = `${lang.code}  ${lang.name}${lang.endonym ? `  ${lang.endonym}` : ''}  ${factsOf(lang)}${suffix}${viaText}`;
    const detail = detailOf(lang, members.get(lang.code));
    return detail ? [head, `     ${detail}`] : [head];
  };

  let head;
  const lines = [];
  if (found.match === 'fuzzy') {
    const example = found.fuzzy.find((h) => h.starts?.length)?.starts[0];
    head = `No exact match for "${query}" — closest names (edit distance; a swapped `
      + `letter pair counts ${TRANSPOSITION_COST}`
      + (example ? `; a query word that only begins a longer word of the name ("${example.query}" of `
        + `"${example.word}") counts no edit, and ranks after a name matched as typed at the same distance` : '')
      + '):';
    const scored = found.fuzzy.filter((h) => h.distance !== null && h.distance !== undefined);
    if (scored.length) {
      // found.fuzzy is ranked: the first scored hit is the best key.
      const top = scored[0];
      const tied = scored.filter((h) => h.distance === top.distance
        && (h.starts?.length ?? 0) === (top.starts?.length ?? 0)).map((h) => view(h.lang));
      if (tied.length > 1) {
        head += `\n${tied.length} names are equally close (distance ${top.distance}`
          + `${top.starts?.length ? ', each with a word only begun' : ''}). `
          + tellApart(tied) + '; confirm the right one with the user.';
      }
    }
    const queryWords = normalizeForMatch(query).split(' ').filter(Boolean).length;
    for (const h of found.fuzzy) {
      const others = queryWords - (h.starts?.length ?? 0);
      const begun = h.starts?.length
        ? ` — ${h.starts.map((s) => `"${s.query}" begins its word "${s.word}"`).join(', ')}; `
          + `the other word${others === 1 ? '' : 's'} at`
        : ',';
      const how = h.distance === null || h.distance === undefined
        ? 'contains the query inside a word'
        : `"${h.matched}"${h.derived ? ` (${derivedNameNote(h.derived)})`
          : h.field !== 'name' ? ` (${h.field}${h.source ? ` [${h.source}]` : ''})` : ''}${begun} distance ${h.distance}`;
      lines.push(...linesFor(h.lang, `  ← ${how}`));
    }
  } else if (found.match === 'partial') {
    const hits = found.partial ?? [];
    head = `No language matches "${query}" as a whole — these match parts of it, ranked by how many `
      + 'of its words a whole recorded name (or code) covers, then by the words they share with it:';
    const tied = hits.filter((h) => sameStrength(h, hits[0]));
    const tiedTotal = Math.max(found.partialTied ?? 0, tied.length);
    if (tiedTotal > 1) {
      head += `\n${tiedTotal} languages match it equally`
        + (tiedTotal > tied.length ? ` (the first ${tied.length} are shown; a more specific query narrows them)` : '')
        + '. '
        + tellApart(tied.map((h) => view(h.lang)))
        + '; confirm the right one with the user.';
    }
    for (const h of hits) {
      const names = h.matched.map((m) => `"${m.text}"${m.field === 'name' ? ''
        : m.field === 'code' ? ' (code)'
          : m.derived ? ` (${derivedNameNote(m.derived)})`
            : ` (${m.field}${m.source ? ` [${m.source}]` : ''})`}`);
      const shared = h.words.length
        ? `shares the word${h.words.length > 1 ? 's' : ''} ${h.words.map((w) => `"${w}"`).join(', ')}`
        : '';
      const how = [names.join(' + '), shared].filter(Boolean).join('; ');
      lines.push(...linesFor(h.lang, `  ← ${how} — ${h.covered} of ${h.of} words`));
    }
  } else {
    head = `Found ${count(found.results.length, 'language')}:`;
    for (const l of found.results) lines.push(...linesFor(l));
  }

  const notes = [];
  const published = [...upgraded.values()].filter((e) => e.tier === 'published');
  if (published.length) {
    notes.push('Name-only results were filled in from champollion.dev\'s published card '
      + 'tables (now cached in ~/.champollion/cards).'
      + (published.some((e) => !e.publishedStamps)
        ? ' The full cards cite a source for every fact, but rows uploaded before those tables '
          + 'carried per-field sources do not have them (they arrive with the tables\' next upload): '
          + 'a location or other name such a row lists is not shown, the line says so, and it links '
          + 'the language\'s Glottolog record where the card carries a glottocode — it is not a fact '
          + 'without a source.'
        : ''));
  }
  return `${head}\n\n${lines.join('\n')}\n\n${notes.length ? `${notes.join('\n')}\n\n` : ''}`
    + 'Next: get_language { "code": "<code>" } for the full cited card, or '
    + 'language_overview { "code": "<code>" } for what exists and how to start.';
}
