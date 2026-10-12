/**
 * Validates the cite-only external-results SSOT against its JSON Schema, with a
 * dependency-free mini-validator (no AJV in this package). Covers the schema
 * subset the SSOT actually uses: type (incl. nullable + type-arrays), const,
 * enum, required, properties, additionalProperties:false, items, $ref to $defs,
 * pattern, minLength, minimum, minItems, format:uri. Plus integrity cross-checks
 * the schema can't express (id uniqueness, method_ref resolution, and the
 * "no corpus content" guard — additionalProperties:false forbids any stray
 * parallel-text/gold field on a record).
 *
 * Reads the bundled copy (cli/shared/, always synced) and prefers the root SSOT
 * schema when present, so it passes in both the monorepo and a cli-only checkout.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const MONO = path.resolve(CLI_ROOT, '..');

function firstExisting(...cands) {
  return cands.find((p) => fs.existsSync(p)) || null;
}

const DATA_FILE = firstExisting(
  path.join(MONO, 'shared', 'catalogue', 'external-results.json'),
  path.join(CLI_ROOT, 'shared', 'catalogue', 'external-results.json'),
);
const SCHEMA_FILE = firstExisting(
  path.join(MONO, 'shared', 'schemas', 'external-results.schema.json'),
  path.join(CLI_ROOT, 'shared', 'schemas', 'external-results.schema.json'),
);

// ── mini JSON-schema validator (draft-07 subset) ────────────────────────────
function resolveRef(ref, root) {
  // only local "#/$defs/Name" refs are used
  const parts = ref.replace(/^#\//, '').split('/');
  let node = root;
  for (const p of parts) node = node && node[p];
  if (!node) throw new Error(`unresolved $ref ${ref}`);
  return node;
}

function typeMatches(type, value) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'null': return value === null;
      case 'array': return Array.isArray(value);
      case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
      case 'integer': return typeof value === 'number' && Number.isInteger(value);
      case 'number': return typeof value === 'number';
      case 'string': return typeof value === 'string';
      case 'boolean': return typeof value === 'boolean';
      default: return false;
    }
  });
}

function validate(schema, value, root, p, errors) {
  if (schema.$ref) return validate(resolveRef(schema.$ref, root), value, root, p, errors);

  if (schema.type && !typeMatches(schema.type, value)) {
    errors.push(`${p}: expected type ${JSON.stringify(schema.type)}, got ${value === null ? 'null' : typeof value}`);
    return; // further checks meaningless on a type mismatch
  }
  if ('const' in schema && value !== schema.const) {
    errors.push(`${p}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    errors.push(`${p}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${p}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${p}: "${value}" fails pattern ${schema.pattern}`);
    if (schema.format === 'uri' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) errors.push(`${p}: "${value}" is not a uri`);
  }
  if (typeof value === 'number' && schema.minimum != null && value < schema.minimum) {
    errors.push(`${p}: ${value} < minimum ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${p}: fewer than minItems ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, root, `${p}[${i}]`, errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${p}: missing required "${req}"`);
    }
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(props[k], v, root, `${p}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${p}: unexpected property "${k}" (additionalProperties:false)`);
    }
  }
}

test('external-results SSOT validates against its JSON schema', () => {
  assert.ok(DATA_FILE, 'external-results.json not found');
  assert.ok(SCHEMA_FILE, 'external-results.schema.json not found');
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const errors = [];
  validate(schema, data, schema, '$', errors);
  assert.deepStrictEqual(errors, [], `schema violations:\n${errors.join('\n')}`);
});

test('external-results integrity: ids unique, badges/verified constant, no stray content fields', () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const ALLOWED_RESULT_KEYS = new Set([
    'id', 'model', 'source', 'org', 'year', 'category', 'benchmark', 'metric', 'value',
    'lower_is_better', 'metric_variant_flag', 'headline', 'langs_or_pairs', 'source_url',
    'citation', 'verified', 'badge', 'notes', 'pair', 'signal_strength', 'method_ref',
  ]);
  const seen = new Set();
  for (const r of data.results) {
    assert.ok(!seen.has(r.id), `duplicate result id ${r.id}`);
    seen.add(r.id);
    assert.strictEqual(r.verified, true, `${r.id}: verified must be true`);
    assert.strictEqual(r.badge, 'unverified — not reproduced by Champollion', `${r.id}: badge constant`);
    // No corpus content can ride along: every key must be a known scalar field.
    for (const k of Object.keys(r)) {
      assert.ok(ALLOWED_RESULT_KEYS.has(k), `${r.id}: stray field "${k}" (possible corpus content)`);
    }
  }
});

test('external-results method index: ids unique and every method_ref resolves', () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const methods = Array.isArray(data.methods) ? data.methods : [];
  const ids = new Set();
  for (const m of methods) {
    assert.ok(!ids.has(m.id), `duplicate method id ${m.id}`);
    ids.add(m.id);
  }
  for (const r of data.results) {
    if (r.method_ref != null) {
      assert.ok(ids.has(r.method_ref), `${r.id}: method_ref "${r.method_ref}" not in method index`);
    }
  }
  // Every pair edge is a real directed pair with distinct ISO-639-3 endpoints.
  for (const r of data.results) {
    if (r.pair) {
      assert.match(r.pair.source, /^[a-z]{3}$/, `${r.id}: bad pair.source`);
      assert.match(r.pair.target, /^[a-z]{3}$/, `${r.id}: bad pair.target`);
      assert.notStrictEqual(r.pair.source, r.pair.target, `${r.id}: self-pair`);
    }
  }
});
