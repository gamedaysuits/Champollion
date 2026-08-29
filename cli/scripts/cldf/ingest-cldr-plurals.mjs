/**
 * ingest-cldr-plurals.mjs — CLDR cardinal plural categories → a card fact.
 *
 * WHAT IT ASSERTS
 *   Which plural categories a language distinguishes: Arabic has six
 *   (zero, one, two, few, many, other), French has three (one, many, other),
 *   Chinese has one (other). An i18n pipeline needs this to know how many
 *   plural forms a message must supply, and getting it wrong produces
 *   translations that are grammatically impossible rather than merely awkward.
 *
 * WHY IT IS CLDR'S CLAIM AND NOT OURS
 *   We read the category NAMES out of CLDR's own rule set. We do not evaluate
 *   the rules, derive the categories, or decide which a language "really" has —
 *   the keys of `plurals-type-cardinal` ARE the answer, and reading a
 *   publisher's own keys is reporting, not deriving.
 *
 * WHY THIS RUNS LATE
 *   CLDR keys on locale codes (`ar`, `pt-PT`, `zh-Hant`), which are joined to
 *   the spine through BCP 47 and ISO 639-1 that LinguaMeta and the SIL tables
 *   wrote into the store. Running alphabetically would resolve an empty table
 *   and report a clean run over nothing — the trap iso15924 fell into.
 *
 * REGIONAL VARIANTS ARE SKIPPED, DELIBERATELY
 *   CLDR distinguishes `pt` from `pt-PT` because their plural rules genuinely
 *   differ. The atlas has no card for a regional variant, and attaching
 *   Portugal's rules to Portuguese-the-language would assert something CLDR
 *   took care to separate. Only the base locale is taken; the variants are
 *   counted and reported.
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

/** CLDR's own category names, in the order a message catalogue expects them. */
const ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestCldrPlurals(db, spec = {}) {
  const { source = 'cldr-plurals', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const spine = spineResolver(db);

  const data = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'plurals.json'), 'utf-8'),
  );
  const cardinal = data.supplemental['plurals-type-cardinal'];

  const byBcp47 = new Map(
    db.prepare("SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'bcp47'")
      .all().map((r) => [r.Value.toLowerCase(), r.Subject_ID]),
  );
  const byIso1 = new Map(
    db.prepare("SELECT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'iso639_1'")
      .all().map((r) => [r.Value.toLowerCase(), r.Subject_ID]),
  );
  if (!byBcp47.size && !byIso1.size) {
    throw new Error(
      'No bcp47 or iso639_1 values in the store, so every locale would fail to match and '
      + 'the build would report zero coverage as a clean run. This handler must run after '
      + 'linguameta and iso639-3.',
    );
  }

  const write = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-cldr-plurals.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    localesRead: Object.keys(cardinal).length, regionalVariantsSkipped: 0, unmatched: [],
  };

  db.transaction(() => {
    for (const [locale, rules] of Object.entries(cardinal)) {
      // `pt-PT` and `zh-Hant` are deliberate CLDR distinctions with their own
      // rules. The atlas has no card for them and merging them upward would
      // assert something CLDR took care to keep apart.
      if (locale.includes('-')) { stats.regionalVariantsSkipped++; continue; }
      const code = locale.toLowerCase();
      const languageId = byBcp47.get(code) ?? byIso1.get(code) ?? spine.resolve(code, '');
      if (!languageId) { stats.unmatched.push(locale); continue; }

      // The KEYS are the answer. We read them; we do not evaluate the rules.
      const categories = Object.keys(rules)
        .map((k) => k.replace(/^pluralRule-count-/, ''))
        .filter((c) => ORDER.includes(c))
        .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (!categories.length) continue;

      write(languageId, 'pluralCategories', JSON.stringify(categories), {
        comment: `CLDR locale "${locale}" — ${categories.length} cardinal plural `
          + `${categories.length === 1 ? 'category' : 'categories'}`,
      });
      stats.asserted++;
      stats.languages++;
    }
  })();

  return stats;
}
