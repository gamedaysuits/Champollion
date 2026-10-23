/**
 * Generates `src/data/card-spec-example.json` — the canonical example for the
 * public Language Card Specification page, derived from the LIVE corpus.
 *
 * Why this exists:
 *   The spec page used to carry a ~700-line hand-written "canonical template"
 *   that drifted a whole schema generation behind the corpus (it still showed
 *   `nativeName`/`aliases`/`script`/`vitality` after the 2026-08 atlas
 *   cutover renamed all four). A hand-typed example CAN drift; a projected
 *   one cannot. This step re-derives the example from the real `crk`
 *   (Plains Cree) card — plus a locale-card excerpt from `fra-CA` — on every
 *   build, per the house no-hardcoded-display-values standard (see
 *   SSOTCount.js for the scalar twin of this pattern).
 *
 * RAW READ, deliberately: every card CONSUMER must go through the adapter
 *   (`normalizeCard()` in cli/lib/cards/reader.js) — but this artifact
 *   documents the on-disk shape itself, so the on-disk bytes are exactly
 *   what it must show. The page says so next to the rendered example.
 *
 * FAIL LOUD: the generator asserts the source cards still carry the atlas
 *   shape (attribution envelopes, renamed fields, `_card` stamp) and that no
 *   retired pre-cutover field has crept back. A corpus regression fails the
 *   build here instead of silently republishing a stale example.
 *
 * Output is committed (like src/data/cchrf-floors.json et al.) so checkouts
 * without the card corpus — the Vercel guard case in index.js — still build;
 * when the corpus is present the file is rewritten only if its bytes change.
 */

const path = require('path');
const fs = require('fs-extra');

/** The example language card: the flagship, and the card the docs narrate. */
const LANGUAGE_CODE = 'crk';
/** The example locale card: a familiar locale with a `localeScoped` block. */
const LOCALE_CODE = 'fra-CA';

/** Locale-card fields excerpted for the spec page (the locale-identity story;
 *  the full card repeats the language's facts and would dwarf the point). */
const LOCALE_EXCERPT_FIELDS = ['code', 'name', 'locale', 'script', 'localeScoped', '_card'];

function assertShape(condition, message) {
  if (!condition) {
    throw new Error(`[card-spec-example] ${message}`);
  }
}

/** An attribution envelope: {agreement, consensus?, values:[{value, source}]}. */
function isEnvelope(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.agreement === 'string' &&
    Array.isArray(v.values) &&
    v.values.length > 0 &&
    v.values.every((entry) => entry != null && typeof entry.source === 'string')
  );
}

function assertLanguageCardShape(card) {
  assertShape(card.code === LANGUAGE_CODE, `expected code "${LANGUAGE_CODE}", got "${card.code}"`);
  assertShape(card._card && card._card.type === 'language', `${LANGUAGE_CODE}: _card.type must be "language"`);
  assertShape(typeof card._card.revision === 'string' && card._card.revision, `${LANGUAGE_CODE}: _card.revision missing`);
  assertShape(card._fieldSources && typeof card._fieldSources === 'object', `${LANGUAGE_CODE}: _fieldSources missing`);
  // The atlas shape the spec page teaches — envelopes and renamed fields.
  for (const field of ['name', 'endangerment', 'speakerEstimates', 'endonym']) {
    assertShape(isEnvelope(card[field]), `${LANGUAGE_CODE}: ${field} is not an attribution envelope`);
  }
  assertShape(isEnvelope(card.classification && card.classification.family), `${LANGUAGE_CODE}: classification.family is not an attribution envelope`);
  assertShape(Array.isArray(card.scripts) && card.scripts.length > 0, `${LANGUAGE_CODE}: scripts[] missing/empty`);
  // Retired pre-cutover names must never reappear on a language card.
  for (const retired of ['nativeName', 'aliases', 'vitality', 'script']) {
    assertShape(!(retired in card), `${LANGUAGE_CODE}: retired field "${retired}" is back on the card — example would teach the wrong shape`);
  }
}

function assertLocaleCardShape(card) {
  assertShape(card.code === LOCALE_CODE, `expected code "${LOCALE_CODE}", got "${card.code}"`);
  assertShape(card._card && card._card.type === 'locale', `${LOCALE_CODE}: _card.type must be "locale"`);
  assertShape(
    card.locale && typeof card.locale.language === 'string' && typeof card.locale.region === 'string',
    `${LOCALE_CODE}: locale block missing language/region`,
  );
  assertShape(typeof card.script === 'string', `${LOCALE_CODE}: script (locale-resolved) missing`);
  assertShape(card.localeScoped && typeof card.localeScoped === 'object', `${LOCALE_CODE}: localeScoped missing`);
}

/**
 * @param {object} opts
 * @param {string} opts.cardsDir — path to cli/shared/language-cards
 * @param {string} opts.outFile — path to write card-spec-example.json
 */
async function generateCardSpecExample({cardsDir, outFile}) {
  const languageCard = await fs.readJson(path.join(cardsDir, `${LANGUAGE_CODE}.json`));
  const localeCard = await fs.readJson(path.join(cardsDir, `${LOCALE_CODE}.json`));

  assertLanguageCardShape(languageCard);
  assertLocaleCardShape(localeCard);

  const localeExcerpt = {};
  for (const field of LOCALE_EXCERPT_FIELDS) {
    if (field in localeCard) localeExcerpt[field] = localeCard[field];
  }
  // Keep the excerpt honest about being an excerpt: correctableFields lists
  // the whole card, which the excerpt does not show.
  if (localeExcerpt._card) {
    const {correctableFields, ...cardStamp} = localeExcerpt._card;
    localeExcerpt._card = cardStamp;
  }

  const out = {
    _meta: {
      generatedBy: 'cli/website/plugins/shared-data/generateCardSpecExample.js',
      note:
        'Build artifact for the Language Card Specification page. Do not hand-edit: ' +
        're-derived from the live cards on every site build.',
      language: {
        sourceCard: `shared/language-cards/${LANGUAGE_CODE}.json`,
        revision: languageCard._card.revision,
        atlasVersion: (languageCard._atlas && languageCard._atlas.version) || null,
      },
      locale: {
        sourceCard: `shared/language-cards/${LOCALE_CODE}.json`,
        revision: localeCard._card.revision,
        excerptFields: LOCALE_EXCERPT_FIELDS,
      },
    },
    language: languageCard,
    localeExcerpt,
  };

  const serialized = `${JSON.stringify(out, null, 2)}\n`;
  // Write-only-if-changed: the file is webpack-imported, and a no-op rewrite
  // would churn the dev-server watcher on every restart.
  if (await fs.pathExists(outFile)) {
    const existing = await fs.readFile(outFile, 'utf8');
    if (existing === serialized) return;
  }
  await fs.outputFile(outFile, serialized);
  console.log(
    `[shared-data] Wrote card-spec example (${LANGUAGE_CODE} rev ${languageCard._card.revision}, ` +
    `${LOCALE_CODE} rev ${localeCard._card.revision}) to ${outFile}`,
  );
}

module.exports = {generateCardSpecExample, LANGUAGE_CODE, LOCALE_CODE};
