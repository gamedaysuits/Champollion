/**
 * Validates the two previously-unschema'd cross-runtime SSOTs against their
 * JSON Schemas (shared/schemas/model-aliases.schema.json + licenses.schema.json)
 * using the repo's dependency-free mini-schema validator.
 *
 * The mini validator does not support additionalProperties-as-schema or
 * patternProperties, so map-shaped SSOTs (alias -> model id, source id ->
 * license entry) are validated in two passes: the document skeleton against
 * the schema root, then every entry against the $defs entry schema — exactly
 * the split the schemas document in their descriptions.
 *
 * Reads the bundled copy (cli/shared/, synced by `npm run sync:shared`) and
 * prefers the root SSOT when present, so it passes in both the monorepo and
 * a cli-only checkout — same pattern as external-results-schema.test.js.
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

function firstExisting(...cands) {
  return cands.find((p) => fs.existsSync(p)) || null;
}

function loadPair(name) {
  const dataFile = firstExisting(
    path.join(MONO, 'shared', `${name}.json`),
    path.join(CLI_ROOT, 'shared', `${name}.json`),
  );
  const schemaFile = firstExisting(
    path.join(MONO, 'shared', 'schemas', `${name}.schema.json`),
    path.join(CLI_ROOT, 'shared', 'schemas', `${name}.schema.json`),
  );
  assert.ok(dataFile, `${name}.json not found`);
  assert.ok(schemaFile, `${name}.schema.json not found`);
  return {
    data: JSON.parse(fs.readFileSync(dataFile, 'utf8')),
    schema: JSON.parse(fs.readFileSync(schemaFile, 'utf8')),
  };
}

// Build a standalone validator input for a $defs entry schema — the mini
// validator resolves $refs against the schema object it is handed, so the
// $defs block must ride along.
function defSchema(schema, defName) {
  return { ...schema.$defs[defName], $defs: schema.$defs };
}

// ── model-aliases ────────────────────────────────────────────────────────────

test('model-aliases SSOT validates against its schema (skeleton + every entry)', () => {
  const { data, schema } = loadPair('model-aliases');

  const rootResult = validate(data, schema);
  assert.deepStrictEqual(rootResult.errors, [], `skeleton violations:\n${rootResult.errors.join('\n')}`);

  const aliasSchema = defSchema(schema, 'aliasName');
  const modelSchema = defSchema(schema, 'modelId');

  const entries = Object.entries(data).filter(([k]) => !k.startsWith('_'));
  assert.ok(entries.length > 0, 'expected at least one alias entry');

  for (const [alias, modelId] of entries) {
    const keyResult = validate(alias, aliasSchema);
    assert.deepStrictEqual(keyResult.errors, [],
      `alias key "${alias}" violations:\n${keyResult.errors.join('\n')}`);
    const valResult = validate(modelId, modelSchema);
    assert.deepStrictEqual(valResult.errors, [],
      `alias "${alias}" model id ${JSON.stringify(modelId)} violations:\n${valResult.errors.join('\n')}`);
  }
});

// ── licenses ─────────────────────────────────────────────────────────────────

test('licenses SSOT validates against its schema (skeleton + every source entry)', () => {
  const { data, schema } = loadPair('licenses');

  const rootResult = validate(data, schema);
  assert.deepStrictEqual(rootResult.errors, [], `skeleton violations:\n${rootResult.errors.join('\n')}`);

  const entrySchema = defSchema(schema, 'licenseEntry');
  const entries = Object.entries(data.sources);
  assert.ok(entries.length > 0, 'expected at least one license source');

  for (const [sourceId, entry] of entries) {
    const result = validate(entry, entrySchema);
    assert.deepStrictEqual(result.errors, [],
      `sources["${sourceId}"] violations:\n${result.errors.join('\n')}`);
    // Map-key integrity the schema itself cannot express: every entry's
    // `source` field must equal its key in the map.
    assert.strictEqual(entry.source, sourceId,
      `sources["${sourceId}"].source is "${entry.source}" — must equal its map key`);
  }

  // The generator's own count stamp must agree with the map it wrote.
  assert.strictEqual(entries.length, data._generated.counts.total,
    `_generated.counts.total (${data._generated.counts.total}) != actual source count (${entries.length})`);
});
