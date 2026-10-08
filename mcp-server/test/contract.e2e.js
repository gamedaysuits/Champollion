/**
 * CONTRACT SUITE — the server as a stranger installs it.
 *
 *   npm run test:contract      (opt-in; needs network for the anon reads)
 *
 * Unit tests run against the monorepo checkout, where every lookup hits the
 * full card corpus, the in-repo registry and the sibling forge/ — exactly the
 * paths a real user never has. Synthetic-user testing found the gaps there.
 * This suite closes that loop:
 *
 *   1. `npm pack` this server and the local CLI (the CLI with --ignore-scripts:
 *      its prepack regenerates tracked files other work depends on, and this
 *      suite tests the MCP server, not the CLI build);
 *   2. install both tarballs into a fresh temp prefix — no monorepo above it;
 *   3. spawn the INSTALLED server over stdio with the MCP SDK client, in a
 *      SCRUBBED environment: no API keys, a temp HOME (empty card cache, no
 *      cached sign-in), so nothing can spend money or publish;
 *   4. list the tools and call EVERY one with realistic arguments.
 *
 * Each call must return a non-error result, or an error that names an
 * actionable prerequisite (a missing key, a missing install, a refusal with
 * what IS allowed). Never a stack trace, never "[object Object]", never more
 * than 60 seconds. A tool the suite has no case for FAILS the suite — adding a
 * tool means adding its contract here.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MCP_DIR = resolve(__dirname, '..');
const CLI_DIR = resolve(MCP_DIR, '../cli');
const CALL_LIMIT_MS = 60_000;

/** An error is acceptable only when it tells the agent what to do next. */
const ACTIONABLE = new RegExp([
  'install', 'pip ', 'npm ', 'pipx', '_API_KEY', 'API key', 'needs [A-Z_]+',
  'set [A-Z_]+', 'export ', 'not found', 'no .*(card|contest|run card|queue item)',
  'search_languages', 'list_contests', 'get_results', 'list_queue', 'retry',
  'offline', 'REFUSED', 'unavailable', 'forge refused', 'Closest names',
].join('|'), 'i');
const STACK = /\n\s+at .+\(?.*:\d+:\d+\)?|Traceback \(most recent call last\)|TypeError:|ReferenceError:/;

let TMP;
let client;
let tools = [];
const ledger = [];

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 });
}

before(async () => {
  if (!existsSync(join(CLI_DIR, 'package.json'))) return; // skipped in the tests below
  TMP = mkdtempSync(join(tmpdir(), 'mcp-contract-'));
  const pk = join(TMP, 'pk');
  const prefix = join(TMP, 'prefix');
  const home = join(TMP, 'home');
  const work = join(TMP, 'work');
  for (const d of [pk, prefix, home, work]) mkdirSync(d, { recursive: true });

  sh('npm', ['pack', '--ignore-scripts', '--pack-destination', pk], CLI_DIR);
  sh('npm', ['pack', '--pack-destination', pk], MCP_DIR);
  const tgz = readdirSync(pk).filter((f) => f.endsWith('.tgz')).map((f) => join(pk, f));
  writeFileSync(join(prefix, 'package.json'), JSON.stringify({ name: 'contract', version: '1.0.0', private: true }));
  sh('npm', ['install', '--no-audit', '--no-fund', ...tgz], prefix);

  // Fixtures a user would hold.
  const corpus = join(work, 'school-test.jsonl');
  writeFileSync(corpus, ['hello', 'thank you', 'good morning', 'see you', 'my friend', 'the dog']
    .map((s, i) => JSON.stringify({ id: `r${i}`, source: s, reference: `ref ${i}` })).join('\n') + '\n');
  const sealed = join(work, 'community-test.jsonl');
  writeFileSync(sealed, '{"source":"hello","reference":"tânisi"}\n');
  writeFileSync(`${sealed}.champollion.json`, JSON.stringify({ transmission: 'local-only' }));
  writeFileSync(join(work, 'preds.json'), JSON.stringify([{ metric: 'chrf++', expect: '>20', rationale: 'baseline' }]));

  // A scrubbed environment: PATH only (so mt-eval / python are findable), a
  // temp HOME, no keys, no Supabase overrides.
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: TMP,
    CHAMPOLLION_MCP_DEBUG_LOG: join(TMP, 'debug.log'),
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(prefix, 'node_modules', 'champollion-mcp-server', 'bin', 'server.js')],
    env,
    cwd: work,
    stderr: 'pipe',
  });
  client = new Client({ name: 'contract-suite', version: '0.0.0' });
  await client.connect(transport);
  tools = (await client.listTools()).tools;
  globalThis.__contract = { work, corpus, sealed };
});

after(async () => {
  await client?.close().catch(() => {});
  if (ledger.length) {
    console.log('\nCONTRACT LEDGER (tool · ms · outcome · first line)');
    for (const r of ledger) console.log(`  ${r.tool.padEnd(24)} ${String(r.ms).padStart(6)}ms  ${r.outcome.padEnd(11)} ${r.head}`);
  }
  if (TMP) rmSync(TMP, { recursive: true, force: true });
});

/** Realistic arguments per tool; extra scenario calls ride along. */
function cases() {
  const { work, corpus, sealed } = globalThis.__contract;
  const ws = join(work, '.forge');
  return {
    search_languages: [{ query: 'Atya' }, { query: 'Cree' }],
    get_language: [{ code: 'abp' }, { code: 'crk' }],
    language_overview: [{ code: 'crk' }],
    list_corpora: [{ target_language: 'yor', limit: 3 }],
    get_results: [{ target_language: 'yor', limit: 3 }],
    get_run_card: [{ id: 'no-such-run-id' }],
    get_metric_reliability: [{ target: 'yor' }, { language: 'crk' }],
    list_contests: [{}],
    get_contest: [{ id: 'no-such-contest' }],
    get_project_info: [{}],
    list_queue: [{ limit: 3 }],
    get_queue_item: [{ priority: 1 }],
    estimate_cost: [{ budget: 1 }],
    translate: [{ texts: ['Hello'], source_language: 'en', target_language: 'fr' }],
    get_training_guardrails: [{ topic: 'split' }],
    run_benchmark: [
      { corpus, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree', dry_run: true },
      { budget: 1 },
      { corpus: sealed, model: 'openai/gpt-5.5' },
    ],
    get_run_status: [{}],
    // a report that does not exist: "not found" (or, without the harness, its install line) — never a publish
    preview_publish: [{ report: join(work, 'no-such-run_report.json') }],
    publish_report: [{ report: join(work, 'no-such-run_report.json') }],
    forge_status: [{ workspace: ws }],
    forge_preflight: [{ target: 'run', workspace: ws }, { target: 'serve', workspace: ws, project_dir: work }],
    forge_discover: [{ code: 'crk', workspace: ws }],
    forge_init: [{ code: 'crk', dir: join(work, 'proj') }, { code: 'crk', dir: join(work, 'proj2'), model: 'no-such-preset' }],
    forge_split: [{ corpus, test: 2, dev: 2, seed: 7, out: join(work, 'splits'), workspace: ws }],
    forge_leak_audit: [{ corpus, workspace: ws }],
    forge_register_eval: [{ name: 'school-dev', path: corpus, role: 'dev', workspace: ws }],
    forge_prereg_template: [{ out: join(work, 'predictions.json') }, {}],
    forge_prereg: [{ id: 'p1', eval_set: 'school-test', predictions: join(work, 'preds.json'), workspace: ws }],
    // a prereg that does not exist: an actionable refusal, never a recorded verdict
    forge_prereg_verdict: [{ id: 'no-such-prereg', prediction: '1', verdict: 'held', by: 'contract test', workspace: ws }],
    forge_evaluate: [{ run_manifest: join(work, 'missing-run-manifest.json'), workspace: ws }],
    forge_export: [{ run_manifest: join(work, 'missing-run-manifest.json'), out: join(work, 'export'), workspace: ws }],
    forge_lint: [{ manifest: join(work, 'missing-battery.json'), workspace: ws }],
    forge_report: [{ manifest: join(work, 'missing-battery.json'), workspace: ws }],
  };
}

async function call(name, args) {
  const t0 = Date.now();
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: CALL_LIMIT_MS + 5_000 });
  const ms = Date.now() - t0;
  const text = (res.content || []).map((c) => c.text ?? '').join('\n');
  ledger.push({ tool: name, ms, outcome: res.isError ? 'error' : 'ok', head: text.split('\n')[0].slice(0, 90) });
  return { res, text, ms };
}

describe('contract: the installed server, every tool', () => {
  it('installs and lists tools from a clean prefix', (t) => {
    if (!client) { t.skip('no sibling ../cli checkout to pack — contract needs the monorepo'); return; }
    assert.ok(tools.length >= 28, `only ${tools.length} tools listed`);
  });

  it('every listed tool has a contract case (adding a tool means adding its contract)', (t) => {
    if (!client) { t.skip('no checkout'); return; }
    const c = cases();
    const missing = tools.map((x) => x.name).filter((n) => !c[n]);
    assert.deepEqual(missing, []);
  });

  it('every tool answers: ok, or an actionable error — no traces, no [object Object], < 60s', async (t) => {
    if (!client) { t.skip('no checkout'); return; }
    const failures = [];
    for (const [name, argList] of Object.entries(cases())) {
      if (!tools.some((x) => x.name === name)) { failures.push(`${name}: case exists but the tool is not served`); continue; }
      for (const args of argList) {
        let out;
        try {
          out = await call(name, args);
        } catch (err) {
          failures.push(`${name}(${JSON.stringify(args).slice(0, 80)}): call failed — ${err.message}`);
          continue;
        }
        const { res, text, ms } = out;
        if (ms > CALL_LIMIT_MS) failures.push(`${name}: took ${ms}ms`);
        if (/\[object Object\]/.test(text)) failures.push(`${name}: "[object Object]" in output`);
        if (STACK.test(text)) failures.push(`${name}: stack trace in output: ${text.match(STACK)[0].slice(0, 120)}`);
        if (!text.trim()) failures.push(`${name}: empty output`);
        if (res.isError && !ACTIONABLE.test(text)) {
          failures.push(`${name}: error without an actionable prerequisite: ${text.slice(0, 200)}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  it('the north-star answers are the right ones', async (t) => {
    if (!client) { t.skip('no checkout'); return; }
    const atya = await call('search_languages', { query: 'Atya' });
    assert.match(atya.text, /Ayta/);
    const abp = await call('get_language', { code: 'abp' });
    assert.notEqual(abp.res.isError, true, abp.text);
    assert.match(abp.text, /Abellen Ayta/);
    assert.match(abp.text, /\[elcat-v2024\.1\]|\[linguameta/, 'speaker claims carry their sources');
    assert.doesNotMatch(abp.text, /speakers: unknown/);
    const plan = await call('run_benchmark', { corpus: globalThis.__contract.corpus, provider: 'local', model: 'llama3.1', dry_run: true });
    if (!/not installed/.test(plan.text)) {
      assert.match(plan.text, /nothing is published/);
      assert.match(plan.text, /ON THIS MACHINE/);
    }
    const sealed = await call('run_benchmark', { corpus: globalThis.__contract.sealed, model: 'openai/gpt-5.5', confirm: true });
    if (!/not installed/.test(sealed.text)) assert.match(sealed.text, /LOCAL-ONLY/);
    const forge = await call('forge_status', { workspace: join(globalThis.__contract.work, '.forge') });
    if (forge.res.isError) {
      assert.match(forge.text, /pip install nmt-forge/);
      assert.doesNotMatch(forge.text, /not on PyPI/);
    }
  });
});
