#!/usr/bin/env node

/**
 * backfill-register-prompts.mjs
 *
 * Scans all language cards and backfills missing `prompt` fields
 * in register presets using a template-based approach.
 *
 * Template: "{label} register for {language_name}. {description}"
 *
 * Usage:
 *   node scripts/backfill-register-prompts.mjs --dry-run    # Preview changes
 *   node scripts/backfill-register-prompts.mjs              # Execute
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.resolve(__dirname, '../shared/language-cards');

const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(msg); }

function main() {
  log('═══════════════════════════════════════════════════════');
  log('  Register Prompt Backfill');
  log(DRY_RUN ? '  MODE: DRY RUN' : '  MODE: LIVE');
  log('═══════════════════════════════════════════════════════');

  const files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let totalCards = 0;
  let totalPresets = 0;
  let missingPrompts = 0;
  let backfilled = 0;

  for (const f of files) {
    const filePath = path.join(CARDS_DIR, f);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      continue;
    }

    totalCards++;
    const registers = card.registers;
    if (!registers || typeof registers !== 'object') continue;

    let cardModified = false;

    for (const [presetKey, preset] of Object.entries(registers)) {
      if (!preset || typeof preset !== 'object') continue;
      totalPresets++;

      if (preset.prompt) continue; // Already has a prompt

      missingPrompts++;

      // Build prompt from template
      const label = preset.label || presetKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const langName = card.name || card.code;
      const description = preset.description || '';

      let prompt;
      if (description) {
        prompt = `${label} register for ${langName}. ${description}`;
      } else {
        prompt = `${label} register for ${langName}. Use appropriate formality and conventions for this register.`;
      }

      preset.prompt = prompt;
      cardModified = true;
      backfilled++;
    }

    if (cardModified && !DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  log(`\n  Cards scanned: ${totalCards}`);
  log(`  Total presets: ${totalPresets}`);
  log(`  Missing prompts found: ${missingPrompts}`);
  log(`  Backfilled: ${backfilled}`);

  if (missingPrompts === 0) {
    log('\n✅ No missing prompts found!');
  } else if (DRY_RUN) {
    log(`\n📋 Would backfill ${backfilled} prompts. Run without --dry-run to apply.`);
  } else {
    log(`\n✅ Backfilled ${backfilled} prompts.`);
  }
}

main();
