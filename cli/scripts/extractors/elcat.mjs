#!/usr/bin/env node

/**
 * extractor: elcat → facts. Endangerment and speaker numbers.
 *
 * WHY THIS ONE NEEDED THE MULTI-VALUE FACT KEY
 *   ELCat does not publish "the" speaker count. It publishes what each of its
 *   SOURCES said, and those sources disagree — a language can carry an SIL
 *   figure from 2000, a census figure from 2011 and a fieldworker's estimate
 *   from 2016, all in the catalogue at once, one flagged `preferred`.
 *
 *   Under the old fact key — UNIQUE(language, domain, property, source) — every
 *   one of those overwrote the last, so a source asserting three estimates kept
 *   whichever landed final. That is why `speakerEstimates[]`, which is the
 *   project's whole doctrine about disagreement ("when sources DISAGREE, the
 *   card shows ALL of them attributed"), could not round-trip through the store.
 *   Each estimate is now its own row, keyed by the source it came from.
 *
 * "SPEAKER NUMBER" IS OFTEN NOT A NUMBER
 *   ELCat's field carries buckets ("1-9"), words ("Awakening"), and prose as
 *   readily as it carries integers. Coercing those into a count would
 *   manufacture precision the catalogue never claimed — "1-9" becoming 1, or 9,
 *   or 5, all of which ELCat would disown. A numeric `speakerCount` is asserted
 *   ONLY when the value parses as a plain number; everything else is kept as
 *   the catalogue's own string under `speakerNumberRaw`, which is honest and
 *   still displayable.
 *
 * THE HEADLINE LEVEL IS SEPARATE FROM THE PER-SOURCE INDEX
 *   `languages.csv:endangerment` is ELCat's own summary judgement. The LEI rows
 *   are the per-source computations behind it, and they do not always agree
 *   with each other. Both are recorded, distinctly.
 *
 * Usage:
 *   node cli/scripts/extractors/elcat.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { codeIndex, openExtraction, readCldf } from './lib/extract-lib.mjs';

export const source = 'elcat';
export const dir = 'elcat';
const SELF = 'extractors/elcat.mjs';

const URL_FOR = (id) => `https://endangeredlanguages.com/lang/${id}`;

/** ELCat packs several fields into one JSON string per source. */
function parseBlob(value) {
  if (!value || !value.trim().startsWith('{')) return null;
  try { return JSON.parse(value); } catch { return null; }
}

/** A plain integer, or null. "1-9", "Awakening" and "~500" are all null. */
function plainInteger(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/,/g, '').trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const { languages, values } = readCldf(dir);
  const { map, unresolvable } = codeIndex(languages, x);

  // ── The catalogue's own headline level ────────────────────────────────
  for (const l of languages) {
    const code = map.get(l.ID);
    if (!code) continue;
    if (l.endangerment) {
      x.assert({
        code, domain: 'vitality', property: 'elcatEndangerment', value: l.endangerment,
        url: URL_FOR(l.ID), raw: l.endangerment,
        notes: 'ELCat\'s own summary level for the language',
      });
    } else {
      x.absent({
        code, domain: 'vitality', property: 'elcatEndangerment',
        notes: 'ELCat lists this language but records no endangerment level',
      });
    }
  }

  // ── Per-source rows ───────────────────────────────────────────────────
  let estimates = 0;
  let nonNumeric = 0;
  const seen = new Map();      // code -> running index, so variants stay unique

  for (const v of values) {
    const code = map.get(v.Language_ID);
    if (!code) continue;
    const preferred = v.preferred === 'yes';
    const url = URL_FOR(v.Language_ID);

    if (v.Parameter_ID === 'LEI' && v.Value) {
      const key = `LEI:${code}`;
      const i = (seen.get(key) ?? 0); seen.set(key, i + 1);
      x.assert({
        code, domain: 'vitality', property: 'endangermentIndex',
        value: v.Value.replace(/\s*\(\)\s*$/, '').trim(),
        variant: `${preferred ? 'p' : 's'}${String(i).padStart(2, '0')}`,
        url, raw: v.Value,
        notes: [preferred ? 'ELCat preferred source' : 'ELCat alternate source',
          v.Comment || null].filter(Boolean).join(' — ') || null,
      });
      continue;
    }

    if (v.Parameter_ID !== 'speakers') continue;
    const blob = parseBlob(v.Value);
    if (!blob) continue;

    const key = `sp:${code}`;
    const i = (seen.get(key) ?? 0); seen.set(key, i + 1);
    const variant = `${preferred ? 'p' : 's'}${String(i).padStart(2, '0')}`;
    const asOf = blob['Date Of Info'] ? String(blob['Date Of Info']).trim() : null;
    const note = [
      preferred ? 'ELCat preferred source' : 'ELCat alternate source',
      asOf ? `as of ${asOf}` : null,
      v.Comment ? v.Comment.trim() : null,
    ].filter(Boolean).join(' — ') || null;

    const raw = blob['Speaker Number'] ?? blob['Speaker Number Text'] ?? null;
    const n = plainInteger(raw);
    if (n !== null) {
      x.assert({
        code, domain: 'vitality', property: 'speakerCount', value: String(n),
        valueType: 'integer', variant, url, raw: String(raw), notes: note,
      });
      estimates++;
    } else if (raw !== null && String(raw).trim() !== '') {
      // A range or a word. Recorded as the catalogue wrote it — turning "1-9"
      // into a number would invent a precision ELCat never asserted.
      x.assert({
        code, domain: 'vitality', property: 'speakerNumberRaw', value: String(raw).trim(),
        variant, url, raw: String(raw), notes: note,
      });
      nonNumeric++;
    }

    const ethnic = plainInteger(blob['Ethnic Population']);
    if (ethnic !== null) {
      x.assert({
        code, domain: 'vitality', property: 'ethnicPopulation', value: String(ethnic),
        valueType: 'integer', variant, url,
        raw: String(blob['Ethnic Population']), notes: note,
      });
    }
  }

  x._stats = { estimates, nonNumeric, unresolvable, languages: languages.length };
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ elcat → ${r.written.toLocaleString()} facts from `
      + `${s.languages.toLocaleString()} catalogued languages`);
    console.log(`    ${s.estimates.toLocaleString()} numeric speaker estimates, each keyed to `
      + 'the source that made it');
    console.log(`    ${s.nonNumeric.toLocaleString()} non-numeric speaker values kept verbatim `
      + '("1-9", "Awakening") rather than coerced');
    if (s.unresolvable) {
      console.log(`    ⚠ ${s.unresolvable} ELCat row(s) carry neither an ISO code nor a `
        + 'glottocode and cannot be tied to a language');
    }
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} code(s) `
        + `outside the spine were NOT written: ${off.sample.slice(0, 6).join(', ')}…`);
    }
    console.log('');
  }
  x.close();
}
