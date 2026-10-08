/**
 * Editing a doc costs what changed, not the doc (founder, 2026-10-07: "not
 * cost me every time I update a doc — make sure this is using TM").
 *
 * Through the real CLI against an offline stand-in model that records every
 * request: a re-sync with nothing changed sends NOTHING; editing one
 * paragraph sends exactly that paragraph, once per language; editing one UI
 * string sends exactly that string. Both content lanes (a Docusaurus site and
 * a Markdown folder). A regression here is money, so it fails the release
 * (npm test runs before every publish).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';

const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const PARAS = [
  'The science fair is on Friday, and every class will present a project to the families.',
  'Parents can volunteer at the welcome desk; sign up at the office before Wednesday.',
  'Lunch will be served in the gym, and the library stays open until five.',
];
const page = (paras) => `---\ntitle: October news\n---\n\n## What is on\n\n${paras.join('\n\n')}\n`;
const translator = (k, s) => `FR ${s}`;
const segmentsIn = (calls) => calls.flatMap(c => [...c.prompt.matchAll(/⟦SEG_\d+⟧\n([^\n]*)/g)].map(m => m[1]));

for (const lane of ['docusaurus', 'markdown folder']) {
  describe(`TM: an unchanged re-sync is free, an edit costs only itself (${lane})`, () => {
    it('nothing changed → nothing sent; one paragraph edited → that paragraph alone, per language', async () => {
      const model = await startFakeModel(translator);
      try {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-cost-'));
        const docu = lane === 'docusaurus';
        const src = docu ? path.join(d, 'docs/news.md') : path.join(d, 'news/october.md');
        if (docu) {
          write(path.join(d, 'i18n/en/code.json'), JSON.stringify({ 'home.title': { message: 'Welcome to the school' }, 'home.more': { message: 'Read the newsletter' } }));
          write(path.join(d, 'champollion.config.json'), JSON.stringify({ format: 'docusaurus', inputLocale: 'en', localesDir: 'i18n', defaultMethod: 'local', model: 'forge-1', languages: ['fr', 'de'] }));
        } else {
          write(path.join(d, 'messages/en.json'), JSON.stringify({ home: { title: 'Welcome to the school', more: 'Read the newsletter' } }));
          write(path.join(d, 'champollion.config.json'), JSON.stringify({ inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'news', languages: ['fr', 'de'] }));
        }
        write(src, page(PARAS));
        const env = { LOCAL_API_BASE: model.url };

        const first = await runCli(['sync', '--no-verify'], d, env);
        assert.equal(first.code, 0, first.out);
        assert.ok(model.calls.length > 0);

        // 1. Nothing changed: not one request.
        let before = model.calls.length;
        const again = await runCli(['sync', '--no-verify'], d, env);
        assert.equal(again.code, 0, again.out);
        assert.equal(model.calls.length, before, `an unchanged re-sync sent ${model.calls.length - before} request(s)\n${again.out}`);

        // 2. One paragraph edited: only it is sent — once per language.
        const edited = 'Parents can volunteer at the welcome desk; sign up at the front office before Thursday.';
        write(src, page([PARAS[0], edited, PARAS[2]]));
        before = model.calls.length;
        const edit = await runCli(['sync', '--no-verify'], d, env);
        assert.equal(edit.code, 0, edit.out);
        const asked = segmentsIn(model.calls.slice(before));
        assert.deepEqual(asked.sort(), [edited, edited], `sent: ${JSON.stringify(asked)}`);
        // …and nothing else: no title, no other paragraph, no UI string.
        assert.equal(model.calls.slice(before).filter(c => !/⟦SEG_/.test(c.prompt)).length, 0,
          'only the edited paragraph was asked for');

        // 3. One UI string edited: only it is sent.
        if (docu) write(path.join(d, 'i18n/en/code.json'), JSON.stringify({ 'home.title': { message: 'Welcome to Riverside School' }, 'home.more': { message: 'Read the newsletter' } }));
        else write(path.join(d, 'messages/en.json'), JSON.stringify({ home: { title: 'Welcome to Riverside School', more: 'Read the newsletter' } }));
        before = model.calls.length;
        const ui = await runCli(['sync', '--no-verify'], d, env);
        assert.equal(ui.code, 0, ui.out);
        const uiCalls = model.calls.slice(before);
        assert.ok(uiCalls.every(c => !/⟦SEG_/.test(c.prompt)), 'no content block re-sent');
        assert.deepEqual(uiCalls.flatMap(c => c.keys).sort(), ['home.title', 'home.title'],
          'the edited string alone, once per language');
      } finally {
        await model.close();
      }
    });
  });
}
