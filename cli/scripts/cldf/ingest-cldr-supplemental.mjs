/**
 * ingest-cldr-supplemental.mjs — CLDR's alias and likely-subtag tables.
 *
 * THE ONE RELATION THIS SOURCE EXISTS FOR
 *   CLDR's alias table carries 64 entries whose `_reason` is "macrolanguage":
 *
 *     "cmn": { "_replacement": "zh",  "_reason": "macrolanguage" }
 *     "arb": { "_replacement": "ar",  "_reason": "macrolanguage" }
 *     "cwd": { "_replacement": "cr",  "_reason": "macrolanguage" }
 *
 *   Read forwards, that is canonicalisation: write `zh`, not `cmn`. Read
 *   BACKWARDS — which is what Champollion needs — it is Unicode stating which
 *   individual languages the BCP 47 world folds into a macrolanguage tag. That
 *   is the cited raw material for the question every MT coverage lookup runs
 *   into, and it replaces eight editorial routings that cited nothing.
 *
 * WHY THE VALUE IS NOT CALLED "PREDOMINANT MEMBER"
 *   Because the inversion does not always mean that, and the first version of
 *   this handler got it wrong. `cmn` is the only member folded into `zh`, so
 *   calling Mandarin the predominant member of Chinese is sound. But CLDR folds
 *   BOTH `fat` and `twi` into `ak` — it is collapsing a cluster it does not
 *   distinguish, not crowning one of them, and Akan has no single dominant
 *   member to crown.
 *
 *   So the raw relation is stored and predominance is DERIVED at resolution
 *   time: one member folded in, both registries present, no disagreement, or
 *   the resolver reports ambiguity. Asserting it here would have quietly
 *   invented a winner for Akan, Zapotec and Sanskrit.
 *
 * WHAT THE INVERSION DOES AND DOES NOT LICENSE
 *   It licenses "when a service says `zho`, the standard means Mandarin".
 *   It does NOT license "therefore that service translates Mandarin" — the
 *   service said what it said, and coverage is never propagated across this
 *   link. The resolver reports the route; it does not launder it into a claim.
 *
 * CLDR'S SILENCE IS INGESTED AS SILENCE
 *   The alias table covers 500 languages against a spine of 8,686. A
 *   macrolanguage CLDR does not alias has NO predominant member here, and the
 *   resolver reports ambiguity rather than choosing one.
 *
 *   Norwegian is the case that proves the rule is doing work: CLDR issues no
 *   macrolanguage alias for `no`, so `nor` → `nob` gets no citation from this
 *   source and remains what it always was — an editorial decision, now visibly
 *   so instead of sitting in a config file looking like a fact.
 *
 * likelySubtags IS A SECOND OPINION, NOT A DERIVATION
 *   `{"zh": "zh-Hans-CN"}` is Unicode's statement of the maximal form of an
 *   underspecified tag. SIL's langtags states the same thing per equivalence
 *   set. Both are ingested against `bcp47FullTag` so a disagreement between two
 *   standards bodies about a language's default script is visible rather than
 *   settled by whichever ingested last.
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
export function ingestCldrSupplemental(db, spec) {
  const { source = 'cldr-supplemental', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(
      `${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`,
    );
  }
  const upstream = registerSource(db, source, declaredLicense);

  const dir = path.join(DATA, source);
  const aliases = JSON.parse(fs.readFileSync(path.join(dir, 'aliases.json'), 'utf-8'));
  const likely = JSON.parse(fs.readFileSync(path.join(dir, 'likelySubtags.json'), 'utf-8'));

  const languageAlias = aliases?.supplemental?.metadata?.alias?.languageAlias ?? {};
  const likelySubtags = likely?.supplemental?.likelySubtags ?? {};
  if (!Object.keys(languageAlias).length || !Object.keys(likelySubtags).length) {
    throw new Error(
      `${source}: parsed ${Object.keys(languageAlias).length} language aliases and `
      + `${Object.keys(likelySubtags).length} likely subtags. Both tables are what this `
      + 'source is ingested for, so an empty one is a schema change, not a statement.',
    );
  }

  const tags = tagResolver(db);
  const put = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-cldr-supplemental.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    canonicalisedMembers: 0, fullTags: 0, unresolved: [],
  };
  const touched = new Set();

  db.transaction(() => {
    // ── predominantMember, from the macrolanguage aliases, inverted ─────────
    for (const [member, spec2] of Object.entries(languageAlias)) {
      if (spec2?._reason !== 'macrolanguage') continue;
      const macroTag = spec2._replacement;
      if (!macroTag) continue;

      const macroId = tags.resolve(macroTag);
      const memberId = tags.resolve(member);
      if (!macroId || !memberId) {
        // Both halves must land. A relation with one end missing is not a
        // half-fact to keep — it is a pointer to nowhere.
        stats.unresolved.push(`${member}→${macroTag}`);
        continue;
      }
      touched.add(macroId);
      if (put(macroId, 'canonicalisedMember', memberId, {
        comment: `CLDR canonicalises "${member}" to "${macroTag}" with reason=macrolanguage`,
      })) { stats.asserted++; stats.canonicalisedMembers++; }
    }

    // ── bcp47FullTag, from likelySubtags ────────────────────────────────────
    for (const [tag, full] of Object.entries(likelySubtags)) {
      // Only bare language subtags. `und-Arab` and `zh-Hant` are answers to a
      // different question — what to assume given a script, and what a
      // script-qualified tag maximises to — and neither is "this language's
      // default full tag".
      if (tag.includes('-') || tag === 'und') continue;
      const id = tags.resolve(tag);
      if (!id) { stats.unresolved.push(tag); continue; }
      touched.add(id);
      if (put(id, 'bcp47FullTag', full, {
        comment: 'CLDR likelySubtags: the maximal form of this language tag',
      })) { stats.asserted++; stats.fullTags++; }
    }
  })();

  stats.languages = touched.size;
  stats.offSpine = stats.unresolved.length;
  return stats;
}
