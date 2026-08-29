#!/usr/bin/env node

/**
 * fetchers/common-voice.mjs — Mozilla Common Voice per-language dataset stats.
 *
 * WHY THIS SOURCE EXISTS
 *   `speechResource` currently carries GiellaLT's handful of speech corpora.
 *   Common Voice is the largest open crowd-sourced speech collection there is
 *   — 290+ locales in the current corpus release — and for most low-resource
 *   languages it is the only open speech data of any size. An atlas that
 *   answers "does recorded, validated speech exist for this language" without
 *   consulting it is answering from a tenth of the picture.
 *
 * STATS, NEVER AUDIO — AND MOZILLA PUBLISHES THE STATS SEPARATELY
 *   The corpus is audio, which is corpus content and never tracked here. But
 *   Mozilla publishes the per-release statistics as their own artifact: the
 *   `common-voice/cv-dataset` repository carries one JSON per corpus release
 *   (the same data the commonvoice.mozilla.org datasets page renders), with
 *   per-locale validated/total hours, clip and contributor counts. That file
 *   IS the metadata layer — no clip crosses the wire.
 *
 * THE RELEASE FILE IS THE PIN
 *   Each release's stats live in a file NAMED for the release —
 *   `cv-corpus-26.0-2026-06-12.json` — and a shipped release's stats do not
 *   move. The fetcher lists the datasets directory, takes the newest full
 *   corpus release (delta and single-word files describe increments and
 *   subsets, not the corpus), and pins the release name. The licence recorded
 *   is what the cv-dataset repository itself declares, read from the
 *   repository rather than written from memory.
 *
 * LOCALES ARE MOZILLA'S, RECORDED VERBATIM
 *   Common Voice keys on BCP-47-ish locale codes — `pt`, `zh-CN`, `ga-IE`,
 *   `rm-sursilv`. The pin keeps them exactly as published; resolving them onto
 *   the spine is the ingest handler's job, where an unresolvable locale is
 *   counted and named rather than corrected.
 *
 * EXISTENCE AND EXTENT, NEVER CAPABILITY
 *   That validated speech exists for a locale, at how many hours, from how
 *   many contributors. Never that the audio is clean, the transcripts right,
 *   or the accent coverage representative.
 *
 * Usage:
 *   node cli/scripts/fetchers/common-voice.mjs
 *   node cli/scripts/fetch-source.mjs common-voice
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, getJSON, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'common-voice';

/**
 * Self-declared, like every native fetcher — the registry assembles itself
 * from these, so there is no second list for this source to be missing from.
 */
export const manifest = {
  module: '(native)',
  handler: 'commonVoice',
  license: 'MPL-2.0',
  contributes: 'speech dataset existence and extent, per language',
  note: 'Per-locale statistics of the CURRENT Common Voice corpus release, from Mozilla\'s '
    + 'own cv-dataset stats file: validated/total hours, clips, contributors. STATS ONLY — '
    + 'no audio clip or transcript is ever fetched; the corpus-content quarantine holds '
    + 'here the same as everywhere. The licence is the cv-dataset repository\'s own '
    + '(MPL-2.0, covering the stats file we read); the audio corpus itself is distributed '
    + 'by Mozilla under its own terms, which are not interpreted here and must be resolved '
    + 'before the corpus is used for anything. Locales are Mozilla\'s BCP-47-ish codes '
    + '(pt, zh-CN, ga-IE), recorded verbatim and resolved onto the spine at ingest. '
    + 'EXISTENCE AND EXTENT ONLY: never that the audio is clean or the transcripts right.',
};
export const dir = 'common-voice';

const FILE = 'common-voice-stats.json';
const REPO_API = 'https://api.github.com/repos/common-voice/cv-dataset';
const LISTING = `${REPO_API}/contents/datasets/scripted-speech`;

/** A published number, or null — never a coerced 0 for "not published". */
function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  if (!Number.isFinite(n)) {
    throw new Error(
      `Common Voice published a non-numeric count ${JSON.stringify(x)} — a schema change, `
      + 'and guessing a number for it would put a fabricated size on a card.',
    );
  }
  return n;
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  // ── The licence, read from the repository rather than written from memory ──
  const repo = await getJSON(REPO_API);
  const license = repo?.license?.spdx_id;
  if (!license || license === 'NOASSERTION') {
    throw new Error(
      'cv-dataset no longer declares a licence GitHub can identify. We do not guess on a '
      + 'rights-holder\'s behalf — establish the terms, then re-fetch.',
    );
  }

  // ── The newest full corpus release ─────────────────────────────────────────
  // Full releases only: `-delta-` files describe one release's increment and
  // `singleword` a subset, and pinning either would record a slice of the
  // corpus as though it were the corpus.
  const listing = await getJSON(LISTING);
  if (!Array.isArray(listing)) {
    throw new Error(`the cv-dataset listing came back ${typeof listing}, which is an API change`);
  }
  const releases = listing
    .map((f) => ({ name: f.name, url: f.download_url, m: /^cv-corpus-(\d+)\.(\d+)-(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name) }))
    .filter((f) => f.m)
    .sort((a, b) => (Number(a.m[1]) - Number(b.m[1])) || (Number(a.m[2]) - Number(b.m[2])));
  const latest = releases.at(-1);
  if (!latest) {
    throw new Error('no full cv-corpus release file found in cv-dataset — a layout change');
  }
  const releaseName = latest.name.replace(/\.json$/, '');
  const releaseDate = latest.m[3];

  const body = await getJSON(latest.url, { timeoutMs: 120_000 });
  const locales = body?.locales ?? {};
  const codes = Object.keys(locales).sort();
  if (!codes.length) {
    throw new Error(
      'the release lists no locales, which is a schema change — Common Voice has '
      + 'published hundreds per release for years.',
    );
  }

  // Only what a resource claim needs. The full record carries demographic
  // splits, bucket sizes and archive checksums that would make the pin churn
  // on details no card reads.
  const rows = codes.map((locale) => {
    const l = locales[locale];
    return {
      locale,
      validHrs: num(l.validHrs),
      totalHrs: num(l.totalHrs),
      clips: num(l.clips),
      users: num(l.users),
    };
  });

  const withValidated = rows.filter((r) => r.validHrs !== null && r.validHrs > 0).length;

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  fs.writeFileSync(dest, `${JSON.stringify({
    release: releaseName,
    date: releaseDate,
    locales: rows,
  }, null, 0)}\n`);

  const fetchedAt = new Date().toISOString();
  writeSnapshot(dir, {
    source,
    upstream: latest.url,
    license,
    licenseUrl: 'https://github.com/common-voice/cv-dataset/blob/main/LICENSE',
    citation: `Mozilla Common Voice dataset statistics, ${releaseName} `
      + `(common-voice/cv-dataset), retrieved ${fetchedAt.slice(0, 10)}.`,
    // The corpus release IS the pin: the stats file is named for the release
    // and a shipped release's numbers do not move.
    pin: { kind: 'release', value: releaseName, doi: null, date: releaseDate },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: latest.url,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/common-voice.mjs',
    notes:
      `${releaseName} (${releaseDate}): ${rows.length} locales, ${withValidated} with more `
      + 'than zero validated hours. STATS ONLY: validated/total hours, clip and contributor '
      + 'counts from Mozilla\'s own per-release stats file — no audio clip or transcript '
      + 'crosses the wire, which is what lets a speech-resource claim exist under the rule '
      + `that corpus CONTENT is never tracked. LICENCE: ${license} is what the cv-dataset `
      + 'repository declares and covers the stats file read here; the audio corpus itself '
      + 'is distributed under Mozilla\'s own dataset terms, which are not interpreted here '
      + 'and must be resolved before the corpus is used for anything. LOCALES are '
      + 'Mozilla\'s BCP-47-ish codes recorded verbatim (pt, zh-CN, ga-IE, rm-sursilv); '
      + 'resolution onto the spine happens at ingest, where an unresolvable locale is '
      + 'counted and named rather than corrected. An unpublished number is stored as null '
      + 'and never as 0 — "not published" and "measured, and empty" are different facts.',
    release: releaseName,
    locales: rows.length,
    localesWithValidatedHours: withValidated,
  });

  return {
    verified: true,
    files: 1,
    release: releaseName,
    locales: rows.length,
    withValidatedHours: withValidated,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
