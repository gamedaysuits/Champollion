/**
 * derive-orthographic-status.mjs (atlas edition) — positive evidence only.
 *
 * The legacy card derivation (cli/scripts/derive-orthographic-status.mjs) had
 * five rungs, and the fifth — "no script harvested → 'unwritten'" — asserted
 * 'unwritten' about 1,318 languages, 1,059 of them living, because WE had
 * failed to harvest a script. That rung is the canonical mistake this store's
 * Status column exists to end (see schema.mjs), and it stays dead:
 * retired-parameters.csv records the split. What returns here is the four
 * POSITIVE rungs, computed over signals already in the store, each cited:
 *
 *   1. cldrOfficialStatus 'Official' / 'Regional official' → standardized
 *   2. cldrOfficialStatus 'De facto official'              → de-facto-standard
 *   3. script + (any CLDR-sourced value OR a keyboard)     → has-orthography
 *   4. script alone                                        → developing
 *   (no script → NOTHING. Absence stays absence.)
 *
 * Runs AFTER ingest (all signal parameters populated) as a store-level
 * derivation: the synthesis is ours, so it carries champollion-derived with
 * Derived_From naming the signal releases it actually read for that language.
 */

import { valueWriter } from './values.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';

const STATUS_RANK = ['standardized', 'de-facto-standard', 'has-orthography', 'developing'];

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{asserted: number, byStatus: Record<string, number>}}
 */
export function deriveOrthographicStatus(db) {
  const derivedSource = registerDerivation(db);

  // Declare the vocabulary so an unlisted status is a build failure, and so
  // the projector can label the scale as ours.
  const insertCode = db.prepare(`
    INSERT INTO cldf_codes (ID, Parameter_ID, Name, Description, Source_Scale)
    VALUES (?, 'orthographicStatus', ?, ?, ?) ON CONFLICT(ID) DO NOTHING
  `);
  for (const name of STATUS_RANK) {
    insertCode.run(`orthographicStatus-${name}`, name, null, derivedSource);
  }

  const rows = db.prepare(`
    SELECT Subject_ID AS id, Parameter_ID AS param, Value, Source
      FROM cldf_values
     WHERE Subject_Type = 'language'
       AND Status = 'asserted'
       AND (Parameter_ID IN ('cldrOfficialStatus', 'script', 'keyboardResource')
            OR Source LIKE 'cldr-%')
  `).all();

  const signals = new Map();
  for (const r of rows) {
    if (!signals.has(r.id)) {
      signals.set(r.id, {
        official: new Set(), hasScript: false, hasKeyboard: false,
        inCldr: false, sources: new Set(),
      });
    }
    const s = signals.get(r.id);
    if (r.param === 'cldrOfficialStatus') { s.official.add(r.Value); s.sources.add(r.Source); }
    if (r.param === 'script') { s.hasScript = true; s.sources.add(r.Source); }
    if (r.param === 'keyboardResource') { s.hasKeyboard = true; s.sources.add(r.Source); }
    if (r.Source.startsWith('cldr-')) { s.inCldr = true; s.sources.add(r.Source); }
  }

  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/derive-orthographic-status.mjs',
  });

  const stats = { asserted: 0, byStatus: {} };
  db.transaction(() => {
    for (const [languageId, s] of signals) {
      let status = null;
      if (s.official.has('Official') || s.official.has('Regional official')) {
        status = 'standardized';
      } else if (s.official.has('De facto official')) {
        status = 'de-facto-standard';
      } else if (s.hasScript && (s.inCldr || s.hasKeyboard)) {
        status = 'has-orthography';
      } else if (s.hasScript) {
        status = 'developing';
      }
      if (!status) continue; // no positive signal → no claim. Never 'unwritten'.
      write(languageId, 'orthographicStatus', status, {
        codeId: `orthographicStatus-${status}`,
        confidence: 'derived',
        derivedFrom: [...s.sources].sort().join('; '),
      });
      stats.asserted++;
      stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
    }
  })();

  return stats;
}
