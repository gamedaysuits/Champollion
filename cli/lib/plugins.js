/**
 * Plugin system — loads, validates, installs, and manages method plugins.
 *
 * A plugin is a pre-packaged translation recipe for a specific language pair.
 * It's a JSON manifest (method.json) that tells champollion which method to use,
 * with what settings, and what quality has been verified.
 *
 * PLUGIN TYPES:
 *   - Open:   type "llm-coached" — coaching data bundled in plugin dir
 *   - API:    type "api"         — translations run server-side (IP protected)
 *   - Custom: type "llm"         — user's own method config (rare)
 *
 * PLUGIN STORAGE:
 *   .champollion/methods/
 *     crk-coached-v1/
 *       method.json           # Manifest (config, benchmarks, provenance)
 *       coaching/             # Only for open plugins
 *         crk.json
 *
 * INSTALL SOURCES:
 *   1. Remote registry (by name) — planned, not yet available
 *   2. URL (HTTP) — downloads and extracts
 *   3. Local directory — copies to .champollion/methods/
 *
 * NO OVERRIDE COMPLEXITY:
 *   Either you use a plugin for a pair, OR you configure manually.
 *   No layering, no merging of coaching data between plugins and user data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readMethod } from './framework/method.js';

const METHODS_DIR = '.champollion/methods';

/** method/1 kinds the CLI runs, and the plugin `type` each becomes. */
const CLI_KINDS = Object.freeze({
  service: 'api', 'nmt-checkpoint': 'api', 'mt-api': null, llm: 'llm', 'llm-coached': 'llm-coached',
});
/** llm providers that are a CLI method of their own name */
const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini'];

/**
 * `rel` inside `dir` (a method's own folder) as an absolute path, or null
 * when it leaves that folder: a method's coaching is part of the method, and
 * an installed plugin must not point the model at files elsewhere.
 */
function insideFolder(dir, rel) {
  const base = path.resolve(dir);
  const abs = path.resolve(base, rel);
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

/**
 * The CLI plugin a method.json describes. Every method.json is read through
 * the one reader (framework/method.js, method/1 — or an older shape as
 * method/0). An old CLI plugin manifest is used exactly as written; a
 * method/1 document becomes the fields the CLI uses. A kind the CLI cannot
 * run in this process (python, lexicon, local-model, human — they run in the
 * eval engine, mt-eval) is refused with that reason, never dropped silently.
 *
 * @param {ReturnType<typeof readMethod>} read
 * @returns {{ plugin?: object, error?: string }}
 */
export function pluginFromMethod(read) {
  // an old CLI manifest is judged exactly as before (validateManifest)
  if (read.shape === 'cli-plugin') return { plugin: read.data['x-v0'] };
  if (read.errors.length) return { error: read.errors.join('; ') };
  const m = read.data;
  if (read.shape === 'harness-plugin' || !(m.kind in CLI_KINDS)) {
    return { error: `a ${m.kind} method runs in the eval engine (mt-eval run --method), not in `
      + 'the champollion CLI — or serve it and use it through its endpoint (kind service)' };
  }
  let type = CLI_KINDS[m.kind];
  if (m.kind === 'mt-api') type = m.engine;
  if (m.kind === 'llm' || m.kind === 'llm-coached') {
    // the provider it was measured with is the one it ships with: never a
    // hosted default for a method measured on this computer's model
    if (!m.provider) {
      return { error: 'it does not say which provider carried its text when it was measured (openrouter, '
        + 'openai, anthropic, gemini or local) — export it again with mt-eval, or add "provider" to its '
        + 'method.json; the CLI never picks one for it' };
    }
    if (m.provider === 'local') type = 'local';
    else if (PROVIDER_TYPES.includes(m.provider)) type = m.kind === 'llm' ? m.provider : null;
    else if (m.provider !== 'openrouter') {
      return { error: `provider ${JSON.stringify(m.provider)} is not one the CLI runs (openrouter, openai, `
        + 'anthropic, gemini, local)' };
    }
    if (type === null) {
      return { error: `a coached method measured through ${m.provider} runs in the eval engine (mt-eval run `
        + '--method); the CLI runs coached methods through OpenRouter or a local model' };
    }
  }
  if (type === 'api' && !m.service?.endpoint) {
    return { error: `a ${m.kind} method is used by the CLI through its server: name service.endpoint` };
  }
  const locales = [...new Set((m.pairs || []).map((p) => p.target))];
  if (!locales.length) return { error: 'name its pairs — the CLI picks a method per target language' };
  const config = {};
  if (m.model) config.model = m.model;
  if (m.decode?.temperature != null) config.temperature = m.decode.temperature;
  if (m.decode?.batch_size != null) config.batchSize = m.decode.batch_size;
  // paths in a method/1 document are its own folder's (framework/method.js)
  for (const key of ['file', 'dir']) {
    if (m.coaching?.[key] && !insideFolder(read.dir, m.coaching[key])) {
      return { error: `coaching.${key} ${JSON.stringify(m.coaching[key])} leaves the method's folder — `
        + 'a method\'s coaching is part of it' };
    }
  }
  if (m.coaching?.file) config.coachingFile = insideFolder(read.dir, m.coaching.file);
  if (m.coaching?.prompt != null) config.coachingPrompt = m.coaching.prompt;
  const plugin = { name: m.id, type, version: m.version || '0.0.0', locales };
  // a folder of structured coaching per target locale (<locale>.json): used
  // for this method's pairs in place of the project's .champollion/coaching/
  if (m.coaching?.dir) plugin.coaching = { dir: insideFolder(read.dir, m.coaching.dir) };
  if (m.description) plugin.description = m.description;
  if (m.author) plugin.author = m.author;
  if (type === 'api') plugin.endpoint = m.service.endpoint;
  if (typeof m.service?.accepts_instructions === 'boolean') {
    plugin.acceptsInstructions = m.service.accepts_instructions;
  }
  if (Object.keys(config).length) plugin.config = config;
  if (m.provenance || typeof m.card?.commercial_ready === 'boolean') {
    plugin.provenance = { ...(m.provenance || {}) };
    if (typeof m.card?.commercial_ready === 'boolean') plugin.provenance.commercialReady = m.card.commercial_ready;
  }
  // measured evidence travels with it (numbers only); `plugin list` shows it
  if (Array.isArray(m.evidence) && m.evidence.length) plugin.evidence = m.evidence;
  return { plugin };
}

/**
 * Reference to the formal JSON Schema that defines the plugin contract.
 * The schema is the source of truth for field definitions, types, and constraints.
 * This runtime validator mirrors its rules without requiring ajv (zero-dependency).
 */
const SCHEMA_REF = 'shared/schemas/champollion-plugin.schema.json';

/**
 * Required fields in a method.json manifest.
 */
const REQUIRED_FIELDS = ['name', 'type', 'version', 'locales'];

/**
 * Valid method types that plugins can declare.
 */
const VALID_TYPES = ['llm', 'llm-coached', 'api', 'google-translate', 'deepl', 'microsoft-translator', 'libretranslate', 'openai', 'anthropic', 'gemini', 'local'];

/**
 * Load all installed plugins from the project's .champollion/methods/ directory.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Map<string, object>} Map of plugin name → parsed manifest
 */
function loadPlugins(projectRoot) {
  const plugins = new Map();
  const methodsDir = path.join(projectRoot, METHODS_DIR);

  if (!fs.existsSync(methodsDir)) {
    return plugins;
  }

  let entries;
  try {
    entries = fs.readdirSync(methodsDir, { withFileTypes: true });
  } catch {
    return plugins;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(methodsDir, entry.name, 'method.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const got = pluginFromMethod(readMethod(manifestPath));
      if (got.error) {
        console.error(`  [WARN] Skipping plugin "${entry.name}": ${got.error}`);
        continue;
      }
      const manifest = got.plugin;

      const validation = validateManifest(manifest);
      if (!validation.valid) {
        console.error(`  [WARN] Skipping plugin "${entry.name}": ${validation.errors.join(', ')}`);
        continue;
      }

      // Attach the resolved directory path so methods can find coaching data
      manifest._pluginDir = path.join(methodsDir, entry.name);
      // an older manifest's bundled coaching folder (coaching.dir) is the
      // plugin's own — it used to be attached and never read, so a coached
      // plugin ran uncoached
      if (typeof manifest.coaching?.dir === 'string' && !path.isAbsolute(manifest.coaching.dir)) {
        const dir = insideFolder(manifest._pluginDir, manifest.coaching.dir);
        if (!dir) {
          console.error(`  [WARN] Skipping plugin "${entry.name}": coaching.dir leaves its folder`);
          continue;
        }
        manifest.coaching = { ...manifest.coaching, dir };
      }
      plugins.set(manifest.name, manifest);
    } catch (err) {
      console.error(`  [WARN] Skipping plugin "${entry.name}": ${err.message}`);
    }
  }

  return plugins;
}

/**
 * Validate a method.json manifest.
 *
 * Runtime mirror of the constraints defined in the formal JSON Schema
 * (see SCHEMA_REF). Kept hand-rolled to preserve zero-dependency.
 *
 * @param {object} manifest - Parsed manifest object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest is not a valid object'] };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Validate type
  if (manifest.type && !VALID_TYPES.includes(manifest.type)) {
    errors.push(`Invalid type "${manifest.type}" — must be one of: ${VALID_TYPES.join(', ')}`);
  }

  // Validate locales is a non-empty array of strings
  if (manifest.locales) {
    if (!Array.isArray(manifest.locales)) {
      errors.push('"locales" must be an array of locale codes');
    } else if (manifest.locales.length === 0) {
      errors.push('"locales" must contain at least one locale code');
    }
  }

  // Validate name format (kebab-case, matches schema pattern)
  if (manifest.name && !/^[a-z0-9][a-z0-9-]*$/.test(manifest.name)) {
    errors.push(`Invalid name "${manifest.name}" — use kebab-case (e.g., "french-formal-v1")`);
  }

  // Validate version format (semver-like: digits.digits.digits)
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push(`Invalid version "${manifest.version}" — use semver format (e.g., "1.0.0")`);
  }

  // API plugins must have an endpoint
  if (manifest.type === 'api' && !manifest.endpoint) {
    errors.push('API plugins must include an "endpoint" URL');
  }
  if (manifest.acceptsInstructions !== undefined && typeof manifest.acceptsInstructions !== 'boolean') {
    errors.push('"acceptsInstructions" must be true or false');
  }

  // Benchmarks: validate structure if present
  if (manifest.benchmarks) {
    if (typeof manifest.benchmarks !== 'object') {
      errors.push('"benchmarks" must be an object keyed by locale code');
    } else {
      for (const [locale, entry] of Object.entries(manifest.benchmarks)) {
        if (!entry || typeof entry !== 'object') {
          errors.push(`benchmarks.${locale}: must be an object`);
          continue;
        }
        // Required benchmark fields (per JSON Schema)
        for (const reqField of ['date', 'corpus_size', 'exact_match_rate']) {
          if (entry[reqField] === undefined || entry[reqField] === null) {
            errors.push(`benchmarks.${locale}: missing required field "${reqField}"`);
          }
        }
        // Range checks
        if (typeof entry.exact_match_rate === 'number' && (entry.exact_match_rate < 0 || entry.exact_match_rate > 1)) {
          errors.push(`benchmarks.${locale}: exact_match_rate must be 0.0–1.0`);
        }
      }
    }
  }

  // Provenance: validate structure if present
  if (manifest.provenance) {
    if (typeof manifest.provenance !== 'object') {
      errors.push('"provenance" must be an object');
    } else {
      if (manifest.provenance.resources && !Array.isArray(manifest.provenance.resources)) {
        errors.push('"provenance.resources" must be an array');
      }
      if (manifest.provenance.flags && !Array.isArray(manifest.provenance.flags)) {
        errors.push('"provenance.flags" must be an array');
      }
    }
  }

  // Config: validate ranges if present
  if (manifest.config && typeof manifest.config === 'object') {
    if (manifest.config.batchSize !== undefined) {
      if (typeof manifest.config.batchSize !== 'number' || manifest.config.batchSize < 1 || manifest.config.batchSize > 200) {
        errors.push('"config.batchSize" must be 1–200');
      }
    }
    if (manifest.config.temperature !== undefined) {
      if (typeof manifest.config.temperature !== 'number' || manifest.config.temperature < 0 || manifest.config.temperature > 2) {
        errors.push('"config.temperature" must be 0–2');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Install a plugin from a local directory path.
 *
 * Copies the directory to .champollion/methods/<name>/ and validates the manifest.
 *
 * @param {string} source - Local directory path containing method.json
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ success: boolean, name: string|null, error: string|null }}
 */
function installPluginFromLocal(source, projectRoot) {
  const resolvedSource = path.resolve(source);

  // Validate source exists and has method.json
  const manifestPath = path.join(resolvedSource, 'method.json');
  if (!fs.existsSync(manifestPath)) {
    return { success: false, name: null, error: `No method.json found in ${resolvedSource}` };
  }

  const got = pluginFromMethod(readMethod(manifestPath));
  if (got.error) {
    return { success: false, name: null, error: `Invalid method.json: ${got.error}` };
  }
  const manifest = got.plugin;

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return { success: false, name: null, error: `Invalid manifest: ${validation.errors.join(', ')}` };
  }

  // A method is installed by copying its folder. A folder that holds the
  // project (a method.json kept at the top of the app, or above it) would be
  // copied into itself — without end, app and all.
  const inside = path.relative(resolvedSource, path.resolve(projectRoot));
  if (!inside.startsWith('..') && !path.isAbsolute(inside)) {
    return { success: false, name: null, error: `${resolvedSource} holds this project, and a method is installed `
      + 'by copying its folder — keep its method.json (and any file it names) in a folder of its own, '
      + `e.g. ${path.join(resolvedSource, 'methods', manifest.name)}/` };
  }

  // Copy to .champollion/methods/<name>/
  const targetDir = path.join(projectRoot, METHODS_DIR, manifest.name);
  fs.mkdirSync(targetDir, { recursive: true });

  copyDirRecursive(resolvedSource, targetDir);

  return { success: true, name: manifest.name, error: null };
}

/**
 * Install a plugin manifest directly (e.g., from a remote registry response).
 *
 * Creates the plugin directory and writes the manifest JSON.
 *
 * @param {object} manifest - Parsed manifest object
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ success: boolean, name: string|null, error: string|null }}
 */
function installPluginFromManifest(manifest, projectRoot) {
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return { success: false, name: null, error: `Invalid manifest: ${validation.errors.join(', ')}` };
  }

  const targetDir = path.join(projectRoot, METHODS_DIR, manifest.name);
  fs.mkdirSync(targetDir, { recursive: true });

  // Write the manifest
  fs.writeFileSync(
    path.join(targetDir, 'method.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  return { success: true, name: manifest.name, error: null };
}

/**
 * Remove an installed plugin.
 *
 * @param {string} name - Plugin name
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ success: boolean, error: string|null }}
 */
function removePlugin(name, projectRoot) {
  const pluginDir = path.join(projectRoot, METHODS_DIR, name);

  if (!fs.existsSync(pluginDir)) {
    return { success: false, error: `Plugin "${name}" is not installed` };
  }

  fs.rmSync(pluginDir, { recursive: true, force: true });
  return { success: true, error: null };
}

/**
 * List all installed plugins with summary info.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Array<{ name, type, version, locales, qualityTier, hasBenchmarks }>}
 */
function listPlugins(projectRoot) {
  const plugins = loadPlugins(projectRoot);
  const summaries = [];

  for (const [name, manifest] of plugins) {
    summaries.push({
      name,
      type: manifest.type,
      version: manifest.version,
      description: manifest.description || '',
      locales: manifest.locales || [],
      qualityTier: manifest.config?.qualityTier || inferTierFromType(manifest.type),
      hasBenchmarks: !!(manifest.benchmarks && Object.keys(manifest.benchmarks).length > 0)
        || !!manifest.evidence?.length,
    });
  }

  return summaries;
}

/**
 * Resolve plugin config for a specific pair.
 *
 * If the pair config references a methodPlugin, load the plugin and merge
 * its configuration into the pair config. Plugin config fills gaps — it
 * doesn't override explicit pair-level settings.
 *
 * @param {Map<string, object>} plugins - Loaded plugin registry
 * @param {import('./types.js').PairConfig} pairConfig - Pair config from pairs.js
 * @returns {import('./types.js').PairConfig} Merged pair config with plugin data
 */
function resolvePluginForPair(plugins, pairConfig) {
  if (!pairConfig.methodPlugin) {
    return pairConfig;
  }

  const plugin = plugins.get(pairConfig.methodPlugin);
  if (!plugin) {
    console.error(`  [WARN] Plugin "${pairConfig.methodPlugin}" not found — using pair defaults`);
    return pairConfig;
  }

  // Plugin type wins for method — the user referenced this plugin because
  // they want its translation strategy. Without this, the default 'llm'
  // set by resolvePairs would silently override the plugin's declared type.
  const method = plugin.type || pairConfig.method || 'llm';

  // Precedence (per METHOD_PLUGIN_SPEC.md):
  //   explicit pair config > plugin config > system defaults
  //
  // pairConfig._defaults (a Set) tracks which fields were filled from
  // system defaults by resolvePairs(). For those fields, plugin config
  // should win. For explicitly set fields, the pair config wins.
  const defaults = pairConfig._defaults || new Set();

  // Helper: resolve a field value respecting the precedence chain.
  // Two cases where the plugin value wins:
  //   1. pairConfig[field] is nullish (gap — field was never set)
  //   2. pairConfig[field] is truthy but came from system defaults
  //      (_defaults set tracks this from resolvePairs)
  // If the pair explicitly set the field, it always wins.
  const resolve = (field, pluginValue) => {
    const pairValue = pairConfig[field];
    if (pairValue == null && pluginValue != null) return pluginValue;
    if (defaults.has(field) && pluginValue != null) return pluginValue;
    return pairValue;
  };

  const merged = {
    ...pairConfig,
    method,
    model: resolve('model', plugin.config?.model),
    register: resolve('register', plugin.config?.register),
    batchSize: resolve('batchSize', plugin.config?.batchSize),
    temperature: resolve('temperature', plugin.config?.temperature),
    coachingFile: resolve('coachingFile', plugin.config?.coachingFile),
    coachingPrompt: resolve('coachingPrompt', plugin.config?.coachingPrompt),
    promptContext: resolve('promptContext', plugin.config?.promptContext),

    // Plugin-specific fields
    endpoint: plugin.endpoint || pairConfig.endpoint || null,
    // The endpoint's declared instruction capability: the pair's own
    // statement wins, then the manifest's; null = unknown.
    acceptsInstructions: typeof pairConfig.acceptsInstructions === 'boolean'
      ? pairConfig.acceptsInstructions
      : (typeof plugin.acceptsInstructions === 'boolean' ? plugin.acceptsInstructions : null),
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    pluginDir: plugin._pluginDir,
    // its bundled coaching folder, read in place of the project's
    // (methods/coaching-data.js coachingDirFor)
    ...(typeof plugin.coaching?.dir === 'string' ? { coachingDir: plugin.coaching.dir } : {}),
    pluginBenchmarks: plugin.benchmarks || null,
    pluginProvenance: plugin.provenance || null,
  };

  // Auto-set quality tier from plugin type if not explicitly set
  if (pairConfig.qualityTier === 'standard' || !pairConfig.qualityTier) {
    merged.qualityTier = inferTierFromType(method);
  }

  return merged;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Infer quality tier from method type.
 *
 * @param {string} type - Method type name (e.g., 'llm', 'api')
 * @returns {string} Quality tier: 'standard', 'high', 'research', or 'verified'
 */
function inferTierFromType(type) {
  const TIER_MAP = {
    'llm': 'standard',
    'google-translate': 'standard',
    'llm-coached': 'high',
    'api': 'high',  // conservative default — server may be research-grade
  };
  return TIER_MAP[type] || 'standard';
}

/**
 * Recursively copy a directory.
 *
 * @param {string} source - Absolute path to source directory
 * @param {string} target - Absolute path to destination directory
 */
function copyDirRecursive(source, target) {
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export {
  loadPlugins,
  validateManifest,
  installPluginFromLocal,
  installPluginFromManifest,
  removePlugin,
  listPlugins,
  resolvePluginForPair,
  METHODS_DIR,
  REQUIRED_FIELDS,
  VALID_TYPES,
  SCHEMA_REF,
};
