#!/usr/bin/env node
/**
 * check-model-defaults.mjs — shared/model-defaults.json against the providers'
 * live lists (the pre-push gate, and the way to move a default).
 *
 *   node cli/scripts/check-model-defaults.mjs            # check (exit 1: a pinned id is gone)
 *   node cli/scripts/check-model-defaults.mjs --update   # write each role's rule candidate,
 *                                                         # then copy the file everywhere it is read
 *
 * Free: list endpoints are not billed. OpenRouter's list is public; the direct
 * providers' lists are read when their keys are set (OPENAI_API_KEY,
 * ANTHROPIC_API_KEY, GEMINI_API_KEY). A list that cannot be read is
 * "unchecked" — said, never a failure (a push must not need the network).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkModelDefaults } from '../lib/model-defaults.js';
import { fetchModelPricing } from '../lib/methods/openrouter-pricing.js';
import { fetchAvailableModels, resolveProviderApiKey } from '../lib/models.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(CLI, '..');
const SHARED = path.join(REPO, 'shared', 'model-defaults.json');
const COPIES = [
  path.join(CLI, 'shared', 'model-defaults.json'),
  path.join(REPO, 'arena', 'mt_eval_harness', 'data', 'model-defaults.json'),
  path.join(REPO, 'mt-eval-arena', 'supabase', 'functions', 'docent-chat', 'model-defaults.json'),
];

const lists = { openrouter: null, openai: null, gemini: null, anthropic: null };
try { const p = await fetchModelPricing(); if (p && p.size) lists.openrouter = [...p.keys()]; } catch { /* unchecked */ }
for (const provider of ['openai', 'gemini', 'anthropic']) {
  const key = resolveProviderApiKey(provider, REPO);
  if (key) lists[provider] = await fetchAvailableModels(provider, key);
}
const rows = checkModelDefaults(lists);
for (const r of rows) console.log(`  ${r.status.padEnd(9)} ${r.role.padEnd(10)} ${r.model.padEnd(34)} ${r.note}`);

if (process.argv.includes('--update')) {
  const data = JSON.parse(fs.readFileSync(SHARED, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let changed = 0;
  for (const r of rows) {
    if (r.status === 'unchecked') continue;
    const role = data.roles[r.role];
    if (r.candidate && r.candidate !== role.model) { role.model = r.candidate; changed++; }
    role.checked = today;
  }
  const text = `${JSON.stringify(data, null, 2)}\n`;
  for (const f of [SHARED, ...COPIES]) fs.writeFileSync(f, text);
  console.log(`\n${changed} default(s) moved; shared/model-defaults.json and its ${COPIES.length} copies written. Review the diff, run the suites, and release.`);
  process.exit(0);
}
const gone = rows.filter(r => r.status === 'gone');
if (gone.length > 0) {
  console.error(`\n✗ ${gone.length} default model(s) are no longer listed by their provider: ${gone.map(r => `${r.role} (${r.model})`).join(', ')}.`);
  console.error('  Move them: node cli/scripts/check-model-defaults.mjs --update — then review, test and release.');
  process.exit(1);
}
const newer = rows.filter(r => r.status === 'newer');
if (newer.length) console.log(`\n  ${newer.length} role(s) have a newer model matching their rule — informational; moving a default is a reviewed change (--update).`);
