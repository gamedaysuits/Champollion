#!/usr/bin/env node

/**
 * fetchers/hf-models.mjs — every translation model on the HuggingFace Hub.
 *
 * THE SIZE OF THE GAP
 *   17,204 models carry the `translation` pipeline tag. We index eleven. The
 *   long tail is disproportionately the community fine-tunes for low-resource
 *   languages — precisely the ones no other index lists, and precisely the ones
 *   this project exists for. Plains Cree currently has zero method coverage.
 *
 * WHY `cardData.language` AND NOT `tags`
 *   The obvious read is the `tags` array, which contains the language codes
 *   flattened in among everything else. It is also a trap, because ML framework
 *   tags collide with ISO 639-3:
 *
 *     jax   the library            AND Jambi Malay
 *     mms   Meta's speech model    AND Southern Mam
 *     pt    PyTorch, colloquially  AND Portuguese
 *
 *   A tag-scraping fetcher would announce that Meta's MMS supports Southern Mam
 *   and that half the Hub supports Jambi Malay. `expand[]=cardData` returns the
 *   model card's DECLARED `language` field instead — what the author actually
 *   said, in one paginated sweep rather than 17,000 detail requests.
 *
 * PAGINATION HAS NO TOTAL
 *   The API returns no count of matches. The `Link` header carries an opaque
 *   cursor and that is the only way through — the same class of trap as
 *   Zenodo's silent 25-item page cap, which this repo has been bitten by
 *   before. So the loop follows the cursor to exhaustion and records how many
 *   pages it took, and a run that stops early is visible rather than inferred.
 *
 * THE PIN IS SELF-ATTESTED, AND THE HUB MOVES
 *   Models are added and deleted daily. There is no release, no version, no
 *   publisher checksum. The snapshot IS the pin: this query, these bytes, this
 *   date, hashed by us. `pinQuality: 'self-attested'` keeps that distinct from
 *   a DOI'd deposit, and a refetch is a NEW pinned snapshot with an explainable
 *   diff rather than a silent in-place change.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs hf-models
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'hf-models';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "hfModels",
  "license": "LicenseRef-HuggingFace-Hub-Metadata",
  "contributes": "method nodes and coverage edges for every HuggingFace translation model whose card declares a resolvable language",
  "note": "17,730 models swept, 10,608 declaring a language. Languages come from cardData.language and NOT the tags array, because framework tags collide with ISO 639-3 \\u2014 jax is also Jambi Malay, mms is also Southern Mam, pt is also Portuguese \\u2014 so tag scraping would announce coverage no author claimed. Inclusion rules live in shared/catalogue/hf-inclusion-policy.json with the observed numbers beside them; per founder direction there is no popularity floor, because a download threshold would cut precisely the low-resource fine-tunes this exists to surface. Derivation is recorded where the card declares base_model and NEVER inferred from a repository name."
};
export const dir = 'hf-models';

const FILE = 'translation-models.json';

/** Only what an index needs. Every field here is used; none is collected "in case". */
const EXPAND = [
  'cardData', 'downloads', 'likes', 'library_name',
  'gated', 'private', 'lastModified', 'pipeline_tag', 'author',
];

const BASE = 'https://huggingface.co/api/models'
  + `?filter=translation&limit=1000&${EXPAND.map((e) => `expand[]=${e}`).join('&')}`;

/**
 * Translation models the `filter=translation` sweep cannot see, because their
 * own cards chose a different pipeline tag.
 *
 * facebook/m2m100_418M declares `text2text-generation`, so HuggingFace's
 * translation filter excludes it FAITHFULLY — the sweep is not wrong, the
 * card's pipeline tag is just not the one the filter reads. Its language list
 * (101 tags, the owner's own card data) is still fetched exactly like every
 * swept model; the only hand-made thing here is the DECISION to include the
 * id despite its tag, recorded with its reason the way a parameterMap records
 * a mapping decision. Kept deliberately short: every entry is one the curated
 * coverage file used to hand-transcribe wholesale.
 */
const EXTRA_MODELS = [
  'facebook/m2m100_418M',   // pipeline text2text-generation; 101 card languages
  'facebook/m2m100_1.2B',   // same family, same tag choice
];

/** RFC 5988 `Link: <url>; rel="next"`. */
function nextFrom(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="?next"?/.exec(part);
    if (m) return m[1];
  }
  return null;
}

export async function fetchSource({ verifyOnly = false, maxPages = 100 } = {}) {
  if (verifyOnly) return verify(dir);

  const models = [];
  const seen = new Set();
  let url = BASE;
  let pages = 0;

  while (url && pages < maxPages) {
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(
        `HuggingFace returned HTTP ${res.status} on page ${pages + 1}. A partial sweep is `
        + 'not a smaller Hub — refusing to pin an incomplete list.',
      );
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) {
      throw new Error(`page ${pages + 1} was not an array — the API shape changed`);
    }
    pages++;
    for (const m of batch) {
      // The cursor is opaque and the Hub mutates during a sweep, so a model can
      // legitimately appear twice. Deduplicated by id rather than trusted to be
      // disjoint.
      if (m?.id && !seen.has(m.id)) { seen.add(m.id); models.push(m); }
    }
    process.stdout.write(`\r  page ${pages}: ${models.length} models`);
    url = nextFrom(res.headers.get('link'));
  }
  process.stdout.write('\n');

  if (url) {
    throw new Error(
      `stopped after ${maxPages} pages with a cursor still outstanding. Raise maxPages — `
      + 'a truncated sweep pinned as complete is exactly the failure this fetcher guards.',
    );
  }
  if (!models.length) {
    throw new Error('the sweep returned zero models, which is a query or API change');
  }

  // The declared extras, fetched one by one from their own cards. A failure
  // here aborts: an extra silently missing would re-open the exact hole the
  // list exists to close.
  for (const id of EXTRA_MODELS) {
    if (seen.has(id)) continue;
    const res = await fetch(
      `https://huggingface.co/api/models/${id}?${EXPAND.map((e) => `expand[]=${e}`).join('&')}`,
      { headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`declared extra ${id} returned HTTP ${res.status}`);
    const m = await res.json();
    if (m?.id && !seen.has(m.id)) { seen.add(m.id); models.push(m); }
  }

  // What the list is actually good for, counted here so the ingestion contract
  // has something to assert and a degraded response fails the FETCH.
  const withDeclaredLanguages = models.filter(
    (m) => Array.isArray(m.cardData?.language) && m.cardData.language.length,
  ).length;
  if (!withDeclaredLanguages) {
    throw new Error(
      'no model in the sweep carries cardData.language. That is the one field this '
      + 'source is fetched for, so an empty result is a schema change rather than a Hub '
      + 'where nobody declares a language.',
    );
  }

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  // Sorted by id so two sweeps of an unchanged Hub produce identical bytes;
  // the API returns trending order, which changes hourly and would make every
  // refetch look like a change.
  models.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(dest, `${JSON.stringify(models, null, 0)}\n`);

  const queryHash = createHash('sha256').update(BASE).digest('hex').slice(0, 12);
  const fetchedAt = new Date().toISOString();

  writeSnapshot(dir, {
    source,
    upstream: BASE,
    license: 'LicenseRef-HuggingFace-Hub-Metadata',
    licenseUrl: 'https://huggingface.co/terms-of-service',
    citation: `HuggingFace Hub model index, pipeline_tag=translation, retrieved `
      + `${fetchedAt.slice(0, 10)}.`,
    pin: {
      kind: 'release',
      value: `${queryHash}@${fetchedAt.slice(0, 10)}`,
      doi: null,
      date: fetchedAt.slice(0, 10),
    },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: BASE,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/hf-models.mjs',
    notes:
      `${models.length} models over ${pages} page(s); ${withDeclaredLanguages} declare `
      + 'languages on their model card. LANGUAGES COME FROM cardData.language, NOT from '
      + 'the tags array: framework tags collide with ISO 639-3 codes (jax is also Jambi '
      + 'Malay, mms is also Southern Mam, pt is also Portuguese), so scraping tags would '
      + "announce coverage no author claimed. PAGINATION: the API publishes no total, so "
      + 'the Link header cursor is followed to exhaustion and the page count is recorded; '
      + 'a truncated sweep throws rather than pinning a smaller Hub. PIN QUALITY: the Hub '
      + 'has no release and mutates daily, so the snapshot is the pin — this query, these '
      + 'bytes, this date. Entries are sorted by id so an unchanged Hub yields identical '
      + 'bytes; the API returns trending order, which changes hourly.',
    modelCount: models.length,
    withDeclaredLanguages,
    pages,
  });

  return { verified: true, files: 1, models: models.length, withDeclaredLanguages, pages };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
