/**
 * Tests for the forge_* driver plumbing (src/tools/forge.js).
 *
 * The exec itself needs Python + the forge package, so the unit tests pin the
 * PURE argv/env builder — the contract every forge_* tool depends on: the
 * global --workspace precedes the subcommand, PYTHONPATH points at forge/,
 * and the NMT_FORGE_BIN / PYTHON_BIN / CHAMPOLLION_FORGE_DIR overrides win.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildForgeInvocation, forgeDir } from '../src/tools/forge.js';

const SAVED = { ...process.env };
function reset() {
  for (const k of ['NMT_FORGE_BIN', 'PYTHON_BIN', 'CHAMPOLLION_FORGE_DIR',
    'CHAMPOLLION_FORGE_WORKSPACE', 'PYTHONPATH']) {
    delete process.env[k];
  }
}

describe('buildForgeInvocation', () => {
  afterEach(() => { reset(); Object.assign(process.env, SAVED); });

  it('invokes python -m nmt_forge.cli with --workspace before the subcommand', () => {
    reset();
    const inv = buildForgeInvocation(['status', '--json'], { workspace: 'wsX' });
    assert.equal(inv.cmd, 'python3');
    assert.deepEqual(inv.args,
      ['-m', 'nmt_forge.cli', '--workspace', 'wsX', 'status', '--json']);
    assert.ok(inv.env.PYTHONPATH.includes('forge'));
  });

  it('defaults the workspace to .forge and honors the env override', () => {
    reset();
    assert.deepEqual(
      buildForgeInvocation(['status']).args.slice(2, 4), ['--workspace', '.forge']);
    process.env.CHAMPOLLION_FORGE_WORKSPACE = 'envws';
    assert.deepEqual(
      buildForgeInvocation(['status']).args.slice(2, 4), ['--workspace', 'envws']);
  });

  it('prepends CHAMPOLLION_FORGE_DIR to PYTHONPATH', () => {
    reset();
    process.env.CHAMPOLLION_FORGE_DIR = '/opt/forge';
    process.env.PYTHONPATH = '/pre';
    const inv = buildForgeInvocation(['lint', 'm.json', '--json']);
    assert.equal(forgeDir(), '/opt/forge');
    assert.equal(inv.env.PYTHONPATH, '/opt/forge:/pre');
  });

  it('uses NMT_FORGE_BIN directly (no python -m) when set', () => {
    reset();
    process.env.NMT_FORGE_BIN = 'nmt-forge';
    const inv = buildForgeInvocation(['discover', 'crk', '--json'], { workspace: 'w' });
    assert.equal(inv.cmd, 'nmt-forge');
    assert.deepEqual(inv.args, ['--workspace', 'w', 'discover', 'crk', '--json']);
  });

  it('honors PYTHON_BIN', () => {
    reset();
    process.env.PYTHON_BIN = 'python3.14';
    assert.equal(buildForgeInvocation(['status']).cmd, 'python3.14');
  });
});

// ================================================================
// Where forge comes from — the 0.2.0 resolution ladder.
//
// From an npm + pip install there is no clone: `pip install nmt-forge` puts
// `nmt-forge` on PATH (or at least makes nmt_forge importable). The old code
// only knew CHAMPOLLION_FORGE_DIR and told users forge was "not on PyPI".
// ================================================================
import {
  resolveForgeLauncher, explainForgeFailure, forgeTool, FORGE_INSTALL_HINT,
} from '../src/tools/forge.js';

describe('resolveForgeLauncher', () => {
  const none = { exists: () => false, which: () => null, canImport: async () => false, siblingDir: '/no/sibling' };

  it('NMT_FORGE_BIN wins', async () => {
    const l = await resolveForgeLauncher({ ...none, env: { NMT_FORGE_BIN: '/x/nmt-forge' } });
    assert.equal(l.kind, 'bin');
    assert.equal(l.cmd, '/x/nmt-forge');
  });

  it('a valid CHAMPOLLION_FORGE_DIR clone is used; an invalid one is an error, never skipped past', async () => {
    const ok = await resolveForgeLauncher({ ...none, env: { CHAMPOLLION_FORGE_DIR: '/clone/forge' }, exists: (p) => p === '/clone/forge/nmt_forge' });
    assert.equal(ok.kind, 'dir');
    const bad = await resolveForgeLauncher({ ...none, env: { CHAMPOLLION_FORGE_DIR: '/wrong' }, which: () => '/usr/bin/nmt-forge' });
    assert.equal(bad.kind, 'missing', 'a wrong explicit dir must not silently fall through to PATH');
    assert.match(bad.error, /CHAMPOLLION_FORGE_DIR points at \/wrong/);
  });

  it('the monorepo sibling is used in a checkout', async () => {
    const l = await resolveForgeLauncher({ ...none, env: {}, siblingDir: '/repo/forge', exists: (p) => p === '/repo/forge/nmt_forge' });
    assert.equal(l.kind, 'dir');
    assert.equal(l.dir, '/repo/forge');
  });

  it('a pip install: `nmt-forge` on PATH', async () => {
    const l = await resolveForgeLauncher({ ...none, env: {}, which: (c) => (c === 'nmt-forge' ? '/venv/bin/nmt-forge' : null) });
    assert.equal(l.kind, 'bin');
    assert.equal(l.cmd, '/venv/bin/nmt-forge');
    assert.match(l.how, /PATH/);
  });

  it('a pip install without the scripts dir on PATH: python -m nmt_forge.cli', async () => {
    const l = await resolveForgeLauncher({ ...none, env: { PYTHON_BIN: 'python3.12' }, canImport: async (py) => py === 'python3.12' });
    assert.equal(l.kind, 'module');
    const inv = buildForgeInvocation(['status', '--json'], { launcher: l, workspace: 'w' });
    assert.equal(inv.cmd, 'python3.12');
    assert.deepEqual(inv.args, ['-m', 'nmt_forge.cli', '--workspace', 'w', 'status', '--json']);
  });

  it('nothing installed → the install command, and no "not on PyPI"', async () => {
    const l = await resolveForgeLauncher({ ...none, env: {} });
    assert.equal(l.kind, 'missing');
    assert.match(l.error, /pip install nmt-forge/);
    assert.match(l.error, /nmt-forge\[hf\]/);
    assert.doesNotMatch(l.error, /not on PyPI/);
  });

  it('forgeTool turns a missing forge into an actionable isError (no spawn, no traceback)', async () => {
    const launcher = await resolveForgeLauncher({ ...none, env: {} });
    const res = await forgeTool(['status', '--json'], { launcher: { ...launcher } }).catch((e) => e);
    // forgeTool resolves; a missing launcher passed explicitly is honoured by runForge.
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /pip install nmt-forge/);
    assert.doesNotMatch(res.content[0].text, /Traceback|at .*\.js:\d+/);
  });
});

describe('explainForgeFailure', () => {
  it('maps cold-start tracebacks to fixes', () => {
    assert.match(explainForgeFailure("ModuleNotFoundError: No module named 'nmt_forge'").join('\n'), /pip install nmt-forge/);
    assert.match(explainForgeFailure("No module named 'mt_eval_harness'").join('\n'), /pip install mt-eval-harness/);
    assert.match(explainForgeFailure("No module named 'torch'").join('\n'), /nmt-forge\[hf\]/);
    const cards = explainForgeFailure('ResourceMissing: language-cards directory not found').join('\n');
    assert.match(cards, /pip install -U nmt-forge/, 'a pre-0.2.0 card error says to upgrade');
    assert.match(cards, /get_language/);
    assert.doesNotMatch(cards, /clone/, '0.2.0 needs no clone for cards');
    assert.match(explainForgeFailure('nmt-forge: error: unrecognized arguments: --json').join('\n'),
      /predates 0\.2\.0.*pip install -U nmt-forge/s);
    assert.equal(explainForgeFailure('ForgeError: dev fence').length, 0);
    assert.doesNotMatch(FORGE_INSTALL_HINT, /not on PyPI/);
  });
});
