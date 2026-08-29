#!/usr/bin/env node

/**
 * fetchers/cldr-plurals.mjs — CLDR cardinal plural categories.
 *
 * WHY THIS IS A SOURCE AND NOT CONFIGURATION
 *   The previous corpus carried `rules.plurals.categories` on 182 cards, inside
 *   a `rules` block that sat on 7,927. It looked like configuration we had
 *   authored. It is not: the ten distinct category sets it held are CLDR's own
 *   — `["zero","one","two","few","many","other"]` is Arabic's, verbatim, and
 *   `["one","many","other"]` is French's.
 *
 *   So it belongs in the atlas as a fact with a citation, not in a config file
 *   as a preference. Finding that out is what the audit was for.
 *
 * WHY A SEPARATE SOURCE FROM `cldr`
 *   The existing cldr source is the npm package `cldr-misc-full`, which carries
 *   layout and orientation data. Plural rules live in `cldr-core`, a different
 *   package. One SNAPSHOT names one upstream, so these are two sources that
 *   happen to share a publisher and a version.
 *
 * THE PIN IS npm's, NOT OURS
 *   Both packages are pinned by `cli/package-lock.json` with an integrity hash
 *   npm itself verifies on install. Restating the version here would be a
 *   second place for it to drift, so the fetcher READS the lockfile — the same
 *   discipline the cldr fetcher already uses.
 *
 * Usage:
 *   node cli/scripts/fetchers/cldr-plurals.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, sha256File, writeSnapshot, verify } from './lib/fetch-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', '..');
const LOCKFILE = path.join(CLI, 'package-lock.json');
const PKG = 'node_modules/cldr-core';
const SOURCE = 'cldr-plurals';
const RELATIVE = 'supplemental/plurals.json';

/** Read the pinned version + integrity from npm's lockfile — never restate it. */
function pinned() {
  const lock = JSON.parse(fs.readFileSync(LOCKFILE, 'utf-8'));
  const entry = lock.packages?.[PKG];
  if (!entry?.version) {
    throw new Error(
      'cldr-core is not in cli/package-lock.json, so there is no pinned version to '
      + 'name. Run `npm install --save-exact --save-dev cldr-core` in cli/ first — a '
      + 'source with no pin is not a source.',
    );
  }
  return { version: entry.version, integrity: entry.integrity ?? null };
}

export async function fetchCldrPlurals() {
  const { version, integrity } = pinned();
  const src = path.join(CLI, PKG, RELATIVE);
  if (!fs.existsSync(src)) {
    throw new Error(
      `${PKG}/${RELATIVE} is not installed. npm verified its integrity at install time, `
      + 'which is why this reads the installed package rather than downloading again.',
    );
  }

  const dir = path.join(DATA_ROOT, SOURCE);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'plurals.json');
  fs.copyFileSync(src, dest);

  const data = JSON.parse(fs.readFileSync(dest, 'utf-8'));
  const cardinal = data?.supplemental?.['plurals-type-cardinal'];
  if (!cardinal || Object.keys(cardinal).length < 100) {
    throw new Error(
      `plurals.json holds ${Object.keys(cardinal ?? {}).length} locales with cardinal `
      + 'rules. CLDR publishes over two hundred; a short read means the shape changed, '
      + 'and a smaller set must not be mistaken for fewer languages having plurals.',
    );
  }

  writeSnapshot(SOURCE, {
    source: SOURCE,
    upstream: `https://www.npmjs.com/package/cldr-core/v/${version}`,
    license: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    citation: `Unicode Consortium. CLDR ${version}. Supplemental plural rules `
      + '(plurals-type-cardinal).',
    pin: { kind: 'version', value: version, doi: null, date: null },
    files: [{
      path: 'plurals.json',
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: `https://www.npmjs.com/package/cldr-core/v/${version}`,
      // npm's own integrity hash, verified by npm at install time — an upstream
      // attestation rather than something we computed about ourselves.
      upstreamChecksum: integrity,
      upstreamVerified: Boolean(integrity),
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/cldr-plurals.mjs',
    notes:
      'Read from the installed npm package rather than downloaded: cli/package-lock.json '
      + `pins the version AND an integrity hash npm verifies on install, which is a `
      + `stronger attestation than a checksum we compute ourselves. `
      + `${Object.keys(cardinal).length} locales carry cardinal plural rules. This is a `
      + 'SEPARATE source from `cldr` — that one is cldr-misc-full (layout), this is '
      + 'cldr-core (supplemental).',
  });

  return { version, locales: Object.keys(cardinal).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await fetchCldrPlurals();
  console.log(`\n  ✓ CLDR ${r.version} — cardinal plural rules for ${r.locales} locales\n`);
}

/**
 * The standard fetcher interface, so `fetch-source.mjs --all` and `--verify`
 * can reach CLDR plural rules.
 *
 * This module predates the interface and exported only `fetchCldrPlurals()`. The
 * sweep discovers fetchers by looking for `source`, `dir` and `fetchSource` —
 * and a module missing them is skipped WITHOUT a warning, because a file in
 * this directory that is not a fetcher is a perfectly normal thing. So this
 * source silently sat out every `--all` and every `--verify` while the sweep
 * reported success for everything around it. The bespoke name is kept: it has
 * callers, and renaming it would trade one silent breakage for another.
 */
export const source = SOURCE;
export const dir = SOURCE;

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json.
 */
export const manifest = {
  "module": "(native)",
  "handler": "cldrPlurals",
  "license": "Unicode-3.0",
  "contributes": "cardinal plural categories",
  "note": "A SEPARATE source from `cldr`: that is cldr-misc-full (layout), this is cldr-core (supplemental). The previous corpus carried these as rules.plurals.categories, inside a config-shaped block -- but the ten distinct sets it held are CLDR's own, verbatim. We read the KEYS of plurals-type-cardinal; we do not evaluate the rules, so this is CLDR's claim and not a derivation. Regional variants (pt-PT, zh-Hant) are skipped: CLDR keeps them apart on purpose and the atlas has no card for them."
};

export async function fetchSource({ verifyOnly = false, ...rest } = {}) {
  if (verifyOnly) return verify(dir);
  return fetchCldrPlurals(rest);
}
