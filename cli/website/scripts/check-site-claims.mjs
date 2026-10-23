#!/usr/bin/env node
/**
 * check-site-claims.mjs — the overclaim pass over the BUILT site.
 *
 * The copy rules for the rails pages (promise process, never quality; no
 * coverage counts; "source-available" for the PolyForm parts; name no
 * community; no train imagery) were prose. This reads the built HTML — what a
 * visitor actually gets, after every component and translation has run — and
 * fails on a breach. Rules are data: scripts/site-claims-rules.json.
 *
 *   everywhere   banned phrases on every English page (a translated page that
 *                still carries one is a WARNING: its translation predates the
 *                rewrite and waits for the locale sync)
 *   names        docs/governance/restricted-public-names.json — the same deny
 *                list as scripts/check_public_names.py — on every page of
 *                every locale (an ERROR anywhere)
 *   railsPages   on /, /start, /your-data: banned phrases; labels that must
 *                sit inside the frame they qualify; and every number of two
 *                or more digits must appear in the files the page reads its
 *                numbers from (the recording, the generated site data, the
 *                commands) — a typed number fails
 *
 * Usage: node scripts/check-site-claims.mjs [--build <dir>]
 * Exit 0 clean · 1 a breach · 2 no build to read.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SITE, '..', '..');
const argBuild = process.argv.indexOf('--build');
const BUILD = argBuild > 0 ? path.resolve(process.argv[argBuild + 1]) : path.join(SITE, 'build');
const rules = JSON.parse(fs.readFileSync(path.join(SITE, 'scripts', 'site-claims-rules.json'), 'utf-8'));

if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error(`[site-claims] no build at ${BUILD} — run the site build first`);
  process.exit(2);
}

const config = (await import(path.join(SITE, 'docusaurus.config.js'))).default;
const LOCALES = config.i18n.locales.filter((l) => l !== config.i18n.defaultLocale);

/** Visible text of an HTML page: no scripts, styles, tags; entities decoded. */
export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ');
}

function htmlFiles(dir, skipLocales) {
  const out = [];
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipLocales && dir === BUILD && LOCALES.includes(e.name)) continue;
      if (['assets', 'data', 'img', 'fonts', 'search-index'].includes(e.name) && dir === BUILD) continue;
      out.push(...htmlFiles(p, false));
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const errors = [];
const warnings = [];
const rel = (p) => path.relative(BUILD, p);
const where = (text, idx) => text.slice(Math.max(0, idx - 60), idx + 80).trim();

// ── unconsented names, every locale ──────────────────────────────────────
// The list lives in docs/, outside the public tree. In a checkout without it
// (the public repository) this part is skipped — said, never silent; the
// maintainers' pre-push gate (scripts/check_public_names.py) is where it binds.
const NAME_LIST = path.join(REPO, 'docs', 'governance', 'restricted-public-names.json');
let names = [];
if (fs.existsSync(NAME_LIST)) {
  // Same semantics as scripts/check_public_names.py: a rule with `near` counts
  // a mention only when its partnership words sit within `window` characters
  // (a bare citation stays allowed), and an `allow` pattern excuses a
  // documented citation. Built text has no lines, so `allow` is tried on the
  // same window around the mention.
  names = JSON.parse(fs.readFileSync(NAME_LIST, 'utf-8')).names
    .map((n) => ({
      id: n.id,
      re: new RegExp(n.pattern, n.case_sensitive ? 'g' : 'gi'),
      near: n.near ? new RegExp(n.near, 'i') : null,
      window: Number.isInteger(n.window) ? n.window : 160,
      allow: (n.allow || []).map((a) => new RegExp(a.pattern, 'i')),
    }));
} else {
  console.log('[site-claims] names: SKIPPED — the deny list is not in this checkout (it is kept outside the public tree)');
}

// ── everywhere rules ─────────────────────────────────────────────────────
const everywhere = rules.everywhere.map((r) => ({...r, rx: new RegExp(r.pattern, 'gi')}));

const all = htmlFiles(BUILD, false);
const english = new Set(htmlFiles(BUILD, true));
for (const f of all) {
  const text = visibleText(fs.readFileSync(f, 'utf-8'));
  for (const n of names) {
    n.re.lastIndex = 0;
    let m;
    while ((m = n.re.exec(text))) {
      if (m[0].length === 0) { n.re.lastIndex += 1; continue; }
      const lo = Math.max(0, m.index - n.window);
      const span = text.slice(lo, m.index + m[0].length + n.window);
      if (n.near && !n.near.test(span)) continue;
      if (n.allow.some((a) => a.test(span))) continue;
      errors.push(`${rel(f)}: names [${n.id}] — "${where(text, m.index)}"`);
      break;
    }
  }
  for (const r of everywhere) {
    r.rx.lastIndex = 0;
    const m = r.rx.exec(text);
    if (!m) continue;
    const msg = `${rel(f)}: [${r.rule}] "${where(text, m.index)}" — ${r.reason}`;
    (english.has(f) ? errors : warnings).push(msg);
  }
}

// ── text addressed to agents, hidden from people ─────────────────────────
// An element a person cannot see (the `hidden` attribute, display:none, a
// visually-hidden class) must not carry words addressed to an AI. Visible
// routing ("If you are an AI agent → …") is fine; a hidden instruction is not.
const hiddenRe = new RegExp(rules.hidden.pattern, 'i');
const HIDDEN_EL = /<([a-z][\w-]*)\b[^>]*(?:\shidden(?=[\s=>/])|display:\s*none|class="[^"]*(?:sr-only|visually-?hidden)[^"]*")[^>]*>([\s\S]*?)<\/\1>/gi;
for (const f of all) {
  const html = fs.readFileSync(f, 'utf-8').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const m of html.matchAll(HIDDEN_EL)) {
    const text = visibleText(m[2]);
    const hit = hiddenRe.exec(text);
    if (hit) errors.push(`${rel(f)}: hidden <${m[1]}> addresses an AI — "${text.slice(0, 120)}" — ${rules.hidden.reason}`);
  }
}

// ── the rails pages ──────────────────────────────────────────────────────
const fileFor = (route) => {
  const cands = route === '/' ? ['index.html'] : [`${route.slice(1)}.html`, `${route.slice(1)}/index.html`];
  return cands.map((c) => path.join(BUILD, c)).find((p) => fs.existsSync(p));
};
const sources = rules.railsPages.numberSources.map((p) => fs.readFileSync(path.join(SITE, p), 'utf-8')).join('\n');
const recording = JSON.parse(fs.readFileSync(path.join(SITE, 'src/data/rails-demo/recording.json'), 'utf-8'));
const derived = [String(recording.steps.length), String(new Date().getFullYear())];
const allowed = new Set([...rules.railsPages.numberAllow, ...derived]);
const banned = rules.railsPages.banned.map((r) => ({...r, rx: new RegExp(r.pattern, 'gi')}));

for (const route of rules.railsPages.routes) {
  const f = fileFor(route);
  if (!f) { errors.push(`${route}: not in the build`); continue; }
  const html = fs.readFileSync(f, 'utf-8');
  const main = html.slice(html.indexOf('<main'), html.lastIndexOf('</main>'));
  const text = visibleText(main);
  for (const r of banned) {
    r.rx.lastIndex = 0;
    const m = r.rx.exec(text);
    if (m) errors.push(`${route}: [${r.rule}] "${where(text, m.index)}" — ${r.reason}`);
  }
  // numbers: two or more digits, or a decimal, must come from a source file
  const seen = new Set();
  for (const m of text.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?![\w])/g)) {
    const n = m[0];
    if (n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    if (allowed.has(n) || sources.includes(n)) continue;
    errors.push(`${route}: the number ${n} is not read from the recording, the site data or the commands — "${where(text, m.index)}"`);
  }
}
for (const fr of rules.railsPages.framed) {
  const f = fileFor(fr.route);
  if (!f) continue;
  const html = fs.readFileSync(f, 'utf-8');
  let scope = html;
  if (fr.within) {
    const a = html.indexOf(`<${fr.within}`);
    const b = html.indexOf(`</${fr.within}>`, a);
    scope = a >= 0 && b > a ? html.slice(a, b) : '';
  }
  if (!visibleText(scope).includes(fr.must)) errors.push(`${fr.route}: "${fr.must}" is missing${fr.within ? ` from its <${fr.within}>` : ''} — ${fr.reason}`);
}

// ── release state: say "not released yet" until the rails ship ───────────
// src/data/rails-demo/release.json decides. Unreleased: every rails page shows
// the notice, and each pre-release file carries its marker (with the published
// versions where asked). Released: none of them may.
const REL = JSON.parse(fs.readFileSync(path.join(SITE, 'src/data/rails-demo/release.json'), 'utf-8'));
for (const route of rules.railsPages.routes) {
  const f = fileFor(route);
  if (!f) continue;
  const has = visibleText(fs.readFileSync(f, 'utf-8')).includes('Not released yet');
  if (!REL.railsReleased && !has) errors.push(`${route}: the rails are not released (release.json) but the page does not say "Not released yet"`);
  if (REL.railsReleased && has) errors.push(`${route}: release.json says released, yet the page still says "Not released yet"`);
}
// Every English docs page opens with the docs' own notice ("Not out yet.",
// src/theme/DocItem/Content) while the rails are unreleased — the docs
// describe the next release — and none may once they ship.
const DOCS_NOTICE = 'Not out yet.';
const docsDir = path.join(BUILD, 'docs');
if (fs.existsSync(docsDir)) {
  for (const f of htmlFiles(docsDir, false)) {
    const has = visibleText(fs.readFileSync(f, 'utf-8')).includes(DOCS_NOTICE);
    if (!REL.railsReleased && !has) errors.push(`${rel(f)}: the rails are not released (release.json) but this docs page lacks "${DOCS_NOTICE}"`);
    if (REL.railsReleased && has) errors.push(`${rel(f)}: release.json says released, yet this docs page still says "${DOCS_NOTICE}"`);
  }
}
for (const pf of REL.preReleaseFiles || []) {
  const text = fs.readFileSync(path.join(SITE, pf.path), 'utf-8');
  const has = text.includes(pf.marker);
  if (!REL.railsReleased && !has) errors.push(`${pf.path}: missing its pre-release marker "${pf.marker}" (release.json: not released)`);
  if (REL.railsReleased && has) errors.push(`${pf.path}: still carries "${pf.marker}" though release.json says released`);
  if (!REL.railsReleased && pf.versions) {
    for (const [name, v] of Object.entries(REL.published)) {
      if (!text.includes(`${name} ${v}`)) errors.push(`${pf.path}: its pre-release line does not name the published ${name} ${v}`);
    }
  }
}

for (const w of warnings.slice(0, 40)) console.log(`  warning  ${w}`);
if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more warnings`);
if (warnings.length) console.log(`[site-claims] ${warnings.length} warning(s): translated pages still carrying a retired phrase — they change with the next locale sync.`);
if (errors.length) {
  for (const e of errors) console.error(`  ERROR    ${e}`);
  console.error(`[site-claims] ${errors.length} breach(es) in ${all.length} pages`);
  process.exit(1);
}
console.log(`[site-claims] clean: ${all.length} pages (${english.size} English), rails pages' numbers all read from their sources`);
