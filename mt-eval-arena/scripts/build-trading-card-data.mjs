#!/usr/bin/env node

/**
 * build-trading-card-data.mjs — Atlas SSOT → Staging JSON
 *
 * Projects the published trading-card catalogue from the atlas SSOT only:
 *
 *   cli/shared/language-cards/  (via normalizeCard — the ONE adapter)
 *   cli/data/atlas.db           (typed values; read-only, throws if missing)
 *   build/atlas/forms/          (emitted forms artifact — vocabulary lane)
 *   shared/licenses.json        (license pass-through register)
 *   data/staging/tc-nearest.json / tc-natural-pairs.json (derived tables,
 *     computed from cards by cli/scripts/compute-nearest-languages.mjs and
 *     compute-natural-pairs.mjs — REQUIRED pre-steps)
 *
 * The legacy champollion.db is not read anywhere. Its accessor (db.mjs)
 * silently created an empty store on a missing path; every input here
 * fails loud instead.
 *
 * Outputs (data/staging/):
 *   tc-index.json      — compact index for the card grid (one row/language)
 *   tc-lang/{code}.json — per-language detail (NO vocabulary items — the
 *                         panel header reads detail.vocabularySummary and
 *                         lazy-fetches items from trading_card_vocabulary)
 *   tc-vocab/{code}.json — per-language vocabulary rows for the dedicated
 *                          upload lane (migration 069; uploader lane is a
 *                          separate change)
 *   tc-experts.json    — experts rows (derived at staging time from cards)
 *   tc-licenses.json   — license register rows (from shared/licenses.json)
 *   tc-nc-summary.json — NC-source summary recomputed from atlas
 *   rarity-recalibration-report.{json,md} — founder-review artifact
 *
 * Usage:
 *   node scripts/build-trading-card-data.mjs
 *   node scripts/build-trading-card-data.mjs --lang crk   # stage one language
 *   node scripts/build-trading-card-data.mjs --dry-run    # no file writes
 *   node scripts/build-trading-card-data.mjs --allow-missing-licenses
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolved language-card view WITH the hand-authored config lane merged
// (card-config.json: formality/registers presets, eval wiring, the legacy
// flat methodSupport map consumers reconstruct cards from). This is the
// same view the CLI itself serves — the detail blob must round-trip it.
import { getLanguageCard } from '../../cli/lib/registers.js';
import { normalizeCard, display } from '../../cli/lib/cards/reader.js';

import { openAtlas } from './lib/atlas.mjs';
import { buildGlottocodeNameResolver } from './lib/glottocode-names.mjs';
import {
  INDEX_CONTRACT,
  ISO_SPECIALS,
  isPublishableLanguageCard,
  collectDisputedFields,
  resolveSpeakerDisplay,
  computeGroundedStats,
  isClusivityPresent,
  computeRarityScore,
  assignRarityTiers,
  RARITY_TIERS,
  RARITY_ORDER,
  assembleProvenance,
  assembleExternalLinks,
  projectClassification,
  projectScripts,
  projectColexification,
  licenseAliasCandidates,
} from './lib/card-projection.mjs';
import { assembleEncyclopedic } from './lib/prose-intros.mjs';
import { deriveExperts, loadCorporaCardPublishers } from './lib/experts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUTPUT_DIR = join(__dirname, '..', 'data', 'staging');
const CARDS_DIR = join(REPO_ROOT, 'cli', 'shared', 'language-cards');
const FORMS_DIR = join(REPO_ROOT, 'build', 'atlas', 'forms');
const LICENSES_PATH = join(REPO_ROOT, 'shared', 'licenses.json');
const CURATED_DIR = join(REPO_ROOT, 'cli', 'shared', 'curated-intros');
const CORPORA_DIR = join(REPO_ROOT, 'cli', 'shared', 'corpora-cards');
const TC_FEATURES = join(REPO_ROOT, 'cli', 'shared', 'explainers', 'tc-features.json');
const BASELINE_INDEX = join(__dirname, '..', 'data', 'baseline-prod-2026-08', 'tc-index.json');

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
// Explicit escape hatch for license-less builds: without it an EMPTY
// register aborts the build — provenance panels must never quietly ship
// without pass-through license data.
const allowMissingLicenses = args.includes('--allow-missing-licenses');

// ---------------------------------------------------------------------------
// BUILD DAMAGE / NOTES
// ---------------------------------------------------------------------------

const buildDamage = {
  /** Unparseable language-card files — a build that silently drops a
   *  language must not exit 0. */
  unparseableCards: [],
  /** Ancestry glottocodes neither the atlas spine nor the pinned languoid
   *  table can name. A handful means retired codes; a flood means the
   *  resolver broke. */
  unresolvedGlottocodes: [],
};
// Threshold between "retired-code noise, reported" and "resolver is broken,
// fail the build".
const UNRESOLVED_GLOTTOCODE_FATAL = 50;

/** Non-fatal coverage tallies: upstream ingest lanes that have not landed
 *  yet (read-if-present fields). Reported, never invented. */
const notes = { treebanksAbsent: 0, clicsStatsAbsent: 0, namelessCards: [] };

function reportBuildDamage() {
  const fatal = [];
  if (buildDamage.unparseableCards.length) {
    fatal.push(`unparseable language cards: ${buildDamage.unparseableCards.length} `
      + `(${buildDamage.unparseableCards.slice(0, 5).join(', ')}…)`);
  }
  if (buildDamage.unresolvedGlottocodes.length > UNRESOLVED_GLOTTOCODE_FATAL) {
    fatal.push(`unresolved ancestry glottocodes: ${buildDamage.unresolvedGlottocodes.length} `
      + '— the glottocode-name resolver is broken, not just missing retired codes');
  } else if (buildDamage.unresolvedGlottocodes.length) {
    console.warn(`⚠️  ${buildDamage.unresolvedGlottocodes.length} ancestry glottocode(s) unresolved `
      + `(names dropped from breadcrumb, raw codes staged): ${buildDamage.unresolvedGlottocodes.slice(0, 10).join(', ')}`);
  }
  if (fatal.length) {
    console.error('\n✗ BUILD DAMAGE (fatal):');
    for (const f of fatal) console.error(`  - ${f}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// INPUT LOADERS — every one fails loud, naming the script that produces it.
// ---------------------------------------------------------------------------

function loadJsonOrAbort(path, producedBy) {
  if (!existsSync(path)) {
    console.error(`ERROR: required input missing: ${path}`);
    console.error(`Produce it first: ${producedBy}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadLicenseRegister() {
  if (!existsSync(LICENSES_PATH)) {
    if (!allowMissingLicenses) {
      console.error(`ERROR: license register not found: ${LICENSES_PATH}`);
      console.error('Cards built without it ship provenance panels with NO license information.');
      console.error('Build it (scripts/build-shared-licenses.mjs) or re-run with --allow-missing-licenses.');
      process.exit(1);
    }
    return null;
  }
  const register = JSON.parse(readFileSync(LICENSES_PATH, 'utf-8'));
  const sources = register?.sources ?? {};
  if (Object.keys(sources).length === 0 && !allowMissingLicenses) {
    console.error('ERROR: the shared/licenses.json register is EMPTY.');
    console.error('Trading cards built from it would ship provenance panels with NO license data.');
    console.error('Rebuild it (scripts/build-shared-licenses.mjs), or re-run with --allow-missing-licenses.');
    process.exit(1);
  }
  return Object.keys(sources).length > 0 ? sources : null;
}

/** Read + normalize one card, keeping the raw-shape dispute walk. */
function readCard(file) {
  try {
    const raw = JSON.parse(readFileSync(join(CARDS_DIR, file), 'utf-8'));
    // Disputes are collected BEFORE normalization: normalizeCard rewrites
    // some envelopes (speakerEstimates becomes a plain array) in place.
    const disputed = collectDisputedFields(raw);
    return { card: normalizeCard(raw), disputed };
  } catch {
    buildDamage.unparseableCards.push(file);
    return null;
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  build-trading-card-data.mjs — Atlas SSOT → Cards  ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log();

  // ── Inputs ─────────────────────────────────────────────────────────
  const atlas = openAtlas(); // throws on missing file — never an empty store

  const licenseRegister = loadLicenseRegister();
  if (licenseRegister) {
    console.log(`License register: ${Object.keys(licenseRegister).length} sources (shared/licenses.json)`);
  } else {
    console.error('⚠️  --allow-missing-licenses: building WITHOUT per-source license data;');
    console.error('    tc-licenses.json / tc-nc-summary.json will NOT be staged.');
  }
  const licenseFor = (sourceId) => {
    if (!licenseRegister) return null;
    for (const cand of licenseAliasCandidates(sourceId)) {
      if (licenseRegister[cand]) return licenseRegister[cand];
    }
    return null;
  };

  // Atlas source metadata (URL/DOI) for provenance links.
  const sourceMetaMap = new Map(
    atlas.prepare('SELECT ID, URL, DOI FROM cldf_sources').all()
      .map((r) => [r.ID, { url: r.URL ?? null, doi: r.DOI ?? null }]),
  );
  const sourceMeta = (id) => sourceMetaMap.get(id) ?? null;

  // Forms artifact — the vocabulary lane input (replaces the legacy
  // lexical-facts read).
  const formsIndex = loadJsonOrAbort(
    join(FORMS_DIR, 'index.json'),
    'node cli/scripts/cldf/emit-forms.mjs (part of build-atlas)',
  );
  const formsByCode = formsIndex.languages ?? {};
  console.log(`Forms artifact: ${Object.keys(formsByCode).length} languages (${FORMS_DIR})`);

  // Derived tables — computed from cards by their own pre-steps.
  const nearestByCode = loadJsonOrAbort(
    join(OUTPUT_DIR, 'tc-nearest.json'),
    'node cli/scripts/compute-nearest-languages.mjs',
  );
  const pairsByCode = loadJsonOrAbort(
    join(OUTPUT_DIR, 'tc-natural-pairs.json'),
    'node cli/scripts/compute-natural-pairs.mjs',
  );
  console.log(`Derived tables: nearest ${Object.keys(nearestByCode).length}, natural pairs ${Object.keys(pairsByCode).length}`);

  // Glottocode → name resolver (atlas spine + pinned languoid table).
  const glottoNames = await buildGlottocodeNameResolver(atlas);

  // Typology feature list from the store-only typologyFeature catalog:
  // Value is JSON {feature, value}, Variant_ID the upstream feature id
  // (WALS '83A' / Grambank 'GB028' / APiCS), Source the pinned release.
  const typRows = atlas.prepare(`
    SELECT Subject_ID, Value, Variant_ID, Source, Confidence
      FROM cldf_values
     WHERE Parameter_ID = 'typologyFeature' AND Status = 'asserted'
  `).all();
  const typByCode = {};
  for (const r of typRows) {
    let parsed;
    try {
      parsed = JSON.parse(r.Value);
    } catch {
      buildDamage.unparseableCards.push(`typologyFeature:${r.Subject_ID}:${r.Variant_ID}`);
      continue;
    }
    (typByCode[r.Subject_ID] ??= []).push({
      property: parsed.feature,
      value: parsed.value,
      featureId: r.Variant_ID,
      source: r.Source,
      sourceUrl: sourceMeta(r.Source)?.url ?? null,
      confidence: r.Confidence ?? null,
    });
  }
  console.log(`Typology features: ${typRows.length} catalog values across ${Object.keys(typByCode).length} languages`);

  // Clusivity fallback for cards that predate the A4.3 ingest: any truthy
  // asserted inclusiveExclusive claim marks the language.
  const clusivityByCode = new Map();
  for (const r of atlas.prepare(`
    SELECT Subject_ID, Value FROM cldf_values
     WHERE Parameter_ID = 'inclusiveExclusive' AND Status = 'asserted' AND Value IS NOT NULL
  `).all()) {
    if (isClusivityPresent(r.Value)) clusivityByCode.set(r.Subject_ID, r.Value);
    else if (!clusivityByCode.has(r.Subject_ID)) clusivityByCode.set(r.Subject_ID, r.Value);
  }

  const tcFeatures = existsSync(TC_FEATURES)
    ? JSON.parse(readFileSync(TC_FEATURES, 'utf-8'))
    : null;
  if (!tcFeatures) console.warn('⚠️  tc-features.json not found — typology intro sentences skipped');
  const corporaPublishers = loadCorporaCardPublishers(CORPORA_DIR);

  // Baseline (prod snapshot) — anchors the rarity-tier proportions and the
  // recalibration report.
  const baselineIndex = loadJsonOrAbort(
    BASELINE_INDEX,
    'cli/website/scripts/build-data-from-supabase.mjs --force --out mt-eval-arena/data/baseline-prod-2026-08',
  );
  const baselineByCode = new Map(baselineIndex.map((e) => [e.code, e]));
  const baselineTierCounts = {};
  for (const e of baselineIndex) {
    baselineTierCounts[e.rarity?.tier] = (baselineTierCounts[e.rarity?.tier] ?? 0) + 1;
  }

  // ── Pass 1: load + gate every card, compute grounded stats ─────────
  // Runs over the FULL set even under --lang: rarity tiers are percentile-
  // anchored over the whole catalogue, so a single-language build still
  // needs every score.
  const files = readdirSync(CARDS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'language-tree.json');

  const records = [];
  let localeCards = 0;
  for (const file of files) {
    const read = readCard(file);
    if (!read) continue;
    const { card, disputed } = read;
    if (card.locale?.language) { localeCards++; continue; }
    if (ISO_SPECIALS.has(card.code)) continue;
    if (!isPublishableLanguageCard(card)) {
      notes.namelessCards.push(card.code ?? file);
      continue;
    }
    const stats = computeGroundedStats(card, { notes, clusivity: clusivityByCode.get(card.code) });
    records.push({
      code: card.code,
      card,
      disputed,
      stats,
      rarityScore: computeRarityScore(stats.challengeRating, stats.digitalToolkit, stats.vitality),
    });
  }
  console.log(`\nCards: ${records.length} languages `
    + `(${localeCards} locale projections excluded, ${ISO_SPECIALS.size} ISO specials excluded, `
    + `${notes.namelessCards.length} nameless card(s) unpublishable)`);

  if (singleLang && !records.some((r) => r.code === singleLang)) {
    console.error(`Language '${singleLang}' not found in the publishable card set.`);
    process.exit(1);
  }

  // ── Rarity: percentile-anchored tiers preserving legacy proportions ──
  const { tiersByCode, thresholds } = assignRarityTiers(
    records.map((r) => ({ code: r.code, score: r.rarityScore })),
    baselineTierCounts,
  );

  // ── Vitality distribution invariant (f6b533965) ────────────────────
  // No AES evidence → unknown, never a default. The rebuilt distribution
  // must land near prod's 987 unknown / 7,694 glottolog-aes; a collapse
  // (everything unknown) or an explosion (defaults leaking back in) fails
  // the build before anything ships.
  // Prod carried 987 unknown / 7,694 glottolog-aes. The rebuild lands at
  // ~326 / ~8,355 because the pinned glottolog-cldf v5.3 assesses 666
  // languages the legacy facts store never had AES rows for — verified
  // claim-by-claim against the cards (381 of them 'extinct', i.e. the
  // opposite of reassurance). So the gate pins the INVARIANT, not the stale
  // coverage numbers: assessed coverage may only rise from prod's 7,694;
  // unknown must stay well above zero (the thriving-by-default bug's
  // signature was unknown → 0); and 'thriving' must stay within ±10% of
  // prod's 2,899 (that bug inflated exactly this bucket, by 987).
  if (!singleLang) {
    const unknown = records.filter((r) => r.stats.vitality.level === null).length;
    const assessed = records.length - unknown;
    const thriving = records.filter((r) => r.stats.vitality.level === 'thriving').length;
    console.log(`Vitality: ${assessed} glottolog-aes / ${unknown} unknown / ${thriving} thriving`);
    const failures = [];
    if (unknown < 100) failures.push(`unknown collapsed to ${unknown} — a no-evidence default is leaking in`);
    if (assessed < 7694) failures.push(`assessed fell to ${assessed} (< prod's 7,694) — cited AES claims are being dropped`);
    if (Math.abs(thriving - 2899) > 2899 * 0.10) failures.push(`thriving = ${thriving}, outside ±10% of prod's 2,899`);
    if (failures.length) {
      console.error('✗ vitality distribution invariant violated:');
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
  }

  // ── Pass 2: assemble index + detail for the staged set ─────────────
  const targets = singleLang ? records.filter((r) => r.code === singleLang) : records;
  const indexEntries = [];
  const detailBuckets = {};
  const vocabBuckets = {};
  const expertRows = [];
  const startTime = Date.now();
  let processed = 0;

  for (const rec of targets) {
    const { code, card, disputed, stats } = rec;
    // The config-merged runtime view (formality/registers/eval wiring, the
    // legacy flat methodSupport map). Null only if the registry cannot see
    // the card — every projection guards.
    const view = getLanguageCard(code) || null;

    const cls = projectClassification(card);
    // resolve ancestry through the resolver, tallying the unresolvable
    const ancestryGlottocodes = Array.isArray(card.classification?.ancestry)
      ? card.classification.ancestry : [];
    const ancestry = [];
    for (const gc of ancestryGlottocodes) {
      const name = glottoNames.resolve(gc);
      if (name === null) buildDamage.unresolvedGlottocodes.push(`${code}:${gc}`);
      else ancestry.push(name);
    }
    cls.ancestry = ancestry;

    const scripts = projectScripts(card);
    const speakerDisplay = resolveSpeakerDisplay(card);
    const tier = tiersByCode.get(code);
    const rarity = RARITY_TIERS[tier];
    const keyFeatures = typByCode[code] ?? [];
    const forms = formsByCode[code] ?? null;
    const nearest = Array.isArray(nearestByCode[code]) ? nearestByCode[code] : [];
    const naturalPair = pairsByCode[code] ?? null;

    // ----- INDEX ENTRY (INDEX_CONTRACT — pinned by the contract test) -----
    indexEntries.push({
      code,
      name: card.name,
      iso639_1: card.iso639_1 ?? null,
      // Searchable aliases: alternate CODES plus documented alternate NAMES
      // (superset of the harness's code-resolution inputs, founder-approved
      // 2026-07-19).
      aliases: [...new Set([
        ...(Array.isArray(view?.aliases) ? view.aliases : (Array.isArray(card.aliases) ? card.aliases : [])),
        ...(Array.isArray(card.alternateNames) ? card.alternateNames : []),
      ])],
      nativeName: card.nativeName ?? null,
      family: cls.family,
      genus: cls.genus,
      macroarea: card.macroarea ?? null,
      isIsolate: card.isIsolate === true,
      modality: card.modality ?? null,
      isoType: card.isoType ?? null,
      // The registry's LETTER (I/M/S) — what migration 056 documents and
      // what taxonomy.js tests. The adapter offers isoScopeInitial alongside
      // the atlas's legible word.
      isoScope: card.isoScopeInitial ?? card.isoScope ?? null,
      macrolanguage: card.macrolanguage ?? null,
      speakers: speakerDisplay.display,
      speakerCount: speakerDisplay.count,
      script: card.script ?? null,
      scripts,
      dir: card.dir ?? null,
      vitalityBadge: stats.vitality,
      rarity,
      rarityOrder: RARITY_ORDER[tier] ?? 0,
      stats: stats.challengeRating,
      digitalToolkit: stats.digitalToolkit,
      // Dead lanes kept STAGED with their degenerate values so the
      // 46-column upload contract is unchanged (abilities extraction and
      // pipelineReadiness never produced data — verified 0 rows ever).
      abilities: [],
      pipelineLabel: 'N/A',
      pipelineEmoji: '➖',
      // Unit change (documented): cited card fields, was SQLite fact rows.
      factCount: Object.keys(card._fieldSources ?? {}).length,
      sourceCount: card.coverage?.sourceCount ?? null,
      hasVocabulary: !!forms,
      hasTypology: keyFeatures.length > 0,
      hasPhonology: !!card.phonologicalInventory,
      hasNearest: nearest.length > 0,
      hasNaturalPair: !!naturalPair,
      hasCultural: false, // dead lane — 0 rows ever
      // Semantic: "sources disagree" (envelope isDisputed) — intended jump
      // from prod's 14 (unresolved DB conflict rows) to ~2.2k.
      hasConflicts: disputed.length > 0,
      dialectCount: card.dialectCount ?? null,
      scriptName: scripts[0]?.name ?? card.script ?? null,
      regions: Array.isArray(card.countries) ? card.countries : [],
      ancestry,
      glottocode: card.glottocode ?? null,
      culturalAphorism: null,
      // Extra staged fields (uploader ignores them; kept for parity/debug)
      vitalityLevel: null,
      vitalityTrend: null,
      narrative: null,
      ancestryGlottocodes,
    });

    // ----- DETAIL ENTRY -----
    const provenance = assembleProvenance(card, disputed, { licenseFor, sourceMeta });
    const encyclopedic = (card.encyclopedic?.intro && card.encyclopedic?.intro_provenance)
      ? {
        intro: card.encyclopedic.intro,
        intro_provenance: card.encyclopedic.intro_provenance,
        intro_sources: Array.isArray(card.encyclopedic.intro_sources) ? card.encyclopedic.intro_sources : [],
      }
      : assembleEncyclopedic(card, { tcFeatures, curatedDir: CURATED_DIR });
    const experts = deriveExperts(card, {
      evalDatasets: view?.evalDatasets ?? [],
      corporaPublishers,
    });
    for (const e of experts) expertRows.push({ language_code: code, ...e });

    detailBuckets[code] = {
      classification: {
        family: cls.family,
        genus: cls.genus,
        ancestry,
        ancestryGlottocodes,
        familyGlottocode: cls.familyGlottocode,
        // every source's own family claim, kept side by side
        familyAttributions: cls.familyAttributions,
      },
      vitality: card.vitality ?? null,
      speakerEstimates: Array.isArray(card.speakerEstimates) ? card.speakerEstimates : [],
      linguisticChallenges: {},
      contactInfluences: [],
      formality: view?.formality ?? null,
      methodSupport: view?.methodSupport ?? {},
      resources: view?.resources ?? card.resources ?? {},
      evalDatasets: view?.evalDatasets ?? [],
      pipelineReadiness: {},
      digitalPresence: {},
      corpusAvailability: {},
      databaseCoverage: {},
      omt1600: null,
      regions: (Array.isArray(card.countries) ? card.countries : []).map((c) => ({ country: c })),
      countries: Array.isArray(card.countries) ? card.countries : [],
      coordinates: card.coordinates ?? null,
      alternateNames: Array.isArray(card.alternateNames) ? card.alternateNames : [],
      numeralSystem: card.numeralSystem ?? null,
      orthographicStatus: card.orthographicStatus ?? null,
      notes: null,

      // ── Card identity + config lane for the pure-dynamic harness/CLI ──
      code,
      name: card.name,
      iso639_3: card.iso639_3 ?? (/^[a-z]{3}$/.test(code) ? code : null),
      iso639_1: card.iso639_1 ?? null,
      bcp47: card.bcp47 ?? display(card.bcp47Tag, { onDisagreement: 'first' }) ?? null,
      aliases: Array.isArray(view?.aliases) ? view.aliases : (Array.isArray(card.aliases) ? card.aliases : []),
      extends: null,
      registers: view?.registers ?? null,
      rules: view?.rules ?? null,
      gender: view?.gender ?? null,
      metricModelSupport: view?.metricModelSupport ?? null,
      metricPlugins: view?.metricPlugins ?? null,
      evalPack: view?.evalPack ?? null,
      evalStandard: view?.evalStandard ?? null,
      evalMetrics: view?.evalMetrics ?? null,
      scoringProfile: view?.scoringProfile ?? null,

      narrative: null,
      externalLinks: assembleExternalLinks(card),
      encyclopedicResources: null,
      encyclopedic,
      apiSupport: stats.apiSupport,
      dialectInfo: null,
      glottocode: card.glottocode ?? null,

      modality: card.modality ?? null,
      isoType: card.isoType ?? null,
      isoScope: card.isoScopeInitial ?? card.isoScope ?? null,
      macrolanguage: card.macrolanguage ?? null,
      members: Array.isArray(card.members) && card.members.length > 0 ? card.members : null,
      taxonomyNotes: card.taxonomyNotes ?? null,

      // Vocabulary items moved to their own lane (trading_card_vocabulary,
      // migration 069). The detail keeps only the header summary so the
      // panel can render before the lazy fetch.
      vocabularySummary: forms ? (() => {
        const full = loadVocab(code);
        return full ? {
          totalForms: full.totalForms,
          sources: full.sources,
          asjpOnly: full.asjpOnly,
        } : null;
      })() : null,
      typology: keyFeatures.length > 0 ? {
        rawFeatureCount: keyFeatures.length,
        totalFeatures: keyFeatures.length,
        sourceBreakdown: Object.entries(keyFeatures.reduce((acc, f) => {
          acc[f.source] = (acc[f.source] ?? 0) + 1;
          return acc;
        }, {})).map(([source, featureCount]) => ({ source, featureCount })),
        keyFeatures,
        typologicalProfile: card.typologicalProfile ?? null,
      } : null,
      phonology: card.phonologicalInventory ? {
        ...card.phonologicalInventory,
        // _fieldSources keys phonology PER SUBFIELD (phonologicalInventory
        // .consonants, .vowels, …) — a bare-field lookup always misses and
        // shipped 2,110 panels with empty citations.
        sources: [...new Set(
          Object.entries(card._fieldSources ?? {})
            .filter(([k]) => k === 'phonologicalInventory'
              || k.startsWith('phonologicalInventory.'))
            .flatMap(([, v]) => (Array.isArray(v) ? v : [v])),
        )],
      } : null,
      colexification: projectColexification(card, { notes }),
      cultural: null, // dead lane — 0 rows ever

      nearestLanguages: nearest,
      naturalPair,

      statSources: stats.challengeRating.sources,
      statTooltip: stats.challengeRating.tooltip,
      provenance,
      experts,
    };

    // ----- VOCABULARY LANE (per-code staging for migration 069) -----
    if (forms) {
      const full = loadVocab(code);
      if (full) vocabBuckets[code] = full;
    }

    processed++;
    if (processed % 1000 === 0) {
      console.log(`  ${processed}/${targets.length} assembled (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
    }
  }

  console.log(`\nAssembled ${processed} languages in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // ── Rarity recalibration report (founder-review artifact) ──────────
  const report = buildRarityReport(records, tiersByCode, thresholds, baselineByCode, baselineTierCounts);

  // ── WRITE OUTPUT FILES ──────────────────────────────────────────────
  if (dryRun) {
    console.log('\n[DRY RUN] Would write:');
    console.log(`  tc-index.json — ${indexEntries.length} entries`);
    console.log(`  tc-lang/ — ${Object.keys(detailBuckets).length} files; tc-vocab/ — ${Object.keys(vocabBuckets).length} files`);
    console.log(`  tc-experts.json — ${expertRows.length} rows`);
  } else {
    mkdirSync(OUTPUT_DIR, { recursive: true });

    writeFileSync(join(OUTPUT_DIR, 'tc-index.json'), JSON.stringify(indexEntries));
    console.log(`✅ tc-index.json — ${indexEntries.length} entries`);

    const langDir = join(OUTPUT_DIR, 'tc-lang');
    mkdirSync(langDir, { recursive: true });
    let totalDetailBytes = 0;
    for (const [code, data] of Object.entries(detailBuckets)) {
      const json = JSON.stringify(data);
      writeFileSync(join(langDir, `${code}.json`), json);
      totalDetailBytes += json.length;
    }
    console.log(`✅ tc-lang/ — ${Object.keys(detailBuckets).length} files, ${(totalDetailBytes / 1024 / 1024).toFixed(1)}MB total`);

    const vocabDir = join(OUTPUT_DIR, 'tc-vocab');
    mkdirSync(vocabDir, { recursive: true });
    let totalVocabBytes = 0;
    for (const [code, data] of Object.entries(vocabBuckets)) {
      const json = JSON.stringify(data);
      writeFileSync(join(vocabDir, `${code}.json`), json);
      totalVocabBytes += json.length;
    }
    console.log(`✅ tc-vocab/ — ${Object.keys(vocabBuckets).length} files, ${(totalVocabBytes / 1024 / 1024).toFixed(1)}MB total`);

    // Prune staged files whose code left the built set — full builds only
    // (a --lang debug build stages one language and must not wipe the rest).
    if (!singleLang) {
      for (const [dir, built] of [[langDir, detailBuckets], [vocabDir, vocabBuckets]]) {
        const stale = readdirSync(dir)
          .filter((f) => f.endsWith('.json') && !(f.replace(/\.json$/, '') in built));
        for (const f of stale) unlinkSync(join(dir, f));
        if (stale.length) console.log(`✅ pruned ${stale.length} stale file(s) from ${dir.split('/').pop()}/`);
      }
    }

    // License register rows for the uploader (same row shape it already
    // maps — source, license_spdx, license_url, attribution, flags, notes).
    if (licenseRegister) {
      const rows = Object.entries(licenseRegister).map(([id, l]) => ({
        source: l.source ?? id,
        license_spdx: l.license_spdx ?? null,
        license_url: l.license_url ?? null,
        attribution: l.attribution ?? null,
        allows_redistribution: l.allows_redistribution ?? true,
        requires_attribution: l.requires_attribution ?? true,
        requires_sharealike: l.requires_sharealike ?? false,
        non_commercial_only: l.non_commercial_only ?? false,
        dataset_url: l.dataset_url ?? null,
        dataset_version: l.dataset_version ?? null,
        notes: l.notes ?? null,
      }));
      writeFileSync(join(OUTPUT_DIR, 'tc-licenses.json'), JSON.stringify(rows));
      console.log(`✅ tc-licenses.json — ${rows.length} source licenses`);

      // NC summary recomputed from atlas. Unit change stamped: asserted
      // atlas VALUES (was: SQLite fact rows), plus the forms sidecar counts
      // and a per-language rollup (new capability).
      const ncValues = atlas.prepare(`
        SELECT s.ID AS source, COUNT(*) AS n
          FROM cldf_values v JOIN cldf_sources s ON s.ID = v.Source
         WHERE s.Commercial_Use = 0 AND v.Status = 'asserted'
         GROUP BY s.ID ORDER BY n DESC
      `).all();
      const ncForms = atlas.prepare(`
        SELECT s.ID AS source, COUNT(*) AS n
          FROM cldf_forms f JOIN cldf_sources s ON s.ID = f.Source
         WHERE s.Commercial_Use = 0
         GROUP BY s.ID ORDER BY n DESC
      `).all();
      const ncPerLanguage = atlas.prepare(`
        SELECT f.Language_ID AS code, COUNT(*) AS n
          FROM cldf_forms f JOIN cldf_sources s ON s.ID = f.Source
         WHERE s.Commercial_Use = 0
         GROUP BY f.Language_ID ORDER BY n DESC
      `).all();
      const ncSummary = {
        _generated: new Date().toISOString(),
        _policy: 'docs/LICENSING.md — NC-source runtime policy',
        _unit: 'asserted atlas values + sidecar forms (was: champollion.db fact rows)',
        totalNcFacts: ncValues.reduce((a, r) => a + r.n, 0),
        sources: Object.fromEntries(ncValues.map((r) => [r.source, r.n])),
        forms: {
          totalNcForms: ncForms.reduce((a, r) => a + r.n, 0),
          sources: Object.fromEntries(ncForms.map((r) => [r.source, r.n])),
        },
        perLanguage: Object.fromEntries(ncPerLanguage.map((r) => [r.code, r.n])),
      };
      writeFileSync(join(OUTPUT_DIR, 'tc-nc-summary.json'), JSON.stringify(ncSummary, null, 2) + '\n');
      console.log(`✅ tc-nc-summary.json — ${ncValues.length} NC value sources, ${ncForms.length} NC forms sources`);
    } else {
      console.error('⚠️  license register absent — tc-licenses.json / tc-nc-summary.json NOT staged');
    }

    writeFileSync(join(OUTPUT_DIR, 'tc-experts.json'), JSON.stringify(expertRows));
    console.log(`✅ tc-experts.json — ${expertRows.length} expert rows from `
      + `${new Set(expertRows.map((r) => r.language_code)).size} languages`);

    writeFileSync(join(OUTPUT_DIR, 'rarity-recalibration-report.json'), JSON.stringify(report, null, 2) + '\n');
    writeFileSync(join(OUTPUT_DIR, 'rarity-recalibration-report.md'), renderRarityReportMd(report));
    console.log('✅ rarity-recalibration-report.{json,md}');
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────
  printSummary(indexEntries, report);
  if (notes.treebanksAbsent || notes.clicsStatsAbsent || notes.namelessCards.length) {
    console.log('\n── Lane-absence notes (expected until the ingest lanes land) ──');
    if (notes.treebanksAbsent) console.log(`  resources.treebanks absent on ${notes.treebanksAbsent} cards (UD lane in flight — pip false)`);
    if (notes.clicsStatsAbsent) console.log(`  CLICS stats params absent on ${notes.clicsStatsAbsent} cards (A4.5 lane — concepts/forms staged, density omitted)`);
    if (notes.namelessCards.length) console.log(`  nameless (unpublishable) cards: ${notes.namelessCards.length}`);
  }

  atlas.close();
  reportBuildDamage(); // exits 1 on fatal damage
  console.log('\nDone.');
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const vocabCache = new Map();
function loadVocab(code) {
  if (vocabCache.has(code)) return vocabCache.get(code);
  const p = join(FORMS_DIR, `${code}.json`);
  const data = existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
  vocabCache.set(code, data);
  return data;
}

function crHistogram(scores) {
  const buckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  for (const s of scores) {
    if (s >= 80) buckets['80-100']++;
    else if (s >= 60) buckets['60-79']++;
    else if (s >= 40) buckets['40-59']++;
    else if (s >= 20) buckets['20-39']++;
    else buckets['0-19']++;
  }
  return buckets;
}

function buildRarityReport(records, tiersByCode, thresholds, baselineByCode, baselineTierCounts) {
  const newTierCounts = {};
  for (const r of records) {
    const t = tiersByCode.get(r.code);
    newTierCounts[t] = (newTierCounts[t] ?? 0) + 1;
  }

  const movers = records
    .map((r) => {
      const base = baselineByCode.get(r.code);
      if (!base?.stats) return null;
      return {
        code: r.code,
        name: r.card.name,
        crBefore: base.stats.score,
        crAfter: r.stats.challengeRating.score,
        delta: r.stats.challengeRating.score - base.stats.score,
        componentsBefore: base.stats.components,
        componentsAfter: r.stats.challengeRating.components,
        tierBefore: base.rarity?.tier ?? null,
        tierAfter: tiersByCode.get(r.code),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.code.localeCompare(b.code))
    .slice(0, 50);

  return {
    _generated: new Date().toISOString(),
    method: 'percentile-anchored thresholds preserving legacy tier proportions '
      + '(founder-chosen); tiebreak (score desc, code asc)',
    thresholds,
    tierCounts: { baseline: baselineTierCounts, rebuilt: newTierCounts },
    crHistogram: {
      baseline: crHistogram([...baselineByCode.values()].map((e) => e.stats?.score).filter((s) => s != null)),
      rebuilt: crHistogram(records.map((r) => r.stats.challengeRating.score)),
    },
    top50Movers: movers,
  };
}

function renderRarityReportMd(report) {
  const tiers = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  const lines = [];
  lines.push('# Rarity recalibration report');
  lines.push('');
  lines.push(`Generated ${report._generated} by build-trading-card-data.mjs.`);
  lines.push('');
  lines.push('Method: ' + report.method + '.');
  lines.push('');
  lines.push('## Tier counts');
  lines.push('');
  lines.push('| tier | baseline (prod) | rebuilt | min score (threshold) |');
  lines.push('|------|----------------:|--------:|-----------------------:|');
  for (const t of tiers) {
    lines.push(`| ${t} | ${report.tierCounts.baseline[t] ?? 0} | ${report.tierCounts.rebuilt[t] ?? 0} | ${report.thresholds[t]?.toFixed(1) ?? '—'} |`);
  }
  lines.push('');
  lines.push('## Challenge Rating histogram');
  lines.push('');
  lines.push('| bucket | baseline | rebuilt |');
  lines.push('|--------|---------:|--------:|');
  for (const b of Object.keys(report.crHistogram.rebuilt)) {
    lines.push(`| ${b} | ${report.crHistogram.baseline[b] ?? 0} | ${report.crHistogram.rebuilt[b] ?? 0} |`);
  }
  lines.push('');
  lines.push('## Top 50 movers (|ΔCR|)');
  lines.push('');
  lines.push('| code | name | CR before → after | Δ | tier before → after | component deltas (api/corpus/typ/docs) |');
  lines.push('|------|------|-------------------|---|---------------------|------------------------------------------|');
  for (const m of report.top50Movers) {
    const cb = m.componentsBefore ?? {};
    const ca = m.componentsAfter ?? {};
    const cd = ['apiGap', 'corpusDesert', 'typDistance', 'docDepth']
      .map((k) => `${(ca[k] ?? 0) - (cb[k] ?? 0) >= 0 ? '+' : ''}${(ca[k] ?? 0) - (cb[k] ?? 0)}`)
      .join('/');
    lines.push(`| ${m.code} | ${m.name} | ${m.crBefore} → ${m.crAfter} | ${m.delta >= 0 ? '+' : ''}${m.delta} | ${m.tierBefore} → ${m.tierAfter} | ${cd} |`);
  }
  lines.push('');
  return lines.join('\n') + '\n';
}

function printSummary(indexEntries, report) {
  const rarityDist = {};
  for (const e of indexEntries) rarityDist[e.rarity.tier] = (rarityDist[e.rarity.tier] ?? 0) + 1;
  console.log('\n── Rarity Distribution ──');
  for (const [tier, count] of Object.entries(rarityDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${RARITY_TIERS[tier]?.emoji ?? '?'} ${tier}: ${count}`);
  }

  const scores = indexEntries.map((e) => e.stats.score);
  if (scores.length) {
    console.log('\n── Challenge Rating Distribution ──');
    console.log(`  Range: ${Math.min(...scores)}–${Math.max(...scores)}, `
      + `Average: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`);
    for (const [bucket, count] of Object.entries(crHistogram(scores))) {
      console.log(`  ${bucket}: ${count}`);
    }
  }

  const vitalityDist = {};
  for (const e of indexEntries) {
    const lvl = e.vitalityBadge.level;
    vitalityDist[lvl] = (vitalityDist[lvl] ?? 0) + 1;
  }
  console.log('\n── Vitality Badge Distribution ──');
  for (const [level, count] of Object.entries(vitalityDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level}: ${count}`);
  }

  console.log('\n── Data Coverage ──');
  for (const [label, key] of [
    ['Vocabulary', 'hasVocabulary'], ['Typology', 'hasTypology'],
    ['Phonology', 'hasPhonology'], ['Nearest', 'hasNearest'],
    ['Natural pairs', 'hasNaturalPair'], ['Conflicts (sources disagree)', 'hasConflicts'],
  ]) {
    console.log(`  ${label}: ${indexEntries.filter((e) => e[key]).length}/${indexEntries.length}`);
  }

  // Contract self-check: every index entry carries every contract field.
  for (const e of indexEntries) {
    for (const field of INDEX_CONTRACT) {
      if (!(field in e)) {
        console.error(`✗ index entry ${e.code} missing contract field '${field}'`);
        process.exit(1);
      }
    }
  }
}

main();
