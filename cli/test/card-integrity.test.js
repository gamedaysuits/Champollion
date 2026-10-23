/**
 * Card-integrity gate regression tests (R1–R4).
 *
 * Anchored on the three confirmed known-bad cases from the integrity diagnosis:
 *   • quy "tonal"        — a Grambank tone bit promoted to prose that the card's
 *                          own PHOIBLE block (isTonal:false) contradicts.
 *   • crk speakerCount   — 20,000 stamped 'linguameta-2024' while linguameta on
 *                          the same card says 4,100.
 *   • synthetic crk 91.5 — an FST-acceptance run result ("91.5% morphologically
 *                          valid words") leaked onto a language card + mislabeled.
 *
 * The fixtures are SYNTHETIC (they encode the bug SHAPE), so they stay valid
 * regression anchors after the factory fix regenerates the live cards — a test
 * that loaded the live quy.json would flip to failing once quy is repaired.
 *
 * GOVERNING PRINCIPLE: the gate enforces faithful representation + surfaced
 * disagreement, NOT "make the card agree with itself." Each rule therefore has
 * both a fires-on-the-bug case AND a must-not-fire case proving it does not
 * punish a genuinely-sourced claim or honest multi-source disagreement.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ruleNoUnsupportedAssertion,
  ruleValueSupportedBySource,
  ruleNoRunResultsOnCards,
  ruleMetricLabelMatch,
  cardIntegrityRules,
  CARD_INTEGRITY_RULE_IDS,
  baseSource,
  isInternalSource,
} from '../scripts/card-integrity-rules.mjs';

const R1 = (c) => ruleNoUnsupportedAssertion.check(c, 'fixture.json', {});
const R2 = (c, ctx = {}) => ruleValueSupportedBySource.check(c, 'fixture.json', ctx);
const R3 = (c) => ruleNoRunResultsOnCards.check(c, 'fixture.json', {});
const R4 = (c) => ruleMetricLabelMatch.check(c, 'fixture.json', {});

// A minimal card with none of the integrity-relevant fields — must be clean.
const CLEAN_MINIMAL = {
  code: 'xxx',
  name: 'Test Language',
  phonologicalInventory: { isTonal: false, tones: 0, source: 'phoible-2.0' },
  typologicalProfile: { source: 'grambank-1.0.3' },
  vitality: {},
  speakerEstimates: [],
  pipelineReadiness: { score: 40, source: 'derived' },
};

// -----------------------------------------------------------------
// Rule wiring
// -----------------------------------------------------------------

describe('card-integrity rule set', () => {
  it('exports exactly the six R1–R6 rules, all ERROR severity', () => {
    assert.equal(cardIntegrityRules.length, 6);
    assert.deepEqual(CARD_INTEGRITY_RULE_IDS, [
      'no-unsupported-assertion',
      'value-supported-by-source',
      'no-run-results-on-cards',
      'metric-label-match',
      'family-name-matches-glottolog',
      'derived-fields-carry-derived-provenance',
    ]);
    for (const r of cardIntegrityRules) assert.equal(r.severity, 'error');
  });

  it('all rules pass on a clean minimal card (no false positives)', () => {
    for (const r of cardIntegrityRules) {
      assert.equal(r.check(CLEAN_MINIMAL), null, r.id);
    }
  });
});

// -----------------------------------------------------------------
// R5 — family-name-matches-glottolog
// -----------------------------------------------------------------

describe('R5 family-name-matches-glottolog', () => {
  const R5 = cardIntegrityRules.find(r => r.id === 'family-name-matches-glottolog');

  it('FIRES: traditional family name on a Glottolog-cited glottocode', () => {
    const msg = R5.check({
      code: 'yor',
      classification: { family: 'Niger-Congo', familyGlottocode: 'atla1278' },
    });
    assert.ok(msg && msg.includes('Atlantic-Congo'));
  });

  it('passes: Glottolog canonical name', () => {
    assert.equal(R5.check({
      code: 'yor',
      classification: { family: 'Atlantic-Congo', familyGlottocode: 'atla1278' },
    }), null);
  });

  it('passes: Language isolate convention', () => {
    assert.equal(R5.check({
      code: 'zun',
      classification: { family: 'Language isolate', familyGlottocode: 'zuni1245' },
    }), null);
  });

  it('passes: no familyGlottocode to check against', () => {
    assert.equal(R5.check({ code: 'xgi', classification: { family: null } }), null);
  });
});

// -----------------------------------------------------------------
// R6 — derived-fields-carry-derived-provenance
// -----------------------------------------------------------------

describe('R6 derived-fields-carry-derived-provenance', () => {
  const R6 = cardIntegrityRules.find(r => r.id === 'derived-fields-carry-derived-provenance');

  it('passes: dialectCount cited to Glottolog, whose OWN column it is', () => {
    // Corrected 2026-08-12. This test used to assert the opposite, on the
    // belief that we counted Glottolog's dialect rows ourselves. We do not:
    // languoid.csv ships a `child_dialect_count` column and the ingester
    // reports it verbatim, so `glottolog-v5.3` is the honest stamp and
    // demanding `derived:` made 3,100 cards take credit for someone else's
    // count. shared/cldf/parameters.csv records the same correction.
    assert.equal(R6.check({
      code: 'aab',
      dialectCount: 5,
      _fieldSources: { dialectCount: ['glottolog-v5.3'] },
    }), null);
  });

  it('FIRES: a genuinely derived field wearing a bare upstream name', () => {
    const msg = R6.check({
      code: 'bku',
      script: 'Buhd',
      scriptUnicodeName: 'Buhid',
      _fieldSources: { scriptUnicodeName: 'iso15924-2024' },
    });
    assert.ok(msg && msg.includes('scriptUnicodeName'));
  });

  it('FIRES: a source LIST where only some entries are derived', () => {
    // A list must be derived throughout — one honest `derived:` beside a bare
    // upstream name still credits part of the value to a non-asserter.
    const msg = R6.check({
      code: 'bku',
      script: 'Buhd',
      scriptUnicodeName: 'Buhid',
      _fieldSources: { scriptUnicodeName: ['derived:script', 'iso15924-2024'] },
    });
    assert.ok(msg && msg.includes('scriptUnicodeName'));
  });

  it('FIRES: scriptUnicodeName with no stamp at all', () => {
    const msg = R6.check({ code: 'bku', script: 'Buhd', scriptUnicodeName: 'Buhid' });
    assert.ok(msg && msg.includes('scriptUnicodeName'));
  });

  it('passes: derived: stamps', () => {
    assert.equal(R6.check({
      code: 'aab',
      dialectCount: 5,
      scriptUnicodeName: 'Latin',
      _fieldSources: {
        dialectCount: 'derived:glottolog-5.3-languoid',
        scriptUnicodeName: 'derived:script',
      },
    }), null);
  });

  it('passes: fields absent or null', () => {
    assert.equal(R6.check({ code: 'aaa', dialectCount: null }), null);
  });

  it('FIRES: morphologicalSynthesis (dotted path) wearing a bare upstream name', () => {
    const msg = R6.check({
      code: 'crk',
      typologicalProfile: { morphologicalSynthesis: 'polysynthetic' },
      _fieldSources: { 'typologicalProfile.morphologicalSynthesis': 'wals-2024' },
    });
    assert.ok(msg && msg.includes('typologicalProfile.morphologicalSynthesis'));
  });

  it('FIRES: orthographies with no stamp at all', () => {
    const msg = R6.check({
      code: 'crk',
      orthographies: [{ script: 'Latn', scheme: 'SRO', source: 'manual-curation' }],
    });
    assert.ok(msg && msg.includes('orthographies'));
  });

  it('passes: the 2026-07-12 derived additions with derived: stamps', () => {
    assert.equal(R6.check({
      code: 'crk',
      orthographies: [{ script: 'Latn', scheme: 'SRO', source: 'manual-curation' }],
      typologicalProfile: { morphologicalSynthesis: 'polysynthetic' },
      _fieldSources: {
        orthographies: 'derived:scripts+orthographic-status (conventions: curated-orthography-conventions.json)',
        'typologicalProfile.morphologicalSynthesis':
          'derived:on-card-typology (polysynthesis prose: linguisticChallenges.polysynthesis)',
      },
    }), null);
  });
});

// -----------------------------------------------------------------
// R1 — no-unsupported-assertion  (the quy "tonal" class)
// -----------------------------------------------------------------

describe('R1 no-unsupported-assertion', () => {
  it('FIRES: quy-shaped tonal claim contradicted by its own PHOIBLE block', () => {
    const quyBad = {
      code: 'quy',
      phonologicalInventory: { isTonal: false, tones: 0, source: 'phoible-2.0' },
      linguisticChallenges: {
        tone: 'Tonal language (Grambank: phonemic tone present). Tone carries meaning…',
      },
      encyclopedic: { typology: { tonePhonemic: true } },
    };
    const msg = R1(quyBad);
    assert.ok(msg, 'expected R1 to fire on the quy tonal contradiction');
    assert.match(msg, /tone/i);
    assert.match(msg, /PHOIBLE/i);
  });

  it('FIRES: Grambank-cited case/evidentiality prose with no corrected typology support', () => {
    const card = {
      linguisticChallenges: {
        caseSystem: 'Has morphological case marking on nouns (Grambank).',
        evidentiality: 'Has grammatical evidentiality (Grambank).',
      },
      typologicalProfile: { hasCaseMorphology: null, hasEvidentiality: null },
    };
    const msg = R1(card);
    assert.ok(msg);
    assert.match(msg, /case/i);
    assert.match(msg, /evidentiality/i);
  });

  it('does NOT fire: genuinely tonal language (PHOIBLE isTonal:true backs the claim)', () => {
    const card = {
      phonologicalInventory: { isTonal: true, tones: 5, source: 'phoible-2.0' },
      linguisticChallenges: { tone: 'Tonal language. Tone carries meaning…' },
      encyclopedic: { typology: { tonePhonemic: true } },
    };
    assert.equal(R1(card), null);
  });

  it('does NOT fire: tone claim removed (the repaired non-tonal card)', () => {
    const card = {
      phonologicalInventory: { isTonal: false, tones: 0, source: 'phoible-2.0' },
      linguisticChallenges: { reduplication: 'Uses productive reduplication (WALS).' },
      encyclopedic: { typology: {} },
    };
    assert.equal(R1(card), null);
  });

  it('FIRES: Grambank-cited genderAgreement with no gender support anywhere (acy/agm-shaped)', () => {
    const card = {
      linguisticChallenges: { genderAgreement: 'Has gender distinction in 3rd person pronouns (Grambank).' },
      typologicalProfile: { hasGenderSystem: null },
      gender: { hasGrammaticalGender: null, source: 'grambank-2023' },
    };
    assert.ok(R1(card));
  });

  it('does NOT fire: genuinely-gendered language that cites Grambank (als/Albanian, gender.grammatical:true)', () => {
    // The gender object has two shapes across the corpus: schema-canonical
    // {grammatical:true} and Grambank-enriched {hasGrammaticalGender:true}.
    // A real gender source backs the claim under EITHER — must not be flagged.
    const alsLike = {
      linguisticChallenges: { genderAgreement: 'Has gender distinction in 3rd person pronouns (Grambank).' },
      typologicalProfile: { hasGenderSystem: null },
      gender: { grammatical: true, inclusiveGuidance: 'Albanian has two genders…' },
    };
    assert.equal(R1(alsLike), null);
  });

  it('does NOT fire: WALS-sourced case claim (faithful, independently sourced — not Grambank)', () => {
    // crk-shaped: "Rich case system (WALS: …)" with the decontaminated Grambank
    // bit still null. The gate must NOT force agreement with a cleared Grambank
    // bit when the claim is cited to a different, real source.
    const crkLike = {
      linguisticChallenges: { caseSystem: 'Rich case system (WALS: "Exclusively borderline case-marking").' },
      typologicalProfile: { hasCaseMorphology: null },
    };
    assert.equal(R1(crkLike), null);
  });

  it('does NOT fire: WALS-coded tone, PHOIBLE silent (WALS codes tone — a real authority)', () => {
    // WALS feature 13A codes tone directly for THIS language; the card has no
    // PHOIBLE inventory. A WALS coding is faithful tone evidence, not contamination.
    const walsTone = {
      phonologicalInventory: undefined,
      linguisticChallenges: { tone: 'Tonal language (WALS: "Simple tone system"). Tone carries lexical meaning…' },
    };
    assert.equal(R1(walsTone), null);
  });

  it('does NOT fire: honest "Tone not yet verified" data-gap note (a gap disclosure, not an assertion)', () => {
    const gapNote = {
      phonologicalInventory: undefined,
      linguisticChallenges: {
        tone: 'Tone not yet verified for this language. Its family (Sino-Tibetan) is characteristically tonal (family-level typology, Dryer & Haspelmath 2013), but no primary PHOIBLE or WALS tone coding exists for this language yet — a data gap, not a confirmed feature.',
      },
    };
    assert.equal(R1(gapNote), null);
  });

  it('FIRES: a family-level prior stated as a POSITIVE tone claim (not reframed as a gap)', () => {
    const positivePrior = {
      phonologicalInventory: undefined,
      linguisticChallenges: {
        tone: 'Member of Sino-Tibetan family — most languages in this family are tonal. (Source: family-level trait, Dryer & Haspelmath 2013)',
      },
    };
    assert.ok(R1(positivePrior), 'an un-reframed family prior asserts tone and must be flagged');
  });

  it('FIRES: a flat tone assertion with no PHOIBLE-true / WALS / family-trait basis', () => {
    const flat = {
      phonologicalInventory: undefined,
      linguisticChallenges: { tone: 'This language is tonal. Tone carries lexical meaning.' },
    };
    assert.ok(R1(flat), 'unsourced tone assertion must still be flagged');
  });

  it('FIRES: family-trait/WALS basis cannot override an explicit PHOIBLE isTonal:false', () => {
    // PHOIBLE directly coded this language as non-tonal; a secondary basis must
    // not silently overrule a direct contradiction (the factory deletes such prose).
    const contradicted = {
      phonologicalInventory: { isTonal: false, tones: 0, source: 'phoible-2.0' },
      linguisticChallenges: { tone: 'Tonal language (WALS: "Simple tone system").' },
    };
    assert.ok(R1(contradicted), 'PHOIBLE isTonal:false must override a WALS/family basis');
  });
});

// -----------------------------------------------------------------
// R2 — value-supported-by-source  (the crk speakerCount class)
// -----------------------------------------------------------------

describe('R2 value-supported-by-source', () => {
  it('FIRES: crk-shaped speakerCount=20000 stamped linguameta while linguameta says 4100', () => {
    const crkBad = {
      code: 'crk',
      vitality: { speakerCount: 20000, source: 'linguameta-2024' },
      speakerEstimates: [
        { source: 'wikidata', count: 34000 },
        { source: 'linguameta', count: 4100 },
      ],
    };
    const msg = R2(crkBad);
    assert.ok(msg, 'expected R2 to fire on the crk mis-sourced speaker count');
    assert.match(msg, /20000/);
    assert.match(msg, /4100/);
  });

  it('FIRES via atlas facts-map reconciliation when a facts map is supplied', () => {
    const card = {
      code: 'foo',
      vitality: { speakerCount: 20000, source: 'linguameta-2024' },
      speakerEstimates: [], // nothing on-card; DB is the source of truth here
    };
    const facts = new Map([['foo|speakerCount|linguameta', 4100]]);
    const msg = R2(card, { facts });
    assert.ok(msg);
    assert.match(msg, /atlas facts map/);
  });

  it('does NOT fire: speakerCount reconciled to its cited source value', () => {
    const fixed = {
      vitality: { speakerCount: 4100, source: 'linguameta-2024' },
      speakerEstimates: [
        { source: 'wikidata', count: 34000 },
        { source: 'linguameta', count: 4100 },
      ],
    };
    assert.equal(R2(fixed), null);
  });

  it('does NOT fire: curated value honestly labeled champollion-derived', () => {
    const labeled = {
      vitality: { speakerCount: 20000, source: 'champollion-derived' },
      speakerEstimates: [{ source: 'linguameta', count: 4100 }],
    };
    assert.equal(R2(labeled), null);
  });

  it('does NOT fire: cited source has no on-card estimate to contradict (quy-shaped)', () => {
    // vitality.source names glottolog, which is not among speakerEstimates[];
    // the value also matches a shown estimate. Nothing is provably mis-cited.
    const quyLike = {
      vitality: { speakerCount: 918200, source: 'glottolog-cldf-5.3' },
      speakerEstimates: [
        { source: 'wikidata', count: 918200 },
        { source: 'linguameta', count: 900000 },
      ],
    };
    assert.equal(R2(quyLike), null);
  });

  it('does NOT fire: honest multi-source disagreement shown, number matches its source', () => {
    // The card SHOWS two disagreeing estimates and the displayed count equals
    // the one whose source it is stamped with — faithful, not collapsed.
    const multi = {
      vitality: { speakerCount: 34000, source: 'wikidata' },
      speakerEstimates: [
        { source: 'wikidata', count: 34000 },
        { source: 'linguameta', count: 4100 },
      ],
    };
    assert.equal(R2(multi), null);
  });
});

// -----------------------------------------------------------------
// R3 — no-run-results-on-cards  (the synthetic crk 91.5% leak)
// -----------------------------------------------------------------

describe('R3 no-run-results-on-cards', () => {
  it('FIRES: synthetic crk 91.5% FST-acceptance run result leaked into a coverage string', () => {
    const crk915 = {
      code: 'crk',
      resources: {
        fsts: [{
          name: 'GiellaLT Plains Cree FST',
          type: 'morphological-analyzer',
          coverage: '91.5% morphologically valid words (FST acceptance over 494 sentences)',
        }],
      },
    };
    const msg = R3(crk915);
    assert.ok(msg, 'expected R3 to fire on the 91.5% run-result leak');
    assert.match(msg, /run-result/i);
  });

  it('FIRES: a bare numeric value under an MT/FST metric-named key', () => {
    assert.ok(R3({ chrf: 52.1 }));
    assert.ok(R3({ fstAcceptance: 0.915 }));
    assert.ok(R3({ resources: { models: [{ name: 'm', cometScore: 0.81 }] } }));
  });

  it('does NOT fire: pipelineReadiness.score (allowlisted capability composite)', () => {
    assert.equal(R3({ pipelineReadiness: { score: 40, tier: 'moderate', source: 'derived' } }), null);
  });

  it('does NOT fire: metric NAMES and existence fields (capability, not measurement)', () => {
    const card = {
      metricPlugins: null,
      evalDatasets: ['flores-plus-devtest'],
      omt1600: { covered: true, evalMetrics: ['chrF++', 'BLASER-3'] },
      evalPack: { description: 'LYSS equivalence linter + FST morphological validation' },
    };
    assert.equal(R3(card), null);
  });

  it('does NOT fire: asserted tool-coverage figures with no run-metric verb (sme/yor-shaped)', () => {
    const card = {
      resources: {
        fsts: [
          { name: 'sme-fst', type: 'x', coverage: '~96%' },
          { name: 'yor-fst', type: 'x', coverage: '~96% accuracy on diacritic restoration' },
        ],
      },
    };
    assert.equal(R3(card), null);
  });
});

// -----------------------------------------------------------------
// R4 — metric-label-match
// -----------------------------------------------------------------

describe('R4 metric-label-match', () => {
  it('FIRES: per-sentence acceptance mislabeled as "% of words morphologically valid"', () => {
    const card = {
      resources: { fsts: [{ name: 'x', type: 'y', coverage: '91.5% morphologically valid words' }] },
    };
    assert.ok(R4(card));
  });

  it('FIRES: FST acceptance relabeled as validity', () => {
    const card = { evalPack: { description: 'FST acceptance reported as morphological validity per run.' } };
    assert.ok(R4(card));
  });

  it('does NOT fire: honest capability description (no mislabel, no number)', () => {
    const card = { evalPack: { description: 'LYSS equivalence linter + FST morphological validation' } };
    assert.equal(R4(card), null);
  });
});

// -----------------------------------------------------------------
// Meta-audit 2026-07-18 — SEMANTIC-VARIANT hardening (R1/R2/R3).
// Each fires-case was a smuggling shape the pre-audit rule MISSED (it keyed on
// exact shape, not concept); each not-fire-case is a real-tree false positive the
// fix had to avoid. Verified: 0 new violations across all 7,927 live cards.
// -----------------------------------------------------------------

describe('meta-audit R3 — run results under novel keys / phrasings', () => {
  it('FIRES: chrF++ variant compound keys (the primary metric evaded plain "chrf")', () => {
    assert.ok(R3({ chrfppScore: 57.7 }), 'chrfppScore');
    assert.ok(R3({ chrfppResult: 57.7 }), 'chrfppResult');
    assert.ok(R3({ cchrfpp: 61.2 }), 'cchrfpp');
    assert.ok(R3({ resources: { models: [{ name: 'm', chrfPlusPlus: 57 }] } }), 'chrfPlusPlus');
  });

  it('FIRES: metric name with a TRAILING number in free text', () => {
    assert.ok(R3({ note: 'chrF++ of 57.7 on FLORES' }), 'chrF++ of N');
    assert.ok(R3({ note: 'COMET score of 0.81 on the devset' }), 'COMET score of N');
    assert.ok(R3({ note: 'BLEU of 30 points' }), 'BLEU of N');
    assert.ok(R3({ note: 'reached 0.81 COMET on the test set' }), '0.81 COMET');
  });

  it('does NOT fire: metric NAMES, capability prose, citations, version tags', () => {
    assert.equal(R3({ evalMetrics: ['chrF++', 'BLASER-3', 'COMET'] }), null, 'metric name array');
    assert.equal(R3({ note: 'supports BLEU and chrF++ scoring' }), null, 'capability prose');
    assert.equal(R3({ evalPack: { description: 'Uses chrF++ (Popović 2015) and COMET.' } }), null, 'citation year');
    assert.equal(R3({ note: 'covered with chrF++, BLASER-3' }), null, 'version tag');
    assert.equal(R3({ qualityScore: 57 }), null, 'generic score key stays allowed');
  });
});

describe('meta-audit R2 — speaker count matching NO cited estimate', () => {
  it('FIRES: count stamped a source ABSENT from estimates, matching none of them', () => {
    const msg = R2({
      code: 'x',
      vitality: { speakerCount: 50000, source: 'wikidata' },
      speakerEstimates: [{ source: 'linguameta', count: 4100 }, { source: 'glottolog', count: 6000 }],
    });
    assert.ok(msg, 'unsupported displayed count wearing an absent source must fire');
    assert.match(msg, /matches NONE/i);
  });

  it('FIRES: same, via _fieldSources stamp form', () => {
    assert.ok(R2({
      code: 'x',
      vitality: { speakerCount: 50000 },
      _fieldSources: { 'vitality.speakerCount': 'ethnologue-2024' },
      speakerEstimates: [{ source: 'linguameta', count: 4100 }],
    }));
  });

  it('does NOT fire: count equals SOME cited estimate (even if not the stamped one)', () => {
    // quy-shaped: stamped glottolog (absent from estimates) but the number equals
    // a cited wikidata estimate — faithful, nothing collapsed.
    assert.equal(R2({
      vitality: { speakerCount: 918200, source: 'glottolog-cldf-5.3' },
      speakerEstimates: [{ source: 'wikidata', count: 918200 }, { source: 'linguameta', count: 900000 }],
    }), null);
  });

  it('does NOT fire: no on-card estimates at all (DB reconciliation is the authority)', () => {
    assert.equal(R2({ vitality: { speakerCount: 50000, source: 'wikidata' }, speakerEstimates: [] }), null);
  });
});

describe('meta-audit R1 — tone claim mis-routed to a non-canonical field', () => {
  const isFalse = { isTonal: false, tones: 0, source: 'phoible-2.0' };

  it('FIRES: affirmative tonal claim in linguisticChallenges.phonology (PHOIBLE isTonal:false)', () => {
    const msg = R1({ phonologicalInventory: isFalse,
      linguisticChallenges: { phonology: 'Phonemic tone distinguishes lexical meaning here.' } });
    assert.ok(msg && /self-contradiction/i.test(msg));
  });

  it('FIRES: tonal claim in encyclopedic.summary / description (PHOIBLE isTonal:false)', () => {
    assert.ok(R1({ phonologicalInventory: isFalse,
      encyclopedic: { summary: 'A tonal language with three contrastive tones.' } }));
    assert.ok(R1({ phonologicalInventory: isFalse, description: 'It is a tonal language.' }));
  });

  it('does NOT fire: PHOIBLE silent (only the isTonal:false CONTRADICTION case is scanned)', () => {
    assert.equal(R1({ phonologicalInventory: undefined,
      encyclopedic: { summary: 'A tonal language with three contrastive tones.' } }), null);
  });

  it('does NOT fire: negated / non-tonal mention alongside isTonal:false', () => {
    assert.equal(R1({ phonologicalInventory: isFalse,
      encyclopedic: { summary: 'An atonal language, unlike neighbouring tonal languages.' } }), null);
    assert.equal(R1({ phonologicalInventory: isFalse,
      linguisticChallenges: { phonology: 'Stress-based; tone is not phonemic.' } }), null);
  });

  it('does NOT fire: reworded honest "tone not yet verified" gap note', () => {
    assert.equal(R1({ phonologicalInventory: undefined,
      linguisticChallenges: { tone: 'Tone has not been verified for this language — a data gap.' } }), null);
    assert.equal(R1({ phonologicalInventory: undefined,
      linguisticChallenges: { tone: 'Tone remains unverified; no PHOIBLE or WALS coding exists yet.' } }), null);
  });
});

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

describe('source-id helpers', () => {
  it('baseSource strips version/date tokens and lowercases', () => {
    assert.equal(baseSource('linguameta-2024'), 'linguameta');
    assert.equal(baseSource('glottolog-cldf-5.3'), 'glottolog-cldf');
    assert.equal(baseSource('PHOIBLE-2.0'), 'phoible');
  });

  it('isInternalSource recognizes labeled derivations/curation', () => {
    assert.equal(isInternalSource('champollion-derived'), true);
    assert.equal(isInternalSource('derived:speakerEstimates'), true);
    assert.equal(isInternalSource('manual-curation'), true);
    assert.equal(isInternalSource('linguameta-2024'), false);
    assert.equal(isInternalSource('wikidata'), false);
  });
});
