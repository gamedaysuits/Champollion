/**
 * pack-install.test.js — the packed tarball, installed and RUN.
 *
 * pack-manifest.test.js proves the tarball's file list is right; nothing
 * proved the installed package actually starts. This lane packs the real
 * tarball, installs it into a scratch project, and runs the installed bin —
 * the exact seam where the MCP server's published-install crash lived for
 * weeks with every in-repo suite green.
 *
 * Deliberately OUTSIDE the `test/*.test.js` glob (needs network for the
 * dependency install; runs ~1-3 min). Lanes: `npm run test:pack`, and
 * prepublishOnly — the moment the packed artifact is about to matter.
 *
 * Step 1 runs the committed-bundle freshness gate WITHOUT --ignore-scripts
 * caveats: pack-manifest tests the committed cards-fallback.json; this
 * proves committed == freshly-buildable BEFORE packing with scripts skipped.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '../..');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, {
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...opts,
});

describe('packed tarball installs and runs', { timeout: 300_000 }, () => {
  let work;
  let tarball;
  let binPath;

  before(() => {
    // 1. Committed bundle must equal a fresh build (prepack parity).
    run('node', ['scripts/build-cards-fallback.mjs', '--check'], { cwd: CLI_ROOT });

    // 2. Pack with scripts skipped — safe BECAUSE of step 1, and it keeps
    //    the working tree unmutated mid-test.
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-pack-'));
    const packOut = JSON.parse(run('npm', [
      'pack', '--ignore-scripts', '--json', '--pack-destination', work,
    ], { cwd: CLI_ROOT }));
    tarball = path.join(work, packOut[0].filename);
    assert.ok(fs.existsSync(tarball), `tarball missing: ${tarball}`);

    // 3. Install it into a scratch project (network: real dependencies).
    const proj = path.join(work, 'proj');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'package.json'),
      JSON.stringify({ name: 'pack-smoke', private: true }));
    run('npm', ['install', tarball, '--no-audit', '--no-fund'], { cwd: proj });
    binPath = path.join(proj, 'node_modules', '.bin', 'champollion');
    assert.ok(fs.existsSync(binPath), 'installed bin missing');
  });

  after(() => {
    if (work) fs.rmSync(work, { recursive: true, force: true });
  });

  const cli = (args, opts = {}) => run(binPath, args, {
    env: { ...process.env, CHAMPOLLION_OFFLINE: '1' },
    ...opts,
  });

  it('answers --help from the installed package', () => {
    const out = cli(['--help']);
    assert.match(out, /champollion/i);
  });

  it('serves a bundled flagship card offline (crk)', () => {
    const out = cli(['card', 'crk']);
    assert.match(out, /Plains Cree/);
    assert.equal(out.includes('[object Object]'), false);
  });

  it('serves an ISO 639-1 core card offline (fra)', () => {
    const out = cli(['card', 'fra']);
    assert.match(out, /French/);
  });

  it('answers a manifest-only code with an explicit miss, never a crash', () => {
    // `aaa` (Ghotuo) is in the manifest but not the bundled core set; offline
    // the fetch tier is unavailable. The contract is an EXPLICIT message —
    // exit code may be nonzero, but it must name the situation, not throw a
    // stack trace.
    let out = '';
    try {
      out = cli(['card', 'aaa']);
    } catch (err) {
      out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      assert.equal(/TypeError|ReferenceError|ENOENT.*\.json/.test(out), false,
        `crashed instead of explaining:\n${out}`);
    }
    assert.ok(out.trim().length > 0, 'said nothing at all');
    assert.match(out, /aaa|Ghotuo|offline|cache|fetch|network|not.*(available|found|bundled)/i,
      `expected an explicit offline/cache-miss explanation, got:\n${out}`);
  });
});
