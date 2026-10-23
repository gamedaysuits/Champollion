/**
 * local-method-local-only.test.js — `sync --method local` against a model
 * whose output is local-only (an nmt-forge model that learned from sentences
 * marked local-only) writes nothing unless the data's holders agreed,
 * recorded on the pair for "local" — the API method's rule, which the chat
 * path skipped until 2026-10-13 (docs review).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { LocalMethod } from '../lib/methods/local.js';
import { output } from '../lib/output.js';

function server(localOnly) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', output_local_only: localOnly }));
        return;
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '{"greeting":"zub kef"}' } }] }));
      });
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

async function quietErrors(fn) {
  const error = output.error;
  const lines = [];
  output.error = (s) => lines.push(String(s));
  try {
    return { result: await fn(), errors: lines };
  } finally {
    output.error = error;
  }
}

describe('the local method and local-only output', () => {
  it('writes nothing from a local-only model unless the holders agreed', async () => {
    const s = await server(true);
    const base = `http://127.0.0.1:${s.address().port}/v1`;
    try {
      const m = new LocalMethod();
      const pair = { source: 'en', target: 'qaa', baseUrl: base, model: 'forge' };
      const { result, errors } = await quietErrors(() => m._localOnlyRefusal(pair));
      assert.ok(result, 'refused');
      assert.match(result[0], /says what it writes is local-only/);
      assert.match(result[1], /--holders-agreed-by/);
      const agreed = await m._localOnlyRefusal({ ...pair, holdersAgreed: { by: 'the family', method: 'local' } });
      assert.equal(agreed, null, 'the holders agreed: it goes on');
      const t = await quietErrors(() => m.translate(['greeting'], { greeting: 'Good morning' }, pair, {}));
      assert.deepEqual(t.result, {}, 'nothing translated, nothing written');
      assert.ok(t.errors.some((l) => /local-only/.test(l)));
      assert.equal(errors.length, 0);
    } finally {
      s.close();
    }
  });

  it('the keys whose text holds words the model never saw are said, never dropped', () => {
    // stress test 4 (2026-10-13): such a sentence was never translated right
    const warn = output.warn;
    const lines = [];
    output.warn = (s) => lines.push(String(s));
    try {
      const text = new LocalMethod()._extractResponseText({
        choices: [{ message: { content: '{"greeting":"zub","farewell":"kef"}' } }],
        meta: { unseen_words: { farewell: ['farewell'] } } });
      assert.equal(text, '{"greeting":"zub","farewell":"kef"}');
      assert.equal(lines.length, 1);
      assert.match(lines[0], /1 key\(s\) hold words the model never saw in training .*: farewell$/);
      new LocalMethod()._extractResponseText({ choices: [{ message: { content: '{}' } }], meta: {} });
      assert.equal(lines.length, 1, 'nothing to name: nothing said');
    } finally {
      output.warn = warn;
    }
  });

  it('a server that is not local-only (or says nothing) is used as before', async () => {
    const s = await server(false);
    try {
      const m = new LocalMethod();
      const refusal = await m._localOnlyRefusal({ baseUrl: `http://127.0.0.1:${s.address().port}/v1` });
      assert.equal(refusal, null);
    } finally {
      s.close();
    }
    const none = await new LocalMethod()._localOnlyRefusal({ baseUrl: 'http://127.0.0.1:9/v1' });
    assert.equal(none, null, 'no /health answer: no claim to act on');
  });
});
