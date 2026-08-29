/**
 * Command: seal-corpus — the crypto verbs around lib/seal.mjs.
 *
 * The crypto itself is single-sourced in lib/seal.mjs (X25519-ECDH → HKDF-SHA256
 * → AES-256-GCM, node:crypto only); this command exposes it to scripts and to
 * the Python organizer node (arena/mt_eval_harness/contest_node.py shells out
 * here — the harness never re-implements the cipher). Three verbs:
 *
 *   keygen — generate a WAVE-1 STAND-IN threshold keypair. Honesty first: this
 *            is a SINGLE keypair, not the 3-of-5 FROST group key of the Wave-2
 *            key ceremony. Whoever holds the private-key file can decrypt —
 *            fine for an organizer-run contest node (the organizer holds their
 *            own refs anyway), NOT the zero-knowledge custody the sovereignty
 *            docs promise. The files say so on their face.
 *   seal   — encrypt a corpus file on THIS machine to a threshold public key;
 *            write the ciphertext artifact + the content-free card block.
 *            (`champollion register-corpus --tier sealed` wraps this same path
 *            with card registration; this verb is the standalone piece.)
 *   open   — decrypt a sealed artifact with the threshold private key. This is
 *            the controlled-eval-context verb: the organizer node calls it at
 *            scoring time, writes plaintext ONLY to its scratch dir, and wipes
 *            it after scoring. Refuses to write into a tracked repo directory.
 *
 * Exit codes: 0 = done; 1 = invalid request / crypto failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  generateThresholdKeypair,
  sealPlaintext,
  buildSealedArtifact,
  buildSealedCardBlock,
  buildAad,
  openSealed,
  SEAL_CIPHER,
  SIGN_SCHEME,
  generateSigningKeypair,
  signPayload,
  verifyPayload,
} from '../seal.mjs';

/** Wave-1 custody label stamped wherever this stand-in scheme is used. */
export const WAVE1_KEY_SCHEME = 'single-keypair-wave1';

function fail(msg) {
  console.error(`[ERR] seal-corpus: ${msg}`);
  return 1;
}

/**
 * Read a value that may be an inline base64/PEM string or a file path.
 *
 * A keygen output file carries JSON with one or both key halves (the
 * .key.json embeds publicKeyDerB64 alongside privateKeyDerB64 so it can
 * serve as a --threshold-pubkey source too) — `kind` picks the half the
 * flag actually needs, so a .key.json passed to --privkey never yields
 * the public half by accident.
 *
 * @param {string} value - Inline key material or a file path
 * @param {string} label - Flag name for error messages
 * @param {'public'|'private'} kind - Which half a keygen JSON should yield
 */
function readKeyMaterial(value, label, kind = 'public') {
  if (!value) throw new Error(`${label} is required.`);
  const p = path.resolve(String(value));
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf-8').trim();
    // A keygen output file carries JSON; accept it directly.
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (kind === 'private') {
        return parsed.privateKeyDerB64 || parsed.publicKeyDerB64 || raw;
      }
      return parsed.publicKeyDerB64 || parsed.privateKeyDerB64 || raw;
    }
    return raw;
  }
  return String(value).trim();
}

/** Never write plaintext or private keys into the tracked repo tree. */
function refuseTrackedPath(target, what) {
  const norm = path.resolve(target).split(path.sep).join('/');
  if (/\/(shared\/corpora-cards|cli\/shared|arena\/datasets)(\/|$)/.test(norm)) {
    throw new Error(
      `${what} must not be written into a tracked data directory (${target}) — ` +
      `choose a scratch/organizer-local path.`);
  }
}

// ---------------------------------------------------------------------------
// keygen
// ---------------------------------------------------------------------------

function runKeygen(args, cwd) {
  const outDir = path.resolve(cwd, args.out || '.');
  fs.mkdirSync(outDir, { recursive: true });
  const pair = generateThresholdKeypair();

  const pubPath = path.join(outDir, `threshold-${pair.keyId}.pub.json`);
  const privPath = path.join(outDir, `threshold-${pair.keyId}.key.json`);
  const note =
    'WAVE-1 STAND-IN: a SINGLE X25519 keypair, not a threshold (M-of-N) group key. ' +
    'Whoever holds the private key can decrypt alone. Suitable for an organizer-run ' +
    'contest node holding its own refs; NOT zero-knowledge custody (that is the ' +
    'Wave-2 FROST key ceremony, champollion.dev/docs/network/sovereignty/sovereign-eval-node).';

  fs.writeFileSync(pubPath, JSON.stringify({
    keyId: pair.keyId,
    keyScheme: WAVE1_KEY_SCHEME,
    publicKeyDerB64: pair.publicKeyDerB64,
    _note: note,
  }, null, 2) + '\n');
  // The .key.json carries BOTH halves: the embedded public key lets the file
  // double as a --threshold-pubkey source (readKeyMaterial picks the half a
  // flag needs), so a keygen dir with only the .key.json can still seal.
  fs.writeFileSync(privPath, JSON.stringify({
    keyId: pair.keyId,
    keyScheme: WAVE1_KEY_SCHEME,
    publicKeyDerB64: pair.publicKeyDerB64,
    privateKeyDerB64: pair.privateKeyDerB64,
    _note: note + ' Contains both halves (the public key is embedded so this file '
      + 'also works as a --threshold-pubkey source). Keep this file OFF git and '
      + 'off any shared storage.',
  }, null, 2) + '\n', { mode: 0o600 });

  console.log(`  Key id:      ${pair.keyId}`);
  console.log(`  Scheme:      ${WAVE1_KEY_SCHEME} (stand-in — see note in the files)`);
  console.log(`  Public key:  ${pubPath}`);
  console.log(`  Private key: ${privPath}  (mode 600 — never commit, never upload)`);
  return 0;
}

// ---------------------------------------------------------------------------
// seal
// ---------------------------------------------------------------------------

function runSeal(args, cwd) {
  const input = args['seal-input'];
  const cardId = args.id;
  const custodianGroupId = args['custodian-group'];
  if (!input) return fail('--seal-input <corpus file> is required.');
  if (!cardId) return fail('--id <card id> is required (the AAD binds ciphertext to card).');
  if (!custodianGroupId) return fail('--custodian-group <opaque id> is required (never a real org name pre-consent).');
  if (!args['threshold-pubkey']) return fail('--threshold-pubkey <file|b64|PEM> is required.');

  let plaintext;
  try {
    plaintext = fs.readFileSync(path.resolve(cwd, input));
  } catch (e) {
    return fail(`cannot read --seal-input ${input}: ${e.message}`);
  }
  if (!plaintext.length) return fail(`--seal-input ${input} is empty — nothing to seal.`);

  const aad = buildAad({ cardId, custodianGroupId });
  let sealed;
  try {
    sealed = sealPlaintext({
      plaintext,
      thresholdPublicKey: readKeyMaterial(args['threshold-pubkey'], '--threshold-pubkey'),
      aad,
    });
  } catch (e) {
    return fail(e.message);
  }
  plaintext = null;

  const artifactPath = path.resolve(cwd, args['seal-out'] || `${cardId}.sealed.json`);
  try {
    refuseTrackedPath(artifactPath, 'the sealed (ciphertext) artifact');
    fs.writeFileSync(artifactPath, JSON.stringify(buildSealedArtifact({
      sealed, cardId, custodianGroupId, createdAt: new Date().toISOString(),
    }), null, 2) + '\n');
  } catch (e) {
    return fail(e.message);
  }

  const cardBlock = buildSealedCardBlock({
    sealed,
    custodianGroupId,
    keyScheme: args['key-scheme'] || WAVE1_KEY_SCHEME,
    qualifierId: args['qualifier-id'] || null,
    qualifierThreshold: args['qualifier-threshold']
      ? Number(args['qualifier-threshold']) : null,
    artifactRef: artifactPath,
  });
  const blockPath = args['card-block-out']
    ? path.resolve(cwd, args['card-block-out']) : null;
  if (blockPath) {
    fs.writeFileSync(blockPath, JSON.stringify(cardBlock, null, 2) + '\n');
  }

  console.log(`  Cipher:            ${SEAL_CIPHER}`);
  console.log(`  Ciphertext digest: ${sealed.ciphertextDigest}`);
  console.log(`  Artifact:          ${artifactPath} (ciphertext only — keep OFF git)`);
  if (blockPath) console.log(`  Card block:        ${blockPath}`);
  else console.log(`  Card block:        ${JSON.stringify(cardBlock)}`);
  // Registration is the harness's lane (this CLI only ever reads Supabase):
  // organizers register the digest content-free themselves — no curator
  // issue, no service key (migration 046 self-serve door).
  console.log('  Register (self-serve, your own sign-in): ' +
    'mt-eval contest register --manifest <local/manifest.json> — or ' +
    '`mt-eval contest prepare --self-serve` end-to-end.');
  return 0;
}

// ---------------------------------------------------------------------------
// open — the controlled-eval-context decrypt.
// ---------------------------------------------------------------------------

function runOpen(args, cwd) {
  if (!args.artifact) return fail('--artifact <sealed artifact json> is required.');
  if (!args.privkey) return fail('--privkey <file|b64|PEM> is required.');
  if (!args.out) return fail('--out <plaintext destination> is required (write to your scratch dir; wipe after use).');

  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(path.resolve(cwd, args.artifact), 'utf-8'));
  } catch (e) {
    return fail(`cannot read --artifact ${args.artifact}: ${e.message}`);
  }

  let plaintext;
  try {
    plaintext = openSealed({
      artifact,
      thresholdPrivateKey: readKeyMaterial(args.privkey, '--privkey', 'private'),
    });
  } catch (e) {
    return fail(`decryption failed (wrong key, tampered ciphertext, or AAD mismatch): ${e.message}`);
  }

  const outPath = path.resolve(cwd, args.out);
  try {
    refuseTrackedPath(outPath, 'decrypted plaintext');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, plaintext, { mode: 0o600 });
  } catch (e) {
    return fail(e.message);
  }
  console.log(`  Decrypted ${plaintext.length} bytes -> ${outPath}`);
  console.log('  Scratch plaintext: score, then WIPE (the organizer node does this automatically).');
  return 0;
}

// ---------------------------------------------------------------------------
// sign-keygen / sign / verify — score-bundle signing for the Phase-B airgap
// transport (arena/mt_eval_harness/airgap_transport.py shells out here; the
// crypto lives in lib/seal.mjs). Single-node Ed25519 — NOT steward custody.
// ---------------------------------------------------------------------------

function runSignKeygen(args, cwd) {
  const outDir = path.resolve(cwd, args.out || '.');
  fs.mkdirSync(outDir, { recursive: true });
  const pair = generateSigningKeypair();
  const note =
    `${SIGN_SCHEME}: a SINGLE Ed25519 node signing key. It authenticates one ` +
    'scoring node’s exported score bundles (airgap transport); it is NOT the ' +
    '3-of-5 steward custody of the sandbox spec §12 (Wave 2).';

  const pubPath = path.join(outDir, `score-sign-${pair.keyId}.pub.json`);
  const privPath = path.join(outDir, `score-sign-${pair.keyId}.key.json`);
  fs.writeFileSync(pubPath, JSON.stringify({
    keyId: pair.keyId, keyScheme: SIGN_SCHEME,
    publicKeyDerB64: pair.publicKeyDerB64, _note: note,
  }, null, 2) + '\n');
  fs.writeFileSync(privPath, JSON.stringify({
    keyId: pair.keyId, keyScheme: SIGN_SCHEME,
    privateKeyDerB64: pair.privateKeyDerB64,
    _note: note + ' Keep this file on the AIRGAPPED node only.',
  }, null, 2) + '\n', { mode: 0o600 });

  console.log(`  Key id:      ${pair.keyId}`);
  console.log(`  Scheme:      ${SIGN_SCHEME}`);
  console.log(`  Public key:  ${pubPath}  (give this to the RELAY side)`);
  console.log(`  Private key: ${privPath}  (mode 600 — airgapped node only)`);
  return 0;
}

function runSign(args, cwd) {
  if (!args.payload) return fail('--payload <file> is required.');
  if (!args.privkey) return fail('--privkey <file|b64> is required.');
  let payload;
  try {
    payload = fs.readFileSync(path.resolve(cwd, args.payload));
  } catch (e) {
    return fail(`cannot read --payload ${args.payload}: ${e.message}`);
  }
  let block;
  try {
    block = signPayload({
      payload,
      signingPrivateKey: readKeyMaterial(args.privkey, '--privkey', 'private'),
    });
  } catch (e) {
    return fail(e.message);
  }
  block.signedAt = new Date().toISOString();
  const sigPath = path.resolve(cwd, args['sig-out'] || `${args.payload}.sig.json`);
  fs.writeFileSync(sigPath, JSON.stringify(block, null, 2) + '\n');
  console.log(`  Scheme:    ${block.scheme}`);
  console.log(`  Key id:    ${block.keyId}`);
  console.log(`  Payload:   sha256 ${block.payloadSha256}`);
  console.log(`  Signature: ${sigPath}`);
  return 0;
}

function runVerify(args, cwd) {
  if (!args.payload) return fail('--payload <file> is required.');
  if (!args.sig) return fail('--sig <signature block json> is required.');
  if (!args.pubkey) return fail('--pubkey <file|b64> is required.');
  let payload; let block;
  try {
    payload = fs.readFileSync(path.resolve(cwd, args.payload));
    block = JSON.parse(fs.readFileSync(path.resolve(cwd, args.sig), 'utf-8'));
  } catch (e) {
    return fail(`cannot read inputs: ${e.message}`);
  }
  let ok;
  try {
    ok = verifyPayload({
      payload,
      signatureB64: block.signatureB64,
      verifyPublicKey: readKeyMaterial(args.pubkey, '--pubkey'),
    });
  } catch (e) {
    return fail(e.message);
  }
  if (!ok) return fail('SIGNATURE INVALID — the payload is not what the node signed. Refuse it.');
  console.log(`  Signature VALID (key ${block.keyId}, ${block.scheme || SIGN_SCHEME}).`);
  return 0;
}

// ---------------------------------------------------------------------------

export async function run(args, cwd) {
  const verb = args._[1];
  if (verb === 'keygen') return runKeygen(args, cwd);
  if (verb === 'seal') return runSeal(args, cwd);
  if (verb === 'open') return runOpen(args, cwd);
  if (verb === 'sign-keygen') return runSignKeygen(args, cwd);
  if (verb === 'sign') return runSign(args, cwd);
  if (verb === 'verify') return runVerify(args, cwd);
  console.error('[ERR] Usage: champollion seal-corpus <keygen|seal|open|sign-keygen|sign|verify> [flags]');
  console.error('      keygen --out <dir>');
  console.error('      seal   --seal-input <file> --id <card-id> --custodian-group <id>');
  console.error('             --threshold-pubkey <file|b64> [--seal-out <file>] [--card-block-out <file>]');
  console.error('             [--qualifier-id <id> --qualifier-threshold <n>] [--key-scheme <label>]');
  console.error('      open   --artifact <file> --privkey <file|b64> --out <scratch path>');
  console.error('      sign-keygen --out <dir>');
  console.error('      sign   --payload <file> --privkey <file|b64> [--sig-out <file>]');
  console.error('      verify --payload <file> --sig <file> --pubkey <file|b64>');
  return 1;
}
