/**
 * Long job output, fitted to a status message by trimming its MIDDLE.
 *
 * get_run_status used to keep only the last 8,000 characters, cut at a
 * character position: a long run's answer began mid-sentence and lost its
 * first lines — the ones that say what the run was and what happened (Round 7
 * synthetic user). The head and the tail are what an agent needs; the middle
 * of a long log is progress. So: whole lines from the start, whole lines from
 * the end, and an explicit `… [N lines trimmed] …` between them.
 */

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

import { count } from './plural.js';

export const OUTPUT_HEAD_CHARS = 2_000;
export const OUTPUT_TAIL_CHARS = 6_000;
/** Characters of warning / notice lines kept from the trimmed middle. */
export const OUTPUT_NOTICE_CHARS = 2_000;
const NOTICE_LINE_CHARS = 600;
const NOTICE_CONTINUATION_LINES = 4;

// A gap marker this module wrote (here, or when reading a huge log from disk).
const GAP_RE = /^… \[(\d+) lines? (?:trimmed|not read)[^\]]*\] …$/;

/**
 * A line that tells the reader something went missing or wrong — the
 * harness's ⚠ / ✗ / ❌ lines, `[WARN …]`, `Warning:`, `Note:`. The middle of
 * a long log is progress, except for these: the run log's "⚠ COMET: not
 * computed — …" notice sat exactly where the status trim cut (synthetic
 * researcher, Round 8), so a run's answer lost the one line saying a metric
 * was missing.
 */
export const NOTICE_RE = /^\s*(?:⚠|✗|❌|\[WARN|WARN(?:ING)?\b|Warning:|Note\b|NOTE\b)/;

const indentOf = (l) => /^\s*/.exec(l)[0].length;

/** The text a terminal shows for a line rewritten with \r (progress bars). */
function shownLine(line) {
  const t = line.replace(/\r+$/, '');
  const i = t.lastIndexOf('\r');
  return i >= 0 ? t.slice(i + 1) : t;
}

/** `… [N lines trimmed] …` (with an optional note inside the brackets) */
export function gapMarker(n, verb = 'trimmed', note = '') {
  return `… [${count(n, 'line')} ${verb}${note ? `; ${note}` : ''}] …`;
}

/**
 * The trimmed middle, as gap markers with the warning / notice lines (and
 * their indented continuation lines) kept in place, up to `budget`
 * characters. Every line is either kept or counted in a marker.
 */
function keepNotices(middle, budget) {
  const out = [];
  let gap = 0;
  let left = budget;
  let dropped = 0;
  const flush = () => { if (gap) out.push(gapMarker(gap)); gap = 0; };
  for (let i = 0; i < middle.length; i += 1) {
    const l = middle[i];
    const m = GAP_RE.exec(l);
    if (m) { gap += Number(m[1]); continue; }
    if (!NOTICE_RE.test(l)) { gap += 1; continue; }
    // the notice and the more-indented lines that continue it
    const block = [l];
    const base = indentOf(l);
    for (let j = i + 1; j < middle.length && block.length <= NOTICE_CONTINUATION_LINES; j += 1) {
      const c = middle[j];
      if (!c.trim() || indentOf(c) <= base || NOTICE_RE.test(c) || GAP_RE.test(c)) break;
      block.push(c);
    }
    const shown = block.map((b) => (b.length > NOTICE_LINE_CHARS
      ? `${b.slice(0, NOTICE_LINE_CHARS)} … [line cut at ${NOTICE_LINE_CHARS} characters]` : b));
    const size = shown.reduce((n, b) => n + b.length + 1, 0);
    if (size > left) { dropped += 1; gap += 1; continue; }
    flush();
    out.push(...shown);
    left -= size;
    i += block.length - 1;
  }
  if (gap) {
    out.push(gapMarker(gap, 'trimmed', dropped
      ? `${count(dropped, 'more warning/notice line')} among them, past the ${budget}-character budget`
      : ''));
  }
  return out;
}

/**
 * Keep the head and the tail of `text`, whole lines, and say how many lines
 * were trimmed between them — keeping, from the trimmed middle, the warning
 * and notice lines (NOTICE_RE) in place, up to `notice` characters. Text
 * within the budget comes back as is (with \r-rewritten lines shown as a
 * terminal shows them).
 *
 * @param {string} text
 * @param {{head?: number, tail?: number, notice?: number}} [budget]  characters kept from each end / of notices
 * @returns {string}
 */
export function trimMiddle(text, { head = OUTPUT_HEAD_CHARS, tail = OUTPUT_TAIL_CHARS, notice = OUTPUT_NOTICE_CHARS } = {}) {
  if (!text) return '';
  const lines = String(text).split('\n').map(shownLine);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const whole = lines.join('\n');
  if (whole.length <= head + tail) return whole;

  let h = 0;
  let used = 0;
  while (h < lines.length && used + lines[h].length + 1 <= head) { used += lines[h].length + 1; h += 1; }
  const headLines = lines.slice(0, h);
  if (h === 0) {
    // one line longer than the whole head budget: keep its start, and say so
    headLines.push(`${lines[0].slice(0, head)} … [line cut at ${head} characters]`);
    h = 1;
  }
  let t = lines.length;
  used = 0;
  while (t > h && used + lines[t - 1].length + 1 <= tail) { used += lines[t - 1].length + 1; t -= 1; }
  const tailLines = lines.slice(t);
  if (t === lines.length && t > h) {
    const last = lines[t - 1];
    tailLines.unshift(`[line cut to its last ${tail} characters] … ${last.slice(-tail)}`);
    t -= 1;
  }
  return [...headLines, ...keepNotices(lines.slice(h, t), notice), ...tailLines].join('\n');
}

const READ_WHOLE_BYTES = 4 * 1024 * 1024;
const EDGE_BYTES = 256 * 1024;
const CHUNK_BYTES = 1024 * 1024;

/**
 * A log file's text for trimMiddle: the whole file up to 4 MiB; beyond that
 * its first and last 256 KiB (cut at line ends) with the exact number of
 * lines between them, counted without holding them in memory. '' when the
 * file is absent or unreadable.
 *
 * @param {string} path
 * @returns {string}
 */
export function readLogEdges(path) {
  let fd;
  try {
    fd = openSync(path, 'r');
    const { size } = fstatSync(fd);
    const read = (pos, len) => {
      const buf = Buffer.alloc(len);
      const n = readSync(fd, buf, 0, len, pos);
      return buf.subarray(0, n);
    };
    if (size <= READ_WHOLE_BYTES) return read(0, size).toString('utf-8');
    const headBuf = read(0, EDGE_BYTES);
    const tailStart = size - EDGE_BYTES;
    const tailBuf = read(tailStart, EDGE_BYTES);
    const hi = headBuf.lastIndexOf(0x0a);          // head ends before its last newline
    const ti = tailBuf.indexOf(0x0a);              // tail starts after its first newline
    const headEnd = hi >= 0 ? hi : headBuf.length;
    const gapStart = hi >= 0 ? hi + 1 : headBuf.length;  // first byte after the head
    const gapEnd = ti >= 0 ? tailStart + ti : tailStart - 1; // the tail's first newline, inclusive
    let lines = 0;
    for (let pos = gapStart; pos <= gapEnd; pos += CHUNK_BYTES) {
      const chunk = read(pos, Math.min(CHUNK_BYTES, gapEnd - pos + 1));
      for (let i = chunk.indexOf(0x0a); i >= 0; i = chunk.indexOf(0x0a, i + 1)) lines += 1;
    }
    return [
      headBuf.subarray(0, headEnd).toString('utf-8'),
      gapMarker(lines, 'not read'),
      tailBuf.subarray(ti >= 0 ? ti + 1 : 0).toString('utf-8'),
    ].join('\n');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
