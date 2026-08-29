/**
 * Language card registry — structured language metadata and register presets.
 *
 * ARCHITECTURE (v7 — Dynamic Cards):
 *
 *   Each language has a single card containing ALL metadata: runtime
 *   fields (code, registers, formality, methodSupport, rules) AND
 *   reference data (linguisticChallenges, encyclopedic, resources,
 *   typology, vitality). Cards come from three tiers:
 *
 *   1. REPO MODE — shared/language-cards/<code>.json exists (git
 *      checkout): every card is loaded eagerly at module init, exactly
 *      as in v6. No network is ever touched. Tests run in this mode.
 *
 *   2. PACKAGED MODE — the npm tarball excludes the ~72 MB card
 *      directory and ships shared/cards-fallback.json instead (core
 *      languages + all genera/ parents + a full code/alias manifest,
 *      built by scripts/build-cards-fallback.mjs). Core languages work
 *      offline. Long-tail lookups are served from the per-user cache
 *      (~/.champollion/cards/) and, on a miss, fetched synchronously
 *      from the production Supabase trading-card tables (read-only
 *      anon key) via a child process — see lib/cards/. Cached entries
 *      are invalidated by per-language updated_at (lib/cards/refresh.js,
 *      run by bin/cli.js at most once per day). Set CHAMPOLLION_OFFLINE=1
 *      to disable all network use.
 *
 *   3. Genus/family/macrolanguage abstract cards ship in both modes;
 *      language cards use "extends" to inherit from them, including
 *      cards loaded from the cache or the network.
 *
 *   ADDING A NEW LANGUAGE:
 *     1. Create shared/language-cards/<code>.json (all fields)
 *     2. Research the language's formality system and write register presets
 *     3. Validate against shared/schemas/language-card.schema.json
 *     4. Add eval dataset references if available
 *     5. Regenerate the bundle: node scripts/build-cards-fallback.mjs
 *
 * BACKWARD COMPATIBILITY:
 *   DEFAULT_REGISTERS is still exported as a backward-compatible proxy.
 *   It returns the same shape as the old flat dictionary ({ name, register,
 *   dir?, scripts? }) so existing consumers don't break during migration.
 *   New code should use getLanguageCard() and getRegister() instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { CARDS_DIR, FALLBACK_FILE, OFFLINE, isValidCardCode } from './cards/env.js';
import {
  readCachedCard,
  writeCachedCard,
  listCachedCodes,
  readState,
  inBackoff,
  isTombstoned,
  tombstone,
  noteNetworkFailure,
} from './cards/cache.js';
import { fetchRemoteCard } from './cards/remote.js';
import { normalizeCard } from './cards/reader.js';

// -----------------------------------------------------------------
// Card loading — full directory (repo) or bundled fallback (package)
// -----------------------------------------------------------------

/** Child script used for synchronous fetches (see _tryFetchRemoteSync). */
const FETCH_CHILD = path.join(import.meta.dirname, 'cards', 'fetch-card-child.js');

// NOTE: The former REFERENCE_DIR and reference tier (shared/language-reference/)
// has been merged into the runtime cards (v6 architecture). All data is now
// in shared/language-cards/. The REFERENCE_DIR export is kept temporarily
// for backward compatibility but points nowhere.
const REFERENCE_DIR = null;

/**
 * In-memory registry of all loaded language cards.
 * Keyed by primary locale code (e.g., 'fr', 'ko', 'x-pirate').
 * @type {Map<string, object>}
 */
const _cards = new Map();

/**
 * Registry of parent/abstract cards (genus and family cards in genera/).
 * Keyed by code (e.g., 'family-algonquian', 'genus-cree').
 * @type {Map<string, object>}
 */
const _parentCards = new Map();

/**
 * Alias map — alternative locale codes that resolve to a primary code.
 * e.g., 'no' → 'nb', 'iw' → 'he', 'zh-CN' → 'zh', 'fil' → 'tl'
 * Built from the `aliases` field in each language card.
 * @type {Map<string, string>}
 */
const _aliases = new Map();

/**
 * Manifest of every concrete card code in the catalogue (packaged
 * mode only — empty in repo mode). Values: { n: name, a?: aliases,
 * d?: dir }. Lets resolveCode() recognize the full catalogue without
 * materializing it, and tells the fetch path which codes exist.
 * @type {Map<string, object>}
 */
const _manifest = new Map();

/**
 * How cards were loaded:
 *   'repo'     — full shared/language-cards/ directory
 *   'packaged' — bundled fallback + cache + remote fetch
 *   'none'     — neither source available (registry empty)
 * @type {'repo'|'packaged'|'none'}
 */
let _mode = 'none';

/**
 * Codes already attempted (hit or miss) against cache/network in this
 * process — prevents repeated child spawns for the same code.
 * @type {Set<string>}
 */
const _fetchAttempted = new Set();

/**
 * Register a concrete card into the registry (shared by all tiers).
 */
function _registerCard(card) {
  _cards.set(card.code, card);
  // `codeAliases` — other CODES that resolve to this language, derived from
  // SIL's own ISO 639-1 column: a language holding Part1 'fr' is what 'fr'
  // means. This was briefly called `aliases`, which invited confusion with
  // `alternateNames` (which are NAMES: "Northern Tosk Albanian", not "sq").
  // The two were once merged by mistake and every two-letter lookup broke.
  const codeAliases = card.codeAliases ?? card.aliases;
  if (Array.isArray(codeAliases)) {
    for (const alias of codeAliases) {
      _aliases.set(alias, card.code);
    }
  }
}

/**
 * Load all language card JSON files from the cards directory (recursively).
 * Called once at module initialization. Builds both the primary
 * card registry and the alias lookup table.
 *
 * When the directory is absent (published npm package), falls back to
 * the bundled core set + manifest (shared/cards-fallback.json).
 */
function _loadCards() {
  if (!fs.existsSync(CARDS_DIR)) {
    _loadFallbackBundle();
    return;
  }
  _mode = 'repo';

  // The five x-* product locales are configuration, not languages — no source
  // will ever publish x-pirate, and under the fetch-from-source law they have
  // no place in the atlas. They are still product features users invoke, so
  // when the cards directory is the projected atlas (which contains only
  // languages), they are served from the config kernel. A live-corpus dir
  // still carries them as files and wins by being loaded later.
  _loadPromptConfig();
  for (const [code, card] of Object.entries(_cardConfig.conlangs)) {
    if (!_cards.has(code)) _cards.set(code, card);
  }

  function scan(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const resPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(resPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(resPath, 'utf-8');
          // Normalised at the ONE load site: atlas-shaped cards carry honest
          // names (endonym, textDirection, scripts[]) and attribution
          // envelopes; the 24 modules importing this registry read the legacy
          // vocabulary. The reader adapts so neither the atlas has to lie nor
          // 24 modules have to change mid-cutover. Old-shape cards pass
          // through untouched.
          const card = normalizeCard(JSON.parse(raw));

          // Data files (e.g., language-tree.json) have a _meta key and no
          // 'code' field — they are reference data, not language cards.
          // Skip them silently instead of logging a noisy warning.
          if (card._meta) continue;

          if (!card.code) {
            console.error(`[WARN] Language card ${entry.name} missing 'code' field — skipping.`);
            continue;
          }

          if (
            resPath.includes(path.sep + 'genera' + path.sep) ||
            card.code.startsWith('family-') ||
            card.code.startsWith('genus-') ||
            card.code.startsWith('macrolanguage-')
          ) {
            _parentCards.set(card.code, card);
          } else {
            _registerCard(card);
          }
        } catch (err) {
          console.error(`[WARN] Failed to load language card ${entry.name}: ${err.message}`);
        }
      }
    }
  }

  scan(CARDS_DIR);
  _applyCodeRouting();
  _loadPromptConfig();
}

/**
 * Translation-prompt CONFIGURATION, loaded once.
 *
 * A card asserts what SOURCES say about a language. What register presets to
 * offer, how to phrase gender guidance, what we call a politeness system —
 * none of that is asserted by anyone, so it lives in shared/catalogue/ and is
 * composed onto the card at read time.
 *
 * The previous corpus kept all of it ON the cards: 1,775 register blocks
 * carrying 110 distinct prompt objects, 2,404 gender blocks of which only 103
 * held anything a runtime reads. Worse, the presets were stamped
 * `source: "grambank-GB415"` — citing Grambank for text we wrote, which is why
 * config and fact became impossible to tell apart.
 *
 * Storage keeps them separate. The runtime VIEW puts them back together, so
 * consumers still see card.registers and card.formality.
 */
const _presets = { shared: {}, byLanguage: {}, assignment: {} };
/** Languages DeepL documents formality for — cite-only, from method-coverage.json. */
const _deeplFormality = new Set();
/** Per-metric pivot sets + QE models from metric-coverage.json (the register). */
const _metricCoverage = { pivots: {}, qe: {} };
/** Gate 3: authored product config, attached to the view, never cited as fact. */
const _cardConfig = { scriptConverter: {}, conlangs: {}, aliasRouting: {}, evalConfig: {} };
/** Indexed once at load: entry lists keyed by what each applies to. */
let _genderGuidance = { family: new Map(), language: new Map() };

/**
 * Where the prompt config lives, in both layouts.
 *
 * In the repo it is `shared/catalogue/` at the monorepo root. In a PUBLISHED
 * package there is no monorepo root — npm ships `cli/shared/`, so the same
 * files arrive one level up from `lib/`. Reading only the repo path meant a
 * published install found nothing, and the catch below turned that into
 * silence: every language lost its formality system and register prompts, and
 * `champollion` translated German with no notion of Sie versus du.
 *
 * Both are tried, packaged first, because that is the layout a user has.
 */
const _CONFIG_DIRS = [
  path.join(import.meta.dirname, '..', 'shared', 'catalogue'),
  path.join(import.meta.dirname, '..', '..', 'shared', 'catalogue'),
];

/** Read a config file from whichever layout has it. Returns null if neither. */
function _readConfig(name) {
  for (const dir of _CONFIG_DIRS) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
    } catch { /* try the next layout */ }
  }
  return null;
}

/** Config files that were looked for and not found — reported, never silent. */
export const missingPromptConfig = [];

function _loadPromptConfig() {
  {
    const p = _readConfig('register-presets.json');
    if (p) {
      Object.assign(_presets, {
        shared: p.shared ?? {}, byLanguage: p.byLanguage ?? {}, assignment: p.assignment ?? {},
      });
    } else {
      // Not fatal — a partial checkout is legitimate and cards still work —
      // but recorded, so `champollion doctor` and the tests can see that this
      // install has no register prompts rather than inferring that no
      // language has a politeness system.
      missingPromptConfig.push('register-presets.json');
    }
  }
  {
    const cc = _readConfig('card-config.json');
    if (cc) {
      Object.assign(_cardConfig.scriptConverter, cc.scriptConverter ?? {});
      Object.assign(_cardConfig.conlangs, cc.conlangs ?? {});
      for (const [k, v] of Object.entries(cc.aliasRouting ?? {})) {
        if (!k.startsWith('_')) _cardConfig.aliasRouting[k] = v;
      }
      // Per-language eval wiring (evalStandard/evalMetrics/evalPack/
      // evalDatasets) — CONFIG, ours, attached at read time exactly like the
      // Python twin's _eval_config_for. The atlas deliberately does not
      // project these (they are wiring, not facts about a language), and the
      // JS seam never picked them up, so `champollion card crk` lost its eval
      // section and build-metric-pops' seal check stopped loud at the gap.
      for (const [k, v] of Object.entries(cc.evalConfig ?? {})) {
        if (!k.startsWith('_')) _cardConfig.evalConfig[k] = v;
      }
    } else {
      missingPromptConfig.push('card-config.json');
    }
  }
  {
    // DeepL's formality support is a METHOD capability — whether the service
    // accepts a formality argument for a language — and is deliberately read
    // from method coverage rather than from anything on the language card.
    const mc = _readConfig('method-coverage.json');
    if (mc) {
      const dl = (mc.methods ?? []).find((m) => m.key === 'deepl');
      for (const code of dl?.formalityIso6393 ?? []) _deeplFormality.add(code);
    } else {
      missingPromptConfig.push('method-coverage.json');
    }
  }
  {
    // metric-coverage.json is the register behind the metricModelSupport
    // flattening below: which listed codes are a publisher's PIVOTS (in the
    // list as pass-through languages, never targets) and which metric has a
    // QE checkpoint. Python twin: _metric_pivots() / _metric_qe_models().
    const mcov = _readConfig('metric-coverage.json');
    if (mcov) {
      for (const m of mcov.models ?? []) {
        _metricCoverage.pivots[m.key] = new Set(m.pivots ?? []);
        if (m.qeModel) _metricCoverage.qe[m.key] = m.qeModel;
      }
    } else {
      missingPromptConfig.push('metric-coverage.json');
    }
  }
  {
    const g = _readConfig('gender-guidance.json');
    if (!g) {
      missingPromptConfig.push('gender-guidance.json');
      _genderGuidance = { family: new Map(), language: new Map() };
      return;
    }
    const family = new Map();
    const language = new Map();
    for (const e of g.entries ?? []) {
      // Genus entries are carried but not applied: a genus sits below a family
      // and needs a subgroup match against the ancestry chain, not a name
      // lookup. `applied: false` keeps the gap visible instead of silent.
      if (e.scope === 'genus' || e.applied === false) continue;
      const target = e.scope === 'language' ? language : family;
      for (const key of e.appliesTo ?? []) target.set(key, e.guidance);
    }
    _genderGuidance = { family, language };
  }
}

/**
 * Gender guidance for a language: its own if someone wrote one, otherwise its
 * family's.
 *
 * "Bantu languages use noun class systems" is a statement about the FAMILY. It
 * is true and it is useful prompt text, and it is not a fact about any one
 * language — so it is stored once per family and resolved here, rather than
 * copied onto 3,469 cards the way hub inheritance used to do it.
 *
 * The family is ATTRIBUTED: Glottolog and WALS are separate taxonomies that
 * disagree on 905 cards (Atlantic-Congo vs Niger-Congo, and so on). Both names
 * are tried, because guidance written against one taxonomy's name should not
 * vanish because the other is listed first.
 */
function _genderGuidanceFor(card) {
  const own = _genderGuidance.language.get(card.code);
  if (own) return own;
  const fam = card.classification?.family;
  const names = fam?.values ? fam.values.map((v) => v.value) : (fam ? [fam] : []);
  for (const n of names) {
    const hit = _genderGuidance.family.get(n);
    if (hit) return hit;
  }
  return null;
}

/** The preset for a language, from either the bespoke set or a shared one. */
function _presetFor(code) {
  return _presets.byLanguage[code]
    ?? _presets.shared[_presets.assignment[code]]
    ?? null;
}

/**
 * Compose the runtime view: facts from the card, prompts from the config.
 *
 * A card that already carries `registers` keeps them — during migration the
 * live corpus still does, and a card's own values must not be silently
 * replaced by config. Once cutover lands, only the config path is live.
 */
function _withPromptConfig(card) {
  if (!card) return card;
  const preset = _presetFor(card.code);
  const guidance = _genderGuidanceFor(card);

  const view = { ...card };
  // ── Migration seam, removed at cutover ────────────────────────────────────
  // The live corpus still carries plural categories at rules.plurals.categories
  // and text direction as `dir`. The projected corpus carries them as the
  // sourced parameters pluralCategories and textDirection. Consumers read the
  // NEW names; this maps a legacy card forward so the two corpora can be tested
  // against the same code without either being broken.
  //
  // ONE mapping, in ONE place, with an end date — not a compatibility layer
  // threaded through the consumers.
  if (!view.pluralCategories && Array.isArray(view.rules?.plurals?.categories)) {
    view.pluralCategories = view.rules.plurals.categories;
  }
  if (!view.textDirection && view.dir === 'rtl') view.textDirection = 'right-to-left';

  // Eval wiring from card-config.json (Python twin: _eval_config_for +
  // setdefault). A card's own values are never replaced — config fills only
  // what the card does not carry.
  const evalWiring = _cardConfig.evalConfig[view.code];
  if (evalWiring) {
    for (const [k, v] of Object.entries(evalWiring)) {
      if (view[k] === undefined) view[k] = v;
    }
  }

  // The atlas projects methodSupport as EVIDENCE — {total, byTier, named[]} —
  // because English attracts 5,420 model-card claims and a flat map of those
  // is a log, not an index. The runtime's consumers ask a smaller question:
  // "does this SERVICE cover this language, and does DeepL do formality here?"
  // Service entries are named in full, above the projection cap, precisely so
  // that absence answers that question honestly. This synthesizes the legacy
  // map from them; the evidence stays on the card as methodSupportEvidence.
  if (view.methodSupport && Array.isArray(view.methodSupport.named)) {
    const LEGACY_KEYS = {
      'google-translate': 'googleTranslate',
      deepl: 'deepl',
      'microsoft-translator': 'microsoftTranslator',
      libretranslate: 'libreTranslate',
      apertium: 'apertium',
    };
    const flat = {};
    for (const key of Object.values(LEGACY_KEYS)) flat[key] = { supported: false };
    for (const n of view.methodSupport.named) {
      const legacy = LEGACY_KEYS[n.variant];
      if (legacy && n.value === 'service') flat[legacy] = { supported: true };
    }
    flat.deepl.formality = flat.deepl.supported && _deeplFormality.has(view.code);
    // The LLM lane is not list-based coverage: the method registry declares
    // the adapters, and their coverage is open-ended by construction — an LLM
    // will ATTEMPT any language, which is a fact about the method's shape,
    // not a per-language claim anyone fetched. Quality is the leaderboard's
    // question, never this flag's.
    flat.llm = { supported: true };
    view.methodSupportEvidence = view.methodSupport;
    view.methodSupport = flat;
  }

  // metricModelSupport: same adaptation, twin of the Python adapter's block.
  // The atlas records "which metric model lists this language" as attributed
  // values with a metric variant; the runtime reads a flat map. xlmr membership
  // IS the high tier — the paper publishes the list, not per-language scores
  // (tierMeaning on the register entry). A publisher's PIVOTS (eng/fra for
  // AfriCOMET) are in the list as the languages pairs run through, not as
  // targets — the register marks them; treating a pivot as a target would
  // recommend africomet for French.
  const mms = view.metricModelSupport;
  if (mms && typeof mms === 'object' && Array.isArray(mms.values)) {
    const flatM = {};
    const code3 = view.iso639_3 ?? view.code;
    for (const v of mms.values) {
      const variant = v?.variant;
      if (!variant) continue;
      if (variant === 'xlmr') {
        flatM[variant] = { tier: 'high', model: v.value };
      } else {
        const pivots = _metricCoverage.pivots[variant] ?? new Set();
        flatM[variant] = { supported: !pivots.has(code3), model: v.value };
        if (pivots.has(code3)) flatM[variant].pivot = true;
        if (variant === 'africomet' && _metricCoverage.qe[variant]) {
          flatM.qe = { ...flatM[variant], model: _metricCoverage.qe[variant] };
        }
      }
    }
    view.metricModelSupport = flatM;
  }

  if (preset && !view.registers) {
    view.registers = preset.registers;
    view.formality = {
      ...(view.formality ?? {}),
      ...(preset.system ? { system: preset.system } : {}),
      ...(preset.default ? { default: preset.default } : {}),
    };
  }
  if (guidance) view.gender = { ...(view.gender ?? {}), inclusiveGuidance: guidance };
  // Gate 3: the converter key is OUR choice of which script conversion the CLI
  // performs for a locale — product config, not a fact about the language, so
  // it rides the view from the config kernel and is never cited.
  if (!view.scriptConverter && _cardConfig.scriptConverter[view.code]) {
    view.scriptConverter = _cardConfig.scriptConverter[view.code];
  }
  return view;
}

/**
 * Route codes that do not identify ONE language.
 *
 * `fr` unambiguously means French, and that alias comes off the card itself.
 * `zh` does not mean one language — it names the Chinese macrolanguage — and
 * deciding it should reach Mandarin is a CHOICE. Those choices live in
 * shared/catalogue/code-routing.json with their rationale, not on a card,
 * because "when someone types zh, give them Mandarin" is not something
 * Glottolog or SIL says and putting it on a card would dress our decision up
 * as an upstream fact.
 *
 * Card-derived aliases win: a real language holding an ISO 639-1 code is never
 * overridden by a routing preference.
 */
function _applyCodeRouting() {
  const file = path.join(
    import.meta.dirname, '..', '..', 'shared', 'catalogue', 'code-routing.json',
  );
  if (!fs.existsSync(file)) return;
  let routes;
  try {
    ({ routes } = JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (err) {
    console.error(`[WARN] code-routing.json is unreadable: ${err.message}`);
    return;
  }
  for (const [from, route] of Object.entries(routes ?? {})) {
    if (_aliases.has(from) || _cards.has(from)) continue;
    if (_cards.has(route?.to)) _aliases.set(from, route.to);
  }

  // Config ROUTING decisions override derived aliases. ISO maps `no` to the
  // macrolanguage nor; the product routes it to nob, a recorded decision in
  // card-config.json with its reasoning — so it must win over the alias the
  // registries would derive, or the decision silently loses to the derivation.
  for (const [from, to] of Object.entries(_cardConfig.aliasRouting)) {
    if (_cards.has(to)) _aliases.set(from, to);
  }
}

/**
 * Packaged mode: load the bundled fallback (core cards + parents +
 * full manifest) produced by scripts/build-cards-fallback.mjs.
 */
function _loadFallbackBundle() {
  // PACKAGED MODE NEEDS THE PROMPT CONFIG TOO — and used not to load it.
  //
  // _loadCards() called _loadPromptConfig() only on the repo branch, so the
  // one mode every published user actually runs in loaded no register presets
  // at all. Formality systems, register prompts, script converters and the
  // conlang locales were all absent, silently, for everyone who installed from
  // npm — while every test passed, because tests run in repo mode.
  //
  // Loaded first, so the conlang locales below can come from the config kernel
  // exactly as they do in repo mode.
  _loadPromptConfig();
  for (const [code, card] of Object.entries(_cardConfig.conlangs)) {
    if (!_cards.has(code)) _cards.set(code, card);
  }

  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));
  } catch {
    return; // _mode stays 'none' — registry is empty, same as v6 without cards
  }

  for (const card of Object.values(bundle.parents || {})) {
    if (card?.code) _parentCards.set(card.code, card);
  }
  for (const card of Object.values(bundle.cards || {})) {
    if (card?.code) _registerCard(card);
  }
  for (const [code, entry] of Object.entries(bundle.manifest || {})) {
    _manifest.set(code, entry);
    // Manifest aliases cover the whole catalogue, so 'fr'-style lookups
    // resolve even for languages that aren't materialized locally yet.
    if (Array.isArray(entry.a)) {
      for (const alias of entry.a) {
        if (!_aliases.has(alias)) _aliases.set(alias, code);
      }
    }
  }
  _mode = 'packaged';
}

// Load cards at module initialization
_loadCards();

// -----------------------------------------------------------------
// Dynamic tier (packaged mode) — per-user cache + remote fetch
// -----------------------------------------------------------------

/**
 * Try to materialize a card that isn't bundled: first from the
 * per-user cache (~/.champollion/cards/), then via a synchronous
 * network fetch. Registers the card on success.
 *
 * @param {string} code - already-resolved primary code
 * @returns {boolean} true when the card is now in _cards
 */
function _loadDynamicCard(code) {
  if (!isValidCardCode(code)) return false;

  const cached = readCachedCard(code);
  if (cached) {
    _registerCard(cached.card);
    return true;
  }

  const fetched = _tryFetchRemoteSync(code);
  if (fetched) {
    _registerCard(fetched);
    return true;
  }
  return false;
}

/**
 * Synchronous remote fetch via a short-lived child process (Node has
 * no synchronous HTTP, and getLanguageCard() is part of the stable
 * synchronous API). Guarded so it runs at most once per code per
 * process, never when offline, never inside the failure backoff
 * window, and never for codes prod has confirmed it doesn't have.
 *
 * @returns {object|null} the fetched card, or null
 */
function _tryFetchRemoteSync(code) {
  if (OFFLINE) return null;
  if (_fetchAttempted.has(code)) return null;
  _fetchAttempted.add(code);

  const state = readState();
  if (inBackoff(state) || isTombstoned(code, state)) return null;

  const aliases = _manifest.get(code)?.a;
  let stdout;
  try {
    stdout = execFileSync(
      process.execPath,
      [FETCH_CHILD, code, aliases ? JSON.stringify(aliases) : ''],
      {
        encoding: 'utf-8',
        timeout: 20000,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    noteNetworkFailure();
    return null;
  }

  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    return null;
  }

  if (!result.ok) {
    noteNetworkFailure();
    return null;
  }
  if (result.missing) {
    tombstone(code);
    return null;
  }

  writeCachedCard(code, result.card, result.updatedAt);
  return result.card;
}

/**
 * Prefetch cards for a set of locale codes into the per-user cache
 * (packaged mode; repo mode is a no-op since everything is local).
 *
 * Async batch alternative to the per-miss synchronous fetch — call it
 * up front (e.g. before a sync run over many target locales) to warm
 * the cache in one pass. Network failures are reported, not thrown.
 *
 * @param {string[]} codes - locale codes (aliases are resolved)
 * @returns {Promise<{fetched: string[], missing: string[], failed: string[], skipped: string[]}>}
 */
async function prefetchLanguageCards(codes) {
  const result = { fetched: [], missing: [], failed: [], skipped: [] };
  if (_mode !== 'packaged' || OFFLINE || !Array.isArray(codes)) {
    result.skipped = Array.isArray(codes) ? [...codes] : [];
    return result;
  }

  for (const input of codes) {
    const code = resolveCode(input);
    if (!isValidCardCode(code) || _cards.has(code) || readCachedCard(code)) {
      result.skipped.push(input);
      continue;
    }
    try {
      const remote = await fetchRemoteCard(code, { aliases: _manifest.get(code)?.a });
      if (remote.missing) {
        tombstone(code);
        result.missing.push(code);
      } else {
        writeCachedCard(code, remote.card, remote.updatedAt);
        _registerCard(remote.card);
        result.fetched.push(code);
      }
    } catch {
      noteNetworkFailure();
      result.failed.push(code);
    }
  }
  return result;
}

/**
 * Where cards are coming from in this process — for doctor output,
 * debugging, and tests.
 */
function getCardSourceInfo() {
  return {
    mode: _mode,
    loadedCards: _cards.size,
    parentCards: _parentCards.size,
    manifestEntries: _manifest.size,
    cachedCards: _mode === 'packaged' ? listCachedCodes().length : 0,
  };
}

// -----------------------------------------------------------------
// Public API — accessor functions for language cards and registers
// -----------------------------------------------------------------

/**
 * Resolve a locale code to its primary ISO 639-3 code, following aliases.
 *
 * Handles:
 *   - Direct match: 'fra' → 'fra'
 *   - Alias: 'fr' → 'fra', 'no' → 'nob', 'iw' → 'heb'
 *   - Base locale fallback: 'deu-AT' → 'deu' (base)
 *
 * @param {string} code - Locale code to resolve
 * @returns {string} Resolved primary code (ISO 639-3)
 */
function resolveCode(code) {
  // Direct match
  if (_cards.has(code)) return code;

  // Alias match
  if (_aliases.has(code)) return _aliases.get(code);

  // Manifest match (packaged mode) — the code is a known primary code
  // even though its card isn't materialized locally yet
  if (_manifest.has(code)) return code;

  // Base locale fallback — try stripping region (e.g., 'de-AT' → 'de')
  const baseParts = code.split('-');
  if (baseParts.length > 1) {
    const baseCode = baseParts[0];
    if (_cards.has(baseCode)) return baseCode;
    if (_aliases.has(baseCode)) return _aliases.get(baseCode);
    if (_manifest.has(baseCode)) return baseCode;
  }

  // No match found — return original code (will get null from getLanguageCard)
  return code;
}

/**
 * Deep merge two card objects (child overrides parent).
 *
 * Semantics:
 *   - null in child → inherit from parent (don't override)
 *   - non-null in child → override parent
 *   - objects merge recursively (child fields override, parent fields kept)
 *   - arrays in child replace parent arrays entirely
 *   - identity fields (code, extends, _migration) are never inherited from parent
 *   - hub-only fields (members, supportTier, taxonomyNotes) are never
 *     inherited from parent: genera/macrolanguage hub cards double as
 *     `extends` templates for their member cards, but those fields
 *     describe the hub itself (see derive-taxonomy-fields.mjs header +
 *     docs/LANGUAGE_TAXONOMY.md) — e.g. arz must not surface ara's
 *     members[] when runtime-resolved
 */
const _IDENTITY_FIELDS = new Set(['code', 'extends', '_migration', 'aliases', 'iso639_1', 'iso639_3']);
const _NON_INHERITED_FIELDS = new Set(['members', 'supportTier', 'taxonomyNotes']);

function _deepMerge(parent, child) {
  if (!parent) return child || {};
  if (!child) return parent || {};

  const result = { ...parent };
  // Top-level card merges only (cards carry `code`; nested objects don't):
  // drop hub-only fields coming from the parent. The child's own values,
  // if any, are re-applied by the merge loop below.
  if (Object.prototype.hasOwnProperty.call(parent, 'code')) {
    for (const key of _NON_INHERITED_FIELDS) delete result[key];
  }

  for (const [key, value] of Object.entries(child)) {
    // Identity fields: always use child's value (even if null)
    if (_IDENTITY_FIELDS.has(key)) {
      result[key] = value;
      continue;
    }

    // Null in child means "I don't define this" → inherit from parent
    if (value === null || value === undefined) {
      continue;
    }

    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      parent[key] &&
      typeof parent[key] === 'object' &&
      !Array.isArray(parent[key])
    ) {
      result[key] = _deepMerge(parent[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * In-memory cache of fully resolved/merged language cards.
 * Keyed by primary locale code.
 * @type {Map<string, object>}
 */
const _resolvedCards = new Map();

/**
 * Get the full language card for a locale code.
 *
 * Follows aliases and falls back to base locale. Returns null if
 * no card exists for this language.
 *
 * Resolves inheritance chains recursively if the 'extends' property is set.
 *
 * @param {string} code - Locale code (e.g., 'fr', 'ko', 'no', 'fr-CA')
 * @returns {object|null} Complete language card, or null
 */
function getLanguageCard(code) {
  // First check parents (no alias/base resolution needed for parent cards)
  if (_parentCards.has(code)) {
    if (_resolvedCards.has(code)) {
      return _resolvedCards.get(code);
    }
    const rawCard = _parentCards.get(code);
    let resolvedCard = rawCard;
    if (rawCard.extends) {
      const parentCard = getLanguageCard(rawCard.extends);
      if (parentCard) {
        resolvedCard = _deepMerge(parentCard, rawCard);
      }
    }
    const composed = _withPromptConfig(resolvedCard);
    _resolvedCards.set(code, composed);
    return composed;
  }

  const resolved = resolveCode(code);
  if (!_cards.has(resolved)) {
    // Packaged mode: try the per-user cache, then a synchronous remote
    // fetch. Both register the card into _cards on success.
    if (_mode !== 'packaged' || !_loadDynamicCard(resolved)) return null;
  }

  if (_resolvedCards.has(resolved)) {
    return _resolvedCards.get(resolved);
  }

  const rawCard = _cards.get(resolved);
  let resolvedCard = rawCard;

  if (rawCard.extends) {
    const parentCard = getLanguageCard(rawCard.extends);
    if (parentCard) {
      resolvedCard = _deepMerge(parentCard, rawCard);
    } else {
      console.error(`[WARN] Language card '${resolved}' extends unknown card '${rawCard.extends}'.`);
    }
  }

  // Facts from the card, prompts from shared/catalogue/. Composed once and
  // cached, so consumers see one object and never learn that two files exist.
  const composed = _withPromptConfig(resolvedCard);
  _resolvedCards.set(resolved, composed);
  return composed;
}

/**
 * Get the active register prompt text for a locale.
 *
 * Resolution order:
 *   1. If presetOrCustom matches a preset key in the card → use that preset's prompt
 *   2. If presetOrCustom is a non-empty string that doesn't match a preset → treat as custom text
 *   3. If presetOrCustom is null/undefined → use the card's default preset
 *   4. If no card exists → return generic fallback
 *
 * @param {string} code - Locale code
 * @param {string|null} [presetOrCustom] - Preset name (e.g., 'formal-vous') or custom register text
 * @returns {string} Register prompt text
 */

/** Fallback register text when no card or preset provides one. */
const DEFAULT_REGISTER_FALLBACK = 'Professional register.';

function getRegister(code, presetOrCustom) {
  const card = getLanguageCard(code);

  if (!card) {
    // No card — return custom text if provided, or generic fallback
    return presetOrCustom || DEFAULT_REGISTER_FALLBACK;
  }

  // Guard: cards without register presets (e.g., ISO 639-3 stubs from
  // the expanded language-cards directory) should fall through gracefully
  // instead of crashing on Object.keys(null).
  if (!card.registers) {
    return presetOrCustom || DEFAULT_REGISTER_FALLBACK;
  }

  // No user override — use card's default preset
  if (!presetOrCustom) {
    const defaultKey = card.formality?.default || Object.keys(card.registers)[0];
    return card.registers[defaultKey]?.prompt || DEFAULT_REGISTER_FALLBACK;
  }

  // Check if it's a preset name
  if (card.registers[presetOrCustom]) {
    return card.registers[presetOrCustom].prompt;
  }

  // Not a preset name — treat as custom register text (pass-through)
  return presetOrCustom;
}

/**
 * Get all available register presets for a locale.
 *
 * Returns an array of { key, label, description, prompt, isDefault } objects
 * for use in the CLI wizard and status display.
 *
 * @param {string} code - Locale code
 * @returns {Array<{ key: string, label: string, description: string, prompt: string, isDefault: boolean }>}
 */
function getRegisterPresets(code) {
  const card = getLanguageCard(code);
  if (!card || !card.registers) return [];

  const defaultKey = card.formality?.default || Object.keys(card.registers)[0];

  return Object.entries(card.registers).map(([key, preset]) => ({
    key,
    label: preset.label,
    description: preset.description,
    prompt: preset.prompt,
    isDefault: key === defaultKey,
  }));
}

/**
 * Get structured formality metadata for a locale.
 *
 * Used by DeepL and other methods that need to know the formality level
 * without parsing register text strings. Returns the default formality
 * level (e.g., 'formal', 'polite', 'neutral') or null.
 *
 * @param {string} code - Locale code
 * @param {string|null} [presetOrCustom] - Active preset name or custom text
 * @returns {{ system: string, level: string, description: string }|null}
 */
function getFormality(code, presetOrCustom) {
  const card = getLanguageCard(code);
  if (!card || !card.formality) return null;

  // Determine which preset is active
  const activeKey = (presetOrCustom && card.registers[presetOrCustom])
    ? presetOrCustom
    : card.formality.default;

  return {
    system: card.formality.system,
    level: activeKey,
    description: card.formality.description,
  };
}

/**
 * Get gender-inclusive guidance for a locale.
 *
 * Separate from register so it can be appended to any register preset
 * without duplication.
 *
 * @param {string} code - Locale code
 * @returns {string|null} Gender-inclusive guidance text, or null
 */
function getGenderGuidance(code) {
  const card = getLanguageCard(code);
  return card?.gender?.inclusiveGuidance || null;
}

/**
 * Get all loaded language codes (primary, not aliases).
 *
 * Repo mode: every card in shared/language-cards/ (the full catalogue).
 * Packaged mode: bundled core cards plus whatever the per-user cache
 * has materialized — i.e. the codes getLanguageCard() can serve without
 * touching the network. Deliberately NOT the full manifest: callers
 * iterate this list and fetch each card (validate.js, doctor), which
 * must never turn into thousands of network round-trips.
 *
 * @returns {string[]} Array of primary locale codes
 */
function getAllLanguageCodes() {
  if (_mode !== 'packaged') return Array.from(_cards.keys());
  const codes = new Set(_cards.keys());
  for (const code of listCachedCodes()) codes.add(code);
  return Array.from(codes);
}

/**
 * Get method support flags for a locale.
 *
 * @param {string} code - Locale code
 * @returns {object|null} Method support flags, or null if no card
 */
function getMethodSupport(code) {
  const card = getLanguageCard(code);
  return card?.methodSupport || null;
}

// -----------------------------------------------------------------
// Reference tier — REMOVED (v6: unified cards)
// -----------------------------------------------------------------

/**
 * Get the full language reference for a locale.
 *
 * In v6 (unified cards), this is now just an alias for getLanguageCard().
 * All reference data (linguisticChallenges, encyclopedic, resources) is
 * merged directly into the runtime card files.
 *
 * Kept for backward compatibility with consumers that called
 * getLanguageReference() for enriched data.
 *
 * @param {string} code - Locale code (e.g., 'fr', 'ko')
 * @returns {object|null} Complete language card, or null if no card
 * @deprecated Use getLanguageCard() instead — it returns the same data.
 */
function getLanguageReference(code) {
  return getLanguageCard(code);
}

// -----------------------------------------------------------------
// Backward-compatible DEFAULT_REGISTERS proxy
// -----------------------------------------------------------------

/**
 * Backward-compatible DEFAULT_REGISTERS export.
 *
 * Returns the same shape as the old flat dictionary so all 21 consumer
 * call sites keep working during migration:
 *   { name: string, register: string, dir?: string, scripts?: string }
 *
 * New code should use getLanguageCard() and getRegister() instead.
 *
 * WHY a Proxy: We don't want to maintain two data sources. The proxy
 * dynamically builds the old shape from the language card data on access.
 * The `ownKeys` trap ensures Object.keys(), Object.entries(), and
 * for...in loops work correctly.
 */
const DEFAULT_REGISTERS = new Proxy({}, {
  get(_target, code) {
    if (typeof code !== 'string') return undefined;

    // Handle common Proxy/inspection traps
    if (code === Symbol.toPrimitive || code === Symbol.iterator) return undefined;
    if (code === 'toJSON') {
      // Support JSON.stringify(DEFAULT_REGISTERS)
      return () => {
        const result = {};
        for (const key of _cards.keys()) {
          result[key] = DEFAULT_REGISTERS[key];
        }
        // Also include aliases that map to different keys for backward compat
        // The old code had 'no' as a direct entry, now it's an alias to 'nb'
        return result;
      };
    }

    const card = getLanguageCard(code);
    if (!card) return undefined;

    const defaultRegister = getRegister(code);
    const entry = {
      name: card.name,
      register: defaultRegister,
    };

    // Only include dir if RTL (matches old behavior — LTR was implied)
    // `textDirection` is CLDR's own layout.orientation.characterOrder,
    // projected as a fact. The card no longer carries a bare `dir`.
    if (card.textDirection === 'right-to-left' || card.dir === 'rtl') {
      entry.dir = 'rtl';
    }

    // Map scriptConverter to the old 'scripts' field name
    if (card.scriptConverter) {
      entry.scripts = card.scriptConverter;
    }

    return entry;
  },

  has(_target, code) {
    if (typeof code !== 'string') return false;
    return getLanguageCard(code) !== null;
  },

  ownKeys() {
    // Return all locally-available primary codes + aliases for full
    // backward compat. The old code had 'no' as a key, now it's an
    // alias to 'nb'. (Set: Proxy ownKeys must not contain duplicates.)
    const keys = new Set(getAllLanguageCodes());
    for (const [alias] of _aliases) {
      keys.add(alias);
    }
    return Array.from(keys);
  },

  getOwnPropertyDescriptor(_target, code) {
    if (typeof code !== 'string') return undefined;
    const card = getLanguageCard(code);
    if (!card) return undefined;
    return {
      configurable: true,
      enumerable: true,
      value: DEFAULT_REGISTERS[code],
    };
  },
});

// -----------------------------------------------------------------
// Exports
// -----------------------------------------------------------------

export {
  // New API — use these in new code
  getLanguageCard,
  getLanguageReference,
  getRegister,
  getRegisterPresets,
  getFormality,
  getGenderGuidance,
  getAllLanguageCodes,
  getMethodSupport,
  resolveCode,
  DEFAULT_REGISTER_FALLBACK,

  // Dynamic card tier (packaged installs)
  prefetchLanguageCards,
  getCardSourceInfo,

  // Backward-compatible export — existing consumers use this
  DEFAULT_REGISTERS,

  // Internal — for testing
  CARDS_DIR,
  REFERENCE_DIR,
};
