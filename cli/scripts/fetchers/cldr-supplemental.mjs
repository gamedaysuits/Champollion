#!/usr/bin/env node

/**
 * fetchers/cldr-supplemental.mjs — CLDR's alias and likely-subtag tables.
 *
 * WHY A SECOND CLDR SOURCE
 *   `fetchers/cldr.mjs` pins cldr-misc-full, which is per-locale DISPLAY data —
 *   text direction and the like. The tables this rebuild needs are structural
 *   and live in a different package, cldr-core:
 *
 *     supplemental/aliases.json       languageAlias, with a `_reason` on every
 *                                     entry. 64 of them read reason="macrolanguage"
 *                                     and are the canonical statement that `cmn`
 *                                     canonicalises to `zh`, `arb` to `ar`,
 *                                     `swh` to `sw`, `cwd` to `cr`.
 *     supplemental/likelySubtags.json the maximal form of an underspecified tag
 *                                     (`zh` → `zh-Hans-CN`), which is how a
 *                                     bare language tag acquires a script
 *                                     without anyone guessing one.
 *
 *   Read INVERTED, the macrolanguage aliases answer the question every MT
 *   lookup in this codebase runs into: a service published `zho` — which
 *   individual language, if any, does the standard consider that to denote?
 *   That answer is now cited to Unicode instead of decided by us.
 *
 * WHY IT ADOPTS RATHER THAN DOWNLOADS
 *   Same reasoning as cldr.mjs, and the same discipline: cldr-core is already a
 *   dependency, so `cli/package-lock.json` pins it by version AND by an npm
 *   integrity hash that npm verifies on install. The release is therefore
 *   attested upstream. This fetcher READS that version rather than restating
 *   it — restating a version that already exists in a lockfile is how a second
 *   source of truth starts.
 *
 * WHAT IT IS AUTHORITATIVE FOR, AND WHAT IT IS NOT
 *   CLDR is a localisation standard. It is authoritative for what the BCP 47
 *   world means by a tag, and it is SILENT about most of the world's languages
 *   — the alias table covers 500 languages against a spine of 8,837. Silence is
 *   ingested as silence. In particular, a macrolanguage CLDR does not alias has
 *   NO predominant member, and the resolver reports that as ambiguous rather
 *   than picking one. Norwegian is the live example: CLDR issues no
 *   macrolanguage alias for `no`, which is why `no` → `nob` remains an
 *   editorial decision and is not laundered into a cited one.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs cldr-supplemental
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'cldr-supplemental';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "cldrSupplemental",
  "license": "Unicode-3.0",
  "contributes": "predominant member of a macrolanguage (inverted from languageAlias reason=macrolanguage), and the maximal tag form from likelySubtags",
  "note": "cldr-core, a DIFFERENT package from the cldr-misc-full pinned by the `cldr` source. Unicode decides which member of a macrolanguage its locale identifiers denote — that is Unicode's editorial call, not a restatement of SIL's, which is why it counts as independent corroboration of langtags rather than an echo. Its silence is silence: CLDR aliases 500 languages against a spine of 8,686, and a macrolanguage it does not alias has NO predominant member. Norwegian is the live case — CLDR issues no macrolanguage alias for `no`, so nor -> nob stays an editorial decision instead of being dressed up as a cited one."
};
export const dir = 'cldr-supplemental';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..', '..');
const LOCKFILE = path.join(CLI_ROOT, 'package-lock.json');
const PKG = 'node_modules/cldr-core';

/** The two files, and nothing else — a fetcher that hoovers up a package is not a pin. */
// scriptMetadata carries CLDR's own per-SCRIPT properties, including `rtl` —
// the cited answer to "which way does Arab run" for the ~7,700 languages whose
// own locale has no orientation file. Direction via script is a derivation the
// readers make explicitly; this pins the source they derive from.
const WANTED = ['aliases.json', 'likelySubtags.json', 'scriptMetadata.json'];

/** Read the pinned version + integrity from npm's lockfile — do not restate it. */
function fromLockfile() {
  if (!fs.existsSync(LOCKFILE)) return null;
  const lock = JSON.parse(fs.readFileSync(LOCKFILE, 'utf-8'));
  const entry = lock.packages?.[PKG] ?? lock.dependencies?.['cldr-core'];
  if (!entry) return null;
  return { version: entry.version ?? null, integrity: entry.integrity ?? null };
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const lock = fromLockfile();
  if (!lock?.version) {
    throw new Error(
      'cldr-core is not in cli/package-lock.json, so there is no pinned version to '
      + 'attribute these tables to. Restating a version by hand would create a '
      + 'second source of truth for it.',
    );
  }

  const src = path.join(CLI_ROOT, PKG, 'supplemental');
  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });

  const files = [];
  let macrolanguageAliases = 0;
  let likely = 0;

  for (const name of WANTED) {
    // scriptMetadata.json lives at the PACKAGE ROOT, not under supplemental/ —
    // CLDR's own layout, not a fallback guess, so both locations are stated.
    let from = path.join(src, name);
    if (!fs.existsSync(from)) from = path.join(CLI_ROOT, PKG, name);
    if (!fs.existsSync(from)) {
      throw new Error(
        `cldr-core@${lock.version} has no supplemental/${name} and no root ${name}. The `
        + 'package layout changed; this fetcher must be updated rather than silently '
        + 'pinning less.',
      );
    }
    const to = path.join(target, name);
    fs.copyFileSync(from, to);
    files.push({
      path: name,
      bytes: fs.statSync(to).size,
      sha256: sha256File(to),
      url: 'https://github.com/unicode-org/cldr-json',
      upstreamChecksum: null,
      upstreamVerified: false,
      derivedFrom: `cldr-core@${lock.version} (supplemental/${name})`,
    });
  }

  // Assert the relations exist before claiming a verified snapshot. An aliases
  // table with no macrolanguage reasons is not "CLDR saying nothing" — it is a
  // schema change, and ingesting it as silence would quietly delete every
  // cited macrolanguage resolution in the atlas.
  {
    const aliases = JSON.parse(fs.readFileSync(path.join(target, 'aliases.json'), 'utf-8'));
    const la = aliases?.supplemental?.metadata?.alias?.languageAlias ?? {};
    macrolanguageAliases = Object.values(la)
      .filter((v) => v?._reason === 'macrolanguage').length;
    const ls = JSON.parse(fs.readFileSync(path.join(target, 'likelySubtags.json'), 'utf-8'));
    likely = Object.keys(ls?.supplemental?.likelySubtags ?? {}).length;
    if (!macrolanguageAliases || !likely) {
      throw new Error(
        `cldr-core@${lock.version}: parsed ${macrolanguageAliases} macrolanguage `
        + `aliases and ${likely} likely subtags. Both are what this source is `
        + 'fetched for; zero of either is a parse fault, not an upstream statement.',
      );
    }
  }

  writeSnapshot(dir, {
    source,
    upstream: `https://www.npmjs.com/package/cldr-core/v/${lock.version}`,
    license: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    citation: `Unicode Common Locale Data Repository, cldr-core ${lock.version} `
      + '(supplemental/aliases.json, supplemental/likelySubtags.json).',
    pin: { kind: 'version', value: lock.version, doi: null, date: null },
    files,
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/cldr-supplemental.mjs',
    notes:
      `Version read from cli/package-lock.json, which pins cldr-core with npm `
      + `integrity ${lock.integrity ?? '(none recorded)'} — npm verifies that on `
      + 'install, so the release is attested upstream even though the copied files '
      + `are hashed by us. ${macrolanguageAliases} languageAlias entries carry `
      + `_reason="macrolanguage" and likelySubtags has ${likely} entries. CLDR is a `
      + 'localisation standard, not a language survey: its alias table covers 500 '
      + 'languages against a spine of 8,837, and its silence is ingested AS silence '
      + '— a macrolanguage CLDR does not alias has no predominant member and '
      + 'resolves as ambiguous rather than to a guess.',
  });

  return { verified: true, files: files.length, version: lock.version, macrolanguageAliases };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
