/**
 * harness-seam — buildRunArgv against the REAL mt-eval argument parser.
 *
 * Every other harness test injects execCapture so "no network, no real
 * subprocess" — correct for unit scope, but it leaves the one seam that
 * actually breaks (arena renames a flag; the MCP keeps emitting the old
 * argv) pinned by nothing in either direction. This test closes it: the
 * argv the MCP would spawn is fed to arena's own argparse builder
 * (`mt_eval_harness.cli.build_parser`), parse-only, no run, no spend.
 *
 * Environment contract (loud, never silent):
 *   - arena importable (monorepo checkout or installed mt-eval): test runs.
 *   - arena absent: the test SKIPS with a printed reason — an environment
 *     limitation is a fact to report, not a pass to fake.
 *   - arena present but the seam broken: the test FAILS. That is the point.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildRunArgv } from '../src/tools/harness.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ARENA_DIR = resolve(__dirname, '../../arena');

/** Parse argv with arena's real parser; returns {ok, error}. */
function parseWithRealParser(argv) {
  const py = [
    'import sys, json',
    'from mt_eval_harness.cli import build_parser',
    'p = build_parser()',
    'try:',
    '    ns = p.parse_args(json.loads(sys.argv[1]))',
    '    print(json.dumps({"ok": True, "command": getattr(ns, "command", None)}))',
    'except SystemExit as e:',
    '    print(json.dumps({"ok": False, "code": int(e.code or 0)}))',
  ].join('\n');
  const out = execFileSync('python3', ['-c', py, JSON.stringify(argv)], {
    cwd: ARENA_DIR,
    encoding: 'utf-8',
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out.trim().split('\n').pop());
}

function arenaAvailable() {
  if (!existsSync(ARENA_DIR)) return false;
  try {
    execFileSync('python3', ['-c', 'import mt_eval_harness.cli'], {
      cwd: ARENA_DIR, timeout: 30_000, stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const AVAILABLE = arenaAvailable();

describe('MCP → mt-eval argv seam (real parser, parse-only)', () => {
  const ITEM = {
    corpus_id: 'eng-tgl-dev-v1',
    model: 'anthropic/claude-sonnet-5',
    target_language: 'Tagalog',
    condition: 'raw',
  };

  it('the argv buildRunArgv emits parses under arena\'s own argparse', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const argv = buildRunArgv(ITEM);
    const parsed = parseWithRealParser(argv);
    assert.equal(parsed.ok, true,
      `mt-eval's real parser rejected the MCP's argv ${JSON.stringify(argv)} — the seam drifted`);
    assert.equal(parsed.command, 'run');
  });

  it('the provider flag variant parses too', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const argv = buildRunArgv(ITEM, { provider: 'anthropic' });
    const parsed = parseWithRealParser(argv);
    assert.equal(parsed.ok, true,
      `provider variant rejected: ${JSON.stringify(argv)}`);
  });

  it('a spaced, non-ASCII language name survives the real parser', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const argv = buildRunArgv({
      ...ITEM,
      target_language: 'Plains Cree (nêhiyawêwin, SRO)',
    });
    const parsed = parseWithRealParser(argv);
    assert.equal(parsed.ok, true,
      'the exact language-name shape the queue publishes must parse without shell mangling');
  });

  it('control test: a deliberately wrong flag set FAILS the real parser', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    // If this "passes" the parser, the seam test itself proves nothing.
    const parsed = parseWithRealParser(['run', '--corpus-id-madeup', 'x']);
    assert.equal(parsed.ok, false,
      'the real parser accepted a nonsense flag — this seam test would never catch drift');
  });
});
