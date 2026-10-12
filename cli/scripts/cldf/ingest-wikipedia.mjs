/**
 * ingest-wikipedia.mjs — Wikipedia editions → a resource-existence fact.
 *
 * WHAT IT ASSERTS
 *   That an open Wikipedia exists in this language, and its URL. Nothing more.
 *   For many low-resource languages this is the largest body of monolingual
 *   running text that exists, which is why it belongs on the card — and it is
 *   not evidence of quality, size or usability, which is why nothing else is
 *   claimed.
 *
 * THE JOIN, AND WHY IT RUNS LAST
 *   Wikipedia site codes are historical: mostly ISO 639-1, sometimes 639-3,
 *   sometimes neither. They are matched against BCP 47 tags that LinguaMeta
 *   wrote into the store, so this must run AFTER LinguaMeta — the same ordering
 *   trap that made iso15924 resolve an empty table and report a clean run.
 *
 * AN UNMATCHED EDITION IS OUR GAP, NOT A MISSING WIKIPEDIA
 *   Codes like `simple`, `nds-nl` and `zh-yue` do not correspond to a spine
 *   entry, and a few real editions will fail to match because our BCP 47
 *   coverage is incomplete. Those are COUNTED and listed, never quietly
 *   dropped: reporting 280 matches out of 348 editions as though it were full
 *   coverage is the shape of every mistake this rebuild exists to undo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestWikipedia(db, spec = {}) {
  const { source = 'wikipedia', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const spine = spineResolver(db);

  const { editions } = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'editions.json'), 'utf-8'),
  );

  // BCP 47 tags LinguaMeta already wrote. This is why the handler runs late.
  const byBcp47 = new Map(
    db.prepare("SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'bcp47'")
      .all().map((r) => [r.Value.toLowerCase(), r.Subject_ID]),
  );
  if (!byBcp47.size) {
    throw new Error(
      'No bcp47 values in the store, so every Wikipedia edition would fail to match and '
      + 'the build would report zero coverage as a clean run. This handler must run after '
      + 'linguameta.',
    );
  }

  // ISO 639-1 as a second key, from SIL's own table.
  //
  // LinguaMeta does not cover ancient and liturgical languages, so Latin,
  // Sanskrit, Church Slavic and Pali had no BCP 47 tag and their Wikipedias —
  // which plainly exist — went unmatched. They ARE in the spine and they DO
  // carry an ISO 639-1 code, so this is a join through data we already hold,
  // not a guess about what a site code might mean.
  const byIso1 = new Map(
    db.prepare("SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'iso639_1'")
      .all().map((r) => [r.Value.toLowerCase(), r.Subject_ID]),
  );

  const write = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-wikipedia.mjs' });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    editionsRead: editions.length, unmatched: [],
    unmatchedNoun: 'edition',
    unmatchedNote: 'Our mapping gap, not a language without a Wikipedia.',
  };

  db.transaction(() => {
    for (const e of editions) {
      const code = e.site.toLowerCase();
      // BCP 47, then ISO 639-1, then the bare code as an ISO 639-3. In that
      // order and never reversed: a two-letter site code that happened to
      // collide with a three-letter ISO code would attach a Wikipedia to the
      // wrong language, and a wrong resource claim is worse than a missing one.
      const languageId = byBcp47.get(code) ?? byIso1.get(code) ?? spine.resolve(code, '');
      if (!languageId) { stats.unmatched.push(e.site); continue; }
      write(languageId, 'wikipediaEdition',
        JSON.stringify({ site: e.site, url: e.url, name: e.localname || e.name }), {
          comment: 'Open Wikipedia edition. Existence only — no claim about size or quality.',
        });
      stats.asserted++;
    }
  })();

  stats.languages = stats.asserted;
  return stats;
}
