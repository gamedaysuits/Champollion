#!/usr/bin/env node

/**
 * build-docent-corpus.mjs — build the site docent's grounding corpus + the
 * edge-function bundle, from the LIVE PUBLIC docs tree only.
 *
 * WHY THIS EXISTS
 *   The docent (docent-chat edge function) answers ONLY from Champollion's
 *   public documentation, and must never see the internal `docs/` wiki (the
 *   doc-set rule). This script is the single place that assembles what the
 *   docent is allowed to know:
 *
 *     cli/website/docs/**\/*.md|mdx  (the public content SSOT)
 *     cli/shared/docent/system-prompt.md      (the docent's instructions)
 *     cli/shared/docent/register-blocks.json  (per-locale register guidance)
 *     cli/shared/docent/faq.en.json  (optional FAQ short-circuit SSOT)
 *       → cli/shared/docent/corpus.json                     (committed index)
 *       → functions/docent-chat/_generated/docent-bundle.json (deploy bundle)
 *
 *   HARD BOUNDARY: the ONLY content root walked is cli/website/docs. Nothing
 *   from the repo's internal `docs/` can enter the corpus — asserted below.
 *
 * WHAT IT DOES
 *   1. Walks the public docs tree; for each page: strips frontmatter, flattens
 *      MDX (imports/exports/JSX tags removed — same as build-llms-full.mjs),
 *      resolves its site route (frontmatter slug or path), and splits it into
 *      heading-sized CHUNKS ({id, docTitle, sectionTitle, url(+#anchor), text}).
 *   2. Reads the system prompt + register blocks (+ FAQ if present).
 *   3. Emits the committed corpus.json and the function's docent-bundle.json.
 *
 * USAGE
 *   node cli/scripts/build-docent-corpus.mjs          # write artifacts
 *   node cli/scripts/build-docent-corpus.mjs --check  # exit 3 if stale (CI-able)
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(CLI_DIR, '..');
const SITE_DIR = path.join(CLI_DIR, 'website');
const DOCS_DIR = path.join(SITE_DIR, 'docs'); // the ONLY content root
const DOCENT_DIR = path.join(CLI_DIR, 'shared', 'docent');
const OUT_CORPUS = path.join(DOCENT_DIR, 'corpus.json');
const OUT_BUNDLE = path.join(
  REPO_DIR,
  'mt-eval-arena', 'supabase', 'functions', 'docent-chat', '_generated',
  'docent-bundle.json',
);
const SITE_ORIGIN = 'https://champollion.dev';
const CHECK = process.argv.includes('--check');

// Chunking: target ~1500 chars, hard-split sections above ~2800 at paragraph
// boundaries so no single chunk dominates the retrieval budget.
const CHUNK_TARGET = 1500;
const CHUNK_MAX = 2800;

// ---- frontmatter / route / flatten (mirrors build-llms-full.mjs) ------------

function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return {frontmatter: '', body: raw};
  return {frontmatter: m[1], body: raw.slice(m[0].length)};
}

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

function routeFor(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const {frontmatter} = splitFrontmatter(raw);
  const rel = path.relative(DOCS_DIR, file).replace(/\\/g, '/').replace(/\.mdx?$/, '');
  const defaultRoute = '/docs/' + rel.replace(/(^|\/)index$/, '$1').replace(/\/$/, '');
  const slug = frontmatterScalar(frontmatter, 'slug');
  let route = defaultRoute;
  if (slug) {
    route = slug.startsWith('/')
      ? '/docs' + slug
      : path.posix.join(path.posix.dirname(defaultRoute), slug);
  }
  return (route.replace(/\/$/, '') || '/docs');
}

function docTitle(frontmatter, body, route) {
  return (
    frontmatterScalar(frontmatter, 'title') ||
    (/^#\s+(.+)$/m.exec(body)?.[1]?.trim()) ||
    route.split('/').pop()
  );
}

function flattenBody(body) {
  const kept = [];
  for (const line of body.split('\n')) {
    if (/^\s*import\s+.+from\s+['"].+['"];?\s*$/.test(line)) continue;
    if (/^\s*export\s+(const|default|function)\b/.test(line)) continue;
    if (/^\s*<\/?[A-Z][\w.]*(\s[^>]*)?\/?>\s*$/.test(line)) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Docusaurus-style heading slug (approximate): lowercase, strip markdown +
 * punctuation, spaces→hyphens. Good enough for a citation deep-link. */
function slugifyHeading(h) {
  return h
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ---- chunking ----------------------------------------------------------------

/** Split a flattened doc body into section chunks keyed by ## / ### headings. */
function chunkDoc(body) {
  const lines = body.split('\n');
  const sections = [];
  let cur = {heading: null, lines: []};
  for (const line of lines) {
    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (h) {
      if (cur.lines.join('').trim() || cur.heading) sections.push(cur);
      cur = {heading: h[2].trim(), lines: []};
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.lines.join('').trim() || cur.heading) sections.push(cur);

  const chunks = [];
  for (const sec of sections) {
    const text = sec.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text && !sec.heading) continue;
    if (text.length <= CHUNK_MAX) {
      chunks.push({heading: sec.heading, text});
    } else {
      // split oversized section at blank-line paragraph boundaries
      const paras = text.split(/\n\n+/);
      let buf = [];
      let len = 0;
      const flush = () => {
        if (buf.length) chunks.push({heading: sec.heading, text: buf.join('\n\n')});
        buf = [];
        len = 0;
      };
      for (const p of paras) {
        if (len + p.length > CHUNK_TARGET && buf.length) flush();
        buf.push(p);
        len += p.length;
      }
      flush();
    }
  }
  return chunks;
}

// ---- build -------------------------------------------------------------------

function buildCorpus() {
  const files = walkDocs(DOCS_DIR).sort();
  // HARD BOUNDARY: every source must live under the public docs tree.
  for (const f of files) {
    if (!path.resolve(f).startsWith(path.resolve(DOCS_DIR) + path.sep)) {
      throw new Error(`doc-set boundary violation: ${f} is outside ${DOCS_DIR}`);
    }
  }

  const chunks = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const {frontmatter, body} = splitFrontmatter(raw);
    // Skip pages explicitly hidden from the docent (frontmatter docent: false)
    if (frontmatterScalar(frontmatter, 'docent') === 'false') continue;
    const route = routeFor(file);
    const flat = flattenBody(body);
    const title = docTitle(frontmatter, body, route);
    const secs = chunkDoc(flat);
    let i = 0;
    for (const sec of secs) {
      const text = (sec.text || '').trim();
      if (text.length < 40) continue; // skip near-empty fragments
      const anchor = sec.heading ? '#' + slugifyHeading(sec.heading) : '';
      chunks.push({
        id: `${route}::${i}`,
        docTitle: title,
        sectionTitle: sec.heading || title,
        url: SITE_ORIGIN + route + anchor,
        text,
      });
      i++;
    }
  }
  return chunks;
}

// The docs-wide "Not out yet" notice is drawn by the site theme, not written in
// the pages, so the docent never retrieves it. Its source, the site's release
// flag, is stated in the system prompt instead ({{RELEASE_STATUS}}), so the
// docent never describes an unreleased tool as available.
const RELEASE_JSON = path.join(SITE_DIR, 'src', 'data', 'rails-demo', 'release.json');

function releaseStatus() {
  const r = JSON.parse(fs.readFileSync(RELEASE_JSON, 'utf-8'));
  const list = (o) => Object.entries(o || {}).map(([k, v]) => `${k} ${v}`).join(', ');
  if (r.railsReleased) {
    const missing = Object.entries(r.railsVersions || {}).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      throw new Error(`release.json says railsReleased but names no version for ${missing.join(', ')}`);
    }
    return `The step-by-step tools these docs describe are released: ${list(r.railsVersions)}.`;
  }
  return 'The step-by-step tools these docs describe (starting a project, the guided steps, '
    + 'the rails tools of the MCP server, training and the improve rounds) are NOT released yet: '
    + 'they come with the next version. Every docs page says "Not out yet." Say so whenever a '
    + `visitor asks how to use them, and never describe them as available today. Published today: ${list(r.published)} `
    + `(checked ${r.checked}); the app and website translation (\`champollion sync\`) works with those.`;
}

// FAQ answers are served verbatim (no model call), so they cannot read the
// prompt's release status: a sentence true only before the release is wrapped
// as {{UNRELEASED:…}} and kept (unwrapped) or dropped here, from the same flag.
function resolveReleaseText(text, released) {
  const out = text.replace(/ ?\{\{UNRELEASED:([^{}]*)\}\}/g, (_, s) => (released ? '' : ` ${s.trim()}`)).trim();
  const left = /\{\{[^}]*\}\}/.exec(out);
  if (left) throw new Error(`unresolved placeholder ${left[0]} in an FAQ answer`);
  return out;
}

function readOptionalJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return fallback;
  }
}

function main() {
  const systemPromptPath = path.join(DOCENT_DIR, 'system-prompt.md');
  const registerPath = path.join(DOCENT_DIR, 'register-blocks.json');
  const faqPath = path.join(DOCENT_DIR, 'faq.en.json');

  // The file's HTML comments are notes for maintainers, not the model. They
  // also name the placeholders, and a fill that hits the note instead of the
  // slot puts the retrieved docs inside a comment — so they never ship.
  const promptSource = fs.readFileSync(systemPromptPath, 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '').trim() + '\n';
  const relPrompt = path.relative(REPO_DIR, systemPromptPath);
  if (!promptSource.includes('{{RELEASE_STATUS}}')) {
    console.error(`FATAL: ${relPrompt} has no {{RELEASE_STATUS}} — `
      + 'the docent would not know which tools are out.');
    process.exit(1);
  }
  // The function fills these per request; each must be one slot, exactly once.
  for (const slot of ['{{REGISTER_BLOCK}}', '{{RETRIEVED_CONTEXT}}']) {
    const n = promptSource.split(slot).length - 1;
    if (n !== 1) {
      console.error(`FATAL: ${relPrompt} has ${slot} ${n} time(s) outside its comments — it must appear exactly once.`);
      process.exit(1);
    }
  }
  const systemPrompt = promptSource.replaceAll('{{RELEASE_STATUS}}', releaseStatus());
  const railsReleased = JSON.parse(fs.readFileSync(RELEASE_JSON, 'utf-8')).railsReleased === true;
  const registerBlocks = JSON.parse(fs.readFileSync(registerPath, 'utf-8'));
  const faq = readOptionalJson(faqPath, {faq: []});

  const chunks = buildCorpus();
  if (chunks.length === 0) {
    console.error('FATAL: 0 chunks built — refusing to emit an empty corpus.');
    process.exit(1);
  }

  const corpus = {
    _generated: 'Built from cli/website/docs by cli/scripts/build-docent-corpus.mjs. DO NOT EDIT.',
    version: 1,
    chunk_count: chunks.length,
    chunks,
  };
  const bundle = {
    _generated: 'Built by cli/scripts/build-docent-corpus.mjs. DO NOT EDIT — edit the SSOTs in cli/shared/docent/ and rebuild.',
    version: 1,
    systemPrompt,
    registerBlocks,
    faq: Array.isArray(faq.faq)
      ? faq.faq.map((e) => ({...e, answer: resolveReleaseText(e.answer, railsReleased)}))
      : [],
    chunks,
  };

  // Mirror of validateBundle() in
  // mt-eval-arena/supabase/functions/docent-chat/lib.ts — the SAME contract the
  // function enforces at cold start, asserted here so an unusable bundle is
  // never written in the first place. The runtime refuses to call the model
  // when this contract is broken (it serves the honest docs-and-ticket answer
  // instead), so a silent failure here degrades the live docent.
  const bundleDefect = (() => {
    if (!Array.isArray(bundle.chunks) || bundle.chunks.length === 0) {
      return 'chunks is empty — nothing to ground answers in';
    }
    if (!Array.isArray(bundle.faq)) return 'faq is not an array';
    if (typeof bundle.systemPrompt !== 'string' || !bundle.systemPrompt.trim()) {
      return `systemPrompt is empty (read from ${path.relative(REPO_DIR, systemPromptPath)})`;
    }
    return null;
  })();
  if (bundleDefect) {
    console.error(
      `FATAL: refusing to emit an unusable docent bundle — ${bundleDefect}.\n` +
        'The deployed function would refuse to answer from the model and serve ' +
        'the degraded docs-and-ticket answer instead.',
    );
    process.exit(1);
  }

  const corpusStr = JSON.stringify(corpus, null, 2) + '\n';
  const bundleStr = JSON.stringify(bundle) + '\n';

  if (CHECK) {
    const curCorpus = fs.existsSync(OUT_CORPUS) ? fs.readFileSync(OUT_CORPUS, 'utf-8') : '';
    const curBundle = fs.existsSync(OUT_BUNDLE) ? fs.readFileSync(OUT_BUNDLE, 'utf-8') : '';
    if (curCorpus !== corpusStr || curBundle !== bundleStr) {
      console.error('docent corpus/bundle is STALE — regenerate with `node cli/scripts/build-docent-corpus.mjs`.');
      process.exit(3);
    }
    console.log(`docent corpus is current (${chunks.length} chunks).`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT_BUNDLE), {recursive: true});
  fs.writeFileSync(OUT_CORPUS, corpusStr);
  fs.writeFileSync(OUT_BUNDLE, bundleStr);
  // The docent's default model: shared/model-defaults.json, copied beside the
  // function (index.ts imports it; cli/test/model-defaults.test.js holds the copy).
  fs.copyFileSync(path.join(REPO_DIR, 'shared', 'model-defaults.json'),
    path.join(path.dirname(path.dirname(OUT_BUNDLE)), 'model-defaults.json'));
  console.log(
    `wrote ${path.relative(REPO_DIR, OUT_CORPUS)} + the function bundle — ` +
      `${chunks.length} chunks from ${new Set(chunks.map((c) => c.url.split('#')[0])).size} pages, ` +
      `${faq.faq?.length || 0} FAQ entries, ${(bundleStr.length / 1024).toFixed(0)} KB bundle`,
  );
}

main();
