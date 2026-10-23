/**
 * The documented model switch, end to end through the real CLI:
 * `sync --redo all --fresh-on-model-change` re-translates under the new
 * model, caches what it paid for, and the "Model changed" notice stops.
 *
 * Round 3 (Next.js persona): the real run crashed with "tmMethodKey is not
 * defined" after writing the locale files — the cache was never saved and
 * verification never ran. The earlier test only exercised tm.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

// An OpenAI-compatible model that answers with the model name in the text,
// so the test can see which model produced each value.
function fakeModel() {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { model } = JSON.parse(body || '{}');
      const content = JSON.stringify({ hello: `Bonjour (${model})`, bye: `Au revoir (${model})` });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
}

function runCli(args, cwd, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

describe('model switch, end to end', () => {
  it('--redo all --fresh-on-model-change re-translates, caches, and ends the notice', async () => {
    const server = fakeModel();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const env = { LOCAL_API_BASE: `http://127.0.0.1:${server.address().port}/v1` };
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), JSON.stringify({ hello: 'Hello', bye: 'Goodbye' }));
    const config = (model) => fs.writeFileSync(path.join(d, 'champollion.config.json'), JSON.stringify(
      { inputLocale: 'en', localesDir: 'locales', languages: ['fr'], defaultMethod: 'local', model }));
    try {
      config('m1');
      let r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);

      config('m2');
      r = await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.doesNotMatch(r.out, /is not defined/);
      const fr = JSON.parse(fs.readFileSync(path.join(d, 'locales', 'fr.json'), 'utf8'));
      assert.equal(fr.hello, 'Bonjour (m2)');
      const tm = JSON.parse(fs.readFileSync(path.join(d, '.champollion', 'tm.json'), 'utf8'));
      assert.ok(tm._meta?.switchedTo?.fr, 'the switch is recorded in the cache');

      // the next sync is free and no longer announces a model change
      r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.doesNotMatch(r.out, /Model changed/);
    } finally {
      server.close();
    }
  });
});
