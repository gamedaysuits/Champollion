/**
 * Card inheritance — hub-only fields must not leak into members.
 *
 * Genera hub cards (genera/macrolanguage-*.json etc.) double as `extends`
 * templates for their member cards. The taxonomy executor's finding
 * (derive-taxonomy-fields.mjs header note): members[] placed on hubs was
 * visible to member cards through the runtime extends/_deepMerge chain in
 * lib/registers.js. _NON_INHERITED_FIELDS (members, supportTier,
 * taxonomyNotes) closes that leak; these are the regression tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLanguageCard } from '../lib/registers.js';


// ── Corpus-aware verdict guard ───────────────────────────────────────────────
// These tests were written against the LIVE corpus, whose cards carry fields
// the founder has since ruled on: supportTier is DELETED ("get our judgement
// out of it", 2026-08-07), and the hub/inheritance machinery retires at
// cutover. During the migration window the suite runs against BOTH corpora,
// so each assertion holds EITHER the legacy behaviour (live corpus) OR the
// verdict (projected corpus: field absent everywhere AND the verdict on
// record) — and never a silent in-between where the field half-exists.
import fs from "node:fs";
import path from "node:path";
const __VERDICTS = JSON.parse(fs.readFileSync(
  path.join(import.meta.dirname, "..", "..", "shared", "cldf", "field-verdicts.json"),
  "utf-8",
)).verdicts;
const __projected = (getLanguageCard("crk") ?? {})._atlas !== undefined
  || (getLanguageCard("arz") ?? {}).supportTier === undefined;

describe('INVARIANT: hub-only fields do not leak into runtime-resolved member cards', () => {
  it("getLanguageCard('arz') must NOT have members[] (hub-only field of macrolanguage-ara)", () => {
    const arz = getLanguageCard('arz');
    assert.ok(arz, 'arz card must resolve');
    if (__projected) {
      // The atlas holds the same invariant BY CONSTRUCTION: membership lives
      // on the macrolanguage card (ara.macrolanguageMembers), the member
      // carries only its own link (arz.macrolanguage === 'ara'), and there is
      // no inheritance to leak through.
      assert.equal(arz.macrolanguage, 'ara', 'arz must know its macrolanguage');
      assert.ok(!('members' in arz) && !('macrolanguageMembers' in arz),
        'a member card must not carry the membership list');
      return;
    }
    assert.equal(arz.extends, 'macrolanguage-ara', 'precondition: arz extends the ara hub');
    assert.ok(!('members' in arz), `arz leaked members[] from its hub: ${JSON.stringify(arz.members)?.slice(0, 80)}`);
  });

  it('arz keeps its own supportTier instead of inheriting the hub\'s "cataloged"', () => {
    const arz = getLanguageCard('arz');
    if (__projected) {
      // The verdict, not the legacy: supportTier is deleted EVERYWHERE, and
      // the deletion is on record — a field gone with no verdict would be a
      // silent drop, which is the one thing neither corpus may do.
      assert.equal(arz.supportTier, undefined, 'supportTier was deleted by verdict');
      assert.ok(__VERDICTS.supportTier, 'the deletion must be recorded in field-verdicts');
      return;
    }
    assert.equal(arz.supportTier, 'supported');
  });

  it('arz still inherits regular template fields from the hub chain', () => {
    const arz = getLanguageCard('arz');
    // Non-hub-only inheritance must keep working (classification comes
    // through the merge chain).
    assert.ok(arz.classification?.family, 'classification.family should survive the merge');
  });

  it('the hub card itself keeps its members[]', () => {
    if (__projected) {
      // The hub prototype is gone; the macrolanguage's OWN card carries the
      // membership as a cited fact from the ISO registry. Same invariant,
      // real subject.
      const ara = getLanguageCard('ara');
      assert.ok(ara, 'the ara card must resolve');
      assert.ok(Array.isArray(ara.macrolanguageMembers) && ara.macrolanguageMembers.includes('arz'),
        'the macrolanguage card must carry its members, including arz');
      return;
    }
    const hub = getLanguageCard('macrolanguage-ara');
    assert.ok(hub, 'macrolanguage-ara hub must resolve');
    assert.ok(Array.isArray(hub.members) && hub.members.length > 0,
      'hub must keep its own members[] — only inheritance is blocked');
    assert.equal(hub.supportTier, 'cataloged', 'hub keeps its own supportTier');
  });

  it('no runtime-resolved member of any macrolanguage hub carries members[]', () => {
    // Spot-check one member per hand-written hub prototype.
    const samples = ['arz', 'cmn', 'zsm', 'nob', 'swh', 'als', 'pes'];
    for (const code of samples) {
      const card = getLanguageCard(code);
      if (!card || !card.extends || !card.extends.startsWith('macrolanguage-')) continue;
      assert.ok(!('members' in card), `${code} leaked members[] from ${card.extends}`);
      assert.notEqual(card.supportTier, 'cataloged',
        `${code} inherited the hub's supportTier 'cataloged' instead of its own`);
    }
  });
});
