/**
 * ingest-common-voice.mjs — Common Voice release stats → speech resource existence.
 *
 * A SECOND PUBLISHER FOR A FACT WE ALREADY HAD
 *   `speechResource` already carries GiellaLT's speech corpora. This adds
 *   Mozilla's, and the two are not in competition: it is the same KIND of fact
 *   from a different publisher, so it shares the parameter rather than forking
 *   a second one — same fact, one parameter, exactly as the dictionary lane
 *   settled it.
 *
 * THE HOURS ARE MOZILLA'S OWN
 *   validatedHours/totalHours are the release's published per-locale stats,
 *   written under the upstream's source id and reported verbatim. Nothing is
 *   summed, derived, or rounded here. Null means Mozilla published no number,
 *   never zero.
 *
 * LOCALES RESOLVE THROUGH THE IN-STORE RESOLVER — HENCE RUNS_LAST
 *   Common Voice keys on BCP-47-ish locales (`pt`, `zh-CN`, `ga-IE`,
 *   `rm-sursilv`). The primary subtag names the language and the rest is a
 *   variant of it, the same reading the OPUS handler wrote down for `pt_BR`.
 *   Two-letter subtags resolve through the store's iso639_1 values, which
 *   ingest-iso639 writes — so this handler sits in RUNS_LAST with the vendor
 *   and OPUS handlers, for the same reason they do.
 *
 *   ON A PARTIAL BUILD THE RESOLVER MAY BE LEGITIMATELY EMPTY: `--only` builds
 *   a store without iso639-3's values, and tagResolver correctly refuses to
 *   start. Crashing would make the lane untestable in isolation; silently
 *   writing nothing would be the empty-clean-run failure RUNS_LAST exists to
 *   stop. So the handler degrades LOUDLY instead — three-letter locales still
 *   resolve against the spine, every two-letter locale is counted and named
 *   as unresolved, and the stats say full resolution happens on the next full
 *   build. On a full build the guard never fires.
 *
 * EXISTENCE AND EXTENT, NEVER CAPABILITY
 *   That validated speech exists at some hours, from some contributors. Never
 *   that the audio is clean, the transcripts right, or the sampling
 *   representative. And no absence is recorded for a language Common Voice
 *   does not carry — this handler asserts what exists, never that nothing
 *   else does.
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
 * The BCP 47 primary language subtag of a Common Voice locale — `zh-CN` names
 * Chinese for China, and the primary subtag is what names the language. Same
 * reading, same reason, as the OPUS handler's `pt_BR`.
 */
function primaryOf(locale) {
  return String(locale).toLowerCase().split('-')[0];
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestCommonVoice(db, spec = {}) {
  const { source = 'common-voice', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  const pinned = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'common-voice-stats.json'), 'utf-8'),
  );
  const rows = pinned.locales;
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`${source}: the pinned stats file is empty, which is a fetch fault`);
  }

  // The full resolver when the store has iso639_1 values; a loud, spine-only
  // fallback when it cannot start (a partial build). See the header — the one
  // thing this must never do is report a clean run over silently-dropped rows.
  let tags;
  let degraded = false;
  try {
    tags = tagResolver(db);
  } catch {
    degraded = true;
    const spine = new Set(db.prepare('SELECT ID FROM cldf_languages').all().map((r) => r.ID));
    if (!spine.size) throw new Error('the spine is empty — buildSpine() has not run');
    tags = { resolve: (s) => (spine.has(String(s).toLowerCase()) ? String(s).toLowerCase() : null) };
  }

  const write = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-common-voice.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    locales: rows.length,
    unmatched: [],
    unmatchedNoun: 'Common Voice locale',
    unmatchedNote: degraded
      ? 'PARTIAL BUILD: the in-store iso639_1 join is empty, so no two-letter locale '
        + 'can resolve — every one is counted here rather than silently dropped. Full '
        + 'resolution happens on the next full build, where this handler runs in '
        + 'RUNS_LAST after ingest-iso639.'
      : 'Common Voice keys on BCP-47-ish locales; the primary subtag resolves through '
        + 'the same in-store join the vendor and OPUS handlers use. A locale that '
        + 'resolves to no spine language is named rather than dropped, because a speech '
        + 'resource reported as missing is the same failure as one reported as present.',
  };
  const covered = new Set();
  const unresolved = new Set();

  db.transaction(() => {
    for (const l of rows) {
      const languageId = tags.resolve(primaryOf(l.locale));
      if (!languageId) { unresolved.add(l.locale); continue; }
      covered.add(languageId);

      if (write(languageId, 'speechResource', JSON.stringify({
        dataset: 'common-voice',
        // Verbatim. `zh-CN` and `zh-TW` both resolve to Chinese and are two
        // distinct resources; the locale is what tells them apart, and
        // collapsing it would merge facts Mozilla publishes separately.
        locale: l.locale,
        // Mozilla's own numbers; null is "not published", never zero.
        validatedHours: l.validHrs,
        totalHours: l.totalHrs,
        clips: l.clips,
        contributors: l.users,
        release: pinned.release,
      }), {
        // Same axis GiellaLT's speech entries use, so one language's speech
        // resources sit together as several facts rather than several sources
        // disagreeing. The id carries the locale because one language can have
        // several Common Voice locales.
        variantType: VARIANT.RESOURCE,
        variantId: `common-voice:${l.locale}`,
        comment: `Mozilla's own per-locale stats for ${pinned.release} — existence and `
          + 'extent only; nothing here says the audio is clean or the transcripts right',
        confidence: 'fetched',
      })) { stats.asserted++; }
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
