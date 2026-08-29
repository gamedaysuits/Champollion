#!/usr/bin/env node

/**
 * extractor: grambank → facts. Morphosyntactic features.
 *
 * WHAT GRAMBANK IS
 *   195 binary and multistate features coded per language from descriptive
 *   grammars — word order, alignment, gender, TAM marking, and so on. For an MT
 *   practitioner this is the closest thing to a structured answer to "what is
 *   going to be hard about this language".
 *
 * ONE THING GRAMBANK IS NOT
 *   A tone authority. Grambank has NO tone feature. GB079 is "verb prefixes",
 *   and it has been read as tone in this codebase before, which is why lint
 *   rule R1 exists and why PHOIBLE's inventory is the sole source for a tone
 *   claim. Nothing here emits anything tonal.
 *
 * "?" IS A SURVEY RESULT
 *   Grambank writes "?" where a coder consulted the grammar and could not
 *   determine the value. That is not the same as a language Grambank never
 *   covered, and it is recorded as `not_attested` rather than dropped — the
 *   difference between "the description does not say" and "nobody looked" is
 *   exactly the distinction the store was rebuilt to carry.
 *
 * Usage:
 *   node cli/scripts/extractors/grambank.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { extractFeatures, openExtraction } from './lib/extract-lib.mjs';

export const source = 'grambank';
export const dir = 'grambank';
const SELF = 'extractors/grambank.mjs';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  x._stats = extractFeatures({
    x,
    dir,
    domain: 'typology',
    urlFor: (id) => `https://grambank.clld.org/languages/${id}`,
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
    console.log(`\n  ✓ grambank → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.features} features across ${s.languages.toLocaleString()} languages`);
    console.log(`    ${s.written.toLocaleString()} coded, ${s.unknown.toLocaleString()} marked `
      + '"?" by a coder — kept as not_attested, not discarded');
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
