#!/usr/bin/env node

/**
 * extractor: glottolog-cldf → facts. Endangerment and documentation depth.
 *
 * WHY THIS IS A SEPARATE SOURCE FROM `glottolog`
 *   Two different Zenodo deposits under one name, and this repo has already
 *   been bitten by conflating them: the bulk CLDF fetch overwrote the custom
 *   downloads pin earlier in this same phase. `glottolog` is the languoid table
 *   — classification, geography, the tree. `glottolog-cldf` is the derived CLDF
 *   release carrying the assessments: AES and MED.
 *
 * AES — AGGLOMERATED ENDANGERMENT STATUS
 *   Glottolog's own six-level scale, compiled from several upstream sources.
 *   It sits BESIDE ELCat's assessment on a card, attributed, not merged into
 *   it. The two disagree often, and which is right is not ours to decide — an
 *   index that resolved that disagreement would be asserting something neither
 *   body said.
 *
 * MED — MOST EXTENSIVE DESCRIPTION, AND WHY IT MATTERS BEYOND VITALITY
 *   Glottolog records the best description that exists for a language, graded
 *   long grammar → grammar → grammar sketch → phonology/text → wordlist or
 *   less, each pointing at a bibliography entry.
 *
 *   That is the closest thing to a direct answer to the question the thin
 *   cards raise: on what grounds do we believe this language exists, and what
 *   could someone actually read about it? A language whose MED is "wordlist or
 *   less" is not badly served by us — it is badly served by the literature,
 *   and saying so is more useful than an empty card. The MED's source id is
 *   kept so the citation can be resolved from Glottolog's bibliography.
 *
 *   It is also the honest replacement for `documentationDepth`, which the old
 *   pipeline populated with no fetchable source at all.
 *
 * Usage:
 *   node cli/scripts/extractors/glottolog-cldf.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { codeIndex, openExtraction, readCldf } from './lib/extract-lib.mjs';

export const source = 'glottolog-cldf';
export const dir = 'glottolog-cldf';
const SELF = 'extractors/glottolog-cldf.mjs';

/** Parameters worth extracting. `classification` and `subclassification` are
 *  the tree, which the `glottolog` extractor already holds from languoid.csv;
 *  taking them here too would put one claim behind two sources. */
const WANTED = new Set(['aes', 'med', 'category']);

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const { languages, codes, values } = readCldf(dir);
  const { map, unresolvable } = codeIndex(languages, x);

  const codeName = new Map(codes.map((c) => [c.ID, c]));
  const stats = { aes: 0, med: 0, category: 0, unresolvable, docYears: 0 };

  for (const v of values) {
    if (!WANTED.has(v.Parameter_ID)) continue;
    const code = map.get(v.Language_ID);
    if (!code) continue;
    const c = v.Code_ID ? codeName.get(v.Code_ID) : null;
    const url = `https://glottolog.org/resource/languoid/id/${v.Language_ID}`;

    if (v.Parameter_ID === 'aes') {
      x.assert({
        code, domain: 'vitality', property: 'aesStatus',
        value: c?.Name ?? v.Value, url, raw: v.Value,
        notes: 'Glottolog Agglomerated Endangerment Status — its own scale, '
          + 'compiled from several upstreams; shown beside ELCat, not merged with it',
      });
      // The numeric level, so a consumer can order without parsing prose.
      if (c?.numerical_value) {
        x.assert({
          code, domain: 'vitality', property: 'aesLevel', value: c.numerical_value,
          valueType: 'integer', url, raw: v.Value,
          notes: '1 not endangered … 6 extinct',
        });
      }
      stats.aes++;
      continue;
    }

    if (v.Parameter_ID === 'med') {
      x.assert({
        code, domain: 'documentation', property: 'mostExtensiveDescription',
        value: c?.Name ?? v.Value, url, raw: v.Value,
        notes: 'the best description Glottolog knows of for this language'
          + (v.Source ? ` (bibliography entry ${v.Source})` : ''),
      });
      if (c?.numerical_value !== undefined && c.numerical_value !== '') {
        x.assert({
          code, domain: 'documentation', property: 'medLevel', value: c.numerical_value,
          valueType: 'integer', url, raw: v.Value,
          notes: '0 long grammar … 4 wordlist or less',
        });
      }
      if (v.Source) {
        // Keeps the citation resolvable. Phase D's "grounds for existence"
        // needs to point AT something, not merely assert a grade.
        x.assert({
          code, domain: 'documentation', property: 'medSourceId', value: v.Source, url,
          notes: 'Glottolog bibliography id for the most extensive description',
        });
      }
      stats.med++;
      continue;
    }

    // `category` distinguishes a spoken L1 language from a pseudo-family member,
    // a sign language, an artificial language and so on. Direct evidence for
    // the scope question, so it is recorded rather than inferred later.
    x.assert({
      code, domain: 'classification', property: 'glottologCategory',
      value: c?.Name ?? v.Value, url, raw: v.Value,
    });
    stats.category++;
  }

  // Documentation window and macroarea.
  //
  // Macroarea lives HERE, not in the `glottolog` extractor: the custom-downloads
  // languoid.csv has no such column. Reading a field from whichever file happens
  // to be open is how one fact ends up with two provenances.
  for (const l of languages) {
    const code = map.get(l.ID);
    if (!code || l.Level !== 'language') continue;
    const url = `https://glottolog.org/resource/languoid/id/${l.ID}`;
    if (l.Macroarea) {
      x.assert({ code, domain: 'geography', property: 'macroarea', value: l.Macroarea, url });
      stats.macroarea = (stats.macroarea ?? 0) + 1;
    } else {
      x.absent({ code, domain: 'geography', property: 'macroarea',
        notes: 'Glottolog assigns no macroarea to this languoid' });
    }
    if (l.First_Year_Of_Documentation) {
      x.assert({ code, domain: 'documentation', property: 'firstDocumented',
        value: l.First_Year_Of_Documentation, valueType: 'integer', url });
      stats.docYears++;
    }
    if (l.Last_Year_Of_Documentation) {
      x.assert({ code, domain: 'documentation', property: 'lastDocumented',
        value: l.Last_Year_Of_Documentation, valueType: 'integer', url });
    }
  }

  x._stats = stats;
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ glottolog-cldf → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.aes.toLocaleString()} AES endangerment assessments`);
    console.log(`    ${s.med.toLocaleString()} most-extensive-description grades, each with its `
      + 'bibliography id');
    console.log(`    ${s.category.toLocaleString()} languoid categories · `
      + `${s.docYears.toLocaleString()} first-documentation years`);
    if (s.unresolvable) console.log(`    ⚠ ${s.unresolvable} row(s) unresolvable to a code`);
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
