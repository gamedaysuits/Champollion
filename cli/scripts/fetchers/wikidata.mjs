#!/usr/bin/env node

/**
 * fetchers/wikidata.mjs — native language names, from Wikidata.
 *
 * WHY THIS SOURCE AND NOT ANOTHER
 *   `nativeName` — what speakers call their own language — has been the atlas's
 *   largest honest gap. LinguaMeta carries an endonym for 1,137 of its 7,511
 *   languages: 15%. There is no other pinned source for it.
 *
 *   Wikidata has P1705 ("native label") keyed to P220 (ISO 639-3), it is CC0 so
 *   there is no licence question at all, and it is the only broad source for
 *   this that can be queried reproducibly.
 *
 * WHAT A "PIN" MEANS FOR A LIVE ENDPOINT, HONESTLY
 *   Wikidata is edited continuously. There is no release to point at, so a
 *   re-fetch tomorrow will legitimately return something different. That is not
 *   a build failure — it is a new release.
 *
 *   The pin is therefore the QUERY plus the RESULT: the sha256 of the exact
 *   SPARQL text, the sha256 of the bytes returned, and the retrieval date. Same
 *   query and same result hash means the same data; a different result hash
 *   means Wikidata changed and the diff is explainable. What is NOT claimed is
 *   that re-running reproduces the bytes, because it will not, and pretending
 *   otherwise would make every future build look broken.
 *
 * ENDONYMS ARE SENSITIVE, AND MULTIPLICITY IS THE POINT
 *   A language may have several native names, in several scripts, and
 *   communities do not always agree about which is right. Every value is kept
 *   with its language tag rather than one being chosen — the same rule as
 *   speaker estimates and endangerment. Picking a "primary" endonym would be
 *   this project making a call that is not its to make.
 *
 * Usage:
 *   node cli/scripts/fetchers/wikidata.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, USER_AGENT, sha256File, writeSnapshot, verify } from './lib/fetch-lib.mjs';

const SOURCE = 'wikidata';
const ENDPOINT = 'https://query.wikidata.org/sparql';

/**
 * P220 is ISO 639-3; P1705 is the native label. Both are kept verbatim, with
 * the label's language tag, because a name in Devanagari and the same name in
 * Latin are different facts about how a community writes itself.
 */
const QUERY = `
SELECT ?iso ?native ?nativeLang WHERE {
  ?item wdt:P220 ?iso .
  ?item wdt:P1705 ?native .
  BIND(LANG(?native) AS ?nativeLang)
}
`.trim();

export async function fetchWikidata({ timeoutMs = 300_000 } = {}) {
  const dir = path.join(DATA_ROOT, SOURCE);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'native-labels.json');

  const url = `${ENDPOINT}?query=${encodeURIComponent(QUERY)}&format=json`;
  process.stdout.write(`  ${ENDPOINT} (P220 × P1705)\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let body;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Wikidata returned ${res.status} ${res.statusText}. `
        + 'The endpoint rate-limits and times out under load; this is a retry, not a '
        + 'reason to fall back to stale data.');
    }
    body = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const parsed = JSON.parse(body);
  const bindings = parsed?.results?.bindings ?? [];
  if (bindings.length < 1000) {
    throw new Error(
      `Wikidata returned only ${bindings.length} native labels. P1705 covers thousands; `
      + 'a short result means the query was truncated or the endpoint degraded, and a '
      + 'smaller dataset must not be mistaken for a smaller world.',
    );
  }

  // Stored normalised, so the file is diffable and the result hash is stable
  // against key-ordering noise from the endpoint.
  const rows = bindings.map((b) => ({
    iso: b.iso?.value ?? '',
    native: b.native?.value ?? '',
    lang: b.nativeLang?.value ?? '',
  })).filter((r) => r.iso && r.native)
    .sort((a, b2) => a.iso.localeCompare(b2.iso) || a.native.localeCompare(b2.native)
      || a.lang.localeCompare(b2.lang));

  fs.writeFileSync(dest, `${JSON.stringify({ query: QUERY, rows }, null, 2)}\n`);

  const queryHash = createHash('sha256').update(QUERY).digest('hex');
  const retrievedAt = new Date().toISOString().slice(0, 10);

  writeSnapshot(SOURCE, {
    source: SOURCE,
    upstream: ENDPOINT,
    license: 'CC0-1.0',
    licenseUrl: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
    citation: `Wikidata contributors. ${retrievedAt}. Native labels (P1705) by ISO 639-3 `
      + '(P220), retrieved via the Wikidata Query Service.',
    // A live endpoint has no release. The pin is the query plus the result.
    pin: { kind: 'query', value: `q${queryHash.slice(0, 12)}`, doi: null, date: retrievedAt },
    files: [{
      path: 'native-labels.json',
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: ENDPOINT,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/wikidata.mjs',
    notes:
      'Wikidata is edited continuously and has no release to pin to, so the pin is the '
      + `sha256 of the exact SPARQL text (${queryHash.slice(0, 16)}…) plus the result `
      + 'checksum and the retrieval date. A re-fetch returning different bytes is a NEW '
      + 'release, not a drift failure — this snapshot does not claim the query is '
      + `reproducible byte-for-byte. ${rows.length} native labels over `
      + `${new Set(rows.map((r) => r.iso)).size} ISO 639-3 codes.`,
  });

  return { rows: rows.length, languages: new Set(rows.map((r) => r.iso)).size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await fetchWikidata();
  console.log(`\n  ✓ Wikidata — ${r.rows} native label(s) over ${r.languages} language(s)\n`);
}

/**
 * The standard fetcher interface, so `fetch-source.mjs --all` and `--verify`
 * can reach Wikidata language properties.
 *
 * This module predates the interface and exported only `fetchWikidata()`. The
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
  "handler": "wikidata",
  "license": "CC0-1.0",
  "contributes": "native language names (endonyms)",
  "note": "A LIVE endpoint with no release, so the pin is the SPARQL text hash plus the result checksum and date. A re-fetch returning different bytes is a NEW release, not a drift failure -- Wikidata is edited continuously and this snapshot does not claim byte-reproducibility. CC0, so no licence question. Every label is kept with its language tag: choosing one would mean deciding which script a community really uses to write its own name."
};

export async function fetchSource({ verifyOnly = false, ...rest } = {}) {
  if (verifyOnly) return verify(dir);
  return fetchWikidata(rest);
}
