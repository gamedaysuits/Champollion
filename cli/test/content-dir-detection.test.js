/**
 * contentDir is any folder of Markdown — "Hugo" only on Hugo evidence.
 *
 * Persona finding 2026-10-03: a Next.js app with a folder of Markdown
 * newsletters (newsletters/2026-10.md, target crk) set contentDir and
 * `champollion sync` announced "Detected framework: Hugo". Sync printed that
 * for EVERY contentDir. detectContentSite (lib/content.js) now names Hugo
 * only on real evidence; the naming rule — each translation beside its
 * source as <name>.<locale>.md — is the same either way, and the banner says
 * it.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runSync } from '../lib/sync.js';
import {
  detectContentSite, discoverContentFiles, getTargetContentPath, isLikelyLangCode,
} from '../lib/content.js';

describe('detectContentSite', () => {
  let dir;
  const write = (rel, text = '') => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
  };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-site-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('a plain folder of Markdown in a Next.js app is a Markdown folder, not Hugo', () => {
    write('package.json', JSON.stringify({ dependencies: { next: '15.0.0', 'next-intl': '3.0.0' } }));
    write('next.config.js', 'module.exports = {};\n');
    write('newsletters/2026-10.md', '# October\n');
    assert.deepEqual(detectContentSite('./newsletters', dir), { site: 'markdown', evidence: null });
  });

  it('hugo.toml in the project root is Hugo', () => {
    write('hugo.toml', 'title = "Site"\n');
    write('content/posts/a.md', 'x');
    assert.deepEqual(detectContentSite('./content', dir), { site: 'hugo', evidence: 'hugo.toml' });
  });

  it('a config.toml is Hugo only when it carries a Hugo setting', () => {
    write('config.toml', '[tool.something]\nname = "x"\n');
    assert.equal(detectContentSite('./content', dir).site, 'markdown', 'some other tool\'s config.toml');
    write('config.toml', 'baseURL = "https://example.org/"\nlanguageCode = "en-us"\n');
    assert.deepEqual(detectContentSite('./content', dir), { site: 'hugo', evidence: 'config.toml (Hugo settings)' });
  });

  it('a config.yaml without Hugo settings is not Hugo', () => {
    write('config.yaml', 'database:\n  url: postgres://x\n');
    assert.equal(detectContentSite('./content', dir).site, 'markdown');
  });

  it("Hugo's config directory, archetypes/ and layouts/ templates are Hugo evidence", () => {
    write('config/_default/hugo.yaml', 'title: x\n');
    assert.equal(detectContentSite('./content', dir).evidence, path.join('config', '_default', 'hugo.yaml'));
    fs.rmSync(path.join(dir, 'config'), { recursive: true });

    write('archetypes/default.md', '---\n---\n');
    assert.equal(detectContentSite('./content', dir).evidence, 'archetypes/');
    fs.rmSync(path.join(dir, 'archetypes'), { recursive: true });

    write('layouts/default.vue', '<template />'); // a Nuxt layouts/ folder is not Hugo
    assert.equal(detectContentSite('./content', dir).site, 'markdown');
    write('layouts/_default/baseof.html', '{{ block "main" . }}{{ end }}');
    assert.equal(detectContentSite('./content', dir).evidence, 'layouts/');
  });

  it('finds a Hugo site that lives in the folder holding the content directory', () => {
    write('site/hugo.toml', 'title = "x"\n');
    write('site/content/a.md', 'x');
    assert.deepEqual(detectContentSite('./site/content', dir), { site: 'hugo', evidence: path.join('site', 'hugo.toml') });
  });
});

describe('the naming rule for a plain Markdown folder', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-naming-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('writes each translation beside its source as <name>.<locale>.md', () => {
    const src = path.join(dir, 'newsletters', '2026-10.md');
    assert.equal(getTargetContentPath(src, 'crk', 'en'), path.join(dir, 'newsletters', '2026-10.crk.md'));
    const mdx = path.join(dir, 'newsletters', 'launch.mdx');
    assert.equal(getTargetContentPath(mdx, 'crk', 'en'), path.join(dir, 'newsletters', 'launch.crk.mdx'));
    const suffixed = path.join(dir, 'newsletters', 'launch.en.md');
    assert.equal(getTargetContentPath(suffixed, 'crk', 'en'), path.join(dir, 'newsletters', 'launch.crk.md'));
  });

  it('a translation with a script or numeric-region code is not mistaken for a source', () => {
    assert.equal(isLikelyLangCode('zh-Hant'), true);
    assert.equal(isLikelyLangCode('sr-Latn'), true);
    assert.equal(isLikelyLangCode('es-419'), true);
    assert.equal(isLikelyLangCode('zh-Hant-TW'), true);
    assert.equal(isLikelyLangCode('Hant'), false);

    const nl = path.join(dir, 'newsletters');
    fs.mkdirSync(nl);
    for (const name of ['2026-10.md', '2026-10.crk.md', '2026-10.zh-Hant.md', '2026-10.es-419.md']) {
      fs.writeFileSync(path.join(nl, name), '# x\n');
    }
    assert.deepEqual(discoverContentFiles(nl, 'en').map(p => path.basename(p)), ['2026-10.md']);
  });
});

describe('sync banner for a contentDir', () => {
  let dir;
  const write = (rel, text) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
  };

  async function dryRunOutput() {
    const lines = [];
    const log = console.log;
    const err = console.error;
    console.log = (...a) => lines.push(a.join(' '));
    console.error = (...a) => lines.push(a.join(' '));
    try {
      await runSync({ cwd: dir, dryRun: true, cliArgs: { dry: true } });
    } finally {
      console.log = log;
      console.error = err;
    }
    return lines.join('\n');
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-banner-'));
    write('messages/en.json', JSON.stringify({ hello: 'Hello' }));
    write('newsletters/2026-10.md', '---\ntitle: October\n---\n\nNews.\n');
    write('champollion.config.json', JSON.stringify({
      inputLocale: 'en', localesDir: './messages', contentDir: './newsletters', languages: ['fr'],
    }));
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('a Next.js app with a newsletters/ folder: no "Hugo", and the naming rule is stated', async () => {
    write('package.json', JSON.stringify({ dependencies: { next: '15.0.0' } }));
    const out = await dryRunOutput();
    assert.doesNotMatch(out, /Detected framework: Hugo/);
    assert.match(out, /Content directory: newsletters — a folder of Markdown\/MDX files \(no Hugo site found\); each translation is written beside its source as <name>\.<locale>\.md/);
    assert.match(out, /Would create: 2026-10\.fr\.md/);
  });

  it('a Hugo site is still named, with the evidence', async () => {
    write('hugo.toml', 'baseURL = "https://example.org/"\n');
    const out = await dryRunOutput();
    assert.match(out, /Detected framework: Hugo \(hugo\.toml\)/);
    assert.match(out, /Content directory: newsletters — each translation is written beside its source as <name>\.<locale>\.md/);
  });
});
