/**
 * fetch-lib — the shared machinery behind "no fetcher, no source".
 *
 * WHY THIS EXISTS
 *   `cli/data/` is 7.3 GB, gitignored, and 0 files of it are tracked. Nobody
 *   can say where most of it came from, which release it is, or whether the
 *   bytes on disk are still the bytes upstream published. "Regenerate the cards
 *   from source" is therefore unverifiable by construction — there is no
 *   definition of "source" to regenerate FROM.
 *
 *   A fetcher fixes that for one source. It records, in the source's own
 *   directory:
 *
 *     - the exact upstream URL(s) it read
 *     - a PIN — a DOI, a git commit, or a publisher's release id — that names
 *       one immutable release rather than "whatever the site serves today"
 *     - a sha256 per file, so drift is detectable without re-downloading
 *     - the retrieval date, and the licence the upstream itself declares
 *
 *   That record is SNAPSHOT.json, and it is what `insertSourceRelease()`
 *   consumes. A source with no SNAPSHOT.json produces facts with no release,
 *   and a fact with no release is the gate's definition of "not yet
 *   regenerable from source".
 *
 * THE HONESTY RULE THAT SHAPES THIS FILE
 *   A SNAPSHOT must never be written from an assumption. Two consequences:
 *
 *   1. `adopt()` exists, because most of cli/data was downloaded before any of
 *      this existed and re-downloading 7.3 GB to prove it is wasteful. But it
 *      only writes a pin when the bytes on disk MATCH a checksum the upstream
 *      publishes. Matching upstream's own md5 is proof; a plausible filename is
 *      not. If it cannot match, it says UNVERIFIED and writes no pin.
 *
 *   2. `verify()` recomputes from disk. It never trusts the recorded sha256 to
 *      describe the file sitting next to it.
 *
 * SNAPSHOT.json shape (consumed by ingest-base.mjs and the extractors):
 *   {
 *     source, upstream, license, licenseUrl, citation,
 *     pin:   { kind: 'doi'|'commit'|'release'|'version', value, doi, date },
 *     files: [ { path, bytes, sha256, url, upstreamChecksum } ],
 *     fetchedBy, fetchedAt, verified, notes
 *   }
 *
 * @module fetchers/lib/fetch-lib
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = path.join(__dirname, '..', '..', '..', 'data');

export const SNAPSHOT_NAME = 'SNAPSHOT.json';

/** sha256 of a file, streamed — cli/data holds files north of 600 MB. */
export function sha256File(filePath) {
  const hash = createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let read;
    // eslint-disable-next-line no-cond-assign
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/** md5 of a file — Zenodo publishes md5, so this is what we compare against. */
export function md5File(filePath) {
  const hash = createHash('md5');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let read;
    // eslint-disable-next-line no-cond-assign
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/**
 * GET with a timeout and a real user agent. Zenodo and cdstar both rate-limit
 * anonymous clients that do not identify themselves.
 */
export async function getJSON(url, { timeoutMs = 60_000 } = {}) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

export const USER_AGENT =
  'champollion-fetcher/1.0 (+https://champollion.dev; open MT infrastructure)';

/**
 * Download to `destPath`, atomically. Writes to a sibling .part first so an
 * interrupted fetch can never leave a truncated file looking like real data —
 * which is precisely how a "source" becomes silently wrong.
 */
export async function download(url, destPath, { timeoutMs = 300_000 } = {}) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const part = `${destPath}.part`;
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(part, buf);
  fs.renameSync(part, destPath);
  return { bytes: buf.length, sha256: sha256File(destPath), md5: md5File(destPath) };
}

// ── Zenodo ──────────────────────────────────────────────────────────────────

/**
 * Resolve a Zenodo concept id to a specific version's record.
 *
 * Zenodo's /versions/latest endpoint is not available on the legacy API this
 * deposit set uses, and the search endpoint CAPS `size` AT 25 regardless of
 * what you ask for — a documented trap in this repo (see the A2 harvester).
 * So this pages explicitly rather than assuming one request sees everything.
 *
 * @param {string|number} conceptId  Zenodo concept recid (the "all versions" id)
 * @param {string} [wantVersion]     e.g. 'v5.3'. Omit for the newest by date.
 */
export async function zenodoVersion(conceptId, wantVersion) {
  const seen = [];
  for (let page = 1; page <= 8; page++) {
    const url = `https://zenodo.org/api/records?q=conceptrecid:${conceptId}`
      + `&all_versions=true&size=25&page=${page}`;
    let hits;
    try {
      ({ hits: { hits } = {} } = await getJSON(url));
    } catch {
      break;
    }
    if (!hits || hits.length === 0) break;
    seen.push(...hits);
    if (hits.length < 25) break;
  }
  if (!seen.length) {
    throw new Error(`Zenodo concept ${conceptId} returned no versions — cannot pin.`);
  }
  if (wantVersion) {
    const hit = seen.find((h) => h.metadata?.version === wantVersion);
    if (!hit) {
      const have = seen.map((h) => h.metadata?.version).filter(Boolean).join(', ');
      throw new Error(
        `Zenodo concept ${conceptId} has no version "${wantVersion}". Available: ${have}`,
      );
    }
    return hit;
  }
  return seen.sort((a, b) =>
    String(b.metadata?.publication_date ?? '').localeCompare(
      String(a.metadata?.publication_date ?? ''),
    ))[0];
}

/** Zenodo publishes checksums as "md5:<hex>". Split it rather than assume md5. */
export function parseZenodoChecksum(checksum) {
  const m = /^([a-z0-9]+):([0-9a-f]+)$/i.exec(String(checksum ?? ''));
  return m ? { algo: m[1].toLowerCase(), hex: m[2].toLowerCase() } : null;
}

// ── SNAPSHOT.json ───────────────────────────────────────────────────────────

export function snapshotPath(dir) {
  // `dir` is a source NAME, not a path. Passing an absolute path used to be
  // accepted silently: path.join concatenated it onto DATA_ROOT, mkdir created
  // the nonsense tree, the snapshot was written where nothing looks for it, and
  // the extractor then reported a clean run over an empty source. Failing here
  // costs one line and saves that whole sequence.
  if (path.isAbsolute(dir) || dir.includes(path.sep)) {
    throw new Error(
      `snapshotPath() takes a source NAME, not a path — got ${JSON.stringify(dir)}. `
      + 'It joins the name onto DATA_ROOT itself.',
    );
  }
  return path.join(DATA_ROOT, dir, SNAPSHOT_NAME);
}

export function readSnapshot(dir) {
  const p = snapshotPath(dir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/**
 * Write SNAPSHOT.json.
 *
 * Refuses a snapshot that claims to be verified but carries no pin, because
 * that is exactly the shape of a fabricated provenance record: confident,
 * checkable-looking, and grounded in nothing.
 */
// `query` is the honest kind for a live endpoint with no releases (Wikidata
// SPARQL): the pin is the query and the date it was asked. Found by the schema
// validation itself — two pins in the wild already said it.
const PIN_KINDS = new Set(['doi', 'commit', 'release', 'version', 'query']);

export function writeSnapshot(dir, snap) {
  if (!snap.source) throw new Error('SNAPSHOT needs a source name');
  if (!Array.isArray(snap.files) || snap.files.length === 0) {
    throw new Error(`SNAPSHOT for ${snap.source} lists no files — it describes nothing`);
  }
  if (snap.verified && !snap.pin?.value) {
    throw new Error(
      `SNAPSHOT for ${snap.source} is marked verified but has no pin. `
      + 'Verified against WHAT? A snapshot with no pin names no particular release.',
    );
  }
  for (const f of snap.files) {
    if (!f.sha256) throw new Error(`SNAPSHOT for ${snap.source}: ${f.path} has no sha256`);
    if (!/^[0-9a-f]{64}$/.test(f.sha256)) {
      throw new Error(`SNAPSHOT for ${snap.source}: ${f.path} sha256 is not a sha256`);
    }
  }
  // The rest of the schema, enforced at the only door snapshots come through.
  // Every SNAPSHOT.json has pointed at source-snapshot.schema.json since the
  // format existed; the schema was only WRITTEN on 2026-08-09, which meant the
  // four checks above were the whole contract and pin.kind, licence and
  // upstream were convention — a fetcher could omit its licence and every
  // value it wrote would inherit the omission silently.
  if (!snap.upstream) {
    throw new Error(`SNAPSHOT for ${snap.source} names no upstream. A snapshot that `
      + 'cannot say where the bytes came from is not a pin, it is a note that somebody '
      + 'once downloaded something.');
  }
  if (!snap.license) {
    throw new Error(`SNAPSHOT for ${snap.source} declares no licence. Every value `
      + 'ingested from a source inherits its licence, so this omission would become an '
      + 'unlicensed claim on a card.');
  }
  if (snap.pin && !PIN_KINDS.has(snap.pin.kind)) {
    throw new Error(`SNAPSHOT for ${snap.source}: pin.kind "${snap.pin.kind}" is not one `
      + `of ${[...PIN_KINDS].join('/')}. The kind says what the pin value MEANS; a pin `
      + 'whose kind nobody declared cannot be compared with anything.');
  }
  if (!snap.fetchedBy || !/mjs$/.test(snap.fetchedBy)) {
    throw new Error(`SNAPSHOT for ${snap.source} does not name the fetcher module that `
      + 'wrote it — the thing that can do it again. A pin nothing can reproduce fails '
      + 'the law that a value enters the atlas only if it can be re-fetched right now.');
  }
  const out = {
    $schema: '../../shared/schemas/source-snapshot.schema.json',
    ...snap,
    fetchedAt: snap.fetchedAt ?? new Date().toISOString(),
  };
  const p = snapshotPath(dir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(out, null, 2)}\n`);
  return p;
}

/**
 * Recompute every recorded file's sha256 from disk and compare.
 *
 * Deliberately does NOT read the recorded hash as authority about the file next
 * to it — that would only ever confirm that JSON matches itself.
 *
 * @returns {{ok: boolean, checked: number, problems: Array<{path: string, why: string}>}}
 */
export function verify(dir) {
  const snap = readSnapshot(dir);
  if (!snap) return { ok: false, checked: 0, problems: [{ path: dir, why: 'no SNAPSHOT.json' }] };
  const problems = [];
  let checked = 0;
  for (const f of snap.files) {
    const abs = path.join(DATA_ROOT, dir, f.path);
    if (!fs.existsSync(abs)) {
      problems.push({ path: f.path, why: 'recorded in SNAPSHOT but missing on disk' });
      continue;
    }
    checked++;
    const actual = sha256File(abs);
    if (actual !== f.sha256) {
      problems.push({
        path: f.path,
        why: `sha256 drift — recorded ${f.sha256.slice(0, 12)}…, on disk ${actual.slice(0, 12)}…`,
      });
    }
  }
  return { ok: problems.length === 0, checked, problems };
}

/**
 * ADOPT — pin bytes that are ALREADY on disk, but only against upstream proof.
 *
 * Most of cli/data predates any of this. Re-downloading 7.3 GB to prove
 * provenance we can establish another way is waste. But "the filename looks
 * right" is not provenance, and writing a pin on that basis would manufacture
 * exactly the kind of confident-looking falsehood this whole pass exists to
 * remove.
 *
 * So: adopt() takes the checksums the UPSTREAM publishes and compares them to
 * the bytes on disk. A match is proof — the local file is bit-identical to the
 * named release. A mismatch, or no upstream checksum to compare against, yields
 * `verified: false` and NO pin, and says which it was.
 *
 * @param {object}   opts
 * @param {string}   opts.dir            directory under cli/data
 * @param {Array}    opts.candidates     [{ path, upstreamChecksum, url }]
 *                                       upstreamChecksum as "md5:<hex>" or "sha256:<hex>"
 * @returns {{files: Array, verified: boolean, unmatched: Array}}
 */
export function adopt({ dir, candidates }) {
  const files = [];
  const unmatched = [];
  for (const c of candidates) {
    const abs = path.join(DATA_ROOT, dir, c.path);
    if (!fs.existsSync(abs)) {
      unmatched.push({ path: c.path, why: 'not on disk' });
      continue;
    }
    const parsed = parseZenodoChecksum(c.upstreamChecksum);
    const sha256 = sha256File(abs);
    const bytes = fs.statSync(abs).size;

    if (!parsed) {
      unmatched.push({ path: c.path, why: 'upstream publishes no checksum to compare against' });
      files.push({ path: c.path, bytes, sha256, url: c.url ?? null, upstreamChecksum: null,
        upstreamVerified: false });
      continue;
    }
    const actual = parsed.algo === 'md5' ? md5File(abs)
      : parsed.algo === 'sha256' ? sha256
        : null;
    if (actual === null) {
      unmatched.push({ path: c.path, why: `unsupported upstream checksum algo "${parsed.algo}"` });
      files.push({ path: c.path, bytes, sha256, url: c.url ?? null,
        upstreamChecksum: c.upstreamChecksum, upstreamVerified: false });
      continue;
    }
    const match = actual === parsed.hex;
    if (!match) unmatched.push({ path: c.path, why: `${parsed.algo} differs from upstream` });
    files.push({
      path: c.path, bytes, sha256, url: c.url ?? null,
      upstreamChecksum: c.upstreamChecksum, upstreamVerified: match,
    });
  }
  return {
    files,
    verified: files.length > 0 && files.every((f) => f.upstreamVerified),
    unmatched,
  };
}
