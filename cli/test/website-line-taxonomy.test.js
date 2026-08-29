/**
 * Consistency tests for the map's line taxonomy
 * (cli/website/src/utils/lineTaxonomy.mjs) — the ONE registry every drawn
 * line type must live in, with styles derived from the existing SSOTs
 * (arcStrength, pairReachability), never invented literals.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {LINE_TYPES, swatchOf} from '../website/src/utils/lineTaxonomy.mjs';
import {arcStyle, BIN_COLORS} from '../website/src/utils/arcStrength.mjs';
import pairReachability from '../website/src/utils/pairReachability.js';

const {CATEGORIES, CATEGORY_STYLE} = pairReachability;

test('every line type carries the full template contract', () => {
  const ids = new Set();
  for (const type of LINE_TYPES) {
    assert.ok(type.id && !ids.has(type.id), `unique id: ${type.id}`);
    ids.add(type.id);
    assert.ok(type.label, `${type.id}: label`);
    assert.ok(type.meaning && type.meaning.length > 20, `${type.id}: meaning`);
    assert.ok(
      Array.isArray(type.dataRequirements) && type.dataRequirements.length,
      `${type.id}: dataRequirements`,
    );
    assert.ok(type.style, `${type.id}: style`);
    assert.ok(
      type.interactive && type.interactive.hover && type.interactive.click,
      `${type.id}: interactive stated honestly`,
    );
    assert.ok(type.cap, `${type.id}: cap (busy-map bound)`);
    assert.ok(type.layer, `${type.id}: layer`);
  }
});

test('measured styles are DERIVED through arcStyle, not duplicated', () => {
  const floors = {aaa: 20, bbb: 20};
  const corrected = LINE_TYPES.find((t) => t.id === 'measured-corrected');
  const expected = arcStyle(
    {status: 'measured', best_chrf: 75, size: 150, a: 'aaa', b: 'bbb'},
    floors,
  );
  assert.deepEqual(corrected.style, expected);
  assert.ok(BIN_COLORS.includes(corrected.style.color));

  const provisional = LINE_TYPES.find((t) => t.id === 'measured-provisional');
  assert.equal(provisional.style.provisional, true);
  assert.ok(provisional.style.dash, 'provisional draws dashed');

  const uncorrected = LINE_TYPES.find((t) => t.id === 'measured-uncorrected');
  assert.equal(uncorrected.style.corrected, false);
  assert.ok(!BIN_COLORS.includes(uncorrected.style.color),
    'floor-unknown never wears the ramp');
});

test('registered styles come from pairReachability CATEGORY_STYLE', () => {
  for (const cat of CATEGORIES) {
    const entry = LINE_TYPES.find((t) => t.id === `registered-${cat}`);
    assert.ok(entry, `registered-${cat} present`);
    assert.equal(entry.style.color, CATEGORY_STYLE[cat].color);
    assert.equal(entry.style.width, CATEGORY_STYLE[cat].width);
  }
});

test('swatchOf yields drawable swatches for hex styles, tokens otherwise', () => {
  for (const type of LINE_TYPES) {
    const sw = swatchOf(type);
    if (typeof type.style.color === 'string' && type.style.color.startsWith('#')) {
      assert.equal(sw.color, type.style.color);
      assert.ok(sw.alpha > 0 && sw.alpha <= 1);
    } else {
      assert.equal(sw.color, null, `${type.id}: token color renders as badge`);
    }
  }
});

test('the taxonomy covers the known engine layers', () => {
  const ids = LINE_TYPES.map((t) => t.id);
  for (const required of [
    'measured-corrected', 'measured-provisional', 'measured-uncorrected',
    'registered-commercial', 'registered-open', 'registered-frontier',
    'coverage-spoke', 'packet-trail', 'endpoint-glow',
  ]) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
});
