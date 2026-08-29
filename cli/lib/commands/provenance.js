/**
 * Command: provenance
 *
 * Shows licensing and resource dependencies for all translation pairs.
 * Important for commercial readiness audits — each method reports what
 * external resources it relies on and their license status.
 */

import { resolveConfig, autoDetectLanguages } from '../config.js';
import { resolvePairs } from '../pairs.js';
import { formatProvenanceReport } from '../provenance.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // provenance takes no subcommand — a stray positional (e.g. `provenance bogus`)
  // is almost always a typo. Reject it with a non-zero exit instead of silently
  // ignoring it and reporting on the whole project. Matches `tm`/`seo`.
  const sub = args._[1];
  if (sub && sub !== 'help') {
    output.error(`Unknown subcommand: "${sub}". Usage: champollion provenance`);
    return 1;
  }

  const config = resolveConfig(args, cwd);

  let languages = config.resolvedLanguages;
  if (Object.keys(languages).length === 0) {
    languages = autoDetectLanguages(config);
  }
  config.resolvedLanguages = languages;

  const pairs = resolvePairs(config);
  const report = formatProvenanceReport(pairs);
  output.raw('\n  champollion — Provenance Report\n');
  output.raw(report);

  return 0;
}

export { run };
