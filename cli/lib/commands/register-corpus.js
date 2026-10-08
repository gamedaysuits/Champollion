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
 * We NEVER upload or host corpus content in ANY tier — only metadata and (for
 * public) a pointer to where the data is fetched from. This command writes a
 * metadata card. A file it is given is read on this machine only: --data to
 * count its entries and compute its sha256, --seal-input (sealed tier) to
 * encrypt it. Nothing it reads is copied, uploaded or sent anywhere.
 *
 * Interactive wizard when stdin is a TTY; fully scriptable via flags otherwise
 * (or with --yes). See `champollion network register-corpus --help`.
 *
 * Exit codes: 0 = registered/saved (or cancelled); 1 = invalid request / gate block.
 */

import crypto from 'node:crypto';
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
  deriveIdSlug,
  normalizeRole,
  CORPUS_ROLES,
  CARD_ID_PATTERN,
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
import { getLanguageCard } from '../registers.js';
import { findPublicCorporaBySha } from '../public-catalogue.js';
import { parseLanguagePair, formatLanguagePair } from '../language-pair.js';
import { showCommandHelp } from '../command-help.js';

/** A word as a POSIX shell reads it back exactly (quoted only when it must be). */
function shellQuote(word) {
  const w = String(word);
  return /^[A-Za-z0-9_.:/@%+=,-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`;
}

/**
 * The language flags of the `mt-eval run` hint, filled from the card's pair
 * (Round 7, hospital persona: the hint printed <src>/<tgt> although the card
 * it had just written holds the pair). mt-eval's --source-lang/--target-lang
 * are the NAMES the model is told (from the language card, else the
 * project's own "name" for the code in champollion.config.json — a
 * private-use code such as qaa has no card); --source-code/--target-lang-code
 * are the codes the run is recorded under (--target-lang-code is mt-eval's
 * documented spelling — --target-code is its alias, Round 12).
 *
 * @returns {{ flags: string, unnamed: string[], cardless: string[], names: Object<string, string|null> }}
 *   unnamed: codes with no name anywhere (the hint says to put the language's
 *   name in their flag); cardless: codes with no language card (nmt-forge init
 *   needs --no-card for them); names: the name found for each code, or null
 */
function languageFlags(pair, cwd) {
  let projectNames = {};
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'champollion.config.json'), 'utf-8'));
    if (cfg && cfg.languages && typeof cfg.languages === 'object' && !Array.isArray(cfg.languages)) {
      for (const [code, v] of Object.entries(cfg.languages)) if (v && typeof v.name === 'string') projectNames[code] = v.name;
    }
  } catch { projectNames = {}; }
  const unnamed = [];
  const cardless = [];
  const names = {};
  const nameOf = (code) => {
    let card = null;
    try { card = getLanguageCard(code); } catch { card = null; }
    if (!card) cardless.push(code);
    const name = (card && typeof card.name === 'string' && card.name) || projectNames[code] || null;
    if (!name) unnamed.push(code);
    names[code] = name;
    return name || code;
  };
  const flags = `--source-lang ${shellQuote(nameOf(pair.source))} --target-lang ${shellQuote(nameOf(pair.target))} `
    + `--source-code ${shellQuote(pair.source)} --target-lang-code ${shellQuote(pair.target)}`;
  return { flags, unnamed, cardless, names };
}

/**
 * Would someone train a model against this set? Then its first score must come
 * AFTER nmt-forge has registered it and the predictions are written down.
 * A test set — stated with --role test, or a local-only / private set whose
 * role was not stated (the tiers a community's own held-out set uses) — may be
 * trained against; a dev or train set is not what forge's predictions are
 * judged on.
 */
function mayBeTrainedAgainst(req) {
  if (req.role === 'test') return true;
  if (req.role) return false;
  return req.tier.key === 'local-only' || req.tier.key === 'private';
}

/**
 * The nmt-forge project already set up for this pair: this directory, or one
 * folder below it, that holds a forge workspace (.forge/) and a config.json
 * for the same source and target. Exactly one such folder, or null — with
 * none (or several) the hint starts a new one with `nmt-forge init`.
 */
function findForgeProject(cwd, pair) {
  const candidates = [cwd];
  let entries = [];
  try { entries = fs.readdirSync(cwd, { withFileTypes: true }); } catch { entries = []; }
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') candidates.push(path.join(cwd, e.name));
  }
  const matches = candidates.filter((dir) => {
    if (!fs.existsSync(path.join(dir, '.forge'))) return false;
    let lang;
    try { lang = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'))?.language; } catch { return false; }
    return !!lang && lang.source === pair.source && lang.target === pair.target;
  });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * What an existing forge project already knows about this file: the name it
 * is registered under (matched by sha256 — forge hashes the file's bytes, as
 * describeDataFile does), the preregistrations bound to it, and the set names
 * taken by other files.
 */
function forgeKnows(projectDir, sha256) {
  let sets = {};
  try {
    sets = JSON.parse(fs.readFileSync(path.join(projectDir, '.forge', 'eval-registry.json'), 'utf-8'))?.sets || {};
  } catch { sets = {}; } // no registry yet: nothing is registered
  const name = sha256 ? (Object.entries(sets).find(([, e]) => e && e.sha256 === sha256) || [null])[0] : null;
  const preregs = [];
  const preregIds = new Set();
  const dir = path.join(projectDir, '.forge', 'preregistrations');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { files = []; } // none written yet
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    preregIds.add(id);
    try {
      const pr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (sha256 && pr?.eval_set?.sha256 === sha256) preregs.push(pr.id || id);
    } catch { /* not a preregistration forge wrote: its id is still taken */ }
  }
  return { name, preregs, preregIds, taken: new Set(Object.keys(sets)) };
}

/**
 * The nmt-forge steps that must come before ANY score of a test set a model
 * may be trained against — the build-MT guide's "register, screen, predict"
 * (Round 10, Cree-school persona: the "Next:" line went straight to
 * `mt-eval run`, a scoring read, and forge then refuses the predictions).
 * Paths are written from inside the forge project, where forge runs. An
 * existing project is read first, so no printed step is one forge refuses:
 * a file it already holds keeps its name, and `project-test` is not reused
 * for a different file.
 *
 * @returns {{lines: string[], done: boolean}} done: the file is registered
 *   and has predictions bound to it — the baseline can run now
 */
function forgeFirstLines({ pair, dataFile, sha256, cardId, cwd, lang }) {
  const existing = findForgeProject(cwd, pair);
  const projectDir = existing || path.join(cwd, `${pair.target}-model`);
  const rel = path.relative(cwd, projectDir);
  const where = rel || '.';
  const known = existing ? forgeKnows(projectDir, sha256) : { name: null, preregs: [], preregIds: new Set(), taken: new Set() };
  if (known.name && known.preregs.length > 0) {
    return {
      done: true,
      lines: [
        `  nmt-forge already holds this file (as ${known.name}, in ${where}) with predictions written`,
        `  down before any score (${known.preregs.join(', ')}). \`nmt-forge status\` there names the next step.`,
      ],
    };
  }
  const setName = known.name || (known.taken.has('project-test') ? cardId : 'project-test');
  // forge refuses a prereg id that exists ("the old one stands as history").
  let preregId = 'all-data';
  for (let n = 2; known.preregIds.has(preregId); n += 1) preregId = `all-data-${n}`;
  // …and `prereg template --out` will not overwrite a predictions file.
  let predictions = preregId === 'all-data' ? 'predictions.json' : `predictions-${preregId}.json`;
  for (let n = 2; existing && fs.existsSync(path.join(projectDir, predictions)); n += 1) predictions = `predictions-${preregId}-${n}.json`;
  const testFile = dataFile ? shellQuote(path.relative(projectDir, dataFile)) : '<your test file>';
  const lines = [
    `  Training a model for ${formatLanguagePair(pair)}? Do this first, before anything scores this file.`,
    '  A benchmark is a scoring read, and nmt-forge refuses predictions written after one:',
  ];
  if (!existing) {
    const noCard = lang.cardless.includes(pair.target)
      ? ` --no-card --name ${lang.names[pair.target] ? shellQuote(lang.names[pair.target]) : "'<the language name>'"}`
      : '';
    lines.push(`    nmt-forge init ${shellQuote(pair.target)} --dir ${shellQuote(rel)}${noCard}   # once: the training project (any folder name)`);
  }
  if (rel) lines.push(`    cd ${shellQuote(rel)}`);
  if (known.name) {
    lines.push(`    # already registered with nmt-forge as ${known.name}`);
  } else {
    lines.push(`    nmt-forge registry add ${shellQuote(setName)} ${testFile} --role test`);
  }
  lines.push('    nmt-forge leak-audit <training corpus> --clean-to corpus.clean.jsonl');
  lines.push(`    nmt-forge prereg template --out ${predictions}   # then edit it: what you expect, and why`);
  lines.push(`    nmt-forge prereg new ${preregId} --eval-set ${shellQuote(setName)} --predictions ${predictions}`);
  if (rel) lines.push('    cd ..');
  lines.push('    (One prediction file per model you plan to train, each named after it — leak-audit\'s');
  lines.push('    verdict may call for a second, twin-free model.)');
  return { lines, done: false };
}

/** The model for a local run: the project's own when it runs `local`, else a placeholder. */
function localModelFor(cwd) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'champollion.config.json'), 'utf-8'));
    if (cfg?.defaultMethod === 'local' && typeof cfg.model === 'string' && cfg.model) return cfg.model;
  } catch { /* no project config here */ }
  return null;
}

// Tracked corpora-cards SSOT, resolved relative to this module.
const DEFAULT_CARDS_DIR = fileURLToPath(new URL('../../shared/corpora-cards/', import.meta.url));

const CONTAMINATION_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
// Written (never typed): the file could not be compared with the public
// corpora and no grade was stated — see the contamination block in run().
const CONTAMINATION_UNCHECKED = 'UNCHECKED';

// The steward sidecar the harness reads next to a corpus file
// (mt_eval_harness.corpus_loader.SIDECAR_SUFFIX — keep the two in step).
const SIDECAR_SUFFIX = '.champollion.json';

/**
 * Read the local data file a registration describes: its sha256 and how many
 * sentence pairs it holds (TSV/text: non-empty lines that are not '# '
 * comments; JSONL: non-empty lines; JSON: entries). The text itself is read
 * only to hash and count it — it is never copied, uploaded or stored.
 */
function describeDataFile(file) {
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const text = bytes.toString('utf-8').replace(/^\uFEFF/, '');
  let rows;
  if (file.endsWith('.json')) {
    const data = JSON.parse(text);
    rows = Array.isArray(data) ? data.length
      : Array.isArray(data?.entries) ? data.entries.length : 0;
  } else {
    rows = text.split('\n')
      .map((l) => l.replace(/\r$/, ''))
      .filter((l) => l.trim() && !/^#(\s|$)/.test(l)).length;
  }
  return { sha256, rows };
}

/**
 * The public corpus a file is a byte-identical copy of, from the corpora
 * cards this CLI can see (each pins its built corpus's sha256, and the
 * upstream archive's) — or null. A private, local-only or sealed card claims
 * text no model has seen; a file the cards show is public cannot claim that
 * (Round 8, researcher persona: a copy of the public Tatoeba eng→sme set was
 * graded "Contamination: NONE", caught only later by `contest prepare`).
 *
 * @param {string} sha256
 * @param {string} cardsDir
 * @returns {{ id: string, name: string, license: string|null, risk: string|null }|null}
 */
function findPublicCopy(sha256, cardsDir) {
  let files;
  try { files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json')); } catch { return null; }
  for (const f of files) {
    let card;
    try { card = JSON.parse(fs.readFileSync(path.join(cardsDir, f), 'utf-8')); } catch { continue; }
    const src = card?.source || {};
    const tier = card?.exposureTier || (src.repo_url || src.url ? 'public' : null);
    if (tier && tier !== 'public') continue;
    if (src.sha256 === sha256 || src.archive_sha256 === sha256) {
      return { id: card.id || f.replace(/\.json$/, ''), name: card.name || card.id, license: card.license?.spdx || src.license || null, risk: card.contamination?.risk || null };
    }
  }
  return null;
}

/**
 * Write (or update) the sidecar next to the data file so `mt-eval run
 * --corpus <file>` knows what this registration said: its id, licence and
 * checksum — and, for local-only, that no outside service may see it. The
 * harness lets a sidecar only TIGHTEN what it does, and this never loosens an
 * existing one: a file already marked local-only stays local-only.
 */
function readSidecar(file) {
  const sidecar = file + SIDECAR_SUFFIX;
  if (!fs.existsSync(sidecar)) return {};
  try {
    return JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
  } catch (e) {
    throw new Error(`${sidecar} exists but is not valid JSON (${e.message}). `
      + 'Fix or remove it — it states how this corpus may be used.');
  }
}

function writeSidecar(file, fields) {
  const sidecar = file + SIDECAR_SUFFIX;
  const existing = readSidecar(file);
  const merged = { ...existing, ...fields };
  if (existing.transmission === 'local-only') merged.transmission = 'local-only';
  fs.writeFileSync(sidecar, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return { path: sidecar, transmission: merged.transmission || null };
}

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

function ask(rl, question, defaultValue, shownDefault = defaultValue) {
  return new Promise((resolve) => {
    // shownDefault: what Enter means, shown in the prompt — the caller may
    // want to tell Enter apart from a typed value (defaultValue '').
    const suffix = shownDefault ? ` (${shownDefault})` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Read --pair (any spelling lib/language-pair.js accepts: eng>crk, eng-crk,
 * eng:crk, …). Codes are lower-cased: they name the card id, which is
 * lower-case. The old reader split on every - and > and kept the first two
 * pieces, so "eng>pt-BR" was registered as eng→pt without a word.
 *
 * @returns {{pair: {source: string, target: string}|null, pairError: string|null}}
 */
function readPair(value) {
  if (value === undefined || value === null || value === '') return { pair: null, pairError: null };
  const p = parseLanguagePair(value, { label: '--pair' });
  if (!p.ok) return { pair: null, pairError: p.error };
  return { pair: { source: p.source.toLowerCase(), target: p.target.toLowerCase() }, pairError: null };
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
  // The id beside each label is what --license / --tier take (Round 8,
  // school + hospital personas: the list showed numbered labels only).
  console.log('');
  console.log('  LICENSES — pick the terms others may use your corpus under (pass the id to --license):');
  console.log('');
  LICENSE_OPTIONS.forEach((o, i) => {
    console.log(`    ${i + 1}. ${o.key.padEnd(24)} ${o.label}`);
    console.log(`       ${o.explanation}`);
    console.log(`       commercial: ${o.commercial} · redistribution: ${o.redistribution} · public-lane: ${o.publicEligible ? 'eligible' : 'blocked'}`);
  });
  console.log('');
  console.log('    --license also takes the list number, or an SPDX id (e.g. --license CC-BY-4.0).');
  console.log('');
  console.log('  EXPOSURE TIERS — how far your corpus travels (default: most private; pass the id to --tier):');
  console.log('');
  EXPOSURE_TIERS.forEach((t, i) => {
    const def = t.key === DEFAULT_TIER ? '  ★ default' : '';
    console.log(`    ${i + 1}. ${t.key.padEnd(11)} ${t.label}${def}`);
    console.log(`       ${t.explanation}`);
  });
  console.log('');
  console.log('  Champollion never uploads or hosts your corpus text — in ANY tier. With --data, the');
  console.log('  file is read on this machine only to count and checksum it; none of it leaves.');
  console.log('');
}

// ── Interactive wizard ──────────────────────────────────────────────────────

async function runInteractive(rl, args) {
  console.log('');
  console.log('  champollion — Register a Corpus');
  console.log('  ════════════════════════════════════════════════');
  console.log('');
  console.log('  You choose the license and how far this corpus travels.');
  console.log('  We never upload or host your text — only metadata, and (for public');
  console.log('  sets) a pointer to where the data is fetched from. A file you name');
  console.log('  is read on this machine only: --data to count and checksum it, and');
  console.log('  a sealed set\'s file to encrypt it.');

  // Step 1 — basics
  console.log('');
  console.log('  Step 1/4 — Basics');
  console.log('  ────────────────────────────────────────────────');
  const name = await ask(rl, 'Corpus name', args.name || '');
  // Asked again until it reads as a pair (or is left blank — validation then
  // says a pair is required): an unreadable pair is said here, not at the end.
  let pair = null;
  let pairError = null;
  for (let pairIn = args.pair || ''; ;) {
    const pairStr = await ask(rl, 'Language pair, source>target (e.g. eng>crk — eng-crk works too)', pairIn);
    ({ pair, pairError } = readPair(pairStr));
    if (!pairError) break;
    console.log(`  ⚠  ${pairError}`);
    pairIn = '';
  }
  const publisher = await ask(rl, 'Publisher / your name or org', args.publisher || '');
  const description = await ask(rl, 'One-line description', args.description || `${name} evaluation corpus`);
  const role = normalizeRole(await ask(rl,
    `What is it for — ${CORPUS_ROLES.join(', ')}? (blank: don't say; the id then names no role)`,
    normalizeRole(args.role) || ''));

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

  // Sealed tier — encrypt on this device; the ciphertext stays local, we get a content-free card.
  let custodianGroupId = args['custodian-group'] || null;
  let thresholdPubkey = args['threshold-pubkey'] || null;
  let sealInput = args['seal-input'] || null;
  let sealOut = args['seal-out'] || null;
  let qualifierId = args['qualifier-id'] || null;
  let qualifierThreshold = args['qualifier-threshold'] != null ? Number(args['qualifier-threshold']) : null;
  const keyScheme = args['key-scheme'] || null;
  if (tier.key === 'sealed') {
    console.log('');
    console.log('  Sealed sets are encrypted ON THIS DEVICE, and the ciphertext stays');
    console.log('  where you write it. We receive only a content-free card.');
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
  // Typed, or the default accepted? A typed grade is a statement; the default
  // is not, and gives way to UNCHECKED when the file cannot be compared.
  const riskTyped = (await ask(rl, 'Contamination risk', '', defaultRisk)).toUpperCase();
  const contaminationStated = CONTAMINATION_LEVELS.includes(riskTyped);
  const contaminationRisk = contaminationStated ? riskTyped : defaultRisk;

  return {
    name, pair, publisher, description, role,
    licenseOption, tier,
    repoUrl, builder, sourceUrl,
    size: Number(sizeStr), domain, contaminationRisk, contaminationStated,
    custodianGroupId, thresholdPubkey, sealInput, sealOut,
    qualifierId, qualifierThreshold, keyScheme,
  };
}

// ── Non-interactive (flags) ─────────────────────────────────────────────────

function fromFlags(args) {
  const read = args.pair !== undefined ? readPair(args.pair) : { pair: null, pairError: null };
  const pairError = read.pairError;
  const pair = read.pair ||
    (!pairError && args['source-lang'] && args['target-lang']
      ? { source: String(args['source-lang']).toLowerCase(), target: String(args['target-lang']).toLowerCase() }
      : null);
  const licenseOption = resolveLicense(args.license);
  const tier = resolveTier(args.tier || args.exposure);
  const riskIn = args.contamination ? String(args.contamination).toUpperCase() : null;
  return {
    name: args.name || '',
    pair,
    pairError,
    publisher: args.publisher || '',
    description: args.description || (args.name ? `${args.name} evaluation corpus` : ''),
    role: args.role === true ? true : normalizeRole(args.role), // bare --role: validation says it needs a value
    licenseOption,
    tier,
    repoUrl: args['repo-url'] || null,
    builder: args.builder || null,
    sourceUrl: args['source-url'] || null,
    size: args.size != null ? Number(args.size) : NaN,
    domain: args.domain || '',
    contaminationRisk: riskIn && CONTAMINATION_LEVELS.includes(riskIn) ? riskIn : null,
    // A grade you passed is your statement; it stands even when the file
    // could not be compared with the public corpora.
    contaminationStated: !!(riskIn && CONTAMINATION_LEVELS.includes(riskIn)),
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

  // --data: the local file this registration describes. Hashed and counted
  // here (never copied or uploaded) so the card carries its checksum and the
  // harness can find what was registered, through the sidecar written below.
  let dataFile = null;
  let dataInfo = null;
  if (args.data) {
    dataFile = path.resolve(cwd, String(args.data));
    if (!fs.existsSync(dataFile) || !fs.statSync(dataFile).isFile()) {
      console.error(`[ERR] --data: no such file: ${dataFile}`);
      return 1;
    }
    if (req.tier && (req.tier.key === 'public' || req.tier.key === 'sealed')) {
      console.error(`[ERR] --data is for local-only and private corpora. A ${req.tier.key} corpus is `
        + (req.tier.key === 'public' ? 'fetched from its source (--repo-url / --builder).'
          : 'encrypted from --seal-input.'));
      return 1;
    }
    try {
      dataInfo = describeDataFile(dataFile);
    } catch (e) {
      console.error(`[ERR] --data: could not read ${dataFile}: ${e.message}`);
      return 1;
    }
    if (!Number.isFinite(req.size) || req.size <= 0) req.size = dataInfo.rows;
  }

  // A private / local-only / sealed registration of text that is public: never
  // graded "Contamination: NONE". Compared with the corpora cards this CLI can
  // see (a repo checkout), else — an npm install ships none — with the public
  // corpus catalogue (lib/public-catalogue.js; only the public ids and
  // checksums are downloaded, the file's own sha256 stays here). When neither
  // can be read, the comparison was not made, and the grade says so
  // (UNCHECKED) unless you state one with --contamination (Round 9,
  // researcher persona: an npm install graded a byte-identical copy of a
  // public benchmark NONE because it had nothing to compare with).
  {
    const cardsDir = args['cards-dir'] ? path.resolve(cwd, args['cards-dir']) : DEFAULT_CARDS_DIR;
    const checked = [];
    if (dataInfo) checked.push({ flag: '--data', file: dataFile, sha256: dataInfo.sha256 });
    if (req.tier && req.tier.key === 'sealed' && req.sealInput) {
      try {
        const plain = path.resolve(cwd, String(req.sealInput));
        checked.push({ flag: '--seal-input', file: plain, sha256: crypto.createHash('sha256').update(fs.readFileSync(plain)).digest('hex') });
      } catch { /* the sealing step names an unreadable file */ }
    }
    if (checked.length > 0 && req.tier && req.tier.key !== 'public') {
      let lookup;
      if (fs.existsSync(cardsDir)) {
        lookup = { ok: true, where: 'the corpora cards', find: (sha) => findPublicCopy(sha, cardsDir) };
      } else {
        const cat = await findPublicCorporaBySha(checked.map(c => c.sha256));
        lookup = cat.ok
          ? { ok: true, where: `the public corpus catalogue (${cat.compared} checksums)`, find: (sha) => (cat.hits.has(sha) ? { ...cat.hits.get(sha), risk: null } : null) }
          : { ok: false, why: `this install ships no corpora cards, and ${cat.why}` };
      }
      if (!lookup.ok) {
        // Not compared. NONE claims text no model has seen — it is never the
        // default for a comparison that was not made.
        const shown = checked.map(c => path.relative(cwd, c.file) || c.file).join(', ');
        req.contaminationNote = `not compared with the public corpora — ${lookup.why}`;
        if (req.contaminationStated) {
          req.contaminationReasoning = `Stated at registration (${req.contaminationRisk}); ${shown} was not compared with the public corpora (${lookup.why}).`;
        } else {
          req.contaminationRisk = CONTAMINATION_UNCHECKED;
          req.contaminationReasoning = `Not graded: ${shown} could not be compared with the public corpora at registration (${lookup.why}). `
            + 'Re-register online to compare it, or state a grade with --contamination none|low|medium|high.';
        }
      } else {
        req.contaminationCompared = lookup.where;
        for (const c of checked) {
          const hit = lookup.find(c.sha256);
          if (!hit) continue;
          const shown = path.relative(cwd, c.file) || c.file;
          const why = `${shown} is a byte-identical copy of the public corpus ${hit.id} (${hit.name}${hit.license ? `, ${hit.license}` : ''}; same sha256 ${c.sha256.slice(0, 12)}…, found in ${lookup.where}).`;
          if (req.tier.key === 'sealed') {
            console.error(`[ERR] ${why}`);
            console.error('      A sealed test set is text no model has seen; this text is public, so sealing it tests nothing.');
            console.error(`      Register it as public instead (--tier public, fetched from its source — ${hit.id} already is), or seal sentences that are genuinely private.`);
            return 1;
          }
          if (!req.contaminationRisk || req.contaminationRisk === 'NONE') {
            console.error(`[ERR] ${why}`);
            console.error(`      A ${req.tier.key} card would say "Contamination: NONE" (text no model has seen); this text is public${hit.risk ? ` — the public card rates it ${hit.risk}` : ''}.`);
            console.error(`      Register it as public (--tier public — ${hit.id} already describes it), use sentences that are genuinely private,`);
            console.error(`      or keep it ${req.tier.key} and state its exposure: --contamination ${hit.risk && hit.risk !== 'NONE' ? hit.risk : 'MEDIUM'}.`);
            return 1;
          }
          req.contaminationReasoning = `${why} Registered ${req.tier.key} with the stated risk ${req.contaminationRisk}; the text itself is public.`;
        }
      }
    }
  }

  // Validate (collects every problem, fails loud).
  const v = validateRegistration({
    tier: req.tier,
    licenseOption: req.licenseOption,
    pair: req.pair || {},
    pairError: req.pairError || null,
    name: req.name,
    repoUrl: req.repoUrl,
    builder: req.builder,
    size: req.size,
    domain: req.domain,
    role: req.role,
    custodianGroupId: req.custodianGroupId,
    thresholdPublicKey: req.thresholdPubkey,
    sealInput: req.sealInput,
    qualifierId: req.qualifierId,
  });
  if (!v.ok) {
    console.error('[ERR] Cannot register this corpus:');
    for (const e of v.errors) console.error(`      • ${e}`);
    console.error('');
    console.error('      Run "champollion network register-corpus --list" to see licenses + tiers,');
    console.error('      or "champollion network register-corpus --help" for all flags.');
    return 1;
  }

  // Build the (content-free) card.
  // The id: a full --id (eval-…/ref-…) is used exactly as given; otherwise it
  // is derived from --name (publisher only as a fallback), with a role segment
  // only when --role states one. See deriveCardId.
  const version = args.version || '1';
  let id;
  if (args.id && /^(ref|eval)-/.test(args.id)) {
    id = String(args.id);
    if (!CARD_ID_PATTERN.test(id)) {
      console.error(`[ERR] --id '${id}' is not a valid card id: after eval- or ref-, use only`);
      console.error('      lower-case letters, digits and hyphens (it is also the card filename).');
      return 1;
    }
    if (req.role && !new RegExp(`-${req.role}(-|$)`).test(id)) {
      console.error(`[ERR] --role ${req.role} shapes a generated id, but --id is used exactly as given`);
      console.error(`      and '${id}' does not name that role. Put the role in --id, or drop --role.`);
      return 1;
    }
  } else {
    const slug = (args.id && slugify(args.id)) || deriveIdSlug({ name: req.name, publisher: req.publisher });
    id = deriveCardId({ source: req.pair.source, target: req.pair.target, slug, role: req.role, version });
  }

  // A data file that is already registered keeps its id. Its sidecar records
  // the id it was registered under; deriving a fresh one on a re-run would
  // silently relink the file to a second card. Ids are never re-derived.
  // A file already marked local-only stays local-only (writeSidecar never
  // loosens a mark), and its card says so too.
  let priorTransmission = null;
  if (dataFile) {
    let priorSidecar;
    try {
      priorSidecar = readSidecar(dataFile);
    } catch (e) {
      console.error(`[ERR] ${e.message}`);
      return 1;
    }
    if (priorSidecar.transmission === 'local-only') priorTransmission = 'local-only';
    if (priorSidecar.id && priorSidecar.id !== id && !args.id) {
      const shown = path.relative(cwd, dataFile) || dataFile;
      console.error(`[ERR] ${shown} is already registered as ${priorSidecar.id}`);
      console.error(`      (recorded in ${path.basename(dataFile)}${SIDECAR_SUFFIX}). A registered id is never re-derived.`);
      console.error(`      To keep it, add:                       --id ${priorSidecar.id}`);
      console.error(`      To register the file under a new id:   --id ${id}`);
      return 1;
    }
  }

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
    ...(req.contaminationReasoning && { contaminationReasoning: req.contaminationReasoning }),
    role: req.role || null,
    dataRead: !!dataInfo,
    size: req.size,
    domain: req.domain,
    doNotTrain: args['do-not-train'] !== false,
    transmission: priorTransmission,
    addedAt,
    sealed: sealedBlock,
  });

  // Resolve destination — local-only NEVER lands in the tracked SSOT.
  const corporaCardsDir = args['cards-dir'] ? path.resolve(cwd, args['cards-dir']) : DEFAULT_CARDS_DIR;
  const localDir = args.out ? path.resolve(cwd, args.out) : (dataFile ? path.dirname(dataFile) : cwd);
  // An npm install ships no corpora-cards directory (it is the monorepo's
  // tracked SSOT). Writing a "registered" card into node_modules put it where
  // nothing reads it and the next reinstall deletes it. From an install, the
  // card stays with you, and listing it is a review-gated submission.
  const installMode = !args['cards-dir'] && !fs.existsSync(DEFAULT_CARDS_DIR);
  const dest = installMode && req.tier.key !== 'local-only'
    ? { registered: false, tracked: false, dir: localDir, filename: `${id}.json` }
    : resolveDestination({ tier: req.tier, id, corporaCardsDir, localDir });

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

  let sidecar = null;
  if (dataFile) {
    try {
      sidecar = writeSidecar(dataFile, {
        id,
        name: req.name,
        license: card.license.spdx,
        tier: req.tier.key,
        sha256: dataInfo.sha256,
        rows: dataInfo.rows,
        card: path.relative(path.dirname(dataFile), filePath) || path.basename(filePath),
        registeredAt: addedAt,
        ...(req.tier.key === 'local-only' ? { transmission: 'local-only' } : {}),
      });
    } catch (e) {
      console.error(`[ERR] ${e.message}`);
      return 1;
    }
  }

  // ── Report ──
  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      id,
      role: req.role || null,
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
      contamination: {
        risk: card.contamination.risk,
        // Where the file was compared with the public corpora (null: it could not be).
        comparedWith: req.contaminationCompared || null,
        ...(req.contaminationNote && { note: req.contaminationNote }),
      },
      path: filePath,
      ...(sidecar ? {
        data: dataFile,
        dataSha256: dataInfo.sha256,
        rows: dataInfo.rows,
        sidecar: sidecar.path,
        transmission: sidecar.transmission,
      } : {}),
      ...(installMode && req.tier.key !== 'local-only' ? {
        listed: false,
        toList: 'champollion network submit --type dataset',
      } : {}),
    }, null, 2));
    return 0;
  }

  console.log('');
  output.ok(`${req.tier.key === 'local-only' ? 'Saved' : 'Registered'} corpus card: ${id}`);
  console.log('');
  console.log(`    Exposure:     ${req.tier.label}`);
  console.log(`    Role:         ${req.role || 'not stated (add --role test|dev|train to say what it is for)'}`);
  // Each term once, as the card states it (Round 14, researcher persona:
  // the card and this summary disagreed). The licence's terms; training
  // (doNotTrain); the transmission mark — a separate field, not a licence term.
  const yesNo = (b) => (b ? 'yes' : 'no');
  const custom = card.license.notes ? ' (custom/unconfirmed — verify its terms)' : '';
  const redistributed = { permitted: 'yes', 'same-terms': 'yes, under the same terms', prohibited: 'no' }[card.usageRestrictions.redistribution];
  console.log(`    License:      ${card.license.spdx}${custom} — commercial use ${yesNo(card.license.commercial)}, redistribution ${redistributed}`);
  console.log(`    Training:     ${card.doNotTrain
    ? `not permitted — doNotTrain: true (${card.usageRestrictions.training === 'prohibited-by-license' ? 'the licence refuses training' : 'set at registration: a test set is not trained on'})`
    : 'permitted — doNotTrain: false'}`);
  if (card.transmission === 'local-only') {
    console.log('    Transmission: local-only — only a model on this machine may see it (a mark, not a licence term)');
  }
  console.log(`    Pair:         ${formatLanguagePair(req.pair)}`);
  const splitBlock = card.test || card.dev;
  console.log(`    Size/domain:  ${req.size} ${splitBlock.sizeUnit} · ${splitBlock.domain}${card.test ? ' (test split)' : ''}`);
  let contaminationAside = '';
  if (card.contamination.risk === CONTAMINATION_UNCHECKED) {
    contaminationAside = `  (${req.contaminationNote}. Not graded NONE: that would claim the text is unpublished. `
      + 'Re-run online to compare it, or state a grade: --contamination none|low|medium|high)';
  } else if (req.contaminationNote) {
    contaminationAside = `  (${req.contaminationNote} — the grade is your statement)`;
  } else if (req.contaminationCompared && !req.contaminationReasoning) {
    contaminationAside = `  (compared with ${req.contaminationCompared}: no public copy of this file — the grade is your statement)`;
  }
  console.log(`    Contamination: ${card.contamination.risk}${contaminationAside}`);
  console.log(`    Written to:   ${filePath}`);
  if (sidecar) {
    console.log(`    Data file:    ${dataFile}  (${dataInfo.rows} rows, sha256 ${dataInfo.sha256.slice(0, 12)}…)`);
    console.log(`    Sidecar:      ${sidecar.path}`
      + (sidecar.transmission === 'local-only' ? '  (carries the local-only mark the tools read)' : ''));
  }
  console.log('');
  const runTarget = dataFile ? shellQuote(path.relative(cwd, dataFile) || dataFile) : '<your file>';
  const lang = languageFlags(req.pair, cwd);
  const unnamedNote = lang.unnamed.length > 0
    ? `    (${lang.unnamed.join(', ')} has no language card: replace the code after --${lang.unnamed.includes(req.pair.target) ? 'target' : 'source'}-lang with the language's name — it is what the model is told — or give it a "name" in champollion.config.json)`
    : null;
  // A set a model may be trained against: the nmt-forge steps come before
  // the baseline, which is a scoring read (see forgeFirstLines).
  const forgeFirst = mayBeTrainedAgainst(req)
    ? forgeFirstLines({ pair: req.pair, dataFile, sha256: dataInfo ? dataInfo.sha256 : null, cardId: id, cwd, lang })
    : null;

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
    console.log('  This card stays on your machine. Nothing was registered or uploaded.');
    if (dataFile) {
      console.log('  Your text was read only to count and checksum it. Only a model on this');
      console.log('  machine can be tested against it; every remote provider is refused.');
      console.log('');
      if (forgeFirst && !forgeFirst.done) {
        for (const line of forgeFirst.lines) console.log(line);
        console.log('');
        console.log('  Then measure a local model on it (the baseline) — or now, if no model will');
        console.log('  be trained against this set:');
      } else {
        if (forgeFirst) { for (const line of forgeFirst.lines) console.log(line); console.log(''); }
        console.log('  Next: measure a local model on it:');
      }
      const model = localModelFor(cwd);
      console.log(`    mt-eval run --corpus ${runTarget} --provider local --model ${model ? shellQuote(model) : '<model>'} ${lang.flags}`);
      if (!model) console.log('    (<model>: the name your local server serves, e.g. llama3.1)');
      if (unnamedNote) console.log(unnamedNote);
    } else {
      console.log('  Your corpus text was never read. To protect the file itself, re-run with');
      console.log('  --data <file>: that marks it local-only for mt-eval.');
    }
  } else if (req.tier.key === 'private') {
    console.log('  Metadata only — your corpus TEXT was never uploaded or hosted, and never');
    console.log('  will be. A private set is quarantined from the public queue/leaderboard.');
    if (dataFile) console.log('  Your text was read on this machine only to count and checksum it.');
    console.log('');
    if (installMode) {
      console.log('  The card is kept here with you. To have it listed in the index (metadata');
      console.log('  only, review-gated), submit it:  champollion network submit --type dataset');
    } else {
      console.log('  Rebuild the registry so the card is catalogued:');
      for (const line of REGISTRY_REBUILD_HINT) console.log(line);
    }
    console.log('');
    if (forgeFirst && !forgeFirst.done) {
      for (const line of forgeFirst.lines) console.log(line);
      console.log('');
      console.log('  Then evaluate on it (the baseline) — or now, if no model will be trained');
      console.log('  against this set — and publish the scores without the text if you choose:');
    } else {
      if (forgeFirst) { for (const line of forgeFirst.lines) console.log(line); console.log(''); }
      console.log('  Evaluate on it, then publish the scores without the text if you choose:');
    }
    console.log(`    mt-eval run --corpus ${runTarget} --provider <provider> --model <model> ${lang.flags} -o results`);
    if (unnamedNote) console.log(unnamedNote);
    console.log('    mt-eval publish results/<run-id>_report.json --scores-only --dry-run');
  } else if (installMode) {
    console.log('  The card is kept here with you. A public corpus is listed through review:');
    console.log('    champollion network submit --type dataset');
  } else {
    console.log('  A metadata card + fetch-from-source pointer is registered — your corpus');
    console.log('  TEXT is never hosted by Champollion; it is fetched from source on demand.');
    console.log('');
    console.log('  Next: rebuild the registry so the pair enters the public queue:');
    for (const line of REGISTRY_REBUILD_HINT) console.log(line);
  }
  console.log('');
  return 0;
}

/**
 * `--help` for this command. The text lives in lib/command-help.js — the one
 * `champollion network register-corpus --help` prints. This module kept a
 * second copy, and the two drifted: Round 9 corrected what the file reads in
 * one, while the other still said "never reads" (Round 10, school persona).
 */
function showHelp() {
  showCommandHelp('register-corpus');
}

/**
 * The registry-rebuild step a registrant runs after a card lands. The registry
 * (arena/datasets/registry*.json + the wheel's bundled copy) is BUILT from the
 * cards by the Python builder — there is no npm script for it, and a printed
 * next-step that does not exist is a broken door. Tested against the builder's
 * real path in test/corpus-registration.test.js.
 */
export const REGISTRY_REBUILD_HINT = Object.freeze([
  '    python3 arena/scripts/build_registry.py --diff   # from the monorepo root: preview the registry change',
  '    python3 arena/scripts/build_registry.py          # rebuild arena/datasets/registry*.json (+ the bundled wheel copy)',
]);

export { run };
