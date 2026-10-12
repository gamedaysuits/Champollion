/**
 * Harness tools — run mt-eval benchmarks via child process.
 *
 * This module wraps the mt-eval CLI: queue items (budget/top/item_id) and
 * ANY corpus (a registry id or a file the user holds) on any model — a hosted
 * API or one on this machine (`--provider local`, `--method local-model`).
 * The actual execution spawns mt-eval as a subprocess. If mt-eval isn't
 * installed, the tool returns instructions for installation.
 *
 * Publishing is OFF unless `publish: true` is passed, and every response that
 * could publish names the target (production or not). A data steward's
 * local-only mark (`<file>.champollion.json`) and the harness's transmission
 * refusals are surfaced as refusals — never routed around.
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
import { existsSync, readFileSync, statSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { methodRegistry } from './translate.js';
import {
  JOB_HISTORY_LIMIT, TERMINAL_STATUSES, clearJobStore, ensureJobFiles, execJob,
  findJobRecord, findJobResults, isSupervisorAlive, jobDirFor, jobStorePath, newJobId,
  readExitRecord, readJobLogs, readJobStore, readTail, reportHeadline, saveJob,
} from './jobs.js';
import { displayPath, mcpStateDir } from './state.js';
import { ackLines, probePublishGates, publishFacts } from './publish-preview.js';
import { count } from './plural.js';
import { trimMiddle } from './output-trim.js';
import {
  evalPackPlanLines, probeRunPlan, promptPlanLines, registryTermsLines, scriptPlanLines,
} from './run-plan.js';
import { shellJoin } from './args.js';
import { forgeOrderLines, localModelWeightsLines } from './plan-notes.js';
import { metricsPlanLines, metricsRefusal, probeMetrics } from './metrics-plan.js';
import { releasableReason, releasableRoot, runsBaseFor } from './releasable.js';

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
// Publishing — OFF unless the caller says publish:true, and always NAMED.
// ---------------------------------------------------------------------------
//
// 0.1.x auto-published every budget/top queue run to the production
// leaderboard unless the agent remembered `publish:false`. A synthetic-user
// test found that default spending a stranger's results onto the public board,
// so 0.2.0 inverts it: nothing is written anywhere unless `publish: true` is
// passed, and every response that could publish says WHERE.
//
// The harness writes to MT_EVAL_SUPABASE_URL (default: the production project)
// and refuses a production write from `mt-eval run --publish` without `--prod`
// (a SEPARATE opt-in from `--yes`). An explicit `publish: true` at this
// boundary — after the user confirmed — IS that opt-in, so `--prod` is passed
// for a production target and the response says "PRODUCTION" in capitals.

const PROD_SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const PROD_SUPABASE_HOST = 'sjdomynysdljkbemupqa.supabase.co';

/**
 * Where a publish from the harness would land, given this environment.
 *
 * @param {object} [env]
 * @returns {{url: string, prod: boolean, label: string}}
 */
export function publishTarget(env = process.env) {
  const url = String(env.MT_EVAL_SUPABASE_URL || PROD_SUPABASE_URL).replace(/\/+$/, '');
  const prod = url.includes(PROD_SUPABASE_HOST);
  return {
    url,
    prod,
    label: prod
      ? 'PRODUCTION — the public champollion.dev leaderboard (https://champollion.dev/leaderboard)'
      : `a NON-production project (${url}, from MT_EVAL_SUPABASE_URL)`,
  };
}

/** Publish flags for an `mt-eval run` argv (item and corpus modes). */
function runPublishFlags({ publish, anonymous }, env) {
  if (publish !== true) return [];
  const flags = ['--publish'];
  if (publishTarget(env).prod) flags.push('--prod');
  if (anonymous === true) flags.push('--anonymous');
  return flags;
}

/** Publish flags for an `mt-eval queue` argv. Queue runs publish unless told not to. */
function queuePublishFlags({ publish, anonymous }) {
  if (publish !== true) return ['--no-publish'];
  return anonymous === true ? ['--anonymous'] : [];
}

/**
 * The one sentence every plan/start/status message uses about publishing.
 * `target` (a publishTarget() result) wins over `env` — a job record keeps
 * the target it was started with, never the environment it came from.
 */
function publishSentence(publish, env, { future = true, target = null } = {}) {
  if (publish !== true) {
    return future
      ? 'Results stay LOCAL — nothing is published (pass publish: true, with the user\'s consent, to publish).'
      : 'Results stayed LOCAL — nothing was published.';
  }
  const t = target ?? publishTarget(env);
  return future
    ? `Results WILL BE PUBLISHED to ${t.label}.`
    : `Results were published to ${t.label}.`;
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
const FIELD_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u001f\u007f]/;

/** LLM providers the harness's `mt-eval run --provider` accepts. */
export const RUN_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'gemini', 'local'];

function requireStrField(item, key) {
  const val = item == null ? undefined : item[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`queue item is missing or has an empty '${key}' field`);
  }
  return val;
}

function checkLanguageName(name, label = 'target_language') {
  // Language names may contain spaces, parentheses, commas and non-ASCII
  // letters (e.g. "Plains Cree (nêhiyawêwin, SRO)"). Reject only a leading
  // dash (would parse as an option) and control characters.
  if (name.startsWith('-') || CTRL_RE.test(name)) {
    throw new Error(`${label} failed validation: ${name}`);
  }
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
 * @param {boolean} [opts.publish]    true = publish (see publishTarget)
 * @param {boolean} [opts.anonymous]  with publish: no sign-in
 * @param {boolean} [opts.skipFst]    score without FST acceptance (--skip-fst)
 * @param {boolean} [opts.skipEvalStandard]  score without the eval-standard metrics
 * @param {object} [opts.env]
 * @returns {string[]}
 */
export function buildRunArgv(item, {
  provider, publish, anonymous, skipFst = false, skipEvalStandard = false, env = process.env,
  metricx = false, metricxModel = null, fuse = false,
} = {}) {
  const corpusId = requireStrField(item, 'corpus_id');
  const model = requireStrField(item, 'model');
  const targetLanguage = requireStrField(item, 'target_language');

  if (!CORPUS_ID_RE.test(corpusId)) {
    throw new Error(`corpus_id failed validation: ${corpusId}`);
  }
  if (!MODEL_RE.test(model)) {
    throw new Error(`model failed validation: ${model}`);
  }
  checkLanguageName(targetLanguage);

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
  argv.push(...skipFlags({ skipFst, skipEvalStandard }));
  argv.push(...metricFlags({ metricx, metricxModel, fuse }));
  argv.push(...runPublishFlags({ publish, anonymous }, env));
  return argv;
}

/**
 * `mt-eval run`'s scoring opt-outs: --skip-fst (no FST acceptance) and
 * --skip-eval-standard (no eval-standard metrics) — the run card marks each
 * not computed. The user's choice when a language's evaluation pack is not
 * installed and they want a score anyway (Round 7).
 */
function skipFlags({ skipFst, skipEvalStandard }) {
  return [...(skipFst === true ? ['--skip-fst'] : []),
    ...(skipEvalStandard === true ? ['--skip-eval-standard'] : [])];
}

/**
 * `mt-eval run`'s opt-in neural metrics (Round 13): --metricx (with
 * --metricx-model <checkpoint>) and --fuse. COMET has no run flag — the
 * harness computes it whenever unbabel-comet is installed (metrics-plan.js).
 */
function metricFlags({ metricx, metricxModel, fuse }) {
  return [...(metricx === true ? ['--metricx'] : []),
    ...(metricx === true && metricxModel ? ['--metricx-model', metricxModel] : []),
    ...(fuse === true ? ['--fuse'] : [])];
}

/**
 * A MetricX checkpoint given as metricx_model: a Hugging Face id or a local
 * directory, never option-looking; only with metricx: true. Returns the
 * trimmed value (null when not given). Throws a message an agent can act on.
 */
export function checkMetricxModel({ metricx, metricx_model: model }) {
  if (model == null) return null;
  if (metricx !== true) throw new Error('metricx_model applies with metricx: true (it picks the MetricX checkpoint)');
  const v = typeof model === 'string' ? model.trim() : '';
  if (!v || v.startsWith('-') || CTRL_RE.test(v)) {
    throw new Error(`metricx_model must be a Hugging Face id (e.g. google/metricx-24-hybrid-xl-v2p6) or a model directory (got ${JSON.stringify(model)})`);
  }
  return v;
}

/** Is `url` a loopback endpoint (nothing leaves the machine)? */
export function isLoopbackUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return false;
  }
  return host === 'localhost' || host.endsWith('.localhost')
    || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/** The endpoint `--provider local` will call: flag > LOCAL_API_BASE > OPENAI_API_BASE > registry default. */
export function localEndpoint(baseUrl, env = process.env, defaultBase = null) {
  return baseUrl || env.LOCAL_API_BASE || env.OPENAI_API_BASE || defaultBase || null;
}

/**
 * A data steward's sidecar `<file>.champollion.json` — `{"transmission":
 * "local-only"}` means only a model on this machine may see the file. Read
 * the SIDECAR only (metadata), never the corpus. null when absent/unreadable.
 */
export function readStewardSidecar(corpusPath, { exists = existsSync, read = readFileSync } = {}) {
  const sidecar = `${corpusPath}.champollion.json`;
  if (!exists(sidecar)) return null;
  try {
    const data = JSON.parse(read(sidecar, 'utf-8'));
    return data && typeof data === 'object' ? { path: sidecar, data } : null;
  } catch {
    return { path: sidecar, data: null, unreadable: true };
  }
}

/** Registry entries keyed by the name a run passes (`cli_name` or the key). */
export function methodEntriesByName(registry) {
  const out = {};
  for (const [k, e] of Object.entries(registry?.entries ?? {})) {
    if (e && typeof e === 'object') out[e.cli_name || k] = e;
  }
  return out;
}

/**
 * Where an MT engine sends each sentence, as its configuration says: the first
 * URL-shaped variable among the registry entry's `env` that is set
 * (APERTIUM_API_URL, MICROSOFT_TRANSLATOR_ENDPOINT, …) — the override the
 * harness's adapter reads — else the registry's `default_base_url`. null when
 * neither says (a cloud API whose URL lives in its adapter).
 *
 * @returns {{url: string, from: string}|null}
 */
export function engineEndpoint(entry, env = process.env) {
  for (const v of entry?.env ?? []) {
    if (/_(URL|ENDPOINT|BASE)$/.test(v) && typeof env[v] === 'string' && env[v].trim()) {
      return { url: env[v].trim(), from: v };
    }
  }
  if (entry?.default_base_url) return { url: entry.default_base_url, from: 'its registry default' };
  return null;
}

/** Dependency classes whose plugins call no API (methods spec: "an S or O plugin calls no API"). */
export const NO_API_DEPENDENCY_CLASSES = Object.freeze(['S', 'O']);
/** Dependency-manifest `access` values that ARE a runtime network call (methods spec). */
export const RUNTIME_NETWORK_ACCESS = Object.freeze(['gateway', 'external-api']);

/**
 * What a method plugin's method.json DECLARES about its dependencies, and
 * whether that declaration means it calls no API — the harness's own rule
 * (method_loader.plugin_calls_no_api; test/round12.test.js runs both on the
 * same manifests): dependency_class S or O, and a `dependencies` LIST (S's
 * `[]` is the spec's affirmative "no external dependencies") naming no
 * gateway / external-api access. The plan said "Cost: unknown (the plugin
 * prices its own calls)" and "it makes its own calls" for a plugin
 * declaring S with no dependencies (synthetic researcher, Round 12).
 *
 * @param {object} manifest  the parsed method.json
 * @returns {{dependencyClass: string|null, dependencyCount: number|null, noApi: boolean}}
 */
export function pluginDependencyTerms(manifest) {
  const cls = typeof manifest?.dependency_class === 'string' ? manifest.dependency_class.trim() : '';
  const deps = manifest?.dependencies;
  const list = Array.isArray(deps) ? deps : null;
  const noApi = NO_API_DEPENDENCY_CLASSES.includes(cls) && list !== null
    && list.every((d) => d && typeof d === 'object' && !Array.isArray(d)
      && !RUNTIME_NETWORK_ACCESS.includes(String(d.access ?? '').trim().toLowerCase()));
  return { dependencyClass: cls || null, dependencyCount: list ? list.length : null, noApi };
}

/**
 * The methods spec's five dependency classes, ``(name, what it means for what
 * the run costs)`` — a verbatim mirror of the harness's
 * method_loader.DEPENDENCY_CLASSES (test/round13-overview-coaching.test.js
 * compares the two), so a plan says a plugin's cost in the harness's words.
 */
export const DEPENDENCY_CLASSES = Object.freeze({
  S: ['self-contained', 'no external dependency — no API call to price; the cost is this machine\'s compute'],
  O: ['open external', 'open artifacts fetched or mirrored, no runtime API — no API call to price; the cost is this '
    + 'machine\'s compute'],
  A1: ['API-dependent, substitutable', 'the plugin calls an LLM itself — it makes and pays for those calls, so the '
    + 'harness has no token count to price'],
  A2: ['API-dependent, non-substitutable', 'the plugin calls an external service itself — its calls are its own cost, '
    + 'which the harness cannot see'],
  X: ['closed', 'bundles content without redistribution rights — inadmissible in every lane; its cost is its own'],
});

/** Python's repr() of a short string — what the harness's f"{dep_class!r}" prints. */
function pyRepr(v) {
  const t = String(v);
  if (t.includes("'") && !t.includes('"')) return `"${t}"`;
  return `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Why a method plugin's run has no harness cost estimate, in the terms of the
 * dependency class its method.json declares — the harness's own
 * method_loader.plugin_cost_basis, word for word (its "Est. cost" line is
 * "unknown — <this>"; a declared S/O plugin's is "$0 API cost (runs on this
 * machine) — <this>").
 *
 * @param {string|null} dependencyClass  as method.json declares it (pluginDependencyTerms)
 * @returns {string}
 */
export function pluginCostBasis(dependencyClass) {
  const cls = typeof dependencyClass === 'string' ? dependencyClass.trim() : '';
  const known = Object.hasOwn(DEPENDENCY_CLASSES, cls) ? DEPENDENCY_CLASSES[cls] : null;
  if (known) return `method plugin, dependency class ${cls} (${known[0]}): ${known[1]}`;
  if (dependencyClass) {
    return `method plugin declaring dependency class ${pyRepr(dependencyClass)} (not one of S/O/A1/A2/X): its cost is its own`;
  }
  return 'method plugin with no dependency class declared in method.json: its cost is its own (unknown, never assumed $0)';
}

/**
 * Build the `mt-eval run` argv for an arbitrary corpus — a registry id, or a
 * file the user holds. Pure apart from the existence checks (injectable).
 *
 * Who carries the text mirrors the harness's transmission gate
 * (arena/mt_eval_harness/transmission_policy.py, enforce_transmission_policy):
 *   - an LLM provider is LOCAL only when it is provider "local" at a loopback
 *     endpoint (the harness verifies that endpoint itself); otherwise remote;
 *   - the harness's OWN "local-model" adapter runs the model in this process:
 *     nothing leaves the machine, so it is local with NO attestation (the
 *     harness marks it in_process_transport; since c75dc225a) — and an
 *     attestation for it is refused as meaningless;
 *   - an MT ENGINE or a method PLUGIN directory owns its own transport, which
 *     the harness cannot see. It never counts as local on its name: only the
 *     USER's attest_local_transport (--attest-local-transport, recorded in the
 *     RunLog) makes it so, and an engine whose configured endpoint is not this
 *     machine cannot be attested.
 *
 * The run card's source language: `source_language` (a NAME) becomes
 * --source-lang; when the corpus says its own pair — the steward's sidecar or
 * the corpus card it names (`pair.source`) — that code goes as --source-code
 * and the harness names the language itself (its offline card lookup).
 *
 * @returns {{argv: string[], corpusKind: 'registry'|'file', corpusPath: string|null,
 *   localOnly: object|null, transport: 'local'|'remote'|'method',
 *   methodKind: 'engine'|'local-model'|'plugin'|null, methodDir: string|null,
 *   engine: {url: string, from: string, loopback: boolean}|null, attested: boolean}}
 */
export function buildCorpusArgv(params, {
  env = process.env,
  exists = existsSync,
  isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } },
  isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } },
  read = readFileSync,
  mtMethods = null,
  methodEntries = methodEntriesByName(methodRegistry()),
  localDefaultBase = methodRegistry()?.entries?.local?.default_base_url ?? null,
  // code → the language's NAME from the card index (languageNameFor), or null
  languageName = null,
  // where the job runs (the harness's default cache is relative to it)
  cwd = process.cwd(),
} = {}) {
  const {
    corpus, model, method, method_dir, target_language, source_language, source_field, target_field,
    provider = 'openrouter', base_url, max_cost, attest_no_training,
    attest_local_transport, accept_nc_terms, publish, anonymous, coaching_file, glossary,
    skip_fst, skip_eval_standard, script, allow_model_pair_mismatch, metricx, fuse,
  } = params;
  const providerGiven = params.provider != null;
  const metricxModel = checkMetricxModel(params);
  if (typeof corpus !== 'string' || !corpus.trim()) throw new Error('corpus is required');
  const c = corpus.trim();
  if (CTRL_RE.test(c)) throw new Error('corpus failed validation');

  // A path the user holds wins over a registry id that happens to look alike.
  let corpusKind;
  let corpusArg;
  let corpusPath = null;
  const looksLikePath = /[/\\]/.test(c) || /\.(jsonl?|tsv)$/i.test(c) || c.startsWith('~');
  const expanded = c.startsWith('~') ? join(homedir(), c.slice(1)) : c;
  if (exists(resolve(expanded)) && isFile(resolve(expanded))) {
    corpusKind = 'file';
    corpusPath = resolve(expanded);
    corpusArg = corpusPath;           // absolute — can never start with '-'
  } else if (looksLikePath) {
    throw new Error(`corpus file not found: ${c}. Pass a registry id (see list_corpora) or `
      + 'the path to a .json/.jsonl/.tsv file you hold.');
  } else if (CORPUS_ID_RE.test(c)) {
    corpusKind = 'registry';
    corpusArg = c;
  } else {
    throw new Error(`corpus failed validation: ${c}`);
  }

  if (!RUN_PROVIDERS.includes(provider)) {
    throw new Error(`provider must be one of ${RUN_PROVIDERS.join(', ')}`);
  }
  if (method != null) {
    if (typeof method !== 'string' || !FIELD_RE.test(method) || (mtMethods && !mtMethods.includes(method))) {
      throw new Error(`method must be one of: ${(mtMethods || []).join(', ') || 'a registered MT method name'}`
        + ' (a method plugin directory goes in method_dir)');
    }
  }
  // A method plugin directory the user holds: method.json + a translate()
  // class (`mt-eval run --method <dir>`). Resolved to an absolute path like
  // `corpus`, so it can never start with '-'.
  let methodDir = null;
  let pluginDeps = null;
  if (method_dir != null) {
    if (method != null) throw new Error('pass method (a registered MT method) OR method_dir (a plugin directory), not both');
    if (typeof method_dir !== 'string' || !method_dir.trim() || CTRL_RE.test(method_dir)) {
      throw new Error('method_dir failed validation');
    }
    const v = method_dir.trim();
    const d = resolve(v.startsWith('~') ? join(homedir(), v.slice(1)) : v);
    if (!exists(d) || !isDir(d)) throw new Error(`method_dir not found (or not a directory): ${v}`);
    const manifestPath = join(d, 'method.json');
    if (!exists(manifestPath) || !isFile(manifestPath)) {
      throw new Error(`method_dir has no method.json: ${d} — a method plugin is a directory with `
        + 'method.json and a Python module exposing a translate() class.');
    }
    // The harness's own required fields (method_loader._REQUIRED_MANIFEST_FIELDS):
    // checked here so a champollion plugin manifest (type "api" — e.g. the
    // champollion-plugin/ folder of an nmt-forge export, which is for the
    // champollion CLI) is refused with the right advice, not a loader trace.
    let manifest;
    try {
      manifest = JSON.parse(read(manifestPath, 'utf-8'));
    } catch (err) {
      throw new Error(`method_dir/method.json is not valid JSON (${err.message}): ${manifestPath}`);
    }
    const missing = ['name', 'entry_point'].filter((k) => !manifest || typeof manifest[k] !== 'string' || !manifest[k].trim());
    if (missing.length) {
      throw new Error(`method_dir/method.json lacks ${missing.join(' and ')} — it is not an mt-eval method `
        + 'plugin (those declare entry_point "module:ClassName"). A champollion plugin manifest (type "api", '
        + 'e.g. an nmt-forge export\'s champollion-plugin/) is for the champollion CLI; score a forge model '
        + 'with forge_export, or serve it and run it as provider "local" at its loopback /v1.');
    }
    methodDir = d;
    pluginDeps = pluginDependencyTerms(manifest);
  }
  const isMethodRun = method != null || methodDir != null;
  if (isMethodRun && providerGiven) {
    // The harness ignores --provider when a method carries the text; a
    // provider the agent believes is in force but is not would mislabel the run.
    throw new Error('provider applies to LLM runs only — a method (MT engine, local-model or '
      + 'method_dir plugin) carries the text itself. Drop provider.');
  }
  // With method_dir, `model` goes TO the plugin (`mt-eval run --method <dir>
  // -m <model>` reaches it as config.method_model, recorded on the run card)
  // in the plugin's own naming — never checked against OpenRouter slugs. The
  // methods spec and the CLI both say so; this tool used to refuse it.
  if (attest_local_transport === true && !isMethodRun) {
    throw new Error('attest_local_transport applies to method_dir plugins and MT engines only — for an '
      + 'LLM the harness checks the endpoint itself (provider "local" at a loopback URL is local).');
  }
  const localModel = method === 'local-model'
    || (method != null && methodEntries?.[method]?.kind === 'local-model');
  if (attest_local_transport === true && localModel) {
    throw new Error('attest_local_transport does not apply to method "local-model": the harness runs that '
      + 'model in this process, so nothing leaves the machine and no attestation is needed (or recorded). '
      + 'Drop attest_local_transport.');
  }
  if (model != null) {
    // A method's model is a name in ITS world (a Hugging Face id, a local
    // model directory, a plugin's own model name); an LLM provider's is a
    // slug. Both refuse an option-looking value and control characters.
    const ok = typeof model === 'string' && model.trim() !== ''
      && (isMethodRun ? !model.startsWith('-') && !CTRL_RE.test(model) : MODEL_RE.test(model));
    if (!ok) throw new Error(`model failed validation: ${model}`);
  }
  if ((provider === 'local' || method === 'local-model') && !model) {
    throw new Error(method === 'local-model'
      ? 'method "local-model" needs model: a Hugging Face id or local model directory (e.g. facebook/nllb-200-distilled-600M) '
        + '— the harness has no default model for it and refuses a run without one (-m)'
      : 'provider "local" needs model: the name your local server serves (e.g. "llama3.1", "qwen2.5:7b")');
  }
  // An OPUS-MT pair model names its own pair (opus-mt-en-fi writes Finnish):
  // the harness refuses one whose pair visibly differs from the run's unless
  // the user asks for it (a related-language baseline).
  if (allow_model_pair_mismatch === true && !localModel) {
    throw new Error('allow_model_pair_mismatch applies to method "local-model" only (an OPUS-MT pair model '
      + 'run against another pair) — drop it.');
  }
  if (base_url != null) {
    if (!['local', 'openai'].includes(provider)) throw new Error('base_url applies only to provider "local" or "openai"');
    let u;
    try { u = new URL(base_url); } catch { throw new Error(`base_url is not a URL: ${base_url}`); }
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('base_url must be http(s)');
  }
  if (target_language != null) checkLanguageName(String(target_language));
  if (source_language != null) {
    if (typeof source_language !== 'string' || !source_language.trim()) {
      throw new Error('source_language must be a language NAME (e.g. "English")');
    }
    checkLanguageName(source_language.trim(), 'source_language');
  }
  for (const [k, v] of [['source_field', source_field], ['target_field', target_field]]) {
    if (v != null && (typeof v !== 'string' || !FIELD_RE.test(v))) throw new Error(`${k} failed validation: ${v}`);
  }
  if (max_cost != null && !(Number.isFinite(max_cost) && max_cost > 0)) {
    throw new Error('max_cost must be a positive number (USD)');
  }
  // Coaching file (sent to the model as its instructions) and glossary (a
  // scoring input, never sent): files the user holds, passed through as
  // absolute paths so mt-eval reads exactly what was named.
  const userFile = (name, value) => {
    if (value == null) return null;
    if (typeof value !== 'string' || !value.trim() || CTRL_RE.test(value)) {
      throw new Error(`${name} failed validation`);
    }
    const v = value.trim();
    const p = resolve(v.startsWith('~') ? join(homedir(), v.slice(1)) : v);
    if (!exists(p) || !isFile(p)) throw new Error(`${name} not found: ${v}`);
    return p;
  };
  const coachingPath = userFile('coaching_file', coaching_file);
  const glossaryPath = userFile('glossary', glossary);
  if (coachingPath && isMethodRun) {
    throw new Error('coaching_file coaches an LLM; it does not apply with method / method_dir '
      + '(an MT engine, local-model or a method plugin)');
  }
  // The script the output must be in (ISO 15924) — `mt-eval run
  // --target-script`, which the harness's prompt asks for. A method gets no
  // prompt, so the harness refuses it there; refused here first.
  let scriptCode = null;
  if (script != null) {
    const sc = typeof script === 'string' ? script.trim() : '';
    if (!/^[A-Za-z]{4}$/.test(sc)) {
      throw new Error(`script must be an ISO 15924 code — four letters, e.g. "Latn" or "Cans" (got ${JSON.stringify(script)})`);
    }
    if (isMethodRun) {
      throw new Error('script is asked for in the harness\'s prompt, and a method (MT engine, local-model or '
        + 'method_dir plugin) gets no prompt — it writes whatever script it writes. Drop script, and check '
        + 'the method\'s output is in the script your references use.');
    }
    scriptCode = sc[0].toUpperCase() + sc.slice(1).toLowerCase();
  }

  // Transport: does this run send the corpus off the machine? (The harness's
  // rule — see the doc comment above.)
  const endpoint = provider === 'local' && !isMethodRun ? localEndpoint(base_url, env, localDefaultBase) : null;
  let transport;
  let methodKind = null;
  let engine = null;
  const attested = isMethodRun && attest_local_transport === true;
  if (isMethodRun) {
    const entry = method ? methodEntries?.[method] : null;
    methodKind = methodDir ? 'plugin' : (localModel ? 'local-model' : 'engine');
    if (methodKind === 'engine') {
      const ep = engineEndpoint(entry, env);
      engine = ep ? { ...ep, loopback: isLoopbackUrl(ep.url) } : null;
      // An engine is a service: remote unless its configuration points it at
      // this machine. Attesting a local transport for an engine configured
      // for another host would write a false statement into the RunLog.
      if (attested && !engine?.loopback) {
        const envUrl = (entry?.env ?? []).find((v) => /_(URL|ENDPOINT|BASE)$/.test(v));
        throw new Error(`attest_local_transport cannot apply: method "${method}" is configured for `
          + (engine ? `${engine.url} (${engine.from})` : 'its provider\'s cloud API (no local endpoint is configured)')
          + ', which is not this machine — attesting a local transport would be false.'
          + (envUrl ? ` If the user runs this engine on this machine, set ${envUrl} to its loopback URL first.` : ''));
      }
    }
    // The harness's own local-model adapter runs the model in this process:
    // no sentence leaves the machine, so it is local without an attestation
    // (the harness marks it in_process_transport). Engines and plugins make
    // their own calls and stay external unless the user attests otherwise.
    transport = (attested || methodKind === 'local-model') ? 'local' : 'method';
  } else if (provider === 'local') transport = endpoint && isLoopbackUrl(endpoint) ? 'local' : 'remote';
  else transport = 'remote';

  // The steward's local-only mark. The harness enforces it beneath us; we
  // refuse up front so an agent never even launches a run that would send a
  // community's text to a remote model — and never "tries another provider".
  let localOnly = null;
  let steward = null;
  let envelope = null;
  if (corpusKind === 'file') {
    const sc = readStewardSidecar(corpusPath, { exists, read });
    steward = sc;
    // the file's own envelope (harness JSON): the harness reads it too
    envelope = corpusEnvelope(corpusPath, { exists, read });
    const sidecarMark = sc?.data && String(sc.data.transmission || '').trim().toLowerCase();
    const mark = sidecarMark || envelope?.transmission;
    if (mark === 'local-only') {
      const markPath = sidecarMark ? sc.path : `${corpusPath} (its dataset.transmission)`;
      localOnly = { sidecar: markPath, attested };
      // A method without the user's attestation is refused exactly like a
      // remote provider: the harness would refuse it too (it cannot see a
      // method's transport), and an engine is a remote service by default.
      if (transport !== 'local') {
        const err = new Error('LOCAL-ONLY');
        err.transmissionRefusal = {
          sidecar: localOnly.sidecar,
          provider,
          endpoint,
          method: method ?? null,
          methodDir,
          methodKind,
          pluginDeps,
          engine,
        };
        throw err;
      }
    }
  }

  // The source language for the run card (and the prompt): the corpus's own
  // statement wins as a CODE the harness names; a given name is passed too.
  const corpusSource = corpusKind === 'file'
    ? (stewardSourceCode(steward, { exists, read })
      ?? (envelope?.source ? { code: envelope.source, from: envelope.from } : null))
    : null;
  const source = {
    name: source_language != null ? source_language.trim() : null,
    code: corpusSource?.code ?? null,
    from: corpusSource?.from ?? null,
  };

  // The target CODE, when this server knows it: the code the file's
  // steward sidecar / corpus card states (pair.target), else a
  // target_language that is itself a code ("qaa"). The plan resolved it but
  // the command left it out, so the harness warned three times about a
  // name no card knows and suggested an example code (Round 9 hospital
  // persona, a private-use qaa set). A registry corpus names its own.
  const terms = corpusKind === 'file' ? stewardTerms(steward, { exists, read }) : null;
  // what the sidecar/card leave unsaid, the file's own envelope may state
  if (terms && envelope) {
    if (terms.license == null && envelope.license) { terms.license = envelope.license; terms.licenseFrom = envelope.from; }
    if (terms.doNotTrain == null && envelope.doNotTrain != null) {
      terms.doNotTrain = envelope.doNotTrain; terms.doNotTrainFrom = envelope.from;
    }
    if (terms.targetCode == null && envelope.target) { terms.targetCode = envelope.target; terms.targetFrom = envelope.from; }
  }
  const givenCode = typeof target_language === 'string' && LANG_CODE_RE.test(target_language.trim())
    ? target_language.trim() : null;
  const targetCode = terms?.targetCode ?? givenCode;
  const targetCodeFrom = terms?.targetCode ? terms.targetFrom : (givenCode ? 'target_language' : null);
  // A CODE given where the prompt needs a NAME ("sme"): the language's name
  // from its card goes as --target-lang, the code as --target-lang-code. It
  // used to reach the naive prompt word for word — "Translate the given
  // English text to sme." — and nothing showed it (Round 11 researcher).
  // No card names it: the code stays, and the plan says so.
  let targetName = target_language != null ? String(target_language).trim() : null;
  let targetNamed = null;
  if (givenCode) {
    const nm = typeof languageName === 'function' ? languageName(givenCode) : null;
    targetNamed = { code: givenCode, name: nm || null };
    if (nm) targetName = nm;
  }
  // The harness's translation cache: the model's output per source sentence,
  // reused by a re-run. Named and placed on purpose (Round 11 hospital: an
  // eval/cache/ tree derived from a protected test set appeared in the project
  // root, the server's working directory, and nobody was told). A cache
  // already there from earlier runs keeps being used — its outputs were paid
  // for. Otherwise a file's cache goes beside its results (where its other
  // copies already are); a registry corpus's into this server's folder.
  //
  // Never inside a folder `mt-eval contest prepare` labels RELEASABLE (Round
  // 13: a baseline on a contest's released dev set wrote its cache and run
  // logs into <contest>/public/results/). A file in one runs into
  // <parent of that folder>/runs/ — results and cache — and an existing cache
  // inside one is not used (releasable.js; the harness refuses either).
  const releasable = corpusKind === 'file' ? releasableRoot(dirname(corpusPath), { isFile }) : null;
  const resultsBase = corpusKind === 'file'
    ? (releasable ? runsBaseFor(releasable) : join(dirname(corpusPath), 'results'))
    : null;
  const ownCache = corpusKind === 'file'
    ? { dir: join(resultsBase, 'cache'), from: releasable ? 'releasable' : 'corpus' }
    : { dir: join(mcpStateDir(env), 'cache', 'harness'), from: 'state' };
  const legacyCache = resolve(cwd, 'eval', 'cache', 'harness');
  const legacyHere = exists(legacyCache);
  const legacyReleasable = legacyHere ? releasableRoot(legacyCache, { isFile }) : null;
  const cache = legacyHere && !legacyReleasable ? { dir: legacyCache, from: 'existing' } : ownCache;
  // The last word: no output folder this run is handed may sit in a
  // releasable folder (a CHAMPOLLION_MCP_HOME inside a contest's public/ would).
  const resultsWhere = resultsBase ?? join(mcpStateDir(env), 'jobs');
  for (const [what, dir] of [['translation cache', cache.dir], ['results folder', resultsWhere]]) {
    const rel = releasableRoot(dir, { isFile });
    if (rel) {
      throw new Error([`the run's ${what} would be ${displayPath(dir)}, inside a releasable folder — `
        + `${releasableReason(rel, displayPath)} — and run logs and the cache hold the test sentences. Nothing was run.`,
      resultsBase ? null : 'Set CHAMPOLLION_MCP_HOME to a folder outside it.'].filter(Boolean).join(' '));
    }
  }
  // A code with a script subtag (crk-Cans) states the script too.
  const codeScript = targetCode ? (/-([A-Z][a-z]{3})(?:-|$)/.exec(targetCode)?.[1] ?? null) : null;
  const effectiveScript = scriptCode ?? (isMethodRun ? null : codeScript);

  const argv = ['run', '--corpus', corpusArg];
  if (model) argv.push('--model', model);
  if (method) argv.push('--method', method);
  if (methodDir) argv.push('--method', methodDir);
  if (targetName) argv.push('--target-lang', targetName);
  if (targetCode) argv.push('--target-lang-code', targetCode);
  if (effectiveScript) argv.push('--target-script', effectiveScript);
  if (source.name) argv.push('--source-lang', source.name);
  if (source.code) argv.push('--source-code', source.code);
  if (source_field) argv.push('--source-field', source_field);
  if (target_field) argv.push('--target-field', target_field);
  if (!isMethodRun && provider !== 'openrouter') argv.push('--provider', provider);
  if (base_url) argv.push('--base-url', base_url);
  if (max_cost != null) argv.push('--max-cost', String(max_cost));
  if (coachingPath) argv.push('--coaching-file', coachingPath);
  if (glossaryPath) argv.push('--glossary', glossaryPath);
  argv.push('--cache-dir', cache.dir);
  if (attest_no_training === true) argv.push('--attest-no-training');
  if (attested) argv.push('--attest-local-transport');
  if (accept_nc_terms === true) argv.push('--accept-nc-terms');
  if (allow_model_pair_mismatch === true) argv.push('--allow-model-pair-mismatch');
  argv.push(...skipFlags({ skipFst: skip_fst, skipEvalStandard: skip_eval_standard }));
  argv.push(...metricFlags({ metricx, metricxModel, fuse }));
  argv.push('--yes');
  argv.push(...runPublishFlags({ publish, anonymous }, env));
  return {
    argv, corpusKind, corpusPath, localOnly, transport, endpoint,
    methodKind, methodDir, pluginDeps, engine, attested, source,
    datasetId: corpusKind === 'registry' ? corpusArg : (steward?.data?.id ?? envelope?.id ?? null),
    terms,
    envelope,
    target: { code: targetCode, from: targetCodeFrom, name: targetName, named: targetNamed },
    cache,
    resultsBase,
    releasable,
    skippedCache: legacyReleasable ? { dir: legacyCache, rel: legacyReleasable } : null,
    metricxModel,
    coachingPath,
    script: effectiveScript
      ? { code: effectiveScript, from: scriptCode ? 'the script argument' : `the target code ${targetCode} (${targetCodeFrom})` }
      : null,
  };
}

const LANG_CODE_RE = /^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

/**
 * The language's NAME for a code, from the server's card index (entries the
 * card adapter built — normalizeCard's name, never a bare card read): the
 * code itself, then a code alias ("se" → sme), then a tag's base language
 * ("crk-Cans" → crk). null when no card names it (a private-use code, an
 * unknown one) — the caller then keeps the code and says so.
 *
 * @param {object[]} index  loadLanguageIndex()'s entries
 * @param {string} code
 * @returns {string|null}
 */
export function languageNameFor(index, code) {
  if (!Array.isArray(index) || typeof code !== 'string' || !code.trim()) return null;
  const c = code.trim().replace(/_/g, '-');
  const base = c.split('-')[0];
  const hit = index.find((l) => l?.code === c)
    ?? index.find((l) => Array.isArray(l?.aliases) && l.aliases.includes(c))
    ?? (base !== c ? index.find((l) => l?.code === base) : null);
  const name = typeof hit?.name === 'string' ? hit.name.trim() : '';
  return name && name !== c ? name : null;
}

/** A corpus `language_pair` as the harness reads it: a dict, or "eng-crk" / "eng:crk" / "eng>crk". */
function coercePair(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { source: value.source ?? null, target: value.target ?? null };
  }
  if (typeof value === 'string') {
    const m = /^\s*([A-Za-z]{2,3})\s*[-:>]\s*([A-Za-z]{2,3})\s*$/.exec(value);
    if (m) return { source: m[1].toLowerCase(), target: m[2].toLowerCase() };
  }
  return null;
}

/**
 * What a harness-JSON corpus states about itself in its own envelope — the
 * keys the harness itself reads when it loads the file (corpus_loader:
 * `dataset.license`, `dataset.language_pair` — a dict or a compact string —
 * else a top-level `language_pair` or flat `source_lang` / `target_lang`;
 * `dataset.id`; `dataset.transmission`). Round 10 (researcher): the plan for
 * a contest's released dev file said licence and language "unknown" while
 * the harness run on the same file printed both. Only the envelope's
 * metadata leaves this function — never an entry. null for any other file.
 *
 * @returns {{from: string, license: string|null, doNotTrain: boolean|null, source: string|null,
 *   target: string|null, id: string|null, transmission: string|null}|null}
 */
export function corpusEnvelope(corpusPath, { exists = existsSync, read = readFileSync } = {}) {
  if (!corpusPath || !/\.json$/i.test(corpusPath) || !exists(corpusPath)) return null;
  let raw;
  try { raw = JSON.parse(read(corpusPath, 'utf-8')); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const block = raw.dataset && typeof raw.dataset === 'object' && !Array.isArray(raw.dataset) ? raw.dataset : {};
  const pair = coercePair(block.language_pair) ?? coercePair(raw.language_pair) ?? { source: null, target: null };
  if (!pair.source && typeof raw.source_lang === 'string') pair.source = raw.source_lang;
  if (!pair.target && typeof raw.target_lang === 'string') pair.target = raw.target_lang;
  const code = (v) => (typeof v === 'string' && LANG_CODE_RE.test(v.trim()) ? v.trim() : null);
  const lic = typeof block.license === 'string' ? block.license
    : (block.license && typeof block.license === 'object' && typeof block.license.spdx === 'string' ? block.license.spdx : null);
  const dnt = typeof block.do_not_train === 'boolean' ? block.do_not_train
    : (typeof block.doNotTrain === 'boolean' ? block.doNotTrain : null);
  return {
    from: `the corpus file's own dataset block (${displayPath(corpusPath)})`,
    license: lic && lic.trim() ? lic.trim() : null,
    doNotTrain: dnt,
    source: code(pair.source),
    target: code(pair.target),
    id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : null,
    transmission: typeof block.transmission === 'string' ? block.transmission.trim().toLowerCase() : null,
  };
}

/**
 * The source-language CODE the corpus itself states: the steward sidecar's
 * own pair, else the corpus card it names (`card`, beside the sidecar —
 * what `champollion network register-corpus` writes), as `pair.source` /
 * `language_pair.source`. Metadata only: the corpus is never opened. null
 * when neither says.
 *
 * @returns {{code: string, from: string}|null}
 */
export function stewardSourceCode(steward, { exists = existsSync, read = readFileSync } = {}) {
  const data = steward?.data;
  if (!data || typeof data !== 'object') return null;
  const pick = (doc) => {
    const src = doc?.pair?.source ?? doc?.language_pair?.source ?? doc?.languagePair?.source;
    return typeof src === 'string' && LANG_CODE_RE.test(src.trim()) ? src.trim() : null;
  };
  const own = pick(data);
  if (own) return { code: own, from: `the steward's sidecar (${displayPath(steward.path)})` };
  if (typeof data.card === 'string' && data.card.trim() && !CTRL_RE.test(data.card)) {
    const cardPath = resolve(dirname(steward.path), data.card.trim());
    try {
      if (exists(cardPath)) {
        const code = pick(JSON.parse(read(cardPath, 'utf-8')));
        if (code) return { code, from: `the corpus card the steward's sidecar names (${displayPath(cardPath)})` };
      }
    } catch { /* an unreadable card states nothing */ }
  }
  return null;
}

/**
 * The licence, do_not_train term and target code a file the user holds
 * states about itself: its steward sidecar first, then the corpus card the
 * sidecar names (what `champollion network register-corpus --data` writes:
 * sidecar `license`, card `license.spdx` / `doNotTrain` / `pair.target`).
 * Metadata only — the corpus is never opened. Each value is null when
 * neither says, never guessed.
 *
 * @returns {{license: string|null, licenseFrom: string|null, doNotTrain: boolean|null,
 *   doNotTrainFrom: string|null, targetCode: string|null, targetFrom: string|null}}
 */
export function stewardTerms(steward, { exists = existsSync, read = readFileSync } = {}) {
  const out = { license: null, licenseFrom: null, doNotTrain: null, doNotTrainFrom: null, targetCode: null, targetFrom: null };
  const data = steward?.data;
  if (!data || typeof data !== 'object') return out;
  const docs = [{ doc: data, from: `the steward's sidecar (${displayPath(steward.path)})` }];
  if (typeof data.card === 'string' && data.card.trim() && !CTRL_RE.test(data.card)) {
    const cardPath = resolve(dirname(steward.path), data.card.trim());
    try {
      if (exists(cardPath)) {
        docs.push({ doc: JSON.parse(read(cardPath, 'utf-8')), from: `the corpus card the sidecar names (${displayPath(cardPath)})` });
      }
    } catch { /* an unreadable card states nothing */ }
  }
  for (const { doc, from } of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const lic = typeof doc.license === 'string' ? doc.license
      : (doc.license && typeof doc.license === 'object' && typeof doc.license.spdx === 'string' ? doc.license.spdx : null);
    if (out.license == null && lic && lic.trim()) { out.license = lic.trim(); out.licenseFrom = from; }
    const dnt = typeof doc.doNotTrain === 'boolean' ? doc.doNotTrain
      : (typeof doc.do_not_train === 'boolean' ? doc.do_not_train : null);
    if (out.doNotTrain == null && dnt != null) { out.doNotTrain = dnt; out.doNotTrainFrom = from; }
    const tgt = doc.pair?.target ?? doc.language_pair?.target ?? doc.languagePair?.target;
    if (out.targetCode == null && typeof tgt === 'string' && LANG_CODE_RE.test(tgt.trim())) {
      out.targetCode = tgt.trim(); out.targetFrom = from;
    }
  }
  return out;
}

/** The plan's line for each scoring opt-out the run takes. */
function skipLines({ skipFst, skipEvalStandard }) {
  return [
    ...(skipFst ? ['Scoring:  without FST acceptance (skip_fst → --skip-fst) — the run card marks it not computed'] : []),
    ...(skipEvalStandard ? ['Scoring:  without the eval-standard metrics (skip_eval_standard → --skip-eval-standard) — '
      + 'the run card marks them not computed'] : []),
  ];
}

/** The plan's licence and do_not_train lines for a file the user holds. */
function fileTermsLines(terms) {
  const t = terms || {};
  return [
    t.license
      ? `Licence:  ${t.license} — ${t.licenseFrom}`
      : 'Licence:  unknown — your file states none (no steward sidecar or corpus card with a licence; '
        + '`champollion network register-corpus --data <file>` records one)',
    t.doNotTrain === true
      ? `Training: do_not_train: true — evaluation only: never put this file, or text derived from it, in a training mix (${t.doNotTrainFrom})`
      : t.doNotTrain === false
        ? `Training: do_not_train: false — ${t.doNotTrainFrom} does not forbid training on it; its licence still governs any use`
        : 'Training: do_not_train unknown — your file does not state it; treat it as evaluation-only until the user says otherwise',
    'The run passes --yes: it skips the harness\'s prompts; your file is read in place, nothing is fetched.',
  ];
}

/**
 * A real publish without the user's acknowledgement of what goes public — or
 * when that could not be checked — is refused here, before anything runs.
 * null = go ahead (no publish, or the exact acknowledgement was given).
 */
function publishRefusal(facts, given, context = []) {
  if (!facts) return null;
  if (!facts.ok) {
    return ['REFUSED — publish: true, but what would go public could not be checked, so nothing was run.',
      '', ...context, '', ...facts.lines].join('\n');
  }
  if (given === facts.ack) return null;
  return [...ackLines(facts, { refused: true, given: given ?? null }), '', ...facts.lines, '',
    'Nothing was run or spent. Show the user what goes public; only with their agreement call again with',
    'confirm: true and that publish_ack — or drop publish (results stay local; preview_publish on the finished',
    'run\'s report previews the same facts from the harness itself, read-only; publish_report then publishes).'].join('\n');
}

function fmtCost(item) {
  return item.est_cost_usd == null ? 'unknown (not $0)' : `$${Number(item.est_cost_usd).toFixed(4)}`;
}

/** Why THIS run would send the text off the machine (or cannot prove it won't). */
function localOnlyReason(r) {
  if (r.methodKind === 'engine') {
    if (r.engine?.loopback) {
      return [
        `Method "${r.method}" is an MT engine; its configuration points it at ${r.engine.url} (${r.engine.from}), a loopback address —`,
        'but the harness cannot see inside an engine, so it refuses a local-only corpus unless the USER attests the',
        'transport is fully local. Ask them; only if they confirm the engine runs on this machine, re-run with',
        'attest_local_transport: true (recorded in the RunLog). Never set it on their behalf.',
      ].join('\n');
    }
    return `Method "${r.method}" is an MT engine service: it sends every sentence to `
      + (r.engine ? `${r.engine.url} (${r.engine.from})` : 'its provider\'s cloud API')
      + ' — not this machine. Running it would send the community\'s text off this machine.';
  }
  if (r.methodKind === 'plugin') {
    // A plugin that DECLARES it calls no API (S/O) is still refused here: the
    // declaration prices the run at $0, but where the text goes is a
    // sovereignty question the harness cannot verify (Round 12).
    const declared = r.pluginDeps?.noApi
      ? [`method_dir ${r.methodDir} is a method plugin whose method.json declares dependency class ${r.pluginDeps.dependencyClass}`,
        '(no API call) — a declaration the harness cannot verify: it does not watch a plugin\'s network use. So it']
      : [`method_dir ${r.methodDir} is a method plugin: it makes its own calls, through whatever transport it chose, and the`,
        'harness cannot see them — so it'];
    return [
      ...declared.slice(0, -1),
      `${declared[declared.length - 1]} refuses a local-only corpus unless the USER attests the plugin's transport is`,
      'fully local (e.g. a plugin that loads its model from disk). Ask them; only if they confirm, re-run',
      'with attest_local_transport: true (recorded in the RunLog). Never set it on their behalf.',
    ].join('\n');
  }
  return r.provider === 'local'
    ? `The "local" provider here points at ${r.endpoint ?? '(no endpoint)'}, which is not a loopback address — that would send the text off this machine.`
    : `Provider "${r.provider}" is a remote model API — running it would send the community's text off this machine.`;
}

/** The message a local-only refusal deserves — the steward's rule, verbatim in spirit. */
function localOnlyRefusal(r) {
  return [
    'REFUSED — this corpus is marked LOCAL-ONLY by its data steward.',
    '',
    `Steward mark: ${r.sidecar} → {"transmission": "local-only"}`,
    localOnlyReason(r),
    '',
    'This is the data owner\'s rule, not an error to route around. Do NOT retry with another',
    'remote provider or MT engine. The runs that ARE allowed keep every sentence on this machine:',
    '  • provider: "local" with a loopback endpoint (e.g. Ollama at http://localhost:11434/v1) and model: "<the name it serves>"',
    '  • method: "local-model" with model: a Hugging Face id or local model directory (e.g. an NLLB checkpoint) —',
    '    the harness runs it in this process, so it needs NO attestation',
    '  • method_dir: a method plugin directory whose transport is fully local (it loads its model from disk),',
    '    plus attest_local_transport: true once the USER confirms it (the harness cannot see inside a plugin)',
    'Changing the mark is the steward\'s decision alone.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Background job registry — the fix for the 60s client-timeout trap, made
// durable across server restarts.
// ---------------------------------------------------------------------------
//
// A real benchmark (a non-trivial corpus through a live model) routinely takes
// several minutes. The MCP SDK's *client* request timeout defaults to 60s, so
// a tool that synchronously awaits the subprocess makes a correct run look like
// a failure: the client gives up at 60s even though mt-eval is still going.
//
// Instead, runBenchmark STARTS the subprocess in the background and returns a
// job handle immediately (well under any client timeout). The agent then polls
// get_run_status until the job settles.
//
// Hosts restart MCP servers, so a job must outlive the process that started
// it. JOBS holds the jobs THIS process launched (with their live handle and
// output); every job is also written to the job history on disk (jobs.js),
// and mt-eval runs under a detached supervisor that records how it ended.
// get_run_status answers from JOBS first and from the history otherwise.
const JOBS = new Map();


/**
 * The harness's default output folder, relative to its working directory —
 * where `mt-eval queue` writes each item's report (queue/<NNN>_<item>/).
 * Mirrors DEFAULT_OUTPUT_DIR in arena/mt_eval_harness/queue_runner.py
 * (parity-checked by test/harness-seam.test.js against the real module).
 */
export const HARNESS_DEFAULT_OUTPUT_DIR = 'eval/logs/harness';

/** What the harness's translation cache holds — one wording for the plan and the result. */
const CACHE_WHAT = 'the harness\'s translation cache: the model\'s output for each source sentence, '
  + 'so a re-run of the same setup reuses it for free. It holds copies of the corpus\'s sentences: a marked '
  + 'corpus (local-only, sealed, consent-required) gets its own protected/ namespace and every file there '
  + 'carries the corpus\'s mark in a <file>.champollion.json sidecar; the folder has a .gitignore. Delete '
  + 'the folder to remove the copies.';

/** Elapsed (or total, if finished) seconds for a job, as an integer. */
function jobSeconds(job) {
  const end = job.endedAt ?? Date.now();
  return Math.max(0, Math.round((end - job.startedAt) / 1000));
}


/** Persist a job record; a failure is kept on the job and reported, never swallowed. */
function persistJob(job) {
  try {
    saveJob(job);
    job.persistError = null;
  } catch (err) {
    job.persistError = err.message;
  }
}

/**
 * Launch a benchmark subprocess in the BACKGROUND and register it as a job.
 *
 * Returns the job record immediately — the subprocess is NOT awaited here. The
 * background promise updates the record's status/output when mt-eval settles.
 * A spawn failure (process never started) lands as status 'error'; a non-zero
 * exit lands as 'failed'; success lands as 'completed'. The record is written
 * to the job history at launch, when the pid is known, and when it settles.
 *
 * Item and corpus runs get their own results folder (the harness's
 * --output-dir, inside the job folder), so where the results land is exact and
 * never confused with another run's. Queue runs write where the harness always
 * does — its queue folders under the server's working directory.
 *
 * @param {object}   spec
 * @param {string[]} spec.argv     argv AFTER the `mt-eval` program name
 * @param {'item'|'queue'|'corpus'} spec.mode
 * @param {boolean}  [spec.dryRun]  true = plan-only run, spends nothing
 * @param {string}   spec.label    human description of what's running
 * @param {string}   [spec.estLabel]  estimated-cost label for the start message
 * @param {boolean}  [spec.publish]   will results publish? (true only when asked)
 * @param {object}   [spec.env]       environment (publish target)
 * @param {number}   spec.timeout  subprocess timeout (ms)
 * @param {function} spec.exec     runner (execJob by default; injectable for tests)
 * @returns {object} the job record
 */
function launchJob({ argv, mode, dryRun, label, estLabel, publish, env, timeout, exec, resultsBase }) {
  const id = newJobId();
  const jobDir = jobDirFor(id);
  const cwd = process.cwd();
  const isRun = argv[0] === 'run';
  // A run on a file the user holds writes its results beside that file, in
  // their project — run logs and reports contain the test sentences, and a
  // private set's copies must not end up in the server's own folder under
  // the home directory (Round 4 hospital persona). Other runs keep theirs
  // in the job folder.
  const resultsDir = isRun
    ? (resultsBase ? join(resultsBase, `mcp-${id}`) : join(jobDir, 'results'))
    : (dryRun === true ? null : resolve(cwd, HARNESS_DEFAULT_OUTPUT_DIR, 'queue'));
  const execArgv = isRun ? [...argv, '--output-dir', resultsDir] : argv;
  const job = {
    id,
    mode,
    dryRun: dryRun === true,
    label,
    estLabel: estLabel ?? null,
    publish: publish === true,
    target: publishTarget(env),
    env,
    cmd: 'mt-eval',
    argv: execArgv,
    cwd,
    jobDir,
    resultsDir,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    timedOut: false,
    pid: null,
    timeoutMs: timeout,
    stdout: '',
    stderr: '',
    error: null,
  };
  JOBS.set(id, job);
  persistJob(job);

  // Fire-and-forget. Wrapping the exec call in Promise.resolve().then(...) means
  // even a *synchronous* throw from exec becomes a rejection the .catch handles,
  // so a launch failure can never surface as an unhandled rejection.
  job.promise = Promise.resolve()
    .then(() => exec('mt-eval', execArgv, {
      timeout,
      jobDir,
      cwd,
      onSpawn: ({ pid }) => { job.pid = pid ?? null; persistJob(job); },
    }))
    .then(async ({ code, stdout = '', stderr = '', signal = null, timedOut = false }) => {
      job.exitCode = code;
      job.signal = signal;
      job.timedOut = timedOut === true;
      job.stdout = stdout;
      job.stderr = stderr;
      job.status = code === 0 ? 'completed' : 'failed';
      job.endedAt = Date.now();
      job.pid = null;
      try {
        ensureJobFiles(job, { stdout, stderr, exit: { code, signal, timedOut: job.timedOut, error: null } });
      } catch { /* the in-memory record still answers; persistJob reports a dead disk */ }
      persistJob(job);
      if (code !== 0) {
        // Full unedited output goes to the debug log; get_run_status relays
        // only a path-stripped version. Awaited inside the chain so
        // awaitAllJobs() covers the write.
        await writeDebugLog(
          `job ${job.id} failed (exit ${code}) — argv: mt-eval ${shellJoin(execArgv)}`,
          debugDetail(stdout, stderr),
        );
      }
    })
    .catch(async (err) => {
      job.error = err.message;
      job.status = 'error';
      job.endedAt = Date.now();
      job.pid = null;
      try {
        ensureJobFiles(job, { exit: { code: null, signal: null, timedOut: false, error: err.message } });
      } catch { /* as above */ }
      persistJob(job);
      await writeDebugLog(
        `job ${job.id} could not start — argv: mt-eval ${shellJoin(execArgv)}`,
        String((err && err.stack) || err),
      );
    });

  return job;
}

/** Where a job's record and output live — and whether saving it failed. */
function durabilityLines(job) {
  if (job.persistError) {
    return [`WARNING: the job record could not be saved (${stripAbsolutePaths(job.persistError)}) — `
      + 'if this server restarts, get_run_status will not find this job. Set '
      + 'CHAMPOLLION_MCP_HOME to a writable directory to fix it.'];
  }
  return [`Job record: ${displayPath(jobStorePath())} — get_run_status finds this job even after the server restarts.`];
}

/** Where a job's results land, as one line (null for a dry run). */
function resultsLine(job) {
  if (!job.resultsDir) return null;
  return job.mode === 'queue'
    ? `Results land in: ${displayPath(job.resultsDir)}/ (the harness's queue folders, one per item)`
    : `Results land in: ${displayPath(job.resultsDir)}/ (the harness's run log and *_report.json)`;
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
      ...durabilityLines(job),
      '',
      'The harness loads the full ranked queue before printing its plan, which',
      'can take a few minutes — longer than a default 60-second MCP client',
      'request timeout — so it runs detached from this tool call.',
      '',
      `Next: poll get_run_status with { "job_id": "${job.id}" } every ~15-30s until`,
      'it reports COMPLETED. The plan is in the job output.',
    ].join('\n');
  }
  return [
    'STARTED — the benchmark is now running in the background.',
    '',
    `Job id:  ${job.id}`,
    `Running: ${job.label}`,
    job.estLabel ? `Est. cost: ${job.estLabel}` : '',
    publishSentence(job.publish, job.env, { target: job.target }),
    resultsLine(job) ?? '',
    ...durabilityLines(job),
    '',
    'This call returned immediately and did NOT block. A real benchmark can take',
    'several minutes — longer than a default 60-second MCP client request',
    'timeout — so it runs detached from this tool call.',
    '',
    `Next: poll get_run_status with { "job_id": "${job.id}" } every ~15-30s until`,
    'it reports COMPLETED or FAILED. Each poll returns instantly.'
    + (job.publish ? ' After it completes, call get_results to see the published entry.' : ''),
  ].filter((line) => line !== '').join('\n');
}

/**
 * Recognize the harness's REFUSALS in a failed run's output — the outcomes an
 * agent must relay to the user rather than "fix" by retrying differently.
 *
 * @param {string} text  stdout + stderr of the failed run
 * @returns {{kind: string, headline: string, guidance: string}|null}
 */
export function classifyRefusal(text) {
  const t = String(text || '');
  // The harness's REFUSAL, not its informational header: every run on a
  // restricted corpus prints "Transmission policy: NO-TRAIN corpus (…)" (a
  // local-only one: "… its steward marked it local-only"), so a run stopped
  // by the cost cap was reported as the data owner's rule (Round 11 replay).
  if (/Transmission policy \([^)]*\):[^\n]*\brefused\b|Remote evaluation of this corpus is refused|Transmission policy: this corpus is restricted|Transmission policy refused/i.test(t)) {
    return {
      kind: 'transmission',
      headline: 'REFUSED BY THE DATA\'S TRANSMISSION POLICY — the harness would not send this corpus to that model.',
      guidance: 'This is the data owner\'s / licence\'s rule, not an error to route around. Do NOT '
        + 'retry with another remote provider or MT engine. What is allowed is in the harness message '
        + 'above — usually a model on this machine (provider "local" at a loopback endpoint; method '
        + '"local-model", which the harness runs in this process and needs no attestation; or a '
        + 'method_dir plugin with attest_local_transport: true, ONLY once the user confirms its '
        + 'transport is local), or a no-train channel. Remote evaluation of a '
        + 'consent-required corpus waits for the rights-holder\'s recorded permission.',
    };
  }
  if (/NON-COMMERCIAL/.test(t) && /accept-nc-terms/.test(t)) {
    return {
      kind: 'nc-terms',
      headline: 'NEEDS THE USER\'S NON-COMMERCIAL ACKNOWLEDGMENT — nothing was spent.',
      guidance: 'The corpus is non-commercial / research-only. Ask the user whether they accept '
        + 'using it (and the results) for non-commercial purposes only and not redistributing '
        + 'its content. Only if they agree, re-run with accept_nc_terms: true.',
    };
  }
  if (/Refusing to write to PRODUCTION/i.test(t)) {
    return {
      kind: 'prod-publish',
      headline: 'PUBLISH REFUSED — the harness needs an explicit production opt-in.',
      guidance: 'The run itself is on disk. Publishing it to the live board needs the user\'s consent: '
        + 'preview_publish on its *_report.json shows what goes public (read-only), then publish_report publishes '
        + 'it with --prod, '
        + 'or `mt-eval publish <report> --prod` in a terminal.',
    };
  }
  // Only the harness's refusal: an "EVAL PACK: missing" dry-run line can be a
  // missing FST alone, which never stops a run (harness 2026-10-04+).
  if (/EVAL PACK REQUIRED|requires FST validation/.test(t)) {
    return {
      kind: 'eval-pack',
      headline: 'STOPPED BEFORE TRANSLATING — the language\'s evaluation pack is not installed here; nothing was spent.',
      guidance: 'The harness installs nothing by itself. Ask the user, then run the install command the '
        + 'harness names above (usually `mt-eval setup --lang <code>`, which says what it installs) in a '
        + 'terminal — or re-run with skip_fst: true (no FST acceptance) and/or skip_eval_standard: true '
        + '(no eval-standard metrics) to score without them; the run card marks them not computed.',
    };
  }
  if (/max-cost|exceeds (?:the )?(?:cost )?cap|UNKNOWN estimate/i.test(t)) {
    return {
      kind: 'cost-cap',
      headline: 'STOPPED BY THE COST CAP before translating — nothing was spent.',
      guidance: 'The pre-spend estimate exceeded max_cost, or could not be computed (an unknown '
        + 'estimate is never treated as free). Raise max_cost with the user\'s agreement, or drop it '
        + 'for a local run whose cost is unknown by nature.',
    };
  }
  return null;
}

/**
 * The harness's eval-pack status lines in a job's output — `EVAL PACK: …`
 * (its dry run: missing / ready / none needed) and `EVAL PACK REQUIRED: …`
 * (a run it stopped) — so get_run_status puts them at the top instead of
 * somewhere in a long log.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function evalPackLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = stripAbsolutePaths(line.trim());
    if (/^EVAL PACK\b/.test(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Bring a job from the history up to date from the evidence on disk. Used for
 * jobs this process did not launch — it restarted, or another server process
 * started them. Evidence, strongest first:
 *
 *   exit.json (written by the job's supervisor when the run ended)
 *     → COMPLETED (exit 0) / FAILED / ERROR (never started)
 *   the supervisor is still alive (pid + its command line)  → RUNNING
 *   neither, but an item/corpus run's report is on disk      → COMPLETED,
 *     saying the exit status was not recorded
 *   neither                                                   → INTERRUPTED
 *
 * A settled answer is written back to the history.
 */
function settleFromDisk(rec, { isAlive = isSupervisorAlive } = {}) {
  if (TERMINAL_STATUSES.has(rec.status)) return rec;
  const exit = readExitRecord(rec.jobDir);
  let next;
  if (exit) {
    next = {
      ...rec,
      status: exit.error ? 'error' : (exit.code === 0 ? 'completed' : 'failed'),
      endedAt: exit.endedAt ?? Date.now(),
      exitCode: exit.code ?? null,
      signal: exit.signal ?? null,
      timedOut: exit.timedOut === true,
      error: exit.error ?? null,
      pid: null,
    };
  } else if (isAlive(rec)) {
    return rec;
  } else {
    const lastActivity = ['stdout.log', 'stderr.log']
      .map((f) => { try { return statSync(join(rec.jobDir, f)).mtimeMs; } catch { return 0; } })
      .reduce((a, b) => Math.max(a, b), 0);
    const endedAt = Math.max(lastActivity, rec.startedAt ?? 0) || Date.now();
    const { reports } = findJobResults(rec);
    if (rec.mode !== 'queue' && reports.length > 0) {
      next = {
        ...rec, status: 'completed', endedAt, pid: null,
        note: 'The run ended while no server was watching it, so its exit status was not '
          + 'recorded — but the harness wrote its scored report (below).',
      };
    } else {
      next = {
        ...rec, status: 'interrupted', endedAt, pid: null,
        note: 'Its process is gone and it left no exit record — it was stopped before it '
          + 'finished (a reboot, a kill, or a crash of the run itself).',
      };
    }
  }
  try { saveJob(next); } catch { /* the answer is still true; the next poll re-derives it */ }
  return next;
}

/** "exit 1" / "timed out after 10 min" / "killed by SIGTERM". */
function endingLabel(job) {
  if (job.timedOut) return `timed out after ${Math.round((job.timeoutMs ?? 0) / 60000)} min`;
  if (job.exitCode == null && job.signal) return `killed by ${job.signal}`;
  return `exit ${job.exitCode}`;
}

/** The last few non-empty lines of a running job's output (progress). */
function latestLines(job, n = 5) {
  const text = job.jobDir ? readTail(join(job.jobDir, 'stdout.log'), 8 * 1024) : '';
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  return lines.slice(-n).map((l) => `  ${stripAbsolutePaths(l)}`);
}

/**
 * What the harness wrote for a job: the report path(s) and their headline
 * numbers, read from the results folder — never from memory.
 */
function resultsBlock(job) {
  if (!job.resultsDir || job.dryRun) return { lines: [], report: null };
  const { reports } = findJobResults(job);
  if (reports.length === 0) {
    return { lines: [`Results: no *_report.json in ${displayPath(job.resultsDir)}/.`], report: null };
  }
  if (job.mode === 'queue') {
    return {
      lines: [
        `Results: ${count(reports.length, 'report')} written by this run under ${displayPath(job.resultsDir)}/`,
        ...reports.slice(-5).map((p) => `  ${displayPath(p)}`),
      ],
      report: reports.length === 1 ? reports[0] : null,
    };
  }
  const report = reports[reports.length - 1];
  const head = reportHeadline(report);
  const fileRun = /^mcp-run-/.test(job.resultsDir.split(/[\\/]/).pop() || '');
  const compare = compareCommand(job, { siblings: fileRun ? null : knownJobRecords() });
  const corpus = corpusArgOf(job);
  const cacheDir = cacheDirOf(job);
  return {
    lines: [
      `Results: ${displayPath(job.resultsDir)}/`,
      `  report:  ${displayPath(report)}`,
      ...(head?.sourceLog ? [`  run log: ${displayPath(head.sourceLog)}`] : []),
      ...(head?.line ? [`  overall: ${head.line}`] : []),
      // Each score caveat the report records, beside the numbers it
      // qualifies (score_caveats; Round 12).
      ...(head?.caveats ?? []).map((c) => `  ${c.severity === 'major' ? '⚠ SCORE CAVEAT' : '⚠ score note'} `
        + `(${c.source}, ${c.kind}): ${c.message}`),
      ...(compare && fileRun ? [`  compare: ${compare}`,
        '           (every run_benchmark on files in that folder; add a trained model\'s '
        + '<export dir>/evaluation/runlog_report.json, or a terminal run\'s results/*_report.json)'] : []),
      ...(compare && !fileRun ? [`  compare: ${compare}`,
        `           (every finished run_benchmark on ${corpus}, oldest first — the same corpus, so the `
        + 'comparison is like for like; add a terminal run\'s *_report.json on it the same way)'] : []),
      ...(!compare && !fileRun && corpus ? [`  compare: after another run on ${corpus} (e.g. the other `
        + 'condition), get_run_status prints `mt-eval compare <both reports> --significance` with both paths'] : []),
      ...(cacheDir ? [`  cache:   ${displayPath(cacheDir)}/ — ${CACHE_WHAT}`] : []),
    ],
    report,
  };
}

/**
 * The `mt-eval compare` command for every run_benchmark report beside this
 * job's corpus file — where they actually land (`<corpus dir>/results/
 * mcp-run-<id>/`), not the `results/*_report.json` a terminal `-o results`
 * run writes (Round 10 school persona: the guide's glob matched nothing).
 * null for a job whose results are not beside a corpus file.
 */
export function compareCommand(job, { siblings = null } = {}) {
  const dir = job?.resultsDir;
  if (!dir) return null;
  if (/^mcp-run-/.test(dir.split(/[\\/]/).pop() || '')) {
    const base = dirname(dir);
    return `mt-eval compare ${shellPath(base)}/mcp-run-*/*_report.json --significance`;
  }
  // A REGISTERED corpus id: its reports land in each job's own folder under
  // this server's home, so a glob would mix corpora. The exact reports of
  // every finished run on the same corpus id, oldest first (Round 11
  // researcher: a registry-id run printed no compare command at all).
  const corpus = corpusArgOf(job);
  if (!corpus || job.mode !== 'corpus' || !Array.isArray(siblings)) return null;
  const reports = siblings
    .filter((j) => j && j.mode === 'corpus' && !j.dryRun && corpusArgOf(j) === corpus)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
    .map((j) => findJobResults(j).reports.at(-1))
    .filter(Boolean);
  if (reports.length < 2) return null;
  return `mt-eval compare ${reports.map(shellPath).join(' ')} --significance`;
}

/** A path for a pasteable command: ~-abbreviated, quoted when it needs it. */
function shellPath(p) {
  const shown = displayPath(p);
  return /^[\w@%+=:,./~-]+$/.test(shown) ? shown : `"${p.replace(/(["\\$`])/g, '\\$1')}"`;
}

/** The `--corpus` a job ran (a registry id or a file path), or null. */
function corpusArgOf(job) {
  const argv = Array.isArray(job?.argv) ? job.argv : [];
  const i = argv.indexOf('--corpus');
  return i >= 0 && typeof argv[i + 1] === 'string' ? argv[i + 1] : null;
}

/** The `--cache-dir` a job ran with, or null. */
function cacheDirOf(job) {
  const argv = Array.isArray(job?.argv) ? job.argv : [];
  const i = argv.indexOf('--cache-dir');
  return i >= 0 && typeof argv[i + 1] === 'string' ? argv[i + 1] : null;
}

/** Every job record this server knows (live and on disk), unsettled — for sibling lookups. */
function knownJobRecords() {
  const merged = new Map();
  for (const rec of readJobStore()) merged.set(rec.id, rec);
  for (const [id, job] of JOBS) merged.set(id, job);
  return [...merged.values()];
}

/** The status text for one job (live in this process, or from the history). */
function formatJobStatus(job, { live }) {
  const secs = jobSeconds(job);
  const logs = live ? { stdout: job.stdout, stderr: job.stderr } : readJobLogs(job);
  const pack = evalPackLines(`${logs.stdout}\n${logs.stderr}`);
  const packBlock = pack.length ? ['', ...pack] : [];

  if (job.status === 'running') {
    const where = live
      ? (job.pid ? `, pid ${job.pid}` : '')
      : ` — started by an earlier server process, still running${job.pid ? ` as pid ${job.pid}` : ''}`;
    const latest = latestLines(job);
    return [
      `RUNNING — job ${job.id} (${secs}s elapsed${where})`,
      job.label,
      ...(latest.length ? ['', 'Latest output:', ...latest] : []),
      '',
      'Still working. This is expected for a real run — poll get_run_status '
      + 'again in ~15-30s.',
    ].join('\n');
  }

  if (job.status === 'completed') {
    const results = resultsBlock(job);
    const reportRef = results.report ? displayPath(results.report) : '<report>';
    const closing = job.dryRun
      ? 'Dry-run plan above — no tokens were spent. Run again with confirm: true '
        + 'to execute it.'
      : job.publish
        ? `${publishSentence(true, job.env, { future: false, target: job.target })} Call get_results `
          + '(filtered to this pair/model) to see it.'
        : `${publishSentence(false, job.env, { future: false })} The scored report is on `
          + `disk; if the user wants it on a board, preview_publish { "report": ${JSON.stringify(reportRef)} } `
          + 'shows exactly what would go public (read-only) and the publish_report call that publishes it '
          + '(or `mt-eval publish <report>` in a terminal).';
    return [
      `COMPLETED — job ${job.id} (took ${secs}s)`,
      job.label,
      ...packBlock,
      ...(job.note ? ['', job.note] : []),
      '',
      trimMiddle(logs.stdout) || '(no output captured)',
      ...(results.lines.length ? ['', ...results.lines] : []),
      '',
      closing,
    ].join('\n');
  }

  if (job.status === 'failed') {
    // Keep the output tail for context (a long run's progress lines are
    // useful), but path-stripped — traceback frames must not leak local
    // absolute paths. The unedited output is in the debug log.
    const refusal = classifyRefusal(`${logs.stdout}\n${logs.stderr}`);
    return [
      refusal
        ? `${refusal.headline} (job ${job.id}, ${endingLabel(job)})`
        : `FAILED (${endingLabel(job)}) — job ${job.id} (after ${secs}s)`,
      job.label,
      ...packBlock,
      '',
      stripAbsolutePaths(trimMiddle(logs.stderr || logs.stdout)) || '(no output captured)',
      '',
      ...(refusal ? [refusal.guidance, ''] : []),
      live
        ? `Full unedited output is in the debug log (${DEBUG_LOG_HINT}).`
        : `Full unedited output is in ${displayPath(job.jobDir)}/ (stdout.log, stderr.log).`,
    ].join('\n');
  }

  if (job.status === 'interrupted') {
    const results = resultsBlock(job);
    return [
      `INTERRUPTED — job ${job.id} stopped without finishing (after ~${secs}s)`,
      job.label,
      ...packBlock,
      '',
      job.note || 'Its process is gone and it left no exit record.',
      '',
      'Last output:',
      stripAbsolutePaths(trimMiddle(logs.stderr || logs.stdout)) || '(no output captured)',
      ...(results.lines.length ? ['', ...results.lines] : []),
      '',
      'Nothing more will happen on its own. If the user still wants the result, start it '
      + 'again with run_benchmark (a remote model spends again). Full output: '
      + `${displayPath(job.jobDir)}/ (stdout.log, stderr.log).`,
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

/**
 * Every job this server knows: the ones this process launched (live) and the
 * history on disk (settled from evidence), oldest first.
 */
function allJobs(deps) {
  const merged = new Map();
  for (const rec of readJobStore()) merged.set(rec.id, { job: rec, live: false });
  for (const [id, job] of JOBS) merged.set(id, { job, live: true });
  return [...merged.values()]
    .map(({ job, live }) => ({ job: live ? job : settleFromDisk(job, deps), live }))
    .sort((a, b) => (a.job.startedAt ?? 0) - (b.job.startedAt ?? 0));
}

/**
 * Format a job's current status for the agent. With no id, lists every job in
 * the history — including jobs started before this server process restarted.
 *
 * @param {string} [jobId]
 * @param {object} [deps]  {isAlive(record)} — injectable supervisor probe (tests)
 * @returns {string}
 */
export function getRunStatus(jobId, deps = {}) {
  if (!jobId) {
    const all = allJobs(deps);
    if (all.length === 0) {
      return 'No benchmark jobs have been started yet (the job history is empty). '
        + 'Start one with run_benchmark (confirm: true), then poll its job id here.';
    }
    const lines = all.map(({ job: j }) => `  ${j.id}  [${j.status.toUpperCase()}]  ${j.label}  (${jobSeconds(j)}s)`);
    return [
      `Benchmark jobs (${all.length}) — this server's history, kept across restarts (newest ${JOB_HISTORY_LIMIT}):`,
      '',
      ...lines,
      '',
      'Call get_run_status with a specific job_id for full output.',
    ].join('\n');
  }

  const live = JOBS.get(jobId);
  if (live) return formatJobStatus(live, { live: true });

  const rec = findJobRecord(jobId);
  if (rec) return formatJobStatus(settleFromDisk(rec, deps), { live: false });

  const known = allJobs(deps).map(({ job }) => job.id).slice(-10);
  return `No benchmark job with id "${jobId}" in this server's job history `
    + `(the newest ${JOB_HISTORY_LIMIT} jobs are kept). `
    + (known.length
      ? `Known job ids: ${known.join(', ')}.`
      : 'No jobs have been started yet.');
}

// --- Test/introspection helpers (not part of the agent-facing surface) -------

/** Await every job's background promise to settle. For deterministic tests. */
export async function awaitAllJobs() {
  await Promise.all([...JOBS.values()].map((j) => j.promise).filter(Boolean));
}

/** Snapshot of the jobs THIS process launched (most recent last). For tests/introspection. */
export function listJobs() {
  return [...JOBS.values()];
}

/**
 * Forget the jobs this process launched while keeping the history on disk —
 * exactly what a server restart does. For tests.
 */
export function forgetLiveJobs() {
  JOBS.clear();
}

/**
 * Clear the registry. For test isolation. The on-disk history is wiped only
 * when CHAMPOLLION_MCP_HOME points somewhere explicit (a test's temp dir) —
 * never the user's real ~/.champollion-mcp.
 */
export function resetJobs() {
  JOBS.clear();
  if ((process.env.CHAMPOLLION_MCP_HOME || '').trim()) clearJobStore();
}

const NOT_INSTALLED = [
  'mt-eval is not installed on this machine.',
  '',
  'To install it, run:',
  '  pipx install mt-eval-harness',
  '',
  'Then, for a remote model, set an API key (e.g. export OPENROUTER_API_KEY=sk-or-...);',
  'for a model on this machine, run an OpenAI-compatible server (e.g. Ollama) and use',
  'provider: "local" — no key needed.',
  '',
  'Then try again.',
].join('\n');

/** MT methods a corpus run may name (shared/method-registry.json kinds). */
function mtMethodNames(registry) {
  const entries = registry?.entries ?? {};
  return Object.entries(entries)
    .filter(([, e]) => e && (e.kind === 'mt-api' || e.kind === 'local-model'))
    .map(([k, e]) => e.cli_name || k);
}

/**
 * Run benchmarks. Three modes — exactly one per call:
 *
 *   queue   budget / top   — top-of-queue items (deterministic, --no-spread)
 *   item    item_id        — one queue item
 *   corpus  corpus         — ANY corpus: a registry id, or a file the user
 *                            holds; any model, including one on this machine
 *                            (provider "local", or method "local-model")
 *
 * Reconstructs and executes an mt-eval command WITHOUT a shell. Spending (or
 * running anything) requires `confirm: true` — without it (or with
 * `dry_run`), the tool returns a plan. NOTHING is published unless
 * `publish: true` is passed; when it is, the response names the target.
 *
 * ASYNC EXECUTION: a confirmed run does NOT block this call. The mt-eval
 * subprocess is launched in the BACKGROUND and a job handle is returned
 * immediately; the agent polls get_run_status. A queue-mode dry_run is
 * backgrounded too (the harness loads the full ranked queue first). Item- and
 * corpus-mode dry runs and the confirmation prompts stay synchronous.
 *
 * @param {object} params  see the tool schema in src/index.js
 * @param {object} [deps]  Injected dependencies (for testing)
 * @returns {Promise<string>}
 */
export async function runBenchmark(params, deps = {}) {
  const {
    budget, top, item_id, corpus, dry_run = false, provider, confirm = false,
    publish = false, anonymous = false, skip_fst: skipFst = false, skip_eval_standard: skipEvalStandard = false,
  } = params;
  // The neural metrics a run asks for (Round 13): COMET required, MetricX /
  // FUSE opted in — item and corpus runs only (metrics-plan.js).
  const wantMetrics = {
    comet: params.comet === true, metricx: params.metricx === true, fuse: params.fuse === true,
    metricxModel: typeof params.metricx_model === 'string' ? params.metricx_model.trim() || null : null,
  };
  const {
    isMtEvalInstalled: checkInstalled = isMtEvalInstalled,
    lookupQueueItem = null,
    // The runner: mt-eval under a detached supervisor that writes the job's
    // output and exit record to disk, so the job outlives a server restart
    // (jobs.js). Tests inject a stub with execCapture's contract.
    execCapture: exec = execJob,
    env = process.env,
    corpusFs = {},
    methodRegistry: registry = null,
    // what a publish would expose, asked of the harness (publish-preview.js)
    publishProbe = (input) => probePublishGates(input, { env }),
    // licence / do_not_train / eval-pack facts for a plan, asked of the harness (run-plan.js)
    runPlanProbe = (input) => probeRunPlan(input, { env }),
    // what confirming a local-model run downloads, and where (plan-notes.js)
    localModelWeights = (model) => localModelWeightsLines(model, { env }),
    // whether forge registered the file, from its read log (plan-notes.js)
    forgeOrder = (corpusPath) => forgeOrderLines(corpusPath),
    // which neural metrics the harness here can compute (metrics-plan.js)
    metricsProbe = (input) => probeMetrics(input, { env }),
    // code → the language's name from the card index (index.js passes
    // languageNameFor over the server's index); null = codes stay codes
    languageName = null,
  } = deps;

  // Exactly one mode.
  const modes = [item_id != null && 'item_id', corpus != null && 'corpus',
    (budget != null || top != null) && 'budget/top'].filter(Boolean);
  if (modes.length > 1) {
    return `REFUSED — pass ONE of item_id, corpus, or budget/top (got ${modes.join(' + ')}).`;
  }
  if (provider === 'local' && !corpus) {
    return [
      'REFUSED — provider "local" applies to corpus mode only.',
      '',
      'Queue items name hosted models (e.g. anthropic/claude-haiku-4.5). To evaluate a model',
      'running on this machine, use corpus mode:',
      '  { "corpus": "<registry id or /path/to/test.jsonl>", "provider": "local",',
      '    "model": "llama3.1", "target_language": "<language name>" }',
    ].join('\n');
  }
  if (params.base_url != null && !corpus) return 'REFUSED — base_url applies to corpus mode only.';
  if ((skipFst || skipEvalStandard) && corpus == null && item_id == null) {
    return 'REFUSED — skip_fst / skip_eval_standard apply to item and corpus runs: `mt-eval queue` has no such '
      + 'flags. Run the item (item_id) or the corpus (corpus) with them instead.';
  }
  if ((wantMetrics.comet || wantMetrics.metricx || wantMetrics.fuse || params.metricx_model != null)
      && corpus == null && item_id == null) {
    return 'REFUSED — comet / metricx / metricx_model / fuse apply to item and corpus runs: `mt-eval queue` has no '
      + 'such flags. Run the item (item_id) or the corpus (corpus) with them instead.';
  }

  // Pre-flight check: is mt-eval installed?
  const installed = await checkInstalled();
  if (!installed) return NOT_INSTALLED;

  // ----- Corpus mode -------------------------------------------------------
  if (corpus != null) {
    const reg = registry ?? methodRegistry();
    const localDefault = reg?.entries?.local?.default_base_url ?? null;
    let built;
    try {
      // provider stays undefined when the agent did not pass one: a method
      // run refuses an explicit provider (the harness would ignore it).
      built = buildCorpusArgv({ ...params }, {
        env, mtMethods: reg ? mtMethodNames(reg) : null, methodEntries: methodEntriesByName(reg),
        localDefaultBase: localDefault, languageName, ...corpusFs,
      });
    } catch (err) {
      if (err.transmissionRefusal) return localOnlyRefusal(err.transmissionRefusal);
      return `Cannot run corpus "${corpus}": ${err.message}`;
    }
    const attestNote = built.attested
      ? ' — the USER attested its transport is fully local (--attest-local-transport, recorded in the RunLog)'
      : '';
    let where;
    if (built.methodKind === 'engine') {
      where = built.attested
        ? `through the "${params.method}" MT engine at ${built.engine.url} (this machine)${attestNote}`
        : `through the "${params.method}" MT engine — the corpus text is SENT to its service `
          + `(${built.engine ? `${built.engine.url}, ${built.engine.from}` : 'its provider\'s cloud API'}); `
          + 'the harness checks the corpus licence before sending anything';
    } else if (built.methodKind === 'local-model') {
      where = `ON THIS MACHINE — the harness's local-model adapter runs ${params.model} in this process `
        + '(nothing leaves the machine; no attestation needed)';
    } else if (built.methodKind === 'plugin') {
      // A plugin that declares it calls no API (S/O, no gateway/external-api
      // dependency) is said in those terms — its declaration, not a check
      // the harness makes (Round 12 researcher: an S plugin with
      // dependencies [] was described as making calls the harness cannot see).
      const declared = built.pluginDeps?.noApi
        ? ` — run in this process; its method.json declares dependency class ${built.pluginDeps.dependencyClass} `
          + `(${DEPENDENCY_CLASSES[built.pluginDeps.dependencyClass]?.[0] ?? built.pluginDeps.dependencyClass}`
          + `${built.pluginDeps.dependencyCount === 0 ? ', no dependencies' : ', no gateway or external-api dependency'}), `
          + 'so it calls no API. That is its declaration: the harness does not watch a plugin\'s network use '
          + '(the run records its provider as "method-plugin")'
        : ' — it makes its own calls, through whatever transport it chose; the harness cannot see them '
          + '(the run records its provider as "method-plugin")'
          + (built.pluginDeps?.dependencyClass ? `; its method.json declares dependency class ${built.pluginDeps.dependencyClass}` : '');
      where = built.attested
        ? `through the method plugin ${built.methodDir}${attestNote}`
        : `through the method plugin ${built.methodDir}${declared}`;
    } else {
      where = built.transport === 'local'
        ? 'ON THIS MACHINE — nothing leaves it (a loopback endpoint the harness verifies)'
        : `through ${provider ?? 'openrouter'} — the corpus text is SENT to that model API (the harness refuses if the corpus licence or steward forbids it); spends real API tokens`;
    }
    // ONE cost rule, the harness's (run_card.cost_label): a model that
    // provably runs here — a loopback LLM endpoint, or the in-process
    // local-model adapter — is "$0 API cost (runs on this machine)" in the
    // plan, the start message and the run card alike. The plan used to say
    // "unknown, never $0" and the card then "$0" (Round 6 hospital persona).
    // A method plugin that DECLARES it calls no API (dependency class S/O,
    // no gateway / external-api dependency) is "$0 API cost" too — the
    // harness's rule (run_card.runs_on_this_machine), Round 12.
    const pluginNoApi = built.methodKind === 'plugin' && built.pluginDeps?.noApi === true;
    const noApi = (!built.methodKind && built.transport === 'local') || built.methodKind === 'local-model'
      || pluginNoApi;
    // A plugin's cost in the harness's own words (Est. cost: "unknown —
    // <plugin_cost_basis>"), with what it cannot see: a plugin calling a
    // model server on this machine may cost nothing (Round 13 researcher:
    // "unknown (the plugin prices its own calls)" said no why, and the start
    // message said nothing at all).
    const pluginLabel = built.methodKind === 'plugin'
      ? (pluginNoApi
        ? `$0 API cost (runs on this machine) — ${pluginCostBasis(built.pluginDeps.dependencyClass)}`
        : `unknown — ${pluginCostBasis(built.pluginDeps?.dependencyClass ?? null)}`)
      : null;
    const costLine = pluginLabel
      ? (pluginNoApi ? `${pluginLabel} (as its method.json declares)`
        : `${pluginLabel}. If what it calls runs on this machine it may well cost $0, but the harness cannot see `
          + 'inside the plugin to say so.')
      : noApi ? '$0 API cost (runs on this machine)'
        : built.methodKind === 'engine' ? 'unknown (the engine has no published price; the harness never calls it $0)'
          : 'real API tokens — the harness prints its estimate before translating (max_cost caps it)';
    const sourceLine = built.source.name || built.source.code
      ? [built.source.name ? `${built.source.name} (source_language)` : null,
        built.source.code ? `${built.source.code} — from ${built.source.from}; the harness names the language from its cards` : null]
        .filter(Boolean).join(' · ')
      : null;
    // A plan names what the user accepts (--yes) and whether the language's
    // evaluation pack is here — asked of the harness, never guessed (Round 7).
    const planning = dry_run || confirm !== true;
    // The neural metrics are asked beside the plan probe (their stacks load
    // PyTorch, so they never hold up its answer) — and again at confirm when
    // one was requested, so a requested metric is never silently missing.
    const askMetrics = planning || wantMetrics.comet || wantMetrics.metricx || wantMetrics.fuse;
    const metricsAsked = askMetrics ? metricsProbe({
      metricx: wantMetrics.metricx, fuse: wantMetrics.fuse,
      datasetId: built.corpusKind === 'registry' ? corpus.trim() : null,
      targetCode: built.target?.code ?? null, targetName: built.target?.name ?? params.target_language ?? null,
    }).catch((err) => ({ status: 'error', error: err.message })) : null;
    const planProbe = planning ? await runPlanProbe({
      datasetId: built.corpusKind === 'registry' ? corpus.trim() : null,
      targetName: built.target?.name ?? params.target_language ?? null,
      targetCode: built.target?.code ?? null, targetCodeFrom: built.target?.from ?? null,
      localOnly: Boolean(built.localOnly), skipFst, skipEvalStandard,
      // What the model will be told — asked of the harness's own prompt
      // builder (prompt_plan.plan_for), never re-written here. A method gets
      // no harness prompt. A FILE's references are read for their script
      // share only (an aggregate; no sentence comes back).
      prompt: built.methodKind ? null : {
        targetLang: built.target?.name ?? '', targetCode: built.target?.code ?? '',
        sourceLang: built.source.name ?? '', sourceCode: built.source.code ?? '',
        coachingFile: built.coachingPath ?? '', targetScript: built.script?.code ?? '',
        corpusPath: built.corpusKind === 'file' ? built.corpusPath : '',
        sourceField: params.source_field ?? '', targetField: params.target_field ?? '',
      },
    }) : null;
    const metricsAnswer = metricsAsked ? await metricsAsked : null;
    const metricLines = planning
      ? metricsPlanLines(metricsAnswer, { ...wantMetrics, metricxModel: built.metricxModel }) : [];
    const packLines = planning
      ? evalPackPlanLines(planProbe, { skipFst, skipEvalStandard, targetName: params.target_language ?? null }).lines
      : [];
    const termsLines = planning
      ? (built.corpusKind === 'registry' ? registryTermsLines(planProbe, corpus.trim()) : fileTermsLines(built.terms))
      : [];
    // The script: given (or stated by the corpus's code), or — when the
    // target's card lists more than one — the question the user must answer
    // (Round 9: Plains Cree, Cans syllabics / Latn SRO).
    const scriptLines = planning
      ? scriptPlanLines(planProbe, { script: built.script, methodRun: Boolean(built.methodKind) })
      : [];
    const promptLines = planning && !built.methodKind
      ? promptPlanLines(planProbe, { localOnly: Boolean(built.localOnly) })
      : [];
    const named = built.target?.named;
    const targetNameLines = named
      ? (named.name
        ? [`Target:   ${named.name} (${named.code}) — target_language "${named.code}" is a code: the prompt names `
          + `the language by its card name (passed as --target-lang "${named.name}" --target-lang-code ${named.code})`]
        : [`⚠ Target: "${named.code}" is a code and no language card names it — the prompt will say "to `
          + `${named.code}", not a language name. Pass target_language as the language's name (the code still goes `
          + 'as --target-lang-code).'])
      : [];
    const cacheWhere = built.cache.from === 'existing'
      ? 'an existing cache in this folder from earlier runs, kept so their outputs are reused for free'
        + (built.corpusKind === 'file'
          ? `; to keep these copies with this corpus's results, move it to ${displayPath(join(built.resultsBase, 'cache'))}`
            + ' — its entries do not depend on where it is'
          : '')
      : built.cache.from === 'corpus' ? 'beside the run\'s results'
        : built.cache.from === 'releasable' ? 'beside the run\'s results, outside the releasable folder — see Results'
          : 'in this server\'s folder';
    const cacheLine = `Cache:    ${displayPath(built.cache.dir)}/ (${cacheWhere}) — ${CACHE_WHAT}`
      + (built.localOnly ? ' This corpus is marked local-only, so its entries go in that protected namespace.' : '')
      + (built.skippedCache ? ` (An existing cache at ${displayPath(built.skippedCache.dir)}/ is not used: `
        + `${releasableReason(built.skippedCache.rel, displayPath)}.)` : '');
    // Where the run log and *_report.json land (they hold the test sentences
    // too) — and why, when the corpus sits in a folder contest prepare releases.
    const resultsLine = built.corpusKind === 'file'
      ? (built.releasable
        ? `Results:  ${displayPath(built.resultsBase)}/mcp-<job id>/ — ${releasableReason(built.releasable, displayPath)}, `
          + `so run logs and the cache go to ${displayPath(built.resultsBase)}/ instead: nothing this run writes lands in a `
          + 'folder that is released (the harness refuses an output folder inside one).'
        : `Results:  ${displayPath(built.resultsBase)}/mcp-<job id>/ — beside the corpus, in the user's project (the run `
          + 'log and report hold the test sentences).')
      : `Results:  ${displayPath(join(mcpStateDir(env), 'jobs'))}/<job id>/results/ — this server's job folder.`;
    // Round 10: a local-model run downloads its weights on confirm — say how
    // much and where before anyone confirms; and a benchmark of the user's own
    // file is a scoring read — say that forge's predictions come first.
    const weightsLines = planning && built.methodKind === 'local-model'
      ? await localModelWeights(params.model) : [];
    const forgeLines = planning && built.corpusKind === 'file' ? forgeOrder(built.corpusPath) : [];
    let facts = null;
    if (publish === true) {
      const coached = Boolean(params.coaching_file);
      const probe = await publishProbe({
        datasetId: built.datasetId, localOnly: Boolean(built.localOnly),
        prompt: !built.methodKind, coached,
      });
      facts = publishFacts({ kind: 'run', probe, target: publishTarget(env),
        methodRun: Boolean(built.methodKind), coached });
    }
    const modelLine = built.methodDir
      ? `method plugin ${built.methodDir}`
      : params.method ? `${params.method}${params.model ? ` (${params.model})` : ''}` : (params.model ?? '(harness default)');
    const describe = [
      `Corpus:   ${built.corpusKind === 'file' ? `your file ${built.corpusPath}` : `registry id ${corpus}`}`,
      `Model:    ${modelLine}`,
      `Runs:     ${where}`,
      `Cost:     ${costLine}`,
      ...(sourceLine ? [`Source:   ${sourceLine}`] : []),
      // Name the endpoint that will actually answer — an agent that deployed
      // its own model must be able to see the run is pointed at it.
      ...((built.endpoint || params.base_url) ? [`Endpoint: ${built.endpoint || params.base_url}`] : []),
      ...skipLines({ skipFst, skipEvalStandard }),
      ...targetNameLines,
      ...(built.target.code && built.corpusKind === 'file' && !named
        ? [`Target:   ${built.target.code} — from ${built.target.from}; passed as --target-lang-code`] : []),
      ...promptLines,
      ...scriptLines,
      ...metricLines,
      resultsLine,
      cacheLine,
      ...weightsLines,
      ...(built.methodKind === 'local-model' && params.allow_model_pair_mismatch === true
        ? ['Pair:     allow_model_pair_mismatch — an OPUS-MT pair model naming another language pair runs anyway '
          + '(it writes ITS target language: a related-language baseline, not a model of this pair); the run card '
          + 'records the mismatch.'] : []),
      ...termsLines,
      ...forgeLines,
      ...(built.localOnly ? [`Steward:  marked local-only (${built.localOnly.sidecar}) — `
        + (built.localOnly.attested
          ? 'allowed on the user\'s attestation that the method\'s transport is fully local (recorded in the RunLog).'
          : 'this run stays local, as required.')] : []),
      ...(params.max_cost != null ? [`Cost cap: $${Number(params.max_cost).toFixed(2)} — aborts before translating if the estimate is higher or unknown.`] : []),
      ...(built.corpusKind === 'file' && !params.method && !params.target_language && !built.envelope?.target
        ? ['Note:     no target_language given — the prompt may not name the language; pass target_language (e.g. "Plains Cree").']
        : []),
      ...(built.corpusKind === 'file' && !sourceLine
        ? ['Note:     no source_language given and the file does not state its source language (no steward sidecar or corpus '
          + 'card pair) — the run card\'s source language will be blank; pass source_language (e.g. "English").']
        : []),
      publishSentence(publish, env),
      ...(facts ? ['', ...facts.lines] : []),
    ];
    if (dry_run) {
      return ['DRY RUN — would execute (no shell; quoted here to paste into a terminal):', '', `  mt-eval ${shellJoin(built.argv)}`, '',
        ...packLines, '',
        ...describe, ...(facts ? ['', ...ackLines(facts)] : []), '', 'Nothing was run or spent.'].join('\n');
    }
    if (confirm !== true) {
      return ['CONFIRMATION REQUIRED — this will run a benchmark.', '', ...packLines, '', ...describe,
        ...(facts ? ['', ...ackLines(facts)] : []), '',
        'Confirm with the user first (and get their explicit consent before any publish: true),',
        'then call run_benchmark again with confirm: true. Or pass dry_run: true to preview.'].join('\n');
    }
    const refusedMetrics = metricsRefusal(metricsAnswer, { ...wantMetrics, metricxModel: built.metricxModel });
    if (refusedMetrics) return refusedMetrics;
    const refusedPublish = publishRefusal(facts, params.publish_ack, describe);
    if (refusedPublish) return refusedPublish;
    const channel = built.methodKind
      ? (built.methodKind === 'plugin' ? 'method plugin' : built.methodKind === 'engine' ? 'MT engine' : 'local')
        + (built.attested ? ', attested local' : '')
      : (built.transport === 'local' ? 'local' : (provider ?? 'openrouter'));
    const label = `${built.corpusKind === 'file' ? 'your corpus file' : corpus}  `
      + `${built.methodDir ?? params.method ?? params.model ?? 'harness default model'}  [${channel}]`
      + `${(built.endpoint || params.base_url) ? ` @ ${built.endpoint || params.base_url}` : ''}`;
    const job = launchJob({
      argv: built.argv, mode: 'corpus', label,
      estLabel: pluginLabel ?? (noApi ? '$0 API cost (runs on this machine)' : null),
      publish, env, timeout: 3_600_000, exec,
      resultsBase: built.resultsBase,
    });
    return formatJobStarted(job);
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
    let metricxModel;
    try {
      metricxModel = checkMetricxModel(params);
      argv = buildRunArgv(item, {
        provider, publish, anonymous, skipFst, skipEvalStandard, env,
        metricx: wantMetrics.metricx, metricxModel, fuse: wantMetrics.fuse,
      });
    } catch (err) {
      return `Cannot run "${item_id}": ${err.message}`;
    }
    const itemPlanning = dry_run || confirm !== true;
    const itemMetricsAsked = itemPlanning || wantMetrics.comet || wantMetrics.metricx || wantMetrics.fuse
      ? metricsProbe({
        metricx: wantMetrics.metricx, fuse: wantMetrics.fuse, datasetId: item.corpus_id, targetName: item.target_language,
      }).catch((err) => ({ status: 'error', error: err.message }))
      : null;
    const itemProbe = itemPlanning ? await runPlanProbe({
      datasetId: item.corpus_id, targetName: item.target_language, skipFst, skipEvalStandard,
    }) : null;
    const itemMetrics = itemMetricsAsked ? await itemMetricsAsked : null;
    const itemWant = { ...wantMetrics, metricxModel };
    const itemMetricLines = itemPlanning ? metricsPlanLines(itemMetrics, itemWant) : [];
    const itemPack = itemPlanning
      ? evalPackPlanLines(itemProbe, { skipFst, skipEvalStandard, targetName: item.target_language ?? null }).lines
      : [];
    const itemTerms = itemPlanning
      ? [...skipLines({ skipFst, skipEvalStandard }),
        ...registryTermsLines(itemProbe, item.corpus_id, { fallbackLicense: item.corpus_license ?? null })]
      : [];

    let facts = null;
    if (publish === true) {
      // a queue item: a registered corpus, the harness's own (naive) prompt
      const probe = await publishProbe({ datasetId: item.corpus_id, localOnly: false, prompt: true, coached: false });
      facts = publishFacts({ kind: 'run', probe, target: publishTarget(env) });
    }
    const factLines = facts ? ['', ...facts.lines] : [];
    if (dry_run) {
      return [
        'DRY RUN — would execute (no shell; quoted here to paste into a terminal):',
        '',
        `  mt-eval ${shellJoin(argv)}`,
        '',
        ...itemPack,
        '',
        `Language pair: ${item.language_pair.replace('>', ' → ')}`,
        `Target: ${item.target_language}`,
        `Model: ${item.model}`,
        `Condition: ${item.condition}`,
        `Estimated cost: ${fmtCost(item)}`,
        ...itemTerms,
        ...itemMetricLines,
        publishSentence(publish, env),
        ...factLines,
        ...(facts ? ['', ...ackLines(facts)] : []),
        '',
        'No tokens were spent.',
      ].join('\n');
    }

    // ENFORCED confirmation gate — spending requires confirm: true.
    if (confirm !== true) {
      return [
        'CONFIRMATION REQUIRED — this will spend real tokens.',
        '',
        ...itemPack,
        '',
        `Item:    ${item_id}`,
        `Pair:    ${item.language_pair.replace('>', ' → ')}`,
        `Model:   ${item.model}`,
        `Est. cost: ${fmtCost(item)} (actual depends on provider pricing)`,
        ...itemTerms,
        ...itemMetricLines,
        publishSentence(publish, env),
        ...factLines,
        ...(facts ? ['', ...ackLines(facts)] : []),
        '',
        'Confirm with the user first, then call run_benchmark again with '
        + 'confirm: true to proceed. Or pass dry_run: true to preview without '
        + 'spending.',
      ].join('\n');
    }
    const refusedItemMetrics = metricsRefusal(itemMetrics, itemWant);
    if (refusedItemMetrics) return refusedItemMetrics;
    const refusedPublish = publishRefusal(facts, params.publish_ack, [`Item: ${item_id}`]);
    if (refusedPublish) return refusedPublish;

    // Launch in the BACKGROUND and return a job handle immediately. A real run
    // would otherwise blow past the client's 60s request timeout. The agent
    // polls get_run_status with the returned job id.
    const job = launchJob({
      argv,
      mode: 'item',
      label: `${item.language_pair.replace('>', ' → ')}  ${item.model}  [${item.condition}]`,
      estLabel: fmtCost(item),
      publish,
      env,
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

  // Publishing is OFF unless asked: --no-publish by default (the harness then
  // skips OAuth entirely); publish:true lets the queue runner publish.
  args.push(...queuePublishFlags({ publish, anonymous }));
  const queueFacts = publish === true ? publishFacts({ kind: 'queue', target: publishTarget(env) }) : null;
  const queueFactLines = queueFacts ? ['', ...queueFacts.lines, '', ...ackLines(queueFacts)] : [];
  // A queue run spans many corpora and languages: the harness checks each
  // item's terms and evaluation pack as it reaches it (Round 7).
  const queueTermsLines = [
    'Each item\'s corpus licence and do_not_train terms are its own (get_queue_item shows corpus_license); the run',
    'passes --yes, which accepts each licence when the harness fetches that corpus from its upstream. A language',
    'whose evaluation pack is not installed stops that item before translating (get_run_status shows its',
    'EVAL PACK lines); run it alone with item_id and skip_fst / skip_eval_standard to score without the pack.',
  ];

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
        ? `dry-run plan for the top ${count(top, 'item')}`
        : 'dry-run plan for the full queue';
    const job = launchJob({
      argv: args,
      mode: 'queue',
      dryRun: true,
      label: scope,
      publish,
      env,
      timeout: 1800_000,
      exec,
    });
    return [formatJobStarted(job), '', ...queueTermsLines, ...queueFactLines].join('\n');
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
      'Calling run_benchmark with no budget, no top, no item_id and no corpus would run '
      + 'the ENTIRE queue (thousands of paid model calls).',
      '',
      'Pass exactly one bound:',
      '  • budget: 5          — spend at most $5.00, harness picks the items',
      '  • top: 10            — run the top 10 queue items',
      '  • item_id: "<id>"    — run one specific item',
      '  • corpus: "<id|path>" — run one corpus (yours or a registered one) on any model',
      '',
      'Use estimate_cost first to see what a given bound would cost, or '
      + 'dry_run: true to preview the full queue plan without spending.',
    ].join('\n');
  }

  // ENFORCED confirmation gate for spend.
  if (confirm !== true) {
    const scope = budget != null
      ? `up to $${Number(budget).toFixed(2)} of estimated spend`
      : `the top ${count(top, 'item')}`;
    return [
      'CONFIRMATION REQUIRED — this will spend real tokens.',
      '',
      `This would run ${scope} from the top of the queue.`,
      ...queueTermsLines,
      publishSentence(publish, env),
      ...queueFactLines,
      '',
      'Confirm with the user first, then call run_benchmark again with '
      + 'confirm: true to proceed. Or pass dry_run: true to preview the plan '
      + 'without spending.',
    ].join('\n');
  }
  const refusedQueuePublish = publishRefusal(queueFacts, params.publish_ack);
  if (refusedQueuePublish) return refusedQueuePublish;

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
    : `the top ${count(top, 'item')} from the queue`;
  const job = launchJob({
    argv: args,
    mode: 'queue',
    label: scope,
    publish,
    env,
    timeout: 1800_000, // 30 minute subprocess timeout for queue runs
    exec,
  });
  return formatJobStarted(job);
}
