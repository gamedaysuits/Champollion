/**
 * gate-vectors.test.js — the CLI output gates (lib/validate.js) still give
 * the verdicts captured in shared/test-fixtures/framework/gates/ before the
 * framework's gate chain existed. The chain and its Python engine port are
 * held to the same file, so a refactor cannot silently move what ships.
 * A deliberate gate change updates the vectors in the same commit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTranslations, GATE_VERSION } from '../lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = path.resolve(__dirname, '..', '..', 'shared', 'test-fixtures',
  'framework', 'gates', 'cli-gate-vectors.json');

describe('CLI gate characterization vectors', () => {
  it('every captured verdict still holds', (t) => {
    if (!fs.existsSync(VECTORS)) return t.skip('monorepo shared/ absent (standalone checkout)');
    const { gate_version: gateVersion, cases } = JSON.parse(fs.readFileSync(VECTORS, 'utf-8'));
    assert.equal(GATE_VERSION, gateVersion,
      'GATE_VERSION moved: re-check every vector by eye and record the new verdicts');
    assert.ok(cases.length >= 15, 'the vector set shrank');
    for (const c of cases) {
      const r = validateTranslations({ k: c.output }, { k: c.source }, c.pair, c.options || {});
      const f = r.failures[0];
      const got = f ? { verdict: 'refuse', reason: f.reason } : { verdict: 'accept' };
      assert.deepEqual(got, c.expect, c.name);
    }
  });
});
