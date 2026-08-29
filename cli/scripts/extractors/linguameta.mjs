#!/usr/bin/env node

/**
 * extractor: linguameta → facts. Endonyms, speaker counts, writing systems.
 *
 * WHAT IT SUPPLIES THAT NOTHING ELSE DOES
 *   The endonym — what speakers call the language themselves — plus BCP-47
 *   tags, writing systems and CLDR official status, for 7,511 languages. On the
 *   live cards these fields are among the most widely populated and among the
 *   least traceable; `nativeName` sits on 8,669 cards with provenance recorded
 *   as a bare `wikidata-P1705`, which names a Wikidata property but no revision,
 *   no date and no fetchable artefact.
 *
 * SPEAKER COUNTS SIT BESIDE ELCat'S, NOT ON TOP OF THEM
 *   LinguaMeta gives one aggregated figure per language. ELCat gives several,
 *   per source, often disagreeing. Both go into `speakerEstimates` as separate
 *   attributed rows — which is the whole reason that field is an `attributed`
 *   projection rather than a single number. Choosing between them would be the
 *   index arbitrating, which is precisely what it must not do.
 *
 * WHAT IS DELIBERATELY NOT TAKEN
 *   `glottocode` and `wikidata_id`. LinguaMeta carries both, but Glottolog is
 *   already the cited authority for glottocodes and taking a second opinion
 *   would put one field behind two disagreeing sources. Wikidata ids are an
 *   external key we have no fetcher for; recording one would imply a lookup
 *   nothing here can perform.
 *
 * ENDANGERMENT IS TAKEN BUT KEPT SEPARATE
 *   LinguaMeta's `endangerment_status` is a THIRD assessment beside ELCat's and
 *   Glottolog's AES. It is recorded under its own property so a card can show
 *   all three attributed. Three sources disagreeing is information; one number
 *   is a decision we have no standing to make.
 *
 * Usage:
 *   node cli/scripts/extractors/linguameta.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { openExtraction } from './lib/extract-lib.mjs';

export const source = 'linguameta';
export const dir = 'linguameta';
const SELF = 'extractors/linguameta.mjs';

const URL = 'https://github.com/google-research/url-nlp/tree/main/linguameta';

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });

  // Tab-separated, no quoting in this file — but read defensively and skip a
  // row whose column count does not match the header rather than silently
  // shifting every field left.
  const text = fs.readFileSync(path.join(DATA_ROOT, dir, 'linguameta.tsv'), 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const header = lines[0].split('\t');
  const stats = { rows: 0, malformed: 0, endonyms: 0, speakers: 0, scripts: 0 };

  for (const line of lines.slice(1)) {
    const f = line.split('\t');
    if (f.length !== header.length) { stats.malformed++; continue; }
    const r = Object.fromEntries(header.map((h, i) => [h, (f[i] ?? '').trim()]));
    const code = x.resolveCode(r.iso_639_3_code, r.glottocode);
    if (!code) continue;
    stats.rows++;

    if (r.bcp_47_code) {
      x.assert({ code, domain: 'identity', property: 'bcp47', value: r.bcp_47_code, url: URL });
    }
    if (r.english_name) {
      x.assert({ code, domain: 'identity', property: 'linguametaName',
        value: r.english_name, url: URL });
    }

    if (r.endonym) {
      x.assert({
        code, domain: 'identity', property: 'endonym', value: r.endonym, url: URL,
        raw: r.endonym,
        notes: 'the name speakers use for the language themselves, as LinguaMeta records it',
      });
      stats.endonyms++;
    } else {
      // An endonym gap is a real, reportable state — and the corpus has a known
      // skew here worth disclosing rather than papering over.
      x.absent({
        code, domain: 'identity', property: 'endonym',
        notes: 'LinguaMeta covers this language but records no endonym',
      });
    }

    // One aggregated figure. Variant 'lm' keeps it distinct from every ELCat
    // per-source estimate rather than overwriting one.
    const n = /^\d+$/.test(r.estimated_number_of_speakers.replace(/,/g, ''))
      ? r.estimated_number_of_speakers.replace(/,/g, '') : null;
    if (n) {
      x.assert({
        code, domain: 'vitality', property: 'speakerCount', value: n, valueType: 'integer',
        variant: 'lm', url: URL, raw: r.estimated_number_of_speakers,
        notes: 'LinguaMeta aggregated estimate',
      });
      stats.speakers++;
    }

    // Writing systems: space-separated ISO 15924 codes, first listed treated as
    // primary by LinguaMeta's own ordering.
    const scripts = r.writing_systems.split(/[\s,]+/).filter(Boolean);
    if (scripts.length) {
      scripts.forEach((s, i) => x.assert({
        code, domain: 'orthography', property: 'script', value: s,
        variant: String(i).padStart(2, '0'), url: URL,
        notes: i === 0 ? 'listed first by LinguaMeta' : null,
      }));
      stats.scripts++;
    } else {
      // The distinction that matters: LinguaMeta LOOKED and lists none. That is
      // still not licence to call the language unwritten — which is exactly the
      // inference that put orthographicStatus:"unwritten" on 1,318 languages.
      x.absent({
        code, domain: 'orthography', property: 'script',
        notes: 'LinguaMeta covers this language and lists no writing system. This '
          + 'is an absence of record, NOT evidence that the language is unwritten.',
      });
    }

    if (r.endangerment_status) {
      x.assert({
        code, domain: 'vitality', property: 'linguametaEndangerment',
        value: r.endangerment_status, url: URL,
        notes: 'a third assessment beside ELCat and Glottolog AES — shown attributed, '
          + 'never merged with them',
      });
    }
    if (r.cldr_official_status) {
      x.assert({ code, domain: 'identity', property: 'cldrOfficialStatus',
        value: r.cldr_official_status, url: URL });
    }
    if (r.is_macrolanguage === 'True') {
      x.assert({ code, domain: 'identity', property: 'linguametaIsMacrolanguage',
        value: 'true', valueType: 'boolean', url: URL });
    }
  }

  x._stats = stats;
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ linguameta → ${r.written.toLocaleString()} facts from `
      + `${s.rows.toLocaleString()} rows`);
    console.log(`    ${s.endonyms.toLocaleString()} endonyms · ${s.speakers.toLocaleString()} `
      + `speaker estimates · ${s.scripts.toLocaleString()} with a writing system`);
    if (s.malformed) {
      console.log(`    ⚠ ${s.malformed} malformed row(s) skipped rather than shifted`);
    }
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.facts.toLocaleString()} fact(s) about ${off.codes} off-spine `
        + 'code(s) were NOT written');
    }
    console.log('');
  }
  x.close();
}
