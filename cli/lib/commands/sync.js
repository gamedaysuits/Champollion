/**
 * Command: sync
 *
 * Translates & syncs all locale files based on the project config.
 * Delegates entirely to lib/sync.runSync — this module just bridges
 * CLI arguments to the sync engine's options object.
 */

import { runSync } from '../sync.js';
import { shutdownMethods } from '../translate.js';
import { output } from '../output.js';

/**
 * Map a runSync result to a process exit code.
 *
 * Exit codes (documented contract for CI pipelines + agents):
 *   0 — clean: everything translated, verification passed.
 *   1 — catastrophic: failures occurred and NOTHING was translated.
 *       This is the bad-key / 401 case — every locale failed, so
 *       totalProcessed is 0. The old gate (`totalFailed > 0 &&
 *       totalProcessed > 0`) returned 0 here, so a `sync` wired into a
 *       pre-deploy hook went green while silently shipping English
 *       fallbacks. Any failure with zero progress must be loud.
 *   2 — partial: some keys translated but others failed (or were held
 *       back: refused before by the same method, so not re-sent), OR
 *       verification found errors. The run did real work but isn't clean.
 *       ALSO used for a --max-cost abort: the pre-run estimate exceeded the
 *       cap (or was unknowable — unknown ≠ free), so the sync deliberately
 *       stopped BEFORE any API call. Not catastrophic (nothing broke,
 *       nothing was spent), but definitely not a clean pass either.
 *
 * Pure and total (never throws) so it can be unit-tested directly.
 *
 * @param {{ totalProcessed?: number, totalFailed?: number, totalHeld?: number, contentTranslated?: number, contentFailed?: number,
 *   contentHeldBack?: number, contentRefused?: number, verifyErrors?: number, maxCostAborted?: boolean } | null | undefined} result
 * @returns {number} exit code
 */
function computeExitCode(result) {
  if (!result) return 0;

  // --max-cost abort: deliberate pre-run stop, exit 2 by documented contract.
  if (result.maxCostAborted) return 2;

  // A key named for a redo that matches nothing (a typo, a msgid that only
  // exists with a context): the repair asked for did not happen — exit 1,
  // never the 0 of a run that "did" nothing.
  if (Array.isArray(result.unmatchedKeys) && result.unmatchedKeys.length > 0) return 1;

  // Content files count alongside keys: a run where every content file
  // failed is a failure; one where some failed is partial.
  const processed = (result.totalProcessed || 0) + (result.contentTranslated || 0);
  const failed = (result.totalFailed || 0) + (result.contentFailed || 0);
  const verifyErrors = result.verifyErrors || 0;
  // Keys held back (refused before by this method — lib/locale-state.js):
  // not translated, so not a clean pass, but nothing failed anew. The same
  // for Markdown blocks and front-matter fields (lib/content-refusals.js):
  // held back, or refused by the quality gate this run and left as the
  // '[EN] ' last resort.
  // A plural message left without a form the language uses for ordinary
  // counts (filled with the "other" form, marked in a gettext catalog) is
  // incomplete in the same way.
  const held = (result.totalHeld || 0) + (result.contentHeldBack || 0) + (result.contentRefused || 0)
    + (result.totalPluralGaps || 0);

  // Catastrophic: failures with no successful work. A fully-failed sync
  // (bad key, every locale errored) must never exit 0.
  if (failed > 0 && processed === 0) return 1;

  // Partial: real work done but something failed or was held back, or
  // files didn't verify.
  if (failed > 0 || held > 0 || verifyErrors > 0) return 2;

  return 0;
}

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code: 0 = success, 1 = error, 2 = partial failure
 */
async function run(args, cwd) {
  // Set output mode before any sync work begins.
  // --json: machine-readable NDJSON, one JSON object per line.
  // --quiet: suppress info/ok messages, show only warnings and errors.
  if (args.json) output.setMode('json');
  else if (args.quiet) output.setMode('quiet');

  let result;
  try {
    result = await runSync({
      dryRun: !!args.dry,
      cwd,
      cliArgs: args,
    });
  } catch (err) {
    // In --json mode every outcome must be machine-parseable — including a
    // hard error (missing locales dir, preflight failure). Emit a structured
    // summary object instead of letting the dispatcher print a bare [ERR]
    // line that an agent would have to regex.
    if (args.json) {
      output.summary({ command: 'sync', ok: false, error: err.message });
      return 1;
    }
    throw err;
  } finally {
    // Stop the Python bridges external-method pairs started for this run.
    await shutdownMethods();
  }

  return computeExitCode(result);
}

export { run, computeExitCode };
