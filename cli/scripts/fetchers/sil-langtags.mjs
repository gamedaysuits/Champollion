#!/usr/bin/env node

/**
 * fetchers/sil-langtags.mjs — SIL's langtags equivalence sets.
 *
 * WHAT THIS IS
 *   A machine-readable map across the whole language-tag space, published by
 *   SIL. Each entry is an EQUIVALENCE SET: one canonical BCP 47 tag, its fully
 *   specified form, every other tag that means the same thing, and the ISO
 *   639-3 code it corresponds to.
 *
 *   It is the single most useful file in this rebuild, because it is the only
 *   source that states — as data, from the ISO 639-3 registration authority
 *   itself — the correspondence Champollion has to make on every lookup:
 *
 *     {"tag":"zh", "full":"zh-Hans-CN", "iso639_3":"zho",
 *      "iso639_3extra":["cmn"], "contains":["cdo","cjy","cmn",...]}
 *
 *   `iso639_3extra` is the predominant-member link, and `contains` is the
 *   macrolanguage membership. Both are SIL's assertions, not ours, which is
 *   what turns "when someone types zh, give them Mandarin" from an editorial
 *   guess into a cited resolution.
 *
 * IT IS NOT TAKEN AS SOLE AUTHORITY
 *   CLDR's alias table and the IANA registry carry the same relations
 *   independently. All three are ingested, and where they disagree the atlas
 *   reports the disagreement rather than ranking them — the same rule that
 *   applies to two sources disagreeing about a speaker count.
 *
 *   That rule earns its keep immediately. For Cree, BOTH CLDR and SIL name
 *   Woods Cree (cwd) as the predominant member of `cre` — not Plains Cree
 *   (crk), which is Champollion's own flagship. A pipeline that picked its
 *   favourite would have quietly disagreed with both registries about its most
 *   important language.
 *
 * THE PIN
 *   The file carries its own version record — an entry `{"tag":"_version",
 *   "api":"1.4","date":"2026-06-09"}` — so the pin comes from the publisher
 *   rather than from us. Absence of that record is fatal: an unversioned
 *   langtags.json is a download of "whatever the API served today", which is
 *   precisely what a pin is supposed to rule out.
 *
 * LICENCE
 *   MIT, © SIL International 2019-2025 (verified against the LICENSE file in
 *   silnrsi/langtags). Redistributable and commercial-safe, requiring the
 *   copyright notice — which the source record carries.
 *
 *   Worth noting against the neighbouring ISO 639-3 tables: the same publisher
 *   releases this one under a plain permissive licence. The restrictive terms
 *   on the code tables are specific to the code tables.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs sil-langtags
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, download, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'sil-langtags';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "langtags",
  "license": "MIT",
  "contributes": "canonical and maximal BCP 47 tags, equivalent-tag aliases, and the predominant member of a macrolanguage (iso639_3extra)",
  "note": "Equivalence sets from SIL, MIT-licensed — a far more permissive grant than the same publisher's ISO 639-3 code tables, and the two must never be conflated. `contains[]` restates the ISO 639-3 macrolanguage membership from the same publisher and is NOT ingested as a second attestation; `iso639_3extra` is the langtags editors' own choice of predominant member and is. For Cree both CLDR and langtags name Woods Cree (cwd), not Plains Cree (crk) — so Champollion’s own flagship resolves as a plain macrolanguage member and never as the predominant one, which is the correct and uncomfortable answer."
};
export const dir = 'sil-langtags';

const URL = 'https://ldml.api.sil.org/langtags.json';
const FILE = 'langtags.json';

/**
 * Pull the publisher's own version record out of the array.
 *
 * Refuses to fall back to a date of our own choosing: every other fetcher in
 * this directory that could not find a real pin either derived one from the
 * data and SAID SO, or refused. Inventing one here would be the first.
 */
export function readVersion(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('langtags.json must be a JSON array of equivalence sets');
  }
  const v = entries.find((e) => e && e.tag === '_version');
  if (!v?.date) {
    throw new Error(
      'langtags.json carries no {"tag":"_version"} record with a date, so there '
      + 'is no release to pin to. An unversioned copy is "whatever the API served '
      + 'today", which is the thing a pin exists to rule out.',
    );
  }
  return { api: v.api ?? null, date: v.date };
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const dest = path.join(DATA_ROOT, dir, FILE);
  process.stdout.write(`  ${URL}\n`);
  await download(URL, dest);

  const entries = JSON.parse(fs.readFileSync(dest, 'utf-8'));
  const { api, date } = readVersion(entries);

  // The three relations this source is fetched FOR. Counted here so the
  // ingestion contract has something to assert against, and so a reformatted
  // upstream fails the fetch rather than yielding a clean run over nothing.
  const sets = entries.filter((e) => e && typeof e.tag === 'string' && !e.tag.startsWith('_'));
  const withIso = sets.filter((e) => e.iso639_3).length;
  const withContains = sets.filter((e) => Array.isArray(e.contains) && e.contains.length).length;
  const withExtra = sets.filter((e) => Array.isArray(e.iso639_3extra) && e.iso639_3extra.length).length;
  if (!withIso || !withContains) {
    throw new Error(
      `langtags.json parsed to ${sets.length} sets but ${withIso} carry iso639_3 and `
      + `${withContains} carry contains[]. Those are the relations this source exists `
      + 'to provide; zero of either is a schema change, not an upstream statement.',
    );
  }

  writeSnapshot(dir, {
    source,
    upstream: URL,
    license: 'MIT',
    licenseUrl: 'https://github.com/silnrsi/langtags/blob/master/LICENSE',
    citation: `SIL International. langtags.json, API ${api ?? 'unstated'}, ${date}. `
      + 'https://github.com/silnrsi/langtags',
    pin: { kind: 'version', value: `${api ?? 'api'}@${date}`, doi: null, date },
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: URL,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/sil-langtags.mjs',
    notes:
      `${sets.length} equivalence sets: ${withIso} carry an ISO 639-3 code, `
      + `${withContains} carry macrolanguage membership (contains[]), and ${withExtra} `
      + 'name a predominant member (iso639_3extra). Pin is the publisher\'s own '
      + '_version record, not a date we chose. LICENCE: MIT, © SIL International '
      + '2019-2025, verified against the LICENSE file in silnrsi/langtags — note '
      + 'this is a DIFFERENT and far more permissive grant than the same '
      + "publisher's ISO 639-3 code tables, and the two must not be conflated. "
      + 'SIL publishes no checksum for this endpoint, so upstreamVerified is false: '
      + 'the sha256 is what we received, not something the publisher attests.',
  });

  return { verified: true, files: 1, version: date, sets: sets.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
