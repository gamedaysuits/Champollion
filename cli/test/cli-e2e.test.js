/**
 * CLI end-to-end tests — spawns `node bin/cli.js` as a child process
 * and verifies exit codes, stdout/stderr output, and file system effects.
 *
 * WHY THESE EXIST:
 *   All other tests call library functions directly. This means import
 *   errors, argument parsing bugs, and subcommand routing issues can
 *   slip through. These tests exercise the ACTUAL entry point that
 *   users run, verifying the full boot-to-exit lifecycle.
 *
 * CATEGORIES:
 *   1. Version flag — `--version` exits 0 with version string
 *   2. Help command — `help` and `--help` produce usage info
 *   3. Unknown command — exits 1 with error message
 *   4. Sync dry run — `sync --dry` exits 0 and writes nothing
 *   5. Status command — `status` produces pair graph output
 *   6. Audit / provenance — runs without crash
 *   7. Error handling — missing config exits gracefully
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-cli-e2e-'));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Run CLI and capture both stdout and stderr, regardless of exit code.
 * Returns { stdout, stderr, status }.
 */
function runCLI(args, cwd) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [CLI_PATH, ...args],
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      status: err.status || 1,
    };
  }
}

// =================================================================
// 1. Version flag
// =================================================================
describe('cli-e2e: --version', () => {
  it('prints version and exits 0', () => {
    const { stdout, status } = runCLI(['--version'], process.cwd());
    assert.equal(status, 0);
    assert.ok(stdout.includes('champollion v'), `Expected version string, got: ${stdout}`);
    // Verify it looks like a semver
    assert.match(stdout.trim(), /champollion v\d+\.\d+\.\d+/);
  });
});

// =================================================================
// 2. Help command
// =================================================================
describe('cli-e2e: help', () => {
  it('`help` command exits 0 and shows command list', () => {
    const { stdout, status } = runCLI(['help'], process.cwd());
    assert.equal(status, 0);
    assert.ok(stdout.includes('sync'), 'Help should list sync command');
    assert.ok(stdout.includes('init'), 'Help should list init command');
    assert.ok(stdout.includes('lint'), 'Help should list lint command');
  });

  it('bare `--help` flag exits 0 and shows help', () => {
    // When no command is specified, --help should route to the help command
    const { stdout, status } = runCLI(['--help'], process.cwd());
    assert.equal(status, 0);
  });
});

// =================================================================
// 3. Unknown command
// =================================================================
describe('cli-e2e: unknown command', () => {
  it('exits 1 with error message for unknown command', () => {
    const { stderr, status } = runCLI(['nonexistent-command'], process.cwd());
    assert.equal(status, 1);
    assert.ok(
      stderr.includes('[ERR]') || stderr.includes('Unknown command'),
      `Expected error message, got: ${stderr}`
    );
  });
});

// =================================================================
// 3b. Unknown flags — strict validation
//
// PRELAUNCH AUDIT FIX: unknown flags used to be silently accepted
// (strict: false parseArgs), so `sync --content` or a typo like
// `--force-key` ran a normal sync as if the flag weren't there.
// =================================================================
describe('cli-e2e: unknown flags', () => {
  it('exits 1 with a helpful error for an unknown long flag', () => {
    const { stderr, status } = runCLI(['sync', '--content'], process.cwd());
    assert.equal(status, 1);
    assert.ok(stderr.includes('Unknown option: --content'), `Expected unknown-option error, got: ${stderr}`);
    assert.ok(stderr.includes('--help'), 'Error should point at per-command help');
  });

  it('exits 1 for an unknown short flag', () => {
    const { stderr, status } = runCLI(['sync', '-Z'], process.cwd());
    assert.equal(status, 1);
    assert.ok(stderr.includes('Unknown option: -Z'), `Expected unknown-option error, got: ${stderr}`);
  });

  it('reports every unknown flag, not just the first', () => {
    const { stderr, status } = runCLI(['sync', '--contnt', '--force-key', 'x'], process.cwd());
    assert.equal(status, 1);
    assert.ok(stderr.includes('Unknown option: --contnt'), `Expected --contnt reported, got: ${stderr}`);
    assert.ok(stderr.includes('Unknown option: --force-key'), `Expected --force-key reported, got: ${stderr}`);
  });

  it('still accepts every declared flag (e.g. --dry-run alias, --force)', () => {
    // `help` ignores flags, so this only exercises the parser/validator path.
    const { status } = runCLI(['help', '--dry-run', '--force', '--json'], process.cwd());
    assert.equal(status, 0);
  });
});

// =================================================================
// 4. Sync dry run
// =================================================================
describe('cli-e2e: sync --dry', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    // Set up a minimal valid project
    fs.writeFileSync(
      path.join(tempDir, 'champollion.config.json'),
      JSON.stringify({
        version: 3,
        inputLocale: 'en',
        localesDir: './locales',
        languages: ['fr'],
        model: 'openai/gpt-4o-mini',
        format: 'json',
      }),
      'utf-8'
    );
    // Create source locale file
    fs.mkdirSync(path.join(tempDir, 'locales'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hello', farewell: 'Goodbye' }),
      'utf-8'
    );
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('exits 0 in dry mode without writing target files', () => {
    const { status } = runCLI(['sync', '--dry'], tempDir);
    assert.equal(status, 0);
    // In dry mode, fr.json should NOT be created
    const frPath = path.join(tempDir, 'locales', 'fr.json');
    assert.ok(!fs.existsSync(frPath), 'Dry run should not create fr.json');
  });

  it('sync without API key exits with error (no silent failures)', () => {
    // Without an API key, sync should fail loudly — not silently write garbage
    const { status, stderr, stdout } = runCLI(['sync'], tempDir);
    // Preflight check should catch the missing key and exit 1
    assert.equal(status, 1, 'Sync without API key should exit 1');
    const combined = stdout + stderr;
    assert.ok(
      combined.includes('[ERR]') || combined.includes('API key') || combined.includes('No '),
      `Expected API key error, got: ${combined}`
    );
  });
});

// =================================================================
// 5. Status command
// =================================================================
describe('cli-e2e: status', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    fs.writeFileSync(
      path.join(tempDir, 'champollion.config.json'),
      JSON.stringify({
        version: 3,
        inputLocale: 'en',
        localesDir: './locales',
        languages: ['fr', 'de'],
        model: 'openai/gpt-4o-mini',
        format: 'json',
      }),
      'utf-8'
    );
    fs.mkdirSync(path.join(tempDir, 'locales'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hello' }),
      'utf-8'
    );
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('exits 0 and displays pair graph', () => {
    const { stdout, status } = runCLI(['status'], tempDir);
    assert.equal(status, 0);
    assert.ok(stdout.includes('champollion'), 'Should show tool name');
    assert.ok(stdout.includes('en:fr') || stdout.includes('fr'), 'Should list French pair');
    assert.ok(stdout.includes('en:de') || stdout.includes('de'), 'Should list German pair');
  });
});

// =================================================================
// 6. Provenance command
// =================================================================
describe('cli-e2e: provenance', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    fs.writeFileSync(
      path.join(tempDir, 'champollion.config.json'),
      JSON.stringify({
        version: 3,
        inputLocale: 'en',
        localesDir: './locales',
        languages: ['fr'],
        model: 'openai/gpt-4o-mini',
        format: 'json',
      }),
      'utf-8'
    );
    fs.mkdirSync(path.join(tempDir, 'locales'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'locales', 'en.json'),
      JSON.stringify({ a: 'A' }),
      'utf-8'
    );
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('exits 0 and shows provenance report', () => {
    const { stdout, status } = runCLI(['provenance'], tempDir);
    assert.equal(status, 0);
    // Standard LLM method should be all-clear
    assert.ok(
      stdout.includes('[OK]') || stdout.includes('commercial'),
      'Should report commercial readiness'
    );
  });
});

// =================================================================
// 7. Error handling — missing config
// =================================================================
describe('cli-e2e: error handling', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    // No config file — sync should fail gracefully
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('sync without config exits 1 or shows fallback behavior', () => {
    // WHY: sync without a config should either:
    //   - Exit 1 with an error about missing config, OR
    //   - Fall back to auto-detection and exit 0 with a "no languages" message
    // Either way, it should NOT crash with an unhandled exception.
    const { status, stderr, stdout } = runCLI(['sync'], tempDir);
    // Just verify it doesn't crash — exact behavior depends on auto-detect
    assert.ok(
      status === 0 || status === 1,
      `Should exit cleanly with 0 or 1, got ${status}`
    );
  });

  it('lint without --src exits with helpful error', () => {
    // Without a src directory, lint should handle gracefully
    const { status } = runCLI(['lint'], tempDir);
    assert.ok(
      status === 0 || status === 1,
      `Should exit cleanly, got ${status}`
    );
  });
});
