#!/usr/bin/env node

/**
 * validate-endonyms.mjs — endonym authenticity gate (CI-able)
 * ────────────────────────────────────────────────────────────────
 * Validates every card `nativeName` against four independent checks and
 * issues a per-card verdict: verified | plausible | suspect | fail.
 *
 * Why this exists (2026-06-11 data-credibility incident): the homepage
 * endonym wall displayed `lvs` (Standard Latvian) as "Стандард Латвиан" —
 * a Cyrillic rendering of the ENGLISH name, sourced from LinguaMeta's
 * flattened TSV `endonym` column. Latvian is Latin-script; the value fails
 * the simplest script-consistency check. A second mechanism imported
 * other-language labels from Wikidata P1705 ("bahasa Nedebang"@id for nec)
 * because the apply step discarded each label's language tag.
 *
 * Checks:
 *  (a) script-consistency — the name's dominant Unicode script must appear
 *      in the card's scripts[] (∪ top-level `script`). Tolerant: Latin is
 *      always allowed when the card has no script data; mixed-script names
 *      are judged on the majority script. Han/Hans/Hant/Jpan/Kore are
 *      treated as one Han-equivalence class.
 *  (b) self-language tag — where LinguaMeta (per-name `bcp_47_code` in the
 *      upstream JSON, data/linguameta/data/*.json) or the Wikidata harvest
 *      (per-label `lang`, data/wikidata-endonyms-harvest.json) attests the
 *      name, the name's language tag must resolve to the card's own
 *      language (incl. macrolanguage/individual-language equivalences).
 *      A name attested ONLY under another language's tag is not an endonym.
 *  (c) cross-source agreement — the same name self-attested by both
 *      LinguaMeta and Wikidata ⇒ strong (verified).
 *  (d) template suspicion — "<bahasa|basa|sahap|te reo|reo|ede|language of>
 *      + (≈ English name)" without self-language attestation ⇒ suspect
 *      (needs human verification), NOT auto-fail.
 *
 * Verdict policy:
 *   fail     — script-inconsistent, or attested only under a major
 *              lingua-franca tag (en/id/ru/…): a catalog-language import.
 *   suspect  — unverifiable template pattern, foreign-tagged under a
 *              non-LWC tag (possibly genuine local usage — needs human
 *              review), or non-Latin name with no script data.
 *   plausible— script-consistent with no negative evidence.
 *   verified — script-consistent + self-language attestation (two sources
 *              agreeing, or manual curation).
 *
 * The wall generator (cli/website/plugins/shared-data/generateWallJson.js)
 * only renders verdict ∈ {verified, plausible} via the `nativeNameVerdict`
 * field stamped on cards by fix-endonym-authenticity.mjs.
 *
 * Usage:
 *   node scripts/validate-endonyms.mjs              # full report
 *   node scripts/validate-endonyms.mjs --ci         # exit 1 on any `fail`
 *   node scripts/validate-endonyms.mjs --bias       # fill-rate bias table
 *   node scripts/validate-endonyms.mjs --json out.json
 *   node scripts/validate-endonyms.mjs --lang lvs --verbose
 *
 * Degrades gracefully: if the upstream LinguaMeta JSON mirror
 * (data/linguameta/data/) or the Wikidata harvest snapshot is absent,
 * tag checks are skipped (script-consistency still runs) and a warning
 * is printed. CI environments need only the card files for check (a).
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const LM_JSON_DIR = path.join(CLI_ROOT, 'data', 'linguameta', 'data');
const WD_HARVEST = path.join(CLI_ROOT, 'data', 'wikidata-endonyms-harvest.json');

// ═══════════════════════════════════════════════════════════════
//  Script detection (Unicode property escapes)
// ═══════════════════════════════════════════════════════════════

/** ISO 15924 → Unicode Script property value, for every script that can
 *  realistically appear in a nativeName. Unmapped historic scripts fall
 *  through to 'unknown' (never auto-fail on our own ignorance). */
const DETECTORS = [
  ['Latn', 'Latin'], ['Cyrl', 'Cyrillic'], ['Grek', 'Greek'],
  ['Arab', 'Arabic'], ['Hebr', 'Hebrew'], ['Syrc', 'Syriac'],
  ['Thaa', 'Thaana'], ['Nkoo', 'Nko'], ['Tfng', 'Tifinagh'],
  ['Ethi', 'Ethiopic'], ['Vaii', 'Vai'], ['Adlm', 'Adlam'],
  ['Deva', 'Devanagari'], ['Beng', 'Bengali'], ['Guru', 'Gurmukhi'],
  ['Gujr', 'Gujarati'], ['Orya', 'Oriya'], ['Taml', 'Tamil'],
  ['Telu', 'Telugu'], ['Knda', 'Kannada'], ['Mlym', 'Malayalam'],
  ['Sinh', 'Sinhala'], ['Thai', 'Thai'], ['Laoo', 'Lao'],
  ['Tibt', 'Tibetan'], ['Mymr', 'Myanmar'], ['Geor', 'Georgian'],
  ['Armn', 'Armenian'], ['Khmr', 'Khmer'], ['Mong', 'Mongolian'],
  ['Cans', 'Canadian_Aboriginal'], ['Cher', 'Cherokee'],
  ['Hani', 'Han'], ['Hira', 'Hiragana'], ['Kana', 'Katakana'],
  ['Hang', 'Hangul'], ['Yiii', 'Yi'], ['Bugi', 'Buginese'],
  ['Batk', 'Batak'], ['Cakm', 'Chakma'], ['Lisu', 'Lisu'],
  ['Mtei', 'Meetei_Mayek'], ['Olck', 'Ol_Chiki'], ['Tavt', 'Tai_Viet'],
  ['Lana', 'Tai_Tham'], ['Tale', 'Tai_Le'], ['Talu', 'New_Tai_Lue'],
  ['Hano', 'Hanunoo'], ['Buhd', 'Buhid'], ['Tglg', 'Tagalog'],
  ['Tagb', 'Tagbanwa'], ['Plrd', 'Miao'], ['Hmng', 'Pahawh_Hmong'],
  ['Hmnp', 'Nyiakeng_Puachue_Hmong'], ['Mand', 'Mandaic'],
  ['Samr', 'Samaritan'], ['Lepc', 'Lepcha'], ['Kali', 'Kayah_Li'],
  ['Sund', 'Sundanese'], ['Java', 'Javanese'], ['Bali', 'Balinese'],
  ['Rjng', 'Rejang'], ['Sylo', 'Syloti_Nagri'], ['Saur', 'Saurashtra'],
  ['Shrd', 'Sharada'], ['Takr', 'Takri'], ['Gonm', 'Masaram_Gondi'],
  ['Gong', 'Gunjala_Gondi'], ['Wcho', 'Wancho'], ['Mroo', 'Mro'],
  ['Osge', 'Osage'], ['Bamu', 'Bamum'], ['Medf', 'Medefaidrin'],
  ['Sgnw', 'SignWriting'], ['Dupl', 'Duployan'], ['Copt', 'Coptic'],
  ['Glag', 'Glagolitic'], ['Runr', 'Runic'], ['Ogam', 'Ogham'],
];

const DETECTOR_RE = DETECTORS.map(([iso, uni]) => {
  try {
    return [iso, new RegExp(`\\p{Script=${uni}}`, 'u')];
  } catch {
    return null;
  }
}).filter(Boolean);

/** ISO 15924 codes that are variants of (or contain) another script for
 *  consistency purposes: card says Hans, name detector says Hani, etc. */
const SCRIPT_EQUIV = {
  Hans: ['Hani'], Hant: ['Hani'], Hanb: ['Hani'],
  Jpan: ['Hani', 'Hira', 'Kana'], Hrkt: ['Hira', 'Kana'],
  Kore: ['Hang', 'Hani'],
  Syrn: ['Syrc'], Syre: ['Syrc'], Syrj: ['Syrc'],
  Latf: ['Latn'], Latg: ['Latn'], Cyrs: ['Cyrl'], Aran: ['Arab'],
};

/** Count letters per detected script; return the majority script. */
export function detectScripts(text) {
  const counts = new Map();
  let letters = 0;
  let unknown = 0;
  for (const ch of String(text)) {
    if (!/\p{L}/u.test(ch)) continue;
    letters++;
    let hit = null;
    for (const [iso, re] of DETECTOR_RE) {
      if (re.test(ch)) { hit = iso; break; }
    }
    if (hit) counts.set(hit, (counts.get(hit) || 0) + 1);
    else unknown++;
  }
  let dominant = null;
  let max = 0;
  for (const [iso, n] of counts) {
    if (n > max) { max = n; dominant = iso; }
  }
  // If unmapped scripts outnumber every mapped one, we don't know.
  if (unknown > max) dominant = 'unknown';
  return { dominant, counts, letters, unknown };
}

/** The set of ISO 15924 codes the card claims (scripts[] ∪ script),
 *  expanded through the equivalence table. */
export function cardScriptSet(card) {
  const out = new Set();
  const add = (code) => {
    if (!code || typeof code !== 'string') return;
    out.add(code);
    for (const eq of SCRIPT_EQUIV[code] || []) out.add(eq);
  };
  if (typeof card.script === 'string') add(card.script);
  for (const s of Array.isArray(card.scripts) ? card.scripts : []) {
    if (typeof s === 'string') add(s);
    else if (s && typeof s === 'object') add(s.code || s.name);
  }
  return out;
}

/**
 * Check (a): script consistency. → 'pass' | 'fail' | 'unknown'
 *  - no letters at all → fail (junk value)
 *  - card has script data → majority script must be in the set
 *    (∪ `extraScripts`, e.g. LinguaMeta's writing_systems — card scripts[]
 *    is known-incomplete for languages like ban/Balinese, whose genuine
 *    Bali-script endonym must not fail on our own data gap)
 *  - card has NO script data → Latin passes (tolerance), anything else
 *    is 'unknown' (cannot be confirmed, never auto-failed)
 */
export function scriptConsistency(name, card, extraScripts = []) {
  const det = detectScripts(name);
  if (det.letters === 0) return { status: 'fail', dominant: null };
  if (det.dominant === 'unknown') return { status: 'unknown', dominant: 'unknown' };
  const allowed = cardScriptSet(card);
  for (const code of extraScripts) {
    allowed.add(code);
    for (const eq of SCRIPT_EQUIV[code] || []) allowed.add(eq);
  }
  if (allowed.size === 0) {
    return { status: det.dominant === 'Latn' ? 'pass' : 'unknown', dominant: det.dominant };
  }
  return { status: allowed.has(det.dominant) ? 'pass' : 'fail', dominant: det.dominant };
}

// ── Transliteration-of-English detector (the lvs class) ────────
// "Стандард Латвиан" is the ENGLISH name "Standard Latvian" rendered in
// Cyrillic. Romanize Cyrillic/Greek naively and compare to the English
// name; a near-match means the value is a transliteration artifact, never
// a real endonym — hard fail even when the source self-tags it.
const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya', і: 'i', ї: 'i', є: 'e', ґ: 'g', ў: 'u', џ: 'dzh', ѓ: 'g',
  ќ: 'k', љ: 'lj', њ: 'nj', ђ: 'dj', ћ: 'c', ј: 'j', ѕ: 'dz',
};

export function isEnglishTransliteration(nativeName, englishName) {
  if (!englishName) return false;
  const eng = foldDiacritics(englishName).replace(/[^a-z]/g, '');
  if (!eng) return false;
  for (const variant of nameVariants(nativeName)) {
    const lower = norm(variant);
    if (!/[Ѐ-ӿ]/.test(lower)) continue; // Cyrillic only for now
    let rom = '';
    for (const ch of lower) rom += CYR_TO_LAT[ch] ?? ch;
    rom = foldDiacritics(rom).replace(/[^a-z]/g, '');
    if (!rom) continue;
    const dist = levenshtein(rom, eng);
    if (dist <= Math.max(2, Math.floor(eng.length * 0.2))) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  Evidence: LinguaMeta per-name tags + Wikidata harvest tags
// ═══════════════════════════════════════════════════════════════

const norm = (s) =>
  String(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

const foldDiacritics = (s) =>
  norm(s).normalize('NFD').replace(/\p{M}/gu, '');

/** Split multi-variant nativeNames ("nêhiyawêwin / ᓀᐦᐃᔭᐍᐏᐣ"). */
export function nameVariants(nativeName) {
  return String(nativeName)
    .split(/\s*[/;]\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Load the upstream LinguaMeta JSON mirror (per-name language tags).
 * Returns { byIso: Map, bcpToIso: Map, available: bool }.
 * Each byIso value: { bcp, macroBcp, individualBcp, names: [{name, tag, canonical}] }
 */
export function loadLinguaMeta() {
  const byIso = new Map();
  const bcpToIso = new Map();
  if (!fs.existsSync(LM_JSON_DIR)) {
    return { byIso, bcpToIso, available: false };
  }
  for (const f of fs.readdirSync(LM_JSON_DIR)) {
    if (!f.endsWith('.json')) continue;
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(LM_JSON_DIR, f), 'utf-8'));
    } catch {
      continue;
    }
    const bcp = (j.bcp_47_code || f.replace(/\.json$/, '')).toLowerCase();
    const iso = (j.iso_639_3_code || '').toLowerCase();
    const scripts = new Set();
    for (const lsl of j.language_script_locale || []) {
      const code = lsl && lsl.script && lsl.script.iso_15924_code;
      if (typeof code === 'string' && code.length === 4) {
        const norm15924 = code[0].toUpperCase() + code.slice(1).toLowerCase();
        // Skip ISO 15924 placeholders: Xxxx/Zzzz = unknown, Zyyy = common,
        // Zxxx = unwritten. Treating them as real scripts would turn
        // "script unknown" into spurious mismatches.
        if (!['Xxxx', 'Zzzz', 'Zyyy', 'Zxxx'].includes(norm15924)) {
          scripts.add(norm15924);
        }
      }
    }
    const entry = {
      bcp,
      iso,
      macroBcp: (j.macrolanguage_bcp_47_code || '').toLowerCase() || null,
      individualBcp: (j.individual_language_bcp_47_code || '').toLowerCase() || null,
      scripts: [...scripts],
      names: (j.name_data || []).map((n) => ({
        name: n.name,
        tag: (n.bcp_47_code || '').toLowerCase() || null,
        canonical: !!n.is_canonical,
      })),
    };
    if (iso) byIso.set(iso, entry);
    bcpToIso.set(bcp, iso || bcp);
  }
  return { byIso, bcpToIso, available: byIso.size > 0 };
}

/** Load the Wikidata endonym harvest snapshot ({ byIso, available }). */
export function loadWikidataHarvest() {
  if (!fs.existsSync(WD_HARVEST)) return { byIso: {}, available: false };
  try {
    const j = JSON.parse(fs.readFileSync(WD_HARVEST, 'utf-8'));
    return { byIso: j.byIso || {}, available: true };
  } catch {
    return { byIso: {}, available: false };
  }
}

/** Major lingua-franca tags: a name attested ONLY under one of these is a
 *  catalog-language import, not an endonym → hard fail. */
const LWC_TAGS = new Set([
  'en', 'id', 'ms', 'ru', 'fr', 'es', 'pt', 'de', 'nl', 'it', 'zh',
  'ar', 'fa', 'hi', 'ur', 'bn', 'sw', 'tr', 'vi', 'th', 'ja', 'ko',
  'pl', 'ro', 'el', 'sv', 'da', 'no', 'fi', 'hu', 'cs',
]);

/** BCP-47 special tags meaning "no specific language" — NOT foreign
 *  evidence. Wikidata uses mis/und for languages without their own lang
 *  code (e.g. crk "nêhiyawêwin"@mis). Treated like an untagged match. */
const NONSPECIFIC_TAGS = new Set(['mis', 'und', 'zxx', 'mul']);

/** Endonym template prefixes ("language of X" patterns). */
const TEMPLATE_RE = /^(bahasa|basa|sahap|te\s+reo|reo|ede|language\s+of)\s+(.+)$/iu;

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Check (d): "<template> + (≈ English name)" shape. */
export function isTemplateSuspect(nativeName, englishName) {
  for (const variant of nameVariants(nativeName)) {
    const m = TEMPLATE_RE.exec(variant.trim());
    if (!m) continue;
    const rest = foldDiacritics(m[2]);
    const eng = foldDiacritics(englishName || '');
    if (!rest || !eng) continue;
    if (rest === eng || levenshtein(rest, eng) <= 1 || eng.includes(rest)) {
      return true;
    }
  }
  return false;
}

/** Build the set of codes that mean "this card's own language". */
function selfCodes(card, lmEntry) {
  const set = new Set();
  const add = (c) => {
    if (c && typeof c === 'string') set.add(c.toLowerCase().split('-')[0]);
  };
  add(card.code);
  add(card.iso639_3);
  add(card.bcp47);
  add(card.macrolanguage);
  if (lmEntry) {
    add(lmEntry.bcp);
    add(lmEntry.iso);
    add(lmEntry.macroBcp);
    add(lmEntry.individualBcp);
  }
  return set;
}

function isSelfTag(tag, self, bcpToIso) {
  if (!tag) return false;
  const base = tag.toLowerCase().split('-')[0];
  if (self.has(base)) return true;
  const iso = bcpToIso.get(base);
  return !!(iso && self.has(iso));
}

// ═══════════════════════════════════════════════════════════════
//  Verdict
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the authenticity verdict for one card's nativeName.
 * @returns {{verdict: string, reasons: string[], script: object,
 *            evidence: object}}
 */
export function computeVerdict(card, evidence) {
  const { lm, wd } = evidence;
  const reasons = [];
  const nativeName = card.nativeName;
  const variants = nameVariants(nativeName).map(norm);
  const variantSet = new Set([...variants, norm(nativeName)]);

  // Gather attestations
  const lmEntry = lm.byIso.get((card.iso639_3 || card.code || '').toLowerCase());
  const self = selfCodes(card, lmEntry);
  const ev = {
    lmSelf: false, lmForeign: [], wdSelf: false, wdForeign: [],
    wdUntagged: false, lmMatched: false, wdMatched: false,
    lmAvailable: lm.available, wdAvailable: wd.available,
  };

  if (lmEntry) {
    for (const n of lmEntry.names) {
      if (!variantSet.has(norm(n.name))) continue;
      ev.lmMatched = true;
      const base = n.tag ? n.tag.split('-')[0] : null;
      if (!n.tag || NONSPECIFIC_TAGS.has(base)) continue; // untagged-ish
      if (isSelfTag(n.tag, self, lm.bcpToIso)) ev.lmSelf = true;
      else ev.lmForeign.push(n.tag);
    }
  }
  const wdEntry = wd.byIso[(card.iso639_3 || card.code || '').toLowerCase()];
  if (wdEntry) {
    for (const tier of ['P1705', 'ownLabel', 'P1448']) {
      for (const e of wdEntry[tier] || []) {
        if (!variantSet.has(norm(e.value))) continue;
        ev.wdMatched = true;
        const base = e.lang ? e.lang.split('-')[0] : null;
        if (!e.lang || NONSPECIFIC_TAGS.has(base)) ev.wdUntagged = true;
        else if (isSelfTag(e.lang, self, lm.bcpToIso)) ev.wdSelf = true;
        else ev.wdForeign.push(e.lang);
      }
    }
  }

  // (a) script consistency — judged on the whole string's majority script,
  // against card scripts[] ∪ LinguaMeta's writing_systems for the language.
  const script = scriptConsistency(nativeName, card, lmEntry ? lmEntry.scripts : []);

  const fieldSource = (card._fieldSources || {}).nativeName || '';
  const manuallyCurated = /^manual-curation/.test(fieldSource);
  const anySelf = ev.lmSelf || ev.wdSelf;
  const anyForeign = ev.lmForeign.length > 0 || ev.wdForeign.length > 0;
  const template = isTemplateSuspect(nativeName, card.name);
  const translit = isEnglishTransliteration(nativeName, card.name);

  // ── decision ladder ──

  // The lvs class: the English name transliterated into a script the
  // language does NOT use ("Стандард Латвиан" for Latin-script Latvian).
  // Decisive even when a source self-tags it (LinguaMeta tags that string
  // lvs — upstream's own defect). NOTE: only when the script is ALSO
  // inconsistent — genuine Cyrillic-script endonyms (tab "Табасаран",
  // uum "Урум") romanize close to their English names because the English
  // name derives from the endonym, and must not be failed.
  if (translit && script.status === 'fail') {
    reasons.push('transliteration artifact: the ENGLISH name rendered in a script the language does not use');
    return { verdict: 'fail', reasons, script, evidence: ev };
  }

  // Value identical to the English name: not a differentiating endonym.
  // Often the endonym genuinely IS the English name (loanword: ikt
  // "Inuinnaqtun") — keep the data, but it can't be wall-verified, and the
  // fix pass may upgrade it to a self-tagged distinct endonym when one
  // exists (kne "Kankanaey" → "Kankana-ey"@kne).
  if (norm(nativeName) === norm(card.name || '')) {
    reasons.push('identical to English name — not a differentiating endonym');
    return { verdict: 'suspect', reasons, script, evidence: ev };
  }

  // (b) names attested only under another language's tag.
  if (anyForeign && !anySelf) {
    const tags = [...new Set([...ev.lmForeign, ...ev.wdForeign])];
    const lwc = tags.filter((t) => LWC_TAGS.has(t.split('-')[0]));
    if (lwc.length > 0) {
      reasons.push(`attested only as a label in another language (tags: ${tags.join(',')}) — catalog-language import`);
      return { verdict: 'fail', reasons, script, evidence: ev };
    }
    reasons.push(`attested only under foreign tag(s) ${tags.join(',')} — possible genuine local usage, needs human verification`);
    return { verdict: 'suspect', reasons, script, evidence: ev };
  }

  if (script.status === 'fail') {
    reasons.push(
      `script-inconsistent: dominant ${script.dominant || 'none'} not in card+LinguaMeta scripts`,
    );
    // Attested in a source (self-tagged, or untagged like xsl "ᑌᓀ ᒐ"@mis,
    // taq Tifinagh) but in an unexpected script: more likely OUR script
    // data is incomplete than the endonym fake — needs review, off the
    // wall, but not auto-nulled.
    if (anySelf || ev.wdUntagged || ev.lmMatched) {
      reasons.push('source attestation exists — possible script-data gap, not auto-failed');
      return { verdict: 'suspect', reasons, script, evidence: ev };
    }
    return { verdict: 'fail', reasons, script, evidence: ev };
  }

  if (manuallyCurated) {
    reasons.push(`manually curated (${fieldSource})`);
    return { verdict: 'verified', reasons, script, evidence: ev };
  }

  // (d) template pattern without self-language attestation
  if (template && !anySelf) {
    reasons.push('template-pattern name (≈ "language of <English name>") without self-language attestation');
    return { verdict: 'suspect', reasons, script, evidence: ev };
  }

  if (script.status === 'pass') {
    // (c) cross-source agreement
    if ((ev.lmSelf && ev.wdMatched && ev.wdForeign.length === 0) ||
        (ev.wdSelf && ev.lmMatched && ev.lmForeign.length === 0)) {
      reasons.push('cross-source agreement: LinguaMeta + Wikidata both attest this name for this language');
      return { verdict: 'verified', reasons, script, evidence: ev };
    }
    if (anySelf) {
      reasons.push(`self-language tag in ${ev.lmSelf ? 'LinguaMeta' : 'Wikidata'} + script-consistent`);
      return { verdict: 'plausible', reasons, script, evidence: ev };
    }
    reasons.push('script-consistent, no contradicting evidence');
    return { verdict: 'plausible', reasons, script, evidence: ev };
  }

  // script.status === 'unknown'
  if (anySelf) {
    reasons.push('self-language attestation; script could not be confirmed');
    return { verdict: 'plausible', reasons, script, evidence: ev };
  }
  reasons.push('script could not be confirmed against card script data and no self-language attestation');
  return { verdict: 'suspect', reasons, script, evidence: ev };
}

export function loadEvidence() {
  return { lm: loadLinguaMeta(), wd: loadWikidataHarvest() };
}

export function loadCards(singleLang = null) {
  const files = fs.readdirSync(CARDS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'language-tree.json')
    .filter((f) => !singleLang || f === `${singleLang}.json`);
  const cards = [];
  for (const f of files) {
    try {
      cards.push({
        file: path.join(CARDS_DIR, f),
        card: JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8')),
      });
    } catch { /* skip unparseable */ }
  }
  return cards;
}

// ═══════════════════════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════════════════════

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

function biasTable(rows) {
  // rows: [{macroarea, vitality, hasName, eligible}]
  const dims = [
    ['macroarea', (r) => r.macroarea || '(none)'],
    ['vitality', (r) => r.vitality || '(none)'],
  ];
  const out = [];
  for (const [label, keyFn] of dims) {
    const agg = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      const a = agg.get(k) || { cards: 0, withName: 0, eligible: 0 };
      a.cards++;
      if (r.hasName) a.withName++;
      if (r.eligible) a.eligible++;
      agg.set(k, a);
    }
    out.push({ dimension: label, rows: [...agg.entries()].sort((x, y) => y[1].cards - x[1].cards) });
  }
  return out;
}

function main() {
  const CI = process.argv.includes('--ci');
  const VERBOSE = process.argv.includes('--verbose');
  const BIAS = process.argv.includes('--bias');
  const JSON_OUT = arg('--json');
  // --json-stdout: emit the machine payload on stdout with NO human output, so
  // scripts/audit_runner.py can consume this checker without a side-effect file
  // and without ever deriving a verdict from prose. (--json writes a file.)
  const JSON_STDOUT = process.argv.includes('--json-stdout');
  const SINGLE = arg('--lang');

  const realLog = console.log;
  if (JSON_STDOUT) console.log = () => {};

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Endonym Authenticity Gate (validate-endonyms)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const evidence = loadEvidence();
  if (!evidence.lm.available) {
    console.log('  ⚠ LinguaMeta JSON mirror not found (data/linguameta/data/) — tag checks degraded');
  }
  if (!evidence.wd.available) {
    console.log('  ⚠ Wikidata harvest snapshot not found — tag checks degraded');
  }

  const cards = loadCards(SINGLE);
  const verdicts = { verified: 0, plausible: 0, suspect: 0, fail: 0 };
  const details = [];
  const biasRows = [];

  for (const { card } of cards) {
    const hasName = !!card.nativeName;
    let eligible = false;
    if (hasName) {
      const res = computeVerdict(card, evidence);
      verdicts[res.verdict]++;
      eligible = res.verdict === 'verified' || res.verdict === 'plausible';
      details.push({
        code: card.code,
        name: card.name,
        nativeName: card.nativeName,
        source: (card._fieldSources || {}).nativeName || null,
        verdict: res.verdict,
        dominantScript: res.script.dominant,
        scriptStatus: res.script.status,
        reasons: res.reasons,
      });
    }
    biasRows.push({
      macroarea: card.macroarea,
      vitality: card.vitality && card.vitality.unescoStatus,
      hasName,
      eligible,
    });
  }

  const withName = details.length;
  console.log(`  Cards scanned:           ${cards.length.toLocaleString()}`);
  console.log(`  With nativeName:         ${withName.toLocaleString()}\n`);
  console.log('  VERDICTS:');
  console.log('  ─────────────────────────────────────');
  for (const v of ['verified', 'plausible', 'suspect', 'fail']) {
    console.log(`  ${v.padEnd(10)} ${String(verdicts[v]).padStart(6)}`);
  }

  const bad = details.filter((d) => d.verdict === 'fail' || d.verdict === 'suspect');
  if (bad.length > 0 && (VERBOSE || bad.length <= 40)) {
    console.log('\n  SUSPECT / FAIL:');
    console.log('  ─────────────────────────────────────');
    for (const d of bad) {
      console.log(`  [${d.verdict.toUpperCase().padEnd(7)}] ${d.code}  "${d.nativeName}" (${d.name}; src ${d.source})`);
      if (VERBOSE) for (const r of d.reasons) console.log(`           · ${r}`);
    }
  } else if (bad.length > 0) {
    console.log(`\n  ${bad.length} suspect/fail cards (re-run with --verbose to list)`);
  }

  if (BIAS) {
    console.log('\n  ENDONYM FILL BIAS (per macroarea / vitality):');
    console.log('  ─────────────────────────────────────');
    for (const dim of biasTable(biasRows)) {
      console.log(`\n  By ${dim.dimension}:`);
      console.log('  ' + 'group'.padEnd(26) + 'cards'.padStart(7) + 'withName'.padStart(10) + 'fill%'.padStart(8) + 'wall-ok'.padStart(9) + 'ok%'.padStart(7));
      for (const [k, a] of dim.rows) {
        console.log('  ' + String(k).padEnd(26)
          + String(a.cards).padStart(7)
          + String(a.withName).padStart(10)
          + (100 * a.withName / a.cards).toFixed(1).padStart(8)
          + String(a.eligible).padStart(9)
          + (100 * a.eligible / a.cards).toFixed(1).padStart(7));
      }
    }
  }

  // The evidence mirrors are what make a verdict an ATTESTATION rather than a
  // bare script-consistency guess. Report their availability in the payload so
  // a degraded run can never be mistaken for a full one.
  const evidenceAvailable = {
    linguameta: !!evidence.lm.available,
    wikidata: !!evidence.wd.available,
  };
  const degraded = !evidenceAvailable.linguameta || !evidenceAvailable.wikidata;
  const payload = { verdicts, evidenceAvailable, degraded, details };

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify(payload, null, 2) + '\n');
    console.log(`\n  Wrote ${JSON_OUT}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (JSON_STDOUT) {
    console.log = realLog;
    console.log(JSON.stringify(payload, null, 2));
  }
  if (CI && verdicts.fail > 0) {
    console.error(`  ❌ CI: ${verdicts.fail} card(s) with verdict=fail`);
    process.exit(1);
  }
  if (CI) console.log('  ✅ CI: no failing endonyms');
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
