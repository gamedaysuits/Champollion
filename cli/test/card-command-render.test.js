/**
 * `champollion card` — what the terminal card is allowed to say.
 *
 * Two rules, each once broken in a way no unit test of the reader could see:
 *
 *   DISAGREEMENT IS SHOWN, NEVER RESOLVED. Plains Cree's card carries five
 *   endangerment assessments from three sources on three scales; the terminal
 *   printed one badge, "● vulnerable", while the MCP listed them. Every value
 *   of every disputed attribution envelope must reach the reader with its
 *   source — name, family, endangerment, speakers, typology, and any field
 *   the atlas starts attributing later.
 *
 *   A HEADING IS NEVER PRINTED OVER NOTHING. The published card projection
 *   ships `corpusAvailability: {}`, `pipelineReadiness: {}` and
 *   `methodSupport: {}`; an npm install printed those three headings with
 *   nothing beneath, which reads as a rendering failure. Absence means
 *   unknown, so an empty section must say "not recorded on this card".
 *
 * Fixtures are the real corpus where the corpus has the shape (each test
 * first asserts its premise, so a rebuilt corpus that loses the shape fails
 * loudly instead of passing vacuously) and the published-projection builder
 * where the shape only exists in npm installs.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderCard } from '../lib/commands/card.js';
import { getLanguageCard } from '../lib/registers.js';
import {
  attributedFields,
  attributions,
  isDisputed,
  readCard,
} from '../lib/cards/reader.js';
import { buildCardFromRemote } from '../lib/cards/remote.js';

const CLI_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(CLI_ROOT, 'bin', 'cli.js');

/** Strip ANSI colour codes. */
const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Undo locale digit grouping (4,100 / 4.100 / 4 100 → 4100). */
const ungroup = (s) => s.replace(/(\d)[,.\s  ](?=\d{3}(?!\d))/g, '$1');

/**
 * Sections of rendered card text: Map<title, content lines>. A section is a
 * title line followed by a ─── underline; its content runs to the next blank
 * line (every heading is preceded by one).
 */
function sections(text) {
  const lines = plain(text).split('\n');
  const out = new Map();
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*─+\s*$/.test(lines[i + 1]) || !lines[i].trim()) continue;
    const content = [];
    for (let j = i + 2; j < lines.length && lines[j].trim() !== ''; j++) content.push(lines[j]);
    out.set(lines[i].trim(), content);
  }
  return out;
}

/** Render a corpus card the way `champollion card <code>` does in a checkout. */
function renderRepo(code) {
  const card = getLanguageCard(code);
  assert.ok(card, `premise: the corpus has a ${code} card`);
  return plain(renderCard(card, { rawCard: readCard(code) }));
}

/** A line of `text` carrying both the claim's value and its source. */
function hasClaimLine(text, claim) {
  const value = String(claim.value);
  return plain(text).split('\n')
    .some((line) => ungroup(line).includes(value) && line.includes(String(claim.source)));
}

function assertNoEmptySection(text, label) {
  for (const [title, content] of sections(text)) {
    assert.ok(content.length > 0, `${label}: section "${title}" printed a heading over nothing`);
  }
}

// ---------------------------------------------------------------------------
// Item 14 — every attributed value of a disputed field, with its source
// ---------------------------------------------------------------------------

describe('card: disputed fields show every attributed value', () => {
  test('crk endangerment — all assessments and their sources, end to end', () => {
    const raw = readCard('crk');
    assert.ok(isDisputed(raw.endangerment), 'premise: crk endangerment is disputed');
    const claims = attributions(raw.endangerment);
    assert.ok(new Set(claims.map((c) => c.value)).size >= 3,
      'premise: crk endangerment carries at least three distinct assessments');

    const out = plain(execFileSync(process.execPath, [BIN, 'network', 'card', 'crk'], {
      encoding: 'utf-8',
      env: { ...process.env, CHAMPOLLION_OFFLINE: '1' },
      timeout: 60_000,
    }));
    const endangerment = sections(out).get('Endangerment');
    assert.ok(endangerment, `no Endangerment section:\n${out}`);
    const body = endangerment.join('\n');
    for (const c of claims) {
      assert.ok(hasClaimLine(body, c),
        `endangerment "${c.value}" [${c.source}] is missing from:\n${body}`);
    }
    assert.equal(endangerment.filter((l) => l.trim().startsWith('•')).length, claims.length,
      'one line per assessment — none merged, none dropped');
    assert.match(body, /none elected/);

    // The badge is one derived display tier; it must say so, not stand alone.
    const badge = out.split('\n').find((l) => l.includes('●'));
    assert.ok(badge, 'a vitality badge is printed');
    assert.match(badge, /champollion-derived from \S+/);
    assert.match(badge, /assessments differ/);
  });

  test('crk speaker estimates — every claim, with its source and scope note', () => {
    const raw = readCard('crk');
    const claims = attributions(raw.speakerEstimates);
    assert.ok(new Set(claims.map((c) => c.value)).size > 1, 'premise: crk speaker counts differ');
    const speakers = sections(renderRepo('crk')).get('Speaker Estimates').join('\n');
    for (const c of claims) {
      assert.ok(hasClaimLine(speakers, c), `speaker claim ${c.value} (${c.source}) missing:\n${speakers}`);
    }
    assert.match(speakers, /sources differ/);
    // ELCat's count is British Columbia only; without its note it reads as
    // the language's total.
    assert.match(speakers, /British Columbia/);
  });

  test('a disputed NAME lists every registry\'s spelling (acq)', () => {
    const raw = readCard('acq');
    assert.ok(isDisputed(raw.name), 'premise: acq name is disputed');
    const ident = sections(renderRepo('acq')).get('Identification').join('\n');
    for (const c of attributions(raw.name)) {
      assert.ok(hasClaimLine(ident, c), `name "${c.value}" [${c.source}] missing:\n${ident}`);
    }
  });

  test('a disputed FAMILY lists every taxonomy (aaa)', () => {
    const raw = readCard('aaa');
    assert.ok(isDisputed(raw.classification.family), 'premise: aaa family is disputed');
    const cls = sections(renderRepo('aaa')).get('Classification').join('\n');
    for (const c of attributions(raw.classification.family)) {
      assert.ok(hasClaimLine(cls, c), `family "${c.value}" [${c.source}] missing:\n${cls}`);
    }
  });

  test('the published projection\'s family attributions are shown too', () => {
    const card = buildCardFromRemote({ code: 'aaa', name: 'Ghotuo' }, {
      detail: {
        classification: {
          family: 'Atlantic-Congo',
          familyAttributions: [
            { value: 'Atlantic-Congo', source: 'glottolog-v5.3' },
            { value: 'Niger-Congo', source: 'wals-v2020.5' },
          ],
        },
      },
    });
    const cls = sections(renderCard(card)).get('Classification').join('\n');
    assert.ok(hasClaimLine(cls, { value: 'Atlantic-Congo', source: 'glottolog-v5.3' }), cls);
    assert.ok(hasClaimLine(cls, { value: 'Niger-Congo', source: 'wals-v2020.5' }), cls);
  });

  test('a disputed field no section names still reaches the reader (crk politeness)', () => {
    const raw = readCard('crk');
    assert.ok(isDisputed(raw.politenessDistinction), 'premise: crk politenessDistinction is disputed');
    const other = sections(renderRepo('crk')).get('Other Fields Where Sources Differ');
    assert.ok(other, 'the catch-all section is printed');
    for (const c of attributions(raw.politenessDistinction)) {
      assert.ok(hasClaimLine(other.join('\n'), c), `politeness "${c.value}" [${c.source}] missing`);
    }
  });

  for (const code of ['crk', 'abc', 'acq', 'aaa', 'ain', 'eng', 'fra-CA']) {
    test(`no disputed envelope on ${code} loses a value`, () => {
      const raw = readCard(code);
      assert.ok(raw, `premise: the corpus has ${code}`);
      const out = renderRepo(code);
      const disputed = attributedFields(raw).filter(({ value }) => isDisputed(value));
      for (const { path: p, value } of disputed) {
        for (const c of attributions(value)) {
          assert.ok(hasClaimLine(out, c), `${code} ${p}: "${c.value}" [${c.source}] not shown`);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Item 11 — an empty section says so
// ---------------------------------------------------------------------------

describe('card: an empty section is never a bare heading', () => {
  test('published-projection abc (npm install): the three {} sections say "not recorded"', () => {
    // The shape build-trading-card-data.mjs publishes for a language no
    // source gives corpora, readiness or method listings.
    const card = buildCardFromRemote(
      { code: 'abc', name: 'Ambala Ayta', updated_at: '2026-10-01T00:00:00Z' },
      {
        updated_at: '2026-10-01T00:00:00Z',
        detail: {
          corpusAvailability: {},
          pipelineReadiness: {},
          methodSupport: {},
          evalDatasets: [],
          speakerEstimates: [],
          endangerment: { agreement: null, values: [] },
        },
      },
    );
    const out = renderCard(card);
    const s = sections(out);
    for (const title of ['Corpus Availability', 'Pipeline Readiness', 'Method Support']) {
      assert.ok(s.has(title), `${title} is printed`);
      assert.match(s.get(title)[0], /not recorded on this card/, `${title}:\n${s.get(title).join('\n')}`);
    }
    assert.match(s.get('Method Support').join('\n'), /champollion network recommend <src> abc/);
    assert.match(s.get('Pipeline Readiness').join('\n'), /champollion network recommend <src> abc/);
    assert.match(s.get('Corpus Availability').join('\n'), /mt-eval corpora --source <src> --target abc/);
    assert.match(s.get('Endangerment').join('\n'), /no source on this card assesses it/);
    assert.match(s.get('Speaker Estimates').join('\n'), /no cited estimate/);
    assert.match(plain(out), /published card projection/);
    assertNoEmptySection(out, 'projection abc');
  });

  test('the same, end to end through a packaged install\'s card cache', () => {
    // Reproduces the reported run: no card directory (npm install), the card
    // served from the per-user cache the remote fetch fills. Offline, so the
    // cache is the only tier that can answer.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-card-empty-'));
    try {
      const env = {
        ...process.env,
        CHAMPOLLION_OFFLINE: '1',
        CHAMPOLLION_CARDS_DIR: path.join(tmp, 'no-cards-here'),
        CHAMPOLLION_CARDS_CACHE_DIR: path.join(tmp, 'cache'),
      };
      const seed = `
        import { buildCardFromRemote } from ${JSON.stringify(path.join(CLI_ROOT, 'lib/cards/remote.js'))};
        import { writeCachedCard } from ${JSON.stringify(path.join(CLI_ROOT, 'lib/cards/cache.js'))};
        const card = buildCardFromRemote({ code: 'abc', name: 'Ambala Ayta' }, { detail: {
          corpusAvailability: {}, pipelineReadiness: {}, methodSupport: {}, evalDatasets: [],
        } });
        if (!writeCachedCard('abc', card, null)) throw new Error('cache write failed');
      `;
      execFileSync(process.execPath, ['--input-type=module', '-e', seed], { env, timeout: 30_000 });
      const out = plain(execFileSync(process.execPath, [BIN, 'network', 'card', 'abc'], {
        encoding: 'utf-8', env, timeout: 60_000,
      }));
      assert.match(out, /published card projection/, `the cached projection was not the card served:\n${out}`);
      const s = sections(out);
      for (const title of ['Corpus Availability', 'Pipeline Readiness', 'Method Support']) {
        assert.match((s.get(title) ?? [''])[0], /not recorded on this card/, `${title} in:\n${out}`);
      }
      assertNoEmptySection(out, 'packaged abc');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('repo abc: corpora the card DOES carry are listed, not reported missing', () => {
    const raw = readCard('abc');
    assert.ok((raw.lexicalResources?.datasets ?? []).length > 0, 'premise: abc carries wordlists');
    assert.equal(raw.methodSupport, undefined, 'premise: abc carries no method listing');
    const out = renderRepo('abc');
    const s = sections(out);
    const corpus = s.get('Corpus Availability').join('\n');
    assert.doesNotMatch(corpus, /not recorded/);
    for (const d of raw.lexicalResources.datasets) assert.match(corpus, new RegExp(d.dataset));
    assert.match(s.get('Method Support')[0], /not recorded on this card/);
    assert.match(s.get('Pipeline Readiness')[0], /not recorded on this card/);
    assertNoEmptySection(out, 'repo abc');
  });

  test('every section of the sample cards has content', () => {
    for (const code of ['crk', 'eng', 'fra-CA', 'eus', 'ain']) {
      assertNoEmptySection(renderRepo(code), code);
    }
  });

  test('method evidence that reached the renderer unflattened is not printed as engines', () => {
    const out = renderCard({ code: 'zzz', name: 'Test', methodSupport: { total: 3, byTier: {}, named: [] } });
    const methods = sections(out).get('Method Support').join('\n');
    assert.doesNotMatch(methods, /total|byTier|named/);
    assert.match(methods, /not recorded on this card/);
  });
});

describe('reader: attributedFields', () => {
  test('finds every envelope on a card by path, skipping bookkeeping', () => {
    const paths = attributedFields(readCard('crk')).map((f) => f.path);
    for (const p of ['name', 'endangerment', 'speakerEstimates', 'classification.family',
      'typologicalProfile.inclusiveExclusive', 'politenessDistinction']) {
      assert.ok(paths.includes(p), `${p} not found in ${paths.join(', ')}`);
    }
    assert.equal(paths.some((p) => p.startsWith('_')), false);
  });

  test('walks arrays and ignores non-envelope objects', () => {
    const env = { agreement: 'conflicting', values: [{ value: 'a', source: 's1' }, { value: 'b', source: 's2' }] };
    const found = attributedFields({ x: { y: env }, list: [{ z: env }], _fieldSources: { q: env }, plain: { values: [] } });
    assert.deepEqual(found.map((f) => f.path).sort(), ['list[0].z', 'x.y']);
  });
});
