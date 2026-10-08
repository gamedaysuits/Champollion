/**
 * Long job output keeps its head and its tail; the MIDDLE is trimmed, with
 * an explicit marker. get_run_status used to keep the last 8,000 characters
 * cut at a character position, so a long run's answer began mid-sentence and
 * lost the lines that say what happened (Round 7 synthetic user).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { trimMiddle, readLogEdges, OUTPUT_HEAD_CHARS, OUTPUT_TAIL_CHARS } from '../src/tools/output-trim.js';

/** A long run's log: a head that says what happened, 3,000 progress lines, a tail. */
function longLog(progress = 3000) {
  return [
    'Run complete: run_20261004_x — 50 entries scored against eval-eng-crk-x',
    'Model: qwen2.5:7b (provider local)',
    ...Array.from({ length: progress }, (_, i) => `  batch ${i + 1}/${progress} translated (12 entries, 3.1s)`),
    'Overall: chrF++ 41.2 [38.0 – 44.5], BLEU 12.3',
    'Report written: results/run_20261004_x_report.json',
  ].join('\n');
}

describe('trimMiddle', () => {
  it('returns short output unchanged', () => {
    assert.equal(trimMiddle('a\nb\nc'), 'a\nb\nc');
    assert.equal(trimMiddle(''), '');
  });

  it('keeps the head and the tail as whole lines, and says how many lines it trimmed', () => {
    const out = trimMiddle(longLog());
    const lines = out.split('\n');
    assert.equal(lines[0], 'Run complete: run_20261004_x — 50 entries scored against eval-eng-crk-x',
      'the first line is whole — never cut mid-sentence');
    assert.equal(lines[1], 'Model: qwen2.5:7b (provider local)');
    assert.equal(lines.at(-1), 'Report written: results/run_20261004_x_report.json');
    assert.ok(lines.includes('Overall: chrF++ 41.2 [38.0 – 44.5], BLEU 12.3'));
    const marker = lines.find((l) => /^… \[\d+ lines trimmed\] …$/.test(l));
    assert.ok(marker, 'an explicit marker where the middle was');
    // every line is either kept or counted in the marker
    const kept = lines.filter((l) => l !== marker).length;
    assert.equal(kept + Number(/\d+/.exec(marker)[0]), 3004);
    assert.ok(out.length <= OUTPUT_HEAD_CHARS + OUTPUT_TAIL_CHARS + 100, `${out.length} chars`);
    for (const l of lines) assert.ok(l === marker || longLog().split('\n').includes(l), `a cut line: ${l}`);
  });

  it('shows a \\r-rewritten progress line as a terminal does', () => {
    assert.equal(trimMiddle('start\n 10%\r 50%\r100%\ndone\r\n'), 'start\n100%\ndone');
  });

  it('a single line longer than the head budget is cut, and says so', () => {
    const out = trimMiddle(`${'x'.repeat(20_000)}\nlast line`);
    assert.match(out.split('\n')[0], /^x{2000} … \[line cut at 2000 characters\]$/);
    assert.equal(out.split('\n').at(-1), 'last line');
  });

  it('counts lines another marker stood for (a huge log read from disk)', () => {
    const filler = (k) => Array.from({ length: 1000 }, (_, i) => `line ${k}${i} ${'.'.repeat(20)}`);
    const text = ['head', ...filler('a'), '… [5000 lines not read] …', ...filler('b'), 'tail'].join('\n');
    const out = trimMiddle(text);
    assert.doesNotMatch(out, /not read/, 'the inner marker fell in the trimmed middle');
    const n = Number(/… \[(\d+) lines trimmed\] …/.exec(out)[1]);
    const kept = out.split('\n').length - 1;
    assert.equal(kept + n, 2002 + 5000, 'the not-read lines are counted, not the marker itself');
  });
});

describe('trimMiddle keeps warnings and notes from the trimmed middle (Round 8)', () => {
  /** A run log whose COMET notice sits in the middle, where the trim cuts. */
  function logWithNotice() {
    return [
      'Run complete: run_20261004_y — 40 entries',
      ...Array.from({ length: 1500 }, (_, i) => `  batch ${i + 1}/3000 translated (12 entries, 3.1s)`),
      '  ⚠ COMET: not computed — unbabel-comet is not installed — mt-eval setup --comet (~300 MB install + ~2.3 GB model on first use).',
      '  ⚠ Plains Cree (crk): the run proceeds WITHOUT FST scoring — FST acceptance and morphology are marked not computed on its card.',
      '    Not installed here: FST morphological analyzer (Plains Cree).',
      '    Nothing downloads unless you run: mt-eval setup --lang crk',
      '  batch 1501/3000 translated (12 entries, 3.1s)',
      ...Array.from({ length: 1499 }, (_, i) => `  batch ${i + 1502}/3000 translated (12 entries, 3.1s)`),
      'Report written: results/run_20261004_y_report.json',
    ].join('\n');
  }

  it('the notice, and the indented lines that continue it, survive in place', () => {
    const out = trimMiddle(logWithNotice());
    const lines = out.split('\n');
    const comet = lines.findIndex((l) => l.includes('⚠ COMET: not computed'));
    assert.ok(comet > 0, 'the COMET notice is kept');
    assert.match(lines[comet - 1], /^… \[\d+ lines trimmed\] …$/, 'a marker before it');
    assert.ok(lines.includes('    Not installed here: FST morphological analyzer (Plains Cree).'));
    assert.ok(lines.includes('    Nothing downloads unless you run: mt-eval setup --lang crk'));
    assert.ok(!lines.includes('  batch 1501/3000 translated (12 entries, 3.1s)'),
      'the progress line after the notice is still trimmed');
  });

  it('every line is kept or counted, across all the markers', () => {
    const out = trimMiddle(logWithNotice());
    const lines = out.split('\n');
    const markers = lines.filter((l) => /^… \[\d+ lines? trimmed/.test(l));
    assert.ok(markers.length >= 2, 'one gap before the notices, one after');
    const counted = markers.reduce((n, m) => n + Number(/\d+/.exec(m)[0]), 0);
    assert.equal(lines.length - markers.length + counted, logWithNotice().split('\n').length);
  });

  it('[WARN], ✗ and Note: lines count as notices; a flood is capped and says so', () => {
    const flood = [
      'head',
      ...Array.from({ length: 800 }, (_, i) => `  progress ${i} ${'.'.repeat(30)}`),
      '[WARN] cache miss storm',
      '  ✗ entry 17: provider error',
      'Note: 3 entries were retried',
      ...Array.from({ length: 100 }, (_, i) => `  ⚠ entry ${i}: empty output ${'.'.repeat(60)}`),
      ...Array.from({ length: 800 }, (_, i) => `  progress b${i} ${'.'.repeat(30)}`),
      'tail',
    ].join('\n');
    const out = trimMiddle(flood);
    assert.match(out, /\[WARN\] cache miss storm/);
    assert.match(out, /✗ entry 17: provider error/);
    assert.match(out, /Note: 3 entries were retried/);
    assert.match(out, /more warning\/notice lines among them, past the 2000-character budget\] …/);
    assert.ok(out.length <= OUTPUT_HEAD_CHARS + OUTPUT_TAIL_CHARS + 2_000 + 400, `${out.length} chars`);
  });
});

describe('readLogEdges', () => {
  let dir;
  before(() => { dir = mkdtempSync(join(tmpdir(), 'mcp-trim-')); });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a normal log whole', () => {
    const p = join(dir, 'small.log');
    writeFileSync(p, longLog(10));
    assert.equal(readLogEdges(p), longLog(10));
    assert.equal(readLogEdges(join(dir, 'absent.log')), '');
  });

  it('reads a huge log as its first and last lines plus the exact count between them', () => {
    const p = join(dir, 'huge.log');
    const total = 120_000; // ~6 MB, past the whole-file bound
    const lines = Array.from({ length: total }, (_, i) => `line ${String(i).padStart(6, '0')} ${'·'.repeat(20)}`);
    writeFileSync(p, `${lines.join('\n')}\n`);
    const text = readLogEdges(p);
    const got = text.split('\n');
    assert.equal(got[0], lines[0], 'starts at the first line, whole');
    const at = got.findIndex((l) => /^… \[\d+ lines not read\] …$/.test(l));
    assert.ok(at > 0, 'a marker between head and tail');
    const notRead = Number(/\d+/.exec(got[at])[0]);
    const head = got.slice(0, at);
    const tail = got.slice(at + 1).filter((l) => l !== '');
    assert.deepEqual(head, lines.slice(0, head.length));
    assert.deepEqual(tail, lines.slice(total - tail.length));
    assert.equal(head.length + notRead + tail.length, total, 'every line is shown or counted');
    // and through trimMiddle the count survives
    const shown = trimMiddle(text);
    const n = Number(/… \[(\d+) lines trimmed\] …/.exec(shown)[1]);
    assert.equal(shown.split('\n').length - 1 + n, total);
  });
});
