/**
 * The project glossary is checked for EVERY method, not just the coached one.
 *
 * The terminology check needs the glossary on the pair, which nothing set —
 * so it never ran. A tiny OpenAI-compatible server stands in for "a model on
 * this machine" (the `local` method) and answers without the glossary term.
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

function fakeModel() {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const content = JSON.stringify({ cart: 'Votre chariot', home: 'Accueil' });
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

describe('glossary checks for every method', () => {
  it('warns when a local model skips a glossary term', async () => {
    const server = fakeModel();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gloss-'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.mkdirSync(path.join(d, '.champollion', 'coaching'), { recursive: true });
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), JSON.stringify({ cart: 'Your cart', home: 'Home' }));
    fs.writeFileSync(path.join(d, '.champollion', 'coaching', 'fr.json'), JSON.stringify({ dictionary: { cart: 'panier' } }));
    fs.writeFileSync(path.join(d, 'champollion.config.json'), JSON.stringify(
      { inputLocale: 'en', localesDir: 'locales', languages: ['fr'], defaultMethod: 'local', model: 'm' }));
    try {
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: `http://127.0.0.1:${port}/v1` });
      assert.match(r.out, /\[TERM\] en:fr: 1 dictionary term/);
      assert.match(r.out, /expected "panier" for term "cart"/);
    } finally {
      server.close();
    }
  });
});
