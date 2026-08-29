/**
 * forms.mjs — the ONE way anything writes a lexical form into the atlas.
 *
 * Mirrors valueWriter's discipline (values.mjs) for the forms sidecar:
 * content-derived identity so a rebuild from identical pins produces identical
 * rows, ON CONFLICT DO NOTHING so re-ingest is idempotent, and a writer that
 * refuses to exist without a pinned source.
 *
 * Deliberately NOT a widening of valueWriter: a form is not a fact about a
 * language (see the cldf_forms DDL comment in schema.mjs and the policy header
 * in ingest-lexical.mjs). Keeping the writers separate is what keeps the card
 * pipeline honest — nothing that projects cards can accidentally read forms.
 */

import { createHash } from 'node:crypto';

/**
 * The identity of a form: the columns that make it the same attestation.
 * Display metadata (source priority, render type) is declared per-source data
 * and never part of identity.
 */
export function formId({ source, languageId, doculect, gloss, form }) {
  return createHash('sha256')
    .update([source, languageId, doculect ?? '', gloss, form].join('|'))
    .digest('hex').slice(0, 24);
}

/**
 * Build a form writer bound to one pinned source release.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {string} opts.sourceId  the pinned release these forms came from
 * @returns {(row: {languageId: string, doculect?: string|null, gloss: string,
 *                  concepticonId?: string|null, concepticonGloss?: string|null,
 *                  form: string, comment?: string|null}) => boolean}
 */
export function formWriter(db, { sourceId }) {
  if (!sourceId) {
    throw new Error('formWriter needs a sourceId — a form with no release is not an attestation');
  }
  const insert = db.prepare(`
    INSERT INTO cldf_forms
      (ID, Language_ID, Source, Doculect, Gloss, Concepticon_ID, Concepticon_Gloss, Form, Comment)
    VALUES (@ID, @Language_ID, @Source, @Doculect, @Gloss, @Concepticon_ID, @Concepticon_Gloss,
            @Form, @Comment)
    ON CONFLICT DO NOTHING
  `);

  return function write(row) {
    const gloss = (row.gloss ?? '').trim();
    const form = (row.form ?? '').trim();
    if (!row.languageId || !gloss || !form) return false;
    const doculect = row.doculect ?? null;
    const result = insert.run({
      ID: formId({ source: sourceId, languageId: row.languageId, doculect, gloss, form }),
      Language_ID: row.languageId,
      Source: sourceId,
      Doculect: doculect,
      Gloss: gloss,
      Concepticon_ID: row.concepticonId || null,
      Concepticon_Gloss: row.concepticonGloss || null,
      Form: form,
      Comment: row.comment || null,
    });
    return result.changes > 0;
  };
}
