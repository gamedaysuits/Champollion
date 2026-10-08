/**
 * Durable benchmark-job records — the fix for "the server restarted and my
 * job never existed".
 *
 * 0.2.0 development builds kept run_benchmark jobs in a Map that died with
 * the server process. Hosts restart MCP servers (an update, a crash, a
 * config reload), and a synthetic user's agent then got "No benchmark job
 * with id …" for a run whose harness had already written its results.
 *
 * Now every job leaves three things on disk, under the server's state
 * directory (state.js; `~/.champollion-mcp/` by default):
 *
 *   jobs.json              one record per job (id, command, cwd, where
 *                          results land, status, start time, pid while
 *                          running …), newest JOB_HISTORY_LIMIT kept
 *   jobs/<id>/stdout.log   the run's output, written by the run itself
 *   jobs/<id>/stderr.log
 *   jobs/<id>/exit.json    how it ended — written by job-supervisor.js, the
 *                          detached process that runs mt-eval, so the
 *                          outcome is recorded even with no server alive
 *
 * A server that did not start a job (because it restarted, or is a second
 * server process) answers from that evidence: an exit record → COMPLETED /
 * FAILED / ERROR; a live supervisor (pid checked against its command line,
 * so a recycled pid is not mistaken for the run) → RUNNING; neither → the
 * results the harness wrote, or INTERRUPTED with the log tail. Never
 * "unknown job" for a job in the history.
 *
 * Records hold no environment and no secrets: the publish target is stored
 * as the label the start message showed, not the env it came from.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync,
  readSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readLogEdges } from './output-trim.js';
import { mcpStateDir } from './state.js';

/** How many job records jobs.json keeps (running jobs are never dropped). */
export const JOB_HISTORY_LIMIT = 50;

const STORE_FILE = 'jobs.json';
const STORE_VERSION = 1;

/** The detached runner (see job-supervisor.js). */
export const SUPERVISOR_PATH = fileURLToPath(new URL('./job-supervisor.js', import.meta.url));

/** Fields of a job that are persisted. Everything else (env, promise,
 *  in-memory output) stays in the process that launched the job. */
const PERSISTED_FIELDS = [
  'id', 'mode', 'dryRun', 'label', 'estLabel', 'publish', 'target',
  'cmd', 'argv', 'cwd', 'jobDir', 'resultsDir', 'status', 'startedAt', 'endedAt',
  'exitCode', 'signal', 'timedOut', 'error', 'pid', 'timeoutMs', 'note',
];

export const TERMINAL_STATUSES = new Set(['completed', 'failed', 'error', 'interrupted']);

/** Path of the job history file. */
export function jobStorePath(env = process.env) {
  return join(mcpStateDir(env), STORE_FILE);
}

/** Directory holding one job's logs, exit record and (run modes) results. */
export function jobDirFor(id, env = process.env) {
  return join(mcpStateDir(env), 'jobs', id);
}

/**
 * A fresh job id: unguessable and unique across server restarts (a counter
 * restarting at run-1 would collide with the persisted history).
 */
export function newJobId() {
  return `run-${randomBytes(6).toString('hex')}`;
}

/** Write a file atomically (tmp + rename) so a reader never sees half of it. */
function writeAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf-8');
  renameSync(tmp, path);
}

/**
 * Every persisted job record, oldest first. A missing file is an empty
 * history. An unreadable one is set aside (jobs.json.corrupt-<time>) and
 * said so on stderr — never silently overwritten with an empty list.
 */
export function readJobStore(env = process.env) {
  const path = jobStorePath(env);
  if (!existsSync(path)) return [];
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    const aside = `${path}.corrupt-${Date.now()}`;
    try { renameSync(path, aside); } catch { /* leave it in place */ }
    process.stderr.write(`champollion-mcp: job history ${path} was unreadable (${err.message}); `
      + `moved aside to ${aside}. Starting a new history.\n`);
    return [];
  }
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.filter((j) => j && typeof j.id === 'string');
}

/** The persisted record for one job id, or null. */
export function findJobRecord(id, env = process.env) {
  return readJobStore(env).find((j) => j.id === id) ?? null;
}

/** Strip a live job down to what is persisted. */
function toRecord(job) {
  const rec = {};
  for (const k of PERSISTED_FIELDS) if (job[k] !== undefined) rec[k] = job[k];
  rec.updatedAt = Date.now();
  return rec;
}

/**
 * Upsert one job into jobs.json and bound the history: the newest
 * JOB_HISTORY_LIMIT records are kept, plus any still marked running. A
 * dropped job's logs and exit record are deleted; its results/ folder (the
 * harness's run log and report — the user's data) is never touched.
 *
 * Read-merge-write, so two server processes sharing the directory each keep
 * the other's records. Throws on a write failure — the caller reports it.
 */
export function saveJob(job, env = process.env) {
  const path = jobStorePath(env);
  mkdirSync(mcpStateDir(env), { recursive: true });
  const rec = toRecord(job);
  const jobs = readJobStore(env);
  // Update in place, append when new: with a stable sort, jobs started in
  // the same millisecond keep their launch order, so "newest" is exact.
  const at = jobs.findIndex((j) => j.id === rec.id);
  if (at >= 0) jobs[at] = rec;
  else jobs.push(rec);
  jobs.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  const newest = new Set(jobs.slice(-JOB_HISTORY_LIMIT).map((j) => j.id));
  const kept = jobs.filter((j) => newest.has(j.id) || j.status === 'running');
  const dropped = jobs.filter((j) => !newest.has(j.id) && j.status !== 'running');

  writeAtomic(path, `${JSON.stringify({ version: STORE_VERSION, jobs: kept }, null, 2)}\n`);
  for (const d of dropped) pruneJobFiles(d);
  return rec;
}

/** Remove a dropped job's logs; keep its results. Best-effort. */
function pruneJobFiles(rec) {
  if (!rec?.jobDir) return;
  for (const f of ['stdout.log', 'stderr.log', 'exit.json']) {
    try { rmSync(join(rec.jobDir, f), { force: true }); } catch { /* best-effort */ }
  }
  try {
    if (existsSync(rec.jobDir) && readdirSync(rec.jobDir).length === 0) rmSync(rec.jobDir, { recursive: true });
  } catch { /* best-effort */ }
}

/** Delete the whole history and every job folder. Test isolation only. */
export function clearJobStore(env = process.env) {
  rmSync(jobStorePath(env), { force: true });
  rmSync(join(mcpStateDir(env), 'jobs'), { recursive: true, force: true });
}

/** The exit record job-supervisor.js wrote, or null. */
export function readExitRecord(jobDir) {
  if (!jobDir) return null;
  try {
    return JSON.parse(readFileSync(join(jobDir, 'exit.json'), 'utf-8'));
  } catch {
    return null;
  }
}

/** The last `maxBytes` of a text file ('' when absent). */
export function readTail(path, maxBytes = 64 * 1024) {
  let fd;
  try {
    fd = openSync(path, 'r');
    const { size } = fstatSync(fd);
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    const text = buf.toString('utf-8');
    return size > len ? `…(earlier output not shown)…\n${text}` : text;
  } catch {
    return '';
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * A job's logged output, read from its folder: whole, or — for a huge log —
 * its first and last lines with the count of lines between (readLogEdges), so
 * get_run_status keeps the head that says what happened. Reading only the
 * tail cut the answer off mid-sentence at the top (Round 7).
 */
export function readJobLogs(rec) {
  if (!rec?.jobDir) return { stdout: '', stderr: '' };
  return {
    stdout: readLogEdges(join(rec.jobDir, 'stdout.log')),
    stderr: readLogEdges(join(rec.jobDir, 'stderr.log')),
  };
}

/**
 * Write a settled job's output and exit record into its folder when the
 * runner did not (an injected test runner, or a pre-supervisor path), so a
 * later server reads the same truth this one saw. Never overwrites.
 */
export function ensureJobFiles(rec, { stdout = '', stderr = '', exit }) {
  if (!rec?.jobDir) return;
  mkdirSync(rec.jobDir, { recursive: true });
  const write = (name, text) => {
    const p = join(rec.jobDir, name);
    if (!existsSync(p)) writeFileSync(p, text, 'utf-8');
  };
  write('stdout.log', stdout);
  write('stderr.log', stderr);
  if (!existsSync(join(rec.jobDir, 'exit.json'))) {
    writeAtomic(join(rec.jobDir, 'exit.json'), JSON.stringify({ ...exit, endedAt: rec.endedAt ?? Date.now() }, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Is the job's supervisor still running?
// ---------------------------------------------------------------------------

/**
 * True only when `pid` is alive AND is this job's supervisor. A bare
 * `kill(pid, 0)` is not enough: after a reboot or a long gap the pid may
 * belong to an unrelated process, which would report a dead run as RUNNING
 * forever. The command line must name job-supervisor.js and this job's
 * folder. Where `ps` is unavailable, liveness alone is the best evidence.
 */
export function isSupervisorAlive(rec) {
  const pid = Number(rec?.pid);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch {
    // ESRCH: gone. EPERM: a process exists but belongs to another user —
    // not our run either way.
    return false;
  }
  const ps = spawnSync('ps', ['-ww', '-o', 'command=', '-p', String(pid)], { encoding: 'utf-8', timeout: 3000 });
  const cmdline = String(ps.stdout || '').trim();
  // No `ps`, or one that cannot answer for a pid we know is alive: liveness
  // is the evidence we have. A command line that is NOT this job's
  // supervisor is a recycled pid.
  if (ps.error || !cmdline) return true;
  return cmdline.includes('job-supervisor') && cmdline.includes(rec.id);
}

// ---------------------------------------------------------------------------
// The runner: mt-eval under a detached supervisor, output to files.
// ---------------------------------------------------------------------------

/**
 * Run `cmd args` for a job: spawn job-supervisor.js detached, which runs the
 * command with no shell and its output going straight to the job folder.
 * Resolves like execCapture — {code, stdout, stderr} (+ signal, timedOut) —
 * when the run ends while this process is alive; rejects when the command
 * could not start. `onSpawn({pid})` reports the supervisor's pid at once so
 * the job record can carry it.
 *
 * The supervisor's process handle is kept referenced: a server whose host
 * closed stdin stays up until its runs finish (as before), and a server that
 * is killed leaves the runs going — the next server reads their outcome.
 *
 * @param {string}   cmd
 * @param {string[]} args
 * @param {object}   opts  {timeout, jobDir, cwd, onSpawn}
 */
export function execJob(cmd, args, { timeout = 300_000, jobDir, cwd = process.cwd(), onSpawn } = {}) {
  return new Promise((resolvePromise, reject) => {
    if (!jobDir) {
      reject(new Error('execJob needs a job folder'));
      return;
    }
    try {
      mkdirSync(jobDir, { recursive: true });
    } catch (err) {
      reject(new Error(`cannot create the job folder (${err.message}) — set CHAMPOLLION_MCP_HOME to a writable directory`));
      return;
    }
    let sup;
    try {
      sup = spawn(process.execPath, [SUPERVISOR_PATH, jobDir, String(timeout), cwd, cmd, ...args], {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (err) {
      reject(new Error(`Failed to start ${cmd}: ${err.message}`));
      return;
    }
    let settled = false;
    sup.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Failed to start ${cmd} (job supervisor): ${err.message}`));
    });
    if (sup.pid) onSpawn?.({ pid: sup.pid });
    sup.on('exit', () => {
      if (settled) return;
      settled = true;
      const exit = readExitRecord(jobDir);
      const stdout = readTail(join(jobDir, 'stdout.log'), Infinity);
      const stderr = readTail(join(jobDir, 'stderr.log'), Infinity);
      if (exit?.error) {
        reject(new Error(exit.error));
        return;
      }
      if (!exit) {
        resolvePromise({
          code: 1,
          stdout,
          stderr: `${stderr}\n[the job supervisor ended without recording how the run ended]`.trim(),
        });
        return;
      }
      resolvePromise({
        code: exit.code ?? 1,
        signal: exit.signal ?? null,
        timedOut: exit.timedOut === true,
        stdout,
        stderr,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Results the harness wrote
// ---------------------------------------------------------------------------

/** `*_report.json` files directly in `dir` (non-recursive). */
function reportsIn(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('_report.json'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * The reports a job produced. Item/corpus runs have their own results
 * folder (the harness's --output-dir), so every report there is theirs. A
 * queue run writes into the harness's shared queue folders under its cwd,
 * so only reports modified after the job started count.
 *
 * @returns {{dir: string|null, reports: string[]}} newest report last
 */
export function findJobResults(rec) {
  const dir = rec?.resultsDir ?? null;
  if (!dir || !existsSync(dir)) return { dir, reports: [] };
  let reports;
  if (rec.mode === 'queue') {
    let subdirs = [];
    try {
      subdirs = readdirSync(dir).map((d) => join(dir, d));
    } catch { /* none */ }
    reports = subdirs.flatMap(reportsIn)
      .filter((p) => {
        try { return statSync(p).mtimeMs >= (rec.startedAt ?? 0) - 1000; } catch { return false; }
      });
  } else {
    reports = reportsIn(dir);
  }
  const mtime = (p) => { try { return statSync(p).mtimeMs; } catch { return 0; } };
  reports.sort((a, b) => mtime(a) - mtime(b));
  return { dir, reports };
}

/** Headline numbers from a harness report's `overall` block, by their own keys. */
export function reportHeadline(reportPath) {
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  } catch {
    return null;
  }
  const o = report?.overall ?? {};
  const keys = ['corpus_chrf', 'corpus_bleu', 'corpus_ter', 'comet_score', 'evaluated', 'error_count'];
  const parts = keys
    .filter((k) => typeof o[k] === 'number')
    .map((k) => `${k} ${o[k]}`);
  // What qualifies those numbers (the harness's score_caveats, recorded in
  // the report), so the answer carries them whatever the output trim kept —
  // a near-constant output scored twice an LLM run's composite with no
  // caveat (synthetic researcher, Round 12).
  const caveats = (Array.isArray(report?.score_caveats) ? report.score_caveats : [])
    .filter((c) => c && typeof c === 'object' && typeof c.message === 'string')
    .map((c) => ({ kind: String(c.kind ?? 'caveat'), severity: c.severity === 'major' ? 'major' : 'minor',
      source: String(c.source ?? '?'), message: c.message }));
  return { runId: report?.run_id ?? null, sourceLog: report?.source_log ?? null, line: parts.join(', '), caveats };
}
