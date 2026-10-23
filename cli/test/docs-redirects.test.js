/**
 * The retired docs routes (cli/website/src/data/docs-redirects.json): the
 * link rewriter matches whole routes only, keeps locale prefixes and origins,
 * drops anchors that meant something only on the retired page; vercel.json
 * carries every redirect; every redirect lands on a page that exists.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rewrite } from '../website/scripts/rewrite-docs-links.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const MAP = JSON.parse(fs.readFileSync(path.join(SITE, 'src/data/docs-redirects.json'), 'utf8')).redirects;

describe('docs redirects', () => {
  it('rewrites whole routes only, with origin, locale and anchor handled', () => {
    const src = [
      '[a](/docs/network/how-it-works)',
      '[b](/docs/network)',
      '[c](/docs/network/sovereignty/registering-corpora)',
      'see https://champollion.dev/docs/build-mt-for-your-language#step-2 now',
      "to: '/fr/docs/guides/enterprise'",
      '[d](/docs/network/how-it-works-not-a-route)',
    ].join('\n');
    const { text, changes } = rewrite(src);
    assert.equal(changes, 4);
    assert.match(text, /\[a\]\(\/docs\/reference\/leaderboard\)/);
    assert.match(text, /\[b\]\(\/docs\/reference\/leaderboard\)/);
    assert.match(text, /\[c\]\(\/docs\/network\/sovereignty\/registering-corpora\)/, 'a kept page under a retired folder is left alone');
    assert.match(text, /https:\/\/champollion\.dev\/docs\/agents\/shell now/);
    assert.match(text, /to: '\/fr\/docs\/getting-started\/who-may-use-this'/);
    assert.match(text, /how-it-works-not-a-route/);
  });

  it('vercel.json carries every redirect (sync-docs-redirects --check)', () => {
    execFileSync(process.execPath, [path.join(SITE, 'scripts/sync-docs-redirects.mjs'), '--check'], { stdio: 'pipe' });
  });

  it('no redirect lands on another retired route', () => {
    const retired = new Set(MAP.map((r) => r.from));
    for (const r of MAP) assert.ok(!retired.has(r.to), `${r.from} → ${r.to} chains`);
  });

  it('every redirect lands on a docs page that exists', () => {
    const docs = path.join(SITE, 'docs');
    const routes = new Set(['/docs/', '/docs']);
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.mdx?$/.test(e.name)) continue;
        const src = fs.readFileSync(p, 'utf8');
        const rel = path.relative(docs, p).replace(/\.mdx?$/, '');
        const slug = (src.match(/^---\n[\s\S]*?\nslug:\s*["']?([^"'\n]+)["']?\s*\n/) || [])[1];
        let route = slug ? (slug.startsWith('/') ? slug : `/${path.dirname(rel)}/${slug}`) : `/${rel.replace(/(^|\/)index$/, '')}`;
        routes.add(`/docs${route}`.replace(/\/$/, '') || '/docs');
      }
    };
    walk(docs);
    for (const r of MAP) assert.ok(routes.has(r.to), `${r.from} → ${r.to}: no such page`);
  });
});
