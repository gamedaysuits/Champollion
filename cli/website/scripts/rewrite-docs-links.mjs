#!/usr/bin/env node
/**
 * rewrite-docs-links.mjs — point every link at a retired docs page to the page
 * that replaced it.
 *
 * Reads src/data/docs-redirects.json (the one list of retired routes) and
 * rewrites links in the given files: markdown links, `to:` frontmatter,
 * JSX/JS string literals and absolute https://champollion.dev/docs/… URLs —
 * locale-prefixed ones too. The build throws on a link to a page that no
 * longer exists, so links inside the site must move with the page; the
 * vercel.json redirects (sync-docs-redirects.mjs) are for links outside it.
 *
 * An anchor on a retired page means nothing on its replacement, so it is
 * dropped. Matching is whole-route: /docs/network/how-it-works is never
 * mistaken for /docs/network, and a kept page under a retired folder
 * (e.g. /docs/network/sovereignty/registering-corpora) is left alone.
 *
 *   node scripts/rewrite-docs-links.mjs <file|dir>...           # rewrite in place
 *   node scripts/rewrite-docs-links.mjs --check <file|dir>...   # exit 3 if any link still points at a retired route
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = JSON.parse(fs.readFileSync(path.join(SITE, 'src/data/docs-redirects.json'), 'utf8')).redirects;
const LOCALES = 'fr|de|nl|fil|es|zh|ja|ko|pt|th|vi|ar';
const EXT = /\.(md|mdx|js|mjs|jsx|ts|tsx|json|py|yml|yaml|txt)$/;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One regex for all retired routes, longest first. A match must end the
 * route: what follows is an anchor, a slash closing it, or a delimiter.
 */
export function pattern(map = MAP) {
  const routes = [...map].sort((a, b) => b.from.length - a.from.length).map((r) => esc(r.from.replace(/^\/docs/, '')));
  return new RegExp(
    `(https?://champollion\\.dev)?(/(?:${LOCALES}))?/docs(${routes.join('|')})/?(#[A-Za-z0-9_-]+)?(?=[)"'\`\\s>\\]},;:|]|$)`,
    'g',
  );
}

export function rewrite(text, map = MAP) {
  const to = new Map(map.map((r) => [r.from.replace(/^\/docs/, ''), r.to]));
  let n = 0;
  const out = text.replace(pattern(map), (whole, origin = '', locale = '', route) => {
    const dest = to.get(route);
    if (!dest) return whole;
    n += 1;
    return `${origin || ''}${locale || ''}${dest}`;
  });
  return { text: out, changes: n };
}

function* walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) {
      if (e === 'node_modules' || e === 'build' || e === '.docusaurus' || e.startsWith('.')) continue;
      yield* walk(path.join(p, e));
    }
  } else if (EXT.test(p)) {
    yield p;
  }
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const targets = args.filter((a) => a !== '--check');
  if (!targets.length) {
    console.error('usage: rewrite-docs-links.mjs [--check] <file|dir>...');
    process.exit(2);
  }
  let files = 0;
  let changes = 0;
  for (const t of targets) {
    for (const f of walk(t)) {
      if (f.endsWith('docs-redirects.json') || f.endsWith('vercel.json')) continue;
      const before = fs.readFileSync(f, 'utf8');
      const { text, changes: n } = rewrite(before);
      if (!n) continue;
      files += 1;
      changes += n;
      if (check) console.error(`✗ ${f}: ${n} link(s) to retired docs routes`);
      else fs.writeFileSync(f, text);
    }
  }
  if (check && changes) process.exit(3);
  console.log(`${check ? 'checked' : 'rewrote'}: ${changes} link(s) in ${files} file(s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
