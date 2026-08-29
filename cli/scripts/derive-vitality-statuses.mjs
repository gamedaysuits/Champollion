#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'derive-vitality-statuses.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: endangerment is projected from the atlas by node cli/scripts/cldf/build-atlas.mjs; the vitality tier is derived at read time via shared/catalogue/vitality-scales.json (normalizeCard)\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * derive-vitality-statuses.mjs
 * ────────────────────────────────────────────────────────────────
 * INDEX, NOT ARBITER: every language card gains `vitalityStatuses[]` —
 * the FULL per-source endangerment spread, each entry verbatim from and
 * cited to its own source (the speakerEstimates[] pattern). No winner is
 * picked, no consensus manufactured; when sources disagree (they do —
 * e.g. crk: LinguaMeta "Severely endangered" vs Wikidata/ELCat
 * "vulnerable" vs Glottolog AES "moribund") the card shows all of them.
 *
 * Sources folded (each entry: {source, scale, status, raw?, level?}):
 *   - linguameta.tsv  endangerment_status  (UNESCO-aligned, verbatim)
 *   - champollion.db  facts:
 *       "Agglomerated Endangerment Status" (glottolog-cldf, AES 1–6 →
 *         Glottolog's own code labels via the shared map below)
 *       "endangermentStatusWikidata"       (wikidata, verbatim in `raw`)
 *       "Language Endangerment Index"      (elcat LEI, verbatim)
 *
 * MIGRATION also fixes an old cross-scale conversion: cards whose
 * vitality was filled from Glottolog AES (source glottolog-cldf-*) had
 * the AES value CONVERTED into a UNESCO-named field (unescoStatus:
 * moribund→"severely-endangered") — a champollion derivation wearing an
 * upstream's name. Those cards get `aesStatus` (Glottolog's own label)
 * and lose the converted `unescoStatus`. Cards whose unescoStatus came
 * verbatim from LinguaMeta's UNESCO-aligned field keep it (faithful).
 *
 * Usage: node scripts/derive-vitality-statuses.mjs [--dry-run]
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const DB_PATH = path.join(CLI_ROOT, 'data', 'champollion.db');
const LINGUAMETA_TSV = path.join(CLI_ROOT, 'data', 'linguameta', 'linguameta.tsv');
const DRY_RUN = process.argv.includes('--dry-run');

// Glottolog's OWN labels for its AES codes (levels 1–6) — never a
// conversion onto someone else's scale.
const AES_LABELS = {
  1: 'not endangered',
  2: 'threatened',
  3: 'shifting',
  4: 'moribund',
  5: 'nearly extinct',
  6: 'extinct',
};

// ── LinguaMeta: iso → verbatim endangerment_status ──────────────
const lm = new Map();
if (fs.existsSync(LINGUAMETA_TSV)) {
  const lines = fs.readFileSync(LINGUAMETA_TSV, 'utf-8').split('\n');
  const headers = lines[0].split('\t');
  const isoIdx = headers.indexOf('iso_639_3_code');
  const stIdx = headers.indexOf('endangerment_status');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const iso = (cols[isoIdx] || '').trim();
    const st = (cols[stIdx] || '').trim();
    if (iso && st) lm.set(iso, st);
  }
}

// ── DB facts: language_code → {aes, wikidata, elcat} ─────────────
const db = new Database(DB_PATH, {readonly: true});
const rows = db
  .prepare(
    `SELECT language_code, property, value, source FROM facts
     WHERE property IN ('Agglomerated Endangerment Status',
                        'endangermentStatusWikidata',
                        'Language Endangerment Index',
                        'Speaker Number Trends')`,
  )
  .all();
db.close();
const byLang = new Map();
for (const r of rows) {
  if (!byLang.has(r.language_code)) byLang.set(r.language_code, {});
  byLang.get(r.language_code)[r.property] = r;
}

// ── Evidence-only trend (twin of derive-speaker-vitality-bridge.mjs
// deriveTrend, post-2026-07-14: NO severity inference — a status is a
// level, not a direction). Used here to RE-derive trends that the old
// severity fallback wrote: evidence keeps/updates them, no evidence
// deletes them.
function evidenceTrend(card, dbTrendText) {
  const combined = (
    (card.vitality?.elcatSpeakerTrends || '') +
    ' ' +
    (card.vitality?.elcatTransmission || '') +
    ' ' +
    (dbTrendText || '')
  ).toLowerCase();
  if (!combined.trim()) return null;
  if (
    combined.includes('increasing') || combined.includes('growing') ||
    combined.includes('revitalization') || combined.includes('resurgence')
  ) return 'growing';
  if (
    combined.includes('decreasing') || combined.includes('declining') ||
    combined.includes('diminishing') || combined.includes('shrinking') ||
    combined.includes('fewer') || combined.includes('no longer') ||
    combined.includes('only a few') || combined.includes('no children') ||
    combined.includes('all elderly') || combined.includes('no speakers')
  ) return 'declining';
  if (
    combined.includes('stable') || combined.includes('maintained') ||
    combined.includes('nearly all') || combined.includes('majority')
  ) return 'stable';
  return null;
}

// ── Sweep the cards ───────────────────────────────────────────────
const files = fs
  .readdirSync(CARDS_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'language-tree.json');
let withSpread = 0;
let migratedAes = 0;
let disagreements = 0;
let trendFixed = 0;

for (const f of files) {
  const p = path.join(CARDS_DIR, f);
  let card;
  try {
    card = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    continue;
  }
  const iso = card.iso639_3 || card.code;
  if (!iso) continue;

  const entries = [];
  const lmStatus = lm.get(iso);
  if (lmStatus) {
    entries.push({source: 'linguameta', scale: 'unesco-aligned', status: lmStatus, date: '2024'});
  }
  const facts = byLang.get(iso) || {};
  const aes = facts['Agglomerated Endangerment Status'];
  if (aes) {
    const level = parseInt(aes.value, 10);
    if (AES_LABELS[level]) {
      entries.push({source: 'glottolog-aes', scale: 'aes', level, status: AES_LABELS[level]});
    }
  }
  const wd = facts['endangermentStatusWikidata'];
  if (wd && wd.value) {
    // Verbatim value like "2 vulnerable" — ordinal is Wikidata's own
    // UNESCO-scale index; expose the clean label, keep the raw string.
    const status = String(wd.value).replace(/^\d+\s*/, '').trim();
    if (status) entries.push({source: 'wikidata', scale: 'unesco-aligned', status, raw: String(wd.value)});
  }
  const el = facts['Language Endangerment Index'];
  if (el && el.value) {
    // Verbatim LEI headline (strip the parenthetical certainty into its own
    // field). The parenthetical may be EMPTY — ELCat emits "Dormant ()" /
    // "Awakening ()" when it records no certainty note, and those languages
    // (mostly dormant/awakening ones) must not lose their ELCat entry.
    const m = /^([^(]+?)\s*(?:\((.*)\))?\s*$/.exec(String(el.value).trim());
    if (m && m[1]) {
      const entry = {source: 'elcat', scale: 'lei', status: m[1].trim()};
      if (m[2] && m[2].trim()) entry.note = m[2].trim();
      entries.push(entry);
    }
  }

  let changed = false;
  if (entries.length) {
    const prev = JSON.stringify(card.vitalityStatuses || null);
    if (prev !== JSON.stringify(entries)) {
      card.vitalityStatuses = entries;
      changed = true;
    }
    withSpread++;
    const distinct = new Set(entries.map((e) => e.status.toLowerCase()));
    if (distinct.size > 1) disagreements++;
  }

  // Migration: undo the old AES→UNESCO-name cross-scale conversion.
  const v = card.vitality;
  if (v && v.unescoStatus && typeof v.source === 'string' && v.source.startsWith('glottolog')) {
    v.aesStatus = v.aesLabel ? String(v.aesLabel).toLowerCase() : v.unescoStatus;
    delete v.unescoStatus;
    migratedAes++;
    changed = true;
  }

  // Trend re-derivation (idempotent, symmetric): trend exists iff trend
  // EVIDENCE exists (card-local ELCat text OR the DB's verbatim ELCat
  // Speaker Number Trends fact) — never inferred from severity.
  if (v) {
    const t = evidenceTrend(card, facts['Speaker Number Trends']?.value);
    if ((t || undefined) !== v.trend) {
      if (t) v.trend = t;
      else delete v.trend;
      trendFixed++;
      changed = true;
    }
  }

  if (changed && !DRY_RUN) {
    fs.writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
  }
}

console.log(
  `vitalityStatuses: ${withSpread} cards carry a spread ` +
    `(${disagreements} with source disagreement — shown, never resolved); ` +
    `${migratedAes} cards migrated off the AES→unescoStatus conversion; ` +
    `${trendFixed} trends re-derived to evidence-only.` +
    (DRY_RUN ? ' [dry run — nothing written]' : ''),
);
