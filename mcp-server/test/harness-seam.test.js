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

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  buildRunArgv, buildCorpusArgv, runBenchmark, awaitAllJobs, HARNESS_DEFAULT_OUTPUT_DIR,
} from '../src/tools/harness.js';

// runBenchmark writes a job history — into a temp dir, never the real home.
let STATE;
before(() => {
  STATE = mkdtempSync(join(tmpdir(), 'mcp-seam-'));
  process.env.CHAMPOLLION_MCP_HOME = STATE;
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(STATE, { recursive: true, force: true });
});

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

  it('skip_fst / skip_eval_standard reach the real parser as --skip-fst / --skip-eval-standard (item + corpus)', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const item = buildRunArgv(ITEM, { skipFst: true, skipEvalStandard: true, env: {} });
    const { argv: corpus } = buildCorpusArgv({ corpus: 'eval-eng-crk-x', model: 'qwen2.5:7b', provider: 'local',
      target_language: 'Plains Cree', skip_fst: true, skip_eval_standard: true }, { env: {} });
    for (const argv of [item, corpus]) {
      assert.ok(argv.includes('--skip-fst') && argv.includes('--skip-eval-standard'), JSON.stringify(argv));
      const parsed = parseWithRealParser(argv);
      assert.equal(parsed.ok, true, `skip flags rejected by the real parser: ${JSON.stringify(argv)}`);
    }
  });

  it('corpus mode (local model, every optional flag, publish to prod) parses', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const { argv } = buildCorpusArgv({
      corpus: 'eval-eng-crk-x', model: 'qwen2.5:7b', provider: 'local',
      base_url: 'http://localhost:11434/v1', target_language: 'Plains Cree',
      source_field: 'en', target_field: 'crk', max_cost: 2.5,
      attest_no_training: true, accept_nc_terms: true, publish: true, anonymous: true,
    }, { env: {} });
    assert.ok(argv.includes('--prod'), 'this variant must exercise the prod opt-in flag');
    const parsed = parseWithRealParser(argv);
    assert.equal(parsed.ok, true, `corpus-mode argv rejected: ${JSON.stringify(argv)}`);
    assert.equal(parsed.command, 'run');
  });

  it('corpus mode with an MT method (local-model) parses', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const { argv } = buildCorpusArgv({
      corpus: 'eval-eng-crk-x', method: 'local-model', model: 'facebook/nllb-200-distilled-600M',
    }, { env: {}, mtMethods: ['local-model'] });
    assert.equal(parseWithRealParser(argv).ok, true, `method argv rejected: ${JSON.stringify(argv)}`);
  });

  it('item mode with publish:true (--publish --prod) parses', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const argv = buildRunArgv(ITEM, { publish: true, anonymous: true, env: {} });
    assert.equal(parseWithRealParser(argv).ok, true, `item publish argv rejected: ${JSON.stringify(argv)}`);
  });

  it('the queue argv run_benchmark spawns parses (default --no-publish, and publish/--anonymous)', async (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const captured = [];
    const handle = {
      isMtEvalInstalled: async () => true,
      execCapture: async (cmd, args) => { captured.push(args); return { code: 0, stdout: '', stderr: '' }; },
      env: {},
    };
    await runBenchmark({ budget: 2, confirm: true }, handle);
    await runBenchmark({ top: 3, confirm: true, publish: true, anonymous: true, provider: 'anthropic',
      publish_ack: 'publish to production: queue results' }, handle);
    await runBenchmark({ top: 3, dry_run: true }, handle);
    await awaitAllJobs();
    assert.equal(captured.length, 3);
    assert.ok(captured[0].includes('--no-publish'));
    for (const argv of captured) {
      const parsed = parseWithRealParser(argv);
      assert.equal(parsed.ok, true, `queue argv rejected: ${JSON.stringify(argv)}`);
      assert.equal(parsed.command, 'queue');
    }
  });

  it('the argv a confirmed item/corpus run SPAWNS (with its per-job --output-dir) parses', async (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    // launchJob appends --output-dir <job folder>/results so the job knows
    // exactly where its results land; the harness must accept it.
    const captured = [];
    const handle = {
      isMtEvalInstalled: async () => true,
      execCapture: async (cmd, args) => { captured.push(args); return { code: 0, stdout: '', stderr: '' }; },
      env: {},
    };
    await runBenchmark({ corpus: 'eval-eng-crk-x', model: 'qwen2.5:7b', provider: 'local', confirm: true }, handle);
    await awaitAllJobs();
    assert.equal(captured.length, 1);
    const i = captured[0].indexOf('--output-dir');
    assert.ok(i > 0, 'a run-mode job must pass --output-dir');
    const parsed = parseWithRealParser(captured[0]);
    assert.equal(parsed.ok, true, `spawned run argv rejected: ${JSON.stringify(captured[0])}`);
  });

  it('the harness queue output folder the MCP reports matches queue_runner.DEFAULT_OUTPUT_DIR', (t) => {
    if (!AVAILABLE) {
      t.skip('arena (mt_eval_harness) not importable here — seam unverifiable in this environment');
      return;
    }
    const out = execFileSync('python3', ['-c',
      'from mt_eval_harness.queue_runner import DEFAULT_OUTPUT_DIR; print(DEFAULT_OUTPUT_DIR)'], {
      cwd: ARENA_DIR, encoding: 'utf-8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(out.trim(), HARNESS_DEFAULT_OUTPUT_DIR,
      'get_run_status would point queue jobs at the wrong results folder');
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
