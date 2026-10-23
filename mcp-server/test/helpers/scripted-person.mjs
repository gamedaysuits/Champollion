/**
 * The scripted person: walks a language project on the rails through the MCP
 * rails profile — THIS checkout's champollion CLI and nmt-forge (with the
 * harness), the dummy training backend after one off-rails edit — dispatching
 * only on step.mode. No LLM. Shared by the end-to-end test
 * (test/rails-e2e.test.js) and the site recorder
 * (scripts/rails_acceptance/record_demo.mjs), so what the site shows is
 * exactly what the test proves.
 *
 * Invented vocabulary only ("Our language", qaa).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../../src/index.js';

export const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const FORGE = join(REPO, 'forge');
const ARENA = join(REPO, 'arena');

/** Why the walk cannot run here, or null. */
export function pythonReady() {
  if (!existsSync(join(FORGE, 'nmt_forge')) || !existsSync(join(ARENA, 'mt_eval_harness'))) {
    return 'forge/ or arena/ is not in this checkout';
  }
  const r = spawnSync('python3', ['-c', 'import nmt_forge, mt_eval_harness'], {
    env: { ...process.env, PYTHONPATH: `${FORGE}:${ARENA}` }, encoding: 'utf-8', timeout: 60_000 });
  return r.status === 0 ? null : `python3 cannot import forge + harness: ${(r.stderr || '').trim().split('\n').pop()}`;
}

// invented language: deterministic pseudo-words, no real text
const W = ['zub', 'kef', 'mol', 'tav', 'nor', 'lam', 'piv', 'dex', 'sor', 'gan', 'rul', 'fem'];
const E = ['morning', 'water', 'house', 'dog', 'river', 'friend', 'bread', 'night', 'road', 'fire', 'stone', 'bird'];
const pairsFor = (from, n, k = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i + from) % 12; const b = (i * 5 + from + 3) % 12; const c = (i * 7 + k) % 12;
  return [`the ${E[a]} sees the ${E[b]} by the ${E[c]} ${i + from}`, `${W[a]}${W[b]} ${W[c]}-${i + from}`];
});
const tsvWith = (header) => (rows) => `English\t${header}\n` + rows.map(([s, t]) => `${s}\t${t}`).join('\n') + '\n';

/** The person's own answers (what a family would say), by answer key. */
export const ANSWERS = { speakers: 'our own', speakers_agreed: 'yes', owner: 'the family', training: 'allowed',
  transmission: 'local-only',
  expect: 'chrF++ below 20: a phrasebook at best', why: 'a few dozen pairs and a tiny model',
  verdict: 'held', by: 'Grandpa',
  // the improve stage's first question (improve-time): the family's own words
  per_week: 'about an hour on Sundays', total: 'maybe ten hours this winter' };

/**
 * Walk the rails. Returns {seen: ['tag/mode', …], last: the final status,
 * events: [{type, …}] — every tool call with its arguments and result, for a
 * recording, work: the folder it ran in}. Throws on a refused step or a
 * failed command.
 *
 * `packaged` walks the INSTALLED packages instead of this checkout:
 * {createServer: the installed MCP server's, path: a PATH holding the
 * installed nmt-forge and mt-eval}. Nothing points back here — the server
 * finds the champollion CLI through its own dependency and nmt-forge on PATH,
 * as a family's install would. `keep` leaves the folder for what comes next.
 * `realModel` skips the off-rails edit: a real cpu-tiny model is trained
 * (needs nmt-forge[hf]; minutes) and the walk goes on to export it. `to`
 * names a real target language instead of the private-use qaa (its card's
 * resources then shape the rails); the sentences stay invented either way.
 */
export async function walkTheRails({ maxSteps = 40, onEvent = () => {}, packaged = null, keep = false,
  realModel = false, to = 'qaa', toName = 'Our language' } = {}) {
  const tsv = tsvWith(toName);
  const saved = {};
  for (const k of ['NMT_FORGE_BIN', 'CHAMPOLLION_CLI_BIN', 'CHAMPOLLION_FORGE_DIR', 'CHAMPOLLION_MCP_HOME',
    'NMT_FORGE_JOBS_POLL_S', 'NMT_FORGE_AUTO_PRESET', 'NMT_FORGE_MACHINE_DIR', 'PATH', 'PYTHONPATH']) {
    saved[k] = process.env[k];
  }
  const work = mkdtempSync(join(tmpdir(), 'rails-walk-'));
  if (packaged) {
    for (const k of ['NMT_FORGE_BIN', 'CHAMPOLLION_CLI_BIN', 'CHAMPOLLION_FORGE_DIR', 'PYTHONPATH']) delete process.env[k];
    process.env.PATH = packaged.path;
  } else {
    const forgeBin = join(work, 'nmt-forge');
    writeFileSync(forgeBin, `#!/bin/sh\nPYTHONPATH="${FORGE}:${ARENA}" exec python3 -m nmt_forge "$@"\n`, { mode: 0o755 });
    process.env.NMT_FORGE_BIN = forgeBin;
    process.env.CHAMPOLLION_CLI_BIN = join(REPO, 'cli', 'bin', 'cli.js');
  }
  process.env.CHAMPOLLION_MCP_HOME = work;
  process.env.NMT_FORGE_JOBS_POLL_S = '1';
  // its own train queue: a real training on this computer never holds the walk
  process.env.NMT_FORGE_MACHINE_DIR = join(work, 'machine');
  // the rails start with `--model auto` (ByT5 on a GPU): the walk pins the
  // tiny model, which trains in seconds and needs no download
  process.env.NMT_FORGE_AUTO_PRESET = 'cpu-tiny';
  const server = await (packaged ? packaged.createServer : createServer)({ profile: 'rails' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: 'scripted-person', version: '0' });
  await client.connect(ct);
  const events = [];
  const emit = (e) => { events.push(e); onEvent(e); };
  async function call(name, args) {
    const r = await client.callTool({ name, arguments: args });
    let doc;
    try { doc = JSON.parse(r.content[0].text); } catch { doc = r.content[0].text; }
    emit({ type: 'tool', name, args, isError: !!r.isError, result: doc });
    return { isError: !!r.isError, doc };
  }
  try {
    const dir = join(work, 'family');
    const started = await call('start_project', { folder: 'family', from: 'English', to,
      ...(to === 'qaa' ? { target_name: toName } : {}), purpose: 'family phrasebook', parent_dir: work,
      confirmed: true });
    if (started.isError) throw new Error(JSON.stringify(started.doc));
    const seen = [];
    let patched = realModel;
    let last = null;
    for (let i = 0; i < maxSteps; i++) {
      if (!patched && existsSync(join(dir, 'config.json'))) {
        const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf-8'));
        cfg.model = { backend: 'dummy' };       // the off-rails edit: no torch
        writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
        patched = true;
        emit({ type: 'person', did: 'edited config.json: model.backend = dummy (a test double: no torch)' });
      }
      const s = (await call('project_status', { project_dir: dir })).doc;
      const step = s.step;
      if (!step) throw new Error(`the rails ended without a final step: ${JSON.stringify(s)}`);
      const tag = step.id.split(':')[0];
      seen.push(`${tag}/${step.mode}`);
      if ((tag === 'add-pairs' || tag === 'test-file') && step.mode !== 'use_tool') {
        // the agent brings in the files the person named — shown as its own
        // step, naming the tool (acceptance runs, 2026-10-11)
        throw new Error(`${tag} should be a use_tool step for an agent, got ${step.mode}`);
      }
      if (step.mode === 'human_only' || step.mode === 'use_tool') {
        if (tag === 'add-pairs') {
          writeFileSync(join(dir, 'inbox', 'grandpa.tsv'), tsv(pairsFor(0, 40)));
          writeFileSync(join(dir, 'inbox', 'aunt.tsv'), tsv(pairsFor(100, 30, 5)));
          writeFileSync(join(dir, 'inbox', 'words.tsv'), tsv(E.map((e, k) => [e, W[k]])));
          emit({ type: 'person', did: 'put grandpa.tsv, aunt.tsv and words.tsv in inbox/' });
          for (const [f, into] of [['grandpa.tsv'], ['aunt.tsv'], ['words.tsv', 'lexicon']]) {
            const r = await call('add_data', { project_dir: dir, path: `inbox/${f}`, ...(into ? { into } : {}) });
            if (r.isError) throw new Error(JSON.stringify(r.doc));
          }
          continue;
        }
        if (tag === 'test-file') {
          writeFileSync(join(dir, 'inbox', 'checked.tsv'), tsv(pairsFor(500, 14, 9)));
          emit({ type: 'person', did: 'put checked.tsv (sentences a fluent speaker checked) in inbox/' });
          const r = await call('add_data', { project_dir: dir, path: 'inbox/checked.tsv', into: 'test' });
          if (r.isError) throw new Error(JSON.stringify(r.doc));
          continue;
        }
        last = s;
        break;                                  // the person's own step: the walk ends
      }
      if (step.mode === 'wait') {
        await call('project_status', { project_dir: dir, wait_seconds: 30 });
        continue;
      }
      const args = { project_dir: dir, step_id: step.id };
      if (step.mode === 'confirm') args.confirmed = true;
      if (step.mode === 'ask_user') {
        args.answers = Object.fromEntries(Object.keys(step.answers || {}).map((k) => [k, ANSWERS[k]]));
      }
      const r = await call('run_next_step', args);
      if (r.isError) throw new Error(`${tag}: ${JSON.stringify(r.doc).slice(0, 600)}`);
      for (const x of r.doc.ran || []) {
        if (x.exit_code !== 0) throw new Error(`${x.command}\n${x.output}`);
      }
    }
    if (!last) throw new Error(`${maxSteps} steps without reaching the end: ${seen.join(' → ')}`);
    return { seen, last, events, work };
  } finally {
    await client.close();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (!keep) rmSync(work, { recursive: true, force: true });
  }
}
