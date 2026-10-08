/**
 * sync-eval-datasets.mjs — derive corpora coverage into the eval-config lane.
 *
 * The corpora cards (cli/shared/corpora-cards/) are the SSOT for which
 * evaluation sets exist. This script reflects that truth into
 * `shared/catalogue/card-config.json` → `evalConfig.<code>.evalDatasets`, the
 * per-language eval WIRING all three runtimes attach to the composed card view
 * at read time (JS: registers.js _withPromptConfig; Python:
 * language_cards._eval_config_for; forge: nmt_forge/cards.py) — so a language's
 * runtime view answers "what eval data covers this language?" without
 * re-scanning every corpus.
 *
 * WHY the config lane and not the cards: since the atlas cutover the language
 * cards are BUILD OUTPUT projected from atlas.db, and the atlas deliberately
 * does not project eval wiring (it is product configuration under gate 3, not
 * a fact a source asserts about the language). This script's previous life
 * stamped `evalDatasets` onto the card files directly — hand-edits to build
 * output, lost on every rebuild. The derivation is unchanged; only the
 * destination moved to the lane the runtimes actually read.
 *
 * For each covered language it sets `evalConfig.<code>.evalDatasets` to the
 * sorted, de-duplicated list of corpora-card ids that cover that language:
 *   - pair-specific eval cards (tatoeba / globalvoices / gamayun / edtekla)
 *     where the language is the pair source or target, and
 *   - multiway cards (FLORES/NTREX/…) whose `languages` array includes it.
 *
 * It is merge-by-replace on a DERIVED subfield: `evalDatasets` is computed
 * entirely from the corpora cards, so the script owns that one key and
 * preserves everything else on the entry (evalStandard / evalMetrics /
 * evalPack / metricPlugins are authored wiring, never touched). A language
 * that loses all coverage loses the key; an entry left empty is removed.
 * Self-pairs (source === target) are skipped — they are not a translation
 * direction. Writes go to the repo-root shared/catalogue SSOT — run
 * `npm run sync:shared` afterwards so the packaged copy (cli/shared) follows.
 *
 * LOUD by design: any corpus code with no matching language card is reported,
 * never silently dropped. (Known gap: GlobalVoices/Tatoeba use some
 * macrolanguage codes — fas/ara/sqi/ber — while cards use individual codes —
 * pes/arb/als/kab. Those are surfaced here rather than masked.)
 *
 * Usage:
 *   node scripts/sync-eval-datasets.mjs            # apply
 *   node scripts/sync-eval-datasets.mjs --dry-run  # preview, no writes
 *   node scripts/sync-eval-datasets.mjs --check    # exit 1 if the config is
 *                                                  # out of sync (for CI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const LANG_CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CORPORA_CARDS_DIR = path.join(CLI_ROOT, 'shared', 'corpora-cards');
// The repo-root catalogue is the SSOT; cli/shared/catalogue is its synced copy
// (sync-shared.mjs). Writing the copy would be overwritten on the next sync.
const CARD_CONFIG_PATH = path.join(CLI_ROOT, '..', 'shared', 'catalogue', 'card-config.json');

const CODE_BRIDGE_PATH = path.join(CLI_ROOT, 'shared', 'code-bridge.json');

const DRY_RUN = process.argv.includes('--dry-run');
const CHECK = process.argv.includes('--check');

/** ISO 639-3 macrolanguage -> individual code our language cards use (SSOT:
 *  code-bridge.json). Lets macro-coded corpora (fas/ara/sqi…) be recorded on
 *  the right individual-language card without renaming corpora. */
function loadMacrolanguageMap() {
  try {
    return JSON.parse(fs.readFileSync(CODE_BRIDGE_PATH, 'utf-8')).macrolanguage || {};
  } catch {
    return {};
  }
}
const MACRO = loadMacrolanguageMap();

/** Corpus-code → individual-language card routing for macrolanguage-coded
 *  corpora (docs/LANGUAGE_TAXONOMY.md R5 / Position 4: macrolanguage hubs are
 *  navigation, NEVER benchmark targets — eval coverage must bind to the member
 *  language the corpus text is actually in). Each entry names the standard /
 *  documented variety the upstream corpus uses (FLORES+/NTREX/IN22/Tatoeba/
 *  GlobalVoices publish these under the macro code). Added 2026-07-07. */
const MACRO_EVAL_TARGET = {
  aka: 'twi',  // FLORES 'aka' — standard written Akan is Twi-based
  aym: 'ayr',  // Central Aymara (FLORES ayr_Latn)
  aze: 'azj',  // North Azerbaijani (azj_Latn in NLLB/FLORES)
  bua: 'bxr',  // Russia Buriat — the written standard Tatoeba 'bua' uses
  chm: 'mhr',  // Meadow (Eastern) Mari — the written standard
  din: 'dik',  // Southwestern Dinka (FLORES dik_Latn)
  doi: 'dgo',  // Dogri proper (IN22/FLORES doi content)
  est: 'ekk',  // Standard Estonian
  ful: 'fuv',  // Nigerian Fulfulde (FLORES fuv_Latn)
  iku: 'ike',  // Eastern Canadian Inuktitut
  kau: 'knc',  // Central Kanuri (FLORES knc)
  grn: 'gug',  // Paraguayan Guaraní (FLORES grn = gug)
  kok: 'gom',  // Goan Konkani (gom_Deva in NLLB; IN22 Konkani)
  kon: 'kng',  // Koongo (FLORES kon_Latn = Kikongo)
  kur: 'kmr',  // Northern Kurdish (Kurmanji)
  lav: 'lvs',  // Standard Latvian
  mlg: 'plt',  // Plateau Malagasy (FLORES/GlobalVoices mg = plt)
  mon: 'khk',  // Halh Mongolian
  nep: 'npi',  // Nepali (individual)
  ori: 'ory',  // Odia
  orm: 'gaz',  // West Central Oromo (FLORES gaz_Latn)
  pus: 'pbt',  // Southern Pashto (FLORES pbt_Arab)
  que: 'quy',  // Ayacucho Quechua (FLORES+ quy_Latn — NOT generic que)
  rom: 'rmy',  // Vlax Romani — the most widely written variety
  san: 'cls',  // Classical Sanskrit (FLORES san_Deva)
  srd: 'src',  // Logudorese Sardinian (FLORES srd convention)
  uzb: 'uzn',  // Northern Uzbek (FLORES+ uzn_Latn)
  yid: 'ydd',  // Eastern Yiddish
  zza: 'diq',  // Dimli (Southern Zaza)
};

/** Cache of parsed cards (code → card object or null when no file). */
const cardCache = new Map();
function readCard(code) {
  if (cardCache.has(code)) return cardCache.get(code);
  const p = path.join(LANG_CARDS_DIR, `${code}.json`);
  let card = null;
  if (fs.existsSync(p)) {
    try { card = JSON.parse(fs.readFileSync(p, 'utf-8')); }
    catch (e) {
      console.error(`  ✗ unreadable language card ${code}.json: ${e.message}`);
      process.exit(1); // a corrupt card must not silently shrink coverage
    }
  }
  cardCache.set(code, card);
  return card;
}

/** True when the card is a macrolanguage hub (ISO scope M) — hubs are a typed
 *  navigation layer and must never carry benchmark linkage. Both spellings:
 *  pre-cutover cards carry the registry letter, atlas cards the legible word. */
const isHub = (card) => card != null
  && (card.isoScope === 'M' || card.isoScope === 'Macrolanguage');

/** Resolve a corpus language code to the language-card code that exists on
 *  disk AND is a legal benchmark target (never a macrolanguage hub): the code
 *  itself, else its macrolanguage->individual mapping (eval-routing table
 *  first, then code-bridge). Returns null when nothing resolves (surfaced
 *  loudly, never silently dropped). */
function resolveCardCode(code) {
  const direct = readCard(code);
  if (direct && !isHub(direct)) return code;
  for (const mapped of [MACRO_EVAL_TARGET[code], MACRO[code]]) {
    if (!mapped) continue;
    const card = readCard(mapped);
    if (card && !isHub(card)) return mapped;
  }
  return null;
}

/** Read + parse every corpora card. */
function loadCorporaCards() {
  const out = [];
  for (const f of fs.readdirSync(CORPORA_CARDS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(CORPORA_CARDS_DIR, f);
    try {
      out.push(JSON.parse(fs.readFileSync(p, 'utf-8')));
    } catch (e) {
      console.error(`  ✗ unreadable corpora card ${f}: ${e.message}`);
      process.exit(1); // a corrupt card must not silently shrink coverage
    }
  }
  return out;
}

/** language code -> Set<corpus id>, plus the set of codes lacking a card. */
function buildCoverage(cards) {
  const coverage = new Map(); // code -> Set(ids)
  const allCodes = new Set();

  const add = (code, id) => {
    if (!code) return;
    allCodes.add(code);
    if (!coverage.has(code)) coverage.set(code, new Set());
    coverage.get(code).add(id);
  };

  for (const c of cards) {
    const type = c.type;
    if (type === 'eval') {
      const pair = c.pair || {};
      const s = pair.source;
      const t = pair.target;
      if (s && t && s === t) continue; // self-pair — not a direction
      add(s, c.id);
      add(t, c.id);
    } else if (type === 'multiway') {
      for (const code of c.languages || []) add(code, c.id);
    }
    // reference cards (ref-*) are catalogue, not eval coverage — skipped
  }
  return { coverage, allCodes };
}

function main() {
  const cards = loadCorporaCards();
  const { coverage } = buildCoverage(cards);

  // Aggregate coverage onto the resolved language-card code (direct, or via
  // macrolanguage->individual normalization). Codes that resolve to no card
  // are surfaced loudly, never silently dropped.
  const byCard = new Map();      // cardCode -> Set(corpus id)
  const unmappedSet = new Set();
  for (const [code, ids] of coverage) {
    const cardCode = resolveCardCode(code);
    if (!cardCode) { unmappedSet.add(code); continue; }
    if (!byCard.has(cardCode)) byCard.set(cardCode, new Set());
    const set = byCard.get(cardCode);
    for (const id of ids) set.add(id);
  }
  const unmapped = [...unmappedSet].sort();

  // ---- Merge into the eval-config lane ----
  let raw;
  try { raw = fs.readFileSync(CARD_CONFIG_PATH, 'utf-8'); }
  catch (e) {
    console.error(`✗ ${CARD_CONFIG_PATH} unreadable: ${e.message}`);
    process.exit(1);
  }
  const config = JSON.parse(raw);
  if (!config.evalConfig || typeof config.evalConfig !== 'object') {
    console.error('✗ card-config.json has no evalConfig object — refusing to invent the lane');
    process.exit(1);
  }
  const evalConfig = config.evalConfig;

  let updated = 0;
  let unchanged = 0;
  let removed = 0;
  const drift = []; // for --check

  const sameList = (a, b) => Array.isArray(a) && a.length === b.length
    && a.every((v, i) => v === b[i]);

  for (const [cardCode, idSet] of [...byCard.entries()].sort()) {
    const want = [...idSet].sort();
    const entry = evalConfig[cardCode];
    if (entry && sameList(entry.evalDatasets, want)) { unchanged++; continue; }
    drift.push(cardCode);
    updated++;
    if (CHECK) continue; // check mode only reports
    evalConfig[cardCode] = { ...(entry ?? {}), evalDatasets: want };
  }

  // ---- Stale-coverage cleanup ----
  // `evalDatasets` is derived ENTIRELY from the corpora cards, so an entry
  // carrying ids without current coverage is stale (corpora renamed/retired,
  // or an old macro-hub recording). The derived key is dropped; authored
  // wiring on the same entry (evalStandard/evalMetrics/evalPack/…) survives,
  // and an entry left with nothing is removed outright.
  const cleanedCodes = [];
  for (const code of Object.keys(evalConfig)) {
    if (code.startsWith('_') || byCard.has(code)) continue;
    const entry = evalConfig[code];
    if (!entry || !Array.isArray(entry.evalDatasets)) continue;
    cleanedCodes.push(`${code} [${entry.evalDatasets.join(', ')}]`);
    drift.push(code);
    removed++;
    if (CHECK) continue;
    delete entry.evalDatasets;
    if (Object.keys(entry).length === 0) delete evalConfig[code];
  }

  if (!DRY_RUN && !CHECK && (updated || removed)) {
    fs.writeFileSync(CARD_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  }

  // ---- Report ----
  console.log(
    `Corpora cards: ${cards.length} | languages covered: ${byCard.size}`
  );
  if (unmapped.length) {
    console.log(
      `\n⚠ ${unmapped.length} corpus code(s) have NO language card even after ` +
      `macrolanguage normalization — coverage NOT recorded for them ` +
      `(add a card or a code-bridge mapping):`
    );
    console.log(`   ${unmapped.join(', ')}`);
  }

  if (CHECK) {
    if (drift.length) {
      console.error(
        `\n✗ CHECK FAILED: evalConfig.evalDatasets is stale for ` +
        `${drift.length} language(s). Run: node scripts/sync-eval-datasets.mjs ` +
        `&& npm run sync:shared`
      );
      console.error(`   ${drift.slice(0, 30).join(', ')}` +
        (drift.length > 30 ? ` … (+${drift.length - 30})` : ''));
      process.exit(1);
    }
    console.log('\n✓ CHECK OK: evalConfig.evalDatasets is in sync with the corpora cards.');
    return;
  }

  if (removed) {
    console.log(
      `\n${DRY_RUN ? 'DRY-RUN — would drop' : 'Dropped'} stale evalDatasets ` +
      `from ${removed} entr${removed === 1 ? 'y' : 'ies'} with no current ` +
      `corpora coverage:`
    );
    console.log(`   ${cleanedCodes.slice(0, 30).join(', ')}` +
      (cleanedCodes.length > 30 ? ` … (+${cleanedCodes.length - 30})` : ''));
  }

  console.log(
    `\n${DRY_RUN ? 'DRY-RUN — would update' : 'Updated'} ${updated} ` +
    `evalConfig entr${updated === 1 ? 'y' : 'ies'}; ${unchanged} already in sync.` +
    (updated && !DRY_RUN
      ? '\nNow run `npm run sync:shared` so the packaged copy follows.'
      : '')
  );
}

main();
