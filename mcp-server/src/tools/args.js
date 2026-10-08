/**
 * One name for "the language" across every tool that takes ONE language.
 *
 * The tools grew their own names for it: `code` (get_language,
 * language_overview, forge_discover, forge_init), `target`
 * (get_metric_reliability), `query` (search_languages) — while list_queue,
 * list_contests and every prompt say `language`. An agent that carried
 * `language` from one tool to the next (a persona did:
 * get_metric_reliability {"language": "crk"}) got MCP error -32602,
 * "expected string, received undefined at target": the SDK drops the
 * argument it does not know, then misses the one it requires.
 *
 * Every one-language tool now ALSO accepts `language`. The original name keeps
 * working, so no existing caller breaks; both names are optional in the schema
 * and the handler insists on exactly one language — a missing language or two
 * different ones come back as a tool error that names both arguments.
 */

import { z } from 'zod';

/**
 * The schema for the `language` alias of a tool's own one-language argument.
 *
 * @param {string} primary  The tool's original argument name (`code`, `target`, `query`).
 * @returns {import('zod').ZodTypeAny}
 */
export function languageAlias(primary) {
  return z.string().optional()
    .describe(`Same as \`${primary}\`: every tool that takes one language also accepts it as \`language\`. Pass one of the two.`);
}

/**
 * Resolve a one-language tool's argument from its original name or the
 * `language` alias.
 *
 * @param {object} args     The parsed arguments.
 * @param {string} primary  The tool's original argument name.
 * @param {string} tool     The tool name (for the error text).
 * @returns {{value: string}|{error: string}}
 */
export function resolveLanguageArg(args, primary, tool) {
  const norm = (v) => (typeof v === 'string' ? v.trim() : '');
  const own = norm(args?.[primary]);
  const alias = norm(args?.language);
  if (own && alias && own.toLowerCase() !== alias.toLowerCase()) {
    return {
      error: `${tool}: \`${primary}\` ("${own}") and \`language\` ("${alias}") name different `
        + 'languages. They are the same argument: pass one of them.',
    };
  }
  const value = own || alias;
  if (!value) {
    return {
      error: `${tool} needs a language: pass \`language\` (or \`${primary}\`, its original name), `
        + 'e.g. {"language": "crk"}.',
    };
  }
  return { value };
}

/** The tool-error result for a refused argument set. */
export function argError(text) {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Quote ONE argument for a POSIX shell, so a printed command can be pasted
 * into a terminal as is: safe characters pass through, anything else is
 * single-quoted (a ' inside becomes '\''). The MCP printed
 * `--target-lang Ayta (variety not yet confirmed)` unquoted — not pasteable
 * (Round 9 hospital persona). The argv itself is executed without a shell.
 *
 * @param {string|number} arg
 * @returns {string}
 */
export function shellQuote(arg) {
  const s = String(arg);
  if (s === '') return "''";
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * A command line for display: every argument shell-quoted, space-joined.
 *
 * @param {Array<string|number>} argv
 * @returns {string}
 */
export function shellJoin(argv) {
  return argv.map(shellQuote).join(' ');
}
