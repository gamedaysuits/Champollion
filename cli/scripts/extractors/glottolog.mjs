#!/usr/bin/env node

/**
 * extractor: glottolog → facts.
 *
 * WHAT GLOTTOLOG IS AUTHORITATIVE FOR
 *   Genealogical classification and languoid identity: the family a language
 *   belongs to, its position in the tree, whether it is an isolate, its
 *   macroarea, a point coordinate, and the countries it is spoken in.
 *
 * TWO DERIVATIONS, LABELLED AS SUCH
 *   `genus` and `dialectCount` are NOT Glottolog fields. Glottolog publishes a
 *   tree; a "genus" is our reading of it (see below for which reading, and why
 *   that choice is not arbitrary), and a dialect count is our tally. Both are
 *   Champollion derivations, written under `champollion-derived` with lineage
 *   edges to the rows they were computed from — never under Glottolog's name.
 *
 *   That is the rule the codebase already states and the old pipeline broke:
 *   writing a computed value under an upstream's `source` misrepresents that
 *   upstream and breaks licence passthrough. It also matters practically —
 *   Glottolog's own `child_dialect_count` counts DIRECT children only, so a
 *   language whose dialects nest two deep is undercounted by it. We count the
 *   whole subtree, which is a different number, and must not wear their name.
 *
 * WHAT IT DELIBERATELY DOES NOT EXTRACT
 *   Nothing about vitality. Glottolog's AES values are a separate dataset with
 *   their own release and their own disagreements with ELCat and Ethnologue,
 *   and the card's job is to show those attributed rather than pick one here.
 *
 * Usage:
 *   node cli/scripts/extractors/glottolog.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { parseCSVObjects } from '../lib/csv.mjs';
import { openExtraction } from './lib/extract-lib.mjs';

export const source = 'glottolog';
export const dir = 'glottolog';
const SELF = 'extractors/glottolog.mjs';

/**
 * Glottolog top-level nodes that are FILING BUCKETS, not genealogical families.
 *
 * Verified against languoid.csv: each is level=family, and each states something
 * about an entry's STATUS rather than its ancestry. The live corpus already
 * distinguishes them; the extractor must too, or the projection would regress
 * 441 cards into asserting a family that is not one.
 */
const BUCKETS = {
  book1242: 'Bookkeeping',
  spee1234: 'Speech Register',
  arti1236: 'Artificial Language',
  unat1236: 'Unattested',
  uncl1493: 'Unclassifiable',
  pidg1258: 'Pidgin',
  mixe1287: 'Mixed Language',
};

export function extract({ db = null } = {}) {
  const x = openExtraction({ source, dir, extractor: SELF, db });

  const { rows } = parseCSVObjects(
    fs.readFileSync(path.join(DATA_ROOT, dir, 'languoid.csv'), 'utf-8'),
    { file: 'glottolog/languoid.csv' },
  );

  const byId = new Map();
  const childrenOf = new Map();
  for (const r of rows) {
    byId.set(r.id, r);
    if (r.parent_id) {
      if (!childrenOf.has(r.parent_id)) childrenOf.set(r.parent_id, []);
      childrenOf.get(r.parent_id).push(r);
    }
  }

  /** Ancestors root-first, guarding against a cycle rather than trusting the file. */
  const ancestry = (node) => {
    const out = [];
    const seen = new Set();
    let cur = node;
    while (cur?.parent_id && !seen.has(cur.parent_id)) {
      seen.add(cur.parent_id);
      const parent = byId.get(cur.parent_id);
      if (!parent) break;
      out.unshift(parent);
      cur = parent;
    }
    return out;
  };

  /** Every dialect in the subtree, not just direct children. */
  const dialectsUnder = (node) => {
    let n = 0;
    const stack = [...(childrenOf.get(node.id) ?? [])];
    while (stack.length) {
      const c = stack.pop();
      if (c.level === 'dialect') n++;
      stack.push(...(childrenOf.get(c.id) ?? []));
    }
    return n;
  };

  let noIso = 0;
  let isoDialects = 0;
  for (const r of rows) {
    // ── Which languoids get facts ────────────────────────────────────────
    //
    // Every Glottolog language, PLUS every Glottolog dialect that carries an
    // ISO 639-3 code. The second half matters: 262 codes ISO registers as
    // languages are ranked as dialects by Glottolog 5.3 — `act` (Achterhoeks)
    // is one. Those cards exist on ISO's authority, and skipping them here
    // would strip their classification, geography and glottocode entirely and
    // call it a clean rebuild.
    //
    // The rank disagreement is itself recorded, because "ISO codes this as a
    // language, Glottolog treats it as a dialect" is exactly the kind of thing
    // an index should surface rather than resolve.
    const isIsoDialect = r.level === 'dialect' && Boolean(r.iso639P3code);
    if (r.level !== 'language' && !isIsoDialect) continue;
    if (isIsoDialect) isoDialects++;
    // Facts key on the code the rest of the system uses. A languoid with no ISO
    // code is keyed by glottocode — it is still a language, and dropping it
    // here would silently narrow the atlas from a loader.
    const code = r.iso639P3code || r.id;
    if (!r.iso639P3code) noIso++;

    const url = `https://glottolog.org/resource/languoid/id/${r.id}`;
    const A = (property, value, extra = {}) => x.assert({
      code, domain: extra.domain ?? 'identity', property, value, url,
      raw: extra.raw ?? value, ...extra,
    });

    const gcId = A('glottocode', r.id);
    A('glottologName', r.name);
    A('glottologLevel', r.level, {
      domain: 'classification',
      notes: isIsoDialect
        ? 'ISO 639-3 registers this code as a language; Glottolog ranks it a '
          + 'dialect. Both are recorded — the index reports the disagreement '
          + 'rather than picking a winner.'
        : null,
    });

    // ── Classification ───────────────────────────────────────────────────
    const line = ancestry(r);
    const isIsolate = !r.family_id || r.family_id === r.id;

    // ── A bucket is not a family ─────────────────────────────────────────
    //
    // Seven of Glottolog's top-level nodes are not genealogical units at all.
    // They are filing buckets for entries whose status is the OPPOSITE of a
    // classification: Unattested, Unclassifiable, Bookkeeping, Pidgin, Mixed
    // Language, Artificial Language, Speech Register. Reading `family_id` for
    // one of these and projecting it produces "this language belongs to the
    // Unclassifiable family", which inverts what Glottolog is saying.
    //
    // Recording WHICH bucket is the valuable part. For the question of whether
    // an entry belongs in the atlas at all, "Glottolog files this as Unattested"
    // is among the strongest evidence available — it is Glottolog stating that
    // the code has no documented language behind it.
    const bucket = BUCKETS[r.family_id] ? byId.get(r.family_id) : null;
    const family = (!bucket && r.family_id) ? byId.get(r.family_id) : null;

    if (bucket) {
      x.assert({ code, domain: 'classification', property: 'glottologBucket',
        value: bucket.id, url, raw: bucket.name,
        notes: `Glottolog ${x.snap.pin.value} files this entry under "${bucket.name}", `
          + 'which is a filing bucket rather than a genealogical family' });
      x.assert({ code, domain: 'classification', property: 'glottologBucketName',
        value: bucket.name, url });
    }

    const famId = family
      ? x.assert({ code, domain: 'classification', property: 'family',
        value: family.name, url, raw: family.id })
      : null;
    if (family) {
      x.assert({ code, domain: 'classification', property: 'familyGlottocode',
        value: family.id, url });
    } else {
      x.absent({ code, domain: 'classification', property: 'family',
        notes: bucket
          ? `Glottolog files this code under "${bucket.name}", not in a family`
          : isIsolate ? 'Glottolog classifies this languoid as an isolate'
            : 'Glottolog records no family for this languoid' });
    }
    x.assert({ code, domain: 'classification', property: 'isIsolate',
      value: String(isIsolate), valueType: 'boolean', url });

    // A bucket node is not an ancestor either — it would put "Unclassifiable"
    // at the root of a card's ancestry path.
    const ancestors = line.filter((a) => !BUCKETS[a.id]);
    if (ancestors.length) {
      // One row per ancestor, ordered — an ordered path cannot round-trip
      // through a single-value key.
      ancestors.forEach((anc, i) => x.assert({
        code, domain: 'classification', property: 'ancestor', value: anc.name,
        variant: String(i).padStart(2, '0'), url, raw: anc.id,
      }));
    }

    // GENUS is ours: Glottolog publishes no genus rank, so this is a reading of
    // their tree and must never be attributed to them.
    //
    // WHICH reading matters, and there are two defensible ones: the smallest
    // subgroup containing the language (its immediate parent) or the top-level
    // branch below the family. For crk they differ — "Plains Creeic" against
    // "Algonquian-Blackfoot" — and both are true statements about the tree.
    //
    // The existing corpus means the immediate parent, so that is what this
    // computes. Changing a field's DEFINITION as a side effect of rebuilding
    // the pipeline would put a silent semantic shift into thousands of cards
    // and call it a clean regeneration; if the other reading is wanted it is a
    // deliberate decision, made once, here.
    //
    // Omitted when the immediate parent IS the family: "genus = family" is not
    // a subgrouping, it is the absence of one.
    const parent = ancestors.length ? ancestors[ancestors.length - 1] : null;
    const genus = (parent && family && parent.id !== family.id) ? parent : null;
    if (genus && !isIsolate) {
      const inputs = [famId, gcId].filter((i) => i !== null);
      x.derive({ code, domain: 'classification', property: 'genus', value: genus.name,
        from: `glottolog ${x.snap.pin.value} tree`, inputIds: inputs,
        notes: 'the smallest Glottolog subgroup containing this language (its '
          + 'immediate parent in the tree); Glottolog publishes no genus rank' });
      x.derive({ code, domain: 'classification', property: 'genusGlottocode',
        value: genus.id, from: `glottolog ${x.snap.pin.value} tree`, inputIds: inputs });
    }

    // ── Geography ────────────────────────────────────────────────────────
    // Macroarea is NOT in languoid.csv — the custom-downloads table omits it.
    // It comes from the glottolog-cldf release instead, which is a different
    // deposit with a different DOI. Reading it from whichever file happened to
    // be open is how one field ends up with two provenances.
    if (r.latitude && r.longitude) {
      x.assert({ code, domain: 'geography', property: 'lat', value: r.latitude,
        valueType: 'float', url });
      x.assert({ code, domain: 'geography', property: 'lng', value: r.longitude,
        valueType: 'float', url });
    } else {
      x.absent({ code, domain: 'geography', property: 'lat',
        notes: 'Glottolog records no point coordinate for this languoid' });
    }

    const countries = (r.country_ids ?? '').split(/\s+/).filter(Boolean);
    if (countries.length) {
      countries.forEach((c, i) => x.assert({
        code, domain: 'geography', property: 'country', value: c,
        variant: String(i).padStart(2, '0'), url,
      }));
    } else {
      x.absent({ code, domain: 'geography', property: 'country',
        notes: 'Glottolog lists no country for this languoid' });
    }

    // ── Dialects ─────────────────────────────────────────────────────────
    // Ours, not theirs: child_dialect_count is DIRECT children only, so a
    // language whose dialects nest deeper is undercounted by it.
    const dialects = dialectsUnder(r);
    x.derive({
      code, domain: 'classification', property: 'dialectCount', value: String(dialects),
      valueType: 'integer', inputIds: [gcId].filter((i) => i !== null),
      from: `glottolog ${x.snap.pin.value} tree`,
      notes: 'dialect languoids in the whole subtree; Glottolog\'s own '
        + 'child_dialect_count counts direct children only',
    });
  }

  x._noIso = noIso;
  x._isoDialects = isoDialects;
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length.toLocaleString()} fact(s) prepared, nothing written.`);
  } else {
    const r = x.commit();
    console.log(`\n  ✓ glottolog → ${r.written.toLocaleString()} facts`);
    console.log(`    asserted ${r.asserted.toLocaleString()} · absent ${r.absent.toLocaleString()} `
      + `· derived ${r.derived.toLocaleString()} · empty-skipped ${r.skipped.toLocaleString()}`);
    console.log(`    ${x._noIso.toLocaleString()} languoid(s) keyed by glottocode (no ISO code)`);
    console.log(`    ${x._isoDialects.toLocaleString()} ISO-coded languoid(s) Glottolog ranks as dialects`);
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
