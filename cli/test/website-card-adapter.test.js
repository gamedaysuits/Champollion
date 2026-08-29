/**
 * website-card-adapter.test.js — the parity test the website plugin promises.
 *
 * cli/website/plugins/shared-data/generateLanguagesJson.js cites this file by
 * name: its inline `displayValue` (CJS, because the Docusaurus plugin loader
 * cannot import the ESM reader synchronously) must keep the shared reader's
 * envelope semantics, and its `adaptCard` must never let an attribution
 * envelope reach a page as "[object Object]". This file makes both promises
 * enforceable — for weeks the citation pointed at a test that did not exist.
 * Wired into scripts/ssot_parity_gate.sh.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { display } from '../lib/cards/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { adaptCard, displayValue } = require(
  '../website/plugins/shared-data/generateLanguagesJson.js',
);

const FIXTURES = path.join(__dirname, '../../shared/test-fixtures/card-adapter');

const envelope = (agreement, values, consensus) => ({
  agreement,
  ...(consensus !== undefined ? { consensus } : {}),
  values,
});

describe('displayValue mirrors the shared reader display()', () => {
  const cases = [
    envelope('unanimous', [{ value: 'X', source: 's1' }], 'X'),
    envelope('single', [{ value: 'Y', source: 's1' }], 'Y'),
    envelope('conflicting', [
      { value: 'A', source: 's1' }, { value: 'B', source: 's2' },
    ]),
  ];
  it('agrees on consensus envelopes', () => {
    for (const v of cases.slice(0, 2)) {
      assert.equal(displayValue(v), display(v));
    }
  });
  it('agrees on disputed envelopes: undefined without opt-in, first with', () => {
    const disputed = cases[2];
    assert.equal(displayValue(disputed), display(disputed));
    assert.equal(displayValue(disputed), undefined);
    assert.equal(
      displayValue(disputed, { firstOnDispute: true }),
      display(disputed, { onDisagreement: 'first' }),
    );
    assert.equal(displayValue(disputed, { firstOnDispute: true }), 'A');
  });
  it('passes plain values through, as display() does', () => {
    for (const v of ['plain', 42, null]) {
      // display() maps null → undefined; the plugin's flatten loop never
      // reaches null values, so only the envelope behaviors must agree.
      if (v !== null) assert.equal(displayValue(v), display(v));
    }
  });
});

describe('adaptCard never lets an envelope reach a page', () => {
  const cardFiles = fs.readdirSync(path.join(FIXTURES, 'cards'))
    .filter((f) => f.endsWith('.json')).sort();

  for (const file of cardFiles) {
    it(`flattens every top-level envelope in ${file}`, async () => {
      const card = JSON.parse(
        fs.readFileSync(path.join(FIXTURES, 'cards', file), 'utf-8'),
      );
      const out = await adaptCard(card);
      for (const [k, v] of Object.entries(out)) {
        const isEnvelope = Boolean(v && typeof v === 'object'
          && typeof v.agreement === 'string' && Array.isArray(v.values));
        assert.equal(isEnvelope, false,
          `${file}: field '${k}' reached the display layer as an envelope`);
      }
      if (out.name !== undefined) assert.equal(typeof out.name, 'string');
      // The tc-index/website contract: isoScope at this layer is the LETTER.
      if (out.isoScope !== undefined) {
        assert.match(out.isoScope, /^[A-Z]$/,
          `${file}: isoScope '${out.isoScope}' is not the registry letter`);
      }
    });
  }

  it('carries provenance across the renames (endonym → nativeName)', async () => {
    const out = await adaptCard(JSON.parse(fs.readFileSync(
      path.join(FIXTURES, 'cards', 'bbb.json'), 'utf-8',
    )));
    assert.equal(out.nativeName, 'Bebite');
    assert.deepEqual(out._fieldSources.nativeName, out._fieldSources.endonym);
  });
});
