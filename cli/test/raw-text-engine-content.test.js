/**
 * Raw-text MT engines (Google, DeepL, Microsoft, …) get only Markdown.
 *
 * They read the body after "\n---\n"; the default block-batch prompt has no
 * separator, so they were sent — and billed for — the whole LLM instruction
 * prompt with every block in it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translateBlocksForRawTextEngine } from '../lib/translate.js';
import { getMethod } from '../lib/translate.js';

const PROMPT = [
  'You are a professional translator. Translate each block below into French.',
  'Keep every ⟦SEG_N⟧ marker. Do not translate code.',
  '',
  '⟦SEG_1⟧',
  '# Welcome',
  '',
  '⟦SEG_2⟧',
  'Classes start on **Monday**.',
  '',
].join('\n');

describe('raw-text engines and the content lane', () => {
  it('sends each block alone, never the instructions, and reassembles under the markers', async () => {
    const sent = [];
    const engine = {
      translatesRawText: true,
      async translateContent(prompt) {
        sent.push(prompt);
        const body = prompt.split('\n---\n')[1];
        return `FR(${body})`;
      },
    };
    const out = await translateBlocksForRawTextEngine(engine, PROMPT, { target: 'fr' }, {});
    assert.equal(sent.length, 2);
    for (const p of sent) assert.doesNotMatch(p, /professional translator|⟦SEG_/);
    assert.equal(out, '⟦SEG_1⟧\nFR(# Welcome)\n\n⟦SEG_2⟧\nFR(Classes start on **Monday**.)');
  });

  it('a block the engine fails is absent (the content gate reports it)', async () => {
    const engine = { translatesRawText: true,
      async translateContent(p) { return p.includes('Monday') ? null : 'ok'; } };
    const out = await translateBlocksForRawTextEngine(engine, PROMPT, { target: 'fr' }, {});
    assert.equal(out, '⟦SEG_1⟧\nok');
  });

  it('the seven raw-text engines declare themselves; LLM methods do not', () => {
    for (const m of ['google-translate', 'deepl', 'microsoft-translator', 'libretranslate', 'apertium', 'tilde', 'translated']) {
      assert.equal(getMethod(m, {}).translatesRawText, true, m);
    }
    for (const m of ['llm', 'local', 'openai']) assert.equal(getMethod(m, {}).translatesRawText, false, m);
  });
});
