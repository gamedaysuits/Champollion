/**
 * init accepts the local (self-hosted / OpenAI-compatible) method.
 *
 * Synthetic hospital persona (2026-10-03): sync worked with --method local,
 * but `init --method local` refused it ("Unknown method"), so the one setup
 * that keeps text on your own machine could not be configured.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

test('init --yes --method local writes a local config and asks for no API key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-init-local-'));
  try {
    fs.mkdirSync(path.join(dir, 'messages'));
    fs.writeFileSync(path.join(dir, 'messages', 'en.json'), JSON.stringify({ hi: 'Hello there' }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { 'next-intl': '3.0.0' } }));
    const r = spawnSync(process.execPath, [CLI, 'init', '--yes', '--langs', 'fr', '--method', 'local'],
      { cwd: dir, encoding: 'utf-8', env: { ...process.env, LOCAL_API_BASE: '' } });
    assert.equal(r.status, 0, r.stderr);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'champollion.config.json'), 'utf-8'));
    assert.equal(cfg.defaultMethod, 'local');
    assert.equal(cfg.localesDir, './messages');
    assert.doesNotMatch(r.stdout, /Set your API key/);
    assert.ok(fs.existsSync(path.join(dir, 'messages', 'fr.json')), 'target file created');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
