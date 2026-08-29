/**
 * spine.mjs — build LanguageTable from ISO 639-3 and Glottolog.
 *
 * THE CYCLE THIS BREAKS
 *   `ingest-base.mjs` used to populate `languages` FROM the cards, which made
 *   the foreign-key parent of every fact a projection of the fact store's own
 *   output. Nothing could be built from zero, and an error in a card became an
 *   error in the spine that then re-authorised the card.
 *
 *   The spine now comes from the two registries whose job is identity, and from
 *   nothing else. It is the one table that must be right before any value can
 *   be attached to anything.
 *
 * WHAT THE SPINE IS AND IS NOT
 *   It is a set of identifiers: which languages exist, by what codes, under
 *   whose authority. It is NOT a set of claims about them — those are values,
 *   with sources.
 *
 *   Name and coordinates are filled here because `languoid.csv` carries them
 *   alongside the identity columns and CLDF tooling expects a LanguageTable to
 *   have them. MACROAREA IS DELIBERATELY LEFT NULL: `languoid.csv` has no
 *   macroarea column — it lives in `glottolog-cldf`, a different release — so
 *   reading `row.macroarea` here would quietly yield null on every row and look
 *   like "Glottolog does not say", when in fact we asked the wrong file. It is
 *   projected from cldf_values by the `macroarea` parameter's declared
 *   Authority, like any other claim.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSVObjects } from '../lib/csv.mjs';
import { registerSource } from './ingest-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

const ISO_TAB = path.join(DATA, 'iso639-3', 'iso-639-3.tab');
const GLOTTOLOG_CSV = path.join(DATA, 'glottolog', 'languoid.csv');

/**
 * Read a SIL .tab file. These are tab-separated with a header row and no
 * quoting — a genuinely different format from the CLDF CSVs, so it gets its
 * own reader rather than being forced through the RFC-4180 one.
 */
function readTab(file) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

/**
 * Build the spine.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{total:number, fromIso:number, glottologOnly:number, retired:number}}
 */
export function buildSpine(db) {
  // The spine's own sources must be registered like any other, for two reasons.
  //
  // First, provenance: every LanguageTable ID here IS an ISO 639-3 code, so a
  // spine with no source row is a table of identifiers nobody can attribute.
  //
  // Second, and more sharply: SIL's ISO 639-3 terms permit incorporating the
  // codes into a system but forbid a product that "provide[s] a means to
  // redistribute the code set". A published LanguageTable of code + reference
  // name is very close to being the code set. Registering the release is what
  // makes that constraint VISIBLE to the release gate instead of being a thing
  // someone has to remember at publication time.
  registerSource(db, 'iso639-3');
  registerSource(db, 'glottolog');

  for (const [label, file] of [['ISO 639-3', ISO_TAB], ['Glottolog', GLOTTOLOG_CSV]]) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `The spine needs ${label} at ${path.relative(process.cwd(), file)} and it is not `
        + 'there. Fetch it first — a spine assembled from whatever happens to be on disk '
        + 'is how the previous corpus acquired 38 genera as languages.',
      );
    }
  }

  const iso = readTab(ISO_TAB);
  const { rows: glottolog } = parseCSVObjects(
    fs.readFileSync(GLOTTOLOG_CSV, 'utf-8'), { file: 'glottolog/languoid.csv' },
  );

  // Glottolog keyed by ISO code, so an ISO row can pick up its glottocode.
  const byIso = new Map();
  for (const g of glottolog) {
    if (g.iso639P3code) byIso.set(g.iso639P3code, g);
  }

  // Macroarea is absent by design — see the header note. It is projected from
  // cldf_values, not read from a column languoid.csv does not have.
  const insert = db.prepare(`
    INSERT INTO cldf_languages (ID, Name, Glottocode, ISO639P3code, Latitude, Longitude)
    VALUES (@ID, @Name, @Glottocode, @ISO639P3code, @Latitude, @Longitude)
    ON CONFLICT(ID) DO NOTHING
  `);

  const stats = { total: 0, fromIso: 0, glottologOnly: 0, retired: 0 };

  db.transaction(() => {
    for (const row of iso) {
      const code = row.Id;
      if (!code) continue;
      const g = byIso.get(code);
      insert.run({
        ID: code,
        Name: row.Ref_Name || null,
        Glottocode: g?.id ?? null,
        ISO639P3code: code,
        Latitude: g?.latitude ? Number(g.latitude) : null,
        Longitude: g?.longitude ? Number(g.longitude) : null,
      });
      stats.fromIso++;
    }

    // Glottolog languoids with no ISO code still exist and are still languages.
    // Excluding them would silently narrow the atlas to what SIL has registered.
    // Only level=language — families and dialects are not spine entries, which
    // is the bug that put 38 genera into the previous `languages` table.
    for (const g of glottolog) {
      if (g.level !== 'language') continue;
      if (g.iso639P3code && byIso.has(g.iso639P3code)) continue;
      insert.run({
        ID: g.id,
        Name: g.name || null,
        Glottocode: g.id,
        ISO639P3code: g.iso639P3code || null,
        Latitude: g.latitude ? Number(g.latitude) : null,
        Longitude: g.longitude ? Number(g.longitude) : null,
      });
      stats.glottologOnly++;
    }
  })();

  stats.total = db.prepare('SELECT COUNT(*) n FROM cldf_languages').get().n;
  return stats;
}

/**
 * A resolver from a dataset's own codes onto the spine.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *   Grambank ships Glottocode populated and ISO639P3code EMPTY on nearly every
 *   row. Taking the first non-empty field yields "abkh1244" where the spine
 *   holds "abk", so 429,446 of 441,663 values were discarded as "off-spine" —
 *   97% of the dataset, and it was reported as a coverage gap rather than a
 *   resolution bug.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function spineResolver(db) {
  const known = new Set();
  const byGlottocode = new Map();
  for (const r of db.prepare('SELECT ID, Glottocode FROM cldf_languages').all()) {
    known.add(r.ID);
    if (r.Glottocode) byGlottocode.set(r.Glottocode, r.ID);
  }

  // ── Retired ISO codes ─────────────────────────────────────────────────────
  // Published data does not update when SIL retires a code. 379 retired codes
  // are still in use across our pinned sources, and every row keyed on one was
  // being discarded as "off-spine" — 628 (code, source) pairs of real data
  // thrown away because a registry changed its mind after the dataset shipped.
  //
  // Where SIL names a successor we follow it. Where it does NOT — a code split
  // into several, or was found never to denote a language — there is nothing to
  // follow, and picking one of the successors would be manufacturing. Those
  // stay unresolved and are counted.
  const supersededBy = new Map();
  const retirementsFile = path.join(DATA, 'iso639-3', 'iso-639-3_Retirements.tab');
  if (fs.existsSync(retirementsFile)) {
    for (const r of readTab(retirementsFile)) {
      if (r.Change_To && known.has(r.Change_To)) supersededBy.set(r.Id, r.Change_To);
    }
  }

  return {
    size: known.size,
    supersededBy,
    /** @returns {string|null} the spine ID, or null if this row has no home */
    resolve(isoCode, glottocode) {
      if (isoCode && known.has(isoCode)) return isoCode;
      if (glottocode && byGlottocode.has(glottocode)) return byGlottocode.get(glottocode);
      if (glottocode && known.has(glottocode)) return glottocode;
      // Last, never first: a live code always wins over a retirement chain.
      if (isoCode && supersededBy.has(isoCode)) return supersededBy.get(isoCode);
      return null;
    },
  };
}
