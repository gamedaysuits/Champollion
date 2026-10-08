/**
 * ingest-ud-treebanks.mjs — the UD release catalogue → treebank existence.
 *
 * A TREEBANK IS A RESOURCE FACT, NOT A RUN RESULT
 *   That UD_French-GSD exists at 16,342 sentences is existence and extent —
 *   the kind of claim a card may carry. Nothing here says the annotation is
 *   good, consistent, or useful; those are measured claims about output and
 *   belong to a run, per the card-boundary rule.
 *
 * ONE VALUE PER (LANGUAGE, TREEBANK)
 *   A language can have a dozen treebanks — Czech has five in most releases —
 *   each a separately maintained artifact. Each writes its own value under
 *   `treebankResource` with the treebank as the RESOURCE variant, the same
 *   axis every other resource kind uses, so five treebanks sit together as
 *   five facts rather than five sources disagreeing about one.
 *
 * THE COUNTS ARE THE MAINTAINERS' OWN
 *   sentences/tokens/words come from each treebank's stats.xml at the release
 *   tag — the upstream's own published extent, written under the upstream's
 *   source id and never restated as ours. Nothing is summed or derived here;
 *   the one number we add anywhere near this lane is nothing, deliberately.
 *
 * CODES ARE UD'S OWN, RESOLVED ON THE SPINE
 *   The fetcher recorded UD's iso3 assignment for each treebank from UD's own
 *   registry (codes_and_flags.yaml). Those are ISO 639-3 codes, so they
 *   resolve directly against the spine — no in-store locale join, hence no
 *   RUNS_LAST ordering constraint. A treebank whose language the registry
 *   does not code, or whose code the spine does not know, is counted and
 *   NAMED, never fuzzily matched from a display name.
 *
 * AN ABSENCE HERE IS NOT AN ABSENCE
 *   UD contains what its contributors built. No absence is recorded for a
 *   language without a treebank — this handler asserts what exists, never
 *   that nothing else does.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { spineResolver } from './spine.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestUdTreebanks(db, spec = {}) {
  const { source = 'ud-treebanks', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  const pinned = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'ud-treebanks.json'), 'utf-8'),
  );
  const rows = pinned.treebanks;
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`${source}: the pinned catalogue is empty, which is a fetch fault`);
  }

  const spine = spineResolver(db);
  const write = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-ud-treebanks.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    treebanks: 0,
    unmatched: [],
    unmatchedNoun: 'treebank code',
    unmatchedNote:
      'UD\'s own registry assigns each treebank an iso3 code; a treebank whose language '
      + 'the registry does not code, or whose code the spine does not carry, is named '
      + 'rather than matched from its display name — a treebank attached to a guessed '
      + 'language is worse than one reported unresolved.',
  };
  const covered = new Set();
  const unresolved = new Set();

  db.transaction(() => {
    for (const t of rows) {
      // UD's own code, resolved on the spine (retirement chains included).
      // The registry has no glottocodes, so the second argument stays null
      // rather than pretending to a resolution path the data does not offer.
      const languageId = spine.resolve(t.iso3, null);
      if (!languageId) {
        unresolved.add(`${t.treebank} (${t.iso3 ?? 'no registry code'})`);
        continue;
      }
      covered.add(languageId);

      if (write(languageId, 'treebankResource', JSON.stringify({
        treebank: t.treebank,
        // The maintainers' own totals from stats.xml at the release tag; null
        // means unpublished, never zero, and stays null on the card.
        sentences: t.sentences,
        tokens: t.tokens,
        words: t.words,
        release: pinned.release,
      }), {
        // Its own axis, like every other resource: one language's several
        // treebanks are several facts, not several sources disagreeing.
        variantType: VARIANT.RESOURCE,
        variantId: `ud:${t.treebank}`,
        comment: `Universal Dependencies release ${pinned.release}; sentence/token counts `
          + 'are the maintainers\' own from the treebank\'s stats.xml — existence and '
          + 'extent only, nothing here says the annotation is good',
        confidence: 'fetched',
      })) { stats.asserted++; stats.treebanks++; }
    }
  })();

  stats.languages = covered.size;
  stats.offSpine = unresolved.size;
  if (unresolved.size) {
    const list = [...unresolved].sort();
    stats.unmatched.push(
      `${list.slice(0, 6).join(', ')}${list.length > 6 ? ` … (${list.length})` : ''}`,
    );
  }
  return stats;
}
