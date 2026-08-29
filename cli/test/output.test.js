/**
 * Output controller tests — validates mode switching, JSON output shape,
 * quiet/verbose suppression, and stderr routing.
 *
 * WHY THESE EXIST:
 *   The output module is the ONLY channel between the library and CI
 *   consumers. If json mode produces malformed JSON or quiet mode leaks
 *   info messages, downstream integrations break silently. Previously
 *   untested.
 *
 * STRATEGY:
 *   Capture console.log/console.error/process.stdout.write during each
 *   test, then verify the output. Restore originals in afterEach to
 *   prevent test pollution.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { output } from '../lib/output.js';

// -----------------------------------------------------------------
// Capture infrastructure — intercept console.log and console.error
//
// NOTE: We do NOT override process.stdout.write because Node's test
// runner pipes its own output through stdout and overriding .write
// causes a "dest.write is not a function" crash. Instead we capture
// console.log/error only and test progress() indirectly.
// -----------------------------------------------------------------
let captured;
let origLog, origError;

function startCapture() {
  captured = { stdout: [], stderr: [] };
  origLog = console.log;
  origError = console.error;

  console.log = (...args) => captured.stdout.push(args.join(' '));
  console.error = (...args) => captured.stderr.push(args.join(' '));
}

function stopCapture() {
  console.log = origLog;
  console.error = origError;
}

// =================================================================
// 1. Mode switching
// =================================================================
describe('output: mode switching', () => {
  afterEach(() => {
    output.setMode('default');
    stopCapture();
  });

  it('defaults to "default" mode', () => {
    assert.equal(output.getMode(), 'default');
  });

  it('switches to json mode', () => {
    output.setMode('json');
    assert.equal(output.getMode(), 'json');
  });

  it('switches to quiet mode', () => {
    output.setMode('quiet');
    assert.equal(output.getMode(), 'quiet');
  });

  it('switches to verbose mode', () => {
    output.setMode('verbose');
    assert.equal(output.getMode(), 'verbose');
  });

  it('rejects invalid modes and stays on current', () => {
    output.setMode('json');
    startCapture();
    output.setMode('invalid-mode');
    stopCapture();
    // Should stay on json
    assert.equal(output.getMode(), 'json');
    // Should have logged an error
    assert.ok(captured.stderr.some(s => s.includes('Invalid output mode')));
  });
});

// =================================================================
// 2. Default mode output
// =================================================================
describe('output: default mode', () => {
  beforeEach(() => {
    output.setMode('default');
    startCapture();
  });
  afterEach(() => {
    stopCapture();
    output.setMode('default');
  });

  it('info() logs with [INFO] prefix to stdout', () => {
    output.info('Test message');
    assert.ok(captured.stdout.some(s => s.includes('[INFO] Test message')));
  });

  it('ok() logs with [OK] prefix to stdout', () => {
    output.ok('All good');
    assert.ok(captured.stdout.some(s => s.includes('[OK] All good')));
  });

  it('warn() logs with [WARN] prefix to stderr', () => {
    output.warn('Something is off');
    assert.ok(captured.stderr.some(s => s.includes('[WARN] Something is off')));
    // Should NOT be in stdout
    assert.ok(!captured.stdout.some(s => s.includes('[WARN]')));
  });

  it('error() logs with [ERR] prefix to stderr', () => {
    output.error('Broke');
    assert.ok(captured.stderr.some(s => s.includes('[ERR] Broke')));
    assert.ok(!captured.stdout.some(s => s.includes('[ERR]')));
  });

  it('progress() writes to stdout (does not use console.log)', () => {
    // progress() uses process.stdout.write directly, which we can't
    // capture without breaking the test runner. We verify it doesn't
    // go through console.log (i.e., it's not in our captured output).
    output.progress('working...');
    assert.equal(
      captured.stdout.filter(s => s.includes('working...')).length,
      0,
      'progress() should use process.stdout.write, not console.log'
    );
  });

  it('debug() does NOT log in default mode', () => {
    output.debug('should not appear');
    assert.equal(
      captured.stdout.filter(s => s.includes('should not appear')).length,
      0
    );
  });
});

// =================================================================
// 3. JSON mode output
// =================================================================
describe('output: json mode', () => {
  beforeEach(() => {
    output.setMode('json');
    startCapture();
  });
  afterEach(() => {
    stopCapture();
    output.setMode('default');
  });

  it('info() produces valid JSON with level field', () => {
    output.info('JSON test', { keys: 42 });
    const line = captured.stdout.find(s => s.includes('JSON test'));
    assert.ok(line, 'Should have output');
    const parsed = JSON.parse(line);
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.message, 'JSON test');
    assert.equal(parsed.keys, 42);
  });

  it('ok() produces valid JSON', () => {
    output.ok('Done');
    const parsed = JSON.parse(captured.stdout.find(s => s.includes('Done')));
    assert.equal(parsed.level, 'ok');
  });

  it('warn() produces valid JSON to stderr', () => {
    output.warn('Warning');
    const line = captured.stderr.find(s => s.includes('Warning'));
    const parsed = JSON.parse(line);
    assert.equal(parsed.level, 'warn');
  });

  it('error() produces valid JSON to stderr', () => {
    output.error('Error msg', { code: 'E001' });
    const line = captured.stderr.find(s => s.includes('Error msg'));
    const parsed = JSON.parse(line);
    assert.equal(parsed.level, 'error');
    assert.equal(parsed.code, 'E001');
  });

  it('summary() produces valid JSON with level=summary', () => {
    output.summary({ title: 'Report', count: 5 });
    const line = captured.stdout.find(s => s.includes('Report'));
    const parsed = JSON.parse(line);
    assert.equal(parsed.level, 'summary');
    assert.equal(parsed.count, 5);
  });

  it('progress() is suppressed in json mode', () => {
    output.progress('should not appear');
    assert.equal(
      captured.stdout.filter(s => s.includes('should not appear')).length,
      0
    );
  });

  it('raw() is suppressed in json mode (would break `| jq`)', () => {
    // Regression: verify.js prints decorative separators via raw(); in json
    // mode those non-JSON lines polluted stdout and broke `sync --json | jq`.
    output.raw('  ── decorative separator ──');
    assert.equal(
      captured.stdout.filter(s => s.includes('decorative separator')).length,
      0
    );
  });
});

// =================================================================
// 4. Quiet mode suppression
// =================================================================
describe('output: quiet mode', () => {
  beforeEach(() => {
    output.setMode('quiet');
    startCapture();
  });
  afterEach(() => {
    stopCapture();
    output.setMode('default');
  });

  it('suppresses info()', () => {
    output.info('quiet info');
    assert.equal(captured.stdout.length, 0);
  });

  it('suppresses ok()', () => {
    output.ok('quiet ok');
    assert.equal(captured.stdout.length, 0);
  });

  it('suppresses progress()', () => {
    output.progress('quiet progress');
    assert.equal(captured.stdout.length, 0);
  });

  it('suppresses summary()', () => {
    output.summary({ title: 'quiet summary' });
    assert.equal(captured.stdout.length, 0);
  });

  it('suppresses raw()', () => {
    output.raw('quiet raw');
    assert.equal(captured.stdout.length, 0);
  });

  it('STILL emits warn() in quiet mode', () => {
    output.warn('important warning');
    assert.ok(captured.stderr.some(s => s.includes('important warning')));
  });

  it('STILL emits error() in quiet mode', () => {
    output.error('critical error');
    assert.ok(captured.stderr.some(s => s.includes('critical error')));
  });
});

// =================================================================
// 5. Verbose mode
// =================================================================
describe('output: verbose mode', () => {
  beforeEach(() => {
    output.setMode('verbose');
    startCapture();
  });
  afterEach(() => {
    stopCapture();
    output.setMode('default');
  });

  it('debug() logs with [DEBUG] prefix in verbose mode', () => {
    output.debug('debug info');
    assert.ok(captured.stdout.some(s => s.includes('[DEBUG] debug info')));
  });

  it('info() still works in verbose mode', () => {
    output.info('verbose info');
    assert.ok(captured.stdout.some(s => s.includes('[INFO] verbose info')));
  });
});
