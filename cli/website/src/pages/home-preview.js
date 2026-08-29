import React, {useEffect, useRef, useState} from 'react';
import Head from '@docusaurus/Head';
import {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import GraphHero from '../components/GraphHero';
import BrandMark from '../components/BrandMark';
import HubColumn from '../components/seam/HubColumn';
import ZipperQueue from '../components/seam/ZipperQueue';
import RunCard from '../components/seam/RunCard';
import ChainPanel from '../components/seam/ChainPanel';
import CommandCard from '../components/seam/CommandCard';
import {bestMeasuredChain, hopsFromNodes, buildEdgeIndex} from '../utils/meshChains.js';
import {playLockPop, TONES} from '../utils/lockPop.mjs';
import {QUALITY, qualitySpectrum} from '../utils/qualityColors.mjs';
import {SEAL_MAIN, SEAL_NAMES, SEAL_CAVEAT, SEAL_CODE, SEAL_DATASET} from '../utils/metricPops.mjs';
import {metricsFor, benchmarkLine} from '../utils/seamRuns.mjs';
import {COMMUNITY_PROJECTS} from '../utils/communityProjects.mjs';
import {lensTarget} from '../utils/seamMetrics.mjs';
import {
  STORY,
  STORY_PAIRS,
  RUNCARD,
  BELT,
  WIN,
  SCROLL_VH,
  SCROLL_VH_MOBILE,
  TAPE_LOCK_AT,
  tapeState,
  rowLockAt,
  winAlpha,
  ROUTE_EDGES,
  IMPROVE_EDGE,
  REROUTE_EDGES,
  ROUTE_LOSERS,
  LOOP_LAPS,
  CLOSE_TOOLS,
  CLOSE_TOOL_GROUPS,
  RUN_QUEUE,
  BETA_LIVE,
  AGENT_PROMPT,
} from '../utils/seamStory.mjs';
import styles from './home-preview.module.css';

/**
 * /home-preview — THE FULL STORY seam V2 · refinement pass R1
 * (founder script 2026-07-22 + feedback 2026-07-22b).
 *
 * What R1 changed (see seamStory.mjs for the narrative SSOT):
 *   · the zipper is a TURING-TAPE head: advance → dwell → measure (run-card
 *     with pair · method · benchmark · rolling metrics) → score locks →
 *     the pair THREADS onto the map — and it keeps stepping to the close;
 *   · PULSES over lines: omnimodels receive language pulses and send
 *     signals back (mostly below their own bar — Meta's §1 arithmetic);
 *     routes are traced by pulse trains, never dotted rails;
 *   · the field opens WHITE (dots = languages), then GREEN sweeps the
 *     covered, then RED sweeps the gap — waves lead the words;
 *   · the tail is visual: the community re-measure on the tape, the
 *     endonym flurry (variety shown, not asserted), the sovereign seal.
 *
 * Honesty rails unchanged (CLAIMS.md): SSOT-served numbers, real metric /
 * method / benchmark names, the run-card's standing illustrative footer,
 * teal = aim vs spectrum = measured, st/mask never touched. Live / stays V1.
 * Dev handle: window.__SEAM (drive · tick(t, manual) · gsap for the verify
 * harness — hidden panes pause rAF).
 */

const PF2 = 1.06; // GraphEngine front-layer parallax (PF[2])
const ROWS = STORY_PAIRS.length;

// The "map the network" band: from the gearbox burst through the settle, where
// the network ignites — edges brighten, coloured test-packets flood between
// pairs reflecting the tape's measurements — and then, at lowestLoss, the
// traffic NARROWS to the route + the head pair. R7: it lives in the LAYOUT_VH
// table with every other window, so it cannot drift off the beats it belongs to.
const MAP_BAND = WIN.mapBand;

// ── THE NETWORK LATTICE (R6) ───────────────────────────────────────────────
// The map beat used to draw ONE edge per tape row (~24 lines) — a trickle, not
// a network. Now the map beat DRAWS THE NETWORK ITSELF: hundreds of REAL pairs
// (engine.buildBinaryRoutes(), 771 available) stroke on in sequence across the
// Earth, and then MEASUREMENT sweeps through and lights them up.
//
// An edge starts SLATE (unmeasured — slate is never a quality colour) and is
// interpolated toward its quality colour as the tape's row count passes it, so
// the flood on the map is literally the zipper's own progress. Its illustrative
// per-edge quality rides the standing run-card disclosure like every other
// score in the seam.
const LATTICE_RGB = [104, 132, 156]; // slate — the unmeasured state
const LATTICE_MAX = 320; // desktop budget through the story (≤771 available)
const LATTICE_MAX_MOBILE = 120;
// R8 — the FINALE budget. The end-in-view beat's whole claim is that the network
// is mapped, so it grows rather than fading. Sampled up-front and held in
// reserve; see resolveStory. These are the perf knobs if the frame budget bites.
const LATTICE_END = 520;
const LATTICE_END_MOBILE = 190;
// the window over which the lattice strokes itself on, and the per-edge stagger
const LATTICE_DRAW = WIN.latticeDraw; // the "we map the whole network" beat
// fraction of the window spent starting new edges. 0.4 (was 0.6) so the whole
// story budget is under way while `mapNetwork` is still on screen — see the
// latticeDraw note in seamStory.mjs.
const LATTICE_STAGGER = 0.4;
// a deterministic spread of illustrative qualities for the ignition — coprime
// length with the edge count so neighbouring edges never share a colour run.
const LATTICE_Q = [0.71, 0.34, 0.58, 0.22, 0.83, 0.46, 0.29, 0.66, 0.15, 0.52, 0.77, 0.39, 0.61];

// ── ACT VI mechanism window ────────────────────────────────────────────────
// The command card owns oneCommand AND spills into shareIt, so the queue runs it
// starts land ON the shareIt caption. (R8: the `askIt` beat and its Answer Card
// were deleted — founder: "out of context and just adding too much".)
const CMD_WIN = [WIN.oneCommand[0], WIN.shareIt[1]];

/* ── THE REGISTER'S THREE STATES ───────────────────────────────────────────
 * The bottom band (the hero's coverage legend yields the whole pin to it).
 * Pure in p, like every other seam surface — the state is a lookup, never a
 * fired-once side effect, so a scrub backwards restores the right line.
 *
 * The point of the third state: the standing footer rides the RUN-CARD, and
 * the run-card yields to the seal at ~1956vh while the illustration runs to
 * 2070 — 114vh of lattice explosion and packet flood with nothing on screen
 * saying it is an illustration. That is where a viewer is most likely to read
 * the picture as a claim about measurements performed.
 *
 * Ordered latest-first; `registerState` returns the first window that contains
 * p, so the finale's marker wins over the footer where they touch. */
const REGISTER_STATES = [
  {id: 'departure', from: WIN.endInView[0], to: 1, text: RUNCARD.departure},
  {id: 'illustrative', from: WIN.zipIn[0], to: WIN.endInView[0], text: RUNCARD.footer,
   href: '/leaderboard'},
  {id: 'coverage', from: 0, to: WIN.zipIn[0],
   text: 'Bright green: a deployed service · Dim green: open research model only · Red: no machine translation',
   href: '/growth'},
];
const registerState = (p) => REGISTER_STATES.find((r) => p >= r.from && p < r.to) || REGISTER_STATES[2];

/** A DOM instrument's CLIENT point → engine WORLD coords at the packet layer,
 *  so a card can launch a REAL packet onto the map (engine wx/wy inverse). */
const worldFromClient = (e, cx, cy) => {
  if (!e || !e.fx || typeof e.wx !== 'function') return null;
  const r = e.fx.getBoundingClientRect();
  if (!r.width) return null;
  return [e.wx(cx - r.left, 2), e.wy(cy - r.top, 2)];
};

const TONE_RGB = {teal: '77, 216, 255', red: TONES.red, green: TONES.green, amber: TONES.amber};
const TONE_HEX = {teal: '#4dd8ff', red: QUALITY.bad.hex, green: QUALITY.good.hex, amber: '#e8b339'};
const TEAL = [77, 216, 255];

// The routing demo edge-graph (ROUTE_EDGES / IMPROVE_EDGE / REROUTE_EDGES /
// ROUTE_LOSERS) is the seam's narrative SSOT — see seamStory.mjs, guard-tested
// in seamRoute.test.mjs so the router flip (fao→dan→spa→quz  ⇒  fao→eng→quz,
// dan+spa eliminated) is REAL, never hardcoded.

// Beat 13 — "…to Zambales": the Ayta cluster (real cards; abo is Nigeria — never).
const ZAMBALES_CLUSTER = ['sbl', 'ayt', 'abp', 'xsb'];

/* The two communities-beat captions, as viewport boxes the project labels must
 * keep out of. Derived from those beats' own `pos` so the zones cannot drift
 * away from the words they protect: the caption is centred on pos and capped at
 * min(84vw, 560px), which is ~44% of a 1280px stage — half-width ~22%, plus a
 * little air. Heights are the two- and three-line cases. */
const capZone = (id, halfH) => {
  const beat = STORY.find((s) => s.id === id);
  const [cx, cy] = beat ? beat.pos : [50, 50];
  return {x0: cx - 25, x1: cx + 25, y0: cy - halfH, y1: cy + halfH};
};
const WIN_COMM_CAPS = [capZone('communities', 8), capZone('communityWork', 8)];

// (The Meta pull-quote is now an inline citation inside the notWorking caption —
// VERBATIM string lives on that beat in seamStory.mjs; verified arXiv:2603.16309 §1.)

// The chain-panel bridge pairs that are ALSO tape rows — driven live from the
// same tapeState so the chain, zipper, and map stay in lock-step. The reroute
// bridges (fao↔eng, eng↔quz) are tape rows 17–18, so they roll + lock as the
// tape measures them, right as the chain condenses.
const CHAIN_BRIDGE_PAIRS = [['fao', 'dan'], ['dan', 'spa'], ['spa', 'quz'], ['fao', 'eng'], ['eng', 'quz']];
const qKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
// the method a row was measured with — named on the story rows (so "a new method
// dropped" is legible), positional rotation elsewhere.
const methodOf = (pair, i) => pair.method || RUNCARD.methods[i % RUNCARD.methods.length];

// split the seal's headline (e.g. "chrF++ 81") into name + value for its
// run-card row — SSOT-derived (metricPops), never hand-typed.
const SEAL_HERO_NAME = SEAL_MAIN.replace(/\s+\S+$/, '');
const SEAL_HERO_VAL = SEAL_MAIN.slice(SEAL_HERO_NAME.length).trim();

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (k) => {
  const t = clamp01(k);
  return t * t * (3 - 2 * t);
};
const local = (p, [a, b]) => clamp01((p - a) / (b - a));
const lerpKF = (A, B, t) => ({x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t});
// deterministic 0..1 hash — the run-card's rolling wobble must scrub the same
const dHash = (a, b, c) => {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

// Tape timing (pure in p): where row i's score LOCKS on the scroll.
// R7 — this used to be a LINEAR slice of the belt, left behind when the tape
// moved onto the gearbox in R6. The tape ripped through the measure burst while
// every instrument keyed to a row still believed rows arrived evenly, so the map
// revealed on a different clock than the head, the chain's coaching correction
// landed ~2 beats late, and the route's 2→1 condense fired after its own panel
// had faded. rowLockAt inverts the gearbox, so there is now ONE clock.
const lockP = (i) => rowLockAt(i, ROWS);

// per-lens illustrative targets from a pair's q live in seamMetrics (shared
// with the chain panel's bridge run-cards), so a measurement reads the same
// everywhere. Which lenses a pair shows is decided by seamRuns (metricsFor).

// caption HTML: main line (split target) + optional asterisk method-doc link
const capHtml = (c) => {
  const tone = TONE_HEX[c.tone] || TONE_HEX.teal;
  const emphify = (str) =>
    (c.emph && str.includes(c.emph)
      ? str.replace(c.emph, `<b class="${styles.capEmph}" data-pop style="--capTone:${tone}">${c.emph}</b>`)
      : str);
  /* R8 — a beat may declare its own LINE BREAKS (founder: "make sure the line
   * breaks are better than what's there now"). Each line becomes its own BLOCK
   * inside the split target, so the break is structural markup: SplitText
   * preserves nested elements and splits words within them — the same mechanism
   * the emphasis <b> has always relied on — and if SplitText fails to load at
   * all the break still renders. `text` stays the intact sentence every guard
   * reads and the reduced-motion article prints. */
  const main = c.lines && c.lines.length
    ? c.lines.map((ln) => `<span class="${styles.capLine}">${emphify(ln)}</span>`).join('')
    : emphify(c.text);
  let h = main ? `<span data-main>${main}</span>` : '';
  if (c.sub) h += `<span class="${styles.capSub}">${c.sub}</span>`;
  // an inline citation woven into the essay (e.g. the Meta quote) — the
  // caption's own voice, italic + attributed, not a detached card.
  if (c.quote) {
    h +=
      `<span class="${styles.capQuote}">${c.quote.text}` +
      `<span class="${styles.capQuoteCite}">— <a href="${c.quote.href}" target="_blank" rel="noopener noreferrer">${c.quote.cite}</a></span></span>`;
  }
  // R7: a full-screen quote beat carries its attribution UNDER the sentence —
  // the source is the whole point of the beat, so it is named, not asterisked.
  if (c.cite) {
    h +=
      `<span class="${styles.capCite}">— ` +
      `<a href="${c.cite.href}" target="_blank" rel="noopener noreferrer">${c.cite.label}</a></span>`;
  }
  /* R8 (founder 2026-08-07): "all of the cards with an asterisk have this weird
   * asterisk at the bottom, and don't clearly link to any kind of estimate
   * methods doc … many of the cards without a citation still have that weird
   * asterisk."
   *
   * Both halves were the same mistake. R2 rendered every footnote as a BARE
   * linked `*` with the label hidden in the title attribute — so a reader saw a
   * floating glyph, learned nothing, and had no reason to click. And the same
   * mechanism was being used for links that cite nothing ("submit a method"),
   * where the asterisk promised a source that did not exist.
   *
   * Now the two are different things. A FOOTNOTE cites a figure: it keeps the
   * asterisk, because the caption carries a matching inline `*` on the number
   * it belongs to, and it names the doc it opens. A LINK is further reading:
   * labelled, arrowed, and never asterisked. */
  if (c.footnote) {
    h +=
      `<span class="${styles.capNote}">` +
      `<a href="${c.footnote.href}"><span class="${styles.capNoteStar}">*</span>${c.footnote.label}</a>` +
      `</span>`;
  }
  if (c.link) {
    h += `<span class="${styles.capLink}"><a href="${c.link.href}">${c.link.label} →</a></span>`;
  }
  return h;
};

/**
 * FullStorySeam — the full-story scroll. Rendered as the live homepage (/) with
 * `indexable` + the mission SEO, and (unchanged) at /home-preview as an
 * unlinked, noindex preview. The page default export below is the preview.
 */
/**
 * Hero copy through code.json — the ids and their locale translations existed
 * all along (i18n/<locale>/code.json, homepage.v4.hero.*), but these call
 * sites passed raw English literals, so every locale rendered English
 * (founder, launch night 2026-08-28: "the hero isn't actually translated").
 * translate() resolves per-locale at build time; `message` is the en base.
 */
function heroCopy() {
  return {
    eyebrow: translate({
      id: 'homepage.v4.hero.eyebrow',
      message: 'THE CHAMPOLLION PROJECT',
      description: 'Eyebrow over the homepage network hero',
    }),
    title: translate({
      id: 'homepage.v4.hero.title',
      message: 'Every language, into every language.',
      description: 'Homepage hero headline (the mission)',
    }),
    subline: translate({
      id: 'homepage.v4.hero.subline',
      message: 'Open machine translation support for at risk, endangered, and underserved languages.',
      description: 'Homepage hero subline (founder wording 2026-07-19): names the mission\u2019s beneficiaries \u2014 at-risk, endangered, and underserved languages \u2014 over the binary covered/uncovered map.',
    }),
    pledge: translate({
      id: 'homepage.v4.hero.pledge',
      message: 'non-commercial \u00b7 source-available \u00b7 communities hold the keys',
      description: 'Homepage hero pledge micro-line under the stat (non-commercial promise + sovereignty)',
    }),
  };
}

export function FullStorySeam({
  indexable = false,
  seoTitle = 'Home preview — the full story',
  seoDescription = 'Full-story seam preview (unlinked).',
} = {}) {
  const regionRef = useRef(null);
  const pinRef = useRef(null);
  const labelRef = useRef(null);
  const capRefs = useRef([]);
  const backdropRef = useRef(null);
  const closeRef = useRef(null);
  const closeTitleRef = useRef(null);
  const sealRef = useRef(null);
  const sealTitleRef = useRef(null);
  const projWrapRef = useRef(null); // R7 — the communities beat's linked names
  const zipRef = useRef(null);
  const hubRef = useRef(null);
  const hubColWrapRef = useRef(null);
  const runRef = useRef(null);
  const chainRef = useRef(null);
  const cmdRef = useRef(null); // Act VI — the you-turn: the one command
  const registerRef = useRef(null); // the honesty slot (see REGISTER_STATES)
  const progressRef = useRef(0);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  // Beat readout for the verify harness — never on for a visitor. Set from the
  // client only, so the server render and the first client render agree.
  const [seamDebug, setSeamDebug] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    setMobile(window.innerWidth < 640);
    /* `mobile` used to be sampled ONCE on mount, so a rotate kept the runway
     * (SCROLL_VH vs SCROLL_VH_MOBILE) and the instrument mounts from the first
     * orientation while the engine's own fit() moved on. matchMedia keeps the
     * React side in step; ScrollTrigger is refreshed by the existing resize
     * handler further down. */
    const mqW = window.matchMedia('(max-width: 639px)');
    const onW = () => setMobile(mqW.matches);
    setMobile(mqW.matches);
    mqW.addEventListener('change', onW);
    setSeamDebug(
      window.__SEAM_DEBUG === true ||
        new URLSearchParams(window.location.search).get('seam') === '1',
    );
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener('change', onMq);
    return () => {
      mq.removeEventListener('change', onMq);
      mqW.removeEventListener('change', onW);
    };
  }, []);

  // R4: float the navbar + drop the announcement bar so the pinned region
  // starts at scrollY 0 — the scroll plays the animation without first shifting
  // the page down by the chrome height. Applies in both motion + reduced modes.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.setAttribute('data-seam-top', '');
    return () => {
      document.documentElement.removeAttribute('data-seam-top');
      document.documentElement.removeAttribute('data-seam-chain');
    };
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    let mounted = true;
    let ctx = null;
    let rafId = 0;

    // ── resolved-once story state (engine-dependent) ──
    const s = {
      resolved: false,
      route: null, // {seq, nodes, hopCols, losers, frame} — the base winner
      routeReroute: null, // {seq, nodes, hopCols} — the Stage-B winner (fao→eng→quz)
      routeImprovedCols: null, // hop colours after the community re-measure
      tape: null, // per-row {ai, bi, q, rgb, hex, tintEnds, pair}
      cluster: null,
      meshPairs: null,
      lattice: null, // the CLAIMED coverage lattice — stable array, mutated in place
      quz: -1,
      spa: -1,
      quy: -1,
      eng: -1,
      projects: null, // [{…project, idx:[node…], el}] the communities roster
      projBuilt: false,
      latBase: 0, // how many lattice edges the STORY shows (the rest is the finale reserve)
    };
    const fired = {
      caps: [],
      capTl: [],
      splits: [],
      capWords: [],
      lockedRows: 0, // how many tape rows we've applied lock effects for
      sends: new Array(7).fill(false),
      lastHeadRow: -1,
      route: {direct: false, losers: false, winnerAt: 0},
      creeDemo: false,
      chainImproved: false, // the coaching correction (fire-once)
      chainRerouted: false, // dan+spa collapse → route re-forms (fire-once)
      rerouteWinnerAt: 0, // last time the Stage-B train launched
      bridgeLocks: [], // R8 — per story-row bridge lock-and-pop (fire-once by row)
      // ── Act VI (R8) — every one has an explicit reset-below in drive/tick ──
      runScore: [false, false, false], // per queue-run score lock
      cmdInstall: [false, false, false], // per queue-run thread → map
      cmdRoute: [false, false, false], // per queue-run "others route through it"
    };
    // HOP-TRAINS (R2): the one grammar for multi-hop travel — a packet
    // crosses hop k, lands (engine ring), dwells at the pivot (the relay
    // moment), then hop k+1 launches, coloured by ITS measured quality.
    const trains = []; // {chain:[idx…], cols:[[r,g,b]…], hop, nextAt, dieAt?, fast?}
    let lastTraffic = 0;
    let lastFail = 0;
    let lastPairPulse = 0;
    let lastFill = 0;
    let lastChain = 0;
    let chainHop = 0;
    let lastPayoff = 0;
    let lastFlood = 0;
    let lastEndFlood = 0; // R8 — the finale's own cadence clock

    (async () => {
      const [gmod, stmod, splitMod] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/SplitText').catch(() => null),
        typeof document !== 'undefined' && document.fonts && document.fonts.ready
          ? document.fonts.ready.catch(() => null)
          : Promise.resolve(null),
      ]);
      if (!mounted) return;
      const gsap = gmod.gsap || gmod.default;
      const ScrollTrigger = stmod.ScrollTrigger || stmod.default;
      const SplitText = splitMod ? splitMod.SplitText || splitMod.default : null;
      gsap.registerPlugin(ScrollTrigger);
      if (SplitText) gsap.registerPlugin(SplitText);
      ScrollTrigger.config({ignoreMobileResize: true});

      // ── the flying words (R2 root fix) ──
      // Split ONCE (after fonts) and IMMEDIATELY park every word in its
      // hidden pre-flight state (evens above, odds below). Previously words
      // rested VISIBLE, so any trigger hiccup showed pre-formed text — the
      // founder's "the text doesn't fly" bug. Now the zip-in is structural:
      // a caption can only appear by flying in.
      const PRE_EVEN = {y: '-0.55em', opacity: 0};
      const PRE_ODD = {y: '0.55em', opacity: 0};
      const splitUnit = (el) => {
        if (!el || !SplitText) return null;
        try {
          const sp = new SplitText(el, {type: 'words', wordsClass: styles.splitWord, aria: 'auto'});
          if (!sp.words || sp.words.length < 2) {
            sp.revert();
            return null;
          }
          fired.splits.push(sp);
          const unit = {
            evens: sp.words.filter((_, k) => k % 2 === 0),
            odds: sp.words.filter((_, k) => k % 2 === 1),
          };
          gsap.set(unit.evens, PRE_EVEN);
          gsap.set(unit.odds, PRE_ODD);
          return unit;
        } catch (err) {
          return null;
        }
      };
      STORY.forEach((c, i) => {
        const el = capRefs.current[i];
        if (!el) return;
        el.innerHTML = capHtml(c);
        fired.capWords[i] = splitUnit(el.querySelector('[data-main]'));
      });

      // the established stitchIn look, triggered, at a readable pace:
      // words drop/rise home over ~0.75s with the back.out snap, then the
      // emphasis phrase gets the house lock-and-pop.
      const flyWords = (unit, el, onLandPop) => {
        const tl = gsap.timeline();
        if (unit) {
          tl.fromTo(unit.evens, PRE_EVEN, {y: 0, opacity: 1, duration: 0.16, stagger: {amount: 0.6, from: 'start'}, ease: 'back.out(1.7)'}, 0);
          tl.fromTo(unit.odds, PRE_ODD, {y: 0, opacity: 1, duration: 0.16, stagger: {amount: 0.6, from: 'start'}, ease: 'back.out(1.7)'}, 0);
        } else if (el) {
          tl.fromTo(el, {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 0.5, ease: 'power2.out'}, 0);
        }
        if (onLandPop) tl.add(onLandPop, 1.0);
        return tl;
      };
      const parkWords = (unit, el) => {
        if (unit) {
          gsap.set(unit.evens, PRE_EVEN);
          gsap.set(unit.odds, PRE_ODD);
        } else if (el) {
          gsap.set(el, {opacity: 0, y: 14});
        }
      };

      const playCaption = (i) => {
        const el = capRefs.current[i];
        const c = STORY[i];
        if (!el || !c) return;
        if (fired.capTl[i]) fired.capTl[i].kill();
        const pop = el.querySelector('[data-pop]');
        fired.capTl[i] = flyWords(fired.capWords[i], el.querySelector('[data-main]'), pop && c.emph
          ? () => playLockPop(gsap, pop, {rgb: TONE_RGB[c.tone] || TONE_RGB.teal, breathe: false})
          : null);
      };
      const resetCaption = (i) => {
        const el = capRefs.current[i];
        if (!el) return;
        if (fired.capTl[i]) {
          fired.capTl[i].kill();
          fired.capTl[i] = null;
        }
        parkWords(fired.capWords[i], el.querySelector('[data-main]'));
        const pop = el.querySelector('[data-pop]');
        if (pop) gsap.set(pop, {scale: 1, filter: 'none'});
      };

      // the same treatment for the page's other free-floating copy: the seal
      // title and the close title fly in too (founder: ALL floating copy).
      const extraZips = [
        {ref: sealTitleRef, win: [WIN.rights[0] + 0.002, WIN.rights[1] + 0.004], unit: null, tl: null, on: false},
        {ref: closeTitleRef, win: [WIN.close[0], 1.01], unit: null, tl: null, on: false},
      ];
      extraZips.forEach((z) => {
        z.unit = splitUnit(z.ref.current);
      });
      fired.extraZips = extraZips; // for teardown
      const driveExtraZips = (p) => {
        extraZips.forEach((z) => {
          const al = winAlpha(p, z.win[0], Math.min(1, z.win[1]), 0.004) || (p >= z.win[0] && z.win[1] > 1 ? 1 : 0);
          if (al > 0.05 && !z.on) {
            z.on = true;
            if (z.tl) z.tl.kill();
            z.tl = flyWords(z.unit, z.ref.current, null);
          } else if (al <= 0.02 && z.on) {
            z.on = false;
            if (z.tl) {
              z.tl.kill();
              z.tl = null;
            }
            parkWords(z.unit, z.ref.current);
          }
        });
      };

      // ── resolve the engine-dependent story once ──
      const resolveStory = (e) => {
        if (s.resolved || !e || !e.idxByCode || !e.w || !e.home) return;
        const ci = (c) => (e.idxByCode.has(c) ? e.idxByCode.get(c) : -1);

        const winner = bestMeasuredChain(ROUTE_EDGES, 'fao', 'quz');
        if (winner && winner.nodes.every((c) => ci(c) >= 0)) {
          const idx = buildEdgeIndex(ROUTE_EDGES);
          const hopQ = (nodes) => hopsFromNodes(nodes, idx).map((h) => h.quality || 0);
          const hopCols = hopQ(winner.nodes).map((q) => qualitySpectrum(q).rgb);
          const seq = winner.nodes.map(ci);
          // the search's LOSERS, as hop-trains: each fizzles just past its
          // weakest hop (search pruning, made visible)
          const losers = ROUTE_LOSERS.filter(
            (path) => path.every((c) => ci(c) >= 0) && path.join() !== winner.nodes.join(),
          ).map((path) => {
            const qs = hopQ(path);
            let weak = 0;
            qs.forEach((q, k) => {
              if (q < qs[weak]) weak = k;
            });
            return {seq: path.map(ci), cols: qs.map((q) => qualitySpectrum(q).rgb), dieAt: weak + 1};
          });
          // the reroute winner — computed on the GROWN edge graph (improve +
          // the new bridges). The router genuinely flips to fao→eng→quz,
          // eliminating dan+spa (Stage B). Never hardcoded — guard-tested.
          const rerouteEdges = [
            ...ROUTE_EDGES.map((ed) => (ed.a === 'spa' && ed.b === 'quz' ? IMPROVE_EDGE : ed)),
            ...REROUTE_EDGES,
          ];
          const rerouteWin = bestMeasuredChain(rerouteEdges, 'fao', 'quz');
          if (rerouteWin && rerouteWin.nodes.every((c) => ci(c) >= 0)) {
            const ridx = buildEdgeIndex(rerouteEdges);
            const rq = hopsFromNodes(rerouteWin.nodes, ridx).map((h) => h.quality || 0);
            s.routeReroute = {
              nodes: rerouteWin.nodes,
              seq: rerouteWin.nodes.map(ci),
              hopCols: rq.map((q) => qualitySpectrum(q).rgb),
            };
          }
          // the improved route: same road, its weak last hop lifted to 0.71.
          const improveIdx = buildEdgeIndex([
            ...ROUTE_EDGES.map((ed) => (ed.a === 'spa' && ed.b === 'quz' ? IMPROVE_EDGE : ed)),
          ]);
          s.routeImprovedCols = hopsFromNodes(winner.nodes, improveIdx).map((h) => qualitySpectrum(h.quality || 0).rgb);

          // The BRIDGE frame covers the WHOLE living route (base ∪ reroute
          // nodes) so the camera holds the whole story and the pivot lands in
          // view. R6: store only the NODE SEQUENCE — applyCamera derives the
          // frame from live e.w/e.h every frame. Freezing the computed frame
          // here was the same defect class as the frozen HOME (a resize after
          // resolveStory left the bridge camera framed for the old canvas).
          s.route = {
            seq,
            nodes: winner.nodes,
            hopCols,
            losers,
            frameSeq: [...new Set([...seq, ...(s.routeReroute ? s.routeReroute.seq : [])])],
          };
        }
        s.quy = ci('quy');
        s.eng = ci('eng');
        s.quz = ci('quz');
        s.spa = ci('spa');

        // the tape (row order = STORY_PAIRS order — the SSOT)
        s.tape = STORY_PAIRS.map((pr, i) => {
          const ai = ci(pr.a);
          const bi = ci(pr.b);
          const spec = qualitySpectrum(pr.q);
          return {
            i,
            pair: pr,
            ai,
            bi,
            ok: ai >= 0 && bi >= 0,
            rgb: spec.rgb,
            hex: spec.hex,
            tintEnds: ai >= 0 && bi >= 0 ? [ai, bi].filter((n) => e.st[n] === 0 && e.liv[n]) : [],
          };
        });

        s.cluster = ZAMBALES_CLUSTER.map(ci).filter((n) => n >= 0);

        /* R7 — the communities beat's roster. Each project resolves to the map
         * nodes for the languages its OWN published work covers; a code with no
         * node is silently dropped rather than faked. A project that resolves to
         * nothing is not shown at all — we would rather under-populate this beat
         * than point a label at a language that isn't there. */
        s.projects = COMMUNITY_PROJECTS.map((pj) => ({
          ...pj,
          idx: pj.langs.map(ci).filter((n) => n >= 0),
        })).filter((pj) => pj.idx.length);

        const routes = typeof e.buildBinaryRoutes === 'function' ? e.buildBinaryRoutes() : [];
        if (routes.length) {
          const stride = Math.max(1, Math.floor(routes.length / 56));
          const pairs = [];
          for (let k = 0; k < routes.length && pairs.length < 56; k += stride) pairs.push(routes[k]);
          s.meshPairs = pairs;

          // THE CLAIMED LATTICE — built ONCE, here. The array (and every edge
          // object in it) is stable for the life of the page: drive() mutates
          // each edge's `reveal` IN PLACE and hands the engine the same array
          // reference every frame, so the network costs zero per-frame
          // allocation. Deterministic sample → scrubs identically.
          //
          // R8 (founder): "most of the network lines fade going into this slide,
          // but they should be EXPLODING in number instead". So we sample the
          // GROWN budget here and then reorder it low-discrepancy, which is what
          // lets drive() show a PREFIX of `latBase` edges for the whole story and
          // grow to the full array at the finale — without re-sampling,
          // re-sorting or allocating anything per frame. Any prefix of a
          // golden-ratio permutation is still spread across the whole Earth, so
          // the story's 320 edges look like a world map and the finale's 520
          // look like the same map, denser.
          const slow = typeof window !== 'undefined' && window.__GRAPH_STATS && window.__GRAPH_STATS.avgFrameMs > 24;
          let base = e.mobile ? LATTICE_MAX_MOBILE : LATTICE_MAX;
          let grown = e.mobile ? LATTICE_END_MOBILE : LATTICE_END;
          if (slow) {
            base = Math.floor(base / 2); // the one degrade knob
            grown = Math.floor(grown / 2);
          }
          const lStride = Math.max(1, Math.floor(routes.length / grown));
          const lat = [];
          for (let k = 0; k < routes.length && lat.length < grown; k += lStride) {
            const [ai, bi] = routes[k];
            if (ai == null || bi == null || ai === bi) continue;
            lat.push({
              a: {idx: ai},
              b: {idx: bi},
              rgb: LATTICE_RGB, // shared reference — one sprite-cache entry
              alpha: 0.17,
              width: 0.7,
              reveal: 0,
            });
          }
          // decorated sort (never indexOf in a comparator — that is O(n²))
          s.lattice = lat
            .map((ed, k) => ({ed, r: (k * 0.618033988749895) % 1}))
            .sort((A, B) => A.r - B.r)
            .map((d) => d.ed);
          s.latBase = Math.min(base, s.lattice.length);
        }

        // engine hub bits (real per-method source sampling for the omni pulses)

        s.resolved = true;
      };

      /* R7 — the communities beat's LINKED project names, built once at the HOME
       * camera (the camera holds HOME for the whole beat, so screen positions
       * stay valid). Each name is an anchor to the project's OWN site or paper:
       * the founder's rule is that the repo is our record, not our proof, so the
       * citation must be reachable in one click.
       *
       * Placement is the centroid of the project's own language nodes, nudged to
       * avoid collisions. If two projects genuinely overlap on the map the later
       * one steps down rather than stacking — a name that can't be read is worse
       * than one that sits slightly off its cluster. */
      const buildProjects = (e) => {
        if (s.projBuilt || !s.projects || !projWrapRef.current) return;
        const wrap = projWrapRef.current;
        const placed = [];
        /* R8 — build the elements FIRST, then place them, because placement
         * needs each label's real width. The previous pass compared centres
         * against a fixed 19% threshold, which is meaningless when the labels
         * run from "EdTeKLA" to "FLORES+ · Open Language Data Initiative": two
         * wide names 20% apart still printed on top of each other. One layout
         * read per label, before anything is positioned — no thrash. */
        const nodes = s.projects.map((pj) => {
          const a = document.createElement('a');
          a.className = styles.project;
          a.href = pj.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.opacity = '0';
          a.style.left = '-999px';
          const name = document.createElement('span');
          name.className = styles.projectName;
          name.textContent = pj.name;
          const kind = document.createElement('span');
          kind.className = styles.projectKind;
          kind.textContent = pj.kind;
          a.append(name, kind);
          wrap.appendChild(a);
          return a;
        });
        const halfW = nodes.map((a) => (a.getBoundingClientRect().width / (e.w || window.innerWidth)) * 50 + 1);

        /* Place the WIDEST labels first. Greedy placement is order-sensitive:
         * whichever wide name goes last finds every slot around its centroid
         * already taken and has to fall back on top of a neighbour. Hardest
         * first, narrow ones fill the gaps — deterministic (width, then index,
         * so ties never depend on sort stability). */
        const order = s.projects
          .map((_, i) => i)
          .sort((a, b) => halfW[b] - halfW[a] || a - b);

        order.forEach((k) => {
          const pj = s.projects[k];
          let sx = 0;
          let sy = 0;
          /* Each node at its OWN depth band — a hardcoded band 2 put the
           * centroid off the cluster it labels whenever the project's
           * languages were uncovered (uncovered nodes spread across bands).
           * That was the real fault behind "these shared task cards are not
           * well placed"; collision search cannot fix a wrong centroid. */
          pj.idx.forEach((n) => {
            const nl = e.layer ? e.layer[n] : 2;
            sx += clamp01(e.sx(e.xs[n], nl) / e.w) * 100;
            sy += clamp01(e.sy(e.ys[n], nl) / e.h) * 100;
          });
          const x0 = Math.min(84, Math.max(9, sx / pj.idx.length));
          const y0 = Math.min(80, Math.max(14, sy / pj.idx.length));
          /* R8 (founder): "these shared task cards are not well placed". Two
           * faults. They avoided each other but not the WORDS, so Gamayun ·
           * CLEAR Global sat straight through "Dictionaries. Grammars. Small
           * models…". And the escape was a one-way nudge DOWN against a clamp:
           * once a label hit the floor it stopped moving and simply overlapped
           * whatever was there — which is why FLORES+ and OPUS · Tatoeba ended
           * up printed on top of each other, and on the hero's legend.
           *
           * Now it SEARCHES: candidate offsets alternating below and above the
           * cluster centroid, first one clear of the captions, the other labels
           * and the bottom legend band wins. Deterministic, so it renders the
           * same every load. */
          const hw = halfW[k];
          const clashes = (cx, cy) => {
            if (cy < 12 || cy > 82) return true; // legend + navbar bands
            if (cx - hw < 2 || cx + hw > 98) return true; // off-stage
            for (const z of WIN_COMM_CAPS) {
              if (cx + hw > z.x0 && cx - hw < z.x1 && cy > z.y0 && cy < z.y1) return true;
            }
            // real half-widths on BOTH sides — the only honest overlap test
            return placed.some((q) => Math.abs(q.x - cx) < q.hw + hw && Math.abs(q.y - cy) < 6.5);
          };
          /* Search in BOTH axes, nearest-first. A wide label at the centroid of
           * a global corpus (FLORES+ covers 200 languages, so its centroid is
           * simply the middle of the map) has no free row beneath it — it needs
           * to be able to step sideways too. Deterministic order → same layout
           * every load. */
          let x = x0;
          let y = y0;
          if (clashes(x, y)) {
            const CANDS = [];
            for (const dy of [0, 6, -6, 12, -12, 18, -18, 24, -24, 30, -30, 38, -38]) {
              for (const dx of [0, 10, -10, 20, -20, 30, -30]) CANDS.push([dx, dy]);
            }
            CANDS.sort((A, B) => Math.hypot(A[0] * 0.6, A[1]) - Math.hypot(B[0] * 0.6, B[1]));
            const hit = CANDS.map(([dx, dy]) => [x0 + dx, y0 + dy]).find(([cx, cy]) => !clashes(cx, cy));
            // no clear slot anywhere: keep the centroid rather than invent a place
            if (hit) [x, y] = hit;
          }
          placed.push({x, y, hw});

          const a = nodes[k];
          a.style.left = `${x}%`;
          a.style.top = `${y}%`;
          s.projects[k].el = a;
        });
        s.projBuilt = true;
      };

      /**
       * THE CAMERA — a DERIVED value, recomputed EVERY FRAME (R6 bug fix).
       *
       * The founder's "the map often becomes very small on a fresh load, or
       * after waiting a bit" was a real defect, and the R4 fix missed its cause.
       * `drive()` is NOT a per-frame loop: it only runs on ScrollTrigger's
       * onUpdate/onRefresh, i.e. while the user is actually scrolling. So
       * `cam.z` froze at `zFit_at_the_last_drive × 1.16`, while the engine kept
       * rewriting `zFit` afterwards from its own `fit()` (ResizeObserver,
       * start(), visibilitychange, the poster→live handover). When the two
       * disagreed, `fit()` did not re-frame — it merely CLAMPED cam.z into
       * [zFit*0.8, zFit*14] (GraphEngine fit()), parking the map at 0.8/1.16 =
       * 69% of its intended size until the next scroll silently repaired it.
       *
       * The fix is structural: the camera is now a pure function of (engine, p)
       * and is applied from tick() on every animation frame, so cam.z can never
       * drift away from the live zFit. BRIDGE is recomputed here too — it was
       * frozen once inside resolveStory, the same bug one layer down.
       */
      const applyCamera = (e, p) => {
        if (!e || !e.cam || !e.zFit || !e.w) return;
        const zHome = e.zFit * (e.mobile ? 1.05 : 1.16);
        const HOME = {
          x: e.world / 2 + (e.litCx - e.world / 2) * 0.32,
          // the geo field's land sits in the upper band, so bias the frame DOWN
          // a touch (lower cam.y → content moves down) to centre it at the open.
          y: e.world / 2 + (e.litCy - e.world / 2) * 0.32 - e.world * 0.02,
          z: zHome,
        };
        const LEFT = {x: HOME.x + (e.w * 0.13) / (HOME.z * PF2), y: HOME.y, z: HOME.z * 1.12};
        // BRIDGE from LIVE geometry (never the frozen s.route.frame).
        let BRIDGE = HOME;
        if (s.route && s.route.frameSeq && s.route.frameSeq.length) {
          const seq = s.route.frameSeq;
          let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
          for (let k = 0; k < seq.length; k += 1) {
            const x = e.xs[seq[k]];
            const y = e.ys[seq[k]];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const spanX = Math.max(60, maxX - minX);
          const spanY = Math.max(60, maxY - minY);
          BRIDGE = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: Math.min((e.w * 0.58) / (spanX * PF2), (e.h * 0.5) / (spanY * PF2)),
          };
        }

        /* R7 — the HOME→LEFT drift used to be anchored on the `specialize` beat,
         * which is gone. It now runs in the GAP between the communities beat and
         * the `ask` caption, and completes in `ask`'s first quarter: the founder's
         * standing note is that a lock-and-pop must land on a settled frame, and
         * ask's pop (beatShape lockAt, 30% in) now arrives after the drift is
         * done. Moving the zoom out of a captioned beat entirely also means the
         * map is never sliding under words that are trying to be read.
         *
         * The pull-back is re-anchored for the reach ⇄ reroute swap: Act V now
         * ENDS on the reroute, so the camera holds the bridge through it and
         * releases into the wordless `expanse`. */
        const zoomStart = WIN.communities[1];
        const zoomEnd = WIN.ask[0] + (WIN.ask[1] - WIN.ask[0]) * 0.25;
        // R8: `expanse` is now 42vh, not 91, so a 40%-of-expanse pull would snap
        // the camera home in ~17vh. It releases across the whole tail of the act
        // into the command beat instead.
        const pullEnd = WIN.oneCommand[0] - 0.004;
        let kf;
        if (p < zoomStart) kf = HOME;
        else if (p < zoomEnd) kf = lerpKF(HOME, LEFT, ss(local(p, [zoomStart, zoomEnd])));
        else if (p < WIN.netFill[0]) kf = LEFT;
        else if (p < WIN.route[0]) kf = lerpKF(LEFT, BRIDGE, ss(local(p, [WIN.netFill[0], WIN.route[0]])));
        else if (p < WIN.reroute[1]) kf = BRIDGE; // hold through improve → reach → reroute
        else if (p < pullEnd) kf = lerpKF(BRIDGE, HOME, ss(local(p, [WIN.reroute[1], pullEnd])));
        else kf = HOME;

        // the engine's own camAnim (resetView / focusLanguage) must never fight
        // the seam for the camera while the seam is driving it.
        if (e.camAnim) e.camAnim = null;
        /* The base canvas (every catalogued language) is redrawn only when it
         * is dirty; drawFx runs every frame regardless. applyCamera runs on
         * EVERY rAF, so dirtying unconditionally meant a full n-node drawBase
         * at 60fps for the whole scroll — including while parked on HOME with
         * a camera that hasn't moved. Dirty only on actual movement. */
        const still =
          Math.abs(e.cam.x - kf.x) < 0.01 &&
          Math.abs(e.cam.y - kf.y) < 0.01 &&
          Math.abs(e.cam.z - kf.z) < 1e-4;
        e.cam.x = kf.x;
        e.cam.y = kf.y;
        e.cam.z = kf.z;
        if (typeof e.clampCam === 'function') e.clampCam();
        if (!still) e.dirty = true;
      };

      const drive = (p) => {
        progressRef.current = p;
        const pin = pinRef.current;

        // 1) hero copy fade
        const copy = document.querySelector('[data-hero-copy]');
        if (copy) {
          copy.style.animation = 'none';
          const o = p < WIN.heroFade[1] ? 1 - local(p, WIN.heroFade) : 0;
          copy.style.opacity = String(o);
          // PRESERVE the CSS centering (.copy is left:50% + translateX(-50%));
          // writing translateY alone shifted the hero title half a width right
          // and clipped it — the founder's "off centre and cut off" bug.
          copy.style.transform = `translate(-50%, ${(-26 * (1 - o)).toFixed(1)}px)`;
          copy.style.pointerEvents = o > 0.5 ? '' : 'none';
        }

        const e = typeof window !== 'undefined' ? window.__GRAPH_ENGINE : null;
        const ts = tapeState(p, ROWS);
        if (e && e.home && e.cam) {
          resolveStory(e);
          // 2) camera — applied here AND every frame from tick(). See applyCamera.
          applyCamera(e, p);

          // 3) the waves — WHITE wash, then GREEN sweep, then RED sweep.
          // Strength envelopes run wider than the caption windows: the field
          // moves first and settles last (founder R1: more intensity, earlier).
          if (typeof e.setPulseWave === 'function') {
            const env = (win) => winAlpha(p, win[0] - 0.005, win[1] + 0.014, 0.012);
            if (p >= WIN.waveAll[0] - 0.005 && p < WIN.waveCovered[0]) {
              e.setPulseWave({mode: 'all', color: [225, 232, 240], wash: true, t: local(p, WIN.waveAll), boost: 0.8, strength: env(WIN.waveAll)});
            } else if (p >= WIN.waveCovered[0] && p < WIN.waveService[0]) {
              e.setPulseWave({mode: 'covered', color: [86, 195, 92], t: local(p, WIN.waveCovered), boost: 1.25, strength: env(WIN.waveCovered)});
            } else if (p >= WIN.waveService[0] && p < WIN.waveGap[0]) {
              e.setPulseWave({mode: 'service', color: [110, 224, 110], t: local(p, WIN.waveService), boost: 1.4, strength: env(WIN.waveService)});
            } else if (p >= WIN.waveGap[0] && p < WIN.waveGap[1] + 0.014) {
              e.setPulseWave({mode: 'uncovered', color: [232, 58, 68], t: local(p, WIN.waveGap), boost: 1.25, strength: env(WIN.waveGap)});
            } else if (p >= WIN.endInView[0] - 0.004) {
              // ACT VIII — THE END IN VIEW. The SAME population that swept RED
              // in beat 3 (the uncovered) now fills TEAL. Teal is this seam's
              // established "aim, never a measured claim" colour, so this reads
              // as the destination, not as fabricated coverage — the red gap of
              // the opening, answered by the closing image.
              //
              // R8: FRONT-LOADED, and dimmer. The wave washes NODES; the lattice
              // (which now explodes rather than fading) draws EDGES between them,
              // and the packet flood runs over both. Three brightness sources on
              // one frame is mush, so the population turns teal FIRST and the
              // other two arrive behind it — one event with a leading edge.
              e.setPulseWave({
                mode: 'uncovered',
                color: TEAL,
                wash: true,
                t: ss(local(p, [WIN.endInView[0] - 0.004, WIN.endInView[0] + (WIN.endInView[1] - WIN.endInView[0]) * 0.55])),
                boost: 1.15,
                strength: winAlpha(p, WIN.endInView[0] - 0.004, 1.001, 0.01),
              });
            } else if (e.pulseWave) {
              e.setPulseWave(null);
            }
          }

          // 4) STORY EDGES — ONLY the tape's scored pairs (R2: the mesh's
          // ambient lines are gone; "the network that exists" is told by
          // packet TRAFFIC between covered pairs — see tick). Lines on this
          // map mean exactly one thing: a locked, measured spectrum edge.
          const edges = [];
          const tints = [];
          // during the map band the whole measured network IGNITES — the mapped
          // edges brighten + thicken (founder 2026-07-24: "a lot more intense").
          const mapBoost = winAlpha(p, MAP_BAND[0] - 0.006, MAP_BAND[1], 0.024);

          // ── TIER 1: the NETWORK draws itself, then MEASUREMENT lights it up ──
          // R6 (founder): the lattice must NOT read as "unmeasured claims" — the
          // caption that framed it that way is gone. So it now tells the
          // capability story instead: the lines draw themselves (the network we
          // work through), and then measurement SWEEPS them into quality colour.
          //
          // Crucially the ignition is driven by the TAPE'S OWN ROW COUNT, not by
          // a window of its own. The zipper and the map therefore share ONE
          // CLOCK — when the tape hits its burst and rips through rows, the map
          // floods, because they are the same event rather than two animations
          // that merely resemble each other (founder: "the zipper should match
          // what's happening on the map").
          if (s.lattice && s.lattice.length) {
            const [la, lb] = LATTICE_DRAW;
            const span = lb - la;
            const n = s.lattice.length;
            const base = s.latBase || n;
            /* ── ACT VIII (founder 2026-08-07) — THE LATTICE EXPLODES ─────────
             * It used to do the exact opposite. A `fade = 1 - ss(…)` here drove
             * every edge's alpha to zero across the ~20vh into endInView, so the
             * ONE beat whose claim is "the whole network is mapped" was the one
             * beat with no network on it. Now the reserve tail sampled in
             * resolveStory arrives, staggered, already measured — these are
             * edges the story has been measuring all along, finally all shown —
             * and the whole lattice brightens and thickens behind the teal fill. */
            const endT = ss(local(p, [WIN.rights[1], WIN.endInView[0] + 0.014]));
            /* The grown budget is sampled once, but how much of it we can AFFORD
             * is decided here, live. resolveStory runs moments after load, when
             * avgFrameMs is still unmeasured — so sizing the finale there is
             * sizing it on no information. The reserve is a pre-sampled prefix,
             * so shrinking it costs nothing: we simply push fewer of the same
             * stable objects. A struggling machine gets the story budget and
             * still sees the lattice brighten and thicken; a healthy one gets
             * the full explosion. */
            const fps = typeof window !== 'undefined' && window.__GRAPH_STATS ? window.__GRAPH_STATS.avgFrameMs : 0;
            const afford = fps > 26 ? 0 : fps > 20 ? 0.5 : 1;
            const shown = base + Math.round((n - base) * endT * afford);
            // how far the tape has got, 0..1 — the shared clock
            const measured = clamp01(ts.scoredCount / ROWS);
            for (let k = 0; k < shown; k += 1) {
              const ed = s.lattice[k];
              // deterministic per-edge start: first edges lead, last ones trail
              const start = la + span * LATTICE_STAGGER * (k / n);
              const dur = span * (1 - LATTICE_STAGGER);
              ed.reveal = dur > 0 ? clamp01((p - start) / dur) : (p >= start ? 1 : 0);
              // …and this edge IGNITES once the tape's progress passes it.
              let lit = clamp01((measured - (k / n) * 0.94) * 7);
              if (k >= base) {
                // the reserve: it arrives across the ramp and arrives ALREADY lit
                const at = (k - base) / Math.max(1, n - base);
                ed.reveal = clamp01((endT - at * 0.62) * 3.6);
                lit = Math.max(lit, endT);
              }
              if (lit > 0) {
                const q = LATTICE_Q[k % LATTICE_Q.length];
                const spec = qualitySpectrum(q).rgb;
                ed.rgb = [
                  Math.round(LATTICE_RGB[0] + (spec[0] - LATTICE_RGB[0]) * lit),
                  Math.round(LATTICE_RGB[1] + (spec[1] - LATTICE_RGB[1]) * lit),
                  Math.round(LATTICE_RGB[2] + (spec[2] - LATTICE_RGB[2]) * lit),
                ];
              } else {
                ed.rgb = LATTICE_RGB;
              }
              /* 2026-08-19 — thinned. At full lit + mapBoost this was alpha
               * 0.59 / width 1.2, and several hundred strokes at that weight
               * turned Africa and SE Asia into glow soup: the beat claiming
               * "the whole network" had no Earth left to be whole ON. The
               * flood is carried by the PACKETS; the strokes carry structure.
               * Budget and ignition clock are unchanged — this is weight only. */
              ed.alpha = Math.min(0.38, 0.11 + 0.19 * lit + 0.05 * mapBoost + 0.15 * endT);
              ed.width = 0.55 + 0.3 * lit + 0.2 * endT;
              // push a PREFIX of the stable array — no spread, no slice, no alloc
              edges.push(ed);
            }
          }
          if (s.tape && p >= BELT[0]) {
            s.tape.forEach((t) => {
              if (!t.ok) return;
              const rev = clamp01((p - lockP(t.i)) / 0.012);
              if (rev <= 0) return;
              const alpha = Math.min(1, 0.62 * (1 + 0.55 * mapBoost));
              const width = (t.pair.rerun ? 2.1 : 1.7) * (1 + 0.4 * mapBoost);
              edges.push({a: {idx: t.ai}, b: {idx: t.bi}, rgb: t.rgb, alpha, width, reveal: rev});
              t.tintEnds.forEach((n) => tints.push([n, t.rgb, rev * (0.85 + 0.4 * mapBoost)]));
            });
            // the pair UNDER THE HEAD lights on the map while it's measured
            if (ts.arrived && s.tape[ts.headRow] && s.tape[ts.headRow].ok) {
              const cur = s.tape[ts.headRow];
              const glow = 0.55 + 0.4 * Math.sin(ts.dwellT * 9.42);
              tints.push([cur.ai, [214, 238, 255], glow]);
              tints.push([cur.bi, [214, 238, 255], glow]);
            }
          }
          // `measure` — the claim, demonstrated on ONE pair: spa↔quz light up
          // under "Champollion doesn't pick winners. It measures quality."
          // (the test packet + score chip ride in tick)
          if (s.spa >= 0 && s.quz >= 0 && p >= WIN.measure[0] && p < WIN.measure[1]) {
            const da = winAlpha(p, WIN.measure[0], WIN.measure[1], 0.008);
            tints.push([s.spa, [214, 238, 255], 0.85 * da]);
            tints.push([s.quz, [214, 238, 255], 0.85 * da]);
          }
          // reroute beat: the English pivot lights up as the new eng↔quz
          // measurement locks and the route CONDENSES through it (green — the
          // single measured, high-resource hop that replaces the dan+spa relays).
          if (s.eng >= 0 && p >= WIN.reroute[0]) {
            const qa = ss(local(p, [WIN.reroute[0] + 0.006, WIN.reroute[0] + 0.03]));
            tints.push([s.eng, qualitySpectrum(0.74).rgb, 0.9 * qa]);
            if (s.quz >= 0) tints.push([s.quz, [214, 238, 255], 0.6 * qa]);
          }
          /* ── R7: THE COMMUNITIES BEAT ────────────────────────────────────────
           * The projects arrive one after another and STAY. The accumulation is
           * the argument: the founder's brief was that far more of this work
           * exists than we had been listing, so the beat has to end with the
           * screen carrying more names than the viewer expected. Earlier names
           * settle back to a quieter opacity as new ones land, so the newest is
           * always legible without the older ones leaving.
           *
           * Node colour is TEAL — this seam's established "aim, never a measured
           * claim" colour. These are real projects, but nothing here is a score,
           * so using a quality colour would be a category error (palette law: a
           * colour must never mean two things). */
          const commWin = [WIN.communities[0], WIN.communityWork[1]];
          if (s.projects && s.projects.length && p >= commWin[0] - 0.006 && p < WIN.ask[0] + 0.012) {
            buildProjects(e);
            const n = s.projects.length;
            const span = (commWin[1] - commWin[0]) * 0.88;
            const out = winAlpha(p, commWin[0] - 0.006, WIN.ask[0] + 0.012, 0.01);
            s.projects.forEach((pj, k) => {
              const at = commWin[0] + (span * k) / n;
              const on = ss(clamp01((p - at) / 0.006));
              // newest reads brightest; the ones already landed hold at 0.62
              const fresh = 1 - ss(clamp01((p - at - 0.008) / 0.012));
              const a = on * (0.62 + 0.38 * fresh) * out;
              if (pj.el) {
                pj.el.style.opacity = a.toFixed(3);
                pj.el.style.transform = `translate(-50%, calc(-50% + ${((1 - on) * 9).toFixed(1)}px))`;
              }
              if (a > 0.02) pj.idx.forEach((nd) => tints.push([nd, TEAL, 0.72 * on * out]));
            });
          } else if (s.projBuilt) {
            s.projects.forEach((pj) => {
              if (pj.el) pj.el.style.opacity = '0';
            });
          }
          // beat 13+: the Ayta cluster lights TEAL (aim — never coverage)
          if (s.cluster && s.cluster.length && p >= WIN.reach[0]) {
            const ca = ss(local(p, [WIN.reach[0], WIN.reach[0] + 0.02]));
            s.cluster.forEach((n) => tints.push([n, TEAL, 0.8 * ca]));
          }
          if (typeof e.setNodeTints === 'function') e.setNodeTints(tints);
          if (typeof e.setStoryEdges === 'function') e.setStoryEdges(edges);

          // 5) R2: NO dashed search fan, no dotted rails of any kind — the
          // route beat is told entirely by HOP-TRAINS (see tick): the direct
          // attempt dies red, weak candidates fizzle at their weak hop, the
          // real loss-router's winner completes hop by hop.
          if (e.routeSearch) e.clearRouteSearch();
          if (e.predictedRoute) e.clearPredictedRoute();

          // (R8: the endonym flurry that used to bloom here was removed —
          // founder: "remove the background language labels". The beat's image
          // is now the exploding lattice + the flood, not a word cloud.)
        }

        // 6) captions
        STORY.forEach((c, i) => {
          const el = capRefs.current[i];
          if (!el) return;
          const al = winAlpha(p, c.win[0], c.win[1]);
          el.style.opacity = String(al);
          el.style.transform = `translate(-50%, calc(-50% + ${((1 - al) * 12).toFixed(1)}px))`;
          if (c.text) {
            if (al > 0.12 && !fired.caps[i]) {
              fired.caps[i] = true;
              playCaption(i);
            } else if (al < 0.04 && fired.caps[i]) {
              fired.caps[i] = false;
              resetCaption(i);
            }
          }
        });

        // 7) hub column (beats 5–6). The Meta quote is now an inline citation
        // inside the notWorking caption (part of the essay), not a detached card.
        if (hubRef.current) {
          const ha = winAlpha(p, WIN.omni[0], WIN.notWorking[1]);
          if (hubColWrapRef.current) hubColWrapRef.current.style.opacity = String(ha);
          hubRef.current.setReveal(ss(clamp01(local(p, WIN.omni) / 0.62)));
        }

        // 8) THE TAPE — belt, head, run-card, scored rows (all pure in p;
        // the pop/thread garnish is fire-once with the standard reset).
        if (zipRef.current) {
          // R4: the tape runs through to the very final beat (never fades early).
          zipRef.current.setWindow(winAlpha(p, WIN.zipIn[0], 1.0, 0.02));
          zipRef.current.setRun(ts.offsetRows);
          zipRef.current.setHead(ts.headRow, ts.dwellT, ts.arrived);

          // lock effects: rows [0, scoredCount) are locked. R2: nothing flies
          // from the instrument — the RESULT lands between the pair itself
          // (a pulse in the scored colour, right as its edge locks on).
          while (fired.lockedRows < ts.scoredCount) {
            const i = fired.lockedRows;
            const t = s.tape && s.tape[i];
            if (t) {
              zipRef.current.markScored(i, t.hex);
              if (runRef.current) runRef.current.popLock(gsap, t.rgb.join(', '));
              const eng = window.__GRAPH_ENGINE;
              if (t.ok && eng && typeof eng.spawnPulseColored === 'function') {
                eng.spawnPulseColored(performance.now(), t.ai, t.bi, t.rgb, 0.6);
              }
            }
            fired.lockedRows += 1;
          }
          while (fired.lockedRows > ts.scoredCount) {
            fired.lockedRows -= 1;
            zipRef.current.resetScored(fired.lockedRows);
            if (runRef.current) runRef.current.resetPop();
          }
        }

        // the run-card mirrors the head: pair · method · benchmark + rolling
        if (runRef.current && s.tape) {
          const rc = runRef.current;
          /* R8 (founder 2026-08-07): "once the zipper goes into this sat→guj,
           * sat→XXX bit, the card fades for some reason. I don't want the card
           * to fade — I want the narrative text to have better placement so
           * there isn't occlusion/overlap. Make sure the zipper card persists
           * throughout."
           *
           * So the card no longer bows out to protect the captions; the captions
           * move instead (the `aside` flag + .captionAside width cap). It now
           * holds +154vh — through the reroute's dwell, all of `expanse`, and
           * both Act VI beats — and yields only to the sovereign seal, which is
           * a full-stage beat by construction: .seal is min(96%, 1040px) wide
           * and its five-part mechanism can't narrow without wrecking the thing
           * it exists to show. The zipper column itself runs to the final frame. */
          /* The run-card persists to `rights` (founder: it must not vanish),
           * but it does NOT get to stay loud under the command card — on a
           * 1440 stage their edges touch, and the tape measuring some other
           * pair is a different sentence from "here is the command you run".
           * Persist, dimmed. */
          const cmdOn = winAlpha(p, CMD_WIN[0], CMD_WIN[1], 0.01);
          rc.setVisible(
            winAlpha(p, WIN.zipIn[0] + 0.008, WIN.rights[0] + 0.004, 0.01) * (1 - 0.65 * cmdOn),
          );
          const row = ts.started ? ts.headRow : -1;
          const t = row >= 0 ? s.tape[row] : null;
          // the metric NAMES + benchmark come from the SSOT per pair (seamRuns):
          // COMET only where valid, the corpus both languages sit on, or the
          // honest "no held-out benchmark yet" (spa↔quz). rerun overrides the
          // benchmark to the community corpus (the improve story).
          const curMetrics = t ? metricsFor(t.pair.a, t.pair.b) : [];
          if (row !== fired.lastHeadRow) {
            fired.lastHeadRow = row;
            if (t) {
              /* R8: the header used to look up the pair's FIRST method and show
               * that, on the theory that a re-run re-tests the same method and
               * only the corpus changed. That is the opposite of the story now:
               * "multiple new methods dropping" is the point, so a re-measure
               * names the method that actually took THIS reading. `corpus` (not
               * `rerun`) drives the amber lane, because two of the six
               * re-measures came off a benchmark, not a community corpus, and
               * amber must never stand for anything but sovereignty. */
              const isCorpus = !!t.pair.corpus;
              const bl = benchmarkLine(t.pair.a, t.pair.b);
              rc.setHeader({
                kicker: t.pair.rerun
                  ? (isCorpus ? 'RE-MEASURING · COMMUNITY CORPUS' : 'RE-MEASURING · NEW METHOD')
                  : t.pair.reroute ? 'MEASURING · NEW BRIDGE' : 'MEASURING',
                pair: `${t.pair.a} ↔ ${t.pair.b}`,
                method: methodOf(t.pair, row),
                benchmark: isCorpus ? 'community corpus · CC-BY' : bl.label,
                tone: isCorpus ? TONE_HEX.amber : '',
              });
              rc.setMetricCount(curMetrics.length);
            }
          }
          if (t) {
            const locked = ts.dwellT >= TAPE_LOCK_AT;
            curMetrics.forEach((name, k) => {
              const {v, d} = lensTarget(name, t.pair.q);
              let text;
              if (!ts.arrived) text = '—';
              else if (locked) text = v.toFixed(d);
              else {
                const prog = ss(ts.dwellT / TAPE_LOCK_AT);
                const wob = (dHash(row * 7 + 1, k * 13 + 3, Math.floor(ts.dwellT * 26)) - 0.5) * (1 - prog) * (d === 2 ? 0.16 : 11);
                text = Math.max(0, v * (0.3 + 0.7 * prog) + wob).toFixed(d);
              }
              rc.setMetric(k, name, text, locked ? t.hex : null);
            });
          }
        }

        // 8b) THE CHAIN PANEL — the third instrument, synced to the route arc.
        // It assembles as the winner train crosses (route beat), plays the
        // coaching correction when the community re-measure locks (improve),
        // and re-forms — dan+spa collapse, the single English pivot slots in — when the
        // new bridges lock (reroute). All fire-once with reset-below.
        if (chainRef.current) {
          const cp = chainRef.current;
          /* R7/R8 — THE BUG THIS KEEPS FIXING. The panel's window used to end at
           * reach[1], then at reroute[1] + 0.008 — and the condense still fired
           * ~4vh before the fall-off began, so the single most important motion
           * in Act V (three hops collapsing to two) played under its own fade.
           * The founder saw it on the live site: "this is NOT reflected at all
           * on the chain cards … the main issue you should be fixing".
           *
           * R8 fixes it from both ends: the reroute rows now lock in the FIRST
           * HALF of their beat (see TAPE_RATE_VH), and the panel holds to the
           * wordless `expanse` — full opacity to ~1739vh, i.e. ~77vh of read
           * time after the condense instead of 4. The explicit short feather
           * matters: winAlpha's default would cap at 18% of a very wide window
           * and start dimming 41vh early. */
          const chainAlpha = winAlpha(p, WIN.route[0] - 0.004, WIN.expanse[0] + 0.004, 0.009);
          cp.setWindow(chainAlpha);
          // R4: while the chain strip is up, dim the hero's bottom legend +
          // scroll cue so nothing collides at the bottom of the viewport.
          if (typeof document !== 'undefined') {
            document.documentElement.toggleAttribute('data-seam-chain', chainAlpha > 0.05);
          }
          /* ── R8: EVERY MEASUREMENT POPS ─────────────────────────────────────
           * Founder: "I want at least 6 measurements to be reflected in the
           * lower cards, showing the numbers improving for each hop through
           * multiple new methods dropping … with established pop-effects on the
           * cards." The tape now carries six re-measurements and two new
           * bridges; each one fires the house lock-and-pop on the bridge card it
           * lands on, in that reading's own spectrum colour.
           *
           * Fire-once per row against fired.bridgeLocks, keyed on lockP — the
           * ONE clock (R7) — with the standard reset-below so a backwards scrub
           * un-pops them. The VALUES need no work here: setBridgeRuns already
           * takes the latest locked reading per pair, so successive rows on the
           * same bridge step its numbers up on their own. */
          if (s.tape && typeof cp.popBridge === 'function') {
            s.tape.forEach((t) => {
              if (!t.pair.rerun && !t.pair.reroute) return;
              const on = p >= lockP(t.i);
              if (on && !fired.bridgeLocks[t.i]) {
                fired.bridgeLocks[t.i] = true;
                cp.popBridge(gsap, t.pair.a, t.pair.b, t.rgb.join(', '));
              } else if (!on && fired.bridgeLocks[t.i]) {
                fired.bridgeLocks[t.i] = false;
                cp.resetBridgePop(t.pair.a, t.pair.b);
              }
            });
          }
          const rerunRows = s.tape ? s.tape.filter((t) => t.pair.rerun) : [];
          const rr = s.tape ? s.tape.filter((t) => t.pair.reroute) : [];
          // reroute — fire-once when BOTH new bridges have locked; reset below.
          const rrLocked = rr.length === 2 && p >= lockP(rr[1].i);
          if (rrLocked && !fired.chainRerouted) {
            fired.chainRerouted = true;
            cp.reroute(gsap);
          } else if (!rrLocked && fired.chainRerouted) {
            fired.chainRerouted = false;
            cp.resetReroute();
          }
          /* the coaching correction — fire-once when the LAST re-measure locks.
           * R8: it used to hang off the first. With six of them the target card
           * would have turned green before five of the readings that earn it had
           * even landed; the founder's "the final green on Quechua doesn't show
           * until the whole chain is already fading" is the same defect from the
           * other side. It now lands on the 0.71 payoff, ~50vh before the beat
           * ends and ~255vh before the panel starts to fade. */
          const payoffRow = rerunRows.length ? rerunRows[rerunRows.length - 1] : null;
          const improveOn = payoffRow && p >= lockP(payoffRow.i);
          if (improveOn && !fired.chainImproved) {
            fired.chainImproved = true;
            cp.improve(gsap);
          } else if (!improveOn && fired.chainImproved) {
            fired.chainImproved = false;
            cp.resetImprove();
          }
          // assembly (only while NOT rerouted — reroute owns the card layout).
          if (!fired.chainRerouted) {
            const asm = p < WIN.route[0] ? 0 : p < WIN.route[1] ? ss(local(p, [WIN.route[0], WIN.route[1] - 0.006])) : 1;
            cp.setAssembled(asm);
          }
          // LIVE bridge run-cards (R4): drive each chain-bridge pair from the
          // SAME tapeState as the zipper — a bridge rolls while the head is on
          // its pair and locks in that row's spectrum colour (the chain, the
          // zipper, and the map stay in lock-step). spa↔quz picks up its
          // improved 0.71 once the community rerun row has locked.
          if (s.tape && typeof cp.setBridgeRuns === 'function' && p >= WIN.route[0] - 0.01) {
            const runs = {};
            CHAIN_BRIDGE_PAIRS.forEach(([a, b]) => {
              const rows = s.tape.filter(
                (t) => (t.pair.a === a && t.pair.b === b) || (t.pair.a === b && t.pair.b === a),
              );
              if (!rows.length) return;
              const headOn = rows.find((t) => ts.arrived && ts.headRow === t.i);
              if (headOn) {
                runs[qKey(a, b)] = {
                  phase: 'measuring',
                  dwellT: ts.dwellT,
                  q: headOn.pair.q,
                  rgb: headOn.rgb,
                  method: methodOf(headOn.pair, headOn.i),
                  corpus: !!headOn.pair.corpus,
                };
                return;
              }
              const locked = rows.filter((t) => p >= lockP(t.i));
              if (locked.length) {
                const t = locked[locked.length - 1]; // latest = the improved reading
                runs[qKey(a, b)] = {
                  phase: 'locked',
                  q: t.pair.q,
                  rgb: t.rgb,
                  method: methodOf(t.pair, t.i),
                  corpus: !!t.pair.corpus,
                  improved: !!(t.pair.rerun || t.pair.reroute),
                };
              }
            });
            cp.setBridgeRuns(runs);
          }
        }

        /* 8c) ACT VI — THE YOU-TURN. R8 (founder): the `mt-eval run` ring that
         * used to argue "anyone can build one" by geometry, and the medical
         * Answer Card before it, are both gone. What replaces them is the
         * literal thing: the command, and the runs it starts landing on the map.
         * Pure in p; only the score lock-and-pop is fire-once. */
        if (cmdRef.current) {
          const cc = cmdRef.current;
          const v = local(p, CMD_WIN);
          cc.setWindow(winAlpha(p, CMD_WIN[0] + 0.003, CMD_WIN[1], 0.008));
          cc.setRuns(v);
          LOOP_LAPS.forEach((L, k) => {
            const th = clamp01((v - L.start) / L.span);
            const scoreOn = th >= 0.41; // TAPE_LOCK_AT of the 0.30→0.50 roll
            if (scoreOn && !fired.runScore[k]) {
              fired.runScore[k] = true;
              cc.popScore(k, gsap);
            } else if (!scoreOn && fired.runScore[k]) {
              fired.runScore[k] = false;
              cc.resetPop(k);
            }
          });
        }

        // 9) backdrop dim — the quote focus, the Answer Card's quiet stage,
        // then the seal. The end-in-view beat UNDIMS: the teal field is the
        // point of that beat, so nothing may sit on top of it.
        if (backdropRef.current) {
          let dim = 0;
          if (p >= WIN.notWorking[0] && p < WIN.communities[0]) {
            dim = 0.5 * ss(local(p, [WIN.notWorking[0], WIN.notWorking[1]]));
            /* ★ R7 — the metaQuote beat. The founder asked for it "full screen
             * for emphasis"; the way to get that on a canvas-backed page is to
             * take everything else away. The backdrop goes almost opaque so the
             * map recedes to a suggestion, and every instrument is already clear
             * by here (the hub column ends at notWorking, the tape has not rolled
             * in yet). One sentence, alone, holding.
             * These overlap by design and are combined with max() rather than
             * chained as else-ifs: an else-if hands over at a hard boundary, and
             * the quote's 0.86 dropped to the communities' feathered 0.11 in a
             * single frame — a visible flash right as the beat changes. */
            dim = Math.max(dim, 0.86 * winAlpha(p, WIN.metaQuote[0], WIN.communities[0] + 0.008, 0.012));
          } else if (p >= WIN.communities[0] && p < WIN.zipMeasure[0]) {
            // the communities beat wants the map READABLE — the project clusters
            // light up on it — so only enough dim to seat the names. Its ramp
            // starts BEFORE the beat so it meets the quote's fall-off.
            dim = Math.max(
              0.3 * winAlpha(p, WIN.communities[0] - 0.01, WIN.ask[0] + 0.01, 0.014),
              0.86 * winAlpha(p, WIN.metaQuote[0], WIN.communities[0] + 0.008, 0.012),
            );
            /* R7: a `zipMeasure` branch used to sit here, fading 0.5 → 0 as the
             * tape rolled in. It made sense when the dim arrived high and stayed
             * high through Act II. It does not now: the quote owns its own fade
             * and the measurement act is undimmed, so this branch RE-dimmed to
             * 0.5 out of nothing and flashed. Measurement plays on a clear map —
             * that is the point of the act. */
          } else if (p >= WIN.oneCommand[0] - 0.01 && p < WIN.shareIt[1]) {
            // R6: Act VI is a DEMONSTRATION on the map, not a document. Dim only
            // enough to seat the command card — the queue-run threads flying out
            // of it onto the network must stay legible.
            dim = 0.34 * winAlpha(p, WIN.oneCommand[0] - 0.01, WIN.shareIt[1], 0.012);
          } else if (p >= WIN.rights[0] && p < WIN.endInView[0]) {
            dim = 0.6 * ss(local(p, [WIN.rights[0], WIN.rights[0] + 0.012]));
          } else if (p >= WIN.endInView[0]) {
            dim = 0.6 * (1 - ss(local(p, [WIN.endInView[0], WIN.endInView[0] + 0.012])));
          }
          backdropRef.current.style.opacity = String(dim);
        }

        // 10) the sovereign seal (beat 15) + the close
        if (sealRef.current) {
          const sa = winAlpha(p, WIN.rights[0] + 0.002, WIN.rights[1] + 0.004);
          sealRef.current.style.opacity = String(sa);
          sealRef.current.style.transform = `translate(-50%, calc(-50% + ${((1 - sa) * 16).toFixed(1)}px))`;
        }
        if (closeRef.current) {
          const ca2 = clamp01(local(p, [WIN.close[0], WIN.close[0] + 0.012]));
          closeRef.current.style.opacity = String(ca2);
          closeRef.current.style.transform = `translate(-50%, calc(-50% + ${((1 - ca2) * 16).toFixed(1)}px))`;
          closeRef.current.style.pointerEvents = ca2 > 0.6 ? 'auto' : 'none';
        }

        driveExtraZips(p);

        if (p < WIN.transmit[0] - 0.01 && fired.sends.some(Boolean)) {
          fired.sends = new Array(7).fill(false);
        }

        /* THE REGISTER — the honesty slot. A lookup on p, so scrubbing back
         * restores the right line. Only touch the DOM when the state actually
         * changes: this runs every rAF. */
        if (registerRef.current) {
          const rs = registerState(p);
          if (registerRef.current.dataset.state !== rs.id) {
            registerRef.current.dataset.state = rs.id;
            /* Both illustrative states already END with "live scores on the
             * leaderboard", so they take a bare arrow rather than repeating
             * the destination; the coverage key names its own. */
            const label = rs.id === 'coverage' ? 'the build record →' : '→';
            registerRef.current.innerHTML = rs.href
              ? `${rs.text} <a class="${styles.registerLink}" href="${rs.href}">${label}</a>`
              : rs.text;
          }
          // fade only at the very top, so the hero opens clean. (Mobile hides
          // it in CSS — `mobile` state would be stale in this closure.)
          registerRef.current.style.opacity = String(winAlpha(p, 0.004, 1, 0.004));
        }

        // Dev beat readout — opt-in only (`?seam=1` or window.__SEAM_DEBUG):
        // the element is rendered only in that mode, so a live ref IS the
        // guard (the effect's closure never sees seamDebug flip). It used to
        // render unguarded on the production homepage.
        if (labelRef.current) {
          let beat = 'hero';
          for (const [k, [a, b]] of Object.entries(WIN)) if (p >= a && p <= b) beat = k;
          labelRef.current.textContent = `${(p * 100).toFixed(1)}% · ${beat}`;
        }
      };

      // ── the rAF garnish loop: PULSES carry the traffic (R1: pulses, not
      // lines). Everything here is decorative-on-top-of-pure-state and safe
      // to drop frames; `manual` lets the verify harness step it.
      const tick = (now, manual) => {
        if (!manual) rafId = requestAnimationFrame(tick);
        const e = window.__GRAPH_ENGINE;
        if (!e || !e.home) return;
        const p = progressRef.current;
        const pin = pinRef.current;
        // THE CAMERA, EVERY FRAME (R6). drive() only runs while the user is
        // scrolling, so leaving the camera to it let cam.z go stale against a
        // zFit the engine had since re-fit — the "map went very small" bug.
        // Re-deriving here is a few multiplications and makes it impossible.
        applyCamera(e, p);
        const ts = tapeState(p, ROWS);
        // one degrade knob (§7/§8): when the frame budget is tight, halve the
        // densest cadence (the test flood) so we stay under ~24ms/frame.
        const slow = typeof window !== 'undefined' && window.__GRAPH_STATS && window.__GRAPH_STATS.avgFrameMs > 22;
        const FLOOD_MS = slow ? 180 : 90;

        // R8: the seam owns packets to the FINAL frame now — the finale flood IS
        // the closing image, and the engine's own autoPackets running alongside
        // it would mix two densities. Teardown restores autoPackets.
        const inStory = p >= WIN.waveAll[0];
        if (inStory) {
          if (e.autoPackets !== false) e.autoPackets = false;
        } else if (e.autoPackets === false) {
          e.autoPackets = true;
        }

        // R2 principle: packets travel BETWEEN LANGUAGES — never in or out
        // of an instrument. Beats 4–5: the world's translation traffic runs
        // between REAL covered pairs (neutral pale-teal — motion, not a
        // score) while the "bigger and bigger" timeline stacks up beside it.
        if (s.meshPairs && p >= WIN.mesh[0] && p < WIN.notWorking[0]) {
          const cadence = p < WIN.omni[0] ? 220 : 140; // R3 §7: denser typed traffic
          if (now - lastTraffic > cadence) {
            lastTraffic = now;
            const [a, b] = s.meshPairs[(Math.random() * s.meshPairs.length) | 0];
            const flip = Math.random() < 0.5;
            if (typeof e.spawnPulseColored === 'function') {
              e.spawnPulseColored(now, flip ? a : b, flip ? b : a, [165, 225, 245], 0.6);
            }
          }
        }
        // Beat 6 — the SAME action, for everyone else: requests on pairs
        // involving non-major languages arrive at the RED end of the
        // spectrum. Request → bad result; the models' column just watches.
        if (p >= WIN.notWorking[0] && p < WIN.notWorking[1] && now - lastFail > 110) {
          lastFail = now;
          let si = -1;
          let ti = -1;
          for (let tries = 0; tries < 40 && si < 0; tries += 1) {
            const c = (Math.random() * e.n) | 0;
            if (e.liv[c] && e.st[c] === 2) si = c;
          }
          for (let tries = 0; tries < 40 && ti < 0; tries += 1) {
            const c = (Math.random() * e.n) | 0;
            if (e.liv[c] && e.st[c] === 0) ti = c;
          }
          if (si >= 0 && ti >= 0 && typeof e.spawnPulseColored === 'function') {
            const col = qualitySpectrum(0.06 + Math.random() * 0.26).rgb;
            const flip = Math.random() < 0.5;
            e.spawnPulseColored(now, flip ? si : ti, flip ? ti : si, col, 0.7);
          }
        }
        // `measure` — the claim, demonstrated: one test packet crosses spa→quz
        // (R4: the pop-up chip is gone — the chain panel + tape carry the score).
        if (p >= WIN.measure[0] + 0.008 && p < WIN.measure[1] && !fired.creeDemo && s.spa >= 0 && s.quz >= 0) {
          fired.creeDemo = true;
          if (typeof e.spawnPulseColored === 'function') {
            e.spawnPulseColored(now, s.spa, s.quz, qualitySpectrum(0.44).rgb, 0.85);
          }
        }
        if (p < WIN.measure[0] - 0.01 && fired.creeDemo) fired.creeDemo = false;

        // the tape head at work (R4): coloured TEST packets fly between the exact
        // pair under the head, in that row's converging spectrum colour — so the
        // map and the zipper show the same pair, in the same colour, as it is
        // measured. Fast cadence; ambient passive traffic continues elsewhere.
        const inMapBand = p >= MAP_BAND[0] && p < MAP_BAND[1];
        if (ts.arrived && s.tape && s.tape[ts.headRow] && s.tape[ts.headRow].ok && now - lastPairPulse > (inMapBand ? 110 : 180)) {
          lastPairPulse = now;
          const cur = s.tape[ts.headRow];
          const flip = ((now / 180) | 0) % 2 === 0;
          if (typeof e.spawnPulseColored === 'function') {
            e.spawnPulseColored(now, flip ? cur.ai : cur.bi, flip ? cur.bi : cur.ai, cur.rgb, 0.55);
          }
        }

        /* ── R7: THE EXPANSE ─────────────────────────────────────────────────
         * Founder note 9: "clear the dead air by showing more, higher quality
         * traffic on an expanded network." Between the end of Act V and the
         * you-turn there used to be ~90vh in which one lonely head-pair pulsed
         * and nothing else happened. That gap is now the payoff for everything
         * the act just did: the lattice is mostly ignited, the tape has scored
         * most of its rows, and the whole grown network carries traffic at once.
         *
         * The pairs and their colours are REAL — every packet is a row the tape
         * actually locked, in that row's own measured colour. It reads as
         * abundance because by this point there genuinely is more to show, not
         * because we turned a density knob up. */
        /* R8: pulled BACK to the middle of the reroute beat. The founder's "there
         * is also a big gap immediately after" was this flood arriving ~90vh
         * late — abundance should be the payoff FOR the condense, arriving with
         * it, not a separate event once the chain has gone. */
        if (p >= WIN.reroute[0] + (WIN.reroute[1] - WIN.reroute[0]) * 0.45 && p < WIN.expanse[1] && s.tape && now - lastFill > 90) {
          lastFill = now;
          const scored = s.tape.filter((t) => t.ok && p >= lockP(t.i));
          if (scored.length) {
            // three at a time, biased toward the pairs that scored WELL — the
            // network is not merely busier here, it is better.
            for (let k = 0; k < 3; k += 1) {
              const pick = scored[(Math.random() * scored.length) | 0];
              const alt = scored[(Math.random() * scored.length) | 0];
              const t = alt.pair.q > pick.pair.q ? alt : pick;
              if (typeof e.spawnPulseColored === 'function') {
                const flip = Math.random() < 0.5;
                e.spawnPulseColored(now, flip ? t.ai : t.bi, flip ? t.bi : t.ai, t.rgb, 0.62);
              }
            }
          }
        }

        // netFill — the measured network breathes: traffic on scored pairs
        if (p >= WIN.netFill[0] && p < WIN.route[0] && s.tape && now - lastFill > 150) {
          lastFill = now;
          const scored = s.tape.filter((t) => t.ok && p >= lockP(t.i));
          if (scored.length) {
            const t = scored[(Math.random() * scored.length) | 0];
            if (typeof e.spawnPulseColored === 'function') e.spawnPulseColored(now, t.ai, t.bi, t.rgb, 0.6);
          }
        }

        // the map band — "we map the WHOLE network" → "every pair, every method
        // gets benchmark tested" (founder 2026-07-24): tests go EVERYWHERE, a
        // dense spectrum-coloured flood over many pairs (coloured by the measured
        // quality, so a map packet's colour matches its zipper row). At lowestLoss
        // (MAP_BAND end) the flood stops and traffic NARROWS to the route + the
        // tape's current pair. Perf-guarded by the degrade multiplier.
        if (s.meshPairs && p >= MAP_BAND[0] && p < MAP_BAND[1] && now - lastFlood > FLOOD_MS) {
          lastFlood = now;
          const scored = s.tape ? s.tape.filter((t) => t.ok) : [];
          for (let b = 0; b < 3; b += 1) {
            let ai;
            let bi;
            let q;
            if (scored.length && Math.random() < 0.5) {
              const t = scored[(Math.random() * scored.length) | 0];
              ai = t.ai;
              bi = t.bi;
              q = t.pair.q;
            } else {
              const pr = s.meshPairs[(Math.random() * s.meshPairs.length) | 0];
              ai = pr[0];
              bi = pr[1];
              q = dHash(ai + 1, bi + 1, (now / 90) | 0);
            }
            const flip = Math.random() < 0.5;
            if (typeof e.spawnPulseColored === 'function') {
              e.spawnPulseColored(now, flip ? ai : bi, flip ? bi : ai, qualitySpectrum(q).rgb, 0.5);
            }
          }
        }

        // beat 11 — the transmission test: 7 balls volleying spa↔quz, climbing
        // the spectrum (R4: the pop-up chips are gone; the volley + the chain
        // panel's spa↔quz bridge + the tape carry the reading).
        if (p >= WIN.transmit[0] && p <= WIN.transmit[1] && s.spa >= 0 && s.quz >= 0) {
          const tp = local(p, WIN.transmit);
          const THRESH = [0.06, 0.19, 0.32, 0.45, 0.58, 0.71, 0.84];
          THRESH.forEach((th, k) => {
            if (tp >= th && !fired.sends[k]) {
              fired.sends[k] = true;
              const specT = 0.15 + (0.95 - 0.15) * (k / (THRESH.length - 1));
              const col = qualitySpectrum(specT).rgb;
              if (typeof e.spawnPulseColored === 'function') e.spawnPulseColored(now, s.spa, s.quz, col, 0.85);
            }
          });
        }

        // ── HOP-TRAINS (R2): the one grammar for multi-hop travel. A packet
        // crosses hop k, LANDS on the pivot (the engine's landing ring is the
        // relay moment), dwells, then hop k+1 launches — each hop coloured by
        // ITS measured quality. `dieAt` = search pruning, made visible.
        for (let k = trains.length - 1; k >= 0; k -= 1) {
          const tr = trains[k];
          if (now < tr.nextAt) continue;
          if (tr.hop >= tr.chain.length - 1 || (tr.dieAt != null && tr.hop >= tr.dieAt)) {
            trains.splice(k, 1);
            continue;
          }
          if (typeof e.spawnPulseColored === 'function') {
            e.spawnPulseColored(now, tr.chain[tr.hop], tr.chain[tr.hop + 1], tr.cols[Math.min(tr.hop, tr.cols.length - 1)], 0.55);
          }
          tr.hop += 1;
          tr.nextAt = now + (tr.fast ? 700 : 1080); // flight + the pivot's relay dwell
        }

        // beat 10 — the SEARCH, told in trains: the direct attempt dies red,
        // weak candidates fizzle just past their weakest hop, and the real
        // loss-router's winner completes hop by hop in measured colours.
        if (s.route && p >= WIN.route[0] && p < WIN.transmit[0]) {
          const bp = local(p, WIN.route);
          if (bp > 0.06 && !fired.route.direct && s.quz >= 0) {
            fired.route.direct = true;
            trains.push({chain: [s.route.seq[0], s.quz], cols: [qualitySpectrum(0.07).rgb], hop: 0, nextAt: now});
          }
          if (bp > 0.32 && !fired.route.losers && s.route.losers) {
            fired.route.losers = true;
            s.route.losers.forEach((L, li) => {
              trains.push({chain: L.seq, cols: L.cols, hop: 0, nextAt: now + li * 480, dieAt: L.dieAt});
            });
          }
          if (bp > 0.56 && now - fired.route.winnerAt > 1800) {
            fired.route.winnerAt = now;
            trains.push({chain: s.route.seq, cols: s.route.hopCols, hop: 0, nextAt: now});
          }
        } else if (p < WIN.route[0] - 0.01 && (fired.route.direct || fired.route.losers)) {
          fired.route = {direct: false, losers: false, winnerAt: 0};
          trains.length = 0;
        }

        // beat 12 payoff — once the community re-measure has LOCKED, the full
        // fao→…→quz route runs end-to-end clean (the improved last hop in its
        // new green), fast: the strengthened network, working.
        if (p >= WIN.improve[0] && p < WIN.improve[1] && s.route && s.tape) {
          // R8: the LAST re-measure, not the first — the clean end-to-end run
          // only means anything once the weak hop is genuinely at 0.71. Faster
          // throttle so it repeats across the ~50vh of hold after the payoff.
          const reruns = s.tape.filter((t) => t.pair.rerun);
          const payoff = reruns.length ? reruns[reruns.length - 1] : null;
          if (payoff && p >= lockP(payoff.i) && now - lastPayoff > 1500) {
            lastPayoff = now;
            const cols = s.routeImprovedCols || s.route.hopCols;
            trains.push({chain: s.route.seq, cols, hop: 0, nextAt: now, fast: true});
          }
        }

        // REROUTE — the network re-formed: the router's NEW winner (fao→eng→quz,
        // computed by bestMeasuredChain on the grown graph) runs end-to-end,
        // eliminating the dan+spa hops. Up to 2 concurrent trains drive the new
        // road once the bridges have locked.
        // R7: the upper bound was `WIN.reach[0]`. After the swap reach comes
        // FIRST, so that bound sits before the window opens and the condition
        // could never be true — the payoff train would have stopped running at
        // all. It now runs to the end of the act.
        if (p >= WIN.reroute[0] && p < WIN.expanse[0] && s.routeReroute && s.tape) {
          const rr = s.tape.filter((t) => t.pair.reroute);
          const rrLocked = rr.length === 2 && p >= lockP(rr[1].i);
          if (rrLocked && now - fired.rerouteWinnerAt > 1800) {
            fired.rerouteWinnerAt = now;
            trains.push({chain: s.routeReroute.seq, cols: s.routeReroute.hopCols, hop: 0, nextAt: now, fast: true});
          }
        }

        // ── ACT VI — the runs land, then everyone routes through them ─────────
        // The card and the map are the same transaction: a completed queue run
        // THREADS from the card onto the pair it measured, and two other
        // languages immediately route through what it found.
        if (p >= CMD_WIN[0] && p < CMD_WIN[1] + 0.01 && cmdRef.current && s.tape) {
          const v = local(p, CMD_WIN);
          LOOP_LAPS.forEach((L, k) => {
            const th = clamp01((v - L.start) / L.span);
            const t = s.tape[L.row];
            if (!t || !t.ok) return;
            if (th >= 0.84 && !fired.cmdInstall[k]) {
              fired.cmdInstall[k] = true;
              const pt = cmdRef.current.getExitPoint();
              const w = pt && worldFromClient(e, pt.cx, pt.cy);
              if (w && typeof e.spawnThread === 'function') {
                e.spawnThread(now, w[0], w[1], t.ai, TEAL, L.method);
              }
            }
            if (th >= 0.96 && !fired.cmdRoute[k]) {
              fired.cmdRoute[k] = true;
              const col = qualitySpectrum(L.qNew).rgb;
              // two OTHER languages immediately route through what this run
              // measured — deterministic picks, so it scrubs identically.
              [5, 11].forEach((off, j) => {
                const other = s.tape[(L.row + off) % s.tape.length];
                if (other && other.ok) {
                  trains.push({chain: [other.ai, t.ai, t.bi], cols: [col, col], hop: 0, nextAt: now + j * 420, fast: true});
                }
              });
            }
          });
        } else if (p < CMD_WIN[0] - 0.008 && fired.cmdInstall.some(Boolean)) {
          fired.cmdInstall = [false, false, false];
          fired.cmdRoute = [false, false, false];
        }

        // REACH — the same train grammar continues past quz into the Ayta
        // cluster: sequential hops, TEAL (aim — never a measured claim).
        // R6: stop before Act VI — teal trains crossing the map during the
        // request demo destroy the cause→effect read. The endInView teal fill
        // carries the reach imagery instead.
        // R7: reach now runs BEFORE the reroute, so which road these trains take
        // is no longer a constant. Taking the rerouted road here would show the
        // network using a bridge that has not been measured yet — the trains ride
        // the base route until the second reroute row actually LOCKS, and the
        // condensed road only afterwards.
        if (p >= WIN.reach[0] && p < CMD_WIN[0] - 0.006 && (s.routeReroute || s.route) && s.cluster && s.cluster.length && now - lastChain > 1600) {
          lastChain = now;
          const rr = s.tape ? s.tape.filter((t) => t.pair.reroute) : [];
          const rerouted = s.routeReroute && rr.length === 2 && p >= lockP(rr[1].i);
          const base = (rerouted ? s.routeReroute : s.route).seq;
          const chain = [...base, s.cluster[chainHop % s.cluster.length]];
          trains.push({chain, cols: chain.slice(1).map(() => TEAL), hop: 0, nextAt: now, fast: true});
          chainHop += 1;
        }

        /* ── ACT VIII — THE WHOLE NETWORK, WORKING ────────────────────────────
         * Founder 2026-08-07: "I want to see the ball packets flying everywhere
         * on this slide representing the full network, the full universal
         * translator up and working and operational. Right now there are ZERO
         * packets flying which is precisely wrong."
         *
         * They were right — no tick() branch emitted anything in this window at
         * all. This is now the densest cadence in the seam, and it earns it: by
         * here every tape row has locked, so every packet is a pair the story
         * ACTUALLY measured, in that row's own measured colour — alternated with
         * the mesh's real deployed-service routes so the traffic covers the
         * whole field rather than 80 familiar arcs. Nothing here is a new claim;
         * it is the accumulated network finally shown all at once.
         *
         * The cadence IS the budget: spawnPulseColored bypasses the engine's
         * MAX_PACKETS (that cap governs only its own autoPackets). The standing
         * `slow` knob halves it, same contract as FLOOD_MS. */
        if (p >= WIN.endInView[0] - 0.004 && s.tape && s.meshPairs && now - lastEndFlood > (slow ? 170 : 80)) {
          lastEndFlood = now;
          const ramp = ss(local(p, [WIN.endInView[0] - 0.004, WIN.endInView[0] + 0.02]));
          const burst = slow ? 2 : 2 + Math.round(3 * ramp); // 2 → 5, arriving as a swell
          const scored = s.tape.filter((t) => t.ok && p >= lockP(t.i));
          for (let b = 0; b < burst; b += 1) {
            let ai;
            let bi;
            let col;
            if (scored.length && b % 2 === 0) {
              const t = scored[(Math.random() * scored.length) | 0];
              ai = t.ai;
              bi = t.bi;
              col = t.rgb;
            } else {
              const pr = s.meshPairs[(Math.random() * s.meshPairs.length) | 0];
              ai = pr[0];
              bi = pr[1];
              col = qualitySpectrum(dHash(ai + 1, bi + 1, (now / 80) | 0)).rgb;
            }
            const flip = Math.random() < 0.5;
            if (typeof e.spawnPulseColored === 'function') {
              e.spawnPulseColored(now, flip ? ai : bi, flip ? bi : ai, col, 0.4);
            }
          }
        }
      };
      rafId = requestAnimationFrame(tick);

      ctx = gsap.context(() => {
        const st = ScrollTrigger.create({
          trigger: regionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinRef.current,
          pinSpacing: true,
          scrub: 0.4,
          onRefresh: (self) => drive(self.progress),
          onUpdate: (self) => drive(self.progress),
        });
        // gsap + tick ride along for the dev/verify harness (hidden panes
        // pause rAF — the harness steps the loop + force-completes tweens).
        if (typeof window !== 'undefined') window.__SEAM = {st, drive, tick, s, fired, gsap};
      });
      drive(0);
      // Re-fit + RE-HOME after the layout settles: the engine's first fit can
      // run before the pinned hero has laid out (data-seam-top floats the
      // navbar, changing the initial layout), which locks a too-zoomed-out
      // home and renders the map tiny at the opening beats. Correct it once the
      // real canvas size is known, and again on resize.
      const settleFit = () => {
        const e = window.__GRAPH_ENGINE;
        if (e && typeof e.fit === 'function') {
          e.fit();
          if (typeof e.recomputeHome === 'function') e.recomputeHome();
          e.dirty = true;
        }
        // refresh FIRST: the refresh itself can change the pinned element's
        // measured width (it writes position:fixed + a ceil'd width, and
        // momentarily forces a scrollbar), so re-driving before it left that
        // change with no camera behind it. Re-drive after everything settles.
        ScrollTrigger.refresh();
        drive(progressRef.current);
      };
      const settleTimers = [setTimeout(settleFit, 350), setTimeout(settleFit, 900)];
      fired.settleTimers = settleTimers;
      const onResize = () => settleFit();
      window.addEventListener('resize', onResize);
      fired.onResize = onResize;
    })();

    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (fired.settleTimers) fired.settleTimers.forEach((t) => clearTimeout(t));
      if (fired.onResize) window.removeEventListener('resize', fired.onResize);
      const e = typeof window !== 'undefined' ? window.__GRAPH_ENGINE : null;
      if (e) {
        e.autoPackets = true;
        if (typeof e.clearPredictedRoute === 'function') e.clearPredictedRoute();
        if (typeof e.clearRouteSearch === 'function') e.clearRouteSearch();
        if (typeof e.clearAimLinks === 'function') e.clearAimLinks();
        if (typeof e.clearPulseWave === 'function') e.clearPulseWave();
        if (typeof e.clearNodeTints === 'function') e.clearNodeTints();
        if (typeof e.clearStoryEdges === 'function') e.clearStoryEdges();
      }
      fired.capTl.forEach((tl) => tl && tl.kill && tl.kill());
      if (fired.extraZips) fired.extraZips.forEach((z) => z.tl && z.tl.kill());
      fired.splits.forEach((sp) => {
        try {
          sp.revert();
        } catch (err) {
          /* nothing to restore */
        }
      });
      if (projWrapRef.current) projWrapRef.current.innerHTML = '';
      if (ctx) ctx.revert();
      if (typeof window !== 'undefined') delete window.__SEAM;
    };
  }, [reduced]);

  // ── reduced motion: the story as a static, readable article ──
  if (reduced) {
    return (
      <Layout title={seoTitle} description={seoDescription} noFooter>
        {!indexable && (
          <Head>
            <meta name="robots" content="noindex, nofollow" />
          </Head>
        )}
        <GraphHero
          {...heroCopy()}
          layout="geo"
          forceDark
        />
        <article className={styles.staticStory} dir="ltr">
          {STORY.filter((c) => c.text).map((c) => (
            <p key={c.id} dangerouslySetInnerHTML={{__html: capHtml(c)}} />
          ))}
          <p>
            <em>The chain, and how it re-forms:</em> a sentence travels
            Føroyskt → Dansk → Español → Runasimi (Cusco Quechua). When a new
            measurement lands, the network re-routes through Chanka runasimi
            (Ayacucho Quechua) — the same target, reached by a better path.
          </p>
          {/* R8: this path used to offer nothing actionable. It now carries the
              same command the motion path shows, and the same full tool list. */}
          <p>
            <em>Contribute compute:</em>
          </p>
          <pre>
            <code>
              {RUN_QUEUE.env} {RUN_QUEUE.envNote}
              {'\n'}
              {RUN_QUEUE.cmd}
            </code>
          </pre>
          <p>
            <small>
              {RUN_QUEUE.does} — <a href={RUN_QUEUE.docs}>what this does</a>
            </small>
          </p>
          <p>
            {CLOSE_TOOLS.map((t, i) => (
              <React.Fragment key={t.href}>
                {i > 0 ? ' · ' : ''}
                <a href={t.href}>{t.name}</a>
              </React.Fragment>
            ))}
          </p>
          <p>
            <a href="/get-involved#sponsors">Sponsor a language pair</a> · <a href="/get-involved">get involved</a>
          </p>
        </article>
      </Layout>
    );
  }

  return (
    <Layout title={seoTitle} description={seoDescription} noFooter>
      {!indexable && (
        <Head>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
      )}
      {/* dir="ltr": the seam is a positional composition (canvas + absolute
          overlays authored in LTR math; captions render English in every
          locale by design) — an RTL locale must not flip its layout. Same
          reasoning as GraphHero's own dir="ltr". */}
      <div className={styles.region} dir="ltr" ref={regionRef} style={{height: `${mobile ? SCROLL_VH_MOBILE : SCROLL_VH}vh`}}>
        <div className={styles.pinned} ref={pinRef}>
          <GraphHero
            {...heroCopy()}
            layout="geo"
            forceDark
          />

          {/* dims the map under the quote + seal/close beats */}
          <div className={styles.backdrop} ref={backdropRef} style={{opacity: 0}} aria-hidden="true" />

          <div className={styles.overlay}>
            {STORY.map((c, i) => (
              <p
                key={c.id}
                // the beat id on the element: lets CSS place a single beat
                // (the seal shares its stage with a full-height instrument on
                // phones) without a per-beat class in the story SSOT.
                data-beat={c.id}
                className={[
                  styles.caption,
                  c.full && styles.captionFull,
                  c.lines && styles.captionEnd,
                  // R8: a caption that shares the stage with the now-persistent
                  // run-card + queue column is width-capped to stay clear of them
                  c.aside && styles.captionAside,
                ].filter(Boolean).join(' ')}
                ref={(el) => {
                  capRefs.current[i] = el;
                }}
                style={{opacity: 0, left: `${c.pos[0]}%`, top: `${c.pos[1]}%`}}
              />
            ))}

            {/* THE REGISTER — the seam's one honesty slot, in the band the
                hero's coverage legend used to hold (it yields for the whole
                pin). Contents are driven from REGISTER_STATES in tick(). */}
            <p className={styles.register} ref={registerRef} />

            {/* beat 5/6 — the omnimodel escalation timeline */}
            <div ref={hubColWrapRef} style={{opacity: 0}}>
              <HubColumn ref={hubRef} />
            </div>

            {/* beats 8 → close — the measurement tape + its run-card.
                NOT mounted on a phone: together they claim ~287px of a 375px
                stage and leave the map as a gutter. The beat is carried there
                by the packets, the field and the caption. */}
            {!mobile && <ZipperQueue ref={zipRef} pairs={STORY_PAIRS} />}
            {!mobile && <RunCard ref={runRef} />}

            {/* beats 10–13 — the card-based translation chain (third instrument):
                a real sentence hops fao→dan→spa→quz, then the route re-forms */}
            <ChainPanel ref={chainRef} />

            {/* ACT VI — the you-turn, told as the literal thing a stranger can
                do: the queue-runner command, copyable, with the runs it starts
                landing on the map behind it. (R8 replaced the `mt-eval run`
                ring; the medical Answer Card before it was deleted.) */}
            <CommandCard ref={cmdRef} />

            {/* R7 — the communities beat: linked names of projects already
                building for these languages. Each links to the project's own
                site or paper. We claim no partnership, endorsement or
                affiliation with any of them — see communityProjects.mjs. */}
            <div className={styles.projectWrap} ref={projWrapRef} />

            {/* beat 15 — the sovereign seal: the five-part mechanism (method →
                comes to the data → sealed vault → only a score returns → score) */}
            <div className={styles.seal} ref={sealRef} style={{opacity: 0}}>
              <div className={styles.sealKicker}>THE HIGHEST TIER · SOVEREIGN</div>
              <h2 className={styles.sealTitle} ref={sealTitleRef}>
                The highest standard is one we never see.
              </h2>
              <div className={styles.sealStage} aria-hidden="true">
                {/* the method — travels to the data */}
                <div className={styles.sealMethod}>
                  <span className={styles.sealMethodIcon}>⌘</span>
                  <span className={styles.sealMethodTitle}>a method</span>
                  <span className={styles.sealMethodSub}>human or machine</span>
                </div>
                {/* arrow IN */}
                <div className={styles.sealArrowIn}>
                  <span className={styles.sealArrowTrack}>
                    <span className={styles.sealArrowLine} />
                    <span className={styles.sealArrowHead}>▶</span>
                  </span>
                  <span className={styles.sealArrowCap}>comes to the data</span>
                </div>
                {/* the sealed vault */}
                <div className={styles.sealVault}>
                  <div className={styles.sealVaultHead}>
                    <span className={styles.sealLock}>
                      <svg viewBox="0 0 24 24" width="26" height="26">
                        <rect x="5" y="10.5" width="14" height="10" rx="2" fill="rgba(232,179,57,0.14)" stroke="#e8b339" strokeWidth="1.4" />
                        <path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" fill="none" stroke="#e8b339" strokeWidth="1.4" />
                        <circle cx="12" cy="15" r="1.5" fill="#e8b339" />
                      </svg>
                    </span>
                    <div className={styles.sealVaultHeadText}>
                      <span className={styles.sealVaultTitle}>Sealed test set</span>
                      <span className={styles.sealVaultOwner}>held by the community</span>
                    </div>
                  </div>
                  <div className={styles.sealRedacted}>
                    <span className={styles.sealBar} style={{width: '92%'}} />
                    <span className={styles.sealBar} style={{width: '74%'}} />
                    <span className={styles.sealBar} style={{width: '86%'}} />
                    <span className={styles.sealBar} style={{width: '62%'}} />
                  </div>
                  <div className={styles.sealKeys}>
                    <span className={styles.sealKeyDots}>
                      <i /><i /><i /><i /><i />
                    </span>
                    <span className={styles.sealKeysLabel}>community holds the keys</span>
                  </div>
                </div>
                {/* arrow OUT */}
                <div className={styles.sealArrowOut}>
                  <span className={styles.sealArrowTrack}>
                    <span className={styles.sealArrowLine} />
                    <span className={styles.sealArrowHead}>▶</span>
                  </span>
                  <span className={styles.sealArrowCap}>only a score returns</span>
                </div>
                {/* the score that returns — a FULL mini run-card (R4) */}
                <div className={styles.sealScore}>
                  <span className={styles.sealScoreKicker}>SEALED RUN</span>
                  <span className={styles.sealScorePair}>eng ↔ {SEAL_CODE}</span>
                  <span className={styles.sealScoreRun}>{SEAL_DATASET}</span>
                  <div className={styles.sealScoreTable}>
                    <div className={`${styles.sealScoreRow} ${styles.sealScoreHero}`}>
                      <i>{SEAL_HERO_NAME}</i>
                      <b>{SEAL_HERO_VAL}</b>
                    </div>
                    {SEAL_NAMES.map((nm) => (
                      <div key={nm} className={styles.sealScoreRow}>
                        <i>{nm}</i>
                        <b>
                          <em>pass ✓</em>
                        </b>
                      </div>
                    ))}
                  </div>
                  <span className={styles.sealScoreNote}>{SEAL_CAVEAT}</span>
                </div>
              </div>
              {/* R4 §9: the sealed set is the strongest AUTOMATED benchmark — but
                  speakers themselves review and rank what serves their language */}
              <p className={styles.sealCommunityNote}>
                The sealed set is the strongest <b>automated</b> benchmark — but speakers
                themselves review and rank what truly serves their language.
              </p>
            </div>

            {/* the close — the support structure, on its own surface.
                R8 (founder): the title is "Champollion is the…", not "We're
                the…"; ALL the tools are listed rather than three of them; and
                the copy sits on a semi-transparent card because the global
                backdrop dim is deliberately 0 through endInView/close (the teal
                field is the whole point of that beat), so this text had nothing
                behind it and was hard to read over the map. */}
            <div className={styles.close} ref={closeRef} style={{opacity: 0}}>
              <div className={styles.closeCard}>
                <span className={styles.closeLogo}>
                  <BrandMark size={46} />
                </span>
                <h2 className={styles.closeTitle} ref={closeTitleRef}>
                  Champollion is the <span className={styles.closeAccent}>support structure.</span>
                </h2>
                <p className={styles.closeSub}>
                  Speakers build the real solutions. We bring the tools, the sponsors, and the
                  connections — every language, into every language, under terms its people set.
                </p>

                <div className={styles.toolsKicker}>THE TOOLS · ALL SOURCE-AVAILABLE</div>
                <div className={styles.tools}>
                  {CLOSE_TOOL_GROUPS.map((g) => (
                    <div key={g} className={styles.toolGroup}>
                      <span className={styles.toolGroupName}>{g}</span>
                      {CLOSE_TOOLS.filter((t) => t.group === g).map((t) => (
                        <a key={t.href} className={styles.tool} href={t.href}>
                          <span className={styles.toolName}>{t.name}</span>
                          <span className={styles.toolWhat}>{t.what}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>

                <div className={styles.chips}>
                  <a className={styles.chip} href="/get-involved#sponsors">
                    <span className={styles.chipKicker}>SPONSORS</span>
                    <span className={styles.chipLabel}>Sponsor a language pair</span>
                    <span className={styles.chipSub}>pass-through funding — like adopting a highway</span>
                  </a>
                  <a className={styles.chip} href="/get-involved">
                    <span className={styles.chipKicker}>CONNECTIONS</span>
                    <span className={styles.chipLabel}>Get involved</span>
                    <span className={styles.chipSub}>developers · linguists · language warriors</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {seamDebug ? <div className={styles.devLabel} ref={labelRef} /> : null}
        </div>
      </div>

      {/* BETA IS LIVE (founder go-live 2026-08-28) — normal-flow section BELOW
          the pinned seam region, deliberately outside the beat math: the seam
          scroll ends, then this. Data comes from BETA_LIVE / RUN_QUEUE /
          AGENT_PROMPT in seamStory.mjs (the guard-tested SSOT zone) — no
          strings are authored here. */}
      {/* dir="ltr": English install commands and prompt — RTL must not
          reorder `curl … | bash -s -- --budget 2` or the code grid. */}
      <section className={styles.beta} dir="ltr">
        <div className={styles.betaInner}>
          <div className={styles.betaKicker}>{BETA_LIVE.kicker}</div>
          <h2 className={styles.betaTitle}>{BETA_LIVE.title}</h2>
          <p className={styles.betaSub}>{BETA_LIVE.sub}</p>

          <div className={styles.betaGrid}>
            {BETA_LIVE.tools.map((t) => (
              <a key={t.cmd} className={styles.betaTool} href={t.href}>
                <span className={styles.betaToolName}>{t.name}</span>
                <span className={styles.betaToolWhat}>{t.what}</span>
                <code className={styles.betaCmd}>{t.cmd}</code>
              </a>
            ))}
          </div>

          <div className={styles.betaSplit}>
            <div className={styles.betaPane}>
              <div className={styles.betaPaneKicker}>RUN THE QUEUE — YOUR KEY, YOUR CAP</div>
              <pre className={styles.betaPre}>{`${RUN_QUEUE.env}   ${RUN_QUEUE.envNote}\n${RUN_QUEUE.cmd}`}</pre>
              <p className={styles.betaNote}>
                The budget is a hard cap you choose — the script prices the
                plan and asks before a single token is spent.{' '}
                <a href={RUN_QUEUE.docs}>How contributing works</a>.
              </p>
            </div>
            <div className={styles.betaPane}>
              <div className={styles.betaPaneKicker}>OR HAND IT TO YOUR AGENT</div>
              <pre className={styles.betaPre}>{AGENT_PROMPT}</pre>
              <p className={styles.betaNote}>
                Paste into any agent that holds your API key — or point an
                MCP-capable agent at <a href="/for-agents">the agent front door</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

/**
 * /home-preview — the unlinked, noindex preview of the live homepage seam.
 * The live homepage (pages/index.js) renders <FullStorySeam indexable /> with
 * the mission SEO. Kept so the seam can still be previewed in isolation; a
 * vercel redirect (/home-preview → /) retires the public URL.
 */
export default function HomePreviewPage() {
  return <FullStorySeam />;
}
