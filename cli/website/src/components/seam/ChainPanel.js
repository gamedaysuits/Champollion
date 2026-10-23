/**
 * ChainPanel — the card-based translation-linkage chain (founder R3, 2026-07-22d).
 *
 * Adapts the LIVE `/` homepage's beloved Beat-4 chain into the /home-preview
 * seam as a THIRD synchronized instrument (map + tape + this panel). A real
 * sentence travels Faroese → Danish → Spanish → Cusco Quechua through glass
 * hop-cards; the connectors between them are BRIDGE cards carrying the corpus,
 * licence and VALID metrics for that hop — all derived from the SSOT
 * (seamRuns: metricModelSupport-gated metrics + the corpus both languages sit
 * on). The last card carries the rough→fixed coaching correction and the
 * chrF++ 24 → 71 score swap.
 *
 * THE LIVING ROUTE (hop-elimination / CONDENSE, founder 2026-07-24): four
 * measured improvements ripple along the teaching chain, then a new eng↔quz
 * measurement CONDENSES it — the Danish AND Spanish cards collapse out and the
 * route bridges fao → eng → quz through a single high-resource pivot, a 2→1
 * interlingua reduction. HONESTY: the inserted pivot (English) is shown as a
 * ROUTING PIVOT — identity + role, NOT a fabricated translation. The sentence's
 * target rendering is unchanged (the quz card) — only the PATH that produces it
 * gets shorter and better. We never invent a translation we can't cite.
 *
 * Everything the page reads back is a pure function of scroll progress (setWindow
 * / setAssembled scrub both ways); the correction + reroute are fire-once with
 * reset-below — the seam's standard contract. gsap is passed in for those.
 *
 * @typedef {Object} ChainPanelHandle
 * @property {(alpha: number) => void} setWindow
 * @property {(t: number) => void} setAssembled    the teaching chain reveals 0→1
 * @property {(i: number) => void} pulseHop        a train crossed hop i (garnish)
 * @property {(gsap: object) => void} improve       the coaching correction (fire-once)
 * @property {() => void} resetImprove
 * @property {(gsap: object) => void} reroute       collapse dan+spa, condense via a single English pivot
 * @property {() => void} resetReroute
 * @property {(runs: object) => void} setBridgeRuns  live bridge run-cards (R4)
 */
import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {runFor, benchmarkLine, metricsFor} from '../../utils/seamRuns.mjs';
import {CARD_HERO, CARD_CAVEAT} from '../../utils/metricPops.mjs';
import {RUNCARD, TAPE_LOCK_AT, STORY_PAIRS} from '../../utils/seamStory.mjs';
import {lensTarget, measureText} from '../../utils/seamMetrics.mjs';
import {playLockPop} from '../../utils/lockPop.mjs';
import styles from './ChainPanel.module.css';

const qKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* R8 — a bridge's resting state is DERIVED from the tape row that first measured
 * that pair, not from a table kept alongside it. The hand-kept BRIDGE_Q map and
 * the hand-passed methodIdx arguments this replaces could drift from STORY_PAIRS
 * silently, and with six re-measurements now landing on these same cards a
 * bridge that disagreed with the row that measured it would be visible. */
const firstRow = (a, b) => STORY_PAIRS.findIndex((pr) => qKey(pr.a, pr.b) === qKey(a, b));
const defaultQ = (a, b) => {
  const i = firstRow(a, b);
  return i < 0 ? 0.6 : STORY_PAIRS[i].q;
};
const defaultMethod = (a, b) => {
  const i = firstRow(a, b);
  return i < 0 ? RUNCARD.methods[0] : STORY_PAIRS[i].method || RUNCARD.methods[i % RUNCARD.methods.length];
};
const lockedText = (name, q) => {
  const {v, d} = lensTarget(name, q);
  return v.toFixed(d);
};

/**
 * The illustrative sentence + its per-language renderings — the SAME content as
 * the `/` homepage's CHAIN_PHRASE (an illustration of routing & coaching; the
 * chain's standing caveat discloses that). Endonyms in their own scripts. The
 * quz card carries the rough (direct) rendering and the coached (fixed) one.
 */
const SENTENCE = 'The river carries our ancestors’ stories to the sea.';
const HOPS = {
  fao: {endo: 'Føroyskt', en: 'Faroese', text: 'Áin ber søgur av foreldrunum okkara til sjógvs.'},
  dan: {endo: 'Dansk', en: 'Danish', text: 'Floden bærer vores forfædres historier til havet.'},
  spa: {endo: 'Español', en: 'Spanish', text: 'El río lleva las historias de nuestros antepasados al mar.'},
  quz: {
    endo: 'Runasimi',
    en: 'Cusco Quechua',
    textRough: 'Mayuqa abuelanchikkunapa cuentonkunata mar-man apan.',
    textFixed: 'Mayuqa ñawpa machulanchikkunap willakuyninkunata quchaman apan.',
  },
  // Routing pivot (reroute) — identity + role only. We show NO sentence here:
  // the pivot's job is to route, not to be displayed as a translation.
  eng: {endo: 'English', en: 'English', pivot: true},
};

// The bridge (connector) between two hops: corpus short-name + licence + the
// pair's VALID metric names, all from the SSOT (seamRuns). One method name
// rides along (the tape's rotation) so the bridge reads as a real run.
function bridgeData(a, b) {
  const run = runFor(a, b);
  const bl = benchmarkLine(a, b);
  const metrics = run && run.metrics ? run.metrics : ['chrF++'];
  return {
    corpus: bl.has ? bl.name : 'no held-out benchmark yet',
    corpusShort: bl.has && run.benchmark ? run.benchmark.short : 'community corpus',
    license: bl.license,
    has: bl.has,
    metrics,
    q: defaultQ(a, b),
    method: defaultMethod(a, b),
  };
}

// The ordered primary teaching chain (the condensed reroute fao→eng→quz is
// realised by collapsing dan+spa and revealing the single English pivot).
const PRIMARY = ['fao', 'dan', 'spa', 'quz'];

// A TRULY-zero collapse: max-width:0 alone does NOT collapse a card because the
// CSS min-width wins — so a "hidden" card still occupies ~100px and shoves the
// rest of the chain off-centre. Zero min-width + padding too. (Reveal restores
// padding per card type; min-width stays 0 so the card sizes to its content.)
const COLLAPSED = {maxWidth: 0, minWidth: 0, opacity: 0, paddingLeft: 0, paddingRight: 0};
const padFor = (id) => (id.startsWith('h-') ? 10 : 8); // pivot cards 10px, bridges 8px

const ChainPanel = forwardRef(function ChainPanel(_props, ref) {
  const wrapRef = useRef(null);
  const flowRef = useRef(null);
  // slot refs keyed by an id — hop cards + bridge cards.
  const slotRefs = useRef({});
  const improveTl = useRef(null);
  const rerouteTl = useRef(null);
  const bridgeTls = useRef({});
  const setSlot = (id) => (el) => {
    if (el) slotRefs.current[id] = el;
  };

  // Bridge records (derived once — pure data), each seeded from the tape row
  // that first measured its pair.
  const bPrimary = [['fao', 'dan'], ['dan', 'spa'], ['spa', 'quz']]
    .map(([a, b]) => ({id: `b-${a}-${b}`, a, b, ...bridgeData(a, b)}));
  const bReroute = [['fao', 'eng'], ['eng', 'quz']]
    .map(([a, b]) => ({id: `rb-${a}-${b}`, a, b, ...bridgeData(a, b)}));
  const allBridges = [...bPrimary, ...bReroute];
  const bridgeIdFor = (a, b) => {
    const hit = allBridges.find((br) => qKey(br.a, br.b) === qKey(a, b));
    return hit ? hit.id : null;
  };
  /** clear every live bridge pop — a running pop timeline would fight the
   *  collapse/reveal tweens, which write the same element's transform. */
  const killBridgePops = () => {
    Object.keys(bridgeTls.current).forEach((id) => {
      if (bridgeTls.current[id]) bridgeTls.current[id].kill();
      bridgeTls.current[id] = null;
      const el = slotRefs.current[id];
      if (el) {
        el.style.scale = '';
        el.style.filter = '';
      }
    });
  };

  useImperativeHandle(ref, () => ({
    setWindow(alpha) {
      const el = wrapRef.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      // the wrap is full-width now (the .flow centres the cards); only translateY.
      el.style.transform = `translateY(${((1 - alpha) * 16).toFixed(1)}px)`;
    },
    // The teaching chain reveals hop-by-hop as the winner train crosses (t 0→1).
    // Each primary card + its bridge springs to full at its share of t; pure-p.
    setAssembled(t) {
      const n = PRIMARY.length;
      PRIMARY.forEach((code, i) => {
        const a = clampReveal((t * (n + 0.5) - i) / 1.4);
        const el = slotRefs.current[`h-${code}`];
        if (el) {
          el.style.opacity = String(a);
          el.style.transform = `translateY(${((1 - a) * 12).toFixed(1)}px) scale(${(0.9 + 0.1 * a).toFixed(3)})`;
        }
        if (i > 0) {
          const bel = slotRefs.current[`b-${PRIMARY[i - 1]}-${code}`];
          if (bel) {
            const ba = clampReveal((t * (n + 0.5) - (i - 0.4)) / 1.2);
            bel.style.opacity = String(ba);
          }
        }
      });
    },
    pulseHop(i) {
      const code = PRIMARY[i];
      const el = code && slotRefs.current[`h-${code}`];
      if (!el) return;
      el.classList.remove(styles.hopPulse);
      // reflow so the animation restarts
      void el.offsetWidth;
      el.classList.add(styles.hopPulse);
    },
    /* R8 — THE HOUSE LOCK-AND-POP ON ONE BRIDGE CARD: a new reading just landed
     * on this hop. Founder: the improve stage needs "all those measurements
     * reflected with established pop-effects on the cards".
     *
     * Pops go on BRIDGE cards only, never hop cards. setAssembled writes
     * `el.style.transform` on every hop card every frame, so a pop's scale would
     * be overwritten mid-flight; bridges only receive opacity from it. This is
     * the same reason improve() lands on the target card's glow rather than its
     * transform. */
    popBridge(gsap, a, b, rgbStr) {
      const id = bridgeIdFor(a, b);
      const el = id && slotRefs.current[id];
      if (!el || !gsap) return;
      if (bridgeTls.current[id]) bridgeTls.current[id].kill();
      bridgeTls.current[id] = playLockPop(gsap, el, {rgb: rgbStr, breathe: false});
    },
    resetBridgePop(a, b) {
      const id = bridgeIdFor(a, b);
      if (!id) return;
      if (bridgeTls.current[id]) {
        bridgeTls.current[id].kill();
        bridgeTls.current[id] = null;
      }
      const el = slotRefs.current[id];
      if (el) {
        el.style.scale = '';
        el.style.filter = '';
      }
    },
    improve(gsap) {
      const card = slotRefs.current['h-quz'];
      if (!card || !gsap) return;
      if (improveTl.current) improveTl.current.kill();
      const rough = card.querySelector('[data-rough]');
      const fixed = card.querySelector('[data-fixed]');
      const chipBad = card.querySelector('[data-chip-bad]');
      const chipGood = card.querySelector('[data-chip-good]');
      const tl = gsap.timeline();
      // amber charge (the coaching moment lands on the card's glow, not its
      // transform — setAssembled owns the transform each frame).
      tl.to(card, {boxShadow: '0 0 22px rgba(232,179,57,0.55)', borderColor: 'rgba(232,179,57,0.6)', duration: 0.25}, 0);
      // rough strikes through + collapses; fixed reveals
      if (rough) {
        tl.to(rough, {opacity: 0.35, duration: 0.2}, 0.3);
        tl.set(rough, {textDecoration: 'line-through'}, 0.3);
        tl.to(rough, {height: 0, opacity: 0, marginTop: 0, marginBottom: 0, duration: 0.28, ease: 'power2.in'}, 0.5);
      }
      if (fixed) tl.fromTo(fixed, {height: 0, opacity: 0}, {height: 'auto', opacity: 1, duration: 0.4, ease: 'back.out(1.4)'}, 0.62);
      // score chip: red collapses, green springs
      if (chipBad) tl.to(chipBad, {height: 0, opacity: 0, marginTop: 0, duration: 0.28, ease: 'power2.in'}, 0.55);
      if (chipGood) tl.fromTo(chipGood, {height: 0, opacity: 0, scale: 0.6}, {height: 'auto', opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(1.7)'}, 0.7);
      // border settles green
      tl.to(card, {boxShadow: '0 0 18px rgba(76,175,80,0.32)', borderColor: 'rgba(76,175,80,0.5)', duration: 0.35}, 0.9);
      improveTl.current = tl;
    },
    resetImprove() {
      if (improveTl.current) {
        improveTl.current.kill();
        improveTl.current = null;
      }
      const card = slotRefs.current['h-quz'];
      if (!card) return;
      card.style.boxShadow = '';
      card.style.borderColor = '';
      card.style.transform = card.style.transform.replace(/translateX\([^)]*\)/, '');
      const rough = card.querySelector('[data-rough]');
      const fixed = card.querySelector('[data-fixed]');
      const chipBad = card.querySelector('[data-chip-bad]');
      const chipGood = card.querySelector('[data-chip-good]');
      if (rough) { rough.style.cssText = ''; }
      if (fixed) { fixed.style.height = '0'; fixed.style.opacity = '0'; }
      if (chipBad) { chipBad.style.cssText = ''; }
      if (chipGood) { chipGood.style.height = '0'; chipGood.style.opacity = '0'; }
    },
    reroute(gsap) {
      if (!gsap) return;
      if (rerouteTl.current) rerouteTl.current.kill();
      killBridgePops();
      const tl = gsap.timeline();
      /* R8 — the four-flash PRE-ROLL that used to open this timeline is GONE.
       * It was a stand-in: it flashed green on the three primary bridges and the
       * Spanish card to suggest measured improvements that had never actually
       * happened on the tape. Six real ones now do, ~200vh earlier, with real
       * numbers, real method names and their own pops (see popBridge). Replaying
       * them as decoration here would restate measurements the viewer has
       * already watched land.
       *
       * So the condense starts almost immediately, landing on the row-47 pop
       * that causes it: collapse the bypassed primary path — the fao→dan bridge,
       * the dan + spa cards and their onward bridges all drop out — and fao hops
       * through a single English pivot straight to quz (2 interlingua → 1).
       * TRULY zero (min-width + padding), or the CSS min-width leaves ~100px of
       * invisible card wedged in the chain, mis-centring it. */
      const T0 = 0.06;
      // slower than R7's 0.42/0.44: there are now ~80vh of dwell after this, so
      // the motion can be legible rather than efficient.
      ['b-fao-dan', 'h-dan', 'b-dan-spa', 'h-spa', 'b-spa-quz'].forEach((id, k) => {
        const el = slotRefs.current[id];
        if (el) tl.to(el, {...COLLAPSED, marginLeft: 0, marginRight: 0, duration: 0.55, ease: 'power2.inOut'}, T0 + k * 0.05);
      });
      // reveal the condensed reroute: the English pivot + its two bridges
      // (fao→eng→quz — a SHORTER chain than the base fao→dan→spa→quz).
      ['rb-fao-eng', 'h-eng', 'rb-eng-quz'].forEach((id, k) => {
        const el = slotRefs.current[id];
        if (el) {
          const pad = padFor(id);
          tl.fromTo(el, COLLAPSED, {maxWidth: 200, opacity: 1, paddingLeft: pad, paddingRight: pad, duration: 0.6, ease: 'back.out(1.55)'}, T0 + 0.34 + k * 0.07);
        }
      });
      rerouteTl.current = tl;
    },
    resetReroute() {
      if (rerouteTl.current) {
        rerouteTl.current.kill();
        rerouteTl.current = null;
      }
      killBridgePops();
      // restore the primary path (full reset to CSS; setAssembled re-applies
      // opacity/transform on the next frame since we're no longer rerouted). The
      // pre-roll improvement flashes (all on these collapsed slots) clear too.
      // h-quz is deliberately NOT reset here — improve() owns its persistent
      // green glow, and the reroute never touches it.
      ['b-fao-dan', 'h-dan', 'b-dan-spa', 'h-spa', 'b-spa-quz'].forEach((id) => {
        const el = slotRefs.current[id];
        if (el) el.style.cssText = '';
      });
      // re-collapse the reroute slots (truly zero).
      ['rb-fao-eng', 'h-eng', 'rb-eng-quz'].forEach((id) => {
        const el = slotRefs.current[id];
        if (!el) return;
        Object.assign(el.style, {maxWidth: '0px', minWidth: '0px', opacity: '0', paddingLeft: '0px', paddingRight: '0px'});
      });
    },
    /* R4: the bridges are live mini run-cards. `runs` maps qKey(a,b) → {phase,
     * dwellT, q, rgb, method, corpus, improved}. A missing entry = the pair is
     * still at its default reading. 'measuring' rolls the values (the tape head
     * is on this pair); 'locked' pins the given q in its spectrum colour. Pure
     * per-frame; scrubs both ways.
     *
     * R8 — the METHOD NAME and the corpus line are now live too. That is the
     * whole point of the improve beat: "multiple new methods dropping" is only
     * visible if the card says which method took the reading it is showing. */
    setBridgeRuns(runs) {
      allBridges.forEach((b) => {
        const el = slotRefs.current[b.id];
        if (!el) return;
        const st = runs && runs[qKey(b.a, b.b)];
        const measuring = !!(st && st.phase === 'measuring');
        el.classList.toggle(styles.bridgeMeasuring, measuring);
        el.classList.toggle(styles.bridgeImproved, !!(st && st.improved));
        const q = st && st.q != null ? st.q : b.q;
        const mEl = el.querySelector('[data-method]');
        if (mEl) mEl.textContent = (st && st.method) || b.method;
        const cEl = el.querySelector('[data-corpus]');
        if (cEl) cEl.textContent = st && st.corpus ? 'community corpus' : b.corpusShort;
        b.metrics.forEach((name, k) => {
          const vb = el.querySelector(`[data-mv="${name}"]`);
          if (!vb) return;
          if (measuring) {
            vb.textContent = measureText(name, q, {arrived: true, dwellT: st.dwellT || 0, lockAt: TAPE_LOCK_AT, seed: k + 3});
            vb.style.color = '';
          } else {
            vb.textContent = lockedText(name, q);
            vb.style.color = st && st.rgb ? `rgb(${st.rgb.join(',')})` : '';
          }
        });
      });
    },
  }));

  // hop card renderer
  const HopCard = (code) => {
    const h = HOPS[code];
    const isTarget = code === 'quz';
    return (
      <div
        key={`h-${code}`}
        className={code === 'eng' || code === 'quy' ? styles.pivotCard : styles.hopCard}
        ref={setSlot(`h-${code}`)}
        data-code={code}
        style={code === 'eng' || code === 'quy' ? COLLAPSED : undefined}
      >
        <span className={styles.hopEndo}>{h.endo}</span>
        <span className={styles.hopEn}>{h.en}</span>
        {h.pivot ? (
          <span className={styles.pivotRole}>routing pivot</span>
        ) : isTarget ? (
          <>
            <span className={styles.hopText} data-rough>{h.textRough}</span>
            <span className={styles.hopTextFixed} data-fixed style={{height: 0, opacity: 0}}>{h.textFixed}</span>
            <span className={styles.chipBad} data-chip-bad>
              {CARD_HERO.metric} {CARD_HERO.from}
              <span className={styles.chipLenses}> · {lensLine(0.24)}</span>
            </span>
            <span className={styles.chipGood} data-chip-good style={{height: 0, opacity: 0}}>
              {CARD_HERO.metric} {CARD_HERO.to} <b className={styles.chipDelta}>↑ +{CARD_HERO.to - CARD_HERO.from}</b>
              <span className={styles.chipLenses}> · {lensLine(0.71)}</span>
            </span>
          </>
        ) : (
          <span className={styles.hopText}>{h.text}</span>
        )}
      </div>
    );
  };

  // bridge card renderer — a live mini run-card: corpus · method · licence +
  // a metric table (name + value) that rolls/locks with the tape head.
  const BridgeCard = (b, reroute) => (
    <div
      key={b.id}
      className={styles.bridge}
      ref={setSlot(b.id)}
      style={reroute ? COLLAPSED : undefined}
    >
      <span className={styles.bridgeArrow}>→</span>
      <span className={styles.bridgeCorpus} data-corpus>{b.corpusShort}</span>
      <span className={styles.bridgeMeta}>
        <b data-method>{b.method}</b>
        {b.license ? ` · ${b.license}` : b.has ? '' : ' · unbenchmarked'}
      </span>
      <span className={styles.bridgeMetrics}>
        {b.metrics.slice(0, 3).map((m) => (
          <span key={m} className={styles.bridgeMetricRow}>
            <i>{m}</i>
            <b data-mv={m}>{lockedText(m, b.q)}</b>
          </span>
        ))}
      </span>
    </div>
  );

  // the target card's score chips carry the pair's FULL valid-lens line
  // (chrF++ · spBLEU · TER — never COMET; quz is not XLM-R supported). Values
  // from lensTarget at the rough (0.44) and coached (0.71) qualities.
  const quzLenses = metricsFor('spa', 'quz');
  const lensLine = (q) =>
    quzLenses
      .filter((m) => m !== 'chrF++')
      .map((m) => `${m} ${lockedText(m, q)}`)
      .join(' · ');

  return (
    <div className={styles.wrap} ref={wrapRef} style={{opacity: 0}} aria-hidden="true">
      <div className={styles.flow} ref={flowRef}>
        {/* fao */}
        {HopCard('fao')}
        {/* condensed reroute (collapsed until the route re-forms): fao→eng→quz */}
        {BridgeCard(bReroute[0], true)}
        {HopCard('eng')}
        {BridgeCard(bReroute[1], true)}
        {/* primary teaching chain: fao→dan→spa→quz */}
        {BridgeCard(bPrimary[0], false)}
        {HopCard('dan')}
        {BridgeCard(bPrimary[1], false)}
        {HopCard('spa')}
        {BridgeCard(bPrimary[2], false)}
        {HopCard('quz')}
      </div>
      <div className={styles.caveat}>{SENTENCE} · {CARD_CAVEAT}</div>
    </div>
  );
});

// smootherstep-ish clamp for reveal alphas
function clampReveal(x) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export default ChainPanel;
