/**
 * Round 8 synthetic personas (Next.js, i18next, Django, researcher, school,
 * hospital): what each run says must match what it does.
 *
 * End to end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs) where a model is needed. No network,
 * no key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { computeExitCode } from '../lib/commands/sync.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round8-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const setConfig = (d, patch) => {
  const file = path.join(d, 'champollion.config.json');
  writeJSON(file, { ...readJSON(file), ...patch });
};
/** A runner with none of the CI variables this machine may have set. */
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };

function nextApp(cfg = {}) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page' });
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr', 'de'], ...cfg,
  });
  return d;
}

describe('Round 8 — Next.js: a dry run says what it would send', () => {
  it('5: a dry `--redo all` after a register change, or a method change, never says "Nothing would change" over the command it previews', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `FR(${m}) ${s}`);
    try {
      const d = nextApp();
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);

      // A register change.
      setConfig(d, { languages: { fr: 'casual-tu', de: 'casual-du' } });
      const reg = await runCli(['sync', '--dry', '--redo', 'all'], d, env);
      assert.equal(reg.code, 0, reg.out);
      assert.doesNotMatch(reg.out, /Nothing would change/);
      assert.match(reg.out, /en:fr: this redo would re-translate 2 translation\(s\) written by local · model m1 · register formal-vous \(2\) — sends them to local · model m1 · register casual-tu/);
      assert.match(reg.out, /\$0 API cost \(runs on this machine\); the estimate above prices the whole run/);
      assert.match(reg.out, /Would have processed 4 keys total — 4 would be sent to the model/);
      // Without the redo, the notice (and its command) is right.
      const plain = await runCli(['sync', '--dry'], d, env);
      assert.match(plain.out, /Nothing would change: a change of method, register or coaching re-translates nothing on its own/);

      // A method change.
      setConfig(d, { languages: ['fr', 'de'] });
      const meth = await runCli(['sync', '--dry', '--redo', 'all', '--method', 'llm'], d, env);
      assert.equal(meth.code, 0, meth.out);
      assert.doesNotMatch(meth.out, /Nothing would change/);
      assert.match(meth.out, /en:fr: this redo would re-translate 2 translation\(s\) written by local · model m1 · register formal-vous \(2\) — sends them to llm/);
    } finally {
      await model.close();
    }
  });

  it('6: a dry run with nothing to do says what it costs, as the real run does', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = nextApp();
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.match(dry.out, /Would have processed 0 keys total — \$0: nothing would be sent or billed\./);
      const real = await runCli(['sync'], d, env);
      assert.match(real.out, /Synced 0 keys total — everything was already up to date; no model calls, nothing billed\./);
    } finally {
      await model.close();
    }
  });

  it('7: a model switch over several pairs prints ONE project-wide command; one pair keeps its own', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = nextApp();
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const dry = await runCli(['sync', '--dry', '--model', 'm2'], d, env);
      assert.match(dry.out, /en:de: 2 translation\(s\) in the files were written by m1 \(2\), not the model for this run \(--model m2\)\./);
      assert.match(dry.out, /2 pairs keep an earlier model's text — a model change alone re-translates nothing\. To re-translate them with it: `champollion sync --model m2 --redo all --fresh-on-model-change`/);
      assert.doesNotMatch(dry.out, /--pair en:fr --model m2 --redo all/, 'not one command per pair');
      const one = await runCli(['sync', '--dry', '--model', 'm2', '--pair', 'en:fr'], d, env);
      assert.match(one.out, /`champollion sync --pair en:fr --model m2 --redo all --fresh-on-model-change`/);
    } finally {
      await model.close();
    }
  });

  it('8: the no-key warning lists each reason once, without ".;"', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: undefined });
    const dry = await runCli(['sync', '--dry'], d, NO_CI);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /A real run would stop before translating: en:de: No OpenRouter API key \(OPENROUTER_API_KEY\); en:fr: No OpenRouter API key \(OPENROUTER_API_KEY\)\./);
    assert.doesNotMatch(dry.out, /\.;/);
  });
});

describe('Round 8 — i18next: CI fails fast and says why', () => {
  it('10: a missing secret in CI: the error line is not empty, and it says to add the repository secret', async () => {
    const d = nextApp({ defaultMethod: 'llm', model: undefined });
    const r = await runCli(['sync'], d, { CI: 'true', GITHUB_ACTIONS: 'true' });
    assert.equal(r.code, 1, r.out);
    assert.match(r.stderr, /\[ERR\] sync failed: cannot start translating — the llm method is not ready for en:de, en:fr: No OpenRouter API key \(OPENROUTER_API_KEY\)\./);
    assert.match(r.stderr, /In CI: add a repository secret named OPENROUTER_API_KEY and pass it to the sync step \(env: OPENROUTER_API_KEY: \$\{\{ secrets\.OPENROUTER_API_KEY \}\}\)\./);
    // Off CI the shell advice stands alone.
    const local = await runCli(['sync'], d, NO_CI);
    assert.doesNotMatch(local.stderr, /repository secret/);
  });

  it('12: a "local" config with no server answering fails the real run in CI even when nothing is queued; a dry run there only warns', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    const d = nextApp();
    try {
      // Translated while the server ran: nothing is queued afterwards.
      assert.equal((await runCli(['sync'], d, { LOCAL_API_BASE: model.url, ...NO_CI })).code, 0);
    } finally {
      await model.close();
    }
    const dead = { LOCAL_API_BASE: 'http://127.0.0.1:9/v1' };
    const ci = await runCli(['sync'], d, { ...dead, CI: 'true' });
    assert.equal(ci.code, 1, ci.out);
    assert.match(ci.stderr, /the config uses the "local" method, and no model server answers at http:\/\/127\.0\.0\.1:9\/v1 \(from LOCAL_API_BASE\)\. A CI runner has no model server: pass --method llm/);
    // On the runner (Round 11: off CI, a run that sends nothing goes on with
    // a warning — round11-personas-e2e.test.js item 10).
    const dry = await runCli(['sync', '--dry'], d, { ...dead, CI: 'true' });
    assert.equal(dry.code, 0, 'a dry run is a preview');
    assert.match(dry.out, /Dry run only — the real sync would STOP here[\s\S]*no model server answers at http:\/\/127\.0\.0\.1:9\/v1/);
  });

  it('9: a locale with an extra plural key is never "[OK] 9/8 keys present"', async () => {
    const model = await startFakeModel((k, s) => `ES ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/common.json'), {
        title: 'My family cookbook', recipes_one: '{{count}} recipe', recipes_other: '{{count}} recipes',
      });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'm1', languages: ['es'],
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const es = path.join(d, 'public/locales/es/common.json');
      writeJSON(es, { ...readJSON(es), recipes_two: '{{count}} recetas' });
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /\[OK\] \d+\/\d+ keys present/);
      assert.match(v.out, /4 expected, 5 present \(1 extra: common::recipes_two\)/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 8 — Django: --strict and plural gaps say what they do', () => {
  it('13: verify --strict with a warning prints [FAIL], never an [OK] line, and exits 1', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = nextApp({ languages: ['fr'] });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // An extra key: a warning-free locale is OK; add a source echo (a warning).
      const fr = path.join(d, 'messages/fr.json');
      writeJSON(fr, { ...readJSON(fr), open: 'Open the settings page' });
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, v.out);
      assert.match(v.out, /Verification passed with 1 warning\(s\)/);
      const strict = await runCli(['verify', '--strict'], d, env);
      assert.equal(strict.code, 1, strict.out);
      assert.match(strict.out, /\[FAIL\] 1 warning\(s\) — --strict treats warnings as failures/);
      assert.doesNotMatch(strict.out, /Verification passed/);
    } finally {
      await model.close();
    }
  });

  it('14: a plural message left without an everyday form is a partial run (exit 2)', () => {
    assert.equal(computeExitCode({ totalProcessed: 3, totalPluralGaps: 1 }), 2);
    assert.equal(computeExitCode({ totalProcessed: 3, totalPluralGaps: 0 }), 0);
  });

  it('16: the gender guidance is shown (status, init) and chosen in the config — false sends none, a string replaces it', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = tmp('django-gender');
      writeJSON(path.join(d, 'messages/en.json'), { status: 'You are connected' });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const init = await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'm1'], d, env);
      assert.equal(init.code, 0, init.out);
      assert.match(init.out, /gender \(default\): When the user's gender is unknown, prefer écriture inclusive with the interpunct\/middle dot \(e\.g\., "Connecté·e"/);
      assert.match(init.out, /Gender guidance: "genderGuidance" in the config \(per language, or for all\) — false for none, or your own words\./);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /gender \(Champollion's default for this language; LLM methods\): When the user's gender is unknown, prefer écriture inclusive/);

      await runCli(['sync'], d, env);
      const lastSystem = () => model.calls.at(-1).system;
      assert.match(lastSystem(), /- Gender: French has grammatical gender .* écriture inclusive/);

      // Off: no gender instruction at all — and its own cache entries (asked again).
      setConfig(d, { languages: { fr: { register: 'formal-vous', genderGuidance: false } } });
      const before = model.calls.length;
      const off = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(off.code, 0, off.out);
      assert.equal(model.calls.length, before + 1, 'another prompt: not served from the earlier cache');
      assert.doesNotMatch(lastSystem(), /Gender|gender/);
      assert.match((await runCli(['status'], d, env)).out, /gender: no guidance \(set off in the config\)/);

      // Your own words.
      setConfig(d, { languages: { fr: { register: 'formal-vous', genderGuidance: 'Use the masculine generic.' } } });
      await runCli(['sync', '--redo', 'all'], d, env);
      assert.match(lastSystem(), /- Gender: Use the masculine generic\./);
      const json = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      assert.deepEqual(json.pairs.find(p => p.target === 'fr').genderGuidance, { source: 'config', text: 'Use the masculine generic.' });
    } finally {
      await model.close();
    }
  });
});

describe('Round 8 — researcher: a public file is never graded "Contamination: NONE"', () => {
  function project() {
    const d = tmp('corpus');
    write(path.join(d, 'data/stand-in.tsv'), 'Where is the station?\tGos lea stašuvdna?\nI like tea.\tMun liikon teai.\n');
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(d, 'data/stand-in.tsv'))).digest('hex');
    // A public card pinning the same built-corpus sha256 (fixture).
    writeJSON(path.join(d, 'cards/eval-eng-sme-fixture-dev-v1.json'), {
      id: 'eval-eng-sme-fixture-dev-v1', type: 'eval', name: 'Tatoeba eng→sme fixture',
      pair: { source: 'eng', target: 'sme' },
      source: { publisher: 'Tatoeba community', url: 'https://tatoeba.org', repo_url: 'https://example.org/en-se.zip', sha256: sha, license: 'CC-BY-2.0' },
      license: { spdx: 'CC-BY-2.0', commercial: true, redistribution: true },
      contamination: { risk: 'LOW', reasoning: 'fixture' },
    });
    return d;
  }
  const register = (d, extra = []) => runCli(['network', 'register-corpus', '--yes', '--name', 'Stand-in private set', '--pair', 'eng>sme',
    '--tier', 'local-only', '--license', 'proprietary', '--domain', 'conv', '--data', 'data/stand-in.tsv',
    '--cards-dir', 'cards', '--out', 'out', ...extra], d, NO_CI);

  it('17: a byte-identical copy of a public corpus is refused the NONE grade, naming the corpus; a stated risk is accepted and recorded', async () => {
    const d = project();
    const r = await register(d);
    assert.equal(r.code, 1, r.out);
    assert.match(r.stderr, /data\/stand-in\.tsv is a byte-identical copy of the public corpus eval-eng-sme-fixture-dev-v1 \(Tatoeba eng→sme fixture, CC-BY-2\.0; same sha256/);
    assert.match(r.stderr, /Register it as public \(--tier public — eval-eng-sme-fixture-dev-v1 already describes it\), use sentences that are genuinely private/);
    assert.match(r.stderr, /--contamination LOW/);
    assert.equal(fs.existsSync(path.join(d, 'out')), false, 'nothing written');

    const stated = await register(d, ['--contamination', 'LOW']);
    assert.equal(stated.code, 0, stated.out);
    const card = readJSON(path.join(d, 'out', fs.readdirSync(path.join(d, 'out')).find(f => f.endsWith('.json') && f.startsWith('eval-'))));
    assert.equal(card.contamination.risk, 'LOW');
    assert.match(card.contamination.reasoning, /byte-identical copy of the public corpus eval-eng-sme-fixture-dev-v1/);
  });

  it('17: a file no card pins registers as before (NONE is the author\'s statement)', async () => {
    const d = project();
    write(path.join(d, 'data/stand-in.tsv'), 'A sentence only we have.\tMin cealkámuš.\n');
    const r = await register(d);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Contamination: NONE/);
  });
});

describe('Round 8 — school + hospital', () => {
  it('18: register-corpus --list shows the id --license and --tier take beside each label', async () => {
    const r = await runCli(['network', 'register-corpus', '--list'], ROOT, NO_CI);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /pass the id to --license/);
    assert.match(r.out, /1\. cc-by-4\.0\s+CC-BY-4\.0/);
    assert.match(r.out, /community-eval-grant-nc\s+Steward terms — evaluation only, non-commercial/);
    assert.match(r.out, /local-only\s+Private \/ local-only/);
  });

  it('19: init accepts a private-use code without a spelling warning and writes the display name', async () => {
    const d = tmp('hospital');
    writeJSON(path.join(d, 'messages/en.json'), { pain: 'Where does it hurt?' });
    const r = await runCli(['init', '--yes', '--langs', 'qaa', '--name', 'qaa=Ayta (variety not yet confirmed)'], d, NO_CI);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /check the spelling/);
    assert.match(r.out, /"qaa" is a private-use code \(ISO 639 keeps qaa–qtz for a variety with no confirmed code\): it has no language card/);
    assert.deepEqual(readJSON(path.join(d, 'champollion.config.json')).languages, { qaa: { name: 'Ayta (variety not yet confirmed)' } });
    const unnamed = tmp('hospital2');
    writeJSON(path.join(unnamed, 'messages/en.json'), { pain: 'Where does it hurt?' });
    const r2 = await runCli(['init', '--yes', '--langs', 'qaa'], unnamed, NO_CI);
    assert.match(r2.out, /Give it a name, which is what the model is told: --name qaa="<display name>"/);
    const bad = await runCli(['init', '--yes', '--force', '--langs', 'qaa', '--name', 'qab=Other'], unnamed, NO_CI);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /--name qab=…: qab is not one of the target languages/);
  });

  it('20: the sync names what the fallback produced, and status counts it per locale', async () => {
    const SENT = 'Le grand festin communautaire de notre école aura lieu ce soir';
    const model = await startFakeModel((k, s, { model: m }) => (m === 'fb-1' ? `FB ${s}` : s.length < 12 ? SENT : `FR ${s}`));
    try {
      const d = tmp('school');
      writeJSON(path.join(d, 'messages/en.json'), { greet: 'Welcome to the school website', feast: 'Feast' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1',
        languages: { fr: { fallback: { method: 'local', model: 'fb-1' } } },
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /\[FALLBACK\] en:fr — 1 key\(s\) the primary \(local\) could not translate safely → translated by local \(1 accepted, 0 still failing\) — keys: feast \(`champollion status` counts what each locale holds from the fallback\)/);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /from the fallback: 1 value\(s\) in the files \(feast\)/);
      const json = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      assert.equal(json.pairs[0].fallback.valuesInFiles, 1);
      assert.deepEqual(json.pairs[0].fallback.keys, ['feast']);
    } finally {
      await model.close();
    }
  });
});

describe('Round 8 — the CI guide (i18next + Django personas) and the build-MT guide (forge)', () => {
  const doc = (rel) => fs.readFileSync(new URL(`../website/docs/${rel}`, import.meta.url), 'utf8');

  it('11: every workflow in the CI guide gates with verify --strict, and says why', () => {
    const guide = doc('guides/ci-cd.md');
    const verifies = guide.match(/champollion@0\.5 verify[^\n]*/g) || [];
    assert.ok(verifies.length >= 3, 'the generic, Django and gate workflows');
    for (const v of verifies) assert.match(v, /verify --strict$/, v);
    assert.match(guide, /Plain verify passes on warnings\n\s+# — an extra or missing plural form/);
  });

  it('15: the Django workflow sets the settings environment for the whole job (compilemessages imports it too)', () => {
    const guide = doc('guides/ci-cd.md');
    const at = guide.indexOf('i18n-sync.yml (Django)');
    const wf = guide.slice(at, guide.indexOf('```', at + 40));
    const job = wf.slice(wf.indexOf('jobs:'), wf.indexOf('steps:'));
    // Round 10: the settings module is commented out (a standard manage.py
    // sets it; a copied value overrides it and breaks makemessages).
    assert.match(job, /env:\n\s+# DJANGO_SETTINGS_MODULE: myproject\.settings {3}# only if your manage\.py does not set it\n\s+SECRET_KEY: makemessages-only/);
    assert.equal((wf.match(/DJANGO_SETTINGS_MODULE:/g) || []).length, 1, 'named once, not on one step');
  });

  it('21: the build-MT guide registers the test set with forge before any benchmark', () => {
    const guide = doc('build-mt-for-your-language.md');
    const step2 = guide.slice(guide.indexOf('## 2. Gather your data'), guide.indexOf('## 3. Measure the options'));
    // Round 9: register → leak-audit → one prereg per planned model, all
    // before step 3's first benchmark (the old order — baselines, then
    // predictions — guaranteed a PreregistrationInvalid refusal).
    const at = (s) => step2.indexOf(s);
    assert.ok(at('nmt-forge registry add project-test ../data/test.tsv --role test') > 0);
    assert.ok(at('nmt-forge leak-audit') > at('nmt-forge registry add project-test'));
    assert.ok(at('nmt-forge prereg new all-data') > at('nmt-forge leak-audit'));
    assert.match(step2, /forge_register_eval \{ "name": "project-test"/);
    assert.match(step2, /one preregistration per model you plan to\s+train/);
    const step3 = guide.slice(guide.indexOf('## 3. Measure the options'), guide.indexOf('## 4.'));
    assert.match(step3, /registered, screened and\s+preregistered with forge first/);
  });
});
