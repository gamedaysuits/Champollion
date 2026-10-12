/**
 * local-only-marks.js — the files in a project a data steward has marked
 * local-only: a `<file>.champollion.json` sidecar saying
 * `"transmission": "local-only"` (what `champollion network register-corpus
 * --data … --tier local-only` writes, and what the harness and nmt-forge
 * honour: only a model on this machine may see that file).
 *
 * WHY init reads them: a project holding a local-only test set was set up
 * with a hosted model by default — `init --yes` wrote OpenRouter beside a
 * set its steward had said must never leave the machine (synthetic hospital
 * persona, Rounds 10, 12 and 14). A mark in the project is a statement about
 * where this project's text may go, so init's DEFAULT follows it: the local
 * method. An explicit --method still wins; a hosted method is then the
 * user's own choice, never a default.
 *
 * Read only: the walk opens sidecars (small JSON files) and nothing else;
 * the data files they describe are never read.
 */

import fs from 'node:fs';
import path from 'node:path';

/** The sidecar suffix — mt_eval_harness.corpus_loader.SIDECAR_SUFFIX (keep in step). */
export const SIDECAR_SUFFIX = '.champollion.json';

/** The one transmission value a sidecar sets (corpus_loader.LOCAL_ONLY). */
export const LOCAL_ONLY = 'local-only';

/**
 * Folders never searched: dependency trees, VCS metadata, virtualenvs,
 * build caches and champollion's own cache. A steward's data sits in the
 * project's own folders (data/, private/, test-sets/ …), not in these —
 * and node_modules can be enormous (or, through symlinked packages, cyclic).
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', '.champollion', '.venv', 'venv',
  '__pycache__', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  '.pytest_cache', '.mypy_cache', '.tox',
]);

/** How deep, and how many entries, the walk looks at — bounded, so init stays fast. */
const MAX_DEPTH = 8;
const MAX_ENTRIES = 50000;

/**
 * Every local-only mark under `root`, nearest first (by depth, then path).
 *
 * A sidecar that cannot be read is reported as a mark (`unreadable: true`):
 * the harness refuses to run a corpus whose sidecar it cannot read, and a
 * steward wrote it to restrict the data — an unreadable restriction is never
 * read as no restriction.
 *
 * @param {string} root - The project folder (init's cwd)
 * @returns {{ marks: Array<{ sidecar: string, dataFile: string, unreadable: boolean }>, truncated: boolean }}
 *   absolute paths; `truncated` when the walk hit its bound before finishing
 */
export function findLocalOnlyMarks(root) {
  const marks = [];
  let seen = 0;
  let truncated = false;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (++seen > MAX_ENTRIES) { truncated = true; break; }
      const full = path.join(dir, e.name);
      // Directory symlinks are not followed (no cycles, no leaving the project).
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (depth + 1 > MAX_DEPTH) { truncated = true; continue; }
        queue.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!e.name.endsWith(SIDECAR_SUFFIX) || e.name === SIDECAR_SUFFIX) continue;
      if (!(e.isFile() || e.isSymbolicLink())) continue;
      const mark = readMark(full);
      if (mark) marks.push({ ...mark, depth });
    }
    if (truncated && seen > MAX_ENTRIES) break;
  }
  marks.sort((a, b) => a.depth - b.depth || a.sidecar.localeCompare(b.sidecar));
  return { marks: marks.map(({ depth, ...m }) => m), truncated };
}

/**
 * One sidecar's mark, or null when it marks nothing local-only.
 *
 * @param {string} sidecar - Absolute path of a `<file>.champollion.json`
 * @returns {{ sidecar: string, dataFile: string, unreadable: boolean }|null}
 */
export function readMark(sidecar) {
  const dataFile = sidecar.slice(0, -SIDECAR_SUFFIX.length);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(sidecar, 'utf-8').replace(/^﻿/, ''));
  } catch {
    return { sidecar, dataFile, unreadable: true };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { sidecar, dataFile, unreadable: true };
  return String(data.transmission || '').trim().toLowerCase() === LOCAL_ONLY
    ? { sidecar, dataFile, unreadable: false }
    : null;
}
