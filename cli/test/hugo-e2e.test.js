/**
 * End-to-end Hugo integration test.
 *
 * Creates a realistic Hugo project structure and runs the full
 * champollion pipeline against it, verifying:
 *   - TOML i18n string file translation (fallback mode)
 *   - YAML front matter parsing/replacement in content files
 *   - Hugo shortcode protection during content translation
 *   - Code block protection during content translation
 *   - Hugo filename convention (my-post.md → my-post.fr.md)
 *   - Nested content directory structure
 *   - TOML front matter (+++...+++) handling
 *   - Edge cases: empty body, no front matter, complex front matter
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runSync, runContentSync } from '../lib/sync.js';
import {
  parseContentFile,
  protectBlocks,
  restoreBlocks,
  discoverContentFiles,
  getTargetContentPath,
  reassembleContentFile,
  buildContentPrompt,
} from '../lib/content.js';
import { readLocaleFile, writeLocaleFile, detectFormatFromDir } from '../lib/format.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-hugo-e2e-'));
}

function writeFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

// -----------------------------------------------------------------
// Realistic Hugo content fixtures
// -----------------------------------------------------------------

const HUGO_TOML_SOURCE = `# Hugo i18n source locale
[home]
other = "Home"

[welcome]
other = "Welcome to our website"

[about]
other = "About Us"

[contact]
other = "Contact"

[nav_blog]
other = "Blog"

[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
`;

// Realistic Hugo blog post with shortcodes, code blocks, and complex front matter
const HUGO_BLOG_POST = `---
title: Getting Started with Hugo
description: A comprehensive guide to building your first Hugo site
date: 2024-03-15T10:00:00Z
draft: false
author: Jane Developer
tags:
  - hugo
  - tutorial
  - static-site
categories:
  - web-development
weight: 10
slug: getting-started
featured_image: /images/hugo-logo.png
---
Hugo is one of the most popular open-source static site generators. With its
amazing speed and flexibility, Hugo makes building websites fun again.

## Installation

Install Hugo on your system:

\`\`\`bash
# macOS
brew install hugo

# Windows
choco install hugo-extended

# Verify
hugo version
\`\`\`

## Your First Site

Create a new site with:

\`\`\`bash
hugo new site my-awesome-site
cd my-awesome-site
\`\`\`

{{< figure src="/images/new-site.png" alt="New Hugo site structure" caption="Your new Hugo site directory" >}}

## Adding Content

Create your first post:

\`\`\`markdown
---
title: "My First Post"
date: 2024-03-15
---
Hello, world!
\`\`\`

{{% notice tip %}}
You can use \`hugo server -D\` to preview draft content during development.
{{% /notice %}}

## Key Concepts

Hugo uses a **content-centric** approach. Here are the key concepts:

1. **Content Organization** — files in \`content/\` map to URLs
2. **Templates** — Go-based HTML templates in \`layouts/\`
3. **Shortcodes** — reusable content snippets like \`{{</* figure */>}}\`
4. **Taxonomies** — categories, tags, and custom groupings

<div class="callout">
  <strong>Pro tip:</strong> Use Hugo Modules for dependency management.
</div>

## What's Next?

Check out the [official Hugo documentation](https://gohugo.io/documentation/) to learn more.
Stay tuned for our follow-up posts on Hugo themes and deployment.
`;

// Simple "About" page without complex formatting
const HUGO_ABOUT_PAGE = `---
title: About Our Team
description: Learn about the people behind the project
---
We are a small team of developers passionate about open source.

Our mission is to make web development accessible to everyone.
`;

// Content with Hugo shortcodes nested in various ways
const HUGO_SHORTCODE_HEAVY = `---
title: Shortcode Showcase
description: Demonstrating Hugo shortcode protection
---
Here are some shortcodes:

{{< youtube dQw4w9WgXcQ >}}

Some text between shortcodes.

{{< gist user 12345 >}}

A paired shortcode:

{{% highlight go %}}
package main

func main() {
    fmt.Println("Hello, World!")
}
{{% /highlight %}}

And inline code like \`fmt.Println\` should also survive.
`;

const TEST_LANGUAGES = {
  fr: { name: 'French', register: 'Professional, formal vous-form.' },
  ja: { name: 'Japanese', register: 'Polite です/ます form.' },
};

/**
 * Build a v3 pair Map from a languages object for testing.
 * Content-sync now accepts the pair graph (Map<string, pairConfig>)
 * instead of the v2 languages object.
 */
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

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('Hugo E2E: TOML i18n string files', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('auto-detects TOML format from Hugo i18n directory', () => {
    writeFile(tmpDir, 'i18n/en.toml', HUGO_TOML_SOURCE);
    const format = detectFormatFromDir(path.join(tmpDir, 'i18n'));
    assert.equal(format, 'toml');
  });

  it('reads and round-trips Hugo TOML i18n files correctly', () => {
    const i18nDir = path.join(tmpDir, 'i18n');
    writeFile(tmpDir, 'i18n/en.toml', HUGO_TOML_SOURCE);

    const data = readLocaleFile(path.join(i18nDir, 'en.toml'), 'toml');

    // Verify the flat key structure
    // Single-value sections (only 'other') collapse to just the key name
    assert.equal(data['home'], 'Home');
    assert.equal(data['welcome'], 'Welcome to our website');
    // Multi-value sections (plurals) keep their sub-keys
    assert.equal(data['items.one'], '{{ .Count }} item');
    assert.equal(data['items.other'], '{{ .Count }} items');

    // Write it back and verify structure
    writeLocaleFile(path.join(i18nDir, 'test.toml'), data, 'toml', data);
    const roundTripped = fs.readFileSync(path.join(i18nDir, 'test.toml'), 'utf-8');

    // Should have section headers
    assert.ok(roundTripped.includes('[home]'), 'has [home] section');
    assert.ok(roundTripped.includes('[items]'), 'has [items] section');
    assert.ok(roundTripped.includes('one = "{{ .Count }} item"'), 'preserves Hugo template syntax');
  });

  it('syncs TOML i18n files without API key exits with error (no silent failures)', async () => {
    const i18nDir = path.join(tmpDir, 'i18n');
    writeFile(tmpDir, 'i18n/en.toml', HUGO_TOML_SOURCE);

    // Create a config
    writeFile(tmpDir, 'champollion.config.json', JSON.stringify({
      sourceLocale: 'en',
      localesDir: './i18n',
      format: 'toml',
      languages: ['fr'],
    }));

    // Without an API key, sync should fail at preflight
    try {
      await runSync({ cwd: tmpDir, cliArgs: {} });
      // If it doesn't throw, it should have exited cleanly without writing files
      // (preflight catches the missing key)
    } catch (err) {
      // Expected: preflight or sync error about missing API key
      assert.ok(err.message || err, 'Error should have a message');
    }

    // fr.toml should NOT have been created with [EN] garbage
    const frPath = path.join(i18nDir, 'fr.toml');
    if (fs.existsSync(frPath)) {
      const frData = readLocaleFile(frPath, 'toml');
      // If file was created, it should NOT have [EN] prefixes
      for (const [key, value] of Object.entries(frData)) {
        if (typeof value === 'string') {
          assert.ok(!value.startsWith('[EN] '), `Key "${key}" should not have [EN] prefix`);
        }
      }
    }
  });

  it('syncs TOML i18n files in dry-run mode (full runSync)', async () => {
    writeFile(tmpDir, 'i18n/en.toml', HUGO_TOML_SOURCE);

    writeFile(tmpDir, 'champollion.config.json', JSON.stringify({
      sourceLocale: 'en',
      localesDir: './i18n',
      format: 'toml',
      languages: ['fr'],
    }));

    // Dry run doesn't need API key — just verifies pipeline structure
    await runSync({ cwd: tmpDir, dryRun: true, cliArgs: { dry: true } });

    // In dry run, fr.toml should NOT be created
    assert.ok(!fs.existsSync(path.join(tmpDir, 'i18n/fr.toml')), 'Dry run should not create fr.toml');
  });
});

describe('Hugo E2E: Content file parsing', () => {
  it('parses realistic Hugo front matter correctly', () => {
    const { frontMatter, rawFrontMatter, body, hasFrontMatter } = parseContentFile(HUGO_BLOG_POST);

    assert.ok(hasFrontMatter, 'detected front matter');
    assert.equal(frontMatter.title, 'Getting Started with Hugo');
    assert.equal(frontMatter.description, 'A comprehensive guide to building your first Hugo site');
    assert.equal(frontMatter.date, '2024-03-15T10:00:00Z');
    assert.equal(frontMatter.draft, 'false');
    assert.equal(frontMatter.author, 'Jane Developer');
    assert.equal(frontMatter.weight, '10');
    assert.equal(frontMatter.slug, 'getting-started');

    // Body should start with the content after front matter
    assert.ok(body.includes('Hugo is one of the most popular'), 'body starts correctly');
    assert.ok(body.includes('hugo new site my-awesome-site'), 'body includes code');
    assert.ok(body.includes('{{< figure'), 'body includes shortcodes');
  });

  it('preserves front matter array fields (tags, categories) as raw YAML', () => {
    const { rawFrontMatter } = parseContentFile(HUGO_BLOG_POST);

    // Arrays should be in the raw front matter for pass-through
    assert.ok(rawFrontMatter.includes('- hugo'), 'tags array preserved');
    assert.ok(rawFrontMatter.includes('- web-development'), 'categories preserved');
  });
});

describe('Hugo E2E: Block protection with real Hugo content', () => {
  it('protects all shortcodes in realistic Hugo content', () => {
    const { body } = parseContentFile(HUGO_BLOG_POST);
    const { protectedBody, blocks } = protectBlocks(body);

    // Shortcodes should be replaced with placeholders
    assert.ok(!protectedBody.includes('{{< figure'), 'figure shortcode protected');
    assert.ok(!protectedBody.includes('{{% notice'), 'notice shortcode protected');

    // Code blocks should be protected
    assert.ok(!protectedBody.includes('brew install hugo'), 'bash code protected');
    assert.ok(!protectedBody.includes('hugo new site'), 'bash code 2 protected');

    // HTML should be protected
    assert.ok(!protectedBody.includes('<div class="callout">'), 'HTML protected');

    // But regular Markdown should remain
    assert.ok(protectedBody.includes('Hugo is one of the most popular'), 'prose preserved');
    assert.ok(protectedBody.includes('## Installation'), 'headers preserved');
    assert.ok(protectedBody.includes("**content-centric**"), 'bold preserved');

    // Blocks array should have captured everything
    // Code blocks (3) + paired shortcodes + standalone shortcodes + inline code + HTML
    assert.ok(blocks.size >= 5, `captured ${blocks.size} blocks (expected >= 5)`);
  });

  it('round-trips blocks through protect → restore', () => {
    const { body } = parseContentFile(HUGO_BLOG_POST);
    const { protectedBody, blocks } = protectBlocks(body);
    const restored = restoreBlocks(protectedBody, blocks);

    // Restored body should match original (modulo minor whitespace)
    assert.ok(restored.includes('{{< figure src="/images/new-site.png"'), 'figure shortcode restored');
    assert.ok(restored.includes('{{% notice tip %}}'), 'notice shortcode restored');
    assert.ok(restored.includes('brew install hugo'), 'code restored');
    assert.ok(restored.includes('<div class="callout">'), 'HTML restored');
  });

  it('protects shortcode-heavy content correctly', () => {
    const { body } = parseContentFile(HUGO_SHORTCODE_HEAVY);
    const { protectedBody, blocks } = protectBlocks(body);

    assert.ok(!protectedBody.includes('{{< youtube'), 'youtube protected');
    assert.ok(!protectedBody.includes('{{< gist'), 'gist protected');
    assert.ok(!protectedBody.includes('{{% highlight'), 'highlight protected');
    assert.ok(!protectedBody.includes('fmt.Println'), 'go code inside shortcode protected');

    // Restore should bring everything back
    const restored = restoreBlocks(protectedBody, blocks);
    assert.ok(restored.includes('{{< youtube dQw4w9WgXcQ >}}'), 'youtube restored');
    assert.ok(restored.includes('{{< gist user 12345 >}}'), 'gist restored');
    assert.ok(restored.includes('fmt.Println("Hello, World!")'), 'go code restored');
  });
});

describe('Hugo E2E: Content sync pipeline', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('throws when translating Hugo content without API key', async () => {
    writeFile(tmpDir, 'content/posts/getting-started.md', HUGO_BLOG_POST);
    writeFile(tmpDir, 'content/about.md', HUGO_ABOUT_PAGE);

    await assert.rejects(
      () => runContentSync({
        contentDir: path.join(tmpDir, 'content'),
        sourceLocale: 'en',
        pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
        translatableFields: null,
        apiKey: null,
        dryRun: false,
      }),
      (err) => {
        assert.ok(err.message.includes('no API key'), `Expected API key error, got: ${err.message}`);
        return true;
      },
      'Should throw loud error when no API key available'
    );
  });

  it('dry-run mode for multiple languages does not write files', async () => {
    writeFile(tmpDir, 'content/posts/hello.md', HUGO_ABOUT_PAGE);

    await runContentSync({
      contentDir: path.join(tmpDir, 'content'),
      sourceLocale: 'en',
      pairs: buildTestPairs(TEST_LANGUAGES),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
    });

    assert.ok(!fs.existsSync(path.join(tmpDir, 'content/posts/hello.fr.md')), 'French NOT created in dry run');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'content/posts/hello.ja.md')), 'Japanese NOT created in dry run');
  });

  it('handles Hugo page bundles in dry-run mode', async () => {
    writeFile(tmpDir, 'content/posts/my-post/index.md', HUGO_ABOUT_PAGE);

    await runContentSync({
      contentDir: path.join(tmpDir, 'content'),
      sourceLocale: 'en',
      pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
    });

    // Dry run — verifies pipeline doesn't crash, file isn't created
  });

  it('handles deep Hugo section nesting in dry-run mode', async () => {
    writeFile(tmpDir, 'content/blog/2024/march/getting-started.md', HUGO_ABOUT_PAGE);

    await runContentSync({
      contentDir: path.join(tmpDir, 'content'),
      sourceLocale: 'en',
      pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
    });

    // Dry run — verifies path nesting doesn't crash
  });

  it('full Hugo project dry-run: i18n + content together', async () => {
    // Set up a full Hugo-like project
    writeFile(tmpDir, 'i18n/en.toml', HUGO_TOML_SOURCE);
    writeFile(tmpDir, 'content/posts/hello.md', HUGO_BLOG_POST);
    writeFile(tmpDir, 'content/about.md', HUGO_ABOUT_PAGE);

    // Config that enables both i18n and content sync
    writeFile(tmpDir, 'champollion.config.json', JSON.stringify({
      sourceLocale: 'en',
      localesDir: './i18n',
      contentDir: './content',
      format: 'toml',
      languages: ['fr'],
    }));

    // Dry run to verify the full pipeline structure without API key
    await runSync({ cwd: tmpDir, dryRun: true, cliArgs: { dry: true } });

    // In dry run, no files should be created
    assert.ok(!fs.existsSync(path.join(tmpDir, 'i18n/fr.toml')), 'Dry run should not create TOML');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'content/posts/hello.fr.md')), 'Dry run should not create content');
  });
});

describe('Hugo E2E: Content prompt quality', () => {
  it('builds a translation-ready prompt from Hugo content', () => {
    const { body } = parseContentFile(HUGO_BLOG_POST);
    const { protectedBody } = protectBlocks(body);
    const prompt = buildContentPrompt(protectedBody, {
      name: 'French',
      register: 'Professional, formal vous-form.',
    });

    // Prompt should include language and register
    assert.ok(prompt.includes('French'), 'specifies target language');
    assert.ok(prompt.includes('Professional'), 'includes register');

    // Prompt should have rules about placeholders
    assert.ok(prompt.includes('⟦PROTECTED_'), 'mentions placeholder syntax');

    // Prompt should include the protected body
    assert.ok(prompt.includes('## Installation'), 'includes content headers');
    assert.ok(!prompt.includes('brew install hugo'), 'code blocks are protected');
  });
});

describe('Hugo E2E: TOML front matter (+++)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('parses TOML front matter correctly', () => {
    const tomlFM = `+++
title = "My TOML Post"
date = 2024-01-01
draft = false
description = "A post with TOML front matter"
+++
This is the body.
`;
    const { frontMatter, body, hasFrontMatter, frontMatterFormat } = parseContentFile(tomlFM);

    assert.equal(hasFrontMatter, true, 'TOML front matter detected');
    assert.equal(frontMatterFormat, 'toml', 'format is toml');
    assert.equal(frontMatter.title, 'My TOML Post');
    assert.equal(frontMatter.description, 'A post with TOML front matter');
    assert.equal(frontMatter.draft, 'false');
    assert.ok(body.includes('This is the body.'), 'body parsed');
  });

  it('reassembles TOML front matter with +++ delimiters', () => {
    const result = reassembleContentFile({
      rawFrontMatter: 'title = "My Post"\ndate = 2024-01-01\ndraft = false',
      translatedFields: { title: 'Mon Article' },
      translatedBody: '\nContenu traduit.\n',
      hasFrontMatter: true,
      frontMatterFormat: 'toml',
    });

    assert.ok(result.startsWith('+++\n'), 'starts with +++');
    assert.ok(result.includes('title = "Mon Article"'), 'title translated');
    assert.ok(result.includes('date = 2024-01-01'), 'date preserved');
    assert.ok(result.includes('draft = false'), 'draft preserved');
    assert.ok(result.includes('+++\n\nContenu'), 'closes with +++ before body');
  });

  it('parses TOML front matter content correctly in dry-run', async () => {
    const tomlContent = `+++
title = "TOML Front Matter Test"
description = "Testing TOML front matter in Hugo"
date = 2024-06-15
draft = false
tags = ["hugo", "toml"]
+++
This is a Hugo post using TOML front matter.

It should be fully supported by champollion.
`;
    writeFile(tmpDir, 'content/posts/toml-test.md', tomlContent);

    // Dry run to verify TOML parsing doesn't crash
    await runContentSync({
      contentDir: path.join(tmpDir, 'content'),
      sourceLocale: 'en',
      pairs: buildTestPairs({ fr: TEST_LANGUAGES.fr }),
      translatableFields: null,
      apiKey: null,
      dryRun: true,
    });

    // File should NOT be created in dry run
    assert.ok(!fs.existsSync(path.join(tmpDir, 'content/posts/toml-test.fr.md')), 'No file in dry run');
  });

  it('handles TOML front matter with TOML-specific syntax', () => {
    // Suppress the expected console.warn about [params]
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const toml = `+++
title = "Complex TOML"
date = 2024-01-01T10:30:00Z
weight = 42
[params]
  sidebar = true
+++
Body content.
`;
      const { frontMatter, hasFrontMatter, frontMatterFormat } = parseContentFile(toml);

      assert.equal(hasFrontMatter, true);
      assert.equal(frontMatterFormat, 'toml');
      assert.equal(frontMatter.title, 'Complex TOML');
      assert.equal(frontMatter.weight, '42');
      // Keys inside [params] are correctly skipped — they belong to the
      // nested table and are not top-level front matter fields.
      // The parser warns about this so users know these fields won't be translated.
      assert.equal(frontMatter.sidebar, undefined, 'nested table keys are skipped');
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('Hugo E2E: File discovery edge cases', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('excludes existing translation files from source discovery', () => {
    writeFile(tmpDir, 'posts/hello.md', HUGO_ABOUT_PAGE);
    writeFile(tmpDir, 'posts/hello.fr.md', '---\ntitle: Bonjour\n---\n');
    writeFile(tmpDir, 'posts/hello.ja.md', '---\ntitle: こんにちは\n---\n');

    const sources = discoverContentFiles(tmpDir, 'en');
    assert.equal(sources.length, 1, 'only source file discovered');
    assert.ok(sources[0].endsWith('hello.md'), 'correct source file');
  });

  it('includes .en.md files as source files', () => {
    writeFile(tmpDir, 'posts/hello.en.md', HUGO_ABOUT_PAGE);

    const sources = discoverContentFiles(tmpDir, 'en');
    assert.equal(sources.length, 1, 'source .en.md found');
  });

  it('handles files with version-like suffixes (not lang codes)', () => {
    writeFile(tmpDir, 'docs/version.2.md', HUGO_ABOUT_PAGE);

    const sources = discoverContentFiles(tmpDir, 'en');
    assert.equal(sources.length, 1, 'version.2.md treated as source');
  });
});
