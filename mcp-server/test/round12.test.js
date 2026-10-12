/**
 * Round 12 synthetic personas (researcher eng→sme, Cree school, hospital),
 * 2026-10-04 — run_benchmark, get_run_status and publish_report.
 *
 *   1.  A run's score caveats (the harness's score_caveats, recorded in the
 *       report — the new near_constant_output among them) are in
 *       get_run_status's Results block, whatever the output trim kept.
 *   2.  A method plugin whose method.json declares dependency class S with
 *       `dependencies: []` is "$0 API cost (runs on this machine)" in the
 *       plan, by the harness's own rule (method_loader.plugin_calls_no_api —
 *       the two are run on the same manifests here); an A1 plugin stays
 *       unknown. A declared-S plugin is still refused a local-only corpus
 *       without the user's attestation.
 *  19.  publish_report relays the harness preview's local-only block: what of
 *       a local-only corpus goes public with the score, and what stays here.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginDependencyTerms, resetJobs, runBenchmark } from '../src/tools/harness.js';
import { reportHeadline } from '../src/tools/jobs.js';
import { localOnlyPublication, reportPublishFacts } from '../src/tools/publish-report.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ARENA = resolve(HERE, '..', '..', 'arena');

let DIR;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'r12-mcp-'));
  process.env.CHAMPOLLION_MCP_DEBUG_LOG = join(DIR, 'debug.log');
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_DEBUG_LOG;
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

// -- 1. caveats in the Results block --------------------------------------------

describe('1. a report\'s score caveats travel with its numbers', () => {
  it('reportHeadline reads them; nothing when there are none', () => {
    const p = join(DIR, 'r_report.json');
    writeFileSync(p, JSON.stringify({
      run_id: 'run-x', overall: { corpus_chrf: 9.2, evaluated: 30 },
      score_caveats: [{ kind: 'near_constant_output', source: 'mt-eval-harness', severity: 'major',
        message: '27 of 29 distinct sources (93%) got an output shared with other, different sources' }],
    }));
    const h = reportHeadline(p);
    assert.equal(h.line, 'corpus_chrf 9.2, evaluated 30');
    assert.deepEqual(h.caveats, [{ kind: 'near_constant_output', severity: 'major', source: 'mt-eval-harness',
      message: '27 of 29 distinct sources (93%) got an output shared with other, different sources' }]);
    const q = join(DIR, 'q_report.json');
    writeFileSync(q, JSON.stringify({ run_id: 'run-y', overall: { corpus_chrf: 40 } }));
    assert.deepEqual(reportHeadline(q).caveats, []);
  });
});

// -- 2. a self-contained plugin costs $0 API ------------------------------------

const MANIFESTS = [
  [{ dependency_class: 'S', dependencies: [] }, true],
  [{ dependency_class: 'O', dependencies: [{ id: 'fst', access: 'mirrored' }] }, true],
  [{ dependency_class: 'S' }, false],
  [{ dependency_class: 'A1', dependencies: [] }, false],
  [{ dependency_class: 'O', dependencies: [{ id: 'llm', access: 'gateway' }] }, false],
  [{ dependency_class: 'S', dependencies: [{ id: 'dict', access: 'External-API' }] }, false],
  [{ dependencies: [] }, false],
];

describe('2. a plugin declaring S with no dependencies is $0 API cost', () => {
  it('pluginDependencyTerms', () => {
    for (const [m, noApi] of MANIFESTS) assert.equal(pluginDependencyTerms(m).noApi, noApi, JSON.stringify(m));
    assert.deepEqual(pluginDependencyTerms({ dependency_class: 'S', dependencies: [] }),
      { dependencyClass: 'S', dependencyCount: 0, noApi: true });
  });

  it('agrees with the harness\'s own rule on every manifest', () => {
    const r = spawnSync('python3', ['-c',
      'import json,sys\nfrom mt_eval_harness.method_loader import plugin_calls_no_api\n'
      + 'print(json.dumps([plugin_calls_no_api(m) for m in json.loads(sys.argv[1])]))',
      JSON.stringify(MANIFESTS.map(([m]) => m))],
    { env: { ...process.env, PYTHONPATH: [ARENA, process.env.PYTHONPATH].filter(Boolean).join(':') }, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout.trim()), MANIFESTS.map(([, v]) => v));
  });

  function plugin(name, manifest) {
    const d = join(DIR, name);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'method.json'), JSON.stringify({
      name, entry_point: 'm:M', class: 'custom-plugin', ...manifest,
    }));
    return d;
  }
  const handle = () => ({
    isMtEvalInstalled: async () => true,
    execCapture: async () => ({ code: 0, stdout: '', stderr: '' }),
    env: {},
    runPlanProbe: async () => ({ status: 'error', error: 'not asked in this test' }),
    metricsProbe: async () => ({ status: 'not-installed', error: 'not asked in this test' }),
    localModelWeights: async () => [],
  });

  it('the plan says $0 API cost and the declaration, not "it makes its own calls"', async () => {
    const corpus = join(DIR, 'c.jsonl');
    writeFileSync(corpus, '{"source":"hello","reference":"bures"}\n');
    const s = plugin('copy-s', { dependency_class: 'S', dependencies: [] });
    const out = await runBenchmark({ corpus, method_dir: s, dry_run: true }, handle());
    assert.match(out, /Cost:\s+\$0 API cost \(runs on this machine\) — method plugin, dependency class S/);
    assert.match(out, /declares dependency class S \(self-contained, no dependencies\), so it calls no API/);
    assert.doesNotMatch(out, /prices its own calls/);
    const a1 = plugin('llm-a1', { dependency_class: 'A1', dependencies: [] });
    const out2 = await runBenchmark({ corpus, method_dir: a1, dry_run: true }, handle());
    // Round 13: the harness's own words for WHY (method_loader.plugin_cost_basis)
    assert.match(out2, /Cost:\s+unknown — method plugin, dependency class A1 \(API-dependent, substitutable\): the plugin calls an LLM itself — it makes and pays for those calls, so the harness has no token count to price\./);
    assert.match(out2, /it makes its own calls/);
  });

  it('a declared-S plugin still needs the user\'s attestation for a local-only corpus', async () => {
    const corpus = join(DIR, 'ward.jsonl');
    writeFileSync(corpus, '{"source":"hello","reference":"bures"}\n');
    writeFileSync(`${corpus}.champollion.json`, JSON.stringify({ transmission: 'local-only' }));
    const s = plugin('copy-s2', { dependency_class: 'S', dependencies: [] });
    const out = await runBenchmark({ corpus, method_dir: s, confirm: true }, handle());
    assert.match(out, /^REFUSED — this corpus is marked LOCAL-ONLY/);
    assert.match(out, /declares dependency class S\s+\(no API call\) — a declaration the harness cannot verify/);
  });
});

// -- 19. publish_report relays the local-only block -----------------------------

const PREVIEW = [
  '  Target would be: non-prod (http://127.0.0.1:9)',
  '  Dataset:       eval-eng-crk-teacher-reviewed-test-v1 (200 entries)',
  '  License:       LicenseRef-School-Own',
  '  Local-only corpus — what this publish makes public, and what stays here:',
  '    Published with the score (metadata, no text): its id',
  "      'eval-eng-crk-teacher-reviewed-test-v1'; size (200 entries); its licence",
  '      LicenseRef-School-Own; that it is marked local-only.',
  '    Stays on this machine: every sentence — sources, references and outputs',
  '      (the card is scores-only); the corpus file itself and its path on this',
  '      machine.',
  '    How others read it: others see the score and the facts above for a test',
  '      set they cannot open.',
  '  Entries:       200 — sentence text WITHHELD, scores only (the data steward marked this corpus local-only)',
  '  Trust:         unverified — self-benchmarked',
].join('\n');

describe('19. what of a local-only corpus goes public', () => {
  it('localOnlyPublication joins each paragraph; nothing for an ordinary corpus', () => {
    const paras = localOnlyPublication(PREVIEW);
    assert.equal(paras.length, 3);
    assert.equal(paras[0], "Published with the score (metadata, no text): its id 'eval-eng-crk-teacher-reviewed-test-v1'; "
      + 'size (200 entries); its licence LicenseRef-School-Own; that it is marked local-only.');
    assert.match(paras[1], /^Stays on this machine: every sentence/);
    assert.deepEqual(localOnlyPublication('  Entries:       5 — sentence text WITHHELD'), []);
  });

  it('the WHAT GETS PUBLISHED list carries it', () => {
    const f = reportPublishFacts({ output: PREVIEW, entries: 200, target: { prod: false, label: 'staging' } });
    assert.equal(f.ok, true);
    const text = f.lines.join('\n');
    assert.match(text, /the corpus is marked LOCAL-ONLY — what of it goes public, as the harness's preview says:/);
    assert.match(text, /Published with the score \(metadata, no text\): its id 'eval-eng-crk-teacher-reviewed-test-v1'/);
    assert.match(text, /How others read it:/);
  });
});
