#!/usr/bin/env node

/**
 * audit-code-bridge.mjs — how much of code-bridge.json the resolver subsumes.
 *
 * `cli/shared/code-bridge.json` hand-maps 217 external dataset codes onto ISO
 * 639-3, and the rebuild plan asserted the cited tag resolver had made it
 * redundant. That was too fast. 13 namespaces are not all the same kind of
 * thing, and the file has live consumers in the corpora-builder lane, so the
 * claim needed measuring rather than acting on.
 *
 * Measured (2026-08-06, forward mappings only — the `_reverse` namespaces are
 * the same facts written backwards):
 *
 *   73  SUBSUMED         plain ISO 639-1 → 639-3; the resolver does this alone
 *   38  MACROLANGUAGE    a routing the registries now answer, with a citation
 *    1  DATASET-SPECIFIC ntrex maps `fil` → `tgl`, which is NTREX's own call
 *    0  UNRESOLVED
 *
 * So the file is ~99% superseded, and the residue is the interesting part:
 *
 *   ntrex fil → tgl   Filipino to Tagalog. A real editorial decision by the
 *                     dataset, not a code translation. It must survive.
 *
 *   tico19 din → dip  Dinka to NORTHEASTERN Dinka, where CLDR and SIL langtags
 *                     both name SOUTHWESTERN (dik). A genuine disagreement
 *                     between a dataset and the registries, and exactly the
 *                     kind of thing a hand-maintained mapping hides — it has
 *                     been sitting in this file unremarked.
 *
 *   flores zho_Hans → cmn-Hans is NOT a disagreement: it agrees on the language
 *   and adds a script, which this audit reports as differing because it
 *   compares strings.
 *
 * Re-run after any resolver change. A rising SUBSUMED count is the file
 * shrinking toward the handful of entries that are genuinely dataset knowledge.
 *
 * Usage:
 *   node cli/scripts/audit-code-bridge.mjs
 */
import fs from 'node:fs';
import { resolveTag, ROUTE } from '../lib/tags/resolve.js';

const index = JSON.parse(fs.readFileSync(new URL('../../build/atlas/tag-index.json', import.meta.url), 'utf8'));
const bridge = JSON.parse(fs.readFileSync(new URL('../shared/code-bridge.json', import.meta.url), 'utf8'));

const buckets = { subsumed: [], macrolanguage: [], datasetSpecific: [], unresolved: [] };

for (const [ns, map] of Object.entries(bridge)) {
  if (ns.startsWith('$') || ns.startsWith('_') || ns === 'version') continue;
  if (ns.endsWith('_reverse')) continue; // the same fact, written backwards
  for (const [from, to] of Object.entries(map)) {
    const r = resolveTag(from, { index });
    const entry = `${ns}: ${from} → ${to}`;

    if (r.route === ROUTE.EXACT && r.language === to) {
      buckets.subsumed.push(entry); // resolver reaches the same answer alone
    } else if (r.route === ROUTE.MACROLANGUAGE) {
      const p = r.predominant?.language;
      buckets.macrolanguage.push(
        `${entry}  [resolver: macrolanguage ${r.language}, `
        + `${p ? `predominant ${p}${p === to ? ' — agrees' : ' — DIFFERS'}` : 'no predominant'}]`,
      );
    } else if (r.route === ROUTE.EXACT) {
      buckets.datasetSpecific.push(`${entry}  [resolver alone says ${r.language}]`);
    } else {
      buckets.unresolved.push(`${entry}  [resolver: ${r.route}]`);
    }
  }
}

for (const [k, v] of Object.entries(buckets)) {
  console.log(`\n${k.toUpperCase()} — ${v.length}`);
  for (const e of v.slice(0, 12)) console.log('   ', e);
  if (v.length > 12) console.log(`    … and ${v.length - 12} more`);
}
