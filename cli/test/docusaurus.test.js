#!/usr/bin/env node
/**
 * Docusaurus integration test suite.
 *
 * Tests the end-to-end Docusaurus sync path: auto-detection, JSON
 * sync with {message, description} format, and content discovery.
 *
 * Run: node test/docusaurus.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveConfig, detectDocusaurus } from '../lib/config.js';
import {
  extractDocusaurusMessages,
  injectDocusaurusMessages,
} from '../lib/format.js';
import {
  discoverDocusaurusContentFiles,
  getDocusaurusTargetPath,
} from '../lib/content.js';
import { runSync } from '../lib/sync.js';
import { runDocusaurusSync } from '../lib/docusaurus-sync.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { readManifest, hashValue, LOCK_FILENAME } from '../lib/hash.js';
import { CONTENT_LOCK_FILENAME } from '../lib/content-sync.js';
import { TM_DIR, TM_FILENAME } from '../lib/tm.js';

// Temp directory for test fixtures
const TMP_BASE = path.join(import.meta.dirname, 'fixtures', '_tmp_docusaurus');

// -----------------------------------------------------------------
// Auto-detection tests
// -----------------------------------------------------------------
describe('detectDocusaurus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(TMP_BASE, `detect-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true when docusaurus.config.js exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');
    assert.equal(detectDocusaurus(tmpDir), true);
  });

  it('returns true when docusaurus.config.ts exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.ts'), 'export default {};');
    assert.equal(detectDocusaurus(tmpDir), true);
  });

  it('returns false when no Docusaurus config exists', () => {
    assert.equal(detectDocusaurus(tmpDir), false);
  });

  it('auto-sets format to docusaurus in resolveConfig', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');
    const config = resolveConfig({}, tmpDir);
    assert.equal(config.format, 'docusaurus');
  });

  it('auto-sets localesDir to ./i18n when format is auto-detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');
    const config = resolveConfig({}, tmpDir);
    assert.equal(config.localesDir, path.join(tmpDir, 'i18n'));
  });

  it('does not override explicit format setting', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');
    // User explicitly sets format to 'json' via CLI
    const config = resolveConfig({ format: 'json' }, tmpDir);
    assert.equal(config.format, 'json');
  });

  it('respects custom localesDir even in Docusaurus project', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');
    // Write a config file with custom localesDir
    fs.writeFileSync(
      path.join(tmpDir, 'champollion.config.json'),
      JSON.stringify({ version: 3, localesDir: './custom-i18n' })
    );
    const config = resolveConfig({}, tmpDir);
    assert.equal(config.format, 'docusaurus');
    assert.equal(config.localesDir, path.join(tmpDir, 'custom-i18n'));
  });
});

// -----------------------------------------------------------------
// Content discovery tests
// -----------------------------------------------------------------
describe('discoverDocusaurusContentFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(TMP_BASE, `content-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers .md files recursively', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(path.join(docsDir, 'guides'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'intro.md'), '# Intro');
    fs.writeFileSync(path.join(docsDir, 'guides', 'quickstart.md'), '# Quick Start');

    const files = discoverDocusaurusContentFiles(docsDir);
    assert.equal(files.length, 2);
    assert.ok(files[1].endsWith('intro.md'));
    assert.ok(files[0].endsWith('quickstart.md'));
  });

  it('discovers .mdx files', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'page.mdx'), '# MDX Page');

    const files = discoverDocusaurusContentFiles(docsDir);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('.mdx'));
  });

  it('skips hidden directories', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(path.join(docsDir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'visible.md'), '# Visible');
    fs.writeFileSync(path.join(docsDir, '.hidden', 'secret.md'), '# Hidden');

    const files = discoverDocusaurusContentFiles(docsDir);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('visible.md'));
  });

  it('returns empty for nonexistent directory', () => {
    const files = discoverDocusaurusContentFiles(path.join(tmpDir, 'nope'));
    assert.equal(files.length, 0);
  });
});

// -----------------------------------------------------------------
// Target path mapping tests
// -----------------------------------------------------------------
describe('getDocusaurusTargetPath', () => {
  it('maps docs to versioned path', () => {
    const result = getDocusaurusTargetPath(
      '/project/docs/guides/foo.md',
      '/project/docs',
      'fr',
      '/project/i18n',
      'docusaurus-plugin-content-docs'
    );
    assert.equal(result, '/project/i18n/fr/docusaurus-plugin-content-docs/current/guides/foo.md');
  });

  it('maps blog without version directory', () => {
    const result = getDocusaurusTargetPath(
      '/project/blog/2026-01-01-hello.md',
      '/project/blog',
      'ja',
      '/project/i18n',
      'docusaurus-plugin-content-blog'
    );
    assert.equal(result, '/project/i18n/ja/docusaurus-plugin-content-blog/2026-01-01-hello.md');
  });

  it('handles nested docs', () => {
    const result = getDocusaurusTargetPath(
      '/project/docs/api/reference/methods.md',
      '/project/docs',
      'de',
      '/project/i18n',
      'docusaurus-plugin-content-docs'
    );
    assert.equal(result, '/project/i18n/de/docusaurus-plugin-content-docs/current/api/reference/methods.md');
  });

  it('supports custom version directory', () => {
    const result = getDocusaurusTargetPath(
      '/project/docs/intro.md',
      '/project/docs',
      'es',
      '/project/i18n',
      'docusaurus-plugin-content-docs',
      'version-2.0'
    );
    assert.equal(result, '/project/i18n/es/docusaurus-plugin-content-docs/version-2.0/intro.md');
  });
});

// -----------------------------------------------------------------
// End-to-end sync test (no-fallback — verifies failure behavior)
// -----------------------------------------------------------------
describe('Docusaurus sync integration (no-fallback)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(TMP_BASE, `sync-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Create a Docusaurus project structure
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};');

    // Champollion config with one target language
    fs.writeFileSync(path.join(tmpDir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      sourceLocale: 'en',
      localesDir: './i18n',
      pairs: {
        'en:fr': { method: 'llm', model: 'test/model' },
      },
    }));

    // Source locale JSON files
    const enDir = path.join(tmpDir, 'i18n', 'en', 'docusaurus-theme-classic');
    fs.mkdirSync(enDir, { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, 'i18n', 'en', 'code.json'),
      JSON.stringify({
        'theme.title': { message: 'My Site', description: 'The site title' },
        'theme.tagline': { message: 'Cool tagline', description: 'The site tagline' },
      }, null, 2)
    );

    fs.writeFileSync(
      path.join(enDir, 'navbar.json'),
      JSON.stringify({
        'item.label.Docs': { message: 'Docs', description: 'Navbar docs link' },
        'item.label.Blog': { message: 'Blog', description: 'Navbar blog link' },
      }, null, 2)
    );

    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'intro.md'), '---\ntitle: Introduction\n---\n# Welcome\n\nThis is the intro.\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dry-run mode previews without writing files', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const origLog = console.log;
    const origWarn = console.warn;
    const origWrite = process.stdout.write;
    console.log = () => {};
    console.warn = () => {};
    process.stdout.write = () => true;

    try {
      await runSync({
        cwd: tmpDir,
        dryRun: true,
        cliArgs: { dry: true, 'no-verify': true },
      });

      const frCodePath = path.join(tmpDir, 'i18n', 'fr', 'code.json');
      assert.ok(!fs.existsSync(frCodePath), 'fr/code.json should NOT exist in dry run');

    } finally {
      console.log = origLog;
      console.warn = origWarn;
      process.stdout.write = origWrite;
      if (saved) process.env.OPENROUTER_API_KEY = saved;
    }
  });

  it('does not overwrite existing translated content files', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const origLog = console.log;
    const origWarn = console.warn;
    const origWrite = process.stdout.write;
    const origErr = console.error;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    process.stdout.write = () => true;

    try {
      const targetDoc = path.join(
        tmpDir, 'i18n', 'fr', 'docusaurus-plugin-content-docs', 'current', 'intro.md'
      );
      fs.mkdirSync(path.dirname(targetDoc), { recursive: true });
      fs.writeFileSync(targetDoc, '# Bienvenue\n\nCeci est la traduction.');

      try {
        await runSync({
          cwd: tmpDir,
          cliArgs: { 'no-verify': true },
        });
      } catch {
        // Expected — no API key
      }

      const content = fs.readFileSync(targetDoc, 'utf-8');
      assert.ok(content.includes('Bienvenue'), 'Existing translation should be preserved');
      assert.ok(!content.includes('[EN]'), 'Should not have been overwritten');

    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
      process.stdout.write = origWrite;
      if (saved) process.env.OPENROUTER_API_KEY = saved;
    }
  });
});

// -----------------------------------------------------------------
// Incremental-cost behavior — block-level TM (Phase 2) and the
// changedKeys manifest flow (Phase 1).
//
// Uses runDocusaurusSync directly with an injected resolveRuntime and a
// scripted fake method (same pattern as content-sync.test.js) so every
// API touch is observable: batchCalls records key batches, contentCalls
// records raw prompts.
// -----------------------------------------------------------------
describe('Docusaurus incremental cost (TM + manifests)', () => {
  let tmpDir;

  class FakeDocuMethod {
    async translate(keys, sourceFlat) {
      FakeDocuMethod.batchCalls.push([...keys]);
      if (FakeDocuMethod.failBatch) return null;
      const out = {};
      for (const k of keys) out[k] = `FR:${sourceFlat[k]}`;
      return out;
    }

    async translateContent(prompt) {
      FakeDocuMethod.contentCalls.push(prompt);
      if (FakeDocuMethod.failContent) return null;
      // Block-batch prompt: echo each ⟦SEG_N⟧ marker with a transformed
      // segment (placeholders inside are preserved for restoreBlocks).
      const matches = [...prompt.matchAll(/⟦SEG_(\d+)⟧\n([\s\S]*?)(?=\n\n⟦SEG_|$)/g)];
      if (matches.length > 0) {
        return matches.map(m => `⟦SEG_${m[1]}⟧\nFR<${m[2]}>`).join('\n\n');
      }
      // Page-mode prompt: body follows the '---' separator line.
      const idx = prompt.indexOf('\n---\n');
      return `FR-PAGE<${prompt.slice(idx + 5)}>`;
    }

    checkReadiness() {
      return { ready: true };
    }
  }
  FakeDocuMethod.batchCalls = [];
  FakeDocuMethod.contentCalls = [];
  FakeDocuMethod.failBatch = false;
  FakeDocuMethod.failContent = false;
  METHOD_REGISTRY['test-docu-fake'] = FakeDocuMethod;

  function resetFake() {
    FakeDocuMethod.batchCalls = [];
    FakeDocuMethod.contentCalls = [];
    FakeDocuMethod.failBatch = false;
    FakeDocuMethod.failContent = false;
  }

  /** Count the segments sent in the most recent content call. */
  function lastCallSegCount() {
    const prompt = FakeDocuMethod.contentCalls.at(-1);
    return (prompt.match(/⟦SEG_\d+⟧/g) || []).length;
  }

  const GUIDE_V1 = [
    '---',
    'title: Guide Title',
    'description: A guide description',
    'sidebar_position: 3',
    '---',
    '',
    '# Welcome',
    '',
    'First paragraph of prose.',
    '',
    'Second paragraph stays stable.',
    '',
  ].join('\n');

  function makeProject() {
    const dir = path.join(TMP_BASE, `tm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(path.join(dir, 'i18n', 'en'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'i18n', 'en', 'code.json'),
      JSON.stringify({
        'theme.title': { message: 'My Site', description: 'The site title' },
        'theme.tagline': { message: 'Cool tagline', description: 'The site tagline' },
      }, null, 2)
    );
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'guide.md'), GUIDE_V1);
    return dir;
  }

  function baseConfig(dir, extra = {}) {
    return {
      inputLocale: 'en',
      localesDir: path.join(dir, 'i18n'),
      fallbackPrefix: '[EN] ',
      forceKeys: [],
      ...extra,
    };
  }

  function fakeResolveRuntime(pairExtra = {}) {
    return async () => ({
      apiKey: 'test-key',
      pairEntries: [['en:fr', {
        source: 'en', target: 'fr', method: 'test-docu-fake', model: 'fake-model',
        batchSize: 30, name: 'French', register: 'Professional.', ...pairExtra,
      }]],
    });
  }

  async function run(dir, { configExtra = {}, pairExtra = {}, cliArgs = {}, dryRun = false } = {}) {
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;
    const origWrite = process.stdout.write;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    process.stdout.write = () => true;
    try {
      return await runDocusaurusSync(
        { dryRun, cliArgs },
        baseConfig(dir, configExtra),
        dir,
        fakeResolveRuntime(pairExtra)
      );
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
      process.stdout.write = origWrite;
    }
  }

  const targetDocPath = (dir) =>
    path.join(dir, 'i18n', 'fr', 'docusaurus-plugin-content-docs', 'current', 'guide.md');

  beforeEach(() => {
    tmpDir = makeProject();
    resetFake();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('first sync bills each body block once, in ONE batched call, and persists the TM', async () => {
    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 1, 'exactly one body API call per file per locale');
    assert.equal(lastCallSegCount(), 3, 'all three blocks billed on first sync');

    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR:Guide Title'), 'front matter translated');
    assert.ok(written.includes('FR<# Welcome>'), 'heading block translated');
    assert.ok(written.includes('FR<First paragraph of prose.>'), 'first paragraph translated');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'second paragraph translated');
    assert.ok(written.includes('sidebar_position: 3'), 'non-translatable front matter preserved');
    assert.ok(fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)), 'TM persisted');
  });

  it('a one-block edit bills exactly one block (others served from TM)', async () => {
    await run(tmpDir);
    resetFake();

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide.md'),
      GUIDE_V1.replace('First paragraph of prose.', 'First paragraph of prose, edited.')
    );
    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 1, 'one batched call for the misses');
    assert.equal(lastCallSegCount(), 1, 'exactly ONE block billed for a one-block edit');
    const prompt = FakeDocuMethod.contentCalls[0];
    assert.ok(prompt.includes('First paragraph of prose, edited.'), 'the edited block is in the payload');
    assert.ok(!prompt.includes('Second paragraph stays stable.'), 'unchanged blocks are NOT in the payload');
    assert.deepEqual(FakeDocuMethod.batchCalls, [], 'unchanged front matter fields are TM hits');

    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR<First paragraph of prose, edited.>'), 'edited block re-translated');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'unchanged block reused from TM');
  });

  it('a front-matter-only edit bills zero body blocks and only the edited field', async () => {
    await run(tmpDir);
    resetFake();

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide.md'),
      GUIDE_V1.replace('title: Guide Title', 'title: Renamed Guide')
    );
    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'zero body blocks billed');
    assert.deepEqual(FakeDocuMethod.batchCalls, [['title']], 'only the edited field goes to the API');

    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR:Renamed Guide'), 'new title translated');
    assert.ok(written.includes('FR:A guide description'), 'unchanged field served from TM');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'body reused');
  });

  it('a sidebar_position-only edit propagates to the locale copy for free (zero API calls)', async () => {
    // Docusaurus reads sidebar_position/draft/slug/tags PER-LOCALE — a
    // non-translatable front-matter edit must reach every locale copy, or
    // sidebar order / publication status silently diverges between the
    // English and translated sites. The rewrite is API-free: unchanged
    // fields and the unchanged body are TM hits.
    await run(tmpDir);
    resetFake();

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide.md'),
      GUIDE_V1.replace('sidebar_position: 3', 'sidebar_position: 4')
    );
    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'no body API call — whole-body TM hit');
    assert.deepEqual(FakeDocuMethod.batchCalls, [], 'no front matter API call — field TM hits');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('sidebar_position: 4'), 'metadata edit propagated to the locale copy');
    assert.ok(written.includes('FR:Guide Title'), 'translated front matter preserved');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'translated body preserved');
  });

  it('a reverted body is served from the whole-body TM entry (free)', async () => {
    await run(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide.md'),
      GUIDE_V1.replace('First paragraph of prose.', 'First paragraph of prose, edited.')
    );
    await run(tmpDir);
    resetFake();

    // Revert to the original — the whole-body entry from run 1 must serve it.
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guide.md'), GUIDE_V1);
    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'reverted body is a whole-body TM hit');
    assert.deepEqual(FakeDocuMethod.batchCalls, [], 'reverted fields are TM hits');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR<First paragraph of prose.>'), 'original translation restored');
  });

  it("contentSegmentation: 'page' preserves single-prompt behavior but stays TM-threaded", async () => {
    await run(tmpDir, { pairExtra: { contentSegmentation: 'page' } });
    assert.equal(FakeDocuMethod.contentCalls.length, 1);
    assert.ok(!FakeDocuMethod.contentCalls[0].includes('⟦SEG_'), 'page mode uses the whole-body prompt');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR-PAGE<'), 'whole-body translation written');
    resetFake();

    // Identical body in a fresh work item (lock removed = lock-loss case):
    // the whole-body TM entry must serve it without an API call.
    fs.rmSync(path.join(tmpDir, CONTENT_LOCK_FILENAME));
    fs.rmSync(targetDocPath(tmpDir));
    await run(tmpDir, { pairExtra: { contentSegmentation: 'page' } });
    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'page mode body served from whole-body TM');
  });

  it('rejects an invalid contentSegmentation value loudly', async () => {
    await assert.rejects(
      () => run(tmpDir, { pairExtra: { contentSegmentation: 'paragraph' } }),
      /Invalid contentSegmentation "paragraph"/
    );
  });

  it('--force-content re-processes everything but unchanged content is served from TM', async () => {
    await run(tmpDir);
    resetFake();

    await run(tmpDir, { cliArgs: { 'force-content': true } });
    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'no API call — every block is a TM hit');
    assert.deepEqual(FakeDocuMethod.batchCalls, [], 'front matter fields are TM hits');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR<# Welcome>'), 'file rewritten from cache');
  });

  it('a pre-TM lock entry with a stale hash triggers ONE re-translation under the SAME key', async () => {
    // Locks written by pre-TM versions use the same key format and the same
    // raw-file hash — no migration, no format bump. A stale hash (source
    // edited since that entry was recorded) re-translates once; the entry
    // is advanced in place.
    fs.mkdirSync(path.dirname(targetDocPath(tmpDir)), { recursive: true });
    fs.writeFileSync(targetDocPath(tmpDir), '---\ntitle: "Ancien"\n---\n\nAncien corps.\n');
    fs.writeFileSync(
      path.join(tmpDir, CONTENT_LOCK_FILENAME),
      JSON.stringify({ 'docusaurus:docs/guide.md:fr': 'deadbeef-old-raw-hash' }, null, 2)
    );

    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 1, 'stale-tracked file re-translated once');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR<# Welcome>'), 'target regenerated');
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, CONTENT_LOCK_FILENAME), 'utf-8'));
    assert.notEqual(lock['docusaurus:docs/guide.md:fr'], 'deadbeef-old-raw-hash', 'entry advanced in place');
    resetFake();

    await run(tmpDir);
    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'second run is a no-op');
  });

  it('a pre-TM lock entry whose raw hash still matches skips the file entirely', async () => {
    // Backward compatibility: old locks hashed the raw source file with
    // sha256 — identical to the current scheme, so an unchanged file
    // tracked by an old lock costs nothing.
    const rawHash = crypto.createHash('sha256').update(GUIDE_V1, 'utf-8').digest('hex');
    fs.mkdirSync(path.dirname(targetDocPath(tmpDir)), { recursive: true });
    fs.writeFileSync(targetDocPath(tmpDir), '---\ntitle: "Déjà traduit"\n---\n\nCorps existant.\n');
    fs.writeFileSync(
      path.join(tmpDir, CONTENT_LOCK_FILENAME),
      JSON.stringify({ 'docusaurus:docs/guide.md:fr': rawHash }, null, 2)
    );

    await run(tmpDir);

    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'no body API call');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('Déjà traduit'), 'existing translation untouched');
  });

  it('a failed content translation keeps the old lock entry and re-fires next sync', async () => {
    // Regression guard: a failed or interrupted run must never advance (or
    // drop) a file's lock entry — otherwise the pending source edit is
    // silently frozen and "Re-run sync to retry failed files" is a lie.
    await run(tmpDir);
    const lockKey = 'docusaurus:docs/guide.md:fr';
    const lockBefore = JSON.parse(fs.readFileSync(path.join(tmpDir, CONTENT_LOCK_FILENAME), 'utf-8'));
    const oldHash = lockBefore[lockKey];
    assert.ok(oldHash, 'baseline entry recorded');
    resetFake();

    // Edit the body, then make the content API fail the re-translation.
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide.md'),
      GUIDE_V1.replace('First paragraph of prose.', 'First paragraph of prose, edited.')
    );
    FakeDocuMethod.failContent = true;
    await assert.rejects(() => run(tmpDir), /content translation\(s\) failed/);

    const lockAfterFail = JSON.parse(fs.readFileSync(path.join(tmpDir, CONTENT_LOCK_FILENAME), 'utf-8'));
    assert.equal(lockAfterFail[lockKey], oldHash, 'failed item keeps the OLD hash (not advanced, not dropped)');
    resetFake();

    // Next sync retries and succeeds — the edit is not frozen.
    await run(tmpDir);
    assert.equal(FakeDocuMethod.contentCalls.length, 1, 'failed file re-fires on the next sync');
    const written = fs.readFileSync(targetDocPath(tmpDir), 'utf-8');
    assert.ok(written.includes('FR<First paragraph of prose, edited.>'), 'edit finally applied');
    const lockAfter = JSON.parse(fs.readFileSync(path.join(tmpDir, CONTENT_LOCK_FILENAME), 'utf-8'));
    assert.notEqual(lockAfter[lockKey], oldHash, 'hash advanced after success');
  });

  it('--force-content never overwrites a hand-translated file (no lock entry, no [EN] markers)', async () => {
    // A locale file with no lock entry and no '[EN] ' markers is human
    // work. --force-content re-processes champollion-MANAGED files only.
    await run(tmpDir);
    resetFake();

    // Simulate a hand-maintained translation champollion has never tracked:
    // drop the content lock and replace the target with human work.
    const handTranslated = '---\ntitle: "Guide traduit à la main"\n---\n\nProse humaine soignée.\n';
    fs.rmSync(path.join(tmpDir, CONTENT_LOCK_FILENAME));
    fs.writeFileSync(targetDocPath(tmpDir), handTranslated);

    await run(tmpDir, { cliArgs: { 'force-content': true } });

    assert.equal(FakeDocuMethod.contentCalls.length, 0, 'no API call billed for the hand file');
    assert.deepEqual(FakeDocuMethod.batchCalls, [], 'no front matter call either');
    assert.equal(fs.readFileSync(targetDocPath(tmpDir), 'utf-8'), handTranslated, 'hand translation preserved');

    // The adoption record makes later no-force syncs skip it too.
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, CONTENT_LOCK_FILENAME), 'utf-8'));
    assert.ok(lock['docusaurus:docs/guide.md:fr'], 'hand file adopted into the lock');
  });

  it('Phase 1: an edited English UI string re-fires (changedKeys manifest flow)', async () => {
    await run(tmpDir);
    const frCode = JSON.parse(fs.readFileSync(path.join(tmpDir, 'i18n', 'fr', 'code.json'), 'utf-8'));
    assert.equal(frCode['theme.title'].message, 'FR:My Site');
    resetFake();

    // Edit the ENGLISH value — before the manifest flow this was invisible
    // to the diff (key exists, value translated → "fully synced" forever).
    fs.writeFileSync(
      path.join(tmpDir, 'i18n', 'en', 'code.json'),
      JSON.stringify({
        'theme.title': { message: 'Our Site', description: 'The site title' },
        'theme.tagline': { message: 'Cool tagline', description: 'The site tagline' },
      }, null, 2)
    );
    await run(tmpDir);

    assert.deepEqual(FakeDocuMethod.batchCalls, [['theme.title']], 'only the edited key re-fires');
    const updated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'i18n', 'fr', 'code.json'), 'utf-8'));
    assert.equal(updated['theme.title'].message, 'FR:Our Site', 'edited string re-translated');
    assert.equal(updated['theme.tagline'].message, 'FR:Cool tagline', 'unchanged string preserved');
  });

  it('Phase 1: a failed key keeps its OLD manifest hash and re-fires next sync', async () => {
    await run(tmpDir);
    const nsKey = 'docusaurus:code.json:theme.title';
    const oldHash = readManifest(tmpDir)[nsKey];
    assert.equal(oldHash, hashValue('My Site'), 'baseline hash recorded');
    resetFake();

    // Edit the English value, then make the API fail the re-translation.
    fs.writeFileSync(
      path.join(tmpDir, 'i18n', 'en', 'code.json'),
      JSON.stringify({
        'theme.title': { message: 'Our Site', description: 'The site title' },
        'theme.tagline': { message: 'Cool tagline', description: 'The site tagline' },
      }, null, 2)
    );
    FakeDocuMethod.failBatch = true;
    await run(tmpDir).catch(() => {}); // Phase 2 may also fail loudly — irrelevant here

    const manifest = readManifest(tmpDir);
    assert.equal(manifest[nsKey], oldHash, 'failed key keeps the OLD hash (not advanced)');
    resetFake();

    // Next sync: the key must re-fire and succeed.
    await run(tmpDir);
    assert.ok(
      FakeDocuMethod.batchCalls.some(keys => keys.includes('theme.title')),
      'failed key re-fires on the next sync'
    );
    assert.equal(readManifest(tmpDir)[nsKey], hashValue('Our Site'), 'hash advanced after success');
    const updated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'i18n', 'fr', 'code.json'), 'utf-8'));
    assert.equal(updated['theme.title'].message, 'FR:Our Site');
  });

  it('dry-run does not advance manifests or write the TM', async () => {
    await run(tmpDir, { dryRun: true });
    assert.ok(!fs.existsSync(path.join(tmpDir, LOCK_FILENAME)), 'no Phase 1 manifest in dry-run');
    assert.ok(!fs.existsSync(path.join(tmpDir, CONTENT_LOCK_FILENAME)), 'no content lock in dry-run');
    assert.ok(!fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)), 'no TM file in dry-run');
    assert.ok(!fs.existsSync(targetDocPath(tmpDir)), 'no target written in dry-run');
  });
});

