/**
 * Source-echo requeue suppression (lib/diff.js isConfirmedEcho).
 *
 * THE BUG THIS PREVENTS: a key whose target value legitimately equals its
 * source (brand names, "OK", technical terms) re-entered toProcess on EVERY
 * sync via the equals-source ("untranslated") reason. The fix: diffLocale
 * accepts an isConfirmedEcho(key, sourceValue) callback, consulted lazily
 * only for actual echo candidates — when the TM proves the pipeline itself
 * produced the echo (lookupTM === sourceValue), the key is not requeued.
 * Missing/changed/forced reasons still queue regardless.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { diffLocale } from '../lib/diff.js';
import { storeTM, lookupTM, tmMethodKey } from '../lib/tm.js';

const PREFIX = '[EN] ';

describe('diffLocale — confirmed-echo suppression', () => {
  it('an echo key confirmed by the callback is not queued for the echo reason', () => {
    const source = { brand: 'Champollion', normal: 'Hello there' };
    const target = { brand: 'Champollion', normal: 'Bonjour à tous' };

    const diff = diffLocale(source, target, PREFIX, [], [], () => true);

    assert.deepEqual(diff.untranslated, []);
    assert.deepEqual(diff.toProcess, []);
  });

  it('an echo without confirmation still queues (no callback / callback false)', () => {
    const source = { brand: 'Champollion' };
    const target = { brand: 'Champollion' };

    const noCallback = diffLocale(source, target, PREFIX, [], []);
    assert.deepEqual(noCallback.untranslated, ['brand']);
    assert.deepEqual(noCallback.toProcess, ['brand']);

    const denied = diffLocale(source, target, PREFIX, [], [], () => false);
    assert.deepEqual(denied.untranslated, ['brand']);
    assert.deepEqual(denied.toProcess, ['brand']);
  });

  it('a changed-source echo still queues — changedKeys wins over suppression', () => {
    const source = { brand: 'Champollion' };
    const target = { brand: 'Champollion' };

    const diff = diffLocale(source, target, PREFIX, [], ['brand'], () => true);

    // Suppressed from the echo reason…
    assert.deepEqual(diff.untranslated, []);
    // …but the changed-source reason still fires.
    assert.deepEqual(diff.changed, ['brand']);
    assert.deepEqual(diff.toProcess, ['brand']);
  });

  it('a forced echo still queues — forceKeys wins over suppression', () => {
    const source = { brand: 'Champollion' };
    const target = { brand: 'Champollion' };

    const diff = diffLocale(source, target, PREFIX, ['brand'], [], () => true);

    assert.deepEqual(diff.untranslated, []);
    assert.deepEqual(diff.forced, ['brand']);
    assert.deepEqual(diff.toProcess, ['brand']);
  });

  it('the callback is invoked lazily — only for keys that would queue as echoes', () => {
    const calls = [];
    const source = {
      missing: 'Not in target',          // missing → never an echo candidate
      fallback: 'Marked value',          // [EN]-prefixed → needsTranslation, not echo
      ok: 'OK',                          // <= 2 chars → skipped before the callback
      translated: 'Hello there',         // differs → not an echo
      echo: 'Champollion',               // the only true echo candidate
    };
    const target = {
      fallback: `${PREFIX}Marked value`,
      ok: 'OK',
      translated: 'Bonjour à tous',
      echo: 'Champollion',
    };

    diffLocale(source, target, PREFIX, [], [], (key, sourceValue) => {
      calls.push([key, sourceValue]);
      return true;
    });

    assert.deepEqual(calls, [['echo', 'Champollion']]);
  });

  it('wires up like the sync paths: TM lookup === sourceValue confirms the echo', () => {
    const pairConfig = { method: 'llm', model: 'x/y', target: 'fr' };
    const tmKey = tmMethodKey(pairConfig);
    const tm = { _meta: { version: 1 } };

    const source = { brand: 'Champollion', motto: 'Translate everything' };
    const target = { brand: 'Champollion', motto: 'Translate everything' };

    // Only `brand` has a pipeline-produced echo in the TM.
    storeTM(tm, 'Champollion', 'fr', tmKey, 'Champollion');

    const isConfirmedEcho = (key, sourceValue) =>
      lookupTM(tm, sourceValue, 'fr', tmKey) === sourceValue;
    const diff = diffLocale(source, target, PREFIX, [], [], isConfirmedEcho);

    // brand: confirmed → suppressed. motto: brand-new echo → queues once.
    assert.deepEqual(diff.untranslated, ['motto']);
    assert.deepEqual(diff.toProcess, ['motto']);

    // A TM entry holding a DIFFERENT translation must not confirm: the file's
    // echo did not come from the pipeline (e.g. hand-copied English).
    storeTM(tm, 'Translate everything', 'fr', tmKey, 'Tout traduire');
    const diff2 = diffLocale(source, target, PREFIX, [], [], isConfirmedEcho);
    assert.deepEqual(diff2.untranslated, ['motto']);
  });
});
