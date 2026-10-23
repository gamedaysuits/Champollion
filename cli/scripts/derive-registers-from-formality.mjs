#!/usr/bin/env node

/**
 * derive-registers-from-formality.mjs
 * ────────────────────────────────────────────────────────────────
 * Derives minimal `registers` entries from the `formality` field.
 *
 * When a language's formality system is known (from WALS 45A or
 * Grambank GB415), we can derive the register structure:
 *
 *   T-V system       → "formal" + "informal" registers
 *   speech-levels    → "formal" + "polite" + "informal" registers
 *   avoidance        → "respectful" + "neutral" registers
 *   none             → "standard" register (single)
 *   politeness-pres. → "formal" + "informal" registers (binary)
 *
 * Merge-only: never overwrites existing registers.
 *
 * Usage:
 *   node scripts/derive-registers-from-formality.mjs
 *   node scripts/derive-registers-from-formality.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// Map formality system types to register structures
const REGISTER_TEMPLATES = {
  'T-V': {
    formal: {
      label: 'Formal (V-form)',
      description: 'Polite/formal address using V-form pronouns (e.g., vous, Sie, usted, вы). Default for software UI, official communication, and addressing strangers.',
      prompt: 'Use formal/polite address forms (V-form pronouns). Write in a professional, respectful tone appropriate for software UI and official communication.',
      isDefault: true,
    },
    informal: {
      label: 'Informal (T-form)',
      description: 'Familiar/informal address using T-form pronouns (e.g., tu, du, tú, ты). Used with close friends, family, children, and peers of similar age.',
      prompt: 'Use informal/familiar address forms (T-form pronouns). Write in a casual, friendly tone appropriate for peer-to-peer communication.',
      isDefault: false,
    },
  },
  'speech-levels': {
    formal: {
      label: 'Formal/Honorific',
      description: 'Highest politeness level with dedicated verb morphology and honorific vocabulary. Used in formal contexts, with elders, officials, and strangers.',
      prompt: 'Use the highest politeness level with honorific verb forms and respectful vocabulary. Address the reader with maximum deference.',
      isDefault: false,
    },
    polite: {
      label: 'Polite/Standard',
      description: 'Standard polite register. Appropriate for most software UI, everyday formal interactions, and default translation output.',
      prompt: 'Use standard polite register. Professional and respectful without excessive formality. Appropriate for software UI and general communication.',
      isDefault: true,
    },
    informal: {
      label: 'Informal/Casual',
      description: 'Casual register used among close friends, peers, and in informal settings. Not appropriate for software UI or official content.',
      prompt: 'Use casual/informal register. Relaxed tone appropriate for friends and peers. Avoid honorifics and formal verb endings.',
      isDefault: false,
    },
  },
  'avoidance': {
    respectful: {
      label: 'Respectful/Indirect',
      description: 'Address through indirect reference, titles, kinship terms, or circumlocution. Primary mode for respectful communication.',
      prompt: 'Use indirect address strategies: titles, kinship terms, or circumlocution rather than direct pronouns. Maintain respectful distance.',
      isDefault: true,
    },
    neutral: {
      label: 'Neutral/Direct',
      description: 'Direct address without avoidance strategies. Used in informal or intimate contexts where indirectness is unnecessary.',
      prompt: 'Use direct address without avoidance strategies. Straightforward and clear communication.',
      isDefault: false,
    },
  },
  'none': {
    standard: {
      label: 'Standard',
      description: 'No grammaticalized politeness distinctions. A single register serves all social contexts, though lexical choices may vary by formality.',
      prompt: 'Use standard register. This language does not grammaticalize politeness distinctions. Write clearly and naturally.',
      isDefault: true,
    },
  },
  'politeness-present': {
    formal: {
      label: 'Formal/Polite',
      description: 'Polite register using politeness-marked pronoun forms. Default for software UI and formal contexts.',
      prompt: 'Use polite/formal pronoun forms and politeness markers. Professional tone appropriate for software UI and formal contexts.',
      isDefault: true,
    },
    informal: {
      label: 'Informal/Familiar',
      description: 'Informal register using unmarked/familiar pronoun forms. Used with close relations.',
      prompt: 'Use unmarked/familiar pronoun forms. Casual tone appropriate for friends and family.',
      isDefault: false,
    },
  },
};

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Register Derivation from Formality Data');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let enriched = 0;
  const bySystem = {};

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Only derive if registers is null and formality is populated
    if (card.registers !== null) continue;
    if (!card.formality || !card.formality.system) continue;

    const system = card.formality.system;
    const template = REGISTER_TEMPLATES[system];
    if (!template) continue;

    // Build registers with source attribution
    const registers = {};
    let defaultKey = null;
    for (const [key, val] of Object.entries(template)) {
      registers[key] = {
        ...val,
        source: `derived-from-formality (${card.formality.source || 'unknown'})`,
      };
      if (val.isDefault) defaultKey = key;
    }

    card.registers = registers;

    // Set formality.default to the default register key
    // Tests require formality.default to point to a valid register key
    if (defaultKey && !card.formality.default) {
      card.formality.default = defaultKey;
    }

    // Source attribution
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.registers = `derived-from-formality (${card.formality.source || 'unknown'})`;

    bySystem[system] = (bySystem[system] || 0) + 1;
    enriched++;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards enriched:  ${enriched.toLocaleString()}`);
  for (const [sys, count] of Object.entries(bySystem).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${sys}: ${count}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
