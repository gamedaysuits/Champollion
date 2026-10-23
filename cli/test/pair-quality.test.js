/**
 * pair-quality.test.js — the screen of a pair file's rows (plan A9; the forge
 * critique's stress test 1): copies, repeats, odd lengths, swapped and shifted
 * rows are counted and named by row, and a clean file is left alone. Invented
 * sentences only: an English-like side and a made-up target language.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { qualityLines, screenPairs } from '../lib/framework/pair-quality.js';
import { run as runNew } from '../lib/commands/new.js';
import { run as runData } from '../lib/commands/data.js';
import { output } from '../lib/output.js';

let seed = 11;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
// 120 invented English-like words: enough that a clean file has no repeats
const SYL = ['ri', 'ver', 'fish', 'sno', 'hou', 'dog', 'mor', 'ning', 'ber', 'can', 'fi', 'win', 'tor', 'drum',
  'moo', 'la', 'tra', 'ket', 'blan', 'son'];
const WORDS = Array.from({ length: 120 }, (_, i) => SYL[i % 20] + SYL[(Math.floor(i / 20) * 3 + 1) % 20]);

/** A made-up target language: each word respelled, with its own letters and endings. */
const respell = (w) => w.replace(/[aeiou]/g, (v) => ({ a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }[v])).replace(/r/g, 'hk') + 'ak';

function corpus(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const k = 3 + Math.floor(rand() * 7);
    const ws = Array.from({ length: k }, () => pick(WORDS));
    const num = rand() < 0.15 ? ` ${2 + Math.floor(rand() * 90)}` : '';
    const ask = rand() < 0.25;
    const en = `The ${ws.join(' and the ')}${num}${ask ? '?' : '.'}`;
    const tg = `${ws.map(respell).reverse().join(' ')}${num} ${ask ? 'cî?' : 'êkwa.'}`;
    rows.push([en, tg]);
  }
  return rows;
}

describe('the pair-quality screen', () => {
  it('leaves a clean file alone', () => {
    const q = screenPairs(corpus(600));
    assert.equal(q.copies.count, 0);
    assert.equal(q.swapped.count, 0);
    assert.equal(q.shifted.count, 0);
    assert.ok(q.length.count <= 3, `length flags on clean rows: ${q.length.count}`);
  });

  it('finds copies, repeats, cut translations, swapped and shifted rows — by row number', () => {
    const clean = corpus(600);
    const rows = clean.map((p) => [...p]);
    for (const i of [10, 50, 90]) rows[i][1] = rows[i][0];                            // copies
    for (const i of [20, 60, 100, 140, 180]) rows[i] = [rows[i][1], rows[i][0]];      // swapped
    for (let i = 300; i < 330; i++) rows[i][1] = clean[i + 1][1];                     // one row off
    rows.push([...rows[5]], [...rows[6]]);                                            // repeats
    const q = screenPairs(rows);
    assert.deepEqual(q.copies.rows, [11, 51, 91]);
    assert.equal(screenPairs(clean).duplicates.count, 0, 'a clean file without repeats');
    assert.equal(q.duplicates.count, 2);
    assert.deepEqual(q.swapped.rows, [21, 61, 101, 141, 181]);
    const [run] = q.shifted.runs;
    assert.ok(run && run[0] <= 302 && run[1] >= 330, `shifted run ${JSON.stringify(q.shifted.runs)}`);
    const lines = qualityLines(q);
    assert.ok(lines.some((l) => /3 row\(s\) whose translation is the source sentence again \(rows 11, 51, 91\)/.test(l)));
    assert.ok(lines.some((l) => /look one row off .*rows 30\d–3[34]\d/.test(l)), lines.join(' | '));
    assert.ok(lines.every((l) => !WORDS.some((w) => l.includes(w))), 'never a sentence');
  });

  it('a short file is checked only for copies and repeats', () => {
    const q = screenPairs(corpus(8));
    assert.equal(q.checked, false);
    assert.equal(q.shifted.count, 0);
  });

  it('data add says what it found, row by row, and removes nothing', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pairq-'));
    const lines = [];
    const raw = output.raw;
    const error = output.error;
    output.raw = (s) => lines.push(String(s));
    output.error = (s) => lines.push(String(s));
    try {
      await runNew({ _: ['new', 'p'], from: 'English', to: 'qaa', 'target-name': 'Our language' }, cwd);
      const root = path.join(cwd, 'p');
      const clean = corpus(200);
      const rows = clean.map((p) => [...p]);
      for (let i = 100; i < 130; i++) rows[i][1] = clean[i + 1][1];
      const file = path.join(cwd, 'grandpa.tsv');
      fs.writeFileSync(file, 'English\tOur language\n' + rows.map((r) => r.join('\t')).join('\n') + '\n');
      lines.length = 0;
      const code = await runData({ _: ['data', 'add', file], header: true }, root);
      assert.equal(code, 0, lines.join('\n'));
      const text = lines.join('\n');
      assert.match(text, /a check of the rows \(nothing was removed/);
      assert.match(text, /look one row off/);
      assert.equal(fs.readFileSync(path.join(root, 'data/parallel/grandpa.tsv'), 'utf-8').trim().split('\n').length, 200);
      const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/grandpa.tsv.champollion.json'), 'utf-8'));
      assert.ok(side['x-import'].quality.shifted >= 28, JSON.stringify(side['x-import'].quality));
    } finally {
      output.raw = raw;
      output.error = error;
    }
  });
});
