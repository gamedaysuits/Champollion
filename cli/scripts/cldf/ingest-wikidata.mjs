/**
 * ingest-wikidata.mjs — native language names (P1705) → endonym values.
 *
 * WHY EVERY LABEL IS KEPT
 *   Wikidata returns several native labels for many languages, tagged by the
 *   language of the label itself: a name in its own script, the same name
 *   transliterated, sometimes a regional variant. All are kept, with the tag in
 *   Variant.
 *
 *   Choosing one would require deciding which script a community "really" uses
 *   to write its own name, and that is not a call this project has any standing
 *   to make. It is the same rule as speaker estimates and endangerment: several
 *   bodies speak, all are recorded, the reader sees the spread.
 *
 * WHY IT SHARES A FIELD WITH LINGUAMETA'S ENDONYM
 *   They are the same concept. An earlier registry had `endonym` from
 *   LinguaMeta and `nativeName` from Wikidata as two fields, so a card showed
 *   whichever happened to be populated and a reader could not tell that two
 *   sources existed — the "bazillion fields that all mean the same thing"
 *   defect, in my own work. One attributed field now carries both.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestWikidata(db, spec = {}) {
  const { source = 'wikidata', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const spine = spineResolver(db);

  const { rows } = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'native-labels.json'), 'utf-8'),
  );

  const write = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-wikidata.mjs' });

  const stats = { source, languages: 0, offSpine: 0, asserted: 0, absence: 0 };
  const seen = new Set();

  db.transaction(() => {
    for (const r of rows) {
      const languageId = spine.resolve(r.iso, '');
      if (!languageId) { stats.offSpine++; continue; }

      // A BLANK NODE IS NOT A NAME.
      //
      // When Wikidata holds a P1705 statement with "some value" but no actual
      // string, SPARQL returns a skolem IRI —
      // http://www.wikidata.org/.well-known/genid/<hash> — instead of a label.
      // Passed through, that URL became the endonym on bsa and xce: the card
      // told a reader their language calls itself a URL.
      //
      // Wikidata is saying "a native name exists and I do not know it", which
      // is not a name, so nothing is written. Counted so the silence is
      // visible rather than mistaken for a language that has no endonym.
      if (typeof r.native !== 'string' || /\/\.well-known\/genid\//.test(r.native)) {
        stats.blankNodes = (stats.blankNodes ?? 0) + 1;
        continue;
      }
      // The label's own language tag is the discriminator. Two labels that
      // differ only by the language they are written in are two facts, not a
      // conflict to resolve.
      write(languageId, 'endonym', r.native, {
        ...(r.lang ? { variantType: VARIANT.LANGUAGE, variantId: r.lang } : {}),
        comment: r.lang ? `label language: ${r.lang}` : null,
        confidence: 'unverified',
      });
      seen.add(languageId);
      stats.asserted++;
    }
  })();

  stats.languages = seen.size;
  return stats;
}
