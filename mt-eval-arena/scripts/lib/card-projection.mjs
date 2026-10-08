/**
 * card-projection.mjs — normalized language card (+ atlas sidecars) → the
 * staged trading-card index/detail shapes.
 *
 * Everything here reads the atlas SSOT surface only:
 *   - the card, through normalizeCard() (the ONE adapter — never bare JSON),
 *   - atlas.db typed values (typology feature list),
 *   - the emitted forms artifact (vocabulary counts; items go to their own lane),
 *   - shared/licenses.json (license pass-through),
 *   - the staged derived tables (nearest / natural pairs).
 *
 * The legacy champollion.db facts store is not consulted anywhere.
 */

import { display, attributions, isAttributed } from '../../../cli/lib/cards/reader.js';
import { vitalityBadgeFromCard } from './vitality-map.mjs';

// ---------------------------------------------------------------------------
// INDEX CONTRACT — every camelCase field upload-trading-cards.mjs reads off a
// staged index entry (its snake_case mapping adds only updated_at, and sends
// `stats` twice, as challenge_rating and stats). Pinned by the contract test.
// ---------------------------------------------------------------------------
export const INDEX_CONTRACT = Object.freeze([
  'code', 'name', 'iso639_1', 'aliases', 'nativeName', 'family', 'genus',
  'macroarea', 'isIsolate', 'modality', 'isoType', 'isoScope', 'macrolanguage',
  'speakers', 'speakerCount', 'script', 'scripts', 'dir', 'vitalityBadge',
  'rarity', 'rarityOrder', 'stats', 'digitalToolkit', 'abilities',
  'pipelineLabel', 'pipelineEmoji', 'factCount', 'sourceCount',
  'hasVocabulary', 'hasTypology', 'hasPhonology', 'hasNearest',
  'hasNaturalPair', 'hasCultural', 'hasConflicts', 'dialectCount',
  'scriptName', 'regions', 'ancestry', 'glottocode', 'culturalAphorism',
]);

// ---------------------------------------------------------------------------
// LANGUAGE-CARD GATE
// ---------------------------------------------------------------------------

/** ISO specials that are code-table plumbing, not languages to catalogue. */
export const ISO_SPECIALS = new Set(['mis', 'mul', 'und', 'zxx']);

/**
 * Is this card a LANGUAGE row for the published catalogue? Locale cards are
 * projections of their language (excluded by their `locale` block, never by
 * code shape), and the ISO specials name "no language" rather than one.
 */
export function isPublishableLanguageCard(card) {
  if (!card || card.locale?.language) return false;
  if (ISO_SPECIALS.has(card.code)) return false;
  // Publish predicate: a card without a display name is unusable by every
  // list and grid — and prod's 8,681-row set is exactly the named cards.
  return typeof card.name === 'string' && card.name.length > 0;
}

/**
 * Fields where sources genuinely CONTRADICT each other (agreement
 * 'conflicting'). Walked on the RAW card (normalizeCard rewrites some
 * envelopes — e.g. speakerEstimates becomes a plain array — so disputes are
 * collected first). Returns [{ field, values: [{value, source}] }].
 *
 * 'incommensurable' is deliberately NOT counted: it marks multi-scale
 * recording by design (every card with two endangerment assessments carries
 * it — 7,417 of 8,681), and a conflict flag on 85% of the catalogue flags
 * nothing. The conflicting-only count is 3,292 (speakerEstimates 2,173,
 * classification.family 901, name 439, endonym 328, …).
 */
export function collectDisputedFields(rawCard) {
  const out = [];
  const walk = (val, path, depth) => {
    if (!val || typeof val !== 'object' || depth > 2) return;
    if (isAttributed(val)) {
      if (val.agreement === 'conflicting') {
        out.push({
          field: path,
          values: val.values.map((v) => ({ value: v?.value ?? null, source: v?.source ?? null })),
        });
      }
      return;
    }
    if (Array.isArray(val)) return; // arrays of scalars/objects carry no envelope
    for (const [k, v] of Object.entries(val)) {
      if (k.startsWith('_')) continue; // _fieldSources / _atlas / _card are metadata
      walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(rawCard, '', 0);
  return out;
}

// ---------------------------------------------------------------------------
// SPEAKERS
// ---------------------------------------------------------------------------

/** Format a raw speaker integer as a compact display string (~34K, ~1.4B). */
export function formatSpeakerNumber(num) {
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1_000_000_000) return `~${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `~${Math.round(num / 1_000_000)}M`;
  if (num >= 1_000) return `~${Math.round(num / 1_000)}K`;
  return `~${num}`;
}

/**
 * Headline speaker count from the card's CITED estimates only. The atlas
 * card carries no adjudicated `vitality.speakerCount`, so the headline is
 * the largest POSITIVE cited numeric estimate; range strings ("10-99") are
 * never elected as a headline (they stay, attributed, in the estimates
 * block). No estimate → 'Unknown', sort key 0.
 */
export function resolveSpeakerDisplay(card) {
  const ests = Array.isArray(card?.speakerEstimates) ? card.speakerEstimates : [];
  const positive = ests
    .map((e) => Number(e?.count))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (positive.length > 0) {
    const best = Math.round(Math.max(...positive));
    return { display: formatSpeakerNumber(best), count: best };
  }
  return { display: 'Unknown', count: 0 };
}

// ---------------------------------------------------------------------------
// METHOD SUPPORT → API PIPS
//
// methodSupport on an atlas card is EVIDENCE: {total, byTier, named[]} where
// each named entry is {value, variant, source, confidence}. The 6-pip lane
// keeps the legacy vendor set via an EXPLICIT allow-list over named[].
//
// Vendor → variant id (enumerated from the live corpus 2026-08-18; the only
// service variants present are google-translate, microsoft-translator,
// libretranslate, apertium, deepl, tilde, plus hf:* model claims):
//   googleTranslate      → 'google-translate'
//   deepl                → 'deepl'
//   microsoftTranslator  → 'microsoft-translator'
//   libreTranslate       → 'libretranslate'
//   nllb                 → 'hf:facebook/nllb*' — Meta's OWN model-card claim
//                          for its own model, the one model-card-declared
//                          entry accepted (a publisher's coverage list for
//                          its own model is the authoritative claim; third-
//                          party fine-tune cards are not)
//   llm                  → a named 'llm' variant. None exists on any card
//                          today, so the pip is false everywhere: the
//                          runtime's "an LLM will attempt anything" flag is
//                          a fact about the METHOD's shape, not per-language
//                          evidence, and the pip lane counts evidence only.
//
// Confidence vocabulary on the corpus is exactly {confirmed,
// partially-confirmed, fetched, model-card-declared}. Services count on the
// first three (a vendor list fetched from the vendor, or curated
// confirmation); model-card-declared counts only for the publisher-own nllb
// rule above.
// ---------------------------------------------------------------------------

const SERVICE_CONFIDENCE = new Set(['confirmed', 'partially-confirmed', 'fetched']);

const API_DEFS = [
  { id: 'googleTranslate', name: 'Google Translate' },
  { id: 'deepl', name: 'DeepL' },
  { id: 'microsoftTranslator', name: 'Microsoft Translator' },
  { id: 'libreTranslate', name: 'LibreTranslate' },
  { id: 'nllb', name: 'NLLB (Meta)' },
  { id: 'llm', name: 'LLM (GPT/Gemini)' },
];

const SERVICE_VARIANTS = {
  'google-translate': 'googleTranslate',
  deepl: 'deepl',
  'microsoft-translator': 'microsoftTranslator',
  libretranslate: 'libreTranslate',
  llm: 'llm',
};

/** Per-API support map from the card's methodSupport evidence. */
export function apiSupportFromCard(card) {
  const supported = Object.fromEntries(API_DEFS.map((a) => [a.id, false]));
  const named = Array.isArray(card?.methodSupport?.named) ? card.methodSupport.named : [];
  for (const entry of named) {
    const variant = String(entry?.variant ?? '');
    const confidence = String(entry?.confidence ?? '');
    const legacy = SERVICE_VARIANTS[variant];
    if (legacy && SERVICE_CONFIDENCE.has(confidence)) supported[legacy] = true;
    if (variant.toLowerCase().startsWith('hf:facebook/nllb')) supported.nllb = true;
  }
  return API_DEFS.map((a) => ({ id: a.id, name: a.name, supported: supported[a.id] }));
}

// ---------------------------------------------------------------------------
// DOCUMENTATION DEPTH — Glottolog MED, now a WORD on the card.
//
// Enumerated across the whole card corpus (2026-08-18):
//   'long grammar'      1,946 cards
//   'grammar'           1,036
//   'grammar sketch'    2,070
//   'phonology/text'    1,457
//   'Wordlist or less'  1,942
// (absent — no MED claim — on the remainder.)
//
// Frozen to the legacy 0–4 integer scale (4 = most extensively described):
// ---------------------------------------------------------------------------
export const MED_LEVELS = Object.freeze({
  'long grammar': 4,
  'grammar': 3,
  'grammar sketch': 2,
  'phonology/text': 1,
  'Wordlist or less': 0,
});

// ---------------------------------------------------------------------------
// GROUNDED STATS
// ---------------------------------------------------------------------------

/**
 * Clusivity vocabulary observed in the store (grambank binary + WALS
 * labels). Present: '1', 'Inclusive/exclusive', 'Only inclusive'. Anything
 * else ('0', 'No inclusive/exclusive', "'We' the same as 'I'", "No 'we'")
 * is an absence claim, not a presence one.
 */
export function isClusivityPresent(value) {
  if (value === true) return true;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'inclusive/exclusive' || s === 'only inclusive' || s === 'present';
}

/**
 * Challenge Rating + Digital Toolkit + vitality badge, all from the card
 * (and its resources arrays). `notes` receives non-fatal coverage tallies
 * (fields whose upstream ingest lane has not landed yet); `clusivity` is
 * the atlas inclusiveExclusive value for cards that predate its ingest.
 */
export function computeGroundedStats(card, opts = {}) {
  const { notes } = opts;
  // ----- COMPONENT A: API Support Gap (30%) -----
  const apiSupport = apiSupportFromCard(card);
  const apiSupported = apiSupport.filter((a) => a.supported).length;
  const apiTotal = apiSupport.length;
  const apiGap = (1 - apiSupported / apiTotal) * 100;

  // ----- COMPONENT B: Corpus Desert (25%) -----
  const res = card?.resources && !Array.isArray(card.resources) ? card.resources : {};
  const opusCorpora = Array.isArray(res.corpora) ? res.corpora.length : 0;
  const opusPresent = opusCorpora > 0;
  // resources.treebanks is a NEW field (UD lane, in flight). Absent = false
  // for now, tallied so the recalibration report can say how much of the
  // desert score is lane-absence rather than measured absence.
  const treebanks = Array.isArray(res.treebanks) ? res.treebanks.length : 0;
  const udPresent = treebanks > 0;
  if (!Array.isArray(res.treebanks) && notes) notes.treebanksAbsent++;
  const speech = Array.isArray(res.speech) ? res.speech.length : 0;
  const cvPresent = speech > 0;

  let corpusDesert = 0;
  if (!opusPresent) corpusDesert += 33.3;
  if (!udPresent) corpusDesert += 33.3;
  if (!cvPresent) corpusDesert += 33.4;

  // ----- COMPONENT C: Typological Distance (25%) -----
  const tp = card?.typologicalProfile ?? {};
  const typDistanceSources = [];
  let typDistance = 0;
  const src = (field) => {
    const v = card?._fieldSources?.[field];
    return Array.isArray(v) ? v[0] : (v ?? 'card');
  };

  // Word order: anything other than SVO (the English baseline) adds
  // difficulty — INCLUDING 'No dominant order', which is harder to model
  // than a fixed non-SVO order, not easier.
  if (typeof tp.wordOrder === 'string' && tp.wordOrder) {
    if (tp.wordOrder.toUpperCase() !== 'SVO') typDistance += 15;
    typDistanceSources.push(`wordOrder:${src('typologicalProfile.wordOrder')}`);
  }
  // Morphological case: either core or oblique case marking counts.
  if (tp.hasCoreCase === true || tp.hasObliqueCase === true) {
    typDistance += 15;
    typDistanceSources.push(`hasCase:${src('typologicalProfile.hasCoreCase')}`);
  }
  // Clusivity — no English equivalent. The card's own value wins; cards
  // that predate the A4.3 ingest fall back to the atlas param (the caller
  // passes `clusivity` from cldf_values). Truthy is an EXPLICIT vocabulary
  // — Grambank's binary '1' and WALS's presence labels — never
  // "anything not on a deny-list" (which would count "No 'we'").
  const ie = tp.inclusiveExclusive ?? opts?.clusivity;
  if (ie !== undefined && ie !== null && isClusivityPresent(ie)) {
    typDistance += 15;
    typDistanceSources.push(`inclusiveExclusive:${
      tp.inclusiveExclusive !== undefined
        ? src('typologicalProfile.inclusiveExclusive')
        : 'atlas:inclusiveExclusive'
    }`);
  }
  // Numeral classifiers — no English equivalent.
  if (tp.hasNumeralClassifiers === true) {
    typDistance += 15;
    typDistanceSources.push(`hasNumeralClassifiers:${src('typologicalProfile.hasNumeralClassifiers')}`);
  }
  // Grammatical gender adds agreement complexity.
  if (tp.hasSexBasedGender === true || tp.hasGenderInPronouns === true) {
    typDistance += 10;
    typDistanceSources.push(`hasGender:${src('typologicalProfile.hasSexBasedGender')}`);
  }
  // RTL text direction (card dir is CLDR script-derived via the adapter).
  if (card?.dir === 'rtl') {
    typDistance += 10;
    typDistanceSources.push('dir:cldr-script-metadata');
  }
  // Multiple scripts increase tokenization/normalization complexity.
  if (Array.isArray(card?.scripts) && card.scripts.length > 1) {
    typDistance += 10;
    typDistanceSources.push(`multiScript:${src('scripts')}`);
  }
  typDistance = Math.min(100, typDistance);

  // ----- COMPONENT D: Documentation Depth (20%) -----
  const medWord = card?.documentation?.medLevel;
  let medValue = 0; // no MED claim = undocumented (worst case), as before
  let docDepthSource = 'glottolog';
  if (medWord !== undefined && medWord in MED_LEVELS) {
    medValue = MED_LEVELS[medWord];
    docDepthSource = src('documentation.medLevel') || 'glottolog';
  } else if (medWord !== undefined) {
    throw new Error(`Unmapped documentation.medLevel "${medWord}" on ${card?.code} — extend MED_LEVELS deliberately`);
  }
  const docDepth = ((4 - medValue) / 4) * 100;

  const challengeScore = Math.round(
    apiGap * 0.30
    + corpusDesert * 0.25
    + typDistance * 0.25
    + docDepth * 0.20,
  );

  const challengeRating = {
    score: challengeScore,
    components: {
      apiGap: Math.round(apiGap),
      corpusDesert: Math.round(corpusDesert),
      typDistance: Math.round(typDistance),
      docDepth: Math.round(docDepth),
    },
    sources: [
      'api-verification',
      'card-resources(opus/treebanks/speech)',
      ...typDistanceSources,
      docDepthSource,
    ],
    tooltip: [
      `API Gap: ${Math.round(apiGap)} (${apiSupported}/${apiTotal} APIs)`,
      `Corpus: ${Math.round(corpusDesert)} (OPUS:${opusPresent ? '✓' : '✗'} UD:${udPresent ? '✓' : '✗'} Speech:${cvPresent ? '✓' : '✗'})`,
      `Typology: ${Math.round(typDistance)} (${typDistanceSources.length} features)`,
      `Docs: ${Math.round(docDepth)} (MED=${medValue})`,
    ].join(' | '),
  };

  // ----- DIGITAL TOOLKIT: 5 verifiable boolean pips -----
  const hasKeyboard = Array.isArray(res.keyboards) && res.keyboards.length > 0;
  const pips = [opusPresent, udPresent, cvPresent, apiSupported >= 1, hasKeyboard];
  const digitalToolkit = {
    pips,
    count: pips.filter(Boolean).length,
    labels: ['Parallel Corpus', 'Treebank', 'Speech Data', 'MT API', 'Keyboard'],
    details: {
      parallelCorpus: opusPresent ? { corpora: opusCorpora } : null,
      treebank: udPresent ? { treebanks } : null,
      speechData: cvPresent ? { resources: speech } : null,
      mtApiCount: apiSupported,
      keyboard: hasKeyboard,
    },
    sources: [
      opusPresent ? src('resources.corpora') : null,
      udPresent ? src('resources.treebanks') : null,
      cvPresent ? src('resources.speech') : null,
      'api-verification',
      hasKeyboard ? src('resources.keyboards') : null,
    ].filter(Boolean),
  };

  const vitality = vitalityBadgeFromCard(card);
  return { challengeRating, digitalToolkit, vitality, apiSupport };
}

// ---------------------------------------------------------------------------
// RARITY — score here; TIER assignment is percentile-anchored over the whole
// set, so it lives in the orchestrator (assignRarityTiers below).
// ---------------------------------------------------------------------------

export const RARITY_TIERS = {
  mythic: { tier: 'mythic', label: 'MYTHIC', emoji: '🔮', cssClass: 'rarityMythic' },
  legendary: { tier: 'legendary', label: 'LEGENDARY', emoji: '⭐', cssClass: 'rarityLegendary' },
  epic: { tier: 'epic', label: 'EPIC', emoji: '💎', cssClass: 'rarityEpic' },
  rare: { tier: 'rare', label: 'RARE', emoji: '🔷', cssClass: 'rarityRare' },
  uncommon: { tier: 'uncommon', label: 'UNCOMMON', emoji: '🟢', cssClass: 'rarityUncommon' },
  common: { tier: 'common', label: 'COMMON', emoji: '⚪', cssClass: 'rarityCommon' },
};

export const RARITY_ORDER = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

/**
 * The raw rarity score. Vitality urgency speaks the SAME vocabulary as the
 * badge (vitality-map.mjs / vitalityScale.js) — an unmapped level means the
 * two drifted, and that fails loud rather than manufacturing a rarity.
 * level null is the legitimate "no cited vitality" case and takes a
 * documented neutral 30.
 */
export function computeRarityScore(challengeRating, digitalToolkit, vitalityBadge) {
  const vitalityScores = { thriving: 10, shifting: 40, endangered: 70, critical: 90, dormant: 60 };
  const vitalityScore = vitalityBadge.level == null ? 30 : vitalityScores[vitalityBadge.level];
  if (vitalityScore === undefined) {
    throw new Error(
      `computeRarityScore: vitality level "${vitalityBadge.level}" has no urgency score — `
      + 'the vitalityScores map drifted from the badge vocabulary (vitality-map.mjs); update both deliberately',
    );
  }
  const toolkitDeficit = (5 - digitalToolkit.count) * 10;
  return challengeRating.score * 0.50 + toolkitDeficit * 0.30 + vitalityScore * 0.20;
}

/**
 * Percentile-anchored tier assignment preserving the LEGACY tier
 * PROPORTIONS (founder-chosen recalibration). `baselineCounts` are the tier
 * counts of the prod baseline snapshot; each tier keeps its share of the
 * new set. Deterministic tiebreak: (score desc, code asc).
 *
 * Returns { tiersByCode: Map(code → tier id), thresholds: {tier: minScore} }.
 */
export function assignRarityTiers(scored, baselineCounts) {
  const order = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  const baseTotal = order.reduce((a, t) => a + (baselineCounts[t] ?? 0), 0);
  if (baseTotal === 0) throw new Error('assignRarityTiers: empty baseline tier counts');
  const sorted = [...scored].sort((a, b) => (b.score - a.score) || a.code.localeCompare(b.code));

  const tiersByCode = new Map();
  const thresholds = {};
  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    const tier = order[i];
    const want = i === order.length - 1
      ? sorted.length - cursor // last tier absorbs rounding remainder
      : Math.round((baselineCounts[tier] ?? 0) / baseTotal * sorted.length);
    const slice = sorted.slice(cursor, cursor + want);
    for (const s of slice) tiersByCode.set(s.code, tier);
    if (slice.length > 0) thresholds[tier] = slice[slice.length - 1].score;
    cursor += want;
  }
  return { tiersByCode, thresholds };
}

// ---------------------------------------------------------------------------
// PROVENANCE — per-source citation counts from _fieldSources, joined to the
// license register and the atlas source table.
// ---------------------------------------------------------------------------

/**
 * Register lookup with the bare↔versioned alias tolerance the card linter
 * uses: exact id first, then the id with a trailing -vX[.Y…], -<12hex>, or
 * @stamp suffix stripped.
 */
export function licenseAliasCandidates(sourceId) {
  const out = [sourceId];
  const stripped = sourceId
    .replace(/@[\w.-]+$/, '')
    .replace(/-v[\d][\w.]*$/, '')
    .replace(/-[0-9a-f]{12}$/, '');
  if (stripped !== sourceId) out.push(stripped);
  // both suffix classes can stack (id-<hex>@date)
  const twice = stripped.replace(/-v[\d][\w.]*$/, '').replace(/-[0-9a-f]{12}$/, '');
  if (twice !== stripped) out.push(twice);
  return out;
}

/**
 * detail.provenance. `totalFacts` keeps its column name; the UNIT is now
 * cited card fields (was: SQLite fact rows) — stamped via `_unit` so no
 * consumer mistakes the two scales.
 */
export function assembleProvenance(card, disputedFields, { licenseFor, sourceMeta } = {}) {
  const perSource = new Map();
  const fieldSources = card?._fieldSources ?? {};
  for (const v of Object.values(fieldSources)) {
    for (const s of Array.isArray(v) ? v : [v]) {
      if (typeof s === 'string') perSource.set(s, (perSource.get(s) ?? 0) + 1);
    }
  }

  const sources = [...perSource.entries()]
    .map(([name, count]) => {
      const entry = { name, factCount: count, url: null };
      const meta = sourceMeta?.(name);
      if (meta) entry.url = meta.url ?? (meta.doi ? `https://doi.org/${meta.doi}` : null);
      const license = licenseFor?.(name);
      if (license) {
        entry.license = license.license_spdx ?? null;
        entry.licenseUrl = license.license_url ?? null;
        entry.attribution = license.attribution ?? null;
        if (license.non_commercial_only) entry.nonCommercial = true;
        if (license.requires_sharealike) entry.shareAlike = true;
      }
      return entry;
    })
    .sort((a, b) => b.factCount - a.factCount || a.name.localeCompare(b.name));

  return {
    _unit: 'cited-card-fields (was: facts)',
    totalFacts: Object.keys(fieldSources).length,
    sources,
    unresolvedConflicts: disputedFields.length,
    conflicts: disputedFields.map((d) => ({
      property: d.field,
      valueA: d.values[0]?.value ?? null,
      sourceA: d.values[0]?.source ?? null,
      valueB: d.values[1]?.value ?? null,
      sourceB: d.values[1]?.source ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// EXTERNAL LINKS — prefix tests over the card's cited sources.
// ---------------------------------------------------------------------------

export function assembleExternalLinks(card) {
  const links = [];
  const code = card.code;
  const glottocode = card.glottocode ?? null;
  const allSources = new Set();
  for (const v of Object.values(card?._fieldSources ?? {})) {
    for (const s of Array.isArray(v) ? v : [v]) if (typeof s === 'string') allSources.add(s);
  }
  const cites = (prefix) => [...allSources].some((s) => s.startsWith(prefix));

  if (glottocode) {
    links.push({ name: 'Glottolog', url: `https://glottolog.org/resource/languoid/id/${glottocode}`, icon: '📚' });
  }
  if (cites('wals')) {
    links.push({ name: 'WALS', url: `https://wals.info/languoid/lect/wals_code_${code}`, icon: '🗺️' });
  }
  links.push({ name: 'Ethnologue', url: `https://www.ethnologue.com/language/${code}`, icon: '🌐' });
  const corpora = Array.isArray(card?.resources?.corpora) ? card.resources.corpora : [];
  if (corpora.some((c) => /tatoeba/i.test(JSON.stringify(c ?? '')))) {
    links.push({ name: 'Tatoeba', url: `https://tatoeba.org/en/sentences/search?from=${code}`, icon: '💬' });
  }
  links.push({ name: 'OLAC', url: `http://www.language-archives.org/language/${code}`, icon: '🏛️' });
  if (cites('phoible')) {
    links.push({ name: 'PHOIBLE', url: `https://phoible.org/languages/${code}`, icon: '🔊' });
  }
  if (cites('grambank') && glottocode) {
    links.push({ name: 'Grambank', url: `https://grambank.clld.org/languages/${glottocode}`, icon: '🧬' });
  }
  return links;
}

// ---------------------------------------------------------------------------
// FIELD PROJECTIONS
// ---------------------------------------------------------------------------

/** classification.family/genus as display STRINGS (never '[object Object]'). */
export function projectClassification(card, { resolveGlottocode } = {}) {
  const cls = card?.classification ?? {};
  // family is a label here (the full disagreement stays in attributions()
  // and in the disputed-fields conflicts block), so the documented
  // first-value opt-in applies, exactly as it does for `name`.
  const family = display(cls.family, { onDisagreement: 'first' }) ?? 'Unknown';
  const genus = display(cls.genus, { onDisagreement: 'first' }) ?? null;
  const ancestryGlottocodes = Array.isArray(cls.ancestry) ? cls.ancestry : [];
  const ancestry = resolveGlottocode
    ? ancestryGlottocodes.map((gc) => resolveGlottocode(gc)).filter((n) => n !== null)
    : [];
  return {
    family: typeof family === 'string' ? family : 'Unknown',
    familyAttributions: attributions(cls.family),
    genus: typeof genus === 'string' ? genus : null,
    ancestry,
    ancestryGlottocodes,
    familyGlottocode: cls.familyGlottocode ?? null,
  };
}

/** scripts[] in the staged {name, source} shape; source is the field-level list. */
export function projectScripts(card) {
  const codes = Array.isArray(card?.scripts) ? card.scripts : [];
  const fs = card?._fieldSources?.scripts;
  const source = Array.isArray(fs) ? fs.join(', ') : (fs ?? null);
  return codes.map((c) => ({ name: typeof c === 'string' ? c : c?.code ?? null, source }))
    .filter((s) => s.name);
}

/** Colexification stats from the card's lexicalResources.
 * clicsTotalEntries / clicsContributingDatasets / colexificationDensity /
 * clicsUniqueForms are NEW atlas params not yet on cards OR in this
 * atlas.db build (A4.5 lane) — absent values are omitted, tallied by the
 * caller, never invented. */
export function projectColexification(card, { notes } = {}) {
  const lr = card?.lexicalResources ?? {};
  const out = {};
  for (const key of [
    'colexificationConcepts', 'colexifyingForms', 'clicsUniqueForms',
    'clicsTotalEntries', 'clicsContributingDatasets', 'colexificationDensity',
  ]) {
    if (lr[key] !== undefined) out[key] = lr[key];
  }
  if (out.colexificationConcepts === undefined) return null;
  if (out.clicsTotalEntries === undefined && notes) notes.clicsStatsAbsent++;
  const fs = card?._fieldSources?.['lexicalResources.colexificationConcepts']
    ?? card?._fieldSources?.lexicalResources;
  out.sources = Array.isArray(fs) ? fs : (fs ? [fs] : ['clics']);
  return out;
}
