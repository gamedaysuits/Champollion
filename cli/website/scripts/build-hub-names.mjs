#!/usr/bin/env node
/**
 * build-hub-names.mjs — derive src/data/hub-names.json from the SSOT.
 *
 * Codes that appear on the board/mesh/registry but have NO trading-card
 * index row (macrolanguage hubs — deliberately purged from tc_index;
 * ISO 639-5 collectives; retired ISO 639-3 codes) still need honest
 * display names: the leaderboard must never render a bare "ARA".
 *
 * Sources (never hand-edit the output — rerun this script):
 *   - cli/shared/language-cards/genera/macrolanguage-*.json  (hub names)
 *   - cli/shared/language-cards/<code>.json isoScope==='M'   (flat hubs
 *     already have tc-index rows — NOT emitted here)
 *   - cli/data/iso639-3/iso-639-3.tab                        (macro Ref_Names
 *     without a genera card)
 *   - cli/data/iso639-3/iso-639-3_Retirements.tab            (retired codes)
 *   - cli/data/iso639-5/iso639-5.tsv                         (collectives)
 *
 * Fail-loud: missing source files abort the build (a silently empty map
 * would quietly regress the leaderboard back to bare codes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE = path.resolve(HERE, '..');
const MONOREPO = path.resolve(WEBSITE, '..', '..');
const GENERA = path.join(MONOREPO, 'cli', 'shared', 'language-cards', 'genera');
const ISO3_TAB = path.join(MONOREPO, 'cli', 'data', 'iso639-3', 'iso-639-3.tab');
const RETIRE_TAB = path.join(
  MONOREPO, 'cli', 'data', 'iso639-3', 'iso-639-3_Retirements.tab');
const ISO5_TSV = path.join(MONOREPO, 'cli', 'data', 'iso639-5', 'iso639-5.tsv');
const OUT = path.join(WEBSITE, 'src', 'data', 'hub-names.json');

function readTab(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`build-hub-names: pinned source missing: ${file}`);
  }
  const [header, ...rows] = fs.readFileSync(file, 'utf8')
    .replace(/^﻿/, '').split('\n').filter(Boolean);
  const cols = header.split('\t');
  return rows.map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

const out = {};

// ISO 639-3 macrolanguages (Ref_Name fallback), genera hub names win below.
for (const row of readTab(ISO3_TAB)) {
  if (row.Scope === 'M' && row.Id && row.Ref_Name) {
    out[row.Id] = { name: row.Ref_Name, scope: 'macrolanguage' };
  }
}

// Hand-written macrolanguage hub cards override the bare Ref_Name.
if (!fs.existsSync(GENERA)) {
  throw new Error(`build-hub-names: genera dir missing: ${GENERA}`);
}
for (const file of fs.readdirSync(GENERA)) {
  if (!file.startsWith('macrolanguage-') || !file.endsWith('.json')) continue;
  const card = JSON.parse(fs.readFileSync(path.join(GENERA, file), 'utf8'));
  const code = card.iso639_3 || card.macrolanguage;
  if (code && card.name) {
    out[code] = { name: card.name, scope: 'macrolanguage' };
  }
}

// ISO 639-5 collectives (families/groups — never languages).
for (const row of readTab(ISO5_TSV)) {
  const code = row.code;
  const name = row['Label (English)'];
  if (code && name && !out[code]) {
    out[code] = { name, scope: 'collective' };
  }
}

// Retired ISO 639-3 codes (historical board rows may still carry them).
for (const row of readTab(RETIRE_TAB)) {
  if (!row.Id || !row.Ref_Name || out[row.Id]) continue;
  out[row.Id] = {
    name: row.Ref_Name,
    scope: 'retired',
    ...(row.Change_To ? { successor: row.Change_To } : {}),
  };
}

const sorted = Object.fromEntries(
  Object.keys(out).sort().map((k) => [k, out[k]]));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`hub-names: ${Object.keys(sorted).length} codes -> ${OUT}`);
