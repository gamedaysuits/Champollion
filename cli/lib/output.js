/**
 * Central output controller — routes all CLI messages through a single interface.
 *
 * WHY: Without a central controller, every lib file does its own console.log
 * with inconsistent formatting (emoji prefixes, ad-hoc colors, mixed stderr/stdout).
 * This module provides a single point of control for:
 *   - Mode switching: default (clean text), json (machine-readable), quiet (errors only)
 *   - Consistent prefixes: [INFO], [OK], [WARN], [ERR]
 *   - Stderr routing: warnings and errors always go to stderr
 *   - Structured output: --json mode produces parseable JSON objects
 *   - Version banner: banner(version) prints startup header
 *   - Progress bar: progressBar(completed, total) renders inline █░ progress
 *
 * USAGE:
 *   import { output } from './output.js';
 *   output.banner('3.4.0');                                // startup header
 *   output.info('Source file loaded', { keys: 42 });
 *   output.ok('Sync complete');
 *   output.warn('Missing API key');
 *   output.error('Translation failed', { pair: 'en:fr' });
 *   output.progressBar(100, 2847);                         // inline progress
 *   output.progressBar(2847, 2847, { done: true });        // finalize with newline
 */

/**
 * Output modes:
 *   - 'default':  Human-readable text with [PREFIX] labels
 *   - 'json':     Machine-readable JSON objects, one per line
 *   - 'quiet':    Errors and warnings only (suppress info/ok/progress)
 *   - 'verbose':  Full detail including debug-level messages
 */
let mode = 'default';

/**
 * Set the output mode. Call once during CLI bootstrap.
 *
 * @param {'default'|'json'|'quiet'|'verbose'} newMode
 */
function setMode(newMode) {
  const valid = ['default', 'json', 'quiet', 'verbose'];
  if (!valid.includes(newMode)) {
    console.error(`[ERR] Invalid output mode "${newMode}" — expected one of: ${valid.join(', ')}`);
    return;
  }
  mode = newMode;
}

/**
 * Get the current output mode.
 *
 * @returns {string}
 */
function getMode() {
  return mode;
}

/**
 * Informational message — general status updates.
 * Suppressed in quiet mode.
 *
 * @param {string} msg - Human-readable message
 * @param {object} [data] - Structured data (emitted in json mode)
 */
function info(msg, data) {
  if (mode === 'quiet') return;
  if (mode === 'json') {
    console.log(JSON.stringify({ level: 'info', message: msg, ...data }));
    return;
  }
  console.log(`[INFO] ${msg}`);
}

/**
 * Success message — operation completed correctly.
 * Suppressed in quiet mode.
 *
 * @param {string} msg - Human-readable message
 * @param {object} [data] - Structured data (emitted in json mode)
 */
function ok(msg, data) {
  if (mode === 'quiet') return;
  if (mode === 'json') {
    console.log(JSON.stringify({ level: 'ok', message: msg, ...data }));
    return;
  }
  console.log(`[OK] ${msg}`);
}

/**
 * Warning — something is off but not fatal.
 * Always emitted (even in quiet mode). Goes to stderr.
 *
 * @param {string} msg - Human-readable message
 * @param {object} [data] - Structured data (emitted in json mode)
 */
function warn(msg, data) {
  if (mode === 'json') {
    console.error(JSON.stringify({ level: 'warn', message: msg, ...data }));
    return;
  }
  console.error(`[WARN] ${msg}`);
}

/**
 * Error — operation failed.
 * Always emitted. Goes to stderr.
 *
 * @param {string} msg - Human-readable message
 * @param {object} [data] - Structured data (emitted in json mode)
 */
function error(msg, data) {
  if (mode === 'json') {
    console.error(JSON.stringify({ level: 'error', message: msg, ...data }));
    return;
  }
  console.error(`[ERR] ${msg}`);
}

/**
 * Progress message — inline status for long-running operations.
 * Suppressed in quiet and json modes.
 *
 * @param {string} msg - Progress description
 */
function progress(msg) {
  if (mode === 'quiet' || mode === 'json') return;
  process.stdout.write(msg);
}

/**
 * Debug message — verbose detail, only shown in verbose mode.
 *
 * @param {string} msg - Debug message
 * @param {object} [data] - Structured data
 */
function debug(msg, data) {
  if (mode !== 'verbose') return;
  console.log(`[DEBUG] ${msg}`);
}

/**
 * Summary — end-of-command structured report.
 * In json mode, emits a single JSON summary object.
 * In default/verbose mode, prints a formatted summary.
 *
 * @param {object} data - Summary data
 * @param {string} [data.title] - Summary title
 */
function summary(data) {
  if (mode === 'quiet') return;
  if (mode === 'json') {
    console.log(JSON.stringify({ level: 'summary', ...data }));
    return;
  }
  if (data.title) {
    console.log(`\n${data.title}`);
  }
}

/**
 * Version banner — printed once at CLI startup.
 * Suppressed in quiet and json modes.
 *
 * @param {string} version - Package version string
 */
function banner(version) {
  if (mode === 'quiet' || mode === 'json') return;
  console.log(`champollion v${version}\n`);
}

/**
 * Progress bar — inline key-count progress indicator.
 *
 * Renders a bar like: `     ████████░░░░░░░░ 1,440/2,847 keys`
 * Uses carriage return (\r) to overwrite the current line in-place.
 * Call with `done = true` to finalize the line with a newline.
 *
 * Suppressed in quiet and json modes.
 *
 * @param {number} completed - Number of items completed
 * @param {number} total - Total number of items
 * @param {object} [opts] - Options
 * @param {string} [opts.label='keys'] - Unit label
 * @param {boolean} [opts.done=false] - Whether this is the final update (appends newline)
 */
function progressBar(completed, total, opts = {}) {
  if (mode === 'quiet' || mode === 'json') return;
  const { label = 'keys', done = false } = opts;

  // Calculate bar width based on terminal width, with sane defaults
  const termWidth = process.stdout.columns || 80;
  const barWidth = Math.max(10, Math.min(termWidth - 30, 32));

  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(ratio * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const nums = `${completed.toLocaleString()}/${total.toLocaleString()} ${label}`;

  if (done) {
    process.stdout.write(`\r     ${bar} ${nums}\n`);
  } else {
    process.stdout.write(`\r     ${bar} ${nums}`);
  }
}

/**
 * Raw output — bypasses all formatting. Use sparingly for
 * pre-formatted content like tables, ASCII art, or help text.
 *
 * Suppressed in quiet AND json modes: raw is human-facing decoration
 * (separators, banners, tables) that never belongs in a machine-readable
 * stream. Emitting it in json mode would interleave non-JSON lines and
 * break `champollion <cmd> --json | jq`. Structured output goes through
 * info()/ok()/warn()/error()/summary(), which json-encode themselves.
 *
 * @param {string} msg - Raw text to output
 */
function raw(msg) {
  if (mode === 'quiet' || mode === 'json') return;
  console.log(msg);
}

const output = {
  setMode,
  getMode,
  info,
  ok,
  warn,
  error,
  progress,
  debug,
  summary,
  banner,
  progressBar,
  raw,
};

export { output };
