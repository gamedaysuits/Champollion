/**
 * Where this MCP server keeps state on the user's machine.
 *
 * One directory, `~/.champollion-mcp/` by default (CHAMPOLLION_MCP_HOME
 * relocates it — tests point it at a temp dir; a user whose home is not
 * writable can too). What lives there:
 *
 *   .champollion/tm.json   the `translate` tool's own Translation Memory
 *                          (the champollion package writes
 *                          <root>/.champollion/tm.json — the same layout a
 *                          project uses, but NOT any project's file)
 *   jobs.json              the run_benchmark job history (last 50 jobs)
 *   jobs/<job-id>/         one job's logs (stdout.log, stderr.log), its exit
 *                          record (exit.json) and, for item/corpus runs, the
 *                          harness's results (results/)
 *
 * Resolved on every call, never cached at import: the environment decides.
 */

import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/** The server's state directory (absolute). */
export function mcpStateDir(env = process.env) {
  const override = (env.CHAMPOLLION_MCP_HOME || '').trim();
  return override ? resolve(override) : join(homedir(), '.champollion-mcp');
}

/**
 * A path as shown to the agent: the home directory abbreviated to `~` so a
 * status line does not spell out the user's account name, while staying a
 * path a shell (and `mt-eval publish`) accepts.
 */
export function displayPath(p) {
  if (!p) return p;
  const home = homedir();
  if (p === home) return '~';
  if (p.startsWith(home + sep)) return `~${p.slice(home.length)}`;
  return p;
}
