/**
 * The rails profile: six tools a small agent can drive a language project
 * with, end to end, without holding the whole toolset in its context.
 *
 *   start_project   champollion new — a project with a place for everything
 *   project_status  champollion next --json — THE next step, from the files
 *   run_next_step   run the step `project_status` named, if its mode allows
 *   add_data        champollion data add — bring in a spreadsheet / table
 *   try_translation the served model, on a few of the person's sentences —
 *                   never relaying what a local-only model writes
 *   explain         the rails, privacy, quality, the step modes, the improve rounds, in words
 *
 * Every tool drives the `champollion` CLI as a separate, bounded process —
 * the same commands a person types, one implementation, never a copy. The
 * decisions stay with the people who hold the data: run_next_step refuses a
 * human_only step, runs an ask_user step only with the person's answers, a
 * confirm step only with `confirmed: true`, and never a command it was not
 * just handed by project_status (the step id must match).
 *
 * Selected with `champollion-mcp --profile rails` (or
 * CHAMPOLLION_MCP_PROFILE=rails); instructions in instructions-rails.md.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Bound for any one command (founder rule: every step bounded). */
export const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const OUTPUT_TAIL_LINES = 40;
/** A step that failed this many times in a row runs again only on the person's say-so. */
export const MAX_FAILED_TRIES = 2;

/** The champollion CLI this server drives: CHAMPOLLION_CLI_BIN, else the dependency. */
export function resolveCliBin(env = process.env) {
  if (env.CHAMPOLLION_CLI_BIN) return env.CHAMPOLLION_CLI_BIN;
  const entry = fileURLToPath(import.meta.resolve('champollion'));
  return join(dirname(entry), 'bin', 'cli.js');
}

function findOnPath(tool, env = process.env) {
  const override = env[`${tool.toUpperCase().replace(/-/g, '_')}_BIN`];
  if (override) return override;
  const dirs = (env.PATH || '').split(delimiter).filter(Boolean);
  dirs.push(env.UV_TOOL_BIN_DIR || join(homedir(), '.local', 'bin'));
  for (const d of dirs) {
    const p = join(d, tool);
    try {
      if (statSync(p).isFile()) return p;
    } catch { /* next */ }
  }
  return null;
}

/**
 * Split a rails command into argv lists, one per `&&` part. Only plain words,
 * "double" and 'single' quotes and `&&`: anything else a shell would act on
 * (| ; > < $( ` &) is refused — a rails command never needs it.
 */
export function tokenize(command) {
  const parts = [[]];
  let cur = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      cur = cur ?? '';
      for (i++; i < command.length && command[i] !== q; i++) {
        if (q === '"' && command[i] === '\\' && i + 1 < command.length) cur += command[++i];
        else cur += command[i];
      }
      if (i >= command.length) throw new Error('unbalanced quote in the step\'s command');
    } else if (ch === '#' && cur === null) {
      // a comment, as in a shell: forge's advice explains itself after `#`
      break;
    } else if (/\s/.test(ch)) {
      if (cur !== null) { parts[parts.length - 1].push(cur); cur = null; }
    } else if (ch === '&' && command[i + 1] === '&') {
      if (cur !== null) { parts[parts.length - 1].push(cur); cur = null; }
      parts.push([]);
      i++;
    } else if ('|;<>`$&'.includes(ch)) {
      throw new Error(`the step's command uses "${ch}", which a rails command never needs — refused`);
    } else {
      cur = (cur ?? '') + ch;
    }
  }
  if (cur !== null) parts[parts.length - 1].push(cur);
  if (parts.some((p) => p.length === 0)) throw new Error('empty command part');
  return parts;
}

/** argv → the program to spawn, or a refusal. Only the rails' own tools. */
export function launcherFor(argv, env = process.env) {
  const [tool, ...rest] = argv;
  if (tool === 'champollion') return { cmd: process.execPath, args: [resolveCliBin(env), ...rest] };
  if (tool === 'nmt-forge') {
    const bin = findOnPath('nmt-forge', env);
    if (!bin) return { error: 'nmt-forge is not installed — run the install step first' };
    return { cmd: bin, args: rest };
  }
  if (tool === 'uv') {
    // only installing the training tools, never anything else
    const ok = rest[0] === 'tool' && rest[1] === 'install'
      && rest.slice(2).every((a) => /^(--python|--reinstall|--upgrade|3\.\d+|nmt-forge(\[[a-z,]+\])?)$/.test(a))
      && rest.some((a) => a.startsWith('nmt-forge'));
    if (!ok) return { error: 'only `uv tool install … nmt-forge` is a rails command' };
    const bin = findOnPath('uv', env);
    if (!bin) {
      return { error: 'uv is not installed. Ask the person to install it from '
        + 'https://docs.astral.sh/uv/ (one command there), then ask again — the agent '
        + 'does not download or run installers itself.' };
    }
    return { cmd: bin, args: rest };
  }
  return { error: `"${tool}" is not a rails command` };
}

/** Run one program, bounded; resolves {code, out, timedOut}. */
export function runBounded(cmd, args, { cwd, env = process.env, timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
  return new Promise((resolveRun) => {
    let out = '';
    let timedOut = false;
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const add = (b) => { out += b.toString('utf-8'); if (out.length > 200_000) out = out.slice(-100_000); };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolveRun({ code: null, out: `${out}\n${e.message}`, timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolveRun({ code, out, timedOut }); });
  });
}

function tail(text) {
  return text.trim().split('\n').slice(-OUTPUT_TAIL_LINES).join('\n');
}

/** Projects (folders holding champollion.project.json) under `root`, a few levels down. */
function projectsUnder(root, depth = 3) {
  const found = [];
  const walk = (dir, d) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'champollion.project.json')) found.push(dir);
    if (d >= depth) return;
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'data', 'models'].includes(e.name)) {
        walk(join(dir, e.name), d + 1);
      }
    }
  };
  walk(root, 0);
  return found.slice(0, 10);
}

/** Files named `name` under `root`, a few levels down (not inside a project's own data). */
function filesNamed(root, name, depth = 3) {
  const found = [];
  const walk = (dir, d) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isFile() && e.name === name) found.push(join(dir, e.name));
      else if (e.isDirectory() && d < depth && !e.name.startsWith('.')
        && !['node_modules', 'data', 'models', 'export'].includes(e.name)) walk(join(dir, e.name), d + 1);
    }
  };
  walk(root, 0);
  return found;
}

/**
 * The data file add_data was given: as written when absolute, else from the
 * project folder, else from where the agent started (the server's folder —
 * where a person says "the files are next to where you start"). Not found:
 * said with where it looked and the files of that name nearby, as paths to
 * pass (acceptance runs, 2026-10-11: three small models were told only "no
 * such file in the project folder" and asked the family to move files).
 */
function dataFileAt(given, projectDir) {
  if (isAbsolute(given)) {
    return existsSync(given) ? { file: given } : { refused: `${given}: no such file` };
  }
  for (const base of [projectDir, process.cwd()]) {
    const p = resolve(base, given);
    if (existsSync(p) && statSync(p).isFile()) return { file: p, from: base === projectDir ? null : base };
  }
  const name = basename(given);
  const near = [...new Set([...filesNamed(process.cwd(), name), ...filesNamed(dirname(projectDir), name)])]
    .slice(0, 5).map((p) => relative(projectDir, p) || p);
  return { refused: `${given}: no such file in the project folder (${projectDir}) or where you started `
    + `(${process.cwd()})`
    + (near.length ? `. Files named ${name} nearby, as paths from the project folder: ${near.join(', ')}`
      : '. Ask the person where the file is — any path works, absolute or relative') };
}

/**
 * What `data add` says a file also holds ("it also holds 6 example
 * sentence(s) … — as pairs to learn from: champollion data add <file>"), as
 * the add_data calls that bring it in. The CLI names a command; an agent with
 * only these tools gets the call (2026-10-11 ladder: of three models given a
 * Toolbox dictionary, one brought its example sentences in as pairs, one
 * left them out, one only mentioned them).
 */
export function alsoCalls(out, projectDir) {
  const calls = [];
  for (const line of String(out || '').split('\n')) {
    const m = /^\s*it also holds (.+?) — (.+?): champollion data add (.+?)(?: --into (\w+))?\s*$/.exec(line);
    if (!m) continue;
    calls.push({ holds: m[1], as: m[2], tool: 'add_data',
      arguments: { project_dir: projectDir, path: m[3], ...(m[4] ? { into: m[4] } : {}) } });
  }
  return calls;
}

/**
 * The project folder a tool was given, or why it is not one — said plainly.
 * A missing folder used to reach the CLI as a spawn cwd and come back as
 * "spawn …/node ENOENT", which small models read as "install Node"
 * (acceptance runs, 2026-10-11: one mistyped the path, one told the person
 * to `brew install node`).
 */
function projectAt(projectDir, { needProjectFile = true } = {}) {
  const cwd = resolve(projectDir);
  let isProject = false;
  try {
    isProject = statSync(join(cwd, 'champollion.project.json')).isFile();
  } catch { /* not one */ }
  if (isProject || (!needProjectFile && existsSync(cwd))) return { cwd };
  // look near what was meant (the nearest folder of the given path that
  // exists — a typo is usually in the last part) and where the server runs
  let near = cwd;
  while (!existsSync(near) && dirname(near) !== near) near = dirname(near);
  const wide = near === dirname(near) || near === homedir();     // never scan / or ~
  const here = [...new Set([...(wide ? [] : projectsUnder(near)), ...projectsUnder(process.cwd())])]
    .slice(0, 10);
  const what = existsSync(cwd) ? `${cwd} is a folder, but not a project (no champollion.project.json)`
    : `there is no folder ${cwd}`;
  return { refused: `${what}. `
    + (here.length ? `The projects here: ${here.join(', ')} — pass one of them as project_dir.`
      : 'No project was found here — start one with start_project.') };
}

async function cliJson(args, cwd, env) {
  const r = await runBounded(process.execPath, [resolveCliBin(env), ...args, '--json'], { cwd, env, timeoutMs: 120_000 });
  try {
    return { code: r.code, doc: JSON.parse(r.out.slice(r.out.indexOf('{'))) };
  } catch {
    return { code: r.code, error: tail(r.out) || `champollion ${args[0]} gave no answer (exit ${r.code})` };
  }
}

/** The compact step an agent needs (no file lists, no internals). */
export function compact(next) {
  if (!next) return null;
  const out = { project: next.project };
  if (next.stage) out.stage = `${next.stage.n}/${next.stage.of} ${next.stage.title}`;
  if (next.step) {
    const s = next.step;
    out.step = { id: s.id, mode: s.mode, say: s.say, why: s.why };
    if (s.mode === 'human_only' && s.agent) {
      // A person's step an agent does with its own tools (bring in the files
      // the person named): shown as that, by its own mode, naming the tool.
      // Small models acted on "human_only" whatever a hint beside it said and
      // handed the step back (acceptance runs, 2026-10-11).
      out.step.mode = 'use_tool';
      out.step.tool = s.agent_tool || 'add_data';
      out.step.say = s.agent;
      out.step.for_the_person = s.say;
    }
    // The exact call that takes the step. The command is what the rails run,
    // not a tool: a weak model turned `champollion data mark` into a tool
    // "data_mark" (Llama 3.1 8B, ladder round 5), and one ended its turn at
    // "WAIT for it to finish" with training running (GPT-4o mini, round 3).
    const take = { project_dir: next.project, step_id: s.id };
    if (s.mode === 'wait') {
      out.step.call = { tool: 'project_status', arguments: { project_dir: next.project, wait_seconds: 120 } };
    } else if (s.mode === 'auto') {
      out.step.call = { tool: 'run_next_step', arguments: take };
    } else if (s.mode === 'confirm') {
      out.step.call = { tool: 'run_next_step', arguments: take,
        once_they_say_yes: 'ask the person first; add "confirmed": true only after they say yes' };
    } else if (s.mode === 'ask_user' && s.answers) {
      // the slots, named — the person's words go in them, never these
      const slots = Object.fromEntries(Object.entries(s.answers).map(([k, r]) =>
        [k, `<${r.enum ? r.enum.join(' or ') : (r.say || k)}>`]));
      out.step.call = { tool: 'run_next_step', arguments: { ...take, answers: slots },
        fill_with: 'the person\'s own answers to step.question — never yours' };
    } else if (out.step.mode === 'use_tool') {
      out.step.call = { tool: out.step.tool,
        arguments: { project_dir: next.project, path: '<each file the person named, where it is>' } };
    }
    if (s.question) out.step.question = s.question;
    if (s.answers) out.step.answers = s.answers;
    if (s.command) out.step.command = s.command;
  } else if (!next.error) {
    out.step = null;
    out.say = 'Every step on the rails is done.';
    // what the people can do now (try the served model on its page; an app)
    if (next.finished) out.finished = next.finished;
  }
  // what is true right now, from forge's record — what the agent says when it
  // tells the people what has been done, and never more (wave 1, 2026-10-12)
  if (next.now?.length) out.true_now = next.now;
  // files waiting for the agreement of the people whose words they hold —
  // asked when the people have it, never holding up the rest (wave 1)
  if (next.waiting?.length) {
    out.waiting_for_agreement = next.waiting.map((w) => ({
      file: w.file, question: w.question, say: w.say,
      call: { tool: 'run_next_step', arguments: { project_dir: next.project, step_id: w.id,
        answers: { agreed: '<yes — only once the person says everyone agreed>',
          ...(w.answers?.training ? { training: '<allowed or not-allowed — the holders\' answer>' } : {}) } },
      fill_with: 'the person\'s own answer — never yours' },
    }));
  }
  // A served model stays in use while the improve rounds run: its try page
  // and the way into an app or site (champollion connect) travel with every
  // later step, not only with a finished journey. Since the improve loop
  // followed serving, the journey never finishes, and an agent on these tools
  // never heard of connect (packaged walk, 2026-10-18).
  if (next.step && next.forge?.state === 'serving' && next.forge.why) {
    out.model_in_use = { say: next.forge.why,
      ...(next.forge.command ? { for_the_person: next.forge.command } : {}) };
  }
  if (next.forge?.blockers?.length) out.blockers = next.forge.blockers;
  if (next.forge?.warnings?.length) out.warnings = next.forge.warnings;
  if (next.error) out.error = next.error;
  return out;
}

const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const refusal = (msg, extra = {}) => ({ ...text({ refused: msg, ...extra }), isError: true });

/** Fill an ask_user step's answer slots, validated against its schema. */
export function fillAnswers(argvParts, schema, answers) {
  const filled = {};
  for (const [key, rule] of Object.entries(schema || {})) {
    const v = answers?.[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      return { error: `missing the answer "${key}" — ask the person who holds the data; never answer for them` };
    }
    // a slot's placeholder passed back as the answer is no one's answer
    // (the step's call names its slots as <…>; a weak model may copy them)
    if (/^\s*<[^>]*>\s*$/.test(String(v))) {
      return { error: `"${key}" is still the placeholder ${String(v).trim()} — ask the person and pass their words` };
    }
    if (rule.enum && !rule.enum.includes(v)) return { error: `"${key}" must be one of ${rule.enum.join(', ')}` };
    filled[key] = String(v);
  }
  const parts = argvParts.map((argv) => argv.map((a) => a.replace(/\{([a-z_]+)\}/g, (m, k) => (k in filled ? filled[k] : m))));
  const left = parts.flat().find((a) => /\{[a-z_]+\}/.test(a));
  if (left) return { error: `the command still has an unfilled slot (${left})` };
  return { parts };
}

const TRY_MAX_LINES = 10;
const TRY_TIMEOUT_MS = 120_000;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The model this project serves: the newest running, healthy `serve` job
 * (`nmt-forge jobs --json`, read from the project's files), on this machine
 * only, with its /health. Resolves {base, health} or {error}.
 */
export async function servedModel(cwd, env = process.env) {
  const l = launcherFor(['nmt-forge', 'jobs', '--json'], env);
  if (l.error) return { error: l.error };
  const r = await runBounded(l.cmd, l.args, { cwd, env, timeoutMs: 60_000 });
  let jobs;
  try {
    jobs = JSON.parse(r.out.slice(r.out.indexOf('[')));
  } catch {
    return { error: tail(r.out) || `nmt-forge jobs gave no answer (exit ${r.code})` };
  }
  const serving = (Array.isArray(jobs) ? jobs : [])
    .filter((j) => j.kind === 'serve' && j.state === 'running' && j.healthy && j.health_url);
  if (!serving.length) {
    return { error: 'no model is being served for this project — project_status names the step that starts it' };
  }
  const url = new URL(serving[serving.length - 1].health_url);
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return { error: `the served model is at ${url.host}, not on this computer — try it there` };
  }
  const base = url.href.replace(/\/health\/?$/, '');
  try {
    const h = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!h.ok) return { error: `the model at ${base} answered /health with ${h.status}` };
    return { base, health: await h.json() };
  } catch (e) {
    return { error: `the model at ${base} did not answer (${e.message})` };
  }
}

const EXPLAIN = {
  rails: 'A project on the rails is one folder with a place for everything: data/parallel (pairs to learn from), data/test (sentences a fluent speaker checked — never learned from), data/lexicon (a word list: the rails measure what looking words up scores — the floor a model must beat), data/grammar, consent/. champollion next names THE next step from the files; the steps are: gather data → record its terms → protect a test set → install the training tools → build and prove a model. Every step is bounded; nothing runs forever.',
  privacy: 'Beside each data file, <file>.champollion.json records what its holders decided: local-only (only a model on this computer may see it), whether a model may train on it, who holds it. Every tool obeys it, and it only ever gets stricter. You are an outside AI service: never open the user\'s data files — use add_data, which reports counts and columns, never sentences.',
  quality: 'The rails promise you will KNOW how good a model is on the people\'s own test sentences — not that it is good. A small model trained on a few thousand pairs is usually a phrasebook for phrases like the ones it saw, not a general translator. Pass on every caveat the tools print, word for word. A fluent speaker decides what is fit to use.',
  modes: 'auto: you may run it (run_next_step). confirm: ask the person first, then run it with confirmed: true (installs, training); on "not now", run_next_step with declined: true — nothing runs, and it is not asked again this session. ask_user: ask the person who holds the data the question, in their words, then run it with their answers — never answer for them. wait: something is running; call project_status with wait_seconds. use_tool: you do it now with step.tool (bring in the files the person named with add_data), as step.say says — do not hand it back. human_only: a person does this (gather sentences, choose a model) — tell them what step.say says.',
  improve: 'Once a model is in use, it gets better in rounds. Each round: forge makes a wishlist sheet (improve/round-N/wishlist.md) of what would help most — words the model never saw, the kinds of sentence it gets wrong on the dev set, and open prompts; the people write 20 or more sentences they really want translated, using it as much or as little as they like; the model drafts them onto a sheet (improve/round-N/review.csv); the speaker marks each draft Y (right), N (wrong — and writes how it is said) or ? (unsure) — about one row in ten comes back from an earlier sheet on purpose (the sheet says so; their agreement with their own earlier marks shows how far the marks can be trusted); their confirmed drafts and fixes become new training sentences (the people say who holds them, as for any file). While the dev (practice) set is small, rows have no draft (one in two until it holds 50 sentences, then one in four): the speaker writes them, and they join the dev set, never training — a bigger dev set lets a round\'s gain show. Everything is screened and the model trains again. Forge then compares the new model with the one in use on the same dev sentences and offers it for use only if it is measurably better (the people say yes; a verdict alone changes nothing), and says how big a difference that dev set can see — otherwise the model in use stays, and the next round begins. Under 50 dev sentences no comparison can decide: the round reads "too few to tell", the next sheet mixes both models\' drafts blind, and the speaker\'s marks decide (forge offers the newer model if they clearly prefer it). When two rounds in a row that the dev set could judge show no gain (counted from the last model put to use), the rails offer a stronger model (a big download, longer training): ask the people — yes, or not now. The speaker\'s share of drafts marked right is the measure that matters. Never open the sheets: they hold the family\'s sentences, their word lists and the speaker\'s words.',
  off_rails: 'Every step is an ordinary command (champollion, nmt-forge) the person can run in a terminal too. Stepping off the rails is fine: change a file, run an expert command, then call project_status — the next step is always read from the files, never remembered.',
};

/**
 * Register the rails tools on an McpServer.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
/** The originals a project's data came from (each sidecar's derived_from), anywhere under data/. */
export function originalsIn(projectDir) {
  const names = new Set();
  const walk = (dir, depth) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith('.champollion.json')) {
        try {
          const from = JSON.parse(readFileSync(p, 'utf-8')).derived_from;
          if (typeof from === 'string') names.add(basename(from));
        } catch { /* not a sidecar we can read: says nothing */ }
      }
    }
  };
  walk(join(projectDir, 'data'), 0);
  return names;
}

/**
 * The files add_data could not bring in this session and that are still not
 * in the project, said on every status until they are (or the person
 * decides): a refused file was left behind without a word — GPT-5 nano's
 * guessed sheet name, the family's largest file (model ladder, 2026-10-11).
 */
export function notAddedFor(memory, projectDir) {
  const tried = memory.get(projectDir);
  if (!tried?.size) return null;
  const inProject = originalsIn(projectDir);
  const left = [...tried.values()].filter((t) => !inProject.has(t.name));
  if (!left.length) return null;
  return {
    files: left.map((t) => ({ file: t.file, refused: t.refused })),
    say: 'add_data could not bring these in yet, and they are not in the project: bring each in (its '
      + 'refusal says how), or tell the person which is left out and why.',
  };
}

/**
 * Why `declined: true` does not fit this step, or null. A "not now" that is one
 * of the step's own answers (the stronger-model offer: try_it yes | not-now) goes
 * in `answers`: forge records it, and the offer comes back only after more
 * rounds without a gain — `declined` would last this session only and ask again
 * in the next one. `declined` is for the steps whose yes has no such answer: a
 * confirm step, or a question the person cannot answer yet.
 */
export function declineRefusal(step) {
  if (step.mode !== 'confirm' && step.mode !== 'ask_user') {
    return `this step does not wait on the person's yes (${step.mode}) — there is nothing to decline`;
  }
  const own = Object.entries(step.answers || {}).find(([, r]) => (r?.enum || []).includes('not-now'));
  if (own) {
    return `"not now" is one of this step's own answers — pass it in answers (${own[0]}: "not-now"): it is `
      + 'recorded, and this comes back only after more rounds; declined would ask again next session';
  }
  return null;
}

export function registerRailsTools(server, { env = process.env } = {}) {
  const projectDir = z.string().describe('The project folder (the one with champollion.project.json).');
  // step → {count, why, output} of its consecutive failures (this server's life)
  const failures = new Map();
  // step → {at}: the person said not now (this server's life: one session) —
  // not asked again this session; a later yes takes it (stress test 7)
  const declines = new Map();
  const withDeclined = (obj, cwd) => {
    const d = obj?.step && declines.get(`${cwd}::${obj.step.id}`);
    if (!d) return obj;
    return { ...obj, step: { ...obj.step, declined_this_session: d.at,
      say: `They said not now (${d.at.slice(11, 16)} UTC) to this: ${obj.step.say} Do not ask again this session — `
        + 'nothing that needs their yes runs. If they bring it up themselves and say yes, take it with confirmed: '
        + 'true (or their answers).' } };
  };
  // project → (file name → {name, file, refused}): what add_data could not bring in
  const notAdded = new Map();
  const withNotAdded = (obj, cwd) => {
    const n = notAddedFor(notAdded, cwd);
    return n ? { ...obj, files_not_added: n } : obj;
  };

  server.tool(
    'start_project',
    'Start a machine-translation project on the rails: a folder with a place for everything, the '
    + 'decisions file, and the first step. Languages are codes or names ("English", "Plains Cree"); a '
    + 'private-use code (qaa) needs its name. The first call makes nothing: it gives you the direction to '
    + 'say back to the person; call again with confirmed: true once they agree.',
    {
      folder: z.string().describe('New folder for the project (relative to parent_dir).'),
      from: z.string().describe('The language people will put IN (what they have): code or name.'),
      to: z.string().describe('The language that comes OUT (what they want): code or name.'),
      target_name: z.string().optional().describe('The "to" language\'s name as its people say it (required when to is qaa–qtz).'),
      source_name: z.string().optional().describe('The "from" language\'s name as its people say it (required when from is qaa–qtz).'),
      purpose: z.string().optional().describe('What the translations are for, in the person\'s words.'),
      parent_dir: z.string().optional().describe('Where to create the folder (default: this server\'s working directory).'),
      confirmed: z.boolean().optional().describe('true only after the person agreed to the direction the first call gave you to say back.'),
    },
    async ({ folder, from, to, target_name, source_name, purpose, parent_dir, confirmed }) => {
      const cwd = resolve(parent_dir || process.cwd());
      // a parent folder that is not there used to come back as "spawn …/node
      // ENOENT" (a small model had invented /home/your_username)
      if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
        return refusal(`there is no folder ${cwd} to start the project in — leave parent_dir out to start `
          + `it where you are (${process.cwd()}), or pass a folder that exists`);
      }
      const given = { folder, from, to, ...(target_name ? { target_name } : {}),
        ...(source_name ? { source_name } : {}), ...(purpose ? { purpose } : {}), ...(parent_dir ? { parent_dir } : {}) };
      const args = ['new', folder, '--from', from, '--to', to,
        ...(target_name ? ['--target-name', target_name] : []), ...(source_name ? ['--source-name', source_name] : []),
        ...(purpose ? ['--purpose', purpose] : []), ...(confirmed === true ? [] : ['--dry'])];
      const r = await cliJson(args, cwd, env);
      if (r.error || r.code !== 0) {
        const why = r.error || `champollion new exited ${r.code}`;
        // a name no card carries, and no close one: the exact call that uses a
        // private-use code — small models copy a call far more reliably than
        // they compose one (acceptance runs, 2026-10-11: two read "use qaa"
        // and stopped)
        const name = target_name || to;
        const retry = /private-use code/.test(why) && !/^q[a-t][a-z]$/i.test(to)
          ? { if_it_has_no_code: { tool: 'start_project', arguments: {
            ...given, to: 'qaa', target_name: name, ...(confirmed === true ? { confirmed } : {}) } } }
          : {};
        return refusal(why, retry);
      }
      // the direction, said back before anything is made — wave 1 (2026-10-12):
      // a learner who wanted their language INTO English got a project built
      // from English, in all five runs; nobody had said the direction aloud
      if (confirmed !== true) {
        const { source: s, target: t } = r.doc.languages;
        const swapped = { ...given, from: t.code, to: s.code };
        delete swapped.target_name; delete swapped.source_name;
        if (/^q[a-t][a-z]$/i.test(t.code)) swapped.source_name = t.name;
        if (/^q[a-t][a-z]$/i.test(s.code)) swapped.target_name = s.name;
        return text({
          made: false,
          ask_first: `Before anything is made, check the direction with the person, in plain words: "This `
            + `translator takes ${s.name} and gives back ${t.name} — you put ${s.name} in, and ${t.name} comes `
            + 'out. Is that the way round you want?"',
          if_yes: { tool: 'start_project', arguments: { ...given, confirmed: true } },
          if_the_other_way: { tool: 'start_project', arguments: { ...swapped, confirmed: true } },
          languages: r.doc.languages,
        });
      }
      // languages: what each name resolved to — with matchedAs when the person's
      // word is another name the card records ("Blackfoot" → Siksika), to say back.
      return text({ project: r.doc.project, languages: r.doc.languages, next: compact(r.doc.next) });
    },
  );

  server.tool(
    'project_status',
    'THE next step for a project, read from its files: what to tell the person, why, the command, and how '
    + 'to take it (mode). Call it first, and after every step. With wait_seconds, it waits (up to 120 s) for '
    + 'a running step to move on.',
    { project_dir: projectDir, wait_seconds: z.number().int().min(0).max(120).optional() },
    async ({ project_dir, wait_seconds = 0 }) => {
      const at = projectAt(project_dir);
      if (at.refused) return refusal(at.refused);
      const { cwd } = at;
      let r = await cliJson(['next', cwd], cwd, env);
      const deadline = Date.now() + wait_seconds * 1000;
      const first = r.doc?.step?.id;
      while (r.doc?.step?.mode === 'wait' && Date.now() < deadline) {
        await new Promise((ok) => setTimeout(ok, 5000));
        r = await cliJson(['next', cwd], cwd, env);
        if (r.doc?.step?.id !== first) break;
      }
      if (r.error) return refusal(r.error);
      return text(withDeclined(withNotAdded(compact(r.doc), cwd), cwd));
    },
  );

  server.tool(
    'run_next_step',
    'Run the step project_status just named (pass its step_id). auto steps run; confirm steps need '
    + 'confirmed: true after the person said yes; ask_user steps need answers — the person\'s own, never '
    + 'yours; human_only and wait steps are refused with what to do instead.',
    {
      project_dir: projectDir,
      step_id: z.string().describe('The step.id project_status returned.'),
      answers: z.record(z.string()).optional().describe('ask_user steps: the person\'s answers, by the keys in step.answers.'),
      confirmed: z.boolean().optional().describe('confirm steps: true only after the person said yes. Also a step that failed twice: true only when the person says to try it again as it is.'),
      declined: z.boolean().optional().describe('true when the person said not now to a confirm step, or to a question with no "not-now" answer of its own: nothing runs, and it is not asked again this session. Where "not-now" is one of the answers, pass it in answers.'),
    },
    async ({ project_dir, step_id, answers, confirmed, declined }) => {
      const at = projectAt(project_dir);
      if (at.refused) return refusal(at.refused);
      const { cwd } = at;
      const r = await cliJson(['next', cwd], cwd, env);
      if (r.error) return refusal(r.error);
      // a file waiting for its speakers' agreement is answered by its own id,
      // whatever step the rails are on
      const step = (r.doc?.waiting || []).find((w) => w.id === step_id) || r.doc?.step;
      if (!step) return refusal('there is no step to run — every step on the rails is done');
      if (step.id !== step_id) {
        return refusal('the project changed since that step was named — call project_status again',
          { current: compact(r.doc) });
      }
      if (step.mode === 'human_only' && step.agent) {
        return refusal(`this step is done with the ${step.agent_tool || 'add_data'} tool, not run_next_step: `
          + step.agent);
      }
      if (step.mode === 'human_only') return refusal(`a person does this step: ${step.say}`);
      if (step.mode === 'wait') return refusal('something is running — call project_status with wait_seconds');
      const declineKey = `${cwd}::${step.id}`;
      if (declined === true) {
        // the person's "not now": recorded, nothing runs (stress test 7)
        const why = declineRefusal(step);
        if (why) return refusal(why, { answers: step.answers });
        const at = new Date().toISOString();
        declines.set(declineKey, { at });
        return text({ declined: step.id, ran: [],
          say: 'Nothing ran. It is not asked again this session; if they bring it up and say yes, take it then.',
          next: withDeclined(withNotAdded(compact(r.doc), cwd), cwd) });
      }
      if (confirmed === true || answers) declines.delete(declineKey);     // their yes
      if (step.mode === 'confirm' && confirmed !== true) {
        return refusal(`ask the person first, then call again with confirmed: true. The step: ${step.say}`);
      }
      if (!step.command) return refusal(`this step has no command to run: ${step.say}`);
      // A step that failed twice the same way is not run a third time on the
      // agent's say-so (a scripted walk retried a refused export forever):
      // the person decides — fix what it says, or ask for another try.
      const failKey = `${cwd}::${step.id}`;
      const failed = failures.get(failKey);
      if (failed && failed.count >= MAX_FAILED_TRIES && confirmed !== true) {
        return refusal(`this step has failed ${failed.count} times (last: ${failed.why}). Tell the person what it `
          + 'said and ask what to do: they can fix it (a corrected command run in a terminal is fine — '
          + 'off the rails — then call project_status), or say to try again as it is (confirmed: true).',
        { last_output: failed.output });
      }
      if (/<[^>]+>/.test(step.command)) {
        return refusal('this step\'s command has slots only the person can fill (written as <…>): '
          + `${step.command}. ${step.say}`);
      }
      let parts;
      try {
        parts = tokenize(step.command);
      } catch (e) {
        return refusal(e.message);
      }
      if (step.mode === 'ask_user') {
        const f = fillAnswers(parts, step.answers, answers);
        if (f.error) return refusal(f.error, { question: step.question, answers: step.answers });
        parts = f.parts;
      }
      const ran = [];
      for (const argv of parts) {
        const l = launcherFor(argv, env);
        if (l.error) return refusal(l.error, { ran });
        const timeoutMs = argv[0] === 'uv' ? 15 * 60 * 1000 : COMMAND_TIMEOUT_MS;
        const res = await runBounded(l.cmd, l.args, { cwd, env, timeoutMs });
        ran.push({ command: argv.join(' '), exit_code: res.code, timed_out: res.timedOut || undefined, output: tail(res.out) });
        if (res.timedOut || res.code !== 0) break;
      }
      const last = ran[ran.length - 1];
      if (last && (last.timed_out || last.exit_code !== 0)) {
        failures.set(failKey, { count: (failed?.count || 0) + 1,
          why: last.timed_out ? 'timed out' : `exit ${last.exit_code}`, output: last.output });
      } else {
        failures.delete(failKey);
      }
      const after = await cliJson(['next', cwd], cwd, env);
      return text({ ran, next: after.error ? { error: after.error }
        : withDeclined(withNotAdded(compact(after.doc), cwd), cwd) });
    },
  );

  server.tool(
    'add_data',
    'Bring a file the person has (a spreadsheet .xlsx/.ods/.csv, a .tsv/.txt, a table in a Word .docx, or a '
    + 'Toolbox or LIFT (FieldWorks) dictionary — its words with into: lexicon, its example sentences as pairs — '
    + 'or an ELAN .eaf file, whose transcription and translation tiers become pairs; or USFM scripture — a .usfm '
    + 'file or folder, paired verse by verse with the other language\'s text given as usfm_source, and held back '
    + 'from training until its holders say so) '
    + 'into the project as sentence pairs. Never open the file yourself — this reports counts and columns, '
    + 'never sentences. If it asks which column is which, ask the person.',
    {
      project_dir: projectDir,
      path: z.string().describe('The file, where it is: absolute, or relative to the project folder or to where you started (e.g. ../family-files/grandpa.xlsx).'),
      into: z.enum(['parallel', 'test', 'lexicon']).optional().describe('parallel (default); test — the checked sentences no model learns from; lexicon — a word list (dictionary).'),
      source_col: z.string().optional().describe('The source column: a letter (A), a number, or its header — for an ELAN file, the tier number the refusal lists.'),
      target_col: z.string().optional().describe('The target column.'),
      sheet: z.string().optional().describe('Which sheet or table, when there are several.'),
      header: z.boolean().optional().describe('true if the first row is a header, false if it is data.'),
      usfm_source: z.string().optional().describe('For USFM scripture only: the other language\'s text (a .usfm file or a folder of them), relative to the project folder.'),
      replace: z.boolean().optional().describe('true to read a file you already added again (another header or columns); its holders\' answers are kept.'),
    },
    async ({ project_dir, path, into, source_col, target_col, sheet, header, usfm_source, replace }) => {
      const at = projectAt(project_dir);
      if (at.refused) return refusal(at.refused);
      const { cwd } = at;
      if (/^\s*<[^>]*>\s*$/.test(path)) {
        return refusal(`${path} is the step's placeholder — pass each file the person named, where it is`);
      }
      const found = dataFileAt(path, cwd);
      const tried = notAdded.get(cwd) || new Map();
      notAdded.set(cwd, tried);
      const name = basename(found.file || path);
      if (found.refused) {
        tried.set(name, { name, file: path, refused: found.refused.split('\n')[0] });
        return refusal(found.refused);
      }
      const args = ['data', 'add', found.from ? found.file : path, ...(into ? ['--into', into] : []),
        ...(source_col ? ['--source-col', source_col] : []), ...(target_col ? ['--target-col', target_col] : []),
        ...(sheet ? ['--sheet', sheet] : []), ...(header === true ? ['--header'] : []), ...(header === false ? ['--no-header'] : []),
        ...(usfm_source ? ['--usfm-source', usfm_source] : []), ...(replace === true ? ['--replace'] : [])];
      const res = await runBounded(process.execPath, [resolveCliBin(env), ...args], { cwd, env, timeoutMs: 120_000 });
      if (res.code !== 0) {
        const why = tail(res.out);
        tried.set(name, { name, file: found.file, refused: why.replace(/^\[ERR\]\s*/, '').split('\n')[0] });
        return refusal(why);
      }
      tried.delete(name);
      // (the CLI ran in the project folder: its paths are from there)
      const also = alsoCalls(res.out, cwd);
      return text({ result: tail(res.out),
        ...(found.from ? { read_from: `${found.file} (found from where you started, not the project folder)` } : {}),
        ...(also.length ? { also } : {}) });
    },
  );

  server.tool(
    'try_translation',
    'Translate a few of the person\'s own sentences with the model this project serves on this computer '
    + '(once the serve step ran). If the model learned from sentences marked local-only, what it writes '
    + 'stays on this machine: you get the address of its own page for the person to open, not the text.',
    {
      project_dir: projectDir,
      text: z.string().max(2000).describe('One sentence per line, up to 10 lines: words the person gave you.'),
    },
    async ({ project_dir, text: input }) => {
      // any folder holding the model's workshop will do; a missing one is said
      const at = projectAt(project_dir, { needProjectFile: false });
      if (at.refused) return refusal(at.refused);
      const { cwd } = at;
      const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return refusal('nothing to translate — pass one sentence per line');
      if (lines.length > TRY_MAX_LINES) return refusal(`at most ${TRY_MAX_LINES} lines at a time`);
      const served = await servedModel(cwd, env);
      if (served.error) return refusal(served.error);
      const { base, health } = served;
      // older servers do not say: unknown is treated as local-only
      if (health.output_local_only !== false) {
        return text({
          model: health.model,
          shown_to_person_only: true,
          open: `${base}/`,
          say: `The model is running. It learned from sentences marked local-only, and a small model repeats `
            + `what it learned, so what it writes stays on this computer. Ask the person to open ${base}/ in `
            + 'their browser and try it there — and not to paste its translations back to you.',
        });
      }
      let res;
      try {
        res = await fetch(`${base}/translate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keys: Object.fromEntries(lines.map((l, i) => [`l${i}`, l])) }),
          signal: AbortSignal.timeout(TRY_TIMEOUT_MS),
        });
      } catch (e) {
        return refusal(`the model at ${base} did not answer (${e.name === 'TimeoutError' ? 'timed out' : e.message})`);
      }
      if (res.status === 401) {
        return refusal('the model\'s server asks for an access token — the person can try it at '
          + `${base}/ instead; tokens are never handed to an agent`);
      }
      let d;
      try {
        d = await res.json();
      } catch {
        return refusal(`the model at ${base} answered ${res.status} with no JSON`);
      }
      if (!d.translations) return refusal(d.error?.message || `the model answered ${res.status}`);
      if (d.meta?.output_local_only) {
        return refusal('the model says what it writes stays on this computer — the person can try it at '
          + `${base}/`);
      }
      return text({
        model: health.model,
        pair: health.pair,
        translations: lines.map((l, i) => ({ source: l, translation: d.translations[`l${i}`] ?? null })),
        ...(d.errors ? { errors: d.errors } : {}),
        say: 'Pass these on as they are. The server checks nothing it returns; only a fluent speaker can say '
          + 'whether a translation is right, and a small model is often confidently wrong.',
      });
    },
  );

  server.tool(
    'explain',
    'Plain-words explanations to pass on: rails (the steps), privacy (what the sidecar means), quality '
    + '(what a score does and does not promise), modes (how to take a step), improve (the rounds after a model '
    + 'is in use), off_rails (stepping off).',
    { topic: z.enum(Object.keys(EXPLAIN)) },
    async ({ topic }) => text(EXPLAIN[topic]),
  );
}
