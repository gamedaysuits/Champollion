#!/usr/bin/env node

/**
 * download-firstvoices-keyboards.mjs
 * ────────────────────────────────────────────────────────────────
 * Caches the FirstVoices keyboard catalog (First Peoples' Cultural
 * Council, BC) from the Keyman keyboards monorepo.
 *
 * WHY A SEPARATE SOURCE: the fv_* keyboards live in
 * keymanapp/keyboards `release/fv/` but are NOT served by the Keyman
 * Cloud languages API (verified 2026-07-19: cloud/4.0/keyboards/
 * fv_plains_cree → 404, and the 533-language cloud cache contains no
 * fv entries) — so cards for exactly the languages FirstVoices serves
 * (100+ Indigenous languages) showed no keyboard support at all
 * (e.g. crk: null while fv_plains_cree exists upstream).
 *
 * DATA SOURCE:
 *   Listing: GitHub contents API — keymanapp/keyboards release/fv
 *   Per-keyboard: api.keyman.com/keyboard/<id> (keyboard-info JSON —
 *   the repo no longer tracks .keyboard_info files; they are built
 *   from the .kps package and served by this API, which covers fv_*
 *   even though the cloud/4.0 languages index does not)
 *
 * OUTPUT: cli/data/firstvoices-keyboards.json
 *   { retrievedAt, source, keyboards: [{id, name, languages[] (BCP-47),
 *     iso639_3[] (normalized against our cards), version, license}] }
 *
 * Usage: node scripts/download-firstvoices-keyboards.mjs
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const OUT = path.join(CLI_ROOT, 'data', 'firstvoices-keyboards.json');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

const LIST_URL = 'https://api.github.com/repos/keymanapp/keyboards/contents/release/fv?per_page=100';
// Per-keyboard metadata: the repo no longer tracks .keyboard_info files
// (they are build-generated from the .kps package); the canonical serving
// point is Keyman's keyboard-info API — which DOES cover fv_* keyboards,
// unlike the cloud/4.0 languages index (verified 2026-07-19:
// api.keyman.com/keyboard/fv_plains_cree → languages {crk}, license mit).
const INFO_URL = (id) => `https://api.keyman.com/keyboard/${id}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// BCP-47 → ISO 639-3 normalization against our own card set: the primary
// subtag either IS a card code (639-3 or 639-1-mapped via card.bcp47/iso639_1).
function buildIsoIndex() {
  const byPrimary = new Map();
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue;
    let card;
    try {
      card = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8'));
    } catch {
      continue;
    }
    const code = card.iso639_3 || card.code;
    if (!code) continue;
    for (const key of [card.code, card.iso639_3, card.iso639_1, card.bcp47]) {
      if (key && !byPrimary.has(String(key).toLowerCase())) {
        byPrimary.set(String(key).toLowerCase(), code);
      }
    }
  }
  return byPrimary;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Champollion/1.0 (language-cards enrichment)', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const listing = await fetchJson(LIST_URL);
const ids = listing.filter((e) => e.type === 'dir' && e.name.startsWith('fv_')).map((e) => e.name);
console.log(`fv keyboard directories: ${ids.length}`);

const isoIndex = buildIsoIndex();
const keyboards = [];
let failed = 0;
for (const id of ids) {
  try {
    const info = await fetchJson(INFO_URL(id));
    const langs = Array.isArray(info.languages)
      ? info.languages
      : info.languages && typeof info.languages === 'object'
        ? Object.keys(info.languages)
        : [];
    const iso = [...new Set(
      langs
        .map((tag) => String(tag).toLowerCase().split('-')[0])
        .map((primary) => isoIndex.get(primary))
        .filter(Boolean),
    )];
    keyboards.push({ id, name: info.name || id, languages: langs, iso639_3: iso, version: info.version || null, license: info.license || null });
  } catch (err) {
    failed++;
    console.warn(`  ⚠ ${id}: ${err.message}`);
  }
  await sleep(120);
}

const out = {
  retrievedAt: new Date().toISOString(),
  source: 'https://github.com/keymanapp/keyboards/tree/master/release/fv (FirstVoices / First Peoples’ Cultural Council)',
  note: 'fv_* keyboards are absent from the Keyman Cloud languages API (verified 2026-07-19); this cache is built from the keyboards monorepo directly.',
  keyboards,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
const withIso = keyboards.filter((k) => k.iso639_3.length).length;
console.log(`wrote ${OUT}: ${keyboards.length} keyboards (${withIso} mapped to card codes, ${failed} fetch failures)`);
