/**
 * Translation orchestrator — delegates to method-specific implementations.
 *
 * v3 ARCHITECTURE:
 *   In v2, this module contained all the OpenRouter API logic directly.
 *   In v3, the actual API calls live in lib/methods/llm.js (and future
 *   method implementations). This module is now the orchestrator:
 *
 *   1. Receives a pair config (from pairs.js) with method/model/qualityTier
 *   2. Instantiates the correct TranslationMethod subclass
 *   3. Delegates the translation call
 *   4. Returns the result
 *
 *   This separation means adding a new translation strategy (e.g., fst-gated,
 *   human-review) requires only implementing a new method class — zero changes
 *   to the sync pipeline or any other consumer.
 *
 * BACKWARD COMPAT:
 *   The exported API (translateBatch, translateRawContent, isUnsafeKey) is
 *   preserved so that sync.js and content.js continue to work without
 *   changes during the transition. The only difference is that translateBatch
 *   now accepts an optional pairConfig as the third argument.
 */

import { LLMMethod, buildPrompt, inferKeyTypes } from './methods/llm.js';
import { isUnsafeKey } from './security.js';
import { LLMCoachedMethod } from './methods/llm-coached.js';
import { GoogleTranslateMethod } from './methods/google-translate.js';
import { APIMethod } from './methods/api.js';
import { DeepLMethod } from './methods/deepl.js';
import { MicrosoftTranslatorMethod } from './methods/microsoft-translator.js';
import { LibreTranslateMethod } from './methods/libretranslate.js';
import { ApertiumMethod } from './methods/apertium.js';
import { TildeMethod } from './methods/tilde.js';
import { TranslatedMethod } from './methods/translated.js';
import { OpenAIMethod } from './methods/openai.js';
import { AnthropicMethod } from './methods/anthropic.js';
import { GeminiMethod } from './methods/gemini.js';
import { LocalMethod } from './methods/local.js';
import { ExternalMethod } from './methods/external.js';
import { DEFAULT_OPENROUTER_MODEL } from './config.js';
import { manifestEntries, cliNameFor } from './method-manifest.js';
import { assertRoutable } from './commercial-eligibility.js';
import { CONTENT_SEPARATOR, parseContentPrompt } from './methods/content-separator.js';
import { SEGMENT_MARKER_PREFIX, SEGMENT_MARKER_SUFFIX } from './segment.js';

/**
 * Registry of available translation methods.
 *
 * Each entry maps a method name to its constructor.
 * To add a new method:
 *   1. Create the class in lib/methods/<name>.js
 *   2. Register it here
 *   3. Users can reference it in config pairs: { method: "<name>" }
 */
const METHOD_REGISTRY = {
  'llm': LLMMethod,
  'llm-coached': LLMCoachedMethod,
  'google-translate': GoogleTranslateMethod,
  'api': APIMethod,
  'deepl': DeepLMethod,
  'microsoft-translator': MicrosoftTranslatorMethod,
  'libretranslate': LibreTranslateMethod,
  'apertium': ApertiumMethod,
  'tilde': TildeMethod,
  'translated': TranslatedMethod,
  'openai': OpenAIMethod,
  'anthropic': AnthropicMethod,
  'gemini': GeminiMethod,
  'local': LocalMethod,
  'external': ExternalMethod,
};

/**
 * ExternalMethod instances by plugin path. Each instance owns a Python bridge
 * process, so building one per call (getMethod runs for every batch, every
 * preflight, every content file) started a new process each time and never
 * stopped any. One instance per plugin is reused for the whole run and
 * stopped by shutdownMethods().
 */
const externalMethods = new Map();

/**
 * Stop every bridge process started through getMethod(). Call when a run is
 * finished; a later getMethod() starts a fresh bridge on demand.
 *
 * @returns {Promise<void>}
 */
async function shutdownMethods() {
  const instances = [...externalMethods.values()];
  externalMethods.clear();
  await Promise.all(instances.map(m => m.shutdown()));
}

/**
 * Find a shared-registry entry that exists but is NOT served in the CLI runtime.
 *
 * An entry is harness-only when it declares `runtimes` and that list excludes
 * 'cli' (e.g. amazon-translate, local-model). Matches against both the
 * canonical manifest name and the CLI alias (cli_name). Returns null when the
 * manifest is absent (standalone package) or the name is genuinely unknown.
 *
 * @param {string} methodName
 * @returns {{ name: string, entry: object } | null}
 */
function findHarnessOnlyEntry(methodName) {
  for (const [name, entry] of Object.entries(manifestEntries())) {
    if (name !== methodName && cliNameFor(name, entry) !== methodName) continue;
    if (Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli')) {
      return { name, entry };
    }
    // Found a matching entry that DOES run in the CLI — not the harness-only case.
    return null;
  }
  return null;
}

/**
 * Get a TranslationMethod instance for the given method name.
 *
 * **This is the routing-time licence gate.** Every translation in the CLI is
 * dispatched through here, so it is the one place that can refuse a route.
 * When the caller is operating a COMMERCIAL lane — a paid routing API, a
 * billed `champollion serve` deployment — a method whose licence does not
 * permit commercial use is refused before it can be instantiated, rather
 * than warned about after the fact (lib/provenance.js reports; this
 * enforces). The default lane is non-commercial and is never gated: NC and
 * copyleft engines are legitimate there, and that is the open project.
 *
 * The lane comes from the pair config (`useContext`), so it travels with the
 * route rather than being global state.
 *
 * @param {string} methodName - Method name from pair config
 * @param {import('./types.js').PairConfig} [pluginContext] - Plugin context for API methods
 * @returns {import('./methods/base.js').TranslationMethod} Method instance
 * @throws {CommercialRouteBlockedError} when the lane is commercial and the
 *   method is not cleared for it
 */
function getMethod(methodName, pluginContext) {
  // Gate FIRST: an ineligible method must be refused on licence grounds, not
  // on "unknown method", and must never reach construction.
  assertRoutable(methodName, {
    useContext: pluginContext?.useContext,
    pluginProvenance: pluginContext?.pluginProvenance,
  });

  const MethodClass = METHOD_REGISTRY[methodName];
  if (!MethodClass) {
    // Before declaring it unknown (which reads like a typo), check whether this
    // is a real, documented engine that simply has no CLI adapter yet. Engines
    // such as `amazon-translate` and `local-model` are declared harness-only in
    // the shared method registry (runtimes: ["harness"]). Surfacing them as
    // "Unknown method" misleads the user into thinking they misspelled it.
    const harnessOnly = findHarnessOnlyEntry(methodName);
    if (harnessOnly) {
      throw new Error(
        `Translation engine "${methodName}" is harness-only — it has no CLI ` +
        `adapter yet, so \`champollion\` cannot run it. Run it with the ` +
        `evaluation harness instead:\n` +
        `  mt-eval run --method ${methodName}`
      );
    }
    const known = Object.keys(METHOD_REGISTRY).join(', ');
    throw new Error(
      `Unknown translation method "${methodName}". ` +
      `Available methods: ${known}. ` +
      `Check your champollion.config.json pairs configuration.`
    );
  }

  // APIMethod needs plugin context (endpoint, provenance, quality tier)
  if (methodName === 'api' && pluginContext) {
    return new MethodClass({
      endpoint: pluginContext.endpoint,
      methodName: pluginContext.pluginName,
      methodVersion: pluginContext.pluginVersion,
      qualityTier: pluginContext.qualityTier,
      provenance: pluginContext.pluginProvenance,
      acceptsInstructions: pluginContext.acceptsInstructions,
    });
  }

  // LLMCoachedMethod needs the pair's transport so preflight checks the
  // credential the run will actually use (OPENAI_API_KEY, not OpenRouter's).
  if (methodName === 'llm-coached') {
    return new MethodClass({ provider: pluginContext?.provider });
  }

  // ExternalMethod needs methodPath to find the Python plugin directory.
  // Shared per plugin so the run reuses one bridge process (see above).
  if (methodName === 'external') {
    const methodPath = pluginContext?.methodPath || null;
    if (!methodPath) return new MethodClass({ methodPath });
    let instance = externalMethods.get(methodPath);
    if (!instance) {
      instance = new MethodClass({ methodPath });
      externalMethods.set(methodPath, instance);
    }
    return instance;
  }

  return new MethodClass();
}

/**
 * Translate a batch of key-value pairs using the method specified in the pair config.
 *
 * @param {string[]} keys - Flat dot-notation keys to translate
 * @param {object} sourceFlat - Full flattened source locale
 * @param {import('./types.js').PairConfig} pairConfig - Pair config with method, model, register, etc.
 * @param {object} options - { apiKey, model, batchSize }
 * @returns {object|null} Map of key → translated value, or null
 */
async function translateBatch(keys, sourceFlat, pairConfig, options) {
  const method = getMethod(pairConfig.method || 'llm', pairConfig);
  return method.translate(keys, sourceFlat, pairConfig, options);
}

/**
 * Translate freeform text content (e.g., Markdown body).
 *
 * @param {string} prompt - Complete translation prompt
 * @param {object} options - { apiKey, model } or { apiKey, pairConfig }
 * @returns {string|null} Translated text, or null on failure
 */
async function translateRawContent(prompt, options) {
  const pairConfig = options.pairConfig || {
    model: options.model || DEFAULT_OPENROUTER_MODEL,
    method: 'llm',
  };

  // Pass the pair config as plugin context so methods that need it
  // (api → endpoint, external → methodPath) are constructed the same
  // way here as on the key-value path in translateBatch.
  const method = getMethod(pairConfig.method, pairConfig);
  if (method.translatesRawText) {
    return translateBlocksForRawTextEngine(method, prompt, pairConfig, options);
  }
  return method.translateContent(prompt, pairConfig, options);
}

/**
 * A raw-text engine gets only Markdown, one block at a time.
 *
 * Those engines read the body after "\n---\n"; the default BLOCK-batch
 * prompt has no such separator, so they were sent — and billed for — the
 * whole LLM instruction prompt with every block in it, and the ⟦SEG_N⟧
 * markers survived only by luck (found 2026-10-03). Each block now goes as
 * its own page-shaped prompt and the reply is reassembled under its marker;
 * a block the engine fails is simply absent, which the content gate reports.
 */
async function translateBlocksForRawTextEngine(method, prompt, pairConfig, options) {
  const request = parseContentPrompt(prompt);
  if (!request) return null; // nothing but instructions — never send those
  if (request.mode === 'page') {
    return method.translateContent(`${CONTENT_SEPARATOR}${request.keys.body}`, pairConfig, options);
  }
  const translated = new Map();
  const queue = [...request.ids];
  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      const text = request.keys[`segment.${id}`];
      if (!text || !text.trim()) { translated.set(id, text ?? ''); continue; }
      const out = await method.translateContent(`${CONTENT_SEPARATOR}${text}`, pairConfig, options);
      if (typeof out === 'string') translated.set(id, out);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, request.ids.length) }, worker));
  const parts = request.ids
    .filter((id) => translated.has(id))
    .map((id) => `${SEGMENT_MARKER_PREFIX}${id}${SEGMENT_MARKER_SUFFIX}\n${translated.get(id)}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

export { translateBatch, translateRawContent, translateBlocksForRawTextEngine, buildPrompt, isUnsafeKey, inferKeyTypes, getMethod, shutdownMethods, METHOD_REGISTRY };
