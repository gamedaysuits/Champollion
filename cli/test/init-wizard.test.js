/**
 * Tests: interactive init wizard (forced-TTY driver)
 *
 * The wizard only runs when stdin claims to be a TTY, which the node test
 * runner can't provide — so the --yes tests in init-help.test.js never
 * reach runInteractive(). A buildConfig ReferenceError once shipped
 * precisely because of that gap: every interactive run crashed while the
 * whole suite stayed green.
 *
 * fixtures/wizard-driver.mjs closes the gap: it forces stdin.isTTY and
 * answers each readline prompt as it appears, exercising the REAL
 * runInteractive() path end-to-end in a subprocess.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const DRIVER = path.join(import.meta.dirname, 'fixtures', 'wizard-driver.mjs');

/**
 * Run the wizard in tempDir, answering prompts in order.
 * Exhausted answers become "" (bare Enter → accept the default).
 *
 * Prompt order for the default walk (9 prompts):
 *   source, target languages, registers-adjust, method choice,
 *   temperature, content choice, locales dir, format, confirm.
 */
function runWizard(tempDir, answers, flags = {}) {
  return spawnSync(
    process.execPath,
    [DRIVER, JSON.stringify(answers), JSON.stringify(flags)],
    { cwd: tempDir, encoding: 'utf-8', timeout: 30000 },
  );
}

describe('interactive init wizard (forced-TTY driver)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-wizard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function readConfig() {
    return JSON.parse(fs.readFileSync(path.join(tempDir, 'champollion.config.json'), 'utf-8'));
  }

  it('completes with typed answers and writes the config', () => {
    const result = runWizard(tempDir, ['', 'fr,de', '', '1', '0.2', '1', '', '', 'yes']);
    assert.equal(result.status, 0, `wizard should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /Created champollion\.config\.json/);

    const config = readConfig();
    assert.equal(config.version, 3);
    assert.equal(config.inputLocale, 'en');
    assert.deepEqual(Object.keys(config.languages), ['fr', 'de']);
    // 0.2 differs from the method default (0.3) — must land in the config
    assert.equal(config.temperature, 0.2);
  });

  it('flags prefill the wizard — all-Enter answers accept them', () => {
    const result = runWizard(tempDir, [], { langs: 'fr', temperature: '0.55' });
    assert.equal(result.status, 0, `wizard should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /Temperature \(0\.0–1\.0\) \(0\.55\)/, '--temperature should appear as the prompt default');
    assert.match(result.stdout, /Target languages \(fr\)/, '--langs should appear as the prompt default');

    const config = readConfig();
    assert.deepEqual(Object.keys(config.languages), ['fr']);
    assert.equal(config.languages.fr, 'formal-vous', 'register preset key should be stored');
    assert.equal(config.temperature, 0.55);
  });

  it('accepting the default temperature omits it from the config', () => {
    const result = runWizard(tempDir, ['', 'fr']);
    assert.equal(result.status, 0, `wizard should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

    const config = readConfig();
    assert.ok(!('temperature' in config), 'default temperature should not clutter the config');
  });

  it('cancelling at the confirm step writes nothing', () => {
    const result = runWizard(tempDir, ['', 'fr', '', '', '', '', '', '', 'no']);
    assert.equal(result.status, 0, `cancel should still exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /Cancelled/);
    assert.ok(!fs.existsSync(path.join(tempDir, 'champollion.config.json')), 'no config on cancel');
  });

  it('marks unrecognized language codes in the selection list', () => {
    const result = runWizard(tempDir, ['', 'fr,zzz']);
    assert.equal(result.status, 0, `wizard should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /zzz[^\n]*unrecognized code/, 'bogus code should be flagged inline');
    assert.doesNotMatch(result.stdout, /fr — French[^\n]*unrecognized/, 'known codes should not be flagged');
  });
});
