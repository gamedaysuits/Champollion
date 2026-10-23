/**
 * `sync --json` is machine-readable on every path — dogfood 2026-08-28,
 * finding 4. Every stdout line parses; a `cost` event arrives before the
 * gate, one `file` event per content file × locale, and the Docusaurus
 * path (which had no summary at all) ends with one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

test('Docusaurus sync --dry --json: pure NDJSON with cost, file and summary records', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-json-events-'));
  try {
    fs.mkdirSync(path.join(dir, 'i18n', 'en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docusaurus.config.js'), 'module.exports = {};\n');
    fs.writeFileSync(path.join(dir, 'i18n', 'en', 'code.json'), JSON.stringify({ a: { message: 'Hello there' } }));
    fs.writeFileSync(path.join(dir, 'docs', 'intro.md'), '---\ntitle: Intro\n---\nWelcome here.\n');
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './i18n', languages: ['fr'], format: 'docusaurus',
    }));

    const r = spawnSync(process.execPath, [CLI, 'sync', '--dry', '--json'], {
      cwd: dir, encoding: 'utf-8', env: { ...process.env, OPENROUTER_API_KEY: 'test' },
    });
    const records = r.stdout.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { assert.fail(`stdout line is not JSON: ${line}`); }
    });

    const cost = records.findIndex(o => o.event === 'cost');
    const file = records.find(o => o.event === 'file');
    const summary = records.findIndex(o => o.level === 'summary');
    assert.ok(cost >= 0, 'cost event emitted');
    assert.deepEqual(
      { file: file.file, locale: file.locale, status: file.status },
      { file: 'docs/intro.md', locale: 'fr', status: 'would-translate' },
    );
    assert.ok(summary > cost, 'summary closes the run');
    assert.equal(records[summary].format, 'docusaurus');
    assert.equal(records[summary].content.translated, 1);
    assert.equal(r.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
