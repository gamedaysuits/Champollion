#!/usr/bin/env node

/**
 * extractor: phoible → facts. Phonological inventories.
 *
 * PHOIBLE PUBLISHES INVENTORIES, NOT A LANGUAGE
 *   A language in PHOIBLE frequently has SEVERAL inventories, contributed from
 *   different descriptions, and they disagree: one source counts 21 consonants,
 *   another 24, because they analysed the same language differently. There is
 *   no PHOIBLE-blessed answer.
 *
 *   So each inventory's counts are asserted separately, keyed by contribution,
 *   and a single headline number is DERIVED as the median across them — under
 *   `champollion-derived`, with lineage edges to the per-inventory rows it was
 *   computed from. A median is our arithmetic, not PHOIBLE's claim, and the old
 *   pipeline's habit of writing it under PHOIBLE's name misrepresented them.
 *
 * TONE IS THE ONE PHOIBLE OWNS
 *   The house rule (lint R1) is that PHOIBLE's inventory is the SOLE tone
 *   authority, because Grambank has no tone feature at all — GB079 is "verb
 *   prefixes", and reading it as tone is a category error that has been made
 *   here before. A tone claim on a card must trace to a PHOIBLE segment with
 *   SegmentClass = tone.
 *
 *   Crucially, `hasTone: false` is only assertable when PHOIBLE SURVEYED the
 *   language and listed no tone segment. For a language PHOIBLE does not cover,
 *   the answer is not "no tone" — it is that nobody looked, which is recorded
 *   as `not_surveyed`. Collapsing those two is the same error that published
 *   `orthographicStatus: "unwritten"` about 1,318 languages.
 *
 * Usage:
 *   node cli/scripts/extractors/phoible.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { codeIndex, openExtraction, readCldf } from './lib/extract-lib.mjs';

export const source = 'phoible';
export const dir = 'phoible';
const SELF = 'extractors/phoible.mjs';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });
  const { languages, parameters, values } = readCldf(dir);
  const { map, unresolvable } = codeIndex(languages, x);

  // segment id -> consonant | vowel | tone
  const classOf = new Map();
  for (const p of parameters) if (p.SegmentClass) classOf.set(p.ID, p.SegmentClass);

  // code -> inventory id -> {consonant, vowel, tone}
  const perInventory = new Map();
  for (const v of values) {
    const code = map.get(v.Language_ID);
    if (!code) continue;
    const cls = classOf.get(v.Parameter_ID);
    if (!cls) continue;
    const inv = v.Contribution_ID || v.Language_ID;
    if (!perInventory.has(code)) perInventory.set(code, new Map());
    const invs = perInventory.get(code);
    if (!invs.has(inv)) invs.set(inv, { consonant: 0, vowel: 0, tone: 0 });
    const bucket = invs.get(inv);
    if (bucket[cls] !== undefined) bucket[cls]++;
  }

  let langs = 0;
  let multi = 0;
  for (const [code, invs] of perInventory) {
    langs++;
    if (invs.size > 1) multi++;
    const url = `https://phoible.org/languages/${code}`;

    const ids = { consonant: [], vowel: [], tone: [] };
    const counts = { consonant: [], vowel: [], tone: [] };

    for (const [inv, c] of invs) {
      for (const cls of ['consonant', 'vowel', 'tone']) {
        // Every inventory's own count, attributable to that inventory.
        const id = x.assert({
          code, domain: 'phonology', property: `${cls}Count`, value: String(c[cls]),
          valueType: 'integer', variant: `inv:${inv}`, url,
          notes: `PHOIBLE inventory ${inv}`,
        });
        if (id !== null) ids[cls].push(id);
        counts[cls].push(c[cls]);
      }
    }

    // The headline numbers are OURS: a median across disagreeing inventories.
    for (const cls of ['consonant', 'vowel', 'tone']) {
      x.derive({
        code, domain: 'phonology', property: `${cls}CountMedian`,
        value: String(median(counts[cls])), valueType: 'integer',
        inputIds: ids[cls],
        notes: `median of ${counts[cls].length} PHOIBLE inventor`
          + `${counts[cls].length === 1 ? 'y' : 'ies'}`
          + (invs.size > 1 ? ` (they range ${Math.min(...counts[cls])}–${Math.max(...counts[cls])})` : ''),
      });
    }

    // Tone, the one claim PHOIBLE is sole authority for.
    const toneTotal = counts.tone.reduce((a, b) => a + b, 0);
    x.assert({
      code, domain: 'phonology', property: 'hasTone', value: String(toneTotal > 0),
      valueType: 'boolean', url,
      notes: toneTotal > 0
        ? `PHOIBLE lists ${median(counts.tone)} tone segment(s)`
        : 'PHOIBLE surveyed this language and lists no tone segments',
    });
  }

  // Languages PHOIBLE does NOT cover get an explicit not_surveyed, so a card
  // can distinguish "no tone" from "no survey". Only for codes the spine has.
  let notSurveyed = 0;
  for (const code of x._knownCodes) {
    if (perInventory.has(code)) continue;
    x.absent({
      code, domain: 'phonology', property: 'hasTone', status: 'not_surveyed',
      valueType: 'boolean',
      notes: 'PHOIBLE has no inventory for this language — absence of a tone '
        + 'claim here is absence of a survey, not evidence of no tone',
    });
    notSurveyed++;
  }

  x._stats = { langs, multi, unresolvable, notSurveyed };
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ phoible → ${r.written.toLocaleString()} facts for `
      + `${s.langs.toLocaleString()} languages`);
    console.log(`    ${s.multi.toLocaleString()} of them have MORE THAN ONE inventory; each `
      + 'inventory\'s counts are kept');
    console.log('    separately and the headline number is a champollion-derived median');
    console.log(`    ${s.notSurveyed.toLocaleString()} spine languages marked not_surveyed for tone `
      + '— PHOIBLE never looked,');
    console.log('    which is not the same claim as "no tone"');
    if (s.unresolvable) console.log(`    ⚠ ${s.unresolvable} PHOIBLE row(s) unresolvable to a code`);
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine code(s) `
        + 'were NOT written');
    }
    console.log('');
  }
  x.close();
}
