#!/usr/bin/env node

/**
 * extractor: sil-iso639-3 → facts.
 *
 * WHAT ISO 639-3 IS AUTHORITATIVE FOR
 *   Code identity, and nothing else. It says a code exists, what it is called,
 *   whether it is individual or macro, whether it is living/extinct/ancient/
 *   historical/constructed, its two-letter and bibliographic equivalents, which
 *   macrolanguage subsumes it, and which codes it has retired.
 *
 *   It says NOTHING about classification, geography, phonology or vitality
 *   beyond the L/E/A/H/C type letter. Reading more into it than that is how
 *   `isoScope: "I"` came to be asserted about 751 languoids ISO has never
 *   coded at all.
 *
 * THE TYPE LETTER IS NOT A VITALITY JUDGEMENT
 *   `Language_Type = E` means ISO classifies the code as Extinct. That is a
 *   registry classification, recorded here as exactly that, under `identity`.
 *   It is NOT `vitality.status`, which is a separate claim carrying its own
 *   sources (ELCat, AES, Ethnologue) that frequently disagree — and which the
 *   card shows attributed rather than resolved.
 *
 * Usage:
 *   node cli/scripts/extractors/iso639-3.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { openExtraction } from './lib/extract-lib.mjs';

export const source = 'sil-iso639-3';
export const dir = 'iso639-3';
const SELF = 'extractors/iso639-3.mjs';

/** Tab-separated with a header row; SIL ships no quoting, so split is safe. */
function readTab(file) {
  const lines = fs.readFileSync(path.join(DATA_ROOT, dir, file), 'utf-8')
    .split(/\r?\n/).filter((l) => l.length);
  const header = lines[0].split('\t').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const f = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, (f[i] ?? '').trim()]));
  });
}

const SCOPE = { I: 'individual', M: 'macrolanguage', S: 'special' };
const TYPE = {
  L: 'living', E: 'extinct', A: 'ancient', H: 'historical',
  C: 'constructed', S: 'special',
};

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });

  const codes = readTab('iso-639-3.tab');
  const macros = readTab('iso-639-3-macrolanguages.tab');
  const names = readTab('iso-639-3_Name_Index.tab');
  const retirements = readTab('iso-639-3_Retirements.tab');

  // macrolanguage membership, both directions.
  //
  // The same rows read two ways: which macrolanguage subsumes an individual
  // language, and which individual languages a macrolanguage contains. The
  // live corpus carried these as separate `macrolanguage` and `varieties`
  // fields sourced independently; they are one fact, and reading it once means
  // they cannot disagree.
  const memberOf = new Map();
  const contains = new Map();
  for (const m of macros) {
    if (m.I_Status !== 'A' || !m.I_Id || !m.M_Id) continue;
    memberOf.set(m.I_Id, m.M_Id);
    if (!contains.has(m.M_Id)) contains.set(m.M_Id, []);
    contains.get(m.M_Id).push(m.I_Id);
  }

  // Every name ISO records for a code, minus the reference name itself.
  const altNames = new Map();
  for (const n of names) {
    if (!n.Id || !n.Print_Name) continue;
    if (!altNames.has(n.Id)) altNames.set(n.Id, new Set());
    altNames.get(n.Id).add(n.Print_Name);
    if (n.Inverted_Name && n.Inverted_Name !== n.Print_Name) {
      altNames.get(n.Id).add(n.Inverted_Name);
    }
  }

  const url = 'https://iso639-3.sil.org/code_tables/download_tables';

  for (const row of codes) {
    if (!row.Id) continue;
    const code = row.Id;
    const A = (property, value, extra = {}) => x.assert({
      code, domain: 'identity', property, value, url, raw: extra.raw ?? value, ...extra,
    });

    A('name', row.Ref_Name);
    A('iso639_3', code);
    if (row.Part1) A('iso639_1', row.Part1);
    if (row.Part2b) A('iso639_2b', row.Part2b);
    if (row.Part2t) A('iso639_2t', row.Part2t);

    // Scope and type are recorded under the registry's OWN vocabulary, expanded
    // to a readable word, with the raw letter kept so nothing is lost.
    // The registry's OWN letter is the value — 'I', not 'individual'. Expanding
    // it here would silently change the contract every consumer already reads,
    // and a rebuild is not the place to redefine a field. The readable form is
    // carried alongside so nothing has to look it up.
    if (SCOPE[row.Scope]) {
      A('isoScope', row.Scope, { notes: SCOPE[row.Scope] });
      A('isoScopeLabel', SCOPE[row.Scope], { raw: row.Scope });
    }
    if (TYPE[row.Language_Type]) {
      A('isoLanguageType', TYPE[row.Language_Type], { raw: row.Language_Type });
    }

    const macro = memberOf.get(code);
    if (macro) A('macrolanguage', macro);

    const alts = [...(altNames.get(code) ?? [])].filter((n) => n !== row.Ref_Name).sort();
    for (const [i, alt] of alts.entries()) {
      // One row per name. Under the old single-value key these collapsed to
      // whichever was written last, which is the same constraint that made
      // speakerEstimates[] unstorable.
      x.assert({
        code, domain: 'identity', property: 'alternateName', value: alt,
        variant: `n${i}`, url, raw: alt,
      });
    }
    if (!alts.length) {
      x.absent({
        code, domain: 'identity', property: 'alternateName',
        notes: 'ISO 639-3 name index records only the reference name for this code',
      });
    }
  }

  // The inverse: what a macrolanguage contains. Ordered so the list is stable
  // between runs.
  for (const [macro, members] of contains) {
    members.sort().forEach((member, i) => x.assert({
      code: macro, domain: 'identity', property: 'macrolanguageMember', value: member,
      variant: String(i).padStart(3, '0'), url,
      notes: 'an individual language ISO 639-3 places under this macrolanguage',
    }));
  }

  // Retirements are facts about codes that are GONE. Recording them is what
  // lets the projector redirect or mark rather than silently keep publishing a
  // language ISO withdrew — mrd and shl are both live cards today.
  for (const r of retirements) {
    if (!r.Id) continue;
    x.assert({
      code: r.Id, domain: 'identity', property: 'isoRetired', value: 'true',
      valueType: 'boolean', url,
      raw: `${r.Ret_Reason}${r.Change_To ? ` → ${r.Change_To}` : ''}`,
      notes: `${r.Ref_Name}: retired ${r.Effective}`
        + `${r.Change_To ? `, use ${r.Change_To}` : ''}`,
    });
    if (r.Change_To) {
      x.assert({
        code: r.Id, domain: 'identity', property: 'isoRetiredTo',
        value: r.Change_To, url, raw: r.Ret_Reason,
      });
    }
  }

  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared, nothing written.`);
  } else {
    const r = x.commit();
    console.log(`\n  ✓ sil-iso639-3 → ${r.written.toLocaleString()} facts`);
    console.log(`    asserted ${r.asserted.toLocaleString()} · absent ${r.absent} `
      + `· derived ${r.derived} · empty-skipped ${r.skipped}`);
    console.log(`    every one carries source_release ${r.releaseId}`);
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`\n    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes.toLocaleString()} `
        + 'code(s) the language spine does not carry were NOT written:');
      console.log(`      ${off.sample.join(', ')}${off.codes > off.sample.length ? ' …' : ''}`);
      console.log('      (facts key on languages(code); a code outside the spine is');
      console.log('       outside what we index. Reported, never silently dropped.)');
    }
    console.log('');
  }
  x.close();
}
