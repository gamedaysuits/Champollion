/**
 * pins-tracked.test.js — a pin nobody else can see is not a pin.
 *
 * `cli/data/` is gitignored: it holds 4.6 GB of fetched datasets, and corpus
 * CONTENT is never tracked here on principle. But each source's SNAPSHOT.json
 * is force-added past that rule, because the snapshot is the PIN — the release,
 * the retrieval date, the licence and the sha256 of every file. It is what
 * makes "same pins in, same cards out" a claim anyone can check instead of one
 * they have to take on faith.
 *
 * Seven pins had silently missed the force-add: every fetcher written in one
 * sitting, because `git add` skips an ignored path without saying so and the
 * build reads the working tree, where the file is present either way. Nothing
 * failed. The sources simply were not reproducible by anyone who cloned the
 * repo, and no existing check looked.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.join(import.meta.dirname, '..', '..');
const DATA = path.join(REPO, 'cli', 'data');

describe('every fetched source commits its pin', () => {
  test('each SNAPSHOT.json on disk is tracked by git', () => {
    if (!fs.existsSync(DATA)) return;
    const tracked = new Set(
      execFileSync('git', ['ls-files', 'cli/data'], { cwd: REPO, encoding: 'utf-8' })
        .split('\n').filter(Boolean),
    );
    const missing = fs.readdirSync(DATA, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `cli/data/${d.name}/SNAPSHOT.json`)
      .filter((p) => fs.existsSync(path.join(REPO, p)) && !tracked.has(p));

    assert.deepEqual(
      missing, [],
      `these pins exist on disk but are not in git:\n  ${missing.join('\n  ')}\n`
      + 'cli/data/ is ignored, so a SNAPSHOT needs `git add -f`. Without it the source '
      + 'builds fine here and is unreproducible everywhere else.',
    );
  });

  test('every tracked pin names a source, a licence and a checksum', () => {
    if (!fs.existsSync(DATA)) return;
    for (const d of fs.readdirSync(DATA, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = path.join(DATA, d.name, 'SNAPSHOT.json');
      if (!fs.existsSync(p)) continue;
      const snap = JSON.parse(fs.readFileSync(p, 'utf-8'));
      assert.ok(snap.source, `${d.name}: no source name`);
      assert.ok(snap.license, `${d.name}: no licence — every value it writes inherits this`);
      // The checksum is what makes the pin a pin rather than a note about when
      // somebody last downloaded something.
      for (const f of snap.files ?? []) {
        assert.ok(f.sha256, `${d.name}/${f.path}: no sha256`);
      }
    }
  });
});

describe('integrity is checked centrally, not by convention', () => {
  const build = fs.readFileSync(
    path.join(REPO, 'cli', 'scripts', 'cldf', 'build-atlas.mjs'), 'utf-8',
  );

  test('the build re-hashes each source before dispatching its handler', () => {
    // The header has always promised this. For a long time it was true only
    // because 18 of 21 handlers happened to call verify() themselves — which
    // covered 186 of 187 sources, and the one that did not went unnoticed for
    // exactly as long as verification was a habit rather than a checkpoint.
    // A per-handler convention cannot tell you it has a hole in it.
    assert.match(
      build, /const v = verify\(name\);/,
      'build-atlas.mjs does not verify sources centrally, so a handler that forgets to '
      + 'call verify() reads unpinned bytes and nothing says so.',
    );
    assert.match(build, /import \{ verify \} from '\.\.\/fetchers\/lib\/fetch-lib\.mjs'/);
  });

  test('a drifted source stops the build rather than being reported', () => {
    assert.match(
      build, /does not match its SNAPSHOT[\s\S]{0,400}process\.exit\(1\)/,
      'drift must be fatal: values read from bytes that are not the pinned bytes would '
      + 'cite a release they did not come from',
    );
  });

  test('sources that cannot be re-hashed are named on every build', () => {
    // Hand-transcribed sources have no upstream to re-hash against. Excluding
    // them from the count silently would make the integrity number a claim
    // about a subset while reading like a claim about everything.
    assert.match(build, /hand-transcribed and UNPINNABLE/);
    assert.match(build, /re-hashed against their SNAPSHOT/);
  });
});

describe('the snapshot schema exists and the door enforces it', () => {
  const schema = JSON.parse(fs.readFileSync(
    path.join(REPO, 'shared', 'schemas', 'source-snapshot.schema.json'), 'utf-8',
  ));

  test('every pin on disk satisfies the schema it has always pointed at', () => {
    // The $schema pointer predates the schema by months. Now that the file
    // exists, an existing pin that violates it is a fetcher writing something
    // the door would refuse today.
    if (!fs.existsSync(DATA)) return;
    const problems = [];
    for (const d of fs.readdirSync(DATA, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = path.join(DATA, d.name, 'SNAPSHOT.json');
      if (!fs.existsSync(p)) continue;
      const snap = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const field of schema.required) {
        if (snap[field] === undefined) problems.push(`${d.name}: missing ${field}`);
      }
      if (snap.pin && !schema.properties.pin.properties.kind.enum.includes(snap.pin.kind)) {
        problems.push(`${d.name}: pin.kind "${snap.pin.kind}" not in the schema enum`);
      }
      for (const f of snap.files ?? []) {
        if (!/^[0-9a-f]{64}$/.test(f.sha256 ?? '')) problems.push(`${d.name}: bad sha256`);
      }
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  test('the door and the schema agree on what a pin kind is', async () => {
    // The validator in writeSnapshot is hand-coded (no schema library in the
    // CLI's dependencies), so this is the check that keeps the two declarations
    // from drifting — the same shape as the Variant_Type vocabulary test.
    const lib = fs.readFileSync(
      path.join(REPO, 'cli', 'scripts', 'fetchers', 'lib', 'fetch-lib.mjs'), 'utf-8',
    );
    const m = /PIN_KINDS = new Set\(\[([^\]]*)\]\)/.exec(lib);
    assert.ok(m, 'writeSnapshot no longer enforces pin kinds');
    const inCode = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    assert.deepEqual(inCode, [...schema.properties.pin.properties.kind.enum].sort());
  });
});

describe('an owner changing their terms is the loudest signal, not a version note', () => {
  test('behindUpstream reports a licence change distinctly from a release', async () => {
    // The pin froze the terms our copy shipped under — a grant is not
    // retroactively rewritten. But the re-pin decision must be made LOOKING AT
    // the new terms, so the detector carries them, named, rather than letting
    // "a newer version exists" swallow "the owner now says something else".
    const { behindUpstream } = await import('../scripts/cldf/source-registry.mjs');
    for (const b of behindUpstream()) {
      assert.ok('termsChanged' in b,
        `${b.source}: drift entry does not say whether the owner changed terms`);
      if (b.termsChanged) {
        assert.ok(b.pinnedLicense && b.upstreamLicense,
          `${b.source}: a terms change must name both sets of terms — a boolean alone `
          + 'makes a human go and look up what the owner actually said');
      }
    }
  });
});
