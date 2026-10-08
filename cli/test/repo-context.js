/**
 * repo-context.js — which checkout a test is running in.
 *
 * A few tests check things that exist only in the private monorepo — the
 * internal licence register (docs/LICENSING.md), or the fetched source
 * snapshots under cli/data/ that git never tracks. The public repo is cut
 * from the monorepo without them (scripts/public_cut_exclude.txt), and a fresh
 * clone of either has no fetched data. Those tests SKIP there, saying why and
 * how to make them run. In the monorepo they assert in full, so a file that
 * goes missing there is still a failure, never a skip.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The repository root (cli/test → the root). */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** True in the private monorepo: its internal wiki is present. */
export const MONOREPO = fs.existsSync(path.join(REPO_ROOT, 'docs', 'INDEX.md'));

/**
 * A node:test `skip` value: false in the monorepo, else the reason.
 * @param {string} what  what the test needs that this checkout lacks
 */
export function monorepoOnly(what) {
  return MONOREPO ? false : `${what} — present only in the private monorepo`;
}

/** True when the website's own dependencies are installed. */
export const WEBSITE_DEPS = fs.existsSync(path.join(REPO_ROOT, 'cli', 'website', 'node_modules'));

/** A node:test `skip` value for tests that load website code. */
export const websiteOnly = WEBSITE_DEPS
  ? false
  : "the website's own dependencies are not installed (run: cd cli/website && npm ci)";
