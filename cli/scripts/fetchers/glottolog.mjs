/**
 * fetcher: glottolog — the classification spine.
 *
 * WHAT IT PINS
 *   `glottolog_languoid.csv.zip` and the geo table, from the DOI-versioned
 *   "Glottolog custom downloads" deposit on Zenodo. Both are citable, immutable
 *   and checksummed by the publisher, which is what makes the pin real rather
 *   than a note-to-self.
 *
 * A PROVENANCE DEFECT THIS FETCHER FOUND (2026-08-02)
 *   `cli/data/glottolog/README.txt` — shipped BY Glottolog with the download —
 *   says "Glottolog 5.3" and cites https://doi.org/10.5281/zenodo.15525265.
 *   That DOI is **Glottolog 5.2**, published 2025-05-27. Glottolog 5.3's DOI is
 *   10.5281/zenodo.18840935 (2026-03-02), and the custom-downloads deposit our
 *   files actually come from is 10.5281/zenodo.21681980.
 *
 *   So the citation printed inside our own data directory pointed at the wrong
 *   release. Anyone auditing us would have found a version claim and a DOI that
 *   contradict each other. Nothing downstream noticed, because nothing
 *   downstream had any way to check.
 *
 *   We did not resolve this by trusting either string. `glottolog_languoid.csv.zip`
 *   on disk is 589,571 bytes with md5 565d5cecb0d387bd8816f8ce6a12e465 — bit
 *   identical to the file in deposit 21681980. That is the pin, and it is
 *   checkable by anyone.
 *
 * WHY ADOPT RATHER THAN RE-DOWNLOAD
 *   The bytes on disk provably ARE the named release; re-fetching would change
 *   nothing and cost 590 KB plus a 1 MB geo table for no gain in certainty.
 *   `--refetch` downloads anyway when you want the newest release instead.
 *
 * Usage:
 *   node cli/scripts/fetchers/glottolog.mjs            # adopt + pin from Zenodo
 *   node cli/scripts/fetchers/glottolog.mjs --refetch  # download the release
 *   node cli/scripts/fetchers/glottolog.mjs --verify   # recheck disk vs SNAPSHOT
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_ROOT, adopt, download, verify, writeSnapshot, zenodoVersion,
} from './lib/fetch-lib.mjs';

export const source = 'glottolog';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "glottolog",
  "license": "CC-BY-4.0",
  "contributes": "classification, geography, countries, dialect count",
  "note": "languoid.csv is Glottolog's own flat export of a TREE, not CLDF: the classification of a language is the path between family_id and parent_id, so there is no ValueTable to dispatch on. Glottolog ASSERTS family, countries and child_dialect_count; the ancestry walk is OURS and carries champollion-derived."
};
export const dir = 'glottolog';

/** The DOI-versioned deposit that publishes the derived CSV downloads. */
const CONCEPT_ID = 21676495;          // "Glottolog custom downloads"
const WANT_VERSION = 'v5.3';

/** Upstream file → local filename. Only what we actually consume. */
const WANTED = {
  'glottolog_languoid.csv.zip': 'glottolog_languoid.csv.zip',
  'languages_and_dialects_geo.csv': 'languages_and_dialects_geo.csv',
};

export async function fetchSource({ refetch = false, verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const record = await zenodoVersion(CONCEPT_ID, WANT_VERSION);
  const version = record.metadata?.version ?? WANT_VERSION;
  const doi = record.doi;
  const license = record.metadata?.license?.id ?? null;

  const candidates = [];
  for (const f of record.files ?? []) {
    const local = WANTED[f.key];
    if (!local) continue;
    const url = f.links?.self ?? `https://zenodo.org/api/records/${record.id}/files/${f.key}/content`;
    if (refetch || !fs.existsSync(path.join(DATA_ROOT, dir, local))) {
      process.stdout.write(`  downloading ${f.key} (${(f.size / 1e6).toFixed(1)} MB) …\n`);
      await download(url, path.join(DATA_ROOT, dir, local));
    }
    candidates.push({ path: local, upstreamChecksum: f.checksum, url });
  }
  if (!candidates.length) {
    throw new Error(
      `Zenodo ${doi} does not publish any of: ${Object.keys(WANTED).join(', ')}. `
      + 'The deposit layout changed; fix this fetcher rather than guessing.',
    );
  }

  const { files, verified, unmatched } = adopt({ dir, candidates });

  writeSnapshot(dir, {
    source,
    upstream: `https://zenodo.org/records/${record.id}`,
    license,
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    citation:
      'Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. '
      + `2026. Glottolog ${version.replace(/^v/, '')}. Leipzig: Max Planck Institute `
      + 'for Evolutionary Anthropology.',
    pin: verified ? { kind: 'doi', value: version, doi, date: record.metadata?.publication_date }
      : null,
    files,
    verified,
    fetchedBy: 'cli/scripts/fetchers/glottolog.mjs',
    notes: verified
      ? 'Every file bit-identical to the Zenodo deposit (md5 compared against the '
        + 'publisher\'s own checksum). The README.txt in this directory cites DOI '
        + '10.5281/zenodo.15525265, which is Glottolog 5.2 — a stale citation shipped '
        + 'upstream. This SNAPSHOT is the authority; the README is not.'
      : `UNVERIFIED — ${unmatched.map((u) => `${u.path}: ${u.why}`).join('; ')}. `
        + 'No pin written: bytes that do not match the deposit are not that release.',
  });

  return { verified, files, unmatched, doi, version };
}
