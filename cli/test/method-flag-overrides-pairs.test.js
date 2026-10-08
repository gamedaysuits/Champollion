/**
 * `sync --method X` beats a pair's configured method for that run.
 *
 * It used to set only the DEFAULT method, so a pair configured for llm kept
 * llm — and `LOCAL_API_BASE=… champollion sync --method local`, the command
 * the forge export's DEPLOY.md gives, silently sent the text to OpenRouter.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';

function project(cfg) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'methodflag-'));
  fs.mkdirSync(path.join(d, 'locales'));
  fs.writeFileSync(path.join(d, 'locales', 'en.json'), '{"a":"Hello"}');
  fs.writeFileSync(path.join(d, 'locales', 'fr.json'), '{}');
  fs.writeFileSync(path.join(d, 'champollion.config.json'), JSON.stringify(cfg));
  return d;
}

describe('--method overrides per-pair configuration', () => {
  it('a pair configured for llm runs on the flag\'s method, without the llm model', () => {
    const d = project({ inputLocale: 'en', localesDir: 'locales', languages: ['fr'],
      pairs: { 'en:fr': { method: 'llm', model: 'google/gemini-2.5-flash' } } });
    const config = resolveConfig({ method: 'local' }, d);
    const pair = resolvePairs(config).get('en:fr');
    assert.equal(pair.method, 'local');
    assert.notEqual(pair.model, 'google/gemini-2.5-flash');
  });

  it('without the flag the pair keeps what the file says', () => {
    const d = project({ inputLocale: 'en', localesDir: 'locales', languages: ['fr'],
      pairs: { 'en:fr': { method: 'llm', model: 'google/gemini-2.5-flash' } } });
    const pair = resolvePairs(resolveConfig({}, d)).get('en:fr');
    assert.equal(pair.method, 'llm');
    assert.equal(pair.model, 'google/gemini-2.5-flash');
  });
});

describe('the configured model reaches local pairs', () => {
  it('defaultMethod local + model stub-1 runs stub-1, not the local fallback', () => {
    const d = project({ inputLocale: 'en', localesDir: 'locales', languages: ['fr'],
      defaultMethod: 'local', model: 'stub-1' });
    const pair = resolvePairs(resolveConfig({}, d)).get('en:fr');
    assert.equal(pair.method, 'local');
    assert.equal(pair.model, 'stub-1');
  });

  it('--model beats a pair\'s own model for the run', () => {
    const d = project({ inputLocale: 'en', localesDir: 'locales', languages: ['fr'],
      defaultMethod: 'local', pairs: { 'en:fr': { model: 'stub-2' } } });
    assert.equal(resolvePairs(resolveConfig({}, d)).get('en:fr').model, 'stub-2');
    assert.equal(resolvePairs(resolveConfig({ model: 'stub-3' }, d)).get('en:fr').model, 'stub-3');
  });

  it('an explicit OpenRouter model is NOT sent to a pair on another direct method', () => {
    const d = project({ inputLocale: 'en', localesDir: 'locales', languages: ['fr'],
      model: 'google/gemini-2.5-flash', pairs: { 'en:fr': { method: 'anthropic' } } });
    assert.notEqual(resolvePairs(resolveConfig({}, d)).get('en:fr').model, 'google/gemini-2.5-flash');
  });
});
