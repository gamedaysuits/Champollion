#!/usr/bin/env node

/**
 * extractor: wals → facts. Typological features.
 *
 * WHAT WALS IS
 *   192 chapters of typological features coded per language — word order,
 *   case, negation, numeral systems and the rest — each chapter written and
 *   attributed to a named author. Coverage is deliberately sparse and sampled:
 *   WALS never intended every feature for every language, so a missing value is
 *   the norm rather than a gap to explain.
 *
 * WHY IT SITS BESIDE GRAMBANK RATHER THAN MERGING WITH IT
 *   The two overlap and sometimes disagree, because they were coded from
 *   different sources under different definitions. That disagreement is
 *   information. Both are extracted under their own source name and the card
 *   shows what each says, attributed — which is the index's job. Silently
 *   preferring one would manufacture a consensus neither project asserts.
 *
 * WHAT IS NOT EXTRACTED HERE
 *   `languages.csv` carries WALS's own Family / Subfamily / Genus columns.
 *   They are NOT taken: classification comes from Glottolog, which is the
 *   card's cited authority for it, and lint rule R5 requires the family name to
 *   be Glottolog's own name for the cited glottocode. Pulling WALS's parallel
 *   taxonomy in would put two competing classifications behind one field.
 *
 * Usage:
 *   node cli/scripts/extractors/wals.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { extractFeatures, openExtraction } from './lib/extract-lib.mjs';

export const source = 'wals';
export const dir = 'wals';
const SELF = 'extractors/wals.mjs';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  x._stats = extractFeatures({
    x,
    dir,
    domain: 'typology',
    urlFor: (id) => `https://wals.info/languoid/lect/wals_code_${id}`,
  });
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ wals → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.features} features across ${s.languages.toLocaleString()} languages`);
    console.log(`    ${s.written.toLocaleString()} coded, ${s.unknown.toLocaleString()} blank`);
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
