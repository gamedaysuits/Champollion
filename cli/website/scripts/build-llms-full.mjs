#!/usr/bin/env node

/**
 * build-llms-full.mjs — regenerate `static/llms-full.txt` from the curated
 * `static/llms.txt` index + the LIVE docs tree.
 *
 * WHY THIS EXISTS
 *   `llms-full.txt` (the llms.txt convention's full-content companion) was a
 *   one-time hand-assembled snapshot committed at repo genesis — nothing in
 *   the repo regenerated it, so it silently drifted from the published docs
 *   (it predates the 2026-06-20 Arena→Network docs merge, among other
 *   changes). This script makes it a derived artifact with a real pipeline:
 *
 *     static/llms.txt  (curated index — the SSOT for WHICH pages ship
 *                       and in what order; hand-maintained, committed)
 *       + docs/**\/*.md|mdx  (the live public docs — the content SSOT)
 *       → static/llms-full.txt  (derived, committed; regenerate with this
 *                                script whenever docs or the index change)
 *
 * WHAT IT DOES
 *   1. Parses static/llms.txt: keeps its `# title` + `> summary` header, and
 *      collects every `- [Label](https://champollion.dev/...)` link in order.
 *   2. Links under /docs/ are resolved to their source file (frontmatter
 *      `slug` override first, then the path-derived route) and inlined as a
 *      `## Label` section: frontmatter stripped, MDX import/export lines
 *      stripped, JSX component tags (<Tabs>, <TabItem>, …) stripped — the
 *      same flattening the original snapshot used. FAIL-LOUD: an index link
 *      that resolves to no doc file aborts the build (a silently dropped
 *      section is drift, which is exactly what this script exists to end).
 *   3. Links that are not docs pages (live endpoints like /queue.json,
 *      external repos, site pages) cannot be inlined as markdown; they are
 *      emitted honestly as a final "Other Resources" link list with their
 *      index descriptions.
 *
 * USAGE
 *   node scripts/build-llms-full.mjs          # write static/llms-full.txt
 *   node scripts/build-llms-full.mjs --check  # exit 3 if the committed file
 *                                             # is stale (CI-able), write nothing.
 *                                             # Exit 1 = build error (bad index
 *                                             # link, crash), NOT staleness —
 *                                             # callers gate on the distinction.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(SITE_DIR, 'docs');
const INDEX_FILE = path.join(SITE_DIR, 'static', 'llms.txt');
const OUT_FILE = path.join(SITE_DIR, 'static', 'llms-full.txt');
const SITE_ORIGIN = 'https://champollion.dev';

const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// docs route map: '/docs/<route>' → source file
// ---------------------------------------------------------------------------

/** Split off YAML frontmatter. Returns {frontmatter, body}. */
function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return {frontmatter: '', body: raw};
  return {frontmatter: m[1], body: raw.slice(m[0].length)};
}

/** Minimal frontmatter scalar read (slug: value) — no YAML dep in this repo. */
function frontmatterScalar(frontmatter, key) {
  const m = new RegExp(`^${key}:\\s*['"]?([^'"\\n]+)['"]?\\s*$`, 'm').exec(frontmatter);
  return m ? m[1].trim() : null;
}

function walkDocs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDocs(p));
    else if (/\.mdx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

function buildRouteMap() {
  const routes = new Map(); // '/docs/x/y' → absolute file path
  for (const file of walkDocs(DOCS_DIR)) {
    const raw = fs.readFileSync(file, 'utf-8');
    const {frontmatter} = splitFrontmatter(raw);
    const rel = path
      .relative(DOCS_DIR, file)
      .replace(/\\/g, '/')
      .replace(/\.mdx?$/, '');
    const defaultRoute = '/docs/' + rel.replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
    const slug = frontmatterScalar(frontmatter, 'slug');
    let route = defaultRoute;
    if (slug) {
      // Docusaurus: absolute slug replaces the whole path under /docs;
      // relative slug replaces the last segment.
      route = slug.startsWith('/')
        ? '/docs' + slug
        : path.posix.join(path.posix.dirname(defaultRoute), slug);
    }
    routes.set(route.replace(/\/$/, '') || '/docs', file);
  }
  return routes;
}

// ---------------------------------------------------------------------------
// MDX → plain-markdown flattening (same shape as the original snapshot)
// ---------------------------------------------------------------------------

function flattenDoc(raw) {
  const {body} = splitFrontmatter(raw);
  const lines = body.split('\n');
  const kept = [];
  for (const line of lines) {
    // module-level MDX imports/exports
    if (/^\s*import\s+.+from\s+['"].+['"];?\s*$/.test(line)) continue;
    if (/^\s*export\s+(const|default|function)\b/.test(line)) continue;
    // JSX component open/close tags on their own line (<Tabs>, <TabItem …>,
    // </TabItem>, <Details …/>) — components are uppercase by convention.
    if (/^\s*<\/?[A-Z][\w.]*(\s[^>]*)?\/?>\s*$/.test(line)) continue;
    kept.push(line);
  }
  // collapse the 3+ blank runs the tag-stripping leaves behind
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const index = fs.readFileSync(INDEX_FILE, 'utf-8');

  // header: the index's own `# title` + `> summary` lines
  const headerLines = [];
  for (const line of index.split('\n')) {
    if (line.startsWith('# ') || line.startsWith('> ')) headerLines.push(line, '');
    if (line.startsWith('## ')) break;
  }

  const links = [];
  const linkRe = /^- \[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(?::\s*(.*))?$/gm;
  let m;
  while ((m = linkRe.exec(index)) !== null) {
    links.push({label: m[1], url: m[2], description: (m[3] || '').trim()});
  }
  if (links.length === 0) {
    console.error(`FATAL: no links parsed from ${INDEX_FILE} — refusing to emit an empty llms-full.txt`);
    process.exit(1);
  }

  // A bullet that carries no markdown link does not match linkRe and was
  // therefore dropped in silence. That is how the MCP server — the entire
  // agent-facing surface — ended up with ZERO occurrences in the 708 KB file
  // agents actually read, while looking present in llms.txt. Absence read as
  // a pass. Say so instead.
  const dropped = index
    .split('\n')
    .filter((l) => /^- /.test(l) && !/^- \[[^\]]+\]\(https?:\/\//.test(l));
  if (dropped.length > 0) {
    console.warn(
      `WARNING: ${dropped.length} bullet(s) in ${INDEX_FILE} carry no markdown link and are NOT`
      + ` included in llms-full.txt. Agents reading the full file will never see them.`
      + ` Give each a [label](https://champollion.dev/...) link, or accept that it is index-only:`,
    );
    for (const line of dropped) console.warn(`  · ${line.trim().slice(0, 120)}`);
  }

  const routes = buildRouteMap();
  const sections = [];
  const external = [];
  const failures = [];

  for (const link of links) {
    if (!link.url.startsWith(SITE_ORIGIN + '/docs/')) {
      external.push(link);
      continue;
    }
    const route = link.url.slice(SITE_ORIGIN.length).replace(/[#?].*$/, '').replace(/\/$/, '');
    const file = routes.get(route);
    if (!file) {
      failures.push(`${link.label} → ${route} (no doc file resolves to this route)`);
      continue;
    }
    // The SECTION delimiter is deliberately not markdown: inlined docs
    // carry their own `##` headings and `---` rules, so plain markdown
    // separators are ambiguous. `===== SECTION: <label> =====` appears
    // nowhere in doc content, making the file programmatically splittable.
    sections.push(`===== SECTION: ${link.label} =====\n\n${flattenDoc(fs.readFileSync(file, 'utf-8'))}`);
  }

  if (failures.length > 0) {
    console.error('FATAL: llms.txt links that resolve to no doc file (fix the index or the doc slug):');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  // Generated table of contents: agents fetching a ~200k-token file need
  // to know what is in it and how to split it before committing context.
  const toc =
    '## Contents\n\n' +
    'This file is split by lines of the form `===== SECTION: <label> =====`\n' +
    '(unique — safe to split on). Sections, in order:\n\n' +
    sections
      .map((s) => `- ${s.slice('===== SECTION: '.length, s.indexOf(' =====\n'))}`)
      .join('\n') +
    '\n\n';
  let out = headerLines.join('\n') + '\n' + toc + sections.join('\n\n') + '\n';
  if (external.length > 0) {
    out +=
      '\n---\n\n## Other Resources\n\n' +
      'Live endpoints and repositories (not inlineable documentation):\n\n' +
      external
        .map((l) => `- [${l.label}](${l.url})${l.description ? `: ${l.description}` : ''}`)
        .join('\n') +
      '\n';
  }

  if (CHECK) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf-8') : '';
    if (current !== out) {
      // Exit 3 = STALENESS, distinct from exit 1 (build error) so callers
      // (scripts/champollion_sync_gate.sh) can hard-block on real drift
      // while degrading gracefully when the builder itself fails.
      console.error('llms-full.txt is STALE — regenerate with `node scripts/build-llms-full.mjs`.');
      process.exit(3);
    }
    console.log('llms-full.txt is current.');
    return;
  }

  fs.writeFileSync(OUT_FILE, out);
  console.log(
    `wrote ${path.relative(SITE_DIR, OUT_FILE)} — ${sections.length} doc sections, ` +
      `${external.length} link-only resources, ${(out.length / 1024).toFixed(0)} KB`,
  );
}

main();
