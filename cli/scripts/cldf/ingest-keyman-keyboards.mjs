/**
 * ingest-keyman-keyboards.mjs — the Keyman catalogue → keyboard existence.
 *
 * A SECOND PUBLISHER FOR A FACT WE ALREADY HAD
 *   `keyboardResource` already carries GiellaLT's 78 layouts. This adds
 *   Keyman's, and the two are not in competition: a language can have layouts
 *   from both, and it is the same KIND of fact from a different publisher —
 *   which is precisely why it shares the parameter rather than forking a
 *   second one. Same fact, one parameter.
 *
 *   Sharing it is also what makes the coverage number honest. Reported
 *   separately, "78 GiellaLT keyboards" reads like a total and was reported as
 *   one; reported together, the card says how many layouts exist for a language
 *   regardless of who happened to publish them.
 *
 * THE CODES ARE KEYMAN'S, AND THEY ARE NOT ISO 639-3
 *   Keyman keys on BCP 47, including script-qualified forms (`ike-cans`,
 *   `chp-cans`) and two-letter subtags. Resolving them is what the tag index is
 *   for, and the resolution keeps its verdict — a catalogue listing `cr` gets
 *   `via-macrolanguage` for Plains Cree, never a silent upgrade to an exact
 *   claim.
 *
 * AN ABSENCE HERE IS NOT AN ABSENCE
 *   The upstream endpoint lists only keyboards compiled for KeymanWeb, so
 *   desktop-only packages never appear. That limit is on the source's snapshot
 *   and in the landscape, and it belongs in a reader's mind here too: this
 *   handler asserts what exists and never that nothing else does. No absence is
 *   recorded for a language missing from this file.
 *
 * EXISTENCE, NEVER CAPABILITY
 *   That a layout exists, who publishes it, its version and where to get it.
 *   Never that it is good, current, or covers the orthography.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { tagResolver } from './tag-registry.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestKeymanKeyboards(db, spec = {}) {
  const { source = 'keyman-keyboards', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  const rows = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'keyman-languages.json'), 'utf-8'),
  );
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`${source}: the pinned catalogue is empty, which is a fetch fault`);
  }

  const tags = tagResolver(db);
  const write = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-keyman-keyboards.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    keyboards: 0,
    unmatched: [],
    unmatchedNoun: 'Keyman language tag',
    unmatchedNote:
      'Keyman keys on BCP 47 including script-qualified forms (ike-cans, chp-cans). A '
      + 'tag that resolves to no spine language is named rather than dropped, because a '
      + 'keyboard reported as missing is the same failure as one reported as present.',
  };
  const covered = new Set();
  const unresolved = new Set();

  db.transaction(() => {
    for (const row of rows) {
      const languageId = tags.resolve(row.code);
      if (!languageId) { unresolved.add(row.code); continue; }
      covered.add(languageId);

      for (const k of row.keyboards) {
        if (write(languageId, 'keyboardResource', JSON.stringify({
          name: k.name ?? k.id,
          keyboardId: k.id,
          url: k.source,
          publisher: 'keyman',
          version: k.version ?? null,
          lastModified: k.lastModified ?? null,
        }), {
          // Same axis GiellaLT's layouts use, so a language's keyboards sit
          // together as several facts rather than several sources disagreeing.
          // The id carries the publisher because two catalogues can ship a
          // layout of the same name for the same language.
          variantType: VARIANT.RESOURCE,
          variantId: `keyman:${k.id}`,
          comment: `Keyman catalogue entry, ${k.version ? `v${k.version}` : 'unversioned'}`
            + ' — existence only; nothing here says it covers the orthography',
          confidence: 'fetched',
        })) { stats.asserted++; stats.keyboards++; }
      }
    }
  })();

  stats.languages = covered.size;
  stats.offSpine = unresolved.size;
  if (unresolved.size) {
    const list = [...unresolved].sort();
    stats.unmatched.push(
      `${list.slice(0, 8).join(', ')}${list.length > 8 ? ` … (${list.length})` : ''}`,
    );
  }
  return stats;
}
