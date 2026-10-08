#!/usr/bin/env node

/**
 * derive-prose-intros.mjs
 * ────────────────────────────────────────────────────────────────
 * Assembles a 3–5 sentence encyclopedic intro per language card from
 * facts ALREADY PRESENT (and already cited) on the card. Writes to:
 *
 *   card.encyclopedic.intro             — the prose
 *   card.encyclopedic.intro_provenance  — "machine-assembled" |
 *                                         "human-reviewed-pending" |
 *                                         "human-reviewed"
 *   card.encyclopedic.intro_sources     — the card fact sources that
 *                                         contributed sentences
 *
 * NON-FABRICATION GUARANTEE:
 *   Every sentence is a template filled ONLY with values read off the
 *   card. If a fact is missing, its sentence is skipped — never
 *   guessed. If fewer than 3 sentences can be assembled, no intro is
 *   written at all.
 *
 * CURATED OVERRIDES:
 *   If cli/shared/curated-intros/<code>.md exists, its body is used
 *   verbatim instead of machine assembly. Frontmatter `reviewed: true`
 *   (flipped by the project after community review) upgrades the
 *   provenance from "human-reviewed-pending" to "human-reviewed".
 *
 * Usage:
 *   node scripts/derive-prose-intros.mjs --dry-run --lang crk   # preview one
 *   node scripts/derive-prose-intros.mjs --dry-run              # preview all
 *   node scripts/derive-prose-intros.mjs                        # write all cards
 *
 * NOTE: run this AFTER a card rebuild — it edits card JSONs in place.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CURATED_DIR = path.join(CLI_ROOT, 'shared', 'curated-intros');
const TC_FEATURES = path.join(CLI_ROOT, 'shared', 'explainers', 'tc-features.json');

// ─── CLI flags ─────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Helpers ───────────────────────────────────────────────────

function formatCount(n) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `about ${(n / 1e9).toFixed(1).replace(/\.0$/, '')} billion`;
  if (n >= 1e6) return `about ${(n / 1e6).toFixed(1).replace(/\.0$/, '')} million`;
  if (n >= 10000) return `about ${Math.round(n / 1000)},000`;
  return `about ${n.toLocaleString('en-US')}`;
}

const VITALITY_PHRASES = {
  'safe': 'is considered safe',
  'vulnerable': 'is classified as vulnerable',
  'definitely-endangered': 'is classified as definitely endangered',
  'severely-endangered': 'is classified as severely endangered',
  'critically-endangered': 'is classified as critically endangered',
  'extinct': 'is recorded as having no remaining first-language speakers',
  'dormant': 'is currently dormant',
};

/**
 * Record a source string for the provenance list. Sources come from the
 * card's own _fieldSources entries for the fields we read.
 */
function addSources(set, fieldSources, key) {
  const v = fieldSources?.[key];
  if (!v) return;
  if (typeof v === 'string') set.add(v);
  else if (Array.isArray(v)) for (const s of v) { if (typeof s === 'string') set.add(s); }
  else if (typeof v === 'object') {
    for (const s of Object.values(v)) if (typeof s === 'string') set.add(s);
  }
}

// Statuses for which no present-tense speaker count may be asserted — a
// living count flatly contradicts them (see sentenceSpeakers, #8).
const EXTINCT_STATUSES = new Set(['extinct', 'dormant']);

/** Oxford-comma join: [a] → "a"; [a,b] → "a and b"; [a,b,c] → "a, b, and c". */
function oxfordJoin(items) {
  return items.length === 1 ? items[0]
    : items.length === 2 ? `${items[0]} and ${items[1]}`
    : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Map ISO alpha-2 country codes to English names, dropping unresolvable ones. */
function countriesToNames(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  let display;
  try {
    display = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return [];
  }
  const names = [];
  for (const c of codes) {
    if (typeof c !== 'string') continue;
    const code = c.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    let name = null;
    try { name = display.of(code); } catch { name = null; }
    // DisplayNames echoes the code back when it can't resolve it — that
    // would leak "XK" etc. into prose, so drop those.
    if (name && name !== code) names.push(name);
  }
  return names;
}

// A verbatim speaker-estimate string may sit directly after "put it at"
// only when it reads as a clean quantity: a leading number with an
// optional magnitude word and NO embedded verb. Multi-clause prose
// ("~1.77M claim some ability; ~80,000 daily speakers") is grammatically
// wrong there and is rendered as its own clause instead (#31).
const QUANTITY_HEAD_RE = /^[~<>]?[\d.,]+\s*(K|M|thousand|million|billion)?\b/;
const ESTIMATE_VERB_RE = /\b(claims?|speaks?|uses?|reports?|reported|estimated?|understands?|remain(?:s|ing)?|according|includes?|included)\b/i;
function isCleanQuantity(s) {
  return QUANTITY_HEAD_RE.test(s) && !ESTIMATE_VERB_RE.test(s);
}

/**
 * Resolve a script name for prose. Raw ISO 15924 codes (e.g. "Latn",
 * "Cyrl") are mapped to human names via Intl.DisplayNames; unresolvable
 * codes (DisplayNames echoes the code back, or returns nothing) yield null
 * so the caller drops the clause rather than leaking the raw code (#21a).
 * Real names pass through unchanged.
 */
function humanizeScript(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const n = name.trim();
  if (/^[A-Z][a-z]{3}$/.test(n)) {
    let resolved = null;
    try { resolved = new Intl.DisplayNames(['en'], { type: 'script' }).of(n); }
    catch { resolved = null; }
    if (!resolved || resolved === n) return null;
    return resolved;
  }
  return n;
}

/** "the <name> script", unless <name> already ends in a script-type word (#21b). */
function scriptClause(name) {
  return /(?:script|alphabet|syllabary|abjad|hieroglyphs)$/i.test(name)
    ? `the ${name}`
    : `the ${name} script`;
}

// ─── Sentence assemblers ───────────────────────────────────────
// Each returns { text, sourceKeys: [...] } or null when the facts
// needed for the sentence are not on the card.

// Housekeeping-bucket leads (family: null cards; buckets defined in
// build-language-tree.mjs HOUSEKEEPING_BUCKETS). Each phrase states only
// what Glottolog's bucket itself asserts — no family is claimed.
// book1242 (Bookkeeping: spurious/retired entries) is deliberately absent:
// nothing can honestly be said about those, so no lead sentence is built.
// pidg1258/mixe1287 cards still carry a family (founder decision pending)
// and take the normal family path.
const BUCKET_LEADS = {
  arti1236: 'is a constructed language',
  uncl1493: 'is a language whose genealogical affiliation has not been established',
  unat1236: 'is reported to exist but has no attested linguistic data',
  spee1234: 'is a special-purpose speech register',
};

function sentenceClassification(card) {
  if (!card.name) return null;
  const family = card.classification?.family;
  if (!family) {
    const lead = BUCKET_LEADS[card.classification?.glottologBucket];
    if (!lead) return null;
    return { text: `${card.name} ${lead}.`, sourceKeys: ['classification'] };
  }

  const genus = card.classification?.genus;
  const isIsolate = card.isIsolate === true || /isolate/i.test(family);

  let lineage;
  if (isIsolate) {
    lineage = 'a language isolate, with no demonstrated relatives';
  } else if (genus && genus !== family) {
    lineage = `a language of the ${family} family (${genus} branch)`;
  } else {
    lineage = `a language of the ${family} family`;
  }

  // Region: prefer named regions, then countries, then macroarea. The
  // macroarea ("Papunesia") is only a last resort — a country ("Indonesia")
  // is far more informative — so it applies only when countries is ALSO empty.
  let where = null;
  const regionNames = (card.regions || [])
    .map(r => r.region || r.country)
    .filter(Boolean);
  const countryNames = countriesToNames(card.countries);
  if (regionNames.length > 0) {
    where = regionNames.slice(0, 3).join('; ');
  } else if (countryNames.length > 0) {
    where = countryNames.length > 3
      ? `${countryNames.slice(0, 3).join(', ')}, and elsewhere`
      : oxfordJoin(countryNames);
  } else if (card.macroarea) {
    where = card.macroarea;
  }

  const text = where
    ? `${card.name} is ${lineage}, spoken in ${where}.`
    : `${card.name} is ${lineage}.`;
  return { text, sourceKeys: ['classification', 'regions', 'countries', 'macroarea'] };
}

function sentenceSpeakers(card) {
  const vit = card.vitality || {};
  let countPhrase = null;   // a phrase that takes "... speaker(s)" after it
  let countValue = null;    // the raw numeric count behind countPhrase (plurals)
  let countClause = null;   // a full pre-built clause (string estimates)

  if (typeof vit.speakerCount === 'number') {
    countValue = vit.speakerCount;
    countPhrase = formatCount(countValue);
  } else if (typeof vit.speakerCount === 'string' && vit.speakerCount && !vit.speakerCount.startsWith('TODO')) {
    // String estimates (e.g. "~80M L1 (~310M total)") are wedged directly
    // after "put it at" only when they read as a clean quantity. Multi-clause
    // prose with embedded verbs ("~1.77M claim some ability; ~80,000 daily
    // speakers") is ungrammatical there (#31) — prefer a numeric max from
    // speakerEstimates[], else render it as its own labelled clause.
    const s = vit.speakerCount.trim();
    if (isCleanQuantity(s)) {
      countClause = `speaker estimates put it at ${s}`;
    } else {
      const counts = Array.isArray(card.speakerEstimates)
        ? card.speakerEstimates.map(e => e.count).filter(c => typeof c === 'number')
        : [];
      if (counts.length > 0) {
        countValue = Math.max(...counts);
        countPhrase = formatCount(countValue);
      } else {
        countClause = `reported speaker estimates: ${s}`;
      }
    }
  } else if (Array.isArray(card.speakerEstimates) && card.speakerEstimates.length > 0) {
    const counts = card.speakerEstimates.map(e => e.count).filter(c => typeof c === 'number');
    if (counts.length > 0) {
      countValue = Math.max(...counts);
      countPhrase = formatCount(countValue);
    }
  }

  const vitalityPhrase = VITALITY_PHRASES[vit.unescoStatus] || null;
  const isExtinct = EXTINCT_STATUSES.has(vit.unescoStatus);
  const speakerWord = `speaker${countValue === 1 ? '' : 's'}`;   // #20: no "1 speakers"

  if (countPhrase && vitalityPhrase) {
    // #8: never assert a present-tense living count for an extinct/dormant
    // language — "has N speakers and no remaining first-language speakers"
    // is a flat contradiction. Emit the vitality phrase alone, unless a
    // machine-checkable L2 signal lets us reframe the count as L2 use.
    if (isExtinct) {
      const l2 = /second language|L2 only/i.test(vit.notes || '');
      return l2
        ? {
            text: `The language ${vitalityPhrase}, though ${countPhrase} use it as a second language.`,
            sourceKeys: ['vitality', 'speakerEstimates'],
          }
        : { text: `The language ${vitalityPhrase}.`, sourceKeys: ['vitality'] };
    }
    return {
      text: `It has ${countPhrase} ${speakerWord} and ${vitalityPhrase}.`,
      sourceKeys: ['vitality', 'speakerEstimates'],
    };
  }
  if (countClause && vitalityPhrase) {
    return {
      text: `The language ${vitalityPhrase}; ${countClause}.`,
      sourceKeys: ['vitality', 'speakerEstimates'],
    };
  }
  if (countPhrase) {
    return { text: `It has ${countPhrase} ${speakerWord}.`, sourceKeys: ['vitality', 'speakerEstimates'] };
  }
  if (countClause) {
    const text = countClause.charAt(0).toUpperCase() + countClause.slice(1) + '.';
    return { text, sourceKeys: ['vitality', 'speakerEstimates'] };
  }
  if (vitalityPhrase) {
    return { text: `The language ${vitalityPhrase}.`, sourceKeys: ['vitality'] };
  }
  return null;
}

function sentenceWritingSystem(card) {
  const scripts = Array.isArray(card.scripts) ? card.scripts : [];
  const primary = scripts.find(s => s.primary) || scripts[0];

  if (primary?.name) {
    // Resolve names first: raw ISO 15924 codes become human names, and
    // unresolvable codes drop out entirely rather than leaking "Latn".
    const primaryName = humanizeScript(primary.name);
    const others = scripts
      .filter(s => s !== primary && s.name)
      .map(s => humanizeScript(s.name))
      .filter(Boolean);
    // If the primary code didn't resolve, salvage the first usable secondary.
    const [lead, ...rest] = primaryName ? [primaryName, ...others] : others;
    if (lead) {
      const text = rest.length > 0
        ? `It is written in ${scriptClause(lead)}, with ${rest.join(' and ')} also in use.`
        : `It is written in ${scriptClause(lead)}.`;
      return { text, sourceKeys: ['scripts', 'script'] };
    }
    // Both primary and secondaries were unresolvable codes — fall through.
  }
  if (card.scriptUnicodeName) {
    const name = humanizeScript(card.scriptUnicodeName.replace(/_/g, ' '));
    if (name) {
      return { text: `It is written in ${scriptClause(name)}.`, sourceKeys: ['script'] };
    }
  }
  return null;
}

/**
 * Pick 1–2 distinctive typological traits, rendered through the
 * tc-features explainer names so labels are human, not raw keys.
 */
function sentenceTypology(card, tcFeatures) {
  const tp = card.typologicalProfile;
  if (!tp || !tcFeatures) return null;

  const traits = [];

  // Word order first — most readable trait.
  if (typeof tp.wordOrderDominant === 'string' && tp.wordOrderDominant) {
    traits.push(`${tp.wordOrderDominant} as its dominant word order`);
  }

  // Then notable boolean features, in salience order.
  const BOOLEAN_TRAITS = [
    ['hasEvidentiality', 'grammatical evidentiality'],
    ['hasToneSystem', 'a tone system'],
    ['hasCaseMorphology', 'case morphology'],
    ['hasGenderSystem', 'a grammatical gender system'],
    ['hasNounClassifiers', 'noun classifiers'],
    ['hasNumeralClassifiers', 'numeral classifiers'],
    ['headMarking', 'head-marking grammar'],
  ];
  for (const [key, phrase] of BOOLEAN_TRAITS) {
    if (traits.length >= 2) break;
    if (tp[key] === true) {
      // Only surface keys that resolve in the explainer register, so
      // the UI can always link the trait to its explanation.
      const id = tcFeatures.propertyIndex?.[`card|${key}`];
      if (id) traits.push(phrase);
    }
  }

  if (traits.length === 0) return null;
  const text = traits.length === 1
    ? `Typologically, it has ${traits[0]}.`
    : `Typologically, it has ${traits[0]} and ${traits[1]}.`;
  return { text, sourceKeys: ['typologicalProfile'] };
}

function sentenceResources(card) {
  const ca = card.corpusAvailability || {};
  const bits = [];

  if (typeof ca.opus?.corpora === 'number') {
    bits.push(`${ca.opus.corpora} parallel ${ca.opus.corpora === 1 ? 'corpus' : 'corpora'} on OPUS`);
  }
  if (typeof ca.huggingFaceDatasets === 'number' && ca.huggingFaceDatasets > 0) {
    bits.push(`${ca.huggingFaceDatasets} Hugging Face dataset${ca.huggingFaceDatasets === 1 ? '' : 's'}`);
  }
  if (Array.isArray(card.resources?.fsts) && card.resources.fsts.length > 0) {
    bits.push('a morphological analyzer (FST)');
  }

  if (bits.length === 0) return null;
  const list = bits.length === 1 ? bits[0]
    : bits.length === 2 ? `${bits[0]} and ${bits[1]}`
    : `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`;
  return {
    text: `For language technology, catalogued resources include ${list}.`,
    sourceKeys: ['corpusAvailability', 'resources'],
  };
}

// ─── Curated intro loader ──────────────────────────────────────

/**
 * Parse a curated-intros/<code>.md file: optional YAML-ish frontmatter
 * between '---' fences, then the prose body.
 * Returns { body, reviewed, status } or null.
 */
function loadCuratedIntro(code) {
  const filePath = path.join(CURATED_DIR, `${code}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  let body = raw;
  let reviewed = false;
  let status = null;

  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (!m) continue;
      if (m[1] === 'reviewed') reviewed = m[2].trim() === 'true';
      if (m[1] === 'status') status = m[2].trim();
    }
  }

  // Collapse the markdown body to a single paragraph of plain prose.
  const text = body
    .replace(/^#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return { body: text, reviewed, status };
}

// ─── Assembly ──────────────────────────────────────────────────

function assembleIntro(card, tcFeatures) {
  const parts = [
    sentenceClassification(card),
    sentenceSpeakers(card),
    sentenceWritingSystem(card),
    sentenceTypology(card, tcFeatures),
    sentenceResources(card),
  ].filter(Boolean);

  // 3-sentence floor: with fewer facts the intro reads as filler.
  if (parts.length < 3) return null;

  const used = parts.slice(0, 5);
  const sources = new Set();
  for (const p of used) {
    for (const key of p.sourceKeys) addSources(sources, card._fieldSources, key);
  }
  // The typology sentence renders labels via the explainer register.
  if (used.some(p => p.sourceKeys.includes('typologicalProfile'))) {
    sources.add('tc-features.json');
  }

  return {
    intro: used.map(p => p.text).join(' '),
    sources: [...sources].sort(),
  };
}

// ─── Main ──────────────────────────────────────────────────────

function main() {
  let tcFeatures = null;
  if (fs.existsSync(TC_FEATURES)) {
    tcFeatures = JSON.parse(fs.readFileSync(TC_FEATURES, 'utf-8'));
  } else {
    console.warn('⚠️  shared/explainers/tc-features.json not found — typology sentences will be skipped');
  }

  let files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');
  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!files.includes(target)) {
      console.error(`Card not found: ${target}`);
      process.exit(1);
    }
    files = [target];
  }

  let written = 0;
  let curated = 0;
  let skipped = 0;

  for (const filename of files) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      skipped++;
      continue;
    }
    const code = card.code || filename.replace('.json', '');

    // 1. Curated intro takes precedence over machine assembly.
    const curatedIntro = loadCuratedIntro(code);
    let intro, provenance, sources;

    if (curatedIntro) {
      intro = curatedIntro.body;
      provenance = curatedIntro.reviewed ? 'human-reviewed' : 'human-reviewed-pending';
      sources = ['curated-intros/' + code + '.md'];
      curated++;
    } else {
      const assembled = assembleIntro(card, tcFeatures);
      if (!assembled) { skipped++; continue; }
      intro = assembled.intro;
      provenance = 'machine-assembled';
      sources = assembled.sources;
    }

    if (DRY_RUN) {
      console.log(`\n── ${code} (${card.name || '?'}) — ${provenance} ──`);
      console.log(intro);
      console.log(`  sources: ${sources.join(', ')}`);
    } else {
      card.encyclopedic = card.encyclopedic || {};
      card.encyclopedic.intro = intro;
      card.encyclopedic.intro_provenance = provenance;
      card.encyclopedic.intro_sources = sources;
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
    }
    written++;
  }

  console.log(`\n${DRY_RUN ? '[dry-run] would write' : 'Wrote'} ${written} intros ` +
              `(${curated} curated, ${written - curated} machine-assembled); ` +
              `${skipped} cards skipped (insufficient facts).`);
}

main();
