#!/usr/bin/env node

/**
 * project-cards.mjs — facts + field spec → language cards. The one generator.
 *
 * WHERE THIS SITS
 *     sources → [fetch+pin] → [extract] → fact store → [PROJECT] → cards
 *
 * WHAT CHANGES BY EXISTING
 *   Cards stop being files that 93 scripts edit in place and become BUILD
 *   OUTPUT. Five things follow, none of which was true before:
 *
 *   1. Rebuildable. Every card can be produced from an empty directory.
 *   2. Corrections propagate. Projection is WHOLESALE — a field is rebuilt from
 *      facts every time, so fixing an extractor fixes every affected card. The
 *      old generators were ~52/64 merge-only ("skip if already populated"),
 *      which meant a wrong value could never be corrected by re-running and a
 *      retracted upstream claim was never removed.
 *   3. Traceable. Every projected field records the source, the release, the
 *      DOI and the retrieval date behind it. Provenance is computed from the
 *      rows that produced the value, so it CANNOT drift from it.
 *   4. One definition. `shared/card-field-spec.json` says what a card is;
 *      this program only executes it.
 *   5. Absence is expressible. A field with no asserting source is OMITTED,
 *      not guessed. That is the direct fix for `orthographicStatus:
 *      "unwritten"` on 1,318 languages — a claim manufactured out of our own
 *      missing harvest.
 *
 * THE LAUNDERING THIS REPLACES
 *   `stamp-field-sources.mjs` stamped provenance by FIELD NAME, not by writer,
 *   so hand-typed prose inherited the citation of whatever else had touched the
 *   field — 25 cards carry text typed into a script literal, stamped
 *   `["wals-2024","grambank-1.0.3","phoible-2.0"]`. Here a field's provenance
 *   is derived from the fact rows that produced it. There is no way to stamp a
 *   value with a source that did not produce it, because nothing does the
 *   stamping.
 *
 * Usage:
 *   node cli/scripts/project-cards.mjs --out build/cards-projected      # shadow build
 *   node cli/scripts/project-cards.mjs --code crk --stdout              # one card
 *   node cli/scripts/project-cards.mjs --out build/cards-projected --limit 200
 *
 * Exit: 0 ok · 1 nothing projected · 2 could not run
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const SPECS = {
  language: path.join(REPO, 'shared', 'card-field-spec.json'),
  method: path.join(REPO, 'shared', 'method-card-spec.json'),
  corpus: path.join(REPO, 'shared', 'corpus-card-spec.json'),
};

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const ONE = flag('code');
// Which card type to build. The projector is generic over entity type: a method
// card and a language card are the same operation over different facts and a
// different spec. Building the second type a different way is how a project
// ends up with two definitions of what a card is.
const TYPE = flag('type', 'language');
const TO_STDOUT = argv.includes('--stdout');
const OUT = flag('out');
const LIMIT = Number(flag('limit', '0')) || 0;

if (!OUT && !TO_STDOUT) {
  console.error('ERROR: --out <dir> or --stdout is required.');
  console.error('This never writes to cli/shared/language-cards/ implicitly. Cutover');
  console.error('happens after a shadow build has been diffed, not as a side effect.');
  process.exit(2);
}

const SPEC_PATH = SPECS[TYPE];
if (!SPEC_PATH) {
  console.error(`ERROR: unknown card type "${TYPE}". Known: ${Object.keys(SPECS).join(', ')}`);
  process.exit(2);
}
if (!fs.existsSync(SPEC_PATH)) {
  console.error(`ERROR: ${SPEC_PATH} not found — there is no definition of what a `
    + `${TYPE} card is.`);
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));

const db = openDatabase();

// ── Load every fact once, grouped by language ───────────────────────────────
//
// Per-card queries would be ~8,800 round trips per field. One pass is both
// faster and, more importantly, deterministic: the same rows are in memory for
// every card, so ordering cannot vary between them.
const releases = new Map();
for (const r of db._db.prepare('SELECT * FROM source_releases').all()) releases.set(r.id, r);

const byLang = new Map();
const factRows = TYPE === 'language'
  ? db._db.prepare(`
      SELECT language_code AS key, domain, property, value, status, source,
             source_release_id, variant, retrieved_at, notes
      FROM facts
      WHERE source_release_id IS NOT NULL
      ${ONE ? 'AND language_code = ?' : ''}
      ORDER BY language_code, domain, property, variant
    `).all(...(ONE ? [ONE] : []))
  : db._db.prepare(`
      SELECT ef.entity_id AS key, ef.domain, ef.property, ef.value, ef.status,
             ef.source, ef.source_release_id, ef.variant, ef.retrieved_at, ef.notes
      FROM entity_facts ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE ef.source_release_id IS NOT NULL AND e.entity_type = ?
      ${ONE ? 'AND ef.entity_id = ?' : ''}
      ORDER BY ef.entity_id, ef.domain, ef.property, ef.variant
    `).all(...(ONE ? [TYPE, ONE] : [TYPE]));

for (const f of factRows) {
  if (!byLang.has(f.key)) byLang.set(f.key, new Map());
  const key = `${f.domain}.${f.property}`;
  const m = byLang.get(f.key);
  if (!m.has(key)) m.set(key, []);
  m.get(key).push(f);
}

/**
 * Facts for one field definition, in the spec's source-priority order.
 * Absence rows are kept — "consulted, nothing found" is information the caller
 * needs in order to tell it apart from "never consulted".
 */
function candidates(langFacts, def) {
  const out = [];
  for (const src of def.sources ?? []) {
    for (const fq of def.facts ?? []) {
      const rows = langFacts.get(`${fq.domain}.${fq.property}`) ?? [];
      for (const r of rows) if (r.source === src) out.push(r);
    }
  }
  return out;
}

/** How to name a release on a card: DOI, else version, else commit, else hash. */
function releaseLabel(rel) {
  if (!rel) return null;
  return rel.doi ?? rel.version
    ?? (rel.commit_sha ? rel.commit_sha.slice(0, 8) : null)
    ?? (rel.sha256 ? `sha256:${rel.sha256.slice(0, 12)}` : null);
}

/** Provenance for a value, computed from the rows that produced it. */
function attribution(rows) {
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.source)) continue;
    const rel = releases.get(r.source_release_id);
    seen.set(r.source, {
      source: r.source,
      // A curated file has no DOI and no upstream version — its pin is the
      // content hash and the commit that last changed it. Falling through to
      // null would have made the most-editable sources look like the LEAST
      // provenanced, which is backwards.
      release: rel?.doi ?? rel?.version
        ?? (rel?.commit_sha ? rel.commit_sha.slice(0, 8) : null)
        ?? (rel?.sha256 ? `sha256:${rel.sha256.slice(0, 12)}` : null),
      retrieved: String(r.retrieved_at ?? '').slice(0, 10),
    });
  }
  return [...seen.values()];
}

function projectField(langFacts, def) {
  const rows = candidates(langFacts, def);
  const asserted = rows.filter((r) => r.status === 'asserted' && r.value !== null);

  if (def.rule === 'list') {
    if (!asserted.length) return { value: undefined, rows: [] };
    const seen = new Set();
    const values = [];
    for (const r of asserted) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      // `itemKey` wraps each entry in an object so a list can carry a flag
      // alongside the value — scripts need `primary`, and the ordering that
      // encodes it lives in the fact's variant key, which a bare string list
      // would throw away.
      values.push(def.itemKey
        ? {
          [def.itemKey]: coerce(r.value, r),
          ...(def.firstIsPrimary ? { primary: values.length === 0 } : {}),
        }
        : r.value);
    }
    return { value: values, rows: asserted };
  }

  if (def.rule === 'attributed') {
    // ── ONE field per concept, and the disagreement is IN it ─────────────
    //
    // The alternative — which this replaces — was a field per source:
    // elcatEndangerment, aesStatus, linguametaEndangerment, each a different
    // name for "how endangered is this language". Five fields meaning one
    // thing, leaving every consumer to rediscover that they are the same
    // question and invent its own rule for which wins. And a `direct` field
    // with a source priority is worse still: it picks a winner silently and
    // the losing value never appears at all.
    //
    // So an attributed field is an OBJECT, not a bare list:
    //
    //   { agreement: 'single'|'unanimous'|'conflicting',
    //     consensus: <value>,        // present only when they agree
    //     values: [ {value, source, release, scale?, note?}, … ] }
    //
    // A consumer that wants one number reads `consensus` and gets nothing
    // when the sources disagree — which is correct, because in that case
    // there is no single answer to give. A consumer that wants to SHOW the
    // disagreement reads `values`. Neither has to guess.
    if (!asserted.length) return { value: undefined, rows: [] };

    const seenEntry = new Set();
    const values = asserted.map((r) => ({
      value: coerce(r.value, r),
      source: r.source,
      release: releaseLabel(releases.get(r.source_release_id)),
      // Different bodies use different SCALES. ELCat's "severely endangered"
      // and Glottolog AES's "moribund" are not necessarily contradicting —
      // they are different vocabularies. Naming the scale lets a reader see
      // that, instead of reading two vocabularies as a dispute.
      ...(def.scaleBySource?.[r.source] ? { scale: def.scaleBySource[r.source] } : {}),
      ...(r.notes ? { note: r.notes } : {}),
    })).filter((v) => {
      // An identical (value, source, note) triple twice is one claim recorded
      // twice, not two bodies agreeing. ELCat can carry the same bucket from
      // several references; where the reference note differs the entries are
      // kept, because those ARE distinct attestations.
      const k = JSON.stringify([v.value, v.source, v.note ?? null]);
      if (seenEntry.has(k)) return false;
      seenEntry.add(k);
      return true;
    });

    const distinct = new Set(values.map((v) => JSON.stringify(v.value)));
    const scales = new Set(values.map((v) => v.scale ?? ''));
    const comparable = scales.size <= 1;   // one scale ⇒ values are commensurable

    const agreement = values.length === 1 ? 'single'
      : !comparable ? 'incommensurable'
        : distinct.size === 1 ? 'unanimous' : 'conflicting';

    return {
      value: {
        agreement,
        ...(agreement === 'single' || agreement === 'unanimous'
          ? { consensus: values[0].value } : {}),
        values,
      },
      rows: asserted,
    };
  }

  // direct
  const win = asserted[0];
  if (!win) return { value: undefined, rows: [] };
  return { value: coerce(win.value, win), rows: [win] };
}

/** Restore the type the fact recorded. Everything is TEXT in SQLite. */
function coerce(value, row) {
  const t = row?.value_type;
  if (value === 'true' || value === 'false') return value === 'true';
  const n = Number(value);
  if (value !== '' && !Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(value)) return n;
  return value;
}

function projectCard(code, langFacts) {
  const card = {};
  const fieldSources = {};

  for (const [name, def] of Object.entries(spec.fields)) {
    if (def.rule === 'identity') { card[name] = code; continue; }

    if (def.rule === 'object') {
      const obj = {};
      const objRows = [];
      for (const [sub, subDef] of Object.entries(def.properties)) {
        const { value, rows } = projectField(langFacts, subDef);
        if (value === undefined) continue;
        obj[sub] = value;
        objRows.push(...rows);
      }
      // An object whose every sub-field is absent is omitted entirely, rather
      // than published as an empty shell implying we looked and found nothing.
      if (Object.keys(obj).length) {
        card[name] = obj;
        fieldSources[name] = attribution(objRows);
      }
      continue;
    }

    const { value, rows } = projectField(langFacts, def);
    if (value === undefined) continue;      // absence: omit
    card[name] = value;
    fieldSources[name] = attribution(rows);
  }

  if (Object.keys(fieldSources).length) card._fieldSources = fieldSources;
  card._generated = {
    by: 'cli/scripts/project-cards.mjs',
    spec: `card-field-spec v${spec.version}`,
    // Deliberately the RELEASE SET, not wall-clock. Same pins in ⇒ same bytes
    // out, so a rebuild that changes a card means the DATA changed.
    from: [...new Set(
      Object.values(fieldSources).flat().map((a) => `${a.source}@${a.release ?? 'unpinned'}`),
    )].sort(),
  };

  // ── Identity, so a correction can name what it is correcting ──────────────
  //
  // Every card type gets a public "comment" and a private "correction" route.
  // Both need to say WHICH card and WHICH field — and, critically, WHICH
  // VERSION of that card the reader was looking at.
  //
  // That last part is not ceremony. Cards are build output now: a rebuild can
  // change a value between someone reading it and someone triaging their
  // report. Without a version, a correction saying "the speaker count is wrong"
  // is unresolvable — nobody can tell whether it refers to what the card says
  // today. `revision` is a content hash of the card's DATA (its bookkeeping
  // excluded, so a rebuild that changes nothing substantive does not
  // invalidate every open report). Same facts in, same revision out.
  //
  // `type` and `id` together are the stable address: corpus/nts and
  // language/nts are different cards and a submission must not confuse them.
  const dataOnly = { ...card };
  delete dataOnly._fieldSources;
  delete dataOnly._generated;
  card._card = {
    type: spec.entityType ?? 'language',
    id: code,
    revision: createHash('sha256')
      .update(JSON.stringify(dataOnly)).digest('hex').slice(0, 16),
    // The addressable fields. A submission targets one of these, so the UI has
    // no need to guess what is correctable and cannot offer to correct
    // bookkeeping.
    correctableFields: Object.keys(dataOnly).filter((k) => k !== 'code' && k !== 'id'),
  };
  return card;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const codes = ONE ? [ONE] : [...byLang.keys()].sort();
const selected = LIMIT ? codes.slice(0, LIMIT) : codes;

if (!selected.length) {
  console.error(ONE
    ? `ERROR: no pinned ${TYPE} facts for "${ONE}". Run the extractors first.`
    : `ERROR: no pinned ${TYPE} facts in the store — nothing to project.`);
  process.exit(1);
}

if (TO_STDOUT) {
  for (const code of selected) {
    console.log(JSON.stringify(projectCard(code, byLang.get(code) ?? new Map()), null, 2));
  }
  db.close();
  process.exit(0);
}

const outDir = path.isAbsolute(OUT) ? OUT : path.join(REPO, OUT);
fs.mkdirSync(outDir, { recursive: true });

// ── Remove cards the projection no longer produces ──────────────────────────
//
// Writing without deleting means a card that stops being projected LINGERS
// FOREVER. That is not a tidiness issue: the 43 genera/conlang templates
// survived here from an earlier run after the extractors stopped giving them
// content, and cutover would have copied them into the live corpus as though
// they were current output.
//
// A projection is a complete statement of what exists. Anything in the output
// directory that this run does not write is, by definition, not part of it.
const stale = new Set(fs.readdirSync(outDir).filter((f) => f.endsWith('.json')));

let written = 0;
let fields = 0;
const contentless = [];
for (const code of selected) {
  const card = projectCard(code, byLang.get(code) ?? new Map());

  // ── A card with no data is not a card ────────────────────────────────────
  //
  // An entry can hold pinned facts and still project NOTHING: the 38 genera
  // templates, 5 conlangs and 4 locale variants in the spine carry a
  // `not_surveyed` tone row and little else, so they came out as bookkeeping
  // wrapped around an id. Publishing those puts 47 empty pages in the atlas —
  // the exact "blank on the card" this pass exists to eliminate, and worse than
  // omitting them because an empty page asserts that there is nothing to know
  // rather than that we are not describing this entry.
  //
  // Skipped and NAMED, never silently: whether these belong in the atlas at all
  // is a scope decision, and it cannot be made if the build hides them.
  if (!card._card.correctableFields.length) {
    contentless.push(code);
    continue;
  }
  fields += Object.keys(card).length - 3;   // minus _fieldSources, _generated, _card
  fs.writeFileSync(path.join(outDir, `${code}.json`), `${JSON.stringify(card, null, 2)}\n`);
  stale.delete(`${code}.json`);
  written++;
}

let removed = 0;
for (const f of stale) { fs.rmSync(path.join(outDir, f), { force: true }); removed++; }

console.log(`\n  PROJECTED ${written.toLocaleString()} card(s) → ${path.relative(REPO, outDir)}/`);
console.log(`    ${fields.toLocaleString()} field instances, `
  + `${(fields / written).toFixed(1)} per card on average`);
console.log(`    from ${releases.size} pinned source release(s), `
  + `${factRows.length.toLocaleString()} facts`);
if (removed) {
  console.log(`\n  ${removed} stale card(s) removed — the projection no longer produces them.`);
  console.log('    A card that stops being projected must DISAPPEAR, not linger: an');
  console.log('    output directory that accumulates is not a statement of what exists.');
}

if (contentless.length) {
  console.log(`\n  ${contentless.length} entr(ies) projected NO data field and were not written:`);
  console.log(`    ${contentless.slice(0, 10).join(', ')}`
    + `${contentless.length > 10 ? ` … and ${contentless.length - 10} more` : ''}`);
  console.log('    They hold pinned facts but none the spec projects. An empty card');
  console.log('    asserts there is nothing to know; omitting it says we are not');
  console.log('    describing this entry. Whether they belong in the atlas is a');
  console.log('    scope decision — it is named here so it can be made.');
}

console.log('\n  This is a SHADOW BUILD. It does not touch cli/shared/language-cards/.');
console.log('  Diff it before any cutover — every difference has to be classified as');
console.log('  an intended fix, an intended drop, or a regression.\n');

db.close();
