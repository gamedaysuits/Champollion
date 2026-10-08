#!/usr/bin/env node

/**
 * build-shared-licenses.mjs — License register → shared/licenses.json SSOT
 *
 * Generates the monorepo-wide machine-readable license register at
 * shared/licenses.json by merging:
 *
 *   1. shared/license-register-floor.json — the champollion.db source_licenses
 *      register FROZEN 2026-08-18 ahead of that store's retirement: 318
 *      human-verified claims including the hand-written attribution strings,
 *      sovereignty scoping notes (EdTeKLA), permission states (itwêwina
 *      BLOCKED) and 30 NC flags that have no other home. This replaced
 *      data/staging/tc-licenses.json as the card-data input; the staging file
 *      is now written FROM shared/licenses.json by the catalogue build, so
 *      the Supabase source_licenses upload lane is unchanged.
 *   2. Supplemental entries for licensed assets that appear in the repo
 *      but are NOT card-data sources (eval corpora, FSTs, dictionary
 *      harvests). Facts verified against docs/LICENSING.md (the canonical
 *      human-readable register) and arena/datasets/registry.json.
 *   3. cli/data/atlas.db cldf_sources — every pinned release, filling
 *      genuine absences only.
 *
 * Pipeline:
 *   license-register-floor.json + supplemental + atlas → THIS SCRIPT
 *     → shared/licenses.json → (catalogue build) → tc-licenses.json → Supabase
 *
 * Consumers:
 *   - cli/scripts/lint-language-cards.mjs (license-source-resolves rule)
 *   - mt-eval-arena/scripts/build-trading-card-data.mjs (per-source terms +
 *     the staged register)
 *   - any tool needing a single lookup table of source → license terms
 *
 * Usage:
 *   node scripts/build-shared-licenses.mjs
 *   node scripts/build-shared-licenses.mjs --dry-run   # Preview, no file writes
 *   node scripts/build-shared-licenses.mjs --accept-license-changes --source <id>
 *     # accept a LOOSENING for one named source (repeatable), after
 *     # re-verifying the upstream. There is no blanket acceptance flag.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLOOR_PATH = join(__dirname, '..', '..', 'shared', 'license-register-floor.json');
const OUTPUT_PATH = join(__dirname, '..', '..', 'shared', 'licenses.json');

const dryRun = process.argv.includes('--dry-run');
// --accept-license-changes --source <id> [--source <id> …]: per-source
// acceptance of a LOOSENING. Deliberately no blanket form.
const acceptChanges = process.argv.includes('--accept-license-changes');
const acceptedSources = new Set();
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--source' && process.argv[i + 1]) {
    acceptedSources.add(process.argv[i + 1]);
  }
}

// ---------------------------------------------------------------------------
// SUPPLEMENTAL ENTRIES
//
// Licensed assets used in the repo that are not card-data sources, so they
// never appear in tc-licenses.json. Every fact here is verified in
// docs/LICENSING.md — do not add entries with unverified license claims.
// Shape matches tc-licenses.json rows exactly (0/1 integer flags).
// ---------------------------------------------------------------------------

const SUPPLEMENTAL = [
  {
    source: 'edtekla-textbook',
    // NOT plain CC BY-NC-SA: the upstream README modifies the license "to
    // maintain the sovereignty and control of the content creators" —
    // materials designated for community/academic/educational uses, sharing
    // scoped to "educational purposes in classrooms and communities", the
    // original speaker retains rights, and per-corpus restrictions may
    // apply. Verified against the repo README 2026-07-19.
    license_spdx: 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0',
    license_url: 'https://github.com/EdTeKLA/IndigenousLanguages_Corpora#readme',
    attribution: 'EdTeKLA IndigenousLanguages_Corpora (Cree Language Textbook), ' +
                 'Educational Technology, Knowledge, Language, and Learning ' +
                 'Analytics Research Group, University of Alberta.',
    // The modified grant's share right is SCOPED (educational classroom/
    // community purposes) — not the general redistribution this flag means
    // elsewhere, so it is conservatively 0. Champollion never redistributes
    // the content either way (fetch-from-source, local rebuild only).
    allows_redistribution: 0,
    requires_attribution: 1,
    requires_sharealike: 1,
    non_commercial_only: 1,
    dataset_url: 'https://github.com/EdTeKLA/IndigenousLanguages_Corpora',
    dataset_version: null,
    notes: 'Eval corpus for eng→crk (registry ids: edtekla-textbook, ' +
           'edtekla-dev-v1). License chain: root work "Cree: Language of the ' +
           'Plains" (Okimāsis, U of R Press open textbook) is CC BY-NC-ND ' +
           '4.0; EdTeKLA publishes the extracted aligned lines under its ' +
           'MODIFIED CC BY-NC-SA (sovereignty-scoped — see license_url); ' +
           'Champollion rebuilds locally from upstream at a pinned ref and ' +
           'never hosts or redistributes the content. NC: never enters any ' +
           'commercial/prize/API lane; transmission to model APIs only over ' +
           'no-train channels (docs/DATA_BOUNDARIES.md §Transmission). ' +
           'See docs/LICENSING.md §Third-Party Data Assets.',
    registered_at: null,
  },
  {
    source: 'giellalt-lang-crk',
    license_spdx: 'AGPL-3.0-or-later',
    license_url: 'https://www.gnu.org/licenses/agpl-3.0.html',
    attribution: 'GiellaLT lang-crk FST (source + derived lexicon), © 2015–2023 ALTLab, University of Alberta.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 1,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/giellalt/lang-crk',
    dataset_version: null,
    notes: 'Used in crk-translate (lexc_source, fst_lexicon.json, runtime .hfstol). ' +
           'AGPL §13: network users must be offered corresponding source. ' +
           'Upstream LICENSE also carries a §7(b) additional term requiring ' +
           'preservation of specified legal notices / author attributions ' +
           '(ALTLab, University of Alberta; Maskwachees Cultural College 1998/2009). ' +
           'Commercial use allowed only with source-offer obligation honored. ' +
           'See docs/LICENSING.md and crk-translate/data/LICENSE_NOTICE.md.',
    registered_at: null,
  },
  {
    source: 'firstvoices-keyboards',
    license_spdx: 'MIT',
    license_url: 'https://github.com/keymanapp/keyboards/blob/master/LICENSE.md',
    attribution: 'FirstVoices keyboards (First Peoples’ Cultural Council), distributed via the Keyman keyboards monorepo (keymanapp/keyboards, release/fv).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/keymanapp/keyboards/tree/master/release/fv',
    dataset_version: null,
    notes: 'Card keyboardSupport source (existence metadata only — keyboard ids, names, ' +
           'language tags; no keyboard binaries bundled). Per-keyboard license reported ' +
           'as "mit" by api.keyman.com/keyboard/<id> (verified fv_plains_cree 2026-07-19); ' +
           'cache: cli/data/firstvoices-keyboards.json via ' +
           'cli/scripts/download-firstvoices-keyboards.mjs.',
    registered_at: null,
  },
  {
    source: 'wolvengrey-itwewina',
    license_spdx: null,
    license_url: null,
    attribution: 'Wolvengrey, Arok. nêhiyawêwin: itwêwina / Cree: Words (CW); Maskwacîs Cree Dictionary (MD). Harvested via the itwêwina API.',
    allows_redistribution: 0,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 1,
    dataset_url: 'https://itwewina.altlab.app',
    dataset_version: null,
    notes: 'UNLICENSED — BLOCKED-needs-permission. No public license exists for the ' +
           'dictionary data (the morphodict software is Apache-2.0, but that does not ' +
           'cover the data it serves). Do not redistribute or ship in any lane until ' +
           'written permission is obtained. See docs/LICENSING.md §NEEDS-PERMISSION.',
    registered_at: null,
  },
  {
    source: 'flores-plus',
    license_spdx: 'CC-BY-SA-4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'FLORES+ devtest (OLDI; originally Meta FLORES-200).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 1,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/openlanguagedata/flores',
    dataset_version: null,
    notes: 'Share-alike on redistributed/derived corpus data. Curators request it not ' +
           'be used as training data (evaluation only). See docs/LICENSING.md.',
    registered_at: null,
  },

  // ── Register-gap closure, 2026-06-11 ──────────────────────────────────
  // Card-data sources that appear in cli/shared/language-cards but were
  // missing from tc-licenses.json. Each license below was verified on the
  // source's official site/repo on 2026-06-11; the verification URL is in
  // notes. Sources whose license could NOT be verified are recorded as
  // UNCONFIRMED with allows_redistribution: 0 (blocked pending confirmation).

  {
    source: 'linguameta',
    license_spdx: 'CC-BY-SA-4.0',
    license_url: 'https://github.com/google-research/url-nlp/blob/main/linguameta/LICENSE',
    attribution: 'LinguaMeta (Google Research, url-nlp repository).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 1,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/google-research/url-nlp/tree/main/linguameta',
    dataset_version: null,
    notes: 'Verified 2026-06-11: the LICENSE file shipped in the linguameta directory is ' +
           'CC BY-SA 4.0 (https://github.com/google-research/url-nlp/blob/main/linguameta/LICENSE). ' +
           'The README "Sources and licensing" table lists Google-contributed data as CC BY 4.0 ' +
           'and compiles per-source licensed inputs (CLDR, Glottolog CC BY 4.0, Wikidata, ' +
           'Wikipedia/Wiktionary CC BY-SA). Recording the stricter shipped LICENSE (share-alike). ' +
           'Card ids: linguameta, linguameta-2024.',
    registered_at: null,
  },
  {
    source: 'lexibank',
    license_spdx: 'LicenseRef-Lexibank-Per-Dataset',
    license_url: 'https://github.com/lexibank',
    attribution: 'Lexibank: a curated collection of CLDF lexical datasets (List et al.).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://lexibank.clld.org/',
    dataset_version: null,
    notes: 'UMBRELLA id — Lexibank datasets are individually licensed, predominantly ' +
           'CC-BY-4.0 (verified 2026-06-11 at https://github.com/lexibank: e.g. ' +
           'lexibank-analysed, meloniromance, northperulex, allenbai, nls, pachechibchan ' +
           'all CC-BY-4.0; tooling Apache-2.0). CAVEAT: a minority of datasets carry other ' +
           'terms (incl. NC/ND) — consult the individual dataset license before ' +
           'redistributing dataset content. Individually registered lexibank datasets ' +
           '(abvd, uralex, …) resolve to their own register entries; this umbrella covers ' +
           'the generic card ids lexibank and lexibank-batch(-2024).',
    registered_at: null,
  },
  {
    source: 'lexibank-tlopo',
    license_spdx: 'CC-BY-4.0',
    license_url: 'https://github.com/lexibank/tlopo/blob/main/LICENSE.md',
    attribution: 'The Lexicon of Proto Oceanic (TLOPO), CLDF dataset (lexibank/tlopo); ' +
                 'from Ross, Pawley & Osmond, The Lexicon of Proto Oceanic.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/lexibank/tlopo',
    dataset_version: null,
    notes: 'Verified 2026-06-11: GitHub license detection for lexibank/tlopo reports ' +
           'CC-BY-4.0 (https://github.com/lexibank/tlopo).',
    registered_at: null,
  },
  {
    source: 'wurm-hattori-pacific-atlas',
    license_spdx: 'LicenseRef-Copyrighted-Reference',
    license_url: null,
    attribution: 'Wurm, S.A. & Hattori, S. (eds.) 1981–1983. Language Atlas of the ' +
                 'Pacific Area. Canberra: Australian Academy of the Humanities / ' +
                 'Japan Academy. Pacific Linguistics C-66/C-67.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: null,
    dataset_version: null,
    notes: 'COPYRIGHTED PRINT WORK — citation-only pseudo-license (same pattern as ' +
           'champollion-derived). Cards store only uncopyrightable facts (areal ' +
           'classifications, geographic context) derived from the atlas, with scholarly ' +
           'citation. No content (maps, text) from the atlas is reproduced or ' +
           'redistributed; the allows_redistribution flag covers the cited facts only. ' +
           'Card ids: wurm-hattori-pacific-atlas, language-atlas-pacific.',
    registered_at: null,
  },
  {
    source: 'rosetta-project',
    license_spdx: 'LicenseRef-RosettaProject-Mixed',
    license_url: 'https://rosettaproject.org/about/',
    attribution: 'The Rosetta Project, The Long Now Foundation. Collection hosted at the ' +
                 'Internet Archive (archive.org/details/rosettaproject).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://archive.org/details/rosettaproject',
    dataset_version: null,
    notes: 'Verified 2026-06-11: rosettaproject.org/about states "all of the contents in ' +
           'the digital archive are publicly available, and all of the structured ' +
           'information we collect and maintain about languages and their speakers is ' +
           'freely available for download and reuse." Individual archive items carry their ' +
           'own CC licenses (e.g. archive.org/details/rosettaproject_roo_swadesh-1 is ' +
           'CC BY 3.0). Cards store only catalog-presence facts. Card ids: ' +
           'rosetta-project, rosetta-project-ia.',
    registered_at: null,
  },
  {
    source: 'ailla',
    license_spdx: 'LicenseRef-AILLA-Metadata',
    license_url: 'https://www.ailla.utexas.org/',
    attribution: 'Archive of the Indigenous Languages of Latin America (AILLA), ' +
                 'University of Texas at Austin.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://www.ailla.utexas.org/',
    dataset_version: null,
    notes: 'Catalog metadata only. Verified 2026-06-11: AILLA is an OLAC participating ' +
           'archive whose catalog metadata is harvested via OLAC/OAI-PMH ' +
           '(http://olac.ldc.upenn.edu/archive/ailla.utexas.org); AILLA access terms state ' +
           'metadata is accessible to anonymous users. Media/resources are copyrighted, ' +
           'require an account, and are NOT covered by this entry — cards store only ' +
           'archive-presence facts. Card ids: ailla, ailla-2024.',
    registered_at: null,
  },
  {
    source: 'kaipuleohone',
    license_spdx: 'LicenseRef-Kaipuleohone-Metadata',
    license_url: 'http://olac.ldc.upenn.edu/archive/scholarspace.manoa.hawaii.edu',
    attribution: 'Kaipuleohone, the University of Hawaiʻi Digital Language Archive ' +
                 '(ScholarSpace, University of Hawaiʻi at Mānoa).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://scholarspace.manoa.hawaii.edu/handle/10125/4250',
    dataset_version: null,
    notes: 'Catalog metadata only. Verified 2026-06-11 via the OLAC archive-details page ' +
           '(http://olac.ldc.upenn.edu/archive/scholarspace.manoa.hawaii.edu): metadata ' +
           'conforms to OLAC/Dublin Core and is openly harvestable; "Most material is free ' +
           'to access by the public" but every item has depositor-specified access ' +
           'conditions. Items themselves are NOT covered by this entry — cards store only ' +
           'archive-presence facts. Card ids: kaipuleohone, kaipuleohone-2026.',
    registered_at: null,
  },
  {
    source: 'wikimedia-incubator',
    license_spdx: 'CC-BY-SA-4.0',
    license_url: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
    attribution: 'Wikimedia Incubator, Wikimedia Foundation.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 1,
    non_commercial_only: 0,
    dataset_url: 'https://incubator.wikimedia.org/',
    dataset_version: null,
    notes: 'Verified 2026-06-11: Incubator footer states text is available under the ' +
           'Creative Commons Attribution-ShareAlike License; the Wikimedia Terms of Use ' +
           '(foundation.wikimedia.org/wiki/Policy:Terms_of_Use) specify CC BY-SA 4.0. ' +
           'Cards store test-wiki existence facts (digitalPresence). Card ids: ' +
           'wikimedia-incubator, wikimedia-incubator-2026.',
    registered_at: null,
  },
  {
    source: 'omw',
    license_spdx: 'LicenseRef-OMW-Per-Wordnet',
    license_url: 'https://omwn.org/',
    attribution: 'Open Multilingual Wordnet (Bond & Paik 2012; Bond & Foster 2013).',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://omwn.org/',
    dataset_version: '1.4',
    notes: 'Verified 2026-06-11: omwn.org states "OMW and its components are open: they ' +
           'can be freely used, modified, and shared by anyone for any purpose." Component ' +
           'wordnets are individually licensed (open licenses, varying per wordnet) — ' +
           'consult the individual wordnet license before redistributing its content. ' +
           'Cards store wordnet-availability facts. Card ids: omw, omw-1.4.',
    registered_at: null,
  },
  {
    source: 'valpal',
    license_spdx: 'CC-BY-3.0',
    license_url: 'https://creativecommons.org/licenses/by/3.0/',
    attribution: 'Hartmann, Iren & Haspelmath, Martin & Taylor, Bradley (eds.) 2013. ' +
                 'Valency Patterns Leipzig (ValPaL). Leipzig: Max Planck Institute for ' +
                 'Evolutionary Anthropology.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://valpal.info/',
    dataset_version: null,
    notes: 'Verified 2026-06-11: valpal.info footer states "The Valency Patterns Leipzig ' +
           'online database … is licensed under a Creative Commons Attribution 3.0 ' +
           'Unported License." Card ids: valpal, valpal-hartmann.',
    registered_at: null,
  },
  {
    source: 'indicnlp',
    license_spdx: 'UNCONFIRMED',
    license_url: null,
    attribution: 'The IndicNLP Catalog, AI4Bharat (Kunchukuttan 2020).',
    allows_redistribution: 0,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/AI4Bharat/indicnlp_catalog',
    dataset_version: null,
    notes: 'UNCONFIRMED — BLOCKED pending confirmation. Checked 2026-06-11: ' +
           'github.com/AI4Bharat/indicnlp_catalog has no LICENSE file and the GitHub API ' +
           'reports no detected license; the catalogued resources are themselves ' +
           'per-dataset licensed. Cards store only an NLP-resource-availability indicator ' +
           '(resources[]). Do not redistribute catalog content until a license is ' +
           'confirmed. Card id: indicnlp-2023.',
    registered_at: null,
  },
  {
    source: 'americasnlp',
    license_spdx: 'UNCONFIRMED',
    license_url: null,
    attribution: 'AmericasNLP Shared Tasks on NLP for Indigenous Languages of the ' +
                 'Americas (Mager et al. 2021 and successors).',
    allows_redistribution: 0,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: 'https://github.com/AmericasNLP/americasnlp2024',
    dataset_version: null,
    notes: 'UNCONFIRMED — BLOCKED pending confirmation. Checked 2026-06-11: ' +
           'github.com/AmericasNLP/americasnlp2024 has no LICENSE file and the GitHub API ' +
           'reports no detected license; shared-task data is sourced per language pair. ' +
           '(shared/ATTRIBUTION.md’s "CC BY" claim could not be verified upstream.) ' +
           'Cards store only a shared-task-availability indicator (resources[]). Do not ' +
           'redistribute shared-task data until licenses are confirmed. Card id: ' +
           'americasnlp-2024.',
    registered_at: null,
  },
  {
    source: 'areal-linguistics',
    license_spdx: 'LicenseRef-Literature-Citation',
    license_url: null,
    attribution: 'Published areal-linguistics literature; per-card citation in the source ' +
                 'id, e.g. Heine & Nurse 2008; Enfield 2005; Matisoff 2001; Emeneau 1956; ' +
                 'Masica 1976; Campbell et al. 1986; Ferguson 1976; Crass & Meyer 2008; ' +
                 'Joseph 1992; Friedman 2006.',
    allows_redistribution: 1,
    requires_attribution: 1,
    requires_sharealike: 0,
    non_commercial_only: 0,
    dataset_url: null,
    dataset_version: null,
    notes: 'LITERATURE CITATION pseudo-license (same pattern as champollion-derived) — ' +
           'these source ids cite copyrighted scholarly publications, not datasets. Cards ' +
           'store only uncopyrightable facts (areal/contact classifications) with the ' +
           'citation embedded in the source id, e.g. "areal-linguistics (Heine & Nurse ' +
           '2008)". No text from the cited works is reproduced; the allows_redistribution ' +
           'flag covers the cited facts only.',
    registered_at: null,
  },
];

// Note: Tatoeba (CC-BY-2.0) already exists in tc-licenses.json under the
// 'tatoeba' key — the registry.json tatoeba-* eval datasets resolve to it.
//
// Note: paradisec-olac(-2026), rosetta-project-ia, language-atlas-pacific,
// lexibank-batch(-2024), and cldr-endonym resolve via the alias map in
// cli/scripts/lint-language-cards.mjs (same source, different card vocabulary).

// ---------------------------------------------------------------------------
// BUILD
// ---------------------------------------------------------------------------

/**
 * Fold in every source the atlas pinned, for ids nothing else covers.
 *
 * Mutates `sources` and returns how many were added. Fails LOUD if the atlas
 * exists but cannot be read: a licence register that quietly omits sources is
 * exactly the failure this pass exists to prevent. A missing atlas is not an
 * error — the register still builds for anyone who has not built one.
 */
function addAtlasSources(sources) {
  const atlasPath = join(__dirname, '..', '..', 'cli', 'data', 'atlas.db');
  if (!existsSync(atlasPath)) {
    console.warn('  ⚠️  no cli/data/atlas.db — skipping the atlas pass. '
      + 'Sources known only to the atlas will have no licence entry.');
    return 0;
  }

  let Database;
  try {
    Database = createRequire(import.meta.url)('better-sqlite3');
  } catch (err) {
    throw new Error('better-sqlite3 is required to read the atlas licence table, and it '
      + `did not load (${err.message}). Refusing to write a licence register that silently `
      + 'omits every atlas source. Install it, or delete cli/data/atlas.db to build without.');
  }

  const db = new Database(atlasPath, { readonly: true });
  let added = 0;
  try {
    const rows = db.prepare(
      'SELECT ID, Title, License, Redistributable, Commercial_Use FROM cldf_sources'
    ).all();
    for (const r of rows) {
      if (!r.ID || sources[r.ID]) continue;
      if (!r.License) {
        // No licence recorded is a real gap, and it must not be smoothed over
        // into a permissive-looking default.
        console.warn(`  ⚠️  atlas source '${r.ID}' declares no licence — not registered`);
        continue;
      }
      sources[r.ID] = {
        source: r.ID,
        license_spdx: r.License,
        license_url: null,
        attribution: r.Title ?? null,
        allows_redistribution: r.Redistributable ? 1 : 0,
        requires_attribution: /CC-BY|MIT|Apache|Unicode/i.test(r.License) ? 1 : 0,
        requires_sharealike: /SA/i.test(r.License) ? 1 : 0,
        non_commercial_only: r.Commercial_Use ? 0 : 1,
        dataset_url: null,
        notes: 'atlas cldf_sources — declared by the source SNAPSHOT at fetch time',
      };
      added++;
    }
  } finally {
    db.close();
  }
  console.log(`  + ${added} source(s) from the atlas`);
  return added;
}

function main() {
  if (!existsSync(FLOOR_PATH)) {
    console.error(`FATAL: license floor not found at ${FLOOR_PATH}. It is the frozen `
      + 'champollion.db source_licenses register (committed 2026-08-18) — the last home '
      + 'of the human-verified claims. Restore it from git; never rebuild without it.');
    process.exit(1);
  }

  const floor = JSON.parse(readFileSync(FLOOR_PATH, 'utf-8')).sources ?? {};
  const floorEntries = Object.entries(floor).map(([source, e]) => ({ source, ...e }));
  console.log(`Loaded ${floorEntries.length} sources from the frozen floor register`);
  // (atlas sources are folded in below, after the supplemental pass)

  // Key by source id. The floor wins on collision — it carries the
  // human-verified terms; supplemental entries cover only assets absent
  // from it.
  const sources = {};
  for (const entry of floorEntries) {
    sources[entry.source] = entry;
  }

  let supplementalAdded = 0;
  for (const entry of SUPPLEMENTAL) {
    if (sources[entry.source]) {
      console.warn(`  ⚠️  Supplemental '${entry.source}' already in the floor register — keeping the floor entry`);
      continue;
    }
    sources[entry.source] = entry;
    supplementalAdded++;
  }

  // THE COMMITTED REGISTER IS ITSELF A FLOOR. The frozen db register, the
  // supplemental block and the atlas are all EVIDENCE STREAMS; the committed
  // shared/licenses.json is the ADJUDICATED state. Merging them means:
  //   - a committed claim is never silently weakened: if an evidence stream
  //     says null/UNCONFIRMED/unstated where the committed file records a
  //     real license, the committed value stands and the weaker claim is
  //     dropped;
  //   - an evidence stream may UPGRADE an unknown (UNCONFIRMED/null →
  //     a recorded license) — that is recording, not restating;
  //   - NC is sticky: once non_commercial_only, always, until a named
  //     per-source acceptance removes it;
  //   - a genuine conflict (two real licenses disagreeing) keeps the
  //     committed value and parks the incoming claim in _pendingClaim for
  //     adjudication — recorded, visible, not blocking;
  //   - a committed source no evidence stream mentions anymore is KEPT
  //     (retiring an entry is a decision, not a side effect of an input
  //     drying up).
  const UNKNOWNISH = (s) => !s || /^(unconfirmed|unknown|licenseref-unstated|cc)$/i.test(String(s));
  const mergeWithCommitted = (prior) => {
    for (const [id, was] of Object.entries(prior)) {
      const now = sources[id];
      if (!now) { sources[id] = was; continue; }
      // NC is sticky (strictest wins); removal happens only via the named
      // acceptance below, which operates on the merged result.
      if ((was.non_commercial_only ? 1 : 0) === 1) now.non_commercial_only = 1;
      const wasLic = was.license_spdx ?? null;
      const nowLic = now.license_spdx ?? null;
      if (wasLic && UNKNOWNISH(nowLic)) {
        now.license_spdx = wasLic; // committed real claim beats unknown
      } else if (wasLic && nowLic
          && wasLic.toLowerCase() === nowLic.toLowerCase()) {
        now.license_spdx = wasLic; // case-insensitive same — keep committed casing
      } else if (wasLic && nowLic && !UNKNOWNISH(wasLic)
          && wasLic.toLowerCase() !== nowLic.toLowerCase()) {
        // Two real claims disagree: committed stands, incoming is parked.
        now._pendingClaim = `${nowLic} (evidence stream disagrees with committed `
          + `${wasLic}; adjudicate against the upstream, then accept by name)`;
        now.license_spdx = wasLic;
      }
      // Prose is precious: never lose committed attribution/notes to an
      // evidence stream that lacks them.
      if (was.attribution && !now.attribution) now.attribution = was.attribution;
      if (was.notes && !now.notes) now.notes = was.notes;
    }
  };
  if (existsSync(OUTPUT_PATH)) {
    mergeWithCommitted(JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')).sources ?? {});
  }

  // THE ATLAS IS AN INPUT, because otherwise this register goes stale every
  // time a fetcher is added.
  //
  // The atlas records each source's licence from its own SNAPSHOT — fetching
  // IS declaring — so `cldf_sources` is the one place that always knows every
  // source the cards actually cite. Before this, three sources that 7,917
  // cards cite (sil-langtags, cldr-supplemental, linguameta) had no entry at
  // all, and the licence gate reported them as unresolvable. Hand-adding three
  // rows would have fixed today and re-broken on the next fetcher.
  //
  // tc-licenses.json still wins on collision: it carries verified,
  // human-checked terms, and this pass only fills genuine absences.
  const atlasAdded = addAtlasSources(sources);

  const output = {
    _generated: {
      generatedBy: 'mt-eval-arena/scripts/build-shared-licenses.mjs',
      generatedAt: new Date().toISOString(),
      inputs: [
        'shared/license-register-floor.json (frozen champollion.db source_licenses, 2026-08-18 — human-verified terms incl. attribution/notes prose)',
        'docs/LICENSING.md (verified facts for supplemental entries)',
        'arena/datasets/registry.json (per-dataset license cross-reference)',
        'cli/data/atlas.db cldf_sources (every source the ingestor pinned, with the licence its SNAPSHOT declares)',
      ],
      counts: {
        fromFloor: floorEntries.length,
        supplemental: supplementalAdded,
        fromAtlas: atlasAdded,
        total: Object.keys(sources).length,
      },
      note: 'GENERATED FILE — do not edit by hand. Regenerate with: node mt-eval-arena/scripts/build-shared-licenses.mjs',
    },
    sources,
  };

  // A REGENERATION MUST NOT QUIETLY RESTATE SOMEONE'S LICENCE.
  //
  // This register is rebuilt from tc-licenses.json, which is itself downstream
  // of champollion.db — the RETIRED database. Running this script on
  // 2026-08-12 rewrote 22 licence claims against the committed register,
  // including three NC REMOVALS (dplace-cldf and dplace-ea from CC-BY-NC-4.0
  // to CC-BY-4.0, TeDDi_sample losing NC altogether) and four sources whose
  // known licence became null.
  //
  // Loosening a licence is the single most damaging thing this file can do: NC
  // terms are what keep a source out of the commercial lanes, and a rebuild
  // that drops them would let that happen with nobody deciding it. So changes
  // to an EXISTING entry are refused by default and must be accepted
  // explicitly, with the diff printed. New entries are never blocked.
  // The change guard is ASYMMETRIC, because the failure modes are:
  //   TIGHTEN (gaining NC, gaining a license where none was known) — safe by
  //     construction, so it proceeds, logged. Refusing a tightening trains
  //     people to bulk-accept, which is how the loosenings slip through.
  //   LOOSEN (losing NC, changing/removing a recorded license) — the single
  //     most damaging thing this file can do: NC terms are what keep a source
  //     out of the commercial lanes. Each loosening must be accepted BY NAME
  //     (--accept-license-changes --source <id>) after re-verifying the
  //     upstream. There is deliberately no blanket flag: the 2026-08-12 run
  //     that rewrote 22 claims (three NC removals) is the incident this
  //     asymmetry exists to prevent.
  const tightened = [];
  const loosened = [];
  if (existsSync(OUTPUT_PATH)) {
    const prior = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')).sources ?? {};
    for (const [id, was] of Object.entries(prior)) {
      const now = sources[id];
      if (!now) { loosened.push({ id, what: `REMOVED (was ${was.license_spdx})` }); continue; }
      const ncWas = was.non_commercial_only ? 1 : 0;
      const ncNow = now.non_commercial_only ? 1 : 0;
      if (ncWas === 0 && ncNow === 1) {
        tightened.push(`${id}: gained non_commercial_only`);
      } else if (ncWas === 1 && ncNow === 0) {
        loosened.push({ id, what: 'non_commercial_only 1 → 0' });
      }
      if (was.license_spdx !== now.license_spdx) {
        if (UNKNOWNISH(was.license_spdx) && now.license_spdx) {
          // Recording a license where none was verified is evidence arriving,
          // not terms being restated.
          tightened.push(`${id}: license recorded (${was.license_spdx ?? 'null'} → ${now.license_spdx})`);
        } else {
          loosened.push({ id, what: `${was.license_spdx} → ${now.license_spdx ?? 'null'}` });
        }
      }
    }
  }
  for (const t of tightened) console.log(`  TIGHTEN (accepted): ${t}`);
  const unaccepted = loosened.filter((l) => !(acceptChanges && acceptedSources.has(l.id)));
  const accepted = loosened.filter((l) => acceptChanges && acceptedSources.has(l.id));
  for (const a of accepted) console.log(`  LOOSEN (accepted by name): ${a.id}: ${a.what}`);
  if (unaccepted.length) {
    console.error(`\nREFUSING TO WRITE — this run would LOOSEN ${unaccepted.length} existing licence claim(s):\n`);
    for (const c of unaccepted) console.error(`  ${c.id}: ${c.what}`);
    console.error('\nThese are terms set by the data OWNERS, not by us. Re-verify each against '
      + 'the upstream, then accept each BY NAME:\n'
      + '  node mt-eval-arena/scripts/build-shared-licenses.mjs --accept-license-changes'
      + ' --source <id> [--source <id> …]\n'
      + 'There is no blanket acceptance. New sources and tightenings are unaffected.');
    process.exit(3);
  }

  if (dryRun) {
    console.log(`[dry-run] Would write ${Object.keys(sources).length} sources to ${OUTPUT_PATH}`);
    return;
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${Object.keys(sources).length} sources (${floorEntries.length} floor + ${supplementalAdded} supplemental + ${atlasAdded} atlas) → ${OUTPUT_PATH}`);
}

main();
