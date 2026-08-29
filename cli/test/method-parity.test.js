/**
 * method-parity.test.js — the check that did not exist.
 *
 * Three things describe a translation method and nothing compared them:
 *
 *   shared/method-registry.json      14 runtime adapters — how to CALL one
 *   shared/catalogue/method-coverage.json  11 hand-typed coverage lists
 *   the atlas                        method nodes, from fetched endpoints
 *
 * Each had its own spelling of the same method — `microsoft-translator` in the
 * registry, `microsoft` in the coverage list — so the queue ranker carried a
 * six-row ENGINE_COVERAGE_KEYS table to translate between them. A
 * hand-maintained mapping is a place for a seventh method to be forgotten, and
 * Apertium proved it: a runtime adapter, no coverage entry, invisible to the
 * map since it was added.
 *
 * These tests hold the identity that replaced the table.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf-8'));

const registry = read('shared/method-registry.json').entries;
// The ASSEMBLED registry, not the JSON. Since the native entries moved into
// their fetchers, the JSON alone no longer describes what the build sees, and
// a test reading it would pass or fail on a file nobody consults.
const { buildRegistry } = await import('../scripts/cldf/source-registry.mjs');
const manifest = (await buildRegistry()).sources;

/** Adapters that actually translate — the LLM providers are a different lane. */
const MT_API = Object.entries(registry)
  .filter(([, v]) => v.kind === 'mt-api')
  .map(([k]) => k);

/** What the vendor fetcher declares it can reach, read from its own source. */
const vendorSource = fs.readFileSync(
  path.join(REPO, 'cli/scripts/fetchers/vendor-languages.mjs'), 'utf-8',
);
const vendorKeys = [...vendorSource.matchAll(/^\s+key: '([^']+)',/gm)].map((m) => m[1]);

describe('one identity, not three spellings', () => {
  test('every vendor the fetcher targets is a method-registry id', () => {
    // This is what makes the join identity rather than a mapping. A vendor key
    // that is not a registry id would need a translation table, and the table
    // is the thing being retired.
    for (const key of vendorKeys) {
      assert.ok(
        Object.hasOwn(registry, key),
        `vendor-languages.mjs targets "${key}", which is not a method-registry id. `
        + `Known: ${MT_API.join(', ')}`,
      );
    }
  });

  test('the fetcher covers every mt-api adapter, or the gap is deliberate', () => {
    // amazon-translate, tilde and translated have adapters and no public
    // language endpoint. That is a real gap and it should be visible here
    // rather than discovered when someone asks why they never enqueue.
    const uncovered = MT_API.filter((k) => !vendorKeys.includes(k));
    const expected = ['amazon-translate', 'tilde', 'translated'];
    assert.deepEqual(
      uncovered.sort(), expected.sort(),
      'an mt-api adapter with no fetcher entry cannot have its coverage checked. '
      + 'If this list changed, either a fetcher was added (update this test) or an '
      + 'adapter was added without one (add it, or record why it has no endpoint).',
    );
  });

  test('the hardcoded ENGINE_COVERAGE_KEYS table is gone', () => {
    // The six-row translation table in the Python ranker. Its whole job was to
    // paper over the naming mismatch this suite now prevents.
    const ranker = fs.readFileSync(
      path.join(REPO, 'arena/scripts/generate_sweep_queue.py'), 'utf-8',
    );
    assert.ok(
      !/^ENGINE_COVERAGE_KEYS\s*=\s*\{[\s\S]*?"google-translate":\s*"google"/m.test(ranker),
      'ENGINE_COVERAGE_KEYS still maps registry ids onto short coverage keys. The two '
      + 'vocabularies were unified so this table has nothing left to translate; keeping '
      + 'it means a seventh method can still be forgotten.',
    );
  });
});

describe('method sources are declared like every other source', () => {
  test('both method sources are in the manifest with a handler', () => {
    for (const src of ['vendor-languages', 'hf-models']) {
      assert.ok(manifest[src], `${src} is not declared in the source manifest`);
      assert.ok(manifest[src].handler, `${src} declares no handler`);
      assert.ok(manifest[src].license, `${src} declares no licence`);
    }
  });

  test('both have a fetcher, so coverage is never transcribed', () => {
    for (const f of ['vendor-languages', 'hf-models']) {
      const p = path.join(REPO, 'cli/scripts/fetchers', `${f}.mjs`);
      assert.ok(fs.existsSync(p), `${f} has no fetcher — its coverage would be typed in`);
      const src = fs.readFileSync(p, 'utf-8');
      assert.match(src, /export const source/, `${f} does not export the fetcher interface`);
      assert.match(src, /export async function fetchSource/, `${f} is invisible to --all`);
    }
  });

  test('a self-attested pin is labelled as one', () => {
    // A vendor endpoint and a Zenodo deposit are not equally solid, and a
    // release that presents them identically invites the wrong confidence.
    for (const f of ['vendor-languages', 'hf-models']) {
      const src = fs.readFileSync(
        path.join(REPO, 'cli/scripts/fetchers', `${f}.mjs`), 'utf-8',
      );
      assert.match(src, /pinQuality: 'self-attested'/, `${f} does not label its pin quality`);
    }
  });
});

describe('the HuggingFace inclusion policy is a decision, in the decision layer', () => {
  const policy = read('shared/catalogue/hf-inclusion-policy.json');

  test('it reads languages from the card, never the tags array', () => {
    // `jax` is also Jambi Malay, `mms` is also Southern Mam, `pt` is also
    // Portuguese. Tag scraping would announce coverage no author claimed.
    assert.equal(policy.languageSource.field, 'cardData.language');
    assert.match(policy.languageSource.reason, /tags array/i);
  });

  test('there is no popularity floor', () => {
    // Founder direction: a download threshold would cut precisely the
    // low-resource fine-tunes this exists to surface.
    const text = JSON.stringify(policy);
    assert.doesNotMatch(text, /"minDownloads"|"downloadFloor"/);
    assert.match(policy._founderDirection, /do not gatekeep on downloads/i);
  });

  test('derivation is declared, never inferred', () => {
    assert.match(policy.derivation.rule, /never infer/i);
    assert.ok(policy.derivation.declared > 0);
  });

  test('collection codes are not expanded into members', () => {
    assert.match(policy.codesThatWillNotResolve.reason, /propagation error|macrolanguage/i);
    for (const c of ['mul', 'multilingual']) {
      assert.ok(policy.codesThatWillNotResolve.examples.includes(c));
    }
  });
});
