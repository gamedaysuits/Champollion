/**
 * prose-intros.mjs — encyclopedic intro assembly, computed at STAGING time
 * from a NORMALIZED card.
 *
 * Ported from cli/scripts/derive-prose-intros.mjs, which (a) read cards raw
 * (envelope fields rendered as '[object Object]') and (b) wrote its output
 * INTO the card files — forbidden post-cutover, where cards are build
 * output. The templates and the non-fabrication guarantee are unchanged;
 * the field reads speak the atlas card vocabulary through the adapter.
 *
 * NON-FABRICATION GUARANTEE: every sentence is a template filled only with
 * values read off the card. A missing fact skips its sentence; fewer than 3
 * assemblable sentences means NO intro.
 *
 * CURATED OVERRIDES: cli/shared/curated-intros/<code>.md wins verbatim;
 * frontmatter `reviewed: true` upgrades provenance to "human-reviewed".
 */

import fs from 'node:fs';
import path from 'node:path';
import { display } from '../../../cli/lib/cards/reader.js';

function formatCount(n) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `about ${(n / 1e9).toFixed(1).replace(/\.0$/, '')} billion`;
  if (n >= 1e6) return `about ${(n / 1e6).toFixed(1).replace(/\.0$/, '')} million`;
  if (n >= 10000) return `about ${Math.round(n / 1000)},000`;
  return `about ${n.toLocaleString('en-US')}`;
}

// The card's derived vitality tier vocabulary (shared/catalogue/
// vitality-scales.json `tiers`). 'unknown' deliberately has no phrase —
// silence is not a fact to narrate.
const VITALITY_PHRASES = {
  safe: 'is considered safe',
  vulnerable: 'is classified as vulnerable',
  endangered: 'is classified as endangered',
  extinct: 'is recorded as having no remaining first-language speakers',
};

// Statuses for which no present-tense speaker count may be asserted — a
// living count flatly contradicts them.
const EXTINCT_STATUSES = new Set(['extinct']);

function oxfordJoin(items) {
  return items.length === 1 ? items[0]
    : items.length === 2 ? `${items[0]} and ${items[1]}`
      : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function countriesToNames(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  let displayNames;
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch { return []; }
  const names = [];
  for (const c of codes) {
    if (typeof c !== 'string') continue;
    const code = c.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    let name = null;
    try { name = displayNames.of(code); } catch { name = null; }
    // DisplayNames echoes the code back when it can't resolve it — that
    // would leak "XK" etc. into prose, so drop those.
    if (name && name !== code) names.push(name);
  }
  return names;
}

/** ISO 15924 code → human script name; unresolvable codes yield null so the
 *  caller drops the clause rather than leaking "Latn". */
function humanizeScript(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const n = name.trim();
  if (/^[A-Z][a-z]{3}$/.test(n)) {
    let resolved = null;
    try { resolved = new Intl.DisplayNames(['en'], { type: 'script' }).of(n); } catch { resolved = null; }
    if (!resolved || resolved === n) return null;
    return resolved;
  }
  return n;
}

function scriptClause(name) {
  return /(?:script|alphabet|syllabary|abjad|hieroglyphs)$/i.test(name)
    ? `the ${name}`
    : `the ${name} script`;
}

function addSources(set, fieldSources, key) {
  const v = fieldSources?.[key];
  if (!v) return;
  if (typeof v === 'string') set.add(v);
  else if (Array.isArray(v)) for (const s of v) { if (typeof s === 'string') set.add(s); }
  else if (typeof v === 'object') {
    for (const s of Object.values(v)) if (typeof s === 'string') set.add(s);
  }
}

// Housekeeping-bucket leads (family-less cards). Each phrase states only
// what Glottolog's bucket itself asserts — no family is claimed.
const BUCKET_LEADS = {
  arti1236: 'is a constructed language',
  uncl1493: 'is a language whose genealogical affiliation has not been established',
  unat1236: 'is reported to exist but has no attested linguistic data',
  spee1234: 'is a special-purpose speech register',
};

function sentenceClassification(card) {
  if (!card.name) return null;
  const family = display(card.classification?.family, { onDisagreement: 'first' });
  if (!family) {
    const lead = BUCKET_LEADS[card.classification?.glottologBucket];
    if (!lead) return null;
    return { text: `${card.name} ${lead}.`, sourceKeys: ['classification.family'] };
  }

  const genus = display(card.classification?.genus, { onDisagreement: 'first' });
  const isIsolate = card.isIsolate === true || /isolate/i.test(family);

  let lineage;
  if (isIsolate) {
    lineage = 'a language isolate, with no demonstrated relatives';
  } else if (genus && genus !== family) {
    lineage = `a language of the ${family} family (${genus} branch)`;
  } else {
    lineage = `a language of the ${family} family`;
  }

  // Region: countries first (far more informative), macroarea last resort.
  let where = null;
  const countryNames = countriesToNames(card.countries);
  if (countryNames.length > 0) {
    where = countryNames.length > 3
      ? `${countryNames.slice(0, 3).join(', ')}, and elsewhere`
      : oxfordJoin(countryNames);
  } else if (card.macroarea) {
    where = card.macroarea;
  }

  const text = where
    ? `${card.name} is ${lineage}, spoken in ${where}.`
    : `${card.name} is ${lineage}.`;
  return { text, sourceKeys: ['classification.family', 'classification.genus', 'countries', 'macroarea'] };
}

function sentenceSpeakers(card) {
  const tier = card.vitality?.unescoStatus ?? null;
  const vitalityPhrase = VITALITY_PHRASES[tier] || null;
  const isExtinct = EXTINCT_STATUSES.has(tier);

  // The largest positive CITED numeric estimate — same election rule as the
  // headline count, so prose and header can never disagree.
  const counts = Array.isArray(card.speakerEstimates)
    ? card.speakerEstimates.map((e) => Number(e?.count)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const countValue = counts.length > 0 ? Math.max(...counts) : null;
  const countPhrase = countValue !== null ? formatCount(countValue) : null;
  const speakerWord = `speaker${countValue === 1 ? '' : 's'}`;

  if (countPhrase && vitalityPhrase) {
    // Never assert a present-tense living count for an extinct language —
    // emit the vitality phrase alone.
    if (isExtinct) {
      return { text: `The language ${vitalityPhrase}.`, sourceKeys: ['vitality'] };
    }
    return {
      text: `It has ${countPhrase} ${speakerWord} and ${vitalityPhrase}.`,
      sourceKeys: ['vitality', 'speakerEstimates'],
    };
  }
  if (countPhrase) {
    return { text: `It has ${countPhrase} ${speakerWord}.`, sourceKeys: ['speakerEstimates'] };
  }
  if (vitalityPhrase) {
    return { text: `The language ${vitalityPhrase}.`, sourceKeys: ['vitality'] };
  }
  return null;
}

function sentenceWritingSystem(card) {
  // The normalized card carries script CODES in scripts[] plus the parallel
  // scriptNames[]; the primary is card.script (cited-full-tag derivation).
  const codes = Array.isArray(card.scripts) ? card.scripts.filter((s) => typeof s === 'string') : [];
  const names = Array.isArray(card.scriptNames) ? card.scriptNames : [];
  const primaryCode = card.script ?? codes[0] ?? null;
  if (!primaryCode) return null;

  const primaryIdx = codes.indexOf(primaryCode);
  const primaryName = humanizeScript(names[primaryIdx] ?? primaryCode);
  const others = codes
    .filter((c) => c !== primaryCode)
    .map((c, i) => humanizeScript(names[codes.indexOf(c)] ?? c))
    .filter(Boolean);
  const [lead, ...rest] = primaryName ? [primaryName, ...others] : others;
  if (!lead) return null;
  const text = rest.length > 0
    ? `It is written in ${scriptClause(lead)}, with ${rest.join(' and ')} also in use.`
    : `It is written in ${scriptClause(lead)}.`;
  return { text, sourceKeys: ['scripts', 'scriptNames'] };
}

/** 1–2 distinctive typological traits, gated on the explainer register so
 *  the UI can always link the trait to its explanation. */
function sentenceTypology(card, tcFeatures) {
  const tp = card.typologicalProfile;
  if (!tp || !tcFeatures) return null;

  const traits = [];
  if (typeof tp.wordOrder === 'string' && tp.wordOrder && tp.wordOrder !== 'No dominant order') {
    traits.push(`${tp.wordOrder} as its dominant word order`);
  }

  // Atlas typologicalProfile vocabulary (WALS/Grambank-typed params).
  const BOOLEAN_TRAITS = [
    ['hasNumeralClassifiers', 'numeral classifiers'],
    ['hasCoreCase', 'core case morphology'],
    ['hasObliqueCase', 'oblique case morphology'],
    ['hasSexBasedGender', 'a sex-based grammatical gender system'],
    ['hasGenderInPronouns', 'gender distinctions in pronouns'],
  ];
  for (const [key, phrase] of BOOLEAN_TRAITS) {
    if (traits.length >= 2) break;
    if (tp[key] === true) {
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
  const res = (card.resources && !Array.isArray(card.resources)) ? card.resources : {};
  const bits = [];
  const corpora = Array.isArray(res.corpora) ? res.corpora.length : 0;
  if (corpora > 0) {
    bits.push(`${corpora} parallel ${corpora === 1 ? 'corpus' : 'corpora'} on OPUS`);
  }
  if (Array.isArray(res.fsts) && res.fsts.length > 0) {
    bits.push('a morphological analyzer (FST)');
  }
  if (Array.isArray(res.keyboards) && res.keyboards.length > 0) {
    bits.push(`${res.keyboards.length} keyboard layout${res.keyboards.length === 1 ? '' : 's'}`);
  }
  if (bits.length === 0) return null;
  const list = bits.length === 1 ? bits[0]
    : bits.length === 2 ? `${bits[0]} and ${bits[1]}`
      : `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`;
  return {
    text: `For language technology, catalogued resources include ${list}.`,
    sourceKeys: ['resources.corpora', 'resources.fsts', 'resources.keyboards'],
  };
}

/** Parse a curated-intros/<code>.md file. Returns {body, reviewed} or null. */
export function loadCuratedIntro(curatedDir, code) {
  const filePath = path.join(curatedDir, `${code}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  let body = raw;
  let reviewed = false;
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m && m[1] === 'reviewed') reviewed = m[2].trim() === 'true';
    }
  }
  const text = body.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return { body: text, reviewed };
}

/**
 * The encyclopedic block for one normalized card, or null when fewer than 3
 * sentences can be honestly assembled and no curated intro exists.
 * Shape matches what the detail blob and the card schema always carried:
 * { intro, intro_provenance, intro_sources }.
 */
export function assembleEncyclopedic(card, { tcFeatures, curatedDir } = {}) {
  if (curatedDir) {
    const curated = loadCuratedIntro(curatedDir, card.code);
    if (curated) {
      return {
        intro: curated.body,
        intro_provenance: curated.reviewed ? 'human-reviewed' : 'human-reviewed-pending',
        intro_sources: [`curated-intros/${card.code}.md`],
      };
    }
  }

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
  if (used.some((p) => p.sourceKeys.includes('typologicalProfile'))) {
    sources.add('tc-features.json');
  }

  return {
    intro: used.map((p) => p.text).join(' '),
    intro_provenance: 'machine-assembled',
    intro_sources: [...sources].sort(),
  };
}
