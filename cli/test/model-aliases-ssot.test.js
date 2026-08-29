import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SSOT parity guard: the package-bundled cli/shared/model-aliases.json must not
// drift from the monorepo-root SSOT (shared/model-aliases.json). Both tools read
// these convenience aliases — the CLI from cli/lib/models.js, the Python harness
// from config._load_model_aliases (whose standalone fallback the arena suite pins
// against the same SSOT in tests/test_model_alias_ssot.py). A bundled copy that
// drifts ships a pip/npm pair that resolves `gemini-pro` (etc.) differently.
//
// Mirrors the 'bundled cli/shared copy matches the monorepo SSOT' case in
// method-registry-ssot.test.js.

describe('model-aliases SSOT parity (cli/shared ↔ monorepo SSOT)', () => {
  it('bundled cli/shared copy matches the monorepo SSOT', (t) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, '..', '..', 'shared', 'model-aliases.json');
    const bundled = path.resolve(__dirname, '..', 'shared', 'model-aliases.json');
    let rootRaw;
    let bundledRaw;
    try { rootRaw = fs.readFileSync(root, 'utf-8'); } catch { return t.skip('monorepo shared/ absent'); }
    try { bundledRaw = fs.readFileSync(bundled, 'utf-8'); } catch { return t.skip('cli/shared copy absent'); }
    assert.deepEqual(
      JSON.parse(bundledRaw),
      JSON.parse(rootRaw),
      'cli/shared/model-aliases.json drifted from shared/model-aliases.json — re-copy it',
    );
  });
});
