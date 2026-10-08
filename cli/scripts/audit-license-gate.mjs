#!/usr/bin/env node

/**
 * audit-license-gate.mjs — standing license-classification audit (read-only).
 *
 * Sweeps every distinct source on the LIVE data surfaces and classifies it
 * through cli/lib/license-gate.mjs. Reports the tier breakdown and, crucially,
 * FAILS (exit 1) if any source has no license record at all ('unknown') —
 * i.e. something was ingested or cited without being licensed. This is the
 * seatbelt that keeps an un-licensed source from silently reaching the
 * permissive export or a future commercial API.
 *
 * TWO SURFACES (the legacy champollion.db facts surface was retired 2026-08-18,
 * champollion.db retirement B7 — its 268 fact-sources were verified to resolve
 * within the surfaces below plus the register floor):
 *
 *   atlas — every distinct `Source` in cli/data/atlas.db
 *           (SELECT DISTINCT Source FROM cldf_values UNION cldf_forms),
 *           resolved against shared/licenses.json with the bare↔versioned
 *           alias tolerance (exact key, then version/-<12hex>/@date-suffix
 *           stripping via card-source-resolution.mjs).
 *   cards — every distinct source STAMP on the language cards: `_fieldSources`,
 *           `dataSources[]`, and the inline `<field>.source` convention used
 *           by the Glottolog-only stubs.
 *
 * The card surface matters because a source can reach a published card without
 * a corresponding atlas value row; the atlas surface matters because forms
 * (lexical sidecar) cite sources no card stamps field-by-field.
 *
 * It never writes to any database. Mirrors the spirit of
 * audit-fact-provenance.mjs.
 *
 * Usage:
 *   node cli/scripts/audit-license-gate.mjs               # atlas + cards (default)
 *   node cli/scripts/audit-license-gate.mjs --cards       # accepted (same as default)
 *   node cli/scripts/audit-license-gate.mjs --cards-only  # cards only (no DB needed)
 *   node cli/scripts/audit-license-gate.mjs --json
 *
 * Exit codes: 0 = every source classified · 1 = unlicensed source(s) found ·
 *             2 = required input missing.
 *
 * @see cli/lib/license-gate.mjs
 * @see cli/lib/card-source-resolution.mjs
 * @see docs/LICENSING.md
 */

import Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classifySource, TIERS } from '../lib/license-gate.mjs';
import {
  buildRegisterIndex,
  cardSourceStamps,
  resolveSourceComponent,
  INTERNAL_SOURCE_PATTERNS,
} from '../lib/card-source-resolution.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');
const ATLAS_DB_PATH = join(CLI_ROOT, 'data', 'atlas.db');
const CARDS_DIR = join(CLI_ROOT, 'shared', 'language-cards');
const REGISTER = join(CLI_ROOT, '..', 'shared', 'licenses.json');
const JSON_OUT = process.argv.includes('--json');
const CARDS_ONLY = process.argv.includes('--cards-only');

// ─── Register (needed by both surfaces) ─────────────────────────────────────
const register = buildRegisterIndex(REGISTER);
if (!register) {
  console.error(`ERROR: license register not found/parseable at ${REGISTER}`);
  process.exit(2);
}

/**
 * Resolve an ATLAS source id (cldf_sources.ID) to a license-register key.
 * Atlas ids pin a release into the id itself, in shapes the shared resolver's
 * version-stripper does not all know:
 *   glottolog-cldf-v5.3 · elcat-v2024.1 · datsemshift-v1.1rc ·
 *   linguameta-452a21ad3dae (content hash) · sil-langtags-1.4@2026-06-09 ·
 *   curated:method-coverage-2a485dc249c6 (internal curation)
 * Order: exact / shared resolution first, then the atlas-specific suffix
 * strips, then shared resolution of the stripped base.
 */
// Atlas-id vocabulary → register vocabulary, applied after suffix stripping.
// Each entry is justified by an observed atlas source id whose base form
// differs from its register key — do not add speculative aliases.
const ATLAS_ALIASES = new Map(Object.entries({
  'ud-treebanks': 'universal-dependencies',
  'common-voice-cv-corpus': 'common-voice',
}));

function resolveAtlasSource(id) {
  if (/^curated:/.test(id)) return 'champollion-derived'; // repo-curated, internal
  const direct = resolveSourceComponent(id, register);
  if (direct) return direct;
  // Strip release pins the shared version-stripper does not all know:
  // an @date suffix, a 12-hex content hash, then trailing version/date
  // tokens (repeatedly: common-voice-cv-corpus-26.0-2026-06-12 carries two).
  let base = id
    .replace(/@.*$/, '')                       // sil-langtags-1.4@2026-06-09
    .replace(/-[0-9a-f]{12}$/, '');            // linguameta-<contenthash>
  let prev;
  do {
    prev = base;
    base = base.replace(/-(?:v?\d+(?:[._-]\d+)*[a-z]?\d*(?:rc\d*)?)$/i, '');
  } while (base !== prev);
  if (base !== id) {
    const viaBase = resolveSourceComponent(base, register);
    if (viaBase) return viaBase;
  }
  const alias = ATLAS_ALIASES.get(base);
  if (alias && register.sourceKeys.has(alias)) return alias;
  // Bare id vs versioned register key: a card/atlas id like 'sil-langtags'
  // where the register pins 'sil-langtags-1.4@2026-06-09'. Only reached when
  // every exact/base resolution above failed.
  for (const key of register.sourceKeys) {
    if (key.startsWith(base + '-') || key.startsWith(base + '@')) return key;
  }
  return null;
}

// ─── Atlas surface ──────────────────────────────────────────────────────────
let atlas = null;
if (!CARDS_ONLY) {
  if (!existsSync(ATLAS_DB_PATH)) {
    console.error(`ERROR: atlas database not found at ${ATLAS_DB_PATH}`);
    console.error('       Build it with: node cli/scripts/cldf/build-atlas.mjs');
    console.error('       (or run --cards-only for the card surface alone)');
    process.exit(2);
  }
  const db = new Database(ATLAS_DB_PATH, { readonly: true });
  const rows = db.prepare(`
    SELECT Source AS source, SUM(n) AS n FROM (
      SELECT Source, COUNT(*) AS n FROM cldf_values GROUP BY Source
      UNION ALL
      SELECT Source, COUNT(*) AS n FROM cldf_forms GROUP BY Source
    ) GROUP BY Source
  `).all();
  db.close();

  const tiers = {};
  const unresolved = [];
  const unknown = [];
  let permValues = 0, restrValues = 0, derivedValues = 0;
  for (const r of rows) {
    const key = resolveAtlasSource(r.source);
    if (!key) {
      unresolved.push({ source: r.source, values: r.n });
      continue;
    }
    const c = classifySource(key);
    if (!tiers[c.tier]) tiers[c.tier] = { sources: 0, values: 0 };
    tiers[c.tier].sources++;
    tiers[c.tier].values += r.n;
    if (c.tier === TIERS.UNKNOWN) {
      const registered = register.sourceKeys.has(key);
      unknown.push({
        source: r.source,
        registerKey: key,
        values: r.n,
        state: registered ? 'unmapped' : 'unregistered',
        spdx: registered ? (register.sources[key] || {}).license_spdx || null : null,
      });
    }
    if (key === 'champollion-derived') derivedValues += r.n;
    else if (c.commercialSafe) permValues += r.n;
    else restrValues += r.n;
  }

  atlas = {
    distinctSources: rows.length,
    tiers,
    permissiveValues: permValues,
    restrictedValues: restrValues,
    derivedValues,
    unresolved,
    unknown,
    // Same strictness as the cards surface (and as the retired facts surface):
    // an unmapped LicenseRef is fail-safe UNKNOWN and fails the gate until the
    // founder maps it — only the diagnosis and owner differ from unregistered.
    pass: unresolved.length === 0 && unknown.length === 0,
  };
}

// ─── Card-stamp sweep (always on) ───────────────────────────────────────────
//
// Resolution order mirrors the linter's license-source-resolves rule exactly
// (shared module), so a stamp the linter accepts is a stamp this audit accepts.
// A stamp that resolves to a register key is then classified by the SAME gate
// the atlas sweep uses — one classifier, two surfaces.
let cards = null;
{
  if (!existsSync(CARDS_DIR)) {
    console.error(`ERROR: language-cards dir not found at ${CARDS_DIR}`);
    process.exit(2);
  }

  // UMBRELLA STAMPS point at member datasets rather than licensing anything
  // themselves. `LicenseRef-Lexibank-Per-Dataset` literally says "terms are
  // per-dataset" — and the members it defers to are named ON THE CARD, in
  // corpusAvailability.lexibankDatasets, with 142 of 143 already carrying their
  // own register entry and real SPDX id.
  //
  // Classifying the umbrella instead of the members made 1,107 card-citations
  // of non-commercial, share-alike and unstated datasets read as one tidy
  // permissive-looking stamp. Expanding it is not extra strictness; it is
  // reading the licence the umbrella told us to go read.
  const UMBRELLAS = {
    lexibank: (card) => card.corpusAvailability?.lexibankDatasets,
  };

  const stampCards = new Map();   // raw stamp -> Set(card codes)
  const umbrellaMembers = new Map(); // member key -> Set(card codes)
  let scanned = 0, parseErrors = 0, umbrellaExpansions = 0;
  for (const file of readdirSync(CARDS_DIR)) {
    if (!file.endsWith('.json') || file === 'language-tree.json') continue;
    let card;
    try {
      card = JSON.parse(readFileSync(join(CARDS_DIR, file), 'utf-8'));
    } catch { parseErrors++; continue; }
    scanned++;
    const code = card.code || file.replace(/\.json$/, '');
    for (const stamp of cardSourceStamps(card)) {
      if (!stampCards.has(stamp)) stampCards.set(stamp, new Set());
      stampCards.get(stamp).add(code);
    }
    for (const [umbrella, pick] of Object.entries(UMBRELLAS)) {
      const members = pick(card);
      if (!Array.isArray(members) || !members.length) continue;
      for (const raw of members) {
        const m = String(raw).toLowerCase();
        // Register keys are bare dataset names or `lexibank-<name>`; the
        // resolver already knows both forms.
        const key = resolveSourceComponent(m, register)
          ?? resolveSourceComponent(`${umbrella}-${m}`, register);
        if (!key) continue;
        if (!umbrellaMembers.has(key)) umbrellaMembers.set(key, new Set());
        umbrellaMembers.get(key).add(code);
        umbrellaExpansions++;
      }
    }
  }

  const cardTiers = {};
  const cardUnknown = [];
  const unresolved = [];
  for (const [stamp, codes] of stampCards) {
    // Whole-value internal derivations first, exactly as the linter does.
    // "derived:cldr+script+keyboard" is a derivation RECIPE, not a '+'-joined
    // source list — "script" and "keyboard" are recipe inputs, not datasets.
    // Splitting before this check reported 7,927 cards as citing an
    // unidentifiable source called "script".
    if (INTERNAL_SOURCE_PATTERNS.some((re) => re.test(stamp))) {
      const c = classifySource('champollion-derived');
      if (!cardTiers[c.tier]) cardTiers[c.tier] = { sources: 0, cards: 0 };
      cardTiers[c.tier].sources++;
      cardTiers[c.tier].cards += codes.size;
      continue;
    }
    // A compound "a+b+c" stamp is several claims; each component must license.
    const components = stamp.split('+').map((c) => c.trim()).filter(Boolean);
    for (const component of components) {
      const key = resolveSourceComponent(component, register)
        ?? resolveAtlasSource(component);
      if (!key) {
        // Unresolvable against the register: cannot be licensed because it
        // cannot even be identified. Reported separately from 'unknown' so the
        // two failure modes stay distinguishable.
        unresolved.push({ stamp: component, cards: codes.size, example: [...codes][0] });
        continue;
      }
      const c = classifySource(key);
      if (!cardTiers[c.tier]) cardTiers[c.tier] = { sources: 0, cards: 0 };
      cardTiers[c.tier].sources++;
      cardTiers[c.tier].cards += codes.size;
      if (c.tier === TIERS.UNKNOWN) {
        // Two very different states share this tier, and conflating them made
        // the report say "UNLICENSED" about sources that are registered:
        //   unregistered  — no entry at all. A source was ingested/cited
        //                   without ever being licensed. An agent can fix this
        //                   by registering it.
        //   unmapped      — a register entry EXISTS with explicit terms, but
        //                   its LicenseRef id maps to no tier the gate knows.
        //                   That is a determination about what the terms mean,
        //                   which is the founder's call, not an agent's.
        // Both stay fail-safe (UNKNOWN grants nothing); only the diagnosis and
        // the owner differ.
        const registered = register.sourceKeys.has(key);
        cardUnknown.push({
          source: key,
          stamp: component,
          cards: codes.size,
          state: registered ? 'unmapped' : 'unregistered',
          spdx: registered ? (register.sources[key] || {}).license_spdx || null : null,
        });
      }
    }
  }

  // Classify the EXPANDED members. This is the licence that actually governs
  // the data the card is pointing at.
  const memberTiers = {};
  const restrictedMembers = [];
  for (const [key, codes] of umbrellaMembers) {
    const c = classifySource(key);
    if (!memberTiers[c.tier]) memberTiers[c.tier] = { members: 0, cards: 0 };
    memberTiers[c.tier].members++;
    memberTiers[c.tier].cards += codes.size;
    if (c.tier !== TIERS.PERMISSIVE) {
      restrictedMembers.push({ member: key, tier: c.tier, spdx: c.license_spdx, cards: codes.size });
    }
  }

  cards = {
    scanned,
    parseErrors,
    distinctStamps: stampCards.size,
    tiers: cardTiers,
    unknown: cardUnknown,
    unresolved,
    umbrella: {
      // The umbrella KEYS, carried out of this scope so the reporting section
      // can tell a pointer apart from a genuinely undetermined licence.
      keys: Object.keys(UMBRELLAS),
      expansions: umbrellaExpansions,
      distinctMembers: umbrellaMembers.size,
      tiers: memberTiers,
      restrictedMembers: restrictedMembers.sort((a, b) => b.cards - a.cards),
      restrictedCitations: restrictedMembers.reduce((n, m) => n + m.cards, 0),
    },
    pass: cardUnknown.length === 0 && unresolved.length === 0,
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  atlas,
  // Kept top-level for scripts/audit_runner.py (parse_license_gate reads
  // `unknown` as the ingested-without-a-license list): the atlas surface's
  // unregistered + unresolvable sources land here.
  unknown: [
    ...(atlas?.unresolved ?? []).map((u) => ({ ...u, state: 'unresolvable' })),
    ...(atlas?.unknown ?? []).filter((u) => u.state === 'unregistered'),
  ],
  cards,
  pass: (!atlas || atlas.pass) && (!cards || cards.pass),
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (atlas) {
    console.log(`\n  LICENSE-GATE AUDIT — atlas surface: ${atlas.distinctSources} distinct sources (cldf_values ∪ cldf_forms)\n`);
    for (const [tier, t] of Object.entries(atlas.tiers).sort((a, b) => b[1].values - a[1].values)) {
      console.log(`    ${tier.padEnd(20)} ${String(t.sources).padStart(4)} sources  ${t.values.toLocaleString().padStart(12)} values`);
    }
    console.log(`\n  Permissive (commercial-safe): ${atlas.permissiveValues.toLocaleString()} values`);
    console.log(`  Restricted (NC/SA/unstated/mixed/SIL): ${atlas.restrictedValues.toLocaleString()} values`);
    console.log(`  champollion-derived (per-value at use): ${atlas.derivedValues.toLocaleString()} values`);
    if (atlas.unresolved.length) {
      console.log(`\n  ✗ ${atlas.unresolved.length} atlas source(s) resolve to NO register entry:`);
      for (const u of atlas.unresolved) console.log(`      ${u.source} (${u.values.toLocaleString()} values)`);
    }
    const unregistered = atlas.unknown.filter((u) => u.state === 'unregistered');
    const unmapped = atlas.unknown.filter((u) => u.state === 'unmapped');
    if (unregistered.length) {
      console.log(`\n  ✗ ${unregistered.length} UNLICENSED atlas source(s) (no register entry — license before shipping):`);
      for (const u of unregistered) console.log(`      ${u.source} → ${u.registerKey} (${u.values.toLocaleString()} values)`);
    }
    if (unmapped.length) {
      console.log(`\n  ⚠ ${unmapped.length} registered atlas source(s) whose LicenseRef maps to no tier (founder determination):`);
      for (const u of unmapped) console.log(`      ${u.source} → ${u.registerKey}  ${u.spdx}  (${u.values.toLocaleString()} values)`);
    }
    if (atlas.pass) console.log('\n  ✅ Every atlas source is licensed/classified.');
  } else {
    console.log('\n  LICENSE-GATE AUDIT — atlas surface SKIPPED (--cards-only)');
  }

  if (cards) {
    console.log(`\n  CARD-STAMP SWEEP — ${cards.distinctStamps} distinct stamps over ${cards.scanned.toLocaleString()} cards\n`);
    for (const [tier, t] of Object.entries(cards.tiers).sort((a, b) => b[1].cards - a[1].cards)) {
      console.log(`    ${tier.padEnd(20)} ${String(t.sources).padStart(4)} stamps  ${t.cards.toLocaleString().padStart(12)} card-citations`);
    }
    if (cards.unresolved.length) {
      console.log(`\n  ✗ ${cards.unresolved.length} card stamp(s) resolve to NO register entry (cannot be licensed because they cannot be identified):`);
      for (const u of cards.unresolved.slice(0, 25)) {
        console.log(`      ${u.stamp}  (${u.cards} cards, e.g. ${u.example})`);
      }
      if (cards.unresolved.length > 25) console.log(`      … and ${cards.unresolved.length - 25} more`);
    }
    const unregistered = cards.unknown.filter((u) => u.state === 'unregistered');
    const unmapped = cards.unknown.filter((u) => u.state === 'unmapped');
    if (unregistered.length) {
      console.log(`\n  ✗ ${unregistered.length} card stamp(s) cite a source with NO register entry (unlicensed — register before shipping):`);
      for (const u of unregistered.slice(0, 25)) {
        console.log(`      ${u.stamp} → ${u.source}  (${u.cards} cards)`);
      }
    }
    if (unmapped.length) {
      const byKey = new Map();
      for (const u of unmapped) {
        const e = byKey.get(u.source) || { spdx: u.spdx, cards: 0 };
        e.cards += u.cards;
        byKey.set(u.source, e);
      }
      // An umbrella is not an undetermined licence — it is a POINTER, and the
      // expansion below reads the members it points at. Reporting it as
      // "awaiting a founder determination" would be asking for a decision that
      // the machinery already makes correctly.
      const umbrellaKeys = new Set(cards.umbrella?.keys ?? []);
      const pointers = [...byKey].filter(([k]) => umbrellaKeys.has(k));
      const undetermined = [...byKey].filter(([k]) => !umbrellaKeys.has(k));
      if (undetermined.length) {
        console.log(`\n  ⚠ ${undetermined.length} registered source(s) whose LicenseRef maps to no tier`);
        console.log('    (terms ARE recorded; what they permit is a FOUNDER determination, not an agent\'s):');
        for (const [key, e] of undetermined.sort((a, b) => b[1].cards - a[1].cards)) {
          console.log(`      ${key.padEnd(30)} ${String(e.spdx).padEnd(34)} ${e.cards.toLocaleString()} card-citations`);
        }
      }
      if (pointers.length) {
        console.log(`\n  ${pointers.length} umbrella pointer(s) — not a licence; resolved via member expansion below:`);
        for (const [key, e] of pointers) {
          console.log(`      ${key.padEnd(30)} ${String(e.spdx).padEnd(34)} ${e.cards.toLocaleString()} card-citations`);
        }
      }
    }
    if (cards.pass) console.log('\n  ✅ Every source cited by a card is licensed/classified.');

    const u = cards.umbrella;
    if (u && u.expansions) {
      console.log(`\n  UMBRELLA EXPANSION — ${u.distinctMembers} member dataset(s) behind the umbrella stamps\n`);
      for (const [tier, t] of Object.entries(u.tiers).sort((a, b) => b[1].cards - a[1].cards)) {
        console.log(`    ${tier.padEnd(20)} ${String(t.members).padStart(4)} member(s)  ${String(t.cards).padStart(6)} card-citations`);
      }
      if (u.restrictedCitations) {
        console.log(`\n  ⚠ ${u.restrictedCitations} card-citation(s) of NON-PERMISSIVE members were carried`);
        console.log('    under a single umbrella stamp. The umbrella licenses nothing — it defers');
        console.log('    to these, and each already has its own register entry:');
        for (const m of u.restrictedMembers.slice(0, 20)) {
          console.log(`      ${m.member.padEnd(28)} ${String(m.spdx).padEnd(18)} ${String(m.tier).padEnd(14)} ${m.cards} cards`);
        }
        if (u.restrictedMembers.length > 20) {
          console.log(`      … and ${u.restrictedMembers.length - 20} more`);
        }
      }
    }
  }
}

// Set exitCode rather than calling process.exit(): on a PIPE, node's stdout is
// asynchronous, and process.exit() discards whatever has not flushed yet. The
// full payload is well over 64 KB, so a `process.exit()` here would truncate
// the JSON mid-string for any consumer that piped it — including
// scripts/audit_runner.py, which would then have scored this checker
// UNVERIFIABLE forever without anyone learning why.
process.exitCode = result.pass ? 0 : 1;
