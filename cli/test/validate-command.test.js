/**
 * `champollion validate` — checks a project's framework documents and exits
 * 0 (valid, warnings allowed) / 1 (invalid) / 2 (usage).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../lib/commands/validate.js';
import { output } from '../lib/output.js';
import { SCHEMA_IDS } from '../lib/framework/index.js';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-validate-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

async function capture(fn) {
  const raw = output.raw;
  const error = output.error;
  const lines = [];
  output.raw = (s) => lines.push(String(s));
  output.error = (s) => lines.push(String(s));
  try {
    const code = await fn();
    return { code, text: lines.join('\n') };
  } finally {
    output.raw = raw;
    output.error = error;
  }
}

const GOOD_PROJECT = { $schema: SCHEMA_IDS.project, kind: 'language', name: 'eng-qaa',
  pair: { source: 'eng', target: 'qaa' } };

describe('champollion validate', () => {
  it('a valid project exits 0 and says the other tools read it the same way', async () => {
    const root = project({
      'champollion.project.json': GOOD_PROJECT,
      'data/test/checked.tsv.champollion.json': { transmission: 'local-only' },
    });
    const { code, text } = await capture(() => run({ _: ['validate', root] }, root));
    assert.equal(code, 0);
    assert.match(text, /valid\. mt-eval and nmt-forge read these files the same way/);
  });

  it('checks method.json files: method/1 as it is, an older one as method/0 with a warning', async () => {
    const root = project({
      'champollion.project.json': GOOD_PROJECT,
      'methods/words/method.json': { $schema: 'https://champollion.dev/schemas/method/1.json',
        id: 'words', name: 'Words', kind: 'lexicon', dictionary: '../../data/lexicon/w.tsv' },
      '.champollion/methods/old/method.json': { name: 'old', type: 'deepl', version: '1.0.0', locales: ['fr'] },
    });
    let { code, text } = await capture(() => run({ _: ['validate', root] }, root));
    assert.equal(code, 0, text);
    assert.match(text, /methods\/words\/method\.json {2}✓ method\/1/);
    assert.match(text, /\.champollion\/methods\/old\/method\.json {2}⚠ method\/0/);
    assert.match(text, /predates method\/1 \(a CLI plugin manifest\)/);
    fs.writeFileSync(path.join(root, 'methods', 'words', 'method.json'), JSON.stringify({
      $schema: 'https://champollion.dev/schemas/method/1.json', id: 'words', name: 'Words', kind: 'lexicon' }));
    ({ code, text } = await capture(() => run({ _: ['validate', root] }, root)));
    assert.equal(code, 1);
    assert.match(text, /kind lexicon must name its dictionary/);
  });

  it('warnings alone still exit 0', async () => {
    const root = project({
      'data/a.tsv.champollion.json': { transmission: 'local-only', note: 'x' },
    });
    const { code, text } = await capture(() => run({ _: ['validate', root] }, root));
    assert.equal(code, 0);
    assert.match(text, /rename it 'x-note'/);
  });

  it('an invalid sidecar exits 1 and never prints the data file', async () => {
    const root = project({
      'data/a.tsv': 'SECRET-SENTENCE\tzub\n',
      'data/a.tsv.champollion.json': { $schema: SCHEMA_IDS.set, transmission: 'public' },
    });
    const { code, text } = await capture(() => run({ _: ['validate', root] }, root));
    assert.equal(code, 1);
    assert.match(text, /\$\.transmission: "public" not in enum/);
    assert.ok(!text.includes('SECRET-SENTENCE'));
  });

  it('--json prints the report', async () => {
    const root = project({ 'champollion.project.json': GOOD_PROJECT });
    const { code, text } = await capture(() => run({ _: ['validate', root], json: true }, root));
    assert.equal(code, 0);
    const report = JSON.parse(text);
    assert.equal(report.ok, true);
    assert.equal(report.project.version, 1);
  });

  it('a missing folder or extra arguments is a usage error (2)', async () => {
    const root = project({});
    assert.equal((await capture(() => run({ _: ['validate', path.join(root, 'nope')] }, root))).code, 2);
    assert.equal((await capture(() => run({ _: ['validate', root, 'extra'] }, root))).code, 2);
  });
});
