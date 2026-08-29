/**
 * seal.mjs — CLIENT-SIDE encryption for the SEALED exposure tier.
 *
 * This is the cryptographic front door for the zero-knowledge sovereign-eval
 * PoC (community-custodian multisig plan, docs/governance, mechanism M1). A community that
 * chooses to make a held-out set centrally evaluable-on-demand encrypts it
 * **on their own machine, before a single byte leaves**, under a *threshold
 * public key* the platform cannot decrypt alone. Champollion ever only receives
 *
 *   • ciphertext (an off-git, off-allowlist artifact), and
 *   • a CONTENT-FREE metadata card (cipher id + custodian group + digest + AAD).
 *
 * The plaintext sentences are never read, uploaded, or hosted — exactly the L1
 * never-host-content doctrine (the data-boundaries doctrine), strengthened: not just
 * "no plaintext in the repo" but "no plaintext anywhere we hold, ever."
 *
 * ── SCHEME ────────────────────────────────────────────────────────────────
 * A standard hybrid "sealed box" (libsodium crypto_box_seal shape), built only
 * on Node's `node:crypto` (no third-party dep):
 *
 *   1. The recipient is the custodian group's THRESHOLD public key (X25519).
 *   2. The sender (this CLI, on the author's device) generates an EPHEMERAL
 *      X25519 keypair, does ECDH against the threshold public key, and derives
 *      a one-time AES-256 key with HKDF-SHA256 (salt + an info string that
 *      binds the ephemeral key, the threshold key, and the card AAD).
 *   3. The corpus bytes are encrypted with AES-256-GCM (the AAD authenticates
 *      the card binding). The ephemeral private key is discarded.
 *
 * Decryption requires the threshold PRIVATE key — which only exists as 3-of-5
 * custodian shares. Champollion holds zero shares (M4), so it can never
 * assemble the key and never decrypt. See the WAVE-2 SEAM notes below.
 *
 * ── WAVE-1 vs the shipped threshold layer (the integration seam) ──────────
 * WAVE 1 (this module): accept/derive a PROVIDED threshold public key (a raw
 * X25519 recipient) and encrypt to it. The matching private key is a single
 * X25519 scalar (used by tests and the controlled-eval context to PROVE the
 * ciphertext is real).
 *
 * SHIPPED (Python, arena/mt_eval_harness/sovereign/): the "threshold" is
 * SHAMIR M-of-N secret sharing of that same X25519 scalar (shamir_gf256.py),
 * reconstructed in the offline node's executor memory during a quorum-
 * authorized run — NOT an aggregated FROST group key and NOT MPC/TSS (see
 * sovereign/__init__.py HONESTY CONTRACT). This module is unchanged by that:
 * every `WAVE-2 SEAM` marker below is a point that WOULD change only if we
 * moved to real threshold *decryption* (partial ECDH per custodian, key never
 * assembled) — a networked-platform upgrade that is not built. The ciphertext
 * format and the card block do NOT change under either model; that is the
 * whole point of the seam. Historical note: earlier docs named FROST here —
 * FROST is threshold *signing*, the wrong primitive for this decryption path;
 * see the community-custodian multisig plan (docs/governance) for the corrected framing.
 *
 * @module seal
 */

import crypto from 'node:crypto';

/** Cipher suite id stamped into every artifact + card. */
export const SEAL_CIPHER = 'x25519-hkdf-sha256+aes-256-gcm';

/** Sealed-artifact format version (bumped only on a breaking envelope change). */
export const SEAL_VERSION = '1';

/** HKDF info-string prefix — domain-separates this use of the shared secret. */
const HKDF_INFO_PREFIX = 'champollion-sealed-corpus';

/** AES-256-GCM parameters. */
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const HKDF_SALT_BYTES = 16;

// ---------------------------------------------------------------------------
// AAD — the card binding. Additional Authenticated Data is NOT encrypted, but
// it IS authenticated: a ciphertext sealed for card A / group A cannot be
// silently re-presented as card B / group B without breaking the GCM tag. It
// is metadata only (ids), never corpus content — safe to store on the card.
// ---------------------------------------------------------------------------

/**
 * Deterministic AAD string binding a ciphertext to its card + custodian group.
 * @param {{cardId:string, custodianGroupId:string}} o
 * @returns {string}
 */
export function buildAad({ cardId, custodianGroupId }) {
  const id = String(cardId || '').trim();
  const group = String(custodianGroupId || '').trim();
  return `champollion-sealed:v${SEAL_VERSION}|card=${id}|group=${group}`;
}

// ---------------------------------------------------------------------------
// Threshold key handling. WAVE-2 SEAM: in production the public key is the
// aggregated FROST group key; here we accept a provided X25519 public key in
// the common encodings, or generate a stand-in keypair for tests/demo.
// ---------------------------------------------------------------------------

/**
 * Generate a stand-in threshold keypair (X25519).
 *
 * WAVE-2 SEAM: replaced by the custodian key ceremony, which produces the
 * aggregated group PUBLIC key (the only part the author needs) while the
 * matching secret exists solely as 3-of-5 shares. This helper exposes the full
 * private key ONLY so tests and a future controlled-eval context can prove the
 * ciphertext decrypts to the original — it must never run on Champollion infra
 * in production.
 *
 * @returns {{publicKey:crypto.KeyObject, privateKey:crypto.KeyObject,
 *            publicKeyDerB64:string, privateKeyDerB64:string, keyId:string}}
 */
export function generateThresholdKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    publicKey,
    privateKey,
    publicKeyDerB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyDerB64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    keyId: thresholdKeyId(publicKey),
  };
}

/**
 * Resolve a provided threshold public key into a node KeyObject.
 *
 * Accepts: a KeyObject; an object with `{publicKeyDerB64}`; a PEM string
 * (-----BEGIN PUBLIC KEY-----); or a base64-encoded DER SPKI string. Throws a
 * plain-language error on anything that is not a usable X25519 public key.
 *
 * The command wrapper (lib/commands/seal-corpus.js readKeyMaterial) also
 * accepts keygen JSON FILES directly — both the .pub.json and the .key.json
 * (which embeds publicKeyDerB64 alongside the private half) work as a
 * --threshold-pubkey source; the wrapper extracts the right field and hands
 * the base64 DER string down to this function.
 *
 * @param {crypto.KeyObject|string|{publicKeyDerB64:string}} input
 * @returns {crypto.KeyObject}
 */
export function resolveThresholdPublicKey(input) {
  if (!input) throw new Error('A threshold public key is required to seal a corpus.');
  if (typeof input === 'object' && input.asymmetricKeyType) return assertX25519Public(input);
  if (typeof input === 'object' && typeof input.publicKeyDerB64 === 'string') {
    return assertX25519Public(crypto.createPublicKey({
      key: Buffer.from(input.publicKeyDerB64, 'base64'), format: 'der', type: 'spki',
    }));
  }
  const raw = String(input).trim();
  if (!raw) throw new Error('A threshold public key is required to seal a corpus.');

  // PEM (most explicit) first.
  if (raw.includes('-----BEGIN')) {
    try { return assertX25519Public(crypto.createPublicKey(raw)); }
    catch (e) { throw new Error(`Threshold public key is not a valid PEM key: ${e.message}`); }
  }
  // Otherwise treat as base64-encoded DER SPKI.
  let der;
  try { der = Buffer.from(raw, 'base64'); }
  catch { throw new Error('Threshold public key must be a PEM string or base64 DER (SPKI).'); }
  if (!der.length) throw new Error('Threshold public key must be a PEM string or base64 DER (SPKI).');
  try {
    return assertX25519Public(crypto.createPublicKey({ key: der, format: 'der', type: 'spki' }));
  } catch (e) {
    throw new Error(`Threshold public key could not be parsed as DER SPKI: ${e.message}`);
  }
}

/** Guard: only X25519 public keys may receive a sealed corpus. */
function assertX25519Public(keyObject) {
  if (keyObject.type !== 'public') throw new Error('Expected a PUBLIC threshold key, got a private/secret key.');
  if (keyObject.asymmetricKeyType !== 'x25519') {
    throw new Error(`Threshold public key must be X25519 (got ${keyObject.asymmetricKeyType || 'unknown'}).`);
  }
  return keyObject;
}

/**
 * Stable short id for a threshold public key — sha256 of its DER SPKI bytes,
 * first 16 hex chars. Lets the card/artifact name *which* group key was used
 * without embedding the key itself.
 * @param {crypto.KeyObject} publicKeyObject
 * @returns {string}
 */
export function thresholdKeyId(publicKeyObject) {
  const der = publicKeyObject.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// The encrypt path — runs on the AUTHOR'S device.
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext corpus bytes to a threshold public key (client-side).
 *
 * Returns a content-FREE envelope: ciphertext + the public crypto parameters
 * needed to decrypt later (ephemeral public key, salt, IV, GCM tag) + a digest.
 * NONE of the return value contains plaintext.
 *
 * @param {object} o
 * @param {string|Buffer} o.plaintext        corpus content to seal
 * @param {crypto.KeyObject|string|object} o.thresholdPublicKey  recipient key
 * @param {string} o.aad                      card-binding AAD (see buildAad)
 * @returns {{cipher:string, version:string, aad:string, thresholdKeyId:string,
 *            envelope:{ephemeralPublicKey:string, salt:string, iv:string, authTag:string},
 *            ciphertext:string, ciphertextDigest:string}}
 */
export function sealPlaintext({ plaintext, thresholdPublicKey, aad }) {
  if (plaintext === undefined || plaintext === null) throw new Error('Nothing to seal — plaintext is empty.');
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf-8');
  if (!pt.length) throw new Error('Nothing to seal — plaintext is empty.');
  if (typeof aad !== 'string' || !aad) throw new Error('A binding AAD string is required (see buildAad).');

  const recipient = resolveThresholdPublicKey(thresholdPublicKey);

  // Ephemeral keypair → ECDH against the threshold key → one-time AES key.
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const sharedSecret = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient });
  const ephemeralPubDer = ephemeral.publicKey.export({ type: 'spki', format: 'der' });
  const recipientDer = recipient.export({ type: 'spki', format: 'der' });
  const salt = crypto.randomBytes(HKDF_SALT_BYTES);

  // Bind the derived key to both public keys + the card AAD so the key cannot
  // be reused across recipients or transplanted to another card.
  const info = Buffer.concat([
    Buffer.from(HKDF_INFO_PREFIX, 'utf-8'),
    ephemeralPubDer,
    recipientDer,
    Buffer.from(aad, 'utf-8'),
  ]);
  const aesKey = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, info, AES_KEY_BYTES));

  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  cipher.setAAD(Buffer.from(aad, 'utf-8'));
  const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Scrub the derived key from memory as soon as we're done with it.
  aesKey.fill(0);

  return {
    cipher: SEAL_CIPHER,
    version: SEAL_VERSION,
    aad,
    thresholdKeyId: thresholdKeyId(recipient),
    envelope: {
      ephemeralPublicKey: ephemeralPubDer.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    },
    ciphertext: ciphertext.toString('base64'),
    ciphertextDigest: crypto.createHash('sha256').update(ciphertext).digest('hex'),
  };
}

/**
 * Assemble the full sealed ARTIFACT — the ciphertext-only blob that would be
 * stored in the off-git, off-allowlist object store (never the repo). It is
 * exactly the `sealPlaintext` envelope plus the ids that route it. It contains
 * NO plaintext.
 *
 * @param {object} o
 * @param {object} o.sealed        a sealPlaintext() result
 * @param {string} o.cardId
 * @param {string} o.custodianGroupId
 * @param {string} o.createdAt     ISO timestamp (injected for determinism)
 * @returns {object} ciphertext-only artifact
 */
export function buildSealedArtifact({ sealed, cardId, custodianGroupId, createdAt }) {
  return {
    champollionSealed: SEAL_VERSION,
    cardId,
    custodianGroupId,
    cipher: sealed.cipher,
    aad: sealed.aad,
    thresholdKeyId: sealed.thresholdKeyId,
    envelope: sealed.envelope,
    ciphertext: sealed.ciphertext,
    ciphertextDigest: sealed.ciphertextDigest,
    createdAt: createdAt || null,
    _note:
      'Ciphertext-only sealed corpus. Decryptable ONLY by the custodian group\'s ' +
      'threshold key (3-of-5 in Wave 2). Champollion holds zero shares and cannot ' +
      'decrypt this. Never tracked in git or hosted in plaintext.',
  };
}

/**
 * The content-free `sealed` block written onto the corpus card. This is the
 * shape the card builder records — cipher id, custodian group, digest, AAD.
 * (Plus the key id + qualifier reference, all metadata.)
 *
 * @param {object} o
 * @param {object} o.sealed                a sealPlaintext() result
 * @param {string} o.custodianGroupId
 * @param {string} [o.keyScheme]           e.g. 'TSS-3-of-5' (Wave 2)
 * @param {string|null} [o.qualifierId]    paired public qualifier card id
 * @param {number|null} [o.qualifierThreshold]
 * @param {string|null} [o.artifactRef]    off-git pointer to the ciphertext store
 * @returns {{cipher:string, custodianGroupId:string, ciphertextDigest:string, aad:string,
 *            thresholdKeyId:string, keyScheme:(string|null), qualifierId:(string|null),
 *            qualifierThreshold:(number|null), artifactRef:(string|null)}}
 */
export function buildSealedCardBlock({
  sealed, custodianGroupId, keyScheme = null,
  qualifierId = null, qualifierThreshold = null, artifactRef = null,
}) {
  return {
    cipher: sealed.cipher,
    custodianGroupId,
    ciphertextDigest: sealed.ciphertextDigest,
    aad: sealed.aad,
    thresholdKeyId: sealed.thresholdKeyId,
    keyScheme,
    qualifierId,
    qualifierThreshold,
    artifactRef,
  };
}

// ---------------------------------------------------------------------------
// The decrypt path. WAVE-2 SEAM: in production this runs ONLY inside the
// controlled eval context (sandbox-evaluation-spec.md §6) after an M-of-N grant,
// and the single private key below is replaced by a threshold ECDH over the
// 3-of-5 shares. Here it proves a sealed corpus is genuinely recoverable —
// i.e. the encryption is real, not a no-op.
// ---------------------------------------------------------------------------

/**
 * Decrypt a sealed artifact (or a raw sealPlaintext envelope) with the
 * threshold private key. Verifies the ciphertext digest and the GCM tag (which
 * also authenticates the AAD binding).
 *
 * @param {object} o
 * @param {object} o.artifact                 buildSealedArtifact()/sealPlaintext() shape
 * @param {crypto.KeyObject|string} o.thresholdPrivateKey
 * @param {string} [o.aad]                     expected AAD (defaults to artifact.aad)
 * @returns {Buffer} the recovered plaintext
 */
export function openSealed({ artifact, thresholdPrivateKey, aad }) {
  if (!artifact || !artifact.envelope) throw new Error('Not a sealed artifact (missing envelope).');
  const expectAad = aad !== undefined ? aad : artifact.aad;
  if (typeof expectAad !== 'string' || !expectAad) throw new Error('A binding AAD is required to open a sealed artifact.');

  const privateKey = typeof thresholdPrivateKey === 'object' && thresholdPrivateKey.asymmetricKeyType
    ? thresholdPrivateKey
    : crypto.createPrivateKey(
        typeof thresholdPrivateKey === 'string' && thresholdPrivateKey.includes('-----BEGIN')
          ? thresholdPrivateKey
          : { key: Buffer.from(String(thresholdPrivateKey), 'base64'), format: 'der', type: 'pkcs8' },
      );

  const ciphertext = Buffer.from(artifact.ciphertext, 'base64');
  const digest = crypto.createHash('sha256').update(ciphertext).digest('hex');
  if (artifact.ciphertextDigest && digest !== artifact.ciphertextDigest) {
    throw new Error('Sealed artifact failed integrity check (ciphertext digest mismatch).');
  }

  const ephemeralPub = crypto.createPublicKey({
    key: Buffer.from(artifact.envelope.ephemeralPublicKey, 'base64'), format: 'der', type: 'spki',
  });
  const sharedSecret = crypto.diffieHellman({ privateKey, publicKey: ephemeralPub });
  const recipientDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const ephemeralPubDer = ephemeralPub.export({ type: 'spki', format: 'der' });
  const info = Buffer.concat([
    Buffer.from(HKDF_INFO_PREFIX, 'utf-8'),
    ephemeralPubDer,
    recipientDer,
    Buffer.from(expectAad, 'utf-8'),
  ]);
  const aesKey = Buffer.from(crypto.hkdfSync(
    'sha256', sharedSecret, Buffer.from(artifact.envelope.salt, 'base64'), info, AES_KEY_BYTES,
  ));

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(artifact.envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(expectAad, 'utf-8'));
  decipher.setAuthTag(Buffer.from(artifact.envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  aesKey.fill(0);
  return plaintext;
}

// ---------------------------------------------------------------------------
// Score-bundle signing (Phase B airgap transport) — Ed25519, node:crypto only.
//
// The AIRGAPPED scoring node signs each exported score bundle so the
// connected relay can verify the bytes it publishes are exactly the bytes the
// sandbox produced (arena/docs/sandbox-evaluation-spec.md §8 step 4 "audit
// log sealed"/§9). Honesty label: this is a SINGLE node signing key — it
// authenticates the machine's output, it is NOT the M-of-N steward custody of
// §12 (Wave 2). The canonical signed payload is the file's exact bytes; the
// signature block records the payload sha256 alongside so tampering is
// doubly evident.
// ---------------------------------------------------------------------------

/** Signature scheme label stamped into every signature block. */
export const SIGN_SCHEME = 'ed25519-single-node-wave1';

/**
 * Generate an Ed25519 signing keypair for a scoring node.
 * @returns {{publicKeyDerB64:string, privateKeyDerB64:string, keyId:string}}
 */
export function generateSigningKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyDerB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyDerB64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    keyId: thresholdKeyId(publicKey),   // same stable-id recipe: sha256(SPKI)[:16]
  };
}

function resolveSigningKey(input, { wantPublic }) {
  const label = wantPublic ? 'verify (public)' : 'signing (private)';
  if (!input) throw new Error(`A ${label} key is required.`);
  if (typeof input === 'object' && input.asymmetricKeyType) return input;
  if (typeof input === 'object') {
    const der = input.publicKeyDerB64 || input.privateKeyDerB64;
    if (typeof der === 'string') {
      return wantPublic
        ? crypto.createPublicKey({ key: Buffer.from(der, 'base64'), format: 'der', type: 'spki' })
        : crypto.createPrivateKey({ key: Buffer.from(der, 'base64'), format: 'der', type: 'pkcs8' });
    }
  }
  const raw = String(input).trim();
  if (raw.includes('-----BEGIN')) {
    return wantPublic ? crypto.createPublicKey(raw) : crypto.createPrivateKey(raw);
  }
  const der = Buffer.from(raw, 'base64');
  return wantPublic
    ? crypto.createPublicKey({ key: der, format: 'der', type: 'spki' })
    : crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

/**
 * Sign a payload (Buffer) with an Ed25519 private key.
 * @returns {{scheme:string, keyId:string, payloadSha256:string, signatureB64:string}}
 */
export function signPayload({ payload, signingPrivateKey }) {
  if (!Buffer.isBuffer(payload) || !payload.length) {
    throw new Error('signPayload needs a non-empty Buffer payload.');
  }
  const privateKey = resolveSigningKey(signingPrivateKey, { wantPublic: false });
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Signing key must be Ed25519 (got ${privateKey.asymmetricKeyType || 'unknown'}).`);
  }
  const publicKey = crypto.createPublicKey(privateKey);
  return {
    scheme: SIGN_SCHEME,
    keyId: thresholdKeyId(publicKey),
    payloadSha256: crypto.createHash('sha256').update(payload).digest('hex'),
    signatureB64: crypto.sign(null, payload, privateKey).toString('base64'),
  };
}

/**
 * Verify a payload (Buffer) against a signature block and an Ed25519 public
 * key. Returns true/false — the CALLER decides what a failure means (always
 * a refusal; never a warning).
 */
export function verifyPayload({ payload, signatureB64, verifyPublicKey }) {
  if (!Buffer.isBuffer(payload)) throw new Error('verifyPayload needs a Buffer payload.');
  const publicKey = resolveSigningKey(verifyPublicKey, { wantPublic: true });
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Verify key must be Ed25519 (got ${publicKey.asymmetricKeyType || 'unknown'}).`);
  }
  return crypto.verify(null, payload, publicKey, Buffer.from(String(signatureB64), 'base64'));
}
