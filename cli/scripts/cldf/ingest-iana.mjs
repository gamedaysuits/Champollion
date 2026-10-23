/**
 * ingest-iana.mjs — the IANA Language Subtag Registry → values.
 *
 * WHAT IT TAKES, AND WHY SO LITTLE
 *   The registry is large and most of it is not IANA's to assert. Its `Scope:`
 *   and `Macrolanguage:` fields are copied from ISO 639-3, which the atlas
 *   already ingests directly from SIL. Reading them here would file a second
 *   attestation against the same claim and let the agreement layer report
 *   "unanimous" over one registry counted twice.
 *
 *   So this handler takes only decisions the BCP 47 registry itself makes:
 *
 *     Suppress-Script   The script subtag that is redundant for this language.
 *                       A tag normaliser needs it to know that `en-Latn` says
 *                       nothing `en` did not.
 *     Preferred-Value   On a DEPRECATED language subtag, the subtag that
 *                       replaces it. This is what makes `iw` reach Hebrew and
 *                       `in` reach Indonesian — legacy codes that are still in
 *                       corpora, configs and user input, and that resolve to
 *                       nothing without it.
 *
 * WHY Preferred-Value BECOMES codeAlias RATHER THAN ITS OWN PARAMETER
 *   `codeAlias` already means "another code that resolves to this language",
 *   and a deprecated subtag is exactly that. Giving it a second name would be
 *   the "bazillion fields that all mean the same thing" failure in miniature:
 *   two parameters, one question, and every consumer having to ask both.
 *
 * EXTLANG IS DELIBERATELY NOT A ROUTE
 *   The registry also carries extlang records — `cmn` with `Prefix: zh` and
 *   `Preferred-Value: cmn`. It is tempting to read those as "zh means cmn", and
 *   it would be wrong: an extlang's Preferred-Value points at ITSELF as a
 *   primary subtag, saying "write cmn, not zh-cmn". It says nothing about what
 *   a bare `zh` denotes. That question is answered by CLDR and langtags, which
 *   make an actual editorial choice, and is ingested there.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { tagResolver, valueWriter, parseRecordJar } from './tag-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestIana(db, spec) {
  const { source = 'iana-subtag-registry', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(
      `${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`,
    );
  }
  const upstream = registerSource(db, source, declaredLicense);

  const file = path.join(DATA, source, 'language-subtag-registry.txt');
  const records = parseRecordJar(fs.readFileSync(file, 'utf-8'));
  if (!records.length) {
    throw new Error(
      `${source}: the record-jar parser produced zero records. The registry has a `
      + 'stable format defined by RFC 5646, so an empty parse is a fault here, never '
      + 'an upstream statement.',
    );
  }

  const tags = tagResolver(db);
  const put = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-iana.mjs' });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    records: records.length, suppressScript: 0, deprecatedAliases: 0,
    unresolvedSubtags: [],
  };
  const touched = new Set();

  db.transaction(() => {
    for (const rec of records) {
      if (rec.Type?.[0] !== 'language') continue;
      const subtag = rec.Subtag?.[0];
      if (!subtag) continue;

      const deprecated = Boolean(rec.Deprecated?.[0]);
      const preferred = rec['Preferred-Value']?.[0] ?? null;

      if (deprecated && preferred) {
        // The deprecated subtag is an alias OF the language the preferred
        // subtag denotes — so it is recorded on the successor's card, which is
        // the card a lookup can actually reach. Same reasoning as ISO
        // retirements being recorded on the successor rather than on a code
        // that has no spine row.
        const target = tags.resolve(preferred);
        if (!target) {
          stats.unresolvedSubtags.push(`${subtag}→${preferred}`);
          continue;
        }
        touched.add(target);
        if (put(target, 'codeAlias', subtag, {
          comment: `deprecated BCP 47 subtag, replaced by "${preferred}" per the IANA registry`,
        })) { stats.asserted++; stats.deprecatedAliases++; }
        continue;
      }

      const suppress = rec['Suppress-Script']?.[0];
      if (suppress) {
        const target = tags.resolve(subtag);
        if (!target) { stats.unresolvedSubtags.push(subtag); continue; }
        touched.add(target);
        if (put(target, 'suppressScript', suppress, {
          comment: 'the script subtag IANA records as redundant for this language',
        })) { stats.asserted++; stats.suppressScript++; }
      }
    }
  })();

  stats.languages = touched.size;
  // Counted and named rather than dropped. An unresolvable subtag here is
  // almost always a collection or legacy code with no ISO 639-3 individual
  // language behind it (`bh`, `mo`), which is a real property of the registry
  // and not a fault — but it is reported so nobody has to assume that.
  stats.offSpine = stats.unresolvedSubtags.length;
  return stats;
}
