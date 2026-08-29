/**
 * Novice-agent loop, driven entirely through the forge_* MCP surface.
 *
 * The Python suite proves the loop against the library; this proves the MCP
 * TOOLS relay it faithfully: an agent that can only call forge_status,
 * forge_split, forge_prereg, (terminal) run, and forge_evaluate goes from an
 * empty workspace to a scored battery, using only each tool's JSON output to
 * decide the next call.
 *
 * Requires python3 + the forge package reachable (as configured for the real
 * server). If the first status call can't launch forge, the whole suite skips
 * — this test asserts wiring, not that Python is installed in CI.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { forgeTool, runForge } from '../src/tools/forge.js';

function parse(res) {
  return JSON.parse(res.content[0].text);
}

describe('forge_* novice loop (MCP surface)', () => {
  let ws;
  let reachable = false;

  before(async () => {
    ws = mkdtempSync(join(tmpdir(), 'forge-loop-'));
    const res = await forgeTool(['status', '--json'], { workspace: ws });
    reachable = !res.isError;
  });

  it('drives empty workspace → scored battery through the tools', async (t) => {
    if (!reachable) { t.skip('forge CLI not launchable in this environment'); return; }

    const dir = mkdtempSync(join(tmpdir(), 'forge-loop-data-'));
    const corpus = join(dir, 'corpus.jsonl');
    writeFileSync(corpus, Array.from({ length: 20 }, (_, i) => JSON.stringify({
      id: `r${i}`, register: i % 2 ? 'textbook' : 'government',
      source: `the wug ${i} runs across the field today`,
      target: `wugto${i} blar nem pel sun${i}`,
    })).join('\n') + '\n');
    const preds = join(dir, 'preds.json');
    writeFileSync(preds, JSON.stringify(
      [{ metric: 'chrf++', expect: 'table', rationale: 'x' }]));

    // 1. forge_status — empty workspace
    let status = parse(await forgeTool(['status', '--json'], { workspace: ws }));
    assert.equal(status.result.advice.state, 'empty-workspace');

    // 2. forge_split (with --register) — the corpus-in-hand path the advice names
    let r = await forgeTool(
      ['split', corpus, '--test', '6', '--dev', '6', '--seed', '7',
        '--out', join(dir, 'splits'), '--register', 'mypair'],
      { workspace: ws });
    assert.equal(r.isError, false, r.content[0].text);

    // 3. forge_status — now missing a preregistration for the test set
    status = parse(await forgeTool(['status', '--json'], { workspace: ws }));
    assert.equal(status.result.advice.state, 'missing-preregistration');
    const testName = status.result.snapshot.roles.test[0];
    const devName = status.result.snapshot.roles.dev[0];

    // 4. forge_prereg
    r = await forgeTool(
      ['prereg', 'new', 'p1', '--eval-set', testName, '--predictions', preds],
      { workspace: ws, parseJson: false });
    assert.equal(r.isError, false, r.content[0].text);

    // 5. forge_status — ready to train
    status = parse(await forgeTool(['status', '--json'], { workspace: ws }));
    assert.equal(status.result.advice.state, 'ready-to-train');

    // 6. the training run is a terminal job, not a tool — but its command is
    //    what forge_status hands back; drive it via runForge with a dummy backend
    const config = join(dir, 'config.json');
    writeFileSync(config, JSON.stringify({
      run_name: 'sim', workspace: ws, language: { target: 'crk' },
      data: { gold: [join(dir, 'splits', 'train.jsonl')], dev: devName },
      model: { backend: 'dummy' }, selection: { metric: 'loss' },
      decode: { max_new_tokens: 32 },
      eval: { battery: testName, by: 'register', n_bootstrap: 30 },
    }));
    const runRes = await runForge(['run', config], { workspace: ws, timeout: 120_000 });
    assert.equal(runRes.code, 0, runRes.stderr);

    // 7. forge_status — ready to score, advice names forge_evaluate
    status = parse(await forgeTool(['status', '--json'], { workspace: ws }));
    assert.equal(status.result.advice.state, 'ready-to-score');
    assert.match(status.result.advice.next_command, /evaluate/);
    const manifest = status.result.snapshot.runs.at(-1).manifest;

    // 8. forge_evaluate — close the loop, get a scored + diagnosed battery
    r = await forgeTool(['evaluate', manifest, '--config', config],
      { workspace: ws, parseJson: false });
    assert.equal(r.isError, false, r.content[0].text);
    assert.match(r.content[0].text, /textbook/);
    assert.match(r.content[0].text, /government/);
  });
});
