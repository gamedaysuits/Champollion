/**
 * fallback.test.js — the per-pair fallback method.
 *
 * A pair names a second method (`"fallback": { "method": … }`). The pair's own
 * method runs first; what it cannot translate safely — keys the quality gate
 * refused or that came back empty, Markdown blocks it dropped or damaged,
 * front-matter fields it hollowed — goes to the fallback once, through the
 * same gate, cached under the fallback's own TM key. What both fail stays
 * failed exactly as before (lock not advanced; '[EN] ' remains the content
 * lanes' last resort).
 *
 * Covers: pair resolution + validation (and that --method/--model leave the
 * fallback alone), key-value sync end to end, a dead primary, the --max-cost
 * skip (over cap, and unpriced), the TM ladder (the fallback's cache before
 * the primary's API), Hugo content (blocks + front matter, and both-fail →
 * '[EN] '), Docusaurus JSON + body, and `champollion status`.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { resolvePairs } from '../lib/pairs.js';
import { resolveConfig } from '../lib/config.js';
import { runSync } from '../lib/sync.js';
import { runContentSync } from '../lib/content-sync.js';
import { runDocusaurusSync } from '../lib/docusaurus-sync.js';
import { translateWithFallback } from '../lib/translate-pair.js';
import { createFallbackBudget, blockFault } from '../lib/fallback.js';
import { loadTM, lookupTM, storeTM, tmMethodKey, TM_DIR, TM_FILENAME } from '../lib/tm.js';
import { readManifest, writeManifest, hashValue } from '../lib/hash.js';
import { output } from '../lib/output.js';
import { computeExitCode } from '../lib/commands/sync.js';
import { run as runStatus } from '../lib/commands/status.js';
import { startServeServer } from '../lib/serve.js';

// -----------------------------------------------------------------
// Scripted fake methods. getMethod() builds a fresh instance per call, so
// the call log and behaviour live on the class.
// -----------------------------------------------------------------

function makeFake(name) {
  class Fake extends TranslationMethod {
    constructor() { super(name); }

    async translate(keys, sourceFlat) {
      Fake.batchCalls.push([...keys]);
      if (Fake.dead) return null;
      const out = {};
      for (const k of keys) {
        const v = Fake.keyBehavior(sourceFlat[k], k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }

    async translateContent(prompt) {
      Fake.contentCalls.push(prompt);
      if (Fake.dead) return null;
      const segs = [...prompt.matchAll(/⟦SEG_(\d+)⟧\n([\s\S]*?)(?=\n\n⟦SEG_|$)/g)];
      if (segs.length > 0) {
        return segs
          .map((m) => {
            const v = Fake.blockBehavior(m[2]);
            return v === undefined ? null : `⟦SEG_${m[1]}⟧\n${v}`;
          })
          .filter(Boolean)
          .join('\n\n');
      }
      const idx = prompt.indexOf('\n---\n');
      return Fake.pageBehavior(prompt.slice(idx + 5));
    }

    estimateCost(keyCount) {
      if (Fake.pricePerKey === null) {
        return { estimatedCost: null, currency: 'USD', source: 'unpriced-test-method' };
      }
      return { estimatedCost: keyCount * Fake.pricePerKey, currency: 'USD', source: 'test' };
    }
  }
  Fake.reset = () => {
    Fake.batchCalls = [];
    Fake.contentCalls = [];
    Fake.dead = false;
    Fake.pricePerKey = null;
    Fake.keyBehavior = (src) => `FR:${src}`;
    Fake.blockBehavior = (text) => `FR<${text}>`;
    Fake.pageBehavior = (body) => `FR-PAGE<${body}>`;
  };
  Fake.reset();
  METHOD_REGISTRY[name] = Fake;
  return Fake;
}

const Primary = makeFake('test-fb-primary');
const Secondary = makeFake('test-fb-secondary');

// The user's own model: fine on plain strings, drops placeholders.
const PRIMARY_OUT = {
  'Hello, {name}!': 'Bonjour !',
  Goodbye: 'Au revoir',
  'You have {count} new messages': 'Vous avez des nouveaux messages',
  Save: 'Enregistrer',
};
// The fallback: keeps {name}, but drops {count} too.
const SECONDARY_OUT = {
  'Hello, {name}!': 'Bonjour, {name} !',
  'You have {count} new messages': 'Vous avez des messages',
};

const SOURCE = {
  greeting: 'Hello, {name}!',
  farewell: 'Goodbye',
  inbox: 'You have {count} new messages',
  save: 'Save',
};

function resetFakes() {
  Primary.reset();
  Secondary.reset();
  Primary.keyBehavior = (src) => PRIMARY_OUT[src] ?? `FR:${src}`;
  Secondary.keyBehavior = (src) => SECONDARY_OUT[src] ?? `FB:${src}`;
}

/**
 * Run `fn` with the output controller in json mode, capturing every record.
 * (process.stdout is left alone: the test runner reports through it, and a
 * stub held across an await swallows other tests' results.)
 */
async function captureJson(fn) {
  const records = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  const push = (line) => {
    try { records.push(JSON.parse(line)); } catch { records.push({ raw: String(line) }); }
  };
  console.log = push;
  console.error = push;
  console.warn = push;
  output.setMode('json');
  try {
    const result = await fn();
    return { result, records };
  } finally {
    output.setMode('default');
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
  }
}

/** Run `fn` with the output controller in default mode, capturing lines. */
async function captureText(fn) {
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  console.log = (l) => lines.push(String(l));
  console.error = (l) => lines.push(String(l));
  console.warn = (l) => lines.push(String(l));
  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
  }
}

function tempProject(config, source = SOURCE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-fallback-'));
  fs.mkdirSync(path.join(dir, 'locales'));
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify(source, null, 2));
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
    inputLocale: 'en', localesDir: './locales', ...config,
  }, null, 2));
  return dir;
}

const FALLBACK_CONFIG = {
  languages: ['fr'],
  pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-secondary' } } },
};

/** TM entries (locale fr) whose cached text is `text`. */
function tmEntriesFor(dir, text) {
  const tm = JSON.parse(fs.readFileSync(path.join(dir, TM_DIR, TM_FILENAME), 'utf-8'));
  return Object.entries(tm).filter(([k, e]) => k !== '_meta' && e && e.l === 'fr' && e.t === text).map(([, e]) => e);
}

// =================================================================
// Pair resolution
// =================================================================

describe('fallback: pair resolution', () => {
  const base = { inputLocale: 'en', model: 'google/gemini-3.5-flash', defaultMethod: 'llm', resolvedLanguages: {} };

  it('resolves a fallback into a full pair config with its own transport and model', () => {
    const pairs = resolvePairs({
      ...base,
      pairs: {
        'en:crk': {
          method: 'api', endpoint: 'http://127.0.0.1:8378/translate', script: 'Latn',
          promptContext: 'A school newsletter',
          fallback: { method: 'llm-coached', model: 'google/gemini-2.5-flash' },
        },
      },
    });
    const pc = pairs.get('en:crk');
    assert.equal(pc.method, 'api');
    assert.equal(pc.fallback.method, 'llm-coached');
    assert.equal(pc.fallback.model, 'google/gemini-2.5-flash');
    assert.equal(pc.fallback.provider, 'openrouter');
    assert.equal(pc.fallback.endpoint, null, 'the primary\'s endpoint is not the fallback\'s');
    // The language's facts and settings are inherited.
    assert.equal(pc.fallback.target, 'crk');
    assert.equal(pc.fallback.promptContext, 'A school newsletter');
    assert.equal(pc.fallback.scriptResolution.script, pc.scriptResolution.script);
    assert.equal(pc.fallback.fallback, undefined, 'no nested fallback');
    // Its own TM key — the cache always says which method produced a value.
    assert.notEqual(tmMethodKey(pc.fallback), tmMethodKey(pc));
  });

  it('a fallback on llm with a direct provider is routed like a pair (llm → openai)', () => {
    const pc = resolvePairs({
      ...base,
      pairs: { 'en:fr': { method: 'deepl', fallback: { method: 'llm', provider: 'openai', model: 'gpt-4o-mini' } } },
    }).get('en:fr');
    assert.equal(pc.fallback.method, 'openai');
    assert.equal(pc.fallback.model, 'gpt-4o-mini');
  });

  it('refuses a malformed fallback, naming the pair', () => {
    const bad = (fallback, pattern) => assert.throws(
      () => resolvePairs({ ...base, pairs: { 'en:fr': { method: 'llm', fallback } } }),
      (err) => err.message.startsWith('en:fr: "fallback"') && pattern.test(err.message),
    );
    bad({ method: 'llm-coachd' }, /Unknown translation method "llm-coachd"/);
    bad('llm-coached', /must be an object/);
    bad({ model: 'x' }, /needs a "method"/);
    bad({ method: 'llm-coached', script: 'Cans' }, /cannot set "script"/);
    bad({ method: 'llm-coached', fallback: { method: 'llm' } }, /cannot have its own fallback/);
    bad({ method: 'llm', provider: 'nonesuch' }, /Unknown provider/);
    bad({ method: 'llm' }, /same method as the pair itself/);
  });

  it('the object form of `languages` takes a fallback (and keeps its endpoint)', () => {
    const dir = tempProject({
      languages: {
        fr: {
          method: 'api', endpoint: 'http://127.0.0.1:8378/translate',
          fallback: { method: 'llm-coached', model: 'google/gemini-2.5-flash' },
        },
      },
    });
    try {
      const pc = resolvePairs(resolveConfig({}, dir)).get('en:fr');
      assert.equal(pc.endpoint, 'http://127.0.0.1:8378/translate');
      assert.equal(pc.fallback.method, 'llm-coached');
      assert.equal(pc.fallback.model, 'google/gemini-2.5-flash');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a pair-level `fallback: null` removes the language\'s fallback', () => {
    const pc = resolvePairs({
      ...base,
      resolvedLanguages: { fr: { name: 'French', method: 'deepl', fallback: { method: 'llm' } } },
      pairs: { 'en:fr': { fallback: null } },
    }).get('en:fr');
    assert.equal(pc.method, 'deepl');
    assert.equal(pc.fallback, undefined);
  });

  it('--method / --model override the primary only; the fallback keeps the file\'s settings', () => {
    const dir = tempProject({
      model: 'google/gemini-3.5-flash',
      pairs: { 'en:fr': { method: 'api', endpoint: 'http://127.0.0.1:8378/translate', fallback: { method: 'llm' } } },
    });
    try {
      const muted = output.getMode();
      output.setMode('quiet');
      const config = resolveConfig({ method: 'local', model: 'stub-1' }, dir);
      output.setMode(muted);
      const pc = resolvePairs(config).get('en:fr');
      assert.equal(pc.method, 'local');
      assert.equal(pc.model, 'stub-1');
      assert.equal(pc.fallback.method, 'llm');
      assert.equal(pc.fallback.model, 'google/gemini-3.5-flash', '--model never reaches the fallback');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a --method that makes the primary identical to its fallback drops the fallback for the run', () => {
    const muted = output.getMode();
    output.setMode('quiet');
    try {
      const pc = resolvePairs({
        ...base,
        _methodOverride: 'llm-coached',
        _fileDefaultMethod: 'llm',
        pairs: { 'en:fr': { method: 'api', endpoint: 'http://x/t', fallback: { method: 'llm-coached' } } },
      }).get('en:fr');
      assert.equal(pc.method, 'llm-coached');
      assert.equal(pc.fallback, undefined);
    } finally {
      output.setMode(muted);
    }
  });
});

// =================================================================
// Key-value sync
// =================================================================

describe('fallback: key-value sync', () => {
  let dir;
  beforeEach(() => { resetFakes(); });
  afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); dir = null; });

  it('keys the primary could not translate safely come from the fallback, through the same gate', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    const { result, records } = await captureJson(() => runSync({ cwd: dir, cliArgs: {} }));

    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.greeting, 'Bonjour, {name} !', 'the fallback filled the key the primary damaged');
    assert.equal(fr.farewell, 'Au revoir', 'the primary\'s good output stands');
    assert.equal(fr.save, 'Enregistrer');
    assert.equal(fr.inbox, undefined, 'both damaged it: nothing written');

    // The fallback saw only what the primary failed (initial + its retry).
    assert.deepEqual(Secondary.batchCalls[0].sort(), ['greeting', 'inbox']);
    assert.ok(Secondary.batchCalls.length <= 2);

    // TM: the fallback's output is cached under the fallback's key only.
    const entries = tmEntriesFor(dir, 'Bonjour, {name} !');
    assert.equal(entries.length, 1);
    assert.match(entries[0].m, /^test-fb-secondary\|/);
    assert.equal(tmEntriesFor(dir, 'Bonjour !').length, 0, 'gate-refused output is never cached');

    // Lock: advanced for accepted keys only.
    const lock = readManifest(dir);
    assert.equal(lock.greeting, hashValue(SOURCE.greeting));
    assert.equal(lock.farewell, hashValue(SOURCE.farewell));
    assert.equal(Object.prototype.hasOwnProperty.call(lock, 'inbox'), false, 'the key both failed re-fires next sync');

    // Counted, reported, and verify lists the key that still failed.
    assert.equal(result.totalFailed, 1);
    assert.ok(result.verifyErrors > 0, 'verify reports the missing key');
    assert.equal(computeExitCode(result), 2);

    const line = records.find(r => typeof r.message === 'string' && r.message.startsWith('[FALLBACK] en:fr'));
    assert.ok(line, 'a [FALLBACK] line is printed');
    assert.equal(
      line.message,
      '[FALLBACK] en:fr — 2 key(s) the primary (test-fb-primary) could not translate safely → '
      + 'translated by test-fb-secondary (1 accepted, 1 still failing)'
      // Which ones (the files do not say — Round 8).
      + ' — keys: greeting (`champollion status` counts what each locale holds from the fallback)',
    );
    const summary = records.find(r => r.level === 'summary');
    assert.deepEqual(summary.locales[0].fallback, {
      method: 'test-fb-secondary', model: summary.locales[0].fallback.model,
      attempted: 2, accepted: 1, failed: 1, cached: 0, primaryFailedWholesale: false, produced: ['greeting'],
      // Round 11: the primary's own accepted answers, and why the rest went
      // to the fallback (warnFallbackMajority).
      primaryAccepted: 2, primaryReasons: { 'ICU/placeholder structure damaged': 2 },
    });
    const pairsLine = records.find(r => typeof r.message === 'string' && r.message.startsWith('Pairs:'));
    assert.match(pairsLine.message, /fr:test-fb-primary \(fallback: test-fb-secondary\)/);
  });

  it('a primary that returns nothing at all: every key goes to the fallback, and that is said', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    Primary.dead = true;
    const { result, records } = await captureJson(() => runSync({ cwd: dir, cliArgs: { 'no-verify': true } }));

    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.greeting, 'Bonjour, {name} !');
    assert.equal(fr.farewell, 'FB:Goodbye');
    assert.equal(fr.save, 'FB:Save');
    assert.equal(result.totalFailed, 1, 'only the key the fallback damaged too');
    assert.ok(records.some(r => r.level === 'warn' && /primary method \(test-fb-primary\) returned no results/.test(r.message)));
    const summary = records.find(r => r.level === 'summary');
    assert.equal(summary.locales[0].fallback.primaryFailedWholesale, true);
    assert.equal(summary.locales[0].fallback.attempted, 4);
  });

  it('folder-per-locale: after a dead primary, the next files go straight to the fallback', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-fallback-ns-'));
    fs.mkdirSync(path.join(dir, 'locales', 'en'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'locales', 'en', 'common.json'), JSON.stringify({ save: 'Save' }));
    fs.writeFileSync(path.join(dir, 'locales', 'en', 'home.json'), JSON.stringify({ farewell: 'Goodbye' }));
    fs.mkdirSync(path.join(dir, 'locales', 'fr'));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en', localesDir: './locales', ...FALLBACK_CONFIG,
    }));
    Primary.dead = true;
    const { records } = await captureJson(() => runSync({ cwd: dir, cliArgs: { 'no-verify': true } }));
    assert.equal(Primary.batchCalls.length, 1, 'the dead primary is asked once, not once per file');
    assert.equal(Secondary.batchCalls.length, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr', 'home.json'), 'utf-8')).farewell, 'FB:Goodbye');
    const summary = records.find(r => r.level === 'summary');
    assert.equal(summary.locales[0].fallback.accepted, 2);
  });

  it('preflight: a fallback that cannot run stops the sync before anything is spent', async () => {
    class NotReady extends TranslationMethod {
      constructor() { super('test-fb-notready'); }
      checkReadiness() { return { ready: false, reason: 'No TEST_FALLBACK_KEY set.' }; }
    }
    METHOD_REGISTRY['test-fb-notready'] = NotReady;
    dir = tempProject({
      languages: ['fr'],
      pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-notready' } } },
    });
    await assert.rejects(
      captureJson(() => runSync({ cwd: dir, cliArgs: {} })),
      /en:fr fallback \(method: test-fb-notready\): No TEST_FALLBACK_KEY set\./,
    );
    assert.equal(Primary.batchCalls.length, 0);
  });

  it('--dry lists nothing about the fallback (it cannot know)', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    const { records } = await captureJson(() => runSync({ cwd: dir, dryRun: true, cliArgs: {} }));
    const summary = records.find(r => r.level === 'summary');
    assert.equal(summary.locales[0].fallback, undefined);
    assert.equal(Secondary.batchCalls.length, 0);
    assert.equal(records.some(r => typeof r.message === 'string' && r.message.startsWith('[FALLBACK]')), false);
  });

  it('--max-cost: a fallback batch that would pass the cap is skipped, naming the keys', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    Primary.pricePerKey = 0.0001;   // pre-run estimate: 4 × $0.0001
    Secondary.pricePerKey = 1;       // 2 keys → ~$2, cap is $0.50
    const { result, records } = await captureJson(() => runSync({ cwd: dir, cliArgs: { 'max-cost': '0.5', 'no-verify': true } }));

    assert.equal(Secondary.batchCalls.length, 0, 'the fallback never ran');
    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.greeting, undefined);
    assert.equal(fr.farewell, 'Au revoir');
    const warn = records.find(r => r.level === 'warn' && /^\[FALLBACK\] en:fr — 2 key\(s\)/.test(r.message));
    assert.ok(warn, 'the skip is reported');
    assert.match(warn.message, /skipped: ~\$2\.0000 on top of .* would pass --max-cost \$0\.5000/);
    assert.match(warn.message, /Still untranslated: (greeting, inbox|inbox, greeting)/);
    assert.equal(result.totalFailed, 2);
    assert.equal(computeExitCode(result), 2, 'exit code as for any partial failure');
    const summary = records.find(r => r.level === 'summary');
    assert.equal(summary.locales[0].fallback.skipped.items.length, 2);
  });

  it('--max-cost: an unpriced fallback is skipped (unknown is not free)', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    Primary.pricePerKey = 0.0001;
    Secondary.pricePerKey = null;
    const { records } = await captureJson(() => runSync({ cwd: dir, cliArgs: { 'max-cost': '5', 'no-verify': true } }));
    assert.equal(Secondary.batchCalls.length, 0);
    assert.ok(records.some(r => r.level === 'warn' && /cannot be estimated .* unknown is not free/.test(r.message)));
  });

  it('--max-cost: a fallback batch that fits runs', async () => {
    dir = tempProject(FALLBACK_CONFIG);
    Primary.pricePerKey = 0.0001;
    Secondary.pricePerKey = 0.01;
    await captureJson(() => runSync({ cwd: dir, cliArgs: { 'max-cost': '1', 'no-verify': true } }));
    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.greeting, 'Bonjour, {name} !');
  });

  it('a value the fallback produced counts as the pipeline\'s own (its echo is not re-queued)', async () => {
    // "GitHub" kept as written is a valid French value (a short name). The
    // fallback produced it, so only the FALLBACK's TM entry confirms it —
    // the next sync must consult that key, or it re-queues the "untranslated
    // echo" (and re-asks both methods) on every run.
    dir = tempProject(FALLBACK_CONFIG, { brand: 'GitHub' });
    Primary.keyBehavior = () => undefined;   // returns nothing for it
    Secondary.keyBehavior = (src) => src;    // keeps it as written
    await captureJson(() => runSync({ cwd: dir, cliArgs: { 'no-verify': true } }));
    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.brand, 'GitHub');
    assert.match(tmEntriesFor(dir, 'GitHub')[0].m, /^test-fb-secondary\|/);

    resetFakes();
    const second = await captureJson(() => runSync({ cwd: dir, cliArgs: { 'no-verify': true } }));
    assert.equal(second.result.totalProcessed, 0, 'the confirmed echo is not re-queued');
    assert.equal(Primary.batchCalls.length, 0);
    assert.equal(Secondary.batchCalls.length, 0);
  });
});

// =================================================================
// translateWithFallback — the TM ladder
// =================================================================

describe('fallback: TM ladder (translateWithFallback)', () => {
  const pair = resolvePairs({
    inputLocale: 'en', model: 'm', defaultMethod: 'llm', resolvedLanguages: {},
    pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-secondary' } } },
  }).get('en:fr');

  beforeEach(resetFakes);

  it('text the fallback translated before is served from its cache — the primary is not re-asked', async () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'Hello, {name}!', 'fr', tmMethodKey(pair.fallback), 'Bonjour, {name} !');
    const r = await captureText(() => translateWithFallback(
      ['greeting', 'farewell'], SOURCE, pair, 'en:fr', { apiKey: null, tm, targetCode: 'fr' },
    ));
    assert.deepEqual(Primary.batchCalls, [['farewell']], 'only the uncached key reaches the primary');
    assert.equal(Secondary.batchCalls.length, 0);
    assert.equal(r.result.translated.greeting, 'Bonjour, {name} !');
    assert.equal(r.result.fallback.cached, 1);
  });

  it('a cached fallback value that fails today\'s gate is evicted and the key re-asked', async () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'Hello, {name}!', 'fr', tmMethodKey(pair.fallback), 'Bonjour !');
    await captureText(() => translateWithFallback(
      ['greeting'], SOURCE, pair, 'en:fr', { apiKey: null, tm, targetCode: 'fr' },
    ));
    assert.deepEqual(Primary.batchCalls[0], ['greeting'], 'the primary gets its turn');
    assert.equal(lookupTM(tm, 'Hello, {name}!', 'fr', tmMethodKey(pair.fallback)), 'Bonjour, {name} !',
      'the fallback re-translated it and the good value replaced the evicted one');
  });

  it('with the primary known to be down, its own cache is still served; only the rest go to the fallback', async () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'Goodbye', 'fr', tmMethodKey(pair), 'Au revoir');
    const r = await captureText(() => translateWithFallback(
      ['greeting', 'farewell'], SOURCE, pair, 'en:fr', { apiKey: null, tm, targetCode: 'fr', skipPrimary: true },
    ));
    assert.equal(Primary.batchCalls.length, 0);
    assert.deepEqual(Secondary.batchCalls[0], ['greeting']);
    assert.deepEqual(r.result.translated, { farewell: 'Au revoir', greeting: 'Bonjour, {name} !' });
  });

  it('createFallbackBudget: commits approved spend; refuses past the cap and when unpriced', async () => {
    Secondary.pricePerKey = 0.1;
    const budget = createFallbackBudget({ maxCost: 0.25, committed: 0.05 });
    assert.equal((await budget.approve(1, pair.fallback)).ok, true);
    assert.equal(budget.committed.toFixed(2), '0.15');
    const refused = await budget.approve(2, pair.fallback);
    assert.equal(refused.ok, false);
    assert.equal(budget.committed.toFixed(2), '0.15', 'a refused batch commits nothing');
    Secondary.pricePerKey = null;
    assert.equal((await budget.approve(1, pair.fallback)).ok, false);
    assert.equal((await createFallbackBudget({ maxCost: null }).approve(5, pair.fallback)).ok, true, 'no cap, no check');
  });

  it('blockFault: missing protected element, orphaned placeholder, hollowed block', () => {
    const src = 'Run ⟦PROTECTED_0⟧ before you start the server.';
    const restoredSrc = 'Run `npm install` before you start the server.';
    assert.equal(blockFault(src, 'Lancez ⟦PROTECTED_0⟧ avant.', 'Lancez `npm install` avant.', restoredSrc), null);
    assert.match(blockFault(src, 'Lancez avant.', 'Lancez avant.', restoredSrc), /protected element/);
    assert.match(blockFault(src, 'Lancez ⟦PROTECTED_7⟧.', 'Lancez ⟦PROTECTED_7⟧.', restoredSrc), /damaged|missing/);
    assert.ok(blockFault(src, ' ⟦PROTECTED_0⟧ ', ' `npm install` ', restoredSrc), 'a block hollowed of its words fails');
  });
});

// =================================================================
// Hugo content sync
// =================================================================

describe('fallback: content sync (front matter + Markdown blocks)', () => {
  let dir;
  const POST = [
    '---',
    'title: My First Post',
    'description: A short introduction',
    '---',
    'Welcome to the site. This is the first paragraph.',
    '',
    'Run `npm install` before you start the server.',
    '',
    'DROPME this paragraph is always dropped by the primary.',
    '',
  ].join('\n');

  function pairsFor(extra = {}) {
    return resolvePairs({
      inputLocale: 'en', model: 'm', defaultMethod: 'llm', resolvedLanguages: {},
      pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-secondary' }, ...extra } },
    });
  }

  function opts(extra = {}) {
    return {
      contentDir: dir, sourceLocale: 'en', pairs: pairsFor(), translatableFields: null,
      apiKey: 'k', dryRun: false, cwd: dir, ...extra,
    };
  }

  beforeEach(() => {
    resetFakes();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-fallback-content-'));
    fs.mkdirSync(path.join(dir, 'posts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'posts', 'hello.md'), POST);
    // The primary: hollows the title, drops inline code, loses the DROPME block.
    Primary.keyBehavior = (src) => (src === 'My First Post' ? ' … ' : `FR:${src}`);
    Primary.blockBehavior = (text) => (text.includes('DROPME')
      ? undefined
      : `FR<${text.replace(/⟦PROTECTED_\d+⟧/g, '')}>`);
    Secondary.keyBehavior = (src) => `FB:${src}`;
    Secondary.blockBehavior = (text) => `FB<${text}>`;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('a failing body block and a hollowed field are filled by the fallback — no [EN]', async () => {
    const { result } = await captureJson(() => runContentSync(opts()));
    const out = fs.readFileSync(path.join(dir, 'posts', 'hello.fr.md'), 'utf-8');
    assert.match(out, /title: "?FB:My First Post/);
    assert.match(out, /description: "?FR:A short introduction/);
    assert.match(out, /FR<Welcome to the site\. This is the first paragraph\.>/);
    assert.match(out, /FB<Run `npm install` before you start the server\.>/, 'the block that lost its code span');
    assert.match(out, /FB<DROPME this paragraph/, 'the block the primary dropped');
    assert.doesNotMatch(out, /\[EN\]/);

    // Cached under the method that produced each value.
    const tm = loadTM(dir);
    const pc = pairsFor().get('en:fr');
    assert.equal(lookupTM(tm, 'Run `npm install` before you start the server.', 'fr', tmMethodKey(pc.fallback)),
      'FB<Run `npm install` before you start the server.>');
    assert.equal(lookupTM(tm, 'Welcome to the site. This is the first paragraph.', 'fr', tmMethodKey(pc)),
      'FR<Welcome to the site. This is the first paragraph.>');
    assert.equal(lookupTM(tm, 'My First Post', 'fr', tmMethodKey(pc.fallback)), 'FB:My First Post');

    // The file is done: lock advanced.
    const lock = JSON.parse(fs.readFileSync(path.join(dir, '.champollion-content.lock'), 'utf-8'));
    assert.ok(lock['posts/hello.md:fr']);
    assert.equal(result.failed, 0);
    assert.deepEqual(
      { attempted: result.fallback[0].attempted, accepted: result.fallback[0].accepted },
      { attempted: 3, accepted: 3 },
      'one field + two blocks',
    );

    // Re-processing serves every block from the two caches: nobody is re-asked.
    resetFakes();
    await captureJson(() => runContentSync(opts({ forceContent: true })));
    assert.equal(Primary.contentCalls.length, 0);
    assert.equal(Secondary.contentCalls.length, 0);
    assert.equal(Primary.batchCalls.length, 0);
  });

  it('the source text, unmarked, only when both methods fail a block; lock pending, nothing cached for it', async () => {
    Secondary.blockBehavior = (text) => (text.includes('DROPME') ? undefined : `FB<${text}>`);
    const { records } = await captureJson(() => runContentSync(opts()));
    const out = fs.readFileSync(path.join(dir, 'posts', 'hello.fr.md'), 'utf-8');
    assert.match(out, /^DROPME this paragraph/m);
    assert.doesNotMatch(out, /\[EN\]/);
    assert.match(out, /FB<Run `npm install`/);
    const lock = JSON.parse(fs.readFileSync(path.join(dir, '.champollion-content.lock'), 'utf-8'));
    assert.match(lock['posts/hello.md:fr'], /^pending:/, 'the file re-fires next sync, and stays the tool\'s');
    const tm = loadTM(dir);
    assert.equal(Object.values(tm).some(e => e && typeof e.t === 'string' && e.t.includes('[EN]')), false);
    assert.ok(records.some(r => r.level === 'warn' && /neither the primary \(test-fb-primary\) nor its fallback/.test(r.message)));
  });

  it('page mode: a page the primary hollows is translated by the fallback', async () => {
    Primary.pageBehavior = () => ' … ';
    Secondary.pageBehavior = (body) => `FB-PAGE<${body}>`;
    await captureJson(() => runContentSync(opts({ pairs: pairsFor({ contentSegmentation: 'page' }) })));
    const out = fs.readFileSync(path.join(dir, 'posts', 'hello.fr.md'), 'utf-8');
    assert.match(out, /FB-PAGE</);
  });

  it('--max-cost skips a content fallback batch; the primary\'s output stands as without one', async () => {
    Secondary.pricePerKey = 10;
    const budget = createFallbackBudget({ maxCost: 0.01, committed: 0 });
    // Title hollowed by the primary (asked twice) and the fallback skipped →
    // the title keeps its source text; the page is written, its lock pending.
    const { result, records } = await captureJson(() => runContentSync(opts({ fallbackBudget: budget })));
    assert.equal(result.failed, 0);
    assert.equal(Secondary.batchCalls.length, 0);
    const out = fs.readFileSync(path.join(dir, 'posts', 'hello.fr.md'), 'utf-8');
    assert.match(out, /^title: "?My First Post"?$/m);
    const lock = JSON.parse(fs.readFileSync(path.join(dir, '.champollion-content.lock'), 'utf-8'));
    assert.match(lock['posts/hello.md:fr'], /^pending:/);
    assert.ok(records.some(r => r.level === 'warn' && /fallback \(test-fb-secondary\) was skipped/.test(r.message)));
  });
});

// =================================================================
// Docusaurus (JSON keys + body)
// =================================================================

describe('fallback: Docusaurus sync', () => {
  let dir;
  beforeEach(() => {
    resetFakes();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-fallback-docu-'));
    fs.mkdirSync(path.join(dir, 'i18n', 'en'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'i18n', 'en', 'code.json'), JSON.stringify({
      greet: { message: 'Hello, {name}!' },
      bye: { message: 'Goodbye' },
    }));
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'intro.md'), '---\ntitle: Intro page\n---\nWelcome here, reader.\n\nDROPME gone.\n');
    Primary.blockBehavior = (text) => (text.includes('DROPME') ? undefined : `FR<${text}>`);
    Secondary.blockBehavior = (text) => `FB<${text}>`;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('JSON keys and body blocks the primary fails come from the fallback', async () => {
    const pc = resolvePairs({
      inputLocale: 'en', model: 'm', defaultMethod: 'llm', resolvedLanguages: {},
      pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-secondary' } } },
    }).get('en:fr');
    const { records } = await captureJson(() => runDocusaurusSync(
      { dryRun: false, cliArgs: {} },
      { inputLocale: 'en', localesDir: path.join(dir, 'i18n'), fallbackPrefix: '[EN] ', forceKeys: [] },
      dir,
      async () => ({ apiKey: 'k', pairEntries: [['en:fr', pc]] }),
    ));
    const code = JSON.parse(fs.readFileSync(path.join(dir, 'i18n', 'fr', 'code.json'), 'utf-8'));
    assert.equal(code.greet.message, 'Bonjour, {name} !');
    assert.equal(code.bye.message, 'Au revoir');
    const doc = fs.readFileSync(
      path.join(dir, 'i18n', 'fr', 'docusaurus-plugin-content-docs', 'current', 'intro.md'), 'utf-8');
    assert.match(doc, /FB<DROPME gone\.>/);
    assert.doesNotMatch(doc, /\[EN\]/);
    const summary = records.find(r => r.level === 'summary');
    assert.equal(summary.fallback[0].accepted, 1);
    assert.equal(summary.content.fallback[0].accepted, 1);
  });
});

// =================================================================
// champollion status
// =================================================================

describe('fallback: champollion status', () => {
  let dir;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('shows the fallback under its pair (human and --json)', async () => {
    dir = tempProject({
      pairs: {
        'en:fr': {
          method: 'api', endpoint: 'http://127.0.0.1:8378/translate',
          fallback: { method: 'llm-coached', model: 'google/gemini-2.5-flash' },
        },
      },
    });
    const { lines } = await captureText(() => runStatus({}, dir));
    const methodLine = lines.findIndex(l => /^\s+method: api/.test(l));
    assert.ok(methodLine >= 0);
    assert.match(lines[methodLine + 1], /^\s+fallback: llm-coached {2}\| {2}model: google\/gemini-2\.5-flash/);

    const json = await captureText(() => runStatus({ json: true }, dir));
    output.setMode('default');
    const doc = JSON.parse(json.lines.join('\n'));
    assert.deepEqual(doc.pairs[0].fallback, {
      method: 'llm-coached', model: 'google/gemini-2.5-flash', provider: 'openrouter', endpoint: null,
      // No coaching configured for it (status names a fallback's coaching).
      coaching: null,
      // Nothing synced yet: no value in the files came from the fallback.
      valuesInFiles: 0,
    });
  });
});

// =================================================================
// champollion serve
// =================================================================

describe('fallback: champollion serve', () => {
  it('a key the primary damaged is served from the fallback, and meta says so', async () => {
    resetFakes();
    const dir = tempProject({
      languages: [],
      pairs: { 'en:fr': { method: 'test-fb-primary', fallback: { method: 'test-fb-secondary' } } },
    });
    let handle;
    try {
      ({ result: handle } = await captureText(() => startServeServer({
        cwd: dir, port: 0, token: 'serve-secret-token-1234', noAuth: false,
      })));
      const { lines, result: res } = await captureText(async () => {
        const r = await fetch(handle.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer serve-secret-token-1234' },
          body: JSON.stringify({
            source_locale: 'en', target_locale: 'fr', method: 'default',
            keys: { greeting: 'Hello, {name}!', farewell: 'Goodbye' },
          }),
        });
        return { status: r.status, json: await r.json() };
      });
      assert.equal(res.status, 200, lines.join('\n'));
      assert.deepEqual(res.json.translations, { greeting: 'Bonjour, {name} !', farewell: 'Au revoir' });
      assert.equal(res.json.meta.fallback.method, 'test-fb-secondary');
      assert.equal(res.json.meta.fallback.accepted, 1);
      assert.equal(res.json.meta.cost_usd, null, 'an unpriced fallback that ran makes the cost unknown, never $0');
    } finally {
      if (handle) await handle.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
