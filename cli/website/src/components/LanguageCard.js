/**
 * LanguageCard — Grid card for the trading card collection.
 *
 * Design philosophy:
 *   This card is an EPISTEMIC TOOL, not decoration. At a glance it tells you:
 *   1. What the language is (name, native name, codes)
 *   2. Where it fits (family, region)
 *   3. How hard it is to machine-translate (complexity index)
 *   4. What status it has (vitality)
 *   5. How much we know about it (data density)
 *
 *   Clicking opens the DetailPanel — no intermediate flip step.
 */

import React from 'react';
import styles from './LanguageCard.module.css';
import Tip from './Tip';
import { termAnchor } from '../utils/explainerLoader';
import {
  getIsoTypeLabel,
  ISO_TYPE_DESCRIPTIONS,
  isSignedLanguage,
  isMacrolanguageHub,
  HUB_TILE_NOTE,
} from '../utils/taxonomy';
import { getVitalityLabel, getVitalityExplanation, VITALITY_SOURCE_NOTE } from '../utils/vitality';
import { humanizeFamily } from '../utils/humanize';

// Glossary anchors for the in-card tooltips (defined in glossary.json).
const MT_COMPLEXITY_HREF = `/glossary#${termAnchor('MT complexity')}`;
const VITALITY_HREF = `/glossary#${termAnchor('language vitality')}`;

// What the MT-complexity index actually measures — shown in the badge/gauge tip
// so "MODERATE" and the 0–100 number aren't bare jargon.
const MT_COMPLEXITY_WHAT =
  'A derived 0–100 guide to how hard a language is to machine-translate — combining MT API coverage, parallel-corpus availability, typological distance, and documentation depth. Higher is harder. It is NOT a measured translation score (those live on the leaderboard).';

// Vitality level meaning + sourcing note now live in ../utils/vitality (the
// SSOT shared with DetailPanel) — imported as getVitalityExplanation /
// VITALITY_SOURCE_NOTE.

// ---------------------------------------------------------------------------
// Complexity tier mapping (replaces old "rarity" — this is meaningful now)
// ---------------------------------------------------------------------------
const COMPLEXITY_TIERS = {
  mythic:    { label: 'EXTREME',  cssClass: 'complexityExtreme',  description: 'Near-impossible for MT — massive structural barriers and minimal data' },
  legendary: { label: 'SEVERE',   cssClass: 'complexitySevere',   description: 'Major gaps in resources, significant typological distance' },
  epic:      { label: 'HIGH',     cssClass: 'complexityHigh',     description: 'Significant resource gaps or structural challenges' },
  rare:      { label: 'MODERATE', cssClass: 'complexityModerate', description: 'Some resources exist but coverage is incomplete' },
  uncommon:  { label: 'LOW',      cssClass: 'complexityLow',      description: 'Reasonably well-resourced for MT' },
  common:    { label: 'MINIMAL',  cssClass: 'complexityMinimal',  description: 'Well-resourced — MT is feasible with existing tools' },
};

function getComplexityTier(rarity) {
  return COMPLEXITY_TIERS[rarity?.tier] || COMPLEXITY_TIERS.common;
}

// ---------------------------------------------------------------------------
// Vitality dot — CSS classes are local (LanguageCard.module.css); the labels
// and explanations come from the shared vitality SSOT.
// ---------------------------------------------------------------------------
const VITALITY_CSS = {
  thriving:   'vitalityThriving',
  shifting:   'vitalityShifting',
  endangered: 'vitalityEndangered',
  critical:   'vitalityCritical',
  dormant:    'vitalityDormant',
};

// ---------------------------------------------------------------------------
// Helper: dynamic font size for long language names
// ---------------------------------------------------------------------------
function getNameFontSize(name) {
  if (!name) return undefined;
  const len = name.length;
  if (len > 30) return '0.85rem';
  if (len > 22) return '0.95rem';
  if (len > 16) return '1.05rem';
  return undefined; // use the CSS default (--text-xl)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** SVG radial gauge for the MT complexity score */
function ComplexityGauge({ score }) {
  // score is 0–100 where 100 = maximally complex
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  // Color maps to severity
  let strokeColor = 'var(--complexity-low)';
  if (score >= 80) strokeColor = 'var(--complexity-extreme)';
  else if (score >= 65) strokeColor = 'var(--complexity-severe)';
  else if (score >= 45) strokeColor = 'var(--complexity-high)';
  else if (score >= 25) strokeColor = 'var(--complexity-moderate)';

  return (
    <svg className={styles.gauge} viewBox="0 0 48 48" aria-label={`MT Complexity: ${score}/100`}>
      {/* Background track */}
      <circle
        cx="24" cy="24" r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="3"
      />
      {/* Progress arc */}
      <circle
        cx="24" cy="24" r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        transform="rotate(-90 24 24)"
        className={styles.gaugeArc}
      />
      {/* Score text */}
      <text
        x="24" y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.gaugeText}
      >
        {score}
      </text>
    </svg>
  );
}

/** Five toolkit pip dots */
function ToolkitPips({ pips, labels }) {
  return (
    <div className={styles.pips} role="group" aria-label="Digital Toolkit availability">
      {pips.map((filled, i) => (
        <span
          key={i}
          className={`${styles.pip} ${filled ? styles.pipFilled : styles.pipEmpty}`}
          title={`${labels?.[i] || `Tool ${i + 1}`}: ${filled ? 'Available' : 'Missing'}`}
          aria-label={`${labels?.[i] || `Tool ${i + 1}`}: ${filled ? 'available' : 'missing'}`}
        />
      ))}
    </div>
  );
}

/** Vitality status dot with label + explanatory tooltip */
function VitalityDot({ level }) {
  const cssClass = VITALITY_CSS[level];
  if (!cssClass) return null;
  const label = getVitalityLabel(level, { short: true });
  return (
    <Tip
      term="Vitality"
      body={
        <>
          {getVitalityExplanation(level) || label}
          <br />
          <span style={{ opacity: 0.85 }}>{VITALITY_SOURCE_NOTE}</span>
        </>
      }
      href={VITALITY_HREF}
      placement="bottom"
      align="right"
    >
      <span className={`${styles.vitalityDot} ${styles[cssClass]}`}>
        <span className={styles.vitalityDotInner} />
        <span className={styles.vitalityLabel}>{label}</span>
      </span>
    </Tip>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LanguageCard({ card, isSelected, onClick, familyTheme }) {
  const complexity = getComplexityTier(card.rarity);
  const score = card.stats?.score ?? 0;

  // Taxonomy badging (docs/LANGUAGE_TAXONOMY.md R4)
  const isHub = isMacrolanguageHub(card);
  const isSigned = isSignedLanguage(card);
  const isoTypeLabel = getIsoTypeLabel(card.isoType);

  // Family-themed background
  const cardStyle = familyTheme ? {
    '--card-gradient': familyTheme.gradient,
    '--card-accent': familyTheme.accent,
    '--card-glow': familyTheme.glow,
  } : {};

  return (
    <article
      className={`${styles.card} ${styles[complexity.cssClass]} ${isHub ? styles.cardHub : ''} ${isSelected ? styles.cardSelected : ''}`}
      style={cardStyle}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      aria-label={isHub
        ? `${card.name} — macrolanguage hub (language group)`
        : `${card.name} — MT Complexity: ${score}/100`}
    >
      {/* ---- Top row: complexity tier (or hub badge) + vitality ----
           Hubs are navigation cards, never benchmark targets — they get a
           "Language group" badge instead of the MT complexity tier. */}
      <div className={styles.topRow}>
        {isHub ? (
          <span className={styles.hubBadge} title={HUB_TILE_NOTE}>
            Language group
          </span>
        ) : (
          <Tip
            term={`MT complexity · ${complexity.label}`}
            body={
              <>
                {complexity.description}.
                <br />
                <span style={{ opacity: 0.85 }}>{MT_COMPLEXITY_WHAT}</span>
              </>
            }
            href={MT_COMPLEXITY_HREF}
            placement="bottom"
            align="left"
          >
            <span className={`${styles.complexityBadge} ${styles[complexity.cssClass]}`}>
              {complexity.label}
            </span>
          </Tip>
        )}
        {card.vitalityBadge?.level && (
          <VitalityDot level={card.vitalityBadge.level} />
        )}
      </div>

      {/* ---- Language identity ---- */}
      <div className={styles.identity}>
        <h3
          className={styles.langName}
          style={getNameFontSize(card.name) ? { fontSize: getNameFontSize(card.name) } : undefined}
        >
          {card.name}
        </h3>
        {card.nativeName && card.nativeName !== card.name && (
          <p className={styles.nativeName} dir={card.dir === 'rtl' ? 'rtl' : undefined}>
            {card.nativeName}
          </p>
        )}
      </div>

      {/* ---- Metadata chips ---- */}
      <div className={styles.metaRow}>
        <span className={styles.chip}>{card.code}</span>
        {isSigned && (
          <span
            className={styles.taxonChipSigned}
            title="A natural language in the signed modality — text-MT benchmarking does not yet serve signed languages."
          >
            Signed language
          </span>
        )}
        {isoTypeLabel && (
          <span
            className={styles.taxonChip}
            title={ISO_TYPE_DESCRIPTIONS[card.isoType] || `ISO 639-3 type: ${isoTypeLabel}`}
          >
            {isoTypeLabel}
          </span>
        )}
        {humanizeFamily(card.family) && (
          <span className={styles.chipFamily}>{humanizeFamily(card.family)}</span>
        )}
        {card.glottocode && (
          <span className={styles.chipMuted}>{card.glottocode}</span>
        )}
      </div>

      {/* ---- Stats row ----
           Hubs: no gauge, no toolkit pips — pipeline-readiness UI is
           meaningless on a navigation hub and would imply a benchmarkable
           unit (the v1 "flat macrolanguage card" failure mode). */}
      {isHub ? (
        <div className={styles.statsRow}>
          <p className={styles.hubNote}>{HUB_TILE_NOTE}</p>
        </div>
      ) : (
      <div className={styles.statsRow}>
        <Tip
          term={`MT complexity · ${score}/100`}
          body={MT_COMPLEXITY_WHAT}
          href={MT_COMPLEXITY_HREF}
          placement="top"
          align="left"
        >
          <ComplexityGauge score={score} />
        </Tip>

        <div className={styles.statsRight}>
          <ToolkitPips
            pips={card.digitalToolkit?.pips || [false, false, false, false, false]}
            labels={card.digitalToolkit?.labels}
          />
          <div className={styles.dataDensity}>
            <span className={styles.dataDensityNumber}>{card.sourceCount || 0}</span>
            <span className={styles.dataDensityLabel}> sources</span>
            <span className={styles.dataDensitySep}>·</span>
            <span className={styles.dataDensityNumber}>{card.factCount || 0}</span>
            <span className={styles.dataDensityLabel}> facts</span>
          </div>
        </div>
      </div>
      )}

      {/* ---- Footer: region ---- */}
      <div className={styles.footer}>
        {card.speakers && card.speakers !== 'Unknown' && (
          <span className={styles.footerItem}>
            {card.speakers} speakers
          </span>
        )}
        {card.macroarea && (
          <span className={styles.footerItem}>
            {card.macroarea}
          </span>
        )}
      </div>
    </article>
  );
}
