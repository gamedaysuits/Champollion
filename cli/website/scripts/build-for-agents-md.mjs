#!/usr/bin/env node

/**
 * build-for-agents-md.mjs — regenerate `static/for-agents.md` from the
 * rendered page's source at `src/pages/for-agents.md`.
 *
 * WHY THIS EXISTS
 *   /for-agents is the agent-facing front door (the Wolfram-style
 *   "for-agents.md" convention: the same page, fetchable as raw markdown at
 *   /for-agents.md by an agent with no HTML parser). Two copies of one page
 *   is drift waiting to happen, so the static artifact is DERIVED:
 *
 *     src/pages/for-agents.md   (the SSOT — hand-maintained, rendered
 *                                by Docusaurus at /for-agents)
 *       → this script
 *       → static/for-agents.md  (derived, committed; served raw at
 *                                /for-agents.md, exempt from the pre-launch
 *                                gate in middleware.js like llms.txt)
 *
 * WHAT IT DOES
 *   1. Reads the page source; keeps `title`/`description` from its
 *      frontmatter and re-emits them in the artifact's frontmatter along
 *      with a `canonical` URL (agents landing on the raw file learn where
 *      the rendered page lives).
 *   2. Strips HTML comments (maintainer notes are not for the artifact).
 *   3. Absolutizes root-relative markdown links (`](/docs/x)` →
 *      `](https://champollion.dev/docs/x)`) so the file works fetched in
 *      isolation.
 *
 * USAGE
 *   node scripts/build-for-agents-md.mjs          # write static/for-agents.md
 *   node scripts/build-for-agents-md.mjs --check  # exit 3 if the committed
 *                                                 # file is stale, write
 *                                                 # nothing. Exit 1 = build
 *                                                 # error, NOT staleness —
 *                                                 # callers gate on the
 *                                                 # distinction (same
 *                                                 # contract as
 *                                                 # build-llms-full.mjs).
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const SRC_FILE = path.join(SITE_DIR, 'src', 'pages', 'for-agents.md');
const OUT_FILE = path.join(SITE_DIR, 'static', 'for-agents.md');
const SITE_ORIGIN = 'https://champollion.dev';
const CANONICAL = `${SITE_ORIGIN}/for-agents`;

const CHECK = process.argv.includes('--check');

/** Split off YAML frontmatter. Returns {frontmatter, body}. */
function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return {frontmatter: '', body: raw};
  return {frontmatter: m[1], body: raw.slice(m[0].length)};
}

/** Minimal frontmatter scalar read — no YAML dep in this repo. */
function frontmatterScalar(frontmatter, key) {
  const m = new RegExp(`^${key}:\\s*['"]?([^\\n]+?)['"]?\\s*$`, 'm').exec(frontmatter);
  return m ? m[1].trim() : null;
}

function build() {
  if (!fs.existsSync(SRC_FILE)) {
    throw new Error(`page source not found: ${SRC_FILE}`);
  }
  const raw = fs.readFileSync(SRC_FILE, 'utf8');
  const {frontmatter, body} = splitFrontmatter(raw);
  const title = frontmatterScalar(frontmatter, 'title');
  const description = frontmatterScalar(frontmatter, 'description');
  if (!title || !description) {
    throw new Error(
      `src/pages/for-agents.md frontmatter must carry title and description ` +
      `(got title=${JSON.stringify(title)}, description=${JSON.stringify(description)})`
    );
  }

  let out = body
    // Maintainer-facing HTML comments do not ship in the artifact.
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    // Absolutize root-relative markdown links and images: ](/x → ](https://champollion.dev/x
    .replace(/\]\(\//g, `](${SITE_ORIGIN}/`);

  // Collapse the blank-line run left where the comment block was stripped.
  out = out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');

  const header = [
    '---',
    `title: ${title}`,
    `description: >-`,
    `  ${description}`,
    `canonical: ${CANONICAL}`,
    '---',
    '',
  ].join('\n');

  return header + out;
}

try {
  const artifact = build();
  if (CHECK) {
    const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
    if (committed !== artifact) {
      console.error(
        'static/for-agents.md is stale (src/pages/for-agents.md changed). ' +
        'Regenerate: node scripts/build-for-agents-md.mjs'
      );
      process.exit(3);
    }
    console.error('static/for-agents.md is current.');
    process.exit(0);
  }
  fs.writeFileSync(OUT_FILE, artifact);
  console.error(`wrote ${path.relative(SITE_DIR, OUT_FILE)} (${artifact.length} bytes)`);
} catch (err) {
  console.error(`build-for-agents-md: ${err.message}`);
  process.exit(1);
}
