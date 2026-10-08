/**
 * fetcher: linguameta — Google Research's per-language metadata table.
 *
 * WHAT IT PINS
 *   `linguameta.tsv` from google-research/url-nlp at an exact commit. GitHub
 *   serves content addressed by commit SHA, so the URL itself is the pin — the
 *   strongest kind available short of a DOI, because a commit cannot be
 *   rewritten under you without changing its name.
 *
 * WHY IT IS NOT `--all`-ABLE FROM THE ZENODO REGISTRY
 *   LinguaMeta is not a CLDF dataset and is not deposited on Zenodo. It needs
 *   its own fetcher, which is exactly what the "no fetcher, no source" rule is
 *   for: the alternative was leaving 7,511 languages' worth of speaker
 *   estimates, endonyms and writing systems sitting on disk with a README
 *   describing their provenance in prose that nothing could check.
 *
 * WHAT THE PROSE GOT RIGHT, AND WHY THAT IS NOT ENOUGH
 *   The existing README states the commit and a sha256, and both turn out to be
 *   correct. That is better than most of cli/data managed. But a README is not
 *   machine-readable, nothing verified it on any schedule, and no fact derived
 *   from the file carried the commit — so the pipeline still could not answer
 *   "which bytes said this". The fetcher turns the same information into a
 *   SNAPSHOT the extractor can attach to every row it writes.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs linguameta
 *   node cli/scripts/fetch-source.mjs linguameta --refetch
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_ROOT, download, sha256File, verify, writeSnapshot,
} from './lib/fetch-lib.mjs';

export const source = 'linguameta';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "linguameta",
  "license": "CC-BY-4.0",
  "contributes": "endonym, BCP-47, scripts, speaker estimates, a third endangerment scale",
  "note": "A flat TSV, not CLDF. cldr_official_status packs country-scoped statuses into one cell -- decomposed to one value per territory, the territory in Variant. Its endangerment scale is a UNESCO-style six levels, which is neither ELCat's nine nor Glottolog AES's six, so all three are separate Source_Scales."
};
export const dir = 'linguameta';

/**
 * The commit the snapshot on disk came from — the most recent one to touch the
 * file as of 2025-08-01. Bump deliberately, with a diff, never automatically:
 * this table feeds speaker counts and endonyms on thousands of cards.
 */
const COMMIT = '452a21ad3dae5668c06ceeac21ff073e1e40f9be';
const FILE = 'linguameta/linguameta.tsv';
const URL = `https://raw.githubusercontent.com/google-research/url-nlp/${COMMIT}/${FILE}`;

export async function fetchSource({ refetch = false, verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const local = path.join(DATA_ROOT, dir, 'linguameta.tsv');
  const before = fs.existsSync(local) ? sha256File(local) : null;

  if (refetch || !before) {
    process.stdout.write(`  downloading linguameta.tsv @ ${COMMIT.slice(0, 8)} …\n`);
    await download(URL, local);
  } else {
    // Verify against GitHub without replacing: fetch to a temp path and compare.
    // A silent overwrite of a file 7,511 cards depend on is worth avoiding even
    // when the bytes are expected to be identical.
    const tmp = `${local}.check`;
    try {
      await download(URL, tmp);
      const remote = sha256File(tmp);
      if (remote !== before) {
        fs.rmSync(tmp, { force: true });
        return {
          verified: false,
          unmatched: [{
            path: 'linguameta.tsv',
            why: `disk sha256 ${before.slice(0, 12)}… differs from ${COMMIT.slice(0, 8)}`
              + ` (${remote.slice(0, 12)}…). The file was edited, or the pin is wrong.`,
          }],
        };
      }
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const sha256 = sha256File(local);
  writeSnapshot(dir, {
    source,
    upstream: `https://github.com/google-research/url-nlp/blob/${COMMIT}/${FILE}`,
    license: 'CC-BY-4.0',
    licenseUrl: 'https://github.com/google-research/url-nlp/blob/main/LICENSE',
    citation: 'Ritchie, Sandy et al. LinguaMeta: Unified Metadata for Thousands of '
      + 'Languages. Google Research.',
    // A git commit IS the pin: content-addressed, so the URL cannot serve
    // different bytes tomorrow.
    pin: { kind: 'commit', value: COMMIT, doi: null, date: '2025-08-01' },
    files: [{
      path: 'linguameta.tsv',
      bytes: fs.statSync(local).size,
      sha256,
      url: URL,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/linguameta.mjs',
    notes: 'GitHub serves this URL by commit SHA, so the bytes are immutable for '
      + 'that commit — `upstreamVerified` is false only because GitHub publishes '
      + 'no separate checksum to compare against, not because the pin is weak. '
      + `Bytes on disk confirmed identical to ${COMMIT.slice(0, 8)} on fetch.`,
  });

  return { verified: true, files: 1, commit: COMMIT, changed: before && before !== sha256 ? 1 : 0 };
}
