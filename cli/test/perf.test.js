/**
 * Performance regression gate — asserts local operations stay fast.
 *
 * WHY THESE EXIST:
 *   The existing benchmark infrastructure (test/benchmark/) runs live API
 *   calls against 6 models × 39 languages. That's a quality benchmark,
 *   not a regression gate. This file tests the operations that MUST stay
 *   fast: flattening, diffing, hashing, and pair resolution.
 *
 *   If someone accidentally introduces an O(n²) loop in flatten.js or
 *   adds synchronous I/O to the diff engine, these tests catch it.
 *
 * STRATEGY:
 *   - Generate large fixture data programmatically (no fixture files)
 *   - Use performance.now() for high-resolution timing
 *   - Run each operation 3 times and take the median (smooths GC jitter)
 *   - Thresholds are 10x typical wall time — generous enough to avoid
 *     flaky failures on slow CI runners, tight enough to catch O(n²)
 *
 * COST: Zero API calls. Everything is local computation.
 * RUNTIME: <500ms total.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

import { flattenKeys, setNestedValue } from '../lib/flatten.js';
import { diffLocale } from '../lib/diff.js';
import { buildHashManifest, detectChangedKeys } from '../lib/hash.js';
import { resolvePairs } from '../lib/pairs.js';
import { resolveConfig } from '../lib/config.js';

// -----------------------------------------------------------------
// Data generators — build large fixtures programmatically
// -----------------------------------------------------------------

/**
 * Generate a deeply nested JSON object with N leaf keys.
 *
 * Structure: 10 top-level categories × 10 subcategories × 10 keys each = 1,000 keys.
 * Adjust depth/breadth via arguments.
 *
 * @param {number} categories - Number of top-level groups
 * @param {number} subcategories - Number of sub-groups per category
 * @param {number} keysPerSub - Number of leaf keys per subcategory
 * @returns {object} Nested object
 */
function generateNestedObject(categories = 10, subcategories = 10, keysPerSub = 10) {
  const obj = {};
  for (let c = 0; c < categories; c++) {
    obj[`category_${c}`] = {};
    for (let s = 0; s < subcategories; s++) {
      obj[`category_${c}`][`sub_${s}`] = {};
      for (let k = 0; k < keysPerSub; k++) {
        obj[`category_${c}`][`sub_${s}`][`key_${k}`] = `Value for c${c}.s${s}.k${k}`;
      }
    }
  }
  return obj;
}

/**
 * Generate a flat key-value map with N keys.
 *
 * @param {number} n - Number of keys
 * @param {string} prefix - Optional value prefix for differentiation
 * @returns {object} Flat key → value map
 */
function generateFlatMap(n, prefix = '') {
  const map = {};
  for (let i = 0; i < n; i++) {
    map[`category_${Math.floor(i / 100)}.sub_${Math.floor(i / 10) % 10}.key_${i % 10}`] = `${prefix}Value ${i}`;
  }
  return map;
}

/**
 * Generate a config object that mirrors a real 35-language project.
 *
 * @returns {object} Resolved config-like object with languages and pairs
 */
function generateLargeConfig() {
  const languages = [
    'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'es', 'fa', 'fi',
    'fr', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'ms', 'nl',
    'no', 'pl', 'pt', 'pt-PT', 'ro', 'ru', 'sk', 'sv', 'sw', 'th',
    'tl', 'tr', 'uk', 'ur', 'vi', 'zh',
  ];

  const resolvedLanguages = {};
  for (const code of languages) {
    resolvedLanguages[code] = {
      name: code.toUpperCase(),
      register: 'Professional register.',
    };
  }

  return {
    version: 3,
    inputLocale: 'en',
    localesDir: '/tmp/fake-locales',
    model: 'google/gemini-3.5-flash',
    defaultMethod: 'llm',
    batchSize: 30,
    languages,
    resolvedLanguages,
    pairs: {
      // 5 explicit pair overrides — tests the merge logic
      'en:ja': { method: 'llm', model: 'google/gemini-3.5-flash', batchSize: 15 },
      'en:zh': { method: 'llm', model: 'google/gemini-3.5-flash', batchSize: 15 },
      'en:ko': { method: 'llm', model: 'google/gemini-3.5-flash', batchSize: 15 },
      'en:ar': { method: 'llm', model: 'google/gemini-3.5-flash', batchSize: 20 },
      'en:fa': { method: 'llm', model: 'google/gemini-3.5-flash', batchSize: 20 },
    },
  };
}

// -----------------------------------------------------------------
// Timing utility — run N iterations and return the median
// -----------------------------------------------------------------

/**
 * Run a function N times and return the median execution time in ms.
 *
 * @param {function} fn - Synchronous function to time
 * @param {number} iterations - Number of iterations (default: 3)
 * @returns {{ medianMs: number, allMs: number[] }}
 */
function timedMedian(fn, iterations = 3) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return { medianMs: median, allMs: times };
}

/**
 * Async version of timedMedian.
 */
async function timedMedianAsync(fn, iterations = 3) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return { medianMs: median, allMs: times };
}

// -----------------------------------------------------------------
// Tests: Core computation performance
// -----------------------------------------------------------------

describe('perf — core computation regression gates', () => {

  it('flattenKeys: 1,000-key nested object completes under 50ms', () => {
    const nested = generateNestedObject(10, 10, 10); // 1,000 keys

    const { medianMs, allMs } = timedMedian(() => {
      const flat = flattenKeys(nested);
      // Sanity: verify it actually flattened
      assert.equal(Object.keys(flat).length, 1000);
    });

    assert.ok(
      medianMs < 50,
      `flattenKeys took ${medianMs.toFixed(2)}ms (median of [${allMs.map(t => t.toFixed(2)).join(', ')}]ms) — threshold is 50ms`
    );
  });

  it('flattenKeys: 5,000-key object stays under 200ms', () => {
    // 5x larger — verifies linear scaling, not quadratic
    const nested = generateNestedObject(10, 10, 50); // 5,000 keys

    const { medianMs, allMs } = timedMedian(() => {
      const flat = flattenKeys(nested);
      assert.equal(Object.keys(flat).length, 5000);
    });

    assert.ok(
      medianMs < 200,
      `flattenKeys (5k) took ${medianMs.toFixed(2)}ms — threshold is 200ms (expect ~5x of 1k time)`
    );
  });

  it('diffLocale: 1,000-key diff completes under 50ms', () => {
    const source = generateFlatMap(1000);

    // Target: 500 keys present (some up-to-date, some [EN] fallback), 500 missing
    const target = {};
    const keys = Object.keys(source);
    for (let i = 0; i < 500; i++) {
      const key = keys[i];
      if (i < 250) {
        // Up-to-date
        target[key] = `Translated ${i}`;
      } else {
        // [EN] fallback — needs re-translation
        target[key] = `[EN] ${source[key]}`;
      }
    }

    const { medianMs, allMs } = timedMedian(() => {
      const diff = diffLocale(source, target, '[EN] ');
      // 500 missing + 250 [EN] fallback = 750 toProcess
      assert.equal(diff.missing.length, 500);
      assert.equal(diff.needsTranslation.length, 250);
      assert.equal(diff.toProcess.length, 750);
    });

    assert.ok(
      medianMs < 50,
      `diffLocale took ${medianMs.toFixed(2)}ms — threshold is 50ms`
    );
  });

  it('buildHashManifest: 1,000-key manifest under 100ms', () => {
    const source = generateFlatMap(1000);

    const { medianMs, allMs } = timedMedian(() => {
      const manifest = buildHashManifest(source);
      assert.equal(Object.keys(manifest).length, 1000);
      // Verify hash is a hex string
      const firstHash = Object.values(manifest)[0];
      assert.match(firstHash, /^[a-f0-9]{64}$/);
    });

    assert.ok(
      medianMs < 100,
      `buildHashManifest took ${medianMs.toFixed(2)}ms — threshold is 100ms`
    );
  });

  it('detectChangedKeys: 1,000-key manifest with 50 changes under 50ms', () => {
    const source = generateFlatMap(1000);
    const oldManifest = buildHashManifest(source);

    // Mutate 50 keys in the source
    const mutatedSource = { ...source };
    const keys = Object.keys(mutatedSource);
    for (let i = 0; i < 50; i++) {
      mutatedSource[keys[i]] = `CHANGED ${i}`;
    }

    const { medianMs, allMs } = timedMedian(() => {
      const changed = detectChangedKeys(mutatedSource, oldManifest);
      assert.equal(changed.length, 50);
    });

    assert.ok(
      medianMs < 50,
      `detectChangedKeys took ${medianMs.toFixed(2)}ms — threshold is 50ms`
    );
  });

  it('resolvePairs: 35-language config with 5 overrides under 20ms', () => {
    const config = generateLargeConfig();

    const { medianMs, allMs } = timedMedian(() => {
      const pairs = resolvePairs(config);
      // 36 languages = 36 pairs (en→X for each)
      assert.equal(pairs.size, 36);
    });

    assert.ok(
      medianMs < 20,
      `resolvePairs took ${medianMs.toFixed(2)}ms — threshold is 20ms`
    );
  });
});

// -----------------------------------------------------------------
// Tests: Integration-level performance (full dry-run sync)
// -----------------------------------------------------------------

describe('perf — dry-run sync regression gate', () => {

  it('full dry-run sync with 500 keys × 3 locales completes under 500ms', async () => {
    // Create a temp directory with real config and locale files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-perf-'));
    const localesDir = path.join(tmpDir, 'locales');
    fs.mkdirSync(localesDir, { recursive: true });

    try {
      // Generate source locale (500 keys, nested)
      const sourceNested = generateNestedObject(5, 10, 10); // 500 keys
      fs.writeFileSync(
        path.join(localesDir, 'en.json'),
        JSON.stringify(sourceNested, null, 2)
      );

      // Generate 3 target locales (partially translated)
      for (const lang of ['fr', 'de', 'ja']) {
        const target = {};
        const flat = flattenKeys(sourceNested);
        const keys = Object.keys(flat);
        // First 300 keys are "translated", last 200 are missing
        for (let i = 0; i < 300; i++) {
          setNestedValue(target, keys[i], `[${lang}] ${flat[keys[i]]}`);
        }
        fs.writeFileSync(
          path.join(localesDir, `${lang}.json`),
          JSON.stringify(target, null, 2)
        );
      }

      // Config
      const config = {
        version: 3,
        inputLocale: 'en',
        localesDir: './locales',
        languages: ['fr', 'de', 'ja'],
        model: 'google/gemini-3.5-flash',
        batchSize: 30,
      };
      fs.writeFileSync(
        path.join(tmpDir, 'champollion.config.json'),
        JSON.stringify(config, null, 2)
      );

      // Dynamic import to avoid pulling in the entire sync module at file load
      const { runSync } = await import('../lib/sync.js');

      const { medianMs, allMs } = await timedMedianAsync(async () => {
        await runSync({
          dryRun: true,
          cwd: tmpDir,
          cliArgs: {},
        });
      });

      assert.ok(
        medianMs < 500,
        `dry-run sync took ${medianMs.toFixed(2)}ms (median of [${allMs.map(t => t.toFixed(2)).join(', ')}]ms) — threshold is 500ms`
      );

    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
