/**
 * language-reference.test.js
 * ──────────────────────────────────────────────────────────────────
 * Tests for the unified card architecture (v6):
 *
 *   1. Runtime cards (language-cards/) SHOULD contain reference fields
 *      (linguisticChallenges, encyclopedic, resources) — they are now
 *      part of the unified card, not a separate tier.
 *   2. getLanguageReference() is a backward-compat alias for getLanguageCard()
 *   3. getLanguageCard() returns ALL fields including reference data
 *   4. Cards with reference data have well-formed structures
 *
 * HISTORY: This test file was rewritten when the project moved from
 * two-tier cards (v5: separate language-reference/ directory) to
 * unified cards (v6: everything in language-cards/). The old tests
 * enforced separation; these tests enforce unification.
 * ──────────────────────────────────────────────────────────────────
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getLanguageCard,
  getLanguageReference,
  CARDS_DIR,
} from '../lib/registers.js';

// Fields that were formerly reference-only, now part of unified cards
const ENRICHMENT_FIELDS = ['linguisticChallenges', 'encyclopedic', 'resources'];

// ─── Collect file lists ──────────────────────────────────────────

function collectJsonFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  function scan(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.name.endsWith('.json')) files.push(full);
    }
  }
  scan(dir);
  return files;
}

const cardFiles = collectJsonFiles(CARDS_DIR);

// ─── Test: Unified cards are well-formed ─────────────────────────

describe('Unified card architecture (v6)', () => {
  for (const filePath of cardFiles) {
    const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const label = card.code || path.basename(filePath);

    // Skip family/subfamily cards — they may not have enrichment data
    if (card.type === 'family' || card.type === 'subfamily') continue;

    it(`${label}: enrichment fields are well-formed if present`, () => {
      if (card.linguisticChallenges) {
        assert.equal(typeof card.linguisticChallenges, 'object',
          `'linguisticChallenges' should be an object`);
      }
      if (card.encyclopedic) {
        assert.equal(typeof card.encyclopedic, 'object',
          `'encyclopedic' should be an object`);
      }
      if (card.resources) {
        assert.equal(typeof card.resources, 'object',
          `'resources' should be an object`);
      }
    });
  }
});

// ─── Test: getLanguageReference() backward compat ────────────────

describe('getLanguageReference() — backward compatibility alias', () => {
  it('returns null for nonexistent language', () => {
    assert.equal(getLanguageReference('xx-nonexistent'), null);
  });

  it('returns same object as getLanguageCard() for enriched language (fr)', () => {
    const ref = getLanguageReference('fr');
    const card = getLanguageCard('fr');
    assert.ok(ref, 'getLanguageReference("fr") returned null');
    assert.ok(card, 'getLanguageCard("fr") returned null');

    // They should return the same data
    assert.equal(ref.code, card.code);
    assert.equal(ref.name, card.name);
  });

  it('returns merged data for enriched language (fr)', () => {
    const ref = getLanguageReference('fr');
    assert.ok(ref, 'getLanguageReference("fr") returned null');

    // Runtime fields present
    assert.ok(ref.code, 'Missing code');
    assert.ok(ref.registers, 'Missing registers');
    assert.ok(ref.formality, 'Missing formality');

    // Enrichment fields present (unified card)
    if (ref.linguisticChallenges === undefined) {
      // Verdict-or-legacy (see the crk guard below): the founder ruled these
      // uncited-prose fields out; on the projected corpus absence passes only
      // with the ruling on record.
      const verdicts = JSON.parse(fs.readFileSync(new URL(
        '../../shared/cldf/field-verdicts.json', import.meta.url,
      ), 'utf-8')).verdicts;
      assert.ok(verdicts.linguisticChallenges, 'dropped with no verdict recorded');
      return;
    }
    assert.ok(ref.linguisticChallenges, 'Missing linguisticChallenges');
    assert.ok(ref.encyclopedic, 'Missing encyclopedic');
  });

  it('returns runtime-only data for unenriched language', () => {
    // x-pirate has no enrichment data — should still return card
    const ref = getLanguageReference('x-pirate');
    assert.ok(ref, 'getLanguageReference("x-pirate") returned null');
    assert.ok(ref.code, 'Missing code');
    assert.ok(!ref.linguisticChallenges, 'Should not have linguisticChallenges (null or undefined)');
  });
});

// ─── Test: getLanguageCard() returns enrichment data ─────────────

describe('getLanguageCard() — unified data access', () => {
  it('fr card includes enrichment fields', () => {
    const card = getLanguageCard('fr');
    assert.ok(card, 'getLanguageCard("fr") returned null');
    if (card.linguisticChallenges === undefined) {
      const verdicts = JSON.parse(fs.readFileSync(new URL(
        '../../shared/cldf/field-verdicts.json', import.meta.url,
      ), 'utf-8')).verdicts;
      assert.ok(verdicts.linguisticChallenges, 'dropped with no verdict recorded');
      return;
    }
    assert.ok(card.linguisticChallenges, 'fr card missing linguisticChallenges');
    assert.ok(card.encyclopedic, 'fr card missing encyclopedic');
    assert.ok(card.resources, 'fr card missing resources');
  });

  it('crk card includes enrichment fields', () => {
    const card = getLanguageCard('crk');
    assert.ok(card, 'getLanguageCard("crk") returned null');
    // Verdict-or-legacy: linguisticChallenges was ruled out of scope by the
    // founder (uncited prose; returns later as a DERIVATION over typology) and
    // encyclopedic is the same uncited family. On the projected corpus the
    // fields are gone AND the ruling is on record; on the live corpus the
    // legacy behaviour holds. A field gone with no verdict is the one failure
    // both corpora share.
    if (card.linguisticChallenges === undefined) {
      const verdicts = JSON.parse(fs.readFileSync(new URL(
        '../../shared/cldf/field-verdicts.json', import.meta.url,
      ), 'utf-8')).verdicts;
      assert.ok(verdicts.linguisticChallenges, 'dropped with no verdict recorded');
      return;
    }
    assert.ok(card.linguisticChallenges, 'crk card missing linguisticChallenges');
    assert.ok(card.encyclopedic, 'crk card missing encyclopedic');
  });
});

// ─── Test: Old reference directory should not exist ──────────────

describe('Migration verification', () => {
  it('language-reference/ directory should be removed or empty', () => {
    const refDir = path.join(CARDS_DIR, '..', 'language-reference');
    if (fs.existsSync(refDir)) {
      const entries = fs.readdirSync(refDir).filter(e => e.endsWith('.json'));
      // If the directory still exists, it should have no JSON files
      // (the merge script should have been run and the dir cleaned up)
      assert.equal(entries.length, 0,
        `language-reference/ still contains ${entries.length} JSON files — run the merge script and delete them`);
    }
    // If directory doesn't exist, that's the ideal state
  });
});
