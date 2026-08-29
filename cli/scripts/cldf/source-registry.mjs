/**
 * source-registry.mjs — the source list, ASSEMBLED rather than maintained.
 *
 * THE PROBLEM THIS DISSOLVES
 *   Adding Keyman took five hand-steps: write a fetcher, run it, hand-edit
 *   `source-manifest.json`, write a handler, rebuild. Step three is the weak
 *   one, because nothing connects it to the other four — which is exactly how
 *   29 datasets came to be fetched, pinned, and never declared. 138 MB on disk
 *   that the build had never read a byte of, and no failure anywhere, because a
 *   hand-maintained list cannot notice something missing from it.
 *
 *   So the list stops being hand-maintained. A source declares itself where it
 *   is already defined, and the registry is assembled from those declarations:
 *
 *     bespoke fetcher   → `export const manifest = {...}` in its own module
 *     CLDF/Zenodo       → derived from zenodo-cldf-records.json (169 datasets,
 *                         whose module and licence the record already carries)
 *     hand-transcribed  → the two curated files, which have no upstream and are
 *                         what this rebuild exists to retire
 *
 *   A fetcher that exists is therefore a source the build knows about. There is
 *   no second place to remember.
 *
 * WHY THE JSON STILL EXISTS
 *   `source-manifest.json` remains, but as a GENERATED, reviewable artifact
 *   rather than the truth: a human reads a diff of it to see what a new source
 *   will claim before it claims it. A test asserts it matches what this module
 *   assembles, so the two can never drift the way four lists did.
 *
 * PARTIAL MIGRATION IS NAMED, NEVER SILENT
 *   Fetchers that have not yet been given a `manifest` export fall back to the
 *   checked-in JSON — and are REPORTED as doing so. A fallback nobody can see
 *   is the same failure one level down, so `undeclared` comes back in the
 *   result and the build prints it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const FETCHERS = path.join(__dirname, '..', 'fetchers');
const ZENODO = path.join(REPO, 'cli', 'data', 'zenodo-harvest', 'records.json');
const MANIFEST = path.join(REPO, 'shared', 'cldf', 'source-manifest.json');
const LANDSCAPE = path.join(REPO, 'shared', 'cldf', 'resource-landscape.json');

/**
 * How a CLDF module maps onto a handler and what that handler is entitled to
 * assert. Declared once here rather than repeated across 169 near-identical
 * manifest entries — which is what made them boilerplate worth generating.
 */
const CLDF_MODULE = {
  Wordlist: {
    handler: 'lexical',
    contributes: 'lexical resource existence and coverage',
    note: 'Existence and coverage only. A wordlist says how a language expresses a '
      + 'concept; it is not evidence of typology, and nothing typological is derived '
      + 'from it.',
  },
  Dictionary: {
    handler: 'lexical',
    contributes: 'lexical resource existence and coverage',
    note: 'Existence and coverage only.',
  },
  StructureDataset: {
    handler: 'StructureDataset',
    contributes: 'typological features',
    note: 'Values are the publisher\'s own coded features, read through the declared '
      + 'parameter map.',
  },
};

/**
 * Which CLDF module a pinned dataset is, read from the files it actually
 * contains. CLDF names its core table per module, so this is the publisher's
 * own answer rather than an inference: a dataset with `forms.csv` IS a
 * Wordlist. Reading it beats restating it in a second file, where the two can
 * disagree and one of them be wrong.
 */
function snapLicense(key) {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(REPO, 'cli', 'data', key, 'SNAPSHOT.json'), 'utf-8',
    )).license ?? null;
  } catch { return null; }
}

function moduleOf(key) {
  const snap = path.join(REPO, 'cli', 'data', key, 'SNAPSHOT.json');
  let files = [];
  try {
    files = (JSON.parse(fs.readFileSync(snap, 'utf-8')).files ?? [])
      .map((f) => path.basename(f.path));
  } catch {
    return null;
  }
  if (files.includes('values.csv')) return 'StructureDataset';
  if (files.includes('entries.csv')) return 'Dictionary';
  if (files.includes('forms.csv')) return 'Wordlist';
  return null;
}

/**
 * Sources a recorded verdict refuses. The landscape is where "we know this
 * exists and are deliberately not indexing it" lives; without consulting it,
 * deriving the registry from what is on disk would re-admit anything a person
 * decided to keep out, and do it silently.
 */
function rejectedByLandscape() {
  const out = new Map();
  try {
    const L = JSON.parse(fs.readFileSync(LANDSCAPE, 'utf-8'));
    for (const cls of Object.values(L.classes ?? {})) {
      for (const [pub, v] of Object.entries(cls.publishers ?? {})) {
        if (v.verdict === 'rejected') out.set(v.source ?? pub, v.evidence ?? 'rejected');
      }
    }
  } catch { /* no landscape yet — nothing is rejected */ }
  return out;
}

/**
 * Pins that are behind their upstream.
 *
 * A CLDF pin is a DOI and therefore immutable — re-fetching those bytes can
 * never change anything, so "is this stale" is not a question about the file.
 * It is a question about whether the publisher has released a NEWER version,
 * and the only thing that knows is the harvest index.
 *
 * Comparing the two is what turns that index from a lookup table into a
 * staleness detector. Before this, 169 of 189 sources could have gone a year
 * behind their upstream and nothing anywhere would have said so.
 *
 * Reported, never acted on: re-pinning an archive is a deliberate act, and
 * `cldf-zenodo` still refuses to fetch 2.3 GB as a side effect of a build.
 */
export function behindUpstream() {
  const out = [];
  if (!fs.existsSync(ZENODO)) return out;
  const records = JSON.parse(fs.readFileSync(ZENODO, 'utf-8')).sources ?? {};
  for (const [key, rec] of Object.entries(records)) {
    const snapPath = path.join(REPO, 'cli', 'data', key, 'SNAPSHOT.json');
    if (!fs.existsSync(snapPath)) continue;
    let snap;
    try {
      snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
    } catch { continue; }
    // ONLY sources this index actually pins. A source with its own dedicated
    // fetcher resolves its own DOI, and comparing that against a same-named
    // harvest record is meaningless — `glottolog` reported as behind itself,
    // v5.3 against v5.3, because the two resolve different Zenodo records.
    if (!String(snap.fetchedBy ?? '').endsWith('cldf-zenodo.mjs')) continue;
    const pinned = snap.pin ?? {};
    // The DOI is the identity of a specific release. A differing version string
    // with the same DOI is a metadata edit, not a new release, so the DOI is
    // what decides.
    if (!pinned.doi || !rec.doi || pinned.doi === rec.doi) continue;
    // THE LOUDEST SIGNAL A DATA OWNER CAN SEND is changing the terms on a new
    // release. "A newer version exists" is housekeeping; "the owner now says
    // different terms" is a decision they made about their own data, and
    // burying it inside a version note would be taking their control away by
    // formatting. Our copy stays governed by the terms it shipped under — a
    // grant is not retroactively rewritten — but the re-pin decision must be
    // made LOOKING AT the new terms, not discovering them afterwards.
    const newTerms = rec.license?.spdx ?? null;
    const termsChanged = Boolean(
      newTerms && snap.license && newTerms.toLowerCase() !== snap.license.toLowerCase(),
    );
    out.push({
      source: key,
      pinned: pinned.value ?? '?',
      upstream: rec.version ?? '?',
      released: rec.publicationDate ?? '?',
      termsChanged,
      pinnedLicense: snap.license ?? null,
      upstreamLicense: newTerms,
    });
  }
  return out.sort((a, b) => a.source.localeCompare(b.source));
}

/** Read every fetcher's self-declaration. A fetcher IS a source declaration. */
export async function fetcherDeclarations() {
  const out = new Map();
  for (const file of fs.readdirSync(FETCHERS).sort()) {
    if (!file.endsWith('.mjs')) continue;
    let mod;
    try {
      mod = await import(pathToFileURL(path.join(FETCHERS, file)).href);
    } catch {
      // Reported by audit-sources.mjs as an unreachable fetcher; not this
      // module's job to decide what an unimportable file means.
      continue;
    }
    if (!mod.source || !mod.manifest) continue;
    // `id` lets a declaration name the SOURCE the build knows, where that
    // differs from the fetcher's own name — cldr.mjs is `unicode-cldr` to the
    // sweep but `cldr` to the build, and keying on the wrong one would leave
    // the checked-in entry live alongside a duplicate self-declared one.
    out.set(mod.manifest.id ?? mod.source, {
      ...mod.manifest, declaredBy: `fetchers/${file}`,
    });
  }
  return out;
}

/**
 * Entries for the CLDF datasets pinned through cldf-zenodo. Their module and
 * licence are already in the harvested record, so restating them by hand in a
 * second file was 169 opportunities to disagree with the first.
 */
export function zenodoDeclarations({ onDiskOnly = true } = {}) {
  const out = new Map();
  if (!fs.existsSync(ZENODO)) return out;
  const records = JSON.parse(fs.readFileSync(ZENODO, 'utf-8')).sources ?? {};
  for (const [key, rec] of Object.entries(records)) {
    // A record we have never pinned is a dataset we could fetch, not one we
    // hold. Declaring it would make the build dispatch a handler at nothing.
    if (onDiskOnly && !fs.existsSync(path.join(REPO, 'cli', 'data', key, 'SNAPSHOT.json'))) {
      continue;
    }
    // The CLDF module is not in the Zenodo record — it is a property of what
    // the archive CONTAINS, so it is read from the pinned files rather than
    // restated. `forms.csv` is a wordlist, `values.csv` a structure dataset,
    // `entries.csv` a dictionary; that is CLDF's own convention, not ours.
    const module = moduleOf(key);
    const shape = CLDF_MODULE[module];
    if (!shape) continue;
    // THE SNAPSHOT IS THE EVIDENCE. The harvest record carries Zenodo's licence
    // field; the pin carries what the licence-evidence pass established from
    // the archive itself, and the two can disagree — normansinitic is CC-BY on
    // Zenodo and Apache-2.0 in its own LICENSE file. registerSource() refuses a
    // manifest that contradicts the pin, correctly: we do not carry two answers
    // to a licence question, and the pin is the one grounded in the bytes.
    out.set(key, {
      module,
      handler: shape.handler,
      license: snapLicense(key) ?? rec.license?.spdx ?? 'LicenseRef-Unestablished',
      contributes: shape.contributes,
      note: shape.note,
      declaredBy: 'cldf-zenodo record',
    });
  }
  return out;
}

/**
 * The assembled registry.
 *
 * @returns {Promise<{sources: Record<string, object>, fromFetcher: string[],
 *                    fromZenodo: string[], undeclared: string[]}>}
 */
export async function buildRegistry() {
  const checkedIn = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')).sources;
  const fromFetcher = await fetcherDeclarations();
  const fromZenodo = zenodoDeclarations();

  // AUTO-DISCOVERY MUST NOT OVERRULE A DECISION. Deriving the registry from
  // what is pinned means a dataset appears the moment it is fetched — which is
  // the point, and also a way to silently undo a refusal. D-PLACE is pinned,
  // fetchable, correctly licensed, and REJECTED (founder, 2026-08-07): its
  // fields are mid-century ethnographic coding of a PEOPLE, on a card that
  // describes a LANGUAGE. Discovery finds it; the decision layer keeps it out.
  const rejected = rejectedByLandscape();

  const sources = {};
  // Self-declarations win: the module that knows how to fetch a source is the
  // one that should say what it contributes.
  for (const [k, v] of fromZenodo) sources[k] = v;
  for (const [k, v] of fromFetcher) sources[k] = v;
  const refused = [];
  for (const k of Object.keys(sources)) {
    if (!rejected.has(k)) continue;
    delete sources[k];
    refused.push(k);
  }

  // Anything still only in the checked-in file has not been migrated yet. It is
  // carried so the build keeps working, and NAMED so the migration cannot
  // quietly stall — a fallback nobody can see is the original failure again.
  // MECHANICAL FACTS ARE DERIVED; DECISIONS ARE DECLARED.
  //
  // A source's module, handler and licence are properties of the thing itself
  // and are read from it. Its `parameterMap`, `nullTokens` and scale notes are
  // NOT: they record which upstream parameter we accept as which of ours, and
  // which tokens mean "not surveyed" rather than "no". Nobody can derive a
  // decision from a file, and a build that tried would be inventing the very
  // judgments the decision layer exists to keep visible.
  //
  // So the checked-in entry overlays the derived one wherever it exists. What
  // the derivation buys is that a source with NO entry still gets ingested —
  // which is the whole point, and what 29 pinned datasets never got.
  const undeclared = [];
  for (const [k, v] of Object.entries(checkedIn)) {
    if (rejected.has(k)) continue;
    if (sources[k]) {
      sources[k] = { ...sources[k], ...v };
      if (!fromFetcher.has(k)) undeclared.push(k);
      continue;
    }
    sources[k] = { ...v, declaredBy: 'source-manifest.json (not yet self-declaring)' };
    undeclared.push(k);
  }

  // DISCOVERED, BUT NOT YET DECIDED. A StructureDataset cannot be ingested from
  // its files alone: somebody has to say which upstream parameter counts as
  // which of ours, and which tokens mean "not surveyed" rather than "no". So a
  // dataset discovered on disk with no parameterMap is held back and NAMED,
  // rather than crashing the build or — far worse — being ingested under
  // guessed mappings. Discovery finds it; a person still decides what it says.
  //
  // The gate is narrow ON PURPOSE, and a first attempt at it was not: gating
  // every StructureDataset without a map held back four sources that work.
  // `nts` is metadataOnly — skipped by licence before dispatch, so it never
  // needs a map; `phoible` runs on the `aggregate` handler, which counts
  // segments rather than mapping parameters. Only a source that will actually
  // reach ingestStructureDataset needs one.
  // FETCHED AND PINNED, NEVER INGESTED. `zenodo-harvest` is the index that turns
  // a source name into a DOI — it must be fetched, verified and dated like any
  // other source, and nothing in it is a fact about a language. Declaring
  // `handler: null` says so; without this category the build tried to dispatch
  // it and died with `no handler for "(index)"`.
  const indexOnly = [];
  for (const [k, v] of Object.entries(sources)) {
    if (v.handler !== null) continue;
    indexOnly.push(k);
    delete sources[k];
  }

  // A StructureDataset with no parameterMap is ATTESTED, never interpreted.
  // Holding the mapless ones back entirely (the first design) left
  // correctly-licensed, DOI-pinned documentation invisible; ingesting their
  // features under guessed mappings would put claims on cards nobody decided
  // to make. So they route to the attestation handler — existence and feature
  // extent only — and the moment a person writes a parameterMap in the JSON,
  // the route flips to the full handler. The map IS the decision.
  const awaitingDecision = [];
  for (const [k, v] of Object.entries(sources)) {
    const handler = v.handler ?? v.module;
    if (handler !== 'StructureDataset') continue;
    if (v.metadataOnly) continue;
    if (v.parameterMap) continue;
    awaitingDecision.push(k);
    sources[k] = {
      ...v,
      handler: 'structureAttestation',
      note: `${v.note ? `${v.note} ` : ''}ATTESTATION ONLY: no parameterMap has been `
        + 'written, so existence and feature extent are recorded and no feature content '
        + 'is ingested. Writing a map in source-manifest.json graduates it.',
    };
  }

  return {
    awaitingDecision: awaitingDecision.sort(),
    sources: Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))),
    fromFetcher: [...fromFetcher.keys()].sort(),
    fromZenodo: [...fromZenodo.keys()].sort(),
    undeclared: undeclared.sort(),
    refused: refused.sort(),
    behind: behindUpstream(),
    indexOnly: indexOnly.sort(),
  };
}
