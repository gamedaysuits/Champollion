/**
 * Guard: the seam's illustrative metric-value helpers behave (shared by the
 * tape run-card + the chain-panel bridge run-cards, so a measurement reads the
 * same everywhere).
 *
 * Run: node --test cli/website/src/utils/seamMetrics.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lensTarget, measureText} from './seamMetrics.mjs';

test('lensTarget: higher-is-better lenses rise with q; TER/MetricX invert', () => {
  assert.ok(lensTarget('chrF++', 0.8).v > lensTarget('chrF++', 0.3).v);
  assert.ok(lensTarget('spBLEU', 0.8).v > lensTarget('spBLEU', 0.3).v);
  assert.ok(lensTarget('COMET', 0.8).v > lensTarget('COMET', 0.3).v);
  assert.ok(lensTarget('TER', 0.8).v < lensTarget('TER', 0.3).v, 'TER falls as quality rises');
  assert.ok(lensTarget('MetricX-24', 0.8).v < lensTarget('MetricX-24', 0.3).v);
});

test('lensTarget: decimals — COMET 2dp, surface metrics 1dp', () => {
  assert.equal(lensTarget('COMET', 0.5).d, 2);
  assert.equal(lensTarget('AfriCOMET', 0.5).d, 2);
  assert.equal(lensTarget('chrF++', 0.5).d, 1);
  assert.equal(lensTarget('spBLEU', 0.5).d, 1);
  assert.equal(lensTarget('TER', 0.5).d, 1);
});

test('measureText: em-dash before arrival, locked value at/after lockAt', () => {
  assert.equal(measureText('chrF++', 0.7, {arrived: false, dwellT: 0, lockAt: 0.55}), '—');
  const locked = measureText('chrF++', 0.7, {arrived: true, dwellT: 1, lockAt: 0.55});
  assert.equal(locked, lensTarget('chrF++', 0.7).v.toFixed(1));
  // rolling (mid-dwell) is a number, and it is deterministic (scrubs the same).
  const a = measureText('chrF++', 0.7, {arrived: true, dwellT: 0.3, lockAt: 0.55, seed: 2});
  const b = measureText('chrF++', 0.7, {arrived: true, dwellT: 0.3, lockAt: 0.55, seed: 2});
  assert.equal(a, b, 'rolling wobble is deterministic');
  assert.ok(Number.isFinite(Number(a)));
});
