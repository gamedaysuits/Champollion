/**
 * atlas.mjs — the ONE sqlite opener for the trading-card build.
 *
 * Read-only, and it THROWS when the file is missing. The retired accessor
 * (scripts/db.mjs) silently CREATED an empty database on a missing path,
 * which turned "you pointed at the wrong checkout" into "the catalogue has
 * zero languages" three steps downstream. A store that isn't there is an
 * error, never an empty answer.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** cli/data/atlas.db — the pinned-source store the cards are projected from. */
export const ATLAS_DB_PATH = join(__dirname, '..', '..', '..', 'cli', 'data', 'atlas.db');

export function openAtlas(dbPath = ATLAS_DB_PATH) {
  if (!existsSync(dbPath)) {
    throw new Error(
      `atlas.db not found: ${dbPath}\n`
      + 'The trading-card build reads ONLY the atlas SSOT. Build it first '
      + '(cli/scripts/cldf/build-atlas.mjs) — this opener never creates an empty store.',
    );
  }
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}
