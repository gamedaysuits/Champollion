/**
 * The held-refusal rule in every lane (lib/locale-state.js holdState): what
 * the quality gate refused is remembered and not sent to the same model again
 * by a plain sync — Docusaurus UI strings (i18n/<locale>/*.json, recorded in
 * .champollion.lock like key-value keys) and pages translated whole
 * (contentSegmentation: "page", recorded in .champollion-content.lock). And a
 * Docusaurus `--redo keys:` served from the cache says so, as the key-value
 * path does.
 *
 * End to end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs). No network, no key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { shortSourceHash } from '../lib/locale-state.js';
import { parseContentFile } from '../lib/content.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-held-parity-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const lastJSON = (r) => JSON.parse(r.stdout.trim().split('\n').at(-1));
const setConfig = (d, patch) => {
  const file = path.join(d, 'champollion.config.json');
  writeJSON(file, { ...readJSON(file), ...patch });
};

// ── Docusaurus UI strings ────────────────────────────────────────────────────
// A model that turns the short "Feast" into a whole sentence (refused: length
// inflation, on the first answer and the feedback retry alike); a second model
// and a fallback translate.
const SENT = 'Le grand festin communautaire de notre école aura lieu ce soir';
const forge = (k, s, { model }) => {
  if (model === 'fb-1') return `FB ${s}`;
  if (model === 'forge-2') return `F2 ${s}`;
  return s.length < 12 ? SENT : `FR ${s}`;
};
const uiCalls = (calls) => calls.filter(c => c.keys.some(k => k === 'nav.feast' || k === 'home.greet'));
const askedFeast = (calls) => calls.filter(c => c.keys.includes('nav.feast'));

function docuSite(extra = {}) {
  const d = tmp('docu');
  writeJSON(path.join(d, 'i18n/en/code.json'), {
    'home.greet': { message: 'Welcome to the documentation site' },
    'nav.feast': { message: 'Feast' },
  });
  writeJSON(path.join(d, 'champollion.config.json'), {
    format: 'docusaurus', inputLocale: 'en', localesDir: 'i18n', defaultMethod: 'local', model: 'forge-1', languages: ['fr'], ...extra,
  });
  return d;
}
const lockOf = (d) => readJSON(path.join(d, '.champollion.lock'));
const frCode = (d) => readJSON(path.join(d, 'i18n/fr/code.json'));

describe('Docusaurus UI strings: a string the gate refused is held back, as a key-value key is', () => {
  it('recorded per (file × id × locale); a plain sync sends nothing for it, says how to retry, exits 2; the estimate and a dry run agree', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = docuSite();
      const env = { LOCAL_API_BASE: model.url };

      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, `a refused string is not a clean pass\n${first.out}`);
      assert.match(first.out, /fr\/code\.json: key "nav\.feast" refused by the quality gate — held back from now on \(the next sync will not re-send it to local; see the summary\)/);
      assert.match(first.out, /1 key\(s\) are held back: .*To ask again, name them:/);
      assert.match(first.out, /`champollion sync --pair en:fr --redo keys:nav\.feast`/);
      const rec = lockOf(d).locales.fr.refused['docusaurus:code.json:nav.feast'];
      assert.equal(rec.source, shortSourceHash('Feast'), 'for the string\'s current source text');
      assert.deepEqual(rec.methods, ['local|forge-1|formal-vous|'], 'and the method key that refused it');
      assert.equal(lockOf(d).source['docusaurus:code.json:nav.feast'], undefined, 'not recorded as done');
      assert.equal(frCode(d)['home.greet'].message, 'FR Welcome to the documentation site');

      // A plain sync: nothing is sent — and it says which, why, and how to proceed.
      const before = model.calls.length;
      const second = await runCli(['sync'], d, env);
      assert.equal(model.calls.length, before, `nothing sent\n${second.out}`);
      assert.equal(second.code, 2, 'held back: not a clean pass, as for a key-value key');
      assert.match(second.out, /fr\/code\.json — 1 held back/);
      assert.match(second.out, /fr\/code\.json — 1 key\(s\) held back \(nav\.feast\): the quality gate refused local \(model forge-1\)'s translation of their current text on an earlier sync, so they are not sent again \(nothing billed; the cache is still read\)\. Ask again: `champollion sync --pair en:fr --redo keys:nav\.feast`; or fill them another way — a "fallback" method on the pair/);
      assert.match(second.out, /1 queued key\(s\) are held back — refused before by the same method, so not sent \(not billed\)/, 'the estimate does not price it');
      const json = lastJSON(await runCli(['sync', '--json'], d, env));
      assert.equal(json.totalHeld, 1);

      const dry = await runCli(['sync', '--dry'], d, env);
      assert.match(dry.out, /fr\/code\.json — 1 key\(s\) held back \(nav\.feast\)/);
      assert.match(dry.out, /No JSON key would be translated; 1 held back \(refused before; not sent, not billed\)/);
      assert.equal(model.calls.length, before, 'still nothing sent');

      // --redo keys: names it: asked again (and refused again: held again).
      const redo = await runCli(['sync', '--redo', 'keys:nav.feast'], d, env);
      assert.ok(askedFeast(model.calls.slice(before)).length > 0, `asked again\n${redo.out}`);
      assert.ok(lockOf(d).locales.fr.refused['docusaurus:code.json:nav.feast'], 'refused again: recorded again');
      const afterRedo = model.calls.length;
      await runCli(['sync'], d, env);
      assert.equal(model.calls.length, afterRedo, 'and the next plain sync holds it back again');
      // --fresh is an explicit retry too.
      await runCli(['sync', '--fresh'], d, env);
      assert.ok(askedFeast(model.calls.slice(afterRedo)).length > 0, '--fresh asks again');
    } finally {
      await model.close();
    }
  });

  it('lifted by a model change and by an edited source; a fallback added later gets it (the pair\'s method is not asked)', async () => {
    const model = await startFakeModel(forge);
    try {
      const env = { LOCAL_API_BASE: model.url };

      // Another model: asked again, and filled — the record is gone.
      const d = docuSite();
      await runCli(['sync'], d, env);
      setConfig(d, { model: 'forge-2' });
      let before = model.calls.length;
      const switched = await runCli(['sync'], d, env);
      assert.equal(switched.code, 0, switched.out);
      assert.deepEqual(askedFeast(model.calls.slice(before)).map(c => c.model), ['forge-2']);
      assert.equal(frCode(d)['nav.feast'].message, 'F2 Feast');
      assert.equal(lockOf(d).locales?.fr?.refused?.['docusaurus:code.json:nav.feast'], undefined, 'filled: the record is gone');

      // An edited source text: a new string, asked again.
      const e = docuSite();
      await runCli(['sync'], e, env);
      writeJSON(path.join(e, 'i18n/en/code.json'), {
        'home.greet': { message: 'Welcome to the documentation site' },
        'nav.feast': { message: 'The community feast' },
      });
      before = model.calls.length;
      const edited = await runCli(['sync'], e, env);
      assert.equal(edited.code, 0, edited.out);
      assert.ok(askedFeast(model.calls.slice(before)).length > 0, 'the edited string is sent');
      assert.equal(frCode(e)['nav.feast'].message, 'FR The community feast');
      assert.equal(lockOf(e).locales?.fr?.refused?.['docusaurus:code.json:nav.feast'], undefined);

      // A fallback added: only the fallback is asked for the held string.
      const f = docuSite();
      await runCli(['sync'], f, env);
      setConfig(f, { languages: { fr: { fallback: { method: 'local', model: 'fb-1' } } } });
      before = model.calls.length;
      const withFb = await runCli(['sync'], f, env);
      assert.equal(withFb.code, 0, withFb.out);
      assert.match(withFb.out, /fr\/code\.json — 1 key\(s\) go to the fallback \(local\) only: local had its translation refused before \(nav\.feast\)/);
      assert.deepEqual(askedFeast(model.calls.slice(before)).map(c => c.model), ['fb-1'], 'the fallback alone');
      assert.equal(frCode(f)['nav.feast'].message, 'FB Feast');
    } finally {
      await model.close();
    }
  });

  it('a string removed from the source drops its record', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = docuSite();
      const env = { LOCAL_API_BASE: model.url };
      await runCli(['sync'], d, env);
      assert.ok(lockOf(d).locales.fr.refused['docusaurus:code.json:nav.feast']);
      writeJSON(path.join(d, 'i18n/en/code.json'), { 'home.greet': { message: 'Welcome to the documentation site' } });
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.equal(lockOf(d).locales?.fr?.refused?.['docusaurus:code.json:nav.feast'], undefined);
    } finally {
      await model.close();
    }
  });
});

describe('Docusaurus --redo keys: served from the cache says so, as the key-value path does', () => {
  it('names the keys, says the model was not asked, and gives the --fresh command with its cost; --fresh asks', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = docuSite();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);

      const before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'keys:home.greet'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.equal(uiCalls(model.calls.slice(before)).length, 0, 'served from the cache: the model was not asked');
      assert.match(redo.out, /fr\/code\.json — 1 key\(s\) named for a redo were served from the cache, not asked again \(home\.greet\) — the file already holds that text: a redo re-checks and re-writes what the cache holds, at no cost\. To ask the model again: `champollion sync --pair en:fr --redo keys:home\.greet --fresh` \(sends 1 key\(s\) — \$0 API cost \(runs on this machine\)\)\./);

      const dry = await runCli(['sync', '--redo', 'keys:home.greet', '--dry'], d, env);
      assert.match(dry.out, /fr\/code\.json — 1 key\(s\) named for a redo would be served from the cache, not asked again \(home\.greet\)/);

      const fresh = await runCli(['sync', '--redo', 'keys:home.greet', '--fresh'], d, env);
      assert.equal(fresh.code, 0, fresh.out);
      assert.deepEqual(uiCalls(model.calls.slice(before)).map(c => c.keys), [['home.greet']], '--fresh asks the model');
      assert.doesNotMatch(fresh.out, /served from the cache, not asked again/);
    } finally {
      await model.close();
    }
  });
});

// ── Pages translated whole (contentSegmentation: "page") ─────────────────────
// The first model hollows the page (each word's first letter — the source
// with characters removed: refused as content deleted); another model and a
// fallback translate it.
const PAGE = '---\ntitle: "Getting started with the tool"\n---\n\n'
  + 'The science fair is on Friday, and every class will present a project to the families.\n\n'
  + 'Bring your parents and your friends, there will be food and music for everyone.\n';
const pager = (k, s, { model }) => {
  if (k === 'page') {
    if (model === 'forge-2' || model === 'fb-1') return `${model.toUpperCase()} ${s}`;
    return s.split(/\s+/).filter(Boolean).map(w => w[0]).join(' ');
  }
  return `FR ${s}`;
};
const pageCalls = (calls) => calls.filter(c => c.keys.includes('page'));

const lanes = {
  docusaurus: {
    make(extra = {}) {
      const d = tmp('docu-page');
      writeJSON(path.join(d, 'i18n/en/code.json'), { 'home.greet': { message: 'Welcome to the documentation site' } });
      write(path.join(d, 'docs/intro.md'), PAGE);
      writeJSON(path.join(d, 'champollion.config.json'), {
        format: 'docusaurus', inputLocale: 'en', localesDir: 'i18n', defaultMethod: 'local', model: 'forge-1', languages: ['fr'],
        contentSegmentation: 'page', ...extra,
      });
      return d;
    },
    file: 'docs/intro.md',
    record: 'refused:docusaurus:docs/intro.md:fr',
    target: (d) => path.join(d, 'i18n/fr/docusaurus-plugin-content-docs/current/intro.md'),
    source: (d) => path.join(d, 'docs/intro.md'),
  },
  contentDir: {
    make(extra = {}) {
      const d = tmp('content-page');
      writeJSON(path.join(d, 'messages/en.json'), { Nav: { greet: 'Welcome to the school website' } });
      write(path.join(d, 'newsletter/2026-10.md'), PAGE);
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'newsletter', languages: ['fr'],
        contentSegmentation: 'page', ...extra,
      });
      return d;
    },
    file: '2026-10.md',
    record: 'refused:2026-10.md:fr',
    target: (d) => path.join(d, 'newsletter/2026-10.fr.md'),
    source: (d) => path.join(d, 'newsletter/2026-10.md'),
  },
};
const contentLock = (d) => readJSON(path.join(d, '.champollion-content.lock'));

for (const [name, lane] of Object.entries(lanes)) {
  describe(`a page translated whole that the gate refused is held back (${name})`, () => {
    it('recorded by the body\'s hash and method key; a plain sync sends nothing of the page (front matter included) and does not write it; --redo files: asks again', async () => {
      const model = await startFakeModel(pager);
      try {
        const d = lane.make();
        const env = { LOCAL_API_BASE: model.url };
        const first = await runCli(['sync'], d, env);
        assert.equal(first.code, 2, first.out);
        assert.match(first.out, /content deleted/);
        assert.ok(first.out.includes(`Remembered: the next sync does not send it to local again — not billed again; \`champollion sync --pair en:fr --redo files:${lane.file}\` asks again.`), first.out);
        const rec = contentLock(d)[lane.record];
        assert.deepEqual(Object.keys(rec), ['page']);
        assert.equal(rec.page.source, shortSourceHash(parseContentFile(PAGE).body), 'keyed by the body text\'s hash');
        assert.deepEqual(rec.page.methods, ['local|forge-1|formal-vous|']);
        assert.equal(fs.existsSync(lane.target(d)), false, 'nothing written');

        const before = model.calls.length;
        const second = await runCli(['sync'], d, env);
        assert.equal(model.calls.length, before, `nothing of the page is sent\n${second.out}`);
        assert.equal(second.code, 2, second.out);
        assert.ok(second.out.includes(`${lane.file} → fr: 1 block(s)/field(s) held back (the whole page body) — the quality gate refused local's translation of their current text before; not sent, not billed. A page translated whole is not written (and nothing of it is sent) until it is filled. Ask again: \`champollion sync --pair en:fr --redo files:${lane.file}\``), second.out);
        assert.equal(fs.existsSync(lane.target(d)), false);
        const json = lastJSON(await runCli(['sync', '--json'], d, env));
        assert.deepEqual(json.content.heldBackItems, [{ file: lane.file, locale: 'fr', units: ['the whole page body'], pageNotWritten: true }]);
        const dry = await runCli(['sync', '--dry'], d, env);
        assert.match(dry.out, /the whole page body/);
        assert.equal(model.calls.length, before, 'still nothing sent');

        const redo = await runCli(['sync', '--redo', `files:${lane.file}`], d, env);
        assert.equal(pageCalls(model.calls.slice(before)).length, 1, `asked again\n${redo.out}`);
        const afterRedo = model.calls.length;
        await runCli(['sync'], d, env);
        assert.equal(model.calls.length, afterRedo, 'refused again: held again');
      } finally {
        await model.close();
      }
    });

    it('lifted by a model change and by an edited body; a fallback added later is asked alone', async () => {
      const model = await startFakeModel(pager);
      try {
        const env = { LOCAL_API_BASE: model.url };
        const d = lane.make();
        await runCli(['sync'], d, env);
        setConfig(d, { model: 'forge-2' });
        let before = model.calls.length;
        const switched = await runCli(['sync'], d, env);
        assert.equal(switched.code, 0, switched.out);
        assert.deepEqual(pageCalls(model.calls.slice(before)).map(c => c.model), ['forge-2']);
        assert.match(read(lane.target(d)), /FORGE-2\s+The science fair/);
        assert.equal(contentLock(d)[lane.record], undefined, 'filled: the record is gone');

        const e = lane.make();
        await runCli(['sync'], e, env);
        write(lane.source(e), PAGE.replace('every class', 'each class'));
        before = model.calls.length;
        await runCli(['sync'], e, env);
        assert.equal(pageCalls(model.calls.slice(before)).length, 1, 'the edited body is sent');

        const f = lane.make();
        await runCli(['sync'], f, env);
        setConfig(f, { languages: { fr: { fallback: { method: 'local', model: 'fb-1' } } } });
        before = model.calls.length;
        const withFb = await runCli(['sync'], f, env);
        assert.equal(withFb.code, 0, withFb.out);
        assert.deepEqual(pageCalls(model.calls.slice(before)).map(c => c.model), ['fb-1'], 'the fallback alone');
        assert.match(read(lane.target(f)), /FB-1\s+The science fair/);
        assert.equal(contentLock(f)[lane.record], undefined);
      } finally {
        await model.close();
      }
    });
  });
}
