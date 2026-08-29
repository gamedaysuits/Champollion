/**
 * segment.js tests — markdown block segmentation for translation.
 *
 * The load-bearing guarantee is whitespace-exact reassembly:
 *   joinBlocks(splitBlocks(x)) === x  for EVERY input.
 * The property test below asserts it over every real page under
 * cli/website/docs/ (both raw and placeholder-protected bodies) plus a
 * battery of adversarial shapes. Also covers passthrough classification
 * and the block-batch prompt/response round trip.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  splitBlocks,
  joinBlocks,
  hasTranslatableText,
  buildBlockBatchPrompt,
  parseBlockBatchResponse,
  translateBlockBatchResilient,
} from '../lib/segment.js';
import {
  parseContentFile, protectBlocks,
  discoverDocusaurusContentFiles,
} from '../lib/content.js';

const WEBSITE_DOCS_DIR = path.join(import.meta.dirname, '..', 'website', 'docs');

// -----------------------------------------------------------------
// Round-trip property: joinBlocks(splitBlocks(x)) === x
// -----------------------------------------------------------------
describe('splitBlocks round-trip property', () => {
  it('holds for every real page under cli/website/docs/ (raw AND protected)', () => {
    assert.ok(
      fs.existsSync(WEBSITE_DOCS_DIR),
      `real docs tree not found at ${WEBSITE_DOCS_DIR} — the property test corpus is gone`
    );
    const files = discoverDocusaurusContentFiles(WEBSITE_DOCS_DIR);
    assert.ok(files.length >= 50, `expected the real docs tree (~96 files), found ${files.length}`);

    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf-8');
      const { body } = parseContentFile(raw);

      // Raw body round trip (contract holds for any string)
      assert.equal(
        joinBlocks(splitBlocks(body)), body,
        `raw round-trip failed for ${path.relative(WEBSITE_DOCS_DIR, file)}`
      );

      // Protected body round trip — the form the sync path actually segments
      const { protectedBody } = protectBlocks(body);
      assert.equal(
        joinBlocks(splitBlocks(protectedBody)), protectedBody,
        `protected round-trip failed for ${path.relative(WEBSITE_DOCS_DIR, file)}`
      );
    }
  });

  it('holds for adversarial inputs', () => {
    const cases = [
      '',
      '\n',
      '\n\n\n',
      'single paragraph, no trailing newline',
      '\n\nleading blank lines\n\nand trailing\n\n\n',
      'crlf line one\r\n\r\ncrlf line two\r\n',
      'mixed\n\r\n \r\n\t\nseparators\n',
      '- list item\n  - nested item\n    - deeper\n\n1. ordered\n   continued line',
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\ntext after table',
      "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\n<Tabs>\n<TabItem value=\"x\">\ncontent\n</TabItem>\n</Tabs>",
      ':::note\nAn admonition body.\n:::\n\n:::tip Custom Title\nTip body\n:::',
      'para one\n\n\n\n\npara two after many blanks',
      '---\n\nthematic break above',
      '   \n \nwhitespace-only lines\n \n   ',
      'ends with spaces  \n\nhard break block  ',
      '⟦PROTECTED_0⟧\n\ntext with ⟦PROTECTED_1⟧ inline\n\n⟦PROTECTED_2⟧⟦PROTECTED_3⟧',
    ];
    for (const input of cases) {
      assert.equal(joinBlocks(splitBlocks(input)), input, `round-trip failed for ${JSON.stringify(input.slice(0, 40))}`);
      const { protectedBody } = protectBlocks(input);
      assert.equal(joinBlocks(splitBlocks(protectedBody)), protectedBody, `protected round-trip failed for ${JSON.stringify(input.slice(0, 40))}`);
    }
  });

  it('never splits inside a protected placeholder', () => {
    const body = 'before\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nafter';
    const { protectedBody } = protectBlocks(body);
    const segments = splitBlocks(protectedBody);
    // The fenced block (blank line inside!) is one placeholder token —
    // every placeholder must appear whole inside exactly one segment.
    for (const seg of segments) {
      const opens = (seg.text.match(/⟦/g) || []).length;
      const closes = (seg.text.match(/⟧/g) || []).length;
      assert.equal(opens, closes, 'unbalanced placeholder brackets within a segment');
    }
    assert.ok(segments.some(s => s.text.includes('⟦PROTECTED_0⟧')), 'placeholder token present');
  });
});

// -----------------------------------------------------------------
// Passthrough classification — never billed, copied verbatim
// -----------------------------------------------------------------
describe('splitBlocks passthrough classification', () => {
  function typesOf(input) {
    return splitBlocks(input).map(s => s.type);
  }

  it('classifies pure placeholder blocks as passthrough', () => {
    const segs = splitBlocks('⟦PROTECTED_0⟧\n\nReal prose here.\n\n⟦PROTECTED_1⟧');
    assert.deepEqual(segs.map(s => s.type),
      ['passthrough', 'separator', 'translatable', 'separator', 'passthrough']);
  });

  it('classifies MDX import statements as passthrough (unprotected defense)', () => {
    const segs = splitBlocks("import Thing from '@site/src/Thing';\nimport Other from 'pkg';\n\nProse.");
    assert.equal(segs[0].type, 'passthrough');
    assert.equal(segs[2].type, 'translatable');
  });

  it('classifies thematic breaks and table rules as passthrough', () => {
    assert.deepEqual(typesOf('---'), ['passthrough']);
    assert.deepEqual(typesOf('***\n\n___'), ['passthrough', 'separator', 'passthrough']);
    assert.deepEqual(typesOf('| --- | :-: |'), ['passthrough']);
  });

  it('keeps prose-bearing blocks translatable (admonition openers, headings)', () => {
    assert.deepEqual(typesOf('# A Heading'), ['translatable']);
    assert.deepEqual(typesOf(':::tip Custom Title\nBody.\n:::'), ['translatable']);
    // a mid-sentence "important" must not be eaten by the import-line regex
    assert.deepEqual(typesOf('This is important content.'), ['translatable']);
  });

  it('classifies whitespace-only content blocks as passthrough', () => {
    // A body that is a lone whitespace run with no separator structure
    assert.deepEqual(typesOf('   \t  '), ['passthrough']);
  });
});

// -----------------------------------------------------------------
// Block-batch prompt + response parsing
// -----------------------------------------------------------------
describe('buildBlockBatchPrompt', () => {
  const lang = { name: 'French', register: 'Professional.' };

  it('numbers every block with ⟦SEG_N⟧ markers in order', () => {
    const prompt = buildBlockBatchPrompt(['First block.', 'Second block.'], lang, {});
    const first = prompt.indexOf('⟦SEG_0⟧\nFirst block.');
    const second = prompt.indexOf('⟦SEG_1⟧\nSecond block.');
    assert.ok(first > -1 && second > first, 'markers present and ordered');
  });

  it('mentions the placeholder rule only when a block contains placeholders', () => {
    const without = buildBlockBatchPrompt(['Plain text.'], lang, {});
    assert.ok(!without.includes('⟦PROTECTED_N⟧'), 'no placeholder rule for placeholder-free blocks');
    const withP = buildBlockBatchPrompt(['Has ⟦PROTECTED_0⟧ token.'], lang, {});
    assert.ok(withP.includes('⟦PROTECTED_N⟧'), 'placeholder rule stated when needed');
  });

  it('injects the page title as terminology context when given', () => {
    const prompt = buildBlockBatchPrompt(['Text.'], lang, { pageTitle: 'Quality Gates' });
    assert.ok(prompt.includes('"Quality Gates"'));
    const bare = buildBlockBatchPrompt(['Text.'], lang, {});
    assert.ok(!bare.includes('page titled'));
  });
});

describe('parseBlockBatchResponse', () => {
  it('parses a well-formed response index-aligned', () => {
    const out = parseBlockBatchResponse('⟦SEG_0⟧\nPremier bloc.\n\n⟦SEG_1⟧\nDeuxième bloc.', 2);
    assert.deepEqual(out, ['Premier bloc.', 'Deuxième bloc.']);
  });

  it('tolerates out-of-order markers and a model preamble', () => {
    const out = parseBlockBatchResponse('Voici :\n⟦SEG_1⟧\nDeux.\n\n⟦SEG_0⟧\nUn.', 2);
    assert.deepEqual(out, ['Un.', 'Deux.']);
  });

  it('preserves multi-line segment content, dropping only marker/padding newlines', () => {
    const out = parseBlockBatchResponse('⟦SEG_0⟧\n- un\n- deux\n- trois\n\n', 1);
    assert.deepEqual(out, ['- un\n- deux\n- trois']);
  });

  it('throws when a segment is missing (merged blocks)', () => {
    assert.throws(
      () => parseBlockBatchResponse('⟦SEG_0⟧\nTout fusionné.', 2),
      /missing marker.*⟦SEG_1⟧/s
    );
  });

  it('throws on duplicate markers', () => {
    assert.throws(
      () => parseBlockBatchResponse('⟦SEG_0⟧\nUn.\n⟦SEG_0⟧\nEncore.', 1),
      /repeats segment marker/
    );
  });

  it('throws on unknown segment ids (added segments)', () => {
    assert.throws(
      () => parseBlockBatchResponse('⟦SEG_0⟧\nUn.\n⟦SEG_5⟧\nFantôme.', 1),
      /unknown segment marker/
    );
  });
});

// -----------------------------------------------------------------
// hasTranslatableText unit checks
// -----------------------------------------------------------------
describe('hasTranslatableText', () => {
  it('is false for placeholders, whitespace, rules, imports', () => {
    assert.equal(hasTranslatableText('⟦PROTECTED_12⟧'), false);
    assert.equal(hasTranslatableText('   \n\t'), false);
    assert.equal(hasTranslatableText('---'), false);
    assert.equal(hasTranslatableText("import X from 'y';"), false);
    assert.equal(hasTranslatableText('export const a = 1;'), false);
  });

  it('is true for prose, digits, and non-Latin scripts', () => {
    assert.equal(hasTranslatableText('Hello.'), true);
    assert.equal(hasTranslatableText('2026 releases'), true);
    assert.equal(hasTranslatableText('ᓀᐦᐃᔭᐍᐏᐣ'), true);
  });
});

// -----------------------------------------------------------------
// Lenient parse mode + the resilient batch ladder
// (regression: 2026-07-11 — one dropped ⟦SEG_N⟧ in one locale hard-failed
// the file, the lock never advanced, and every sync re-billed all locales)
// -----------------------------------------------------------------
describe('parseBlockBatchResponse lenient mode', () => {
  it('returns partial blocks + missing indexes instead of throwing', () => {
    const { blocks, missing } = parseBlockBatchResponse(
      '⟦SEG_0⟧\nUn.\n⟦SEG_2⟧\nTrois.', 3, { lenient: true }
    );
    assert.deepEqual(missing, [1]);
    assert.equal(blocks[0], 'Un.');
    assert.equal(blocks[1], undefined);
    assert.equal(blocks[2], 'Trois.');
  });

  it('returns missing: [] when the response is complete', () => {
    const { blocks, missing } = parseBlockBatchResponse(
      '⟦SEG_0⟧\nUn.\n⟦SEG_1⟧\nDeux.', 2, { lenient: true }
    );
    assert.deepEqual(missing, []);
    assert.deepEqual(blocks, ['Un.', 'Deux.']);
  });

  it('still throws on duplicate markers (untrustworthy mapping)', () => {
    assert.throws(
      () => parseBlockBatchResponse('⟦SEG_0⟧\nA.\n⟦SEG_0⟧\nB.', 2, { lenient: true }),
      /repeats segment marker/
    );
  });

  it('still throws on unknown segment ids', () => {
    assert.throws(
      () => parseBlockBatchResponse('⟦SEG_0⟧\nA.\n⟦SEG_9⟧\nB.', 1, { lenient: true }),
      /unknown segment marker/
    );
  });
});

describe('translateBlockBatchResilient', () => {
  const buildPrompt = (texts) =>
    texts.map((t, i) => `⟦SEG_${i}⟧\n${t}`).join('\n');

  it('one clean call: no retry, nothing falls back', async () => {
    let calls = 0;
    const { blocks, fellBack } = await translateBlockBatchResilient({
      texts: ['One.', 'Two.'],
      buildPrompt,
      callModel: async () => { calls++; return '⟦SEG_0⟧\nUn.\n⟦SEG_1⟧\nDeux.'; },
      fallbackPrefix: '[EN] ',
    });
    assert.equal(calls, 1);
    assert.deepEqual(blocks, ['Un.', 'Deux.']);
    assert.deepEqual(fellBack, []);
  });

  it('retries ONLY the missing segments and merges them back in place', async () => {
    const prompts = [];
    let calls = 0;
    const { blocks, fellBack } = await translateBlockBatchResilient({
      texts: ['One.', 'Two.', 'Three.'],
      buildPrompt: (texts) => { prompts.push(texts); return buildPrompt(texts); },
      callModel: async () => {
        calls++;
        return calls === 1
          ? '⟦SEG_0⟧\nUn.\n⟦SEG_2⟧\nTrois.'   // drops SEG_1
          : '⟦SEG_0⟧\nDeux.';                  // retry batch has ONE segment
      },
      fallbackPrefix: '[EN] ',
    });
    assert.equal(calls, 2);
    assert.deepEqual(prompts[1], ['Two.']);    // only the miss was re-sent
    assert.deepEqual(blocks, ['Un.', 'Deux.', 'Trois.']);
    assert.deepEqual(fellBack, []);
  });

  it('falls back to prefixed source when the retry misses again', async () => {
    const { blocks, fellBack } = await translateBlockBatchResilient({
      texts: ['One.', 'Two.'],
      buildPrompt,
      callModel: async (prompt) =>
        prompt.includes('Two.') && !prompt.includes('One.')
          ? ''                                  // retry returns nothing usable
          : '⟦SEG_0⟧\nUn.',                     // first call drops SEG_1
      fallbackPrefix: '[EN] ',
    });
    assert.deepEqual(blocks, ['Un.', '[EN] Two.']);
    assert.deepEqual(fellBack, [1]);
  });

  it('falls back when the retry response is structurally corrupt', async () => {
    let calls = 0;
    const { blocks, fellBack } = await translateBlockBatchResilient({
      texts: ['One.', 'Two.'],
      buildPrompt,
      callModel: async () => {
        calls++;
        return calls === 1
          ? '⟦SEG_0⟧\nUn.'                       // drops SEG_1
          : '⟦SEG_0⟧\nA.\n⟦SEG_0⟧\nB.';          // retry repeats a marker
      },
      fallbackPrefix: '[EN] ',
    });
    assert.deepEqual(blocks, ['Un.', '[EN] Two.']);
    assert.deepEqual(fellBack, [1]);
  });

  it('throws when the FIRST call returns nothing at all', async () => {
    await assert.rejects(
      translateBlockBatchResilient({
        texts: ['One.'],
        buildPrompt,
        callModel: async () => null,
        fallbackPrefix: '[EN] ',
      }),
      /returned no results/
    );
  });

  it('throws on duplicate markers in the FIRST response', async () => {
    await assert.rejects(
      translateBlockBatchResilient({
        texts: ['One.', 'Two.'],
        buildPrompt,
        callModel: async () => '⟦SEG_0⟧\nA.\n⟦SEG_0⟧\nB.',
        fallbackPrefix: '[EN] ',
      }),
      /repeats segment marker/
    );
  });
});
