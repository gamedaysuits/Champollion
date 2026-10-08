#!/usr/bin/env node

/**
 * fetchers/keyman-keyboards.mjs — the Keyman keyboard catalogue.
 *
 * WHY THIS EXISTS, AND WHAT IT SAYS ABOUT THE REST OF THE INDEX
 *   The atlas indexed 78 keyboard layouts, swept from GiellaLT and
 *   UAlbertaALTLab, and I reported that as the keyboard coverage. Keyman — SIL's
 *   keyboard platform — publishes over a thousand, and FirstVoices distributes
 *   through it, so the Indigenous North American layouts I had reported as
 *   missing were there the whole time. We had roughly 7% and no way to know.
 *
 *   That is the failure this fetcher exists to correct, and the reason
 *   `shared/cldf/resource-landscape.json` exists to prevent it recurring: a
 *   count is not a coverage figure unless something states what it is a count OF.
 *
 * WHY KEYBOARDS MATTER MORE THAN THEY SOUND
 *   For a language whose orthography needs characters no standard layout
 *   produces, a keyboard is the difference between the language being typable
 *   at all and not. It is a precondition for a community writing its own
 *   corpus, dictionary, or Wikipedia — so it belongs in an index about who can
 *   participate in their own language's digital record.
 *
 * WHAT THIS ENDPOINT DOES AND DOES NOT COVER — STATED, NOT DISCOVERED LATER
 *   `/cloud/4.0/languages` enumerates every language with a keyboard COMPILED
 *   FOR KEYMANWEB, one call, with the keyboard's id, version, size and source
 *   URL. It does NOT list desktop-only packages: `crk` has FirstVoices layouts
 *   for Windows/Android/iOS that never appear here, which is exactly why an
 *   earlier probe "found no Cree" and would have been recorded as absence.
 *
 *   The complete catalogue lives in the keymanapp/keyboards repository, whose
 *   language tags sit inside per-keyboard `.kps` XML — and the repository is
 *   1.2 GB, which is not a proportionate download for metadata. The search API
 *   returns full records but caps at ten results with no total, so it is a
 *   lookup tool and not an enumeration.
 *
 *   So this source is PARTIAL BY CONSTRUCTION, the snapshot says so in those
 *   words, and the landscape records the remainder as a known gap rather than
 *   letting 534 read as a total. An honest partial beats a complete-looking
 *   number that quietly excludes the constituency this project is for.
 *
 * EXISTENCE, NEVER CAPABILITY
 *   That a layout exists for a language, who publishes it, and where to get it.
 *   Never that it is good, current, or covers the orthography.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs keyman-keyboards
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'keyman-keyboards';
/**
 * What this source contributes, declared HERE rather than in a separate file.
 *
 * A hand-maintained manifest is a second place to remember, and 29 datasets
 * were once fetched, pinned and never declared because nothing connected the
 * two. A fetcher that exists is now a source the build knows about.
 */
export const manifest = {
  module: '(native)',
  handler: 'keymanKeyboards',
  license: 'LicenseRef-Keyman-Catalogue-Metadata',
  contributes: 'keyboard layout existence, per language',
  note:
    '534 languages with a keyboard compiled for KeymanWeb, one call. ADDS to '
    + 'giellalt-resources, which indexed 78 layouts that were reported as the keyboard '
    + 'coverage when the catalogue is over a thousand. PARTIAL BY CONSTRUCTION: desktop-'
    + 'only packages are absent, so an absence here is NOT evidence a language has no '
    + 'keyboard \u2014 Plains Cree has FirstVoices layouts that never appear. The '
    + 'remainder is a recorded gap in resource-landscape.json. EXISTENCE ONLY: that a '
    + 'layout exists, who publishes it and where to get it, never that it is good or '
    + 'covers the orthography.',
};

export const dir = 'keyman-keyboards';

const FILE = 'keyman-languages.json';
const API = 'https://api.keyman.com/cloud/4.0/languages';

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const res = await fetch(API, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Keyman returned HTTP ${res.status}`);
  const body = await res.json();

  const languages = body?.languages?.languages ?? [];
  if (!languages.length) {
    throw new Error(
      'the Keyman language list came back empty. That is an API or schema change, never '
      + 'a platform with no keyboards — it publishes over a thousand.',
    );
  }

  // Only what a resource claim needs. The response carries font metadata and
  // display options that would make the pin churn on unrelated changes.
  const rows = languages
    .map((l) => ({
      code: l.id,
      name: l.name ?? null,
      keyboards: (l.keyboards ?? []).map((k) => ({
        id: k.id,
        name: k.name ?? null,
        version: k.version ?? null,
        // The pointer. A catalogue that cannot tell you where to get the thing
        // is a catalogue with the call numbers torn out.
        source: k.source ?? null,
        lastModified: k.lastModified ?? null,
      })).sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((l) => l.code && l.keyboards.length)
    .sort((a, b) => a.code.localeCompare(b.code));

  const distinct = new Set(rows.flatMap((l) => l.keyboards.map((k) => k.id)));

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  fs.writeFileSync(dest, `${JSON.stringify(rows, null, 0)}\n`);

  const fetchedAt = new Date().toISOString();
  writeSnapshot(dir, {
    source,
    upstream: API,
    license: 'LicenseRef-Keyman-Catalogue-Metadata',
    licenseUrl: 'https://keyman.com/',
    citation: `Keyman keyboard catalogue (SIL International), retrieved ${fetchedAt.slice(0, 10)}.`,
    pin: { kind: 'release', value: fetchedAt.slice(0, 10), doi: null, date: fetchedAt.slice(0, 10) },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: API,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/keyman-keyboards.mjs',
    // PARTIAL BY CONSTRUCTION, said plainly. The whole reason this source
    // exists is that a subset was once reported as a total.
    complete: false,
    notes:
      `${rows.length} languages with at least one keyboard; ${distinct.size} distinct `
      + 'keyboards. REPLACES nothing — it ADDS to giellalt-resources, which indexed 78 '
      + 'layouts that were reported as the keyboard coverage when the real catalogue is '
      + 'over a thousand. PARTIAL BY CONSTRUCTION: this endpoint lists only keyboards '
      + 'COMPILED FOR KEYMANWEB. Desktop-only packages are absent — Plains Cree has '
      + 'FirstVoices layouts for Windows, Android and iOS that never appear here, so an '
      + 'absence in this file is NOT evidence that a language has no keyboard. The '
      + 'complete catalogue is in the keymanapp/keyboards repository with language tags '
      + 'inside per-keyboard .kps XML; that repository is 1.2 GB, which is not a '
      + 'proportionate download for metadata, and the search API caps at ten results with '
      + 'no total so it cannot enumerate. The remainder is recorded as a known gap in '
      + 'shared/cldf/resource-landscape.json rather than left to read as a total. '
      + 'EXISTENCE ONLY: that a layout exists, who publishes it and where to get it — '
      + 'never that it is good, current, or covers the orthography.',
    languages: rows.length,
    keyboards: distinct.size,
  });

  return { verified: true, files: 1, languages: rows.length, keyboards: distinct.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
