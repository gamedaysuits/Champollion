/**
 * --redo / --fresh: one way to say "translate this again", mapped onto the
 * six older flags (which keep working) so sync has one set of semantics.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyRedo, splitKeyList } from '../lib/redo.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

describe('applyRedo', () => {
  it('maps each scope onto the flag it replaces, cache still serving', () => {
    const a = { redo: ['all'] };
    assert.equal(applyRedo(a), null);
    assert.equal(a.force, true);
    assert.equal(a['no-tm'], undefined, 'a redo alone is cheap: the cache still serves');

    const k = { redo: ['keys:nav.home, nav.about'], 'force-keys': 'footer' };
    assert.equal(applyRedo(k), null);
    assert.equal(k['force-keys'], 'footer,nav.home,nav.about');

    const c = { redo: ['content'] };
    applyRedo(c);
    assert.equal(c['force-content'], true);

    const f = { redo: ['files:docs/intro.md'] };
    applyRedo(f);
    assert.deepEqual(f.files, ['docs/intro.md']);
    assert.equal(f['force-content'], true);
    assert.equal(f.retranslate, undefined);
  });

  it('--fresh bills again: files become --retranslate, keys/all bypass the cache', () => {
    const f = { redo: ['files:posts/**'], fresh: true };
    applyRedo(f);
    assert.deepEqual(f.retranslate, ['posts/**']);
    assert.equal(f['no-tm'], undefined, 'retranslate already bypasses the cache for those files');

    const a = { redo: ['all'], fresh: true };
    applyRedo(a);
    assert.equal(a.force, true);
    assert.equal(a['no-tm'], true);

    const only = { fresh: true };
    applyRedo(only);
    assert.equal(only['no-tm'], true);
  });

  it('a comma inside a key is written \\, (gettext keys are sentences)', () => {
    const a = { redo: ['keys:Welcome\\, %(name)s,nav.home'] };
    applyRedo(a);
    assert.deepEqual(splitKeyList(a['force-keys']), ['Welcome, %(name)s', 'nav.home']);
    assert.deepEqual(splitKeyList('a, b'), ['a', 'b']);
  });

  it('refuses scopes it does not know, and scopes missing their value', () => {
    assert.match(applyRedo({ redo: ['everything'] }), /unknown scope/);
    assert.match(applyRedo({ redo: ['keys'] }), /needs a value/);
    assert.match(applyRedo({ redo: ['all:x'] }), /takes no value/);
    assert.match(applyRedo({ redo: [''] }), /needs a scope/);
  });

  it('the CLI refuses a bad scope before doing anything', () => {
    const r = spawnSync(process.execPath, [CLI, 'sync', '--redo', 'nope'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown scope/);
  });
});

describe('champollion network', () => {
  it('routes to the same command as the top-level name', () => {
    const viaNetwork = spawnSync(process.execPath, [CLI, 'network', 'card', 'fra', '--json'], { encoding: 'utf-8' });
    const direct = spawnSync(process.execPath, [CLI, 'card', 'fra', '--json'], { encoding: 'utf-8' });
    assert.equal(viaNetwork.status, 0, viaNetwork.stderr);
    assert.equal(viaNetwork.stdout, direct.stdout);
  });

  it('lists its commands, and refuses one it does not have', () => {
    const list = spawnSync(process.execPath, [CLI, 'network'], { encoding: 'utf-8' });
    assert.equal(list.status, 0);
    assert.match(list.stdout, /recommend/);
    const bad = spawnSync(process.execPath, [CLI, 'network', 'sync'], { encoding: 'utf-8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Unknown network command/);
  });
});

describe('model switch notice', () => {
  it('stops once a locale was fully re-translated under the current model', async () => {
    const { findModelSwitchStrandedEntries, storeTM, tmMethodKey } = await import('../lib/tm.js');
    const tm = { _meta: { version: 1 } };
    const oldPair = { target: 'fr', method: 'local', model: 'stub-1' };
    const newPair = { target: 'fr', method: 'local', model: 'stub-2' };
    for (const s of ['a', 'b', 'gone']) storeTM(tm, s, 'fr', tmMethodKey(oldPair), `old ${s}`);
    for (const s of ['a', 'b']) storeTM(tm, s, 'fr', tmMethodKey(newPair), `new ${s}`);
    assert.equal(findModelSwitchStrandedEntries(tm, [newPair]).length, 1, 'leftovers outnumber the new model');
    tm._meta.switchedTo = { fr: tmMethodKey(newPair) };
    assert.equal(findModelSwitchStrandedEntries(tm, [newPair]).length, 0);
  });
});
