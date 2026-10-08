/**
 * Validates the metric-identity registry against its JSON Schema — BOTH the
 * root SSOT (shared/metric-registry.json) and the bundle copy the npm package
 * ships (cli/shared/metric-registry.json, synced by `npm run sync:shared`).
 *
 * Nothing checked this file against its schema before, so all four
 * _proposed_renames entries carried free-text decisions outside the enum.
 *
 * The repo's mini-schema validator does not support additionalProperties-as-
 * schema, propertyNames or minProperties, so the `entries` map is validated the
 * way shared-ssot-schemas.test.js does map-shaped SSOTs: the skeleton against
 * the schema root, then every key against propertyNames and every entry
 * against $defs.entry. A guard fails if the schema starts using a keyword this
 * test does not enforce.
 *
 * The root copy is skipped in a cli-only checkout; the bundle copy always runs.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/mini-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const MONO = path.resolve(CLI_ROOT, '..');

const SCHEMA_FILE = [
  path.join(MONO, 'shared', 'schemas', 'metric-registry.schema.json'),
  path.join(CLI_ROOT, 'shared', 'schemas', 'metric-registry.schema.json'),
].find((p) => fs.existsSync(p));

const COPIES = {
  shared: path.join(MONO, 'shared', 'metric-registry.json'),
  'cli-bundle': path.join(CLI_ROOT, 'shared', 'metric-registry.json'),
};

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// Keywords mini-schema enforces, plus the three this file enforces by hand.
const ENFORCED = new Set([
  'type', 'enum', 'pattern', 'minLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'oneOf',
  'required', 'properties', 'additionalProperties', 'items', '$ref',
  'minProperties', 'propertyNames',
]);
const ANNOTATIONS = new Set(['$schema', '$id', '$defs', '$comment', 'title', 'description']);

function unenforcedKeywords(node, found = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((n) => unenforcedKeywords(n, found));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (!ENFORCED.has(k) && !ANNOTATIONS.has(k)) found.add(k);
      if (k === 'properties' || k === '$defs') {
        Object.values(v).forEach((sub) => unenforcedKeywords(sub, found));
      } else if (k !== 'enum' && k !== 'required') {
        unenforcedKeywords(v, found);
      }
    }
  }
  return found;
}

function registryErrors(data, schema) {
  const errors = [...validate(data, schema).errors];
  const entriesSchema = schema.properties.entries;
  const entries = data.entries && typeof data.entries === 'object' ? data.entries : {};
  const ids = Object.keys(entries);
  if (ids.length < entriesSchema.minProperties) {
    errors.push(`$.entries: fewer than ${entriesSchema.minProperties} entries`);
  }
  const keySchema = { ...entriesSchema.propertyNames, type: 'string' };
  const entrySchema = { ...entriesSchema.additionalProperties, $defs: schema.$defs };
  for (const id of ids) {
    for (const e of validate(id, keySchema).errors) errors.push(`$.entries key '${id}': ${e}`);
    for (const e of validate(entries[id], entrySchema).errors) {
      errors.push(e.replace(/^\$/, `$.entries.${id}`));
    }
  }
  return errors;
}

test('metric-registry schema uses only keywords this test enforces', () => {
  const extra = [...unenforcedKeywords(readJSON(SCHEMA_FILE))];
  assert.deepStrictEqual(extra, [],
    `schema keyword(s) not enforced here: ${extra.join(', ')} — extend the test`);
});

for (const [name, file] of Object.entries(COPIES)) {
  test(`metric-registry (${name} copy) validates against its schema`, (t) => {
    if (!fs.existsSync(file)) return t.skip(`${file} not present (cli-only checkout)`);
    const errors = registryErrors(readJSON(file), readJSON(SCHEMA_FILE));
    assert.deepStrictEqual(errors, [], `${name} copy violations:\n${errors.join('\n')}`);
  });
}

test('a free-text decision in a pending rename proposal is rejected', () => {
  const data = structuredClone(readJSON(COPIES['cli-bundle']));
  data._proposed_renames = [{
    current: 'x', proposal: 'y', impact: 'z', decision: 'KEEP (2026-07-07) — no rename',
  }];
  const errors = registryErrors(data, readJSON(SCHEMA_FILE));
  assert.ok(errors.some((e) => e.includes('_proposed_renames[0].decision') && e.includes('not in enum')),
    errors.join('\n'));
});

test('every entry and every entry key is checked', () => {
  const data = structuredClone(readJSON(COPIES['cli-bundle']));
  const first = Object.keys(data.entries)[0];
  data.entries[first].direction = 'sideways';
  data.entries['Bad-Key'] = data.entries[first];
  const errors = registryErrors(data, readJSON(SCHEMA_FILE));
  assert.ok(errors.some((e) => e.startsWith(`$.entries.${first}.direction`)), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith("$.entries key 'Bad-Key'")), errors.join('\n'));
});
