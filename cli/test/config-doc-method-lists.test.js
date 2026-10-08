/**
 * The configuration page's method lists name every method a config can use.
 *
 * THE FINDING (synthetic Django persona and Cree school persona, 2026-10):
 * the `defaultMethod` row and the Pair Fields `method` row both left out
 * `local` — the method people choose to keep text on their machine — so a
 * reader concluded it could not be a default. The lists are checked against
 * the CLI's own method registry; `external` is the plugin bridge a
 * `methodPlugin` selects, never written as a method name.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { METHOD_REGISTRY } from '../lib/translate.js';

const PAGE = fs.readFileSync(
  fileURLToPath(new URL('../website/docs/getting-started/configuration.md', import.meta.url)), 'utf-8');
const CONFIG_METHODS = Object.keys(METHOD_REGISTRY).filter((m) => m !== 'external' && !m.startsWith('test-')).sort();

/** Backticked names in the table row that starts with `| \`<field>\``. */
function namesInRow(field, marker) {
  const row = PAGE.split('\n').find((l) => l.startsWith(`| \`${field}\``) && l.includes(marker));
  assert.ok(row, `no "${field}" row containing "${marker}"`);
  const list = row.slice(row.indexOf(marker) + marker.length);
  return [...list.matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1]);
}

describe('configuration.md method lists match the method registry', () => {
  it('defaultMethod lists every method', () => {
    const named = namesInRow('defaultMethod', 'Default translation method:');
    for (const m of CONFIG_METHODS) assert.ok(named.includes(m), `defaultMethod row is missing \`${m}\``);
  });

  it('Pair Fields `method` lists every method', () => {
    const named = namesInRow('method', 'Translation method:');
    assert.deepEqual([...new Set(named)].sort(), CONFIG_METHODS);
  });
});
