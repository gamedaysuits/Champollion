/**
 * ingest-opus-corpora.mjs — the OPUS index → corpus nodes + attestation edges.
 *
 * THE THIRD SUBJECT, ON THE SAME PATHWAY
 *   Languages arrive through the registry handlers, methods through
 *   ingest-vendor-languages and ingest-hf-models, corpora through here. All
 *   three use the same fetcher contract, the same registerSource, the same
 *   valueWriter and the same tag resolver — which was the point of generalising
 *   the value layer over subjects rather than building a third pipeline.
 *
 * A CORPUS ATTESTS A LANGUAGE ONLY THROUGH A PAIR
 *   There is no monolingual coverage in a parallel corpus. "GlobalVoices covers
 *   Swahili" is not a claim anybody can act on; "GlobalVoices has Swahili
 *   against 47 other languages, the largest being English at 21,437 segments"
 *   is. So the edge is per (language, corpus) and carries the pair structure,
 *   rather than a bare boolean that would answer a question nobody asked.
 *
 * ONE EDGE PER LANGUAGE-CORPUS, NOT ONE PER PAIR
 *   A language in a 49-language corpus appears in up to 48 pairs. Writing each
 *   as its own value would put 48 rows under one (subject, parameter, variant)
 *   key, which the value layer reads as forty-eight sources disagreeing. They
 *   are not disagreeing; they are one fact with structure. So the pairs are
 *   folded into a single value, with the totals we computed stamped derived.
 *
 * SIZES ARE THE PUBLISHER'S, TOTALS ARE OURS
 *   `alignmentPairs`, `sourceTokens` and `targetTokens` come from OPUS's own
 *   index and are reported verbatim. Anything summed across pairs is a
 *   Champollion derivation and says so — writing our arithmetic under OPUS's
 *   name would misrepresent what OPUS asserts.
 *
 * AN UNPUBLISHED SIZE IS NOT A ZERO
 *   A fifth of OPUS pairs publish no alignment count, and Ubuntu — 23,988
 *   pairs — publishes none at all. Summing those as zero would put "0 segments"
 *   on a card for a corpus nobody has measured, which reads as "this corpus is
 *   empty" and is the more damaging of the two possible errors. So totals are
 *   summed ONLY over pairs that published a count, and the value carries how
 *   many did not, so a reader can tell a small corpus from an unmeasured one.
 *
 * A SELF-PAIR IS NOT A TRANSLATION PAIR
 *   OPUS lists rows with the same code on both sides — Tatoeba publishes
 *   crk-crk. Those are monolingual entries in a parallel index. Counting one as
 *   an attestation makes a language appear to be paired with itself, and it
 *   inflated Plains Cree's Tatoeba entry to four "pairs" when the corpus has
 *   two real ones. They are counted and reported, never folded into coverage.
 *
 * WHAT IT DOES NOT CLAIM
 *   Existence and size, never quality. Not that the alignment is good, that the
 *   text is in-domain, that it is clean, or that it may be used — the last is a
 *   licence question OPUS does not answer uniformly, because it aggregates
 *   hundreds of independently licensed collections. A corpus here is a thing
 *   that exists at a size, and every further question stays open.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, readSnapshot } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { tagResolver } from './tag-registry.mjs';
import { valueWriter, VARIANT, SUBJECT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** How many partners are named on an edge before it becomes a count. */
const NAMED_PARTNERS = 5;

/**
 * OPUS writes locales with an underscore — `pt_BR`, `zh_CN`, `sr_Latn` — which
 * is the same non-BCP-47 convention FLORES uses. The resolver already accepts
 * it; the primary subtag is what names a language, and the region is a variant
 * of it rather than a different one.
 */
function primaryOf(code) {
  return String(code).replace(/_/g, '-').toLowerCase().split('-')[0];
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestOpusCorpora(db, spec = {}) {
  const { source = 'opus-corpora', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);
  const snap = readSnapshot(source);

  const index = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'opus-index.json'), 'utf-8'),
  );
  const names = Object.keys(index);
  if (!names.length) {
    throw new Error(`${source}: the pinned index is empty, which is a fetch fault`);
  }

  const tags = tagResolver(db);
  const onCorpus = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-opus-corpora.mjs',
    subjectType: SUBJECT.CORPUS,
  });
  const onLanguage = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-opus-corpora.mjs',
  });
  const addNode = db.prepare(`
    INSERT INTO cldf_contributions (ID, Type, Name, Description, Citation)
    VALUES (?, 'corpus', ?, ?, ?) ON CONFLICT(ID) DO NOTHING
  `);

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    corpora: 0, emptyCorpora: 0, edges: 0, pairs: 0, selfPairs: 0, pairsWithoutSize: 0,
    unmatched: [],
    unmatchedNoun: 'OPUS language code',
    unmatchedNote:
      'OPUS carries collection-internal identifiers alongside language codes, and '
      + 'some collections predate the registries the resolver reads. An unmatched code '
      + 'is named rather than dropped, because a corpus reported as covering fewer '
      + 'languages than it does is the same failure as one reported as covering more.',
  };
  const covered = new Set();
  const unresolvedCodes = new Set();

  db.transaction(() => {
    for (const name of names) {
      const rows = index[name];
      if (!rows.length) {
        // OPUS lists the collection but publishes no moses-preprocessed pairs at
        // the latest version. Recorded as a count; a node with no pairs would
        // assert a resource nobody can obtain.
        stats.emptyCorpora++;
        continue;
      }

      const corpusId = `corpus:opus:${name}`;
      // Self-pairs are monolingual entries in a parallel index and are not
      // coverage. Dropped here, counted for the report.
      const real = rows.filter((r) => r.source !== r.target);
      stats.selfPairs += rows.length - real.length;
      if (!real.length) {
        // Every row was a self-pair, so the collection is monolingual and has no
        // parallel coverage to record. Counted with the empty ones rather than
        // becoming a node asserting a pair count of zero.
        stats.emptyCorpora++;
        continue;
      }
      const langCodes = new Set(real.flatMap((r) => [r.source, r.target]));
      const sized = real.filter((r) => r.alignmentPairs !== null);
      stats.pairsWithoutSize += real.length - sized.length;
      // Summed over the pairs that published a count, never over all of them.
      // Treating an unpublished size as zero would report an unmeasured corpus
      // as an empty one.
      const alignmentTotal = sized.reduce((a, r) => a + r.alignmentPairs, 0);

      addNode.run(
        corpusId, name,
        'Parallel corpus indexed by OPUS. Sizes are the publisher\'s; totals are ours. '
        + 'Metadata only — no content is held here, and the licence is the collection\'s '
        + 'own rather than OPUS\'s.',
        snap?.citation ?? null,
      );
      stats.corpora++;
      stats.pairs += real.length;

      // ── Facts about the CORPUS ────────────────────────────────────────────
      if (onCorpus(corpusId, 'corpusPairCount', real.length, {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: 'counted over the fetched index at the latest published version, '
          + 'excluding rows listing the same code on both sides',
      })) { stats.asserted++; }
      if (onCorpus(corpusId, 'corpusLanguageCount', langCodes.size, {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: 'distinct codes on either side of a pair, before tag resolution',
      })) { stats.asserted++; }
      // Withheld entirely when OPUS publishes no size for any pair. A total of
      // 0 over zero measured pairs is not a small corpus, it is no measurement,
      // and the absence policy exists so the card can say so.
      if (sized.length && onCorpus(corpusId, 'corpusAlignmentPairs', alignmentTotal, {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: `summed from the counts OPUS publishes, over ${sized.length} of `
          + `${real.length} pair(s); the rest publish no size`,
      })) { stats.asserted++; }

      // ── Edges: attestation, on the LANGUAGE ───────────────────────────────
      // Folded per language so one language-corpus relationship is one value.
      /** @type {Map<string, {partners: Array<{code: string, alignmentPairs: number}>, total: number}>} */
      const byLanguage = new Map();
      for (const r of real) {
        for (const [self, other] of [[r.source, r.target], [r.target, r.source]]) {
          const languageId = tags.resolve(primaryOf(self));
          if (!languageId) { unresolvedCodes.add(self); continue; }
          if (!byLanguage.has(languageId)) {
            byLanguage.set(languageId, { partners: [], total: 0, sized: 0 });
          }
          const e = byLanguage.get(languageId);
          e.partners.push({ code: other, alignmentPairs: r.alignmentPairs });
          if (r.alignmentPairs !== null) { e.total += r.alignmentPairs; e.sized++; }
        }
      }

      for (const [languageId, e] of byLanguage) {
        covered.add(languageId);
        // Unsized pairs sort last rather than as zero — they are unknown, and
        // ordering them below a measured 1 would imply we know they are smaller.
        e.partners.sort((a, b) => (b.alignmentPairs ?? -1) - (a.alignmentPairs ?? -1));
        if (onLanguage(languageId, 'corpusResource', JSON.stringify({
          corpus: name,
          corpusId,
          pairCount: e.partners.length,
          // The biggest few by size, because "which pair is usable" is the
          // question, and a 48-name list answers it no better than five.
          topPartners: e.partners.slice(0, NAMED_PARTNERS),
          // Ours, not OPUS's — hence the derived stamp on the comment below.
          // null, not 0, when nothing in this corpus published a size. The
          // two must stay distinguishable all the way to the card.
          alignmentPairsTotal: e.sized ? e.total : null,
          pairsWithPublishedSize: e.sized,
          largestPairAlignments: e.partners[0]?.alignmentPairs ?? null,
        }), {
          variantType: VARIANT.CORPUS,
          variantId: corpusId,
          comment:
            `OPUS publishes ${e.partners.length} pair(s) for this language in ${name}; `
            + `per-pair alignment counts are the publisher's, summed over ${e.sized} `
            + 'that publish one — the total is champollion-derived, and null rather '
            + 'than zero where none does',
          confidence: 'fetched',
        })) { stats.asserted++; stats.edges++; }
      }
    }
  })();

  stats.languages = covered.size;
  stats.offSpine = unresolvedCodes.size;
  if (unresolvedCodes.size) {
    const list = [...unresolvedCodes].sort();
    stats.unmatched.push(
      `${list.slice(0, 10).join(', ')}${list.length > 10 ? ` … (${list.length})` : ''}`,
    );
  }
  return stats;
}
