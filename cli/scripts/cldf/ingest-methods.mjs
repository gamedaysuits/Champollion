/**
 * ingest-methods.mjs — which translation methods cover which languages.
 *
 * WHY THIS BELONGS ON A LANGUAGE CARD AT ALL
 *   The card-boundary rule says a card may assert language PROPERTIES and
 *   resource EXISTENCE, and never a measured score. "Google Translate supports
 *   this language" is existence: it is the first thing a practitioner needs and
 *   it says nothing about how WELL anything translates. A chrF value for the
 *   same pair would be a run result and belongs on the leaderboard.
 *
 * WE ARE THE SOURCE, AND THAT IS RECORDED HONESTLY
 *   `shared/catalogue/method-coverage.json` is ours: each entry is transcribed
 *   cite-only from a provider's own published language list, with the URL and
 *   the date we read it. So it pins to its own content hash and the commit that
 *   last changed it, under `curated:method-coverage` — never under a provider's
 *   name, because Google did not tell us this, we read their page.
 *
 * COUNT-ONLY METHODS CONTRIBUTE NOTHING PER LANGUAGE
 *   Two entries publish a headline number and no list. `translated` claims 200
 *   languages and ships no enumeration; `omt1600` claims 1,600 and has no
 *   public weights at all. Their counts are real and citable, and they cannot
 *   be turned into per-language facts.
 *
 *   Distributing a count across languages we guessed at would be exactly the
 *   manufacturing this rebuild exists to end — and it is a live temptation,
 *   because 1,600 languages of claimed coverage would light up more of the
 *   atlas than every other method combined. They are skipped, and the skip is
 *   counted and reported.
 *
 * VERIFICATION TRAVELS WITH THE CLAIM
 *   The register distinguishes `confirmed`, `partially-confirmed`,
 *   `publisher-count-only` and `derived`. A card that showed all four
 *   identically would flatten a real difference in how much we checked, so the
 *   level rides on every value.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { spineResolver } from './spine.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const FILE = path.join(REPO, 'shared', 'catalogue', 'method-coverage.json');

/**
 * Register a file WE maintain as a source. Its release is the file's own
 * content hash plus the commit that last touched it — the closest thing to a
 * pin that exists for something with no upstream.
 */
export function registerCuratedFile(db, relPath, sourceKey, title) {
  const full = path.join(REPO, relPath);
  const bytes = fs.readFileSync(full);
  const sha = createHash('sha256').update(bytes).digest('hex');
  let commit = null;
  try {
    commit = execFileSync('git', ['log', '-1', '--format=%H', '--', relPath],
      { cwd: REPO, encoding: 'utf-8' }).trim() || null;
  } catch { commit = null; }

  const id = `${sourceKey}-${sha.slice(0, 12)}`;
  db.prepare(`
    INSERT INTO cldf_sources
      (ID, BibTeX_Type, Title, Version, License, sha256, CLDF_Module,
       Redistributable, Commercial_Use)
    VALUES (?, 'misc', ?, ?, 'CC-BY-4.0', ?, NULL, 1, 1)
    ON CONFLICT(ID) DO NOTHING
  `).run(id, title, commit ?? sha.slice(0, 12), sha);
  return { id, sha, commit };
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function ingestMethods(db) {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const src = registerCuratedFile(
    db, 'shared/catalogue/method-coverage.json', 'curated:method-coverage',
    'Champollion method coverage register — per-method supported-language lists, '
    + "transcribed cite-only from each provider's own published list",
  );
  const spine = spineResolver(db);

  const write = valueWriter(db, { sourceId: src.id, createdBy: 'cldf/ingest-methods.mjs' });

  const stats = {
    source: 'curated:method-coverage', languages: 0, offSpine: 0, asserted: 0,
    absence: 0, methods: 0, countOnlySkipped: [],
  };
  const covered = new Set();

  db.transaction(() => {
    for (const m of data.methods ?? []) {
      // A superseded entry stays in the FILE for the pre-cutover runtime
      // consumers that still read it, and stays OUT of the atlas because a
      // fetched source now carries the same coverage from the owner's own
      // publication — nllb's 195 languages from facebook/nllb-200's card, not
      // from our transcription of it. Ingesting both would put two spellings
      // of one fact in the store, which is the disagreement machinery's job to
      // surface, not ours to manufacture.
      if (m.supersededBy) {
        stats.superseded = (stats.superseded ?? 0) + 1;
        continue;
      }
      const list = m.iso6393 ?? [];
      if (!list.length) {
        // A headline number with no enumeration. Real, citable, and not a
        // per-language fact.
        stats.countOnlySkipped.push({ method: m.key, claimedCount: m.count });
        continue;
      }
      stats.methods++;
      for (const iso of list) {
        const languageId = spine.resolve(iso, '');
        if (!languageId) { stats.offSpine++; continue; }
        covered.add(languageId);
        // The TIER, not a boolean: "there is a deployed service" and "there is a
        // downloadable research model" are different situations for someone
        // deciding what to do next. The METHOD is the discriminator, so two
        // methods covering one language are two facts, not a disagreement.
        write(languageId, 'methodSupport', m.tier, {
          variantType: VARIANT.METHOD,
          variantId: m.key,
          comment: [m.label, m.nature,
            m.source_url ? `list read ${m.asOf} from ${m.source_url}` : null]
            .filter(Boolean).join(' — '),
          confidence: m.verified ?? 'unverified',
        });
        stats.asserted++;
      }
    }
  })();

  stats.languages = covered.size;

  // The macrolanguage boundary is measured in build-atlas.mjs, AFTER every
  // source has run. Measuring it here read zero every time: sources ingest in
  // alphabetical order, so `curated:method-coverage` runs long before
  // `iso639-3` has written a single macrolanguage value.
  return stats;
}

/**
 * The metric-model register, which is the same KIND of claim as method
 * coverage: a published list of languages a model says it covers, transcribed
 * cite-only, never a score.
 *
 * It exists because the harness selects a specialised COMET model per language
 * — AfriCOMET genuinely evaluates African languages better than default COMET,
 * so losing the field silently degrades every eval for those languages. The
 * previous source was a hardcoded ISO list inside a script whose citation was
 * wrong on all 109 cards it touched.
 *
 * THE ISO MAPPING IS OURS AND THE REGISTER SAYS SO
 *   AfriCOMET publishes language NAMES, not codes. Turning "isiXhosa" into
 *   `xho` is a standard correspondence and it is still OUR step, so the values
 *   carry the publisher's list as the claim and the register records who did
 *   the mapping.
 */
export function ingestMetrics(db) {
  const file = path.join(REPO, 'shared', 'catalogue', 'metric-coverage.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const src = registerCuratedFile(
    db, 'shared/catalogue/metric-coverage.json', 'curated:metric-coverage',
    'Champollion metric-model coverage register — per-model supported-language lists, '
    + "transcribed cite-only from each model's own published list",
  );
  const spine = spineResolver(db);

  const write = valueWriter(db, { sourceId: src.id, createdBy: 'cldf/ingest-methods.mjs' });

  const stats = {
    source: 'curated:metric-coverage', languages: 0, offSpine: 0, asserted: 0,
    absence: 0, models: 0, unresolvedModels: Object.keys(data.unresolved ?? {}),
  };
  const covered = new Set();

  db.transaction(() => {
    for (const m of data.models ?? []) {
      const list = m.iso6393 ?? [];
      if (!list.length) continue;
      stats.models++;
      for (const iso of list) {
        const languageId = spine.resolve(iso, '');
        if (!languageId) { stats.offSpine++; continue; }
        covered.add(languageId);
        // The model IDENTIFIER, because that is what a harness needs to load.
        write(languageId, 'metricModelSupport', m.model, {
          variantType: VARIANT.METRIC,
          variantId: m.key,
          comment: [m.label, m.purpose, `list read ${m.asOf} from ${m.source_url}`,
            m.coverageStatement ? `publisher: "${m.coverageStatement}"` : null]
            .filter(Boolean).join(' — '),
          confidence: m.verified ?? 'unverified',
        });
        stats.asserted++;
      }
    }
  })();

  stats.languages = covered.size;
  return stats;
}

