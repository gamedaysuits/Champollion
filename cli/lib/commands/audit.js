/**
 * Command: audit
 *
 * Lists what is not translated across all locale files — missing, empty or
 * [EN] fallback values — translations that are OUT OF DATE (made from an
 * older source text than the current one, per .champollion.lock), and plural
 * messages without a form the language uses for ordinary counts (the ones
 * `verify --strict` fails on). Returns exit code 1 if any exist — usable as
 * a CI completeness gate.
 */

import { runSync } from '../sync.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // --json: machine-readable NDJSON (same controller sync uses) — the audit
  // branch in lib/sync.js emits a structured summary with the untranslated
  // key list per locale. --quiet: warnings and errors only.
  if (args.json) output.setMode('json');
  else if (args.quiet) output.setMode('quiet');

  let result;
  try {
    result = await runSync({
      audit: true,
      cwd,
      cliArgs: args,
    });
  } catch (err) {
    // Keep --json stdout machine-parseable even on a hard error (missing
    // locales dir, bad config) — mirror commands/sync.js.
    if (args.json) {
      output.summary({ command: 'audit', ok: false, error: err.message });
      return 1;
    }
    throw err;
  }

  // Exit 1 if any keys still need translation OR a configured locale file
  // is missing entirely (parity gate). A missing file means zero translation
  // done for that locale — a CI gate must never go green on it.
  // Plural messages missing a form the language uses for ordinary counts
  // count too: the same entries `verify --strict` fails on.
  if (result && (result.untranslatedCount > 0 || result.outOfDateCount > 0 || result.missingLocaleCount > 0
    || result.pluralGapCount > 0)) {
    return 1;
  }
  return 0;
}

export { run };
