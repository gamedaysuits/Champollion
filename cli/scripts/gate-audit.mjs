#!/usr/bin/env node
/**
 * gate-audit.mjs — the quality gate, run over translations already accepted.
 *
 * champollion.dev is translated by this CLI into 12 languages; every block on
 * disk was once accepted. Re-judging them with TODAY's gate measures its
 * false refusals on real output from several models — offline, no model
 * call, no cost. Three gate bugs that left correct text untranslated
 * (2026-10-05/06) all show up here. test/gate-false-refusals.test.js runs it
 * before every publish.
 *
 * Usage: node scripts/gate-audit.mjs [--site <dir>] [--all] [--json <file>]
 *   --all   include pages translated from an older source (their blocks may
 *           not line up with today's; noisy, for investigation)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseContentFile, protectBlocks, restoreBlocks } from '../lib/content.js';
import { splitBlocks } from '../lib/segment.js';
import { contentGateFault, validateTranslations, isKeepAsWrittenFault } from '../lib/validate.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {{ site?: string, currentOnly?: boolean }} [opts]
 * @returns {{ pages: number, blocks: number, keys: number, refusals: Array<object>, hard: Array<object>, keepAsWritten: Array<object> }}
 */
export function auditSite({ site = path.join(CLI, 'website'), currentOnly = true } = {}) {
  const docsDir = path.join(site, 'docs');
  const i18n = path.join(site, 'i18n');
  const out = { pages: 0, blocks: 0, keys: 0, refusals: [], hard: [], keepAsWritten: [] };
  if (!fs.existsSync(docsDir) || !fs.existsSync(i18n)) return out;
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(site, '.champollion-content.lock'), 'utf8')); } catch { /* none */ }
  const locales = fs.readdirSync(i18n).filter(l => l !== 'en' && fs.statSync(path.join(i18n, l)).isDirectory());
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.mdx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  const blocksOf = (raw) => {
    const { body } = parseContentFile(raw);
    const { protectedBody, blocks } = protectBlocks(body || '');
    return splitBlocks(protectedBody).filter(s => s.type === 'translatable').map(s => restoreBlocks(s.text, blocks));
  };
  // A keep-as-written verdict (echo, Latin kept) on a value that is visibly
  // NOT kept as written — it differs from the source and carries letters of a
  // non-Latin script — is the gate contradicting itself: counted hard. That is
  // how 470 characters of correct Japanese were refused as "ASCII-only".
  const contradicts = (r) => r.full !== r.fullSource && /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s\p{P}\p{S}\p{N}]/u.test(r.full);
  const add = (r) => {
    out.refusals.push(r);
    const soft = isKeepAsWrittenFault(r.reason) && !contradicts(r);
    delete r.full; delete r.fullSource;
    (soft ? out.keepAsWritten : out.hard).push(r);
  };
  for (const l of locales) {
    const pc = { target: l, locale: l };
    for (const f of walk(docsDir)) {
      const rel = path.relative(docsDir, f).split(path.sep).join('/');
      const t = path.join(i18n, l, 'docusaurus-plugin-content-docs/current', rel);
      if (!fs.existsSync(t)) continue;
      const raw = fs.readFileSync(f, 'utf8');
      if (currentOnly && lock[`docusaurus:docs/${rel}:${l}`] !== crypto.createHash('sha256').update(raw).digest('hex')) continue;
      const a = blocksOf(raw);
      const b = blocksOf(fs.readFileSync(t, 'utf8'));
      if (a.length !== b.length) continue;
      out.pages++;
      a.forEach((src, i) => {
        out.blocks++;
        const reason = contentGateFault(src, b[i], pc);
        if (reason) add({ locale: l, page: rel, paragraph: i + 1, reason, source: src.slice(0, 200), value: b[i].slice(0, 200), full: b[i], fullSource: src });
      });
    }
    const walkJ = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walkJ(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []));
    for (const f of walkJ(path.join(i18n, 'en'))) {
      const t = path.join(i18n, l, path.relative(path.join(i18n, 'en'), f));
      if (!fs.existsSync(t)) continue;
      const S = JSON.parse(fs.readFileSync(f, 'utf8'));
      const T = JSON.parse(fs.readFileSync(t, 'utf8'));
      for (const k of Object.keys(S)) {
        const s = S[k]?.message; const v = T[k]?.message;
        if (typeof s !== 'string' || typeof v !== 'string') continue;
        out.keys++;
        const { failures } = validateTranslations({ [k]: v }, { [k]: s }, pc, { acceptLatinNames: true });
        if (failures.length) add({ locale: l, key: k, reason: failures[0].reason, source: s.slice(0, 200), value: v.slice(0, 200), full: v, fullSource: s });
      }
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const r = auditSite({ site: arg('--site') || undefined, currentOnly: !process.argv.includes('--all') });
  const n = r.blocks + r.keys;
  console.log(`gate audit: ${r.pages} page translations, ${r.blocks} blocks + ${r.keys} UI strings`);
  console.log(`  hard refusals (loop, truncation, damaged markup, wrong script…): ${r.hard.length}`);
  console.log(`  keep-as-written (echo / Latin kept — settled by the second ask): ${r.keepAsWritten.length} (${(100 * r.keepAsWritten.length / Math.max(n, 1)).toFixed(3)}%)`);
  for (const x of r.hard.slice(0, 20)) console.log(`    ${x.locale} ${x.page || x.key}${x.paragraph ? ` ¶${x.paragraph}` : ''}: ${x.reason}`);
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(r, null, 1));
}
