#!/usr/bin/env node

/**
 * build-cards-fallback.mjs
 * ────────────────────────────────────────────────────────────────
 * Builds shared/cards-fallback.json — the small bundled card set
 * shipped in the npm package now that the full language-card
 * directory (shared/language-cards/, ~72 MB unpacked) is excluded
 * from the tarball (see package.json "files").
 *
 * The published CLI loads cards in three tiers (lib/registers.js):
 *   1. shared/language-cards/      — full set (repo checkouts only)
 *   2. shared/cards-fallback.json  — this file (published package)
 *   3. ~/.champollion/cards/       — per-code cache fetched from the
 *      production Supabase trading-card tables (read-only anon key)
 *
 * WHAT GOES IN THE FALLBACK ("core languages work offline"):
 *   - every card with an ISO 639-1 code (the major world languages
 *     users actually configure as i18n targets)
 *   - locale-variant cards (code contains "-": fra-CA, cmn-Hant, …)
 *     which also covers the x-* conlangs
 *   - every card with a deterministic scriptConverter (crk, srp, …)
 *   - every card with FST install metadata (morphological validation
 *     targets — the project's flagship low-resource languages)
 *   - all abstract parent cards (genera/) so `extends` resolution
 *     never needs the network
 *   - the transitive `extends` closure of all of the above
 *
 * Plus a MANIFEST of every concrete card code → { n: name,
 * a: aliases, d: dir } so resolveCode()/alias lookup covers the
 * full catalogue offline and the loader knows which codes are
 * fetchable from Supabase.
 *
 * Output is deterministic (sorted keys, no timestamp) so the
 * committed artifact only changes when card data changes.
 *
 * Usage:
 *   node scripts/build-cards-fallback.mjs            # write the file
 *   node scripts/build-cards-fallback.mjs --check    # CI freshness gate
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const OUT_FILE = path.join(__dirname, '..', 'shared', 'cards-fallback.json');
// Model-alias map: bundled into the package so `--model <alias>` resolves in the
// installed CLI. SSOT is the monorepo-root /shared/model-aliases.json; we copy it
// into cli/shared/ at prepack so there's no drift (vs a committed second copy).
const ALIAS_SRC = path.join(__dirname, '..', '..', 'shared', 'model-aliases.json');
const ALIAS_DEST = path.join(__dirname, '..', 'shared', 'model-aliases.json');
// Method/provider registry SSOT: the CLI prefers the package-bundled copy at
// runtime (cli/lib/method-manifest.js loads cli/shared/ first), so — like
// model-aliases above — copy the monorepo-root SSOT into cli/shared/ at prepack
// instead of hand-maintaining a second committed copy that can silently drift.
const REGISTRY_SRC = path.join(__dirname, '..', '..', 'shared', 'method-registry.json');
const REGISTRY_DEST = path.join(__dirname, '..', 'shared', 'method-registry.json');
const CHECK = process.argv.includes('--check');
import { normalizeCard } from '../lib/cards/reader.js';

/** Mirror of the parent-card test in lib/registers.js _loadCards(). */
function isParentCode(code) {
  return (
    code.startsWith('family-') ||
    code.startsWith('genus-') ||
    code.startsWith('macrolanguage-')
  );
}

/** A card belongs in the bundled core set if any of these hold. */
function isCoreCard(card) {
  if (card.iso639_1) return true;
  // x-* conlangs must ship: they are product features with no upstream, so
  // nothing can fetch them if the bundle omits them.
  if (card.code.startsWith('x-')) return true;
  // Locales are NOT selected here. This used to read `code.includes('-')`,
  // which was written when four locale variants existed; against 8,676 it
  // bundled a full copy of every one. They are added below as deltas, and only
  // where their parent is bundled too.
  // The CLDR-canonical member of a macro that carries the 639-1 — cmn is what
  // "zh" MEANS per CLDR, so the bundle serves the language, not only the tag.
  if (CANON_MEMBERS.has(card.code)) return true;
  if (card.scriptConverter || CONFIG_CONVERTERS.has(card.code)) return true;
  const fsts = card.resources?.fsts;
  // Old shape carried install{}; atlas entries carry the repo url directly.
  if (Array.isArray(fsts) && fsts.length > 0
      && (fsts[0].install || (fsts[0].url && fsts[0].publisher))) return true;
  return false;
}

const CANON_MEMBERS = new Set();
// Converter keys moved to the config kernel (gate 3) — the disk card no
// longer carries them, and the core set must not shrink because a decision
// changed address.
const CONFIG_CONVERTERS = new Set();
try {
  const _cfg = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'shared', 'catalogue', 'card-config.json'), 'utf-8',
  ));
  for (const k of Object.keys(_cfg.scriptConverter ?? {})) CONFIG_CONVERTERS.add(k);
} catch { /* partial checkout */ }

function loadAllCards() {
  const concrete = new Map();
  const parents = new Map();

  function scan(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const resPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(resPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        let card;
        try {
          card = normalizeCard(JSON.parse(fs.readFileSync(resPath, 'utf-8')));
        } catch {
          continue;
        }
        if (card._meta || !card.code) continue; // data files, not cards
        if (resPath.includes(path.sep + 'genera' + path.sep) || isParentCode(card.code)) {
          parents.set(card.code, card);
        } else {
          concrete.set(card.code, card);
        }
      }
    }
  }

  scan(CARDS_DIR);
  // Canonical members: a macro carrying iso639_1 + canonicalisedMembers makes
  // the member core (cmn via zh, arb via ar) — the bundle must serve the
  // language the tag canonicalises to, not only the tag.
  for (const c of concrete.values()) {
    if (!c.iso639_1) continue;
    let cm = c.canonicalisedMembers ?? c.canonicalisedMember;
    if (cm && typeof cm === 'object' && 'consensus' in cm) cm = cm.consensus;
    if (typeof cm === 'string') CANON_MEMBERS.add(cm);
  }
  // The x-* conlangs are product config, served from the kernel, not on disk.
  try {
    const cfg = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', '..', 'shared', 'catalogue', 'card-config.json'), 'utf-8',
    ));
    for (const [code, card] of Object.entries(cfg.conlangs ?? {})) {
      if (!concrete.has(code)) concrete.set(code, card);
    }
  } catch { /* no kernel in a partial checkout — the bundle test will say so */ }
  return { concrete, parents };
}

function sortObject(entries) {
  const out = {};
  for (const key of [...entries.keys()].sort()) out[key] = entries.get(key);
  return out;
}

function build() {
  const { concrete, parents } = loadAllCards();
  if (concrete.size === 0) {
    console.error('[ERR] No cards found in shared/language-cards/ — cannot build fallback.');
    process.exit(1);
  }

  // ── Core selection + extends closure ──────────────────────────
  const core = new Map();
  for (const [code, card] of concrete) {
    if (isCoreCard(card)) core.set(code, card);
  }

  // LOCALES SHIP AS DELTAS, NOT COPIES.
  //
  // A locale card is a projection: `fra-CA` is French's facts with the
  // CA-scoped values resolved. The projector materialises that as a full copy
  // of the parent, which is fine on disk and fatal in a published package —
  // 8,676 locales took the npm bundle from 5.3 MB to 86 MB, because the old
  // `code.includes('-')` core rule was written when four locale variants
  // existed and now matches every one of them.
  //
  // So a bundled locale carries only what makes it a locale — its id, its
  // `locale` block and its `localeScoped` values — and points at its parent
  // with `extends`, which the packaged registry already resolves. 208 KB
  // instead of 80 MB, and no fact stored twice.
  //
  // Only locales whose parent is itself bundled qualify: a delta whose parent
  // is absent would resolve to nothing offline, which is worse than not
  // shipping it. The rest stay in the manifest, so lookup still knows they
  // exist and fetches them.
  for (const [code, card] of concrete) {
    if (!card.locale?.language || !code.includes('-')) continue;
    const parent = card.locale.language;
    if (!core.has(parent) || core.has(code)) continue;
    const delta = { code, extends: parent, locale: card.locale };
    if (card.localeScoped) delta.localeScoped = card.localeScoped;
    if (card.script) delta.script = card.script;
    core.set(code, delta);
  }
  // Anything selected by the old catch-all that is a full locale COPY gets
  // reduced to its delta as well, so no path re-inflates the bundle.
  for (const [code, card] of core) {
    if (card.extends || !card.locale?.language || !code.includes('-')) continue;
    const parent = card.locale.language;
    if (!core.has(parent)) continue;
    const delta = { code, extends: parent, locale: card.locale };
    if (card.localeScoped) delta.localeScoped = card.localeScoped;
    if (card.script) delta.script = card.script;
    core.set(code, delta);
  }
  // Walk extends chains; pull in any concrete ancestor not already
  // selected (parents are all bundled anyway).
  let added = true;
  while (added) {
    added = false;
    for (const card of [...core.values()]) {
      const parent = card.extends;
      if (!parent || parents.has(parent) || core.has(parent)) continue;
      if (concrete.has(parent)) {
        core.set(parent, concrete.get(parent));
        added = true;
      }
    }
  }

  // ── Manifest of every concrete card ───────────────────────────
  const manifest = new Map();
  for (const [code, card] of concrete) {
    const entry = { n: card.name || code };
    if (Array.isArray(card.aliases) && card.aliases.length > 0) entry.a = card.aliases;
    if (card.dir && card.dir !== 'ltr') entry.d = card.dir;
    manifest.set(code, entry);
  }

  const bundle = {
    _meta: {
      v: 1,
      source: 'shared/language-cards',
      generatedBy: 'scripts/build-cards-fallback.mjs',
      selector: 'iso639_1 | locale-variant | scriptConverter | fst-install | extends-closure',
      coreCount: core.size,
      parentCount: parents.size,
      manifestCount: manifest.size,
    },
    manifest: sortObject(manifest),
    parents: sortObject(parents),
    cards: sortObject(core),
  };

  return JSON.stringify(bundle) + '\n';
}

const output = build();
const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);

if (CHECK) {
  let existing = null;
  try {
    existing = fs.readFileSync(OUT_FILE, 'utf-8');
  } catch {
    console.error('[ERR] shared/cards-fallback.json missing. Run: node scripts/build-cards-fallback.mjs');
    process.exit(1);
  }
  if (existing !== output) {
    console.error('[ERR] shared/cards-fallback.json is stale vs shared/language-cards/.');
    console.error('      Run: node scripts/build-cards-fallback.mjs');
    process.exit(1);
  }
  console.log(`✅ cards-fallback.json is fresh (${sizeMB} MB)`);
} else {
  fs.writeFileSync(OUT_FILE, output, 'utf-8');
  const meta = JSON.parse(output)._meta;
  console.log(`✅ shared/cards-fallback.json — ${meta.coreCount} core cards, ${meta.parentCount} parents, ${meta.manifestCount} manifest entries (${sizeMB} MB)`);
}

// ── Bundle the model-alias map (so `--model <alias>` resolves in installs) ──
let aliasSrc = null;
try {
  aliasSrc = fs.readFileSync(ALIAS_SRC, 'utf-8');
} catch {
  console.warn('[WARN] /shared/model-aliases.json not found — skipping alias bundle (monorepo-only build?).');
}
if (aliasSrc !== null) {
  if (CHECK) {
    let dest = null;
    try { dest = fs.readFileSync(ALIAS_DEST, 'utf-8'); } catch { /* missing */ }
    if (dest !== aliasSrc) {
      console.error('[ERR] shared/model-aliases.json is stale vs /shared/model-aliases.json.');
      console.error('      Run: node scripts/build-cards-fallback.mjs');
      process.exit(1);
    }
    console.log('✅ model-aliases.json is fresh');
  } else {
    fs.writeFileSync(ALIAS_DEST, aliasSrc, 'utf-8');
    const n = Object.keys(JSON.parse(aliasSrc)).filter((k) => !k.startsWith('_')).length;
    console.log(`✅ shared/model-aliases.json bundled (${n} aliases)`);
  }
}

// ── Bundle the method/provider registry SSOT (so the CLI's runtime-preferred
//    cli/shared/ copy is a regenerated build artifact, never a hand-edited one) ──
let registrySrc = null;
try {
  registrySrc = fs.readFileSync(REGISTRY_SRC, 'utf-8');
} catch {
  console.warn('[WARN] /shared/method-registry.json not found — skipping registry bundle (monorepo-only build?).');
}
if (registrySrc !== null) {
  if (CHECK) {
    let dest = null;
    try { dest = fs.readFileSync(REGISTRY_DEST, 'utf-8'); } catch { /* missing */ }
    if (dest !== registrySrc) {
      console.error('[ERR] shared/method-registry.json is stale vs /shared/method-registry.json.');
      console.error('      Run: node scripts/build-cards-fallback.mjs');
      process.exit(1);
    }
    console.log('✅ method-registry.json is fresh');
  } else {
    fs.writeFileSync(REGISTRY_DEST, registrySrc, 'utf-8');
    const n = Object.keys(JSON.parse(registrySrc).entries || {}).length;
    console.log(`✅ shared/method-registry.json bundled (${n} methods/providers)`);
  }
}
