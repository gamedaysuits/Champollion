/**
 * Command exit-code + message regression tests (E2E regression suite).
 *
 * Covers:
 *   - L3: `init --yes` on an existing config no-ops + exits 0 → now exits 1
 *         unless --force is passed (which regenerates).
 *   - L4: `card <unknown>` error must not leak the internal
 *         cli/shared/language-cards/... path (wrong for npm installs).
 *   - L9: `seo bogus` / `provenance bogus` print help but exit 0 → now exit
 *         non-zero on an unknown subcommand (matching `tm`).
 *
 * All tests run against isolated temp dirs; no network, no real API calls.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── stdout/stderr capture ─────────────────────────────────────────
let outLines;
let errLines;
let origLog;
let origErr;

function startCapture() {
  outLines = [];
  errLines = [];
  origLog = console.log;
  origErr = console.error;
  console.log = (...a) => outLines.push(a.join(' '));
  console.error = (...a) => errLines.push(a.join(' '));
}
function stopCapture() {
  console.log = origLog;
  console.error = origErr;
}
function allOutput() {
  return [...outLines, ...errLines].join('\n');
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// =================================================================
// L3 — init --yes refuses to clobber an existing config (exit 1),
//      --force regenerates.
// =================================================================
describe('init: existing-config guard (L3)', () => {
  beforeEach(startCapture);
  afterEach(stopCapture);

  it('exits non-zero (not silent 0) when a config already exists', async () => {
    const dir = mkTmp('champ-init-l3-');
    const configPath = path.join(dir, 'champollion.config.json');
    try {
      // Pre-existing (even corrupt) config
      fs.writeFileSync(configPath, '{ not valid json', 'utf-8');
      const { run } = await import('../lib/commands/init.js');
      const code = await run({ _: ['init'], yes: true }, dir);
      assert.equal(code, 1, 'init --yes on an existing config must exit non-zero');
      // The corrupt file must be left untouched (no silent overwrite without --force)
      assert.equal(fs.readFileSync(configPath, 'utf-8'), '{ not valid json');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--force regenerates over an existing/corrupt config (exit 0, valid JSON)', async () => {
    const dir = mkTmp('champ-init-l3b-');
    const configPath = path.join(dir, 'champollion.config.json');
    try {
      fs.writeFileSync(configPath, '{ not valid json', 'utf-8');
      const { run } = await import('../lib/commands/init.js');
      const code = await run({ _: ['init'], yes: true, force: true, langs: 'fr' }, dir);
      assert.equal(code, 0, 'init --force must succeed');
      // The config is now valid JSON, regenerated.
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.equal(parsed.version, 3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fresh init (no existing config) still exits 0', async () => {
    const dir = mkTmp('champ-init-l3c-');
    try {
      const { run } = await import('../lib/commands/init.js');
      const code = await run({ _: ['init'], yes: true, langs: 'fr' }, dir);
      assert.equal(code, 0);
      assert.ok(fs.existsSync(path.join(dir, 'champollion.config.json')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =================================================================
// L4 — card not-found error must not leak the internal repo path.
// =================================================================
describe('card: not-found message (L4)', () => {
  beforeEach(startCapture);
  afterEach(stopCapture);

  it('does not leak cli/shared/language-cards/ in the error', async () => {
    const dir = mkTmp('champ-card-l4-');
    try {
      const { run } = await import('../lib/commands/card.js');
      // 'zzz' is not a real language code → no card found.
      const code = await run({ _: ['card', 'zzz'] }, dir);
      assert.equal(code, 1);
      const text = allOutput();
      assert.match(text, /No language card found/i);
      assert.doesNotMatch(text, /shared\/language-cards/,
        'must not leak the internal monorepo card path (wrong for npm installs)');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =================================================================
// L9 — seo / provenance reject unknown subcommands with a non-zero exit.
// =================================================================
describe('unknown-subcommand exit codes (L9)', () => {
  beforeEach(startCapture);
  afterEach(stopCapture);

  it('seo bogus exits non-zero with an Unknown subcommand error', async () => {
    const dir = mkTmp('champ-seo-l9-');
    try {
      const { run } = await import('../lib/commands/seo.js');
      const code = await run({ _: ['seo', 'bogus'] }, dir);
      assert.equal(code, 1);
      assert.match(allOutput(), /Unknown subcommand: "bogus"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('seo with no subcommand (help) still exits 0', async () => {
    const dir = mkTmp('champ-seo-l9b-');
    try {
      const { run } = await import('../lib/commands/seo.js');
      const code = await run({ _: ['seo'] }, dir);
      assert.equal(code, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('provenance bogus exits non-zero with an Unknown subcommand error', async () => {
    const dir = mkTmp('champ-prov-l9-');
    try {
      const { run } = await import('../lib/commands/provenance.js');
      const code = await run({ _: ['provenance', 'bogus'] }, dir);
      assert.equal(code, 1);
      assert.match(allOutput(), /Unknown subcommand: "bogus"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
