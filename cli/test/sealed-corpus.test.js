/**
 * sealed-corpus test suite — Wave 1 of the zero-knowledge sovereign-eval PoC.
 *
 * Verifies the SEALED exposure tier end to end:
 *   • client-side encryption produces CIPHERTEXT ONLY — no plaintext ever
 *     reaches the uploaded artifact or the metadata card;
 *   • the card stays content-free + quarantine:true (same invariant as private);
 *   • the public QUALIFIER gate blocks a method below threshold from even
 *     proposing a sealed run;
 *   • the ciphertext is genuinely recoverable with the threshold key (proving
 *     the encryption is real, not a no-op) and only with it.
 *
 * Synthetic data only — distinctive sentinel sentences let us grep artifacts
 * for any plaintext leak. No network, no real corpora, nothing uploaded.
 *
 * @see cli/lib/seal.mjs
 * @see cli/lib/sealed-qualifier.mjs
 * @see cli/lib/corpus-registration.mjs
 * @see cli/lib/commands/register-corpus.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  SEAL_CIPHER,
  SEAL_VERSION,
  buildAad,
  generateThresholdKeypair,
  resolveThresholdPublicKey,
  thresholdKeyId,
  sealPlaintext,
  buildSealedArtifact,
  buildSealedCardBlock,
  openSealed,
} from '../lib/seal.mjs';
import {
  DEFAULT_QUALIFIER_THRESHOLD,
  qualifierVersionTag,
  parseQualifierYear,
  buildQualifierId,
  gateQualifier,
  isEligibleForSealedRun,
  qualifierContaminationBadge,
  rotateQualifier,
} from '../lib/sealed-qualifier.mjs';
import {
  buildCorpusCard,
  resolveTier,
  resolveLicense,
  resolveDestination,
  validateRegistration,
} from '../lib/corpus-registration.mjs';
import { run as registerCorpus } from '../lib/commands/register-corpus.js';

const TODAY = '2026-06-22';

// Distinctive sentinels — if ANY of these appears in a sealed artifact or card,
// plaintext leaked. They are deliberately unusual so a grep is unambiguous.
const SECRETS = [
  'WAAPISKI_SECRET_SENTENCE_ALPHA_42',
  'NEHIYAW_HELDOUT_BRAVO_zzqx',
  'CUSTODIAN_ONLY_CHARLIE_7731',
];
const SYNTHETIC_CORPUS = JSON.stringify({
  entries: SECRETS.map((s, i) => ({ id: i, source: s, reference: `${s}-target` })),
}, null, 2);

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Assert none of the secret sentinels appears anywhere in `text`. */
function assertNoSecrets(text, where) {
  for (const s of SECRETS) {
    assert.ok(!text.includes(s), `LEAK: plaintext "${s}" found in ${where}`);
    assert.ok(!text.includes(`${s}-target`), `LEAK: reference plaintext for "${s}" found in ${where}`);
  }
}

// ── seal.mjs: client-side encryption ─────────────────────────────────────────

describe('seal.mjs — sealPlaintext', () => {
  const kp = generateThresholdKeypair();
  const aad = buildAad({ cardId: 'eval-eng-crk-x-dev-v1', custodianGroupId: 'group-1' });
  const sealed = sealPlaintext({ plaintext: SYNTHETIC_CORPUS, thresholdPublicKey: kp.publicKey, aad });

  it('stamps the cipher suite + version and a content-free envelope', () => {
    assert.equal(sealed.cipher, SEAL_CIPHER);
    assert.equal(sealed.version, SEAL_VERSION);
    assert.equal(sealed.aad, aad);
    assert.equal(typeof sealed.ciphertext, 'string');
    assert.match(sealed.ciphertextDigest, /^[a-f0-9]{64}$/);
    assert.ok(sealed.envelope.ephemeralPublicKey && sealed.envelope.iv && sealed.envelope.authTag && sealed.envelope.salt);
  });

  it('NEVER contains the plaintext (only ciphertext + digest)', () => {
    assertNoSecrets(JSON.stringify(sealed), 'sealPlaintext result');
    // The ciphertext digest must match the actual ciphertext bytes.
    const ct = Buffer.from(sealed.ciphertext, 'base64');
    assert.equal(crypto.createHash('sha256').update(ct).digest('hex'), sealed.ciphertextDigest);
  });

  it('round-trips: ciphertext decrypts back to the original with the threshold key', () => {
    const artifact = buildSealedArtifact({ sealed, cardId: 'eval-eng-crk-x-dev-v1', custodianGroupId: 'group-1', createdAt: TODAY });
    const recovered = openSealed({ artifact, thresholdPrivateKey: kp.privateKey, aad });
    assert.equal(recovered.toString('utf-8'), SYNTHETIC_CORPUS);
  });

  it('is real encryption — a DIFFERENT key cannot decrypt it', () => {
    const other = generateThresholdKeypair();
    const artifact = buildSealedArtifact({ sealed, cardId: 'eval-eng-crk-x-dev-v1', custodianGroupId: 'group-1', createdAt: TODAY });
    assert.throws(() => openSealed({ artifact, thresholdPrivateKey: other.privateKey, aad }));
  });

  it('AAD is authenticated — a transplanted/altered AAD fails to open', () => {
    const artifact = buildSealedArtifact({ sealed, cardId: 'eval-eng-crk-x-dev-v1', custodianGroupId: 'group-1', createdAt: TODAY });
    const wrongAad = buildAad({ cardId: 'eval-eng-crk-x-dev-v1', custodianGroupId: 'group-IMPOSTER' });
    assert.throws(() => openSealed({ artifact, thresholdPrivateKey: kp.privateKey, aad: wrongAad }));
  });

  it('rejects empty plaintext and a missing key', () => {
    assert.throws(() => sealPlaintext({ plaintext: '', thresholdPublicKey: kp.publicKey, aad }));
    assert.throws(() => sealPlaintext({ plaintext: 'x', thresholdPublicKey: null, aad }));
  });
});

describe('seal.mjs — buildSealedArtifact (the uploaded blob)', () => {
  const kp = generateThresholdKeypair();
  const aad = buildAad({ cardId: 'eval-eng-crk-y-dev-v1', custodianGroupId: 'g' });
  const sealed = sealPlaintext({ plaintext: SYNTHETIC_CORPUS, thresholdPublicKey: kp.publicKey, aad });
  const artifact = buildSealedArtifact({ sealed, cardId: 'eval-eng-crk-y-dev-v1', custodianGroupId: 'g', createdAt: TODAY });

  it('is ciphertext-only — no plaintext anywhere in the serialized artifact', () => {
    assertNoSecrets(JSON.stringify(artifact), 'sealed artifact');
  });
  it('carries the digest + envelope but never the corpus content', () => {
    assert.equal(artifact.ciphertextDigest, sealed.ciphertextDigest);
    assert.ok(!('plaintext' in artifact));
    assert.ok(!('entries' in artifact));
  });
});

describe('seal.mjs — threshold key handling', () => {
  it('resolves PEM and base64-DER public keys; thresholdKeyId is stable', () => {
    const kp = generateThresholdKeypair();
    const pem = kp.publicKey.export({ type: 'spki', format: 'pem' });
    const fromPem = resolveThresholdPublicKey(pem);
    const fromB64 = resolveThresholdPublicKey(kp.publicKeyDerB64);
    assert.equal(thresholdKeyId(fromPem), kp.keyId);
    assert.equal(thresholdKeyId(fromB64), kp.keyId);
  });
  it('rejects a non-X25519 key (fail-loud)', () => {
    const ed = crypto.generateKeyPairSync('ed25519');
    assert.throws(() => resolveThresholdPublicKey(ed.publicKey.export({ type: 'spki', format: 'pem' })), /X25519/i);
  });
  it('rejects a PRIVATE key where a public key is expected', () => {
    const kp = generateThresholdKeypair();
    assert.throws(() => resolveThresholdPublicKey(kp.privateKey), /public/i);
  });
});

// ── sealed-qualifier.mjs: the public qualifier gate ──────────────────────────

describe('sealed-qualifier — eligibility (the load-bearing gate)', () => {
  const qualifierId = 'eval-eng-crk-nehiyaw-qualifier-v2026';

  it('a method BELOW the qualifier threshold is NOT eligible to request a sealed run', () => {
    const r = isEligibleForSealedRun({ qualifierId, score: 21.4, threshold: 30 });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /threshold is 30/);
  });
  it('a method AT/ABOVE the threshold IS eligible to PROPOSE (still needs custodians)', () => {
    const r = isEligibleForSealedRun({ qualifierId, score: 30, threshold: 30 });
    assert.equal(r.eligible, true);
    assert.match(r.reason, /custodian approval/i);
  });
  it('no paired qualifier ⇒ NOT eligible (fail-safe)', () => {
    assert.equal(isEligibleForSealedRun({ qualifierId: null, score: 99 }).eligible, false);
  });
  it('no recorded qualifier score ⇒ NOT eligible (must run the qualifier first)', () => {
    assert.equal(isEligibleForSealedRun({ qualifierId, score: null }).eligible, false);
  });
  it('defaults the threshold to DEFAULT_QUALIFIER_THRESHOLD', () => {
    const below = isEligibleForSealedRun({ qualifierId, score: DEFAULT_QUALIFIER_THRESHOLD - 1 });
    const at = isEligibleForSealedRun({ qualifierId, score: DEFAULT_QUALIFIER_THRESHOLD });
    assert.equal(below.eligible, false);
    assert.equal(at.eligible, true);
  });
});

describe('sealed-qualifier — public-tier license gate', () => {
  it('admits CC-BY / CC0 (a qualifier is public by definition)', () => {
    assert.equal(gateQualifier(resolveLicense('cc-by-4.0')).allowed, true);
    assert.equal(gateQualifier(resolveLicense('cc0-1.0')).allowed, true);
  });
  it('BLOCKS NC / proprietary / unconfirmed as a qualifier', () => {
    assert.equal(gateQualifier(resolveLicense('cc-by-nc-4.0')).allowed, false);
    assert.equal(gateQualifier(resolveLicense('proprietary')).allowed, false);
    assert.equal(gateQualifier(resolveLicense('Weird-Custom-1.0')).allowed, false);
  });
});

describe('sealed-qualifier — yearly rotation + staleness', () => {
  it('versions and parses vYYYY', () => {
    assert.equal(qualifierVersionTag(2026), 'v2026');
    assert.equal(parseQualifierYear('v2026'), 2026);
    assert.equal(parseQualifierYear('eval-eng-crk-x-qualifier-v2027'), 2027);
    assert.equal(parseQualifierYear('no-year-here'), null);
  });
  it('builds a vYYYY-tagged public qualifier id', () => {
    assert.equal(
      buildQualifierId({ source: 'eng', target: 'crk', slug: 'nehiyaw', year: 2026 }),
      'eval-eng-crk-nehiyaw-qualifier-v2026',
    );
  });
  it('a current-year qualifier is fresh (no contamination badge)', () => {
    const b = qualifierContaminationBadge({ qualifierYear: 2026, currentYear: 2026 });
    assert.equal(b.stale, false);
    assert.equal(b.badge, null);
    assert.equal(b.risk, 'NONE');
  });
  it('a stale qualifier raises a contamination-risk badge (MEDIUM then HIGH)', () => {
    const oneYear = qualifierContaminationBadge({ qualifierYear: 2025, currentYear: 2026 });
    assert.equal(oneYear.stale, true);
    assert.equal(oneYear.risk, 'MEDIUM');
    assert.match(oneYear.badge, /STALE/);
    const twoYear = qualifierContaminationBadge({ qualifierYear: 2024, currentYear: 2026 });
    assert.equal(twoYear.risk, 'HIGH');
  });
  it('rotation activates the new year and FREEZES the prior for history', () => {
    const first = rotateQualifier({ pair: { source: 'eng', target: 'crk', slug: 'nehiyaw' }, newYear: 2026 });
    assert.equal(first.active.year, 2026);
    assert.equal(first.frozen.length, 0);
    const second = rotateQualifier({
      pair: { source: 'eng', target: 'crk', slug: 'nehiyaw' }, newYear: 2027,
      current: first.active, frozen: first.frozen,
    });
    assert.equal(second.active.year, 2027);
    assert.equal(second.frozen.length, 1);
    assert.equal(second.frozen[0].year, 2026);
    assert.equal(second.frozen[0].frozen, true);
    assert.equal(second.frozen[0].status, 'frozen');
  });
  it('refuses to rotate backwards (a frozen year cannot be re-activated)', () => {
    const cur = { id: 'eval-eng-crk-x-qualifier-v2027', year: 2027 };
    assert.throws(() => rotateQualifier({ pair: { source: 'eng', target: 'crk' }, newYear: 2026, current: cur }));
  });
});

// ── corpus-registration: sealed card builder + validation ────────────────────

describe('buildCorpusCard — sealed tier', () => {
  const kp = generateThresholdKeypair();
  const aad = buildAad({ cardId: 'eval-eng-crk-sealed-dev-v1', custodianGroupId: 'nehiyaw-trust' });
  const sealed = sealPlaintext({ plaintext: SYNTHETIC_CORPUS, thresholdPublicKey: kp.publicKey, aad });
  const block = buildSealedCardBlock({
    sealed, custodianGroupId: 'nehiyaw-trust', keyScheme: 'TSS-3-of-5',
    qualifierId: 'eval-eng-crk-nehiyaw-qualifier-v2026', qualifierThreshold: 30, artifactRef: 'eval-eng-crk-sealed-dev-v1.sealed.json',
  });
  const card = buildCorpusCard({
    id: 'eval-eng-crk-sealed-dev-v1',
    name: 'Sealed set', description: 'A sealed set',
    pair: { source: 'eng', target: 'crk' },
    publisher: 'nehiyaw-trust',
    licenseOption: resolveLicense('proprietary'),
    tier: resolveTier('sealed'),
    size: 500, domain: 'educational', addedAt: TODAY,
    sealed: block,
  });

  it('is content-free and quarantine:true (same invariant as private)', () => {
    assert.equal(card.exposureTier, 'sealed');
    assert.equal(card.quarantine, true);
    assert.ok(card.quarantineReason && card.quarantineReason.length > 0);
    assert.equal(card.source.url, null);
    assert.ok(!('dataFile' in card.dev));
    assert.ok(!('entries' in card));
    assertNoSecrets(JSON.stringify(card), 'sealed card');
  });

  it('carries a content-free sealed block (cipher / group / digest / aad)', () => {
    assert.equal(card.sealed.cipher, SEAL_CIPHER);
    assert.equal(card.sealed.custodianGroupId, 'nehiyaw-trust');
    assert.match(card.sealed.ciphertextDigest, /^[a-f0-9]{64}$/);
    assert.equal(card.sealed.aad, aad);
    assert.equal(card.sealed.qualifierId, 'eval-eng-crk-nehiyaw-qualifier-v2026');
    assert.equal(card.sealed.qualifierThreshold, 30);
  });
});

describe('validateRegistration — sealed tier requirements', () => {
  const good = {
    tier: resolveTier('sealed'),
    licenseOption: resolveLicense('proprietary'),
    pair: { source: 'eng', target: 'crk' },
    name: 'Sealed', size: 500, domain: 'educational',
    custodianGroupId: 'g', thresholdPublicKey: 'KEY', sealInput: './c.json',
    qualifierId: 'eval-eng-crk-x-qualifier-v2026',
  };
  it('passes a complete sealed request', () => {
    assert.equal(validateRegistration(good).ok, true);
  });
  it('demands custodian group, threshold key, seal input, and a paired qualifier', () => {
    const v = validateRegistration({ ...good, custodianGroupId: null, thresholdPublicKey: null, sealInput: null, qualifierId: null });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /custodian group/i.test(e)));
    assert.ok(v.errors.some((e) => /threshold public key/i.test(e)));
    assert.ok(v.errors.some((e) => /--seal-input/.test(e)));
    assert.ok(v.errors.some((e) => /qualifier/i.test(e)));
  });
});

describe('resolveDestination — sealed lands in the tracked SSOT', () => {
  it('tracks the sealed card like private/public', () => {
    const d = resolveDestination({ tier: resolveTier('sealed'), id: 'eval-x', corporaCardsDir: '/tmp/cards', localDir: '/tmp/local' });
    assert.equal(d.tracked, true);
    assert.equal(d.dir, '/tmp/cards');
  });
});

// ── end-to-end through the command (TEMP dirs only) ──────────────────────────

describe('register-corpus --tier sealed (e2e, temp dirs)', () => {
  it('encrypts on-device: ciphertext-only artifact + content-free quarantined card', async () => {
    const work = tmp('chr-sealed-');
    const cardsDir = path.join(work, 'cards');
    const inputPath = path.join(work, 'secret-corpus.json');
    const keyPath = path.join(work, 'group.pub');
    const outPath = path.join(work, 'sealed-artifact.json');
    fs.mkdirSync(cardsDir, { recursive: true });
    fs.writeFileSync(inputPath, SYNTHETIC_CORPUS, 'utf-8');

    const kp = generateThresholdKeypair();
    fs.writeFileSync(keyPath, kp.publicKey.export({ type: 'spki', format: 'pem' }), 'utf-8');

    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'Sealed eng-crk', pair: 'eng>crk', license: 'proprietary', tier: 'sealed',
      size: '500', domain: 'educational',
      'seal-input': inputPath, 'threshold-pubkey': keyPath, 'custodian-group': 'nehiyaw-trust',
      'seal-out': outPath, 'qualifier-id': 'eval-eng-crk-nehiyaw-qualifier-v2026', 'qualifier-threshold': '30',
      'cards-dir': cardsDir, json: true,
    }, work);
    assert.equal(code, 0);

    // The card: content-free, quarantined, with a sealed block — NO plaintext.
    const cardFiles = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json'));
    assert.equal(cardFiles.length, 1);
    const cardRaw = fs.readFileSync(path.join(cardsDir, cardFiles[0]), 'utf-8');
    const card = JSON.parse(cardRaw);
    assert.equal(card.exposureTier, 'sealed');
    assert.equal(card.quarantine, true);
    assert.equal(card.source.url, null);
    assert.equal(card.sealed.cipher, SEAL_CIPHER);
    assert.match(card.sealed.ciphertextDigest, /^[a-f0-9]{64}$/);
    assertNoSecrets(cardRaw, 'e2e sealed card');

    // The artifact: ciphertext-only — NO plaintext.
    assert.ok(fs.existsSync(outPath), 'sealed artifact must be written');
    const artifactRaw = fs.readFileSync(outPath, 'utf-8');
    assertNoSecrets(artifactRaw, 'e2e sealed artifact');
    const artifact = JSON.parse(artifactRaw);
    assert.equal(artifact.ciphertextDigest, card.sealed.ciphertextDigest);

    // Proof the encryption is real: only the threshold key recovers the original.
    const recovered = openSealed({ artifact, thresholdPrivateKey: kp.privateKey, aad: artifact.aad });
    assert.equal(recovered.toString('utf-8'), SYNTHETIC_CORPUS);

    // And the recorded qualifier threshold gates a weak method.
    assert.equal(isEligibleForSealedRun({ qualifierId: card.sealed.qualifierId, score: 10, threshold: card.sealed.qualifierThreshold }).eligible, false);
    assert.equal(isEligibleForSealedRun({ qualifierId: card.sealed.qualifierId, score: 55, threshold: card.sealed.qualifierThreshold }).eligible, true);
  });

  it('fails loudly (exit 1, nothing written) when sealed inputs are missing', async () => {
    const work = tmp('chr-sealed-bad-');
    const cardsDir = path.join(work, 'cards');
    fs.mkdirSync(cardsDir, { recursive: true });
    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'Sealed', pair: 'eng>crk', license: 'proprietary', tier: 'sealed',
      size: '500', domain: 'educational', 'cards-dir': cardsDir,
    }, work);
    assert.equal(code, 1);
    assert.equal(fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json')).length, 0);
  });
});
