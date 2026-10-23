/**
 * ingest-structure.mjs — CLDF StructureDataset → cldf_values.
 *
 * WHAT A StructureDataset IS, AND WHY IT GETS ITS OWN HANDLER
 *   It is the CLDF module for typological data: a ValueTable of
 *   (Language, Parameter, Value) with an optional CodeTable saying which values
 *   are legal. Grambank, WALS, APiCS and Gramadapt all publish this way. 29 of
 *   our 203 pinned sources declare it, and they are the ones that carry
 *   card-relevant typology.
 *
 *   Dispatching on the module the PUBLISHER declared, rather than on our guess
 *   about what a directory contains, is the difference between using the
 *   standard and merely reading files that happen to be CSV.
 *
 * THE NULL-TOKEN RULE, WHICH IS THE WHOLE REASON THIS IS CAREFUL
 *   Grambank encodes "the documentation does not answer this" as "?" — 79,638
 *   rows, 18% of the dataset. Ingested naively, that writes "?" as a
 *   typological fact about 79,638 language-parameter pairs. Every source has
 *   some token like this and they are all different, so each source DECLARES
 *   its null tokens in the manifest and an undeclared one is a hard error, not
 *   a value.
 *
 *   A null token becomes an ABSENCE row, not a missing row:
 *     not_attested  — this source covers the language, and its documentation
 *                     does not answer this question. Grambank's "?".
 *     not_surveyed  — this source does not cover the language at all.
 *   Recording the first is what stops "we don't know" from later being read as
 *   "nobody has looked", which is how `orthographicStatus:"unwritten"` came to
 *   be asserted about 1,318 languages.
 *
 *   Note that a coded ABSENCE of a feature is NOT a null. Grambank's value "0"
 *   means "this feature is absent from this language" — a positive claim, with
 *   a code behind it, and it is asserted like any other.
 *
 * NOT EVERY StructureDataset PUTS A SCALAR IN Value
 *   ELCat packs JSON into it:
 *     vitality → {"Endangerment": {"Level": "threatened", "Certainty": 0.2}}
 *     speakers → {"Ethnic Population": "4,000", "Date Of Info": "2006",
 *                 "Speaker Number": "1000-9999"}
 *   so a mapping entry may be an object declaring which key to read
 *   (`jsonPath`), a closed `vocabulary` to check the result against, and a
 *   `contextPath` whose raw text is preserved in Comment. Declared per source,
 *   never sniffed: a value we guessed the shape of is a value we cannot defend.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCSVObjects } from '../lib/csv.mjs';
import { valueWriter, STATUS, VARIANT } from './values.mjs';
import { readSnapshot, verify } from '../fetchers/lib/fetch-lib.mjs';
import { ingestLexical } from './ingest-lexical.mjs';
import { spineResolver } from './spine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * Licences that forbid derivative works. Their values never enter the store at
 * all, so there is nothing to leak — excluded at ingest, not filtered at
 * release.
 */
const NO_DERIVATIVES = /(-ND-|-ND$|NoDerivat)/i;

/** Licences that forbid commercial use. Ingested, but flagged on every value. */
const NON_COMMERCIAL = /(-NC-|-NC$|NonCommercial)/i;

/**
 * A bespoke licence, not a standard SPDX one. CLAUDE.md is explicit that we
 * "never interpret a modified/bespoke/unstated license on the rights-holder's
 * behalf", so a LicenseRef is NOT REDISTRIBUTABLE by default and stays that way
 * until a grant is recorded by a human.
 *
 * This is a different constraint from no-derivatives, and conflating the two
 * would be wrong in both directions. SIL's ISO 639-3 terms permit incorporating
 * the codes into a system — commercially, even — while forbidding a product
 * that "provide[s] a means to redistribute the code set". So we may build on it
 * and must not republish it. Refusing to ingest it would break the spine for no
 * reason; publishing it would breach the terms.
 */
const BESPOKE = /^LicenseRef-/i;

/**
 * Register a pinned release as a source row, carrying its licence terms so that
 * every value can inherit them by join rather than by anyone remembering.
 *
 * @returns {{id: string, redistributable: boolean, commercial: boolean, noDerivatives: boolean}}
 */
export function registerSource(db, sourceKey, declaredLicense = null) {
  const dir = path.join(DATA, sourceKey);
  const snap = readSnapshot(sourceKey);
  if (!snap) {
    throw new Error(
      `cli/data/${sourceKey}/ has no SNAPSHOT.json. An extraction that cannot name a `
      + 'release produces values that cannot be re-derived or checked.',
    );
  }
  const license = snap.license ?? snap.licence;
  if (!license) {
    throw new Error(
      `${sourceKey} records no licence. A source whose terms we cannot establish does `
      + 'not ship — we do not guess on a rights-holder\'s behalf.',
    );
  }

  // The manifest states the licence we BELIEVE a source carries; the SNAPSHOT
  // records what was actually fetched. Two places holding one fact is drift
  // waiting to happen, so the second is a CHECK on the first rather than a
  // duplicate of it.
  //
  // This gate earned itself immediately: the manifest said PHOIBLE was
  // CC-BY-SA-3.0, written from memory. The SNAPSHOT says CC-BY-3.0. A wrong
  // ShareAlike claim would have forced the whole atlas to a licence it does not
  // need, on the strength of nobody checking.
  // Compared case-insensitively: SPDX identifiers are case-insensitive for
  // matching, and two of our snapshots record "cc-by-4.0" in lower case. A gate
  // that fires on capitalisation trains people to ignore it, which costs more
  // than the difference it catches.
  if (declaredLicense && declaredLicense.toLowerCase() !== license.toLowerCase()) {
    throw new Error(
      `${sourceKey}: the manifest declares "${declaredLicense}" but the pinned SNAPSHOT `
      + `records "${license}". The SNAPSHOT is the evidence — correct the manifest, or `
      + 're-fetch if the upstream terms genuinely changed. We do not carry two answers '
      + 'to a licence question.',
    );
  }

  const noDerivatives = NO_DERIVATIVES.test(license);
  const commercial = !NON_COMMERCIAL.test(license);
  // Redistributable only when the licence plainly says so. A bespoke LicenseRef
  // does not, and reading silence as permission is the failure this whole pass
  // was convened to end.
  const redistributable = !noDerivatives && !BESPOKE.test(license);

  // A commit-hash pin is abbreviated in the release ID. LinguaMeta's is a
  // 40-character sha, and the untruncated form appeared on every card as
  // `linguameta-452a21ad3dae5668c06ceeac21ff073e1e40f9be` — precise and
  // unreadable. Twelve hex characters are unambiguous for any real repository,
  // and the FULL pin is still recorded in cldf_sources.Version and sources.bib,
  // so nothing is lost that a checker would need.
  const pin = snap.pin?.value ? String(snap.pin.value) : null;
  const shortPin = pin && /^[0-9a-f]{32,}$/i.test(pin) ? pin.slice(0, 12) : pin;
  const id = shortPin ? `${sourceKey}-${shortPin}` : sourceKey;

  db.prepare(`
    INSERT INTO cldf_sources
      (ID, BibTeX_Type, Title, Author, Year, DOI, URL, Version, License, License_URL,
       sha256, Retrieved_At, CLDF_Module, Redistributable, Commercial_Use)
    VALUES (@ID,'misc',@Title,@Author,@Year,@DOI,@URL,@Version,@License,@License_URL,
            @sha256,@Retrieved_At,@CLDF_Module,@Redistributable,@Commercial_Use)
    ON CONFLICT(ID) DO NOTHING
  `).run({
    ID: id,
    Title: snap.citation ?? sourceKey,
    Author: null,
    Year: null,
    DOI: snap.pin?.doi ?? null,
    URL: snap.upstream ?? null,
    Version: snap.pin?.value ?? null,
    License: license,
    License_URL: snap.licenseUrl ?? null,
    sha256: snap.pin?.sha256 ?? null,
    Retrieved_At: snap.retrievedAt ?? null,
    CLDF_Module: moduleOf(dir),
    Redistributable: redistributable ? 1 : 0,
    Commercial_Use: commercial ? 1 : 0,
  });

  return { id, redistributable, commercial, noDerivatives, license };
}

/** Read the CLDF module a dataset declares in its own descriptor. */
export function moduleOf(dir) {
  const descriptor = fs.readdirSync(dir).find((f) => f.endsWith('-metadata.json'));
  if (!descriptor) return null;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, descriptor), 'utf-8'));
  return String(meta['dc:conformsTo'] ?? '').split('#')[1] ?? null;
}

/** Read a dotted path out of a parsed JSON value. Returns undefined, never throws. */
function atPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Normalise a mapping entry to its object form, so the ingest loop has one
 * shape to handle whether a source stores scalars or JSON.
 */
function asRule(entry) {
  return typeof entry === 'string' ? { parameter: entry } : entry;
}

/**
 * In CLDF the MEANING of a coded value lives in the CodeTable, not in the
 * Value column. WALS stores Value="2" with Code_ID="81A-2", whose code Name is
 * "SVO"; Glottolog stores Value="3" with Code_ID="aes-shifting". Projecting the
 * raw Value would put "2" on a card as this language's word order — technically
 * faithful to one column and useless to every reader.
 *
 * So a source whose semantics are in its codes declares `useCodeLabel`, and the
 * label is stored as the value while Code_ID keeps the link back to the
 * publisher's own vocabulary.
 */
/**
 * The FULL feature set of a typological catalog, stored under ONE parameter
 * (`typologyFeature`, Disposition STORE — never projected onto cards, never in
 * the emitted card-fact dataset) with the upstream feature id as a `feature`
 * variant. This is the public catalogue's typology panel data: a source's
 * mapped parameters are the card-worthy decisions (13 WALS features, 8
 * Grambank), and the catalog is everything else the source coded, attributed
 * and citable, without minting ~900 near-identical card fields. Same pattern
 * as lexicalResource: one parameter, the discriminator says which.
 *
 * Shared by the full StructureDataset handler and the attestation handler
 * (APiCS has no parameterMap by decision, but its features still feed the
 * panel). The rows carry the UPSTREAM's release id — a feature value is the
 * publisher's claim, not a derivation.
 *
 * @returns {number} values written
 */
export function writeFeatureCatalog(db, { sourceId, source, values, toSpine, nulls }) {
  const dir = path.join(DATA, source);
  const readCsv = (name) => {
    const file = path.join(dir, `${name}.csv`);
    if (!fs.existsSync(file)) return [];
    return parseCSVObjects(fs.readFileSync(file, 'utf-8'), { file: `${source}/${name}.csv` }).rows;
  };
  const codeNames = new Map(readCsv('codes').map((c) => [c.ID, c.Name]));
  const paramNames = new Map(readCsv('parameters').map((p) => [p.ID, (p.Name ?? '').trim()]));
  const write = valueWriter(db, { sourceId, createdBy: 'cldf/feature-catalog' });

  let written = 0;
  db.transaction(() => {
    for (const row of values) {
      const languageId = toSpine.get(row.Language_ID);
      if (!languageId || !row.Parameter_ID) continue;
      const label = (codeNames.get((row.Code_ID ?? '').trim()) ?? row.Value ?? '').trim();
      if (!label || nulls?.has(label)) continue;
      const feature = paramNames.get(row.Parameter_ID) || row.Parameter_ID;
      if (write(languageId, 'typologyFeature',
        JSON.stringify({ feature, value: label }), {
          variantType: VARIANT.FEATURE,
          variantId: row.Parameter_ID,
          comment: row.Comment || null,
        })) {
        written++;
      }
    }
  })();
  return written;
}

function labelFor(row, codeNames, rule) {
  if (!rule.useCodeLabel) return null;
  const id = (row.Code_ID ?? '').trim();
  if (!id) return null;
  return codeNames.get(id) ?? null;
}

/**
 * Pull the value a rule asks for out of a raw cell.
 *
 * @returns {{value: string|null, context: string|null, malformed: boolean}}
 */
function readValue(raw, rule) {
  if (!rule.jsonPath) return { value: raw, context: null, malformed: false };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A cell the manifest says is JSON and which is not is a parsing fault or
    // an upstream schema change. Counted and surfaced, never coerced to text —
    // storing the raw blob as though it were the value is how a card comes to
    // display `{"Endangerment": {"Level": ...`.
    return { value: null, context: null, malformed: true };
  }
  const picked = atPath(parsed, rule.jsonPath);
  const context = rule.contextPath ? atPath(parsed, rule.contextPath) : null;
  return {
    value: picked === undefined || picked === null ? null : String(picked).trim(),
    context: context === undefined || context === null ? null : String(context).trim(),
    malformed: false,
  };
}

/**
 * Ingest one StructureDataset.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} spec - the source's manifest entry
 * @param {string} spec.source
 * @param {Record<string, string|{parameter:string, jsonPath?:string, vocabulary?:string[], contextPath?:string}>} spec.parameterMap
 * @param {string[]} spec.nullTokens - values that mean "no answer", declared not inferred
 * @returns {object} counts, for the ingestion contract to check
 */
export function ingestStructureDataset(db, spec) {
  const { source, parameterMap, nullTokens, license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(
      `${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}). `
      + 'Values extracted from drifted bytes would be attributed to a release they did '
      + 'not come from.',
    );
  }

  const src = registerSource(db, source, declaredLicense);
  if (src.noDerivatives) {
    throw new Error(
      `${source} is ${src.license} — a no-derivatives licence. Its values must never `
      + 'enter the store; record abstracted metadata about the resource instead. This '
      + 'is enforced here rather than filtered at release so there is nothing to leak.',
    );
  }

  const read = (name) => {
    const file = path.join(dir, `${name}.csv`);
    if (!fs.existsSync(file)) return [];
    return parseCSVObjects(fs.readFileSync(file, 'utf-8'), { file: `${source}/${name}.csv` }).rows;
  };

  const languages = read('languages');
  const values = read('values');
  const upstreamCodes = read('codes');

  // ── LanguageTable columns ─────────────────────────────────────────────────
  // Not every claim a StructureDataset makes lives in its ValueTable. WALS puts
  // Family and Genus on languages.csv, and those are the SECOND classification
  // authority in the atlas — Glottolog is the other, and the two taxonomies
  // genuinely differ. Reading only values.csv would have left `family` looking
  // like a single-source fact when it is a real cross-source comparison.
  const fromLanguageTable = Object.entries(parameterMap)
    .map(([column, entry]) => [column, asRule(entry)])
    .filter(([, rule]) => rule.fromLanguageTable);

  // ── Import the upstream CodeTable, re-keyed to OUR parameter IDs ───────────
  // Their vocabulary, our parameter names. This is what makes a value
  // checkable: "0" is meaningless until a code says it means "absent".
  const insertCode = db.prepare(`
    INSERT INTO cldf_codes (ID, Parameter_ID, Name, Description, Source_Scale)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(ID) DO NOTHING
  `);
  // Upstream code ID → its human-readable name, for sources whose semantics
  // live in the CodeTable.
  const codeNames = new Map(upstreamCodes.map((c) => [c.ID, c.Name]));

  let codesImported = 0;
  db.transaction(() => {
    for (const c of upstreamCodes) {
      const rule = parameterMap[c.Parameter_ID] && asRule(parameterMap[c.Parameter_ID]);
      if (!rule) continue;
      // Source_Scale is the RELEASE id, not the bare source name, so it joins
      // directly against cldf_values.Source. Keying it on the name looked
      // tidier and silently never matched, which made every cross-scale
      // comparison fall through to "conflicting" — reporting ELCat and
      // Glottolog AES as disagreeing when they are simply two vocabularies.
      insertCode.run(`${rule.parameter}-${c.Name}`, rule.parameter, c.Name,
        c.Description ?? null, src.id);
      codesImported++;
    }
    // A vocabulary the source does not ship as a CodeTable but which the
    // manifest declares — ELCat's nine endangerment levels live in JSON, not in
    // codes.csv. Declaring them makes an unlisted level a build failure rather
    // than a silently-accepted new value.
    for (const entry of Object.values(parameterMap)) {
      const rule = asRule(entry);
      for (const name of rule.vocabulary ?? []) {
        insertCode.run(`${rule.parameter}-${name}`, rule.parameter, name, null, src.id);
        codesImported++;
      }
    }
  })();

  // Legal values per parameter, for conformance checking.
  const legal = new Map();
  for (const r of db.prepare('SELECT Parameter_ID, Name FROM cldf_codes').all()) {
    if (!legal.has(r.Parameter_ID)) legal.set(r.Parameter_ID, new Set());
    legal.get(r.Parameter_ID).add(r.Name);
  }

  // ── Resolve the dataset's language codes onto the spine ────────────────────
  const spine = spineResolver(db);
  const toSpine = new Map();
  let unresolvable = 0;
  for (const l of languages) {
    const id = spine.resolve(l.ISO639P3code ?? '', l.Glottocode ?? '');
    if (id) toSpine.set(l.ID, id);
    else unresolvable++;
  }

  const nulls = new Set(nullTokens);

  const stats = {
    source,
    rowsRead: values.length,
    languagesInDataset: languages.length,
    unresolvableLanguages: unresolvable,
    mappedParameters: Object.keys(parameterMap).length,
    unmappedParameters: 0,
    codesImported,
    asserted: 0,
    absence: 0,
    offSpine: 0,
    malformed: 0,
    outOfVocabulary: [],
  };

  const seenUpstreamParams = new Set();
  const createdBy = 'cldf/ingest-structure.mjs';
  const write = valueWriter(db, { sourceId: src.id, createdBy });

  db.transaction(() => {
    for (const row of values) {
      seenUpstreamParams.add(row.Parameter_ID);
      const entry = parameterMap[row.Parameter_ID];
      if (!entry) continue;
      const rule = asRule(entry);
      const parameter = rule.parameter;

      const languageId = toSpine.get(row.Language_ID);
      if (!languageId) { stats.offSpine++; continue; }

      const cell = (row.Value ?? '').trim();
      const read = readValue(cell, rule);
      if (read.malformed) { stats.malformed++; continue; }

      // A coded source's meaning is its code label. If the rule asks for one
      // and the row has no resolvable code, that is an absence rather than a
      // bare ordinal — "2" on its own says nothing about a language.
      const label = labelFor(row, codeNames, rule);
      const raw = rule.useCodeLabel ? (label ?? '') : (read.value ?? '');
      const isNull = raw === '' || nulls.has(raw);

      if (!isNull) {
        const vocab = legal.get(parameter);
        if (vocab && !vocab.has(raw)) {
          // Out of the declared vocabulary — either the publisher's own
          // CodeTable or the manifest's list. Never coerced: a value the
          // vocabulary does not allow is a parsing fault or an upstream schema
          // change, and both need a human rather than a default.
          stats.outOfVocabulary.push({ language: languageId, parameter, value: raw });
          continue;
        }
      }

      // The source's own wording about WHEN or ON WHAT BASIS it says this,
      // preserved verbatim. ELCat's "Date Of Info" is free text — values like
      // "the 2002 census of the Russian Federation" — so parsing a year out of
      // it would be a derivation and must not wear ELCat's name.
      const comment = [row.Comment || null, read.context ? `[${rule.contextPath}: ${read.context}]` : null]
        .filter(Boolean).join(' ') || null;

      // A declared null token means the source COVERED this language and its
      // documentation did not answer. That is information, and it is not the
      // same as nobody having looked.
      write(languageId, parameter, isNull ? null : raw, {
        status: isNull ? STATUS.NOT_ATTESTED : STATUS.ASSERTED,
        codeId: !isNull && legal.get(parameter)?.has(raw) ? `${parameter}-${raw}` : null,
        comment,
      });
      if (isNull) stats.absence++; else stats.asserted++;

      // Some rows carry a bibliography key alongside the value. Glottolog's
      // `med` names WHICH description is the most extensive one, and a level
      // without its citation is an unfollowable claim.
      if (rule.sourceColumnTo && !isNull && row.Source) {
        write(languageId, rule.sourceColumnTo, String(row.Source));
        stats.asserted++;
      }
    }
  })();

  if (fromLanguageTable.length) {
    db.transaction(() => {
      for (const l of languages) {
        const languageId = toSpine.get(l.ID);
        if (!languageId) continue;
        for (const [column, rule] of fromLanguageTable) {
          const raw = (l[column] ?? '').trim();
          if (!raw || nulls.has(raw)) continue;
          write(languageId, rule.parameter, raw);
          stats.asserted++;
        }
      }
    })();
  }

  // ── Feature catalog (opt-in: spec.featureCatalog) ─────────────────────────
  if (spec.featureCatalog) {
    stats.featureCatalog = writeFeatureCatalog(db, {
      sourceId: src.id, source, values, toSpine, nulls,
    });
  }

  // ── Companion wordlist ──────────────────────────────────────────────────
  // Some deposits are DUAL-MODULE: a StructureDataset values.csv AND a
  // forms.csv in one release (liljegrenhindukush, barlowhandandfive,
  // zhoubizic, normansinitic). moduleOf() sees values.csv first, so the
  // lexical handler never ran and their forms silently never existed —
  // "pinned-no-forms" in the parity report. A forms.csv on disk is lexical
  // data whatever the declared module; route it through the SAME lexical
  // ingest (aggregate + license-gated forms sidecar) so the two module
  // classifications stop deciding what data exists.
  if (fs.existsSync(path.join(dir, 'forms.csv'))) {
    const lex = ingestLexical(db, {
      source, module: 'Wordlist', license: declaredLicense,
    });
    stats.companionWordlist = lex.written;
    stats.formsWritten = lex.formsWritten;
    stats.formsWithheldByLicense = lex.formsWithheldByLicense;
    stats.conceptsMapped = lex.conceptsMapped;
    stats.conceptsUnmapped = lex.conceptsUnmapped;
  }

  // A column read off the LanguageTable is mapped, not missing — counting it as
  // an unmapped upstream parameter would report coverage we do have as a gap.
  const languageTableColumns = new Set(fromLanguageTable.map(([c]) => c));
  stats.unmappedParameters = [...seenUpstreamParams]
    .filter((p) => !parameterMap[p] && !languageTableColumns.has(p)).length;
  return stats;
}
