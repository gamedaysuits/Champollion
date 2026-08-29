/**
 * tag-registry.mjs — shared machinery for the three BCP 47 registries.
 *
 * WHY THESE THREE SOURCES EXIST IN THE ATLAS AT ALL
 *   Every MT service Champollion indexes publishes its coverage in BCP 47, and
 *   BCP 47 does not name languages the way ISO 639-3 does. Google lists `zho`;
 *   nobody lists `cmn`. That is not carelessness — CLDR states the rule
 *   outright: "Unicode language and locale identifiers always use the
 *   Macrolanguage to identify the predominant form."
 *
 *   So there are two coherent ecosystems. Localisation (IANA / CLDR / SIL
 *   langtags) is macrolanguage-preferred and answers "what locale does this
 *   user want". Documentary linguistics (ISO 639-3 / Glottolog / CLDF) is
 *   individual-language-preferred and answers "which speech variety is this".
 *   Champollion has to speak both, and the previous corpus bridged them with
 *   eight hand-written routings in a JSON file nobody could cite.
 *
 * THE ECHO PROBLEM, WHICH IS THE WHOLE REASON THIS FILE HAS A HEADER
 *   Three registries carrying the same relation is only corroboration if the
 *   three decided it independently. They did not, uniformly:
 *
 *     - IANA's `Macrolanguage:` and `Scope:` fields are COPIED from ISO 639-3.
 *     - SIL langtags' `contains[]` restates the ISO 639-3 macrolanguage table,
 *       from the same publisher.
 *
 *   Ingesting either as a second attestation would make the atlas report
 *   "unanimous" over what is one registry repeated three times. Both are
 *   therefore deliberately NOT ingested, and each handler says so at the point
 *   where it declines to read them.
 *
 *   What IS independent: CLDR chooses a predominant member for its locale
 *   identifiers, and the langtags editors choose one for tag equivalence. Two
 *   editorial bodies, two decisions, genuinely corroborating when they agree —
 *   and reported as a disagreement when they do not, like any other pair of
 *   sources.
 */

import { createHash } from 'node:crypto';

/**
 * The BCP 47 primary language subtag for a language — the standard's own rule,
 * in one place.
 *
 * RFC 5646 §2.2.1 is explicit: where a language has both an ISO 639-1 and an
 * ISO 639-3 code, the SHORTEST one is the subtag. So Chinese is `zh` and not
 * `zho`, Norwegian Bokmål is `nb` and not `nob`, and Plains Cree is `crk`
 * because it has no two-letter code at all.
 *
 * This was very nearly read out of SIL's langtags instead, which would have
 * been wrong in a way that only showed up on the biggest languages: langtags
 * publishes equivalence SETS, and the canonical tag of the default Chinese set
 * is `zh-CN`, not `zh`. Reading a per-language subtag out of a per-set field
 * silently produced no tag at all for Chinese, Arabic and 32 others.
 *
 * @param {string|null} part1  the ISO 639-1 code, if the language has one
 * @param {string} part3       the ISO 639-3 code
 * @returns {string}
 */
export function shortestSubtag(part1, part3) {
  return part1 && part1.length === 2 ? part1.toLowerCase() : String(part3).toLowerCase();
}

/**
 * A resolver from BCP 47 language subtags onto the spine.
 *
 * Two-letter subtags are the whole difficulty: `zh` is not a spine ID, and the
 * only thing that says `zh` means `zho` is SIL's own Part1 column, already in
 * the store as `iso639_1`. So this reads the store rather than hardcoding a
 * mapping — but that makes it ORDER-DEPENDENT, and order dependence is how two
 * earlier handlers in this directory came to report a clean run over zero rows.
 *
 * Hence the guard. An empty map is not "no two-letter codes exist"; it is
 * proof that this handler ran before `iso639-3` did, and it stops the build
 * instead of silently contributing nothing.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function tagResolver(db) {
  const spine = new Set(
    db.prepare('SELECT ID FROM cldf_languages').all().map((r) => r.ID),
  );
  if (!spine.size) {
    throw new Error('the spine is empty — buildSpine() has not run');
  }

  const byPart1 = new Map();
  for (const r of db.prepare(
    "SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'iso639_1'",
  ).all()) {
    byPart1.set(r.Value, r.Subject_ID);
  }
  if (!byPart1.size) {
    throw new Error(
      'no iso639_1 values in the store, so no two-letter BCP 47 subtag can be resolved. '
      + 'This handler must run AFTER iso639-3 — add it to RUNS_LAST in build-atlas.mjs. '
      + 'Without this guard it would report a clean run over zero rows, which is exactly '
      + 'how the iso15924 and macrolanguage measurements were silently empty before.',
    );
  }

  const part1Of = new Map([...byPart1].map(([p1, id]) => [id, p1]));

  return {
    spineSize: spine.size,
    part1Size: byPart1.size,
    /** The BCP 47 primary subtag this language is written as. */
    bareTag(languageId) {
      return shortestSubtag(part1Of.get(languageId) ?? null, languageId);
    },
    /**
     * Resolve one BCP 47 PRIMARY language subtag. Returns null rather than
     * guessing — an unresolvable subtag is counted and reported, never dropped.
     * @param {string} subtag
     * @returns {string|null}
     */
    resolve(subtag) {
      if (!subtag) return null;
      const s = String(subtag).toLowerCase();
      if (s.length === 2) return byPart1.get(s) ?? null;
      return spine.has(s) ? s : null;
    },
  };
}

/**
 * Re-exported so the three tag handlers keep their existing import, while the
 * implementation lives in values.mjs with every other handler's. A second copy
 * of the writer here was how the value columns would have drifted apart.
 */
export { valueWriter } from './values.mjs';

/**
 * Parse an RFC 5646 §3.1.1 "record-jar" file — the IANA registry's format.
 *
 * Records are separated by a line of `%%`; fields are `Name: value`; a line
 * beginning with whitespace CONTINUES the previous field. That last rule is the
 * one worth having a parser for: long Description and Comments fields wrap, and
 * a naive line-splitter turns one description into several bogus fields — the
 * same class of fault that made a quoted ELCat comment parse into fake values.
 *
 * A field may legitimately repeat (a subtag can carry several Description
 * lines), so every field collects into an array and callers take what they
 * mean.
 *
 * @param {string} text
 * @returns {Array<Record<string, string[]>>}
 */
export function parseRecordJar(text) {
  const records = [];
  let current = null;
  let lastField = null;

  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '%%') {
      if (current) records.push(current);
      current = {};
      lastField = null;
      continue;
    }
    if (current === null) continue; // the File-Date preamble, before the first %%
    if (rawLine === '') continue;

    if (/^\s/.test(rawLine)) {
      // Continuation. RFC 5646 says folded lines join with a single space.
      if (lastField && current[lastField]?.length) {
        const arr = current[lastField];
        arr[arr.length - 1] = `${arr[arr.length - 1]} ${rawLine.trim()}`;
      }
      continue;
    }

    const at = rawLine.indexOf(':');
    if (at < 0) continue;
    const field = rawLine.slice(0, at).trim();
    const value = rawLine.slice(at + 1).trim();
    (current[field] ??= []).push(value);
    lastField = field;
  }
  if (current) records.push(current);
  return records;
}
