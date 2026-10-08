/**
 * Round 5 synthetic developers — Next.js (next-intl, fr + de, a store's
 * codebase), i18next (react-i18next, fr + es, the CI guide end to end),
 * Django (gettext, fr + ru), the hospital (Flutter ARB, a forge model behind
 * the `api` method) and the school (Next.js + a Markdown newsletter) — end to
 * end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs) and, for the `api` method, a tiny
 * champollion-API server. No network, no key.
 */
import { DEFAULT_OPENROUTER_MODEL } from '../lib/config.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { loadTM, storeTM, saveTM, tmMethodKey } from '../lib/tm.js';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r5-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
const README = read(new URL('../README.md', import.meta.url));
const keysSent = (model, from = 0) => model.calls.slice(from).flatMap(c => c.keys);

/** A next-intl project: messages/{en,…}.json. */
function nextProject({ src, languages = ['fr'], method = 'local', model = 'stub-1', extra = {} }) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), src);
  const cfg = (patch = {}) => writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', languages, defaultMethod: method, model, ...extra, ...patch,
  });
  cfg();
  return { d, cfg };
}

/** The last stdout line of a --json run, parsed (the summary). */
function summaryOf(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  return { last: lines[lines.length - 1], lines };
}

// ── 1. The license, where a new user decides ────────────────────────────────
describe('Round 5 — the license is said on the setup path', () => {
  it('README top, installation and Quick Start say it plainly, with a link; no commercial offer', () => {
    const top = README.slice(0, README.indexOf('## Why Not Just Script It Yourself?'));
    assert.match(top, /\*\*License:\*\* source-available under the \[PolyForm Noncommercial License 1\.0\.0\]\(LICENSE\) — free to use, change and share for noncommercial purposes/);
    assert.match(top, /Using it for a commercial purpose is not covered by this license\./);
    for (const page of [doc('getting-started/installation.mdx'), doc('getting-started/quick-start.md')]) {
      assert.match(page, /\[PolyForm Noncommercial License 1\.0\.0\]\(https:\/\/github\.com\/gamedaysuits\/Champollion\/blob\/main\/cli\/LICENSE\)/);
      assert.match(page, /commercial (use|purpose) is not\s+covered/i);
      assert.doesNotMatch(page, /talk to us|contact us|commercial licen[cs]e (is )?available|buy/i);
    }
    // The package says what the pages say.
    assert.equal(readJSON(new URL('../package.json', import.meta.url)).license, 'PolyForm-Noncommercial-1.0.0');
  });

  it('init says it once, on a fresh project — not on a --force rerun', async () => {
    const d = tmp('lic');
    writeJSON(path.join(d, 'messages/en.json'), { a: 'Hello there' });
    const first = await runCli(['init', '--yes', '--langs', 'fr'], d);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /License: PolyForm Noncommercial 1\.0\.0 — free for noncommercial use; using it for a commercial purpose is not covered by this license\./);
    // The one plain-language page on who is covered, and the text that governs.
    assert.match(first.out, /Who may use it \(a school, a public hospital or clinic, a charity, a personal project — not a business's product\): https:\/\/champollion\.dev\/docs\/getting-started\/who-may-use-this/);
    assert.match(first.out, /The license text governs: https:\/\/github\.com\/gamedaysuits\/Champollion\/blob\/main\/cli\/LICENSE/);
    const again = await runCli(['init', '--yes', '--force', '--langs', 'fr'], d);
    assert.equal(again.code, 0, again.out);
    assert.doesNotMatch(again.out, /License:/);
  });
});

// ── 2. A dry run says what the cap would do ─────────────────────────────────
describe('Round 5 — sync --dry --max-cost says the real run would stop', () => {
  const src = {};
  for (let i = 0; i < 30; i++) src[`k${i}`] = `Add item number ${i} to your shopping cart before checkout`;
  const env = { GOOGLE_TRANSLATE_API_KEY: 'fake-key', CHAMPOLLION_OFFLINE: '1' };

  it('over the cap: warned (with the exit code it would use), --json carries maxCost.wouldStop; the dry run exits 0', async () => {
    const { d } = nextProject({ src, method: 'google-translate', model: undefined });
    const r = await runCli(['sync', '--dry', '--max-cost', '0.001'], d, env);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /A real run would stop at the --max-cost cap before any API call and exit 2: Estimated translation cost exceeds the --max-cost cap\. Estimated cost: ~\$0\.\d{4}, --max-cost cap: \$0\.0010\./);
    const j = await runCli(['sync', '--dry', '--max-cost', '0.001', '--json'], d, env);
    const { last } = summaryOf(j.stdout);
    assert.equal(last.level, 'summary');
    assert.equal(last.maxCost.cap, 0.001);
    assert.equal(last.maxCost.wouldStop, true);
    assert.equal(last.maxCost.exitCode, 2);
    assert.ok(last.maxCost.estimatedCost > 0.001);
    // The real run does stop, exit 2, nothing written.
    const real = await runCli(['sync', '--max-cost', '0.001'], d, env);
    assert.equal(real.code, 2, real.out);
    assert.ok(!fs.existsSync(path.join(d, 'messages/fr.json')) || Object.keys(readJSON(path.join(d, 'messages/fr.json'))).length === 0);
  });

  it('under the cap: says it would go ahead; wouldStop false', async () => {
    const { d } = nextProject({ src, method: 'google-translate', model: undefined });
    const r = await runCli(['sync', '--dry', '--max-cost', '5'], d, env);
    assert.match(r.out, /--max-cost: the estimate is within the cap — a real run would go ahead\./);
    const { last } = summaryOf((await runCli(['sync', '--dry', '--max-cost', '5', '--json'], d, env)).stdout);
    assert.equal(last.maxCost.wouldStop, false);
    assert.equal(last.maxCost.exitCode, undefined);
  });
});

// ── 3 + 5. Cache notices after a method or model switch ─────────────────────
describe('Round 5 — what a switch means for the cache, said only when it applies', () => {
  const src = { k0: 'Hello number zero today friend', k1: 'Hello number one today friend', k2: 'Hello number two today friend' };

  it('local → another method: the DRY run says why nothing it would send comes from the cache', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `[${m}] Salut ${s.length} ${k}`);
    try {
      const { d } = nextProject({ src });
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'messages/en.json'), { ...src, k1: 'Hello number one changed friend', k9: src.k0 });
      const dry = await runCli(['sync', '--dry', '--method', 'google-translate'], d, { ...env, GOOGLE_TRANSLATE_API_KEY: 'fake', CHAMPOLLION_OFFLINE: '1' });
      assert.equal(dry.code, 0, dry.out);
      assert.match(dry.out, /en:fr: 1 of the 2 key\(s\) a real run would send to the model have translations in the cache from local · model stub-1 · register formal-vous — not reused: the cache is kept per method/);
    } finally {
      await model.close();
    }
  });

  it('after a model switch, a sync that reads nothing from the old cache says nothing about it; one that does, says so', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `[${m}] Salut ${s.length} ${k}`);
    try {
      const { d, cfg } = nextProject({ src });
      const env = { LOCAL_API_BASE: model.url };
      await runCli(['sync'], d, env);
      cfg({ model: 'stub-2' });
      for (const args of [['sync'], ['sync'], ['sync', '--dry']]) {
        const r = await runCli(args, d, env);
        assert.equal(r.code, 0, r.out);
        assert.doesNotMatch(r.out, /Model changed/, `${args.join(' ')} processed nothing and read nothing from the cache`);
      }
      // status still carries the standing fact.
      assert.match((await runCli(['status'], d, env)).out, /earlier model: every translation in the files .* came from stub-1/);
      // A key whose text the old model translated: served from its cache, and said.
      writeJSON(path.join(d, 'messages/en.json'), { ...src, k9: src.k0 });
      const before = model.calls.length;
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Model changed: 1 translation this run needs \(1 string in fr\) is served from the previous model's cached translations, at no cost/);
      assert.match(r.out, /fr: now stub-2; reusing translations from stub-1 \(1\)/);
      assert.deepEqual(keysSent(model, before), [], 'served from the cache, not sent');
    } finally {
      await model.close();
    }
  });
});

// ── 4. One plural rule for sync and integrity ───────────────────────────────
describe('Round 5 — integrity follows sync\'s everyday/rare plural rule', () => {
  it('French without "many" is a note; Russian without few/many is a warning', async () => {
    const d = tmp('plural');
    writeJSON(path.join(d, 'messages/en.json'), { items: '{count, plural, one {# item} other {# items}}' });
    writeJSON(path.join(d, 'messages/fr.json'), { items: '{count, plural, one {# article} other {# articles}}' });
    writeJSON(path.join(d, 'messages/ru.json'), { items: '{count, plural, one {# штука} other {# штук}}' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr', 'ru'] });
    const r = await runCli(['integrity'], d);
    const fr = r.out.slice(r.out.indexOf('Integrity Audit: fr'), r.out.indexOf('Integrity Audit: ru'));
    const ru = r.out.slice(r.out.indexOf('Integrity Audit: ru'));
    assert.doesNotMatch(fr, /\[WARN\]/);
    assert.match(fr, /\[INFO\] PLURAL FORMS FOR LARGE NUMBERS ONLY \(1\) — not a problem/);
    assert.match(fr, /items: no "many" form — French uses it only above 1000 or for fractions \(many \(1000000\)\); the "other" form is used there/);
    assert.match(ru, /\[WARN\] PLURAL CATEGORY ISSUES \(1\)/);
    assert.match(ru, /Missing: no "few" and "many" form, which Russian uses for few \(2, 3, 4\), many \(0, 5, 6\)/);
  });
});

// ── 6 + 17. Docs use the canonical commands and one SSOT example model ─────
describe('Round 5 — docs: grouped network commands, one example model from the SSOT', () => {
  const docsDir = new URL('../website/docs/', import.meta.url);
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'network') walk(p); } else if (/\.mdx?$/.test(e.name)) pages.push([p, read(p)]);
    }
  };
  walk(fileURLToPath(docsDir));
  pages.push(['README.md', README]);

  it('no ungrouped network command invocations in README or the CLI docs', () => {
    const bad = [];
    for (const [p, text] of pages) {
      for (const m of text.matchAll(/(?:npx )?champollion (card|recommend|leaderboard|register-corpus|seal-corpus|submit)\b/g)) {
        const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index));
        if (/also works as `champollion /.test(line)) continue; // the alias, named as such
        bad.push(`${path.basename(p)}: ${m[0]}`);
      }
    }
    assert.deepEqual(bad, []);
    assert.match(README, /\| `network recommend` \|/);
  });

  it('every google/* example model id is an exact slug the CLI has stood behind (no alias, no floating id)', () => {
    // The slugs the retired short names stood for (shared/retired-model-aliases.json)
    // — the docs' examples name these exact slugs, never the retired names.
    const retired = readJSON(new URL('../../shared/retired-model-aliases.json', import.meta.url)).retired;
    const known = new Set([...Object.values(retired).filter(v => typeof v === 'string'), DEFAULT_OPENROUTER_MODEL]);
    const bad = [];
    for (const [p, text] of pages) {
      for (const m of text.matchAll(/google\/gemini-[0-9a-z.-]+/g)) if (!known.has(m[0])) bad.push(`${path.basename(p)}: ${m[0]}`);
    }
    // how-this-site-is-translated.md reports the model the site WAS translated with — a record, not an example.
    assert.deepEqual(bad.filter(b => !b.startsWith('how-this-site-is-translated.md')), []);
    // The examples show the CLI's own default model.
    assert.ok(doc('getting-started/quick-start.md').includes(DEFAULT_OPENROUTER_MODEL));
    assert.ok(doc('guides/ci-cd.md').includes(DEFAULT_OPENROUTER_MODEL));
  });
});

// ── 7. tm stats prints local time with the zone ─────────────────────────────
describe('Round 5 — tm stats dates are local, the zone named', () => {
  it('a UTC timestamp after local midnight prints as the local date, with the zone; --json keeps the ISO stamp', async () => {
    const d = tmp('tm');
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'] });
    writeJSON(path.join(d, 'messages/en.json'), { a: 'Hi' });
    write(path.join(d, '.champollion/tm.json'), JSON.stringify({
      _meta: { version: 1, created: '2026-10-04T02:30:00.000Z' },
      abc: { t: 'Salut', l: 'fr', m: 'llm|m|formal-vous|', ts: '2026-10-04T02:31:00.000Z' },
    }));
    const r = await runCli(['tm', 'stats'], d, { TZ: 'America/Edmonton' });
    assert.match(r.out, /Created:\s+2026-10-03 20:30 MDT/);
    assert.match(r.out, /Last entry:\s+2026-10-03 20:31 MDT/);
    const j = JSON.parse((await runCli(['tm', 'stats', '--json'], d, { TZ: 'America/Edmonton' })).stdout);
    assert.equal(j.createdAt, '2026-10-04T02:30:00.000Z');
    assert.equal(j.lastEntryAt, '2026-10-04T02:31:00.000Z');
  });
});

// ── 9 + 10 + 11. The CI guide ───────────────────────────────────────────────
describe('Round 5 — CI guide: the failing step says why; the output shape; local in CI', () => {
  const guide = doc('guides/ci-cd.md');
  const workflows = guide.split('```yaml').slice(1).map(b => b.slice(0, b.indexOf('```'))).filter(w => /champollion@0\.5 sync/.test(w) && /git push/.test(w));

  it('every workflow checks the recorded exit code right after the commit, before verify', () => {
    assert.ok(workflows.length >= 2);
    for (const w of workflows) {
      const commit = w.indexOf('git push origin');
      const stop = w.indexOf('- name: Stop when the sync was partial');
      const verify = w.indexOf('champollion@0.5 verify');
      assert.ok(commit > 0 && stop > commit && verify > stop, 'commit → stop on exit 2 → verify');
      assert.match(w, /- name: Stop when the sync was partial\n\s+if: steps\.sync\.outputs\.code == '2'/);
      assert.match(w, /--max-cost before translating, or some keys were not translated/);
    }
  });

  it('the --json shape is documented precisely, and the summary is selectable by its level', async () => {
    assert.match(guide, /one JSON object per line \(NDJSON\), each with a `level`/);
    assert.match(guide, /jq -e 'select\(\.level == "summary"\) \| \.preflight\.ready and \(\.maxCost\.wouldStop \| not\)'/);
    assert.match(doc('reference/cli.md'), /select\(\.level == "summary"\)/);
    assert.match(doc('guides/agent-guide.md'), /select\(\.level == "summary"\)/);
    // And the CLI does what the docs say: stdout is NDJSON, the summary is the last line and carries level "summary".
    const { d } = nextProject({ src: { a: 'Hello there friend' }, method: 'google-translate', model: undefined });
    const r = await runCli(['sync', '--dry', '--json'], d, { GOOGLE_TRANSLATE_API_KEY: 'fake', CHAMPOLLION_OFFLINE: '1' });
    const { last, lines } = summaryOf(r.stdout);
    assert.ok(lines.every(l => typeof l.level === 'string'));
    assert.equal(last.level, 'summary');
    assert.equal(last.command, 'sync');
    assert.equal(last.preflight.ready, true);
  });

  it('the generic workflow carries the hosted-model override in the YAML; the cache is said to be per method', () => {
    const generic = workflows[0];
    // Round 13: the override is the commented SYNC_FLAGS line, read by the sync and the dry-run check.
    assert.match(generic, /#   SYNC_FLAGS: --method llm --model google\/gemini-3\.8-flash --max-cost 5/);
    assert.match(generic, /if your config says "local" \(a model on\n# your machine\), name a hosted model here instead/);
    assert.match(guide, /\*\*The cache is kept per method\.\*\*/);
    assert.match(guide, /never share cache entries/);
  });
});

// ── 12. init writes the registers it chose ──────────────────────────────────
describe('Round 5 — init writes each target\'s register into the config', () => {
  it('object-form languages with the presets init printed, and how to change one', async () => {
    const d = tmp('reg');
    writeJSON(path.join(d, 'public/locales/en/common.json'), { hello: 'Hello' });
    const r = await runCli(['init', '--yes', '--langs', 'fr,es,crk', '--script', 'crk=Latn'], d);
    assert.equal(r.code, 0, r.out);
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    assert.deepEqual(cfg.languages, { fr: 'formal-vous', es: 'neutral-latam', crk: { script: 'Latn' } });
    assert.match(r.out, /es {5}Spanish → neutral-latam {3}\(others: formal-usted, informal-tu\)/);
    assert.match(r.out, /To change one, edit "languages" in champollion\.config\.json: a preset name \(e\.g\. "fr": "casual-tu"\)/);
    // The written config is what sync runs with: status reads the presets back.
    const status = (await runCli(['status'], d, { OPENROUTER_API_KEY: 'x' })).out;
    assert.match(status, /es {2}neutral-latam ★/);
  });

  it('an existing list-form config keeps working unchanged', async () => {
    const model = await startFakeModel((k, s) => `Bonjour ${s.length} ${k}`);
    try {
      const { d } = nextProject({ src: { a: 'Hello there friend' }, languages: ['fr'] });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.deepEqual(readJSON(path.join(d, 'champollion.config.json')).languages, ['fr']);
      assert.match(model.calls[0].prompt + '', /Hello there friend/);
    } finally {
      await model.close();
    }
  });
});

// ── 13 + 18. Django docs ────────────────────────────────────────────────────
describe('Round 5 — the Django section says which method and key, and the header warnings', () => {
  const fw = doc('integrations/frameworks.md');
  const django = fw.slice(fw.indexOf('## Django and gettext (.po)'));
  it('method and key', () => {
    assert.match(django, /\*\*Which method translates, and which key it needs\.\*\*/);
    assert.match(django, /`OPENROUTER_API_KEY`/);
    assert.match(django, /--method local --model llama3\.1/);
    assert.match(django, /\[Translation Methods\]\(\/docs\/guides\/translation-methods\)/);
  });
  it('msgfmt -c header warnings and the one-time fix', () => {
    assert.match(django, /`msgfmt -c` header warnings on catalogs `makemessages` started/);
    assert.match(django, /still has the initial default value/);
    assert.match(django, /delete the `#, fuzzy` line above `msgid ""`/);
  });
});

// ── 14. See the request without sending it ──────────────────────────────────
describe('Round 5 — sync --dry --show-prompt shows the exact request, sends nothing', () => {
  function djangoProject() {
    const d = tmp('django');
    write(path.join(d, 'manage.py'), '');
    write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), [
      'msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '"Language: en\\n"', '',
      '#. Toolbar button that opens a file', 'msgctxt "verb"', 'msgid "Open"', 'msgstr ""', '',
      'msgctxt "adjective"', 'msgid "Open"', 'msgstr ""', '',
      'msgid "Welcome back, %(name)s!"', 'msgstr ""', '',
    ].join('\n'));
    return d;
  }

  it('a msgctxt entry: its context and #. comment reach the model; the key is redacted; nothing is sent', async () => {
    const model = await startFakeModel(() => 'NEVER');
    try {
      const d = djangoProject();
      assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], d)).code, 0);
      const r = await runCli(['sync', '--dry', '--show-prompt', 'verb␄Open'], d, { LOCAL_API_BASE: model.url, OPENAI_API_KEY: 'sk-secret-123' });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Request preview — en:fr, fr\/LC_MESSAGES\/django\.po, the key you named \(1\): what local would be sent\. Not sent; secrets redacted\./);
      assert.match(r.out, /POST http:\/\/127\.0\.0\.1:\d+\/v1\/chat\/completions/);
      assert.match(r.out, /── system ──\n\s+You are translating UI strings/);
      assert.match(r.out, /"msg_1": Context \(msgctxt\): verb — Toolbar button that opens a file/);
      assert.match(r.out, /"Authorization":"<redacted>"/);
      assert.doesNotMatch(r.out, /sk-secret-123/);
      assert.equal(model.calls.length, 0, 'nothing reached the model');
      assert.ok(!fs.existsSync(path.join(d, '.champollion/tm.json')), 'nothing cached');
    } finally {
      await model.close();
    }
  });

  it('without a key it shows what each file would send; JSON carries a request event; a machine-translation engine says it gets text only', async () => {
    const d = djangoProject();
    assert.equal((await runCli(['init', '--yes', '--langs', 'fr'], d)).code, 0);
    const j = await runCli(['sync', '--dry', '--json', '--show-prompt'], d, { OPENROUTER_API_KEY: 'sk-or-v1-secret' });
    const events = j.stdout.trim().split('\n').map(l => JSON.parse(l)).filter(l => l.event === 'request');
    assert.equal(events.length, 1);
    assert.equal(events[0].request.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(events[0].request.headers.Authorization, '<redacted>');
    assert.equal(events[0].keys.length, 3);
    assert.doesNotMatch(j.stdout, /sk-or-v1-secret/);
    const mt = await runCli(['sync', '--dry', '--method', 'deepl', '--show-prompt'], d, { DEEPL_API_KEY: 'x' });
    assert.match(mt.out, /no request preview for deepl — it is sent the source text of each key and nothing else/);
  });

  it('refuses outside a dry run, and when the parser took the next flag as its key', async () => {
    const d = djangoProject();
    await runCli(['init', '--yes', '--langs', 'fr'], d);
    const live = await runCli(['sync', '--show-prompt'], d);
    assert.equal(live.code, 1);
    assert.match(live.out, /--show-prompt shows the request a run would send, without sending it: add --dry/);
    const swallowed = await runCli(['sync', '--show-prompt', '--dry'], d);
    assert.equal(swallowed.code, 1);
    assert.match(swallowed.out, /--show-prompt took "--dry" as the key to show\. Put --show-prompt last/);
  });
});

// ── 15. The gate's retry line says why ──────────────────────────────────────
describe('Round 5 — "quality gate rejected N key(s) — retrying" names each reason', () => {
  it('the reason per key is printed under the retry line', async () => {
    const model = await startFakeModel((k, s, { prompt }) => (k === 'k1' && !/RETRY/.test(prompt)
      ? s.replace(/o/g, 'ó').replace(/a/g, 'á') : `Salut ${k} mon ami ${s.length}`));
    try {
      const { d } = nextProject({ src: { k0: 'Hello number zero today friend', k1: 'Book an appointment today please' } });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /en:fr: quality gate rejected 1 key\(s\) — retrying with feedback\.\.\.\n\s+- k1: source echo \(the source handed back with only case, accents, spacing or invisible characters changed — not a translation\)/);
    } finally {
      await model.close();
    }
  });
});

// ── 20. One memorized sentence for different clinical prompts ───────────────
const S = 'Pemâmitonêyihtamân ê-wî-kiskêyihtamân anohc kîsikâw';

async function startApi(answer) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { keys = {} } = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, answer(v)])) }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/translate`, close: () => new Promise(r => server.close(r)) };
}

describe('Round 5 — one memorized sentence for different source strings is refused everywhere', () => {
  const CLINIC = { appTitle: 'Ward Helper', whereHurt: 'Where does it hurt?', callFamily: 'We will call your family.', medicineTime: "Take your medicine at 8 o'clock." };
  const forge = (src) => (src === CLINIC.appTitle ? 'Ospital 11' : S);

  async function flutterApp(keys, api) {
    const d = path.join(tmp('ward'), 'app');
    write(path.join(d, 'pubspec.yaml'), 'name: ward\nflutter:\n  generate: true\n');
    write(path.join(d, 'l10n.yaml'), 'arb-dir: lib/l10n\ntemplate-arb-file: app_en.arb\n');
    write(path.join(d, 'lib/l10n/app_en.arb'), JSON.stringify({ '@@locale': 'en', ...keys }, null, 2));
    const init = await runCli(['init', '--yes', '--langs', 'abc', '--method', 'api', '--endpoint', api.url, '--accepts-instructions', 'false'], d);
    assert.equal(init.code, 0, init.out);
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    cfg.pairs['en:abc'].fallback = { method: 'local', model: 'stub-fb' };
    writeJSON(path.join(d, 'champollion.config.json'), cfg);
    return d;
  }
  const onDisk = (d) => Object.entries(readJSON(path.join(d, 'lib/l10n/app_abc.arb'))).filter(([k, v]) => !k.startsWith('@') && v === S).map(([k]) => k);

  it('hospital: entries another tool cached one text at a time are not written; verify fails on such a group', async () => {
    const api = await startApi(forge);
    const model = await startFakeModel((k, src) => forge(src));
    try {
      const d = await flutterApp(CLINIC, api);
      // What the MCP translate tool (project_dir, method local) cached: the
      // project's pair resolved with --method local, one text at a time.
      const config = resolveConfig({ method: 'local' }, d);
      const pc = [...resolvePairs(config).values()].find(p => p.target === 'abc');
      const tm = loadTM(d);
      for (const text of Object.values(CLINIC)) storeTM(tm, text, 'abc', tmMethodKey(pc), forge(text));
      saveTM(d, tm);

      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.ok(onDisk(d).length < 3, `written as one sentence: ${onDisk(d).join(', ')}\n${r.out}`);
      assert.equal(r.code, 2, 'untranslated clinical prompts are not a clean pass');
      assert.match(r.out, /same output for 3 different source strings/);

      // A file that already holds the group (written before this gate): verify fails.
      const arb = readJSON(path.join(d, 'lib/l10n/app_abc.arb'));
      for (const k of ['whereHurt', 'callFamily', 'medicineTime']) arb[k] = S;
      writeJSON(path.join(d, 'lib/l10n/app_abc.arb'), arb);
      const v = await runCli(['verify'], d);
      assert.equal(v.code, 1, v.out);
      assert.match(v.out, /\[VERIFY\] abc: 3 value\(s\) hold the same text for different source strings/);
    } finally {
      await api.close();
      await model.close();
    }
  });

  it('hospital: keys added one sync at a time — a repeat of a sentence already on disk is refused (Round 6: from the second)', async () => {
    const api = await startApi(forge);
    const model = await startFakeModel((k, src) => forge(src));
    try {
      const order = Object.keys(CLINIC);
      const d = await flutterApp({ appTitle: CLINIC.appTitle }, api);
      for (let i = 1; i <= order.length; i++) {
        write(path.join(d, 'lib/l10n/app_en.arb'), JSON.stringify({ '@@locale': 'en', ...Object.fromEntries(order.slice(0, i).map(k => [k, CLINIC[k]])) }, null, 2));
        await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      }
      // Round 6: two clearly different clinical prompts answered with one
      // 4-word sentence are already the pattern — the second is refused.
      assert.deepEqual(onDisk(d).sort(), ['whereHurt'], 'the second repeat is refused');
      const v = await runCli(['verify'], d);
      // The refused keys are missing (an error); the one on disk holds the
      // sentence the sync remembered as memorized (an error too).
      assert.match(v.out, /2 missing key\(s\): (callFamily, medicineTime|medicineTime, callFamily)/);
      assert.match(v.out, /1 value\(s\) hold the sentence an earlier sync caught the model repeating for different source strings — .* for whereHurt/);
    } finally {
      await api.close();
      await model.close();
    }
  });

  it('school: both branches of a plural message count (as one source), and a newsletter heading shares the index at verify', async () => {
    const SCHOOL = 'Kiskinwahamâtowikamik ê-wî-nitawi-kiskinwahamâkosiyan anohc';
    const model = await startFakeModel((k, src) => (src.includes('{count, plural')
      ? `{count, plural, one {${SCHOOL}} other {${SCHOOL}}}` : SCHOOL));
    try {
      const { d } = nextProject({
        src: { title: 'Riverside School', contact: 'Contact the school office', Home: { events: '{count, plural, one {# event this week} other {# events this week}}' } },
      });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 1, `every key refused: nothing translated (exit 1)\n${r.out}`);
      assert.match(r.out, /same output for 3 different source strings/);
      const fr = fs.existsSync(path.join(d, 'messages/fr.json')) ? readJSON(path.join(d, 'messages/fr.json')) : {};
      assert.notEqual(fr.title, SCHOOL);
      assert.notEqual(fr.contact, SCHOOL);
      assert.ok(!fr.Home || !String(fr.Home.events || '').includes(SCHOOL));

      // On disk (written before the gate): two keys + a newsletter H1 → verify fails, naming the page.
      writeJSON(path.join(d, 'messages/fr.json'), { title: SCHOOL, contact: SCHOOL, Home: { events: '{count, plural, one {# événement} other {# événements}}' } });
      write(path.join(d, 'newsletters/issue-1.md'), '---\ntitle: "Issue 1"\n---\n\n# Welcome back to a new school year\n\nWe start on Monday.\n');
      write(path.join(d, 'newsletters/issue-1.fr.md'), `---\ntitle: "Numéro 1"\n---\n\n# ${SCHOOL}.\n\nNous commençons lundi.\n`);
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, contentDir: 'newsletters' });
      const v = await runCli(['verify'], d);
      assert.equal(v.code, 1, v.out);
      assert.match(v.out, /3 value\(s\) hold the same text for different source strings — .* for title, contact, issue-1\.md#1/);
      // The one content repair sync prints too (Round 7): no --fresh needed.
      assert.match(v.out, /`champollion sync --pair en:fr --redo files:issue-1\.md`/);
    } finally {
      await model.close();
    }
  });

  it('two branches of ONE plural sharing text is not the pattern on its own (a language without number inflection)', async () => {
    const d = tmp('inflect');
    writeJSON(path.join(d, 'messages/en.json'), { a: '{count, plural, one {# new message for you} other {# new messages for you}}', b: 'Settings' });
    writeJSON(path.join(d, 'messages/id.json'), { a: '{count, plural, other {# pesan baru untuk Anda}}', b: 'Pengaturan' });
    writeJSON(path.join(d, 'messages/ja.json'), { a: '{count, plural, one {あなたへの新着メッセージ#件} other {あなたへの新着メッセージ#件}}', b: '設定' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['id', 'ja'] });
    const v = await runCli(['verify'], d);
    assert.doesNotMatch(v.out, /same text for different source strings/);
  });
});

// ── 21. init --method api --endpoint, as DEPLOY.md shows ────────────────────
describe('Round 5 — init --method api --endpoint writes DEPLOY.md\'s pair entry', () => {
  it('one pair per target; acceptsInstructions from the flag or an installed manifest; errors are plain', async () => {
    const d = tmp('api');
    writeJSON(path.join(d, 'messages/en.json'), { hello: 'Where does it hurt?' });
    const url = 'http://127.0.0.1:8378/translate';
    let r = await runCli(['init', '--yes', '--langs', 'abc', '--method', 'api', '--endpoint', url, '--accepts-instructions', 'false'], d);
    assert.equal(r.code, 0, r.out);
    let cfg = readJSON(path.join(d, 'champollion.config.json'));
    assert.deepEqual(cfg.pairs, { 'en:abc': { method: 'api', endpoint: url, acceptsInstructions: false } });
    assert.equal(cfg.defaultMethod, 'api');
    assert.equal(cfg.model, undefined, 'the endpoint serves its own model');
    assert.match(r.out, /Method: api, endpoint http:\/\/127\.0\.0\.1:8378\/translate — written as "pairs" for en:abc\./);
    assert.doesNotMatch(r.out, /Set your API key/, 'a loopback endpoint started without a token needs no key');

    write(path.join(d, '.champollion/methods/abc-nmt/method.json'), JSON.stringify({ name: 'abc-nmt', type: 'api', endpoint: url, acceptsInstructions: false }));
    r = await runCli(['init', '--yes', '--force', '--langs', 'abc', '--method', 'api', '--endpoint', url], d);
    assert.match(r.out, /acceptsInstructions: false \(from \.champollion\/methods\/abc-nmt\/method\.json\)/);
    cfg = readJSON(path.join(d, 'champollion.config.json'));
    assert.equal(cfg.pairs['en:abc'].acceptsInstructions, false);

    r = await runCli(['init', '--yes', '--force', '--langs', 'abc', '--method', 'api', '--endpoint', 'https://mt.example.org/translate'], d);
    assert.match(r.out, /export CHAMPOLLION_API_KEY=\.\.\./, 'an endpoint off this machine needs its key');

    const noEndpoint = await runCli(['init', '--yes', '--force', '--langs', 'abc', '--method', 'api'], d);
    assert.equal(noEndpoint.code, 1);
    assert.match(noEndpoint.out, /--method api needs --endpoint <url>/);
    const wrongMethod = await runCli(['init', '--yes', '--force', '--langs', 'abc', '--endpoint', url], d);
    assert.equal(wrongMethod.code, 1);
    assert.match(wrongMethod.out, /--endpoint applies to --method api/);
  });

  it('the config init writes is one sync runs: the api endpoint gets the request', async () => {
    const api = await startApi(src => `ABC ${src}`);
    try {
      const d = tmp('api-sync');
      writeJSON(path.join(d, 'messages/en.json'), { hello: 'Where does it hurt?' });
      assert.equal((await runCli(['init', '--yes', '--langs', 'abc', '--method', 'api', '--endpoint', api.url, '--accepts-instructions', 'false'], d)).code, 0);
      const r = await runCli(['sync'], d);
      assert.equal(r.code, 0, r.out);
      assert.equal(readJSON(path.join(d, 'messages/abc.json')).hello, 'ABC Where does it hurt?');
    } finally {
      await api.close();
    }
  });
});

describe('Round 5 — the object-form languages init now writes are read everywhere', () => {
  it('seo hreflang lists the targets of an object-form "languages"', async () => {
    const { generateAllHreflangTags } = await import('../lib/seo.js');
    const out = generateAllHreflangTags({ inputLocale: 'en', baseUrl: 'https://example.org', languages: { fr: 'formal-vous', de: {} } });
    assert.match(out, /hreflang="fr"/);
    assert.match(out, /hreflang="de"/);
  });
});
