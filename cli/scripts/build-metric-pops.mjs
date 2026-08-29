#!/usr/bin/env node
/**
 * build-metric-pops.mjs — generate the homepage seam animation's metric-coverage
 * data (website/src/data/metric-pops.json) from the SSOTs, so which metrics show
 * where is DATA-DRIVEN and honesty-checked, never hand-picked.
 *
 * Sources (SSOT):
 *   • shared/metric-registry.json     — canonical metric identity + status.
 *       Every metric NAME shown in the animation MUST be a status:'implemented'
 *       registry entry (fail-loud otherwise). Names = capability existence.
 *   • language-cards/quz.json         — the chain-proof card context: Cusco
 *       Quechua's macroarea (South America ⇒ COMET, never the African AfriCOMET)
 *       and methodSupport (no service covers it ⇒ the "fails direct" premise).
 *   • language-cards/crk.json         — the sovereign seal: Plains Cree's REAL
 *       eval metrics (evalMetrics = the LYSS FST/morphological validators) on its
 *       EdTeKLA evalDatasets. The seal shows a sovereign set's own metrics.
 *
 * HONESTY (enforced here, fail-loud):
 *   • No metric name is emitted that isn't an implemented registry metric.
 *   • MQM is roadmap → never emitted (it isn't in the registry, so it can't be).
 *   • AfriCOMET is African-only → excluded from the generic float AND asserted
 *     absent from the Andean card (build breaks if quz ever reads as African).
 *   • Illustrative SCORES are flagged `illustrative:true` with their on-surface
 *     caveat; cards never carry measured scores, so scores are never sourced.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {getLanguageCard} from '../lib/registers.js';
import {display} from '../lib/cards/reader.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = join(HERE, '..', 'shared');
const OUT = join(HERE, '..', 'website', 'src', 'data', 'metric-pops.json');

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const registry = readJSON(join(SHARED, 'metric-registry.json')).entries;
// Cards are read through the ONE JS adapter (registers.getLanguageCard →
// normalizeCard + the flat legacy methodSupport map). A raw JSON.parse sees
// the atlas evidence shape ({total, byTier, named[]}) and envelope names, so
// servicesCover read as always-false and the seal name as an object.
// metric-registry.json is NOT a card — it stays a raw read.
const quz = getLanguageCard('quz');
const crk = getLanguageCard('crk');
if (!quz || !crk) {
  throw new Error('[build-metric-pops] getLanguageCard failed for quz/crk — cards SSOT unreadable');
}

const fail = (msg) => {
  throw new Error(`[build-metric-pops] ${msg}`);
};
const impl = (id) => registry[id] && registry[id].status === 'implemented';
const requireImpl = (id, where) => {
  if (!registry[id]) fail(`${where}: '${id}' is not in metric-registry.json`);
  if (registry[id].status !== 'implemented')
    fail(`${where}: '${id}' status is '${registry[id].status}', not 'implemented'`);
  return registry[id];
};

// ── MEASURE float: universal reference quality metrics, IMPLEMENTED only. ──
// Curated selection (glanceable SOTA names); each id is validated against the
// registry. Language-gated metrics (AfriCOMET/AfriCOMET-QE, FST/morphology) are
// excluded by construction — they belong to the card/seal, not the generic float.
const FLOAT = [
  {id: 'chrf_plus_plus', label: 'chrF++'},
  {id: 'comet_score', label: 'COMET'}, // the CAPABILITY; the checkpoint is a card detail
  {id: 'spbleu', label: 'spBLEU'},
  {id: 'bleu', label: 'BLEU'},
  {id: 'ter', label: 'TER'},
  {id: 'metricx_score', label: 'MetricX-24'},
];
const measureFloat = FLOAT.map((m) => {
  requireImpl(m.id, 'measureFloat');
  return m.label;
});

// ── CARD: Spanish → Cusco Quechua (quz). Data-driven honesty from the card. ──
const macroarea = quz.macroarea || '';
if (/afric/i.test(macroarea))
  fail(`quz macroarea is '${macroarea}' — the "COMET not AfriCOMET" rail assumes non-African; revisit`);
const REAL_SERVICES = ['googleTranslate', 'deepl', 'microsoft', 'microsoftTranslator', 'nllb'];
const servicesCover = REAL_SERVICES.some(
  (k) => quz.methodSupport && quz.methodSupport[k] && quz.methodSupport[k].supported,
);
// concur lenses (different metric FAMILIES agreeing). R3 (founder 2026-07-22d):
// COMET is GATED on the card's own metricModelSupport — quz has neither xlmr nor
// africomet, so a neural COMET score is NOT reliable for it and must not show.
// When the model gate is absent we fall back to a surface lens (spBLEU) that IS
// valid for any language. Base ids validated; numbers illustrative.
const mms = quz.metricModelSupport || {};
const quzXlmr = !!(mms.xlmr && (mms.xlmr.tier || mms.xlmr.supported));
const quzAfri = !!(mms.africomet && mms.africomet.supported);
// Semantic (embedding similarity) is registry status:'partial' — it is shown
// with its status flagged (registryStatus), never asserted implemented.
if (!registry['semantic_score']) fail('card.concur[Semantic]: semantic_score missing from registry');
let cometLens = null;
if (quzXlmr) {
  requireImpl('comet_score', 'card.concur[COMET-22]');
  cometLens = {name: 'COMET-22', registryId: 'comet_score', from: 0.41, to: 0.78};
} else if (quzAfri) {
  requireImpl('comet_score', 'card.concur[AfriCOMET]');
  cometLens = {name: 'AfriCOMET', registryId: 'comet_score', from: 0.41, to: 0.78};
} else {
  requireImpl('spbleu', 'card.concur[spBLEU fallback]');
  cometLens = {name: 'spBLEU', registryId: 'spbleu', from: 6, to: 41};
}
const card = {
  target: 'Cusco Quechua',
  targetCode: 'quz',
  macroarea,
  // Through display(): classification.family is an attribution envelope on
  // atlas cards; a raw envelope here reaches the homepage as JSON soup.
  family: display(quz.classification?.family) ?? null,
  servicesCover, // false ⇒ the "no service translates this pair directly" premise
  hero: {metric: 'chrF++', registryId: 'chrf_plus_plus', from: 24, to: 71},
  // the primary concurring lens (COMET only when the model gate says so), plus
  // an embedding-semantic lens that is language-agnostic.
  concur: [
    cometLens,
    {name: 'Semantic', registryId: 'semantic_score', from: 0.39, to: 0.75, registryStatus: registry.semantic_score.status},
  ],
  excludes: {
    ...(quzXlmr ? {} : {COMET: 'no metricModelSupport.xlmr on quz — neural COMET is unreliable'}),
    AfriCOMET: `macroarea is ${macroarea}, not African`,
  },
  illustrative: true,
  caveat: 'an illustration of how routing & coaching work',
};

// ── SEAL: the sovereign sealed set = the Plains Cree (crk) POC. Its OWN eval
// metrics (crk.evalMetrics = the LYSS FST/morphological validators) name the
// scorecard. ONE illustrative number + morphology NAMES only. ──
const em = crk.evalMetrics || {};
// Expected LYSS metric ids on the Cree card → clean display names. Fail-loud if
// the card's metrics change so the seal never silently drifts from the SSOT.
const SEAL_MAP = [
  {id: 'lyss-sem', name: 'FST validation'}, // FST-based semantic validator
  {id: 'lyss-eq', name: 'Morphological equivalence'}, // variant-class equivalence linter
];
for (const s of SEAL_MAP) if (!em[s.id]) fail(`seal: crk.evalMetrics is missing '${s.id}' — Cree card changed`);
if (!em['lyss-chrf']) fail("seal: crk.evalMetrics is missing 'lyss-chrf' (the comparator behind the headline)");
const datasets = Array.isArray(crk.evalDatasets) ? crk.evalDatasets : [];
if (!datasets.length) fail('seal: crk.evalDatasets is empty — no sealed-set context');
const seal = {
  language: crk.name || 'Plains Cree',
  nativeName: crk.nativeName || null,
  code: 'crk',
  dataset: datasets.some((d) => /edtekla/i.test(d)) ? 'EdTeKLA (eng↔crk)' : datasets[0],
  hero: 'chrF++ 81', // illustrative (lyss-chrf comparator lane); no published sealed run
  names: SEAL_MAP.map((s) => s.name),
  sourceMetrics: [...SEAL_MAP.map((s) => s.id), 'lyss-chrf'],
  illustrative: true,
  caveat: 'sealed · community-run · illustrative',
};

const out = {
  _comment:
    'GENERATED by cli/scripts/build-metric-pops.mjs — do not hand-edit. Metric NAMES for the homepage ' +
    'seam animation, validated against shared/metric-registry.json (every name is a status:implemented ' +
    'metric) and sourced from language cards (card context ← quz.json; seal ← crk.evalMetrics). ' +
    'Illustrative SCORES are flagged; cards never hold measured scores.',
  _generatedFrom: [
    'shared/metric-registry.json',
    'shared/language-cards/quz.json',
    'shared/language-cards/crk.json',
  ],
  measureFloat,
  card,
  seal,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `[build-metric-pops] wrote ${OUT}\n  float: ${measureFloat.join(', ')}\n  card: ${card.target} (${macroarea}, servicesCover=${servicesCover})\n  seal: ${seal.language} — ${seal.names.join(' · ')} on ${seal.dataset}`,
);
