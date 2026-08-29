/**
 * card-adapter-parity.test.js — the JS half of the cross-runtime adapter gate.
 *
 * shared/test-fixtures/card-adapter/ holds golden atlas-shape fixture cards and
 * expected.json, the COMMITTED arbiter both runtimes must match. This test
 * proves normalizeCard still projects every fixture to the arbiter's contract
 * (the 11 bridged fields); arena/tests/test_card_adapter_parity.py proves the
 * Python twin projects the SAME fixtures to the SAME arbiter. A divergence in
 * either adapter fails exactly one side, which names the drifted runtime.
 * Wired into scripts/ssot_parity_gate.sh.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeCard } from '../lib/cards/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '../../shared/test-fixtures/card-adapter');

// The shared bridge vocabulary — the fields the two adapters promise to agree
// on. methodSupport/metricModelSupport flattening is deliberately NOT here:
// each runtime flattens in its own layer (JS in registers.js, Python in the
// adapter), a documented asymmetry.
const CONTRACT = [
  'name', 'nativeName', 'aliases', 'script', 'dir', 'isoType',
  'isoScopeInitial', 'speakerEstimates', 'vitality', 'dataSources', 'iso639_3',
];

function project(card) {
  const proj = {};
  for (const k of CONTRACT) if (card[k] !== undefined) proj[k] = card[k];
  return proj;
}

describe('card adapter parity (JS side of the arbiter)', () => {
  const expected = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, 'expected.json'), 'utf-8'),
  );
  const cardFiles = fs.readdirSync(path.join(FIXTURES, 'cards'))
    .filter((f) => f.endsWith('.json')).sort();

  it('covers every fixture with an arbiter entry, and vice versa', () => {
    const codes = cardFiles.map((f) => f.replace(/\.json$/, '')).sort();
    assert.deepEqual(Object.keys(expected).sort(), codes);
  });

  for (const file of cardFiles) {
    const code = file.replace(/\.json$/, '');
    it(`projects ${code} to the arbiter contract`, () => {
      const card = JSON.parse(
        fs.readFileSync(path.join(FIXTURES, 'cards', file), 'utf-8'),
      );
      assert.deepEqual(project(normalizeCard(card)), expected[code]);
    });
  }
});
