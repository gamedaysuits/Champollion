#!/usr/bin/env node

/**
 * harvest-wikidata-endonyms.mjs
 * ────────────────────────────────────────────────────────────────
 * Fresh Wikidata endonym harvest, specced by docs/CARD_DATA_QUALITY_AUDIT.md
 * § 3b. Replaces the stale wikidata-native-labels.tsv snapshot path
 * (enrich-nativename-from-wikidata.mjs) for nativeName backfill.
 *
 * License: Wikidata is CC0-1.0 (shared/licenses.json `wikidata` entry) —
 * license-clean for redistribution, no attribution required (we attribute
 * anyway via _fieldSources / dataSources).
 *
 * Three query tiers, in apply-priority order:
 *   T1  P1705 (native label)        — with FILTER(!isBlank(?native)), the
 *                                     blank-node/genid filter whose absence
 *                                     caused the BSA corruption.
 *   T2  own-language rdfs:label     — language items with a Wikimedia
 *                                     language code (P424): rdfs:label
 *                                     filtered to LANG(?label) = that code.
 *   T3  P1448 (official name)       — fallback tier, stamped separately.
 *
 * Two-phase operation:
 *   node scripts/harvest-wikidata-endonyms.mjs
 *       → batched SPARQL against query.wikidata.org (polite: identifying
 *         User-Agent, ~300 codes per VALUES batch, sleep between queries,
 *         retry-with-backoff on 429/5xx). Writes the harvest snapshot to
 *         cli/data/wikidata-endonyms-harvest.json. NO card writes.
 *
 *   node scripts/harvest-wikidata-endonyms.mjs --apply [--dry-run]
 *       → reads the harvest snapshot and fills nativeName on cards where
 *         it is null (merge-only; never overwrites). Stamps
 *         _fieldSources.nativeName = wikidata-P1705 | wikidata-rdfs-label-own
 *         | wikidata-P1448 and appends the stamp to dataSources.
 *
 * Apply-time guards:
 *   - URL / wikidata blank-node genid shapes are rejected (defense in
 *     depth; the harvest already filters isBlank server-side).
 *   - labels identical to the card's English name are skipped.
 *   - ASCII policy (FIXES the audit's § 3a bug): pure-ASCII labels are
 *     VALID endonyms — most languages of the Americas and Australia use
 *     Latin orthographies. A pure-ASCII label is skipped ONLY when the
 *     card's own script metadata says the language is written in a
 *     non-Latin script (then an ASCII label is likely a transliteration).
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const HARVEST_PATH = path.join(CLI_ROOT, 'data', 'wikidata-endonyms-harvest.json');

const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ChampollionEndonymHarvest/1.0 (Champollion language-card data quality; see docs/CARD_DATA_QUALITY_AUDIT.md; contact: dev@champollion.local)';
const BATCH_SIZE = 300;
const SLEEP_MS = 1200;

// Apply-priority order. Stamp keys follow the wikidata-P1705 convention.
const TIERS = [
  { key: 'P1705', stamp: 'wikidata-P1705', citation: 'Wikidata. Property P1705 (native label). https://www.wikidata.org/wiki/Property:P1705' },
  { key: 'ownLabel', stamp: 'wikidata-rdfs-label-own', citation: 'Wikidata. rdfs:label in the item\'s own language (via P424 Wikimedia language code). https://www.wikidata.org/' },
  { key: 'P1448', stamp: 'wikidata-P1448', citation: 'Wikidata. Property P1448 (official name). https://www.wikidata.org/wiki/Property:P1448' },
];

// ─── Guards (shared shapes with fix-card-corruption.mjs) ────────
const RE_URL = /^(https?|ftp):\/\/\S+/i;
const RE_GENID = /\.well-known\/genid\//i;

function isMalformed(label) {
  if (!label || label.trim().length === 0) return true;
  if (RE_URL.test(label) || RE_GENID.test(label)) return true;
  if (/^Q\d+$/.test(label.trim())) return true; // bare entity id
  return false;
}

function isPureAscii(label) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]+$/.test(label);
}

/**
 * True when the card's own metadata says the language is written in a
 * non-Latin script (no Latn anywhere) — only then is a pure-ASCII label
 * suspicious as a transliteration. Cards with no script data at all get
 * the benefit of the doubt (ASCII allowed): for the under-covered
 * macroareas that is exactly the population the old ASCII-skip starved.
 */
function cardIsNonLatinOnly(card) {
  const scripts = new Set();
  if (typeof card.script === 'string' && card.script) scripts.add(card.script);
  if (Array.isArray(card.scripts)) {
    for (const s of card.scripts) {
      if (typeof s === 'string') scripts.add(s);
      else if (s && typeof s === 'object' && typeof s.code === 'string') scripts.add(s.code);
    }
  }
  if (scripts.size === 0) return false;
  return !scripts.has('Latn');
}

// ─── SPARQL plumbing ────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sparql(query, attempt = 1) {
  const res = await fetch(ENDPOINT + '?query=' + encodeURIComponent(query), {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json' },
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`SPARQL ${res.status} after ${attempt} attempts`);
    const backoff = SLEEP_MS * 2 ** attempt;
    console.log(`    ↻ HTTP ${res.status}, backing off ${backoff}ms (attempt ${attempt})`);
    await sleep(backoff);
    return sparql(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function valuesClause(codes) {
  return codes.map(c => JSON.stringify(c)).join(' ');
}

function tierQuery(tierKey, codes) {
  const V = valuesClause(codes);
  switch (tierKey) {
    case 'P1705':
      return `SELECT ?iso ?v (LANG(?v) AS ?vlang) WHERE {
        VALUES ?iso { ${V} }
        ?lang wdt:P220 ?iso ; wdt:P1705 ?v .
        FILTER(!isBlank(?v))
      }`;
    case 'ownLabel':
      return `SELECT ?iso ?v (LANG(?v) AS ?vlang) WHERE {
        VALUES ?iso { ${V} }
        ?lang wdt:P220 ?iso ; wdt:P424 ?wmf ; rdfs:label ?v .
        FILTER(!isBlank(?v))
        FILTER(LANG(?v) = LCASE(?wmf))
      }`;
    case 'P1448':
      return `SELECT ?iso ?v (LANG(?v) AS ?vlang) WHERE {
        VALUES ?iso { ${V} }
        ?lang wdt:P220 ?iso ; wdt:P1448 ?v .
        FILTER(!isBlank(?v))
      }`;
    default:
      throw new Error('unknown tier ' + tierKey);
  }
}

// ─── Phase 1: harvest ───────────────────────────────────────────

async function harvest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Wikidata endonym harvest (phase 1: snapshot, no card writes)');
  console.log(`  Endpoint: ${ENDPOINT}`);
  console.log(`  Batch: ${BATCH_SIZE} ISO codes / query, sleep ${SLEEP_MS}ms`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const codes = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json')
    .map(f => f.replace(/\.json$/, ''))
    .filter(c => /^[a-z]{3}$/.test(c)) // P220 is 3-letter ISO 639-3 only
    .sort();
  console.log(`  ISO 639-3 codes to query: ${codes.length}`);

  const byIso = {};
  const ensure = (iso) => (byIso[iso] = byIso[iso] || { P1705: [], ownLabel: [], P1448: [] });

  for (const tier of TIERS) {
    let rows = 0;
    for (let i = 0; i < codes.length; i += BATCH_SIZE) {
      const batch = codes.slice(i, i + BATCH_SIZE);
      const json = await sparql(tierQuery(tier.key, batch));
      for (const b of json.results.bindings) {
        const iso = b.iso?.value;
        const v = b.v?.value;
        if (!iso || !v) continue;
        if (b.v.type !== 'literal') continue;      // genid/IRI guard, belt & braces
        if (isMalformed(v)) continue;
        const entry = ensure(iso);
        if (!entry[tier.key].some(e => e.value === v)) {
          entry[tier.key].push({ value: v, lang: b.vlang?.value || b.v['xml:lang'] || null });
          rows++;
        }
      }
      process.stdout.write(`  ${tier.key}: batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(codes.length / BATCH_SIZE)} (rows so far: ${rows})\r`);
      await sleep(SLEEP_MS);
    }
    console.log(`\n  ${tier.key}: ${rows} usable labels harvested`);
  }

  const out = {
    meta: {
      retrieved: new Date().toISOString(),
      endpoint: ENDPOINT,
      userAgent: USER_AGENT,
      license: 'CC0-1.0 (shared/licenses.json: wikidata)',
      tiers: TIERS.map(t => t.key),
      isoCodesQueried: codes.length,
    },
    byIso,
  };
  fs.writeFileSync(HARVEST_PATH, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(`\n  Harvest written: ${HARVEST_PATH} (${Object.keys(byIso).length} ISO codes with data)`);
  console.log('  Next: node scripts/harvest-wikidata-endonyms.mjs --apply');
}

// ─── Phase 2: apply ─────────────────────────────────────────────

/** BCP-47 tags meaning "no specific language" — not foreign evidence. */
const NONSPECIFIC_LANG_TAGS = new Set(['mis', 'und', 'zxx', 'mul']);

/**
 * Language-tag guard (2026-06-11 endonym incident): each harvested label
 * carries the language OF THE LABEL (`lang`). The original apply step
 * dropped it, importing other-language labels as endonyms ("bahasa
 * Nedebang"@id for nec — an Indonesian label, not an endonym). A label is
 * usable only when its tag is the card's own language (incl. bcp47 /
 * macrolanguage base) or carries no specific language tag.
 * Post-apply, run scripts/validate-endonyms.mjs --ci as the gate.
 */
function isOwnLanguageLabel(entry, card) {
  if (!entry.lang) return true;
  const base = String(entry.lang).toLowerCase().split('-')[0];
  if (NONSPECIFIC_LANG_TAGS.has(base)) return true;
  const own = new Set(
    [card.code, card.iso639_3, card.bcp47, card.macrolanguage]
      .filter(c => typeof c === 'string' && c)
      .map(c => c.toLowerCase().split('-')[0]),
  );
  return own.has(base);
}

function pickCandidate(values, card) {
  // Deterministic: prefer a label that differs from the English name and
  // passes the script-aware ASCII guard; among those, prefer non-ASCII
  // (native script) when the card has a non-Latin script, else first
  // by stable sort.
  const nameLower = (card.name || '').toLowerCase();
  const nonLatinOnly = cardIsNonLatinOnly(card);
  const ok = values
    .filter(e => isOwnLanguageLabel(e, card))
    .map(e => e.value.trim())
    .filter(v => !isMalformed(v))
    .filter(v => v.toLowerCase() !== nameLower)
    .filter(v => !(isPureAscii(v) && nonLatinOnly))
    .sort();
  if (ok.length === 0) return null;
  if (nonLatinOnly) {
    const native = ok.find(v => !isPureAscii(v));
    if (native) return native;
  }
  return ok[0];
}

function apply() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Wikidata endonym harvest (phase 2: apply to cards)');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(HARVEST_PATH)) {
    console.error('  ❌ No harvest snapshot at ' + HARVEST_PATH + ' — run phase 1 first.');
    process.exit(1);
  }
  const { meta, byIso } = JSON.parse(fs.readFileSync(HARVEST_PATH, 'utf-8'));
  console.log(`  Harvest snapshot: retrieved ${meta.retrieved}, ${Object.keys(byIso).length} codes\n`);

  const files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  const tally = { filled: 0, byTier: {}, alreadyHad: 0, noData: 0, allFiltered: 0 };
  const samples = [];

  for (const file of files) {
    const filePath = path.join(CARDS_DIR, file);
    let card;
    try { card = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { continue; }

    if (card.nativeName) { tally.alreadyHad++; continue; } // merge-only
    const code = card.code || card.iso639_3 || file.replace(/\.json$/, '');
    const entry = byIso[code];
    if (!entry) { tally.noData++; continue; }

    let chosen = null, tier = null;
    for (const t of TIERS) {
      const candidate = pickCandidate(entry[t.key] || [], card);
      if (candidate) { chosen = candidate; tier = t; break; }
    }
    if (!chosen) { tally.allFiltered++; continue; }

    card.nativeName = chosen;
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.nativeName = tier.stamp;
    const sources = Array.isArray(card.dataSources) ? card.dataSources : [];
    if (!sources.includes(tier.stamp)) sources.push(tier.stamp);
    card.dataSources = sources;

    tally.filled++;
    tally.byTier[tier.stamp] = (tally.byTier[tier.stamp] || 0) + 1;
    if (samples.length < 40) samples.push(`  ${code.padEnd(5)} ← ${chosen}   [${tier.stamp}]`);

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log('  RESULTS' + (DRY_RUN ? ' (dry run — nothing written)' : '') + ':');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards already had nativeName:  ${tally.alreadyHad.toLocaleString()}`);
  console.log(`  No harvest data for code:      ${tally.noData.toLocaleString()}`);
  console.log(`  All candidates filtered out:   ${tally.allFiltered.toLocaleString()}`);
  console.log(`  Cards filled:                  ${tally.filled.toLocaleString()}`);
  for (const [stamp, n] of Object.entries(tally.byTier)) {
    console.log(`      ${stamp.padEnd(26)} ${n}`);
  }
  if (samples.length) {
    console.log('\n  Sample fills:');
    for (const s of samples) console.log(s);
  }
}

if (APPLY) {
  apply();
} else {
  await harvest();
}
