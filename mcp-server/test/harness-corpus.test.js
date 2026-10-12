/**
 * run_benchmark 0.2.0 — corpus mode, local models, the publish default, and
 * refusals that must reach the user AS refusals.
 *
 *   - corpus mode runs ANY corpus (a registry id or a file the user holds) on
 *     any model, including one on this machine (provider "local", method
 *     "local-model");
 *   - nothing publishes unless publish:true, and then the target is NAMED and
 *     the harness gets its separate production opt-in (--prod);
 *   - a steward's `<file>.champollion.json` local-only mark refuses every
 *     remote model UP FRONT — no job, no spawn, and the message says not to
 *     route around it;
 *   - the harness's own refusals (transmission policy, NC terms) come back as
 *     refusals with guidance, never as a generic FAILED.
 *
 * No network, no real subprocess: every dependency is injected.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCorpusArgv, buildRunArgv, runBenchmark, getRunStatus, awaitAllJobs,
  listJobs, resetJobs, classifyRefusal, isLoopbackUrl, publishTarget,
} from '../src/tools/harness.js';

let DIR;
let CORPUS;
let SEALED;
before(() => {
  DIR = mkdtempSync(join(tmpdir(), 'mcp-corpus-'));
  CORPUS = join(DIR, 'school-test.jsonl');
  writeFileSync(CORPUS, '{"source":"hello","reference":"tânisi"}\n');
  SEALED = join(DIR, 'community-test.jsonl');
  writeFileSync(SEALED, '{"source":"hello","reference":"tânisi"}\n');
  writeFileSync(`${SEALED}.champollion.json`, JSON.stringify({ transmission: 'local-only' }));
  process.env.CHAMPOLLION_MCP_DEBUG_LOG = join(DIR, 'debug.log');
  process.env.CHAMPOLLION_MCP_HOME = join(DIR, 'state'); // job history: never the real home
});
after(() => {
  delete process.env.CHAMPOLLION_MCP_DEBUG_LOG;
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(DIR, { recursive: true, force: true });
});
beforeEach(resetJobs);

const REGISTRY = {
  entries: {
    openrouter: { kind: 'llm-provider' },
    local: { kind: 'llm-provider', default_base_url: 'http://localhost:11434/v1' },
    'google-translate': { kind: 'mt-api' },
    apertium: { kind: 'mt-api', env: ['APERTIUM_API_URL', 'APERTIUM_API_KEY'], default_base_url: 'https://apertium.org/apy', keyless: true },
    'local-model': { kind: 'local-model', runtimes: ['harness'] },
  },
};

function deps({ exec, env = {} } = {}) {
  const calls = [];
  return {
    calls,
    handle: {
      isMtEvalInstalled: async () => true,
      execCapture: exec ?? (async (cmd, args) => { calls.push({ cmd, args }); return { code: 0, stdout: 'chrF++ 41.2', stderr: '' }; }),
      env,
      methodRegistry: REGISTRY,
      // no network in tests: the Hub listing is asked only by plan-notes' own tests
      localModelWeights: async () => [],
    },
  };
}

describe('buildCorpusArgv', () => {
  it('a registry id runs as --corpus <id>', () => {
    const r = buildCorpusArgv({ corpus: 'eval-eng-yor-dev-v1', model: 'openai/gpt-5.5' }, { env: {} });
    assert.equal(r.corpusKind, 'registry');
    assert.deepEqual(r.argv.slice(0, 5), ['run', '--corpus', 'eval-eng-yor-dev-v1', '--model', 'openai/gpt-5.5']);
    assert.ok(r.argv.includes('--yes'));
    assert.ok(!r.argv.includes('--publish'), 'never publishes unless asked');
  });

  it('a file the user holds runs by its ABSOLUTE path', () => {
    const r = buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'llama3.1' }, { env: {} });
    assert.equal(r.corpusKind, 'file');
    assert.equal(r.argv[2], CORPUS);
    assert.ok(r.argv.includes('--provider') && r.argv.includes('local'));
    assert.equal(r.transport, 'local', 'the default Ollama endpoint is loopback');
  });

  it('accepts Ollama-style model names and a base_url for local', () => {
    const r = buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'qwen2.5:7b', base_url: 'http://127.0.0.1:8080/v1' }, { env: {} });
    assert.ok(r.argv.includes('qwen2.5:7b'));
    assert.deepEqual(r.argv.slice(r.argv.indexOf('--base-url'), r.argv.indexOf('--base-url') + 2), ['--base-url', 'http://127.0.0.1:8080/v1']);
  });

  it('passes a coaching file and a glossary through as absolute paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-coach-'));
    const coach = join(dir, 'coaching.json');
    const terms = join(dir, 'terms.json');
    writeFileSync(coach, '{"dictionary": {"a": "b"}}');
    writeFileSync(terms, '{"blood pressure": "x"}');
    const r = buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'llama3.1',
      coaching_file: coach, glossary: terms }, { env: {} });
    assert.deepEqual(r.argv.slice(r.argv.indexOf('--coaching-file'), r.argv.indexOf('--coaching-file') + 2), ['--coaching-file', coach]);
    assert.deepEqual(r.argv.slice(r.argv.indexOf('--glossary'), r.argv.indexOf('--glossary') + 2), ['--glossary', terms]);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'm',
      glossary: join(dir, 'missing.json') }, { env: {} }), /glossary not found/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: 'local-model', model: 'facebook/nllb-200-distilled-600M',
      coaching_file: coach }, { env: {} }), /coaches an LLM/);
  });

  it('a "local" provider pointed off-machine is classified REMOTE', () => {
    const r = buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'llama3.1' },
      { env: { LOCAL_API_BASE: 'https://api.groq.com/openai/v1' } });
    assert.equal(r.transport, 'remote');
  });

  it('requires a model for local runs (the harness default is a hosted slug)', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, provider: 'local' }, { env: {} }), /needs model/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: 'local-model' }, { env: {}, mtMethods: ['local-model'] }), /Hugging Face id/);
  });

  it('validates method names against the method registry', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: '../evil-plugin', model: 'x' }, { env: {}, mtMethods: ['local-model'] }), /method must be one of/);
    const ok = buildCorpusArgv({ corpus: CORPUS, method: 'local-model', model: 'facebook/nllb-200-distilled-600M' }, { env: {}, mtMethods: ['local-model'] });
    assert.ok(ok.argv.includes('--method'));
    assert.ok(!ok.argv.includes('--provider'), 'a method run carries no LLM provider flag');
  });

  it('rejects option-shaped and missing inputs', () => {
    assert.throws(() => buildCorpusArgv({ corpus: '--output-dir=/etc', model: 'm' }, { env: {} }), /failed validation|not found/);
    assert.throws(() => buildCorpusArgv({ corpus: '-rf', model: 'm' }, { env: {} }), /failed validation/);
    assert.throws(() => buildCorpusArgv({ corpus: '/nope/missing.jsonl', model: 'm' }, { env: {} }), /not found/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: 'm; rm -rf /' }, { env: {} }), /model failed validation/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: 'm', target_language: '--x' }, { env: {} }), /failed validation/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: 'm', base_url: 'http://x' }, { env: {} }), /base_url applies only/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: 'm', max_cost: -1 }, { env: {} }), /max_cost/);
  });

  it('passes the user\'s attestations only when given', () => {
    const r = buildCorpusArgv({ corpus: 'eval-x', model: 'm', attest_no_training: true, accept_nc_terms: true, max_cost: 2.5 }, { env: {} });
    assert.ok(r.argv.includes('--attest-no-training'));
    assert.ok(r.argv.includes('--accept-nc-terms'));
    assert.deepEqual(r.argv.slice(r.argv.indexOf('--max-cost'), r.argv.indexOf('--max-cost') + 2), ['--max-cost', '2.5']);
  });

  it('publish:true → --publish --prod for production, + --anonymous on request', () => {
    const prod = buildCorpusArgv({ corpus: 'eval-x', model: 'm', publish: true, anonymous: true }, { env: {} });
    assert.ok(prod.argv.includes('--publish') && prod.argv.includes('--prod') && prod.argv.includes('--anonymous'));
    const dev = buildCorpusArgv({ corpus: 'eval-x', model: 'm', publish: true }, { env: { MT_EVAL_SUPABASE_URL: 'https://dev.supabase.co' } });
    assert.ok(dev.argv.includes('--publish'));
    assert.ok(!dev.argv.includes('--prod'), 'a non-production target needs no prod opt-in');
  });

  it('the steward\'s local-only sidecar refuses every remote transport', () => {
    for (const p of [{ provider: 'openrouter' }, { provider: 'anthropic' }]) {
      assert.throws(() => buildCorpusArgv({ corpus: SEALED, model: 'm', ...p }, { env: {} }),
        (err) => err.transmissionRefusal && err.transmissionRefusal.sidecar.endsWith('.champollion.json'));
    }
    assert.throws(() => buildCorpusArgv({ corpus: SEALED, model: 'llama3.1', provider: 'local' },
      { env: { LOCAL_API_BASE: 'https://remote.example/v1' } }), (err) => Boolean(err.transmissionRefusal));
    const ok = buildCorpusArgv({ corpus: SEALED, model: 'llama3.1', provider: 'local' }, { env: {} });
    assert.equal(ok.transport, 'local');
    assert.ok(ok.localOnly);
  });
});

describe('item mode publish flags (mt-eval run now publishes with --publish --prod)', () => {
  const ITEM = { corpus_id: 'eval-eng-ilo-dev-v1', model: 'a/b', target_language: 'Ilocano', condition: 'naive' };
  it('no publish flags unless asked', () => {
    assert.ok(!buildRunArgv(ITEM).includes('--publish'));
  });
  it('publish:true → --publish --prod (production target)', () => {
    const argv = buildRunArgv(ITEM, { publish: true, env: {} });
    assert.deepEqual(argv.slice(-2), ['--publish', '--prod']);
  });
});

describe('runBenchmark corpus mode', () => {
  it('dry_run returns the plan inline, says it runs locally, spawns nothing', async () => {
    const { handle, calls } = deps();
    const out = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'llama3.1', target_language: 'Plains Cree', dry_run: true }, handle);
    assert.match(out, /DRY RUN/);
    assert.match(out, /ON THIS MACHINE/);
    assert.match(out, /stay LOCAL — nothing is published/);
    assert.equal(calls.length, 0);
    assert.equal(listJobs().length, 0);
  });

  it('requires confirm:true before running', async () => {
    const { handle, calls } = deps();
    const out = await runBenchmark({ corpus: 'eval-eng-yor-dev-v1', model: 'openai/gpt-5.5' }, handle);
    assert.match(out, /CONFIRMATION REQUIRED/);
    assert.match(out, /SENT to that model API/);
    assert.equal(calls.length, 0);
  });

  it('a confirmed run is a background job with the corpus argv', async () => {
    const { handle, calls } = deps();
    const out = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'llama3.1', confirm: true }, handle);
    assert.match(out, /STARTED/);
    // the same rule as the CLI and the harness: a loopback model costs $0 in API fees
    assert.match(out, /Est\. cost: \$0 API cost \(runs on this machine\)/);
    // a file the user holds keeps its results in their project, not the server's folder
    assert.match(out, /Results land in: .*mcp-corpus-[^/]+\/results\/mcp-run-/);
    await awaitAllJobs();
    assert.equal(calls[0].cmd, 'mt-eval');
    assert.equal(calls[0].args[0], 'run');
    assert.equal(calls[0].args[2], CORPUS);
  });

  it('a local-only corpus + remote provider is REFUSED up front: no job, no spawn', async () => {
    const { handle, calls } = deps();
    const out = await runBenchmark({ corpus: SEALED, model: 'openai/gpt-5.5', confirm: true }, handle);
    assert.match(out, /REFUSED — this corpus is marked LOCAL-ONLY by its data steward/);
    assert.match(out, /Do NOT retry with another/);
    assert.equal(calls.length, 0);
    assert.equal(listJobs().length, 0);
  });

  it('refuses mixing modes, and local/base_url outside corpus mode', async () => {
    const { handle } = deps();
    assert.match(await runBenchmark({ corpus: CORPUS, top: 3 }, handle), /ONE of item_id, corpus, or budget\/top/);
    assert.match(await runBenchmark({ top: 3, provider: 'local' }, handle), /corpus mode only/);
    assert.match(await runBenchmark({ top: 3, base_url: 'http://localhost:1/v1' }, handle), /corpus mode only/);
  });

  it('a harness transmission refusal comes back AS a refusal with guidance', async () => {
    const { handle } = deps({
      exec: async () => ({
        code: 1,
        stdout: '',
        stderr: 'RuntimeError: Transmission policy (sealed): the data\'s steward marked it local-only (corpus metadata) — only a model on this machine may see it. Remote evaluation of this corpus is refused. Run locally instead: --provider local.',
      }),
    });
    await runBenchmark({ corpus: 'eval-x', model: 'm', confirm: true }, handle);
    await awaitAllJobs();
    const out = getRunStatus(listJobs().at(-1).id);
    assert.match(out, /REFUSED BY THE DATA'S TRANSMISSION POLICY/);
    assert.match(out, /Do NOT retry with another remote provider/);
    assert.doesNotMatch(out, /^FAILED/m);
  });

  it('an NC-terms stop asks for the user\'s acknowledgment', async () => {
    const { handle } = deps({
      exec: async () => ({ code: 2, stdout: "  ✗ Corpus 'x' is NON-COMMERCIAL / research-only (license: CC-BY-NC-4.0). Re-run with --accept-nc-terms to acknowledge …", stderr: '' }),
    });
    await runBenchmark({ corpus: 'eval-x', model: 'm', confirm: true }, handle);
    await awaitAllJobs();
    assert.match(getRunStatus(listJobs().at(-1).id), /accept_nc_terms: true/);
  });
});

describe('a method is not local by its name (Round 5 hospital persona)', () => {
  // The plan used to say "this run stays local, as required" for
  // method "apertium" on a local-only file, although apertium's default is the
  // public apertium.org service. The harness refused it (nothing leaked), but
  // the plan told a hospital user something false.
  const NAMES = ['google-translate', 'apertium', 'local-model'];
  const entries = REGISTRY.entries;

  it('an MT engine on a local-only file is REFUSED up front, naming where it would send the text', async () => {
    assert.throws(() => buildCorpusArgv({ corpus: SEALED, method: 'apertium' },
      { env: {}, mtMethods: NAMES, methodEntries: entries }),
    (err) => err.transmissionRefusal?.methodKind === 'engine'
      && err.transmissionRefusal.engine.url === 'https://apertium.org/apy');
    const { handle, calls } = deps();
    const out = await runBenchmark({ corpus: SEALED, method: 'apertium', target_language: 'abc', dry_run: true }, handle);
    assert.match(out, /^REFUSED — this corpus is marked LOCAL-ONLY/);
    assert.match(out, /apertium\.org\/apy/);
    assert.match(out, /Do NOT retry with another\nremote provider or MT engine/);
    assert.doesNotMatch(out, /stays local/);
    assert.equal(calls.length, 0);
  });

  it('on an ordinary file the plan says an engine SENDS the text to its service', async () => {
    const { handle } = deps();
    const out = await runBenchmark({ corpus: CORPUS, method: 'apertium', dry_run: true }, handle);
    assert.match(out, /SENT to its service \(https:\/\/apertium\.org\/apy, its registry default\)/);
    assert.doesNotMatch(out, /ON THIS MACHINE/);
  });

  it('an engine pointed at a loopback URL still needs the USER\'s attestation, then runs with --attest-local-transport', async () => {
    const env = { APERTIUM_API_URL: 'http://localhost:2737' };
    assert.throws(() => buildCorpusArgv({ corpus: SEALED, method: 'apertium' },
      { env, mtMethods: NAMES, methodEntries: entries }), (err) => Boolean(err.transmissionRefusal));
    const { handle } = deps({ env });
    const refused = await runBenchmark({ corpus: SEALED, method: 'apertium', dry_run: true }, handle);
    assert.match(refused, /http:\/\/localhost:2737 \(APERTIUM_API_URL\), a loopback address/);
    assert.match(refused, /attest_local_transport: true/);
    const ok = buildCorpusArgv({ corpus: SEALED, method: 'apertium', attest_local_transport: true },
      { env, mtMethods: NAMES, methodEntries: entries });
    assert.equal(ok.transport, 'local');
    assert.ok(ok.argv.includes('--attest-local-transport'));
    const plan = await runBenchmark({ corpus: SEALED, method: 'apertium', attest_local_transport: true, dry_run: true }, handle);
    assert.match(plan, /allowed on the user's attestation/);
  });

  it('attesting a local transport for an engine configured for another host is refused (it would be false)', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: 'apertium', attest_local_transport: true },
      { env: {}, mtMethods: NAMES, methodEntries: entries }), /cannot apply: method "apertium" is configured for https:\/\/apertium\.org\/apy.*set APERTIUM_API_URL/s);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: 'google-translate', attest_local_transport: true },
      { env: {}, mtMethods: NAMES, methodEntries: entries }), /cloud API/);
  });

  it('the harness\'s own local-model runs in process: a local-only file needs no attestation', () => {
    // mirrors the harness (in_process_transport): no sentence leaves the machine
    const p = { corpus: SEALED, method: 'local-model', model: 'facebook/nllb-200-distilled-600M' };
    const ok = buildCorpusArgv(p, { env: {}, mtMethods: NAMES, methodEntries: entries });
    assert.equal(ok.transport, 'local');
    assert.ok(!ok.argv.includes('--attest-local-transport'));
    // a third-party plugin still needs the user's attestation
    assert.throws(() => buildCorpusArgv({ corpus: SEALED, method: 'apertium' },
      { env: {}, mtMethods: NAMES, methodEntries: entries }), (err) => !!err.transmissionRefusal);
  });

  it('attest_local_transport is refused for an LLM run, and a method run refuses an explicit provider', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'llama3.1', attest_local_transport: true },
      { env: {} }), /applies to method_dir plugins and MT engines only/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method: 'local-model', model: 'facebook/nllb-200-distilled-600M', provider: 'local' },
      { env: {}, mtMethods: NAMES, methodEntries: entries }), /provider applies to LLM runs only/);
  });
});

describe('method_dir — a method plugin directory the user holds', () => {
  let PLUGIN;
  let EMPTY;
  let CHAMP;
  before(() => {
    PLUGIN = join(DIR, 'export', 'plugin');
    mkdirSync(PLUGIN, { recursive: true });
    writeFileSync(join(PLUGIN, 'method.json'), '{"name": "clinic-mt", "entry_point": "method:ClinicMethod", "class": "custom-plugin"}');
    EMPTY = join(DIR, 'not-a-plugin');
    mkdirSync(EMPTY, { recursive: true });
    CHAMP = join(DIR, 'export', 'model', 'champollion-plugin');
    mkdirSync(CHAMP, { recursive: true });
    writeFileSync(join(CHAMP, 'method.json'), '{"name": "nmt-forge-r", "type": "api", "endpoint": "http://127.0.0.1:8378/translate"}');
  });

  it('runs as --method <absolute dir>, with no provider flag', () => {
    const r = buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN }, { env: {} });
    assert.deepEqual(r.argv.slice(r.argv.indexOf('--method'), r.argv.indexOf('--method') + 2), ['--method', PLUGIN]);
    assert.ok(!r.argv.includes('--provider'));
    assert.equal(r.methodKind, 'plugin');
    assert.equal(r.transport, 'method', 'a plugin is not local on its own say-so');
  });

  it('validates the directory and keeps it exclusive with method / provider / model', () => {
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: EMPTY }, { env: {} }), /has no method\.json/);
    // a champollion plugin manifest (an nmt-forge export's) is not an mt-eval method plugin
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: CHAMP }, { env: {} }),
      /lacks entry_point — it is not an mt-eval method plugin.*forge_export/s);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: join(DIR, 'missing') }, { env: {} }), /method_dir not found/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, method: 'local-model', model: 'x/y' },
      { env: {}, mtMethods: ['local-model'] }), /not both/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, provider: 'openrouter' }, { env: {} }), /provider applies to LLM runs only/);
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: `${PLUGIN}\n--x` }, { env: {} }), /failed validation/);
  });

  it('on a local-only file it is refused without the user\'s attestation, and runs with it', async () => {
    const { handle, calls } = deps();
    const refused = await runBenchmark({ corpus: SEALED, method_dir: PLUGIN, confirm: true }, handle);
    assert.match(refused, /^REFUSED — this corpus is marked LOCAL-ONLY/);
    assert.match(refused, /is a method plugin/);
    assert.equal(calls.length, 0);
    const out = await runBenchmark({ corpus: SEALED, method_dir: PLUGIN, attest_local_transport: true, confirm: true }, handle);
    assert.match(out, /STARTED/);
    await awaitAllJobs();
    const args = calls[0].args;
    assert.ok(args.includes('--attest-local-transport'));
    assert.equal(args[args.indexOf('--method') + 1], PLUGIN);
  });
});

describe('Round 6 — one attestation rule, model with method_dir, the source language, one cost rule', () => {
  const NAMES = ['google-translate', 'apertium', 'local-model'];
  const entries = REGISTRY.entries;
  let PLUGIN;
  before(() => {
    PLUGIN = join(DIR, 'r6-plugin');
    mkdirSync(PLUGIN, { recursive: true });
    writeFileSync(join(PLUGIN, 'method.json'), '{"name": "sme-mt", "entry_point": "method:SmeMethod"}');
  });

  it('an attestation for local-model is refused as meaningless — it runs in this process', () => {
    assert.throws(() => buildCorpusArgv({ corpus: SEALED, method: 'local-model', model: 'facebook/nllb-200-distilled-600M',
      attest_local_transport: true }, { env: {}, mtMethods: NAMES, methodEntries: entries }),
    /does not apply to method "local-model".*no attestation is needed/s);
  });

  it('every text the server sends agrees: local-model needs no attestation, a plugin does', async () => {
    const { handle } = deps();
    // the local-only refusal (a remote provider) lists what IS allowed
    const refused = await runBenchmark({ corpus: SEALED, provider: 'openrouter', model: 'x/y', dry_run: true }, handle);
    assert.match(refused, /method: "local-model".*\n.*runs it in this process, so it needs NO attestation/);
    assert.doesNotMatch(refused, /local-model[^\n]*\n[^\n]*attest_local_transport: true once the USER confirms the transport/);
    assert.match(refused, /method_dir: .*\n.*attest_local_transport: true once the USER confirms it/);
    const g = classifyRefusal('Transmission policy refused').guidance;
    assert.match(g, /"local-model", which the harness runs in this process and needs no attestation/);
    // the plan for local-model on a local-only file
    const plan = await runBenchmark({ corpus: SEALED, method: 'local-model', model: 'facebook/nllb-200-distilled-600M',
      dry_run: true }, handle);
    assert.match(plan, /in this process \(nothing leaves the machine; no attestation needed\)/);
    assert.doesNotMatch(plan, /--attest-local-transport/);
  });

  it('model goes TO a method_dir plugin as -m, in its own naming — never checked against a slug pattern', () => {
    const r = buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, model: 'giellalt/sme-nob:v2' }, { env: {} });
    assert.equal(r.argv[r.argv.indexOf('--model') + 1], 'giellalt/sme-nob:v2');
    assert.equal(r.argv[r.argv.indexOf('--method') + 1], PLUGIN);
    const local = buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, model: join(DIR, 'models', 'my model') }, { env: {} });
    assert.equal(local.argv[local.argv.indexOf('--model') + 1], join(DIR, 'models', 'my model'));
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, model: '--evil' }, { env: {} }), /model failed validation/);
    // a provider with a method is still refused
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, method_dir: PLUGIN, model: 'm', provider: 'openrouter' }, { env: {} }),
      /provider applies to LLM runs only/);
    // an LLM slug keeps its strict shape
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: '/abs/path' }, { env: {} }), /model failed validation/);
  });

  it('source_language becomes --source-lang; a file says nothing → the plan warns the card will be blank', async () => {
    const r = buildCorpusArgv({ corpus: CORPUS, provider: 'local', model: 'stub-1', source_language: 'English' }, { env: {} });
    assert.equal(r.argv[r.argv.indexOf('--source-lang') + 1], 'English');
    assert.ok(!r.argv.includes('--source-code'));
    assert.throws(() => buildCorpusArgv({ corpus: CORPUS, model: 'm', source_language: '-x' }, { env: {} }), /source_language failed validation/);
    const { handle } = deps();
    const bare = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya', dry_run: true }, handle);
    assert.match(bare, /no source_language given and the file does not state its source language.*run card's source language will be blank/s);
    const named = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      source_language: 'English', dry_run: true }, handle);
    assert.match(named, /^Source:   English \(source_language\)$/m);
  });

  it('the corpus card the steward\'s sidecar names states the source: --source-code, and the plan says so', async () => {
    const f = join(DIR, 'nurse.tsv');
    writeFileSync(f, 'a\tb\n');
    writeFileSync(join(DIR, 'nurse-card.json'), JSON.stringify({ id: 'eval-eng-qaa-x', pair: { source: 'eng', target: 'qaa' } }));
    writeFileSync(`${f}.champollion.json`, JSON.stringify({ transmission: 'local-only', id: 'eval-eng-qaa-x', card: 'nurse-card.json' }));
    const r = buildCorpusArgv({ corpus: f, provider: 'local', model: 'stub-1' }, { env: {} });
    assert.equal(r.argv[r.argv.indexOf('--source-code') + 1], 'eng');
    assert.equal(r.source.code, 'eng');
    assert.match(r.source.from, /corpus card the steward's sidecar names/);
    assert.equal(r.datasetId, 'eval-eng-qaa-x');
    const { handle } = deps();
    const plan = await runBenchmark({ corpus: f, provider: 'local', model: 'stub-1', target_language: 'Atya', dry_run: true }, handle);
    assert.match(plan, /^Source:   eng — from the corpus card the steward's sidecar names .*the harness names the language/m);
    assert.doesNotMatch(plan, /no source_language given/);
  });

  it('one cost rule: a loopback or in-process run is "$0 API cost (runs on this machine)" in the plan AND the start message', async () => {
    const { handle } = deps();
    const local = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      base_url: 'http://127.0.0.1:11434/v1' }, handle);
    assert.match(local, /^Cost:     \$0 API cost \(runs on this machine\)$/m);
    assert.doesNotMatch(local, /unknown, never \$0/);
    const started = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      base_url: 'http://127.0.0.1:11434/v1', confirm: true }, handle);
    assert.match(started, /Est\. cost: \$0 API cost \(runs on this machine\)/);
    const lm = await runBenchmark({ corpus: CORPUS, method: 'local-model', model: 'facebook/nllb-200-distilled-600M', dry_run: true }, handle);
    assert.match(lm, /^Cost:     \$0 API cost \(runs on this machine\)$/m);
    const engine = await runBenchmark({ corpus: CORPUS, method: 'apertium', dry_run: true }, handle);
    assert.match(engine, /^Cost:     unknown \(the engine has no published price/m);
    const remote = await runBenchmark({ corpus: CORPUS, model: 'openai/gpt-5.5', target_language: 'Atya', dry_run: true }, handle);
    assert.match(remote, /^Cost:     real API tokens/m);
    await awaitAllJobs();
  });
});

describe('Round 6 — a publish preview with the harness\'s facts, and an acknowledgement in words', () => {
  const okProbe = (entries, redacted = null) => async () => ({
    status: 'ok', entries, registered: false, prompt: { redacted },
  });

  it('dry_run with publish lists what goes public and the exact acknowledgement — and runs nothing', async () => {
    const { handle, calls } = deps();
    let asked;
    handle.publishProbe = async (input) => { asked = input; return okProbe({ allowed: false, why: 'unregistered/own corpus (license unconfirmed)' })(); };
    const out = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      publish: true, dry_run: true }, handle);
    assert.deepEqual(asked, { datasetId: null, localOnly: false, prompt: true, coached: false });
    assert.match(out, /WHAT GETS PUBLISHED/);
    assert.match(out, /sentence text is WITHHELD — scores only \(unregistered\/own corpus/);
    assert.match(out, /the harness's own prompt template \(it names only the languages\) is published with the card/);
    assert.match(out, /publish_ack: "publish to production: scores only, prompt published"/);
    assert.equal(calls.length, 0);
  });

  it('text that WOULD go public, and a coaching prompt published in full, are said plainly', async () => {
    const { handle } = deps();
    handle.publishProbe = okProbe({ allowed: true, why: 'redistribution-cleared (permissive license, open segment)' });
    const coach = join(DIR, 'coach.md');
    writeFileSync(coach, 'be formal');
    const out = await runBenchmark({ corpus: 'eval-eng-yor-dev-v1', model: 'openai/gpt-5.5', coaching_file: coach,
      publish: true, dry_run: true }, handle);
    assert.match(out, /EVERY row WITH its source, reference and model output text goes to the PUBLIC run_card_entries table/);
    assert.match(out, /coaching file's FULL TEXT is published with the card/);
    assert.match(out, /publish_ack: "publish to production: sentence text, prompt published"/);
  });

  it('a local-only file\'s coached prompt is redacted by the harness — the preview says so', async () => {
    const { handle } = deps();
    let asked;
    handle.publishProbe = async (input) => { asked = input; return { status: 'ok', registered: false,
      entries: { allowed: false, why: 'the data steward marked this corpus local-only' },
      prompt: { redacted: 'local-only corpus: its steward marked the work private' } }; };
    const coach = join(DIR, 'coach2.md');
    writeFileSync(coach, 'pairs');
    const out = await runBenchmark({ corpus: SEALED, provider: 'local', model: 'stub-1', target_language: 'Atya',
      coaching_file: coach, publish: true, dry_run: true }, handle);
    assert.equal(asked.localOnly, true);
    assert.equal(asked.coached, true);
    assert.match(out, /coaching prompt is REDACTED on the card — only its sha256 is published/);
    assert.match(out, /publish_ack: "publish to production: scores only, prompt redacted"/);
  });

  it('a real publish without the acknowledgement — or with other words — is REFUSED and runs nothing', async () => {
    const { handle, calls } = deps();
    handle.publishProbe = okProbe({ allowed: false, why: 'x' });
    const base = { corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya', publish: true, confirm: true };
    const none = await runBenchmark(base, handle);
    assert.match(none, /^REFUSED — publish: true needs the user's acknowledgement/);
    const wrong = await runBenchmark({ ...base, publish_ack: 'yes publish' }, handle);
    assert.match(wrong, /^REFUSED — publish_ack "yes publish" does not match/);
    assert.equal(calls.length, 0);
    const ok = await runBenchmark({ ...base, publish_ack: 'publish to production: scores only, prompt published' }, handle);
    assert.match(ok, /STARTED/);
    await awaitAllJobs();
    assert.ok(calls[0].args.includes('--publish'));
  });

  it('when the harness cannot be asked, a publish is refused with how to see the facts — never blind', async () => {
    const { handle, calls } = deps();
    handle.publishProbe = async () => ({ status: 'error', error: 'this mt-eval-harness predates the publish gates' });
    const plan = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      publish: true, dry_run: true }, handle);
    assert.match(plan, /WHAT GETS PUBLISHED: could not be checked — this mt-eval-harness predates/);
    assert.match(plan, /mt-eval publish <report> --dry-run/);
    const run = await runBenchmark({ corpus: CORPUS, provider: 'local', model: 'stub-1', target_language: 'Atya',
      publish: true, confirm: true, publish_ack: 'anything' }, handle);
    assert.match(run, /^REFUSED — publish: true, but what would go public could not be checked/);
    assert.equal(calls.length, 0);
  });

  it('a method run publishes no prompt; the preview asks the harness without one', async () => {
    const { handle } = deps();
    let asked;
    handle.publishProbe = async (input) => { asked = input; return okProbe({ allowed: false, why: 'x' })(); };
    const out = await runBenchmark({ corpus: CORPUS, method: 'local-model', model: 'facebook/nllb-200-distilled-600M',
      publish: true, dry_run: true }, handle);
    assert.equal(asked.prompt, false);
    assert.match(out, /no prompt: the method translates by itself/);
    assert.match(out, /publish_ack: "publish to production: scores only, no prompt"/);
  });
});

describe('helpers', () => {
  it('isLoopbackUrl', () => {
    for (const u of ['http://localhost:11434/v1', 'http://127.0.0.1:8080', 'http://[::1]:1/v1', 'http://ollama.localhost/v1']) {
      assert.equal(isLoopbackUrl(u), true, u);
    }
    for (const u of ['https://api.groq.com/openai/v1', 'http://10.0.0.5:11434', 'not a url']) {
      assert.equal(isLoopbackUrl(u), false, u);
    }
  });

  it('publishTarget defaults to production and names it', () => {
    assert.equal(publishTarget({}).prod, true);
    assert.match(publishTarget({}).label, /PRODUCTION/);
    assert.equal(publishTarget({ MT_EVAL_SUPABASE_URL: 'https://x.supabase.co' }).prod, false);
  });

  it('classifyRefusal ignores ordinary failures', () => {
    assert.equal(classifyRefusal('KeyError: model'), null);
  });
});
