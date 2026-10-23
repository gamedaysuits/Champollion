/**
 * upgrade.test.js — `champollion upgrade` rewrites older framework files in
 * the current formats and loses nothing: set/0 sidecars become set/1 (every
 * value kept, unknown keys under x-), invalid ones are left for a person,
 * method/0 files are listed and kept, --dry writes nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run, upgradeProject } from '../lib/commands/upgrade.js';
import { checkProject, upgradeSet } from '../lib/framework/index.js';
import { output } from '../lib/output.js';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

const read = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));

describe('champollion upgrade', () => {
  const files = {
    'data/test/t.tsv.champollion.json': { transmission: 'local-only', note: 'from grandpa', 'x-note': 'mine' },
    'data/parallel/p.tsv.champollion.json': { $schema: 'https://champollion.dev/schemas/set/1.json', terms: { training: 'allowed' } },
    'data/broken.tsv.champollion.json': '{not json',
    '.champollion/methods/old/method.json': { name: 'old', type: 'deepl', version: '1.0.0', locales: ['fr'] },
  };

  it('--dry says what would change and writes nothing', async () => {
    const root = project(files);
    const before = fs.readFileSync(path.join(root, 'data/test/t.tsv.champollion.json'), 'utf-8');
    const r = upgradeProject(root, { dry: true });
    assert.deepEqual(r.sets.map((s) => [s.file, s.action]), [
      ['data/broken.tsv.champollion.json', 'left — invalid, fix it by hand'],
      ['data/test/t.tsv.champollion.json', 'would become set/1'],
    ]);
    assert.equal(fs.readFileSync(path.join(root, 'data/test/t.tsv.champollion.json'), 'utf-8'), before);
  });

  it('rewrites set/0 as set/1, keeps every value, never touches an invalid file or an old method', async () => {
    const root = project(files);
    const lines = [];
    const raw = output.raw;
    output.raw = (s) => lines.push(String(s));
    try {
      assert.equal(await run({ _: ['upgrade', root] }, root), 0);
    } finally {
      output.raw = raw;
    }
    const text = lines.join('\n');
    assert.match(text, /data\/test\/t\.tsv\.champollion\.json {2}set\/0 → set\/1 \(kept under x-: note\)/);
    assert.match(text, /method\.json {2}kept as method\/0 — a CLI plugin manifest/);
    assert.deepEqual(read(root, 'data/test/t.tsv.champollion.json'), {
      $schema: 'https://champollion.dev/schemas/set/1.json', transmission: 'local-only',
      'x-note': 'mine', 'x-note-0': 'from grandpa' });
    assert.equal(fs.readFileSync(path.join(root, 'data/broken.tsv.champollion.json'), 'utf-8'), '{not json');
    assert.equal(read(root, '.champollion/methods/old/method.json').type, 'deepl');
    // the upgraded files validate; only the broken one still does not
    const report = checkProject(root);
    assert.deepEqual(report.sets.filter((s) => s.errors.length).map((s) => s.data_file), ['data/broken.tsv']);
    // a second run has nothing left to do for the sets
    assert.equal(upgradeProject(root).sets.filter((s) => s.action === 'set/0 → set/1').length, 0);
  });

  it('upgradeSet keeps a value whose x- name is taken', () => {
    const { doc, renamed } = upgradeSet({ a: 1, 'x-a': 2, 'x-a-0': 3 });
    assert.deepEqual(renamed, ['a']);
    assert.deepEqual(doc, { $schema: 'https://champollion.dev/schemas/set/1.json', 'x-a': 2, 'x-a-0': 3, 'x-a-0-0': 1 });
  });
});
