/**
 * Layer 0 — Base Language Ingestion (the spine)
 *
 * Populates the `languages` table DIRECTLY FROM UPSTREAM: the SIL ISO 639-3
 * code tables and the Glottolog languoid table.
 *
 * WHY THIS WAS REWRITTEN (2026-08-02)
 *   It used to read `cli/shared/language-cards/`. Its own header said so:
 *   "Populates the languages table from existing v1 language cards… the
 *   simplest migration path into the normalized v2 database."
 *
 *   That made `languages` — the foreign-key parent of all 3.97M rows in
 *   `facts` — a PROJECTION OF THE CARDS. And the cards are meant to be a
 *   projection of the facts. The dependency ran:
 *
 *       cards → languages → facts → (2 scripts) → cards
 *
 *   A cycle, with the fact store's own spine downstream of its own output. It
 *   is a large part of why cards cannot be built from zero: the database needs
 *   the cards the database is supposed to produce. It also pulled the 38
 *   abstract `genera/` templates in as if they were languages, which is the
 *   entire 8,716-vs-8,678 discrepancy.
 *
 *   The spine now comes from the two registries that actually define what a
 *   language IS, and nothing here reads a card.
 *
 * SCOPE — deliberately the full universe, not a curated set
 *   ISO 639-3 individual + macro languages, UNION Glottolog level=language.
 *   Which of those earn a PUBLISHED CARD is a scope decision (`cardClass`,
 *   Phase D), not an ingestion one. Deciding it here would bury a policy choice
 *   inside a loader — which is how `isoScope: "I"` came to be asserted about
 *   751 languoids ISO has never coded.
 *
 *   Excluded: Glottolog `family` and `dialect` levels (a family is not a
 *   language; a dialect is a variety of one already present) and ISO scope=S
 *   (zxx, mis, mul, und — not languages).
 *
 * Usage:
 *   node cli/scripts/ingest-base.mjs [--dry-run]
 *
 * @module ingest-base
 */

import { openDatabase } from './db.mjs';
import { parseCSVObjects } from './lib/csv.mjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const ISO_TAB = join(DATA, 'iso639-3', 'iso-639-3.tab');
const GLOTTOLOG_CSV = join(DATA, 'glottolog', 'languoid.csv');

const DRY_RUN = process.argv.includes('--dry-run');

/** A pinned release from a source's SNAPSHOT.json, if one exists yet. */
function readSnapshot(dir) {
  const p = join(DATA, dir, 'SNAPSHOT.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function requireFile(path, what) {
  if (!existsSync(path)) {
    console.error(`ERROR: ${what} not found at ${path}`);
    console.error('The spine is built FROM SOURCE. Fetch it first — this script will not');
    console.error('fall back to reading cards; that dependency is what created the cycle.');
    process.exit(2);
  }
}

function main() {
  console.log('Layer 0 — base language spine (from ISO 639-3 + Glottolog)\n');
  requireFile(ISO_TAB, 'ISO 639-3 code table');
  requireFile(GLOTTOLOG_CSV, 'Glottolog languoid table');

  // ── ISO 639-3: the code registry ─────────────────────────────────────────
  // Tab-separated: Id, Part2b, Part2t, Part1, Scope, Language_Type, Ref_Name, Comment
  const isoLines = readFileSync(ISO_TAB, 'utf-8').split('\n').filter(Boolean);
  const isoHeader = isoLines[0].split('\t');
  const iso = new Map();
  const scopes = {};
  for (const line of isoLines.slice(1)) {
    const f = line.split('\t');
    const row = Object.fromEntries(isoHeader.map((h, i) => [h, (f[i] ?? '').trim()]));
    if (!row.Id) continue;
    if (row.Scope === 'S') continue;          // zxx/mis/mul/und — not languages
    iso.set(row.Id, row);
    scopes[row.Scope] = (scopes[row.Scope] ?? 0) + 1;
  }

  // ── Glottolog: classification, genealogy, geography ──────────────────────
  // parseCSVObjects returns { header, rows } — the RFC-4180 reader that
  // replaced the line-based one after the 2026-07-19 multiline-CSV damage.
  const { rows: glottoRows } = parseCSVObjects(
    readFileSync(GLOTTOLOG_CSV, 'utf-8'), { file: 'glottolog/languoid.csv' },
  );
  const byGlottocode = new Map();
  const glottoByIso = new Map();
  let glottoLanguages = 0;
  for (const r of glottoRows) {
    byGlottocode.set(r.id, r);
    if (r.level === 'language') {
      glottoLanguages++;
      if (r.iso639P3code) glottoByIso.set(r.iso639P3code, r);
    }
  }

  /** Walk parent_id up to the root, collecting the ancestry path. */
  const ancestryOf = (node) => {
    const path = [];
    const seen = new Set();
    let cur = node;
    while (cur?.parent_id && !seen.has(cur.parent_id)) {
      seen.add(cur.parent_id);
      const parent = byGlottocode.get(cur.parent_id);
      if (!parent) break;
      path.unshift(parent.name);
      cur = parent;
    }
    return path.length ? path : null;
  };

  const familyOf = (node) => {
    if (!node?.family_id) return { family: null, familyGlottocode: null };
    const fam = byGlottocode.get(node.family_id);
    return { family: fam ? fam.name : null, familyGlottocode: node.family_id };
  };

  const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
  const countryList = (v) => (v ? v.split(/\s+/).filter(Boolean) : null);

  // ── The union ────────────────────────────────────────────────────────────
  const spine = new Map();

  for (const [code, row] of iso) {
    const g = glottoByIso.get(code) ?? null;
    const { family, familyGlottocode } = familyOf(g);
    spine.set(code, {
      code,
      name: row.Ref_Name,
      iso639_3: code,
      glottocode: g?.id ?? null,
      bcp47: row.Part1 || code,
      family,
      familyGlottocode,
      genus: null,
      genusGlottocode: g?.parent_id || null,
      ancestry: g ? ancestryOf(g) : null,
      macroarea: null,          // Glottolog CLDF carries it; a later extractor's job
      lat: num(g?.latitude),
      lng: num(g?.longitude),
      countries: countryList(g?.country_ids),
      isIsolate: Boolean(g && g.family_id === ''),
      source: 'sil-iso639-3 + glottolog',
    });
  }

  // ── ISO retirements ──────────────────────────────────────────────────────
  //
  // 307 Glottolog languages cite an ISO code that is NOT in the current table.
  // 297 of those are RETIRED codes, and many were retired by merging into a
  // code that is already in the spine (acc→acr, adp→dzo). Admitting them as
  // separate entries would duplicate a language under two identities — the
  // split-identity defect, manufactured by the loader.
  //
  // So: retired WITH a Change_To that resolves into the spine → the same
  // language, already present; skip and record the old code as an alias.
  // Retired with no remedy (174 have none — split or non-existent) → ISO no
  // longer codes it but Glottolog still treats it as a language; keep.
  const RETIRE_TAB = join(DATA, 'iso639-3', 'iso-639-3_Retirements.tab');
  const retiredTo = new Map();
  const retiredRow = new Map();   // full row, for reporting codes we still carry
  if (existsSync(RETIRE_TAB)) {
    const lines = readFileSync(RETIRE_TAB, 'utf-8').split('\n').filter(Boolean);
    const rh = lines[0].split('\t');
    for (const line of lines.slice(1)) {
      const f = line.split('\t');
      const row = Object.fromEntries(rh.map((h, i) => [h, (f[i] ?? '').trim()]));
      if (!row.Id) continue;
      retiredTo.set(row.Id, row.Change_To || null);
      retiredRow.set(row.Id, row);
    }
  } else {
    console.warn('  ⚠ retirements table absent — retired codes cannot be resolved');
  }

  const aliases = new Map();   // current code -> [retired codes it absorbed]
  let mergedAway = 0;

  // Glottolog languages ISO has never coded (or no longer codes). Present so
  // the spine is the full universe; whether any earns a card is Phase D.
  let glottologOnly = 0;
  for (const r of glottoRows) {
    if (r.level !== 'language') continue;
    if (r.iso639P3code && spine.has(r.iso639P3code)) continue;
    if (spine.has(r.id)) continue;

    if (r.iso639P3code && retiredTo.has(r.iso639P3code)) {
      const changeTo = retiredTo.get(r.iso639P3code);
      if (changeTo && spine.has(changeTo)) {
        // Same language, current code already in the spine.
        if (!aliases.has(changeTo)) aliases.set(changeTo, []);
        aliases.get(changeTo).push(r.iso639P3code);
        mergedAway++;
        continue;
      }
    }
    const { family, familyGlottocode } = familyOf(r);
    spine.set(r.id, {
      code: r.id,
      name: r.name,
      iso639_3: null,
      glottocode: r.id,
      bcp47: null,
      family,
      familyGlottocode,
      genus: null,
      genusGlottocode: r.parent_id || null,
      ancestry: ancestryOf(r),
      macroarea: null,
      lat: num(r.latitude),
      lng: num(r.longitude),
      countries: countryList(r.country_ids),
      isIsolate: r.family_id === '',
      source: 'glottolog',
    });
    glottologOnly++;
  }

  console.log(`  ISO 639-3 languages       : ${iso.size.toLocaleString()}   (${
    Object.entries(scopes).sort().map(([k, v]) => `${k}=${v}`).join('  ')})`);
  console.log(`  Glottolog level=language  : ${glottoLanguages.toLocaleString()}`);
  console.log(`  …not in the ISO table     : ${glottologOnly.toLocaleString()}`);
  console.log(`  merged away (retired→current): ${mergedAway.toLocaleString()}`);
  console.log(`  SPINE TOTAL               : ${spine.size.toLocaleString()}`);
  console.log('\n  Excluded by design: Glottolog family/dialect levels, ISO scope=S, and');
  console.log('  the 38 genera/ card templates the old card-reading loader inserted as');
  console.log('  languages (the 8,716-vs-8,678 discrepancy).');
  if (mergedAway) {
    const sample = [...aliases].slice(0, 4)
      .map(([cur, old]) => `${old.join(',')}→${cur}`).join('  ');
    console.log(`\n  ${mergedAway} retired ISO code(s) resolved into the language that absorbed`);
    console.log(`  them rather than admitted as duplicates:  ${sample}`);
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN — nothing written.');
    return;
  }

  const db = openDatabase();

  // Pin what we read, so every downstream fact can name the bytes it came from.
  const now = new Date().toISOString();
  for (const [dir, source] of [['iso639-3', 'sil-iso639-3'], ['glottolog', 'glottolog']]) {
    const snap = readSnapshot(dir);
    try {
      db.insertSourceRelease({
        source,
        version: snap?.pin?.kind === 'commit' ? null : (snap?.pin?.value ?? null),
        commitSha: snap?.pin?.kind === 'commit' ? snap.pin.value : null,
        doi: snap?.pin?.doi ?? null,
        sha256: snap?.files?.[0]?.sha256 ?? null,
        // When WE retrieved it — not when the publisher released it. Those are
        // different facts and `pin.date` is the latter; using it here would
        // have recorded that we fetched Glottolog 5.3 on its publication day.
        fetchedAt: snap?.fetchedAt ?? now,
        fetchedBy: snap?.fetchedBy ?? 'ingest-base.mjs',
        sourceUrl: snap?.upstream ?? null,
        licenseSpdx: snap?.license ?? null,
        notes: snap?.pin?.date ? `release published ${snap.pin.date}` : null,
      });
    } catch (err) {
      // No SNAPSHOT.json yet → no pin. Say so rather than invent a release;
      // B1's fetchers are what close this.
      console.warn(`\n  ⚠ ${source}: not pinned — ${err.message}`);
      console.warn('    (a fetcher writing SNAPSHOT.json is what makes this checkable)');
    }
  }

  let loaded = 0;
  // db.transaction(fn) runs fn immediately — do not invoke the result.
  db.transaction(() => {
    for (const lang of spine.values()) {
      db.insertLanguage(lang);
      loaded++;
    }
  });

  // ── What is in the table but NOT derivable from the registries ───────────
  //
  // insertLanguage is INSERT OR REPLACE, so it never deletes. Anything the
  // spine does not produce SURVIVES, and silence about it would be the same
  // failure as the 41 orphaned card fields: data present, nothing accounting
  // for it. Deleting them is a SCOPE decision (Phase D), not a loader's — so
  // this reports and does not touch them.
  const extra = db._db.prepare('SELECT code, name FROM languages').all()
    .filter((r) => !spine.has(r.code));
  if (extra.length) {
    const bucket = (c) => (/^family-|^genus-|^macrolanguage-/.test(c) ? 'card template (genera/)'
      : /^x-/.test(c) ? 'private-use conlang'
        : retiredRow.has(c) ? 'ISO-RETIRED'
          : /-/.test(c) ? 'BCP-47 locale variant' : 'unclassified');
    const groups = {};
    for (const r of extra) (groups[bucket(r.code)] ??= []).push(r.code);

    console.log(`\n  ${extra.length} row(s) in the table are NOT derivable from ISO 639-3 or`);
    console.log('  Glottolog. Left in place — removing them is Phase D\'s scope call:');
    for (const [kind, codes] of Object.entries(groups)) {
      console.log(`    ${String(codes.length).padStart(3)}  ${kind.padEnd(24)} ${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ' …' : ''}`);
    }
    if (groups['ISO-RETIRED']) {
      // A code we still carry that ISO has since withdrawn. This is drift the
      // spine can only see once the registry is PINNED and refreshed — the
      // whole reason B1's fetchers exist. Left in place because deleting a
      // published card is Phase D's call, but named precisely, because
      // "unclassified" would have hidden a live correctness problem.
      console.log('\n  ⚠ ISO-RETIRED — codes still in the table that ISO has withdrawn:');
      for (const c of groups['ISO-RETIRED']) {
        const row = retiredRow.get(c);
        const why = { C: 'code change', D: 'duplicate', N: 'non-existent', S: 'split', M: 'merge' }[row.Ret_Reason] ?? row.Ret_Reason;
        console.log(`      ${c} — ${row.Ref_Name}: ${why}`
          + `${row.Change_To ? ` → ${row.Change_To}` : ''} (effective ${row.Effective})`);
      }
      console.log('    Each still has a published card. Phase D decides retire-vs-redirect.');
    }
    if (groups.unclassified) {
      console.log('\n  ⚠ "unclassified" means a plain-looking code the registries do not');
      console.log('    contain and have never retired — that IS a defect and needs explaining.');
    }
  }

  const stats = db.stats();
  console.log(`\n  ✓ ${loaded.toLocaleString()} languages written`);
  console.log(`    languages table now: ${stats.languages.toLocaleString()}`);
  console.log('\n  Nothing in this script reads a card. The cycle is broken.');
  db.close();
}

main();
