/**
 * cards-reader.test.js — the one JavaScript card reader.
 *
 * These tests exist because eleven places used to read cards their own way, and
 * a card-shape change therefore broke 211 tests at once. The reader is the
 * single seam; these are the guarantees consumers may rely on.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGREEMENT, attributions, atlasVersion, coverage, display,
  isAttributed, isDisputed, listCodes, normalizeCard, readCard, requireAtlas,
} from '../lib/cards/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
/** The projected corpus, not the live one — this reader targets the new shape. */
const NEW_CORPUS = path.join(REPO, 'build', 'atlas', 'cards-language');
const hasCorpus = fs.existsSync(NEW_CORPUS);

describe('display()', () => {
  it('returns undefined when nothing is known, never a placeholder', () => {
    // The new corpus OMITS what no source asserts. undefined is the normal
    // answer, and a reader that substituted "Unknown" would be making a
    // presentation decision on the caller's behalf.
    assert.equal(display(undefined), undefined);
    assert.equal(display(null), undefined);
    assert.equal(display([]), undefined);
  });

  it('passes a plain value straight through', () => {
    assert.equal(display('Latin'), 'Latin');
    assert.equal(display(31), 31);
    assert.equal(display(false), false, 'false is a VALUE — a feature being absent is a fact');
  });

  it('returns the consensus when sources agree', () => {
    assert.equal(display({ agreement: AGREEMENT.UNANIMOUS, consensus: 'Algic', values: [] }), 'Algic');
  });

  it('returns undefined when sources DISAGREE, rather than picking the first', () => {
    // The whole point of the attributed shape is that there was a question.
    // Silently returning the first value would hide it — and the first value is
    // whichever source happened to sort earliest, which is meaningless.
    const disputed = {
      agreement: AGREEMENT.CONFLICTING,
      values: [{ value: 'Niger-Congo', source: 'wals' }, { value: 'Atlantic-Congo', source: 'glottolog' }],
    };
    assert.equal(display(disputed), undefined);
    assert.equal(display(disputed, { onDisagreement: 'first' }), 'Niger-Congo',
      'a caller may opt into a fallback, but only explicitly');
  });

  it('refuses an agreement label it does not recognise', () => {
    // A reader that shrugs at an unknown label will present a disagreement as
    // a fact the first time the projector grows a new one.
    assert.throws(
      () => display({ agreement: 'probably-fine', values: [{ value: 'x' }] }),
      /Unknown agreement/,
    );
  });
});

describe('attributions()', () => {
  it('always returns an array, whatever the field shape', () => {
    assert.deepEqual(attributions(undefined), []);
    assert.deepEqual(attributions('Latin'), [{ value: 'Latin' }]);
    assert.deepEqual(attributions(['a', 'b']), [{ value: 'a' }, { value: 'b' }]);
  });

  it('keeps every value with its source', () => {
    const v = {
      agreement: AGREEMENT.INCOMMENSURABLE,
      values: [{ value: 'moribund', source: 'glottolog-cldf-v5.3' }, { value: 'threatened', source: 'elcat-v2024.1' }],
    };
    assert.equal(attributions(v).length, 2);
    assert.ok(attributions(v).every((x) => x.source), 'a value without its source cannot be cited');
  });
});

describe('isDisputed()', () => {
  it('is true for a real dispute and for incommensurable scales', () => {
    assert.equal(isDisputed({ agreement: AGREEMENT.CONFLICTING, values: [] }), true);
    assert.equal(isDisputed({ agreement: AGREEMENT.INCOMMENSURABLE, values: [] }), true);
  });

  it('is FALSE for different subjects and for one body saying several things', () => {
    // google=service and nllb=open are two methods, not a disagreement; ELCat
    // recording three assessments is not two authorities in conflict.
    assert.equal(isDisputed({ agreement: AGREEMENT.MULTIPLE_VARIANTS, values: [] }), false);
    assert.equal(isDisputed({ agreement: AGREEMENT.MULTIPLE_ASSESSMENTS, values: [] }), false);
    assert.equal(isDisputed({ agreement: AGREEMENT.UNANIMOUS, values: [] }), false);
  });
});

describe('requireAtlas()', () => {
  it('refuses a card built by a different atlas version', () => {
    assert.throws(
      () => requireAtlas({ code: 'crk', _atlas: { version: 'v0.1.0' } }, 'v9.9.9'),
      /was built by atlas v0\.1\.0/,
    );
  });

  it('accepts a match', () => {
    const card = { code: 'crk', _atlas: { version: 'v1' } };
    assert.equal(requireAtlas(card, 'v1'), card);
  });
});

describe('against the real projected corpus', { skip: hasCorpus ? false : 'no build/atlas corpus' }, () => {
  const opts = { dir: NEW_CORPUS };

  it('reads a card and its atlas version', () => {
    const card = readCard('crk', opts);
    assert.ok(card, 'expected a card for Plains Cree');
    assert.equal(card.code, 'crk');
    assert.ok(atlasVersion(card), 'every card must name the build that made it');
  });

  it('returns null for a language with no card rather than an empty object', () => {
    // A language with no asserted value gets NO card. An empty one would assert
    // that it is documented when all we have is a registry code.
    assert.equal(readCard('zzzzz', opts), null);
  });

  it('never yields an empty string or empty array from display()', () => {
    // The corpus-wide guarantee: 41.1% of the OLD corpus's field instances were
    // empty, published as blanks. Nothing here may reintroduce one.
    for (const code of listCodes(opts).slice(0, 400)) {
      const card = readCard(code, opts);
      for (const [key, value] of Object.entries(card)) {
        if (key.startsWith('_')) continue;
        const shown = display(value);
        assert.notEqual(shown, '', `${code}.${key} displays as an empty string`);
        if (Array.isArray(shown)) {
          assert.ok(shown.length, `${code}.${key} displays as an empty array`);
        }
      }
    }
  });

  it('reports coverage so a thin card can say WHY it is thin', () => {
    const c = coverage(readCard('crk', opts));
    assert.ok(c, 'every card carries coverage');
    assert.ok(c.total > 0);
    assert.ok(c.present > 0 && c.present <= c.total,
      'components present must be a subset of components possible');
    assert.ok(c.fraction > 0 && c.fraction <= 1);
  });

  it('exposes every attributed field through one accessor', () => {
    let attributed = 0;
    for (const code of listCodes(opts).slice(0, 200)) {
      const card = readCard(code, opts);
      for (const value of Object.values(card)) {
        if (!isAttributed(value)) continue;
        attributed++;
        assert.ok(attributions(value).length, 'an attributed field with no values is not a field');
        // display() must never throw on real data — an unknown agreement label
        // in the corpus is a projector bug this catches at the seam.
        display(value);
      }
    }
    assert.ok(attributed > 100, `expected many attributed fields, saw ${attributed}`);
  });
});

describe('installed corpus (cli/shared/language-cards)', () => {
  // The corpus consumers actually ship with. Unlike build/atlas — a BUILD
  // OUTPUT that may legitimately be absent — this directory always exists in
  // a checkout, so this block never skips: a broken INSTALLED corpus must
  // fail here rather than staying green because the build output was missing.
  const LIVE = path.join(REPO, 'cli', 'shared', 'language-cards');
  const opts = { dir: LIVE };

  it('holds the full corpus, not a stub', () => {
    const codes = listCodes(opts);
    assert.ok(codes.length > 7000,
      `expected the full installed corpus (>7000 cards), saw ${codes.length}`);
  });

  it('reads French and its atlas version', () => {
    const card = readCard('fra', opts);
    assert.ok(card, 'expected an installed card for French');
    assert.equal(card.code, 'fra');
    assert.ok(atlasVersion(card), 'every installed card must name the build that made it');
  });

  it('normalises the installed envelope shape to the runtime vocabulary', () => {
    const norm = normalizeCard(readCard('fra', opts));
    // name is an IDENTITY field: whatever the envelope said, the runtime must
    // get a labelling string, never "[object Object]".
    assert.equal(typeof norm.name, 'string', 'normalizeCard must resolve the name envelope to a string');
    assert.ok(norm.name.length, 'the resolved name must not be empty');
    // The endonym envelope bridges to the legacy nativeName the runtime reads.
    assert.ok(norm.nativeName, 'the endonym envelope must bridge to nativeName');
  });
});
