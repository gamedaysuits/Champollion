#!/usr/bin/env node

/**
 * build-atlas.mjs — THE one command. Pinned sources → CLDF atlas → cards.
 *
 *     node cli/scripts/cldf/build-atlas.mjs
 *
 * IN ORDER
 *   0. FRESH. The store is deleted and rebuilt. A store that accumulates across
 *      runs is not a build output, and the previous one had grown to 5.66 M
 *      facts of which 70% were written by scripts that no longer exist.
 *   1. DECISION LAYER. parameters.csv and the source manifest — the small,
 *      tracked, reviewable part that says what we are prepared to assert.
 *   2. SPINE. LanguageTable from ISO 639-3 and Glottolog. Never from cards.
 *   3. VERIFY + INGEST. Every source re-hashed against its SNAPSHOT before a
 *      single value is read, then dispatched on the CLDF module its publisher
 *      declared.
 *   4. EMIT. A real CLDF StructureDataset, checkable by `cldf validate`.
 *   5. PROJECT. Cards, into a shadow directory. NEVER over the live corpus —
 *      cutover is a separate, deliberate act.
 *
 * WHAT IT REFUSES TO DO
 *   Continue past a drifted source, an undeclared null token, an out-of-
 *   vocabulary value, or a no-derivatives licence. Each of those produces data
 *   that cannot be defended, and a build that shrugs at them is how a corpus
 *   ends up full of claims nobody can trace.
 *
 * Usage:
 *   node cli/scripts/cldf/build-atlas.mjs --fetch      # refresh stale, then build
 *   node cli/scripts/cldf/build-atlas.mjs [--only grambank,elcat] [--out DIR]
 *   node cli/scripts/cldf/build-atlas.mjs --version v1.0.0
 *
 * Exit: 0 ok · 1 a step failed
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { openAtlas, loadParameters, ATLAS_DB } from './schema.mjs';
import { buildSpine } from './spine.mjs';
import { ingestStructureDataset } from './ingest-structure.mjs';
import { ingestAggregate } from './ingest-aggregate.mjs';
import { ingestLexical } from './ingest-lexical.mjs';
import { ingestGlottolog } from './ingest-glottolog.mjs';
import { ingestLinguameta } from './ingest-linguameta.mjs';
import { ingestIso639 } from './ingest-iso639.mjs';
import { ingestCldr } from './ingest-cldr.mjs';
import { ingestCldrPlurals } from './ingest-cldr-plurals.mjs';
import { ingestMethods, ingestMetrics } from './ingest-methods.mjs';
import { ingestIso15924 } from './ingest-iso15924.mjs';
import { ingestWikidata } from './ingest-wikidata.mjs';
import { ingestWikipedia } from './ingest-wikipedia.mjs';
import { ingestClics3 } from './ingest-clics3.mjs';
import { ingestIana } from './ingest-iana.mjs';
import { ingestCldrSupplemental } from './ingest-cldr-supplemental.mjs';
import { ingestLangtags } from './ingest-langtags.mjs';
import { ingestVendorLanguages } from './ingest-vendor-languages.mjs';
import { ingestHfModels } from './ingest-hf-models.mjs';
import { ingestGiellaltResources } from './ingest-giellalt-resources.mjs';
import { ingestOpusCorpora } from './ingest-opus-corpora.mjs';
import { ingestKeymanKeyboards } from './ingest-keyman-keyboards.mjs';
import { ingestUdTreebanks } from './ingest-ud-treebanks.mjs';
import { ingestCommonVoice } from './ingest-common-voice.mjs';
import { ingestStructureAttestation } from './ingest-structure-attestation.mjs';
import { buildRegistry } from './source-registry.mjs';
import { refreshSources } from './refresh.mjs';
import { emitAtlas } from './emit.mjs';
import { emitForms } from './emit-forms.mjs';
import { deriveOrthographicStatus } from './derive-orthographic-status.mjs';
import { buildTagIndex } from './emit-tag-index.mjs';
import { assertSubjectIntegrity } from './values.mjs';
import { projectCards } from './project.mjs';
import { projectLocales } from './project-locales.mjs';
import { parseCSVObjects } from '../lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const ONLY = (flag('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
// ONE COMMAND. --fetch refreshes what has gone stale and then builds, so "cards
// from source" is a thing you run rather than a sequence you remember.
const FETCH = argv.includes('--fetch') || argv.includes('--fetch-all');
const FETCH_ALL = argv.includes('--fetch-all');
const OUT = flag('out', path.join(REPO, 'build', 'atlas'));
const VERSION = flag('version', 'unreleased');

const t0 = Date.now();
const step = (n, t) => console.log(`\n▸ ${n}. ${t}`);
const n = (x) => Number(x).toLocaleString();

// The build stamp is the release version and the source pins, never wall-clock:
// a timestamp in the output would make two identical builds differ, and
// "same pins in, same bytes out" is the property that makes the atlas checkable.
const builtAt = new Date().toISOString().slice(0, 10);

console.log('\n  CHAMPOLLION ATLAS — building from pinned sources\n');

if (VERSION === 'unreleased') {
  // Unversioned builds stay cheap — experiments never need a name. But
  // cutover-cards.mjs REFUSES an unversioned projection: cutting over is the
  // release act, and requireAtlas() (the drift tripwire) can only pin a build
  // somebody named.
  console.log('  ⚠ NOT A RELEASE — no --version given; cards will stamp');
  console.log('    _atlas.version: "unreleased" and cutover will REFUSE this build.');
  console.log('    For a release: node cli/scripts/cldf/build-atlas.mjs --version <YYYY.M.P>\n');
}

// ── 0. Refresh ──────────────────────────────────────────────────────────────
if (FETCH) {
  step(0, FETCH_ALL ? 'Refresh every source (forced)' : 'Refresh stale sources');
  const r = await refreshSources({ all: FETCH_ALL, only: ONLY.length ? ONLY : null });
  console.log(`    ✓ ${r.refreshed.length} refreshed`
    + (r.refreshed.length ? `: ${r.refreshed.join(', ')}` : '')
    + ` · ${r.skipped.length} already fresh`);
  for (const f of r.failed) {
    // Loud, and not fatal. The pin already on disk is still verified, still
    // cited, and still honest about its retrieval date; losing a whole build
    // because an upstream is down would be the worse failure.
    console.log(`    ! ${f.source}: could not refresh — ${f.why}`);
    console.log('      Building from the existing pin, which is older but not wrong.');
  }
}

// ── 0/1. Fresh store + decision layer ───────────────────────────────────────
step(1, 'Decision layer');
const { rows: parameterRows } = parseCSVObjects(
  fs.readFileSync(path.join(REPO, 'shared', 'cldf', 'parameters.csv'), 'utf-8'),
  { file: 'shared/cldf/parameters.csv' },
);
// ASSEMBLED, not read. A hand-maintained source list cannot notice something
// missing from it, which is how 29 pinned datasets went unread. The registry is
// built from fetchers that declare themselves and from the CLDF datasets
// actually on disk, so fetching a source is what makes the build know about it.
const registry = await buildRegistry();
const manifest = { sources: registry.sources };

// A PARTIAL BUILD GETS ITS OWN STORE. `--only` rebuilds the store fresh, so
// writing it to atlas.db leaves a one-source database that looks exactly like a
// complete one — and ATLAS-RELEASE.json, written by the last FULL build, then
// describes something the store no longer contains. I hit this: a
// `--only keyman-keyboards` run left the store holding one source and the next
// command read it as the whole atlas. Separate file, so the real one is never
// clobbered by a subset.
const STORE = ONLY.length
  ? path.join(path.dirname(ATLAS_DB), 'atlas-partial.db')
  : ATLAS_DB;
const db = openAtlas({ fresh: true, file: STORE });
loadParameters(db, parameterRows);
const built = parameterRows.filter((p) => p.Disposition === 'DONE' || p.Disposition === 'PARTIAL');
console.log(`    ✓ ${parameterRows.length} parameters (${built.length} built)`);
console.log(`    ✓ ${Object.keys(manifest.sources).length} sources assembled `
  + `(${registry.fromFetcher.length} self-declared by their fetcher, `
  + `${registry.fromZenodo.length} derived from pinned CLDF, `
  + `${registry.undeclared.length} still read from source-manifest.json)`);
if (registry.awaitingDecision.length) {
  // Found by discovery, held back by the decision layer. Named every build so
  // the backlog is a number somebody can act on rather than a silence.
  console.log(`    · ${registry.awaitingDecision.length} StructureDataset(s) have no parameter `
    + `map — ingested as ATTESTATION ONLY (existence + feature extent, no content): `
    + `${registry.awaitingDecision.slice(0, 6).join(', ')}`
    + `${registry.awaitingDecision.length > 6 ? ', …' : ''}`);
  console.log('      Writing a parameterMap in source-manifest.json graduates one to full '
    + 'ingestion.\n      The map is the decision; attestation is what honesty looks like '
    + 'while nobody has\n      made it.');
}
if (registry.indexOnly.length) {
  console.log(`    · ${registry.indexOnly.length} fetched and pinned but NEVER INGESTED `
    + `(an index, not a dataset): ${registry.indexOnly.join(', ')}`);
}
if (registry.behind.length) {
  // The whole reason the harvest became a source. A CLDF pin is a DOI and
  // cannot rot, so "stale" is never about the bytes — it is about the publisher
  // having released a newer version, and nothing said so until now.
  console.log(`    · ${registry.behind.length} source(s) BEHIND their upstream:`);
  for (const b of registry.behind.slice(0, 8)) {
    console.log(`        ${b.source.padEnd(24)} pinned ${String(b.pinned).padEnd(12)}`
      + `→ upstream ${String(b.upstream).padEnd(12)} (${b.released})`);
    if (b.termsChanged) {
      // The owner changed their terms. That is the one line here that is not
      // housekeeping, so it does not share a line with housekeeping.
      console.log(`        ${' '.repeat(24)} ⚠ THE OWNER CHANGED THE TERMS: pinned copy is `
        + `${b.pinnedLicense}, the new release is ${b.upstreamLicense}. Our copy stays `
        + 'governed by what it shipped under; re-pin only after reading the new terms.');
    }
  }
  console.log('      Re-pinning is a deliberate act, not a build side effect: '
    + '`fetch-source.mjs\n      cldf-zenodo --source <name>`. The current pin is old, '
    + 'not wrong.');
}
if (registry.refused.length) {
  // Discovery finding something a person decided to keep out is exactly the
  // case where silence would be worst.
  console.log(`    · ${registry.refused.length} refused by a recorded verdict: `
    + registry.refused.join(', '));
}

// ── 2. Spine ────────────────────────────────────────────────────────────────
step(2, 'Spine — ISO 639-3 + Glottolog');
const spine = buildSpine(db);
console.log(`    ✓ ${n(spine.total)} languages `
  + `(${n(spine.fromIso)} ISO-registered, ${n(spine.glottologOnly)} Glottolog-only)`);

// ── 3. Ingest ───────────────────────────────────────────────────────────────
// Alphabetical, EXCEPT that handlers deriving from other sources' values run
// last. iso15924 resolves script codes LinguaMeta put in the store; in
// alphabetical order it would resolve an empty table and report a clean run
// over zero rows — the same shape as the macrolanguage measurement that read
// zero because it ran before iso639-3.
// The three BCP 47 registries join on `iso639_1` values that ingest-iso639
// writes, so a two-letter subtag like `zh` cannot be resolved until SIL has
// run. Alphabetically all three sort BEFORE iso639-3, which would have given
// three clean runs over zero rows. tagResolver() also refuses to start on an
// empty map, so this list and that guard have to both fail before a silent
// empty ingest is possible.
const RUNS_LAST = new Set([
  // Resolves macrolanguage locales (ar, fa, he, ur) through the store's
  // iso639_1 values, which ingest-iso639 writes — alphabetically 'cldr' runs
  // first and the fallback silently queried an empty table, which is exactly
  // the shape of failure this list documents.
  'cldr',
  'iso15924', 'wikipedia', 'cldr-plurals',
  'iana-subtag-registry', 'cldr-supplemental', 'sil-langtags',
  // Resolves vendor locale tags through the in-store resolver, so it needs
  // iso639_1 present — same ordering constraint as the registries above.
  'vendor-languages', 'hf-models', 'giellalt-resources',
  // Resolves OPUS's own locale codes (pt_BR, zh_CN) through the in-store
  // resolver, so it has the same ordering constraint as the vendor lists.
  'opus-corpora',
  // Resolves Mozilla's BCP-47-ish locales (pt, zh-CN, ga-IE) through the same
  // in-store resolver — same ordering constraint. (ud-treebanks is NOT here:
  // UD's registry assigns iso3 codes, which resolve on the spine directly.)
  'common-voice',
]);
const selected = Object.entries(manifest.sources)
  .filter(([name]) => !ONLY.length || ONLY.includes(name))
  .sort(([a], [b]) => (RUNS_LAST.has(a) ? 1 : 0) - (RUNS_LAST.has(b) ? 1 : 0));
step(3, `Verify + ingest ${selected.length} source(s)`);
if (ONLY.length) {
  // --only REBUILDS THE STORE FRESH from a subset, so atlas.db afterwards holds
  // only those sources while looking exactly like a complete one. That is not
  // hypothetical: a `--only keyman-keyboards` run left the store with one
  // source in it and the next command read it as the whole atlas. Said loudly,
  // and stamped in the release so an artifact cannot claim to be complete.
  console.log(`    ! PARTIAL BUILD — only: ${ONLY.join(', ')}`);
  console.log('      Written to atlas-partial.db, NOT atlas.db, so a subset cannot be '
    + 'mistaken\n      for the atlas by anything that reads the store afterwards.');
}

// Dispatch on the DECLARED CLDF module, except where a source's shape means a
// module handler would produce the wrong kind of claim. PHOIBLE is a
// StructureDataset, but its values are segments and what a card needs is a
// COUNT of them -- which is ours, not PHOIBLE's. A manifest entry may therefore
// name a handler explicitly, and doing so is a decision recorded in the
// manifest rather than a special case buried in code.
const HANDLERS = {
  StructureDataset: ingestStructureDataset,
  aggregate: ingestAggregate,
  lexical: ingestLexical,
  glottolog: ingestGlottolog,
  linguameta: ingestLinguameta,
  iso639: ingestIso639,
  cldr: ingestCldr,
  cldrPlurals: ingestCldrPlurals,
  methods: ingestMethods,
  metrics: ingestMetrics,
  iso15924: ingestIso15924,
  wikidata: ingestWikidata,
  wikipedia: ingestWikipedia,
  clics3: ingestClics3,
  iana: ingestIana,
  cldrSupplemental: ingestCldrSupplemental,
  langtags: ingestLangtags,
  vendorLanguages: ingestVendorLanguages,
  hfModels: ingestHfModels,
  giellaltResources: ingestGiellaltResources,
  opusCorpora: ingestOpusCorpora,
  keymanKeyboards: ingestKeymanKeyboards,
  udTreebanks: ingestUdTreebanks,
  commonVoice: ingestCommonVoice,
  structureAttestation: ingestStructureAttestation,
};
let totalAsserted = 0;
let totalAbsence = 0;
let totalForms = 0;
let formsWithheldSources = 0;
let metadataOnly = 0;
const verified = [];
const handTranscribed = [];

for (const [name, spec] of selected) {
  if (spec.metadataOnly) {
    // Say WHICH constraint, not a blanket "forbids derivatives": one of these
    // is a rights-holder saying no, and one is us not knowing. Reporting them
    // identically would hide an open question behind a settled one.
    const why = /^LicenseRef-Unestablished/i.test(spec.license)
      ? 'terms could not be established — no permission inferred'
      : `${spec.license} forbids derivatives`;
    console.log(`    · ${name.padEnd(18)} metadata only — ${why}`);
    metadataOnly++;
    continue;
  }
  // ── Integrity, centrally, BEFORE a single value is read ────────────────────
  // 18 of 21 handlers already call verify() themselves, which covered 186 of
  // 187 sources — and the one that did not (`methods`) went unnoticed for
  // exactly as long as verification was a convention rather than a checkpoint.
  // A per-handler habit cannot tell you it has a hole in it; this can.
  //
  // A source with no SNAPSHOT is not quietly tolerated: it must say so in the
  // manifest and say why, the same way audit-sources.mjs requires a reason for
  // a deliberately-unused dataset. Silence and a stated exception must never
  // look the same.
  if (spec.module === '(curated)') {
    // Hand-transcribed, so there is nothing to re-hash. These are the sources
    // this rebuild exists to retire; counted, never verified, never silent.
    handTranscribed.push(name);
  } else {
    const v = verify(name);
    if (!v.ok) {
      const why = v.problems?.[0]?.why ?? 'drifted';
      console.error(
        `    ✗ ${name}: does not match its SNAPSHOT (${why}).\n`
        + '      The bytes on disk are not the bytes that were pinned, so every value read '
        + 'from\n      them would cite a release it did not come from. Re-fetch, or restore '
        + 'the pin.',
      );
      db.close();
      process.exit(1);
    }
    verified.push(name);
  }

  const handler = HANDLERS[spec.handler ?? spec.module];
  if (!handler) {
    console.error(`    ✗ ${name}: no handler for "${spec.handler ?? spec.module}"`);
    db.close();
    process.exit(1);
  }
  let s;
  try {
    s = handler(db, { source: name, ...spec });
  } catch (err) {
    console.error(`    ✗ ${name}: ${err.message}`);
    db.close();
    process.exit(1);
  }

  if (s.outOfVocabulary?.length) {
    // Fatal by default. A value outside a source's OWN codelist means we misread
    // that source, and a default would bury it. Non-fatal only where the
    // manifest says so WITH a reason — currently just the ISO 15924 join, where
    // an unresolvable code is an upstream's non-standard value that we decline
    // to correct rather than evidence of a misread.
    if (spec.outOfVocabularyFatal === false) {
      console.log(`      · ${s.outOfVocabulary.length} unresolved: `
        + `${s.outOfVocabulary.slice(0, 3).map((o) => `${o.language}/${o.value}`).join(', ')}`
        + ' — reported, not corrected');
    } else {
      console.error(`    ✗ ${name}: ${s.outOfVocabulary.length} value(s) outside the declared `
        + `vocabulary, first ${JSON.stringify(s.outOfVocabulary[0])}`);
      console.error('      A value the vocabulary does not allow is a parsing fault or an');
      console.error('      upstream schema change. Neither gets a default.');
      db.close();
      process.exit(1);
    }
  }
  if (s.malformed) {
    console.error(`    ✗ ${name}: ${s.malformed} cell(s) the manifest calls JSON and which are not`);
    db.close();
    process.exit(1);
  }

  if (s.countOnlySkipped?.length) {
    for (const c of s.countOnlySkipped) {
      console.log(`      · ${c.method} claims ${c.claimedCount.toLocaleString()} languages and `
        + 'publishes NO list — counted, never distributed across languages we guessed at');
    }
  }
  if (s.unmatched?.length) {
    // Counted and named, never quietly dropped: reporting 331 of 348 as though
    // it were full coverage is the shape of every mistake this rebuild undoes.
    //
    // The EXPLANATION comes from the handler, because only it knows what an
    // unmatched entry means. This line used to end "not a language without a
    // Wikipedia" for every source, so the vendor handler's Apertium variant
    // codes were reported as missing Wikipedias.
    console.log(`      · ${s.unmatched.length} ${s.unmatchedNoun ?? 'entry'}(s) matched no `
      + `spine language: ${s.unmatched.slice(0, 8).join(', ')}`
      + `${s.unmatched.length > 8 ? ' …' : ''}`);
    if (s.unmatchedNote) console.log(`        ${s.unmatchedNote}`);
  }
  if (s.featureCatalog) {
    console.log(`      · ${n(s.featureCatalog)} feature value(s) → typologyFeature catalog (store-only)`);
  }
  if (s.formsWritten) {
    const mapped = s.conceptsMapped ?? 0;
    const unmapped = s.conceptsUnmapped ?? 0;
    const ratio = mapped + unmapped
      ? ` (${Math.round((mapped / (mapped + unmapped)) * 100)}% concepticon-mapped)` : '';
    console.log(`      · ${n(s.formsWritten)} form(s) → cldf_forms sidecar${ratio}`);
    totalForms += s.formsWritten;
  }
  if (s.formsWithheldByLicense) {
    // The vocabulary explorer's hole for this source is a stated licensing
    // outcome, never a mystery: counts ship, contents do not.
    console.log(`      · forms withheld: license does not permit redistribution `
      + `(${n(s.formsWithheldByLicense)} row(s) counted, not carried)`);
    formsWithheldSources++;
  }
  totalAsserted += s.asserted ?? s.written ?? 0;
  totalAbsence += s.absence ?? 0;
  console.log(`    ✓ ${name.padEnd(14)} ${n(s.asserted ?? s.written ?? 0).padStart(8)} asserted  `
    + `${n(s.absence ?? 0).padStart(6)} absence  ${n(s.offSpine ?? 0).padStart(6)} off-spine  `
    + (s.unmappedParameters !== undefined
      ? `(${s.unmappedParameters} upstream parameter(s) not mapped)`
      : `(derived over ${n(s.languages ?? 0)} language(s))`));
}
console.log(`    ${n(totalAsserted)} asserted · ${n(totalAbsence)} recorded absences`
  + (metadataOnly ? ` · ${metadataOnly} source(s) metadata-only by licence` : ''));
if (totalForms || formsWithheldSources) {
  console.log(`    ${n(totalForms)} lexical form(s) in the cldf_forms sidecar`
    + (formsWithheldSources
      ? ` · ${formsWithheldSources} source(s) withheld forms by licence` : ''));
}

// ── 3a½. Store-level derivations ────────────────────────────────────────────
// Cross-source syntheses that need every signal parameter ingested first.
// orthographicStatus: positive rungs only — the retired 'unwritten' rung is
// the mistake the Status column exists to end (retired-parameters.csv).
{
  const o = deriveOrthographicStatus(db);
  console.log(`    ✓ orthographicStatus derived for ${n(o.asserted)} language(s): `
    + Object.entries(o.byStatus).map(([k, v]) => `${k} ${n(v)}`).join(' · '));
}

// Integrity, stated as a number rather than implied by the absence of a
// complaint. The header has always promised every source is re-hashed before a
// value is read; until this line, nothing said whether it had happened, and one
// source had been skipping it unnoticed.
console.log(`    ${n(verified.length)} source(s) re-hashed against their SNAPSHOT`
  + (handTranscribed.length
    ? ` · ${handTranscribed.length} hand-transcribed and UNPINNABLE: `
      + `${handTranscribed.join(', ')}`
    : ''));
if (handTranscribed.length) {
  console.log('      Hand-transcribed sources cannot be re-hashed because there is no '
    + 'upstream to\n      re-hash against. That is what this rebuild exists to retire, so '
    + 'they are named\n      here every build rather than quietly excluded from the count.');
}

// ── The macrolanguage boundary, measured after every source has run ─────────
// Providers publish coverage against MACROLANGUAGE codes: Google lists `swa`,
// not `swh`. Whether the individual languages under it are covered has no
// default answer, and both defaults are wrong — propagating claims Google
// translates Coastal Swahili because it translates "Swahili"; ignoring it makes
// a Fanti card read "no machine translation" while Google supports Akan.
//
// So neither. It is measured and reported, the card keeps its `macrolanguage`
// link so a reader can follow it, and the ruling is the founder's.
{
  const covered = new Set(
    db.prepare("SELECT DISTINCT Subject_ID FROM cldf_values WHERE Parameter_ID='methodSupport'")
      .all().map((r) => r.Subject_ID),
  );
  if (covered.size) {
    const macro = new Set(
      db.prepare("SELECT DISTINCT Value FROM cldf_values WHERE Parameter_ID='macrolanguage'")
        .all().map((r) => r.Value),
    );
    const members = db.prepare(
      "SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID='macrolanguage'",
    ).all();
    const onMacro = [...covered].filter((c) => macro.has(c)).length;
    const shadowed = members.filter((m) => covered.has(m.Value) && !covered.has(m.Subject_ID)).length;
    if (shadowed) {
      console.log(`\n  MACROLANGUAGE BOUNDARY — an open question, not a defect:`);
      console.log(`    ${onMacro} macrolanguage(s) carry method coverage`);
      console.log(`    ${shadowed} individual language(s) sit under a covered macrolanguage`);
      console.log('    with no coverage of their own. NOT propagated (a macrolanguage can');
      console.log('    have members a service has never seen) and NOT hidden (the card keeps');
      console.log('    its macrolanguage link). Needs a founder ruling.');
    }
  }
}

// ── Subject integrity ───────────────────────────────────────────────────────
// The foreign key SQLite cannot express: a value's Subject_ID must resolve in
// the table its Subject_Type names — cldf_languages for a language, and
// cldf_contributions for a corpus or a method. Without this a mistyped subject
// is simply a fact about nothing, which is the exact shape of silent emptiness
// this pipeline keeps finding in its predecessor.
{
  const { ok, dangling } = assertSubjectIntegrity(db);
  if (!ok) {
    const total = dangling.reduce((a, d) => a + d.n, 0);
    console.error(`\n  ✗ ${n(total)} value(s) name a subject that exists in no node table:`);
    for (const d of dangling.slice(0, 8)) {
      console.error(`      ${d.Subject_Type} "${d.Subject_ID}" — ${n(d.n)} value(s)`);
    }
    if (dangling.length > 8) console.error(`      … and ${dangling.length - 8} more`);
    db.close();
    process.exit(1);
  }
}

const unpinned = db.prepare(
  'SELECT COUNT(*) c FROM cldf_values v LEFT JOIN cldf_sources s ON v.Source = s.ID WHERE s.ID IS NULL',
).get().c;
if (unpinned) {
  console.error(`\n  ✗ ${unpinned} value(s) name a source with no release. Build stopped.`);
  db.close();
  process.exit(1);
}

// ── 3c. Ingestion contract ──────────────────────────────────────────────────
// check-ingestion.mjs promised "checked on every build" in its header for its
// entire life while nothing called it — and in that unwatched time it also
// silently broke, reporting 67 phantom failures after the register gained a
// column. A gate has to run to be a gate. Skipped on --only builds, where a
// contract over the full source set would correctly scream about every source
// the subset omits.
if (!ONLY.length) {
  step('3c', 'Ingestion contract — coverage baselines + golden records');
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'check-ingestion.mjs')], {
      stdio: 'inherit',
    });
  } catch {
    console.error('\n  ✗ the ingestion contract failed. A drifted coverage baseline or a '
      + 'lost golden\n    record means a source did not ingest the way the last verified '
      + 'build did.\n    Review, then re-capture if the change is legitimate. Build stopped.');
    db.close();
    process.exit(1);
  }
}

// ── 4. Emit + validate ──────────────────────────────────────────────────────
step(4, 'Emit CLDF StructureDataset');
const cldfDir = path.join(OUT, 'cldf', 'champollion-atlas');
const counts = emitAtlas(db, cldfDir, { version: VERSION, builtAt });
console.log(`    ✓ ${n(counts.values)} values · ${n(counts.languages)} languages · `
  + `${counts.parameters} parameters · ${counts.codes} codes · ${counts.sources} sources`);
console.log(`      ${path.relative(REPO, cldfDir)}/`);

const cldfBin = path.join(REPO, 'arena', '.venv', 'bin', 'cldf');
if (fs.existsSync(cldfBin)) {
  try {
    const out = execFileSync(cldfBin,
      ['validate', path.join(cldfDir, 'StructureDataset-metadata.json')],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`    ✓ cldf validate — clean${out.trim() ? `\n${out.trim()}` : ''}`);
  } catch (err) {
    console.error(`    ✗ cldf validate FAILED\n${err.stdout ?? ''}${err.stderr ?? ''}`);
    db.close();
    process.exit(1);
  }
} else {
  console.error('    ✗ pycldf is not installed in arena/.venv — the atlas cannot be validated.');
  console.error('      Run: arena/.venv/bin/pip install pycldf');
  db.close();
  process.exit(1);
}

// ── 4b. Tag resolution index ────────────────────────────────────────────────
// Emitted BEFORE the cards, because it is what a consumer uses to find a card
// in the first place. Every runtime resolves codes through this one artifact
// instead of each carrying its own idea of what `zh` means.
step('4b', 'Emit tag-resolution index');
const { index: tagIndex, stats: tagStats } = buildTagIndex(db, { version: VERSION, builtAt });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'tag-index.json'), `${JSON.stringify(tagIndex, null, 2)}\n`);
console.log(`    ✓ ${n(tagStats.tags)} resolvable code(s) → ${n(tagStats.languages)} languages`);
console.log(`      ${tagStats.macrolanguages} macrolanguage(s); `
  + `${tagStats.withPredominant} have a predominant member both registries agree on`);
if (tagStats.noPredominant.length) {
  console.log(`      ${tagStats.noPredominant.length} do NOT `
    + `(${tagStats.noPredominant.join(', ')}) — reported, never guessed`);
}

// ── 5. Project ──────────────────────────────────────────────────────────────
step(5, 'Project cards');
const { cards, stats } = projectCards(db, { version: VERSION, builtAt });

// Locale cards, ENUMERATED from SIL langtags — never a curated list. A locale
// is a projection of its language with territory/script-scoped values
// resolved; it asserts nothing its language does not.
const tagResolve = (sub) => {
  if (cards.has(sub)) return sub;
  const row = db.prepare(
    "SELECT Subject_ID FROM cldf_values WHERE Parameter_ID='iso639_1' AND Value=? LIMIT 1",
  ).get(sub);
  return row?.Subject_ID ?? null;
};
const { locales, stats: localeStats } = projectLocales(cards, tagResolve, db);
for (const [code, card] of locales) cards.set(code, card);
console.log(`    ✓ ${n(localeStats.emitted)} locale card(s) from `
  + `${n(localeStats.published)} published tags`
  + (localeStats.offSpine
    ? ` · ${localeStats.offSpine} off-spine (${localeStats.offSpineTags.slice(0, 4).join(', ')}…)`
    : ''));
// One directory per subject. All three card types come out of this one
// projector now, and writing a method card into cards-language/ — which is
// what happened the first time methods reached here — would have every
// consumer of that directory read it as a language.
const byType = new Map();
for (const [code, card] of [...cards].sort(([a], [b]) => a.localeCompare(b))) {
  const type = card._card?.type ?? 'language';
  if (!byType.has(type)) byType.set(type, []);
  byType.get(type).push([code, card]);
}
for (const [type, entries] of [...byType].sort(([a], [b]) => a.localeCompare(b))) {
  const cardDir = path.join(OUT, `cards-${type}`);
  fs.rmSync(cardDir, { recursive: true, force: true });
  fs.mkdirSync(cardDir, { recursive: true });
  for (const [code, card] of entries) {
    // A method id is `method:hf:Helsinki-NLP/opus-mt-en-fr`. The type already
    // names the directory, so the `method:` prefix is redundant — and the rest
    // carries both a colon and a slash, neither of which survives as a
    // filename. Sanitised rather than split: the first version took everything
    // after the first colon and crashed on the slash, which is the sort of thing
    // that only shows up when a real id arrives.
    const file = `${code.replace(/^[a-z]+:/, '').replace(/[/:\\]/g, '__')}.json`;
    fs.writeFileSync(path.join(cardDir, file), `${JSON.stringify(card, null, 2)}\n`);
  }
}
console.log(`    ✓ ${n(stats.cardsProjected)} cards · ${n(stats.fieldInstances)} field instances`);
console.log(`      by type: ${[...byType].map(([t, e]) => `${t} ${n(e.length)}`).join(' · ')}`);
console.log(`      ${n(stats.noCardAtAll)} spine language(s) have no asserted value and so get NO card`);
console.log(`      ${n(stats.absenceRecorded)} recorded absences (kept in the atlas, never on a card)`);
console.log(`      agreement: ${n(stats.multipleAssessments)} multiple-assessments · `
  + `${n(stats.conflicts)} cross-source conflicts · ${n(stats.incommensurable)} incommensurable`);

// ── 5b. Forms sidecar artifacts ─────────────────────────────────────────────
// The vocabulary explorer's data: complete redistributable form lists, one
// file per language, streamed from cldf_forms (never through project.mjs —
// forms are not card facts; see the sidecar note in schema.mjs).
if (db.prepare('SELECT COUNT(*) AS c FROM cldf_forms').get().c > 0) {
  step('5b', 'Emit vocabulary forms sidecar');
  const formCounts = emitForms(db, OUT, { version: VERSION, builtAt });
  console.log(`    ✓ ${n(formCounts.forms)} form(s) → ${n(formCounts.languages)} language file(s) `
    + `from ${n(formCounts.sources)} pinned release(s)`);
  console.log(`      ${path.relative(REPO, path.join(OUT, 'forms'))}/`);
}

// ── Release manifest ────────────────────────────────────────────────────────
const sources = db.prepare('SELECT * FROM cldf_sources ORDER BY ID').all();
const corpusHash = createHash('sha256');
for (const [code, card] of [...cards].sort(([a], [b]) => a.localeCompare(b))) {
  corpusHash.update(code).update(JSON.stringify(card));
}
// ── Publication readiness ───────────────────────────────────────────────────
// The atlas may be BUILT from everything we are licensed to use. It may not be
// PUBLISHED from all of it. Stating the difference here, every build, is what
// keeps it from being discovered at publication time by someone who has to
// remember it.
const restricted = sources.filter((s) => !s.Redistributable);
const nonCommercial = sources.filter((s) => !s.Commercial_Use);
if (restricted.length || nonCommercial.length) {
  console.log('\n  PUBLICATION — the build is not the release:');
  for (const s of restricted) {
    const vals = db.prepare('SELECT COUNT(*) c FROM cldf_values WHERE Source = ?').get(s.ID).c;
    // A spine source contributes IDENTIFIERS rather than values, and counting
    // only cldf_values would report "0 values withheld" for the one source
    // whose exposure is the largest thing we publish. The LanguageTable IS the
    // code set as far as SIL's terms are concerned.
    const spineRows = s.ID.startsWith('iso639-3')
      ? db.prepare('SELECT COUNT(*) c FROM cldf_languages WHERE ISO639P3code IS NOT NULL').get().c
      : 0;
    console.log(`    ✗ ${s.ID} (${s.License}) — NOT redistributable`);
    if (vals) console.log(`        ${vals.toLocaleString()} value(s) must be withheld`);
    if (spineRows) {
      // Narrower than it was first written, after the terms were actually read
      // rather than recalled. SIL permits incorporation "either commercial or
      // non-commercial" with attribution, and expressly permits distributing
      // EXPANSIONS so long as they are marked as not part of the standard. The
      // one prohibition is on a product that "provide[s] a means to
      // redistribute the code set" — i.e. on becoming a mirror.
      //
      // The settled precedent is in our own format: glottolog-cldf is CC-BY-4.0,
      // deposited on Zenodo with a DOI, and ships ISO639P3code and
      // Closest_ISO639P3code columns. The CLDF ecosystem has published these
      // codes for a decade.
      //
      // So this is a NOTICE, not a blocker. What it must not become is a silent
      // omission of the attribution SIL does require.
      console.log(`        ${spineRows.toLocaleString()} LanguageTable row(s) carry its codes.`);
      console.log('        SIL permits incorporation, commercial or not, WITH ATTRIBUTION to');
      console.log('        iso639-3.sil.org, and permits distributing expansions marked as not');
      console.log('        part of the standard. It forbids only providing a means to');
      console.log('        REDISTRIBUTE the code set — being a mirror. Publishing a CLDF');
      console.log('        LanguageTable is the same thing glottolog-cldf does under CC-BY with');
      console.log('        a Zenodo DOI, so the deposit is not blocked; the attribution is the');
      console.log('        obligation to keep.');
    }
  }
  if (nonCommercial.length) {
    console.log(`    · ${nonCommercial.length} source(s) are non-commercial only; their values`);
    console.log('      carry the flag and must stay out of any commercial lane');
  }
}

const release = {
  version: VERSION,
  builtAt,
  // A PARTIAL BUILD SAYS SO, IN THE ARTEFACT.
  //
  // `--only` gives the STORE its own file (atlas-partial.db) but writes cards
  // and this release file to the same paths as a full build. So a subset run
  // left a complete-looking ATLAS-RELEASE.json beside a card set covering a
  // handful of sources, and cutover — whose only test is "not empty" — would
  // have accepted it and replaced the live corpus.
  //
  // Null, not false, when complete: a reader that does not know about this
  // field sees nothing, and one that does can tell "complete" from "nobody
  // stamped it".
  partial: ONLY.length ? ONLY : null,
  decisionLayerCommit: (() => {
    try {
      return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf-8' }).trim();
    } catch { return null; }
  })(),
  counts: { ...counts, cards: stats.cardsProjected, fieldInstances: stats.fieldInstances },
  contentHash: corpusHash.digest('hex'),
  sources: sources.map((s) => ({
    id: s.ID,
    version: s.Version,
    doi: s.DOI,
    sha256: s.sha256,
    license: s.License,
    module: s.CLDF_Module,
    redistributable: Boolean(s.Redistributable),
    commercialUse: Boolean(s.Commercial_Use),
  })),
  tools: { node: process.version },
};
fs.writeFileSync(path.join(OUT, 'ATLAS-RELEASE.json'), `${JSON.stringify(release, null, 2)}\n`);

db.close();
console.log(`\n  ATLAS ${VERSION} built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  content hash ${release.contentHash.slice(0, 16)}…`);
console.log(`  ${path.relative(REPO, path.join(OUT, 'ATLAS-RELEASE.json'))}`);
console.log(`  store: ${path.relative(REPO, ATLAS_DB)}\n`);
console.log('  Cards are build output. They are NOT in cli/shared/language-cards/ —');
console.log('  cutover is a separate, deliberate act.\n');
