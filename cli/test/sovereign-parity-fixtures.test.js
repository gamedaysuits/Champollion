// sovereign-parity-fixtures.test.js — the generator that regenerates the
// seal.mjs↔Python parity fixtures produces a complete, internally-consistent
// set that Node itself can open/verify. The cross-language half lives in
// arena/tests/test_sovereign_threshold_seal.py (both directions).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openSealed, verifyPayload } from '../lib/seal.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const genScript = resolve(here, '..', 'scripts', 'gen-sovereign-parity-fixtures.mjs');

describe('sovereign parity fixture generator', () => {
  let out;
  before(() => {
    out = mkdtempSync(join(tmpdir(), 'parity-'));
    execFileSync('node', [genScript, out], { stdio: 'pipe' });
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  it('writes all six fixtures', () => {
    for (const f of ['parity.key.json', 'parity.plaintext.json',
      'parity.sealed.json', 'parity.sign.pub.json',
      'parity.sign-payload.json', 'parity.sig.json']) {
      assert.ok(existsSync(join(out, f)), `missing ${f}`);
    }
  });

  it('Node opens its own sealed fixture back to the plaintext', () => {
    const key = JSON.parse(readFileSync(join(out, 'parity.key.json'), 'utf8'));
    const artifact = JSON.parse(
      readFileSync(join(out, 'parity.sealed.json'), 'utf8'));
    const want = readFileSync(join(out, 'parity.plaintext.json'), 'utf8')
      .replace(/\n$/, '');
    const got = openSealed({ artifact, thresholdPrivateKey: key.privateKeyDerB64 });
    assert.equal(got.toString('utf8'), want);
  });

  it('Node verifies its own signature fixture', () => {
    const payload = readFileSync(join(out, 'parity.sign-payload.json'));
    const sig = JSON.parse(readFileSync(join(out, 'parity.sig.json'), 'utf8'));
    const pub = JSON.parse(
      readFileSync(join(out, 'parity.sign.pub.json'), 'utf8'));
    assert.ok(verifyPayload({
      payload, signatureB64: sig.signatureB64,
      verifyPublicKey: pub.publicKeyDerB64,
    }));
  });
});
