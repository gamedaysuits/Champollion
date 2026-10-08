/**
 * Detached supervisor for ONE benchmark job. Spawned by jobs.js (execJob),
 * never by a user or an agent.
 *
 *   node job-supervisor.js <jobDir> <timeoutMs> <cwd> <cmd> [args...]
 *
 * Why it exists: hosts restart MCP servers. A benchmark the server spawned
 * directly died with it (its stdout pipe broke) or, if it survived, finished
 * with nobody left to record how. This process sits between the server and
 * the run:
 *
 *   - it is started detached (its own process group), so a server restart
 *     neither kills the run nor takes its outcome with it;
 *   - it runs <cmd> WITHOUT a shell (args are never interpreted), stdin
 *     ignored, stdout/stderr appended straight to <jobDir>/stdout.log and
 *     <jobDir>/stderr.log through file descriptors — no pipe to the server;
 *   - it enforces the run's time bound: SIGTERM at the deadline, SIGKILL
 *     after a grace period;
 *   - when the run ends it writes <jobDir>/exit.json atomically:
 *     {code, signal, timedOut, error, endedAt, childPid}.
 *
 * Stopping a run by hand: `kill <pid>` on this supervisor forwards the signal
 * to the run, which then exits and is recorded like any other ending.
 */

import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KILL_GRACE_MS = 10_000;

const [jobDir, timeoutRaw, cwd, cmd, ...args] = process.argv.slice(2);

if (!jobDir || !cmd) {
  process.stderr.write('job-supervisor: usage: <jobDir> <timeoutMs> <cwd> <cmd> [args...]\n');
  process.exit(64);
}

mkdirSync(jobDir, { recursive: true });

let finished = false;
/** Write exit.json once (tmp + rename, so a reader never sees half a file) and exit. */
function finish(record) {
  if (finished) return;
  finished = true;
  const body = JSON.stringify({ ...record, endedAt: Date.now() }, null, 2);
  const tmp = join(jobDir, 'exit.json.tmp');
  writeFileSync(tmp, body, 'utf-8');
  renameSync(tmp, join(jobDir, 'exit.json'));
  process.exit(0);
}

const outFd = openSync(join(jobDir, 'stdout.log'), 'a');
const errFd = openSync(join(jobDir, 'stderr.log'), 'a');

let child;
try {
  child = spawn(cmd, args, {
    cwd: cwd || process.cwd(),
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
  });
} catch (err) {
  finish({ code: null, signal: null, timedOut: false, error: `Failed to start ${cmd}: ${err.message}`, childPid: null });
}
// The child holds its own copies of the descriptors.
closeSync(outFd);
closeSync(errFd);

const timeoutMs = Number(timeoutRaw);
let timedOut = false;
let timer = null;
if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
  timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref();
  }, timeoutMs);
}

child.on('error', (err) => {
  if (timer) clearTimeout(timer);
  finish({ code: null, signal: null, timedOut: false, error: `Failed to start ${cmd}: ${err.message}`, childPid: child.pid ?? null });
});

child.on('exit', (code, signal) => {
  if (timer) clearTimeout(timer);
  finish({ code, signal, timedOut, error: null, childPid: child.pid ?? null });
});

// A deliberate stop (`kill <supervisor pid>`) reaches the run; the run's exit
// is then recorded. A hangup is ignored — the run belongs to no terminal.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { try { child.kill(sig); } catch { /* already gone */ } });
}
process.on('SIGHUP', () => {});
