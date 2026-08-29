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
