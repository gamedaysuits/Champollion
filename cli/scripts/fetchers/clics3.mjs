/**
 * fetcher: clics3 — the Database of Cross-Linguistic Colexifications.
 *
 * WHAT IT PINS
 *   The CLICS³ release deposit, DOI 10.5281/zenodo.3687530 (v1.1), md5-checked
 *   against Zenodo's own published checksum.
 *
 * WHAT THAT DEPOSIT IS, AND WHAT IT IS NOT
 *   It is the CLICS³ repository: the specification of which 30 source datasets
 *   go in, the analysis code, and the documentation. It is NOT the built
 *   database. `cli/data/clics3/clics.sqlite` is 627 MB of DERIVED output,
 *   produced by running that pipeline over the 30 upstream corpora.
 *
 *   So the honest position is narrower than for a CLDF dataset: this pin
 *   establishes WHICH VERSION of CLICS we mean and what it was built from. It
 *   does not, by itself, prove the sqlite on disk is what that version
 *   produces — rebuilding it would mean fetching all 30 corpora and running
 *   the pipeline.
 *
 *   That distinction is recorded on the snapshot rather than glossed. A pin
 *   that claims more than it establishes is the failure mode this whole pass
 *   exists to remove, and "the DOI is right so the derived file must be" is
 *   exactly that shape of claim.
 *
 * WHY NOT CLICS 4
 *   CLICS 4 exists (10.5281/zenodo.19608447) and our data is CLICS³. Upgrading
 *   a major version changes values on 1,783 cards, which is a deliberate
 *   decision with a diff to review — not a side effect of writing a fetcher.
 *   Pin what we have; upgrade on purpose.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs clics3
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_ROOT, download, md5File, parseZenodoChecksum, sha256File, verify, writeSnapshot,
  zenodoVersion,
} from './lib/fetch-lib.mjs';

export const source = 'clics3';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "clics3",
  "license": "cc-by-4.0",
  "contributes": "colexification",
  "note": "A 408 MB SQLite database, not CLDF-on-disk. A colexification is one FORM expressing two or more concepts -- German Baum for both tree and wood -- and it is one of the few lexical facts that predicts where an MT system will go wrong. Concepts are counted through Concepticon IDs, not raw parameter labels: CLICS3 aggregates many datasets and the same concept arrives under different names, so counting labels would inflate every number by however many datasets a language appears in. The invariant colexifyingForms <= colexificationConcepts is CHECKED -- the previous corpus shipped cards violating it."
};
export const dir = 'clics3';

const CONCEPT_ID = 3533554;        // clics/clics3 (concept, all versions)
const WANT_VERSION = 'v1.1';

/** Files we consume from the working directory, pinned by our own hash. */
const DERIVED = ['clics.sqlite', 'datasets.txt', 'datasets.md'];

export async function fetchSource({ refetch = false, verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const record = await zenodoVersion(CONCEPT_ID, WANT_VERSION);
  const zip = (record.files ?? []).find((f) => /\.zip$/i.test(f.key));
  if (!zip) throw new Error(`Zenodo ${record.doi} publishes no zip.`);
  const upstream = parseZenodoChecksum(zip.checksum);

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const local = path.join(target, path.basename(zip.key));

  const url = zip.links?.self
    ?? `https://zenodo.org/api/records/${record.id}/files/${zip.key}/content`;
  if (refetch || !fs.existsSync(local)) {
    process.stdout.write(`  downloading ${zip.key} (${(zip.size / 1e6).toFixed(1)} MB) …\n`);
    await download(url, local, { timeoutMs: 900_000 });
  }

  const releaseVerified = fs.existsSync(local)
    && upstream?.algo === 'md5' && md5File(local) === upstream.hex;

  const files = [];
  if (fs.existsSync(local)) {
    files.push({
      path: path.basename(zip.key),
      bytes: fs.statSync(local).size,
      sha256: sha256File(local),
      url,
      upstreamChecksum: zip.checksum,
      upstreamVerified: releaseVerified,
    });
  }

  // The derived artefacts we actually read. Hashed so drift is detectable, but
  // NOT claimed as upstream-verified — nobody published a checksum for them.
  const derivedPresent = [];
  for (const name of DERIVED) {
    const p = path.join(target, name);
    if (!fs.existsSync(p)) continue;
    derivedPresent.push(name);
    files.push({
      path: name,
      bytes: fs.statSync(p).size,
      sha256: sha256File(p),
      url: null,
      upstreamChecksum: null,
      upstreamVerified: false,
      derivedFrom: `${zip.key} (pipeline output, not shipped by the deposit)`,
    });
  }

  if (!files.length) throw new Error('nothing on disk and nothing downloaded — cannot pin.');

  writeSnapshot(dir, {
    source,
    upstream: `https://zenodo.org/records/${record.id}`,
    license: record.metadata?.license?.id ?? null,
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    citation: 'Rzymski, Tresoldi et al. 2019. The Database of Cross-Linguistic '
      + 'Colexifications, reproducible analysis of cross-linguistic polysemies. '
      + 'DOI: 10.17613/5awv-6w15',
    pin: {
      kind: 'doi', value: record.metadata?.version ?? WANT_VERSION, doi: record.doi,
      date: record.metadata?.publication_date ?? null,
    },
    files,
    verified: releaseVerified,
    fetchedBy: 'cli/scripts/fetchers/clics3.mjs',
    notes:
      'The deposit is the CLICS³ REPOSITORY — the dataset specification and the '
      + 'analysis code — not the built database. clics.sqlite is 627 MB of derived '
      + 'output from running that pipeline over 30 upstream corpora. This pin '
      + 'establishes WHICH VERSION of CLICS we mean; it does NOT prove the sqlite '
      + 'on disk is what that version produces, and the derived files are marked '
      + 'upstreamVerified:false for exactly that reason. Rebuilding them would '
      + 'require fetching all 30 corpora and running the pipeline. '
      + `Derived files present: ${derivedPresent.join(', ') || 'none'}. `
      + 'CLICS 4 exists (10.5281/zenodo.19608447); upgrading is a deliberate '
      + 'decision with a diff to review, not a side effect of adding a fetcher.',
  });

  return { verified: releaseVerified, files: files.length, doi: record.doi };
}
