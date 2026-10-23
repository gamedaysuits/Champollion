#!/usr/bin/env node

/**
 * build-agents-md.mjs — regenerate the packaged AGENTS.md from the agents'
 * operating contract on the docs site.
 *
 * WHY THIS EXISTS
 *   `champollion new` writes AGENTS.md into every project on the rails, so an
 *   AI agent opened in that folder reads the rules it works under before it
 *   touches anything. The rules are written ONCE, as the docs page
 *   cli/website/docs/agents/contract.md (/docs/agents/contract). A second,
 *   hand-kept copy would drift, so the template is DERIVED:
 *
 *     cli/website/docs/agents/contract.md          (the SSOT — hand-maintained)
 *       → this script
 *       → shared/templates/language/AGENTS.md      (the monorepo SSOT copy)
 *       → cli/shared/templates/language/AGENTS.md  (the copy the npm package
 *                                                    ships and `new` reads;
 *                                                    sync-shared.mjs bundles
 *                                                    it, shared-bundle-parity
 *                                                    holds the two identical)
 *
 * WHAT IT DOES
 *   1. Strips the page's frontmatter, its maintainer HTML comments, and its
 *      own H1 (the header below replaces it).
 *   2. Strips the final "## Go deeper" section (site navigation, not rules).
 *   3. Absolutizes root-relative links (`](/docs/x)` →
 *      `](https://champollion.dev/docs/x)`) so the file works in a project
 *      folder with no site around it.
 *   4. Prepends a header naming the page it came from and the full manual.
 *
 * USAGE
 *   node cli/scripts/build-agents-md.mjs          # write both copies
 *   node cli/scripts/build-agents-md.mjs --check  # exit 3 if either copy is
 *                                                 # stale; writes nothing.
 *                                                 # Exit 1 = build error, NOT
 *                                                 # staleness (the contract of
 *                                                 # build-for-agents-md.mjs).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(CLI_DIR, '..');
export const SRC_FILE = path.join(CLI_DIR, 'website', 'docs', 'agents', 'contract.md');
export const OUT_FILES = [
  path.join(CLI_DIR, 'shared', 'templates', 'language', 'AGENTS.md'),
  path.join(REPO_ROOT, 'shared', 'templates', 'language', 'AGENTS.md'),
];
const SITE_ORIGIN = 'https://champollion.dev';
const CONTRACT_URL = `${SITE_ORIGIN}/docs/agents/contract`;
const MANUAL_URL = `${SITE_ORIGIN}/docs/agents`;
const REGEN = 'node cli/scripts/build-agents-md.mjs';

/** Split off YAML frontmatter. */
function stripFrontmatter(raw) {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return m ? raw.slice(m[0].length) : raw;
}

/** Remove the `## Go deeper` section: from its heading to the next H2 or EOF. */
function stripGoDeeper(body) {
  const m = /^## Go deeper[^\n]*\n/m.exec(body);
  if (!m) throw new Error('contract.md has no "## Go deeper" section to strip (was it renamed?)');
  const rest = body.slice(m.index + m[0].length);
  const next = /^## /m.exec(rest);
  return body.slice(0, m.index) + (next ? rest.slice(next.index) : '');
}

export function build() {
  if (!fs.existsSync(SRC_FILE)) throw new Error(`contract page not found: ${SRC_FILE}`);
  let body = stripFrontmatter(fs.readFileSync(SRC_FILE, 'utf8'))
    // maintainer-facing HTML comments do not ship
    .replace(/<!--[\s\S]*?-->\n?/g, '');
  body = stripGoDeeper(body)
    // the page's own H1 — the header below names the file instead
    .replace(/^\s*# [^\n]*\n/, '')
    // root-relative links and images → absolute site URLs
    .replace(/\]\(\//g, `](${SITE_ORIGIN}/`);
  body = body.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd() + '\n';
  if (!body.trim()) throw new Error('contract.md produced an empty AGENTS.md');

  const header = [
    "# AGENTS.md — the rails' operating contract",
    '',
    `Generated from ${CONTRACT_URL}; the full manual for agents is at ${MANUAL_URL}.`,
    '',
    '',
  ].join('\n');
  return header + body;
}

function main() {
  const CHECK = process.argv.includes('--check');
  try {
    const artifact = build();
    if (CHECK) {
      const stale = OUT_FILES.filter((f) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== artifact);
      if (stale.length) {
        console.error(`${stale.map((f) => path.relative(REPO_ROOT, f)).join(' and ')} `
          + `${stale.length > 1 ? 'are' : 'is'} stale (cli/website/docs/agents/contract.md changed). `
          + `Regenerate: ${REGEN}`);
        process.exit(3);
      }
      console.error('AGENTS.md (both template copies) is current.');
      process.exit(0);
    }
    for (const f of OUT_FILES) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, artifact);
      console.error(`wrote ${path.relative(REPO_ROOT, f)} (${artifact.length} bytes)`);
    }
  } catch (err) {
    console.error(`build-agents-md: ${err.message}`);
    process.exit(1);
  }
}

/** Run as a script (not imported by a test): compare real paths, since a
 *  temp dir or a symlinked checkout makes argv[1] and import.meta.url differ. */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
