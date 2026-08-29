/**
 * Command: sync
 *
 * Translates & syncs all locale files based on the project config.
 * Delegates entirely to lib/sync.runSync — this module just bridges
 * CLI arguments to the sync engine's options object.
 */

import { runSync } from '../sync.js';
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
 *   2 — partial: some keys translated but others failed, OR verification
 *       found errors. The run did real work but isn't clean.
 *       ALSO used for a --max-cost abort: the pre-run estimate exceeded the
 *       cap (or was unknowable — unknown ≠ free), so the sync deliberately
 *       stopped BEFORE any API call. Not catastrophic (nothing broke,
 *       nothing was spent), but definitely not a clean pass either.
 *
 * Pure and total (never throws) so it can be unit-tested directly.
 *
 * @param {{ totalProcessed?: number, totalFailed?: number, verifyErrors?: number, maxCostAborted?: boolean } | null | undefined} result
 * @returns {number} exit code
 */
function computeExitCode(result) {
  if (!result) return 0;

  // --max-cost abort: deliberate pre-run stop, exit 2 by documented contract.
  if (result.maxCostAborted) return 2;

  const processed = result.totalProcessed || 0;
  const failed = result.totalFailed || 0;
  const verifyErrors = result.verifyErrors || 0;

  // Catastrophic: failures with no successful work. A fully-failed sync
  // (bad key, every locale errored) must never exit 0.
  if (failed > 0 && processed === 0) return 1;

  // Partial: real work done but something failed, or files didn't verify.
  if (failed > 0 || verifyErrors > 0) return 2;

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
  }

  return computeExitCode(result);
}

export { run, computeExitCode };
