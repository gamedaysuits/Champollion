/**
 * The improve loop's rounds, read from a project's files (journey plan,
 * Phase 2): which round is under way, how far its review sheet is marked,
 * whether its training file is prepared and trained on. Content-free: counts
 * and hashes, never a sentence. Used by `champollion improve` and by the
 * journey's checks.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readTable } from '../community-import.js';

/** forge's ledger events, content-free; [] without one. */
export function forgeEvents(root, event) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, '.forge', 'ledger.jsonl'), 'utf-8');
  } catch {
    return [];
  }
  return text.split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return {}; }
  }).filter((e) => !event || e.event === event);
}

/** Names of runs the people put to use (forge's export + choose records). A
 * round's model counts as promoted only when they chose it — after a "better"
 * verdict (forge offers it; they say yes), on the speaker's blind marks where
 * the practice set could not tell (forge improve.speaker), or by their own
 * choice. A "better" verdict alone never put a model to use: the people may
 * say not now (2026-10-13). */
export function chosenRuns(root) {
  const runOf = new Map();
  for (const e of forgeEvents(root, 'export')) {
    for (const d of [e.model_dir, e.dir]) if (d) runOf.set(path.resolve(root, d), e.run);
  }
  const out = new Set();
  for (const e of forgeEvents(root, 'choose')) {
    const run = e.model_dir && runOf.get(path.resolve(root, e.model_dir));
    if (run) out.add(run);
  }
  return out;
}

/** A round's verdict and what came of it, in words — one wording for the
 * round report and `improve status` (docs review 2026-10-13: status called a
 * too-few round "no measurable change", and a model the people chose by hand
 * after a worse verdict stayed "not used"). A model not judged better is put
 * to use only when the people chose it: on the speaker's blind marks (forge
 * improve-speaker: the newer one marked right clearly more often), or by
 * their own choice. */
export function verdictWords(root, v, chosen = chosenRuns(root)) {
  const used = Boolean(v.new && chosen.has(v.new));
  const bySpeaker = used && forgeEvents(root, 'improve-speaker').some((e) => e.newer === v.new && e.clear === 'newer');
  const how = bySpeaker ? 'put to use on the speaker\'s blind marks' : 'put to use by the people\'s own choice';
  if (v.verdict === 'better') return used ? 'measurably better: put to use' : 'measurably better: not put to use — the people have not chosen it';
  if (v.verdict === 'worse') return used ? `measurably worse — ${how}` : 'measurably worse: not used';
  if (v.verdict === 'too-few') {
    return `too few practice sentences to tell (under 50)${used ? ` — ${how}` : ': the speaker\'s blind marks decide'}`;
  }
  return `no measurable change${used ? ` — ${how}` : ': not used'}`;
}

/** How the newest model put to use between rounds `from` and `to` got there, in
 * words: measured better on the practice sentences, on the speaker's blind
 * marks, or by the people's own choice (docs review 2026-10-13: every
 * promotion read "a model measured as better"). */
function promotionWords(root, verdicts, chosen, from, to) {
  const v = [...verdicts].reverse().find((x) => x.new && chosen.has(x.new) && x.round >= from && x.round < to);
  if (v?.verdict === 'better') return 'a model measured as better on the practice sentences was put to use in between';
  const bySpeaker = v && forgeEvents(root, 'improve-speaker').some((e) => e.newer === v.new && e.clear === 'newer');
  return `a newer model was put to use in between, ${bySpeaker ? 'on the speaker\'s blind marks' : 'by the people\'s own choice'}`;
}

/** Was a round's new model put to use between rounds `from` (inclusive) and `to`? */
const promotedBetween = (verdicts, chosen, from, to) => verdicts.some((v) => v.new && chosen.has(v.new)
  && v.round >= from && v.round < to);

/** The round under way: one past the rounds forge has judged (`compare-runs`). */
export function currentRound(root) {
  return forgeEvents(root, 'improve-compare').length + 1;
}

/** The last round's verdict as forge wrote it, or null. */
export function lastVerdict(root) {
  const v = forgeEvents(root, 'improve-compare');
  return v.length ? v[v.length - 1] : null;
}

export const roundDir = (root, k) => path.join(root, 'improve', `round-${k}`);

export const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** A Wilson 95% interval for k of n. */
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** A mark, read the ways people write one: Y, N, ? (or null: not marked). */
export function readMark(cell) {
  const s = String(cell ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['y', 'yes', 'right', 'ok', '✓', '✔', '1', 'true', 'correct'].includes(s)) return 'Y';
  if (['n', 'no', 'wrong', '✗', '✘', 'x', '0', 'false', 'incorrect'].includes(s)) return 'N';
  if (['?', 'unsure', 'not sure', 'maybe', 'dunno'].includes(s)) return '?';
  return s.startsWith('y') ? 'Y' : s.startsWith('n') ? 'N' : '?';
}

/** What a practice row of the review sheet holds instead of a draft: the speaker
 * writes how the sentence is said, and it joins the dev set (never trained on). */
export const PRACTICE_MARK = '— no draft: please write how it is said —';
/** The dev set grows from practice rows until it holds this many sentences. */
export const PRACTICE_TARGET = 200;
/** While it is smaller, one sheet row in this many is a practice row. */
export const PRACTICE_EVERY = 4;
/** Below this many dev sentences no round verdict decides (forge
 * improve.compare MIN_DECIDING; stress test 6): practice rows come faster. */
export const PRACTICE_DECIDING = 50;
/** …one sheet row in this many, until the dev set reaches PRACTICE_DECIDING. */
export const PRACTICE_EVERY_SMALL = 2;

/** The rows of the dev set config.json names, as registered with forge (or null). */
export function devRows(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'));
    const reg = JSON.parse(fs.readFileSync(path.join(root, '.forge', 'eval-registry.json'), 'utf-8'));
    const e = reg.sets?.[cfg.data?.dev];
    if (!e?.path) return null;
    const file = path.isAbsolute(e.path) ? e.path : path.join(root, e.path);
    return { name: cfg.data.dev, rows: fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim()).length };
  } catch {
    return null;
  }
}

/** Which lines of a round's sentences become practice rows: one in
 * PRACTICE_EVERY, while the dev set is under PRACTICE_TARGET (indexes). */
export function practiceRows(nLines, devCount) {
  const room = Math.max(0, PRACTICE_TARGET - (devCount ?? PRACTICE_TARGET));
  // one row in two until the dev set can decide a round (50), then one in four
  const every = (devCount ?? PRACTICE_TARGET) < PRACTICE_DECIDING ? PRACTICE_EVERY_SMALL : PRACTICE_EVERY;
  const out = [];
  for (let i = every - 1; i < nLines && out.length < room; i += every) out.push(i);
  return out;
}

/** A round's marked sheet, read: rows {english, draft, mark, fix, practice}. The
 * person may save it as .csv (as written) or as .xlsx beside it. Null without one. */
export function readSheet(dir) {
  const file = ['review.xlsx', 'review.csv'].map((n) => path.join(dir, n)).find((f) => fs.existsSync(f));
  if (!file) return null;
  const table = readTable(file);
  const rows = (table.sheets?.[0]?.rows || []).filter((r) => r.some((c) => String(c ?? '').trim()));
  const head = rows.findIndex((r) => String(r[1] ?? '').startsWith('English'));
  const body = head >= 0 ? rows.slice(head + 1) : rows;
  return { file, rows: body.map((r) => {
    const draft = String(r[2] ?? '').trim();
    const practice = draft === PRACTICE_MARK;
    // a practice row had no draft to judge: only "?" (the speaker is unsure
    // how it is said) means anything there
    const mark = readMark(r[3]);
    return { num: Number(r[0]) || null, english: String(r[1] ?? '').trim(), draft: practice ? '' : draft,
      mark: practice ? (mark === '?' ? '?' : null) : mark, fix: String(r[4] ?? '').trim(), practice };
  }).filter((r) => r.english) };
}

/** How far a round's sheet is marked (counts only). */
export function sheetProgress(dir) {
  let s;
  try {
    s = readSheet(dir);
  } catch {
    s = null;
  }
  if (!s) return { exists: false, rows: 0, marked: 0 };
  // a practice row is done when the speaker has written it, or put "?"
  return { exists: true, rows: s.rows.length, marked: s.rows.filter((r) => (r.practice ? r.fix || r.mark : r.mark)).length };
}

/** The pair file training is combined into (the one file in data/parallel/), or null. */
export function singleCorpus(root) {
  const dir = path.join(root, 'data', 'parallel');
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.tsv'));
  } catch { /* none */ }
  return names.length === 1 ? `data/parallel/${names[0]}` : null;
}

/** Is round k's training file prepared from the corpus as it is now? */
export function roundPrepared(root, k) {
  let rec;
  try {
    rec = JSON.parse(fs.readFileSync(path.join(roundDir(root, k), 'prepared.json'), 'utf-8'));
  } catch {
    return false;
  }
  const corpus = singleCorpus(root);
  return !!corpus && corpus === rec.corpus && sha256File(path.join(root, corpus)) === rec.corpus_sha256;
}

/** Has forge trained a run on the training files config.json names, as they are now? */
export function trainedOnCurrent(root) {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'));
  } catch {
    return false;
  }
  const want = {};
  for (const g of cfg.data?.gold || []) {
    const f = path.isAbsolute(g) ? g : path.join(root, g);
    if (!fs.existsSync(f)) return false;
    want[g] = sha256File(f);
  }
  const runs = path.join(root, '.forge', 'runs');
  let dirs = [];
  try {
    dirs = fs.readdirSync(runs);
  } catch { /* no runs */ }
  return dirs.some((d) => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(runs, d, 'run-manifest.json'), 'utf-8'));
      const got = m.run_identity?.training_files || {};
      return Object.entries(want).every(([g, sha]) => got[g] === sha);
    } catch {
      return false;
    }
  });
}

/** What the people said about the speaker's time (improve/time.json), or null. */
export function readTime(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'improve', 'time.json'), 'utf-8'));
  } catch {
    return null;
  }
}

/** The first number in what someone said ("maybe 800 sentences" → 800), or null. */
export function firstNumber(text) {
  const m = String(text || '').match(/\d[\d,]*/);
  return m ? Number(m[0].replace(/,/g, '')) : null;
}

/** Each finished round's marks.json, in order (rounds before `upTo`). */
export function roundMarks(root, upTo = currentRound(root)) {
  const out = [];
  for (let i = 1; i < upTo; i++) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(roundDir(root, i), 'marks.json'), 'utf-8'));
      // a round whose sheet held only practice rows judged no draft
      if (m.acceptance != null) out.push(m);
    } catch { /* a round without a review: nothing to count */ }
  }
  return out;
}

/**
 * The speaker's blind check of the promotions between two rounds: on each
 * visit after a promotion, the sheet mixes drafts of the model put to use
 * with drafts of the one it replaced, unmarked — so a change in how kindly
 * the speaker marks touches both alike and cancels out. Pooled over the
 * rounds after `from` up to `to`: {rounds, in_use_share, replaced_share,
 * judged, clear: better|worse|unclear}, or null when no such visit was
 * judged (stress test 12, 2026-10-13: a promotion the practice set got
 * wrong by chance, plus marking that grew kinder, read as "Real progress").
 */
export function promotionCheck(marks, from, to) {
  const rows = marks.filter((m) => m.round > from && m.round <= to && m.blind?.relation === 'replaced'
    && m.blind.in_use_judged > 0 && m.blind.other_judged > 0);
  if (!rows.length) return null;
  const sum = (f) => rows.reduce((a, m) => a + (m.blind[f] || 0), 0);
  const [uR, uN, oR, oN] = [sum('in_use_right'), sum('in_use_judged'), sum('other_right'), sum('other_judged')];
  const p = (uR + oR) / (uN + oN);
  const se = Math.sqrt(p * (1 - p) * (1 / uN + 1 / oN));
  const z = se ? (uR / uN - oR / oN) / se : 0;
  return { rounds: rows.map((m) => m.round), in_use_share: uR / uN, replaced_share: oR / oN, judged: uN + oN,
    clear: z > 1.96 ? 'better' : z < -1.96 ? 'worse' : 'unclear' };
}

/** Repeat rows judged before the speaker's marking error is estimated from them. */
export const MIN_REPEATS = 10;

/**
 * How far the speaker's marks can be trusted, from the rows shown again
 * (founder decision 7, 2026-10-13), pooled over the rounds: {judged, agreed,
 * agreement, error, drift, wrong_to_right, right_to_wrong} — or null under
 * MIN_REPEATS judged. `error` is the share of marks that go the wrong way
 * at random, read from the flips that go both ways alike: two marks of one
 * draft disagree, by chance, 2e(1 − e) of the time, half each way. Flips one
 * way beyond that are `drift` (marking grown kinder, or stricter), not error
 * — counted as error, a kinder speaker's error is overstated (stress test 12,
 * 2026-10-13). A speaker who errs on 10% of marks can show at most 90% right.
 */
export function markingError(marks) {
  const rs = marks.map((m) => m.repeats).filter((r) => r?.judged > 0);
  const sum = (f) => rs.reduce((a, r) => a + (r[f] || 0), 0);
  const judged = sum('judged');
  if (judged < MIN_REPEATS) return null;
  const agreed = sum('agreed');
  const [w2r, r2w] = [sum('wrong_to_right'), sum('right_to_wrong')];
  const d = (2 * Math.min(w2r, r2w)) / judged;
  const error = d < 0.5 ? (1 - Math.sqrt(1 - 2 * d)) / 2 : 0.5;
  // drift per round: a draft that is truly wrong is marked right more often as
  // marking grows kinder, so the flips beyond the even ones, over how many
  // rounds apart the two marks of once-wrong drafts were, are the rise per
  // round in marking a wrong draft right (negative: stricter)
  const apart = sum('rounds_apart_wrong_before');
  const perRound = apart > 0 ? (w2r - r2w) / apart : 0;
  return { judged, agreed, agreement: agreed / judged, error, drift: (w2r - r2w) / judged, kinder_per_round: perRound,
    wrong_to_right: w2r, right_to_wrong: r2w };
}

/** Where "truly right on 80%" sits on a speaker's own marks: marks that err
 * at `e` either way pull every share toward 50% (marked = e + p(1 − 2e)), so
 * at 10% the speaker marks about 74% of truly-80%-right drafts right. */
const markedAt = (p, e) => (e > 0 && e < 0.45 ? e + p * (1 - 2 * e) : p);

/** The rise in drafts marked right per doubling of the training pairs, in
 * log-odds, from the same blind checks (each: the model put to use against the
 * one it replaced, whose training pairs both are recorded) — {per_doubling,
 * ci95, rounds, doublings}, or null. Learning curves rise by roughly equal
 * log-odds steps per doubling of the data; a straight line in sentences
 * promised working about three times too soon (stress test 12: within 2x of
 * the truth 5% of the time, against 65% now). */
export function perDoubling(marks, from, to) {
  const rows = marks.filter((m) => m.round > from && m.round <= to && m.blind?.relation === 'replaced'
    && m.blind.in_use_judged > 0 && m.blind.other_judged > 0
    && m.blind.other_pairs > 0 && m.blind.in_use_pairs > m.blind.other_pairs);
  if (!rows.length) return null;
  const gain = rows.reduce((a, m) => a + (logit(m.blind.in_use_share) - logit(m.blind.other_share)), 0);
  const doublings = rows.reduce((a, m) => a + Math.log2(m.blind.in_use_pairs / m.blind.other_pairs), 0);
  // how sure: each share's log-odds varies about 1 / (n p (1 - p)) with n drafts judged
  const v = (p, n) => {
    const q = Math.min(0.99, Math.max(0.01, p));
    return 1 / (n * q * (1 - q));
  };
  const variance = rows.reduce((a, m) => a + v(m.blind.in_use_share, m.blind.in_use_judged)
    + v(m.blind.other_share, m.blind.other_judged), 0);
  const se = Math.sqrt(variance) / doublings;
  const per = gain / doublings;
  return { per_doubling: per, ci95: [per - 1.96 * se, per + 1.96 * se], rounds: rows.length, doublings };
}

/** Log-odds, kept finite (shares are clamped to 1–99%): the scale on which a
 * share's steps per doubling stay about even as it nears 100% — measured in
 * plain points, each doubling's gain shrinks there (G1: +26 points a doubling
 * from 1,600 to 6,400 pairs, +7 from 6,400 to 12,800; in log-odds +1.1, +1.2,
 * +0.5). */
const logit = (p) => {
  const q = Math.min(0.99, Math.max(0.01, p));
  return Math.log(q / (1 - q));
};

/** A count said with two significant figures (4,870 → "4,900"): a projection is
 * a rough guess, and more digits would claim more than it knows. */
const roughly = (n) => {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1);
  return (Math.round(n / mag) * mag).toLocaleString('en-US');
};

/**
 * Where the rounds point, from the speaker's marks and forge's verdicts:
 * {text, more (training sentences to 80% of drafts marked right), hours} —
 * or null before there are two rounds of marks. A projection only from a
 * rise that is the model's: a better model put to use in between, AND the
 * speaker's blind check of it against the model it replaced (promotionCheck).
 */
export function projectionFrom(marks, verdicts, chosen = new Set()) {
  if (marks.length < 2) return null;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const first = marks[0];
  const last = marks[marks.length - 1];
  const rose = last.ci95?.[0] > first.ci95?.[1];
  const promoted = promotedBetween(verdicts, chosen, first.round, last.round);
  const none = (text) => ({ text, more: null, hours: null });
  if (!rose) return none('No projection yet: the share of drafts marked right has not risen beyond its uncertainty.');
  if (!promoted) {
    return none('No projection: the share of drafts marked right rose while the same model was in use, so the '
      + 'rise says nothing yet about where the model is heading.');
  }
  const check = promotionCheck(marks, first.round, last.round);
  if (check?.clear !== 'better') {
    return none('No projection yet: the speaker\'s blind check has not yet shown the new model beating the one it '
      + 'replaced, so the rise may be in the marking, not the model.');
  }
  if (last.acceptance >= 0.8) {
    return none('The speaker already marks 80% or more of the drafts right — working, on the sentences they need.');
  }
  const step = perDoubling(marks, first.round, last.round);
  const n = last.in_use_pairs;
  if (!step || !(step.per_doubling > 0) || !(n > 0)) {
    return none('No projection yet: the training sentences behind each model are not recorded for the checks so far, '
      + 'and the rise is measured per doubling of them.');
  }
  // the speaker's own marking (decision 7): where "truly right on 80%" may sit
  // on their marks — random error pulls it toward 50%, marking grown kinder
  // since the first round lifts it. Stress test 12 (2026-10-13): moving the
  // estimate there helped where the speaker errs near the top (800 a round:
  // "still needs more" said of a working model 80 times in 1,600, then 20)
  // and hurt where they grow kinder (400 a round: within 2x of the truth 74%,
  // then 47%) — so the estimate keeps the plain 80%, and the range takes in
  // both (800 a round: the truth inside the range 51–54% → 76–80%; 400: no change)
  const me = markingError(marks);
  const kinder = me ? Math.max(-0.3, Math.min(0.3, me.kinder_per_round * (last.round - first.round))) : 0;
  const theirs = me ? Math.min(0.97, markedAt(0.8, me.error) + 0.2 * kinder) : 0.8;
  const now = last.acceptance;
  const moreAt = (per, target = 0.8) => Math.max(0, Math.round(n * 2 ** ((logit(target) - logit(now)) / per) - n));
  const more = moreAt(step.per_doubling);
  const hours = Math.round((more * 70) / 360) / 10;    // ~1 min to write + ~10 s to mark
  // the range the checks so far allow (a smaller step needs more sentences),
  // and what the speaker's own marking may mean (either aim)
  const [lo, hi] = step.ci95;
  const aims = me ? [0.8, theirs] : [0.8];
  const fewest = hi > 0 ? Math.min(...aims.map((t) => moreAt(hi, t))) : null;
  // beyond six more doublings the checks cannot tell: unbounded, said so
  const mostAt = lo > 0 ? Math.max(...aims.map((t) => moreAt(lo, t))) : null;
  const most = mostAt != null && mostAt <= 63 * n ? mostAt : null;
  const allowing = me
    ? ` The speaker's own marking: they marked ${me.agreed} of ${me.judged} rows shown again the way they did before `
      + `(${pct(me.agreement)}), so about ${pct(me.error)} of marks go the other way at random`
      + (Math.abs(kinder) >= 0.01 ? `, and drafts once marked wrong are now marked right ${kinder > 0 ? 'more' : 'less'} `
        + `often (about ${pct(Math.abs(kinder))} of wrong drafts since round ${first.round})` : '')
      + `: drafts truly right on 80% may be marked right about ${pct(theirs)} of the time on their marks — the range `
      + 'takes that in.'
      // no "it may already be working" from this: in stress test 12 it was
      // wrong 2–3 times for each time it was right (2026-10-13)
    : ' (The speaker\'s own marking error is not yet allowed for: too few rows shown again have been judged.)';
  // the step said in plain points, at the share the model is at now
  const at = now;
  const nextShare = 1 / (1 + Math.exp(-(logit(at) + step.per_doubling)));
  const range = most != null
    ? ` (from what the checks so far can tell, somewhere between ${fewest === 0 ? 'none' : roughly(fewest)} and `
      + `${roughly(most)})`
    : ` (the checks so far allow as few as ${fewest === 0 ? 'none' : roughly(fewest)}, and cannot yet say how many `
      + 'more it could take)';
  return {
    more, hours, range: [fewest, most],
    text: 'Each doubling of the training sentences has raised the drafts marked right by a steady step, judging by '
      + 'the speaker\'s blind checks of each new model against the one it replaced: at '
      + `${pct(at)} of drafts right now, doubling to ${roughly(2 * n)} training sentences would make it about `
      + `${pct(nextShare)}. At that rate — a rough guess — 80% right (working) needs about ${roughly(n + more)} `
      + `training sentences: about ${roughly(more)} more than the ${n.toLocaleString('en-US')} now${range}, roughly `
      + `${roughly(hours)} hours of the speaker's time at about a minute a sentence.${allowing}`,
  };
}

/**
 * What the speaker's stated time looks like it can buy, from the rounds so
 * far — numbers only, or '' before there is anything to say. The projection
 * is the round report's (projectionFrom). When it needs more than the time
 * they said is left, it says that plainly — the journey plan's promise to the
 * family (Phase 2, step 0).
 */
export function timeNote(root) {
  const marks = roundMarks(root);
  const t = readTime(root);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const judged = (m) => (m.right || 0) + (m.wrong || 0);
  const checked = marks.reduce((a, m) => a + judged(m), 0);
  const total = firstNumber(t?.total);
  const parts = [];
  if (marks.length && total) {
    parts.push(`So far the speaker has checked ${checked} drafts, of the about ${total} sentences they said they can give in all.`);
  }
  const proj = marks.length >= 2 ? projectionFrom(marks, forgeEvents(root, 'improve-compare'), chosenRuns(root))
    : null;
  if (proj?.more != null) {
    parts.push(proj.text);
    if (total && proj.more > total - checked) {
      parts.push('That is more than the time they said is left: tell them plainly. More speakers, a bigger model, '
        + 'or a narrower use (a phrasebook for the sentences they need most) may be what it takes.');
    }
  } else if (marks.length >= 3) {
    const first = marks[0];
    const last = marks[marks.length - 1];
    if (!(last.ci95?.[0] > first.ci95?.[1])) {
      parts.push(`After ${marks.length} rounds the share of drafts the speaker marks right has not measurably risen `
        + `(${pct(first.acceptance)} in round ${first.round}, ${pct(last.acceptance)} in round ${last.round}) — say so `
        + 'plainly; more of the same may not be what it needs.');
    } else if (proj) {
      parts.push(proj.text);
    }
  }
  return parts.length ? parts.join(' ') + ' ' : '';
}

/**
 * The round report (founder, 2026-10-12: "real analysis of progress should be
 * done by the agent and fed back as action items … a working model that's not
 * overfitted"). Every number carries its unit and the sentences it was
 * measured on (founder, same day: "your charts need units and clear meaning").
 * Read from the records the rounds already keep — the speaker's marks on NEW
 * sentences (drafted before any model learned them: the out-of-sample measure)
 * and forge's verdicts on the practice (dev) sentences — counts and
 * percentages only, never a sentence.
 * @returns {{round, progress: string[], checks: string[], projection: string|null,
 *   projection_numbers: {more_sentences, range: [number|null, number|null], speaker_hours}|null,
 *   actions: string[]}}
 */
/** A practice set that cannot see a 3-point gain is too small to steer rounds by
 * (forge's improve.compare SMALL_ENOUGH; G1: ~+0.6 chrF++ per 50-sentence round at 1,600 pairs). */
const SMALL_ENOUGH = 3;

export function roundReport(root) {
  const k = currentRound(root);
  const marks = roundMarks(root, k + 1);          // this round's too, once read
  const verdicts = forgeEvents(root, 'improve-compare');
  const pct = (x) => `${Math.round(x * 100)}%`;
  const judged = (m) => (m.right || 0) + (m.wrong || 0);
  const progress = [];
  const checks = [];
  const actions = [];
  const first = marks[0];
  const last = marks[marks.length - 1];
  const rose = marks.length >= 2 && last.ci95?.[0] > first.ci95?.[1];

  // a rise in the speaker's marks is the model's only when a newer model was
  // put to use in between: otherwise the same model met easier sentences (or
  // gentler marking) — FORGE_MACHINE_CRITIQUE finding 2
  const chosen = chosenRuns(root);
  const promoted = marks.length >= 2 && promotedBetween(verdicts, chosen, first.round, last.round);
  // and the speaker's own blind check of the new model against the one it
  // replaced, on the same visits: a promotion the practice set got wrong by
  // chance, with marking that grew kinder, otherwise reads as progress
  // (stress test 12)
  const check = marks.length >= 2 ? promotionCheck(marks, first.round, last.round) : null;
  const how = promoted ? promotionWords(root, verdicts, chosen, first.round, last.round) : null;
  if (rose && promoted && check?.clear === 'better') {
    progress.push(`Real progress: the speaker marked ${pct(first.acceptance)} of new drafts right in round `
      + `${first.round} and ${pct(last.acceptance)} in round ${last.round} — a rise beyond the uncertainty of both, `
      + `and ${how}. Marking blind on the same visits, the speaker marked the new `
      + `model right more often than the one it replaced (${pct(check.in_use_share)} against `
      + `${pct(check.replaced_share)}, on ${check.judged} drafts).`);
  } else if (rose && promoted) {
    progress.push(`Drafts marked right went from ${pct(first.acceptance)} (round ${first.round}) to `
      + `${pct(last.acceptance)} (round ${last.round}), and ${how} `
      + '— but '
      + (check
        ? `marking blind on the same visits, the speaker did not mark it clearly better than the one it replaced `
          + `(${pct(check.in_use_share)} against ${pct(check.replaced_share)}, on ${check.judged} drafts)`
        : 'the speaker has not yet checked it blind against the one it replaced (the next sheet mixes their drafts)')
      + ', so it is not yet counted as real progress: how kindly drafts are marked may have changed too.');
  } else if (rose) {
    progress.push(`Drafts marked right went from ${pct(first.acceptance)} (round ${first.round}) to `
      + `${pct(last.acceptance)} (round ${last.round}), but the model in use did not change in between — `
      + 'the sentences (or the marking) changed, not the model. Not counted as progress.');
  } else if (marks.length >= 2 && last.acceptance > first.acceptance) {
    progress.push(`Drafts marked right went from ${pct(first.acceptance)} (round ${first.round}) to `
      + `${pct(last.acceptance)} (round ${last.round}) — up, though not yet beyond the uncertainty of `
      + `${judged(last)} marked drafts.`);
  }
  for (const m of marks) {
    progress.push(`Round ${m.round}: the speaker marked ${m.right} of ${judged(m)} drafts of new sentences right — `
      + `${pct(m.acceptance)} (95% range ${pct(m.ci95[0])}–${pct(m.ci95[1])}).`);
    if (m.blind?.text) progress.push(`Round ${m.round}: ${m.blind.text}`);
  }
  for (const v of verdicts) {
    const said = verdictWords(root, v, chosen);
    progress.push(`Round ${v.round}: on the same ${v.n} practice (dev) sentences, chrF++ (0–100, overlap with `
      + `the checked translation) ${v.score_new} for the new model against ${v.score_in_use} for the model in use — ${said}`
      + (v.detectable != null ? ` (on ${v.n} sentences only a difference of about ${v.detectable} points or more `
        + 'shows reliably).' : '.'));
  }

  // how far the marks can be trusted: the rows shown again (decision 7)
  const me = markingError(marks);
  if (me) {
    const flips = me.wrong_to_right + me.right_to_wrong;
    // kinder over time: once-wrong drafts now marked right clearly outnumber
    // the other way (a sign test, two-sided 5%)
    const kinder = flips >= 6 && (me.wrong_to_right - flips / 2) / Math.sqrt(flips / 4) > 1.96;
    checks.push(`The speaker marked ${me.agreed} of ${me.judged} rows shown again the way they did before `
      + `(${pct(me.agreement)}): about ${pct(me.error)} of marks go the other way at random, which pulls every share `
      + 'marked right toward 50% — the projection allows for it.'
      + (kinder ? ` And ${me.wrong_to_right} drafts once marked wrong are now marked right, against ${me.right_to_wrong} `
        + 'the other way: the marking may be growing kinder, which a rise in the share would not show.' : ''));
  } else if (marks.some((m) => m.repeats?.judged)) {
    checks.push(`${marks.reduce((a, m) => a + (m.repeats?.judged || 0), 0)} rows shown again judged so far — the `
      + `speaker's own marking error is estimated from ${MIN_REPEATS}.`);
  }

  // not overfitted: gains on the practice sentences must show on new ones
  if (verdicts.length && marks.length >= 2) {
    const devStart = verdicts[0].score_in_use;
    const lv = verdicts[verdicts.length - 1];
    const devNow = lv.new && chosen.has(lv.new) ? lv.score_new : lv.score_in_use;
    if (devNow - devStart >= 3 && last.acceptance <= first.acceptance + 0.02) {
      checks.push(`The practice-set chrF++ rose ${Math.round((devNow - devStart) * 10) / 10} points while the speaker's `
        + 'marks on new sentences did not: the gain may belong to the practice sentences, not to translation the family '
        + 'can use. Trust the marks; make the practice set more like the sentences they need.');
    }
  }
  const lastV = verdicts.length ? verdicts[verdicts.length - 1] : null;
  const n = lastV?.n ?? null;
  const blind = lastV?.detectable != null ? lastV.detectable > SMALL_ENOUGH : (n != null && n < 50);
  if (blind) {
    checks.push(`The practice set is ${n} sentences: on it only `
      + (lastV.detectable != null ? `a difference of about ${lastV.detectable} chrF++ points or more` : 'a large difference')
      + ' shows reliably, and a round of new sentences usually adds less — so "no measurable change" is the practice '
      + 'set\'s limit, not proof the round did nothing. The speaker\'s marks are the steadier measure meanwhile.');
  }

  // a projection, only when the rise is the model's — per doubling of the
  // training sentences, said to be a rough guess (projectionFrom; the time
  // note says the same — the two used to disagree, docs review #11)
  const total = firstNumber(readTime(root)?.total);
  const checked = marks.reduce((a, m) => a + judged(m), 0);
  const proj = projectionFrom(marks, verdicts, chosen);
  const projection = proj ? proj.text : null;
  const need80 = proj?.more ?? null;

  // the next things to do (2–4)
  const dir = roundDir(root, k);
  const has = (f) => fs.existsSync(path.join(dir, f));
  let written = 0;
  try {
    written = fs.readFileSync(path.join(dir, 'to-translate.txt'), 'utf-8').split(/\r?\n/).filter((l) => l.trim()).length;
  } catch { /* not started */ }
  if (has('review.csv') && !has('marks.json')) {
    actions.push(`The speaker marks round ${k}'s drafts (improve/round-${k}/review.csv): Y right, N wrong with how it is said.`);
  } else if (written < 20) {
    actions.push(`Write ${20 - written} or more sentences you really want translated for round ${k}, using the `
      + `wishlist (improve/round-${k}/wishlist.md): the words the model has never seen come first.`);
  }
  const lastBlind = marks.length ? marks[marks.length - 1].blind : null;
  if (lastBlind?.clear === 'newer') {
    actions.push(`The speaker marked the newer model's drafts right more often (${Math.round(lastBlind.newer_share * 100)}% `
      + `against ${Math.round(lastBlind.in_use_share * 100)}%, a clear difference): the round did help, even where the `
      + 'practice set could not show it. Keep going — growing the practice set lets the next verdict see it.');
  }
  if (lastBlind?.clear === 'replaced') {
    actions.push(`Marking blind, the speaker marked the model in use before the last promotion right more often `
      + `(${Math.round(lastBlind.other_share * 100)}% against ${Math.round(lastBlind.in_use_share * 100)}% for the new `
      + 'one, a clear difference): the practice set said better, the family\'s own sentences say worse. Ask them '
      + 'whether to put the earlier model back, and make the practice set more like the sentences they need.');
  }
  const dev = devRows(root);
  if (blind && dev && dev.rows < PRACTICE_TARGET) {
    const every = dev.rows < PRACTICE_DECIDING ? PRACTICE_EVERY_SMALL : PRACTICE_EVERY;
    actions.push(`Grow the practice set: one sentence in ${every} on each sheet has no draft — the speaker `
      + `writes how it is said, and it joins the practice set (now ${dev.rows}; ${PRACTICE_DECIDING} lets a round `
      + `be judged at all, ${PRACTICE_TARGET} lets a gain of about 3 points show). Those sentences are never trained on.`);
  }
  const flat = verdicts.slice(-2);
  // as forge counts flat rounds (advisor._model_change_advice): rounds the
  // practice set could judge (not too-few), with no model put to use between
  if (flat.length === 2 && flat.every((v) => v.verdict === 'no-change' || v.verdict === 'worse')
      && !(flat[0].new && chosen.has(flat[0].new))) {
    actions.push(blind
      ? 'Two rounds without a measurable gain — but this practice set cannot see a round\'s usual gain: keep '
        + 'going; more sentences of the kinds it gets wrong still help, and the practice sentences will let it show.'
      // it cannot tell slow gains from none: near the top of the curve a round
      // adds about half a chrF++ point, under what 200 practice sentences show
      // (stress test 11, 2026-10-13: "more of the same may not help" was said
      // in 98 of 1,200 reports while the model was really improving)
      : `Two rounds without a gain this practice set can see${lastV?.detectable != null
        ? ` (about ${lastV.detectable} chrF++ points or more)` : ''}: the rounds may be adding less than that, or `
        + 'nothing — it cannot tell which. Faster ways forward: the stronger model the rails offer when the '
        + 'computer can train one, or more of the kinds of sentence it gets wrong.');
  }
  if (need80 && total && need80 > Math.max(0, total - checked)) {
    actions.push(`At this pace working needs about ${roughly(need80)} more sentences — more than the ${total} the speaker said `
      + 'they can give in all. More speakers, helpers on the project, or a narrower goal for now would close the gap.');
  }
  if (last && last.ci95?.[0] >= 0.7) {
    actions.push('The model is close to working on the sentences you need: check it on the locked test set (a '
      + 'milestone — write down what you expect first).');
  }
  if (!actions.length) actions.push(`Carry on with round ${k}: the wishlist says what would help most.`);

  // the projection's numbers too (training sentences still needed, the range
  // the checks allow, hours), for whoever reads the report as data
  const projectionNumbers = proj?.more != null
    ? { more_sentences: proj.more, range: proj.range, speaker_hours: proj.hours } : null;
  return { round: k, progress, checks, projection, projection_numbers: projectionNumbers,
    actions: actions.slice(0, 4) };
}
