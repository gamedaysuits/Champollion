/**
 * The forge_* tools against nmt-forge 0.2.0's `--json` contract
 * (forge/docs/JSON_OUTPUT.md): exactly one JSON document on stdout, refusals
 * as {"error": {type, guard, message, why, fix, how_to_get, text}} + exit 2,
 * preflight exiting 2 with its normal payload when a gate fails.
 *
 * A STUB `nmt-forge` (a small node script, wired in through NMT_FORGE_BIN —
 * the server's own first-choice launcher) answers like forge 0.2.0 and logs
 * the argv + cwd it was called with, so these tests pin both directions:
 * what each tool SENDS (every call carries --json; the new flags reach forge)
 * and what it makes of each kind of answer. The real forge is exercised by
 * forge-loop.test.js when it is installed.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import {
  forgeTool, formatForgeError, forgeToolsIn, forgeCommandLine, buildForgeInvocation,
} from '../src/tools/forge.js';

const POSIX = process.platform !== 'win32';

// The stub's behaviour, keyed on the subcommand; FAKE_FORGE_MODE overrides.
const STUB = String.raw`
const fs = require('node:fs');
const argv = process.argv.slice(2);
if (process.env.FAKE_FORGE_LOG) {
  fs.appendFileSync(process.env.FAKE_FORGE_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + '\n');
}
// fs.writeSync, not process.stdout.write: a pipe write is async on macOS and exit() would race it
const out = (o, code = 0) => { fs.writeSync(1, JSON.stringify(o, null, 2) + '\n'); process.exit(code); };
const err = (t) => fs.writeSync(2, t);
const mode = process.env.FAKE_FORGE_MODE || '';
if (mode === 'old-forge') {
  err('usage: nmt-forge [-h] ...\nnmt-forge: error: unrecognized arguments: --json\n');
  process.exit(2);
}
if (mode === 'text') { fs.writeSync(1, 'initialized proj for Plains Cree (crk)\n'); process.exit(0); }
if (mode === 'crash') {
  err('Traceback (most recent call last):\n  File "cli.py", line 9, in main\n    boom()\nRuntimeError: decoder state went sideways\n');
  process.exit(1);
}
if (mode === 'no-harness') {
  err("Traceback (most recent call last):\nModuleNotFoundError: No module named 'mt_eval_harness'\n");
  process.exit(1);
}
if (mode === 'hang') {
  process.on('SIGINT', () => { fs.appendFileSync(process.env.FAKE_FORGE_LOG, '"SIGINT-cleanup"\n'); process.exit(130); });
  setInterval(() => {}, 1000);
  return;
}
const i = argv.indexOf('--workspace');
const rest = i >= 0 ? argv.slice(i + 2) : argv;
const [cmd, sub] = rest;
const flag = (f) => { const k = rest.indexOf(f); return k >= 0 ? rest[k + 1] : undefined; };
if (cmd === 'status' && mode === 'initialized') {
  out({ snapshot: { workspace: '/p/.forge', roles: { dev: [], test: [], sealed: [] }, preregs: [], runs: [],
    exports: [], project: { config: '/p/config.json', dev: 'project-dev', battery: 'project-test' }, ledger_events: {} },
  advice: { state: 'initialized',
    next_command: 'nmt-forge split <corpus.jsonl> --test <M> --dev <N> --seed <S> --out data/split --register project   # OR, with your OWN test set kept as a separate file: nmt-forge registry add project-test <your-test.jsonl> --role test && nmt-forge leak-audit <corpus.jsonl> --clean-to corpus.clean.jsonl && nmt-forge split corpus.clean.jsonl --test 0 --dev <N> --seed <S> --out data/split --register project',
    why: 'initialized', ready: [], blockers: ['no dev/test/sealed sets registered yet'], warnings: [] } });
}
if (cmd === 'status' && mode === 'two-runs') {
  const run = (name, score, sat, exp) => ({ run: name, manifest: '/p/.forge/runs/' + name + '/run-manifest.json',
    selected_checkpoint: 'ck-' + name, dev_set: 'project-dev',
    dev_score: { metric: 'chrf++', score, ci: [score - 2, Math.min(100, score + 2)] }, dev_saturated: sat,
    exported: Boolean(exp), exports: exp ? [{ dir: exp, model_dir: exp + '/model', model_included: true }] : [] });
  out({ snapshot: { workspace: '/p/.forge', roles: { dev: ['project-dev'], test: ['project-test'], sealed: [] },
    preregs: [], runs: [run('full', 100, true, '/p/export'), run('strict', 43.6, false, null)], exports: [], ledger_events: {} },
  advice: { state: 'ready-to-score',
    next_command: 'nmt-forge export /p/.forge/runs/strict/run-manifest.json --out export-strict/',
    why: 'export it', ready: [], blockers: [],
    warnings: ['run full: the dev set is SATURATED (dev chrf++ 100.00 [98.00, 100.00])'] } });
}
if (cmd === 'prereg' && sub === 'verdict') {
  out({ prereg_id: rest[2], prediction: Number(flag('--prediction')), verdict: rest.includes('--held') ? 'held' : 'missed',
    by: flag('--by'), by_source: '--by', note: flag('--note') || '', ts: '2026-10-04T00:00:00+00:00',
    ledger_entry: 'abc', revised: null, deploy_updated: ['/p/export/model/DEPLOY.md'] });
}
if (cmd === 'status') {
  const exported = mode === 'exported';
  out({ snapshot: { workspace: '/p/.forge', roles: { dev: ['p-dev'], test: ['p-test'], sealed: [] },
    preregs: [], runs: [], exports: exported ? [{ run: 'r', dir: '/p/export', manifest: '/p/m.json' }] : [],
    ledger_events: {} },
  advice: exported
    ? { state: 'exported', next_command: 'nmt-forge serve /p/export', why: 'serve it', ready: [], blockers: [] }
    : mode === 'training'
    ? { state: 'training', next_command: 'nmt-forge status', why: 'a training run is in progress — WAIT',
      ready: [], blockers: ['training in progress — wait (pid 4242)'] }
    : { state: 'missing-preregistration',
      next_command: 'nmt-forge prereg template --out predictions.json && nmt-forge prereg new <id> --eval-set p-test --predictions predictions.json',
      why: 'no prereg', ready: [], blockers: ["no preregistration bound to 'p-test'"] } });
}
if (cmd === 'preflight') {
  out([{ gate: 'config', ok: true, detail: 'parses', fix: '' },
    { gate: 'preregistration', ok: false, detail: 'NO', fix: 'nmt-forge prereg template --out predictions.json; edit it; nmt-forge prereg new <id> --eval-set p-test --predictions predictions.json' }], 2);
}
if (cmd === 'prereg' && sub === 'template') {
  out({ format: 'A predictions file is a .json file holding a JSON ARRAY of prediction objects', template: [{ metric: 'chrf++', rationale: 'REPLACE: why' }], path: flag('--out') ?? null });
}
if (cmd === 'prereg' && sub === 'new') {
  out({ error: { type: 'PreregistrationInvalid', guard: 'preregister',
    message: '[preregister] preds.md is Markdown/prose (line 1, column 1: Expecting value)',
    why: 'predictions are checked mechanically against the scores later',
    fix: 'write a JSON array of prediction objects — start from nmt-forge prereg template --out predictions.json and edit it',
    how_to_get: null,
    text: '[preregister] preds.md is Markdown/prose (line 1, column 1: Expecting value)\n  why: predictions are checked mechanically against the scores later\n  fix: write a JSON array of prediction objects — start from nmt-forge prereg template --out predictions.json and edit it' } }, 2);
}
if (cmd === 'export') {
  if (rest[1] === 'missing.json') {
    out({ error: { type: 'ForgeError', guard: null,
      message: "backend 'dummy' produced no model weights to export", why: null, fix: null, how_to_get: null,
      text: "backend 'dummy' produced no model weights to export\n  why: the dummy backend is a test double — there is nothing to deploy\n  fix: train with an HF preset (nmt-forge init <code> --model cpu-tiny), or export the evaluation only with --no-model" } }, 2);
  }
  const dir = flag('--out');
  const noModel = rest.includes('--no-model');
  out({ export_dir: dir, name: 'nmt-forge-r', run: 'r', config_hash: 'abc', evaluated: !rest.includes('--no-eval'),
    model_included: !noModel, forge_model: dir + '/forge-model.json',
    ...(noModel ? {} : { model_dir: dir + '/model', method_manifest: dir + '/method.json', deploy: dir + '/DEPLOY.md',
      serve: 'nmt-forge serve ' + dir }) });
}
if (cmd === 'lint') {
  out(mode === 'lint-findings'
    ? [{ rule: 'vocab-gap', lever: 'VOCABULARY', group: 'clinic', severity: 'high', evidence: {}, recommendation: 'grow the dictionary' },
      { rule: 'wide-ci', lever: 'MEASUREMENT', group: null, severity: 'info', evidence: {}, recommendation: 'more test rows' }]
    : []);
}
if (cmd === 'split' && (mode === 'split-twins' || mode === 'split-chained')) {
  const chained = mode === 'split-chained';
  out({ rows: 400, groups: 120, sizes: { train: 360, dev: 20, test: 20 }, paths: {}, registered: [],
    near_twin: { test: { near_twin_rows: 14, message: '14 of 20 test rows have a near-twin in training',
      advice: chained
        ? 'the templates chain into one share-group (82% of rows): --near-dupe cannot separate them — write test sentences independently, or --near-dupe 0.6 --max-group 50'
        : 're-split with --near-dupe 0.6 --allow-rotate' } },
    dev_near_twin: null,
    near_dupe_carve_check: chained ? { chained: true, message: 'templates chain' } : null });
}
if (cmd === 'compare' && mode === 'compare-recall') {
  out({ n: 50, labels: [flag('--label-a') || 'A', flag('--label-b') || 'B'],
    results: { 'chrf++': { score_a: 41.2, score_b: 88.0, delta: -46.8, ci_lower: -52.1, ci_upper: -41.0,
      p_value: 0.001, significant: true, winner: flag('--label-b') || 'B' } },
    eval_set: flag('--eval-set'), plugin_aggregates: {}, notes: {},
    near_twin: { [flag('--label-a') || 'A']: { checked: true, n: 50, near_twin_rows: 0, recall_not_translation: false },
      [flag('--label-b') || 'B']: { checked: true, n: 50, near_twin_rows: 50, recall_not_translation: true } },
    caveats: ['⚠ B: 50 of 50 test rows (100%) have a near-twin in B\'s training data — its score measures recall of training phrases, not translation',
      '⚠ winner=B on chrf++ is NOT evidence that B translates better'] });
}
if (cmd === 'leak-audit' && mode === 'companion') {
  out({ verdict: { severity: 'clean', summary: 'Dropped 3 leaking row(s) and 40 near-twin row(s).', fix: null, decision: 'choose' },
    companion_config: { written: true, path: '/p/config-notwins.json', run_name: 'crk-nmt-cpu-tiny-notwins',
      gold: 'corpus.notwins.jsonl', dev: 'project-dev', dev_registered: true,
      next: 'nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json',
      note: 'the twin-free model is judged against its OWN preregistration' },
    preregistration_needed: ['project-test'] });
}
if (cmd === 'init') {
  out({ language: { code: rest[1], name: flag('--name') || 'Plains Cree', card: 'public card index' },
    project: flag('--dir') || '.', config: (flag('--dir') || '.') + '/config.json', next_steps: 'NEXT_STEPS.md',
    workspace: (flag('--dir') || '.') + '/.forge', model_preset: flag('--model') || 'cpu-tiny',
    model: { backend: 'hf-scratch', base: null, needs: 'a CPU', expect: 'weak by design' },
    referee_plugins: [], analyzers: [], note: null });
}
out({ ok: true, cmd, argv: rest });
`;

let TMP;
let STUB_PATH;
let LOG;
let client;
const SAVED = {};

function logged() {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function lastCall() {
  const calls = logged().filter((c) => c && c.argv);
  return calls[calls.length - 1];
}
async function call(name, args) {
  writeFileSync(LOG, '');
  const res = await client.callTool({ name, arguments: args });
  return { res, text: res.content.map((c) => c.text).join('\n'), call: lastCall() };
}

before(async () => {
  if (!POSIX) return;
  TMP = mkdtempSync(join(tmpdir(), 'forge-json-'));
  STUB_PATH = join(TMP, 'nmt-forge');
  LOG = join(TMP, 'calls.log');
  const shebang = /\s/.test(process.execPath) ? '#!/usr/bin/env node' : `#!${process.execPath}`;
  writeFileSync(STUB_PATH, `${shebang}\n(function main() {${STUB}\n})();\n`);
  chmodSync(STUB_PATH, 0o755);
  for (const k of ['NMT_FORGE_BIN', 'FAKE_FORGE_LOG', 'FAKE_FORGE_MODE', 'CHAMPOLLION_FORGE_WORKSPACE']) SAVED[k] = process.env[k];
  process.env.NMT_FORGE_BIN = STUB_PATH;
  process.env.FAKE_FORGE_LOG = LOG;
  delete process.env.FAKE_FORGE_MODE;
  delete process.env.CHAMPOLLION_FORGE_WORKSPACE;

  const server = await createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  client = new Client({ name: 'forge-json-test', version: '0.0.0' });
  await client.connect(clientT);
});

after(async () => {
  await client?.close();
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  if (TMP) rmSync(TMP, { recursive: true, force: true });
});

describe('every forge tool speaks --json', { skip: !POSIX && 'POSIX stub' }, () => {
  it('each forge_* tool sends --json after its subcommand and returns a parsed result', async () => {
    const { tools } = await client.listTools();
    const forge = tools.filter((t) => t.name.startsWith('forge_')).map((t) => t.name);
    const args = {
      forge_status: {}, forge_preflight: { target: 'run' }, forge_discover: { code: 'crk' },
      forge_init: { code: 'crk' }, forge_split: { corpus: 'c.tsv', test: 0, seed: 7, out: 'split' },
      forge_leak_audit: { corpus: 'c.jsonl' }, forge_register_eval: { name: 't', path: 't.tsv', role: 'test' },
      forge_prereg_template: {}, forge_prereg: { id: 'p1', eval_set: 't', predictions: 'p.json' },
      forge_prereg_verdict: { id: 'p1', prediction: 2, verdict: 'missed', by: 'Nurse lead', note: 'saw 100' },
      forge_evaluate: { run_manifest: 'm.json' }, forge_export: { run_manifest: 'm.json', out: 'exp' },
      forge_lint: { manifest: 'b.json' }, forge_report: { manifest: 'b.json' },
      forge_compare: { eval_set: 't', hyps_a: 'a.jsonl', hyps_b: 'b.jsonl' },
    };
    assert.deepEqual(forge.filter((n) => !args[n]), [], 'a forge tool without a case here');
    for (const name of forge) {
      const { res, text, call: c } = await call(name, args[name]);
      assert.ok(c, `${name} never launched forge`);
      assert.equal(c.argv.at(-1), '--json', `${name} did not pass --json last: ${c.argv.join(' ')}`);
      assert.deepEqual(c.argv.slice(0, 2), ['--workspace', '.forge'], `${name}: global flags first`);
      if (name === 'forge_prereg') continue; // the stub refuses it (tested below)
      assert.notEqual(res.isError, true, `${name}: ${text}`);
      assert.ok(JSON.parse(res.content[0].text).result !== undefined, `${name} returned no result`);
    }
  });

  it('forge_status relays the state and maps next_command to tools', async () => {
    const { res } = await call('forge_status', {});
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.result.advice.state, 'missing-preregistration');
    assert.equal(out.summary.state, 'missing-preregistration');
    assert.deepEqual(out.summary.tools, ['forge_prereg_template', 'forge_prereg']);
    // Round 9: the predictions come before any benchmark on the test file
    assert.match(out.next, /BEFORE any run_benchmark/);
    assert.match(out.next, /allow_after_reads is ONLY for predictions that were truly written before/);
  });

  it('forge_status right after forge_init points at forge_split, never at discover/init again (Round 6)', async () => {
    process.env.FAKE_FORGE_MODE = 'initialized';
    try {
      const { res } = await call('forge_status', {});
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.state, 'initialized');
      assert.ok(out.summary.tools.includes('forge_split'), out.summary.tools.join(','));
      assert.ok(out.summary.tools.includes('forge_register_eval'));
      assert.ok(!out.summary.tools.includes('forge_init') && !out.summary.tools.includes('forge_discover'));
      assert.match(out.next, /forge_split/);
      assert.match(out.next, /Never call forge_discover \/ forge_init again/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('forge_status lists EVERY run with its checkpoint, dev score and export, plus the warnings (Round 6)', async () => {
    process.env.FAKE_FORGE_MODE = 'two-runs';
    try {
      const { res } = await call('forge_status', {});
      const out = JSON.parse(res.content[0].text);
      assert.deepEqual(out.summary.runs.map((r) => r.run), ['full', 'strict']);
      assert.deepEqual(out.summary.runs[0], {
        run: 'full', checkpoint: 'ck-full', dev: { metric: 'chrf++', score: 100, ci: [98, 100] },
        dev_saturated: true, exported: ['/p/export/model'],
      });
      assert.deepEqual(out.summary.runs[1].exported, []);
      assert.match(out.summary.warnings[0], /SATURATED/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('forge_prereg_verdict sends the person\'s verdict exactly, as a human verdict (Round 6)', async () => {
    const { res, call: c } = await call('forge_prereg_verdict',
      { id: 'full-run', prediction: 2, verdict: 'missed', by: 'Nurse lead', note: 'predicted 15-60, saw 100' });
    assert.notEqual(res.isError, true, res.content[0].text);
    assert.deepEqual(c.argv.slice(2), ['prereg', 'verdict', 'full-run', '--prediction', '2', '--missed',
      '--by', 'Nurse lead', '--note', 'predicted 15-60, saw 100', '--json']);
    const out = JSON.parse(res.content[0].text);
    assert.deepEqual(out.summary, { prediction: 2, verdict: 'missed', by: 'Nurse lead',
      deploy_updated: ['/p/export/model/DEPLOY.md'] });
    assert.match(out.next, /recorded as theirs/);
    const held = await call('forge_prereg_verdict', { id: 'p', prediction: 'range-1', verdict: 'held', by: 'T', revise: true });
    assert.deepEqual(held.call.argv.slice(2), ['prereg', 'verdict', 'p', '--prediction', 'range-1', '--held',
      '--by', 'T', '--revise', '--json']);
    const noBy = await client.callTool({ name: 'forge_prereg_verdict', arguments: { id: 'p', prediction: 1, verdict: 'held' } });
    assert.equal(noBy.isError, true, 'who judged is required');
  });

  it('forge_status in the new `exported` state says serving is a terminal step', async () => {
    process.env.FAKE_FORGE_MODE = 'exported';
    try {
      const { res } = await call('forge_status', {});
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.state, 'exported');
      assert.deepEqual(out.summary.tools, ['terminal: nmt-forge serve']);
      assert.match(out.next, /nmt-forge serve/);
      assert.match(out.next, /not a tool/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  // nmt-forge reports `training` while a run holds <workspace>/run.lock:
  // the hint must say wait — never offer `nmt-forge run` as the next step.
  it('forge_status in the `training` state says wait, and never to start a run', async () => {
    process.env.FAKE_FORGE_MODE = 'training';
    try {
      const { res } = await call('forge_status', {});
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.state, 'training');
      assert.match(out.next, /in progress — WAIT/);
      assert.match(out.next, /Never start another run/);
      assert.doesNotMatch(out.next, /nmt-forge run/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('forge_preflight: a failing gate (exit 2) is an answer, not a tool error; new targets + config reach forge', async () => {
    const { res, call: c } = await call('forge_preflight', { target: 'export', config: 'proj/config.json' });
    assert.notEqual(res.isError, true, res.content[0].text);
    assert.deepEqual(c.argv.slice(2), ['preflight', 'export', '--config', 'proj/config.json', '--json']);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.exit_code, 2);
    assert.equal(out.summary.passed, false);
    assert.deepEqual(out.summary.failing, ['preregistration']);
    const schema = (await client.listTools()).tools.find((t) => t.name === 'forge_preflight').inputSchema;
    for (const t of ['run', 'evaluate', 'export', 'serve', 'score', 'split', 'prereg', 'leak-audit']) {
      assert.ok(schema.properties.target.enum.includes(t), `preflight target ${t} missing`);
    }
  });

  it('forge_init passes --model / --no-card / --name / --base and points at project_dir', async () => {
    const { res, call: c } = await call('forge_init', {
      code: 'abp', dir: '/tmp/clinic', model: 'cpu-finetune', base: 'Helsinki-NLP/opus-mt-en-tl', no_card: true, name: 'Abellen Ayta',
    });
    assert.deepEqual(c.argv.slice(2), ['init', 'abp', '--dir', '/tmp/clinic', '--model', 'cpu-finetune',
      '--base', 'Helsinki-NLP/opus-mt-en-tl', '--no-card', '--name', 'Abellen Ayta', '--json']);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.result.model_preset, 'cpu-finetune');
    assert.match(out.next, /project_dir: "\/tmp\/clinic"/);
  });

  it('forge_discover / forge_init accept the language as `language` too (code still works)', async () => {
    const d = await call('forge_discover', { language: 'crk' });
    assert.notEqual(d.res.isError, true, d.text);
    assert.deepEqual(d.call.argv.slice(2), ['discover', 'crk', '--json']);
    const i = await call('forge_init', { language: 'abp', dir: '/tmp/clinic' });
    assert.notEqual(i.res.isError, true, i.text);
    assert.deepEqual(i.call.argv.slice(2), ['init', 'abp', '--dir', '/tmp/clinic', '--json']);
    const conflict = await call('forge_init', { code: 'crk', language: 'abp' });
    assert.equal(conflict.res.isError, true);
    assert.match(conflict.text, /`code` \("crk"\) and `language` \("abp"\)/);
    assert.equal(conflict.call, undefined, 'a conflicting call never reaches forge');
  });

  it('forge_split accepts test: 0 (train/dev only)', async () => {
    const { res, call: c } = await call('forge_split', { corpus: 'pairs.tsv', test: 0, dev: 40, seed: 3, out: 'data/split', register: 'project' });
    assert.notEqual(res.isError, true);
    assert.deepEqual(c.argv.slice(2), ['split', 'pairs.tsv', '--test', '0', '--seed', '3', '--out', 'data/split',
      '--dev', '40', '--register', 'project', '--json']);
  });

  it('forge_export / forge_evaluate pass prereg as --prereg (two runs on one test set)', async () => {
    let { call: c } = await call('forge_export', { run_manifest: 'm.json', out: 'exp', prereg: 'full-model' });
    assert.deepEqual(c.argv.slice(c.argv.indexOf('--prereg'), c.argv.indexOf('--prereg') + 2), ['--prereg', 'full-model']);
    ({ call: c } = await call('forge_evaluate', { run_manifest: 'm.json', prereg: 'twin-free' }));
    assert.ok(c.argv.includes('--prereg') && c.argv.includes('twin-free'));
    ({ call: c } = await call('forge_export', { run_manifest: 'm.json', out: 'exp' }));
    assert.ok(!c.argv.includes('--prereg'), 'never chosen for the user');
  });

  it('forge_leak_audit names the audit file forge really writes, and says to read the verdict first', async () => {
    const { tools } = await client.listTools();
    const d = tools.find((t) => t.name === 'forge_leak_audit').description;
    assert.match(d, /clean\.jsonl → clean\.audit\.json/);
    assert.doesNotMatch(d, /<clean_to>\.audit\.json/);
    assert.match(d, /result\.verdict FIRST/);
  });

  it('forge_split / forge_register_eval pass allow_rotate as --allow-rotate; forge_prereg passes allow_after_reads', async () => {
    // Round 5: a refused re-split named a Python argument no MCP tool accepted
    let { call: c } = await call('forge_split', { corpus: 'clean.jsonl', test: 0, dev: 20, seed: 3,
      out: 'data/split', register: 'p', allow_rotate: true });
    assert.equal(c.argv.at(-2), '--allow-rotate');
    ({ call: c } = await call('forge_register_eval', { name: 't', path: 't.tsv', role: 'test', allow_rotate: true }));
    assert.ok(c.argv.includes('--allow-rotate'));
    ({ call: c } = await call('forge_prereg', { id: 'p2', eval_set: 't', predictions: 'p.json', allow_after_reads: true }));
    assert.ok(c.argv.includes('--allow-after-reads'));
    ({ call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 0, seed: 3, out: 'o' }));
    assert.ok(!c.argv.includes('--allow-rotate'), 'never rotates unless asked');
  });

  it('forge_split passes near_dupe as --near-dupe and max_group as --max-group (Round 7)', async () => {
    // forge's own advice names `--near-dupe 0.6`; an MCP-only agent could not apply it
    let { res, call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 20, dev: 20, seed: 3,
      out: 'data/split', register: 'p', allow_rotate: true, near_dupe: 0.6, max_group: 50 });
    assert.notEqual(res.isError, true, res.content[0].text);
    const rest = c.argv.slice(2);
    assert.deepEqual(rest.slice(rest.indexOf('--near-dupe'), rest.indexOf('--near-dupe') + 2), ['--near-dupe', '0.6']);
    assert.deepEqual(rest.slice(rest.indexOf('--max-group'), rest.indexOf('--max-group') + 2), ['--max-group', '50']);
    assert.ok(rest.includes('--allow-rotate'), 'allow_rotate still reaches forge beside them');
    ({ call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 20, seed: 3, out: 'o', near_dupe: 1 }));
    assert.ok(c.argv.includes('--near-dupe') && c.argv.includes('1'), 'the upper bound 1 is allowed');
    assert.ok(!c.argv.includes('--max-group'), 'no cap unless asked');
    ({ call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 20, seed: 3, out: 'o' }));
    assert.ok(!c.argv.includes('--near-dupe') && !c.argv.includes('--max-group'), 'neither unless asked');
  });

  it('forge_split refuses a near_dupe outside (0, 1], a max_group < 2, and max_group without near_dupe', async () => {
    for (const bad of [{ near_dupe: 0 }, { near_dupe: 1.5 }, { near_dupe: -0.2 }, { near_dupe: 0.6, max_group: 1 },
      { near_dupe: 0.6, max_group: 2.5 }]) {
      const { res, call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 20, seed: 3, out: 'o', ...bad });
      assert.equal(res.isError, true, `accepted ${JSON.stringify(bad)}`);
      assert.equal(c, undefined, `${JSON.stringify(bad)} reached forge`);
    }
    const { res, text, call: c } = await call('forge_split', { corpus: 'c.jsonl', test: 20, seed: 3, out: 'o', max_group: 50 });
    assert.equal(res.isError, true);
    assert.match(text, /max_group caps near-duplicate groups, which only exist with near_dupe/);
    assert.equal(c, undefined, 'a cap with nothing to cap never reaches forge');
  });

  it('forge_split relays forge\'s near-twin advice — never an unconditional near_dupe 0.6', async () => {
    process.env.FAKE_FORGE_MODE = 'split-twins';
    try {
      let { res } = await call('forge_split', { corpus: 'c.jsonl', test: 20, dev: 20, seed: 3, out: 'o', register: 'p' });
      let out = JSON.parse(res.content[0].text);
      assert.deepEqual(out.summary, { near_twin_advice: ['re-split with --near-dupe 0.6 --allow-rotate'] });
      assert.match(out.next, /relay summary\.near_twin_advice/);
      assert.match(out.next, /--near-dupe → near_dupe, --max-group → max_group/);
      assert.doesNotMatch(out.next, /chain/);
      process.env.FAKE_FORGE_MODE = 'split-chained';
      ({ res } = await call('forge_split', { corpus: 'c.jsonl', test: 20, dev: 20, seed: 3, out: 'o', register: 'p' }));
      out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.templates_chain, true);
      assert.match(out.next, /templates chain into one group, so a near_dupe carve alone cannot separate them/);
    } finally {
      delete process.env.FAKE_FORGE_MODE;
    }
    const { res } = await call('forge_split', { corpus: 'c.jsonl', test: 20, seed: 3, out: 'o' });
    const plain = JSON.parse(res.content[0].text);
    assert.equal(plain.summary, undefined, 'no advice, no summary');
    assert.match(plain.next, /^forge_status — you now have a dev set/);
  });

  it('forge_prereg passes config_hash as --config-hash — the flag forge\'s own advice names (Round 9)', async () => {
    let { call: c } = await call('forge_prereg', { id: 'notwins', eval_set: 't', predictions: 'p.json',
      config_hash: 'abc123' });
    const rest = c.argv.slice(2);
    assert.deepEqual(rest.slice(rest.indexOf('--config-hash'), rest.indexOf('--config-hash') + 2),
      ['--config-hash', 'abc123']);
    ({ call: c } = await call('forge_prereg', { id: 'p', eval_set: 't', predictions: 'p.json' }));
    assert.ok(!c.argv.includes('--config-hash'), 'never pinned unless asked');
  });

  it('forge_register_eval of a test set says the predictions come next, before any run_benchmark (Round 9)', async () => {
    let { res } = await call('forge_register_eval', { name: 't', path: 't.tsv', role: 'test' });
    let out = JSON.parse(res.content[0].text);
    assert.match(out.next, /before any run_benchmark/);
    assert.match(out.next, /forge_leak_audit/);
    ({ res } = await call('forge_register_eval', { name: 'd', path: 'd.tsv', role: 'dev' }));
    out = JSON.parse(res.content[0].text);
    assert.doesNotMatch(out.next, /run_benchmark/, 'a dev set is read freely');
  });

  it('forge_leak_audit passes companion_config and relays the twin-free model\'s config + the prereg step (Round 9)', async () => {
    let { res, call: c } = await call('forge_leak_audit', { corpus: 'c.jsonl', clean_to: 'c.notwins.jsonl',
      drop_test_twins: true, companion_config: 'cfg-free.json' });
    assert.notEqual(res.isError, true, res.content[0].text);
    const rest = c.argv.slice(2);
    assert.deepEqual(rest.slice(rest.indexOf('--companion-config'), rest.indexOf('--companion-config') + 2),
      ['--companion-config', 'cfg-free.json']);
    ({ res, call: c } = await call('forge_leak_audit', { corpus: 'c.jsonl', companion_config: 'x.json' }));
    assert.equal(res.isError, true);
    assert.equal(c, undefined, 'companion_config without drop_test_twins never reaches forge');
    process.env.FAKE_FORGE_MODE = 'companion';
    try {
      ({ res } = await call('forge_leak_audit', { corpus: 'c.jsonl', clean_to: 'c.notwins.jsonl', drop_test_twins: true }));
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.companion_config.path, '/p/config-notwins.json');
      assert.deepEqual(out.summary.preregistration_needed, ['project-test']);
      assert.match(out.next, /nmt-forge run config-notwins\.json/);
      assert.match(out.next, /BEFORE any run_benchmark/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('forge_compare sends every flag and relays the near-twin caveats with the winner (Round 9)', async () => {
    let { res, call: c } = await call('forge_compare', { eval_set: 'project-test', hyps_a: 'free.jsonl',
      hyps_b: 'all.jsonl', label_a: 'twin-free', label_b: 'all-data', run_a: 'ra.json', run_b: 'rb.json',
      metric: ['chrf++', 'bleu'], target_lang: 'crk', prereg: 'p1' });
    assert.notEqual(res.isError, true, res.content[0].text);
    assert.deepEqual(c.argv.slice(2), ['compare', '--eval-set', 'project-test', '--hyps-a', 'free.jsonl',
      '--hyps-b', 'all.jsonl', '--label-a', 'twin-free', '--label-b', 'all-data', '--run-a', 'ra.json',
      '--run-b', 'rb.json', '--metric', 'chrf++', '--metric', 'bleu', '--target-lang', 'crk',
      '--prereg', 'p1', '--json']);
    process.env.FAKE_FORGE_MODE = 'compare-recall';
    try {
      ({ res } = await call('forge_compare', { eval_set: 'project-test', hyps_a: 'free.jsonl',
        hyps_b: 'all.jsonl', label_a: 'twin-free', label_b: 'all-data' }));
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.results['chrf++'].winner, 'all-data');
      assert.deepEqual(out.summary.recall_not_translation, ['all-data']);
      assert.ok(out.summary.caveats.length >= 2);
      assert.match(out.next, /never the winner alone/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('forge_split\'s schema describes near_dupe and max_group', async () => {
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === 'forge_split');
    assert.match(t.inputSchema.properties.near_dupe.description, /Jaccard/);
    assert.match(t.inputSchema.properties.near_dupe.description, /0\.6/);
    assert.match(t.inputSchema.properties.max_group.description, /Exact-duplicate groups are never capped/);
    assert.match(t.description, /when forge's advice\s+recommends a near-duplicate carve/);
    assert.match(t.description, /SplitSizeRefused/);
  });
});

describe('forge_lint: the hint follows the findings', { skip: !POSIX && 'POSIX stub' }, () => {
  it('no findings → no "act on the highest-severity finding"', async () => {
    const { res } = await call('forge_lint', { manifest: 'b.json' });
    const out = JSON.parse(res.content[0].text);
    assert.deepEqual(out.result, []);
    assert.deepEqual(out.summary, { findings: 0, by_severity: { high: 0, medium: 0, info: 0 } });
    assert.match(out.next, /^no findings/);
    assert.doesNotMatch(out.next, /highest-severity/);
  });

  it('with findings → names the top finding and its lever', async () => {
    process.env.FAKE_FORGE_MODE = 'lint-findings';
    try {
      const { res } = await call('forge_lint', { manifest: 'b.json' });
      const out = JSON.parse(res.content[0].text);
      assert.equal(out.summary.by_severity.high, 1);
      assert.match(out.next, /highest-severity finding: vocab-gap \(high\) → lever VOCABULARY for clinic/);
    } finally {
      delete process.env.FAKE_FORGE_MODE;
    }
  });
});

describe('forge_prereg_template + forge_export (new in 0.2.0)', { skip: !POSIX && 'POSIX stub' }, () => {
  it('forge_prereg_template writes to `out` and hands the edit-then-prereg step', async () => {
    const { res, call: c } = await call('forge_prereg_template', { out: 'predictions.json', force: true });
    assert.deepEqual(c.argv.slice(2), ['prereg', 'template', '--out', 'predictions.json', '--force', '--json']);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.result.path, 'predictions.json');
    assert.match(out.result.format, /JSON ARRAY/);
    assert.match(out.next, /REPLACE/);
    assert.match(out.next, /forge_prereg \{/);
  });

  it('forge_prereg_template without `out` only returns the format and template', async () => {
    const { res, call: c } = await call('forge_prereg_template', {});
    assert.deepEqual(c.argv.slice(2), ['prereg', 'template', '--json']);
    assert.equal(JSON.parse(res.content[0].text).result.path, null);
  });

  it('forge_export passes every flag and says serving is a terminal step', async () => {
    const { res, call: c } = await call('forge_export', {
      run_manifest: 'ws/runs/r/run-manifest.json', out: 'export', config: 'config.json',
      port: 9001, name: 'cree-school', endpoint: 'http://127.0.0.1:9001/translate', force: true,
    });
    assert.deepEqual(c.argv.slice(2), ['export', 'ws/runs/r/run-manifest.json', '--out', 'export',
      '--config', 'config.json', '--endpoint', 'http://127.0.0.1:9001/translate', '--port', '9001',
      '--name', 'cree-school', '--force', '--json']);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.result.model_dir, 'export/model');
    assert.match(out.next, /nmt-forge serve export/);
    assert.match(out.next, /not a tool/);
  });

  it('forge_export with no_model / no_eval: nothing to serve, and it says so', async () => {
    const { res, call: c } = await call('forge_export', { run_manifest: 'm.json', out: 'eval-only', no_model: true, no_eval: true });
    assert.ok(c.argv.includes('--no-model') && c.argv.includes('--no-eval'));
    const out = JSON.parse(res.content[0].text);
    assert.match(out.next, /nothing to serve/);
  });

  it('forge_export refusal (a plain ForgeError with inline why/fix) comes back as what/why/fix', async () => {
    const { res, text } = await call('forge_export', { run_manifest: 'missing.json', out: 'x' });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /^forge refused \(ForgeError, exit 2\): nmt-forge --workspace \.forge export missing\.json/);
    assert.match(res.content[0].text, /what: backend 'dummy' produced no model weights/);
    assert.match(res.content[0].text, /why: the dummy backend is a test double/);
    assert.match(res.content[0].text, /fix: train with an HF preset/);
    assert.match(res.content[0].text, /as tools: forge_init/);
    const envelope = JSON.parse(res.content[1].text);
    assert.equal(envelope.error.type, 'ForgeError');
    assert.equal(envelope.exit_code, 2);
    assert.doesNotMatch(text, /Traceback/);
  });
});

describe('the error envelope and the other failure shapes', { skip: !POSIX && 'POSIX stub' }, () => {
  it('a guard refusal relays type, guard, what, why and fix once each, plus the envelope', async () => {
    const { res } = await call('forge_prereg', { id: 'p1', eval_set: 'p-test', predictions: 'preds.md' });
    assert.equal(res.isError, true);
    const text = res.content[0].text;
    assert.match(text, /^forge refused \(PreregistrationInvalid, guard: preregister, exit 2\)/);
    assert.match(text, /\nwhat: \[preregister\] preds\.md is Markdown\/prose/);
    assert.equal(text.match(/why: /g).length, 1, 'why rendered twice');
    assert.equal(text.match(/fix: /g).length, 1, 'fix rendered twice');
    assert.match(text, /as tools: forge_prereg_template/);
    assert.equal(JSON.parse(res.content[1].text).error.guard, 'preregister');
  });

  it('an nmt-forge older than 0.2.0 (no --json on the subcommand) says to upgrade', async () => {
    process.env.FAKE_FORGE_MODE = 'old-forge';
    try {
      const { res, text } = await call('forge_init', { code: 'crk' });
      assert.equal(res.isError, true);
      assert.match(text, /predates 0\.2\.0/);
      assert.match(text, /pip install -U nmt-forge/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('a forge that answers in text instead of JSON is an error naming the upgrade, with what it printed', async () => {
    process.env.FAKE_FORGE_MODE = 'text';
    try {
      const { res, text } = await call('forge_init', { code: 'crk' });
      assert.equal(res.isError, true);
      assert.match(text, /answered in text, not JSON/);
      assert.match(text, /initialized proj for Plains Cree/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('a crash is summarized by its last message — never a traceback dump', async () => {
    process.env.FAKE_FORGE_MODE = 'crash';
    try {
      const { res, text } = await call('forge_status', {});
      assert.equal(res.isError, true);
      assert.match(text, /forge failed \(exit 1\) without an answer/);
      assert.match(text, /RuntimeError: decoder state went sideways/);
      assert.doesNotMatch(text, /Traceback|File "cli\.py"/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('a known cold-start failure maps to its fix', async () => {
    process.env.FAKE_FORGE_MODE = 'no-harness';
    try {
      const { res, text } = await call('forge_status', {});
      assert.equal(res.isError, true);
      assert.match(text, /pip install mt-eval-harness/);
      assert.doesNotMatch(text, /Traceback/);
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });

  it('past its bound forge gets SIGINT (so its cleanup runs) and the tool names the terminal command', async () => {
    process.env.FAKE_FORGE_MODE = 'hang';
    writeFileSync(LOG, '');
    try {
      const res = await forgeTool(['export', 'm.json', '--out', 'exp'], { timeout: 400 });
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /did not finish within 400 ms and was stopped: nmt-forge --workspace \.forge export m\.json --out exp --json/);
      assert.match(res.content[0].text, /terminal/);
      assert.ok(logged().includes('SIGINT-cleanup'), 'forge was not given SIGINT');
    } finally { delete process.env.FAKE_FORGE_MODE; }
  });
});

describe('project_dir — forge runs where its config lives', { skip: !POSIX && 'POSIX stub' }, () => {
  it('runs forge from project_dir', async () => {
    const proj = join(TMP, 'proj');
    mkdirSync(proj, { recursive: true });
    const { call: c } = await call('forge_status', { project_dir: proj });
    assert.equal(c.cwd, realpathSync(proj));
  });

  it('a project_dir that does not exist is an actionable error, and forge is never launched', async () => {
    const { res, call: c } = await call('forge_status', { project_dir: join(TMP, 'nope') });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /is not a directory/);
    assert.match(res.content[0].text, /forge_init/);
    assert.equal(c, undefined);
  });

  it('buildForgeInvocation sets cwd from projectDir and keeps a relative forge dir absolute', () => {
    const inv = buildForgeInvocation(['status', '--json'], {
      projectDir: '/srv/proj', launcher: { kind: 'dir', dir: 'rel/forge', python: 'python3' },
    });
    assert.equal(inv.cwd, '/srv/proj');
    assert.ok(inv.env.PYTHONPATH.startsWith('/'), inv.env.PYTHONPATH);
  });
});

describe('pure helpers', () => {
  it('forgeToolsIn maps forge commands to tools, in order, terminal steps labelled', () => {
    assert.deepEqual(forgeToolsIn('nmt-forge discover <iso639-3>   # then: nmt-forge init <iso639-3>; '
      + 'or: nmt-forge split <corpus.jsonl> --dev <N>'), ['forge_discover', 'forge_init', 'forge_split']);
    assert.deepEqual(forgeToolsIn('nmt-forge preflight run --config config.json && nmt-forge run config.json'),
      ['forge_preflight', 'terminal: nmt-forge run']);
    assert.deepEqual(forgeToolsIn('nmt-forge export runs/x/run-manifest.json --out export/'), ['forge_export']);
    assert.deepEqual(forgeToolsIn('nmt-forge registry add t f --role test; nmt-forge ledger show --set t'),
      ['forge_register_eval', 'terminal: nmt-forge ledger']);
    assert.deepEqual(forgeToolsIn('upgrade: `pip install -U nmt-forge`'), []);
    assert.deepEqual(forgeToolsIn(null), []);
  });

  it('formatForgeError keeps a usage error\'s inline fix and adds no empty fields', () => {
    const text = formatForgeError({
      type: 'UsageError', guard: null,
      message: "nmt-forge init: argument --model: invalid choice: 'big' (choose from cpu-finetune, cpu-tiny, nllb-600m)",
      why: null, fix: null, how_to_get: null,
      text: "nmt-forge init: argument --model: invalid choice: 'big' (choose from cpu-finetune, cpu-tiny, nllb-600m)\n  fix: nmt-forge init --help",
    }, { exitCode: 2 });
    assert.match(text, /^forge refused \(UsageError, exit 2\)/);
    assert.match(text, /choose from cpu-finetune, cpu-tiny, nllb-600m/);
    assert.match(text, /fix: nmt-forge init --help/);
    assert.doesNotMatch(text, /why: |null/);
    assert.doesNotMatch(text, /as tools/, 'a --help pointer is not a step to run');
  });

  it('formatForgeError renders how_to_get for a missing resource once', () => {
    const text = formatForgeError({
      type: 'ResourceMissing', guard: null, message: 'no card for xyz', why: null, fix: null,
      how_to_get: 'champollion network card xyz --json > cards/xyz.json',
      text: 'no card for xyz\n  how to get it: champollion network card xyz --json > cards/xyz.json',
    });
    assert.equal(text.match(/how to get it: /g).length, 1);
  });

  it('forgeCommandLine is copy-pasteable', () => {
    assert.equal(forgeCommandLine(['init', 'abp', '--name', 'Abellen Ayta', '--json'], '/w s'),
      "nmt-forge --workspace '/w s' init abp --name 'Abellen Ayta' --json");
  });
});
