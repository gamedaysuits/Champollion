/**
 * method/1: one method.json, one reading, in both runtimes. The CLI reader
 * (lib/framework/method.js) is held to shared/test-fixtures/framework/
 * method-vectors.json; the harness reader (arena/mt_eval_harness/framework/
 * method.py) to the same file — so a method can never be read two ways.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readMethod, readMethodDocument, slugId } from '../lib/framework/method.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = path.join(HERE, '..', '..', 'shared', 'test-fixtures', 'framework', 'method-vectors.json');

describe('method/1 vectors', () => {
  it('every vector reads exactly as expected', (t) => {
    if (!fs.existsSync(VECTORS)) return t.skip('monorepo shared/ absent');
    const { cases } = JSON.parse(fs.readFileSync(VECTORS, 'utf-8'));
    assert.ok(cases.length >= 20, 'the vector set shrank');
    for (const c of cases) {
      const r = readMethodDocument(c.doc);
      const got = { version: r.version, shape: r.shape, errors: r.errors, warnings: r.warnings };
      if (r.version === 0) {
        assert.deepEqual(r.data['x-v0'], c.doc, `${c.name}: x-v0 keeps the original`);
        const view = { ...r.data };
        delete view['x-v0'];
        got.view = view;
      }
      assert.deepEqual(got, c.expect, c.name);
    }
  });
});

describe('reading a method.json file', () => {
  it('reads a file, says where its relative paths start, and refuses what is not JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-'));
    const file = path.join(dir, 'method.json');
    fs.writeFileSync(file, JSON.stringify({ $schema: 'https://champollion.dev/schemas/method/1.json',
      id: 'w', name: 'W', kind: 'lexicon', dictionary: 'words.tsv' }));
    const r = readMethod(file);
    assert.equal(r.version, 1);
    assert.deepEqual(r.errors, []);
    assert.equal(r.dir, dir);
    fs.writeFileSync(file, '{not json');
    assert.deepEqual(readMethod(file).errors, ['$: not readable as JSON (JSONDecodeError)']);
    assert.deepEqual(readMethod(path.join(dir, 'gone.json')).errors, ['gone.json: no such file']);
  });

  it('a method/1 file as nmt-forge exports it installs and resolves as an api pair', async () => {
    const { installPluginFromLocal, loadPlugins, resolvePluginForPair } = await import('../lib/plugins.js');
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-export-'));
    const pluginDir = path.join(exportDir, 'champollion-plugin');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      $schema: 'https://champollion.dev/schemas/method/1.json', id: 'nmt-forge-first', name: 'nmt-forge-first',
      version: '1.0.0', kind: 'nmt-checkpoint', model_dir: '..',
      service: { endpoint: 'http://127.0.0.1:8378/translate', accepts_instructions: false },
      pairs: [{ source: 'eng', target: 'qaa' }],
      card: { class: 'pipeline', paradigm: 'neural-nmt', commercial_ready: false },
      evidence: [{ dataset: 'project-test', metric: 'chrf++', score: 21.5, ci: [18.0, 25.1], n: 40 }],
      runtimes: ['cli'],
    }));
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'app-'));
    const installed = installPluginFromLocal(pluginDir, app);
    assert.equal(installed.success, true, installed.error);
    const plugins = loadPlugins(app);
    const p = plugins.get('nmt-forge-first');
    assert.equal(p.type, 'api');
    assert.deepEqual(p.locales, ['qaa']);
    assert.equal(p.provenance.commercialReady, false);
    const pair = resolvePluginForPair(plugins, { methodPlugin: 'nmt-forge-first', method: 'llm', _defaults: new Set() });
    assert.equal(pair.method, 'api');
    assert.equal(pair.endpoint, 'http://127.0.0.1:8378/translate');
    assert.equal(pair.acceptsInstructions, false);
  });

  it('a kind the CLI cannot run is skipped with the reason, never silently', async () => {
    const { loadPlugins } = await import('../lib/plugins.js');
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'app-'));
    const dir = path.join(app, '.champollion', 'methods', 'words');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'method.json'), JSON.stringify({
      $schema: 'https://champollion.dev/schemas/method/1.json', id: 'words', name: 'Words',
      kind: 'lexicon', dictionary: 'words.tsv', pairs: [{ target: 'qaa' }] }));
    const said = [];
    const err = console.error;
    console.error = (m) => said.push(String(m));
    try {
      assert.equal(loadPlugins(app).size, 0);
    } finally {
      console.error = err;
    }
    assert.match(said.join('\n'), /Skipping plugin "words": a lexicon method runs in the eval engine/);
  });

  it('makes an id from a name', () => {
    assert.equal(slugId('CRK Decomp-Recomp Pipeline'), 'crk-decomp-recomp-pipeline');
    assert.equal(slugId('¿?'), 'method');
  });
});
