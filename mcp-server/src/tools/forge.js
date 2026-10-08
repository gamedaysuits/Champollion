/**
 * forge_* — drive nmt-forge (the NMT training suite) from an agent, one
 * guarded step at a time.
 *
 * get_training_guardrails answers "what are the rules?"; these tools answer
 * "where am I and what do I run next?" against a real workspace. Every tool
 * shells out to the forge CLI with `--json` (nmt-forge ≥ 0.2.0: exactly one
 * JSON document on stdout, chatter on stderr — forge/docs/JSON_OUTPUT.md) and
 * relays the structured result. forge's refusals come back as
 * `{"error": {type, guard, message, why, fix, …}}` + exit 2 and are relayed
 * as a tool error with what/why/fix — a refusal is the product, the guard
 * doing its job — never as raw stderr or a traceback.
 *
 * Two forge commands are deliberately NOT tools, because they outlive any MCP
 * call: `nmt-forge run` (training — minutes on a CPU for the default preset,
 * hours on a GPU) and `nmt-forge serve` (a long-running HTTP server). Both
 * are terminal steps; forge_status hands back their exact commands.
 * forge_export (score the test battery once + package the model) and
 * forge_evaluate (score only) close the loop after a run.
 *
 * WHERE FORGE COMES FROM — first hit wins, every miss is recorded:
 *   1. NMT_FORGE_BIN            an explicit console script (override)
 *   2. CHAMPOLLION_FORGE_DIR    a Champollion clone's forge/ directory, run as
 *                               `python -m nmt_forge.cli` with PYTHONPATH set.
 *                               Set-but-wrong is an ERROR, never skipped past.
 *   3. the monorepo sibling     mcp-server/../forge (development checkouts)
 *   4. `nmt-forge` on PATH      what `python3 -m pip install nmt-forge` puts there
 *   5. the active Python        `python -m nmt_forge.cli` when nmt_forge is
 *                               importable (python3 -m pip install into a venv whose
 *                               scripts dir is not on PATH)
 * None → an actionable error naming the install command, not a traceback.
 */

import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// src/tools/forge.js → mcp-server root is two levels up
const MCP_ROOT = resolve(HERE, '../..');

/** How to install forge — one wording, used by every error path. */
export const FORGE_INSTALL_HINT = 'Install nmt-forge (0.2.0 or later): `python3 -m pip install nmt-forge` '
  + "(add the training backend with `python3 -m pip install 'nmt-forge[hf]'`; scoring uses "
  + 'the eval harness, which nmt-forge depends on — `python3 -m pip install mt-eval-harness`). '
  + 'Or point CHAMPOLLION_FORGE_DIR at the forge/ directory of a Champollion clone '
  + '(https://github.com/gamedaysuits/Champollion).';

/** Absolute path to the forge/ package directory a clone/monorepo would use. */
export function forgeDir() {
  return process.env.CHAMPOLLION_FORGE_DIR || resolve(MCP_ROOT, '../forge');
}

/** First executable named `cmd` on PATH, or null. No shell. */
export function whichSync(cmd, env = process.env) {
  const exts = process.platform === 'win32'
    ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const dir of String(env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = join(dir, cmd + ext);
      try {
        accessSync(p, constants.X_OK);
        if (statSync(p).isFile()) return p;
      } catch { /* not here */ }
    }
  }
  return null;
}

/** Can `python` import nmt_forge (a pip install)? Async, bounded, no shell. */
function probeImport(python, env) {
  return new Promise((done) => {
    let proc;
    try {
      proc = spawn(python, ['-c', 'import nmt_forge'], {
        stdio: ['ignore', 'ignore', 'ignore'], env, timeout: 15_000,
      });
    } catch {
      done(false);
      return;
    }
    proc.on('close', (code) => done(code === 0));
    proc.on('error', () => done(false));
  });
}

/**
 * Resolve how to launch forge on THIS machine (see the module docstring).
 * Injectable for tests; never throws.
 *
 * @returns {Promise<{kind: 'bin'|'dir'|'module'|'missing', cmd?: string,
 *   dir?: string, python?: string, how: string, tried: string[]}>}
 */
export async function resolveForgeLauncher({
  env = process.env,
  exists = existsSync,
  which = (cmd) => whichSync(cmd, env),
  canImport = probeImport,
  siblingDir = resolve(MCP_ROOT, '../forge'),
} = {}) {
  const tried = [];
  const python = env.PYTHON_BIN || 'python3';

  if (env.NMT_FORGE_BIN) {
    return { kind: 'bin', cmd: env.NMT_FORGE_BIN, how: 'NMT_FORGE_BIN', tried };
  }
  if (env.CHAMPOLLION_FORGE_DIR) {
    const dir = env.CHAMPOLLION_FORGE_DIR;
    if (exists(join(dir, 'nmt_forge'))) {
      return { kind: 'dir', dir, python, how: `CHAMPOLLION_FORGE_DIR (${dir})`, tried };
    }
    // The user pointed somewhere specific — obey or fail, never fall past it.
    return {
      kind: 'missing',
      how: 'CHAMPOLLION_FORGE_DIR',
      tried: [`CHAMPOLLION_FORGE_DIR=${dir} (no nmt_forge/ package there)`],
      error: `CHAMPOLLION_FORGE_DIR points at ${dir}, which has no nmt_forge/ `
        + 'package. Point it at the forge/ directory of a Champollion clone, or '
        + 'unset it to use a pip install (`python3 -m pip install nmt-forge`).',
    };
  }
  tried.push('NMT_FORGE_BIN (unset)', 'CHAMPOLLION_FORGE_DIR (unset)');

  if (exists(join(siblingDir, 'nmt_forge'))) {
    return { kind: 'dir', dir: siblingDir, python, how: 'the monorepo checkout', tried };
  }
  tried.push(`${siblingDir} (no monorepo forge/ here)`);

  const onPath = which('nmt-forge');
  if (onPath) return { kind: 'bin', cmd: onPath, how: '`nmt-forge` on PATH (pip install)', tried };
  tried.push('`nmt-forge` on PATH (not found)');

  if (await canImport(python, env)) {
    return { kind: 'module', python, how: `\`${python} -m nmt_forge.cli\` (python3 -m pip install in the active Python)`, tried };
  }
  tried.push(`\`${python} -c "import nmt_forge"\` (not importable)`);

  return { kind: 'missing', how: 'none', tried, error: `nmt-forge is not installed here. ${FORGE_INSTALL_HINT}` };
}

/**
 * Build the argv + env to invoke a forge subcommand — PURE, unit-testable.
 *
 * The global `--workspace` flag precedes the subcommand (argparse layout).
 * Callers pass already-validated positionals/flags in `subArgs`. Without a
 * resolved `launcher`, the env-only default applies (NMT_FORGE_BIN, else the
 * clone/monorepo directory) — the pre-0.2 behavior.
 *
 * `projectDir` is the directory forge runs FROM. forge's own advice is
 * `cd <project> && nmt-forge …`: config.json's paths (`data/split/…`, the
 * `.forge` workspace) and every relative path argument resolve against the
 * working directory, so a server started elsewhere must run forge there.
 *
 * @param {string[]} subArgs  subcommand + its args, e.g. ['status', '--json']
 * @param {{workspace?: string, launcher?: object, projectDir?: string}} [opts]
 * @returns {{cmd: string, args: string[], env: object, cwd: string}}
 */
export function buildForgeInvocation(subArgs, { workspace, launcher, projectDir } = {}) {
  const ws = workspace || process.env.CHAMPOLLION_FORGE_WORKSPACE || '.forge';
  const globals = ['--workspace', ws];
  const cwd = projectDir ? resolve(projectDir) : process.cwd();
  const l = launcher || (process.env.NMT_FORGE_BIN
    ? { kind: 'bin', cmd: process.env.NMT_FORGE_BIN }
    : { kind: 'dir', dir: forgeDir(), python: process.env.PYTHON_BIN || 'python3' });

  if (l.kind === 'bin') {
    // a relative script path must not change meaning when cwd moves
    const cmd = /[\\/]/.test(l.cmd) ? resolve(l.cmd) : l.cmd;
    return { cmd, args: [...globals, ...subArgs], env: { ...process.env }, cwd };
  }
  const python = l.python || process.env.PYTHON_BIN || 'python3';
  const env = { ...process.env };
  if (l.kind === 'dir') {
    const dir = resolve(l.dir);
    env.PYTHONPATH = process.env.PYTHONPATH ? `${dir}${delimiter}${process.env.PYTHONPATH}` : dir;
  }
  return { cmd: python, args: ['-m', 'nmt_forge.cli', ...globals, ...subArgs], env, cwd };
}

/** Translate the common cold-start failures (no JSON answer) into the fix. */
export function explainForgeFailure(stderr) {
  const hints = [];
  if (/No module named '?nmt_forge'?/.test(stderr)) {
    hints.push(`[forge] nmt_forge is not importable. ${FORGE_INSTALL_HINT}`);
  }
  if (/No module named '?mt_eval_harness'?/.test(stderr)) {
    hints.push('[forge] the eval harness is missing — forge scores ONLY through it: `python3 -m pip install mt-eval-harness`.');
  }
  if (/No module named '?(torch|transformers|peft|accelerate)'?/.test(stderr)) {
    hints.push("[forge] the training backend is missing: `python3 -m pip install 'nmt-forge[hf]'`.");
  }
  if (/unrecognized arguments:.*--json/.test(stderr)) {
    hints.push('[forge] this nmt-forge predates 0.2.0 (the subcommand has no --json). These tools '
      + 'need nmt-forge 0.2.0 or later: `python3 -m pip install -U nmt-forge`.');
  }
  if (/language-cards directory not found/i.test(stderr)) {
    hints.push('[forge] this nmt-forge predates 0.2.0, which resolves language cards on its own '
      + '(a card directory → a checkout → the public card index, cached). Upgrade: '
      + '`python3 -m pip install -U nmt-forge`. Or set CHAMPOLLION_CARDS_DIR to a directory of '
      + '<code>.json cards (`champollion network card <code> --json > cards/<code>.json`). '
      + 'Meanwhile get_language / language_overview answer the same question.');
  }
  return hints;
}

/** Per-call bound for bookkeeping commands (status, split, prereg, …), ms. */
export const FORGE_TIMEOUT_MS = 120_000;
/**
 * Per-call bound for the scoring commands (evaluate, export), ms. They decode
 * the whole test battery with the trained model: seconds for the CPU preset
 * on a few hundred rows, much longer for a large model on a CPU. Past this
 * bound the tool stops forge and names the terminal command instead.
 */
export const FORGE_SCORING_TIMEOUT_MS = 600_000;
/** After a timeout's SIGINT, how long forge gets to clean up before SIGKILL, ms. */
export const FORGE_KILL_GRACE_MS = 10_000;

/**
 * Spawn forge, capture output. No shell. stdin ignored (MCP stdio parent's
 * stdin is the JSON-RPC stream — a child must never read it). Bounded: past
 * `timeout` forge gets SIGINT — Python turns it into KeyboardInterrupt, so
 * forge's own cleanup runs (a failed export removes its half-written
 * directory) — and SIGKILL if it is still alive FORGE_KILL_GRACE_MS later.
 *
 * @param {string[]} subArgs
 * @param {{workspace?: string, timeout?: number, launcher?: object, projectDir?: string}} [opts]
 * @returns {Promise<{code: number, signal: string|null, timedOut: boolean,
 *   stdout: string, stderr: string, launcher: object}>}
 */
export async function runForge(subArgs, {
  workspace, timeout = FORGE_TIMEOUT_MS, launcher, projectDir,
} = {}) {
  const l = launcher || await resolveForgeLauncher();
  if (l.kind === 'missing') {
    const err = new Error(l.error);
    err.forgeMissing = true;
    err.tried = l.tried;
    throw err;
  }
  if (projectDir && !isDirectory(projectDir)) {
    throw new Error(`project_dir ${projectDir} is not a directory on this machine. Create the `
      + 'project first (forge_init with dir set to it), or pass the `project` path forge_init returned.');
  }
  const { cmd, args, env, cwd } = buildForgeInvocation(subArgs, { workspace, launcher: l, projectDir });
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env, cwd });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let hardKill = null;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGINT');
      hardKill = setTimeout(() => proc.kill('SIGKILL'), FORGE_KILL_GRACE_MS);
    }, timeout);
    const stop = () => { clearTimeout(timer); clearTimeout(hardKill); };
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code, signal) => {
      stop();
      if ((code ?? 1) !== 0) {
        const hints = explainForgeFailure(stderr);
        if (hints.length) stderr += `\n${hints.join('\n')}`;
      }
      resolvePromise({ code: code ?? 1, signal: signal ?? null, timedOut, stdout, stderr, launcher: l });
    });
    proc.on('error', (err) => {
      stop();
      reject(new Error(`could not launch forge (${cmd}, via ${l.how}): ${err.message}. ${FORGE_INSTALL_HINT}`));
    });
  });
}

function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Shell-quote one argument for a copy-pasteable command line. */
function shq(arg) {
  const s = String(arg);
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

/** The command a human would type for this call (what to run in a terminal). */
export function forgeCommandLine(subArgs, workspace) {
  const ws = workspace || process.env.CHAMPOLLION_FORGE_WORKSPACE || '.forge';
  return ['nmt-forge', '--workspace', ws, ...subArgs].map(shq).join(' ');
}

/**
 * forge command → the forge_* tool that runs it. `null` = no tool: training
 * (`run`), the HTTP server (`serve`) and the GUI (`monitor`) outlive any MCP
 * call; the rest are expert commands an agent runs in a terminal.
 * Longest match first ("registry add" before "registry").
 *
 * Exported: instructions.md states this mapping, and a test checks that
 * every flag forge's advice names on a mapped command is an argument of its
 * tool (Round 9: forge advised `--config-hash`, forge_prereg had no such
 * argument).
 */
export const FORGE_COMMAND_TOOLS = [
  ['registry add-harness', null], ['registry add', 'forge_register_eval'],
  ['prereg template', 'forge_prereg_template'], ['prereg new', 'forge_prereg'],
  ['prereg verdict', 'forge_prereg_verdict'], ['prereg check', null],
  ['status', 'forge_status'], ['preflight', 'forge_preflight'],
  ['discover', 'forge_discover'], ['init', 'forge_init'], ['split', 'forge_split'],
  ['leak-audit', 'forge_leak_audit'], ['evaluate', 'forge_evaluate'],
  ['export', 'forge_export'], ['lint', 'forge_lint'], ['report', 'forge_report'],
  ['compare', 'forge_compare'],
  ['run', null], ['serve', null], ['monitor', null], ['score', null],
  ['sample', null], ['synth', null], ['verify-split', null],
];

/**
 * A forge CLI flag → the tool argument that carries it: `--clean-to` →
 * `clean_to`; `--held` / `--missed` → `verdict`. `--json` and `--workspace`
 * are added by every tool itself.
 */
export function forgeFlagArg(flag) {
  const f = String(flag).replace(/^--/, '');
  if (f === 'held' || f === 'missed') return 'verdict';
  return f.replace(/-/g, '_');
}

/**
 * Flags no tool takes ON PURPOSE (each one's reason): an agent must never
 * be the one to pass them.
 */
export const FORGE_FLAGS_NEVER_TOOLS = {
  '--show-text': 'prints a withheld (local-only / sealed) corpus\'s sentences — for a person at the terminal, never an agent',
  '--json': 'every tool adds it',
  '--workspace': 'every tool takes `workspace`',
  '--help': 'not a step',
};

/**
 * Map every `nmt-forge <command>` named in a piece of forge text (an advice
 * line, a fix string) to the tool that runs it, in order of mention, deduped.
 * A command with no tool comes back as "terminal: nmt-forge <command>".
 *
 * @param {string} text
 * @returns {string[]}
 */
export function forgeToolsIn(text) {
  const out = [];
  const src = String(text || '');
  for (const m of src.matchAll(/(?<!(?:install|-U)\s+)\bnmt-forge\s+([a-z][a-z-]*)(?:\s+([a-z][a-z-]*))?/g)) {
    // `nmt-forge init --help` / argparse's `nmt-forge init: …` name no step to run
    if (/^(\s*--help|:)/.test(src.slice(m.index + m[0].length))) continue;
    const two = m[2] ? `${m[1]} ${m[2]}` : null;
    const hit = FORGE_COMMAND_TOOLS.find(([c]) => c === two)
      || FORGE_COMMAND_TOOLS.find(([c]) => c === m[1]);
    const label = hit && hit[1] ? hit[1] : `terminal: nmt-forge ${hit ? hit[0] : m[1]}`;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/** A refusal envelope as forge ≥ 0.2.0 prints it under --json. */
function isErrorEnvelope(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && v.error !== null && typeof v.error === 'object' && !Array.isArray(v.error);
}

/**
 * Render forge's `{"error": {type, guard, message, why, fix, how_to_get,
 * text}}` as what/why/fix lines for the agent. Guard refusals carry why/fix
 * as fields (and render them into `text` too); plain ForgeErrors carry them
 * only inline in `text` — both come out once.
 *
 * @param {object} error    the envelope's `error` object
 * @param {{exitCode?: number, command?: string}} [ctx]
 * @returns {string}
 */
export function formatForgeError(error, { exitCode, command } = {}) {
  const e = error || {};
  const kind = [e.type, e.guard ? `guard: ${e.guard}` : null, exitCode != null ? `exit ${exitCode}` : null]
    .filter(Boolean).join(', ');
  // the part of `text` that is not a rendering of the structured fields
  let head = String(e.text || e.message || e.type || 'forge refused without a message');
  for (const [field, marker] of [['why', '\n  why: '], ['fix', '\n  fix: '], ['how_to_get', '\n  how to get it: ']]) {
    const i = e[field] ? head.indexOf(marker) : -1;
    if (i >= 0) head = head.slice(0, i);
  }
  const lines = [`forge refused (${kind || 'error'})${command ? `: ${command}` : ''}`, `what: ${head.trim()}`];
  if (e.why) lines.push(`why: ${e.why}`);
  if (e.fix) lines.push(`fix: ${e.fix}`);
  if (e.how_to_get) lines.push(`how to get it: ${e.how_to_get}`);
  const tools = forgeToolsIn([head, e.fix, e.how_to_get].filter(Boolean).join('\n'));
  if (tools.length) lines.push(`(as tools: ${tools.join(', ')})`);
  return lines.join('\n');
}

/** Parse forge's stdout as exactly one JSON document. */
function parseJsonDocument(stdout) {
  const s = String(stdout || '').trim();
  if (!s) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

/** The last stderr line that says something (not a traceback frame). */
function lastMessage(stderr) {
  const lines = String(stderr || '').split('\n')
    .filter((l) => l.trim() && !/^\s/.test(l) && !/^Traceback \(most recent call last\)/.test(l)
      && !/^\[forge\] /.test(l));
  return lines.length ? lines[lines.length - 1].trim().slice(0, 400) : null;
}

/** forge exited without a JSON document on stdout — say why, never dump a traceback. */
function formatNoJson(res, command) {
  if (res.code === 0) {
    const printed = res.stdout.trim();
    return `forge answered in text, not JSON: ${command}\n`
      + 'These tools need nmt-forge 0.2.0 or later, where every subcommand takes --json. '
      + 'Upgrade: `python3 -m pip install -U nmt-forge`.'
      + (printed ? `\nforge printed:\n${printed.slice(0, 2000)}${printed.length > 2000 ? '\n…' : ''}` : '');
  }
  const lines = [`forge failed (exit ${res.code}${res.signal ? `, ${res.signal}` : ''}) without an answer: ${command}`];
  const hints = explainForgeFailure(res.stderr);
  if (hints.length) {
    lines.push(...hints);
  } else {
    const last = lastMessage(res.stderr);
    if (last) lines.push(`forge's last message: ${last}`);
    lines.push('This is not a guard refusal (those come back as what/why/fix): it is an environment '
      + 'problem or a forge bug. Run the same command in a terminal to see forge\'s full output.');
  }
  return lines.join('\n');
}

/**
 * Run a forge subcommand under `--json` and shape the MCP result.
 *
 * - exit 0 + a JSON payload → `{result, summary?, next?}` (isError false);
 * - `{"error": …}` (a refusal) → what/why/fix text + the envelope as JSON
 *   (isError true);
 * - no JSON on stdout → the cold-start fix, or an "upgrade nmt-forge" note
 *   when forge answered in text (isError true);
 * - past the bound → forge is stopped and the terminal command is named.
 *
 * @param {string[]} subArgs  subcommand + args; `--json` is added when absent
 * @param {object} [opts]
 * @param {string} [opts.workspace]
 * @param {string} [opts.projectDir]  the directory forge runs from
 * @param {string|function} [opts.nextHint]  text, or (result, exitCode) => text|null
 * @param {function} [opts.summarize]  (result, exitCode) => object, returned as `summary`
 * @param {number[]} [opts.okExitCodes]  exit codes whose payload is an ANSWER
 *   (preflight exits 2 when a gate fails — the failing gates are the answer)
 * @param {number} [opts.timeout]
 * @param {object} [opts.launcher]
 * @returns {Promise<{content: Array, isError: boolean}>}
 */
export async function forgeTool(subArgs, {
  workspace, projectDir, nextHint, summarize, okExitCodes = [0],
  timeout = FORGE_TIMEOUT_MS, launcher,
} = {}) {
  const argv = subArgs.includes('--json') ? [...subArgs] : [...subArgs, '--json'];
  const command = forgeCommandLine(argv, workspace);
  const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
  let res;
  try {
    res = await runForge(argv, { workspace, launcher, timeout, projectDir });
  } catch (err) {
    const tried = Array.isArray(err.tried) && err.tried.length
      ? `\nLooked for forge in: ${err.tried.join('; ')}.` : '';
    return fail(`${err.message}${tried}`);
  }
  if (res.timedOut) {
    const bound = timeout >= 1000 ? `${Math.round(timeout / 1000)} s` : `${timeout} ms`;
    return fail(`forge did not finish within ${bound} and was stopped: ${command}\n`
      + 'This step can legitimately take longer (decoding a test battery with a large model on a CPU). '
      + `Run it in a terminal instead${projectDir ? ` (from ${projectDir})` : ''}, then call forge_status — `
      + 'it reads the result from the workspace.');
  }
  const parsed = parseJsonDocument(res.stdout);
  if (parsed.ok && isErrorEnvelope(parsed.value)) {
    return {
      content: [
        { type: 'text', text: formatForgeError(parsed.value.error, { exitCode: res.code, command }) },
        { type: 'text', text: JSON.stringify({ error: parsed.value.error, exit_code: res.code }, null, 2) },
      ],
      isError: true,
    };
  }
  if (!parsed.ok) return fail(formatNoJson(res, command));
  if (!okExitCodes.includes(res.code)) {
    return fail(`forge exited ${res.code} with a result but no error: ${command}\n`
      + JSON.stringify({ result: parsed.value, exit_code: res.code }, null, 2));
  }
  const out = { result: parsed.value };
  if (res.code !== 0) out.exit_code = res.code;
  const summary = summarize ? summarize(parsed.value, res.code) : null;
  if (summary) out.summary = summary;
  const next = typeof nextHint === 'function' ? nextHint(parsed.value, res.code) : nextHint;
  if (next) out.next = next;
  return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false };
}

// ---------------------------------------------------------------------------
// forge_compare: the result travels with its caveats. `nmt-forge compare`
// printed "winner=all-data" while every test row had a near-twin in
// all-data's training set (Round 9 school persona); forge now says so in
// result.caveats, and the summary carries them beside the winner.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// mt-eval's score caveats (Round 13). The harness writes `score_caveats` into
// the TestReport (a near-constant output, length inflation/deflation, source
// copies, forge's own near-twin reading echoed back); forge relays the list
// verbatim on export, status, compare and lint (forge/nmt_forge/
// harness_caveats.py). The MCP relays forge's list as it came — never
// reworded, never recomputed — and a MAJOR one goes WITH any score it
// qualifies (the hospital persona's twin-free model gave one of 9 outputs
// for 150 sources, and every surface called its chrF++ "the number to
// quote"). No list (an older harness, or nothing to qualify) → nothing said.
// ---------------------------------------------------------------------------

/** The kind/source of forge's OWN near-twin reading, echoed back by the harness (said elsewhere already). */
const FORGE_NEAR_TWIN = { kind: 'train_test_near_twin', source: 'nmt-forge' };

/** forge's list as it came (objects only), or null when there is none to relay. */
export function relayCaveats(list) {
  if (!Array.isArray(list)) return null;
  const out = list.filter((c) => c && typeof c === 'object' && !Array.isArray(c));
  return out.length ? out : null;
}

/** The MAJOR caveats a hint must put first — all but forge's own near-twin reading. */
export function majorCaveats(list) {
  return (relayCaveats(list) || []).filter((c) => c.severity === 'major'
    && !(c.kind === FORGE_NEAR_TWIN.kind && c.source === FORGE_NEAR_TWIN.source));
}

/** forge_compare's summary: each lane's result, and the caveats beside it. */
export function compareSummary(r) {
  if (!r || typeof r !== 'object' || !r.results || typeof r.results !== 'object') return null;
  const results = {};
  for (const [m, x] of Object.entries(r.results)) {
    results[m] = {
      delta: x?.delta ?? null,
      ci: [x?.ci_lower ?? null, x?.ci_upper ?? null],
      p: x?.p_value ?? null,
      significant: x?.significant === true,
      winner: x?.significant ? (x?.winner ?? null) : null,
    };
  }
  const out = { results };
  const recall = Object.entries(r.near_twin || {})
    .filter(([, v]) => v && v.recall_not_translation === true).map(([k]) => k);
  if (recall.length) out.recall_not_translation = recall;
  const unchecked = Object.entries(r.near_twin || {})
    .filter(([, v]) => !v || v.checked !== true).map(([k]) => k);
  if (unchecked.length) out.near_twins_unchecked = unchecked;
  if (Array.isArray(r.caveats) && r.caveats.length) out.caveats = r.caveats;
  // mt-eval's caveats on each system's outputs, verbatim (Round 13)
  const sc = {};
  for (const [label, list] of Object.entries(r.score_caveats && typeof r.score_caveats === 'object' ? r.score_caveats : {})) {
    const kept = relayCaveats(list);
    if (kept) sc[label] = kept;
  }
  if (Object.keys(sc).length) {
    out.score_caveats = sc;
    const flagged = Object.entries(sc).filter(([, list]) => majorCaveats(list).length).map(([k]) => k);
    if (flagged.length) out.score_caveats_major = flagged;
  }
  return out;
}

/** The next step after forge_compare: relay the caveats WITH the winner. */
export function compareNextHint(r) {
  const s = compareSummary(r);
  if (!s) return null;
  // a MAJOR harness caveat comes first, whatever else is said (Round 13)
  const first = s.score_caveats_major
    ? `relay summary.caveats — mt-eval qualifies ${s.score_caveats_major.join(' and ')}'s outputs `
      + '(summary.score_caveats, in its words); no score here is quotable without its caveat. '
    : '';
  return first + compareRest(s);
}

function compareRest(s) {
  if (s.recall_not_translation) {
    return `relay summary.caveats with the result — never the winner alone: ${s.recall_not_translation.join(', ')} `
      + 'scored on recall of training phrases (most test rows have a near-twin in its training data). '
      + 'Compare twin-free numbers (each export\'s strict subset in forge_report, or a model trained with '
      + 'forge_leak_audit drop_test_twins) before anyone says which model translates better.';
  }
  if (s.near_twins_unchecked) {
    return `near-twins were not checked for ${s.near_twins_unchecked.join(', ')} — pass run_a / run_b `
      + '(that model\'s run-manifest.json) so forge checks its training data, or compare the hypotheses an '
      + 'export wrote: forge_export\'s result.hypotheses (<export>/evaluation/battery-hyps.jsonl) as hyps_a / '
      + 'hyps_b — forge then also relays mt-eval\'s caveats on that export\'s outputs. Relay summary.caveats '
      + 'with the result.';
  }
  return 'relay the result with its CIs and summary.caveats; a difference inside the CI on Δ is not a ranking.';
}

// ---------------------------------------------------------------------------
// forge_lint: the hint follows the findings. With none it used to say "act on
// the highest-severity finding's lever" anyway (Round 5 hospital persona).
// ---------------------------------------------------------------------------

const LINT_SEVERITY_ORDER = ['high', 'medium', 'info'];

/** {high, medium, info} counts of `nmt-forge lint --json` findings. */
export function lintSeverityCounts(findings) {
  const out = { high: 0, medium: 0, info: 0 };
  for (const f of findings ?? []) {
    if (f && Object.hasOwn(out, f.severity)) out[f.severity] += 1;
  }
  return out;
}

/** forge's rule for mt-eval's own caveat on the scores (Round 13). */
export const LINT_HARNESS_CAVEAT_RULE = 'R9-harness-score-caveat';

/** forge_lint's summary: counts by severity, and every R9 finding's words. */
export function lintSummary(findings) {
  if (!Array.isArray(findings)) return null;
  const out = { findings: findings.length, by_severity: lintSeverityCounts(findings) };
  const r9 = findings.filter((f) => f?.rule === LINT_HARNESS_CAVEAT_RULE);
  if (r9.length) {
    out.harness_score_caveats = r9.map((f) => ({ severity: f.severity, recommendation: f.recommendation }));
  }
  return out;
}

/** The next step after forge_lint, conditional on what it found. */
export function lintNextHint(findings) {
  if (!Array.isArray(findings)) return null;
  const r9 = findings.filter((f) => f?.rule === LINT_HARNESS_CAVEAT_RULE);
  const first = r9.length
    ? `first relay summary.harness_score_caveats with the scores — mt-eval qualifies them (${LINT_HARNESS_CAVEAT_RULE}, `
      + `${r9.map((f) => f.severity).join(', ')}); never quote a score without them. `
    : '';
  const rest = lintRest(findings.filter((f) => f?.rule !== LINT_HARNESS_CAVEAT_RULE), r9.length > 0);
  return first + rest;
}

function lintRest(findings, hadR9) {
  if (findings.length === 0 && hadR9) {
    return 'No other finding: nothing here says which lever to pull.';
  }
  if (findings.length === 0) {
    return 'no findings: the battery shows no weak register this linter can explain. '
      + 'Read the scores and their CIs (forge_report on the same manifest); nothing here '
      + 'says which lever to pull, so do not invent one.';
  }
  const rank = (f) => {
    const i = LINT_SEVERITY_ORDER.indexOf(f?.severity);
    return i < 0 ? LINT_SEVERITY_ORDER.length : i;
  };
  const top = [...findings].sort((a, b) => rank(a) - rank(b))[0];
  if (top?.severity === 'info') {
    return `only informational findings (${findings.length}) — nothing to fix; read them `
      + '(e.g. the measurement caveats) before quoting the scores.';
  }
  return `act on the highest-severity finding: ${top.rule} (${top.severity}) → lever `
    + `${top.lever}${top.group ? ` for ${top.group}` : ''}; then re-run and re-evaluate.`;
}

// ---------------------------------------------------------------------------
// forge_discover: two readers, one card. forge reads the card the harness
// resolves — from a python3 -m pip install with no CLI card nearby, the PUBLIC card
// index, whose published rows can lag the full card. language_overview
// reads the champollion CLI's own card through its adapter. Round 10 (school
// and researcher, third round running): language_overview listed a
// dictionary and a long grammar for crk while forge_discover said
// dictionaries [] — two true reports of two different sources, side by side
// with nothing saying so. The MCP holds both answers: it puts the CLI card's
// lexical resources beside forge's, each attributed to its source, and never
// invents a value either source lacks.
// ---------------------------------------------------------------------------

/**
 * What the CLI's card cites that forge's source did not give it.
 *
 * @param {object} r     forge's discover --json result (ResourceReport)
 * @param {object|null} cli  getLanguage() result for the same code (status ok), or null
 * @returns {object|null} `{forge_source, cli_card, dictionaries?, documentation?, note}` — null when nothing differs
 */
export function discoverCardCrossCheck(r, cli) {
  if (!r || typeof r !== 'object' || !cli || cli.status !== 'ok') return null;
  const R = cli.summary?.resources ?? {};
  const forgeDicts = Array.isArray(r.dictionaries) ? r.dictionaries : [];
  const forgeHasGrammar = (Array.isArray(r.grammars) && r.grammars.length) || Boolean(r.documentation);
  const out = {};
  if (!forgeDicts.length && Array.isArray(R.dictionaries) && R.dictionaries.length) {
    out.dictionaries = R.dictionaries.map((d) => ({
      name: d.name, publisher: d.publisher ?? null, url: d.url ?? null, license: d.license ?? null,
    }));
  }
  if (!forgeHasGrammar && R.documentation) {
    out.documentation = { level: R.documentation.level, source: R.documentation.source };
  }
  if (!Object.keys(out).length) return null;
  const tier = cli.summary?.provenance?.tier ?? cli.tier ?? 'unknown';
  const what = [out.dictionaries && `${out.dictionaries.length} dictionar${out.dictionaries.length === 1 ? 'y' : 'ies'}`,
    out.documentation && `a documentation level (${out.documentation.level})`].filter(Boolean).join(' and ');
  return {
    forge_source: r.card_path ?? null,
    cli_card: tier,
    ...out,
    note: `forge read ${r.card_path || 'its card source'}, which lists no ${[
      out.dictionaries && 'dictionary', out.documentation && 'grammar/documentation level'].filter(Boolean).join(' or ')}; `
      + `the champollion CLI's card (${tier}) cites ${what} — language_overview and get_language show them. `
      + 'Both are reports of their own source: forge\'s asset ladder (rung 3) counts only what forge read. '
      + 'To give forge the CLI\'s card: `champollion network card <code> --json > cards/<code>.json`, then '
      + 'forge_discover / forge_init with cards_dir: "cards".',
  };
}

// ---------------------------------------------------------------------------
// forge_preflight: the next step it names is the ACTUAL next step. Round 10
// (hospital): every gate passed and the hint still read "fix every gate with
// ok:false…", which reads as a failure.
// ---------------------------------------------------------------------------

/** What runs a preflighted command once every gate passes. */
const PREFLIGHT_RUNS = {
  run: (config) => `\`nmt-forge run ${config || 'config.json'}\` in a terminal (training is not an MCP tool: run it in the `
    + 'background with output to a log, and call forge_status when it exits)',
  evaluate: () => 'forge_evaluate',
  export: () => 'forge_export',
  serve: () => '`nmt-forge serve <export dir>/model` in a terminal',
  score: () => 'forge_evaluate (or `nmt-forge score` in a terminal)',
  split: () => 'forge_split',
  prereg: () => 'forge_prereg_template → forge_prereg',
  'leak-audit': () => 'forge_leak_audit',
};

/**
 * forge_preflight's `next`: the failing gates' fixes when any gate fails;
 * otherwise the command itself — after the warnings, which pass but must be
 * read first.
 *
 * @param {string} target  the preflighted command
 * @param {string|undefined} config  the config argument, if any
 * @param {Array<{gate: string, ok: boolean, warning?: boolean}>} gates
 * @returns {string}
 */
export function preflightNextHint(target, config, gates) {
  if (!Array.isArray(gates)) return 'forge_status.';
  const failing = gates.filter((g) => !g.ok).map((g) => g.gate);
  if (failing.length) {
    return `fix ${failing.length === 1 ? 'the gate' : `the ${failing.length} gates`} with ok:false using `
      + `each one's fix string (${failing.join(', ')}), then re-run forge_preflight until summary.passed is true.`;
  }
  const warned = gates.filter((g) => g.ok && g.warning).map((g) => g.gate);
  const run = (PREFLIGHT_RUNS[target] ?? (() => `\`nmt-forge ${target}\``))(config);
  return `every gate passed${warned.length
    ? ` — first relay the ${warned.length === 1 ? 'warning' : 'warnings'} (${warned.join(', ')}: ok:true, `
      + 'warning:true — each detail says what the number will mean) to the user'
    : ''}. Next: ${run}.`;
}

// ---------------------------------------------------------------------------
// forge_split: relay forge's near-twin advice — and stop asking once forge
// has given its verdict. Round 11 (school persona): a corpus whose templates
// chain can have no twin-free dev set that is a sample of the data; forge
// said so, and the hint still read "follow it before training" after every
// re-split, with no stopping point. Advice forge marks settled — the dev
// twin verdict with `final: true` (no split fixes it), or a registered test
// set on the two-model route (`two_model`) — is relayed ONCE as a verdict
// the user decides on, never as a step to repeat.
// ---------------------------------------------------------------------------

const settledAdvice = (f) => f?.verdict?.final === true || Boolean(f?.two_model);

/**
 * forge_split's summary: advice still to act on before training
 * (`near_twin_advice`), forge's settled verdicts (`near_twin_verdicts`), and
 * whether the corpus's templates chain into one group.
 *
 * @param {object} r  forge's `split --json` result
 * @returns {object|null}
 */
export function splitNearTwinSummary(r) {
  const entries = [...Object.values(r?.near_twin || {}), r?.dev_near_twin]
    .filter((f) => f && typeof f === 'object' && f.advice);
  const open = [...new Set(entries.filter((f) => !settledAdvice(f)).map((f) => f.advice))];
  const settled = [...new Set(entries.filter(settledAdvice).map((f) => f.advice))];
  const chained = r?.near_dupe_carve_check?.chained === true;
  if (!open.length && !settled.length && !chained) return null;
  return {
    ...(open.length ? { near_twin_advice: open } : {}),
    ...(settled.length ? { near_twin_verdicts: settled } : {}),
    ...(chained ? { templates_chain: true } : {}),
  };
}

/**
 * forge_split's next step.
 *
 * @param {object} r  forge's `split --json` result
 * @returns {string}
 */
export function splitNextHint(r) {
  const cc = r?.config_check;
  if (cc && cc.ok === false) {
    return `${cc.message} — fix it before training: ${cc.fix}. Then forge_preflight { "target": "run" }.`;
  }
  const sum = splitNearTwinSummary(r);
  if (!sum || (!sum.near_twin_advice && !sum.near_twin_verdicts)) {
    return 'forge_status — you now have a dev set; it names what is left before training (the '
      + 'preregistrations, one per model, if they are not written yet — then forge_preflight { "target": "run" }).';
  }
  const parts = [];
  if (sum.near_twin_advice) {
    parts.push('relay summary.near_twin_advice to the user and follow it before training — its flags are '
      + 'forge_split arguments (--near-dupe → near_dupe, --max-group → max_group, --allow-rotate → '
      + 'allow_rotate)' + (sum.templates_chain && !sum.near_twin_verdicts
      ? '; the corpus\'s templates chain into one group, so a near_dupe carve alone cannot separate '
        + 'them — take the route forge names (result.near_dupe_carve_check)'
      : ''));
  }
  if (sum.near_twin_verdicts) {
    parts.push('relay summary.near_twin_verdicts to the user ONCE: they are forge\'s verdict on this corpus, '
      + 'not steps to repeat — re-splitting will not change them. The user chooses among the options each '
      + 'one names (accepting it and training is one); do not call forge_split again for them');
  }
  return `${parts.join('. ')}. Then forge_status.`;
}

// ---------------------------------------------------------------------------
// The step order: forge_init's note, its next step, forge_status in state
// `initialized` and the public guide say ONE order (Round 11 hospital
// persona: init's note said "carve a split first" while its next step and
// the guide said register, screen, predict). forge owns it
// (`scaffold.STEP_ORDER`, as `order` in `init --json` and in status's
// `advice.order`); these hints render it with the MCP tool for each step.
// ---------------------------------------------------------------------------

/**
 * forge's step order as one line of MCP tools: `forge_register_eval (register
 * the test set) → … → forge_preflight, then … (check, then train)`. forge is
 * the one source: an nmt-forge whose JSON carries no order (before
 * 2026-10-04) gets NEXT_STEPS.md's step 2 named instead of a copy here.
 *
 * @param {Array<{step: string, what: string, tool?: string}>|undefined} order
 * @returns {string}
 */
export function stepOrderText(order) {
  if (!Array.isArray(order) || !order.length) {
    return 'the order NEXT_STEPS.md step 2 gives (register the test set, screen the corpus, the predictions, '
      + 'baselines, then the split — this nmt-forge does not report its order in --json; upgrade it)';
  }
  return order.map((s) => (s.tool ? `${s.tool} (${s.what})` : s.what)).join(' → ');
}

/** What a project with no test set of its own does instead of the first two steps. */
const NO_OWN_TEST_SET = 'With no test set of their own: forge_split with test > 0 (register: "project") carves '
  + 'and registers one instead of the first two steps — the predictions still come before any score.';

/**
 * forge_init's next step.
 *
 * @param {object} r  forge's `init --json` result
 * @param {string} [dir]  the dir argument, when forge's result names no project
 * @returns {string}
 */
export function initNextHint(r, dir) {
  return `pass project_dir: ${JSON.stringify(r?.project ?? dir ?? '.')} to every later forge_* call `
    + '(config.json\'s paths are relative to it). Then, with the user\'s OWN test set kept as a separate '
    + `file (mark it local-only first), in this order: ${stepOrderText(r?.order)}. ${NO_OWN_TEST_SET} `
    + 'forge_status names each step as it comes.';
}

/**
 * forge_status's next step in state `initialized`.
 *
 * @param {object} r  forge's `status --json` result
 * @returns {string}
 */
export function initializedStatusHint(r) {
  return 'the project is initialized and no eval set is registered yet: get the parallel corpus path from '
    + 'the user. With their OWN test set kept as a separate file (mark it local-only first), in this order: '
    + `${stepOrderText(r?.advice?.order)}. ${NO_OWN_TEST_SET} Never call forge_discover / forge_init again.`;
}

// ---------------------------------------------------------------------------
// forge_status's `next` in every other state names THE step forge named.
// Round 12 (school persona): with both trainings finished (ready-to-score)
// the hint still read "run result.advice.next_command … A terminal: step
// (training: nmt-forge run config.json …)" — training, at the one point it
// was done; the export was only in result.advice.next_command. The hint is
// now built from that command: its tools in order, and the terminal text of
// only the terminal steps it holds.
// ---------------------------------------------------------------------------

/** What a terminal step of forge's next command is, said once. */
const TERMINAL_STEP_TEXT = {
  run: '`nmt-forge run <config>` trains in a terminal (not an MCP tool — the default cpu-tiny preset takes '
    + 'minutes on a CPU): run it in the background with output to a log, and call forge_status when it exits',
  serve: '`nmt-forge serve <export>/model` is a long-running HTTP server: start it in a terminal',
};

/**
 * forge_status's `next` outside the states with their own hint
 * (initialized, choose-export, exported, missing-preregistration, training).
 *
 * @param {object} r  forge's `status --json` result
 * @returns {string}
 */
export function statusNextHint(r) {
  const a = r?.advice || {};
  const cmd = String(a.next_command || '').trim();
  if (!cmd) return 'forge_status names no command — read result.advice.why and result.advice.blockers.';
  const tools = forgeToolsIn(cmd);
  const asTools = tools.filter((t) => !t.startsWith('terminal:'));
  const terminal = tools.filter((t) => t.startsWith('terminal:')).map((t) => t.replace(/^terminal: nmt-forge /, ''));
  if (a.state === 'serving') {
    return 'the chosen model is served and answering (result.advice.ready names its URL) — forge has nothing '
      + 'left to run. What is left is the app\'s: the api method config from DEPLOY.md (in the model '
      + 'directory), then `npx champollion sync` and `npx champollion verify` in the app, in a terminal '
      + '(or the translate tool, method api, endpoint <that URL>/translate). A speaker reviews the strings '
      + 'before anyone relies on them.';
  }
  if (a.state === 'no-dev-set' && /get_training_guardrails/.test(cmd)) {
    // forge names the guardrails ONCE, here, before the split (Round 13):
    // read first, then split — its comment names them after the command.
    // forge's other notes on the split, without the guardrails one said here
    const notes = (cmd.split('#')[1] || '').split(';').map((n) => n.trim())
      .filter((n) => n && !/guardrails/.test(n));
    return `next (state no-dev-set): call get_training_guardrails once (the rules the split, the dev fence and `
      + 'the leak audit enforce — read them before splitting, and not again), then forge_split for '
      + `\`${cmd.replace(/\s+#.*$/, '')}\`${notes.length ? ` (forge's notes on it: ${notes.join('; ')})` : ''}. `
      + 'Then call forge_status again.';
  }
  const lead = a.state === 'ready-to-score'
    ? 'training is done — the next step is the export: forge_export with the run_manifest, prereg and out '
      + `that result.advice.next_command names (\`${cmd}\`); it scores the test set ONCE (prereg-gated) and `
      + 'packages the model. result.advice.why names any other run to export the same way, each to its own '
      + 'folder.'
    : `next (state ${a.state || 'unknown'}): \`${cmd}\`${asTools.length || terminal.length
      ? ` — as tools: ${tools.join(' → ')}` : ''}.`;
  const term = terminal.map((c) => TERMINAL_STEP_TEXT[c]
    ?? `\`nmt-forge ${c}\` runs in a terminal (it has no tool)`);
  return [lead, ...term.map((t) => `${t[0].toUpperCase()}${t.slice(1)}.`), 'Then call forge_status again.']
    .join(' ');
}

// ---------------------------------------------------------------------------
// forge_export's summary, shaped like the other forge tools' (Round 12 school
// persona: forge_export was the one forge tool whose envelope said
// `summary: null`). Content-free: the scores with their CIs, the near-twin
// reading, the twin-free model to quote or the one still to export, the
// prereg's counts, and what to serve.
// ---------------------------------------------------------------------------

/**
 * forge_status's `summary.tools`: the tools of the next command in order —
 * with get_training_guardrails first in state no-dev-set, where forge names
 * it (after the command, in a comment) as the step BEFORE the split.
 */
export function statusTools(r) {
  const cmd = r?.advice?.next_command;
  const tools = forgeToolsIn(cmd);
  if (r?.advice?.state === 'no-dev-set' && /get_training_guardrails/.test(String(cmd || ''))) {
    return ['get_training_guardrails', ...tools.filter((t) => t !== 'get_training_guardrails')];
  }
  return tools;
}

/**
 * mt-eval's caveats on each export forge_status lists (advice.exports when
 * forge gives them, else the snapshot's), keyed by run — only the exports
 * that carry a list; the major ones flagged. null when none carries one.
 */
export function statusExportCaveats(r) {
  const list = Array.isArray(r?.advice?.exports) ? r.advice.exports
    : (Array.isArray(r?.snapshot?.exports) ? r.snapshot.exports : []);
  const out = {};
  const major = [];
  for (const x of list) {
    const kept = relayCaveats(x?.score_caveats);
    if (!kept) continue;
    const key = x.run || x.model_dir || x.dir;
    out[key] = kept;
    if (majorCaveats(kept).length) major.push(key);
  }
  return Object.keys(out).length ? { score_caveats: out, ...(major.length ? { major } : {}) } : null;
}

/** One score cell as {score, ci}. */
const scoreCell = (v) => ({ score: v.score, ci: [v.ci_lower ?? null, v.ci_upper ?? null] });

/**
 * forge_export's summary.
 *
 * @param {object} r  forge's `export --json` result
 * @returns {object|null}
 */
export function exportSummary(r) {
  if (!r || typeof r !== 'object' || !r.export_dir) return null;
  const out = {
    run: r.run ?? null,
    export_dir: r.export_dir,
    // the only folder to deploy; null for --no-model
    model_dir: r.model_dir ?? null,
    evaluated: r.evaluated === true,
  };
  if (out.evaluated) {
    out.test_set = r.dataset_id || r.battery || null;
    const scores = {};
    for (const [g, s] of Object.entries(r.test_groups || {})) {
      for (const [m, v] of Object.entries(s || {})) {
        if (v && typeof v === 'object' && typeof v.score === 'number') (scores[g] ??= {})[m] = scoreCell(v);
      }
    }
    out.scores = scores;
    // Scoring standard/1: forge's own headline (chrF++ with its CI and
    // sacreBLEU signature), never re-derived here.
    if (r.headline) out.headline = r.headline;
  }
  const nt = r.near_twin;
  if (nt && typeof nt === 'object') {
    out.near_twin = {
      checked: nt.checked === true,
      rows: nt.near_twin_rows ?? null,
      n: nt.n ?? null,
      recall_not_translation: nt.recall_not_translation === true,
      strict: nt.strict && typeof nt.strict.score === 'number' ? scoreCell(nt.strict) : null,
    };
    if (nt.advice) out.near_twin_advice = nt.advice;
    const planned = nt.twin_free_planned;
    if (planned && typeof planned === 'object') {
      out.twin_free_planned = {
        prereg: planned.prereg ?? null,
        prereg_before_reads: planned.prereg_before_reads ?? null,
        trained: planned.trained === true,
        next: planned.next ?? null,
      };
    }
  }
  // mt-eval's caveats on this score, verbatim (Round 13) — a MAJOR one goes
  // with the score wherever it is quoted (exportNextHint says so first)
  const caveats = relayCaveats(r.score_caveats);
  if (caveats) out.score_caveats = caveats;
  if (Array.isArray(r.twin_free_siblings) && r.twin_free_siblings.length) {
    out.twin_free_siblings = r.twin_free_siblings.map((s) => {
      const sc = relayCaveats(s?.score_caveats);
      return {
        run: s.run ?? null, dir: s.model_dir || s.export_dir || null, score: s.score ?? null,
        ...(sc ? { score_caveats: sc } : {}),
      };
    });
  }
  // the file forge_compare takes as hyps_a / hyps_b, and forge's command for it
  if (r.hypotheses) out.hypotheses = r.hypotheses;
  if (r.compare_hint) out.compare_hint = r.compare_hint;
  if (r.prereg && typeof r.prereg === 'object') {
    const counts = {};
    for (const v of r.prereg.verdicts || []) {
      const k = v?.human_verdict?.verdict ? `human_${v.human_verdict.verdict}` : v?.verdict;
      if (k) counts[k] = (counts[k] || 0) + 1;
    }
    out.prereg = { id: r.prereg.id, bound_by: r.prereg.bound_by ?? null, verdicts: counts,
      after_reads: r.prereg.after_reads?.text ?? null };
  }
  if (r.serve) out.serve = r.serve;
  return out;
}

/**
 * forge_export's next step: the twin-free model's own step first when forge
 * names one, then serving.
 *
 * @param {object} r  forge's `export --json` result
 * @param {string} serveText  the serve-is-a-terminal-step text
 * @returns {string}
 */
export function exportNextHint(r, serveText) {
  if (!r?.model_dir) {
    return `${caveatLead(r)}evaluation-only export (no model): read result.test_weighted and the battery report `
      + '(forge_report / forge_lint on result.battery_report); there is nothing to serve.';
  }
  const planned = r?.near_twin?.twin_free_planned;
  const twin = planned?.next
    ? `First relay summary.near_twin_advice to the user: the twin-free model of this test set is already `
      + `planned${planned.prereg ? ` (preregistration ${planned.prereg})` : ''} — its next step is \`${planned.next}\``
      + ` (${forgeToolsIn(planned.next).join(' → ')}); no new preregistration${planned.prereg_before_reads
        ? ' is needed' : ' unless forge says so'}. `
    : (r?.near_twin?.recall_not_translation
      ? 'First relay summary.near_twin_advice with the score — never this score alone. ' : '');
  return `${caveatLead(r)}${twin}${serveText} The command: ${r.serve || `nmt-forge serve ${r.export_dir}`}.`;
}

/** What goes before anything else in forge_export's next step: mt-eval's MAJOR caveats (Round 13). */
function caveatLead(r) {
  const own = majorCaveats(r?.score_caveats).length
    ? 'First relay summary.score_caveats with the score — never quote it without them. ' : '';
  const sib = (Array.isArray(r?.twin_free_siblings) ? r.twin_free_siblings : [])
    .some((s) => majorCaveats(s?.score_caveats).length)
    ? 'The twin-free score this export cites carries mt-eval\'s SCORE CAVEAT — relay it with that score '
      + '(summary.twin_free_siblings[].score_caveats). '
    : '';
  return own + sib;
}

// ---------------------------------------------------------------------------
// forge_register_eval: a relative path is read from project_dir, as every
// forge path is (forge runs there). Round 12 (school persona): the agent
// passed a path relative to ITS directory, forge looked inside the project,
// and the refusal was a bare FileNotFoundError with why/fix null. The MCP
// knows both directories, so it names the exact path to pass.
// ---------------------------------------------------------------------------

/**
 * The refusal for a forge_register_eval path that is not under project_dir
 * but IS under this server's working directory, or null (forge's own check
 * — the resolved path and the fix — covers every other miss).
 *
 * @param {{path: string, projectDir?: string, cwd?: string, exists?: function}} a
 * @returns {string|null}
 */
export function registerEvalPathError({ path, projectDir, cwd = process.cwd(), exists = existsSync }) {
  if (!path || isAbsolute(path) || !projectDir) return null;
  const looked = resolve(cwd, projectDir, path);
  if (exists(looked)) return null;
  const here = resolve(cwd, path);
  if (!exists(here)) return null;
  const rel = relative(resolve(cwd, projectDir), here);
  return `forge_register_eval: no file at ${looked} — \`path\` is read relative to project_dir `
    + `(${resolve(cwd, projectDir)}), where forge runs, like every forge path. The file is at ${here}: `
    + `pass path: ${JSON.stringify(rel)} (relative to project_dir) or ${JSON.stringify(here)}.`;
}
