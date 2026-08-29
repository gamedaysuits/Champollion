#!/usr/bin/env node

/**
 * extractor: corpora → corpus cards.
 *
 * WHAT A CORPUS CARD IS FOR
 *   A language card says whether translation is possible. A method card says
 *   what can do it. A corpus card says what you are allowed to do with the DATA
 *   — and for this project that is not a footnote, it is the foundation. The
 *   difference between "CC-BY-4.0" and "modified, sovereignty-scoped
 *   CC-BY-NC-SA" decides whether a corpus can be redistributed, benchmarked
 *   against, or sent to a model API at all.
 *
 * THE LICENCE IS THE CASE THE CONFLICT SHAPE WAS BUILT FOR
 *   A corpus can carry up to three independent licence statements: what Zenodo
 *   records on the deposit, what the shipped LICENSE file says, and what the
 *   CLDF metadata declares. They disagree — `dryerorder` is CC-BY-4.0 on Zenodo
 *   and Apache-2.0 in its own metadata.
 *
 *   Every reading is recorded as its own fact, attributed to where it was read,
 *   so the card shows the disagreement rather than a single confident string.
 *   The OPERATIVE verdict is recorded separately, because a project cannot act
 *   on a disagreement — it has to pick one, and the rule is most-restrictive-
 *   wins. Showing the verdict without the readings would hide the uncertainty;
 *   showing the readings without a verdict would leave every consumer to invent
 *   its own rule. Both, distinctly.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 *   The register these corpora sat in was 3.6% verified. 212 entries were
 *   written by a `String.includes()` chain that invented version numbers, had
 *   no branch for NoDerivatives at all, and granted redistribution BY DEFAULT.
 *   It recorded a non-commercial Bantu dataset as free to redistribute across
 *   324 cards. A licence field that looks confident and is not is worse than an
 *   empty one, which is why UNVERIFIED is projected as its own visible state
 *   rather than quietly omitted.
 *
 * Usage:
 *   node cli/scripts/extractors/corpora.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from '../fetchers/lib/fetch-lib.mjs';
import { openCurated } from './lib/curated.mjs';

export const source = 'curated:license-evidence';
export const entityType = 'corpus';
const FILE = 'shared/license-evidence.json';
const SELF = 'extractors/corpora.mjs';

/** Where a reading came from → how to describe it on a card. */
const ORIGIN_LABEL = {
  zenodo: 'Zenodo deposit metadata',
  'license-file': 'LICENSE file shipped with the dataset',
  'cldf-metadata': 'the dataset\'s own CLDF metadata',
};

export function extract({ db = null } = {}) {
  const x = openCurated({ file: FILE, source, entityType, extractor: SELF, db });

  // The Zenodo harvest supplies DOI, version and per-file checksums. It is a
  // FETCHED artefact, tracked in git, so a corpus card's release pin can point
  // at something a reader can verify.
  const zenodoPath = path.join(DATA_ROOT, 'zenodo-harvest', 'records.json');
  const zenodo = fs.existsSync(zenodoPath)
    ? JSON.parse(fs.readFileSync(zenodoPath, 'utf-8')).sources : {};

  const stats = { corpora: 0, verified: 0, unverified: 0, conflicts: 0, pinned: 0 };

  for (const [id, ev] of Object.entries(x.data.sources ?? {})) {
    x.entity(id, id);
    stats.corpora++;
    const z = zenodo[id];
    const url = z?.recordUrl ?? null;

    if (z?.title) x.assert({ id, domain: 'identity', property: 'title', value: z.title, url });
    if (z?.creators?.length) {
      z.creators.forEach((c, i) => x.assert({
        id, domain: 'identity', property: 'creator', value: c, variant: String(i).padStart(2, '0'), url,
      }));
    }

    // ── Every licence reading, attributed to where it was read ───────────
    let readings = 0;
    for (const e of ev.evidence ?? []) {
      if (!e.spdx) continue;
      x.assert({
        id, domain: 'licensing', property: 'licenseReading', value: e.spdx,
        variant: e.origin, url: e.url ?? url, raw: e.rawString ?? null,
        notes: `as stated by ${ORIGIN_LABEL[e.origin] ?? e.origin}`,
      });
      readings++;
    }
    if (!readings) {
      x.absent({
        id, domain: 'licensing', property: 'licenseReading',
        notes: 'no licence statement found in the deposit metadata, a LICENSE file, '
          + 'or the CLDF metadata. Unstated is NOT permissive.',
      });
    }

    // ── The operative verdict, kept separate from the readings ───────────
    const r = ev.resolved ?? {};
    if (r.spdx) {
      x.assert({
        id, domain: 'licensing', property: 'effectiveLicense', value: r.spdx, url,
        raw: r.basis ?? null,
        notes: `the licence we ACT on. ${ev.conflict
          ? `Readings disagreed (${ev.conflict.readings.map((k) => `${k.origin}: ${k.spdx}`).join(', ')}); `
            + 'the most restrictive governs.'
          : 'Basis: ' + (r.basis ?? 'unrecorded')}`,
      });
      stats.verified++;
    } else {
      // A visible state, not a silence. An unverified licence must look
      // different from a permissive one on the card.
      x.assert({
        id, domain: 'licensing', property: 'licenseStatus', value: 'UNVERIFIED', url,
        notes: 'no evidence resolved to an SPDX identifier. Treat as all rights '
          + 'reserved until someone establishes otherwise — the previous register '
          + 'granted redistribution by default and was wrong to.',
      });
      stats.unverified++;
    }
    if (r.status) {
      x.assert({ id, domain: 'licensing', property: 'licenseStatus', value: r.status, url });
    }

    if (ev.conflict) {
      stats.conflicts++;
      x.assert({
        id, domain: 'licensing', property: 'licenseConflict', value: 'true',
        valueType: 'boolean', url,
        notes: ev.conflict.note ?? 'upstream licence statements disagree',
      });
    }

    // Permissions, as booleans a consumer can gate on without parsing SPDX.
    for (const [flag, prop] of Object.entries({
      redistribution: 'allowsRedistribution',
      attribution: 'requiresAttribution',
      sharealike: 'requiresShareAlike',
      nonCommercial: 'nonCommercialOnly',
      noDerivatives: 'noDerivatives',
    })) {
      const v = r.flags?.[flag];
      if (v === null || v === undefined) {
        x.absent({
          id, domain: 'licensing', property: prop,
          notes: 'not determinable from the evidence. Absent means UNKNOWN, which '
            + 'is not the same as false — the old register defaulted this to '
            + 'permissive and recorded a non-commercial dataset as redistributable '
            + 'across 324 cards.',
        });
        continue;
      }
      x.assert({ id, domain: 'licensing', property: prop, value: String(v),
        valueType: 'boolean', url });
    }

    // ── The pin, where the corpus is a Zenodo deposit ─────────────────────
    if (z?.doi) {
      x.assert({ id, domain: 'provenance', property: 'doi', value: z.doi, url });
      if (z.version) {
        x.assert({ id, domain: 'provenance', property: 'version', value: z.version, url });
      }
      if (z.publicationDate) {
        x.assert({ id, domain: 'provenance', property: 'published', value: z.publicationDate, url });
      }
      stats.pinned++;
    } else {
      x.absent({
        id, domain: 'provenance', property: 'doi',
        notes: 'not deposited on Zenodo under a DOI we have harvested — this corpus '
          + 'cannot yet be pinned to an immutable release',
      });
    }

    // Whether we hold a verified local copy, which is what makes it usable.
    const snapPath = path.join(DATA_ROOT, id, 'SNAPSHOT.json');
    x.assert({
      id, domain: 'provenance', property: 'locallyPinned',
      value: String(fs.existsSync(snapPath)), valueType: 'boolean',
      notes: 'whether cli/data holds a checksum-verified copy of this corpus',
    });
  }

  x._stats = stats;
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length} fact(s) for ${x._stats.corpora} corpora.`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ corpora → ${r.written.toLocaleString()} facts for ${r.entities} corpora`);
    console.log(`    ${s.verified} with an effective licence · ${s.unverified} UNVERIFIED `
      + '(shown as such, never as permissive)');
    console.log(`    ${s.conflicts} where upstream statements DISAGREE — every reading kept`);
    console.log(`    ${s.pinned} pinned to a Zenodo DOI`);
    console.log(`    pinned to sha256 ${x.pin.sha256.slice(0, 12)}…`
      + `${x.pin.commit ? ` @ ${x.pin.commit.slice(0, 8)}` : ' (UNTRACKED)'}\n`);
  }
  if (x._ownsDb) x.db.close();
}
