/**
 * ingest-structure-attestation.mjs — a StructureDataset with no parameter map.
 *
 * ATTESTED, NOT INTERPRETED
 *   Nineteen typological datasets were discovered pinned on disk with no
 *   `parameterMap` — nobody has decided which of their features correspond to
 *   which of ours. There were two wrong answers to that. Ingesting their
 *   features under guessed mappings would put claims on cards nobody decided
 *   to make, which is the failure this whole rebuild exists to end. Holding
 *   them back entirely left correctly-licensed, DOI-pinned documentation
 *   invisible — the atlas could not even say the datasets EXIST for a language.
 *
 *   This is the third answer, and it is the same lane two precedents already
 *   use. Wordlists auto-ingest as lexical EXISTENCE without anyone deciding
 *   what each word means; PHOIBLE's counts are champollion-derived arithmetic
 *   because PHOIBLE states no counts anywhere. So a mapless StructureDataset
 *   asserts existence and extent — "uratyp codes this language, on N features"
 *   — and not one feature's content.
 *
 * GRADUATION IS A DECISION, AND THE PATH IS SHORT
 *   The moment somebody writes a `parameterMap` for one of these in
 *   source-manifest.json, the registry routes it to the full StructureDataset
 *   handler instead of this one. The map is the decision; this handler is what
 *   honesty looks like while nobody has made it.
 *
 * THE COUNT IS OURS
 *   No CLDF dataset states "we code language X on N features" — that number is
 *   counted over its rows. Per CLAUDE.md, a count we extract is a Champollion
 *   derivation carrying `champollion-derived` with Derived_From naming the
 *   release, never the upstream's name.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSVObjects } from '../lib/csv.mjs';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource, writeFeatureCatalog } from './ingest-structure.mjs';
import { ingestLexical } from './ingest-lexical.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { spineResolver } from './spine.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestStructureAttestation(db, spec = {}) {
  const { source, license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);

  const read = (name) => {
    const p = path.join(DATA, source, name);
    if (!fs.existsSync(p)) return null;
    return parseCSVObjects(fs.readFileSync(p, 'utf-8'), { file: `${source}/${name}` }).rows;
  };
  let values = read('values.csv');
  const langs = read('languages.csv');
  // CrossGram-style datasets (serzantjanicantipassives) publish an EMPTY
  // values.csv and put the codings in cvalues.csv, keyed by CONSTRUCTION —
  // constructions.csv carries the construction → language link. Same facts,
  // one join further away; flattening here keeps the counting identical.
  if (!values?.length) {
    const cvalues = read('cvalues.csv');
    const constructions = read('constructions.csv');
    if (cvalues?.length && constructions?.length) {
      const langOf = new Map(constructions.map((c) => [c.ID, c.Language_ID]));
      values = cvalues
        .map((r) => ({ Language_ID: langOf.get(r.Construction_ID), Parameter_ID: r.Parameter_ID }))
        .filter((r) => r.Language_ID && r.Parameter_ID);
    }
  }
  if (!values?.length || !langs?.length) {
    throw new Error(`${source}: values.csv or languages.csv is missing or empty — this `
      + 'handler exists precisely because the dataset HAS coded values, so an empty table '
      + 'is a fetch fault, not a small dataset.');
  }

  const resolve = spineResolver(db);
  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-structure-attestation.mjs',
  });

  // Features coded per upstream language id, counted DISTINCT — a dataset may
  // record several values for one (language, feature) and counting rows would
  // inflate the extent.
  const featuresByLang = new Map();
  for (const r of values) {
    if (!r.Language_ID || !r.Parameter_ID) continue;
    if (!featuresByLang.has(r.Language_ID)) featuresByLang.set(r.Language_ID, new Set());
    featuresByLang.get(r.Language_ID).add(r.Parameter_ID);
  }
  const totalFeatures = new Set(values.map((r) => r.Parameter_ID).filter(Boolean)).size;

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    features: totalFeatures,
    unmatched: [],
    unmatchedNoun: 'language',
    unmatchedNote:
      'Rows whose Glottocode/ISO code resolves to no spine language. Named because a '
      + 'dataset reported as covering fewer languages than it does is the same failure '
      + 'as one reported as covering more.',
  };
  const covered = new Set();

  db.transaction(() => {
    for (const l of langs) {
      const languageId = resolve.resolve(l.ISO639P3code ?? '', l.Glottocode ?? '');
      if (!languageId) {
        if (stats.unmatched.length < 8 && (l.Glottocode || l.ISO639P3code)) {
          stats.unmatched.push(l.Glottocode || l.ISO639P3code);
        }
        stats.offSpine++;
        continue;
      }
      const coded = featuresByLang.get(l.ID)?.size ?? 0;
      if (!coded) continue;
      covered.add(languageId);

      if (write(languageId, 'typologyResource', JSON.stringify({
        dataset: source,
        featuresCoded: coded,
        datasetFeatureTotal: totalFeatures,
      }), {
        // One axis per resource, same as every other resource entry — without
        // it, a language coded by five datasets reads as five sources
        // disagreeing about one thing.
        variantType: VARIANT.RESOURCE,
        variantId: `cldf:${source}`,
        derivedFrom: upstream.id,
        comment: `attestation only — ${coded} of ${totalFeatures} features coded, counted `
          + 'by us over the release; no feature CONTENT is ingested until a parameter '
          + 'map is written, because auto-ingesting semantics under guessed mappings '
          + 'puts claims on cards nobody decided to make',
        confidence: 'derived',
      })) { stats.asserted++; }
    }
  })();

  stats.languages = covered.size;

  // ── Companion wordlist ──────────────────────────────────────────────────
  // Dual-module deposits (a StructureDataset that ALSO ships forms.csv:
  // liljegrenhindukush, magram, barlowhandandfive, zhoubizic, normansinitic)
  // land here when mapless, and their lexical half must not depend on which
  // half the descriptor names first. Same routing as the full handler: the
  // lexical ingest owns aggregates + the license-gated forms sidecar.
  if (fs.existsSync(path.join(DATA, source, 'forms.csv'))) {
    const lex = ingestLexical(db, {
      source, module: 'Wordlist', license: declaredLicense,
    });
    stats.companionWordlist = lex.written;
    stats.formsWritten = lex.formsWritten;
    stats.formsWithheldByLicense = lex.formsWithheldByLicense;
    stats.conceptsMapped = lex.conceptsMapped;
    stats.conceptsUnmapped = lex.conceptsUnmapped;
  }

  // ── Feature catalog (opt-in: spec.featureCatalog) ─────────────────────────
  // Attestation-only stays the rule — no card field gets a guessed mapping.
  // But a source may be DECIDED into the store-only typology feature catalog
  // (APiCS: 334 features feeding the public catalogue's typology panel, no
  // card parameter map by decision). The catalog rows carry the UPSTREAM's
  // release id: a feature value is the publisher's claim, not a derivation.
  if (spec.featureCatalog) {
    const toSpine = new Map();
    for (const l of langs) {
      const languageId = resolve.resolve(l.ISO639P3code ?? '', l.Glottocode ?? '');
      if (languageId) toSpine.set(l.ID, languageId);
    }
    stats.featureCatalog = writeFeatureCatalog(db, {
      sourceId: upstream.id, source, values, toSpine, nulls: null,
    });
  }

  return stats;
}
