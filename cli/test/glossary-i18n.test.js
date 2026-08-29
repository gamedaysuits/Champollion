#!/usr/bin/env node
/**
 * Localized-glossary pipeline test suite.
 *
 * Covers the three stages that carry cli/shared/explainers/glossary.json
 * (English SSOT) into the 12 translated locales:
 *   1. buildGlossarySource — SSOT → flat Docusaurus Phase-1 source
 *      (website/i18n/en/glossary.json, translated by `champollion sync`).
 *   2. mergeGlossaryLocale — translated Phase-1 file merged back over the
 *      SSOT (per-field English fallback; canonical `term` preserved).
 *   3. explainerLoader.loadGlossary(locale) — runtime fetch of the merged
 *      artifact with English fallback.
 *
 * Run: node --test test/glossary-i18n.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  pipelineSlug,
  glossaryEntryKey,
  buildGlossarySource,
  mergeGlossaryLocale,
} = require('../website/plugins/shared-data/mergeGlossaryLocale.js');
const { generateGlossaryI18nSource } = await import(
  '../website/scripts/generate-glossary-i18n.mjs'
);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SSOT_FILE = path.join(HERE, '..', 'shared', 'explainers', 'glossary.json');

/** Small synthetic SSOT used by the merge tests. */
function syntheticSsot() {
  return {
    _meta: { description: 'test glossary' },
    terms: [
      {
        term: 'morpheme',
        also: ['morphemes'],
        plain: 'EN plain morpheme.',
        mt_relevance: 'EN mt morpheme.',
        citations: [{ source: 'SIL', url: 'https://example.org/morpheme' }],
        related: ['affix'],
      },
      {
        term: 'affix',
        also: [],
        plain: 'EN plain affix.',
        mt_relevance: 'EN mt affix.',
        example: 'EN example affix.',
        citations: [],
        related: ['morpheme'],
      },
    ],
  };
}

describe('pipelineSlug / glossaryEntryKey', () => {
  it('slugs deterministically and web-safely', () => {
    assert.equal(pipelineSlug('noun incorporation'), 'noun-incorporation');
    assert.equal(pipelineSlug('root-and-pattern morphology'), 'root-and-pattern-morphology');
    assert.equal(pipelineSlug('Ejectives (glottalized consonants)'), 'ejectives-glottalized-consonants');
    assert.equal(glossaryEntryKey('morpheme', 'plain'), 'glossary.morpheme.plain');
  });

  it('produces unique slugs across the real SSOT', () => {
    const ssot = JSON.parse(fs.readFileSync(SSOT_FILE, 'utf-8'));
    const slugs = ssot.terms.map((t) => pipelineSlug(t.term));
    assert.equal(new Set(slugs).size, slugs.length, 'pipeline slugs must be unique');
  });
});

describe('buildGlossarySource', () => {
  it('flattens every display field of the real SSOT with translator context', () => {
    const ssot = JSON.parse(fs.readFileSync(SSOT_FILE, 'utf-8'));
    const source = buildGlossarySource(ssot);

    for (const entry of ssot.terms) {
      const slug = pipelineSlug(entry.term);
      for (const field of ['term', 'plain', 'mt_relevance']) {
        const key = glossaryEntryKey(slug, field);
        assert.ok(source[key], `missing ${key}`);
        assert.equal(source[key].message, entry[field]);
        assert.ok(
          source[key].description.includes(`"${entry.term}"`),
          `description of ${key} must name the term`
        );
      }
      const exampleKey = glossaryEntryKey(slug, 'example');
      if (typeof entry.example === 'string' && entry.example.length > 0) {
        assert.equal(source[exampleKey].message, entry.example);
      } else {
        assert.ok(!(exampleKey in source), `unexpected ${exampleKey}`);
      }
    }
  });

  it('throws on slug collisions', () => {
    const ssot = {
      terms: [
        { term: 'noun incorporation', plain: 'a' },
        { term: 'noun-incorporation', plain: 'b' },
      ],
    };
    assert.throws(() => buildGlossarySource(ssot), /slug collision/);
  });
});

describe('mergeGlossaryLocale', () => {
  it('overlays translated display fields and sets termDisplay', () => {
    const translated = {
      'glossary.morpheme.term': { message: 'morphème' },
      'glossary.morpheme.plain': { message: 'FR plain morpheme.' },
      'glossary.morpheme.mt_relevance': { message: 'FR mt morpheme.' },
      'glossary.affix.term': { message: 'affix' }, // same as English
      'glossary.affix.plain': { message: 'FR plain affix.' },
      'glossary.affix.example': { message: 'FR example affix.' },
    };
    const merged = mergeGlossaryLocale(syntheticSsot(), translated, 'fr');

    assert.equal(merged._meta.locale, 'fr');
    const [morpheme, affix] = merged.terms;

    // Canonical identity is preserved; the translation is display-only.
    assert.equal(morpheme.term, 'morpheme');
    assert.equal(morpheme.termDisplay, 'morphème');
    assert.equal(morpheme.plain, 'FR plain morpheme.');
    assert.equal(morpheme.mt_relevance, 'FR mt morpheme.');
    // Detection vocabulary / citations / related stay English.
    assert.deepEqual(morpheme.also, ['morphemes']);
    assert.deepEqual(morpheme.citations, [{ source: 'SIL', url: 'https://example.org/morpheme' }]);
    assert.deepEqual(morpheme.related, ['affix']);

    // A translation identical to English never sets termDisplay.
    assert.ok(!('termDisplay' in affix));
    assert.equal(affix.plain, 'FR plain affix.');
    assert.equal(affix.example, 'FR example affix.');
    // Untranslated field falls back to English.
    assert.equal(affix.mt_relevance, 'EN mt affix.');
  });

  it('keeps English per-field for missing, empty, or absent translations', () => {
    const merged = mergeGlossaryLocale(
      syntheticSsot(),
      { 'glossary.morpheme.plain': { message: '   ' } }, // whitespace-only → fallback
      'de'
    );
    const [morpheme, affix] = merged.terms;
    assert.equal(morpheme.plain, 'EN plain morpheme.');
    assert.equal(affix.plain, 'EN plain affix.');
    assert.ok(!('termDisplay' in morpheme));

    // A wholly missing translated file (first sync not run yet) is tolerated.
    const allEnglish = mergeGlossaryLocale(syntheticSsot(), null, 'ja');
    assert.equal(allEnglish._meta.locale, 'ja');
    assert.equal(allEnglish.terms[0].plain, 'EN plain morpheme.');
  });

  it('tolerates bare-string values in the translated file', () => {
    const merged = mergeGlossaryLocale(
      syntheticSsot(),
      { 'glossary.morpheme.plain': 'FR bare string.' },
      'fr'
    );
    assert.equal(merged.terms[0].plain, 'FR bare string.');
  });
});

describe('generateGlossaryI18nSource', () => {
  it('writes the Phase-1 source, idempotently', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-i18n-'));
    const ssotFile = path.join(tmp, 'glossary.json');
    const outFile = path.join(tmp, 'i18n', 'en', 'glossary.json');
    fs.writeFileSync(ssotFile, JSON.stringify(syntheticSsot()));

    const first = generateGlossaryI18nSource({ ssotFile, outFile });
    assert.equal(first.wrote, true);
    // 2 terms × (term, plain, mt_relevance) + 1 example = 7 keys
    assert.equal(first.keys, 7);
    const written = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    assert.equal(written['glossary.morpheme.plain'].message, 'EN plain morpheme.');

    // Unchanged SSOT → no rewrite (no i18n drift from the gate's regen step).
    const second = generateGlossaryI18nSource({ ssotFile, outFile });
    assert.equal(second.wrote, false);

    // Changed SSOT → rewrite.
    const ssot = syntheticSsot();
    ssot.terms[0].plain = 'EN plain morpheme, revised.';
    fs.writeFileSync(ssotFile, JSON.stringify(ssot));
    const third = generateGlossaryI18nSource({ ssotFile, outFile });
    assert.equal(third.wrote, true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('the committed i18n/en/glossary.json is current with the SSOT', () => {
    // Guards the same invariant the sync gate enforces at push time: the
    // committed Phase-1 source must match a fresh regeneration.
    const committed = path.join(HERE, '..', 'website', 'i18n', 'en', 'glossary.json');
    const ssot = JSON.parse(fs.readFileSync(SSOT_FILE, 'utf-8'));
    const expected = JSON.stringify(buildGlossarySource(ssot), null, 2) + '\n';
    assert.equal(
      fs.readFileSync(committed, 'utf-8'),
      expected,
      'i18n/en/glossary.json is stale — run `npm run glossary:i18n` in cli/website'
    );
  });
});

describe('explainerLoader.loadGlossary — locale fetch + English fallback', () => {
  // explainerLoader.js is an ESM file living in the website package (whose
  // package.json has no "type": "module"), so Node can't import it by path.
  // It has zero imports, so we import its source through a data: URL —
  // cache-busted per test so each gets a fresh module-level cache.
  const LOADER_FILE = path.join(HERE, '..', 'website', 'src', 'utils', 'explainerLoader.js');
  const loaderSource = fs.readFileSync(LOADER_FILE, 'utf-8');
  let bust = 0;
  async function freshLoader() {
    const src = `${loaderSource}\n// cache-bust ${++bust} ${Math.random()}`;
    return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  }

  const EN_DATA = { _meta: {}, terms: [{ term: 'morpheme', plain: 'EN' }] };
  const FR_DATA = { _meta: { locale: 'fr' }, terms: [{ term: 'morpheme', termDisplay: 'morphème', plain: 'FR' }] };

  /** fetch stub: url → {ok, json} | Error. Records calls. */
  function stubFetch(routes) {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      const hit = routes[url];
      if (!hit) return { ok: false, status: 404 };
      if (hit instanceof Error) throw hit;
      return { ok: true, status: 200, json: async () => hit };
    };
    return calls;
  }

  const savedFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = savedFetch;
  });

  it('fetches the localized artifact for a translated locale', async () => {
    const { loadGlossary } = await freshLoader();
    const calls = stubFetch({ '/data/explainers/glossary.fr.json': FR_DATA });
    const data = await loadGlossary('fr');
    assert.deepEqual(calls, ['/data/explainers/glossary.fr.json']);
    assert.equal(data.terms[0].termDisplay, 'morphème');
  });

  it('falls back to English when the localized artifact is missing', async () => {
    const { loadGlossary } = await freshLoader();
    const calls = stubFetch({ '/data/explainers/glossary.json': EN_DATA });
    const data = await loadGlossary('de');
    assert.deepEqual(calls, [
      '/data/explainers/glossary.de.json',
      '/data/explainers/glossary.json',
    ]);
    assert.equal(data.terms[0].plain, 'EN');
  });

  it('falls back to English when the localized fetch throws', async () => {
    const { loadGlossary } = await freshLoader();
    const calls = stubFetch({
      '/data/explainers/glossary.ja.json': new Error('network down'),
      '/data/explainers/glossary.json': EN_DATA,
    });
    const data = await loadGlossary('ja');
    assert.equal(calls.length, 2);
    assert.equal(data.terms[0].plain, 'EN');
  });

  it('goes straight to English for en / missing / unsafe locale values', async () => {
    const { loadGlossary } = await freshLoader();
    const calls = stubFetch({ '/data/explainers/glossary.json': EN_DATA });
    assert.equal((await loadGlossary('en')).terms[0].plain, 'EN');
    assert.equal((await loadGlossary()).terms[0].plain, 'EN');
    assert.equal((await loadGlossary('../../etc/passwd')).terms[0].plain, 'EN');
    // All three resolved from the single cached English fetch.
    assert.deepEqual(calls, ['/data/explainers/glossary.json']);
  });

  it('caches per locale and clears the cache on total failure', async () => {
    const { loadGlossary } = await freshLoader();
    const calls = stubFetch({ '/data/explainers/glossary.fr.json': FR_DATA });
    await loadGlossary('fr');
    await loadGlossary('fr');
    assert.equal(calls.length, 1, 'second call must reuse the cached promise');

    // Total failure → null, and the next call retries.
    const failCalls = stubFetch({});
    assert.equal(await loadGlossary('zz'), null);
    assert.equal(await loadGlossary('zz'), null);
    assert.equal(failCalls.length, 4, 'failed lookups must not be cached');
  });
});
