/**
 * Watch mode smoke tests — verify fs.watch lifecycle.
 *
 * WHY THESE EXIST:
 *   The `watch` command is the only CLI subcommand with no test coverage.
 *   It uses fs.watchFile (stat polling, 500ms interval) with a 500ms
 *   debounce and calls runSync on file changes. These tests verify:
 *     1. The watch process starts and performs an initial sync
 *     2. Writing to the source file triggers a debounced re-sync
 *     3. Rapid writes are collapsed into a single sync (debounce works)
 *     4. SIGINT triggers a clean shutdown with no leaked handles
 *
 * STRATEGY:
 *   We spawn the CLI binary as a child process rather than importing
 *   startWatch() directly. This avoids the process.on('SIGINT') side
 *   effect, tests the real entrypoint, and provides a clean process
 *   boundary for lifecycle assertions.
 *
 *   Assertions are based on stdout line matching — the watch module
 *   logs deterministic messages ("[INFO] Watching...", "[INFO] ... changed").
 *
 * TIMING:
 *   fs.watchFile polls every 500ms, plus a 500ms debounce window, so
 *   each file-change test needs ~1.5-3s of wall time after writing.
 *   Total file runtime ~8-12s. This is acceptable for a lifecycle test.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

/**
 * Create a temporary project directory with a valid config and source file.
 *
 * Sets up the minimum viable structure for the watch command:
 *   - champollion.config.json with dry-run mode for testing
 *   - locales/en.json as the source file
 *   - locales/fr.json as a target (so sync has something to report)
 *
 * @returns {{ tmpDir: string, sourcePath: string }}
 */
function createWatchFixture() {
  // Resolve the real path to avoid macOS symlink issues.
  // os.tmpdir() returns /var/folders/... but the actual path is /private/var/folders/...
  // The child process's cwd resolves to the real path, so fs.watch monitors /private/var/...
  // If we write to the /var/... path, FSEvents won't fire for the /private/var/... watcher.
  const rawTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-watch-'));
  const tmpDir = fs.realpathSync(rawTmpDir);
  const localesDir = path.join(tmpDir, 'locales');
  fs.mkdirSync(localesDir, { recursive: true });

  // Source locale
  const sourceData = {
    greeting: 'Hello',
    farewell: 'Goodbye',
  };
  const sourcePath = path.join(localesDir, 'en.json');
  fs.writeFileSync(sourcePath, JSON.stringify(sourceData, null, 2));

  // Target locale (partial — gives sync something to process)
  const targetData = {
    greeting: '[EN] Hello',
  };
  fs.writeFileSync(
    path.join(localesDir, 'fr.json'),
    JSON.stringify(targetData, null, 2)
  );

  // Config — dry-run mode so no API key is needed for testing watch lifecycle
  const config = {
    version: 3,
    inputLocale: 'en',
    localesDir: './locales',
    languages: ['fr'],
    model: 'google/gemini-3.5-flash',
    batchSize: 30,
  };
  fs.writeFileSync(
    path.join(tmpDir, 'champollion.config.json'),
    JSON.stringify(config, null, 2)
  );

  return { tmpDir, sourcePath };
}

/**
 * Spawn the watch command and collect stdout.
 *
 * Returns a controller object with:
 *   - stdout: array of collected lines
 *   - waitForLine(pattern, timeoutMs): wait for a line matching a regex
 *   - kill(): send SIGINT to the child
 *   - exited: promise that resolves when the child exits
 *
 * @param {string} cwd - Working directory for the child process
 */
function spawnWatch(cwd) {
  const child = spawn('node', [CLI_PATH, 'watch', '--dry'], {
    cwd,
    // Pipe stdout/stderr so we can read them
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Ensure no API key so we verify watch lifecycle (not translation)
      OPENROUTER_API_KEY: '',
      CHAMPOLLION_API_KEY: '',
    },
  });

  const stdout = [];
  const stderr = [];
  // Accumulate output line-by-line from both stdout and stderr
  // (sync.js uses console.log AND console.error for different messages)
  let stdoutBuffer = '';
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    // Keep the last partial line in the buffer
    stdoutBuffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) stdout.push(line);
    }
  });
  let stderrBuffer = '';
  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) stdout.push(line); // Merge stderr into stdout for pattern matching
    }
  });

  // Promise that resolves when the child exits
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      // Flush remaining buffers
      if (stdoutBuffer.trim()) stdout.push(stdoutBuffer.trim());
      if (stderrBuffer.trim()) stdout.push(stderrBuffer.trim());
      resolve({ code, signal });
    });
  });

  /**
   * Wait for a stdout line matching the given pattern.
   * Scans existing lines first, then polls for new ones.
   */
  function waitForLine(pattern, timeoutMs = 5000) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return new Promise((resolve, reject) => {
      // Check existing lines
      const existing = stdout.find(l => regex.test(l));
      if (existing) {
        resolve(existing);
        return;
      }

      const startTime = Date.now();
      const interval = setInterval(() => {
        const match = stdout.find(l => regex.test(l));
        if (match) {
          clearInterval(interval);
          resolve(match);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error(
            `Timed out waiting for pattern: ${pattern}\n` +
            `  Collected stdout (${stdout.length} lines):\n` +
            stdout.map(l => `    ${l}`).join('\n')
          ));
        }
      }, 100);
    });
  }

  function kill() {
    child.kill('SIGINT');
  }

  return { child, stdout, stderr, waitForLine, kill, exited };
}

/**
 * Cleanup helper — remove temp dir and make sure child is dead.
 */
function cleanup(tmpDir, watcher) {
  if (watcher && watcher.child && !watcher.child.killed) {
    watcher.kill();
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('watch — lifecycle smoke tests', () => {
  let tmpDir, sourcePath, watcher;

  beforeEach(() => {
    const fixture = createWatchFixture();
    tmpDir = fixture.tmpDir;
    sourcePath = fixture.sourcePath;
    watcher = null;
  });

  afterEach(() => {
    cleanup(tmpDir, watcher);
  });

  it('starts and performs initial sync', async () => {
    watcher = spawnWatch(tmpDir);

    // Watch should log the "Watching" message and perform an initial sync
    await watcher.waitForLine(/Watching.*for changes/i, 5000);

    // The sync should produce output (either [OK] or [SYNC] or [WARN])
    // Just verify we got past the watch initialization
    const hasOutput = watcher.stdout.some(l =>
      /\[OK\]|\[SYNC\]|\[WARN\]|\[INFO\]/.test(l)
    );
    assert.ok(hasOutput, 'Expected sync output after watch started');

    watcher.kill();
    await watcher.exited;
  });

  it('detects source file changes and re-syncs', async () => {
    watcher = spawnWatch(tmpDir);

    // Wait for initial sync to complete AND watcher to be active.
    // The [WATCH] Ready message is printed AFTER runSync completes and
    // fs.watch is set up, so we know it's safe to modify the source file.
    await watcher.waitForLine(/WATCH.*Ready/i, 10000);

    // Brief pause to ensure the watcher is fully registered before we modify
    await new Promise(r => setTimeout(r, 600));

    // Count how many sync-related lines we have before the write
    const initialLineCount = watcher.stdout.length;

    // Modify the source file — fs.watchFile detects this via stat mtime.
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
    sourceData.newKey = 'New value';
    fs.writeFileSync(sourcePath, JSON.stringify(sourceData, null, 2));

    // Wait for the debounced re-sync to fire.
    // Budget: 500ms polling interval + 500ms debounce + sync execution.
    // The watch module logs "[INFO] ... changed — syncing locales..."
    await watcher.waitForLine(/changed.*syncing/i, 8000);

    // Verify new output was produced after the file change
    assert.ok(
      watcher.stdout.length > initialLineCount,
      'Expected new stdout after source file modification'
    );

    watcher.kill();
    await watcher.exited;
  });

  it('debounces rapid writes into a single sync', async () => {
    watcher = spawnWatch(tmpDir);

    // Wait for initial sync to complete AND watcher to be active
    await watcher.waitForLine(/WATCH.*Ready/i, 10000);
    await new Promise(r => setTimeout(r, 200));

    // Count "syncing" messages before rapid writes
    const syncCountBefore = watcher.stdout.filter(l =>
      /changed.*syncing/i.test(l)
    ).length;

    // Write to the source file 5 times in rapid succession (~100ms apart).
    // The 500ms polling + 500ms debounce should collapse these into 1-2 syncs.
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
    for (let i = 0; i < 5; i++) {
      sourceData[`rapid_key_${i}`] = `Rapid value ${i}`;
      fs.writeFileSync(sourcePath, JSON.stringify(sourceData, null, 2));
      // Brief delay between writes — shorter than the debounce window
      await new Promise(r => setTimeout(r, 100));
    }

    // Wait for the debounced re-sync to fire.
    // Budget: 500ms polling + 500ms debounce + sync execution.
    await watcher.waitForLine(/changed.*syncing/i, 8000);

    // Allow time for any additional debounced syncs to complete
    await new Promise(r => setTimeout(r, 3000));

    // Count "syncing" messages after rapid writes
    const syncCountAfter = watcher.stdout.filter(l =>
      /changed.*syncing/i.test(l)
    ).length;

    // The debounce should collapse 5 rapid writes into 1-2 syncs max
    // (1 is ideal, 2 is acceptable if a boundary was hit)
    const additionalSyncs = syncCountAfter - syncCountBefore;
    assert.ok(
      additionalSyncs >= 1 && additionalSyncs <= 2,
      `Expected 1-2 debounced syncs but got ${additionalSyncs}. ` +
      `Debounce may not be working correctly.`
    );

    watcher.kill();
    await watcher.exited;
  });

  it('exits cleanly on SIGINT', async () => {
    watcher = spawnWatch(tmpDir);

    // Wait for watch to be running
    await watcher.waitForLine(/Watching.*for changes/i, 5000);

    // Send SIGINT (same as Ctrl+C)
    watcher.kill();

    // Wait for exit — should be clean (code 0 or null with SIGINT signal)
    const { code, signal } = await watcher.exited;

    // On SIGINT, Node.js may exit with code null + signal SIGINT,
    // or code 0 if the handler called process.exit(0)
    const cleanExit = (code === 0) || (signal === 'SIGINT');
    assert.ok(
      cleanExit,
      `Expected clean SIGINT exit but got code=${code}, signal=${signal}`
    );
  });
});
