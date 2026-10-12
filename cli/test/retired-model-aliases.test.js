import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireExactModelId, isFloatingModelId } from '../lib/models.js';
import { DEFAULT_OPENROUTER_MODEL } from '../lib/config.js';

// Founder ruling 2026-10-05: "slugs should be specific, NOT ALIASES — for all
// models, all slugs, no aliasing." shared/retired-model-aliases.json lists the
// short names Champollion USED to resolve; today each is REFUSED, and the
// table only lets the refusal name the exact slug the old name stood for.
//
// SSOT parity guard: the package-bundled cli/shared copy must not drift from
// the monorepo-root SSOT. The Python harness reads the same table
// (config._load_retired_model_aliases, whose standalone fallback the arena
// suite pins in tests/test_model_alias_ssot.py) — a drifted copy would make
// the two runtimes name different slugs in the same refusal.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'shared', 'retired-model-aliases.json');
const BUNDLED = path.resolve(__dirname, '..', 'shared', 'retired-model-aliases.json');

describe('retired-model-aliases SSOT parity (cli/shared ↔ monorepo SSOT)', () => {
  it('bundled cli/shared copy matches the monorepo SSOT', (t) => {
    let rootRaw;
    let bundledRaw;
    try { rootRaw = fs.readFileSync(ROOT, 'utf-8'); } catch { return t.skip('monorepo shared/ absent'); }
    try { bundledRaw = fs.readFileSync(BUNDLED, 'utf-8'); } catch { return t.skip('cli/shared copy absent'); }
    assert.deepEqual(
      JSON.parse(bundledRaw),
      JSON.parse(rootRaw),
      'cli/shared/retired-model-aliases.json drifted from shared/retired-model-aliases.json — run npm run sync:shared',
    );
  });

  it('no model-alias map is shipped any more', () => {
    assert.ok(!fs.existsSync(path.resolve(__dirname, '..', 'shared', 'model-aliases.json')));
    assert.ok(!fs.existsSync(path.resolve(__dirname, '..', '..', 'shared', 'model-aliases.json')));
  });
});

describe('exact model slugs only — no aliasing', () => {
  const retired = JSON.parse(fs.readFileSync(fs.existsSync(BUNDLED) ? BUNDLED : ROOT, 'utf-8')).retired;

  it('every retired short name is REFUSED, naming the slug it used to stand for', () => {
    assert.ok(Object.keys(retired).length > 0);
    for (const [name, slug] of Object.entries(retired)) {
      assert.throws(() => requireExactModelId(name, { from: 'from --model' }), (e) => {
        assert.equal(e.code, 'CHAMPOLLION_MODEL_ID');
        assert.ok(e.message.startsWith(`"${name}" (from --model) is not a model id — Champollion takes exact model slugs only, no aliases. Did you mean ${slug} `), e.message);
        assert.match(e.message, /https:\/\/openrouter\.ai\/models/);
        return true;
      });
    }
  });

  it('floating ids are REFUSED: OpenRouter ~router ids, -latest and :latest names', () => {
    for (const id of ['~google/gemini-flash-latest', '~anthropic/claude-sonnet-latest', 'openai/gpt-chat-latest', 'gemini-flash-latest', 'claude-3-5-sonnet-latest', 'llama3.1:latest']) {
      assert.ok(isFloatingModelId(id), id);
      assert.throws(() => requireExactModelId(id), (e) => e.code === 'CHAMPOLLION_MODEL_ID' && e.message.includes(`"${id}" is a floating model id`));
    }
  });

  it('an exact slug passes through untouched (OpenRouter slug or a provider\'s own name)', () => {
    for (const id of ['google/gemini-3.5-flash', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5.5', 'gpt-5.5', 'claude-sonnet-4-6', 'llama3.1', 'Qwen/Qwen2.5-7B-Instruct']) {
      assert.equal(requireExactModelId(id), id);
    }
    assert.equal(requireExactModelId(null), null);
  });

  it('the CLI default is an exact slug', () => {
    assert.match(DEFAULT_OPENROUTER_MODEL, /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/);
    assert.equal(requireExactModelId(DEFAULT_OPENROUTER_MODEL), DEFAULT_OPENROUTER_MODEL);
  });
});
