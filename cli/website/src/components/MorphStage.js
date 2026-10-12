import React, {useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import {translate} from '@docusaurus/Translate';
import ProvenanceTip from './ProvenanceTip';
import MorphParticles, {particlesSupported} from './MorphParticles';
import styles from './MorphStage.module.css';

/**
 * MorphStage — "the Morph": translation as live structural transformation.
 *
 * An English phrase dissolves into morpheme tiles that fly together and
 * crystallize into a single word in another typology — a polysynthetic
 * Plains Cree verb (stamped valid by the GiellaLT FST), a fusional
 * Spanish ending, an Arabic root threading through vowel patterns.
 * The subtext: languages don't swap words, they restructure thought.
 *
 * TRUTHFULNESS CONTRACT (CLAIMS.md §"The Morph" is binding):
 * every word, morpheme boundary, and gloss below is reproduced verbatim
 * from the crk-translate project's research notes for the
 * Cree decomposition and FST analysis, and the hand-written glossary
 * (data/explainers/glossary.json, citing the SIL Glossary) for the
 * Spanish and Arabic examples. Three real sequences, zero invented ones.
 * Do not add a language here without a glossed in-repo source.
 *
 * Choreography (all transform/opacity/filter, compositor-safe):
 *   english → decompose → fuse → stamped [→ vowelsOut → stamped2] → melt
 *
 * Progressive enhancement / a11y:
 *   - SSR/no-JS renders beat 0 (Cree) fully fused with its stamp — the
 *     hero paints finished; cycling begins only after hydration.
 *   - prefers-reduced-motion (live-reactive): a static composition of
 *     one real decomposition with all glosses visible as a legend; the
 *     typology switcher still works (instant swap, no animation).
 *   - Morpheme tiles are real buttons: focus/hover shows the gloss
 *     tooltip, click pins the gloss to a caption line. Cycling pauses
 *     while the stage is hovered or holds focus.
 *   - `steer` (the hero search text) jumps the morph to a matching
 *     language, so typing "cree" or "arabic" steers the stage.
 *
 * Morph v2 — particle dissolution (the design log §"The Morph v2"):
 *   on natural sequence ends the melt phase hands the outgoing fused
 *   word to the canvas particle layer (MorphParticles.js): the word's
 *   rendered glyphs dissolve in a named transitional state and the
 *   particles converge onto the incoming beat's opening text before
 *   the real DOM crossfades in. THE GUARDRAIL: dissolution modes are
 *   linked to the MEANING of the example where its content supports
 *   it (per-sequence `dissolve` field, rationale inline), NEVER to a
 *   language/culture; sequences with no semantic fit rotate modes
 *   aesthetically. Purely decorative — disabled under reduced motion
 *   (v1's static composition stands), aria-hidden, no information
 *   lives only in particles.
 */

/** Live prefers-reduced-motion hook (SSR-safe: defaults to false). */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Deterministic scatter offsets for the "decomposed" tile cloud.
    Vertical spread stays within the stage (±30px) so scattered tiles
    never drift over the typology switcher above. */
const SCATTER = [
  {x: -88, y: -22, r: -7},
  {x: 64, y: -30, r: 5},
  {x: -42, y: 30, r: -4},
  {x: 96, y: 20, r: 8},
  {x: -112, y: 4, r: 6},
  {x: 34, y: -26, r: -6},
];

/** Aesthetic rotation for beats whose example meaning pins no mode —
    variety without ever fixing an element to a language (guardrail). */
const DISSOLVE_ROTATION = ['murmuration', 'petals', 'embers', 'water'];

/** Canvas font string from a computed style. The canvas font shorthand
    only reliably accepts 100-step weights, so variable weights round. */
function canvasFont(cs) {
  const w = Math.round((parseFloat(cs.fontWeight) || 400) / 100) * 100;
  const style = cs.fontStyle === 'italic' ? 'italic ' : '';
  return `${style}${w} ${cs.fontSize} ${cs.fontFamily}`;
}

/**
 * The three morph sequences. Every gloss is verbatim (or a tight
 * abridgement) of its in-repo source — see CLAIMS.md before editing.
 */
function getSequences() {
  return [
    {
      id: 'crk',
      typology: translate({
        id: 'homepage.rosetta.morph.crk.typology',
        message: 'polysynthetic',
        description: 'Typology label for the Plains Cree morph sequence',
      }),
      language: 'Plains Cree · ᓀᐦᐃᔭᐍᐏᐣ',
      lang: 'crk',
      match: ['cree', 'crk', 'nêhiyawêwin', 'nehiyawewin'],
      // Dissolution mode: none pinned. "I saw him" is semantically
      // neutral (no element in the sentence's content), so this beat
      // rotates through the aesthetic modes (see DISSOLVE_ROTATION) —
      // deliberately NOT a fixed language→element mapping (guardrail,
      // the design log §"The Morph v2").
      dissolve: null,
      english: ['I', 'saw', 'him'],
      // Morpheme breakdown of nikî-wâpamâw, verbatim from the crk-translate
      // project's docs/research/understanding_cree.md.
      forms: [
        {
          label: 'nikî-wâpamâw',
          meaning: translate({
            id: 'homepage.rosetta.morph.crk.meaning',
            message: '— “I saw him”, in one word',
            description: 'Meaning line under the fused Cree verb',
          }),
          tiles: [
            {t: 'ni-', gloss: 'I — the one doing it'},
            {t: 'kî-', gloss: 'past tense — it already happened'},
            {t: 'wâpam-', gloss: 'the act of seeing (something animate)'},
            {t: '-âw', gloss: 'him/her — the one being seen'},
          ],
        },
      ],
      // The GiellaLT FST genuinely analyzes this form — analysis string
      // verbatim from understanding_cree.md ("The itwêwina Way").
      stamp: {
        kind: 'fst',
        text: 'GiellaLT FST ✓',
        detail: 'PV/ki+wâpamêw+V+TA+Ind+1Sg+3SgO',
      },
      caption: translate({
        id: 'homepage.rosetta.morph.crk.caption',
        message:
          'Three English words restructure into one Cree verb — subject, tense, and object fused inside it.',
        description: 'Caption for the Plains Cree morph sequence',
      }),
      source:
        'crk-translate research notes (understanding_cree.md) — morpheme breakdown and GiellaLT FST analysis of nikî-wâpamâw',
    },
    {
      id: 'spa',
      typology: translate({
        id: 'homepage.rosetta.morph.spa.typology',
        message: 'fusional',
        description: 'Typology label for the Spanish morph sequence',
      }),
      language: 'Spanish · español',
      lang: 'es',
      match: ['spanish', 'español', 'espanol', 'spa'],
      // Dissolution mode: mist — linked to the example's MEANING
      // (habló, "she spoke": speech leaves as breath), not to Spanish.
      dissolve: 'mist',
      english: ['she', 'spoke'],
      // From the glossary's "fusional" entry: "The Spanish ending -ó in
      // habló marks past tense, third person, and singular simultaneously
      // — no part of it can be assigned to just one meaning."
      forms: [
        {
          label: 'habló',
          meaning: translate({
            id: 'homepage.rosetta.morph.spa.meaning',
            message: '— “she spoke”, one fused ending',
            description: 'Meaning line under the fused Spanish verb',
          }),
          tiles: [
            {t: 'habl-', gloss: "stem of hablar, 'to speak'"},
            {
              t: '-ó',
              gloss:
                'past tense + third person + singular — fused; no part of it maps to just one meaning',
            },
          ],
        },
      ],
      stamp: {kind: 'cite', text: 'SIL Glossary · cited'},
      caption: translate({
        id: 'homepage.rosetta.morph.spa.caption',
        message:
          'Three grammatical meanings fuse into one ending that no tokenizer can split.',
        description: 'Caption for the Spanish morph sequence',
      }),
      source:
        "glossary 'fusional' entry (data/explainers/glossary.json), citing the SIL Glossary of Linguistic Terms",
    },
    {
      id: 'arb',
      typology: translate({
        id: 'homepage.rosetta.morph.arb.typology',
        message: 'root-and-pattern',
        description: 'Typology label for the Arabic morph sequence',
      }),
      language: 'Arabic · العربية الفصحى',
      lang: 'ar-Latn',
      match: ['arabic', 'arb', 'العربية'],
      // Dissolution mode: sand — linked to the example's MEANING
      // (kitāb 'book' / kātib 'writer': written letters scattering to
      // grains, ink drying to dust), not to Arabic. Judged on screen.
      dissolve: 'sand',
      english: ['write'],
      // From the glossary's "root-and-pattern morphology" entry: "a
      // consonant root like k-t-b 'write' is threaded through vowel
      // templates: kitāb 'book', kātib 'writer'".
      forms: [
        {
          label: 'kitāb',
          meaning: translate({
            id: 'homepage.rosetta.morph.arb.meaning1',
            message: "— 'book'",
            description: 'Meaning line under the Arabic form kitāb',
          }),
          tiles: [
            {t: 'k', gloss: "root consonant 1 of k-t-b, 'write'"},
            {t: 'i', vowel: true, gloss: "vowel pattern — threads the root into kitāb, 'book'"},
            {t: 't', gloss: "root consonant 2 of k-t-b, 'write'"},
            {t: 'ā', vowel: true, gloss: "vowel pattern — threads the root into kitāb, 'book'"},
            {t: 'b', gloss: "root consonant 3 of k-t-b, 'write'"},
          ],
        },
        {
          label: 'kātib',
          meaning: translate({
            id: 'homepage.rosetta.morph.arb.meaning2',
            message: "— 'writer'",
            description: 'Meaning line under the Arabic form kātib',
          }),
          tiles: [
            {t: 'k', gloss: "root consonant 1 of k-t-b, 'write'"},
            {t: 'ā', vowel: true, gloss: "vowel pattern — threads the root into kātib, 'writer'"},
            {t: 't', gloss: "root consonant 2 of k-t-b, 'write'"},
            {t: 'i', vowel: true, gloss: "vowel pattern — threads the root into kātib, 'writer'"},
            {t: 'b', gloss: "root consonant 3 of k-t-b, 'write'"},
          ],
        },
      ],
      stamp: {kind: 'cite', text: 'SIL Glossary · cited'},
      caption: translate({
        id: 'homepage.rosetta.morph.arb.caption',
        message:
          'The root consonants k-t-b hold still; the vowel pattern re-threads them into new words.',
        description: 'Caption for the Arabic morph sequence',
      }),
      source:
        "glossary 'root-and-pattern morphology' entry (data/explainers/glossary.json), citing the SIL Glossary of Linguistic Terms",
    },
  ];
}

/** Per-beat phase script: name + duration (ms). */
function phasesFor(seq) {
  return seq.forms.length > 1
    ? [
        ['english', 1150],
        ['decompose', 800],
        ['fuse', 950],
        ['stamped', 3200],
        ['vowelsOut', 360],
        ['stamped2', 3800],
        ['melt', 520],
      ]
    : [
        ['english', 1150],
        ['decompose', 800],
        ['fuse', 950],
        ['stamped', 4600],
        ['melt', 520],
      ];
}

export default function MorphStage({steer = ''}) {
  const sequences = useMemo(getSequences, []);
  const reduced = useReducedMotion();
  // SSR / first paint: beat 0 (Cree) fully fused and stamped — a finished
  // composition, no hidden content, no entrance animation.
  const [pos, setPos] = useState({beat: 0, phase: 'stamped'});
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(null);
  const rootRef = useRef(null);

  // --- Morph v2: the particle-dissolution layer ---------------------
  // fx mounts only post-hydration (SSR HTML stays identical) and never
  // under reduced motion — the v1 static composition stands untouched.
  const [fx, setFx] = useState(false);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const wordRef = useRef(null);
  const englishRef = useRef(null);
  const stageInnerRef = useRef(null);
  const rotRef = useRef(0);
  useEffect(() => {
    setFx(!reduced && particlesSupported());
  }, [reduced]);
  useEffect(() => {
    if (!fx || !canvasRef.current) return undefined;
    const engine = new MorphParticles(canvasRef.current);
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.destroy();
    };
  }, [fx]);

  const seq = sequences[pos.beat];
  const formIdx =
    seq.forms.length > 1 && pos.phase === 'stamped2' ? 1 : 0;
  const form = seq.forms[formIdx];

  // The phase clock. A single timeout per phase; hold phases ("stamped*")
  // don't advance while the stage is hovered/focused, so glosses are
  // never yanked away mid-read. Fully inert under reduced motion.
  useEffect(() => {
    if (reduced) return undefined;
    // With the particle layer live, melt is driven by the flight effect
    // below (the engine's onArrive advances the beat), not this clock.
    if (fx && pos.phase === 'melt') return undefined;
    const phases = phasesFor(sequences[pos.beat]);
    const i = phases.findIndex(([p]) => p === pos.phase);
    if (i === -1) return undefined;
    if (paused && pos.phase.startsWith('stamped')) return undefined;
    const timer = setTimeout(() => {
      setPinned(null);
      if (i + 1 < phases.length) {
        setPos((p) => ({beat: p.beat, phase: phases[i + 1][0]}));
      } else {
        setPos((p) => ({
          beat: (p.beat + 1) % sequences.length,
          phase: 'english',
        }));
      }
    }, phases[i][1]);
    return () => clearTimeout(timer);
  }, [pos, paused, reduced, sequences, fx]);

  // Morph v2 flight: on melt, hand the outgoing fused word's rendered
  // glyphs to the particle engine and let convergence advance the beat.
  // The mode comes from the example's MEANING (`dissolve`) or, when the
  // meaning pins nothing, from the aesthetic rotation — never from the
  // language itself. A fallback timer guarantees melt always resolves.
  useEffect(() => {
    if (!fx || pos.phase !== 'melt') return undefined;
    const engine = engineRef.current;
    const nextBeat = (pos.beat + 1) % sequences.length;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      setPinned(null);
      setPos({beat: nextBeat, phase: 'english'});
    };
    let flightOn = false;
    if (
      engine &&
      canvasRef.current &&
      wordRef.current &&
      englishRef.current &&
      stageInnerRef.current
    ) {
      try {
        const cr = canvasRef.current.getBoundingClientRect();
        // Outgoing word: one run per morpheme tile's glyph span, so the
        // particles are born exactly where the rendered glyphs sit.
        const from = [];
        for (const tile of wordRef.current.children) {
          const glyph = tile.firstElementChild || tile;
          const r = glyph.getBoundingClientRect();
          if (!r.width) continue;
          from.push({
            text: glyph.textContent,
            font: canvasFont(window.getComputedStyle(tile)),
            cx: r.left + r.width / 2 - cr.left,
            cy: r.top + r.height / 2 - cr.top,
          });
        }
        // Incoming target: the next beat's opening English phrase,
        // laid out as the flex row will render it (centered, gapped).
        const encs = window.getComputedStyle(englishRef.current);
        const inner = stageInnerRef.current.getBoundingClientRect();
        const to = engine.layoutPhrase(
          sequences[nextBeat].english,
          canvasFont(encs),
          parseFloat(encs.fontSize) || 28,
          inner.left + inner.width / 2 - cr.left,
          inner.top + inner.height / 2 - cr.top,
        );
        let mode = sequences[pos.beat].dissolve;
        if (!mode) {
          mode = DISSOLVE_ROTATION[rotRef.current % DISSOLVE_ROTATION.length];
          rotRef.current += 1;
        }
        flightOn =
          from.length > 0 && engine.play({from, to, mode, onArrive: advance});
      } catch (e) {
        flightOn = false;
      }
    }
    const fallback = setTimeout(advance, flightOn ? 4500 : 520);
    return () => {
      clearTimeout(fallback);
      // Interrupted flights (steering, typology jump) cancel; flights
      // that landed keep their convergence crossfade running.
      if (!advanced && engine) engine.cancel();
    };
  }, [fx, pos, sequences]);

  // Search steering: typing a morph language's name in the hero search
  // jumps the stage there. Quietly does nothing on non-matches.
  useEffect(() => {
    const q = steer.trim().toLowerCase();
    if (q.length < 3) return;
    const target = sequences.findIndex((s) =>
      s.match.some((kw) => kw.startsWith(q) || q.includes(kw)),
    );
    if (target === -1) return;
    setPinned(null);
    setPos((p) =>
      p.beat === target ? p : {beat: target, phase: reduced ? 'stamped' : 'english'},
    );
  }, [steer, sequences, reduced]);

  function jumpTo(i) {
    setPinned(null);
    setPos({beat: i, phase: reduced ? 'stamped' : 'english'});
  }

  function onBlur(e) {
    if (rootRef.current && !rootRef.current.contains(e.relatedTarget)) {
      setPaused(false);
    }
  }

  const phase = reduced ? 'stamped' : pos.phase;
  const pinnedTile = pinned != null ? form.tiles[pinned] : null;

  return (
    <section
      ref={rootRef}
      className={clsx(styles.morph, reduced && styles.morphReduced)}
      aria-label={translate({
        id: 'homepage.rosetta.morph.sectionLabel',
        message:
          'How translation restructures words — three real examples with cited glosses',
        description: 'Accessible label for the interactive morph stage',
      })}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={onBlur}
    >
      {/* Typology switcher — also the "what am I looking at" header. */}
      <div className={styles.morphHead} role="group" aria-label="Word-building typologies">
        {sequences.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={i === pos.beat}
            className={clsx(styles.headChip, i === pos.beat && styles.headChipActive)}
            onClick={() => jumpTo(i)}
          >
            <span className={styles.headChipTypology}>{s.typology}</span>
            <span className={styles.headChipLang}>{s.language}</span>
          </button>
        ))}
      </div>

      <div className={styles.stage} data-phase={phase} data-fx={fx ? 'on' : undefined}>
        {/* Morph v2: decorative dissolution layer — never carries
            information, never mounted under reduced motion. */}
        {fx && (
          <canvas
            ref={canvasRef}
            className={styles.particleCanvas}
            aria-hidden="true"
          />
        )}
        <div className={styles.stageInner} ref={stageInnerRef}>
          {/* Layer 1: the English source phrase. */}
          {!reduced && (
            <p
              ref={englishRef}
              className={styles.english}
              lang="en"
              aria-hidden={phase !== 'english'}
            >
              {seq.english.map((w, i) => (
                <span key={`${seq.id}-${i}`} className={styles.englishWord} style={{'--i': i}}>
                  {w}
                </span>
              ))}
            </p>
          )}

          {/* Layer 2: the morpheme tiles that fuse into the word. */}
          <div className={styles.wordBlock}>
            <span className={styles.word} lang={seq.lang} ref={wordRef}>
              {form.tiles.map((tile, i) => {
                const jit = SCATTER[i % SCATTER.length];
                return reduced ? (
                  <span
                    key={`${seq.id}-t${i}`}
                    className={clsx(styles.tile, tile.vowel && styles.tileVowel)}
                  >
                    {tile.t}
                  </span>
                ) : (
                  <button
                    key={`${seq.id}-t${i}`}
                    type="button"
                    className={clsx(styles.tile, tile.vowel && styles.tileVowel)}
                    style={{
                      '--i': i,
                      '--jx': `${jit.x}px`,
                      '--jy': `${jit.y}px`,
                      '--jr': `${jit.r}deg`,
                    }}
                    aria-label={`${tile.t} — ${tile.gloss}`}
                    aria-pressed={pinned === i}
                    onClick={() => setPinned(pinned === i ? null : i)}
                  >
                    <span aria-hidden="true">{tile.t}</span>
                    <span className={styles.tileTip} aria-hidden="true">
                      {tile.gloss}
                    </span>
                  </button>
                );
              })}
            </span>
            <p className={styles.meaning}>
              <strong className={styles.meaningWord} lang={seq.lang}>
                {form.label}
              </strong>{' '}
              {form.meaning}
            </p>
            <p className={styles.stampRow}>
              <span
                className={clsx(
                  styles.stamp,
                  seq.stamp.kind === 'fst' && styles.stampFst,
                )}
                title={seq.stamp.detail ? `analysis: ${seq.stamp.detail}` : undefined}
              >
                {seq.stamp.text}
              </span>
              {seq.stamp.detail && (
                <code className={styles.analysis}>{seq.stamp.detail}</code>
              )}
            </p>
          </div>
        </div>

        {/* Pinned-gloss line (click a tile). Reserved height — no shift.
            The live region wraps ONLY the pinned gloss, so screen readers
            hear glosses the user pins — never the rotating hint text. */}
        {!reduced && (
          <p className={styles.glossLine}>
            <span aria-live="polite">
              {pinnedTile && (
                <>
                  <code className={styles.glossMorpheme}>{pinnedTile.t}</code>
                  {' '}
                  {pinnedTile.gloss}
                </>
              )}
            </span>
            {!pinnedTile && (
              <span className={styles.glossHint}>
                {translate({
                  id: 'homepage.rosetta.morph.glossHint',
                  message: 'Touch a piece — every gloss is cited.',
                  description: 'Hint under the morph word inviting tile interaction',
                })}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Reduced motion: the glosses ARE the composition — a legend. */}
      {reduced && (
        <dl className={styles.legend}>
          {form.tiles.map((tile, i) => (
            <div key={`${seq.id}-l${i}`} className={styles.legendRow}>
              <dt className={styles.legendMorpheme}>
                <code>{tile.t}</code>
              </dt>
              <dd className={styles.legendGloss}>{tile.gloss}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className={styles.caption}>
        {seq.caption}
        <ProvenanceTip source={seq.source} date="2026-06-12" />
      </p>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.again}
          onClick={() => jumpTo((pos.beat + 1) % sequences.length)}
        >
          {translate({
            id: 'homepage.rosetta.morph.again',
            message: 'Morph again ↻',
            description: 'Button advancing the morph stage to the next language',
          })}
        </button>
      </div>
    </section>
  );
}
