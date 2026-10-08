/**
 * ingest-lexical.mjs — CLDF Wordlist and Dictionary → resource existence.
 *
 * WHAT THESE MODULES ARE, AND WHAT THEY ARE NOT EVIDENCE OF
 *   161 of our 203 pinned sources declare one of these two: 145 Wordlist
 *   (a FormTable of language × concept × form — ASJP, IDS, ABVD, NorthEuraLex,
 *   the Lexibank ecosystem) and 16 Dictionary (an EntryTable of headwords with
 *   senses).
 *
 *   They are the largest datasets we hold and the most tempting to mine, and
 *   almost nothing in them belongs on a language card. A wordlist says how a
 *   language expresses a concept. It does NOT say the language has SOV order,
 *   twelve vowels, or tone. Deriving typology from a wordlist would be
 *   manufacturing, and at this scale it would be manufacturing nobody could
 *   audit.
 *
 *   What they DO tell an MT practitioner is exactly the question this project
 *   exists to answer: is there lexical data for this language, how much of it,
 *   and where do I get it? So each yields one kind of claim — a RESOURCE
 *   EXISTS, of this size, at this DOI — recorded once per (language, dataset)
 *   under a SINGLE parameter with the dataset in Variant.
 *
 *   One parameter, not 161 boolean fields. "Not a bazillion different fields
 *   that all mean the same thing" bites hardest exactly where the temptation is
 *   greatest.
 *
 * ONE HANDLER, TWO MODULES, DECLARED DIFFERENCES
 *   The modules differ only in which table holds the unit and what the unit is
 *   called. Writing two near-identical handlers would mean two places to fix
 *   the next bug, so the difference is data: which table, which column counts
 *   as a "concept", and what the resulting number is called on the card.
 *
 * THE COUNTS ARE OURS
 *   A concept or entry count is arithmetic over someone else's table, so it
 *   carries champollion-derived with Derived_From naming the release — the same
 *   rule as the PHOIBLE inventory counts, for the same reason.
 *
 * THE FORMS SIDECAR (added 2026-08)
 *   The claims above stand: nothing typological is derived from a wordlist,
 *   and no per-form data becomes a card field. But the public catalogue's
 *   vocabulary explorer legitimately shows the forms themselves, and it used
 *   to get them from an unpinned store (champollion.db, 3.1M lexical rows,
 *   every release pin NULL) that nobody could re-derive. Forms therefore live
 *   in `cldf_forms` — a sidecar keyed to pinned releases, written by a second
 *   pass over the same rows this handler already reads (ingest-forms.mjs),
 *   only where the license permits REDISTRIBUTION (a stronger claim than
 *   counting — withheld sources keep their counts, loudly), never entering
 *   cldf_values, never projected onto a card. A card still says "a resource
 *   exists"; the sidecar is the resource's contents, served beside the card,
 *   cited the same way.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCSVObjects } from '../lib/csv.mjs';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter, VARIANT } from './values.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { ingestForms } from './ingest-forms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * How each module stores its lexical units. Declared here rather than sniffed,
 * so a source whose shape does not match fails loudly instead of counting zero.
 */
const SHAPES = {
  Wordlist: {
    table: 'forms',
    unit: 'forms',
    groupColumn: 'Parameter_ID',
    groupName: 'concepts',
    parameter: 'lexicalResource',
  },
  Dictionary: {
    table: 'entries',
    unit: 'entries',
    groupColumn: null,
    groupName: null,
    parameter: 'dictionaryResource',
  },
};

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} spec
 * @param {string} spec.source
 * @param {string} spec.module - Wordlist or Dictionary
 * @param {string} [spec.license] - checked against the SNAPSHOT
 */
export function ingestLexical(db, spec) {
  const {
    source, module, license: declaredLicense = null, languageTableColumns = {},
  } = spec;
  const shape = SHAPES[module];
  if (!shape) {
    throw new Error(`${source}: ingest-lexical has no shape for module "${module}".`);
  }
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  if (upstream.noDerivatives) {
    throw new Error(
      `${source} is ${upstream.license} — no-derivatives. Record abstracted metadata `
      + 'about the resource instead; do not count over its content.',
    );
  }
  const derivedSource = registerDerivation(db);

  const read = (name) => {
    const file = path.join(dir, `${name}.csv`);
    if (!fs.existsSync(file)) return null;
    return parseCSVObjects(fs.readFileSync(file, 'utf-8'), { file: `${source}/${name}.csv` }).rows;
  };

  const languages = read('languages') ?? [];
  const units = read(shape.table);
  if (units === null) {
    throw new Error(
      `${source} declares the ${module} module but has no ${shape.table}.csv. Either the `
      + 'fetch is incomplete or the module declaration is wrong; both need a human, and '
      + 'neither should silently produce a coverage count of zero.',
    );
  }

  const spine = spineResolver(db);
  const toSpine = new Map();
  let unresolvable = 0;
  for (const l of languages) {
    const id = spine.resolve(l.ISO639P3code ?? '', l.Glottocode ?? '');
    if (id) toSpine.set(l.ID, id);
    else unresolvable++;
  }

  // A dataset often holds several doculects for one language. From a
  // practitioner's point of view they are one resource, so they aggregate — but
  // how many there are is worth keeping, because five independent wordlists is
  // a different situation from one.
  const perLanguage = new Map();
  let offSpine = 0;
  for (const row of units) {
    const id = toSpine.get(row.Language_ID);
    if (!id) { offSpine++; continue; }
    if (!perLanguage.has(id)) {
      perLanguage.set(id, { count: 0, groups: new Set(), doculects: new Set() });
    }
    const acc = perLanguage.get(id);
    acc.count++;
    acc.doculects.add(row.Language_ID);
    if (shape.groupColumn && row[shape.groupColumn]) acc.groups.add(row[shape.groupColumn]);
  }

  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-lexical.mjs',
  });

  const stats = {
    source, module, languages: perLanguage.size, offSpine, unresolvable,
    written: 0, unitsRead: units.length,
  };

  db.transaction(() => {
    for (const [languageId, acc] of perLanguage) {
      const value = JSON.stringify({
        dataset: source,
        [shape.unit]: acc.count,
        ...(shape.groupName ? { [shape.groupName]: acc.groups.size } : {}),
        ...(acc.doculects.size > 1 ? { doculects: acc.doculects.size } : {}),
        // Carried onto the value itself, because a practitioner deciding whether
        // they may use a resource should not have to go and look it up.
        ...(upstream.commercial ? {} : { commercialUse: false }),
        release: upstream.id,
      });
      // The dataset is the discriminator: this is what lets ONE parameter carry
      // every wordlist instead of one field per source.
      write(languageId, shape.parameter, value, {
        variantType: VARIANT.CORPUS,
        variantId: source,
        confidence: 'derived',
        derivedFrom: upstream.id,
      });
      stats.written++;
    }
  })();

  // ── Forms sidecar (second pass; see THE FORMS SIDECAR above) ──────────────
  const formStats = ingestForms(db, {
    source, dir, module, units, toSpine, upstream,
  });
  Object.assign(stats, formStats);

  // ── Declared LanguageTable columns ────────────────────────────────────────
  // A Wordlist can still carry a per-language FACT on its languages.csv.
  // Chan's numeral database is a Wordlist whose languages.csv has a `Base`
  // column — the numeral system itself. Taken VERBATIM: 52% of its rows are
  // empty, and empty means empty. A previous generator filled those in and
  // invented 2,005 base types, flattening binary, body-tally and
  // quinary-vigesimal to "decimal" — destroying exactly the systems that
  // change what an MT pipeline has to do.
  const columns = Object.entries(languageTableColumns);
  if (columns.length) {
    // The upstream's OWN column, so this is its assertion and carries its
    // release — unlike the counts above, which are ours.
    const putColumn = valueWriter(db, {
      sourceId: upstream.id, createdBy: 'cldf/ingest-lexical.mjs',
    });
    stats.fromLanguageTable = 0;
    stats.emptyInSource = 0;
    db.transaction(() => {
      for (const l of languages) {
        const languageId = toSpine.get(l.ID);
        if (!languageId) continue;
        for (const [column, parameter] of columns) {
          const raw = (l[column] ?? '').trim();
          if (!raw) { stats.emptyInSource++; continue; }
          putColumn(languageId, parameter, raw);
          stats.fromLanguageTable++;
        }
      }
    })();
  }

  return stats;
}
