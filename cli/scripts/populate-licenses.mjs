#!/usr/bin/env node

/**
 * populate-licenses.mjs — Register license terms for every data source
 *
 * Champollion is a data aggregator. Every source's license must be tracked
 * so we can generate attributions, verify redistribution rights, and pass
 * license terms through to downstream consumers.
 *
 * Strategy:
 *   1. Scan CLDF metadata files for dc:license + dc:identifier
 *   2. Register known non-CLDF sources manually (Wikidata, PHOIBLE, etc.)
 *   3. Report any sources in the DB that have no license entry
 *
 * Usage:
 *   node scripts/populate-licenses.mjs
 *   node scripts/populate-licenses.mjs --audit   # Only report unlicensed sources
 */

import { openDatabase } from './db.mjs';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const auditOnly = process.argv.includes('--audit');

const db = openDatabase();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Normalize a license URL/string to SPDX identifier
// ─────────────────────────────────────────────────────────────────────────────

// toSpdx() and licenseFlags() USED TO LIVE HERE. They wrote 212 of the
// register's 333 entries, and they were wrong in three ways at once:
//
//   * `if (s.includes('by-nc')) return 'CC-BY-NC-4.0'` stamped 4.0 on every
//     BY-NC licence of any version. `nts` and `uclaphoneticslabarchive` are
//     BY-NC-2.0 and were recorded as 4.0 — with the correct URL sitting in the
//     adjacent license_url column.
//   * There was no `-nd` branch at all, so a NoDerivatives licence matched the
//     `by-nc` or `by` test first and came out without its ND clause. That is
//     how `nts` came to be recorded as redistributable.
//   * `return raw` shipped unparsed strings as SPDX ids (`hayniecolorterms`
//     carries the literal "CC"), and
//     `redistribution: !s.includes('PROPRIETARY')` granted redistribution to
//     everything, since no upstream string ever contains that word.
//
// They are replaced by cli/lib/license-identify.mjs, which reads the version
// and the clauses OUT of the string and returns null when it cannot read them
// with certainty — null meaning UNVERIFIED, which quarantines the claim rather
// than inventing a permissive one.
import { identifyLicense, deriveFlags } from '../lib/license-identify.mjs';

function toSpdx(raw) {
  return identifyLicense(raw).spdx;
}

function licenseFlags(spdx) {
  const f = deriveFlags(spdx);
  return {
    redistribution: f.redistribution,   // null when unknown — NOT a permission
    attribution: f.attribution,
    sharealike: f.sharealike,
    nc: f.nonCommercial,
    nd: f.noDerivatives,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: Scan CLDF metadata files
// ─────────────────────────────────────────────────────────────────────────────

console.log('=== Phase 1: Scanning CLDF metadata for licenses ===\n');

// Scan data directory for CLDF metadata files

function findMetadataFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          files.push(...findMetadataFiles(full));
        } else if (entry.endsWith('-metadata.json') || entry === 'cldf-metadata.json') {
          files.push(full);
        }
      } catch { /* skip inaccessible */ }
    }
  } catch { /* skip inaccessible */ }
  return files;
}

const allMetadata = findMetadataFiles(DATA_DIR);
console.log(`Found ${allMetadata.length} CLDF metadata files\n`);

let cldfRegistered = 0;
// Sources whose upstream licence string could not be identified. Reported at
// the end rather than silently absorbed — an unverifiable licence is a finding.
const unidentified = [];
for (const metaPath of allMetadata) {
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const rawLicense = meta['dc:license'] || '';
    const datasetId = meta['rdf:ID'] || basename(dirname(dirname(metaPath)));
    const accessUrl = meta['dcat:accessURL'] || meta['dc:identifier'] || '';
    const citation = meta['dc:bibliographicCitation'] || '';
    const version = meta['dc:version'] || '';

    // Map the directory name to our source identifier
    // Our source names match the data directory names
    const dirName = metaPath.split('/data/')[1]?.split('/')[0];
    if (!dirName) continue;

    const spdx = toSpdx(rawLicense);
    const flags = licenseFlags(spdx);

    if (!auditOnly) {
      // An unidentifiable licence string is recorded as UNVERIFIED with the raw
      // text preserved, NOT as a guess. `allows_redistribution: 0` here means
      // "no grant we can evidence", which is the only safe reading of an
      // unknown licence — the old code defaulted it to 1.
      const verified = spdx !== null;
      db.registerSourceLicense({
        source: dirName,
        licenseSpdx: spdx ?? 'UNVERIFIED',
        licenseUrl: typeof rawLicense === 'string' && rawLicense.startsWith('http') ? rawLicense : null,
        attribution: citation.slice(0, 500) || null,
        allowsRedistribution: flags.redistribution === true,
        requiresAttribution: flags.attribution,
        requiresSharealike: flags.sharealike,
        nonCommercialOnly: flags.nc,
        datasetUrl: accessUrl || null,
        datasetVersion: version || null,
        notes: verified
          ? `Identified from CLDF metadata (${basename(metaPath)}): ${identifyLicense(rawLicense).reason}`
          : `UNVERIFIED — CLDF metadata (${basename(metaPath)}) says `
            + `${JSON.stringify(String(rawLicense).slice(0, 80))}: `
            + `${identifyLicense(rawLicense).reason}. No claim is asserted from this source.`,
      });
      cldfRegistered++;
      if (!verified) unidentified.push({ dir: dirName, raw: String(rawLicense).slice(0, 60) });
    }
  } catch (err) {
    console.warn(`  ⚠️  Error reading ${metaPath}: ${err.message}`);
  }
}
console.log(`Registered ${cldfRegistered} CLDF dataset licenses`);
if (unidentified.length) {
  console.log(`\n  ${unidentified.length} recorded UNVERIFIED (upstream string not identifiable):`);
  for (const u of unidentified) console.log(`    ${u.dir.padEnd(30)} ${JSON.stringify(u.raw)}`);
  console.log('  These assert nothing. Resolve via cli/scripts/harvest-zenodo-cldf.mjs');
  console.log('  or a tracked upstream LICENSE file, then re-run build-license-evidence.mjs.');
}
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Register non-CLDF sources manually
// ─────────────────────────────────────────────────────────────────────────────

console.log('=== Phase 2: Registering non-CLDF source licenses ===\n');

const MANUAL_LICENSES = [
  // ── Core linguistic databases ──
  {
    source: 'glottolog-cldf',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. 2024. Glottolog 5.0.',
    datasetUrl: 'https://glottolog.org/',
    datasetVersion: '5.0',
  },
  {
    source: 'glottolog-5.0',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. 2024. Glottolog 5.0.',
    datasetUrl: 'https://glottolog.org/',
    datasetVersion: '5.0',
  },
  {
    source: 'glottolog-resourcemap',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Glottolog 5.0. Max Planck Institute for Evolutionary Anthropology.',
    datasetUrl: 'https://glottolog.org/',
    datasetVersion: '5.0',
  },
  {
    source: 'grambank-1.0.3',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Skirgård, H. et al. 2023. Grambank reveals the importance of genealogical constraints on linguistic diversity and highlights the impact of language loss. Science Advances 9(16).',
    datasetUrl: 'https://grambank.clld.org/',
    datasetVersion: '1.0.3',
  },
  {
    source: 'phoible-2.0',
    licenseSpdx: 'CC-BY-2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    attribution: 'Moran, Steven & McCloy, Daniel (eds.) 2019. PHOIBLE 2.0. Jena: Max Planck Institute for the Science of Human History.',
    datasetUrl: 'https://phoible.org/',
    datasetVersion: '2.0',
  },
  {
    source: 'wals',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Dryer, Matthew S. & Haspelmath, Martin (eds.) 2013. WALS Online. Leipzig: Max Planck Institute for Evolutionary Anthropology.',
    datasetUrl: 'https://wals.info/',
    datasetVersion: '2020.3',
  },

  // ── Endangerment & vitality ──
  {
    source: 'elcat',
    licenseSpdx: 'CC-BY-NC-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution: 'Catalogue of Endangered Languages (ELCat). University of Hawaii at Manoa.',
    nonCommercialOnly: true,
    datasetUrl: 'https://endangeredlanguages.com/',
    notes: 'NC license — verify usage qualifies as non-commercial/educational. Alternative: use Glottolog AES (CC-BY-4.0) for vitality data.',
  },

  // ── Identity & standards ──
  {
    source: 'sil-iso639-3',
    licenseSpdx: 'LicenseRef-SIL-Terms',
    licenseUrl: 'https://iso639-3.sil.org/code_tables/download_tables',
    attribution: 'SIL International. ISO 639-3 Registration Authority.',
    datasetUrl: 'https://iso639-3.sil.org/',
    datasetVersion: '2024',
    notes: 'SIL terms: free to use for non-commercial purposes. Data is factual (language codes) so may not be copyrightable.',
  },
  {
    source: 'iana-subtag-registry',
    licenseSpdx: 'LicenseRef-IANA',
    licenseUrl: 'https://www.iana.org/assignments/language-subtag-registry/',
    attribution: 'IANA Language Subtag Registry.',
    datasetUrl: 'https://www.iana.org/assignments/language-subtag-registry/',
    notes: 'IANA data is freely available. No specific SPDX license but no usage restrictions on factual registry data.',
  },
  {
    source: 'unicode-cldr',
    licenseSpdx: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    attribution: 'Unicode CLDR Project. Unicode Consortium.',
    datasetUrl: 'https://cldr.unicode.org/',
    datasetVersion: '48',
  },
  {
    source: 'iso-15924',
    licenseSpdx: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    attribution: 'Unicode Consortium. ISO 15924 script codes.',
    datasetUrl: 'https://unicode.org/iso15924/',
  },

  // ── Wikidata / Wikipedia ──
  {
    source: 'wikidata',
    licenseSpdx: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Wikidata contributors. Wikidata is freely available under CC0.',
    requiresAttribution: false,
    datasetUrl: 'https://www.wikidata.org/',
  },
  {
    source: 'wikipedia',
    licenseSpdx: 'CC-BY-SA-3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    attribution: 'Wikipedia contributors. Content available under CC-BY-SA.',
    requiresSharealike: true,
    datasetUrl: 'https://www.wikipedia.org/',
    notes: 'We only use factual metadata (article counts, edition existence), not article content. Factual data is not copyrightable.',
  },
  {
    source: 'wiktionary',
    licenseSpdx: 'CC-BY-SA-3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    attribution: 'Wiktionary contributors.',
    requiresSharealike: true,
    datasetUrl: 'https://www.wiktionary.org/',
    notes: 'We only use edition existence metadata, not content.',
  },

  // ── Corpus & NLP resources ──
  {
    source: 'common-voice',
    licenseSpdx: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Mozilla Common Voice.',
    requiresAttribution: false,
    datasetUrl: 'https://commonvoice.mozilla.org/',
    notes: 'Metadata (language list, hours, speaker counts) is CC0. Audio data has its own per-recording licenses.',
  },
  {
    source: 'opus',
    licenseSpdx: 'LicenseRef-OPUS-Mixed',
    licenseUrl: 'https://opus.nlpl.eu/',
    attribution: 'OPUS — the open parallel corpus. Jörg Tiedemann.',
    datasetUrl: 'https://opus.nlpl.eu/',
    notes: 'OPUS metadata is freely available. Individual corpora within OPUS have varying licenses.',
  },
  {
    source: 'universal-dependencies',
    licenseSpdx: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'Universal Dependencies contributors.',
    requiresSharealike: true,
    datasetUrl: 'https://universaldependencies.org/',
    notes: 'Metadata (language list, treebank counts) freely available. Individual treebanks have varying licenses (most CC-BY-SA-4.0).',
  },
  {
    source: 'unimorph',
    licenseSpdx: 'CC-BY-SA-2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    attribution: 'UniMorph contributors.',
    requiresSharealike: true,
    datasetUrl: 'https://unimorph.github.io/',
  },
  {
    source: 'tatoeba',
    licenseSpdx: 'CC-BY-2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    attribution: 'Tatoeba contributors.',
    datasetUrl: 'https://tatoeba.org/',
    notes: 'Individual sentences have per-contribution licenses (mostly CC-BY). We use aggregate counts only.',
  },
  {
    source: 'huggingface',
    licenseSpdx: 'LicenseRef-HuggingFace-Mixed',
    licenseUrl: 'https://huggingface.co/terms-of-service',
    attribution: 'Hugging Face Hub.',
    datasetUrl: 'https://huggingface.co/datasets',
    notes: 'Metadata (dataset existence, counts) is freely queryable. Individual datasets have their own licenses.',
  },
  {
    source: 'masakhane',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Masakhane NLP community.',
    datasetUrl: 'https://www.masakhane.io/',
  },
  {
    source: 'doreco',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Paschen, L. et al. 2020. Building a time-aligned cross-linguistic reference corpus from language documentation data (DoReCo).',
    datasetUrl: 'https://doreco.info/',
  },
  {
    source: 'flores-200',
    licenseSpdx: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'NLLB Team et al. 2022. No Language Left Behind.',
    requiresSharealike: true,
    datasetUrl: 'https://github.com/facebookresearch/flores',
  },

  // ── Archives ──
  {
    source: 'paradisec',
    licenseSpdx: 'LicenseRef-PARADISEC-Mixed',
    licenseUrl: 'https://www.paradisec.org.au/deposit/',
    attribution: 'Pacific and Regional Archive for Digital Sources in Endangered Cultures (PARADISEC).',
    datasetUrl: 'https://catalog.paradisec.org.au/',
    notes: 'Metadata is freely available. Individual recordings have per-deposit access controls and licenses.',
  },
  {
    source: 'elar',
    licenseSpdx: 'LicenseRef-ELAR-Mixed',
    licenseUrl: 'https://elar.soas.ac.uk/about',
    attribution: 'Endangered Languages Archive (ELAR), SOAS University of London.',
    datasetUrl: 'https://elar.soas.ac.uk/',
    notes: 'Metadata (deposit existence, language coverage) is freely available. Deposit content has tiered access levels.',
  },

  // ── Keyboard & input ──
  {
    source: 'keyman',
    licenseSpdx: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    attribution: 'SIL International. Keyman keyboard catalog.',
    datasetUrl: 'https://keyman.com/keyboards',
    notes: 'Keyman keyboard metadata is MIT licensed. Individual keyboard projects may have their own licenses.',
  },

  // ── MT engine support lists ──
  // These are factual data (which languages an API supports) — not copyrightable
  {
    source: 'google-translate',
    licenseSpdx: 'LicenseRef-FactualData',
    attribution: 'Google Cloud Translation API supported languages list.',
    datasetUrl: 'https://cloud.google.com/translate/docs/languages',
    notes: 'Factual data: list of supported language codes. Not copyrightable.',
  },
  {
    source: 'microsoft-translator',
    licenseSpdx: 'LicenseRef-FactualData',
    attribution: 'Microsoft Azure Translator supported languages list.',
    datasetUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support',
    notes: 'Factual data: list of supported language codes. Not copyrightable.',
  },
  {
    source: 'deepl',
    licenseSpdx: 'LicenseRef-FactualData',
    attribution: 'DeepL supported languages list.',
    datasetUrl: 'https://developers.deepl.com/docs/resources/supported-languages',
    notes: 'Factual data: list of supported language codes. Not copyrightable.',
  },
  {
    source: 'meta-nllb-200',
    licenseSpdx: 'CC-BY-NC-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution: 'NLLB Team et al. 2022. No Language Left Behind: Scaling Human-Centered Machine Translation.',
    nonCommercialOnly: true,
    datasetUrl: 'https://ai.meta.com/research/no-language-left-behind/',
    notes: 'NLLB model is CC-BY-NC-4.0. We only store the language support list (factual data).',
  },
  {
    source: 'libretranslate',
    licenseSpdx: 'AGPL-3.0-only',
    licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
    attribution: 'LibreTranslate.',
    datasetUrl: 'https://libretranslate.com/',
    notes: 'Software is AGPL. We only store the supported language list (factual data).',
  },

  // ── Normalize-for-cards derived data ──
  {
    source: 'normalize-for-cards',
    licenseSpdx: 'LicenseRef-Champollion-Derived',
    attribution: 'Champollion Project. Derived from upstream sources — see individual fact provenance.',
    notes: 'Canonical property normalizations derived from existing DB facts. Original source licenses apply to the underlying data.',
  },
  {
    source: 'champollion-derived',
    licenseSpdx: 'LicenseRef-Champollion-Derived',
    attribution: 'Champollion Project. Computed metrics derived from multiple upstream sources.',
    notes: 'Computed/derived properties (digitalReadiness, orthographicStatus, etc.).',
  },

  // ── D-PLACE ──
  {
    source: 'dplace-cldf',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Kirby, K.R. et al. 2016. D-PLACE: A Global Database of Cultural, Linguistic and Environmental Diversity. PLoS ONE.',
    datasetUrl: 'https://d-place.org/',
  },
  {
    source: 'dplace-ea',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'D-PLACE Ethnographic Atlas. Kirby et al.',
    datasetUrl: 'https://d-place.org/',
  },

  // ── ASJP ──
  {
    source: 'asjp',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Wichmann, S., Holman, E.W. & Brown, C.H. (eds.). The ASJP Database (version 20).',
    datasetUrl: 'https://asjp.clld.org/',
    datasetVersion: '20',
  },

  // ── Other CLLD databases ──
  {
    source: 'apics',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Michaelis, Susanne Maria et al. (eds.) 2013. Atlas of Pidgin and Creole Language Structures Online.',
    datasetUrl: 'https://apics-online.info/',
  },
  {
    source: 'ewave',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Kortmann, Bernd & Lunkenheimer, Kerstin (eds.). eWAVE.',
    datasetUrl: 'https://ewave-atlas.org/',
  },
  {
    source: 'clics3',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Rzymski, C. et al. 2020. The Database of Cross-Linguistic Colexifications (CLICS³).',
    datasetUrl: 'https://clics.clld.org/',
  },
  {
    source: 'concepticon',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'List, J.M. et al. 2024. CLLD Concepticon.',
    datasetUrl: 'https://concepticon.clld.org/',
  },
  {
    source: 'ids',
    licenseSpdx: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Key, M.R. & Comrie, B. (eds.) Intercontinental Dictionary Series.',
    datasetUrl: 'https://ids.clld.org/',
  },

  // ── PanLex ──
  {
    source: 'panlex',
    licenseSpdx: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'PanLex. The Long Now Foundation.',
    requiresAttribution: false,
    datasetUrl: 'https://panlex.org/',
    notes: 'PanLex data is CC0. Status of API/data availability uncertain as of 2024.',
  },

  // ── OLAC (to be ingested) ──
  {
    source: 'olac',
    licenseSpdx: 'LicenseRef-OLAC-Metadata',
    attribution: 'Open Language Archives Community (OLAC).',
    datasetUrl: 'http://www.language-archives.org/',
    notes: 'OLAC metadata is openly accessible for harvesting. Individual archive resources have their own licenses.',
  },
];

let manualRegistered = 0;
for (const license of MANUAL_LICENSES) {
  if (auditOnly) continue;
  try {
    db.registerSourceLicense(license);
    manualRegistered++;
  } catch (err) {
    console.warn(`  ⚠️  Error registering ${license.source}: ${err.message}`);
  }
}
console.log(`Registered ${manualRegistered} non-CLDF source licenses\n`);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2b: Apply Champollion's resolved license corrections.
// shared/license-corrections.json is the single SSOT for the 2026-06-16
// license-respect remediation — the same file cli/lib/license-gate.mjs reads at
// runtime. These override any earlier auto/manual classification. Once a full
// populate + build-trading-card + build-shared run has folded them into
// shared/licenses.json, the corrections file can be retired. See docs/LICENSING.md.
// ─────────────────────────────────────────────────────────────────────────────
const CORRECTIONS_PATH = join(__dirname, '..', '..', 'shared', 'license-corrections.json');
let correctionsApplied = 0;
if (!auditOnly && existsSync(CORRECTIONS_PATH)) {
  console.log('=== Phase 2b: Applying resolved license corrections ===\n');
  const corr = JSON.parse(readFileSync(CORRECTIONS_PATH, 'utf-8')).sources || {};
  for (const [source, rec] of Object.entries(corr)) {
    try {
      db.registerSourceLicense({
        source,
        licenseSpdx: rec.license_spdx ?? null,
        licenseUrl: rec.license_url ?? null,
        attribution: rec.attribution ?? null,
        allowsRedistribution: rec.allows_redistribution !== 0,
        requiresAttribution: rec.requires_attribution !== 0,
        requiresSharealike: rec.requires_sharealike === 1,
        nonCommercialOnly: rec.non_commercial_only === 1,
        notes: rec._basis ?? 'Champollion resolved license (shared/license-corrections.json)',
      });
      correctionsApplied++;
    } catch (err) {
      console.warn(`  ⚠️  Error applying correction for ${source}: ${err.message}`);
    }
  }
  console.log(`Applied ${correctionsApplied} resolved license corrections\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: Audit — find sources with facts but no license
// ─────────────────────────────────────────────────────────────────────────────

console.log('=== Phase 3: License compliance audit ===\n');

const unlicensed = db.getUnlicensedSources();
const allLicenses = db.getAllSourceLicenses();
const allSources = db._db.prepare('SELECT DISTINCT source FROM facts').all().length;

console.log(`Sources with license: ${allLicenses.length}`);
console.log(`Sources without license: ${unlicensed.length}`);
console.log(`Total sources: ${allSources}\n`);

if (unlicensed.length > 0) {
  console.log('Unlicensed sources (need manual registration):');
  for (const u of unlicensed) {
    console.log(`  ⚠️  ${u.source} (${u.fact_count.toLocaleString()} facts)`);
  }
}

// Check for NC-licensed sources
const ncSources = allLicenses.filter(l => l.non_commercial_only);
if (ncSources.length > 0) {
  console.log('\n⚠️  Non-commercial-only sources (verify usage compliance):');
  for (const nc of ncSources) {
    const factCount = db._db.prepare('SELECT COUNT(*) as c FROM facts WHERE source = ?').get(nc.source)?.c || 0;
    console.log(`  ${nc.source}: ${nc.license_spdx} (${factCount.toLocaleString()} facts)`);
  }
}

// Summary
console.log('\n=== License Summary ===');
const licenseCounts = {};
for (const l of allLicenses) {
  const spdx = l.license_spdx || 'UNKNOWN';
  licenseCounts[spdx] = (licenseCounts[spdx] || 0) + 1;
}
for (const [spdx, count] of Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${spdx}: ${count} sources`);
}

db.close();
console.log('\nDone.');
