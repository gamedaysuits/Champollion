/**
 * ingest-linguameta.mjs — Google's LinguaMeta TSV → locale and vitality values.
 *
 * WHY A HAND-WRITTEN READER
 *   `linguameta.tsv` is a flat tab-separated table, not CLDF. One row per
 *   language, 17 columns, several of which pack a LIST into a single cell.
 *
 * WHAT IT ADDS THAT NOTHING ELSE HAS
 *   - endonym: the name in the language itself. Only 1,137 of 7,511 rows carry
 *     one (15%), which is why `nativeName` stays PARTIAL until Wikidata P1705
 *     is fetched. A gap we can measure is not the same as a gap we hide.
 *   - a THIRD endangerment scale. ELCat has nine levels, Glottolog AES six,
 *     and LinguaMeta a UNESCO-style six with different names again. Three
 *     vocabularies, so three Source_Scales, so a card showing all three reports
 *     them as incommensurable rather than as a three-way argument.
 *   - a numeric speaker estimate where ELCat publishes bands. Both are kept
 *     verbatim and attributed; neither is converted into the other.
 *
 * THE COMPOSITE CELL PROBLEM
 *   `cldr_official_status` is not a status. It is a list of country-scoped
 *   statuses joined with commas — one English row runs to 1,500 characters
 *   naming ninety territories. Storing that verbatim would put a paragraph on a
 *   card where a reader expects a word, and would make "is this official in
 *   Kenya?" unanswerable without string surgery.
 *
 *   So it is decomposed: one value per territory, the territory in Variant.
 *   Splitting a delimited list the publisher wrote is READING it, not deriving
 *   from it, so these stay LinguaMeta's assertions with LinguaMeta's release.
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
 * LinguaMeta's endangerment vocabulary, declared so an unlisted level fails the
 * build rather than arriving silently. This is a UNESCO-style scale and is NOT
 * ELCat's nor Glottolog AES's.
 */
const ENDANGERMENT = new Set([
  'Not endangered', 'Vulnerable', 'Definitely endangered',
  'Severely endangered', 'Critically endangered', 'Extinct',
]);

/** `Official [KE]` / `Regional official [RU]` / `De facto official [US]`. */
const STATUS = /^(.+?)\s*\[([A-Z]{2})\]$/;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestLinguameta(db, spec) {
  const { source = 'linguameta', license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  // Tab-separated with no quoting. Deliberately NOT run through the RFC-4180
  // reader: this is a different format, and pretending otherwise is how a
  // parser silently mangles a field.
  const lines = fs.readFileSync(path.join(dir, 'linguameta.tsv'), 'utf-8')
    .split('\n').filter(Boolean);
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });

  const spine = spineResolver(db);

  const insertCode = db.prepare(`
    INSERT INTO cldf_codes (ID, Parameter_ID, Name, Description, Source_Scale)
    VALUES (?, 'endangerment', ?, NULL, ?) ON CONFLICT(ID) DO NOTHING
  `);
  for (const level of ENDANGERMENT) {
    insertCode.run(`endangerment-${level}`, level, upstream.id);
  }

  const write = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-linguameta.mjs' });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    outOfVocabulary: [], compositeStatusesSplit: 0,
  };

  const put = (languageId, parameter, value, variant = null) => {
    if (write(languageId, parameter, value, variant ?? {})) stats.asserted++;
  };

  db.transaction(() => {
    for (const r of rows) {
      const languageId = spine.resolve(r.iso_639_3_code, r.glottocode);
      if (!languageId) { stats.offSpine++; continue; }
      stats.languages++;

      put(languageId, 'name', r.english_name);
      put(languageId, 'bcp47', r.bcp_47_code);
      put(languageId, 'endonym', r.endonym);
      put(languageId, 'speakerCount', r.estimated_number_of_speakers);

      if (r.endangerment_status) {
        if (!ENDANGERMENT.has(r.endangerment_status)) {
          stats.outOfVocabulary.push({
            language: languageId, parameter: 'endangerment', value: r.endangerment_status,
          });
        } else {
          put(languageId, 'endangerment', r.endangerment_status);
        }
      }

      // Comma-separated ISO 15924 codes: "Cans, Latn".
      for (const sc of r.writing_systems.split(',').map((s) => s.trim()).filter(Boolean)) {
        put(languageId, 'script', sc);
      }

      // One value per TERRITORY. A status that names ninety countries is ninety
      // claims, not one string.
      for (const part of r.cldr_official_status.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = STATUS.exec(part);
        if (!m) {
          // Never store an unparsed composite as though it were a status.
          stats.outOfVocabulary.push({
            language: languageId, parameter: 'cldrOfficialStatus', value: part,
          });
          continue;
        }
        // The TERRITORY the status holds in — "official in CA" and "official in
        // FR" are two facts about one language, never a conflict to resolve.
        put(languageId, 'cldrOfficialStatus', m[1], {
          variantType: VARIANT.TERRITORY, variantId: m[2],
        });
        stats.compositeStatusesSplit++;
      }
    }
  })();

  return stats;
}
