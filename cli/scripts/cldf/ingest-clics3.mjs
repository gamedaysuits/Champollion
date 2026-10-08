/**
 * ingest-clics3.mjs — colexification, computed from CLICS³.
 *
 * WHAT COLEXIFICATION IS, AND WHY IT MATTERS FOR TRANSLATION
 *   A language COLEXIFIES two concepts when one word expresses both — German
 *   `Baum` for both "tree" and "wood", Russian `рука` for both "hand" and
 *   "arm". Where two languages colexify differently, a translator has to make a
 *   choice the source text never made, and the ambiguity is invisible until it
 *   bites. It is one of the few lexical facts that genuinely predicts where an
 *   MT system will go wrong.
 *
 * THE DEFINITION, STATED BECAUSE AN EARLIER ONE WAS WRONG
 *   The previous corpus produced cards where `colexificationCount` exceeded
 *   `conceptsDocumented` — an impossible result, since a subset cannot be
 *   larger than the set it is drawn from. That is what a bad join looks like
 *   when nobody checks the arithmetic against its own meaning.
 *
 *   So, explicitly:
 *     colexificationConcepts  distinct Concepticon concepts attested for this
 *                             language in CLICS³
 *     colexifyingForms        forms in this language that map to TWO OR MORE
 *                             distinct concepts
 *
 *   Concepts are counted through Concepticon IDs rather than raw parameter
 *   names, because CLICS³ aggregates many datasets and the same concept
 *   arrives under different labels. Counting labels would inflate every number
 *   by however many contributing datasets a language happens to appear in.
 *
 *   The invariant colexifyingForms ≤ colexificationConcepts is CHECKED, not
 *   assumed: a form colexifying n concepts requires at least n concepts to
 *   exist, so the reverse is arithmetically impossible and means the join is
 *   wrong again.
 *
 * THESE ARE OURS
 *   CLICS³ publishes forms and concepts and states no counts, so both values
 *   carry champollion-derived with Derived_From naming the release — the same
 *   rule as the PHOIBLE inventory sizes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter } from './values.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestClics3(db, spec = {}) {
  const { source = 'clics3', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);

  const file = path.join(DATA, source, 'clics.sqlite');
  if (!fs.existsSync(file)) {
    throw new Error(`${source}: clics.sqlite is missing. It is 408 MB and gitignored; re-fetch.`);
  }
  const clics = new Database(file, { readonly: true });

  // Distinct CONCEPTS per language, through Concepticon.
  const concepts = clics.prepare(`
    SELECT l.ISO639P3code AS iso, l.Glottocode AS glottocode,
           COUNT(DISTINCT p.Concepticon_ID) AS n
    FROM FormTable f
    JOIN ParameterTable p ON f.Parameter_ID = p.ID
    JOIN LanguageTable l ON f.Language_ID = l.ID
    WHERE p.Concepticon_ID IS NOT NULL AND p.Concepticon_ID != ''
    GROUP BY l.ID
  `).all();

  // Forms expressing TWO OR MORE distinct concepts — the colexifications.
  const colexifying = clics.prepare(`
    SELECT iso, glottocode, COUNT(*) AS n FROM (
      SELECT l.ISO639P3code AS iso, l.Glottocode AS glottocode, f.Form AS form,
             COUNT(DISTINCT p.Concepticon_ID) AS c
      FROM FormTable f
      JOIN ParameterTable p ON f.Parameter_ID = p.ID
      JOIN LanguageTable l ON f.Language_ID = l.ID
      WHERE p.Concepticon_ID IS NOT NULL AND p.Concepticon_ID != ''
        AND f.Form IS NOT NULL AND f.Form != ''
      GROUP BY l.ID, f.Form
      HAVING c >= 2
    ) GROUP BY iso, glottocode
  `).all();
  // The legacy panel's four other stats, same arithmetic as the retired
  // ingest (cli/scripts/ingest-clics3.mjs) so the public numbers keep their
  // meaning: distinct forms, total entries, contributing datasets, and
  // density = distinct concepts / distinct forms. Keyed like the two queries
  // above (per upstream language row, resolved onto the spine below); note
  // these count over Parameter_ID rather than Concepticon_ID — the legacy
  // basis — so density's numerator is the legacy unique_concepts, not
  // colexificationConcepts.
  const lexStats = clics.prepare(`
    SELECT l.ISO639P3code AS iso, l.Glottocode AS glottocode,
           COUNT(DISTINCT f.Form) AS unique_forms,
           COUNT(DISTINCT f.Parameter_ID) AS unique_concepts,
           COUNT(*) AS total_entries,
           COUNT(DISTINCT f.dataset_ID) AS contributing_datasets
    FROM FormTable f
    JOIN LanguageTable l ON f.Language_ID = l.ID AND f.dataset_ID = l.dataset_ID
    WHERE f.Form IS NOT NULL AND f.Form != ''
    GROUP BY l.ID
  `).all();
  clics.close();

  const spine = spineResolver(db);
  const key = (r) => spine.resolve(r.iso ?? '', r.glottocode ?? '');

  const conceptsBy = new Map();
  let offSpine = 0;
  for (const r of concepts) {
    const id = key(r);
    if (!id) { offSpine++; continue; }
    conceptsBy.set(id, (conceptsBy.get(id) ?? 0) + r.n);
  }
  const colexBy = new Map();
  for (const r of colexifying) {
    const id = key(r);
    if (!id) continue;
    colexBy.set(id, (colexBy.get(id) ?? 0) + r.n);
  }

  // The invariant, checked rather than trusted.
  const impossible = [...colexBy].filter(([id, n]) => n > (conceptsBy.get(id) ?? 0));
  if (impossible.length) {
    throw new Error(
      `${impossible.length} language(s) have more colexifying forms than attested concepts, `
      + `first ${impossible[0][0]} (${impossible[0][1]} > ${conceptsBy.get(impossible[0][0]) ?? 0}). `
      + 'A form colexifying n concepts requires n concepts to exist, so this is '
      + 'arithmetically impossible and means the join is wrong — which is exactly the '
      + 'defect the previous corpus shipped.',
    );
  }

  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-clics3.mjs',
  });

  const stats = { source, languages: conceptsBy.size, offSpine, asserted: 0, absence: 0 };

  db.transaction(() => {
    for (const [languageId, n] of conceptsBy) {
      for (const [parameter, value] of [
        ['colexificationConcepts', n],
        ['colexifyingForms', colexBy.get(languageId)],
      ]) {
        // A language with concepts but no colexifying form gets NO value rather
        // than a zero: CLICS³ covering it thinly and CLICS³ finding no
        // colexification are different situations, and a zero conflates them.
        if (value === undefined) continue;
        write(languageId, parameter, value, {
          confidence: 'derived', derivedFrom: upstream.id,
        });
        stats.asserted++;
      }
    }

    // The four legacy-panel stats. Aggregated across doculects per spine
    // language the same way the concept counts are (a Map sum), because one
    // language may appear as several upstream rows.
    const agg = new Map();
    for (const r of lexStats) {
      const id = key(r);
      if (!id) continue;
      if (!agg.has(id)) {
        agg.set(id, {
          unique_forms: 0, unique_concepts: 0, total_entries: 0, contributing_datasets: 0,
        });
      }
      const a = agg.get(id);
      a.unique_forms += r.unique_forms;
      a.unique_concepts += r.unique_concepts;
      a.total_entries += r.total_entries;
      a.contributing_datasets = Math.max(a.contributing_datasets, r.contributing_datasets);
    }
    for (const [languageId, a] of agg) {
      const density = a.unique_forms > 0
        ? (a.unique_concepts / a.unique_forms).toFixed(3) : null;
      for (const [parameter, value] of [
        ['clicsUniqueForms', a.unique_forms],
        ['clicsTotalEntries', a.total_entries],
        ['clicsContributingDatasets', a.contributing_datasets],
        ['colexificationDensity', density],
      ]) {
        if (value === null || value === 0) continue;
        write(languageId, parameter, value, {
          confidence: 'derived', derivedFrom: upstream.id,
        });
        stats.asserted++;
      }
    }
  })();

  return stats;
}
