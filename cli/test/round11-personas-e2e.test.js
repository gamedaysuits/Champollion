/**
 * Round 11 synthetic personas (Next.js, i18next, Django, the Cree school,
 * the hospital): what a run says must count one thing at a time, name what
 * it means, and be safe to copy.
 *
 * End to end through the real CLI (bin/cli.js) against local stand-ins: a
 * tiny OpenAI-compatible model (test/fixtures/fake-openai-model.mjs), a
 * stub `api` endpoint, and a preloaded fetch stub for OpenRouter's price
 * list (test/fixtures/stub-openrouter-models.mjs). No network, no key, no
 * production read (CHAMPOLLION_OFFLINE=1 throughout).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { refusalCategory } from '../lib/refusal-category.js';
import { FALLBACK_MAJORITY_SHARE } from '../lib/fallback.js';
import { flutterUncoveredLocales } from '../lib/flutter-locales.js';
import { getRegister, getGenderGuidance } from '../lib/registers.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round11-'));
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
/** OpenRouter's price list, answered locally (the CLI child preloads the stub). */
const priceList = (models) => ({ NODE_OPTIONS: `--import=${STUB_FETCH}`, STUB_OPENROUTER_MODELS: typeof models === 'string' ? models : JSON.stringify(models) });

function nextApp(cfg = {}, messages = { save: 'Save your changes', open: 'Open the settings page', close: 'Close the window now' }) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), messages);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr', 'de'], ...cfg,
  });
  return d;
}

// ── 1 + 5. A model switch: the redo the docs give, and one count ────────────
describe('Round 11 — Next.js: after a model switch, the documented redo works and the notice counts one thing', () => {
  it('1: the troubleshooting page gives --redo all --fresh-on-model-change; a bare --fresh-on-model-change sends nothing after a model-only switch', async () => {
    const page = doc('guides/troubleshooting.md');
    const section = page.slice(page.indexOf('### Translations after switching model or provider'), page.indexOf('## Recovering From a Bad Version'));
    assert.match(section, /\nchampollion sync --redo all --fresh-on-model-change\n/);
    assert.doesNotMatch(section, /\nchampollion sync --fresh-on-model-change\n/);
    assert.match(flat(section), /after a switch of model alone, a plain `sync --fresh-on-model-change` sends nothing/);

    const model = await startFakeModel((k, s, { model: m }) => `FR(${m}) ${s}`);
    try {
      const d = nextApp();
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'champollion.config.json'), { ...readJSON(path.join(d, 'champollion.config.json')), model: 'm2' });
      const before = model.calls.length;
      const bare = await runCli(['sync', '--fresh-on-model-change'], d, env);
      assert.equal(bare.code, 0, bare.out);
      assert.equal(model.calls.length, before, 'a bare --fresh-on-model-change sends nothing after a model-only switch');
      const redo = await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.equal(redo.code, 0, redo.out);
      const sent = model.calls.slice(before);
      assert.ok(sent.length > 0 && sent.every(c => c.model === 'm2'));
      assert.deepEqual(sent.flatMap(c => c.keys).sort(), ['close', 'close', 'open', 'open', 'save', 'save']);
      assert.match(readJSON(path.join(d, 'messages/fr.json')).save, /^FR\(m2\)/);
    } finally {
      await model.close();
    }
  });

  it('1: no public page this CLI owns gives a bare `sync --fresh-on-model-change` as the way to get the new model\'s text', () => {
    const pages = ['guides/troubleshooting.md', 'concepts/translation-memory.md', 'reference/cli.md', 'concepts/quality-gate.md', 'guides/professional-translators.md'];
    for (const rel of pages) {
      const text = doc(rel);
      for (const m of text.matchAll(/sync(?: --pair \S+)?(?: --model \S+)? --fresh-on-model-change/g)) {
        const around = text.slice(Math.max(0, m.index - 200), m.index + m[0].length + 60);
        assert.match(around, /on its own|On its own|alone|sends nothing/, `${rel}: "${m[0]}" without --redo all is explained as affecting only what the run translates anyway`);
      }
      for (const m of text.matchAll(/--redo all --fresh-on-model-change/g)) assert.ok(m.index > 0);
    }
  });

  it('5: with --fresh-on-model-change the total and the per-locale breakdown count the same strings — each once, under the model that would be reused', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `T(${m}) ${s}`);
    try {
      const src = { k0: 'Hello number zero friend', k1: 'Hello number one friend', k2: 'Hello number two friend' };
      const d = nextApp({ model: 'm0' }, src);
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'messages/en.json'), { ...src, k3: 'Hello number three friend', k4: 'Hello number four friend' });
      // One run under m1: the new keys, and k0 again (so two models hold k0).
      assert.equal((await runCli(['sync', '--model', 'm1'], d, env)).code, 0);
      assert.equal((await runCli(['sync', '--model', 'm1', '--redo', 'keys:k0', '--fresh-on-model-change'], d, env)).code, 0);
      writeJSON(path.join(d, 'champollion.config.json'), { ...readJSON(path.join(d, 'champollion.config.json')), model: 'm2' });
      const r = await runCli(['sync', '--dry', '--fresh-on-model-change'], d, env);
      assert.equal(r.code, 0, r.out);
      // Round 12: counted in translations (one per string per language), and
      // what they are made of said plainly.
      const head = /Model changed: --fresh-on-model-change set, so (\d+) translations only an earlier model wrote \(5 strings × 2 languages\) will NOT be reused/.exec(r.out);
      assert.ok(head, r.out);
      const lines = [...r.out.matchAll(/ {2}(fr|de): now m2; (\d+) from (.+)/g)];
      assert.equal(lines.length, 2);
      let sum = 0;
      for (const [, , n, from] of lines) {
        const parts = [...from.matchAll(/(\S+) \((\d+)\)/g)].map(p => Number(p[2]));
        assert.equal(parts.reduce((a, b) => a + b, 0), Number(n), 'a locale\'s count is the sum of its models');
        assert.match(from, /^m1 \(3\), m0 \(2\)/, 'k0 counted once, under m1 (the newest translation of it)');
        sum += Number(n);
      }
      assert.equal(Number(head[1]), sum, 'the total is the sum of the locales');
      assert.equal(sum, 10);
    } finally {
      await model.close();
    }
  });
});

// ── 2 + 4. A dry run with --max-cost: said once; exit codes documented ──────
describe('Round 11 — Next.js: a dry run says the cap once, and its exit codes are written down', () => {
  const src = {};
  for (let i = 0; i < 30; i++) src[`k${i}`] = `Add item number ${i} to your shopping cart before checkout`;
  const gt = { ...BASE, GOOGLE_TRANSLATE_API_KEY: 'fake-key' };

  it('2: over the cap, the warning is printed once — with and without --quiet — and the JSON summary is still the last stdout line', async () => {
    const d = nextApp({ defaultMethod: 'google-translate', model: undefined }, src);
    for (const flags of [[], ['--quiet']]) {
      const r = await runCli(['sync', '--dry', '--max-cost', '0.001', ...flags], d, gt);
      assert.equal(r.code, 0, r.out);
      assert.equal(count(r.out, 'A real run would stop at the --max-cost cap before any API call and exit 2'), 1, `${flags.join(' ')}: ${r.out}`);
    }
    const under = await runCli(['sync', '--dry', '--max-cost', '5'], d, gt);
    assert.equal(count(under.out, '--max-cost: the estimate is within the cap'), 1);
    const j = await runCli(['sync', '--dry', '--max-cost', '5', '--json'], d, gt);
    const lines = j.stdout.trim().split('\n').map(l => JSON.parse(l));
    assert.equal(lines.at(-1).level, 'summary', 'nothing printed after the summary');
    assert.ok(lines.some(l => /--max-cost: the estimate is within the cap/.test(l.message || '')));
  });

  it('2: when the preflight would stop first, its --max-cost line is printed once too', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: undefined });
    const r = await runCli(['sync', '--dry', '--max-cost', '5'], d, { ...BASE, CHAMPOLLION_PRICING_OFFLINE: '1' });
    assert.equal(r.code, 0, r.out);
    assert.equal(count(r.out, 'but the run would stop earlier'), 1, r.out);
  });

  it('4: the CLI reference has a sync exit-code table for real and dry runs, and says why a dry run keeps 0', () => {
    const cli = doc('reference/cli.md');
    const sec = cli.slice(cli.indexOf('### Exit codes {#sync-exit-codes}'), cli.indexOf('## watch'));
    assert.match(sec, /\| Code \| A real run \| A dry run \(`--dry`\) \|/);
    assert.match(sec, /\| `2` \| Partial: .* \| Never\. \|/);
    assert.match(sec, /\| `1` \| Nothing succeeded, or the run could not start: .* \| The dry run itself could not run: .* \|/);
    assert.match(flat(sec), /A dry run exits `0` on purpose/);
    assert.match(flat(sec), /`preflight\.ready: false` means the real run would stop before translating and exit `1`/);
    assert.match(flat(sec), /`maxCost\.exitCode: 1`, with `maxCost\.stopsEarlier`/);
    // The CI guide's gate still reads the summary; it never relied on a dry-run exit code.
    assert.match(doc('guides/ci-cd.md'), /jq -e 'select\(\.level == "summary"\) \| \.preflight\.ready and \(\.maxCost\.wouldStop \| not\)'/);
  });

  it('4: what the table says — a dry run with a missing key exits 0 (preflight.ready false); one naming a key that does not exist exits 1', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: undefined });
    const env = { ...BASE, CHAMPOLLION_PRICING_OFFLINE: '1' };
    const missing = await runCli(['sync', '--dry', '--json'], d, env);
    assert.equal(missing.code, 0);
    assert.equal(summaryOf(missing.stdout).preflight.ready, false);
    const typo = await runCli(['sync', '--dry', '--redo', 'keys:nope'], d, { ...env, OPENROUTER_API_KEY: 'sk-or-placeholder' });
    assert.equal(typo.code, 1, typo.out);
  });
});

// ── 3. An unknown model slug is named, and told apart from an unpriced one ──
describe('Round 11 — Next.js: a model with no price is named, and why', () => {
  const LIST = [
    { id: 'google/gemini-3.5-flash', pricing: { prompt: '0.0000003', completion: '0.0000025' } },
    { id: 'google/gemini-2.5-flash', pricing: { prompt: '0.0000003', completion: '0.0000025' } },
    { id: 'openrouter/auto', pricing: { prompt: '-1', completion: '-1' } },
    { id: 'anthropic/claude-x', pricing: { prompt: '0.000003', completion: '0.000015' } },
  ];
  const env = (models) => ({ ...BASE, OPENROUTER_API_KEY: 'sk-or-placeholder', ...priceList(models) });
  const llm = (model) => nextApp({ defaultMethod: 'llm', model });

  it('3: a slug the list does not have: named, "likely a typo", with the closest listed slugs — never blamed on the method', async () => {
    const d = llm('google/gemini-3.5-flsh');
    const r = await runCli(['sync', '--dry'], d, env(LIST));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Total: unknown — no price for model google\/gemini-3\.5-flsh \(en:de, en:fr\)/);
    assert.match(r.out, /en:de, en:fr: "google\/gemini-3\.5-flsh" is not in OpenRouter's model list — likely a typo in the model name\. Closest listed: google\/gemini-3\.5-flash, google\/gemini-2\.5-flash\./);
    assert.doesNotMatch(r.out, /no method in this run has published pricing/);
    const s = summaryOf((await runCli(['sync', '--dry', '--json'], d, env(LIST))).stdout);
    assert.equal(s.costEstimate.totalEstimatedCost, null);
    assert.match(s.costEstimate.unknownCost.reason, /en:de \(llm, openrouter-not-listed\)/);
    assert.deepEqual(s.costEstimate.unknownCost.notes.map(n => n.subject), ['model google/gemini-3.5-flsh']);
    assert.equal(s.costEstimate.pairs[0].model, 'google/gemini-3.5-flsh');
  });

  it('3: a listed model with no per-token price is said as such; the --max-cost stop names it', async () => {
    const d = llm('openrouter/auto');
    const r = await runCli(['sync', '--dry', '--max-cost', '1'], d, env(LIST));
    assert.match(r.out, /"openrouter\/auto" is in OpenRouter's model list but has no published per-token price, so its cost cannot be estimated\./);
    assert.match(r.out, /A real run would stop at the --max-cost cap before any API call and exit 2: Some pairs have unknown pricing — no price for model openrouter\/auto \(en:de, en:fr\)/);
    assert.doesNotMatch(r.out, /~\$-/, 'a "-1" price is never a negative estimate');
  });

  it('3: no price list at all (HTTP 503, or CHAMPOLLION_PRICING_OFFLINE): says the list could not be read — not a typo', async () => {
    const d = llm('google/gemini-3.5-flash');
    const down = await runCli(['sync', '--dry'], d, env('503'));
    assert.match(down.out, /OpenRouter's price list could not be read \(OpenRouter answered HTTP 503\), so the price of "google\/gemini-3\.5-flash" is unknown\./);
    const off = await runCli(['sync', '--dry'], d, { ...BASE, OPENROUTER_API_KEY: 'sk-or-placeholder', CHAMPOLLION_PRICING_OFFLINE: '1' });
    assert.match(off.out, /could not be read \(the live price draw is off: CHAMPOLLION_PRICING_OFFLINE=1\)/);
    const priced = await runCli(['sync', '--dry'], d, env(LIST));
    assert.match(priced.out, /Total: ~\$0\.\d{4}\n/);
  });

  it('3: a method with no published price is still named as the method (a self-hosted endpoint elsewhere)', async () => {
    const d = nextApp();
    const r = await runCli(['sync', '--dry'], d, { ...BASE, LOCAL_API_BASE: 'http://10.255.0.1:9/v1' });
    assert.match(r.out, /Total: unknown — no price for the local method \(en:de, en:fr\)/);
  });
});

// ── 6 + 7 + 9. The i18next persona: init says what CI needs; the cache; the gate
describe('Round 11 — i18next: init names CI for a local model; the CI cache saves only what changed; the jq gate says what it checks', () => {
  it('6: init --method local adds one next step on what CI needs, with the CI guide; the hosted default does not', async () => {
    const d = tmp('i18n');
    writeJSON(path.join(d, 'public/locales/en/common.json'), { title: 'My cookbook' });
    const r = await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'llama3.1'], d, BASE);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\n {2}\d\. In CI: a runner has no model server — run a hosted method there \(sync --method llm --model \S+, its key as a repository secret\) or use a runner that can reach a model server \(LOCAL_API_BASE\): https:\/\/champollion\.dev\/docs\/guides\/ci-cd\n/);
    const h = tmp('i18n-hosted');
    writeJSON(path.join(h, 'public/locales/en/common.json'), { title: 'My cookbook' });
    const hosted = await runCli(['init', '--yes', '--langs', 'fr'], h, BASE);
    assert.equal(hosted.code, 0, hosted.out);
    assert.doesNotMatch(hosted.out, /In CI: a runner has no model server/);
  });

  const guide = doc('guides/ci-cd.md');
  const workflows = guide.split('```yaml').slice(1).map(b => b.slice(0, b.indexOf('```'))).filter(w => /actions\/cache\/save@v4/.test(w));

  it('7: every workflow restores the newest cache and saves under a hash of the cache itself — a run that added nothing skips the save', () => {
    assert.ok(workflows.length >= 2);
    assert.doesNotMatch(guide, /run_id/, 'no cache key on the run id');
    for (const w of workflows) {
      assert.match(w, /- name: Restore the translation cache\n\s+id: cache\n\s+uses: actions\/cache\/restore@v4\n\s+with:\n\s+path: \.champollion\n\s+key: champollion-tm-\$\{\{ github\.ref_name \}\}-newest\n\s+restore-keys: champollion-tm-\$\{\{ github\.ref_name \}\}-\n/);
      const save = /- name: Save the translation cache\n\s+if: (.+)\n\s+uses: actions\/cache\/save@v4\n\s+with:\n\s+path: \.champollion\n\s+key: (.+)\n/.exec(w);
      assert.ok(save, w);
      const [, cond, key] = save;
      assert.equal(key, "champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}");
      // Saved even when a step failed; skipped with no folder; skipped when
      // the key is the one restored (the same expression as the key).
      assert.ok(cond.startsWith("always() && hashFiles('.champollion/**') != ''"), cond);
      assert.ok(cond.endsWith("&& steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))"), cond);
      // Restored before the sync, saved after it and before the commit.
      assert.ok(w.indexOf('Restore the translation cache') < w.indexOf('id: sync'));
      assert.ok(w.indexOf('id: sync') < w.indexOf('Save the translation cache'));
      assert.ok(w.indexOf('Save the translation cache') < w.indexOf('Commit updated'));
    }
    assert.match(flat(guide), /\*\*One cache copy per change, not per run\.\*\*/);
    assert.match(flat(guide), /keying on the lock and source files would restore an older copy by exact match after a run whose push was rejected/);
  });

  it('9: the guide says the dry run checks the key is set, not that it works — and a placeholder does pass it', async () => {
    const f = flat(guide);
    assert.match(f, /It checks that the variable is \*\*set\*\*, not that the key \*\*works\*\*: it sends nothing, so any non-empty value passes — a placeholder too\./);
    assert.match(f, /`preflight\.ready` is `false` when a key the method needs is missing \(unset or empty — not when it is wrong\)/);
    assert.doesNotMatch(f, /To check the secret is wired without translating anything/);
    const d = nextApp({ defaultMethod: 'llm', model: undefined });
    const s = summaryOf((await runCli(['sync', '--dry', '--json'], d, { ...BASE, CHAMPOLLION_PRICING_OFFLINE: '1', OPENROUTER_API_KEY: 'placeholder' })).stdout);
    assert.equal(s.preflight.ready, true, 'set is all it checks');
  });
});

// ── 8 + 10 + 11. Django: header-only commits, a redo with the server down, the French defaults
describe('Round 11 — Django: no header-only commits; a cached redo needs no server; the French defaults are on the page', () => {
  const guide = doc('guides/ci-cd.md');
  const django = guide.slice(guide.indexOf('```yaml title=".github/workflows/i18n-sync.yml (Django)"'), guide.indexOf('`--all` updates every catalog'));

  it('8: the Django workflow commits only when something beyond POT-Creation-Date changed — and git really reads it that way', () => {
    const step = django.slice(django.indexOf('- name: Commit updated catalogs'), django.indexOf('- name: Stop when the sync was partial'));
    const guard = /if git diff --staged --quiet -I '([^']+)'; then\n\s+echo "Nothing to commit: only the catalogs' POT-Creation-Date changed\."\n\s+else\n\s+git commit -m "chore: sync translations"\n\s+git pull --rebase origin "\$GITHUB_REF_NAME"\n\s+git push origin "HEAD:\$GITHUB_REF_NAME"\n\s+fi/.exec(step);
    assert.ok(guard, step);
    assert.match(step, /# makemessages \(msgmerge\) writes a new POT-Creation-Date into every\n\s+# catalog on each run: commit only when something else changed\n\s+# \(git diff -I needs git 2\.30 or newer; GitHub's runners have it\)\./);
    // The regex, as the doc writes it, against a real repository.
    const repo = tmp('git');
    const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
    const po = (date, msgstr) => `msgid ""\nmsgstr ""\n"POT-Creation-Date: ${date}\\n"\n\nmsgid "Welcome"\nmsgstr "${msgstr}"\n`;
    write(path.join(repo, 'django.po'), po('2026-10-01 10:00+0000', 'Bienvenue'));
    git('add', '.'); git('commit', '-qm', 'init');
    write(path.join(repo, 'django.po'), po('2026-10-04 11:00+0000', 'Bienvenue'));
    git('add', 'django.po');
    assert.equal(git('diff', '--staged', '--quiet', '-I', guard[1]).status, 0, 'a header-only change: nothing to commit');
    write(path.join(repo, 'django.po'), po('2026-10-04 11:00+0000', 'Bon retour'));
    git('add', 'django.po');
    assert.equal(git('diff', '--staged', '--quiet', '-I', guard[1]).status, 1, 'a translation changed: commit');
  });

  it('10: with `local` and the server down (off CI), a run that sends nothing goes on with a warning; one that sends something stops; CI still stops', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    const d = nextApp();
    try {
      assert.equal((await runCli(['sync'], d, { ...BASE, LOCAL_API_BASE: model.url })).code, 0);
    } finally {
      await model.close();
    }
    const dead = { ...BASE, LOCAL_API_BASE: 'http://127.0.0.1:9/v1' };
    const redo = await runCli(['sync', '--redo', 'all'], d, dead);
    assert.equal(redo.code, 0, redo.out);
    assert.match(redo.stderr, /en:de, en:fr \(method: local\): no server answers at http:\/\/127\.0\.0\.1:9\/v1 \(from LOCAL_API_BASE\) — this run does not need it: every key queued for them comes from the cache \(6\), so it goes on\. Start the server before a run that translates\./);
    assert.match(redo.out, /0 key\(s\) sent to the model, 6 served from the cache/);
    const plain = await runCli(['sync'], d, dead);
    assert.equal(plain.code, 0, plain.out);
    assert.match(plain.stderr, /this run does not need it: nothing is queued/);
    const dry = await runCli(['sync', '--dry', '--redo', 'all', '--json'], d, dead);
    assert.equal(summaryOf(dry.stdout).preflight.ready, true);
    // A source change needs the model: stopped before anything is sent.
    writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes now', open: 'Open the settings page', close: 'Close the window now' });
    const needs = await runCli(['sync'], d, dead);
    assert.equal(needs.code, 1, needs.out);
    assert.match(needs.stderr, /cannot start translating — the local method is not ready for en:de, en:fr: the config uses the "local" method, and no model server answers at/);
    const dryNeeds = await runCli(['sync', '--dry', '--json'], d, dead);
    assert.equal(dryNeeds.code, 0);
    assert.equal(summaryOf(dryNeeds.stdout).preflight.ready, false);
    // On a CI runner the Round 8 rule stands: stopped even with nothing to send.
    writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page', close: 'Close the window now' });
    const ci = await runCli(['sync', '--redo', 'all'], d, { ...dead, CI: 'true' });
    assert.equal(ci.code, 1, ci.out);
    assert.match(ci.stderr, /A CI runner has no model server/);
  });

  it('10: the frameworks redo paragraph and the local method page say a cached redo needs no server', () => {
    assert.match(flat(doc('integrations/frameworks.md')), /Such a redo needs no model: with `local` and the model server stopped, sync warns that the server does not answer and that this run does not need it, and goes on/);
    const methods = flat(doc('guides/translation-methods.md'));
    assert.match(methods, /A run that sends it nothing — nothing is queued, or every queued key comes from the cache, as in a redo of text already translated — warns that the server is down and goes on\./);
    assert.match(methods, /On a CI runner \(`CI` or `GITHUB_ACTIONS` set\) a server that does not answer stops every run, even one with nothing queued/);
  });

  it('11: the Django section names the French default tone and gender style, and the fields that change them — quoted from the catalogue as it is', () => {
    const page = doc('integrations/frameworks.md');
    const sec = flat(page.slice(page.indexOf('## Django and gettext (.po)'), page.indexOf('**Which method translates, and which key it needs.**')));
    const quoted = /`formal-vous` asks the model for "([^"]+)"/.exec(sec);
    assert.ok(quoted, sec);
    assert.ok(getRegister('fr', 'formal-vous').startsWith(quoted[1]), 'the quote is the preset\'s own text');
    assert.match(getGenderGuidance('fr'), /écriture inclusive with the interpunct\/middle dot \(e\.g\., "Connecté·e"/);
    assert.match(sec, /French's gender guidance asks for \*écriture inclusive\* with the middle dot when the reader's gender is unknown \(`Connecté·e`, `Utilisateur·rice·s`\)/);
    assert.match(getGenderGuidance('ru'), /masculine is the conventional default/);
    assert.match(sec, /Russian's \(`formal-vy`\) uses the masculine, the conventional default/);
    assert.match(sec, /the register in `languages` \(`"fr": "casual-tu"`, or your own words\), and `genderGuidance` — `false` for no instruction, or your own/);
    assert.match(sec, /\[Gender guidance\]\(\/docs\/getting-started\/configuration#gender-guidance\)/);
  });
});

// ── 12. The school: when the fallback wrote most of it, say so ──────────────
describe('Round 11 — Cree school: a run the fallback mostly wrote says so, with why; status shows the share', () => {
  /** The school's setup, rebuilt: an app, a newsletter, a served model as `api`, a local fallback. */
  async function schoolProject() {
    const d = tmp('school');
    writeJSON(path.join(d, 'app/messages/en.json'), {
      Home: { title: 'Welcome, families' },
      Forms: { submit: 'Send the form' },
      Nav: { home: 'Home', calendar: 'Calendar', contact: 'Contact the school' },
    });
    write(path.join(d, 'newsletter/2026-10.md'), '---\ntitle: October newsletter\ndescription: News from our school\n---\n\n# October at our school\n\n'
      + 'The students read the stories at the library.\n\nThe elders visit the class tomorrow. Please bring the forms.\n\n## Feast\n\nOur teacher shares the songs at the feast.\n');
    // A small trained model that repeats a memorized sentence for most inputs.
    const api = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => {
        const body = JSON.parse(b || '{}');
        const out = {};
        for (const [k, v] of Object.entries(body.keys || {})) {
          out[k] = k === 'Forms.submit' || k === 'segment.0' ? `nitawi ${v.length}` : 'kiskinwahamâkosiwak ê-kî-âcimocik ôma kâ-kîsikâk';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translations: out }));
      });
    });
    await new Promise(r => api.listen(0, '127.0.0.1', r));
    writeJSON(path.join(d, 'champollion.config.json'), {
      version: 3, inputLocale: 'en', localesDir: './app/messages', languages: { crk: { script: 'Latn' } },
      defaultMethod: 'api', contentDir: 'newsletter',
      pairs: { 'en:crk': { method: 'api', endpoint: `http://127.0.0.1:${api.address().port}/translate`, acceptsInstructions: false, fallback: { method: 'local', model: 'stub-1' } } },
    });
    return { d, api };
  }

  it('12: sync warns once per lane with X of Y, the fallback\'s method and model, the counted reasons and what to consider', async () => {
    const model = await startFakeModel((k, s) => `crk ${s.length} ${k}`);
    const { d, api } = await schoolProject();
    try {
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      const r = await runCli(['sync'], d, env);
      const keys = /\[FALLBACK\] en:crk — most of this run's translations came from the fallback: (\d+) of (\d+) key\(s\) were written by local, model stub-1, not by the pair's method \(api\)\. Why api's answers were not used, for the (\d+) key\(s\) sent to the fallback: ([^.]+)\. What ships is the fallback's work\. Consider: api may not suit these strings; check what was written \(`champollion verify` checks structure — a speaker checks meaning\); or a stronger fallback/.exec(r.out);
      assert.ok(keys, r.out);
      assert.equal(`${keys[1]} of ${keys[2]}`, '4 of 5');
      const reasons = [...keys[4].matchAll(/([^;(]+) \((\d+)\)/g)];
      assert.equal(reasons.reduce((n, m) => n + Number(m[2]), 0), Number(keys[3]), 'the reasons count every key sent to the fallback');
      assert.ok(reasons.some(m => m[1].trim() === 'a memorized sentence repeated for different source strings'), keys[4]);
      const content = /most of this run's translations came from the fallback: (\d+) of (\d+) content segment\(s\) were written by local, model stub-1/.exec(r.out);
      assert.ok(content, r.out);
      assert.ok(Number(content[1]) / Number(content[2]) > FALLBACK_MAJORITY_SHARE);
      assert.equal(count(r.out, 'most of this run\'s translations came from the fallback'), 2, 'one per lane');

      const st = await runCli(['status'], d, env);
      assert.match(st.out, /from the fallback: 4 value\(s\) in the files \(.*\) — 4 of the 5 sync wrote \(80%\): most of this locale's text is the fallback's \(local\), not api's/);
      const sj = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      const pair = sj.pairs.find(p => p.pair === 'en:crk');
      assert.equal(pair.fallback.valuesWritten, 5);
      assert.equal(pair.fallback.valuesInFiles, 4);
      assert.equal(pair.fallback.share, 0.8);

      // A re-run that translates nothing fresh says nothing (status carries the share).
      const again = await runCli(['sync'], d, env);
      assert.doesNotMatch(again.out, /most of this run's translations came from the fallback/);
      // The JSON carries the counts beside `accepted`.
      const j = summaryOf((await runCli(['sync', '--redo', 'all', '--fresh', '--json'], d, env)).stdout);
      const fb = j.locales.find(l => l.fallback)?.fallback;
      assert.ok(fb && typeof fb.primaryAccepted === 'number' && fb.primaryReasons, JSON.stringify(j.locales));
    } finally {
      await model.close();
      api.close();
    }
  });

  it('12: a fallback that wrote half or less says nothing extra; the categories count, not quote', () => {
    assert.equal(FALLBACK_MAJORITY_SHARE, 0.5);
    assert.equal(refusalCategory('length inflation (3.2x source, max 2.5x)'), 'length inflation');
    assert.equal(refusalCategory('same output for 3 different source strings ("a", "b", "c") — a model repeating one memorized sentence, not a translation of this string'), 'a memorized sentence repeated for different source strings');
    assert.equal(refusalCategory(null, { heldBefore: true }), 'refused on an earlier sync, so not asked again');
    assert.equal(refusalCategory(null), 'no answer');
    assert.equal(refusalCategory('2 protected element(s) (code, link, markup) missing'), 'code, links or markup damaged or missing');
  });

  it('12: the configuration page says when the warning fires and what status shows', () => {
    const f = flat(doc('getting-started/configuration.md'));
    assert.match(f, /\*\*When the fallback wrote most of it\.\*\* When more than half of a run's fresh translations for a pair/);
    assert.match(f, /"from the fallback: 8 value\(s\) in the files \(…\) — 8 of the 8 sync wrote \(100%\)"/);
  });
});

// ── 15. The hospital: a Flutter locale Flutter's own widgets do not cover ───
describe('Round 11 — hospital (Flutter ARB): a locale outside Flutter\'s own list is named, with what to add', () => {
  function flutterApp() {
    const d = tmp('flutter');
    write(path.join(d, 'pubspec.yaml'), 'name: clinic\nflutter:\n  generate: true\n');
    writeJSON(path.join(d, 'lib/l10n/app_en.arb'), { '@@locale': 'en', greeting: 'Good morning', pain: 'Where does it hurt?' });
    return d;
  }
  /** A Flutter SDK's flutter_localizations, as far as the check reads it. */
  function fakeSdk(locales) {
    const root = tmp('flutter-sdk');
    for (const l of locales) writeJSON(path.join(root, 'packages/flutter_localizations/lib/src/l10n', `material_${l}.arb`), { '@@locale': l });
    return root;
  }
  const noSdk = { ...BASE, FLUTTER_ROOT: '', PATH: path.dirname(process.execPath) };

  it('15: init with no Flutter SDK here: qaa (private use) is uncovered, fr is "not checked" — never a guess', async () => {
    const d = flutterApp();
    const r = await runCli(['init', '--yes', '--langs', 'qaa,fr', '--method', 'local', '--model', 'x'], d, noSdk);
    assert.equal(r.code, 0, r.out);
    assert.match(r.stderr, /Flutter: its own Material\/Cupertino widget text \(GlobalMaterialLocalizations\) does not cover qaa \(a private-use code is in no list\)\. An app with this locale in supportedLocales fails at runtime without a fallback delegate for it — add one: https:\/\/champollion\.dev\/docs\/integrations\/frameworks#flutter-locales-outside-flutters-own-list/);
    assert.match(r.stdout, /Flutter: no Flutter SDK found here \(FLUTTER_ROOT, or flutter on PATH\), so fr was not checked/);
  });

  it('15: with the SDK, the list is Flutter\'s own: fr and pt_BR covered, ayt not', async () => {
    const sdk = fakeSdk(['en', 'fr', 'pt', 'pt_BR', 'zh_Hant_HK']);
    const d = flutterApp();
    const r = await runCli(['init', '--yes', '--langs', 'fr,pt_BR,ayt', '--method', 'local', '--model', 'x'], d, { ...noSdk, FLUTTER_ROOT: sdk });
    assert.equal(r.code, 0, r.out);
    assert.match(r.stderr, new RegExp(`does not cover ayt \\(checked against ${sdk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/packages/flutter_localizations/lib/src/l10n\\)`));
    assert.doesNotMatch(r.out, /not cover [^(]*\bfr\b|not cover [^(]*pt_BR/);
    assert.doesNotMatch(r.out, /no Flutter SDK found/);
    assert.deepEqual(flutterUncoveredLocales(['zh_Hant_HK', 'ayt', 'qaa'], { FLUTTER_ROOT: sdk, PATH: '' }).uncovered, ['ayt', 'qaa']);
  });

  it('15: a sync that creates a new ARB locale says the same; the docs show the delegate', async () => {
    const model = await startFakeModel((k, s) => `QAA ${s}`);
    try {
      const d = flutterApp();
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesPattern: 'lib/l10n/app_{lang}.arb', defaultMethod: 'local', model: 'm1', languages: ['qaa'],
      });
      const r = await runCli(['sync'], d, { ...noSdk, LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.ok(fs.existsSync(path.join(d, 'lib/l10n/app_qaa.arb')));
      assert.match(r.stderr, /does not cover qaa \(a private-use code is in no list\)/);
      const again = await runCli(['sync'], d, { ...noSdk, LOCAL_API_BASE: model.url });
      assert.doesNotMatch(again.out, /does not cover qaa/, 'said when the file is created, not on every run');
    } finally {
      await model.close();
    }
    const page = doc('integrations/frameworks.md');
    const sec = page.slice(page.indexOf("### Locales outside Flutter's own list {#flutter-locales-outside-flutters-own-list}"), page.indexOf('## Django and gettext (.po)'));
    assert.match(sec, /class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T>/);
    assert.match(sec, /FallbackLocalizationsDelegate<MaterialLocalizations>\(GlobalMaterialLocalizations\.delegate, \{'qaa'\}\)/);
    assert.match(sec, /FallbackLocalizationsDelegate<CupertinoLocalizations>\(GlobalCupertinoLocalizations\.delegate, \{'qaa'\}\)/);
    assert.match(sec, /https:\/\/docs\.flutter\.dev\/ui\/accessibility-and-internationalization\/internationalization#adding-support-for-a-new-language/);
  });
});

// ── 17. doctor checks the OpenRouter key where OpenRouter can reject it ─────
describe('Round 11 — doctor: the OpenRouter key check asks the endpoint that rejects a bad key', () => {
  /** A local stand-in for openrouter.ai: GET /api/v1/key answers per key. */
  async function keyServer({ status = null } = {}) {
    const seen = [];
    const server = http.createServer((req, res) => {
      seen.push({ method: req.method, path: req.url, auth: req.headers.authorization || null });
      req.resume();
      if (req.url !== '/api/v1/key') { res.writeHead(404); res.end(); return; }
      const ok = req.headers.authorization === 'Bearer sk-or-good';
      const code = status ?? (ok ? 200 : 401);
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(code === 200
        ? { data: { label: 'sk-or-…', usage: 1.25, limit: 10, limit_remaining: 8.75, is_free_tier: false } }
        : { error: { code, message: 'No auth credentials found' } }));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    return { seen, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
  }
  const doctor = async (key, base) => {
    const r = await runCli(['doctor', 'methods', '--json'], tmp('doctor'), {
      ...BASE, OPENROUTER_API_KEY: key, NODE_OPTIONS: `--import=${STUB_FETCH}`, STUB_OPENROUTER_BASE: base,
    });
    return { ...r, json: JSON.parse(r.stdout), line: (label) => JSON.parse(r.stdout).results.find(x => x.label === label) };
  };

  it('17: a key OpenRouter rejects (401/403) fails the check, says so, and never prints the key; the model list is not asked', async () => {
    const or = await keyServer();
    try {
      const bad = await doctor('placeholder-not-a-key', or.base);
      assert.equal(bad.code, 1, bad.out);
      assert.deepEqual(bad.line('OpenRouter API key'), { status: 'pass', label: 'OpenRouter API key', detail: 'Set via environment' });
      const check = bad.line('OpenRouter key check');
      assert.equal(check.status, 'fail');
      assert.match(check.detail, /^rejected by OpenRouter \(HTTP 401\): the key is invalid, disabled or revoked\. Check the value of OPENROUTER_API_KEY \(set via environment\)/);
      assert.doesNotMatch(bad.out, /placeholder-not-a-key/);
      assert.deepEqual(or.seen, [{ method: 'GET', path: '/api/v1/key', auth: 'Bearer placeholder-not-a-key' }], 'one call, to the key endpoint');
      assert.doesNotMatch(bad.out, /Connected — \d+ models available|key may be invalid/);
    } finally {
      await or.close();
    }
    const forbidden = await keyServer({ status: 403 });
    try {
      assert.equal((await doctor('sk-or-good', forbidden.base)).line('OpenRouter key check').status, 'fail');
    } finally {
      await forbidden.close();
    }
  });

  it('17: an accepted key passes with its credits; another answer, or none, is "not checked" (a warning, not a pass)', async () => {
    const or = await keyServer();
    try {
      const good = await doctor('sk-or-good', or.base);
      assert.equal(good.code, 0, good.out);
      assert.deepEqual(good.line('OpenRouter key check'), {
        status: 'pass', label: 'OpenRouter key check',
        detail: 'accepted by OpenRouter (GET /api/v1/key — no charge); 1.25 credits used, 8.75 of 10 left',
      });
    } finally {
      await or.close();
    }
    const down = await keyServer({ status: 503 });
    try {
      const r = await doctor('sk-or-good', down.base);
      assert.equal(r.code, 0);
      assert.deepEqual(r.line('OpenRouter key check'), { status: 'warn', label: 'OpenRouter key check', detail: 'not checked — OpenRouter answered HTTP 503' });
    } finally {
      await down.close();
    }
    const gone = await keyServer();
    await gone.close();
    const unreachable = await doctor('sk-or-good', gone.base);
    assert.equal(unreachable.line('OpenRouter key check').status, 'warn');
    assert.match(unreachable.line('OpenRouter key check').detail, /^not checked — could not reach OpenRouter/);
  });
});
