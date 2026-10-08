/**
 * Novice-agent loop, driven entirely through the forge_* MCP tools against
 * the REAL nmt-forge (≥ 0.2.0, --json everywhere).
 *
 * The Python suite proves the loop against the library; this proves the MCP
 * TOOLS relay it faithfully: an agent that can only call the forge_* tools
 * (plus the one terminal step, `nmt-forge run`) goes from an empty project
 * directory to a scored, exported battery, using only each tool's JSON output
 * to decide the next call — with every path relative to `project_dir`, the
 * way forge's own `cd <project> && nmt-forge …` advice works.
 *
 * Requires python3 + the forge package reachable (as configured for the real
 * server). If the first status call can't launch forge, the whole suite skips
 * — this test asserts wiring, not that Python is installed in CI. The stubbed
 * contract (every failure shape, every flag) lives in forge-json.test.js.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { forgeTool, runForge, relayCaveats, majorCaveats } from '../src/tools/forge.js';

describe('forge_* novice loop (MCP surface, real forge)', () => {
  let dir;
  let client;
  let reachable = false;

  /** Call a tool; returns {res, out} with `out` the parsed JSON on success. */
  async function tool(name, args) {
    const res = await client.callTool({ name, arguments: { project_dir: dir, ...args } });
    let out = null;
    if (!res.isError) out = JSON.parse(res.content[0].text);
    return { res, out, text: res.content.map((c) => c.text).join('\n') };
  }

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-loop-'));
    const probe = await forgeTool(['status'], { projectDir: dir });
    reachable = !probe.isError;
    if (!reachable) return;
    const server = await createServer();
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    client = new Client({ name: 'forge-loop', version: '0.0.0' });
    await client.connect(clientT);
  });

  after(async () => {
    await client?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('drives an empty project → scored + exported battery through the tools', async (t) => {
    if (!reachable) { t.skip('forge CLI not launchable in this environment'); return; }

    writeFileSync(join(dir, 'corpus.jsonl'), Array.from({ length: 20 }, (_, i) => JSON.stringify({
      id: `r${i}`, register: i % 2 ? 'textbook' : 'government',
      source: `the wug ${i} runs across the field today`,
      target: `wugto${i} blar nem pel sun${i}`,
    })).join('\n') + '\n');

    // 1. forge_status — empty workspace; the advice maps onto tools
    let { out } = await tool('forge_status', {});
    assert.equal(out.result.advice.state, 'empty-workspace');
    assert.ok(out.summary.tools.includes('forge_discover'), JSON.stringify(out.summary));

    // 2. forge_split (with register) — the corpus-in-hand path; RELATIVE paths
    let r = await tool('forge_split', {
      corpus: 'corpus.jsonl', test: 6, dev: 6, seed: 7, out: 'splits', register: 'mypair',
    });
    assert.notEqual(r.res.isError, true, r.text);
    assert.deepEqual(r.out.result.registered.map((x) => x.role).sort(), ['dev', 'test']);
    assert.ok(existsSync(join(dir, 'splits', 'train.jsonl')), 'split did not run from project_dir');

    // 3. forge_status — a test set without a preregistration
    ({ out } = await tool('forge_status', {}));
    assert.equal(out.result.advice.state, 'missing-preregistration');
    assert.deepEqual(out.summary.tools, ['forge_prereg_template', 'forge_prereg']);
    const testName = out.result.snapshot.roles.test[0];

    // 4. forge_prereg_template — the one format, written to edit
    r = await tool('forge_prereg_template', { out: 'predictions.json' });
    assert.notEqual(r.res.isError, true, r.text);
    assert.equal(r.out.result.path, 'predictions.json');
    assert.ok(existsSync(join(dir, 'predictions.json')));

    // 5. forge_prereg on the UNEDITED template — a guard refusal, relayed as what/why/fix
    r = await tool('forge_prereg', { id: 'p0', eval_set: testName, predictions: 'predictions.json' });
    assert.equal(r.res.isError, true, 'unedited REPLACE placeholders must be refused');
    assert.match(r.res.content[0].text, /^forge refused \(PreregistrationInvalid/);
    assert.match(r.res.content[0].text, /REPLACE/);
    assert.doesNotMatch(r.text, /Traceback/);

    // 6. forge_prereg with real expectations
    writeFileSync(join(dir, 'preds.json'), JSON.stringify(
      [{ metric: 'chrf++', expect: 'between 5 and 30', rationale: 'tiny synthetic corpus' }]));
    r = await tool('forge_prereg', { id: 'p1', eval_set: testName, predictions: 'preds.json' });
    assert.notEqual(r.res.isError, true, r.text);
    assert.equal(r.out.result.id, 'p1');

    // 7. forge_status — ready to train; training is the terminal step
    ({ out } = await tool('forge_status', {}));
    assert.equal(out.result.advice.state, 'ready-to-train');
    assert.deepEqual(out.summary.tools, ['forge_preflight', 'terminal: nmt-forge run']);

    // config.json the way `nmt-forge init` writes it: paths relative to the project
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      run_name: 'sim', workspace: '.forge', language: { target: 'crk' },
      data: { gold: ['splits/train.jsonl'], dev: 'mypair-dev' },
      model: { backend: 'dummy' }, selection: { metric: 'loss' },
      decode: { max_new_tokens: 32 },
      eval: { battery: testName, by: 'register', n_bootstrap: 30 },
    }));

    // 8. forge_preflight run — every gate as an answer
    r = await tool('forge_preflight', { target: 'run', config: 'config.json' });
    assert.notEqual(r.res.isError, true, r.text);
    assert.ok(Array.isArray(r.out.result));
    assert.equal(typeof r.out.summary.passed, 'boolean');
    const wsGate = r.out.result.find((g) => g.gate === 'workspace-match');
    assert.equal(wsGate?.ok, true, 'config.workspace resolved against project_dir');

    // 9. the terminal step, from the project directory
    const runRes = await runForge(['run', 'config.json', '--json'], { projectDir: dir, timeout: 120_000 });
    assert.equal(runRes.code, 0, runRes.stderr);

    // 10. forge_status — ready to score; the advice is export (score + package)
    ({ out } = await tool('forge_status', {}));
    assert.equal(out.result.advice.state, 'ready-to-score');
    assert.ok(out.summary.tools.includes('forge_export'), JSON.stringify(out.summary));
    const manifest = out.result.snapshot.runs.at(-1).manifest;

    // 11. forge_evaluate — the score-only half
    r = await tool('forge_evaluate', { run_manifest: manifest, config: 'config.json' });
    assert.notEqual(r.res.isError, true, r.text);
    assert.deepEqual(Object.keys(r.out.result.battery.groups).sort(), ['government', 'textbook']);

    // 12. forge_export — the dummy backend has no weights: the refusal says so …
    r = await tool('forge_export', { run_manifest: manifest, out: 'export' });
    assert.equal(r.res.isError, true);
    assert.match(r.res.content[0].text, /no model weights/);
    assert.match(r.res.content[0].text, /--no-model/);
    assert.ok(!existsSync(join(dir, 'export')), 'a refused export must leave no directory');

    // … and an evaluation-only export goes through
    r = await tool('forge_export', { run_manifest: manifest, out: 'export', no_model: true });
    assert.notEqual(r.res.isError, true, r.text);
    assert.equal(r.out.result.evaluated, true);
    assert.equal(r.out.result.model_included, false);
    assert.match(r.out.next, /nothing to serve/);
    // Round 13: what the real forge emits reaches the summary as it came —
    // the hypotheses file forge_compare takes, and mt-eval's score_caveats
    // verbatim (none → nothing said); a MAJOR one leads the next step.
    if (r.out.result.hypotheses) assert.equal(r.out.summary.hypotheses, r.out.result.hypotheses);
    assert.deepEqual(r.out.summary.score_caveats ?? null, relayCaveats(r.out.result.score_caveats));
    assert.equal(/^First relay summary\.score_caveats/.test(r.out.next),
      majorCaveats(r.out.result.score_caveats).length > 0, r.out.next);

    // 13. forge_status — an evaluation-only export is NOT servable, so the
    // advice stays "export (with the model)"; it never says "serve it".
    ({ out } = await tool('forge_status', {}));
    assert.equal(out.result.advice.state, 'ready-to-score');

    // 14. forge_preflight serve — answered as gates; the export-dir gate
    // fails because no export carries a model.
    r = await tool('forge_preflight', { target: 'serve' });
    assert.notEqual(r.res.isError, true, r.text);
    const exportGate = r.out.result.find((g) => g.gate === 'export-dir');
    assert.ok(exportGate, JSON.stringify(r.out.result));
    assert.equal(exportGate.ok, false);
  });
});
