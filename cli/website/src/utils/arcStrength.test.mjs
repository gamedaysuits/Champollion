/**
 * arcStrength unit tests — the pure edge→arc-style mapping the network graph
 * draws from. Run: node --test src/utils/arcStrength.test.mjs
 *
 * Two blocks, matching the module: the LIVE binary encoding, then the
 * RESEARCH-ONLY cchrF++ machinery that is retained, tested, and wired to
 * nothing (retired from every surface 2026-09-04).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arcStyle,
  MEASURED_COLOR,
  SIGNIFICANCE_N,
  MAX_ARCS,
  pairFloor,
  cchrf,
  strengthBin,
  BIN_COLORS,
  BIN_LABELS,
  BIN_EDGES,
} from './arcStrength.mjs';

/* ── live: binary encoding ───────────────────────────────────────────────── */

test('arcStyle: only measured edges with a numeric score style at all', () => {
  assert.equal(arcStyle(null), null);
  assert.equal(arcStyle({status: 'registered', best_chrf: null, a: 'eng', b: 'fra'}), null);
  assert.equal(arcStyle({status: 'measured', best_chrf: null, a: 'eng', b: 'fra'}), null);
});

test('arcStyle: a measured edge gets the ONE measured colour, no band', () => {
  const style = arcStyle({status: 'measured', best_chrf: 60, size: 500, a: 'eng', b: 'fra'});
  assert.equal(style.measured, true);
  assert.equal(style.color, MEASURED_COLOR);
  assert.equal(style.provisional, false);
  assert.equal(style.dash, null);
  // The retired strength vocabulary must not reappear on a style object.
  assert.equal(style.cchrf, undefined);
  assert.equal(style.bin, undefined);
  assert.equal(style.corrected, undefined);
});

test('arcStyle: score does NOT change the colour (no ramp)', () => {
  const weak = arcStyle({status: 'measured', best_chrf: 3, size: 500, a: 'eng', b: 'fra'});
  const strong = arcStyle({status: 'measured', best_chrf: 95, size: 500, a: 'eng', b: 'fra'});
  assert.equal(weak.color, strong.color);
  assert.equal(weak.width, strong.width);
  assert.ok(!BIN_COLORS.includes(weak.color));
});

test('arcStyle: the pair identity does NOT change the colour (no floor lookup)', () => {
  // crk has no chance floor; under the old encoding this went neutral slate.
  const withFloor = arcStyle({status: 'measured', best_chrf: 60, size: 500, a: 'eng', b: 'fra'});
  const withoutFloor = arcStyle({status: 'measured', best_chrf: 60, size: 500, a: 'eng', b: 'crk'});
  assert.equal(withFloor.color, withoutFloor.color);
  assert.deepEqual(withFloor, withoutFloor);
});

test('arcStyle: sub-significance pairs are provisional (dashed, dimmed)', () => {
  const small = arcStyle({status: 'measured', best_chrf: 60, size: SIGNIFICANCE_N - 1, a: 'eng', b: 'fra'});
  const big = arcStyle({status: 'measured', best_chrf: 60, size: SIGNIFICANCE_N, a: 'eng', b: 'fra'});
  assert.equal(small.provisional, true);
  assert.deepEqual(small.dash, [6, 5]);
  assert.ok(small.alpha < big.alpha);
  assert.equal(big.provisional, false);
  assert.equal(big.dash, null);
});

test('arcStyle: a missing size is provisional, never assumed significant', () => {
  const style = arcStyle({status: 'measured', best_chrf: 60, a: 'eng', b: 'fra'});
  assert.equal(style.provisional, true);
});

test('MAX_ARCS stays a hard frame-budget cap', () => {
  assert.equal(typeof MAX_ARCS, 'number');
  assert.ok(MAX_ARCS > 0);
});

/* ── research only: not wired to any surface ─────────────────────────────── */

const FLOORS = {eng: 11.964, fra: 12.587, fao: 11.384, zho: 1.648};

test('[research] pairFloor: max of the two sides, only when BOTH are known', () => {
  assert.equal(pairFloor(FLOORS, 'eng', 'fra'), 12.587);
  assert.equal(pairFloor(FLOORS, 'fra', 'eng'), 12.587); // symmetric
  assert.equal(pairFloor(FLOORS, 'eng', 'crk'), null); // one side unknown
  assert.equal(pairFloor(FLOORS, 'xxx', 'yyy'), null);
  assert.equal(pairFloor(null, 'eng', 'fra'), null);
});

test('[research] cchrf: (raw − floor)/(100 − floor), clamped to [0,1]', () => {
  assert.equal(cchrf(100, 20), 1);
  assert.equal(cchrf(20, 20), 0);
  assert.equal(cchrf(10, 20), 0); // below floor clamps to 0, never negative
  assert.ok(Math.abs(cchrf(60, 20) - 0.5) < 1e-12);
  assert.equal(cchrf(null, 20), null);
  assert.equal(cchrf(50, null), null);
  assert.equal(cchrf(50, 100), null); // degenerate floor
});

test('[research] strengthBin: edges are inclusive lower bounds', () => {
  assert.equal(strengthBin(0), 0);
  assert.equal(strengthBin(BIN_EDGES[0]), 1);
  assert.equal(strengthBin(0.5), 2);
  assert.equal(strengthBin(BIN_EDGES[3]), 4);
  assert.equal(strengthBin(1), 4);
  assert.equal(BIN_COLORS.length, 5);
  assert.equal(BIN_LABELS.length, 5);
});

test('[research] the conservative floor can only lower strength, never raise it', () => {
  // zho floor is tiny (1.648); pairing with eng must use eng's larger floor.
  const used = cchrf(50, pairFloor(FLOORS, 'zho', 'eng'));
  assert.ok(used < cchrf(50, FLOORS.zho));
  assert.equal(used, cchrf(50, FLOORS.eng));
});

test('[research] the retired machinery is NOT reachable from arcStyle', () => {
  // The guard that keeps this retirement real: if someone re-wires the ramp,
  // arcStyle starts emitting band fields again and this fails.
  const style = arcStyle({status: 'measured', best_chrf: 60, size: 500, a: 'eng', b: 'fra'});
  for (const k of ['cchrf', 'bin', 'corrected', 'band', 'band_label']) {
    assert.ok(!(k in style), `arcStyle must not emit "${k}"`);
  }
  assert.equal(arcStyle.length, 1); // takes the edge only — no floors argument
});
