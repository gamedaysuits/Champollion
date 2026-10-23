/**
 * languages-loading.test.js — the card-source resolution ladder and, above
 * all, THE REFUSAL.
 *
 * The old code served a hand-written 40-language FALLBACK_INDEX when the card
 * directory was unreachable, with only a stderr note — an agent outside the
 * repo was told "No languages found" for ~7,887 real languages, worded like a
 * fact about the world. These tests defend the opposite contract: every
 * source miss is loud, an explicit override is obeyed or fatal, and the
 * bundled-fallback lane serves the FULL catalogue's names, not a curated 40.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadLanguageIndex, searchLanguages } from '../src/tools/languages.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_FALLBACK = path.resolve(
  __dirname, '../../cli/shared/cards-fallback.json',
);

function tmpCardsDir(cards) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cards-'));
  for (const card of cards) {
    fs.writeFileSync(path.join(dir, `${card.code}.json`), JSON.stringify(card));
  }
  return dir;
}

describe('loadLanguageIndex resolution ladder', () => {
  it('obeys an explicit cards dir', async () => {
    const dir = tmpCardsDir([
      {
        code: 'tst',
        name: {
          agreement: 'unanimous',
          consensus: 'Testish',
          values: [{ value: 'Testish', source: 'glottolog-v5.0' }],
        },
        isoLanguageType: 'Living',
      },
    ]);
    const index = await loadLanguageIndex({ cardsDir: dir });
    assert.equal(index.length, 1);
    assert.equal(index[0].code, 'tst');
    assert.equal(index[0].name, 'Testish', 'envelope resolved through the adapter');
  });

  it('REFUSES an unusable explicit dir — never falls past an override', async () => {
    await assert.rejects(
      loadLanguageIndex({ cardsDir: '/nonexistent/cards-dir' }),
      (err) => {
        assert.match(err.message, /cardsDir option|CHAMPOLLION_CARDS_DIR/);
        assert.match(err.message, /nonexistent\/cards-dir/);
        return true;
      },
    );
  });

  it('REFUSES an explicit dir that parses to zero cards (broken, not missing)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-empty-'));
    await assert.rejects(
      loadLanguageIndex({ cardsDir: dir }),
      /no language cards/,
    );
  });

  it('serves the FULL catalogue from the bundled fallback, honestly lean', async () => {
    const index = await loadLanguageIndex({
      repoDir: '/nonexistent/repo-cards',
      fallbackFile: REPO_FALLBACK,
    });
    assert.ok(index.length > 7000,
      `the manifest covers the catalogue; got ${index.length}`);
    assert.equal(index.some((l) => l.code.includes('-')), false,
      'no locale codes in a language index');
    assert.equal(index.find((l) => typeof l.name !== 'string'), undefined,
      'every name is a string');
    // Rich core entry vs honest lean entry.
    const fra = searchLanguages(index, 'French')[0];
    assert.equal(fra.code, 'fra');
    assert.ok(fra.endonym, 'core bundled card carries its endonym');
    const lean = index.find((l) => !l._raw);
    assert.ok(lean, 'manifest-only entries exist');
    assert.equal(lean.endonym, '', 'lean entries answer with absence, not invention');
  });

  it('THROWS listing every tried path when nothing resolves', async () => {
    await assert.rejects(
      loadLanguageIndex({
        repoDir: '/nonexistent/repo-cards',
        fallbackFile: '/nonexistent/cards-fallback.json',
      }),
      (err) => {
        assert.match(err.message, /refusing to start/i);
        assert.match(err.message, /\/nonexistent\/repo-cards/);
        assert.match(err.message, /\/nonexistent\/cards-fallback\.json/);
        assert.match(err.message, /CHAMPOLLION_CARDS_DIR/);
        return true;
      },
    );
  });
});
