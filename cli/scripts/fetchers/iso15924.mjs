#!/usr/bin/env node

/**
 * fetchers/iso15924.mjs — the ISO 15924 script code registry, from Unicode.
 *
 * WHY THIS FETCHER EXISTS AT ALL
 *   `cli/data/iso15924-scripts.json` was already on disk: 226 entries, correct
 *   as far as anyone could tell. It had no SNAPSHOT, no URL, no date and no
 *   checksum — nobody could say which release it came from or when.
 *
 *   Under this project's rule, no fetcher means no source. A file that happens
 *   to be right is not the same as a file you can re-derive, and "it looked
 *   fine" is how the previous corpus was built. So the registry is fetched from
 *   the Unicode Consortium, which is the ISO 15924 Registration Authority, and
 *   pinned to the date stamped in the file itself.
 *
 * THE PIN, AND WHY IT IS DERIVED RATHER THAN DECLARED
 *   Unicode publishes `iso15924.txt` at a stable URL with no version in the
 *   path, and — checked, not assumed — the header carries NO release date. Each
 *   ENTRY carries the date that entry last changed.
 *
 *   So the pin is the most recent entry date in the file: the registry as of
 *   its latest change. That is derived from the data rather than declared by
 *   the publisher, and the snapshot says so, because a pin whose provenance is
 *   vague is only marginally better than no pin. The sha256 remains the exact
 *   identity; the date is what makes it legible.
 *
 * Usage:
 *   node cli/scripts/fetchers/iso15924.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, download, sha256File, writeSnapshot, verify } from './lib/fetch-lib.mjs';

const URL = 'https://www.unicode.org/iso15924/iso15924.txt';
const SOURCE = 'iso15924';

export async function fetchIso15924() {
  // writeSnapshot() takes the source NAME and joins it onto DATA_ROOT itself.
  // Passing a full path silently wrote the snapshot to DATA_ROOT + the absolute
  // path — no error, no snapshot where anything looks for it, and the extractor
  // then reported a clean run over zero rows.
  const dest = path.join(DATA_ROOT, SOURCE, 'iso15924.txt');
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  process.stdout.write(`  ${URL}\n`);
  await download(URL, dest);

  const text = fs.readFileSync(dest, 'utf-8');

  // Format: Code;N°;English Name;Nom français;PVA;Unicode Version;Date
  const entries = [];
  let latest = null;
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [code, number, name, , , , date] = line.split(';');
    if (!code || !/^[A-Z][a-z]{3}$/.test(code)) continue;
    entries.push({ code, number, name });
    const d = (date ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!latest || d > latest)) latest = d;
  }
  if (!latest) {
    throw new Error(
      'No entry in iso15924.txt carries a date, so there is nothing to pin it to. '
      + 'Refusing to write a snapshot that names no release — that is precisely the '
      + 'state the loose iso15924-scripts.json was already in.',
    );
  }
  const release = latest;
  if (entries.length < 150) {
    throw new Error(
      `Parsed only ${entries.length} script codes from iso15924.txt. The registry has `
      + 'well over 150; a short read means the format changed and the parser needs a '
      + 'human, not a smaller dataset.',
    );
  }

  writeSnapshot(SOURCE, {
    source: SOURCE,
    upstream: URL,
    // Unicode's own terms for the ISO 15924 registry data.
    license: 'Unicode-3.0',
    licenseUrl: 'https://www.unicode.org/license.txt',
    citation: `Unicode Consortium (ISO 15924 Registration Authority). ${release}. `
      + 'ISO 15924 script codes.',
    pin: { kind: 'release', value: release, doi: null, date: release },
    files: [{
      path: 'iso15924.txt',
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: URL,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/iso15924.mjs',
    notes:
      'Unicode publishes no checksum for this file, so `upstreamVerified` is false by '
      + 'necessity: the sha256 is what we received. The header declares no release '
      + 'date, so the pin is the most recent per-entry date in the file — the registry '
      + `as of its latest change, derived from the data rather than declared. `
      + `${entries.length} script codes parsed.`,
  });

  return { release, entries: entries.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await fetchIso15924();
  console.log(`\n  ✓ ISO 15924 ${r.release} — ${r.entries} script codes\n`);
}

/**
 * The standard fetcher interface, so `fetch-source.mjs --all` and `--verify`
 * can reach the ISO 15924 script registry.
 *
 * This module predates the interface and exported only `fetchIso15924()`. The
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
  "handler": "iso15924",
  "license": "Unicode-3.0",
  "contributes": "script names for codes already on the cards",
  "note": "A JOIN, not an assertion: it adds no language and claims nothing new. Unicode says what 'Cans' means; it says nothing about which languages use it, so the composite statement is champollion-derived with Derived_From naming the ISO 15924 release. Runs LAST -- it resolves codes other sources put there.",
  "outOfVocabularyFatal": false,
  "outOfVocabularyNote": "An unresolvable script code is reported, not fatal, and NOT corrected. LinguaMeta writes 'Tulu' for Adilabad Gondi (wsg); ISO 15924 registers 'Tutg' (Tulu-Tigalari). Silently mapping one to the other would be editing an upstream's data to fit our join. The code is kept exactly as LinguaMeta gave it, the NAME is simply absent, and the unresolved code is listed every build so it can be raised upstream. This is non-fatal only because the failure is a join that cannot resolve -- unlike a value outside a source's OWN codelist, which means we misread that source and stays fatal."
};

export async function fetchSource({ verifyOnly = false, ...rest } = {}) {
  if (verifyOnly) return verify(dir);
  return fetchIso15924(rest);
}
