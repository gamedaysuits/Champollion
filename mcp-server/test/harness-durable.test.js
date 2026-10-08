/**
 * run_benchmark jobs survive a server restart.
 *
 * A synthetic user's agent started a benchmark, the host restarted the MCP
 * server, and get_run_status then said the job never existed — although the
 * harness had written its results. Every job now leaves a record in the job
 * history (jobs.json under CHAMPOLLION_MCP_HOME), its output in its job
 * folder, and an exit record written by the detached supervisor that runs
 * mt-eval. A server that did not start a job answers from that evidence.
 *
 * "Restart" here is forgetLiveJobs(): the process forgets the jobs it
 * launched and keeps only what is on disk — exactly what a new server
 * process has. Most tests inject the runner (no real mt-eval, no network);
 * the last group drives the REAL detached supervisor with a stand-in
 * command (node) so the restart-while-running path is exercised for real.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runBenchmark, getRunStatus, awaitAllJobs, listJobs, resetJobs, forgetLiveJobs,
} from '../src/tools/harness.js';
import {
  JOB_HISTORY_LIMIT, execJob, isSupervisorAlive, jobStorePath, readJobStore,
} from '../src/tools/jobs.js';

let DIR;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-durable-'));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
  process.env.CHAMPOLLION_MCP_DEBUG_LOG = join(DIR, 'debug.log');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  delete process.env.CHAMPOLLION_MCP_DEBUG_LOG;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

const ITEM = {
  id: 'eng-ilo-dev-v1__anthropic_claude-haiku-4.5__naive',
  language_pair: 'eng>ilo',
  target_language: 'Ilocano',
  corpus_id: 'eval-eng-ilo-tatoeba-dev-v1',
  model: 'anthropic/claude-haiku-4.5',
  condition: 'naive',
  est_cost_usd: 0.0077,
};

/** Injected dependencies; `exec` is the runner (execCapture's contract). */
function handle(exec, env = {}) {
  return {
    isMtEvalInstalled: async () => true,
    lookupQueueItem: async ({ id }) => ({ item: id === ITEM.id ? ITEM : null, covered: false }),
    execCapture: exec,
    env,
  };
}

/** A runner that reports a pid and then never settles — a run in flight. */
function inFlight(pid = 424242) {
  return (cmd, args, opts) => {
    opts.onSpawn?.({ pid });
    return new Promise(() => {});
  };
}

/** A fake harness report in a job's results folder. */
function writeReport(dir, overall = { corpus_chrf: 58.2, corpus_bleu: 21.4, evaluated: 50 }) {
  mkdirSync(dir, { recursive: true });
  const runLog = join(dir, 'run_20261003_x.json');
  writeFileSync(runLog, '{}');
  const report = join(dir, 'run_20261003_x_report.json');
  writeFileSync(report, JSON.stringify({ run_id: 'run_20261003_x', source_log: runLog, overall }));
  return report;
}

/** Write a file into a job's folder, as the supervisor or the run would. */
function put(rec, name, text) {
  mkdirSync(rec.jobDir, { recursive: true });
  writeFileSync(join(rec.jobDir, name), text);
}

const ALIVE = { isAlive: () => true };
const GONE = { isAlive: () => false };

describe('job ids', () => {
  it('are unguessable and unique across restarts (no run-1 counter to collide)', async () => {
    const ids = new Set();
    for (let i = 0; i < 20; i += 1) {
      const out = await runBenchmark({ item_id: ITEM.id, confirm: true },
        handle(async () => ({ code: 0, stdout: '', stderr: '' })));
      const id = out.match(/Job id:\s+(\S+)/)[1];
      assert.match(id, /^run-[0-9a-f]{12}$/);
      ids.add(id);
    }
    assert.equal(ids.size, 20);
    await awaitAllJobs();
  });
});

describe('the job record on disk', () => {
  it('is written at launch with command, cwd, results folder, status, start time and pid — and no environment', async () => {
    const out = await runBenchmark({ item_id: ITEM.id, confirm: true },
      handle(inFlight(31337), { OPENROUTER_API_KEY: 'sk-or-SECRET-do-not-persist' }));
    const id = out.match(/Job id:\s+(\S+)/)[1];
    assert.match(out, /Job record: .*jobs\.json/);
    assert.match(out, /Results land in: .*results\//);

    const rec = readJobStore().find((j) => j.id === id);
    assert.ok(rec, 'the job is in jobs.json');
    assert.equal(rec.cmd, 'mt-eval');
    assert.equal(rec.argv[0], 'run');
    const i = rec.argv.indexOf('--output-dir');
    assert.ok(i > 0, 'a run-mode job gets its own --output-dir');
    assert.equal(rec.argv[i + 1], rec.resultsDir);
    assert.equal(rec.cwd, process.cwd());
    assert.equal(rec.status, 'running');
    assert.equal(rec.pid, 31337);
    assert.ok(Number.isFinite(rec.startedAt));
    assert.doesNotMatch(readFileSync(jobStorePath(), 'utf-8'), /SECRET/, 'no env value may reach disk');
  });

  it('a queue run records the harness\'s queue folder under its cwd as where results land', async () => {
    await runBenchmark({ top: 2, confirm: true }, handle(inFlight()));
    const rec = readJobStore().at(-1);
    assert.equal(rec.mode, 'queue');
    assert.ok(!rec.argv.includes('--output-dir'), 'mt-eval queue has no --output-dir');
    assert.equal(rec.resultsDir, join(process.cwd(), 'eval/logs/harness/queue'));
  });
});

describe('after a server restart', () => {
  it('a finished job is still found, with its output (never "unknown job")', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true },
      handle(async () => ({ code: 0, stdout: 'composite=0.61 chrF++=58.2', stderr: '' })));
    await awaitAllJobs();
    const id = listJobs()[0].id;

    forgetLiveJobs(); // the server restarts

    const status = getRunStatus(id);
    assert.doesNotMatch(status, /No benchmark job/);
    assert.match(status, /COMPLETED/);
    assert.match(status, /composite=0\.61/);
    assert.match(getRunStatus(), new RegExp(`${id}\\s+\\[COMPLETED\\]`), 'the listing includes it');
  });

  it('a job whose supervisor is still alive reports RUNNING, started by an earlier server', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(inFlight(55555)));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const status = getRunStatus(id, ALIVE);
    assert.match(status, /^RUNNING/);
    assert.match(status, /earlier server process, still running as pid 55555/);
  });

  it('a job that finished while no server watched: exit record + results read from the output folder', async () => {
    await runBenchmark({ corpus: 'eval-eng-crk-x', model: 'llama3.1', provider: 'local', confirm: true },
      handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const rec = readJobStore().find((j) => j.id === id);

    // What the detached supervisor leaves behind when the run ends.
    put(rec, 'stdout.log', 'Run complete: run_20261003_x\n');
    put(rec, 'exit.json', JSON.stringify({ code: 0, signal: null, timedOut: false, error: null, endedAt: Date.now() }));
    const report = writeReport(rec.resultsDir);

    const status = getRunStatus(id, GONE);
    assert.match(status, /^COMPLETED/);
    assert.match(status, /Run complete: run_20261003_x/);
    assert.ok(status.includes('run_20261003_x_report.json'), 'names the report');
    assert.match(status, /overall: corpus_chrf 58\.2, corpus_bleu 21\.4, evaluated 50/);
    // Round 13: the hint names the READ-ONLY preview tool (a host may block
    // publish_report as a deploy), which then hands over the publish call.
    assert.match(status, /preview_publish \{ "report": "[^"]*run_20261003_x_report\.json" \}/,
      'the publish hint names the real report, through the read-only tool that previews before publishing');
    assert.ok(existsSync(report));
    assert.equal(readJobStore().find((j) => j.id === id).status, 'completed', 'the settled answer is written back');
  });

  it('a failed job is FAILED from its logs, and a harness refusal is still a refusal', async () => {
    await runBenchmark({ corpus: 'eval-x', model: 'm', confirm: true }, handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const rec = readJobStore().find((j) => j.id === id);
    put(rec, 'stdout.log',
      "  ✗ Corpus 'x' is NON-COMMERCIAL / research-only. Re-run with --accept-nc-terms to acknowledge\n");
    put(rec, 'exit.json', JSON.stringify({ code: 2, signal: null, timedOut: false, error: null }));
    const status = getRunStatus(id, GONE);
    assert.match(status, /NEEDS THE USER'S NON-COMMERCIAL ACKNOWLEDGMENT/);
    assert.match(status, /exit 2/);
  });

  it('a timed-out run says so', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const rec = readJobStore().find((j) => j.id === id);
    put(rec, 'exit.json', JSON.stringify({ code: null, signal: 'SIGTERM', timedOut: true, error: null }));
    assert.match(getRunStatus(id, GONE), /FAILED \(timed out after 10 min\)/);
  });

  it('a job whose process is gone with no exit record is INTERRUPTED, with the log tail', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const rec = readJobStore().find((j) => j.id === id);
    put(rec, 'stderr.log', 'translating batch 3/9 …\n');
    const status = getRunStatus(id, GONE);
    assert.match(status, /^INTERRUPTED/);
    assert.match(status, /translating batch 3\/9/);
    assert.match(status, /no exit record/);
    assert.equal(readJobStore().find((j) => j.id === id).status, 'interrupted');
  });

  it('…but if the harness wrote its report before the process vanished, that is COMPLETED (exit status unrecorded)', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const rec = readJobStore().find((j) => j.id === id);
    writeReport(rec.resultsDir);
    const status = getRunStatus(id, GONE);
    assert.match(status, /^COMPLETED/);
    assert.match(status, /exit status was not\s+recorded/);
    assert.match(status, /overall: corpus_chrf 58\.2/);
  });

  it('a queue job that vanished counts only the reports written after it started', async () => {
    await runBenchmark({ top: 2, confirm: true }, handle(inFlight()));
    const id = listJobs()[0].id;
    forgetLiveJobs();
    const store = readJobStore();
    const rec = store.find((j) => j.id === id);
    // Point the queue folder at a temp dir (the real one is under the cwd).
    rec.resultsDir = join(DIR, 'queue-out');
    writeFileSync(jobStorePath(), JSON.stringify({ version: 1, jobs: store }));
    writeReport(join(rec.resultsDir, '001_item'));
    const status = getRunStatus(id, GONE);
    assert.match(status, /^INTERRUPTED/, 'a queue cut short is not "completed" just because one item reported');
    assert.match(status, /1 report written by this run/);
  });
});

/** A long run's stdout: what happened first, 3,000 progress lines, the result last. */
function longStdout() {
  return [
    'Run complete: run_20261004_x — 50 entries scored against eval-eng-ilo-tatoeba-dev-v1',
    ...Array.from({ length: 3000 }, (_, i) => `  batch ${i + 1}/3000 translated (12 entries, 3.1s)`),
    'Overall: chrF++ 41.2 [38.0 – 44.5]',
  ].join('\n');
}

describe('long output in get_run_status (Round 7)', () => {
  it('keeps the head and the tail as whole lines and trims the MIDDLE with a marker', async () => {
    await runBenchmark({ item_id: ITEM.id, confirm: true },
      handle(async () => ({ code: 0, stdout: longStdout(), stderr: '' })));
    await awaitAllJobs();
    const id = listJobs()[0].id;
    for (const [label, status] of [['live', getRunStatus(id)], ['after a restart', (forgetLiveJobs(), getRunStatus(id, GONE))]]) {
      assert.match(status, /^COMPLETED/, label);
      assert.match(status, /\nRun complete: run_20261004_x — 50 entries scored against eval-eng-ilo-tatoeba-dev-v1\n/,
        `${label}: the first line is there, whole`);
      assert.match(status, /Overall: chrF\+\+ 41\.2 \[38\.0 – 44\.5\]/, `${label}: the last line too`);
      assert.match(status, /\n… \[\d+ lines trimmed\] …\n/, `${label}: an explicit marker`);
      assert.doesNotMatch(status, /earlier output (?:truncated|not shown)/, label);
    }
  });

  it('a failed run keeps its head too (the line that says what went wrong)', async () => {
    const stderr = ['Error: the corpus file has no "reference" field (looked for: reference, target)',
      ...Array.from({ length: 2000 }, (_, i) => `  row ${i} skipped`), 'Aborted.'].join('\n');
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(async () => ({ code: 1, stdout: '', stderr })));
    await awaitAllJobs();
    const status = getRunStatus(listJobs()[0].id);
    assert.match(status, /^FAILED/);
    assert.match(status, /Error: the corpus file has no "reference" field/);
    assert.match(status, /Aborted\./);
    assert.match(status, /lines trimmed/);
  });
});

describe('eval-pack lines in get_run_status (Round 7)', () => {
  it('puts the harness\'s EVAL PACK lines at the top of a long dry-run plan', async () => {
    const plan = [...Array.from({ length: 1500 }, (_, i) => `  item ${i + 1}: eng→crk  model x  $0.01`),
      'EVAL PACK: missing — FST morphological analyzer (Plains Cree); set it up with: mt-eval setup --lang crk',
      ...Array.from({ length: 1500 }, (_, i) => `  item ${i + 1501}: eng→crk  model x  $0.01`)].join('\n');
    await runBenchmark({ top: 3000, dry_run: true }, handle(async () => ({ code: 0, stdout: plan, stderr: '' })));
    await awaitAllJobs();
    const lines = getRunStatus(listJobs()[0].id).split('\n');
    const at = lines.findIndex((l) => l.startsWith('EVAL PACK: missing'));
    assert.ok(at >= 0 && at <= 3, `the EVAL PACK line is near the top (line ${at})`);
  });

  it('a run the harness stopped for a missing eval pack says so, and how to score without it', async () => {
    const stdout = ['', '  EVAL PACK REQUIRED: Plains Cree (crk)', '  Missing:', '    ✗ FST morphological analyzer (Plains Cree)',
      '  Install them (each command says what it installs):', '    mt-eval setup --lang crk',
      '  Or run without them — the run card marks them not computed:', '    --skip-fst            (no FST acceptance)'].join('\n');
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(async () => ({ code: 1, stdout, stderr: '' })));
    await awaitAllJobs();
    const status = getRunStatus(listJobs()[0].id);
    assert.match(status, /^STOPPED BEFORE TRANSLATING — the language's evaluation pack is not installed/);
    assert.match(status, /\nEVAL PACK REQUIRED: Plains Cree \(crk\)\n/);
    assert.match(status, /skip_fst: true/);
    assert.match(status, /mt-eval setup --lang crk/);
  });
});

describe('bounded history', () => {
  it(`keeps the newest ${JOB_HISTORY_LIMIT} jobs; a dropped job's logs go, its results stay`, async () => {
    const ok = async () => ({ code: 0, stdout: 'done', stderr: '' });
    await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(ok));
    await awaitAllJobs();
    const first = readJobStore()[0];
    const report = writeReport(first.resultsDir);

    for (let i = 0; i < JOB_HISTORY_LIMIT + 4; i += 1) {
      await runBenchmark({ item_id: ITEM.id, confirm: true }, handle(ok));
    }
    await awaitAllJobs();

    const store = readJobStore();
    assert.equal(store.length, JOB_HISTORY_LIMIT);
    assert.ok(!store.some((j) => j.id === first.id), 'the oldest job left the history');
    assert.ok(!existsSync(join(first.jobDir, 'stdout.log')), 'its logs were deleted');
    assert.ok(existsSync(report), 'its results were NOT deleted — they are the user\'s data');

    forgetLiveJobs();
    assert.match(getRunStatus(first.id), new RegExp(`newest ${JOB_HISTORY_LIMIT} jobs are kept`));
  });

  it('a corrupt history is set aside, never silently overwritten', () => {
    mkdirSync(process.env.CHAMPOLLION_MCP_HOME, { recursive: true });
    writeFileSync(jobStorePath(), '{ not json');
    assert.deepEqual(readJobStore(), []);
    assert.ok(!existsSync(jobStorePath()), 'moved aside');
  });
});

// ---------------------------------------------------------------------------
// The real detached supervisor, with node standing in for mt-eval.
// ---------------------------------------------------------------------------

/**
 * A stand-in for mt-eval: prints progress, sleeps, then writes a harness-
 * shaped report into the --output-dir it was given.
 */
const FAKE_HARNESS = `
const fs = require('fs'), path = require('path');
const a = process.argv; const i = a.indexOf('--output-dir');
console.log('Run complete: run_fake');
setTimeout(() => {
  if (i > 0) {
    fs.mkdirSync(a[i + 1], { recursive: true });
    const log = path.join(a[i + 1], 'run_fake.json');
    fs.writeFileSync(log, '{}');
    fs.writeFileSync(path.join(a[i + 1], 'run_fake_report.json'),
      JSON.stringify({ run_id: 'run_fake', source_log: log, overall: { corpus_chrf: 41.5 } }));
  }
  process.exit(Number(process.env.FAKE_EXIT || 0));
}, Number(process.env.FAKE_SLEEP_MS || 0));
`;

/** Run the real execJob, but with node + FAKE_HARNESS in place of mt-eval. */
function realRunner(cmd, args, opts) {
  return execJob(process.execPath, ['-e', FAKE_HARNESS, ...args], opts);
}

async function waitFor(pred, ms = 15_000) {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('the real detached supervisor', () => {
  it('records output and exit status in the job folder', async () => {
    const jobDir = join(DIR, 'sup-1');
    let pid = null;
    const r = await execJob(process.execPath,
      ['-e', 'console.log("hello"); console.error("careful"); process.exit(3)'],
      { timeout: 30_000, jobDir, onSpawn: (p) => { pid = p.pid; } });
    assert.ok(pid > 0, 'onSpawn reports the supervisor pid');
    assert.equal(r.code, 3);
    assert.match(r.stdout, /hello/);
    assert.match(r.stderr, /careful/);
    const exit = JSON.parse(readFileSync(join(jobDir, 'exit.json'), 'utf-8'));
    assert.equal(exit.code, 3);
  });

  it('a command that cannot start is a rejection naming it (→ ERROR), with no shell involved', async () => {
    await assert.rejects(
      execJob('definitely-not-a-real-command-mcp', ['x'], { timeout: 5_000, jobDir: join(DIR, 'sup-2') }),
      /Failed to start definitely-not-a-real-command-mcp/,
    );
  });

  it('enforces the time bound', async () => {
    const r = await execJob(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'],
      { timeout: 300, jobDir: join(DIR, 'sup-3') });
    assert.equal(r.timedOut, true);
    assert.equal(r.signal, 'SIGTERM');
  });

  it('a recycled pid is not mistaken for a running job', () => {
    // This test process is alive, but it is not a job supervisor.
    assert.equal(isSupervisorAlive({ id: 'run-000000000000', pid: process.pid }), false);
    assert.equal(isSupervisorAlive({ id: 'run-000000000000', pid: null }), false);
  });

  it('end to end: the server "restarts" mid-run; the new one sees RUNNING, then COMPLETED with the results', async () => {
    process.env.FAKE_SLEEP_MS = '1500';
    try {
      const out = await runBenchmark({ corpus: 'eval-eng-crk-x', model: 'llama3.1', provider: 'local', confirm: true },
        handle(realRunner));
      const id = out.match(/Job id:\s+(\S+)/)[1];
      const inflight = listJobs()[0].promise;
      await waitFor(() => readJobStore().find((j) => j.id === id)?.pid);

      forgetLiveJobs(); // the host restarts the server while the run is going

      const running = getRunStatus(id); // real probe: pid + command line
      assert.match(running, /^RUNNING/);
      assert.match(running, /earlier server process/);

      const rec = readJobStore().find((j) => j.id === id);
      await waitFor(() => existsSync(join(rec.jobDir, 'exit.json')));
      const done = getRunStatus(id);
      assert.match(done, /^COMPLETED/);
      assert.match(done, /Run complete: run_fake/);
      assert.match(done, /run_fake_report\.json/);
      assert.match(done, /overall: corpus_chrf 41\.5/);
      await inflight;
    } finally {
      delete process.env.FAKE_SLEEP_MS;
    }
  });
});
