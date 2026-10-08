/**
 * Guard: the quality SPECTRUM is anchored exactly on the tier SSOT.
 * qualitySpectrum(0/0.5/1) must reproduce the bad/ok/good hexes bit-for-bit —
 * if a tier colour changes, the spectrum follows automatically; if the
 * interpolation drifts off its anchors, this fails.
 *
 * Run: node --test cli/website/src/utils/qualityColors.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY, TIER_ORDER, qualitySpectrum, tierForScore, routeTier} from './qualityColors.mjs';

test('spectrum endpoints and midpoint are the tier SSOT colours', () => {
  assert.equal(qualitySpectrum(0).hex, QUALITY.bad.hex);
  assert.equal(qualitySpectrum(0.5).hex, QUALITY.ok.hex);
  assert.equal(qualitySpectrum(1).hex, QUALITY.good.hex);
});

test('spectrum rgb triples match their hex and stay in range', () => {
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const {hex, rgb} = qualitySpectrum(t);
    assert.equal(rgb.length, 3);
    for (const c of rgb) {
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `channel ${c} out of range at t=${t}`);
    }
    const fromHex = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => parseInt(h, 16));
    assert.deepEqual(fromHex, rgb, `hex/rgb disagree at t=${t}`);
  }
});

test('spectrum clamps out-of-range and non-finite input', () => {
  assert.equal(qualitySpectrum(-1).hex, QUALITY.bad.hex);
  assert.equal(qualitySpectrum(2).hex, QUALITY.good.hex);
  assert.equal(qualitySpectrum(NaN).hex, QUALITY.bad.hex);
  assert.equal(qualitySpectrum(undefined).hex, QUALITY.bad.hex);
});

test('spectrum is monotone in green-ness (red falls, green rises overall)', () => {
  // Coarse monotonicity: each step toward 1 should never make the colour
  // redder-and-less-green than the previous step.
  let prev = qualitySpectrum(0).rgb;
  for (let i = 1; i <= 10; i++) {
    const cur = qualitySpectrum(i / 10).rgb;
    assert.ok(cur[1] >= prev[1] - 1, `green channel regressed at t=${i / 10}`);
    prev = cur;
  }
});

test('tier machinery unchanged (spectrum is additive)', () => {
  assert.deepEqual(TIER_ORDER, ['bad', 'ok', 'good']);
  assert.equal(tierForScore(75), 'good');
  assert.equal(tierForScore(45), 'ok');
  assert.equal(tierForScore(10), 'bad');
  assert.equal(routeTier(['good', 'ok', 'good']), 'ok');
});
