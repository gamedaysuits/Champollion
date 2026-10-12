/**
 * The api method sends only a token meant for its endpoint.
 *
 * It used to fall back to the generic provider key, so OPENROUTER_API_KEY
 * went out as the Bearer token to whatever endpoint a pair named.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveApiMethodKey } from '../lib/methods/api.js';

describe('api method key', () => {
  const saved = {};
  let cwd;
  beforeEach(() => {
    for (const k of ['CHAMPOLLION_API_KEY', 'CRK_API_KEY', 'OPENROUTER_API_KEY']) { saved[k] = process.env[k]; delete process.env[k]; }
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'apikey-'));
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  it('never uses the generic provider key', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-secret';
    assert.equal(resolveApiMethodKey({}, 'https://mt.example.org/translate', cwd), null);
  });

  it('reads the pair\'s own "${VAR}", then CHAMPOLLION_API_KEY', () => {
    process.env.CRK_API_KEY = 'crk-token';
    process.env.CHAMPOLLION_API_KEY = 'shared-token';
    assert.equal(resolveApiMethodKey({ apiKey: '${CRK_API_KEY}' }, 'https://x/translate', cwd), 'crk-token');
    assert.equal(resolveApiMethodKey({}, 'https://x/translate', cwd), 'shared-token');
  });

  it('a loopback endpoint needs no token', () => {
    assert.equal(resolveApiMethodKey({}, 'http://127.0.0.1:8378/translate', cwd), 'local-no-token');
  });
});
