/**
 * Translate tool — Champollion as the diligent agent's translation engine.
 *
 * Rather than improvising a translation prompt, an agent calls this tool and
 * gets the champollion CLI's full tested pipeline: engine dispatch (LLM via
 * OpenRouter, direct OpenAI/Anthropic/Gemini, DeepL, Google Translate,
 * Microsoft Translator, LibreTranslate), language-card register/formality
 * conditioning, the persistent Translation Memory (identical re-requests are
 * free), and the deterministic five-check quality gate (empty / source-echo /
 * hallucination-loop / length-inflation / script-compliance). Every response
 * says which texts came from cache, which were validated, and what the API
 * call was estimated to cost.
 *
 * Honesty + economy contract:
 *   - TM is ON by default: repeated texts cost zero tokens, and the response
 *     reports the savings so agents learn to rely on it.
 *   - The quality gate is ON by default: a failed check returns the failure
 *     reason for that text, never a silently bad translation.
 *   - Missing API key / missing champollion install degrade to explicit
 *     actionable errors (which env var to set, what to install).
 *   - This is production translation, NOT benchmark evidence: nothing here
 *     writes to any leaderboard, and translation quality claims still belong
 *     to the eval harness.
 *
 * The champollion package is resolved from the monorepo checkout first, then
 * as an installed dependency — same candidate-path pattern as languages.js.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { format } from 'node:util';

import { displayPath, mcpStateDir } from './state.js';
import { count } from './plural.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

/** Candidate paths to the champollion package entry; first hit wins. */
const CHAMPOLLION_CANDIDATES = [
  resolve(__dirname, '../../../cli/index.js'),
  resolve(__dirname, '../../cli/index.js'),
];

/** Where the MCP server keeps its own persistent Translation Memory when no
 *  project_dir is given: champollion writes <root>/.champollion/tm.json, so
 *  the file is ~/.champollion-mcp/.champollion/tm.json — separate from every
 *  project's .champollion/tm.json (CHAMPOLLION_MCP_HOME relocates it; see
 *  state.js). Resolved per call; this constant is the default at load. */
export const MCP_TM_ROOT = mcpStateDir();

/** The champollion API-contract transport (cli/lib/methods/api.js): it POSTs
 *  {source_locale, target_locale, method, keys} to an endpoint and reads
 *  {translations} back — what `nmt-forge serve` exposes at /translate. It is a
 *  CLI method with no provider of its own, so the shared method registry (an
 *  index of engines) does not list it; it is named here, once. */
export const API_METHOD = 'api';

/** Methods whose OpenAI-compatible endpoint `base_url` may set — the CLI's
 *  OpenAI-format lanes (LocalMethod, OpenAIMethod), which honour a base URL. */
export const BASE_URL_METHODS = ['local', 'openai'];

/** Env var the CLI's api method reads its bearer key from. */
const API_KEY_ENV = 'CHAMPOLLION_API_KEY';

/** Candidate paths to the shared method-registry SSOT — monorepo root first,
 *  then the copy bundled inside the champollion npm package (kept in sync by
 *  `npm run sync:shared`). The package copy is resolved through Node's own
 *  resolver, NOT a guessed node_modules path: the old
 *  `../../node_modules/champollion/…` guess missed both npm's hoisting and
 *  the @champollion scope directory, so a real installed server crashed at
 *  startup — caught by the publish dress rehearsal, not by any in-repo test,
 *  because every in-repo path hits the monorepo candidates first. */
function methodRegistryCandidates() {
  const candidates = [
    resolve(__dirname, '../../../shared/method-registry.json'),
    resolve(__dirname, '../../../cli/shared/method-registry.json'),
    resolve(__dirname, '../../shared/method-registry.json'),
  ];
  try {
    const pkgRoot = dirname(require.resolve('champollion'));
    candidates.push(resolve(pkgRoot, 'shared', 'method-registry.json'));
  } catch { /* no installed champollion package — monorepo candidates only */ }
  return candidates;
}
const METHOD_REGISTRY_CANDIDATES = methodRegistryCandidates();

/** Load the SSOT and derive the MCP method surface from it. Fail-loud: a
 *  server that cannot find the registry must not start with a silently empty
 *  (or stale hand-copied) method list — that is exactly the drift this
 *  replaces. The previous hand-written mirror had already drifted: it missed
 *  6 of 14 entries and claimed GOOGLE_API_KEY unlocks gemini (the CLI only
 *  reads GEMINI_API_KEY). */
function deriveMethodEnv() {
  let registry = null;
  let from = null;
  for (const p of METHOD_REGISTRY_CANDIDATES) {
    if (!existsSync(p)) continue;
    registry = JSON.parse(readFileSync(p, 'utf-8'));
    from = p;
    break;
  }
  if (!registry || !registry.entries) {
    throw new Error(
      'mcp-server: shared/method-registry.json not found (looked in: '
      + METHOD_REGISTRY_CANDIDATES.join(', ')
      + '). The method list is derived from that SSOT — refusing to start '
      + 'with an empty or hand-guessed method surface.',
    );
  }
  _registry = registry;
  const env = {};
  const requireAll = {};
  const keyless = {};
  const kind = {};
  const defaultBase = {};
  for (const [key, entry] of Object.entries(registry.entries)) {
    const runtimes = entry.runtimes; // absent = every runtime
    if (Array.isArray(runtimes) && !runtimes.includes('cli')) continue;
    const name = entry.cli_name || key;
    kind[name] = entry.kind || null;
    defaultBase[name] = entry.default_base_url || null;
    // credential_env is the unlocking subset; plain env is credentials for
    // simple entries (extra config vars like *_REGION appear only in env).
    env[name] = entry.credential_env || entry.env || [];
    requireAll[name] = entry.credential_env_all === true;
    // A method whose DEFAULT endpoint is this machine (Ollama for `local`)
    // needs no key: its env vars are endpoint overrides plus an optional
    // gateway key. Derived from the registry's default_base_url — data, not
    // a name list.
    keyless[name] = isLoopbackUrl(entry.default_base_url);
  }
  return { env, requireAll, keyless, kind, defaultBase, from };
}

/** Is a URL on this machine (loopback)? */
function isLoopbackUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host.endsWith('.localhost')
      || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

let _registry = null;
const _derived = deriveMethodEnv();

/** The parsed shared/method-registry.json (SSOT) this server loaded. */
export function methodRegistry() {
  return _registry;
}

/** method name -> env var(s) that unlock it. DERIVED from
 *  shared/method-registry.json at load — never hand-edit a copy here. */
export const METHOD_ENV = _derived.env;

/** method name -> true when ALL of its METHOD_ENV vars are required
 *  (credential_env_all in the SSOT, e.g. translated/Lara's key id+secret). */
export const METHOD_ENV_ALL = _derived.requireAll;

/** method name -> true when it runs against a local endpoint by default and
 *  therefore needs no API key (DERIVED from default_base_url). */
export const METHOD_KEYLESS = _derived.keyless;

/** method name -> registry `kind` (llm-provider | mt-api | …). An mt-api
 *  engine has no model to choose, so a `model` sent to one is refused rather
 *  than silently dropped. DERIVED from the registry. */
export const METHOD_KIND = _derived.kind;

/** Every method the translate tool accepts: the registry's CLI engines plus
 *  the api transport. */
export const TRANSLATE_METHODS = [...new Set([...Object.keys(METHOD_ENV), API_METHOD])];

let _champollion;
/** The entry file the loaded champollion package came from (its index.js). */
let _champollionEntry = null;

/** Load (and cache) the champollion package; null when not resolvable. */
export async function loadChampollion() {
  if (_champollion !== undefined) return _champollion;
  for (const p of CHAMPOLLION_CANDIDATES) {
    if (!existsSync(p)) continue;
    try {
      _champollion = await import(pathToFileURL(p).href);
      _champollionEntry = p;
      return _champollion;
    } catch {
      // try the next candidate
    }
  }
  try {
    _champollion = await import('champollion');
    try { _champollionEntry = require.resolve('champollion'); } catch { _champollionEntry = null; }
    return _champollion;
  } catch {
    _champollion = null;
    return _champollion;
  }
}

/** Test hook. */
export function _setChampollionForTests(value) {
  _champollion = value;
  _champollionEntry = null;
}

/**
 * The CLI's own fallback pipeline — translateWithFallback (cli/lib/
 * translate-pair.js), the function `champollion sync` and `champollion serve`
 * run for a pair with a "fallback". Taken from the package's exports when it
 * exports it; otherwise from the module of the package this server loaded
 * (it ships in the package's lib/). Null when neither is reachable — an
 * injected stand-in package that does not provide it, or a champollion too
 * old to have one; the caller then says the fallback was not applied.
 */
async function cliFallbackPipeline(champollion) {
  if (typeof champollion.translateWithFallback === 'function') return champollion.translateWithFallback;
  if (champollion !== _champollion || !_champollionEntry) return null;
  try {
    const mod = await import(pathToFileURL(join(dirname(_champollionEntry), 'lib', 'translate-pair.js')).href);
    return typeof mod.translateWithFallback === 'function' ? mod.translateWithFallback : null;
  } catch {
    return null;
  }
}

/** Resolve the API key for a method from the environment (env only —
 *  the MCP server has no project .env to read). Any-of by default; methods
 *  flagged credential_env_all in the SSOT (e.g. translated) need EVERY var. */
export function resolveMethodKey(method, env = process.env) {
  const names = METHOD_ENV[method] || [];
  if (METHOD_ENV_ALL[method]) {
    const missing = names.filter((name) => !(env[name] || '').trim());
    if (names.length > 0 && missing.length === 0) {
      return { key: (env[names[0]] || '').trim(), envVar: names[0] };
    }
    return { key: null, envVar: missing[0] || names[0] || null };
  }
  for (const name of names) {
    const v = (env[name] || '').trim();
    if (v) return { key: v, envVar: name };
  }
  return { key: null, envVar: names[0] || null };
}

// ---------------------------------------------------------------------------
// Engine output: captured for the answer, and kept OFF stdout.
// ---------------------------------------------------------------------------
//
// The champollion engines report through the CLI's console output: failures
// as `[ERR] …` on stderr (and then return nothing), progress as `[INFO] …` /
// `✓ batch …` on STDOUT. Under MCP stdio, stdout IS the JSON-RPC channel — a
// stray progress line corrupts the next message — and a failure printed to
// stderr never reached the agent, which saw only "translation failed".
//
// So while an engine runs, everything it prints is captured for the result
// and echoed to stderr (the diagnostics channel), never stdout. The capture is
// scoped with AsyncLocalStorage to the engine call that produced it — writes
// outside an engine call (the SDK's own JSON-RPC frames included) pass through
// untouched — so concurrent calls never mix their logs.

const engineOutput = new AsyncLocalStorage();
let streamsGuarded = false;

function guardStdStreams() {
  if (streamsGuarded) return;
  streamsGuarded = true;
  for (const level of ['log', 'info', 'debug', 'warn', 'error']) {
    const original = console[level];
    console[level] = function capturedConsole(...args) {
      const sink = engineOutput.getStore();
      if (!sink) return original.apply(this, args);
      const line = format(...args);
      sink.push(line);
      process.stderr.write(`${line}\n`);
      return undefined;
    };
  }
  const originalWrite = process.stdout.write;
  process.stdout.write = function capturedStdout(chunk, ...rest) {
    const sink = engineOutput.getStore();
    if (!sink) return originalWrite.call(this, chunk, ...rest);
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    if (text.trim()) sink.push(text.replace(/\s+$/, ''));
    return process.stderr.write(chunk, ...rest);
  };
}

/** Run `fn` with its console/stdout output captured into `sink`. */
function withEngineOutput(sink, fn) {
  guardStdStreams();
  return engineOutput.run(sink, fn);
}

/** The engine's own explanation of a failure: its last error line, else its last warning. */
function engineReason(lines) {
  const strip = (l) => l.replace(/^\s*\[(ERR|WARN)\]\s*/, '').trim();
  const err = lines.filter((l) => /^\s*\[ERR\]/.test(l) || /"level":"error"/.test(l));
  if (err.length) return strip(err[err.length - 1]);
  const warn = lines.filter((l) => /^\s*\[WARN\]/.test(l) || /"level":"warn"/.test(l));
  if (warn.length) return strip(warn[warn.length - 1]);
  return null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** Why `value` is not an acceptable endpoint URL, or null when it is. */
function urlProblem(value, name, keyHint) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return `${name} is not a URL: ${value}`;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return `${name} must be an http(s) URL (got ${u.protocol}).`;
  if (u.username || u.password) {
    return `${name} must not carry credentials — put the key in ${keyHint} in the server environment instead.`;
  }
  return null;
}

/** origin + path of an endpoint (no query, no credentials) — for display and cache keys. */
function endpointIdentity(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

/** An OpenAI-compatible base as the CLI normalizes it (no trailing slash or /chat/completions). */
function normalizeBase(url) {
  let b = String(url || '').replace(/\/+$/, '');
  if (b.endsWith('/chat/completions')) b = b.slice(0, -'/chat/completions'.length);
  return b;
}

/**
 * The OpenAI-compatible base an engine will call. Asked of the engine itself
 * when it can say (the champollion method's own resolver — the request goes
 * exactly there); otherwise the same precedence from the environment.
 */
function effectiveBase(engine, method, env, cwd) {
  if (engine && typeof engine._resolveApiBase === 'function') {
    try {
      const b = engine._resolveApiBase(cwd ? { cwd } : {});
      if (b) return b;
    } catch { /* fall through to the environment */ }
  }
  const fromEnv = method === 'local'
    ? (env.LOCAL_API_BASE || env.OPENAI_API_BASE || env.OPENAI_BASE_URL)
    : (env.OPENAI_API_BASE || env.OPENAI_BASE_URL);
  return normalizeBase(fromEnv || _derived.defaultBase[method] || '') || null;
}

/** Fill unset key vars from a project's .env/.env.local, as the CLI does in that project. */
function envWithProjectFiles(env, names, projectRoot, champollion) {
  if (!projectRoot || typeof champollion.getEnvOrFileVar !== 'function') return env;
  const view = { ...env };
  for (const n of names) {
    if ((view[n] || '').trim()) continue;
    const v = champollion.getEnvOrFileVar(n, projectRoot);
    if (v) view[n] = v;
  }
  return view;
}

/**
 * The pair `champollion sync [--method <method>] [--model <model>]` would run
 * for source→target in `projectRoot`, resolved by the CLI's own config and
 * pair code (resolveConfig + resolvePairs). An exact pair key wins
 * ("en:fr"); otherwise a pair whose codes resolve to the same languages,
 * when exactly one does ("fra" asked, "fr" configured).
 *
 * `method` / `model` are overrides only when the call states them; without
 * them the pair keeps the project's own method and model (its pair or
 * per-language entry, else defaultMethod / model) — what a bare
 * `champollion sync` runs there. When the project has no pair for the
 * target and no method was stated, `wouldBe` is the pair sync would give
 * the target once it is added to `languages`, so the method still comes
 * from the project, not from this tool's own default.
 *
 * What the CLI prints while resolving (a `--method` override notice, an
 * unknown-field warning) is captured, never written to stdout — under MCP
 * stdio that is the JSON-RPC channel.
 *
 * @returns {{ pair: object|null, wouldBe?: object|null, config?: object, error?: string }}
 *   config: the project's resolved config (its key variable, apiKeyEnvVar,
 *   is the one sync hands every method — the fallback's included)
 */
function loadProjectPairs(champollion, projectRoot, { method, model }) {
  if (typeof champollion.resolveConfig !== 'function' || typeof champollion.resolvePairs !== 'function') {
    return { config: null, pairs: null };
  }
  const said = [];
  try {
    const config = withEngineOutput(said, () => champollion.resolveConfig(
      { ...(method ? { method } : {}), ...(model ? { model } : {}) }, projectRoot));
    const pairs = withEngineOutput(said, () => champollion.resolvePairs(config, { cwd: projectRoot }));
    return { config, pairs };
  } catch (err) {
    return { error: `project_dir ${displayPath(projectRoot)}: ${err.message}` };
  }
}

/** A project's own locale codes: its input locale, its targets, every pair's ends. */
function projectLocales(view) {
  if (!view?.config) return null;
  const out = new Set([view.config.inputLocale, ...Object.keys(view.config.resolvedLanguages || {})]);
  for (const pc of view.pairs?.values?.() || []) { out.add(pc.source); out.add(pc.target); }
  out.delete(undefined);
  out.delete(null);
  return [...out];
}

function resolveProjectPair(champollion, view, { projectRoot, source, target, srcCode, tgtCode, method }) {
  const { config, pairs } = view;
  if (!config || !pairs) return { pair: null };
  const said = [];
  const exact = pairs.get(`${source}:${target}`);
  if (exact) return { pair: exact, config };
  const resolveCode = champollion.resolveCode || ((c) => c);
  const same = [...pairs.values()].filter((pc) => (resolveCode(pc.source) || pc.source) === srcCode
    && (resolveCode(pc.target) || pc.target) === tgtCode);
  if (same.length === 1) return { pair: same[0], config };
  if (method) return { pair: null, config };
  // No pair, no stated method: the target as sync would resolve it once added
  // to `languages` (an entry with no settings of its own).
  try {
    const added = { [target]: {}, ...(config.resolvedLanguages || {}) };
    const wouldBe = withEngineOutput(said, () => champollion.resolvePairs({ ...config, resolvedLanguages: added }, { cwd: projectRoot }))
      .get(`${config.inputLocale}:${target}`) || null;
    return { pair: null, config, wouldBe: wouldBe || (config.defaultMethod ? { method: config.defaultMethod } : null) };
  } catch (err) {
    return {
      pair: null,
      error: `project_dir ${displayPath(projectRoot)} has no pair for ${target}, and resolving the one `
        + `\`champollion sync\` would use once it is added failed: ${err.message}. Pass method explicitly.`,
    };
  }
}

/**
 * The writing-system decision for this call — the one sync makes
 * (resolveTargetScript): an explicit `script` argument, else the project
 * pair's `script`, else the target's default. A target with more than one
 * real orthography and no choice is refused with the choices listed.
 *
 * @returns {{ error?: string, summary: object|null, convert: (text: string) => { text: string, note?: string } }}
 */
function planScript(champollion, pairConfig, scriptArg, card, projectRoot) {
  const none = { summary: null, convert: (text) => ({ text }) };
  if (typeof champollion.resolveTargetScript !== 'function') return none;
  const locale = pairConfig.target;
  const cardFor = champollion.getLanguageCard ? (champollion.getLanguageCard(locale) || card) : card;
  let res;
  try {
    res = scriptArg != null && scriptArg !== ''
      ? champollion.resolveTargetScript(locale, { ...pairConfig, script: scriptArg }, cardFor)
      : (pairConfig.scriptResolution || champollion.resolveTargetScript(locale, pairConfig, cardFor));
  } catch (err) {
    return { ...none, error: err.message };
  }
  if (!res) return none;
  if (res.source === 'choice-required') {
    const choices = (res.choices || []).map((c) => `script: "${c.script}" (${c.label})`).join(' or ');
    return {
      ...none,
      error: `${locale} has more than one real orthography, and champollion will not pick one for a community `
        + '(`champollion sync` refuses the same way). Choose one: pass '
        + `${choices}${projectRoot ? `, or set "script" on the pair in ${displayPath(join(projectRoot, 'champollion.config.json'))}` : ''}.`,
    };
  }
  const key = res.converterKey || null;
  const info = key && typeof champollion.getConverterInfo === 'function' ? champollion.getConverterInfo(key) : null;
  const summary = { script: res.script ?? null, source: res.source, converted: Boolean(key),
    ...(info ? { from: info.from, to: info.to } : {}) };
  if (!key || typeof champollion.convertScript !== 'function') return { summary, convert: (text) => ({ text }) };
  return {
    summary,
    convert(text) {
      if (typeof text !== 'string') return { text };
      const prepared = typeof champollion.applyScriptFallback === 'function'
        ? champollion.applyScriptFallback(text, pairConfig.scriptFallback) : text;
      const { converted, unmapped } = champollion.convertScript(prepared, key);
      if (!unmapped || unmapped.length === 0) return { text: converted };
      // Sync keeps such a value in the working script rather than write a
      // mix of two scripts — and says which letters could not be mapped.
      return {
        text,
        note: `kept in ${info?.from || 'the working script'}: the converter cannot map ${unmapped.join(', ')}`
          + ` (add "scriptFallback" for ${locale} to transliterate them)`,
      };
    },
  };
}

/**
 * The project pair's fallback, made ready to run the way `champollion sync`
 * runs it (cli/lib/translate-pair.js translateWithFallback; the config is the
 * one resolvePairs built from the pair's "fallback").
 *
 * Sync's preflight checks the fallback can run before translating anything
 * ("a configured fallback must be able to run too") — so does this: a
 * fallback that cannot run refuses the call, nothing sent. The key it is
 * handed is the one sync hands every method: the project's apiKeyEnvVar
 * (OPENROUTER_API_KEY unless the config names another), from the server's
 * environment or the project's .env files.
 *
 * @returns {Promise<{ refusal?: object, plan?: object }>} plan.run is null
 *   when this champollion offers no fallback pipeline (plan.unavailable says
 *   why — the answer reports it; it is never skipped silently)
 */
async function planFallback(champollion, fb, { projectRoot, projectConfig, env, pairName }) {
  const run = await cliFallbackPipeline(champollion);
  let engine = null;
  try {
    engine = typeof champollion.getMethod === 'function' ? champollion.getMethod(fb.method, fb) : null;
  } catch (err) {
    return {
      refusal: {
        status: 'bad-request',
        note: `The project's pair ${pairName} has a fallback that cannot be built: ${err.message}`,
      },
    };
  }
  const keyVar = projectConfig?.apiKeyEnvVar || 'OPENROUTER_API_KEY';
  const keyView = envWithProjectFiles(env, [keyVar, ...(METHOD_ENV[fb.method] || [])], projectRoot, champollion);
  const apiKey = (keyView[keyVar] || '').trim() || undefined;

  // What the answer names: method, model, endpoint and key, as for the engine.
  let model = fb.model || null;
  let modelSource = fb.model ? 'configured' : null;
  if (fb.method === API_METHOD) {
    model = null;
    modelSource = 'endpoint';
  } else if (!model && engine && typeof engine._getDefaultModel === 'function') {
    try { model = engine._getDefaultModel(); modelSource = 'engine default'; } catch { /* unknown */ }
  }
  let endpointShown = null;
  if (fb.method === API_METHOD) endpointShown = endpointIdentity(fb.endpoint);
  else if (BASE_URL_METHODS.includes(fb.method)) endpointShown = endpointIdentity(effectiveBase(engine, fb.method, env, projectRoot));
  let key = null;
  if (METHOD_KEYLESS[fb.method]) key = 'none needed';
  else if (METHOD_ENV[fb.method]) key = resolveMethodKey(fb.method, keyView).key ? resolveMethodKey(fb.method, keyView).envVar : null;

  const plan = {
    config: fb,
    run,
    apiKey,
    engine,
    tmKey: typeof champollion.tmMethodKey === 'function' ? champollion.tmMethodKey(fb) : fb.method,
    shown: { method: fb.method, model, model_source: modelSource, endpoint: endpointShown, key },
    unavailable: run ? null
      : 'this champollion version does not offer its fallback pipeline (translateWithFallback) to the MCP server',
  };
  if (!run || !engine || typeof engine.checkReadiness !== 'function') return { plan };

  let readiness;
  try {
    readiness = await engine.checkReadiness({ apiKey, cwd: projectRoot });
  } catch (err) {
    readiness = { ready: false, reason: err.message };
  }
  if (readiness && readiness.ready === false) {
    return {
      refusal: {
        status: 'needs-key',
        note: `The project's pair ${pairName} has a fallback (method "${fb.method}") that cannot run: `
          + `${readiness.reason} \`champollion sync\` stops before translating for the same reason (its `
          + 'preflight checks the fallback too), so nothing was sent. Set what it needs in the MCP server\'s '
          + `environment or the project's .env, or change the fallback in ${displayPath(join(projectRoot, 'champollion.config.json'))}.`,
      },
    };
  }
  return { plan };
}

/** "local · model strong · endpoint http://…/v1" — a fallback's identity. */
function fallbackIdentity(shown) {
  const parts = [shown.method];
  if (shown.model_source === 'endpoint') parts.push('model chosen by the endpoint');
  else if (shown.model) parts.push(`model ${shown.model}${shown.model_source === 'engine default' ? ' (engine default)' : ''}`);
  if (shown.endpoint) parts.push(`endpoint ${shown.endpoint}`);
  return parts.join(' · ');
}

/**
 * A translate result that delivered nothing: every text failed. Reported
 * as a tool error (isError) — an agent must not read "0 of 2" as success.
 * A partial result is not an error: it lists its failures per text.
 *
 * @param {object} r - translateTexts() result
 * @returns {boolean}
 */
export function translateResultIsError(r) {
  if (!r || r.status !== 'ok') return true;
  const c = r.counts || {};
  return (c.requested || 0) > 0 && (c.tm_hits || 0) + (c.translated || 0) + (c.fallback || 0) === 0;
}

/**
 * The `context` argument as one gettext msgctxt per text (null = none), or
 * why it is refused. One string applies to every text; an array gives one per
 * text. An empty string is a context (gettext's `msgctxt ""` is not "no
 * context"); null is none.
 *
 * @param {string|Array<string|null>|undefined|null} context
 * @param {string[]} texts
 * @returns {{ list: Array<string|null> } | { error: string }}
 */
export function contextsFor(context, texts) {
  const n = Array.isArray(texts) ? texts.length : 0;
  if (context === undefined || context === null) return { list: new Array(n).fill(null) };
  let list;
  if (typeof context === 'string') {
    list = new Array(n).fill(context);
  } else if (Array.isArray(context)) {
    if (context.length !== n) {
      return { error: `context has ${context.length} entr${context.length === 1 ? 'y' : 'ies'} for ${n} text(s): give one context `
        + 'for every text (a string), or one per text in the same order (null for a text without one). Nothing was sent.' };
    }
    list = context.map((c) => (c === undefined ? null : c));
  } else {
    return { error: 'context must be a string (one gettext msgctxt for every text) or an array with one per text (null for none). Nothing was sent.' };
  }
  for (const c of list) {
    if (c !== null && typeof c !== 'string') return { error: 'each context must be a string or null. Nothing was sent.' };
    if (typeof c === 'string' && c.includes('\u0004')) {
      return { error: 'a context cannot contain U+0004 (it separates the context from the text in a gettext key): pass the msgctxt alone. Nothing was sent.' };
    }
  }
  return { list };
}

/**
 * Translate texts through the champollion pipeline.
 *
 * @param {object} args
 * @param {string[]} args.texts - Source texts (1–50).
 * @param {string} args.source - Source language: a code ('en') or a name
 *   ('English'). With projectDir, matched to the project's own locale code.
 * @param {string} args.target - Target language: a code ('crk', 'fr') or a
 *   name ('French'), resolved the same way before any cache read or write.
 * @param {string} [args.method] - Engine name: every CLI-runtime entry
 *   of shared/method-registry.json (llm | openai | anthropic | gemini | local |
 *   google-translate | deepl | microsoft-translator | libretranslate |
 *   apertium | tilde | translated) plus 'api' (a champollion API endpoint).
 *   Default: with projectDir, the project's configured method for this pair
 *   (its pair or per-language `method`, else `defaultMethod` — what a bare
 *   `champollion sync` runs there); without projectDir, 'llm'. Stated, it
 *   overrides the project's, as `sync --method` does.
 * @param {string} [args.model] - Model override for LLM methods. Default:
 *   with projectDir, the project pair's model; else the engine's default.
 * @param {string} [args.register] - Style/register instruction (free text) or
 *   a language-card register preset name.
 * @param {string} [args.baseUrl] - method local/openai: the OpenAI-compatible
 *   base URL to call (e.g. `nmt-forge serve`'s http://127.0.0.1:8378/v1).
 * @param {string} [args.endpoint] - method api: the endpoint URL (e.g.
 *   `nmt-forge serve`'s http://127.0.0.1:8378/translate).
 * @param {string} [args.projectDir] - use that project's TM
 *   (<dir>/.champollion/tm.json) and, like the CLI there, its coaching and
 *   .env files — and the project's own pair (method, model, register,
 *   script) as `champollion sync` resolves it there, so the cache key is
 *   sync's. The pair's "fallback" runs as sync runs it (the CLI's own
 *   translateWithFallback): the fallback's cache before the method, and
 *   what the method could not translate safely through the fallback and the
 *   same gate, cached under the fallback's key. Default: the server's own TM
 *   (MCP_TM_ROOT), and no fallback.
 * @param {string} [args.script] - ISO 15924 output script for a target
 *   with a choice of writing systems (crk: "Latn" SRO or "Cans" Syllabics);
 *   required where sync requires it, unless the project pair sets one.
 * @param {string|Array<string|null>} [args.context] - gettext msgctxt: one
 *   for every text, or one per text (null = none). The cache is keyed with it
 *   as `champollion sync` keys a catalog entry with that context (the text
 *   `msgctxt\u0004msgid`, lib/tm-evict.js tmSourceText), and the model is
 *   told it ("Context (msgctxt): …", as sync tells it). Without it, a text the
 *   project_dir's source has ONLY with a context is translated without
 *   reading or writing the project's cache (a context-free entry would only
 *   shadow sync's), and the result says so.
 * @param {boolean} [args.useTm=true] - Consult + populate the persistent TM.
 * @param {boolean} [args.validate=true] - Run the deterministic quality gate.
 * @param {object} [deps] - Test injection: { champollion, env, tmRoot }.
 * @returns {Promise<object>} structured result (see formatTranslateResult).
 */
export async function translateTexts(args, deps = {}) {
  const champollion = deps.champollion !== undefined
    ? deps.champollion
    : await loadChampollion();
  if (!champollion) {
    return {
      status: 'unavailable',
      note: 'The champollion package is not reachable from this MCP server '
        + 'install. Run from the monorepo, or `npm install champollion` '
        + 'alongside the server. Translation is dispatched through '
        + "champollion's tested pipeline — this tool never improvises its own.",
    };
  }

  const {
    texts, source: sourceArg, target: targetArg,
    method: methodArg, model, register,
    baseUrl, endpoint: endpointArg, projectDir, script, context,
    useTm = true, validate = true,
  } = args;
  const env = deps.env || process.env;

  if (!Array.isArray(texts) || texts.length === 0) {
    return { status: 'bad-request', note: 'texts must be a non-empty array of strings.' };
  }
  if (texts.length > 50) {
    return {
      status: 'bad-request',
      note: `texts has ${texts.length} entries (max 50 per call). Batch your `
        + 'calls — the TM makes repeated/overlapping calls cheap, so several '
        + 'smaller calls cost no more than one big one.',
    };
  }
  if (methodArg != null && !TRANSLATE_METHODS.includes(methodArg)) {
    return {
      status: 'bad-request',
      note: `Unknown method '${methodArg}'. Available: ${TRANSLATE_METHODS.join(', ')}.`,
    };
  }
  // gettext msgctxt per text (null: none). A context is part of the cache key
  // the way sync keys a catalog entry with it (Round 13, Django persona: a
  // "Cancel" with project_dir missed the entry sync had cached under its
  // context, and wrote a context-free one beside it).
  const contexts = contextsFor(context, texts);
  if (contexts.error) return { status: 'bad-request', note: contexts.error };
  if (contexts.list.some((c) => c !== null) && typeof champollion.tmSourceText !== 'function') {
    return {
      status: 'unavailable',
      note: 'This champollion version cannot key the cache by a gettext context, so nothing was sent. Upgrade champollion.',
    };
  }

  // Project directory: its TM, coaching and .env — as the CLI uses them there.
  let projectRoot = null;
  if (projectDir != null) {
    const expanded = String(projectDir).startsWith('~')
      ? join(homedir(), String(projectDir).slice(1))
      : String(projectDir);
    projectRoot = resolve(expanded);
    let isDir = false;
    try { isDir = statSync(projectRoot).isDirectory(); } catch { /* not there */ }
    if (!isDir) {
      return { status: 'bad-request', note: `project_dir is not a directory: ${projectDir}` };
    }
  }
  const tmRoot = deps.tmRoot || projectRoot || mcpStateDir();

  // With project_dir, the project's config and pairs — as `champollion sync
  // [--method <method>] [--model <model>]` resolves them there.
  let projectView = null;
  if (projectRoot) {
    projectView = loadProjectPairs(champollion, projectRoot, { method: methodArg, model });
    if (projectView.error) return { status: 'bad-request', note: projectView.error };
  }

  // What the caller typed for each language — a code ("fr", "fra") or a NAME
  // ("French") — becomes the code to work in, BEFORE the pair is matched and
  // before the cache is read or written: with project_dir, the project's own
  // locale code (sync's "fr"); else the code for that language. The names
  // used to be taken as codes: "French" matched no pair, ran the engine's
  // default model, missed every entry sync had cached, and cached two
  // entries under a locale literally named "French" (Round 7, Next.js persona).
  const languagesResolved = [];
  let source = sourceArg;
  let target = targetArg;
  if (typeof champollion.resolveLanguageInput === 'function') {
    const locales = projectLocales(projectView);
    for (const [role, typed] of [['source', sourceArg], ['target', targetArg]]) {
      const r = champollion.resolveLanguageInput(typed, { locales });
      if (r.error) {
        return {
          status: 'bad-request',
          note: `${role}_language: ${r.error}.${locales ? ` The project's locales: ${locales.join(', ')}.` : ''} Nothing was sent.`,
        };
      }
      if (r.code !== typed) languagesResolved.push({ role, input: typed, code: r.code, how: r.how });
      if (role === 'source') source = r.code; else target = r.code;
    }
  }

  // Language resolution — language-card metadata conditions the prompt.
  const resolveCode = champollion.resolveCode || ((c) => c);
  const srcCode = resolveCode(source) || source;
  const tgtCode = resolveCode(target) || target;
  const card = champollion.getLanguageCard ? champollion.getLanguageCard(tgtCode) : null;

  // With project_dir, the pair is the one `champollion sync [--method <method>]
  // [--model <model>]` runs in that project — resolved by the CLI's own
  // config and pair code, so the method, cache key, locale code, register and
  // model are exactly sync's. Deriving them here instead (resolved code "fra"
  // for the project's "fr", a hashed register for its "formal-vous" preset,
  // an endpoint suffix sync never adds) made every entry sync had cached a
  // miss (synthetic i18next persona, 2026-10: 0 of 2 hits); this tool's own
  // "llm" default in place of the project's `defaultMethod: "local"` refused
  // for want of an OpenRouter key (synthetic Django persona, 2026-10).
  let projectPair = null;
  let projectWouldBe = null;
  let projectConfig = null;
  if (projectRoot) {
    const found = resolveProjectPair(champollion, projectView, { projectRoot, source, target, srcCode, tgtCode, method: methodArg });
    if (found.error) return { status: 'bad-request', note: found.error };
    projectPair = found.pair;
    projectWouldBe = found.wouldBe || null;
    projectConfig = found.config || null;
  }

  // The engine: as stated; else the project's own (its pair's, or the one
  // sync would give this target once added); else llm.
  const projectMethod = projectPair?.method || projectWouldBe?.method || null;
  const method = methodArg ?? projectMethod ?? 'llm';
  const methodSource = methodArg != null ? 'requested' : (projectMethod ? 'project' : 'default');
  if (!TRANSLATE_METHODS.includes(method)) {
    return {
      status: 'bad-request',
      note: `The project's ${projectPair ? `pair ${projectPair.source}:${projectPair.target}` : `configuration for ${target}`} `
        + `runs method "${method}" (${displayPath(join(projectRoot, 'champollion.config.json'))}), which this tool `
        + `cannot run. Run \`champollion sync\` there, or pass method — one of: ${TRANSLATE_METHODS.join(', ')}.`,
    };
  }
  // Method "api": the endpoint stated, else the project pair's own (sync calls that one).
  const endpoint = endpointArg ?? (method === API_METHOD && projectPair?.method === API_METHOD
    ? (projectPair.endpoint || undefined) : undefined);

  // Targeting: an argument that would not reach the engine is refused, never
  // dropped — a dropped endpoint once sent a user's text to a different model.
  if (endpoint != null && method !== API_METHOD) {
    return {
      status: 'bad-request',
      note: `endpoint applies to method "api" (a champollion API endpoint such as `
        + `\`nmt-forge serve\`'s /translate). For an OpenAI-compatible server (its /v1 URL), `
        + `use method "local" with base_url.`,
    };
  }
  if (method === API_METHOD && !endpoint) {
    return {
      status: 'bad-request',
      note: 'method "api" needs endpoint: the URL of a champollion API endpoint, e.g. '
        + 'http://127.0.0.1:8378/translate from `nmt-forge serve`.',
    };
  }
  if (baseUrl != null && !BASE_URL_METHODS.includes(method)) {
    return {
      status: 'bad-request',
      note: `base_url applies to method ${BASE_URL_METHODS.map((m) => `"${m}"`).join(' or ')} `
        + `(an OpenAI-compatible server, e.g. \`nmt-forge serve\`'s /v1 URL)`
        + (method === API_METHOD ? '; method "api" takes endpoint.' : '.'),
    };
  }
  const urlIssue = (endpoint != null && urlProblem(endpoint, 'endpoint', API_KEY_ENV))
    || (baseUrl != null && urlProblem(baseUrl, 'base_url', (METHOD_ENV[method] || []).find((n) => /_KEY$/.test(n)) || 'the engine\'s key variable'));
  if (urlIssue) return { status: 'bad-request', note: urlIssue };
  if (model && METHOD_KIND[method] === 'mt-api') {
    return {
      status: 'bad-request',
      note: `model applies to LLM engines; "${method}" is a machine-translation API `
        + '(kind mt-api in the method registry) with no model to choose. Drop model, '
        + 'or pick an LLM engine.',
    };
  }

  // Keys. The api transport reads CHAMPOLLION_API_KEY; a loopback endpoint
  // (an `nmt-forge serve` started without --token) needs none, so a
  // placeholder is sent — the local engine's own convention.
  const keyNames = method === API_METHOD ? [API_KEY_ENV] : (METHOD_ENV[method] || []);
  const keyEnv = envWithProjectFiles(env, keyNames, projectRoot, champollion);
  let apiKey;
  let keyNote;
  if (method === API_METHOD) {
    const k = (keyEnv[API_KEY_ENV] || '').trim();
    if (k) {
      apiKey = k;
      keyNote = API_KEY_ENV;
    } else if (isLoopbackUrl(endpoint)) {
      apiKey = 'not-needed';
      keyNote = `none (loopback endpoint; set ${API_KEY_ENV} if the server was started with a token)`;
    } else if (projectPair?.method === API_METHOD && projectPair.apiKey) {
      // The CLI's api method reads the pair's own "apiKey" ("${VAR}" or a
      // literal) — sync runs on it, so this call does too.
      keyNote = 'the pair\'s own "apiKey" in champollion.config.json';
    } else {
      return {
        status: 'needs-key',
        note: `Method "api" at a non-local endpoint needs ${API_KEY_ENV} in the MCP server's `
          + 'environment (the bearer key that endpoint expects).',
      };
    }
  } else {
    let envVar;
    ({ key: apiKey, envVar } = resolveMethodKey(method, keyEnv));
    if (METHOD_KEYLESS[method]) {
      // Endpoint vars (LOCAL_API_BASE…) are not keys; only a *_KEY var is one.
      // The CLI's method resolves its own endpoint and supplies a placeholder
      // key when none is set.
      const keyVar = (METHOD_ENV[method] || []).find((n) => /_KEY$/.test(n) && (keyEnv[n] || '').trim());
      apiKey = keyVar ? keyEnv[keyVar].trim() : undefined;
      keyNote = keyVar || 'none needed';
    } else {
      keyNote = envVar;
    }
    const needsKey = !METHOD_KEYLESS[method]
      && (method !== 'libretranslate' || !keyEnv.LIBRETRANSLATE_API_URL);
    if (!apiKey && needsKey) {
      return {
        status: 'needs-key',
        note: `Method '${method}' needs ${envVar} in the MCP server's `
          + 'environment. Set it (or pick a method whose key you have — '
          + `${Object.entries(METHOD_ENV)
            .filter(([m]) => resolveMethodKey(m, keyEnv).key)
            .map(([m]) => m).join(', ') || 'none currently unlocked'}).`,
      };
    }
  }

  // Synthetic key/value frame — the pipeline is keyed, so index the texts. A
  // text with a context is keyed as sync keys a catalog entry with one
  // (`msgctxt\u0004…`): the CLI pipeline (the fallback's) caches it under the
  // context, and the cache texts below fold it in the same way.
  const sourceFlat = {};
  const CONTEXT_SEP = champollion.CONTEXT_SEPARATOR || '\u0004';
  const keyOf = (i) => (contexts.list[i] !== null ? `${contexts.list[i]}${CONTEXT_SEP}t${i}` : `t${i}`);
  texts.forEach((t, i) => { sourceFlat[keyOf(i)] = String(t); });
  const allKeys = Object.keys(sourceFlat);
  const indexOfKey = new Map(allKeys.map((k, i) => [k, i]));
  // The text each key is cached under — sync's rule (cli/lib/tm-evict.js):
  // the source text, with its context folded in.
  const cacheFlat = {};
  for (const k of allKeys) {
    cacheFlat[k] = typeof champollion.tmSourceText === 'function' ? champollion.tmSourceText(k, sourceFlat[k]) : sourceFlat[k];
  }
  // What the model is told about a key's context — sync's words for a
  // catalog entry's msgctxt (cli/lib/po.js).
  const contextNotes = {};
  allKeys.forEach((k, i) => { if (contexts.list[i] !== null) contextNotes[k] = `Context (msgctxt): ${contexts.list[i]}`; });

  // The register: a language-card preset NAME ("formal-vous") is sent as
  // that preset's instructions and keyed by its name, free text as written
  // — the CLI's rule (config.js resolveLanguages / pairs.js). The name used
  // to reach the model verbatim as the instruction.
  const registerFields = (code, cardFor) => {
    if (!register) return null;
    const isPreset = cardFor?.registers?.[register] != null;
    return {
      register: isPreset && champollion.getRegister ? (champollion.getRegister(code, register) || register) : register,
      registerPreset: isPreset ? register : null,
    };
  };

  let pairConfig;
  if (projectPair) {
    // Sync's own pair, plus only what this call states explicitly.
    pairConfig = {
      ...projectPair,
      ...(registerFields(projectPair.target, champollion.getLanguageCard
        ? champollion.getLanguageCard(projectPair.target) : null) || {}),
      ...(method === API_METHOD ? { endpoint } : {}),
    };
  } else {
    // A project without this pair: what sync would use once the target is
    // added to its `languages` — the raw code, the card's default preset.
    const inProject = Boolean(projectRoot);
    const reg = registerFields(tgtCode, card) || {
      register: (champollion.getRegister ? champollion.getRegister(tgtCode) : '') || '',
      ...(inProject ? { registerPreset: card?.formality?.default || null } : {}),
    };
    pairConfig = {
      source: inProject ? source : srcCode,
      target: inProject ? target : tgtCode,
      method,
      // The OpenRouter default slug only makes sense for the OpenRouter lane;
      // every other engine (direct APIs, a local server) applies its own
      // default when model is unset — the OpenRouter default sent to Ollama
      // or to Anthropic's API is a guaranteed failure. A method that came from
      // the project brings the model sync would pair it with.
      model: model
        || (methodSource === 'project' ? projectWouldBe?.model : null)
        || (method === 'llm' ? champollion.DEFAULT_OPENROUTER_MODEL : undefined),
      batchSize: champollion.DEFAULT_BATCH_SIZE ?? 20,
      maxRetries: 2,
      ...reg,
      name: card?.name || tgtCode,
      dir: card?.dir || 'ltr',
      scripts: card?.scripts || null,
      script: null,
      qualityTier: 'standard',
      // The api transport's endpoint travels on the pair, exactly as a CLI
      // config's { "method": "api", "endpoint": … } does.
      ...(method === API_METHOD ? { endpoint } : {}),
    };
  }
  // The locale code entries are cached under: the project's own code (sync
  // writes "fr", not the resolved "fra"), else the resolved code as before.
  const tmLocale = projectRoot ? pairConfig.target : tgtCode;

  // Writing system — the same decision sync makes (lib/scripts.js
  // resolveTargetScript). A target with two real orthographies (crk: SRO or
  // Syllabics) is refused until one is chosen: by `script`, or by the
  // project's pair. Sync refuses the same way; this tool used to pick
  // silently (synthetic Cree school persona, 2026-10).
  const scriptPlan = planScript(champollion, pairConfig, script, card, projectRoot);
  if (scriptPlan.error) return { status: 'bad-request', note: scriptPlan.error };

  // The engine instance — the same one the CLI's translateBatch would build.
  let engine = null;
  if (typeof champollion.getMethod === 'function') {
    try {
      engine = champollion.getMethod(method, pairConfig);
    } catch (err) {
      return { status: 'bad-request', note: err.message };
    }
  }

  // Point it where the caller asked, and VERIFY it took: a target the engine
  // would not use is refused, never silently replaced by a default.
  if (baseUrl != null) {
    const canTarget = engine && typeof engine._resolveApiBase === 'function';
    if (canTarget) engine.options = { ...(engine.options || {}), baseUrl };
    const took = canTarget && normalizeBase(effectiveBase(engine, method, env, projectRoot)) === normalizeBase(baseUrl);
    if (!took) {
      return {
        status: 'unavailable',
        note: `This champollion version cannot point method "${method}" at base_url from the MCP `
          + 'server, so nothing was sent. Upgrade champollion, or set '
          + `${method === 'local' ? 'LOCAL_API_BASE' : 'OPENAI_API_BASE'} in the server's environment.`,
      };
    }
  }
  if (method === API_METHOD && engine && engine.endpoint !== undefined && engine.endpoint !== endpoint) {
    return {
      status: 'unavailable',
      note: 'This champollion version did not take the endpoint for method "api", so nothing was sent. Upgrade champollion.',
    };
  }

  // The pair's fallback (project_dir only: it is part of the project's pair).
  // A register this call states reaches the fallback too when the fallback
  // inherits its register from the pair (resolvePairs records that in
  // _defaults), as a pair-level register would.
  let fallbackPlan = null;
  if (projectRoot && pairConfig.fallback) {
    let fb = pairConfig.fallback;
    if (register && fb._defaults instanceof Set && fb._defaults.has('register')) {
      fb = { ...fb, ...registerFields(fb.target, champollion.getLanguageCard ? champollion.getLanguageCard(fb.target) : null) };
    }
    const planned = await planFallback(champollion, fb, {
      projectRoot, projectConfig, env, pairName: `${pairConfig.source}:${pairConfig.target}`,
    });
    if (planned.refusal) return planned.refusal;
    fallbackPlan = planned.plan;
  }

  // Where it will actually go, said in the answer.
  let endpointShown = null;
  if (method === API_METHOD) endpointShown = endpointIdentity(endpoint);
  else if (BASE_URL_METHODS.includes(method)) endpointShown = endpointIdentity(effectiveBase(engine, method, env, projectRoot));
  let modelShown = null;
  let modelSource = null;
  if (method === API_METHOD) {
    modelSource = 'endpoint';
  } else if (pairConfig.model) {
    modelShown = pairConfig.model;
    modelSource = 'requested';
  } else if (engine && typeof engine._getDefaultModel === 'function') {
    try { modelShown = engine._getDefaultModel(); modelSource = 'engine default'; } catch { /* unknown */ }
  }

  // TM entries are keyed on the FULL method key (method|model|register|
  // coaching), not the bare method name: switching model or register must be
  // a cache MISS, never a silent re-serve of old-style translations (see
  // cli/lib/tm.js tmMethodKey; its api key already names the endpoint).
  // Older champollion versions don't export tmMethodKey — their TMs were keyed
  // on the bare method, so falling back to it stays read/write-compatible.
  // An OpenAI-compatible lane is also keyed on its ENDPOINT: two different
  // servers (Ollama, then your own model) both answer "llama3.1"-or-unset, and
  // one's cached output must never be served as the other's.
  //
  // With project_dir the key is EXACTLY the CLI's (tmMethodKey of sync's own
  // pair): the cache is shared with `champollion sync` there, and sync does
  // not key by endpoint — an endpoint suffix here made every entry it had
  // cached unreachable.
  let tmKey = typeof champollion.tmMethodKey === 'function'
    ? champollion.tmMethodKey(pairConfig)
    : method;
  if (!projectRoot) {
    if (BASE_URL_METHODS.includes(method) && endpointShown) tmKey = `${tmKey}|endpoint=${endpointShown}`;
    if (method === API_METHOD && typeof champollion.tmMethodKey !== 'function') tmKey = `${tmKey}|endpoint=${endpointShown}`;
  }

  // Texts the project's source has ONLY with a context (a gettext msgctxt),
  // asked for here without one: sync never reads a context-free entry for
  // them, so this call neither reads nor writes the project's cache for them
  // — an entry under the bare text would only shadow sync's — and says so.
  const contextOnly = new Map();
  if (projectRoot && projectView?.config && typeof champollion.sourceTextContexts === 'function') {
    let byText = null;
    try {
      byText = withEngineOutput([], () => champollion.sourceTextContexts(projectView.config, { cwd: projectRoot }));
    } catch { byText = null; } // an unreadable source: nothing to compare against
    allKeys.forEach((k, i) => {
      if (contexts.list[i] !== null || !byText) return;
      const e = byText.get(sourceFlat[k]);
      if (e && !e.plain && e.contexts.length > 0) contextOnly.set(k, e.contexts);
    });
  }
  const cacheable = allKeys.filter((k) => !contextOnly.has(k));

  // Tier 1 — Translation Memory (free).
  let tm = null;
  let hits = {};
  let misses = allKeys;
  if (useTm && champollion.loadTM && champollion.partitionByTM) {
    tm = champollion.loadTM(tmRoot);
    // A project cache from before coaching was part of the key reads as
    // `champollion sync` reads it there (cli/lib/tm.js adoptLegacyCoachingKeys).
    if (projectRoot && projectView?.pairs && typeof champollion.adoptLegacyCoachingKeys === 'function') {
      champollion.adoptLegacyCoachingKeys(tm, projectView.pairs.values());
    }
    // Looked up under the text each key is cached under (context folded in).
    ({ hits, misses } = champollion.partitionByTM(
      tm, cacheFlat, cacheable, tmLocale, tmKey));
    misses = allKeys.filter((k) => !(k in hits));
  }
  // Which setup WROTE each cached answer. Model carry-over (cli/lib/tm.js)
  // serves a text another model of the same method, register and coaching
  // translated — after a project's model changed from stub-1 to stub-2, a
  // stub-1 answer came back under an Engine line naming stub-2, marked only
  // "(TM)" (Round 12, Next.js persona). Read-only, before anything is evicted.
  const writers = { pair: {}, fallback: {} };
  const writerKnown = typeof champollion.servingMethodKey === 'function';
  const noteWriters = (bucket, keys, key) => {
    if (!writerKnown || !tm) return;
    for (const k of keys) {
      try {
        const w = champollion.servingMethodKey(tm, cacheFlat[k], tmLocale, key);
        if (typeof w === 'string' && w) writers[bucket][k] = w;
      } catch { /* unknown: the row says nothing it cannot back */ }
    }
  };
  noteWriters('pair', Object.keys(hits), tmKey);

  // The pair's fallback runs through the CLI's own pipeline
  // (translateWithFallback), with what it prints captured. The CLI threads
  // `cwd` through to every method (key, .env, endpoint, coaching), so the
  // project is named explicitly — nothing reads this server's process.cwd().
  const fallbackLog = [];
  const runFallback = (keys, cfg, label, options) => withEngineOutput(fallbackLog,
    () => fallbackPlan.run(keys, sourceFlat, cfg, label, {
      apiKey: fallbackPlan.apiKey, targetCode: tmLocale, onProgress: null, cwd: projectRoot,
      ...(Object.keys(contextNotes).length > 0 ? { descriptions: contextNotes } : {}),
      ...options,
    }));
  const pairName = `${pairConfig.source}:${pairConfig.target}`;

  // Tier 1b — the fallback's cache (sync's ladder: the pair's cache → the
  // fallback's cache → the pair's method → the fallback's method). Text the
  // fallback already translated is served, gate-checked, and is not sent to
  // the pair's method again. The pipeline runs with every key held back from
  // both methods ("refused before": the caches are read, nothing is sent).
  let fallbackHits = {};
  let fallbackError = null;
  let fallbackRan = false;
  const fbCacheable = misses.filter((k) => !contextOnly.has(k));
  if (fallbackPlan?.run && tm && fbCacheable.length > 0) {
    fallbackRan = true;
    try {
      const held = new Set(fbCacheable);
      const cached = await runFallback(fbCacheable, { ...pairConfig, fallback: fallbackPlan.config }, pairName, {
        tm, noSendPrimary: held, noSendFallback: held,
      });
      fallbackHits = cached.translated || {};
      noteWriters('fallback', Object.keys(fallbackHits), fallbackPlan.tmKey);
      misses = misses.filter((k) => !(k in fallbackHits));
    } catch (err) {
      fallbackError = err.message;
    }
  }

  // Tier 2 — the engine, only for TM misses. What it prints is captured.
  let fresh = {};
  let apiError = null;
  const engineLog = [];
  if (misses.length > 0) {
    // The engine sees plain keys ("t0"): a context rides as the note sync
    // gives a catalog entry's msgctxt, never inside a key the model echoes.
    const plainOf = (k) => `t${indexOfKey.get(k)}`;
    const engineSource = {};
    const engineNotes = {};
    for (const k of misses) {
      engineSource[plainOf(k)] = sourceFlat[k];
      if (contextNotes[k]) engineNotes[plainOf(k)] = contextNotes[k];
    }
    const engineOptions = {
      apiKey, ...(projectRoot ? { cwd: projectRoot } : {}),
      ...(Object.keys(engineNotes).length > 0 ? { descriptions: engineNotes } : {}),
    };
    const engineKeys = misses.map(plainOf);
    try {
      const answered = await withEngineOutput(engineLog, () => (
        engine && typeof engine.translate === 'function'
          ? engine.translate(engineKeys, engineSource, pairConfig, engineOptions)
          : champollion.translateBatch(engineKeys, engineSource, pairConfig, engineOptions)
      )) || {};
      for (const k of misses) if (plainOf(k) in answered) fresh[k] = answered[plainOf(k)];
    } catch (err) {
      apiError = err.message;
    }
  }
  const engineSaid = engineReason(engineLog);

  // Tier 3 — deterministic quality gate on the fresh translations only
  // (TM entries passed it when they were stored).
  let validated = fresh;
  let failures = [];
  if (validate && champollion.validateTranslations && Object.keys(fresh).length > 0) {
    const res = champollion.validateTranslations(fresh, sourceFlat, pairConfig);
    validated = res.validated ?? res.valid ?? {};
    failures = res.failures ?? [];
  }

  // One text answering 3+ clearly different texts — a model repeating a
  // memorized sentence — is refused as sync's gate refuses it (cli/lib/
  // validate.js SharedOutputIndex). Checked over this call's answers, cached
  // ones included, and never cached: the persona's three clinical prompts
  // were validated one by one, cached as one sentence, and written by the
  // next sync (Round 5, hospital persona).
  // A cached answer refused here is no longer free output: it leaves the TM
  // count, and the summary says it was discarded and why (Round 8: "0/2 free
  // from Translation Memory" with no word that a cache hit had been thrown out).
  const sharedRule = typeof champollion.SharedOutputIndex === 'function' && typeof champollion.sharedOutputItems === 'function';
  // With project_dir, the index sync starts with there (cli/lib/
  // shared-output-seed.js projectSharedOutputIndex): the sentences the
  // project's cache remembers a model repeating (refused from their first
  // source on) and what its files and pages already hold. One call's answers
  // alone let the sentence the project knew to be memorized through as the
  // translation of a new text (Round 10, school persona). Without project_dir,
  // this call's answers are all there is to compare.
  const projectIndex = Boolean(projectRoot && projectConfig && typeof champollion.projectSharedOutputIndex === 'function');
  // The memorized sentences are knowledge, not a cache read: read even with
  // use_tm false (the cache itself stays unread and unwritten then).
  let knownTm = tm;
  if (projectIndex && !knownTm && typeof champollion.loadTM === 'function') {
    try { knownTm = champollion.loadTM(tmRoot); } catch { knownTm = null; }
  }
  const newSharedIndex = (cfg) => {
    if (projectIndex) {
      try {
        return champollion.projectSharedOutputIndex({ config: projectConfig, cwd: projectRoot, code: pairConfig.target, tm: knownTm });
      } catch { /* an unreadable project: this call's answers only, as before */ }
    }
    return new champollion.SharedOutputIndex({ protectedTerms: cfg.protectedTerms || [] });
  };
  const tmDiscarded = new Set();
  const fallbackCacheDiscarded = new Set();
  // What each discarded cached answer was, and which OTHER source texts the
  // same sentence answered (this call's, or — with project_dir — the
  // project's own strings and pages, the index sync starts with): the
  // summary's "the lines below say which" is kept by the lines themselves
  // (Round 11: they named the reason, never the collision).
  const discardedDetail = {};
  // The group lists every source the sentence answered, this text's own
  // included (whole, or a sentence of it): compared case and punctuation aside.
  const fold = (s) => String(s).normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  const collision = (key, cache, answer, group) => {
    const items = champollion.sharedOutputItems(key, sourceFlat[key], answer);
    const pieces = typeof champollion.SharedOutputIndex.withSentences === 'function'
      ? champollion.SharedOutputIndex.withSentences(items) : items;
    const own = new Set([sourceFlat[key], ...pieces.map((it) => it.source)].map(fold));
    const others = [...new Set((group.sources || []).map(String).filter((s) => !own.has(fold(s))))];
    discardedDetail[key] = {
      cache,
      answer,
      also_answered: others,
      // An earlier sync recorded the sentence as memorized: the project's
      // cache keeps the sentence, not the strings it answered then.
      ...(group.memorized ? { memorized: true } : {}),
    };
  };
  // The index this check builds remembers what it refused (an output found
  // answering different sources is suspect from its first new source on);
  // the fallback pass below is checked against the same index, as sync's
  // fallback is within one run. A fresh index there served the fallback's
  // discarded cached answer straight back from the same cache, under a line
  // saying it had been discarded (Round 11).
  let checkIndex = null;
  if (validate && sharedRule) {
    const index = newSharedIndex(pairConfig);
    checkIndex = index;
    const answers = { ...hits, ...fallbackHits, ...validated };
    const items = Object.entries(answers).flatMap(([k, v]) => champollion.sharedOutputItems(k, sourceFlat[k], v));
    for (const [key, group] of index.suspects(items)) {
      const reason = typeof champollion.sharedOutputReason === 'function'
        ? champollion.sharedOutputReason(group) : 'same output for several different source texts';
      if (key in validated) {
        validated = { ...validated };
        delete validated[key];
        failures.push({ key, reason });
      }
      if (key in hits) {
        collision(key, 'pair', hits[key], group);
        hits = { ...hits };
        delete hits[key];
        failures.push({ key, reason });
        tmDiscarded.add(key);
      }
      if (key in fallbackHits) {
        collision(key, 'fallback', fallbackHits[key], group);
        fallbackHits = { ...fallbackHits };
        delete fallbackHits[key];
        failures.push({ key, reason });
        fallbackCacheDiscarded.add(key);
      }
    }
  }

  // Tier 4 — the pair's fallback, for every text still untranslated (refused
  // by the gate, or not returned): ONE pass through the fallback's method and
  // the SAME gate (with its corrective retry) — the very call sync makes
  // (translateWithFallback with the fallback's config). Accepted values are
  // cached under the fallback's own TM key; with use_tm false, in a
  // throwaway memory nothing reads or keeps. Sync gates fallback output
  // always, so validate: false (which skips the gate for the engine's own
  // answers) does not reach it.
  let fallbackFresh = {};
  let fallbackFailures = [];
  let fallbackAttempted = [];
  let fallbackCachedValues = {};
  let fallbackSent = 0;
  if (fallbackPlan?.run && !fallbackError) {
    fallbackAttempted = allKeys.filter((k) => !(k in hits) && !(k in fallbackHits) && !(k in validated));
    if (fallbackAttempted.length > 0) {
      fallbackRan = true;
      const fbTm = tm || {}; // {}: an in-memory TM, never saved (use_tm: false)
      if (tm && champollion.partitionByTM) {
        // What its cache held before it ran — to say which answers came from there.
        fallbackCachedValues = champollion.partitionByTM(
          tm, cacheFlat, fallbackAttempted.filter((k) => !contextOnly.has(k)), tmLocale, fallbackPlan.tmKey).hits;
        noteWriters('fallback', Object.keys(fallbackCachedValues), fallbackPlan.tmKey);
      }
      // The gate's shared-output rule sees what this call already accepted,
      // and what it already refused (checkIndex).
      const sharedOutputs = sharedRule ? (checkIndex || newSharedIndex(fallbackPlan.config)) : null;
      if (sharedOutputs) {
        sharedOutputs.add(Object.entries({ ...hits, ...fallbackHits, ...validated })
          .flatMap(([k, v]) => champollion.sharedOutputItems(k, sourceFlat[k], v)));
      }
      try {
        // Texts the project has only with a context run against a throwaway
        // memory: the project's cache is neither read nor written for them.
        const groups = [
          [fallbackAttempted.filter((k) => !contextOnly.has(k)), fbTm],
          [fallbackAttempted.filter((k) => contextOnly.has(k)), {}],
        ].filter(([keys]) => keys.length > 0);
        for (const [keys, groupTm] of groups) {
          const fr = await runFallback(keys, fallbackPlan.config,
            `${pairName} (fallback: ${fallbackPlan.config.method})`,
            { tm: groupTm, ...(sharedOutputs ? { sharedOutputs } : {}) });
          fallbackFresh = { ...fallbackFresh, ...(fr.translated || {}) };
          fallbackFailures = [...fallbackFailures, ...(fr.failures || [])];
          fallbackSent += (fr.sentCount || 0) + (fr.retriedCount || 0);
        }
      } catch (err) {
        fallbackError = err.message;
      }
    }
  }
  const fallbackSaid = engineReason(fallbackLog);
  const byFallback = { ...fallbackHits, ...fallbackFresh };
  const fromFallbackCache = (k) => k in fallbackHits
    || (k in fallbackFresh && fallbackCachedValues[k] === fallbackFresh[k]);

  // Persist the survivors so the next agent call is free. The fallback's
  // pipeline stored (and evicted) its own entries in the same memory.
  if (useTm && tm && champollion.storeTM && champollion.saveTM) {
    for (const [key, translation] of Object.entries(validated)) {
      if (contextOnly.has(key)) continue; // never a context-free entry beside sync's context-keyed ones
      champollion.storeTM(tm, cacheFlat[key], tmLocale, tmKey, translation);
    }
    if (Object.keys(validated).length > 0 || fallbackRan) champollion.saveTM(tmRoot, tm);
  }

  const failureByKey = {};
  for (const f of failures) failureByKey[f.key] = f.reason;
  const fallbackFailureByKey = {};
  for (const f of fallbackFailures) fallbackFailureByKey[f.key] = f.reason;
  const fbName = fallbackPlan ? `the pair's fallback (${fallbackIdentity(fallbackPlan.shown)})` : null;

  const results = allKeys.map((key, i) => {
    const fromTm = key in hits;
    const fromFallback = key in byFallback;
    const working = fromTm ? hits[key] : (validated[key] ?? byFallback[key] ?? null);
    // The cache holds the working script (as sync's does); a chosen display
    // script is produced from it, exactly as sync writes it.
    const converted = working === null ? null : scriptPlan.convert(working);
    // Why the engine's own answer is not the one delivered (or not there).
    let failure = failureByKey[key] ?? (!fromTm && !(key in validated) && !(key in fallbackHits)
      ? (apiError || engineSaid || 'translation failed (the engine returned nothing and gave no reason)')
      : null);
    if (working === null && fallbackPlan) {
      // What the fallback did with it, after what the engine did.
      if (!fallbackPlan.run) {
        failure = `${failure}; ${fbName} was not applied: ${fallbackPlan.unavailable} — \`champollion sync\` there would send this text to it`;
      } else if (fallbackError) {
        failure = `${failure}; then ${fbName} failed: ${fallbackError}`;
      } else if (fallbackAttempted.includes(key)) {
        const why = fallbackFailureByKey[key] || fallbackSaid || 'it returned nothing and gave no reason';
        failure = `${failure}; then ${fbName}: ${why}`;
      }
    }
    // Served from a cache, no API call: the pair's own entries, or the
    // fallback's (both in this Translation Memory, under their own keys).
    // The ONE mark the counts are taken from (Round 11: "0/2 free" over two
    // rows marked (TM), both served from the fallback's cache).
    const cache = fromTm ? 'pair' : (fromFallback && fromFallbackCache(key) ? 'fallback' : null);
    // Who wrote a cached answer, when that is not the setup this call names
    // for that cache (the Engine line's for the pair's, the Fallback line's
    // for its fallback's).
    const writtenBy = cache
      ? writerOf(writers[cache][key], cache === 'pair' ? tmKey : fallbackPlan?.tmKey, champollion)
      : null;
    return {
      index: i,
      source: sourceFlat[key],
      // The gettext context this text was translated and cached with (null: none).
      context: contexts.list[i],
      // The project's source has this text only with a context: the project's
      // cache was neither read nor written for it (pass `context` to use it).
      ...(contextOnly.has(key) ? { project_contexts: contextOnly.get(key) } : {}),
      translation: converted === null ? null : converted.text,
      from_tm: cache !== null,
      ...(cache ? { cache } : {}),
      ...(writtenBy ? { written_by: writtenBy } : {}),
      // A cached answer (TM, or the fallback's cache) the shared-output check
      // threw out — whatever this text ended up with, it was not that. The
      // detail: which cache, the answer, and the other source texts the same
      // sentence answered.
      ...(tmDiscarded.has(key) || fallbackCacheDiscarded.has(key)
        ? { cached_discarded: true, ...(discardedDetail[key] ? { discarded_cached_answer: discardedDetail[key] } : {}) }
        : {}),
      validated: fromTm || fromFallback ? true : (key in validated),
      // Produced by the pair's fallback (the top-level `fallback` names it),
      // with why the engine's own answer was not used, when it was asked.
      ...(fromFallback ? { by_fallback: true, ...(failure ? { engine_failure: failure } : {}) } : {}),
      ...(converted?.note ? { script_note: converted.note } : {}),
      failure: working === null ? failure : null,
    };
  });

  let cost = null;
  let costError = null;
  try {
    const m = engine || (champollion.getMethod ? champollion.getMethod(method, pairConfig) : null);
    // Some engines price asynchronously (a live pricing lookup).
    cost = m?.estimateCost ? await m.estimateCost(misses.length, pairConfig) : null;
  } catch (err) {
    // Cost estimation is best-effort; why it failed is said when texts were sent.
    costError = err.message;
  }
  // A fallback that sent texts spends too: priced with its own estimator,
  // never silently left out of the figure (an unpriced one says so).
  let fallbackCost = null;
  let fallbackCostError = null;
  if (fallbackSent > 0) {
    try {
      fallbackCost = fallbackPlan.engine?.estimateCost
        ? await fallbackPlan.engine.estimateCost(fallbackSent, fallbackPlan.config) : null;
    } catch (err) { fallbackCostError = err.message; }
  }

  // The price in the CLI's words ("$0 API cost (runs on this machine)" for a
  // model served here, "est. ~$0.0020" otherwise) — the package's shared
  // helper, so the MCP answer and `champollion sync` never word one estimate
  // two ways (Round 9: "0 USD" here, "$0 API cost (runs on this machine)" there).
  const labelOf = (estimate) => (estimate && typeof champollion.costLabel === 'function' ? champollion.costLabel(estimate) : null);
  // Why a price is unknown, for texts that WERE sent (Round 11: an unpriced
  // call said nothing about cost at all). The estimate's own note first (the
  // CLI's OpenRouter estimate names the model and whether it is unlisted — a
  // likely typo — listed but unpriced, or the price list unreachable); else
  // the package's label for it, without its leading "cost unknown —".
  const unknownWhy = (estimate, error) => {
    if (estimate && estimate.estimatedCost != null) return null;
    if (typeof estimate?.note === 'string' && estimate.note.trim()) return estimate.note.trim();
    if (error) return `the estimate failed: ${error}`;
    if (!estimate) return 'this engine gives no cost estimate';
    return String(labelOf(estimate) || '').replace(/^cost unknown\s*[—–-]\s*/i, '').trim() || 'no published price';
  };

  // Every count is taken from the rows' own marks, so the summary can never
  // disagree with them.
  const rowsWhere = (pred) => results.filter(pred).length;
  return {
    status: 'ok',
    // The resolved ISO codes (language cards are keyed on them).
    pair: { source: srcCode, target: tgtCode },
    // The codes this call works in: the project's own (sync's "fr", not
    // "fra") with project_dir, else as the caller passed them (a language
    // NAME already turned into its code).
    codes: projectRoot
      ? { source: pairConfig.source, target: pairConfig.target }
      : { source, target },
    // What was typed as something other than the code worked in ("French"
    // → "fr"): [{ role, input, code, how }] — empty when codes were passed.
    languages_resolved: languagesResolved,
    method,
    model: pairConfig.model,
    script: scriptPlan.summary,
    engine: {
      method,
      // requested | project (its configured method) | default (llm)
      method_source: methodSource,
      model: modelShown,
      model_source: modelSource,
      endpoint: endpointShown,
      key: keyNote ?? null,
    },
    // The project pair's fallback and what it did (null: no fallback — no
    // project_dir, or the pair has none).
    fallback: fallbackPlan
      ? {
        ...fallbackPlan.shown,
        // ran | not-needed | unavailable (this champollion offers no fallback
        // pipeline) | error (the pipeline threw)
        status: !fallbackPlan.run ? 'unavailable'
          : fallbackError ? 'error'
            : (fallbackAttempted.length > 0 || Object.keys(fallbackHits).length > 0) ? 'ran' : 'not-needed',
        ...(fallbackPlan.unavailable ? { reason: fallbackPlan.unavailable } : {}),
        ...(fallbackError ? { reason: fallbackError } : {}),
        attempted: fallbackAttempted.length,
        // Texts the method could not translate that the fallback did (its
        // cache or its method); `cached`: answers its cache served (rows
        // marked cache "fallback").
        accepted: Object.keys(fallbackFresh).length,
        cached: rowsWhere((t) => t.cache === 'fallback'),
        // Texts its method was sent (retries included): what its cost is for.
        sent: fallbackSent,
        tm_key: useTm ? fallbackPlan.tmKey : null,
        estimated_api_cost: fallbackCost,
        estimated_api_cost_label: labelOf(fallbackCost),
        estimated_api_cost_unknown: fallbackSent > 0 ? unknownWhy(fallbackCost, fallbackCostError) : null,
        log: fallbackLog.slice(-10),
      }
      : null,
    translation_memory: useTm
      ? {
        path: join(tmRoot, '.champollion', 'tm.json'),
        scope: projectRoot ? 'project' : 'mcp-server',
        key: tmKey,
        locale: tmLocale,
        // Whether this champollion says which setup wrote a cached answer
        // (rows' written_by). false: a row without written_by is unknown,
        // not "this setup".
        writers_known: writerKnown,
        // The project pair this call shares entries with (null: the project
        // has no such pair yet — cached as sync would once it is added).
        ...(projectRoot ? { project_pair: projectPair ? `${projectPair.source}:${projectPair.target}` : null } : {}),
      }
      : null,
    register_applied: Boolean(pairConfig.register),
    // Texts asked for without a context that the project's source has only
    // with one: translated, but the project's cache was neither read nor
    // written for them (sync caches them under their context).
    project_context_only: [...contextOnly].map(([k, ctxs]) => ({ index: indexOfKey.get(k), text: sourceFlat[k], contexts: ctxs })),
    counts: {
      requested: allKeys.length,
      // Served from a cache — no API call: the rows marked from_tm, from the
      // pair's own entries (tm_hits) or the fallback's (fallback.cached).
      cached: rowsWhere((t) => t.from_tm),
      // Cache hits SERVED from the pair's own entries — a hit the
      // shared-output check discarded is not free output and is counted in
      // tm_discarded instead.
      tm_hits: rowsWhere((t) => t.cache === 'pair'),
      // Cached rows another setup wrote (an earlier model, under model
      // carry-over) — each row's written_by says which.
      cached_by_other_setup: rowsWhere((t) => t.written_by),
      tm_discarded: tmDiscarded.size,
      fallback_cache_discarded: fallbackCacheDiscarded.size,
      translated: Object.keys(validated).length,
      // By the pair's fallback (from its cache or its method): never counted
      // as the engine's.
      fallback: rowsWhere((t) => t.by_fallback),
      failed: rowsWhere((t) => t.translation === null),
      // Texts sent to the engine (what the cost estimate is for).
      sent_to_engine: misses.length,
    },
    estimated_api_cost: cost,
    estimated_api_cost_label: labelOf(cost),
    // Why the cost is unknown when texts were sent and no price is known
    // (null otherwise).
    estimated_api_cost_unknown: misses.length > 0 ? unknownWhy(cost, costError) : null,
    results,
    api_error: apiError,
    engine_log: engineLog.slice(-10),
  };
}

/** "local · model llama3.1 (engine default) · endpoint http://…/v1" */
function engineLine(r) {
  const e = r.engine || { method: r.method, model: r.model };
  const parts = [e.method_source === 'project' ? `${e.method} (the project's configured method)` : e.method];
  if (e.model_source === 'endpoint') parts.push('model chosen by the endpoint');
  else if (e.model) parts.push(`model ${e.model}${e.model_source === 'engine default' ? ' (engine default)' : ''}`);
  if (e.endpoint) parts.push(`endpoint ${e.endpoint}`);
  if (e.key) parts.push(`key ${e.key}`);
  return `Engine: ${parts.join(' · ')}`;
}

/** The Fallback: line — which fallback, and what it did this call. */
function fallbackLine(r) {
  const fb = r.fallback;
  const parts = [fallbackIdentity(fb)];
  if (fb.key) parts.push(`key ${fb.key}`);
  const what = {
    ran: () => {
      const produced = r.results.filter((t) => t.by_fallback).map((t) => `[${t.index}]`);
      const failedToo = fb.attempted - fb.accepted;
      return produced.length > 0
        ? `it translated ${produced.join(', ')}${fb.cached ? ` (${fb.cached} from its cache)` : ''}`
          + `${failedToo > 0 ? `; ${failedToo} it could not translate either` : ''}`
        : `it could not translate the ${fb.attempted} text(s) the engine left either`;
    },
    'not-needed': () => 'not needed: the engine (or the Translation Memory) translated every text',
    unavailable: () => `NOT APPLIED — ${fb.reason}; \`champollion sync\` there would send the failed texts to it`,
    error: () => `failed: ${fb.reason}`,
  }[fb.status];
  return `Fallback: ${parts.join(' · ')} — the project pair's "fallback", run as \`champollion sync\` runs it: `
    + `${what ? what() : fb.status}.`;
}

/** "en → fr (fra)": the codes the call works in; the resolved ISO code of the
 *  target (its language card) in parentheses only where it differs. */
function pairLabel(r) {
  const shown = r.codes || r.pair;
  const iso = r.pair?.target;
  return `${shown.source} → ${shown.target}${iso && iso !== shown.target ? ` (${iso})` : ''}`;
}

/**
 * "1 cached answer discarded: the same sentence answered another, different
 * source" — cache hits the shared-output check threw out this call (Round 8,
 * hospital persona: the summary said "0/2 free from Translation Memory" and
 * nothing about the hit it had refused). Empty when there were none.
 */
export function cachedDiscardedNote(c) {
  const tm = c?.tm_discarded || 0;
  const fbc = c?.fallback_cache_discarded || 0;
  const n = tm + fbc;
  if (!n) return '';
  const where = tm && fbc ? ` (${tm} from Translation Memory, ${fbc} from the fallback's cache)`
    : fbc ? ' from the fallback\'s cache' : '';
  return `${count(n, 'cached answer')}${where} discarded: `
    + (n === 1 ? 'the same sentence answered another, different source'
      : 'each one\'s sentence also answered another, different source')
    + ' (the shared-output check — the lines below say which)';
}

/** A source or cached text as quoted in a line: JSON-quoted, long ones cut. */
function quoted(text, max = 80) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return JSON.stringify(s.length > max ? `${s.slice(0, max - 3)}...` : s);
}

/**
 * The line under a text whose cached answer the shared-output check threw
 * out: which cache, the answer it held, and which other source texts the
 * same sentence answered — what the summary's "the lines below say which"
 * promises (Round 11: the lines gave the reason, never the collision).
 */
export function discardedAnswerLine(d) {
  const from = d.cache === 'fallback' ? 'from the fallback\'s cache' : 'from Translation Memory';
  const others = d.also_answered || [];
  const shown = others.slice(0, 4).map((s) => quoted(s)).join(', ')
    + (others.length > 4 ? `, … (${others.length} in all)` : '');
  const parts = [];
  if (others.length) parts.push(`the same sentence also answered ${shown}`);
  if (d.memorized) {
    parts.push(`${others.length ? 'and ' : ''}an earlier sync recorded it as a sentence the model gave for other, `
      + 'different source strings (the project\'s cache keeps the sentence, not which strings)');
  }
  if (!parts.length) parts.push('the shared-output check matched it to another source it did not name');
  return `    discarded cached answer (${from}): ${quoted(d.answer)} — ${parts.join(' ')}`;
}

/**
 * "Cost of the fresh calls: …" — the price of what was sent, or why it is
 * unknown. Said whenever texts were sent to the engine or the fallback (Round
 * 11: an unpriced call said nothing about cost); a known price is printed as
 * before, in the package's words. Null when there is nothing to say.
 */
function costLine(r) {
  const fb = r.fallback || null;
  const est = r.estimated_api_cost;
  const sent = r.counts?.sent_to_engine ?? 0;
  // A note is a sentence: its own full stop would double the line's.
  const why = (text) => String(text || 'no published price').replace(/[.\s]+$/, '');
  let main = null;
  if (est?.estimatedCost != null) {
    // The CLI's label when the package provides it (estimated_api_cost_label).
    main = r.estimated_api_cost_label || `${est.estimatedCost} ${est.currency || 'USD'}`;
  } else if (sent > 0) {
    main = `unknown — ${why(r.estimated_api_cost_unknown)}`;
  }
  let fbPart = null;
  if (fb && (fb.sent ?? 0) > 0) {
    const fbCost = fb.estimated_api_cost?.estimatedCost;
    fbPart = fbCost != null
      ? `${fb.estimated_api_cost_label || `${fbCost} ${fb.estimated_api_cost.currency || 'USD'}`} for the fallback's`
      : `the fallback's: unknown — ${why(fb.estimated_api_cost_unknown)}`;
  }
  if (main && fbPart) return `Cost of the fresh calls: ${main}, plus ${fbPart}.`;
  if (main) return `Cost of the fresh calls: ${main}.`;
  if (fbPart) return `Cost of the fresh calls: nothing was sent to the engine; ${fbPart}.`;
  return null;
}

/**
 * A cached answer's writer, when it is not the setup this call names for that
 * cache — null when it is that setup, or the writer is unknown.
 *
 * `writerKey` is the cache key of the setup that wrote the entry
 * (champollion's servingMethodKey: "method|model|register|coaching");
 * `askedKey` is the key the call looked up (the pair's, or its fallback's).
 * Same method, register and coaching with another model is model carry-over
 * (cli/lib/tm.js): `champollion sync` serves those too, and says so.
 *
 * @returns {{ key: string, method: string, model: string|null, label: string,
 *   instead_of: string, model_carryover: boolean }|null}
 */
export function writerOf(writerKey, askedKey, champollion) {
  if (typeof writerKey !== 'string' || !writerKey || typeof askedKey !== 'string' || writerKey === askedKey) return null;
  const w = writerKey.split('|');
  const a = askedKey.split('|');
  const describe = typeof champollion?.describeMethodKey === 'function'
    ? (k) => champollion.describeMethodKey(k) : (k) => k;
  const modelOnly = w.length === 4 && a.length === 4 && w[0] === a[0] && w[2] === a[2] && w[3] === a[3];
  return {
    key: writerKey,
    method: w.length === 4 ? (w[0] || 'llm') : writerKey,
    model: w.length === 4 ? (w[1] || null) : null,
    // What differs, in words: the model alone, or the setup.
    label: modelOnly ? `model ${w[1] || '(none)'}` : describe(writerKey),
    instead_of: modelOnly ? `model ${a[1] || '(none)'}` : describe(askedKey),
    model_carryover: modelOnly,
  };
}

/**
 * A row's cache mark, as the server instructions promise it: "cache: pair" or
 * "cache: fallback" (whose cache answered it), and — when another setup wrote
 * that answer — which, against the one the Engine (or Fallback) line names.
 */
function cacheMark(t) {
  if (!t.cache) return '';
  const line = t.cache === 'fallback' ? 'the Fallback line' : 'the Engine line';
  const w = t.written_by;
  return ` (cache: ${t.cache}${w ? ` — written by ${w.label}, not the ${w.instead_of} ${line} names` : ''})`;
}

/** ' (msgctxt "button")' for a row translated with a gettext context. */
function contextMark(t) {
  return typeof t.context === 'string' ? ` (msgctxt ${JSON.stringify(t.context)})` : '';
}

/**
 * The line for texts asked for without a context that the project's source
 * has only with one: what was (not) done with the cache, and the argument
 * that uses the entry `champollion sync` uses. Null when there are none.
 *
 * The argument is exact, never a guess: a text the project has under
 * several contexts ("Cancel" as msgctxt "button" and "dialog") is two
 * entries, and which one is meant is the caller's to say — the line lists
 * them and asks (Round 14, Django persona: it listed both, then said to
 * pass `context: "button"`, as if there were one). A call of several texts
 * gets an array, one slot per text (null where a text has no context): a
 * single string would apply to every text of the call.
 */
export function contextOnlyLine(r) {
  const list = r.project_context_only || [];
  if (list.length === 0) return null;
  const shown = list.slice(0, 3).map((x) => `[${x.index}] ${quoted(x.text, 40)} (msgctxt ${x.contexts.map((c) => JSON.stringify(c)).join(', ')})`)
    .join('; ') + (list.length > 3 ? `; +${list.length - 3} more` : '');
  const head = `Context: ${shown} — the project has ${list.length === 1 ? 'this text' : 'these texts'} only as gettext entries with a context, `
    + 'which `champollion sync` caches under that context. Without one, this call neither read nor wrote the project\'s '
    + `Translation Memory for ${list.length === 1 ? 'it' : 'them'} (a context-free entry would only sit beside sync's). `;
  const n = Array.isArray(r.results) && r.results.length > 0 ? r.results.length : Math.max(...list.map((x) => x.index)) + 1;
  const several = list.filter((x) => x.contexts.length > 1);
  if (several.length > 0) {
    const named = several.map((x) => `${n > 1 ? `[${x.index}] ` : ''}${quoted(x.text, 40)} is ${x.contexts.length} entries — `
      + `${x.contexts.map((c) => JSON.stringify(c)).join(' and ')}`).join('; ');
    return head + `${named}. Pass the context you mean: `
      + (n > 1 ? 'context as an array, one per text (null for a text with none)' : 'context: "<one of them>"')
      + ' — this call does not pick one for you.';
  }
  const only = new Set(list.map((x) => x.contexts[0]));
  if (only.size === 1 && list.length === n) {
    return head + `Pass context: ${JSON.stringify(list[0].contexts[0])} to use and fill the entry sync uses.`;
  }
  const slots = new Array(n).fill(null);
  for (const x of list) slots[x.index] = x.contexts[0];
  return head + `Pass context: ${JSON.stringify(slots)} (one per text, null for none) to use and fill the entries sync uses.`;
}

/** Human-readable rendering of a translateTexts() result. */
export function formatTranslateResult(r) {
  if (r.status !== 'ok') return r.note;
  const out = [];
  const c = r.counts;
  const fb = r.fallback || null;
  const discarded = cachedDiscardedNote(c);
  if (translateResultIsError(r)) {
    out.push(`Nothing was translated: all ${c.requested} text(s) failed (${pairLabel(r)} via ${r.method}`
      + `${fb?.status === 'ran' ? ` and the pair's fallback, ${fb.method}` : ''})`
      + `${discarded ? `; ${discarded}` : ''}.`);
  } else {
    // "Free" is every row marked "cache: …": served from a cache, no API call —
    // the pair's own entries or its fallback's. Named per cache when the
    // fallback's served any (Round 11: "0/2 free" over two (TM) rows, both
    // from the fallback's cache, each also counted "by the pair's fallback").
    const fbCached = fb?.cached || 0;
    const free = c.cached ?? (c.tm_hits + fbCached);
    let freeWhere = '';
    if (fbCached) {
      freeWhere = c.tm_hits
        ? ` (${c.tm_hits} cached for the pair's method, ${fbCached} for its fallback — no API call)`
        : ' (cached for the pair\'s fallback — no API call)';
    }
    const fbFresh = (c.fallback || 0) - fbCached;
    const byFallback = fbFresh > 0 ? `${fbFresh} by the pair's fallback (${fb?.method || 'fallback'}), ` : '';
    out.push(`Translated ${pairLabel(r)} via ${r.method}`
      + ` — ${free}/${c.requested} free from Translation Memory${freeWhere}, `
      + `${c.translated} newly translated, ${byFallback}${c.failed} failed${discarded ? `; ${discarded}` : ''}.`);
  }
  if (r.languages_resolved?.length) {
    const own = r.translation_memory?.scope === 'project';
    out.push(`Languages: ${r.languages_resolved.map((x) => `"${x.input}" → ${x.code}`).join(', ')}`
      + `${own && r.languages_resolved.some((x) => x.how === 'locale') ? ' (the project\'s own locale codes)' : ''}.`);
  }
  out.push(engineLine(r));
  if (fb) out.push(fallbackLine(r));
  // A target with one writing system (no converter: source "none") has no
  // script decision to report; the line is for a real choice or conversion.
  if (r.script && r.script.source !== 'none') {
    out.push(r.script.converted
      ? `Script: ${r.script.to} (converted from ${r.script.from}; script ${r.script.script ?? 'chosen'}, ${r.script.source === 'config' ? 'as chosen' : r.script.source}).`
      : `Script: ${r.script.script ?? 'the working script'} (${r.script.source === 'config' ? 'as chosen' : r.script.source}).`);
  }
  if (r.translation_memory) {
    const tmInfo = r.translation_memory;
    let where = '(this server\'s own, separate from any project\'s .champollion/tm.json — pass project_dir to use a project\'s)';
    if (tmInfo.scope === 'project') {
      where = tmInfo.project_pair
        ? `(the project's — shared with \`champollion sync\` there: pair ${tmInfo.project_pair}, the same cache key)`
        : '(the project\'s — shared with `champollion sync` there; the project has no pair for this target yet, '
          + 'so this is cached the way sync will cache it once the target is added)';
    }
    out.push(`Translation Memory: ${displayPath(tmInfo.path)} ${where}`);
    // Cached answers another setup wrote, said once above the rows that are
    // marked with it — as `champollion sync` says a file keeps an earlier
    // model's text.
    const other = r.results.filter((t) => t.written_by);
    if (other.length) {
      const who = [...new Set(other.map((t) => t.written_by.label))].join(', ');
      const carried = other.every((t) => t.written_by.model_carryover);
      out.push(`${count(other.length, 'cached answer')} ${other.length === 1 ? 'was' : 'were'} written by ${who}, not the setup named above`
        + (carried ? ' — reused as `champollion sync` reuses them (a model change alone re-translates nothing)' : '')
        + '. To translate them with the setup named above, pass use_tm: false'
        + `${carried && tmInfo.scope === 'project' ? ' (in the project, `champollion sync --redo all --fresh-on-model-change` re-translates the files)' : ''}.`);
    } else if (tmInfo.writers_known === false && r.results.some((t) => t.cache)) {
      out.push('Which setup wrote each cached answer is not known with this champollion version.');
    }
  } else {
    out.push('Translation Memory: off (use_tm: false).');
  }
  const ctxLine = contextOnlyLine(r);
  if (ctxLine) out.push(ctxLine);
  const cost = costLine(r);
  if (cost) out.push(cost);
  out.push('');
  const fbTag = fb ? ` (by the fallback: ${fallbackIdentity({ ...fb, endpoint: null })})` : '';
  for (const t of r.results) {
    if (t.translation !== null) {
      out.push(`[${t.index}]${contextMark(t)}${cacheMark(t)}${t.by_fallback ? fbTag : ''}`
        + `${t.cached_discarded ? ' (its cached answer was discarded: the same sentence answered another, different source)' : ''} `
        + `${t.translation}${t.script_note ? `  — ${t.script_note}` : ''}`);
    } else {
      out.push(`[${t.index}]${contextMark(t)} FAILED: ${t.cached_discarded ? 'cached answer discarded — ' : ''}${t.failure}`);
    }
    if (t.discarded_cached_answer) out.push(discardedAnswerLine(t.discarded_cached_answer));
  }
  if (r.results.some((t) => t.failure && t.translation === null)) {
    if (r.engine_log?.length) {
      out.push('');
      out.push('The engine said:');
      for (const l of r.engine_log.slice(-5)) out.push(`  ${l}`);
    }
    if (fb?.log?.length && fb.attempted > 0) {
      out.push('');
      out.push('The fallback said:');
      for (const l of fb.log.slice(-5)) out.push(`  ${l}`);
    }
    out.push('');
    out.push('Failed texts were rejected by the deterministic quality gate or '
      + 'the engine — retry with a different method/model, or shorten the '
      + 'text. Nothing invalid was returned as if it were good.');
  }
  return out.join('\n');
}
