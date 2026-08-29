#!/usr/bin/env node

/**
 * fetchers/vendor-languages.mjs — what each MT service says it supports, fetched.
 *
 * WHY THIS EXISTS
 *   `shared/catalogue/method-coverage.json` has eleven entries and nine of them
 *   were typed in by a person from a documentation page. Every one carries an
 *   `asOf` date, which is the tell: a transcription date sits where a pin
 *   belongs, and a transcription cannot be re-derived or checked.
 *
 *   Meanwhile 180 language sources are pinned, checksummed and drift-detected.
 *   That asymmetry is the largest integrity gap left in the repo, and it is not
 *   theoretical — counted from the fetched bytes on 2026-08-06, two of the three
 *   shipped numbers were already wrong and the third was never indexed:
 *
 *     microsoft-translator   card said 135    endpoint says 138
 *     libretranslate         card said  49    endpoint says  51
 *     apertium               not indexed      133 pairs over 60 codes
 *
 *   (An earlier draft of this header said 110 and ~170. Both came from a
 *   summariser reading the docs pages rather than from the responses, which is
 *   the mistake this whole file exists to stop making.)
 *
 * THE KEY IS THE METHOD-REGISTRY ID, NOT A SHORT NAME
 *   `microsoft-translator`, not `microsoft`. The registry, the coverage lists
 *   and the atlas each used their own spelling, which is why the queue ranker
 *   carried a six-row ENGINE_COVERAGE_KEYS table to translate between them. A
 *   hand-maintained mapping is a place for a seventh method to be forgotten, so
 *   the identity is shared instead and the table has nothing left to map.
 *
 * KEYLESS FIRST, ON PURPOSE
 *   Microsoft, LibreTranslate and Apertium publish machine-readable language
 *   lists with no credential at all, so they can be fetched in any environment,
 *   including CI and a fresh clone. Google and DeepL need keys; they are
 *   declared here and degrade to the last pinned snapshot WITH A STATED REASON
 *   rather than silently contributing nothing.
 *
 * PAIRS, NOT JUST LANGUAGES
 *   Two of these publish more than a language list. LibreTranslate gives each
 *   language a `targets` array, and Apertium publishes pairs outright — it is a
 *   rule-based engine and has no notion of covering a language in the abstract.
 *   That distinction is already in the register as `anyToAny`, asserted by hand;
 *   here it is observed. Coverage of a language does NOT imply a pair exists,
 *   and for these two we can prove which pairs do.
 *
 * THE PIN IS WEAKER THAN A DOI, AND SAYS SO
 *   A vendor endpoint has no version, no release date and no publisher
 *   checksum. The snapshot IS the pin: what we received, when, hashed by us.
 *   `pinQuality: 'self-attested'` marks that difference so a Zenodo-pinned
 *   dataset and a scraped endpoint are never mistaken for equally solid.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs vendor-languages
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'vendor-languages';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "vendorLanguages",
  "license": "LicenseRef-Vendor-Published-Coverage",
  "contributes": "method nodes for the MT services that publish a machine-readable language list, and the coverage edges resolved from it",
  "note": "The FIRST source that writes a non-language subject. It creates method nodes in cldf_contributions and coverage edges on languages, which is what the value layer was generalised over subjects for. Replaces hand transcription: nine of eleven entries in method-coverage.json were typed from documentation pages and two had already drifted \\u2014 microsoft 135 recorded against 138 published, libre 49 against 51, and apertium never indexed at all despite having a runtime adapter. Google and DeepL need credentials and are skipped with the reason recorded in the snapshot rather than silently contributing nothing. PIN QUALITY is self-attested: a vendor endpoint has no version and no publisher checksum, so the snapshot is the pin."
};
export const dir = 'vendor-languages';

/**
 * Each vendor: where to ask, and how to read the answer. The parser is declared
 * per vendor rather than sniffed, so a changed response shape fails loudly
 * instead of yielding a shorter list nobody notices.
 */
const VENDORS = [
  {
    key: 'microsoft-translator',
    label: 'Microsoft Translator',
    url: 'https://api.cognitive.microsofttranslator.com/languages'
      + '?api-version=3.0&scope=translation',
    credential: null,
    file: 'microsoft.json',
    /** `{translation: {af: {name, nativeName, dir}, …}}` */
    parse: (j) => ({
      codes: Object.keys(j.translation ?? {}),
      pairs: null,
      note: 'BCP 47 tags including script-qualified forms (zh-Hans, sr-Cyrl)',
    }),
  },
  {
    key: 'libretranslate',
    label: 'LibreTranslate',
    url: 'https://libretranslate.com/languages',
    credential: null,
    file: 'libretranslate.json',
    /** `[{code, name, targets: [...]}, …]` — targets give real pairs. */
    parse: (j) => ({
      codes: j.map((l) => l.code),
      pairs: j.flatMap((l) => (l.targets ?? []).map((t) => [l.code, t])),
      note: 'per-language `targets` published, so pairs are observed not assumed',
    }),
  },
  {
    key: 'apertium',
    label: 'Apertium',
    url: 'https://www.apertium.org/apy/listPairs',
    credential: null,
    file: 'apertium.json',
    /** `{responseData: [{sourceLanguage, targetLanguage}, …]}` */
    parse: (j) => {
      const pairs = (j.responseData ?? []).map((p) => [p.sourceLanguage, p.targetLanguage]);
      return {
        codes: [...new Set(pairs.flat())],
        pairs,
        note: 'rule-based and inherently per-pair — it has no notion of covering '
          + 'a language in the abstract',
      };
    },
  },
  {
    key: 'google-translate',
    label: 'Google Cloud Translation',
    url: 'https://translation.googleapis.com/language/translate/v2/languages',
    credential: 'GOOGLE_TRANSLATE_API_KEY',
    file: 'google.json',
    parse: (j) => ({
      codes: (j.data?.languages ?? []).map((l) => l.language),
      pairs: null,
      note: 'BCP 47',
    }),
  },
  {
    key: 'deepl',
    label: 'DeepL',
    url: 'https://api-free.deepl.com/v2/languages?type=target',
    credential: 'DEEPL_API_KEY',
    file: 'deepl.json',
    parse: (j) => ({ codes: j.map((l) => l.language), pairs: null, note: 'ISO 639-1, upper case' }),
  },
];

async function fetchOne(v, target) {
  const headers = { accept: 'application/json', 'user-agent': USER_AGENT };
  if (v.credential) {
    const key = process.env[v.credential];
    if (!key) {
      return { skipped: true, why: `${v.credential} is not set` };
    }
    if (v.key === 'deepl') headers.Authorization = `DeepL-Auth-Key ${key}`;
    if (v.key === 'google-translate') v.url = `${v.url}?key=${key}`;
  }

  const res = await fetch(v.url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return { skipped: true, why: `HTTP ${res.status}` };
  const text = await res.text();

  let parsed;
  try {
    parsed = v.parse(JSON.parse(text));
  } catch (err) {
    // A changed response shape must not become a shorter list. It is the same
    // failure as a truncated download and gets the same treatment.
    return { skipped: true, why: `response did not parse as expected: ${err.message}` };
  }
  if (!parsed.codes?.length) {
    return { skipped: true, why: 'parsed to zero languages, which is a schema change' };
  }

  fs.writeFileSync(path.join(target, v.file), `${text}\n`);
  return { skipped: false, ...parsed };
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });

  const files = [];
  const vendors = {};
  const skipped = [];

  for (const v of VENDORS) {
    process.stdout.write(`  ${v.key.padEnd(11)} ${v.url}\n`);
    let r;
    try {
      r = await fetchOne(v, target);
    } catch (err) {
      r = { skipped: true, why: err.message };
    }
    if (r.skipped) {
      // Named, never silent. A vendor we could not reach is a gap in this
      // release, and a release that hides its gaps is worse than one that has
      // them.
      skipped.push({ vendor: v.key, why: r.why });
      process.stdout.write(`              skipped — ${r.why}\n`);
      continue;
    }
    const p = path.join(target, v.file);
    files.push({
      path: v.file,
      bytes: fs.statSync(p).size,
      sha256: sha256File(p),
      url: v.url,
      upstreamChecksum: null,
      upstreamVerified: false,
    });
    vendors[v.key] = {
      label: v.label,
      languages: r.codes.length,
      pairs: r.pairs ? r.pairs.length : null,
      note: r.note,
    };
    process.stdout.write(
      `              ${r.codes.length} language(s)${r.pairs ? `, ${r.pairs.length} pair(s)` : ''}\n`,
    );
  }

  if (!files.length) {
    throw new Error(
      'no vendor endpoint could be read, so there is nothing to pin. '
      + `Skipped: ${skipped.map((s) => `${s.vendor} (${s.why})`).join('; ')}`,
    );
  }

  const fetchedAt = new Date().toISOString();
  writeSnapshot(dir, {
    source,
    upstream: 'per-vendor public language-list endpoints (see files[].url)',
    license: 'LicenseRef-Vendor-Published-Coverage',
    licenseUrl: null,
    citation: `MT vendor published language lists, retrieved ${fetchedAt.slice(0, 10)}.`,
    // No vendor versions its list, so the retrieval date IS the release. Marked
    // self-attested so it is never mistaken for a DOI-pinned dataset.
    pin: { kind: 'release', value: fetchedAt.slice(0, 10), doi: null, date: fetchedAt.slice(0, 10) },
    pinQuality: 'self-attested',
    files,
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/vendor-languages.mjs',
    notes:
      `${files.length} vendor(s) fetched: `
      + `${Object.entries(vendors).map(([k, v]) => `${k}=${v.languages}`).join(', ')}. `
      + (skipped.length
        ? `SKIPPED: ${skipped.map((s) => `${s.vendor} (${s.why})`).join('; ')}. `
        : '')
      + 'PIN QUALITY: a vendor endpoint carries no version, no release date and no '
      + 'publisher checksum, so the snapshot IS the pin — what we received, when, '
      + 'hashed by us. That is weaker than a DOI and is labelled so the two are not '
      + 'confused. LICENCE: these are published capability statements about the '
      + "vendor's own service, not a dataset; recorded as a LicenseRef so the "
      + 'bespoke-licence rule keeps them out of any redistributed release until a '
      + 'human decides otherwise.',
    vendors,
    skipped,
  });

  return { verified: true, files: files.length, vendors, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
