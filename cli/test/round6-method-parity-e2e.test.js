/**
 * Round 6 follow-ups, end to end through the real CLI (bin/cli.js) against a
 * tiny local model (test/fixtures/fake-openai-model.mjs). No network, no key.
 *
 *   1. Every LLM method sends the `llm` method's prompt: openai, anthropic,
 *      gemini and local used to drop the protected terms, the prompt context
 *      and the language's gender guidance (`sync --dry --show-prompt` shows
 *      what each one is sent).
 *   2. A model id is the method's own: an OpenRouter slug is mapped to the
 *      provider's name, or refused — never sent to a direct provider as is.
 *   3. Cached Markdown (front matter, blocks, whole bodies) goes through the
 *      same repeat check as cached keys.
 *   4. `status` prints no default model for a project whose methods run none.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { loadTM, storeTM, saveTM, tmMethodKey, lookupTM } from '../lib/tm.js';
import { getLanguageCard } from '../lib/registers.js';
import { parseContentFile } from '../lib/content.js';
import { OpenAIMethod } from '../lib/methods/openai.js';
import { AnthropicMethod } from '../lib/methods/anthropic.js';
import { GeminiMethod } from '../lib/methods/gemini.js';
import { LocalMethod } from '../lib/methods/local.js';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r6-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
// Short names Champollion USED to resolve — refused since the founder ruling of
// 2026-10-05 (exact slugs only, no aliasing); each maps to the slug the refusal names.
const RETIRED = readJSON(new URL('../../shared/retired-model-aliases.json', import.meta.url)).retired;

/** The requests a `sync --dry --json --show-prompt` run printed, as { url, model, system, user }. */
function requestsOf(stdout) {
  return stdout.trim().split('\n').filter(l => l.startsWith('{'))
    .map(l => JSON.parse(l)).filter(e => e.event === 'request')
    .map(({ request: { url, body } }) => {
      if (Array.isArray(body.contents)) {
        // Gemini: systemInstruction + contents; the model is in the URL.
        return {
          url,
          model: decodeURIComponent(url.split('/models/')[1].split(':')[0]),
          system: body.systemInstruction?.parts?.[0]?.text ?? null,
          user: body.contents[0].parts[0].text,
        };
      }
      const messages = body.messages || [];
      return {
        url,
        model: body.model,
        system: body.system ?? messages.find(m => m.role === 'system')?.content ?? null,
        user: messages.find(m => m.role === 'user')?.content ?? null,
      };
    });
}

/** A next-intl-style project with everything a prompt can carry. */
function promptProject() {
  const d = tmp('prompt');
  writeJSON(path.join(d, 'messages/en.json'), { home: { title: 'Welcome to Game Day Suits', cta_button: 'Open SuitBuilder' } });
  writeJSON(path.join(d, '.champollion/coaching/fr.json'), {
    grammar_rules: ['Use the vous form'], dictionary: { Welcome: 'Bienvenue' }, style_notes: 'Warm.',
  });
  write(path.join(d, 'coach.txt'), 'Prefer short words.');
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en',
    localesDir: 'messages',
    languages: { fr: { register: 'formal' } },
    promptContext: 'A sports-apparel shop app.',
    protectedTerms: ['Game Day Suits', 'SuitBuilder'],
    coachingFile: 'coach.txt',
  });
  return d;
}

// ── 1. One prompt, whichever LLM method runs it ─────────────────────────────
describe('Round 6 — every LLM method sends the llm method\'s prompt', () => {
  const FR_GENDER = getLanguageCard('fr')?.gender?.inclusiveGuidance;

  it('show-prompt: llm, local, openai, anthropic and gemini get one system message and one user message', async () => {
    const d = promptProject();
    const seen = {};
    for (const method of ['llm', 'local', 'openai', 'anthropic', 'gemini']) {
      const r = await runCli(['sync', '--dry', '--method', method, '--json', '--show-prompt'], d);
      assert.equal(r.code, 0, `${method}: ${r.out}`);
      const reqs = requestsOf(r.stdout);
      assert.equal(reqs.length, 1, `${method}: one request previewed\n${r.out}`);
      seen[method] = reqs[0];
    }
    const { system, user } = seen.llm;
    for (const method of ['local', 'openai', 'anthropic', 'gemini']) {
      assert.equal(seen[method].system, system, `${method}: the llm method's system message`);
      assert.equal(seen[method].user, user, `${method}: the llm method's user message`);
    }
    // What that one prompt carries.
    assert.match(system, /Keep these exactly as written wherever they appear: "Game Day Suits", "SuitBuilder"/);
    assert.match(system, /Context: A sports-apparel shop app\./);
    assert.match(system, /Register\/tone: /);
    assert.ok(FR_GENDER, 'the French card has gender guidance');
    assert.ok(system.includes(`- Gender: ${FR_GENDER}`), 'the language\'s gender guidance');
    assert.match(system, /Coaching guidance:\nPrefer short words\./);
    assert.doesNotMatch(system, /GRAMMAR RULES|Use the vous form/, 'structured coaching is llm-coached\'s');
    assert.match(user, /REQUIRED TERMINOLOGY \(use these exact translations\):\n {2}• "Welcome" → "Bienvenue"/);
    assert.match(user, /"home\.cta_button": button label — keep concise/);
  });

  it('llm-coached, on OpenRouter or a direct provider, sends that prompt plus its coaching — protected terms included', async () => {
    const d = promptProject();
    const plain = requestsOf((await runCli(['sync', '--dry', '--json', '--show-prompt'], d)).stdout)[0];
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    for (const provider of [null, 'openai']) {
      writeJSON(path.join(d, 'champollion.config.json'), {
        ...cfg, defaultMethod: 'llm-coached', ...(provider && { provider }),
      });
      const [req] = requestsOf((await runCli(['sync', '--dry', '--json', '--show-prompt'], d)).stdout);
      assert.ok(req.system.startsWith(plain.system), `${provider || 'openrouter'}: the plain prompt first`);
      assert.match(req.system, /--- COACHING CONTEXT ---\nGRAMMAR RULES \(follow strictly\):\n {2}• Use the vous form/);
      assert.equal(req.user, plain.user);
      if (provider) assert.match(req.url, /api\.openai\.com/);
    }
  });

  it('a plain method in a project with grammar rules is told, once, where they apply', async () => {
    const d = promptProject();
    const r = await runCli(['sync', '--dry', '--method', 'openai'], d);
    assert.match(r.out, /en:fr: the grammar rules and style notes in \.champollion\/coaching\/fr\.json are read by the llm-coached method only — openai is given its glossary, not them\. To use them: "method": "llm-coached", "provider": "openai"\./);
  });

  it('a real run through local: the model is sent the protected terms, the context and the gender guidance', async () => {
    const model = await startFakeModel((key, src) => `FR ${src}`);
    try {
      const d = promptProject();
      const r = await runCli(['sync', '--method', 'local', '--model', 'stub-1'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.equal(model.calls.length, 1);
      const { system, prompt } = model.calls[0];
      assert.match(system, /Keep these exactly as written wherever they appear: "Game Day Suits", "SuitBuilder"/);
      assert.match(system, /Context: A sports-apparel shop app\./);
      assert.ok(system.includes(`- Gender: ${FR_GENDER}`));
      assert.match(prompt, /"Welcome" → "Bienvenue"/);
    } finally {
      await model.close();
    }
  });
});

// ── 2. A model id is the method's own ───────────────────────────────────────
describe('Round 6 — a model id is the method\'s own, never an OpenRouter slug sent to a direct provider', () => {
  const sole = async (d, args, env = {}) => {
    const r = await runCli(['sync', '--dry', ...args, '--json', '--show-prompt'], d, env);
    return { r, req: requestsOf(r.stdout)[0] };
  };
  const project = (model) => {
    const d = promptProject();
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, ...(model && { model }) });
    return d;
  };

  it('a config model "google/…" with --method openai or anthropic is refused, naming a model that method runs', async () => {
    const d = project('google/gemini-2.5-flash');
    for (const [method, example] of [['openai', 'gpt-5.4-mini-2026-03-17'], ['anthropic', 'claude-sonnet-4-6']]) {
      const r = await runCli(['sync', '--dry', '--method', method], d);
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.out, new RegExp(`en:fr: model "google/gemini-2\\.5-flash" \\(from the top-level "model"\\) is an OpenRouter model id — ${method} calls`));
      assert.match(r.out, new RegExp(`\\(e\\.g\\. --model ${example}\\)`));
      assert.match(r.out, /--method gemini \(its name for it: "gemini-2\.5-flash"\) or --method llm to run it through OpenRouter/);
    }
    const st = await runCli(['status', '--method', 'openai'], d);
    assert.notEqual(st.code, 0, 'status refuses the same pair');
  });

  it('…and mapped where the provider has the model: gemini, openai, Anthropic\'s dotted versions', async () => {
    const d = project('google/gemini-2.5-flash');
    assert.equal((await sole(d, ['--method', 'gemini'])).req.model, 'gemini-2.5-flash');
    assert.equal((await sole(d, ['--method', 'openai', '--model', 'openai/gpt-5.5'])).req.model, 'gpt-5.5');
    assert.equal((await sole(d, ['--method', 'anthropic', '--model', 'anthropic/claude-haiku-4.5'])).req.model, 'claude-haiku-4-5');
    // An exact OpenRouter slug reaches OpenRouter as written.
    const llm = await sole(d, ['--method', 'llm', '--model', 'google/gemini-3.5-flash']);
    assert.equal(llm.req.model, 'google/gemini-3.5-flash');
    assert.match(llm.req.url, /openrouter\.ai/);
  });

  it('a retired alias is refused on every method, naming the exact slug it used to stand for (no aliasing)', async () => {
    const d = project('google/gemini-2.5-flash');
    const [gptAlias, gptId] = Object.entries(RETIRED).find(([, v]) => v.startsWith('openai/'));
    const [orAlias, orId] = Object.entries(RETIRED).find(([, v]) => v.startsWith('google/'));
    for (const [method, alias, id] of [['openai', gptAlias, gptId], ['llm', orAlias, orId], ['local', orAlias, orId]]) {
      const r = await runCli(['sync', '--dry', '--method', method, '--model', alias], d, { LOCAL_API_BASE: 'http://127.0.0.1:9/v1' });
      assert.notEqual(r.code, 0, r.out);
      assert.ok(r.out.includes(`"${alias}" (from --model) is not a model id — Champollion takes exact model slugs only, no aliases. Did you mean ${id}`), r.out);
      assert.equal(requestsOf(r.stdout).length, 0, 'nothing is sent');
    }
    // …and in the config file, named where it was written.
    const c = project(orAlias);
    const r = await runCli(['sync', '--dry'], c);
    assert.notEqual(r.code, 0, r.out);
    assert.ok(r.out.includes(`"${orAlias}" (from the top-level "model") is not a model id`), r.out);
    const cfg = readJSON(path.join(c, 'champollion.config.json'));
    writeJSON(path.join(c, 'champollion.config.json'), { ...cfg, model: 'google/gemini-3.5-flash', pairs: { 'en:fr': { method: 'llm', model: gptAlias } } });
    const p = await runCli(['sync', '--dry'], c);
    assert.notEqual(p.code, 0, p.out);
    assert.ok(p.out.includes(`en:fr: "${gptAlias}" (from pairs["en:fr"].model) is not a model id`), p.out);
  });

  it('a floating id (~vendor/…, …-latest) is refused: a run must say which model translated', async () => {
    const d = project(null);
    for (const [method, id] of [['llm', '~google/gemini-flash-latest'], ['llm', 'openai/gpt-chat-latest'], ['gemini', 'gemini-flash-latest'], ['local', 'llama3.1:latest']]) {
      const r = await runCli(['sync', '--dry', '--method', method, '--model', id], d, { LOCAL_API_BASE: 'http://127.0.0.1:9/v1' });
      assert.notEqual(r.code, 0, r.out);
      assert.ok(r.out.includes(`"${id}" (from --model) is a floating model id`), r.out);
    }
  });

  it('local and an OpenAI-compatible gateway get the id as written', async () => {
    const d = project(null);
    assert.equal((await sole(d, ['--method', 'local', '--model', 'Qwen/Qwen2.5-7B-Instruct'])).req.model, 'Qwen/Qwen2.5-7B-Instruct');
    const gw = await sole(d, ['--method', 'openai', '--model', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
      { OPENAI_BASE_URL: 'https://api.together.example/v1' });
    assert.equal(gw.req.model, 'meta-llama/Llama-3.3-70B-Instruct-Turbo');
    assert.match(gw.req.url, /^https:\/\/api\.together\.example\/v1\/chat\/completions/);
  });

  it('llm-coached on a direct provider: a pair\'s own slug is refused, naming where it was set', async () => {
    const d = project(null);
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    writeJSON(path.join(d, 'champollion.config.json'), {
      ...cfg, pairs: { 'en:fr': { method: 'llm-coached', provider: 'openai', model: 'google/gemini-2.5-flash' } },
    });
    const r = await runCli(['sync', '--dry'], d);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /en:fr: model "google\/gemini-2\.5-flash" \(from pairs\["en:fr"\]\.model\) is an OpenRouter model id — openai calls OpenAI directly/);
  });

  it('resolveModelId, per provider', () => {
    assert.equal(new OpenAIMethod().resolveModelId('openai/gpt-4o-mini'), 'gpt-4o-mini');
    assert.equal(new OpenAIMethod().resolveModelId('gpt-4o'), 'gpt-4o');
    assert.equal(new GeminiMethod().resolveModelId('google/gemini-2.5-pro'), 'gemini-2.5-pro');
    assert.equal(new AnthropicMethod().resolveModelId('claude-sonnet-4.6'), 'claude-sonnet-4-6');
    assert.equal(new LocalMethod().resolveModelId('google/gemini-2.5-flash'), 'google/gemini-2.5-flash');
    assert.throws(() => new GeminiMethod().resolveModelId('anthropic/claude-haiku-4.5'),
      (e) => e.code === 'CHAMPOLLION_MODEL_ROUTE' && /--method anthropic \(its name for it: "claude-haiku-4\.5"\)/.test(e.message));
    assert.throws(() => new OpenAIMethod().resolveModelId('openai/gpt-4o:free'), { code: 'CHAMPOLLION_MODEL_ROUTE' });
    // No aliasing, no floating ids — on the provider's own API, a gateway and local alike.
    assert.throws(() => new OpenAIMethod().resolveModelId('gpt'), { code: 'CHAMPOLLION_MODEL_ID' });
    assert.throws(() => new LocalMethod().resolveModelId('gemini-flash'), { code: 'CHAMPOLLION_MODEL_ID' });
    assert.throws(() => new AnthropicMethod().resolveModelId('claude-3-5-sonnet-latest'), { code: 'CHAMPOLLION_MODEL_ID' });
  });
});

// ── 3. Cached Markdown goes through the repeat check ────────────────────────
const S = 'Pemâmitonêyihtamân ê-wî-kiskêyihtamân anohc kîsikâw';
const PARAS = ['We open the shop on Monday morning.', 'Bring your own measuring tape to the fitting.', 'Every suit ships with a spare button.'];

describe('Round 6 — cached Markdown goes through the same repeat check as cached keys', () => {
  /** A Hugo-style content project: posts/a.md, pair en:fr on the local method. */
  function contentProject() {
    const d = tmp('content');
    writeJSON(path.join(d, 'messages/en.json'), { nav: { home: 'Home' } });
    write(path.join(d, 'posts/a.md'), `---\ntitle: "Opening week"\n---\n\n${PARAS.join('\n\n')}\n`);
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1', contentDir: 'posts',
    });
    const pc = [...resolvePairs(resolveConfig({}, d)).values()].find(p => p.target === 'fr');
    return { d, tmKey: tmMethodKey(pc) };
  }
  const translate = (key, src) => `FR ${src}`;
  const blockCalls = (model) => model.calls.filter(c => c.keys.some(k => k.startsWith('seg:')));

  it('three cached blocks holding one text are evicted and translated again', async () => {
    const model = await startFakeModel(translate);
    try {
      const { d, tmKey } = contentProject();
      const tm = loadTM(d);
      for (const p of PARAS) storeTM(tm, p, 'fr', tmKey, S);
      saveTM(d, tm);
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /a\.md → fr: cached paragraph 1, paragraph 2, paragraph 3 held the same text as other, different source strings .* removed from the cache and translated again/);
      assert.equal(blockCalls(model).length, 1);
      assert.equal(blockCalls(model)[0].keys.length, 3, 'all three blocks asked again');
      const fr = read(path.join(d, 'posts/a.fr.md'));
      assert.ok(!fr.includes(S), fr);
      for (const p of PARAS) assert.ok(fr.includes(`FR ${p}`));
      const after = loadTM(d);
      for (const p of PARAS) assert.equal(lookupTM(after, p, 'fr', tmKey), `FR ${p}`);
      assert.doesNotMatch((await runCli(['verify'], d)).out, /same text for different source strings/);
    } finally {
      await model.close();
    }
  });

  it('a page\'s cached title and blocks are checked as one batch: the repeat is asked again, the rest served', async () => {
    const model = await startFakeModel(translate);
    try {
      const { d, tmKey } = contentProject();
      const tm = loadTM(d);
      // The title and two paragraphs hold the sentence; the third is distinct.
      storeTM(tm, 'Opening week', 'fr', tmKey, S);
      storeTM(tm, PARAS[0], 'fr', tmKey, S);
      storeTM(tm, PARAS[1], 'fr', tmKey, S);
      storeTM(tm, PARAS[2], 'fr', tmKey, `FR ${PARAS[2]}`);
      saveTM(d, tm);
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /a\.md → fr: cached title, paragraph 1, paragraph 2 held the same text as other, different source strings/);
      const fr = read(path.join(d, 'posts/a.fr.md'));
      assert.ok(!fr.includes(S), `nothing of the repeat is written:\n${fr}\n${r.out}`);
      assert.ok(fr.includes(`FR ${PARAS[2]}`), 'the distinct cached block is still served');
      assert.match(fr, /title: "?FR Opening week"?/);
      const asked = model.calls.flatMap(c => c.keys);
      assert.ok(asked.includes('title'), `the title asked again: ${asked}`);
      assert.deepEqual(blockCalls(model).flatMap(c => c.keys), ['seg:0', 'seg:1'], 'only the two repeated blocks asked again');
      assert.doesNotMatch(r.out, /already written/, 'nothing of the group was written before the repeat showed');
    } finally {
      await model.close();
    }
  });

  it('a whole-body cache hit is checked block by block: evicted, and the page translated block by block', async () => {
    const model = await startFakeModel(translate);
    try {
      const { d, tmKey } = contentProject();
      const { body } = parseContentFile(read(path.join(d, 'posts/a.md')));
      const cachedBody = PARAS.reduce((text, p) => text.replace(p, S), body);
      const tm = loadTM(d);
      storeTM(tm, 'Opening week', 'fr', tmKey, 'Semaine d\'ouverture');
      storeTM(tm, body, 'fr', tmKey, cachedBody);
      saveTM(d, tm);
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /a\.md → fr: cached paragraph 1, paragraph 2, paragraph 3 held the same text/);
      const fr = read(path.join(d, 'posts/a.fr.md'));
      assert.ok(!fr.includes(S), fr);
      for (const p of PARAS) assert.ok(fr.includes(`FR ${p}`), fr);
      assert.notEqual(lookupTM(loadTM(d), body, 'fr', tmKey), cachedBody, 'the whole-body entry was evicted');
    } finally {
      await model.close();
    }
  });

  it('distinct cached content is served, nothing sent', async () => {
    const model = await startFakeModel(translate);
    try {
      const { d, tmKey } = contentProject();
      const tm = loadTM(d);
      storeTM(tm, 'Opening week', 'fr', tmKey, 'Semaine d\'ouverture');
      storeTM(tm, 'Home', 'fr', tmKey, 'Accueil');
      for (const p of PARAS) storeTM(tm, p, 'fr', tmKey, `FR ${p}`);
      saveTM(d, tm);
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.equal(model.calls.length, 0, r.out);
    } finally {
      await model.close();
    }
  });

  it('Docusaurus: cached blocks of a doc go through the check too', async () => {
    const model = await startFakeModel(translate);
    try {
      const d = tmp('docu');
      write(path.join(d, 'docusaurus.config.js'), 'module.exports = {};\n');
      writeJSON(path.join(d, 'i18n/en/code.json'), { a: { message: 'Hello there' } });
      write(path.join(d, 'docs/intro.md'), `---\ntitle: Intro\n---\n\n${PARAS.join('\n\n')}\n`);
      writeJSON(path.join(d, 'champollion.config.json'), {
        version: 3, inputLocale: 'en', localesDir: './i18n', languages: ['fr'], format: 'docusaurus', defaultMethod: 'local', model: 'stub-1',
      });
      const pc = [...resolvePairs(resolveConfig({}, d)).values()].find(p => p.target === 'fr');
      const tm = loadTM(d);
      for (const p of PARAS) storeTM(tm, p, 'fr', tmMethodKey(pc), S);
      saveTM(d, tm);
      // A local pair needs no OpenRouter key in the Docusaurus lane either
      // (it used to demand one for every pair); the key is removed outright.
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.match(r.out, /docs\/intro\.md → fr: cached paragraph 1, paragraph 2, paragraph 3 held the same text as other, different source strings/);
      const out = read(path.join(d, 'i18n/fr/docusaurus-plugin-content-docs/current/intro.md'));
      assert.ok(!out.includes(S), out);
      for (const p of PARAS) assert.ok(out.includes(`FR ${p}`), out);
    } finally {
      await model.close();
    }
  });
});

// ── 4. status: a default model only where one runs ──────────────────────────
describe('Round 6 — status prints no default model for pairs whose method runs none', () => {
  it('api-only: the endpoint instead; --json defaultModel null with the endpoints; an MT engine shows no model', async () => {
    const d = tmp('status');
    writeJSON(path.join(d, 'messages/en.json'), { a: 'Hello' });
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'messages', defaultMethod: 'api',
      languages: { fr: { endpoint: 'http://127.0.0.1:8765/translate' }, de: { endpoint: 'http://127.0.0.1:8765/translate' } },
    });
    const r = await runCli(['status'], d);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /Default model/);
    assert.match(r.out, /Endpoint: +http:\/\/127\.0\.0\.1:8765\/translate/);
    assert.doesNotMatch(r.out, /model: /);
    const j = JSON.parse((await runCli(['status', '--json'], d)).stdout);
    assert.equal(j.defaultModel, null);
    assert.deepEqual(j.endpoints, ['http://127.0.0.1:8765/translate']);
    assert.deepEqual(j.pairs.map(p => [p.model, p.endpoint]), [[null, 'http://127.0.0.1:8765/translate'], [null, 'http://127.0.0.1:8765/translate']]);

    const deepl = await runCli(['status', '--method', 'deepl'], d);
    // (Round 14: no "quality: Standard" from a default nobody set — the line ends at the method.)
    assert.match(deepl.out, /method: deepl\n/);
    assert.doesNotMatch(deepl.out, /Default model|model: auto/);
  });

  it('an LLM project still names its default model', async () => {
    const d = promptProject();
    const r = await runCli(['status'], d);
    assert.match(r.out, /Default model: \S+/);
    assert.match(r.out, /method: llm {2}\| {2}model: /);
  });
});
