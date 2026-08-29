/**
 * website-languages-data.test.js — the website plugin's card mapping against
 * the LIVE corpus.
 *
 * The regression class this closes: generateLanguagesJson.js once read cards
 * raw, and every one of 8,686 pages would have rendered "[object Object]"
 * while Docusaurus's own gate — which only counts files — stayed green. The
 * full site build takes minutes and 6 GB; the card mapping runs in
 * milliseconds, and the mapping is where that regression lived. So this test
 * runs the plugin's real adaptCard over a live-corpus sample and asserts
 * page-visible shape, and the full `npm run build` stays a release-checklist
 * command rather than a gate.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { adaptCard, stripUnsourcedForDisplay } = require(
  '../website/plugins/shared-data/generateLanguagesJson.js',
);

const LIVE = path.join(__dirname, '../shared/language-cards');

// A deterministic sample: the flagship low-resource languages + majors +
// every 100th card. Small enough for `npm test`, broad enough that a shape
// regression in any card family trips it.
function sampleFiles() {
  const all = fs.readdirSync(LIVE)
    .filter((f) => f.endsWith('.json') && f !== 'language-tree.json');
  const named = ['crk.json', 'eng.json', 'fra.json', 'quz.json', 'ara.json',
    'cmn.json', 'zul.json', 'tlh.json'];
  const every100 = all.filter((_, i) => i % 100 === 0);
  return [...new Set([...named.filter((f) => all.includes(f)), ...every100])];
}

describe('website plugin card mapping (live corpus sample)', () => {
  it('never lets an envelope or object name reach a page', async () => {
    const files = sampleFiles();
    assert.ok(files.length > 80, `sample too small: ${files.length}`);
    for (const f of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf-8'));
      const out = await adaptCard(raw);
      if (out.name !== undefined) {
        assert.equal(typeof out.name, 'string',
          `${f}: name would render as [object Object]`);
      }
      assert.equal(JSON.stringify(out).includes('[object Object]'), false,
        `${f}: serialized card contains "[object Object]"`);
      for (const [k, v] of Object.entries(out)) {
        const isEnvelope = Boolean(v && typeof v === 'object'
          && typeof v.agreement === 'string' && Array.isArray(v.values));
        assert.equal(isEnvelope, false, `${f}: '${k}' is a raw envelope`);
      }
      if (out.isoScope !== undefined) {
        assert.match(String(out.isoScope), /^[A-Z]$/,
          `${f}: isoScope '${out.isoScope}' is not the registry letter`);
      }
    }
  });

  it('keeps the flagship cards page-worthy', async () => {
    for (const code of ['crk', 'eng', 'fra']) {
      const raw = JSON.parse(
        fs.readFileSync(path.join(LIVE, `${code}.json`), 'utf-8'),
      );
      const out = await adaptCard(raw);
      assert.equal(typeof out.name, 'string');
      assert.ok(out.name.length > 0, `${code}: empty display name`);
      assert.ok(typeof out.nativeName === 'string' && out.nativeName.length > 0,
        `${code}: endonym did not bridge to nativeName`);
    }
  });

  it('flattens envelopes at ANY depth (classification.family reached pages raw once)', async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(LIVE, 'eng.json'), 'utf-8'));
    const out = await adaptCard(raw);
    const scan = (node, p) => {
      if (!node || typeof node !== 'object') return;
      assert.equal(
        typeof node.agreement === 'string' && Array.isArray(node.values), false,
        `envelope survived at ${p}`,
      );
      for (const [k, v] of Object.entries(node)) {
        if (!k.startsWith('_')) scan(v, `${p}.${k}`);
      }
    };
    scan(out, 'eng');
    assert.equal(typeof out.classification?.family, 'string',
      'family must be a readable string, not an envelope');
  });

  it('display filter keeps dotted-provenance and derived-stamp facts (the four vanished families)', async () => {
    // The provenance filter once looked up only flat _fieldSources keys and
    // rejected the champollion-derived-v1 stamp R6 blesses — classification,
    // coordinates, phonology and typology silently vanished from all 8,685
    // page payloads for a full release. These pins make that class loud.
    const eng = stripUnsourcedForDisplay(await adaptCard(JSON.parse(
      fs.readFileSync(path.join(LIVE, 'eng.json'), 'utf-8'),
    )));
    for (const f of ['classification', 'coordinates', 'phonologicalInventory',
      'typologicalProfile']) {
      assert.ok(eng[f] !== undefined,
        `eng.${f} stripped from the display payload — dotted-provenance or `
        + 'derived-stamp classification regressed');
    }
  });
});
