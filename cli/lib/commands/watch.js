/**
 * Command: watch
 *
 * Starts a file watcher that auto-syncs when the source locale changes.
 * Delegates to lib/watch.startWatch.
 */

import { startWatch } from '../watch.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  await startWatch({ cwd, cliArgs: args });
  // Watch runs indefinitely — no exit code
}

export { run };
