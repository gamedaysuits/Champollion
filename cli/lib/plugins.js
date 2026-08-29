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

const METHODS_DIR = '.champollion/methods';

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
const VALID_TYPES = ['llm', 'llm-coached', 'api', 'google-translate', 'deepl', 'microsoft-translator', 'libretranslate', 'openai', 'anthropic', 'gemini'];

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
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);

      const validation = validateManifest(manifest);
      if (!validation.valid) {
        console.error(`  [WARN] Skipping plugin "${entry.name}": ${validation.errors.join(', ')}`);
        continue;
      }

      // Attach the resolved directory path so methods can find coaching data
      manifest._pluginDir = path.join(methodsDir, entry.name);
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

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    return { success: false, name: null, error: `Invalid method.json: ${err.message}` };
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    return { success: false, name: null, error: `Invalid manifest: ${validation.errors.join(', ')}` };
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
      hasBenchmarks: !!(manifest.benchmarks && Object.keys(manifest.benchmarks).length > 0),
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
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    pluginDir: plugin._pluginDir,
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
