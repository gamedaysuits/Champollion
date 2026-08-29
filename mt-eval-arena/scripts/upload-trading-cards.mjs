#!/usr/bin/env node

/**
 * upload-trading-cards.mjs — Supabase Uploader
 *
 * Reads pre-built trading card data from the build script's output and
 * upserts it to the Supabase trading_card_index and trading_card_detail
 * tables. Supabase is the managed source of truth for all served data.
 *
 * Pipeline:
 *   champollion.db (SQLite, local)
 *     → build-trading-card-data.mjs (compute stats, rarity, abilities)
 *       → upload-trading-cards.mjs (THIS SCRIPT — upsert to Supabase)
 *         → trading_card_index + trading_card_detail tables
 *
 * The build script writes JSON to a staging directory (data/staging/).
 * This script reads from there and upserts to Supabase in batches.
 *
 * Environment — one pair per target, so neither is ever swapped out:
 *   SUPABASE_DEV_URL      / SUPABASE_DEV_SERVICE_KEY   → --target dev  (acl-staging)
 *   SUPABASE_URL          / SUPABASE_SERVICE_KEY       → --target prod
 * Service ROLE keys, not anon keys. A preview branch is its own Supabase
 * project, so production's key does not work against staging.
 *
 * Usage:
 *   node scripts/upload-trading-cards.mjs
 *   node scripts/upload-trading-cards.mjs --dry-run       # Count rows, don't write
 *   node scripts/upload-trading-cards.mjs --lang crk      # Upload single language
 *   node scripts/upload-trading-cards.mjs --retire-stale  # Also DELETE prod
 *       trading_card_index/detail rows whose code is no longer in staging.
 *       Upserts alone can't shrink prod (legacy family-/genus-/macrolanguage-
 *       pseudo-hub rows survive forever); full-catalogue re-syncs need this.
 *       trading_card_vocabulary rows for retired codes go with them via the
 *       migration-069 ON DELETE CASCADE FK; vocab rows whose code SURVIVES in
 *       the index but left the tc-vocab staging set are deleted explicitly
 *       (the cascade cannot see those). Refused with --lang (a
 *       single-language staging set would retire the whole catalogue).
 *
 * Lane flags (mutually exclusive):
 *   --index-only    index + small registers only (no detail, no vocab)
 *   --detail-only   detail blobs only (no index, no vocab)
 *   --vocab-only    trading_card_vocabulary only (migration 069) — the
 *                   surgical lane for vocabulary re-uploads; skips index,
 *                   detail, licenses and experts. The default (no flag) run
 *                   uploads index + detail + vocab + registers.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_DIR = join(__dirname, '..', 'data', 'staging');

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

// Load .env.local from the repo root, so credentials live in ONE gitignored
// file instead of being exported by hand before every run. A variable already
// present in the shell WINS — an explicit `SUPABASE_DEV_URL=... node ...`
// should override the file, never be silently replaced by it.
(() => {
  const envFile = join(__dirname, '..', '..', '.env.local');
  if (!existsSync(envFile)) return;
  for (const raw of readFileSync(envFile, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
})();

// ONE SET OF CREDENTIALS PER TARGET, so neither has to be swapped out.
//
// There used to be a single SUPABASE_URL / SUPABASE_SERVICE_KEY pair, which
// meant pointing this script at staging required editing the same variables
// the website build and every other tool read — and putting them back
// afterwards. A forgotten swap in either direction is how a staging run lands
// in production, or a production run silently writes to an empty branch.
//
// So each target has its own variables and they coexist:
//
//   SUPABASE_DEV_URL          / SUPABASE_DEV_SERVICE_KEY     → --target dev
//   SUPABASE_URL              / SUPABASE_SERVICE_KEY         → --target prod
//     (or SUPABASE_PROD_URL   / SUPABASE_PROD_SERVICE_KEY)
//
// The guard below still checks the resolved URL against the project ref the
// target names, so a variable filled in wrongly is caught rather than trusted.
const CREDENTIALS = {
  dev: {
    url: process.env.SUPABASE_DEV_URL,
    key: process.env.SUPABASE_DEV_SERVICE_KEY,
    vars: ['SUPABASE_DEV_URL', 'SUPABASE_DEV_SERVICE_KEY'],
  },
  prod: {
    url: process.env.SUPABASE_PROD_URL ?? process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PROD_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_KEY,
    vars: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
  },
};

// Batch sizes — index rows are compact, detail rows have large JSONB blobs
const INDEX_BATCH_SIZE = 500;
const DETAIL_BATCH_SIZE = 50;  // Reduced: 500-row detail batches cause statement timeouts
// Vocabulary blobs are the biggest payloads of all (they were 70–95% of the
// old detail blobs; san alone is ~2.4MB) — smaller batches than detail, same
// retry-on-57014 discipline.
const VOCAB_BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const detailOnly = args.includes('--detail-only');
// --index-only: upsert trading_card_index (and the small licenses/experts
// registers) but leave trading_card_detail untouched. The mirror of
// --detail-only, for corrections whose verified change surface is
// index-columns-only — a full run would also move ~500MB of detail blobs
// to the CURRENT card corpus, silently changing the detail rows' data
// vintage as a side effect of an index fix.
const indexOnly = args.includes('--index-only');
// --vocab-only: upsert trading_card_vocabulary (migration 069) and nothing
// else. The vocabulary lane's mirror of --index-only/--detail-only: a
// vocabulary correction should not move ~150MB of detail blobs or touch the
// index rows' data vintage as a side effect.
const vocabOnly = args.includes('--vocab-only');
const singleLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const retireStale = args.includes('--retire-stale');

if ([indexOnly, detailOnly, vocabOnly].filter(Boolean).length > 1) {
  console.error('ERROR: --index-only, --detail-only and --vocab-only are mutually exclusive.');
  process.exit(1);
}
// Which lanes does this invocation write? Default (no lane flag) = all three.
const doIndex = !detailOnly && !vocabOnly;
const doDetail = !indexOnly && !vocabOnly;
const doVocab = !indexOnly && !detailOnly;
// The small registers (source_licenses, language_experts) ride the
// index/detail lanes as before; the surgical vocab lane leaves them alone.
const doRegisters = !vocabOnly;

if (retireStale && singleLang) {
  console.error('ERROR: --retire-stale cannot be combined with --lang — a single-language');
  console.error('staging set would retire every other card in prod. Run a full build first.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TARGET GUARD — which database am I about to write to?
//
// This script took SUPABASE_URL from the environment and wrote to whatever it
// found. The repo's own .env.local points at the PRODUCTION project, so
// `npm run build-and-upload` from a default shell wrote straight to prod —
// directly against CLAUDE.md's standing rule ("Supabase: dev branch only
// without explicit go-ahead. Never write to the production main project
// without asking").
//
// Nothing in the script said which database it was talking to, so a
// destructive run and a safe one looked identical in the terminal. The target
// is now stated, checked against --target, and production requires a second
// flag that cannot be typed by accident.
// ---------------------------------------------------------------------------

/** Supabase project refs, from docs/ECOSYSTEM_VERIFICATION_LOG.md. */
const PROJECT_REFS = {
  prod: 'sjdomynysdljkbemupqa',
  dev: 'xhvqqnxtvgggzcweofrp', // acl-staging
};

/** The project ref embedded in a Supabase URL, or null if unrecognised. */
function projectRefOf(url) {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(String(url).trim());
  return m ? m[1] : null;
}

const targetArg = args.includes('--target') ? args[args.indexOf('--target') + 1] : null;

if (!targetArg) {
  const envRef = projectRefOf(process.env.SUPABASE_URL);
  const envName = Object.entries(PROJECT_REFS).find(([, r]) => r === envRef)?.[0] ?? null;
  console.error('ERROR: --target is required, so that a write always states its destination.');
  console.error('');
  console.error(`  SUPABASE_URL currently points at: ${envRef ?? '(unrecognised)'}`
    + `${envName ? ` — the ${envName.toUpperCase()} project` : ''}`);
  console.error('');
  console.error('  --target dev    write to acl-staging');
  console.error('  --target prod   write to production (also requires --i-mean-production)');
  process.exit(1);
}
if (!(targetArg in PROJECT_REFS)) {
  console.error(`ERROR: unknown --target '${targetArg}'. Expected: dev, prod.`);
  process.exit(1);
}

const creds = CREDENTIALS[targetArg];
const SUPABASE_URL = creds.url;
const SUPABASE_SERVICE_KEY = creds.key;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(`ERROR: no credentials for --target ${targetArg}.`);
  console.error('');
  console.error(`  Set ${creds.vars[0]} and ${creds.vars[1]} in .env.local`);
  console.error('  (which is gitignored) or export them in your shell.');
  if (targetArg === 'dev') {
    console.error('');
    console.error('  The dev branch is acl-staging. Its keys are its OWN — a preview branch');
    console.error('  is a separate Supabase project, so production\'s service key will not');
    console.error(`  work against it. Project ref: ${PROJECT_REFS.dev}`);
  }
  process.exit(1);
}

const actualRef = projectRefOf(SUPABASE_URL);
const actualName = Object.entries(PROJECT_REFS).find(([, r]) => r === actualRef)?.[0] ?? null;

if (actualRef !== PROJECT_REFS[targetArg]) {
  console.error(`ERROR: --target ${targetArg} expects project `
    + `${PROJECT_REFS[targetArg]}, but ${creds.vars[0]} points at `
    + `${actualRef ?? '(unrecognised)'}${actualName ? ` (${actualName})` : ''}.`);
  console.error('');
  console.error('Refusing to write. The environment and the stated intent disagree, and');
  console.error('guessing which one is right is exactly how a staging run lands in prod.');
  process.exit(1);
}
if (targetArg === 'prod' && !args.includes('--i-mean-production') && !dryRun) {
  console.error('ERROR: writing to PRODUCTION requires --i-mean-production.');
  console.error('');
  console.error('Production is the live catalogue. Per CLAUDE.md it needs an explicit');
  console.error('founder go-ahead at the moment of the write, not a stale export in a shell.');
  process.exit(1);
}
console.log(`  target: ${targetArg.toUpperCase()} (${actualRef})${dryRun ? ' — dry run' : ''}`);

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  upload-trading-cards.mjs — Staging → Supabase      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();

  // ── 1. Read staged index ──────────────────────────────────────────
  const indexPath = join(STAGING_DIR, 'tc-index.json');
  if (!existsSync(indexPath)) {
    console.error(`ERROR: Staging file not found: ${indexPath}`);
    console.error('Run "npm run build" first to generate staging data from SQLite.');
    process.exit(1);
  }

  let indexEntries = JSON.parse(readFileSync(indexPath, 'utf-8'));
  console.log(`Loaded ${indexEntries.length} index entries from staging`);

  // Filter to single language if requested
  if (singleLang) {
    indexEntries = indexEntries.filter(e => e.code === singleLang);
    if (indexEntries.length === 0) {
      console.error(`ERROR: Language '${singleLang}' not found in index.`);
      process.exit(1);
    }
    console.log(`  → Filtered to: ${singleLang}`);
  }

  // ── 2. Read staged detail files ───────────────────────────────────
  // --index-only never touches trading_card_detail, so skip the time and
  // ~500MB of memory it costs to load detail blobs that will not be sent.
  const detailMap = {};
  if (!doDetail) {
    console.log(`${indexOnly ? '--index-only' : '--vocab-only'}: detail staging not loaded (trading_card_detail untouched).`);
  } else {
    const langDir = join(STAGING_DIR, 'tc-lang');
    if (!existsSync(langDir)) {
      console.error(`ERROR: Staging directory not found: ${langDir}`);
      process.exit(1);
    }

    // Build code → detail map from the staged files
    const detailFiles = readdirSync(langDir).filter(f => f.endsWith('.json'));
    for (const file of detailFiles) {
      const code = file.replace('.json', '');
      if (singleLang && code !== singleLang) continue;
      try {
        detailMap[code] = JSON.parse(readFileSync(join(langDir, file), 'utf-8'));
      } catch (err) {
        console.warn(`  WARN: Failed to parse ${file}: ${err.message}`);
      }
    }
    console.log(`Loaded ${Object.keys(detailMap).length} detail files from staging`);
  }

  // ── 2.5 Read staged vocabulary files (migration 069 lane) ─────────
  // tc-vocab/<code>.json → trading_card_vocabulary. Loaded lazily as file
  // paths first (blobs are huge — san alone ~2.4MB); parsed per batch below.
  const vocabDir = join(STAGING_DIR, 'tc-vocab');
  let vocabCodes = [];
  if (!doVocab) {
    console.log(`${indexOnly ? '--index-only' : '--detail-only'}: vocab staging not loaded (trading_card_vocabulary untouched).`);
  } else {
    if (!existsSync(vocabDir)) {
      console.error(`ERROR: Vocabulary staging directory not found: ${vocabDir}`);
      console.error('Run "npm run build" (build-trading-card-data.mjs) first — it writes tc-vocab/.');
      process.exit(1);
    }
    vocabCodes = readdirSync(vocabDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .filter(code => !singleLang || code === singleLang)
      .sort();
    if (singleLang && vocabCodes.length === 0) {
      console.log(`  ℹ️  No tc-vocab/${singleLang}.json — language has no staged vocabulary (skipping vocab lane)`);
    }
    console.log(`Found ${vocabCodes.length} vocabulary files in staging`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would upsert:');
    console.log(`  trading_card_index: ${doIndex ? `${indexEntries.length} rows` : 'skipped'}`);
    console.log(`  trading_card_detail: ${doDetail ? `${Object.keys(detailMap).length} rows` : 'skipped'}`);
    console.log(`  trading_card_vocabulary: ${doVocab ? `${vocabCodes.length} rows` : 'skipped'}`);
    const dryExpertsPath = join(STAGING_DIR, 'tc-experts.json');
    if (doRegisters && existsSync(dryExpertsPath)) {
      const dryExperts = JSON.parse(readFileSync(dryExpertsPath, 'utf-8'));
      console.log(`  language_experts: ${singleLang ? dryExperts.filter(r => r.language_code === singleLang).length : dryExperts.length} rows`);
    }
    const indexSize = doIndex ? Buffer.byteLength(JSON.stringify(indexEntries)) : 0;
    const detailSize = Object.values(detailMap).reduce((sum, d) => sum + Buffer.byteLength(JSON.stringify(d)), 0);
    const vocabSize = vocabCodes.reduce((sum, c) => sum + statSync(join(vocabDir, `${c}.json`)).size, 0);
    console.log(`  Index payload: ${(indexSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  Detail payload: ${(detailSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  Vocab payload: ${(vocabSize / 1024 / 1024).toFixed(1)} MB (file bytes)`);
    if (retireStale) {
      console.log('  --retire-stale: prod rows not in staging would be DELETED (index + detail/vocab');
      console.log('  via the ON DELETE CASCADE FKs; surviving-code vocab rows outside tc-vocab/ explicitly).');
    }
    return;
  }

  // ── 3. Connect to Supabase ────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 4. Upsert index rows ──────────────────────────────────────────
  // Declared at main() scope so the §7 summary can report it even though
  // the upsert runs inside the !detailOnly block.
  let indexUpserted = 0;
  if (doIndex) {
    console.log('\nUpserting index rows...');

    // Preflight (migration 056): the taxonomy columns must exist before we
    // upsert rows that carry them — PostgREST rejects unknown columns, and
    // failing here with the migration named beats a cryptic batch error.
    // Silently omitting the fields instead is exactly the bug this guards
    // against (a DB round-trip that zeroes the homepage living/at-risk
    // stats), so there is deliberately no skip flag.
    const { error: probeError } = await supabase
      .from('trading_card_index')
      .select('iso_type')
      .limit(1);
    if (probeError) {
      console.error('ERROR: preflight select of trading_card_index.iso_type failed:');
      console.error(`  ${probeError.message}`);
      if (probeError.code === '42703' || /iso_type/.test(probeError.message || '')) {
        console.error('');
        console.error('The taxonomy columns (iso_type, modality, iso_scope, macrolanguage)');
        console.error('are missing from this database. Apply');
        console.error('  supabase/migrations/056_trading_card_index_taxonomy_fields.sql');
        console.error('to it first, then re-run the upload.');
      }
      process.exit(1);
    }

    // Transform index entries from camelCase (build script output) to
    // snake_case (Supabase column names)
    const indexRows = indexEntries.map(e => ({
      code: e.code,
      name: e.name,
      // Resolution identity for the pure-dynamic harness/CLI card loaders
      // (migration 032). SSOT: cli/shared/language-cards.
      iso639_1: e.iso639_1 || null,
      aliases: Array.isArray(e.aliases) ? e.aliases : [],
      native_name: e.nativeName || null,
      family: e.family || null,
      genus: e.genus || null,
      macroarea: e.macroarea || null,
      is_isolate: e.isIsolate || false,
      // Taxonomy badging (migration 056; SSOT: cli/shared/language-cards).
      // The website's DB-reconstructed tc-index.json reads living/at-risk
      // straight off these — dropping them silently zeroes the homepage
      // hero stats (the 2026-07-19 latent bug). Keep in sync with
      // cli/website/scripts/lib/tc-index-remote.js (indexRowToEntry).
      modality: e.modality || null,
      iso_type: e.isoType || null,
      iso_scope: e.isoScope || null,
      macrolanguage: e.macrolanguage || null,
      speakers: e.speakers || null,
      speaker_count: e.speakerCount ?? null,
      script: e.script || null,
      scripts: e.scripts || [],
      dir: e.dir ?? null,
      vitality_badge: e.vitalityBadge || {},
      rarity: e.rarity || {},
      rarity_order: e.rarityOrder ?? null,
      challenge_rating: e.stats || {},
      digital_toolkit: e.digitalToolkit || {},
      abilities: e.abilities || [],
      stats: e.stats || null,
      pipeline_label: e.pipelineLabel || null,
      pipeline_emoji: e.pipelineEmoji || null,
      fact_count: e.factCount ?? null,
      source_count: e.sourceCount ?? null,
      has_vocabulary: e.hasVocabulary || false,
      has_typology: e.hasTypology || false,
      has_phonology: e.hasPhonology || false,
      has_nearest: e.hasNearest || false,
      has_natural_pair: e.hasNaturalPair || false,
      has_cultural: e.hasCultural || false,
      has_conflicts: e.hasConflicts || false,
      dialect_count: e.dialectCount || null,
      script_name: e.scriptName || null,
      regions: e.regions || [],
      ancestry: e.ancestry || [],
      glottocode: e.glottocode || null,
      cultural_aphorism: e.culturalAphorism || null,
      updated_at: new Date().toISOString(),
    }));

    // Upsert in batches
    for (let i = 0; i < indexRows.length; i += INDEX_BATCH_SIZE) {
      const batch = indexRows.slice(i, i + INDEX_BATCH_SIZE);
      const { error } = await supabase
        .from('trading_card_index')
        .upsert(batch, { onConflict: 'code' });

      if (error) {
        console.error(`ERROR upserting index batch ${i}–${i + batch.length}: ${error.message}`);
        console.error('  Details:', JSON.stringify(error, null, 2));
        process.exit(1);
      }

      indexUpserted += batch.length;
      if (indexUpserted % 2000 === 0 || indexUpserted === indexRows.length) {
        console.log(`  ${indexUpserted}/${indexRows.length} index rows upserted`);
      }
    }
    console.log(`  ✅ Index complete: ${indexUpserted} rows`);
  } else {
    console.log(`\n[${detailOnly ? '--detail-only' : '--vocab-only'}] Skipping index upsert`);
  }

  // ── 5. Upsert detail rows ────────────────────────────────────────
  // Under --index-only/--vocab-only, detailMap is empty (§2 never loads it),
  // so this block is a structural no-op: zero rows mapped, zero batches sent.
  console.log(doDetail ? '\nUpserting detail rows...' : `\n[${indexOnly ? '--index-only' : '--vocab-only'}] Skipping detail upsert`);

  const detailRows = Object.entries(detailMap).map(([code, detail]) => ({
    code,
    detail,
    fact_count: detail.provenance?.totalFacts || 0,
    source_count: detail.provenance?.sources?.length || 0,
    updated_at: new Date().toISOString(),
  }));

  let detailUpserted = 0;
  let detailErrors = 0;
  for (let i = 0; i < detailRows.length; i += DETAIL_BATCH_SIZE) {
    const batch = detailRows.slice(i, i + DETAIL_BATCH_SIZE);

    // Retry with exponential backoff for statement timeouts
    let retries = 0;
    const maxRetries = 3;
    let success = false;

    while (!success && retries <= maxRetries) {
      const { error } = await supabase
        .from('trading_card_detail')
        .upsert(batch, { onConflict: 'code' });

      if (!error) {
        success = true;
      } else if (error.code === '57014' && retries < maxRetries) {
        // Statement timeout — wait and retry with smaller batch
        retries++;
        const waitMs = 1000 * Math.pow(2, retries);
        console.warn(`  TIMEOUT on batch ${i}–${i + batch.length}, retry ${retries}/${maxRetries} after ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        console.error(`ERROR upserting detail batch ${i}–${i + batch.length}: ${error.message}`);
        detailErrors++;
        break;  // Skip this batch, continue with next
      }
    }

    if (success) detailUpserted += batch.length;
    if (detailUpserted % 500 === 0 || (i + DETAIL_BATCH_SIZE) >= detailRows.length) {
      console.log(`  ${detailUpserted}/${detailRows.length} detail rows upserted${detailErrors > 0 ? ` (${detailErrors} errors)` : ''}`);
    }
  }

  // ── 5.3 Upsert vocabulary rows (migration 069) ───────────────────
  // tc-vocab/<code>.json → trading_card_vocabulary. Same discipline as the
  // detail lane (small batches + exponential retry on 57014 statement
  // timeouts), with even smaller batches — vocabulary blobs are the largest
  // payloads in the catalogue. Files are parsed per batch, never all at
  // once (~the full set is hundreds of MB).
  let vocabUpserted = 0;
  let vocabErrors = 0;
  if (!doVocab) {
    console.log(`\n[${indexOnly ? '--index-only' : '--detail-only'}] Skipping vocabulary upsert`);
  } else {
    console.log('\nUpserting vocabulary rows...');

    // Preflight (migration 069): the table must exist before we send rows.
    // Failing here with the migration named beats a cryptic batch error —
    // and silently skipping would leave the site's lazy-fetch lane serving
    // nothing while the detail blobs no longer carry vocabulary. Same
    // pattern as the migration-056 index preflight; deliberately no skip
    // flag.
    const { error: vocabProbeError } = await supabase
      .from('trading_card_vocabulary')
      .select('code')
      .limit(1);
    if (vocabProbeError) {
      console.error('ERROR: preflight select of trading_card_vocabulary failed:');
      console.error(`  ${vocabProbeError.message}`);
      console.error('');
      console.error('The trading_card_vocabulary table is missing from this database. Apply');
      console.error('  supabase/migrations/069_create_trading_card_vocabulary.sql');
      console.error('to it first (dev has it since 2026-08; prod needs founder go-ahead),');
      console.error('then re-run the upload.');
      process.exit(1);
    }

    for (let i = 0; i < vocabCodes.length; i += VOCAB_BATCH_SIZE) {
      const codes = vocabCodes.slice(i, i + VOCAB_BATCH_SIZE);
      const batch = [];
      for (const code of codes) {
        let blob;
        try {
          blob = JSON.parse(readFileSync(join(vocabDir, `${code}.json`), 'utf-8'));
        } catch (err) {
          console.error(`ERROR: unparseable tc-vocab/${code}.json: ${err.message}`);
          vocabErrors++;
          continue;
        }
        batch.push({
          code,
          items: blob.items ?? [],
          total_forms: blob.totalForms ?? 0,
          sources: blob.sources ?? [],
          asjp_only: blob.asjpOnly ?? false,
          updated_at: new Date().toISOString(),
        });
      }
      if (batch.length === 0) continue;

      // Retry with exponential backoff for statement timeouts (57014),
      // exactly like the detail lane.
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      while (!success && retries <= maxRetries) {
        const { error } = await supabase
          .from('trading_card_vocabulary')
          .upsert(batch, { onConflict: 'code' });

        if (!error) {
          success = true;
        } else if (error.code === '57014' && retries < maxRetries) {
          retries++;
          const waitMs = 1000 * Math.pow(2, retries);
          console.warn(`  TIMEOUT on vocab batch ${i}–${i + batch.length}, retry ${retries}/${maxRetries} after ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          console.error(`ERROR upserting vocab batch ${i}–${i + batch.length}: ${error.message}`);
          vocabErrors++;
          break;  // Skip this batch, continue with next
        }
      }

      if (success) vocabUpserted += batch.length;
      if (vocabUpserted % 500 === 0 || (i + VOCAB_BATCH_SIZE) >= vocabCodes.length) {
        console.log(`  ${vocabUpserted}/${vocabCodes.length} vocab rows upserted${vocabErrors > 0 ? ` (${vocabErrors} errors)` : ''}`);
      }
    }
  }

  // ── 5.5 Retire stale prod rows (opt-in: --retire-stale) ──────────
  // Upserts alone can never SHRINK prod: rows whose code left the staging
  // set (e.g. the legacy family-/genus-/macrolanguage- pseudo-hub rows that
  // predate the card-SSOT gate in build-trading-card-data.mjs) survive every
  // re-upload. On a full-catalogue re-sync this step deletes them from
  // trading_card_index; trading_card_detail rows follow via the ON DELETE
  // CASCADE FK (migration 012), and trading_card_vocabulary rows likewise
  // (migration 069: `REFERENCES trading_card_index(code) ON DELETE CASCADE`
  // — verified in 069_create_trading_card_vocabulary.sql; no duplicate
  // delete needed for retired codes). One case the cascade CANNOT cover: a
  // code that survives in the index but no longer has a tc-vocab file (its
  // vocabulary became non-redistributable, or emptied). Those vocab rows
  // are deleted explicitly below. Prod codes are read PAGINATED —
  // PostgREST caps single responses regardless of the requested limit.
  let retiredCount = 0;
  let retiredVocabCount = 0;
  if (retireStale) {
    console.log('\nRetiring prod rows no longer in staging...');
    const PAGE = 1000;
    // Index-row retirement (with its detail+vocab cascade) is an
    // index-lane operation — the surgical vocab lane must not delete
    // catalogue rows as a side effect.
    if (vocabOnly) {
      console.log('  ℹ️  [--vocab-only] index-row retirement skipped (vocab-stale check below still runs).');
    } else {
    const stagedCodes = new Set(indexEntries.map(e => e.code));
    const prodCodes = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('trading_card_index')
        .select('code')
        .order('code', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error(`ERROR reading prod codes (page at ${from}): ${error.message}`);
        console.error('Aborting retire step — nothing deleted.');
        break;
      }
      prodCodes.push(...data.map(r => r.code));
      if (data.length < PAGE) {
        const stale = prodCodes.filter(c => !stagedCodes.has(c));
        if (stale.length === 0) {
          console.log('  ✅ No stale rows — prod matches staging.');
        } else {
          console.log(`  ${stale.length} stale code(s): ${stale.slice(0, 10).join(', ')}${stale.length > 10 ? ', …' : ''}`);
          for (let i = 0; i < stale.length; i += 100) {
            const batch = stale.slice(i, i + 100);
            const { error: delError } = await supabase
              .from('trading_card_index')
              .delete()
              .in('code', batch);
            if (delError) {
              console.error(`ERROR deleting stale batch ${i}–${i + batch.length}: ${delError.message}`);
              break;
            }
            retiredCount += batch.length;
          }
          console.log(`  ✅ Retired ${retiredCount} stale row(s) (detail + vocabulary removed via FK cascade).`);
        }
        break;
      }
    }
    }

    // Surviving-code vocab rows whose vocabulary left the staging set — the
    // FK cascade never fires for these (their index row stays). Needs the
    // staged vocab set, so it only runs when this invocation loaded it.
    if (!doVocab) {
      console.log('  ℹ️  vocab-stale check skipped (vocab staging not loaded under this lane flag).');
    } else {
      const stagedVocab = new Set(vocabCodes);
      const prodVocabCodes = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('trading_card_vocabulary')
          .select('code')
          .order('code', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          console.error(`ERROR reading prod vocab codes (page at ${from}): ${error.message}`);
          console.error('Aborting vocab-stale step — nothing deleted.');
          break;
        }
        prodVocabCodes.push(...data.map(r => r.code));
        if (data.length < PAGE) {
          const staleVocab = prodVocabCodes.filter(c => !stagedVocab.has(c));
          if (staleVocab.length === 0) {
            console.log('  ✅ No stale vocabulary rows — prod matches tc-vocab staging.');
          } else {
            console.log(`  ${staleVocab.length} stale vocab code(s): ${staleVocab.slice(0, 10).join(', ')}${staleVocab.length > 10 ? ', …' : ''}`);
            for (let i = 0; i < staleVocab.length; i += 100) {
              const batch = staleVocab.slice(i, i + 100);
              const { error: delError } = await supabase
                .from('trading_card_vocabulary')
                .delete()
                .in('code', batch);
              if (delError) {
                console.error(`ERROR deleting stale vocab batch ${i}–${i + batch.length}: ${delError.message}`);
                break;
              }
              retiredVocabCount += batch.length;
            }
            console.log(`  ✅ Retired ${retiredVocabCount} stale vocabulary row(s).`);
          }
          break;
        }
      }
    }
  }

  // ── 6. Upsert source_licenses (if staging file exists) ───────────
  const licensesPath = join(STAGING_DIR, 'tc-licenses.json');
  let licensesUpserted = 0;
  if (!doRegisters) {
    console.log('\n[--vocab-only] Skipping source_licenses upload');
  } else if (existsSync(licensesPath)) {
    console.log('\nUpserting source_licenses...');
    const licenses = JSON.parse(readFileSync(licensesPath, 'utf-8'));

    // Transform SQLite column names to Postgres column names (same names)
    const licenseRows = licenses.map(l => ({
      source: l.source,
      license_spdx: l.license_spdx || null,
      license_url: l.license_url || null,
      attribution: l.attribution || null,
      allows_redistribution: l.allows_redistribution ?? true,
      requires_attribution: l.requires_attribution ?? true,
      requires_sharealike: l.requires_sharealike ?? false,
      non_commercial_only: l.non_commercial_only ?? false,
      dataset_url: l.dataset_url || null,
      dataset_version: l.dataset_version || null,
      notes: l.notes || null,
    }));

    // Upsert in batches of 100
    for (let i = 0; i < licenseRows.length; i += 100) {
      const batch = licenseRows.slice(i, i + 100);
      const { error } = await supabase
        .from('source_licenses')
        .upsert(batch, { onConflict: 'source' });

      if (error) {
        console.warn(`  WARN: License upsert batch ${i}: ${error.message}`);
        // Non-fatal — continue with rest of upload
      } else {
        licensesUpserted += batch.length;
      }
    }
    console.log(`  ✅ source_licenses: ${licensesUpserted} rows`);
  } else {
    console.log('\n  ℹ️  No tc-licenses.json found — skipping source_licenses upload');
  }

  // ── 6.5 Upsert language_experts (if staging file exists) ─────────
  // Rows come from tc-experts.json (built by build-trading-card-data.mjs
  // from the language card experts[] field — the SSOT). The natural key
  // (language_code, name, role) has a UNIQUE constraint in migration 018,
  // so re-uploads are idempotent. Note: rows deleted upstream are NOT
  // removed here (upsert-only, same behavior as source_licenses).
  const expertsPath = join(STAGING_DIR, 'tc-experts.json');
  let expertsUpserted = 0;
  if (!doRegisters) {
    console.log('\n[--vocab-only] Skipping language_experts upload');
  } else if (existsSync(expertsPath)) {
    console.log('\nUpserting language_experts...');
    let expertRows = JSON.parse(readFileSync(expertsPath, 'utf-8'));

    if (singleLang) {
      expertRows = expertRows.filter(r => r.language_code === singleLang);
      console.log(`  → Filtered to: ${singleLang} (${expertRows.length} rows)`);
    }

    // Staging rows are already in snake_case column shape; normalize
    // optionals defensively so Postgres never sees `undefined`.
    const rows = expertRows.map(r => ({
      language_code: r.language_code,
      name: r.name,
      type: r.type,
      affiliation: r.affiliation || null,
      role: r.role,
      url: r.url || null,
      orcid: r.orcid || null,
      source: r.source,
      updated_at: new Date().toISOString(),
    }));

    // Upsert in batches of 500 (compact rows, like the index)
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('language_experts')
        .upsert(batch, { onConflict: 'language_code,name,role' });

      if (error) {
        console.warn(`  WARN: Experts upsert batch ${i}: ${error.message}`);
        // Non-fatal — continue with rest of upload
      } else {
        expertsUpserted += batch.length;
      }
    }
    console.log(`  ✅ language_experts: ${expertsUpserted} rows`);
  } else {
    console.log('\n  ℹ️  No tc-experts.json found — skipping language_experts upload');
  }

  // ── 7. Summary ────────────────────────────────────────────────────
  console.log('\n── Upload Complete ──');
  if (doIndex) {
    console.log(`  ✅ trading_card_index: ${indexUpserted} rows`);
  }
  if (doDetail) {
    console.log(`  ✅ trading_card_detail: ${detailUpserted} rows${detailErrors > 0 ? ` (${detailErrors} failed)` : ''}`);
  }
  if (doVocab) {
    console.log(`  ✅ trading_card_vocabulary: ${vocabUpserted} rows${vocabErrors > 0 ? ` (${vocabErrors} failed)` : ''}`);
  }
  if (retireStale) {
    console.log(`  ✅ retired stale rows: ${retiredCount} index (+cascade), ${retiredVocabCount} vocab-only`);
  }
  if (licensesUpserted > 0) {
    console.log(`  ✅ source_licenses: ${licensesUpserted} rows`);
  }
  if (expertsUpserted > 0) {
    console.log(`  ✅ language_experts: ${expertsUpserted} rows`);
  }
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
