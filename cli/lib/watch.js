/**
 * Watch mode — monitors the source locale file and re-syncs on changes.
 *
 * WHY THIS EXISTS: Extracted from sync.js to reduce the god-module
 * and give watch its own lifecycle management.
 *
 * Uses fs.watchFile (stat polling) with a configurable interval, followed
 * by a 500ms debounce to prevent duplicate syncs when editors write in
 * multiple steps (write + rename).
 *
 * WHY fs.watchFile INSTEAD OF fs.watch:
 *   fs.watch relies on kernel-level events (FSEvents on macOS, inotify on
 *   Linux). On macOS, FSEvents is unreliable in /tmp and other special
 *   directories, and can miss events when writeFileSync replaces the inode
 *   (atomic write = write-to-temp + rename). fs.watchFile uses stat polling,
 *   which is slower but works reliably on all platforms and filesystems.
 *   The 500ms polling interval keeps CPU overhead negligible for a single file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from './config.js';
import { detectFormatFromDir, getExtension } from './format.js';
import { runSync } from './sync.js';
import { output } from './output.js';

/**
 * Start watch mode — sync once, then re-sync on source file changes.
 *
 * LIFECYCLE:
 *   1. Resolve config and locate the source file
 *   2. Run the initial sync (awaited — completes before watching starts)
 *   3. Set up fs.watchFile on the source file
 *   4. Print [WATCH] Ready to signal the watcher is active
 *   5. Block indefinitely (the returned Promise never resolves until SIGINT)
 *
 * WHY THE PROMISE NEVER RESOLVES:
 *   The CLI dispatcher calls process.exit() after the command's run() resolves.
 *   Watch mode is a long-running process — it must block the run() promise
 *   to prevent the CLI from exiting. SIGINT cleanup handles shutdown.
 *
 * RE-ENTRANCY:
 *   If a change arrives while a sync is already in progress, the change is
 *   queued via `pendingSync`. When the current sync finishes, it checks
 *   `pendingSync` and re-syncs if needed. This prevents both re-entrant
 *   syncs AND silently dropped changes.
 *
 * @param {object} options
 * @param {string} [options.cwd] - Working directory
 * @param {object} [options.cliArgs] - CLI arguments
 * @returns {Promise<never>} Never resolves — blocks until SIGINT
 */
async function startWatch(options = {}) {
  const { cwd = process.cwd(), cliArgs = {} } = options;
  const config = resolveConfig(cliArgs, cwd);
  const format = config.format !== 'auto'
    ? config.format
    : detectFormatFromDir(config.localesDir);
  const ext = getExtension(format);
  const inputLocale = config.inputLocale;
  const sourceFile = `${inputLocale}${ext}`;
  const sourcePath = path.join(config.localesDir, sourceFile);

  output.info(`Watching ${sourceFile} for changes...`);

  // Await the initial sync so it completes before we start watching.
  // WHY: runSync is async and writes to target files in the locales directory.
  // Starting the watcher before the initial sync completes could cause the
  // sync's writes to trigger re-entrancy or confuse event delivery.
  await runSync({ cwd, dryRun: !!cliArgs.dry, cliArgs });

  // --- Watcher state ---
  let debounceTimer = null;
  let syncing = false;
  // Track whether a new change arrived while we were syncing.
  // WHY: Without this, a save during an active sync would be silently dropped.
  // The user would need to save a third time to trigger the re-sync.
  let pendingSync = false;

  /**
   * Execute a sync cycle. If another change arrives mid-sync, it sets
   * `pendingSync = true`, and we loop back to re-sync after the current
   * one finishes. This guarantees no change is ever silently dropped.
   */
  async function doSync() {
    syncing = true;
    try {
      output.info(`${sourceFile} changed — syncing locales...`);
      await runSync({ cwd, dryRun: !!cliArgs.dry, cliArgs });
    } catch (err) {
      // Log but don't crash — watch mode should survive transient errors
      // (e.g., malformed JSON during a half-written save).
      output.error(`Sync failed: ${err.message}`);
    }
    syncing = false;

    // If a change arrived during the sync, run again immediately.
    if (pendingSync) {
      pendingSync = false;
      await doSync();
    }
  }

  // Watch the source file using stat polling (fs.watchFile).
  // On change, debounce for 500ms then sync.
  fs.watchFile(sourcePath, { interval: 500 }, (curr, prev) => {
    // Only react to actual content changes (mtime changed)
    if (curr.mtimeMs === prev.mtimeMs) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (syncing) {
        // A sync is already in progress — mark that we need another one.
        pendingSync = true;
        return;
      }
      // Fire-and-forget but with error handling inside doSync().
      // We intentionally don't await here because we're inside a
      // setTimeout callback (non-async context). Errors are caught
      // inside doSync() and logged, never thrown.
      doSync();
    }, 500);
  });

  // Signal that the watcher is active and ready for file changes.
  // Tests use this line to know when it's safe to modify the source file.
  // Tests grep for this exact string to detect watcher readiness — use output.raw
  // to preserve the format while still respecting --quiet mode.
  output.raw(`\n[WATCH] Ready — monitoring ${sourceFile} for changes.`);

  // Return a promise that never resolves — keeps the CLI process alive.
  // SIGINT cleanup handles the actual shutdown via process.exit().
  return new Promise((resolve) => {
    // Use 'once' instead of 'on' to prevent duplicate handler stacking
    // if startWatch were ever called more than once in the same process.
    process.once('SIGINT', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      fs.unwatchFile(sourcePath);
      resolve(); // Allow the promise to resolve so cleanup can happen
      process.exit(0);
    });
  });
}

export { startWatch };
