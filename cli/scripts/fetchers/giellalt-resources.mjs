#!/usr/bin/env node

/**
 * fetchers/giellalt-resources.mjs — the GiellaLT/ALTLab language-resource catalogue.
 *
 * WHAT IT REPLACES
 *   `cli/shared/curated-fsts.json` listed FOUR languages by hand, and
 *   `curated-dictionary-flags.json` one dictionary. Both organisations publish
 *   their resources as public repositories under strict naming conventions, so
 *   the catalogue is fetchable and the hand-written files were a dozen entries
 *   standing in for four hundred and fifty.
 *
 * FIVE CONVENTIONS, NOT ONE
 *   This started as a `lang-*` sweep for analysers, which turned out to be a
 *   THIRD of the language-keyed catalogue. Across the two organisations:
 *
 *     lang-<iso>              158  morphological analysers
 *     dict-<src>-<tgt>        109  bilingual dictionaries
 *     corpus-<iso>[-orig]     107  corpora
 *     keyboard-<iso>           78  keyboard layouts
 *     speech-<iso>              4  speech resources
 *
 *   Reading one prefix and calling it the catalogue is the same under-count as
 *   the hand-written file it replaced, one level up. All five are swept, and
 *   each carries its KIND so a consumer never has to infer it from a name.
 *
 * WHY THESE PARTICULAR RESOURCES MATTER HERE
 *   The catalogue is overwhelmingly Sámi, Inuit, Uralic and North American —
 *   the constituency this project exists for. For a polysynthetic language an
 *   FST is often the only structural check that exists; a keyboard layout is
 *   frequently the difference between a language being typable at all and not;
 *   and a bilingual dictionary (chr-eng, crk-eng) is the resource a translator
 *   reaches for first. None of it was indexed.
 *
 * DICTIONARIES ARE BILINGUAL, AND DIRECTED
 *   `dict-sme-nob` and `dict-nob-sme` are both published — two directions, two
 *   repositories, and they are not interchangeable. Both codes are recorded and
 *   the direction is kept, because a dictionary that only goes one way is a
 *   different resource from one that goes the other.
 *
 * EXISTENCE, NEVER CAPABILITY
 *   That a repository exists, who publishes it, its licence, whether it is
 *   archived. Never that it compiles, covers the grammar, or is accurate —
 *   those are measured claims about output, and the card-boundary rule permits
 *   resource existence and forbids performance. An entry implying an untested
 *   analyser works would be the more damaging error.
 *
 * LICENCE, AND WHY IT IS RECORDED PER REPOSITORY
 *   The catalogue is not uniform, and this project's own boundary forbids
 *   bundling GPL/AGPL code into proprietary CLI paths. So the licence travels
 *   with each entry rather than being assumed across the catalogue — and where
 *   GitHub cannot identify one, that state is recorded rather than nulled,
 *   because a null reads as "no restrictions" when it means "nobody could tell".
 *
 * DUPLICATE CODES ARE NOT COLLAPSED
 *   Blackfoot (bla), Plains Cree (crk) and Stoney (sto) have analysers from
 *   BOTH organisations — two independent implementations each. CLAUDE.md refers
 *   to "the GiellaLT/ALTLab Cree FST" as though it were one thing. Recording
 *   the publisher keeps them apart; without it the second silently overwrites
 *   the first and the card claims one analyser where two exist.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs giellalt-resources
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';

export const source = 'giellalt-resources';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "giellaltResources",
  "license": "LicenseRef-GitHub-Repository-Metadata",
  "contributes": "analyser, dictionary, corpus, keyboard and speech resource existence, per language, per publisher",
  "note": "452 language-keyed repositories swept from BOTH GiellaLT and UAlbertaALTLab: 158 analysers, 109 dictionaries, 103 corpora, 78 keyboard layouts, 4 speech resources. Replaces cli/shared/curated-fsts.json (FOUR languages by hand) and the dictionary half of curated-dictionary-flags.json. FIVE CONVENTIONS, NOT ONE: an earlier version read lang-* only, which was a THIRD of the catalogue — dictionaries, corpora, keyboards and speech were all invisible, and reading one prefix and calling it the catalogue is the same under-count as the hand-written file it replaced, one level up. The catalogue is overwhelmingly Sámi, Inuit, Uralic and North American, which is the constituency this project exists for: for a polysynthetic language an FST is often the only structural check there is, and a keyboard layout is frequently the difference between a language being typable at all and not. EXISTENCE ONLY: never that a resource compiles, covers a grammar, or is accurate. DICTIONARIES ARE BILINGUAL AND DIRECTED — dict-crk-eng is a fact about Plains Cree AND English, and dict-sme-nob and dict-nob-sme are separately published and not interchangeable. PUBLISHER is part of the identity: bla, crk and sto have analysers from both organisations, two independent implementations each. Licence is recorded PER REPOSITORY because the catalogue is not uniform and copyleft must never reach a proprietary CLI path, while 184 carry terms GitHub cannot identify — including most Indigenous North American entries, where no permission is inferred."
};
export const dir = 'giellalt-resources';

const FILE = 'resources.json';

/**
 * Both organisations use the same conventions, so both can be swept the same
 * way — and they overlap, which is the point of recording the publisher.
 */
const ORGS = ['giellalt', 'UAlbertaALTLab'];
const api = (org) => `https://api.github.com/orgs/${org}/repos?per_page=100&type=public`;

/**
 * A language subtag as these catalogues write it: two or three letters,
 * optionally script-qualified (`urj-Cyrl`) or private-use-qualified
 * (`est-x-plamk`). The private-use form is a real BCP 47 construction that
 * GiellaLT uses for variants it will not claim an ISO code for, and it is kept
 * whole so the resolver can report it as private-use rather than silently
 * truncating it to the base language.
 */
const CODE = '[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-x-[a-z0-9-]+)?';

/**
 * The five conventions, declared rather than sniffed. `arity` says how many
 * languages a repository is ABOUT: a dictionary is bilingual and directed, and
 * treating it as monolingual would drop half of every entry.
 */
const CONVENTIONS = [
  {
    kind: 'analyser',
    prefix: 'lang',
    arity: 1,
    re: new RegExp(`^lang-(${CODE})$`),
    what: 'finite-state morphological analyser',
  },
  {
    kind: 'dictionary',
    prefix: 'dict',
    arity: 2,
    re: new RegExp(`^dict-(${CODE})-(${CODE})$`),
    what: 'bilingual dictionary, directed source → target',
  },
  {
    // `-orig` marks the unconverted original alongside the processed build. It
    // is the same corpus in a different state, not a different language, so the
    // suffix is stripped into a flag rather than becoming part of the code.
    kind: 'corpus',
    prefix: 'corpus',
    arity: 1,
    re: new RegExp(`^corpus-(${CODE})(-orig)?$`),
    what: 'corpus',
  },
  {
    kind: 'keyboard',
    prefix: 'keyboard',
    arity: 1,
    re: new RegExp(`^keyboard-(${CODE})$`),
    what: 'keyboard layout',
  },
  {
    kind: 'speech',
    prefix: 'speech',
    arity: 1,
    re: new RegExp(`^speech-(${CODE})$`),
    what: 'speech resource',
  },
];

/** @returns {{kind: string, codes: string[], original: boolean}|null} */
function classify(name) {
  for (const c of CONVENTIONS) {
    const m = c.re.exec(name);
    if (!m) continue;
    if (c.kind === 'corpus') {
      return { kind: c.kind, codes: [m[1]], original: Boolean(m[2]) };
    }
    return { kind: c.kind, codes: m.slice(1, 1 + c.arity), original: false };
  }
  return null;
}

export async function fetchSource({ verifyOnly = false, maxPages = 20 } = {}) {
  if (verifyOnly) return verify(dir);

  const repos = [];
  for (const org of ORGS) {
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch(`${api(org)}&page=${page}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 403) {
        throw new Error(
          'GitHub returned 403 — the unauthenticated API allows 60 requests an hour. '
          + 'This is a rate limit, not an empty catalogue, and pinning a short list here '
          + 'would record a fetch failure as a fact about what these organisations publish.',
        );
      }
      if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} on ${org} page ${page}`);
      const batch = await res.json();
      if (!Array.isArray(batch) || !batch.length) break;
      for (const r of batch) repos.push({ ...r, __org: org });
      process.stdout.write(`\r  ${org} page ${page}: ${repos.length} repositories`);
      if (batch.length < 100) break;
    }
  }
  process.stdout.write('\n');

  // Only what a resource claim needs. The API returns 40-odd fields per repo,
  // and collecting them all would make the pin churn on every star.
  const resources = repos
    .map((repo) => ({ c: classify(repo.name), repo }))
    .filter((x) => x.c)
    .map(({ c, repo }) => ({
      kind: c.kind,
      codes: c.codes,
      // Kept because it distinguishes the unconverted original from the
      // processed build of the same corpus — two repositories, one corpus.
      original: c.original,
      name: repo.name,
      // Two organisations publish a lang-crk. The publisher is part of the
      // identity, not decoration — without it the two collapse into one entry
      // and the card silently drops an independent analyser.
      publisher: repo.__org,
      url: repo.html_url,
      description: repo.description ?? null,
      license: repo.license?.spdx_id ?? null,
      archived: Boolean(repo.archived),
      updatedAt: repo.updated_at ?? null,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind)
      || a.codes.join('-').localeCompare(b.codes.join('-'))
      || a.publisher.localeCompare(b.publisher)
      || a.name.localeCompare(b.name));

  if (!resources.length) {
    throw new Error(
      `swept ${repos.length} repositories across ${ORGS.join(' and ')} and matched zero `
      + 'against any of the five naming conventions. Those conventions are what this '
      + 'fetcher reads; zero matches is a convention change or a truncated sweep, never '
      + 'organisations that publish no language resources.',
    );
  }

  const byKind = {};
  for (const r of resources) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  // Every convention must still match something. A prefix silently renamed
  // upstream would otherwise drop a whole resource class and look like a
  // catalogue that shrank.
  const missing = CONVENTIONS.filter((c) => !byKind[c.kind]).map((c) => `${c.prefix}-*`);
  if (missing.length) {
    throw new Error(
      `these conventions matched nothing: ${missing.join(', ')}. Each was present when `
      + 'this fetcher was written, so zero matches is a renamed prefix, not a resource '
      + 'class that ceased to exist — and dropping it silently would under-count the '
      + 'catalogue exactly as the hand-written file this replaces did.',
    );
  }

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  fs.writeFileSync(dest, `${JSON.stringify(resources, null, 0)}\n`);

  const licences = {};
  for (const r of resources) {
    const k = r.license ?? '(none declared)';
    licences[k] = (licences[k] ?? 0) + 1;
  }
  const archived = resources.filter((r) => r.archived).length;
  const unestablished = resources.filter(
    (r) => !r.license || r.license === 'NOASSERTION' || r.license === 'NONE',
  ).length;
  const fetchedAt = new Date().toISOString();

  writeSnapshot(dir, {
    source,
    upstream: ORGS.map(api).join(' ; '),
    license: 'LicenseRef-GitHub-Repository-Metadata',
    licenseUrl: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service',
    citation: 'GiellaLT and UAlbertaALTLab language-resource repositories, retrieved '
      + `${fetchedAt.slice(0, 10)}.`,
    pin: { kind: 'release', value: fetchedAt.slice(0, 10), doi: null, date: fetchedAt.slice(0, 10) },
    pinQuality: 'self-attested',
    files: [{
      path: FILE,
      bytes: fs.statSync(dest).size,
      sha256: sha256File(dest),
      url: ORGS.map(api).join(' ; '),
      upstreamChecksum: null,
      upstreamVerified: false,
    }],
    verified: true,
    fetchedBy: 'cli/scripts/fetchers/giellalt-resources.mjs',
    notes:
      `${resources.length} language-keyed repositories out of ${repos.length} public ones `
      + `across ${ORGS.join(' and ')}; ${archived} archived. By kind: `
      + `${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(', ')}. `
      + 'REPLACES cli/shared/curated-fsts.json (four languages by hand) and the dictionary '
      + 'half of curated-dictionary-flags.json. FIVE CONVENTIONS, not one: an earlier '
      + 'version of this fetcher read lang-* only, which was a THIRD of the catalogue — '
      + 'dictionaries, corpora, keyboards and speech resources were all invisible. '
      + 'EXISTENCE ONLY: that a repository exists, who publishes it, and whether it is '
      + 'archived — never that it compiles, covers a grammar, or is accurate, which would '
      + 'be claims about quality the card boundary forbids. DICTIONARIES ARE DIRECTED: '
      + 'dict-sme-nob and dict-nob-sme are both published and are not interchangeable. '
      + 'Licence is recorded PER REPOSITORY rather than assumed uniform, because the '
      + "project's own boundary forbids bundling GPL/AGPL code into proprietary CLI paths "
      + `and that decision needs the actual terms; ${unestablished} carry terms GitHub `
      + 'cannot identify, including most Indigenous North American entries, where no '
      + 'permission beyond pointing at them is inferred. PIN QUALITY: GitHub publishes no '
      + 'release for an org listing, so the snapshot is the pin.',
    resources: resources.length,
    byKind,
    archived,
    licenceUnestablished: unestablished,
    licences,
  });

  return { verified: true, files: 1, resources: resources.length, byKind, archived };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
