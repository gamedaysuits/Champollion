/**
 * card-integrity-rules.mjs
 * ────────────────────────────────────────────────────────────────
 * The six card-integrity ERROR rules (R1–R6), exported as the same
 * { id, severity, describe, check } objects lint-language-cards.mjs already
 * consumes (mirrors fix-card-corruption.mjs, so the linter and the rule logic
 * can never drift). Kept in their own module so node --test can exercise each
 * rule against fixtures without booting the whole linter.
 *
 * GOVERNING PRINCIPLE (project): Champollion is an INDEX, not an arbiter.
 * These rules enforce FAITHFUL REPRESENTATION + SURFACED DISAGREEMENT — NOT
 * "force the card to internally agree." A rule fires when a claim has NO source
 * that supports it, or wears a source that provably says otherwise — never
 * merely because two genuinely-cited sources disagree (that is the card doing
 * its job; the card should SHOW both).
 *
 *   R1 no-unsupported-assertion  — a typological prose claim / bit must be
 *        backed by a real source. Tone requires PHOIBLE isTonal===true
 *        (Grambank GB079 is "verb prefixes", never tone evidence). Mirror for
 *        case/evidentiality/gender vs the corrected Grambank-v2 typology bit.
 *   R2 value-supported-by-source — a numeric field's stamped UPSTREAM source
 *        must actually carry that value (reconciled against the card's own
 *        same-source speakerEstimates[] entry, or an atlas facts map when
 *        supplied via context.facts).
 *        Showing multiple disagreeing estimates is fine; a single collapsed
 *        number wearing a source that contradicts it is not.
 *   R3 no-run-results-on-cards   — no measured score (chrF/BLEU/COMET/TER,
 *        FST acceptance, %-valid…) may live on a language card. Run results
 *        belong on the leaderboard/edge. Capability/existence fields
 *        (pipelineReadiness.score, metric NAMES, methodSupport, evalDatasets)
 *        are allowed.
 *   R4 metric-label-match        — ban acceptance→"validity" relabels and
 *        "% of words" framing when the measurement is per-entry/per-sentence.
 *
 * See docs (fix-the-factory plan, VALIDATION+CI GATE section) for the diagnosis
 * these rules close.
 * ────────────────────────────────────────────────────────────────
 */

import _fs from 'node:fs';
import _path from 'node:path';
import { fileURLToPath as _fileURLToPath } from 'node:url';

// ─── Source-id normalization (self-contained; mirrors the base-form logic in
//     lint-language-cards.mjs stripVersionTokens so this module stays testable
//     in isolation) ────────────────────────────────────────────────────────

/** Lowercase base form of a source id with version/date tokens stripped. */
export function baseSource(id) {
  if (typeof id !== 'string') return '';
  return id
    // version token anywhere: -5.3, -2024, -v20, -1.0.3, -5.x, -P282
    .replace(/-(?:v?\d+(?:[._]\d+)*[a-z]?|\d+\.x|P\d+)(?=-|$)/g, '')
    // trailing parenthetical citation: "cldr-endonym (matched via fa)"
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Source ids that denote INTERNAL derivation/curation rather than an external
 * dataset asserting a value. A number labeled with one of these is an honestly
 * labeled derivation — R2 does not second-guess it.
 */
const INTERNAL_SOURCE_RE =
  /^(champollion-derived|derived|template-generated|manual-curation|not-populated|api-verification|cleanup|estimate)\b/i;

export function isInternalSource(id) {
  return INTERNAL_SOURCE_RE.test(String(id || '').trim());
}

// ─── R1 helpers ────────────────────────────────────────────────────────────

// An honest "tone not (yet) verified / a data gap" DISCLOSURE — the opposite of a
// tonal assertion. Recognized robustly (not just the exact "Tone not yet verified…"
// prefix) so a reworded gap note is not mistaken for a claim and falsely flagged.
const TONE_GAP_RE =
  /\btone\b[^.]*\b(not\s+(yet\s+)?(been\s+)?(verified|confirmed|established|coded)|unverified|a\s+data\s+gap)\b|\b(not\s+(yet\s+)?(verified|confirmed))\b[^.]*\btone\b/i;

/** Does the card ASSERT tone (prose challenge and/or the encyclopedic bit)? */
export function toneAssertion(card) {
  const lc = card.linguisticChallenges;
  const t = lc && typeof lc.tone === 'string' ? lc.tone.trim() : '';
  // A data-gap disclosure is NOT an assertion.
  const prose = t !== '' && !TONE_GAP_RE.test(t);
  const bit = card.encyclopedic?.typology?.tonePhonemic === true;
  return { prose, bit, asserted: prose || bit };
}

// An AFFIRMATIVE tonal claim in free prose (used ONLY for the unambiguous
// PHOIBLE-isTonal:false CONTRADICTION case). Excludes negations/gap notes.
const AFFIRMATIVE_TONE_RE =
  /\bphonemic\s+tone\b|\btonal\s+language\b|\b(is|are|highly|a)\s+tonal\b|\btone\b\s+(carries|distinguishes|is\s+phonemic|marks)\b/i;
// Negations that DISQUALIFY an affirmative match. NB: "atonal"/"non-tonal" are the
// single-word negations — do NOT let the article "a tonal" read as a negation.
const TONE_NEGATION_RE =
  /\bnon-?tonal\b|\batonal\b|\btoneless\b|\bnot\s+(a\s+)?tonal\b|\bno\s+(phonemic\s+)?tone\b|\blacks?\s+tone\b|not\s+phonemic/i;

/**
 * When PHOIBLE has DIRECTLY coded this language as non-tonal (isTonal===false),
 * an affirmative tonal claim ANYWHERE on the card is a self-contradiction — not
 * only in linguisticChallenges.tone / the encyclopedic bit. Scans the nearby
 * prose fields a mis-routed claim could land in. Returns the field path or null.
 * (Gated on isTonal===false, the unambiguous contradiction case: verified to
 * fire on ZERO of the 7,927 live cards, so it adds teeth without false positives.)
 */
export function contradictoryToneField(card) {
  if (card.phonologicalInventory?.isTonal !== false) return null;
  const candidates = [];
  const lc = card.linguisticChallenges;
  if (lc && typeof lc === 'object') {
    for (const [k, val] of Object.entries(lc)) {
      if (k === 'tone') continue; // the canonical field is handled by toneAssertion
      if (typeof val === 'string') candidates.push([`linguisticChallenges.${k}`, val]);
    }
  }
  if (typeof card.encyclopedic?.summary === 'string') candidates.push(['encyclopedic.summary', card.encyclopedic.summary]);
  if (typeof card.description === 'string') candidates.push(['description', card.description]);
  for (const [path, text] of candidates) {
    if (AFFIRMATIVE_TONE_RE.test(text) && !TONE_NEGATION_RE.test(text)) return path;
  }
  return null;
}

function citesGrambank(s) {
  return typeof s === 'string' && /grambank/i.test(s);
}

/**
 * Tone evidence Champollion accepts as faithful support for a POSITIVE tone
 * assertion:
 *   • PHOIBLE phonologicalInventory.isTonal === true — a direct coding of THIS
 *     language and the primary authority;
 *   • a tone claim cited to WALS, which codes tone (feature 13A) directly.
 * A family-level prior is NOT verified support — it is reframed as an explicit
 * "Tone not yet verified …" data-gap note (reword-family-tone-gaps.mjs), which
 * toneAssertion() treats as a non-assertion, so it never reaches here.
 * A PHOIBLE block that explicitly says isTonal === false is a CONTRADICTION and
 * overrides any secondary basis (the factory deletes such prose; this is the
 * regression guard). Grambank is NEVER tone evidence (GB079 = "verb prefixes").
 */
export function toneSupported(card) {
  const p = card.phonologicalInventory;
  if (p && p.isTonal === false) return false;   // PHOIBLE contradicts → unsupported
  if (p && p.isTonal === true) return true;      // direct PHOIBLE coding
  const prose = card.linguisticChallenges?.tone;
  if (typeof prose !== 'string') return false;   // bit-only assertion, PHOIBLE silent
  if (citesGrambank(prose)) return false;        // Grambank is never tone evidence
  // PHOIBLE silent: only a direct WALS coding counts as verified support.
  return /\bWALS\b/i.test(prose);
}

// ─── R3 / R4 patterns ───────────────────────────────────────────────────────

/** Normalize a key to bare lowercase alnum (for whole-key compound matching). */
function normKey(k) {
  return String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Split a key into lowercase word tokens (camelCase + digit + separator aware). */
function keyTokens(k) {
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase → camel Case
    .replace(/([A-Za-z])([0-9])/g, '$1 $2') // chrf2 → chrf 2
    .split(/[^A-Za-z0-9]+/)
    .map(t => t.toLowerCase())
    .filter(Boolean);
}

/**
 * MT/FST metric names that must never hold a NUMERIC value on a language card.
 * Matched as a WHOLE word token, so `cometScore`/`bleu`/`fstAcceptance` are
 * caught but ordinary words that merely contain them ("terms", "parameter",
 * "water") are not. Deliberately MT-specific: generic words ("score",
 * "coverage", "accuracy", "rate") are NOT metric tokens, because capability
 * composites (pipelineReadiness.score) and asserted tool-coverage strings
 * (resources.fsts[].coverage="~96%") are legitimate.
 */
const METRIC_TOKENS = new Set([
  'chrf', 'bleu', 'spbleu', 'sacrebleu', 'comet', 'africomet',
  'metricx', 'bertscore', 'blaser', 'meteor',
  // chrF++ / cchrF++ variants: the token splitter yields "chrfpp"/"chrfplus" as a
  // WHOLE token (no digit boundary), so plain 'chrf' misses `chrfppScore`. The
  // project's PRIMARY metric — must be caught in compound keys, not only bare.
  'chrfpp', 'chrfplus', 'cchrf', 'cchrfpp', 'cchrfplus', 'chrf2',
]);
/** Run-result key forms recognized by their whole normalized key. */
const METRIC_COMPOUND_KEY_RE =
  /^(chrfpp|chrfplus|cometqe|cometkiwi|cometda|ter|wer|terscore|werscore|fstaccept|fstacceptance|acceptancerate|morphologicalvalidity|morphvalidity|morphvalid|winrate)$/;
/** Adjacent token pairs that together name a run result. */
const METRIC_TOKEN_PAIRS = [
  ['fst', 'acceptance'], ['acceptance', 'rate'], ['win', 'rate'], ['morphological', 'validity'],
];

/** Does this key name an MT/FST run-result metric? */
function isMetricKey(key) {
  const tokens = keyTokens(key);
  if (tokens.some(t => METRIC_TOKENS.has(t))) return true;
  if (METRIC_COMPOUND_KEY_RE.test(normKey(key))) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (METRIC_TOKEN_PAIRS.some(([a, b]) => tokens[i] === a && tokens[i + 1] === b)) return true;
  }
  return false;
}

/**
 * A NUMBER bound to a run-result metric word inside a free-text value — the
 * shape the crk "91.5% morphologically valid words (FST acceptance…)" leak took.
 * Requires a digit so plain capability prose ("FST morphological validation")
 * and asserted tool figures without a metric verb ("~96%") never trip it.
 */
const METRIC_VALUE_RE =
  /\b\d[\d.,]*\s*%?\s*(morphologically\s+valid|valid\s+words|acceptance\s+rate|fst\s+acceptance|acceptance\s+over|win[-\s]?rate|bleu\b|chrf\b|comet\s+score|ter\s+score)/i;

// A run result where the NUMBER trails the metric name ("chrF++ of 57.7", "COMET
// score 0.81", "BLEU: 30"), or a bare unambiguous metric name adjacent to a number
// ("0.81 COMET", "30 BLEU"). Only metric names that are NOT ordinary English words
// go bare (bleu/chrf(++)/comet/spbleu/blaser/africomet/metricx/bertscore/meteor);
// the word-ambiguous ter/wer still require "score"/"rate" (handled above). A TIGHT
// connective (score|of|=|:|~|is|was| ) keeps citation years ("chrF++ (Popović
// 2015)") and version tags ("BLASER-3") from matching.
const _BARE_METRIC = String.raw`(?:sp)?bleu|sacrebleu|c?chrf(?:\+\+|pp|plus)?|comet(?:[-\s]?(?:kiwi|qe|da))?|africomet|metricx|bertscore|blaser|meteor`;
// Tight connective between a metric name and its number — allows a short run of
// linking words ("score of", "was", ":=") but NOT arbitrary prose, so a citation
// year ("chrF++ (Popović 2015)") or version tag ("BLASER-3") cannot bridge.
const _CONN = String.raw`(?:\s*(?:score|value|of|=|:|~|is|was|reached|scored|at)\b\s*){0,3}\s*`;
const METRIC_VALUE_TRAILING_RE = new RegExp(
  String.raw`\b(?:${_BARE_METRIC})${_CONN}\d[\d.,]*\s*%?` + '|' +
  String.raw`\b\d[\d.,]*\s*%?${_CONN}(?:${_BARE_METRIC})\b`,
  'i');

/**
 * R4 metric MISLABELS: acceptance dressed up as "validity", or a per-entry /
 * per-sentence measurement framed as "% of words".
 */
const MISLABEL_RES = [
  /\bacceptance\b[^.]{0,40}\bvalidity\b/i,
  /\bvalidity\b[^.]{0,40}\bacceptance\b/i,
  /morphologically\s+valid\s+words/i,
  /%\s*of\s+words[^.]{0,30}valid/i,
  /\bvalid(ity)?\b[^.]{0,30}per[-\s](entry|sentence)/i,
];

/** Paths whose numeric value is an allowlisted capability composite, not a score. */
const ALLOW_NUMERIC_PATHS = new Set(['$.pipelineReadiness.score']);

/**
 * Walk every leaf (key, value, path) of a card, skipping provenance/meta
 * containers (_fieldSources, _generated, _decontaminated, dataSources, …) which
 * legitimately carry source-id strings and are not card-facing facts.
 */
function walkLeaves(node, path, visit) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkLeaves(v, `${path}[${i}]`, visit));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (path === '$' && (key.startsWith('_') || key === 'dataSources')) continue;
      const childPath = `${path}.${key}`;
      if (value !== null && typeof value === 'object') {
        walkLeaves(value, childPath, visit);
      } else {
        visit(key, value, childPath);
      }
    }
  }
}

// ─── The rules ──────────────────────────────────────────────────────────────

/**
 * R1 — NO-UNSUPPORTED-ASSERTION.
 * The biggest defect class (~2,000 tone contradictions): a Grambank feature bit
 * promoted into plain-language prose the card's own primary data does not back.
 */
export const ruleNoUnsupportedAssertion = {
  id: 'no-unsupported-assertion',
  severity: 'error',
  describe: 'Typological claims (tone, case, evidentiality, gender) must be backed by a supporting source on the card',
  check: (card) => {
    const problems = [];

    // ── Tone — PHOIBLE isTonal===true is the ONLY acceptable evidence ──
    const tone = toneAssertion(card);
    if (tone.asserted && !toneSupported(card)) {
      const phon = card.phonologicalInventory;
      const detail = phon == null
        ? 'card has no phonologicalInventory (PHOIBLE) block'
        : `phonologicalInventory.isTonal=${JSON.stringify(phon.isTonal)}, tones=${JSON.stringify(phon.tones)}`;
      const where = [
        tone.prose ? 'linguisticChallenges.tone' : null,
        tone.bit ? 'encyclopedic.typology.tonePhonemic' : null,
      ].filter(Boolean).join(' + ');
      problems.push(
        `asserts tone (${where}) but PHOIBLE does not support it (${detail}); ` +
        `Grambank/GB079 is "verb prefixes", never tone evidence`
      );
    }

    // ── Tone claim mis-routed to a NON-canonical prose field while PHOIBLE has
    //    directly coded the language non-tonal — a self-contradiction the tone/
    //    bit check above does not see (it only inspects linguisticChallenges.tone
    //    + encyclopedic.typology.tonePhonemic). ──
    const contra = contradictoryToneField(card);
    if (contra) {
      problems.push(
        `asserts tone in ${contra} but PHOIBLE directly codes the language non-tonal ` +
        `(phonologicalInventory.isTonal=false) — a self-contradiction`
      );
    }

    // ── Case / evidentiality / gender — a GRAMBANK-cited prose claim must be
    //    backed by the corrected Grambank-v2 typology bit. Claims sourced to
    //    WALS / another real source are independently supported and NOT flagged
    //    (faithful representation — the card may show them as-is). ──
    const lc = card.linguisticChallenges || {};
    const tp = card.typologicalProfile || {};
    const features = [
      { keys: ['caseSystem'], bit: tp.hasCaseMorphology, field: 'typologicalProfile.hasCaseMorphology', label: 'case' },
      { keys: ['evidentiality'], bit: tp.hasEvidentiality, field: 'typologicalProfile.hasEvidentiality', label: 'evidentiality' },
      {
        keys: ['gender', 'genderAgreement'],
        // Gender support is true if ANY real source affirms it. The gender
        // object has two shapes across the corpus: the schema/canonical
        // {grammatical:true} (e.g. als/Albanian) and the Grambank-enriched
        // {hasGrammaticalGender:true} — accept either, plus the corrected
        // typologicalProfile bit, so a genuinely-gendered language that happens
        // to cite Grambank is NOT falsely flagged.
        bit: (tp.hasGenderSystem === true ||
              card.gender?.hasGrammaticalGender === true ||
              card.gender?.grammatical === true),
        field: 'typologicalProfile.hasGenderSystem',
        label: 'gender',
      },
    ];
    for (const f of features) {
      for (const key of f.keys) {
        const prose = lc[key];
        if (typeof prose === 'string' && prose.trim() !== '' && citesGrambank(prose) && f.bit !== true) {
          problems.push(
            `linguisticChallenges.${key} asserts ${f.label} citing Grambank, but no corrected source ` +
            `supports it (${f.field} is not true)`
          );
        }
      }
    }

    return problems.length ? problems.join('; ') : null;
  },
};

/**
 * R2 — VALUE-SUPPORTED-BY-SOURCE.
 * A numeric field stamped with an UPSTREAM source name must actually carry that
 * value at the named source. Reconciled against the card's own same-source
 * speakerEstimates[] entry (and an atlas facts map when context.facts is
 * provided — Map<`${code}|speakerCount|${base}`, number> built from
 * cli/data/atlas.db cldf_values).
 * The crk class: speakerCount=20,000 stamped 'linguameta-2024' while linguameta
 * on the same card says 4,100.
 */
export const ruleValueSupportedBySource = {
  id: 'value-supported-by-source',
  severity: 'error',
  describe: 'A numeric field stamped with an upstream source must match that source\'s own value (or be labeled champollion-derived)',
  check: (card, _filename, context = {}) => {
    const v = card.vitality;
    if (!v || typeof v.speakerCount !== 'number' || !Number.isFinite(v.speakerCount)) return null;

    const fs = card._fieldSources || {};
    const stamped =
      (typeof fs['vitality.speakerCount'] === 'string' && fs['vitality.speakerCount']) ||
      (typeof v.source === 'string' && v.source) ||
      (typeof fs.vitality === 'string' && fs.vitality) ||
      null;
    if (!stamped) return null;                 // no source claimed → nothing to contradict
    if (isInternalSource(stamped)) return null; // honestly labeled derivation/curation

    const base = baseSource(stamped);

    // (a) atlas facts-map reconciliation, when the facts SSOT is materialized
    //     (cli/data/atlas.db is gitignored / absent in the gate environment),
    //     so this is a best-effort layer; the on-card speakerEstimates[]
    //     check below is the load-bearing one.
    const facts = context.facts; // optional Map<`${code}|speakerCount|${base}`, number>
    if (facts && typeof facts.get === 'function') {
      const key = `${card.code}|speakerCount|${base}`;
      if (facts.has(key) && facts.get(key) !== v.speakerCount) {
        return `vitality.speakerCount=${v.speakerCount} is stamped source '${stamped}', but the atlas facts map records ` +
          `${facts.get(key)} for that source. Reconcile to the cited value or label source 'champollion-derived'.`;
      }
    }

    // (b) on-card same-source reconciliation against speakerEstimates[].
    const ests = Array.isArray(card.speakerEstimates) ? card.speakerEstimates : [];
    const allCounts = ests.filter(e => e && typeof e.count === 'number').map(e => e.count);
    const sameSource = ests.filter(e => e && typeof e.count === 'number' && baseSource(e.source) === base);
    if (sameSource.length > 0) {
      if (sameSource.some(e => e.count === v.speakerCount)) return null; // supported by its stamped source
      const shown = sameSource.map(e => e.count).join(', ');
      return `vitality.speakerCount=${v.speakerCount} is stamped source '${stamped}', but that source's own estimate ` +
        `on this card is ${shown} — a collapsed/adjudicated number wearing a source that does not support it. ` +
        `Reconcile to a cited speakerEstimates[] value or label source 'champollion-derived'.`;
    }

    // (c) The stamped source is ABSENT from speakerEstimates[]. The displayed
    //     count must still equal SOME cited estimate — the invariant is "a shown
    //     speakerCount equals a cited speakerEstimates[] entry (stamp its source)
    //     or carries champollion-derived provenance", NOT merely "does not
    //     contradict its own stamp". A number matching NONE of the cited estimates
    //     while wearing an upstream name is exactly the unsupported-count defect,
    //     just wearing a source that happens to have no on-card row to collide
    //     with. Fire only when there ARE estimates to check against — with none,
    //     the DB reconciliation in branch (a) is the (DB-gated) authority.
    if (allCounts.length > 0 && !allCounts.includes(v.speakerCount)) {
      return `vitality.speakerCount=${v.speakerCount} is stamped source '${stamped}', which has no entry in ` +
        `speakerEstimates[], and the number matches NONE of the cited estimates (${allCounts.join(', ')}) — an ` +
        `unsupported displayed count wearing an upstream name. Reconcile to a cited speakerEstimates[] value or ` +
        `label source 'champollion-derived'.`;
    }
    return null;
  },
};

/**
 * R3 — NO-RUN-RESULTS-ON-CARDS.
 * Run/method results (chrF/BLEU/COMET/TER, FST acceptance, %-valid) belong on
 * the leaderboard/edge keyed by (method, dataset, metric), never as a language
 * fact. Capability/existence fields are allowlisted.
 */
export const ruleNoRunResultsOnCards = {
  id: 'no-run-results-on-cards',
  severity: 'error',
  describe: 'No measured run/method score (chrF/BLEU/COMET/TER, FST acceptance, %-valid) may appear on a language card',
  check: (card) => {
    const hits = [];
    walkLeaves(card, '$', (key, value, path) => {
      // Numeric value under an MT/FST metric-named key.
      if (typeof value === 'number' && isMetricKey(key) && !ALLOW_NUMERIC_PATHS.has(path)) {
        hits.push(`${path.slice(2)}=${value} is a run-result metric value`);
        return;
      }
      // A number bound to a run-result metric word inside free text (either the
      // number-leads phrasings, or a metric name adjacent to a trailing/leading
      // number for the unambiguous bare metrics).
      if (typeof value === 'string'
          && (METRIC_VALUE_RE.test(value) || METRIC_VALUE_TRAILING_RE.test(value))) {
        hits.push(`${path.slice(2)} embeds a run result: ${JSON.stringify(value.slice(0, 80))}`);
      }
    });
    if (hits.length === 0) return null;
    const shown = hits.slice(0, 3).join('; ');
    const more = hits.length > 3 ? ` (+${hits.length - 3} more)` : '';
    return `${hits.length} run-result value(s) on a language card — these belong on the leaderboard/edge: ${shown}${more}`;
  },
};

/**
 * R4 — METRIC-LABEL-MATCH.
 * Ban acceptance→"validity" relabels and "% of words" framing for a measurement
 * that is per-entry/per-sentence. (FST acceptance over N sentences is NOT
 * "% of words morphologically valid".)
 */
export const ruleMetricLabelMatch = {
  id: 'metric-label-match',
  severity: 'error',
  describe: 'Eval/resource labels must not call acceptance "validity" or report per-entry measurements as "% of words"',
  check: (card) => {
    const hits = [];
    walkLeaves(card, '$', (_key, value, path) => {
      if (typeof value !== 'string') return;
      for (const re of MISLABEL_RES) {
        if (re.test(value)) {
          hits.push(`${path.slice(2)}: ${JSON.stringify(value.slice(0, 80))}`);
          return;
        }
      }
    });
    if (hits.length === 0) return null;
    const shown = hits.slice(0, 3).join('; ');
    const more = hits.length > 3 ? ` (+${hits.length - 3} more)` : '';
    return `${hits.length} metric mislabel(s) (acceptance↦validity / per-entry↦%-of-words): ${shown}${more}`;
  },
};

/**
 * R5 — FAMILY-NAME-MATCHES-GLOTTOLOG.
 * classification cites Glottolog, so classification.family must be the name
 * Glottolog gives classification.familyGlottocode — not a traditional
 * alternative ("Niger-Congo" for atla1278, "Kra-Dai" for taik1256) or a
 * spelling variant. "Language isolate" is the deliberate card convention when
 * the family glottocode is the language's own top-level languoid, and is
 * always allowed. Skips (never fails) when the local Glottolog snapshot
 * (cli/data/glottolog/languoid.csv) is not on disk.
 * Repair: node scripts/normalize-family-names-to-glottolog.mjs
 */
let _glottoNames = undefined; // Map | null (null = snapshot unavailable)
function loadGlottoNames() {
  if (_glottoNames !== undefined) return _glottoNames;
  try {
    const raw = _fs.readFileSync(
      _path.join(_path.dirname(_fileURLToPath(import.meta.url)), '..', 'data/glottolog/languoid.csv'),
      'utf8'
    );
    const lines = raw.split('\n');
    const parse = (line) => {
      const out = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    const header = parse(lines[0]);
    const idCol = header.indexOf('id');
    const nameCol = header.indexOf('name');
    _glottoNames = new Map();
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = parse(lines[i]);
      if (cols[idCol]) _glottoNames.set(cols[idCol], cols[nameCol]);
    }
  } catch {
    _glottoNames = null;
  }
  return _glottoNames;
}

/**
 * Read a field as a list of {value, source} claims, whatever shape it is in.
 *
 * The atlas emits `{agreement, consensus, values:[{value, source}]}` wherever
 * sources disagree and a bare value where they do not, and both corpora are in
 * play during the migration. A flat value reports `source: null` — the caller
 * decides whether an unattributed claim is checkable, rather than this helper
 * inventing a provenance it was not given.
 */
function _asAttributedValues(field) {
  if (field && typeof field === 'object' && Array.isArray(field.values)) {
    return field.values
      .filter((v) => v && typeof v === 'object')
      .map((v) => ({ value: v.value, source: v.source ?? null }));
  }
  if (field === null || field === undefined) return [];
  return [{ value: field, source: null }];
}

export const ruleFamilyNameMatchesGlottolog = {
  id: 'family-name-matches-glottolog',
  severity: 'error',
  describe: 'classification.family must be the Glottolog name for classification.familyGlottocode (isolates exempt)',
  check: (card) => {
    const cl = card?.classification;
    if (!cl?.family || !cl?.familyGlottocode) return null;
    const names = loadGlottoNames();
    if (!names) return null; // snapshot not on disk — cannot check here
    const canonical = names.get(cl.familyGlottocode);
    if (!canonical) return null;

    // `family` is an ATTRIBUTION ENVELOPE wherever sources disagree, and 1,007
    // languages genuinely do: Glottolog says "Atlantic-Congo" where WALS says
    // "Niger-Congo", and both are defensible classifications from respected
    // authorities. Reading the envelope as a string stringified it to
    // "[object Object]" and failed 8,127 cards — the check was broken, not the
    // data.
    //
    // Checking the CONSENSUS would be worse than useless here: on a disputed
    // family there is no consensus, so the rule would either skip exactly the
    // cards worth checking or demand the atlas elect Glottolog the winner —
    // the flattening the standing "show all sources attributed" rule forbids.
    //
    // So the rule now asks the only question that has a right answer: does
    // GLOTTOLOG'S OWN recorded value match Glottolog's name for the
    // glottocode? WALS is free to disagree; Glottolog is not free to be
    // misquoted. That is strictly stronger than the old check, which could
    // only ever see one flattened value.
    // A flat value carries no source of its own. That is the OLD card shape,
    // whose `family` was Glottolog's by construction, so it stays checked —
    // dropping it would have quietly retired the rule for every card that had
    // not yet been rebuilt.
    const claims = _asAttributedValues(cl.family);
    const offenders = claims
      .filter((c) => (c.source === null || /^glottolog/i.test(c.source))
        && c.value !== canonical && c.value !== 'Language isolate')
      .map((c) => `${c.source ?? 'card'} says "${c.value}"`);
    if (offenders.length === 0) return null;
    return `classification.family misquotes Glottolog for ${cl.familyGlottocode} `
      + `(Glottolog's name is "${canonical}"): ${offenders.join('; ')} `
      + '— fix at the generator, then regenerate';
  },
};

/**
 * R6 — DERIVED-FIELDS-CARRY-DERIVED-PROVENANCE.
 * Values Champollion computes must never wear a bare upstream name
 * (CLAUDE.md derived-values doctrine). Locks in the generator fixes for the
 * two known offenders: dialectCount (a count extracted from Glottolog's
 * languoid hierarchy → derived:glottolog-…) and scriptUnicodeName (an alias
 * lookup on the card's own script field → derived:script) — plus the
 * 2026-07-12 derived additions: orthographies (restructured from scripts[] +
 * orthographicStatus by derive-orthographies.mjs) and
 * typologicalProfile.morphologicalSynthesis (computed from on-card WALS
 * signals by derive-morphological-synthesis.mjs). Keys may be dotted paths;
 * the _fieldSources stamp is looked up under the same dotted key.
 * (resources.grammars is NOT here: those entries are Glottolog's own MED
 * citation records reported verbatim, faithfully stamped 'glottolog-5.3'.)
 */
const DERIVED_FIELD_STAMPS = {
  // dialectCount is NOT here, and its removal is the point.
  //
  // It was listed as ours on the belief that we counted Glottolog's dialect
  // rows. We do not: Glottolog ships a `child_dialect_count` COLUMN
  // (languoid.csv, col 14) and the ingester reports it verbatim. So the honest
  // stamp is `glottolog-v5.3`, and demanding `derived:` here forced 3,100
  // cards to take credit for someone else's count — the provenance rule
  // pointed backwards. shared/cldf/parameters.csv records the same correction:
  // "an earlier registry claimed it as champollion-derived, which took credit
  // for someone else's count."
  //
  // The rule itself is sound and stays. Only this entry was wrong.
  scriptUnicodeName: /^(champollion-)?derived([:\-]|$)/,
  orthographies: /^(champollion-)?derived([:\-]|$)/,
  'typologicalProfile.morphologicalSynthesis': /^(champollion-)?derived([:\-]|$)/,
};

/** Resolve a possibly-dotted field path against a card. */
function getFieldPath(card, fieldPath) {
  return fieldPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), card);
}

export const ruleDerivedFieldsProvenance = {
  id: 'derived-fields-carry-derived-provenance',
  severity: 'error',
  describe: 'Champollion-computed fields (scriptUnicodeName, orthographies, typologicalProfile.morphologicalSynthesis) must carry derived: provenance, never a bare upstream name — dialectCount is deliberately NOT here: it is Glottolog\'s own child_dialect_count column, reported verbatim',
  check: (card) => {
    const hits = [];
    for (const [field, re] of Object.entries(DERIVED_FIELD_STAMPS)) {
      const value = getFieldPath(card, field);
      if (value === null || value === undefined) continue;
      // The atlas stamps a LIST of sources per field (a value can be attested
      // by several); the old corpus stamped one string. Both are read, and a
      // list must have EVERY source derived — one honest `derived:` entry
      // beside a bare upstream name still means part of the value is credited
      // to someone who did not assert it.
      const stamp = card?._fieldSources?.[field];
      const stamps = Array.isArray(stamp) ? stamp : [stamp];
      const ok = stamps.length > 0
        && stamps.every((s) => typeof s === 'string' && re.test(s));
      if (!ok) {
        hits.push(`${field} (stamp: ${JSON.stringify(stamp ?? null)})`);
      }
    }
    if (hits.length === 0) return null;
    return `derived field(s) without derived: provenance — ${hits.join('; ')}`;
  },
};

/** The six ERROR-severity card-integrity rules, in R1–R6 order. */
export const cardIntegrityRules = [
  ruleNoUnsupportedAssertion,
  ruleValueSupportedBySource,
  ruleNoRunResultsOnCards,
  ruleMetricLabelMatch,
  ruleFamilyNameMatchesGlottolog,
  ruleDerivedFieldsProvenance,
];

/** The rule ids the focused card-integrity gate scopes its exit code to. */
export const CARD_INTEGRITY_RULE_IDS = cardIntegrityRules.map(r => r.id);
