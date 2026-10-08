/**
 * Model switches — the dogfood report's finding 2 (2026-08-28).
 *
 * tmMethodKey folds the model into every key, so on its own a model switch
 * would strand the cache and re-bill every unchanged block a sync touches.
 * Founder direction 2026-10-01: switching model is not a reason to pay for a
 * re-translation. These tests pin model CARRY-OVER (the default: reuse the
 * same text translated under another model), its opt-out
 * (--fresh-on-model-change), and the notice that tells the operator which
 * one is happening.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storeTM, tmMethodKey, findModelSwitchStrandedEntries,
  lookupTM, lookupTMValidated, setModelCarryover, carriedHitCount, cacheKey,
} from '../lib/tm.js';

const OLD = { target: 'fr', method: 'llm', model: 'openai/gpt-4o', registerPreset: 'formal' };
const NEW = { ...OLD, model: 'google/gemini-3.5-flash' };

function tmWith(entries) {
  const tm = { _meta: { version: 1 } };
  for (const [pair, n, locale = pair.target] of entries) {
    for (let i = 0; i < n; i++) storeTM(tm, `source ${pair.model} ${i}`, locale, tmMethodKey(pair), `t${i}`);
  }
  return tm;
}

test('reports entries stranded under the previous model', () => {
  const report = findModelSwitchStrandedEntries(tmWith([[OLD, 5]]), [NEW]);
  assert.deepEqual(report, [{
    target: 'fr', currentModel: 'google/gemini-3.5-flash', current: 0,
    stranded: [{ model: 'openai/gpt-4o', count: 5 }],
  }]);
});

test('silent when the current model already holds the most entries', () => {
  assert.deepEqual(findModelSwitchStrandedEntries(tmWith([[OLD, 2], [NEW, 9]]), [NEW]), []);
});

test('silent when nothing changed', () => {
  assert.deepEqual(findModelSwitchStrandedEntries(tmWith([[NEW, 4]]), [NEW]), []);
});

test('a register or method change is not a model switch', () => {
  const otherRegister = { ...OLD, registerPreset: 'casual-tu' };
  const otherMethod = { ...OLD, method: 'deepl', model: '' };
  assert.deepEqual(findModelSwitchStrandedEntries(tmWith([[otherRegister, 5], [otherMethod, 5]]), [NEW]), []);
});

test('only the pair\'s own locale counts', () => {
  assert.deepEqual(findModelSwitchStrandedEntries(tmWith([[OLD, 5, 'de']]), [NEW]), []);
});

test('several old models are listed largest first', () => {
  const older = { ...OLD, model: 'anthropic/claude-3-haiku' };
  const [r] = findModelSwitchStrandedEntries(tmWith([[OLD, 3], [older, 7]]), [NEW]);
  assert.deepEqual(r.stranded.map(s => s.model), ['anthropic/claude-3-haiku', 'openai/gpt-4o']);
});


// ── Carry-over: lookups reuse another model's translation ────────────────
test('a miss under the new model is served by the previous model\'s entry', () => {
  const tm = tmWith([[OLD, 1]]);
  assert.equal(lookupTM(tm, 'source openai/gpt-4o 0', 'fr', tmMethodKey(NEW)), 't0');
  assert.equal(carriedHitCount(tm), 1);
});

test('--fresh-on-model-change (carry-over off) serves only exact-model hits', () => {
  const tm = tmWith([[OLD, 1]]);
  setModelCarryover(tm, false);
  assert.equal(lookupTM(tm, 'source openai/gpt-4o 0', 'fr', tmMethodKey(NEW)), null);
});

test('a register, method or locale change never carries over', () => {
  const tm = tmWith([[OLD, 1]]);
  const src = 'source openai/gpt-4o 0';
  assert.equal(lookupTM(tm, src, 'fr', tmMethodKey({ ...NEW, registerPreset: 'casual-tu' })), null);
  assert.equal(lookupTM(tm, src, 'fr', tmMethodKey({ ...NEW, method: 'llm-coached', coachingPrompt: 'x' })), null);
  assert.equal(lookupTM(tm, src, 'de', tmMethodKey(NEW)), null);
});

test('the exact model wins over a carried entry', () => {
  const tm = tmWith([[OLD, 1]]);
  storeTM(tm, 'source openai/gpt-4o 0', 'fr', tmMethodKey(NEW), 'fresh');
  assert.equal(lookupTM(tm, 'source openai/gpt-4o 0', 'fr', tmMethodKey(NEW)), 'fresh');
  assert.equal(carriedHitCount(tm), 0);
});

test('a carried entry is gate-checked, and a failure evicts THAT entry', () => {
  const tm = tmWith([[OLD, 1]]);
  const src = 'source openai/gpt-4o 0';
  assert.equal(lookupTMValidated(tm, src, 'fr', tmMethodKey(NEW), () => false), null);
  assert.equal(tm[cacheKey(src, 'fr', tmMethodKey(OLD))], undefined, 'the old model\'s bad entry is gone');
});

test('entries stored after the first lookup join the carry-over index', () => {
  const tm = tmWith([[OLD, 1]]);
  lookupTM(tm, 'nothing', 'fr', tmMethodKey(NEW)); // builds the index
  const third = { ...OLD, model: 'x/third' };
  storeTM(tm, 'later text', 'fr', tmMethodKey(third), 'plus tard');
  assert.equal(lookupTM(tm, 'later text', 'fr', tmMethodKey(NEW)), 'plus tard');
});

// ── End to end: `sync --dry` says so before anything is spent ────────────
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadTM, saveTM } from '../lib/tm.js';
import { resolveConfig } from '../lib/config.js';
import { resolveRuntime } from '../lib/sync.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

function runCLI(args, cwd) {
  // spawnSync, not execFileSync: warnings go to stderr, and execFileSync
  // only hands stderr back when the command fails.
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, encoding: 'utf-8' });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status };
}

test('sync --dry reuses the previous model by default, says so, and honours --fresh-on-model-change', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-modelswitch-'));
  try {
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ a: 'Hello there', b: 'Good night' }));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales', languages: ['fr'],
    }));
    // The runtime's resolved pair (model + register preset filled in) is
    // what sync keys the TM on — build the 'old model' key from it.
    const { resolvedPairs } = await resolveRuntime(resolveConfig({}, dir), dir, { dryRun: true });
    const [pair] = [...resolvedPairs.values()];
    const oldPair = { ...pair, model: 'some-retired/model' };
    const tm = loadTM(dir);
    storeTM(tm, 'Hello there', 'fr', tmMethodKey(oldPair), 'Bonjour');
    storeTM(tm, 'Good night', 'fr', tmMethodKey(oldPair), 'Bonne nuit');
    saveTM(dir, tm);

    // Default: reused at no cost, and the operator is told so.
    const human = runCLI(['sync', '--dry'], dir);
    const text = human.stdout + human.stderr;
    assert.match(text, /Model changed: 2 translations this run needs \(2 strings in fr\) are served from the previous model's cached translations, at no cost/);
    assert.match(text, /--fresh-on-model-change/);
    assert.match(text, /en:fr\s+llm\s+0\s+2\s+free \(cache\)/, 'nothing billed: both keys are TM hits');

    const res = runCLI(['sync', '--dry', '--json'], dir);
    const summary = res.stdout.split('\n').filter(Boolean).map(l => JSON.parse(l))
      .find(o => o.level === 'summary');
    assert.deepEqual(summary.tmModelSwitch, [{
      target: 'fr', currentModel: pair.model || '', current: 0,
      stranded: [{ model: 'some-retired/model', count: 2 }],
      servedThisRun: 2,
    }]);

    // Opt-out: says it will bill, and prices both keys as misses.
    const fresh = runCLI(['sync', '--dry', '--fresh-on-model-change'], dir);
    const freshText = fresh.stdout + fresh.stderr;
    assert.match(freshText, /will NOT be reused/);
    assert.match(freshText, /en:fr\s+llm\s+2\s+0\s/, 'both keys billed with carry-over off');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
