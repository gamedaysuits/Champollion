#!/usr/bin/env node

/**
 * extractor: asjp → facts. Swadesh-style wordlists.
 *
 * WHAT ASJP IS
 *   The Automated Similarity Judgment Program: a 100-concept wordlist
 *   transcribed in a deliberately coarse alphabet, for more languages than any
 *   other single lexical resource — 11,540 doculects covering 6,097 of our
 *   spine codes.
 *
 * WHY IT MATTERS TO AN MT PROJECT MORE THAN ITS SIZE SUGGESTS
 *   A 100-word list will not train anything. What it does is answer, for
 *   thousands of languages where nothing else does, whether ANY lexical data
 *   exists at all — and give a first, checkable handful of words. For a language
 *   whose Glottolog MED is "wordlist or less", this often IS the wordlist.
 *
 *   That makes it the honest floor of the resource picture: not "this language
 *   is translatable", but "here is what a person could actually start from".
 *
 * WHAT GOES ON THE CARD, AND WHAT ONLY GOES IN THE STORE
 *   The forms themselves are extracted — they are the data, and the CLI and
 *   harness can use them. The CARD shows only coverage counts, because 100
 *   transcribed words are a resource to link to, not a page to read.
 *
 *   Coverage is DERIVED: ASJP publishes forms, not per-language counts, so a
 *   count is our arithmetic and carries champollion-derived with lineage rather
 *   than ASJP's name.
 *
 * ONE DOCULECT IS NOT ONE LANGUAGE
 *   ASJP lists several varieties per ISO code — 11,540 doculects over 6,097
 *   codes. Their forms differ, and that is real variation, not noise. Each form
 *   is keyed by its doculect so nothing overwrites anything, and the coverage
 *   count takes the BEST-attested doculect rather than summing across varieties,
 *   which would report a coverage no single variety has.
 *
 * Usage:
 *   node cli/scripts/extractors/asjp.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { parseCSVObjects } from '../lib/csv.mjs';
import { openExtraction, readCldf } from './lib/extract-lib.mjs';

export const source = 'asjp';
export const dir = 'asjp';
const SELF = 'extractors/asjp.mjs';

const URL = 'https://asjp.clld.org';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const { languages, parameters } = readCldf(dir, ['languages', 'parameters']);

  const conceptOf = new Map(parameters.map((p) => [p.ID, p.Concepticon_Gloss || p.Name]));
  const totalConcepts = parameters.length;

  const { rows: forms } = parseCSVObjects(
    fs.readFileSync(path.join(DATA_ROOT, dir, 'forms.csv'), 'utf-8'),
    { file: 'asjp/forms.csv' },
  );

  // doculect id -> spine code
  const codeOf = new Map();
  const nameOf = new Map();
  for (const l of languages) {
    const code = x.resolveCode(l.ISO639P3code, l.Glottocode);
    if (!code) continue;
    codeOf.set(l.ID, code);
    nameOf.set(l.ID, l.Name);
  }

  // Per doculect: which concepts it covers. Kept per doculect deliberately —
  // summing across varieties would report a coverage no single variety has.
  const perDoculect = new Map();
  const stats = { forms: 0, doculects: 0, codes: 0 };

  for (const f of forms) {
    const code = codeOf.get(f.Language_ID);
    if (!code) continue;
    const concept = conceptOf.get(f.Parameter_ID);
    if (!concept || !f.Form) continue;

    if (!perDoculect.has(f.Language_ID)) perDoculect.set(f.Language_ID, new Set());
    perDoculect.get(f.Language_ID).add(f.Parameter_ID);

    x.assert({
      code, domain: 'lexical', property: `swadesh:${concept}`, value: f.Form,
      variant: f.Language_ID, url: `${URL}/languages/${f.Language_ID}`,
      raw: f.Value,
      notes: `ASJP doculect ${nameOf.get(f.Language_ID) ?? f.Language_ID}`,
    });
    stats.forms++;
  }

  // Coverage per spine code: the best-attested doculect for it.
  const best = new Map();
  for (const [docId, concepts] of perDoculect) {
    const code = codeOf.get(docId);
    if (!code) continue;
    const prev = best.get(code);
    if (!prev || concepts.size > prev.n) best.set(code, { n: concepts.size, docId });
  }
  stats.doculects = perDoculect.size;

  for (const [code, b] of best) {
    stats.codes++;
    x.derive({
      code, domain: 'lexical', property: 'swadeshConceptsCovered',
      value: String(b.n), valueType: 'integer',
      from: `asjp ${x.snap.pin.value}`,
      notes: `of ${totalConcepts} ASJP concepts, from its best-attested doculect `
        + `(${nameOf.get(b.docId) ?? b.docId}). Counted per doculect, not summed `
        + 'across varieties — a sum would report coverage no single variety has.',
    });
  }

  // How many varieties ASJP distinguishes for this code. Real variation, and a
  // signal that "the language" may not be one translation target.
  const varieties = new Map();
  for (const docId of perDoculect.keys()) {
    const code = codeOf.get(docId);
    if (code) varieties.set(code, (varieties.get(code) ?? 0) + 1);
  }
  for (const [code, n] of varieties) {
    if (n < 2) continue;
    x.derive({
      code, domain: 'lexical', property: 'asjpVarieties', value: String(n),
      valueType: 'integer', from: `asjp ${x.snap.pin.value}`,
      notes: 'distinct doculects ASJP records under this code. More than one '
        + 'means the wordlists differ between varieties.',
    });
  }

  x._stats = { ...stats, totalConcepts };
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ asjp → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.forms.toLocaleString()} wordlist forms across `
      + `${s.doculects.toLocaleString()} doculects → ${s.codes.toLocaleString()} spine codes`);
    console.log(`    coverage counted per doculect against ${s.totalConcepts} concepts, `
      + 'never summed across varieties');
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
