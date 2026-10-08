/**
 * Sync → Pair Graph integration tests.
 *
 * WHY THESE EXIST:
 *   The individual subsystems (pairs.js, translate.js, plugins.js, methods/)
 *   each have thorough unit tests. But the integration from config → pair graph
 *   → method dispatch has no coverage. These tests verify that when a user
 *   configures a specific translation method for a pair, sync actually routes
 *   through the correct method class.
 *
 * WHAT WE TEST:
 *   1. Config with `pairs: { "en:fr": { method: "google-translate" } }` →
 *      sync resolves that pair and dispatches to GoogleTranslateMethod
 *   2. Config with only `languages: ["fr"]` (no pairs override) →
 *      sync dispatches to LLMMethod (backward compat / default)
 *   3. Mixed config: some languages have pair overrides, others don't →
 *      overridden pairs use specified method, others use default LLM
 *   4. Plugin reference: pair with `methodPlugin` → plugin config merges
 *      into pair config before method dispatch
 *   5. Provenance audit integration: pairs with unverified plugins get warnings
 *
 * MOCK STRATEGY:
 *   We test at the resolvePairs + resolvePluginForPair + getMethod level,
 *   not by running the full runSync (which requires filesystem + API keys).
 *   This is the correct integration boundary — it proves the wiring works
 *   without needing to mock fs.watch, HTTP calls, or CI environments.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { resolvePairs, parsePairKey, buildPairKey } from '../lib/pairs.js';
import { loadPlugins, resolvePluginForPair } from '../lib/plugins.js';
import { getMethod } from '../lib/translate.js';
import { auditProvenance } from '../lib/provenance.js';

// Suppress console.error/warn noise during tests
const originalError = console.error;
const originalWarn = console.warn;
function muteConsole() {
  console.error = () => {};
  console.warn = () => {};
}
function restoreConsole() {
  console.error = originalError;
  console.warn = originalWarn;
}

// =================================================================
// Config → Pair Graph → Method Dispatch
// =================================================================

describe('sync-pairs: config → pair graph resolution', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('simple languages array generates default LLM pairs', () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal French.' },
        de: { name: 'German', register: 'Standard German.' },
      },
    };

    const pairs = resolvePairs(config);

    assert.equal(pairs.size, 2);
    assert.ok(pairs.has('en:fr'));
    assert.ok(pairs.has('en:de'));

    const frPair = pairs.get('en:fr');
    assert.equal(frPair.method, 'llm', 'Default method should be LLM');
    assert.equal(frPair.source, 'en');
    assert.equal(frPair.target, 'fr');
    assert.equal(frPair.name, 'French');
    assert.equal(frPair.register, 'Formal French.');
  });

  it('pairs override replaces method for specific languages', () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal French.' },
        de: { name: 'German', register: 'Standard German.' },
      },
      pairs: {
        'en:fr': { method: 'google-translate' },
      },
    };

    const pairs = resolvePairs(config);

    assert.equal(pairs.size, 2);

    // French should use google-translate (overridden)
    const frPair = pairs.get('en:fr');
    assert.equal(frPair.method, 'google-translate');
    assert.equal(frPair.target, 'fr');

    // German should still use LLM (no override)
    const dePair = pairs.get('en:de');
    assert.equal(dePair.method, 'llm');
  });

  it('pairs can add languages not in the languages array', () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal French.' },
      },
      pairs: {
        'en:crk': {
          method: 'api',
          name: 'Plains Cree',
          methodPlugin: 'crk-coached-v1',
        },
      },
    };

    const pairs = resolvePairs(config);

    assert.equal(pairs.size, 2);
    assert.ok(pairs.has('en:fr'));
    assert.ok(pairs.has('en:crk'));

    const crkPair = pairs.get('en:crk');
    assert.equal(crkPair.method, 'api');
    assert.equal(crkPair.name, 'Plains Cree');
    assert.equal(crkPair.methodPlugin, 'crk-coached-v1');
  });

  it('pair override preserves existing language data', () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal French.' },
      },
      pairs: {
        // Override method only — should keep the name/register from languages
        'en:fr': { method: 'llm-coached' },
      },
    };

    const pairs = resolvePairs(config);
    const frPair = pairs.get('en:fr');

    assert.equal(frPair.method, 'llm-coached');
    assert.equal(frPair.name, 'French', 'Name should be preserved from languages');
    assert.equal(frPair.register, 'Formal French.', 'Register should be preserved');
  });

  it('legacy arrow pair keys in config are accepted and normalized', () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {},
      pairs: {
        'en→fr': { method: 'google-translate', name: 'French' },
        'en->de': { method: 'llm-coached', name: 'German' },
      },
    };

    const pairs = resolvePairs(config);

    // Both should be stored in canonical colon format
    assert.ok(pairs.has('en:fr'), 'Arrow key should be normalized to colon');
    assert.ok(pairs.has('en:de'), 'ASCII arrow should be normalized to colon');
    assert.equal(pairs.get('en:fr').method, 'google-translate');
    assert.equal(pairs.get('en:de').method, 'llm-coached');
  });
});

// =================================================================
// Pair Config → Method Instantiation
// =================================================================

describe('sync-pairs: pair config → method class dispatch', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('LLM pair config instantiates LLMMethod', () => {
    const method = getMethod('llm');
    assert.equal(method.name, 'llm');
  });

  it('google-translate pair config instantiates GoogleTranslateMethod', () => {
    const method = getMethod('google-translate');
    assert.equal(method.name, 'google-translate');
  });

  it('llm-coached pair config instantiates LLMCoachedMethod', () => {
    const method = getMethod('llm-coached');
    assert.equal(method.name, 'llm-coached');
  });

  it('api pair config instantiates APIMethod with plugin context', () => {
    const method = getMethod('api', {
      endpoint: 'https://api.example.com/v1/translate',
      pluginName: 'crk-coached-v1',
      pluginVersion: '1.2.0',
      qualityTier: 'research',
      pluginProvenance: {
        resources: [{ name: 'Coached Pipeline', license: 'proprietary' }],
        commercialReady: true,
        flags: [],
      },
    });

    assert.equal(method.name, 'api');
    assert.equal(method.endpoint, 'https://api.example.com/v1/translate');
  });

  it('unknown method throws descriptive error', () => {
    assert.throws(
      () => getMethod('nonexistent-method'),
      /Unknown translation method "nonexistent-method"/,
    );
  });
});

// =================================================================
// Plugin → Pair Resolution
// =================================================================

describe('sync-pairs: plugin config merges into pair', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-sync-pairs-'));
    muteConsole();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    restoreConsole();
  });

  it('plugin config fills gaps in pair config (pair-level wins over plugin)', () => {
    // Install a mock plugin
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'fr-premium-v1');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'fr-premium-v1',
      type: 'llm-coached',
      version: '2.0.0',
      locales: ['fr'],
      config: {
        model: 'anthropic/claude-3.5-sonnet',
        register: 'Premium formal French for luxury brand.',
        batchSize: 15,
      },
    }));

    // Load plugins and resolve for a pair that has NO explicit method/model
    // (these are the "gaps" the plugin fills)
    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 1);

    const rawPairConfig = {
      source: 'en',
      target: 'fr',
      // No method, model, or register — plugin should fill these
      methodPlugin: 'fr-premium-v1',
    };

    const resolved = resolvePluginForPair(plugins, rawPairConfig);

    // Plugin type fills the gap (pair had no method set)
    assert.equal(resolved.method, 'llm-coached');
    // Plugin model fills the gap (pair had no model set)
    assert.equal(resolved.model, 'anthropic/claude-3.5-sonnet');
    // Plugin register fills the gap
    assert.equal(resolved.register, 'Premium formal French for luxury brand.');
    // Plugin metadata is always attached
    assert.equal(resolved.pluginName, 'fr-premium-v1');
    assert.equal(resolved.pluginVersion, '2.0.0');
  });

  it('pair-level overrides win over plugin defaults for model/register', () => {
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'de-basic-v1');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'de-basic-v1',
      type: 'llm',
      version: '1.0.0',
      locales: ['de'],
      config: {
        model: 'google/gemini-3.5-flash',
        register: 'Standard German',
      },
    }));

    const plugins = loadPlugins(tempDir);
    const rawPairConfig = {
      source: 'en',
      target: 'de',
      method: 'llm',
      // User explicitly sets a different model — this should win
      model: 'google/gemini-2.0-flash',
      methodPlugin: 'de-basic-v1',
    };

    const resolved = resolvePluginForPair(plugins, rawPairConfig);

    // Pair-level model wins over plugin default
    assert.equal(resolved.model, 'google/gemini-2.0-flash');
  });

  it('plugin type wins for method even when pair has default llm (regression)', () => {
    // Regression test: resolvePairs sets method: 'llm' as a default on every
    // pair. When a plugin is explicitly referenced via methodPlugin, the
    // plugin's type IS the intended method — the default shouldn't override it.
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'fr-coached-v1');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'fr-coached-v1',
      type: 'llm-coached',
      version: '1.0.0',
      locales: ['fr'],
      config: {
        model: 'anthropic/claude-3.5-sonnet',
      },
    }));

    const plugins = loadPlugins(tempDir);
    const rawPairConfig = {
      source: 'en',
      target: 'fr',
      method: 'llm',  // Default from resolvePairs — should NOT override plugin
      model: 'google/gemini-3.5-flash',
      methodPlugin: 'fr-coached-v1',
    };

    const resolved = resolvePluginForPair(plugins, rawPairConfig);

    // Plugin type wins — user referenced the plugin because they want coached
    assert.equal(resolved.method, 'llm-coached',
      'Plugin type should override the default llm method from resolvePairs');
    // But pair-level model wins over plugin model (that is still gap-fill)
    assert.equal(resolved.model, 'google/gemini-3.5-flash',
      'Pair-level model should still win over plugin model');
  });

  it('missing plugin reference is handled gracefully', () => {
    const plugins = loadPlugins(tempDir); // no plugins installed
    const rawPairConfig = {
      source: 'en',
      target: 'fr',
      method: 'llm',
      methodPlugin: 'nonexistent-plugin-v1',
    };

    // Should not throw — returns the pair config unmodified
    const resolved = resolvePluginForPair(plugins, rawPairConfig);
    assert.equal(resolved.method, 'llm');
  });

  it('plugin config overrides system defaults but not explicit pair settings', () => {
    // This tests the _defaults tracking introduced in pairs.js:
    // When resolvePairs fills a field from system defaults (e.g., model),
    // a plugin should be able to override that default. But when the user
    // explicitly sets the field, the plugin should not override it.

    // Install a mock plugin
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'fr-premium-v2');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'fr-premium-v2',
      type: 'llm-coached',
      version: '2.0.0',
      locales: ['fr'],
      config: {
        model: 'anthropic/claude-3.5-sonnet',
        register: 'Premium formal French.',
        batchSize: 10,
      },
    }));

    const plugins = loadPlugins(tempDir);

    // Case A: pair WITHOUT explicit model → plugin model wins over system default
    const configA = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',  // system default
      batchSize: 30,
      resolvedLanguages: {
        // No explicit model on the language entry — will get system default
        fr: { name: 'French' },
      },
      pairs: {
        'en:fr': { methodPlugin: 'fr-premium-v2' },
      },
    };

    const pairsA = resolvePairs(configA);
    const frPairA = pairsA.get('en:fr');
    // Verify the _defaults set is tracking model as a default
    assert.ok(frPairA._defaults.has('model'), 'model should be tracked as a default');
    const resolvedA = resolvePluginForPair(plugins, frPairA);
    assert.equal(resolvedA.model, 'anthropic/claude-3.5-sonnet',
      'Plugin model should override system default');
    assert.equal(resolvedA.register, 'Premium formal French.',
      'Plugin register should override system default');
    assert.equal(resolvedA.batchSize, 10,
      'Plugin batchSize should override system default');

    // Case B: pair WITH explicit model → pair model wins over plugin
    const configB = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', model: 'google/gemini-2.0-flash' },
      },
      pairs: {
        'en:fr': { methodPlugin: 'fr-premium-v2' },
      },
    };

    const pairsB = resolvePairs(configB);
    const frPairB = pairsB.get('en:fr');
    // model should NOT be in _defaults since user set it explicitly
    assert.ok(!frPairB._defaults.has('model'), 'model should NOT be a default');
    const resolvedB = resolvePluginForPair(plugins, frPairB);
    assert.equal(resolvedB.model, 'google/gemini-2.0-flash',
      'Explicit pair model should win over plugin model');
  });
});

// =================================================================
// Provenance Audit Integration
// =================================================================

describe('sync-pairs: provenance audit before sync', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('flags pairs with non-commercial method provenance', () => {
    // auditProvenance checks the static METHOD_PROVENANCE registry by method name.
    // "fst-gated" is the only registered method with commercialReady: false.
    const resolvedPairs = new Map();
    resolvedPairs.set('en:fr', {
      source: 'en', target: 'fr', method: 'llm', name: 'French',
    });
    resolvedPairs.set('en:crk', {
      source: 'en', target: 'crk', method: 'fst-gated', name: 'Plains Cree',
    });

    const audit = auditProvenance(resolvedPairs);

    // fst-gated is flagged as non-commercial in METHOD_PROVENANCE
    assert.equal(audit.allClear, false);
    assert.ok(audit.blockedPairs.includes('en:crk'));
    assert.ok(audit.flags.includes('PROPRIETARY_DATASET'));
    // LLM method is always clear
    assert.ok(!audit.blockedPairs.includes('en:fr'));
  });

  it('returns allClear when no provenance issues', () => {
    const resolvedPairs = new Map();
    resolvedPairs.set('en:fr', {
      source: 'en', target: 'fr', method: 'llm', name: 'French',
    });
    resolvedPairs.set('en:de', {
      source: 'en', target: 'de', method: 'google-translate', name: 'German',
    });

    const audit = auditProvenance(resolvedPairs);
    assert.equal(audit.allClear, true);
    assert.equal(audit.blockedPairs.length, 0);
  });

  it('flags pairs with non-commercial plugin provenance (regression)', () => {
    // Regression test: a plugin can declare commercialReady: false in its
    // manifest. The provenance audit must catch this even if the pair's
    // method (e.g., 'api') is commercial-ready in the static registry.
    const resolvedPairs = new Map();
    resolvedPairs.set('en:fr', {
      source: 'en', target: 'fr', method: 'llm', name: 'French',
    });
    resolvedPairs.set('en:crk', {
      source: 'en', target: 'crk', method: 'api', name: 'Plains Cree',
      pluginProvenance: {
        resources: [{ name: 'Coaching Dataset', license: 'research-only' }],
        commercialReady: false,
        flags: ['RESEARCH_LICENSE', 'REQUIRES_ATTRIBUTION'],
      },
    });

    const audit = auditProvenance(resolvedPairs);

    // 'api' method is commercial-ready in the static registry, but the
    // plugin's own provenance overrides that — it declares non-commercial.
    assert.equal(audit.allClear, false,
      'Plugin provenance should override method-level commercial status');
    assert.ok(audit.blockedPairs.includes('en:crk'));
    assert.ok(audit.flags.includes('RESEARCH_LICENSE'));
    assert.ok(audit.flags.includes('REQUIRES_ATTRIBUTION'));
    // French should still be clear
    assert.ok(!audit.blockedPairs.includes('en:fr'));
  });
});

// =================================================================
// Full pipeline: config → pairs → plugin → method → cost
// =================================================================

describe('sync-pairs: full pipeline config → method → cost estimate', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-pipeline-'));
    muteConsole();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    restoreConsole();
  });

  it('end-to-end: config → pair → method instantiation → cost query', async () => {
    // Step 1: Build pair graph from config
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal French.' },
      },
      pairs: {
        'en:fr': { method: 'google-translate' },
      },
    };

    const pairs = resolvePairs(config);
    const frPair = pairs.get('en:fr');

    // Step 2: Instantiate the method class
    const method = getMethod(frPair.method);
    assert.equal(method.name, 'google-translate');

    // Step 3: Query cost — Google has real documented pricing
    const cost = await method.estimateCost(100, frPair);
    assert.ok(cost.estimatedCost > 0, 'Google should have real pricing');
    assert.equal(cost.source, 'google-cloud-pricing');
    assert.equal(cost.currency, 'USD');
  });

  it('end-to-end: LLM method returns live pricing or unknown', async () => {
    const config = {
      inputLocale: 'en',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      resolvedLanguages: {
        fr: { name: 'French', register: 'Formal.' },
      },
    };

    const pairs = resolvePairs(config);
    const frPair = pairs.get('en:fr');
    const method = getMethod(frPair.method);

    assert.equal(method.name, 'llm');
    const cost = await method.estimateCost(100, frPair);
    // Online: returns real cost from OpenRouter; offline: null with 'unknown' source
    assert.equal(cost.currency, 'USD');
    assert.ok(typeof cost.source === 'string' && cost.source.length > 0);
  });
});
