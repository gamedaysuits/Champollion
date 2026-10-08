/**
 * ingest-cldr.mjs — Unicode CLDR layout data → text direction.
 *
 * WHY THIS IS SMALL AND STILL WORTH HAVING
 *   CLDR ships one JSON file per locale, and all we take is
 *   `layout.orientation.characterOrder`. That is a single fact per language,
 *   and it is one an MT practitioner needs before rendering a single line of
 *   output.
 *
 * THE ABSENCE RULE MATTERS MORE HERE THAN THE VALUE
 *   CLDR covers 324 locales. The atlas covers 8,686 languages. If a missing
 *   file meant "left-to-right", we would be asserting a writing direction for
 *   more than eight thousand languages on the strength of Unicode never having
 *   been asked about them — and for the many with no established orthography at
 *   all, the question does not have an answer to assert.
 *
 *   That is exactly the shape of the `orthographicStatus: "unwritten"` mistake,
 *   which asserted a fact about 1,318 languages because our own data was
 *   missing. So a language CLDR does not cover simply has no value here. Not
 *   left-to-right, not unknown, not a default: absent.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** CLDR's own vocabulary. An unlisted value is a schema change, not a default. */
const DIRECTIONS = new Set(['left-to-right', 'right-to-left']);

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestCldr(db, spec) {
  const { source = 'cldr', license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const spine = spineResolver(db);

  const write = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-cldr.mjs' });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    outOfVocabulary: [], localesRead: 0,
  };

  db.transaction(() => {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      } catch {
        // A CLDR file we cannot parse is a fetch problem, not a language with
        // no direction. Counted so it cannot pass as coverage.
        stats.outOfVocabulary.push({ language: file, parameter: 'textDirection', value: '(unparseable)' });
        continue;
      }
      stats.localesRead++;

      const locale = file.replace(/\.json$/, '');
      // Locale tags may carry a script or region ("sr-Cyrl", "zh-Hant"). The
      // language subtag is what maps onto the spine; the rest describes a
      // variant of the same language, and CLDR gives them the same orientation.
      const base = locale.split('-')[0];
      // The spine resolver only returns INDIVIDUAL languages, which silently
      // dropped every macrolanguage locale — CLDR's `ar` file says
      // right-to-left and the claim vanished, leaving Arabic, Persian, Hebrew
      // and Urdu with no direction while apc and ckb had one. Recording
      // CLDR's own claim about `ar` ON the ara card is faithful reporting of
      // what CLDR says, not propagation to members: no member card gains a
      // value from this.
      let languageId = spine.resolve(base, '');
      if (!languageId && base.length === 2) {
        languageId = db.prepare(
          "SELECT Subject_ID FROM cldf_values WHERE Parameter_ID='iso639_1' AND Value=?",
        ).get(base)?.Subject_ID ?? null;
      }
      if (!languageId) { stats.offSpine++; continue; }

      const order = parsed?.main?.[locale]?.layout?.orientation?.characterOrder;
      if (!order) continue;
      if (!DIRECTIONS.has(order)) {
        stats.outOfVocabulary.push({ language: languageId, parameter: 'textDirection', value: order });
        continue;
      }

      write(languageId, 'textDirection', order);
      stats.asserted++;
      stats.languages++;
    }
  })();

  return stats;
}
