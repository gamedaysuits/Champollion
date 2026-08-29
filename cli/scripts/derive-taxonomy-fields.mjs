#!/usr/bin/env node

/**
 * derive-taxonomy-fields.mjs
 * ────────────────────────────────────────────────────────────────
 * Derives the taxonomy fields ratified in docs/LANGUAGE_TAXONOMY.md
 * (Positions 1–4 + implementation runbook R3) onto the language cards:
 *
 *   1. `modality` — 'signed' | 'spoken' | null, on every flat card.
 *      'signed' iff ANY of:
 *        a. Glottolog ancestry roots in the "Sign Language" pseudo-family
 *           (languoid.csv family_id == 'sign1238'),
 *        b. ISO 639-3 Ref_Name matches /sign language/i,
 *        c. the code is in the explicit endonym allowlist
 *           (asf Auslan, ils International Sign, sfb LSFB, vgt VGT).
 *      Otherwise 'spoken' for any ISO-coded card; null only for x-
 *      cards with no ISO 639-3 identity. Expected: 163 signed.
 *      ALWAYS overwritten — it is a derived synthesis, not curated data.
 *
 *   2. `taxonomyNotes` — initialized to null when absent. NEVER
 *      overwrites a non-null value (notes are curated, sourced prose
 *      per Position 5 — the script must not auto-generate disputes).
 *
 *   3. Backfill `isoType` / `isoScope` / `macrolanguage` from the ISO
 *      639-3 SSOT tables on cards missing them (only cards whose
 *      `code` is itself an ISO 639-3 id — regional-variant cards like
 *      fra-CA and x- conlangs are not ISO entries and stay null).
 *
 *   4. Macrolanguage hub cards (Position 4) — for each of the 63 ISO
 *      macrolanguages, ensure a hub exists with:
 *        isoScope 'M', members[] (active M-table rows, sorted),
 *        supportTier 'cataloged', NO pipelineReadiness / benchmark
 *        linkage (hubs are navigation, never benchmark targets).
 *      - 56 macrolanguages have flat cards (e.g. cre.json): reconciled
 *        in place; never duplicated as genera/macrolanguage-<code>.json.
 *      - 7 codes purged from flat generation (ara fas msa nor sqi swa
 *        zho — PURGED_MACROLANGUAGES in generate-all-cards.mjs, which
 *        stays as-is): their hubs are the hand-written
 *        genera/macrolanguage-<code>.json prototypes, completed here.
 *
 *   5. Bijection check (runbook R5): every hub's members[] matches the
 *      active M-table exactly; every member exists as a card; every
 *      card with `macrolanguage` set appears in that hub's members.
 *
 * Provenance (license-boundaries rule): values copied from
 * ISO 639-3 tables are stamped 'iso639-3-2024'; the modality value is
 * a Champollion derivation (heuristic cross-check of two sources) and
 * is stamped with the 'derived:' prefix naming its upstreams.
 *
 * NOTE on inheritance: genera/macrolanguage-*.json files double as
 * `extends` templates for their member cards. members[] placed on
 * those hubs is technically visible to members through runtime card
 * resolution (lib/registers.js deep-merge); nothing consumes
 * `members` on resolved individual cards today, and raw card files —
 * the SSOT read by the linter, the schema, and the TC build — comply
 * with "members only on hubs".
 *
 * Idempotent: a second run reports 0 modified files.
 *
 * Usage:
 *   node scripts/derive-taxonomy-fields.mjs              # all cards
 *   node scripts/derive-taxonomy-fields.mjs --dry-run    # preview
 *   node scripts/derive-taxonomy-fields.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const GENERA_DIR = path.join(CARDS_DIR, 'genera');

const ISO_TAB = path.join(DATA_DIR, 'iso639-3', 'iso-639-3.tab');
const MACRO_TAB = path.join(DATA_DIR, 'iso639-3', 'iso-639-3-macrolanguages.tab');
const LANGUOID_CSV = path.join(DATA_DIR, 'glottolog', 'languoid.csv');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Provenance ids (see docs/LICENSING.md + shared/licenses.json resolver)
const SRC_ISO = 'iso639-3-2024';
const SRC_GLOTTOLOG = 'glottolog-5.3';
// modality is a Champollion derivation cross-checking two upstreams —
// 'derived:' prefix per the champollion-derived provenance rule.
const SRC_MODALITY = 'derived:glottolog-sign-family+iso639-3-refname';
// hub supportTier/pipelineReadiness shape is project policy, not upstream data
const SRC_HUB_POLICY = 'derived:taxonomy-hub-policy (docs/LANGUAGE_TAXONOMY.md)';

// Glottolog 5.3 top-level "Sign Language" pseudo-family languoid id
const SIGN_FAMILY_GLOTTOCODE = 'sign1238';

// Sign languages whose ISO Ref_Name is endonymous (no "Sign Language"
// substring). Extend if new endonymous sign codes appear in ISO 639-3.
const SIGN_ENDONYM_ALLOWLIST = new Set(['asf', 'ils', 'sfb', 'vgt']);

// Macrolanguage codes purged from flat generation in the v1 purge
// (PURGED_MACROLANGUAGES, generate-all-cards.mjs). Flat generation stays
// purged; their hubs are typed genera/macrolanguage-<code>.json cards.
const PURGED_MACROLANGUAGES = new Set(['ara', 'fas', 'msa', 'nor', 'sqi', 'swa', 'zho']);


// ═══════════════════════════════════════════════════════════════
//  SSOT loaders
// ═══════════════════════════════════════════════════════════════

/** iso-639-3.tab → Map<id, { scope, type, refName }> */
function loadIsoTable() {
  const lines = fs.readFileSync(ISO_TAB, 'utf-8').split('\n').filter(l => l.trim());
  const header = lines[0].split('\t');
  const idCol = header.indexOf('Id');
  const scopeCol = header.indexOf('Scope');
  const typeCol = header.indexOf('Language_Type');
  const nameCol = header.indexOf('Ref_Name');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const id = cols[idCol]?.trim();
    if (!id) continue;
    map.set(id, {
      scope: cols[scopeCol]?.trim() || null,
      type: cols[typeCol]?.trim() || null,
      refName: cols[nameCol]?.trim() || '',
    });
  }
  return map;
}

/**
 * iso-639-3-macrolanguages.tab, ACTIVE rows only (I_Status 'A' —
 * 'R' rows are retired codes and must not become members).
 * Returns { membersByMacro: Map<macro, string[] sorted>,
 *           macroByMember: Map<member, macro> }
 */
function loadMacroTable() {
  const lines = fs.readFileSync(MACRO_TAB, 'utf-8').split('\n').filter(l => l.trim());
  const header = lines[0].split('\t');
  const mCol = header.indexOf('M_Id');
  const iCol = header.indexOf('I_Id');
  const sCol = header.indexOf('I_Status');
  const membersByMacro = new Map();
  const macroByMember = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols[sCol]?.trim() !== 'A') continue; // active rows only
    const m = cols[mCol]?.trim();
    const member = cols[iCol]?.trim();
    if (!m || !member) continue;
    if (!membersByMacro.has(m)) membersByMacro.set(m, []);
    membersByMacro.get(m).push(member);
    macroByMember.set(member, m);
  }
  for (const list of membersByMacro.values()) list.sort();
  return { membersByMacro, macroByMember };
}

/**
 * Split one languoid.csv line. The file is mostly unquoted, but 37
 * rows carry a quoted name containing a comma ("Achi', Cubulco") —
 * a bare split() would shift the iso639P3code column on those rows.
 */
function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * glottolog/languoid.csv → Set<iso639P3code> of languoids whose
 * top-level family is the "Sign Language" pseudo-family.
 */
function loadGlottologSignCodes() {
  if (!fs.existsSync(LANGUOID_CSV)) {
    console.warn('  ⚠️  languoid.csv not found — Glottolog sign-family check disabled');
    return new Set();
  }
  const lines = fs.readFileSync(LANGUOID_CSV, 'utf-8').split('\n').filter(l => l.trim());
  const header = splitCsvLine(lines[0].replace(/\r$/, ''));
  const famCol = header.indexOf('family_id');
  const isoCol = header.indexOf('iso639P3code');
  const signCodes = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i].replace(/\r$/, ''));
    if (cols[famCol] !== SIGN_FAMILY_GLOTTOCODE) continue;
    const iso = cols[isoCol]?.trim();
    if (iso) signCodes.add(iso);
  }
  return signCodes;
}


// ═══════════════════════════════════════════════════════════════
//  Derivation logic
// ═══════════════════════════════════════════════════════════════

/**
 * Derive `modality` for one card.
 * @returns {'signed'|'spoken'|null}
 */
function deriveModality(card, isoTable, signCodes) {
  const code = card.code;
  const iso = (typeof card.iso639_3 === 'string' && card.iso639_3) ? card.iso639_3 : null;
  const isoEntry = iso ? isoTable.get(iso) : null;

  const signedByGlottolog = iso !== null && signCodes.has(iso);
  const signedByRefName = isoEntry !== null && isoEntry !== undefined &&
    /sign language/i.test(isoEntry.refName);
  const signedByAllowlist = SIGN_ENDONYM_ALLOWLIST.has(code) ||
    (iso !== null && SIGN_ENDONYM_ALLOWLIST.has(iso));

  if (signedByGlottolog || signedByRefName || signedByAllowlist) return 'signed';
  if (isoEntry) return 'spoken'; // ISO-coded ⇒ spoken unless evidence of signed
  return null; // x- cards with no ISO identity: genuinely undefined
}

/** Stamp one _fieldSources entry (creates the map if needed). */
function stampSource(card, field, source) {
  if (!card._fieldSources) card._fieldSources = {};
  card._fieldSources[field] = source;
}

/** Add a source id to dataSources[] if not already present. */
function addDataSource(card, source) {
  if (!Array.isArray(card.dataSources)) card.dataSources = [];
  if (!card.dataSources.includes(source)) card.dataSources.push(source);
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Reconcile one hub card (flat scope-M card or genera macrolanguage-*
 * prototype) with the hub design: members[], supportTier 'cataloged',
 * no pipelineReadiness / benchmark (evalDatasets) linkage.
 * Returns a list of change descriptions (empty = already conformant).
 */
function reconcileHub(card, macroCode, membersByMacro) {
  const changes = [];
  const members = membersByMacro.get(macroCode) || [];

  if (!arraysEqual(card.members, members)) {
    card.members = members;
    stampSource(card, 'members', SRC_ISO);
    changes.push(`members[] ← ${members.length} active M-table rows`);
  } else if (card._fieldSources?.members !== SRC_ISO) {
    stampSource(card, 'members', SRC_ISO);
    changes.push('members provenance stamped');
  }

  if (card.supportTier !== 'cataloged') {
    changes.push(`supportTier '${card.supportTier ?? null}' → 'cataloged'`);
    card.supportTier = 'cataloged';
    stampSource(card, 'supportTier', SRC_HUB_POLICY);
  }

  // Hubs are navigation, never benchmark targets (Position 4):
  // strip pipeline-readiness scoring and eval-dataset claims.
  if (card.pipelineReadiness !== null && card.pipelineReadiness !== undefined) {
    changes.push('pipelineReadiness removed (hub cards are not benchmark targets)');
    card.pipelineReadiness = null;
    stampSource(card, 'pipelineReadiness', SRC_HUB_POLICY);
  }
  if (Array.isArray(card.evalDatasets) && card.evalDatasets.length > 0) {
    changes.push(`evalDatasets [${card.evalDatasets.join(', ')}] cleared (benchmarks bind to members)`);
    card.evalDatasets = [];
    stampSource(card, 'evalDatasets', SRC_HUB_POLICY);
  }

  addDataSource(card, SRC_ISO);
  return changes;
}


// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

function readCard(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeCard(filePath, card) {
  if (DRY_RUN) return;
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Taxonomy Field Derivation (docs/LANGUAGE_TAXONOMY.md R3)');
  console.log('  modality · taxonomyNotes · iso backfill · macrolanguage hubs');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'));
  if (SINGLE_LANG) console.log('  Target: ' + SINGLE_LANG);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Loading SSOT data...');
  const isoTable = loadIsoTable();
  const { membersByMacro, macroByMember } = loadMacroTable();
  const signCodes = loadGlottologSignCodes();
  console.log(`  ISO 639-3: ${isoTable.size.toLocaleString()} entries`);
  console.log(`  M-table:   ${macroByMember.size} active memberships across ${membersByMacro.size} macrolanguages`);
  console.log(`  Glottolog: ${signCodes.size} ISO codes under the Sign Language pseudo-family\n`);

  // ── Select flat cards ──
  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');
  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`\n  ❌ Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  // ── Stats ──
  const stats = {
    scanned: 0, modified: 0,
    signed: 0, spoken: 0, nullModality: 0,
    taxonomyNotesInit: 0,
    backfilledType: 0, backfilledScope: 0, backfilledMacro: 0, correctedMacro: 0,
    hubsReconciled: 0, hubMembersTotal: 0,
  };
  const signedSamples = [];
  const hubChanges = [];

  // Index of flat cards for the bijection check: code → { macrolanguage }
  const flatIndex = new Map();

  // ── Pass 1: flat cards ──
  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try { card = readCard(filePath); } catch { continue; }
    if (!card.code) continue;
    stats.scanned++;

    const before = JSON.stringify(card);
    const codeIsIso = isoTable.has(card.code);
    const isoEntry = codeIsIso ? isoTable.get(card.code) : null;

    // 1. modality — derived field, always recomputed
    const modality = deriveModality(card, isoTable, signCodes);
    card.modality = modality;
    if (modality !== null) stampSource(card, 'modality', SRC_MODALITY);
    if (modality === 'signed') {
      stats.signed++;
      if (signedSamples.length < 5) signedSamples.push(`${card.code} (${card.name})`);
    } else if (modality === 'spoken') stats.spoken++;
    else stats.nullModality++;

    // 2. taxonomyNotes — initialize only; curated prose is never overwritten
    if (!('taxonomyNotes' in card)) {
      card.taxonomyNotes = null;
      stats.taxonomyNotesInit++;
    }

    // 3. ISO backfill — only cards that ARE ISO entries (code in the tab).
    //    Regional-variant (fra-CA) and x- cards are not ISO entries: null
    //    correctly means "not in ISO 639-3" for them.
    if (codeIsIso) {
      if (card.isoType == null) {
        card.isoType = isoEntry.type;
        stampSource(card, 'isoType', SRC_ISO);
        stats.backfilledType++;
      }
      if (card.isoScope == null) {
        card.isoScope = isoEntry.scope;
        stampSource(card, 'isoScope', SRC_ISO);
        stats.backfilledScope++;
      }
      const ssotMacro = macroByMember.get(card.code) || null;
      if (card.macrolanguage == null && ssotMacro !== null) {
        card.macrolanguage = ssotMacro;
        stampSource(card, 'macrolanguage', SRC_ISO);
        stats.backfilledMacro++;
      } else if (card.macrolanguage != null && card.macrolanguage !== ssotMacro) {
        // ISO M-table is the SSOT for membership — correct drift, count it
        console.warn(`  ⚠️  ${card.code}: macrolanguage '${card.macrolanguage}' ≠ M-table '${ssotMacro}' — corrected`);
        card.macrolanguage = ssotMacro;
        stampSource(card, 'macrolanguage', SRC_ISO);
        stats.correctedMacro++;
      }

      // 4a. Hub reconciliation for the 56 flat scope-M cards
      if (isoEntry.scope === 'M') {
        const changes = reconcileHub(card, card.code, membersByMacro);
        if (changes.length > 0) {
          stats.hubsReconciled++;
          hubChanges.push(`  ${card.code}: ${changes.join('; ')}`);
        }
        stats.hubMembersTotal += (card.members || []).length;
      }
    }

    flatIndex.set(card.code, { macrolanguage: card.macrolanguage ?? null, isoScope: card.isoScope ?? null });

    if (JSON.stringify(card) !== before) {
      stats.modified++;
      writeCard(filePath, card);
    }
  }

  // ── Pass 2: genera hubs for the 7 purged macrolanguages ──
  // (skipped in --lang mode, which targets a single flat card)
  const generaHubs = [];
  if (!SINGLE_LANG) {
    for (const macroCode of [...PURGED_MACROLANGUAGES].sort()) {
      const hubPath = path.join(GENERA_DIR, `macrolanguage-${macroCode}.json`);
      if (!fs.existsSync(hubPath)) {
        console.error(`  ❌ Missing hub prototype: genera/macrolanguage-${macroCode}.json`);
        process.exitCode = 1;
        continue;
      }
      const hub = readCard(hubPath);
      const before = JSON.stringify(hub);
      const changes = [];

      if (hub.iso639_3 !== macroCode) {
        hub.iso639_3 = macroCode;
        stampSource(hub, 'iso639_3', SRC_ISO);
        changes.push(`iso639_3 ← '${macroCode}'`);
      }
      if (hub.isoScope !== 'M') {
        hub.isoScope = 'M';
        stampSource(hub, 'isoScope', SRC_ISO);
        changes.push("isoScope ← 'M'");
      }
      const isoEntry = isoTable.get(macroCode);
      if (isoEntry && hub.isoType !== isoEntry.type) {
        hub.isoType = isoEntry.type;
        stampSource(hub, 'isoType', SRC_ISO);
        changes.push(`isoType ← '${isoEntry.type}'`);
      }
      // All seven purged macrolanguages are spoken-language continua
      if (hub.modality !== deriveModality({ code: macroCode, iso639_3: macroCode }, isoTable, signCodes)) {
        hub.modality = deriveModality({ code: macroCode, iso639_3: macroCode }, isoTable, signCodes);
        stampSource(hub, 'modality', SRC_MODALITY);
        changes.push(`modality ← '${hub.modality}'`);
      }
      if (!('taxonomyNotes' in hub)) {
        hub.taxonomyNotes = null;
        changes.push('taxonomyNotes ← null');
      }
      changes.push(...reconcileHub(hub, macroCode, membersByMacro));

      if (JSON.stringify(hub) !== before) {
        stats.modified++;
        writeCard(hubPath, hub);
        hubChanges.push(`  macrolanguage-${macroCode}: ${changes.join('; ')}`);
      }
      stats.hubsReconciled += changes.length > 0 ? 1 : 0;
      stats.hubMembersTotal += (hub.members || []).length;
      generaHubs.push({ code: macroCode, members: hub.members || [] });
    }
  }

  // ── Pass 3: bijection check (runbook R5) ──
  const violations = [];
  if (!SINGLE_LANG) {
    // Hub side: every macrolanguage's members[] must exist as cards and
    // point back via `macrolanguage`.
    const hubMembers = new Map(); // macro → Set(members)
    for (const [macro, members] of membersByMacro) {
      const isFlat = flatIndex.has(macro);
      const isGenera = PURGED_MACROLANGUAGES.has(macro);
      if (!isFlat && !isGenera) {
        violations.push(`macrolanguage '${macro}' has no hub card (flat or genera)`);
        continue;
      }
      hubMembers.set(macro, new Set(members));
      for (const member of members) {
        const entry = flatIndex.get(member);
        if (!entry) {
          violations.push(`'${macro}' member '${member}' has no card`);
        } else if (entry.macrolanguage !== macro) {
          violations.push(`'${member}'.macrolanguage = '${entry.macrolanguage}' but M-table says '${macro}'`);
        }
      }
    }
    // Member side: every card pointing at a macrolanguage must appear in
    // that macrolanguage's members.
    for (const [code, entry] of flatIndex) {
      if (entry.macrolanguage == null) continue;
      const members = hubMembers.get(entry.macrolanguage);
      if (!members) {
        violations.push(`'${code}'.macrolanguage = '${entry.macrolanguage}' which is not a known macrolanguage hub`);
      } else if (!members.has(code)) {
        violations.push(`'${code}' points at '${entry.macrolanguage}' but is not in its members[]`);
      }
    }
  }

  // ── Report ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards scanned:           ${stats.scanned.toLocaleString()}`);
  console.log(`  Files modified:          ${stats.modified.toLocaleString()}${DRY_RUN ? ' (dry run — not written)' : ''}`);
  console.log('\n  MODALITY:');
  console.log(`    signed:                ${stats.signed}   e.g. ${signedSamples.join(', ')}`);
  console.log(`    spoken:                ${stats.spoken.toLocaleString()}`);
  console.log(`    null (non-ISO x- only): ${stats.nullModality}`);
  console.log('\n  TAXONOMY NOTES:');
  console.log(`    initialized to null:   ${stats.taxonomyNotesInit.toLocaleString()} (existing non-null values never touched)`);
  console.log('\n  ISO BACKFILL:');
  console.log(`    isoType:               ${stats.backfilledType}`);
  console.log(`    isoScope:              ${stats.backfilledScope}`);
  console.log(`    macrolanguage:         ${stats.backfilledMacro} backfilled, ${stats.correctedMacro} corrected`);
  console.log('\n  MACROLANGUAGE HUBS:');
  console.log(`    hubs reconciled:       ${stats.hubsReconciled} (flat M-cards + ${generaHubs.length} genera hubs)`);
  console.log(`    total members linked:  ${stats.hubMembersTotal}`);
  if (hubChanges.length > 0) {
    console.log('\n  HUB CHANGES:');
    for (const line of hubChanges) console.log(line);
  }
  console.log('\n  BIJECTION CHECK (R5):');
  if (SINGLE_LANG) {
    console.log('    skipped (--lang mode)');
  } else if (violations.length === 0) {
    console.log('    ✅ all macrolanguage memberships are bijective');
  } else {
    console.log(`    ❌ ${violations.length} violation(s):`);
    for (const v of violations.slice(0, 30)) console.log(`      - ${v}`);
    if (violations.length > 30) console.log(`      ... and ${violations.length - 30} more`);
    process.exitCode = 1;
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
