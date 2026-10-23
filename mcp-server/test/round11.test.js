/**
 * Round 11 synthetic personas (researcher eng→sme, Cree school eng→crk,
 * hospital qaa), 2026-10-04 — run_benchmark and get_run_status.
 *
 *   1.  A code as target_language ("sme") is named from the card index before
 *       it reaches the prompt: --target-lang "Northern Sami" --target-lang-code
 *       sme. A code no card names stays a code, and the plan says so.
 *   2.  The plan shows the prompt (the harness's prompt builder, via the
 *       run-plan probe): the built-in one whole; a coaching file by first line
 *       and hash, that it REPLACES the built-in prompt, and a warning when it
 *       names neither the language nor its code.
 *   4.  get_run_status prints the exact compare command for runs on a
 *       REGISTERED corpus id too (their reports sit in each job's folder).
 *  15.  The plan reports the references' script share (an aggregate) and the
 *       script the run will ask for.
 *  18.  The plan names the translation cache, where it is and what it holds;
 *       an MCP run passes --cache-dir (beside a file's results, or this
 *       server's folder), keeping an existing eval/cache/harness in use.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCorpusArgv, classifyRefusal, compareCommand, languageNameFor, runBenchmark,
} from '../src/tools/harness.js';
import { promptPlanLines, scriptPlanLines } from '../src/tools/run-plan.js';

const INDEX = [
  { code: 'sme', name: 'Northern Sami', aliases: ['se'] },
  { code: 'crk', name: 'Plains Cree', aliases: [] },
  { code: 'sme-NO', name: 'Northern Sami', aliases: [] },
];
const nameOf = (c) => languageNameFor(INDEX, c);
const REG = { entries: { local: { kind: 'llm', default_base_url: 'http://127.0.0.1:11434/v1' } } };
const argAfter = (argv, flag) => argv[argv.indexOf(flag) + 1];

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'r11-mcp-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// -- 1. a code is named --------------------------------------------------------

describe('1. a code as target_language is named from the card index', () => {
  it('languageNameFor: code, alias, a tag\'s base; nothing for an unknown code', () => {
    assert.equal(nameOf('sme'), 'Northern Sami');
    assert.equal(nameOf('se'), 'Northern Sami');
    assert.equal(nameOf('crk-Cans'), 'Plains Cree');
    assert.equal(nameOf('qaa'), null);
    assert.equal(languageNameFor(null, 'sme'), null);
  });

  it('the run is passed the name and the code', () => withTmp((dir) => {
    const built = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      target_language: 'sme' }, { env: { CHAMPOLLION_MCP_HOME: dir }, languageName: nameOf, cwd: dir });
    assert.equal(argAfter(built.argv, '--target-lang'), 'Northern Sami');
    assert.equal(argAfter(built.argv, '--target-lang-code'), 'sme');
    assert.deepEqual(built.target.named, { code: 'sme', name: 'Northern Sami' });
  }));

  it('a code no card names stays a code; a name is passed as given', () => withTmp((dir) => {
    const q = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      target_language: 'qaa' }, { env: { CHAMPOLLION_MCP_HOME: dir }, languageName: nameOf, cwd: dir });
    assert.equal(argAfter(q.argv, '--target-lang'), 'qaa');
    assert.deepEqual(q.target.named, { code: 'qaa', name: null });
    const n = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      target_language: 'Northern Sami' }, { env: { CHAMPOLLION_MCP_HOME: dir }, languageName: nameOf, cwd: dir });
    assert.equal(argAfter(n.argv, '--target-lang'), 'Northern Sami');
    assert.equal(n.target.named, null);
  }));
});

// -- 2. the prompt in the plan -------------------------------------------------

describe('2. the plan shows the prompt', () => {
  const ok = (prompt) => ({ status: 'ok', prompt });

  it('the built-in prompt, whole', () => {
    const [line] = promptPlanLines(ok({ kind: 'naive', sha256: 'a'.repeat(64),
      text: 'You are a translator. Translate the given English text to Northern Sami.\n\nWrite …' }));
    assert.match(line, /^Prompt: {3}the harness's built-in prompt \(sha256 a{12}…\): "You are a translator\. Translate the given English text to Northern Sami\. Write …"$/);
  });

  it('a coaching file: replaces, first line, and ONE verdict — here the silent-file warning (Round 13 wording)', () => {
    const lines = promptPlanLines(ok({ kind: 'coaching', sha256: 'b'.repeat(64), chars: 44,
      coaching_file: '/w/coach.md', first_line: 'Be careful with cases.', names_target: false,
      builtin: 'You are a translator. Translate the given English text to Northern Sami.',
      target_lang: 'Northern Sami', target_code: 'sme' }));
    assert.match(lines[0], /^Prompt: {3}coach\.md REPLACES the harness's built-in prompt — the model gets the file as written \(44 chars, sha256 b{12}…; first line: "Be careful with cases\."\)\./);
    // Round 13: the separate 'Not sent: "<built-in>" — the file must say …'
    // line read as a failure even for a file that names the language; the
    // built-in it replaces is now named inside the one verdict.
    assert.equal(lines.length, 2);
    assert.doesNotMatch(lines.join('\n'), /Not sent/);
    assert.match(lines[1], /^⚠ Coaching: coach\.md: it replaces the built-in "You are a translator\. Translate the given English text to Northern Sami\." but names neither Northern Sami nor its code \(sme\)/);
  });

  it('a local-only corpus withholds the first line', () => {
    const lines = promptPlanLines(ok({ kind: 'coaching', sha256: 'c'.repeat(64), chars: 9, coaching_file: 'c.md',
      names_target: true, builtin: 'x' }), { localOnly: true });
    assert.match(lines[0], /its first line is not shown — the corpus is marked local-only/);
    assert.equal(lines.length, 2);
  });

  it('an older harness or a failed probe is said, never guessed', () => {
    assert.match(promptPlanLines(ok({ unavailable: 'no prompt_plan' }))[0], /^Prompt: {3}cannot preview — no prompt_plan/);
    assert.match(promptPlanLines({ status: 'error', error: 'timeout' })[0], /cannot preview — timeout/);
  });

  it('runBenchmark: Target, Prompt and Cache lines; the probe is asked with the name and the coaching file', () => withTmp(async (dir) => {
    const coach = join(dir, 'coach.md');
    writeFileSync(coach, 'Be careful.\n');
    let asked = null;
    const plan = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      target_language: 'sme', coaching_file: coach, dry_run: true }, {
      isMtEvalInstalled: async () => true, env: { CHAMPOLLION_MCP_HOME: dir }, methodRegistry: REG,
      languageName: nameOf,
      runPlanProbe: async (input) => {
        asked = input;
        return { status: 'ok', target: { code: 'sme', name: 'Northern Sami', from: 'x', scripts: ['Latn'] }, evalPack: {},
          prompt: { kind: 'coaching', sha256: 'd'.repeat(64), chars: 12, coaching_file: coach, first_line: 'Be careful.',
            names_target: false, builtin: 'You are a translator.', target_lang: 'Northern Sami', target_code: 'sme' } };
      },
      localModelWeights: async () => [], forgeOrder: () => [],
    });
    assert.equal(asked.prompt.targetLang, 'Northern Sami');
    assert.equal(asked.prompt.coachingFile, coach);
    assert.match(plan, /^Target: {3}Northern Sami \(sme\) — target_language "sme" is a code/m);
    assert.match(plan, /^Prompt: {3}coach\.md REPLACES the harness's built-in prompt/m);
    assert.match(plan, /^⚠ Coaching: coach\.md: it replaces the built-in "You are a translator\." but names neither Northern Sami nor its code \(sme\)/m);
    assert.match(plan, /^Cache: {4}.*cache\/harness\/ \(in this server's folder\) — the harness's translation cache/m);
    assert.match(plan, /--target-lang 'Northern Sami' --target-lang-code sme/);
  }));
});

// -- 4. compare for a registered corpus id --------------------------------------

describe('4. get_run_status: the compare command for registry-id runs', () => {
  it('lists every finished run on the same corpus id, oldest first, by path', () => withTmp((dir) => {
    const job = (id, corpus, startedAt) => {
      const resultsDir = join(dir, 'jobs', id, 'results');
      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(join(resultsDir, `run_${id}_report.json`), '{}');
      return { id, mode: 'corpus', dryRun: false, startedAt, resultsDir,
        argv: ['run', '--corpus', corpus, '--output-dir', resultsDir] };
    };
    const a = job('run-a', 'eval-eng-sme-tatoeba-dev-v1', 1);
    const b = job('run-b', 'eval-eng-sme-tatoeba-dev-v1', 2);
    const other = job('run-c', 'eval-eng-fra-other-v1', 3);
    const cmd = compareCommand(b, { siblings: [b, other, a] });
    assert.equal(cmd, `mt-eval compare ${join(a.resultsDir, 'run_run-a_report.json')} `
      + `${join(b.resultsDir, 'run_run-b_report.json')} --significance`);
    assert.equal(compareCommand(a, { siblings: [a, other] }), null, 'one run alone has nothing to compare');
    // the file case is unchanged
    assert.equal(compareCommand({ resultsDir: '/data/proj/results/mcp-run-abc123' }),
      'mt-eval compare /data/proj/results/mcp-run-*/*_report.json --significance');
  }));
});

// -- 15. the references' script ---------------------------------------------------

describe('15. the plan names the script the references are written in', () => {
  const probe = (script) => ({ status: 'ok', target: { code: 'crk', name: 'Plains Cree', scripts: ['Cans', 'Latn'] },
    prompt: { kind: 'naive', script } });

  it('dominant: the script the prompt will ask for, counted locally, no sentence', () => {
    const [line] = scriptPlanLines(probe({ chosen: 'Latn', shares: { Cans: 0, Latn: 1 }, card_scripts: ['Cans', 'Latn'],
      lines: ['Script: references are 100% Latn → prompting for Latn'] }));
    assert.match(line, /^Script: {3}Latn — the references are 100% Latn \(counted on this machine over their letters; no sentence is shown\), so the prompt asks for Latn/);
  });

  it('mixed: a warning with the shares', () => {
    const [line] = scriptPlanLines(probe({ chosen: null, shares: { Cans: 0.38, Latn: 0.62 }, card_scripts: ['Cans', 'Latn'],
      lines: ['⚠ Script: mixed'] }));
    assert.match(line, /^⚠ Script: the Plains Cree \(crk\) card lists Cans, Latn and the references are mixed \(62% Latn, 38% Cans\)/);
  });

  it('a given script still wins; without a reading the card warning says what the run will do', () => {
    assert.match(scriptPlanLines(probe(null), { script: { code: 'Cans', from: 'the script argument' } })[0],
      /^Script: {3}Cans — from the script argument/);
    assert.match(scriptPlanLines(probe(null))[0],
      /counts their letters by script \(an aggregate — no sentence is shown\) and prompts for the one that holds 90% or more/);
  });
});

// -- 18. the cache --------------------------------------------------------------

describe('18. the translation cache is placed and named', () => {
  it('a file run: beside its results; a registry run: this server\'s folder; an existing one keeps being used', () => withTmp((dir) => {
    const data = join(dir, 'proj', 'data');
    mkdirSync(data, { recursive: true });
    const f = join(data, 'test.jsonl');
    writeFileSync(f, '{"id":"1","source":"a","reference":"b"}\n');
    const env = { CHAMPOLLION_MCP_HOME: join(dir, 'home') };
    const file = buildCorpusArgv({ corpus: f, provider: 'local', model: 'stub-1', target_language: 'Plains Cree' },
      { env, cwd: join(dir, 'proj') });
    assert.equal(argAfter(file.argv, '--cache-dir'), join(data, 'results', 'cache'));
    assert.equal(file.cache.from, 'corpus');
    const reg = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1' },
      { env, cwd: join(dir, 'proj') });
    assert.equal(argAfter(reg.argv, '--cache-dir'), join(dir, 'home', 'cache', 'harness'));
    mkdirSync(join(dir, 'proj', 'eval', 'cache', 'harness'), { recursive: true });
    const old = buildCorpusArgv({ corpus: f, provider: 'local', model: 'stub-1', target_language: 'Plains Cree' },
      { env, cwd: join(dir, 'proj') });
    assert.equal(argAfter(old.argv, '--cache-dir'), join(dir, 'proj', 'eval', 'cache', 'harness'));
    assert.equal(old.cache.from, 'existing');
  }));
});

// -- the refusal classifier reads the refusal, not the policy header --------------

describe('a run stopped by the cost cap on a restricted corpus is not called a transmission refusal', () => {
  it('the informational header never classifies', () => {
    const header = '  Transmission policy: LOCAL-ONLY corpus (local-only corpus (its steward marked it local-only)).\n'
      + '    Channel: local endpoint\n';
    const cap = `${header}  ✗ --max-cost 5 is set but the cost estimate is UNKNOWN — refusing to start.`;
    assert.equal(classifyRefusal(cap).kind, 'cost-cap');
    assert.equal(classifyRefusal(header), null);
    const refused = `${header}RuntimeError: Transmission policy (local-only): the data's steward marked it local-only — `
      + 'Remote evaluation of this corpus is refused.';
    assert.equal(classifyRefusal(refused).kind, 'transmission');
  });
});
