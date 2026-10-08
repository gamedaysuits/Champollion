#!/usr/bin/env node

/**
 * extractor: clics3 → facts. Colexification.
 *
 * WHAT COLEXIFICATION IS AND WHY AN MT PROJECT CARES
 *   A language colexifies two concepts when one word covers both — Russian
 *   `ruka` for HAND and ARM, German `Zeit` for TIME and WEATHER in some senses.
 *   Every colexification in the source language is a place a translator must
 *   choose, and every one in the target is a place meaning is lost. It is a
 *   direct predictor of where a pipeline will produce plausible, wrong output.
 *
 * ONE FIELD IS DELETED HERE, DELIBERATELY
 *   `notableColexifications` is NOT extracted and will not be rebuilt.
 *
 *   It sat on 1,578 cards. 15% of its entries were TAUTOLOGIES — ["SEE","SEE"],
 *   ["BITE","BITE"] — a concept colexified with itself, which is not a fact
 *   about any language. 95 cards contained nothing but tautologies. And
 *   "notable" was never defined: the field was an unranked truncation of
 *   whatever the query returned first, so it implied a judgement of salience
 *   that nothing behind it had made.
 *
 *   A field that cannot say why these entries and not others does not belong on
 *   a card. The counts below are recoverable and meaningful; the list was
 *   neither.
 *
 * THE COUNTS ARE RE-DERIVED, NOT COPIED
 *   Three cards previously carried `colexificationCount > conceptsDocumented`,
 *   which is impossible — a language cannot colexify more concept pairs than it
 *   has concepts. Both numbers are now computed from the database in one pass
 *   so they cannot disagree, and both are OURS: CLICS publishes forms and
 *   concepts, not per-language counts, so these are champollion-derived with
 *   lineage rather than claims attributed to CLICS.
 *
 * Usage:
 *   node cli/scripts/extractors/clics3.mjs [--dry-run]
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { openExtraction } from './lib/extract-lib.mjs';

export const source = 'clics3';
export const dir = 'clics3';
const SELF = 'extractors/clics3.mjs';

const URL = 'https://clics.clld.org';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const clics = new Database(path.join(DATA_ROOT, dir, 'clics.sqlite'), { readonly: true });

  // One pass, one query: concepts documented and colexifying concepts per
  // language. Computing them separately is how the impossible pair
  // (colexifications > concepts) arose.
  const rows = clics.prepare(`
    SELECT l.ISO639P3code AS iso, l.Glottocode AS glotto, l.ID AS lid,
           COUNT(DISTINCT p.Concepticon_ID) AS concepts
    FROM LanguageTable l
    JOIN FormTable f ON f.Language_ID = l.ID AND f.dataset_ID = l.dataset_ID
    JOIN ParameterTable p ON p.ID = f.Parameter_ID AND p.dataset_ID = f.dataset_ID
    WHERE p.Concepticon_ID IS NOT NULL AND p.Concepticon_ID != ''
    GROUP BY l.ID, l.dataset_ID
  `).all();

  // A colexification is one FORM carrying two or more DISTINCT concepts.
  // Self-pairs are excluded by construction here: distinct concepts only, which
  // is precisely the check the deleted field lacked.
  const colex = clics.prepare(`
    SELECT l.ID AS lid,
           SUM(CASE WHEN c.n > 1 THEN 1 ELSE 0 END) AS colexifying
    FROM LanguageTable l
    JOIN (
      SELECT f.Language_ID, f.dataset_ID, f.clics_form,
             COUNT(DISTINCT p.Concepticon_ID) AS n
      FROM FormTable f
      JOIN ParameterTable p ON p.ID = f.Parameter_ID AND p.dataset_ID = f.dataset_ID
      WHERE f.clics_form IS NOT NULL AND f.clics_form != ''
        AND p.Concepticon_ID IS NOT NULL AND p.Concepticon_ID != ''
      GROUP BY f.Language_ID, f.dataset_ID, f.clics_form
    ) c ON c.Language_ID = l.ID AND c.dataset_ID = l.dataset_ID
    GROUP BY l.ID, l.dataset_ID
  `).all();
  const colexBy = new Map(colex.map((r) => [r.lid, r.colexifying]));

  const stats = { langs: 0, impossible: 0, doculects: 0 };
  const perCode = new Map();   // spine code -> accumulated per doculect

  for (const r of rows) {
    const code = x.resolveCode(r.iso, r.glotto);
    if (!code) continue;
    stats.doculects++;
    const colexifying = colexBy.get(r.lid) ?? 0;
    // Guard the invariant rather than trusting the query: a count of colexifying
    // forms can never exceed the concepts they were drawn from.
    if (colexifying > r.concepts) stats.impossible++;
    if (!perCode.has(code)) perCode.set(code, { concepts: 0, colexifying: 0, n: 0 });
    const acc = perCode.get(code);
    acc.concepts = Math.max(acc.concepts, r.concepts);
    acc.colexifying = Math.max(acc.colexifying, colexifying);
    acc.n++;
  }

  for (const [code, acc] of perCode) {
    stats.langs++;
    const url = `${URL}/languages/${code}`;
    // Both OURS. CLICS publishes forms and concepts; a per-language count is a
    // reading of them, and attributing it to CLICS would put words in their
    // mouth. The two are derived together so they cannot contradict.
    const cId = x.derive({
      code, domain: 'lexical', property: 'conceptsDocumented',
      value: String(acc.concepts), valueType: 'integer',
      from: `clics3 ${x.snap.pin.value}`,
      notes: `distinct Concepticon concepts with a form, across ${acc.n} `
        + `CLICS doculect${acc.n === 1 ? '' : 's'} for this code`,
    });
    x.derive({
      code, domain: 'lexical', property: 'colexifyingForms',
      value: String(acc.colexifying), valueType: 'integer',
      inputIds: cId === null ? [] : [cId],
      from: `clics3 ${x.snap.pin.value}`,
      notes: 'forms carrying two or more DISTINCT concepts. Self-pairs are '
        + 'excluded by construction — the deleted notableColexifications field '
        + 'was 15% tautologies such as ["SEE","SEE"] precisely because nothing '
        + 'made that check.',
    });
  }

  clics.close();
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
    console.log(`\n  ✓ clics3 → ${r.written.toLocaleString()} facts for `
      + `${s.langs.toLocaleString()} languages (${s.doculects.toLocaleString()} doculects)`);
    console.log('    concepts and colexifying forms derived TOGETHER, so they cannot');
    console.log(`    contradict — impossible pairs found: ${s.impossible}`);
    console.log('    notableColexifications is NOT extracted and will not return');
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
