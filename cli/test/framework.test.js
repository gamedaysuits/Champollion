/**
 * framework.test.js — the CLI's reader of the framework documents (project/1,
 * set/1) is held to the SAME vectors as the harness's reader
 * (arena/tests/test_framework.py): one document, one verdict, in both
 * runtimes. See lib/framework/index.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkDocument, checkProject, readSet, PROJECT_FILE, SIDECAR_SUFFIX, SCHEMA_IDS,
} from '../lib/framework/index.js';
import { validate } from '../lib/mini-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = path.resolve(__dirname, '..', '..', 'shared', 'test-fixtures',
  'framework', 'schema-vectors.json');

describe('framework conformance vectors (shared with the harness)', () => {
  const present = fs.existsSync(VECTORS);
  it('every vector gives exactly the expected verdict', (t) => {
    if (!present) return t.skip('monorepo shared/ absent (standalone checkout)');
    const { cases } = JSON.parse(fs.readFileSync(VECTORS, 'utf-8'));
    assert.ok(cases.length >= 15, 'the vector set shrank');
    for (const c of cases) {
      const r = checkDocument(c.doc, c.type);
      assert.deepEqual({ version: r.version, errors: r.errors, warnings: r.warnings },
        c.expect, c.name);
    }
  });
});

describe('mini-schema patternProperties', () => {
  const schema = { type: 'object', additionalProperties: false,
    properties: { a: { type: 'string' } },
    patternProperties: { '^x-': { type: 'string' } } };
  it('a matching key is allowed and validated against its pattern schema', () => {
    assert.deepEqual(validate({ a: 'k', 'x-n': 'v' }, schema).errors, []);
    assert.deepEqual(validate({ 'x-n': 3 }, schema).errors,
      ['$.x-n: expected type string, got integer']);
  });
  it('a key matching nothing is still unexpected', () => {
    assert.deepEqual(validate({ b: 1 }, schema).errors, ["$: unexpected property 'b'"]);
  });
});

function tmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-fw-'));
  const w = (rel, obj) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  };
  w(PROJECT_FILE, { $schema: SCHEMA_IDS.project, kind: 'language', name: 'eng-qaa',
    pair: { source: 'eng', target: 'qaa' } });
  w('data/test/checked.tsv', 'hello\tzub\n');
  w(`data/test/checked.tsv${SIDECAR_SUFFIX}`, { transmission: 'local-only', note: 'old' });
  w('data/parallel/pairs.tsv', 'a\tb\n');
  w(`data/parallel/pairs.tsv${SIDECAR_SUFFIX}`, { $schema: SCHEMA_IDS.set, role: 'train', terms: { training: 'nope' } });
  w(`data/broken.tsv${SIDECAR_SUFFIX}`, '{not json');
  w(`node_modules/pkg/x.tsv${SIDECAR_SUFFIX}`, { anything: true });
  return root;
}

describe('checkProject', () => {
  it('checks the project file and every sidecar, skipping dependency trees', () => {
    const root = tmpProject();
    const r = checkProject(root);
    assert.equal(r.ok, false);
    assert.deepEqual(r.project.errors, []);
    assert.equal(r.project.version, 1);
    assert.deepEqual(r.sets.map((s) => s.data_file),
      ['data/broken.tsv', 'data/parallel/pairs.tsv', 'data/test/checked.tsv']);
    const [broken, pairs, checked] = r.sets;
    assert.deepEqual(broken.errors,
      ['$: not readable as JSON (JSONDecodeError) — fix the file; it states how this data may be used']);
    assert.deepEqual(pairs.errors,
      ['$.terms.training: "nope" not in enum ["allowed","not-allowed"]']);
    assert.equal(checked.version, 0);
    assert.equal(checked.warnings.length, 1);
    assert.ok(!('data' in checked), 'the report never carries sidecar values');
  });

  it('checks the gate chains and deployments a project keeps (as the harness does)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-fw-'));
    fs.mkdirSync(path.join(root, 'gates'));
    fs.mkdirSync(path.join(root, 'deploy'));
    fs.writeFileSync(path.join(root, 'gates', 'loose.json'), JSON.stringify({
      $schema: SCHEMA_IDS['gate-chain'], id: 'loose',
      gates: [{ id: 'g', kind: 'metric-threshold', metric: 'm', field: 'v', on_refuse: 'fallback' }] }));
    fs.writeFileSync(path.join(root, 'deploy', 'words.json'), JSON.stringify({
      $schema: SCHEMA_IDS.deployment, id: 'words', pair: { source: 'eng', target: 'xyz' },
      method: { method: 'lexicon', model: 'data/lexicon/words.tsv' }, gates: 'gates/loose.json' }));
    fs.writeFileSync(path.join(root, 'deploy', 'torn.json'), '{not json');
    const r = checkProject(root);
    assert.equal(r.ok, false);
    assert.deepEqual(r.documents.map((d) => [d.file, d.type, d.version]),
      [['deploy/torn.json', 'deployment', null], ['deploy/words.json', 'deployment', 1],
        ['gates/loose.json', 'gate-chain', 1]]);
    assert.deepEqual(r.documents[0].errors, ['$: not readable as JSON (JSONDecodeError)']);
    assert.deepEqual(r.documents[1].errors, []);
    assert.deepEqual(r.documents[2].errors, [
      '$.gates[0]: a metric-threshold gate needs min and/or max',
      '$.gates[0]: on_refuse fallback needs the chain\'s fallback ("fallback": {"method": "lexicon", "model": "<dictionary>"})']);
  });

  it('a folder with no project file is still checked (sidecars only)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-fw-'));
    const r = checkProject(root);
    assert.equal(r.project.exists, false);
    assert.equal(r.ok, true);
    assert.deepEqual(r.sets, []);
  });
});

describe('readSet', () => {
  it('no sidecar is not an error', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-fw-'));
    const r = readSet(path.join(root, 'x.tsv'));
    assert.equal(r.exists, false);
    assert.deepEqual(r.errors, []);
  });
});
