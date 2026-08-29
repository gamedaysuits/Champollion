/**
 * seal-corpus command — the keygen/seal/open verbs the organizer node shells
 * out to (arena/mt_eval_harness/contest_node.py). The cipher itself is tested
 * in sealed-corpus.test.js; THIS suite covers the command surface:
 *
 *   • keygen writes an honestly-labeled Wave-1 stand-in keypair (private file
 *     mode 600, both files carrying the single-keypair warning);
 *   • seal → open round-trips byte-identically through the FILES the command
 *     writes (artifact + card block), with no plaintext in either;
 *   • open refuses a wrong key and refuses to write into tracked data dirs;
 *   • every verb fails loud (exit 1 + [ERR]) on a missing required flag.
 *
 * Synthetic sentinel content only; everything under a temp dir; no network.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run, WAVE1_KEY_SCHEME } from '../lib/commands/seal-corpus.js';
import { generateThresholdKeypair } from '../lib/seal.mjs';

const SENTINEL = 'SENTINEL-qaa-mira-sol-volu-0x5eal';

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seal-corpus-cmd-'));
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function argsFor(positionals, flags = {}) {
  return { _: ['seal-corpus', ...positionals], ...flags };
}

describe('seal-corpus keygen', () => {
  it('writes a labeled stand-in keypair with a 600-mode private file', async () => {
    const outDir = path.join(tmp, 'keys');
    const code = await run(argsFor(['keygen'], { out: outDir }), tmp);
    assert.equal(code, 0);

    const files = fs.readdirSync(outDir);
    const pubFile = files.find((f) => f.endsWith('.pub.json'));
    const keyFile = files.find((f) => f.endsWith('.key.json'));
    assert.ok(pubFile && keyFile, 'both key files written');

    const pub = JSON.parse(fs.readFileSync(path.join(outDir, pubFile), 'utf-8'));
    const priv = JSON.parse(fs.readFileSync(path.join(outDir, keyFile), 'utf-8'));
    assert.equal(pub.keyScheme, WAVE1_KEY_SCHEME);
    assert.match(pub._note, /STAND-IN/);
    assert.match(priv._note, /OFF git/);
    assert.ok(pub.publicKeyDerB64 && priv.privateKeyDerB64);
    // The .key.json embeds the public half too, so it doubles as a
    // --threshold-pubkey source (readKeyMaterial prefers publicKeyDerB64
    // for public-key flags).
    assert.equal(priv.publicKeyDerB64, pub.publicKeyDerB64);
    // Private key readable by owner only.
    const mode = fs.statSync(path.join(outDir, keyFile)).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it('the .key.json round-trips as a --threshold-pubkey source (seal + open with one file)', async () => {
    const keys = path.join(tmp, 'keyjson-as-pub');
    assert.equal(await run(argsFor(['keygen'], { out: keys }), tmp), 0);
    const keyPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.key.json')));

    const plainPath = path.join(tmp, 'kp.json');
    const corpus = JSON.stringify({ entries: [{ id: 0, reference: SENTINEL }] });
    fs.writeFileSync(plainPath, corpus);
    const artifactPath = path.join(tmp, 'kp.sealed.json');

    // Seal to the PUBLIC half embedded in the .key.json …
    assert.equal(await run(argsFor(['seal'], {
      'seal-input': plainPath, id: 'card-kp', 'custodian-group': 'org-kp',
      'threshold-pubkey': keyPath, 'seal-out': artifactPath,
    }), tmp), 0);
    assert.ok(!fs.readFileSync(artifactPath, 'utf-8').includes(SENTINEL));

    // … and open with the PRIVATE half of the very same file.
    const outPath = path.join(tmp, 'scratch', 'kp.opened.json');
    assert.equal(await run(argsFor(['open'], {
      artifact: artifactPath, privkey: keyPath, out: outPath,
    }), tmp), 0);
    assert.equal(fs.readFileSync(outPath, 'utf-8'), corpus);
  });
});

describe('seal-corpus seal → open round trip', () => {
  it('round-trips byte-identically via the written files, plaintext-free artifacts', async () => {
    const keys = path.join(tmp, 'rt-keys');
    assert.equal(await run(argsFor(['keygen'], { out: keys }), tmp), 0);
    const pubPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.pub.json')));
    const privPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.key.json')));

    const plainPath = path.join(tmp, 'refs.json');
    const corpus = JSON.stringify({ entries: [{ id: 0, reference: SENTINEL }] });
    fs.writeFileSync(plainPath, corpus);

    const artifactPath = path.join(tmp, 'refs.sealed.json');
    const blockPath = path.join(tmp, 'sealed-block.json');
    const code = await run(argsFor(['seal'], {
      'seal-input': plainPath,
      id: 'eval-qaa-qab-synth-blindtest-v1',
      'custodian-group': 'org-test-a1b2',
      'threshold-pubkey': pubPath,
      'seal-out': artifactPath,
      'card-block-out': blockPath,
      'qualifier-id': 'eval-qaa-qab-synth-dev-v1',
      'qualifier-threshold': '42.5',
    }), tmp);
    assert.equal(code, 0);

    // Neither written file contains the plaintext sentinel.
    const artifactRaw = fs.readFileSync(artifactPath, 'utf-8');
    const blockRaw = fs.readFileSync(blockPath, 'utf-8');
    assert.ok(!artifactRaw.includes(SENTINEL), 'artifact is ciphertext-only');
    assert.ok(!blockRaw.includes(SENTINEL), 'card block is content-free');

    const block = JSON.parse(blockRaw);
    assert.equal(block.keyScheme, WAVE1_KEY_SCHEME);
    assert.equal(block.qualifierId, 'eval-qaa-qab-synth-dev-v1');
    assert.equal(block.qualifierThreshold, 42.5);
    assert.equal(block.ciphertextDigest, JSON.parse(artifactRaw).ciphertextDigest);

    // open → byte-identical plaintext.
    const outPath = path.join(tmp, 'scratch', 'refs.opened.json');
    assert.equal(await run(argsFor(['open'], {
      artifact: artifactPath, privkey: privPath, out: outPath,
    }), tmp), 0);
    assert.equal(fs.readFileSync(outPath, 'utf-8'), corpus);
  });

  it('open refuses a wrong private key', async () => {
    const keys = path.join(tmp, 'wrong-keys');
    assert.equal(await run(argsFor(['keygen'], { out: keys }), tmp), 0);
    const pubPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.pub.json')));

    const plainPath = path.join(tmp, 'wk.json');
    fs.writeFileSync(plainPath, SENTINEL);
    const artifactPath = path.join(tmp, 'wk.sealed.json');
    assert.equal(await run(argsFor(['seal'], {
      'seal-input': plainPath, id: 'card-x', 'custodian-group': 'org-x',
      'threshold-pubkey': pubPath, 'seal-out': artifactPath,
    }), tmp), 0);

    const stranger = generateThresholdKeypair();
    const strangerKey = path.join(tmp, 'stranger.key.json');
    fs.writeFileSync(strangerKey, JSON.stringify({ privateKeyDerB64: stranger.privateKeyDerB64 }));
    const code = await run(argsFor(['open'], {
      artifact: artifactPath, privkey: strangerKey,
      out: path.join(tmp, 'never.json'),
    }), tmp);
    assert.equal(code, 1);
    assert.ok(!fs.existsSync(path.join(tmp, 'never.json')));
  });

  it('open refuses to write plaintext into a tracked data directory', async () => {
    const keys = path.join(tmp, 'tp-keys');
    assert.equal(await run(argsFor(['keygen'], { out: keys }), tmp), 0);
    const pubPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.pub.json')));
    const privPath = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.key.json')));

    const plainPath = path.join(tmp, 'tp.json');
    fs.writeFileSync(plainPath, SENTINEL);
    const artifactPath = path.join(tmp, 'tp.sealed.json');
    assert.equal(await run(argsFor(['seal'], {
      'seal-input': plainPath, id: 'card-t', 'custodian-group': 'org-t',
      'threshold-pubkey': pubPath, 'seal-out': artifactPath,
    }), tmp), 0);

    const trackedOut = path.join(tmp, 'shared', 'corpora-cards', 'leak.json');
    const code = await run(argsFor(['open'], {
      artifact: artifactPath, privkey: privPath, out: trackedOut,
    }), tmp);
    assert.equal(code, 1);
    assert.ok(!fs.existsSync(trackedOut), 'no plaintext written into a tracked dir');
  });
});

describe('seal-corpus sign-keygen → sign → verify (Phase-B score bundles)', () => {
  it('signs and verifies a payload; refuses tampered bytes and a stranger key', async () => {
    const keys = path.join(tmp, 'sign-keys');
    assert.equal(await run(argsFor(['sign-keygen'], { out: keys }), tmp), 0);
    const files = fs.readdirSync(keys);
    const pubPath = path.join(keys, files.find((f) => f.startsWith('score-sign-') && f.endsWith('.pub.json')));
    const keyPath = path.join(keys, files.find((f) => f.startsWith('score-sign-') && f.endsWith('.key.json')));
    const pub = JSON.parse(fs.readFileSync(pubPath, 'utf-8'));
    assert.equal(pub.keyScheme, 'ed25519-single-node-wave1');
    assert.match(pub._note, /NOT the 3-of-5/);
    assert.equal(fs.statSync(keyPath).mode & 0o777, 0o600);

    const payloadPath = path.join(tmp, 'score-bundle.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ request_id: 'authreq-x', qualifier_score: 61.2 }));
    const sigPath = path.join(tmp, 'score-bundle.json.sig.json');
    assert.equal(await run(argsFor(['sign'], {
      payload: payloadPath, privkey: keyPath, 'sig-out': sigPath,
    }), tmp), 0);
    const sig = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
    assert.equal(sig.scheme, 'ed25519-single-node-wave1');
    assert.ok(sig.signatureB64 && sig.payloadSha256 && sig.keyId);

    // Verifies clean…
    assert.equal(await run(argsFor(['verify'], {
      payload: payloadPath, sig: sigPath, pubkey: pubPath,
    }), tmp), 0);

    // …refuses a doctored score…
    fs.writeFileSync(payloadPath, JSON.stringify({ request_id: 'authreq-x', qualifier_score: 99.9 }));
    assert.equal(await run(argsFor(['verify'], {
      payload: payloadPath, sig: sigPath, pubkey: pubPath,
    }), tmp), 1);

    // …and refuses a stranger's key even on the original bytes.
    fs.writeFileSync(payloadPath, JSON.stringify({ request_id: 'authreq-x', qualifier_score: 61.2 }));
    const strangerDir = path.join(tmp, 'stranger-sign');
    assert.equal(await run(argsFor(['sign-keygen'], { out: strangerDir }), tmp), 0);
    const strangerPub = path.join(strangerDir, fs.readdirSync(strangerDir).find((f) => f.endsWith('.pub.json')));
    assert.equal(await run(argsFor(['verify'], {
      payload: payloadPath, sig: sigPath, pubkey: strangerPub,
    }), tmp), 1);
  });

  it('sign refuses an X25519 (sealing) key — wrong key type fails loud', async () => {
    const keys = path.join(tmp, 'mixed-keys');
    assert.equal(await run(argsFor(['keygen'], { out: keys }), tmp), 0);
    const sealKey = path.join(keys, fs.readdirSync(keys).find((f) => f.endsWith('.key.json')));
    const payloadPath = path.join(tmp, 'p.json');
    fs.writeFileSync(payloadPath, '{"x":1}');
    assert.equal(await run(argsFor(['sign'], {
      payload: payloadPath, privkey: sealKey, 'sig-out': path.join(tmp, 'p.sig.json'),
    }), tmp), 1);
  });
});

describe('seal-corpus loud failures', () => {
  it('unknown/missing verb exits 1', async () => {
    assert.equal(await run(argsFor([]), tmp), 1);
    assert.equal(await run(argsFor(['frobnicate']), tmp), 1);
  });

  it('seal without required flags exits 1', async () => {
    assert.equal(await run(argsFor(['seal'], {}), tmp), 1);
    assert.equal(await run(argsFor(['seal'], { 'seal-input': 'x' }), tmp), 1);
  });

  it('open without required flags exits 1', async () => {
    assert.equal(await run(argsFor(['open'], {}), tmp), 1);
  });

  it('sign/verify without required flags exit 1', async () => {
    assert.equal(await run(argsFor(['sign'], {}), tmp), 1);
    assert.equal(await run(argsFor(['verify'], {}), tmp), 1);
    assert.equal(await run(argsFor(['verify'], { payload: 'x' }), tmp), 1);
  });
});
