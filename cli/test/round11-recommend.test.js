/**
 * Round 11 synthetic users, item 14 (school persona, eng→crk), 2026-10-04.
 *
 * The MCP `language_overview` for Plains Cree suggested trying an open model
 * whose own model card declares crk (run_benchmark with method local-model),
 * while `champollion network recommend eng crk` named no model at all — the
 * overview chose it with its own copy of the selection rule. The selection now
 * lives here (lib/recommend.js declaredModelCandidates), read from the language
 * card's model-card claims through the CLI's card tier, and `recommend` lists
 * the candidates labelled for what they are: runnable here (the local-model
 * engine), with no published evidence — a claim to benchmark, never a
 * measurement. A candidate the pair's published rows name is labelled apart.
 *
 * The other surface (the MCP overview names the same candidates) is checked in
 * mcp-server/test/round11.test.js.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runCli } from './fixtures/fake-openai-model.mjs';
import { declaredModelCandidates, recommend, renderText } from '../lib/recommend.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round11-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const OFFLINE = { CHAMPOLLION_OFFLINE: '1', CHAMPOLLION_NO_UPDATE_CHECK: '1', CI: '', GITHUB_ACTIONS: '' };

/** A card whose model-card claims are the shape the atlas projects. */
const claim = (variant, extra = {}) => ({ value: 'open', variant, source: 'hf-models-test', confidence: 'model-card-declared', ...extra });
const CARD = {
  code: 'xyz',
  methodSupportEvidence: {
    total: 9,
    named: [
      { value: 'service', variant: 'google', source: 'curated' },
      claim('tilde', { confidence: 'partially-confirmed' }),
      claim('hf:org/model-a'),
      claim('hf:org/model-a-GGUF'),
      claim('hf:org/model-b-LoRA'),
      claim('hf:org/model-c'),
      claim('hf:org/model-d'),
      claim('hf:org/model-e'),
    ],
  },
};
const getCard = (code) => (code === 'xyz' ? CARD : null);

const MANIFEST = { entries: {
  'local-model': { kind: 'local-model', paradigm: 'neural-nmt', optional_extra: 'local-models',
    license: 'Per-model', commercialReady: false, runtimes: ['harness'] },
} };
const base = { manifest: MANIFEST, curated: null, bulk: null, reliability: null, coverage: null, cardSupport: null, env: {} };

describe('Round 11 — 14: the selection rule (one, in the CLI)', () => {
  it('Hugging Face ids local-model loads, in the card\'s order, at most three; services, non-hub ids and adapters/quantized exports are not candidates', () => {
    const d = declaredModelCandidates('xyz', { getCard });
    assert.equal(d.problem, null);
    assert.deepEqual(d.candidates.map((c) => c.id), ['org/model-a', 'org/model-c', 'org/model-d']);
    assert.equal(d.loadable, 4, 'model-e is loadable too, only past the three shown');
    assert.deepEqual(d.not_loadable, ['org/model-a-GGUF', 'org/model-b-LoRA']);
    assert.equal(d.declared_total, 9);
    assert.equal(d.listed, 7, 'the service listing is not a model claim');
    assert.deepEqual(d.candidates[0], { id: 'org/model-a', claim: 'model-card-declared', source: 'hf-models-test' });
  });

  it('no card, or a card with no claim, says so — never an empty list that reads as "none exist"', () => {
    assert.match(declaredModelCandidates('qqq', { getCard }).problem, /no language card for 'qqq'/);
    assert.match(declaredModelCandidates('xyz', { getCard: () => ({ code: 'xyz' }) }).problem, /records no model that declares it/);
  });
});

describe('Round 11 — 14: recommend lists them as runnable, with no published evidence', () => {
  const declared = declaredModelCandidates('xyz', { getCard });

  it('the payload joins each candidate to the engine that loads it and to the pair\'s evidence', () => {
    const p = recommend('eng', 'xyz', { ...base, declared });
    const d = p.declared_models;
    assert.equal(d.engine.method, 'local-model');
    assert.equal(d.engine.harness_only, true);
    for (const c of d.candidates) {
      assert.equal(c.runnable, true);
      assert.equal(c.published_evidence, false);
      assert.equal(c.run, `mt-eval run --method local-model --model ${c.id} --corpus <your test file>`);
    }
    const text = renderText(p);
    assert.match(text, /^Open models whose model card declares xyz \(9 declared, 7 named on the card — the publisher's claim, not a measurement\):$/m);
    assert.match(text, /^ {2}RUNNABLE, NO PUBLISHED EVIDENCE — via local-model \(harness-only; local engine — install extra 'local-models'\), in the card's order, not a ranking:$/m);
    assert.match(text, /^ {4}org\/model-a {3}\[model-card-declared; hf-models-test\]$/m);
    assert.match(text, /^ {4}\(\+1 more on the card in a format local-model loads/m);
    assert.match(text, /^ {4}try one: mt-eval run --method local-model --model org\/model-a --corpus <your test file>$/m);
    assert.match(text, /^ {2}not loadable by local-model by id \(an adapter, a quantized or ONNX export, or a CTranslate2 conversion\): org\/model-a-GGUF, org\/model-b-LoRA$/m);
    // Before the published evidence, never mixed into it.
    assert.ok(text.indexOf('Open models whose model card') < text.indexOf('Published evidence for this pair'));
  });

  it('a candidate the pair\'s published rows name is labelled apart from the unevidenced ones', () => {
    const p = recommend('eng', 'xyz', { ...base, declared,
      bulk: { models: ['org/model-c'], pairs: { 'eng-xyz': { flores: { chrf: [0, 30.1] } } } } });
    const byId = Object.fromEntries(p.declared_models.candidates.map((c) => [c.id, c]));
    assert.equal(byId['org/model-c'].published_evidence, true);
    assert.equal(byId['org/model-a'].published_evidence, false);
    const text = renderText(p);
    assert.match(text, /RUNNABLE, NO PUBLISHED EVIDENCE \/ RUNNABLE, PUBLISHED EVIDENCE ABOVE — via local-model/);
    assert.match(text, /^ {4}org\/model-c .*\(published evidence above\)$/m);
    assert.doesNotMatch(text.match(/^ {4}org\/model-a .*$/m)[0], /published evidence above/);
  });

  it('the commercial lane excludes them with local-model\'s reason; no local-model engine: declared, never "runnable"', () => {
    const commercial = renderText(recommend('eng', 'xyz', { ...base, declared, useContext: 'commercial' }));
    assert.match(commercial, /^ {2}EXCLUDED — local-model: excluded from the commercial lane — license: Per-model:$/m);
    assert.doesNotMatch(commercial, /RUNNABLE|try one:/);
    const p = recommend('eng', 'xyz', { ...base, declared, manifest: { entries: {} } });
    assert.equal(p.declared_models.engine, null);
    assert.ok(p.declared_models.candidates.every((c) => c.runnable === false && !('run' in c)));
    assert.match(renderText(p), /^ {2}DECLARED — no method in this registry loads them:$/m);
  });

  it('nothing to suggest is said with the reason', () => {
    const p = recommend('eng', 'qqq', { ...base, declared: declaredModelCandidates('qqq', { getCard }) });
    assert.match(renderText(p), /^Open models whose model card declares qqq: none to suggest \(no language card for 'qqq'\)\.$/m);
  });
});

describe('Round 11 — 14: `champollion network recommend eng crk` names the open models the crk card declares', () => {
  it('in text and in --json, read from the real crk card', async () => {
    const d = fs.mkdtempSync(path.join(ROOT, 'crk-'));
    const json = await runCli(['network', 'recommend', 'eng', 'crk', '--json'], d, OFFLINE);
    assert.equal(json.code, 0, json.out);
    const p = JSON.parse(json.stdout);
    const expected = declaredModelCandidates('crk');
    assert.equal(expected.problem, null, 'the crk card records model claims');
    assert.ok(expected.candidates.length > 0, 'the crk card names a model local-model loads');
    assert.deepEqual(p.declared_models.candidates.map((c) => c.id), expected.candidates.map((c) => c.id));
    assert.ok(p.declared_models.candidates.every((c) => c.runnable && !c.published_evidence));

    const text = await runCli(['network', 'recommend', 'eng', 'crk'], d, OFFLINE);
    assert.equal(text.code, 0, text.out);
    assert.match(text.stdout, /^Open models whose model card declares crk \(/m);
    assert.match(text.stdout, /RUNNABLE, NO PUBLISHED EVIDENCE — via local-model/);
    for (const c of expected.candidates) {
      assert.match(text.stdout, new RegExp(`^ {4}${c.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} {3}\\[`, 'm'), c.id);
    }
    assert.match(text.stdout, new RegExp(`try one: mt-eval run --method local-model --model ${expected.candidates[0].id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  });
});
