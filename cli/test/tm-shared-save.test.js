/**
 * Two runs sharing one translation memory file.
 *
 * A run loads the cache when it starts and saves when it ends. saveTM used
 * to write the whole file from memory, so the run that saved last erased
 * every entry the other had written meanwhile — paid translations gone, and
 * pruned entries brought back. The 2026-10-06 docs sync paid again for
 * 3,640 paragraph translations whose English had not changed since 08-28.
 * saveTM now merges with the file on disk under a lock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadTM, saveTM, storeTM, evictTM, lookupTM, tmSize, describeTMMerge, TM_DIR, TM_FILENAME,
} from '../lib/tm.js';

const M = 'llm|test-model||';
const TM_JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'tm.js');

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-shared-'));
  const tm = loadTM(dir);
  storeTM(tm, 'Hello', 'fr', M, 'Bonjour');
  storeTM(tm, 'Goodbye', 'fr', M, 'Au revoir');
  saveTM(dir, tm);
  return dir;
}

// Two saves within one mtime tick must still be seen as a change: bump the
// file's mtime the way a slower second writer would.
function touchLater(dir) {
  const p = path.join(dir, TM_DIR, TM_FILENAME);
  const t = new Date(Date.now() + 2000);
  fs.utimesSync(p, t, t);
}

test('two runs that load the same cache keep each other\'s new translations', () => {
  const dir = project();
  const a = loadTM(dir);
  const b = loadTM(dir);
  storeTM(a, 'Yes', 'fr', M, 'Oui');
  storeTM(b, 'No', 'fr', M, 'Non');
  saveTM(dir, b);
  touchLater(dir);
  const merged = saveTM(dir, a);
  assert.deepEqual(merged, { keptFromOthers: 1, removedByOthers: 0 });
  const after = loadTM(dir);
  assert.equal(lookupTM(after, 'Yes', 'fr', M), 'Oui');
  assert.equal(lookupTM(after, 'No', 'fr', M), 'Non', 'the run that saved first must not be erased');
  assert.equal(tmSize(after), 4);
});

test('an entry another run pruned is not brought back by a run that loaded it earlier', () => {
  const dir = project();
  const sync = loadTM(dir);      // a long sync starts
  const prune = loadTM(dir);     // `tm prune` runs meanwhile
  evictTM(prune, 'Hello', 'fr', M);
  saveTM(dir, prune);
  touchLater(dir);
  storeTM(sync, 'Yes', 'fr', M, 'Oui');
  const merged = saveTM(dir, sync);
  assert.equal(merged.removedByOthers, 1);
  const after = loadTM(dir);
  assert.equal(lookupTM(after, 'Hello', 'fr', M), null, 'the pruned entry stays pruned');
  assert.equal(lookupTM(after, 'Yes', 'fr', M), 'Oui');
  assert.equal(lookupTM(after, 'Goodbye', 'fr', M), 'Au revoir');
});

test('where both runs wrote the same entry, the run saving now wins', () => {
  const dir = project();
  const a = loadTM(dir);
  const b = loadTM(dir);
  storeTM(b, 'Hello', 'fr', M, 'Salut');
  saveTM(dir, b);
  touchLater(dir);
  storeTM(a, 'Hello', 'fr', M, 'Bonjour à vous');
  saveTM(dir, a);
  assert.equal(lookupTM(loadTM(dir), 'Hello', 'fr', M), 'Bonjour à vous');
});

test('an eviction does not remove a newer translation another run cached for the same key', () => {
  const dir = project();
  const a = loadTM(dir);
  const b = loadTM(dir);
  storeTM(b, 'Hello', 'fr', M, 'Salut');      // b re-translates it
  saveTM(dir, b);
  touchLater(dir);
  evictTM(a, 'Hello', 'fr', M);               // a's gate refused the OLD text
  saveTM(dir, a);
  assert.equal(lookupTM(loadTM(dir), 'Hello', 'fr', M), 'Salut');
});

test('a _meta field another run set is kept; one this run set wins', () => {
  const dir = project();
  const a = loadTM(dir);
  const b = loadTM(dir);
  b._meta.memorized = { fr: ['x'] };
  storeTM(b, 'No', 'fr', M, 'Non');
  saveTM(dir, b);
  touchLater(dir);
  a._meta.coachingKeys = { fr: { k: 'v' } };
  storeTM(a, 'Yes', 'fr', M, 'Oui');
  saveTM(dir, a);
  const after = loadTM(dir);
  assert.deepEqual(after._meta.memorized, { fr: ['x'] });
  assert.deepEqual(after._meta.coachingKeys, { fr: { k: 'v' } });
});

test('a single run with the file unchanged saves exactly what it holds', () => {
  const dir = project();
  const tm = loadTM(dir);
  storeTM(tm, 'Yes', 'fr', M, 'Oui');
  const merged = saveTM(dir, tm);
  assert.deepEqual(merged, { keptFromOthers: 0, removedByOthers: 0 });
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, TM_DIR, TM_FILENAME), 'utf-8'));
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(tm)));
});

test('a run that found no cache keeps one another run created meanwhile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-shared-'));
  const a = loadTM(dir);          // no file yet
  const b = loadTM(dir);
  storeTM(b, 'No', 'fr', M, 'Non');
  saveTM(dir, b);                 // b creates it
  storeTM(a, 'Yes', 'fr', M, 'Oui');
  saveTM(dir, a);
  const after = loadTM(dir);
  assert.equal(lookupTM(after, 'No', 'fr', M), 'Non');
  assert.equal(lookupTM(after, 'Yes', 'fr', M), 'Oui');
});

test('a TM object built by hand, not loaded, replaces the file as a save always did', () => {
  const dir = project();
  const handBuilt = { _meta: { version: 1 }, k1: { t: 'x', ts: '2026-01-01T00:00:00Z', l: 'fr', m: M } };
  saveTM(dir, handBuilt);
  assert.equal(tmSize(loadTM(dir)), 1);
});

test('a cache in another format on disk is replaced, never merged into', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-shared-'));
  fs.mkdirSync(path.join(dir, TM_DIR));
  fs.writeFileSync(path.join(dir, TM_DIR, TM_FILENAME), JSON.stringify({ _meta: { version: 0 }, old: { t: 'x' } }));
  const errors = [];
  const orig = console.error;
  console.error = (m) => errors.push(String(m));
  try {
    const tm = loadTM(dir);
    storeTM(tm, 'Yes', 'fr', M, 'Oui');
    saveTM(dir, tm);
  } finally {
    console.error = orig;
  }
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, TM_DIR, TM_FILENAME), 'utf-8'));
  assert.equal(onDisk.old, undefined);
  assert.equal(tmSize(loadTM(dir)), 1);
  assert.ok(!errors.some(e => e.includes('while this run worked')), 'the replacement was known at load, not news at save');
});

test('a lock left by a process that no longer exists is taken over', () => {
  const dir = project();
  const lock = path.join(dir, TM_DIR, `${TM_FILENAME}.lock`);
  // PIDs are below 2^22 on Linux and 99999 on macOS by default.
  fs.writeFileSync(lock, JSON.stringify({ pid: 4194303, at: new Date().toISOString() }));
  const tm = loadTM(dir);
  storeTM(tm, 'Yes', 'fr', M, 'Oui');
  const started = Date.now();
  saveTM(dir, tm);
  assert.ok(Date.now() - started < 5000, 'did not wait out the full lock timeout');
  assert.equal(fs.existsSync(lock), false, 'the lock is released after the save');
  assert.equal(lookupTM(loadTM(dir), 'Yes', 'fr', M), 'Oui');
});

test('two processes saving at the same time lose nothing', async () => {
  const dir = project();
  const child = (tag) => new Promise((resolve, reject) => {
    const code = `
      const { loadTM, storeTM, saveTM } = await import(${JSON.stringify(TM_JS)});
      const tm = loadTM(${JSON.stringify(dir)});
      for (let i = 0; i < 200; i++) storeTM(tm, '${tag} ' + i, 'fr', ${JSON.stringify(M)}, '${tag}-fr ' + i);
      await new Promise(r => setTimeout(r, 300));   // both have loaded before either saves
      saveTM(${JSON.stringify(dir)}, tm);
    `;
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`child ${tag} exited ${c}: ${err}`))));
  });
  await Promise.all([child('a'), child('b')]);
  const after = loadTM(dir);
  assert.equal(tmSize(after), 2 + 400, 'every entry from both processes, plus the two from before');
  assert.equal(fs.existsSync(path.join(dir, TM_DIR, `${TM_FILENAME}.lock`)), false);
});

test('describeTMMerge says what a save kept from another run', () => {
  assert.equal(describeTMMerge({ keptFromOthers: 0, removedByOthers: 0 }), '');
  assert.equal(describeTMMerge(undefined), '');
  assert.equal(describeTMMerge({ keptFromOthers: 3, removedByOthers: 2 }),
    '; kept 3 another run cached meanwhile, left out 2 another run removed');
});
