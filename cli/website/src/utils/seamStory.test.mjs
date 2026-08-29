/**
 * Guard: the homepage scroll story stays well-formed and honest.
 *   • caption windows are ordered, inside [0,1], and never stack more than
 *     two thoughts at once (the "no wall of text" rule);
 *   • every window leaves real dwell (the founder's breathing room);
 *   • every emphasis phrase is a substring of its caption (the lock-and-pop
 *     always lands on words that exist);
 *   • every numeric token in the copy is SSOT-derived (no hand-typed numbers);
 *   • tones stay in the meaning palette.
 *
 * Run: node --test cli/website/src/utils/seamStory.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {
  STORY,
  STORY_PAIRS,
  RUNCARD,
  RUN_QUEUE,
  CLOSE_TOOLS,
  BELT,
  WIN,
  SCROLL_VH,
  SCROLL_VH_MOBILE,
  TL_DUR,
  TAPE_ADVANCE,
  TAPE_LOCK_AT,
  ALLOWED_NUMERIC_TOKENS,
  IMPROVE_EDGE,
  beatShape,
  winAlpha,
  tapeState,
  tapeRowsAt,
  tapeProgressAtRow,
  rowLockAt,
  LOOP_LAPS,
  TAPE_RATE,
} from './seamStory.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHARED = join(SITE, '..', 'shared');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** order-free pair key — the same normalization the page and panel use */
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** the method a row was measured with: named, or the positional rotation */
const methodOf = (pr, i) => pr.method || RUNCARD.methods[i % RUNCARD.methods.length];

test('windows are sane, ordered, and end at the runway', () => {
  assert.ok(SCROLL_VH > SCROLL_VH_MOBILE);
  assert.equal(TL_DUR, 100);
  for (const [id, [a, b]] of Object.entries(WIN)) {
    assert.ok(a >= 0 && b <= 1 && a < b, `WIN.${id} malformed [${a}, ${b}]`);
  }
  const wins = Object.values(WIN);
  assert.ok(wins[wins.length - 1][1] >= 0.99, 'story ends at the runway');
  // Engine windows are strictly sequential (they hand the map from beat to beat).
  for (let i = 1; i < wins.length; i++) {
    assert.ok(wins[i][0] >= wins[i - 1][0], `WIN order breaks at index ${i}`);
  }
});

test('captions: ≤2 visible at once, generous dwell, on-screen anchors', () => {
  const ids = new Set();
  for (const s of STORY) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    const [a, b] = s.win;
    assert.ok(a >= 0 && b <= 1 && a < b, `${s.id} window malformed`);
    const [l, t] = s.pos;
    assert.ok(l >= 8 && l <= 92 && t >= 8 && t <= 92, `${s.id} anchor off-screen [${l}, ${t}]`);
    const {lockAt, dwellB} = beatShape(s.win);
    assert.ok(dwellB - lockAt >= (b - a) * 0.35, `${s.id} dwell too thin`);
  }
  // No wall of text: at any progress, at most 2 captions with text visible.
  for (let p = 0; p <= 1.001; p += 0.004) {
    const visible = STORY.filter((s) => s.text && winAlpha(p, s.win[0], s.win[1]) > 0.05);
    assert.ok(visible.length <= 2, `${visible.length} captions visible at p=${p.toFixed(3)}: ${visible.map((s) => s.id).join(', ')}`);
  }
});

test('every emphasis phrase exists in its caption', () => {
  for (const s of STORY) {
    if (!s.emph) continue;
    assert.ok(s.text.includes(s.emph), `${s.id}: emph "${s.emph}" not in text`);
  }
});

test('no hand-typed numbers — every numeric token is SSOT-derived', () => {
  assert.ok(ALLOWED_NUMERIC_TOKENS.length >= 3);
  for (const s of STORY) {
    const tokens = (s.text || '').match(/\d[\d,]*/g) || [];
    for (const tok of tokens) {
      assert.ok(
        ALLOWED_NUMERIC_TOKENS.includes(tok),
        `${s.id}: numeric token "${tok}" is not SSOT-derived (allowed: ${ALLOWED_NUMERIC_TOKENS.join(' · ')})`,
      );
    }
  }
});

test('tones stay in the meaning palette; footnotes point at real site paths', () => {
  for (const s of STORY) {
    if (s.tone) assert.ok(['teal', 'red', 'green', 'amber'].includes(s.tone), `${s.id} tone ${s.tone}`);
    /* R8 — an asterisk PROMISES a source for a figure. The founder caught both
     * ways that promise was being broken: captions citing nothing still showed
     * one, and the ones that did cite something rendered a bare glyph with the
     * label hidden in a title attribute. A footnote now requires a matching
     * inline `*` in the caption, so the marker always has a referent; anything
     * that is merely further reading is a `link` and must not be asterisked. */
    if (s.footnote) {
      assert.ok(s.footnote.href.startsWith('/'), `${s.id} footnote href must be site-relative`);
      assert.ok(s.footnote.label, `${s.id} footnote needs a label`);
      assert.ok(
        s.text.includes('*'),
        `${s.id} has a footnote but no inline * in its text — the asterisk would have nothing to refer to`,
      );
    }
    if (s.link) {
      assert.ok(s.link.href.startsWith('/'), `${s.id} link href must be site-relative`);
      assert.ok(s.link.label, `${s.id} link needs a label`);
      assert.ok(!s.footnote, `${s.id} carries both a footnote and a link — pick one`);
    }
    if (s.text && s.text.includes('*')) {
      assert.ok(s.footnote, `${s.id} has an inline * but no footnote to resolve it`);
    }
  }
});

test('winAlpha shape: zero outside, one at centre, feathered edges', () => {
  assert.equal(winAlpha(0.1, 0.2, 0.4), 0);
  assert.equal(winAlpha(0.5, 0.2, 0.4), 0);
  assert.equal(winAlpha(0.3, 0.2, 0.4), 1);
  assert.ok(winAlpha(0.205, 0.2, 0.4) > 0 && winAlpha(0.205, 0.2, 0.4) < 1);
});

test('tape: real 3-letter codes; the rerun + reroute rows dwell in their beats', () => {
  assert.ok(STORY_PAIRS.length >= 20, 'the tape needs a full reel');
  for (const pr of STORY_PAIRS) {
    assert.match(pr.a, /^[a-z]{3}$/, `${pr.a} not an ISO 639-3 code`);
    assert.match(pr.b, /^[a-z]{3}$/, `${pr.b} not an ISO 639-3 code`);
    assert.ok(pr.q > 0 && pr.q < 1, `${pr.a}↔${pr.b} q out of range`);
  }
  // R6: the tape is GEARED, so a row's dwell position is no longer a linear
  // slice — it must be solved through the SAME tapeRowsAt the page uses, or the
  // guard and the animation can silently disagree. Bisect for the progress at
  // which the head sits mid-dwell on row i.
  const N = STORY_PAIRS.length;
  const dwellsIn = (i, win) => {
    const target = i + TAPE_ADVANCE + (1 - TAPE_ADVANCE) * 0.5;
    let lo = BELT[0];
    let hi = BELT[1];
    for (let k = 0; k < 60; k += 1) {
      const m = (lo + hi) / 2;
      if (tapeRowsAt(m, N) < target) lo = m;
      else hi = m;
    }
    const dwellMid = (lo + hi) / 2;
    return dwellMid >= win[0] && dwellMid <= win[1];
  };

  /* R8 (founder 2026-08-07) — the regression this replaces: the improve beat
   * carried ONE re-measure, so "the whole network improves" was a claim with a
   * single data point behind it and the chain's numbers flipped once rather
   * than climbing. The beat now has to demonstrate what it says: every hop of
   * the teaching chain re-measured, more than once, each time by a method it
   * had not been measured with before, each time better. */
  const reruns = STORY_PAIRS.map((pr, i) => (pr.rerun ? i : -1)).filter((i) => i >= 0);
  assert.ok(reruns.length >= 6, `at least six community re-measures (got ${reruns.length})`);
  const CHAIN = [pairKey('fao', 'dan'), pairKey('dan', 'spa'), pairKey('spa', 'quz')];
  const touched = new Set();
  for (const ri of reruns) {
    const pr = STORY_PAIRS[ri];
    const k = pairKey(pr.a, pr.b);
    assert.ok(CHAIN.includes(k), `rerun row ${ri} (${k}) is not a teaching-chain bridge`);
    touched.add(k);
    const priors = STORY_PAIRS.map((q, i) => ({q, i})).filter(({q, i}) => i < ri && pairKey(q.a, q.b) === k);
    const prev = priors[priors.length - 1];
    assert.ok(prev, `rerun row ${ri} revisits a pair the tape already measured`);
    assert.ok(pr.q > prev.q.q, `rerun ${ri} must IMPROVE ${k} (${prev.q.q} → ${pr.q})`);
    const m = methodOf(pr, ri);
    assert.ok(RUNCARD.methods.includes(m), `rerun ${ri} method "${m}" is real run-card vocabulary`);
    assert.notEqual(m, methodOf(prev.q, prev.i), `rerun ${ri} must drop a NEW method on ${k}`);
    assert.ok(dwellsIn(ri, WIN.improve), `rerun row ${ri} does not dwell in improve ${WIN.improve}`);
  }
  assert.equal(touched.size, 3, 'every hop of the teaching chain is re-measured');
  // the LAST re-measure is the weak hop lifted to exactly the value the router
  // re-decides on — the chain's green and IMPROVE_EDGE must be the same fact.
  const payoff = STORY_PAIRS[reruns[reruns.length - 1]];
  assert.equal(pairKey(payoff.a, payoff.b), pairKey('spa', 'quz'), 'the payoff re-measure is the weak hop');
  assert.equal(Math.round(payoff.q * 100), IMPROVE_EDGE.best_chrf, 'the payoff q IS the router edge');

  // exactly two reroute rows (fao↔eng pivot-in + eng↔quz condenser), both
  // dwelling in the reroute beat AFTER every re-measure — the new measurements
  // land as the route condenses to the single English pivot (fao→eng→quz).
  const reroutes = STORY_PAIRS.map((pr, i) => (pr.reroute ? i : -1)).filter((i) => i >= 0);
  assert.equal(reroutes.length, 2, 'exactly two reroute rows (the pivot-in hop + the condensing measurement)');
  const lastRerun = reruns[reruns.length - 1];
  for (const i of reroutes) {
    assert.ok(i > lastRerun, `reroute row ${i} must come after every re-measure (${lastRerun})`);
    assert.ok(dwellsIn(i, WIN.reroute), `reroute row ${i} does not dwell in reroute ${WIN.reroute}`);
  }
  // the condensed route runs fao→eng→quz — the reroute rows carry that cast.
  const rrCodes = new Set(reroutes.flatMap((i) => [STORY_PAIRS[i].a, STORY_PAIRS[i].b]));
  assert.ok(rrCodes.has('fao') && rrCodes.has('eng') && rrCodes.has('quz'), 'reroute condenses through eng (fao→eng→quz)');
});

test('tapeState is pure, monotone, and locks at TAPE_LOCK_AT', () => {
  const n = STORY_PAIRS.length;
  assert.equal(tapeState(BELT[0] - 0.01, n).started, false);
  let prevScored = 0;
  let prevOffset = 0;
  for (let p = BELT[0]; p <= BELT[1] + 0.001; p += 0.002) {
    const s = tapeState(p, n);
    assert.ok(s.scoredCount >= prevScored, 'scoredCount monotone');
    assert.ok(s.offsetRows >= prevOffset - 1e-9, 'belt never rolls back');
    prevScored = s.scoredCount;
    prevOffset = s.offsetRows;
  }
  assert.equal(tapeState(BELT[1], n).scoredCount, n, 'every row scored by the belt end');
  assert.ok(TAPE_LOCK_AT > 0 && TAPE_LOCK_AT < 1 && TAPE_ADVANCE > 0 && TAPE_ADVANCE < 1);
});

test('the tape GEARBOX is monotone, lands exactly, and really bursts', () => {
  const N = STORY_PAIRS.length;
  // contiguous, ascending segments covering the whole belt
  let prevEnd = null;
  for (const [a, b, r] of TAPE_RATE) {
    assert.ok(b > a, `rate segment [${a},${b}] malformed`);
    assert.ok(r > 0, 'a zero/negative rate would stall or reverse the tape');
    if (prevEnd !== null) assert.equal(a, prevEnd, 'rate segments must be contiguous');
    prevEnd = b;
  }
  assert.equal(TAPE_RATE[0][0], BELT[0], 'the profile starts at the belt');
  assert.equal(prevEnd, BELT[1], 'the profile ends at the belt');

  // monotone, and exactly ROWS by the end (no row lost or double-counted)
  let prev = -1;
  for (let p = BELT[0]; p <= BELT[1] + 1e-9; p += 0.001) {
    const v = tapeRowsAt(p, N);
    assert.ok(v >= prev - 1e-9, `tapeRowsAt not monotone at p=${p.toFixed(3)}`);
    prev = v;
  }
  assert.ok(Math.abs(tapeRowsAt(BELT[1], N) - N) < 1e-6, 'every row is consumed by the belt end');
  assert.equal(tapeRowsAt(BELT[0] - 0.01, N), 0, 'nothing before the belt');

  // the BURST is real: the fastest segment must clearly outrun the baseline,
  // because the whole point is that the map flood and the tape share a clock.
  const rateAt = (p) => (tapeRowsAt(p + 0.002, N) - tapeRowsAt(p - 0.002, N)) / 0.004;
  const burst = TAPE_RATE.reduce((m, s) => (s[2] > m[2] ? s : m));
  const burstMid = (burst[0] + burst[1]) / 2;
  assert.ok(rateAt(burstMid) > rateAt(BELT[0] + 0.02) * 2.5, 'the measure burst must be ≥2.5× the opening pace');
});

/* R7 — the regression this guard exists for: the tape moved onto the gearbox in
 * R6, but `lockP` in home-preview.js kept the pre-gearbox LINEAR formula. Two
 * clocks. The map revealed edges on a different schedule than the tape head, the
 * community re-measure's payoff fired a beat and a half late, and the route's
 * 2→1 condense fired at p≈0.788 — after the chain panel had already faded, so
 * the single most important motion in Act IV was invisible. Anything that reacts
 * to "row i has been measured" must go through rowLockAt. */
test('rowLockAt inverts the gearbox exactly and lands inside each row dwell', () => {
  const N = STORY_PAIRS.length;

  // the inverse is exact, not approximate — round-trip every quarter row
  for (let r = 0; r <= N; r += 0.25) {
    const back = tapeRowsAt(tapeProgressAtRow(r, N), N);
    assert.ok(Math.abs(back - r) < 1e-9, `inverse drifted at row ${r}: got ${back}`);
  }
  assert.equal(tapeProgressAtRow(0, N), BELT[0], 'row 0 sits at the belt start');
  assert.ok(Math.abs(tapeProgressAtRow(N, N) - BELT[1]) < 1e-12, 'the last row lands at the belt end');

  // every lock lands where tapeState itself says that row locks
  for (let i = 0; i < N; i += 1) {
    const p = rowLockAt(i, N);
    const st = tapeState(p, N);
    assert.equal(st.headRow, i, `row ${i} locks while the head is on row ${st.headRow}`);
    assert.ok(
      Math.abs(st.dwellT - TAPE_LOCK_AT) < 1e-9,
      `row ${i} locks at dwellT ${st.dwellT}, not TAPE_LOCK_AT`,
    );
  }
});

test('the rerun + reroute rows LOCK inside their beats, not merely dwell there', () => {
  const N = STORY_PAIRS.length;
  const tagged = STORY_PAIRS.map((pr, i) => ({...pr, i})).filter((pr) => pr.rerun || pr.reroute);
  assert.ok(tagged.length >= 3, 'the tape has lost its story rows');
  for (const pr of tagged) {
    const win = pr.rerun ? WIN.improve : WIN.reroute;
    const p = rowLockAt(pr.i, N);
    assert.ok(
      p >= win[0] && p <= win[1],
      `row ${pr.i} (${pr.a}↔${pr.b}) locks at ${p.toFixed(4)}, outside [${win[0]}, ${win[1]}] — ` +
        'the beat it is supposed to cause would fire with nothing on screen',
    );
  }
});

/* ── R8 PACING GUARDS (founder 2026-08-07) ────────────────────────────────
 * Three of the founder's complaints were not about WHAT the seam animates but
 * about WHEN: the improve beat's measurements were one event, the condense
 * fired under the chain panel's own fade-out, and the tape ran out of rows and
 * coasted through the finale. Windows and rates can be re-proportioned by any
 * later round, so each of those three is pinned here as a timing fact. */

test('the improve beat carries six popped measurements with room between them', () => {
  const N = STORY_PAIRS.length;
  const [a, b] = WIN.improve;
  const locks = STORY_PAIRS.map((pr, i) => (pr.rerun ? rowLockAt(i, N) : -1)).filter((v) => v >= 0);
  assert.ok(locks.length >= 6, 'six measurements, or the beat is a claim rather than a demonstration');
  for (const p of locks) assert.ok(p >= a && p <= b, `a re-measure locks at ${p.toFixed(4)}, outside improve`);
  const vh = (x, y) => (y - x) * SCROLL_VH;
  for (let i = 1; i < locks.length; i += 1) {
    assert.ok(vh(locks[i - 1], locks[i]) >= 14, 'two pops closer than 14vh read as one event, not two');
  }
  assert.ok(vh(locks[locks.length - 1], b) >= 35, 'the payoff needs read-time before the beat exits');
});

test('the reroute lands EARLY in its beat, leaving real time to read the condense', () => {
  const N = STORY_PAIRS.length;
  const [a, b] = WIN.reroute;
  const rr = STORY_PAIRS.map((pr, i) => (pr.reroute ? i : -1)).filter((i) => i >= 0);
  for (const i of rr) {
    const p = rowLockAt(i, N);
    assert.ok(p >= a && p <= a + (b - a) * 0.5, `reroute row ${i} must land in the FIRST HALF of the beat`);
  }
  // The shipped R7 bug was the inverse: both rows landed at ~94% of the window,
  // so the 3-hop→2-hop collapse — the biggest mechanical payoff in the scroll —
  // played while the chain panel was already fading out.
  const last = rowLockAt(rr[rr.length - 1], N);
  assert.ok(
    (b - last) / (b - a) >= 0.55,
    `only ${(((b - last) / (b - a)) * 100).toFixed(0)}% of the reroute beat survives the condense`,
  );
});

test('the tape ACCELERATES into the close and is still stepping at the final frame', () => {
  const N = STORY_PAIRS.length;
  const rate = (v0, v1) => (tapeRowsAt(v1 / SCROLL_VH, N) - tapeRowsAt(v0 / SCROLL_VH, N)) / (v1 - v0);
  assert.ok(rate(1950, 2040) > rate(1750, 1850) * 1.8, 'the tail must visibly speed UP, not coast');
  assert.ok(rowLockAt(N - 1, N) >= BELT[1] - 0.003, 'the tape runs out of rows before the belt ends');
});

test('every tape row that names a method names a REAL one', () => {
  for (const pr of STORY_PAIRS) {
    if (!pr.method) continue;
    assert.ok(
      RUNCARD.methods.includes(pr.method),
      `row ${pr.a}↔${pr.b} method "${pr.method}" is not run-card vocabulary`,
    );
  }
});

test('every method-loop lap genuinely IMPROVES the pair it touches', () => {
  assert.equal(LOOP_LAPS.length, 3, 'three laps — repetition is the argument');
  let prevSpan = Infinity;
  for (const L of LOOP_LAPS) {
    const row = STORY_PAIRS[L.row];
    assert.ok(row, `lap row ${L.row} exists on the tape`);
    assert.ok(!row.rerun && !row.reroute, 'a lap must not hijack a narrative row');
    // a lap that left the pair no better would be a lie about what building does
    assert.ok(L.qNew > row.q, `lap on ${row.a}↔${row.b} must improve it (${row.q} → ${L.qNew})`);
    assert.ok(RUNCARD.methods.includes(L.method), `lap method "${L.method}" is real run-card vocabulary`);
    // …and each lap is SHORTER than the last — "the same work, getting easier"
    assert.ok(L.span < prevSpan, 'each lap must be faster than the one before');
    prevSpan = L.span;
    assert.ok(L.start >= 0 && L.start + L.span <= 1.0001, 'a lap stays inside its beat');
  }
  // the laps OVERLAP — several hands on the ring at once
  assert.ok(LOOP_LAPS[1].start < LOOP_LAPS[0].start + LOOP_LAPS[0].span, 'laps 1+2 overlap');
  assert.ok(LOOP_LAPS[2].start < LOOP_LAPS[1].start + LOOP_LAPS[1].span, 'laps 2+3 overlap');
});

test('run-card vocabulary is real (methods in SSOTs, benchmarks on cards)', () => {
  const coverage = readJSON(join(SHARED, 'catalogue', 'method-coverage.json'));
  const aliases = readJSON(join(SHARED, 'model-aliases.json'));
  const registry = readJSON(join(SHARED, 'method-registry.json'));
  const known = new Set([
    ...coverage.methods.flatMap((m) => [m.key, m.label]),
    ...Object.keys(aliases.aliases || aliases),
    ...(Array.isArray(registry.methods)
      ? registry.methods.flatMap((m) => [m.key, m.label, m.name, m.id]).filter(Boolean)
      : Object.keys(registry.methods || registry.entries || registry)),
  ]);
  for (const m of RUNCARD.methods) {
    assert.ok(known.has(m), `run-card method "${m}" not found in any method SSOT`);
  }
  const fallback = readFileSync(join(SHARED, 'cards-fallback.json'), 'utf8').toLowerCase();
  for (const bm of RUNCARD.benchmarks) {
    const needle = bm.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.ok(fallback.includes(needle.slice(0, 6)), `run-card benchmark "${bm}" not found on any card`);
  }
  assert.match(RUNCARD.footer, /illustrative/, 'the standing disclosure survives');
});

/* R8 — the homepage now TELLS A STRANGER TO RUN A COMMAND. That is a different
 * class of claim from a caption: a wrong one wastes someone's money or fails in
 * their terminal. So the command is checked against the script it invokes, not
 * merely spell-checked. */
test('the one command is VERBATIM from static/run_queue, and the script supports every key it names', () => {
  const script = readFileSync(join(SITE, 'static', 'run_queue'), 'utf8');
  assert.ok(
    script.includes(RUN_QUEUE.cmd),
    `the seam's command does not appear in run_queue's own usage header:\n  ${RUN_QUEUE.cmd}`,
  );
  const shown = `${RUN_QUEUE.env} ${RUN_QUEUE.envNote}`;
  for (const k of RUN_QUEUE.keys) {
    assert.ok(script.includes(k), `run_queue does not support ${k}`);
    assert.ok(shown.includes(k), `${k} is claimed in RUN_QUEUE.keys but never shown on the card`);
  }
  // never put a command on the homepage that could spend an unbounded amount of
  // someone else's money — the script requires a cap, and so do we.
  assert.match(RUN_QUEUE.cmd, /--budget|--top/, 'the spend cap is never implicit');
  assert.ok(RUN_QUEUE.docs.startsWith('/'), 'the docs link is site-relative');
});

test('a beat that declares LINE BREAKS still has an intact caption string', () => {
  for (const s of STORY) {
    if (!s.lines) continue;
    assert.ok(s.lines.length >= 2, `${s.id}: a single "line" is not a line break`);
    assert.equal(s.lines.join(' '), s.text, `${s.id}: lines.join(' ') must equal text`);
    if (s.emph) {
      assert.ok(
        s.lines.some((ln) => ln.includes(s.emph)),
        `${s.id}: the emph phrase straddles a break — the lock-and-pop needs ONE element`,
      );
    }
  }
});

test('every close-card tool is a real, reachable route', () => {
  assert.ok(CLOSE_TOOLS.length >= 7, 'the close lists ALL the tools, not a selection');
  for (const t of CLOSE_TOOLS) {
    assert.ok(t.name && t.what, `${t.href} needs a name and a what`);
    assert.ok(t.href.startsWith('/'), `${t.href} must be site-relative`);
    const path = t.href.split('#')[0];
    const asDoc = path.startsWith('/docs/') ? join(SITE, `${path.replace(/^\/docs\//, 'docs/')}.md`) : null;
    const asMdx = asDoc ? asDoc.replace(/\.md$/, '.mdx') : null;
    const asPage = join(SITE, 'src', 'pages', `${path.slice(1)}.js`);
    assert.ok(
      (asDoc && existsSync(asDoc)) || (asMdx && existsSync(asMdx)) || existsSync(asPage),
      `${t.href} resolves to nothing`,
    );
  }
});
