#!/usr/bin/env node
/**
 * Content translation test suite — Markdown parsing, block protection, and reassembly.
 * Run: node test/content.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import {
  parseContentFile,
  parseSimpleFrontMatter,
  parseSimpleTomlFrontMatter,
  rebuildFrontMatter,
  protectBlocks,
  restoreBlocks,
  hasOrphanedPlaceholders,
  discoverContentFiles,
  getTargetContentPath,
  buildContentPrompt,
  reassembleContentFile,
  isLikelyLangCode,
  DEFAULT_TRANSLATABLE_FIELDS,
  findUntranslatableNestedFields,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
} from '../lib/content.js';

// =================================================================
// 1. Front matter parsing
// =================================================================
describe('parseContentFile', () => {
  it('parses YAML front matter from Markdown', () => {
    const raw = '---\ntitle: "My Post"\ndate: 2024-01-15\ndraft: false\n---\n\n# Hello\n\nWorld\n';
    const result = parseContentFile(raw);
    assert.equal(result.hasFrontMatter, true);
    assert.equal(result.frontMatter.title, 'My Post');
    assert.equal(result.frontMatter.date, '2024-01-15');
    assert.equal(result.frontMatter.draft, 'false');
    assert.ok(result.body.includes('# Hello'));
    assert.ok(result.body.includes('World'));
  });

  it('handles files without front matter', () => {
    const raw = '# Just Markdown\n\nNo front matter here.\n';
    const result = parseContentFile(raw);
    assert.equal(result.hasFrontMatter, false);
    assert.deepEqual(result.frontMatter, {});
    assert.ok(result.body.includes('# Just Markdown'));
  });

  it('handles empty files', () => {
    const result = parseContentFile('');
    assert.equal(result.hasFrontMatter, false);
    assert.equal(result.body, '');
  });

  it('parses the Hugo content fixture', () => {

    const fixturePath = path.join(import.meta.dirname, 'fixtures', 'hugo-content', 'posts', 'my-first-post.md');
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    const result = parseContentFile(raw);

    assert.equal(result.hasFrontMatter, true);
    assert.equal(result.frontMatter.title, 'My First Blog Post');
    assert.equal(result.frontMatter.description, 'An introduction to Hugo and static site generation');
    assert.equal(result.frontMatter.draft, 'false');
    assert.ok(result.body.includes('# Getting Started with Hugo'));
    assert.ok(result.body.includes('```bash'));
    assert.ok(result.body.includes('{{< figure'));
  });
});

describe('parseSimpleFrontMatter', () => {
  it('parses simple key-value pairs', () => {
    const yaml = 'title: My Post\nauthor: Curtis Forbes';
    const result = parseSimpleFrontMatter(yaml);
    assert.equal(result.title, 'My Post');
    assert.equal(result.author, 'Curtis Forbes');
  });

  it('handles quoted values', () => {
    const yaml = 'title: "My Post: A Story"\ndescription: \'Short desc\'';
    const result = parseSimpleFrontMatter(yaml);
    assert.equal(result.title, 'My Post: A Story');
    assert.equal(result.description, 'Short desc');
  });

  it('skips indented lines (arrays, nested objects)', () => {
    const yaml = 'title: Post\ntags:\n  - hugo\n  - tutorial\nauthor: Curtis';
    const result = parseSimpleFrontMatter(yaml);
    assert.equal(result.title, 'Post');
    assert.equal(result.author, 'Curtis');
    // Tags array parent line ("tags:") should be skipped
    assert.equal(result.tags, undefined);
  });

  it('skips comment lines', () => {
    const yaml = '# Comment\ntitle: Post';
    const result = parseSimpleFrontMatter(yaml);
    assert.equal(result.title, 'Post');
  });

  it('skips YAML block scalars (>-, |) — value is only the indicator', () => {
    // Regression: a `description: >-` block scalar was parsed as the literal
    // value ">-", which the rebuild then re-quoted, orphaning the indented
    // text below it and emitting invalid YAML. Block scalars must pass through
    // raw and untranslated (multi-line values are not extracted).
    const yaml = [
      'title: Post',
      'description: >-',
      '  First line of the folded description that spans',
      '  two indented lines.',
      'body: |',
      '  literal block',
      'author: Curtis',
    ].join('\n');
    const result = parseSimpleFrontMatter(yaml);
    assert.equal(result.title, 'Post');
    assert.equal(result.author, 'Curtis');
    assert.equal(result.description, undefined); // block scalar skipped
    assert.equal(result.body, undefined);        // literal block skipped
  });
});

// =================================================================
// 2. Front matter rebuilding
// =================================================================
describe('rebuildFrontMatter', () => {
  it('replaces translated fields while preserving other lines', () => {
    const rawYaml = 'title: "My Post"\ndate: 2024-01-15\ndraft: false';
    const translations = { title: 'Mon Article' };
    const result = rebuildFrontMatter(rawYaml, translations);
    assert.ok(result.includes('title: "Mon Article"'));
    assert.ok(result.includes('date: 2024-01-15'));
    assert.ok(result.includes('draft: false'));
  });

  it('preserves array lines untouched', () => {
    const rawYaml = 'title: Post\ntags:\n  - hugo\n  - tutorial';
    const translations = { title: 'Article' };
    const result = rebuildFrontMatter(rawYaml, translations);
    assert.ok(result.includes('title: "Article"'));
    assert.ok(result.includes('  - hugo'));
    assert.ok(result.includes('  - tutorial'));
  });

  it('quotes values with special characters', () => {
    const rawYaml = 'title: Post';
    const translations = { title: 'Article: Un guide' };
    const result = rebuildFrontMatter(rawYaml, translations);
    assert.ok(result.includes('"Article: Un guide"'));
  });

  it('never rewrites a block scalar value, even if keyed in translations', () => {
    // Defense-in-depth: even if a block-scalar key reached translations, the
    // `>-` line and its indented text must survive untouched — never collapsed
    // to `description: ">-"`.
    const rawYaml = 'title: Post\ndescription: >-\n  Folded line one\n  line two.';
    const translations = { title: 'Article', description: 'should be ignored' };
    const result = rebuildFrontMatter(rawYaml, translations);
    assert.ok(result.includes('title: "Article"'));
    assert.ok(result.includes('description: >-'));
    assert.ok(result.includes('  Folded line one'));
    assert.ok(!result.includes('description: "'), 'block scalar must not be re-quoted');
  });
});

// Regression: block-scalar frontmatter survives a full parse → reassemble
// round-trip as valid YAML (the bug that broke the merged-site build).
describe('reassembleContentFile — block scalar frontmatter', () => {
  it('preserves a `description: >-` block scalar through translation', () => {
    const raw = [
      '---',
      'title: Honest Limitations',
      'description: >-',
      '  What Champollion does not (yet) claim. The checkable limits on our',
      '  evaluation, trust tiers, and held-out infrastructure.',
      '---',
      '',
      '# Body text',
    ].join('\n');
    const parsed = parseContentFile(raw);
    // The block-scalar description must NOT be extracted as a translatable field.
    assert.equal(parsed.frontMatter.description, undefined);
    assert.equal(parsed.frontMatter.title, 'Honest Limitations');
    // champollion translates `title`; `description` is left alone.
    const out = reassembleContentFile({
      rawFrontMatter: parsed.rawFrontMatter,
      translatedFields: { title: 'Limites honnêtes' },
      translatedBody: parsed.body,
      hasFrontMatter: true,
      frontMatterFormat: 'yaml',
    });
    assert.ok(out.includes('title: "Limites honnêtes"'));
    assert.ok(out.includes('description: >-'), 'block scalar indicator preserved');
    assert.ok(out.includes('  What Champollion does not (yet) claim.'), 'folded text preserved');
    assert.ok(!out.includes('description: ">-"'), 'block scalar must not be mangled');
  });
});

// =================================================================
// 3. Block protection
// =================================================================
describe('protectBlocks', () => {
  it('protects fenced code blocks', () => {
    const body = 'Text before\n\n```bash\necho "hello"\n```\n\nText after';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('```bash'));
    assert.ok(!protectedBody.includes('echo'));
    assert.ok(protectedBody.includes(PLACEHOLDER_PREFIX));
    assert.equal(blocks.size, 1);
  });

  it('protects Hugo shortcodes (angle bracket style)', () => {
    const body = 'Before\n\n{{< figure src="/img.png" >}}\n\nAfter';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('{{< figure'));
    assert.ok(protectedBody.includes(PLACEHOLDER_PREFIX));
  });

  it('protects Hugo shortcodes (percent style)', () => {
    const body = 'Before\n\n{{% notice tip %}}\nContent\n{{% /notice %}}\n\nAfter';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('{{% notice'));
  });

  it('protects inline code', () => {
    const body = 'Use `hugo server` to start.';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('`hugo server`'));
    assert.ok(protectedBody.includes(PLACEHOLDER_PREFIX));
  });

  it('protects HTML tags', () => {
    const body = 'Text <div class="custom">content</div> more';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('<div'));
    assert.ok(!protectedBody.includes('</div>'));
  });

  it('preserves translatable text', () => {
    const body = 'This should be translated. **Bold text** too.';
    const { protectedBody } = protectBlocks(body);
    assert.ok(protectedBody.includes('This should be translated'));
    assert.ok(protectedBody.includes('**Bold text**'));
  });

  it('handles multiple code blocks', () => {
    const body = '```js\nconst a = 1;\n```\n\nText\n\n```python\nprint("hi")\n```';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.equal(blocks.size, 2);
    assert.ok(protectedBody.includes('Text'));
  });

  it('handles body with no protectable content', () => {
    const body = 'Just plain text with **bold** and *italic*.';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.equal(blocks.size, 0);
    assert.equal(protectedBody, body);
  });
});

// =================================================================
// 4. Block restoration
// =================================================================
describe('restoreBlocks', () => {
  it('restores all protected blocks', () => {
    const body = 'Text before\n\n```bash\necho "hello"\n```\n\nText after';
    const { protectedBody, blocks } = protectBlocks(body);
    const restored = restoreBlocks(protectedBody, blocks);
    assert.equal(restored, body);
  });

  it('round-trips complex content with all block types', () => {
    const body = [
      '# Title',
      '',
      'Use `inline code` here.',
      '',
      '```python',
      'def hello():',
      '    print("world")',
      '```',
      '',
      '{{< shortcode param="val" >}}',
      '',
      '<div class="custom">html</div>',
    ].join('\n');

    const { protectedBody, blocks } = protectBlocks(body);
    const restored = restoreBlocks(protectedBody, blocks);
    assert.equal(restored, body);
  });

  it('handles translated text around placeholders', () => {
    const body = 'Hello `world` goodbye';
    const { protectedBody, blocks } = protectBlocks(body);
    // Simulate translation changing surrounding text
    const translated = protectedBody.replace('Hello', 'Bonjour').replace('goodbye', 'au revoir');
    const restored = restoreBlocks(translated, blocks);
    assert.ok(restored.includes('Bonjour'));
    assert.ok(restored.includes('`world`'));
    assert.ok(restored.includes('au revoir'));
  });
});

// =================================================================
// 5. Content file discovery
// =================================================================
describe('discoverContentFiles', () => {
  it('finds source Markdown files', () => {
    const dir = path.join(import.meta.dirname, 'fixtures', 'hugo-content');
    const files = discoverContentFiles(dir, 'en');
    assert.ok(files.length >= 1);
    assert.ok(files.some(f => f.includes('my-first-post.md')));
  });

  it('returns empty array for nonexistent directory', () => {
    const files = discoverContentFiles('/tmp/nope-12345', 'en');
    assert.deepEqual(files, []);
  });
});

// =================================================================
// 6. Target path generation
// =================================================================
describe('getTargetContentPath', () => {
  it('generates target path for default filename', () => {
    const result = getTargetContentPath('/content/posts/my-post.md', 'fr', 'en');
    assert.equal(result, '/content/posts/my-post.fr.md');
  });

  it('generates target path stripping source locale suffix', () => {
    const result = getTargetContentPath('/content/posts/my-post.en.md', 'fr', 'en');
    assert.equal(result, '/content/posts/my-post.fr.md');
  });

  it('handles index.md files', () => {
    const result = getTargetContentPath('/content/about/index.md', 'ja', 'en');
    assert.equal(result, '/content/about/index.ja.md');
  });
});

// =================================================================
// 7. Language code detection
// =================================================================
describe('isLikelyLangCode', () => {
  it('recognizes 2-letter codes', () => {
    assert.equal(isLikelyLangCode('fr'), true);
    assert.equal(isLikelyLangCode('ja'), true);
  });

  it('recognizes 3-letter codes', () => {
    assert.equal(isLikelyLangCode('eng'), true);
  });

  it('recognizes region codes', () => {
    assert.equal(isLikelyLangCode('zh-TW'), true);
    assert.equal(isLikelyLangCode('pt-BR'), true);
  });

  it('rejects non-language strings', () => {
    assert.equal(isLikelyLangCode('2'), false);
    assert.equal(isLikelyLangCode('config'), false);
    assert.equal(isLikelyLangCode('v2'), false);
  });
});

// =================================================================
// 8. Content prompt building
// =================================================================
describe('buildContentPrompt', () => {
  it('includes the target language name', () => {
    const prompt = buildContentPrompt('# Hello', { name: 'French', register: 'Formal.' });
    assert.ok(prompt.includes('French'));
  });

  it('includes the register instruction', () => {
    const prompt = buildContentPrompt('# Hello', { name: 'French', register: 'Use vous-form.' });
    assert.ok(prompt.includes('Use vous-form.'));
  });

  it('includes placeholder instructions only when the body has placeholders', () => {
    const withBlocks = buildContentPrompt(
      'Before ⟦PROTECTED_0⟧ after',
      { name: 'French', register: 'Formal.' },
    );
    assert.ok(withBlocks.includes('PROTECTED'));
    assert.ok(withBlocks.includes('placeholder'));
  });

  it('omits placeholder instructions for placeholder-free bodies', () => {
    // Mentioning ⟦PROTECTED_N⟧ with no placeholders present makes some
    // models (observed: zh) echo the literal token into their output,
    // tripping the orphaned-placeholder corruption check.
    const prompt = buildContentPrompt('# Hello', { name: 'French', register: 'Formal.' });
    assert.ok(!prompt.includes('PROTECTED'));
  });

  it('includes the body content', () => {
    const prompt = buildContentPrompt('# Hello World', { name: 'French', register: 'Formal.' });
    assert.ok(prompt.includes('# Hello World'));
  });
});

// =================================================================
// 9. File reassembly
// =================================================================
describe('reassembleContentFile', () => {
  it('reassembles a file with translated front matter and body', () => {
    const result = reassembleContentFile({
      rawFrontMatter: 'title: "My Post"\ndate: 2024-01-15',
      translatedFields: { title: 'Mon Article' },
      translatedBody: '\n# Bonjour\n\nContenu traduit.\n',
      hasFrontMatter: true,
    });
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('title: "Mon Article"'));
    assert.ok(result.includes('date: 2024-01-15'));
    assert.ok(result.includes('# Bonjour'));
  });

  it('returns just body when no front matter', () => {
    const result = reassembleContentFile({
      rawFrontMatter: '',
      translatedFields: {},
      translatedBody: '# Bonjour\n',
      hasFrontMatter: false,
    });
    assert.equal(result, '# Bonjour\n');
  });

  it('preserves a blank line after front matter and a final newline', () => {
    // Regression: reassembly emitted `---\nFM\n---\n${body}` — losing the blank
    // line after the fence, and the LLM strips the trailing newline, so files
    // ended without one. Restore both deterministically.
    const result = reassembleContentFile({
      rawFrontMatter: 'title: "T"',
      translatedFields: { title: 'Titre' },
      // Body as the LLM tends to return it: no leading blank, no trailing newline.
      translatedBody: '# Corps',
      hasFrontMatter: true,
      frontMatterFormat: 'yaml',
    });
    assert.ok(result.includes('---\n\n# Corps'), 'blank line after front matter');
    assert.ok(result.endsWith('# Corps\n'), 'exactly one trailing newline');
    assert.ok(!result.endsWith('\n\n'), 'not a double trailing newline');
  });

  it('adds a trailing newline to a no-front-matter body that lacks one', () => {
    const result = reassembleContentFile({
      rawFrontMatter: '',
      translatedFields: {},
      translatedBody: '# Corps',
      hasFrontMatter: false,
    });
    assert.equal(result, '# Corps\n');
  });
});

// =================================================================
// 11. Translatable fields + untranslatable nested-field detection
// =================================================================
describe('DEFAULT_TRANSLATABLE_FIELDS', () => {
  it('includes sidebar_label (Docusaurus sidebar/menu prose)', () => {
    assert.ok(
      DEFAULT_TRANSLATABLE_FIELDS.includes('sidebar_label'),
      'sidebar_label must be translated, not left in the source language'
    );
  });
});

describe('findUntranslatableNestedFields', () => {
  it('flags a `related:` array block (never silently skipped)', () => {
    const fm = [
      'title: Post',
      'related:',
      '  - title: Other page',
      '    url: /other',
      'author: Curtis',
    ].join('\n');
    assert.deepEqual(findUntranslatableNestedFields(fm), ['related']);
  });

  it('flags inline array/object values', () => {
    const fm = 'title: Post\nrelated: [a, b]\nmeta: {x: 1}';
    const found = findUntranslatableNestedFields(fm);
    assert.ok(found.includes('related'));
    assert.ok(found.includes('meta'));
  });

  it('does NOT flag structural/taxonomy fields (tags, slug, date, …)', () => {
    const fm = [
      'title: Post',
      'tags:',
      '  - hugo',
      'slug: my-post',
      'date: 2024-01-15',
      'sidebar_position: 2',
    ].join('\n');
    assert.deepEqual(findUntranslatableNestedFields(fm), []);
  });

  it('does NOT flag block scalars (handled as a separate documented case)', () => {
    const fm = 'title: Post\ndescription: >-\n  folded text line one\n  line two';
    assert.deepEqual(findUntranslatableNestedFields(fm), []);
  });
});

// =================================================================
// 10. RED TEAM: Edge cases
// =================================================================
describe('RED TEAM: content edge cases', () => {
  it('handles front matter with no translatable fields', () => {
    const raw = '---\ndate: 2024-01-15\ndraft: true\n---\n\n# Post\n';
    const result = parseContentFile(raw);
    assert.equal(result.hasFrontMatter, true);
    // date and draft are not translatable — no title/description
    assert.equal(result.frontMatter.title, undefined);
  });

  it('handles code blocks inside shortcodes (nested protection)', () => {
    const body = '{{% tab %}}\n```go\nfmt.Println("hello")\n```\n{{% /tab %}}';
    const { protectedBody, blocks } = protectBlocks(body);
    const restored = restoreBlocks(protectedBody, blocks);
    assert.equal(restored, body);
  });

  it('handles placeholder-like text in original content', () => {
    // Unlikely but adversarial: what if content already has our placeholder format?
    const body = 'This mentions ⟦PROTECTED_0⟧ literally.';
    const { protectedBody, blocks } = protectBlocks(body);
    // No protectable blocks, so it should pass through unchanged
    assert.equal(blocks.size, 0);
    assert.equal(protectedBody, body);
  });

  it('protects backtick-heavy content correctly', () => {
    const body = 'Use `cmd1`, then `cmd2`, and finally `cmd3`.';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.equal(blocks.size, 3);
    const restored = restoreBlocks(protectedBody, blocks);
    assert.equal(restored, body);
  });
});

// =================================================================
// Orphaned placeholder detection (v2.0.1 hardening)
// =================================================================
describe('hasOrphanedPlaceholders', () => {
  it('returns false for clean text with no placeholders', () => {
    assert.equal(hasOrphanedPlaceholders('Hello world, this is normal text.'), false);
  });

  it('returns false after successful block restoration', () => {
    const body = 'Start\n\n```js\nconst x = 1;\n```\n\nEnd';
    const { protectedBody, blocks } = protectBlocks(body);
    // Simulate the LLM faithfully preserving placeholders
    const translated = protectedBody.replace('Start', 'Début').replace('End', 'Fin');
    const restored = restoreBlocks(translated, blocks);
    assert.equal(hasOrphanedPlaceholders(restored), false);
    assert.ok(restored.includes('const x = 1;'));
  });

  it('returns true when the LLM drops a placeholder', () => {
    // Simulate LLM translating and losing a placeholder entirely
    const corruptedBody = `Début\n\nFin`;
    assert.equal(hasOrphanedPlaceholders(corruptedBody), false);
    // Now with an orphaned placeholder still present
    const withOrphan = `Début\n\n${PLACEHOLDER_PREFIX}0${PLACEHOLDER_SUFFIX}\n\nFin`;
    assert.equal(hasOrphanedPlaceholders(withOrphan), true);
  });

  it('returns true when the LLM adds spaces to a placeholder', () => {
    // The LLM might add a space, making restoreBlocks miss it
    const mangledBody = `Translated text ${PLACEHOLDER_PREFIX}99${PLACEHOLDER_SUFFIX} more text`;
    assert.equal(hasOrphanedPlaceholders(mangledBody), true);
  });

  it('detects orphans in complex multi-block scenarios', () => {
    const body = 'Intro\n\n```py\nprint("hi")\n```\n\n{{< youtube abc123 >}}\n\nOutro';
    const { protectedBody, blocks } = protectBlocks(body);
    // Simulate LLM keeping only one placeholder, mangling the other
    const halfBroken = protectedBody
      .replace('Intro', 'Introducción')
      .replace('Outro', 'Final');
    // Restore works fine on the ones that are intact
    const restored = restoreBlocks(halfBroken, blocks);
    // If all went well, no orphans
    assert.equal(hasOrphanedPlaceholders(restored), false);
  });

  it('catches a single orphan among many restored blocks', () => {
    // Manually construct a scenario where one placeholder survives
    const body = `Some text\n\n${PLACEHOLDER_PREFIX}42${PLACEHOLDER_SUFFIX}\n\nMore text`;
    // This placeholder was never in the blocks map, so it stays
    const blocks = new Map();
    const restored = restoreBlocks(body, blocks);
    assert.equal(hasOrphanedPlaceholders(restored), true);
  });
});

// =================================================================
// TOML nested table warning (v2.0.1 hardening)
// =================================================================
describe('parseSimpleTomlFrontMatter nested table handling', () => {
  it('parses flat TOML keys correctly', () => {
    const toml = 'title = "Hello"\ndate = 2024-01-01\ndraft = false';
    const result = parseSimpleTomlFrontMatter(toml);
    assert.equal(result.title, 'Hello');
    assert.equal(result.date, '2024-01-01');
    assert.equal(result.draft, 'false');
  });

  it('skips nested table keys but still parses top-level keys', () => {
    const toml = 'title = "Top Level"\n[params]\nsidebar = true\ndescription = "Nested"';
    const result = parseSimpleTomlFrontMatter(toml);
    // Top-level key should be parsed
    assert.equal(result.title, 'Top Level');
    // Keys after [params] are not parsed (they belong to the nested table)
    assert.equal(result.sidebar, undefined);
    assert.equal(result.description, undefined);
  });

  it('skips array-of-tables notation', () => {
    const toml = 'title = "My Post"\n[[resources]]\nsrc = "image.png"\ntitle = "Photo"';
    const result = parseSimpleTomlFrontMatter(toml);
    // Only the top-level title should be captured
    assert.equal(result.title, 'My Post');
    assert.equal(result.src, undefined);
  });

  it('warns on nested tables via console.warn', (t) => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);
    try {
      const toml = 'title = "Test"\n[params]\nkey = "value"';
      parseSimpleTomlFrontMatter(toml);
      assert.equal(warnings.length, 1);
      assert.ok(warnings[0].includes('[params]'));
      assert.ok(warnings[0].includes('will not be translated'));
    } finally {
      console.warn = originalWarn;
    }
  });

  it('warns separately for each nested table encountered', (t) => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);
    try {
      const toml = 'title = "Test"\n[params]\nkey = "val"\n[menu.main]\nweight = 10';
      parseSimpleTomlFrontMatter(toml);
      assert.equal(warnings.length, 2);
      assert.ok(warnings[0].includes('[params]'));
      assert.ok(warnings[1].includes('[menu.main]'));
    } finally {
      console.warn = originalWarn;
    }
  });
});

// =================================================================
// REGRESSION L5: tilde fences + MDX import/export protection
// =================================================================
describe('REGRESSION L5: protect ~~~ fences and import/export lines', () => {
  it('protects tilde-fenced (~~~) code blocks', () => {
    const body = 'Intro paragraph.\n\n~~~js\nconst translate = (x) => x;\n~~~\n\nOutro.';
    const { protectedBody, blocks } = protectBlocks(body);
    // The fenced contents must not be exposed to the translator.
    assert.ok(!protectedBody.includes('const translate'));
    assert.ok(protectedBody.includes(PLACEHOLDER_PREFIX));
    // And restore must bring it back verbatim.
    const restored = restoreBlocks(protectedBody, blocks);
    assert.ok(restored.includes('~~~js\nconst translate = (x) => x;\n~~~'));
  });

  it('protects MDX import lines', () => {
    const body = "import Tabs from '@theme/Tabs';\n\nReal prose to translate.";
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes("import Tabs"));
    assert.ok(protectedBody.includes('Real prose to translate.'));
    const restored = restoreBlocks(protectedBody, blocks);
    assert.ok(restored.includes("import Tabs from '@theme/Tabs';"));
  });

  it('protects MDX export lines', () => {
    const body = 'export const meta = { title: "x" };\n\nBody text.';
    const { protectedBody, blocks } = protectBlocks(body);
    assert.ok(!protectedBody.includes('export const meta'));
    const restored = restoreBlocks(protectedBody, blocks);
    assert.ok(restored.includes('export const meta = { title: "x" };'));
  });

  it('does NOT protect the words import/export mid-sentence', () => {
    const body = 'You can import data and export reports from the dashboard.';
    const { protectedBody } = protectBlocks(body);
    // No placeholder — the prose sentence stays fully translatable.
    assert.ok(!protectedBody.includes(PLACEHOLDER_PREFIX));
    assert.equal(protectedBody, body);
  });
});

// =================================================================
// REGRESSION L8: Hugo content discovery includes .mdx
// =================================================================
describe('REGRESSION L8: discoverContentFiles includes .mdx', () => {
  it('discovers both .md and .mdx source files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-mdx-'));
    try {
      fs.writeFileSync(path.join(dir, 'a.md'), '# A');
      fs.writeFileSync(path.join(dir, 'b.mdx'), '# B');
      fs.writeFileSync(path.join(dir, 'c.fr.mdx'), '# C'); // translated — excluded
      const files = discoverContentFiles(dir, 'en');
      assert.ok(files.some(f => f.endsWith('a.md')));
      assert.ok(files.some(f => f.endsWith('b.mdx')), '.mdx source must be discovered');
      assert.ok(!files.some(f => f.endsWith('c.fr.mdx')), 'translated .mdx must be excluded');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
