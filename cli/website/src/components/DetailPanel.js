/**
 * DetailPanel — Right-side exploration panel for a language.
 *
 * This is the EPISTEMIC CORE of the card system. Every piece of data
 * here exists to help someone understand:
 *   1. What makes this language unique
 *   2. Why machine translation is hard for it (and what specific barriers exist)
 *   3. What they could DO about it (record speakers, contribute data, run models)
 *
 * Complexity factors are EXPLAINED with accessible language. "Polysynthetic"
 * isn't just a badge — it's a card explaining how BPE tokenization fails
 * on words that pack entire sentences into a single form.
 */

import React, { useState, useEffect } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './DetailPanel.module.css';
import { loadTradingCardDetail, loadTradingCardIndex, loadTradingCardVocabulary } from '../utils/languageLoader';
import hubNames from '../data/hub-names.json';
import {
  getIsoTypeLabel,
  ISO_TYPE_DESCRIPTIONS,
  isSignedLanguage,
  isMacrolanguageHub,
  SIGNED_LANGUAGE_HERO_COPY,
  SIGNED_LANGUAGE_METHODS_COPY,
  HUB_MEMBERS_INTRO,
} from '../utils/taxonomy';
// getFamilyTheme is used by LanguageCard, not here
import { getFeatureInfo, getFeatureDisplayName, lookupConcept } from '../utils/linguisticGlossary';
import { getSourceUrl, getSourceDisplayName, normalizeSourceId } from '../utils/sourceLinkBuilder';
import { decodeWalsValue, getWalsFeatureUrl } from '../utils/walsValueDecoder';
import { decodeElcatValue, getElcatPropertyName, RELATIONSHIP_EXPLANATIONS, explainSharedDepth } from '../utils/elcatDecoder';
import { autoExplainFeature, scoreInformativeness } from '../utils/featureCategorizer';
import { loadTcFeatures, loadGlossary, findFeatureExplainer, findFeatureValue } from '../utils/explainerLoader';
import { buildGlossaryMatcher, glossifyText } from '../utils/glossify';
import { EMPTY, isEmptyValue, boolLabel, formatCoord, countingLabel, fold, fmtInt, humanizeFamily } from '../utils/humanize';
import { getVitalityLabel, getVitalityExplanation } from '../utils/vitality';

/**
 * Convert ISO 3166-1 alpha-2 country codes to human-readable names.
 * Uses the browser's Intl.DisplayNames API (well-supported since 2020).
 * Falls back to the raw code if the API isn't available.
 */
const countryNameFormatter = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function getCountryName(code) {
  if (!code || code.length !== 2) return code;
  try {
    return countryNameFormatter?.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

// Humanize an ISO 15924 script code ("Mlym" → "Malayalam"). Returns the code
// unchanged if it isn't a recognizable 4-letter script code.
const scriptNameFormatter = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'script' })
  : null;
function humanizeScript(name) {
  if (!name) return null;
  // Unicode's special codes assert NO script: Zyyy 'Common', Zxxx 'unwritten',
  // Zzzz 'unknown', Zinh 'inherited'. 'Written in the Common script' reads as
  // a fact while meaning nothing — say nothing instead.
  if (/^Z(yyy|xxx|zzz|inh)$/.test(name)) return null;
  if (/^[A-Z][a-z]{3}$/.test(name)) {
    try {
      const human = scriptNameFormatter?.of(name);
      if (human && human !== name) return human;
    } catch { /* fall through */ }
  }
  return name;
}

/**
 * Compose a positive, cited prose description for the ~16% of cards that have
 * no generated encyclopedic intro — so a thin card still reads as a real
 * language profile, not an empty skin. Every clause maps to a card/detail field
 * that is actually present (nothing is invented); missing facts are simply
 * omitted, and the sparsest cards get an honest, dignified closer instead of a
 * blank. Returns { text, sources }.
 */
function buildFallbackSummary(card, detail, extras = {}) {
  const name = card.name || 'This language';
  const isolate = card.isIsolate || detail?.classification?.isolate;
  const family = humanizeFamily(card.family || detail?.classification?.family);
  const region = card.macroarea || (Array.isArray(card.regions) && card.regions[0]) || null;
  const countryNames = (detail?.countries || [])
    .map((c) => getCountryName(c)).filter(Boolean);
  const level = card.vitalityBadge?.level || detail?.vitality?.level || null;
  // Prose needs a NUMBER. ELCat records range strings ("10-99") as honest
  // claims; Number("10-99") is NaN, and "About NaN people speak it" shipped
  // on the flagship card. Ranges stay visible in the estimates block — the
  // prose sentence just skips to the first claim it can actually say aloud.
  const est = (Array.isArray(detail?.speakerEstimates) ? detail.speakerEstimates : [])
    .find((e) => Number.isFinite(Number(e?.count)));
  const wordOrder = extras.wordOrder || null;
  const scriptName = humanizeScript(detail?.orthographicStatus?.scriptName || card.scriptName || null);
  const sources = new Set();
  const sentences = [];

  // 1. Identity + where it's spoken.
  let place = '';
  if (countryNames.length === 1) place = ` spoken in ${countryNames[0]}`;
  else if (countryNames.length === 2) place = ` spoken in ${countryNames[0]} and ${countryNames[1]}`;
  else if (countryNames.length > 2) place = ` spoken in ${countryNames[0]}, ${countryNames[1]} and elsewhere`;
  else if (region) place = ` of ${region}`;
  // Avoid "Sign Language language" — a family that already ends in "language"
  // (Sign Language, Creole Language…) is the kind on its own.
  const kind = isolate
    ? 'language isolate'
    : family
      ? (/languages?$/i.test(family) ? family : `${family} language`)
      : 'language';
  const article = /^[aeiou]/i.test(kind) ? 'an' : 'a';
  sentences.push(`${name} is ${article} ${kind}${place}.`);
  if (family || isolate) sources.add('Glottolog');

  // 2. Vitality (the plain-language meaning of the endangerment level).
  const vExplain = getVitalityExplanation(level);
  if (vExplain) {
    sentences.push(vExplain);
    if (detail?.vitality?.source) sources.add(detail.vitality.source);
    else sources.add('Glottolog AES');
  }

  // 3. Speakers (concrete count with its own source).
  if (est && est.count) {
    const yr = est.date ? String(est.date).slice(0, 4) : null;
    sentences.push(`About ${Number(est.count).toLocaleString('en-US')} people speak it${est.source ? ` (${est.source}${yr ? `, ${yr}` : ''})` : ''}.`);
    if (est.source) sources.add(est.source);
  }

  // 4. Any documented structural facts we do have.
  if (wordOrder && scriptName) {
    sentences.push(`It has ${wordOrder} basic word order and is written in the ${scriptName} script.`);
  } else if (wordOrder) {
    sentences.push(`Its basic word order is ${wordOrder}.`);
  } else if (scriptName) {
    sentences.push(`It is written in the ${scriptName} script.`);
  }

  // 5. Honest, dignified closer when the record is genuinely sparse.
  const hasTypology = (detail?.typology?.keyFeatures?.length || 0) > 0;
  if (!hasTypology && !wordOrder && !scriptName && !est) {
    sentences.push('Its grammar and language-technology resources are still being catalogued here.');
  }

  return { text: sentences.join(' '), sources: [...sources] };
}

/**
 * Turn the raw intro_sources tokens into a clean, deduped, display-ready list.
 * The tokens are compound provenance strings ("grambank-1.0.3+autotyp-2023+
 * wals-2020", "glottolog-cldf-5.3", "manual-curation") — split on '+', humanize
 * each part, collapse internal/derived provenance to "Champollion", dedupe.
 */
function humanizeIntroSources(sources) {
  const seen = new Set();
  const out = [];
  for (const raw of sources || []) {
    for (const part of String(raw).split('+')) {
      const name = getSourceDisplayName(part.trim());
      if (name && !seen.has(name)) { seen.add(name); out.push(name); }
    }
  }
  return out;
}

/**
 * Quiet, deduplicated logging for tc-features join misses, so unresolved
 * "Category N" fallbacks stay detectable in the console without spamming.
 */
const _warnedJoinMisses = new Set();
function warnJoinMiss(source, property, raw) {
  const key = `${source}|${property}`;
  if (_warnedJoinMisses.has(key)) return;
  _warnedJoinMisses.add(key);
  console.warn(`[tc-features] join miss: ${key} (code ${raw}) — rendering raw fallback`);
}

// ---------------------------------------------------------------------------
// Complexity factor explanations
// ---------------------------------------------------------------------------

/**
 * These explain WHY each factor makes MT harder, in terms a curious
 * non-linguist can understand. Each factor links to further reading.
 */
const COMPLEXITY_FACTOR_EXPLANATIONS = {
  apiGap: {
    title: 'API Coverage Gap',
    icon: '🔌',
    getExplanation: (score) => {
      if (score >= 80) return 'No commercial MT API (Google Translate, DeepL, etc.) supports this language. If you need translation, you\'d need to build or fine-tune your own model.';
      if (score >= 50) return 'Only a few MT APIs offer partial support. Quality varies significantly and may not cover all domains.';
      return 'Multiple commercial MT APIs support this language, though quality may still vary.';
    },
    learnMore: 'https://en.wikipedia.org/wiki/Machine_translation#Commercial_systems',
    learnMoreLabel: 'How commercial MT works',
    action: 'Know someone who speaks this language? Contribute translations to Tatoeba or OPUS to improve MT training data.',
  },

  corpusDesert: {
    title: 'Corpus Availability',
    icon: '📚',
    getExplanation: (score) => {
      if (score >= 80) return 'There is almost no digitized parallel text (translations paired with source text) for training MT models. This is a "corpus desert" — models can\'t learn without examples.';
      if (score >= 50) return 'Some parallel text exists, but not enough for high-quality MT. More bilingual data would significantly improve translation quality.';
      return 'Reasonable parallel text corpora exist. MT models have enough training data to produce useful translations.';
    },
    learnMore: 'https://en.wikipedia.org/wiki/Parallel_text',
    learnMoreLabel: 'What is parallel text?',
    action: 'Even a few hundred translated sentences can bootstrap MT for a low-resource language. Consider contributing to Tatoeba.',
  },

  typDistance: {
    title: 'Typological Distance',
    icon: '🧬',
    getExplanation: (score, card) => {
      const features = [];
      // Check what specific features contribute to typological distance
      if (card?.stats?.sources) {
        const sources = card.stats.sources;
        if (sources.some(s => s.includes('wordOrder'))) features.push('word order');
        if (sources.some(s => s.includes('hasGender'))) features.push('grammatical gender');
        if (sources.some(s => s.includes('hasCase'))) features.push('case system');
        if (sources.some(s => s.includes('Inclusive'))) features.push('clusivity');
        if (sources.some(s => s.includes('dir:'))) features.push('RTL script');
        if (sources.some(s => s.includes('multiScript'))) features.push('multiple scripts');
      }

      const featureStr = features.length > 0
        ? ` Key factors: ${features.join(', ')}.`
        : '';

      if (score >= 60) return `This language\'s grammar is very different from English and other well-resourced languages. MT models trained primarily on European languages struggle with these structural differences.${featureStr}`;
      if (score >= 30) return `Some grammatical features differ from well-resourced languages, creating moderate challenges for MT transfer learning.${featureStr}`;
      return `Grammar is relatively similar to well-resourced languages, making MT transfer learning more effective.${featureStr}`;
    },
    learnMore: 'https://en.wikipedia.org/wiki/Linguistic_typology',
    learnMoreLabel: 'What is linguistic typology?',
  },

  docDepth: {
    title: 'Documentation Depth',
    icon: '📖',
    getExplanation: (score) => {
      if (score >= 80) return 'Very little linguistic documentation exists — no grammar, no dictionary, minimal academic study. This makes building ANY language technology extremely difficult.';
      if (score >= 50) return 'Some documentation exists (perhaps a sketch grammar or wordlist) but comprehensive resources like dictionaries and text collections are lacking.';
      return 'Reasonable documentation exists, including grammars, dictionaries, and/or text collections that can inform MT development.';
    },
    learnMore: 'https://en.wikipedia.org/wiki/Language_documentation',
    learnMoreLabel: 'About language documentation',
    action: 'If you have access to speakers, even informal recordings and notes are invaluable. Check ELAR and PARADISEC for how to contribute.',
  },
};

// NOTE: TYPOLOGICAL_MT_IMPACT was previously here as a duplicate source of
// MT challenge explanations. It has been deleted — all that content now
// lives in linguisticGlossary.js (the SSOT). The TypologyPill and
// TypologyExplorer flyout pull from the SSOT via lookupConcept().

/**
 * AES (Agglomerated Endangerment Status) level explanations.
 * These clarify what the vitality badge MEANS — linguistic vitality is
 * about whether the language has living speakers, NOT about digital resources.
 * A language can be "not endangered" (AES 1) but still have zero MT tools.
 */
// Vitality level labels + explanations now live in ../utils/vitality (the SSOT
// shared with LanguageCard) — imported as getVitalityLabel / getVitalityExplanation.


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Collapsible section with icon header */
function Section({ icon, title, children, defaultOpen = false, id }) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionRef = React.useRef(null);

  /**
   * When a collapsed section is expanded, scroll it into view so the user
   * can actually see the content that just appeared. Uses a short delay
   * to allow the DOM to render the newly-mounted children first.
   */
  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen && sectionRef.current) {
      requestAnimationFrame(() => {
        // Optional chain: the section can unmount before the frame fires
        // (e.g. hub ↔ member navigation swaps the panel's content).
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  return (
    <section className={styles.section} id={id} ref={sectionRef}>
      <button
        className={styles.sectionHeader}
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={`${styles.sectionChevron} ${open ? styles.chevronOpen : ''}`}>
          ▸
        </span>
      </button>
      {open && (
        <div className={styles.sectionContent} id={`section-${id}`}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Expandable complexity factor card */
function ComplexityFactorCard({ factorKey, score, card }) {
  const [expanded, setExpanded] = useState(false);
  const factor = COMPLEXITY_FACTOR_EXPLANATIONS[factorKey];
  if (!factor) return null;

  // Severity color
  let severityClass = styles.severityLow;
  if (score >= 80) severityClass = styles.severityExtreme;
  else if (score >= 60) severityClass = styles.severitySevere;
  else if (score >= 40) severityClass = styles.severityHigh;
  else if (score >= 20) severityClass = styles.severityModerate;

  return (
    <div className={`${styles.factorCard} ${severityClass}`}>
      <button
        className={styles.factorHeader}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={styles.factorIcon}>{factor.icon}</span>
        <span className={styles.factorTitle}>{factor.title}</span>
        <span className={styles.factorScore}>
          <span className={styles.factorScoreBar} style={{ width: `${score}%` }} />
          <span className={styles.factorScoreText}>{score}/100</span>
        </span>
        <span className={`${styles.factorChevron} ${expanded ? styles.chevronOpen : ''}`}>
          ▸
        </span>
      </button>

      {expanded && (
        <div className={styles.factorBody}>
          <p className={styles.factorExplanation}>
            {factor.getExplanation(score, card)}
          </p>

          {factor.action && (
            <div className={styles.factorAction}>
              <span className={styles.factorActionIcon}>💡</span>
              <p className={styles.factorActionText}>{factor.action}</p>
            </div>
          )}

          {factor.learnMore && (
            <a
              href={factor.learnMore}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.learnMoreLink}
            >
              {factor.learnMoreLabel || 'Learn more'} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Typology pill with expandable explanation.
 *
 * State is lifted: only one pill can be expanded at a time.
 * The parent passes `expandedFeature` (the currently open feature name)
 * and `onToggle(featureName)` to flip it.
 *
 * All educational content comes from linguisticGlossary.js (the SSOT).
 */
function TypologyPill({ feature, value, source, isExpanded, onToggle }) {
  // Get display info from SSOT glossary
  const concept = lookupConcept(feature);
  const info = getFeatureInfo(feature);
  const displayName = getFeatureDisplayName(feature);

  return (
    <div className={styles.pillContainer}>
      <button
        className={`${styles.pill} ${isExpanded ? styles.pillExpanded : ''}`}
        onClick={onToggle}
        title={info?.description || `Typological feature: ${displayName}`}
      >
        {displayName}
        {value && value !== 'true' && value !== '1' && (
          <span className={styles.pillValue}>: {value}</span>
        )}
      </button>

      {isExpanded && (
        <div className={styles.pillFlyout}>
          {info?.description && (
            <p className={styles.pillDescription}>{info.description}</p>
          )}
          {concept?.example && (
            <p className={styles.pillExample}>
              <strong><Translate id="atlas.detail.example" description="example label">Example:</Translate></strong> {concept.example}
            </p>
          )}
          {concept?.mtChallenge && (
            <div className={styles.pillMtImpact}>
              <p className={styles.pillChallenge}>
                <strong>🤖 MT Challenge:</strong>
              </p>
              <p className={styles.pillImpactText}>{concept.mtChallenge}</p>
            </div>
          )}
          {/* Source citations from SSOT */}
          {concept?.sources?.length > 0 && (
            <div className={styles.typoSourceLinks}>
              {concept.sources.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.typoSourceLink}
                >
                  {url.includes('wikipedia') ? '📖 Wikipedia' :
                   url.includes('wals.info') ? '🗺️ WALS' :
                   url.includes('autotyp') ? '📊 AUTOTYP' :
                   '🔗 Source'}
                </a>
              ))}
            </div>
          )}
          {source && (
            <p className={styles.pillSource}>
              Data: {(() => {
                const url = getSourceUrl(normalizeSourceId(source), {});
                const name = getSourceDisplayName(source);
                return url
                  ? <a href={url} target="_blank" rel="noopener noreferrer">{name}</a>
                  : name;
              })()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** External link chip */
function ExternalLink({ name, url, icon }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.externalLink}
      title={`View on ${name}`}
    >
      <span className={styles.extLinkIcon}>{icon || '🔗'}</span>
      <span className={styles.extLinkName}>{name}</span>
    </a>
  );
}

/**
 * Normalize a source URL for browser use.
 * Some sources store git SSH remotes (git@github.com:org/repo) which are
 * not clickable — rewrite them to their https equivalent.
 */
function browserUrl(url) {
  if (!url) return null;
  return url.replace(/^git@github\.com:/, 'https://github.com/');
}

/**
 * SourcesAndLicenses — full provenance listing for the card.
 *
 * Renders EVERY source with its fact count (proportional bar), SPDX license
 * identifier (linked to the license text when a URL is known), pass-through
 * restriction badges (non-commercial / share-alike), and the attribution
 * line required by the source's license. Only data present in the detail
 * JSON is shown — nothing is invented.
 */
function SourcesAndLicenses({ sources }) {
  if (!sources || sources.length === 0) return null;

  const sorted = [...sources].sort((a, b) => (b.factCount || 0) - (a.factCount || 0));
  const max = sorted[0]?.factCount || 1;

  return (
    <div className={styles.sourcesList}>
      {sorted.map((src, i) => {
        const srcId = normalizeSourceId(src.name);
        // Display name resolves from the RAW id (robust humanizer strips
        // versions, collapses derived provenance, title-cases the tail); srcId
        // stays for URL building only.
        const displayName = getSourceDisplayName(src.name) || src.name;
        const url = browserUrl(src.url) || getSourceUrl(srcId, {});
        return (
          <div key={i} className={styles.sourceEntry}>
            <div className={styles.provenanceRow}>
              <span className={styles.provenanceName} title={displayName}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.provenanceLink}>
                    {displayName}
                  </a>
                ) : displayName}
              </span>
              <div className={styles.provenanceTrack}>
                <div
                  className={styles.provenanceFill}
                  style={{ width: `${((src.factCount || 0) / max) * 100}%` }}
                />
              </div>
              <span className={styles.provenanceCount}>{fmtInt(src.factCount || 0)}</span>
            </div>

            {(src.license || src.attribution || src.nonCommercial || src.shareAlike) && (
              <div className={styles.sourceMeta}>
                {src.license && (
                  src.licenseUrl ? (
                    <a
                      href={src.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.licenseChip}
                      title="License (SPDX identifier) — click for license text"
                    >
                      {src.license}
                    </a>
                  ) : (
                    <span className={styles.licenseChip} title="License (SPDX identifier)">
                      {src.license}
                    </span>
                  )
                )}
                {src.nonCommercial && (
                  <span className={styles.licenseRestriction} title="Non-commercial / research-only use — not for commercial or API use">
                    NC
                  </span>
                )}
                {src.shareAlike && (
                  <span className={styles.licenseRestriction} title="Share-alike required">
                    SA
                  </span>
                )}
                {src.attribution && (
                  <span className={styles.sourceAttribution}>{src.attribution}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Human-readable labels for the expert entry types emitted by
 * cli/scripts/derive-experts.mjs (language card `experts[]` schema).
 */
const EXPERT_TYPE_LABELS = {
  institution:   { icon: '🏛️', label: 'Institution' },
  project:       { icon: '🧰', label: 'Project' },
  researcher:    { icon: '🎓', label: 'Researcher' },
  community_org: { icon: '🤝', label: 'Community Org' },
};

/**
 * ExpertsList — "Who to contact" entries for this language.
 *
 * Every entry comes from the language card's experts[] array (derived from
 * resources the card itself cites: FST maintainers, corpus publishers,
 * dictionary authors, foundations). The per-entry `source` names the card
 * field it was derived from and is surfaced as a subtle provenance hint.
 */
// The experts[] `source` is a machine field-path ("archivePresence.paradisec",
// "evalDatasets[eval-flores-devtest-v1] → …"). Turn it into a short human label
// so the "from …" line reads as a citation, not a debug trace.
const ARCHIVE_SOURCE_LABELS = {
  paradisec: 'PARADISEC', elar: 'ELAR', ailla: 'AILLA', tla: 'The Language Archive',
  commonvoice: 'Common Voice', 'common-voice': 'Common Voice', tatoeba: 'Tatoeba',
};

// A Champollion-derived summary composite is redundant when the card already
// carries the richer WALS/Grambank primary for that dimension. Key = derived
// property; value = regex matching a non-derived feature NAME that supersedes it.
const COMPOSITE_SUPERSEDED_BY = {
  wordOrder: /order of (subject|object)|word order|order of s/i,
  hasGender: /\b(gender|noun class)\b/i,
  hasGenderSexBased: /\b(gender|sex-based)\b/i,
  hasGenderAnimacy: /\b(gender|animacy)\b/i,
  hasGenderInPronouns: /gender.*(personal )?pronoun|pronoun.*gender|gender distinctions/i,
  hasCase: /\bcase\b/i,
  hasCaseOnNouns: /\bcase\b/i,
  hasCaseOnPronouns: /\bcase\b/i,
  hasInclusiveExclusive: /inclusive|clusivity/i,
  hasProductivePlural: /\b(plural|number marking|nominal plural)\b/i,
};

// An umbrella derived summary is redundant when its more specific derived
// children are present (e.g. "Has grammatical gender" beside "Sex-based gender"
// + "Gender in pronouns"). Key = umbrella property; value = child properties.
const COMPOSITE_UMBRELLA_CHILDREN = {
  hasGender: ['hasGenderSexBased', 'hasGenderAnimacy', 'hasGenderInPronouns'],
  hasCase: ['hasCaseOnNouns', 'hasCaseOnPronouns'],
};

// Human labels for the CLICS³ coverage-stat properties surfaced on cards.
const COLEX_PROPERTY_LABELS = {
  clicsUniqueConcepts: 'Unique concepts recorded',
  clicsTotalEntries: 'Total dictionary entries',
  clicsUniqueForms: 'Unique word forms',
  clicsContributingDatasets: 'Contributing datasets',
  clicsColexifications: 'Colexification links',
};
function humanizeExpertSource(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^archivePresence\.([A-Za-z0-9-]+)/))) {
    const k = m[1].toLowerCase();
    return `${ARCHIVE_SOURCE_LABELS[k] || getSourceDisplayName(m[1]) || m[1]} archive`;
  }
  if ((m = s.match(/^digitalPresence\.([A-Za-z0-9-]+)/))) {
    const k = m[1].toLowerCase();
    return `${ARCHIVE_SOURCE_LABELS[k] || getSourceDisplayName(m[1]) || m[1]} corpus`;
  }
  if ((m = s.match(/^evalDatasets\[eval-([a-z0-9]+)/i))) return `${m[1].toUpperCase()} evaluation set`;
  if (/^encyclopedic\.resources/.test(s)) return 'reference resources';
  if (/dictionary/i.test(s)) return 'a listed dictionary';
  if (/fstmaintainer/i.test(s)) return 'FST maintainers';
  // Fallback: humanize the leading segment, never leak the raw path.
  return getSourceDisplayName(s.split(/[.[\s]/)[0]) || s.split(/[.[\s]/)[0];
}

function ExpertsList({ experts }) {
  if (!experts || experts.length === 0) return null;

  return (
    <ul className={styles.expertsList}>
      {experts.map((expert, i) => {
        const typeInfo = EXPERT_TYPE_LABELS[expert.type] || { icon: '🔗', label: expert.type };
        const orcidUrl = expert.orcid
          ? (expert.orcid.startsWith('http') ? expert.orcid : `https://orcid.org/${expert.orcid}`)
          : null;
        return (
          <li key={i} className={styles.expertRow} title={`Derived from card field: ${expert.source}`}>
            <div className={styles.expertMain}>
              {expert.url ? (
                <a
                  href={expert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.expertName}
                >
                  {expert.name}
                </a>
              ) : (
                <span className={styles.expertName}>{expert.name}</span>
              )}
              <span className={styles.expertType} title={`Entry type: ${typeInfo.label}`}>
                {typeInfo.icon} {typeInfo.label}
              </span>
            </div>
            <div className={styles.expertDetails}>
              <span className={styles.expertRole}>{expert.role}</span>
              {expert.affiliation && (
                <span className={styles.expertAffiliation}> · {expert.affiliation}</span>
              )}
              {orcidUrl && (
                <a
                  href={orcidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.expertOrcid}
                >
                  ORCID
                </a>
              )}
            </div>
            <div className={styles.expertSource}>from {humanizeExpertSource(expert.source)}</div>
          </li>
        );
      })}
    </ul>
  );
}


// ---------------------------------------------------------------------------
// VocabularyExplorer — Full, searchable, source-grouped vocabulary
// ---------------------------------------------------------------------------

/**
 * Renders ALL vocabulary items with search filtering and source grouping.
 * No truncation — every item in the database is accessible.
 */
function VocabularyExplorer({ items, dir, asjpOnly }) {
  const [search, setSearch] = useState('');
  const [collapsedSources, setCollapsedSources] = useState({});

  const filtered = search.trim()
    ? items.filter(item =>
        item.concept?.toLowerCase().includes(search.toLowerCase()) ||
        item.form?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  // Group filtered items by source
  const bySource = {};
  for (const item of filtered) {
    const src = item.source || 'unknown';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(item);
  }

  // Sort: non-ASJP first by size, then ASJP
  const sourceOrder = Object.keys(bySource).sort((a, b) => {
    if (a === 'asjp' && b !== 'asjp') return 1;
    if (b === 'asjp' && a !== 'asjp') return -1;
    return bySource[b].length - bySource[a].length;
  });

  const toggleSource = (src) => {
    setCollapsedSources(prev => ({ ...prev, [src]: !prev[src] }));
  };

  const typeLabels = { 'native': 'Native', 'ipa': 'IPA', 'asjp-phonetic': 'ASJP' };

  return (
    <div className={styles.vocabExplorer}>
      <div className={styles.explorerSearchWrap}>
        <input
          type="text"
          className={styles.explorerSearch}
          placeholder={`Search ${items.length} vocabulary items…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search vocabulary"
        />
        {search && (
          <button className={styles.explorerSearchClear} onClick={() => setSearch('')} aria-label="Clear search">✕</button>
        )}
      </div>

      {filtered.length === 0 && search && (
        <p className={styles.explorerEmpty}>No items match &ldquo;{search}&rdquo;</p>
      )}

      {sourceOrder.map(src => {
        const srcItems = bySource[src];
        const isCollapsed = collapsedSources[src];
        const srcId = normalizeSourceId(src);
        const displayName = getSourceDisplayName(src);
        const srcUrl = getSourceUrl(srcId, {});
        const displayType = srcItems[0]?.displayType;
        const typeLabel = typeLabels[displayType] || '';

        return (
          <div key={src} className={styles.explorerSourceGroup}>
            <button
              className={styles.explorerSourceHeader}
              onClick={() => toggleSource(src)}
              aria-expanded={!isCollapsed}
            >
              <span className={styles.explorerChevron}>{isCollapsed ? '▸' : '▾'}</span>
              <span className={styles.explorerSourceName}>
                {srcUrl ? (
                  <a href={srcUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{displayName}</a>
                ) : displayName}
              </span>
              <span className={styles.explorerSourceCount}>{srcItems.length}</span>
              {typeLabel && (
                <span className={`${styles.explorerTypeBadge} ${displayType === 'asjp-phonetic' ? styles.explorerTypeAsjp : displayType === 'ipa' ? styles.explorerTypeIpa : styles.explorerTypeNative}`}>
                  {typeLabel}
                </span>
              )}
            </button>

            {!isCollapsed && (
              <div className={styles.vocabGrid}>
                {srcItems.map((item, i) => (
                  <div key={i} className={styles.vocabRow}>
                    <span className={styles.vocabConcept}>{item.concept}</span>
                    <span className={styles.vocabArrow}>→</span>
                    <span className={styles.vocabForm} dir={dir === 'rtl' ? 'rtl' : undefined}>{item.form}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {asjpOnly && (
        <p className={styles.vocabNote}>
          ⚠️ These forms use <a href="https://en.wikipedia.org/wiki/Automated_Similarity_Judgment_Program" target="_blank" rel="noopener noreferrer">ASJP encoding</a> — a simplified phonological notation, not full IPA transcription.
        </p>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// TypologyExplorer — Semantically-categorized, educational typological features
//
// Instead of grouping by database source (WALS, Grambank, etc.), this groups
// features by what they MEAN: Sound System, Word Structure, Sentence Structure,
// Nouns & Pronouns, Verbs, etc.  Every feature has an explanation.
// ---------------------------------------------------------------------------

function TypologyExplorer({ features, expandedPill, onToggle, explainers, glossaryMatcher }) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  // CURATE — the card is a positive, cited DESCRIPTION, not a database dump.
  // Keep only features we can actually EXPLAIN + CITE (a tc-features explainer
  // exists) AND whose value is informative/positive. This drops the mis-domained
  // noise (D-PLACE ethnography, AutoTyp jargon, body-part vocab) and the "✗ no"
  // absences, and guarantees every row's info button has real content. Deduped
  // and ranked by significance. (Recomputes when the async explainer set loads.)
  const curated = React.useMemo(() => {
    const isInformative = (v) => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return false;
      // Drop only bare boolean-negatives / explicit absences. KEEP descriptive
      // values that merely start with "no" — "No dominant order", "No tones",
      // "No initial velar nasal" are real, informative typological facts.
      return !/^(no|false|absent|none|0|n\/a|na|nil|unknown|not applicable|not documented)$/.test(s);
    };
    // Pass 1: resolve explainers, keep informative rows, note non-derived names.
    const seen = new Set();
    const resolved = [];
    const nonDerivedNames = [];
    for (const f of features) {
      const key = `${f.source}|${f.property}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ex = findFeatureExplainer(explainers, f.source, f.property);
      if (!ex) continue;
      if (!isInformative(f.value)) continue;
      const isDerived = f.source === 'champollion-derived';
      if (!isDerived) nonDerivedNames.push(String(ex.name || '').toLowerCase());
      resolved.push({ f, ex, isDerived });
    }
    // Pass 2: drop a Champollion-derived SUMMARY composite (hasGender, wordOrder,
    // hasCase…) when the card already carries the richer WALS/Grambank primary
    // for that same dimension — so sparse cards still surface it, rich cards
    // don't show it twice. Then rank by informativeness (headline dimensions +
    // marked values lead; lexical trivia and coverage stats sink).
    const resolvedProps = new Set(resolved.map((r) => r.f.property));
    const out = [];
    for (const { f, ex, isDerived } of resolved) {
      if (isDerived) {
        const re = COMPOSITE_SUPERSEDED_BY[f.property];
        if (re && nonDerivedNames.some((n) => re.test(n))) continue;
        const children = COMPOSITE_UMBRELLA_CHILDREN[f.property];
        if (children && children.some((c) => resolvedProps.has(c))) continue;
      }
      out.push({ f, score: scoreInformativeness(f, ex) });
    }
    out.sort((a, b) => b.score - a.score);
    return out.map((x) => x.f);
  }, [features, explainers]);

  const searchLower = search.trim().toLowerCase();

  const confidenceColors = {
    'verified': 'var(--vitality-thriving)',
    'cross-validated': 'var(--accent)',
    'api-derived': 'var(--vitality-shifting)',
    'unverified': 'var(--text-muted)',
  };

  /**
   * Format a typology value for compact display.
   * Decodes WALS numeric category codes, ELCAT scales, booleans, and JSON.
   */
  function formatValue(raw, valueType, source, property) {
    // Absent / "N/A"-class values never render raw.
    if (isEmptyValue(raw)) return EMPTY;

    // tc-features explainer join — the authoritative code → label map for
    // WALS, Grambank, and APiCS features (571 features, all value codes).
    const exValue = findFeatureValue(
      findFeatureExplainer(explainers, source, property),
      raw
    );
    if (exValue?.label) return exValue.label;

    // WALS value decoding — legacy hand-written map, kept as fallback while
    // the explainer dataset loads (or for the rare join miss).
    if (source === 'wals') {
      const decoded = decodeWalsValue(property, raw);
      if (decoded !== String(raw)) return decoded;
      if (/^\d+$/.test(String(raw))) {
        // Only warn once the explainer data has actually loaded — before
        // that, a miss is just the fetch still being in flight.
        if (explainers) warnJoinMiss(source, property, raw);
        return `Category ${raw}`;
      }
    }

    // ELCAT value decoding — convert numeric endangerment scales to labels
    if (source === 'elcat') {
      const decoded = decodeElcatValue(property, raw);
      if (decoded) return decoded;
    }

    // Boolean display — matches real booleans, boolean-typed 1/0, and the
    // words true/false/yes/no in ANY case (fixes uppercase "FALSE" leaking raw).
    const bool = boolLabel(raw, valueType);
    if (bool) return bool;

    // Try to detect JSON objects/arrays
    if (typeof raw === 'string' && (raw.startsWith('{') || raw.startsWith('['))) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed);
          const trueKeys = keys.filter(k => parsed[k] === true);
          if (trueKeys.length > 0 && trueKeys.length <= 3) {
            return trueKeys.map(k => getFeatureDisplayName(k.replace(/^(Has|Is)/, ''))).join(', ');
          }
          return `${keys.length} properties ▸`;
        }
        if (Array.isArray(parsed)) {
          return `${parsed.length} items ▸`;
        }
      } catch {
        // Not valid JSON, fall through
      }
    }

    const str = String(raw);
    if (str.length > 60) return str.substring(0, 57) + '…';
    return str;
  }

  /**
   * Render expanded detail for a JSON value — shows structured sub-properties.
   */
  function renderExpandedValue(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed);
        return (
          <div className={styles.typoJsonDetail}>
            {entries.map(([k, v], i) => (
              <div key={i} className={styles.typoJsonRow}>
                <span className={styles.typoJsonKey}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className={styles.typoJsonVal}>
                  {v === true ? '✓' : v === false ? '✗' : Array.isArray(v) ? v.join(', ') : String(v)}
                </span>
              </div>
            ))}
          </div>
        );
      }
      if (Array.isArray(parsed)) {
        return (
          <div className={styles.typoJsonDetail}>
            {parsed.map((item, i) => (
              <div key={i} className={styles.typoJsonRow}>
                <span className={styles.typoJsonVal}>
                  {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                </span>
              </div>
            ))}
          </div>
        );
      }
    } catch {
      // Not JSON
    }
    return null;
  }

  /**
   * Get the best available explanation for a feature.
   *
   * Priority chain:
   *   1. SSOT glossary (lookupConcept) — full educational content
   *   2. Hand-written glossary via getFeatureInfo — legacy compat
   *   3. Auto-generated from featureCategorizer — structural patterns
   *   4. null — the UI shows a minimal fallback
   *
   * Returns a normalized shape with: description, mtImpact/mtRelevance,
   * example, sources, related, learnMore
   */
  function getExplanation(f) {
    // 1. SSOT glossary — richest content with examples, sources, related
    const concept = lookupConcept(f.property);
    if (concept) {
      return {
        description: concept.explain,
        mtImpact: concept.mtChallenge,
        example: concept.example,
        sources: concept.sources,
        related: concept.related,
        learnMore: concept.sources?.[0] || null,
      };
    }

    // 2. Legacy glossary API (delegates to SSOT anyway via re-export)
    const glossary = getFeatureInfo(f.property);
    if (glossary) return glossary;

    // 3. Auto-generated from featureCategorizer (pattern matching)
    const auto = autoExplainFeature(f.property, f.source);
    if (auto) return auto;

    return null;
  }

  /**
   * Get a human-readable display name for ANY feature, regardless of source.
   */
  function getDisplayName(f) {
    if (f.source === 'elcat') return getElcatPropertyName(f.property);
    // Phoneme-inventory ids (LAPSyD et al.) look like "a_u0061u02D0":
    // an ASCII-ish slug plus the IPA codepoints. Decode the codepoints
    // instead of leaking raw "A u0061u02 D0" text into the UI. (Must run
    // before the glossary fallback, whose generic prettifier would
    // otherwise "win" with the raw-escape text.)
    const phonemeId = f.property.match(/^.+?_((?:u[0-9A-Fa-f]{4})+)$/);
    if (phonemeId) {
      const ipa = phonemeId[1]
        .match(/u[0-9A-Fa-f]{4}/g)
        .map((cp) => String.fromCharCode(parseInt(cp.slice(1), 16)))
        .join('');
      return `Phoneme /${ipa}/`;
    }
    const glossaryName = getFeatureDisplayName(f.property);
    if (glossaryName && glossaryName !== f.property) return glossaryName;
    // Clean up camelCase and snake_case property names
    return f.property
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, s => s.toUpperCase());
  }

  // Curated, ranked list — the notable features first, with a "show all" for
  // completists and a search across the curated set. Every row is explainable
  // and cited, so its info button always has real content.
  if (curated.length === 0) {
    return (
      <p className={styles.explorerEmpty}>
        No notable typological features are documented for this language yet.
      </p>
    );
  }

  const filtered = searchLower
    ? curated.filter((f) => {
        const ex = findFeatureExplainer(explainers, f.source, f.property);
        const dn = (ex?.name || getDisplayName(f)).toLowerCase();
        return dn.includes(searchLower) || String(f.value ?? '').toLowerCase().includes(searchLower);
      })
    : curated;

  const TOP_N = 14;
  const visible = (searchLower || showAll) ? filtered : filtered.slice(0, TOP_N);
  const hidden = filtered.length - visible.length;

  return (
    <div className={styles.typoExplorer}>
      {curated.length > 8 && (
        <div className={styles.explorerSearchWrap}>
          <input
            type="text"
            className={styles.explorerSearch}
            placeholder={`Search ${curated.length} notable features…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search typology"
          />
          {search && (
            <button className={styles.explorerSearchClear} onClick={() => setSearch('')} aria-label="Clear search">✕</button>
          )}
        </div>
      )}

      {searchLower && filtered.length === 0 && (
        <p className={styles.explorerEmpty}>No features match &ldquo;{search}&rdquo;</p>
      )}

      <div className={styles.typoGrid}>
        {visible.map((f, idx) => {
          const exFeature = findFeatureExplainer(explainers, f.source, f.property);
          const exValue = findFeatureValue(exFeature, f.value);
          const displayName = exFeature?.name || getDisplayName(f);
          const valueLabel = exValue?.label || formatValue(f.value, f.valueType, f.source, f.property);
          const pillId = `typo-${f.source}-${f.property}-${idx}`;
          const isExpanded = expandedPill === pillId;
          const srcId = normalizeSourceId(f.source);
          const srcName = getSourceDisplayName(f.source);
          const learnUrl = exFeature?.citation?.source_url || getWalsFeatureUrl(f.property) || getSourceUrl(srcId, {});
          // Succinct (i): strip leaked HTML; show the question only when it's
          // substantive — drop the "How this language is classified for X"
          // meta-template and the truncated APiCS fragments.
          const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
          const rawQ = strip(exFeature?.question);
          // "Real question" gate: a substantive sentence, tolerant of a period
          // tucked inside a closing quote/paren ("…dogs bark.'"). Still drops
          // the vacuous meta-templates and citation-fragment leftovers.
          const usefulQ = rawQ && rawQ.length >= 15 && /[.!?][’'")\]”]?$/.test(rawQ)
            && !/^How this language is classified/i.test(rawQ)
            && !/^This feature \(based on/i.test(rawQ)
            && !/\b(vs|by [A-Z][a-z]*)\.$/.test(rawQ);
          const cleanMt = strip(exFeature?.mt_relevance);

          return (
            <div key={pillId} className={styles.typoFeatureRow}>
              <button
                className={`${styles.typoPillCompact} ${isExpanded ? styles.typoPillExpanded : ''}`}
                onClick={() => onToggle(isExpanded ? null : pillId)}
                title={exFeature?.question || `${displayName}: ${valueLabel}`}
                aria-expanded={isExpanded}
              >
                <span className={styles.typoFeatureName}>{displayName}</span>
                <span className={styles.typoFeatureValue}>{valueLabel}</span>
                {f.confidence && (
                  <span
                    className={styles.typoConfidenceDot}
                    style={{ color: confidenceColors[f.confidence] || 'inherit' }}
                    title={`Confidence: ${f.confidence}`}
                  >●</span>
                )}
                <span className={styles.typoInfoIcon} aria-hidden="true">ⓘ</span>
              </button>

              {isExpanded && exFeature && (
                <div className={styles.typoExplanation}>
                  <div className={styles.featureExplainer}>
                    {usefulQ && (
                      <p className={styles.featureExplainerQuestion}>
                        {glossifyText(rawQ, glossaryMatcher)}
                      </p>
                    )}
                    {exValue?.plain && exValue.plain !== exValue.label &&
                      exValue.plain.length > 4 && /[a-z]/.test(exValue.plain) && (
                      <p className={styles.featureValueGloss}>
                        <strong>{valueLabel}:</strong>{' '}
                        {glossifyText(exValue.plain, glossaryMatcher)}
                      </p>
                    )}
                    {cleanMt && (
                      <p className={styles.pillImpactText}>
                        <strong><Translate id="atlas.detail.whyMatters" description="why-it-matters label">Why it matters:</Translate></strong>{' '}
                        {glossifyText(cleanMt, glossaryMatcher)}
                      </p>
                    )}
                    {learnUrl && (
                      <a
                        href={learnUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.typoLearnMore}
                      >
                        {exFeature?.citation?.title ? `Source: ${exFeature.citation.title}` : `${srcName} →`}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!searchLower && hidden > 0 && (
        <button className={styles.explorerShowAll} onClick={() => setShowAll(true)}>
          Show all {filtered.length} notable features →
        </button>
      )}
      {!searchLower && showAll && filtered.length > TOP_N && (
        <button className={styles.explorerShowAll} onClick={() => setShowAll(false)}>
          Show fewer ↑
        </button>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Taxonomy sub-components (docs/LANGUAGE_TAXONOMY.md R4)
// ---------------------------------------------------------------------------

/**
 * MembersGrid — member-languages grid for a macrolanguage hub card.
 *
 * Each tile links DOWN to the member's own card (via onSelectCard when the
 * panel is hosted by the trading-cards page, else a ?q= deep link). Member
 * names come from the trading-card index; codes missing from the index
 * still render as plain code tiles so the membership list stays complete.
 */
function MembersGrid({ members, indexByCode, onSelectCard }) {
  if (!members || members.length === 0) return null;

  return (
    <div className={styles.membersGrid}>
      {members.map((code) => {
        const member = indexByCode?.get(code);
        const label = member?.name || code;
        const inner = (
          <>
            <span className={styles.memberName}>{label}</span>
            <span className={styles.memberCode}>{code}</span>
          </>
        );
        return member && onSelectCard ? (
          <button
            key={code}
            type="button"
            className={styles.memberTile}
            onClick={() => onSelectCard(member)}
            title={`Open the ${label} card`}
          >
            {inner}
          </button>
        ) : (
          <a
            key={code}
            className={styles.memberTile}
            href={`/languages?q=${code}`}
            title={`Open the ${label} card`}
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}

/**
 * MacrolanguageUpLink — "Part of the <name> macrolanguage" affordance on
 * member cards, linking UP to the hub card.
 */
function MacrolanguageUpLink({ macrolanguage, indexByCode, onSelectCard }) {
  if (!macrolanguage) return null;
  const hub = indexByCode?.get(macrolanguage);
  // Seven macrolanguages (ara, fas, msa, nor, sqi, swa, zho) exist only as
  // genera hub cards with NO tc-index row — fall back to the build-time
  // hub-names derivation so members still show a real name, never "ara".
  // The sentence below supplies the word "macrolanguage", so a hub name
  // like "Arabic Macrolanguage" sheds the redundant suffix here.
  const hubName =
    hub?.name ||
    hubNames[macrolanguage]?.name?.replace(/\s+Macrolanguage$/i, '') ||
    macrolanguage;
  const text = <Translate id="atlas.detail.partOfHub" description="macrolanguage note; {hub} is the hub name" values={{hub: <strong>{hubName}</strong>}}>{'Part of the {hub} macrolanguage'}</Translate>;

  return (
    <p className={styles.macroUpLink}>
      {/* Open the hub card directly ONLY when it exists as an index row. The 7
          purged macrolanguages (ara/fas/msa/nor/sqi/swa/zho) have a real
          hubNames-derived name but NO hub card — for those, fall through to the
          search link so the click never dangles to a dead target (audit #11). */}
      {onSelectCard && hub ? (
        <button
          type="button"
          className={styles.macroUpLinkBtn}
          onClick={() => onSelectCard(hub)}
          title={`Open the ${hubName} language-group hub`}
        >
          {text} →
        </button>
      ) : (
        <a
          className={styles.macroUpLinkBtn}
          href={`/languages?q=${macrolanguage}`}
          title={`Open the ${hubName} language-group hub`}
        >
          {text} →
        </a>
      )}
    </p>
  );
}


// ---------------------------------------------------------------------------
// Main DetailPanel
// ---------------------------------------------------------------------------

export default function DetailPanel({ card, onClose, onSelectCard, onFilterAncestry }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Vocabulary (migration 069): fetched LAZILY from trading_card_vocabulary
  // once the detail record announces it (vocabularySummary) — the whole
  // point of the split is that the huge item lists no longer ride the
  // detail fetch. Old payloads that still carry detail.vocabulary inline
  // (prod not yet re-published) use it directly and never fetch.
  const [vocab, setVocab] = useState(null);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [vocabError, setVocabError] = useState(null);
  // code → index row, for resolving macrolanguage hub/member names + cards.
  // Backed by the module-level index cache, so this is cheap after page load.
  const [indexByCode, setIndexByCode] = useState(null);
  // Track which typology pill flyout is open (only one at a time)
  const [expandedPill, setExpandedPill] = useState(null);
  // Explanation layer (feature explainers + glossary) — lazy-fetched once
  // per page via module-level caches in explainerLoader. null until loaded
  // (the UI degrades gracefully to the legacy decoders meanwhile). The
  // glossary is locale-aware (definitions localized, English fallback).
  const { i18n: { currentLocale } } = useDocusaurusContext();
  const [explainers, setExplainers] = useState(null);
  const [glossary, setGlossary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadTcFeatures().then((data) => { if (!cancelled) setExplainers(data); });
    loadGlossary(currentLocale).then((data) => { if (!cancelled) setGlossary(data); });
    return () => { cancelled = true; };
  }, [currentLocale]);

  const glossaryMatcher = React.useMemo(() => buildGlossaryMatcher(glossary), [glossary]);

  // Load full detail data
  useEffect(() => {
    if (!card) return;
    setLoading(true);
    setError(null);

    loadTradingCardDetail(card.code)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load detail for', card.code, err);
        setError('Failed to load language details. Please try again.');
        setLoading(false);
      });
  }, [card?.code]);

  // Lazy vocabulary fetch — runs when the loaded detail says this language
  // HAS vocabulary but no longer carries it inline (new split payloads).
  // Backward compatible both ways: an old payload with detail.vocabulary
  // renders directly (effect never fetches); a new payload without
  // vocabularySummary simply has no vocabulary section.
  useEffect(() => {
    setVocab(null);
    setVocabError(null);
    if (!card?.code || !detail) return undefined;
    if (detail.vocabulary?.items?.length) return undefined; // legacy inline payload
    const summary = detail.vocabularySummary;
    if (!summary || !(summary.totalForms > 0)) return undefined;

    let cancelled = false;
    setVocabLoading(true);
    loadTradingCardVocabulary(card.code)
      .then((data) => {
        if (cancelled) return;
        setVocab(data);
        // A summary that promises forms with no record behind it is a real
        // failure (missing row AND missing static file), not an empty state.
        if (!data) setVocabError('Failed to load vocabulary. Please try again.');
        setVocabLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load vocabulary for', card.code, err);
        if (cancelled) return;
        setVocabError('Failed to load vocabulary. Please try again.');
        setVocabLoading(false);
      });
    return () => { cancelled = true; };
  }, [card?.code, detail]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trading-card index lookup for macrolanguage hub ↔ member navigation.
  // loadTradingCardIndex() is module-cached, so after the grid page has
  // loaded this resolves synchronously from memory.
  useEffect(() => {
    let cancelled = false;
    loadTradingCardIndex().then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setIndexByCode(new Map(rows.map((r) => [r.code, r])));
    });
    return () => { cancelled = true; };
  }, []);

  // Genealogical siblings: other languages that share this card's DEEPEST
  // lineage node (its immediate branch) — the "cousins" a reader can jump to.
  // Grouped on ancestry-contains, matching the Atlas breadcrumb drill-down.
  const siblings = React.useMemo(() => {
    const anc = detail?.classification?.ancestry || card?.ancestry || (card?.family ? [card.family] : []);
    if (!indexByCode || !anc.length) return { node: null, list: [] };
    const rows = [...indexByCode.values()];
    const membersOf = (node) => {
      const nf = fold(node);
      return rows.filter((r) => r.code !== card?.code &&
        (Array.isArray(r.ancestry) ? r.ancestry : []).some((n) => n && fold(n) === nf));
    };
    // Walk UP from the deepest lineage node to the first node that actually has
    // relatives — so a language that is the sole member of its genus still
    // surfaces its nearest cousins instead of an empty block.
    for (let i = anc.length - 1; i >= 0; i--) {
      const list = membersOf(anc[i]);
      if (list.length) {
        list.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
        return { node: anc[i], list };
      }
    }
    return { node: null, list: [] };
  }, [detail, card, indexByCode]);

  if (!card) return null;

  const components = card.stats?.components || {};

  // ---- Taxonomy (docs/LANGUAGE_TAXONOMY.md R4) ----
  // The detail record is authoritative (the Supabase index RPC may predate
  // the taxonomy columns); the index row covers the loading window.
  const modality = detail?.modality ?? card.modality ?? null;
  const isoType = detail?.isoType ?? card.isoType ?? null;
  const isoScope = detail?.isoScope ?? card.isoScope ?? null;
  const macrolanguage = detail?.macrolanguage ?? card.macrolanguage ?? null;
  const members = detail?.members || null;
  const taxonomyNotes = detail?.taxonomyNotes || null;
  const taxonomy = { modality, isoType, isoScope, macrolanguage };
  const isSigned = isSignedLanguage(taxonomy);
  const isHub = isMacrolanguageHub(taxonomy);
  const isoTypeLabel = getIsoTypeLabel(isoType);

  // Extract data from detail with correct shapes
  const typologyFeatures = detail?.typology?.keyFeatures || [];
  // Vocabulary — BACKWARD COMPATIBLE both ways (migration 069 split):
  //   old payload: detail.vocabulary carries the full record inline — use it;
  //   new payload: detail.vocabularySummary announces it ({totalForms,
  //     sources, asjpOnly}) and the items arrive via the lazy fetch above.
  const legacyVocab = detail?.vocabulary?.items?.length ? detail.vocabulary : null;
  const vocabRecord = legacyVocab || vocab;
  const vocabSummary = detail?.vocabularySummary
    || (legacyVocab
      ? { totalForms: legacyVocab.items.length, sources: legacyVocab.sources || [], asjpOnly: !!legacyVocab.asjpOnly }
      : null);
  const vocabItems = vocabRecord?.items || [];
  const vocabAsjpOnly = !!(vocabRecord?.asjpOnly ?? vocabSummary?.asjpOnly);
  // The section renders whenever vocabulary EXISTS for this language — with
  // its loading/error state while the lazy fetch is in flight, so the
  // "no truncation, every item accessible" promise holds on new payloads.
  const showVocabSection = vocabItems.length > 0 || vocabLoading || !!vocabError
    || (vocabSummary?.totalForms > 0);
  const ancestry = detail?.classification?.ancestry || card.ancestry || (card.family ? [card.family] : []);

  // "Also known as" — the alternate names that power search, surfaced so a
  // match is explainable and the reader sees the other names a language goes by.
  // Fold-deduped against the display + native name (and each other).
  const alsoKnownAs = (() => {
    // Exclude the display + native name AND the language's own codes (iso639_1,
    // code, glottocode) — a bare "ja" reads as noise, not a name.
    const exclude = new Set(
      [card.name, card.nativeName, detail?.name, card.code, card.iso639_1, card.glottocode, detail?.glottocode]
        .filter(Boolean).map((s) => fold(s))
    );
    const seen = new Set();
    const out = [];
    for (const n of [...(detail?.alternateNames || []), ...(card.aliases || []), ...(detail?.aliases || [])]) {
      if (!n || typeof n !== 'string') continue;
      const t = n.trim();
      const f = fold(t);
      // Drop empties, dupes, bare language codes (2–3 lowercase letters), and
      // the exclude set.
      if (!f || exclude.has(f) || seen.has(f) || /^[a-z]{2,3}$/.test(t)) continue;
      seen.add(f);
      out.push(t);
    }
    return out;
  })();
  const phonology = detail?.phonology || null;
  const naturalPair = detail?.naturalPair || null;
  const countries = detail?.countries || [];
  const coordinates = detail?.coordinates || null;
  const colexification = detail?.colexification || null;

  // Extract word order from typology keyFeatures for prominent display.
  // LABELS ONLY: GB130 stores a numeric feature code, and the bare digit
  // reached the stat tile and the prose as "WORD ORDER: 3" / "It has 3 basic
  // word order". A value that is just a number is a code, not a fact a reader
  // can use — skip it rather than transcribe it.
  const wordOrderFeat = typologyFeatures.find(f =>
    f.property === 'wordOrder' || f.property === 'wordOrderDominant' || f.property === 'GB130'
  );
  const wordOrderRaw = wordOrderFeat?.value ?? null;
  const wordOrder = (wordOrderRaw != null && !/^\s*\d+\s*$/.test(String(wordOrderRaw)))
    ? wordOrderRaw : null;

  // Counting system — collapse the numeralSystem object (base + baseType +
  // highestDocumented) into one human fact ("Decimal (base 10)"). null for
  // the ~48% of cards with no documented numeral system, so the fact is
  // simply omitted, exactly like Word Order.
  const counting = countingLabel(detail?.numeralSystem);

  // Executive summary — a cited, positive prose description leads the card. Use
  // the generated encyclopedic intro (84% of cards; non-fabricated, template-
  // filled from cited facts, ≥3 sentences). For the ~16% with no intro, fall
  // back to a one-line description built ONLY from cited card facts.
  const hasGeneratedIntro = !!detail?.encyclopedic?.intro;
  const fallbackSummary = hasGeneratedIntro ? null : buildFallbackSummary(card, detail, { wordOrder });
  const summaryText = detail?.encyclopedic?.intro || fallbackSummary.text;
  const introSources = hasGeneratedIntro
    ? (Array.isArray(detail?.encyclopedic?.intro_sources) ? detail.encyclopedic.intro_sources : [])
    : (fallbackSummary.sources || []);

  return (
    <>
      {/* Overlay to close panel */}
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />

      <aside
        className={styles.panel}
        role="complementary"
        aria-label={`Details for ${card.name}`}
      >
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
          ✕
        </button>

        {/* ---- Header ---- */}
        <header className={styles.header}>
          <h2 className={styles.headerName}>{card.name}</h2>
          {card.nativeName && card.nativeName !== card.name && (
            <p className={styles.headerNative} dir={card.dir === 'rtl' ? 'rtl' : undefined}>
              {card.nativeName}
            </p>
          )}

          {/* Code chips. Glottolog-only languages (no ISO 639-3 code) are keyed
              on their glottocode, so card.code === card.glottocode — show only
              the Glotto chip, never a mislabeled "ISO: <glottocode>". */}
          <div className={styles.headerChips}>
            {card.code !== card.glottocode && (
              <span className={styles.codeChip}>ISO: {card.code}</span>
            )}
            {card.glottocode && (
              <span className={styles.codeChip}>Glotto: {card.glottocode}</span>
            )}
            {isSigned && (
              <span
                className={styles.taxonChipSigned}
                title="A natural language in the signed modality — text-MT benchmarking does not yet serve signed languages."
              >
                Signed language
              </span>
            )}
            {isHub && (
              <span
                className={styles.hubChip}
                title="Macrolanguage hub — a navigation layer linking member languages. Never a benchmark target."
              >
                Language group
              </span>
            )}
            {isoTypeLabel && (
              <span
                className={styles.taxonChip}
                title={ISO_TYPE_DESCRIPTIONS[isoType] || `ISO 639-3 type: ${isoTypeLabel}`}
              >
                {isoTypeLabel}
              </span>
            )}
            {card.vitalityBadge?.level && (
              <span
                className={`${styles.vitalityChip} ${styles[`vitality${card.vitalityBadge.level.charAt(0).toUpperCase() + card.vitalityBadge.level.slice(1)}Chip`]}`}
                title={getVitalityExplanation(card.vitalityBadge.level)}
              >
                {getVitalityLabel(card.vitalityBadge.level)}
              </span>
            )}
          </div>

          {/* Signed-language hero framing — VERBATIM "not yet served" copy
              from docs/LANGUAGE_TAXONOMY.md Position 1. Always leads with
              "natural language"; never frames the platform's text-MT scope
              as a deficit of the language. */}
          {isSigned && (
            <p className={styles.signedHero}>{SIGNED_LANGUAGE_HERO_COPY}</p>
          )}

          {/* Macrolanguage member → hub up-link */}
          {macrolanguage && (
            <MacrolanguageUpLink
              macrolanguage={macrolanguage}
              indexByCode={indexByCode}
              onSelectCard={onSelectCard}
            />
          )}

          {/* Vitality explanation — this is linguistic vitality, not digital.
              Status (Glottolog AES) and speaker count are sourced independently
              and can disagree; we surface both faithfully rather than reconcile
              them (the index-not-arbiter rule). */}
          {card.vitalityBadge?.level && (
            <p className={styles.vitalityExplanation}>
              {getVitalityExplanation(card.vitalityBadge.level)}
              {card.vitalityBadge.source === 'glottolog-aes' && (
                <span className={styles.vitalitySource}> (Source: Glottolog AES)</span>
              )}
              <span className={styles.vitalitySource}>
                {' '}This endangerment status and the speaker count come from
                different sources and can disagree — each is shown as its source
                reports it, not reconciled.
              </span>
            </p>
          )}

          {/* Quick identity facts — visible at a glance in the header */}
          <div className={styles.identityFacts}>
            {humanizeFamily(card.family) && (
              <span className={styles.identityFact}>
                <span className={styles.identityLabel}><Translate id="atlas.detail.labFamily" description="detail panel label">Family</Translate></span>
                <span className={styles.identityValue}>{humanizeFamily(card.family)}</span>
              </span>
            )}
            {card.macroarea && (
              <span className={styles.identityFact}>
                <span className={styles.identityLabel}><Translate id="atlas.detail.labRegion" description="detail panel label">Region</Translate></span>
                <span className={styles.identityValue}>{card.macroarea}</span>
              </span>
            )}
            {wordOrder && (
              <span className={styles.identityFact}>
                <span className={styles.identityLabel}><Translate id="atlas.detail.labWordOrder" description="detail panel label">Word Order</Translate></span>
                <span className={styles.identityValue}>{wordOrder}</span>
              </span>
            )}
            {counting && (
              <span className={styles.identityFact}>
                <span className={styles.identityLabel}><Translate id="atlas.detail.labCounting" description="detail panel label">Counting</Translate></span>
                <span
                  className={styles.identityValue}
                  title={detail?.numeralSystem?.highestDocumented
                    ? `Numeral base ${detail.numeralSystem.base ?? '—'}, documented to ${detail.numeralSystem.highestDocumented}`
                    : undefined}
                >
                  {counting}
                </span>
              </span>
            )}
            {card.speakers && card.speakers !== 'Unknown' && (
              <span className={styles.identityFact}>
                <span className={styles.identityLabel}><Translate id="atlas.detail.labSpeakers" description="detail panel label">Speakers</Translate></span>
                <span className={styles.identityValue}>{card.speakers}</span>
              </span>
            )}
          </div>

          {/* Speaker estimates — every cited source, attributed. When sources
              DISAGREE we show them ALL and pick no winner (index-not-arbiter,
              the speakerEstimates[] rule). This is the amalgamation, made
              visible. */}
          {Array.isArray(detail?.speakerEstimates) && detail.speakerEstimates.length > 0 && (
            <div className={styles.speakerEstimates}>
              <span className={styles.speakerEstimatesLabel}>
                Speaker estimates
                {detail.speakerEstimates.length > 1 && (
                  <span className={styles.speakerEstimatesNote}> · sources differ, all shown</span>
                )}
              </span>
              <div className={styles.speakerEstimatesList}>
                {detail.speakerEstimates.map((e, i) => (
                  <span key={i} className={styles.speakerEstimate}>
                    <strong className={styles.speakerEstimateCount}>
                      {typeof e.count === 'number' ? e.count.toLocaleString() : e.count}
                    </strong>
                    <span className={styles.speakerEstimateSource}>
                      {getSourceDisplayName(e.source) || e.source}
                      {e.date ? ` · ${String(e.date).slice(0, 4)}` : ''}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External links */}
          {detail?.externalLinks && detail.externalLinks.length > 0 && (
            <div className={styles.externalLinks}>
              {detail.externalLinks.map((link, i) => (
                <ExternalLink key={i} {...link} />
              ))}
            </div>
          )}
        </header>

        {/* Scrollable content */}
        <div className={styles.content}>
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p><Translate id="atlas.detail.loading" description="detail panel label">Loading language data...</Translate></p>
            </div>
          )}

          {error && (
            <div className={styles.errorState}>
              <p>{error}</p>
              <button onClick={() => { setLoading(true); setError(null); loadTradingCardDetail(card.code).then(setDetail).catch(() => setError('Still failing.')).finally(() => setLoading(false)); }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ---- Summary — the cited, positive description leads the card ---- */}
              {summaryText && (
                <div className={styles.cardSummary}>
                  <p className={styles.cardSummaryText}>{summaryText}</p>
                  {humanizeIntroSources(introSources).length > 0 && (
                    <p className={styles.cardSummarySources}>
                      Sources: {humanizeIntroSources(introSources).join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {/* ---- Member languages (macrolanguage hubs only) ----
                   Hubs are a typed navigation layer: benchmarks, complexity
                   scores, and pipeline-readiness belong to the individual
                   member languages, so those sections are not rendered on
                   hub cards (see docs/LANGUAGE_TAXONOMY.md Position 4). */}
              {isHub && members?.length > 0 && (
                <Section icon="🧭" title={`Member languages (${members.length})`} defaultOpen={true} id="members">
                  <p className={styles.sectionIntro}>{HUB_MEMBERS_INTRO}</p>
                  <MembersGrid
                    members={members}
                    indexByCode={indexByCode}
                    onSelectCard={onSelectCard}
                  />
                </Section>
              )}

              {/* ---- MT Complexity Index (not on hub cards) ---- */}
              {!isHub && (
              <Section icon="⚔️" title={translate({id: "atlas.detail.secMTComplexityIndex", message: "MT Complexity Index", description: "detail panel section title"})} defaultOpen={true} id="complexity">
                {/* What the index is — and what it is NOT (a benchmark result). */}
                <p className={styles.sectionIntro}>
                  A derived 0–100 estimate of how hard this language is to{' '}
                  <em>machine</em>-translate, combining the four factors below: MT
                  API coverage, parallel-corpus availability, typological distance,
                  and documentation depth. Higher means harder. It is a guide to
                  difficulty — not a measured quality score (those live on the{' '}
                  <a href="/leaderboard">leaderboard</a>, keyed by method ·
                  dataset · metric).
                </p>
                {/* Signed languages: the components below measure the
                    text-MT ecosystem, which does not yet serve signed
                    languages — say so rather than implying deficiency. */}
                {isSigned && (
                  <p className={styles.sectionIntro}>
                    These components measure the <em>text-MT</em> ecosystem
                    (APIs, parallel corpora, documentation). For a signed
                    language they describe what text-based tooling does not
                    yet serve — not a property of the language itself.
                  </p>
                )}
                <div className={styles.complexityOverview}>
                  <div className={styles.complexityScore}>
                    <span className={styles.complexityNumber}>{card.stats?.score || 0}</span>
                    <span className={styles.complexityOf}>/100</span>
                  </div>
                  <p className={styles.complexityDesc}>
                    {card.stats?.score >= 80
                      ? 'Machine translation is extremely difficult for this language. Multiple major barriers exist.'
                      : card.stats?.score >= 60
                        ? 'Significant challenges exist for machine translation of this language.'
                        : card.stats?.score >= 40
                          ? 'Moderate challenges — some resources exist but gaps remain.'
                          : 'This language is reasonably well-served by existing MT infrastructure.'
                    }
                  </p>
                </div>

                {/* Individual factor cards — each expandable with explanation */}
                <div className={styles.factorList}>
                  <ComplexityFactorCard factorKey="apiGap" score={components.apiGap || 0} card={card} />
                  <ComplexityFactorCard factorKey="corpusDesert" score={components.corpusDesert || 0} card={card} />
                  <ComplexityFactorCard factorKey="typDistance" score={components.typDistance || 0} card={card} />
                  <ComplexityFactorCard factorKey="docDepth" score={components.docDepth || 0} card={card} />
                </div>
              </Section>
              )}

              {/* ---- Classification ---- */}
              {ancestry.length > 0 && (
                <Section icon="🌳" title={translate({id: "atlas.detail.secClassification", message: "Classification", description: "detail panel section title"})} defaultOpen={true} id="classification">
                  <div className={styles.ancestry}>
                    {ancestry.map((node, i, arr) => (
                      <React.Fragment key={i}>
                        {onFilterAncestry ? (
                          <button
                            type="button"
                            className={styles.ancestryNodeLink}
                            onClick={() => onFilterAncestry(node)}
                            title={`Browse every language in ${node}`}
                          >
                            {node}
                          </button>
                        ) : (
                          <span className={styles.ancestryNode}>{node}</span>
                        )}
                        {i < arr.length - 1 && <span className={styles.ancestrySep}>›</span>}
                      </React.Fragment>
                    ))}
                    {card.isIsolate && (
                      <span className={styles.isolateBadge}><Translate id="atlas.detail.isolate" description="detail panel label">Language Isolate</Translate></span>
                    )}
                  </div>
                  {onFilterAncestry && ancestry.length > 0 && (
                    <p className={styles.ancestryHint}><Translate id="atlas.detail.ancestryHint" description="detail panel label">Tap a branch to browse its languages.</Translate></p>
                  )}
                  {alsoKnownAs.length > 0 && (
                    <div className={styles.alsoKnownAs}>
                      <span className={styles.alsoKnownAsLabel}><Translate id="atlas.detail.aka" description="detail panel label">Also known as:</Translate></span>{' '}
                      <span className={styles.alsoKnownAsNames}>{alsoKnownAs.slice(0, 10).join(', ')}</span>
                      {alsoKnownAs.length > 10 && (
                        <span className={styles.alsoKnownAsMore}> +{alsoKnownAs.length - 10} more</span>
                      )}
                    </div>
                  )}
                  {countries.length > 0 && (
                    <div className={styles.countryList}>
                      <span className={styles.countryLabel}><Translate id="atlas.detail.spokenIn" description="detail panel label">Spoken in:</Translate></span>
                      {countries.map((code, i) => (
                        <span key={i} className={styles.countryChip} title={code}>{getCountryName(code)}</span>
                      ))}
                    </div>
                  )}
                  {coordinates && formatCoord(coordinates.lat, coordinates.lng) && (
                    <div className={styles.coordinateRow}>
                      <span className={styles.coordIcon}>📍</span>
                      <span className={styles.coordText}>
                        {formatCoord(coordinates.lat, coordinates.lng)}
                      </span>
                    </div>
                  )}
                </Section>
              )}

              {/* ---- Typology ---- */}
              {typologyFeatures.length > 0 && (
                <Section icon="🔬" title={translate({id: "atlas.detail.secNotableFeatures", message: "Notable Features", description: "detail panel section title"})} defaultOpen={true} id="typology">
                  <TypologyExplorer
                    features={typologyFeatures}
                    expandedPill={expandedPill}
                    onToggle={setExpandedPill}
                    explainers={explainers}
                    glossaryMatcher={glossaryMatcher}
                  />
                </Section>
              )}

              {/* ---- Phonology ---- */}
              {phonology && (
                <Section icon="🔊" title={translate({id: "atlas.detail.secPhonologicalInventory", message: "Phonological Inventory", description: "detail panel section title"})} defaultOpen={true} id="phonology">
                  <div className={styles.phonologyGrid}>
                    <div className={styles.phonoStat}>
                      <span className={styles.phonoNumber}>{phonology.consonants || '—'}</span>
                      <span className={styles.phonoLabel}>consonants</span>
                    </div>
                    <div className={styles.phonoStat}>
                      <span className={styles.phonoNumber}>{phonology.vowels || '—'}</span>
                      <span className={styles.phonoLabel}>vowels</span>
                    </div>
                    <div className={styles.phonoStat}>
                      <span className={styles.phonoNumber}>{phonology.totalPhonemes || '—'}</span>
                      <span className={styles.phonoLabel}>total phonemes</span>
                    </div>
                    {phonology.isTonal && (
                      <div className={`${styles.phonoStat} ${styles.phonoTonal}`}>
                        <span className={styles.phonoNumber}>{phonology.tones || '?'}</span>
                        <span className={styles.phonoLabel}>tones</span>
                      </div>
                    )}
                  </div>

                  {/* Contextual note — compare to world averages (WALS) */}
                  <p className={styles.phonoContext}>
                    {(() => {
                      const c = phonology.consonants || 0;
                      const sizeLabel = c > 33 ? 'large' : c > 22 ? 'average-sized' : c > 0 ? 'small' : null;
                      if (!sizeLabel) return null;
                      return `A ${sizeLabel} consonant inventory (world median: ~25).`;
                    })()}
                    {phonology.isTonal && (
                      <> This is a <strong>tonal language</strong> — pitch changes word meaning, which creates challenges for text-based MT that can't "hear" the intended tone.</>
                    )}
                  </p>

                  {phonology.sources && (
                    <p className={styles.phonoSource}>
                      Source: {phonology.sources.map(s => getSourceDisplayName(s)).filter(Boolean).join(', ')}
                    </p>
                  )}
                </Section>
              )}

              {/* ---- Vocabulary ---- */}
              {showVocabSection && (
                <Section
                  icon="📖"
                  title={`Vocabulary (${vocabItems.length || vocabSummary?.totalForms || 0} items from ${vocabRecord?.sources?.length || vocabSummary?.sources?.length || '?'} sources)`}
                  id="vocabulary"
                >
                  {/* Explain vocabulary types for non-linguists */}
                  {vocabAsjpOnly && (
                    <p className={styles.sectionIntro}>
                      <strong>ASJP transcription only</strong> — This language's vocabulary data uses the
                      Automated Similarity Judgement Program encoding, a simplified phonetic notation
                      designed for computational comparison. Native orthography data is not available.
                    </p>
                  )}
                  {vocabItems.length > 0 ? (
                    <VocabularyExplorer
                      items={vocabItems}
                      dir={card.dir}
                      asjpOnly={vocabAsjpOnly}
                    />
                  ) : vocabError ? (
                    <div className={styles.errorState}>
                      <p>{vocabError}</p>
                      <button onClick={() => {
                        setVocabLoading(true);
                        setVocabError(null);
                        loadTradingCardVocabulary(card.code)
                          .then((data) => {
                            setVocab(data);
                            if (!data) setVocabError('Still failing.');
                          })
                          .catch(() => setVocabError('Still failing.'))
                          .finally(() => setVocabLoading(false));
                      }}>
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className={styles.loadingState}>
                      <div className={styles.spinner} />
                      <p><Translate id="atlas.detail.loadingVocab" description="detail panel label">Loading vocabulary…</Translate></p>
                    </div>
                  )}
                </Section>
              )}

              {/* ---- Connections ---- */}
              {(detail?.nearestLanguages?.length > 0 || naturalPair || siblings.list.length > 0) && (
                <Section icon="🌐" title={translate({id: "atlas.detail.secRelatedLanguages", message: "Related Languages", description: "detail panel section title"})} defaultOpen={true} id="connections">
                  {siblings.list.length > 0 && (
                    <div className={styles.siblingsBlock}>
                      <p className={styles.siblingsLabel}>
                        Same branch (<strong>{siblings.node}</strong>)
                      </p>
                      <MembersGrid
                        members={siblings.list.slice(0, 18).map((r) => r.code)}
                        indexByCode={indexByCode}
                        onSelectCard={onSelectCard}
                      />
                      {onFilterAncestry && (
                        <button
                          type="button"
                          className={styles.siblingsBrowseAll}
                          onClick={() => onFilterAncestry(siblings.node)}
                        >
                          Browse all {siblings.list.length + 1} languages in {siblings.node} →
                        </button>
                      )}
                    </div>
                  )}
                  {naturalPair && (
                    <div className={styles.naturalPair}>
                      <span className={styles.naturalPairLabel}><Translate id="atlas.detail.bestPartner" description="detail panel label">Best translation partner:</Translate></span>
                      <span className={styles.naturalPairName}>{naturalPair.name}</span>
                      {naturalPair.rationale && (
                        <p className={styles.naturalPairRationale}>{naturalPair.rationale}</p>
                      )}
                    </div>
                  )}
                  {detail?.nearestLanguages?.length > 0 && (
                    <div className={styles.connectionsList}>
                      {detail.nearestLanguages.map((lang, i) => {
                        const relInfo = RELATIONSHIP_EXPLANATIONS[lang.relationship];
                        return (
                          <div key={i} className={styles.connectionRow}>
                            <div className={styles.connectionMain}>
                              <span className={styles.connectionName}>{lang.name}</span>
                              {lang.relationship && (
                                <span
                                  className={styles.connectionRelation}
                                  title={relInfo?.description || ''}
                                >
                                  {relInfo?.label || lang.relationship.replace(/_/g, ' ')}
                                </span>
                              )}
                              {lang.distanceKm != null && (
                                <span className={styles.connectionDistance}>
                                  {fmtInt(Math.round(lang.distanceKm))} km
                                </span>
                              )}
                            </div>
                            {lang.sharedDepth != null && (
                              <span className={styles.connectionDepth}
                                title={explainSharedDepth(lang.sharedDepth)}
                              >
                                depth {lang.sharedDepth}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <p className={styles.connectionExplainer}>
                        <strong><Translate id="atlas.detail.sharedDepth" description="bold lead">Shared depth</Translate></strong> <Translate id="atlas.detail.sharedDepthText" description="shared depth explainer opening">measures how many levels of the language family tree</Translate>
                        two languages share. Higher = more closely related.
                      </p>
                    </div>
                  )}
                </Section>
              )}

              {/* ---- Colexification (CLICS) ---- */}
              {colexification?.items?.length > 0 && (
                <Section icon="🔗" title={translate({id: "atlas.detail.secColexificationdataCLICS", message: "Colexification data (CLICS³)", description: "detail panel section title"})} id="colexification">
                  <p className={styles.sectionIntro}>
                    How much cross-linguistic <em>colexification</em> data CLICS³ records for this
                    language — the raw material for studying which distinct meanings it names with the
                    same word (e.g. one word for both &ldquo;hand&rdquo; and &ldquo;arm&rdquo;).
                  </p>
                  <div className={styles.colexGrid}>
                    {colexification.items.map((item, i) => (
                      <div key={i} className={styles.colexRow}>
                        <span className={styles.colexProperty}>
                          {COLEX_PROPERTY_LABELS[item.property]
                            || item.property.replace(/^clics/i, '').replace(/([A-Z])/g, ' $1').trim().replace(/^./, (s) => s.toUpperCase())}
                        </span>
                        <span className={styles.colexValue}>{item.value}</span>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.colexSource}>
                            CLICS ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ---- Digital Ecosystem (not on hub cards) ----
                   Signed languages never get the all-✗ API grid: an empty
                   methods table rendered as failure would misstate whose
                   limitation it is (the text-MT instrument's, not the
                   language's). Informational copy replaces it. */}
              {!isHub && (
              <Section icon="💻" title={translate({id: "atlas.detail.secDigitalEcosystem", message: "Digital Ecosystem", description: "detail panel section title"})} id="digital">
                {isSigned ? (
                  <p className={styles.signedMethodsNote}>{SIGNED_LANGUAGE_METHODS_COPY}</p>
                ) : (() => {
                  const apis = detail?.apiSupport || [];
                  const supportedCount = apis.filter((a) => a.supported).length;
                  // When NO provider covers the language (the common case for
                  // most of the catalog), a wall of ✗ misstates the story — the
                  // gap is the opportunity. Show one honest line + the list.
                  if (apis.length > 0 && supportedCount === 0) {
                    return (
                      <p className={styles.signedMethodsNote}>
                        No commercial machine-translation API covers this language yet — an open
                        gap rather than a limit of the language.{' '}
                        <span className={styles.digitalCheckedNote}>
                          Checked: {apis.map((a) => a.name).join(', ')}.
                        </span>
                      </p>
                    );
                  }
                  return (
                    <div className={styles.digitalGrid}>
                      {apis.map((api, i) => (
                        <div key={i} className={`${styles.digitalItem} ${api.supported ? styles.digitalAvailable : styles.digitalMissing}`}>
                          <span className={styles.digitalIcon}>{api.supported ? '✓' : '✗'}</span>
                          <span className={styles.digitalName}>{api.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Section>
              )}

              {/* ---- Taxonomy notes ----
                   Curated, sourced prose for language/dialect disputes —
                   both authorities' positions are displayed, never
                   adjudicated (docs/LANGUAGE_TAXONOMY.md Position 5).
                   Data-driven: renders whenever taxonomyNotes is non-null. */}
              {taxonomyNotes && (
                <Section icon="🪶" title={translate({id: "atlas.detail.secTaxonomynotes", message: "Taxonomy notes", description: "detail panel section title"})} id="taxonomy-notes">
                  <p className={styles.sectionIntro}>
                    Where ISO 639-3, Glottolog, or communities disagree about
                    language boundaries, this card displays the positions —
                    it does not adjudicate them.
                  </p>
                  <div className={styles.taxonomyNotes}>
                    {String(taxonomyNotes).split(/\n\s*\n/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </Section>
              )}

              {/* ---- Who to Contact ---- */}
              {detail?.experts?.length > 0 && (
                <Section icon="🤝" title={`Who to Contact (${detail.experts.length})`} id="experts">
                  <p className={styles.sectionIntro}>
                    People, projects, and institutions behind this language&rsquo;s
                    resources — derived from sources this card already cites.
                  </p>
                  <ExpertsList experts={detail.experts} />
                </Section>
              )}

              {/* ---- Sources & Licenses ---- */}
              {detail?.provenance && (
                <Section icon="📊" title={translate({id: "atlas.detail.secSourcesLicenses", message: "Sources & Licenses", description: "detail panel section title"})} id="provenance">
                  <p className={styles.sectionIntro}>
                    Every fact on this card is traceable to one of these sources.
                    Licenses are shown as SPDX identifiers.
                  </p>
                  <div className={styles.provenanceStats}>
                    <span className={styles.provenanceStat}>
                      <strong>{fmtInt(detail.provenance.totalFacts || 0)}</strong> verified facts
                    </span>
                    <span className={styles.provenanceStat}>
                      <strong>{detail.provenance.sources?.length || 0}</strong> sources
                    </span>
                    {detail.provenance.unresolvedConflicts > 0 && (
                      <span className={`${styles.provenanceStat} ${styles.provenanceConflict}`}>
                        ⚠️ <strong>{detail.provenance.unresolvedConflicts}</strong> unresolved conflict{detail.provenance.unresolvedConflicts > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <SourcesAndLicenses sources={detail.provenance.sources} />
                </Section>
              )}

              {/* ---- Footer ---- */}
              <footer className={styles.panelFooter}>
                <a
                  href={`https://github.com/gamedaysuits/Champollion/issues/new?template=06-card-correction.yml&title=${encodeURIComponent(`[Card] ${card.name} (${card.code})`)}&language=${encodeURIComponent(`${card.name} (${card.code})`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.submitLink}
                >
                  📝 Suggest a correction or addition
                </a>
              </footer>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
