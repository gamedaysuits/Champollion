/**
 * API key loader tests — direct coverage of parseEnvLine, getEnvOrFileVar,
 * and loadApiKey.
 *
 * WHY THESE EXIST:
 *   API key resolution has a clear priority chain:
 *     process.env → .env.local → .env
 *   The redteam.test.js tests cover env line parsing via sync.js's
 *   re-exports, but the extracted api-key.js module's getEnvOrFileVar
 *   and file-reading paths were never tested directly. These tests
 *   verify the priority chain, file reading, and edge cases.
 *
 * STRATEGY:
 *   Use a temp directory with synthetic .env / .env.local files.
 *   Manipulate process.env carefully (save + restore) to test priority.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseEnvLine, getEnvOrFileVar, loadApiKey } from '../lib/api-key.js';

// =================================================================
// 1. parseEnvLine — unit tests for line-level parsing
// =================================================================
describe('api-key: parseEnvLine', () => {
  it('parses KEY=value', () => {
    const result = parseEnvLine('MY_KEY=abc123');
    assert.deepEqual(result, { key: 'MY_KEY', value: 'abc123' });
  });

  it('parses double-quoted value', () => {
    const result = parseEnvLine('MY_KEY="abc 123"');
    assert.deepEqual(result, { key: 'MY_KEY', value: 'abc 123' });
  });

  it('parses single-quoted value', () => {
    const result = parseEnvLine("MY_KEY='abc 123'");
    assert.deepEqual(result, { key: 'MY_KEY', value: 'abc 123' });
  });

  it('parses export prefix', () => {
    const result = parseEnvLine('export MY_KEY=abc123');
    assert.deepEqual(result, { key: 'MY_KEY', value: 'abc123' });
  });

  it('parses export prefix with quotes', () => {
    const result = parseEnvLine('export MY_KEY="abc123"');
    assert.deepEqual(result, { key: 'MY_KEY', value: 'abc123' });
  });

  it('returns null for empty line', () => {
    assert.equal(parseEnvLine(''), null);
    assert.equal(parseEnvLine('   '), null);
  });

  it('returns null for comment line', () => {
    assert.equal(parseEnvLine('# This is a comment'), null);
    assert.equal(parseEnvLine('  # Indented comment'), null);
  });

  it('returns null for line without equals sign', () => {
    assert.equal(parseEnvLine('no_equals_here'), null);
  });

  it('returns null for line with equals at start (empty key)', () => {
    assert.equal(parseEnvLine('=value_only'), null);
  });

  it('handles value with equals sign in it', () => {
    const result = parseEnvLine('MY_KEY=abc=def=ghi');
    assert.equal(result.key, 'MY_KEY');
    assert.equal(result.value, 'abc=def=ghi');
  });

  it('handles value with spaces around equals', () => {
    const result = parseEnvLine('  MY_KEY = value  ');
    assert.equal(result.key, 'MY_KEY');
    assert.equal(result.value, 'value');
  });

  it('handles empty value', () => {
    const result = parseEnvLine('MY_KEY=');
    assert.deepEqual(result, { key: 'MY_KEY', value: '' });
  });
});

// =================================================================
// 2. getEnvOrFileVar — priority chain tests
// =================================================================
describe('api-key: getEnvOrFileVar — priority chain', () => {
  let tmpDir;
  let savedEnvValue;
  const TEST_KEY = '__CHAMPOLLION_TEST_KEY_DO_NOT_USE__';

  beforeEach(() => {
    // Create a fresh temp directory for each test
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-apikey-test-'));
    // Save any existing env value
    savedEnvValue = process.env[TEST_KEY];
    delete process.env[TEST_KEY];
  });

  afterEach(() => {
    // Restore env
    if (savedEnvValue !== undefined) {
      process.env[TEST_KEY] = savedEnvValue;
    } else {
      delete process.env[TEST_KEY];
    }
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when key is not found anywhere', () => {
    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, null);
  });

  it('reads from process.env first (highest priority)', () => {
    process.env[TEST_KEY] = 'from-env';
    fs.writeFileSync(path.join(tmpDir, '.env.local'), `${TEST_KEY}=from-local\n`);
    fs.writeFileSync(path.join(tmpDir, '.env'), `${TEST_KEY}=from-dotenv\n`);

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'from-env');
  });

  it('reads from .env.local when process.env is empty (second priority)', () => {
    fs.writeFileSync(path.join(tmpDir, '.env.local'), `${TEST_KEY}=from-local\n`);
    fs.writeFileSync(path.join(tmpDir, '.env'), `${TEST_KEY}=from-dotenv\n`);

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'from-local');
  });

  it('reads from .env when neither process.env nor .env.local has it', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), `${TEST_KEY}=from-dotenv\n`);

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'from-dotenv');
  });

  it('handles .env file with multiple keys', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      `OTHER_KEY=other\n${TEST_KEY}=target\nANOTHER=another\n`
    );

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'target');
  });

  it('handles .env file with comments and empty lines', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      `# API keys\n\n${TEST_KEY}=target\n# End\n`
    );

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'target');
  });

  it('handles quoted values in .env file', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      `${TEST_KEY}="my-quoted-key"\n`
    );

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'my-quoted-key');
  });

  it('handles export prefix in .env file', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      `export ${TEST_KEY}=exported-key\n`
    );

    const result = getEnvOrFileVar(TEST_KEY, tmpDir);
    assert.equal(result, 'exported-key');
  });
});

// =================================================================
// 3. loadApiKey — integration with config
// =================================================================
describe('api-key: loadApiKey', () => {
  let tmpDir;
  const TEST_KEY = '__CHAMPOLLION_LOAD_API_KEY_TEST__';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-load-apikey-'));
    delete process.env[TEST_KEY];
  });

  afterEach(() => {
    delete process.env[TEST_KEY];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves key using config.apiKeyEnvVar', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), `${TEST_KEY}=my-api-key\n`);

    const result = loadApiKey({ apiKeyEnvVar: TEST_KEY }, tmpDir);
    assert.equal(result, 'my-api-key');
  });

  it('returns null when apiKeyEnvVar is not set anywhere', () => {
    const result = loadApiKey({ apiKeyEnvVar: TEST_KEY }, tmpDir);
    assert.equal(result, null);
  });
});
