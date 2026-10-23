#!/usr/bin/env node
/**
 * mergeEnrichment() regression suite (2026-07-19 AES expansion).
 *
 * The CREATE branch used to assign a fresh vitality object whenever a
 * card had no unescoStatus/aesStatus — wholesale-replacing status-less
 * blocks and silently destroying fields owned by other generators. The
 * expansion dry run measured 136 such cards: speakerCount ×118 (e.g.
 * ace lost speakerCount 3,700,000) and ELCat fields ×54 (e.g. aan lost
 * ELCat's differing "dormant" assertion — discarding a cited source's
 * claim, exactly the index-not-arbiter violation the card boundary
 * invariant forbids). CREATE now merges INTO the existing block under
 * the same ownership rule as REPAIR: this script writes only the
 * fields it owns (aesStatus/aesLevel/aesLabel/egidsEstimate/source/
 * notes) and preserves everything else.
 *
 * Run: node --test test/enrich-cards-bulk.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeEnrichment } from '../scripts/enrich-cards-bulk.mjs';

const AES_SHIFTING = { aesCode: 'aes-shifting', aesValue: 3, comment: 'Glottolog comment.' };
const AES_EXTINCT = { aesCode: 'aes-extinct', aesValue: 6, comment: '' };

describe('mergeEnrichment CREATE branch (AES vitality)', () => {
  it('preserves sibling fields when creating a status onto a status-less block (ace shape)', () => {
    const card = {
      code: 'ace',
      glottocode: 'achi1257',
      vitality: { speakerCount: 3700000, speakerCountSource: 'linguameta' },
    };
    const { card: out, changes } = mergeEnrichment(card, AES_SHIFTING, null, null);

    // Fields owned by other generators survive
    assert.equal(out.vitality.speakerCount, 3700000);
    assert.equal(out.vitality.speakerCountSource, 'linguameta');
    // This script's own fields land
    assert.equal(out.vitality.aesStatus, 'shifting');
    assert.equal(out.vitality.aesLevel, 3);
    assert.equal(out.vitality.aesLabel, 'Shifting');
    assert.equal(out.vitality.egidsEstimate, '7');
    assert.equal(out.vitality.source, 'glottolog-cldf-5.3');
    assert.equal(out.vitality.notes, 'Glottolog comment.');
    assert.ok(changes.some(c => c.startsWith('vitality:')));
    // Input card is not mutated
    assert.equal(card.vitality.aesStatus, undefined);
  });

  it('keeps a differing ELCat assertion alongside the new AES status (aan shape)', () => {
    const card = {
      code: 'aan',
      glottocode: 'anam1249',
      vitality: {
        endangerment: 'dormant',
        elcatStatus: 'dormant',
        source: 'elcat',
        speakerCount: 6,
        speakerCountSource: 'linguameta',
      },
    };
    const { card: out } = mergeEnrichment(card, AES_EXTINCT, null, null);

    // ELCat's own claim survives next to Glottolog's — no winner picked
    assert.equal(out.vitality.elcatStatus, 'dormant');
    assert.equal(out.vitality.endangerment, 'dormant');
    assert.equal(out.vitality.speakerCount, 6);
    assert.equal(out.vitality.aesStatus, 'extinct');
    assert.equal(out.vitality.source, 'glottolog-cldf-5.3');
    // Empty AES comment adds no notes and clobbers nothing
    assert.equal(out.vitality.notes, undefined);
  });

  it('creates a clean block when the card has no vitality at all', () => {
    const { card: out } = mergeEnrichment({ code: 'xxx', glottocode: 'xxxx1234' }, AES_SHIFTING, null, null);
    assert.deepEqual(out.vitality, {
      aesStatus: 'shifting',
      aesLevel: 3,
      aesLabel: 'Shifting',
      egidsEstimate: '7',
      source: 'glottolog-cldf-5.3',
      notes: 'Glottolog comment.',
    });
  });

  it('recomputes its own fields even when stale copies exist on a status-less block', () => {
    const card = { code: 'qqq', vitality: { egidsEstimate: '9', speakerCount: 5 } };
    const { card: out } = mergeEnrichment(card, AES_SHIFTING, null, null);
    assert.equal(out.vitality.egidsEstimate, '7');
    assert.equal(out.vitality.speakerCount, 5);
  });

  it('does not touch a block that already carries a curated status', () => {
    const vit = { unescoStatus: 'vulnerable', source: 'linguameta-2024' };
    const { card: out, changes } = mergeEnrichment({ code: 'yyy', vitality: vit }, AES_SHIFTING, null, null);
    assert.deepEqual(out.vitality, vit);
    assert.ok(!changes.some(c => c.startsWith('vitality')));
  });
});

describe('mergeEnrichment REPAIR branch (unchanged behavior)', () => {
  it('recomputes owned fields on a glottolog-cldf-5.3 block and preserves the rest', () => {
    const card = {
      code: 'zzz',
      vitality: {
        aesStatus: 'threatened',
        aesLevel: 2,
        aesLabel: 'Threatened',
        egidsEstimate: '6b',
        source: 'glottolog-cldf-5.3',
        speakerCount: 42,
        speakerCountSource: 'wikidata',
      },
    };
    const { card: out, changes } = mergeEnrichment(card, AES_SHIFTING, null, null);
    assert.equal(out.vitality.aesStatus, 'shifting');
    assert.equal(out.vitality.aesLevel, 3);
    assert.equal(out.vitality.speakerCount, 42);
    assert.equal(out.vitality.speakerCountSource, 'wikidata');
    assert.ok(changes.some(c => c.startsWith('vitality repaired')));
  });
});
