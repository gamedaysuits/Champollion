/**
 * Command: register-corpus
 *
 * Register a new evaluation corpus, with the author in control of BOTH its
 * license and how far it travels. Three exposure tiers, defaulting to the most
 * private:
 *
 *   1. local-only — never registered, never uploaded; the card + your text stay
 *      entirely on your machine.
 *   2. private    — a WMT-style sovereign held-out / secret test set: register
 *      METADATA ONLY; your text is never uploaded or hosted; you keep custody.
 *   3. public     — publish a metadata card + a fetch-from-source pointer; your
 *      text is never hosted by us. Gated by cli/lib/license-gate.mjs so NC /
 *      no-redistribute / unconfirmed licenses cannot enter the public lane.
 *
 * We NEVER read, upload, or host corpus content in ANY tier — only metadata and
 * (for public) a pointer to where the data is fetched from. This command writes
 * a metadata card; it never touches your sentences.
 *
 * Interactive wizard when stdin is a TTY; fully scriptable via flags otherwise
 * (or with --yes). See `champollion register-corpus --help`.
 *
 * Exit codes: 0 = registered/saved (or cancelled); 1 = invalid request / gate block.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { output } from '../output.js';
import {
  LICENSE_OPTIONS,
  EXPOSURE_TIERS,
  DEFAULT_TIER,
  resolveLicense,
  resolveTier,
  gatePublicRegistration,
  buildCorpusCard,
  deriveCardId,
  slugify,
  resolveDestination,
  validateRegistration,
} from '../corpus-registration.mjs';
import {
  sealPlaintext,
  buildSealedArtifact,
  buildSealedCardBlock,
  resolveThresholdPublicKey,
  buildAad,
} from '../seal.mjs';
import { DEFAULT_QUALIFIER_THRESHOLD } from '../sealed-qualifier.mjs';

// Tracked corpora-cards SSOT, resolved relative to this module.
const DEFAULT_CARDS_DIR = fileURLToPath(new URL('../../shared/corpora-cards/', import.meta.url));

const CONTAMINATION_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

/**
 * Resolve a path to its REAL location, following symlinks. The destination
 * directory may not exist yet, so we realpath the deepest existing ancestor
 * and re-append the remaining (non-existent, therefore non-symlink) segments.
 * Unlike path.resolve, this defeats a symlinked ancestor that points elsewhere.
 *
 * @param {string} p - Path to resolve (absolute or relative to cwd)
 * @returns {string} Real, symlink-free absolute path
 */
function realPathDeep(p) {
  let cur = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(cur)) {
    tail.unshift(path.basename(cur));
    const parent = path.dirname(cur);
    if (parent === cur) return path.resolve(p); // reached root, nothing exists
    cur = parent;
  }
  let real;
  try { real = fs.realpathSync(cur); } catch { return path.resolve(p); }
  return tail.length ? path.join(real, ...tail) : real;
}

/**
 * True if `child` is `parent` itself or nested anywhere under it.
 * Both arguments must already be real (symlink-resolved) paths.
 */
function isWithin(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isInteractive() {
  return process.stdin.isTTY === true;
}

function ask(rl, question, defaultValue) {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/** Parse "src>tgt" / "src-tgt" / "src,tgt" into {source, target}, else null. */
function parsePair(value) {
  if (!value) return null;
  const m = String(value).trim().split(/[>\-,\s]+/).filter(Boolean);
  if (m.length >= 2) return { source: m[0].toLowerCase(), target: m[1].toLowerCase() };
  return null;
}

// ── Catalog printing (plain language for humans, machine-readable for agents) ──

function printCatalogs(asJson) {
  if (asJson) {
    console.log(JSON.stringify({
      licenses: LICENSE_OPTIONS.map((o) => ({ key: o.key, spdx: o.spdx, commercial: o.commercial, redistribution: o.redistribution, publicEligible: o.publicEligible, explanation: o.explanation })),
      tiers: EXPOSURE_TIERS.map((t) => ({ key: t.key, registers: t.registers, uploadsContent: t.uploadsContent, uploadsCiphertext: !!t.uploadsCiphertext, explanation: t.explanation })),
      default_tier: DEFAULT_TIER,
    }, null, 2));
    return;
  }
  console.log('');
  console.log('  LICENSES — pick the terms others may use your corpus under:');
  console.log('');
  LICENSE_OPTIONS.forEach((o, i) => {
    console.log(`    ${i + 1}. ${o.label}`);
    console.log(`       ${o.explanation}`);
    console.log(`       commercial: ${o.commercial} · redistribution: ${o.redistribution} · public-lane: ${o.publicEligible ? 'eligible' : 'blocked'}`);
  });
  console.log('');
  console.log('  EXPOSURE TIERS — how far your corpus travels (default: most private):');
  console.log('');
  EXPOSURE_TIERS.forEach((t, i) => {
    const def = t.key === DEFAULT_TIER ? '  ★ default' : '';
    console.log(`    ${i + 1}. ${t.label}${def}`);
    console.log(`       ${t.explanation}`);
  });
  console.log('');
  console.log('  Champollion never reads, uploads, or hosts your corpus text — in ANY tier.');
  console.log('');
}

// ── Interactive wizard ──────────────────────────────────────────────────────

async function runInteractive(rl, args) {
  console.log('');
  console.log('  champollion — Register a Corpus');
  console.log('  ════════════════════════════════════════════════');
  console.log('');
  console.log('  You choose the license and how far this corpus travels.');
  console.log('  We never read, upload, or host your text — only metadata,');
  console.log('  and (for public sets) a pointer to where the data is fetched from.');

  // Step 1 — basics
  console.log('');
  console.log('  Step 1/4 — Basics');
  console.log('  ────────────────────────────────────────────────');
  const name = await ask(rl, 'Corpus name', args.name || '');
  const pairStr = await ask(rl, 'Language pair (e.g. eng-crk, or "eng>crk")', args.pair || '');
  const pair = parsePair(pairStr);
  const publisher = await ask(rl, 'Publisher / your name or org', args.publisher || '');
  const description = await ask(rl, 'One-line description', args.description || `${name} evaluation corpus`);

  // Step 2 — license
  console.log('');
  console.log('  Step 2/4 — License');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  LICENSE_OPTIONS.forEach((o, i) => {
    console.log(`    ${i + 1}. ${o.label} — ${o.explanation}`);
  });
  console.log('');
  const licChoice = await ask(rl, 'Choose a license', '1');
  const licenseOption = resolveLicense(licChoice) || LICENSE_OPTIONS[0];
  console.log(`  → ${licenseOption.label}  (commercial: ${licenseOption.commercial}, redistribution: ${licenseOption.redistribution})`);

  // Step 3 — exposure tier (default most private)
  console.log('');
  console.log('  Step 3/4 — Exposure');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  EXPOSURE_TIERS.forEach((t, i) => {
    const def = t.key === DEFAULT_TIER ? '  ★ safe default' : '';
    console.log(`    ${i + 1}. ${t.label}${def}`);
    console.log(`       ${t.explanation}`);
  });
  console.log('');
  const tierChoice = await ask(rl, 'Choose exposure', '1');
  let tier = resolveTier(tierChoice);

  // Gate the public tier through the license gate, with a graceful fallback.
  if (tier.key === 'public') {
    const gate = gatePublicRegistration(licenseOption);
    if (!gate.allowed) {
      console.log('');
      console.log(`  ⚠  ${gate.reason}`);
      const fallback = await ask(rl, 'Register privately instead (metadata only, text never uploaded)?', 'yes');
      if (fallback.toLowerCase().startsWith('y')) {
        tier = resolveTier('private');
        console.log('  → Switched to private (sovereign held-out) registration.');
      } else {
        return { cancelled: true, reason: gate.reason };
      }
    } else {
      console.log(`  → ${gate.reason}`);
    }
  }

  // Public tier needs a fetch-from-source pointer (we host nothing).
  let repoUrl = args['repo-url'] || null;
  let builder = args.builder || null;
  let sourceUrl = args['source-url'] || null;
  if (tier.key === 'public') {
    console.log('');
    console.log('  Public sets are fetched from their source — give us a pointer, not the data:');
    sourceUrl = await ask(rl, 'Canonical URL (project/dataset page)', sourceUrl || '');
    repoUrl = await ask(rl, 'Fetch-from-source archive/repo URL', repoUrl || '');
    builder = await ask(rl, 'Builder adapter id (rebuilds from source, e.g. tatoeba-challenge)', builder || '');
  }

  // Sealed tier — encrypt on this device, hand us ciphertext + a content-free card.
  let custodianGroupId = args['custodian-group'] || null;
  let thresholdPubkey = args['threshold-pubkey'] || null;
  let sealInput = args['seal-input'] || null;
  let sealOut = args['seal-out'] || null;
  let qualifierId = args['qualifier-id'] || null;
  let qualifierThreshold = args['qualifier-threshold'] != null ? Number(args['qualifier-threshold']) : null;
  const keyScheme = args['key-scheme'] || null;
  if (tier.key === 'sealed') {
    console.log('');
    console.log('  Sealed sets are encrypted ON THIS DEVICE before anything leaves.');
    console.log('  We receive ciphertext + a content-free card only — we cannot read it.');
    console.log('');
    sealInput = await ask(rl, 'Path to the corpus file to seal (your plaintext, stays local)', sealInput || '');
    thresholdPubkey = await ask(rl, 'Custodian group threshold public key (path or PEM/base64)', thresholdPubkey || '');
    custodianGroupId = await ask(rl, 'Custodian group id (the community group that holds the key)', custodianGroupId || '');
    sealOut = await ask(rl, 'Where to write the encrypted artifact', sealOut || '');
    console.log('');
    console.log('  A sealed set must be paired with a PUBLIC qualifier (a disjoint CC-BY/CC0');
    console.log('  twin) that a method must clear before any sealed run can be proposed.');
    qualifierId = await ask(rl, 'Paired public qualifier card id (e.g. eval-eng-crk-…-qualifier-v2026)', qualifierId || '');
    const qt = await ask(rl, 'Qualifier clearance threshold', String(qualifierThreshold ?? DEFAULT_QUALIFIER_THRESHOLD));
    qualifierThreshold = Number(qt);
  }

  // Step 4 — consumer-reports metadata
  console.log('');
  console.log('  Step 4/4 — Dataset details (the "consumer report")');
  console.log('  ────────────────────────────────────────────────');
  const sizeStr = await ask(rl, 'Size — number of sentence pairs', args.size || '');
  const domain = await ask(rl, 'Domain (news, conversational, educational, …)', args.domain || 'mixed');
  const defaultRisk = tier.key === 'public' ? 'LOW' : 'NONE';
  console.log('');
  console.log('  Contamination risk — is this text in known LLM training sets?');
  console.log('    NONE = private/unpublished · LOW = niche/recent · MEDIUM = public · HIGH = in major training sets');
  const riskIn = await ask(rl, 'Contamination risk', defaultRisk);
  const contaminationRisk = CONTAMINATION_LEVELS.includes(riskIn.toUpperCase()) ? riskIn.toUpperCase() : defaultRisk;

  return {
    name, pair, publisher, description,
    licenseOption, tier,
    repoUrl, builder, sourceUrl,
    size: Number(sizeStr), domain, contaminationRisk,
    custodianGroupId, thresholdPubkey, sealInput, sealOut,
    qualifierId, qualifierThreshold, keyScheme,
  };
}

// ── Non-interactive (flags) ─────────────────────────────────────────────────

function fromFlags(args) {
  const pair = parsePair(args.pair) ||
    (args['source-lang'] && args['target-lang']
      ? { source: String(args['source-lang']).toLowerCase(), target: String(args['target-lang']).toLowerCase() }
      : null);
  const licenseOption = resolveLicense(args.license);
  const tier = resolveTier(args.tier || args.exposure);
  const riskIn = args.contamination ? String(args.contamination).toUpperCase() : null;
  return {
    name: args.name || '',
    pair,
    publisher: args.publisher || (args.name ? '' : ''),
    description: args.description || (args.name ? `${args.name} evaluation corpus` : ''),
    licenseOption,
    tier,
    repoUrl: args['repo-url'] || null,
    builder: args.builder || null,
    sourceUrl: args['source-url'] || null,
    size: args.size != null ? Number(args.size) : NaN,
    domain: args.domain || '',
    contaminationRisk: riskIn && CONTAMINATION_LEVELS.includes(riskIn) ? riskIn : null,
    // sealed tier
    custodianGroupId: args['custodian-group'] || null,
    thresholdPubkey: args['threshold-pubkey'] || null,
    sealInput: args['seal-input'] || null,
    sealOut: args['seal-out'] || null,
    qualifierId: args['qualifier-id'] || null,
    qualifierThreshold: args['qualifier-threshold'] != null ? Number(args['qualifier-threshold']) : null,
    keyScheme: args['key-scheme'] || null,
  };
}

// ── Sealed tier: client-side encryption ──────────────────────────────────────

/**
 * Seal a corpus on the author's device: read the local plaintext, encrypt it to
 * the custodian group's threshold PUBLIC key, write a ciphertext-ONLY artifact,
 * and return the content-free `sealed` card block. The plaintext never leaves
 * this machine in readable form; we hold only ciphertext + metadata, and we
 * cannot decrypt it (no single party can — see the community-custodian multisig plan in docs/governance).
 *
 * @returns {{cardBlock:object, artifactPath:string}|{error:string}}
 */
function sealCorpusForRegistration({ req, id, addedAt, cwd }) {
  // 1. Read the author's plaintext corpus (stays on this device).
  let plaintext;
  try {
    plaintext = fs.readFileSync(path.resolve(cwd, req.sealInput));
  } catch (e) {
    return { error: `cannot read the corpus file (--seal-input ${req.sealInput}): ${e.message}` };
  }
  if (!plaintext.length) return { error: `the corpus file (--seal-input ${req.sealInput}) is empty — nothing to seal.` };

  // 2. Resolve the custodian group's threshold PUBLIC key (a path or an inline
  //    PEM/base64 value). WAVE-2 SEAM: this becomes the aggregated 3-of-5 FROST
  //    group key from the custodian key ceremony — same call site, same format.
  let thresholdKeyInput = req.thresholdPubkey;
  let keyAsPath = null;
  try { keyAsPath = path.resolve(cwd, String(req.thresholdPubkey)); } catch { keyAsPath = null; }
  if (keyAsPath && fs.existsSync(keyAsPath) && fs.statSync(keyAsPath).isFile()) {
    try { thresholdKeyInput = fs.readFileSync(keyAsPath, 'utf-8').trim(); }
    catch (e) { return { error: `cannot read the threshold public key file: ${e.message}` }; }
  }
  let thresholdPublicKey;
  try { thresholdPublicKey = resolveThresholdPublicKey(thresholdKeyInput); }
  catch (e) { return { error: e.message }; }

  // 3. Encrypt CLIENT-SIDE. The AAD binds the ciphertext to this card + group.
  const aad = buildAad({ cardId: id, custodianGroupId: req.custodianGroupId });
  let sealed;
  try { sealed = sealPlaintext({ plaintext, thresholdPublicKey, aad }); }
  catch (e) { return { error: e.message }; }
  // Drop the plaintext reference as soon as it is sealed.
  plaintext = null;

  // 4. Write the ciphertext-ONLY artifact (the off-git encrypted store stand-in).
  const artifactPath = req.sealOut
    ? path.resolve(cwd, req.sealOut)
    : path.resolve(cwd, `${id}.sealed.json`);
  // The ciphertext artifact must NEVER land in the tracked corpora-cards SSOT.
  const ssotReal = realPathDeep(DEFAULT_CARDS_DIR);
  if (isWithin(realPathDeep(artifactPath), ssotReal)) {
    return { error: 'the sealed (ciphertext) artifact must not be written into the tracked corpora-cards directory — choose a different --seal-out path.' };
  }
  const artifact = buildSealedArtifact({
    sealed, cardId: id, custodianGroupId: req.custodianGroupId, createdAt: addedAt,
  });
  try {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
  } catch (e) {
    return { error: `cannot write the sealed artifact to ${artifactPath}: ${e.message}` };
  }

  // 5. The content-free `sealed` block for the card (cipher / group / digest /
  //    AAD + key + paired-qualifier references).
  const qt = req.qualifierThreshold != null && !Number.isNaN(req.qualifierThreshold)
    ? req.qualifierThreshold
    : DEFAULT_QUALIFIER_THRESHOLD;
  const cardBlock = buildSealedCardBlock({
    sealed,
    custodianGroupId: req.custodianGroupId,
    keyScheme: req.keyScheme || 'TSS-3-of-5',
    qualifierId: req.qualifierId,
    qualifierThreshold: qt,
    artifactRef: path.basename(artifactPath),
  });

  return { cardBlock, artifactPath };
}

/**
 * TODO (Wave 2 — web wizard): the browser registration wizard at
 * champollion.dev will offer the same "Seal it" choice, doing the IDENTICAL
 * client-side encryption in-browser (WebCrypto: X25519 ECDH → HKDF → AES-GCM)
 * so the plaintext never leaves the user's browser either. It will POST only the
 * ciphertext artifact + the content-free card produced here. The CLI path in
 * this file is the Wave-1 deliverable and the reference implementation; the web
 * wizard must produce a byte-compatible artifact (same SEAL_CIPHER/SEAL_VERSION
 * envelope in lib/seal.mjs). Not implemented yet — the CLI path below is the
 * only seal path today.
 */

// ── Main ────────────────────────────────────────────────────────────────────

async function run(args, cwd) {
  if (args.help) {
    showHelp();
    return 0;
  }
  if (args.list) {
    printCatalogs(!!args.json);
    return 0;
  }

  // Collect the registration request.
  let req;
  if (!args.yes && isInteractive()) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      req = await runInteractive(rl, args);
    } finally {
      rl.close();
    }
    if (req && req.cancelled) {
      console.log('');
      output.warn('Registration cancelled — nothing was written.');
      return 0;
    }
  } else {
    req = fromFlags(args);
  }

  // Validate (collects every problem, fails loud).
  const v = validateRegistration({
    tier: req.tier,
    licenseOption: req.licenseOption,
    pair: req.pair || {},
    name: req.name,
    repoUrl: req.repoUrl,
    builder: req.builder,
    size: req.size,
    domain: req.domain,
    custodianGroupId: req.custodianGroupId,
    thresholdPublicKey: req.thresholdPubkey,
    sealInput: req.sealInput,
    qualifierId: req.qualifierId,
  });
  if (!v.ok) {
    console.error('[ERR] Cannot register this corpus:');
    for (const e of v.errors) console.error(`      • ${e}`);
    console.error('');
    console.error('      Run "champollion register-corpus --list" to see licenses + tiers,');
    console.error('      or "champollion register-corpus --help" for all flags.');
    return 1;
  }

  // Build the (content-free) card.
  const version = args.version || '1';
  const slug = slugify(args.id || req.publisher || req.name || 'custom');
  const id = args.id && /^(ref|eval)-/.test(args.id)
    ? args.id
    : deriveCardId({ source: req.pair.source, target: req.pair.target, slug, version });

  const addedAt = new Date().toISOString().slice(0, 10);

  // ── SEALED TIER: encrypt on THIS device before anything leaves ──────────────
  // We compute the card id first (the AAD binds the ciphertext to it), read the
  // author's plaintext locally, encrypt it to the custodian group's threshold
  // public key, write a ciphertext-ONLY artifact, and keep only a content-free
  // sealed block for the card. The plaintext is never uploaded, hosted, or kept.
  let sealedBlock = null;
  let sealedArtifactPath = null;
  if (req.tier.key === 'sealed') {
    const sealed = sealCorpusForRegistration({ req, id, addedAt, cwd });
    if (sealed.error) {
      console.error(`[ERR] Could not seal this corpus: ${sealed.error}`);
      console.error('      Nothing was written. Your corpus text never left your machine.');
      return 1;
    }
    sealedBlock = sealed.cardBlock;
    sealedArtifactPath = sealed.artifactPath;
  }

  const card = buildCorpusCard({
    id,
    name: req.name,
    version: /^\d/.test(version) ? `${version}.0.0`.split('.').slice(0, 3).join('.') : '0.1.0',
    description: req.description || `${req.name} evaluation corpus`,
    pair: req.pair,
    publisher: req.publisher || 'Unattributed (author-registered)',
    sourceUrl: req.sourceUrl,
    repoUrl: req.repoUrl,
    builder: req.builder,
    sha256: args.sha256 || null,
    licenseUrl: args['license-url'] || null,
    licenseOption: req.licenseOption,
    tier: req.tier,
    contaminationRisk: req.contaminationRisk,
    size: req.size,
    domain: req.domain,
    doNotTrain: args['do-not-train'] !== false,
    addedAt,
    sealed: sealedBlock,
  });

  // Resolve destination — local-only NEVER lands in the tracked SSOT.
  const corporaCardsDir = args['cards-dir'] ? path.resolve(cwd, args['cards-dir']) : DEFAULT_CARDS_DIR;
  const localDir = args.out ? path.resolve(cwd, args.out) : cwd;
  const dest = resolveDestination({ tier: req.tier, id, corporaCardsDir, localDir });

  // Guard: a local-only card must never land in the tracked corpora-cards SSOT.
  // path.resolve does NOT follow symlinks and only the exact dir was checked —
  // a symlinked --out (or one nested under the SSOT) slipped past. Resolve real
  // paths and reject anything that IS the SSOT or sits under it. The never-host
  // doctrine is absolute, so this guard must be too.
  const ssotReal = realPathDeep(DEFAULT_CARDS_DIR);
  const targetReal = realPathDeep(dest.dir);
  if (req.tier.key === 'local-only' && isWithin(targetReal, ssotReal)) {
    console.error('[ERR] local-only corpora must not be written into the tracked corpora-cards directory.');
    console.error('      (Symlinks are resolved — a link that points into the SSOT is rejected too.)');
    console.error('      Choose a different --out path, or use --tier private to register metadata.');
    return 1;
  }

  const filePath = path.join(dest.dir, dest.filename);
  if (fs.existsSync(filePath)) {
    console.error(`[ERR] A card already exists at ${filePath}`);
    console.error('      Pick a different --id, or remove the existing card first.');
    return 1;
  }
  fs.mkdirSync(dest.dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');

  // ── Report ──
  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      id,
      exposureTier: req.tier.key,
      registered: dest.registered,
      tracked: dest.tracked,
      uploadedContent: false,
      uploadedPlaintext: false,
      ...(req.tier.key === 'sealed' ? {
        sealed: true,
        sealedArtifactPath,
        ciphertextDigest: sealedBlock.ciphertextDigest,
        cipher: sealedBlock.cipher,
        custodianGroupId: sealedBlock.custodianGroupId,
        qualifierId: sealedBlock.qualifierId,
        qualifierThreshold: sealedBlock.qualifierThreshold,
      } : {}),
      license: card.license,
      path: filePath,
    }, null, 2));
    return 0;
  }

  console.log('');
  output.ok(`${req.tier.key === 'local-only' ? 'Saved' : 'Registered'} corpus card: ${id}`);
  console.log('');
  console.log(`    Exposure:     ${req.tier.label}`);
  console.log(`    License:      ${card.license.spdx}  (commercial: ${card.license.commercial}, redistribution: ${card.license.redistribution})`);
  console.log(`    Pair:         ${req.pair.source}→${req.pair.target}`);
  console.log(`    Size/domain:  ${req.size} ${card.dev.sizeUnit} · ${card.dev.domain}`);
  console.log(`    Contamination: ${card.contamination.risk}`);
  console.log(`    Written to:   ${filePath}`);
  console.log('');

  if (req.tier.key === 'sealed') {
    console.log(`    Sealed artifact: ${sealedArtifactPath}`);
    console.log(`    Cipher:        ${sealedBlock.cipher}`);
    console.log(`    Ciphertext digest: ${sealedBlock.ciphertextDigest}`);
    console.log(`    Custodian group: ${sealedBlock.custodianGroupId}`);
    console.log(`    Qualifier:     ${sealedBlock.qualifierId} (clear ≥ ${sealedBlock.qualifierThreshold} first)`);
    console.log('');
    console.log('  ✓ Your sentences were SCRAMBLED LOCALLY on this machine before anything');
    console.log('    was written. They are NEVER sent or stored in readable form. The only');
    console.log('    artifact produced is ciphertext — Champollion cannot decrypt it, and no');
    console.log('    single party can: it takes M-of-N custodian approval (the threshold key).');
    console.log('');
    console.log('  The card is content-free and quarantined from the public queue/leaderboard.');
    console.log('  A method must first clear the paired PUBLIC qualifier before any sealed run');
    console.log('  can even be proposed — and that run still requires custodian approval.');
  } else if (req.tier.key === 'local-only') {
    console.log('  This card stays on your machine. Nothing was registered or uploaded,');
    console.log('  and your corpus text was never read. Delete the file to remove it.');
  } else if (req.tier.key === 'private') {
    console.log('  Metadata only is registered — your corpus TEXT was never read, uploaded,');
    console.log('  or hosted, and never will be. The set is catalogued but quarantined from');
    console.log('  the public queue/leaderboard (custodian-controlled, WMT-style held-out).');
    console.log('');
    console.log('  Next: rebuild the registry, then evaluate privately:');
    console.log('    npm run generate:registries          # from the repo root (arena)');
    console.log(`    mt-eval run --corpus ${id} --private  # publish scores without exposing text`);
  } else {
    console.log('  A metadata card + fetch-from-source pointer is registered — your corpus');
    console.log('  TEXT is never hosted by Champollion; it is fetched from source on demand.');
    console.log('');
    console.log('  Next: rebuild the registry so the pair enters the public queue:');
    console.log('    npm run generate:registries          # from the repo root (arena)');
  }
  console.log('');
  return 0;
}

function showHelp() {
  console.log(`
  champollion register-corpus — Register a new evaluation corpus

  USAGE
    champollion register-corpus [options]

  DESCRIPTION
    Register a corpus with YOU in control of its license and how far it
    travels. Three exposure tiers, defaulting to the most private. We never
    read, upload, or host your corpus text in ANY tier — only metadata (and,
    for public sets, a pointer to where the data is fetched from).

    Interactive when run in a terminal; fully scriptable with flags (or --yes).

  EXPOSURE TIERS  (--tier, default: local-only)
    local-only   Never registered, never uploaded; card + text stay on your machine.
    private      Register METADATA ONLY — a WMT-style sovereign held-out set;
                 text never uploaded or hosted; you keep custody.
    public       Publish a metadata card + fetch-from-source pointer; text never
                 hosted by us. Requires a redistribution-cleared license (gated).
    sealed       Encrypt the corpus ON YOUR DEVICE under the custodian group's
                 threshold key; we receive ciphertext + a content-free card only
                 and cannot decrypt it. Catalogued + quarantined; paired with a
                 public qualifier a method must clear before any sealed run.

  LICENSES  (--license)
    cc-by-4.0, cc-by-sa-4.0, cc0-1.0, cc-by-nc-4.0, proprietary, other
    (or pass any SPDX id; it is classified through the license gate)

  OPTIONS
    --tier <tier>         Exposure tier (default: local-only). Alias: --exposure
    --license <id>        License key, SPDX id, or list number (see --list)
    --name <text>         Corpus name (required)
    --pair <pair>         Language pair: "eng>crk" (quote it — the shell eats a
                          bare >) or the dash form eng-crk (or --source-lang/--target-lang)
    --publisher <text>    Publisher / your name or org
    --description <text>  One-line description
    --size <n>            Number of sentence pairs (required)
    --domain <text>       Domain: news, conversational, educational, … (required)
    --contamination <lvl> NONE | LOW | MEDIUM | HIGH (default: NONE private / LOW public)
    --repo-url <url>      Public tier: fetch-from-source archive/repo URL
    --source-url <url>    Public tier: canonical project/dataset URL
    --builder <id>        Public tier: builder adapter id (rebuilds from source)
    --seal-input <path>   Sealed tier: local corpus file to encrypt on-device
    --threshold-pubkey <k> Sealed tier: custodian group threshold public key
                          (file path, or inline PEM / base64 DER SPKI, X25519)
    --custodian-group <id> Sealed tier: custodian group id that holds the key
    --seal-out <path>     Sealed tier: where to write the ciphertext artifact
    --qualifier-id <id>   Sealed tier: paired public qualifier card id (vYYYY)
    --qualifier-threshold <n> Sealed tier: score a method must clear on the qualifier
    --key-scheme <s>      Sealed tier: custody scheme label (default: TSS-3-of-5)
    --id <id>             Override the generated card id (eval-…)
    --out <dir>           local-only: where to write the card (default: cwd)
    --list                Print the license + tier catalog (add --json for JSON)
    --json                Machine-readable output (for agents)
    --yes                 Non-interactive; take values from flags

  EXAMPLES
    champollion register-corpus                                   # interactive wizard
    champollion register-corpus --list                           # see licenses + tiers
    # Keep a corpus entirely local (nothing leaves your machine):
    champollion register-corpus --yes --name "My set" --pair "eng>crk" \\
      --license cc-by-4.0 --tier local-only --size 200 --domain news
    # Register a sovereign held-out test set (metadata only, text never uploaded):
    champollion register-corpus --yes --name "Community holdout" --pair "eng>crk" \\
      --license cc-by-nc-4.0 --tier private --size 500 --domain educational
    # Publish a fetch-from-source pointer (gated to redistributable licenses):
    champollion register-corpus --yes --name "Tatoeba eng-crk" --pair "eng-crk" \\
      --license cc-by-4.0 --tier public --size 1000 --domain conversational \\
      --repo-url https://example.org/data.tar --builder tatoeba-challenge
    # Seal a community-controlled secret test set (encrypted ON YOUR DEVICE):
    champollion register-corpus --yes --name "Sealed eng-crk" --pair "eng>crk" \\
      --license proprietary --tier sealed --size 500 --domain educational \\
      --seal-input ./secret-corpus.json --threshold-pubkey ./group.pub \\
      --custodian-group nehiyawewin-trust --seal-out ./sealed.json \\
      --qualifier-id eval-eng-crk-nehiyaw-qualifier-v2026
  `);
}

export { run };
