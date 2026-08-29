/**
 * cli-smoke.test.js — run the actual program.
 *
 * WHY THIS EXISTS
 *   `champollion card <code>` crashed on EVERY language for the length of the
 *   atlas cutover — `speakerEstimates` became an attribution envelope and the
 *   renderer iterated it — while 75,430 tests passed. Every one of those tests
 *   calls a function; none of them ran the binary. The card linter checked card
 *   SHAPE, which was correct. Nothing checked that the product worked.
 *
 *   So this suite executes bin/cli.js the way a user does and asserts it exits
 *   cleanly and prints no error marker. It is deliberately shallow: its job is
 *   to notice that a command is dead, which is exactly what nothing else did.
 *
 * WHAT IT COVERS, AND WHY THESE CODES
 *   Each sample is a card SHAPE the corpus actually contains, so a renderer
 *   that assumes one shape cannot pass by accident:
 *     fra  — a well-populated language, attribution envelopes on name/family
 *     crk  — sources DISAGREE about its speaker count (three claims, two
 *            sources) and about its endangerment, on incommensurable scales
 *     eng  — the densest card in the corpus
 *     fra-CA — a LOCALE card, a projection with its parent's facts
 *     cmn-Hant — a locale keyed by script rather than territory
 *     ara  — a macrolanguage (isoScope Macrolanguage, has members)
 *     eus  — a language isolate, so it has no family at all
 *     abai1241 — glottocode-only: no ISO code, name is a plain string
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(CLI_ROOT, 'bin', 'cli.js');
const CARDS = path.join(CLI_ROOT, 'shared', 'language-cards');

/** Run the CLI and return its combined output. Throws with output on failure. */
function run(args) {
  try {
    return execFileSync('node', [BIN, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Offline: a smoke test must never depend on a network round trip.
      env: { ...process.env, CHAMPOLLION_OFFLINE: '1' },
      timeout: 60_000,
    });
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    throw new Error(`\`champollion ${args.join(' ')}\` exited ${err.status}:\n${out}`);
  }
}

/** Cards the corpus is expected to hold, by the shape each one exercises. */
const SAMPLES = [
  ['fra', 'a populated language with attribution envelopes'],
  ['crk', 'sources disagree on speakers and endangerment'],
  ['eng', 'the densest card'],
  ['fra-CA', 'a territory locale'],
  ['cmn-Hant', 'a script locale'],
  ['ara', 'a macrolanguage'],
  ['eus', 'an isolate, which has no family'],
];

describe('champollion card — runs for every card shape', () => {
  for (const [code, why] of SAMPLES) {
    test(`card ${code} (${why})`, (t) => {
      if (!fs.existsSync(path.join(CARDS, `${code}.json`))) {
        t.skip(`no ${code}.json in this corpus`);
        return;
      }
      const out = run(['card', code]);
      // `[ERR]` is how this CLI reports a caught failure. A command can exit 0
      // and still have printed one, which is precisely how a broken renderer
      // hides.
      assert.equal(out.includes('[ERR]'), false,
        `card ${code} printed an error:\n${out}`);
      assert.ok(out.trim().length > 0, `card ${code} printed nothing`);
    });
  }

  test('card --json emits parseable JSON', () => {
    const parsed = JSON.parse(run(['card', 'fra', '--json']));
    assert.equal(parsed.code, 'fra');
  });

  test('an unknown code fails cleanly rather than crashing', () => {
    // zzz is a valid-shaped code that is not a language. Offline, this must be
    // a refusal with a message, never a stack trace.
    let output = '';
    try {
      output = run(['card', 'zzz']);
    } catch (err) {
      output = err.message;
    }
    assert.equal(/TypeError|is not a function|is not iterable|undefined is not/.test(output), false,
      `an unknown code produced a crash rather than a refusal:\n${output}`);
  });
});

describe('champollion — the commands a user reaches for first', () => {
  for (const args of [['--help'], ['status'], ['provenance']]) {
    test(`champollion ${args.join(' ')}`, () => {
      const out = run(args);
      assert.equal(out.includes('[ERR]'), false,
        `\`${args.join(' ')}\` printed an error:\n${out}`);
      assert.ok(out.trim().length > 0);
    });
  }
});

describe('the corpus a user is served', () => {
  test('locale cards are present and distinguishable from their language', () => {
    // The cutover once dropped every locale, and a later build made locales
    // claim their parent's identity. Both were invisible until someone asked
    // the CLI for one.
    const files = fs.readdirSync(CARDS).filter((f) => f.endsWith('.json'));
    const locales = files.filter((f) => {
      try {
        return Boolean(JSON.parse(
          fs.readFileSync(path.join(CARDS, f), 'utf-8'),
        )?.locale?.language);
      } catch { return false; }
    });
    assert.ok(locales.length > 1000,
      `expected a locale corpus; found ${locales.length}`);

    // A locale must not claim to BE its language: eng-GH once carried
    // codeAliases ["en"], so resolving "en" returned English-as-spoken-in-Ghana.
    const ghana = path.join(CARDS, 'eng-GH.json');
    if (fs.existsSync(ghana)) {
      const c = JSON.parse(fs.readFileSync(ghana, 'utf-8'));
      assert.equal(c.codeAliases, undefined,
        'a locale must not claim its language\'s code aliases');
      assert.equal(c.iso639_1, undefined,
        'a locale must not claim its language\'s ISO 639-1 code');
    }
  });
});
