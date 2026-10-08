/**
 * field-verdicts.test.js — a deleted field stays deleted.
 *
 * The shadow diff found 54 live card fields the rebuilt pipeline does not
 * produce. Most are uncited prose, which is the thing the rebuild exists to
 * remove — but "the new build doesn't emit it" is a weak kind of deletion. It
 * lasts exactly until somebody notices the field missing, assumes an oversight,
 * and adds a parameter for it.
 *
 * So the decisions are written down in shared/cldf/field-verdicts.json and this
 * holds them: a field the founder deleted cannot come back as a parameter, and
 * a field awaiting a decision cannot quietly acquire one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseCSVObjects } from '../scripts/lib/csv.mjs';

const REPO = path.join(import.meta.dirname, '..', '..');
const { verdicts } = JSON.parse(
  fs.readFileSync(path.join(REPO, 'shared/cldf/field-verdicts.json'), 'utf-8'),
);
const { rows: parameters } = parseCSVObjects(
  fs.readFileSync(path.join(REPO, 'shared/cldf/parameters.csv'), 'utf-8'),
  { file: 'parameters.csv' },
);

const deleted = Object.entries(verdicts)
  .filter(([k, v]) => !k.startsWith('_') && /^DELETE|^OUT OF SCOPE/.test(v.verdict))
  .map(([k]) => k);

describe('fields the founder removed do not come back', () => {
  test('at least one field is actually recorded as removed', () => {
    // Guards the guard: if the verdict file is ever restructured, this test
    // must fail loudly rather than pass by iterating an empty list.
    assert.ok(deleted.length, 'no removed fields found — has the verdict file changed shape?');
  });

  test('no parameter declares a removed field, by ID or by card field', () => {
    for (const field of deleted) {
      for (const p of parameters) {
        assert.notEqual(
          p.ID, field,
          `parameter "${field}" exists, but it is recorded as removed: `
          + `${verdicts[field].verdict}`,
        );
        // Also the card field, because a parameter under any other name that
        // lands on `culturalAphorism` puts the same uncited claim on the card.
        assert.notEqual(
          p.Card_Field.split('.')[0], field,
          `parameter "${p.ID}" writes to "${field}", which is recorded as removed`,
        );
      }
    }
  });

  test('every verdict says who decided and on what evidence', () => {
    for (const [field, v] of Object.entries(verdicts)) {
      if (field.startsWith('_')) continue;
      assert.ok(v.verdict, `${field}: no verdict`);
      assert.ok(v.evidence, `${field}: a verdict with no evidence is an opinion`);
      assert.ok(v.decidedBy, `${field}: unattributed — these are founder calls about what the atlas stops claiming`);
    }
  });
});

describe('the source audit runs clean on the wiring it can enforce', () => {
  // The audit reports four kinds of gap. Three are enforceable now: an
  // unreachable fetcher, an untracked pin, a declared source with no pin. The
  // fourth (pinned but undeclared) is a backlog with 28 open items, so it is
  // reported rather than failed — but the other three must stay closed.
  test('every fetcher exports the interface the sweep discovers it by', async () => {
    const dir = path.join(REPO, 'cli', 'scripts', 'fetchers');
    const bad = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
      const mod = await import(path.join(dir, f));
      // `dir` declared as null is a real answer — cldf-zenodo pins per dataset.
      // Only an UNdeclared dir means nobody thought about it.
      if (!mod.source || !('dir' in mod) || typeof mod.fetchSource !== 'function') bad.push(f);
    }
    assert.deepEqual(
      bad, [],
      `these fetchers are skipped by \`fetch --all\` and \`--verify\`: ${bad.join(', ')}. `
      + 'The sweep discovers fetchers by looking for source/dir/fetchSource and skips a '
      + 'module without them WITHOUT warning, because a non-fetcher file in that '
      + 'directory is normal. Four sources sat out every sweep that way.',
    );
  });
});
