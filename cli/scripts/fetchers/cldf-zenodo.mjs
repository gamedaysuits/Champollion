/**
 * fetcher: cldf-zenodo — one fetcher for every CLDF dataset we cite.
 *
 * WHY ONE FETCHER AND NOT TWO HUNDRED
 *   The bulk of the atlas's typological, lexical and phonological facts come
 *   from CLDF datasets published to Zenodo through the Lexibank, cldf-datasets,
 *   clld and dictionaria communities. They share a shape: a versioned DOI, an
 *   md5 published by Zenodo, and a zip containing CSVs. Hand-writing a fetcher
 *   apiece would be two hundred copies of one idea, each free to drift.
 *
 *   The pins were already harvested — `cli/data/zenodo-cldf-records.json` holds
 *   DOI, version, licence and per-file checksums for 260 sources. That file was
 *   built to settle the licence register; it turns out to be the fetch registry
 *   too.
 *
 * WHY IT DOWNLOADS AND EXTRACTS RATHER THAN ADOPTING WHAT IS ON DISK
 *   Zenodo publishes a checksum for the ZIP. What sits in `cli/data/<source>/`
 *   is the EXTRACTED CSVs. Their hashes cannot match the zip's, so there is
 *   nothing to compare against — adopting them would mean writing a DOI beside
 *   bytes we cannot tie to it. A DOI attached to unverified bytes is worse than
 *   no pin at all: it reads as provenance and isn't.
 *
 *   So this downloads the deposit, checks it against Zenodo's own md5, and
 *   extracts from the verified archive. Every extracted file records
 *   `derivedFrom` naming that archive, so the chain from a CSV back to a DOI is
 *   legible end to end rather than asserted.
 *
 * Usage:
 *   node cli/scripts/fetchers/cldf-zenodo.mjs --source wals
 *   node cli/scripts/fetch-source.mjs cldf-zenodo --source wals,asjp
 *   node cli/scripts/fetchers/cldf-zenodo.mjs --all       # ~2.3 GB, 198 sources
 *   node cli/scripts/fetchers/cldf-zenodo.mjs --list      # what it can pin
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_ROOT, download, md5File, parseZenodoChecksum, readSnapshot, sha256File, verify,
  writeSnapshot,
} from './lib/fetch-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.join(DATA_ROOT, 'zenodo-harvest', 'records.json');

/** This module pins many sources, so `source` names the mechanism, not one dataset. */
export const source = 'cldf-zenodo';
export const dir = null;          // per-dataset; see pinOne()

function registry() {
  if (!fs.existsSync(REGISTRY)) {
    throw new Error(
      `${REGISTRY} not found. Run cli/scripts/harvest-zenodo-cldf.mjs first — `
      + 'it is what turns a source name into a DOI.',
    );
  }
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')).sources;
}

/** CLDF payload we consume. The zip also carries docs and raw/ we do not. */
const KEEP = /\.(csv|json|bib|txt|tsv)$/i;

/**
 * Locate the `cldf/` directory inside an extracted deposit.
 *
 * Deposits nest as `<name>-<version>/cldf/`, but the depth varies and a few
 * publish the dataset at the root. Searching for it beats assuming a layout —
 * assuming is what produced 85 sources whose snapshots did not describe the
 * files sitting next to them.
 */
/**
 * Strip the `<org>-<name>-<sha>/` wrapper GitHub archives add, so relative
 * paths are the deposit's own and do not carry a commit hash into our tree.
 */
function deposiRoot(stage) {
  const entries = fs.readdirSync(stage, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  return (dirs.length === 1 && entries.length === 1)
    ? path.join(stage, dirs[0].name)
    : stage;
}

function findCldfDir(root, depth = 0) {
  if (depth > 3) return null;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'cldf') return path.join(root, e.name);
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'raw' || e.name === '.git') continue;
    const found = findCldfDir(path.join(root, e.name), depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Directories claimed by a purpose-built fetcher, discovered rather than listed.
 *
 * A source NAME does not identify a deposit. `glottolog` names two: the database
 * repository (which ships references/*.bib) and "Glottolog custom downloads"
 * (which ships languoid.csv — the classification table the entire language spine
 * is built from). Both are honestly called glottolog, and the bulk run took the
 * first, overwrote the second's SNAPSHOT, and — because the replacement no
 * longer listed languages_and_dialects_geo.csv — let the prune delete it.
 *
 * Hardcoding an exclusion list would rot the moment a fetcher is added, so ask
 * the fetchers themselves.
 */
let _owned = null;
async function isOwnedByDedicatedFetcher(sourceKey) {
  if (!_owned) {
    _owned = new Set();
    for (const file of fs.readdirSync(__dirname)) {
      if (!file.endsWith('.mjs') || file === path.basename(fileURLToPath(import.meta.url))) continue;
      try {
        const mod = await import(new URL(file, import.meta.url).href);
        if (mod.dir) _owned.add(mod.dir);
      } catch { /* a broken fetcher is not this function's problem */ }
    }
  }
  return _owned.has(sourceKey);
}

/**
 * Fetch and pin ONE CLDF dataset.
 *
 * @returns {{source: string, verified: boolean, doi: string, files: number,
 *            unmatched: Array<{path: string, why: string}>}}
 */
export async function pinOne(sourceKey, { keepArchive = false } = {}) {
  const rec = registry()[sourceKey];
  if (!rec) {
    throw new Error(
      `"${sourceKey}" is not in the Zenodo harvest, so it has no DOI to pin to. `
      + 'Either it is not a CLDF/Zenodo dataset (it needs its own fetcher) or the '
      + 'harvest missed it — do not invent a DOI for it.',
    );
  }
  const zipFile = (rec.files ?? []).find((f) => /\.zip$/i.test(f.key));
  if (!zipFile) {
    throw new Error(`Zenodo record ${rec.doi} publishes no zip — cannot extract a CLDF payload.`);
  }
  const upstream = parseZenodoChecksum(zipFile.checksum);
  if (!upstream || upstream.algo !== 'md5') {
    throw new Error(
      `Zenodo record ${rec.doi} gives no md5 for ${zipFile.key}. Without a publisher `
      + 'checksum there is nothing to verify the download against.',
    );
  }

  // ── Do not take over a directory another fetcher owns ────────────────────
  //
  // `glottolog` names TWO different Zenodo deposits: the database repository
  // (which ships references/*.bib) and "Glottolog custom downloads" (which
  // ships languoid.csv, the classification table the language spine is built
  // from). Both are legitimately "glottolog". The bulk run took the first and
  // silently overwrote the SNAPSHOT the dedicated fetcher had written for the
  // second — and because the replacement snapshot no longer listed
  // languages_and_dialects_geo.csv, the prune then removed it.
  //
  // A source name is not a directory claim. Where a dedicated fetcher has
  // already pinned a directory, it owns it.
  if (await isOwnedByDedicatedFetcher(sourceKey)) {
    throw new Error(
      `cli/data/${sourceKey}/ belongs to a dedicated fetcher. This deposit `
      + `(${rec.doi}) is a different release published under the same name; taking `
      + 'the directory would destroy that pin. Give it its own source key if both '
      + 'are wanted.',
    );
  }
  const existing = readSnapshot(sourceKey);
  if (existing && existing.fetchedBy && !/cldf-zenodo\.mjs$/.test(existing.fetchedBy)
      && existing.pin?.doi !== rec.doi) {
    throw new Error(
      `cli/data/${sourceKey}/ is already pinned by ${existing.fetchedBy} to `
      + `${existing.pin?.doi ?? existing.pin?.value}. Same reason as above.`,
    );
  }

  const recordId = String(rec.recordUrl ?? '').split('/').pop();
  const url = `https://zenodo.org/api/records/${recordId}/files/${zipFile.key}/content`;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `champ-cldf-${sourceKey}-`));
  const archive = path.join(tmp, path.basename(zipFile.key));
  try {
    process.stdout.write(
      `    ${sourceKey}: ${(zipFile.size / 1e6).toFixed(1)} MB from ${rec.doi} …\n`,
    );
    await download(url, archive, { timeoutMs: 900_000 });

    const actual = md5File(archive);
    if (actual !== upstream.hex) {
      // Never extract from an archive that is not the deposit. A corrupted or
      // substituted download extracted anyway is how bad data acquires a DOI.
      return {
        source: sourceKey, verified: false, doi: rec.doi, files: 0,
        unmatched: [{
          path: zipFile.key,
          why: `md5 ${actual.slice(0, 12)}… does not match Zenodo's ${upstream.hex.slice(0, 12)}…`,
        }],
      };
    }

    const target = path.join(DATA_ROOT, sourceKey);
    fs.mkdirSync(target, { recursive: true });
    const stage = path.join(tmp, 'x');
    // Extract the CLDF payload ONLY, when the deposit has one.
    //
    // Two reasons, both learned the hard way. `raw/` holds the upstream's own
    // working copies, which duplicate basenames and collide on flatten. And it
    // holds filenames we cannot even create: jipa ships raw/"Béarnais
    // (Gascon).txt" with a byte sequence macOS rejects, which failed the whole
    // extraction over a file we never wanted.
    //
    // unzip exits 11 when a pattern matches nothing — that is "no cldf/ here",
    // not an error, so fall back to the whole archive. Any other failure is
    // real and must not be swallowed.
    const unzip = (args) => {
      try {
        execFileSync('unzip', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        return 0;
      } catch (err) {
        return err.status ?? 1;
      }
    };
    let status = unzip(['-o', '-q', archive, '*/cldf/*', 'cldf/*', '-d', stage]);
    if (status === 11 || !fs.existsSync(stage)) {
      status = unzip(['-o', '-q', archive, '-d', stage]);
    }
    if (status !== 0 && !fs.existsSync(stage)) {
      throw new Error(`unzip failed (exit ${status}) and produced nothing`);
    }

    // ── What to extract ──────────────────────────────────────────────────
    //
    // A CLDF deposit is a whole repository: the dataset lives in `cldf/`, but
    // alongside it sit `etc/`, `raw/`, and the repo root, and several of those
    // ALSO contain a `languages.csv`. Flattening the whole tree therefore made
    // the last copy win on disk while recording a hash for each — 85 sources
    // came out "drifted" the instant they were written, because the snapshot
    // described a file that had already been overwritten by a namesake.
    //
    // So: take `cldf/` when it exists. That is the canonical payload, it is
    // what every existing extractor reads, and it is collision-free by
    // construction. Fall back to the whole tree only when there is no `cldf/`,
    // and in that case REFUSE a collision rather than silently resolve it —
    // picking a winner between two files of the same name is exactly the kind
    // of quiet judgement that produces data nobody can account for.
    const cldfDir = findCldfDir(stage);
    const root = cldfDir ?? deposiRoot(stage);

    // Inside `cldf/` the payload is flat and every extractor already expects it
    // flat, so flatten. Without a `cldf/` the deposit is an ordinary repository
    // whose layout carries meaning — clts ships fifteen different
    // `graphemes.tsv`, one per source system, and ewave ships two READMEs.
    // Flattening those would destroy the distinction; so keep the relative path
    // in that case. Either way a basename can only be claimed once, and a
    // collision is refused rather than silently resolved.
    const flatten = Boolean(cldfDir);
    const files = [];
    const claimed = new Map();
    const collisions = [];
    const walk = (abs) => {
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const p = path.join(abs, e.name);
        if (e.isDirectory()) {
          if (e.name === 'raw' || e.name === '.git') continue;   // upstream working copies
          walk(p);
          continue;
        }
        if (!KEEP.test(e.name)) continue;
        const rel = flatten ? e.name : path.relative(root, p);
        if (claimed.has(rel)) {
          collisions.push(`${rel} appears in both ${path.relative(stage, claimed.get(rel))} and ${path.relative(stage, p)}`);
          continue;
        }
        claimed.set(rel, p);
        const to = path.join(target, rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(p, to);
        files.push({
          path: rel,
          bytes: fs.statSync(to).size,
          sha256: sha256File(to),
          url,
          upstreamChecksum: null,
          upstreamVerified: false,
          derivedFrom: `${zipFile.key}:${path.relative(stage, p)}`,
        });
      }
    };
    walk(root);

    if (collisions.length) {
      return {
        source: sourceKey, verified: false, doi: rec.doi, files: 0,
        unmatched: collisions.slice(0, 5).map((why) => ({ path: sourceKey, why })),
      };
    }

    if (!files.length) {
      throw new Error(`${rec.doi} extracted no CSV/JSON payload — deposit layout is unexpected.`);
    }
    if (keepArchive) fs.copyFileSync(archive, path.join(target, path.basename(zipFile.key)));

    writeSnapshot(sourceKey, {
      source: sourceKey,
      upstream: rec.recordUrl,
      license: rec.license?.spdx ?? null,
      licenseUrl: null,
      citation: rec.title
        + (rec.creators?.length ? ` — ${rec.creators.join('; ')}` : ''),
      pin: {
        kind: 'doi', value: rec.version ?? null, doi: rec.doi,
        date: rec.publicationDate ?? null,
      },
      // The archive is listed ONLY when it is kept on disk. verify() checks
      // every listed file, so recording a file we deleted would make the source
      // permanently DRIFTED — a snapshot must describe what is actually there.
      files: [
        ...(keepArchive ? [{
          path: path.basename(zipFile.key),
          bytes: zipFile.size,
          sha256: sha256File(archive),
          url,
          upstreamChecksum: zipFile.checksum,
          upstreamVerified: true,
        }] : []),
        ...files,
      ],
      verified: true,
      fetchedBy: 'cli/scripts/fetchers/cldf-zenodo.mjs',
      notes:
        `Extracted from ${zipFile.key}, whose md5 matched Zenodo's published `
        + `checksum (${zipFile.checksum}). The per-file sha256 values below are ours, `
        + 'computed on extraction — their provenance is the verified archive named in '
        + '`derivedFrom`, not an independent attestation by the publisher.'
        + (rec.license?.needsReview
          ? ' LICENCE NEEDS REVIEW — Zenodo\'s declared licence did not resolve cleanly.'
          : ''),
    });

    return { source: sourceKey, verified: true, doi: rec.doi, files: files.length, unmatched: [] };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Sources this fetcher CAN pin: harvested, with a zip, and present on disk. */
export function pinnable({ onDiskOnly = true } = {}) {
  return Object.entries(registry())
    .filter(([key, rec]) => (rec.files ?? []).some((f) => /\.zip$/i.test(f.key)))
    .filter(([key]) => !onDiskOnly || fs.existsSync(path.join(DATA_ROOT, key)))
    .map(([key, rec]) => ({
      key,
      doi: rec.doi,
      version: rec.version,
      bytes: (rec.files ?? []).filter((f) => /\.zip$/i.test(f.key))
        .reduce((n, f) => n + f.size, 0),
    }));
}

export async function fetchSource({ verifyOnly = false, sources = null, all = false } = {}) {
  const available = pinnable();
  if (verifyOnly) {
    const problems = [];
    let checked = 0;
    for (const s of available) {
      const v = verify(s.key);
      checked += v.checked;
      if (!v.ok) problems.push(...v.problems.map((p) => ({ ...p, path: `${s.key}/${p.path}` })));
    }
    return { ok: problems.length === 0, checked, problems };
  }

  const want = all ? available.map((s) => s.key)
    : (sources ?? []).filter(Boolean);
  if (!want.length) {
    throw new Error(
      'cldf-zenodo pins many datasets, so it needs to be told which: '
      + '--source <a,b,c> or --all. It will not fetch 2.3 GB by default.',
    );
  }

  const results = [];
  for (const key of want) {
    try {
      results.push(await pinOne(key));
    } catch (err) {
      results.push({ source: key, verified: false, files: 0,
        unmatched: [{ path: key, why: err.message }] });
    }
  }
  const bad = results.filter((r) => !r.verified);
  return {
    verified: bad.length === 0,
    files: results.filter((r) => r.verified).length,
    unmatched: bad.flatMap((r) => r.unmatched),
    results,
  };
}

// ── direct invocation ───────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? (argv[i + 1] ?? '') : null;
  };
  if (argv.includes('--list')) {
    const list = pinnable();
    const gb = list.reduce((n, s) => n + s.bytes, 0) / 1e9;
    console.log(`\n  ${list.length} CLDF dataset(s) on disk can be pinned to a Zenodo DOI`);
    console.log(`  (${gb.toFixed(2)} GB to fetch in full)\n`);
    for (const s of list.slice(0, 40)) {
      console.log(`    ${s.key.padEnd(30)} ${String(s.version ?? '').padEnd(10)} ${s.doi}`);
    }
    if (list.length > 40) console.log(`    … and ${list.length - 40} more`);
    console.log('');
  } else {
    const r = await fetchSource({
      all: argv.includes('--all'),
      sources: (flag('source') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    for (const x of r.results) {
      console.log(x.verified
        ? `  ✓ ${x.source.padEnd(28)} ${x.doi}  (${x.files} file(s))`
        : `  ✗ ${x.source.padEnd(28)} ${x.unmatched.map((u) => u.why).join('; ')}`);
    }
    process.exitCode = r.verified ? 0 : 1;
  }
}
