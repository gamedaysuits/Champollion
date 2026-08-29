#!/usr/bin/env node

/**
 * upload-human-services.mjs — Supabase Uploader for the human-services registry
 *
 * Reads the in-git SSOT (shared/human-services.json), validates it against
 * shared/schemas/human-services.schema.json, merges the out-of-band PII
 * (provider `contact`), and upserts to public.translation_services
 * (migration 034). Mirrors upload-trading-cards.mjs.
 *
 * Pipeline:
 *   shared/human-services.json (public SSOT — NO PII, schema-validated)
 *     + PII sidecar (gitignored, out-of-band: { service_id: { contact } })
 *       → upload-human-services.mjs (THIS SCRIPT — validate + merge + upsert)
 *         → public.translation_services
 *
 * GOVERNANCE: the SSOT carries only consent-to-publish fields. The provider
 * `contact` (PII) is NEVER tracked in git; it is supplied at upload time via a
 * gitignored sidecar pointed to by HUMAN_SERVICES_PII_PATH. `contact` is
 * NOT NULL in the table, so a row with no resolvable contact is SKIPPED (loud,
 * fail-honest) rather than silently inserted with a placeholder. v0 intake is
 * admin-approval out-of-band; rows publish only once an admin sets
 * status='approved' AND consent_attested=true (enforced by RLS + the RPC).
 *
 * Environment:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_KEY      — Service role key (NOT the anon key)
 *   HUMAN_SERVICES_PII_PATH   — (optional) path to the gitignored PII sidecar
 *                               JSON: { "<service_id>": { "contact": "..." } }
 *
 * Usage:
 *   node scripts/upload-human-services.mjs --dry-run    # validate + report, no write
 *   node scripts/upload-human-services.mjs              # validate, merge PII, upsert
 *
 * Per CLAUDE.md: Supabase writes go to the dev/staging branch unless the
 * founder has explicitly approved a prod write.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validate } from './lib/mini-schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SSOT_PATH = join(REPO_ROOT, 'shared', 'human-services.json');
const SCHEMA_PATH = join(REPO_ROOT, 'shared', 'schemas', 'human-services.schema.json');

const BATCH_SIZE = 500; // compact rows, like the experts/index uploads

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// ---------------------------------------------------------------------------
// Load + validate the SSOT (always — even in --dry-run, validation is the point)
// ---------------------------------------------------------------------------

function loadAndValidate() {
  if (!existsSync(SSOT_PATH)) {
    console.error(`ERROR: SSOT not found: ${SSOT_PATH}`);
    process.exit(1);
  }
  if (!existsSync(SCHEMA_PATH)) {
    console.error(`ERROR: Schema not found: ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const services = JSON.parse(readFileSync(SSOT_PATH, 'utf-8'));
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

  const { valid, errors } = validate(services, schema);
  if (!valid) {
    console.error(`ERROR: ${SSOT_PATH} fails schema validation:`);
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }
  console.log(`✅ ${services.length} service(s) valid against human-services.schema.json`);
  return services;
}

// ---------------------------------------------------------------------------
// Merge the out-of-band PII (contact). Returns { rows, skipped }.
// ---------------------------------------------------------------------------

function mergePii(services) {
  let piiMap = {};
  const piiPath = process.env.HUMAN_SERVICES_PII_PATH;
  if (piiPath && existsSync(piiPath)) {
    piiMap = JSON.parse(readFileSync(piiPath, 'utf-8'));
    console.log(`Loaded PII sidecar for ${Object.keys(piiMap).length} service(s) from ${piiPath}`);
  } else if (piiPath) {
    console.warn(`  WARN: HUMAN_SERVICES_PII_PATH set but not found: ${piiPath}`);
  } else {
    console.log('  ℹ️  No HUMAN_SERVICES_PII_PATH set — rows without a contact will be skipped.');
  }

  const rows = [];
  const skipped = [];
  for (const s of services) {
    const contact = piiMap[s.service_id]?.contact;
    if (!contact) {
      // contact is NOT NULL in the table — cannot insert. Fail honest.
      skipped.push(s.service_id);
      continue;
    }
    rows.push({
      service_id: s.service_id,
      display_name: s.display_name,
      provider_type: s.provider_type ?? null,
      source_lang: s.source_lang,
      target_lang: s.target_lang,
      variety: s.variety ?? null,
      dispatch_channel: s.dispatch_channel ?? null,
      contact,
      turnaround_days: s.turnaround_days ?? null,
      rate_per_word: s.rate_per_word ?? null,
      domains: s.domains ?? null,
      sovereignty_flags: s.sovereignty_flags ?? null,
      nc_terms: s.nc_terms ?? null,
      consent_attested: s.consent_attested ?? false,
      status: s.status ?? 'pending',
    });
  }
  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  upload-human-services.mjs — SSOT → Supabase        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();

  const services = loadAndValidate();
  const { rows, skipped } = mergePii(services);

  if (skipped.length > 0) {
    console.warn(`\n  ⚠️  ${skipped.length} service(s) skipped — no contact resolved (NOT NULL): ${skipped.join(', ')}`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would upsert to public.translation_services:');
    console.log(`  rows with contact:  ${rows.length}`);
    console.log(`  skipped (no PII):   ${skipped.length}`);
    const approved = rows.filter((r) => r.status === 'approved' && r.consent_attested === true).length;
    console.log(`  publishable now (status=approved AND consent_attested): ${approved}`);
    console.log('  (no rows written)');
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
    console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
    console.error('  export SUPABASE_SERVICE_KEY="eyJ..."   # service role key, NOT anon');
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('\nNothing to upsert (0 rows with a resolved contact). Done.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('\nUpserting translation_services...');
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('translation_services')
      .upsert(batch, { onConflict: 'service_id' });

    if (error) {
      console.error(`ERROR upserting batch ${i}–${i + batch.length}: ${error.message}`);
      console.error('  Details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    upserted += batch.length;
  }

  console.log('\n── Upload Complete ──');
  console.log(`  ✅ translation_services: ${upserted} rows`);
  if (skipped.length > 0) console.log(`  ⚠️  skipped (no contact): ${skipped.length}`);
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
