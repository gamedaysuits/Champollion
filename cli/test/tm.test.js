import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadTM,
  saveTM,
  lookupTM,
  storeTM,
  evictTM,
  isTMDirty,
  partitionByTM,
  tmSize,
  cacheKey,
  tmMethodKey,
  TM_VERSION,
  TM_DIR,
  TM_FILENAME,
} from '../lib/tm.js';

// -----------------------------------------------------------------
// Helper — create a temp directory for each test
// -----------------------------------------------------------------

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-test-'));
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// -----------------------------------------------------------------
// cacheKey — deterministic hash generation
// -----------------------------------------------------------------

test('cacheKey: produces consistent hash for same input', () => {
  const k1 = cacheKey('Hello', 'fr', 'llm');
  const k2 = cacheKey('Hello', 'fr', 'llm');
  assert.equal(k1, k2);
});

test('cacheKey: different source values produce different hashes', () => {
  const k1 = cacheKey('Hello', 'fr', 'llm');
  const k2 = cacheKey('Goodbye', 'fr', 'llm');
  assert.notEqual(k1, k2);
});

test('cacheKey: different locales produce different hashes', () => {
  const k1 = cacheKey('Hello', 'fr', 'llm');
  const k2 = cacheKey('Hello', 'de', 'llm');
  assert.notEqual(k1, k2);
});

test('cacheKey: different methods produce different hashes', () => {
  const k1 = cacheKey('Hello', 'fr', 'llm');
  const k2 = cacheKey('Hello', 'fr', 'google-translate');
  assert.notEqual(k1, k2);
});

test('cacheKey: returns 16-character hex string', () => {
  const k = cacheKey('test', 'fr', 'llm');
  assert.equal(k.length, 16);
  assert.ok(/^[0-9a-f]{16}$/.test(k));
});

// -----------------------------------------------------------------
// loadTM / saveTM — file lifecycle
// -----------------------------------------------------------------

test('loadTM: returns empty TM for non-existent directory', () => {
  const tm = loadTM('/tmp/nonexistent-champollion-test-dir-xyz');
  assert.ok(tm._meta);
  assert.equal(tm._meta.version, TM_VERSION);
  assert.equal(tmSize(tm), 0);
});

test('loadTM + saveTM: round-trips TM to disk', () => {
  const dir = createTempDir();
  try {
    const tm = loadTM(dir);
    storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
    saveTM(dir, tm);

    // Reload from disk
    const tm2 = loadTM(dir);
    assert.equal(lookupTM(tm2, 'Hello', 'fr', 'llm'), 'Bonjour');
  } finally {
    cleanupTempDir(dir);
  }
});

test('saveTM: creates .champollion/ directory if missing', () => {
  const dir = createTempDir();
  try {
    const tm = loadTM(dir);
    storeTM(tm, 'Test', 'de', 'llm', 'Test');
    saveTM(dir, tm);

    assert.ok(fs.existsSync(path.join(dir, TM_DIR)));
    assert.ok(fs.existsSync(path.join(dir, TM_DIR, TM_FILENAME)));
  } finally {
    cleanupTempDir(dir);
  }
});

// A corrupt TM must FAIL LOUD. "Starting fresh" discards every cached
// translation, so the next sync re-translates the entire project at full API
// cost — this test used to assert exactly that silent fallback. Restoring the
// file is usually the cheap, correct move, so we stop and say so.
test('loadTM: REFUSES a corrupt TM rather than silently discarding the cache', () => {
  const dir = createTempDir();
  try {
    const tmDir = path.join(dir, TM_DIR);
    fs.mkdirSync(tmDir, { recursive: true });
    fs.writeFileSync(path.join(tmDir, TM_FILENAME), '{ invalid json!!!', 'utf-8');

    assert.throws(
      () => loadTM(dir),
      (err) => {
        assert.equal(err.code, 'CHAMPOLLION_TM_UNREADABLE');
        assert.match(err.message, /full API cost/);
        return true;
      },
    );
  } finally {
    cleanupTempDir(dir);
  }
});

test('loadTM: CHAMPOLLION_ALLOW_CACHE_RESET=1 is the explicit opt-out', () => {
  const dir = createTempDir();
  const saved = process.env.CHAMPOLLION_ALLOW_CACHE_RESET;
  process.env.CHAMPOLLION_ALLOW_CACHE_RESET = '1';
  try {
    const tmDir = path.join(dir, TM_DIR);
    fs.mkdirSync(tmDir, { recursive: true });
    fs.writeFileSync(path.join(tmDir, TM_FILENAME), '{ invalid json!!!', 'utf-8');

    const tm = loadTM(dir);
    assert.ok(tm._meta, 'opt-out returns an empty TM');
    assert.equal(tmSize(tm), 0);
  } finally {
    if (saved === undefined) delete process.env.CHAMPOLLION_ALLOW_CACHE_RESET;
    else process.env.CHAMPOLLION_ALLOW_CACHE_RESET = saved;
    cleanupTempDir(dir);
  }
});

test('loadTM: handles version mismatch by starting fresh', () => {
  const dir = createTempDir();
  try {
    const tmDir = path.join(dir, TM_DIR);
    fs.mkdirSync(tmDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmDir, TM_FILENAME),
      JSON.stringify({ _meta: { version: 9999 }, old: 'data' }),
      'utf-8'
    );

    const tm = loadTM(dir);
    assert.equal(tm._meta.version, TM_VERSION);
    assert.equal(tmSize(tm), 0, 'Old entries should be discarded');
  } finally {
    cleanupTempDir(dir);
  }
});

// -----------------------------------------------------------------
// lookupTM / storeTM — cache operations
// -----------------------------------------------------------------

test('lookupTM: returns null for cache miss', () => {
  const tm = loadTM('/tmp/nonexistent');
  assert.equal(lookupTM(tm, 'Hello', 'fr', 'llm'), null);
});

test('storeTM + lookupTM: stores and retrieves translation', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
  assert.equal(lookupTM(tm, 'Hello', 'fr', 'llm'), 'Bonjour');
});

test('storeTM: overwrites existing entry for same key', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
  storeTM(tm, 'Hello', 'fr', 'llm', 'Salut');
  assert.equal(lookupTM(tm, 'Hello', 'fr', 'llm'), 'Salut');
});

test('lookupTM: different method = cache miss', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
  assert.equal(lookupTM(tm, 'Hello', 'fr', 'google-translate'), null);
});

// -----------------------------------------------------------------
// partitionByTM — bulk partition
// -----------------------------------------------------------------

test('partitionByTM: separates hits and misses', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
  storeTM(tm, 'Goodbye', 'fr', 'llm', 'Au revoir');

  const sourceFlat = {
    'key1': 'Hello',
    'key2': 'World',
    'key3': 'Goodbye',
  };

  const { hits, misses } = partitionByTM(
    tm, sourceFlat, ['key1', 'key2', 'key3'], 'fr', 'llm'
  );

  assert.equal(Object.keys(hits).length, 2);
  assert.equal(hits['key1'], 'Bonjour');
  assert.equal(hits['key3'], 'Au revoir');
  assert.deepEqual(misses, ['key2']);
});

test('partitionByTM: all misses when TM is empty', () => {
  const tm = loadTM('/tmp/nonexistent');
  const sourceFlat = { 'k1': 'A', 'k2': 'B' };

  const { hits, misses } = partitionByTM(tm, sourceFlat, ['k1', 'k2'], 'fr', 'llm');

  assert.equal(Object.keys(hits).length, 0);
  assert.deepEqual(misses, ['k1', 'k2']);
});

test('partitionByTM: handles non-string source values', () => {
  const tm = loadTM('/tmp/nonexistent');
  const sourceFlat = { 'k1': 42 };

  const { hits, misses } = partitionByTM(tm, sourceFlat, ['k1'], 'fr', 'llm');

  assert.equal(Object.keys(hits).length, 0);
  assert.deepEqual(misses, ['k1']);
});

// -----------------------------------------------------------------
// tmSize — entry counting
// -----------------------------------------------------------------

test('tmSize: returns 0 for empty TM', () => {
  const tm = loadTM('/tmp/nonexistent');
  assert.equal(tmSize(tm), 0);
});

test('tmSize: counts entries excluding metadata', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'A', 'fr', 'llm', 'A_fr');
  storeTM(tm, 'B', 'de', 'llm', 'B_de');
  assert.equal(tmSize(tm), 2);
});

// -----------------------------------------------------------------
// evictTM + isTMDirty — poisoned-entry eviction and persistence signal
// -----------------------------------------------------------------

test('evictTM: removes an existing entry and reports it', () => {
  const tm = loadTM('/tmp/nonexistent');
  storeTM(tm, 'for translating', 'zh', 'llm', '吗');
  assert.equal(evictTM(tm, 'for translating', 'zh', 'llm'), true);
  assert.equal(lookupTM(tm, 'for translating', 'zh', 'llm'), null);
});

test('evictTM: returns false for a missing entry', () => {
  const tm = loadTM('/tmp/nonexistent');
  assert.equal(evictTM(tm, 'never stored', 'zh', 'llm'), false);
});

test('isTMDirty: store and evict both mark the TM dirty; saveTM clears it', () => {
  const dir = createTempDir();
  try {
    const tm = loadTM(dir);
    assert.equal(isTMDirty(tm), false);

    storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
    assert.equal(isTMDirty(tm), true);

    saveTM(dir, tm);
    assert.equal(isTMDirty(tm), false);

    // Eviction alone must re-mark dirty — a size comparison would miss an
    // eviction-only run and never persist the healed cache.
    evictTM(tm, 'Hello', 'fr', 'llm');
    assert.equal(isTMDirty(tm), true);

    // Evict + re-store under the same cache key leaves the size unchanged
    // but must still read as dirty.
    saveTM(dir, tm);
    storeTM(tm, 'Hello', 'fr', 'llm', 'Salut');
    evictTM(tm, 'Hello', 'fr', 'llm');
    storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
    assert.equal(isTMDirty(tm), true);
  } finally {
    cleanupTempDir(dir);
  }
});

// -----------------------------------------------------------------
// tmMethodKey — TM identity must reflect everything that shapes output
// -----------------------------------------------------------------
// WHY: keying the TM on the bare method name silently re-served old-style
// translations after the user switched model, register, or coaching.
// The method key folds all of those in; changing any component is a miss.

test('tmMethodKey: is stable for the same pair config', () => {
  const pair = { method: 'llm', model: 'google/gemini-3.5-flash', register: 'Formal French.' };
  assert.equal(tmMethodKey(pair), tmMethodKey({ ...pair }));
});

test('tmMethodKey: has the method|model|register|coaching shape', () => {
  const key = tmMethodKey({ method: 'llm', model: 'google/gemini-3.5-flash', registerPreset: 'formal' });
  assert.equal(key, 'llm|google/gemini-3.5-flash|formal|');
});

test('tmMethodKey: defaults method to llm and leaves unset parts empty', () => {
  assert.equal(tmMethodKey({}), 'llm|||');
});

test('tmMethodKey: model change produces a different key', () => {
  const base = { method: 'llm', register: 'Formal.' };
  const k1 = tmMethodKey({ ...base, model: 'google/gemini-3.5-flash' });
  const k2 = tmMethodKey({ ...base, model: 'openai/gpt-4o' });
  assert.notEqual(k1, k2);
});

test('tmMethodKey: register text change produces a different key', () => {
  const base = { method: 'llm', model: 'm' };
  const k1 = tmMethodKey({ ...base, register: 'Formal, use vous.' });
  const k2 = tmMethodKey({ ...base, register: 'Casual, use tu.' });
  assert.notEqual(k1, k2);
});

test('tmMethodKey: registerPreset is used verbatim (human-readable), custom text is hashed', () => {
  const preset = tmMethodKey({ method: 'llm', model: 'm', registerPreset: 'casual-tu', register: 'Casual, use tu.' });
  assert.ok(preset.includes('|casual-tu|'), `preset key should be readable, got: ${preset}`);
  const custom = tmMethodKey({ method: 'llm', model: 'm', register: 'Casual, use tu.' });
  assert.ok(!custom.includes('Casual, use tu.'), 'custom register text must be hashed, not embedded');
  assert.match(custom, /^llm\|m\|[0-9a-f]{8}\|$/);
});

test('tmMethodKey: coaching prompt changes the key ONLY for llm-coached pairs', () => {
  const coachedA = tmMethodKey({ method: 'llm-coached', model: 'm', coachingPrompt: 'Use SRO orthography.' });
  const coachedB = tmMethodKey({ method: 'llm-coached', model: 'm', coachingPrompt: 'Use syllabics.' });
  assert.notEqual(coachedA, coachedB, 'editing the coaching prompt must invalidate the cache');

  // Non-coached methods never inject coaching — the component stays empty.
  const plainA = tmMethodKey({ method: 'llm', model: 'm', coachingPrompt: 'Use SRO orthography.' });
  const plainB = tmMethodKey({ method: 'llm', model: 'm', coachingPrompt: 'Use syllabics.' });
  assert.equal(plainA, plainB);
});

test('tmMethodKey: structured plugin coachingData is fingerprinted for coached pairs', () => {
  const base = { method: 'llm-coached', model: 'm', coachingPrompt: 'Coach.' };
  const k1 = tmMethodKey({ ...base, coachingData: { dictionary: { hello: 'tânisi' } } });
  const k2 = tmMethodKey({ ...base, coachingData: { dictionary: { hello: 'wâciyê' } } });
  assert.notEqual(k1, k2);
});

test('tmMethodKey: entries stored under one method key are invisible to another', () => {
  const tm = loadTM('/tmp/nonexistent');
  const flashKey = tmMethodKey({ method: 'llm', model: 'flash' });
  const proKey = tmMethodKey({ method: 'llm', model: 'pro' });
  storeTM(tm, 'Hello', 'fr', flashKey, 'Bonjour');
  assert.equal(lookupTM(tm, 'Hello', 'fr', proKey), null, 'model switch must be a cache miss');
  assert.equal(lookupTM(tm, 'Hello', 'fr', flashKey), 'Bonjour');
});

test('isTMDirty: dirty marker never leaks into the saved JSON file', () => {
  const dir = createTempDir();
  try {
    const tm = loadTM(dir);
    storeTM(tm, 'Hello', 'fr', 'llm', 'Bonjour');
    saveTM(dir, tm);

    const raw = fs.readFileSync(path.join(dir, TM_DIR, TM_FILENAME), 'utf-8');
    assert.ok(!raw.includes('dirty'));
    const reloaded = loadTM(dir);
    assert.equal(isTMDirty(reloaded), false);
    assert.equal(lookupTM(reloaded, 'Hello', 'fr', 'llm'), 'Bonjour');
  } finally {
    cleanupTempDir(dir);
  }
});
