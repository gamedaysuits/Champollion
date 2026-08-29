#!/usr/bin/env node

/**
 * Smoke test for the Champollion facts database.
 *
 * Verifies:
 *   1. Database creates and schema applies
 *   2. Language insertion works with provenance
 *   3. Fact insertion requires mandatory fields
 *   4. Cross-source conflict detection and recording
 */

import { openDatabase } from './db.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { unlinkSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '..', 'data', 'test-champollion.db');

// Clean up any previous test database
if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

console.log('═══ Champollion Database Smoke Test ═══\n');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    console.log(`  ❌ ${label} (expected throw, got none)`);
    failed++;
  } catch (err) {
    console.log(`  ✅ ${label}`);
    passed++;
  }
}

// ---- Test 1: Database creation ----
console.log('1. Database creation');
const db = openDatabase(TEST_DB_PATH);
const stats = db.stats();
assert(stats.languages === 0, 'Empty database has 0 languages');
assert(stats.facts === 0, 'Empty database has 0 facts');
assert(stats.unresolvedConflicts === 0, 'Empty database has 0 conflicts');

// ---- Test 2: Language insertion ----
console.log('\n2. Language insertion');
db.insertLanguage({
  code: 'aqz',
  name: 'Akuntsu',
  iso639_3: 'aqz',
  glottocode: 'akun1241',
  bcp47: 'aqz',
  family: 'Tupian',
  familyGlottocode: 'tupi1275',
  genus: 'Corumbiara',
  genusGlottocode: 'akun1243',
  ancestry: ['Tupian', 'Arikem-Tupari', 'Tuparic', 'Nuclear Tuparic', 'Corumbiara'],
  macroarea: 'South America',
  lat: -12.8322,
  lng: -60.9716,
  countries: ['BR'],
  isIsolate: false,
});

const lang = db.getLanguage('aqz');
assert(lang !== undefined, 'Akuntsu language inserted');
assert(lang.name === 'Akuntsu', 'Name correct');
assert(lang.family === 'Tupian', 'Family correct');
assert(JSON.parse(lang.countries)[0] === 'BR', 'Country correct');

// ---- Test 3: Fact insertion with provenance ----
console.log('\n3. Fact insertion (mandatory provenance)');

// Good fact — full provenance
db.insertFact({
  languageCode: 'aqz',
  domain: 'phonology',
  property: 'isTonal',
  value: 'false',
  valueType: 'boolean',
  source: 'phoible-2.0',
  sourceUrl: 'https://phoible.org/inventories/view/2207',
  sourceRaw: 'tones=0',
  confidence: 'api-derived',
  retrievedAt: '2026-06-09T08:00:00Z',
  createdBy: 'test-db.mjs',
});

const fact = db.getFact('aqz', 'phonology', 'isTonal');
assert(fact !== undefined, 'Fact inserted and retrieved');
assert(fact.value === 'false', 'Value correct');
assert(fact.source === 'phoible-2.0', 'Source correct');
assert(fact.source_url === 'https://phoible.org/inventories/view/2207', 'Source URL present');

// Bad fact — missing source
assertThrows(() => {
  db.insertFact({
    languageCode: 'aqz',
    domain: 'phonology',
    property: 'consonants',
    value: '11',
    valueType: 'integer',
    // source MISSING — should throw
    confidence: 'api-derived',
    retrievedAt: '2026-06-09',
    createdBy: 'test',
  });
}, 'Rejects fact without source');

// Bad fact — missing confidence
assertThrows(() => {
  db.insertFact({
    languageCode: 'aqz',
    domain: 'phonology',
    property: 'vowels',
    value: '11',
    valueType: 'integer',
    source: 'phoible-2.0',
    // confidence MISSING
    retrievedAt: '2026-06-09',
    createdBy: 'test',
  });
}, 'Rejects fact without confidence');

// Bad fact — invalid confidence
assertThrows(() => {
  db.insertFact({
    languageCode: 'aqz',
    domain: 'phonology',
    property: 'vowels',
    value: '11',
    valueType: 'integer',
    source: 'phoible-2.0',
    confidence: 'probably-right', // not a valid level
    retrievedAt: '2026-06-09',
    createdBy: 'test',
  });
}, 'Rejects invalid confidence level');

// ---- Test 4: Conflict detection ----
console.log('\n4. Conflict detection');

// Insert a conflicting fact from a different source
db.insertFact({
  languageCode: 'aqz',
  domain: 'typology',
  property: 'isTonal',
  value: 'true',
  valueType: 'boolean',
  source: 'grambank-1.0.3',
  sourceRaw: 'GB079=1 (WRONG MAPPING)',
  confidence: 'api-derived',
  retrievedAt: '2026-06-09T08:00:00Z',
  createdBy: 'test-db.mjs',
  notes: 'This is a test conflict — Grambank maps the wrong feature',
});

db.insertFact({
  languageCode: 'aqz',
  domain: 'typology',
  property: 'isTonal',
  value: 'false',
  valueType: 'boolean',
  source: 'phoible-2.0',
  sourceRaw: 'tones=0',
  confidence: 'api-derived',
  retrievedAt: '2026-06-09T08:00:00Z',
  createdBy: 'test-db.mjs',
});

// Manually register the conflict (in practice, validate-facts.mjs does this)
const factA = db.getFactBySource('aqz', 'isTonal', 'grambank-1.0.3');
const factB = db.getFactBySource('aqz', 'isTonal', 'phoible-2.0');
db.insertConflict('aqz', 'isTonal', factA.id, factB.id,
  'Grambank GB079 reads wrong feature (verb prefixes, not tone)');

const conflicts = db.getUnresolvedConflicts();
assert(conflicts.length === 1, `Found ${conflicts.length} unresolved conflict(s)`);
assert(conflicts[0].value_a === 'true' && conflicts[0].value_b === 'false',
  'Conflict values correct (Grambank=true vs PHOIBLE=false)');

// ---- Summary ----
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);

// Clean up
db.close();
unlinkSync(TEST_DB_PATH);

process.exit(failed > 0 ? 1 : 0);
