#!/usr/bin/env node
/**
 * build-seam-runs.mjs — the homepage seam's PER-PAIR run data (metrics + the
 * corpus a pair is measured on), generated from the SSOTs so that which
 * metrics show, and which benchmark is named, is DATA-DRIVEN and honesty-checked
 * — never hand-picked. Output: cli/website/src/data/seam-runs.json.
 *
 * WHY (founder R3, 2026-07-22d): the tape's run-card, the chain panel's bridge
 * cards, and the transmit pop chips were showing COMET for pairs where COMET is
 * not a valid metric (e.g. spa↔quz — Quechua has no XLM-R support). The three
 * surfaces must draw metric NAMES + corpus from ONE generated record per pair.
 *
 * Sources (SSOT):
 *   • shared/metric-registry.json    — every metric NAME shown MUST resolve to a
 *       status:'implemented' registry id (fail-loud otherwise).
 *   • the COMPOSED language-card view (registers.getLanguageCard — the ONE JS
 *     adapter; a raw JSON.parse sees the atlas envelope shapes and none of the
 *     read-time config):
 *       - metricModelSupport.xlmr           → COMET is reliable for that language
 *       - metricModelSupport.africomet      → AfriCOMET is preferred (African)
 *       A metric is emitted for a PAIR only when BOTH languages qualify.
 *       (Flattened from the card's attributed envelope + the pivot marks in
 *       shared/catalogue/metric-coverage.json by registers.js.)
 *       - evalDatasets[]                     → the eval-set ids the language is
 *         actually measured on. Since the atlas cutover these are eval WIRING
 *         from shared/catalogue/card-config.json evalConfig (derived from the
 *         corpora cards by sync-eval-datasets.mjs), attached at read time —
 *         never stamped on the projected cards. The pair's benchmark is drawn
 *         from the INTERSECTION of the two languages' sets (a set they BOTH
 *         sit on).
 *   • shared/corpora-cards/<id>.json  — the chosen eval set's display name +
 *       SPDX license (name/license.spdx). Never hand-typed.
 *
 * HONESTY:
 *   • COMET / AfriCOMET never appear for a pair unless BOTH cards carry the gate.
 *   • The benchmark is a set BOTH languages are evaluated on (intersection) — so
 *     a pair with no shared eval set (spa↔quz, quy↔quz: quz has none) resolves to
 *     benchmark:null → the UI says "no held-out benchmark yet" (story truth).
 *   • Every emitted metric name is an implemented registry metric; scores stay
 *     illustrative (the run-card's standing footer discloses the regime), so no
 *     score is ever sourced here — only NAMES + CORPUS + LICENSE.
 */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {STORY_PAIRS} from '../website/src/utils/seamStory.mjs';
import {getLanguageCard} from '../lib/registers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = join(HERE, '..', 'shared');
const CORPORA = join(SHARED, 'corpora-cards');
const OUT = join(HERE, '..', 'website', 'src', 'data', 'seam-runs.json');

const fail = (msg) => {
  throw new Error(`[build-seam-runs] ${msg}`);
};
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const registry = readJSON(join(SHARED, 'metric-registry.json')).entries;

// ── route/chain-only pairs (not on the tape but drawn by the chain panel /
//    route beat) — every hop the story ever routes through must have a record.
const EXTRA_PAIRS = [
  {a: 'fao', b: 'spa'}, // the direct attempt that dies red
  {a: 'fao', b: 'eng'}, // the reroute pivot-in hop
  {a: 'eng', b: 'spa'}, // …an onward hop the search tries (a loser)
  {a: 'eng', b: 'quz'}, // the condensing measurement (fao→eng→quz)
  {a: 'eng', b: 'tgl'}, // the Answer Card query (Act VI — see ANSWER_QUERY)
];

/**
 * THE ANSWER-CARD QUERY (R5, Act VI — "the best method for YOUR purpose").
 *
 * The seam turns its own machinery on the visitor: a real pair + a real DOMAIN
 * code, answered with the real candidate methods. Everything structural here is
 * DERIVED, never typed:
 *   • the domain label + description come from shared/domain-taxonomy.json (the
 *     closed 17-code SSOT, whose own description says it exists to unblock
 *     "domain-specific routing" — exactly this feature);
 *   • the candidate METHODS are the methods whose own cited coverage list claims
 *     BOTH sides of the pair (catalogue/method-coverage.json `iso6393`), so the
 *     candidate set is a real coverage claim, not an invention;
 *   • the metric NAMES and the benchmark come from the same both-languages gate
 *     every other seam surface uses.
 * Only the RANKING/scores are illustrative (founder decision 2026-07-25), and
 * they carry the standing run-card disclosure — see CLAIMS.md.
 *
 * The `claimedCode` field is the honest wrinkle worth showing: Google/Microsoft/
 * MADLAD publish this language as `fil` (Filipino) while NLLB/OPUS/M2M/Libre
 * publish it as `tgl` (Tagalog). Same language, different label — which is
 * precisely the resolution work an INDEX exists to do.
 */
const ANSWER_QUERY = {src: 'eng', tgt: 'tgl', tgtAliases: ['fil'], domain: 'medical'};

// ── metric label → registry id. Every label must resolve implemented. ──
// (comet_score is the registry's single "COMET / AfriCOMET" capability; the
// language gate below decides which NAME a given pair may show.)
const METRIC_ID = {
  'chrF++': 'chrf_plus_plus',
  spBLEU: 'spbleu',
  BLEU: 'bleu',
  TER: 'ter',
  COMET: 'comet_score',
  AfriCOMET: 'comet_score',
};
const requireImpl = (label) => {
  const id = METRIC_ID[label];
  if (!id) fail(`metric label '${label}' has no registry id mapping`);
  if (!registry[id]) fail(`metric '${label}' → '${id}' is not in metric-registry.json`);
  if (registry[id].status !== 'implemented')
    fail(`metric '${label}' → '${id}' status is '${registry[id].status}', not 'implemented'`);
  return id;
};
// Validate the whole vocabulary up front (fail-loud before we emit anything).
for (const label of Object.keys(METRIC_ID)) requireImpl(label);

// ── cards, through the ONE JS adapter (registers caches composed views) ──
const card = (code) => {
  const c = getLanguageCard(code);
  if (!c) fail(`language card missing for '${code}'`);
  return c;
};
const hasXlmr = (code) => {
  const m = card(code).metricModelSupport;
  return !!(m && m.xlmr && (m.xlmr.tier || m.xlmr.supported));
};
const hasAfri = (code) => {
  const m = card(code).metricModelSupport;
  return !!(m && m.africomet && m.africomet.supported);
};
const evalSets = (code) => {
  const eds = card(code).evalDatasets;
  return Array.isArray(eds) ? eds : [];
};

// ── ISO 639-3 → macrolanguage code, so pinpoint eval ids that use the macro
//    (que covers quz/quy) still match. Extend as the cast grows. ──
const MACRO = {quz: 'que', quy: 'que', qub: 'que', qug: 'que'};
const macro = (c) => MACRO[c] || c;

// ── corpus display names + a short token → label, derived from the id. ──
const CORPUS_LABEL = {
  tatoeba: 'Tatoeba',
  globalvoices: 'GlobalVoices',
  flores: 'FLORES+',
  ntrex: 'NTREX-128',
  mafand: 'MAFAND-MT',
  alt: 'ALT',
  tico19: 'TICO-19',
  smol: 'SMOL',
  bouquet: 'BOUQUET',
  americasnlp2021: 'AmericasNLP 2021',
};
const parseEvalId = (id) => {
  // pinpoint: eval-<src>-<tgt>-<corpus>-<split>-v<n>
  let m = /^eval-([a-z]{3})-([a-z]{3})-([a-z0-9]+)-(dev|test|devtest|train)-v\d+$/.exec(id);
  if (m) return {id, pinpoint: true, src: m[1], tgt: m[2], corpus: m[3]};
  // multilingual set: eval-<corpus>-<split>-v<n>  (flores-devtest, ntrex-test…)
  m = /^eval-([a-z0-9]+)-(dev|test|devtest|train|doc|sent)-v\d+$/.exec(id);
  if (m) return {id, pinpoint: false, corpus: m[1]};
  return {id, pinpoint: false, corpus: id.replace(/^eval-/, '').split('-')[0]};
};
const corpusCard = (id) => {
  const p = join(CORPORA, `${id}.json`);
  return existsSync(p) ? readJSON(p) : null;
};
const shortName = (corpus) => CORPUS_LABEL[corpus] || (corpus ? corpus.toUpperCase() : 'corpus');

/**
 * Pick the benchmark for a pair from the intersection of the two languages'
 * eval sets, ranked so the most pair-specific, cleanest-licensed set wins.
 */
function pickBenchmark(a, b) {
  const A = new Set(evalSets(a));
  const shared = evalSets(b).filter((id) => A.has(id));
  if (!shared.length) return null;
  const wantA = macro(a);
  const wantB = macro(b);
  const scored = shared.map((id) => {
    const pe = parseEvalId(id);
    const cc = corpusCard(id);
    const quarantined = !!(cc && cc.quarantine);
    let score = 0;
    if (pe.pinpoint) {
      const s = macro(pe.src);
      const t = macro(pe.tgt);
      const exact = (s === wantA && t === wantB) || (s === wantB && t === wantA);
      score += exact ? 100 : 40;
    } else if (pe.corpus === 'flores') {
      score += 10; // generic all-pairs fallback
    } else {
      score += 20; // a named multilingual benchmark
    }
    if (quarantined) score -= 15; // ranking-quarantined sets are a last resort
    if (cc) score += 5; // we can name it + license it from its card
    return {id, pe, cc, quarantined, score};
  });
  scored.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
  const best = scored[0];
  const cc = best.cc;
  return {
    datasetId: best.id,
    name: (cc && cc.name) || `${shortName(best.pe.corpus)} (${best.id})`,
    short: shortName(best.pe.corpus),
    license: cc && cc.license ? cc.license.spdx || null : null,
    quarantined: best.quarantined,
  };
}

/** The metric NAMES a pair may honestly show (both-languages gated). */
function pairMetrics(a, b) {
  const metrics = ['chrF++'];
  if (hasXlmr(a) && hasXlmr(b)) metrics.push('COMET');
  if (hasAfri(a) && hasAfri(b)) metrics.push('AfriCOMET');
  metrics.push('spBLEU');
  if (metrics.length < 4) metrics.push('TER');
  return metrics.slice(0, 4);
}

// ── build the keyed record set (order-free key "min|max") ──
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const runs = {};
const allPairs = [
  ...STORY_PAIRS.map((p) => ({a: p.a, b: p.b})),
  ...EXTRA_PAIRS,
];
for (const {a, b} of allPairs) {
  const k = key(a, b);
  if (runs[k]) continue; // rerun row (spa↔quz appears twice) collapses to one record
  const bm = pickBenchmark(a, b);
  runs[k] = {
    a: a < b ? a : b,
    b: a < b ? b : a,
    metrics: pairMetrics(a, b),
    benchmark: bm ? {name: bm.name, short: bm.short, datasetId: bm.datasetId} : null,
    license: bm ? bm.license : null,
  };
}

// ── the Answer Card's derived payload (Act VI) ──
function buildAnswer() {
  const {src, tgt, tgtAliases, domain} = ANSWER_QUERY;
  const taxPath = join(HERE, '..', '..', 'shared', 'domain-taxonomy.json');
  if (!existsSync(taxPath)) fail(`domain-taxonomy.json missing (${taxPath})`);
  const tax = readJSON(taxPath);
  const desc = tax.domains && tax.domains[domain];
  if (!desc) fail(`domain '${domain}' is not in the closed domain-taxonomy SSOT`);

  // candidates = methods whose OWN cited coverage list claims both sides.
  const coverage = readJSON(join(SHARED, 'catalogue', 'method-coverage.json'));
  const tgtSet = [tgt, ...(tgtAliases || [])];
  const candidates = [];
  for (const m of coverage.methods || []) {
    const iso = new Set(m.iso6393 || []);
    if (!iso.has(src)) continue;
    const claimedCode = tgtSet.find((c) => iso.has(c));
    if (!claimedCode) continue;
    candidates.push({label: m.label, tier: m.tier, claimedCode, anyToAny: !!m.anyToAny});
  }
  if (!candidates.length) fail(`no method claims coverage of ${src}->${tgt} — the Answer Card would be empty`);

  const bm = pickBenchmark(src, tgt);
  return {
    src,
    tgt,
    domain: {code: domain, description: desc},
    metrics: pairMetrics(src, tgt),
    benchmark: bm ? {name: bm.name, short: bm.short, datasetId: bm.datasetId} : null,
    license: bm ? bm.license : null,
    candidates,
  };
}
const answer = buildAnswer();

const out = {
  _comment:
    'GENERATED by cli/scripts/build-seam-runs.mjs — do not hand-edit. Per-pair ' +
    'metric NAMES (both-languages gated by metricModelSupport) + the corpus a pair ' +
    'is measured on (intersection of the two languages\' evalDatasets → corpora-card ' +
    'name + SPDX license). Scores are illustrative and NOT stored here — only names.',
  _generatedFrom: [
    'shared/metric-registry.json',
    'shared/language-cards/*.json via registers.getLanguageCard (metricModelSupport flattened per shared/catalogue/metric-coverage.json)',
    'shared/catalogue/card-config.json evalConfig (evalDatasets — eval wiring, derived from the corpora cards)',
    'shared/corpora-cards/*.json (name, license.spdx)',
    'website/src/utils/seamStory.mjs (STORY_PAIRS)',
    'shared/domain-taxonomy.json (the Answer Card domain)',
    'shared/catalogue/method-coverage.json (the Answer Card candidate methods)',
  ],
  runs,
  answer,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
const withBm = Object.values(runs).filter((r) => r.benchmark).length;
const withComet = Object.values(runs).filter((r) => r.metrics.includes('COMET')).length;
const withAfri = Object.values(runs).filter((r) => r.metrics.includes('AfriCOMET')).length;
console.log(
  `[build-seam-runs] wrote ${OUT}\n  ${Object.keys(runs).length} pairs · ${withBm} with a named benchmark · ` +
    `${withComet} COMET-valid · ${withAfri} AfriCOMET-valid`,
);
