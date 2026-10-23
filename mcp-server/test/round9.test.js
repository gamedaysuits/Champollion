/**
 * Round 9 synthetic users (hospital persona, researcher), 2026-10-04.
 *
 *   9.  language_overview for a private-use code (qaa–qtz) was a dead end
 *       ("No language card… use search_languages"): it now says what the code
 *       is and what still applies.
 *   10. run_benchmark resolved qaa in its plan but left --target-lang-code out
 *       of the command, and printed the command unquoted (not pasteable).
 *   14. run_benchmark had no way to say which script the output must be in
 *       (Plains Cree: Cans syllabics / Latn SRO).
 *   7.  get_metric_reliability said "founder review pending" to users.
 *
 * No network, no real subprocess: every dependency is injected.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildCorpusArgv, runBenchmark, resetJobs } from '../src/tools/harness.js';
import { shellJoin, shellQuote } from '../src/tools/args.js';
import { scriptPlanLines } from '../src/tools/run-plan.js';
import { formatOverview, isPrivateUseCode, languageOverview } from '../src/tools/overview.js';
import { getLanguage } from '../src/tools/language-card.js';
import { formatReliability, metricReliability } from '../src/tools/reliability.js';

const AYTA = 'Ayta (variety not yet confirmed)';
let DIR;
let QAA;
let CRK;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-r9-'));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
  QAA = join(DIR, 'ward.jsonl');
  writeFileSync(QAA, '{"source":"Where does it hurt?","reference":"x"}\n');
  // what `champollion network register-corpus --data … --pair eng-qaa` writes
  writeFileSync(`${QAA}.champollion.json`, JSON.stringify({ id: 'eval-eng-qaa-ward-v1', card: 'eval-eng-qaa-ward-v1.json' }));
  writeFileSync(join(DIR, 'eval-eng-qaa-ward-v1.json'), JSON.stringify({ id: 'eval-eng-qaa-ward-v1', pair: { source: 'eng', target: 'qaa' } }));
  CRK = join(DIR, 'school.jsonl');
  writeFileSync(CRK, '{"source":"hello","reference":"tânisi"}\n');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

const REGISTRY = {
  entries: {
    openrouter: { kind: 'llm-provider' },
    local: { kind: 'llm-provider', default_base_url: 'http://localhost:11434/v1' },
    'google-translate': { kind: 'mt-api' },
    'local-model': { kind: 'local-model', runtimes: ['harness'] },
  },
};

function deps(answer) {
  const asked = [];
  return {
    asked,
    handle: {
      isMtEvalInstalled: async () => true,
      execCapture: async () => ({ code: 0, stdout: 'ok', stderr: '' }),
      env: {},
      methodRegistry: REGISTRY,
      publishProbe: async () => ({}),
      runPlanProbe: async (input) => { asked.push(input); return typeof answer === 'function' ? answer(input) : answer; },
      metricsProbe: async () => ({ status: 'not-installed', error: 'not asked in this test' }),
    },
  };
}

const CRK_PROBE = {
  status: 'ok', version: '0.2.0',
  target: { code: 'crk', name: 'Plains Cree', from: 'the target language name', scripts: ['Cans', 'Latn'] },
  evalPack: { message: null, notes: [], fstPinned: false, declared: false },
};

describe('9. language_overview for a private-use code', () => {
  it('qaa–qtz are private-use; other q-codes are not', () => {
    assert.ok(isPrivateUseCode('qaa') && isPrivateUseCode('QTZ') && isPrivateUseCode(' qbx '));
    assert.ok(!isPrivateUseCode('qua') && !isPrivateUseCode('crk') && !isPrivateUseCode('qa'));
  });

  it('answers with what the code is and what still applies — no card lookup, no dead end', async () => {
    let looked = false;
    const o = await languageOverview({ code: 'qaa' }, { index: [], champollion: { get: () => { looked = true; } } });
    assert.equal(o.status, 'private-use');
    assert.equal(looked, false);
    const text = formatOverview(o);
    assert.match(text, /^# qaa — an ISO 639-3 private-use code/);
    assert.match(text, /no public language card exists for it — by design/);
    assert.doesNotMatch(text, /No language card for/);
    for (const step of ['search_languages', 'register-corpus', '--pair eng-qaa', 'run_benchmark',
      'forge_init { "code": "qaa", "no_card": true', 'champollion init --langs qaa']) {
      assert.ok(text.includes(step), `the page names ${step}`);
    }
    assert.match(text, /never pick one for them/);
  });

  it('get_language on a private-use code points at the overview, not at a dead end', async () => {
    const r = await getLanguage('qaa', { index: [] });
    assert.equal(r.status, 'not-found');
    assert.equal(r.privateUse, true);
    assert.match(r.note, /private-use code .* by design/);
    assert.match(r.note, /language_overview \{ "code": "qaa" \}/);
  });
});

describe('10. run_benchmark passes the target code, and prints a pasteable command', () => {
  it('shellQuote quotes what a shell would split or expand', () => {
    assert.equal(shellQuote('qaa'), 'qaa');
    assert.equal(shellQuote('/a/b-c.jsonl'), '/a/b-c.jsonl');
    assert.equal(shellQuote(AYTA), `'${AYTA}'`);
    assert.equal(shellQuote("it's"), "'it'\\''s'");
    assert.equal(shellQuote(''), "''");
    assert.equal(shellJoin(['run', '--target-lang', 'Plains Cree']), "run --target-lang 'Plains Cree'");
  });

  it('the code the corpus card states goes as --target-lang-code', () => {
    const r = buildCorpusArgv({ corpus: QAA, provider: 'local', model: 'llama3.1', target_language: AYTA }, { env: {}, methodEntries: {} });
    const i = r.argv.indexOf('--target-lang-code');
    assert.ok(i > 0, r.argv.join(' '));
    assert.equal(r.argv[i + 1], 'qaa');
    assert.equal(r.target.code, 'qaa');
    assert.match(r.target.from, /corpus card/);
  });

  it('a target_language that is itself a code goes as the code too', () => {
    const r = buildCorpusArgv({ corpus: CRK, provider: 'local', model: 'llama3.1', target_language: 'qaa' }, { env: {}, methodEntries: {} });
    assert.equal(r.argv[r.argv.indexOf('--target-lang-code') + 1], 'qaa');
    const named = buildCorpusArgv({ corpus: CRK, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree' }, { env: {}, methodEntries: {} });
    assert.ok(!named.argv.includes('--target-lang-code'), 'a name is not a code');
  });

  it('the dry run prints the command shell-quoted, with the code', async () => {
    const d = deps((input) => ({ status: 'ok', version: '0.2.0',
      target: { code: input.targetCode, name: null, from: input.targetCodeFrom, scripts: [] },
      evalPack: { message: null, notes: [], fstPinned: false, declared: false } }));
    const out = await runBenchmark({ corpus: QAA, provider: 'local', model: 'llama3.1', target_language: AYTA, dry_run: true }, d.handle);
    assert.equal(d.asked[0].targetCode, 'qaa');
    assert.ok(out.includes(`--target-lang '${AYTA}' --target-lang-code qaa`), out);
    assert.match(out, /^Target: {3}qaa — from the corpus card/m);
  });
});

describe('14. run_benchmark: the script', () => {
  it('script goes as --target-script, normalized', () => {
    const r = buildCorpusArgv({ corpus: CRK, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree', script: 'cans' }, { env: {}, methodEntries: {} });
    assert.equal(r.argv[r.argv.indexOf('--target-script') + 1], 'Cans');
    assert.deepEqual(r.script, { code: 'Cans', from: 'the script argument' });
  });

  it('a code with a script subtag states the script', () => {
    writeFileSync(join(DIR, 'syl.jsonl'), '{"source":"hello","reference":"ᑕᓂᓯ"}\n');
    writeFileSync(join(DIR, 'syl.jsonl.champollion.json'), JSON.stringify({ id: 'x', pair: { source: 'eng', target: 'crk-Cans' } }));
    const r = buildCorpusArgv({ corpus: join(DIR, 'syl.jsonl'), provider: 'local', model: 'llama3.1' }, { env: {}, methodEntries: {} });
    assert.equal(r.argv[r.argv.indexOf('--target-script') + 1], 'Cans');
    assert.match(r.script.from, /crk-Cans/);
  });

  it('refuses a non-code, and a method run (it gets no prompt)', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CRK, provider: 'local', model: 'llama3.1', script: 'syllabics' }, { env: {}, methodEntries: {} }),
      /ISO 15924/);
    assert.throws(() => buildCorpusArgv({ corpus: CRK, method: 'local-model', model: 'facebook/nllb-200-distilled-600M', script: 'Latn' },
      { env: {}, mtMethods: ['local-model'], methodEntries: { 'local-model': { kind: 'local-model' } } }), /gets no prompt/);
  });

  it('the plan asks for one when the card lists several and none was given', async () => {
    const d = deps(CRK_PROBE);
    const out = await runBenchmark({ corpus: CRK, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree', dry_run: true }, d.handle);
    assert.match(out, /⚠ Script: Plains Cree \(crk\) is written in 2 scripts per its card \(Cans, Latn\)/);
    assert.match(out, /pass script \("Cans" or "Latn"\)/);
    const given = await runBenchmark({ corpus: CRK, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree', script: 'Latn', dry_run: true }, d.handle);
    assert.match(given, /^Script: {3}Latn — from the script argument; the prompt asks for it/m);
    assert.doesNotMatch(given, /⚠ Script/);
  });

  it('scriptPlanLines: a script the card does not list, a method run, a one-script card', () => {
    assert.match(scriptPlanLines(CRK_PROBE, { script: { code: 'Arab', from: 'the script argument' } })[0],
      /the Plains Cree \(crk\) card lists Cans, Latn: the harness REFUSES Arab/);
    assert.match(scriptPlanLines(CRK_PROBE, { methodRun: true })[0], /a method writes whatever script it writes/);
    assert.deepEqual(scriptPlanLines({ ...CRK_PROBE, target: { ...CRK_PROBE.target, scripts: ['Latn'] } }), []);
    assert.deepEqual(scriptPlanLines({ status: 'error', error: 'x' }), []);
  });
});

describe('7. get_metric_reliability says nothing internal', () => {
  it('the licence note is user-facing, in the answer and its rendering', async () => {
    const idx = {
      languages: { iu: { iso639_3: 'iku', family: 'Eskimo-Aleut' } },
      families: { 'Eskimo-Aleut': { n_pairs: 1, metrics: { bleu: { sys: {
        n_cells: 1, n_pairs: 1, weight: 10, pairs: ['wmt20:en-iu'], pearson_weighted_mean: 0.16 } } } } },
      cells: [{ pair: 'en-iu', tgt: 'iu', preferred: true }],
      license_lane: { commercial_ok: false, note: 'internal note — never shown' },
      provenance: 'champollion-derived [derived from mt-metrics-eval]',
    };
    const r = await metricReliability('iu', idx);
    assert.equal(r.status, 'ok');
    assert.doesNotMatch(r.license_note, /founder/i);
    assert.match(r.license_note, /has not yet been\s+reviewed|not yet been reviewed/);
    assert.doesNotMatch(formatReliability(r), /founder|internal note/i);
  });
});
