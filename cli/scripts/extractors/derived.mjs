#!/usr/bin/env node

/**
 * extractor: derived — facts computed from other facts.
 *
 * WHY THIS RUNS LAST AND WHY IT IS AN EXTRACTOR AT ALL
 *   Some card fields are not read from anywhere; they are conclusions. Which
 *   databases cover a language, how ready a translation pipeline is, what the
 *   Unicode name of a script code is. The old pipeline computed these too — but
 *   in scattered scripts, against hand-kept lists, and wrote several of them
 *   under an UPSTREAM's name.
 *
 *   Making them facts, written by an extractor like any other, buys three
 *   things. They carry `champollion-derived`, so they can never be mistaken for
 *   an upstream's claim. They carry LINEAGE, so "why does this card say
 *   pipelineReadiness 0.4" resolves to the rows it was computed from. And they
 *   are recomputed wholesale on every build, so they cannot go stale the way a
 *   hand-kept coverage list does.
 *
 * THE ONE THAT BECOMES SELF-MAINTAINING
 *   `databaseCoverage` was a hand-kept object — {grambank: false, wals: true, …}
 *   — on 8,669 cards. It is now simply WHICH SOURCES PRODUCED A FACT for this
 *   code. That cannot drift from reality, because it IS reality: add an
 *   extractor and coverage updates itself; retire a source and it disappears.
 *
 * WHAT IS DELIBERATELY NOT DERIVED HERE
 *   `supportTier`. It sat on 8,623 cards with no `_fieldSources` entry at all —
 *   an editorial grade wearing the appearance of data. A bucketing of
 *   pipelineReadiness would just relaunder it. If a tier is wanted it should be
 *   a curated judgement with an author, or a documented function of the score
 *   the reader can apply themselves. Not a number with no provenance.
 *
 * Usage:
 *   node cli/scripts/extractors/derived.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db.mjs';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { registryCodes } from './lib/extract-lib.mjs';

export const source = 'champollion-derived';
export const dir = null;          // computed; no upstream directory
export const entityType = null;
/**
 * A third kind of extractor, and it needs saying explicitly.
 *
 * A FETCHED extractor pins to a SNAPSHOT. A CURATED one pins to its own file's
 * content hash. This one derives from other facts, so its release pins to the
 * DERIVATION ITSELF — `derived-v1`, bumped whenever the logic changes. Without
 * that, a card could silently change meaning while claiming the same basis.
 *
 * Declaring the kind rather than leaving both dir and entityType null is what
 * lets the gate tell "derives from facts" apart from "someone forgot".
 */
export const kind = 'derived';
const SELF = 'extractors/derived.mjs';

/**
 * The components a translation pipeline actually needs, and where each is
 * established. Every one is a fact somebody extracted — no hand-kept flags.
 */
const COMPONENTS = [
  { key: 'classification', domain: 'classification', property: 'family' },
  { key: 'coordinates', domain: 'geography', property: 'lat' },
  { key: 'script', domain: 'orthography', property: 'script' },
  { key: 'phonology', domain: 'phonology', property: 'consonantCountMedian' },
  { key: 'typology', domain: 'typology', property: '81A' },
  { key: 'wordlist', domain: 'lexical', property: 'swadeshConceptsCovered' },
  { key: 'colexification', domain: 'lexical', property: 'conceptsDocumented' },
  { key: 'numerals', domain: 'numerals', property: 'base' },
  { key: 'description', domain: 'documentation', property: 'mostExtensiveDescription' },
  { key: 'speakerCount', domain: 'vitality', property: 'speakerCount' },
];

export function extract({ db = null } = {}) {
  const conn = db ?? openDatabase();

  // A release for our own derivations. It pins to the extractor's own logic
  // version: when the derivation changes, the release must too, or a card could
  // silently change meaning while claiming the same provenance.
  const releaseId = conn.insertSourceRelease({
    source: 'champollion-derived',
    version: 'derived-v1',
    commitSha: null, doi: null, sha256: null,
    fetchedAt: new Date().toISOString().slice(0, 10),
    fetchedBy: SELF,
    sourceUrl: `repo:${SELF}`,
    licenseSpdx: null,
    notes: 'facts computed from other facts. Version bumps when the derivation '
      + 'changes, so a card cannot change meaning while claiming the same basis.',
  });

  // Which sources asserted anything, per language. This IS databaseCoverage.
  const coverage = conn._db.prepare(`
    SELECT language_code, source, COUNT(*) AS n
    FROM facts
    WHERE source_release_id IS NOT NULL AND status = 'asserted'
      AND source <> 'champollion-derived'
    GROUP BY language_code, source
  `).all();

  const bySource = new Map();
  for (const r of coverage) {
    if (!bySource.has(r.language_code)) bySource.set(r.language_code, new Map());
    bySource.get(r.language_code).set(r.source, r.n);
  }

  // Which components are present, per language, in one pass.
  const present = new Map();
  for (const c of COMPONENTS) {
    const rows = conn._db.prepare(`
      SELECT DISTINCT language_code FROM facts
      WHERE domain = ? AND property = ? AND status = 'asserted'
        AND source_release_id IS NOT NULL
    `).all(c.domain, c.property);
    for (const r of rows) {
      if (!present.has(r.language_code)) present.set(r.language_code, new Set());
      present.get(r.language_code).add(c.key);
    }
  }

  const rows = [];
  const now = new Date().toISOString().slice(0, 10);
  const push = (code, property, value, notes, valueType = 'string') => rows.push({
    languageCode: code, domain: 'coverage', property, variant: '',
    value: String(value), valueType, status: 'asserted',
    source: 'champollion-derived', sourceReleaseId: releaseId,
    sourceUrl: null, sourceRaw: null, confidence: 'api-derived',
    retrievedAt: now, createdBy: SELF, notes,
  });

  // Same restriction as capabilities: the 47 template/conlang/locale rows the
  // spine carries are not languages, and giving them derived coverage facts is
  // what turned them into published cards.
  const REGISTRY_CODES = registryCodes(conn);
  const codes = new Set([...bySource.keys(), ...present.keys()]
    .filter((c) => REGISTRY_CODES.has(c)));
  for (const code of codes) {
    const srcs = [...(bySource.get(code) ?? new Map()).keys()].sort();
    for (const [i, s] of srcs.entries()) {
      rows.push({
        languageCode: code, domain: 'coverage', property: 'coveredBy',
        variant: String(i).padStart(2, '0'), value: s, valueType: 'string',
        status: 'asserted', source: 'champollion-derived', sourceReleaseId: releaseId,
        sourceUrl: null, sourceRaw: null, confidence: 'api-derived',
        retrievedAt: now, createdBy: SELF,
        notes: 'a source that asserted at least one fact about this language. '
          + 'Computed from the store, so it cannot drift from what we actually hold.',
      });
    }
    push(code, 'sourceCount', srcs.length,
      'how many distinct sources describe this language', 'integer');

    const have = present.get(code) ?? new Set();
    for (const c of COMPONENTS) {
      push(code, `component:${c.key}`, String(have.has(c.key)),
        `whether any pinned source establishes ${c.key} for this language`, 'boolean');
    }
    // A plain fraction, not a weighted "score". A weighting is an opinion about
    // what matters, and it belongs in a documented function the reader can
    // disagree with — not baked into a number with no provenance.
    push(code, 'componentsPresent', have.size,
      `of ${COMPONENTS.length} pipeline components, each a fact from a pinned `
      + 'source. Unweighted on purpose: a weighting is an opinion about what '
      + 'matters and should not be hidden inside a number.', 'integer');
    push(code, 'componentsTotal', COMPONENTS.length, 'the denominator', 'integer');
  }

  // ── Readable typology, derived from the coded sources ─────────────────
  //
  // The live cards carried named booleans — hasDefiniteArticle,
  // classifierLanguage, wordOrderDominant — while the spec projects raw feature
  // IDs (GB020, 81A). Both are the same information, but a card that says
  // `GB030: "yes"` is useless to a reader and a card that says
  // `hasGenderInPronouns: true` is not.
  //
  // These are DERIVED, with lineage to the coded fact, because renaming a
  // Grambank code into English is our reading of it. Grambank publishes GB030;
  // it does not publish "classifierLanguage".
  const NAMED = [
    { name: 'hasNumeralClassifiers', src: 'grambank', code: 'GB057' },
    { name: 'hasGenderInPronouns', src: 'grambank', code: 'GB030' },
    { name: 'hasCoreCase', src: 'grambank', code: 'GB070' },
    { name: 'hasObliqueCase', src: 'grambank', code: 'GB072' },
    { name: 'marksPastTense', src: 'grambank', code: 'GB083' },
    { name: 'marksPresentTense', src: 'grambank', code: 'GB082' },
    { name: 'hasSexBasedGender', src: 'grambank', code: 'GB051' },
  ];
  for (const n of NAMED) {
    const codedRows = conn._db.prepare(`
      SELECT id, language_code, value FROM facts
      WHERE domain = 'typology' AND property = ? AND source = ?
        AND status = 'asserted' AND source_release_id IS NOT NULL
    `).all(n.code, n.src);
    for (const r of codedRows) {
      // Grambank codes are "yes"/"no"/"1"/"0". Anything else is a multistate
      // answer that a boolean would misrepresent, so it is left alone.
      const v = String(r.value).trim().toLowerCase();
      const bool = ['yes', '1', 'true'].includes(v) ? 'true'
        : ['no', '0', 'false'].includes(v) ? 'false' : null;
      if (bool === null) continue;
      rows.push({
        languageCode: r.language_code, domain: 'typology', property: n.name,
        variant: '', value: bool, valueType: 'boolean', status: 'asserted',
        source: 'champollion-derived', sourceReleaseId: releaseId,
        sourceUrl: null, sourceRaw: r.value, confidence: 'api-derived',
        retrievedAt: now, createdBy: SELF,
        notes: `readable form of ${n.src} ${n.code}. Ours: the coded source `
          + 'publishes the code, not this name.',
        _lineage: [r.id],
      });
    }
  }

  // Total phoneme inventory — consonants + vowels, from the medians we already
  // derived. A sum of two of our own derivations, with lineage to both.
  const phon = conn._db.prepare(`
    SELECT language_code, property, value, id FROM facts
    WHERE domain = 'phonology' AND property IN ('consonantCountMedian','vowelCountMedian')
      AND status = 'asserted' AND source_release_id IS NOT NULL
  `).all();
  const pin2 = new Map();
  for (const r of phon) {
    if (!pin2.has(r.language_code)) pin2.set(r.language_code, {});
    pin2.get(r.language_code)[r.property] = { v: Number(r.value), id: r.id };
  }
  for (const [code, o] of pin2) {
    if (!o.consonantCountMedian || !o.vowelCountMedian) continue;
    rows.push({
      languageCode: code, domain: 'phonology', property: 'totalPhonemes', variant: '',
      value: String(o.consonantCountMedian.v + o.vowelCountMedian.v),
      valueType: 'integer', status: 'asserted',
      source: 'champollion-derived', sourceReleaseId: releaseId,
      sourceUrl: null, sourceRaw: null, confidence: 'api-derived',
      retrievedAt: now, createdBy: SELF,
      notes: 'consonants + vowels, both medians across PHOIBLE\'s disagreeing '
        + 'inventories. Tone segments are excluded: they are not phonemes in the '
        + 'same sense and adding them would inflate the count for tonal languages.',
      _lineage: [o.consonantCountMedian.id, o.vowelCountMedian.id],
    });
  }

  // ── Script names ──────────────────────────────────────────────────────
  //
  // `scriptUnicodeName` is a LOOKUP, not a claim: ISO 15924 says the code
  // "Cans" means "Unified Canadian Aboriginal Syllabics". Turning a code into
  // its name is our arithmetic over their table, so it is champollion-derived
  // with lineage to the script fact — writing it under ISO 15924's name would
  // attribute a join to a registry that only published one side of it.
  const scriptTable = path.join(DATA_ROOT, 'iso15924-scripts.json');
  if (fs.existsSync(scriptTable)) {
    const names = new Map(
      JSON.parse(fs.readFileSync(scriptTable, 'utf-8')).map((s2) => [s2.code, s2.name]),
    );
    const scriptRows = conn._db.prepare(`
      SELECT id, language_code, value, variant FROM facts
      WHERE domain = 'orthography' AND property = 'script' AND status = 'asserted'
        AND source_release_id IS NOT NULL
    `).all();
    for (const r of scriptRows) {
      const name = names.get(r.value);
      if (!name) continue;
      rows.push({
        languageCode: r.language_code, domain: 'orthography', property: 'scriptName',
        variant: r.variant, value: name, valueType: 'string', status: 'asserted',
        source: 'champollion-derived', sourceReleaseId: releaseId,
        sourceUrl: 'https://www.unicode.org/iso15924/', sourceRaw: r.value,
        confidence: 'api-derived', retrievedAt: now, createdBy: SELF,
        notes: `ISO 15924 name for script code ${r.value}`,
        _lineage: [r.id],
      });
    }
  }

  return {
    _rows: rows,
    db: conn,
    _ownsDb: !db,
    _stats: { codes: codes.size, rows: rows.length },
    commit() {
      conn.transaction(() => {
        conn._db.prepare('DELETE FROM facts WHERE created_by = ?').run(SELF);
        for (const r of rows) {
          const lineage = r._lineage;
          delete r._lineage;
          conn.insertFact(r);
          if (!lineage?.length) continue;
          const id = conn._db.prepare(
            'SELECT id FROM facts WHERE language_code=? AND domain=? AND property=? '
            + 'AND source=? AND variant=?',
          ).get(r.languageCode, r.domain, r.property, r.source, r.variant)?.id;
          if (id) conn.recordLineage(id, lineage);
        }
      });
      return { written: rows.length, asserted: rows.length, absent: 0, derived: rows.length };
    },
    offSpineReport: () => ({ codes: 0, facts: 0, sample: [] }),
    close() { if (!db) conn.close(); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._rows.length.toLocaleString()} derived fact(s).`);
  } else {
    const r = x.commit();
    console.log(`\n  ✓ derived → ${r.written.toLocaleString()} facts for `
      + `${x._stats.codes.toLocaleString()} languages`);
    console.log('    databaseCoverage is now WHICH SOURCES PRODUCED A FACT — it cannot');
    console.log('    drift from reality because it is computed from reality');
    console.log(`    ${COMPONENTS.length} pipeline components, counted unweighted\n`);
  }
  x.close();
}
