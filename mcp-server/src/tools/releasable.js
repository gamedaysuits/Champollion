/**
 * Folders `mt-eval contest prepare` labels RELEASABLE — what an organizer
 * hands to entrants (the contest's `public/`). Run logs, reports and the
 * translation cache hold the test sentences and the model's outputs, so they
 * must never land in one: a later release of `public/` would ship them.
 *
 * Round 13 (synthetic researcher): a baseline run_benchmark on a contest's
 * released dev set (`<contest>/public/<id>.json`) wrote its cache and results
 * into `<contest>/public/results/`, because file runs keep their outputs
 * beside the corpus.
 *
 * The contract (the harness implements the same rule, and `mt-eval run`
 * refuses an --output-dir / --cache-dir inside a releasable folder — so this
 * server never passes one):
 *
 *   - a folder is releasable when it, or any ancestor, holds the marker
 *     `.champollion-releasable.json` (written by `mt-eval contest prepare`
 *     into `public/`);
 *   - and, for a contest prepared before the marker existed, when a folder
 *     named `public` has a sibling `local/manifest.json` (prepare's layout).
 *
 * The OUTERMOST releasable folder is returned, so a folder chosen beside it
 * (`<parent>/runs/`) is outside every releasable folder above the corpus.
 */

import { statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** The marker file `mt-eval contest prepare` writes into a releasable folder. */
export const RELEASABLE_MARKER = '.champollion-releasable.json';

/**
 * The outermost releasable folder at or above `dir`, or null.
 *
 * Like the harness (release_folder.releasable_root), the marker and the
 * manifest count only as FILES. Unlike it, the outermost match is returned
 * (the harness stops at the nearest): this server CHOOSES the output folder,
 * and `<parent of the outermost>/runs/` is outside every releasable folder
 * even when one sits inside another. For a refusal the two agree — any match
 * is inside a releasable folder.
 *
 * @param {string} dir  a folder (it need not exist yet: only markers are looked for)
 * @param {{isFile?: (p: string) => boolean}} [fs]
 * @returns {{root: string, why: 'marker'|'legacy', evidence: string}|null}
 *   evidence: the marker file, or the legacy layout's local/manifest.json
 */
export function releasableRoot(dir, {
  isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } },
} = {}) {
  if (typeof dir !== 'string' || !dir) return null;
  let d = resolve(dir);
  let found = null;
  for (;;) {
    const marker = join(d, RELEASABLE_MARKER);
    const manifest = join(dirname(d), 'local', 'manifest.json');
    if (isFile(marker)) found = { root: d, why: 'marker', evidence: marker };
    else if (basename(d) === 'public' && isFile(manifest)) found = { root: d, why: 'legacy', evidence: manifest };
    const up = dirname(d);
    if (up === d) return found;
    d = up;
  }
}

/** Is `dir` inside (or equal to) a releasable folder? */
export function isReleasable(dir, fs) {
  return releasableRoot(dir, fs) !== null;
}

/** Where run outputs go instead of a releasable folder R: `<parent of R>/runs/`. */
export function runsBaseFor(rel) {
  return join(dirname(rel.root), 'runs');
}

/** Why a folder is releasable, in words (the plan's reason). */
export function releasableReason(rel, show = (p) => p) {
  return rel.why === 'marker'
    ? `${show(rel.root)} is marked releasable by contest prepare (${RELEASABLE_MARKER})`
    : `${show(rel.root)} is a contest's public/ folder, which contest prepare releases (its local/manifest.json `
      + 'sits beside it; a contest prepared before the releasable marker existed)';
}
