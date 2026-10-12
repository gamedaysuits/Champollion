/**
 * tm seed tests — back-filling the TM from existing translations.
 *
 * THE SCENARIO THIS PROTECTS: a project upgrades to block-level TM with a
 * full set of already-translated content files. The TM is empty for all of
 * them (entries only appear as files are re-translated), so a lost or
 * clobbered .champollion-content.lock re-bills everything through the API.
 * After `champollion tm seed`, those files must survive lock loss AND lock
 * corruption with ZERO engine calls.
 *
 * Safety contract under test:
 *   - only files whose lock entry matches the current source hash are seeded
 *   - block seeding requires EXACTLY matching block counts (never guess)
 *   - '[EN] ' fallback targets are never seeded (TM poison)
 *   - dry-run writes nothing
 *   - entries land under tmMethodKey, where sync will look them up
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { seedTMFromExisting } from '../lib/tm-seed.js';
import { runContentSync } from '../lib/sync.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { loadTM, lookupTM, tmSize, tmMethodKey, TM_DIR, TM_FILENAME } from '../lib/tm.js';
import { CONTENT_LOCK_FILENAME } from '../lib/content-sync.js';
import { splitBlocks } from '../lib/segment.js';
import { parseContentFile, protectBlocks, restoreBlocks } from '../lib/content.js';

/**
 * Replicate the sync engines' block cache unit independently of tm-seed.js:
 * protect → split → keep translatable → restore. Assertions built on this
 * prove the seeder stored entries where the REAL sync path will look.
 */
function syncStyleBlocks(body) {
  const { protectedBody, blocks } = protectBlocks(body);
  return splitBlocks(protectedBody)
    .filter(seg => seg.type === 'translatable')
    .map(seg => restoreBlocks(seg.text, blocks));
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-seed-'));
}

function write(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

function writeLock(dir, entries) {
  write(dir, CONTENT_LOCK_FILENAME, JSON.stringify(entries, null, 2) + '\n');
}

// Scripted fake method — records every API touch so tests can prove the
// engine was never consulted (same pattern as content-sync.test.js).
class FakeSeedMethod {
  async translate(keys, sourceFlat) {
    FakeSeedMethod.batchCalls.push([...keys]);
    const out = {};
    for (const k of keys) out[k] = `FR:${sourceFlat[k]}`;
    return out;
  }

  async translateContent(prompt) {
    FakeSeedMethod.contentCalls.push(prompt);
    // Block-batch prompt: echo each ⟦SEG_N⟧ marker with a transformed
    // segment (same idiom as content-sync.test.js FakeContentMethod).
    const matches = [...prompt.matchAll(/⟦SEG_(\d+)⟧\n([\s\S]*?)(?=\n\n⟦SEG_|$)/g)];
    if (matches.length > 0) {
      return matches.map(m => `⟦SEG_${m[1]}⟧\nFR-ENGINE<${m[2]}>`).join('\n\n');
    }
    return 'FR-ENGINE-PAGE';
  }

  checkReadiness() {
    return { ready: true };
  }
}
FakeSeedMethod.batchCalls = [];
FakeSeedMethod.contentCalls = [];
METHOD_REGISTRY['test-seed-fake'] = FakeSeedMethod;

function resetFakeCalls() {
  FakeSeedMethod.batchCalls = [];
  FakeSeedMethod.contentCalls = [];
}

function buildPairs(codes = ['fr']) {
  const pairs = new Map();
  for (const code of codes) {
    pairs.set(`en:${code}`, {
      source: 'en',
      target: code,
      method: 'test-seed-fake',
      model: 'fake-model',
      batchSize: 30,
      name: code === 'fr' ? 'French' : 'German',
      register: 'Professional.',
    });
  }
  return pairs;
}

// Hand-translated fixture pair from the pre-TM era: 4-block bodies
// (paragraph / heading / fence-with-blank-line / paragraph), 1:1 aligned.
const SOURCE_POST = `---
title: Getting Started
description: A short guide
---
Welcome to the site.

## First Steps

\`\`\`bash
hugo new site mysite

cd mysite
\`\`\`

That is everything you need.
`;

const TRANSLATED_POST = `---
title: Premiers Pas
description: Un petit guide
---
Bienvenue sur le site.

## Premières Étapes

\`\`\`bash
hugo new site mysite

cd mysite
\`\`\`

C'est tout ce dont vous avez besoin.
`;

const seedOpts = (dir, extra = {}) => ({
  cwd: dir,
  pairs: buildPairs(),
  sourceLocale: 'en',
  translatableFields: null,
  contentDir: dir,
  ...extra,
});

const syncOpts = (dir, extra = {}) => ({
  contentDir: dir,
  sourceLocale: 'en',
  pairs: buildPairs(),
  translatableFields: null,
  apiKey: 'test-key',
  dryRun: false,
  cwd: dir,
  ...extra,
});

describe('tm seed — seeding existing translations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
    resetFakeCalls();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Standard fixture: source + hand-translated target + up-to-date lock, NO TM. */
  function writeUpToDateFixture() {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    write(tmpDir, 'posts/hello.fr.md', TRANSLATED_POST);
    writeLock(tmpDir, { 'posts/hello.md:fr': sha256(SOURCE_POST) });
  }

  it('seeds field + block + whole-body entries under tmMethodKey', () => {
    writeUpToDateFixture();

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 1);
    assert.equal(result.skippedFiles, 0);
    // 2 front-matter fields + 3 translatable blocks + 1 whole body.
    // The fenced code block is a passthrough segment — sync copies it
    // verbatim and never caches it, so seed must not either.
    assert.equal(result.entriesAdded, 6);
    assert.ok(result.saved, 'TM must be persisted');

    const tm = loadTM(tmpDir);
    const pairConfig = buildPairs().get('en:fr');
    const tmKey = tmMethodKey(pairConfig);

    // Fields aligned by NAME
    assert.equal(lookupTM(tm, 'Getting Started', 'fr', tmKey), 'Premiers Pas');
    assert.equal(lookupTM(tm, 'A short guide', 'fr', tmKey), 'Un petit guide');

    // Blocks aligned 1:1 by POSITION, keyed on the restored source text —
    // exactly where the sync engines' block mode looks them up.
    const srcBlocks = syncStyleBlocks(parseContentFile(SOURCE_POST).body);
    const tgtBlocks = syncStyleBlocks(parseContentFile(TRANSLATED_POST).body);
    assert.equal(srcBlocks.length, 3, 'fixture sanity: 3 translatable source blocks');
    for (let i = 0; i < srcBlocks.length; i++) {
      assert.equal(lookupTM(tm, srcBlocks[i], 'fr', tmKey), tgtBlocks[i],
        `block ${i} must be seeded positionally`);
    }

    // Whole body — the unit the current content sync serves bodies from
    assert.equal(
      lookupTM(tm, parseContentFile(SOURCE_POST).body, 'fr', tmKey),
      parseContentFile(TRANSLATED_POST).body,
      'whole-body entry must be seeded'
    );
  });

  it('a seeded file survives lock DELETION with zero engine calls', async () => {
    writeUpToDateFixture();
    seedTMFromExisting(seedOpts(tmpDir));

    fs.unlinkSync(path.join(tmpDir, CONTENT_LOCK_FILENAME));
    resetFakeCalls();
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeSeedMethod.batchCalls.length, 0, 'no front-matter engine calls');
    assert.equal(FakeSeedMethod.contentCalls.length, 0, 'no body engine calls');
    const target = fs.readFileSync(path.join(tmpDir, 'posts/hello.fr.md'), 'utf-8');
    assert.ok(target.includes('Premiers Pas'), 'translation preserved');
  });

  it('a seeded file survives a CLOBBERED lock (wrong hashes) with zero engine calls', async () => {
    writeUpToDateFixture();
    seedTMFromExisting(seedOpts(tmpDir));

    // Clobbered lock: entry exists but the hash is wrong, so sync treats the
    // file as changed and re-processes it — every segment must hit the TM.
    writeLock(tmpDir, { 'posts/hello.md:fr': 'deadbeef' });
    resetFakeCalls();
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeSeedMethod.batchCalls.length, 0, 'fields must be served from the seeded TM');
    assert.equal(FakeSeedMethod.contentCalls.length, 0, 'body must be served from the seeded TM');
    const target = fs.readFileSync(path.join(tmpDir, 'posts/hello.fr.md'), 'utf-8');
    assert.ok(target.includes('Premiers Pas'), 'seeded title re-served');
    assert.ok(target.includes('Bienvenue sur le site.'), 'seeded body re-served');
    assert.ok(!target.includes('FR-ENGINE'), 'engine output must not appear');
  });

  it('an UNSEEDED file with a clobbered lock re-bills — the gap seed closes', async () => {
    // Control experiment: same fixture, no seeding. Proves the zero-call
    // assertions above are earned by the seed, not by the skip logic.
    writeUpToDateFixture();
    writeLock(tmpDir, { 'posts/hello.md:fr': 'deadbeef' });
    resetFakeCalls();
    await runContentSync(syncOpts(tmpDir));

    assert.ok(
      FakeSeedMethod.batchCalls.length + FakeSeedMethod.contentCalls.length > 0,
      'without seeding, a clobbered lock re-pays the engine'
    );
  });

  it('skips a file whose block counts mismatch — warning, nothing seeded', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    // Hand-restructured translation: 2 blocks instead of 4 — alignment
    // would be a guess, so the WHOLE file (fields included) must be skipped.
    const restructured = '---\ntitle: Premiers Pas\ndescription: Un petit guide\n---\nBienvenue.\n\nTout en un seul paragraphe.\n';
    write(tmpDir, 'posts/hello.fr.md', restructured);
    writeLock(tmpDir, { 'posts/hello.md:fr': sha256(SOURCE_POST) });

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 0);
    assert.equal(result.skippedFiles, 1);
    assert.equal(result.entriesAdded, 0);
    assert.match(result.files[0].reason, /translatable block count mismatch \(source 3 vs target 2\)/);

    assert.ok(!fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)), 'no TM written');
    const tm = loadTM(tmpDir);
    const tmKey = tmMethodKey(buildPairs().get('en:fr'));
    assert.equal(lookupTM(tm, 'Getting Started', 'fr', tmKey), null,
      'not even name-aligned fields may be seeded from a mismatched file');
  });

  it('skips files without a lock entry (cannot prove translation matches source)', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    write(tmpDir, 'posts/hello.fr.md', TRANSLATED_POST);
    // No lock file at all

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 0);
    assert.equal(result.entriesAdded, 0);
    assert.match(result.files[0].reason, /no lock entry/);
  });

  it('skips files whose lock entry is stale (source changed since last sync)', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    write(tmpDir, 'posts/hello.fr.md', TRANSLATED_POST);
    writeLock(tmpDir, { 'posts/hello.md:fr': sha256('older source content') });

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 0);
    assert.equal(result.entriesAdded, 0);
    assert.match(result.files[0].reason, /stale/);
  });

  it('never seeds legacy [EN] fallback targets (TM poison guard)', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    write(tmpDir, 'posts/hello.fr.md',
      '---\ntitle: "[EN] Getting Started"\ndescription: "[EN] A short guide"\n---\n[EN] Welcome to the site.\n\n[EN] ## First Steps\n\n[EN] code\n\n[EN] That is everything you need.\n');
    writeLock(tmpDir, { 'posts/hello.md:fr': sha256(SOURCE_POST) });

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 0);
    assert.equal(result.entriesAdded, 0);
    assert.match(result.files[0].reason, /\[EN\] fallback/);
  });

  it('dry-run reports what would be seeded and writes nothing', () => {
    writeUpToDateFixture();

    const result = seedTMFromExisting(seedOpts(tmpDir, { dryRun: true }));
    assert.equal(result.dryRun, true);
    assert.equal(result.seededFiles, 1);
    assert.equal(result.entriesAdded, 6, 'dry-run still counts what WOULD be added');
    assert.equal(result.saved, false);
    assert.ok(!fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)), 'dry-run must not write a TM file');
  });

  it('is idempotent: a second run adds nothing and reports existing entries', () => {
    writeUpToDateFixture();
    seedTMFromExisting(seedOpts(tmpDir));

    const second = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(second.entriesAdded, 0);
    assert.equal(second.entriesExisting, 6);
    assert.equal(second.saved, false, 'no-op re-run must not rewrite the TM');
  });

  it('--locale filters which pairs are seeded', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    write(tmpDir, 'posts/hello.fr.md', TRANSLATED_POST);
    write(tmpDir, 'posts/hello.de.md', TRANSLATED_POST.replace('Premiers Pas', 'Erste Schritte'));
    writeLock(tmpDir, {
      'posts/hello.md:fr': sha256(SOURCE_POST),
      'posts/hello.md:de': sha256(SOURCE_POST),
    });

    const result = seedTMFromExisting(seedOpts(tmpDir, {
      pairs: buildPairs(['fr', 'de']),
      localeFilter: 'fr',
    }));
    assert.equal(result.seededFiles, 1);
    assert.ok(result.files.every(f => f.code === 'fr'), 'only the filtered locale is considered');

    const tm = loadTM(tmpDir);
    const tmKey = tmMethodKey(buildPairs(['fr', 'de']).get('en:de'));
    assert.equal(lookupTM(tm, 'Getting Started', 'de', tmKey), null, 'de must not be seeded');
  });

  it('seeds the Docusaurus lane with docusaurus: manifest keys', () => {
    const docsDir = path.join(tmpDir, 'docs');
    const localesDir = path.join(tmpDir, 'i18n');
    write(tmpDir, 'docs/guide.md', SOURCE_POST);
    write(tmpDir, 'i18n/fr/docusaurus-plugin-content-docs/current/guide.md', TRANSLATED_POST);
    writeLock(tmpDir, { 'docusaurus:docs/guide.md:fr': sha256(SOURCE_POST) });

    const result = seedTMFromExisting({
      cwd: tmpDir,
      pairs: buildPairs(),
      sourceLocale: 'en',
      contentDir: null,
      docusaurus: { localesDir, docsDir, blogDir: path.join(tmpDir, 'blog') },
    });
    assert.equal(result.seededFiles, 1);
    assert.equal(result.entriesAdded, 6);

    const tm = loadTM(tmpDir);
    const tmKey = tmMethodKey(buildPairs().get('en:fr'));
    assert.equal(lookupTM(tm, 'Getting Started', 'fr', tmKey), 'Premiers Pas');
    assert.equal(
      lookupTM(tm, parseContentFile(SOURCE_POST).body, 'fr', tmKey),
      parseContentFile(TRANSLATED_POST).body
    );
  });

  it('reports "no translated file" when the lock is up to date but the target is gone', () => {
    write(tmpDir, 'posts/hello.md', SOURCE_POST);
    writeLock(tmpDir, { 'posts/hello.md:fr': sha256(SOURCE_POST) });

    const result = seedTMFromExisting(seedOpts(tmpDir));
    assert.equal(result.seededFiles, 0);
    assert.match(result.files[0].reason, /no translated file/);
  });
});
