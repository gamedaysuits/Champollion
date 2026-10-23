/**
 * temperature-ssot.test.js — one default temperature (shared/model-defaults.json,
 * founder 2026-10-10: what is measured is what ships), and every place that
 * states a default says that value (docs review 2026-10-12, #13: the plugin
 * schema still documented 0.3).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf-8'));

describe('the default temperature', () => {
  it('the plugin schema documents the SSOT value', () => {
    const ssot = read('../../shared/model-defaults.json').temperature.value;
    const schema = read('../shared/schemas/champollion-plugin.schema.json');
    const found = JSON.stringify(schema).match(/"temperature":\{"type":"number","minimum":0,"maximum":2,"default":([0-9.]+)/);
    assert.ok(found, 'the schema states a temperature default');
    assert.equal(Number(found[1]), ssot);
  });
});
