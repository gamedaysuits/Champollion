#!/usr/bin/env node

/**
 * extractor: unicode-cldr → facts. Text direction.
 *
 * WHY ONE SMALL FIELD IS WORTH A WHOLE EXTRACTOR
 *   Text direction is not decoration. Render right-to-left text left-to-right
 *   and the output is not merely ugly, it is unreadable — and it fails silently,
 *   because the characters are all present and in the right order in memory. It
 *   is the kind of defect that ships.
 *
 * THE ABSENCE MATTERS MORE THAN THE VALUE
 *   CLDR is a localisation standard, not a language survey: it covers 322
 *   locales against a spine of 8,837 languages. For the other 8,515 it says
 *   nothing at all.
 *
 *   The tempting move is to default those to left-to-right, because most
 *   languages are. That is exactly the reasoning that put
 *   `orthographicStatus: "unwritten"` on 1,318 languages — a majority pattern
 *   substituted for a fact about a specific language. Uncovered languages get
 *   `not_surveyed`, and their card shows no direction rather than a guess.
 *
 *   Worse, the guess would be wrong in the cases that matter: a language written
 *   in Arabic or Hebrew script that CLDR happens not to cover is precisely the
 *   one a left-to-right default would break, and precisely the one nobody would
 *   be checking.
 *
 * Usage:
 *   node cli/scripts/extractors/cldr.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { openExtraction } from './lib/extract-lib.mjs';

export const source = 'unicode-cldr';
export const dir = 'cldr';
const SELF = 'extractors/cldr.mjs';

const URL = 'https://github.com/unicode-org/cldr-json';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const target = path.join(DATA_ROOT, dir);

  const stats = { covered: 0, rtl: 0, notSurveyed: 0, unresolved: 0 };
  const seen = new Set();

  for (const name of fs.readdirSync(target).sort()) {
    if (!name.endsWith('.json') || name === 'SNAPSHOT.json') continue;
    const locale = name.replace(/\.json$/, '');
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(target, name), 'utf-8')); } catch { continue; }

    const block = doc.main?.[locale];
    const order = block?.layout?.orientation?.characterOrder;
    if (!order) continue;

    // CLDR keys by BCP-47 locale; the spine keys by ISO 639-3 or glottocode.
    // A two-letter locale is ISO 639-1, which needs resolving rather than
    // assuming — `ar` is not a spine code, `ara` is.
    const code = x.resolveCode(locale, null);
    if (!x._knownCodes.has(code)) {
      // Try the ISO 639-1 → 639-3 mapping the spine already holds.
      const row = x.db._db.prepare(
        'SELECT code FROM languages WHERE bcp47 = ? OR code = ? LIMIT 1',
      ).get(locale, locale);
      if (!row) { stats.unresolved++; continue; }
      seen.add(row.code);
      emit(x, row.code, order, locale, stats);
      continue;
    }
    seen.add(code);
    emit(x, code, order, locale, stats);
  }

  // Everything CLDR does not cover. Recorded, not defaulted.
  for (const code of x._knownCodes) {
    if (seen.has(code)) continue;
    x.absent({
      code, domain: 'orthography', property: 'textDirection', status: 'not_surveyed',
      notes: 'CLDR does not cover this language. Its silence is not evidence of '
        + 'left-to-right — defaulting would break exactly the Arabic- or '
        + 'Hebrew-script languages CLDR happens to omit, which are the ones '
        + 'nobody would be checking.',
    });
    stats.notSurveyed++;
  }

  x._stats = stats;
  return x;
}

function emit(x, code, order, locale, stats) {
  x.assert({
    code, domain: 'orthography', property: 'textDirection',
    value: order === 'right-to-left' ? 'rtl' : 'ltr',
    url: URL, raw: order,
    notes: `CLDR locale ${locale}`,
  });
  stats.covered++;
  if (order === 'right-to-left') stats.rtl++;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ unicode-cldr → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.covered} languages with a direction (${s.rtl} right-to-left)`);
    console.log(`    ${s.notSurveyed.toLocaleString()} recorded not_surveyed — CLDR covers `
      + 'locales, not languages, and its');
    console.log('    silence is not evidence of left-to-right');
    if (s.unresolved) console.log(`    ⚠ ${s.unresolved} locale(s) unresolvable to a spine code`);
    console.log('');
  }
  x.close();
}
