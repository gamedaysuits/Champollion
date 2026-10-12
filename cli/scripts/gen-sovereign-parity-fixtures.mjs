#!/usr/bin/env node
// gen-sovereign-parity-fixtures.mjs — regenerate the seal.mjs↔Python parity
// fixtures under arena/tests/fixtures/sovereign/.
//
// These fixtures pin the Python threshold_seal implementation to the Node
// seal.mjs envelope format (arena/tests/test_sovereign_threshold_seal.py
// TestSealMjsParity opens/verifies them). Before the 2026-08-17 red-team they
// were tribal knowledge — generated once by hand, never regenerated. This
// script IS the regeneration procedure. Run it from the repo root:
//
//   node cli/scripts/gen-sovereign-parity-fixtures.mjs
//   # or to a scratch dir for validation (does not touch the committed set):
//   node cli/scripts/gen-sovereign-parity-fixtures.mjs /tmp/parity-out
//
// NOTE: sealing is randomized (ephemeral X25519 key + random salt/IV) and the
// keypairs are fresh, so output is NOT byte-identical run to run — it is a
// fresh, internally-consistent set. The parity tests verify open/verify, not
// exact bytes, so a regenerated set passes exactly as the committed one does.
// Keys here are THROWAWAY and the sentences synthetic; nothing sensitive.

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';

import {
  buildAad,
  sealPlaintext,
  buildSealedArtifact,
  generateThresholdKeypair,
  generateSigningKeypair,
  signPayload,
  SIGN_SCHEME,
} from '../lib/seal.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(here, '..', '..', 'arena', 'tests', 'fixtures', 'sovereign');
mkdirSync(outDir, { recursive: true });

const write = (name, obj) =>
  writeFileSync(join(outDir, name), JSON.stringify(obj, null, 1) + '\n');
const writeRaw = (name, buf) => writeFileSync(join(outDir, name), buf);

const CARD_ID = 'eval-parity-synth-v1';
const GROUP = 'parity-fixture-group';

// 1. Throwaway threshold (X25519) keypair — parity.key.json.
const key = generateThresholdKeypair();
write('parity.key.json', {
  keyId: key.keyId,
  keyScheme: 'single-keypair-wave1',
  publicKeyDerB64: key.publicKeyDerB64,
  privateKeyDerB64: key.privateKeyDerB64,
  _note:
    'THROWAWAY parity-test key for a synthetic fixture — NOT a real custody ' +
    'key. Regenerate with cli/scripts/gen-sovereign-parity-fixtures.mjs.',
});

// 2. Synthetic plaintext corpus — parity.plaintext.json. Seal the EXACT bytes
// we write (minus the trailing newline the test rstrips).
const plaintext = [
  { id: 0, source: 'The synthetic lamp hums.',
    target: 'SYN-tgt-0 lampa zumi.', segment: 'held_out' },
  { id: 1, source: 'Blue parity fixtures sleep.',
    target: 'SYN-tgt-1 pariteto dormas.', segment: 'held_out' },
];
const plaintextStr = JSON.stringify(plaintext, null, 1);
writeRaw('parity.plaintext.json', Buffer.from(plaintextStr + '\n', 'utf8'));

// 3. Seal → parity.sealed.json (ciphertext-only artifact).
const aad = buildAad({ cardId: CARD_ID, custodianGroupId: GROUP });
const sealed = sealPlaintext({
  plaintext: Buffer.from(plaintextStr, 'utf8'),
  thresholdPublicKey: key.publicKeyDerB64,
  aad,
});
write('parity.sealed.json', buildSealedArtifact({
  sealed, cardId: CARD_ID, custodianGroupId: GROUP,
  createdAt: '2026-07-19T00:00:00Z',
}));

// 4. Throwaway signing (Ed25519) keypair — parity.sign.pub.json (public half).
const signKey = generateSigningKeypair();
write('parity.sign.pub.json', {
  keyId: signKey.keyId,
  keyScheme: SIGN_SCHEME,
  publicKeyDerB64: signKey.publicKeyDerB64,
});

// 5. Sign a synthetic scores payload — parity.sign-payload.json + parity.sig.json.
// Sign the EXACT bytes written to the payload file (the Python test reads them
// back verbatim and verifies).
const payloadBuf = Buffer.from(
  JSON.stringify({ scores: { chrf: 41.2 }, synthetic: true }) + '\n', 'utf8');
writeRaw('parity.sign-payload.json', payloadBuf);
const sig = signPayload({
  payload: payloadBuf,
  signingPrivateKey: signKey.privateKeyDerB64,
});
write('parity.sig.json', { ...sig, signedAt: '2026-07-19T00:00:00Z' });

console.log(`Wrote 6 parity fixtures to ${outDir}`);
console.log('  Validate: cd arena && python3 -m pytest '
  + 'tests/test_sovereign_threshold_seal.py::TestSealMjsParity -q');
