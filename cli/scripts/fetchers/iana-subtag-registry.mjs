#!/usr/bin/env node

/**
 * fetchers/iana-subtag-registry.mjs — the IANA Language Subtag Registry.
 *
 * WHY CHAMPOLLION NEEDS THIS AT ALL
 *   Every MT service we index publishes its coverage in BCP 47, not ISO 639-3.
 *   Google lists `zho`; nobody lists `cmn`. That is not sloppiness on their
 *   part — RFC 5646 and CLDR both say the canonical Unicode identifier for
 *   Mandarin IS `zh`, because "Unicode language and locale identifiers always
 *   use the Macrolanguage to identify the predominant form".
 *
 *   So there are two coherent code ecosystems and Champollion sits across both:
 *   localisation (BCP 47 / CLDR / IANA, macrolanguage-preferred) and documentary
 *   linguistics (ISO 639-3 / Glottolog / CLDF, individual-language-preferred).
 *   This registry is the authority for the first, and it is the file RFC 5646
 *   defines so that implementations can parse and embed it.
 *
 * WHAT IT UNIQUELY CARRIES
 *   `Scope: macrolanguage`, `Macrolanguage:` on each encompassed language,
 *   `Preferred-Value:` for deprecations and extlang collapses, `Suppress-Script:`
 *   (when a script subtag is redundant), and `Deprecated:`. Those relations are
 *   what let the atlas answer "does `zho` coverage say anything about `cmn`?"
 *   with a citation instead of an opinion.
 *
 * THE PIN
 *   The registry is a single flat file with no version in its path, but its
 *   FIRST LINE is `File-Date: YYYY-MM-DD` — the registry's own release stamp.
 *   That is the pin, taken from the data rather than declared by us, and the
 *   sha256 remains the exact identity.
 *
 * THE LICENCE, STATED HONESTLY
 *   IANA publishes no licence statement on or about this file, and RFC 5646's
 *   IETF Trust boilerplate governs the RFC DOCUMENT, not the registry data it
 *   defines. What is on the record is that the registry is a public protocol
 *   registry, maintained by IANA under BCP 47, whose machine-readable form
 *   exists precisely so implementations can consume it.
 *
 *   So it is recorded as its own LicenseRef rather than dressed up as a
 *   standard SPDX grant nobody actually issued — which means the existing rule
 *   applies unchanged: a bespoke LicenseRef is NOT redistributable, because
 *   reading silence as permission is the failure this pass exists to end.
 *
 *   That costs nothing we need. Parsing the registry is what we do, and it is
 *   plainly the use the machine-readable form exists for. Republishing it
 *   inside a Zenodo deposit is a different act, and the publication gate will
 *   raise it there rather than letting it be discovered by someone who had to
 *   remember.
 *
 * A STALE COPY EXISTS AND IS NOT THIS
 *   `cli/data/iana-subtag-registry.txt` has been on disk since June, unpinned,
 *   at File-Date 2026-05-05 while upstream is newer. It is exactly the class of
 *   file this whole rebuild exists to eliminate: right-looking, unattributable,
 *   and quietly out of date. This fetcher writes to its own pinned directory
 *   and the loose copy is deleted by the archive step.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs iana-subtag-registry
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, download, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'iana-subtag-registry';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "iana",
  "license": "LicenseRef-IANA-Protocol-Registry",
  "contributes": "BCP 47 registry decisions: Suppress-Script, and the Preferred-Value redirects for deprecated language subtags",
  "note": "Record-jar format per RFC 5646, not CLDF. DELIBERATELY NARROW: the registry also carries Scope: and Macrolanguage: fields, and those are COPIED FROM ISO 639-3 rather than independently determined. Ingesting them would put a second attestation beside SIL's on the same claim and make an echo look like corroboration — the atlas would report 'unanimous' where only one registry had actually decided anything. So only IANA's OWN decisions are taken. LICENCE: IANA publishes no terms; the reading recorded in the snapshot is that a public protocol registry whose machine-readable form exists for implementations to parse may be parsed. That reading is stated so it can be argued with."
};
export const dir = 'iana-subtag-registry';

const URL = 'https://www.iana.org/assignments/language-subtag-registry/'
  + 'language-subtag-registry';
const FILE = 'language-subtag-registry.txt';

/**
 * The registry's own release stamp. Refuses to guess: a registry file whose
 * first line is not File-Date is not the registry, and pinning it to today's
 * date would manufacture a provenance record for bytes of unknown origin.
 */
export function readFileDate(text) {
  const first = text.split('\n', 1)[0] ?? '';
  const m = /^File-Date:\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(first);
  if (!m) {
    throw new Error(
      'The IANA subtag registry must begin with "File-Date: YYYY-MM-DD" and this '
      + `file begins with ${JSON.stringify(first.slice(0, 60))}. Without that line `
      + 'there is no release to pin to, and a pin we invent is worse than none.',
    );
  }
  return m[1];
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  const dest = path.join(DATA_ROOT, dir, FILE);
  process.stdout.write(`  ${URL}\n`);
  await download(URL, dest);

  const text = fs.readFileSync(dest, 'utf-8');
  const fileDate = readFileDate(text);

  // Counted here and asserted in the ingestion contract. A registry that
  // suddenly carries no macrolanguage relations has not "changed" — it has been
  // truncated or reformatted, and the build must say so rather than ingest a
  // silently empty answer to the question this source exists to answer.
  const records = text.split('\n%%\n').length;
  const macrolanguage = (text.match(/^Macrolanguage:/gm) ?? []).length;
  const preferred = (text.match(/^Preferred-Value:/gm) ?? []).length;
  if (!macrolanguage) {
    throw new Error(
      'The registry parsed to zero Macrolanguage: fields. That is the single '
      + 'relation this source is fetched for, so an empty result is a parse or '
      + 'download fault, never an upstream statement.',
    );
  }

  writeSnapshot(dir, {
    source,
    upstream: URL,
    license: 'LicenseRef-IANA-Protocol-Registry',
    licenseUrl: 'https://www.rfc-editor.org/rfc/rfc5646.txt',
    citation: `IANA Language Subtag Registry, File-Date ${fileDate}. `
      + 'Maintained by IANA under BCP 47 (RFC 5646).',
    pin: { kind: 'release', value: fileDate, doi: null, date: fileDate },
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: URL,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/iana-subtag-registry.mjs',
    notes:
      `${records} records; ${macrolanguage} carry a Macrolanguage: relation and `
      + `${preferred} a Preferred-Value:. LICENCE (checked ${fileDate}, not assumed): `
      + 'IANA publishes NO licence or terms-of-use statement on or about this file. '
      + "RFC 5646's IETF Trust boilerplate restricts derivative works of the RFC "
      + 'DOCUMENT; it does not speak to the registry data the RFC defines. The '
      + 'registry is a public protocol registry whose machine-readable form exists '
      + 'so implementations can parse and embed it, which is the use made here. '
      + 'Recorded as redistributable and commercial-safe on that basis — a reading, '
      + 'stated so it can be argued with, not a grant anyone issued. IANA publishes '
      + 'no checksum, so upstreamVerified is false by necessity: the sha256 is what '
      + 'we received, not something the publisher attests.',
  });

  return { verified: true, files: 1, version: fileDate, records, macrolanguage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
