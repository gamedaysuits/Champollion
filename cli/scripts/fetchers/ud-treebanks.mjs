#!/usr/bin/env node

/**
 * fetchers/ud-treebanks.mjs — the Universal Dependencies treebank catalogue.
 *
 * METADATA ONLY, WHICH IS THE WHOLE POINT
 *   A UD treebank is a syntactically annotated CORPUS, and corpus content is
 *   never tracked in this repo — the quarantine gate enforces it. What a card
 *   needs is existence and extent: that UD_French-GSD exists, in which release,
 *   at how many sentences and tokens. UD publishes exactly that layer without
 *   the text: each treebank repository carries a `stats.xml` whose <size> block
 *   is the maintainers' own count, and the release machinery publishes which
 *   treebanks are IN each release. No CoNLL-U file ever crosses the wire.
 *
 * WHY THE RELEASE IS THE PIN, NOT THE ORG LISTING
 *   The GitHub org listing is live — a repository created tomorrow appears in
 *   it, and a listing fetched twice is two different artifacts with no name.
 *   UD's releases are versioned and frozen: `releases.json` (maintained by the
 *   UD infrastructure in docs-automation) says which treebanks release 2.18
 *   contains and when it shipped, and every member repository is TAGGED
 *   `r2.18` at that state. So the sweep reads each treebank's stats.xml AT THE
 *   RELEASE TAG — an immutable ref — and the pin is the release number. Two
 *   runs against the same release yield the same bytes; that is what a pin is.
 *
 * LANGUAGE CODES COME FROM UD'S OWN REGISTRY
 *   A repo name carries a language NAME (UD_Ancient_Greek-Perseus), not a code.
 *   UD maintains the mapping itself — `codes_and_flags.yaml`, with an `iso3`
 *   per language — so the code recorded here is UD's own assertion about which
 *   language its treebank annotates, not our guess from a display name. A name
 *   the registry does not carry is recorded with a null code and NAMED, never
 *   silently dropped or fuzzily matched.
 *
 * AN UNPUBLISHED COUNT IS NOT ZERO
 *   A stats.xml missing a <words> element means the treebank splits no tokens,
 *   and one missing entirely means the count is unpublished. Both are stored as
 *   null and stay distinguishable from a measured zero all the way to the card
 *   — the same rule the OPUS fetcher wrote down, for the same reason.
 *
 * POLITE, RESUMABLE, HONEST ABOUT GAPS
 *   One request per treebank (~350), serial with a delay, journalled so a
 *   dropped request resumes rather than restarts. Treebanks that cannot be
 *   fetched are NAMED in the snapshot; below 95% the sweep refuses outright,
 *   because that is a failed fetch and not a small release.
 *
 * Usage:
 *   node cli/scripts/fetchers/ud-treebanks.mjs
 *   node cli/scripts/fetch-source.mjs ud-treebanks
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';
import { sweep, clearJournal } from './lib/sweep.mjs';

export const source = 'ud-treebanks';

/**
 * What this source contributes, declared beside how it is fetched — the same
 * self-declaration every native fetcher carries, so the registry assembles
 * itself and there is no second list to forget this in.
 */
export const manifest = {
  module: '(native)',
  handler: 'udTreebanks',
  license: 'LicenseRef-UD-Per-Treebank',
  contributes: 'syntactic treebank existence and extent, per language',
  note: 'One entry per treebank in the CURRENT UD release: name, the maintainers\' own '
    + 'sentence/token/word counts from each repository\'s stats.xml at the release tag, '
    + 'and the release number as the pin. EXISTENCE AND EXTENT ONLY — no CoNLL-U file is '
    + 'ever fetched; the corpus-content quarantine holds here the same as everywhere. '
    + 'LICENCE IS NOT UNIFORM and is deliberately a LicenseRef: every UD treebank carries '
    + 'its own terms (CC BY-SA, CC BY-NC-SA, GPL, …), none of which is redistributed or '
    + 'interpreted here — each treebank\'s own terms must be resolved before its content '
    + 'is used for anything. The release/registry metadata this reads (releases.json, '
    + 'codes_and_flags.yaml) is published by UD\'s docs-automation under Apache-2.0. '
    + 'Language codes are UD\'s own iso3 assignments from its registry, never inferred '
    + 'from display names.',
};
export const dir = 'ud-treebanks';

const FILE = 'ud-treebanks.json';
// The UD infrastructure repo: releases.json is what the release process itself
// maintains, and codes_and_flags.yaml is UD's own language registry.
const AUTOMATION = 'https://raw.githubusercontent.com/UniversalDependencies/docs-automation/master';
const RAW = 'https://raw.githubusercontent.com/UniversalDependencies';
/** Serial with a gap — raw.githubusercontent is generous, but ~350 requests is still a sweep. */
const DELAY_MS = 80;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function getText(url, { attempts = 5 } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      await sleep(Math.min(15_000, 500 * 2 ** i));
    }
  }
  throw new Error(`${url} failed after ${attempts} attempts: ${lastError?.message}`);
}

/**
 * UD's language registry, name → codes. The file is flat YAML — a top-level
 * name per record, two-space-indented scalar fields — parsed narrowly here
 * rather than through a YAML dependency the CLI does not otherwise carry. The
 * parser reads only the shape the file actually has; a structural surprise
 * yields a missing code, which the caller counts and names rather than guesses
 * around.
 */
function parseCodesAndFlags(text) {
  const byName = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    const name = /^(\S[^:]*):\s*$/.exec(line);
    if (name) {
      current = { lcode: null, iso3: null };
      byName.set(name[1], current);
      continue;
    }
    if (!current) continue;
    const field = /^\s+(lcode|iso3):\s*(\S+)\s*$/.exec(line);
    if (field) current[field[1]] = field[2];
  }
  return byName;
}

/**
 * A count out of a stats.xml <total> block, or null when it is not there.
 * The distinction matters: <words> is legitimately absent when no token is
 * split, and a whole block can be absent — neither is a measured zero.
 */
function count(block, tag) {
  const m = new RegExp(`<${tag}>(\\d+)</${tag}>`).exec(block ?? '');
  return m ? Number(m[1]) : null;
}

export async function fetchSource({ verifyOnly = false } = {}) {
  if (verifyOnly) return verify(dir);

  // ── The release: which treebanks, which version, which date ───────────────
  const releases = JSON.parse(await getText(`${AUTOMATION}/valdan/releases.json`)).releases;
  const versions = Object.keys(releases ?? {})
    .filter((k) => Array.isArray(releases[k]?.treebanks))
    .sort((a, b) => {
      const [am, an] = a.split('.').map(Number);
      const [bm, bn] = b.split('.').map(Number);
      return am - bm || an - bn;
    });
  const version = versions.at(-1);
  if (!version) throw new Error('releases.json lists no release with a treebank list — a schema change');
  const release = releases[version];
  const treebanks = [...release.treebanks].sort();
  if (!treebanks.length) {
    throw new Error(`UD ${version} lists no treebanks, which is a schema change, not an empty UD`);
  }

  // ── UD's own name → code registry ──────────────────────────────────────────
  const codes = parseCodesAndFlags(await getText(`${AUTOMATION}/codes_and_flags.yaml`));
  if (!codes.size) throw new Error('codes_and_flags.yaml parsed to nothing — a format change');

  // ── One stats.xml per treebank, at the immutable release tag ──────────────
  const oneTreebank = async (repo) => {
    // Only the <total> counts leave this function. stats.xml also carries
    // most-frequent-lemma comments; extracting numbers here is what keeps the
    // pinned artifact free of anything resembling corpus content.
    const xml = await getText(`${RAW}/${repo}/r${version}/stats.xml`);
    const total = /<total>([\s\S]*?)<\/total>/.exec(xml)?.[1] ?? null;
    return {
      sentences: count(total, 'sentences'),
      tokens: count(total, 'tokens'),
      words: count(total, 'words'),
    };
  };

  const swept = await sweep({
    dir,
    items: treebanks,
    fn: oneTreebank,
    delayMs: DELAY_MS,
    // Below this it is a failed fetch, not a small release — UD releases are
    // frozen, so anything missing at the tag is a network problem, not history.
    minComplete: 0.95,
    onProgress: ({ i, n, failed }) => {
      if (i % 25 && i !== n) return;
      process.stdout.write(`\r  ${i}/${n} treebanks${failed ? ` · ${failed} unreachable` : ''}`);
    },
  });
  process.stdout.write('\n');
  if (swept.resumedFrom) {
    console.log(`  resumed: ${swept.resumedFrom} treebanks already journalled, not re-requested`);
  }
  const unreachable = Object.keys(swept.failed).sort();

  // ── Assemble: repo name → language name → UD's own code ────────────────────
  const nameless = [];
  const rows = treebanks
    .filter((repo) => repo in swept.results)
    .map((repo) => {
      // UD_{Language}-{Treebank}; language names contain underscores for
      // spaces (UD_Ancient_Greek-Perseus) and the treebank id follows the LAST
      // hyphen — the org's own naming convention.
      const bare = repo.replace(/^UD_/, '');
      const at = bare.lastIndexOf('-');
      const language = (at > 0 ? bare.slice(0, at) : bare).replace(/_/g, ' ');
      const entry = codes.get(language) ?? null;
      if (!entry) nameless.push(repo);
      return {
        treebank: repo,
        language,
        // UD's registry assigns both; iso3 is what the atlas resolves on. Null
        // when the registry does not carry the name — recorded, never guessed.
        lcode: entry?.lcode ?? null,
        iso3: entry?.iso3 ?? null,
        ...swept.results[repo],
      };
    });

  let unsized = 0;
  for (const r of rows) if (r.sentences === null) unsized++;

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  fs.writeFileSync(dest, `${JSON.stringify({
    release: version,
    date: release.date ?? null,
    treebanks: rows,
  }, null, 0)}\n`);

  const fetchedAt = new Date().toISOString();
  writeSnapshot(dir, {
    source,
    upstream: `${AUTOMATION}/valdan/releases.json`,
    license: 'LicenseRef-UD-Per-Treebank',
    licenseUrl: 'https://universaldependencies.org/',
    citation: `Universal Dependencies ${version} treebank catalogue `
      + `(Zeman et al., LINDAT/CLARIAH-CZ), release metadata retrieved ${fetchedAt.slice(0, 10)}.`,
    // The release number IS the pin: every count was read at the immutable
    // r<version> tag, so the artifact names one frozen state of UD, not
    // "whatever the org served today".
    pin: { kind: 'release', value: version, doi: null, date: release.date ?? null },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: `${AUTOMATION}/valdan/releases.json`,
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/ud-treebanks.mjs',
    notes:
      `UD release ${version} (${release.date ?? 'undated'}): ${treebanks.length} treebanks, `
      + `counts read from each repository's own stats.xml at the r${version} tag. METADATA `
      + 'ONLY: treebank name, language, and the maintainers\' sentence/token/word totals — '
      + 'no CoNLL-U file crosses the wire, which is what lets a treebank card exist under '
      + 'the rule that corpus CONTENT is never tracked. LICENCE is per treebank and NOT '
      + 'uniform: UD aggregates hundreds of independently licensed treebanks, so the source '
      + 'licence is a LicenseRef and each treebank\'s own terms must be resolved before its '
      + 'content is used for anything; the release/registry metadata itself (releases.json, '
      + 'codes_and_flags.yaml) is published by UD docs-automation under Apache-2.0. '
      + 'LANGUAGE CODES are UD\'s own iso3 assignments from codes_and_flags.yaml, never '
      + `inferred from display names — ${nameless.length} treebank(s) name a language the `
      + `registry does not carry${nameless.length
        ? ` (${nameless.slice(0, 6).join(', ')}${nameless.length > 6 ? ', …' : ''}), recorded `
          + 'with a null code rather than a guessed one'
        : ''}. `
      + `UNPUBLISHED COUNTS: ${unsized} treebank(s) publish no sentence total; stored as `
      + 'null, never 0 — "not published" and "measured, and empty" are different facts.'
      + (unreachable.length
        ? ` INCOMPLETE: ${unreachable.length} treebank(s) could not be fetched and are NAMED `
          + `rather than merely counted — ${unreachable.slice(0, 10).join(', ')}`
          + `${unreachable.length > 10 ? ', …' : ''}. Their absence is a fetch gap, NOT `
          + 'evidence they are not in the release. Re-running resumes and asks only for these.'
        : ' COMPLETE: every treebank in the release answered.'),
    releaseVersion: version,
    treebanks: rows.length,
    treebanksWithoutCounts: unsized,
    treebanksWithoutRegistryCode: nameless,
    complete: swept.complete,
    unreachableTreebanks: unreachable,
  });

  // Only on a clean sweep — a kept journal is what lets the next run ask for
  // the missing treebanks instead of all of them again.
  if (swept.complete) clearJournal(dir);

  return {
    verified: true,
    files: 1,
    release: version,
    treebanks: rows.length,
    unreachable: unreachable.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
