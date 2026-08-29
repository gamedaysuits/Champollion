#!/usr/bin/env node
/**
 * Live integration test for direct provider coaching.
 *
 * Tests each provider (OpenAI, Anthropic, Gemini) with real API calls,
 * both with and without coaching data, to verify:
 *   1. Basic translation works (no coaching)
 *   2. Coached translation works (grammar + dictionary augmentation)
 *   3. Content translation works (coaching block prepended)
 *   4. Coaching data actually influences the output
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   export GEMINI_API_KEY=AI...
 *   node test/live-provider-coaching.test.js
 *
 * Set only the keys for providers you want to test — others are skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { OpenAIMethod } from '../lib/methods/openai.js';
import { AnthropicMethod } from '../lib/methods/anthropic.js';
import { GeminiMethod } from '../lib/methods/gemini.js';

// -----------------------------------------------------------------
// Setup: create a temp project dir with coaching data
// -----------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-live-test-'));
const coachingDir = path.join(tmpDir, '.champollion', 'coaching');
fs.mkdirSync(coachingDir, { recursive: true });

// Coaching data: French with specific dictionary overrides
// The dictionary term "settings" → "réglages" is intentionally NON-standard.
// Standard French translation would be "paramètres". If coaching works,
// the output should use "réglages" instead.
const COACHING_DATA = {
  grammar_rules: [
    'Always use the formal "vous" form, never "tu".',
    'Avoid anglicisms — use native French equivalents.',
  ],
  dictionary: {
    'settings': 'réglages',
    'dashboard': 'tableau de bord',
    'log out': 'se déconnecter',
  },
  style_notes: 'Professional enterprise tone. No slang. No emojis.',
};

fs.writeFileSync(
  path.join(coachingDir, 'fr.json'),
  JSON.stringify(COACHING_DATA, null, 2),
);

// Test data: keys that will trigger dictionary matches
const TEST_KEYS = ['nav.dashboard', 'nav.settings', 'nav.logout', 'hero.title'];
const SOURCE_FLAT = {
  'nav.dashboard': 'Dashboard',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'hero.title': 'Welcome to your account',
};

const PAIR_CONFIG = {
  name: 'French',
  register: 'Standard formal register.',
  target: 'fr',
  source: 'en',
};

const CONTENT_PROMPT = `Translate the following UI text to French (formal register):
"Please review your account settings before proceeding to the dashboard."`;

// -----------------------------------------------------------------
// Provider definitions
// -----------------------------------------------------------------
const PROVIDERS = [
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    optionKey: 'openaiApiKey',
    MethodClass: OpenAIMethod,
  },
  {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    optionKey: 'anthropicApiKey',
    MethodClass: AnthropicMethod,
  },
  {
    name: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    optionKey: 'geminiApiKey',
    MethodClass: GeminiMethod,
  },
];

// -----------------------------------------------------------------
// Test runner
// -----------------------------------------------------------------
const PASS = '\x1b[32m✔\x1b[0m';
const FAIL = '\x1b[31m✘\x1b[0m';
const SKIP = '\x1b[33m⊘\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passCount = 0;
let failCount = 0;
let skipCount = 0;

function check(label, condition, detail = '') {
  totalTests++;
  if (condition) {
    passCount++;
    console.log(`  ${PASS} ${label}`);
  } else {
    failCount++;
    console.log(`  ${FAIL} ${label}`);
    if (detail) console.log(`      → ${detail}`);
  }
}

async function testProvider(provider) {
  const apiKey = process.env[provider.envKey];

  console.log(`\n${BOLD}▶ ${provider.name}${RESET}`);

  if (!apiKey) {
    skipCount += 3;
    totalTests += 3;
    console.log(`  ${SKIP} SKIPPED — ${provider.envKey} not set`);
    return;
  }

  const method = new provider.MethodClass();
  const options = {
    [provider.optionKey]: apiKey,
    cwd: tmpDir,  // Points to our temp dir with coaching files
    batchSize: 10,
  };

  // ── Test 1: Basic translation (without coaching) ──────────
  // Use a cwd that has NO coaching files so coaching won't activate
  const noCoachedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-no-coaching-'));
  try {
    console.log(`\n  ${BOLD}Key-value translation (no coaching):${RESET}`);
    const basicResult = await method.translate(
      ['hero.title'],
      SOURCE_FLAT,
      PAIR_CONFIG,
      { ...options, cwd: noCoachedDir },
    );

    check(
      'Returns a result object',
      basicResult !== null && typeof basicResult === 'object',
      `Got: ${JSON.stringify(basicResult)}`,
    );

    if (basicResult) {
      check(
        'hero.title is translated (not empty)',
        typeof basicResult['hero.title'] === 'string' && basicResult['hero.title'].length > 0,
        `Got: "${basicResult['hero.title']}"`,
      );
      console.log(`      Translation: "${basicResult['hero.title']}"`);
    }
  } finally {
    fs.rmSync(noCoachedDir, { recursive: true, force: true });
  }

  // ── Test 2: Coached translation (with dictionary overrides) ──────
  console.log(`\n  ${BOLD}Key-value translation (WITH coaching):${RESET}`);

  // Use a FRESH method instance so the coaching cache is clean
  const coachedMethod = new provider.MethodClass();
  const coachedResult = await coachedMethod.translate(
    TEST_KEYS,
    SOURCE_FLAT,
    PAIR_CONFIG,
    options,
  );

  check(
    'Returns a result object',
    coachedResult !== null && typeof coachedResult === 'object',
    `Got: ${JSON.stringify(coachedResult)}`,
  );

  if (coachedResult) {
    const settingsVal = coachedResult['nav.settings'] || '';
    const dashboardVal = coachedResult['nav.dashboard'] || '';

    // Check if the dictionary override was applied
    // "settings" should map to "réglages" (not the standard "paramètres")
    const settingsUsedDictionary = settingsVal.toLowerCase().includes('réglages');
    check(
      'Dictionary override: "settings" → "réglages" (not "paramètres")',
      settingsUsedDictionary,
      `Got: "${settingsVal}"`,
    );

    const dashboardUsedDictionary = dashboardVal.toLowerCase().includes('tableau de bord');
    check(
      'Dictionary override: "dashboard" → "tableau de bord"',
      dashboardUsedDictionary,
      `Got: "${dashboardVal}"`,
    );

    console.log('      Full coached output:');
    for (const [key, val] of Object.entries(coachedResult)) {
      console.log(`        ${key}: "${val}"`);
    }
  }

  // ── Test 3: Content translation (coaching block prepended) ──────
  console.log(`\n  ${BOLD}Content translation (coaching block prepended):${RESET}`);

  const contentMethod = new provider.MethodClass();
  const contentResult = await contentMethod.translateContent(
    CONTENT_PROMPT,
    PAIR_CONFIG,
    options,
  );

  check(
    'Returns a non-empty string',
    typeof contentResult === 'string' && contentResult.length > 0,
    `Got: ${JSON.stringify(contentResult)}`,
  );

  if (contentResult) {
    // Content coaching should influence the output — check for formal tone indicators
    const usesVous = contentResult.includes('vous') || contentResult.includes('votre') || contentResult.includes('vos');
    check(
      'Grammar coaching: uses formal "vous" form',
      usesVous,
      `Got: "${contentResult}"`,
    );

    // Check if "réglages" was used (from dictionary via coaching block style notes)
    const usesReglages = contentResult.toLowerCase().includes('réglages');
    const usesTableau = contentResult.toLowerCase().includes('tableau de bord');
    console.log(`      Translation: "${contentResult}"`);
    console.log(`      Used "réglages": ${usesReglages ? 'yes' : 'no'}`);
    console.log(`      Used "tableau de bord": ${usesTableau ? 'yes' : 'no'}`);
  }
}

// -----------------------------------------------------------------
// Run
// -----------------------------------------------------------------
console.log(`\n${'═'.repeat(60)}`);
console.log(`${BOLD}  Live Provider Coaching Integration Test${RESET}`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Temp project dir: ${tmpDir}`);
console.log(`  Coaching file: ${path.join(coachingDir, 'fr.json')}`);

const available = PROVIDERS.filter(p => process.env[p.envKey]);
const skipped = PROVIDERS.filter(p => !process.env[p.envKey]);

if (available.length === 0) {
  console.log(`\n  ${FAIL} No API keys set. Export at least one of:`);
  for (const p of PROVIDERS) {
    console.log(`     export ${p.envKey}=...`);
  }
  process.exit(1);
}

console.log(`\n  Providers to test: ${available.map(p => p.name).join(', ')}`);
if (skipped.length > 0) {
  console.log(`  Skipping: ${skipped.map(p => p.name).join(', ')} (no key)`);
}

for (const provider of PROVIDERS) {
  await testProvider(provider);
}

// Clean up
fs.rmSync(tmpDir, { recursive: true, force: true });

// Summary
console.log(`\n${'─'.repeat(60)}`);
console.log(`${BOLD}  Results: ${passCount}/${totalTests} pass, ${failCount} fail, ${skipCount} skip${RESET}`);
console.log(`${'─'.repeat(60)}\n`);

if (failCount > 0) process.exit(1);
