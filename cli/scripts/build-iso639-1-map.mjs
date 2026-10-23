#!/usr/bin/env node
/**
 * build-iso639-1-map.mjs — the two-letter → three-letter language code table
 * (ISO 639-1 → ISO 639-3), derived from the card corpus's own iso639_1 field,
 * for tools that must compare "en" with "eng" with no card at hand: the
 * harness's `mt-eval serve` checked an app's source_locale through the cards
 * and, offline with no card cached, refused "en" against "eng" (the release
 * candidate's offline packaged walk, 2026-10-18).
 *
 *   node scripts/build-iso639-1-map.mjs          write shared/catalogue/iso639-1.json
 *                                                + its copy in the harness's package data
 *   node scripts/build-iso639-1-map.mjs --check  exit 3 when either is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(CLI, '..');
const fallback = JSON.parse(fs.readFileSync(path.join(CLI, 'shared', 'cards-fallback.json'), 'utf-8'));
const codes = {};
const sources = new Set();
for (const [code, card] of Object.entries(fallback.cards)) {
  if (!card || typeof card.iso639_1 !== 'string' || !card.iso639_1) continue;
  codes[card.iso639_1] = code;
  for (const s of card._fieldSources?.iso639_1 || []) sources.add(s);
}
const doc = {
  _comment: 'ISO 639-1 two-letter code → the card corpus\'s three-letter code. Built by '
    + 'cli/scripts/build-iso639-1-map.mjs from cli/shared/cards-fallback.json (each card\'s iso639_1); '
    + 'never edit by hand.',
  source: `derived:${[...sources].sort().join(',') || 'iso639-3'}`,
  codes: Object.fromEntries(Object.entries(codes).sort(([a], [b]) => a.localeCompare(b))),
};
const text = JSON.stringify(doc, null, 2) + '\n';
const targets = [path.join(REPO, 'shared', 'catalogue', 'iso639-1.json'),
  path.join(REPO, 'arena', 'mt_eval_harness', 'data', 'catalogue', 'iso639-1.json')];
if (process.argv.includes('--check')) {
  const stale = targets.filter((t) => !fs.existsSync(t) || fs.readFileSync(t, 'utf-8') !== text);
  if (stale.length) { console.error(`stale: ${stale.map((t) => path.relative(REPO, t)).join(', ')}`); process.exit(3); }
  console.log(`iso639-1 map current (${Object.keys(codes).length} codes)`);
} else {
  for (const t of targets) { fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, text); }
  console.log(`wrote ${Object.keys(codes).length} codes → ${targets.map((t) => path.relative(REPO, t)).join(', ')}`);
}
