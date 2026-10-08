/**
 * The seven blocks the 12-locale sync of champollion.dev (2026-10-06) left in
 * English. Re-asking the model showed every one was a gate bug, not a model
 * failure — and the run ended on "[OK]" with them buried mid-stream.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentGateFault, validateTranslations, hasLoopEvidence } from '../lib/validate.js';

const ja = { target: 'ja', locale: 'ja' };
const vi = { target: 'vi', locale: 'vi' };
const ar = { target: 'ar', locale: 'ar' };

describe('inline code is never prose', () => {
  it('a Japanese paragraph quoting an ICU message in backticks passes', () => {
    const src = '**Plurals.** An entry with `msgid_plural` is translated as one ICU plural message (`{n, plural, one {One file} other {%(count)d files}}`), so the model writes every form at once.';
    const out = '**複数形。** `msgid_plural` を持つエントリーは、1つのICU複数形メッセージ（`{n, plural, one {One file} other {%(count)d files}}`）として翻訳されるため、モデルはすべての形式を一度に書き出します。';
    assert.equal(contentGateFault(src, out, ja), null);
  });
  it('an untranslated paragraph is still refused', () => {
    const src = 'The model writes every form at once, and the catalog keeps the header it already has (`{n, plural, one {# file} other {# files}}`).';
    assert.match(contentGateFault(src, src, ja), /echo|script/);
  });
  it('an ICU key value is still judged by its branches and the text around them', () => {
    const { failures } = validateTranslations({ k: 'You have {count, plural, one {# file} other {# files}}' },
      { k: 'You have {count, plural, one {# file} other {# files}}' }, { target: 'ru', locale: 'ru' });
    assert.equal(failures.length, 1);
    const ok = validateTranslations({ k: 'У вас {count, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}' },
      { k: 'You have {count, plural, one {# file} other {# files}}' }, { target: 'ru', locale: 'ru' });
    assert.equal(ok.failures.length, 0, JSON.stringify(ok.failures));
  });
});

describe('a phrase said twice is not a loop', () => {
  it('Vietnamese repeats what English elides', () => {
    assert.equal(contentGateFault('From most to least trustworthy:', 'Từ đáng tin cậy nhất đến ít đáng tin cậy nhất:', vi), null);
  });
  it('real loops are still refused', () => {
    assert.match(contentGateFault('### METEOR (Banerjee & Lavie, 2005)', '### METEOR (Banerjee & Lavie, 2005)\n### METEOR (Banerjee & Lavie, 2005)', ar), /repetition/);
    assert.match(contentGateFault('### chrF and chrF++ (Popović, 2015; 2017)', '### chrF and chrF++ (Popović, 2015; 2017)\n### chrF و chrF++ (Popović, 2015; 2017)', ar), /repetition/);
    assert.ok(hasLoopEvidence("Qo' Qo' Qo' Qo' Qo' Qo'", 'Hello'));
    assert.ok(!hasLoopEvidence('Từ đáng tin cậy nhất đến ít đáng tin cậy nhất:', 'From most to least trustworthy:'));
  });
});

describe('the model saying "keep it" twice is accepted, give or take a full stop', () => {
  it('a citation kept with and without its final period', async () => {
    const { translateBlocksWithFallback } = await import('../lib/fallback.js');
    const src = '> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.\n> *Language Model Tokenizers Introduce Unfairness Between Languages.*\n> [NeurIPS 2023](https://example.org/paper).';
    let n = 0;
    const runBatch = async (texts) => ({ blocks: texts.map(() => (n++ === 0 ? src : src.replace(/\.$/, ''))), fellBack: [] });
    const out = await translateBlocksWithFallback({ missed: [{ seg: { text: src }, source: src }], blocks: new Map(), pairConfig: { target: 'th', locale: 'th', method: 'llm', model: 'm' }, runBatch, label: 'x' });
    assert.equal(out.fellBack.length, 0, JSON.stringify(out.refused));
    assert.equal(n, 2, 'asked twice');
  });
});

describe('a run that leaves anything untranslated says so last, and keeps what the model said', () => {
  it('Markdown folder: the closing report, the refusal log, no [OK] over it', async () => {
    const { startFakeModel, runCli } = await import('./fixtures/fake-openai-model.mjs');
    // A model that always answers the heading with a sentence (length inflation).
    const model = await startFakeModel((k, s) => (/^## /.test(s) ? '## Le grand festin communautaire de notre école aura lieu ce soir' : `FR ${s}`));
    try {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'left-in-source-'));
      const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); };
      w('messages/en.json', JSON.stringify({ hi: 'Hello there, families' }));
      w('news/a.md', '---\ntitle: October news\n---\n\n## Feast\n\nThe science fair is on Friday, and every class will present a project.\n');
      w('champollion.config.json', JSON.stringify({ inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'news', languages: ['fr'] }));
      const r = await runCli(['sync', '--no-verify'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 2, r.out);
      assert.doesNotMatch(r.out, /\[OK\] Created/);
      assert.match(r.out, /Created 1 content file\(s\).*1 part\(s\) left in the source language \(below\)/);
      assert.match(r.out, /Not finished: 1 part\(s\) of 1 page translation\(s\) are still in the source language/);
      assert.match(r.out, /a\.md → fr: paragraph 1: length inflation/);
      const log = fs.readFileSync(path.join(d, '.champollion/refused.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
      assert.equal(log.length, 1);
      assert.equal(log[0].source, '## Feast');
      assert.match(log[0].answer, /Le grand festin/);
      assert.match(log[0].reason, /length inflation/);
    } finally {
      await model.close();
    }
  });
});

describe('the second ask is one block per request, with its reason', () => {
  it('two refused blocks → two single-block retries', async () => {
    const { translateBlocksWithFallback } = await import('../lib/fallback.js');
    const calls = [];
    const runBatch = async (texts, cfg) => {
      calls.push({ texts, notes: cfg.retryNotes ? [...cfg.retryNotes.values()] : null });
      // First pass: both headings come back as sentences (refused); alone, translated.
      return { blocks: texts.map(t => (texts.length > 1 ? `${t} — and a whole sentence nobody asked for, padded out` : `FR ${t}`)), fellBack: [] };
    };
    const missed = ['## Feast', '## Fair'].map(t => ({ seg: { text: t }, source: t }));
    const out = await translateBlocksWithFallback({ missed, blocks: new Map(), pairConfig: { target: 'fr', locale: 'fr', method: 'llm', model: 'm' }, runBatch, label: 'x' });
    assert.equal(out.fellBack.length, 0);
    assert.deepEqual(calls.slice(1).map(c => c.texts.length), [1, 1]);
    assert.ok(calls.slice(1).every(c => /length inflation/.test(c.notes[0])), 'each told why');
  });
});
