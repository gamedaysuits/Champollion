/**
 * ingest-langtags.mjs — SIL's langtags equivalence sets → values.
 *
 * WHAT AN EQUIVALENCE SET IS
 *   One canonical BCP 47 tag, its fully specified form, every other tag that
 *   means the same thing, and the ISO 639-3 code behind it:
 *
 *     { "tag": "zh", "full": "zh-Hans-CN", "iso639_3": "zho",
 *       "iso639_3extra": ["cmn"], "contains": ["cdo","cjy","cmn", …] }
 *
 *   That single record spans both code ecosystems, which is why this source is
 *   the backbone of tag resolution rather than one opinion among many.
 *
 * `contains[]` IS NOT INGESTED, ON PURPOSE
 *   It restates the ISO 639-3 macrolanguage membership table, published by the
 *   same organisation, which the atlas already reads directly from SIL. Filing
 *   it again would let the agreement layer report two independent sources
 *   agreeing when there is one source quoted twice — the exact failure mode
 *   this rebuild was convened to end.
 *
 *   `iso639_3extra` is a different matter. It is the langtags editors deciding
 *   which members fold into a macrolanguage tag, and CLDR decides the same
 *   thing separately for its locale identifiers. Two bodies, two decisions:
 *   real corroboration where they agree, a reported disagreement where they do
 *   not — and they do not agree about Konkani, where CLDR folds `gom` and
 *   langtags folds `knn`.
 *
 * THE CREE CASE, WHICH IS WHY THIS IS BUILT THE WAY IT IS
 *   Both CLDR and langtags name Woods Cree (`cwd`) as the predominant member of
 *   `cre`. Not Plains Cree (`crk`) — the language this project exists for.
 *
 *   A pipeline that picked its favourite would have disagreed with both
 *   registries about its own flagship and never noticed. Instead `crk` resolves
 *   as an ordinary macrolanguage member, so OPUS-MT publishing coverage for
 *   `cre` gives Plains Cree `via-macrolanguage` and never `via-predominant`.
 *   That is a weaker claim, it is the true one, and it is the answer a Cree
 *   speaker deciding whether to trust a translation actually needs.
 *
 * ONE SET PER LANGUAGE SUPPLIES THE CANONICAL TAG
 *   A language written in several scripts has several sets — `ace` and
 *   `ace-Arab`. Only the set whose tag is a BARE language subtag states the
 *   language's own canonical tag; the others state a script-qualified variant,
 *   which is a different fact and would overwrite it with whichever sorted last.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { tagResolver, valueWriter } from './tag-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestLangtags(db, spec) {
  const { source = 'sil-langtags', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(
      `${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`,
    );
  }
  const upstream = registerSource(db, source, declaredLicense);

  const entries = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'langtags.json'), 'utf-8'),
  );
  // Leading records are metadata: a regions/scripts inventory with no `tag`,
  // then `_globalvar`, `_phonvar`, `_version`. Filtered by shape rather than by
  // position, because a publisher adding a fourth metadata record must not
  // silently shift a real set into the skipped range.
  const sets = entries.filter(
    (e) => e && typeof e.tag === 'string' && !e.tag.startsWith('_'),
  );
  if (!sets.length) {
    throw new Error(
      `${source}: zero equivalence sets after filtering. langtags.json is a JSON array `
      + 'of sets; an empty result is a schema change, not an upstream statement.',
    );
  }

  const tags = tagResolver(db);
  const put = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-langtags.mjs' });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    sets: sets.length, fullTags: 0, noDefaultSet: 0,
    canonicalisedMembers: 0, aliases: 0, foldedNotAliased: 0, unresolved: new Set(),
  };
  const touched = new Set();

  // Grouped by ISO code, because a language has SEVERAL equivalence sets and
  // the question "which one speaks for the language" has no positional answer.
  //
  // The first version of this took only sets whose `tag` was a bare language
  // subtag, and that quietly excluded Chinese: langtags' default Chinese set is
  // tagged `zh-CN`, with the bare `zh` listed among its equivalents. Same for
  // Arabic and 32 others — so the largest languages in the atlas got no full
  // tag and no fold relation, and the build reported a clean run.
  const byIso = new Map();
  for (const set of sets) {
    if (!set.iso639_3) continue;
    if (!byIso.has(set.iso639_3)) byIso.set(set.iso639_3, []);
    byIso.get(set.iso639_3).push(set);
  }

  db.transaction(() => {
    for (const [iso, group] of byIso) {
      const id = tags.resolve(iso);
      if (!id) { stats.unresolved.add(iso); continue; }
      touched.add(id);

      // The set that speaks for the language is the one the BARE subtag falls
      // into — either as its canonical tag or among its equivalents. That is
      // what a caller typing the plain language code actually gets.
      const bare = tags.bareTag(id);
      const primary = group.find((s) => s.tag === bare)
        ?? group.find((s) => (s.tags ?? []).includes(bare))
        ?? null;

      if (primary) {
        if (put(id, 'bcp47FullTag', primary.full, {
          comment: `the maximal language-script-region form of "${bare}", per SIL langtags`,
        })) { stats.asserted++; stats.fullTags++; }
      } else {
        // 23 languages have only script- or region-qualified sets and no
        // default reading. Counted, because "langtags has no default form for
        // this language" is a fact about the source and not a gap in the read.
        stats.noDefaultSet++;
      }

      // The fold relation, unioned across EVERY set for this code. Chinese
      // declares `iso639_3extra: ["cmn"]` on five different script sets and on
      // none that is bare, so reading it from one set alone found nothing.
      const extra = new Set(group.flatMap((s) => s.iso639_3extra ?? []));

      // The fold link. Recorded on the MACROLANGUAGE, matching where CLDR's
      // inverted alias lands, so the two sources meet on one (language,
      // parameter) pair and the agreement layer can see them.
      //
      // NOT called a predominant member: `zho` takes one extra code (cmn) and
      // `aka` takes two (fat, twi). Whether a fold designates a winner is a
      // question about how many folded in, and it is answered at resolution
      // time rather than asserted here.
      for (const member of extra) {
        const memberId = tags.resolve(member);
        if (!memberId) { stats.unresolved.add(member); continue; }
        if (memberId === id) continue;
        if (put(id, 'canonicalisedMember', memberId, {
          comment: `SIL langtags records "${member}" as an additional ISO 639-3 code for `
            + `tags of "${bare}"`,
        })) { stats.asserted++; stats.canonicalisedMembers++; }
      }

      // Equivalent tags, but ONLY bare language subtags. `zh-CN` and `zh-Hans`
      // are locales, and filing a locale as a code alias would let a caller
      // asking for a language be answered with a region.
      for (const alias of new Set(group.flatMap((s) => s.tags ?? []))) {
        if (alias.includes('-') || alias === bare) continue;

        // And never a tag that is ITSELF another language. The `ay` set lists
        // `ayr` among its equivalents, but Central Aymara is not an alias of
        // Aymara — it is a distinct language with its own card that BCP 47
        // folds into the macrolanguage tag. Filing it as an alias would make
        // `ayr` resolve to `aym` and quietly make Central Aymara unreachable
        // by its own code.
        //
        // The fold is real and is recorded, above, as canonicalisedMember.
        // This is the same distinction the whole source exists to keep: a code
        // that MEANS this language, versus a code the standard SUBSUMES.
        const other = tags.resolve(alias);
        if (other && other !== id) { stats.foldedNotAliased++; continue; }

        if (put(id, 'codeAlias', alias, {
          comment: `equivalent BCP 47 tag for "${bare}", per SIL langtags`,
        })) { stats.asserted++; stats.aliases++; }
      }
    }
  })();

  stats.languages = touched.size;
  stats.offSpine = stats.unresolved.size;
  stats.unresolved = [...stats.unresolved];
  return stats;
}
