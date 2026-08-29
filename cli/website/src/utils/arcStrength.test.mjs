/**
 * arcStrength unit tests — the pure strength-mapping the homepage arc
 * layer draws from. Run: node --test src/utils/arcStrength.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pairFloor,
  cchrf,
  strengthBin,
  arcStyle,
  BIN_COLORS,
  BIN_LABELS,
  BIN_EDGES,
  UNCORRECTED_COLOR,
  SIGNIFICANCE_N,
} from './arcStrength.mjs';

const FLOORS = {eng: 11.964, fra: 12.587, fao: 11.384, zho: 1.648};

test('pairFloor: max of the two sides, only when BOTH are known', () => {
  assert.equal(pairFloor(FLOORS, 'eng', 'fra'), 12.587);
  assert.equal(pairFloor(FLOORS, 'fra', 'eng'), 12.587); // symmetric
  assert.equal(pairFloor(FLOORS, 'eng', 'crk'), null); // one side unknown
  assert.equal(pairFloor(FLOORS, 'xxx', 'yyy'), null);
  assert.equal(pairFloor(null, 'eng', 'fra'), null);
});

test('cchrf: (raw − floor)/(100 − floor), clamped to [0,1]', () => {
  assert.equal(cchrf(100, 20), 1);
  assert.equal(cchrf(20, 20), 0);
  assert.equal(cchrf(10, 20), 0); // below floor clamps to 0, never negative
  assert.ok(Math.abs(cchrf(60, 20) - 0.5) < 1e-12);
  assert.equal(cchrf(null, 20), null);
  assert.equal(cchrf(50, null), null);
  assert.equal(cchrf(50, 100), null); // degenerate floor
});

test('strengthBin: edges are inclusive lower bounds', () => {
  assert.equal(strengthBin(0), 0);
  assert.equal(strengthBin(BIN_EDGES[0]), 1);
  assert.equal(strengthBin(0.5), 2);
  assert.equal(strengthBin(BIN_EDGES[3]), 4);
  assert.equal(strengthBin(1), 4);
  assert.equal(BIN_COLORS.length, 5);
  assert.equal(BIN_LABELS.length, 5);
});

test('arcStyle: only measured edges with a numeric score style at all', () => {
  assert.equal(arcStyle(null, FLOORS), null);
  assert.equal(
    arcStyle({status: 'registered', best_chrf: null, a: 'eng', b: 'fra'}, FLOORS),
    null,
  );
  assert.equal(
    arcStyle({status: 'measured', best_chrf: null, a: 'eng', b: 'fra'}, FLOORS),
    null,
  );
});

test('arcStyle: corrected edge rides the strength ramp', () => {
  const style = arcStyle(
    {status: 'measured', best_chrf: 60, size: 500, a: 'eng', b: 'fra'},
    FLOORS,
  );
  assert.equal(style.corrected, true);
  assert.equal(style.provisional, false);
  assert.equal(style.color, BIN_COLORS[style.bin]);
  assert.equal(style.dash, null);
  // 60 raw over floor 12.587 → cchrf ≈ 0.542 → bin 2 ("developing")
  assert.equal(style.bin, 2);
});

test('arcStyle: unknown floor NEVER rides the ramp', () => {
  const style = arcStyle(
    {status: 'measured', best_chrf: 90, size: 500, a: 'eng', b: 'crk'},
    FLOORS,
  );
  assert.equal(style.corrected, false);
  assert.equal(style.bin, null);
  assert.equal(style.color, UNCORRECTED_COLOR);
  assert.ok(!BIN_COLORS.includes(style.color));
});

test('arcStyle: sub-significance pairs are provisional (dashed, dimmed)', () => {
  const small = arcStyle(
    {status: 'measured', best_chrf: 60, size: SIGNIFICANCE_N - 1, a: 'eng', b: 'fra'},
    FLOORS,
  );
  const big = arcStyle(
    {status: 'measured', best_chrf: 60, size: SIGNIFICANCE_N, a: 'eng', b: 'fra'},
    FLOORS,
  );
  assert.equal(small.provisional, true);
  assert.deepEqual(small.dash, [6, 5]);
  assert.ok(small.alpha < big.alpha);
  assert.equal(big.provisional, false);
});

test('arcStyle: the conservative floor can only lower strength, never raise it', () => {
  // zho floor is tiny (1.648); pairing with eng must use eng's larger floor.
  const style = arcStyle(
    {status: 'measured', best_chrf: 50, size: 500, a: 'zho', b: 'eng'},
    FLOORS,
  );
  const withSmallFloor = cchrf(50, FLOORS.zho);
  const used = cchrf(50, FLOORS.eng);
  assert.ok(used < withSmallFloor);
  assert.equal(style.cchrf, used);
});
