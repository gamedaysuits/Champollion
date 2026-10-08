/**
 * Round 12 (school + hospital personas), the MCP side of the forge fixes:
 *
 * 13. forge_register_eval read `path` from project_dir and said nothing:
 *     the agent passed a path relative to its own directory and got a bare
 *     FileNotFoundError (why/fix null). The tool documents the rule and, when
 *     the file is found from this server's directory instead, refuses with
 *     the exact path to pass; forge names its own miss (resolved path + fix).
 * 16. forge_export was the one forge tool whose envelope said `summary: null`.
 *     It now carries a summary like the others: scores with CIs, the
 *     near-twin reading, the twin-free model to quote or still to export,
 *     the prereg's counts, what to serve.
 * 17. forge_status's `next` at ready-to-score was the generic "run
 *     result.advice.next_command … A terminal: step (training: nmt-forge run
 *     config.json …)" — training, once training was done. It now names the
 *     step forge names, and the terminal text of only the terminal steps the
 *     command holds. A new state, `serving`, has its own hint (Round 12 #10).
 *
 * Helpers are tested directly; the tool wiring through the real server.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import {
  exportNextHint, exportSummary, forgeTool, registerEvalPathError, statusNextHint,
} from '../src/tools/forge.js';

const SERVE_TEXT = '`nmt-forge serve <export dir>/model` is a long-running HTTP server.';

/** An `export --json` result as forge 0.2 prints it (trimmed to what is read). */
const EXPORT = {
  export_dir: '/p/export-all',
  name: 'nmt-forge-qaa-nmt-cpu-tiny',
  run: 'qaa-nmt-cpu-tiny',
  evaluated: true,
  model_included: true,
  model_dir: '/p/export-all/model',
  battery: 'project-test',
  dataset_id: 'eval-eng-qaa-hospital-v1',
  test_groups: { all: { 'chrf++': { score: 100, ci_lower: 100, ci_upper: 100 }, n: 150 } },
  near_twin: {
    checked: true, n: 150, near_twin_rows: 150, recall_not_translation: true, strict: null,
    message: '150 of 150 test rows have a near-twin in the training data',
    advice: 'the twin-free model of this test set is already planned in this workspace — …',
    twin_free_planned: {
      prereg: 'notwins', prereg_before_reads: true, trained: true,
      next: 'nmt-forge export /p/.forge/runs/qaa-nmt-cpu-tiny-notwins-64ed467d/run-manifest.json '
        + '--prereg notwins --out export-qaa-nmt-cpu-tiny-notwins/',
      runs: [{ run: 'qaa-nmt-cpu-tiny-notwins' }],
    },
  },
  twin_free_siblings: [],
  prereg: {
    id: 'all-data', bound_by: '--prereg all-data', after_reads: null,
    verdicts: [{ verdict: 'held' }, { verdict: 'manual', human_verdict: { verdict: 'missed' } },
      { verdict: 'manual', human_verdict: null }],
  },
  serve: 'nmt-forge serve /p/export-all/model',
};

describe('forge_export carries a summary like every forge tool (Round 12 #16)', () => {
  it('scores with CIs, the near-twin reading, the planned twin-free model, the prereg counts', () => {
    const s = exportSummary(EXPORT);
    assert.equal(s.run, 'qaa-nmt-cpu-tiny');
    assert.equal(s.model_dir, '/p/export-all/model');
    assert.equal(s.evaluated, true);
    assert.equal(s.test_set, 'eval-eng-qaa-hospital-v1');
    assert.deepEqual(s.scores, { all: { 'chrf++': { score: 100, ci: [100, 100] } } });
    assert.deepEqual(s.near_twin, { checked: true, rows: 150, n: 150, recall_not_translation: true, strict: null });
    assert.match(s.near_twin_advice, /already planned/);
    assert.equal(s.twin_free_planned.prereg, 'notwins');
    assert.equal(s.twin_free_planned.trained, true);
    assert.match(s.twin_free_planned.next, /--prereg notwins/);
    assert.deepEqual(s.prereg, { id: 'all-data', bound_by: '--prereg all-data',
      verdicts: { held: 1, human_missed: 1, manual: 1 }, after_reads: null });
    assert.equal(s.serve, EXPORT.serve);
  });

  it('an evaluation-only export and a cited twin-free sibling', () => {
    const s = exportSummary({ ...EXPORT, model_dir: undefined, near_twin: { ...EXPORT.near_twin,
      twin_free_planned: undefined },
    twin_free_siblings: [{ run: 'free', model_dir: '/p/free/model', score: { metric: 'chrf++', score: 41.1 } }] });
    assert.equal(s.model_dir, null);
    assert.equal(s.twin_free_planned, undefined);
    assert.deepEqual(s.twin_free_siblings, [{ run: 'free', dir: '/p/free/model',
      score: { metric: 'chrf++', score: 41.1 } }]);
    assert.equal(exportSummary(null), null);
    assert.equal(exportSummary({ error: {} }), null);
  });

  it('the next step relays the twin-free model\'s own step before serving — no after-reads prereg', () => {
    const next = exportNextHint(EXPORT, SERVE_TEXT);
    assert.match(next, /First relay summary\.near_twin_advice/);
    assert.ok(next.includes(EXPORT.near_twin.twin_free_planned.next), next);
    assert.match(next, /\(forge_export\); no new preregistration is needed/);
    assert.ok(next.indexOf('First relay') < next.indexOf(SERVE_TEXT));
    assert.doesNotMatch(next, /allow.after.reads/);
    assert.match(exportNextHint({ ...EXPORT, model_dir: null }, SERVE_TEXT), /evaluation-only export/);
    // an inflated score with nothing planned: relay the caveat, then serve
    const plain = exportNextHint({ ...EXPORT, near_twin: { recall_not_translation: true } }, SERVE_TEXT);
    assert.match(plain, /^First relay summary\.near_twin_advice with the score — never this score alone\./);
  });
});

describe('forge_status names the step forge named (Round 12 #17)', () => {
  const READY_TO_SCORE = { advice: { state: 'ready-to-score',
    next_command: 'nmt-forge export /p/.forge/runs/a-1/run-manifest.json --prereg all-data --out '
      + 'export-a/   # a folder of its own: this workspace holds several runs' } };

  it('ready-to-score: the export, never training', () => {
    const next = statusNextHint(READY_TO_SCORE);
    assert.match(next, /^training is done — the next step is the export: forge_export/);
    assert.ok(next.includes(READY_TO_SCORE.advice.next_command), next);
    assert.doesNotMatch(next, /nmt-forge run|\(training|terminal: step/);
  });

  it('a command with a training step says the training text — and only then', () => {
    const next = statusNextHint({ advice: { state: 'ready-to-train',
      next_command: 'nmt-forge leak-audit corpus.jsonl --clean-to corpus.notwins.jsonl --drop-test-twins   '
        + '# first: …; then train: nmt-forge preflight run --config config.json && nmt-forge run config.json' } });
    assert.match(next, /as tools: forge_leak_audit → forge_preflight → terminal: nmt-forge run/);
    assert.match(next, /`nmt-forge run <config>` trains in a terminal/);
    assert.doesNotMatch(next, /long-running HTTP server/);
  });

  it('serving: nothing left in forge — the app\'s sync is next', () => {
    const next = statusNextHint({ advice: { state: 'serving',
      next_command: 'npx champollion sync   # in your app …' } });
    assert.match(next, /forge has nothing left to run/);
    assert.match(next, /npx champollion sync/);
  });

  it('the server wires it: forge_status names the serving state', async () => {
    const server = await createServer();
    const [c, s] = InMemoryTransport.createLinkedPair();
    await server.connect(s);
    const client = new Client({ name: 'r12', version: '0.0.0' });
    await client.connect(c);
    try {
      const { tools } = await client.listTools();
      const status = tools.find((t) => t.name === 'forge_status');
      assert.match(status.description, /serving \(chosen model answering\)/);
      const reg = tools.find((t) => t.name === 'forge_register_eval');
      assert.match(reg.inputSchema.properties.path.description, /relative to project_dir/);
    } finally {
      await client.close();
    }
  });
});

describe('forge_register_eval: a path the agent wrote from its own directory (Round 12 #13)', () => {
  let dir;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'r12-reg-'));
    mkdirSync(join(dir, 'data'));
    mkdirSync(join(dir, 'school-crk'));
    writeFileSync(join(dir, 'data', 'teacher_test.tsv'), 'hello\twaciye\n');
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('names the exact path to pass when the file is found from the server\'s directory', () => {
    const err = registerEvalPathError({ path: 'data/teacher_test.tsv', projectDir: 'school-crk', cwd: dir });
    assert.ok(err, 'refused');
    assert.ok(err.includes(`no file at ${join(dir, 'school-crk', 'data', 'teacher_test.tsv')}`), err);
    assert.match(err, /pass path: "\.\.\/data\/teacher_test\.tsv"/);
    assert.ok(err.includes(join(dir, 'data', 'teacher_test.tsv')));
  });

  it('says nothing when forge will find the file, or when nothing finds it (forge names that miss)', () => {
    assert.equal(registerEvalPathError({ path: '../data/teacher_test.tsv', projectDir: 'school-crk', cwd: dir }), null);
    assert.equal(registerEvalPathError({ path: join(dir, 'data', 'teacher_test.tsv'), projectDir: 'school-crk',
      cwd: dir }), null);
    assert.equal(registerEvalPathError({ path: 'data/nowhere.tsv', projectDir: 'school-crk', cwd: dir }), null);
    assert.equal(registerEvalPathError({ path: 'data/teacher_test.tsv', cwd: dir }), null, 'no project_dir');
  });

  it('the tool refuses before forge runs, with the path to pass (server working in the agent\'s directory)',
    async () => {
      const server = await createServer();
      const [c, s] = InMemoryTransport.createLinkedPair();
      await server.connect(s);
      const client = new Client({ name: 'r12-reg', version: '0.0.0' });
      await client.connect(c);
      const was = process.cwd();
      process.chdir(dir);
      try {
        const res = await client.callTool({ name: 'forge_register_eval', arguments: {
          name: 'project-test', path: 'data/teacher_test.tsv', role: 'test', project_dir: 'school-crk' } });
        assert.equal(res.isError, true);
        assert.match(res.content[0].text, /pass path: "\.\.\/data\/teacher_test\.tsv" \(relative to project_dir\)/);
      } finally {
        process.chdir(was);
        await client.close();
      }
    });

  it('the real nmt-forge refuses a missing file with the resolved path, why and fix', async (t) => {
    const probe = await forgeTool(['status'], { projectDir: join(dir, 'school-crk') });
    if (probe.isError) { t.skip('forge CLI not launchable in this environment'); return; }
    const res = await forgeTool(['registry', 'add', 'project-test', 'data/teacher_test.tsv', '--role', 'test'],
      { projectDir: join(dir, 'school-crk') });
    assert.equal(res.isError, true);
    const text = res.content[0].text;
    assert.match(text, /no eval file at .*school-crk\/data\/teacher_test\.tsv/);
    assert.match(text, /\nwhy: forge reads every relative path/);
    assert.match(text, /\nfix: the file is at .*: pass \.\.\/data\/teacher_test\.tsv/);
  });
});
