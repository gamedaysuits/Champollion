/**
 * Language pair resolution — converts config into a directional pair graph.
 *
 * WHY: champollion v2 assumed English→X for everything. v3 models
 * translation as directional pairs (en:fr, es:en, en:crk) where each
 * pair can have its own method, model, quality tier, and cost profile.
 *
 * The pair model supports two config modes:
 *   1. Simple: `languages: ["fr", "de"]` — all pairs use default method/model
 *   2. Advanced: `pairs: { "en:crk": { method: "fst-gated" } }` — per-pair overrides
 *
 * Both can coexist: `pairs` overrides `languages` for specific language targets.
 *
 * PAIR KEY FORMAT: "source:target" (e.g., "en:fr")
 * Canonical separator is the colon (:) — compact, ASCII-safe, and
 * unambiguous since no locale code contains a colon. Legacy formats
 * (→, ->) are still accepted by parsePairKey for backward compatibility.
 */

import { DEFAULT_REGISTERS, getLanguageCard, resolveCode, DEFAULT_REGISTER_FALLBACK } from './registers.js';
import { resolveTargetScript, validateScriptFallback, converterKeyForLocale } from './scripts.js';
import { getMethod, METHOD_REGISTRY } from './translate.js';
import { COACHED_PROVIDERS, normalizeProvider } from './methods/llm-coached.js';
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_BATCH_SIZE, DEFAULT_MAX_RETRIES } from './config.js';
import { requireExactModelId } from './models.js';
import { output } from './output.js';
import { tmMethodKey } from './tm.js';
import { PLAIN_LLM_METHODS } from './methods/prompt-methods.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Quality tiers — a label a pair's config (`pairs.<pair>.qualityTier`) or a
 * served method's manifest declares about its output. Each description says
 * what the label claims; nothing measures or enforces it — sync translates
 * the same whatever the tier, `serve` advertises it, and `status` shows it
 * only when someone set it (the default is no claim at all; Round 14,
 * Next.js persona: "quality: Standard" on every pair explained nothing).
 */
const QUALITY_TIERS = {
  standard: {
    label: 'Standard',
    description: 'Direct LLM translation. No post-processing verification.',
  },
  high: {
    label: 'High',
    description: 'LLM translation with grammar/dictionary coaching. Better for complex morphology.',
  },
  research: {
    label: 'Research',
    description: 'LLM + deterministic FST/grammar gate. Morphologically verified output.',
  },
  verified: {
    label: 'Verified',
    description: 'LLM draft flagged for human review. Highest confidence.',
  },
};

/**
 * Default method config — applied to all pairs unless overridden.
 */
const PAIR_DEFAULTS = {
  method: 'llm',
  model: null,       // null = inherit from top-level config.model
  qualityTier: 'standard',
  batchSize: null,   // null = inherit from top-level config.batchSize
  maxRetries: DEFAULT_MAX_RETRIES,     // max cascade retries on batch parse failure (batch → half → individual)
};

/**
 * Methods that connect directly to a provider API (not via OpenRouter).
 *
 * For these methods, the global config.model (which is an OpenRouter slug like
 * "google/gemini-3.5-flash") would be wrong — each provider has its own model
 * naming scheme. When model is not explicitly set, we pass null so the method
 * class's _getDefaultModel() fires with the correct provider-specific slug.
 */
const DIRECT_PROVIDER_METHODS = new Set([
  'gemini', 'openai', 'anthropic', 'local', 'deepl',
  'google-translate', 'microsoft-translator', 'libretranslate',
]);

/**
 * Methods whose transport is chosen by `provider`. Every other method names
 * its own engine, so a `provider` set on one of them is a config error.
 */
const PROVIDER_ROUTED_METHODS = new Set(['llm', 'llm-coached']);

/**
 * Resolve a pair's transport from its method and the `provider` settings.
 *
 *   - `ownProvider` is set at the pair or language level; `globalProvider` at
 *     the top level. The more specific one wins.
 *   - Only llm / llm-coached are provider-routed. A top-level provider is a
 *     default for those and leaves other methods alone; a pair- or
 *     language-level provider on any other method is refused (unless it just
 *     restates the method, e.g. method "openai" + provider "openai").
 *   - Plain `llm` on a direct provider IS that provider's method (the direct
 *     methods build the same prompt), so it is rewritten to it. llm-coached
 *     keeps its method and dispatches on `provider` itself.
 *   - An unknown provider throws — it must never quietly ride OpenRouter.
 *
 * @param {string} method - Method after method resolution
 * @param {string|null|undefined} ownProvider - Pair/language-level provider
 * @param {string|null|undefined} globalProvider - Top-level provider
 * @returns {{ method: string, provider: string|null }}
 */
function resolveTransportForPair(method, ownProvider, globalProvider) {
  const check = (raw) => {
    if (raw == null) return null;
    const p = normalizeProvider(raw);
    if (!COACHED_PROVIDERS.includes(p)) {
      throw new Error(
        `Unknown provider "${raw}". Supported providers: ${COACHED_PROVIDERS.join(', ')}.`
      );
    }
    return p;
  };
  const own = check(ownProvider);
  const global = check(globalProvider);

  if (!PROVIDER_ROUTED_METHODS.has(method)) {
    if (own && own !== method) {
      throw new Error(
        `provider "${own}" cannot apply to method "${method}" — only llm and ` +
        `llm-coached are routed by provider. Remove "provider", or use ` +
        `method "${own === 'openrouter' ? 'llm' : own}".`
      );
    }
    return { method, provider: null };
  }

  const provider = own ?? global ?? 'openrouter';
  if (method === 'llm' && provider !== 'openrouter') {
    return { method: provider, provider };
  }
  return { method, provider };
}

/**
 * Resolve the model for a translation pair.
 *
 * - If the user explicitly set a model for the pair/language, use it.
 * - If the pair talks to a direct provider (a direct method, or llm-coached
 *   on a non-OpenRouter provider), the global default is an OpenRouter slug
 *   and would be wrong there. Use `providerModel` — the top-level `model`
 *   when it was written alongside a top-level `provider` for this very
 *   transport — else null so the method's _getDefaultModel() fires.
 * - Otherwise (OpenRouter), use the global default.
 *
 * @param {string|null} explicitModel - Model from per-language or per-pair config
 * @param {string} method - Translation method name (after transport resolution)
 * @param {string} globalDefault - Global model from config (OpenRouter slug)
 * @param {string|null} [provider] - Resolved transport (null for non-routed methods)
 * @param {string|null} [providerModel] - Top-level model that belongs to `provider`
 * @returns {string|null} Resolved model, or null to use the method default
 */
function resolveModelForPair(explicitModel, method, globalDefault, provider = null, providerModel = null, from = null) {
  if (explicitModel) return modelIdForTransport(explicitModel, method, provider, from);
  if (DIRECT_PROVIDER_METHODS.has(method) || (provider && provider !== 'openrouter')) {
    return modelIdForTransport(providerModel, method, provider, 'from the top-level "model"');
  }
  return modelIdForTransport(globalDefault, method, provider);
}

/** Transports that name models themselves (lib/methods/direct-llm.js resolveModelId). */
const MODEL_ID_TRANSPORTS = new Set(['openai', 'anthropic', 'gemini', 'local']);

/**
 * The model id a pair's transport is sent, as written in the config or on
 * --model:
 *   - OpenRouter (llm, llm-coached by default): the exact slug as written.
 *     A retired alias ("gemini-flash") or a floating id ("~google/…-latest")
 *     THROWS, naming the exact slug to write (founder ruling 2026-10-05:
 *     exact slugs only, no aliasing — lib/models.js requireExactModelId).
 *   - A direct provider (openai, anthropic, gemini — as a method or as the
 *     provider of llm-coached): its own name ("openai/gpt-5.5" → "gpt-5.5");
 *     an id it has no name for ("google/…" on openai) THROWS, naming a model
 *     that method can run. It used to be sent as is, and every request failed.
 *   - local, and a gateway set with OPENAI_API_BASE: as written.
 *   - Engines (deepl, api, …): as written (they run no model of ours).
 *
 * @param {string|null} model
 * @param {string} method - Method after transport resolution
 * @param {string|null} provider - Resolved transport (null for non-routed methods)
 * @param {string|null} [from] - Where the id was set, for a refusal
 * @returns {string|null}
 * @throws {Error} code CHAMPOLLION_MODEL_ROUTE or CHAMPOLLION_MODEL_ID (the caller prefixes the pair)
 */
function modelIdForTransport(model, method, provider = null, from = null) {
  if (!model) return model;
  const transport = PROVIDER_ROUTED_METHODS.has(method) ? (provider || 'openrouter') : method;
  if (transport === 'openrouter') return requireExactModelId(model, { from });
  if (MODEL_ID_TRANSPORTS.has(transport)) return new METHOD_REGISTRY[transport]().resolveModelId(model, { from });
  return model;
}

/**
 * resolveModelForPair, with a refused model id naming the pair — the same
 * shape as a refused provider. `from` says where an explicit id was set.
 */
function resolveModelNamed(where, from, explicitModel, method, globalDefault, provider, providerModel) {
  try {
    return resolveModelForPair(explicitModel, method, globalDefault, provider, providerModel, from);
  } catch (err) {
    if (err.code === 'CHAMPOLLION_MODEL_ROUTE' || err.code === 'CHAMPOLLION_MODEL_ID') err.message = `${where}: ${err.message}`;
    throw err;
  }
}

/**
 * Where a pair's explicit model id was written, for a refusal message:
 * --model, else the first config field that set it (null = none set).
 *
 * @param {object} config
 * @param {Array<[string, unknown]>} fields - [label, value] in precedence order
 * @returns {string|null}
 */
function modelSource(config, fields) {
  if (config._modelOverride) return 'from --model';
  const set = fields.find(([, value]) => value);
  return set ? `from ${set[0]}` : null;
}

/**
 * Fields a pair's `fallback` may set. Everything else on a resolved fallback
 * is inherited from its pair — the target language's name, register, script,
 * coaching, prompt context — because those describe the LANGUAGE, and a
 * fallback translates the same language for the same project.
 */
const FALLBACK_FIELDS = new Set([
  'method', 'model', 'provider', 'endpoint', 'apiKey', 'methodPlugin', 'acceptsInstructions',
  'register', 'temperature', 'coachingFile', 'coachingPrompt', 'promptContext',
  'batchSize', 'maxRetries', 'qualityTier', 'contentSegmentation', 'name',
]);

/** Fields refused on a fallback, with the reason the error gives. */
const FALLBACK_REFUSED = {
  fallback: 'a fallback cannot have its own fallback — one per pair',
  script: 'the writing system belongs to the pair, not to one method — set "script" on the pair',
  scriptFallback: 'transliteration rules belong to the pair — set "scriptFallback" on the pair',
  source: 'a fallback translates its own pair — it has no source of its own',
  target: 'a fallback translates its own pair — it has no target of its own',
};

/** Fields whose value a fallback inherits from its pair unless it sets them. */
const FALLBACK_INHERITED = [
  'register', 'temperature', 'coachingFile', 'coachingPrompt', 'promptContext',
  'batchSize', 'maxRetries', 'qualityTier', 'contentSegmentation', 'name',
];

/**
 * Say a fallback note once per process: resolvePairs runs several times in
 * one sync (the run, then verify), and the same warning twice is noise.
 */
const notedOnce = new Set();
function noteOnce(level, message) {
  if (notedOnce.has(message)) return;
  notedOnce.add(message);
  output[level](message);
}

/**
 * Throw, naming the pair, when `methodName` is not a method the CLI can run.
 * getMethod() supplies the precise message (harness-only engine vs typo).
 */
function assertKnownMethod(methodName, where) {
  if (METHOD_REGISTRY[methodName]) return;
  try {
    getMethod(methodName);
  } catch (err) {
    throw new Error(`${where}: ${err.message}`);
  }
}

/**
 * Read a coaching file a pair, a language or a fallback names for itself.
 *
 * WHY: only the TOP-LEVEL coachingFile was read (lib/config.js, into
 * coachingPrompt). A language's, a pair's or a fallback's own coachingFile
 * reached the plain LLM methods' prompt never — their prompt carries
 * coachingPrompt only — and llm-coached only when no less specific level had
 * coaching text (that text won). A `local` fallback given a coaching file
 * ran uncoached, and its cache key did not change either (Round 10, school
 * persona). The text read here is what the prompt carries and what the
 * cache key fingerprints (lib/tm.js tmMethodKey), so an edit re-translates.
 *
 * Fails loud, naming where the file was named: a run never goes ahead
 * uncoached when coaching was asked for (the llm-coached contract).
 *
 * @param {string} file - As written in the config
 * @param {string} projectDir - What a relative path is relative to
 * @param {string} where - e.g. 'en:crk: "fallback"'
 * @returns {string}
 */
function readOwnCoachingFile(file, projectDir, where) {
  const resolved = path.isAbsolute(file) ? file : path.resolve(projectDir, file);
  let text;
  try {
    text = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    throw new Error(
      `${where}: "coachingFile" ${JSON.stringify(file)} cannot be read (${err.code || err.message}; resolved to ${resolved}). `
      + 'Fix the path, or remove "coachingFile" — Champollion does not translate without the coaching a config asks for.'
    );
  }
  text = text.trim();
  if (!text) {
    throw new Error(
      `${where}: "coachingFile" ${JSON.stringify(file)} (${resolved}) is empty. `
      + 'Write the coaching in it, or remove "coachingFile".'
    );
  }
  return text;
}

/**
 * The coaching text the version before 2026-10 SENT for a pair (lib/tm.js
 * legacyMethodKey reuses entries made with it only when it is the text sent
 * now): the plain LLM methods sent `coachingPrompt` as it resolved then — a
 * level's own coachingFile never; llm-coached that text, else its
 * coachingFile's content.
 *
 * @param {object} pc - The pair (or fallback) with method, coachingFile, coachingPrompt
 * @param {string|null} legacyPrompt - coachingPrompt as the old precedence resolved it
 * @param {string|null} ownFile - The file this level names for itself (already in coachingPrompt)
 * @param {string} projectDir
 * @returns {string|null}
 */
function legacyCoachingSent(pc, legacyPrompt, ownFile, projectDir) {
  if (PLAIN_LLM_METHODS.has(pc.method)) return legacyPrompt;
  if (pc.method !== 'llm-coached') return pc.coachingPrompt ?? null;
  if (typeof legacyPrompt === 'string' && legacyPrompt.trim()) return legacyPrompt;
  if (typeof pc.coachingFile !== 'string' || !pc.coachingFile.trim()) return null;
  if (ownFile && ownFile === pc.coachingFile) return pc.coachingPrompt ?? null;
  try {
    const resolved = path.isAbsolute(pc.coachingFile) ? pc.coachingFile : path.resolve(projectDir, pc.coachingFile);
    return fs.readFileSync(resolved, 'utf-8').trim() || null;
  } catch {
    return null; // it failed then too (llm-coached refuses to run uncoached)
  }
}

/**
 * Resolve a pair's `fallback` into a full pair config.
 *
 * A fallback is the method that translates what the pair's own method could
 * not translate safely: keys the quality gate refused or the method returned
 * nothing for, Markdown blocks it dropped or damaged. It goes through the
 * same machinery as a pair — resolveTransportForPair for `method`/`provider`,
 * resolveModelForPair for `model` — so it is a complete pair config the sync
 * pipeline can run unchanged: its own TM key, its own cost estimate, the
 * same quality gate.
 *
 * `--method` / `--model` override the pair's OWN method only. The fallback
 * resolves against what the config FILE set (config._fileModel,
 * config._fileDefaultMethod, recorded by lib/config.js before the flags
 * apply), so trying a different primary for one run never changes what
 * catches its failures.
 *
 * @param {string} pairKey - e.g. "en:crk" (named in every error)
 * @param {object} raw - The `fallback` object as written in the config
 * @param {object} pair - The resolved pair it belongs to
 * @param {object} config - Resolved config
 * @param {string} [projectDir] - What a relative coachingFile is relative to
 * @returns {object|null} Resolved fallback pair config, or null when a CLI
 *   override made the pair's own method identical to its fallback
 * @throws {Error} On a malformed fallback — always naming the pair
 */
function resolveFallbackForPair(pairKey, raw, pair, config, projectDir = process.cwd()) {
  const where = `${pairKey}: "fallback"`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(
      `${where} must be an object naming a method, e.g. "fallback": { "method": "llm-coached" } `
      + `(got ${JSON.stringify(raw)}).`
    );
  }
  for (const [field, why] of Object.entries(FALLBACK_REFUSED)) {
    if (Object.prototype.hasOwnProperty.call(raw, field)) {
      throw new Error(`${where} cannot set "${field}": ${why}.`);
    }
  }
  const unknown = Object.keys(raw).filter(k => !k.startsWith('_') && !FALLBACK_FIELDS.has(k));
  if (unknown.length > 0) {
    noteOnce('warn',
      `${where}: field(s) ${unknown.map(k => `"${k}"`).join(', ')} have no effect on a fallback. `
      + `A fallback accepts: ${[...FALLBACK_FIELDS].join(', ')}.`
    );
  }
  if (typeof raw.method !== 'string' || raw.method.trim() === '') {
    throw new Error(
      `${where} needs a "method" — the method that translates what the pair's own method `
      + `(${pair.method}) cannot, e.g. "fallback": { "method": "llm-coached" }.`
    );
  }
  assertKnownMethod(raw.method, where);

  // The FILE's model and default method, not the --model/--method override.
  const fileModel = (config._modelOverride ? config._fileModel : config.model) || DEFAULT_OPENROUTER_MODEL;
  const fileModelExplicit = config._modelOverride ? !!config._fileModelExplicit : !!config._modelExplicit;
  const fileDefaultMethod = config._methodOverride ? config._fileDefaultMethod : config.defaultMethod;
  const globalProvider = config.provider == null ? null : normalizeProvider(config.provider);

  let method;
  let provider;
  try {
    ({ method, provider } = resolveTransportForPair(raw.method, raw.provider, config.provider));
  } catch (err) {
    throw new Error(`${where}: ${err.message}`);
  }
  const providerModel = fileModelExplicit && (
    (provider && provider !== 'openrouter' && provider === globalProvider)
    || (method === fileDefaultMethod && DIRECT_PROVIDER_METHODS.has(method))
  ) ? fileModel : null;
  const model = resolveModelNamed(where, raw.model ? 'from the fallback\'s "model"' : 'from the top-level "model"', raw.model, method, fileModel, provider, providerModel);

  // Start from the pair (the language's facts and settings), drop what
  // belongs to the pair's own method, then apply the fallback's fields.
  const fallback = { ...pair };
  delete fallback.fallback;
  const _defaults = new Set();
  for (const field of FALLBACK_INHERITED) {
    if (raw[field] != null) fallback[field] = raw[field];
    else _defaults.add(field);
  }
  if (raw.model == null) _defaults.add('model');
  if (raw.register != null) {
    // Same preset-key rule as a pair-level register (see resolvePairs).
    const card = getLanguageCard(pair.target);
    fallback.registerPreset = card?.registers?.[raw.register] != null ? raw.register : null;
  }
  Object.assign(fallback, {
    method,
    provider,
    model,
    endpoint: raw.endpoint || null,
    // Its own token, never the pair's: a fallback endpoint is another server.
    apiKey: raw.apiKey || null,
    methodPlugin: raw.methodPlugin || null,
    // Its own declaration too (another endpoint): unknown unless stated.
    acceptsInstructions: typeof raw.acceptsInstructions === 'boolean' ? raw.acceptsInstructions : null,
    isFallback: true,
    _defaults,
  });

  // Its own coaching file: read, so its prompt and its cache key carry the
  // text (readOwnCoachingFile). Its own coachingPrompt wins, as on a pair.
  fallback._legacyCoachingPrompt = raw.coachingPrompt ?? pair._legacyCoachingPrompt ?? null;
  if (raw.coachingFile != null && raw.coachingPrompt == null) {
    fallback.coachingPrompt = readOwnCoachingFile(raw.coachingFile, projectDir, where);
  }
  fallback._legacyCoachingSent = legacyCoachingSent(
    fallback, fallback._legacyCoachingPrompt, raw.coachingPrompt == null ? (raw.coachingFile ?? null) : null, projectDir,
  );

  // A fallback identical to its pair would only repeat the same translation.
  // Identity is what the TM keys on (method, model — or an api pair's
  // endpoint — register, coaching) plus the transport and temperature.
  const sameAs = tmMethodKey(fallback) === tmMethodKey(pair)
    && ['provider', 'temperature'].every(f => (fallback[f] ?? null) === (pair[f] ?? null));
  if (sameAs) {
    if (config._methodOverride || config._modelOverride) {
      noteOnce('info',
        `${pairKey}: --method/--model made the pair's own method the same as its fallback `
        + `(${method}${model ? `, ${model}` : ''}) — no fallback this run.`
      );
      return null;
    }
    throw new Error(
      `${where} is the same method as the pair itself (${method}${model ? `, model ${model}` : ''}) — `
      + 'it would only repeat the same translation. Name a different method or model.'
    );
  }
  return fallback;
}

/**
 * The gender guidance a pair's prompt carries, and where it comes from. The
 * default is the catalogue's for the language (shared/catalogue/gender-
 * guidance.json — French: écriture inclusive with the interpunct,
 * "Connecté·e"); a config can replace it with its own instruction or turn it
 * off with `false` — per pair, per language, or for every language. Never
 * changed silently: absent means the catalogue's, as before (Round 8, Django
 * persona: the French prompt asked for écriture inclusive and nothing showed it).
 *
 * @param {Array<*>} settings - The config values in precedence order (pair, language, global)
 * @param {string|null} catalogue - The card's guidance (getLanguageCard().gender.inclusiveGuidance)
 * @returns {{ genderGuidance: string|null, genderGuidanceSource: 'config'|'off'|'catalogue'|null }}
 */
function resolveGenderGuidance(settings, catalogue) {
  for (const v of settings) {
    if (v === false) return { genderGuidance: null, genderGuidanceSource: 'off' };
    if (typeof v === 'string' && v.trim()) return { genderGuidance: v.trim(), genderGuidanceSource: 'config' };
  }
  return catalogue ? { genderGuidance: catalogue, genderGuidanceSource: 'catalogue' } : { genderGuidance: null, genderGuidanceSource: null };
}

/**
 * Resolve the full pair graph from config.
 *
 * Returns a Map of pairKey → pairConfig, where each pairConfig contains:
 *   - source:      source locale code (e.g., "en")
 *   - target:      target locale code (e.g., "fr")
 *   - method:      translation method name (e.g., "llm", "llm-coached")
 *   - model:       model identifier (e.g., "openai/gpt-4o-mini")
 *   - qualityTier: one of QUALITY_TIERS keys
 *   - batchSize:   keys per API batch
 *   - register:    target language register (tone/style instructions)
 *   - name:        target language display name
 *   - dir:         text directionality ('ltr' or 'rtl')
 *   - scripts:     available script conversions (if any)
 *   - endpoint:    API endpoint URL for the bare "api" method (if set)
 *   - fallback:    (only when configured) a full pair config for the second
 *                  method that translates what this one cannot translate
 *                  safely — see resolveFallbackForPair
 *
 * Pair keys use colon separator: "en:fr", "en:crk".
 * Legacy arrow formats (en→fr, en->fr) in config.pairs are accepted
 * by parsePairKey but stored internally in colon format.
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config (post-migration, post-defaults)
 * @param {{ cwd?: string }} [options] - cwd: the project directory a pair's,
 *   language's or fallback's own coachingFile is relative to (the directory
 *   resolveConfig read the config in; the CLI's working directory by default)
 * @returns {Map<string, import('./types.js').PairConfig>} Pair graph
 */
function resolvePairs(config, { cwd = process.cwd() } = {}) {
  const pairs = new Map();
  const inputLocale = config.inputLocale;
  const defaultModel = config.model || DEFAULT_OPENROUTER_MODEL;
  const defaultBatchSize = config.batchSize || DEFAULT_BATCH_SIZE;
  const defaultMethod = config.defaultMethod || PAIR_DEFAULTS.method;

  // A top-level `model` written next to a top-level direct `provider` names a
  // model ON that provider (the harness export-config shape). Without an
  // explicit top-level model, config.model is the OpenRouter default slug and
  // must never be sent to a direct provider.
  const globalProvider = config.provider == null ? null : normalizeProvider(config.provider);
  // An explicit global model belongs to the global transport: the global
  // provider, or the default METHOD when that is a direct one. Without the
  // second case, `defaultMethod: "local"` + `model: "stub-1"` ran every pair
  // on the local method's fallback model (llama3.1) — and the cache key
  // carried no model, so a model switch went unnoticed (synthetic review).
  const providerModelFor = (provider, method = null) => (
    config._modelExplicit && (
      (provider && provider !== 'openrouter' && provider === globalProvider)
      || (method && method === config.defaultMethod && DIRECT_PROVIDER_METHODS.has(method))
    )
      ? defaultModel
      : null
  );

  // The UNRESOLVED method/provider/model each pair was configured with. Step 1
  // may rewrite `llm` to a direct provider's method and fill the model from a
  // default; a Step-2 override that changes the transport must re-derive from
  // what the user wrote, not from those resolved values.
  const rawSettings = new Map();

  // Step 1: Build pairs from the `languages` array (simple mode)
  const languages = config.resolvedLanguages || {};
  for (const [code, langConfig] of Object.entries(languages)) {
    const pairKey = buildPairKey(inputLocale, code);
    // Use language card for structured metadata (formality, gender, script).
    // Falls back to backward-compat proxy for languages without cards.
    const card = getLanguageCard(code);
    const registerInfo = DEFAULT_REGISTERS[code] || {};

    // Resolution order: language config > global config > defaults.
    // Language-level fields (model, batchSize, maxRetries, script) set
    // per-language defaults without requiring the verbose `pairs` syntax.
    //
    // _defaults tracks which fields were filled from system defaults rather
    // than explicitly set by the user. resolvePluginForPair uses this to
    // let plugin config override defaults while respecting explicit settings.
    const _defaults = new Set();
    // A language's own model/provider belong to its own method: when
    // --method overrides that method they go with it (--model still applies).
    const langOverridden = Boolean(config._methodOverride && langConfig.method
      && langConfig.method !== config._methodOverride);
    let method;
    let provider;
    try {
      ({ method, provider } = resolveTransportForPair(
        config._methodOverride || langConfig.method || defaultMethod,
        langOverridden ? null : langConfig.provider, config.provider,
      ));
    } catch (err) {
      err.message = `${pairKey}: ${err.message}`;
      throw err;
    }
    const langModel = config._modelOverride || (langOverridden ? undefined : langConfig.model);
    const model = resolveModelNamed(pairKey, modelSource(config, [[`languages.${code}.model`, langModel]]),
      langModel, method, defaultModel, provider, providerModelFor(provider, method));
    rawSettings.set(pairKey, {
      method: config._methodOverride || langConfig.method || defaultMethod,
      provider: langOverridden ? null : (langConfig.provider ?? null),
      model: langModel || null,
      // The language's `fallback`, resolved in Step 4 (after the script
      // decision, which a fallback shares with its pair).
      fallback: langConfig.fallback ?? null,
      // The coaching this language names for itself (read in Step 3b).
      coaching: langConfig.coachingFile != null || langConfig.coachingPrompt != null
        ? { file: langConfig.coachingFile ?? null, prompt: langConfig.coachingPrompt ?? null, where: `languages.${code}` }
        : null,
    });
    if (!langModel) _defaults.add('model');
    const batchSize = langConfig.batchSize || defaultBatchSize;
    if (!langConfig.batchSize) _defaults.add('batchSize');
    const register = langConfig.register || registerInfo.register || DEFAULT_REGISTER_FALLBACK;
    if (!langConfig.register) _defaults.add('register');
    // A language entry sets no quality tier: the pair's is the default
    // label, not one anybody chose (status shows only a chosen one).
    _defaults.add('qualityTier');

    // Track fields from system defaults so plugins can override them.
    // If the user didn't explicitly set these, they're defaults.
    const temperature = langConfig.temperature ?? config.temperature ?? null;
    if (langConfig.temperature == null) _defaults.add('temperature');
    const coachingFile = langConfig.coachingFile ?? config.coachingFile ?? null;
    if (langConfig.coachingFile == null) _defaults.add('coachingFile');
    const coachingPrompt = langConfig.coachingPrompt ?? config.coachingPrompt ?? null;
    if (langConfig.coachingPrompt == null) _defaults.add('coachingPrompt');
    const promptContext = langConfig.promptContext ?? config.promptContext ?? null;
    if (langConfig.promptContext == null) _defaults.add('promptContext');
    const contentSegmentation = langConfig.contentSegmentation ?? config.contentSegmentation ?? null;
    if (langConfig.contentSegmentation == null) _defaults.add('contentSegmentation');

    pairs.set(pairKey, {
      source: inputLocale,
      target: code,
      method,
      // Transport for llm-coached (dispatches on it) and the record of which
      // provider a rewritten `llm` pair runs on. null for engine methods.
      provider,
      model,
      qualityTier: PAIR_DEFAULTS.qualityTier,
      batchSize,
      maxRetries: langConfig.maxRetries ?? PAIR_DEFAULTS.maxRetries,
      register,
      // Preset key name for consumers that need to look up preset-specific
      // metadata (e.g., DeepL formality mapping). null means custom text.
      registerPreset: langConfig.registerPreset || null,
      name: langConfig.name || registerInfo.name || code,
      // textDirection is the projected CLDR fact; `dir` was the old field name.
      dir: (card?.textDirection === 'right-to-left' ? 'rtl' : null)
        || card?.dir || registerInfo.dir || 'ltr',
      scripts: card?.scriptConverter || registerInfo.scripts || null,
      script: langConfig.script || null,
      scriptFallback: langConfig.scriptFallback || null,
      // Pair-level API endpoint for the bare "api" method (no plugin manifest).
      // APIMethod falls back to pairConfig.endpoint — dropping it during
      // normalization made { method: "api", endpoint: … } configs unusable.
      endpoint: langConfig.endpoint || null,
      // The api endpoint's own token (lib/methods/api.js resolveApiMethodKey:
      // "${VAR}" or a literal). Documented, but dropped here until 2026-10-03.
      apiKey: langConfig.apiKey || null,
      // Does the api endpoint follow per-key instructions? true / false as
      // declared (pair or plugin manifest); null = unknown (lib/methods/api.js).
      acceptsInstructions: typeof langConfig.acceptsInstructions === 'boolean' ? langConfig.acceptsInstructions : null,
      // Structured formality info for method-specific behavior (e.g., DeepL)
      formalitySystem: card?.formality?.system || null,
      // Language-specific gender guidance for LLM prompts (e.g., écriture
      // inclusive for French) — the catalogue's, unless the config replaces
      // or turns it off ("genderGuidance").
      ...resolveGenderGuidance([langConfig.genderGuidance, config.genderGuidance], card?.gender?.inclusiveGuidance || null),
      // Global prompt context from config (e.g., "This is a developer tool README")
      promptContext,
      protectedTerms: config.protectedTerms || [],
      // Temperature: per-language → global config → null (method picks its own default)
      temperature,
      // Coaching: coaching file path and resolved prompt text
      coachingFile,
      coachingPrompt,
      // Markdown body translation granularity ('block' | 'page') — consumed
      // by docusaurus-sync.js Phase 2 (validated there, fail-loud).
      contentSegmentation,
      _defaults,
    });
  }

  // Step 2: Apply overrides from `pairs` object (advanced mode)
  // These can override simple-mode pairs or add entirely new ones
  if (config.pairs && typeof config.pairs === 'object') {
    for (const [rawPairKey, pairOverride] of Object.entries(config.pairs)) {
      const { source: rawSource, target: rawTarget } = parsePairKey(rawPairKey);
      if (!rawSource || !rawTarget) {
        console.error(`[ERR] Invalid pair key "${rawPairKey}" — expected format "source:target" (e.g., "en:fr")`);
        continue;
      }

      // Preserve the user's raw locale code as `target` — this determines
      // file paths and must match the user's framework (e.g., Docusaurus
      // expects `i18n/fil/`, not `i18n/tl/`).
      //
      // BUG FIX: Previously, resolveCode() replaced the target entirely
      // (fil→tl), causing translations to be written to directories that
      // the user's framework couldn't find.
      //
      // We don't need a separate canonical code because getLanguageCard()
      // and DEFAULT_REGISTERS already resolve aliases internally — passing
      // 'fil' to getLanguageCard() correctly returns the Tagalog card.
      //
      // IMPORTANT: Use rawSource directly, not resolveCode(rawSource).
      // Step 1 builds keys from the raw inputLocale (e.g., 'en'). If we
      // resolve source here (e.g., 'en' → 'eng'), the key won't match
      // and the override won't apply to the Step 1 pair.
      const source = rawSource;
      const target = rawTarget;
      const pairKey = buildPairKey(source, target);
      const card = getLanguageCard(target);
      const registerInfo = DEFAULT_REGISTERS[target] || {};
      const existing = pairs.get(pairKey) || {};
      const existingDefaults = existing._defaults || new Set();
      const raw = rawSettings.get(pairKey) || {};

      // _defaults: a field is "defaulted" if NEITHER the pairOverride NOR
      // the existing pair set it explicitly. If pairOverride sets a field,
      // it clears the default flag; if it falls through to existing, it
      // inherits that pair's default tracking.
      const _defaults = new Set();
      // Transport + model re-derive from the RAW settings (see rawSettings):
      // re-resolving from existing.method/existing.model would treat a
      // rewritten method or a defaulted model as if the user had written it.
      // The pair's own model/provider belong to its own method: when
      // --method overrides that method they go with it (--model still applies).
      const pairOverridden = Boolean(config._methodOverride && pairOverride.method
        && pairOverride.method !== config._methodOverride);
      let resolvedMethod;
      let provider;
      try {
        ({ method: resolvedMethod, provider } = resolveTransportForPair(
          config._methodOverride || pairOverride.method || raw.method || defaultMethod,
          pairOverridden ? null : (pairOverride.provider ?? raw.provider),
          config.provider,
        ));
      } catch (err) {
        err.message = `${pairKey}: ${err.message}`;
        throw err;
      }
      const pairModel = config._modelOverride
        || (pairOverridden ? undefined : (pairOverride.model || raw.model));
      rawSettings.set(pairKey, {
        method: config._methodOverride || pairOverride.method || raw.method || defaultMethod,
        provider: pairOverridden ? null : (pairOverride.provider ?? raw.provider ?? null),
        model: pairModel || null,
        // A pair-level `fallback` replaces the language's; `null` removes it.
        fallback: Object.prototype.hasOwnProperty.call(pairOverride, 'fallback')
          ? pairOverride.fallback
          : (raw.fallback ?? null),
        // The most specific level that names coaching (read in Step 3b).
        coaching: pairOverride.coachingFile != null || pairOverride.coachingPrompt != null
          ? { file: pairOverride.coachingFile ?? null, prompt: pairOverride.coachingPrompt ?? null, where: `pairs["${rawPairKey}"]` }
          : (raw.coaching ?? null),
      });
      const model = resolveModelNamed(
        pairKey,
        modelSource(config, [[`pairs["${rawPairKey}"].model`, pairModel && pairOverride.model], [`languages.${rawTarget}.model`, pairModel]]),
        pairModel,
        resolvedMethod,
        defaultModel,
        provider,
        providerModelFor(provider, resolvedMethod),
      );
      if (!pairOverride.model && existingDefaults.has('model')) _defaults.add('model');
      if (!pairOverride.qualityTier && (existingDefaults.has('qualityTier') || !existing.qualityTier)) _defaults.add('qualityTier');
      if (!pairOverride.model && !existing.model) _defaults.add('model');
      const batchSize = pairOverride.batchSize || existing.batchSize || defaultBatchSize;
      if (!pairOverride.batchSize && existingDefaults.has('batchSize')) _defaults.add('batchSize');
      if (!pairOverride.batchSize && !existing.batchSize) _defaults.add('batchSize');
      const register = pairOverride.register || existing.register || registerInfo.register || DEFAULT_REGISTER_FALLBACK;
      if (!pairOverride.register && existingDefaults.has('register')) _defaults.add('register');
      if (!pairOverride.register && !existing.register) _defaults.add('register');

      // Track temperature, coaching, and context fields for plugin override resolution
      const temperature = pairOverride.temperature ?? existing.temperature ?? config.temperature ?? null;
      if (pairOverride.temperature == null && existingDefaults.has('temperature')) _defaults.add('temperature');
      if (pairOverride.temperature == null && existing.temperature == null) _defaults.add('temperature');
      const coachingFile = pairOverride.coachingFile ?? existing.coachingFile ?? config.coachingFile ?? null;
      if (pairOverride.coachingFile == null && existingDefaults.has('coachingFile')) _defaults.add('coachingFile');
      if (pairOverride.coachingFile == null && !existing.coachingFile) _defaults.add('coachingFile');
      const coachingPrompt = pairOverride.coachingPrompt ?? existing.coachingPrompt ?? config.coachingPrompt ?? null;
      if (pairOverride.coachingPrompt == null && existingDefaults.has('coachingPrompt')) _defaults.add('coachingPrompt');
      if (pairOverride.coachingPrompt == null && !existing.coachingPrompt) _defaults.add('coachingPrompt');
      const promptContext = pairOverride.promptContext ?? existing.promptContext ?? config.promptContext ?? null;
      if (pairOverride.promptContext == null && existingDefaults.has('promptContext')) _defaults.add('promptContext');
      if (pairOverride.promptContext == null && !existing.promptContext) _defaults.add('promptContext');
      const contentSegmentation = pairOverride.contentSegmentation ?? existing.contentSegmentation ?? config.contentSegmentation ?? null;
      if (pairOverride.contentSegmentation == null && existingDefaults.has('contentSegmentation')) _defaults.add('contentSegmentation');
      if (pairOverride.contentSegmentation == null && !existing.contentSegmentation) _defaults.add('contentSegmentation');

      // Resolve the preset key for this pair. If the pair override specifies
      // a register value, check if it's a known preset key (for DeepL, etc.).
      // Otherwise inherit from the existing pair's preset tracking.
      let registerPreset = existing.registerPreset || null;
      if (pairOverride.register) {
        // Check if the override is a preset key we should resolve
        const isPresetKey = card?.registers?.[pairOverride.register] != null;
        registerPreset = isPresetKey ? pairOverride.register : null;
      }

      pairs.set(pairKey, {
        source,
        target,
        method: resolvedMethod,
        provider,
        model,
        qualityTier: pairOverride.qualityTier || existing.qualityTier || PAIR_DEFAULTS.qualityTier,
        batchSize,
        maxRetries: pairOverride.maxRetries ?? existing.maxRetries ?? PAIR_DEFAULTS.maxRetries,
        register,
        registerPreset,
        name: pairOverride.name || existing.name || registerInfo.name || target,
        dir: (card?.textDirection === 'right-to-left' ? 'rtl' : null)
          || card?.dir || existing.dir || registerInfo.dir || 'ltr',
        scripts: card?.scriptConverter || existing.scripts || registerInfo.scripts || null,
        script: pairOverride.script || existing.script || null,
        scriptFallback: pairOverride.scriptFallback || existing.scriptFallback || null,
        // Pair-level API endpoint for the bare "api" method (no plugin manifest).
        // Preserved so APIMethod's documented pairConfig.endpoint fallback works.
        endpoint: pairOverride.endpoint || existing.endpoint || null,
        apiKey: pairOverride.apiKey || existing.apiKey || null,
        acceptsInstructions: typeof pairOverride.acceptsInstructions === 'boolean'
          ? pairOverride.acceptsInstructions
          : (typeof existing.acceptsInstructions === 'boolean' ? existing.acceptsInstructions : null),
        // Plugin reference — the plugin loader will merge its config into this pair
        methodPlugin: pairOverride.methodPlugin || null,
        formalitySystem: card?.formality?.system || existing.formalitySystem || null,
        ...(pairOverride.genderGuidance !== undefined && pairOverride.genderGuidance !== null
          ? resolveGenderGuidance([pairOverride.genderGuidance], card?.gender?.inclusiveGuidance || null)
          : existing.genderGuidanceSource
            ? { genderGuidance: existing.genderGuidance || null, genderGuidanceSource: existing.genderGuidanceSource }
            : resolveGenderGuidance([config.genderGuidance], card?.gender?.inclusiveGuidance || existing.genderGuidance || null)),
        // Global prompt context flows from config into every pair
        promptContext,
      protectedTerms: config.protectedTerms || [],
        temperature,
        // Coaching: coaching file path and resolved prompt text
        coachingFile,
        coachingPrompt,
        // Markdown body translation granularity ('block' | 'page')
        contentSegmentation,
        _defaults,
      });
    }
  }

  // Step 3: Script resolution — ONE decision per pair, attached here so every
  // consumer (sync, serve, docusaurus, status, integrity, repair-script)
  // reads the same answer, and an invalid `script:` or `scriptFallback` fails
  // at pair-graph build time — before preflight, before any API spend, and in
  // --dry runs too. The choice-required state (crk/sr-class dual real
  // orthographies) is NOT a throw here: read-only lanes may proceed and
  // display it; the translation lanes refuse in resolveRuntime.
  for (const [pairKey, pc] of pairs) {
    const card = getLanguageCard(pc.target);
    try {
      pc.scriptResolution = resolveTargetScript(pc.target, pc, card);
      if (pc.scriptFallback != null) {
        const registered = converterKeyForLocale(pc.target, card);
        if (!registered) {
          throw new Error(
            `"scriptFallback" has no effect for ${pc.target} — no script converter is registered for this locale.`
          );
        }
        validateScriptFallback(pc.scriptFallback, registered);
      }
    } catch (err) {
      err.message = `${pairKey}: ${err.message}`;
      throw err;
    }
  }

  // Step 3b: Coaching text — the most specific level that names coaching
  // (pair, then language, then the top level) decides it: its inline
  // coachingPrompt, else its own coachingFile, read here (readOwnCoachingFile).
  // A language's or pair's coachingFile used to lose to a less specific
  // level's text, and never reached a plain LLM method at all.
  for (const [pairKey, pc] of pairs) {
    const own = rawSettings.get(pairKey)?.coaching || null;
    pc._legacyCoachingPrompt = pc.coachingPrompt ?? null;
    const ownFile = own && own.prompt == null && own.file != null ? own.file : null;
    if (ownFile) {
      pc.coachingPrompt = readOwnCoachingFile(ownFile, cwd, `${pairKey}: ${own.where}`);
      pc._defaults?.delete('coachingPrompt');
    }
    pc._legacyCoachingSent = legacyCoachingSent(pc, pc._legacyCoachingPrompt, ownFile, cwd);
  }

  // Step 4: Fallbacks — the second method for what a pair's own method
  // cannot translate safely. Resolved last so a fallback inherits the
  // pair's final settings, script decision included. Errors name the pair.
  for (const [pairKey, pc] of pairs) {
    const rawFallback = rawSettings.get(pairKey)?.fallback;
    if (rawFallback == null) continue;
    const fallback = resolveFallbackForPair(pairKey, rawFallback, pc, config, cwd);
    if (fallback) pc.fallback = fallback;
  }

  return pairs;
}

/**
 * Parse a pair key into its source and target components.
 *
 * Supports three separator formats (checked in this order):
 *   1. ":"  — canonical format (e.g., "en:fr")
 *   2. "→" — legacy Unicode arrow (e.g., "en→fr")
 *   3. "->" — legacy ASCII arrow (e.g., "en->fr")
 *
 * WHY colon: Compact, ASCII-safe, and unambiguous — no locale code
 * contains a colon, unlike underscores (pt_BR) or hyphens (zh-TW).
 * Legacy arrow formats are accepted for backward compatibility with
 * existing configs.
 *
 * @param {string} pairKey - Pair key to parse
 * @returns {{ source: string|null, target: string|null }}
 */
function parsePairKey(pairKey) {
  // Canonical colon first, then legacy arrow formats
  const separators = [':', '→', '->'];
  for (const sep of separators) {
    const idx = pairKey.indexOf(sep);
    if (idx !== -1) {
      const source = pairKey.slice(0, idx).trim();
      const target = pairKey.slice(idx + sep.length).trim();
      if (source && target) {
        return { source, target };
      }
    }
  }
  return { source: null, target: null };
}

/**
 * Build a pair key from source and target locale codes.
 *
 * Uses the canonical colon separator format.
 *
 * @param {string} source - Source locale code
 * @param {string} target - Target locale code
 * @returns {string} Pair key (e.g., "en:fr")
 */
function buildPairKey(source, target) {
  return `${source}:${target}`;
}

/**
 * Filter a resolved pair graph down to the pair(s) named by `--pair`.
 *
 * Accepts a comma-separated list. Each entry is matched against the
 * CONFIGURED pair graph — a value that doesn't name a configured pair is a
 * hard error, never a silent no-op: translating every locale when the user
 * asked for one is a money trap, and translating none is a silent failure.
 *
 * Accepted spellings per entry:
 *   - "en:fr"  — canonical (also legacy "en→fr" / "en->fr")
 *   - "en>fr"  — the leaderboard's separator, normalized here
 *   - "en-fr"  — docs shorthand; resolved by trying every hyphen split
 *                against the configured pairs (so "en-pt-BR" works too),
 *                accepted only when exactly one configured pair matches
 *
 * @param {string} rawFlag - The raw --pair value (e.g. "en:fr,en:de")
 * @param {Map<string, object>} pairs - Configured pair graph from resolvePairs
 * @returns {Map<string, object>} New Map containing only the requested pairs
 * @throws {Error} On a malformed entry or an entry naming no configured pair
 */
function filterPairGraph(rawFlag, pairs) {
  const configured = [...pairs.keys()].sort();
  const configuredList = configured.length > 0 ? configured.join(', ') : '(none)';

  const fail = (badValue, why) => {
    const lines = [
      '',
      '  ┌─ UNKNOWN PAIR ──────────────────────────────────────────────────┐',
      '  │ --pair names a pair this project does not configure.            │',
      '  └──────────────────────────────────────────────────────────────────┘',
      '',
      `  ✗ --pair ${badValue}: ${why}`,
      '',
      `  Configured pairs: ${configuredList}`,
      '',
      '  Next steps:',
      '    1. Pick a configured pair:  champollion sync --pair ' + (configured[0] || 'en:fr'),
      '    2. Or add the pair to champollion.config.json ("languages" or "pairs").',
    ];
    throw new Error(lines.join('\n'));
  };

  const specs = String(rawFlag).split(',').map(s => s.trim()).filter(Boolean);
  if (specs.length === 0) {
    fail(JSON.stringify(rawFlag), 'empty value — expected "source:target" (e.g. en:fr)');
  }

  const selected = new Map();
  for (const spec of specs) {
    // Canonical + legacy separators first; ">" (the leaderboard separator)
    // normalized to the canonical colon before parsing.
    const { source, target } = parsePairKey(spec.replace('>', ':'));
    let key = source && target ? buildPairKey(source, target) : null;

    if (key && !pairs.has(key)) {
      fail(spec, `"${key}" is not in the configured pair graph`);
    }

    if (!key) {
      // Docs shorthand "en-fr": hyphens are ambiguous (pt-BR), so try every
      // split and accept only an exact, unique match against configured pairs.
      const candidates = [];
      for (let i = spec.indexOf('-'); i !== -1; i = spec.indexOf('-', i + 1)) {
        const candidate = buildPairKey(spec.slice(0, i).trim(), spec.slice(i + 1).trim());
        if (pairs.has(candidate) && !candidates.includes(candidate)) candidates.push(candidate);
      }
      if (candidates.length === 1) {
        key = candidates[0];
      } else if (candidates.length > 1) {
        fail(spec, `ambiguous — matches ${candidates.join(' and ')}; use the colon form`);
      } else {
        fail(spec, 'does not match any configured pair — expected "source:target" (e.g. en:fr)');
      }
    }

    selected.set(key, pairs.get(key));
  }

  return selected;
}

/**
 * Get all target locale codes from a pair graph.
 *
 * @param {Map<string, object>} pairs - Pair graph
 * @returns {string[]} Unique target locale codes
 */
function getTargetLocales(pairs) {
  const targets = new Set();
  for (const pair of pairs.values()) {
    targets.add(pair.target);
  }
  return [...targets];
}

/**
 * Get the pair config for a specific target locale.
 * Searches for any pair where the target matches the given code.
 *
 * @param {Map<string, object>} pairs - Pair graph
 * @param {string} targetCode - Target locale code
 * @returns {object|null} Pair config, or null if not found
 */
function getPairForTarget(pairs, targetCode) {
  for (const pair of pairs.values()) {
    if (pair.target === targetCode) {
      return pair;
    }
  }
  return null;
}

/**
 * Estimate the cost of translating a set of keys for a given pair.
 *
 * Delegates to the pair's configured method class. Each method knows
 * its own pricing model (or honestly returns null when it can't know).
 *
 * @param {number} keyCount - Number of keys to translate
 * @param {object} pairConfig - Pair config with method and model
 * @param {{ cwd?: string }} [context] - cwd: the project directory (a local
 *   method's endpoint may be set in its .env)
 * @returns {{ estimatedCost: number|null, currency: string, source: string, note: string }}
 */
async function estimateCost(keyCount, pairConfig, context = {}) {
  const methodName = pairConfig.method || 'llm';

  // Delegate to the method's own cost estimate.
  // WHY: We can't hardcode pricing here because each method has its own
  // pricing model (or lack thereof). Google has documented rates ($20/1M chars),
  // LLM varies by model, API is server-determined.
  try {
    const method = getMethod(methodName);
    return await method.estimateCost(keyCount, pairConfig, context);
  } catch {
    // If method resolution fails, return an honest "unknown"
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'unknown',
      note: `Could not resolve method "${methodName}" for cost estimation.`,
    };
  }
}

export {
  resolvePairs,
  resolveFallbackForPair,
  parsePairKey,
  buildPairKey,
  filterPairGraph,
  getTargetLocales,
  getPairForTarget,
  estimateCost,
  QUALITY_TIERS,
  PAIR_DEFAULTS,
};
