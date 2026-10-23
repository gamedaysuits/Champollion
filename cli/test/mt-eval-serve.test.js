/**
 * mt-eval-serve.test.js — the CLI's `api` method translating through a live
 * `mt-eval serve` (the harness serving a method that runs in its process):
 * one /translate contract, two runtimes, no bridge. Skips when python3 cannot
 * import this checkout's harness.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APIMethod } from '../lib/methods/api.js';
import { output } from '../lib/output.js';

const ARENA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'arena');
const ready = fs.existsSync(path.join(ARENA, 'mt_eval_harness'))
  && spawnSync('python3', ['-c', 'import mt_eval_harness.serve'],
    { env: { ...process.env, PYTHONPATH: ARENA }, timeout: 60_000 }).status === 0;

describe('the CLI api method through mt-eval serve', { skip: ready ? false : 'python3 cannot import the harness' }, () => {
  let child;
  let url;

  before(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-eval-serve-'));
    fs.writeFileSync(path.join(dir, 'words.tsv'), 'old\tvuoras\nhouse\tviessu\n');
    // the family's own word list, marked local-only by its holders
    fs.writeFileSync(path.join(dir, 'words.tsv.champollion.json'), JSON.stringify({ transmission: 'local-only' }));
    child = spawn('python3', ['-m', 'mt_eval_harness', 'serve', '--method', 'lexicon', '-m', 'words.tsv',
      '--pair', 'eng>sme', '--port', '0'], { cwd: dir, env: { ...process.env, PYTHONPATH: ARENA } });
    url = await new Promise((resolve, reject) => {
      let seen = '';
      const timer = setTimeout(() => reject(new Error(`mt-eval serve did not start: ${seen}`)), 60_000);
      const read = (b) => {
        seen += b.toString();
        const m = /at (http:\/\/127\.0\.0\.1:\d+\/translate)/.exec(seen);
        if (m) { clearTimeout(timer); resolve(m[1]); }
      };
      child.stdout.on('data', read);
      child.stderr.on('data', read);
    });
  });

  after(() => { child?.kill('SIGTERM'); });

  it('translates app strings with the served dictionary — only where its holders agreed', async () => {
    const raw = output.raw;
    const error = output.error;
    const errors = [];
    output.raw = () => {};
    output.error = (m) => errors.push(String(m));
    try {
      const method = new APIMethod({ methodName: 'family-words' });
      const pair = { source: 'en', target: 'sme', endpoint: url, method: 'api' };
      const keys = ['hero.title', 'nav.home'];
      const source = { 'hero.title': 'an old house', 'nav.home': 'house' };
      // the dictionary is local-only, and an app's locale files are published
      assert.equal(await method.translate(keys, source, pair, { cwd: process.cwd() }), null);
      assert.match(errors.join('\n'), /says what it writes is local-only/);
      const got = await method.translate(keys, source,
        { ...pair, holdersAgreed: { by: 'the family', method: 'family-words' } }, { cwd: process.cwd() });
      assert.deepEqual(got, { 'hero.title': 'an vuoras viessu', 'nav.home': 'viessu' });
    } finally {
      output.raw = raw;
      output.error = error;
    }
  });
});
