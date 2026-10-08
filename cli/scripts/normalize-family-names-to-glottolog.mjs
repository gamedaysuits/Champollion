#!/usr/bin/env node

/**
 * normalize-family-names-to-glottolog.mjs
 * ─────────────────────────────────────────────────────────────────
 * Cards cite classification to Glottolog, so classification.family
 * must be the name Glottolog actually gives the familyGlottocode.
 * A handful of hand-curated launch cards used traditional names
 * instead ("Niger-Congo" for atla1278, "Afroasiatic" for afro1255,
 * "Kra-Dai" for taik1256) — misattribution to the cited source.
 *
 * For each card with classification.familyGlottocode:
 *   - family is set to Glottolog's languoid name for that glottocode
 *   - ancestry is repaired: if ancestry[0] is the stale name and
 *     ancestry[1] already is the canonical name (a prepended
 *     non-Glottolog super-family node), drop ancestry[0]; otherwise
 *     rename ancestry[0] to the canonical name.
 *
 * Data: cli/data/glottolog/languoid.csv (same snapshot the
 * dialect-count enricher uses).
 *
 * Usage:
 *   node scripts/normalize-family-names-to-glottolog.mjs            # live
 *   node scripts/normalize-family-names-to-glottolog.mjs --dry-run  # preview
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Load Glottolog languoid names ──────────────────────────────
const languoidPath = path.join(ROOT, 'data/glottolog/languoid.csv');
if (!fs.existsSync(languoidPath)) {
  console.error('ERROR: Missing', languoidPath);
  process.exit(1);
}

// CSV fields can contain quoted commas — parse just id (col 0) and
// name via a quote-aware split.
function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = fs.readFileSync(languoidPath, 'utf8').split('\n');
const headerCols = parseCsvLine(lines[0]);
const ID_COL = headerCols.indexOf('id');
const NAME_COL = headerCols.indexOf('name');
const glottoName = new Map();
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const cols = parseCsvLine(lines[i]);
  if (cols[ID_COL]) glottoName.set(cols[ID_COL], cols[NAME_COL]);
}
console.log(`  Glottolog languoids loaded: ${glottoName.size.toLocaleString()}`);
if (DRY_RUN) console.log('  ⚠️  DRY RUN — no files will be modified\n');

// ── Sweep cards ────────────────────────────────────────────────
const cardsDir = path.join(ROOT, 'shared/language-cards');
const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));

let processed = 0, fixed = 0, unknownGlottocode = 0;

for (const file of files) {
  const filePath = path.join(cardsDir, file);
  let card;
  try {
    card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    continue;
  }
  if (!card || typeof card !== 'object' || !card.code) continue;
  processed++;

  const cl = card.classification;
  const fg = cl?.familyGlottocode;
  if (!fg || !cl.family) continue;

  const canonical = glottoName.get(fg);
  if (!canonical) { unknownGlottocode++; continue; }
  if (cl.family === canonical) continue;

  // Isolates: the family glottocode is the language's own top-level
  // languoid, and cards deliberately label the family "Language
  // isolate" rather than repeating the language name. Not a mismatch.
  if (cl.family === 'Language isolate') continue;

  const stale = cl.family;
  cl.family = canonical;

  if (Array.isArray(cl.ancestry) && cl.ancestry[0] === stale) {
    if (cl.ancestry[1] === canonical) {
      cl.ancestry.shift(); // prepended non-Glottolog super-family node
    } else {
      cl.ancestry[0] = canonical;
    }
  }

  console.log(`  ${file}: "${stale}" → "${canonical}" (${fg})`);
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
  }
  fixed++;
}

console.log(`
  RESULTS:
  ─────────────────────────────────────
  Cards processed:   ${processed.toLocaleString().padStart(6)}
  Families fixed:    ${fixed.toLocaleString().padStart(6)}
  Unknown glottocode:${unknownGlottocode.toLocaleString().padStart(6)}`);
