/**
 * emit-forms.mjs — project the cldf_forms sidecar into per-language artifacts
 * for the public catalogue's vocabulary explorer.
 *
 * OUTPUT (under <out>/forms/):
 *   index.json      { _atlas, languages: { <code>: { forms, sources } } }
 *   <code>.json     the complete redistributable form list for one language:
 *                   { code, _atlas, totalForms, asjpOnly, sources[], items[] }
 *
 * ITEMS ARE COMPLETE. Every redistributable form is emitted — dedupe and
 * one-per-concept selection are PRESENTATION, and the explorer's "no
 * truncation" promise depends on the artifact carrying everything. Ordering
 * is deterministic: source priority (shared/cldf/lexical-source-priority.json
 * — display-ready orthography first, ASJP always last), then gloss, then
 * form, so a rebuild from identical pins is byte-identical.
 *
 * PER-LANGUAGE STREAMED QUERIES. Never a full-table sort in memory: 3.6M rows
 * is exactly the load project.mjs's `.all()` must never see (which is why the
 * sidecar exists), and this emitter must not reproduce that mistake one file
 * later.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRIORITY_FILE = path.join(
  __dirname, '..', '..', '..', 'shared', 'cldf', 'lexical-source-priority.json',
);

/** Strip the release pin off a source id: `ids-v4.3` → `ids`. */
function datasetKey(sourceId) {
  return sourceId.replace(/-v[\d.]+$/i, '').replace(/-[0-9a-f]{12}$/i, '');
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} out  the atlas build dir (build/atlas)
 * @param {{version: string, builtAt: string}} meta
 * @returns {{languages: number, forms: number, sources: number}}
 */
export function emitForms(db, out, { version, builtAt }) {
  const spec = JSON.parse(fs.readFileSync(PRIORITY_FILE, 'utf-8'));
  const rank = new Map(spec.priority.map((s, i) => [s, i]));
  const ASJP_RANK = spec.priority.length + 10_000;
  const CATCHALL_RANK = spec.priority.length;
  const rankOf = (key) => (key === spec.asjpLast ? ASJP_RANK : (rank.get(key) ?? CATCHALL_RANK));
  const displayTypeOf = (key) => spec.displayTypes[key] ?? spec.defaultDisplayType;

  const dir = path.join(out, 'forms');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const languages = db.prepare(
    'SELECT DISTINCT Language_ID FROM cldf_forms ORDER BY Language_ID',
  ).all().map((r) => r.Language_ID);

  const sourceMeta = new Map(db.prepare(`
    SELECT s.ID, s.License, s.License_URL, s.URL, s.DOI, s.Commercial_Use
      FROM cldf_sources s
     WHERE s.ID IN (SELECT DISTINCT Source FROM cldf_forms)
  `).all().map((s) => [s.ID, s]));

  const perLanguage = db.prepare(`
    SELECT Source, Doculect, Gloss, Concepticon_ID, Concepticon_Gloss, Form, Comment
      FROM cldf_forms
     WHERE Language_ID = ?
  `);

  const index = { _atlas: { version, builtAt }, languages: {} };
  let totalForms = 0;

  for (const code of languages) {
    const rows = perLanguage.all(code);
    const items = rows.map((r) => {
      const key = datasetKey(r.Source);
      return {
        concept: (r.Concepticon_Gloss ?? r.Gloss).toLowerCase(),
        concepticon: r.Concepticon_ID ?? null,
        gloss: r.Gloss,
        form: r.Form,
        source: r.Source,
        displayType: displayTypeOf(key),
        ...(r.Doculect ? { doculect: r.Doculect } : {}),
        ...(r.Comment ? { comment: r.Comment } : {}),
        _rank: rankOf(key),
      };
    });
    items.sort((a, b) => a._rank - b._rank
      || a.concept.localeCompare(b.concept)
      || a.form.localeCompare(b.form)
      || a.source.localeCompare(b.source));
    for (const it of items) delete it._rank;

    const sourceIds = [...new Set(items.map((i) => i.source))];
    const sources = sourceIds.map((id) => {
      const m = sourceMeta.get(id);
      return {
        id,
        dataset: datasetKey(id),
        license: m?.License ?? null,
        licenseUrl: m?.License_URL ?? null,
        url: m?.DOI ?? m?.URL ?? null,
        commercialUse: m ? m.Commercial_Use === 1 : null,
        displayType: displayTypeOf(datasetKey(id)),
      };
    });

    const doc = {
      code,
      _atlas: { version, builtAt },
      totalForms: items.length,
      asjpOnly: items.length > 0 && items.every((i) => i.displayType === 'asjp-phonetic'),
      sources,
      items,
    };
    fs.writeFileSync(path.join(dir, `${code}.json`), `${JSON.stringify(doc)}\n`);
    index.languages[code] = { forms: items.length, sources: sourceIds.length };
    totalForms += items.length;
  }

  fs.writeFileSync(path.join(dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  return {
    languages: languages.length,
    forms: totalForms,
    sources: sourceMeta.size,
  };
}
