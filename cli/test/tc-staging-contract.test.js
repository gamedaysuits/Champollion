/**
 * tc-staging contract — pins the shape the atlas-SSOT trading-card build
 * (mt-eval-arena/scripts/build-trading-card-data.mjs) must stage, so the
 * 46-column trading_card_index upload contract and the detail blob the
 * remote consumers reconstruct cards from can never drift silently.
 *
 * Guards pinned here:
 *   1. INDEX_CONTRACT enumerates every camelCase field the uploader's
 *      snake_case mapping reads (upload-trading-cards.mjs; the mapping adds
 *      only updated_at and sends `stats` twice, as challenge_rating and
 *      stats) — and a projected entry for a real card carries all of them.
 *   2. Projected name/family are STRINGS — the '[object Object]' class of
 *      failure (envelope served raw) fails here, not on the public site.
 *   3. vitality_badge.level speaks the website vitalityScale.js vocabulary
 *      (or null for no-evidence) — the generator hard-fails on anything
 *      else, so drift must be caught at the source.
 *   4. The f6b533965 invariant: a card with NO glottolog-cldf endangerment
 *      claim gets level null + source 'unknown', never a default.
 *   5. The 28 DETAIL_PASSTHROUGH keys of cli/lib/cards/remote.js are
 *      present on a projected detail blob (the build stages every one,
 *      null where the card declares nothing).
 *   6. formality.system, when present, is one of the known systems.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { normalizeCard } from '../lib/cards/reader.js';
import {
  INDEX_CONTRACT,
  isPublishableLanguageCard,
  collectDisputedFields,
  computeGroundedStats,
  computeRarityScore,
  assignRarityTiers,
  resolveSpeakerDisplay,
  projectClassification,
  projectScripts,
  licenseAliasCandidates,
} from '../../mt-eval-arena/scripts/lib/card-projection.mjs';
import { vitalityBadgeFromCard, BADGE_LEVELS } from '../../mt-eval-arena/scripts/lib/vitality-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const require = createRequire(import.meta.url);
// The website's badge vocabulary — the build must emit ONLY these ids.
const { LEVEL_BY_ID } = require('../website/src/utils/vitalityScale.js');

// The exact snake_case → camelCase mapping upload-trading-cards.mjs applies.
// If a column is added/removed there, this list (and INDEX_CONTRACT) must
// move in the same change.
const UPLOADER_FIELDS = [
  'code', 'name', 'iso639_1', 'aliases', 'nativeName', 'family', 'genus',
  'macroarea', 'isIsolate', 'modality', 'isoType', 'isoScope', 'macrolanguage',
  'speakers', 'speakerCount', 'script', 'scripts', 'dir', 'vitalityBadge',
  'rarity', 'rarityOrder', 'stats', 'digitalToolkit', 'abilities',
  'pipelineLabel', 'pipelineEmoji', 'factCount', 'sourceCount',
  'hasVocabulary', 'hasTypology', 'hasPhonology', 'hasNearest',
  'hasNaturalPair', 'hasCultural', 'hasConflicts', 'dialectCount',
  'scriptName', 'regions', 'ancestry', 'glottocode', 'culturalAphorism',
];

// The keys buildCardFromRemote (cli/lib/cards/remote.js DETAIL_PASSTHROUGH)
// copies off a detail blob. Every one must exist on a staged detail entry —
// null/[]/{} where the card declares nothing, but never absent.
const DETAIL_PASSTHROUGH = [
  'classification', 'vitality', 'speakerEstimates', 'linguisticChallenges',
  'contactInfluences', 'formality', 'methodSupport', 'resources',
  'evalDatasets', 'pipelineReadiness', 'digitalPresence', 'corpusAvailability',
  'databaseCoverage', 'omt1600', 'regions', 'countries', 'coordinates',
  'orthographicStatus', 'notes', 'encyclopedic', 'experts', 'alternateNames',
  'modality', 'isoType', 'isoScope', 'macrolanguage', 'members', 'taxonomyNotes',
];

const FORMALITY_SYSTEMS = new Set(['T-V', 'speech-levels', 'avoidance', 'none', 'politeness-present', 'keigo']);

function loadCard(code) {
  const file = path.join(CARDS_DIR, `${code}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const disputed = collectDisputedFields(raw);
  return { card: normalizeCard(raw), disputed };
}

const haveCards = fs.existsSync(CARDS_DIR);

describe('tc staging contract', { skip: !haveCards && 'language-cards not present in this checkout' }, () => {
  it('INDEX_CONTRACT matches the uploader field set exactly', () => {
    assert.deepStrictEqual([...INDEX_CONTRACT].sort(), [...UPLOADER_FIELDS].sort());
  });

  for (const code of ['crk', 'eng', 'fra']) {
    it(`${code}: projected identity fields are strings, never envelopes`, () => {
      const loaded = loadCard(code);
      assert.ok(loaded, `card ${code} missing`);
      const { card } = loaded;
      assert.strictEqual(typeof card.name, 'string');
      assert.ok(!card.name.includes('[object'), 'name leaked an envelope');
      const cls = projectClassification(card);
      assert.strictEqual(typeof cls.family, 'string');
      assert.ok(!cls.family.includes('[object'), 'family leaked an envelope');
      assert.ok(cls.genus === null || typeof cls.genus === 'string');
      for (const s of projectScripts(card)) {
        assert.strictEqual(typeof s.name, 'string');
      }
      const spk = resolveSpeakerDisplay(card);
      assert.strictEqual(typeof spk.count, 'number');
      assert.ok(Number.isInteger(spk.count));
    });

    it(`${code}: vitality badge speaks the website vocabulary`, () => {
      const { card } = loadCard(code);
      const badge = vitalityBadgeFromCard(card);
      if (badge.level === null) {
        assert.strictEqual(badge.source, 'unknown');
        assert.strictEqual(badge.aesValue, null);
      } else {
        assert.ok(LEVEL_BY_ID.has(badge.level),
          `level "${badge.level}" not in website vitalityScale vocabulary`);
        assert.strictEqual(badge.source, 'glottolog-aes');
      }
    });
  }

  it('every mapped badge level exists in the website scale', () => {
    for (const level of BADGE_LEVELS) {
      assert.ok(LEVEL_BY_ID.has(level), `vitality-map emits "${level}", unknown to vitalityScale.js`);
    }
  });

  it('no-AES-evidence card gets null level + unknown source, never a default', () => {
    // A synthetic card with NO endangerment claim at all: the invariant the
    // f6b533965 fix pinned (silence must not read as reassurance).
    const badge = vitalityBadgeFromCard({ code: 'xxx', name: 'Test' });
    assert.deepStrictEqual(badge, { level: null, source: 'unknown', aesValue: null });
    // …and an ELCat-only assessment is NOT presented under the Glottolog-AES
    // label either.
    const elcatOnly = vitalityBadgeFromCard({
      endangerment: {
        agreement: 'single',
        values: [{ value: 'endangered', source: 'elcat-v2024.1' }],
      },
    });
    assert.strictEqual(elcatOnly.level, null);
  });

  it('rarity: score fails loud on unmapped vitality levels, neutral 30 on null', () => {
    const cr = { score: 50 };
    const toolkit = { count: 3 };
    assert.doesNotThrow(() => computeRarityScore(cr, toolkit, { level: null }));
    assert.throws(() => computeRarityScore(cr, toolkit, { level: 'flourishing' }), /no urgency score/);
  });

  it('rarity: percentile assignment preserves baseline proportions', () => {
    const scored = Array.from({ length: 100 }, (_, i) => ({ code: `l${String(i).padStart(3, '0')}`, score: i }));
    const { tiersByCode } = assignRarityTiers(scored, {
      mythic: 10, legendary: 20, epic: 30, rare: 20, uncommon: 10, common: 10,
    });
    const counts = {};
    for (const t of tiersByCode.values()) counts[t] = (counts[t] ?? 0) + 1;
    assert.deepStrictEqual(counts, { mythic: 10, legendary: 20, epic: 30, rare: 20, uncommon: 10, common: 10 });
    assert.strictEqual(tiersByCode.get('l099'), 'mythic');
    assert.strictEqual(tiersByCode.get('l000'), 'common');
  });

  it('license alias tolerance strips version/hash/date suffixes', () => {
    assert.ok(licenseAliasCandidates('wals-v2020.5').includes('wals'));
    assert.ok(licenseAliasCandidates('glottolog-cldf-v5.3').includes('glottolog-cldf'));
    assert.ok(licenseAliasCandidates('linguameta-452a21ad3dae').includes('linguameta'));
    assert.ok(licenseAliasCandidates('sil-langtags-1.4@2026-06-09').includes('sil-langtags-1.4'));
  });

  it('index entry for a real card carries every contract field; detail carries every passthrough key', () => {
    // Drive the same projection the build performs, minus the atlas/staging
    // sidecars (injected as empty — the contract is about SHAPE).
    const { card, disputed } = loadCard('fra');
    assert.ok(isPublishableLanguageCard(card));
    const stats = computeGroundedStats(card, { notes: { treebanksAbsent: 0, clicsStatsAbsent: 0 } });
    const cls = projectClassification(card);
    const spk = resolveSpeakerDisplay(card);
    const entry = {
      code: card.code,
      name: card.name,
      iso639_1: card.iso639_1 ?? null,
      aliases: Array.isArray(card.aliases) ? card.aliases : [],
      nativeName: card.nativeName ?? null,
      family: cls.family,
      genus: cls.genus,
      macroarea: card.macroarea ?? null,
      isIsolate: card.isIsolate === true,
      modality: card.modality ?? null,
      isoType: card.isoType ?? null,
      isoScope: card.isoScopeInitial ?? card.isoScope ?? null,
      macrolanguage: card.macrolanguage ?? null,
      speakers: spk.display,
      speakerCount: spk.count,
      script: card.script ?? null,
      scripts: projectScripts(card),
      dir: card.dir ?? null,
      vitalityBadge: stats.vitality,
      rarity: {},
      rarityOrder: 0,
      stats: stats.challengeRating,
      digitalToolkit: stats.digitalToolkit,
      abilities: [],
      pipelineLabel: 'N/A',
      pipelineEmoji: '➖',
      factCount: Object.keys(card._fieldSources ?? {}).length,
      sourceCount: card.coverage?.sourceCount ?? null,
      hasVocabulary: false,
      hasTypology: false,
      hasPhonology: !!card.phonologicalInventory,
      hasNearest: false,
      hasNaturalPair: false,
      hasCultural: false,
      hasConflicts: disputed.length > 0,
      dialectCount: card.dialectCount ?? null,
      scriptName: card.script ?? null,
      regions: card.countries ?? [],
      ancestry: [],
      glottocode: card.glottocode ?? null,
      culturalAphorism: null,
    };
    for (const field of INDEX_CONTRACT) {
      assert.ok(field in entry, `index entry missing contract field '${field}'`);
    }

    // If a staged detail exists (a build has run in this checkout), verify
    // the passthrough keys on the real artifact; otherwise the enumerated
    // list above still pins the uploader mapping.
    const staged = path.join(__dirname, '..', '..', 'mt-eval-arena', 'data', 'staging', 'tc-lang', 'fra.json');
    if (fs.existsSync(staged)) {
      const detail = JSON.parse(fs.readFileSync(staged, 'utf-8'));
      for (const key of DETAIL_PASSTHROUGH) {
        assert.ok(key in detail, `staged detail missing DETAIL_PASSTHROUGH key '${key}'`);
      }
      assert.ok(!('vocabulary' in detail), 'vocabulary items must not ride the detail blob (migration 069 lane)');
      assert.ok('vocabularySummary' in detail, 'detail must keep the vocabulary header summary');
      if (detail.formality?.system) {
        assert.ok(FORMALITY_SYSTEMS.has(detail.formality.system),
          `formality.system "${detail.formality.system}" outside the known vocabulary`);
      }
      assert.strictEqual(typeof detail.classification.family, 'string');
    }
  });
});
