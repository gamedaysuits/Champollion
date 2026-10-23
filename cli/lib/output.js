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
 * Keys as people can copy them. A gettext key with a context is
 * `msgctxt + U+0004 + msgid` — gettext's own encoding — and U+0004 is an
 * invisible control character on a terminal: a key copied from a report
 * could not be pasted back into `--redo keys:`. Every message printed here
 * shows it as "␄" (U+2404), which `--redo keys:` / `--force-keys` accept
 * back (lib/locale-layout.js keysForNamespace). Structured `data` fields in
 * --json keep the exact key.
 *
 * @param {*} msg
 * @returns {*} msg with U+0004 shown as ␄ (non-strings unchanged)
 */
function showKey(msg) {
  return typeof msg === 'string' ? msg.replace(/\u0004/g, '\u2404') : msg;
}

/**
 * LINE-ATOMIC OUTPUT. Locales are translated in parallel, and a progress
 * bar used to be a partial line (`\r…` with no newline) that any other
 * locale's message was appended to mid-line ("Translating 3 key(s) to
 * French (local)...[INFO] ru/django.po — 3 missing"). Now:
 *   - every message is one complete line;
 *   - a progress bar names its file, and is redrawn in place only on a
 *     terminal and only while nothing else has printed since — any other
 *     output first ends the open bar line, so nothing is lost or overwritten;
 *   - off a terminal (CI logs, pipes) every bar update is its own line.
 *
 * `openBar` is the item whose bar line is currently unterminated.
 */
let openBar = null;

function endOpenBar() {
  if (openBar !== null) {
    process.stdout.write('\n');
    openBar = null;
  }
}

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
    console.log(JSON.stringify({ level: 'info', message: showKey(msg), ...data }));
    return;
  }
  endOpenBar();
  console.log(`[INFO] ${showKey(msg)}`);
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
    console.log(JSON.stringify({ level: 'ok', message: showKey(msg), ...data }));
    return;
  }
  endOpenBar();
  console.log(`[OK] ${showKey(msg)}`);
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
    console.error(JSON.stringify({ level: 'warn', message: showKey(msg), ...data }));
    return;
  }
  endOpenBar();
  console.error(`[WARN] ${showKey(msg)}`);
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
    console.error(JSON.stringify({ level: 'error', message: showKey(msg), ...data }));
    return;
  }
  endOpenBar();
  console.error(`[ERR] ${showKey(msg)}`);
}

/**
 * Progress message — status for long-running operations, one complete line
 * (a trailing newline is added; see LINE-ATOMIC OUTPUT above). Callers name
 * what the line is about: with locales running in parallel, a bare
 * " [OK]" could belong to any of them.
 * Suppressed in quiet and json modes.
 *
 * @param {string} msg - Progress description
 */
function progress(msg) {
  if (mode === 'quiet' || mode === 'json') return;
  const line = showKey(String(msg)).replace(/\n+$/, '');
  if (line.trim() === '') return;
  endOpenBar();
  process.stdout.write(`${line}\n`);
}

/**
 * Finish an item's progress: " [OK]" after its own bar when that bar is the
 * line still open on a terminal, else a complete line naming the item.
 * Suppressed in quiet and json modes.
 *
 * @param {string} item - What finished (the file name the bar showed)
 * @param {string} status - e.g. "[OK]", "[ERR] all translations failed quality gate"
 */
function progressDone(item, status) {
  if (mode === 'quiet' || mode === 'json') return;
  const label = showKey(String(item));
  if (openBar === label) {
    process.stdout.write(` ${status}\n`);
    openBar = null;
    return;
  }
  endOpenBar();
  process.stdout.write(`     ${label} ${status}\n`);
}

/**
 * Debug message — verbose detail, only shown in verbose mode.
 *
 * @param {string} msg - Debug message
 * @param {object} [data] - Structured data
 */
function debug(msg, data) {
  if (mode !== 'verbose') return;
  endOpenBar();
  console.log(`[DEBUG] ${showKey(msg)}`);
}

/**
 * Event — one machine-readable progress record (json mode only).
 * Emits `{level:'event', event, ...fields}` on stdout; silent otherwise —
 * the human output already says the same thing in prose.
 *
 * Event types used by sync: 'cost' (the pre-run estimate, before the
 * --max-cost gate) and 'file' (one per content file × locale processed).
 *
 * @param {string} event - Event type
 * @param {object} [fields] - Structured data
 */
function event(eventType, fields) {
  if (mode !== 'json') return;
  console.log(JSON.stringify({ level: 'event', event: eventType, ...fields }));
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
    endOpenBar();
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
  endOpenBar();
  console.log(`champollion v${version}\n`);
}

/**
 * Progress bar — key-count progress for one item (a locale file).
 *
 * Renders a line like: `     fr.json ████████░░░░░░░░ 1,440/2,847 keys`
 * On a terminal the line is redrawn in place (\r) while it is still the
 * last thing printed and belongs to the same item; otherwise (another
 * locale's bar, any other message, or output that is not a terminal) each
 * update is its own complete line — see LINE-ATOMIC OUTPUT.
 * Call with `done = true` to finalize the line with a newline.
 *
 * Suppressed in quiet and json modes.
 *
 * @param {number} completed - Number of items completed
 * @param {number} total - Total number of items
 * @param {object} [opts] - Options
 * @param {string} [opts.item=''] - What the bar is for (e.g. the locale file)
 * @param {string} [opts.label='keys'] - Unit label
 * @param {boolean} [opts.done=false] - Whether this is the final update (appends newline)
 */
function progressBar(completed, total, opts = {}) {
  if (mode === 'quiet' || mode === 'json') return;
  const { label = 'keys', done = false } = opts;
  const item = showKey(String(opts.item || ''));

  // Calculate bar width based on terminal width, with sane defaults
  const termWidth = process.stdout.columns || 80;
  const barWidth = Math.max(10, Math.min(termWidth - 30, 32));

  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(ratio * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const nums = `${completed.toLocaleString()}/${total.toLocaleString()} ${label}`;
  const line = `     ${item ? `${item} ` : ''}${bar} ${nums}`;

  if (!process.stdout.isTTY) {
    endOpenBar();
    process.stdout.write(`${line}\n`);
    return;
  }
  if (openBar === item) {
    process.stdout.write(`\r${line}`);
  } else {
    endOpenBar();
    process.stdout.write(line);
  }
  openBar = item;
  if (done) endOpenBar();
}

/**
 * A warning block: pre-formatted lines on stderr (the quality-gate and
 * glossary reports), each a complete line with keys shown copyably.
 * Emitted in every human mode, like warn(); callers emit structured
 * records themselves in json mode.
 *
 * @param {string[]} lines
 */
function block(lines) {
  endOpenBar();
  for (const line of lines) console.error(showKey(line));
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
  endOpenBar();
  console.log(showKey(msg));
}

const output = {
  setMode,
  getMode,
  info,
  ok,
  warn,
  error,
  progress,
  progressDone,
  debug,
  summary,
  event,
  banner,
  progressBar,
  raw,
  block,
};

/**
 * A stored ISO timestamp as this machine's local date and time, with the
 * zone named: "2026-10-03 18:20 MDT". The caches store UTC (`…Z`); printing
 * the UTC date bare read as a day ahead of local time in the evening
 * (Round 5, Next.js persona: `tm stats` "Created"). Zones without an
 * abbreviation print as an offset ("GMT+5:30"). An unparsable value is
 * returned unchanged; a missing one as "unknown".
 *
 * @param {string|null|undefined} iso
 * @param {{ timeZone?: string }} [opts] - For tests; defaults to the machine's zone
 * @returns {string}
 */
function localTimestamp(iso, opts = {}) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZoneName: 'short', ...(opts.timeZone && { timeZone: opts.timeZone }),
  }).formatToParts(d).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

export { output, showKey, localTimestamp };
