/**
 * ExternalMethod + method_bridge.py — the Python plugin lane.
 *
 * Three defects from the 2026-09-27 methods audit:
 *
 *   a) method_bridge.py handed the plugin temperature 0.3 when the CLI omitted
 *      it (and None when the CLI sent null). The harness hands a plugin its
 *      RunConfig default (DEFAULT_TEMPERATURE, 0.0), so the "same module in
 *      the Arena and the CLI" ran at a different temperature on each side.
 *   b) translate.js built a new ExternalMethod — so a new Python process —
 *      on every translateBatch, and nothing ever shut them down.
 *   c) The `python` fallback never ran: spawn() reports ENOENT asynchronously,
 *      so the try/catch around it caught nothing, and the 'error' listener
 *      then threw from inside an event handler (an uncaught exception).
 *
 * Every test here spawns the real bridge against a fixture plugin that echoes
 * the temperature it received and its process id.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as translate from '../lib/translate.js';
import { ExternalMethod } from '../lib/methods/external.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, 'fixtures', 'method-plugin-echo-config');
const EXTERNAL_JS = path.resolve(__dirname, '..', 'lib', 'methods', 'external.js');
const HARNESS_CONFIG = path.resolve(__dirname, '..', '..', 'arena', 'mt_eval_harness', 'config.py');

const PYTHON3 = (() => {
  const r = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf-8' });
  return r.status === 0 ? r.stdout.trim() : null;
})();

/** Split a fixture prediction into { source, temperature, pid }. */
function report(predicted) {
  const bar = predicted.indexOf('|');
  return { source: predicted.slice(0, bar), ...JSON.parse(predicted.slice(bar + 1)) };
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitForExit(pid, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!pidAlive(pid)) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return !pidAlive(pid);
}

describe('method_bridge temperature (audit item 4a)', () => {
  let method;
  afterEach(async () => { if (method) await method.shutdown(); method = null; });

  it('hands the plugin the harness default when the CLI omits temperature', async (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    if (!fs.existsSync(HARNESS_CONFIG)) return t.skip('harness not in this checkout');
    const harnessDefault = fs.readFileSync(HARNESS_CONFIG, 'utf-8').match(/^DEFAULT_TEMPERATURE\s*=\s*([0-9.]+)/m);
    assert.ok(harnessDefault, 'arena config.py must define DEFAULT_TEMPERATURE');

    method = new ExternalMethod({ methodPath: FIXTURE });
    const omitted = await method.translate(['a'], { a: 'x' }, { target: 'fr' }, { cwd: __dirname });
    const nulled = await method.translate(['a'], { a: 'x' }, { target: 'fr', temperature: null }, { cwd: __dirname });

    // Python repr of the float: 0.0 → "0.0", 0.3 → "0.3".
    const v = parseFloat(harnessDefault[1]);
    const expected = Number.isInteger(v) ? v.toFixed(1) : String(v);
    assert.equal(report(omitted.a).temperature, expected, 'omitted → harness DEFAULT_TEMPERATURE');
    assert.equal(report(nulled.a).temperature, expected, 'null (unset in config) → harness DEFAULT_TEMPERATURE');
  });

  it('passes an explicit temperature through unchanged', async (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    method = new ExternalMethod({ methodPath: FIXTURE });
    const out = await method.translate(['a'], { a: 'x' }, { target: 'fr', temperature: 0.7 }, { cwd: __dirname });
    assert.equal(report(out.a).temperature, '0.7');
  });
});

describe('one bridge process per plugin, shut down at the end (audit item 4b)', () => {
  afterEach(async () => {
    if (typeof translate.shutdownMethods === 'function') await translate.shutdownMethods();
  });

  it('reuses the bridge across translateBatch calls', async (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    const pair = { method: 'external', methodPath: FIXTURE, source: 'en', target: 'fr' };
    const first = await translate.translateBatch(['a'], { a: 'one' }, pair, { cwd: __dirname });
    const second = await translate.translateBatch(['b'], { b: 'two' }, pair, { cwd: __dirname });
    assert.equal(report(first.a).pid, report(second.b).pid, 'both batches must go through one Python process');
  });

  it('keeps concurrent requests on the shared bridge apart', async (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    const pair = { method: 'external', methodPath: FIXTURE, source: 'en', target: 'fr' };
    const results = await Promise.all(['p', 'q', 'r', 's'].map(k =>
      translate.translateBatch([k], { [k]: `src-${k}` }, pair, { cwd: __dirname })));
    results.forEach((res, i) => {
      const k = ['p', 'q', 'r', 's'][i];
      assert.deepEqual(Object.keys(res), [k], `request ${k} got another request's response`);
      assert.equal(report(res[k]).source, `src-${k}`);
    });
  });

  it('shutdownMethods() stops the bridge process', async (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    assert.equal(typeof translate.shutdownMethods, 'function', 'translate.js must export shutdownMethods');
    const pair = { method: 'external', methodPath: FIXTURE, source: 'en', target: 'fr' };
    const out = await translate.translateBatch(['a'], { a: 'one' }, pair, { cwd: __dirname });
    const { pid } = report(out.a);
    assert.ok(pidAlive(pid));
    await translate.shutdownMethods();
    assert.ok(await waitForExit(pid), `bridge pid ${pid} still running after shutdownMethods()`);
  });
});

describe('python fallback when python3 is absent (audit item 4c)', () => {
  let binDir;
  afterEach(() => { if (binDir) fs.rmSync(binDir, { recursive: true, force: true }); binDir = null; });

  /** Run a readiness check in a child whose PATH holds only `binDir`. */
  function readinessWithPath(dir) {
    const script = `
      const { ExternalMethod } = await import(${JSON.stringify(pathToFileURL(EXTERNAL_JS).href)});
      const m = new ExternalMethod({ methodPath: ${JSON.stringify(FIXTURE)} });
      const r = await m.checkReadiness({ cwd: ${JSON.stringify(__dirname)} });
      await m.shutdown();
      process.stdout.write('RESULT ' + JSON.stringify(r) + '\\n');
    `;
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
      env: { PATH: dir, HOME: process.env.HOME },
      timeout: 30000,
    });
  }

  it('uses `python` when only `python` is on PATH', (t) => {
    if (!PYTHON3) return t.skip('python3 not available');
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-pybin-'));
    fs.symlinkSync(PYTHON3, path.join(binDir, 'python'));
    const r = readinessWithPath(binDir);
    const line = r.stdout.split('\n').find(l => l.startsWith('RESULT '));
    assert.ok(line, `child crashed instead of falling back (status ${r.status})\nstderr: ${r.stderr}`);
    assert.deepEqual(JSON.parse(line.slice(7)), { ready: true });
  });

  it('reports "Python is required" (not a crash) when neither is on PATH', () => {
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-nopy-'));
    const r = readinessWithPath(binDir);
    const line = r.stdout.split('\n').find(l => l.startsWith('RESULT '));
    assert.ok(line, `child crashed instead of reporting (status ${r.status})\nstderr: ${r.stderr}`);
    const res = JSON.parse(line.slice(7));
    assert.equal(res.ready, false);
    assert.match(res.reason, /Python is required/);
  });
});
