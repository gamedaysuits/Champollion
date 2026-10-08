/**
 * Plains Cree SRO → syllabics: exact spellings, and the spans a converter may
 * not touch.
 *
 * Until 2026-09-26 the only converter tests asserted that output was
 * "non-ASCII" and "not equal to the input", while the hand-written table
 * behind them spelled the language's own name ᓀᐦᐃᔭᐤᐁᐤᐃᐣ and turned
 * "{name}" into "{ᓇᒣ}". These cases pin real spellings (checked against
 * cree-sro-syllabics, the converter ALTLab's itwêwina uses) and byte-exact
 * placeholders.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sroToSyllabics, convertScript, reverseScript, splitConvertible,
} from '../lib/scripts.js';

describe('Plains Cree spellings', () => {
  const golden = {
    'nêhiyawêwin': 'ᓀᐦᐃᔭᐍᐏᐣ', // the language's own name
    'wâpamêw': 'ᐚᐸᒣᐤ', // initial wâ is one syllable, not final-w + â
    'tânisi': 'ᑖᓂᓯ',
    'tawâw': 'ᑕᐚᐤ',
    'sêkwa': 'ᓭᑿ', // consonant + w + vowel
    'pwâtak': 'ᑇᑕᐠ',
    'atâhk': 'ᐊᑖᕽ', // word-final hk is its own final
    'namôya': 'ᓇᒨᔭ',
  };
  for (const [sro, syllabics] of Object.entries(golden)) {
    it(`${sro} → ${syllabics}`, () => {
      assert.equal(sroToSyllabics(sro), syllabics);
    });
  }

  it('round-trips back to SRO', () => {
    for (const sro of Object.keys(golden)) {
      assert.equal(reverseScript(sroToSyllabics(sro), 'crk').reversed, sro);
    }
  });

  it('reports letters outside Plains Cree SRO so the value stays in SRO', () => {
    assert.deepEqual(convertScript('example', 'crk').unmapped, ['e', 'x', 'a', 'm', 'p', 'l']);
    assert.deepEqual(convertScript('tânisi', 'crk').unmapped, []);
  });
});

describe('convertScript leaves code alone', () => {
  const crk = (s) => convertScript(s, 'crk').converted;

  it('keeps ICU placeholders byte-for-byte', () => {
    assert.equal(crk('tânisi, {name}!'), 'ᑖᓂᓯ, {name}!');
    assert.equal(crk('{d, date, short} tânisi'), '{d, date, short} ᑖᓂᓯ');
  });

  it('converts plural/select branch text but not keywords, selectors or #', () => {
    assert.equal(
      crk('{count, plural, one {# atim} other {# atimwak}}'),
      '{count, plural, one {# ᐊᑎᒼ} other {# ᐊᑎᒷᐠ}}',
    );
    assert.equal(
      crk('{n, plural, offset:1 =0 {namôya} other {# kîkway}}'),
      '{n, plural, offset:1 =0 {ᓇᒨᔭ} other {# ᑮᑿᐩ}}',
    );
    assert.equal(
      crk('{g, select, male {nâpêw} female {iskwêw} other {ayisiyiniw}}'),
      '{g, select, male {ᓈᐯᐤ} female {ᐃᐢᑵᐤ} other {ᐊᔨᓯᔨᓂᐤ}}',
    );
  });

  it('keeps tags, URLs, printf and mustache tokens', () => {
    assert.equal(crk('<b>tânisi</b>'), '<b>ᑖᓂᓯ</b>');
    assert.equal(crk('tânisi https://example.com/a'), 'ᑖᓂᓯ https://example.com/a');
    assert.equal(crk('tânisi %s'), 'ᑖᓂᓯ %s');
    assert.equal(crk('{{user}} tânisi'), '{{user}} ᑖᓂᓯ');
  });

  it('does not count placeholder letters as unmapped', () => {
    assert.deepEqual(convertScript('tânisi, {name}!', 'crk').unmapped, []);
  });

  it('protects Serbian placeholders and tags too', () => {
    assert.equal(convertScript('Zdravo {name}!', 'sr').converted, 'Здраво {name}!');
    assert.equal(convertScript('Zdravo <b>svete</b>', 'sr').converted, 'Здраво <b>свете</b>');
  });

  it('splits any string into segments that reassemble it exactly', () => {
    const tricky = [
      '', 'plain text', '{a}', '{{b}}', '${c}', '{a, plural, one {#} other {# x}}',
      'unbalanced { brace', 'stray } brace', '<a href="x">y</a>', '%1$s and %(n)d',
      '{a, select, x {nested {b} here} other {z}}', 'mail me@example.org now',
    ];
    for (const s of tricky) {
      assert.equal(splitConvertible(s).map((seg) => seg.text).join(''), s, JSON.stringify(s));
    }
  });
});
