import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Cross-runtime parity guard (CLI side; twin of arena/tests/test_method_bridge_parity.py).
//
// cli/lib/bridge/method_bridge.py is a hand-synced reimplementation of the
// harness's mt_eval_harness.method_loader, kept in step only by a comment. This
// test spawns the bridge against the SAME shared fixture plugin the harness test
// loads (cli/test/fixtures/method-plugin-parity) and asserts the bridge emits
// the ready signal and round-trips a translate through its JSON-lines protocol.
//
// The fixture's method.json holds exactly the fields both loaders require — so
// adding a required manifest field to only one loader makes that side fail to
// load the fixture while the other still passes.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.resolve(__dirname, '..', 'lib', 'bridge', 'method_bridge.py');
const FIXTURE = path.resolve(__dirname, 'fixtures', 'method-plugin-parity');

// JSON-lines client over the bridge subprocess: queues stdout lines and hands
// them out FIFO, rejecting pending reads if the process dies (e.g. no python3).
function makeClient(proc) {
  const lines = [];
  const waiters = [];
  let failure = null;

  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    if (waiters.length) waiters.shift().resolve(line);
    else lines.push(line);
  });

  const fail = (err) => {
    failure = err;
    while (waiters.length) waiters.shift().reject(err);
  };
  proc.on('error', fail);
  proc.on('exit', (code) => { if (code) fail(new Error(`bridge exited with code ${code}`)); });

  return {
    read(timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
        if (lines.length) return resolve(lines.shift());
        if (failure) return reject(failure);
        const timer = setTimeout(() => reject(new Error('bridge read timed out')), timeoutMs);
        waiters.push({
          resolve: (line) => { clearTimeout(timer); resolve(line); },
          reject: (err) => { clearTimeout(timer); reject(err); },
        });
      });
    },
    send(obj) { proc.stdin.write(JSON.stringify(obj) + '\n'); },
  };
}

describe('method-bridge ↔ method_loader parity (CLI bridge loads shared fixture)', () => {
  it('emits the ready signal and round-trips a translate', async (t) => {
    if (!fs.existsSync(BRIDGE)) return t.skip('method_bridge.py not present');
    if (!fs.existsSync(FIXTURE)) return t.skip('parity fixture not present');

    const proc = spawn('python3', [BRIDGE, '--method', FIXTURE], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const client = makeClient(proc);

    try {
      let ready;
      try {
        ready = JSON.parse(await client.read());
      } catch (err) {
        if (err && (err.code === 'ENOENT' || /ENOENT|exited/.test(String(err.message)))) {
          return t.skip('python3 not available');
        }
        throw err;
      }
      assert.equal(ready.ok, true, 'bridge signals ok on load');
      assert.equal(ready.ready, true, 'bridge signals ready on load');

      client.send({
        action: 'translate',
        keys: { greeting: 'Hello', farewell: 'Goodbye' },
        source_locale: 'en',
        target_locale: 'fr',
        config: {},
      });
      const resp = JSON.parse(await client.read());
      assert.equal(resp.ok, true, 'translate action succeeds');
      assert.deepEqual(
        resp.translations,
        { greeting: 'Hello', farewell: 'Goodbye' },
        'passthrough fixture echoes the source through the bridge protocol',
      );

      client.send({ action: 'shutdown' });
      await client.read().catch(() => {});
    } finally {
      proc.kill();
    }
  });
});
