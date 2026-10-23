#!/usr/bin/env node
/**
 * sync-docs-redirects.mjs — write the retired docs routes into vercel.json.
 *
 * src/data/docs-redirects.json is the one list of docs pages the 2026-10-12
 * redraft merged or retired, each with the page that replaced it. This writes
 * a permanent redirect for each — plain and locale-prefixed — into
 * vercel.json, and repoints any OLDER redirect whose destination is now a
 * retired route (so nothing chains through a page that no longer exists).
 *
 *   node scripts/sync-docs-redirects.mjs           # write vercel.json
 *   node scripts/sync-docs-redirects.mjs --check   # exit 3 if vercel.json is out of step
 *
 * Generated entries are recognised by their source (a retired route, plain or
 * locale-prefixed); everything else in vercel.json is left exactly as it is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERCEL = path.join(SITE, 'vercel.json');
const MAP = path.join(SITE, 'src/data/docs-redirects.json');
const CONFIG = path.join(SITE, 'docusaurus.config.js');

/** The non-default locales, read from the site config (never typed here). */
export function localesFrom(configSource) {
  const m = configSource.match(/locales:\s*\[([^\]]+)\]/);
  if (!m) throw new Error('docusaurus.config.js: no i18n locales list found');
  const all = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return all.filter((l) => l !== 'en');
}

export function entriesFor(map, locales) {
  const alt = locales.join('|');
  const out = [];
  for (const { from, to } of map) {
    out.push({ source: from, destination: to, permanent: true });
    out.push({ source: `/:locale(${alt})${from}`, destination: `/:locale${to}`, permanent: true });
  }
  return out;
}

/** vercel.json with the generated entries in place, and older destinations repointed. */
export function synced(vercel, map, locales) {
  const retired = new Map(map.map((r) => [r.from, r.to]));
  const generated = entriesFor(map, locales);
  const generatedSources = new Set(generated.map((e) => e.source));
  const kept = (vercel.redirects || [])
    .filter((e) => !generatedSources.has(e.source))
    .map((e) => {
      // an older redirect that lands on a retired route: send it straight on
      const [dest, anchor] = String(e.destination).split('#');
      const localeless = dest.replace(/^\/:locale/, '');
      if (retired.has(localeless)) {
        const prefix = dest.startsWith('/:locale') ? '/:locale' : '';
        return { ...e, destination: prefix + retired.get(localeless) };
      }
      void anchor;
      return e;
    });
  return { ...vercel, redirects: [...kept, ...generated] };
}

function main() {
  const check = process.argv.includes('--check');
  const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  const { redirects: map } = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const locales = localesFrom(fs.readFileSync(CONFIG, 'utf8'));
  const next = JSON.stringify(synced(vercel, map, locales), null, 2) + '\n';
  const now = fs.readFileSync(VERCEL, 'utf8');
  if (check) {
    if (next !== now) {
      console.error('✗ vercel.json is out of step with src/data/docs-redirects.json — run: node scripts/sync-docs-redirects.mjs');
      process.exit(3);
    }
    console.log('✓ vercel.json carries every docs redirect');
    return;
  }
  fs.writeFileSync(VERCEL, next);
  console.log(`vercel.json: ${map.length} retired routes × (plain + ${locales.length} locales) written`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
