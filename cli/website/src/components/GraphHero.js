import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {useHistory} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import ProvenanceTip from './ProvenanceTip';
import GraphEngine, {graphSupported} from './GraphEngine';
// InscriptionFx moved to below-the-fold register (no longer in hero).
import poster from '../data/graph-poster.json';
import FLOORS from '../data/cchrf-floors.json';
import {
  arcStyle,
  MAX_ARCS,
  BIN_COLORS,
  BIN_LABELS,
  UNCORRECTED_COLOR,
} from '../utils/arcStrength.mjs';
import {
  classifyPair,
  CATEGORIES,
  CATEGORY_STYLE,
  CATEGORY_LABELS,
  SERVICE_COLORS,
} from '../utils/pairReachability';
import {loadLangCard} from '../utils/languageLoader';
import {LINE_TYPES, swatchOf} from '../utils/lineTaxonomy.mjs';
import {VITALITY_LEVELS, AT_RISK_VS} from '../utils/vitalityScale';
import {humanizeFamily} from '../utils/humanize';
import styles from './GraphHero.module.css';

/**
 * GraphHero — THE TRANSLATION NETWORK (lab stage; revised
 * concept, plan "The Whole Graph" Track 1).
 *
 * Composition:
 *   - The network canvas pair (GraphEngine): 7,927 language nodes,
 *     organic family neighborhoods, real packets on real benchmarked
 *     routes. Pan/zoom/hover/click; search-lift via
 *     window.__GRAPH_ENGINE.focusLanguage(code).
 *   - The copy overlay: eyebrow · H1 "Every language, into every
 *     language." · aspirational sub-line · the LIVE counter.
 *   - The inscription register has been moved below the zipper
 *     animation for a cleaner hero viewport (see DonateCard area).
 *
 * LIVE counter contract: the lit set ships as the build baseline
 * (graph.json stats.lit — languages appearing in a benchmarked pair in
 * the in-repo run reports); on load we fetch distinct pair codes from
 * the public leaderboard (run_cards select=language_pair, same anon
 * read-only query family as leaderboard.js) and PROMOTE newly-covered
 * nodes to lit. The number only ever goes up.
 *
 * Reduced-motion / no-JS: an SSR'd poster (inline SVG from
 * graph-poster.json, ~700 nodes) + a frozen inscription stand in; a
 * quiet "Enable motion" pill offers a sessionStorage opt-in override.
 * Motion users get the inverse Pause pill. document.hidden and
 * scrolling off-screen stop the loop dead (IO → engine.suspend).
 */

const MOTION_KEY = 'champollion-graph-motion'; // 'on' | 'off'

// Supabase public config — safe to embed (RLS restricts to read-only);
// identical constants to leaderboard.js / RecentRunsStrip.js. Used only by
// the per-pair connection card (click on a measured arc) to list the
// methods actually tested on the live board.
const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

// Ambient (registered, unmeasured) connection layer caps — strongest
// corpora first; phones draw fewer hairlines than desktops.
const AMBIENT_CAP = 600;
const AMBIENT_CAP_MOBILE = 250;

/**
 * The frozen inscription (SSR / reduced-motion / no-JS composition).
 * A REAL entry: eng-cym-dev-v1 (Tatoeba, CC-BY-2.0) entry
 * tatoeba_11472433, run run_20260612_125112_google_gemini35flash
 * (gemini-3.5-flash) — per-entry chrF++ 100.0, run-level composite
 * 0.73 (overall.confidence_intervals.composite_score.score = 0.7285
 * in the report). This is from the validated June 12 archive.
 */
const FROZEN = {
  sourceName: 'English',
  targetName: 'Welsh',
  model: 'gemini-3.5-flash',
  composite: 0.73,
  corpus: 'TATOEBA · CC-BY',
  source: 'She wants water.',
  sourceLang: 'en',
  target: 'Mae hi eisiau dŵr.',
  targetLang: 'cy',
  reference: 'Mae hi eisiau dŵr.',
  chrf: 100.0,
};

/** Per-method tooltip — coverage + source + an honest quality note.
 * Any-to-any methods "translate between" their set; per-pair providers
 * (OPUS-MT, Tilde — anyToAny=false) only COVER languages: a model for any
 * given pair may not exist, so the wording never claims intertranslation. */
function methodTooltip(m) {
  let host = '';
  try {
    host = m.source_url ? new URL(m.source_url).hostname.replace(/^www\./, '') : '';
  } catch (e) {
    host = '';
  }
  const reach =
    m.anyToAny === false
      ? `${m.label}: publishes research models covering ${m.count.toLocaleString('en-US')} languages` +
        ` — per-pair models, NOT any-to-any: a model for a given pair may not exist`
      : `${m.label}: translates between ${m.count.toLocaleString('en-US')} languages`;
  const tier =
    m.tier === 'open'
      ? ' Open research models — free to deploy, quality varies widely.'
      : '';
  return (
    `${reach} — its published coverage${host ? ` (${host})` : ''}.${tier}` +
    ` Quality is strongest on high-resource pairs and thins out toward the` +
    ` margins; only benchmarked pairs carry a measured score (see the` +
    ` leaderboard). Click to show only this method's reach.`
  );
}

/**
 * Motion preference, resolved ONCE before the engine may mount.
 *
 * SSR and the first client render agree on {resolved:false} (poster only,
 * no canvases — hydration-safe). A single effect then reads BOTH signals
 * (prefers-reduced-motion + the sessionStorage override) and flips
 * `resolved` in one state commit, so the derived wantMotion can never go
 * true → false during initial mount. The old shape — wantMotion defaulting
 * true, then two independent effects flipping it — destroyed a freshly
 * mounted engine and REMOUNTED the poster for reduced-motion/opted-out
 * users: the "map blinks back" bug.
 */
function useMotionPreference() {
  const [motion, setMotion] = useState({
    resolved: false,
    reduced: false,
    override: null, // 'on' | 'off' | null
  });
  useEffect(() => {
    let mq = null;
    let reduced = false;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduced = mq.matches;
    } catch (e) {
      /* matchMedia unavailable — treat as no preference */
    }
    let override = null;
    try {
      const stored = window.sessionStorage.getItem(MOTION_KEY);
      if (stored === 'on' || stored === 'off') override = stored;
    } catch (e) {
      /* storage unavailable — OS preference decides */
    }
    setMotion({resolved: true, reduced, override});
    if (!mq) return undefined;
    const onChange = () => setMotion((m) => ({...m, reduced: mq.matches}));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return [motion, setMotion];
}

/** Coarse-pointer (touch-first) detection — pointer TYPE, never UA sniff. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

/**
 * MiniCard — the brief language card (semi-tooltip). Instant fields come
 * from the engine's in-memory graph arrays (nodeInfo); the SSOT enrichment
 * (endonym verification, script, vitality) arrives from the per-language
 * card artifact (loadLangCard → /data/lang-cards/{code}.json — build-time
 * generated from cli/shared/language-cards, so the SSOT chain holds).
 * Bottom sheet on coarse pointers, floating card on desktop.
 */
function MiniCard({card, coarse, onClose, onFullCard}) {
  const {info, full} = card;
  // One ATTRIBUTED estimate (source named) — the full card shows the whole
  // spread. Vitality is deliberately absent here until the vitality
  // pipeline's provenance fix lands (the current card field overstates).
  const speakers =
    full && Array.isArray(full.speakerEstimates) && full.speakerEstimates.length
      ? full.speakerEstimates[0]
      : null;
  return (
    <div
      className={clsx(styles.miniCard, coarse && styles.miniCardSheet)}
      role="group"
      aria-label={`Language: ${info.name}`}
    >
      <div className={styles.miniCardText} aria-live="polite">
        {(full?.nativeName || info.endonym) && (
          <span className={styles.tooltipEndonym}>
            {full?.nativeName || info.endonym}
          </span>
        )}
        <span className={styles.miniCardName}>{info.name}</span>
        <span className={styles.tooltipMeta}>
          {humanizeFamily(info.family) && (
            <>
              {humanizeFamily(info.family)}
              {' · '}
            </>
          )}
          {info.coverageTier === 2
            ? 'covered by a deployed translation service'
            : info.coverageTier === 1
              ? 'listed by an open research model only — not a deployed service'
              : info.measured
                ? 'measured on the public board'
                : info.state === 1
                  ? 'LLM-reachable · frontier'
                  : 'no coverage yet'}
        </span>
        {speakers && typeof speakers.count === 'number' && (
          <span className={styles.tooltipMeta}>
            {speakers.count.toLocaleString('en-US')} speakers ({speakers.source})
          </span>
        )}
      </div>
      <button type="button" className={styles.miniCardGo} onClick={onFullCard}>
        Full card →
      </button>
      <button
        type="button"
        className={styles.miniCardClose}
        aria-label="Dismiss"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

/** SSR poster: the static composition (also the LCP placeholder).
 * `fading` keeps it mounted ABOVE the live canvases while its opacity
 * transitions out — the crossfade half of the poster→engine handoff.
 *
 * Camera parity: a v9+ poster carries `cam` (the engine's first-frame
 * framing, coords pre-baked through the parallax layers by the generator).
 * We render that window with "meet" so the SVG scale equals the engine's
 * cam.z at any viewport: S = world / (1.06 · zMul) makes
 * min(w,h)/S = min(w,h)/world · 1.06 · zMul = zFit · zMul = cam.z, and
 * xMidYMid centering reproduces the engine's (wx−cam.x)·z + w/2. Content
 * outside the viewBox still paints (SVG clips at the viewport, not the
 * viewBox), so edges stay filled. Stale posters without `cam` fall back
 * to the legacy full-world slice.
 *
 * Node radii approximate the engine's screen sizes at a nominal ~800px
 * min-dimension (exact parity across every viewport is impossible for a
 * scaling SVG — the 420ms crossfade absorbs the remainder). */

/**
 * MapLineKey — the complete line legend, rendered from the canonical
 * taxonomy (src/utils/lineTaxonomy.mjs). Every line type the engine draws
 * has exactly one entry there; nothing may be drawn that this key cannot
 * explain. Meanings ride the title tooltip to keep the panel compact.
 */
function MapLineKey() {
  return (
    <div className={styles.lineKey} role="group" aria-label="Line key">
      <span className={styles.lineKeyTitle}>line key</span>
      {LINE_TYPES.map((type) => {
        const sw = swatchOf(type);
        return (
          <span
            key={type.id}
            className={styles.lineKeyItem}
            title={`${type.meaning} — hover: ${type.interactive.hover}; click: ${type.interactive.click}.`}
          >
            {sw.color ? (
              <svg
                className={styles.lineKeySwatch}
                width="26"
                height="8"
                aria-hidden="true"
              >
                <line
                  x1="1"
                  y1="4"
                  x2="25"
                  y2="4"
                  stroke={sw.color}
                  strokeWidth={Math.max(1, Math.min(3, sw.width))}
                  strokeDasharray={sw.dash ? sw.dash.join(' ') : undefined}
                  strokeLinecap="round"
                  opacity={Math.max(0.45, sw.alpha)}
                />
              </svg>
            ) : (
              <span className={styles.lineKeyToken} aria-hidden="true">
                ◆
              </span>
            )}
            {type.label}
          </span>
        );
      })}
    </div>
  );
}

/** One honest strength line for a measured arc (tooltip + card). */
function arcStrengthLine(arc) {
  const base = arc.corrected
    ? `cchrF++ ${arc.cchrf.toFixed(2)} · ${BIN_LABELS[arc.bin]}`
    : `chrF++ ${arc.chrf.toFixed(1)} · floor unknown (uncorrected)`;
  const n = typeof arc.size === 'number' ? ` · n=${arc.size}` : '';
  return base + n + (arc.provisional ? ' · provisional (n<100)' : '');
}

/**
 * ArcCard — the per-pair connection card (click on a measured arc).
 * Instant mesh fields (strength band, best chrF++, corpus n); the live
 * board's per-method rows when they land — which methods were tested and
 * which wins, with each row keeping its direction. Links out to the full
 * leaderboard for the pair and to /route prefilled with it.
 */
function ArcCard({data, coarse, onClose, onLeaderboard, onRoute}) {
  const {arc, rows, error} = data;
  return (
    <div
      className={clsx(styles.miniCard, styles.arcCard, coarse && styles.miniCardSheet)}
      role="group"
      aria-label={`Connection: ${arc.aName} and ${arc.bName}`}
    >
      <div className={styles.miniCardText} aria-live="polite">
        <span className={styles.miniCardName}>
          {arc.aName} ↔ {arc.bName}
        </span>
        <span className={styles.tooltipMeta}>{arcStrengthLine(arc)}</span>
        {arc.corrected && (
          <span className={styles.tooltipMeta}>
            best raw chrF++ {arc.chrf.toFixed(1)} ·{' '}
            {arc.runsCount === 1 ? '1 run' : `${arc.runsCount} runs`} on the board
          </span>
        )}
        {rows === null && !error && (
          <span className={styles.tooltipMeta}>loading methods…</span>
        )}
        {error && (
          <span className={styles.tooltipMeta}>
            board unreachable — live method list unavailable
          </span>
        )}
        {Array.isArray(rows) && rows.length > 0 && (
          <ul className={styles.arcCardRows}>
            {rows.slice(0, 6).map((row, i) => (
              <li
                key={`${row.model_slug}-${row.condition}-${row.language_pair}`}
                className={styles.arcCardRow}
              >
                <span className={styles.arcCardWin}>{i === 0 ? '★' : ''}</span>
                <span className={styles.arcCardMethod}>
                  {row.model_slug.includes('/')
                    ? row.model_slug.slice(row.model_slug.indexOf('/') + 1)
                    : row.model_slug}
                  {row.condition && row.condition !== 'naive'
                    ? ` · ${row.condition}`
                    : ''}
                </span>
                <span className={styles.arcCardDir}>{row.language_pair}</span>
                <span className={styles.arcCardScore}>
                  {typeof row.chrf_plus_plus === 'number'
                    ? row.chrf_plus_plus.toFixed(1)
                    : '—'}
                </span>
              </li>
            ))}
            {rows.length > 6 && (
              <li className={clsx(styles.arcCardRow, styles.arcCardMore)}>
                +{rows.length - 6} more on the board
              </li>
            )}
          </ul>
        )}
      </div>
      <div className={styles.arcCardActions}>
        <button type="button" className={styles.miniCardGo} onClick={onLeaderboard}>
          Full board →
        </button>
        <button type="button" className={styles.miniCardGo} onClick={onRoute}>
          Route via this pair →
        </button>
      </div>
      <button
        type="button"
        className={styles.miniCardClose}
        aria-label="Dismiss"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * HubCard — the service card (tap on a provider hub). States the NATURE of
 * the service honestly (commercial API vs open models, any-to-any vs
 * per-pair), its published coverage with source + as-of date, license when
 * the provider states one, and carries the layer toggle that used to fire
 * blind on hub tap (founder directive 2026-07-19: explain the services,
 * don't clutter the map).
 */
function HubCard({hub, on, coarse, onClose, onToggle}) {
  const natureLine =
    hub.nature ||
    (hub.tier === 'service'
      ? 'Commercial cloud API.'
      : hub.anyToAny === false
        ? 'Open per-pair research models — a model for a given pair may not exist.'
        : 'Open research models.');
  let host = '';
  try {
    host = hub.source_url
      ? new URL(hub.source_url).hostname.replace(/^www\./, '')
      : '';
  } catch (e) {
    host = '';
  }
  return (
    <div
      className={clsx(
        styles.miniCard,
        styles.arcCard,
        styles.hubCard,
        coarse && styles.miniCardSheet,
      )}
      role="group"
      aria-label={`Service: ${hub.label}`}
    >
      <div className={styles.miniCardText} aria-live="polite">
        <span className={styles.miniCardName}>
          <span className={styles.chipSwatch} style={{background: hub.color}} />{' '}
          {hub.label}
        </span>
        <span className={styles.hubCardMeta}>{natureLine}</span>
        <span className={styles.hubCardMeta}>
          {`Covers ${(hub.count || 0).toLocaleString('en-US')} languages — its published list`}
          {hub.asOf ? ` (as of ${hub.asOf})` : ''}
          {hub.anyToAny === false ? ' · per-pair, not any-to-any' : ''}.
        </span>
        {hub.license && (
          <span className={styles.hubCardMeta}>License: {hub.license}.</span>
        )}
        <span className={styles.hubCardMeta}>
          Coverage is never a quality claim — measured scores live on the
          leaderboard.
        </span>
      </div>
      <div className={clsx(styles.arcCardActions, styles.hubCardActions)}>
        {hub.homepage && (
          <a
            className={styles.miniCardGo}
            href={hub.homepage}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website ↗
          </a>
        )}
        {hub.source_url && (
          <a
            className={styles.miniCardGo}
            href={hub.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {host ? `Published list (${host}) ↗` : 'Published list ↗'}
          </a>
        )}
        <button type="button" className={styles.miniCardGo} onClick={onToggle}>
          {on ? 'Hide from map' : 'Show on map'}
        </button>
      </div>
      <button
        type="button"
        className={styles.miniCardClose}
        aria-label="Dismiss"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

function PosterSvg({fading = false}) {
  // v15 posters ship nodes only (binary frame — no routes/hubs/spokes);
  // stale posters' extra keys are simply ignored.
  const {world, nodes, cam} = poster;
  const S = cam ? world / (1.06 * (cam.zMul || 1.16)) : world;
  const viewBox = cam
    ? `${(cam.x - S / 2).toFixed(1)} ${(cam.y - S / 2).toFixed(1)} ${S.toFixed(1)} ${S.toFixed(1)}`
    : `0 0 ${world} ${world}`;
  // Engine-parity radii (cam posters); legacy radii otherwise.
  // Lit restrained / dark elevated (founder 2026-07-19): the poster's
  // composition must read like reality — a vast dark field, a minority of
  // compact lights — never a wall of halo glow.
  const rLitCore = (q) => (cam ? 9 + q * 0.9 : 4.5);
  const rLitHalo = (q) => (cam ? 21 + q * 2 : 11);
  const rDim = (st, q) => (cam ? (st === 1 ? 7.6 + q * 0.9 : 4.2 + q * 1.5) : 2.6 + q * 1);
  return (
    <svg
      className={clsx(styles.poster, fading && styles.posterHidden)}
      viewBox={viewBox}
      preserveAspectRatio={cam ? 'xMidYMid meet' : 'xMidYMid slice'}
      role="img"
      aria-label={`The world's ${(poster.stats.livingTotal || poster.stats.total).toLocaleString('en-US')} living languages as a field of dots. ${((poster.stats.coverage && poster.stats.coverage.serviceLiving) || 0).toLocaleString('en-US')} are covered by a deployed translation service — they glow bright green with a white-hot core. ${((poster.stats.coverage && poster.stats.coverage.openOnlyLiving) || 0).toLocaleString('en-US')} more appear only in an open research model's language list, with no deployed service — dim green, no core. The vast remainder — no machine translation at all — sit as red dots, disconnected. Bright green: a deployed service. Dim green: open research model only. Red: not covered.`}
    >
      {/* The binary poster draws NO lines — no routes, no provider
          spokes, no hubs. Covered/uncovered dots carry the whole story;
          the full hub-and-spoke data view lives behind "View the live
          map" (engine mesh mode). */}
      {/* THREE-tier frame (v17, founder 2026-07-19 "the map must be true"):
          tier 2 = a DEPLOYED SERVICE lists it → green halo + white-hot core
          (the core is the colorblind channel); tier 1 = only an OPEN research
          model lists it (MADLAD-400/NLLB/… — listed, not deployed) → dim teal
          ring, NO core; tier 0 = uncovered living → one soft red dot, no core.
          The poster samples living nodes only; stale posters may still carry
          non-living tuples — the liv flag (index 5, absent → 1) drops them so
          the frame never overstates the field. */}
      {nodes.map(([x, y, st, q, , liv], i) =>
        (liv != null && !liv) ? null : st === 2 ? (
          <g key={i}>
            <circle cx={x} cy={y} r={rLitHalo(q)} className={styles.posterCoveredHalo} />
            <circle cx={x} cy={y} r={rLitCore(q)} className={styles.posterCoveredCore} />
          </g>
        ) : st === 1 ? (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={rDim(st, q)}
            className={styles.posterCoveredOpen}
          />
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={rDim(st, q)}
            className={styles.posterUncovered}
          />
        ),
      )}
    </svg>
  );
}

export default function GraphHero({
  eyebrow = 'THE CHAMPOLLION PROJECT',
  title = 'Every language, into every language.',
  subline,
  // The sovereignty / co-creation pledge — rendered under the subline as
  // a distinct line so the "built with, never scraped" commitment is in
  // the hero viewport, not buried below the fold.
  pledge,
  // Non-interactive by default: the homepage hero is ambient-only — no
  // pan/zoom/drag, scroll passes through to the page. Set interactive
  // to true for dedicated exploration pages.
  interactive = false,
  // Node layout (v18): 'family' = the organic family blobs (default, the live
  // / homepage + map); 'geo' = a rough Earth-map projection (/home-preview
  // opts in — "linking humanity"). Passed straight to the engine.
  layout = 'family',
  // Commit this mount to the dark palette regardless of the site theme, WITHOUT
  // touching <html data-theme> (which would fight the navbar toggle). The
  // engine resolves its tokens against the host section instead — see
  // `forceDark`/`tokenRoot` in GraphEngine and `[data-force-dark]` below.
  forceDark = false,
}) {
  const history = useHistory();
  const [motion, setMotionState] = useMotionPreference();
  const coarse = useCoarsePointer();
  // Handoff phase machine: SSR poster → 420ms crossfade → live canvas.
  // 'poster' until the engine PAINTS its first frame (onFirstFrame), so
  // the poster never unmounts against a blank canvas.
  const [phase, setPhase] = useState('poster'); // 'poster' | 'fading' | 'live'
  const fadeTimerRef = useRef(null);
  // Map view (explore mode): hero copy + page chrome fade, the SAME engine
  // flips interactive (pan/pinch/zoom), controls + Back fade in.
  const [exploring, setExploring] = useState(false);
  const exploringRef = useRef(false);
  // The brief language card: {info} instantly from the graph arrays,
  // {full} once the SSOT per-language card resolves.
  const [card, setCard] = useState(null);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(null);
  // Measured-arc strength hover: {x, y, arc} — arc is the semantic object
  // from arcsDataRef (pair codes/names, band, scores). Nodes win over arcs.
  const [hoverArc, setHoverArc] = useState(null);
  // Per-pair connection card (click on a measured arc): {arc, rows, error}.
  // rows = live per-method board rows (null while loading); error means the
  // board read failed — stated honestly, never rendered as "no runs".
  const [arcCard, setArcCard] = useState(null);
  // Measured-pair arc layer stats (the strength legend); null = no arcs.
  // Ambient (registered/unmeasured) layer stats; null = no ambient layer.
  const [ambientStats, setAmbientStats] = useState(null);
  // Measured-pairs layer toggle — the queue-created connections are
  // method-agnostic MEASURED pairs, so they get their own switch beside
  // the per-method coverage toggles.

  // enterExplore applies the measured overlay per the toggle at CALL time
  // (the callback has an empty dep list — a ref dodges the stale closure).

  // Registered (unmeasured) pairs are DEFAULT OFF (founder 2026-07-17:
  // "no hard-coded connections — all should be through a method"): the
  // default map draws only method-driven visuals; this chip opts the
  // registered-queue hairlines back in inside the map view.
  const [showAmbient, setShowAmbient] = useState(false);
  // Endangerment explorer (Glottolog AES): the subtle ember tint is always
  // on; the panel highlights a chosen SET of levels (vitalityScale v
  // values). Empty set = no boost.
  const [vitLevels, setVitLevels] = useState(() => new Set());
  // The service card (tap on a provider hub): {hub} from engine.hubInfo.
  const [hubCard, setHubCard] = useState(null);
  // Surface-first controls (founder 2026-07-19): the chip row is FOUR
  // controls — Services · Connections · Endangerment · Get involved —
  // and everything else lives one tap deep in a single expandable panel
  // ('services' | 'connections' | 'endangerment' | null, accordion).
  // Panels render inside the controls column (structurally can't overlap
  // the row) and yield to any open card. Surface = visual storytelling;
  // depth = explorable detail.
  const [openPanel, setOpenPanel] = useState(null);
  // Hide the copy overlay so the map itself is viewable. Two-phase:
  // hideCopy plays the fade-out keyframe (animations outrank the inline
  // opacity the field engine may set), copyGone unmounts at its end so the
  // hidden state can never be overridden by other overlay styling.
  const [hideCopy, setHideCopy] = useState(false);
  const [copyGone, setCopyGone] = useState(false);
  const copyTimerRef = useRef(null);
  const arcsDataRef = useRef([]);
  const ambientDataRef = useRef([]);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);
  // Per-method toggle layers: the methods legend from graph.json (bit/count/
  // source) + the active bitmask. All on by default (the union view); synced
  // to the engine's ALL_METHODS union on mount so new bits (tilde=64) match.
  const [methods, setMethods] = useState(null);
  const [activeMask, setActiveMask] = useState(127);
  // Inscription state removed — register moved below zipper animation.

  const rootRef = useRef(null);
  const baseRef = useRef(null);
  const fxRef = useRef(null);
  const engineRef = useRef(null);

  // Effective motion decision — false until the preference has resolved
  // (see useMotionPreference), so the engine mounts at most once and only
  // with the user's real preference.
  const wantMotion =
    motion.resolved &&
    (motion.override === 'on' || (!motion.reduced && motion.override !== 'off'));

  // ------------------------------------------------------- engine mount
  useEffect(() => {
    if (!wantMotion || !graphSupported()) {
      // No engine this pass — the poster simply stands. Phase is NOT
      // touched here: the cleanup of a real engine pass already reset it,
      // and the initial unresolved pass must stay a strict no-op.
      return undefined;
    }
    let cancelled = false;
    let engine = null;
    let io = null;
    Promise.all([
      // Absolute paths on purpose — /data is shared across locale builds.
      fetch('/data/graph.json').then((r) => (r.ok ? r.json() : null)),
      fetch('/data/field.json').then((r) => (r.ok ? r.json() : null)),
      // The mesh rides the SAME gate as graph/field so the engine's FIRST
      // painted frame already carries the connection layers — fetching it
      // after start() would fade the poster's lines out and pop them back
      // in later (the exact blink this handoff exists to kill). Fail-soft:
      // no mesh, no line layers, the graph stands.
      fetch('/mesh.json')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([graph, field, mesh]) => {
        if (cancelled || !graph || !field || !baseRef.current || !fxRef.current) {
          return; // poster simply stands
        }
        engine = new GraphEngine({
          base: baseRef.current,
          fx: fxRef.current,
          graph,
          field,
          interactive,
          layout,
          // The ambient hero is the BINARY marketing frame (covered green
          // vs uncovered-living red + illustrative packets); the full data
          // view is explore-mode ('mesh', flipped by enter/exitExplore).
          displayMode: interactive ? 'mesh' : 'binary',
          forceDark,
          tokenRoot: forceDark ? (rootRef.current || undefined) : undefined,
          // Hover names ride mouse pointers only (the engine gates onMove
          // by pointer type — no UA sniffing). Every click/tap opens the
          // brief language card; from the ambient hero it ALSO enters the
          // map view ("clicking a language is tantamount to view-the-map").
          onHover: (info) => setHover(info),
          onSelect: (info) => {
            if (!exploringRef.current) enterExplore();
            setArcCard(null); // a node card supersedes a pair card
            setHubCard(null);
            showCard(info);
          },
          // Measured-arc strength layer: hover = the strength tooltip,
          // click = the per-pair connection card (methods tested + winner).
          onArcHover: (sel) => {
            if (!sel) {
              setHoverArc(null);
              return;
            }
            const arc = arcsDataRef.current[sel.idx];
            setHoverArc(arc ? {x: sel.x, y: sel.y, arc} : null);
          },
          onArcSelect: (sel) => {
            const arc = arcsDataRef.current[sel.idx];
            if (!arc) return;
            if (!exploringRef.current) enterExplore();
            openArcCard(arc);
          },
          // Hub taps open the service card (nature/license/links + the
          // hide/show toggle inside) — from the ambient hero they also
          // enter the map view, like node taps.
          onHubSelect: (hub) => {
            if (!exploringRef.current) enterExplore();
            setCard(null);
            setArcCard(null);
            setHubCard({hub});
          },
          // The chip row stays in sync with the engine's method mask.
          onMethodsChange: (mask) => setActiveMask(mask),
          // Crossfade trigger: the poster starts fading only once a real
          // frame is on screen, and unmounts after the transition ends.
          onFirstFrame: () => {
            if (cancelled) return;
            setPhase('fading');
            clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = setTimeout(() => setPhase('live'), 480);
          },
        });
        engineRef.current = engine;
        window.__GRAPH_ENGINE = engine; // search-lift hook
        if (Array.isArray(graph.methods)) {
          setMethods(graph.methods);
          setActiveMask(engine.ALL_METHODS);
        }
        // Connection layers — set BEFORE start(), so the FIRST painted
        // frame already carries the network and the poster crossfade is
        // line-to-line, never line-to-blank.
        if (mesh && Array.isArray(mesh.edges)) {
          const alias = engine.alias || {};
          const idxOf = (code) => {
            const i = engine.idxByCode.get(code);
            return i != null ? i : engine.idxByCode.get(alias[code]);
          };
          // Ambient layer: registered (queued, NOT yet measured) pairs,
          // classified by reachability — never a quality claim (see
          // pairReachability.js). The cap is PER CATEGORY (strongest
          // corpora first within each): a global size-sorted cap would
          // crowd the frontier lane out with big service-covered corpora,
          // and the frontier is the story.
          // Selection always uses the desktop cap; phones LIMIT AT DRAW
          // TIME (each group carries mobilePairs, pairs are strongest-
          // first) — viewport width at mount is unreliable mid-layout,
          // and a resize should adapt without re-selecting.
          const catCap = Math.ceil(AMBIENT_CAP / 3);
          const mobilePairsPerCat = Math.ceil(AMBIENT_CAP_MOBILE / 3);
          const registered = mesh.edges
            .filter((e) => e && e.status === 'registered')
            .sort((a, b) => (b.size || 0) - (a.size || 0));
          const groupPairs = {commercial: [], open: [], frontier: []};
          const ambientCounts = {commercial: 0, open: 0, frontier: 0};
          let ambientTotal = 0;
          for (const e of registered) {
            const si = idxOf(e.a);
            const ti = idxOf(e.b);
            if (si == null || ti == null) continue;
            const cat = classifyPair(engine.mask[si], engine.mask[ti]);
            if (ambientCounts[cat] >= catCap) continue;
            groupPairs[cat].push(si, ti);
            ambientCounts[cat] += 1;
            ambientTotal += 1;
          }
          const ambientGroups = CATEGORIES.filter(
            (c) => groupPairs[c].length,
          ).map((c) => ({
            ...CATEGORY_STYLE[c],
            pairs: groupPairs[c],
            mobilePairs: mobilePairsPerCat,
          }));
          // Built + counted, but NOT set on the engine: the registered
          // layer is default-off (no hard-coded connections in the default
          // frame). The explore-mode "Registered" chip opts it in from
          // ambientDataRef.
          ambientDataRef.current = ambientGroups;
          setAmbientStats(
            ambientTotal
              ? {counts: ambientCounts, total: ambientTotal, of: registered.length}
              : null,
          );

          /* The measured layer used to be BUILT here, from mesh.json's
             `status: 'measured'` edges. It is gone: that file is a build
             snapshot, and rendering its scores as "pairs with a scored run on
             the public board" made a claim this component could not check.
             Measured results live on /tested now, read from the live board
             with every run's conditions attached. This block still reads the
             snapshot for the REGISTERED pairs above — those are corpus
             registrations, not results, and carry no score. */
        }
        // A "View the map" click from the static poster mounted us —
        // honour it now that the engine exists.
        if (pendingExploreRef.current) {
          pendingExploreRef.current = false;
          enterExplore();
        }
        if (typeof IntersectionObserver !== 'undefined') {
          io = new IntersectionObserver(
            (entries) => {
              if (!engine) return;
              if (entries[0].isIntersecting) {
                if (!engine.userPaused) engine.start();
              } else {
                engine.suspend();
                // Never strand touchAction:'none' on an off-screen hero —
                // scrolling away always releases the map view.
                if (exploringRef.current) exitExploreRef.current();
              }
            },
            {threshold: 0.04},
          );
          io.observe(fxRef.current);
        } else {
          engine.start();
        }
        // (The live run_cards promote fetch is gone, 2026-07-17: node
        // brightness is strictly coverage now — benchmark counts live on
        // the leaderboard, not the hero — and the counter it fed was
        // never rendered.)
      })
      .catch(() => {
        /* poster stands; page still works */
      });
    return () => {
      cancelled = true;
      clearTimeout(fadeTimerRef.current);
      if (io) io.disconnect();
      if (engine) {
        engine.destroy();
        if (window.__GRAPH_ENGINE === engine) delete window.__GRAPH_ENGINE;
        engineRef.current = null;
        // Only a pass that actually ran an engine returns to the poster —
        // an instant swap here is deliberate (the user asked for static).
        setPhase('poster');
      }
    };
  }, [wantMotion, history]);

  // Inscription choreography removed — register moved below zipper.

  // ----------------------------------------------------------- controls
  const setMotion = useCallback(
    (on) => {
      try {
        window.sessionStorage.setItem(MOTION_KEY, on ? 'on' : 'off');
      } catch (e) {
        /* preference simply won't persist */
      }
      setMotionState((m) => ({...m, override: on ? 'on' : 'off'}));
    },
    [setMotionState],
  );

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) {
      engine.userPaused = false;
      engine.start();
    } else {
      engine.userPaused = true;
      engine.suspend();
    }
    setPaused(!paused);
  }, [paused]);

  // --------------------------------------------------------- map view
  // The brief language card: instant graph fields now, SSOT enrichment
  // (per-language card artifact) when it lands. Stale responses are
  // ignored by matching the code.
  const showCard = useCallback((info) => {
    setCard({info, full: null});
    loadLangCard(info.code)
      .then((full) => {
        setCard((prev) =>
          prev && prev.info.code === info.code ? {...prev, full} : prev,
        );
      })
      .catch(() => {
        /* enrichment unavailable — the graph fields stand */
      });
  }, []);

  const closeCard = useCallback(() => {
    setCard(null);
    if (engineRef.current) engineRef.current.setHover(-1);
  }, []);

  // Per-pair connection card: instant mesh fields now, the live board's
  // per-method rows when they land (the same read-only run_cards REST the
  // leaderboard uses). Both directions are fetched — the arc is undirected,
  // the board is directed — and each row keeps its direction label.
  const openArcCard = useCallback((arc) => {
    setCard(null);
    setHubCard(null);
    setHoverArc(null);
    setArcCard({arc, rows: null, error: false});
    const orFilter = encodeURIComponent(
      `(language_pair.eq.${arc.a}>${arc.b},language_pair.eq.${arc.b}>${arc.a})`,
    );
    const url =
      `${SUPABASE_URL}/rest/v1/run_cards` +
      `?select=language_pair,model_slug,condition,chrf_plus_plus,submitted_at` +
      `&or=${orFilter}&trust=neq.disqualified` +
      `&order=chrf_plus_plus.desc.nullslast&limit=60`;
    fetch(url, {headers: {apikey: SUPABASE_ANON_KEY}})
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        // Best row per METHOD (model × condition), order preserved
        // (already strongest-first) — "which methods were tested, which wins".
        const seen = new Set();
        const rows = [];
        for (const row of Array.isArray(data) ? data : []) {
          const key = `${row.model_slug}|${row.condition}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push(row);
        }
        setArcCard((prev) =>
          prev && prev.arc.a === arc.a && prev.arc.b === arc.b
            ? {...prev, rows}
            : prev,
        );
      })
      .catch(() => {
        setArcCard((prev) =>
          prev && prev.arc.a === arc.a && prev.arc.b === arc.b
            ? {...prev, rows: [], error: true}
            : prev,
        );
      });
  }, []);

  const closeArcCard = useCallback(() => setArcCard(null), []);
  const closeHubCard = useCallback(() => setHubCard(null), []);

  // The service card's toggle: flip the layer, keep the card open with the
  // fresh on/off state (activeMask is the render-time source of truth).
  const toggleHubFromCard = useCallback(() => {
    setHubCard((prev) => {
      if (!prev) return prev;
      const engine = engineRef.current;
      if (engine) {
        engine.setActiveMethods(engine.activeMethods ^ prev.hub.bit);
        setActiveMask(engine.activeMethods);
      }
      return prev;
    });
  }, []);

  // Endangerment explorer: toggle one AES level's highlight.
  const toggleVitLevel = useCallback((v) => {
    setVitLevels((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      if (engineRef.current) engineRef.current.setVitalityHighlight(next);
      return next;
    });
  }, []);

  // …and the all-at-risk master switch (the old "At risk" chip behavior).
  const toggleVitAll = useCallback(() => {
    setVitLevels((prev) => {
      const allOn = AT_RISK_VS.every((v) => prev.has(v));
      const next = allOn ? new Set() : new Set(AT_RISK_VS);
      if (engineRef.current) engineRef.current.setVitalityHighlight(next);
      return next;
    });
  }, []);

  const enterExplore = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // The live map is the full data view: flip out of the binary hero
    // frame and apply the Champollion-tested overlay per its toggle.
    engine.setDisplayMode('mesh');
    // No measured overlay on this map — see /tested (the door in the panel).
    engine.setMeasuredArcs([]);
    engine.setInteractive(true);
    // A paused engine renders no frames — pan/pinch would feel dead.
    if (engine.userPaused) {
      engine.userPaused = false;
      engine.start();
      setPaused(false);
    }
    setHideCopy(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyGone(true), 380);
    // Page chrome (navbar, announcement bar) fades via this attribute —
    // data attrs, not classes: react-helmet owns the html class attr.
    document.documentElement.setAttribute('data-map-exploring', '');
    exploringRef.current = true;
    setExploring(true);
  }, []);

  const exitExplore = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setInteractive(false);
      engine.resetView(); // glide home
      // The ambient hero must return to the BINARY frame: every explore
      // layer (measured arcs, registered hairlines, level highlights)
      // resets — the marketing backdrop never shows data overlays.
      engine.setDisplayMode('binary');
      engine.setMeasuredArcs([]);
      engine.setAmbientArcs([]);
      engine.setVitalityHighlight(null);
    }
    setShowAmbient(false);
    setVitLevels(new Set());
    setOpenPanel(null);
    setHideCopy(false);
    setCopyGone(false);
    setCard(null);
    setArcCard(null);
    setHubCard(null);
    setHoverArc(null);
    if (engine) engine.setHover(-1);
    setHover(null);
    document.documentElement.removeAttribute('data-map-exploring');
    exploringRef.current = false;
    setExploring(false);
  }, []);
  const exitExploreRef = useRef(exitExplore);
  useEffect(() => {
    exitExploreRef.current = exitExplore;
  }, [exitExplore]);

  // "View the map" must work for static-view/reduced-motion users too:
  // mount the engine on demand, then enter explore once it's ready (the
  // mount effect drains pendingExploreRef after setup).
  const pendingExploreRef = useRef(false);
  const requestExplore = useCallback(() => {
    if (engineRef.current) {
      enterExplore();
    } else {
      pendingExploreRef.current = true;
      setMotion(true);
    }
  }, [enterExplore, setMotion]);

  // Escape leaves the map view; the attribute is cleaned up on unmount.
  useEffect(() => {
    if (!exploring) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') exitExplore();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, exitExplore]);

  // One panel at a time; a chip tap toggles its own panel (accordion).
  const togglePanel = useCallback((id) => {
    setOpenPanel((p) => (p === id ? null : id));
  }, []);
  useEffect(
    () => () => document.documentElement.removeAttribute('data-map-exploring'),
    [],
  );

  // ------------------------------------------------------------ display
  // All counts come from the build-time poster stats (read straight from the
  // cited cards). Robust fallbacks so a stale committed poster never throws.
  const stats = poster.stats || {};
  const cov = stats.coverage || {};
  const fmt = (n) => (typeof n === 'number' ? n : 0).toLocaleString('en-US');
  // Living-qualified coverage (v10 stats). Stale-poster fallback: the raw
  // union — never invent a number.
  const dedLiving = cov.dedicatedLiving != null ? cov.dedicatedLiving : cov.dedicated;
  const atRisk = stats.atRisk || null;

  return (
    <section
      className={styles.hero}
      ref={rootRef}
      /* The hero is a positional COMPOSITION: canvas particles are painted
         with LTR coordinate math and the DOM copy is laid over them. Under
         an RTL locale (ar), html[dir=rtl] flipped the overlay's flex/text
         logic while the canvas stayed LTR — the title clipped off the left
         edge and the "559 of 7,082" counter bidi-reordered. The composition
         declares its own direction; RTL text inside still shapes correctly
         (bidi is per-text-run), and the navbar/docs stay RTL. */
      dir="ltr"
      data-graph-live={phase !== 'poster' ? '1' : undefined}
      data-exploring={exploring ? '1' : undefined}
      data-force-dark={forceDark ? '1' : undefined}>
      {/* Network layers: SSR poster first paint; the canvases render
          UNDERNEATH it, and the poster crossfades out only after the
          engine's first painted frame (onFirstFrame) — no blink, no
          blank-canvas gap. */}
      <div className={styles.stage} aria-hidden={phase === 'live' ? 'true' : undefined}>
        {wantMotion && (
          <>
            <canvas ref={baseRef} className={styles.canvas} aria-hidden="true" />
            <canvas ref={fxRef} className={clsx(styles.canvas, styles.canvasTop)} aria-hidden="true" />
          </>
        )}
        {phase !== 'live' && <PosterSvg fading={phase === 'fading'} />}
      </div>

      {/* Copy overlay — fades out via keyframe, then unmounts entirely in
          "View the map" mode so no overlay styling or field-avoid animation
          can keep it visible. */}
      {copyGone ? null : (
      <div
        className={clsx(styles.copy, hideCopy && styles.copyFading)}
        data-hero-copy=""
        data-field-avoid>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {subline ? <p className={styles.subline}>{subline}</p> : null}
        {/* CTA trio (founder direction 2026-07-17): Get involved (primary,
            the funnel) · Explore languages (the atlas) · Learn more (the
            mission docs). The map keeps its own quiet door below. */}
        <div className={styles.ctaRow}>
          {/* The primary CTA used to preventDefault onto `#get-involved` and
              then look for an id no page carries — on the homepage seam it was
              a button that did nothing. It now navigates to the funnel page,
              and only intercepts when a real in-page anchor exists. */}
          <Link
            className={styles.ctaPrimary}
            to="/get-involved"
            onClick={(e) => {
              const el = document.getElementById('get-involved');
              if (el) {
                e.preventDefault();
                el.scrollIntoView({behavior: 'smooth'});
              }
            }}
          >
            <Translate id="homepage.v4.hero.ctaInvolved" description="Hero primary CTA">
              Get involved
            </Translate>
            {' →'}
          </Link>
          <Link className={styles.ctaSecondary} to="/languages">
            <Translate id="homepage.v4.hero.ctaExplore" description="Hero secondary CTA">
              Explore languages
            </Translate>
          </Link>
          <Link className={styles.ctaTertiary} to="/docs/network/">
            <Translate id="homepage.v4.hero.ctaLearn" description="Hero tertiary CTA">
              Learn more
            </Translate>
          </Link>
        </div>
        {/* ONE honest number, living-qualified (the old three-stat strip
            wrapped badly and buried the gap): 383 of 7,077. The tier
            breakdown + at-risk figures live in the provenance tip. */}
        <p className={styles.counter}>
          <span className={styles.counterItem}>
            <span className={styles.counterNum}>{fmt(dedLiving)}</span>
            {' of '}
            <span className={styles.counterNum}>{fmt(stats.livingTotal)}</span>{' '}
            <Translate id="homepage.v4.hero.statLabel" description="Hero coverage stat label">
              living languages have machine translation today
            </Translate>
            <ProvenanceTip
              source={
                'Living languages: ISO 639-3 individual living languages (isoType L). ' +
                'Coverage: DISTINCT LIVING languages at least one dedicated engine ' +
                'lists as supported, deduplicated. Of these, ' +
                fmt(cov.serviceLiving != null ? cov.serviceLiving : 0) +
                ' have a deployable consumer service (Google, Microsoft, DeepL, ' +
                'LibreTranslate) and ' +
                fmt(cov.openOnlyLiving != null ? cov.openOnlyLiving : 0) +
                ' more appear ONLY in an open research model’s published language ' +
                'list (MADLAD-400, NLLB-200, M2M-100, OPUS-MT, Tilde) with no ' +
                'deployed service — a code in a model card is not a usable service, ' +
                'and those cards warn tail-language quality varies widely; on the ' +
                'map these are dim green, not bright. A further ' +
                fmt(cov.coveredNonLiving != null ? cov.coveredNonLiving : 0) +
                ' covered codes are historical or constructed languages (Latin, ' +
                'Esperanto…) and are excluded from this count. ' +
                (atRisk
                  ? `At risk: ${fmt(atRisk.total)} living languages are shifting, ` +
                    'endangered, critical, or dormant per the Glottolog AES ' +
                    `(champollion-derived), and ${fmt(atRisk.uncovered)} of those have ` +
                    'no machine translation at all. '
                  : '') +
                'Coverage is not a quality claim — measured scores live on the leaderboard.'
              }
              date="2026-07-17"
            />
          </span>
        </p>
        {pledge ? <p className={styles.pledge}>{pledge}</p> : null}
        <div className={styles.mapRow}>
          <button type="button" className={styles.viewMapBtn} onClick={requestExplore}>
            <Translate id="homepage.v4.hero.ctaMap" description="Hero map door">
              View the live map
            </Translate>
          </button>
        </div>
      </div>
      )}

      {/* Scroll cue — the hero's second door: the story below. */}
      {!exploring && !copyGone && (
        <button
          type="button"
          className={styles.scrollCue}
          onClick={() =>
            window.scrollTo({top: window.innerHeight, behavior: 'smooth'})
          }
        >
          <span>
            <Translate id="homepage.v4.hero.scrollCue" description="Hero scroll cue">
              keep scrolling to learn more
            </Translate>
          </span>
          <span className={styles.scrollCueArrow} aria-hidden="true">
            ▾
          </span>
        </button>
      )}

      {/* Map view chrome: Back door + the layer controls. */}
      {exploring && (
        <>
          <button type="button" className={styles.backBtn} onClick={exitExplore}>
            {'← '}
            <Translate id="homepage.v4.map.back" description="Explore-mode back button">
              Back
            </Translate>
          </button>
          <div
            className={styles.mapControls}
            role="group"
            aria-label="Map layers and actions"
          >
            {/* Panels live IN the controls column, above the chip row —
                same containing block, so a panel and the chips can never
                overlap. ONE panel at a time (accordion); any open card
                supersedes. Surface = the four chips; depth = these. */}
            {openPanel === 'services' && !card && !arcCard && !hubCard &&
              methods && methods.length ? (
              <div
                className={styles.controlsPanel}
                role="group"
                aria-label="Services and models"
              >
                <span className={styles.arcLegendTitle}>
                  Services &amp; models — each provider&apos;s published
                  coverage. Tap to show/hide its layer; tap its hub on the
                  map for details.
                </span>
                <div className={styles.panelGroup}>
                  <span className={styles.panelGroupLabel}>
                    commercial APIs
                  </span>
                  {methods
                    .filter((m) => m.count > 0 && m.tier === 'service')
                    .map((m) => {
                      const on = (activeMask & m.bit) !== 0;
                      return (
                        <button
                          type="button"
                          key={m.key}
                          className={clsx(
                            styles.coverageChip,
                            styles.coverageToggle,
                            on && styles.coverageChipOn,
                          )}
                          aria-pressed={on}
                          title={methodTooltip(m)}
                          onClick={() => {
                            const next = on
                              ? activeMask & ~m.bit
                              : activeMask | m.bit;
                            setActiveMask(next);
                            if (engineRef.current) {
                              engineRef.current.setActiveMethods(next);
                            }
                          }}
                        >
                          <span
                            className={styles.chipSwatch}
                            style={{background: SERVICE_COLORS[m.key] || '#8b95a7'}}
                          />
                          {m.label} <b>{fmt(m.count)}</b>
                        </button>
                      );
                    })}
                </div>
                <div className={styles.panelGroup}>
                  <span className={styles.panelGroupLabel}>open models</span>
                  {methods
                    .filter((m) => m.count > 0 && m.tier !== 'service')
                    .map((m) => {
                      const on = (activeMask & m.bit) !== 0;
                      return (
                        <button
                          type="button"
                          key={m.key}
                          className={clsx(
                            styles.coverageChip,
                            styles.coverageToggle,
                            on && styles.coverageChipOn,
                          )}
                          aria-pressed={on}
                          title={methodTooltip(m)}
                          onClick={() => {
                            const next = on
                              ? activeMask & ~m.bit
                              : activeMask | m.bit;
                            setActiveMask(next);
                            if (engineRef.current) {
                              engineRef.current.setActiveMethods(next);
                            }
                          }}
                        >
                          <span
                            className={styles.chipSwatch}
                            style={{background: SERVICE_COLORS[m.key] || '#8b95a7'}}
                          />
                          {m.label} <b>{fmt(m.count)}</b>
                        </button>
                      );
                    })}
                </div>
                {/* THE MEASURED LAYER IS A DOOR NOW (2026-08-19), not an
                    overlay. It drew arcs out of static/mesh.json — a
                    2026-07-19 BUILD SNAPSHOT — while telling the reader they
                    were "pairs with a scored run on the public board". The
                    board has moved on since that file was cut, so the claim
                    was one this page could not back, and shipping it beside
                    /tested would have meant two measured maps in the product
                    disagreeing about what an edge means.

                    /tested reads the live board, keeps every run's conditions
                    attached to its number, and treats absence as data. This
                    chip routes there. Explore mode keeps what it can still
                    assert from local data: coverage, services, endangerment. */}
                <div className={styles.panelGroup}>
                  <span className={styles.panelGroupLabel}>
                    champollion-tested
                  </span>
                  <Link
                    className={clsx(styles.coverageChip, styles.coverageToggle)}
                    to="/tested"
                    title={
                      'What Champollion has actually measured — every scored ' +
                      'pair on the live board, with the method, dataset, ' +
                      'metric and corpus size behind each number.'
                    }
                  >
                    <span
                      className={styles.chipSwatch}
                      style={{background: BIN_COLORS[3]}}
                    />
                    the measured map →
                  </Link>
                </div>
              </div>
            ) : null}
            {openPanel === 'connections' && !card && !arcCard && !hubCard && (
              <div
                className={styles.controlsPanel}
                role="group"
                aria-label="Connections"
              >
                <span className={styles.arcLegendTitle}>
                  Connections between languages — queued registrations
                  awaiting measurement. (Measured scores: the
                  Champollion-tested layer in Services.)
                </span>
                <div className={styles.panelGroup}>
                  {ambientStats ? (
                    <button
                      type="button"
                      className={clsx(
                        styles.coverageChip,
                        styles.coverageToggle,
                        showAmbient && styles.coverageChipOn,
                      )}
                      aria-pressed={showAmbient}
                      title={
                        'Registered pairs — corpus pairs in the public queue awaiting ' +
                        'measurement, classified by reachability. These are queue ' +
                        'registrations, NOT connections a method provides — off by ' +
                        'default so the map only draws method-driven links.'
                      }
                      onClick={() => {
                        const next = !showAmbient;
                        setShowAmbient(next);
                        if (engineRef.current) {
                          engineRef.current.setAmbientArcs(
                            next ? ambientDataRef.current : [],
                          );
                        }
                      }}
                    >
                      Registered <b>{fmt(ambientStats.total)}</b>
                    </button>
                  ) : null}
                </div>
                {ambientStats && showAmbient && (
                  <>
                    <span className={styles.arcLegendTitle}>
                      {ambientStats.total.toLocaleString('en-US')}
                      {ambientStats.of > ambientStats.total
                        ? ` of ${ambientStats.of.toLocaleString('en-US')}`
                        : ''}{' '}
                      registered {ambientStats.total === 1 ? 'pair' : 'pairs'} —
                      queued, not yet measured
                    </span>
                    {CATEGORIES.filter((c) => ambientStats.counts[c] > 0).map((c) => (
                      <span key={c} className={styles.arcLegendItem}>
                        <span
                          className={styles.arcLegendSwatch}
                          style={{background: CATEGORY_STYLE[c].color}}
                        />
                        {CATEGORY_LABELS[c]}
                      </span>
                    ))}
                  </>
                )}
                <MapLineKey />
                <a
                  className={styles.arcLegendLink}
                  href="/docs/network/specifications/connection-strength">
                  how strength is measured
                </a>
              </div>
            )}
            {openPanel === 'endangerment' && atRisk && atRisk.byLevel &&
              !card && !arcCard && !hubCard && (
              <div
                className={styles.controlsPanel}
                role="group"
                aria-label="Endangerment explorer"
              >
                <span className={styles.arcLegendTitle}>
                  Endangerment — Glottolog AES · tap a level to light it up ·{' '}
                  <i>no MT</i> = no machine translation at all
                  <ProvenanceTip
                    source={
                      'Per-language levels: Glottolog’s Agglomerated ' +
                      'Endangerment Status (AES) — the authoritative rating, ' +
                      'cited on every language card. The totals and the ' +
                      'no-MT remainders shown here are computed by ' +
                      'Champollion from those per-language ratings joined ' +
                      'with each provider’s published coverage list; ' +
                      'Glottolog publishes no such totals, so the AGGREGATES ' +
                      'carry champollion-derived provenance rather than ' +
                      'being attributed to Glottolog.'
                    }
                    date="2026-07-19"
                  />
                </span>
                <div className={styles.vitRows}>
                  <button
                    type="button"
                    className={clsx(
                      styles.vitRow,
                      AT_RISK_VS.every((v) => vitLevels.has(v)) &&
                        styles.vitRowOn,
                    )}
                    aria-pressed={AT_RISK_VS.every((v) => vitLevels.has(v))}
                    onClick={toggleVitAll}
                  >
                    <span
                      className={styles.vitSwatch}
                      style={{
                        background:
                          'linear-gradient(90deg,#e0a33a,#e0763a,#e0503a,#a08bb8)',
                      }}
                    />
                    <span className={styles.vitLabel}>All at risk</span>
                    <span className={styles.vitCount}>
                      {fmt(atRisk.total)}
                      <em> · {fmt(atRisk.uncovered)} no MT</em>
                    </span>
                  </button>
                  {VITALITY_LEVELS.map((lvl) => {
                    const row = atRisk.byLevel[lvl.id];
                    if (!row || !row.total) return null;
                    const on = vitLevels.has(lvl.v);
                    return (
                      <button
                        type="button"
                        key={lvl.id}
                        className={clsx(styles.vitRow, on && styles.vitRowOn)}
                        aria-pressed={on}
                        title={lvl.desc}
                        disabled={!lvl.atRisk}
                        onClick={lvl.atRisk ? () => toggleVitLevel(lvl.v) : undefined}
                      >
                        <span
                          className={styles.vitSwatch}
                          style={{background: lvl.color}}
                        />
                        <span className={styles.vitLabel}>{lvl.label}</span>
                        <span className={styles.vitCount}>
                          {fmt(row.total)}
                          <em> · {fmt(row.uncovered)} no MT</em>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {atRisk.byLevel.unknown && atRisk.byLevel.unknown.total > 0 && (
                  <span className={styles.arcLegendItem}>
                    + {fmt(atRisk.byLevel.unknown.total)} living languages with
                    no AES rating (shown unhighlighted)
                  </span>
                )}
              </div>
            )}
            {/* The SURFACE: four chips. Everything detailed lives one tap
                deep in the panels above (founder 2026-07-19: perspicacious
                at a glance, explorable depths behind it). */}
            <div className={styles.controlsRow}>
            {methods && methods.length ? (
              <button
                type="button"
                className={clsx(
                  styles.coverageChip,
                  styles.coverageToggle,
                  openPanel === 'services' && styles.coverageChipOn,
                )}
                aria-pressed={openPanel === 'services'}
                aria-expanded={openPanel === 'services'}
                title={
                  'The tracked translation services & models — commercial ' +
                  'APIs and open research models, each with its published ' +
                  'coverage. Opens the layer toggles.'
                }
                onClick={() => togglePanel('services')}
              >
                Services{' '}
                <b>
                  {(() => {
                    const avail = methods.filter((m) => m.count > 0);
                    const on = avail.filter((m) => (activeMask & m.bit) !== 0);
                    return on.length < avail.length
                      ? `${on.length}/${avail.length}`
                      : avail.length;
                  })()}
                </b>
              </button>
            ) : null}
            {ambientStats && (
              <button
                type="button"
                className={clsx(
                  styles.coverageChip,
                  styles.coverageToggle,
                  openPanel === 'connections' && styles.coverageChipOn,
                )}
                aria-pressed={openPanel === 'connections'}
                aria-expanded={openPanel === 'connections'}
                title={
                  'Connections between languages: registered (queued, ' +
                  'unmeasured) pairs — with the line key explaining every ' +
                  'stroke on the map. Measured scores live under Services ' +
                  'as the Champollion-tested layer.'
                }
                onClick={() => togglePanel('connections')}
              >
                Connections
                {ambientStats ? <b> {fmt(ambientStats.total)}</b> : null}
              </button>
            )}
            {atRisk ? (
              <button
                type="button"
                className={clsx(
                  styles.coverageChip,
                  styles.coverageToggle,
                  (openPanel === 'endangerment' || vitLevels.size > 0) &&
                    styles.coverageChipOn,
                )}
                aria-pressed={openPanel === 'endangerment'}
                aria-expanded={openPanel === 'endangerment'}
                title={
                  `Endangerment — Glottolog AES: ${fmt(atRisk.total)} living ` +
                  `languages are at risk, ${fmt(atRisk.uncovered)} of them ` +
                  'with no machine translation at all (totals computed by ' +
                  'Champollion from Glottolog’s per-language ratings). Opens ' +
                  'the level explorer.'
                }
                onClick={() => {
                  // Stale committed poster without byLevel: fall back to
                  // the plain all-at-risk toggle rather than an empty panel.
                  if (!atRisk.byLevel) {
                    toggleVitAll();
                    return;
                  }
                  togglePanel('endangerment');
                }}
              >
                Endangerment <b>{fmt(atRisk.total)}</b>
              </button>
            ) : null}
            <a
              className={styles.getInvolved}
              href="#get-involved"
              onClick={(e) => {
                e.preventDefault();
                exitExplore();
                const el = document.getElementById('get-involved');
                if (el) el.scrollIntoView({behavior: 'smooth'});
              }}
            >
              <Translate id="homepage.v4.map.getInvolved" description="Explore-mode funnel link">
                Get involved
              </Translate>
              {' →'}
            </a>
            </div>
          </div>
        </>
      )}

      {/* Hover tooltip — language NAME + endonym, never a bare code. The
          brief card supersedes it (a click promotes hover → card). */}
      {hover && !card && (
        <div
          className={styles.tooltip}
          style={{transform: `translate(${Math.round(hover.x)}px, ${Math.round(hover.y)}px)`}}
          role="status"
        >
          {hover.endonym && <span className={styles.tooltipEndonym}>{hover.endonym}</span>}
          <span className={styles.tooltipName}>{hover.name}</span>
          <span className={styles.tooltipMeta}>
            {humanizeFamily(hover.family) && (
              <>
                {humanizeFamily(hover.family)}
                {' · '}
              </>
            )}
            {hover.coverageTier === 2
              ? 'covered by a deployed translation service'
              : hover.coverageTier === 1
                ? 'listed by an open research model only — not a deployed service'
                : hover.measured
                  ? 'measured on the public board'
                  : hover.state === 1
                    ? 'LLM-reachable · frontier'
                    : 'no coverage yet'}
          </span>
        </div>
      )}

      {/* Measured-arc strength tooltip (hover between nodes). Anchored to
          the arc's projected midpoint; nodes win, cards supersede. */}
      {hoverArc && !hover && !card && !arcCard && !hubCard && (
        <div
          className={styles.tooltip}
          style={{transform: `translate(${Math.round(hoverArc.x)}px, ${Math.round(hoverArc.y)}px)`}}
          role="status"
        >
          <span className={styles.tooltipName}>
            {hoverArc.arc.aName} ↔ {hoverArc.arc.bName}
          </span>
          <span className={styles.tooltipMeta}>{arcStrengthLine(hoverArc.arc)}</span>
          <span className={styles.tooltipMeta}>click for methods &amp; routes</span>
        </div>
      )}

      {/* Inscription register removed — moved below zipper animation. */}

      {/* The brief language card (click/tap on a node). */}
      {card && (
        <MiniCard
          card={card}
          coarse={coarse}
          onClose={closeCard}
          onFullCard={() =>
            history.push(`/languages?q=${encodeURIComponent(card.info.code)}`)
          }
        />
      )}

      {/* The service card (tap on a provider hub): nature, coverage +
          source, license, links, and the layer toggle. */}
      {hubCard && (
        <HubCard
          hub={hubCard.hub}
          on={(activeMask & hubCard.hub.bit) !== 0}
          coarse={coarse}
          onClose={closeHubCard}
          onToggle={toggleHubFromCard}
        />
      )}

      {/* The per-pair connection card (click/tap on a measured arc):
          strength, methods tested + winner, board + route links. */}
      {arcCard && (
        <ArcCard
          data={arcCard}
          coarse={coarse}
          onClose={closeArcCard}
          onLeaderboard={() =>
            history.push(
              `/leaderboard?pair=${encodeURIComponent(`${arcCard.arc.a}>${arcCard.arc.b}`)}`,
            )
          }
          onRoute={() =>
            history.push(
              `/route?from=${encodeURIComponent(arcCard.arc.a)}&to=${encodeURIComponent(arcCard.arc.b)}`,
            )
          }
        />
      )}

      {/* Motion pills (a11y controls — quiet corner). */}
      <div className={styles.pills}>
        {/* Motion controls render only once the preference has resolved —
            pre-resolve there is nothing truthful to offer yet. */}
        {!motion.resolved ? null : !wantMotion ? (
          <button type="button" className={styles.pill} onClick={() => setMotion(true)}>
            Enable motion ▶
          </button>
        ) : (
          <>
            <button type="button" className={styles.pill} onClick={togglePause}>
              {paused ? 'Resume ▶' : 'Pause ⏸'}
            </button>
            {motion.reduced && (
              <button type="button" className={styles.pill} onClick={() => setMotion(false)}>
                Static view
              </button>
            )}
          </>
        )}
      </div>

      {/* Provenance legend (claims honesty; yields to the map view's own
          legend + card so bottom-left text never stacks). */}
      {!exploring && !card && (
      <p className={styles.legend}>
        Bright green: a deployed service · Dim green: open research model only ·
        Red: no machine translation
        {' · '}
        <a className={styles.legendLink} href="/growth">
          the build record →
        </a>
        <ProvenanceTip
          source="The frame has three tiers, all recomputed client-side from each language’s per-provider coverage mask (shared/catalogue/method-coverage.json, cited per provider with its as-of date). BRIGHT GREEN (white core) = a DEPLOYED translation service lists this living language — Google, Microsoft, DeepL, or LibreTranslate (COMMERCIAL_MASK). DIM GREEN (no core) = the language appears only in an OPEN research model’s published list — MADLAD-400, NLLB-200, M2M-100, OPUS-MT, Tilde (OPEN_MASK) — a code in a model card is not a deployed, usable service, and those models’ own cards warn tail-language quality varies widely. RED = no tracked method lists it at all. This frame shows living languages only (ISO 639-3 isoType L); historical and constructed codes, the provider hubs, per-method layers, measured scores, and the endangerment explorer live on the full map behind “View the live map”. The moving packets trace only the deployed-service network — illustrative, not live traffic data. Coverage is never a quality claim — measured scores live on the leaderboard. The map is an idealization: read the machine-readable sources at champollion.dev/llms.txt. Champollion is an index, not an arbiter — every value cites its source."
          date="2026-07-19"
        />
      </p>
      )}
    </section>
  );
}
