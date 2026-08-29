/**
 * seamStory — the homepage scroll story, as pure data (founder script
 * 2026-07-22 + refinement pass R1). No React, no DOM, no gsap: this module
 * is the SSOT for the beat windows, the caption copy, the emphasis phrases
 * and their tones, the zipper tape's pair list, and the run-card vocabulary —
 * so a node test can guard the whole narrative (windows ordered, dwells
 * generous, numbers SSOT-served, emphasis phrases real, run-card names real).
 *
 * R1 refinements (founder 2026-07-22b):
 *   · the zipper is a TURING-TAPE head — it advances a row, PAUSES, measures
 *     (run-card: pair · method · benchmark · rolling metrics), reports, and
 *     the score builds the network; it keeps running through the whole tail;
 *   · every tape row carries a real pair label; spa↔quz is RE-MEASURED on
 *     the tape during the community-improve beat (the tape revisits it);
 *   · pulses over lines — testing reads as pulse traffic, never dotted rails;
 *   · the field opens WHITE (languages, before coverage colours), then a
 *     GREEN sweep (covered), then a RED sweep (the gap);
 *   · the tail is visual: the improve chain, the sovereign seal, and a finale
 *     in which the whole mapped network carries traffic at once.
 *
 * Colour of an emphasis pop carries meaning (qualityColors/brandColors):
 *   teal = Champollion / a brand action · red = the problem, stated ·
 *   green = a quality fact · amber = the sovereign lane.
 * Numbers in copy are template-joined from seamFacts — never typed here.
 */
import {
  COVERED_LIVING,
  SERVICE_LIVING,
  GAP_FLOOR_LABEL,
  HUB_CLAIM_FLOOR_LABEL,
  LIVING_FLOOR_LABEL,
  fmt,
} from './seamFacts.mjs';

/** Pinned scroll runway (vh). Mobile gets a shorter runway, same windows.
 *  R7: +170vh funds the metaQuote and communities beats (see LAYOUT_VH). */
export const SCROLL_VH = 2070;
export const SCROLL_VH_MOBILE = 1630;

/** Master-timeline duration in beat units (kept for scrubbed helpers). */
export const TL_DUR = 100;

/**
 * Engine-side beat windows (progress 0..1). Camera keyframes live in the
 * page (they need live engine geometry), keyed to these same windows.
 * The dot-pulse WAVES deliberately LEAD their captions and outlast them —
 * the field moves first, the words catch up (founder: emphasis wasn't enough).
 */
/* R5 (founder 2026-07-25) — the arc was re-proportioned, NOT appended to. The
 * old tail gave four acts only the last 10% of the runway; the you-turn (Act VI)
 * and the end-in-view (Act VIII) need real dwell, so Acts I–V were scaled by
 * ~0.798 and the runway grew 1500→1900vh. Net effect: every existing beat keeps
 * the SAME absolute scroll distance it had before, and the new acts are funded
 * out of the added runway. `anywhere` became `reach` (it now opens Act VI) and
 * the standalone `index` beat was ABSORBED into `endInView`. (R8 later removed
 * that beat's endonym labels — see the endInView entry in STORY.) */
/* R7 (founder 2026-07-25) — the windows are no longer hand-typed progress
 * fractions. They are declared in SCROLL DISTANCE (vh) and divided by the
 * runway, because every re-proportioning round so far has had to retype ~30
 * float pairs by hand to keep each beat's absolute scroll distance while the
 * runway grew — and the numbers drift a little every time. Adding a beat is now
 * an insertion into ONE ordered table; nothing downstream is retyped.
 *
 * Read this table as the storyboard. Column 2/3 are vh from the top of the pin.
 * Entries are ordered by start, and a beat's caption may sit slightly inside its
 * engine window — the field moves first, the words catch up.
 *
 * R7 structural changes, from the founder's 12 notes:
 *   • `metaQuote` (NEW) — the Meta self-report holds the whole screen alone.
 *   • `communities` (NEW) — the people already building for these languages.
 *   • `pairs`/`specialize` and `pairByPair` are GONE, merged into `measure`.
 *   • `reach` now precedes `reroute`, so the route's 2→1 condense is the last
 *     thing that happens in Act V rather than the middle of it.
 *   • `expanse` (NEW, wordless) — fills what used to be dead air between the
 *     route work and the you-turn.
 *
 * @type {[string, number, number][]}
 */
const LAYOUT_VH = [
  // ── ACT I — the gap, in four sweeps ──────────────────────────────────────
  ['heroFade', 0, 30],
  ['waveAll', 34, 133], //   the field turns WHITE (dots = languages)
  ['living', 46, 133],
  ['waveCovered', 137, 228], //   GREEN sweep across the covered
  ['coveredAny', 146, 228],
  ['waveService', 228, 281], //   the deployed-service pass, brighter
  ['coveredService', 230, 281],
  ['waveGap', 285, 382], //   RED sweep across the gap
  ['gap', 295, 382],
  ['mesh', 388, 439], //   wordless — a mesh materializes over the served
  // ── ACT II — the industry's answer, and its own numbers ──────────────────
  ['omni', 445, 555], //   hub timeline stacks; pulses IN to the hubs
  ['notWorking', 559, 656], //   signals come BACK, mostly below their own bar
  ['metaQuote', 663, 781], // ★ the quote alone on screen. Long hold.
  ['communities', 789, 840], // ★ who is already building for these languages
  ['communityWork', 846, 894], // ★ …and what they build (the roster stays lit across both)
  // ── ACT III — measurement ────────────────────────────────────────────────
  ['ask', 901, 962], //   coverage is easy to claim
  ['zipIn', 938, 990], //   the tape rolls in under the claim
  ['measure', 969, 1030], //   we don't pick winners, we measure
  ['zipMeasure', 990, 1132], //   the tape works (run-card live)
  ['mapNetwork', 1037, 1079], //   …then the whole network
  /* 2026-08-19 — the lattice used to stroke 1040→1150 at STAGGER 0.6, so the
   * LAST edge of the story budget (a 320-edge prefix of a 520-edge array)
   * started at ~1080vh: one frame AFTER `mapNetwork` — the caption that names
   * the network — had already left. The sentence made its claim over a picture
   * that was still ~74% unbuilt, and the network finished assembling under
   * `useIt`/`netFill`, which are about something else. Shortened to land inside
   * its own caption. Ignition still runs on `mapBand` off the tape's clock. */
  ['latticeDraw', 1040, 1095], //   the claimed lattice strokes itself on
  ['mapBand', 1040, 1201], //   …and MEASUREMENT ignites it, until traffic narrows
  ['netFill', 1086, 1139], //   wordless; the measured network accretes
  ['useIt', 1086, 1132], //   every winner becomes something you can use
  ['openSource', 1139, 1194], //   built in the open
  ['route', 1139, 1250], //   the lowest-loss chain resolves
  ['lowestLoss', 1201, 1250],
  // ── ACT IV/V — the network repairs itself ────────────────────────────────
  /* R8 (founder 2026-08-07) — Acts IV/V were making claims they never
   * demonstrated. `improve` carried exactly ONE re-measurement behind "the whole
   * network improves", and both reroute rows locked at ~94% of their window, so
   * the 3-hop→2-hop condense — the biggest mechanical payoff in the whole scroll
   * — played under the chain panel's own fade-out. The `askIt` beat was deleted
   * (founder: "out of context and just adding too much") and ALL 113vh it freed
   * (its 99vh window plus both 7vh gaps) is spent here, where the problems are.
   * Acts I–III and VI–VIII keep their exact vh, so nothing before `transmit` or
   * after `expanse` moves. */
  ['transmit', 1257, 1335], //   the spa→quz test climbs the spectrum
  ['improve', 1342, 1534], // ★ 85→192vh — SIX re-measurements land on the chain
  ['reach', 1541, 1602], //   every contribution reaches further
  ['reroute', 1609, 1742], // ★ 85→133vh — 2 rows lock EARLY, then the condense reads
  ['expanse', 1749, 1791], //   91→42vh — the dead gap is deleted, not re-filled
  // ── ACT VI — the you-turn ────────────────────────────────────────────────
  // (`askIt` + the Answer Card DELETED — its runway funds improve/reroute above)
  ['oneCommand', 1798, 1885], //   the command card: one command, copyable
  ['shareIt', 1892, 1941], //   …or build one of your own
  // ── ACT VII/VIII — sovereignty, then the destination ─────────────────────
  ['rights', 1948, 2001], //   the sovereign seal
  ['endInView', 2010, 2063], //   the field fills TEAL (aim); the lattice EXPLODES
  ['close', 2044, 2070], //   the support structure + CTAs
];

/** Engine/caption beat windows (progress 0..1), derived from LAYOUT_VH. */
export const WIN = Object.fromEntries(
  LAYOUT_VH.map(([id, a, b]) => [id, [Math.round((a / SCROLL_VH) * 1e4) / 1e4, Math.round((b / SCROLL_VH) * 1e4) / 1e4]]),
);

/**
 * The zipper tape's belt window: it starts inside zipIn and keeps stepping
 * until the close — the tape works through the ENTIRE story tail, reflecting
 * each beat (founder: the queue never stops once introduced). R3 extends the
 * end so the two REROUTE rows (indices 17–18 of 24) dwell inside WIN.reroute.
 */
/* R6: the tape runs to the FINAL FRAME (founder) — it never stands down.
 * R7: expressed in vh off the same LAYOUT_VH ruler as the beats, so the belt
 * cannot drift away from the story when the runway is re-proportioned. It opens
 * as `zipIn` finishes rolling the tape on, and lands its final row exactly as
 * the closing card arrives. */
const BELT_VH = [990, 2044];
export const BELT = BELT_VH.map((v) => Math.round((v / SCROLL_VH) * 1e4) / 1e4);

/**
 * THE GEARBOX (R6, founder: "the zipper should run faster when it gets to 'we
 * measure the whole network' … matching the explosion in measurements shown on
 * the map. It can slow again later.").
 *
 * The tape used to advance LINEARLY in scroll progress, so it could never
 * respond to the story. Now its rate is a piecewise-constant profile that is
 * INTEGRATED to a cumulative row count — normal pace, a hard burst across the
 * measure beats, then settling for the route work and the tail.
 *
 * Properties that matter: `tapeRowsAt` is PURE in p and MONOTONE (so the tape
 * scrubs both ways and never rolls back), and it lands exactly on ROWS at
 * BELT[1] by construction. The seam's map ignition is driven off the SAME row
 * count, so a tape burst IS a map flood — one clock, not two animations that
 * merely resemble each other.
 *
 * @type {[number, number, number][]} [from, to, rate]
 */
/** The fraction of each tape slice spent ADVANCING; the rest is the dwell. */
export const TAPE_ADVANCE = 0.3;
/** How far through a dwell the score LOCKS (recolour + thread + pop). */
export const TAPE_LOCK_AT = 0.55;

/* R7: the rate profile is declared in vh against LAYOUT_VH, so the burst stays
 * welded to the beats that motivate it. The segment BOUNDARIES are beat
 * boundaries, not round numbers. */
/* R8 (founder 2026-08-07) — the profile is finer-grained, for three reasons the
 * founder named. (1) `improve` needs SIX measurements inside it, and at the old
 * flat 0.62 across 1257→1594 only ~2.6 rows fell in that window. (2) The reroute
 * rows have to land in the FIRST HALF of their beat so the condense has room to
 * be read. (3) "The zipper seems to stop [at the end], but it should accelerate
 * … and keep chugging along very rapidly" — so the tail now ramps 16 → 11 → 7
 * vh/row instead of coasting at a flat ~21. The measure burst stays the global
 * maximum, so the ≥2.5× guard still means what it says. */
const TAPE_RATE_VH = [
  [990, 1040, 1.29], // `measure` — working, brisk, one legible pair (~15.5 vh/row)
  [1040, 1160, 4.0], // ★ THE BURST — mapNetwork + useIt        (~5.0  vh/row)
  [1160, 1257, 1.09], // openSource + lowestLoss: settling out   (~18.3 vh/row)
  [1257, 1342, 0.48], // transmit — we are watching ONE pair     (~41.7 vh/row)
  [1342, 1534, 0.87], // ★ IMPROVE — six re-measurements         (~23.0 vh/row)
  [1534, 1609, 0.74], // reach — the tape keeps working          (~27.0 vh/row)
  [1609, 1742, 0.77], // ★ REROUTE — two rows early, then dwell  (~26.0 vh/row)
  [1742, 1850, 1.25], // the tail picks up…                      (~16.0 vh/row)
  [1850, 1950, 1.82], // …and keeps picking up…                  (~11.0 vh/row)
  [1950, 2044, 2.85], // ★ …and RIPS to the final frame          (~7.0  vh/row)
];
/** @type {[number, number, number][]} [from, to, rate] in progress units */
export const TAPE_RATE = TAPE_RATE_VH.map(([a, b, r]) => [
  Math.round((a / SCROLL_VH) * 1e4) / 1e4,
  Math.round((b / SCROLL_VH) * 1e4) / 1e4,
  r,
]);
const RATE_TOTAL = TAPE_RATE.reduce((s, [a, b, r]) => s + (b - a) * r, 0);

/** Integrated rate up to p (row-units). Pure, monotone. */
function rateCum(p) {
  let c = 0;
  for (const [a, b, r] of TAPE_RATE) {
    if (p <= a) break;
    c += (Math.min(p, b) - a) * r;
  }
  return c;
}

/**
 * Cumulative ROWS consumed by progress p — the gearbox's only public output.
 * @param {number} p progress 0..1
 * @param {number} rows total tape rows
 */
export function tapeRowsAt(p, rows) {
  if (p <= BELT[0]) return 0;
  if (p >= BELT[1]) return rows;
  return (rows * rateCum(p)) / RATE_TOTAL;
}

/**
 * THE GEARBOX, INVERTED (R7) — the scroll progress at which the tape has
 * consumed `rowFloat` rows. Exact analytic inverse of `tapeRowsAt`, not a
 * bisection: every TAPE_RATE segment has a positive rate, so `rateCum` is
 * strictly increasing and piecewise-linear, and each segment inverts by
 * division.
 *
 * This exists because everything OUTSIDE the tape that has to happen "when
 * row i is measured" — a map edge revealing, the chain's coaching correction,
 * the improve payoff — was still computing that moment with the pre-gearbox
 * LINEAR formula. Two clocks, one tape: the map lagged the head by up to two
 * beats and the route's 2→1 condense fired after its panel had already faded.
 * Anything keyed to a row must go through here.
 *
 * @param {number} rowFloat rows consumed (may be fractional)
 * @param {number} rows total tape rows
 * @returns {number} progress 0..1, clamped to the belt
 */
export function tapeProgressAtRow(rowFloat, rows) {
  if (!(rows > 0)) return BELT[0];
  const r = Math.min(rows, Math.max(0, rowFloat));
  const target = (r * RATE_TOTAL) / rows;
  let c = 0;
  for (const [a, b, rate] of TAPE_RATE) {
    const seg = (b - a) * rate;
    if (target <= c + seg) return a + (target - c) / rate;
    c += seg;
  }
  return BELT[1];
}

/**
 * Where row `i`'s score LOCKS on the scroll — the single definition, shared by
 * the tape itself and by every instrument that reacts to a measurement.
 * @param {number} i row index
 * @param {number} rows total tape rows
 */
export function rowLockAt(i, rows) {
  return tapeProgressAtRow(i + TAPE_ADVANCE + (1 - TAPE_ADVANCE) * TAPE_LOCK_AT, rows);
}

/**
 * @typedef {Object} StoryBeat
 * @property {string} id
 * @property {[number, number]} win  caption window [a, b] in progress 0..1
 * @property {[number, number]} pos  caption anchor [left %, top %]
 * @property {string} text          the thought (numbers template-joined)
 * @property {string[]} [lines]     declared line breaks; MUST join(' ') to text
 * @property {string} [emph]        the lock-and-pop phrase — substring of text
 * @property {'teal'|'red'|'green'|'amber'} [tone]
 * @property {boolean} [aside]      shares the stage with the persistent
 *   instruments (run-card + queue column own the right of the viewport from
 *   `improve` onward), so the caption is width-capped to stay clear of them
 * @property {string} [sub]         terse honesty line (rare — R1 removed most)
 * @property {{label: string, href: string}} [footnote]  a CITATION: how a
 *   number in this caption was counted or estimated. Renders as "* label",
 *   and the caption text must carry the matching inline `*` on the figure it
 *   belongs to — the marker needs a referent (guard-tested).
 * @property {{label: string, href: string}} [link]  further reading or a call
 *   to action. Renders as a plain labelled link, NEVER an asterisk: an
 *   asterisk promises a source for a claim, and using it for "submit a
 *   method" was the founder's "cards without a citation still have that weird
 *   asterisk at the bottom".
 */

/** @type {StoryBeat[]} */
export const STORY = [
  {
    id: 'living',
    win: WIN.living,
    pos: [50, 26],
    text: `There are ${LIVING_FLOOR_LABEL} living spoken languages today.`,
    emph: LIVING_FLOOR_LABEL,
    tone: 'teal',
  },
  {
    id: 'coveredAny',
    win: WIN.coveredAny,
    pos: [33, 64],
    text: `Only ${fmt(COVERED_LIVING)}* have any machine translation.`,
    emph: fmt(COVERED_LIVING),
    tone: 'green',
    footnote: {label: 'how we count coverage', href: '/docs/network/context/coverage-counting'},
  },
  {
    id: 'coveredService',
    win: WIN.coveredService,
    pos: [38, 73],
    text: `Just ${fmt(SERVICE_LIVING)}* are served by a deployed service.`,
    emph: fmt(SERVICE_LIVING),
    tone: 'green',
    footnote: {label: 'how we count coverage', href: '/docs/network/context/coverage-counting'},
  },
  {
    id: 'gap',
    win: WIN.gap,
    pos: [62, 32],
    text: `${GAP_FLOOR_LABEL.charAt(0).toUpperCase()}${GAP_FLOOR_LABEL.slice(1)}* people can’t get translation into their first language.`,
    emph: 'can’t get translation',
    tone: 'red',
    footnote: {label: 'how this is estimated', href: '/docs/network/context/coverage-gap-estimate'},
  },
  /* ── ACT II — THE INDUSTRY'S ANSWER, IN ITS OWN NUMBERS (R7) ──────────────
   * The shipped R6 line — "Most speakers of those languages can tell you: this
   * isn't working" — was FALSE and the founder caught it: it asserts machine
   * translation is a blanket failure, when our own cited data shows chrF in the
   * high 60s–70s on well-resourced pairs. The true claim is both narrower and
   * sharper, and it is the providers' own: they publish a coverage COUNT, and
   * their own quality self-report does not reach most of it. HubColumn renders
   * the arithmetic (~1,200 of 1,600 below their own bar) beside this caption. */
  {
    id: 'omni',
    win: WIN.omni,
    pos: [30, 38],
    // plural — the HubColumn beside this shows a stack of hub models, not one.
    // "claim to cover" is the whole point: coverage is a claim, not a result.
    text: `The industry’s answer: omnimodels that claim to cover ${HUB_CLAIM_FLOOR_LABEL} at once.`,
    emph: 'claim to cover',
    tone: 'teal',
  },
  {
    id: 'notWorking',
    win: WIN.notWorking,
    pos: [34, 58],
    text: 'Their own numbers say most of that coverage is low quality at the margins.',
    emph: 'low quality at the margins',
    tone: 'red',
  },
  {
    /* ★ R7 — the founder wanted this "full screen for emphasis … they said their
     * approach is wrong and ours is right is the subtext". So it is staged as
     * the only thing on screen: the map dims hard, every instrument clears, and
     * the sentence arrives word by word with an oversized lock-and-pop. We never
     * say the subtext out loud — the quote is left to do its own work.
     * VERBATIM from Omnilingual MT §1 (arXiv:2603.16309). */
    id: 'metaQuote',
    win: WIN.metaQuote,
    pos: [50, 42],
    full: true,
    text: '“specialization, not scale, is perhaps a more reliable path to high-quality multilingual translation”',
    emph: 'specialization, not scale',
    tone: 'green',
    cite: {label: 'Omnilingual MT · FAIR at Meta · 2026', href: 'https://arxiv.org/abs/2603.16309'},
  },
  /* ── ACT II½ — WHO IS ALREADY BUILDING (R7, NEW) ──────────────────────────
   * Founder note 2: stand up the people doing this work — communities and
   * computational linguists — "even if only aspirational or currently
   * unsuccessful … dictionaries, FSTs, AfriCOMET". The roster lives in
   * communityProjects.mjs; every entry links to the project's OWN site or
   * paper, and we claim no partnership, endorsement or affiliation with any of
   * them. See that module's header for the naming rules. */
  {
    id: 'communities',
    win: WIN.communities,
    pos: [32, 30],
    text: 'Speaker communities and linguists are already building for these languages.',
    emph: 'already building',
    tone: 'teal',
  },
  {
    id: 'communityWork',
    win: WIN.communityWork,
    pos: [36, 66],
    text: 'Dictionaries. Grammars. Small models, built to carry one language.',
    emph: 'built to carry one language',
    tone: 'teal',
  },
  /* ── ACT III — MEASUREMENT ────────────────────────────────────────────────
   * R7 merges the old `specialize` / `pairByPair` / `measure` trio into two
   * beats. Three captions to say "we measure" was the info-dump the founder
   * objected to; the zipper arriving under the first line and ripping through
   * the second says it faster than any of them did. */
  {
    id: 'ask',
    win: WIN.ask,
    pos: [34, 30],
    text: 'Coverage is easy to claim. Quality must be measured.',
    emph: 'must be measured',
    tone: 'teal',
  },
  {
    id: 'measure',
    win: WIN.measure,
    pos: [30, 62],
    text: 'Giant or purpose-built — Champollion doesn’t pick winners. It measures quality.',
    emph: 'It measures quality',
    tone: 'teal',
  },
  {
    id: 'mapNetwork',
    win: WIN.mapNetwork,
    pos: [32, 70],
    /* founder ruling 2026-08-21: we are a ROUTING NETWORK, not a coverage
     * claim. "the whole network. Every pair. Every method." promised
     * exhaustiveness we cannot meet and nobody in the industry meets — the
     * dossier set (docs/competitive/) shows the deployable commercial ceiling
     * is 207 ISO 639-3 codes. What is true, and stronger, is that a measured
     * pair becomes a route: coverage is an OUTCOME of what the network
     * contains, never a promise we make. */
    text: 'Then we map what we measured. Pair by pair. Method by method.',
    emph: 'what we measured',
    tone: 'teal',
  },
  {
    /* founder note 5: "'method you can install' is abstract and technical, we
     * need to quickly get to 'you can use this'". The payoff — WHY you can
     * trust it — lands two beats later on `transmit`. */
    id: 'useIt',
    win: WIN.useIt,
    pos: [34, 70],
    text: 'Every winner becomes something you can use.',
    emph: 'you can use',
    tone: 'green',
  },
  {
    // the explicit contrast with the closed, for-profit models of Act II.
    id: 'openSource',
    win: WIN.openSource,
    pos: [32, 26],
    text: 'Built on source-available technology that protects community data.',
    emph: 'protects community data',
    tone: 'teal',
  },
  {
    id: 'lowestLoss',
    win: WIN.lowestLoss,
    pos: [30, 40],
    text: 'The network routes around weakness. The lowest-loss path wins.',
    emph: 'lowest-loss path',
    tone: 'teal',
  },
  {
    /* the 7-ball red→green volley used to play SILENT here. It is the moment
     * the argument turns from "we measure" to "and you can check us", so it
     * gets the line that closes the loop `useIt` opened. */
    id: 'transmit',
    win: WIN.transmit,
    pos: [30, 24],
    aside: true,
    text: '…because every test result is public.',
    emph: 'every test result is public',
    tone: 'green',
  },
  {
    id: 'improve',
    win: WIN.improve,
    pos: [28, 34],
    aside: true,
    text: 'Community and developer efforts strengthen weak links. The whole network improves.',
    emph: 'strengthen weak links',
    tone: 'green',
  },
  /* R7 (founder note 8) — `reach` and `reroute` are SWAPPED. The old order let
   * the route condense and then wandered off to Zambales, which spent the
   * biggest mechanical payoff in Act V a beat before the act ended. Reversed,
   * contributions spread the network outward and THEN one of them collapses a
   * three-hop route to two — so Act V ends on its strongest move. */
  {
    id: 'reach',
    win: WIN.reach,
    /* R8: was [46, 26]. The run-card no longer bows out mid-act (founder: "I
     * don't want the card to fade … I want the narrative text to have better
     * placement so there isn't occlusion"), and at 46%/26% this caption's right
     * edge landed ON it. Dropped to the lower band, which also keeps its
     * Andes/Pacific composition and clears the chain strip. Anchored at 40%
     * rather than 46% — measured in-browser, 46% still grazed the card's left
     * edge (62%) by ~2% at the widest caption. */
    pos: [40, 60],
    aside: true,
    text: 'Every contribution reaches further. The Faroes. The Andes. Zambales.',
    emph: 'Every contribution',
    tone: 'teal',
  },
  {
    id: 'reroute',
    win: WIN.reroute,
    pos: [30, 30],
    aside: true,
    text: 'One new method or measurement can reroute and improve the entire network.',
    emph: 'reroute and improve the entire network',
    tone: 'green',
  },
  /* ── ACT VI — THE YOU-TURN (R5, founder 2026-07-25) ──────────────────────
   * Everything before this is third-person: a machine being built. By now the
   * visitor has watched that machine measure, route, and repair itself — so the
   * story finally turns and offers it to them. The last of these beats ("share
   * what you measure") is what EARNS the sovereignty act: asking for someone's
   * results raises, immediately, on whose terms.
   * The wordless `expanse` window sits between Act V and here — R7 fills what
   * used to be ~90vh of dead air with the grown network carrying real traffic. */
  {
    /* R8 (founder 2026-08-07). The `mt-eval run` ring that used to play here was
     * cut — it argued "anyone can build one" by geometry and left the visitor
     * with nothing to actually do. The CommandCard below now carries the REAL
     * thing a stranger can do in the next sixty seconds: the queue-runner
     * command, verbatim, with a button that copies it. The words only have to
     * make the offer. */
    id: 'oneCommand',
    win: WIN.oneCommand,
    pos: [34, 22],
    aside: true,
    text: 'With one command, anyone can contribute compute to map the network.',
    emph: 'contribute compute',
    tone: 'teal',
  },
  {
    // …and the other half of the offer: the build lane. No panel — the forge
    // docs are one click away and the close card lists the whole toolchain.
    id: 'shareIt',
    win: WIN.shareIt,
    pos: [34, 26],
    aside: true,
    text: '…or you can build, test, and publish your own method.',
    emph: 'your own method',
    tone: 'green',
    link: {label: 'submit a method', href: '/docs/network/getting-started/submit-a-method'},
  },
  /* ── ACT VII — SOVEREIGNTY (now motivated: we just asked for their data) ── */
  {
    /* R8 (founder 2026-08-07) — the "On whose terms?" opener is gone. It was a
     * rhetorical question the sovereign seal beneath it already answers, and
     * asking it delayed the only line that matters. The claim stands alone. */
    id: 'rights',
    win: WIN.rights,
    pos: [50, 24],
    text: 'Communities set the standard for their own language.',
    emph: 'set the standard',
    tone: 'amber',
    link: {label: 'how we protect community data', href: '/docs/network/sovereignty/data-sovereignty'},
  },
  /* ── ACT VIII — THE END IN VIEW ──────────────────────────────────────────
   * The field fills TEAL — the codebase's established "aim, never a measured
   * claim" colour — the lattice EXPLODES rather than fading, and the whole
   * network carries traffic at once. R8 (founder): the background endonym
   * labels were removed; the claim is now the aim itself, and the condition on
   * it is the point of the beat. Teal, because a universal translator is
   * something we could build, never something we have measured.
   *
   * `lines` declares the breaks (founder: "make sure the line breaks are better
   * than what's there now"). `text` stays lines.join(' ') so every guard and the
   * reduced-motion article read one intact sentence. */
  {
    id: 'endInView',
    win: WIN.endInView,
    pos: [50, 22],
    // three declared lines, so the emphasis gets a line of its own at EVERY
    // width rather than only where the first line happens to wrap.
    lines: ['We can build a', 'UNIVERSAL TRANSLATOR —', 'but only by working together.'],
    text: 'We can build a UNIVERSAL TRANSLATOR — but only by working together.',
    emph: 'UNIVERSAL TRANSLATOR',
    tone: 'teal',
  },
];

/**
 * THE TAPE — every row is a real ISO 639-3 pair with an illustrative quality
 * (0..1 → qualitySpectrum; the run-card's standing footer discloses the
 * illustrative regime). Row order IS tape order; `rerun: true` marks the
 * community re-measure of spa↔quz, positioned so the tape head reaches it
 * DURING the improve beat (the tape literally revisits the weak pair).
 * Unresolvable codes still display in the queue; they just don't thread.
 *
 * Row order is tape order, and tape order sets each row's lock position on the
 * scroll (rowLockAt) — so the STORY rows are POSITIONED, not merely appended.
 * Codes are real ISO 639-3 with a language-card. Illustrative q →
 * qualitySpectrum; the run-card's standing footer discloses the illustrative
 * regime. The guard test asserts each tagged row LOCKS inside its beat.
 *
 * R8 (founder 2026-08-07) — 80 rows. Two changes, both demanded by the founder's
 * note that "this stage doesn't really show it improving … I want at least SIX
 * measurements reflected in the lower cards, through multiple new methods
 * dropping":
 *
 *   • rows 35–40 replace the single old re-measure. EVERY hop of the teaching
 *     chain is re-measured TWICE, each time by a DIFFERENT real method, each
 *     time better — so the chain's bridge cards step their numbers up six times
 *     across the improve beat instead of flipping once. Row 40 must stay LAST:
 *     its 0.71 is exactly IMPROVE_EDGE.best_chrf/100, the value the router
 *     re-decides on and the value CARD_HERO renders (24 → 71).
 *   • rows 59–69 are new tail rows, so the accelerating tail (see TAPE_RATE_VH)
 *     has rows to consume and the zipper is still firing locks at the final
 *     frame instead of running dry and coasting.
 *
 * Two optional fields, both guard-tested:
 *   `method` — the RUNCARD method THIS reading was taken with. Without it a row
 *     falls back to the positional rotation, which is fine for ambient rows but
 *     is exactly wrong for a re-measure: "a new method dropped" is the story, so
 *     it has to be named, and it has to differ from the reading it replaces.
 *   `corpus` — this reading came off a COMMUNITY corpus rather than a held-out
 *     benchmark. Drives the amber kicker (amber = the sovereign lane; it never
 *     means quality here).
 *
 * @typedef {{a: string, b: string, q: number, rerun?: boolean, reroute?: boolean,
 *   method?: string, corpus?: boolean}} SeamPair
 * @type {SeamPair[]}
 */
export const STORY_PAIRS = [
  // the teaching chain's BASE readings. Methods are named rather than left to
  // the positional rotation, so the chain's bridge cards read from the SSOT
  // instead of coinciding with it — and so each re-measure below can be checked
  // against the reading it actually replaces.
  {a: 'fao', b: 'dan', q: 0.86, method: 'NLLB-200'}, //  0 ← hop 1 (good)
  {a: 'dan', b: 'spa', q: 0.78, method: 'OPUS-MT'}, //  1 ← hop 2 (good)
  {a: 'spa', b: 'quz', q: 0.44, method: 'claude-sonnet'}, //  2 ← hop 3 — the weak last hop
  {a: 'eng', b: 'sat', q: 0.56}, //  3
  {a: 'rus', b: 'sah', q: 0.69}, //  4
  {a: 'fra', b: 'bam', q: 0.38}, //  5 ← Bambara: neither COMET nor AfriCOMET is valid here
  {a: 'eng', b: 'ven', q: 0.57}, //  6
  {a: 'swh', b: 'lug', q: 0.41}, //  7 ← Luganda: neither COMET nor AfriCOMET (the publisher's verified list covers Swahili only as macro `swa`, and not Luganda at all — metric-coverage.json)
  {a: 'eng', b: 'nqo', q: 0.45}, //  8
  {a: 'eng', b: 'dje', q: 0.65}, //  9
  {a: 'eng', b: 'dyu', q: 0.65}, // 10
  {a: 'rus', b: 'abq', q: 0.14}, // 11
  {a: 'rus', b: 'che', q: 0.68}, // 12
  {a: 'eng', b: 'bci', q: 0.34}, // 13
  {a: 'eng', b: 'sus', q: 0.53}, // 14
  {a: 'eng', b: 'efi', q: 0.36}, // 15
  {a: 'eng', b: 'aar', q: 0.59}, // 16
  {a: 'eng', b: 'fon', q: 0.69}, // 17
  {a: 'eng', b: 'kik', q: 0.37}, // 18
  {a: 'sat', b: 'mal', q: 0.42}, // 19
  {a: 'eng', b: 'lub', q: 0.41}, // 20
  {a: 'eng', b: 'mos', q: 0.15}, // 21
  {a: 'eng', b: 'ndc', q: 0.42}, // 22
  {a: 'eng', b: 'nde', q: 0.43}, // 23
  {a: 'sat', b: 'tel', q: 0.27}, // 24
  {a: 'eng', b: 'tiv', q: 0.54}, // 25
  {a: 'eng', b: 'tum', q: 0.48}, // 26
  {a: 'sat', b: 'tam', q: 0.2}, // 27
  {a: 'eng', b: 'wol', q: 0.33}, // 28
  {a: 'sat', b: 'brx', q: 0.62}, // 29
  {a: 'eng', b: 'tyv', q: 0.54}, // 30
  {a: 'sat', b: 'mni', q: 0.5}, // 31
  {a: 'sat', b: 'kan', q: 0.17}, // 32
  {a: 'eng', b: 'mfe', q: 0.21}, // 33
  {a: 'eng', b: 'pcm', q: 0.67}, // 34
  // ── THE COMMUNITY/DEVELOPER PASS (rows 35–40, all inside WIN.improve) ─────
  // Every hop of the teaching chain, re-measured twice, each time by a method it
  // has not been measured with before. This is the beat's whole argument: not
  // "the network improves" asserted once, but six readings landing on three
  // bridge cards, each one better than the last. Row 40 is the payoff and must
  // stay last — its 0.71 IS IMPROVE_EDGE.
  {a: 'fao', b: 'dan', q: 0.9, rerun: true, method: 'MADLAD-400'}, // 35  0.86 → 0.90
  {a: 'dan', b: 'spa', q: 0.83, rerun: true, method: 'claude-sonnet'}, // 36  0.78 → 0.83
  {a: 'spa', b: 'quz', q: 0.58, rerun: true, method: 'google-translate', corpus: true}, // 37  0.44 → 0.58
  {a: 'fao', b: 'dan', q: 0.93, rerun: true, method: 'OPUS-MT'}, // 38  0.90 → 0.93
  {a: 'dan', b: 'spa', q: 0.87, rerun: true, method: 'NLLB-200'}, // 39  0.83 → 0.87
  {a: 'spa', b: 'quz', q: 0.71, rerun: true, method: 'NLLB-200', corpus: true}, // 40 ★ 0.58 → 0.71
  {a: 'rus', b: 'jdt', q: 0.55}, // 41
  {a: 'sat', b: 'asm', q: 0.33}, // 42
  {a: 'sat', b: 'ben', q: 0.58}, // 43
  {a: 'sat', b: 'dgo', q: 0.32}, // 44
  {a: 'sat', b: 'guj', q: 0.15}, // 45
  {a: 'fao', b: 'eng', q: 0.72, reroute: true, method: 'google-translate'}, // 46 ★ pivot-in hop
  {a: 'eng', b: 'quz', q: 0.74, reroute: true, method: 'MADLAD-400'}, // 47 ★ CONDENSES the chain
  {a: 'sat', b: 'kas', q: 0.69}, // 48
  {a: 'sat', b: 'gom', q: 0.23}, // 49
  {a: 'sat', b: 'mai', q: 0.41}, // 50
  {a: 'sat', b: 'mar', q: 0.47}, // 51
  {a: 'sat', b: 'npi', q: 0.25}, // 52
  {a: 'sat', b: 'ory', q: 0.54}, // 53
  {a: 'sat', b: 'cls', q: 0.4}, // 54
  {a: 'sat', b: 'snd', q: 0.28}, // 55
  {a: 'sat', b: 'urd', q: 0.63}, // 56
  {a: 'sat', b: 'hin', q: 0.33}, // 57
  {a: 'sat', b: 'pan', q: 0.38}, // 58
  // ── the accelerating tail (R8). The tape used to land its last row and then
  //    sit idle through the finale; these rows are what it keeps working on as
  //    the gearbox ramps to ~7 vh/row. Every code has a language card.
  {a: 'quy', b: 'quz', q: 0.66}, // 59  Chanka ↔ Cusco Quechua
  {a: 'spa', b: 'ayr', q: 0.31}, // 60  Aymara
  {a: 'spa', b: 'grn', q: 0.57}, // 61  Guaraní
  {a: 'spa', b: 'yua', q: 0.29}, // 62  Yucatec Maya
  {a: 'eng', b: 'nav', q: 0.24}, // 63  Navajo
  {a: 'eng', b: 'chr', q: 0.19}, // 64  Cherokee
  {a: 'eng', b: 'crk', q: 0.35}, // 65  Plains Cree — lands just before the seal names it
  {a: 'eng', b: 'ike', q: 0.22}, // 66  Inuktitut
  {a: 'eng', b: 'haw', q: 0.44}, // 67  Hawaiian
  {a: 'eng', b: 'mri', q: 0.61}, // 68  Māori
  {a: 'rus', b: 'sme', q: 0.38}, // 69  Northern Sámi
  {a: 'dtp', b: 'zlm', q: 0.32}, // 70
  {a: 'eng', b: 'dtp', q: 0.65}, // 71
  {a: 'egl', b: 'ita', q: 0.42}, // 72
  {a: 'eng', b: 'got', q: 0.46}, // 73
  {a: 'dtp', b: 'jpn', q: 0.37}, // 74
  {a: 'fra', b: 'ina', q: 0.67}, // 75
  {a: 'deu', b: 'lad', q: 0.28}, // 76
  {a: 'ita', b: 'tok', q: 0.52}, // 77
  {a: 'cor', b: 'epo', q: 0.33}, // 78
  {a: 'deu', b: 'gos', q: 0.27}, // 79
];

/**
 * The illustrative, clean-flagged demo edge-graph for the ROUTING beat. The
 * winner is ALWAYS chosen by meshChains.bestMeasuredChain (loss, not hops) —
 * these values exist so the router GENUINELY re-decides as the graph grows:
 *   base    → fao→dan→spa→quz   (2 interlingua: dan, spa; spa–quz weak at 44)
 *   improve → fao→dan→spa→quz, last hop lifted to 71 (same road, lower loss)
 *   reroute → fao→eng→quz       (CONDENSES to 1 interlingua: dan+spa eliminated
 *             for a single high-resource pivot — English↔Quechua is the
 *             best-measured door into Quechua — a 2→1 hop reduction)
 * The flip is guard-tested (seamRoute.test.mjs) so it can never silently become
 * hardcoded. Chain languages all have language cards + map nodes.
 */
export const ROUTE_EDGES = [
  {a: 'fao', b: 'dan', best_chrf: 86, clean: true},
  {a: 'dan', b: 'spa', best_chrf: 78, clean: true},
  {a: 'spa', b: 'quz', best_chrf: 44, clean: true},
  {a: 'fao', b: 'spa', best_chrf: 37, clean: true},
  {a: 'fao', b: 'eng', best_chrf: 72, clean: true},
  {a: 'eng', b: 'spa', best_chrf: 70, clean: true},
];
/** The community re-measure lifts the weak last hop (improve beat). */
export const IMPROVE_EDGE = {a: 'spa', b: 'quz', best_chrf: 71, clean: true};
/** The new measurement that lands in the reroute beat: a strong, direct
 *  English→Quechua bridge. On the grown graph the router then CONDENSES the
 *  route to fao→eng→quz, eliminating BOTH the Danish and Spanish relays
 *  (2 interlingua → 1). Chosen by LOSS: -log(.72)-log(.74) < the 3-hop path. */
export const REROUTE_EDGES = [
  {a: 'eng', b: 'quz', best_chrf: 74, clean: true},
];
/** The search's losers (traced as fizzling hop-trains on the route beat). */
export const ROUTE_LOSERS = [
  ['fao', 'spa', 'quz'],
  ['fao', 'eng', 'spa', 'quz'],
];

/**
 * THREE QUEUE RUNS COMPLETING, in Act VI. Each one IMPROVES a pair the tape
 * already measured, so the network visibly gets better because someone ran the
 * command on the card beside them.
 *
 * R8: the ring these used to travel is gone, but the DATA is unchanged and so is
 * its argument, which was never in the geometry: the runs OVERLAP (several hands
 * at once) and each `span` is SHORTER than the last (the same work getting
 * easier). Method names are the guard-tested RUNCARD vocabulary; `qNew` is
 * illustrative under the standing run-card footer and must exceed the row's
 * current q (guard-tested) — a run that improved nothing would be a lie about
 * what contributing compute does.
 *
 * @type {{row:number, method:string, qNew:number, start:number, span:number}[]}
 */
export const LOOP_LAPS = [
  {row: 21, method: 'OPUS-MT', qNew: 0.58, start: 0.04, span: 0.46}, // eng↔mos 0.15 → 0.58
  {row: 24, method: 'NLLB-200', qNew: 0.64, start: 0.3, span: 0.38}, // sat↔tel 0.27 → 0.64
  {row: 11, method: 'MADLAD-400', qNew: 0.61, start: 0.54, span: 0.31}, // rus↔abq 0.14 → 0.61
];

/**
 * Run-card vocabulary — REAL names only (guard-tested against the SSOTs):
 * methods from the coverage catalogue / model-alias / method-registry keys;
 * benchmarks that appear on real language cards. Scores stay illustrative
 * under the run-card's standing footer.
 */
export const RUNCARD = {
  methods: ['NLLB-200', 'OPUS-MT', 'claude-sonnet', 'google-translate', 'MADLAD-400'],
  benchmarks: ['Tatoeba', 'FLORES+'],
  /** the standing footer — the ONE illustrative disclosure (standard mono) */
  footer: 'illustrative demo · live scores on the leaderboard',
  /**
   * THE DEPARTURE MARKER (2026-08-19). The footer above rides the run-card,
   * which yields to the seal at ~1956vh — but the illustration runs to 2070vh,
   * so the lattice explosion and the packet flood, the most saturated image in
   * the piece, used to play with no disclosure on screen at all.
   *
   * This is the line the bottom register switches to at `endInView`: the beat
   * where the image stops being ONE PAIR BEING MEASURED and becomes THE WHOLE
   * NETWORK WORKING, which is exactly where a viewer is most likely to read the
   * picture as a claim. Founder framing 2026-08-19: the scroll demonstrates the
   * mechanism, and illustrative data belongs in it — labelled.
   */
  departure:
    'system illustration · does not represent measurements currently performed · live scores on the leaderboard',
};

/**
 * THE ONE COMMAND (Act VI) — VERBATIM from `cli/website/static/run_queue`'s own
 * usage header, guard-tested against that file so the homepage can never ship a
 * command the script does not accept.
 *
 * The script does everything the founder asked the beat to promise: it installs
 * the harness (pipx → pip --user → a private venv, no sudo), AUTO-DETECTS
 * whichever of the four keys is exported — or offers to take one interactively —
 * prints the plan and the estimated spend, asks, runs to the budget cap, and
 * publishes the results. With no tty (which is what `curl … | bash` is) it
 * publishes anonymously and says so out loud.
 *
 * `--budget` is shown rather than defaulted because the script REQUIRES a cap:
 * we never put a command on the homepage that could spend an unbounded amount
 * of someone else's money.
 */
export const RUN_QUEUE = {
  env: 'export OPENROUTER_API_KEY=sk-or-...',
  envNote: '# or ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY',
  cmd: 'curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2',
  keys: ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY'],
  /** what the script actually does — one mono line, five verbs, no adjectives */
  does: 'installs the harness · prices the plan · asks · runs · publishes',
  docs: '/docs/network/getting-started/contributing-compute',
};

/**
 * THE CLOSE — every public tool, not a selection (founder 2026-08-07: "make
 * sure all the tools are listed, not just the CLI, harness, and Atlas"). Names
 * are the ones the docs themselves use; every href is guard-tested to resolve.
 */
/* R8 (founder): the close was "a bit busy … weird spacing … could use some
 * visual hierarchy". Seven equal names in a flat 3-column grid left an orphan
 * on the last row and gave a reader no way in. They are GROUPED now, by what
 * you would come here to do — three short columns instead of one long list. */
export const CLOSE_TOOLS = [
  {group: 'USE', name: 'What is Champollion?', what: 'the whole idea, in five minutes', href: '/docs/what-is-champollion'},
  {group: 'USE', name: 'The CLI', what: 'translate · inspect · publish', href: '/docs/reference/cli'},
  {group: 'USE', name: 'The Language Atlas', what: 'every language, and what it has', href: '/languages'},
  {group: 'MEASURE', name: 'The harness', what: 'mt-eval — the benchmark runner', href: '/docs/network/specifications/harness'},
  {group: 'MEASURE', name: 'The benchmark queue', what: 'run it — anyone can', href: '/contribute'},
  {group: 'MEASURE', name: 'LYSS metrics', what: 'language-specific scoring', href: '/docs/network/specifications/scoring#4-composite-score'},
  {group: 'BUILD', name: 'nmt-forge', what: 'train and ship a model', href: '/docs/network/getting-started/forge-command-reference'},
  {group: 'BUILD', name: 'Bring a language in', what: 'a thousand curated pairs opens the door', href: '/docs/network/who-benefits#researchers'},
  {group: 'BUILD', name: 'Sovereign Eval Node', what: 'air-gapped · community keys', href: '/docs/network/sovereignty/sovereign-eval-node'},
];

/** the column order of CLOSE_TOOLS' groups (rendering reads this, not a Set) */
export const CLOSE_TOOL_GROUPS = ['USE', 'MEASURE', 'BUILD'];

/**
 * The copy-paste prompt that hands the whole contribution loop to an AI
 * agent. ONE string, shared by the homepage beta strip and /contribute —
 * it drifted apart in no time when each page owned its own copy.
 */
export const AGENT_PROMPT = `Install the Champollion mt-eval harness (pipx install mt-eval-harness).
Fetch https://champollion.dev/queue-preview.json and show me the top 3 open items
(the full work-list is at https://champollion.dev/queue.json).
Using my API key (check for OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
or GOOGLE_API_KEY — whichever I have), execute the run_command of the item I pick
with the appropriate --provider flag, then run \`mt-eval publish --anonymous --prod\`
on the generated report JSON and show me the published run card. (--prod opts in
to the live leaderboard; no account needed — drop --anonymous and sign in via
OAuth only if I want my name on the board.)`;

/**
 * BETA IS LIVE (founder go-live 2026-08-28) — the install strip rendered in
 * normal flow below the pinned seam. Data here, not in JSX (founder standard:
 * displayed strings live in the guard-tested SSOT zone). Install commands
 * mirror /for-agents and the docs verbatim; every href is an existing page.
 * champollion-lyss ships code-only under a use-by-permission license — the
 * label says so rather than implying plain open source.
 */
export const BETA_LIVE = {
  kicker: 'BETA IS LIVE',
  title: 'Everything on this page is installable today.',
  sub: 'Source-available, free for noncommercial use. Every claim cited; every score reproducible.',
  tools: [
    {name: 'Champollion CLI', what: "translate your project's locale files", cmd: 'npm install --save-dev champollion', href: '/docs/getting-started/installation'},
    {name: 'MCP server — for AI agents', what: 'the queue, atlas, and harness as agent tools', cmd: 'npx -y champollion-mcp-server', href: '/for-agents'},
    {name: 'mt-eval harness', what: 'run benchmarks, publish to the leaderboard', cmd: 'pipx install mt-eval-harness', href: '/docs/network/specifications/harness'},
    {name: 'champollion-lyss', what: 'nêhiyawêwin eval plugin · use-by-permission license', cmd: 'pip install champollion-lyss', href: '/docs/network/specifications/scoring#4-composite-score'},
  ],
};

/**
 * Numeric tokens the captions are allowed to contain — everything else is a
 * hand-typed number and the guard test fails. Derived, never listed by hand.
 */
export const ALLOWED_NUMERIC_TOKENS = [
  fmt(COVERED_LIVING),
  fmt(SERVICE_LIVING),
  ...LIVING_FLOOR_LABEL.match(/[\d,]+/g),
];

/**
 * The uniform beat cadence — where inside a window things happen.
 * @param {[number, number]} win
 * @returns {{a:number, landAt:number, lockAt:number, dwellB:number, b:number}}
 */
export function beatShape([a, b]) {
  const w = b - a;
  return {
    a,
    landAt: a + w * 0.18, // words have stitched in
    lockAt: a + w * 0.3, // the emphasis lock-and-pop
    dwellB: a + w * 0.88, // the thought has held; exit begins
    b,
  };
}

/**
 * Smooth window alpha: 0 outside [a,b], eases 1 inside, feathered at both
 * edges. Feather defaults to 18% of the window (capped) so short windows
 * still read.
 * @param {number} p progress 0..1
 */
export function winAlpha(p, a, b, feather) {
  const f = feather != null ? feather : Math.min(0.02, (b - a) * 0.18);
  if (p <= a || p >= b) return 0;
  if (p < a + f) return (p - a) / f;
  if (p > b - f) return (b - p) / f;
  return 1;
}

/**
 * The Turing-tape motion: within each row's slice of the belt window the
 * head ADVANCES for the first TAPE_ADVANCE, then DWELLS (measuring) for the
 * rest; the score locks at TAPE_LOCK_AT of the dwell. Pure in p → scrubs
 * both ways.
 * @param {number} p progress
 * @param {number} rows total tape rows
 * @returns {{offsetRows: number, headRow: number, arrived: boolean,
 *   dwellT: number, scoredCount: number, started: boolean}}
 *   offsetRows: belt translation in row units · headRow: the row under the
 *   head · arrived: head parked on it · dwellT: 0..1 through its dwell ·
 *   scoredCount: rows whose score has LOCKED (pure in p).
 */
export function tapeState(p, rows) {
  const [a] = BELT;
  if (p <= a) return {offsetRows: 0, headRow: -1, arrived: false, dwellT: 0, scoredCount: 0, started: false};
  // R6: rows come from the GEARBOX, not from linear progress — the tape rips
  // through the measure burst and eases through the route work.
  const rowFloat = Math.min(rows - 1e-6, tapeRowsAt(p, rows));
  const i = Math.floor(rowFloat);
  const frac = rowFloat - i;
  const move = Math.min(1, frac / TAPE_ADVANCE);
  const dwellT = move >= 1 ? (frac - TAPE_ADVANCE) / (1 - TAPE_ADVANCE) : 0;
  const scoredCount = i + (dwellT >= TAPE_LOCK_AT ? 1 : 0);
  return {offsetRows: i + move, headRow: i, arrived: move >= 1, dwellT, scoredCount, started: true};
}
