/**
 * shared-bundle-parity.test.js — the BUNDLED-COPY drift guard for ALL shared SSOT.
 *
 * `npm run sync:shared` copies the monorepo-root SSOT (shared/*.json + selected
 * schemas + catalogue) into the package-bundled cli/shared/, which is what the
 * published npm package ships and what several CLI modules resolve FIRST
 * (cli/lib/license-gate.mjs reads the bundled cli/shared/licenses.json +
 * license-corrections.json before the root SSOT; the Python harness reads the
 * root shared/ copy). If the bundled copy drifts from the SSOT — someone edits
 * root shared/ and forgets `sync:shared`, or edits cli/shared/ directly — the two
 * runtimes silently DISAGREE, and for licenses.json that means the CLI's
 * NC-out-of-commercial / no-redistribute license gate and the harness's license
 * logic can classify the same corpus differently.
 *
 * method-registry.json and model-aliases.json already carry this assertion in
 * their own *-ssot.test.js. This test generalizes it to EVERY bundled file so
 * the license-critical files (licenses.json, license-corrections.json), the
 * metric registry, human-services, and the bundled schemas are covered too —
 * the meta-audit found they were bundled + consumed but had NO drift guard.
 *
 * Tracks the authoritative `sync:shared` manifest (package.json) — the exact set
 * of files that script copies root shared/ -> cli/shared/. If a file is added to
 * sync:shared, add it here (a mismatch is a deliberate, reviewable edit, not a
 * silent gap). Skips (does not fail) when the monorepo-root shared/ is absent — a
 * standalone / published checkout has only the bundled copy, nothing to compare.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_SHARED = path.resolve(__dirname, '..', '..', 'shared');   // monorepo SSOT
const BUNDLED_SHARED = path.resolve(__dirname, '..', 'shared');       // package copy

// EXACTLY the files `npm run sync:shared` copies (see package.json). Mirror any
// change to that manifest here. (Not every file that merely happens to exist in
// both trees — e.g. catalogue/method-coverage.json is maintained separately and
// is NOT a bundled copy — so this list is the contract, not a directory scan.)
const BUNDLE_MANIFEST = [
  'model-aliases.json',
  'method-registry.json',
  'metric-registry.json',
  'human-services.json',
  'licenses.json',
  'license-corrections.json',
  'catalogue/external-results.json',
  'catalogue/method-coverage.json',
  'schemas/external-results.schema.json',
  'schemas/metric-registry.schema.json',
  'schemas/model-aliases.schema.json',
  'schemas/licenses.schema.json',
];

function bundledPairs() {
  return BUNDLE_MANIFEST.map((rel) => ({
    rel: `shared/${rel}`,
    rootFile: path.join(ROOT_SHARED, rel),
    bundledFile: path.join(BUNDLED_SHARED, rel),
  }));
}

describe('shared bundle parity — cli/shared copies match the monorepo SSOT', () => {
  const rootPresent = fs.existsSync(path.join(ROOT_SHARED, 'licenses.json'));

  it('the license-critical files are actually bundled (guards a silent un-bundling)', (t) => {
    if (!rootPresent) return t.skip('monorepo-root shared/ absent (standalone checkout)');
    for (const f of ['licenses.json', 'license-corrections.json']) {
      assert.ok(
        fs.existsSync(path.join(BUNDLED_SHARED, f)),
        `cli/shared/${f} is missing — sync:shared must bundle it (license-gate.mjs resolves the bundled copy first)`,
      );
    }
  });

  it('every bundled SSOT file is byte-identical to its shared/ source', (t) => {
    if (!rootPresent) return t.skip('monorepo-root shared/ absent (standalone checkout)');
    const drifted = [];
    for (const { rel, rootFile, bundledFile } of bundledPairs()) {
      if (!fs.existsSync(rootFile)) continue; // in root SSOT manifest but not on disk here
      assert.ok(fs.existsSync(bundledFile), `${rel} is in the sync:shared manifest but the bundled copy is missing`);
      if (!fs.readFileSync(rootFile).equals(fs.readFileSync(bundledFile))) drifted.push(rel);
    }
    assert.equal(
      drifted.length, 0,
      `bundled cli/shared copies drifted from the SSOT: ${drifted.join(', ')} — run \`npm run sync:shared\` and commit`,
    );
  });
});
