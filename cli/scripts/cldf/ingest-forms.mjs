/**
 * ingest-forms.mjs — the forms pass of the lexical ingest.
 *
 * Called from ingestLexical (ingest-lexical.mjs) as a SECOND pass over the
 * same rows the aggregate pass already read — same verify(), same
 * registerSource(), same spine map, so a form can never cite a release the
 * counts did not come from.
 *
 * LICENSE GATE (the new, stronger claim): the aggregate pass counts over a
 * source's content, which needs only no-derivatives clearance. Showing the
 * forms themselves IS redistribution, so forms are written only when the
 * pinned release is Redistributable. Withheld sources still get their counts,
 * and the withholding is reported per source — never silent.
 *
 * CONCEPT NORMALIZATION: the dataset's OWN ParameterTable is the mapping —
 * lexibank datasets ship Concepticon_ID/Concepticon_Gloss columns on
 * parameters.csv, which is the upstream's assertion, not ours. Where a dataset
 * maps a concept to nothing (e.g. most of ACD's free-text glosses), the raw
 * gloss is kept verbatim with a NULL Concepticon_ID; nothing is manufactured.
 * The mapped/unmapped ratio is reported so a broken ParameterTable read shows
 * up as numbers, not silence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseCSVObjects } from '../lib/csv.mjs';
import { formWriter } from './forms.mjs';

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} ctx  everything the aggregate pass already established
 * @param {string} ctx.source        dataset key (directory name)
 * @param {string} ctx.dir           dataset directory
 * @param {string} ctx.module       'Wordlist' | 'Dictionary'
 * @param {Array<Record<string,string>>} ctx.units  forms.csv / entries.csv rows
 * @param {Map<string,string>} ctx.toSpine  upstream Language_ID → spine code
 * @param {{id: string, redistributable: boolean, license: string}} ctx.upstream
 * @returns {{formsWritten: number, formsWithheldByLicense: number,
 *            conceptsMapped: number, conceptsUnmapped: number}}
 */
export function ingestForms(db, { source, dir, module, units, toSpine, upstream }) {
  const stats = {
    formsWritten: 0, formsWithheldByLicense: 0, conceptsMapped: 0, conceptsUnmapped: 0,
  };

  if (!upstream.redistributable) {
    // Counts yes, contents no. Reported by the caller as
    // `forms withheld: <license>` so the hole in the vocabulary explorer is a
    // stated licensing outcome rather than a mystery.
    stats.formsWithheldByLicense = units.length;
    return stats;
  }

  // The dataset's own concept table: Parameter_ID → {name, concepticon}.
  const params = new Map();
  const paramsFile = path.join(dir, 'parameters.csv');
  if (fs.existsSync(paramsFile)) {
    const rows = parseCSVObjects(fs.readFileSync(paramsFile, 'utf-8'),
      { file: `${source}/parameters.csv` }).rows;
    for (const p of rows) {
      params.set(p.ID, {
        name: (p.Name ?? '').trim(),
        concepticonId: (p.Concepticon_ID ?? '').trim() || null,
        concepticonGloss: (p.Concepticon_Gloss ?? '').trim() || null,
      });
    }
  }

  // Dictionary senses: Entry_ID → first Description, the entry's gloss.
  const senses = new Map();
  if (module === 'Dictionary') {
    const sensesFile = path.join(dir, 'senses.csv');
    if (fs.existsSync(sensesFile)) {
      const rows = parseCSVObjects(fs.readFileSync(sensesFile, 'utf-8'),
        { file: `${source}/senses.csv` }).rows;
      for (const s of rows) {
        const entryId = s.Entry_ID ?? s.Entry_IDs;
        if (entryId && !senses.has(entryId)) {
          senses.set(entryId, (s.Description ?? s.Name ?? '').trim());
        }
      }
    }
  }

  const write = formWriter(db, { sourceId: upstream.id });

  db.transaction(() => {
    for (const row of units) {
      const languageId = toSpine.get(row.Language_ID);
      if (!languageId) continue; // off-spine, already tallied by the aggregate pass

      let gloss; let concepticonId = null; let concepticonGloss = null; let form;
      if (module === 'Wordlist') {
        const p = params.get(row.Parameter_ID);
        gloss = p?.name || row.Parameter_ID;
        concepticonId = p?.concepticonId ?? null;
        concepticonGloss = p?.concepticonGloss ?? null;
        form = row.Form ?? row.Value;
      } else {
        form = row.Headword ?? row.Form ?? row.Value;
        gloss = senses.get(row.ID) || (row.Description ?? '').trim();
      }
      if (!gloss || !form) continue;

      if (concepticonId) stats.conceptsMapped++;
      else stats.conceptsUnmapped++;

      const doculect = row.Language_ID && toSpine.get(row.Language_ID) !== row.Language_ID
        ? row.Language_ID : null;
      if (write({
        languageId,
        doculect,
        gloss,
        concepticonId,
        concepticonGloss,
        form,
        comment: (row.Comment ?? '').trim() || null,
      })) {
        stats.formsWritten++;
      }
    }
  })();

  return stats;
}
