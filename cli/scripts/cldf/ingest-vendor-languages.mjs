/**
 * ingest-vendor-languages.mjs — fetched vendor coverage → method nodes + edges.
 *
 * THE FIRST HANDLER THAT WRITES A NON-LANGUAGE SUBJECT
 *   Every other handler in this directory asserts facts about languages. This
 *   one creates METHOD nodes in cldf_contributions and writes facts about them,
 *   which is the whole reason the value layer was generalised over subjects: the
 *   old store could not hold a fact about a method, so method cards had to be
 *   built by a second pipeline against a different database.
 *
 * NODES AND EDGES ARE DIFFERENT THINGS, WRITTEN DIFFERENTLY
 *   A method's own properties — how many languages its published list contains,
 *   whether it publishes pairs — are values ON THE METHOD.
 *
 *   Coverage is an EDGE, and it is written on the LANGUAGE with the method as
 *   the discriminator, exactly as `methodSupport` already was. Nobody authors an
 *   edge: the publisher's list is fetched, each code is resolved through the
 *   same tag resolver the CLI uses, and the edges fall out. Add a language
 *   upstream and the next build reflects it.
 *
 * THE CODES ARE THE VENDOR'S, AND THEY ARE NOT ISO 639-3
 *   Microsoft publishes BCP 47 including script-qualified forms (`zh-Hans`,
 *   `sr-Cyrl`); LibreTranslate publishes mostly ISO 639-1 plus two invented
 *   codes; Apertium publishes its own pair identifiers. Resolving them is
 *   exactly what the tag index is for, and the resolution carries its verdict —
 *   a vendor listing `zho` gets `via-macrolanguage` for Mandarin, never a
 *   silent upgrade to an exact claim.
 *
 * AN UNRESOLVED CODE IS COUNTED AND NAMED
 *   LibreTranslate ships `zt` for Chinese Traditional and `pb` for Brazilian
 *   Portuguese, which are its own inventions and resolve to nothing. Reporting
 *   49 of 51 as though it were full coverage is the shape of every mistake this
 *   rebuild undoes, so the remainder is listed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, readSnapshot } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { tagResolver } from './tag-registry.mjs';
import { valueWriter, VARIANT, SUBJECT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** How to read each vendor's file. Declared, never sniffed. */
const READERS = {
  'microsoft-translator': {
    file: 'microsoft.json',
    label: 'Microsoft Translator',
    codes: (j) => Object.keys(j.translation ?? {}),
    pairs: () => null,
  },
  libretranslate: {
    file: 'libretranslate.json',
    label: 'LibreTranslate',
    codes: (j) => j.map((l) => l.code),
    pairs: (j) => j.flatMap((l) => (l.targets ?? []).map((t) => [l.code, t])),
  },
  apertium: {
    file: 'apertium.json',
    label: 'Apertium',
    codes: (j) => [
      ...new Set((j.responseData ?? []).flatMap((p) => [p.sourceLanguage, p.targetLanguage])),
    ],
    pairs: (j) => (j.responseData ?? []).map((p) => [p.sourceLanguage, p.targetLanguage]),
  },
  'google-translate': {
    file: 'google.json',
    label: 'Google Cloud Translation',
    codes: (j) => (j.data?.languages ?? []).map((l) => l.language),
    pairs: () => null,
  },
  deepl: {
    file: 'deepl.json',
    label: 'DeepL',
    codes: (j) => j.map((l) => l.language),
    pairs: () => null,
  },
};

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestVendorLanguages(db, spec = {}) {
  const { source = 'vendor-languages', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);
  const snap = readSnapshot(source);
  const dir = path.join(DATA, source);

  const tags = tagResolver(db);
  const onMethod = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-vendor-languages.mjs',
    subjectType: SUBJECT.METHOD,
  });
  const onLanguage = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-vendor-languages.mjs',
  });
  const addNode = db.prepare(`
    INSERT INTO cldf_contributions (ID, Type, Name, Description, Citation)
    VALUES (?, 'method', ?, ?, ?) ON CONFLICT(ID) DO NOTHING
  `);

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    methods: 0, edges: 0, unresolved: [], unmatched: [],
    unmatchedNoun: 'vendor code',
    unmatchedNote:
      'Vendor-internal variant identifiers, not languages the spine is missing \u2014 '
      + 'Apertium ships orthography and region variants (cat_pre2017, por_PTpre1990) '
      + 'and LibreTranslate two invented codes (zt, pb).',
    skippedVendors: snap?.skipped ?? [],
  };
  const covered = new Set();

  db.transaction(() => {
    for (const [key, reader] of Object.entries(READERS)) {
      const file = path.join(dir, reader.file);
      // A vendor that could not be fetched has no file. It is already recorded
      // in the snapshot's `skipped` with a reason, so silence here is accounted
      // for rather than assumed.
      if (!fs.existsSync(file)) continue;

      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const codes = reader.codes(raw);
      const pairs = reader.pairs(raw);
      if (!codes.length) {
        throw new Error(
          `${source}/${reader.file} parsed to zero codes. That is a schema change, not a `
          + 'vendor that supports nothing.',
        );
      }

      const methodId = `method:${key}`;
      addNode.run(
        methodId, reader.label,
        `MT method. Coverage fetched from the vendor's own published endpoint.`,
        snap?.citation ?? null,
      );
      stats.methods++;

      // ── Facts about the METHOD ──────────────────────────────────────────
      // Counted by us over the fetched list, so champollion-derived. The
      // vendor's own advertised number, where it differs, is a separate claim
      // and belongs on the method's claims, not here.
      onMethod(methodId, 'methodLanguageCount', codes.length, {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: `counted from ${reader.file} as fetched`,
      });
      onMethod(methodId, 'methodPairsObserved', pairs ? '1' : '0', {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: pairs
          ? 'the publisher enumerates pairs, so this is read rather than assumed'
          : 'the publisher lists languages only; any pair claim would be an assumption',
      });
      if (pairs) {
        onMethod(methodId, 'methodPairCount', pairs.length, {
          confidence: 'derived', derivedFrom: upstream.id,
        });
      }

      // ── Edges: coverage, on the LANGUAGE ────────────────────────────────
      const unresolved = [];
      for (const code of codes) {
        // Vendors publish locales; the primary subtag is what names a language.
        const primary = String(code).toLowerCase().split('-')[0];
        const languageId = tags.resolve(primary);
        if (!languageId) { unresolved.push(code); continue; }
        covered.add(languageId);
        if (onLanguage(languageId, 'methodSupport', 'service', {
          variantType: VARIANT.METHOD,
          variantId: key,
          comment: `${reader.label} publishes "${code}" in its own language list`,
          confidence: 'fetched',
        })) { stats.asserted++; stats.edges++; }
      }
      if (unresolved.length) {
        stats.unresolved.push({ method: key, codes: unresolved });
        stats.offSpine += unresolved.length;
        // Named through the build's own `unmatched` channel so they appear in
        // the run rather than only in a return value nobody reads. Reporting
        // 130 of 138 as full coverage is the shape of every mistake this
        // rebuild undoes.
        stats.unmatched.push(
          `${key}: ${unresolved.slice(0, 6).join(', ')}`
          + (unresolved.length > 6 ? ` … (${unresolved.length})` : ''),
        );
      }
    }
  })();

  stats.languages = covered.size;
  return stats;
}
