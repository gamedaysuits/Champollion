/**
 * glottocode-names.mjs — ancestry glottocode → display name.
 *
 * Cards carry `classification.ancestry` as GLOTTOCODES (a walk up Glottolog's
 * tree: family → branch → … → the language). The published breadcrumb needs
 * NAMES. Two pinned sources answer the lookup:
 *
 *   1. atlas `cldf_languages` (Glottocode → Name) — covers ISO-spine
 *      languages, but almost no FAMILY/BRANCH nodes (they have no ISO code
 *      and so no spine row);
 *   2. the pinned Glottolog languoid table (cli/data/glottolog/languoid.csv)
 *      — covers every languoid including family nodes, so it is the working
 *      resolver for ancestry chains.
 *
 * A code neither source knows is reported to the caller (buildDamage tally),
 * never silently dropped into an empty breadcrumb.
 */

import { createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LANGUOID_CSV_PATH = join(
  __dirname, '..', '..', '..', 'cli', 'data', 'glottolog', 'languoid.csv',
);

/**
 * Parse ONE csv line into fields (quotes + embedded commas handled).
 * languoid.csv values contain commas inside quoted names, so a split(',')
 * would shear names apart.
 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Build the resolver. Returns { resolve(glottocode) → name|null, unresolved:Set }.
 * `unresolved` accumulates every code resolve() could not answer, so the
 * build can tally them instead of shipping silent gaps.
 */
export async function buildGlottocodeNameResolver(atlasDb, {
  languoidCsvPath = LANGUOID_CSV_PATH,
} = {}) {
  const names = new Map();

  // Layer 2 first, layer 1 second: the atlas spine row is the projection the
  // cards were built from, so where both know a code, the atlas name wins.
  if (existsSync(languoidCsvPath)) {
    const rl = createInterface({ input: createReadStream(languoidCsvPath, 'utf-8') });
    let header = null;
    let idIdx = -1;
    let nameIdx = -1;
    for await (const line of rl) {
      if (!header) {
        header = parseCsvLine(line);
        idIdx = header.indexOf('id');
        nameIdx = header.indexOf('name');
        if (idIdx === -1 || nameIdx === -1) {
          throw new Error(`languoid.csv header lacks id/name columns: ${languoidCsvPath}`);
        }
        continue;
      }
      const fields = parseCsvLine(line);
      const id = fields[idIdx];
      const name = fields[nameIdx];
      if (id && name) names.set(id, name);
    }
  } else {
    throw new Error(
      `Glottolog languoid table not found: ${languoidCsvPath}\n`
      + 'Ancestry breadcrumbs need family-node names, which only the pinned '
      + 'languoid table carries — restore the snapshot before building.',
    );
  }

  for (const row of atlasDb
    .prepare('SELECT Glottocode, Name FROM cldf_languages WHERE Glottocode IS NOT NULL')
    .all()) {
    if (row.Glottocode && row.Name) names.set(row.Glottocode, row.Name);
  }

  const unresolved = new Set();
  return {
    resolve(glottocode) {
      const name = names.get(glottocode);
      if (name === undefined) {
        unresolved.add(glottocode);
        return null;
      }
      return name;
    },
    unresolved,
  };
}
