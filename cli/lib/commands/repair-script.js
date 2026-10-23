/**
 * Command: repair-script
 *
 * Reverses script conversion that should never have happened: PUA-encoded
 * values (pIqaD / Tengwar / Kryptonian) in locales whose configuration says
 * conversion is off are restored to the working script via the converter's
 * own reverse table. See lib/repair-script.js for what is and is not touched.
 *
 * Exit codes: 0 = clean (including --dry previews); 1 = a file could not be
 * read/written, or PUA remained that no registered converter can reverse
 * (the file still cannot render — the repair is incomplete).
 */

import { runRepairScript, printRepairReport } from '../repair-script.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code
 */
async function run(args, cwd) {
  const json = !!args.json;
  if (json) output.setMode('quiet');

  const result = runRepairScript({ cwd, cliArgs: args });

  if (json) {
    console.log(JSON.stringify({
      command: 'repair-script',
      dry: result.dry,
      locales: result.locales,
      totals: result.totals,
    }, null, 2));
  } else {
    printRepairReport(result);
  }

  return args['warn-only'] ? 0 : result.exitCode;
}

export { run };
