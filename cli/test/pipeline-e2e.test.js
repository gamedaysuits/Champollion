/**
 * pipeline-e2e — the four commands a user actually runs, chained on each
 * other's REAL output: init → sync → verify → integrity.
 *
 * WHY THIS EXISTS. Every stage was already tested in isolation — against
 * fixtures its own test authored. No test fed init's real config into sync,
 * or ran verify/integrity over files sync actually wrote, so a schema drift
 * between stages could pass the whole suite (the conlang script bug shipped
 * exactly this way: sync wrote PUA text no later gate re-read). This file is
 * the chain pin:
 *
 *   1. `init --yes` writes the config          (child process, real CLI)
 *   2. runSync translates against that config  (in-process, stubbed fetch —
 *      the no-translate.test.js pattern; google-translate method)
 *   3. `verify` passes on sync's output, then FAILS when a key is removed
 *   4. `integrity` passes on sync's output, then FAILS when PUA codepoints
 *      are planted in a locale whose resolved script is Latin — the
 *      unrenderable-text gate, end-to-end from files on disk
 *
 * Locales: fr (Latin), ar (non-Latin — exercises the wrong-script lane),
 * tlh (conlang — pins the card-SSOT script resolution: orthographies[] says
 * Latn/canonicalForMt, so sync must NOT convert to pIqaD and the on-disk
 * value stays renderable Latin).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runSync } from '../lib/sync.js';
import { output } from '../lib/output.js';

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));
const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'cli.js');

const LOCALES = ['fr', 'ar', 'tlh'];

// Deterministic stand-ins. ar must be non-Latin (script check) and
// non-degenerate (repetition check); tlh stays Latin — that IS the assertion.
const AR_ALPHABET = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const stubTranslate = (text, target) => {
  if (target === 'ar') {
    return [...text]
      .map((ch, i) => (ch === ' ' ? ' ' : AR_ALPHABET[(ch.charCodeAt(0) + i * 7) % AR_ALPHABET.length]))
      .join('');
  }
  if (target === 'tlh') {
    // Klingon romanization stand-in: Latin, varied, same word count.
    return text.split(' ').map((w, i) => `tlh${i}${w.length}Daq`).join(' ');
  }
  return `FR(${text})`;
};

function runCLI(args, cwd, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI_PATH, ...args], {
      cwd,
      encoding: 'utf-8',
      timeout: 60_000,
      env: { ...process.env, ...env },
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        status: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
      });
    });
  });
}

describe('pipeline e2e — init → sync → verify → integrity on each other\'s real output', () => {
  let dir;
  let localesDir;
  let originalFetch;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let origLog;
  let origWrite;

  const EN = {
    home: {
      heading: 'Welcome to the demonstration project',
      body: 'This project exists to prove the whole pipeline works end to end.',
      cta: 'Get started with the guided tour today',
    },
    footer: {
      note: 'Built with care by the integration test',
    },
  };

  const readLocale = (code) =>
    JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf-8'));

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-pipeline-e2e-'));
    localesDir = path.join(dir, 'locales');
    fs.mkdirSync(localesDir);
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(EN, null, 2));

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';
    delete process.env.OPENROUTER_API_KEY; // keep the retry lane off → deterministic

    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            translations: body.q.map((text) => ({
              translatedText: stubTranslate(text, body.target),
            })),
          },
        }),
      };
    };

    origLog = console.log;
    origWrite = process.stdout.write.bind(process.stdout);
    output.setMode('quiet');
    process.stdout.write = () => true;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    process.stdout.write = origWrite;
    output.setMode('default');
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Ordered chain: node:test runs these sequentially; each stage's input is
  // the previous stage's on-disk output, never a fixture.
  it('stage 1: init --yes writes a config sync can actually run', async () => {
    const { status, stderr } = await runCLI(
      ['init', '--yes', '--langs', LOCALES.join(','), '--method', 'google-translate'],
      dir,
    );
    assert.equal(status, 0, `init failed: ${stderr}`);
    const cfgPath = path.join(dir, 'champollion.config.json');
    assert.ok(fs.existsSync(cfgPath), 'init must write champollion.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    for (const code of LOCALES) {
      assert.ok(JSON.stringify(cfg).includes(code), `config must carry ${code}`);
    }
  });

  it('stage 2: sync translates every locale from init\'s config', async () => {
    const result = await runSync({ cwd: dir, cliArgs: {} });
    assert.ok(result, 'runSync must return a result object');
    for (const code of LOCALES) {
      const t = readLocale(code);
      assert.equal(typeof t.home?.heading, 'string', `${code}: home.heading missing`);
      assert.ok(t.home.heading.length > 0, `${code}: home.heading empty`);
    }
    // The conlang pin: tlh resolved via its card (orthographies[] Latn,
    // canonicalForMt) — the on-disk value must be plain Latin, zero PUA.
    const tlh = readLocale('tlh');
    const flat = JSON.stringify(tlh);
    assert.equal(/\p{Co}/u.test(flat), false,
      'tlh sync output contains Private Use Area codepoints — script resolution ignored the card SSOT');
    // And ar must actually be Arabic script (the stub obliges; the pin is
    // that sync did not mangle or skip the non-Latin lane).
    const ar = readLocale('ar');
    assert.ok(/[؀-ۿ]/.test(ar.home.heading), 'ar output is not Arabic script');
  });

  it('stage 3: verify passes on sync\'s real output, and names a removed key', async () => {
    const clean = await runCLI(['verify'], dir);
    assert.equal(clean.status, 0,
      `verify must pass on what sync just wrote; stderr=${clean.stderr}\nstdout=${clean.stdout}`);

    // Break it the way real projects break: a key vanishes from one locale.
    const fr = readLocale('fr');
    delete fr.footer.note;
    fs.writeFileSync(path.join(localesDir, 'fr.json'), JSON.stringify(fr, null, 2));

    const broken = await runCLI(['verify'], dir);
    assert.notEqual(broken.status, 0, 'verify must fail when a synced key is missing');
    assert.ok(/footer\.note|missing/i.test(broken.stdout + broken.stderr),
      `verify must name the gap; got: ${broken.stdout}${broken.stderr}`);

    // Restore for the next stage.
    fs.writeFileSync(path.join(localesDir, 'fr.json'), JSON.stringify(readLocaleFixed(), null, 2));
    function readLocaleFixed() {
      const fixed = readLocale('fr');
      fixed.footer = fixed.footer || {};
      if (!fixed.footer.note) fixed.footer.note = stubTranslate(EN.footer.note, 'fr');
      return fixed;
    }
  });

  it('stage 4: integrity passes clean, and fails on planted unrenderable PUA', async () => {
    const clean = await runCLI(['integrity'], dir);
    assert.equal(clean.status, 0,
      `integrity must pass on the synced project; stderr=${clean.stderr}\nstdout=${clean.stdout}`);

    // Plant the exact damage class that shipped to production: PUA codepoints
    // in a locale whose resolved script is Latin (conversion off).
    const tlh = readLocale('tlh');
    tlh.home.heading = ''; // pIqaD PUA range
    fs.writeFileSync(path.join(localesDir, 'tlh.json'), JSON.stringify(tlh, null, 2));

    const damaged = await runCLI(['integrity'], dir);
    assert.notEqual(damaged.status, 0,
      'integrity must fail on PUA text in a Latin-resolved locale (the invisible-text bug class)');
    assert.ok(/private.use|pua|repair-script|unrenderable/i.test(damaged.stdout + damaged.stderr),
      `integrity must name the PUA problem or the repair; got: ${damaged.stdout}${damaged.stderr}`);
  });
});
