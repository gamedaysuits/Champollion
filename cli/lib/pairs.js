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
import { getMethod } from './translate.js';
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_BATCH_SIZE, DEFAULT_MAX_RETRIES } from './config.js';

/**
 * Quality tiers — define the expected reliability of a translation.
 *
 * These tiers aren't arbitrary labels. Each corresponds to a concrete
 * verification level that determines how much the output can be trusted
 * without human review.
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
  'gemini', 'openai', 'anthropic', 'deepl',
  'google-translate', 'microsoft-translator', 'libretranslate',
]);

/**
 * Resolve the model for a translation pair.
 *
 * - If the user explicitly set a model, use it (they know what they want).
 * - If the method is a direct provider, return null — let the method class
 *   pick its own default via _getDefaultModel().
 * - Otherwise (OpenRouter-style methods), use the global default.
 *
 * @param {string|null} explicitModel - Model from per-language or per-pair config
 * @param {string} method - Translation method name
 * @param {string} globalDefault - Global model from config (OpenRouter slug)
 * @returns {string|null} Resolved model, or null for direct providers
 */
function resolveModelForPair(explicitModel, method, globalDefault) {
  if (explicitModel) return explicitModel;
  if (DIRECT_PROVIDER_METHODS.has(method)) return null;
  return globalDefault;
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
 *
 * Pair keys use colon separator: "en:fr", "en:crk".
 * Legacy arrow formats (en→fr, en->fr) in config.pairs are accepted
 * by parsePairKey but stored internally in colon format.
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config (post-migration, post-defaults)
 * @returns {Map<string, import('./types.js').PairConfig>} Pair graph
 */
function resolvePairs(config) {
  const pairs = new Map();
  const inputLocale = config.inputLocale;
  const defaultModel = config.model || DEFAULT_OPENROUTER_MODEL;
  const defaultBatchSize = config.batchSize || DEFAULT_BATCH_SIZE;
  const defaultMethod = config.defaultMethod || PAIR_DEFAULTS.method;

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
    const method = langConfig.method || defaultMethod;
    const model = resolveModelForPair(langConfig.model, method, defaultModel);
    if (!langConfig.model) _defaults.add('model');
    const batchSize = langConfig.batchSize || defaultBatchSize;
    if (!langConfig.batchSize) _defaults.add('batchSize');
    const register = langConfig.register || registerInfo.register || DEFAULT_REGISTER_FALLBACK;
    if (!langConfig.register) _defaults.add('register');

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
      // Structured formality info for method-specific behavior (e.g., DeepL)
      formalitySystem: card?.formality?.system || null,
      // Language-specific gender guidance for LLM prompts (e.g., écriture inclusive for French)
      genderGuidance: card?.gender?.inclusiveGuidance || null,
      // Global prompt context from config (e.g., "This is a developer tool README")
      promptContext,
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

      // _defaults: a field is "defaulted" if NEITHER the pairOverride NOR
      // the existing pair set it explicitly. If pairOverride sets a field,
      // it clears the default flag; if it falls through to existing, it
      // inherits that pair's default tracking.
      const _defaults = new Set();
      const resolvedMethod = pairOverride.method || existing.method || defaultMethod;
      const model = resolveModelForPair(
        pairOverride.model || existing.model,
        resolvedMethod,
        defaultModel
      );
      if (!pairOverride.model && existingDefaults.has('model')) _defaults.add('model');
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
        // Plugin reference — the plugin loader will merge its config into this pair
        methodPlugin: pairOverride.methodPlugin || null,
        formalitySystem: card?.formality?.system || existing.formalitySystem || null,
        genderGuidance: card?.gender?.inclusiveGuidance || existing.genderGuidance || null,
        // Global prompt context flows from config into every pair
        promptContext,
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
 * @returns {{ estimatedCost: number|null, currency: string, source: string, note: string }}
 */
async function estimateCost(keyCount, pairConfig) {
  const methodName = pairConfig.method || 'llm';

  // Delegate to the method's own cost estimate.
  // WHY: We can't hardcode pricing here because each method has its own
  // pricing model (or lack thereof). Google has documented rates ($20/1M chars),
  // LLM varies by model, API is server-determined.
  try {
    const method = getMethod(methodName);
    return await method.estimateCost(keyCount, pairConfig);
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
  parsePairKey,
  buildPairKey,
  filterPairGraph,
  getTargetLocales,
  getPairForTarget,
  estimateCost,
  QUALITY_TIERS,
  PAIR_DEFAULTS,
};
