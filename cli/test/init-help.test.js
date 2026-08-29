/**
 * Tests: init command (interactive wizard) and command-help system
 *
 * Tests the non-interactive (--yes) init flow, language preset parsing,
 * config generation, and the per-command help registry.
 *
 * NOTE: This file tests the composable functions and the non-interactive
 * paths. The interactive wizard itself (runInteractive) is covered in
 * init-wizard.test.js via the forced-TTY driver in fixtures/wizard-driver.mjs.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

import { parseLanguageInput, buildDefaultConfig, buildConfig } from '../lib/commands/init.js';
import { COMMAND_HELP, showCommandHelp } from '../lib/command-help.js';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-init-test-'));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

// -----------------------------------------------------------------
// Tests: parseLanguageInput
// -----------------------------------------------------------------

describe('parseLanguageInput', () => {
  it('parses comma-separated language codes', () => {
    const result = parseLanguageInput('fr, de, ja');
    assert.deepEqual(result, ['fr', 'de', 'ja']);
  });

  it('expands preset names into language codes', () => {
    const result = parseLanguageInput('european');
    assert.deepEqual(result, ['fr', 'de', 'es', 'it', 'pt', 'nl']);
  });

  it('mixes presets and individual codes without duplicates', () => {
    const result = parseLanguageInput('asian, fr');
    assert.deepEqual(result, ['ja', 'zh', 'ko', 'fr']);
  });

  it('deduplicates when preset overlaps with explicit codes', () => {
    const result = parseLanguageInput('european, fr, de');
    // fr and de are already in "european" — should not repeat
    assert.deepEqual(result, ['fr', 'de', 'es', 'it', 'pt', 'nl']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseLanguageInput(''), []);
  });

  it('returns empty array for null input', () => {
    assert.deepEqual(parseLanguageInput(null), []);
  });

  it('handles whitespace-only input', () => {
    assert.deepEqual(parseLanguageInput('  ,  ,  '), []);
  });
});

// -----------------------------------------------------------------
// Tests: buildDefaultConfig
// -----------------------------------------------------------------

describe('buildDefaultConfig', () => {
  it('produces v3 config with sensible defaults', async () => {
    const config = await buildDefaultConfig({});
    assert.equal(config.version, 3);
    assert.equal(config.inputLocale, 'en');
    assert.equal(config.localesDir, './locales');
    assert.equal(config.model, 'google/gemini-3.5-flash');
    assert.equal(config.batchSize, 80);
    assert.equal(config.format, 'auto');
    assert.deepEqual(config.languages, []);
  });

  it('respects CLI arg overrides', async () => {
    const config = await buildDefaultConfig({
      source: 'fr',
      dir: './i18n',
      model: 'anthropic/claude-3',
      format: 'json',
    });
    assert.equal(config.inputLocale, 'fr');
    assert.equal(config.localesDir, './i18n');
    assert.equal(config.model, 'anthropic/claude-3');
    assert.equal(config.format, 'json');
  });

  it('parses --temperature into a number', async () => {
    const config = await buildDefaultConfig({ temperature: '0.2' });
    assert.equal(config.temperature, 0.2);
  });

  it('omits temperature when the flag is absent', async () => {
    const config = await buildDefaultConfig({});
    assert.ok(!('temperature' in config));
  });
});

// -----------------------------------------------------------------
// Tests: buildConfig (interactive wizard config assembly)
// -----------------------------------------------------------------

describe('buildConfig', () => {
  const baseAnswers = {
    source: 'en',
    languages: ['fr'],
    defaultMethod: 'llm',
    defaultModel: 'google/gemini-3.5-flash',
    perLanguage: null,
    customRegisters: null,
    localesDir: './locales',
    format: 'auto',
    contentDir: null,
  };

  // Regression: temperature was read as a bare identifier without being
  // destructured from answers, so every interactive run crashed with
  // "ReferenceError: temperature is not defined" before writing the config.
  it('includes temperature when the user set a non-default value', () => {
    const config = buildConfig({ ...baseAnswers, temperature: 0.55 });
    assert.equal(config.temperature, 0.55);
  });

  it('omits temperature when the default was accepted (null)', () => {
    const config = buildConfig({ ...baseAnswers, temperature: null });
    assert.ok(!('temperature' in config), 'temperature should not be written when null');
  });

  it('includes temperature 0 (explicit fully-deterministic choice)', () => {
    const config = buildConfig({ ...baseAnswers, temperature: 0 });
    assert.equal(config.temperature, 0);
  });

  it('builds array-form languages when no registers or overrides', () => {
    const config = buildConfig({ ...baseAnswers, temperature: null });
    assert.deepEqual(config.languages, ['fr']);
    assert.equal(config.version, 3);
    assert.equal(config.inputLocale, 'en');
  });
});

// -----------------------------------------------------------------
// Tests: init --yes (non-interactive mode)
// -----------------------------------------------------------------

describe('init --yes (non-interactive)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('creates a valid config file', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'init', '--yes'],
      { cwd: tempDir, encoding: 'utf-8' },
    );

    assert.ok(result.includes('[OK]'));

    const configPath = path.join(tempDir, 'champollion.config.json');
    assert.ok(fs.existsSync(configPath), 'Config file should exist');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.version, 3);
    assert.equal(config.inputLocale, 'en');
    assert.deepEqual(config.languages, []);
  });

  it('refuses to overwrite existing config (exits 1, leaves it intact)', () => {
    // Create a config first
    const cfgPath = path.join(tempDir, 'champollion.config.json');
    fs.writeFileSync(cfgPath, '{}', 'utf-8');

    // `init --yes` over an existing config now REFUSES (exit 1) rather than
    // clobbering — execFileSync throws on a non-zero exit, so capture it.
    let threw = false;
    let combined = '';
    try {
      execFileSync(
        process.execPath,
        [CLI_PATH, 'init', '--yes'],
        { cwd: tempDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch (err) {
      threw = true;
      assert.equal(err.status, 1, 'init over an existing config should exit 1');
      combined = `${err.stderr || ''}${err.stdout || ''}`;
    }
    assert.ok(threw, 'init --yes over an existing config should exit non-zero');
    assert.match(combined, /exist|--force|overwrite/i, 'should warn about the existing config');
    // The original config must NOT be clobbered.
    assert.equal(fs.readFileSync(cfgPath, 'utf-8'), '{}', 'existing config must be left intact');
  });

  it('accepts --source and --dir overrides', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'init', '--yes', '--source', 'fr', '--dir', './i18n'],
      { cwd: tempDir, encoding: 'utf-8' },
    );

    const configPath = path.join(tempDir, 'champollion.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.inputLocale, 'fr');
    assert.equal(config.localesDir, './i18n');
  });
});

// -----------------------------------------------------------------
// Tests: init flag validation + method/temperature passthrough
// -----------------------------------------------------------------

describe('init flag validation and passthrough', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  function runInit(flags, opts = {}) {
    return execFileSync(
      process.execPath,
      [CLI_PATH, 'init', ...flags],
      { cwd: tempDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts },
    );
  }

  function runInitExpectFail(flags) {
    try {
      runInit(flags);
    } catch (err) {
      return err;
    }
    assert.fail(`init ${flags.join(' ')} should have exited non-zero`);
  }

  it('writes --method and --temperature through to the config', () => {
    // Empty key ensures no live model-list fetch during the test
    const stdout = runInit(
      ['--yes', '--langs', 'fr,de', '--method', 'deepl', '--temperature', '0.2'],
      { env: { ...process.env, DEEPL_API_KEY: '' } },
    );

    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'champollion.config.json'), 'utf-8'));
    assert.equal(config.defaultMethod, 'deepl');
    assert.equal(config.temperature, 0.2);
    assert.deepEqual(config.languages, ['fr', 'de']);

    // Regression: the env-var hint used to hardcode 'llm', telling DeepL
    // users to set OPENROUTER_API_KEY.
    assert.match(stdout, /DEEPL_API_KEY/, 'next steps should name the chosen method’s key');
    assert.doesNotMatch(stdout, /OPENROUTER_API_KEY/, 'should not demand the default method’s key');
  });

  it('rejects an unknown --method with exit 1 and lists valid methods', () => {
    const err = runInitExpectFail(['--yes', '--method', 'deepL-typo']);
    assert.equal(err.status, 1);
    assert.match(String(err.stderr), /Unknown method/);
    assert.match(String(err.stderr), /deepl/, 'error should list the valid method names');
    assert.ok(!fs.existsSync(path.join(tempDir, 'champollion.config.json')), 'no config should be written');
  });

  it('rejects a non-numeric --temperature with exit 1', () => {
    // Regression: parseFloat("abc") = NaN used to serialize as
    // "temperature": null in the written config.
    const err = runInitExpectFail(['--yes', '--temperature', 'abc']);
    assert.equal(err.status, 1);
    assert.match(String(err.stderr), /temperature/i);
    assert.ok(!fs.existsSync(path.join(tempDir, 'champollion.config.json')), 'no config should be written');
  });

  it('rejects an out-of-range --temperature with exit 1', () => {
    const err = runInitExpectFail(['--yes', '--temperature', '1.5']);
    assert.equal(err.status, 1);
    assert.match(String(err.stderr), /between 0\.0 and 1\.0/);
  });

  it('warns on unrecognized --langs codes but keeps them in the config', () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, 'init', '--yes', '--langs', 'fr,zzz'],
      { cwd: tempDir, encoding: 'utf-8' },
    );
    assert.equal(result.status, 0, 'unknown codes warn, they do not fail');
    assert.match(result.stderr, /Unrecognized language code "zzz"/);
    assert.doesNotMatch(result.stderr, /"fr"/, 'known codes should not be flagged');

    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'champollion.config.json'), 'utf-8'));
    assert.deepEqual(config.languages, ['fr', 'zzz'], 'unknown codes are kept, not dropped');
  });

  it('explains the non-TTY fallback when --yes was not passed', () => {
    const stdout = runInit([], { input: '' });
    assert.match(stdout, /not a TTY/i, 'should say why the wizard was skipped');
    assert.ok(fs.existsSync(path.join(tempDir, 'champollion.config.json')));
  });

  it('documents --method in help output', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'init', '--help'],
      { encoding: 'utf-8' },
    );
    assert.match(result, /--method/);
    assert.match(result, /microsoft-translator/, 'help should list the valid method names');
  });
});

// -----------------------------------------------------------------
// Tests: command-help registry
// -----------------------------------------------------------------

describe('COMMAND_HELP registry', () => {
  const EXPECTED_COMMANDS = [
    'init', 'sync', 'watch', 'audit', 'lint', 'wrap',
    'seo', 'integrity', 'status', 'provenance', 'plugin',
  ];

  it('has entries for all registered commands', () => {
    for (const cmd of EXPECTED_COMMANDS) {
      assert.ok(COMMAND_HELP[cmd], `Missing help entry for "${cmd}"`);
    }
  });

  it('every entry has required fields', () => {
    for (const [name, help] of Object.entries(COMMAND_HELP)) {
      assert.ok(help.usage, `${name}: missing usage`);
      assert.ok(Array.isArray(help.description), `${name}: description should be array`);
      assert.ok(help.description.length > 0, `${name}: description should not be empty`);
      assert.ok(Array.isArray(help.options), `${name}: options should be array`);
      assert.ok(Array.isArray(help.examples), `${name}: examples should be array`);
      assert.ok(help.examples.length > 0, `${name}: should have at least one example`);
    }
  });

  it('subcommand entries exist for seo and plugin', () => {
    assert.ok(COMMAND_HELP.seo.subcommands.length >= 3, 'seo should have subcommands');
    assert.ok(COMMAND_HELP.plugin.subcommands.length >= 3, 'plugin should have subcommands');
  });
});

// -----------------------------------------------------------------
// Tests: per-command --help via CLI
// -----------------------------------------------------------------

describe('per-command --help', () => {
  it('champollion sync --help shows sync-specific help', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'sync', '--help'],
      { encoding: 'utf-8' },
    );

    assert.ok(result.includes('sync'), 'Should mention sync');
    assert.ok(result.includes('--dry'), 'Should list --dry flag');
    assert.ok(result.includes('--force-keys'), 'Should list --force-keys');
    assert.ok(result.includes('USAGE'), 'Should have USAGE section');
    assert.ok(result.includes('EXAMPLES'), 'Should have EXAMPLES section');
  });

  it('champollion lint --help shows lint-specific help', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'lint', '--help'],
      { encoding: 'utf-8' },
    );

    assert.ok(result.includes('lint'), 'Should mention lint');
    assert.ok(result.includes('--warn-only'), 'Should list --warn-only');
    assert.ok(result.includes('--min-length'), 'Should list --min-length');
  });

  it('champollion plugin --help shows subcommands', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'plugin', '--help'],
      { encoding: 'utf-8' },
    );

    assert.ok(result.includes('SUBCOMMANDS'), 'Should have SUBCOMMANDS section');
    assert.ok(result.includes('install'), 'Should list install subcommand');
    assert.ok(result.includes('remove'), 'Should list remove subcommand');
  });

  it('champollion init --help shows init wizard help', () => {
    const result = execFileSync(
      process.execPath,
      [CLI_PATH, 'init', '--help'],
      { encoding: 'utf-8' },
    );

    assert.ok(result.includes('init'), 'Should mention init');
    assert.ok(result.includes('--yes'), 'Should list --yes flag');
    assert.ok(result.includes('wizard'), 'Should mention wizard');
  });

  // Regression: the interactive wizard (not --yes) reaches buildConfig, which
  // read `temperature` without destructuring it from `answers` — a strict-mode
  // ESM ReferenceError that crashed every interactive run before it could write
  // the config. --yes uses a separate buildDefaultConfig path, so the suite
  // never caught it. Drive the real wizard over piped stdin and assert it
  // completes and writes a config.
  it('champollion init (interactive) completes and writes config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-init-'));
    try {
      // Accept the default at every prompt: source, languages (fr), method,
      // model, temperature, format, dirs, per-language, registers, confirm.
      const answers = ['', 'fr', '', '', '', '', '', '', '', '', '', '', '', ''].join('\n') + '\n';
      const result = execFileSync(
        process.execPath,
        [CLI_PATH, 'init'],
        { encoding: 'utf-8', cwd: dir, input: answers },
      );
      assert.ok(
        result.includes('Created') || result.includes('champollion.config.json'),
        'wizard should report writing the config',
      );
      const cfgPath = path.join(dir, 'champollion.config.json');
      assert.ok(fs.existsSync(cfgPath), 'config file should exist after the wizard');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      assert.equal(cfg.version, 3, 'should write a v3 config');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
