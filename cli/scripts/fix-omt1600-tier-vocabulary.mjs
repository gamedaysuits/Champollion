#!/usr/bin/env node
/**
 * fix-omt1600-tier-vocabulary.mjs — clear non-paper `omt1600.tier` values.
 *
 * The Omnilingual MT paper (arXiv:2603.16309) names its resource tiers in
 * §3.3 / Figure 3.2 (buckets `0_high…4_zero`):
 *
 *     high      >50M parallel documents
 *     mid       >1M
 *     low       40K–1M
 *     very_low  1K–40K   (the paper's "extremely low resource")
 *     zero      <1K
 *
 * `R1`/`R2` appear in the paper's tables as Met-BOUQuET **annotation rounds**,
 * never as resource tiers — and `R3`/`R4`/`R5` do not appear as round labels at
 * all. The `R1`…`R5` values that shipped on the hand-curated cards were a
 * misreading, and internally contradictory (the old schema glossed R1 as
 * high-resource; the public docs glossed R1 as very-low).
 *
 * The paper publishes no per-language tier table, so a per-language tier is
 * uncitable. Champollion is an INDEX: an uncitable value is REMOVED, never
 * remapped or inferred. This script therefore nulls every tier outside the
 * paper's vocabulary — it does not translate R-values into paper tiers, and it
 * leaves `covered`, `evalMetrics` and `notes` untouched.
 *
 * Idempotent: a second run reports 0 changes.
 *
 *   node cli/scripts/fix-omt1600-tier-vocabulary.mjs [--dry]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');

/** The paper's own resource-tier vocabulary. Anything else is not citable. */
const PAPER_TIERS = new Set(['high', 'mid', 'low', 'very_low', 'zero']);

const DRY = process.argv.includes('--dry');

function main() {
  const files = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json')
    .sort();

  const cleared = [];
  let scanned = 0;

  for (const file of files) {
    const full = path.join(CARDS_DIR, file);
    const raw = fs.readFileSync(full, 'utf-8');

    let card;
    try {
      card = JSON.parse(raw);
    } catch (err) {
      // Fail loud: a card we cannot parse is a card we cannot vouch for.
      console.error(`ERROR: ${file} is not valid JSON — ${err.message}`);
      process.exitCode = 1;
      continue;
    }

    scanned++;
    const tier = card.omt1600?.tier;
    if (typeof tier !== 'string' || PAPER_TIERS.has(tier)) continue;

    card.omt1600.tier = null;
    cleared.push({ file, was: tier });

    if (!DRY) {
      // Cards are canonically 2-space JSON with a trailing newline; this
      // round-trips byte-identically for every untouched field.
      fs.writeFileSync(full, `${JSON.stringify(card, null, 2)}\n`);
    }
  }

  const byValue = new Map();
  for (const { was } of cleared) byValue.set(was, (byValue.get(was) || 0) + 1);

  console.log(`Scanned ${scanned} cards in ${path.relative(process.cwd(), CARDS_DIR)}`);
  if (cleared.length === 0) {
    console.log('No non-paper omt1600.tier values found — nothing to do.');
    return;
  }
  console.log(`${DRY ? 'Would clear' : 'Cleared'} ${cleared.length} non-paper tier value(s):`);
  for (const [was, n] of [...byValue].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${was} → null  (${n} card${n === 1 ? '' : 's'})`);
  }
  if (DRY) console.log('\n(dry run — no files written)');
}

main();
