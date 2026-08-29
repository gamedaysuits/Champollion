/**
 * corpus-registration.mjs — the licensing + exposure logic behind
 * `champollion register-corpus`.
 *
 * This module is the SSOT for two author-facing choices made when a new corpus
 * is registered, and the rules that bind them:
 *
 *   1. LICENSE  — a plain-language picklist (CC-BY / CC-BY-SA / CC0 / CC-BY-NC /
 *      proprietary / other-custom) that also yields the commercial + redistribution
 *      booleans written onto the card's `license` block.
 *   2. EXPOSURE — one of three tiers, defaulting to the most private:
 *        • local-only — never registered, never uploaded; card + text stay on
 *          the author's machine (the card is written OUTSIDE the tracked
 *          corpora-cards directory).
 *        • private    — a WMT-style sovereign held-out / secret test set:
 *          register METADATA ONLY (quarantined), text never uploaded or hosted.
 *        • public     — publish a metadata card + a fetch-from-source pointer;
 *          text never hosted by us. Gated by license-gate.mjs.
 *
 * DOCTRINE (the data-boundaries doctrine): Champollion NEVER hosts or redistributes
 * corpus CONTENT in ANY tier — only metadata cards and fetch-from-source
 * pointers. Every function here is content-free: it produces metadata, never
 * source/reference text. The public tier is gated through the existing
 * license/sovereignty gate (./license-gate.mjs) so NC / no-redistribute /
 * unconfirmed-license sets cannot enter public/commercial/ranked lanes.
 *
 * Pure (no I/O, no process state) so the command layer and the test-suite share
 * exactly one implementation.
 *
 * @module corpus-registration
 */

import { classifyLicense, TIERS } from './license-gate.mjs';

// ---------------------------------------------------------------------------
// LICENSE OPTIONS — the plain-language picklist. `commercial` / `redistribution`
// are the booleans written onto the card's `license` block (the license's plain
// terms for OUR lanes). `publicEligible` is the author-facing hint; the real
// gate is gatePublicRegistration(), which cross-checks license-gate.mjs and
// fails safe to blocked.
// ---------------------------------------------------------------------------
export const LICENSE_OPTIONS = [
  {
    key: 'cc-by-4.0',
    label: 'CC-BY-4.0',
    spdx: 'CC-BY-4.0',
    commercial: true,
    redistribution: true,
    publicEligible: true,
    explanation: 'Anyone may use and share it, even commercially, as long as they credit you.',
  },
  {
    key: 'cc-by-sa-4.0',
    label: 'CC-BY-SA-4.0',
    spdx: 'CC-BY-SA-4.0',
    commercial: true,
    redistribution: true,
    publicEligible: true,
    explanation: 'Like CC-BY, but anything built on it must be shared under the same license (share-alike).',
  },
  {
    key: 'cc0-1.0',
    label: 'CC0 / public domain',
    spdx: 'CC0-1.0',
    commercial: true,
    redistribution: true,
    publicEligible: true,
    explanation: 'Public-domain dedication — no rights reserved. Anyone may do anything; no credit required.',
  },
  {
    key: 'cc-by-nc-4.0',
    label: 'CC-BY-NC-4.0',
    spdx: 'CC-BY-NC-4.0',
    commercial: false,
    redistribution: false,
    publicEligible: false,
    explanation: 'Free for non-commercial use only. Cannot enter the public ranked or commercial lanes — register privately or local-only.',
  },
  {
    key: 'cc-by-nc-sa-4.0',
    label: 'CC-BY-NC-SA-4.0',
    spdx: 'CC-BY-NC-SA-4.0',
    commercial: false,
    redistribution: true,
    publicEligible: false,
    explanation: 'Non-commercial, and anything built on it must be shared the same way. May be shared, but never in a commercial lane.',
  },
  {
    key: 'cc-by-nd-4.0',
    label: 'CC-BY-ND-4.0',
    spdx: 'CC-BY-ND-4.0',
    commercial: true,
    redistribution: true,
    publicEligible: false,
    explanation: 'May be shared verbatim, even commercially, but no modified versions may be distributed. Derivative eval sets are not permitted.',
  },
  // ---- The steward-terms options -----------------------------------------
  // THE MISSING CELL (added 2026-08-13). Every option above couples commercial
  // use to redistribution: a steward who wants to keep control of their corpus
  // could only reach for NC, which excludes the corpus from the commercial
  // lane forever. That forced a false choice between sovereignty and ever
  // being measured for a paying user.
  //
  // These two separate the rights that are genuinely separate. Ownership is
  // never in the picklist because it is never negotiated: the corpus belongs
  // to its steward in every option here.
  {
    key: 'community-eval-grant',
    label: 'Steward terms — evaluation only (commercial evaluation permitted)',
    spdx: 'LicenseRef-Champollion-Eval-Grant',
    commercial: true,
    redistribution: false,
    aiTraining: false,
    publicEligible: false,
    explanation: 'You keep ownership. The corpus is never redistributed, never published, and never used to TRAIN anything — it is used only to score systems, including when someone pays for that scoring. Revocable.',
  },
  {
    key: 'community-eval-grant-nc',
    label: 'Steward terms — evaluation only, non-commercial',
    spdx: 'LicenseRef-Champollion-Eval-Grant-NC',
    commercial: false,
    redistribution: false,
    aiTraining: false,
    publicEligible: false,
    explanation: 'As above, but scoring for paying users is NOT permitted — research and community lanes only. The most conservative grant that still allows measurement.',
  },
  {
    key: 'proprietary',
    label: 'Proprietary / all rights reserved',
    spdx: 'LicenseRef-Proprietary',
    commercial: false,
    redistribution: false,
    publicEligible: false,
    explanation: 'All rights reserved. You keep full control; it cannot be publicly redistributed — register privately or local-only.',
  },
  {
    key: 'other',
    label: 'Other / custom (unconfirmed)',
    spdx: 'LicenseRef-Custom',
    commercial: false,
    redistribution: false,
    publicEligible: false,
    explanation: 'A custom or unconfirmed license. Treated as not-redistributable until confirmed — private or local-only only.',
  },
];

// ---------------------------------------------------------------------------
// EXPOSURE TIERS — chosen explicitly, defaulting to the most private. Note
// `uploadsContent` is false for EVERY tier: we NEVER host or receive plaintext
// corpus content anywhere. The `sealed` tier may produce an encrypted
// (ciphertext-only) artifact — flagged by `uploadsCiphertext`, distinct from
// content: ciphertext is not readable content, and we cannot decrypt it.
// `tracked` = whether the metadata card lands in the tracked corpora-cards SSOT.
// ---------------------------------------------------------------------------
export const EXPOSURE_TIERS = [
  {
    key: 'local-only',
    label: 'Private / local-only',
    registers: false,
    uploadsContent: false,
    uploadsCiphertext: false,
    tracked: false,
    explanation:
      'Never registered, never uploaded. The card and your text stay entirely on your machine. The safe default.',
  },
  {
    key: 'private',
    label: 'Register privately (sovereign held-out)',
    registers: true,
    uploadsContent: false,
    uploadsCiphertext: false,
    tracked: true,
    explanation:
      'Registers METADATA ONLY — a WMT-style secret/held-out test set. Your text is NEVER uploaded or hosted; you keep custody. Results can be published without exposing the data.',
  },
  {
    key: 'public',
    label: 'Register publicly (fetch-from-source)',
    registers: true,
    uploadsContent: false,
    uploadsCiphertext: false,
    tracked: true,
    explanation:
      'Publishes a metadata card + a fetch-from-source pointer. Your text is NEVER hosted by Champollion — it is fetched from the upstream source on demand. Requires a redistribution-cleared license.',
  },
  {
    key: 'sealed',
    label: 'Seal it (community-controlled secret test)',
    registers: true,
    uploadsContent: false,      // NEVER plaintext content
    uploadsCiphertext: true,    // an encrypted, content-free artifact MAY be produced
    tracked: true,
    explanation:
      'Encrypts your corpus ON YOUR DEVICE under the custodian group’s threshold key BEFORE a single byte leaves. Champollion receives ciphertext + a content-free card only and CANNOT decrypt it (no single party can — it takes M-of-N custodians). Catalogued but quarantined; pair it with a public qualifier that methods must clear before any sealed run can be proposed.',
  },
];

/** The most-private tier — the default whenever the author does not choose. */
export const DEFAULT_TIER = 'local-only';

// ---------------------------------------------------------------------------
// Resolvers — turn a flag value (key / label / spdx / 1-based number) into the
// catalogue entry, tolerant enough for both humans and agents.
// ---------------------------------------------------------------------------

/**
 * Resolve a license choice to a normalized option object.
 *
 * Accepts: a catalogue key ('cc-by-4.0'), a label, an SPDX id ('CC-BY-4.0'),
 * a 1-based index ('1'), or ANY other SPDX string (treated as custom and
 * classified through license-gate.mjs). Returns null only for empty input.
 *
 * @param {string} input
 * @returns {object|null} { key, label, spdx, commercial, redistribution, publicEligible, explanation, custom? }
 */
export function resolveLicense(input) {
  if (input === undefined || input === null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const norm = raw.toLowerCase();

  // 1-based numeric index into the picklist
  if (/^\d+$/.test(raw)) {
    const idx = parseInt(raw, 10) - 1;
    if (idx >= 0 && idx < LICENSE_OPTIONS.length) return LICENSE_OPTIONS[idx];
  }

  // Exact match against key / label / spdx (case-insensitive)
  const hit = LICENSE_OPTIONS.find(
    (o) =>
      o.key === norm ||
      o.label.toLowerCase() === norm ||
      o.spdx.toLowerCase() === norm,
  );
  if (hit) return hit;

  // Anything else: a raw SPDX the author typed. Classify it through the gate so
  // a real permissive/share-alike id still works, but unknowns fail safe.
  const cls = classifyLicense({ license_spdx: raw });
  const permissive = cls.tier === TIERS.PERMISSIVE;
  const shareAlike = cls.tier === TIERS.SHAREALIKE;
  return {
    key: 'custom',
    label: raw,
    spdx: raw,
    commercial: permissive || shareAlike,
    redistribution: permissive || shareAlike,
    publicEligible: permissive || shareAlike,
    explanation: `Custom license "${raw}" classified as ${cls.tier} by the license gate.`,
    custom: true,
  };
}

/**
 * Resolve an exposure-tier choice to a tier object. Accepts a key, a label, a
 * 1-based index, or the aliases 'local'/'secret'/'sovereign'. Defaults to the
 * most private tier for empty/unknown input — fail-private.
 *
 * @param {string} input
 * @returns {object} an EXPOSURE_TIERS entry (never null; defaults to local-only)
 */
export function resolveTier(input) {
  const fallback = EXPOSURE_TIERS.find((t) => t.key === DEFAULT_TIER);
  if (input === undefined || input === null) return fallback;
  const raw = String(input).trim();
  if (!raw) return fallback;
  const norm = raw.toLowerCase();

  if (/^\d+$/.test(raw)) {
    const idx = parseInt(raw, 10) - 1;
    if (idx >= 0 && idx < EXPOSURE_TIERS.length) return EXPOSURE_TIERS[idx];
  }

  const aliases = { local: 'local-only', secret: 'private', sovereign: 'private', seal: 'sealed', encrypted: 'sealed' };
  const key = aliases[norm] || norm;
  return EXPOSURE_TIERS.find((t) => t.key === key || t.label.toLowerCase() === norm) || fallback;
}

/**
 * The card-level `license` block derived from a resolved license option.
 * @param {object} option a resolveLicense() result
 * `aiTraining` stays `null` — "not determined by the licence choice" — unless
 * the option states it. Only the steward-terms options do, because they are
 * the only ones where refusing training use is an explicit part of the grant
 * rather than an inference from an SPDX id.
 *
 * @returns {{spdx:string, commercial:boolean, redistribution:boolean, aiTraining:(boolean|null), notes:(string|null)}}
 */
export function deriveLicenseBlock(option) {
  return {
    spdx: option.spdx,
    commercial: option.commercial,
    redistribution: option.redistribution,
    aiTraining: option.aiTraining === undefined ? null : option.aiTraining,
    notes: option.custom ? 'Custom/unconfirmed license — verify terms before any commercial or redistribution use.' : null,
  };
}

/**
 * Express any combination of the three rights, for a steward whose terms do
 * not match a preset.
 *
 * The picklist is presets, not a fence. A steward may permit commercial
 * evaluation while refusing redistribution, or permit redistribution while
 * refusing training, or any other combination — the rights are orthogonal and
 * `license-gate.mjs` has always modelled them that way. What was hemmed in was
 * the *picklist*, not the model.
 *
 * The public tier is deliberately NOT settable here: whether a corpus may be
 * published is decided by gatePublicRegistration(), which re-classifies the
 * SPDX through the licence gate and fails safe. A steward can grant rights;
 * nobody can assert their way past the public gate.
 *
 * @param {object} option a resolveLicense() result to start from
 * @param {object} rights
 * @param {boolean} [rights.commercial]
 * @param {boolean} [rights.redistribution]
 * @param {boolean} [rights.aiTraining]
 * @param {string}  [rights.note] why the steward set these terms
 * @returns {object} a new option; the original is not mutated
 */
export function withStewardTerms(option, rights = {}) {
  if (!option) throw new Error('withStewardTerms requires a resolved license option.');
  const next = { ...option, stewardTerms: true };
  for (const k of ['commercial', 'redistribution', 'aiTraining']) {
    if (typeof rights[k] === 'boolean') next[k] = rights[k];
  }
  // Granting a right never widens the public lane — that stays with the gate.
  next.publicEligible = option.publicEligible === true && next.redistribution === true;
  if (rights.note) next.explanation = rights.note;
  return next;
}

// ---------------------------------------------------------------------------
// THE PUBLIC-REGISTRATION GATE — the one rule that protects the open lane.
// Authoritative: re-classifies the chosen SPDX through license-gate.mjs and
// only admits PERMISSIVE or SHARE-ALIKE licenses to the public tier. NC,
// no-derivatives, no-redistribute, and any unconfirmed/unknown license are
// blocked. Belt-and-suspenders: the picklist hint must ALSO agree (fail-safe).
// ---------------------------------------------------------------------------

/** Tiers a public fetch-from-source pointer is allowed to carry. */
const PUBLIC_OK_TIERS = new Set([TIERS.PERMISSIVE, TIERS.SHAREALIKE]);

/**
 * May a corpus under this license enter the PUBLIC tier (a published
 * fetch-from-source pointer on the open leaderboard)?
 *
 * @param {object} option a resolveLicense() result
 * @returns {{allowed:boolean, tier:string, reason:string}}
 */
export function gatePublicRegistration(option) {
  if (!option) {
    return { allowed: false, tier: TIERS.UNKNOWN, reason: 'No license selected — a confirmed license is required for public registration.' };
  }
  const cls = classifyLicense({
    license_spdx: option.spdx,
    non_commercial_only: option.commercial === false,
    // Only assert redistribution to the classifier when the option says so;
    // unconfirmed options leave it unset so the classifier can fail safe.
    ...(option.redistribution === true ? { allows_redistribution: 1 } : {}),
  });
  const tierOk = PUBLIC_OK_TIERS.has(cls.tier);
  const hintOk = option.publicEligible !== false;
  const allowed = tierOk && hintOk;

  let reason;
  if (allowed) {
    reason =
      cls.tier === TIERS.SHAREALIKE
        ? `Share-alike license (${option.spdx}) — public OK; downstream must share alike.`
        : `Redistribution-cleared license (${option.spdx}) — public OK.`;
  } else if (cls.tier === TIERS.NONCOMMERCIAL) {
    reason = `Non-commercial license (${option.spdx}) — excluded from public/commercial/ranked lanes. Register privately or local-only instead.`;
  } else if (cls.tier === TIERS.NODERIVATIVES || cls.tier === TIERS.RESTRICTED_NOREDIST) {
    reason = `License (${option.spdx}) forbids redistribution/derivatives — cannot publish a public pointer. Register privately or local-only instead.`;
  } else {
    reason = `License (${option.spdx}) is unconfirmed or not redistribution-cleared (gate tier: ${cls.tier}). Register privately or local-only instead.`;
  }
  return { allowed, tier: cls.tier, reason };
}

// ---------------------------------------------------------------------------
// CARD BUILDER — assemble a schema-valid, content-FREE corpora card from the
// author's choices. Never embeds source/reference text; for private/local-only
// it never even names a hosted data file.
// ---------------------------------------------------------------------------

/** kebab-case slug from arbitrary text (for ids). */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Derive a default card id from the pair + a name/publisher slug.
 * Shape mirrors existing cards: eval-<src>-<tgt>-<slug>-dev-v<major>.
 */
export function deriveCardId({ source, target, slug, version = '1' }) {
  const major = String(version).split('.')[0] || '1';
  const tag = slug && slug.length ? slug : 'custom';
  return `eval-${source}-${target}-${tag}-dev-v${major}`;
}

/**
 * Build a corpora card object for a registration.
 *
 * @param {object} o
 * @param {string} o.id
 * @param {string} o.name
 * @param {string} [o.version]
 * @param {string} o.description
 * @param {{source:string,target:string,direction?:string}} o.pair
 * @param {string} o.publisher
 * @param {string|null} [o.sourceUrl]   canonical URL (public tier)
 * @param {string|null} [o.repoUrl]     fetch-from-source upstream (public tier)
 * @param {string|null} [o.builder]     builder adapter id (public tier)
 * @param {string|null} [o.sha256]      built-corpus hash (optional)
 * @param {object} o.licenseOption      a resolveLicense() result
 * @param {object} o.tier               a resolveTier() result
 * @param {string} [o.contaminationRisk]  NONE|LOW|MEDIUM|HIGH
 * @param {string} [o.contaminationReasoning]
 * @param {number} o.size
 * @param {string} [o.sizeUnit]
 * @param {string} o.domain
 * @param {boolean} [o.doNotTrain]
 * @param {string} o.addedAt            ISO date (injected for determinism)
 * @param {string} [o.populatedFrom]
 * @param {object} [o.sealed]           content-free sealed block (sealed tier
 *        only; from seal.buildSealedCardBlock — cipher/custodianGroupId/
 *        ciphertextDigest/aad + key + qualifier refs). NEVER contains text.
 * @returns {object} a corpora card (metadata only — never contains text)
 */
export function buildCorpusCard(o) {
  const tierKey = o.tier.key;
  const isPublic = tierKey === 'public';
  const isSealed = tierKey === 'sealed';
  const license = deriveLicenseBlock(o.licenseOption);

  // Contamination: private/sealed/unpublished data defaults to NONE per the
  // schema's own guidance ("NONE = private/unpublished").
  const risk = o.contaminationRisk || (isPublic ? 'LOW' : 'NONE');
  const reasoning =
    o.contaminationReasoning ||
    (isPublic
      ? 'Author-asserted at registration. Public fetch-from-source corpus; review upstream exposure before relying on this rating.'
      : isSealed
        ? 'Sealed at registration — corpus encrypted client-side under the custodian group’s threshold key; only ciphertext + a content-free card exist on our side, so the plaintext is not present in any training set via this project.'
        : 'Private/unpublished at registration — text never uploaded or hosted, so not present in any training set via this project.');

  // source block — a fetch-from-source pointer ONLY for the public tier.
  const source = {
    publisher: o.publisher,
    url: isPublic ? (o.sourceUrl || o.repoUrl || null) : null,
  };
  if (isPublic) {
    if (o.repoUrl) source.repo_url = o.repoUrl;
    if (o.builder) source.builder = o.builder;
    source.sha256 = o.sha256 || null;
    source.license = license.spdx;
    if (o.licenseUrl) source.license_url = o.licenseUrl;
  }

  // dev block — records the consumer-reports length/size + domain. dataFile
  // (a hosted-content path) is set ONLY for the public tier, where the builder
  // reproduces it from source; private/local-only never name a data file.
  const dev = {
    size: o.size,
    sizeUnit: o.sizeUnit || 'entries',
    domain: o.domain,
  };
  if (isPublic) {
    dev.dataFile = `curated/${o.pair.source}-${o.pair.target}-dev-v1.json`;
    dev.format = 'harness-json';
  }

  const doNotTrain = o.doNotTrain !== false; // default true (benchmark integrity)

  const usageRestrictions = {
    training: doNotTrain ? (license.commercial ? 'discouraged' : 'prohibited-by-license') : 'permitted',
    commercialUse: license.commercial ? 'permitted' : 'prohibited-by-license',
    redistribution: isPublic
      ? (o.licenseOption.spdx.toUpperCase().includes('-SA') ? 'same-terms' : 'permitted')
      : 'prohibited',
    communityNotes: null,
  };

  const card = {
    id: o.id,
    type: 'eval',
    name: o.name,
    version: o.version || '0.1.0',
    pair: {
      source: o.pair.source,
      target: o.pair.target,
      direction: o.pair.direction || 'unidirectional',
    },
    description: o.description,
    source,
    license,
    dev,
    contamination: { risk, reasoning },
    doNotTrain,
    exposureTier: tierKey,
    usageRestrictions,
    _provenance: {
      addedAt: o.addedAt,
      populatedFrom:
        o.populatedFrom ||
        `Registered via 'champollion register-corpus' (exposureTier=${tierKey}). Metadata only — corpus content was never read, uploaded, or hosted.`,
    },
  };

  // Private/sovereign held-out sets are catalogued but never publicly runnable:
  // quarantine keeps them out of the queue + leaderboard while preserving the
  // metadata record (the WMT-style "a secret test set exists" announcement).
  if (tierKey === 'private') {
    card.quarantine = true;
    card.quarantineReason =
      'Private / sovereign held-out set — registered metadata only; corpus content is never uploaded or hosted (exposureTier=private). Custodian-controlled; evaluate with the harness in --private/--scores-only mode.';
  }

  // Sealed sets carry the SAME invariant as private (content-free, quarantined)
  // plus a content-free `sealed` block recording the cipher, custodian group,
  // ciphertext digest, and AAD binding. The plaintext was encrypted client-side
  // and is never present here — only ciphertext (in an off-git store) + this card.
  if (isSealed) {
    card.quarantine = true;
    card.quarantineReason =
      'Sealed / community-controlled secret test set — corpus encrypted client-side under the custodian group’s threshold key (exposureTier=sealed). Only ciphertext + this content-free card exist on our side; no single party can decrypt. Catalogued but never publicly runnable; a sealed run requires M-of-N custodian approval (see the community-custodian multisig plan).';
    if (o.sealed) card.sealed = o.sealed;
  }

  return card;
}

// ---------------------------------------------------------------------------
// Destination resolution — WHERE the card is written. local-only never touches
// the tracked corpora-cards SSOT; private/public land there.
// ---------------------------------------------------------------------------

/**
 * Decide where a card for the chosen tier should be written.
 *
 * @param {object} o
 * @param {object} o.tier              a resolveTier() result
 * @param {string} o.id               card id (filename stem)
 * @param {string} o.corporaCardsDir  absolute path to the tracked corpora-cards dir
 * @param {string} o.localDir         absolute path for local-only output (cwd or --out)
 * @returns {{registered:boolean, tracked:boolean, dir:string, filename:string}}
 */
export function resolveDestination({ tier, id, corporaCardsDir, localDir }) {
  const filename = `${id}.json`;
  if (tier.key === 'local-only') {
    return { registered: false, tracked: false, dir: localDir, filename };
  }
  // private + public — the tracked SSOT
  return { registered: true, tracked: true, dir: corporaCardsDir, filename };
}

/**
 * Validate a registration request. Returns collected, plain-language errors so
 * the command can fail loudly with everything wrong at once.
 *
 * @param {object} o
 * @param {object} o.tier
 * @param {object|null} o.licenseOption
 * @param {{source?:string,target?:string}} o.pair
 * @param {string} o.name
 * @param {string|null} [o.repoUrl]
 * @param {string|null} [o.builder]
 * @param {number|null} [o.size]
 * @param {string} [o.domain]
 * @param {string|null} [o.custodianGroupId]   sealed tier: custodian group id
 * @param {string|null} [o.thresholdPublicKey] sealed tier: threshold pubkey (path/value)
 * @param {string|null} [o.sealInput]          sealed tier: local corpus file to encrypt
 * @param {string|null} [o.qualifierId]        sealed tier: paired public qualifier id
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateRegistration(o) {
  const errors = [];
  if (!o.name || !String(o.name).trim()) errors.push('A corpus name is required (--name).');
  if (!o.pair || !o.pair.source) errors.push('A source language code is required (--pair "src>tgt" or --source-lang).');
  if (!o.pair || !o.pair.target) errors.push('A target language code is required (--pair "src>tgt" or --target-lang).');
  if (!o.licenseOption) errors.push('A license is required (--license). Run with --list to see options.');
  if (!(Number(o.size) > 0)) errors.push('A positive corpus size is required (--size).');
  if (!o.domain || !String(o.domain).trim()) errors.push('A domain is required (--domain), e.g. news, conversational, educational.');

  if (o.tier.key === 'public') {
    if (!o.repoUrl) errors.push('Public registration needs a fetch-from-source pointer (--repo-url) — we never host content.');
    if (!o.builder) errors.push('Public registration needs a builder adapter id (--builder) that rebuilds the corpus from source.');
    if (o.licenseOption) {
      const gate = gatePublicRegistration(o.licenseOption);
      if (!gate.allowed) errors.push(`License gate blocked public registration: ${gate.reason}`);
    }
  }

  if (o.tier.key === 'sealed') {
    if (!o.custodianGroupId) errors.push('Sealed registration needs a custodian group id (--custodian-group) — the community group whose threshold key controls the set.');
    if (!o.thresholdPublicKey) errors.push('Sealed registration needs the custodian group’s threshold public key (--threshold-pubkey) to encrypt to — we never receive a key we could decrypt with.');
    if (!o.sealInput) errors.push('Sealed registration needs the local corpus file to encrypt (--seal-input) — it is sealed on your device and never sent in readable form.');
    if (!o.qualifierId) errors.push('Sealed registration needs a paired public qualifier (--qualifier-id) that methods must clear before any sealed run can be proposed.');
  }
  return { ok: errors.length === 0, errors };
}
