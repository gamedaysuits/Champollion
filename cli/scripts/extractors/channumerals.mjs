#!/usr/bin/env node

/**
 * extractor: channumerals → facts. Numeral systems.
 *
 * THIS IS A REWRITE, NOT A PORT. THE OLD GENERATOR WAS MANUFACTURING DATA.
 *
 *   Chan's `Base` column is EMPTY for 2,777 of 5,332 languages — 52%. The
 *   deleted generator assigned a base anyway, inventing 2,005 values, and it
 *   CONTRADICTED the source on a further 212 by flattening Chan's own
 *   vocabulary into "decimal".
 *
 *   That vocabulary is not decoration. Chan distinguishes 95 distinct system
 *   descriptions, among them `binary`, `body tally`, `quinary-vigesimal` and
 *   `complicated`. A restricted numeral system is one of the few typological
 *   facts that genuinely changes what an MT pipeline can do — a language that
 *   counts by body parts does not have a word for 47 waiting to be translated.
 *   Flattening those to "decimal" destroys exactly the signal the field exists
 *   to carry, and stamped Chan's name on the result.
 *
 *   So: `Base` is taken VERBATIM, whitespace-trimmed and nothing else. Empty
 *   means Chan records no base, which is recorded as an absence. No default,
 *   no inference from the forms, no normalisation of `body tally` into a
 *   number.
 *
 * `highestDocumented` IS RENAMED `highestElicited`
 *   The old field reported the largest numeral present, and reported 2000 for
 *   about 65% of cards. That is not a fact about the language; it is a fact
 *   about Chan's questionnaire, which elicits up to 2000. Reading it as "this
 *   language documents numerals up to 2000" is a category error the name
 *   invited. Renamed to say what it measures.
 *
 * `bodyPartCounting` IS NOT EXTRACTED
 *   The old field was 100% null across all 4,088 cards it appeared on. Zero
 *   information, carried as though it were data. Where Chan means body-tally
 *   counting he writes it in `Base`, which is now preserved verbatim.
 *
 * Usage:
 *   node cli/scripts/extractors/channumerals.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { parseCSVObjects } from '../lib/csv.mjs';
import { openExtraction, readCldf } from './lib/extract-lib.mjs';

export const source = 'channumerals';
export const dir = 'channumerals';
const SELF = 'extractors/channumerals.mjs';

const URL = 'https://mpi-lingweb.shh.mpg.de/numeral';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const { languages } = readCldf(dir, ['languages']);

  // forms.csv is 187k rows; read it once and reduce rather than joining per
  // language.
  const { rows: forms } = parseCSVObjects(
    fs.readFileSync(path.join(DATA_ROOT, dir, 'forms.csv'), 'utf-8'),
    { file: 'channumerals/forms.csv' },
  );
  const highest = new Map();     // CLDF language id -> largest numeral elicited
  const formCount = new Map();
  for (const f of forms) {
    const n = Number(f.Parameter_ID);
    if (!Number.isFinite(n)) continue;
    formCount.set(f.Language_ID, (formCount.get(f.Language_ID) ?? 0) + 1);
    if (!highest.has(f.Language_ID) || n > highest.get(f.Language_ID)) {
      highest.set(f.Language_ID, n);
    }
  }

  const stats = { withBase: 0, noBase: 0, distinctBases: new Set(), langs: 0 };

  for (const l of languages) {
    const code = x.resolveCode(l.ISO639P3code, l.Glottocode);
    if (!code) continue;
    stats.langs++;

    const base = (l.Base ?? '').trim();
    if (base) {
      // VERBATIM. Chan's own words, whatever they are.
      x.assert({
        code, domain: 'numerals', property: 'base', value: base, url: URL, raw: l.Base,
        variant: l.ID,
        notes: l.Comment ? String(l.Comment).slice(0, 300) : null,
      });
      stats.withBase++;
      stats.distinctBases.add(base);
    } else {
      x.absent({
        code, domain: 'numerals', property: 'base', variant: l.ID,
        notes: 'Chan lists this language but records no numeral base. Half the '
          + 'catalogue is in this state; a base was previously INVENTED for 2,005 '
          + 'of them.',
      });
      stats.noBase++;
    }

    const hi = highest.get(l.ID);
    if (hi !== undefined) {
      x.assert({
        code, domain: 'numerals', property: 'highestElicited', value: String(hi),
        valueType: 'integer', url: URL, variant: l.ID,
        notes: 'the largest numeral Chan ELICITED for this language. His '
          + 'questionnaire tops out at 2000, so this is a fact about the survey '
          + 'as much as about the language — which is why it is not called '
          + '"highestDocumented".',
      });
    }
    const n = formCount.get(l.ID);
    if (n) {
      x.assert({
        code, domain: 'numerals', property: 'numeralFormsRecorded', value: String(n),
        valueType: 'integer', url: URL, variant: l.ID,
      });
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
    console.log(`\n  ✓ channumerals → ${r.written.toLocaleString()} facts for `
      + `${s.langs.toLocaleString()} languages`);
    console.log(`    ${s.withBase.toLocaleString()} have a base Chan actually records, in `
      + `${s.distinctBases.size} distinct descriptions — verbatim,`);
    console.log('    including binary, body tally and quinary-vigesimal, none flattened');
    console.log(`    ${s.noBase.toLocaleString()} have NO base in the source and are recorded as `
      + 'absent, not guessed');
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
