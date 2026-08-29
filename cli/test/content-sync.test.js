/**
 * Content sync integration tests.
 *
 * Tests the runContentSync pipeline verifying:
 *   - Content file discovery
 *   - Existing translation skip logic
 *   - Dry-run mode (no file writes)
 *   - Path containment security
 *   - Loud failures when no API key is available
 *
 * v4 CHANGE: Fallback mode (--fallback / useFallback) was removed.
 * Content sync without an API key now throws loud errors instead of
 * silently writing [EN]-prefixed garbage. Tests that previously
 * verified fallback behavior now verify failure behavior.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runContentSync } from '../lib/sync.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TM_DIR, TM_FILENAME } from '../lib/tm.js';

// Create a temporary content directory for each test
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-content-'));
}

// Write a Hugo content file to the temp directory
function writeContent(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

// Minimal language config for testing
const TEST_LANGUAGES = {
  fr: { name: 'French', register: 'Professional.' },
  de: { name: 'German', register: 'Professional.' },
};

/** Build a v3 pair Map from a languages object for testing. */
function buildTestPairs(languages, sourceLocale = 'en') {
  const pairs = new Map();
  for (const [code, lang] of Object.entries(languages)) {
    pairs.set(`${sourceLocale}:${code}`, {
      source: sourceLocale,
      target: code,
      method: 'llm',
      model: 'google/gemini-3.5-flash',
      batchSize: 30,
      name: lang.name,
      register: lang.register,
    });
  }
  return pairs;
}

// Sample Hugo content file with front matter and body
const SAMPLE_POST = `---
title: My First Post
description: A short introduction to Hugo
date: 2024-01-15
draft: false
tags:
  - intro
  - tutorial
---
Welcome to **Hugo**! This is a sample post.

## Getting Started

Hugo is a fast static site generator.

\`\`\`bash
hugo new site mysite
\`\`\`

That's all you need to know.
`;

describe('runContentSync (no-fallback mode)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Failure behavior tests ────────────────────────────────────────
  // Without an API key, content sync must fail LOUD — no silent [EN] writing.

  it('throws when no API key is available (front matter)', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);

    await assert.rejects(
      () => runContentSync({
        contentDir: tmpDir,
        sourceLocale: 'en',
        pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
        translatableFields: null,
        apiKey: null,
        dryRun: false,
        cwd: tmpDir,
      }),
      (err) => {
        assert.ok(err.message.includes('no API key'), `Expected API key error, got: ${err.message}`);
        return true;
      },
      'Should throw loud error when no API key available'
    );
  });

  // ── Skip logic tests ─────────────────────────────────────────────
  // These use existing target files to test the skip path (no API needed)

  it('skips existing translations without overwriting', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);
    const existingPath = writeContent(tmpDir, 'posts/hello.fr.md', '---\ntitle: Mon Premier Article\n---\nContenu existant.\n');

    // When target already exists, content sync skips it — no API call needed
    await runContentSync({
      contentDir: tmpDir,
      sourceLocale: 'en',
      pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
      translatableFields: null,
      apiKey: null,
      dryRun: false,
      cwd: tmpDir,
    });

    // Existing file should NOT be overwritten
    const output = fs.readFileSync(existingPath, 'utf-8');
    assert.ok(output.includes('Mon Premier Article'), 'existing translation preserved');
    assert.ok(!output.includes('[EN]'), 'no fallback prefix injected');
  });

  // ── Dry-run tests ─────────────────────────────────────────────────
  // Dry run doesn't need an API key — it just reports what would happen

  it('does not write files in dry-run mode', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);

    await runContentSync({
      contentDir: tmpDir,
      sourceLocale: 'en',
      pairs: buildTestPairs(TEST_LANGUAGES),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
      cwd: tmpDir,
    });

    assert.ok(!fs.existsSync(path.join(tmpDir, 'posts/hello.fr.md')), 'French file NOT created');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'posts/hello.de.md')), 'German file NOT created');
  });

  // ── Edge case tests ───────────────────────────────────────────────

  it('handles empty content directory gracefully', async () => {
    // tmpDir exists but has no .md files
    await runContentSync({
      contentDir: tmpDir,
      sourceLocale: 'en',
      pairs: buildTestPairs(TEST_LANGUAGES),
      translatableFields: null,
      apiKey: null,
      dryRun: false,
      cwd: tmpDir,
    });
    // Should not throw — no files to process
  });

  it('handles nonexistent content directory gracefully', async () => {
    await runContentSync({
      contentDir: path.join(tmpDir, 'nonexistent'),
      sourceLocale: 'en',
      pairs: buildTestPairs(TEST_LANGUAGES),
      translatableFields: null,
      apiKey: null,
      dryRun: false,
      cwd: tmpDir,
    });
    // Should not throw — directory doesn't exist
  });

  it('handles source files with .en.md suffix', async () => {
    writeContent(tmpDir, 'posts/hello.en.md', SAMPLE_POST);

    // Dry run to test path generation without API key
    await runContentSync({
      contentDir: tmpDir,
      sourceLocale: 'en',
      pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
      cwd: tmpDir,
    });

    // In dry run, file isn't created, but we verify it doesn't crash
    // and the path would be hello.fr.md (not hello.en.fr.md)
  });
});

// ── Per-method key gate ─────────────────────────────────────────────
// PRELAUNCH AUDIT FIX: the old gate hard-required the OpenRouter apiKey
// for every pair ("Set OPENROUTER_API_KEY") and exited before ever
// trying the configured provider. The gate must require only the key(s)
// the pair's resolved method actually needs.
describe('runContentSync (per-method key gate)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** A gemini pair — a direct provider that resolves GEMINI_API_KEY itself. */
  function buildGeminiPairs() {
    const pairs = new Map();
    pairs.set('en:fr', {
      source: 'en',
      target: 'fr',
      method: 'gemini',
      model: null,       // direct providers pick their own default model
      batchSize: 30,
      name: 'French',
      register: 'Professional.',
      // This suite targets the per-method KEY GATE, not segmentation:
      // page mode keeps the scripted single-response fetch mock simple.
      // Block mode is exercised by the fake-method suites below.
      contentSegmentation: 'page',
    });
    return pairs;
  }

  it('translates via a direct provider (gemini) without OPENROUTER_API_KEY', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);

    const originalFetch = globalThis.fetch;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const fetchedUrls = [];
    globalThis.fetch = async (url, options) => {
      fetchedUrls.push(String(url));
      // Model listing (GET, no body) — used by _validateModel
      if (!options?.body) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            models: [
              { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            ],
          }),
        };
      }
      // Batch calls request JSON mode; content calls are freeform text
      const reqBody = JSON.parse(options.body);
      const isJsonMode = reqBody.generationConfig?.responseMimeType === 'application/json';
      const text = isJsonMode
        ? JSON.stringify({ title: 'Mon Premier Article', description: 'Une brève introduction à Hugo' })
        : 'Bienvenue sur Hugo ! Ceci est un exemple.';
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
      };
    };

    try {
      // apiKey (OpenRouter) is null — before the fix this threw
      // "Set OPENROUTER_API_KEY" without ever calling the provider.
      await runContentSync({
        contentDir: tmpDir,
        sourceLocale: 'en',
        pairs: buildGeminiPairs(),
        translatableFields: null,
        apiKey: null,
        dryRun: false,
        cwd: tmpDir,
      });

      const targetPath = path.join(tmpDir, 'posts/hello.fr.md');
      assert.ok(fs.existsSync(targetPath), 'French file created via direct provider');
      const written = fs.readFileSync(targetPath, 'utf-8');
      assert.ok(written.includes('Mon Premier Article'), 'front matter translated by gemini');
      assert.ok(written.includes('Bienvenue sur Hugo'), 'body translated by gemini');
      assert.ok(
        fetchedUrls.some(u => u.includes('generativelanguage.googleapis.com')),
        'the configured provider was actually called'
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  it('names OPENROUTER_API_KEY when an llm pair is keyless', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);

    await assert.rejects(
      () => runContentSync({
        contentDir: tmpDir,
        sourceLocale: 'en',
        pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
        translatableFields: null,
        apiKey: null,
        dryRun: false,
        cwd: tmpDir,
      }),
      (err) => {
        assert.ok(err.message.includes('no API key'), `Expected key error, got: ${err.message}`);
        assert.ok(err.message.includes('OPENROUTER_API_KEY'), `Expected OpenRouter key named, got: ${err.message}`);
        return true;
      }
    );
  });

  it('names GEMINI_API_KEY when a gemini pair is keyless', async () => {
    writeContent(tmpDir, 'posts/hello.md', SAMPLE_POST);

    const originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await assert.rejects(
        () => runContentSync({
          contentDir: tmpDir,
          sourceLocale: 'en',
          pairs: buildGeminiPairs(),
          translatableFields: null,
          apiKey: null,
          dryRun: false,
          cwd: tmpDir,
        }),
        (err) => {
          assert.ok(err.message.includes('GEMINI_API_KEY'), `Expected Gemini key named, got: ${err.message}`);
          assert.ok(!err.message.includes('OPENROUTER_API_KEY'), 'must not blame the OpenRouter key');
          return true;
        }
      );
    } finally {
      if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });
});

// ── Translation Memory ──────────────────────────────────────────────
// The founder complaint this fixes: editing ONE front-matter field used to
// re-pay the API for the ENTIRE document (fields AND body), because change
// detection is per-file. With the TM threaded through content sync, the
// unchanged parts are served from cache — a front-matter-only edit no
// longer re-pays the body, and a duplicate/reverted body is free.
describe('runContentSync (Translation Memory)', () => {
  let tmpDir;

  // Scripted fake method — records every API touch so tests can assert
  // exactly which segments were re-paid (same pattern as translate-pair tests).
  class FakeContentMethod {
    async translate(keys, sourceFlat, pairConfig, options) {
      FakeContentMethod.batchCalls.push([...keys]);
      const out = {};
      for (const k of keys) out[k] = `FR:${sourceFlat[k]}`;
      return out;
    }

    async translateContent(prompt, pairConfig, options) {
      FakeContentMethod.contentCalls.push(prompt);
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
  FakeContentMethod.batchCalls = [];
  FakeContentMethod.contentCalls = [];
  METHOD_REGISTRY['test-content-fake'] = FakeContentMethod;

  function resetFakeCalls() {
    FakeContentMethod.batchCalls = [];
    FakeContentMethod.contentCalls = [];
  }

  function buildFakePairs() {
    const pairs = new Map();
    pairs.set('en:fr', {
      source: 'en',
      target: 'fr',
      method: 'test-content-fake',
      model: 'fake-model',
      batchSize: 30,
      name: 'French',
      register: 'Professional.',
    });
    return pairs;
  }

  const POST_V1 = '---\ntitle: My First Post\ndescription: A short introduction\n---\nWelcome to the site. This is the body.\n';
  // Front-matter-only edit: title changed, description and body untouched.
  const POST_V2 = '---\ntitle: My Renamed Post\ndescription: A short introduction\n---\nWelcome to the site. This is the body.\n';

  const syncOpts = (dir, extra = {}) => ({
    contentDir: dir,
    sourceLocale: 'en',
    pairs: buildFakePairs(),
    translatableFields: null,
    apiKey: 'test-key',
    dryRun: false,
    cwd: dir,
    ...extra,
  });

  beforeEach(() => {
    tmpDir = makeTempDir();
    resetFakeCalls();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('a front-matter-only edit does not re-pay the body (and unchanged fields hit TM)', async () => {
    writeContent(tmpDir, 'posts/hello.md', POST_V1);

    // First run — everything is a cache miss: one batch (title+description),
    // one body call. TM is persisted for the next run.
    await runContentSync(syncOpts(tmpDir));
    assert.equal(FakeContentMethod.contentCalls.length, 1, 'first run pays for the body once');
    assert.deepEqual(FakeContentMethod.batchCalls, [['title', 'description']]);
    assert.ok(
      fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)),
      'TM must be persisted after content sync'
    );

    const firstOutput = fs.readFileSync(path.join(tmpDir, 'posts/hello.fr.md'), 'utf-8');
    assert.ok(firstOutput.includes('FR:My First Post'));
    assert.ok(firstOutput.includes('FR<Welcome to the site. This is the body.>'));

    // Front-matter-only edit — the file hash changes, so the whole file is
    // re-processed, but only the CHANGED segment (title) may hit the API.
    writeContent(tmpDir, 'posts/hello.md', POST_V2);
    resetFakeCalls();
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeContentMethod.contentCalls.length, 0, 'the unchanged body must be served from TM');
    assert.deepEqual(FakeContentMethod.batchCalls, [['title']], 'only the edited field goes to the API');

    const secondOutput = fs.readFileSync(path.join(tmpDir, 'posts/hello.fr.md'), 'utf-8');
    assert.ok(secondOutput.includes('FR:My Renamed Post'), 'new title translated');
    assert.ok(secondOutput.includes('FR:A short introduction'), 'unchanged field served from TM');
    assert.ok(secondOutput.includes('FR<Welcome to the site. This is the body.>'), 'body re-served from cache, not re-translated');
  });

  it('a duplicate body in a second file is free (TM hit across files)', async () => {
    writeContent(tmpDir, 'posts/hello.md', POST_V1);
    await runContentSync(syncOpts(tmpDir));
    resetFakeCalls();

    // Same body, different front matter — the body must be a TM hit.
    writeContent(tmpDir, 'posts/copy.md',
      '---\ntitle: A Different Title\ndescription: Something else\n---\nWelcome to the site. This is the body.\n');
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeContentMethod.contentCalls.length, 0, 'duplicate body must not be re-paid');
    const copyOutput = fs.readFileSync(path.join(tmpDir, 'posts/copy.fr.md'), 'utf-8');
    assert.ok(copyOutput.includes('FR<Welcome to the site. This is the body.>'), 'cached body reused');
    assert.ok(copyOutput.includes('FR:A Different Title'), 'new fields still translated');
  });

  it('--no-tm bypasses the cache entirely and persists nothing', async () => {
    writeContent(tmpDir, 'posts/hello.md', POST_V1);
    await runContentSync(syncOpts(tmpDir, { noTM: true }));
    assert.equal(FakeContentMethod.contentCalls.length, 1);
    assert.ok(
      !fs.existsSync(path.join(tmpDir, TM_DIR, TM_FILENAME)),
      '--no-tm must not write a TM file'
    );

    // Re-run after an edit with --no-tm: everything is re-paid.
    writeContent(tmpDir, 'posts/hello.md', POST_V2);
    resetFakeCalls();
    await runContentSync(syncOpts(tmpDir, { noTM: true }));
    assert.equal(FakeContentMethod.contentCalls.length, 1, 'body re-paid under --no-tm');
    assert.deepEqual(FakeContentMethod.batchCalls, [['title', 'description']], 'all fields re-paid under --no-tm');
  });

  it('switching the model invalidates cached content (tmMethodKey identity)', async () => {
    writeContent(tmpDir, 'posts/hello.md', POST_V1);
    await runContentSync(syncOpts(tmpDir));
    resetFakeCalls();

    // Same source edit-free re-run would be skipped by the file hash, so
    // force reprocessing with a front-matter edit AND switch the model:
    // the body must MISS (different tmMethodKey), not re-serve flash-era output.
    writeContent(tmpDir, 'posts/hello.md', POST_V2);
    const pairs = buildFakePairs();
    pairs.get('en:fr').model = 'other-model';
    await runContentSync(syncOpts(tmpDir, { pairs }));

    assert.equal(FakeContentMethod.contentCalls.length, 1, 'model switch must re-translate the body');
    assert.deepEqual(FakeContentMethod.batchCalls, [['title', 'description']], 'model switch must re-translate all fields');
  });

  // ── Block segmentation (lane-A port from docusaurus-sync.js) ──────
  // The body is split into top-level blocks; unchanged blocks are TM hits
  // and only the misses are billed, in ONE batched call per file × locale.

  /** Count the segments sent in the most recent content call. */
  function lastCallSegCount() {
    const prompt = FakeContentMethod.contentCalls.at(-1);
    return (prompt.match(/⟦SEG_\d+⟧/g) || []).length;
  }

  const MULTI_BLOCK_POST = [
    '---',
    'title: Guide Title',
    'description: A guide description',
    '---',
    '',
    '# Welcome',
    '',
    'First paragraph of prose.',
    '',
    'Second paragraph stays stable.',
    '',
  ].join('\n');

  it('first sync bills each body block once, in ONE batched call', async () => {
    writeContent(tmpDir, 'posts/guide.md', MULTI_BLOCK_POST);
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeContentMethod.contentCalls.length, 1, 'exactly one body API call');
    assert.equal(lastCallSegCount(), 3, 'all three blocks billed on first sync');

    const written = fs.readFileSync(path.join(tmpDir, 'posts/guide.fr.md'), 'utf-8');
    assert.ok(written.includes('FR<# Welcome>'), 'heading block translated');
    assert.ok(written.includes('FR<First paragraph of prose.>'), 'first paragraph translated');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'second paragraph translated');
  });

  it('a one-block edit bills exactly one block (others served from TM)', async () => {
    writeContent(tmpDir, 'posts/guide.md', MULTI_BLOCK_POST);
    await runContentSync(syncOpts(tmpDir));
    resetFakeCalls();

    writeContent(
      tmpDir, 'posts/guide.md',
      MULTI_BLOCK_POST.replace('First paragraph of prose.', 'First paragraph of prose, edited.')
    );
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeContentMethod.contentCalls.length, 1, 'one batched call for the misses');
    assert.equal(lastCallSegCount(), 1, 'exactly ONE block billed for a one-block edit');
    const prompt = FakeContentMethod.contentCalls[0];
    assert.ok(prompt.includes('First paragraph of prose, edited.'), 'the edited block is in the payload');
    assert.ok(!prompt.includes('Second paragraph stays stable.'), 'unchanged blocks are NOT in the payload');
    assert.deepEqual(FakeContentMethod.batchCalls, [], 'unchanged front matter fields are TM hits');

    const written = fs.readFileSync(path.join(tmpDir, 'posts/guide.fr.md'), 'utf-8');
    assert.ok(written.includes('FR<First paragraph of prose, edited.>'), 'edited block re-translated');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'unchanged block reused from TM');
  });

  it('a front-matter-only edit bills zero body blocks and only the edited field', async () => {
    writeContent(tmpDir, 'posts/guide.md', MULTI_BLOCK_POST);
    await runContentSync(syncOpts(tmpDir));
    resetFakeCalls();

    writeContent(
      tmpDir, 'posts/guide.md',
      MULTI_BLOCK_POST.replace('title: Guide Title', 'title: Renamed Guide')
    );
    await runContentSync(syncOpts(tmpDir));

    assert.equal(FakeContentMethod.contentCalls.length, 0, 'zero body blocks billed');
    assert.deepEqual(FakeContentMethod.batchCalls, [['title']], 'only the edited field goes to the API');

    const written = fs.readFileSync(path.join(tmpDir, 'posts/guide.fr.md'), 'utf-8');
    assert.ok(written.includes('FR:Renamed Guide'), 'new title translated');
    assert.ok(written.includes('FR:A guide description'), 'unchanged field served from TM');
    assert.ok(written.includes('FR<Second paragraph stays stable.>'), 'body reused');
  });

  it("contentSegmentation: 'page' preserves single-prompt behavior but stays TM-threaded", async () => {
    writeContent(tmpDir, 'posts/guide.md', MULTI_BLOCK_POST);
    const pagePairs = buildFakePairs();
    pagePairs.get('en:fr').contentSegmentation = 'page';
    await runContentSync(syncOpts(tmpDir, { pairs: pagePairs }));

    assert.equal(FakeContentMethod.contentCalls.length, 1);
    assert.ok(!FakeContentMethod.contentCalls[0].includes('⟦SEG_'), 'page mode uses the whole-body prompt');
    const written = fs.readFileSync(path.join(tmpDir, 'posts/guide.fr.md'), 'utf-8');
    assert.ok(written.includes('FR-PAGE<'), 'whole-body translation written');
    resetFakeCalls();

    // Identical body in a second file: the whole-body TM entry must serve
    // it without an API call, even in page mode.
    writeContent(tmpDir, 'posts/guide-copy.md', MULTI_BLOCK_POST);
    await runContentSync(syncOpts(tmpDir, { pairs: pagePairs }));
    assert.equal(FakeContentMethod.contentCalls.length, 0, 'page mode body served from whole-body TM');
  });

  it('rejects an invalid contentSegmentation value loudly', async () => {
    writeContent(tmpDir, 'posts/guide.md', MULTI_BLOCK_POST);
    const badPairs = buildFakePairs();
    badPairs.get('en:fr').contentSegmentation = 'paragraph';
    await assert.rejects(
      () => runContentSync(syncOpts(tmpDir, { pairs: badPairs })),
      /Invalid contentSegmentation "paragraph"/
    );
  });
});
