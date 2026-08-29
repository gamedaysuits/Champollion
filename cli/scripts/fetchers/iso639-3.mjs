/**
 * fetcher: sil-iso639-3 — the code registry.
 *
 * WHAT IT PINS
 *   SIL's DATED code-table release, e.g. `iso-639-3_Code_Tables_20260715.zip`.
 *
 *   This matters more than it looks. SIL also serves the same four tables at
 *   bare, undated URLs (`/downloads/iso-639-3.tab`), and those are what a
 *   previous import took. A bare URL is not a source you can regenerate from —
 *   it is "whatever the registry served the day someone ran the script", and
 *   two runs a month apart silently produce different spines with no way to
 *   tell which is which. The dated zip names ONE release, so it is a pin.
 *
 * WHAT IT FOUND (2026-08-02)
 *   The tables on disk are an OLDER release than the one upstream publishes:
 *   our `iso-639-3.tab` is 178,336 bytes against upstream's 178,280, and our
 *   retirements table 18,981 against 19,046. ISO 639-3 changes every year —
 *   codes are added, retired, merged — so a stale registry means the language
 *   spine itself is stale, and the 154 retirement merges resolved in
 *   `ingest-base.mjs` were resolved against last year's rules.
 *
 * WHY THIS ONE DOWNLOADS AND GLOTTOLOG DOES NOT
 *   SIL publishes no checksums, so there is nothing to compare local bytes
 *   against — `adopt()` would have to take the filename's word for it, which is
 *   not evidence. Fetching for real is the only honest way to pin this source.
 *   The release date in the zip name becomes the version.
 *
 * Usage:
 *   node cli/scripts/fetchers/iso639-3.mjs
 *   node cli/scripts/fetchers/iso639-3.mjs --verify
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DATA_ROOT, USER_AGENT, download, sha256File, verify, writeSnapshot,
} from './lib/fetch-lib.mjs';

export const source = 'sil-iso639-3';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "id": "iso639-3",
  "module": "(native)",
  "handler": "iso639",
  "license": "LicenseRef-SIL-ISO639-3-Terms",
  "contributes": "reference names, alternate names, scope, language type, macrolanguage membership, retirements",
  "note": "Tab-separated SIL tables, not CLDF. LicenseRef: SIL permits INCORPORATING the code set and forbids a product that provides a means to redistribute it, so these values are ingested and built on while the release is flagged not-redistributable for the publication gate. Retired codes are kept deliberately -- corpora and configs in the wild still use them, and a practitioner arriving with a retired code needs to be told where it now points."
};
export const dir = 'iso639-3';

const DOWNLOADS_PAGE = 'https://iso639-3.sil.org/code_tables/download_tables';

/** The four tables we consume. Anything else in the zip is not our business. */
const WANTED = new Set([
  'iso-639-3.tab',
  'iso-639-3-macrolanguages.tab',
  'iso-639-3_Retirements.tab',
  'iso-639-3_Name_Index.tab',
]);

/**
 * Find the current dated release by reading SIL's own download page.
 *
 * Hardcoding the date would mean this fetcher silently kept pinning a release
 * that had been superseded — the exact failure it exists to detect.
 */
async function resolveRelease() {
  const res = await fetch(DOWNLOADS_PAGE, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`GET ${DOWNLOADS_PAGE} → HTTP ${res.status}`);
  const html = await res.text();

  const found = [...html.matchAll(
    /https:\/\/iso639-3\.sil\.org\/sites\/iso639-3\/files\/downloads\/(iso-639-3_Code_Tables_(\d{8})\.zip)/g,
  )];
  if (!found.length) {
    throw new Error(
      'No dated code-table zip found on SIL\'s download page. The page layout '
      + 'changed — fix this fetcher rather than falling back to the undated URLs, '
      + 'which cannot be pinned.',
    );
  }
  // Newest date wins; the page has historically listed more than one.
  const best = found.sort((a, b) => b[2].localeCompare(a[2]))[0];
  return { url: best[0], filename: best[1], release: best[2] };
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const { url, release } = await resolveRelease();
  const iso = `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}`;
  process.stdout.write(`  release ${release} → ${url}\n`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-iso639-'));
  const zipPath = path.join(tmp, 'codetables.zip');
  try {
    const dl = await download(url, zipPath);
    execFileSync('unzip', ['-o', '-q', '-j', zipPath, '-d', tmp]);

    const target = path.join(DATA_ROOT, dir);
    fs.mkdirSync(target, { recursive: true });

    const files = [];
    const changed = [];
    for (const name of fs.readdirSync(tmp)) {
      if (!WANTED.has(name)) continue;
      const from = path.join(tmp, name);
      const to = path.join(target, name);
      const before = fs.existsSync(to) ? sha256File(to) : null;
      const after = sha256File(from);
      if (before !== after) changed.push({ name, wasPresent: before !== null });
      fs.copyFileSync(from, to);
      files.push({
        path: name,
        bytes: fs.statSync(to).size,
        sha256: after,
        url,
        upstreamChecksum: null,      // SIL publishes none
        upstreamVerified: false,
      });
    }
    const missing = [...WANTED].filter((w) => !files.some((f) => f.path === w));
    if (missing.length) {
      throw new Error(
        `The ${release} release does not contain: ${missing.join(', ')}. `
        + 'Refusing to write a snapshot describing a partial registry.',
      );
    }

    writeSnapshot(dir, {
      source,
      upstream: url,
      // NOT a standard SPDX licence. SIL grants a bespoke permission whose
      // third condition is the one that matters to us, verbatim from
      // https://iso639-3.sil.org/code_tables/download_tables (2026-08-05):
      //
      //   "The ISO 639-3 code set may be downloaded and incorporated into
      //    software products, web-based systems, digital devices, etc., either
      //    commercial or non-commercial, provided that:
      //      - attribution is given to iso639-3.sil.org as the source of the
      //        codes;
      //      - the identifiers of the code set are not modified or extended
      //        except as may be privately agreed using the Private Use Area
      //        (range qaa to qtz), and then such extensions shall not be
      //        distributed publicly;
      //      - the product, system, or device does not provide a means to
      //        redistribute the code set."
      //
      // USING the codes is explicitly permitted, commercially or not.
      // REDISTRIBUTING the code set is not, and a published CLDF LanguageTable
      // of code + reference name + scope + type is very close to being the code
      // set. So the release is recorded as non-redistributable and the public
      // release gate must treat it accordingly. We do not interpret a bespoke
      // licence in our own favour.
      license: 'LicenseRef-SIL-ISO639-3-Terms',
      licenseUrl: 'https://iso639-3.sil.org/code_tables/download_tables',
      citation:
        `SIL International (Registration Authority for ISO 639-3). ${iso}. `
        + 'ISO 639-3 Code Tables.',
      // The dated release IS the pin. sha256 is ours, computed on retrieval,
      // because SIL publishes no checksum of its own to defer to.
      pin: { kind: 'release', value: release, doi: null, date: iso },
      files,
      verified: true,
      fetchedBy: 'cli/scripts/fetchers/iso639-3.mjs',
      notes:
        'SIL publishes no checksums, so `upstreamVerified` is false by necessity: '
        + 'the sha256 here is what we received, not something the publisher '
        + 'independently attests. The dated release name is the pin. Downloaded '
        + `zip was ${dl.bytes.toLocaleString()} bytes, sha256 ${dl.sha256.slice(0, 16)}….`,
    });

    return { release, files, changed };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
