/**
 * Round 13 (synthetic researcher, 2026-10-04) — run_benchmark:
 *
 *   9.  MetricX (and COMET) could not be requested: the run card said
 *       "MetricX-24 not run — MetricX is opt-in (pass --metricx)", but the tool
 *       had no such argument, and nothing said whether COMET would run.
 *       Now: metricx (+ metricx_model) and fuse pass the harness's opt-in
 *       flags; comet: true REQUIRES COMET (which the harness computes on
 *       every run whose Python has unbabel-comet — there is no run flag). The
 *       plan says, from the harness, what each needs and costs and whether it
 *       is installed; a confirmed run that asked for a metric the harness
 *       cannot compute is REFUSED — never silently dropped.
 *
 *   4.  A baseline on a contest's released dev set (<contest>/public/<id>.json)
 *       wrote its cache and results into <contest>/public/results/ — the
 *       folder `mt-eval contest prepare` labels releasable. Now a corpus in a
 *       releasable folder (the `.champollion-releasable.json` marker in it or
 *       an ancestor, or prepare's older layout: `public/` beside
 *       `local/manifest.json`) runs into <contest>/runs/, and the plan says
 *       where and why.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  awaitAllJobs, buildCorpusArgv, buildRunArgv, resetJobs, runBenchmark,
} from '../src/tools/harness.js';
import {
  METRIC_COSTS, metricsPlanLines, metricsRefusal, probeMetrics,
} from '../src/tools/metrics-plan.js';
import { RELEASABLE_MARKER, releasableRoot, runsBaseFor } from '../src/tools/releasable.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ARENA_DIR = resolve(__dirname, '../../arena');
const HARNESS_MD = resolve(__dirname, '../../cli/website/docs/network/specifications/harness.md');
const REG = { entries: { local: { kind: 'llm', default_base_url: 'http://127.0.0.1:11434/v1' } } };
const argAfter = (argv, flag) => argv[argv.indexOf(flag) + 1];

let DIR;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-r13-'));
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state');
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

/** A probe answer in probeMetrics's shape. */
function metricsAnswer({ comet = false, metricx = null, fuse = null } = {}) {
  return {
    status: 'ok',
    python: '/opt/venv/bin/python',
    targetCode: 'sme',
    comet: comet
      ? { available: true, reason: null, defaultModel: 'Unbabel/wmt22-comet-da', model: 'Unbabel/wmt22-comet-da' }
      : { available: false, reason: 'unbabel-comet is not installed — mt-eval setup --comet', defaultModel: 'Unbabel/wmt22-comet-da', model: 'Unbabel/wmt22-comet-da' },
    ...(metricx == null ? {} : {
      metricx: metricx
        ? { available: true, defaultModel: 'google/metricx-24-hybrid-large-v2p6', tokenizer: 'google/mt5-xl' }
        : { available: false, defaultModel: 'google/metricx-24-hybrid-large-v2p6', missing: ["Google's MetricX model code (the metricx24 package, not on PyPI)"],
          install: ["python3 -m pip install 'mt-eval-harness[metricx]'", 'python3 -m pip install git+https://github.com/google-research/metricx'] },
    }),
    ...(fuse == null ? {} : {
      fuse: fuse
        ? { available: true, phonetic: true, model: 'sentence-transformers/LaBSE' }
        : { available: false, phonetic: false, model: 'sentence-transformers/LaBSE', missing: ['sentence-transformers (LaBSE)'], install: ["python3 -m pip install 'mt-eval-harness[fuse]'"] },
    }),
  };
}

/** runBenchmark's injected world: no real harness, every probe answered. */
function world({ metrics = metricsAnswer(), env = { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd } = {}) {
  const calls = [];
  const asked = [];
  return {
    calls,
    asked,
    deps: {
      isMtEvalInstalled: async () => true,
      env,
      methodRegistry: REG,
      execCapture: async (cmd, args) => { calls.push(args); return { code: 0, stdout: 'ok', stderr: '' }; },
      runPlanProbe: async () => ({ status: 'error', error: 'not asked in this test' }),
      metricsProbe: async (input) => { asked.push(input); return metrics; },
      localModelWeights: async () => [],
      forgeOrder: () => [],
      lookupQueueItem: async ({ id }) => ({
        item: { id, corpus_id: 'eval-eng-sme-tatoeba-dev-v1', model: 'openai/gpt-5.5', target_language: 'Northern Sami',
          language_pair: 'eng>sme', condition: 'naive', est_cost_usd: 0.01 },
        covered: false,
      }),
      ...(cwd ? { corpusFs: { cwd } } : {}),
    },
  };
}

// -- 9. the neural metrics ---------------------------------------------------------

describe('9. metricx / fuse pass the harness\'s opt-in flags; comet is required, not a flag', () => {
  it('buildCorpusArgv: --metricx, --metricx-model, --fuse — and no COMET flag (the harness has none)', () => {
    const b = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      metricx: true, metricx_model: ' google/metricx-24-hybrid-xl-v2p6 ', fuse: true, comet: true }, { env: { CHAMPOLLION_MCP_HOME: DIR }, cwd: DIR });
    assert.ok(b.argv.includes('--metricx'));
    assert.equal(argAfter(b.argv, '--metricx-model'), 'google/metricx-24-hybrid-xl-v2p6');
    assert.ok(b.argv.includes('--fuse'));
    assert.ok(!b.argv.some((a) => /comet/i.test(a)), b.argv.join(' '));
    const plain = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1' },
      { env: { CHAMPOLLION_MCP_HOME: DIR }, cwd: DIR });
    assert.ok(!plain.argv.includes('--metricx') && !plain.argv.includes('--fuse'));
  });

  it('metricx_model needs metricx: true and must not look like an option', () => {
    assert.throws(() => buildCorpusArgv({ corpus: 'eval-x', provider: 'local', model: 'm', metricx_model: 'google/x' },
      { env: {}, cwd: DIR }), /metricx_model applies with metricx: true/);
    assert.throws(() => buildCorpusArgv({ corpus: 'eval-x', provider: 'local', model: 'm', metricx: true, metricx_model: '--evil' },
      { env: {}, cwd: DIR }), /metricx_model must be a Hugging Face id/);
  });

  it('buildRunArgv (a queue item run): the same flags', () => {
    const argv = buildRunArgv({ corpus_id: 'eval-x', model: 'openai/gpt-5.5', target_language: 'Northern Sami' },
      { metricx: true, metricxModel: 'google/metricx-25-x', fuse: true, env: {} });
    assert.deepEqual(argv.slice(argv.indexOf('--metricx'), argv.indexOf('--metricx') + 4),
      ['--metricx', '--metricx-model', 'google/metricx-25-x', '--fuse']);
  });

  it('a queue run refuses them (`mt-eval queue` has no such flags)', async () => {
    for (const p of [{ metricx: true }, { fuse: true }, { comet: true }, { metricx_model: 'x' }]) {
      const out = await runBenchmark({ top: 3, ...p }, world().deps);
      assert.match(out, /^REFUSED — comet \/ metricx \/ metricx_model \/ fuse apply to item and corpus runs/);
    }
  });

  it('the plan names COMET (computed or not, with the install and its size) and the opt-ins', async () => {
    const w = world({ metrics: metricsAnswer({ comet: false }) });
    const plan = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', dry_run: true }, w.deps);
    assert.match(plan, /^COMET: {4}not computed — unbabel-comet is not installed — `mt-eval setup --comet` installs it \(about 300 MB to install, and about 2\.3 GB of model on first use; the user's call, in a terminal\)\. The run card marks COMET not computed; comet: true makes the run wait for it instead\.$/m);
    assert.match(plan, /^Opt-in: {3}MetricX-24 \(metricx: true\) and the FUSE-style comparator \(fuse: true\) are off/m);
    assert.deepEqual(w.asked[0], { metricx: false, fuse: false, datasetId: 'eval-eng-sme-tatoeba-dev-v1', targetCode: null, targetName: null });
    const ok = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', dry_run: true },
      world({ metrics: metricsAnswer({ comet: true }) }).deps);
    assert.match(ok, /^COMET: {4}computed — unbabel-comet imports in the Python `mt-eval` runs \(\/opt\/venv\/bin\/python\); model Unbabel\/wmt22-comet-da \(about 2\.3 GB, downloaded on first use\); it runs on this machine \(no API cost/m);
  });

  it('metricx requested but not installed: the plan says what is missing, how to add it and what it costs', async () => {
    const plan = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', metricx: true, dry_run: true },
      world({ metrics: metricsAnswer({ metricx: false }) }).deps);
    assert.match(plan, /^⚠ MetricX: requested \(--metricx\), but MetricX-24 is NOT available in the Python `mt-eval` runs \(\/opt\/venv\/bin\/python\): missing Google's MetricX model code/m);
    assert.match(plan, /python3 -m pip install 'mt-eval-harness\[metricx\]' && python3 -m pip install git\+https:\/\/github\.com\/google-research\/metricx/);
    assert.match(plan, /several GB from Hugging Face on first use; scoring is slow on a CPU/);
    assert.match(plan, /A confirmed run is REFUSED until it is \(nothing is spent\)/);
    assert.match(plan, /--metricx/, 'the command shown carries the flag');
    assert.doesNotMatch(plan, /^Opt-in:/m);
  });

  it('confirm: a requested metric the harness cannot compute is REFUSED — nothing launched', async () => {
    for (const [p, m, what] of [
      [{ metricx: true }, metricsAnswer({ metricx: false }), /MetricX-24/],
      [{ fuse: true }, metricsAnswer({ fuse: false }), /the FUSE-style comparator/],
      [{ comet: true }, metricsAnswer({ comet: false }), /COMET/],
    ]) {
      const w = world({ metrics: m });
      const out = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', confirm: true, ...p }, w.deps);
      assert.match(out, /^REFUSED — the run asks for /);
      assert.match(out, what);
      assert.match(out, /A requested metric is never dropped silently/);
      assert.equal(w.calls.length, 0, 'nothing was launched');
    }
  });

  it('confirm: available → runs with the flag; a check that failed → runs with the flag (the card reports an absence)', async () => {
    let w = world({ metrics: metricsAnswer({ comet: true, metricx: true }) });
    let out = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', confirm: true, metricx: true, comet: true }, w.deps);
    assert.match(out, /^STARTED/);
    await awaitAllJobs();
    assert.ok(w.calls[0].includes('--metricx'));
    w = world({ metrics: { status: 'error', error: 'the harness did not answer within 40s' } });
    out = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', confirm: true, metricx: true }, w.deps);
    assert.match(out, /^STARTED/);
    await awaitAllJobs();
    assert.ok(w.calls[0].includes('--metricx'));
  });

  it('confirm without any metric request does not ask the harness (no extra spawn)', async () => {
    const w = world();
    const out = await runBenchmark({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1', confirm: true }, w.deps);
    assert.match(out, /^STARTED/);
    await awaitAllJobs();
    assert.equal(w.asked.length, 0);
  });

  it('an item run: the plan carries the metric lines; a refused metric stops it', async () => {
    const plan = await runBenchmark({ item_id: 'q-1', metricx: true, dry_run: true }, world({ metrics: metricsAnswer({ metricx: true }) }).deps);
    assert.match(plan, /^MetricX: {2}requested \(--metricx\) — installed in the Python `mt-eval` runs/m);
    assert.match(plan, /--metricx/);
    const w = world({ metrics: metricsAnswer({ metricx: false }) });
    const out = await runBenchmark({ item_id: 'q-1', metricx: true, confirm: true }, w.deps);
    assert.match(out, /^REFUSED — the run asks for MetricX-24/);
    assert.equal(w.calls.length, 0);
  });

  it('metricsPlanLines: a failed check is said, never guessed; COMET\'s non-install reason is relayed as is', () => {
    const lines = metricsPlanLines({ status: 'error', error: 'no `mt-eval` on PATH' }, { metricx: true });
    assert.match(lines[0], /^COMET: {4}cannot tell whether it will be computed — no `mt-eval` on PATH/);
    assert.match(lines[1], /^MetricX: {2}requested \(--metricx\) — whether it is installed could not be checked/);
    assert.equal(metricsRefusal({ status: 'error', error: 'x' }, { metricx: true, comet: true }), null);
    const py314 = metricsAnswer();
    py314.comet.reason = 'unbabel-comet (2.2.7, the latest release) imports functools._HashedSeq, which Python 3.14 removed; this is Python 3.14.3. Run COMET from a Python 3.12 or 3.13 environment';
    const [line] = metricsPlanLines(py314);
    assert.match(line, /Python 3\.14 removed/);
    assert.doesNotMatch(line, /setup --comet/, 'setup --comet would not fix that');
  });

  it('probeMetrics: reads the harness\'s sentinel answer; no harness is "not-installed"', async () => {
    const r = await probeMetrics({ metricx: true }, {
      python: { cmd: 'py', args: [] },
      run: async (cmd, args) => {
        assert.equal(JSON.parse(args.at(-1)).metricx, true);
        return { code: 0, stdout: `noise\nCHAMPOLLION_METRICS_PROBE ${JSON.stringify({ python: '/p', comet: { available: true } })}\n`, stderr: '' };
      },
    });
    assert.equal(r.status, 'ok');
    assert.equal(r.comet.available, true);
    const none = await probeMetrics({}, { env: {}, which: () => null });
    assert.equal(none.status, 'not-installed');
  });
});

describe('9. seam: the harness accepts the flags and the docs state the costs this tool quotes', () => {
  it('the public harness spec still says what METRIC_COSTS quotes', (t) => {
    if (!existsSync(HARNESS_MD)) { t.skip('public docs not in this tree'); return; }
    const md = readFileSync(HARNESS_MD, 'utf-8');
    for (const phrase of [METRIC_COSTS.comet, 'download several GB from Hugging Face on first use; scoring is slow on a CPU',
      'LaBSE downloads about 1.8 GB on first use']) {
      assert.ok(md.includes(phrase), `harness.md no longer says "${phrase}" — update METRIC_COSTS with it`);
    }
  });

  it('the probe script runs against the real harness and answers in the shape the plan reads', async (t) => {
    let ok = false;
    try {
      execFileSync('python3', ['-c', 'import mt_eval_harness.metrics_comet'], { cwd: ARENA_DIR, timeout: 60_000, stdio: 'ignore' });
      ok = true;
    } catch { /* not importable */ }
    if (!ok) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const env = { ...process.env, PYTHONPATH: [ARENA_DIR, process.env.PYTHONPATH].filter(Boolean).join(':') };
    const r = await probeMetrics({ metricx: true, fuse: true, targetName: 'Northern Sami' },
      { env, python: { cmd: 'python3', args: [] }, timeoutMs: 120_000 });
    assert.equal(r.status, 'ok', r.error);
    assert.equal(typeof r.comet.available, 'boolean');
    assert.ok(r.comet.available || typeof r.comet.reason === 'string');
    assert.equal(typeof r.metricx.available, 'boolean');
    assert.equal(r.metricx.defaultModel, 'google/metricx-24-hybrid-large-v2p6');
    if (!r.metricx.available) assert.ok(Array.isArray(r.metricx.install) && r.metricx.install.length === 2);
    assert.equal(typeof r.fuse.available, 'boolean');
    assert.equal(r.targetCode, 'sme', 'the code the run resolves from the name');
    // and the plan reads it without a "cannot tell"
    for (const l of metricsPlanLines(r, { metricx: true, fuse: true })) assert.doesNotMatch(l, /cannot tell|could not be checked/);
  });

  it('`mt-eval run` parses --metricx --metricx-model --fuse (the real parser)', (t) => {
    let ok = false;
    try {
      execFileSync('python3', ['-c', 'import mt_eval_harness.cli'], { cwd: ARENA_DIR, timeout: 30_000, stdio: 'ignore' });
      ok = true;
    } catch { /* not importable */ }
    if (!ok) { t.skip('arena (mt_eval_harness) not importable here'); return; }
    const argv = buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1',
      metricx: true, metricx_model: 'google/metricx-24-hybrid-xl-v2p6', fuse: true }, { env: { CHAMPOLLION_MCP_HOME: DIR }, cwd: DIR }).argv;
    const py = [
      'import sys, json',
      'from mt_eval_harness.cli import build_parser',
      'ns = build_parser().parse_args(json.loads(sys.argv[1]))',
      'print(json.dumps({"metricx": ns.metricx, "metricx_model": ns.metricx_model, "fuse": ns.fuse}))',
    ].join('\n');
    const out = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(argv)],
      { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 30_000 }).trim().split('\n').pop());
    assert.deepEqual(out, { metricx: true, metricx_model: 'google/metricx-24-hybrid-xl-v2p6', fuse: true });
  });
});

// -- 4. never into a releasable folder ------------------------------------------------

/** A contest folder as `mt-eval contest prepare` lays it out. */
function contest(name, { marker = true, manifest = true } = {}) {
  const root = join(DIR, name);
  mkdirSync(join(root, 'public'), { recursive: true });
  mkdirSync(join(root, 'local'), { recursive: true });
  if (manifest) writeFileSync(join(root, 'local', 'manifest.json'), '{}');
  if (marker) writeFileSync(join(root, 'public', RELEASABLE_MARKER), JSON.stringify({ releasable: true, written_by: 'mt-eval contest prepare' }));
  const corpus = join(root, 'public', 'eval-eng-sme-x-qualifier-v2026.json');
  writeFileSync(corpus, JSON.stringify({ entries: [{ id: '1', source: 'a', reference: 'b' }] }));
  return { root, corpus };
}

describe('4. releasableRoot', () => {
  it('the marker in the folder, or in an ancestor', () => {
    const c = contest('c-marker', { manifest: false });
    assert.deepEqual(releasableRoot(join(c.root, 'public')),
      { root: join(c.root, 'public'), why: 'marker', evidence: join(c.root, 'public', RELEASABLE_MARKER) });
    mkdirSync(join(c.root, 'public', 'sub'), { recursive: true });
    assert.equal(releasableRoot(join(c.root, 'public', 'sub', 'deeper')).root, join(c.root, 'public'));
    assert.equal(runsBaseFor(releasableRoot(join(c.root, 'public'))), join(c.root, 'runs'));
  });

  it('the older layout: public/ beside local/manifest.json, no marker', () => {
    const c = contest('c-legacy', { marker: false });
    const rel = releasableRoot(join(c.root, 'public'));
    assert.equal(rel.why, 'legacy');
    assert.equal(rel.evidence, join(c.root, 'local', 'manifest.json'));
  });

  it('not releasable: a plain folder; a folder named public with no prepare manifest; the contest root itself', () => {
    const plain = join(DIR, 'plain', 'data');
    mkdirSync(plain, { recursive: true });
    assert.equal(releasableRoot(plain), null);
    const pub = join(DIR, 'site', 'public');
    mkdirSync(pub, { recursive: true });
    assert.equal(releasableRoot(pub), null);
    const c = contest('c-root');
    assert.equal(releasableRoot(c.root), null);
    assert.equal(releasableRoot(join(c.root, 'runs')), null, 'runs/ beside public/ is not releasable');
  });

  it('nested markers: the OUTERMOST releasable folder', () => {
    const outer = join(DIR, 'nest', 'public');
    const inner = join(outer, 'x', 'public');
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(outer, RELEASABLE_MARKER), '{}');
    writeFileSync(join(inner, RELEASABLE_MARKER), '{}');
    assert.equal(releasableRoot(inner).root, outer);
  });
});

describe('4. seam: the harness\'s own rule (release_folder) agrees, and accepts the folders this server chooses', () => {
  it('same verdict on every layout; the harness refuses none of the output folders run_benchmark passes', (t) => {
    try {
      execFileSync('python3', ['-c', 'import mt_eval_harness.release_folder'], { cwd: ARENA_DIR, timeout: 60_000, stdio: 'ignore' });
    } catch { t.skip('this harness has no release_folder module (or is not importable here)'); return; }
    const m = contest('seam-marker', { manifest: false });
    const l = contest('seam-legacy', { marker: false });
    const plain = join(DIR, 'seam-plain', 'data');
    mkdirSync(plain, { recursive: true });
    const probes = [join(m.root, 'public'), join(m.root, 'public', 'sub'), join(l.root, 'public'), plain, m.root];
    const py = 'import json,sys\nfrom mt_eval_harness.release_folder import releasable_root, refusal\n'
      + 'a = json.loads(sys.argv[1])\n'
      + 'print(json.dumps({"roots": [str(releasable_root(p)) if releasable_root(p) else None for p in a["probes"]],'
      + ' "refused": [refusal(p, flag="--output-dir") is not None for p in a["outputs"]]}))';
    const chosen = [m, l].flatMap((c) => {
      const b = buildCorpusArgv({ corpus: c.corpus, provider: 'local', model: 'stub-1' },
        { env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd: DIR });
      return [argAfter(b.argv, '--cache-dir'), join(b.resultsBase, 'mcp-run-0123456789ab')];
    });
    const out = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify({ probes, outputs: chosen })],
      { cwd: ARENA_DIR, encoding: 'utf-8', timeout: 60_000 }).trim().split('\n').pop());
    const real = (p) => (p ? realpathSync(p) : null);
    assert.deepEqual(out.roots.map(real), probes.map((p) => real(releasableRoot(p)?.root ?? null)));
    assert.deepEqual(out.refused, chosen.map(() => false), `the harness would refuse: ${chosen.join(', ')}`);
  });
});

describe('4. a corpus in a releasable folder runs into <contest>/runs/', () => {
  const insidePublic = (c, p) => p.startsWith(join(c.root, 'public') + sep) || p === join(c.root, 'public');

  it('buildCorpusArgv: cache and results base in <contest>/runs/, for the marker and the older layout', () => {
    for (const c of [contest('c-a'), contest('c-b', { marker: false })]) {
      const b = buildCorpusArgv({ corpus: c.corpus, provider: 'local', model: 'stub-1', target_language: 'Northern Sami' },
        { env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd: DIR });
      assert.equal(argAfter(b.argv, '--cache-dir'), join(c.root, 'runs', 'cache'));
      assert.equal(b.resultsBase, join(c.root, 'runs'));
      assert.equal(b.cache.from, 'releasable');
      assert.equal(b.releasable.root, join(c.root, 'public'));
      assert.ok(!insidePublic(c, argAfter(b.argv, '--cache-dir')));
    }
  });

  it('an existing eval/cache/harness inside the releasable folder is not used', () => {
    const c = contest('c-legacy-cache');
    mkdirSync(join(c.root, 'public', 'eval', 'cache', 'harness'), { recursive: true });
    const b = buildCorpusArgv({ corpus: c.corpus, provider: 'local', model: 'stub-1' },
      { env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd: join(c.root, 'public') });
    assert.equal(argAfter(b.argv, '--cache-dir'), join(c.root, 'runs', 'cache'));
    assert.equal(b.skippedCache.dir, join(c.root, 'public', 'eval', 'cache', 'harness'));
    // an existing cache OUTSIDE it keeps being used (the older precedence)
    mkdirSync(join(DIR, 'proj', 'eval', 'cache', 'harness'), { recursive: true });
    const kept = buildCorpusArgv({ corpus: c.corpus, provider: 'local', model: 'stub-1' },
      { env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd: join(DIR, 'proj') });
    assert.equal(kept.cache.from, 'existing');
    assert.equal(kept.resultsBase, join(c.root, 'runs'), 'results still go to runs/');
  });

  it('a corpus outside any releasable folder keeps its results beside it', () => {
    const data = join(DIR, 'school', 'data');
    mkdirSync(data, { recursive: true });
    const f = join(data, 'test.json');
    writeFileSync(f, '[]');
    const b = buildCorpusArgv({ corpus: f, provider: 'local', model: 'stub-1' }, { env: { CHAMPOLLION_MCP_HOME: join(DIR, 'state') }, cwd: DIR });
    assert.equal(b.resultsBase, join(data, 'results'));
    assert.equal(argAfter(b.argv, '--cache-dir'), join(data, 'results', 'cache'));
    assert.equal(b.releasable, null);
  });

  it('a server state folder inside a releasable folder is refused, never passed to the harness', () => {
    const c = contest('c-state');
    assert.throws(() => buildCorpusArgv({ corpus: 'eval-eng-sme-tatoeba-dev-v1', provider: 'local', model: 'stub-1' },
      { env: { CHAMPOLLION_MCP_HOME: join(c.root, 'public', 'state') }, cwd: DIR }),
    /inside a releasable folder — .*public is marked releasable by contest prepare.*Set CHAMPOLLION_MCP_HOME to a folder outside it/s);
  });

  it('the plan says where results and cache go, and why', async () => {
    const c = contest('c-plan');
    const plan = await runBenchmark({ corpus: c.corpus, provider: 'local', model: 'stub-1', target_language: 'Northern Sami', dry_run: true },
      world().deps);
    const pub = join(c.root, 'public');
    assert.ok(plan.includes(`Results:  ${join(c.root, 'runs')}/mcp-<job id>/ — ${pub} is marked releasable by contest prepare `
      + `(${RELEASABLE_MARKER}), so run logs and the cache go to ${join(c.root, 'runs')}/ instead`), plan);
    assert.ok(plan.includes(`Cache:    ${join(c.root, 'runs', 'cache')}/ (beside the run's results, outside the releasable folder`), plan);
    assert.doesNotMatch(plan, new RegExp(`${pub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/results`));
    const legacy = contest('c-plan-legacy', { marker: false });
    const p2 = await runBenchmark({ corpus: legacy.corpus, provider: 'local', model: 'stub-1', dry_run: true }, world().deps);
    assert.match(p2, /is a contest's public\/ folder, which contest prepare releases \(its local\/manifest\.json sits beside it/);
  });

  it('confirm: the harness is handed --output-dir and --cache-dir under runs/, and the start message names them', async () => {
    const c = contest('c-run');
    const w = world();
    const out = await runBenchmark({ corpus: c.corpus, provider: 'local', model: 'stub-1', confirm: true }, w.deps);
    await awaitAllJobs();
    const argv = w.calls[0];
    const outDir = argAfter(argv, '--output-dir');
    assert.equal(dirname(outDir), join(c.root, 'runs'));
    assert.match(outDir, /mcp-run-[0-9a-f]+$/);
    assert.equal(argAfter(argv, '--cache-dir'), join(c.root, 'runs', 'cache'));
    for (const a of argv) assert.ok(!insidePublic(c, a) || a === c.corpus, `argv hands the harness a path inside public/: ${a}`);
    assert.ok(out.includes(`Results land in: ${outDir}/`), out);
  });
});
