#!/usr/bin/env node
/**
 * preview-gated.mjs — serve the BUILT site locally, behind the site's own
 * pre-launch gate, exactly as Vercel would put it in front of a visitor.
 *
 * Every request goes through middleware.js first (the real file: the review
 * key's hash, the machine-endpoint exemptions, the localized coming-soon page,
 * geo-locale defaulting). Only a request the middleware passes on with
 * `next()` reaches the built files. So a reviewer sees the gate, enters their
 * review key, and then the draft — and nothing is deployed anywhere.
 *
 * Also applied, as Vercel does: `cleanUrls` (/start → start.html) and the
 * simple redirects in vercel.json (no host conditions, no :params).
 *
 * Usage (from cli/website, after a build):
 *   node scripts/preview-gated.mjs                # http://localhost:4300, gated
 *   node scripts/preview-gated.mjs --port 4400
 *   node scripts/preview-gated.mjs --no-gate      # the same server without the
 *                                                 # gate (screenshots, checks)
 * Local only: it binds 127.0.0.1. The review cookie the gate page sets is
 * marked Secure; browsers accept that on http://localhost.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(SITE, 'build');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const PORT = Number(arg('--port', 4300));
const GATED = !process.argv.includes('--no-gate');

if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error('[preview-gated] no build/ — run the site build first (npm run build -- en)');
  process.exit(2);
}

const {default: middleware} = await import(path.join(SITE, 'middleware.js'));
const vercel = JSON.parse(fs.readFileSync(path.join(SITE, 'vercel.json'), 'utf-8'));
const REDIRECTS = new Map((vercel.redirects || [])
  .filter((r) => !r.has && !r.source.includes(':') && !r.source.includes('('))
  .map((r) => [r.source, r]));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml',
  '.webm': 'video/webm', '.mp4': 'video/mp4',
};

function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  const rel = clean.replace(/^\/+/, '');
  const cands = clean === '/'
    ? ['index.html']
    : [rel, `${rel}.html`, path.join(rel, 'index.html')];
  for (const c of cands) {
    const p = path.join(BUILD, c);
    if (!p.startsWith(BUILD)) return null;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function serveFile(res, pathname, extraHeaders = {}) {
  const file = resolveFile(pathname);
  if (!file) {
    const nf = path.join(BUILD, '404.html');
    res.writeHead(404, {'content-type': TYPES['.html'], ...extraHeaders});
    res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found');
    return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream', ...extraHeaders});
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const red = REDIRECTS.get(url.pathname);
    if (red) {
      res.writeHead(red.permanent ? 308 : 307, {location: red.destination});
      res.end();
      return;
    }
    if (!GATED) return serveFile(res, url.pathname);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const out = await middleware(new Request(url, {method: req.method, headers}));
    if (out.headers.get('x-middleware-next') === '1') {
      const pass = {};
      out.headers.forEach((v, k) => { if (k === 'set-cookie') pass[k] = v; });
      return serveFile(res, url.pathname, pass);
    }
    const head = {};
    out.headers.forEach((v, k) => { head[k] = v; });
    res.writeHead(out.status, head);
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, {'content-type': 'text/plain'});
    res.end(`preview-gated: ${e.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[preview-gated] http://localhost:${PORT} — ${GATED ? 'behind the pre-launch gate (enter your review key)' : 'NO gate (local checks only)'}`);
});
