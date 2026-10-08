/**
 * file-scope.js — `sync --files <glob>` and `sync --retranslate <glob>`.
 *
 * Dogfood 2026-08-28, finding 3: the only way to translate a subset of
 * files was hand-editing .champollion-content.lock — and deleting a lock
 * entry did not even work, because the sync then ADOPTED the existing
 * target as hand-translated instead of re-translating it.
 *
 *   --files <glob>        Only these content files are considered this run
 *                         (the rest are untouched, not even scanned).
 *   --retranslate <glob>  These content files are translated FRESH: the
 *                         lock, the adoption rule and the Translation
 *                         Memory are all bypassed for them. You named the
 *                         file, so this is the one place a run overwrites a
 *                         target it would otherwise keep — and pays for it.
 *
 * Patterns match the path the sync prints for a file: relative to the
 * content directory for Hugo ("posts/hello.md"), and prefixed with the
 * content folder for Docusaurus ("docs/intro.md", "blog/launch.md").
 * A contentDir project ALSO matches the path from the project root
 * ("newsletter/2026-10.md" for newsletter/2026-10.md): the repair hint a
 * sync printed (`--redo files:2026-10.md --fresh`) failed with "No content
 * file matches", and so did the root-relative path a person types next
 * (Round 6, school persona).
 * `*` stays within one folder, `**` crosses any number of folders. Both
 * flags repeat. A pattern that matches no source file is an error, raised
 * before anything is spent — a typo must not turn into "nothing happened".
 */

import { compilePattern } from './no-translate.js';

/**
 * @typedef {object} FileScope
 * @property {(label: string) => boolean} includes - Is this file in the run?
 * @property {(label: string) => boolean} retranslates - Translate it fresh?
 * @property {() => void} assertAllMatched - Throw if a pattern matched nothing
 * @property {boolean} limitsFiles - True when --files was given
 * @property {string[]} retranslatePatterns
 */

function toList(value) {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap(v => String(v).split(','))
    .map(v => v.trim().replace(/^\.\//, '').replace(/\\/g, '/'))
    .filter(Boolean);
}

/**
 * Build the run's file scope from CLI args. Returns null when neither flag
 * was given (the common case costs nothing).
 *
 * @param {object} cliArgs
 * @param {{ rootPrefix?: string }} [options] - rootPrefix: the content
 *   directory relative to the project root ("newsletter"); a pattern then
 *   also matches `<rootPrefix>/<label>`
 * @returns {FileScope|null}
 */
export function compileFileScope(cliArgs = {}, { rootPrefix = '' } = {}) {
  const filesPatterns = toList(cliArgs.files);
  const retranslatePatterns = toList(cliArgs.retranslate);
  if (filesPatterns.length === 0 && retranslatePatterns.length === 0) return null;

  const compile = (patterns) => patterns.map(p => ({ pattern: p, test: compilePattern(p, '/'), hits: 0 }));
  const files = compile(filesPatterns);
  const retranslate = compile(retranslatePatterns);

  const rawPrefix = String(rootPrefix || '').replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  const prefix = rawPrefix === '.' ? '' : rawPrefix;
  const matchAny = (list, label) => {
    const rel = label.replace(/\\/g, '/');
    const forms = [rel.split('/')];
    if (prefix) forms.push(`${prefix}/${rel}`.split('/'));
    let hit = false;
    for (const m of list) {
      if (forms.some(segments => m.test(segments))) { m.hits++; hit = true; }
    }
    return hit;
  };

  return {
    limitsFiles: files.length > 0,
    retranslatePatterns,
    retranslates: (label) => matchAny(retranslate, label),
    // A --retranslate file is always in the run, even outside --files. Both
    // lists are consulted every time: a short-circuit here left every
    // --retranslate pattern (= `--redo files:<glob> --fresh`) with zero hits
    // when no --files was given, and the run failed "No content file
    // matches" for a file that exists (Round 6, school persona).
    includes: (label) => {
      const inRetranslate = matchAny(retranslate, label);
      const inFiles = files.length === 0 || matchAny(files, label);
      return inFiles || inRetranslate;
    },
    assertAllMatched() {
      const dead = [...files, ...retranslate].filter(m => m.hits === 0).map(m => m.pattern);
      if (dead.length > 0) {
        const e = new Error(
          `No content file matches ${dead.map(p => JSON.stringify(p)).join(', ')}. ` +
          `Patterns match the paths sync prints, e.g. "docs/intro.md" or "posts/**"${prefix ? `, or the path from the project root ("${prefix}/…")` : ''}. Nothing was translated.`);
        e.code = 'CHAMPOLLION_NO_FILE_MATCH';
        throw e;
      }
    },
  };
}
