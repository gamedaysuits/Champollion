/**
 * opus-corpora.test.js — the corpus subject, and the three ways it goes wrong.
 *
 * Corpora are the third subject on the one pathway, and they are the one where
 * a plausible-looking mistake produces a number nobody would question:
 *
 *   1. OPUS returns one row per (pair × build format). Counting rows instead of
 *      pairs multiplies every total by however many archives the publisher
 *      chose to build — eight for GlobalVoices — and the result still looks
 *      like a corpus size.
 *   2. A language in a 49-language corpus is in up to 48 pairs. Writing each as
 *      its own value puts 48 rows under one (subject, parameter, variant) key,
 *      which the projector reads as forty-eight sources disagreeing.
 *   3. Sizes are the publisher's; anything summed across pairs is ours. Writing
 *      our arithmetic under OPUS's name is the provenance failure this rebuild
 *      exists to end.
 *
 * These hold all three, plus the rule that a corpus attests a language only
 * through a pair.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');

describe('the fetcher dedupes on the pair, not the archive', () => {
  const src = fs.readFileSync(
    path.join(REPO, 'cli/scripts/fetchers/opus-corpora.mjs'), 'utf-8',
  );

  test('the query filters to one build format', () => {
    assert.match(
      src, /preprocessing=moses/,
      'Unfiltered, OPUS returns a row per (pair × build format) — 5,355 for '
      + "GlobalVoices's 854 pairs. Without the filter every corpus total is "
      + 'multiplied by a packaging choice.',
    );
  });

  test('an empty filtered response falls back rather than recording zero', () => {
    // moses is a build format, not a guarantee. A collection that ships only
    // tmx must not be pinned as a corpus with no pairs — "publishes no moses
    // archive" and "has no language pairs" are different facts.
    assert.match(src, /if \(!rows\.length\)/, 'no fallback when the moses build is absent');
    assert.match(src, /seen\.add\(k\)/, 'the fallback must dedupe on (source, target)');
  });

  test('a corpus that cannot be reached aborts the whole sweep', () => {
    assert.match(
      src, /failed after \$\{attempts\} attempts/,
      'A pin short by the corpora that happened to time out asserts those corpora '
      + 'do not exist. Unreachable and absent must not produce the same artifact.',
    );
  });
});

describe('the handler folds pairs and stamps its own arithmetic', () => {
  let ingestOpusCorpora; let values; let VARIANT;

  before(async () => {
    ({ ingestOpusCorpora } = await import('../scripts/cldf/ingest-opus-corpora.mjs'));
    values = await import('../scripts/cldf/values.mjs');
    ({ VARIANT } = values);
  });

  test('the edge parameter is variant-discriminated by corpus', () => {
    // Without a variant every corpus a language appears in collapses onto one
    // key and the projector reports them as competing claims about the same
    // thing. They are different corpora, not a dispute.
    const src = fs.readFileSync(
      path.join(REPO, 'cli/scripts/cldf/ingest-opus-corpora.mjs'), 'utf-8',
    );
    assert.match(src, /variantType: VARIANT\.CORPUS/);
    assert.ok(VARIANT.CORPUS, 'the value layer must know a corpus discriminator');
  });

  test('one value per language-corpus, never one per pair', () => {
    const src = fs.readFileSync(
      path.join(REPO, 'cli/scripts/cldf/ingest-opus-corpora.mjs'), 'utf-8',
    );
    // The fold is what keeps 48 pairs from becoming 48 disagreeing values.
    assert.match(src, /byLanguage/, 'pairs must be folded per language before writing');
    assert.match(src, /for \(const \[languageId, e\] of byLanguage\)/);
  });

  test('summed totals are champollion-derived, per-pair counts are not', () => {
    const src = fs.readFileSync(
      path.join(REPO, 'cli/scripts/cldf/ingest-opus-corpora.mjs'), 'utf-8',
    );
    // The corpus-level counts we compute go under the derivation source; the
    // attestation edge reports OPUS's own per-pair numbers under OPUS.
    assert.match(src, /sourceId: derivedSource[\s\S]{0,120}subjectType: SUBJECT\.CORPUS/);
    // Matched on the binding rather than on the comment prose: an assertion
    // that only holds a sentence in place breaks the moment the sentence is
    // improved, which teaches the next person to loosen the test.
    assert.match(src, /sourceId: upstream\.id[\s\S]{0,80}\n\s*\}\);/);
    assert.match(src, /the total is champollion-derived/);
  });
});

describe('the parameters are declared for the right subject', () => {
  let rows;

  before(async () => {
    const { parseCSVObjects } = await import('../scripts/lib/csv.mjs');
    ({ rows } = parseCSVObjects(
      fs.readFileSync(path.join(REPO, 'shared/cldf/parameters.csv'), 'utf-8'),
      { file: 'parameters.csv' },
    ));
  });

  test('corpus facts are Subject=corpus and the attestation edge is Subject=language', () => {
    const by = new Map(rows.map((r) => [r.ID, r]));
    for (const id of ['corpusPairCount', 'corpusLanguageCount', 'corpusAlignmentPairs']) {
      assert.equal(by.get(id)?.Subject, 'corpus', `${id} must be a fact about the corpus`);
    }
    // The edge belongs to the LANGUAGE. A corpus attesting a language is a fact
    // you look up from the language side; putting it on the corpus would mean
    // the atlas could not answer "what data exists for Plains Cree" without
    // scanning every corpus.
    assert.equal(by.get('corpusResource')?.Subject, 'language');
  });

  test('every counted corpus parameter is attributed to us, not to OPUS', () => {
    const by = new Map(rows.map((r) => [r.ID, r]));
    for (const id of ['corpusPairCount', 'corpusLanguageCount', 'corpusAlignmentPairs']) {
      const p = by.get(id);
      assert.equal(
        p?.Sources, 'champollion-derived',
        `${id} is counted by us over the fetched index. Recording it under OPUS's `
        + 'name would state that OPUS asserts our arithmetic.',
      );
      assert.equal(p?.Projection_Rule, 'derived', `${id} must project as derived`);
    }
    // The attestation edge is the other way round: the pair and its per-pair
    // counts are OPUS's own, so the edge is attributed to OPUS. Only the total
    // summed across pairs is ours, and that is stamped on the value's comment.
    assert.equal(by.get('corpusResource')?.Sources, 'opus-corpora');
  });
});

describe('nothing here implies permission', () => {
  test('the declared licence is a LicenseRef, not a resolved SPDX', async () => {
    // Read from the fetcher's own declaration — the one home this entry moved
    // to. Reading the JSON here would test a file the build no longer consults
    // for this source.
    const { manifest } = await import('../scripts/fetchers/opus-corpora.mjs');
    assert.ok(manifest, 'opus-corpora must declare a manifest in its fetcher');
    assert.match(
      manifest.license, /^LicenseRef-/,
      'OPUS aggregates hundreds of independently licensed collections. A single '
      + "resolved SPDX here would grant, by omission, permission the collections' "
      + 'own rights-holders never gave.',
    );
  });

  test('the handler asserts existence and size, and no capability', () => {
    const src = fs.readFileSync(
      path.join(REPO, 'cli/scripts/cldf/ingest-opus-corpora.mjs'), 'utf-8',
    );
    // Quality is a run result. A corpus card claiming clean alignment would be
    // the card-boundary violation the lint rules exist to catch, arriving
    // through the one door that had no lint rule yet.
    for (const forbidden of ['quality', 'clean', 'usable']) {
      assert.ok(
        !new RegExp(`'[^']*\\b${forbidden}\\b[^']*'\\s*[,)]`).test(src)
        || src.includes('never that'),
        `the handler must not assert ${forbidden}`,
      );
    }
    assert.match(src, /Existence and size, never quality/);
  });
});

describe('an unpublished size is not a zero, and a self-pair is not a pair', () => {
  const fetcher = fs.readFileSync(
    path.join(REPO, 'cli/scripts/fetchers/opus-corpora.mjs'), 'utf-8',
  );
  const handler = fs.readFileSync(
    path.join(REPO, 'cli/scripts/cldf/ingest-opus-corpora.mjs'), 'utf-8',
  );

  test('the fetcher does not use ?? to normalise counts', () => {
    // OPUS sends an EMPTY STRING for an unpublished count — 24,934 of 128,015
    // pairs. An empty string is not nullish, so `?? 0` lets it through into
    // arithmetic, where `0 + '' + 42` produced the literal total "042". The
    // bug was invisible because the result still looked like a number.
    assert.ok(
      !/alignmentPairs: x\.alignment_pairs \?\?/.test(fetcher),
      '`??` does not catch the empty string OPUS actually sends',
    );
    assert.match(fetcher, /alignmentPairs: num\(x\.alignment_pairs\)/);
  });

  test('a non-numeric count is a schema change, not a zero', () => {
    assert.match(
      fetcher, /non-numeric count/,
      'guessing a number for an unparseable count would put a fabricated size on a card',
    );
  });

  test('totals are summed only over pairs that published a size', () => {
    assert.match(handler, /const sized = real\.filter\(\(r\) => r\.alignmentPairs !== null\)/);
    assert.match(
      handler, /alignmentPairsTotal: e\.sized \? e\.total : null/,
      'null where nothing published a size — "unmeasured" must not render as "empty"',
    );
  });

  test('a corpus with no published sizes asserts no total at all', () => {
    // A total of 0 over zero measured pairs is not a small corpus. Ubuntu has
    // 23,988 pairs and publishes no counts for any of them.
    assert.match(handler, /if \(sized\.length && onCorpus\(corpusId, 'corpusAlignmentPairs'/);
  });

  test('self-pairs are excluded from coverage and counted', () => {
    // Tatoeba publishes crk-crk. Folded in, it made Plains Cree appear paired
    // with itself and inflated the corpus to four pairs where it has two.
    assert.match(handler, /const real = rows\.filter\(\(r\) => r\.source !== r\.target\)/);
    assert.match(handler, /stats\.selfPairs \+= rows\.length - real\.length/);
  });

  test('a corpus that is only self-pairs becomes no node', () => {
    assert.match(handler, /if \(!real\.length\)[\s\S]{0,400}stats\.emptyCorpora\+\+/);
  });

  test('unsized partners sort last rather than as zero', () => {
    assert.match(
      handler, /\(b\.alignmentPairs \?\? -1\) - \(a\.alignmentPairs \?\? -1\)/,
      'ordering an unknown size below a measured 1 implies we know it is smaller',
    );
  });
});
