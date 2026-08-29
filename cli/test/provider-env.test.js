#!/usr/bin/env node
/**
 * Provider env-var SSOT + loader/readiness parity tests.
 *
 * The bug this guards: the Microsoft loader (`_resolveApiKey`) read only
 * MICROSOFT_TRANSLATOR_API_KEY while `doctor`/readiness accepted only
 * AZURE_TRANSLATOR_KEY — so a user who set AZURE_TRANSLATOR_KEY got a green
 * "ready" but the loader returned null and the run silently produced nothing.
 * Google had the inverse mismatch.
 *
 * Contract: the loader, the readiness check, and `doctor` all resolve a
 * provider's key through the SAME name set (canonical + aliases). So:
 *   - setting the canonical name OR any alias makes BOTH the loader and
 *     readiness succeed, and
 *   - doctor can never report "ready" under a name the loader won't read.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PROVIDER_ENV,
  providerEnvNames,
  canonicalEnvName,
  resolveProviderEnv,
} from '../lib/methods/provider-env.js';
import { GoogleTranslateMethod } from '../lib/methods/google-translate.js';
import { MicrosoftTranslatorMethod } from '../lib/methods/microsoft-translator.js';

// Every env var this suite might touch — cleared between tests so a real
// developer key in the ambient environment can't make assertions flaky.
const MANAGED_VARS = [
  'GOOGLE_TRANSLATE_API_KEY', 'GOOGLE_API_KEY',
  'MICROSOFT_TRANSLATOR_API_KEY', 'AZURE_TRANSLATOR_KEY',
  'DEEPL_API_KEY',
  'LIBRETRANSLATE_API_URL', 'LIBRETRANSLATE_URL', 'LIBRE_URL',
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
];

function snapshotEnv() {
  const saved = {};
  for (const v of MANAGED_VARS) saved[v] = process.env[v];
  return saved;
}
function restoreEnv(saved) {
  for (const v of MANAGED_VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
}
function clearManaged() {
  for (const v of MANAGED_VARS) delete process.env[v];
}

// =================================================================
// SSOT shape
// =================================================================
describe('provider-env SSOT', () => {
  let saved;
  afterEach(() => restoreEnv(saved));

  it('canonical name is always first in the name list', () => {
    saved = snapshotEnv();
    for (const method of Object.keys(PROVIDER_ENV)) {
      const names = providerEnvNames(method);
      assert.equal(names[0], canonicalEnvName(method));
      assert.ok(names.length >= 1);
    }
  });

  it('returns [] / null for an unknown provider', () => {
    saved = snapshotEnv();
    assert.deepEqual(providerEnvNames('not-a-provider'), []);
    assert.equal(canonicalEnvName('not-a-provider'), null);
    assert.deepEqual(resolveProviderEnv('not-a-provider'), { value: null, name: null });
  });

  it('resolves a value under the canonical name AND every alias, reporting which', () => {
    saved = snapshotEnv();
    for (const method of Object.keys(PROVIDER_ENV)) {
      for (const name of providerEnvNames(method)) {
        clearManaged();
        process.env[name] = `val-${name}`;
        const { value, name: resolvedName } = resolveProviderEnv(method);
        assert.equal(value, `val-${name}`, `${method}: ${name} should resolve`);
        assert.equal(resolvedName, name, `${method}: should report ${name}`);
      }
    }
  });

  it('prefers the canonical name when both canonical and alias are set', () => {
    saved = snapshotEnv();
    clearManaged();
    process.env.GOOGLE_API_KEY = 'alias-value';
    process.env.GOOGLE_TRANSLATE_API_KEY = 'canonical-value';
    const { value, name } = resolveProviderEnv('google-translate');
    assert.equal(value, 'canonical-value');
    assert.equal(name, 'GOOGLE_TRANSLATE_API_KEY');
  });
});

// =================================================================
// Loader ⇄ readiness parity (the actual regression)
// =================================================================
describe('loader ⇄ readiness parity', () => {
  let saved;
  afterEach(() => restoreEnv(saved));

  // For each (method instance, env var name) the loader and readiness must
  // AGREE: both succeed under the canonical name and under each alias.
  const cases = [
    { label: 'Google · canonical', make: () => new GoogleTranslateMethod(), method: 'google-translate', name: 'GOOGLE_TRANSLATE_API_KEY' },
    { label: 'Google · alias',     make: () => new GoogleTranslateMethod(), method: 'google-translate', name: 'GOOGLE_API_KEY' },
    { label: 'Microsoft · canonical', make: () => new MicrosoftTranslatorMethod(), method: 'microsoft-translator', name: 'MICROSOFT_TRANSLATOR_API_KEY' },
    { label: 'Microsoft · alias',     make: () => new MicrosoftTranslatorMethod(), method: 'microsoft-translator', name: 'AZURE_TRANSLATOR_KEY' },
  ];

  for (const c of cases) {
    it(`${c.label}: loader resolves the key AND readiness passes`, () => {
      saved = snapshotEnv();
      clearManaged();
      process.env[c.name] = 'secret-123';

      const method = c.make();
      // Loader: the private resolver translate() actually calls.
      const loaded = method._resolveApiKey({});
      assert.equal(loaded, 'secret-123', `loader must read ${c.name}`);

      // Readiness: preflight gate.
      const readiness = method.checkReadiness({});
      assert.equal(readiness.ready, true, `readiness must pass for ${c.name}`);
    });
  }

  it('regression: AZURE_TRANSLATOR_KEY alone makes the Microsoft loader run (not just readiness)', () => {
    saved = snapshotEnv();
    clearManaged();
    process.env.AZURE_TRANSLATOR_KEY = 'azure-only';

    const method = new MicrosoftTranslatorMethod();
    assert.equal(method.checkReadiness({}).ready, true, 'readiness ready');
    assert.equal(
      method._resolveApiKey({}), 'azure-only',
      'loader MUST also read AZURE_TRANSLATOR_KEY — otherwise doctor says ready but the run produces null',
    );
  });

  it('both report not-ready when no name is set', () => {
    saved = snapshotEnv();
    clearManaged();
    for (const make of [() => new GoogleTranslateMethod(), () => new MicrosoftTranslatorMethod()]) {
      const method = make();
      assert.equal(method._resolveApiKey({}), null);
      assert.equal(method.checkReadiness({}).ready, false);
    }
  });
});

// =================================================================
// doctor ⇄ loader parity
// =================================================================
describe('doctor ⇄ loader parity', () => {
  let saved;
  afterEach(() => restoreEnv(saved));

  // `doctor` now resolves SSOT-backed providers through resolveProviderEnv —
  // exactly what the method loaders use. Assert that for every accepted name,
  // the value doctor would see is the value the loader would read.
  it('doctor sees the same value the loader reads, for every provider/name', () => {
    saved = snapshotEnv();
    const loaders = {
      'google-translate': (o) => new GoogleTranslateMethod()._resolveApiKey(o),
      'microsoft-translator': (o) => new MicrosoftTranslatorMethod()._resolveApiKey(o),
    };
    for (const [method, loaderFn] of Object.entries(loaders)) {
      for (const name of providerEnvNames(method)) {
        clearManaged();
        process.env[name] = `k-${name}`;
        const doctorValue = resolveProviderEnv(method).value; // what doctor checks
        const loaderValue = loaderFn({});                     // what the run reads
        assert.equal(doctorValue, loaderValue,
          `${method}/${name}: doctor and loader must agree`);
        assert.equal(doctorValue, `k-${name}`);
      }
    }
  });
});

// =================================================================
// readiness ⇄ loader parity for keys set ONLY in .env.local
// =================================================================
// The bug this guards (prelaunch verification, 2026-07-07): the direct
// LLM/API providers' checkReadiness() checked bare process.env.<KEY>,
// while _resolveApiKey() — what translate() actually calls — also reads
// .env.local/.env in the project cwd. A user who followed the method's
// own setup help ("add to .env.local: GEMINI_API_KEY=...") failed
// preflight forever, even though the run itself would have found the key.
describe('readiness ⇄ loader parity for .env.local-only keys', () => {
  let saved;
  let tmpDir;
  afterEach(() => {
    restoreEnv(saved);
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  const cases = [
    { label: 'Gemini',    name: 'GEMINI_API_KEY',    make: async () => new (await import('../lib/methods/gemini.js')).GeminiMethod() },
    { label: 'OpenAI',    name: 'OPENAI_API_KEY',    make: async () => new (await import('../lib/methods/openai.js')).OpenAIMethod() },
    { label: 'Anthropic', name: 'ANTHROPIC_API_KEY', make: async () => new (await import('../lib/methods/anthropic.js')).AnthropicMethod() },
    { label: 'DeepL',     name: 'DEEPL_API_KEY',     make: async () => new (await import('../lib/methods/deepl.js')).DeepLMethod() },
  ];

  for (const c of cases) {
    it(`${c.label}: key only in cwd/.env.local — loader resolves AND readiness passes`, async () => {
      saved = snapshotEnv();
      clearManaged();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-envlocal-'));
      fs.writeFileSync(path.join(tmpDir, '.env.local'), `${c.name}=file-secret-42\n`);

      const method = await c.make();
      // Loader: the private resolver translate() actually calls.
      assert.equal(method._resolveApiKey({ cwd: tmpDir }), 'file-secret-42',
        `loader must read ${c.name} from .env.local`);
      // Readiness: the preflight gate must agree with the loader.
      assert.equal(method.checkReadiness({ cwd: tmpDir }).ready, true,
        `readiness must pass when ${c.name} is only in .env.local`);
    });

    it(`${c.label}: no key anywhere — both loader and readiness fail, naming ${c.name}`, async () => {
      saved = snapshotEnv();
      clearManaged();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-envlocal-'));

      const method = await c.make();
      assert.equal(method._resolveApiKey({ cwd: tmpDir }), null);
      const readiness = method.checkReadiness({ cwd: tmpDir });
      assert.equal(readiness.ready, false);
      assert.ok(readiness.reason.includes(c.name),
        `reason must name ${c.name} (got: ${readiness.reason})`);
    });
  }
});
