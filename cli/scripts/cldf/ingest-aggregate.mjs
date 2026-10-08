/**
 * ingest-aggregate.mjs — counts we compute over a source, as OUR claims.
 *
 * WHY THIS IS A SEPARATE LANE
 *   PHOIBLE publishes one ValueTable row per SEGMENT — 105,466 rows saying "this
 *   inventory contains /a/", "this inventory contains /pʰ/". It never states a
 *   consonant count anywhere. So `consonantCount: 31` is not something PHOIBLE
 *   says; it is something WE counted.
 *
 *   CLAUDE.md is explicit about what follows: "Any value Champollion computes —
 *   aggregates, composites, recodings, counts extracted from a dataset (e.g.
 *   PHOIBLE medians) — is a Champollion derivation, not an assertion by the
 *   upstream dataset. Writing it under the dataset's `source` name
 *   misrepresents that dataset and breaks license passthrough."
 *
 *   The registry originally had these as `direct` from `phoible`. That was the
 *   project's own rule broken in its own rebuild, which is exactly how the
 *   previous corpus got the way it did.
 *
 * WHAT A DERIVED VALUE MUST CARRY
 *   Source        champollion-derived-<derivationVersion>, never the upstream
 *   Derived_From  the upstream RELEASE it was computed over, so the count can
 *                 be recomputed and invalidated when that release changes
 *   Confidence    'derived' — it is arithmetic over someone else's data, which
 *                 is neither their assertion nor an independent observation
 *
 *   The derivation version is bumped when the ARITHMETIC changes. Without it a
 *   card could silently change meaning while claiming the same basis: "31
 *   consonants (PHOIBLE 2.0)" means something different if we started counting
 *   marginal segments.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCSVObjects } from '../lib/csv.mjs';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * Bumped when the arithmetic changes, NOT when the upstream data does.
 * A card claiming "derived-v1" must always mean the same computation.
 */
export const DERIVATION_VERSION = 'v1';
const DERIVED_SOURCE = `champollion-derived-${DERIVATION_VERSION}`;

/** Register the derivation itself as a source, so derived values have a release. */
export function registerDerivation(db) {
  db.prepare(`
    INSERT INTO cldf_sources
      (ID, BibTeX_Type, Title, Version, License, CLDF_Module, Redistributable, Commercial_Use)
    VALUES (?, 'misc', ?, ?, 'CC-BY-4.0', NULL, 1, 1)
    ON CONFLICT(ID) DO NOTHING
  `).run(
    DERIVED_SOURCE,
    'Champollion derivations — values computed by Champollion over cited upstream releases',
    DERIVATION_VERSION,
  );
  return DERIVED_SOURCE;
}

/**
 * Count a source's ValueTable rows per language, grouped by a column of its
 * ParameterTable, and emit the counts as Champollion derivations.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} spec
 * @param {string} spec.source
 * @param {string} spec.groupBy            - ParameterTable column to group on (e.g. SegmentClass)
 * @param {Record<string,string>} spec.counts - group value → our parameter ID
 * @param {Record<string,{from:string[], as:string}>} [spec.totals] - sums over the above
 * @param {Record<string,{from:string, as:string}>} [spec.presence] - booleans over the above
 */
export function ingestAggregate(db, spec) {
  const { source, groupBy, counts, totals = {}, presence = {}, license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  if (upstream.noDerivatives) {
    throw new Error(
      `${source} is ${upstream.license} — no-derivatives. A COUNT over its data is a `
      + 'derivative work, so it must not be computed or stored.',
    );
  }
  const derivedSource = registerDerivation(db);

  const read = (name) => parseCSVObjects(
    fs.readFileSync(path.join(dir, `${name}.csv`), 'utf-8'), { file: `${source}/${name}.csv` },
  ).rows;

  const parameters = read('parameters');
  const values = read('values');
  const languages = read('languages');

  // Which group each upstream parameter belongs to.
  const groupOf = new Map(parameters.map((p) => [p.ID, (p[groupBy] ?? '').trim()]));
  if ([...groupOf.values()].every((g) => !g)) {
    throw new Error(
      `${source}/parameters.csv has no usable "${groupBy}" column, so every count would `
      + 'be zero. A silent zero is indistinguishable from a real absence.',
    );
  }

  const spine = spineResolver(db);
  const toSpine = new Map();
  for (const l of languages) {
    const id = spine.resolve(l.ISO639P3code ?? '', l.Glottocode ?? '');
    if (id) toSpine.set(l.ID, id);
  }

  // language → group → count. Distinct parameters, not rows: PHOIBLE can carry
  // the same segment twice for one language across contributing inventories,
  // and counting rows would inflate the inventory.
  const perLanguage = new Map();
  let offSpine = 0;
  for (const row of values) {
    const languageId = toSpine.get(row.Language_ID);
    if (!languageId) { offSpine++; continue; }
    const group = groupOf.get(row.Parameter_ID);
    if (!group || !counts[group]) continue;
    if (!perLanguage.has(languageId)) perLanguage.set(languageId, new Map());
    const groups = perLanguage.get(languageId);
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group).add(row.Parameter_ID);
  }

  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-aggregate.mjs',
  });

  const stats = { source, languages: perLanguage.size, offSpine, written: 0 };

  db.transaction(() => {
    for (const [languageId, groups] of perLanguage) {
      const emitted = new Map();

      for (const [group, parameterId] of Object.entries(counts)) {
        const size = groups.get(group)?.size ?? 0;
        // Zero is only meaningful when the language HAS an inventory here. A
        // language PHOIBLE does not cover is absent, not a language with no
        // consonants, and the two must never look alike.
        if (!groups.size) continue;
        emitted.set(parameterId, size);
      }

      for (const [parameterId, sum] of Object.entries(totals)) {
        const parts = sum.from.map((k) => emitted.get(k) ?? 0);
        if (!parts.length) continue;
        emitted.set(parameterId, parts.reduce((a, b) => a + b, 0));
      }

      for (const [parameterId, p] of Object.entries(presence)) {
        if (!emitted.has(p.from)) continue;
        emitted.set(parameterId, emitted.get(p.from) > 0 ? '1' : '0');
      }

      for (const [parameterId, value] of emitted) {
        write(languageId, parameterId, value, {
          confidence: 'derived', derivedFrom: upstream.id,
        });
        stats.written++;
      }
    }
  })();

  return stats;
}
