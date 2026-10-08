/**
 * Round 9 synthetic personas (Next.js, i18next, Django, researcher, hospital,
 * the Cree school): what each run says must match what it does.
 *
 * End to end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs) where a model is needed, and a tiny
 * stand-in for the public corpus catalogue where one is read. No network, no
 * key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { costLabel, LOCAL_COST_LABEL } from '../lib/cost-label.js';
import { onCIRunner, secretNamesIn, ciSecretLine, missingKeyAdvice } from '../lib/missing-key.js';
import { preflightStopReason } from '../lib/cost-report.js';
import { SharedOutputIndex, sharedOutputItems } from '../lib/validate.js';
import { buildCorpusCard, resolveLicense, resolveTier } from '../lib/corpus-registration.mjs';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round9-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const setConfig = (d, patch) => {
  const file = path.join(d, 'champollion.config.json');
  writeJSON(file, { ...readJSON(file), ...patch });
};
/** A runner with none of the CI variables this machine may have set. */
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };
const summaryOf = (stdout) => stdout.trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } })
  .find(o => o && o.level === 'summary');

function nextApp(messages = { save: 'Save your changes', open: 'Open the settings page' }, cfg = {}) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), messages);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr', 'de'], ...cfg,
  });
  return d;
}

describe('Round 9 — Next.js: a dry run names what it means', () => {
  it('1: the "Changed" line names a few keys, and points at --list-keys when there are many', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const keys = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`k${i}`, `Source text number ${i}`]));
      const d = nextApp(keys);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'messages/en.json'), { ...keys, k1: 'Source text number one, edited' });
      const one = await runCli(['sync', '--dry'], d, env);
      assert.match(one.out, /Changed: 1 key\(s\) have updated source content: k1\n/);
      writeJSON(path.join(d, 'messages/en.json'), Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, `${v} (new)`])));
      const many = await runCli(['sync', '--dry'], d, env);
      assert.match(many.out, /Changed: 7 key\(s\) have updated source content \(k0, k1, k2, …\) — add --list-keys to name every queued key/);
      const listed = await runCli(['sync', '--dry', '--list-keys'], d, env);
      assert.match(listed.out, /Changed: 7 key\(s\) .* — each file lists its queued keys below/);
      assert.match(listed.out, /changed:\n\s+- k0/);
    } finally {
      await model.close();
    }
  });

  it('2: when the preflight would stop the real run, the --max-cost line says so — never "a real run would go ahead"', async () => {
    const d = nextApp(undefined, { defaultMethod: 'llm', model: undefined });
    const dry = await runCli(['sync', '--dry', '--max-cost', '5'], d, NO_CI);
    assert.equal(dry.code, 0, dry.out);
    assert.doesNotMatch(dry.out, /a real run would go ahead/);
    assert.match(dry.out, /--max-cost: the estimate is under the cap, but the run would stop earlier and exit 1: No OpenRouter API key \(OPENROUTER_API_KEY\) for en:de, en:fr\. Estimated cost: /);
    const json = summaryOf((await runCli(['sync', '--dry', '--max-cost', '5', '--json'], d, NO_CI)).stdout);
    assert.equal(json.maxCost.wouldStop, false);
    assert.equal(json.maxCost.exitCode, 1);
    assert.match(json.maxCost.stopsEarlier, /No OpenRouter API key/);
    assert.equal(json.preflight.ready, false);
    // With the key there, the line is what it was.
    assert.equal(preflightStopReason([]), null);
  });

  it('3: after a model change, the redo the note names carries its price', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `FR(${m}) ${s}`);
    try {
      const d = nextApp();
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const dry = await runCli(['sync', '--dry', '--model', 'm2'], d, env);
      assert.match(dry.out, /To re-translate them with it: `champollion sync --model m2 --redo all --fresh-on-model-change` \(sends up to 4 key\(s\) an earlier model wrote — \$0 API cost \(runs on this machine\); what this model already translated comes from the cache\)/);
    } finally {
      await model.close();
    }
  });

  it('4: one cost label for every surface (the MCP translate tool reads it from the package)', async () => {
    assert.equal(costLabel({ estimatedCost: 0, local: true }), LOCAL_COST_LABEL);
    assert.equal(LOCAL_COST_LABEL, '$0 API cost (runs on this machine)');
    assert.equal(costLabel({ estimatedCost: 0.0123 }), 'est. ~$0.0123');
    assert.equal(costLabel({ estimatedCost: null }), 'cost unknown — no published price');
    assert.equal(costLabel(null), 'cost unknown');
    const pkg = await import('../index.js');
    assert.equal(pkg.costLabel, costLabel, 'exported for the MCP server');
  });
});

describe('Round 9 — i18next: one missing-key message, CI-aware; dry-run counts add up; verify names its repair', () => {
  it('5: a real sync in CI gives the repository-secret line INSTEAD of export/.env.local, and counts one method on two pairs as one', async () => {
    const d = nextApp(undefined, { defaultMethod: 'llm', model: undefined });
    const ci = await runCli(['sync'], d, { CI: 'true', GITHUB_ACTIONS: 'true' });
    assert.equal(ci.code, 1, ci.out);
    assert.match(ci.stderr, /\[ERR\] sync failed: cannot start translating — the llm method is not ready for en:de, en:fr: No OpenRouter API key \(OPENROUTER_API_KEY\)\./);
    assert.doesNotMatch(ci.stderr, /methods are not ready/);
    assert.match(ci.stderr, /In CI: add a repository secret named OPENROUTER_API_KEY and pass it to the sync step/);
    assert.doesNotMatch(ci.stderr, /export OPENROUTER_API_KEY|\.env\.local/, 'no laptop advice on a runner');
    // Off CI: the shell advice, and no CI line.
    const local = await runCli(['sync'], d, NO_CI);
    assert.match(local.stderr, /export OPENROUTER_API_KEY/);
    assert.doesNotMatch(local.stderr, /repository secret/);
    // CI=false is not a CI runner.
    assert.equal(onCIRunner({ CI: 'false' }), false);
    assert.equal(onCIRunner({ GITHUB_ACTIONS: 'true' }), true);
  });

  it('5: two different methods are counted as two, each with its pairs', async () => {
    const d = nextApp(undefined, {
      defaultMethod: 'llm', model: undefined, pairs: { 'en:de': { method: 'deepl' } },
    });
    const r = await runCli(['sync'], d, NO_CI);
    assert.equal(r.code, 1, r.out);
    assert.match(r.stderr, /cannot start translating — 2 methods are not ready: deepl \(en:de\): No DeepL API key \(DEEPL_API_KEY\); llm \(en:fr\): No OpenRouter API key \(OPENROUTER_API_KEY\)\./);
  });

  it('5: the helper names every secret a reason names (a key pair; the canonical of an alias)', () => {
    assert.deepEqual(secretNamesIn(['No Lara credentials (LARA_ACCESS_KEY_ID + LARA_ACCESS_KEY_SECRET). Create …']),
      ['LARA_ACCESS_KEY_ID', 'LARA_ACCESS_KEY_SECRET']);
    assert.deepEqual(secretNamesIn(['No Google Translate API key (GOOGLE_TRANSLATE_API_KEY (or GOOGLE_API_KEY)).']), ['GOOGLE_TRANSLATE_API_KEY']);
    assert.match(ciSecretLine(['A_KEY', 'B_KEY']), /^In CI: add repository secrets named A_KEY and B_KEY and pass them to the sync step \(env: A_KEY: \$\{\{ secrets\.A_KEY \}\}, B_KEY:/);
    const help = ['  export X=…'];
    assert.deepEqual(missingKeyAdvice({ reasons: ['No key (X_KEY).'], setupHelp: help, env: { CI: 'true' } }),
      ['  In CI: add a repository secret named X_KEY and pass it to the sync step (env: X_KEY: ${{ secrets.X_KEY }}).']);
    assert.deepEqual(missingKeyAdvice({ reasons: ['No key (X_KEY).'], setupHelp: help, env: {} }), help);
    // A reason that names no secret (a model server not answering) keeps the help on a runner too.
    assert.deepEqual(missingKeyAdvice({ reasons: ['no model server answers'], setupHelp: help, env: { CI: 'true' } }), help);
  });

  it('6: in a dry run --json, the per-language sentToModel and tmHits add up to the totals', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = nextApp({ a: 'Save your changes', b: 'Open the settings page' });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // One new key (sent), one changed key whose new text the cache holds for fr only.
      writeJSON(path.join(d, 'messages/en.json'), { a: 'Save your changes', b: 'Open the settings page', c: 'Close the window', d: 'Print the page' });
      const s = summaryOf((await runCli(['sync', '--dry', '--json'], d, env)).stdout);
      assert.equal(s.sentToModel, 4);
      assert.equal(s.locales.reduce((n, l) => n + l.sentToModel, 0), s.sentToModel);
      assert.equal(s.locales.reduce((n, l) => n + l.tmHits, 0), s.tmHits);
      for (const l of s.locales) assert.equal(l.sentToModel, 2, JSON.stringify(l));
    } finally {
      await model.close();
    }
  });

  it('7: a missing plural form names the command that fills it; many missing keys name the pair\'s sync', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/common.json'), {
        title: 'My family cookbook', count_one: '{{count}} recipe', count_other: '{{count}} recipes',
      });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'm1', languages: ['fr'],
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const fr = path.join(d, 'public/locales/fr/common.json');
      const { count_many: _many, ...rest } = readJSON(fr);
      writeJSON(fr, rest);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1, v.out);
      assert.match(v.out, /1 missing key\(s\): count_many — fix: `champollion sync --pair en:fr --redo keys:common::count_many`/);
      // Repairs it.
      const fix = await runCli(['sync', '--pair', 'en:fr', '--redo', 'keys:common::count_many'], d, env);
      assert.equal(fix.code, 0, fix.out);
      assert.ok('count_many' in readJSON(fr));
      // Many missing: the pair's sync.
      writeJSON(fr, {});
      const many = await runCli(['verify'], d, env);
      assert.match(many.out, /3 missing key\(s\): title, count_one, count_many.* — fix: `champollion sync --pair en:fr`|4 missing key\(s\)/);
    } finally {
      await model.close();
    }
  });
});

// ── Django: a marked plural gap keeps every sync at exit 2 ───────────────────
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

describe('Round 9 — Django: a plural gap left in a catalog is a partial run on every sync', () => {
  it('8: first sync and re-sync both exit 2 and say why with the repair; the closing verify line is never [OK]', async () => {
    let full = false;
    const model = await startFakeModel((key, src) => {
      if (src.startsWith('{n, plural')) {
        return full
          ? '{n, plural, one {Один файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}'
          : '{n, plural, one {Один файл} other {%(count)d файлов}}';
      }
      return `Привет ${src.length}`;
    });
    try {
      const d = tmp('django');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['init', '--yes', '--langs', 'ru', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, first.out);
      assert.doesNotMatch(first.out, /\[OK\] Verification passed/);
      assert.match(first.out, /Verification: the files are structurally intact \(1 warning\(s\), listed above\), but this sync is incomplete — 1 plural message\(s\) without a form the language uses for ordinary counts/);

      const again = await runCli(['sync'], d, env);
      assert.equal(again.code, 2, again.out);
      assert.match(again.out, /ru\/LC_MESSAGES\/django\.po: 1 plural message\(s\) still lack a form ru uses for ordinary counts — the "other" form stands in \(marked "# champollion:" in ru\/LC_MESSAGES\/django\.po\): "One file" \(few, many\)\. Every sync exits 2 while they remain/);
      assert.match(again.out, /`champollion sync --pair en:ru --redo 'keys:django::One file' --fresh`/);
      assert.match(again.out, /Synced 0 key\(s\); 1 plural message\(s\) lack a form the language uses for ordinary counts/);
      assert.doesNotMatch(again.out, /\[OK\] Verification passed/);
      const json = summaryOf((await runCli(['sync', '--json'], d, env)).stdout);
      assert.equal(json.totalPluralGaps, 1);
      assert.deepEqual(json.locales[0].pluralGaps, { 'django::One file': ['few', 'many'] });
      // A dry run says it too, and stays a preview (exit 0).
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.equal(dry.code, 0);
      assert.match(dry.out, /still lack a form ru uses .* A real sync exits 2 while they remain/);

      // Repaired: exit 0 again.
      full = true;
      const fixed = await runCli(['sync', '--pair', 'en:ru', '--redo', 'keys:django::One file', '--fresh'], d, env);
      assert.equal(fixed.code, 0, fixed.out);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
    } finally {
      await model.close();
    }
  });

  it('8: an ICU plural without an everyday form (JSON) holds the same way', async () => {
    const model = await startFakeModel((k, s) => (s.startsWith('{count, plural')
      ? '{count, plural, one {# файл} other {# файлов}}' : `Привет ${s.length}`));
    try {
      const d = nextApp({ files: '{count, plural, one {# file} other {# files}}', hello: 'Hello there' }, { languages: ['ru'] });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 2);
      const again = await runCli(['sync'], d, env);
      assert.equal(again.code, 2, again.out);
      assert.match(again.out, /ru\.json: 1 plural message\(s\) still lack a form ru uses for ordinary counts — the "other" form stands in: "files" \(few, many\)/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 9 — the CI guide: a protected main branch', () => {
  const guide = fs.readFileSync(new URL('../website/docs/guides/ci-cd.md', import.meta.url), 'utf8');

  it('9: a pull-request variant, when to use which, and why a rejected push is not billed twice', () => {
    const at = guide.indexOf('### A protected main branch: propose a pull request');
    assert.ok(at > 0, 'the section exists');
    const section = guide.slice(at, guide.indexOf('### gettext', at));
    assert.match(section, /pull-requests: write/);
    assert.match(section, /gh pr create --head "\$branch" --base "\$GITHUB_REF_NAME"/);
    assert.match(section, /git push --force origin "\$branch"/);
    assert.match(section, /\*\*When to use which\.\*\*/);
    assert.match(section, /the cache is saved before the commit step, even when a step fails/);
    assert.match(section, /peter-evans\/create-pull-request/);
    // The claim holds for the workflow it describes: the save comes before the commit, with if: always().
    const wf = guide.slice(guide.indexOf('```yaml title=".github/workflows/i18n-sync.yml"'));
    const save = wf.indexOf('- name: Save the translation cache');
    assert.ok(save > 0 && save < wf.indexOf('- name: Commit updated translations'));
    assert.match(wf.slice(save, save + 120), /if: always\(\)/);
  });

  it('8: the CI guide and the Django section say a marked plural gap keeps every sync at exit 2', () => {
    assert.match(guide, /Every sync exits `2` while such an entry is\nin a catalog — the one that writes it and every one after/);
    const django = fs.readFileSync(new URL('../website/docs/integrations/frameworks.md', import.meta.url), 'utf8');
    assert.match(django, /Every sync exits `2` while a marked entry is in the catalog, not only the sync that wrote it/);
  });
});

// ── Researcher + hospital: register-corpus ───────────────────────────────────
/** A stand-in for the public corpus catalogue (the `datasets` table over REST). */
async function startCatalogue(rows) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seen.push(url.pathname + url.search);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (url.pathname !== '/rest/v1/datasets') { res.end('[]'); return; }
    const id = url.searchParams.get('id');
    if (id) { res.end(JSON.stringify(rows.filter(r => `eq.${r.id}` === id))); return; }
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 1000);
    res.end(JSON.stringify(rows.slice(offset, offset + limit).map(r => ({ id: r.id, sha256: r.sha256 }))));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

describe('Round 9 — researcher: a comparison that was not made is never "Contamination: NONE"', () => {
  function project() {
    const d = tmp('corpus');
    write(path.join(d, 'data/stand-in.tsv'), 'Where is the station?\tGos lea stašuvdna?\nI like tea.\tMun liikon teai.\n');
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(d, 'data/stand-in.tsv'))).digest('hex');
    return { d, sha };
  }
  // --cards-dir to a folder that does not exist: an npm install (no corpora cards).
  const register = (d, env, extra = []) => runCli(['network', 'register-corpus', '--yes', '--name', 'Stand-in private set', '--pair', 'eng>sme',
    '--tier', 'local-only', '--license', 'proprietary', '--domain', 'conv', '--data', 'data/stand-in.tsv',
    '--cards-dir', 'no-cards-here', '--out', 'out', ...extra], d, { ...NO_CI, CHAMPOLLION_OFFLINE: '', ...env });
  const cardIn = (d) => readJSON(path.join(d, 'out', fs.readdirSync(path.join(d, 'out')).find(f => f.startsWith('eval-') && f.endsWith('.json'))));

  it('10: with no cards, the public catalogue is read; a byte-identical copy of a public benchmark is refused NONE (the sha never leaves)', async () => {
    const { d, sha } = project();
    const cat = await startCatalogue([
      { id: 'eval-eng-fin-tatoeba-dev-v1', name: 'Tatoeba eng→fin', license: 'CC-BY-2.0', sha256: 'a'.repeat(64) },
      { id: 'eval-eng-sme-tatoeba-dev-v1', name: 'Tatoeba eng→sme Development Corpus', license: 'CC-BY-2.0', sha256: sha },
    ]);
    try {
      const r = await register(d, { CHAMPOLLION_SUPABASE_URL: cat.url });
      assert.equal(r.code, 1, r.out);
      assert.match(r.stderr, /data\/stand-in\.tsv is a byte-identical copy of the public corpus eval-eng-sme-tatoeba-dev-v1 \(Tatoeba eng→sme Development Corpus, CC-BY-2\.0; same sha256 [0-9a-f]{12}…, found in the public corpus catalogue \(2 checksums\)\)/);
      assert.match(r.stderr, /--contamination MEDIUM/);
      assert.equal(fs.existsSync(path.join(d, 'out')), false, 'nothing written');
      assert.ok(cat.seen.every(q => !q.includes(sha)), 'the file\'s sha256 is never sent');
      // A stated exposure is accepted and recorded.
      const stated = await register(d, { CHAMPOLLION_SUPABASE_URL: cat.url }, ['--contamination', 'medium']);
      assert.equal(stated.code, 0, stated.out);
      assert.equal(cardIn(d).contamination.risk, 'MEDIUM');
      assert.match(cardIn(d).contamination.reasoning, /byte-identical copy of the public corpus eval-eng-sme-tatoeba-dev-v1/);
    } finally {
      await cat.close();
    }
  });

  it('10: compared and not found: NONE, said as compared', async () => {
    const { d } = project();
    const cat = await startCatalogue([{ id: 'eval-eng-fin-tatoeba-dev-v1', name: 'x', license: 'CC-BY-2.0', sha256: 'b'.repeat(64) }]);
    try {
      const r = await register(d, { CHAMPOLLION_SUPABASE_URL: cat.url });
      assert.equal(r.code, 0, r.out);
      assert.equal(cardIn(d).contamination.risk, 'NONE');
      assert.match(r.out, /Contamination: NONE {2}\(compared with the public corpus catalogue \(1 checksums\): no public copy of this file — the grade is your statement\)/);
    } finally {
      await cat.close();
    }
  });

  it('10: offline (or unreachable): UNCHECKED with the reason, never NONE; --contamination none is your statement', async () => {
    for (const env of [{ CHAMPOLLION_OFFLINE: '1' }, { CHAMPOLLION_SUPABASE_URL: 'http://127.0.0.1:9' }]) {
      const { d } = project();
      const r = await register(d, env);
      assert.equal(r.code, 0, r.out);
      const card = cardIn(d);
      assert.equal(card.contamination.risk, 'UNCHECKED', JSON.stringify(env));
      assert.match(card.contamination.reasoning, /Not graded: data\/stand-in\.tsv could not be compared with the public corpora at registration \(this install ships no corpora cards, and /);
      assert.match(r.out, /Contamination: UNCHECKED {2}\(not compared with the public corpora — this install ships no corpora cards, and (offline \(CHAMPOLLION_OFFLINE=1\)|the public catalogue could not be read)/);
      assert.doesNotMatch(r.out, /Contamination: NONE/);
    }
    const { d } = project();
    const stated = await register(d, { CHAMPOLLION_OFFLINE: '1' }, ['--contamination', 'none']);
    assert.equal(stated.code, 0, stated.out);
    assert.equal(cardIn(d).contamination.risk, 'NONE');
    assert.match(stated.out, /Contamination: NONE {2}\(not compared with the public corpora — .* — the grade is your statement\)/);
    assert.match(cardIn(d).contamination.reasoning, /Stated at registration \(NONE\); data\/stand-in\.tsv was not compared with the public corpora/);
  });
});

describe('Round 9 — hospital: the card says what registration did', () => {
  it('11: a local-only card with --data says the text was read here to count and checksum it; --role test stores the size under test', async () => {
    const d = tmp('hospital');
    write(path.join(d, 'data/ward.tsv'), 'Where does it hurt?\tSaan masakit?\nTake this twice a day.\tInumin ito dalawang beses.\n');
    const r = await runCli(['network', 'register-corpus', '--yes', '--name', 'Ward phrases', '--pair', 'eng>tgl', '--role', 'test',
      '--tier', 'local-only', '--license', 'proprietary', '--domain', 'medical', '--data', 'data/ward.tsv', '--out', 'out',
      '--contamination', 'none'], d, { ...NO_CI, CHAMPOLLION_OFFLINE: '1' });
    assert.equal(r.code, 0, r.out);
    const card = readJSON(path.join(d, 'out', fs.readdirSync(path.join(d, 'out')).find(f => f.endsWith('-test-v1.json'))));
    assert.doesNotMatch(card._provenance.populatedFrom, /never read/);
    assert.match(card._provenance.populatedFrom, /the text was read on this machine only to count its entries and compute its sha256; none of it was uploaded or hosted, and none of it left the machine/);
    assert.deepEqual(card.test, { size: 2, sizeUnit: 'entries', domain: 'medical' });
    assert.equal(card.dev, undefined, 'a test set is not filed under dev');
    assert.match(r.out, /Size\/domain: {2}2 entries · medical \(test split\)/);
  });

  it('11: without --data nothing was read; a dev (or unstated) role stays under dev', () => {
    const base = {
      id: 'eval-eng-tgl-x-v1', name: 'x', pair: { source: 'eng', target: 'tgl' }, publisher: 'p', description: 'd',
      licenseOption: resolveLicense('proprietary'), tier: resolveTier('private'), size: 3, domain: 'medical', addedAt: '2026-10-04',
    };
    const plain = buildCorpusCard(base);
    assert.match(plain._provenance.populatedFrom, /corpus content was never read, uploaded, or hosted/);
    assert.equal(plain.dev.size, 3);
    assert.equal(buildCorpusCard({ ...base, role: 'dev' }).dev.size, 3);
    assert.equal(buildCorpusCard({ ...base, role: 'test' }).test.size, 3);
  });
});

describe('Round 9 — the Cree school: a memorized sentence is one output across keys and Markdown', () => {
  const MEM = 'Mani nasisa kaka mamama miko sisisa mamama sani mamama.';

  it('12: placeholders are not words of the output, and a sentence inside a paragraph meets the same sentence answering a key', () => {
    assert.equal(SharedOutputIndex.outputForm(`${MEM} {name}!`), SharedOutputIndex.outputForm(MEM));
    assert.equal(SharedOutputIndex.outputForm('S %(count)d <b>x</b> {{n}}'), 's x');
    // An unsplit plural keeps its branches.
    assert.match(SharedOutputIndex.outputForm('{n, plural, one {un} other {des}}'), /plural one un other des/);
    const idx = new SharedOutputIndex();
    const suspects = idx.suspects([
      ...sharedOutputItems('Forms.thanks', 'Thank you, {name}!', `${MEM} {name}!`),
      { key: 'content:2026-10.md#3', source: 'The elders visit the class tomorrow. Please bring the forms.', value: `Masi kaka mamama kope towape mamama. ${MEM}` },
    ]);
    assert.deepEqual([...suspects.keys()].sort(), ['Forms.thanks', 'content:2026-10.md#3']);
    // A sentence two paragraphs genuinely share is one source: not suspect.
    const legit = new SharedOutputIndex().suspects([
      { key: 'a', source: 'Classes start Monday. Please bring the forms.', value: 'Les cours commencent lundi. Veuillez apporter les formulaires.' },
      { key: 'b', source: 'Field trip on Friday. Please bring the forms.', value: 'Sortie scolaire vendredi. Veuillez apporter les formulaires.' },
    ]);
    assert.equal(legit.size, 0);
  });

  it('12: sync refuses the paragraph that repeats a key\'s memorized sentence, and verify names both', async () => {
    const model = await startFakeModel((k, s) => {
      if (/^Thank you/.test(s)) return `${MEM} {name}!`;
      if (/Please bring the forms/.test(s)) return `Masi kaka mamama kope towape mamama. ${MEM}`;
      return `CR ${s}`;
    });
    try {
      const d = tmp('school');
      writeJSON(path.join(d, 'messages/en.json'), { thanks: 'Thank you, {name}!', home: 'Welcome, families' });
      write(path.join(d, 'newsletter/2026-10.md'), '# October at our school\n\nThe elders visit the class tomorrow. Please bring the forms.\n');
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1', contentDir: 'newsletter',
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const r = await runCli(['sync'], d, env);
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.out, /same output for 2 different source strings \("Thank you, \{name\}!", "Please bring the forms\."\)|came back for 2 different source string\(s\)/);
      const page = path.join(d, 'newsletter/2026-10.fr.md');
      assert.ok(!fs.existsSync(page) || !read(page).includes(MEM), 'the repeated sentence is not written into the newsletter');
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1, v.out);
      assert.match(v.out, /hold the (same text for different source strings|sentence an earlier sync caught the model repeating)/);
    } finally {
      await model.close();
    }
  });
});
