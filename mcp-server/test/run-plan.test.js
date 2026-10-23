/**
 * Round 7, run_benchmark's plan:
 *   - names the licence and do_not_train terms the run accepts (it passes
 *     --yes) — from the harness's registry entry, or the file's own sidecar /
 *     corpus card — and says "unknown" when nobody states them;
 *   - says whether the target language's EVAL PACK (FST runtime + FST, …) is
 *     installed BEFORE the user confirms — a missing one stopped the first
 *     confirmed Cree run;
 *   - takes skip_fst / skip_eval_standard (`--skip-fst` / `--skip-eval-standard`).
 *
 * The probe's answer is injected for the plan tests; the probe itself is run
 * against the real harness when arena is importable here.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCorpusArgv, buildRunArgv, runBenchmark, awaitAllJobs, listJobs, resetJobs,
} from '../src/tools/harness.js';
import {
  evalPackPlanLines, parseEvalPackMessage, probeRunPlan, registryTermsLines,
} from '../src/tools/run-plan.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ARENA_DIR = resolve(__dirname, '../../arena');

// The harness's own message, verbatim in shape (config._check_eval_pack).
const CREE_MISSING = [
  '',
  '  EVAL PACK REQUIRED: Plains Cree (crk)',
  "  Dataset 'x' targets crk, which needs evaluation tools that are not installed. `mt-eval run` installs nothing by itself.",
  '',
  '  Missing:',
  '    ✗ pyhfst>=1.4 (pyhfst)',
  '    ✗ FST morphological analyzer (Plains Cree)',
  '',
  '  Install them (each command says what it installs):',
  '    mt-eval setup --lang crk',
  '',
  '  Or run without them — the run card marks them not computed:',
  '    --skip-fst            (no FST acceptance)',
  '',
].join('\n');

const CRK = { code: 'crk', name: 'Plains Cree', from: 'the corpus\'s registry entry' };
const EDTEKLA_ENTRY = {
  id: 'eval-eng-crk-edtekla-dev-v1', license: 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0',
  access: 'fetch-from-source', gated: null, terms_url: null, segment: 'development', do_not_train: true,
};
const probe = (over = {}) => ({ status: 'ok', version: '0.3.0', registered: true, entry: EDTEKLA_ENTRY, target: CRK,
  evalPack: { message: null, notes: [], fstPinned: true, fstRepo: 'giellalt/lang-crk', fstInstalled: true, pyhfst: true,
    declared: true, description: 'LYSS equivalence linter + FST morphological validation' }, ...over });

let DIR;
let FILE;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-run-plan-'));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
  process.env.CHAMPOLLION_MCP_DEBUG_LOG = join(DIR, 'debug.log');
  FILE = join(DIR, 'school-test.tsv');
  writeFileSync(FILE, 'hello\ttânisi\n');
  // what `champollion network register-corpus --data` writes beside it
  writeFileSync(`${FILE}.champollion.json`, JSON.stringify({ id: 'eval-eng-crk-school-v1', license: 'CC-BY-NC-4.0',
    tier: 'local-only', card: 'eval-eng-crk-school-v1.json', transmission: 'local-only' }));
  writeFileSync(join(DIR, 'eval-eng-crk-school-v1.json'), JSON.stringify({ id: 'eval-eng-crk-school-v1',
    pair: { source: 'eng', target: 'crk' }, license: { spdx: 'CC-BY-NC-4.0' }, doNotTrain: true }));
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  delete process.env.CHAMPOLLION_MCP_DEBUG_LOG;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

const ITEM = {
  id: 'eval-eng-crk-edtekla-dev-v1__openai_gpt-5.5__naive', language_pair: 'eng>crk', target_language: 'Plains Cree',
  corpus_id: 'eval-eng-crk-edtekla-dev-v1', corpus_license: 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0',
  model: 'openai/gpt-5.5', condition: 'naive', est_cost_usd: 0.02,
};

function deps(answer = probe()) {
  const asked = [];
  const calls = [];
  return {
    asked,
    calls,
    handle: {
      isMtEvalInstalled: async () => true,
      lookupQueueItem: async ({ id }) => ({ item: id === ITEM.id ? ITEM : null, covered: false }),
      execCapture: async (cmd, args) => { calls.push(args); return { code: 0, stdout: 'ok', stderr: '' }; },
      env: {},
      methodRegistry: { entries: { openrouter: { kind: 'llm-provider' }, local: { kind: 'llm-provider', default_base_url: 'http://localhost:11434/v1' } } },
      runPlanProbe: async (input) => { asked.push(input); return typeof answer === 'function' ? answer(input) : answer; },
      metricsProbe: async () => ({ status: 'not-installed', error: 'not asked in this test' }),
    },
  };
}

describe('the eval-pack lines', () => {
  it('reads the harness\'s own EVAL PACK REQUIRED message', () => {
    assert.deepEqual(parseEvalPackMessage(CREE_MISSING), {
      missing: ['pyhfst>=1.4 (pyhfst)', 'FST morphological analyzer (Plains Cree)'],
      commands: ['mt-eval setup --lang crk'],
      skips: ['--skip-fst'],
    });
  });

  it('missing: names the pieces, the setup command, that the run would stop, and skip_fst', () => {
    const { state, lines } = evalPackPlanLines(probe({ evalPack: { ...probe().evalPack, message: CREE_MISSING, fstInstalled: false, pyhfst: false } }));
    assert.equal(state, 'missing');
    assert.equal(lines[0], 'EVAL PACK: missing — pyhfst>=1.4 (pyhfst), FST morphological analyzer (Plains Cree); '
      + 'set it up with: mt-eval setup --lang crk');
    assert.match(lines[1], /STOPS before translating \(nothing is spent\)/);
    assert.match(lines[1], /skip_fst: true \(no FST acceptance\)/);
  });

  it('a pinned FST that is not installed is missing even when the language declares no pack', () => {
    const { state, lines } = evalPackPlanLines(probe({ evalPack: { message: null, notes: [], fstPinned: true,
      fstRepo: 'giellalt/lang-kal', fstInstalled: false, pyhfst: true, declared: false },
    target: { code: 'kal', name: 'Kalaallisut', from: 'the target language name' } }));
    assert.equal(state, 'missing');
    assert.match(lines[0], /^EVAL PACK: missing — the Kalaallisut FST \(giellalt\/lang-kal\); set it up with: mt-eval setup --lang kal$/);
    assert.match(lines[1], /skip_fst: true/);
  });

  it('uses the harness\'s own dry-run lines when the harness gives them (one wording)', () => {
    const harnessLines = ['EVAL PACK: missing — pyhfst>=1.4 (pyhfst), FST morphological analyzer (Plains Cree); '
      + 'set it up with: mt-eval setup --lang crk; or pass --skip-fst to score without them (marked not computed)',
    'EVAL PACK: the real run stops on this before translating anything.'];
    const { state, lines } = evalPackPlanLines(probe({ evalPack: { ...probe().evalPack, message: CREE_MISSING,
      fstInstalled: false, pyhfst: false, harnessStatus: 'missing', harnessLines } }));
    assert.equal(state, 'missing');
    assert.deepEqual(lines.slice(0, 2), harnessLines);
    assert.match(lines[2], /skip_fst \/ skip_eval_standard/);
    // an FST gap the card's pack check does not list keeps the MCP's own check
    const gap = evalPackPlanLines(probe({ evalPack: { message: null, notes: [], fstPinned: true,
      fstRepo: 'giellalt/lang-kal', fstInstalled: false, pyhfst: true, declared: false,
      harnessStatus: 'not_needed', harnessLines: ['EVAL PACK: none needed for Kalaallisut (kal)'] },
    target: { code: 'kal', name: 'Kalaallisut', from: 'the target language name' } }));
    assert.equal(gap.state, 'missing');
    assert.match(gap.lines[0], /the Kalaallisut FST/);
  });

  it('only the FST missing (harness 2026-10-04+): the plan says the run PROCEEDS, never that it stops (Round 8)', () => {
    const harnessLines = ['EVAL PACK: missing — pyhfst>=1.4 (pyhfst), FST morphological analyzer (Plains Cree); nothing '
      + 'downloads unless you run: mt-eval setup --lang crk (--skip-fst leaves it out without this notice)',
    'EVAL PACK: the real run is not stopped by it — it proceeds and FST acceptance and morphology are marked not '
      + 'computed; after installing, `mt-eval test <run log>` re-scores it without re-translating.'];
    const { state, lines } = evalPackPlanLines(probe({ evalPack: { ...probe().evalPack, message: null,
      fstInstalled: false, pyhfst: false, harnessStatus: 'missing', harnessStopsRun: false, harnessLines } }));
    assert.equal(state, 'missing');
    assert.deepEqual(lines.slice(0, 2), harnessLines);
    assert.match(lines[2], /The run PROCEEDS without it/);
    assert.match(lines[2], /mt-eval test <run log>/);
    assert.doesNotMatch(lines.join('\n'), /STOPS|stops on this/);
  });

  it('ready / skipped / none needed / not checked / cannot tell', () => {
    assert.match(evalPackPlanLines(probe()).lines[0],
      /^EVAL PACK: ready for Plains Cree \(crk\) \(FST giellalt\/lang-crk installed, runtime pyhfst; LYSS/);
    const skipped = evalPackPlanLines(probe({ evalPack: { ...probe().evalPack, fstInstalled: false } }), { skipFst: true, skipEvalStandard: true });
    assert.equal(skipped.state, 'ready', 'a skipped FST is not a missing one');
    assert.match(skipped.lines[0], /FST skipped \(skip_fst — FST acceptance marked not computed\); eval-standard metrics skipped/);
    const none = evalPackPlanLines(probe({ target: { code: 'fra', name: 'French' },
      evalPack: { message: null, notes: [], fstPinned: false, declared: false } }));
    assert.deepEqual(none, { state: 'none', lines: ['EVAL PACK: none needed for French (fra)'] });
    assert.match(evalPackPlanLines(probe({ target: undefined })).lines[0], /^EVAL PACK: not checked — .*pass target_language/);
    const failed = evalPackPlanLines({ status: 'error', error: 'the harness did not answer within 25s' });
    assert.equal(failed.state, 'unknown');
    assert.match(failed.lines[0], /^EVAL PACK: cannot tell — asking the harness failed \(the harness did not answer within 25s\)/);
  });
});

describe('the licence / do_not_train lines', () => {
  it('a registered corpus: its licence (accepted by --yes on a fetch) and do_not_train', () => {
    const lines = registryTermsLines(probe(), EDTEKLA_ENTRY.id);
    assert.match(lines[0], /^Licence:  LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4\.0 — the harness's registry entry for eval-eng-crk-edtekla-dev-v1; the run passes --yes, which ACCEPTS this licence/);
    assert.match(lines[1], /^Training: do_not_train: true — evaluation only/);
  });

  it('an unstated do_not_train, or an entry the harness does not have, is "unknown" — never invented', () => {
    assert.match(registryTermsLines(probe({ entry: { ...EDTEKLA_ENTRY, do_not_train: 'unstated' } }), 'x')[1], /do_not_train unknown/);
    assert.match(registryTermsLines(probe({ entry: { ...EDTEKLA_ENTRY, do_not_train: false } }), 'x')[1], /do_not_train: false — the registry does not forbid/);
    const missing = registryTermsLines(probe({ entry: undefined, registered: false }), 'eval-x');
    assert.match(missing[0], /^Licence:  unknown — the harness's registry has no entry for eval-x/);
    assert.match(missing[1], /do_not_train unknown/);
    const failed = registryTermsLines({ status: 'error', error: 'boom' }, ITEM.corpus_id, { fallbackLicense: ITEM.corpus_license });
    assert.match(failed[0], /^Licence:  LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4\.0 — as the queue item states it; asking the harness failed \(boom\)/);
    assert.match(failed[1], /do_not_train unknown/);
  });
});

describe('run_benchmark plans (corpus mode)', () => {
  it('a registry corpus dry run: EVAL PACK first, then the licence and do_not_train it accepts', async () => {
    const d = deps(probe({ evalPack: { ...probe().evalPack, message: CREE_MISSING, fstInstalled: false, pyhfst: false } }));
    const out = await runBenchmark({ corpus: EDTEKLA_ENTRY.id, provider: 'local', model: 'llama3.1',
      target_language: 'Plains Cree', dry_run: true }, d.handle);
    const lines = out.split('\n');
    const pack = lines.findIndex((l) => l.startsWith('EVAL PACK: missing'));
    const corpusLine = lines.findIndex((l) => l.startsWith('Corpus:'));
    assert.ok(pack > 0 && pack < corpusLine, 'the eval-pack status leads the plan');
    assert.match(out, /Licence:  LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4\.0 — the harness's registry entry/);
    assert.match(out, /Training: do_not_train: true/);
    assert.deepEqual(d.asked[0], { datasetId: EDTEKLA_ENTRY.id, targetName: 'Plains Cree', targetCode: null,
      targetCodeFrom: null, localOnly: false, skipFst: false, skipEvalStandard: false,
      // the prompt the run would send, asked of the harness's prompt builder (Round 11)
      prompt: { targetLang: 'Plains Cree', targetCode: '', sourceLang: '', sourceCode: '', coachingFile: '',
        targetScript: '', corpusPath: '', sourceField: '', targetField: '' } });
    assert.equal(d.calls.length, 0, 'a plan runs nothing');
  });

  it('the confirmation prompt carries the same lines; a confirmed run does not re-ask', async () => {
    const d = deps();
    const plan = await runBenchmark({ corpus: EDTEKLA_ENTRY.id, provider: 'local', model: 'llama3.1' }, d.handle);
    assert.match(plan, /^CONFIRMATION REQUIRED/);
    assert.match(plan, /EVAL PACK: ready for Plains Cree/);
    assert.match(plan, /Training: do_not_train: true/);
    await runBenchmark({ corpus: EDTEKLA_ENTRY.id, provider: 'local', model: 'llama3.1', confirm: true }, d.handle);
    await awaitAllJobs();
    assert.equal(d.asked.length, 1, 'the harness gates the confirmed run itself');
  });

  it('a file the user holds: its sidecar / card licence and do_not_train, and the card\'s target for the pack check', async () => {
    const d = deps(probe({ entry: undefined, registered: undefined }));
    const out = await runBenchmark({ corpus: FILE, provider: 'local', model: 'llama3.1', dry_run: true }, d.handle);
    assert.match(out, /Licence:  CC-BY-NC-4\.0 — the steward's sidecar/);
    assert.match(out, /Training: do_not_train: true — evaluation only: never put this file.*the corpus card the sidecar names/);
    assert.match(out, /your file is read in place, nothing is fetched/);
    assert.equal(d.asked[0].datasetId, null);
    assert.equal(d.asked[0].targetCode, 'crk');
    assert.equal(d.asked[0].localOnly, true);
  });

  it('a file that states nothing: licence and do_not_train are unknown', async () => {
    const bare = join(DIR, 'bare.jsonl');
    writeFileSync(bare, '{"source":"a","reference":"b"}\n');
    const out = await runBenchmark({ corpus: bare, provider: 'local', model: 'llama3.1', dry_run: true }, deps().handle);
    assert.match(out, /Licence:  unknown — your file states none/);
    assert.match(out, /Training: do_not_train unknown/);
  });
});

describe('run_benchmark plans (item mode)', () => {
  it('names the corpus terms and eval pack from the harness; falls back to the queue item\'s licence', async () => {
    let d = deps();
    let out = await runBenchmark({ item_id: ITEM.id, dry_run: true }, d.handle);
    assert.match(out, /EVAL PACK: ready for Plains Cree/);
    assert.match(out, /Training: do_not_train: true/);
    assert.deepEqual({ ds: d.asked[0].datasetId, name: d.asked[0].targetName }, { ds: ITEM.corpus_id, name: 'Plains Cree' });
    d = deps({ status: 'error', error: 'the harness gave no answer (exit 1)' });
    out = await runBenchmark({ item_id: ITEM.id }, d.handle);
    assert.match(out, /^CONFIRMATION REQUIRED/);
    assert.match(out, /Licence:  LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4\.0 — as the queue item states it/);
    assert.match(out, /do_not_train unknown/);
    assert.match(out, /EVAL PACK: cannot tell/);
  });
});

describe('skip_fst / skip_eval_standard', () => {
  it('reach mt-eval as --skip-fst / --skip-eval-standard (item + corpus), never unless asked', async () => {
    assert.ok(!buildRunArgv(ITEM).includes('--skip-fst'));
    const item = buildRunArgv(ITEM, { skipFst: true, skipEvalStandard: true });
    assert.ok(item.includes('--skip-fst') && item.includes('--skip-eval-standard'));
    const { argv } = buildCorpusArgv({ corpus: EDTEKLA_ENTRY.id, model: 'm', skip_fst: true }, { env: {} });
    assert.ok(argv.includes('--skip-fst') && !argv.includes('--skip-eval-standard'));

    const d = deps();
    const plan = await runBenchmark({ corpus: EDTEKLA_ENTRY.id, provider: 'local', model: 'llama3.1',
      skip_fst: true, skip_eval_standard: true, dry_run: true }, d.handle);
    assert.match(plan, /mt-eval run .*--skip-fst --skip-eval-standard/);
    assert.match(plan, /Scoring:  without FST acceptance \(skip_fst → --skip-fst\)/);
    assert.match(plan, /Scoring:  without the eval-standard metrics/);
    assert.equal(d.asked[0].skipFst, true, 'the pack check honours the skip');
    await runBenchmark({ item_id: ITEM.id, skip_fst: true, confirm: true }, d.handle);
    await awaitAllJobs();
    assert.ok(d.calls.at(-1).includes('--skip-fst'), 'the confirmed item run carries it');
    assert.equal(listJobs().length, 1);
  });

  it('a queue run refuses them (`mt-eval queue` has no such flags)', async () => {
    const out = await runBenchmark({ top: 3, skip_fst: true, confirm: true }, deps().handle);
    assert.match(out, /^REFUSED — skip_fst \/ skip_eval_standard apply to item and corpus runs/);
  });
});

describe('the probe against the real harness', () => {
  const available = (() => {
    if (!existsSync(ARENA_DIR)) return false;
    try {
      execFileSync('python3', ['-c', 'import mt_eval_harness.config, mt_eval_harness.language_cards'],
        { env: { ...process.env, PYTHONPATH: ARENA_DIR }, timeout: 30_000, stdio: 'ignore' });
      return true;
    } catch { return false; }
  })();

  it('answers with the registry entry, the target, and an eval-pack verdict', async (t) => {
    if (!available) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const env = { ...process.env, PYTHONPATH: ARENA_DIR };
    const p = await probeRunPlan({ datasetId: 'eval-eng-crk-edtekla-dev-v1' }, { env, python: { cmd: 'python3', args: [] } });
    assert.equal(p.status, 'ok', p.error);
    assert.equal(p.entry.id, 'eval-eng-crk-edtekla-dev-v1');
    assert.equal(p.entry.do_not_train, true);
    assert.match(p.entry.license, /^LicenseRef-EdTeKLA/);
    assert.equal(p.target.code, 'crk');
    assert.ok(['missing', 'ready'].includes(evalPackPlanLines(p).state), JSON.stringify(p.evalPack));
    // the harness's own dry-run wording comes through (mt-eval run --dry-run prints the same lines)
    assert.ok(Array.isArray(p.evalPack.harnessLines) && p.evalPack.harnessLines[0].startsWith('EVAL PACK: '),
      JSON.stringify(p.evalPack));
    const byName = await probeRunPlan({ targetName: 'French' }, { env, python: { cmd: 'python3', args: [] } });
    assert.equal(byName.target.code, 'fra');
    assert.equal(evalPackPlanLines(byName).lines[0], 'EVAL PACK: none needed for French (fra)');
  });
});

// Round 8, hospital persona: a private-use code (qaa) and target_language
// "Ayta (variety not yet confirmed)". No card exists for either, so no card
// gives a name — the name the user passed IS the name. The plan told them to
// "pass target_language" although they had; that advice is for a plan that
// names no language at all.
describe('a target with no card: the name the user passed is the name', () => {
  const AYTA = 'Ayta (variety not yet confirmed)';

  it('a name no card resolves is named as given, never answered with "pass target_language"', () => {
    const r = evalPackPlanLines(probe({ target: undefined, evalPack: undefined }), { targetName: AYTA });
    assert.equal(r.state, 'none');
    assert.equal(r.lines[0], `EVAL PACK: none needed for "${AYTA}" (no language card resolved for the target) — the `
      + 'harness resolves no code from that target_language and the corpus states none, so no card declares '
      + 'evaluation tools for it; the prompt names the language as given.');
    assert.doesNotMatch(r.lines.join('\n'), /pass target_language/);
    // ...and the advice still stands when no name was passed at all
    assert.match(evalPackPlanLines(probe({ target: undefined }), { targetName: '  ' }).lines[0], /pass target_language/);
  });

  it('a private-use code with no card name takes the passed name (the MCP\'s own wording)', () => {
    const qaa = probe({ target: { code: 'qaa', name: null, from: 'the corpus card' },
      evalPack: { message: null, notes: [], fstPinned: false, declared: false } });
    assert.deepEqual(evalPackPlanLines(qaa, { targetName: AYTA }), { state: 'none', lines: [`EVAL PACK: none needed for ${AYTA} (qaa)`] });
    assert.deepEqual(evalPackPlanLines(qaa), { state: 'none', lines: ['EVAL PACK: none needed for qaa'] },
      'no name from the card or the caller: the code alone, not "qaa (qaa)"');
  });

  it('run_benchmark: the plan for a file run with that name says so; the probe was asked with it', async () => {
    const bare = join(DIR, 'ayta-ward.jsonl');
    writeFileSync(bare, '{"source":"Where does it hurt?","reference":"x"}\n');
    const d = deps({ status: 'ok', version: '0.2.0' }); // the harness resolved no target
    const out = await runBenchmark({ corpus: bare, provider: 'local', model: 'llama3.1', target_language: AYTA, dry_run: true }, d.handle);
    assert.equal(d.asked[0].targetName, AYTA);
    assert.match(out, new RegExp(`^EVAL PACK: none needed for "${AYTA.replace(/[()]/g, '\\$&')}" \\(no language card resolved for the target\\)`, 'm'));
    assert.doesNotMatch(out, /pass target_language/, 'it was passed');

    // the same file with a corpus card naming qaa: the code is checked, the passed name labels it
    writeFileSync(`${bare}.champollion.json`, JSON.stringify({ id: 'eval-eng-qaa-ward-v1', card: 'eval-eng-qaa-ward-v1.json' }));
    writeFileSync(join(DIR, 'eval-eng-qaa-ward-v1.json'), JSON.stringify({ id: 'eval-eng-qaa-ward-v1', pair: { source: 'eng', target: 'qaa' } }));
    const d2 = deps((input) => ({ status: 'ok', version: '0.2.0',
      target: { code: input.targetCode, name: null, from: input.targetCodeFrom },
      evalPack: { message: null, notes: [], fstPinned: false, declared: false } }));
    const out2 = await runBenchmark({ corpus: bare, provider: 'local', model: 'llama3.1', target_language: AYTA, dry_run: true }, d2.handle);
    assert.equal(d2.asked[0].targetCode, 'qaa');
    assert.match(out2, new RegExp(`^EVAL PACK: none needed for ${AYTA.replace(/[()]/g, '\\$&')} \\(qaa\\)$`, 'm'));
    assert.doesNotMatch(out2, /pass target_language/);
  });

  it('against the real harness: its own dry-run line names the passed name for a code with no card', async (t) => {
    const available = (() => {
      if (!existsSync(ARENA_DIR)) return false;
      try {
        execFileSync('python3', ['-c', 'import mt_eval_harness.config, mt_eval_harness.language_cards'],
          { env: { ...process.env, PYTHONPATH: ARENA_DIR }, timeout: 30_000, stdio: 'ignore' });
        return true;
      } catch { return false; }
    })();
    if (!available) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const env = { ...process.env, PYTHONPATH: ARENA_DIR };
    const python = { cmd: 'python3', args: [] };
    const withCode = await probeRunPlan({ targetName: AYTA, targetCode: 'qaa', targetCodeFrom: 'the corpus card' }, { env, python });
    assert.equal(withCode.status, 'ok', withCode.error);
    assert.equal(withCode.target.code, 'qaa');
    assert.equal(withCode.target.name, null, 'premise: no card names qaa');
    // the harness's own line, which since Round 9 also says why there is no
    // card: a private-use code has none by design (not a lookup failure)
    assert.deepEqual(evalPackPlanLines(withCode, { targetName: AYTA }).lines, [`EVAL PACK: none needed for ${AYTA} (qaa) `
      + '— an ISO 639-3 private-use code (qaa–qtz): no language card exists for it, by design']);
    assert.equal(withCode.target.privateUse, true);
    assert.deepEqual(withCode.target.scripts, []);
    const nameOnly = await probeRunPlan({ targetName: AYTA }, { env, python });
    assert.equal(nameOnly.status, 'ok', nameOnly.error);
    assert.equal(nameOnly.target, undefined, 'premise: the name resolves to no card');
    const lines = evalPackPlanLines(nameOnly, { targetName: AYTA }).lines.join('\n');
    assert.match(lines, /^EVAL PACK: none needed for "Ayta \(variety not yet confirmed\)"/);
    assert.doesNotMatch(lines, /pass target_language/);
  });
});
