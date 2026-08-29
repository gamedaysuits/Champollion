/**
 * Mock Supabase (PostgREST subset) for test/card-fetch.test.js.
 *
 * Runs as a SEPARATE process: the card registry's synchronous fetch
 * path blocks the parent test process with execFileSync, so an
 * in-process mock would deadlock (parent can't serve HTTP while it
 * waits for the child that is calling it). Production talks to a
 * remote Supabase, where no such coupling exists.
 *
 * Data + behavior are controlled over HTTP:
 *   POST /__mock/rows     {code, index?, detail?}   — upsert a language
 *   POST /__mock/fail     {fail500: bool}           — force 500s
 *   GET  /__mock/requests                           — request log (array)
 *
 * Prints the listening port on stdout, then serves until killed.
 */

import http from 'node:http';

const rows = new Map(); // code → { index, detail }
let fail500 = false;
const requests = [];

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const respond = (status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };

  // ── Control plane ────────────────────────────────────────────
  if (url.pathname === '/__mock/rows' && req.method === 'POST') {
    const { code, index, detail } = JSON.parse(await readBody(req));
    rows.set(code, { index, detail });
    return respond(200, { ok: true });
  }
  if (url.pathname === '/__mock/fail' && req.method === 'POST') {
    fail500 = JSON.parse(await readBody(req)).fail500;
    return respond(200, { ok: true });
  }
  if (url.pathname === '/__mock/requests') {
    return respond(200, requests);
  }

  // ── PostgREST subset ─────────────────────────────────────────
  requests.push(url.pathname + url.search);
  if (fail500) return respond(500, { message: 'forced failure' });

  const table = url.pathname.split('/').pop();
  const codeEq = url.searchParams.get('code'); // "eq.<code>"
  const since = url.searchParams.get('updated_at'); // "gt.<ts>"
  const order = url.searchParams.get('order') || '';
  const limit = Number(url.searchParams.get('limit') || 1000);
  const offset = Number(url.searchParams.get('offset') || 0);

  if (table === 'trading_card_index') {
    let out = [...rows.values()].map(r => r.index).filter(Boolean);
    if (codeEq) out = out.filter(r => `eq.${r.code}` === codeEq);
    if (since) out = out.filter(r => r.updated_at > since.slice(3));
    out.sort((a, b) =>
      order.startsWith('updated_at.desc')
        ? b.updated_at.localeCompare(a.updated_at)
        : a.code.localeCompare(b.code),
    );
    return respond(200, out.slice(offset, offset + limit));
  }

  if (table === 'trading_card_detail') {
    let out = [...rows.values()].map(r => r.detail).filter(Boolean);
    if (codeEq) out = out.filter(r => `eq.${r.code}` === codeEq);
    out.sort((a, b) => a.code.localeCompare(b.code));
    return respond(200, out.slice(offset, offset + limit));
  }

  respond(404, []);
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`${server.address().port}\n`);
});
