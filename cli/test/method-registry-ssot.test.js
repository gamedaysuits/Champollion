import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { METHOD_REGISTRY } from '../lib/translate.js';
import {
  loadMethodManifest,
  manifestEntries,
  cliNameFor,
} from '../lib/method-manifest.js';

// SSOT parity guard: the CLI's METHOD_REGISTRY must not drift from the shared
// method-registry manifest (shared/method-registry.json), which the Python
// harness also enforces (arena/tests/test_method_registry_ssot.py). A method
// added to one runtime but not the manifest fails CI on both sides.

// CLI-only strategy methods that intentionally have no manifest *engine* entry
// (they are dispatch strategies, not engines/providers).
const CLI_ONLY_STRATEGIES = new Set(['llm-coached', 'api', 'external']);

// Documented exemptions for legitimate per-runtime differences in the
// per-method env/max_batch/locale_map parity below. Keyed by
// "<method>.<dimension>" → short reason. Keep this list SHORT: each entry is a
// real divergence, not a TODO. (The NAME/taxonomy checks above never looked at
// per-method *settings*, which is how the manifest could declare
// MICROSOFT_TRANSLATOR_ENDPOINT while the CLI adapter silently never read it.)
const PARITY_EXEMPTIONS = {
  // Apertium's APy translate endpoint takes a single ?q= per GET, so the CLI
  // adapter has no batch-size constant to assert max_batch===1 against.
  'apertium.max_batch': 'per-request single segment; no batch constant',
};

describe('method-registry SSOT parity (CLI ↔ shared manifest)', () => {
  const manifest = loadMethodManifest();

  it('loads the shared manifest', (t) => {
    if (!manifest) return t.skip('shared/method-registry.json not found (standalone)');
    assert.ok(manifest.version, 'manifest declares a version');
    assert.ok(
      manifest.entries && Object.keys(manifest.entries).length > 0,
      'manifest has entries',
    );
  });

  it('every manifest method/provider has a matching CLI method', (t) => {
    if (!manifest) return t.skip('manifest not found');
    for (const [name, entry] of Object.entries(manifestEntries())) {
      // local-model / plugin engines are served via the external subprocess
      // bridge, not a direct METHOD_REGISTRY key (Phase 4) — exempt here.
      if (entry.kind === 'local-model' || entry.kind === 'plugin') continue;
      // Engines that land in one runtime first (e.g. Amazon = harness-only
      // until a CLI SigV4 adapter exists) declare their runtimes.
      if (Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli')) continue;
      const cliName = cliNameFor(name, entry);
      assert.ok(
        Object.prototype.hasOwnProperty.call(METHOD_REGISTRY, cliName),
        `manifest entry "${name}" expects CLI method "${cliName}", missing from METHOD_REGISTRY`,
      );
    }
  });

  it('every CLI engine method is documented in the manifest', (t) => {
    if (!manifest) return t.skip('manifest not found');
    const accounted = new Set(
      Object.entries(manifestEntries()).map(([name, e]) => cliNameFor(name, e)),
    );
    for (const key of Object.keys(METHOD_REGISTRY)) {
      if (CLI_ONLY_STRATEGIES.has(key)) continue;
      assert.ok(
        accounted.has(key),
        `CLI method "${key}" is undocumented in the shared manifest (add it, or list it as a CLI-only strategy)`,
      );
    }
  });

  it('credential_env is a non-empty subset of env (readiness never judges config vars)', (t) => {
    // credential_env marks the CREDENTIAL subset of env — the vars readiness
    // surfaces judge; config vars like AWS_REGION never count. A var only in
    // credential_env would be one the adapter never reads; an empty list
    // would silently mean "no credentials required"; credential_env_all
    // without credential_env has nothing to quantify over. Mirrors
    // arena/tests/test_method_registry_ssot.py.
    if (!manifest) return t.skip('manifest not found');
    for (const [name, entry] of Object.entries(manifestEntries())) {
      if (entry.credential_env === undefined) {
        assert.ok(!entry.credential_env_all,
          `${name}: credential_env_all declared without credential_env`);
        continue;
      }
      assert.ok(Array.isArray(entry.credential_env) && entry.credential_env.length > 0,
        `${name}: credential_env must be a non-empty array when declared`);
      const envSet = new Set(entry.env || []);
      const extraVars = entry.credential_env.filter((v) => !envSet.has(v));
      assert.deepEqual(extraVars, [],
        `${name}: credential_env vars ${JSON.stringify(extraVars)} are not in env — the adapter never reads them`);
    }
  });

  it('bundled cli/shared copy matches the monorepo SSOT', (t) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, '..', '..', 'shared', 'method-registry.json');
    const bundled = path.resolve(__dirname, '..', 'shared', 'method-registry.json');
    let rootRaw;
    let bundledRaw;
    try { rootRaw = fs.readFileSync(root, 'utf-8'); } catch { return t.skip('monorepo shared/ absent'); }
    try { bundledRaw = fs.readFileSync(bundled, 'utf-8'); } catch { return t.skip('cli/shared copy absent'); }
    assert.deepEqual(
      JSON.parse(bundledRaw),
      JSON.parse(rootRaw),
      'cli/shared/method-registry.json drifted from shared/method-registry.json — re-copy it',
    );
  });
});

// =================================================================
// Per-method adapter parity: env vars, max_batch, locale_map
//
// The NAME/taxonomy guards above catch a method present in one runtime but not
// the manifest. They do NOT catch a per-method *setting* drifting from its
// adapter — which is exactly how MICROSOFT_TRANSLATOR_ENDPOINT could be declared
// in the manifest (and honored by the Python harness) while the CLI adapter
// hardcoded the global endpoint and silently ignored it. These assertions close
// that gap for every mt-api method that has a CLI adapter.
// =================================================================
describe('manifest ↔ CLI adapter parity (env / max_batch / locale_map)', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const methodsDir = path.resolve(__dirname, '..', 'lib', 'methods');
  const manifest = loadMethodManifest();

  // The CLI resolves provider keys (incl. aliases like GOOGLE_API_KEY and
  // AZURE_TRANSLATOR_KEY) through this shared SSOT, so provider-env.js is part
  // of every adapter's env-resolution surface — search it alongside the adapter.
  let providerEnvSrc = '';
  try { providerEnvSrc = fs.readFileSync(path.join(methodsDir, 'provider-env.js'), 'utf-8'); } catch { /* optional */ }

  function adapterSource(name) {
    return fs.readFileSync(path.join(methodsDir, `${name}.js`), 'utf-8');
  }

  // mt-api manifest entries that have a CLI adapter (skip harness-only ones,
  // e.g. amazon-translate until a CLI SigV4 adapter exists).
  function cliMtApiEntries() {
    return Object.entries(manifestEntries('mt-api')).filter(
      ([, e]) => !(Array.isArray(e.runtimes) && !e.runtimes.includes('cli')),
    );
  }

  it('every manifest env var is referenced by the CLI adapter source', (t) => {
    if (!manifest) return t.skip('manifest not found');
    for (const [name, entry] of cliMtApiEntries()) {
      const src = `${adapterSource(name)}\n${providerEnvSrc}`;
      for (const envVar of entry.env || []) {
        if (PARITY_EXEMPTIONS[`${name}.env:${envVar}`]) continue;
        assert.ok(
          src.includes(envVar),
          `manifest declares env "${envVar}" for "${name}" but cli/lib/methods/${name}.js (+ provider-env.js) never references it`,
        );
      }
    }
  });

  it('max_batch matches the cap the CLI adapter encodes', (t) => {
    if (!manifest) return t.skip('manifest not found');
    for (const [name, entry] of cliMtApiEntries()) {
      if (entry.max_batch == null) continue;
      if (PARITY_EXEMPTIONS[`${name}.max_batch`]) continue;
      // CLI adapters encode the per-provider segment cap as a numeric default
      // (e.g. "|| 100", "MAX_SEGMENTS_PER_REQUEST = 128", "TILDE_MAX_BATCH = 25").
      // Assert that exact literal is present; a drift to a different cap fails.
      const src = adapterSource(name);
      assert.ok(
        new RegExp(`\\b${entry.max_batch}\\b`).test(src),
        `manifest max_batch=${entry.max_batch} for "${name}" not found in cli/lib/methods/${name}.js`,
      );
    }
  });

  it('non-empty locale_map entries are reflected in the CLI adapter source', (t) => {
    if (!manifest) return t.skip('manifest not found');
    for (const [name, entry] of cliMtApiEntries()) {
      const map = entry.locale_map || {};
      if (Object.keys(map).length === 0) continue;
      const src = adapterSource(name);
      for (const [from, to] of Object.entries(map)) {
        assert.ok(
          src.includes(from) && src.includes(to),
          `manifest locale_map ${from}→${to} for "${name}" not reflected in cli/lib/methods/${name}.js`,
        );
      }
    }
  });
});
