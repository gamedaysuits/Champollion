/**
 * A translation that names a trademark its source does not name.
 *
 * The 2026-10-06 12-locale sync of champollion.dev translated "First Nations
 * in Canada have articulated community ownership, control, access, and
 * possession of their own information" into Chinese and appended a
 * parenthetical naming another organization's registered trademark, which
 * the English never names. Every check passed it, and it was published. The
 * fixture below stands a made-up mark, "Foo®", in for the real one: the real
 * name may not appear on a public surface at all (scripts/check_sovereignty_usage.py).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addedTrademarkFault, contentGateFault, validateTranslations } from '../lib/validate.js';
import { loadTM, storeTM, tmMethodKey } from '../lib/tm.js';

const zh = { target: 'zh', locale: 'zh', method: 'llm', model: 'm' };
const SRC = '- **First Nations data-sovereignty principles** — First Nations in Canada\n'
  + '  have articulated community ownership, control, access, and possession of\n'
  + '  their own information; the stewardship model here is designed to be\n'
  + '  compatible with those assertions.';
const BAD = '- **第一民族数据主权原则** — 加拿大第一民族明确阐述了对其自身信息拥有社区所有权、控制权、访问权和占有权（Foo® 原则）；此处的管理模式旨在与这些主张保持兼容。';
const GOOD = '- **第一民族数据主权原则** — 加拿大第一民族明确阐述了对其自身信息拥有社区所有权、控制权、访问权和占有权；此处的管理模式旨在与这些主张保持兼容。';

describe('a trademark the source does not name is refused', () => {
  it('the published zh line (the mark stood in for)', () => {
    assert.match(contentGateFault(SRC, BAD, zh), /adds "Foo®", a trademark the source does not name/);
    assert.equal(contentGateFault(SRC, GOOD, zh), null);
  });

  it('on the key-value lane too', () => {
    const { failures } = validateTranslations({ k: 'Fondation Foo®' }, { k: 'The Foo foundation' }, { target: 'fr', locale: 'fr' });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].addedTrademark, true);
  });

  it('™ and ℠ count (they are not read through NFKC, which turns them into letters)', () => {
    assert.match(addedTrademarkFault('a tool', 'un outil Foo™'), /"Foo™"/);
    assert.match(addedTrademarkFault('a service', 'un service Bar℠'), /"Bar℠"/);
  });

  it('a sign the source has, or spells out, is kept', () => {
    assert.equal(addedTrademarkFault('Docusaurus™ is fast', 'Docusaurus™ est rapide'), null);
    assert.equal(addedTrademarkFault('Foo (TM) is fast', 'Foo™ est rapide'), null);
    assert.equal(addedTrademarkFault('Bar(R)', 'Bar®'), null);
  });

  it('the usual abbreviation for a term the source spells out is not refused', () => {
    // Measured on champollion.dev: refusing every added name or acronym would
    // have re-asked 0.58% of all translations, nearly all of them this.
    assert.equal(contentGateFault('Translation memory means unchanged sentences are never paid for twice.',
      '翻訳メモリ（TM）により、変更のない文章に対して二重にコストが発生することはありません。', { target: 'ja', locale: 'ja' }), null);
  });
});

describe('what happens to such a translation in a sync', () => {
  it('asked again with the reason, the clean answer is accepted', async () => {
    const { translateBlocksWithFallback } = await import('../lib/fallback.js');
    const notes = [];
    let n = 0;
    const runBatch = async (texts, cfg) => {
      if (cfg.retryNotes) notes.push(...cfg.retryNotes.values());
      return { blocks: texts.map(() => (n++ === 0 ? BAD : GOOD)), fellBack: [] };
    };
    const out = await translateBlocksWithFallback({ missed: [{ seg: { text: SRC }, source: SRC }], blocks: new Map(), pairConfig: zh, runBatch, label: 'x' });
    assert.equal(n, 2, 'asked twice');
    assert.equal(out.fellBack.length, 0, JSON.stringify(out.refused));
    assert.match(notes.join(' '), /Foo®/, 'the second ask says what was wrong');
  });

  it('a model that insists is not taken at its word: the paragraph is left in English and reported', async () => {
    const { translateBlocksWithFallback } = await import('../lib/fallback.js');
    const runBatch = async (texts) => ({ blocks: texts.map(() => BAD), fellBack: [] });
    const out = await translateBlocksWithFallback({ missed: [{ seg: { text: SRC }, source: SRC }], blocks: new Map(), pairConfig: zh, runBatch, label: 'x' });
    assert.deepEqual(out.fellBack, [0]);
  });

  it('a cached translation carrying one is evicted on read, not served', async () => {
    const { lookupContentTM } = await import('../lib/fallback.js');
    const tm = loadTM('/nonexistent-champollion-dir');
    storeTM(tm, SRC, 'zh', tmMethodKey(zh), BAD);
    assert.equal(lookupContentTM(tm, SRC, 'zh', zh), null);
    assert.equal(lookupContentTM(tm, SRC, 'zh', zh, { gate: false }), null, 'and it is gone from the cache');
  });
});
