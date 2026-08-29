#!/usr/bin/env node
/**
 * Sync exit-code + --json summary contract tests.
 *
 * Covers two agent-contract guarantees:
 *
 *   1. computeExitCode — a fully-failed sync (bad key / 401, every locale
 *      errored, totalProcessed=0) MUST exit non-zero. The old gate
 *      (`totalFailed > 0 && totalProcessed > 0`) returned 0 there, so a
 *      `sync` in a pre-deploy hook went green while shipping English
 *      fallbacks. Verification errors also feed the exit code.
 *
 *   2. runSync emits a single machine-readable {level:'summary'} object in
 *      --json mode, so agents parse counts + per-locale results instead of
 *      regexing English NDJSON log lines.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computeExitCode } from '../lib/commands/sync.js';
import { runSync } from '../lib/sync.js';
import { output } from '../lib/output.js';

// =================================================================
// computeExitCode — the exit-code contract
// =================================================================
describe('computeExitCode', () => {
  it('returns 1 for a fully-failed sync (failures, zero processed)', () => {
    // The 401 / bad-key case: every locale errored, nothing translated.
    assert.equal(computeExitCode({ totalProcessed: 0, totalFailed: 12 }), 1);
  });

  it('returns 2 for a partial sync (some processed, some failed)', () => {
    assert.equal(computeExitCode({ totalProcessed: 30, totalFailed: 3 }), 2);
  });

  it('returns 0 for a clean sync (work done, nothing failed)', () => {
    assert.equal(computeExitCode({ totalProcessed: 42, totalFailed: 0 }), 0);
  });

  it('returns 0 for a no-op clean sync (nothing to do, nothing failed)', () => {
    assert.equal(computeExitCode({ totalProcessed: 0, totalFailed: 0 }), 0);
  });

  it('feeds verifyLocales errors into the exit code (partial)', () => {
    // Files were written but verification found [EN] markers / missing keys.
    assert.equal(
      computeExitCode({ totalProcessed: 42, totalFailed: 0, verifyErrors: 5 }),
      2,
    );
  });

  it('catastrophic failure wins over verify when nothing processed', () => {
    assert.equal(
      computeExitCode({ totalProcessed: 0, totalFailed: 7, verifyErrors: 2 }),
      1,
    );
  });

  it('returns 0 for a null/undefined result', () => {
    assert.equal(computeExitCode(null), 0);
    assert.equal(computeExitCode(undefined), 0);
  });
});

// =================================================================
// runSync --json — structured summary object
// =================================================================
describe('runSync --json summary', () => {
  const tmpDir = path.join(import.meta.dirname, 'fixtures', '_tmp_json_summary');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const src = path.join(import.meta.dirname, 'fixtures', 'locales');
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(tmpDir, file));
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    output.setMode('default');
  });

  it('emits one parseable {level:"summary"} object with counts + per-locale results', async () => {
    // Keyless dry-run: skips preflight + cost estimate (hermetic, no network),
    // but still reaches the end-of-run summary emission.
    const savedKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const lines = [];
    const origLog = console.log;
    const origWrite = process.stdout.write;
    console.log = (...args) => lines.push(args.join(' '));
    process.stdout.write = (s) => { lines.push(s); return true; };

    output.setMode('json');
    try {
      await runSync({
        dryRun: true,
        cwd: import.meta.dirname,
        cliArgs: { dir: tmpDir, json: true },
      });
    } finally {
      console.log = origLog;
      process.stdout.write = origWrite;
      output.setMode('default');
      if (savedKey) process.env.OPENROUTER_API_KEY = savedKey;
      else delete process.env.OPENROUTER_API_KEY;
    }

    // Find the single summary object among the NDJSON lines.
    const summaries = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((o) => o && o.level === 'summary');

    assert.equal(summaries.length, 1, 'exactly one summary object should be emitted');
    const s = summaries[0];
    assert.equal(s.command, 'sync');
    assert.equal(s.dryRun, true);
    assert.equal(typeof s.totalProcessed, 'number');
    assert.equal(typeof s.totalFailed, 'number');
    assert.ok(s.verify && typeof s.verify.errors === 'number', 'carries verify counts');
    assert.ok(Array.isArray(s.locales), 'carries per-locale results');
    // Fixtures auto-detect fr + de as targets — each locale entry is labelled.
    for (const loc of s.locales) {
      assert.ok(typeof loc.pair === 'string' && loc.pair.length > 0, 'locale has a pair key');
      assert.equal(typeof loc.processed, 'number');
      assert.equal(typeof loc.failed, 'number');
    }
    const targets = s.locales.map((l) => l.target);
    assert.ok(targets.includes('fr') && targets.includes('de'), 'fr + de present');
  });
});
