#!/usr/bin/env node

/**
 * fetchers/wikipedia.mjs — which languages have a Wikipedia edition.
 *
 * WHY THIS IS A RESOURCE FACT AND NOT A QUALITY CLAIM
 *   A Wikipedia edition is monolingual running text a community wrote about
 *   itself. For a low-resource language it is often the largest such corpus in
 *   existence, and whether one exists is among the first things an MT
 *   practitioner needs to know.
 *
 *   It says nothing about how GOOD anything is. Several editions are largely
 *   bot-generated, and article counts are famously uneven between communities.
 *   So this records EXISTENCE, which is checkable, and nothing else.
 *
 * WHAT IS DELIBERATELY NOT FETCHED
 *   Article counts. The sitematrix does not carry them, and getting them means
 *   one API call per edition across 300-odd wikis. That is a real cost for a
 *   number that would invite exactly the comparison this project refuses to
 *   make — a 200,000-article edition is not "better documented" than a
 *   2,000-article one in any sense a translator can use. If counts are wanted
 *   later they need their own fetcher and their own justification.
 *
 * THE CODE PROBLEM, WHICH IS REAL
 *   Wikipedia site codes are historical: mostly ISO 639-1, sometimes 639-3,
 *   sometimes neither (`simple`, `nds-nl`, `zh-yue`). They are joined to the
 *   spine through BCP 47 tags that LinguaMeta already supplies, and anything
 *   that does not resolve is COUNTED rather than guessed at. An unmatched
 *   edition is a gap in our mapping, not a language without a Wikipedia.
 *
 * Usage:
 *   node cli/scripts/fetchers/wikipedia.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT, USER_AGENT, sha256File, writeSnapshot, verify } from './lib/fetch-lib.mjs';

const SOURCE = 'wikipedia';
const ENDPOINT = 'https://meta.wikimedia.org/w/api.php'
  + '?action=sitematrix&format=json&formatversion=2';

export async function fetchWikipedia({ timeoutMs = 120_000 } = {}) {
  const dir = path.join(DATA_ROOT, SOURCE);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'editions.json');

  process.stdout.write(`  ${ENDPOINT.split('?')[0]} (sitematrix)\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let payload;
  try {
    const res = await fetch(ENDPOINT, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`sitematrix returned ${res.status} ${res.statusText}`);
    payload = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const matrix = payload?.sitematrix ?? {};
  const editions = [];
  for (const [key, group] of Object.entries(matrix)) {
    // The matrix mixes numbered language groups with `count` and `specials`.
    if (!/^\d+$/.test(key)) continue;
    const wiki = (group.site ?? []).find((s) => s.code === 'wiki' && !s.closed);
    if (!wiki) continue;
    editions.push({
      site: group.code,
      name: group.name ?? '',
      localname: group.localname ?? '',
      url: wiki.url ?? '',
    });
  }
  editions.sort((a, b) => a.site.localeCompare(b.site));

  if (editions.length < 200) {
    throw new Error(
      `Parsed only ${editions.length} open Wikipedia editions. There are around 300; a `
      + 'short read means the sitematrix shape changed, and a smaller list must not be '
      + 'mistaken for fewer languages having a Wikipedia.',
    );
  }

  fs.writeFileSync(dest, `${JSON.stringify({ editions }, null, 2)}\n`);
  const retrievedAt = new Date().toISOString().slice(0, 10);

  writeSnapshot(SOURCE, {
    source: SOURCE,
    upstream: ENDPOINT,
    // The sitematrix is factual site metadata, published by the Wikimedia
    // Foundation under CC0 alongside the API.
    license: 'CC0-1.0',
    licenseUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
    citation: `Wikimedia Foundation. ${retrievedAt}. Sitematrix — the list of Wikipedia `
      + 'language editions.',
    // A live endpoint: the pin is the retrieval date plus the result checksum.
    pin: { kind: 'query', value: `sitematrix-${retrievedAt}`, doi: null, date: retrievedAt },
    files: [{
      path: 'editions.json',
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: ENDPOINT,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/wikipedia.mjs',
    notes:
      'A live endpoint with no release, so the pin is the retrieval date plus the result '
      + 'checksum; a re-fetch returning different bytes is a NEW release, not a drift '
      + 'failure. Closed wikis are excluded — a closed edition is not a resource anyone '
      + `can contribute to. Article counts are deliberately NOT fetched. ${editions.length} `
      + 'open editions.',
  });

  return { editions: editions.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await fetchWikipedia();
  console.log(`\n  ✓ Wikipedia — ${r.editions} open language edition(s)\n`);
}

/**
 * The standard fetcher interface, so `fetch-source.mjs --all` and `--verify`
 * can reach Wikipedia edition sizes.
 *
 * This module predates the interface and exported only `fetchWikipedia()`. The
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
  "handler": "wikipedia",
  "license": "CC0-1.0",
  "contributes": "Wikipedia edition existence",
  "note": "EXISTENCE ONLY. For many low-resource languages a Wikipedia is the largest body of monolingual running text there is, which is why it belongs on the card; it says nothing about quality or size, which is why nothing else is claimed. Article counts are deliberately NOT fetched -- they would invite a comparison this project refuses to make. Site codes are historical (mostly 639-1, sometimes 639-3, sometimes neither) and are joined via BCP 47, so this runs AFTER linguameta."
};

export async function fetchSource({ verifyOnly = false, ...rest } = {}) {
  if (verifyOnly) return verify(dir);
  return fetchWikipedia(rest);
}
