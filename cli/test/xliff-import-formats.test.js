/**
 * XLIFF import for TOML and YAML locale projects.
 *
 * THE GAP THIS CLOSES: `champollion xliff import` used to throw
 * "not yet supported. Currently JSON only" for TOML/YAML projects, even
 * though sync already reads AND writes both formats. Import now merges the
 * reviewed <target> values into the flat map and writes back through the
 * exact writer sync uses (lib/format.js writeLocaleFile), so the imported
 * file keeps the project's serialization style.
 *
 * Flow per format (fixtures: test/fixtures/hugo-i18n + yaml-locales):
 *   export → hand-fill a <target> (the reviewed-translation step) → import
 *   → the locale file contains the translation and still parses in-format.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { run as runXliff } from '../lib/commands/xliff.js';
import { readLocaleFile } from '../lib/format.js';
import { output } from '../lib/output.js';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

const CASES = [
  {
    format: 'toml',
    fixtureDir: 'hugo-i18n',
    ext: '.toml',
    // The reviewed translation lands under [nav_blog] (untranslated in fr.toml)
    key: 'nav_blog',
    translation: 'Journal-TEST',
    structureMarkers: ['[nav_blog]', 'other = "Journal-TEST"'],
  },
  {
    format: 'yaml',
    fixtureDir: 'yaml-locales',
    ext: '.yaml',
    key: 'contact',
    translation: 'Contact-FR-TEST',
    structureMarkers: ['contact:', 'other: Contact-FR-TEST'],
  },
];

describe('xliff import — TOML/YAML round trip', () => {
  let tmp;
  const realLog = console.log;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-xliff-fmt-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log = realLog;
    output.setMode('default');
  });

  function setupProject({ format, fixtureDir, ext }) {
    fs.writeFileSync(path.join(tmp, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      languages: ['fr'],
      format,
    }), 'utf-8');
    fs.mkdirSync(path.join(tmp, 'locales'), { recursive: true });
    for (const locale of ['en', 'fr']) {
      fs.copyFileSync(
        path.join(FIXTURES, fixtureDir, `${locale}${ext}`),
        path.join(tmp, 'locales', `${locale}${ext}`),
      );
    }
  }

  // Fill the <target> of one trans-unit — the "professional reviewer" step.
  function fillTarget(xliff, key, translation) {
    const pattern = new RegExp(
      `(<trans-unit id="${key}"[\\s\\S]*?<target[^>]*>)([\\s\\S]*?)(</target>)`
    );
    assert.match(xliff, pattern, `exported XLIFF must contain a unit for "${key}"`);
    return xliff.replace(pattern, `$1${translation}$3`);
  }

  for (const c of CASES) {
    it(`${c.format}: export → hand-fill → import writes the translation back in-format`, async () => {
      setupProject(c);
      console.log = () => {}; // silence human output

      // 1. Export
      const exportCode = await runXliff({ _: ['xliff', 'export'], locale: 'fr' }, tmp);
      assert.equal(exportCode, 0);
      const xliffPath = path.join(tmp, '.champollion', 'xliff', 'fr.xliff');
      assert.ok(fs.existsSync(xliffPath), 'export wrote the .xliff');

      // 2. Hand-fill one reviewed target
      const filled = fillTarget(fs.readFileSync(xliffPath, 'utf-8'), c.key, c.translation);
      fs.writeFileSync(xliffPath, filled, 'utf-8');

      // 3. Import
      const importCode = await runXliff({ _: ['xliff', 'import', xliffPath] }, tmp);
      console.log = realLog;
      assert.equal(importCode, 0, `${c.format} import must succeed (was "JSON only")`);

      // 4. The locale file contains the translation AND still parses in-format.
      const targetPath = path.join(tmp, 'locales', `fr${c.ext}`);
      const flat = readLocaleFile(targetPath, c.format);
      assert.equal(flat[c.key], c.translation);

      // Existing translations survive the merge…
      assert.equal(flat.home, 'Accueil');
      // …and the on-disk serialization matches the sync writer's style.
      const raw = fs.readFileSync(targetPath, 'utf-8');
      for (const marker of c.structureMarkers) {
        assert.ok(raw.includes(marker), `expected ${JSON.stringify(marker)} in:\n${raw}`);
      }
    });
  }

  it('toml: --dry previews without writing', async () => {
    setupProject(CASES[0]);
    console.log = () => {};

    await runXliff({ _: ['xliff', 'export'], locale: 'fr' }, tmp);
    const xliffPath = path.join(tmp, '.champollion', 'xliff', 'fr.xliff');
    const filled = fillTarget(fs.readFileSync(xliffPath, 'utf-8'), 'nav_blog', 'Journal-TEST');
    fs.writeFileSync(xliffPath, filled, 'utf-8');

    const before = fs.readFileSync(path.join(tmp, 'locales', 'fr.toml'), 'utf-8');
    const code = await runXliff({ _: ['xliff', 'import', xliffPath], dry: true }, tmp);
    console.log = realLog;

    assert.equal(code, 0);
    assert.equal(fs.readFileSync(path.join(tmp, 'locales', 'fr.toml'), 'utf-8'), before,
      'dry import must not touch the locale file');
  });

  it('yaml: --json import emits a single parseable document', async () => {
    setupProject(CASES[1]);
    console.log = () => {};

    await runXliff({ _: ['xliff', 'export'], locale: 'fr' }, tmp);
    const xliffPath = path.join(tmp, '.champollion', 'xliff', 'fr.xliff');
    const filled = fillTarget(fs.readFileSync(xliffPath, 'utf-8'), 'contact', 'Contact-FR-TEST');
    fs.writeFileSync(xliffPath, filled, 'utf-8');

    const lines = [];
    console.log = (msg) => lines.push(String(msg));
    const code = await runXliff({ _: ['xliff', 'import', xliffPath], json: true }, tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const doc = JSON.parse(lines.join('\n'));
    assert.equal(doc.command, 'xliff');
    assert.equal(doc.action, 'import');
    assert.equal(doc.locale, 'fr');
    assert.ok(doc.imported >= 1);
  });
});
