/**
 * Round 10 synthetic personas (hospital: an unconfirmed Ayta variety under the
 * private-use code qaa; school: eng→crk; researcher: eng→sme), 2026-10-04.
 *
 *   1/3. Every MCP text that names a baseline on the user's own test set puts
 *        forge's register → leak-audit → preregistration first (the overview,
 *        the private-use overview, get_language, the private-test-set
 *        guardrail, run_benchmark's plan for a file).
 *   4.   search_languages / get_language show a location fact only with its
 *        source (the published projection carries none: not shown, said why).
 *   8.   forge_preflight's `next` names the real next step when every gate
 *        passed.
 *  11.   get_run_status prints the compare command for where run_benchmark's
 *        reports actually land.
 *  13.   A local-model plan says confirming downloads the weights: how much,
 *        and where.
 *  14.   forge_discover says when its card source lacks lexical resources the
 *        CLI's card cites — each attributed, nothing invented.
 *  16.   forge_split takes register: true; out defaults to data/split.
 *  19.   get_results on an empty board says publishing is explicit; the plan
 *        for a harness-JSON file reads its own dataset block.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { formatOverview, languageOverview } from '../src/tools/overview.js';
import { getLanguage, formatLanguage } from '../src/tools/language-card.js';
import { trainingGuardrails, formatTrainingGuardrails } from '../src/tools/training.js';
import { forgeBeforeBaselineSteps } from '../src/tools/register-corpus-hint.js';
import {
  forgeOrderLines, localModelWeightsLines, downloadSize, huggingFaceHubCache,
} from '../src/tools/plan-notes.js';
import { compareCommand, corpusEnvelope, runBenchmark, buildCorpusArgv } from '../src/tools/harness.js';
import { formatResults } from '../src/tools/results.js';
import { discoverCardCrossCheck, preflightNextHint } from '../src/tools/forge.js';

const POSIX = process.platform !== 'win32';

// -- 1/3. predictions before any baseline -------------------------------------

describe('1/3. forge registration, the leak audit and the predictions come before any baseline', () => {
  const at = (text, re) => { const m = text.match(re); assert.ok(m, String(re)); return m.index; };

  it('the private-use overview orders them like the guide', async () => {
    const o = await languageOverview({ code: 'qaa' }, { index: [] });
    const text = formatOverview(o);
    assert.ok(at(text, /forge_init \{ "code": "qaa", "no_card": true/) < at(text, /run_benchmark \{/));
    assert.ok(at(text, /forge_prereg \{/) < at(text, /run_benchmark \{/));
    assert.match(text, /^3\. If a model may ever be trained on your data: register, screen, predict — BEFORE any score\./m);
    assert.match(text, /^4\. Baseline — .*after step 3's predictions if you may train against it/m);
    assert.match(text, /^5\. Build, in the step-3 project: forge_split/m);
    assert.match(text, /^7\. When the community confirms the variety/m);
    assert.doesNotMatch(text, /^(\d)\..*\n(?:.*\n)*^\1\./m, 'no step number repeats');
  });

  it('get_language on a private-use code names the predictions before the baseline', async () => {
    const r = await getLanguage('qaa', { index: [] });
    assert.ok(r.note.indexOf('predictions BEFORE any baseline') < r.note.indexOf('then the baseline'));
  });

  it('the private-test-set guardrail says forge comes before register-corpus\'s suggested benchmark', () => {
    const text = formatTrainingGuardrails(trainingGuardrails('private-test-set'));
    assert.ok(text.includes(forgeBeforeBaselineSteps()), text);
    assert.match(text, /if a model may be trained, do forge's steps FIRST/);
  });

  it('the shared step names its own twin-free file, never the all-data one', () => {
    const t = forgeBeforeBaselineSteps({ code: 'crk' });
    assert.match(t, /"clean_to": "corpus\.clean\.jsonl"/);
    assert.match(t, /drop_test_twins with its OWN clean_to, "corpus\.notwins\.jsonl"/);
  });

  it('a run_benchmark plan for a file says the benchmark is a scoring read', () => {
    const fresh = forgeOrderLines('/x/test.tsv', { exists: () => false });
    assert.equal(fresh.length, 1);
    assert.match(fresh[0], /^Forge: {4}a benchmark of the test file is a scoring read/);
    assert.match(fresh[0], /forge_register_eval .* → forge_leak_audit .* → forge_prereg_template → forge_prereg/);
    const log = '{"event": "watch", "tool": "nmt-forge", "set": "project-test", "role": "test", "sha256": "ab"}\n'
      + '{"event": "read", "tool": "mt-eval"}\n';
    const watched = forgeOrderLines('/x/test.tsv', { exists: () => true, read: () => log });
    assert.match(watched[0], /registered with nmt-forge as project-test \(role test\)/);
    assert.match(watched[0], /Write every planned model's preregistration BEFORE you confirm/);
    assert.match(watched[0], /missing-preregistration/);
  });
});

// -- 4. a displayed fact cites its source ---------------------------------------

describe('4. get_language shows a location only with its source', () => {
  const pkg = (card) => ({
    getCardSourceInfo: () => ({ mode: 'packaged' }),
    resolveCode: (c) => c,
    prefetchLanguageCards: async (codes) => ({ fetched: codes, missing: [], failed: [], skipped: [] }),
    getLanguageCard: () => card,
    normalizeCard: (c) => c,
  });
  const base = {
    code: 'abp', name: 'Abellen Ayta', iso639_3: 'abp', macroarea: 'Papunesia', countries: ['PH'],
    classification: { family: 'Austronesian' }, _remote: { source: 'supabase', updatedAt: '2026-10-01' },
  };

  it('the published projection (no stamps): the facts are not shown, and the line says why', async () => {
    const r = await getLanguage('abp', { champollion: pkg({ ...base }) });
    const text = formatLanguage(r);
    assert.doesNotMatch(text, /Where: macroarea Papunesia|countries PH/);
    assert.match(text, /Where: location facts not shown — the published card projection carries no per-field source/);
  });

  it('a stamped card: every fact with its source', async () => {
    const card = { ...base, _fieldSources: { macroarea: ['glottolog-cldf-v5.3'], countries: ['glottolog-v5.3'] } };
    const text = formatLanguage(await getLanguage('abp', { champollion: pkg(card) }));
    assert.match(text, /Where: macroarea Papunesia \[glottolog-cldf-v5\.3\]; countries PH \[glottolog-v5\.3\]/);
    assert.doesNotMatch(text, /not shown/);
  });
});

// -- 8. preflight's next step ----------------------------------------------------

describe('8. forge_preflight names the actual next step', () => {
  it('all green: the command itself, not "fix every gate"', () => {
    const gates = [{ gate: 'config', ok: true }, { gate: 'dev-fence', ok: true }];
    const n = preflightNextHint('run', 'config-notwins.json', gates);
    assert.match(n, /^every gate passed\. Next: `nmt-forge run config-notwins\.json` in a terminal/);
    assert.doesNotMatch(n, /ok:false/);
  });

  it('warnings are relayed first; failures are fixed first', () => {
    const warn = preflightNextHint('run', undefined, [{ gate: 'config', ok: true },
      { gate: 'test-near-twins', ok: true, warning: true }]);
    assert.match(warn, /first relay the warning \(test-near-twins/);
    assert.match(warn, /`nmt-forge run config\.json`/);
    const fail = preflightNextHint('export', undefined, [{ gate: 'preregistration', ok: false }]);
    assert.match(fail, /^fix the gate with ok:false .*\(preregistration\)/);
    assert.match(preflightNextHint('export', undefined, [{ gate: 'x', ok: true }]), /Next: forge_export\./);
  });
});

// -- 11. the compare command where reports land ------------------------------------

describe('11. get_run_status prints the compare command for run_benchmark\'s reports', () => {
  it('beside the corpus, every mcp-run folder', () => {
    assert.equal(compareCommand({ resultsDir: '/data/proj/results/mcp-run-abc123' }),
      'mt-eval compare /data/proj/results/mcp-run-*/*_report.json --significance');
    assert.equal(compareCommand({ resultsDir: '/my proj/results/mcp-run-abc' }),
      'mt-eval compare "/my proj/results"/mcp-run-*/*_report.json --significance');
    assert.equal(compareCommand({ resultsDir: '/home/x/.champollion-mcp/jobs/run-1/results' }), null);
  });

  it('the guide\'s compare step names both places', () => {
    const guide = readFileSync(new URL('../../cli/website/docs/build-mt-for-your-language.md', import.meta.url), 'utf-8');
    assert.match(guide, /data\/results\/mcp-run-\*\/\*_report\.json/);
  });
});

// -- 13. what a local-model confirm downloads -----------------------------------

describe('13. a local-model plan says what confirming downloads', () => {
  const siblings = [
    { rfilename: 'config.json', size: 1000 },
    { rfilename: 'model.safetensors', size: 2_460_000_000 },
    { rfilename: 'pytorch_model.bin', size: 2_460_000_000 },
    { rfilename: 'tokenizer.json', size: 17_000_000 },
    { rfilename: 'onnx/model.onnx', size: 9_000_000_000 },
  ];

  it('counts the files from_pretrained fetches, never the whole repo', () => {
    const d = downloadSize(siblings);
    assert.equal(d.bytes, 2_460_000_000 + 1000 + 17_000_000);
    assert.equal(d.weights, '.safetensors weights');
    assert.ok(d.repoBytes > d.bytes);
  });

  it('a Hub id not in the cache: download, size and destination', async () => {
    const lines = await localModelWeightsLines('org/model', {
      env: { HF_HOME: '/hf' }, exists: () => false, isDir: () => false,
      listing: async () => ({ ok: true, siblings }),
    });
    assert.match(lines[0], /^Weights: {2}confirming DOWNLOADS org\/model from huggingface\.co into \/hf\/hub/);
    assert.match(lines[0], /about 2\.5 GB \(the \.safetensors weights plus config and tokenizer files/);
    assert.match(lines[0], /Ask the user before confirming a large download/);
  });

  it('cached, a directory, or the Hub silent: each said as it is', async () => {
    const cached = await localModelWeightsLines('org/model', { env: { HF_HUB_CACHE: '/c' }, exists: () => true, isDir: () => false });
    assert.match(cached[0], /already in the Hugging Face cache \(\/c\/models--org--model\)/);
    const dir = await localModelWeightsLines('/m/export/model', { isDir: () => true });
    assert.match(dir[0], /loaded from the directory \/m\/export\/model on this machine — nothing is downloaded/);
    const silent = await localModelWeightsLines('org/model', {
      env: {}, exists: () => false, isDir: () => false,
      listing: async () => ({ ok: false, error: 'the Hub did not answer within 8 s' }),
    });
    assert.match(silent[0], /size unknown — the Hub did not answer within 8 s/);
  });

  it('the cache location follows huggingface_hub\'s rule', () => {
    assert.equal(huggingFaceHubCache({ HF_HUB_CACHE: '/a' }), '/a');
    assert.equal(huggingFaceHubCache({ HF_HOME: '/b' }), join('/b', 'hub'));
    assert.equal(huggingFaceHubCache({ XDG_CACHE_HOME: '/x' }), join('/x', 'huggingface', 'hub'));
  });
});

// -- 14. two card readers, side by side ------------------------------------------

describe('14. forge_discover says when its card source lacks what the CLI card cites', () => {
  const cli = {
    status: 'ok', tier: 'bundled',
    summary: { provenance: { tier: 'bundled' }, resources: {
      dictionaries: [{ name: 'dict-crk-eng', publisher: 'giellalt', url: 'https://x', license: 'CC-BY-4.0' }],
      documentation: { level: 'long grammar', source: 'glottolog-v5.3' },
    } },
  };

  it('a public-index read with no dictionary or grammar: both shown, attributed', () => {
    const x = discoverCardCrossCheck({ card_path: 'public card index (…)', dictionaries: [], grammars: [], documentation: null }, cli);
    assert.equal(x.forge_source, 'public card index (…)');
    assert.equal(x.cli_card, 'bundled');
    assert.deepEqual(x.dictionaries, [{ name: 'dict-crk-eng', publisher: 'giellalt', url: 'https://x', license: 'CC-BY-4.0' }]);
    assert.deepEqual(x.documentation, { level: 'long grammar', source: 'glottolog-v5.3' });
    assert.match(x.note, /forge read public card index \(…\), which lists no dictionary or grammar\/documentation level/);
    assert.match(x.note, /champollion network card <code> --json > cards\/<code>\.json/);
  });

  it('nothing differs, or no CLI card: no claim', () => {
    assert.equal(discoverCardCrossCheck({ dictionaries: [{ name: 'd' }], documentation: { med_level: 'x' } }, cli), null);
    assert.equal(discoverCardCrossCheck({ dictionaries: [] }, null), null);
    assert.equal(discoverCardCrossCheck({ dictionaries: [] }, { status: 'ok', summary: { resources: {} } }), null);
  });
});

// -- 19. publishing is explicit; a file's own envelope is read --------------------

describe('19. publishing is explicit, and the plan reads the file\'s own dataset block', () => {
  it('an empty board never implies a run publishes by itself', () => {
    const text = formatResults([]);
    assert.doesNotMatch(text, /your run publishes here/);
    assert.match(text, /A benchmark never\s+publishes by itself/);
    assert.match(text, /publish: true/);
    assert.match(text, /publish_report/);
  });

  it('a contest dev file\'s licence and pair come from its dataset block', () => {
    const dir = mkdtempSync(join(tmpdir(), 'r10-env-'));
    try {
      const f = join(dir, 'eval-eng-sme-qualifier.json');
      writeFileSync(f, JSON.stringify({ dataset: { corpus_id: 'q', language_pair: { source: 'eng', target: 'sme' },
        license: 'CC-BY-2.0' }, entries: [{ id: '1', source: 'a', reference: 'b' }] }));
      const env = corpusEnvelope(f);
      assert.deepEqual({ ...env, from: undefined }, { from: undefined, license: 'CC-BY-2.0', doNotTrain: null,
        source: 'eng', target: 'sme', id: null, transmission: null });
      assert.doesNotMatch(JSON.stringify(env), /"a"|"b"/, 'no entry leaves the reader');
      const b = buildCorpusArgv({ corpus: f, method: 'local-model', model: 'org/m' },
        { env: {}, mtMethods: ['local-model'], methodEntries: { 'local-model': { kind: 'local-model' } } });
      assert.equal(b.terms.license, 'CC-BY-2.0');
      assert.match(b.terms.licenseFrom, /the corpus file's own dataset block/);
      assert.equal(b.target.code, 'sme');
      assert.equal(b.source.code, 'eng');
      assert.ok(b.argv.includes('--target-lang-code') && b.argv.includes('sme'));
      // the compact string form, as the harness reads it
      writeFileSync(f, JSON.stringify({ dataset: { language_pair: 'eng-sme', transmission: 'local-only' }, entries: [] }));
      assert.equal(corpusEnvelope(f).target, 'sme');
      // dataset.transmission local-only: a remote run is refused up front, as the harness would
      assert.throws(() => buildCorpusArgv({ corpus: f, model: 'openai/gpt-5.5' }, { env: {} }), /LOCAL-ONLY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the plan for that file states its licence and pair', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'r10-plan-'));
    try {
      const f = join(dir, 'dev.json');
      writeFileSync(f, JSON.stringify({ dataset: { language_pair: { source: 'eng', target: 'sme' }, license: 'CC-BY-2.0' },
        entries: [] }));
      const plan = await runBenchmark({ corpus: f, provider: 'local', model: 'stub-1', dry_run: true }, {
        isMtEvalInstalled: async () => true, env: {},
        methodRegistry: { entries: { local: { kind: 'llm', default_base_url: 'http://127.0.0.1:11434/v1' } } },
        runPlanProbe: async () => ({ status: 'ok', target: { code: 'sme', name: 'Northern Sami', from: 'x' }, evalPack: {} }),
        localModelWeights: async () => [],
        forgeOrder: () => [],
      });
      assert.match(plan, /^Licence: {2}CC-BY-2\.0 — the corpus file's own dataset block/m);
      assert.match(plan, /^Source: {3}eng — from the corpus file's own dataset block/m);
      assert.doesNotMatch(plan, /Licence: {2}unknown|does not state its source language|no target_language given/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// -- 16 + the MCP tools through a stub forge ---------------------------------------

const STUB = String.raw`
const fs = require('node:fs');
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_FORGE_LOG, JSON.stringify({ argv }) + '\n');
const out = (o, code = 0) => { fs.writeSync(1, JSON.stringify(o) + '\n'); process.exit(code); };
const i = argv.indexOf('--workspace');
const rest = i >= 0 ? argv.slice(i + 2) : argv;
const [cmd, sub] = rest;
if (cmd === 'split') out({ rows: 10, paths: {}, registered: [], near_twin: null, dev_near_twin: null,
  config_check: { ok: false, message: 'config.json trains on data/split/train.jsonl, which does not exist — this split wrote its train side to data/train.jsonl',
    fix: 'in config.json set data.gold to ["data/train.jsonl"]' } });
if (cmd === 'preflight') out([{ gate: 'config', ok: true, detail: 'parses', fix: '' },
  { gate: 'test-near-twins', ok: true, warning: true, detail: 'recall', fix: '' }]);
if (cmd === 'prereg' && sub === 'new') out({ id: rest[2], export_with: '--prereg ' + rest[2],
  binding_preregs: ['all-data', 'notwins'], model_note: 'name each preregistration after the model it predicts', after_reads: null });
out({});
`;

describe('16 + tools through a stub forge', { skip: !POSIX && 'POSIX stub' }, () => {
  let TMP; let LOG; let client; const SAVED = {};
  before(async () => {
    TMP = mkdtempSync(join(tmpdir(), 'r10-forge-'));
    const stub = join(TMP, 'nmt-forge');
    LOG = join(TMP, 'calls.log');
    const shebang = /\s/.test(process.execPath) ? '#!/usr/bin/env node' : `#!${process.execPath}`;
    writeFileSync(stub, `${shebang}\n(function main() {${STUB}\n})();\n`);
    chmodSync(stub, 0o755);
    for (const k of ['NMT_FORGE_BIN', 'FAKE_FORGE_LOG']) SAVED[k] = process.env[k];
    process.env.NMT_FORGE_BIN = stub;
    process.env.FAKE_FORGE_LOG = LOG;
    const server = await createServer();
    const [c, s] = InMemoryTransport.createLinkedPair();
    await server.connect(s);
    client = new Client({ name: 'r10', version: '0.0.0' });
    await client.connect(c);
  });
  after(async () => {
    await client?.close();
    for (const [k, v] of Object.entries(SAVED)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (TMP) rmSync(TMP, { recursive: true, force: true });
  });
  const lastArgv = () => JSON.parse(readFileSync(LOG, 'utf-8').trim().split('\n').pop()).argv;
  const call = async (name, args) => {
    const res = await client.callTool({ name, arguments: args });
    return { res, doc: JSON.parse(res.content[0].text) };
  };

  it('forge_split: register true is "project", and out defaults to data/split', async () => {
    const { res, doc } = await call('forge_split', { corpus: 'c.tsv', test: 0, seed: 1, register: true });
    assert.equal(res.isError, false);
    const argv = lastArgv();
    assert.equal(argv[argv.indexOf('--register') + 1], 'project');
    assert.equal(argv[argv.indexOf('--out') + 1], 'data/split');
    // the config mismatch is the next step
    assert.equal(doc.summary.config_check.ok, false);
    assert.match(doc.next, /does not exist — .* fix it before training: in config\.json set data\.gold/);
    await call('forge_split', { corpus: 'c.tsv', test: 0, seed: 1, register: false, out: 'x' });
    assert.ok(!lastArgv().includes('--register'));
    const bad = await client.callTool({ name: 'forge_split', arguments: { corpus: 'c.tsv', test: 0, seed: 1, register: '../x' } });
    assert.equal(bad.isError, true);
  });

  it('forge_preflight: a green answer names the run and relays the warning', async () => {
    const { doc } = await call('forge_preflight', { target: 'run', config: 'config-notwins.json' });
    assert.equal(doc.summary.passed, true);
    assert.deepEqual(doc.summary.warnings, ['test-near-twins']);
    assert.match(doc.next, /every gate passed — first relay the warning \(test-near-twins/);
    assert.match(doc.next, /`nmt-forge run config-notwins\.json`/);
  });

  it('forge_prereg: which model the prediction judges is said when it is written', async () => {
    const { doc } = await call('forge_prereg', { id: 'notwins', eval_set: 't', predictions: 'p.json' });
    assert.equal(doc.summary.export_with, '--prereg notwins');
    assert.deepEqual(doc.summary.binding_preregs, ['all-data', 'notwins']);
    assert.match(doc.next, /^name each preregistration after the model it predicts\. One preregistration per planned model/);
  });
});

// -- 20. local-model needs a model; a pair mismatch only on purpose; the method lines --

describe('20. run_benchmark: local-model needs a model; allow_model_pair_mismatch passes through', () => {
  const opts = { env: {}, mtMethods: ['local-model', 'apertium'], methodEntries: { 'local-model': { kind: 'local-model' } } };
  it('no model: refused, saying the harness has no default', () => {
    assert.throws(() => buildCorpusArgv({ corpus: 'eval-eng-sme-x-v1', method: 'local-model' }, opts),
      /needs model: .*no default model for it and refuses a run without one/);
  });
  it('allow_model_pair_mismatch becomes --allow-model-pair-mismatch, for local-model only', () => {
    const b = buildCorpusArgv({ corpus: 'eval-eng-sme-x-v1', method: 'local-model',
      model: 'Helsinki-NLP/opus-mt-en-fi', allow_model_pair_mismatch: true }, opts);
    assert.ok(b.argv.includes('--allow-model-pair-mismatch'));
    assert.ok(!buildCorpusArgv({ corpus: 'eval-eng-sme-x-v1', method: 'local-model', model: 'a/b' }, opts)
      .argv.includes('--allow-model-pair-mismatch'));
    assert.throws(() => buildCorpusArgv({ corpus: 'eval-eng-sme-x-v1', model: 'openai/gpt-5.5',
      allow_model_pair_mismatch: true }, opts), /applies to method "local-model" only/);
  });
});

describe('20. publish_report relays the method lines the harness preview prints', () => {
  it('every method line, in the harness\'s order', async () => {
    const { reportPublishFacts } = await import('../src/tools/publish-report.js');
    const output = [
      '  Trust:         unverified — self-benchmarked',
      '  Method:        fewshot-local-v1 — class coached-llm, paradigm llm-prompting',
      '  Dependency:    A1 — LLM inference via an endpoint',
      '  Tools:         none',
      '  Open source:   yes',
      '  Code:          sha256 0123456789abcdef… over method.json + *.py; version 1.0',
      '  Model given:   stub-1',
      '  Engine model:  not an engine run',
      '  Entries:       5 — sentence text WITHHELD, scores only (owner chose --scores-only)',
      '  DRY RUN complete — nothing was written. Target would be: non-prod (staging).',
    ].join('\n');
    const f = reportPublishFacts({ output, entries: 5, target: { prod: false, label: 'staging' } });
    assert.equal(f.ok, true);
    const i = f.lines.findIndex((l) => l.includes('the method, as the board shows it beside the scores'));
    assert.ok(i > 0, f.lines.join('\n'));
    assert.deepEqual(f.lines.slice(i + 1), [
      '      Method: fewshot-local-v1 — class coached-llm, paradigm llm-prompting',
      '      Dependency: A1 — LLM inference via an endpoint',
      '      Tools: none',
      '      Open source: yes',
      '      Code: sha256 0123456789abcdef… over method.json + *.py; version 1.0',
      '      Model given: stub-1',
      '      Engine model: not an engine run',
    ]);
  });
});
