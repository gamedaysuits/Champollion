/**
 * Every default model comes from ONE file, shared/model-defaults.json
 * (founder, 2026-10-07: ten hand-kept defaults drifted — "we're gonna be
 * getting our wires crossed"). These tests hold every copy to it and fail on
 * a model id written anywhere else.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultModel, modelDefaultsData, ruleCandidate, checkModelDefaults } from '../lib/model-defaults.js';
import { DEFAULT_OPENROUTER_MODEL } from '../lib/config.js';
import { requireExactModelId } from '../lib/models.js';
import { LLM_RATES } from '../lib/methods/provider-pricing.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(CLI, '..');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const MONOREPO = fs.existsSync(path.join(REPO, 'shared', 'model-defaults.json'));

describe('model defaults: one file', () => {
  it('the CLI default and the direct providers\' defaults are read from it', async () => {
    assert.equal(DEFAULT_OPENROUTER_MODEL, defaultModel('translate'));
    const { OpenAIMethod } = await import('../lib/methods/openai.js');
    const { GeminiMethod } = await import('../lib/methods/gemini.js');
    const { AnthropicMethod } = await import('../lib/methods/anthropic.js');
    assert.equal(new OpenAIMethod()._getDefaultModel(), defaultModel('openai'));
    assert.equal(new GeminiMethod()._getDefaultModel(), defaultModel('gemini'));
    assert.equal(new AnthropicMethod()._getDefaultModel(), defaultModel('anthropic'));
  });
  it('every default is an exact id (no alias, no floating id)', () => {
    for (const [role, r] of Object.entries(modelDefaultsData().roles)) {
      assert.doesNotThrow(() => requireExactModelId(r.model), `${role}: ${r.model}`);
      assert.ok(new RegExp(r.rule.match).test(r.model), `${role}: its own rule does not match ${r.model}`);
    }
  });
  it('a direct provider\'s default has an offline price (the pinned table)', () => {
    for (const role of ['openai', 'gemini', 'anthropic']) assert.ok(LLM_RATES[defaultModel(role)], `${role}: ${defaultModel(role)}`);
  });
  it('every copy is the shared file', { skip: MONOREPO ? false : 'shared/ is present only in the monorepo' }, () => {
    const src = read(path.join(REPO, 'shared', 'model-defaults.json'));
    for (const copy of ['cli/shared/model-defaults.json', 'arena/mt_eval_harness/data/model-defaults.json',
      'mt-eval-arena/supabase/functions/docent-chat/model-defaults.json']) {
      assert.deepEqual(read(path.join(REPO, copy)), src, `${copy} has drifted — npm run sync:shared / copy it`);
    }
  });
  it('no default model id is written in code outside the file', { skip: MONOREPO ? false : 'monorepo only' }, () => {
    const ids = Object.values(modelDefaultsData().roles).map(r => r.model);
    const files = ['cli/lib/config.js', 'cli/lib/methods/openai.js', 'cli/lib/methods/gemini.js', 'cli/lib/methods/anthropic.js',
      'mcp-server/src/tools/translate.js', 'arena/mt_eval_harness/config.py', 'forge/nmt_forge/export.py',
      'mt-eval-arena/supabase/functions/docent-chat/index.ts'];
    const bad = [];
    for (const f of files) {
      const text = fs.readFileSync(path.join(REPO, f), 'utf8');
      for (const id of ids) if (text.includes(`'${id}'`) || text.includes(`"${id}"`)) bad.push(`${f}: ${id}`);
    }
    assert.deepEqual(bad, []);
  });
});

describe('models check: the rule finds the newest matching id; a pinned id that is gone fails', () => {
  const role = { rule: { match: '^gpt-(?<v>\\d+(?:\\.\\d+)?)-mini-(?<date>\\d{4}-\\d{2}-\\d{2})$' } };
  it('newest version, then newest snapshot', () => {
    assert.equal(ruleCandidate(role, ['gpt-5.4-mini-2026-03-17', 'gpt-5.10-mini-2026-01-01', 'gpt-5.10-mini-2026-05-01', 'gpt-5.4-mini']), 'gpt-5.10-mini-2026-05-01');
  });
  it('gone / newer / ok / unchecked', () => {
    const rows = checkModelDefaults({
      openrouter: ['google/gemini-3.8-flash', 'google/gemini-3.9-flash', 'google/gemini-3.1-pro-preview'],
      openai: ['gpt-5.4-mini'], gemini: null, anthropic: null,
    });
    const by = Object.fromEntries(rows.map(r => [r.role, r]));
    assert.equal(by.translate.status, 'newer');
    assert.equal(by.translate.candidate, 'google/gemini-3.9-flash');
    assert.equal(by.openai.status, 'gone');
    assert.equal(by.harness.status, 'ok');
    assert.equal(by.gemini.status, 'unchecked');
  });
});
