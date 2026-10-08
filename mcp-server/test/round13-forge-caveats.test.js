/**
 * Round 13 (synthetic hospital + school personas, 2026-10-04) — the MCP side
 * of forge's items 11/17/18: the eval harness wrote a MAJOR score caveat on
 * a twin-free model's test output (near-constant: 150 of 150 sources got one
 * of only 9 outputs) and every surface still called its chrF++ "the number
 * to quote". forge now relays the harness's `score_caveats` verbatim on
 * export, status, compare and lint; these tests pin that the MCP tools pass
 * them through as they came and put a MAJOR one FIRST in the next step —
 * and that a result with no `score_caveats` key says nothing at all.
 *
 * Shapes from forge/docs/JSON_OUTPUT.md (export / status / compare / lint);
 * forge-loop.test.js checks the same summary against the real nmt-forge.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';

import {
  compareNextHint, compareSummary, exportNextHint, exportSummary, initNextHint, lintNextHint,
  lintSummary, majorCaveats, relayCaveats, statusExportCaveats, statusNextHint, statusTools,
} from '../src/tools/forge.js';

const SERVE = 'Serve it in a terminal.';

/** A caveat exactly as the harness writes it (mt_eval_harness.score_caveats). */
const NEAR_CONSTANT = Object.freeze({
  kind: 'near_constant_output', source: 'mt-eval-harness', severity: 'major',
  message: '150 of 150 different sources got one of only 9 outputs — the score does not measure translation of unseen sentences',
  distinct_outputs: 9, n: 150, share: 1,
});
const LENGTH_NOTE = Object.freeze({
  kind: 'length_inflation', source: 'mt-eval-harness', severity: 'minor',
  message: 'outputs are 1.4× the reference length on average', ratio: 1.4,
});
/** forge's own near-twin reading, echoed back by the harness: already said elsewhere. */
const FORGE_ECHO = Object.freeze({
  kind: 'train_test_near_twin', source: 'nmt-forge', severity: 'major',
  message: '200 of 200 test rows have a near-twin in training',
});

const EXPORT = {
  export_dir: '/p/export-notwins', run: 'notwins', model_dir: '/p/export-notwins/model', evaluated: true,
  dataset_id: 'school-test', test_groups: { all: { 'chrf++': { score: 51.2, ci_lower: 49, ci_upper: 53.6 } } },
  near_twin: { checked: true, n: 150, near_twin_rows: 0, recall_not_translation: false },
  hypotheses: '/p/export-notwins/evaluation/battery-hyps.jsonl',
  compare_hint: 'nmt-forge compare --eval-set school-test --hyps-a /p/export-notwins/evaluation/battery-hyps.jsonl --hyps-b <another export>/evaluation/battery-hyps.jsonl --label-a <this model> --label-b <the other>',
  serve: 'nmt-forge serve /p/export-notwins/model',
};

describe('forge_export: mt-eval\'s score_caveats relayed verbatim, a MAJOR one first', () => {
  it('summary carries the list as forge gave it, the hypotheses file and the compare command', () => {
    const r = { ...EXPORT, score_caveats: [NEAR_CONSTANT, LENGTH_NOTE] };
    const s = exportSummary(r);
    assert.deepEqual(s.score_caveats, [NEAR_CONSTANT, LENGTH_NOTE], 'verbatim: every field, never reworded');
    assert.equal(s.hypotheses, EXPORT.hypotheses);
    assert.equal(s.compare_hint, EXPORT.compare_hint);
    const next = exportNextHint(r, SERVE);
    assert.ok(next.startsWith('First relay summary.score_caveats with the score — never quote it without them. '), next);
    assert.match(next, /Serve it in a terminal\. The command: nmt-forge serve/);
  });

  it('no score_caveats key (an older harness, or nothing to qualify) → nothing said', () => {
    const s = exportSummary(EXPORT);
    assert.equal('score_caveats' in s, false);
    const next = exportNextHint(EXPORT, SERVE);
    assert.doesNotMatch(next, /caveat/i);
    assert.equal(exportSummary({ ...EXPORT, score_caveats: null }).score_caveats, undefined);
  });

  it('a minor note, or only forge\'s own near-twin echo, does not take the lead (the list is still relayed)', () => {
    const r = { ...EXPORT, score_caveats: [LENGTH_NOTE, FORGE_ECHO] };
    assert.deepEqual(exportSummary(r).score_caveats, [LENGTH_NOTE, FORGE_ECHO]);
    assert.doesNotMatch(exportNextHint(r, SERVE), /First relay summary\.score_caveats/);
    assert.deepEqual(majorCaveats([FORGE_ECHO, LENGTH_NOTE]), []);
  });

  it('a twin-free sibling flagged by mt-eval: its caveats travel with its score, and the hint says so', () => {
    const inflated = {
      ...EXPORT, export_dir: '/p/export', run: 'all-data', model_dir: '/p/export/model',
      near_twin: { checked: true, n: 150, near_twin_rows: 150, recall_not_translation: true, advice: 'twins' },
      twin_free_siblings: [{ name: 'm', run: 'notwins', export_dir: '/p/export-notwins', model_dir: '/p/export-notwins/model',
        score: { metric: 'chrf++', score: 51.2 }, score_caveats: [NEAR_CONSTANT] }],
    };
    const s = exportSummary(inflated);
    assert.deepEqual(s.twin_free_siblings[0].score_caveats, [NEAR_CONSTANT]);
    const next = exportNextHint(inflated, SERVE);
    assert.match(next, /^The twin-free score this export cites carries mt-eval's SCORE CAVEAT — relay it with that score/);
    assert.match(next, /First relay summary\.near_twin_advice with the score/);
    // a sibling with none says nothing about caveats
    const plain = { ...inflated, twin_free_siblings: [{ ...inflated.twin_free_siblings[0], score_caveats: null }] };
    assert.equal('score_caveats' in exportSummary(plain).twin_free_siblings[0], false);
    assert.doesNotMatch(exportNextHint(plain, SERVE), /SCORE CAVEAT/);
  });

  it('an evaluation-only export leads with the caveat too', () => {
    const r = { ...EXPORT, model_dir: null, score_caveats: [NEAR_CONSTANT] };
    assert.match(exportNextHint(r, SERVE), /^First relay summary\.score_caveats .*evaluation-only export/);
  });

  it('relayCaveats keeps objects only; an empty list is nothing', () => {
    assert.equal(relayCaveats(undefined), null);
    assert.equal(relayCaveats([]), null);
    assert.deepEqual(relayCaveats([NEAR_CONSTANT, 'x', null]), [NEAR_CONSTANT]);
  });
});

describe('forge_compare: mt-eval qualifies a system\'s outputs → said before anything else', () => {
  const base = {
    labels: ['all-data', 'notwins'], n: 150,
    results: { 'chrf++': { delta: 16, ci_lower: 14, ci_upper: 18, p_value: 0.001, significant: true, winner: 'all-data' } },
    near_twin: { 'all-data': { checked: true, n: 150, near_twin_rows: 0 }, notwins: { checked: true, n: 150, near_twin_rows: 0 } },
    caveats: ['notwins (mt-eval, on these outputs): ⚠ SCORE CAVEAT (mt-eval-harness): 150 of 150 …'],
  };

  it('summary.score_caveats per label (verbatim), the flagged labels, and the hint first', () => {
    const r = { ...base, score_caveats: { 'all-data': null, notwins: [NEAR_CONSTANT] } };
    const s = compareSummary(r);
    assert.deepEqual(s.score_caveats, { notwins: [NEAR_CONSTANT] });
    assert.deepEqual(s.score_caveats_major, ['notwins']);
    assert.deepEqual(s.caveats, base.caveats);
    assert.ok(compareNextHint(r).startsWith('relay summary.caveats — mt-eval qualifies notwins\'s outputs '
      + '(summary.score_caveats, in its words); no score here is quotable without its caveat. '), compareNextHint(r));
  });

  it('no score_caveats key → nothing said', () => {
    const s = compareSummary(base);
    assert.equal('score_caveats' in s, false);
    assert.doesNotMatch(compareNextHint(base), /mt-eval qualifies/);
  });

  it('unchecked twins point to forge_export\'s result.hypotheses for the hyps file', () => {
    const r = { ...base, near_twin: { 'all-data': { checked: false, known: false }, notwins: { checked: true, n: 150, near_twin_rows: 0 } } };
    assert.match(compareNextHint(r), /forge_export's result\.hypotheses \(<export>\/evaluation\/battery-hyps\.jsonl\) as hyps_a \/ hyps_b/);
  });
});

describe('forge_lint: R9-harness-score-caveat comes through, first', () => {
  const r9 = {
    rule: 'R9-harness-score-caveat', lever: 'MEASUREMENT', group: null, severity: 'high',
    evidence: { kind: 'near_constant_output', source: 'mt-eval-harness', severity: 'major', distinct_outputs: 9 },
    recommendation: 'mt-eval (mt-eval-harness) qualifies this score: 150 of 150 different sources got one of only 9 outputs. Quote the score only with this caveat beside it, and read a few outputs before calling it translation quality.',
  };
  const r1 = { rule: 'R1-vocabulary-gap', lever: 'VOCABULARY', group: 'textbook', severity: 'high', evidence: {}, recommendation: 'grow the lexicon' };

  it('the summary relays every R9 finding\'s words; the hint leads with them', () => {
    const s = lintSummary([r1, r9]);
    assert.equal(s.findings, 2);
    assert.deepEqual(s.by_severity, { high: 2, medium: 0, info: 0 });
    assert.deepEqual(s.harness_score_caveats, [{ severity: 'high', recommendation: r9.recommendation }]);
    const next = lintNextHint([r1, r9]);
    assert.match(next, /^first relay summary\.harness_score_caveats with the scores — mt-eval qualifies them \(R9-harness-score-caveat, high\)/);
    assert.match(next, /act on the highest-severity finding: R1-vocabulary-gap \(high\) → lever VOCABULARY for textbook/);
  });

  it('R9 alone: relay it, and no lever is invented; a medium one comes through too', () => {
    const next = lintNextHint([{ ...r9, severity: 'medium' }]);
    assert.match(next, /\(R9-harness-score-caveat, medium\)/);
    assert.match(next, /No other finding: nothing here says which lever to pull\./);
    assert.doesNotMatch(next, /act on/);
  });

  it('no R9 → the summary and hint are as before', () => {
    assert.equal('harness_score_caveats' in lintSummary([r1]), false);
    assert.match(lintNextHint([r1]), /^act on the highest-severity finding/);
    assert.match(lintNextHint([]), /^no findings/);
  });
});

describe('forge_status: the guardrails once before the split; each export\'s caveats beside its score', () => {
  const noDev = {
    advice: {
      state: 'no-dev-set',
      next_command: 'nmt-forge split corpus.clean.jsonl --test 0 --dev <N> --seed <S> --out data/split --register project   '
        + '# --test 0: your registered test set stays a separate file; the file leak-audit cleaned; BEFORE it, read the '
        + 'training guardrails once: get_training_guardrails (MCP) or https://champollion.dev/docs/network/getting-started/training-honestly',
    },
  };

  it('no-dev-set: "call get_training_guardrails once, then forge_split" — tools in that order', () => {
    const next = statusNextHint(noDev);
    assert.match(next, /^next \(state no-dev-set\): call get_training_guardrails once .* then forge_split for `nmt-forge split corpus\.clean\.jsonl --test 0 --dev <N> --seed <S> --out data\/split --register project`/);
    assert.equal(next.match(/get_training_guardrails/g).length, 1, 'said once');
    assert.deepEqual(statusTools(noDev), ['get_training_guardrails', 'forge_split']);
  });

  it('a later state does not repeat it', () => {
    const later = { advice: { state: 'ready-to-train', next_command: 'nmt-forge preflight run --config config.json && nmt-forge run config.json' } };
    assert.doesNotMatch(statusNextHint(later), /guardrails/);
    assert.deepEqual(statusTools(later), ['forge_preflight', 'terminal: nmt-forge run']);
  });

  it('init\'s step order shows the guardrails step once, with its tool, before the split', () => {
    const order = [
      { step: 'register', what: 'register the test set', tool: 'forge_register_eval' },
      { step: 'baseline', what: 'baselines', tool: 'run_benchmark' },
      { step: 'guardrails', what: 'read the training guardrails before splitting', tool: 'get_training_guardrails' },
      { step: 'split', what: 'carve train/dev', tool: 'forge_split' },
    ];
    const hint = initNextHint({ project: '/p', order });
    assert.equal(hint.match(/get_training_guardrails/g).length, 1);
    assert.ok(hint.indexOf('get_training_guardrails') < hint.indexOf('forge_split'));
  });

  it('statusExportCaveats: verbatim per export, the major ones named; none → null', () => {
    const r = { advice: { state: 'choose-export', exports: [
      { run: 'all-data', model_dir: '/p/export/model', score_caveats: null },
      { run: 'notwins', model_dir: '/p/export-notwins/model', score_caveats: [NEAR_CONSTANT, LENGTH_NOTE] },
    ] } };
    assert.deepEqual(statusExportCaveats(r), { score_caveats: { notwins: [NEAR_CONSTANT, LENGTH_NOTE] }, major: ['notwins'] });
    assert.equal(statusExportCaveats({ advice: { exports: [{ run: 'a' }] } }), null);
    // exported state: the snapshot's exports are read when advice lists none
    assert.deepEqual(statusExportCaveats({ advice: { state: 'exported' }, snapshot: { exports: [{ run: 'x', score_caveats: [LENGTH_NOTE] }] } }),
      { score_caveats: { x: [LENGTH_NOTE] } });
  });
});

// -- the same, over the protocol, through a stub forge ------------------------------

/** A stub nmt-forge: answers each command with the JSON in $FAKE_FORGE_DIR/<cmd>.json. */
const STUB = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const argv = process.argv.slice(2);
const i = argv.indexOf('--workspace');
const rest = i >= 0 ? argv.slice(i + 2) : argv;
const f = path.join(process.env.FAKE_FORGE_DIR, rest[0] + '.json');
fs.writeSync(1, fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '{}');
process.exit(0);
`;

describe('over the protocol: forge_status / forge_lint relay mt-eval\'s caveats', { skip: process.platform === 'win32' && 'POSIX stub' }, () => {
  let TMP; let client; const SAVED = {};
  before(async () => {
    TMP = mkdtempSync(join(tmpdir(), 'r13-forge-'));
    const stub = join(TMP, 'nmt-forge');
    const shebang = /\s/.test(process.execPath) ? '#!/usr/bin/env node' : `#!${process.execPath}`;
    writeFileSync(stub, `${shebang}\n(function main() {${STUB}\n})();\n`);
    chmodSync(stub, 0o755);
    for (const k of ['NMT_FORGE_BIN', 'FAKE_FORGE_DIR']) SAVED[k] = process.env[k];
    process.env.NMT_FORGE_BIN = stub;
    process.env.FAKE_FORGE_DIR = TMP;
    const server = await createServer();
    const [c, srv] = InMemoryTransport.createLinkedPair();
    await server.connect(srv);
    client = new Client({ name: 'r13-forge', version: '0.0.0' });
    await client.connect(c);
  });
  after(async () => {
    await client?.close();
    for (const [k, v] of Object.entries(SAVED)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (TMP) rmSync(TMP, { recursive: true, force: true });
  });
  const answer = (cmd, doc) => writeFileSync(join(TMP, `${cmd}.json`), JSON.stringify(doc));
  const call = async (name, args = {}) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);

  it('choose-export: every export\'s score_caveats in the summary, and the hint says to show them beside each score', async () => {
    answer('status', { snapshot: {}, advice: { state: 'choose-export', next_command: 'nmt-forge choose <model dir>', exports: [
      { run: 'all-data', model_dir: '/p/export/model', score: { metric: 'chrf++', score: 67.6 }, score_caveats: null },
      { run: 'notwins', model_dir: '/p/export-notwins/model', score: { metric: 'chrf++', score: 51.2 }, score_caveats: [NEAR_CONSTANT] },
    ] } });
    const doc = await call('forge_status');
    assert.deepEqual(doc.summary.export_caveats, { score_caveats: { notwins: [NEAR_CONSTANT] }, major: ['notwins'] });
    assert.match(doc.next, /beside each export's score its advice\.exports\[\]\.score_caveats, mt-eval's caveats in its words/);
  });

  it('exported, with a MAJOR caveat on the export: relayed first; without one: nothing said', async () => {
    answer('status', { snapshot: { exports: [{ run: 'notwins', model_dir: '/p/m', score_caveats: [NEAR_CONSTANT] }] },
      advice: { state: 'exported', next_command: 'nmt-forge serve /p/m' } });
    let doc = await call('forge_status');
    assert.match(doc.next, /^First relay summary\.export_caveats with the score of notwins — mt-eval qualifies it/);
    answer('status', { snapshot: { exports: [{ run: 'notwins', model_dir: '/p/m' }] },
      advice: { state: 'exported', next_command: 'nmt-forge serve /p/m' } });
    doc = await call('forge_status');
    assert.equal(doc.summary.export_caveats, undefined);
    assert.doesNotMatch(doc.next, /caveat/i);
  });

  it('no-dev-set: summary.tools puts get_training_guardrails first', async () => {
    answer('status', { snapshot: {}, advice: { state: 'no-dev-set', next_command: 'nmt-forge split c.jsonl --test 0 --dev <N> '
      + '--seed <S> --out data/split --register project   # BEFORE it, read the training guardrails once: get_training_guardrails (MCP) or https://x' } });
    const doc = await call('forge_status');
    assert.deepEqual(doc.summary.tools, ['get_training_guardrails', 'forge_split']);
    assert.match(doc.next, /call get_training_guardrails once/);
  });

  it('forge_lint: R9 comes through, nothing filtered, its words in the summary', async () => {
    const r9 = { rule: 'R9-harness-score-caveat', lever: 'MEASUREMENT', group: null, severity: 'high',
      evidence: { kind: 'near_constant_output' }, recommendation: 'mt-eval (mt-eval-harness) qualifies this score: x. Quote the score only with this caveat beside it.' };
    answer('lint', [r9]);
    const doc = await call('forge_lint', { manifest: 'm.json' });
    assert.deepEqual(doc.result, [r9]);
    assert.deepEqual(doc.summary.harness_score_caveats, [{ severity: 'high', recommendation: r9.recommendation }]);
    assert.match(doc.next, /^first relay summary\.harness_score_caveats/);
  });
});
