#!/usr/bin/env node

/**
 * enrich-grammars-from-glottolog.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates `resources.grammars[]` (forge/DESIGN.md §7 card-schema
 * addition #2): the MED-best few reference grammars per language,
 * as bibliographic CITATION METADATA only.
 *
 * The cards' documentationDepth.med (already Glottolog-derived) says
 * a grammar EXISTS without naming it. Glottolog's own citation
 * records name it:
 *
 *   data/glottolog/cldf-values.csv
 *     med rows         → the current Most Extensive Description:
 *                        Source column = Glottolog reference id
 *     medovertime rows → the historically-best descriptions:
 *                        Source column = 'refid[year];refid[year];…'
 *   data/glottolog/sources.bib
 *     BibTeX records keyed by those reference ids, carrying
 *     author / editor / year / title / hhtype
 *
 * Both files are fetched by download-glottolog-grammar-sources.mjs,
 * PINNED to glottolog-cldf v5.3 — the same Glottolog 5.3 release the
 * cards already cite. This script REFUSES to run without them
 * (fail-honest; it never deletes existing data on missing inputs).
 *
 * SELECTION (faithful reporting, no adjudication):
 *   candidate refids = current MED first, then the medovertime
 *   sequence (most recent first, deduplicated); keep only records
 *   whose Glottolog hhtype is grammar-typed ('grammar' or
 *   'grammar_sketch' segment — a wordlist/phonology MED is NOT a
 *   grammar and must never be labeled one); cap at 3 (the MED-best
 *   few, not the whole bibliography). Languages whose records are
 *   never grammar-typed get NO field — absence means unknown/none,
 *   never a default.
 *
 * MATCHING: card.glottocode primary; ISO 639-3 fallback via the
 * Glottocode↔ISO map in data/glottolog/cldf-languages.csv (same
 * strategy as enrich-documentation-med.mjs).
 *
 * SHAPE HANDLING (same policy as derive-dictionaries.mjs):
 *   resources object → merge the `grammars` key
 *   resources null   → create `resources = { grammars: [...] }`
 *   resources array  → SKIPPED + counted (legacy flat-array shape;
 *     the object migration belongs to derive-resources-from-coverage
 *     .mjs per the schema TODO — never silently, see the report).
 *
 * PROVENANCE: the entries are Glottolog's OWN citation records
 * reported verbatim (a selection, not a computation), so
 *   _fieldSources['resources.grammars'] = 'glottolog-5.3'
 * and 'glottolog-5.3' is appended to dataSources — mirroring the
 * documentationDepth stamp for the same upstream. Each entry carries
 * the stable Glottolog reference URL for line-level citability.
 *
 * IDEMPOTENCY / OWNERSHIP: regenerated wholesale from the pinned
 * dump on every run; cards that stop matching lose the field.
 * No corpus content, no scores — bibliography metadata only.
 *
 * Usage:
 *   node scripts/download-glottolog-grammar-sources.mjs   # once
 *   node scripts/enrich-grammars-from-glottolog.mjs             # all cards
 *   node scripts/enrich-grammars-from-glottolog.mjs --dry-run   # preview
 *   node scripts/enrich-grammars-from-glottolog.mjs --lang crk  # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseCSV } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data', 'glottolog');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

const VALUES_CSV = path.join(DATA_DIR, 'cldf-values.csv');
const SOURCES_BIB = path.join(DATA_DIR, 'sources.bib');
const LANGUAGES_CSV = path.join(DATA_DIR, 'cldf-languages.csv');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const SOURCE_ID = 'glottolog-5.3';
const MAX_GRAMMARS = 3;
const GRAMMAR_HHTYPES = new Set(['grammar', 'grammar_sketch']);

// ═══════════════════════════════════════════════════════════════
//  CSV parsing — lib/csv.mjs (RFC-4180 char-stream, fail-loud).
//  medovertime Value/Source cells are quoted lists that may embed
//  commas and newlines; line-based parsing is forbidden here.
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a whole CSV file into { header, records } (arrays), enforcing
 * rectangularity in a single parse pass (parseCSVObjects would parse
 * the 21 MB values.csv twice).
 */
function parseRectangular(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const file = path.basename(filePath);
  const records = parseCSV(content, { file });
  if (records.length === 0) {
    console.error(`  ❌ ${file} is empty`);
    process.exit(1);
  }
  const header = records[0];
  for (let r = 1; r < records.length; r++) {
    if (records[r].length !== header.length) {
      throw new Error(
        `${file}: record ${r + 1} has ${records[r].length} fields, expected ${header.length} — ` +
        `ragged records mean the file is corrupt or truncated`
      );
    }
  }
  return { header, records };
}

// ═══════════════════════════════════════════════════════════════
//  MED reference collection: glottocode → ordered candidate refids
// ═══════════════════════════════════════════════════════════════

/** 'refid[year];refid[year];…' or 'refid' → ['refid', …] */
function parseSourceRefs(sourceField) {
  if (!sourceField) return [];
  return sourceField
    .split(';')
    .map(s => s.trim().replace(/\[[^\]]*\]$/, ''))
    .filter(Boolean);
}

function loadMedRefs() {
  const { header, records } = parseRectangular(VALUES_CSV);
  const langIdx = header.indexOf('Language_ID');
  const paramIdx = header.indexOf('Parameter_ID');
  const sourceIdx = header.indexOf('Source');
  for (const col of ['Language_ID', 'Parameter_ID', 'Source']) {
    if (header.indexOf(col) === -1) {
      console.error(`  ❌ Missing expected column '${col}' in cldf-values.csv`);
      process.exit(1);
    }
  }

  const medRef = new Map();       // glottocode → refid (current MED)
  const overTimeRefs = new Map(); // glottocode → [refid, …] (recent first)

  for (let r = 1; r < records.length; r++) {
    const fields = records[r];
    const param = fields[paramIdx];
    if (param !== 'med' && param !== 'medovertime') continue;
    const glottocode = fields[langIdx].trim();
    if (!glottocode) continue;
    const refs = parseSourceRefs(fields[sourceIdx]);
    if (refs.length === 0) continue;
    if (param === 'med') medRef.set(glottocode, refs[0]);
    else overTimeRefs.set(glottocode, refs);
  }

  // Ordered, deduplicated candidates per glottocode
  const candidates = new Map();
  const allCodes = new Set([...medRef.keys(), ...overTimeRefs.keys()]);
  for (const code of allCodes) {
    const seen = new Set();
    const list = [];
    const cur = medRef.get(code);
    if (cur && !seen.has(cur)) { seen.add(cur); list.push(cur); }
    for (const r of overTimeRefs.get(code) || []) {
      if (!seen.has(r)) { seen.add(r); list.push(r); }
    }
    if (list.length) candidates.set(code, list);
  }
  console.log(`  MED citation sets loaded:  ${candidates.size.toLocaleString()} glottocodes`);
  return candidates;
}

function loadIsoToGlottocode() {
  const { header, records } = parseRectangular(LANGUAGES_CSV);
  const glottoIdx = header.indexOf('Glottocode');
  const isoIdx = header.indexOf('ISO639P3code');
  for (const col of ['Glottocode', 'ISO639P3code']) {
    if (header.indexOf(col) === -1) {
      console.error(`  ❌ Missing expected column '${col}' in cldf-languages.csv`);
      process.exit(1);
    }
  }
  const map = new Map();
  for (let r = 1; r < records.length; r++) {
    const iso = records[r][isoIdx].trim();
    const glotto = records[r][glottoIdx].trim();
    if (iso && glotto) map.set(iso, glotto);
  }
  console.log(`  ISO→Glottocode fallback map: ${map.size.toLocaleString()} codes`);
  return map;
}

// ═══════════════════════════════════════════════════════════════
//  BibTeX resolution (streaming — sources.bib is ~176 MB)
// ═══════════════════════════════════════════════════════════════

/** Extract one brace-delimited field value from a BibTeX entry body. */
function extractBibField(text, name) {
  const re = new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*\\{`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  let depth = 1;
  let out = '';
  for (let i = m.index + m[0].length; i < text.length && depth > 0; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    if (depth > 0) out += ch;
  }
  return out || null;
}

/** Strip protective braces and collapse whitespace in a BibTeX value. */
function cleanBibValue(v) {
  return v == null ? null : v.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() || null;
}

/** First grammar-typed segment of an hhtype value, or null. */
function grammarType(hhtype) {
  if (!hhtype) return null;
  for (const raw of hhtype.split(/[;,]/)) {
    const seg = raw.split('(')[0].trim().toLowerCase();
    if (GRAMMAR_HHTYPES.has(seg)) return seg;
  }
  return null;
}

/** Stream sources.bib, keeping only the entries whose key is needed. */
async function loadBibEntries(neededRefids) {
  const entries = new Map(); // refid → { author, year, title, type }
  const rl = readline.createInterface({
    input: fs.createReadStream(SOURCES_BIB, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let currentKey = null;
  let buf = [];
  for await (const line of rl) {
    if (currentKey === null) {
      const m = line.match(/^@\w+\{([^,]+),\s*$/);
      if (m && neededRefids.has(m[1].trim())) {
        currentKey = m[1].trim();
        buf = [];
      }
      continue;
    }
    if (line === '}') {
      const text = buf.join('\n');
      const hhtype = cleanBibValue(extractBibField(text, 'hhtype'));
      const type = grammarType(hhtype);
      if (type) {
        const author = cleanBibValue(extractBibField(text, 'author'));
        const editor = cleanBibValue(extractBibField(text, 'editor'));
        const yearRaw = cleanBibValue(extractBibField(text, 'year'));
        const title = cleanBibValue(extractBibField(text, 'title'));
        if (title) {
          entries.set(currentKey, {
            author: author || (editor ? `${editor} (ed.)` : null),
            year: yearRaw && /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : yearRaw,
            title,
            type,
          });
        }
      }
      currentKey = null;
      buf = [];
      continue;
    }
    buf.push(line);
  }
  console.log(`  Grammar-typed bib records: ${entries.size.toLocaleString()} (of ${neededRefids.size.toLocaleString()} MED refs)`);
  return entries;
}

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Reference Grammars Enrichment → resources.grammars[]');
  console.log(`  Source: Glottolog 5.3 MED citation records (pinned dump)`);
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  // cldf-languages.csv is required too: without the ISO→Glottocode
  // fallback map, cards matched only via ISO would be seen as
  // non-matching and their grammars wrongly REMOVED as stale.
  for (const [p, hint] of [[VALUES_CSV, 'cldf-values.csv'], [SOURCES_BIB, 'sources.bib'], [LANGUAGES_CSV, 'cldf-languages.csv']]) {
    if (!fs.existsSync(p)) {
      console.error(`  ❌ Missing data/glottolog/${hint}`);
      console.error('     Run: node scripts/download-glottolog-grammar-sources.mjs first.');
      console.error('     (cldf-languages.csv is git-tracked; restore it via git or download-glottolog-med.mjs.)');
      console.error('     (Refusing to run — this script never touches cards without its pinned inputs.)');
      process.exit(1);
    }
  }

  console.log('Loading data sources...');
  const candidatesByGlottocode = loadMedRefs();
  const isoToGlottocode = loadIsoToGlottocode();

  const neededRefids = new Set();
  for (const refs of candidatesByGlottocode.values()) {
    for (const r of refs) neededRefids.add(r);
  }
  const bibEntries = await loadBibEntries(neededRefids);

  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');
  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`\nERROR: Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  let processed = 0;
  let modified = 0;
  let withField = 0;
  let entryCount = 0;
  let matchedByIso = 0;
  let noGrammarTyped = 0;      // MED refs exist but none is grammar-typed
  let skippedLegacyArray = 0;
  let removedStale = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }
    processed++;

    // ── Resolve the card's glottocode (ISO fallback) ──
    let glottocode = card.glottocode;
    let viaIso = false;
    if (!glottocode || !candidatesByGlottocode.has(glottocode)) {
      const iso = card.iso639_3 || card.code;
      const mapped = iso ? isoToGlottocode.get(iso) : null;
      if (mapped && candidatesByGlottocode.has(mapped)) {
        glottocode = mapped;
        viaIso = true;
      }
    }

    const refs = glottocode ? candidatesByGlottocode.get(glottocode) : null;
    const grammars = [];
    if (refs) {
      for (const refid of refs) {
        const bib = bibEntries.get(refid);
        if (!bib) continue;
        const entry = {};
        if (bib.author) entry.author = bib.author;
        if (bib.year !== null && bib.year !== undefined) entry.year = bib.year;
        entry.title = bib.title;
        entry.url = `https://glottolog.org/resource/reference/id/${refid}`;
        entry.type = bib.type;
        grammars.push(entry);
        if (grammars.length >= MAX_GRAMMARS) break;
      }
      if (grammars.length === 0) noGrammarTyped++;
    }

    const before = JSON.stringify(card);

    if (grammars.length > 0) {
      if (Array.isArray(card.resources)) {
        skippedLegacyArray++;
        continue;
      }
      if (!card.resources || typeof card.resources !== 'object') card.resources = {};
      card.resources.grammars = grammars;

      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources['resources.grammars'] = SOURCE_ID;
      const sources = Array.isArray(card.dataSources) ? card.dataSources : [];
      if (!sources.includes(SOURCE_ID)) sources.push(SOURCE_ID);
      card.dataSources = sources;

      withField++;
      entryCount += grammars.length;
      if (viaIso) matchedByIso++;
    } else if (
      card.resources && typeof card.resources === 'object' && !Array.isArray(card.resources) &&
      'grammars' in card.resources
    ) {
      // Ownership: no longer derivable from the pinned dump → remove.
      delete card.resources.grammars;
      if (card._fieldSources && card._fieldSources['resources.grammars']) {
        delete card._fieldSources['resources.grammars'];
      }
      removedStale++;
    }

    if (JSON.stringify(card) !== before) {
      modified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:              ${processed.toLocaleString()}`);
  console.log(`  Cards with resources.grammars: ${withField.toLocaleString()} (${entryCount.toLocaleString()} citations)`);
  console.log(`  Cards modified this run:      ${modified.toLocaleString()}`);
  console.log(`    ↳ matched via ISO fallback: ${matchedByIso.toLocaleString()}`);
  console.log(`  MED refs but none grammar-typed (no field — honest absence): ${noGrammarTyped.toLocaleString()}`);
  console.log(`  Stale fields removed:         ${removedStale.toLocaleString()}`);
  console.log(`  SKIPPED (legacy array resources): ${skippedLegacyArray.toLocaleString()} — pending the derive-resources-from-coverage.mjs object migration (schema TODO)`);
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
