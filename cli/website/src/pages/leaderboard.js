import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Translate, {translate} from "@docusaurus/Translate";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import Link from "@docusaurus/Link";

import styles from "./leaderboard.module.css";
import { loadLanguageNameMap } from "../utils/languageLoader";
import {
  SIGNIFICANCE_FLOOR,
  DEV_SET_FLOOR,
  corpusSizeLevel,
} from "../utils/corpusFloors";
import { getTatoebaPairUrl } from "../utils/sourceLinkBuilder";
import { licenseBadges } from "../utils/licenseBadge";
import {
  contaminationBadges,
  normalizeContamination,
  isRelativeOnly,
  resolveContaminationGrade,
  isRelativeOnlyLane,
} from "../utils/contaminationBadge";
import HumanServicesForPair from "../components/HumanServicesForPair";
import { dateLabel } from "../utils/recentRuns.mjs";
import { fetchQueuePairs } from "../utils/liveQueue";

// Supabase public config — safe to embed (RLS restricts to read-only)
const SUPABASE_URL = "https://sjdomynysdljkbemupqa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp";

// ---------------------------------------------------------------------------
// Column definitions — single source of truth for the table and chooser.
// Each column has: key, label, accessor, format, sortable, default visibility,
// optional tooltip, and optional suffix.
// ---------------------------------------------------------------------------

const COLUMNS = [
  { key: "rank",       label: translate({id: "page.board.colRank", message: "Rank", description: "column/metric label"}),       default: true,  sortable: false, metric: false },
  { key: "pair",       label: translate({id: "page.board.colPair", message: "Pair", description: "column/metric label"}),       default: true,  sortable: true,  metric: false },
  { key: "method",     label: translate({id: "page.board.colMethod", message: "Method", description: "column/metric label"}),     default: true,  sortable: true,  metric: false },
  { key: "model",      label: translate({id: "page.board.colModel", message: "Model", description: "column/metric label"}),      default: true,  sortable: true,  metric: false },
  // The composite is a transparent SORT KEY (a sortable convenience), NOT a
  // quality verdict — trust comes from the CI + evidence on each row. COMET-22
  // is the CO-PRIMARY neural quality signal, surfaced alongside it. The lexical
  // surface metrics (chrF++, BLEU, spBLEU, TER) are visible secondary columns.
  // (By design: neural metrics are reported separately, never folded
  // into the deterministic composite.)
  { key: "composite",  label: translate({id: "page.board.colComposite", message: "Composite", description: "column/metric label"}),  default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.composite,  suffix: "",  tooltip: "composite" },
  { key: "comet",      label: "COMET-22",   default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.comet,      suffix: "",  tooltip: "comet" },
  { key: "chrF",       label: "chrF++",     default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.chrF,       suffix: "",  tooltip: "chrF" },
  { key: "bleu",       label: "BLEU",       default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.bleu,       suffix: "",  tooltip: "bleu" },
  // spBLEU is extracted from the run_card JSONB (no top-level column), so it is
  // display-only — not server-sortable. See LISTING_SELECT.
  { key: "spbleu",     label: "spBLEU",     default: true,  sortable: false, metric: true,
    accessor: (e) => e.metrics.spbleu,     suffix: "",  tooltip: "spbleu" },
  { key: "ter",        label: "TER",        default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.ter,        suffix: "",  tooltip: "ter" },
  { key: "exactMatch", label: "EM%",        default: true,  sortable: true,  metric: true,
    accessor: (e) => e.metrics.exactMatch, suffix: "%", tooltip: "exactMatch" },
  { key: "fstAcceptance", label: "FST%",    default: false, sortable: true,  metric: true,
    accessor: (e) => e.metrics.fstAcceptance, suffix: "%", tooltip: "fstAcceptance" },
  { key: "equivalentMatch", label: "Equiv%", default: false, sortable: true, metric: true,
    accessor: (e) => e.metrics.equivalentMatch, suffix: "%", tooltip: "equivalentMatch" },
  { key: "semanticScore", label: translate({id: "page.board.colSemantic", message: "Semantic", description: "column/metric label"}), default: false, sortable: true,  metric: true,
    accessor: (e) => e.metrics.semanticScore,  suffix: "",  tooltip: "semanticScore" },
  { key: "trust",      label: translate({id: "page.board.colTrust", message: "Trust", description: "column/metric label"}),      default: false, sortable: false, metric: false, tooltip: "trust" },
  { key: "tier",       label: translate({id: "page.board.colTier", message: "Tier", description: "column/metric label"}),       default: true,  sortable: false, metric: false, tooltip: "tier" },
  { key: "costEntry",  label: "$/entry",    default: false, sortable: true,  metric: false,
    accessor: (e) => e.cost_per_entry_usd },
  { key: "latency",    label: "Latency",    default: false, sortable: true,  metric: false,
    accessor: (e) => e.avg_latency_seconds },
  { key: "author",     label: translate({id: "page.board.colAuthor", message: "Author", description: "column/metric label"}),     default: true,  sortable: true,  metric: false },
  { key: "date",       label: translate({id: "page.board.colDate", message: "Date", description: "column/metric label"}),       default: true,  sortable: true,  metric: false },
];

// Build a fast lookup map for column definitions
const COL_MAP = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

// Default visible columns (used on first visit, before localStorage)
const DEFAULT_VISIBLE = new Set(COLUMNS.filter((c) => c.default).map((c) => c.key));

// LocalStorage key for column preferences. Bumped to v2 when COMET-22 became a
// co-primary default column (and BLEU/spBLEU/TER became visible secondaries) —
// the version suffix retires stale saved sets so returning visitors actually
// see the new default metric columns instead of their pre-COMET selection.
const LS_COLUMNS_KEY = "champollion_lb_columns_v2";

// ---------------------------------------------------------------------------
// Helpers (preserved from original)
// ---------------------------------------------------------------------------

function formatPair(pair, langMap) {
  if (!pair) return "?";
  const sep = pair.includes(">") ? ">" : " → ";
  const [src, tgt] = pair.split(sep);
  if (!tgt) return pair.toUpperCase();
  const srcName = langMap?.get(src.trim()) || src.trim().toUpperCase();
  const tgtName = langMap?.get(tgt.trim()) || tgt.trim().toUpperCase();
  return `${srcName} → ${tgtName}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const METRIC_META = {
  composite: { label: translate({id: "page.board.colDeterministic", message: "Deterministic", description: "column/metric label"}), suffix: "", nullable: true },
  comet: { label: "COMET-22", suffix: "", nullable: true },
  chrF: { label: "chrF++", suffix: "", nullable: false },
  exactMatch: { label: translate({id: "page.board.colExactMatch", message: "Exact Match", description: "column/metric label"}), suffix: "%", nullable: false },
  fstAcceptance: { label: translate({id: "page.board.colFSTAcceptance", message: "FST Acceptance", description: "column/metric label"}), suffix: "%", nullable: true },
  equivalentMatch: { label: translate({id: "page.board.colEquivMatch", message: "Equiv. Match", description: "column/metric label"}), suffix: "%", nullable: true },
  semanticScore: { label: translate({id: "page.board.colSemantic", message: "Semantic", description: "column/metric label"}), suffix: "", nullable: true },
  bleu: { label: "BLEU", suffix: "", nullable: true },
  spbleu: { label: "spBLEU", suffix: "", nullable: true },
  ter: { label: "TER", suffix: "", nullable: true },
};

function formatMetric(value, suffix) {
  if (value == null) return "—";
  if (typeof value === "number") {
    // Show up to 2 decimal places for metrics
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
    return `${formatted}${suffix || ""}`;
  }
  return `${value}${suffix || ""}`;
}

function formatCost(cost) {
  if (cost == null) return null;
  return `$${cost.toFixed(4)}`;
}

function formatDuration(seconds) {
  if (seconds == null) return null;
  return `${seconds.toFixed(1)}s`;
}

const CONDITION_GROUPS = [
  { key: "naive", label: "Naive" },
  { key: "coached", label: "Coached" },
  { key: "v3", label: "v3" },
  { key: "v4", label: "v4" },
  { key: "v5", label: "v5" },
  { key: "v6", label: "v6" },
  { key: "v7", label: "v7" },
  { key: "fst", label: "FST", isPrefix: true },
];

const TRUST_META = {
  "self-benchmarked": { label: "Self-benchmarked", className: styles.trustSelf },
  "champollion-verified": { label: "Champollion Verified", className: styles.trustVerified },
  "community-validated": { label: "Community Validated", className: styles.trustCommunity },
  "disqualified": { label: "Disqualified", className: styles.trustCommunity },
};

// DB trust vocabulary (migration 021): unverified | verified | disqualified.
// Keep in sync with DB_TRUST_TO_DISPLAY in src/utils/leaderboardUtils.js —
// that map is DB-values-only and deliberately omits the passthroughs below.
// 'community-validated' is NOT a DB trust value and is unearnable via
// run_cards.trust: it is pair-level speaker evidence (bilingual speakers,
// community protocol), kept here only so pre-021 rows that stored display
// keys still render.
const DB_TRUST_TO_DISPLAY = {
  unverified: "self-benchmarked",
  verified: "champollion-verified",
  disqualified: "disqualified",
  // legacy display-key passthroughs (pre-021 rows only — not DB vocabulary)
  "community-validated": "community-validated",
  "self-benchmarked": "self-benchmarked",
  "champollion-verified": "champollion-verified",
};

const TOOLTIPS = {
  composite: translate({id: "page.board.tt_composite", message: "Deterministic composite (0.0–1.0) — a transparent SORT KEY, not an absolute quality verdict. It is the weighted average of the surface/structural signals available for a run (chrF++, exact match, and any FST / equivalence / semantic scores). Neural metrics (COMET / QE) are deliberately excluded and reported separately. Use it to order rows; judge quality from the confidence interval + evidence on each row, and from COMET-22. See the Scoring Specification §4.", description: "leaderboard tooltip"}),
  comet: translate({id: "page.board.tt_comet", message: "COMET-22 (Unbabel/wmt22-comet-da) — a neural, embedding-based estimate of translation quality and the primary system-level MT metric since WMT 2022. How well it tracks human judgment varies BY LANGUAGE FAMILY — in the WMT-derived reliability data it beats surface metrics for some families and trails chrF++ for others, and is unmeasured for most of the world's languages (see the Metric Reliability specification). Co-primary with the composite. AfriCOMET auto-selects for supported African languages; for low-resource targets outside XLM-R's high-resource tier, treat scores as a relative signal with wider error bars (the expanded row flags this). Not comparable across language pairs. Reported separately — never folded into the deterministic composite. Higher is better (0.0–1.0).", description: "leaderboard tooltip"}),
  chrF: translate({id: "page.board.tt_chrF", message: "Character n-gram F-score (chrF++). Correlates well with human judgement, especially for morphologically rich languages. Higher is better. Scale: 0–100. NOT comparable across language pairs: every writing system scores some overlap by chance (the chance floor differs by orthography), so compare chrF++ only within one pair — cross-language strength on the network map uses chance-corrected cchrF++ (see the Connection Strength specification).", description: "leaderboard tooltip"}),
  bleu: translate({id: "page.board.tt_bleu", message: "Corpus BLEU (sacreBLEU, default 13a tokenizer). A lexical n-gram precision metric — handy for comparison with published tables but weakly correlated with human judgement for morphologically rich, low-resource languages. Higher is better. Expand a row for its exact sacreBLEU signature.", description: "leaderboard tooltip"}),
  spbleu: translate({id: "page.board.tt_spbleu", message: "spBLEU — BLEU on the FLORES-200 SentencePiece tokenizer, comparable across scripts and segmentation (the NLLB/FLORES lingua-franca number). Reported comparability sidecar, never part of the composite. Higher is better.", description: "leaderboard tooltip"}),
  ter: translate({id: "page.board.tt_ter", message: "Translation Edit Rate (sacreBLEU) — the edit distance to turn the output into the reference, as a percentage. LOWER is better. Excluded from the composite (it correlates with chrF++). Expand a row for its exact sacreBLEU signature.", description: "leaderboard tooltip"}),
  sacrebleuSignatures: translate({id: "page.board.tt_sacrebleuSignatures", message: "Full sacreBLEU signature for each surface metric (tokenizer, smoothing, case, number of references, sacreBLEU version). Anyone can re-run sacreBLEU with the same signature against the sha-pinned corpus and reproduce the exact score.", description: "leaderboard tooltip"}),
  exactMatch: translate({id: "page.board.tt_exactMatch", message: "Exact Match rate. Percentage of translations that exactly match the gold-standard reference. A strict metric — even minor whitespace differences count as a miss.", description: "leaderboard tooltip"}),
  fstAcceptance: translate({id: "page.board.tt_fstAcceptance", message: "Finite-State Transducer acceptance rate. Percentage of outputs that are morphologically valid according to the language's FST grammar. Only applies when FST verification is enabled.", description: "leaderboard tooltip"}),
  equivalentMatch: translate({id: "page.board.tt_equivalentMatch", message: "Equivalent match rate. Percentage of translations matching any acceptable variant in the gold standard, not just the primary reference.", description: "leaderboard tooltip"}),
  semanticScore: translate({id: "page.board.tt_semanticScore", message: "Semantic similarity score. Neural embedding-based similarity between output and reference, capturing meaning preservation beyond surface-level match.", description: "leaderboard tooltip"}),
  tier: translate({id: "page.board.tt_tier", message: "Quality tier classification based on composite score thresholds (Scoring Specification §5.1): Baseline < 0.30, Emerging < 0.50, Functional < 0.70, Deployable < 0.85, Fluent ≥ 0.85. Heuristic labels on automated scores — only community review by bilingual speakers confirms actual usability; no method can claim Deployable or above without it.", description: "leaderboard tooltip"}),
  trust: translate({id: "page.board.tt_trust", message: "Verification tier. Self-benchmarked = submitted via the CLI under an authenticated identity, but the scores are SELF-REPORTED and have NOT been independently re-scored — treat them as a claim, not a verified result. Champollion Verified = independently re-scored by the project from the submitter's model outputs against the sha-pinned corpus (the only tier eligible for ranking and prizes). Community Validated = bilingual speakers of the target language, qualified under the community's own protocol, reviewed a stratified sample of the method's output (≥30 entries, ≥2 reviewers) and ≥70% met the community's bar — conferred only by the community's own testing, at its discretion; demotion by spot-audit is symmetric and equally public. Verification is rolling out; today's rows are self-benchmarked.", description: "leaderboard tooltip"}),
  author: translate({id: "page.board.tt_author", message: "The authenticated user who submitted these results via mt-eval publish.", description: "leaderboard tooltip"}),
  condition: translate({id: "page.board.tt_condition", message: "The prompt strategy used. 'naive' = direct translation prompt. 'coached' = prompt with linguistic context. Custom conditions may include tool use or post-processing.", description: "leaderboard tooltip"}),
  method: translate({id: "page.board.tt_method", message: "Description of the translation method. 'Harness-native' means a standard harness prompt with no custom method card attached.", description: "leaderboard tooltip"}),
  paradigm: translate({id: "page.board.tt_paradigm", message: "Translation paradigm — how the method works at the algorithmic level (rule-based, statistical, neural-nmt, llm, hybrid, human). Orthogonal to the method class and dependency class; it lets rule-based, neural, and LLM systems be compared apples-to-apples.", description: "leaderboard tooltip"}),
  cost: translate({id: "page.board.tt_cost", message: "Total API cost in USD for this evaluation run, as reported by OpenRouter.", description: "leaderboard tooltip"}),
  duration: translate({id: "page.board.tt_duration", message: "Wall-clock time for the full run. May be low if cached translations were reused.", description: "leaderboard tooltip"}),
  fingerprint: translate({id: "page.board.tt_fingerprint", message: "Deterministic hash of the run configuration. Two runs with the same fingerprint used identical model, prompt, temperature, and dataset settings.", description: "leaderboard tooltip"}),
  corpusSize: `Evaluated entries (n) behind this run's scores. Below ${SIGNIFICANCE_FLOOR} entries, score differences within ~5 chrF++ points are statistical noise — no significance claims; below ${DEV_SET_FLOOR} (the development-set floor), orderings are indicative only. Small corpora always rank alongside the rest — the fix is corpus growth, via the row's Tatoeba contribution link.`,
  provenance: translate({id: "page.board.tt_provenance", message: "Git commit and repo at the time of the run. Confirms the exact code version that produced these results.", description: "leaderboard tooltip"}),
  harnessVersion: translate({id: "page.board.tt_harnessVersion", message: "Version of the mt-eval harness that produced these results. Different versions may use different prompting strategies or scoring logic.", description: "leaderboard tooltip"}),
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span
      className={styles.infoTip}
      data-tooltip={text}
      aria-label={text}
      tabIndex={0}
      role="note"
    >
      ⓘ
    </span>
  );
}

function TrustBadge({ trust }) {
  const meta = TRUST_META[trust] || TRUST_META["self-benchmarked"];
  return (
    <span className={`${styles.trustBadge} ${meta.className}`}>
      {meta.label}
    </span>
  );
}

const TIER_META = {
  baseline: { label: "Baseline", className: styles.tierBaseline },
  emerging: { label: "Emerging", className: styles.tierEmerging },
  functional: { label: "Functional", className: styles.tierFunctional },
  deployable: { label: "Deployable", className: styles.tierDeployable },
  fluent: { label: "Fluent", className: styles.tierFluent },
};

function TierBadge({ tier }) {
  if (!tier) return <span className={styles.tierBadge}>—</span>;
  const meta = TIER_META[tier.toLowerCase()] || { label: tier, className: "" };
  return (
    <span className={`${styles.tierBadge} ${meta.className}`}>
      {meta.label}
    </span>
  );
}

const CORPUS_FLOOR_META = {
  ok: { className: styles.corpusBadgeNeutral, hint: "" },
  belowSignificance: {
    className: styles.corpusBadgeCaution,
    hint: ` — below the ${SIGNIFICANCE_FLOOR}-entry significance floor; differences within ~5 chrF++ are noise`,
  },
  belowDevFloor: {
    className: styles.corpusBadgeCritical,
    hint: ` — below the ${DEV_SET_FLOOR}-entry development-set floor; orderings indicative only`,
  },
};

function CorpusSizeBadge({ n, inCell = false }) {
  const level = corpusSizeLevel(n);
  if (!level) return null;
  const meta = CORPUS_FLOOR_META[level];
  return (
    <span
      className={`${styles.corpusBadge} ${meta.className} ${inCell ? styles.corpusBadgeCell : ""}`}
      title={`${n} evaluated entries${meta.hint}`}
      aria-label={`${n} evaluated entries${meta.hint}`}
    >
      n={n}
    </span>
  );
}

/** Dataset license display + prominent NonCommercial / research-only badge.
 *  Surfaces the corpus license on every row so an NC dataset's restriction is
 *  visible at a glance (it's usable for non-commercial / research evaluation,
 *  not for commercial / API use). Falls back to the run card's corpus_license
 *  when the dataset record carries none. */
function DatasetLicense({ license }) {
  if (!license) return null;
  const badges = licenseBadges(license);
  return (
    <div className={styles.detailField}>
      <span className={styles.detailLabel}>License</span>
      <span className={styles.detailValue}>
        <span className={styles.licenseChip} title="Corpus license (SPDX identifier)">
          {license}
        </span>
        {badges.map((b) => (
          <span
            key={b.code}
            className={`${styles.licenseRestriction} ${b.code === "nc" ? styles.licenseNc : ""}`}
            title={b.title}
          >
            {b.label}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Contamination lane display + prominent relative-comparison-only badge.
 *  HIGH-contamination corpora (e.g. FLORES+, in models' training data) are
 *  kept out of absolute-quality rankings — surface that on every row so a
 *  score is never silently read as an absolute quality measure. `grade` comes
 *  from the dataset's contamination metadata (data-driven, never hardcoded). */
function ContaminationBadge({ grade }) {
  const g = normalizeContamination(grade);
  const badges = contaminationBadges(g);
  if (!badges.length) return null;
  return (
    <div className={styles.detailField}>
      <span className={styles.detailLabel}>Contamination</span>
      <span className={styles.detailValue}>
        <span
          className={styles.licenseChip}
          title="Dataset contamination grade — how likely the corpus is in models' training data"
        >
          {g}
        </span>
        {badges.map((b) => (
          <span
            key={b.code}
            className={`${styles.contaminationBadge} ${
              b.code === "high" ? styles.contaminationHigh : styles.contaminationMedium
            }`}
            title={b.title}
          >
            {b.label}
          </span>
        ))}
      </span>
    </div>
  );
}

function CorpusContributionCta({ entry, dataset, languageMap }) {
  const level = corpusSizeLevel(entry.corpusSize);
  if (level !== "belowSignificance" && level !== "belowDevFloor") return null;
  const pair = dataset?.language_pair || entry.pair || "";
  const [pairSrc, pairTgt] = pair.includes(">") ? pair.split(">") : [];
  const tatoebaUrl = getTatoebaPairUrl(pairSrc, pairTgt);
  const pairLabel = formatPair(entry.pair, languageMap);
  const floorCopy =
    level === "belowDevFloor"
      ? `below even the ${DEV_SET_FLOOR}-entry development-set floor, so treat orderings as indicative only`
      : `below the ${SIGNIFICANCE_FLOOR}-entry significance floor, where differences within ~5 chrF++ points are noise`;

  return (
    <div className={styles.corpusCtaSection} id="corpus-cta">
      <div className={styles.corpusCtaHeader}>
        <CorpusSizeBadge n={entry.corpusSize} />
        <span className={styles.corpusCtaTitle}>Help build this corpus</span>
      </div>
      <p className={styles.corpusCtaText}>
        These scores come from only {entry.corpusSize} evaluated entries —{" "}
        {floorCopy}. Small corpora are never excluded or demoted from
        rankings; the fix is corpus growth. Our development corpora are
        rebuilt from Tatoeba releases, so sentences you add or translate
        upstream flow into the next corpus build.
      </p>
      <a
        className={styles.corpusCtaButton}
        href={tatoebaUrl}
        target="_blank"
        rel="noopener noreferrer"
        id="corpus-cta-link"
      >
        Add or translate {pairLabel} sentences on Tatoeba →
      </a>
    </div>
  );
}

/** Expanded row detail panel — lazy-loaded only when open. */
function RowDetail({ entry, datasets, languageMap }) {
  const dataset = datasets.find((d) => d.id === entry.dataset);
  return (
    <div className={styles.expandedInner}>
      {Object.entries(entry.metrics).map(([key, value]) => {
        const meta = METRIC_META[key];
        if (!meta) return null;
        return (
          <div className={styles.detailField} key={key}>
            <span className={styles.detailLabel}>{meta.label}</span>
            <span className={styles.detailValue}>
              {formatMetric(value, meta.suffix)}
            </span>
          </div>
        );
      })}
      {/* COMET-22 model provenance — which neural model produced the COMET
          score (wmt22-comet-da, or AfriCOMET for supported African languages),
          plus the low-resource caveat. Lazy-loaded with the full run card. */}
      {entry._runCard?.scores?.comet_model && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>COMET-22 model</span>
          <span className={`${styles.detailValue} ${styles.mono}`}>
            {entry._runCard.scores.comet_model}
            {entry._runCard.scores.comet_low_resource_warning
              ? " ⚠️ low-resource (wider error bars)"
              : ""}
          </span>
        </div>
      )}
      {/* SacreBLEU signatures — a published surface score is only reproducible
          if its exact metric configuration travels with it. */}
      {entry._runCard?.scores?.sacrebleu_signatures && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>
            SacreBLEU signatures <InfoTip text={TOOLTIPS.sacrebleuSignatures} />
          </span>
          <span className={`${styles.detailValue} ${styles.mono}`}>
            {Object.entries(entry._runCard.scores.sacrebleu_signatures).map(([k, v]) => (
              <span key={k} className={styles.signatureLine}>{k}: {v}</span>
            ))}
          </span>
        </div>
      )}
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Condition <InfoTip text={TOOLTIPS.condition} /></span>
        <span className={styles.detailValue}>{entry.condition}</span>
      </div>
      {/* Paradigm column (migration 030) — shown for every row that carries
          one, even harness-native rows whose method card lacks the field. */}
      {entry.paradigm && entry.paradigm !== "unknown" && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Paradigm <InfoTip text={TOOLTIPS.paradigm} /></span>
          <span className={styles.detailValue}>{entry.paradigm}</span>
        </div>
      )}
      {entry.methodCard ? (
        <div className={styles.methodCardSection}>
          <div className={styles.methodCardHeader}>
            <span className={styles.classBadge}>{entry.methodCard.class}</span>
            {entry.methodCard.paradigm && entry.methodCard.paradigm !== "unknown" && (
              <span className={styles.classBadge}>{entry.methodCard.paradigm}</span>
            )}
            <span className={styles.methodCardName}>{entry.methodCard.name}</span>
          </div>
          {entry.methodCard.description && (
            <p className={styles.methodCardDesc}>{entry.methodCard.description}</p>
          )}
          {entry.methodCard.tools_used?.length > 0 && (
            <div className={styles.toolTags}>
              {entry.methodCard.tools_used.map((tool, i) => (
                <span key={i} className={styles.toolTag}>{tool}</span>
              ))}
            </div>
          )}
          <div className={styles.methodCardMeta}>
            {entry.methodCard.author && <span>By {entry.methodCard.author}</span>}
            {entry.methodCard.open_source != null && (
              <span className={styles.ossBadge}>
                {entry.methodCard.open_source ? "Open Source" : "Closed Source"}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Method <InfoTip text={TOOLTIPS.method} /></span>
          <span className={styles.detailValue}>Harness-native configuration</span>
        </div>
      )}
      {entry.cost_usd != null && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Cost <InfoTip text={TOOLTIPS.cost} /></span>
          <span className={styles.detailValue}>{formatCost(entry.cost_usd)}</span>
        </div>
      )}
      {entry.elapsed_seconds != null && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Duration <InfoTip text={TOOLTIPS.duration} /></span>
          <span className={styles.detailValue}>{formatDuration(entry.elapsed_seconds)}</span>
        </div>
      )}
      {entry.cost_adjusted_score != null && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Cost-Adjusted Score</span>
          <span className={styles.detailValue}>{entry.cost_adjusted_score.toFixed(4)}</span>
        </div>
      )}
      {entry.cost_per_entry_usd != null && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Cost per Entry</span>
          <span className={styles.detailValue}>{formatCost(entry.cost_per_entry_usd)}</span>
        </div>
      )}
      {entry.avg_latency_seconds != null && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Avg Latency</span>
          <span className={styles.detailValue}>{formatDuration(entry.avg_latency_seconds)}</span>
        </div>
      )}
      {dataset && (
        <>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Dataset</span>
            <span className={styles.detailValue}>{dataset.name}</span>
          </div>
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Domain</span>
            <span className={styles.detailValue}>{dataset.domain}</span>
          </div>
          <DatasetLicense license={dataset.license || entry._runCard?.corpus_license} />
          <ContaminationBadge
            grade={dataset.metadata?.contamination ?? entry._runCard?.contamination}
          />
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Corpus Size <InfoTip text={TOOLTIPS.corpusSize} /></span>
            <span className={styles.detailValue}>
              {entry.corpusSize} pairs <CorpusSizeBadge n={entry.corpusSize} />
            </span>
          </div>
        </>
      )}
      {!dataset && entry._runCard?.corpus_license && (
        <DatasetLicense license={entry._runCard.corpus_license} />
      )}
      {!dataset && <ContaminationBadge grade={entry._runCard?.contamination} />}
      <CorpusContributionCta entry={entry} dataset={dataset} languageMap={languageMap} />
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Provenance <InfoTip text={TOOLTIPS.provenance} /></span>
        <span className={`${styles.detailValue} ${styles.mono}`}>
          {entry._runCard?.provenance?.repo || "N/A (harness-native)"}
        </span>
      </div>
      {entry._runCard?.provenance?.commit && (
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Commit</span>
          <span className={`${styles.detailValue} ${styles.mono}`}>
            {entry._runCard.provenance.commit.slice(0, 12)}
            {entry._runCard.provenance.dirty ? " (dirty)" : ""}
          </span>
        </div>
      )}
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Fingerprint <InfoTip text={TOOLTIPS.fingerprint} /></span>
        <span className={`${styles.detailValue} ${styles.mono}`}>
          {entry._runCard?.fingerprint?.hash?.slice(0, 16) || "—"}
        </span>
      </div>
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Harness Version</span>
        <span className={`${styles.detailValue} ${styles.mono}`}>
          {entry.harnessVersion}
        </span>
      </div>
      <div className={styles.detailField}>
        <span className={styles.detailLabel}>Submission Date</span>
        <span className={styles.detailValue}>{entry.date}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Chooser component
// ---------------------------------------------------------------------------

function ColumnChooser({ visible, onChange, allColumns }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return undefined;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(key) {
    const next = new Set(visible);
    if (next.has(key)) {
      // Don't allow removing rank or model — always visible
      if (key === "rank" || key === "model") return;
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div className={styles.columnChooser} ref={ref}>
      <button
        type="button"
        className={styles.columnChooserBtn}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Columns ▾
      </button>
      {open && (
        <div className={styles.columnChooserDropdown} role="menu">
          {allColumns.filter((c) => c.key !== "rank").map((col) => (
            <label key={col.key} className={styles.columnChooserItem}>
              <input
                type="checkbox"
                className={styles.columnChooserCheck}
                checked={visible.has(col.key)}
                onChange={() => toggle(col.key)}
                disabled={col.key === "model"}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCSV(entries, visibleCols, languageMap) {
  const cols = COLUMNS.filter((c) => visibleCols.has(c.key) && c.key !== "rank");
  const header = cols.map((c) => c.label).join(",");
  const rows = entries.map((entry) =>
    cols.map((col) => {
      const val = getCellValue(entry, col, languageMap);
      // Escape commas and quotes in CSV
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `champollion-leaderboard-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Get the display value for a cell. */
function getCellValue(entry, col, languageMap) {
  switch (col.key) {
    case "rank": return null;
    case "pair": return formatPair(entry.pair, languageMap);
    case "method": return entry.method;
    case "model": return entry.model;
    case "trust": return entry.trust;
    case "tier": return entry.qualityTier || "—";
    case "author": return entry.author;
    case "date": return entry.date;
    case "costEntry": return entry.cost_per_entry_usd;
    case "latency": return entry.avg_latency_seconds;
    default:
      if (col.accessor) return col.accessor(entry);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Note: Text search is now handled server-side via Supabase `ilike` queries
// in buildListingUrl(). No client-side matchesSearch needed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Server-side data layer — designed for 100K+ rows.
//
// Architecture:
//   1. Listing query: fetches lightweight columns (no run_card JSONB),
//      with all filters, sort, and pagination pushed to Supabase.
//   2. Detail query: lazy-loads the full run_card for a single row
//      only when the user expands it.
//   3. Filter options: separate lightweight queries for distinct
//      models, tiers, conditions — so dropdowns populate without
//      fetching all rows.
//   4. Pagination: cursor-based via Range header, 100 rows per page.
//   5. Count: Prefer: count=exact header returns total without data.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

// Listing columns — everything EXCEPT run_card. The detail panel
// lazy-loads run_card separately when a row is expanded.
const LISTING_SELECT = [
  "id", "submitter", "model_slug", "condition", "dataset_id",
  "language_pair", "composite_score", "quality_tier", "trust",
  "chrf_plus_plus", "exact_match_rate", "fst_acceptance_rate",
  "equivalent_match_rate", "semantic_score",
  "corpus_bleu", "comet_score", "ter",
  // spBLEU (FLORES-200 tokenizer) lives in the run_card JSONB scores block, not
  // a top-level column. Extract it here (same JSON-path trick as contamination
  // below) so the secondary spBLEU column populates WITHOUT lazy-loading the
  // full card. Comes back as TEXT — mapRow() parses it to a number. Display-only
  // (not server-sortable, since it isn't a real column).
  "spbleu:run_card->scores->>spbleu",
  "total_cost_usd", "cost_per_entry_usd",
  "tokens_per_second", "entries_per_minute",
  "harness_version", "run_timestamp", "submitted_at",
  "avg_latency_seconds", "elapsed_seconds",
  "corpus_size", "method_class",
  // The contamination grade lives only inside the run_card JSONB (publish.py
  // stamps run_card.contamination — no top-level column). Extract it here so
  // the lane gate can read each row's own grade WITHOUT lazy-loading the full
  // card on every page. This is the fallback that keeps a registry corpus
  // missing from the prod datasets table from ranking as absolute quality.
  "contamination:run_card->>contamination",
].join(",");

// Map our sort keys to Supabase column names
const SORT_KEY_TO_COLUMN = {
  composite: "composite_score",
  chrF: "chrf_plus_plus",
  exactMatch: "exact_match_rate",
  fstAcceptance: "fst_acceptance_rate",
  equivalentMatch: "equivalent_match_rate",
  semanticScore: "semantic_score",
  bleu: "corpus_bleu",
  comet: "comet_score",
  ter: "ter",
  method: "condition",
  model: "model_slug",
  author: "submitter",
  date: "run_timestamp",
  pair: "language_pair",
  costEntry: "cost_per_entry_usd",
  latency: "avg_latency_seconds",
};

// Supabase headers shared by all queries
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

/**
 * Build a Supabase REST query URL from the current filter + sort + page state.
 *
 * Pushes ALL filtering to the server so we never fetch more than PAGE_SIZE
 * rows. Text search uses Supabase `or` + `ilike` across the searchable
 * columns (model_slug, submitter, condition, language_pair, method_class).
 */
function buildListingUrl({ srcFilter, tgtFilter, modelFilter, tierFilter,
  trustFilter, methodClassFilter, paradigmFilter, paradigmAvailable = false,
  searchQuery, activeCondition, sortKey, sortDir, page,
  listingSelect = LISTING_SELECT }) {

  const params = new URLSearchParams();
  params.set("select", listingSelect);
  params.set("trust", "neq.disqualified");

  // Language pair filter — Supabase stores "eng>tha" format
  if (srcFilter !== "any" && tgtFilter !== "any") {
    // Both set: exact pair match
    params.set("language_pair", `eq.${srcFilter}>${tgtFilter}`);
  } else if (srcFilter !== "any") {
    // Source only: starts with "xxx>"
    params.set("language_pair", `like.${srcFilter}>%`);
  } else if (tgtFilter !== "any") {
    // Target only: ends with ">xxx"
    params.set("language_pair", `like.%>${tgtFilter}`);
  }

  // Model filter
  if (modelFilter !== "any") {
    params.set("model_slug", `eq.${modelFilter}`);
  }

  // Tier filter
  if (tierFilter !== "any") {
    params.set("quality_tier", `eq.${tierFilter}`);
  }

  // Method class filter — the run_cards.method_class column always exists.
  if (methodClassFilter && methodClassFilter !== "any") {
    params.set("method_class", `eq.${methodClassFilter}`);
  }

  // Paradigm filter — only applied when the paradigm column is present in the
  // target DB (migration 030). Gating avoids 400-ing the whole listing query
  // against a database that predates the column.
  if (paradigmAvailable && paradigmFilter && paradigmFilter !== "any") {
    params.set("paradigm", `eq.${paradigmFilter}`);
  }

  // Trust filter — map display names back to DB values.
  // Intentionally overwrites the neq.disqualified guard above via
  // URLSearchParams.set() — when filtering to a specific trust level,
  // the exclusive filter is sufficient since "disqualified" is never
  // offered in the dropdown (fetchDistinct already excludes it).
  if (trustFilter !== "any") {
    const dbTrust = Object.entries(DB_TRUST_TO_DISPLAY)
      .find(([, display]) => display === trustFilter)?.[0] || trustFilter;
    params.set("trust", `eq.${dbTrust}`);
  }

  // Condition filter (skip for "all" and "best")
  if (activeCondition !== "all" && activeCondition !== "best") {
    const group = CONDITION_GROUPS.find((g) => g.key === activeCondition);
    if (group && group.isPrefix) {
      params.set("condition", `like.${activeCondition}%`);
    } else {
      params.set("condition", `eq.${activeCondition}`);
    }
  }

  // Text search — use Supabase `or` filter across searchable columns.
  // ilike is case-insensitive LIKE. We search model, author, condition,
  // pair, and method_class. Sanitize to prevent query injection:
  // strip LIKE wildcards (%, _), commas (Supabase OR separator), and
  // parentheses (PostgREST operator syntax).
  if (searchQuery) {
    const q = searchQuery.replace(/[%_,().]/g, "");
    if (q.length > 0) {
      const cols = ["model_slug", "submitter", "condition", "language_pair", "method_class"];
      if (paradigmAvailable) cols.push("paradigm");
      params.set("or", `(${cols.map((c) => `${c}.ilike.*${q}*`).join(",")})`);
    }
  }

  // Sort — map our key to Supabase column, with nulls last
  const sortCol = SORT_KEY_TO_COLUMN[sortKey] || "composite_score";
  const sortDirection = sortDir === "asc" ? "asc" : "desc";
  params.set("order", `${sortCol}.${sortDirection}.nullslast`);

  return `${SUPABASE_URL}/rest/v1/run_cards?${params.toString()}`;
}

/**
 * Map a raw Supabase row to our internal entry shape (without run_card).
 * run_card fields (_runCard, methodCard, cost_adjusted_score) are null
 * until lazy-loaded on expand.
 */
function mapRow(row) {
  const lp = (row.language_pair || "?").trim().toLowerCase();
  const [lpSrc, lpTgt] = lp.includes(">") ? lp.split(">") : [lp, ""];
  return {
    id: row.id,
    method: row.condition?.includes("+") ? `fst-gate-${row.condition}` : `prompt-${row.condition}`,
    model: row.model_slug,
    condition: row.condition,
    pair: lp,
    src: (lpSrc || "?").trim(),
    tgt: (lpTgt || "?").trim(),
    dataset: row.dataset_id,
    metrics: {
      composite: row.composite_score,
      chrF: row.chrf_plus_plus,
      exactMatch: row.exact_match_rate,
      fstAcceptance: row.fst_acceptance_rate,
      equivalentMatch: row.equivalent_match_rate,
      semanticScore: row.semantic_score,
      bleu: row.corpus_bleu,
      comet: row.comet_score,
      ter: row.ter,
      // spBLEU arrives as JSON-extracted TEXT (run_card->scores->>spbleu) — parse
      // to a number so it formats and exports numerically. Absent/empty/NaN → null.
      spbleu:
        row.spbleu != null && row.spbleu !== "" && !Number.isNaN(Number(row.spbleu))
          ? Number(row.spbleu)
          : null,
    },
    qualityTier: row.quality_tier,
    cost_per_entry_usd: row.cost_per_entry_usd,
    cost_adjusted_score: null, // lazy-loaded from run_card
    avg_latency_seconds: row.avg_latency_seconds,
    author: row.submitter,
    trust: DB_TRUST_TO_DISPLAY[row.trust] || "self-benchmarked",
    harnessVersion: row.harness_version,
    runCardHash: row.id,
    corpusSize: row.corpus_size,
    date: row.run_timestamp?.split("T")[0] || row.submitted_at?.split("T")[0],
    cost_usd: row.total_cost_usd,
    elapsed_seconds: row.elapsed_seconds,
    methodClass: row.method_class,
    paradigm: row.paradigm ?? null,
    // Contamination grade extracted from the run_card JSONB in the listing
    // query (see LISTING_SELECT). Available at filter time — unlike _runCard,
    // which is null until expand — so the lane gate can fall back to it.
    runCardContamination: row.contamination ?? null,
    _runCard: null, // lazy-loaded
    methodCard: null, // lazy-loaded
  };
}

/**
 * Fetch the full run_card for a single entry (detail panel).
 * Returns the run_card JSONB or null on failure.
 */
async function fetchRunCard(entryId) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/run_cards?select=run_card&id=eq.${entryId}`,
      { headers: SB_HEADERS }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.[0]?.run_card || null;
  } catch (e) {
    console.warn("[leaderboard] Failed to fetch run_card detail:", e);
    return null;
  }
}

/**
 * Fetch distinct values for a column — used to populate filter dropdowns
 * without loading all 100K rows. Fetches up to 10,000 rows (the practical
 * upper bound for distinct models, tiers, conditions, or language pairs)
 * and deduplicates client-side since Supabase REST doesn't support
 * native DISTINCT.
 */
async function fetchDistinct(column, extraFilter) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/run_cards?select=${column}&trust=neq.disqualified&${column}=not.is.null&order=${column}.asc`;
    if (extraFilter) url += `&${extraFilter}`;
    const resp = await fetch(url, {
      headers: {
        ...SB_HEADERS,
        // Override Supabase's default 1000-row limit so we don't
        // silently miss filter options at scale.
        Range: "0-9999",
        Prefer: "return=minimal",
      },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const unique = [...new Set(data.map((row) => row[column]))].filter(Boolean);
    return unique.sort();
  } catch (e) {
    console.warn(`[leaderboard] Failed to fetch distinct ${column}:`, e);
    return [];
  }
}

/**
 * Probe whether a column exists on run_cards. Selecting a missing column 400s,
 * so a 2xx response means the column is present. Used to gate the paradigm
 * filter (migration 030) without assuming the target DB has the column —
 * distinct-value fetches can't tell "column missing" from "no values yet".
 */
async function probeColumnExists(column) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/run_cards?select=${column}&limit=1`,
      { headers: { ...SB_HEADERS, Range: "0-0" } },
    );
    return resp.ok;
  } catch (e) {
    console.warn(`[leaderboard] Column probe for ${column} failed:`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  // ---- Core state ----
  const [srcFilter, setSrcFilter] = useState("any");
  const [tgtFilter, setTgtFilter] = useState("any");
  const [completedOnly, setCompletedOnly] = useState(true);
  const [queuePairs, setQueuePairs] = useState(null);
  const [activeCondition, setActiveCondition] = useState("all");
  const [activeMetric, setActiveMetric] = useState("composite");
  const [sortKey, setSortKey] = useState("composite");
  const [datasets, setDatasets] = useState([]);
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [languageMap, setLanguageMap] = useState(new Map());

  // ---- New filter state ----
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("any");
  const [tierFilter, setTierFilter] = useState("any");
  const [trustFilter, setTrustFilter] = useState("any");
  const [methodClassFilter, setMethodClassFilter] = useState("any");
  const [paradigmFilter, setParadigmFilter] = useState("any");
  // Contamination lane. HIGH-contamination corpora (e.g. FLORES+, in models'
  // training data) are relative-comparison-only and must never be mixed into
  // absolute-quality rankings, so the board DEFAULTS to the absolute lane
  // (HIGH excluded). "relative" shows only HIGH rows; "all" shows everything.
  const [laneFilter, setLaneFilter] = useState("absolute");
  const [highlightId, setHighlightId] = useState(null);
  const [boardStats, setBoardStats] = useState(null);

  // ---- Filter option lists (loaded once from DB) ----
  const [modelOptions, setModelOptions] = useState([]);
  const [tierOptions, setTierOptions] = useState([]);
  const [trustOptions, setTrustOptions] = useState([]);
  const [methodClassOptions, setMethodClassOptions] = useState([]);
  const [paradigmOptions, setParadigmOptions] = useState([]);
  const [paradigmColumnExists, setParadigmColumnExists] = useState(false);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [targetOptions, setTargetOptions] = useState([]);

  // The paradigm column (migration 030) may be absent in some target DBs
  // (e.g. a freshly branched one). We probe for it once and only then add it
  // to the listing select / filter / search and render its dropdown — so the
  // query never 400s against a database that predates the column. method_class
  // needs no such gate (that column has always existed). The dropdown's
  // options populate separately and may be empty until paradigm-bearing runs
  // publish, exactly like method_class on an empty board.
  const paradigmAvailable = paradigmColumnExists;

  // ---- Contamination grade per dataset (data-driven lane classification) ----
  // Sourced from the datasets table's metadata.contamination (synced from the
  // registry SSOT), so the lane needs no run_cards column / DB migration. When
  // a dataset row is absent from prod we fall back to the grade publish.py
  // stamped onto the run card itself (entry.runCardContamination); a corpus
  // whose grade is genuinely unknown is held OUT of the absolute lane by the
  // fail-safe gate below — never "treated as rankable on absolute quality".
  const datasetContamination = useMemo(() => {
    const m = new Map();
    for (const d of datasets) {
      const g = normalizeContamination(d?.metadata?.contamination);
      if (g && d?.id) m.set(d.id, g);
    }
    return m;
  }, [datasets]);
  // The per-run grade carried on the listing row (run_card->>contamination)
  // or, once expanded, the lazy-loaded full card. Same value either way.
  const entryRunCardGrade = useCallback(
    (entry) => entry?.runCardContamination ?? entry?._runCard?.contamination ?? null,
    [],
  );
  // Best-KNOWN grade for display/badges: datasets-table grade, else the run
  // card's stamped grade, else null. null ⇒ no badge (we don't assert a grade
  // we can't see). Distinct from the lane gate, which fails safe on null.
  const entryContaminationGrade = useCallback(
    (entry) =>
      resolveContaminationGrade(
        datasetContamination.get(entry?.dataset),
        entryRunCardGrade(entry),
      ),
    [datasetContamination, entryRunCardGrade],
  );
  // Lane gate (FAIL SAFE): true ⇒ relative-comparison-only, kept out of the
  // absolute-quality ranking. Known HIGH or UNKNOWN → true; LOW/MEDIUM → false.
  const entryIsRelativeOnlyLane = useCallback(
    (entry) =>
      isRelativeOnlyLane(
        datasetContamination.get(entry?.dataset),
        entryRunCardGrade(entry),
      ),
    [datasetContamination, entryRunCardGrade],
  );

  // ---- Detail cache: id → run_card (lazy-loaded) ----
  const [detailCache, setDetailCache] = useState({});

  // ---- Column chooser state (persisted in localStorage) ----
  const [visibleCols, setVisibleCols] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE;
    try {
      const stored = localStorage.getItem(LS_COLUMNS_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch (e) { console.warn("[leaderboard] Could not read column prefs from localStorage:", e); }
    return new Set(DEFAULT_VISIBLE);
  });

  // ---- Mobile filter panel state ----
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const tableRef = useRef(null);

  // Persist column choices
  const updateVisibleCols = useCallback((next) => {
    setVisibleCols(next);
    try {
      localStorage.setItem(LS_COLUMNS_KEY, JSON.stringify([...next]));
    } catch (e) { console.warn("[leaderboard] Could not persist column prefs to localStorage:", e); }
  }, []);

  // Debounce search — don't fire server queries on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load the lightweight code→name map for pair labels (a few hundred KB from
  // Supabase trading_card_index — NOT the 56 MB languages.json, which used to be
  // pulled here just for labels and broke the leaderboard on mobile). If it
  // fails, pairs render as bare codes (formatPair upper-cases unknowns) — labels
  // are display polish, not data, so this degrades honestly rather than blocking.
  useEffect(() => {
    let cancelled = false;
    loadLanguageNameMap()
      .then((map) => {
        if (!cancelled) setLanguageMap(map);
      })
      .catch((e) => {
        console.error("[leaderboard] language name map unavailable — pairs show codes:", e);
      });
    return () => { cancelled = true; };
  }, []);

  // Board-total stats for the header strip — one small mount-time read,
  // independent of the filter state (the filtered count lives in totalCount).
  // Fail-soft: any error or an empty board just hides the strip.
  useEffect(() => {
    let cancelled = false;
    const url =
      `${SUPABASE_URL}/rest/v1/run_cards` +
      `?select=language_pair,model_slug,submitted_at` +
      `&trust=neq.disqualified&order=submitted_at.desc&limit=1000`;
    fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Prefer: "count=exact" },
    })
      .then(async (r) => {
        if (!r.ok) return null;
        return { rows: await r.json(), range: r.headers.get("content-range") };
      })
      .then((res) => {
        if (cancelled || !res || !Array.isArray(res.rows) || !res.rows.length) return;
        const fromRange =
          res.range && res.range.includes("/")
            ? parseInt(res.range.split("/")[1], 10)
            : NaN;
        setBoardStats({
          total: Number.isFinite(fromRange) ? fromRange : res.rows.length,
          pairs: new Set(res.rows.map((row) => row.language_pair)).size,
          methods: new Set(res.rows.map((row) => row.model_slug)).size,
          latest: dateLabel(res.rows[0].submitted_at),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // URL param handling: ?pair=eng>cym&id=xxx
  useEffect(() => {
    if (languageMap.size === 0) return;
    const params = new URLSearchParams(window.location.search);
    const pair = params.get("pair");
    if (pair && pair.includes(">")) {
      const [srcCode, tgtCode] = pair.split(">");
      // For server-side filtering, we need ISO codes, not display names.
      // Store the raw ISO codes for the pair filter since the query
      // operates on language_pair which uses ISO codes.
      setSrcFilter(srcCode.trim());
      setTgtFilter(tgtCode.trim());
    }
    const rowId = params.get("id");
    if (rowId) {
      setExpandedId(rowId);
      setHighlightId(rowId);
      setTimeout(() => setHighlightId(null), 3000);
    }
  }, [languageMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load filter options once on mount — lightweight distinct queries
  useEffect(() => {
    fetchDistinct("model_slug").then(setModelOptions);
    fetchDistinct("quality_tier").then(setTierOptions);
    fetchDistinct("condition").then(setConditionOptions);
    fetchDistinct("method_class").then(setMethodClassOptions);
    // paradigm (migration 030): probe for the column so the filter renders as
    // soon as the column exists (like method_class), then load its distinct
    // values. On a DB without the column the probe returns false and the
    // feature stays dark — the listing query never references the column.
    probeColumnExists("paradigm").then(setParadigmColumnExists);
    fetchDistinct("paradigm").then(setParadigmOptions);
    // Trust needs display name mapping
    fetchDistinct("trust").then((vals) => {
      setTrustOptions(vals.map((v) => DB_TRUST_TO_DISPLAY[v] || v).filter(Boolean));
    });

    // Fetch datasets (non-fatal). Override Supabase's default 1000-row cap with
    // a wide Range (as fetchDistinct does) — there are >5,000 datasets, and a
    // truncated map would leave most corpora with NO contamination grade, so
    // the lane gate would fail safe to relative-only for rows it should rank
    // (and miss license/name metadata). Range covers the full table.
    fetch(`${SUPABASE_URL}/rest/v1/datasets?select=*`, {
      headers: { ...SB_HEADERS, Range: "0-9999" },
    })
      .then((r) => r.ok ? r.json() : [])
      .then(setDatasets)
      .catch((e) => console.warn("[leaderboard] Could not fetch datasets:", e));
  }, []);

  // Load source/target language options from the language_pair column
  useEffect(() => {
    fetchDistinct("language_pair").then((pairs) => {
      const srcs = new Set();
      const tgts = new Set();
      pairs.forEach((p) => {
        if (!p.includes(">")) return;
        const [s, t] = p.split(">");
        srcs.add(s.trim());
        tgts.add(t.trim());
      });
      setSourceOptions([...srcs].sort());
      setTargetOptions([...tgts].sort());
    });
  }, []);

  // ---- Main data fetch — re-runs whenever filters/sort/page change ----
  // This is the core query that pushes everything to Supabase.
  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 0;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    // Only request the paradigm column once we know it exists — selecting a
    // missing column 400s the whole listing query.
    const listingSelect = paradigmAvailable
      ? `${LISTING_SELECT},paradigm`
      : LISTING_SELECT;

    const url = buildListingUrl({
      srcFilter, tgtFilter, modelFilter, tierFilter, trustFilter,
      methodClassFilter, paradigmFilter, paradigmAvailable,
      searchQuery: debouncedSearch, activeCondition, sortKey, sortDir, page,
      listingSelect,
    });

    const rangeStart = page * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;

    fetch(url, {
      headers: {
        ...SB_HEADERS,
        Range: `${rangeStart}-${rangeEnd}`,
        Prefer: "count=exact",
      },
    })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // Supabase returns total count in Content-Range header:
        // "0-99/12345" or "*/0" if empty
        const contentRange = resp.headers.get("Content-Range");
        if (contentRange) {
          const total = parseInt(contentRange.split("/")[1], 10);
          if (!isNaN(total)) setTotalCount(total);
        }
        return resp.json();
      })
      .then((data) => {
        if (cancelled) return;
        const mapped = data.filter((row) => row.trust !== "disqualified").map(mapRow);
        if (isFirstPage) {
          setEntries(mapped);
        } else {
          // Append to existing entries for "Load more"
          setEntries((prev) => [...prev, ...mapped]);
        }
        setFetchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[leaderboard] Fetch failed:", err);
        setFetchError(err.message);
        if (isFirstPage) setEntries([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => { cancelled = true; };
  }, [srcFilter, tgtFilter, modelFilter, tierFilter, trustFilter,
      methodClassFilter, paradigmFilter, paradigmAvailable,
      debouncedSearch, activeCondition, sortKey, sortDir, page]);

  // Reset to page 0 whenever filters or sort change
  const resetPage = useCallback(() => {
    setPage(0);
    setExpandedId(null);
  }, []);

  // ---- Lazy-load run_card when a row is expanded ----
  useEffect(() => {
    if (!expandedId || detailCache[expandedId]) return;
    fetchRunCard(expandedId).then((runCard) => {
      if (!runCard) return;
      setDetailCache((prev) => ({ ...prev, [expandedId]: runCard }));
      // Also patch the entry in the list so RowDetail has data
      setEntries((prev) => prev.map((e) => {
        if (e.id !== expandedId) return e;
        return {
          ...e,
          _runCard: runCard,
          methodCard: runCard.method_card || null,
          cost_adjusted_score: runCard.cost_adjusted_score ?? null,
        };
      }));
    });
  }, [expandedId, detailCache]);

  // ---- Derived data ----

  const codeName = useCallback((code) => {
    if (!code || code === "?") return "Unknown";
    const hit = languageMap.get(code);
    if (hit) return hit;
    if (code.length > 3) return code.replace(/\b\w/g, (ch) => ch.toUpperCase());
    return code.toUpperCase();
  }, [languageMap]);

  // Queue pair loading for "completed runs only" toggle
  useEffect(() => {
    if (completedOnly || queuePairs !== null) return undefined;
    let cancelled = false;
    (async () => {
      // DB-first (B1 / DB-as-queue): the LIVE per-pair aggregation from
      // queue_pairs (061), coverage-filtered against VERIFIED runs with the
      // exact same filter as the served queue — so "N waiting for this
      // selection" tracks the board, not the last ranker snapshot.
      try {
        const pairs = await fetchQueuePairs({ rankMode: "map" });
        if (!cancelled && Array.isArray(pairs)) {
          setQueuePairs(
            pairs.map((p) => ({
              src: p.src,
              tgt: p.tgt,
              count: p.count,
              minCost: p.minCost ?? null,
            })),
          );
          return;
        }
      } catch {
        /* DB unreachable — fall back to the static preview below. */
      }
      if (cancelled) return;

      // Fallback: the small preview's pre-aggregated per-pair counts (kept
      // generated) instead of downloading the full multi-MB queue.json to reduce
      // client-side. The preview's `pairs` already carries { src, tgt, count,
      // minCost } over the whole queue; if an older full file is served instead,
      // reduce its raw items.
      try {
        const r = await fetch("/queue-preview.json");
        const q = r.ok ? await r.json() : null;
        if (cancelled) return;
        if (Array.isArray(q?.pairs)) {
          setQueuePairs(
            q.pairs.map((p) => ({
              src: p.src,
              tgt: p.tgt,
              count: p.count,
              minCost: p.minCost ?? null,
            })),
          );
          return;
        }
        const items = Array.isArray(q) ? q : q?.items;
        if (!Array.isArray(items)) { setQueuePairs([]); return; }
        const byPair = new Map();
        items.forEach((it) => {
          const lp = (it.language_pair || "").trim().toLowerCase();
          if (!lp.includes(">")) return;
          const [s, t] = lp.split(">");
          const cur = byPair.get(lp) || { src: s, tgt: t, count: 0, minCost: null };
          cur.count += 1;
          if (it.est_cost_usd != null) {
            cur.minCost = cur.minCost == null ? it.est_cost_usd : Math.min(cur.minCost, it.est_cost_usd);
          }
          byPair.set(lp, cur);
        });
        setQueuePairs(Array.from(byPair.values()));
      } catch {
        if (!cancelled) setQueuePairs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [completedOnly, queuePairs]);

  // Condition groups with data — derived from the distinct conditions we fetched
  const availableConditionGroups = useMemo(() => {
    return CONDITION_GROUPS.filter((group) => {
      if (group.isPrefix) return conditionOptions.some((c) => c.startsWith(group.key));
      return conditionOptions.includes(group.key);
    });
  }, [conditionOptions]);

  // Client-side passes over the current page: "best per model" (needs
  // cross-row score comparison) and the contamination lane (needs the dataset
  // grade, which rides on datasets.metadata, not a run_cards column). Both are
  // trivial at 100 rows/page.
  const displayEntries = useMemo(() => {
    let base = entries;
    if (activeCondition === "best") {
      const bestByModel = new Map();
      entries.forEach((entry) => {
        const metricValue = entry.metrics[activeMetric] ?? -Infinity;
        const existing = bestByModel.get(entry.model);
        if (!existing || (existing.metrics[activeMetric] ?? -Infinity) < metricValue) {
          bestByModel.set(entry.model, entry);
        }
      });
      base = Array.from(bestByModel.values());
    }
    // Contamination lane: HIGH-contamination corpora (and any corpus whose
    // grade is unknown — fail safe) are relative-comparison-only and must never
    // appear in the absolute-quality ranking. Default ("absolute") drops them;
    // "relative" keeps only them; "all" keeps both.
    if (laneFilter !== "all") {
      base = base.filter((entry) => {
        const relativeOnly = entryIsRelativeOnlyLane(entry);
        return laneFilter === "relative" ? relativeOnly : !relativeOnly;
      });
    }
    return base;
  }, [entries, activeCondition, activeMetric, laneFilter, entryIsRelativeOnlyLane]);

  // Available metrics (only show columns with data in current page)
  const availableMetrics = useMemo(() => {
    // COMET-22 is co-primary, so it joins the headline metric toggle (rank-by).
    // The lexical surface metrics stay column-only secondaries.
    return ["composite", "comet", "chrF", "exactMatch", "fstAcceptance", "equivalentMatch", "semanticScore"].filter((k) =>
      displayEntries.some((entry) => entry.metrics[k] != null),
    );
  }, [displayEntries]);

  // Entries are already sorted server-side — no client-side sort needed.
  const sortedEntries = displayEntries;

  // Rank map — server returns rows in sort order, so rank = position
  const rankMap = useMemo(() => {
    const map = new Map();
    sortedEntries.forEach((entry, i) => {
      map.set(entry, (page * PAGE_SIZE) + i + 1);
    });
    return map;
  }, [sortedEntries, page]);

  // Queued selection info
  const queuedSelection = useMemo(() => {
    if (completedOnly || !Array.isArray(queuePairs)) return null;
    if (srcFilter === "any" && tgtFilter === "any") return null;
    return queuePairs.filter(
      (p) =>
        (srcFilter === "any" || p.src === srcFilter) &&
        (tgtFilter === "any" || p.tgt === tgtFilter),
    );
  }, [completedOnly, queuePairs, srcFilter, tgtFilter]);

  const queuedRunCount = queuedSelection
    ? queuedSelection.reduce((n, p) => n + p.count, 0) : 0;
  const queuedMinCost = queuedSelection
    ? queuedSelection.reduce((m, p) => p.minCost == null ? m : m == null ? p.minCost : Math.min(m, p.minCost), null)
    : null;

  const hasMore = entries.length < totalCount;

  // ---- Active filters list (for chips) ----
  const activeFilters = useMemo(() => {
    const filters = [];
    if (srcFilter !== "any") filters.push({ key: "src", label: `From: ${codeName(srcFilter)}`, clear: () => { setSrcFilter("any"); resetPage(); } });
    if (tgtFilter !== "any") filters.push({ key: "tgt", label: `To: ${codeName(tgtFilter)}`, clear: () => { setTgtFilter("any"); resetPage(); } });
    if (modelFilter !== "any") filters.push({ key: "model", label: `Model: ${modelFilter}`, clear: () => { setModelFilter("any"); resetPage(); } });
    if (tierFilter !== "any") filters.push({ key: "tier", label: `Tier: ${tierFilter}`, clear: () => { setTierFilter("any"); resetPage(); } });
    if (trustFilter !== "any") filters.push({ key: "trust", label: `Trust: ${trustFilter}`, clear: () => { setTrustFilter("any"); resetPage(); } });
    if (methodClassFilter !== "any") filters.push({ key: "methodClass", label: `Method: ${methodClassFilter}`, clear: () => { setMethodClassFilter("any"); resetPage(); } });
    if (paradigmFilter !== "any") filters.push({ key: "paradigm", label: `Paradigm: ${paradigmFilter}`, clear: () => { setParadigmFilter("any"); resetPage(); } });
    if (searchQuery) filters.push({ key: "search", label: `"${searchQuery}"`, clear: () => { setSearchQuery(""); resetPage(); } });
    // Lane: only surface a chip when off the default (absolute-quality) lane.
    if (laneFilter !== "absolute") {
      const label = laneFilter === "relative" ? "Lane: relative comparison only" : "Lane: all corpora";
      filters.push({ key: "lane", label, clear: () => setLaneFilter("absolute") });
    }
    return filters;
  }, [srcFilter, tgtFilter, modelFilter, tierFilter, trustFilter, methodClassFilter, paradigmFilter, searchQuery, laneFilter, codeName, resetPage]);

  // ---- Handlers ----

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const col = COL_MAP[key];
      setSortDir(col?.metric ? "desc" : "asc");
    }
    resetPage();
  }

  function handleRowClick(entry) {
    setExpandedId((prev) => (prev === entry.id ? null : entry.id));
  }

  function handleRowKeyDown(e, entry) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick(entry);
    }
  }

  function handleConditionChange(condition) {
    setActiveCondition(condition);
    resetPage();
  }

  function handleMetricChange(metric) {
    setActiveMetric(metric);
    setSortKey(metric);
    setSortDir("desc");
    resetPage();
  }

  function clearAllFilters() {
    setSrcFilter("any");
    setTgtFilter("any");
    setModelFilter("any");
    setTierFilter("any");
    setTrustFilter("any");
    setMethodClassFilter("any");
    setParadigmFilter("any");
    setSearchQuery("");
    setLaneFilter("absolute");
    resetPage();
  }

  function sortClass(key) {
    if (sortKey !== key) return styles.sortable;
    return `${styles.sortable} ${sortDir === "asc" ? styles.sortAsc : styles.sortDesc}`;
  }

  // Resolve which columns to actually show in the table
  const displayColumns = useMemo(() => {
    return COLUMNS.filter((c) => visibleCols.has(c.key));
  }, [visibleCols]);

  // ---- Render ----

  // Render a table cell for a given column and entry
  function renderCell(col, entry) {
    switch (col.key) {
      case "rank": {
        const rank = rankMap.get(entry);
        return <td key={col.key} className={styles.rankCell}>{rank != null ? rank : "–"}</td>;
      }
      case "pair":
        return <td key={col.key} className={styles.pairCell}>{formatPair(entry.pair, languageMap)}</td>;
      case "method":
        return <td key={col.key}>{entry.method}</td>;
      case "model":
        return <td key={col.key}>{entry.model}</td>;
      case "trust":
        return <td key={col.key}><TrustBadge trust={entry.trust} /></td>;
      case "tier":
        return <td key={col.key}><TierBadge tier={entry.qualityTier} /></td>;
      case "author":
        return <td key={col.key}>{entry.author}</td>;
      case "date":
        return <td key={col.key}>{formatDate(entry.date)}</td>;
      case "costEntry":
        return <td key={col.key} className={styles.metricCell}>{formatCost(entry.cost_per_entry_usd) || "—"}</td>;
      case "latency":
        return <td key={col.key} className={styles.metricCell}>{formatDuration(entry.avg_latency_seconds) || "—"}</td>;
      default: {
        // Metric columns
        if (col.accessor) {
          const val = col.accessor(entry);
          const isActive = activeMetric === col.key;
          return (
            <td key={col.key} className={`${styles.metricCell} ${isActive ? styles.metricHighlight : ""}`}>
              {formatMetric(val, col.suffix)}
              {col.key === "composite" && <CorpusSizeBadge n={entry.corpusSize} inCell />}
              {col.key === "composite" && isRelativeOnly(entryContaminationGrade(entry)) && (
                <span
                  className={`${styles.contaminationBadge} ${styles.contaminationHigh} ${styles.contaminationCellBadge}`}
                  title={translate({id: 'page.board.relOnlyTitle', message: 'HIGH contamination — relative comparison only, not absolute quality', description: 'badge tooltip'})}
                >
                  <Translate id="page.board.relOnly" description="badge">rel-only</Translate>
                </span>
              )}
            </td>
          );
        }
        return <td key={col.key}>—</td>;
      }
    }
  }

  // Filter controls — shared between desktop and mobile
  function renderFilterControls() {
    return (
      <>
        {/* Search */}
        <div className={styles.searchBar}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={translate({id: 'page.board.searchPh', message: 'Search models, authors, methods…', description: 'search placeholder'})}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            id="leaderboard-search"
            aria-label="Search leaderboard"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Language pair filter */}
        <div className={styles.pairFilter} id="pair-filter">
          <label className={styles.pairSelectLabel} htmlFor="pair-src"><Translate id="page.board.from" description="pair filter label">From</Translate></label>
          <select id="pair-src" className={styles.pairSelect} value={srcFilter}
            onChange={(e) => { setSrcFilter(e.target.value); resetPage(); }}>
            <option value="any">{translate({id: 'page.board.anySource', message: 'Any source', description: 'filter option'})}</option>
            {sourceOptions.map((code) => <option key={code} value={code}>{codeName(code)}</option>)}
          </select>
          <label className={styles.pairSelectLabel} htmlFor="pair-tgt"><Translate id="page.board.to" description="pair filter label">→ To</Translate></label>
          <select id="pair-tgt" className={styles.pairSelect} value={tgtFilter}
            onChange={(e) => { setTgtFilter(e.target.value); resetPage(); }}>
            <option value="any">{translate({id: 'page.board.anyTarget', message: 'Any target', description: 'filter option'})}</option>
            {targetOptions.map((code) => <option key={code} value={code}>{codeName(code)}</option>)}
          </select>
          <label className={styles.completedToggle} htmlFor="completed-only">
            <input id="completed-only" type="checkbox" checked={completedOnly}
              onChange={(e) => { setCompletedOnly(e.target.checked); resetPage(); }} />
            <Translate id="page.board.completedOnly" description="checkbox label">Completed runs only</Translate>
          </label>
        </div>

        {/* Faceted filters */}
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-model"><Translate id="page.board.model" description="filter label">Model</Translate></label>
            <select id="filter-model" className={styles.filterSelect} value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); resetPage(); }}>
              <option value="any">{translate({id: 'page.board.anyModel', message: 'Any model', description: 'filter option'})}</option>
              {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-tier"><Translate id="page.board.tier" description="filter label">Tier</Translate></label>
            <select id="filter-tier" className={styles.filterSelect} value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); resetPage(); }}>
              <option value="any">{translate({id: 'page.board.anyTier', message: 'Any tier', description: 'filter option'})}</option>
              {tierOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-trust"><Translate id="page.board.trust" description="filter label">Trust</Translate></label>
            <select id="filter-trust" className={styles.filterSelect} value={trustFilter}
              onChange={(e) => { setTrustFilter(e.target.value); resetPage(); }}>
              <option value="any">{translate({id: 'page.board.anyTrust', message: 'Any trust', description: 'filter option'})}</option>
              {trustOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-method-class"><Translate id="page.board.methodClass" description="filter label">Method class</Translate></label>
            <select id="filter-method-class" className={styles.filterSelect} value={methodClassFilter}
              onChange={(e) => { setMethodClassFilter(e.target.value); resetPage(); }}>
              <option value="any">{translate({id: 'page.board.anyMethodClass', message: 'Any method class', description: 'filter option'})}</option>
              {methodClassOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* Paradigm filter — rendered only when the column exists and has
              data (migration 030). This is the rule-based vs neural vs llm
              apples-to-apples comparison. */}
          {paradigmAvailable && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filter-paradigm"><Translate id="page.board.paradigm" description="filter label">Paradigm</Translate></label>
              <select id="filter-paradigm" className={styles.filterSelect} value={paradigmFilter}
                onChange={(e) => { setParadigmFilter(e.target.value); resetPage(); }}>
                <option value="any">{translate({id: 'page.board.anyParadigm', message: 'Any paradigm', description: 'filter option'})}</option>
                {paradigmOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <Layout
      title={translate({id: 'page.board.seoTitle', message: 'Method Leaderboard', description: '/leaderboard SEO title'})}
      description={translate({id: 'page.board.seoDesc', message: 'Benchmarking translation methods for Indigenous and low-resource languages with reproducible evaluation.', description: '/leaderboard SEO description'})}
    >
      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.board.title" description="h1">Leaderboard</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.board.subtitle" description="page subtitle">Benchmarking translation methods for Indigenous and low‑resource languages with reproducible, fingerprinted evaluation.</Translate>
          </p>
          <div className={styles.disclaimerBanner} id="eval-disclaimer">
            <Translate id="page.board.disclaimer" description="disclaimer banner; {spec} is a link" values={{spec: <a href="/docs/network/specifications/scoring" target="_blank" rel="noopener noreferrer"><Translate id="page.board.specLink" description="link text">scoring specification</Translate></a>}}>{'⚠️ These are automated proxy scores, not validated quality judgments. Community review determines deployment readiness. See the {spec} for methodology details.'}</Translate>
          </div>
          {boardStats && (
            <div className={styles.boardStats} aria-label="Board totals">
              <span className={styles.boardStat}>
                <strong>{boardStats.total.toLocaleString("en-US")}</strong>{" "}
                {boardStats.total === 1 ? translate({id: 'page.board.runOne', message: 'run', description: 'singular'}) : translate({id: 'page.board.runMany', message: 'runs', description: 'plural'})}
              </span>
              <span className={styles.boardStat}>
                <strong>{boardStats.pairs.toLocaleString("en-US")}</strong>{" "}
                {boardStats.pairs === 1 ? translate({id: 'page.board.pairMeasured', message: 'pair measured', description: 'singular'}) : translate({id: 'page.board.pairsMeasured', message: 'pairs measured', description: 'plural'})}
              </span>
              <span className={styles.boardStat}>
                <strong>{boardStats.methods.toLocaleString("en-US")}</strong>{" "}
                {boardStats.methods === 1 ? translate({id: 'page.board.methodOne', message: 'method', description: 'singular'}) : translate({id: 'page.board.methodMany', message: 'methods', description: 'plural'})}
              </span>
              {boardStats.latest && (
                <span className={styles.boardStat}>
                  <Translate id="page.board.latest" description="latest run date; {d} is the date" values={{d: <strong>{boardStats.latest}</strong>}}>{'latest {d}'}</Translate>
                </span>
              )}
            </div>
          )}
          <p className={styles.pageNote}>
            <Translate id="page.board.submitNote" description="submit note; {plugin}/{contests} are links" values={{
              plugin: <Link to="/docs/tutorials/build-a-plugin"><Translate id="page.board.pluginLink" description="link text">Build a plugin and submit your scores →</Translate></Link>,
              contests: <Link to="/shared-tasks"><Translate id="page.board.contestsLink" description="link text">Contests & shared tasks →</Translate></Link>,
            }}>{'Have a method to submit? {plugin} · {contests}'}</Translate>
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentWrapper}>
        {/* Controls bar — desktop */}
        <div className={styles.controlsBar} id="leaderboard-controls">
          {/* Desktop filters (hidden on mobile) */}
          <div className={styles.desktopFilters}>
            {renderFilterControls()}
          </div>

          {/* Mobile filter button (hidden on desktop) */}
          <button
            type="button"
            className={styles.mobileFilterBtn}
            onClick={() => setMobileFiltersOpen(true)}
            aria-label="Open filters"
          >
            <Translate id="page.board.filtersBtn" description="mobile filter button">Filters</Translate> {activeFilters.length > 0 && <span className={styles.filterBadgeCount}>{activeFilters.length}</span>}
          </button>

          {/* Metric Toggle */}
          <div className={styles.metricToggle} id="metric-toggle">
            {availableMetrics.map((metricKey) => (
              <button
                type="button"
                key={metricKey}
                id={`metric-toggle-${metricKey}`}
                className={`${styles.metricBtn} ${activeMetric === metricKey ? styles.metricBtnActive : ""}`}
                onClick={() => handleMetricChange(metricKey)}
              >
                {METRIC_META[metricKey].label}
              </button>
            ))}
          </div>

          {/* Condition Filter */}
          <div className={styles.conditionFilter} id="condition-filter">
            <span className={styles.conditionFilterLabel}><Translate id="page.board.condition" description="filter label">Condition:</Translate></span>
            <div className={styles.conditionPills}>
              <button type="button" id="condition-filter-all"
                className={`${styles.conditionPill} ${activeCondition === "all" ? styles.conditionPillActive : ""}`}
                onClick={() => handleConditionChange("all")}><Translate id="page.board.condAll" description="condition pill">All</Translate></button>
              <button type="button" id="condition-filter-best"
                className={`${styles.conditionPill} ${styles.conditionPillBest} ${activeCondition === "best" ? styles.conditionPillActive : ""}`}
                onClick={() => handleConditionChange("best")}><Translate id="page.board.condBest" description="condition pill">★ Best Only</Translate></button>
              {availableConditionGroups.map((group) => (
                <button type="button" key={group.key} id={`condition-filter-${group.key}`}
                  className={`${styles.conditionPill} ${activeCondition === group.key ? styles.conditionPillActive : ""}`}
                  onClick={() => handleConditionChange(group.key)}>
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contamination lane. HIGH-contamination corpora (e.g. FLORES+, in
              models' training data) are relative-comparison-only and never
              mixed into the absolute-quality ranking — the board defaults to
              the absolute lane and HIGH rows live in their own lane. */}
          <div className={styles.conditionFilter} id="lane-filter">
            <span className={styles.conditionFilterLabel}><Translate id="page.board.lane" description="filter label">Lane:</Translate></span>
            <div className={styles.conditionPills}>
              <button type="button" id="lane-filter-absolute"
                className={`${styles.conditionPill} ${laneFilter === "absolute" ? styles.conditionPillActive : ""}`}
                title={translate({id: 'page.board.laneAbsTitle', message: 'Rankable on absolute quality — excludes HIGH-contamination corpora', description: 'lane tooltip'})}
                onClick={() => setLaneFilter("absolute")}><Translate id="page.board.laneAbs" description="lane pill">Absolute quality</Translate></button>
              <button type="button" id="lane-filter-relative"
                className={`${styles.conditionPill} ${laneFilter === "relative" ? styles.conditionPillActive : ""}`}
                title={translate({id: 'page.board.laneRelTitle', message: 'HIGH-contamination corpora — scores valid for relative comparison only', description: 'lane tooltip'})}
                onClick={() => setLaneFilter("relative")}><Translate id="page.board.laneRel" description="lane pill">Relative comparison only</Translate></button>
              <button type="button" id="lane-filter-all"
                className={`${styles.conditionPill} ${laneFilter === "all" ? styles.conditionPillActive : ""}`}
                title={translate({id: 'page.board.laneAllTitle', message: 'Show every corpus (HIGH-contamination rows carry a relative-only badge)', description: 'lane tooltip'})}
                onClick={() => setLaneFilter("all")}><Translate id="page.board.laneAll" description="lane pill">All</Translate></button>
            </div>
          </div>
          {laneFilter === "relative" && (
            <p className={styles.laneNote} id="lane-note-relative">
              <Translate id="page.board.laneNote" description="relative lane note; {not} is bold" values={{not: <strong><Translate id="page.board.notWord" description="bold">not</Translate></strong>}}>{'Relative-comparison-only lane. These corpora (e.g. FLORES+) are likely in models\' training data, so scores rank methods against each other on the same corpus — they are {not} an absolute measure of quality and are kept out of the main ranking.'}</Translate>
            </p>
          )}

          {/* Active filter chips + results summary */}
          <div className={styles.resultsSummary}>
            {activeFilters.length > 0 && (
              <div className={styles.filterChips}>
                {activeFilters.map((f) => (
                  <span key={f.key} className={styles.filterChip}>
                    {f.label}
                    <button type="button" className={styles.filterChipRemove}
                      onClick={f.clear} aria-label={`Remove ${f.label} filter`}>×</button>
                  </span>
                ))}
                <button type="button" className={styles.filterChipClearAll}
                  onClick={clearAllFilters}><Translate id="page.board.clearAll" description="clear filters">Clear all</Translate></button>
              </div>
            )}
            <div className={styles.resultActions}>
              <span className={styles.resultCount}>
                <Translate id="page.board.results" description="result count; {shown} is like '25' or '25 of 100'" values={{shown: `${entries.length}${totalCount > entries.length ? ` of ${totalCount.toLocaleString()}` : ""}`}}>{'{shown} results'}</Translate>
              </span>
              <ColumnChooser
                visible={visibleCols}
                onChange={updateVisibleCols}
                allColumns={COLUMNS}
              />
              <button type="button" className={styles.exportBtn}
                onClick={() => exportCSV(sortedEntries, visibleCols, languageMap)}
                title={translate({id: 'page.board.exportTitle', message: 'Export filtered results as CSV', description: 'export tooltip'})}>
                <Translate id="page.board.export" description="export button">Export CSV</Translate>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile filter panel */}
        {mobileFiltersOpen && (
          <>
            <div className={styles.mobileFilterOverlay}
              onClick={() => setMobileFiltersOpen(false)} />
            <div className={`${styles.mobileFilterPanel} ${styles.mobileFilterPanelOpen}`}>
              <div className={styles.mobileFilterHeader}>
                <span><Translate id="page.board.filtersPanel" description="mobile panel header">Filters</Translate></span>
                <button type="button" onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters">×</button>
              </div>
              {renderFilterControls()}
              <button type="button" className={styles.mobileFilterApply}
                onClick={() => setMobileFiltersOpen(false)}><Translate id="page.board.apply" description="apply button">Apply</Translate></button>
            </div>
          </>
        )}

        {/* Per-pair "human method" affordance — the honest floor for pairs
            with no reliable MT (docs/HUMAN_SERVICES_HUB.md). Shown beside the
            per-pair confidence display whenever a specific pair is selected;
            renders its own empty state when no human services cover the pair. */}
        {srcFilter !== "any" && tgtFilter !== "any" && (
          <HumanServicesForPair
            src={srcFilter}
            tgt={tgtFilter}
            pairLabel={formatPair(`${srcFilter}>${tgtFilter}`, languageMap)}
          />
        )}

        {/* Loading / Error States */}
        {loading && (
          <div className={styles.loadingState}>
            <p><Translate id="page.board.loading" description="loading state">Loading leaderboard data...</Translate></p>
          </div>
        )}
        {fetchError && (
          <div className={styles.errorState}>
            <p>⚠️ Could not load leaderboard: {fetchError}</p>
          </div>
        )}

        {/* Results Table — suppressed during a fetch error so the empty-state
            "be the first to submit" message can't contradict the error banner
            (a Supabase outage must not masquerade as a genuinely empty board). */}
        {!loading && !fetchError && (
          <>
            {sortedEntries.length === 0 ? (
              <div className={styles.emptyState} id="leaderboard-empty">
                <div className={styles.emptyIcon}>📭</div>
                <p>
                  No completed runs yet for{" "}
                  {srcFilter === "any" ? "any source" : srcFilter}
                  {" → "}
                  {tgtFilter === "any" ? "any target" : tgtFilter}.
                </p>
                {queuedRunCount > 0 ? (
                  <p className={styles.queuedNote}>
                    {queuedRunCount} run{queuedRunCount === 1 ? " is" : "s are"}{" "}
                    waiting in the open queue for this selection
                    {queuedMinCost != null && (
                      <> (from ${queuedMinCost.toFixed(3)} est.)</>
                    )}
                    . <Link to="/contribute">Run one →</Link>
                  </p>
                ) : (
                  <p>Be the first to submit a benchmark result!</p>
                )}
              </div>
            ) : (
              <>
                {/* Desktop table view */}
                <div className={styles.tableContainer} ref={tableRef}>
                  <table className={styles.table} id="leaderboard-table">
                    <thead className={styles.stickyHeader}>
                      <tr>
                        {displayColumns.map((col) => (
                          <th
                            key={col.key}
                            className={col.sortable ? sortClass(col.key) : ""}
                            onClick={col.sortable ? () => handleSort(col.key) : undefined}
                            id={`col-${col.key}`}
                          >
                            {col.sortable ? (
                              <button type="button" className={styles.sortButton}>
                                {col.label}
                                {col.tooltip && <InfoTip text={TOOLTIPS[col.tooltip]} />}
                              </button>
                            ) : (
                              <>
                                {col.label}
                                {col.tooltip && <InfoTip text={TOOLTIPS[col.tooltip]} />}
                              </>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((entry, index) => {
                        const isExpanded = expandedId === entry.id;
                        const isHighlighted = highlightId === entry.id;
                        return (
                          <React.Fragment key={entry.id || `${entry.method}-${entry.model}-${index}`}>
                            <tr
                              className={`${styles.tableRow} ${isHighlighted ? styles.highlightedRow : ""}`}
                              style={{ "--row-i": Math.min(index, 14) }}
                              onClick={() => handleRowClick(entry)}
                              onKeyDown={(e) => handleRowKeyDown(e, entry)}
                              tabIndex={0}
                              role="row"
                              id={`row-${entry.id || index}`}
                              aria-expanded={isExpanded}
                            >
                              {displayColumns.map((col) => renderCell(col, entry))}
                            </tr>
                            <tr className={styles.expandedRow}>
                              <td colSpan={displayColumns.length + 1}>
                                <div className={`${styles.expandedContent} ${isExpanded ? styles.expandedContentOpen : ""}`}>
                                  {isExpanded && (
                                    <RowDetail entry={entry} datasets={datasets} languageMap={languageMap} />
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card view */}
                <div className={styles.cardView}>
                  {sortedEntries.map((entry, index) => {
                    const isExpanded = expandedId === entry.id;
                    const rank = rankMap.get(entry);
                    const composite = entry.metrics.composite;
                    return (
                      <div
                        key={entry.id || `card-${index}`}
                        className={`${styles.card} ${isExpanded ? styles.cardExpanded : ""}`}
                        onClick={() => handleRowClick(entry)}
                        onKeyDown={(e) => handleRowKeyDown(e, entry)}
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                      >
                        <div className={styles.cardHeader}>
                          {rank && <span className={styles.cardRank}>#{rank}</span>}
                          <span className={styles.cardModel}>{entry.model}</span>
                        </div>
                        <div className={styles.cardPair}>
                          <span>{entry.method}</span>
                          <span className={styles.cardPairSep}>·</span>
                          <span>{formatPair(entry.pair, languageMap)}</span>
                        </div>
                        <div className={styles.cardMetrics}>
                          {composite != null && (
                            <div className={styles.cardMetric}>
                              <span className={styles.cardMetricLabel}>Composite</span>
                              <div className={styles.cardMetricBarWrap}>
                                <div className={styles.cardMetricBar} style={{ width: `${composite * 100}%` }} />
                              </div>
                              <span className={styles.cardMetricValue}>{composite.toFixed(2)}</span>
                            </div>
                          )}
                          {entry.metrics.comet != null && (
                            <div className={styles.cardMetric}>
                              <span className={styles.cardMetricLabel}>COMET-22</span>
                              <span className={styles.cardMetricValue}>{entry.metrics.comet.toFixed(2)}</span>
                            </div>
                          )}
                          {entry.metrics.chrF != null && (
                            <div className={styles.cardMetric}>
                              <span className={styles.cardMetricLabel}>chrF++</span>
                              <span className={styles.cardMetricValue}>{entry.metrics.chrF.toFixed(1)}</span>
                            </div>
                          )}
                          {entry.metrics.exactMatch != null && (
                            <div className={styles.cardMetric}>
                              <span className={styles.cardMetricLabel}>EM</span>
                              <span className={styles.cardMetricValue}>{formatMetric(entry.metrics.exactMatch, "%")}</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.cardFooter}>
                          <TierBadge tier={entry.qualityTier} />
                          {entry.cost_usd != null && (
                            <span className={styles.cardCost}>{formatCost(entry.cost_usd)}</span>
                          )}
                          <span className={styles.cardAuthor}>{entry.author}</span>
                          <span className={styles.cardDate}>{formatDate(entry.date)}</span>
                        </div>
                        {isExpanded && (
                          <div className={styles.cardDetail}>
                            <RowDetail entry={entry} datasets={datasets} languageMap={languageMap} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Load More pagination */}
        {!loading && hasMore && (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loadingMore}
              id="load-more"
            >
              {loadingMore ? translate({id: 'page.board.loadingMore', message: 'Loading…', description: 'loading state'}) : translate({id: 'page.board.loadMore', message: 'Load more ({a} of {b})', description: 'pagination; {a} shown, {b} total'}, {a: entries.length, b: totalCount.toLocaleString()})}
            </button>
          </div>
        )}

        {/* Trust Legend */}
        <div className={styles.trustLegend} id="trust-legend">
          <span className={styles.legendTitle}>Trust Levels</span>
          <div className={styles.legendItem}>
            <TrustBadge trust="self-benchmarked" />
            <span className={styles.legendStatus}>Active</span>
          </div>
          <div className={styles.legendItem}>
            <TrustBadge trust="champollion-verified" />
            <span className={styles.legendStatus}>Coming soon</span>
          </div>
          <div className={styles.legendItem}>
            <TrustBadge trust="community-validated" />
            <span className={styles.legendStatus}>Coming soon</span>
          </div>
        </div>

        {/* Corpus Size Legend */}
        <div className={styles.trustLegend} id="corpus-size-legend">
          <span className={styles.legendTitle}>Corpus Size (n)</span>
          <div className={styles.legendItem}>
            <span className={`${styles.corpusBadge} ${styles.corpusBadgeCaution}`}>
              n&lt;{SIGNIFICANCE_FLOOR}
            </span>
            <span className={styles.legendStatus}>
              below the significance floor — score gaps within ~5 chrF++ are noise
            </span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.corpusBadge} ${styles.corpusBadgeCritical}`}>
              n&lt;{DEV_SET_FLOOR}
            </span>
            <span className={styles.legendStatus}>
              below the development-set floor — orderings indicative only
            </span>
          </div>
          <span className={styles.legendNote}>
            Small corpora always stay on the board. Expand a flagged row for a
            per-pair &ldquo;help build this corpus&rdquo; link — our dev corpora
            rebuild from{" "}
            <a href="https://tatoeba.org" target="_blank" rel="noopener noreferrer">
              Tatoeba
            </a>{" "}
            releases, so sentences added upstream flow into the next build.
          </span>
        </div>

        {/* LLM Non-Determinism Disclaimer */}
        <p className={styles.disclaimer} id="llm-disclaimer">
          ⚠️ LLM outputs are non-deterministic. Scores represent point-in-time
          measurements under specific model versions and API configurations.
          Model providers may update weights, decoding strategies, or safety
          filters at any time, which can cause score drift between runs.
        </p>

        {/* How It Works */}
        <section className={styles.howItWorks} id="how-it-works">
          <Heading as="h2" className={styles.howItWorksTitle}>
            <Translate id="page.board.how" description="section heading">How It Works</Translate>
          </Heading>
          <ol className={styles.howItWorksList}>
            <li className={styles.howItWorksItem}>
              <span className={styles.howItWorksIcon}>1</span>
              <span className={styles.howItWorksText}>
                <Translate id="page.board.how1" description="how-it-works item; {b} bold lead" values={{b: <strong><Translate id="page.board.how1Lead" description="bold lead">Fingerprinted Pipelines</Translate></strong>}}>{'{b} — Each submission is tied to a specific Git commit and pipeline configuration, ensuring results can be traced back to the exact code that produced them.'}</Translate>
              </span>
            </li>
            <li className={styles.howItWorksItem}>
              <span className={styles.howItWorksIcon}>2</span>
              <span className={styles.howItWorksText}>
                <Translate id="page.board.how2" description="how-it-works item; {b} bold lead" values={{b: <strong><Translate id="page.board.how2Lead" description="bold lead">Versioned Datasets</Translate></strong>}}>{'{b} — Evaluation datasets are content-hashed and versioned. Scores are only comparable within the same dataset version, preventing silent data contamination.'}</Translate>
              </span>
            </li>
            <li className={styles.howItWorksItem}>
              <span className={styles.howItWorksIcon}>3</span>
              <span className={styles.howItWorksText}>
                <Translate id="page.board.how3" description="how-it-works item; {b} bold lead" values={{b: <strong><Translate id="page.board.how3Lead" description="bold lead">Standardised Harness</Translate></strong>}}>{'{b} — All metrics are computed by the shared champollion evaluation harness, eliminating implementation differences between submissions.'}</Translate>
              </span>
            </li>
            <li className={styles.howItWorksItem}>
              <span className={styles.howItWorksIcon}>4</span>
              <span className={styles.howItWorksText}>
                <Translate id="page.board.how4" description="how-it-works item; {b} bold lead" values={{b: <strong><Translate id="page.board.how4Lead" description="bold lead">Open Submission</Translate></strong>}}>{'{b} — Anyone can submit results by opening a pull request with their method\'s JSON entry and pipeline fingerprint. Verified and Community trust tiers will be available soon.'}</Translate>
              </span>
            </li>
          </ol>
        </section>
      </main>
    </Layout>
  );
}
