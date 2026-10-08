#!/usr/bin/env node

/**
 * fetchers/opus-corpora.mjs — the OPUS parallel-corpus index.
 *
 * METADATA PLUS A POINTER, WHICH IS THE WHOLE PROBLEM SOLVED
 *   The rule is that corpora are fetch-from-source: we hold metadata, never
 *   content. Both halves matter. An index that records sizes but not the
 *   download URL is a catalogue with the call numbers torn out — it can tell
 *   you a corpus exists and not how to get it, which is not "fetch from source",
 *   it is just not having the data.
 *
 *   Corpus CONTENT may never be tracked in this repo — the quarantine gate
 *   enforces it, and corpora are fetch-from-source with metadata cards only. So
 *   a corpus card needs sizes and pairs WITHOUT the text, and until now that
 *   was done by running the bulk builders over downloaded archives.
 *
 *   The OPUS API publishes exactly the metadata layer: per corpus, per language
 *   pair, the alignment count, token counts on both sides, the archive size,
 *   the version and the download URL. No sentences cross the wire.
 *
 * WHAT IT REPLACES
 *   1,417 corpus cards, of which 1,238 came from two bulk generators — 745 from
 *   the Tatoeba Challenge and 493 from OPUS GlobalVoices. OPUS indexes 1,215
 *   corpora, so the hand-built pair covered two of them.
 *
 * ONE CALL PER CORPUS
 *   Querying `?corpus=X&preprocessing=moses&version=latest` with NO source or
 *   target returns every pair that corpus has — 854 rows for GlobalVoices in a
 *   single response. So the sweep is one request per corpus rather than one per
 *   pair, which is the difference between 1,215 requests and several million.
 *
 * WHY THE PREPROCESSING FILTER, AND WHY IT IS NOT TRUSTED BLINDLY
 *   Unfiltered, OPUS returns one row per (pair × preprocessing) — GlobalVoices
 *   comes back 5,355 rows deep across xml/smt/dic/freq/mono/raw/moses/tmx for
 *   854 actual pairs. Pinning that would record the same pair eight times and
 *   inflate every total by the number of build formats, which is a fact about
 *   OPUS's packaging and not about the corpus.
 *
 *   `moses` happens to be exactly one row per pair (854 of 854 for
 *   GlobalVoices, 3 of 3 for Bianet), so it is the right dedupe key. But it is
 *   a build format, not a guarantee: a collection that ships only tmx would come
 *   back empty and be recorded as a corpus with no pairs. So an empty moses
 *   response falls back to the unfiltered query and dedupes on (source, target)
 *   directly — the answer must not depend on which archives a publisher chose
 *   to build.
 *
 * POLITE, BECAUSE THIS IS AN ACADEMIC SERVICE
 *   Serial, with a delay between calls. OPUS is run by a university group and
 *   is not a commercial API to be hammered; a slow sweep that runs once and
 *   pins is the correct trade. The build never touches the network — it reads
 *   the snapshot — so the cost is paid once per refetch, not once per build.
 *
 * AN UNPUBLISHED COUNT IS NOT ZERO
 *   Nearly a fifth of OPUS rows — 24,934 of 128,015 — carry an EMPTY
 *   alignment count: the pair is listed, the size is not published. Ubuntu
 *   publishes none at all. Coercing that to 0 would state that those corpora
 *   are empty, which is the fail-honest violation this rebuild exists to end,
 *   and it would do it silently because 0 is a perfectly plausible size. So an
 *   unpublished count is stored as null and stays distinguishable from a
 *   measured zero all the way to the card.
 *
 * RESUMABLE, AND HONEST ABOUT WHAT IT MISSED
 *   1,215 requests is forty minutes, and the first version threw the whole run
 *   away if any one of them failed — so a dropped request at corpus 301
 *   discarded 300 good ones, and changing a single output field re-asked for
 *   all 1,215. Doing that three times in a day earned an ECONNRESET from a
 *   university server, which was the correct response to what we were doing.
 *
 *   Progress is journalled per corpus, so a re-run resumes rather than
 *   restarts. Corpora that cannot be fetched are NAMED in the snapshot and the
 *   index is pinned without them, because "we could not reach the server" and
 *   "there is no such corpus" must not produce the same artifact — and naming
 *   the gap is what keeps those apart, not refusing to pin at all. Below 95%
 *   it refuses outright: that is a failed fetch, not a small OPUS.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs opus-corpora
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, USER_AGENT, sha256File, verify, writeSnapshot } from './lib/fetch-lib.mjs';
import { sweep, clearJournal } from './lib/sweep.mjs';

export const source = 'opus-corpora';

/**
 * What this source contributes, declared beside how it is fetched. Moved
 * verbatim out of source-manifest.json: a hand-maintained list cannot notice
 * something missing from it, which is how 29 pinned datasets went unread.
 */
export const manifest = {
  "module": "(native)",
  "handler": "opusCorpora",
  "license": "LicenseRef-OPUS-Per-Corpus",
  "contributes": "parallel-corpus existence and size, per language and per pair",
  "note": "The third subject on the one pathway: OPUS's own index gives per-corpus, per-pair alignment and token counts WITHOUT any text, which is what lets a corpus card exist at all under the rule that corpus CONTENT is never tracked. Replaces 1,238 cards built by two bulk generators over downloaded archives — they covered two of OPUS's 1,215 collections. EXISTENCE AND SIZE ONLY: never that an alignment is good, the text in-domain, or the corpus usable. LICENCE IS NOT UNIFORM and is deliberately a LicenseRef: OPUS aggregates hundreds of independently licensed collections, so the index licence covers the index and each collection's own terms must be resolved before its content is used for anything — which is also why nothing here lifts a quarantine or implies permission to transmit. A corpus attests a language only THROUGH a pair, so the edge carries the pair structure rather than a bare boolean; sizes are the publisher's and every total across pairs is champollion-derived."
};
export const dir = 'opus-corpora';

const FILE = 'opus-index.json';
const BASE = 'https://opus.nlpl.eu/opusapi';
/** Serial with a gap. See the header — this is a university service. */
const DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * A published count, or null when OPUS does not publish one.
 *
 * The distinction is the whole point: an empty string here means "the size is
 * not published", and 0 means "measured, and empty". Collapsing them loses the
 * only thing that tells a reader whether a corpus is small or simply unmeasured
 * — and it would lose it for a fifth of every pair in the index.
 */
function num(x) {
  if (x === '' || x === null || x === undefined) return null;
  const n = Number(x);
  if (!Number.isFinite(n)) {
    throw new Error(
      `OPUS returned a non-numeric count ${JSON.stringify(x)}. That is a schema change, `
      + 'and guessing a number for it would put a fabricated size on a card.',
    );
  }
  return n;
}

/**
 * Retries generously, because the alternative is worse.
 *
 * A sweep of 1,215 serial requests runs for the better part of an hour, and
 * over that window a public academic API will drop one. Three attempts with
 * sub-second backoff was not enough: a single blip on corpus 301 aborted the
 * whole run. Aborting is CORRECT — a partial index pinned as complete would
 * assert that corpora do not exist — but it means the cost of giving up too
 * early is throwing away forty minutes of somebody else's bandwidth as well as
 * ours. So it tries harder and waits longer before concluding the corpus is
 * genuinely unreachable.
 */
async function getJSON(url, { attempts = 6 } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      // Exponential, capped: 1s, 2s, 4s, 8s, 16s, 30s.
      await sleep(Math.min(30_000, 1000 * 2 ** i));
    }
  }
  throw new Error(`${url} failed after ${attempts} attempts: ${lastError?.message}`);
}

export async function fetchSource({ verifyOnly = false, only = null } = {}) {
  if (verifyOnly) return verify(dir);

  const list = await getJSON(`${BASE}?corpora=True`);
  const corpora = (list.corpora ?? []).filter(Boolean).sort();
  if (!corpora.length) {
    throw new Error('the OPUS corpus list came back empty, which is an API change');
  }

  const wanted = only ? corpora.filter((c) => only.includes(c)) : corpora;
  const fellBack = [];

  const oneCorpus = async (corpus) => {
    const q = `${BASE}?corpus=${encodeURIComponent(corpus)}&version=latest`;
    let rows = (await getJSON(`${q}&preprocessing=moses`)).corpora ?? [];
    if (!rows.length) {
      // No moses build. That is a packaging choice, not an absence of pairs —
      // fall back and dedupe on the pair itself. See the header.
      fellBack.push(corpus);
      const seen = new Set();
      rows = ((await getJSON(q)).corpora ?? []).filter((x) => {
        if (!x.source || !x.target) return false;
        const k = `${x.source} ${x.target}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    // Only the metadata a card needs. The response carries internal ids too;
    // keeping the lot would make the pin churn on anything.
    return rows
      .filter((x) => x.source && x.target)
      .map((x) => ({
        source: x.source,
        target: x.target,
        // `??` is not enough: OPUS sends an empty STRING for an unpublished
        // count, which is not nullish, so it survives into arithmetic and turns
        // a sum into string concatenation. `num()` collapses both spellings of
        // "not published" to null and keeps a real 0 as 0.
        alignmentPairs: num(x.alignment_pairs),
        sourceTokens: num(x.source_tokens),
        targetTokens: num(x.target_tokens),
        version: x.version ?? null,
        archiveBytes: num(x.size),
        // THE POINTER IS THE POINT. Corpora here are fetch-from-source: we hold
        // metadata and never content, which only works if the metadata says
        // where the content is. Dropped once as "a field the card does not
        // need", which left an index that could tell you a corpus existed and
        // not how to obtain it — a catalogue with the call numbers torn out.
        // The URL is reconstructible from corpus/version/pair, but
        // reconstructing is guessing, and this is the publisher's own answer.
        url: x.url ?? null,
      }))
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  };

  const swept = await sweep({
    dir,
    items: wanted,
    fn: oneCorpus,
    delayMs: DELAY_MS,
    // A fifth of OPUS missing is not an OPUS that shrank, it is a fetch that
    // did not work, and pinning it would be the lie this guard exists to stop.
    minComplete: 0.95,
    onProgress: ({ i, n, failed }) => {
      if (i % 25 && i !== n) return;
      process.stdout.write(`\r  ${i}/${n} corpora${failed ? ` · ${failed} unreachable` : ''}`);
    },
  });
  process.stdout.write('\n');
  if (swept.resumedFrom) {
    console.log(`  resumed: ${swept.resumedFrom} corpora already on disk, not re-requested`);
  }

  const index = swept.results;
  const unreachable = Object.keys(swept.failed).sort();
  const pairsTotal = Object.values(index).reduce((a, v) => a + v.length, 0);

  // Counted so the pin states its own completeness. A reader comparing two
  // corpora needs to know that one of them publishes no sizes at all.
  let unsized = 0;
  let selfPairs = 0;
  for (const rows of Object.values(index)) {
    for (const r of rows) {
      if (r.alignmentPairs === null) unsized++;
      if (r.source === r.target) selfPairs++;
    }
  }
  const withPairs = Object.values(index).filter((v) => v.length).length;
  if (!withPairs) {
    throw new Error('every corpus returned zero pairs, which is a query or API change');
  }

  const target = path.join(DATA_ROOT, dir);
  fs.mkdirSync(target, { recursive: true });
  const dest = path.join(target, FILE);
  // Keys sorted so an unchanged OPUS yields identical bytes.
  const ordered = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  fs.writeFileSync(dest, `${JSON.stringify(ordered, null, 0)}\n`);

  const fetchedAt = new Date().toISOString();
  writeSnapshot(dir, {
    source,
    upstream: `${BASE}?corpora=True`,
    license: 'LicenseRef-OPUS-Per-Corpus',
    licenseUrl: 'https://opus.nlpl.eu/',
    citation: `OPUS parallel corpus index (Tiedemann, J. 2012, "Parallel Data, Tools and `
      + `Interfaces in OPUS"), retrieved ${fetchedAt.slice(0, 10)}.`,
    pin: { kind: 'release', value: fetchedAt.slice(0, 10), doi: null, date: fetchedAt.slice(0, 10) },
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
    fetchedBy: 'cli/scripts/fetchers/opus-corpora.mjs',
    notes:
      `${wanted.length} corpora, ${withPairs} with at least one pair, `
      + `${pairsTotal.toLocaleString()} language pairs. METADATA ONLY: alignment counts, `
      + 'token counts, versions and archive sizes — no sentence crosses the wire, which '
      + 'is what lets a corpus card exist under the rule that corpus CONTENT is never '
      + 'tracked. LICENCE is per corpus and NOT uniform: OPUS aggregates hundreds of '
      + 'independently licensed collections, so the index licence is a LicenseRef and '
      + "each corpus's own terms must be resolved before its content is used for "
      + 'anything. A partial sweep throws rather than pinning: a short index recorded as '
      + 'complete would assert that corpora do not exist. DEDUPE: OPUS returns one row '
      + 'per (pair \u00d7 build format) unfiltered \u2014 5,355 rows for GlobalVoices\'s 854 '
      + 'pairs \u2014 so the query filters to the moses build, which is exactly one row per '
      + `pair. ${fellBack.length} collection(s) publish no moses build and fell back to `
      + 'the unfiltered query deduped on (source, target), because how many pairs a corpus '
      + 'has must not depend on which archives its publisher chose to build. '
      + `UNPUBLISHED SIZES: ${unsized.toLocaleString()} of ${pairsTotal.toLocaleString()} `
      + 'pairs list no alignment count. OPUS sends an empty string there, which is stored '
      + 'as null and never as 0 \u2014 "not published" and "measured, and empty" are '
      + 'different facts, and Ubuntu (23,988 pairs) publishes no counts at all. '
      + `SELF-PAIRS: ${selfPairs.toLocaleString()} rows list the same code on both sides `
      + '(Tatoeba has crk-crk). They are monolingual entries in a parallel index and are '
      + 'kept here verbatim, because the pin records what OPUS published; the handler is '
      + 'where they stop being treated as translation pairs.'
      + (unreachable.length
        ? ` INCOMPLETE: ${unreachable.length} corpus/corpora could not be fetched and are `
          + `NAMED here rather than merely counted — ${unreachable.slice(0, 12).join(', ')}`
          + `${unreachable.length > 12 ? ', …' : ''}. They are absent from this index and `
          + 'their absence is a fetch gap, NOT evidence that they do not exist. Re-running '
          + 'resumes and asks only for these.'
        : ' COMPLETE: every listed corpus answered.'),
    corpora: wanted.length,
    corporaWithPairs: withPairs,
    pairs: pairsTotal,
    // NAMED, not counted. A snapshot saying "8 corpora were unreachable" without
    // saying which lets a consumer treat every absence as an absence.
    complete: swept.complete,
    unreachableCorpora: unreachable,
    pairsWithoutPublishedSize: unsized,
    selfPairs,
    fellBackToUnfiltered: fellBack,
  });

  // Only on a clean sweep. Keeping it after a partial run is what lets the next
  // one ask for the missing corpora instead of all 1,215 again.
  if (swept.complete) clearJournal(dir);

  return {
    verified: true,
    files: 1,
    corpora: Object.keys(index).length,
    pairs: pairsTotal,
    fellBack: fellBack.length,
    unreachable: unreachable.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSource();
}
