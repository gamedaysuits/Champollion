/**
 * pair-quality.js — what a pair file's rows look like before any model learns
 * from them (docs/RAILS_PROGRAM_PLAN_2026-10-13.md A9; FORGE_MACHINE_CRITIQUE
 * finding 9: real files come with shifted rows, swapped columns, copied
 * sentences, and nothing said so). Language-agnostic — it compares each row
 * with the file's own two columns, never with a dictionary — and content-free:
 * counts and row numbers, never a sentence. Nothing is removed here; the
 * people look at the rows named and decide.
 *
 *   copies          the translation is the source sentence again
 *   duplicates      the same pair more than once
 *   length          a translation far longer or shorter than the file's usual
 *                   ratio (cut off, or two sentences in one cell)
 *   swapped         a row whose source reads like the file's translations and
 *                   whose translation reads like its sources (letter pairs)
 *   shifted         a run of rows whose translations fit the NEXT (or previous)
 *                   row better than their own: numbers, question marks and
 *                   lengths line up one row away
 */

const MIN_ROWS = 20;            // fewer rows say too little about "usual"
const SWITCH = 12;              // what changing alignment state costs (log-likelihood units)
// what the file's usual word-fit gap is worth, in the same units (6: on 21,898
// real Klingon pairs it caught 60 of 60 shifted rows in two placements, 0 false
// flags on the clean file; 4 caught 52 of 60)
const LEX_GAP = 6;
const LOG3 = Math.log(3);

const fold = (s) => String(s).normalize('NFC').toLowerCase()
  .replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim();

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Letter-pair counts of a column (lower-cased, spaces kept as boundaries). */
function profile(texts) {
  const counts = new Map();
  let total = 0;
  for (const t of texts) {
    const s = ` ${String(t).toLowerCase()} `;
    for (let i = 0; i + 1 < s.length; i++) {
      const g = s.slice(i, i + 2);
      counts.set(g, (counts.get(g) || 0) + 1);
      total++;
    }
  }
  return { counts, total };
}

/** Mean log-likelihood ratio per letter pair: > 0 reads like profile a, < 0 like b. */
function llr(text, a, b, vocab) {
  const s = ` ${String(text).toLowerCase()} `;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2);
    const pa = ((a.counts.get(g) || 0) + 1) / (a.total + vocab);
    const pb = ((b.counts.get(g) || 0) + 1) / (b.total + vocab);
    sum += Math.log(pa / pb);
    n++;
  }
  return n >= 6 ? sum / n : 0;
}

/** What a row says that survives translation: its numbers, and whether it asks. */
function anchors(text) {
  const s = String(text);
  // ? and its forms: full-width, Spanish opening, Arabic, Greek (U+037E)
  return { digits: (s.match(/\p{Nd}+/gu) || []).join(','), asks: /[?？¿؟;]/u.test(s) };
}

/** Do two sides agree on what survives translation? null when neither says anything. */
function agree(a, b) {
  let said = 0;
  let ok = 0;
  if (a.digits || b.digits) { said++; if (a.digits === b.digits) ok++; }
  if (a.asks || b.asks) { said++; if (a.asks === b.asks) ok++; }
  return said ? ok / said : null;
}

/** The words of one side, for the file's own word associations. */
const wordsOf = (t) => [...new Set(String(t).normalize('NFC').toLowerCase().match(/[\p{L}\p{M}]+/gu) || [])];

/**
 * lex(i, j): how well row i's source words find partners among row j's
 * target words, by the file's OWN co-occurrence (Dice) — rarer source words
 * weighing more, and row i left out of the counts, so a word that occurs
 * once cannot vouch for whatever sits beside it. null when row i holds no
 * word seen elsewhere in the file. No dictionary: a file of templated
 * sentences, whose lengths all look alike, still shows which translation
 * belongs to which row (stress test 1: lengths alone caught 11 of 30 shifted
 * rows on the invented test language).
 */
function lexical(pairs) {
  const S = pairs.map(([s]) => wordsOf(s));
  const T = pairs.map(([, t]) => wordsOf(t));
  const cs = new Map();
  const ct = new Map();
  const co = new Map();
  const key = (w, v) => `${w}\u0000${v}`;
  S.forEach((ws, i) => {
    for (const w of ws) cs.set(w, (cs.get(w) || 0) + 1);
    for (const v of T[i]) ct.set(v, (ct.get(v) || 0) + 1);
    for (const w of ws) for (const v of T[i]) co.set(key(w, v), (co.get(key(w, v)) || 0) + 1);
  });
  const n = pairs.length;
  const own = T.map((ts) => new Set(ts));
  return (i, j) => {
    let num = 0;
    let den = 0;
    for (const w of S[i]) {
      const a = cs.get(w) - 1;                       // rows other than i with w
      if (a <= 0) continue;
      const idf = Math.log((n - 1) / a);
      if (idf <= 0) continue;
      let best = 0;
      for (const v of T[j]) {
        const mine = own[i].has(v) ? 1 : 0;           // row i's own (w, v), left out
        const c = (co.get(key(w, v)) || 0) - mine;
        const b = ct.get(v) - mine;
        if (c > 0) best = Math.max(best, (2 * c) / (a + b));
      }
      num += idf * best;
      den += idf;
    }
    return den ? num / den : null;
  };
}

/** Consecutive row indexes → [[first, last], …]. */
function runs(idx) {
  const out = [];
  for (const i of [...idx].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) last[1] = i; else out.push([i, i]);
  }
  return out;
}

/**
 * Screen pairs [[source, target], …]. `rowNumbers[i]` is the row of the
 * original sheet pair i came from (1-based); without it, i + 1.
 * @returns {{rows:number, checked:boolean, copies:object, duplicates:object, length:object, swapped:object, shifted:object}}
 */
export function screenPairs(pairs, { rowNumbers } = {}) {
  const n = pairs.length;
  const at = (i) => (rowNumbers ? rowNumbers[i] : i + 1);
  const named = (idx) => ({ count: idx.length, rows: idx.slice(0, 12).map(at) });
  const out = { rows: n, checked: n >= MIN_ROWS };
  // copies and duplicates: every file, however short
  const copies = [];
  const seen = new Map();
  const dup = [];
  pairs.forEach(([s, t], i) => {
    const fs = fold(s);
    if (fs && fs === fold(t)) copies.push(i);
    const k = `${fs}\u0000${fold(t)}`;
    if (seen.has(k)) dup.push(i); else seen.set(k, i);
  });
  out.copies = named(copies);
  out.duplicates = named(dup);
  if (!out.checked) {
    out.length = named([]);
    out.swapped = named([]);
    out.shifted = { count: 0, runs: [] };
    return out;
  }
  // length: the log ratio of each row against the file's own usual ratio
  const ratio = pairs.map(([s, t]) => Math.log((t.length + 1) / (s.length + 1)));
  const med = median(ratio);
  const mad = median(ratio.map((r) => Math.abs(r - med))) * 1.4826;
  const far = Math.max(4 * mad, LOG3);
  const longShort = ratio.map((r, i) => [r, i]).filter(([r]) => Math.abs(r - med) > far).map(([, i]) => i);
  out.length = named(longShort);
  // swapped: each side read against the two columns' letter-pair profiles
  const ps = profile(pairs.map(([s]) => s));
  const pt = profile(pairs.map(([, t]) => t));
  const vocab = new Set([...ps.counts.keys(), ...pt.counts.keys()]).size;
  const swapped = [];
  pairs.forEach(([s, t], i) => {
    if (copies.includes(i)) return;
    if (llr(s, pt, ps, vocab) > 0.3 && llr(t, ps, pt, vocab) > 0.3) swapped.push(i);
  });
  out.swapped = named(swapped);
  // shifted: the most likely alignment path, row by row — in step, or one
  // row off either way — where each pairing is scored by how its length
  // ratio fits this file's own usual ratio, by whether numbers and question
  // marks agree, and by how well its words go together in the rest of the
  // file; changing state costs SWITCH (Viterbi). Only a run of rows can pay
  // for two switches: one odd row never does.
  const sd = Math.max(mad, 0.1);
  const A = pairs.map(([s, t]) => [anchors(s), anchors(t)]);
  // the word evidence, scaled to this file: its usual gap between a row and
  // its own translation and a row and the next one's is worth LEX_GAP; a
  // file whose words say little (a short one) adds nothing
  const lex = lexical(pairs);
  const med0 = median(pairs.map((_, i) => lex(i, i) ?? 0));
  const med1 = median(pairs.slice(0, -1).map((_, i) => lex(i, i + 1) ?? 0));
  const scale = med0 - med1 >= 0.05 ? LEX_GAP / (med0 - med1) : 0;
  const fit = (i, j) => {
    if (j < 0 || j >= n) return -Infinity;
    const z = (Math.log((pairs[j][1].length + 1) / (pairs[i][0].length + 1)) - med) / sd;
    let f = Math.max(-z * z / 2, -8);
    const a = A[i][0];
    const b = A[j][1];
    if (a.digits || b.digits) f += a.digits === b.digits ? 2 : -3;
    if (a.asks || b.asks) f += a.asks === b.asks ? 1 : -1.5;
    if (scale) f += scale * (lex(i, j) ?? med1);
    return f;
  };
  const STATES = [0, 1, -1];
  let score = STATES.map((k) => fit(0, k));
  const back = [];
  for (let i = 1; i < n; i++) {
    const from = [];
    score = STATES.map((k, si) => {
      let best = -Infinity;
      let arg = 0;
      STATES.forEach((_, pi) => {
        const v = score[pi] - (pi === si ? 0 : SWITCH);
        if (v > best) { best = v; arg = pi; }
      });
      from.push(arg);
      return best + fit(i, i + k);
    });
    back.push(from);
  }
  let st = score.indexOf(Math.max(...score));
  const off = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    off[i] = STATES[st];
    if (i > 0) st = back[i - 1][st];
  }
  // the row a shifted block starts at has lost its partner: it is part of the run
  const suspect = new Set();
  off.forEach((k, i) => {
    if (k) {
      suspect.add(i);
      if (k === -1 && i > 0) suspect.add(i - 1);
      if (k === 1 && i + 1 < n) suspect.add(i + 1);
    }
  });
  const shiftedRuns = runs(suspect).filter(([a, b]) => b - a >= 2);
  out.shifted = { count: shiftedRuns.reduce((s2, [a, b]) => s2 + b - a + 1, 0),
    runs: shiftedRuns.slice(0, 6).map(([a, b]) => [at(a), at(b)]) };
  return out;
}

/** The screen in plain words for the person (lines; [] when nothing stood out). */
export function qualityLines(q) {
  const list = (o) => o.rows.join(', ') + (o.count > o.rows.length ? `, … (${o.count} in all)` : '');
  const lines = [];
  if (q.copies.count) lines.push(`${q.copies.count} row(s) whose translation is the source sentence again (rows ${list(q.copies)}) — a name or a loanword is fine; otherwise the translation is missing`);
  if (q.duplicates.count) lines.push(`${q.duplicates.count} row(s) that repeat an earlier pair (rows ${list(q.duplicates)})`);
  if (q.length?.count) lines.push(`${q.length.count} row(s) whose translation is far longer or shorter than this file's usual (rows ${list(q.length)}) — cut off, or two sentences in one cell?`);
  if (q.swapped?.count) lines.push(`${q.swapped.count} row(s) that look swapped — the source column reads like the translations, and the other way round (rows ${list(q.swapped)})`);
  if (q.shifted?.count) {
    lines.push(`${q.shifted.count} row(s) that look one row off — their translations fit the next or previous row better (rows `
      + `${q.shifted.runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')})`);
  }
  return lines;
}
