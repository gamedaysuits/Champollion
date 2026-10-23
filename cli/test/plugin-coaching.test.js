/**
 * A coached method plugin's own coaching is used — and held to its holders'
 * terms (2026-10-10). A plugin bundling a coaching folder (`coaching.dir`,
 * as `mt-eval export --coaching-dir` writes it) used to have the folder
 * attached and never read, so its pairs ran uncoached; a method/1 plugin's
 * `coaching.file` was resolved against the project, not the plugin. Every
 * path stays inside the plugin's folder. Invented vocabulary only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadPlugins, resolvePluginForPair, METHODS_DIR } from '../lib/plugins.js';
import { pluginFromMethod } from '../lib/plugins.js';
import { readMethod } from '../lib/framework/method.js';
import { coachingDirFor, loadCoachingData } from '../lib/methods/coaching-data.js';
import { coachingFilesFor, coachingTermsFailure } from '../lib/coaching-terms.js';

const COACHING = { grammar_rules: ['zub comes before mol'], style_notes: 'plain', dictionary: { house: 'mol' } };

function project() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-coaching-'));
}

function writePlugin(root, name, manifest, files = {}) {
  const dir = path.join(root, METHODS_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'method.json'), JSON.stringify(manifest));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

const OLD = { name: 'xyz-coached', type: 'llm-coached', version: '1.0.0', locales: ['xyz'],
  config: { model: 'google/gemini-3.8-flash' }, coaching: { dir: 'coaching' } };

describe('a coached plugin\'s coaching folder', () => {
  it('is read for its pairs, in place of the project\'s', () => {
    const root = project();
    const dir = writePlugin(root, 'xyz-coached', OLD, { 'coaching/xyz.json': COACHING });
    const plugins = loadPlugins(root);
    const pair = resolvePluginForPair(plugins, { methodPlugin: 'xyz-coached', target: 'xyz' });
    assert.equal(pair.coachingDir, path.join(dir, 'coaching'));
    assert.equal(coachingDirFor(pair, root), path.join(dir, 'coaching'));
    const data = loadCoachingData(coachingDirFor(pair, root), 'xyz', new Map());
    assert.deepEqual(data.grammar_rules, ['zub comes before mol']);
    // a pair with no plugin keeps the project's folder
    assert.equal(coachingDirFor({ target: 'xyz' }, root), path.join(root, '.champollion', 'coaching'));
  });

  it('never points outside the plugin', () => {
    const root = project();
    writePlugin(root, 'escapes', { ...OLD, name: 'escapes', coaching: { dir: '../../elsewhere' } });
    const errs = [];
    const orig = console.error;
    console.error = (m) => errs.push(String(m));
    try {
      assert.equal(loadPlugins(root).has('escapes'), false);
    } finally {
      console.error = orig;
    }
    assert.ok(errs.some((e) => /coaching\.dir leaves its folder/.test(e)), errs.join('\n'));
  });

  it('is held to its holders\' terms, as the project\'s is', () => {
    const root = project();
    const dir = writePlugin(root, 'xyz-coached', OLD, {
      'coaching/xyz.json': COACHING,
      'coaching/xyz.json.champollion.json': { transmission: 'local-only' },
    });
    const pair = resolvePluginForPair(loadPlugins(root), { methodPlugin: 'xyz-coached', target: 'xyz' });
    assert.deepEqual(coachingFilesFor(pair, root), [path.join(dir, 'coaching', 'xyz.json')]);
    const why = coachingTermsFailure({ ...pair, provider: 'openrouter' }, { cwd: root, getMethod: () => null });
    assert.match(why, /marked local-only by the people who hold it/);
  });
});

describe('a method/1 coached plugin', () => {
  const M1 = { $schema: 'https://champollion.dev/schemas/method/1.json', id: 'xyz-coached',
    name: 'xyz coached', kind: 'llm-coached', provider: 'openrouter', model: 'google/gemini-3.8-flash',
    pairs: [{ source: 'eng', target: 'xyz' }] };

  it('reads its coaching file and folder from its own folder', () => {
    const root = project();
    const dir = writePlugin(root, 'xyz-coached', { ...M1, coaching: { file: 'prompt.md', dir: 'coaching' } },
      { 'prompt.md': 'Write plainly.', 'coaching/xyz.json': COACHING });
    const got = pluginFromMethod(readMethod(path.join(dir, 'method.json')));
    assert.equal(got.error, undefined);
    assert.equal(got.plugin.config.coachingFile, path.join(dir, 'prompt.md'));
    assert.equal(got.plugin.coaching.dir, path.join(dir, 'coaching'));
    const pair = resolvePluginForPair(loadPlugins(root), { methodPlugin: 'xyz-coached', target: 'xyz' });
    assert.equal(pair.coachingFile, path.join(dir, 'prompt.md'));
    assert.equal(pair.coachingDir, path.join(dir, 'coaching'));
  });

  it('refuses coaching that leaves its folder', () => {
    const root = project();
    const dir = writePlugin(root, 'xyz-coached', { ...M1, coaching: { file: '../../notes.md' } });
    const got = pluginFromMethod(readMethod(path.join(dir, 'method.json')));
    assert.match(got.error, /coaching\.file "\.\.\/\.\.\/notes\.md" leaves the method's folder/);
  });
});

describe('a method ships with the provider it was measured with (docs review #4)', () => {
  const base = { $schema: 'https://champollion.dev/schemas/method/1.json', id: 'm', name: 'm',
    version: '1.0.0', kind: 'llm', model: 'llama3.1', pairs: [{ source: 'eng', target: 'xyz' }] };
  it('local stays local; none named is refused, never sent to a hosted default', () => {
    const root = project();
    const local = writePlugin(root, 'm-local', { ...base, provider: 'local' });
    assert.equal(pluginFromMethod(readMethod(path.join(local, 'method.json'))).plugin.type, 'local');
    const none = writePlugin(root, 'm-none', base);
    assert.match(pluginFromMethod(readMethod(path.join(none, 'method.json'))).error,
      /does not say which provider carried its text .* the CLI never picks one for it/);
    const routed = writePlugin(root, 'm-or', { ...base, provider: 'openrouter', model: 'google/gemini-3.8-flash' });
    assert.equal(pluginFromMethod(readMethod(path.join(routed, 'method.json'))).plugin.type, 'llm');
  });
});
