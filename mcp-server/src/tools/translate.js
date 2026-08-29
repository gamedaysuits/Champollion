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

import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

/** Candidate paths to the champollion package entry; first hit wins. */
const CHAMPOLLION_CANDIDATES = [
  resolve(__dirname, '../../../cli/index.js'),
  resolve(__dirname, '../../cli/index.js'),
];

/** Where the MCP server keeps its persistent Translation Memory
 *  (champollion writes <cwd>/.champollion/tm.json under this root). */
export const MCP_TM_ROOT = resolve(homedir(), '.champollion-mcp');

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
  const env = {};
  const requireAll = {};
  for (const [key, entry] of Object.entries(registry.entries)) {
    const runtimes = entry.runtimes; // absent = every runtime
    if (Array.isArray(runtimes) && !runtimes.includes('cli')) continue;
    const name = entry.cli_name || key;
    // credential_env is the unlocking subset; plain env is credentials for
    // simple entries (extra config vars like *_REGION appear only in env).
    env[name] = entry.credential_env || entry.env || [];
    requireAll[name] = entry.credential_env_all === true;
  }
  return { env, requireAll, from };
}

const _derived = deriveMethodEnv();

/** method name -> env var(s) that unlock it. DERIVED from
 *  shared/method-registry.json at load — never hand-edit a copy here. */
export const METHOD_ENV = _derived.env;

/** method name -> true when ALL of its METHOD_ENV vars are required
 *  (credential_env_all in the SSOT, e.g. translated/Lara's key id+secret). */
export const METHOD_ENV_ALL = _derived.requireAll;

let _champollion;

/** Load (and cache) the champollion package; null when not resolvable. */
export async function loadChampollion() {
  if (_champollion !== undefined) return _champollion;
  for (const p of CHAMPOLLION_CANDIDATES) {
    if (!existsSync(p)) continue;
    try {
      _champollion = await import(pathToFileURL(p).href);
      return _champollion;
    } catch {
      // try the next candidate
    }
  }
  try {
    _champollion = await import('champollion');
    return _champollion;
  } catch {
    _champollion = null;
    return _champollion;
  }
}

/** Test hook. */
export function _setChampollionForTests(value) {
  _champollion = value;
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

/**
 * Translate texts through the champollion pipeline.
 *
 * @param {object} args
 * @param {string[]} args.texts - Source texts (1–50).
 * @param {string} args.source - Source language code (e.g. 'en').
 * @param {string} args.target - Target language code (e.g. 'crk', 'fr').
 * @param {string} [args.method='llm'] - Engine name. The set is derived from
 *   shared/method-registry.json (every CLI-runtime entry, by cli_name): llm |
 *   openai | anthropic | gemini | local | google-translate | deepl |
 *   microsoft-translator | libretranslate | apertium | tilde | translated.
 * @param {string} [args.model] - Model override for LLM methods.
 * @param {string} [args.register] - Style/register instruction (free text) or
 *   a language-card register preset name.
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
    texts, source, target,
    method = 'llm', model, register,
    useTm = true, validate = true,
  } = args;
  const env = deps.env || process.env;
  const tmRoot = deps.tmRoot || MCP_TM_ROOT;

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
  if (!(method in METHOD_ENV)) {
    return {
      status: 'bad-request',
      note: `Unknown method '${method}'. Available: ${Object.keys(METHOD_ENV).join(', ')}.`,
    };
  }

  // Language resolution — language-card metadata conditions the prompt.
  const resolveCode = champollion.resolveCode || ((c) => c);
  const srcCode = resolveCode(source) || source;
  const tgtCode = resolveCode(target) || target;
  const card = champollion.getLanguageCard ? champollion.getLanguageCard(tgtCode) : null;

  const { key: apiKey, envVar } = resolveMethodKey(method, env);
  const needsKey = method !== 'libretranslate' || !env.LIBRETRANSLATE_API_URL;
  if (!apiKey && needsKey) {
    return {
      status: 'needs-key',
      note: `Method '${method}' needs ${envVar} in the MCP server's `
        + 'environment. Set it (or pick a method whose key you have — '
        + `${Object.entries(METHOD_ENV)
          .filter(([m]) => resolveMethodKey(m, env).key)
          .map(([m]) => m).join(', ') || 'none currently unlocked'}).`,
    };
  }

  // Synthetic key/value frame — the pipeline is keyed, so index the texts.
  const sourceFlat = {};
  texts.forEach((t, i) => { sourceFlat[`t${i}`] = String(t); });
  const allKeys = Object.keys(sourceFlat);

  const pairConfig = {
    source: srcCode,
    target: tgtCode,
    method,
    model: model
      || (champollion.DEFAULT_OPENROUTER_MODEL ?? 'google/gemini-3.5-flash'),
    batchSize: champollion.DEFAULT_BATCH_SIZE ?? 20,
    maxRetries: 2,
    register: register
      || (champollion.getRegister ? champollion.getRegister(tgtCode) : '')
      || '',
    name: card?.name || tgtCode,
    dir: card?.dir || 'ltr',
    scripts: card?.scripts || null,
    script: null,
    qualityTier: 'standard',
  };

  // TM entries are keyed on the FULL method key (method|model|register|
  // coaching), not the bare method name: switching model or register must be
  // a cache MISS, never a silent re-serve of old-style translations (see
  // cli/lib/tm.js tmMethodKey). Older champollion versions don't export
  // tmMethodKey — their TMs were keyed on the bare method, so falling back
  // to it stays read/write-compatible with those installs.
  const tmKey = typeof champollion.tmMethodKey === 'function'
    ? champollion.tmMethodKey(pairConfig)
    : method;

  // Tier 1 — Translation Memory (free).
  let tm = null;
  let hits = {};
  let misses = allKeys;
  if (useTm && champollion.loadTM && champollion.partitionByTM) {
    tm = champollion.loadTM(tmRoot);
    ({ hits, misses } = champollion.partitionByTM(
      tm, sourceFlat, allKeys, tgtCode, tmKey));
  }

  // Tier 2 — the engine, only for TM misses.
  let fresh = {};
  let apiError = null;
  if (misses.length > 0) {
    try {
      fresh = await champollion.translateBatch(
        misses, sourceFlat, pairConfig, { apiKey }) || {};
    } catch (err) {
      apiError = err.message;
    }
  }

  // Tier 3 — deterministic quality gate on the fresh translations only
  // (TM entries passed it when they were stored).
  let validated = fresh;
  let failures = [];
  if (validate && champollion.validateTranslations && Object.keys(fresh).length > 0) {
    const res = champollion.validateTranslations(fresh, sourceFlat, pairConfig);
    validated = res.validated ?? res.valid ?? {};
    failures = res.failures ?? [];
  }

  // Persist the survivors so the next agent call is free.
  if (useTm && tm && champollion.storeTM && champollion.saveTM) {
    for (const [key, translation] of Object.entries(validated)) {
      champollion.storeTM(tm, sourceFlat[key], tgtCode, tmKey, translation);
    }
    if (Object.keys(validated).length > 0) champollion.saveTM(tmRoot, tm);
  }

  const failureByKey = {};
  for (const f of failures) failureByKey[f.key] = f.reason;

  const results = allKeys.map((key, i) => {
    const fromTm = key in hits;
    const translation = fromTm ? hits[key] : (validated[key] ?? null);
    return {
      index: i,
      source: sourceFlat[key],
      translation,
      from_tm: fromTm,
      validated: fromTm ? true : (key in validated),
      failure: failureByKey[key] ?? (translation === null && !fromTm
        ? (apiError || 'translation failed') : null),
    };
  });

  let cost = null;
  try {
    const m = champollion.getMethod
      ? champollion.getMethod(method, pairConfig) : null;
    cost = m?.estimateCost ? m.estimateCost(misses.length, pairConfig) : null;
  } catch { /* cost estimation is best-effort */ }

  return {
    status: 'ok',
    pair: { source: srcCode, target: tgtCode },
    method,
    model: pairConfig.model,
    register_applied: Boolean(pairConfig.register),
    counts: {
      requested: allKeys.length,
      tm_hits: Object.keys(hits).length,
      translated: Object.keys(validated).length,
      failed: allKeys.length - Object.keys(hits).length - Object.keys(validated).length,
    },
    estimated_api_cost: cost,
    results,
    api_error: apiError,
  };
}

/** Human-readable rendering of a translateTexts() result. */
export function formatTranslateResult(r) {
  if (r.status !== 'ok') return r.note;
  const out = [];
  const c = r.counts;
  out.push(`Translated ${r.pair.source} → ${r.pair.target} via ${r.method}`
    + (r.model && r.method === 'llm' ? ` (${r.model})` : '')
    + ` — ${c.tm_hits}/${c.requested} free from Translation Memory, `
    + `${c.translated} newly translated, ${c.failed} failed.`);
  if (r.estimated_api_cost?.estimatedCost != null) {
    out.push(`Estimated API cost for the fresh calls: `
      + `${r.estimated_api_cost.estimatedCost} ${r.estimated_api_cost.currency || 'USD'}.`);
  }
  out.push('');
  for (const t of r.results) {
    if (t.translation !== null) {
      out.push(`[${t.index}]${t.from_tm ? ' (TM)' : ''} ${t.translation}`);
    } else {
      out.push(`[${t.index}] FAILED: ${t.failure}`);
    }
  }
  if (r.results.some((t) => t.failure && t.translation === null)) {
    out.push('');
    out.push('Failed texts were rejected by the deterministic quality gate or '
      + 'the engine — retry with a different method/model, or shorten the '
      + 'text. Nothing invalid was returned as if it were good.');
  }
  return out.join('\n');
}
