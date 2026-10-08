/**
 * Markdown blocks and front-matter fields the quality gate refused are held
 * back, as refused keys are (lib/content-refusals.js) — and a Docusaurus
 * `--redo keys:` / `--force-keys` name that matches nothing fails with the
 * closest ids, as on the key-value path (lib/named-keys.js).
 *
 * End to end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs). No network, no key.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { computeExitCode } from '../lib/commands/sync.js';
import { billableContentChars, translatableBlockSources } from '../lib/content-estimate.js';
import { contentHolds, nextRefusals, blockUnit, fieldUnit } from '../lib/content-refusals.js';
import { shortSourceHash } from '../lib/locale-state.js';
import { GATE_VERSION } from '../lib/validate.js';
import { tmMethodKey } from '../lib/tm.js';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `refusals-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));

// A trained model that turns a short string into a whole sentence (refused:
// length inflation); a second model (the fallback) translates.
const SENT = 'Le grand festin communautaire de notre école aura lieu ce soir';
const forge = (k, s, { model }) => {
  const heading = /^#+ /.exec(s)?.[0] || '';
  const text = s.slice(heading.length);
  if (model === 'fb-1') return `${heading}FB ${text}`;
  if (model === 'forge-2') return `${heading}F2 ${text}`;
  return text.length < 12 ? `${heading}${SENT}` : `FR ${s}`;
};
/** The block-batch calls a run made, by model: each call's segment texts. */
const segmentCalls = (calls) => calls.filter(c => c.keys.some(k => k.startsWith('seg:')));
const sentFeast = (calls) => segmentCalls(calls).some(c => /⟦SEG_\d+⟧\n## Feast/.test(c.prompt));

// ── contentDir (a Markdown folder) ────────────────────────────────────────────
describe('content held back: a block the gate refused is not re-sent by a plain sync', () => {
  const NEWSLETTER = '---\ntitle: "October news"\n---\n\n## Feast\n\nThe science fair is on Friday, and every class will present a project to the families.\n';
  function school(cfg = {}) {
    const d = tmp('school');
    writeJSON(path.join(d, 'messages/en.json'), { Nav: { greet: 'Welcome to the school website' } });
    write(path.join(d, 'newsletter/2026-10.md'), NEWSLETTER);
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'newsletter', languages: ['fr'], ...cfg,
    });
    return d;
  }
  const page = (d) => read(path.join(d, 'newsletter/2026-10.fr.md'));
  const lock = (d) => readJSON(path.join(d, '.champollion-content.lock'));

  it('refused (also when asked again with the reason) → left in the source language, unmarked; the next sync sends nothing for it and says so; --redo files: and --redo content ask again', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = school();
      const env = { LOCAL_API_BASE: model.url };

      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, `a block left in the source language is not a clean pass\n${first.out}`);
      assert.equal(segmentCalls(model.calls).filter(c => /## Feast/.test(c.prompt)).length, 2, 'the heading was asked twice: once, then with the reason');
      assert.match(segmentCalls(model.calls).at(-1).prompt, /refused by an automatic quality check[\s\S]*Segment 0: length inflation/, 'the second ask says why');
      assert.match(first.out, /1 block\(s\) of 2026-10\.md refused by the quality gate, also when asked again with the reason — paragraph 1: length inflation/);
      assert.match(first.out, /The one the quality gate refused is remembered: the next sync does not send it to local again — not billed again; `champollion sync --pair en:fr --redo files:2026-10\.md` asks again\./);
      assert.match(page(d), /^## Feast$/m, 'the source text, no marker');
      assert.doesNotMatch(page(d), /\[EN\]/);
      assert.match(lock(d)['2026-10.md:fr'], /^pending:/, 'the lock says the page is pending');
      const rec = lock(d)['refused:2026-10.md:fr'];
      assert.deepEqual(Object.keys(rec), [blockUnit('## Feast')], 'recorded per file × block × locale');
      assert.equal(rec[blockUnit('## Feast')].source, shortSourceHash('## Feast'));
      assert.deepEqual(rec[blockUnit('## Feast')].methods, ['local|forge-1|formal-vous|'], 'with the method key that refused it');

      // A plain sync: nothing is sent for it — and it says how many, and how to proceed.
      const before = model.calls.length;
      const second = await runCli(['sync'], d, env);
      assert.equal(model.calls.length, before, `nothing sent (the paragraph and title come from the cache)\n${second.out}`);
      assert.equal(second.code, 2, 'held back: not a clean pass, as for a held-back key');
      assert.match(second.out, /2026-10\.md → fr: 1 block\(s\)\/field\(s\) held back \(paragraph 1\) — the quality gate refused local's translation of their current text before; not sent, not billed\. They stay in the source language \(unmarked\) until they are filled; the rest of the page is written\. Ask again: `champollion sync --pair en:fr --redo files:2026-10\.md`; or fill them another way — a "fallback" method on the pair/);
      assert.match(second.out, /1 content block\(s\)\/field\(s\) held back in 1 translation\(s\) .* `champollion sync --redo content`/);
      assert.match(page(d), /^## Feast$/m, 'the source text stays');
      const json = JSON.parse((await runCli(['sync', '--json'], d, env)).stdout.trim().split('\n').at(-1));
      assert.equal(json.content.heldBack, 1);
      assert.deepEqual(json.content.heldBackItems, [{ file: '2026-10.md', locale: 'fr', units: ['paragraph 1'] }]);
      assert.equal(model.calls.length, before, 'still nothing sent');

      // A dry run says what a real run holds back.
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.match(dry.out, /Would update: 2026-10\.fr\.md \(holding back paragraph 1: refused before — not sent; `champollion sync --pair en:fr --redo files:2026-10\.md` asks again\)/);

      // --redo files:<page> asks again (and the refusal is recorded again).
      const redo = await runCli(['sync', '--redo', 'files:2026-10.md'], d, env);
      assert.equal(model.calls.length, before + 2, `asked, then asked with the reason\n${redo.out}`);
      assert.ok(sentFeast(model.calls.slice(before)), 'the heading was asked again');
      assert.ok(lock(d)['refused:2026-10.md:fr'], 'refused again: held again');
      // --redo content (= --force-content) asks again too.
      const all = await runCli(['sync', '--redo', 'content'], d, env);
      assert.equal(model.calls.length, before + 4, all.out);
      assert.ok(sentFeast(model.calls.slice(before + 2)));
      // …and the next plain sync holds it back again.
      await runCli(['sync'], d, env);
      assert.equal(model.calls.length, before + 4);
    } finally {
      await model.close();
    }
  });

  it('a model change lifts the hold; a fallback added later gets it (the pair\'s method is not asked)', async () => {
    const model = await startFakeModel(forge);
    try {
      const env = { LOCAL_API_BASE: model.url };
      // Another model: asked again.
      const d = school();
      await runCli(['sync'], d, env);
      writeJSON(path.join(d, 'champollion.config.json'), { ...readJSON(path.join(d, 'champollion.config.json')), model: 'forge-2' });
      let before = model.calls.length;
      const switched = await runCli(['sync'], d, env);
      assert.equal(switched.code, 0, switched.out);
      assert.ok(segmentCalls(model.calls.slice(before)).some(c => c.model === 'forge-2' && /## Feast/.test(c.prompt)), 'sent to the new model');
      assert.match(page(d), /^## F2 Feast$/m);
      assert.equal(lock(d)['refused:2026-10.md:fr'], undefined, 'filled: the record is gone');

      // A fallback added: only the fallback is asked for the held block.
      const e = school();
      await runCli(['sync'], e, env);
      writeJSON(path.join(e, 'champollion.config.json'), {
        ...readJSON(path.join(e, 'champollion.config.json')), languages: { fr: { fallback: { method: 'local', model: 'fb-1' } } },
      });
      before = model.calls.length;
      const withFb = await runCli(['sync'], e, env);
      assert.equal(withFb.code, 0, withFb.out);
      const asked = segmentCalls(model.calls.slice(before));
      assert.deepEqual(asked.map(c => c.model), ['fb-1'], 'the fallback alone');
      assert.match(page(e), /^## FB Feast$/m);
      assert.equal(lock(e)['refused:2026-10.md:fr'], undefined);
    } finally {
      await model.close();
    }
  });

  it('a refused front-matter field keeps its source text and the page is written; the next sync sends nothing for it; --redo files: asks again', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = tmp('school-title');
      writeJSON(path.join(d, 'messages/en.json'), { Nav: { greet: 'Welcome to the school website' } });
      write(path.join(d, 'newsletter/2026-10.md'), '---\ntitle: "Feast"\n---\n\nThe science fair is on Friday, and every class will present a project to the families.\n');
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'newsletter', languages: ['fr'],
      });
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      assert.match(first.out, /front matter "title" kept in the source language — length inflation .*; asked again with that reason: length inflation/);
      assert.match(first.out, /Remembered: the next sync does not send it to local again — not billed again; `champollion sync --pair en:fr --redo files:2026-10\.md` asks again\./);
      assert.deepEqual(Object.keys(lock(d)['refused:2026-10.md:fr']), [fieldUnit('title')]);
      assert.match(read(path.join(d, 'newsletter/2026-10.fr.md')), /^title: "?Feast"?$/m, 'the page is written; the title keeps its source text');
      assert.match(read(path.join(d, 'newsletter/2026-10.fr.md')), /FR The science fair/);
      assert.match(lock(d)['2026-10.md:fr'], /^pending:/);

      const before = model.calls.length;
      const second = await runCli(['sync'], d, env);
      assert.equal(model.calls.length, before, `nothing of the page is sent\n${second.out}`);
      assert.equal(second.code, 2, second.out);
      assert.match(second.out, /2026-10\.md → fr: 1 block\(s\)\/field\(s\) held back \(front matter "title"\) .* They stay in the source language \(unmarked\) until they are filled; the rest of the page is written/);
      const json = JSON.parse((await runCli(['sync', '--json'], d, env)).stdout.trim().split('\n').at(-1));
      assert.deepEqual(json.content.heldBackItems, [{ file: '2026-10.md', locale: 'fr', units: ['front matter "title"'] }]);

      const redo = await runCli(['sync', '--redo', 'files:2026-10.md'], d, env);
      assert.ok(model.calls.slice(before).some(c => c.keys.includes('title')), `asked again\n${redo.out}`);
    } finally {
      await model.close();
    }
  });
});

// ── Docusaurus docs ───────────────────────────────────────────────────────────
function docusaurusSite() {
  const d = tmp('docu');
  writeJSON(path.join(d, 'i18n/en/code.json'), {
    'home.greet': { message: 'Welcome to the documentation site' },
    'home.bye': { message: 'See you next time, dear reader' },
  });
  write(path.join(d, 'docs/intro.md'), '---\ntitle: Getting started with the tool\n---\n\n## Feast\n\n'
    + 'The science fair is on Friday, and every class will present a project.\n');
  writeJSON(path.join(d, 'champollion.config.json'), {
    format: 'docusaurus', inputLocale: 'en', localesDir: 'i18n', defaultMethod: 'local', model: 'forge-1', languages: ['fr'],
  });
  return d;
}
const docuPage = (d) => read(path.join(d, 'i18n/fr/docusaurus-plugin-content-docs/current/intro.md'));

describe('content held back: the Docusaurus docs lane', () => {
  it('a refused block is left in the source language (no marker) and held by the next sync (nothing sent); --redo files:docs/intro.md asks again', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = docusaurusSite();
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, first.out);
      assert.match(first.out, /1 block\(s\) of docs\/intro\.md refused by the quality gate, also when asked again with the reason/);
      assert.match(first.out, /`champollion sync --pair en:fr --redo files:docs\/intro\.md` asks again/);
      assert.match(docuPage(d), /^## Feast$/m);
      assert.doesNotMatch(docuPage(d), /\[EN\]/);
      assert.match(readJSON(path.join(d, '.champollion-content.lock'))['docusaurus:docs/intro.md:fr'], /^pending:/);
      assert.ok(readJSON(path.join(d, '.champollion-content.lock'))['refused:docusaurus:docs/intro.md:fr']);

      const before = model.calls.length;
      const second = await runCli(['sync'], d, env);
      assert.equal(model.calls.length, before, `nothing sent\n${second.out}`);
      assert.equal(second.code, 2, second.out);
      assert.match(second.out, /docs\/intro\.md → fr: 1 block\(s\)\/field\(s\) held back \(paragraph 1\) .* not sent, not billed/);
      assert.match(docuPage(d), /^## Feast$/m);
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.match(dry.out, /\[DRY\] docs\/intro\.md → fr — would hold back paragraph 1 \(refused before; not sent\)/);

      const redo = await runCli(['sync', '--redo', 'files:docs/intro.md'], d, env);
      assert.ok(sentFeast(model.calls.slice(before)), `asked again\n${redo.out}`);
    } finally {
      await model.close();
    }
  });
});

describe('Docusaurus: a --redo keys: / --force-keys name that matches nothing fails, as on the key-value path', () => {
  it('no name matches: exit 1 with the closest ids, nothing sent', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = docusaurusSite();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const before = model.calls.length;
      for (const [args, flag] of [[['sync', '--force-keys', 'home.gret'], '--force-keys'], [['sync', '--redo', 'keys:home.gret'], '--redo keys:']]) {
        const r = await runCli(args, d, env);
        assert.equal(r.code, 1, r.out);
        assert.ok(r.out.includes(`${flag} names "home.gret", which matches no key in the source files — closest: \`home.greet\``), r.out);
        assert.match(r.out, /Nothing was translated or sent/);
      }
      assert.equal(model.calls.length, before, 'nothing was sent');
    } finally {
      await model.close();
    }
  });

  it('some names match: those are redone, then the run fails (exit 1) naming the rest — last, and in --json', async () => {
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const d = docusaurusSite();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const before = model.calls.length;
      const r = await runCli(['sync', '--redo', 'keys:home.greet,nope', '--fresh'], d, env);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /Redoing the 1 named key\(s\) that exist; the run then fails \(exit 1\) for the 1 that do not/);
      assert.deepEqual(model.calls.slice(before).filter(c => c.keys.some(k => k.startsWith('home.'))).map(c => c.keys), [['home.greet']],
        'the matching key — and only it — was asked again');
      assert.match(r.out.split('\n').filter(Boolean).at(-1), /--redo keys: names "nope", which matches no key in the source files \(and nothing close to it\)/, 'said last');
      const json = await runCli(['sync', '--redo', 'keys:home.greet,nope', '--json'], d, env);
      assert.equal(json.code, 1);
      const summary = JSON.parse(json.stdout.trim().split('\n').at(-1));
      assert.deepEqual(summary.unmatchedKeys, [{ name: 'nope', closest: [] }]);
    } finally {
      await model.close();
    }
  });
});

// ── The rule's parts ──────────────────────────────────────────────────────────
describe('content refusals: precedence, record and estimate', () => {
  const pair = { method: 'local', model: 'forge-1', target: 'fr' };
  const withFb = { ...pair, fallback: { method: 'local', model: 'fb-1', target: 'fr' } };
  const refused = (source, methods) => ({ [blockUnit(source)]: { source: shortSourceHash(source), methods, gate: GATE_VERSION } });

  it('held / fallback-only / send — and a redo, a new source or a new model sends it', () => {
    const rec = refused('## Feast', [tmMethodKey(pair)]);
    assert.equal(contentHolds(rec, pair).block('## Feast'), 'held');
    assert.equal(contentHolds(rec, withFb).block('## Feast'), 'fallback-only', 'a fallback that has not refused it gets it');
    assert.equal(contentHolds({ ...refused('## Feast', [tmMethodKey(pair), tmMethodKey(withFb.fallback)]) }, withFb).block('## Feast'), 'held');
    assert.equal(contentHolds(rec, pair, { redo: true }).block('## Feast'), 'send', 'named for a redo');
    assert.equal(contentHolds(rec, pair).block('## Feasts'), 'send', 'another source text');
    assert.equal(contentHolds(rec, { ...pair, model: 'forge-2' }).block('## Feast'), 'send', 'another model');
    const older = { [blockUnit('## Feast')]: { ...rec[blockUnit('## Feast')], gate: GATE_VERSION - 1 } };
    assert.equal(contentHolds(older, pair).block('## Feast'), 'send', 'refused by an earlier gate: asked again');
  });

  it('the record keeps what still applies, drops what was filled or whose source changed, merges methods', () => {
    const prior = { ...refused('## Feast', ['a']), ...refused('## Old', ['a']) };
    const next = nextRefusals(prior, {
      blockSources: ['## Feast', '## New'], fields: {},
      refused: [{ unit: blockUnit('## Feast'), source: '## Feast', methods: ['b'] }],
      filled: new Set(),
    });
    assert.deepEqual(Object.keys(next), [blockUnit('## Feast')], '## Old is gone from the page');
    assert.deepEqual(next[blockUnit('## Feast')].methods, ['a', 'b']);
    assert.equal(nextRefusals(prior, { blockSources: ['## Feast'], filled: new Set([blockUnit('## Feast')]) }), null, 'filled: nothing left');
  });

  it('the estimate prices nothing it will not send: a held block or field (the rest of the page is still sent)', () => {
    const body = '## Feast\n\nThe science fair is on Friday.\n';
    const tm = { _meta: { version: 1 } };
    const args = { tm, code: 'fr', tmKey: tmMethodKey(pair), fields: {}, body, segMode: 'block', blockSources: () => translatableBlockSources(body) };
    const all = billableContentChars(args).billedChars;
    const held = billableContentChars({ ...args, holds: contentHolds(refused('## Feast', [tmMethodKey(pair)]), pair) }).billedChars;
    assert.equal(all - held, '## Feast'.length);
    const title = { [fieldUnit('title')]: { source: shortSourceHash('Feast'), methods: [tmMethodKey(pair)], gate: GATE_VERSION } };
    assert.equal(billableContentChars({ ...args, fields: { title: 'Feast' }, holds: contentHolds(title, pair) }).billedChars, all, 'the title is not priced; the body is');
  });

  it('exit code: content held back or refused is a partial run (2), as for a key', () => {
    assert.equal(computeExitCode({ totalProcessed: 0, contentTranslated: 0, contentHeldBack: 1 }), 2);
    assert.equal(computeExitCode({ totalProcessed: 0, contentTranslated: 1, contentRefused: 1 }), 2);
    assert.equal(computeExitCode({ totalProcessed: 3, contentTranslated: 1 }), 0);
  });
});
