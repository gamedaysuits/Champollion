#!/usr/bin/env node
/**
 * derive-method-coverage-small-models.mjs — extend the MT coverage
 * catalogue (shared/catalogue/method-coverage.json) with the small open
 * translation models, and enrich every entry with the display metadata the
 * hero map's service cards need (homepage / license / nature).
 *
 * Adds/updates two entries derived from pinned model-card snapshots
 * (shared/catalogue/sources/):
 *   · m2m100   — facebook/m2m100_418M (100 languages, MIT, any-to-any)
 *   · madlad   — google/madlad400-3b-mt (400+ languages, Apache-2.0)
 *
 * Code mapping: the cards publish ISO 639-1 / BCP-47-style tags; the
 * catalogue speaks ISO 639-3. Mapping goes through the pinned LinguaMeta
 * snapshot (cli/data/linguameta/linguameta.tsv: bcp_47_code →
 * iso_639_3_code), script/region suffixes collapsed to the base tag. The
 * enumerations are therefore champollion-derived FROM the cited cards —
 * each entry says so in its note, names the unmapped remainder, and keeps
 * the card's own headline under publishedHeadline. Never run this without
 * the LinguaMeta snapshot present (override path: LINGUAMETA_TSV env).
 *
 * Idempotent: re-running rewrites the same two entries + metadata fields in
 * place. After editing shared/*, run `npm run sync:shared` (cli/).
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CATALOGUE = path.join(REPO, 'shared', 'catalogue', 'method-coverage.json');
const SOURCES = path.join(REPO, 'shared', 'catalogue', 'sources');
const LINGUAMETA =
  process.env.LINGUAMETA_TSV ||
  path.join(REPO, 'cli', 'data', 'linguameta', 'linguameta.tsv');

if (!fs.existsSync(LINGUAMETA)) {
  console.error(
    `✗ LinguaMeta snapshot not found at ${LINGUAMETA} — refusing to derive ` +
      'coverage without the mapping table (set LINGUAMETA_TSV).',
  );
  process.exit(1);
}

// ---- bcp47 → iso639-3 map from the pinned LinguaMeta snapshot -------------
const rows = fs.readFileSync(LINGUAMETA, 'utf8').split('\n');
const header = rows[0].split('\t');
const iBcp = header.indexOf('bcp_47_code');
const iIso = header.indexOf('iso_639_3_code');
if (iBcp < 0 || iIso < 0) {
  console.error('✗ linguameta.tsv missing bcp_47_code / iso_639_3_code columns');
  process.exit(1);
}
const bcpToIso = new Map();
const isoSet = new Set();
for (let r = 1; r < rows.length; r += 1) {
  const cols = rows[r].split('\t');
  const bcp = (cols[iBcp] || '').trim();
  const iso = (cols[iIso] || '').trim();
  if (iso) isoSet.add(iso);
  if (bcp && iso) bcpToIso.set(bcp, iso);
}

// Curated exceptions LinguaMeta (living-language scope) cannot resolve:
// 'ns' is the M2M-100 card's nonstandard tag for Northern Sotho; the rest
// are real ISO 639-3 historical/constructed codes (Latin, Sanskrit, Ancient
// Greek, Old English, Klingon) that the cards catalogue does index.
// Deliberately NOT mapped: 'zxx' (no linguistic content), 'ber' (collective).
const TAG_EXCEPTIONS = {
  ns: 'nso',
  la: 'lat',
  sa: 'san',
  grc: 'grc',
  ang: 'ang',
  tlh: 'tlh',
};

/** Map one published tag to ISO 639-3, collapsing script/region suffixes. */
function toIso3(rawTag) {
  const tag = String(rawTag).trim();
  const base = tag.split(/[_-]/)[0].toLowerCase();
  if (TAG_EXCEPTIONS[base]) return TAG_EXCEPTIONS[base];
  if (bcpToIso.has(base)) return bcpToIso.get(base);
  if (/^[a-z]{3}$/.test(base) && isoSet.has(base)) return base;
  return null;
}

function deriveList(snapshotFile) {
  const snap = JSON.parse(fs.readFileSync(path.join(SOURCES, snapshotFile), 'utf8'));
  const mapped = new Set();
  const unmapped = [];
  for (const code of snap.codes) {
    const iso = toIso3(code);
    if (iso) mapped.add(iso);
    else unmapped.push(code);
  }
  return {snap, iso: [...mapped].sort(), unmapped};
}

// ---- derive the two entries ------------------------------------------------
const m2m = deriveList('m2m100-hf-card-2026-07-19.json');
const madlad = deriveList('madlad400-hf-card-2026-07-19.json');

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const byKey = new Map(catalogue.methods.map((m) => [m.key, m]));

function upsert(entry) {
  const existing = byKey.get(entry.key);
  if (existing) Object.assign(existing, entry);
  else {
    catalogue.methods.push(entry);
    byKey.set(entry.key, entry);
  }
}

function derivedNote(d, cardHeadline) {
  const un =
    d.unmapped.length > 0
      ? ` ${d.unmapped.length} published tag(s) had no LinguaMeta ISO 639-3 ` +
        `mapping and are not counted: ${d.unmapped.join(', ')}.`
      : '';
  return (
    `Champollion-derived enumeration from the model card's published tag ` +
    `list (${d.snap.codes.length} tags; script/region variants collapsed to ` +
    `the base language via the pinned LinguaMeta snapshot). The card's own ` +
    `headline is ${cardHeadline}.${un} Snapshot: shared/catalogue/sources/.`
  );
}

upsert({
  key: 'm2m100',
  label: 'M2M-100',
  count: m2m.iso.length,
  tier: 'open',
  anyToAny: true,
  codeSystem: 'ISO 639-3',
  iso6393: m2m.iso,
  source_url: m2m.snap.source_url,
  asOf: m2m.snap.fetched,
  confidence: 'high',
  verified: 'derived',
  publishedHeadline: 100,
  license: 'MIT (checkpoints, per the model card)',
  homepage: 'https://huggingface.co/facebook/m2m100_418M',
  nature:
    'Open research model (Meta) — direct many-to-many translation across ' +
    'its whole set, downloadable and self-hostable.',
  note: derivedNote(m2m, '"100 languages"'),
});

upsert({
  key: 'madlad',
  label: 'MADLAD-400',
  count: madlad.iso.length,
  tier: 'open',
  anyToAny: true,
  codeSystem: 'ISO 639-3',
  iso6393: madlad.iso,
  source_url: madlad.snap.source_url,
  asOf: madlad.snap.fetched,
  confidence: 'medium',
  verified: 'derived',
  publishedHeadline: 419,
  license: 'Apache-2.0 (per the model card)',
  homepage: 'https://huggingface.co/google/madlad400-3b-mt',
  nature:
    'Open research model (Google) — T5-based MT trained on 400+ languages; ' +
    'downloadable and self-hostable. Tail-language quality varies widely.',
  note: derivedNote(madlad, '"419 languages"'),
});

// ---- display metadata for the existing entries (service cards) -------------
// Curated catalogue facts: homepage + one-line nature; license only where the
// provider states one for the MODELS themselves (never invented).
const META = {
  google: {
    homepage: 'https://translate.google.com',
    nature: 'Commercial cloud API (Google Cloud Translation).',
  },
  microsoft: {
    homepage: 'https://azure.microsoft.com/products/ai-services/ai-translator',
    nature: 'Commercial cloud API (Azure AI Translator).',
  },
  deepl: {
    homepage: 'https://www.deepl.com',
    nature: 'Commercial cloud API.',
  },
  libre: {
    homepage: 'https://libretranslate.com',
    nature:
      'Open-source, self-hostable translation API (AGPL-3.0 server, ' +
      'Argos Translate models).',
  },
  nllb: {
    homepage: 'https://ai.meta.com/research/no-language-left-behind/',
    license: 'CC-BY-NC-4.0 (checkpoints) — non-commercial',
    nature:
      'Open research model (Meta) — any-to-any across 200 languages; ' +
      'downloadable, non-commercial license.',
  },
  opus: {
    homepage: 'https://github.com/Helsinki-NLP/Opus-MT',
    license: 'CC-BY-4.0 (models, per the Helsinki-NLP releases)',
    nature:
      'Open per-pair research models (Helsinki-NLP, University of ' +
      'Helsinki) — hundreds of small downloadable models; a model for a ' +
      'given pair may not exist.',
  },
  tilde: {
    homepage: 'https://tilde.ai',
    nature:
      'Open research models (Tilde, EU) — per-pair systems for European ' +
      'and Baltic languages.',
  },
  translated: {
    homepage: 'https://laratranslate.com',
    nature: 'Commercial cloud API (Translated, Lara).',
  },
};
for (const [key, meta] of Object.entries(META)) {
  const entry = byKey.get(key);
  if (entry) Object.assign(entry, meta);
}

fs.writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 1)}\n`);
console.log(
  `✓ method-coverage.json: m2m100 ${m2m.iso.length} langs ` +
    `(${m2m.unmapped.length} unmapped: ${m2m.unmapped.join(',') || '—'}), ` +
    `madlad ${madlad.iso.length} langs (${madlad.unmapped.length} unmapped` +
    `${madlad.unmapped.length ? `: ${madlad.unmapped.join(',')}` : ''}), ` +
    `display metadata on ${Object.keys(META).length} existing entries.`,
);
