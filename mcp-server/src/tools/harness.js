/**
 * Harness tools — run mt-eval benchmarks via child process.
 *
 * This module wraps the mt-eval CLI to run benchmarks from the queue.
 * The actual execution spawns mt-eval as a subprocess. If mt-eval
 * isn't installed, the tool returns instructions for installation.
 *
 * Security:
 *   - The queue is fetched over HTTP and is therefore UNTRUSTED. We never
 *     execute an item's `run_command` string in a shell (`bash -c`). Instead
 *     we reconstruct a shell-free argv from the item's structured fields
 *     (corpus_id / model / target_language / condition) and spawn mt-eval
 *     directly (no shell). See buildRunArgv. A compromise of the static host,
 *     the queue-build pipeline, or the queue URL is therefore NOT arbitrary
 *     code execution on the agent's machine.
 *   - Spending tokens requires an EXPLICIT confirmation: runBenchmark refuses
 *     to spend unless `confirm: true` is passed. There is no TTY under MCP
 *     stdio, so the harness's own interactive prompt cannot be relied on — the
 *     confirmation gate lives here, at the MCP boundary, instead. dry_run
 *     spends nothing and needs no confirmation.
 */

import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Check if mt-eval is installed and accessible on the PATH.
 *
 * @returns {Promise<boolean>}
 */
export async function isMtEvalInstalled() {
  return new Promise((resolve) => {
    const proc = spawn('mt-eval', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Run a command and capture its output.
 *
 * Spawns WITHOUT `shell: true` — args are passed directly to the program, so
 * no shell ever interprets them. stdin is `ignore` (not `inherit`): under MCP
 * stdio the parent's stdin carries the JSON-RPC stream, and a child must never
 * read or block on it.
 *
 * @param {string}   cmd    Command to run
 * @param {string[]} args   Arguments
 * @param {object}   opts   Options
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function execCapture(cmd, args, { timeout = 300_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    proc.on('error', (err) => {
      reject(new Error(`Failed to start ${cmd}: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Subprocess error sanitization — never relay local absolute paths.
// ---------------------------------------------------------------------------
//
// mt-eval failures often arrive as full Python tracebacks whose `File "…"`
// frames carry local absolute paths (username, directory layout). Relaying
// those verbatim leaks the local filesystem into the agent conversation.
// Error relays therefore surface only a path-stripped summary plus a short
// hint; the complete, unedited output goes to a local debug log.

const DEBUG_LOG_BASENAME = 'champollion-mcp-debug.log';

/** Where the debug log lives. Env-overridable so tests can redirect it. */
function debugLogPath() {
  return process.env.CHAMPOLLION_MCP_DEBUG_LOG
    || join(tmpdir(), DEBUG_LOG_BASENAME);
}

// The user-facing pointer to the log deliberately names the file, not its
// absolute path — surfacing the path would reintroduce the leak this exists
// to prevent.
const DEBUG_LOG_HINT = `${DEBUG_LOG_BASENAME} in the system temp directory`;

/**
 * Append full subprocess detail to the local debug log. Best-effort only —
 * logging must never break a tool call, so write failures are swallowed.
 *
 * @param {string} title   One-line summary of what failed.
 * @param {string} detail  Full, unedited output.
 */
async function writeDebugLog(title, detail) {
  try {
    await appendFile(
      debugLogPath(),
      `[${new Date().toISOString()}] ${title}\n${detail}\n\n`,
      'utf-8',
    );
  } catch {
    // Debug logging is diagnostics, not behavior.
  }
}

/** Full stdout/stderr block for a debug log entry. */
function debugDetail(stdout, stderr) {
  return [
    '--- stdout ---',
    stdout || '(empty)',
    '--- stderr ---',
    stderr || '(empty)',
  ].join('\n');
}

/**
 * Strip absolute filesystem paths from relayed text, keeping basenames.
 *
 * Two passes: quoted paths first (Python traceback frames quote them, and
 * they may contain spaces — `File "/Users/x/my dir/runner.py"`), then bare
 * unquoted paths. The lookbehind on the second pass keeps URL paths
 * (…dev/queue.json) and model slugs (anthropic/claude-…) intact.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripAbsolutePaths(text) {
  if (!text) return text;
  return text
    .replace(/"(?:[A-Za-z]:)?[/\\][^"]*[/\\]([^"/\\]+)"/g, '"$1"')
    .replace(/(?<![\w:/])\/(?:[^\s/'")\],]+\/)+([^\s/'")\],]+)/g, '$1');
}

// ---------------------------------------------------------------------------
// Command construction — reconstruct argv locally, NEVER shell the queue.
// ---------------------------------------------------------------------------
//
// The queue is untrusted, so even though we never shell these values we still
// validate each structured field against its expected shape. The argv is built
// positionally (`--flag value`), so the residual risk is *argument* injection
// into mt-eval itself — chiefly a value that could be read as an option. We
// reject anything with a leading dash or control characters, plus anything
// outside the known id/slug character sets. (Mirror of the Python
// build_run_argv in arena/mt_eval_harness/queue_runner.py.)
const CORPUS_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/;
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u001f\u007f]/;

function requireStrField(item, key) {
  const val = item == null ? undefined : item[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`queue item is missing or has an empty '${key}' field`);
  }
  return val;
}

/**
 * Reconstruct the `mt-eval run` argv for a queue item from its STRUCTURED
 * fields — never from the network-supplied `run_command` string.
 *
 * Returns a string[] (the argv AFTER the `mt-eval` program name) suitable for
 * `spawn('mt-eval', argv)` with NO shell. Throws if a required field is
 * missing or fails validation, or if the item is coached (the MCP cannot
 * supply a per-contributor coaching file).
 *
 * @param {object} item
 * @param {object} [opts]
 * @param {string} [opts.provider]
 * @returns {string[]}
 */
export function buildRunArgv(item, { provider } = {}) {
  const corpusId = requireStrField(item, 'corpus_id');
  const model = requireStrField(item, 'model');
  const targetLanguage = requireStrField(item, 'target_language');

  if (!CORPUS_ID_RE.test(corpusId)) {
    throw new Error(`corpus_id failed validation: ${corpusId}`);
  }
  if (!MODEL_RE.test(model)) {
    throw new Error(`model failed validation: ${model}`);
  }
  // Language names may contain spaces, parentheses, commas and non-ASCII
  // letters (e.g. "Plains Cree (nêhiyawêwin, SRO)"). Reject only a leading
  // dash (would parse as an option) and control characters.
  if (targetLanguage.startsWith('-') || CTRL_RE.test(targetLanguage)) {
    throw new Error(`target_language failed validation: ${targetLanguage}`);
  }

  if (item.condition === 'coached') {
    throw new Error(
      'coached items require a coaching file and cannot be run via the MCP; '
      + 'use the mt-eval CLI directly with --coaching-file.',
    );
  }

  const argv = [
    'run',
    '--corpus', corpusId,
    '--model', model,
    '--target-lang', targetLanguage,
    '--yes',
  ];
  // Provider is a local, schema-validated value (not network data). OpenRouter
  // is the harness default, so only pass the flag for a non-default provider.
  if (provider && provider !== 'openrouter') {
    argv.push('--provider', provider);
  }
  return argv;
}

function fmtCost(item) {
  return `$${(item.est_cost_usd || 0).toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Background job registry — the fix for the 60s client-timeout trap.
// ---------------------------------------------------------------------------
//
// A real benchmark (a non-trivial corpus through a live model) routinely takes
// several minutes. The MCP SDK's *client* request timeout defaults to 60s, so
// a tool that synchronously awaits the subprocess makes a correct run look like
// a failure: the client gives up at 60s even though mt-eval is still going.
//
// Instead, runBenchmark STARTS the subprocess in the background and returns a
// job handle immediately (well under any client timeout). The agent then polls
// get_run_status until the job settles. The registry is in-memory and lives for
// the MCP server process's lifetime — one process serves the agent across many
// tool calls, so finished records are retained for the agent to read the final
// output after completion.
const JOBS = new Map();
let JOB_SEQ = 0;

const MAX_OUTPUT_CHARS = 8000; // cap status output so a long queue run can't flood the channel

/** @returns {string} A fresh, process-unique job id. */
function newJobId() {
  JOB_SEQ += 1;
  return `run-${JOB_SEQ}`;
}

/** Elapsed (or total, if finished) seconds for a job, as an integer. */
function jobSeconds(job) {
  const end = job.endedAt ?? Date.now();
  return Math.max(0, Math.round((end - job.startedAt) / 1000));
}

/** Tail-truncate long output for display, keeping the most recent lines. */
function tail(text) {
  if (!text) return '';
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return '…(earlier output truncated; showing the tail)…\n'
    + text.slice(text.length - MAX_OUTPUT_CHARS);
}

/**
 * Launch a benchmark subprocess in the BACKGROUND and register it as a job.
 *
 * Returns the job record immediately — the subprocess is NOT awaited here. The
 * background promise updates the record's status/output when mt-eval settles.
 * A spawn failure (process never started) lands as status 'error'; a non-zero
 * exit lands as 'failed'; success lands as 'completed'.
 *
 * @param {object}   spec
 * @param {string[]} spec.argv     argv AFTER the `mt-eval` program name
 * @param {'item'|'queue'} spec.mode
 * @param {boolean}  [spec.dryRun]  true = plan-only run, spends nothing
 * @param {string}   spec.label    human description of what's running
 * @param {string}   [spec.estLabel]  estimated-cost label for the start message
 * @param {boolean}  [spec.publish]   queue mode: will results publish?
 * @param {number}   spec.timeout  subprocess timeout (ms)
 * @param {function} spec.exec     execCapture (injectable for tests)
 * @returns {object} the job record
 */
function launchJob({ argv, mode, dryRun, label, estLabel, publish, timeout, exec }) {
  const id = newJobId();
  const job = {
    id,
    mode,
    dryRun: dryRun === true,
    label,
    estLabel: estLabel ?? null,
    publish: publish !== false,
    argv,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    stdout: '',
    stderr: '',
    error: null,
  };
  JOBS.set(id, job);

  // Fire-and-forget. Wrapping the exec call in Promise.resolve().then(...) means
  // even a *synchronous* throw from exec becomes a rejection the .catch handles,
  // so a launch failure can never surface as an unhandled rejection.
  job.promise = Promise.resolve()
    .then(() => exec('mt-eval', argv, { timeout }))
    .then(async ({ code, stdout, stderr }) => {
      job.exitCode = code;
      job.stdout = stdout;
      job.stderr = stderr;
      job.status = code === 0 ? 'completed' : 'failed';
      job.endedAt = Date.now();
      if (code !== 0) {
        // Full unedited output goes to the debug log; get_run_status relays
        // only a path-stripped version. Awaited inside the chain so
        // awaitAllJobs() covers the write.
        await writeDebugLog(
          `job ${job.id} failed (exit ${code}) — argv: mt-eval ${argv.join(' ')}`,
          debugDetail(stdout, stderr),
        );
      }
    })
    .catch(async (err) => {
      job.error = err.message;
      job.status = 'error';
      job.endedAt = Date.now();
      await writeDebugLog(
        `job ${job.id} could not start — argv: mt-eval ${argv.join(' ')}`,
        String((err && err.stack) || err),
      );
    });

  return job;
}

/** Build the "STARTED — poll get_run_status" message for a freshly launched job. */
function formatJobStarted(job) {
  if (job.dryRun) {
    return [
      'DRY-RUN STARTED — computing the queue plan in the background. No tokens',
      'will be spent.',
      '',
      `Job id:  ${job.id}`,
      `Running: ${job.label}`,
      '',
      'The harness loads the full ranked queue before printing its plan, which',
      'can take a few minutes — longer than a default 60-second MCP client',
      'request timeout — so it runs detached from this tool call.',
      '',
      `Next: poll get_run_status with { "job_id": "${job.id}" } every ~15-30s until`,
      'it reports COMPLETED. The plan is in the job output.',
    ].join('\n');
  }
  const publishLine = job.mode === 'queue'
    ? (job.publish
      ? 'Each result auto-publishes to the public leaderboard as it finishes.'
      : 'Results will NOT be published (scoring/validation only — no leaderboard write).')
    : 'Scored locally — a single-item run is not auto-published.';
  return [
    'STARTED — the benchmark is now running in the background.',
    '',
    `Job id:  ${job.id}`,
    `Running: ${job.label}`,
    job.estLabel ? `Est. cost: ${job.estLabel}` : '',
    publishLine,
    '',
    'This call returned immediately and did NOT block. A real benchmark can take',
    'several minutes — longer than a default 60-second MCP client request',
    'timeout — so it runs detached from this tool call.',
    '',
    `Next: poll get_run_status with { "job_id": "${job.id}" } every ~15-30s until`,
    'it reports COMPLETED or FAILED. Each poll returns instantly. After it',
    'completes, call get_results to see the scored run on the leaderboard.',
  ].filter((line) => line !== '').join('\n');
}

/**
 * Format a job's current status for the agent. With no id, lists all jobs
 * started in this session.
 *
 * @param {string} [jobId]
 * @returns {string}
 */
export function getRunStatus(jobId) {
  if (!jobId) {
    if (JOBS.size === 0) {
      return 'No benchmark jobs have been started in this session yet. '
        + 'Start one with run_benchmark (confirm: true), then poll its job id here.';
    }
    const lines = [...JOBS.values()].map(
      (j) => `  ${j.id}  [${j.status.toUpperCase()}]  ${j.label}  (${jobSeconds(j)}s)`,
    );
    return [
      `Benchmark jobs this session (${JOBS.size}):`,
      '',
      ...lines,
      '',
      'Call get_run_status with a specific job_id for full output.',
    ].join('\n');
  }

  const job = JOBS.get(jobId);
  if (!job) {
    const known = [...JOBS.keys()];
    return `No benchmark job with id "${jobId}". `
      + (known.length
        ? `Known job ids: ${known.join(', ')}.`
        : 'No jobs have been started in this session yet.');
  }

  const secs = jobSeconds(job);

  if (job.status === 'running') {
    return [
      `RUNNING — job ${job.id} (${secs}s elapsed)`,
      job.label,
      '',
      'Still working. This is expected for a real run — poll get_run_status '
      + 'again in ~15-30s.',
    ].join('\n');
  }

  if (job.status === 'completed') {
    const closing = job.dryRun
      ? 'Dry-run plan above — no tokens were spent. Run again with confirm: true '
        + 'to execute it.'
      : job.mode === 'queue'
        ? (job.publish
          ? 'Each result was published to the public leaderboard — call get_results '
            + '(filtered to this pair/model) to see it.'
          : 'Results were scored but NOT published (validation run).')
        : 'Scored locally (single-item runs are not auto-published).';
    return [
      `COMPLETED — job ${job.id} (took ${secs}s)`,
      job.label,
      '',
      tail(job.stdout) || '(no output captured)',
      '',
      closing,
    ].join('\n');
  }

  if (job.status === 'failed') {
    // Keep the output tail for context (a long run's progress lines are
    // useful), but path-stripped — traceback frames must not leak local
    // absolute paths. The unedited output is in the debug log.
    return [
      `FAILED (exit ${job.exitCode}) — job ${job.id} (after ${secs}s)`,
      job.label,
      '',
      stripAbsolutePaths(tail(job.stderr || job.stdout)) || '(no output captured)',
      '',
      `Full unedited output is in the debug log (${DEBUG_LOG_HINT}).`,
    ].join('\n');
  }

  // status === 'error' — the subprocess never started.
  return [
    `ERROR — job ${job.id} could not start (after ${secs}s)`,
    job.label,
    '',
    stripAbsolutePaths(job.error || 'unknown error'),
  ].join('\n');
}

// --- Test/introspection helpers (not part of the agent-facing surface) -------

/** Await every job's background promise to settle. For deterministic tests. */
export async function awaitAllJobs() {
  await Promise.all([...JOBS.values()].map((j) => j.promise).filter(Boolean));
}

/** Snapshot of all job records (most recent last). For tests/introspection. */
export function listJobs() {
  return [...JOBS.values()];
}

/** Clear the registry. For test isolation. */
export function resetJobs() {
  JOBS.clear();
  JOB_SEQ = 0;
}

/**
 * Run one or more benchmark items from the queue.
 *
 * Reconstructs and executes an mt-eval command WITHOUT a shell. Spending
 * tokens requires `confirm: true` — without it (or with `dry_run`), the tool
 * returns a plan and spends nothing.
 *
 * ASYNC EXECUTION: a confirmed run does NOT block this call. The mt-eval
 * subprocess is launched in the BACKGROUND and a job handle is returned
 * immediately, so the call returns well under any MCP client request timeout
 * (the SDK default is 60s, far shorter than a real run). The agent then polls
 * get_run_status with the returned job id until the job settles. A queue-mode
 * dry_run is ALSO backgrounded — the harness loads the full ranked queue
 * before printing its plan, which can take minutes. Item-mode dry_run and the
 * confirmation prompts stay synchronous (local argv construction, no
 * subprocess).
 *
 * @param {object} params
 * @param {number} [params.budget]    Budget cap in USD
 * @param {number} [params.top]       Number of top items to run
 * @param {string} [params.item_id]   Specific item ID to run
 * @param {boolean} [params.dry_run]  Show plan without executing
 * @param {string} [params.provider]  API provider override
 * @param {boolean} [params.confirm]  Must be true to actually spend tokens
 * @param {boolean} [params.publish]  Auto-publish to the public leaderboard
 *                                    (default true). Pass false for a
 *                                    scoring/validation run with NO prod write.
 * @param {object} [deps]             Injected dependencies (for testing)
 * @returns {Promise<string>}         Human-readable result. For a confirmed
 *                                    run this is a "STARTED" message carrying
 *                                    the job id to poll; otherwise a plan or
 *                                    confirmation prompt.
 */
export async function runBenchmark(
  { budget, top, item_id, dry_run = false, provider, confirm = false,
    publish = true },
  deps = {},
) {
  const {
    isMtEvalInstalled: checkInstalled = isMtEvalInstalled,
    lookupQueueItem = null,
    execCapture: exec = execCapture,
  } = deps;

  // Pre-flight check: is mt-eval installed?
  const installed = await checkInstalled();
  if (!installed) {
    return [
      'mt-eval is not installed on this machine.',
      '',
      'To install it, run:',
      '  pipx install mt-eval-harness',
      '',
      'After installation, set your API key:',
      '  export OPENROUTER_API_KEY=sk-or-...',
      '',
      'Then try again.',
    ].join('\n');
  }

  // ----- Specific item -----------------------------------------------------
  if (item_id) {
    // Direct primary-key lookup — the 0.1.0 code drained the entire ranked
    // queue (211k+ items, minutes of paging) to run one .find().
    const lookup = lookupQueueItem
      ?? (await import('./queue.js')).lookupQueueItem;
    const { item, covered } = await lookup({ id: item_id });
    if (!item) {
      return `Queue item "${item_id}" not found. Use list_queue to see available items.`;
    }
    if (covered === true) {
      return [
        `REFUSED — queue item "${item_id}" is already covered by a VERIFIED run.`,
        '',
        'Running it again would spend tokens re-measuring a combination the',
        'leaderboard already has a refereed result for. Use list_queue to pick',
        'an open item instead (open items are coverage-filtered automatically).',
      ].join('\n');
    }

    // Reconstruct a shell-free argv from STRUCTURED fields. The item's
    // network-supplied run_command is NEVER executed.
    let argv;
    try {
      argv = buildRunArgv(item, { provider });
    } catch (err) {
      return `Cannot run "${item_id}": ${err.message}`;
    }

    if (dry_run) {
      return [
        'DRY RUN — would execute (no shell):',
        '',
        `  mt-eval ${argv.join(' ')}`,
        '',
        `Language pair: ${item.language_pair.replace('>', ' → ')}`,
        `Target: ${item.target_language}`,
        `Model: ${item.model}`,
        `Condition: ${item.condition}`,
        `Estimated cost: ${fmtCost(item)}`,
        '',
        'No tokens were spent.',
      ].join('\n');
    }

    // ENFORCED confirmation gate — spending requires confirm: true.
    if (confirm !== true) {
      return [
        'CONFIRMATION REQUIRED — this will spend real tokens.',
        '',
        `Item:    ${item_id}`,
        `Pair:    ${item.language_pair.replace('>', ' → ')}`,
        `Model:   ${item.model}`,
        `Est. cost: ${fmtCost(item)} (actual depends on provider pricing)`,
        '',
        // A single-item `mt-eval run` is scored locally and is NOT
        // auto-published under the MCP (publishing is the budget/top queue
        // flow). State it so the agent isn't surprised either way; the
        // publish:false param applies to budget/top runs.
        'Note: a single-item run is scored locally and is NOT auto-published '
        + 'to the leaderboard — publish it later with `mt-eval publish`, or use '
        + 'budget/top queue mode to auto-publish.',
        '',
        'Confirm with the user first, then call run_benchmark again with '
        + 'confirm: true to proceed. Or pass dry_run: true to preview without '
        + 'spending.',
      ].join('\n');
    }

    // Launch in the BACKGROUND and return a job handle immediately. A real run
    // would otherwise blow past the client's 60s request timeout. The agent
    // polls get_run_status with the returned job id.
    const job = launchJob({
      argv,
      mode: 'item',
      label: `${item.language_pair.replace('>', ' → ')}  ${item.model}  [${item.condition}]`,
      estLabel: fmtCost(item),
      timeout: 600_000, // 10 minute subprocess timeout for a single run
      exec,
    });
    return formatJobStarted(job);
  }

  // ----- Queue mode (budget / top) -----------------------------------------
  const args = ['queue'];
  if (budget != null) args.push('--budget', String(budget));
  if (top != null) args.push('--top', String(top));
  if (provider) args.push('--provider', provider);

  // Determinism: estimate_cost / list_queue preview the queue with the
  // deterministic top-order filterQueue (no anti-collision spread). The
  // harness, however, turns spread ON by default for --budget (the mass
  // curl|bash donate flow, where many workers must fan out). Under the MCP a
  // single agent-mediated run just executed a previewed plan, so pass
  // --no-spread to make the EXECUTED selection match that preview item-for-item
  // instead of a spread-permuted set the user never saw. (No-op for --top,
  // which is already deterministic; harmless to pass.)
  args.push('--no-spread');

  // Prod-write opt-out. Queue runs auto-publish each result to the public
  // leaderboard by default. publish:false threads --no-publish so an agent can
  // run a scoring/validation pass with NO leaderboard write (and the harness
  // then skips OAuth entirely).
  if (publish === false) args.push('--no-publish');

  if (dry_run) {
    args.push('--dry-run');
    // Background even the dry-run: `mt-eval queue` loads the FULL ranked
    // queue before printing its plan (the DB queue is 211k+ items — minutes
    // of paging on harness versions that drain it), so awaiting it inline
    // blew the client's 60s request timeout every time. The plan lands in
    // the job's output; the agent polls get_run_status like any run.
    const scope = budget != null
      ? `dry-run plan for up to $${Number(budget).toFixed(2)}`
      : top != null
        ? `dry-run plan for the top ${top} item(s)`
        : 'dry-run plan for the full queue';
    const job = launchJob({
      argv: args,
      mode: 'queue',
      dryRun: true,
      label: scope,
      publish,
      timeout: 1800_000,
      exec,
    });
    return formatJobStarted(job);
  }

  // ENFORCED bound on scope. Without a selector, argv is
  // `mt-eval queue --no-spread --yes` — the WHOLE queue (thousands of items),
  // with no dollar figure anywhere in the confirmation text to warn the agent
  // or the user. A run must always name how much it may spend (--budget) or
  // how many items it may take (--top). dry_run is exempt: previewing the full
  // queue plan costs nothing.
  if (budget == null && top == null) {
    return [
      'REFUSED — an unbounded queue run is not allowed.',
      '',
      'Calling run_benchmark with no budget, no top and no item_id would run '
      + 'the ENTIRE queue (thousands of paid model calls).',
      '',
      'Pass exactly one bound:',
      '  • budget: 5          — spend at most $5.00, harness picks the items',
      '  • top: 10            — run the top 10 queue items',
      '  • item_id: "<id>"    — run one specific item',
      '',
      'Use estimate_cost first to see what a given bound would cost, or '
      + 'dry_run: true to preview the full queue plan without spending.',
    ].join('\n');
  }

  // ENFORCED confirmation gate for spend.
  if (confirm !== true) {
    const scope = budget != null
      ? `up to $${Number(budget).toFixed(2)} of estimated spend`
      : `the top ${top} item(s)`;
    const publishLine = publish === false
      ? 'Results will NOT be published (scoring/validation only — no leaderboard write).'
      : 'Each result will be published to the public leaderboard.';
    return [
      'CONFIRMATION REQUIRED — this will spend real tokens.',
      '',
      `This would run ${scope} from the top of the queue.`,
      publishLine,
      '',
      'Confirm with the user first, then call run_benchmark again with '
      + 'confirm: true to proceed. Or pass dry_run: true to preview the plan '
      + 'without spending.',
    ].join('\n');
  }

  // Confirmation happened here, at the MCP boundary. Pass --yes so mt-eval
  // does not block on its own interactive prompt — there is no TTY under MCP
  // stdio, so that prompt would hang (or, with an inherited stdin, consume the
  // JSON-RPC stream).
  args.push('--yes');

  // Launch in the BACKGROUND and return a job handle immediately — a queue run
  // can span many model calls and minutes, far past the client's 60s request
  // timeout. The agent polls get_run_status with the returned job id.
  const scope = budget != null
    ? `up to $${Number(budget).toFixed(2)} from the top of the queue`
    : `the top ${top} item(s) from the queue`;
  const job = launchJob({
    argv: args,
    mode: 'queue',
    label: scope,
    publish,
    timeout: 1800_000, // 30 minute subprocess timeout for queue runs
    exec,
  });
  return formatJobStarted(job);
}
