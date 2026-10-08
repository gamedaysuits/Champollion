/**
 * Round 13 (synthetic Cree school + researcher, 2026-10-04):
 *
 *   10. A method plugin declaring dependency class A1 was "Cost: unknown (the
 *       plugin prices its own calls; …)" in the plan and had no Est. cost
 *       line at all once started. Both now say WHY in the harness's own
 *       words (method_loader.plugin_cost_basis, mirrored verbatim and
 *       compared here), and that a plugin whose model server is on this
 *       machine may cost $0 — which the harness cannot see.
 *   15. language_overview said the FST runtime (pyhfst) and the Plains Cree
 *       analyzer were missing while forge_discover said only the analyzer
 *       was. Both tools run the same Python and the same harness check
 *       (config.fst_state); pyhfst was installed into the shared venv between
 *       the two calls. The overview and the run plan now take BOTH pieces from
 *       fst_state (it imports pyhfst, as the run does — find_spec only for an
 *       older harness) and name the Python that answered.
 *   16. The coached plan's 'Not sent: "<built-in>" — the file must say …' line
 *       plus a separate warning read as a failure even for a file that names
 *       the language. Now ONE verdict, the harness's own sentence
 *       (prompt_plan.coaching_verdict): ✓ names it (as "…"), ⚠ names neither,
 *       or not checked.
 *   19. Plains Cree's two ELCat speaker counts were shown with the same source
 *       and nothing else; the overview now carries each claim's scope note
 *       (ELCat's "10-99" is British Columbia only) and says when the card has
 *       nothing that tells two records apart. Never one picked, never merged.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  awaitAllJobs, DEPENDENCY_CLASSES, pluginCostBasis, resetJobs, runBenchmark,
} from '../src/tools/harness.js';
import { formatFstLines, probeHarnessFst } from '../src/tools/harness-fst.js';
import { coachingVerdict, probeRunPlan, promptPlanLines } from '../src/tools/run-plan.js';
import { speakerClaimTexts } from '../src/tools/language-card.js';
import { languageOverview, formatOverview } from '../src/tools/overview.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ARENA_DIR = resolve(__dirname, '../../arena');

let DIR;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-r13b-'));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

/** Is the monorepo harness importable by `python3` (seam tests skip otherwise)? */
function arenaImportable(mod = 'mt_eval_harness.config') {
  try {
    execFileSync('python3', ['-c', `import ${mod}`], { cwd: ARENA_DIR, timeout: 60_000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const ARENA_ENV = () => ({ ...process.env, PYTHONPATH: [ARENA_DIR, process.env.PYTHONPATH].filter(Boolean).join(':') });

// -- 10. a plugin's cost, in the harness's words --------------------------------------

describe('10. a method plugin\'s cost says why, in the harness\'s words', () => {
  function plugin(name, manifest) {
    const d = join(DIR, name);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'method.json'), JSON.stringify({ name, entry_point: 'm:M', ...manifest }));
    return d;
  }
  const handle = (calls = []) => ({
    isMtEvalInstalled: async () => true,
    execCapture: async (cmd, args) => { calls.push(args); return { code: 0, stdout: '', stderr: '' }; },
    env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') },
    runPlanProbe: async () => ({ status: 'error', error: 'not asked in this test' }),
    metricsProbe: async () => ({ status: 'error', error: 'not asked in this test' }),
    localModelWeights: async () => [],
    forgeOrder: () => [],
  });

  it('the plan: unknown — <the harness\'s basis>, and what the harness cannot see', async () => {
    const corpus = join(DIR, 'c.jsonl');
    writeFileSync(corpus, '{"source":"hello","reference":"bures"}\n');
    const a1 = plugin('llm-a1', { dependency_class: 'A1', dependencies: [] });
    const plan = await runBenchmark({ corpus, method_dir: a1, dry_run: true }, handle());
    assert.match(plan, /^Cost: {5}unknown — method plugin, dependency class A1 \(API-dependent, substitutable\): the plugin calls an LLM itself — it makes and pays for those calls, so the harness has no token count to price\. If what it calls runs on this machine it may well cost \$0, but the harness cannot see inside the plugin to say so\.$/m);
    const none = plugin('no-class', {});
    const p2 = await runBenchmark({ corpus, method_dir: none, dry_run: true }, handle());
    assert.match(p2, /^Cost: {5}unknown — method plugin with no dependency class declared in method\.json: its cost is its own \(unknown, never assumed \$0\)/m);
  });

  it('the started job carries the same label (it had no Est. cost line)', async () => {
    const corpus = join(DIR, 'c2.jsonl');
    writeFileSync(corpus, '{"source":"hello","reference":"bures"}\n');
    const a1 = plugin('llm-a1-run', { dependency_class: 'A1', dependencies: [] });
    const out = await runBenchmark({ corpus, method_dir: a1, confirm: true }, handle());
    await awaitAllJobs();
    assert.match(out, /^Est\. cost: unknown — method plugin, dependency class A1 \(API-dependent, substitutable\): the plugin calls an LLM itself/m);
    const s = plugin('copy-s-run', { dependency_class: 'S', dependencies: [] });
    const out2 = await runBenchmark({ corpus, method_dir: s, confirm: true, attest_local_transport: false }, handle());
    await awaitAllJobs();
    assert.match(out2, /^Est\. cost: \$0 API cost \(runs on this machine\) — method plugin, dependency class S \(self-contained\)/m);
  });

  it('seam: the mirror equals method_loader.DEPENDENCY_CLASSES and plugin_cost_basis, word for word', (t) => {
    if (!arenaImportable('mt_eval_harness.method_loader')) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const table = JSON.parse(execFileSync('python3', ['-c',
      'import json; from mt_eval_harness.method_loader import DEPENDENCY_CLASSES as D; print(json.dumps({k: list(v) for k, v in D.items()}))'],
    { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 60_000 }).trim());
    assert.deepEqual(Object.fromEntries(Object.entries(DEPENDENCY_CLASSES).map(([k, v]) => [k, [...v]])), table);
    const cases = ['S', 'O', 'A1', 'A2', 'X', 'Z9', null];
    const dirs = cases.map((c, i) => plugin(`basis-${i}`, c ? { dependency_class: c } : {}));
    const theirs = JSON.parse(execFileSync('python3', ['-c',
      'import json,sys; from mt_eval_harness.method_loader import plugin_cost_basis as b; print(json.dumps([b(d) for d in json.loads(sys.argv[1])]))',
      JSON.stringify(dirs)], { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 60_000 }).trim());
    assert.deepEqual(cases.map((c) => pluginCostBasis(c)), theirs);
  });
});

// -- 15. one reading of the FST lane ----------------------------------------------------

describe('15. the overview and the run plan read the FST lane from the harness\'s fst_state', () => {
  it('probeHarnessFst relays the answering Python and where the runtime reading came from', async () => {
    const doc = {
      version: '0.2.0', python: '/venv/bin/python', runtimeFrom: 'fst_state', pyhfst: true, pinsShipped: true,
      langs: { crk: { pin: { repo: 'giellalt/lang-crk', format: 'giellalt-nightly-apt' }, installed: false, runtime: true,
        stateLine: 'FST for Plains Cree (crk): not installed here — the Plains Cree FST analyzer is missing.' } },
    };
    const r = await probeHarnessFst(['crk'], {
      python: { cmd: 'py', args: [] },
      run: async () => ({ code: 0, stdout: `CHAMPOLLION_FST_PROBE ${JSON.stringify(doc)}\n`, stderr: '' }),
    });
    assert.equal(r.python, '/venv/bin/python');
    assert.equal(r.runtimeFrom, 'fst_state');
    const lines = formatFstLines('crk', [{ name: 'lang-crk', url: 'https://github.com/giellalt/lang-crk', publisher: 'GiellaLT' }],
      { ok: true, value: r });
    assert.match(lines[0], /the eval harness here \(mt-eval-harness 0\.2\.0 in \/venv\/bin\/python\)/);
    assert.match(lines[1], /the Plains Cree FST analyzer is missing\./);
    assert.doesNotMatch(lines.join('\n'), /pyhfst/, 'the runtime is installed: never said missing');
  });

  it('seam: in one Python, the overview\'s probe and the plan\'s probe agree with fst_state (the reading forge uses)', async (t) => {
    if (!arenaImportable()) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const env = ARENA_ENV();
    const py = { cmd: 'python3', args: [] };
    const [fst, plan] = await Promise.all([
      probeHarnessFst(['crk'], { env, python: py, timeoutMs: 120_000 }),
      probeRunPlan({ targetName: 'Plains Cree' }, { env, python: py, timeoutMs: 120_000 }),
    ]);
    assert.equal(fst.status, 'ok', fst.error);
    assert.equal(plan.status, 'ok', plan.error);
    const truth = JSON.parse(execFileSync('python3', ['-c',
      'import json; from mt_eval_harness.config import fst_state; s = fst_state("crk"); '
      + 'print(json.dumps({"runtime": s["runtime_installed"], "analyzer": s["analyzer_installed"]}))'],
    { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 60_000, env }).trim());
    assert.equal(fst.runtimeFrom, 'fst_state');
    assert.equal(fst.langs.crk.runtime, truth.runtime);
    assert.equal(fst.pyhfst, truth.runtime);
    assert.equal(fst.langs.crk.installed, truth.analyzer);
    assert.equal(plan.evalPack.runtimeFrom, 'fst_state');
    assert.equal(plan.evalPack.pyhfst, truth.runtime);
    assert.equal(plan.evalPack.fstInstalled, truth.analyzer);
    assert.equal(/FST runtime \(pyhfst\)/.test(fst.langs.crk.stateLine), !truth.runtime,
      'the sentence names pyhfst missing exactly when fst_state says so');
  });
});

// -- 16. one verdict on a coaching file ---------------------------------------------------

describe('16. a coaching file gets ONE verdict, the harness\'s sentence', () => {
  const base = { kind: 'coaching', sha256: 'e'.repeat(64), chars: 30, coaching_file: '/w/coach.md',
    builtin: 'You are a translator.  Translate the given English text to Plains Cree.', target_lang: 'Plains Cree', target_code: 'crk' };

  it('✓ names it — by its own name, or "as" the name or code it matched', () => {
    assert.equal(coachingVerdict({ ...base, names_target: true, named_as: 'plains cree' }, 'coach.md'),
      '✓ Coaching: coach.md: it replaces the built-in "You are a translator. Translate the given English text to Plains Cree." '
      + 'and names Plains Cree — the model is told which language to write.');
    assert.equal(coachingVerdict({ ...base, names_target: true, named_as: 'nêhiyawêwin' }, 'coach.md'),
      '✓ Coaching: coach.md: it replaces the built-in "You are a translator. Translate the given English text to Plains Cree." '
      + 'and names Plains Cree (as "nêhiyawêwin") — the model is told which language to write.');
    // diacritics only: the same name
    assert.match(coachingVerdict({ ...base, target_lang: 'Nêhiyawêwin', names_target: true, named_as: 'nehiyawewin' }, 'c.md'),
      /and names Nêhiyawêwin — the model/);
    // an older harness (no named_as): the name it was asked about
    assert.match(coachingVerdict({ ...base, names_target: true }, 'c.md'), /and names Plains Cree — the model/);
  });

  it('⚠ names neither; not checked when no name or code is known', () => {
    assert.equal(coachingVerdict({ ...base, names_target: false }, 'coach.md'),
      '⚠ Coaching: coach.md: it replaces the built-in "You are a translator. Translate the given English text to Plains Cree." '
      + 'but names neither Plains Cree nor its code (crk) — the model is never told which language to write. Name the language in the file.');
    assert.equal(coachingVerdict({ ...base, target_lang: '', target_code: '', names_target: null }, 'coach.md'),
      'Coaching: coach.md: it replaces the built-in "You are a translator. Translate the given English text to Plains Cree."; '
      + 'no name or code is known for the target language, so whether the file names it was not checked.');
  });

  it('promptPlanLines: the Prompt line as before, then the verdict — no "Not sent" line', () => {
    const lines = promptPlanLines({ status: 'ok', prompt: { ...base, names_target: true, named_as: 'Plains Cree', first_line: 'Hi' } });
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^Prompt: {3}coach\.md REPLACES the harness's built-in prompt/);
    assert.match(lines[1], /^✓ Coaching: coach\.md: /);
    assert.doesNotMatch(lines.join('\n'), /Not sent/);
  });

  it('seam: the real prompt plan says names_target and named_as for a file that names the language', async (t) => {
    if (!arenaImportable('mt_eval_harness.prompt_plan')) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const coach = join(DIR, 'coach-sme.md');
    writeFileSync(coach, 'Translate into Northern Sami. Output only the translation.\n');
    const r = await probeRunPlan({ targetName: 'Northern Sami', prompt: { targetLang: 'Northern Sami', targetCode: 'sme', coachingFile: coach } },
      { env: ARENA_ENV(), python: { cmd: 'python3', args: [] }, timeoutMs: 60_000 });
    assert.equal(r.status, 'ok', r.error);
    assert.equal(r.prompt.names_target, true);
    assert.equal(typeof r.prompt.named_as, 'string', 'the harness reports which name it matched');
    assert.match(promptPlanLines(r)[1], /^✓ Coaching: coach-sme\.md: it replaces the built-in ".*" and names Northern Sami/);
  });
});

// -- 19. what tells two records from one source apart -------------------------------------

describe('19. speaker claims keep what distinguishes them — never one picked, never merged', () => {
  const crk = [
    { value: '10-99', source: 'elcat-v2024.1', note: 'Note: This data reflects only the speakers of Nēhiyawēwin in British Columbia; there are many other speakers and varieties of Nēhiyawēwin in Saskatchewan and Alberta.' },
    { value: '10000-99999', source: 'elcat-v2024.1' },
    { value: 4100, source: 'linguameta-452a21ad3dae' },
  ];

  it('the note travels with its claim; its sibling says the card has none', () => {
    const t = speakerClaimTexts(crk);
    assert.equal(t.length, 3);
    assert.equal(t[0], '10-99 [elcat-v2024.1] — "Note: This data reflects only the speakers of Nēhiyawēwin in British Columbia; '
      + 'there are many other speakers and varieties of Nēhiyawēwin in Saskatchewan and Alberta."');
    assert.equal(t[1], '10000-99999 [elcat-v2024.1] — no note on the card says what this record covers');
    assert.equal(t[2], '4100 [linguameta-452a21ad3dae]');
  });

  it('two records from one source with nothing on the card telling them apart: said plainly', () => {
    const t = speakerClaimTexts([{ value: '10-99', source: 'elcat-v2024.1' }, { value: '10000-99999', source: 'elcat-v2024.1' }]);
    assert.deepEqual(t, ['10-99 [elcat-v2024.1]', '10000-99999 [elcat-v2024.1]',
      'two elcat-v2024.1 records (10-99, 10000-99999) without a distinguishing note on the card']);
  });

  it('a year is carried too', () => {
    assert.deepEqual(speakerClaimTexts([{ value: 5, source: 'a', date: 2012 }, { value: 7, source: 'a', date: 2020 }]),
      ['5 [a] — (2012)', '7 [a] — (2020)']);
  });

  it('the real crk card, through the adapter: the overview shows both ELCat counts, the BC note, and the bare one said bare', async (t) => {
    const o = await languageOverview({ code: 'crk' }, {
      harnessFst: async () => ({ status: 'not-installed', how: 'no `mt-eval` on PATH' }),
      corpora: async () => ({ items: [], total: 0, hiddenQuarantined: 0, source: 'test' }),
      results: async () => [],
      contests: async () => ({ contests: [], total: 0 }),
      recommend: { recommend: () => ({ declared_models: { candidates: [] }, runnable_methods: [], curated_evidence: [], bulk_evidence: [], metric_reliability: null }) },
    });
    if (o.language?.status === 'unavailable' || !o.language?.summary) { t.skip('champollion package not resolvable here'); return; }
    const line = formatOverview(o).split('\n').find((l) => l.startsWith('Index:'));
    assert.ok(line, 'an Index line');
    const speakers = o.language.summary.speakers.filter((s) => s.source === 'elcat-v2024.1');
    if (speakers.length < 2) { t.skip('the crk card no longer carries two ELCat counts'); return; }
    for (const s of speakers) assert.ok(line.includes(`${s.value} [elcat-v2024.1]`), `${s.value} missing: ${line}`);
    const noted = speakers.find((s) => s.note);
    if (noted) assert.ok(line.includes('British Columbia'), line);
    assert.match(line, /no note on the card says what this record covers|without a distinguishing note on the card/);
  });
});
