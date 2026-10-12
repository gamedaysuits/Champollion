/**
 * Round 14 synthetic personas (Next.js, i18next, Django): a run says it is
 * translating only when it will send something, the estimate names its rate
 * with its source and date, a dry run's cap warning says how to gate CI, the
 * status line explains its quality tier or leaves it out, a scoped post-sync
 * check says which locales it checked, the CI guide's check step prints why
 * it failed, commands meant for scripts are pinned, and the guide gives the
 * real reason the bot's own commit never starts the job again.
 *
 * End to end through the real CLI (bin/cli.js) against local stand-ins: a
 * tiny OpenAI-compatible model (test/fixtures/fake-openai-model.mjs) and a
 * preloaded fetch stub for OpenRouter's price list. No network, no key, no
 * production read (CHAMPOLLION_OFFLINE=1 throughout).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { startFakeModel, runCli, CLI } from './fixtures/fake-openai-model.mjs';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round14-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, `${JSON.stringify(obj, null, 2)}\n`);
const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
const flat = (text) => text.replace(/\s+/g, ' ');
const count = (text, needle) => text.split(needle).length - 1;
/** Off any CI runner, and never a network read of the card store. */
const BASE = { CI: '', GITHUB_ACTIONS: '', CHAMPOLLION_OFFLINE: '1' };
const summaryOf = (stdout) => stdout.trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } })
  .find(o => o && o.level === 'summary');
const STUB_FETCH = new URL('./fixtures/stub-openrouter-models.mjs', import.meta.url).href;
const priceList = (models) => ({ NODE_OPTIONS: `--import=${STUB_FETCH}`, STUB_OPENROUTER_MODELS: JSON.stringify(models) });
const GEMINI = [{ id: 'google/gemini-3.5-flash', pricing: { prompt: '0.0000003', completion: '0.0000025' } }];
const setConfig = (d, patch) => {
  const file = path.join(d, 'champollion.config.json');
  writeJSON(file, { ...readJSON(file), ...patch });
};

function nextApp(cfg = {}, messages = { save: 'Save your changes', open: 'Open the settings page' }) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), messages);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'stub-1', languages: ['fr', 'de'], ...cfg,
  });
  return d;
}

// ── 1. "Translating … with concurrency" only when something will be sent ──
describe('Round 14 — Next.js: the run says it is translating only when it will send something', () => {
  it('1: a dry run and a run with nothing to do say they are checking; a run with work names how many locales it translates', async () => {
    const model = await startFakeModel((k, s) => `T ${s}`);
    try {
      const d = nextApp();
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.equal(dry.code, 0, dry.out);
      assert.match(dry.out, /Checking 2 locale\(s\) — a dry run: nothing is sent to a model, nothing is written/);
      assert.doesNotMatch(dry.out, /Translating \d+ locale\(s\)/);

      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 0, first.out);
      assert.match(first.out, /Translating 2 locale\(s\) with concurrency \d+/);

      // Nothing changed: nothing is sent, and the line says so.
      const before = model.calls.length;
      const idle = await runCli(['sync'], d, env);
      assert.equal(idle.code, 0, idle.out);
      assert.equal(model.calls.length, before, 'nothing sent');
      assert.match(idle.out, /Checking 2 locale\(s\) — nothing to send to a model this run/);
      assert.doesNotMatch(idle.out, /Translating \d+ locale\(s\)/);

      // A new language has work; the other two have none: "1 of 3".
      setConfig(d, { languages: ['fr', 'de', 'es'] });
      const one = await runCli(['sync'], d, env);
      assert.equal(one.code, 0, one.out);
      assert.match(one.out, /Translating 1 of 3 locale\(s\) with concurrency \d+ \(the other 2: nothing to send\)/);
      assert.equal(readJSON(path.join(d, 'messages/es.json')).save, 'T Save your changes');
    } finally {
      await model.close();
    }
  });
});

// ── 2. The estimate's rate, its source and its date ─────────────────────────
describe('Round 14 — Next.js: the hosted-model estimate gives its rate, where the rate came from, and when', () => {
  it('2: one line under the table names the per-1M rate, OpenRouter\'s price list and when it was read; --json carries the detail', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: 'google/gemini-3.5-flash' });
    const env = { ...BASE, OPENROUTER_API_KEY: 'sk-or-placeholder', ...priceList(GEMINI) };
    const startedAt = Date.now();
    const r = await runCli(['sync', '--dry'], d, env);
    assert.equal(r.code, 0, r.out);
    const line = /Rate: google\/gemini-3\.5-flash \$0\.30 input \/ \$2\.50 output per 1M tokens — OpenRouter's price list, read (\d{4}-\d\d-\d\d \d\d:\d\d) UTC\. An estimate: ~200 input \+ ~30 output tokens per key assumed — the bill depends on the real lengths \(--json has the detail\)\./.exec(r.out);
    assert.ok(line, r.out);
    assert.equal(count(r.out, 'Rate: '), 1, 'one line, said once');
    assert.doesNotMatch(r.out, /Note: Estimates are approximate/, 'the rate line replaces the generic note');

    const s = summaryOf((await runCli(['sync', '--dry', '--json'], d, env)).stdout);
    assert.equal(s.costEstimate.rates.length, 1);
    const rate = s.costEstimate.rates[0];
    assert.equal(rate.model, 'google/gemini-3.5-flash');
    assert.equal(rate.unit, 'token');
    assert.equal(rate.inputPerMillion, 0.3);
    assert.equal(rate.outputPerMillion, 2.5);
    assert.deepEqual(rate.tokensPerKey, { input: 200, output: 30 });
    assert.equal(rate.from, 'openrouter-price-list');
    assert.equal(rate.url, 'https://openrouter.ai/api/v1/models');
    const fetched = Date.parse(rate.fetchedAt);
    assert.ok(fetched >= startedAt - 1000 && fetched <= Date.now() + 1000, `read during the run: ${rate.fetchedAt}`);
    for (const p of s.costEstimate.pairs) assert.deepEqual({ ...p.rate, fetchedAt: null }, { ...rate, fetchedAt: null }, p.pair);
    // The figure is the rate times the tokens it assumes: 2 keys × (200 × $0.30 + 30 × $2.50) / 1M per pair.
    assert.equal(s.costEstimate.pairs[0].estimatedCost, Math.round(2 * (200 * 0.3 + 30 * 2.5) / 1e6 * 1e4) / 1e4);
  });

  it('2: a direct provider priced from the copy kept in champollion says so, with the date it was checked; a per-character price says its date too', async () => {
    const d = nextApp({ defaultMethod: 'openai', model: 'gpt-4o-mini' });
    const offline = await runCli(['sync', '--dry'], d, { ...BASE, OPENAI_API_KEY: 'sk-placeholder', CHAMPOLLION_PRICING_OFFLINE: '1' });
    assert.equal(offline.code, 0, offline.out);
    assert.match(offline.out, /Rate: gpt-4o-mini \$0\.15 input \/ \$0\.60 output per 1M tokens — a copy kept in champollion, checked 2026-08-01 \(the live price draw is off\)\. An estimate:/);

    const deepl = nextApp({ defaultMethod: 'deepl', model: undefined });
    const r = await runCli(['sync', '--dry'], deepl, { ...BASE, DEEPL_API_KEY: 'placeholder' });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Rate: deepl \$25\.00 per 1M characters — the provider's published price, as checked 2026-06-08\. An estimate: ~25 characters per key assumed/);
    const s = summaryOf((await runCli(['sync', '--dry', '--json'], deepl, { ...BASE, DEEPL_API_KEY: 'placeholder' })).stdout);
    assert.deepEqual(s.costEstimate.rates[0], {
      model: 'deepl', unit: 'char', perMillionChars: 25, charsPerKey: 25, from: 'published-rate',
      url: 'https://www.deepl.com/pro-api', verified: '2026-06-08',
    });
  });

  it('2: a direct provider priced from the live list says it stands in for the provider\'s own price; the copy says why it was used', async () => {
    const d = nextApp({ defaultMethod: 'openai', model: 'gpt-4o-mini' });
    const env = { ...BASE, OPENAI_API_KEY: 'sk-placeholder' };
    const live = await runCli(['sync', '--dry'], d, { ...env, ...priceList([{ id: 'openai/gpt-4o-mini', pricing: { prompt: '0.00000015', completion: '0.0000006' } }]) });
    assert.match(live.out, /Rate: gpt-4o-mini \$0\.15 input \/ \$0\.60 output per 1M tokens — OpenRouter's price list \(a stand-in for openai's own price\), read \d{4}-\d\d-\d\d \d\d:\d\d UTC\./);
    const unlisted = await runCli(['sync', '--dry'], d, { ...env, ...priceList(GEMINI) });
    assert.match(unlisted.out, /a copy kept in champollion, checked 2026-08-01 \(OpenRouter's list has no price for it\)/);
    const down = await runCli(['sync', '--dry'], d, { ...env, NODE_OPTIONS: `--import=${STUB_FETCH}`, STUB_OPENROUTER_MODELS: '503' });
    assert.match(down.out, /a copy kept in champollion, checked 2026-08-01 \(OpenRouter's list could not be read\)/);
  });

  it('2: a model on this machine, or a run served from the cache, has no rate line — the plain note stays', async () => {
    const model = await startFakeModel((k, s) => `T ${s}`);
    try {
      const d = nextApp();
      const r = await runCli(['sync', '--dry'], d, { ...BASE, LOCAL_API_BASE: model.url });
      assert.doesNotMatch(r.out, /Rate: /);
      assert.match(r.out, /Note: Estimates are approximate/);
    } finally {
      await model.close();
    }
  });

  it('2: the CLI reference documents the rate line and the --json fields', () => {
    const cli = flat(doc('reference/cli.md'));
    assert.match(cli, /Under the table, one line gives the rate the figure was priced at and where it came from/);
    assert.match(cli, /each pair's `rate` and the run's `rates` \(`inputPerMillion`, `outputPerMillion` or `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` or `verified`\)/);
  });
});

// ── 3. A dry run's cap warning says how to gate a CI step ───────────────────
describe('Round 14 — Next.js: `--dry --max-cost` says how to make a CI step fail on it', () => {
  it('3: the warning names the --json fields and the CI guide\'s check step; the real-run reason carries the figures', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: 'google/gemini-3.5-flash' });
    const env = { ...BASE, OPENROUTER_API_KEY: 'sk-or-placeholder', ...priceList(GEMINI) };
    const r = await runCli(['sync', '--dry', '--max-cost', '0.0001'], d, env);
    assert.equal(r.code, 0, 'a dry run stays a preview (Round 11)');
    assert.match(r.out, /A real run would stop at the --max-cost cap before any API call and exit 2: .* This dry run exits 0 \(a preview\): to fail a CI step on it, read `maxCost\.wouldStop` or `realRun\.exitCode` from `champollion sync --dry --json` — the CI guide's check step does, and prints the reason: https:\/\/champollion\.dev\/docs\/guides\/ci-cd#check-before-sync/);

    const s = summaryOf((await runCli(['sync', '--dry', '--max-cost', '0.0001', '--json'], d, env)).stdout);
    assert.equal(s.realRun.exitCode, 2);
    assert.match(s.realRun.reasons[0], /^--max-cost would stop it before any API call \(Estimated translation cost exceeds the --max-cost cap: estimate ~\$0\.\d{4}, cap \$0\.0001\)$/);

    // The preflight stopping first: the same hint, naming preflight.ready.
    const nokey = await runCli(['sync', '--dry', '--max-cost', '0.0001'], d, { ...BASE, ...priceList(GEMINI) });
    assert.match(nokey.out, /but the run would stop earlier.* read `preflight\.ready` or `realRun\.exitCode` from `champollion sync --dry --json`/);
  });

  it('3: the anchor the warning links to exists, and the reference says how to gate on it', () => {
    assert.match(doc('guides/ci-cd.md'), /^### Check before the sync: fail the job early \{#check-before-sync\}$/m);
    const cli = flat(doc('reference/cli.md'));
    assert.match(cli, /A dry run's own exit code never fails a CI step, so its `--max-cost` warning says how to gate one: read `maxCost\.wouldStop` \(or `realRun\.exitCode`\) from the `--json` summary/);
    assert.match(cli, /\[CI guide's check step\]\(\/docs\/guides\/ci-cd#check-before-sync\)/);
  });
});

// ── 4. status: the quality tier explained, or not shown ────────────────────
describe('Round 14 — Next.js: `status` says what a quality tier is, and shows none nobody set', () => {
  it('4: no tier line from the default; a tier the config sets is named as a label, with the alternatives', async () => {
    const d = nextApp();
    const plain = await runCli(['status'], d, BASE);
    assert.equal(plain.code, 0, plain.out);
    assert.doesNotMatch(plain.out, /quality tier|quality: /i, 'the default label is a claim nobody made');

    setConfig(d, { pairs: { 'en:de': { qualityTier: 'high' } } });
    const set = await runCli(['status'], d, BASE);
    assert.match(set.out, /en:de {2}→ {2}German\n {6}method: local {2}\| {2}model: stub-1\n {6}quality tier: High — the "qualityTier" your config sets for this pair: a label you chose \(standard, high, research, verified\), not a measurement\. Sync translates the same whatever it says; `serve` advertises it\./);
    assert.equal(count(set.out, 'quality tier:'), 1, 'only the pair that sets it');

    const json = JSON.parse((await runCli(['status', '--json'], d, BASE)).stdout);
    const byPair = Object.fromEntries(json.pairs.map(p => [p.pair, p]));
    assert.equal(byPair['en:fr'].qualityTierSet, false);
    assert.equal(byPair['en:de'].qualityTierSet, true);
    assert.equal(byPair['en:de'].qualityTier, 'high');
  });

  it('4: the docs say the same', () => {
    assert.match(flat(doc('reference/cli.md')), /A pair whose config sets `qualityTier` \(`standard`, `high`, `research` or `verified`\) shows it, said for what it is: a label you chose, not a measurement/);
    assert.match(doc('getting-started/configuration.md'), /\| `qualityTier` \| `string` \| A label you give the pair's output: .* Not measured, and sync translates the same whatever it says/);
  });
});

// ── 5. A scoped post-sync check says which locales it checked ──────────────
describe('Round 14 — i18next: after `sync --pair en:fr` the check names French, not "every locale"', () => {
  it('5: the closing line names the locale and the pair synced; verify checks every locale and finds the Spanish warning', async () => {
    const model = await startFakeModel((k, s) => `X ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/translation.json'), { save: 'Save your changes', open: 'Open the settings page' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'stub-1', languages: ['fr', 'es'],
      });
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // Spanish gets a value identical to its source: a warning in verify.
      const esFile = path.join(d, 'public/locales/es/translation.json');
      writeJSON(esFile, { ...readJSON(esFile), open: 'Open the settings page' });
      writeJSON(path.join(d, 'public/locales/en/translation.json'), { save: 'Save all your changes', open: 'Open the settings page' });

      const r = await runCli(['sync', '--pair', 'en:fr'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Verification passed for fr: keys, placeholders, plurals, markup and script are intact \(only en:fr was synced; `champollion verify` checks every locale\) — the meaning is not checked/);
      assert.doesNotMatch(r.out, /intact in every locale/);
      assert.doesNotMatch(r.out, /\[VERIFY\] es:/, 'Spanish was not checked');

      // The JSON closing line says which locales were checked.
      const j = await runCli(['sync', '--pair', 'en:fr', '--json'], d, env);
      const closing = j.stdout.trim().split('\n').map(l => JSON.parse(l)).find(o => o.command === 'verify' && o.level !== 'event');
      assert.deepEqual(closing.checked, ['fr']);
      assert.equal(closing.scope, 'synced-pairs');

      // verify, unscoped: every locale — and Spanish's warnings (the echo,
      // and "save", changed in the source but synced for French only).
      const all = await runCli(['verify'], d, env);
      assert.match(all.out, /\[VERIFY\] es: translation: 1 source echo\(es\): open/);
      assert.match(all.out, /\[VERIFY\] es: 1 translation\(s\) out of date/);
      assert.match(all.out, /Verification passed with 2 warning\(s\) — structure only; the meaning is not checked\./);

      // verify --pair: says it was asked for one pair.
      const one = await runCli(['verify', '--pair', 'en:fr'], d, env);
      assert.match(one.out, /Verification passed for fr: .* are intact \(only en:fr, as --pair asked; `champollion verify` without --pair checks every locale\)/);
      // A --pair that names every locale is a full check, said as one.
      const both = await runCli(['verify', '--pair', 'en:fr,en:es'], d, env);
      assert.match(both.out, /Verification passed with 2 warning\(s\) — structure only; the meaning is not checked\.\n/);
      assert.doesNotMatch(both.out, /as --pair asked/);
      const strict = await runCli(['verify', '--pair', 'en:es', '--strict'], d, env);
      assert.equal(strict.code, 1);
      assert.match(strict.out, /\[FAIL\] 2 warning\(s\) for es — --strict treats warnings as failures \(listed above; only en:es, as --pair asked; `champollion verify` without --pair checks every locale\)\./);
    } finally {
      await model.close();
    }
  });

  it('5: the reference says which locales a scoped check covers', () => {
    assert.match(flat(doc('reference/cli.md')), /A scoped check says so on its closing line — `Verification passed for fr: … intact \(only en:fr was synced; champollion verify checks every locale\)` — and never "in every locale"/);
  });
});

// ── 6. The CI guide's check step prints why it failed ──────────────────────
/** The guide's check step, as the shell lines a runner executes. */
function checkStepScript(guide) {
  const at = guide.indexOf('- name: Check the sync can run (translates nothing)');
  const block = guide.slice(at, guide.indexOf('```', at));
  const body = block.slice(block.indexOf('run: |') + 'run: |'.length);
  return body.split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
}
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;

/** Run the step under `bash -e` (GitHub's default shell), npx standing in for the pinned CLI. */
function runStep(script, cwd, env) {
  const bin = tmp('bin');
  // `npx --yes champollion@0.5 <args>` → this checkout's CLI with <args>.
  write(path.join(bin, 'npx'), `#!/bin/sh\nshift 2\nexec "${process.execPath}" "${CLI}" "$@"\n`);
  fs.chmodSync(path.join(bin, 'npx'), 0o755);
  const base = { ...process.env };
  for (const k of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'DEEPL_API_KEY', 'LOCAL_API_BASE']) delete base[k];
  return new Promise((resolve) => {
    const p = spawn('bash', ['-e', '-c', script], { cwd, env: { ...base, PATH: `${bin}:${process.env.PATH}`, ...env } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (c) => { stdout += c; });
    p.stderr.on('data', (c) => { stderr += c; });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('Round 14 — i18next: the documented check step says why it failed', () => {
  const guide = doc('guides/ci-cd.md');

  it('6: stderr is not thrown away, and a failure prints realRun.reasons (or the summary\'s error)', () => {
    const script = checkStepScript(guide);
    assert.doesNotMatch(script, /2>\/dev\/null/);
    assert.match(script, /"::error::" \+ \(\.error \/\/ "A real sync would exit \\\(\.realRun\.exitCode\): \\\(\.realRun\.reasons \| join\("; "\)\)"\)/);
    assert.doesNotMatch(guide, /--json 2>\/dev\/null/, 'nowhere on the page');
  });

  it('6: run as a runner runs it — a missing key and the cap each fail the step with the reason; a ready run passes', async (t) => {
    if (!has('bash') || !has('jq')) { t.skip('bash and jq are needed to run the documented step'); return; }
    const script = checkStepScript(guide);
    const d = nextApp({ defaultMethod: 'llm', model: 'google/gemini-3.5-flash' });
    const env = { ...BASE, ...priceList(GEMINI) };

    const nokey = await runStep(script, d, { ...env, SYNC_FLAGS: '--max-cost 5' });
    assert.equal(nokey.code, 1, nokey.stdout + nokey.stderr);
    assert.match(nokey.stdout, /^::error::A real sync would exit 1: it would stop before translating: No OpenRouter API key \(OPENROUTER_API_KEY\) for en:de, en:fr$/m);
    assert.match(nokey.stderr, /"level":"warn"/, 'the warnings stay in the log');

    const capped = await runStep(script, d, { ...env, OPENROUTER_API_KEY: 'sk-or-placeholder', SYNC_FLAGS: '--max-cost 0.0001' });
    assert.equal(capped.code, 1);
    assert.match(capped.stdout, /^::error::A real sync would exit 2: --max-cost would stop it before any API call \(Estimated translation cost exceeds the --max-cost cap: estimate ~\$0\.\d{4}, cap \$0\.0001\)$/m);

    const ready = await runStep(script, d, { ...env, OPENROUTER_API_KEY: 'sk-or-placeholder', SYNC_FLAGS: '--max-cost 5' });
    assert.equal(ready.code, 0, ready.stdout + ready.stderr);
    assert.doesNotMatch(ready.stdout, /::error::/);

    // A config sync cannot run with: the step prints its error, not a bare `false`.
    const broken = tmp('broken');
    writeJSON(path.join(broken, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'nowhere', languages: ['fr'] });
    const b = await runStep(script, broken, { ...env, OPENROUTER_API_KEY: 'sk-or-placeholder', SYNC_FLAGS: '--max-cost 5' });
    assert.equal(b.code, 1);
    assert.match(b.stdout, /^::error::Locales directory not found: .*nowhere/m);
  });
});

// ── 7. Commands meant for scripts and CI are pinned ─────────────────────────
describe('Round 14 — Django: a command a script runs names its version; the quick start says why', () => {
  const DOCS = new URL('../website/docs/', import.meta.url);
  // Not ours: the Network section and the build-MT guide have their own owners.
  const NOT_OURS = [/^network\//, /^build-mt-for-your-language\.md$/];
  const pages = (dir = DOCS, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (NOT_OURS.some(x => x.test(r))) return [];
    if (e.isDirectory()) return pages(new URL(`${e.name}/`, dir), r);
    return /\.mdx?$/.test(e.name) ? [r] : [];
  });

  it('7: the quick start says once why a script pins the version', () => {
    const q = flat(doc('getting-started/quick-start.md'));
    assert.match(q, /:::note\[Typed by you, or run by a script\?\]/);
    assert.match(q, /A command a script runs for you — CI, a `package\.json` script, a git hook — should name its version, `npx --yes champollion@0\.5 sync`, so a new release never changes what the build runs/);
  });

  it('7: no workflow on any page we own runs an unpinned `npx champollion` (the dev-dependency variant runs the installed copy)', () => {
    const offenders = [];
    for (const rel of pages()) {
      const text = doc(rel);
      for (const m of text.matchAll(/```ya?ml([^\n]*)\n([\s\S]*?)```/g)) {
        if (/\(dev dependency\)/.test(m[1])) continue;
        for (const line of m[2].split('\n')) {
          if (/npx (--yes |-y )?champollion(?!@)\b/.test(line)) offenders.push(`${rel}: ${line.trim()}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
    // The dev-dependency variant installs first (npm ci), so npx runs the copy the lock file pins.
    const ci = doc('guides/ci-cd.md');
    const dev = ci.slice(ci.indexOf('```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"'));
    assert.ok(dev.indexOf('- run: npm ci') < dev.indexOf('npx champollion sync'));
  });

  it('7: the CI pipeline in the enterprise guide, the tutorial\'s workflow and the README\'s git hook are pinned', () => {
    const enterprise = doc('guides/enterprise.md');
    for (const cmd of ['lint', 'sync', 'audit', 'integrity']) assert.match(enterprise, new RegExp(`npx --yes champollion@0\\.5 ${cmd} `));
    assert.match(doc('tutorials/translate-30-languages.md'), /run: npx --yes champollion@0\.5 sync\n/);
    const readme = read(new URL('../README.md', import.meta.url));
    assert.match(readme, /printf '#!\/bin\/sh\\nnpx --yes champollion@0\.5 lint\\n' > \.githooks\/pre-commit/);
  });
});

// ── 8 is the MCP tool (mcp-server/test/translate-round14.test.js) ───────────

// ── 9. Why the bot's commit never starts the job again ─────────────────────
describe('Round 14 — Django: the CI guide gives the real reason the bot\'s own push starts no run', () => {
  const guide = doc('guides/ci-cd.md');
  const f = flat(guide);

  it('9: said once — a push with GITHUB_TOKEN never triggers a workflow — with the token caveat; the paths rationale agrees with it', () => {
    assert.equal(count(f, 'never triggers a workflow run'), 1);
    assert.match(f, /\*\*The job's own commit never starts it again\*\* — and the `paths:` filter is not what stops it\. The commit step pushes with the workflow's `GITHUB_TOKEN`, and a push made with `GITHUB_TOKEN` never triggers a workflow run/);
    assert.match(f, /That is why the Django workflow below can watch `locale\/\*\*`, which every one of the bot's commits changes\./);
    assert.match(f, /Push with a personal access token or a GitHub App token instead .* that push does start this workflow again; then the `paths:` filter is what decides\./);
    assert.match(f, /With such a token, narrow it to the source catalog \(`locale\/en\/\*\*`\) and add languages through the config\./);
    // The old rationale (the lock files are left out "because the bot's commit changes them") is gone.
    assert.doesNotMatch(f, /the bot's own commit changes them/);
    // The Django prose says why it watches locale/** and points at the reason.
    assert.match(f, /It watches `locale\/\*\*` as well: a new language arrives as a new catalog folder \(`makemessages -l <code>`\)\. The bot's own commit changes those catalogs but starts no run, because it is pushed with `GITHUB_TOKEN`/);
    // And no advice relies on a push trigger firing on the bot's commits.
    assert.match(f, /A `push` trigger does not fire on the sync bot's own commits/);
  });
});
