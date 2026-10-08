/**
 * Round 13 synthetic personas (Next.js, Django, i18next): a run says whose
 * text it reuses before the estimate, gives one redo for all pairs, asks
 * again for plural forms a model left out, predicts its real exit code in a
 * dry run, prunes plural keys a language does not have only when asked, and
 * the docs say what the tool does — with no unverified vocabulary of any
 * language presented as real.
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

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { convertScript } from '../lib/scripts.js';
import { pluralCategoriesFor, describePluralFormChanges } from '../lib/plurals.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round13-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, `${JSON.stringify(obj, null, 2)}\n`);
const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
const flat = (text) => text.replace(/\s+/g, ' ');
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

function nextApp(cfg = {}, messages = { save: 'Save your changes', open: 'Open the settings page', close: 'Close the window now' }) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), messages);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'stub-1', languages: ['fr'], ...cfg,
  });
  return d;
}

// ── 1. A string reverted to an earlier model's text: said before the estimate ──
describe('Round 13 — Next.js: a dry run says which earlier model\'s text it reuses, before the estimate', () => {
  it('1: after the switch completed, a string reverted to text only stub-1 translated is named as stub-1\'s — dry and real alike', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `FR(${m}) ${s}`);
    try {
      const d = nextApp();
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      setConfig(d, { model: 'stub-2' });
      writeJSON(path.join(d, 'messages/en.json'), { save: 'Save all your changes', open: 'Open the settings page', close: 'Close the window now' });
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // The switch, completed: every string re-translated by stub-2.
      assert.equal((await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env)).code, 0);
      // The persona reverts "save": only stub-1 ever translated that text.
      writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page', close: 'Close the window now' });

      const notice = /Model changed: 1 translation this run needs \(1 string in fr\) is served from the previous model's cached translations, at no cost/;
      const who = /fr: now stub-2; reusing translations from stub-1 \(1\)/;
      for (const args of [['sync', '--dry'], ['sync']]) {
        const before = model.calls.length;
        const r = await runCli(args, d, env);
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, notice, `${args.join(' ')}: ${r.out}`);
        assert.match(r.out, who);
        // Before the estimate, as the Translation Memory page promises.
        assert.ok(r.out.search(notice) < r.out.indexOf('Estimated translation cost'), 'said before the estimate');
        assert.equal(model.calls.length, before, 'served from the cache: nothing sent');
      }
      assert.equal(readJSON(path.join(d, 'messages/fr.json')).save, 'FR(stub-1) Save your changes');
      // The JSON summary carries the same row.
      const s = summaryOf((await runCli(['sync', '--dry', '--json'], d, env)).stdout);
      assert.equal(s.tmModelSwitch.length, 0, 'nothing to reuse once the real run wrote it');
    } finally {
      await model.close();
    }
  });

  it('1: the Translation Memory page promises the reuse — and whose text it is — before the estimate, dry runs included', () => {
    const tmDoc = flat(doc('concepts/translation-memory.md'));
    assert.match(tmDoc, /Before the cost estimate, sync says how many translations it will reuse and which model wrote them — a dry run too, and also after the switch is complete/);
  });
});

// ── 2. A method change: one redo for every pair, with its total ─────────────
describe('Round 13 — Next.js: a method change gives one redo command for all pairs, with a total', () => {
  it('2: per-language lines with their count and price, then one command and the total; one pair keeps its single line', async () => {
    const model = await startFakeModel((k, s) => `T ${s}`);
    try {
      const d = nextApp({ languages: ['fr', 'de'] });
      const env = { ...BASE, LOCAL_API_BASE: model.url, OPENROUTER_API_KEY: 'sk-or-placeholder', ...priceList(GEMINI) };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      setConfig(d, { defaultMethod: 'llm', model: 'google/gemini-3.5-flash' });
      const r = await runCli(['sync', '--dry'], d, env);
      assert.equal(r.code, 0, r.out);
      const lines = [...r.out.matchAll(/en:(de|fr): 3 translation\(s\) in the files were written by local · model stub-1 · register \S+ \(3\), not by llm · model google\/gemini-3\.5-flash · register \S+ \(re-translating them: 3 key\(s\) to llm, est\. ~\$([0-9.]+)\)\./g)];
      assert.equal(lines.length, 2, r.out);
      const combined = /2 pairs keep another method's text\. Nothing would change: .* To have llm translate them, all at once: `champollion sync --redo all` — sends 6 key\(s\) \(3 for en:de, 3 for en:fr\) — total: est\. ~\$([0-9.]+)\./.exec(r.out);
      assert.ok(combined, r.out);
      const sum = lines.reduce((n, m) => n + Number(m[2]), 0);
      assert.ok(Math.abs(Number(combined[1]) - sum) <= 0.0001, `total ${combined[1]} = ${sum}`);
      assert.doesNotMatch(r.out, /`champollion sync --pair en:fr --redo all`/, 'no per-language command');

      // --pair: one pair, its own command.
      const one = await runCli(['sync', '--dry', '--pair', 'en:fr'], d, env);
      assert.match(one.out, /To have llm translate them: `champollion sync --pair en:fr --redo all` — sends 3 key\(s\) to llm \(est\. ~\$/);
      assert.doesNotMatch(one.out, /all at once/);
    } finally {
      await model.close();
    }
  });
});

// ── 3 + 4. Plural forms a model left out ────────────────────────────────────
const DJANGO_EN = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#, python-format
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] ""
msgstr[1] ""

msgid "Hello"
msgstr ""
`;
const RU_FULL = '{n, plural, one {Один файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}';

async function djangoProject(env) {
  const d = tmp('django');
  write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
  const init = await runCli(['init', '--yes', '--langs', 'ru', '--method', 'local', '--model', 'stub-1'], d, env);
  assert.equal(init.code, 0, init.out);
  return d;
}
const ruPo = (d) => read(path.join(d, 'locale/ru/LC_MESSAGES/django.po'));
const lockGaps = (d) => readJSON(path.join(d, '.champollion.lock')).locales.ru.gaps;

describe('Round 13 — Django: a plural entry a model left incomplete is asked for again', () => {
  it('3: same setup — not re-asked; another model — asked (priced); it fails too — still marked, and neither setup is asked again', async () => {
    const good = new Set(['stub-good']);
    const model = await startFakeModel((key, src, { model: m }) => {
      if (src.startsWith('{n, plural')) return good.has(m) ? RU_FULL : `{n, plural, one {Один файл ${m}} other {%(count)d файлов ${m}}}`;
      return `Привет ${src.length}`;
    });
    try {
      const env = { ...BASE, LOCAL_API_BASE: model.url, OPENAI_API_BASE: model.url, OPENAI_API_KEY: 'sk-test-placeholder' };
      const d = await djangoProject(env);
      assert.equal((await runCli(['sync'], d, env)).code, 2, 'stub-1 leaves few/many out');
      assert.match(ruPo(d), /# champollion: plural form\(s\) few \(msgstr\[1\]\), many \(msgstr\[2\]\)/);
      assert.deepEqual(lockGaps(d)['django::One file'].methods, ['local|stub-1|formal-vy|']);

      // The same setup again: nothing sent, exit 2 as before.
      let before = model.calls.length;
      const same = await runCli(['sync'], d, env);
      assert.equal(same.code, 2);
      assert.equal(model.calls.length, before, 'the setup that left it is not asked again');
      assert.match(same.out, /`champollion sync --pair en:ru --redo gaps` asks for every such message/);

      // Another model: the dry run prices it and names who left it.
      const dry = await runCli(['sync', '--dry', '--model', 'stub-2'], d, env);
      assert.equal(dry.code, 0, dry.out);
      assert.match(dry.out, /en:ru\s+local\s+1\s+0\s+\$0 \(local\)/, 'priced as one send');
      assert.match(dry.out, /would ask the model again for 1 plural message\(s\) without a form ru uses for ordinary counts \(few, many\): "django::One file" \(local · model stub-1 · register formal-vy left it so, and local · model stub-2 · register formal-vy has not been asked\)/);
      assert.match(dry.out, /it is sent to the model, not served from the cache, which holds the incomplete answer/);

      // stub-2 answers without the forms too: the entry stays marked.
      before = model.calls.length;
      const second = await runCli(['sync', '--model', 'stub-2'], d, env);
      assert.equal(second.code, 2, second.out);
      assert.ok(model.calls.slice(before).some(c => c.model === 'stub-2'), 'stub-2 was asked');
      assert.match(ruPo(d), /# champollion: plural form\(s\) few/);
      assert.match(ruPo(d), /msgstr\[0\] "Один файл stub-2"/);
      assert.deepEqual(lockGaps(d)['django::One file'].methods, ['local|stub-1|formal-vy|', 'local|stub-2|formal-vy|']);

      // Neither setup is asked again: no paid back-and-forth.
      before = model.calls.length;
      assert.equal((await runCli(['sync'], d, env)).code, 2);
      assert.equal((await runCli(['sync', '--model', 'stub-2'], d, env)).code, 2);
      assert.equal(model.calls.length, before);

      // --redo gaps asks whoever left it.
      before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'gaps'], d, env);
      assert.equal(redo.code, 2);
      assert.match(redo.out, /asking the model again for 1 plural message\(s\) .* \(--redo gaps\)/);
      assert.ok(model.calls.length > before);

      // CI's hosted model (another method) supplies the forms: the marker goes, exit 0.
      const ci = await runCli(['sync', '--method', 'openai', '--model', 'stub-good'], d, env);
      assert.equal(ci.code, 0, ci.out);
      assert.doesNotMatch(ruPo(d), /# champollion:/);
      assert.match(ruPo(d), /msgstr\[1\] "%\(count\)d файла"/);
      assert.equal(readJSON(path.join(d, '.champollion.lock')).locales.ru.gaps, undefined, 'record cleared once complete');
      assert.equal((await runCli(['sync'], d, env)).code, 0);
    } finally {
      await model.close();
    }
  });

  it('3: the CI guide documents --redo gaps as an optional workflow_dispatch input, and the CLI help lists the scope', () => {
    const guide = doc('guides/ci-cd.md');
    for (const title of ['.github/workflows/i18n-sync.yml', '.github/workflows/i18n-sync.yml (Django)']) {
      const at = guide.indexOf(`\`\`\`yaml title="${title}"`);
      const wf = guide.slice(at, guide.indexOf('```', at + 10));
      assert.match(wf, /workflow_dispatch:\n\s+inputs:\n\s+redo_gaps:\n\s+description: .*--redo gaps.*\n\s+type: boolean\n\s+default: false/, title);
      assert.match(wf, /npx --yes champollion@0\.5 sync \$SYNC_FLAGS \$\{\{ inputs\.redo_gaps && '--redo gaps' \|\| '' \}\}/, title);
    }
    assert.match(flat(guide), /#### Plural forms a model left out \{#plural-gaps\}/);
    assert.match(flat(guide), /\*\*If the new answer lacks the forms too, the entry stays marked\*\*/);
  });

  it('3: --redo gaps takes no value, and says when there is nothing to ask for', async () => {
    const d = nextApp();
    const bad = await runCli(['sync', '--dry', '--redo', 'gaps:x'], d, BASE);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /--redo gaps takes no value/);
    // Nothing to ask for: said, never a silent no-op.
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const none = await runCli(['sync', '--dry', '--redo', 'gaps'], d, { ...BASE, LOCAL_API_BASE: model.url });
      assert.equal(none.code, 0, none.out);
      assert.match(none.out, /--redo gaps: no plural message in the project's files lacks a form its language uses for ordinary counts — nothing to ask again\./);
    } finally {
      await model.close();
    }
  });

  it('4: a dry run reports the gaps on disk and predicts the real exit code; the real run agrees', async () => {
    const model = await startFakeModel((key, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Один файл} other {%(count)d файлов}}' : `Привет ${src.length}`));
    try {
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      const d = await djangoProject(env);
      assert.equal((await runCli(['sync'], d, env)).code, 2);

      const j = await runCli(['sync', '--dry', '--json'], d, env);
      assert.equal(j.code, 0, 'a dry run stays a preview');
      const s = summaryOf(j.stdout);
      assert.equal(s.totalPluralGaps, 1, 'the gap on disk, counted');
      assert.equal(s.pluralGapsAskedAgain, 0);
      assert.deepEqual(s.locales[0].pluralGaps, { 'django::One file': ['few', 'many'] });
      assert.deepEqual(s.verify, { ran: false, errors: null, warnings: null, tmEvicted: 0 }, 'never a 0 that reads as verified');
      assert.equal(s.realRun.exitCode, 2);
      assert.equal(s.realRun.wouldStop, false);
      assert.match(s.realRun.reasons[0], /1 plural message\(s\) on disk lack a form the language uses for ordinary counts, and this run does not ask for them again/);

      const text = await runCli(['sync', '--dry'], d, env);
      assert.equal(text.code, 0);
      assert.match(text.out, /A real sync would exit 2 \(partial\): 1 plural message\(s\) on disk lack a form/);
      assert.doesNotMatch(text.out, /\[OK\] Would have processed/);

      const real = await runCli(['sync', '--json'], d, env);
      assert.equal(real.code, s.realRun.exitCode, 'the prediction holds');
      assert.equal(summaryOf(real.stdout).totalPluralGaps, s.totalPluralGaps);
      assert.equal(summaryOf(real.stdout).verify.ran, true);

      // A run that would ask for it again says so, and does not count it as staying.
      const asked = summaryOf((await runCli(['sync', '--dry', '--json', '--model', 'stub-2'], d, env)).stdout);
      assert.equal(asked.totalPluralGaps, 0);
      assert.equal(asked.pluralGapsAskedAgain, 1);
      assert.equal(asked.realRun.exitCode, 0);
      assert.match(asked.realRun.reasons[0], /asked for again — the real run exits 2 if the answer lacks the forms too/);
    } finally {
      await model.close();
    }
  });

  it('4: the reference documents realRun and why a dry run keeps exit 0', () => {
    const cli = flat(doc('reference/cli.md'));
    assert.match(cli, /`realRun\.exitCode` puts them together/);
    assert.match(cli, /`verify` is `\{ "ran": false \}`/);
  });
});

// ── 5 is the MCP tool (mcp-server/test/translate-round13.test.js) ───────────

// ── 6. The CI guide's dry-run check runs the job's own flags ────────────────
describe('Round 13 — i18next: the documented dry-run check uses the same flags as the sync', () => {
  const guide = doc('guides/ci-cd.md');

  it('6: one SYNC_FLAGS line is read by both the sync step and the documented check', () => {
    const at = guide.indexOf('```yaml title=".github/workflows/i18n-sync.yml"');
    const wf = guide.slice(at, guide.indexOf('```', at + 10));
    assert.match(wf, /\nenv:\n {2}SYNC_FLAGS: --max-cost 5\n/);
    assert.match(wf, /# {3}SYNC_FLAGS: --method llm --model google\/gemini-3\.8-flash --max-cost 5/);
    assert.match(wf, /champollion@0\.5 sync \$SYNC_FLAGS /);
    assert.doesNotMatch(wf, /champollion@0\.5 sync --max-cost 5/, 'no second spelling of the flags');
    // (Round 14: stdout goes to $out and stderr stays in the log, so a failing check prints why.)
    assert.match(guide, /out=\$\(npx --yes champollion@0\.5 sync --dry \$SYNC_FLAGS --json\) \|\| true\n\s+if ! printf '%s\\n' "\$out" \| jq -e 'select\(\.level == "summary"\) \| \.preflight\.ready and \(\.maxCost\.wouldStop \| not\)'/);
    assert.match(flat(guide), /\*\*Run it with the same flags as the sync\*\*: without them it checks the method the config names/);
  });

  it('6: with a local config and nothing to translate, the check without the flags passes — with them and no key it fails', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/translation.json'), { save: 'Save your changes' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'stub-1', languages: ['fr', 'es'],
      });
      // A model server answers on the developer's machine; nothing is left to translate.
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);

      // The documented check, as jq reads the summary.
      const gate = (s) => s.preflight.ready && !(s.maxCost?.wouldStop);
      const hosted = /\nSYNC_FLAGS="([^"]+)"\nout=\$\(npx --yes champollion@0\.5 sync --dry \$SYNC_FLAGS/.exec(guide)[1].split(' ');
      assert.deepEqual(hosted.slice(0, 4), ['--method', 'llm', '--model', 'google/gemini-3.8-flash']);

      const without = summaryOf((await runCli(['sync', '--dry', '--max-cost', '5', '--json'], d, env)).stdout);
      assert.equal(gate(without), true, 'checks the local method: passes, and says nothing about the hosted one');

      const r = await runCli(['sync', '--dry', ...hosted, '--json'], d, env);
      assert.equal(r.code, 0);
      const s = summaryOf(r.stdout);
      assert.equal(s.costEstimate.pairs.reduce((n, p) => n + p.keys, 0), 0, 'nothing needs translating');
      assert.equal(s.preflight.ready, false, 'a hosted method is never ready without its key');
      assert.ok(s.preflight.failures.every(f => f.method === 'llm' && /OPENROUTER_API_KEY/.test(f.reason)));
      assert.equal(gate(s), false, 'jq -e fails the step');
      assert.equal(s.realRun.exitCode, 1);
      assert.equal(s.realRun.wouldStop, true);
      // A placeholder key passes the check (set, not verified) — as the guide says.
      const withKey = summaryOf((await runCli(['sync', '--dry', ...hosted, '--json'], d, { ...env, OPENROUTER_API_KEY: 'sk-or-placeholder', CHAMPOLLION_PRICING_OFFLINE: '1' })).stdout);
      assert.equal(withKey.preflight.ready, true);
    } finally {
      await model.close();
    }
  });
});

// ── 7. A plural key for a form the language does not have ──────────────────
describe('Round 13 — i18next: plural keys for a form the language does not have are removed only when asked', () => {
  it('7: verify prints the exact command; sync keeps the key; --prune plural-extras removes only that key and lists it', async () => {
    const model = await startFakeModel((k, s) => `ES ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/common.json'), { title: 'Hello', count_one: '{{count}} file', count_other: '{{count}} files' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'stub-1', languages: ['es'],
      });
      const env = { ...BASE, LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const esFile = path.join(d, 'public/locales/es/common.json');
      const es = readJSON(esFile);
      // Not in Spanish's CLDR forms (one, many, other): i18next never selects it.
      assert.ok(!pluralCategoriesFor('es').includes('two'));
      writeJSON(esFile, { ...es, count_two: 'dos archivos', title_two: 'not a plural key' });

      const v = await runCli(['verify', '--strict'], d, env);
      assert.equal(v.code, 1);
      assert.match(v.out, /1 plural key\(s\) for a form es does not have: count_two .* Remove them: `champollion sync --pair en:es --prune plural-extras`/);

      // Never without the flag.
      const plain = await runCli(['sync'], d, env);
      assert.equal(plain.code, 0);
      assert.equal(readJSON(esFile).count_two, 'dos archivos');
      assert.match(plain.out, /es\/common\.json — 2 extra key\(s\) not in source \(1 for a plural form es does not have: common::count_two — `champollion sync --pair en:es --prune plural-extras` removes it\)/);

      const dry = await runCli(['sync', '--dry', '--prune', 'plural-extras'], d, env);
      assert.equal(dry.code, 0);
      assert.match(dry.out, /would remove 1 plural key\(s\) for a form es does not have \(CLDR es: one, many, other\): common::count_two/);
      assert.equal(readJSON(esFile).count_two, 'dos archivos', 'a dry run removes nothing');

      const before = model.calls.length;
      const r = await runCli(['sync', '--prune', 'plural-extras'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /removed 1 plural key\(s\) for a form es does not have .*: common::count_two — --prune plural-extras removes these and nothing else/);
      assert.equal(model.calls.length, before, 'nothing sent');
      const after = readJSON(esFile);
      assert.equal(after.count_two, undefined);
      assert.deepEqual(after, { ...es, title_two: 'not a plural key' }, 'every other key as it was');
      assert.doesNotMatch((await runCli(['verify'], d, env)).out, /for a form es does not have/);
      assert.match((await runCli(['sync', '--prune', 'plural-extras'], d, env)).out,
        /--prune plural-extras: no plural key for a form its language does not have — nothing removed\./);

      const typo = await runCli(['sync', '--prune', 'plural-extra'], d, env);
      assert.equal(typo.code, 1);
      assert.match(typo.out, /--prune plural-extra: unknown\. Use --prune plural-extras/);
    } finally {
      await model.close();
    }
  });
});

// ── 8. Which languages gain which forms: from CLDR, not a fixed list ───────
describe('Round 13 — i18next: the forms each language gains are said from CLDR', () => {
  it('8: frameworks.md names Spanish with French, and every claim it makes holds in this runtime\'s CLDR', () => {
    const page = flat(doc('integrations/frameworks.md'));
    assert.match(page, /With an English source, Spanish and French gain `key_many`, Russian gains `key_few` and `key_many`, and Japanese keeps only `key_other`/);
    assert.doesNotMatch(page, /French gains `key_many`, Japanese/, 'the French-only sentence is gone');
    const gains = (code) => pluralCategoriesFor(code).filter(c => !pluralCategoriesFor('en').includes(c));
    assert.deepEqual(gains('es'), ['many']);
    assert.deepEqual(gains('fr'), ['many']);
    assert.deepEqual(gains('ru').sort(), ['few', 'many']);
    assert.deepEqual(pluralCategoriesFor('ja'), ['other']);
  });

  it('8: sync names the forms for the project\'s own languages, read from CLDR', async () => {
    const model = await startFakeModel((k, s) => `X ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/common.json'), { count_one: '{{count}} file', count_other: '{{count}} files' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'stub-1', languages: ['es', 'ja', 'de'],
      });
      const r = await runCli(['sync', '--dry'], d, { ...BASE, LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      const said = /i18next plural keys: 1 group\(s\) — each locale gets its own CLDR plural forms: (.+)\./.exec(r.out);
      assert.ok(said, r.out);
      assert.equal(said[1], describePluralFormChanges('en', ['es', 'ja', 'de']));
      assert.equal(said[1], 'de: the same forms as en; es adds _many; ja keeps only _other');
      assert.doesNotMatch(r.out, /French adds _many/);
    } finally {
      await model.close();
    }
  });
});

// ── 9. No unverified vocabulary of any language presented as real ──────────
describe('Round 13 — the docs carry no unverified vocabulary presented as real', () => {
  it('9: the coaching example is a made-up language, marked as such, with placeholder terms', () => {
    const page = doc('concepts/coaching-data.md');
    for (const word of ['ispīhci', 'kīwēwin', 'isi-nākatohkēwin', 'nānātawāpahtam', 'tānisi', 'pōni']) {
      assert.ok(!page.includes(word), `coaching-data.md: ${word}`);
    }
    assert.match(page, /```json title="\.champollion\/coaching\/qaa\.json"/);
    assert.match(flat(page), /a made-up language under `qaa`, a private-use code that no real language has: every rule and term in it is a stand-in/);
    assert.match(page, /"submit": "<your term for submit>"/);
    const how = doc('how-it-works.md');
    assert.ok(!how.includes('ᑕᓂᓯ') && !how.includes('ᐃᑕᐢᑌᐘᐃᓇ'));
    assert.match(how, /"welcome": "<your term for welcome>"/);
  });

  it('9: example sentences and words in other pages are placeholders; script examples are spellings the converter produces', () => {
    const serving = doc('guides/serving-a-method.md');
    for (const s of ['tânisi', 'pê-kîwêw', 'kinanâskomitin', 'ekosi']) assert.ok(!serving.includes(s), `serving-a-method.md: ${s}`);
    const tokenizers = doc('learn/tokenizers.md');
    assert.ok(!tokenizers.includes('nikî-wâpamâwak'));
    assert.match(tokenizers, /Take a made-up polysynthetic language, invented for\n> this page/);
    const conlangs = doc('guides/conlangs-scripts-orthography.md');
    for (const s of ['tawâw', "Qapla'", 'elen síla']) assert.ok(!conlangs.includes(s), `conlangs page: ${s}`);
    const converters = doc('concepts/script-converters.md');
    assert.ok(!converters.includes('"tānisi"'));
    // What the pages show the Cree converter producing is what it produces.
    assert.match(conlangs, /Input: {2}"pâ tê ki" .*\nOutput: "ᐹ ᑌ ᑭ"/);
    assert.equal(convertScript('pâ tê ki', 'crk').converted, 'ᐹ ᑌ ᑭ');
    assert.match(converters, /`pâ tê ki` \(a spelling example, not a word\) become `ᐹ ᑌ ᑭ`/);
    assert.match(doc('guides/comparison.md'), /`nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ`/);
    assert.equal(convertScript('nêhiyawêwin', 'crk').converted, 'ᓀᐦᐃᔭᐍᐏᐣ');
  });
});
