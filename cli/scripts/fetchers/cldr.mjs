/**
 * fetcher: unicode-cldr — text direction, from the CLDR locale snapshot.
 *
 * WHAT IT PINS
 *   The 322 per-locale layout files already on disk, against the cldr-json
 *   release that `cli/package-lock.json` pins by version AND sha512 integrity.
 *
 * WHY THIS ONE ADOPTS RATHER THAN DOWNLOADS
 *   Unusually, the provenance here was already sound: a build script exists
 *   (`scripts/build-cldr-snapshot.mjs`), the release is named (cldr-misc-full
 *   48.2.0), and npm's lockfile pins it with an integrity hash that npm itself
 *   verifies on install. What was missing is only that no FACT could name any
 *   of it — the chain stopped at a README.
 *
 *   So this reads the version out of the lockfile rather than restating it, and
 *   records the files' hashes. Restating a version that already exists in a
 *   lockfile is how two sources of truth start.
 *
 * WHAT IT COVERS, AND WHAT IT DOES NOT
 *   CLDR is a localisation standard, not a language survey: 322 locales against
 *   the spine's 8,837 languages. It is authoritative for the ones it has and
 *   silent about the rest, and the extractor records that silence as
 *   `not_surveyed` rather than assuming left-to-right.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs unicode-cldr
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'unicode-cldr';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "id": "cldr",
  "module": "(native)",
  "handler": "cldr",
  "license": "Unicode-3.0",
  "contributes": "text direction",
  "note": "One JSON file per locale; we take layout.orientation.characterOrder only. CLDR covers 324 locales against the atlas's 8,686 languages, so a missing file means NO VALUE -- not left-to-right. Defaulting would assert a writing direction for eight thousand languages on the strength of Unicode never having been asked, which is the shape of the orthographicStatus:'unwritten' mistake."
};
export const dir = 'cldr';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCKFILE = path.join(__dirname, '..', '..', 'package-lock.json');
const PKG = 'node_modules/cldr-misc-full';

/** Read the pinned version + integrity from npm's lockfile — do not restate it. */
function fromLockfile() {
  if (!fs.existsSync(LOCKFILE)) return null;
  const lock = JSON.parse(fs.readFileSync(LOCKFILE, 'utf-8'));
  const entry = lock.packages?.[PKG] ?? lock.dependencies?.['cldr-misc-full'];
  if (!entry) return null;
  return { version: entry.version ?? null, integrity: entry.integrity ?? null };
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const lock = fromLockfile();
  if (!lock?.version) {
    throw new Error(
      'cldr-misc-full is not in cli/package-lock.json, so there is no pinned '
      + 'version to attribute these files to. Restating a version by hand would '
      + 'create a second source of truth for it.',
    );
  }

  const target = path.join(DATA_ROOT, dir);
  const files = [];
  for (const name of fs.readdirSync(target).sort()) {
    if (!name.endsWith('.json')) continue;
    const p = path.join(target, name);
    files.push({
      path: name,
      bytes: fs.statSync(p).size,
      sha256: sha256File(p),
      url: 'https://github.com/unicode-org/cldr-json',
      upstreamChecksum: null,
      upstreamVerified: false,
      derivedFrom: `cldr-misc-full@${lock.version} (extracted by scripts/build-cldr-snapshot.mjs)`,
    });
  }
  if (!files.length) throw new Error(`no locale files in cli/data/${dir}/`);

  writeSnapshot(dir, {
    source,
    upstream: `https://www.npmjs.com/package/cldr-misc-full/v/${lock.version}`,
    license: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    citation: `Unicode Common Locale Data Repository, cldr-misc-full ${lock.version}.`,
    pin: { kind: 'version', value: lock.version, doi: null, date: null },
    files,
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/cldr.mjs',
    notes:
      `Version read from cli/package-lock.json, which pins it with npm integrity `
      + `${lock.integrity ?? '(none recorded)'} — npm verifies that on install, so `
      + 'the release itself is attested upstream even though the extracted files '
      + 'are hashed by us. CLDR is a localisation standard, not a language survey: '
      + `${files.length} locales against a spine of 8,837 languages. It is `
      + 'authoritative for what it has and SILENT about the rest, which the '
      + 'extractor records as not_surveyed rather than assuming left-to-right.',
  });

  return { verified: true, files: files.length, version: lock.version };
}
