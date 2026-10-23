/**
 * ingest-glottolog.mjs — Glottolog's languoid table → classification values.
 *
 * WHY GLOTTOLOG GETS A HAND-WRITTEN READER
 *   `languoid.csv` is not CLDF. It is Glottolog's own flat export of a TREE:
 *   every languoid carries `family_id` and `parent_id`, and the classification
 *   of a language is the path between them. There is no ValueTable to map, so
 *   there is nothing for the module handlers to dispatch on.
 *
 * WHAT IS ASSERTED HERE AND WHAT IS COMPUTED
 *   Glottolog states the family, the parent, the country list and the direct
 *   dialect count. Those are ITS claims and carry its release.
 *
 *   The ANCESTRY is a walk we perform over its tree. The path is entirely
 *   Glottolog's — we invent no edge — but assembling it is our operation, so it
 *   carries champollion-derived with Derived_From naming the release. The line
 *   between "reporting a source" and "computing over a source" is exactly where
 *   this project has gone wrong before, in both directions:
 *
 *     dialectCount was recorded as champollion-derived when Glottolog ships
 *     `child_dialect_count` outright — taking credit for someone else's count.
 *
 *     PHOIBLE inventory sizes were recorded as direct from PHOIBLE when PHOIBLE
 *     publishes one row per segment and states no count — putting our
 *     arithmetic under their name.
 *
 * WHAT GLOTTOLOG DOES NOT HAVE
 *   A genus. That is a WALS concept, and WALS ships it in its own
 *   `languages.csv`. An earlier registry sourced `genus` from Glottolog, which
 *   is a category error, and `genusGlottocode` was worse: it paired a WALS
 *   taxonomy with a Glottolog identifier scheme that has no key in common.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCSVObjects } from '../lib/csv.mjs';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { valueWriter } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * Glottolog's top-level "Sign Language" pseudo-family. Every signed languoid
 * roots here, which is what makes modality derivable without a curated list.
 */
const SIGN_FAMILY = 'sign1238';

/**
 * Glottolog's "Bookkeeping" bucket — its own marker for an entry it does NOT
 * stand behind: retired codes, spurious languages, duplicates superseded by a
 * real languoid. It is not a classification, and Glottolog never claims these
 * languages belong to a family called Bookkeeping.
 *
 * It has to be skipped because ISO retirements make these rows collide with
 * live languages. ISO 639-3 retired `aam` (Aramanik) into `aas` (Aasáx);
 * Glottolog keeps the retired languoid `aram1252` under Bookkeeping; the spine
 * correctly forwards aam → aas. Both rows then landed on one card and the
 * card reported "sources disagree: Afro-Asiatic vs Bookkeeping" — a
 * MANUFACTURED disagreement between Glottolog and itself.
 *
 * That is worse than a wrong value. The attribution machinery is the thing
 * this project rests on: a reader is meant to trust that a disagreement shown
 * on a card is a real dispute between authorities. 107 cards were showing a
 * housekeeping artefact as a rival scholarly opinion.
 */
const BOOKKEEPING_FAMILY = 'book1242';

/**
 * Glottolog's top-level buckets that classify by KIND, not by descent. A
 * language sits here when Glottolog is telling you what sort of thing it is —
 * a pidgin, an artificial language, a speech register — not who its ancestors
 * were. None of them may be displayed as a family (founder direction,
 * 2026-07-07); the fact itself is kept, under `glottologBucket`.
 *
 * Sign Language is deliberately NOT in this set: it is the signal `modality`
 * is derived from, and it is handled there.
 */
const GLOTTOLOG_BUCKETS = new Set([
  'uncl1493', // Unclassifiable
  'unat1236', // Unattested
  'arti1236', // Artificial Language
  'spee1234', // Speech Register
  'pidg1258', // Pidgin
  'mixe1287', // Mixed Language
]);

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source: string, license?: string}} spec
 */
export function ingestGlottolog(db, spec) {
  const { source = 'glottolog', license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);

  const { rows } = parseCSVObjects(
    fs.readFileSync(path.join(dir, 'languoid.csv'), 'utf-8'),
    { file: `${source}/languoid.csv` },
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const spine = spineResolver(db);

  // The glottocode the spine itself points at, per language — the arbiter of
  // which languoid is the primary one when several resolve to the same card.
  const spineGlottocode = new Map(
    db.prepare('SELECT ID, Glottocode FROM cldf_languages WHERE Glottocode IS NOT NULL')
      .all().map((r) => [r.ID, r.Glottocode]),
  );

  // Two writers, because a Glottolog assertion and a Champollion derivation over
  // it are different claims by different parties and must not share a source id.
  const writeUpstream = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-glottolog.mjs',
  });
  const writeDerived = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-glottolog.mjs',
  });

  const stats = { source, languages: 0, offSpine: 0, asserted: 0, derived: 0, absence: 0 };

  const put = (languageId, parameter, value, { derived = false, sequence = null } = {}) => {
    const ok = derived
      ? writeDerived(languageId, parameter, value, {
        confidence: 'derived', derivedFrom: upstream.id, sequence,
      })
      : writeUpstream(languageId, parameter, value, { sequence });
    if (!ok) return;
    if (derived) stats.derived++; else stats.asserted++;
  };

  db.transaction(() => {
    for (const r of rows) {
      if (r.level !== 'language') continue;

      // Bookkeeping is not a classification — see BOOKKEEPING_FAMILY. Skipped
      // whole rather than per-field: a retired duplicate's coordinates and
      // counts are superseded claims about a language that already has its
      // own row, so admitting them would fabricate disagreement on those
      // fields too. Counted, never silent: 121 of these are the only Glottolog
      // row for their spine language, and those languages come out of this
      // build with NO Glottolog classification — which is the honest result,
      // because Glottolog declines to classify them.
      if (r.family_id === BOOKKEEPING_FAMILY) {
        stats.bookkeepingSkipped = (stats.bookkeepingSkipped ?? 0) + 1;
        continue;
      }

      const languageId = spine.resolve(r.iso639P3code ?? '', r.id ?? '');
      if (!languageId) { stats.offSpine++; continue; }

      // ONE LANGUOID PER SPINE LANGUAGE.
      //
      // ISO 639-3 retires codes by merging them, and Glottolog keeps the
      // retired languoid as its own row. The spine correctly forwards the dead
      // code to the survivor, so BOTH rows resolve here — and the retired
      // languoid's classification is a claim about a DIFFERENT language.
      //
      // ISO retired `pmc` (Palumata) into `huw` (Hukumina). Glottolog holds
      // palu1237 under its "Unattested" bucket and huku1237 under Austronesian.
      // Merged onto one card, huw reported "Glottolog says Austronesian" and
      // "Glottolog says Unattested" side by side — Glottolog contradicting
      // itself, when in truth it was answering two different questions.
      //
      // The primary row is the one the spine actually points at. Anything else
      // resolving to the same language is a superseded duplicate and asserts
      // nothing: not classification, not coordinates, not counts. Naming the
      // language it merged INTO is a job for supersededCodes, which ISO states
      // directly, rather than for a silent merge of two languoids' facts.
      const canonicalGlottocode = spineGlottocode.get(languageId);
      if (canonicalGlottocode && r.id !== canonicalGlottocode) {
        stats.supersededLanguoid = (stats.supersededLanguoid ?? 0) + 1;
        continue;
      }

      stats.languages++;

      put(languageId, 'glottocode', r.id);
      // glottologLevel is NOT emitted: only level=language rows become spine
      // entries, so it carried one distinct value across 8,309 cards. Retired.
      put(languageId, 'latitude', r.latitude);
      put(languageId, 'longitude', r.longitude);

      // An isolate is its own family. Glottolog says so by pointing family_id
      // at the languoid itself, or by leaving it empty for an unclassified one.
      const isIsolate = !r.family_id || r.family_id === r.id;
      put(languageId, 'isIsolate', isIsolate ? '1' : '0');

      if (r.family_id && !isIsolate) {
        put(languageId, 'familyGlottocode', r.family_id);
        const fam = byId.get(r.family_id);
        if (fam?.name) {
          if (GLOTTOLOG_BUCKETS.has(r.family_id)) {
            // A HOUSEKEEPING BUCKET IS NOT A FAMILY.
            //
            // Glottolog files 322 languages under top-level buckets that
            // classify by KIND rather than descent: Unclassifiable (128),
            // Pidgin (87), Unattested (54), Artificial Language (30), Speech
            // Register (19), Mixed Language (4). Esperanto's parent is
            // "Artificial Language"; that is a true and useful statement, and
            // it is not a claim that Esperanto descends from anything.
            //
            // Printing it in the family slot would put a genealogical claim
            // on the card that Glottolog never made — so it goes in its own
            // field and the card simply has no family, which is the truth.
            // The bucket's GLOTTOCODE, not its name: that is the established
            // card convention (the schema pattern is a glottocode) and it is
            // the stable identifier — Glottolog can retitle a bucket without
            // changing what it means.
            put(languageId, 'glottologBucket', r.family_id);
          } else {
            // Attributed: WALS also names a family, and the two taxonomies differ.
            put(languageId, 'family', fam.name);
          }
        }
      }

      // Glottolog's own count of DIRECT child dialects. Its claim, not ours.
      if (r.child_dialect_count && r.child_dialect_count !== '0') {
        put(languageId, 'dialectCount', r.child_dialect_count);
      }

      // Space-separated ISO 3166 alpha-2 codes. One value per country, because
      // a list is several claims rather than one string.
      for (const cc of (r.country_ids ?? '').split(/\s+/).filter(Boolean)) {
        put(languageId, 'country', cc);
      }

      // The ancestry is a WALK over Glottolog's tree. Every edge is theirs; the
      // traversal is ours, so it is derived. Guarded against a cycle rather
      // than trusted to terminate — a malformed tree should not hang a build.
      const ancestry = [];
      const seen = new Set([r.id]);
      let node = r.parent_id ? byId.get(r.parent_id) : null;
      while (node && !seen.has(node.id)) {
        seen.add(node.id);
        ancestry.push(node.id);
        node = node.parent_id ? byId.get(node.parent_id) : null;
      }
      // Root-first, so the card reads family → … → immediate parent.
      ancestry.reverse();

      // MODALITY — signed vs spoken, from the ancestry root alone.
      //
      // This matters more than a taxonomy label: a signed language has no
      // written modality, so every text-in/text-out assumption a translation
      // pipeline makes is wrong for it. Losing the field silently told the
      // whole site 227 languages were ordinary text targets.
      //
      // The signal is Glottolog's own top-level "Sign Language" pseudo-family.
      // The PREVIOUS derivation keyed on ISO 639-3's Ref_Name matching
      // /sign language/i and carried a hand-written allowlist of four
      // endonymous codes (asf, ils, sfb, vgt) for the names that did not
      // match. That list was the failure mode this rebuild exists to end: it
      // had to be extended by hand every time ISO added an endonymous sign
      // code, and nothing would have reported the omission. Rooting on the
      // family instead covers all four without an allowlist and finds 227
      // where the name-matching heuristic found 163 — 64 sign languages the
      // curated list was quietly missing.
      //
      // Derived, not asserted: Glottolog states the parent edges, WE walk them
      // to the root and read a modality off the result. Glottolog never says
      // "this language is signed", so the claim is ours to carry.
      // An isolate is its own root, so it answers the same question without a
      // walk — Basque is spoken because Basque is not the sign-language family.
      const modalityRoot = ancestry.length ? ancestry[0] : r.id;
      put(languageId, 'modality', modalityRoot === SIGN_FAMILY ? 'signed' : 'spoken',
        { derived: true });

      for (const [i, gc] of ancestry.entries()) {
        // `sequence`, not a discriminator. This used to be
        // variant: String(i).padStart(2,'0') — an ordinal stuffed into the
        // column that says WHICH one, purely to keep the chain in order. Order
        // and identity are different questions and now have different columns.
        put(languageId, 'ancestry', gc, { derived: true, sequence: i });
      }
    }
  })();

  return stats;
}
