/**
 * Command: verify
 *
 * Re-reads all locale files from disk and confirms translations are
 * actually present and correct. Catches the gap between sync reporting
 * success and keys being wrong in fact.
 *
 * Exit code 1 if errors found (CI-gate compatible).
 * --strict exits 1 on warnings too (a source echo, a plural form the
 * translation did not supply, two locales with identical text, a
 * translation made from an older source text) — for a CI that must not pass
 * them. --warn-only exits 0 regardless.
 *
 * This runs the same checks that sync's post-sync verification uses,
 * but can be invoked independently for CI pipelines or manual auditing.
 *
 * --pair en:fr (comma-separated) verifies only those pairs' locales — the
 * same scoping `sync --pair` gives its post-sync verification. An unknown
 * pair fails loud, exactly as it does for sync.
 */

import { resolveConfig } from '../config.js';
import { verifyLocales, localesForPairFlag } from '../verify.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = errors found)
 */
async function run(args, cwd) {
  // Honor --json/--quiet so `champollion verify --json | jq` is parseable,
  // matching `sync`. Without this the verifier printed human text in json mode.
  if (args.json) output.setMode('json');
  else if (args.quiet) output.setMode('quiet');

  if (args.strict && args['warn-only']) {
    output.error('--strict (fail on warnings) and --warn-only (never fail) contradict each other — pick one.');
    return 1;
  }
  const config = resolveConfig(args, cwd);
  let locales = null;
  if (args.pair) {
    try {
      locales = localesForPairFlag(config, args.pair, { cwd });
    } catch (err) {
      output.error(err.message);
      return 1;
    }
  }
  // --strict: the summary line itself says a warning fails the check.
  const { errors, warnings } = await verifyLocales(config, cwd, { locales, strict: !!args.strict && !args['warn-only'] });

  if (errors > 0 && !args['warn-only']) {
    return 1;
  }
  if (args.strict && warnings > 0) {
    return 1;
  }
  return 0;
}

export { run };
