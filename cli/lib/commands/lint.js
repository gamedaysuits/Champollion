/**
 * Command: lint
 *
 * Scans source files for hardcoded user-facing strings that should
 * be wrapped in t() calls. Returns exit code 1 if issues found
 * (unless --warn-only is set).
 */

import { runLint } from '../lint.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // --json: stdout carries exactly one JSON document (printed by runLint).
  // Quiet mode keeps the human progress/report lines off stdout.
  if (args.json) output.setMode('quiet');

  const exitCode = await runLint({
    cwd,
    cliArgs: args,
    warnOnly: !!args['warn-only'],
  });
  return exitCode;
}

export { run };
