import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  loadPlugins,
  validateManifest,
  installPluginFromLocal,
  installPluginFromManifest,
  removePlugin,
  listPlugins,
  resolvePluginForPair,
  REQUIRED_FIELDS,
  VALID_TYPES,
  SCHEMA_REF,
} from '../lib/plugins.js';

// -----------------------------------------------------------------
// Helpers: create temp project structures for testing
// -----------------------------------------------------------------

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-plugin-test-'));
  return dir;
}

function createPlugin(projectRoot, name, manifest, coachingData) {
  const pluginDir = path.join(projectRoot, '.champollion', 'methods', name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'method.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
  if (coachingData) {
    const coachingDir = path.join(pluginDir, 'coaching');
    fs.mkdirSync(coachingDir, { recursive: true });
    for (const [locale, data] of Object.entries(coachingData)) {
      fs.writeFileSync(
        path.join(coachingDir, `${locale}.json`),
        JSON.stringify(data, null, 2),
        'utf-8',
      );
    }
  }
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// A valid, minimal manifest for testing
const VALID_MANIFEST = {
  name: 'test-method-v1',
  type: 'llm-coached',
  version: '1.0.0',
  locales: ['fr'],
  description: 'Test method for French',
  config: {
    model: 'google/gemini-3.5-flash',
    register: 'Formal French',
    batchSize: 25,
  },
};

// A valid API-type manifest
const VALID_API_MANIFEST = {
  name: 'crk-coached-v1',
  type: 'api',
  version: '1.2.0',
  locales: ['crk'],
  description: 'Plains Cree coached translation',
  endpoint: 'https://api.example.com/v1/translate',
  config: {
    register: 'Formal, respectful register',
    batchSize: 30,
    qualityTier: 'research',
  },
  benchmarks: {
    crk: {
      corpus_chrf: 40.2,
      exact_match_rate: 0.31,
      corpus_size: 404,
      date: '2026-05-09T00:00:00Z',
    },
  },
  provenance: {
    resources: [{ name: 'Coached Pipeline', license: 'proprietary' }],
    commercialReady: true,
    flags: [],
  },
};

// -----------------------------------------------------------------
// Tests: validateManifest
// -----------------------------------------------------------------

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const result = validateManifest(VALID_MANIFEST);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('accepts a full API manifest with benchmarks and provenance', () => {
    const result = validateManifest(VALID_API_MANIFEST);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects null/undefined input', () => {
    const result = validateManifest(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects missing required fields', () => {
    for (const field of REQUIRED_FIELDS) {
      const partial = { ...VALID_MANIFEST };
      delete partial[field];
      const result = validateManifest(partial);
      assert.equal(result.valid, false, `Should reject missing "${field}"`);
      assert.ok(result.errors.some(e => e.includes(field)));
    }
  });

  it('rejects invalid type', () => {
    const bad = { ...VALID_MANIFEST, type: 'magic-method' };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('magic-method')));
  });

  it('rejects non-array locales', () => {
    const bad = { ...VALID_MANIFEST, locales: 'fr' };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('locales')));
  });

  it('rejects invalid name format (uppercase)', () => {
    const bad = { ...VALID_MANIFEST, name: 'MyPlugin' };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('kebab-case')));
  });

  it('rejects API type without endpoint', () => {
    const bad = { ...VALID_MANIFEST, type: 'api', endpoint: undefined };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('endpoint')));
  });

  // ----- Schema-driven constraint tests (P1.3) -----

  it('rejects invalid version format (non-semver)', () => {
    const bad = { ...VALID_MANIFEST, version: 'latest' };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('semver')));
  });

  it('rejects empty locales array', () => {
    const bad = { ...VALID_MANIFEST, locales: [] };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('at least one')));
  });

  it('rejects benchmark entry missing required fields', () => {
    const bad = {
      ...VALID_MANIFEST,
      benchmarks: { fr: { corpus_chrf: 72 } }, // missing date, corpus_size, exact_match_rate
    };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('date')));
    assert.ok(result.errors.some(e => e.includes('corpus_size')));
    assert.ok(result.errors.some(e => e.includes('exact_match_rate')));
  });

  it('rejects benchmark exact_match_rate out of range', () => {
    const bad = {
      ...VALID_MANIFEST,
      benchmarks: {
        fr: {
          date: '2026-01-01T00:00:00Z',
          corpus_size: 100,
          exact_match_rate: 1.5, // out of 0–1 range
          model: 'test',
          harness_version: '1.0.0',
        },
      },
    };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('0.0–1.0')));
  });

  it('rejects provenance.resources as non-array', () => {
    const bad = {
      ...VALID_MANIFEST,
      provenance: { resources: 'not-an-array', commercialReady: false, flags: [] },
    };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('provenance.resources')));
  });

  it('rejects config.batchSize out of range', () => {
    const bad = {
      ...VALID_MANIFEST,
      config: { ...VALID_MANIFEST.config, batchSize: 500 },
    };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('batchSize')));
  });

  it('rejects config.temperature out of range', () => {
    const bad = {
      ...VALID_MANIFEST,
      config: { ...VALID_MANIFEST.config, temperature: -1 },
    };
    const result = validateManifest(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('temperature')));
  });

  it('accepts a fully valid manifest with all optional fields', () => {
    const full = {
      ...VALID_MANIFEST,
      description: 'Full manifest with all fields',
      author: 'Test Author',
      benchmarks: {
        fr: {
          date: '2026-01-01T00:00:00Z',
          corpus_size: 500,
          exact_match_rate: 0.42,
          corpus_chrf: 72.3,
          corpus_bleu: 45.1,
          model: 'google/gemini-3.5-flash',
          harness_version: '1.0.0',
        },
      },
      provenance: {
        resources: [{ name: 'Test', license: 'MIT' }],
        commercialReady: true,
        flags: [],
      },
      coaching: { dir: 'coaching' },
    };
    const result = validateManifest(full);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});

// Schema contract test — verify the JSON Schema file is valid and loadable
describe('plugin schema contract', () => {
  it('schema file exists and is valid JSON', () => {
    const schemaPath = path.join(import.meta.dirname, '..', SCHEMA_REF);
    assert.ok(fs.existsSync(schemaPath), `Schema file not found at ${schemaPath}`);

    const raw = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(raw);
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required));
    assert.ok(schema.required.includes('name'));
    assert.ok(schema.required.includes('type'));
    assert.ok(schema.required.includes('version'));
    assert.ok(schema.required.includes('locales'));
  });

  it('schema required fields match runtime REQUIRED_FIELDS', () => {
    const schemaPath = path.join(import.meta.dirname, '..', SCHEMA_REF);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    // Every runtime required field must be in the schema
    for (const field of REQUIRED_FIELDS) {
      assert.ok(schema.required.includes(field), `Schema missing required field "${field}"`);
    }
    // Every schema required field must be in the runtime
    for (const field of schema.required) {
      assert.ok(REQUIRED_FIELDS.includes(field), `Runtime missing schema required field "${field}"`);
    }
  });

  it('schema enum for type matches runtime VALID_TYPES', () => {
    const schemaPath = path.join(import.meta.dirname, '..', SCHEMA_REF);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const schemaTypes = schema.properties.type.enum;

    assert.deepEqual([...schemaTypes].sort(), [...VALID_TYPES].sort());
  });
});

// -----------------------------------------------------------------
// Tests: loadPlugins
// -----------------------------------------------------------------

describe('loadPlugins', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('returns empty map when .champollion/methods/ does not exist', () => {
    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 0);
  });

  it('returns empty map when .champollion/methods/ is empty', () => {
    fs.mkdirSync(path.join(tempDir, '.champollion', 'methods'), { recursive: true });
    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 0);
  });

  it('loads valid plugin manifests', () => {
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);
    createPlugin(tempDir, 'crk-coached-v1', VALID_API_MANIFEST);

    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 2);
    assert.ok(plugins.has('test-method-v1'));
    assert.ok(plugins.has('crk-coached-v1'));
  });

  it('skips directories without method.json', () => {
    // Create a directory without method.json
    fs.mkdirSync(path.join(tempDir, '.champollion', 'methods', 'bad-plugin'), { recursive: true });
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);

    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 1);
    assert.ok(plugins.has('test-method-v1'));
  });

  it('skips plugins with invalid manifests', () => {
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);
    // Create a plugin with invalid manifest (missing name)
    createPlugin(tempDir, 'bad-plugin', { type: 'llm', version: '1.0.0', locales: ['fr'] });

    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 1);
  });

  it('attaches _pluginDir to loaded manifests', () => {
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);
    const plugins = loadPlugins(tempDir);
    const plugin = plugins.get('test-method-v1');
    assert.ok(plugin._pluginDir);
    assert.ok(plugin._pluginDir.endsWith('test-method-v1'));
  });
});

// -----------------------------------------------------------------
// Tests: installPluginFromLocal
// -----------------------------------------------------------------

describe('installPluginFromLocal', () => {
  let tempDir;
  let sourceDir;

  beforeEach(() => {
    tempDir = createTempProject();
    sourceDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
    cleanupDir(sourceDir);
  });

  it('installs a valid plugin from a local directory', () => {
    // Set up source plugin directory
    fs.writeFileSync(
      path.join(sourceDir, 'method.json'),
      JSON.stringify(VALID_MANIFEST),
      'utf-8',
    );

    const result = installPluginFromLocal(sourceDir, tempDir);
    assert.equal(result.success, true);
    assert.equal(result.name, 'test-method-v1');

    // Verify the plugin was copied
    const installed = path.join(tempDir, '.champollion', 'methods', 'test-method-v1', 'method.json');
    assert.ok(fs.existsSync(installed));
  });

  it('rejects source without method.json', () => {
    const result = installPluginFromLocal(sourceDir, tempDir);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('method.json'));
  });

  it('rejects invalid manifest', () => {
    fs.writeFileSync(
      path.join(sourceDir, 'method.json'),
      JSON.stringify({ type: 'llm' }), // Missing required fields
      'utf-8',
    );

    const result = installPluginFromLocal(sourceDir, tempDir);
    assert.equal(result.success, false);
  });
});

// -----------------------------------------------------------------
// Tests: installPluginFromManifest
// -----------------------------------------------------------------

describe('installPluginFromManifest', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('writes manifest to .champollion/methods/<name>/method.json', () => {
    const result = installPluginFromManifest(VALID_API_MANIFEST, tempDir);
    assert.equal(result.success, true);
    assert.equal(result.name, 'crk-coached-v1');

    const installed = path.join(tempDir, '.champollion', 'methods', 'crk-coached-v1', 'method.json');
    assert.ok(fs.existsSync(installed));

    const written = JSON.parse(fs.readFileSync(installed, 'utf-8'));
    assert.equal(written.name, 'crk-coached-v1');
    assert.equal(written.type, 'api');
  });

  it('rejects invalid manifest', () => {
    const result = installPluginFromManifest({ type: 'llm' }, tempDir);
    assert.equal(result.success, false);
  });
});

// -----------------------------------------------------------------
// Tests: removePlugin
// -----------------------------------------------------------------

describe('removePlugin', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('removes an installed plugin', () => {
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'test-method-v1');
    assert.ok(fs.existsSync(pluginDir));

    const result = removePlugin('test-method-v1', tempDir);
    assert.equal(result.success, true);
    assert.ok(!fs.existsSync(pluginDir));
  });

  it('returns error for non-existent plugin', () => {
    const result = removePlugin('not-installed', tempDir);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not installed'));
  });
});

// -----------------------------------------------------------------
// Tests: listPlugins
// -----------------------------------------------------------------

describe('listPlugins', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('returns empty array when no plugins installed', () => {
    const list = listPlugins(tempDir);
    assert.equal(list.length, 0);
  });

  it('returns summary list of installed plugins', () => {
    createPlugin(tempDir, 'test-method-v1', VALID_MANIFEST);
    createPlugin(tempDir, 'crk-coached-v1', VALID_API_MANIFEST);

    const list = listPlugins(tempDir);
    assert.equal(list.length, 2);

    const crk = list.find(p => p.name === 'crk-coached-v1');
    assert.ok(crk);
    assert.equal(crk.type, 'api');
    assert.equal(crk.version, '1.2.0');
    assert.deepEqual(crk.locales, ['crk']);
    assert.equal(crk.hasBenchmarks, true);
  });
});

// -----------------------------------------------------------------
// Tests: resolvePluginForPair
// -----------------------------------------------------------------

describe('resolvePluginForPair', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('returns unmodified pair when no methodPlugin is set', () => {
    const plugins = new Map();
    const pairConfig = { method: 'llm', model: 'google/gemini-3.5-flash' };
    const result = resolvePluginForPair(plugins, pairConfig);
    assert.deepEqual(result, pairConfig);
  });

  it('returns unmodified pair when plugin is not found', () => {
    const plugins = new Map();
    const pairConfig = { method: 'api', methodPlugin: 'nonexistent-v1' };
    const result = resolvePluginForPair(plugins, pairConfig);
    assert.deepEqual(result, pairConfig);
  });

  it('merges plugin config into pair config', () => {
    const plugins = new Map();
    plugins.set('crk-coached-v1', {
      ...VALID_API_MANIFEST,
      _pluginDir: '/fake/path',
    });

    const pairConfig = {
      source: 'en',
      target: 'crk',
      method: 'api',
      methodPlugin: 'crk-coached-v1',
    };

    const result = resolvePluginForPair(plugins, pairConfig);
    assert.equal(result.method, 'api');
    assert.equal(result.pluginName, 'crk-coached-v1');
    assert.equal(result.pluginVersion, '1.2.0');
    assert.equal(result.endpoint, 'https://api.example.com/v1/translate');
    assert.ok(result.pluginBenchmarks);
    assert.ok(result.pluginProvenance);
  });

  it('infers method from plugin type when method is not set on pair', () => {
    const plugins = new Map();
    plugins.set('test-method-v1', {
      ...VALID_MANIFEST,
      _pluginDir: '/fake/path',
    });

    const pairConfig = {
      source: 'en',
      target: 'fr',
      methodPlugin: 'test-method-v1',
    };

    const result = resolvePluginForPair(plugins, pairConfig);
    assert.equal(result.method, 'llm-coached');
  });

  it('plugin type wins for method, pair wins for model/register', () => {
    const plugins = new Map();
    plugins.set('test-method-v1', {
      ...VALID_MANIFEST,
      _pluginDir: '/fake/path',
    });

    const pairConfig = {
      source: 'en',
      target: 'fr',
      method: 'llm',  // Default from resolvePairs — plugin type overrides this
      model: 'anthropic/claude-3',  // Pair overrides plugin's model (gap-fill)
      methodPlugin: 'test-method-v1',
    };

    const result = resolvePluginForPair(plugins, pairConfig);
    // Plugin type wins — the user referenced the plugin for its method strategy
    assert.equal(result.method, 'llm-coached');
    // Pair model wins — gap-fill only applies when the pair doesn't set it
    assert.equal(result.model, 'anthropic/claude-3');
  });
});
