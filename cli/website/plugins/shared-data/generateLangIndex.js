/**
 * Generates the split `/languages` browsing dataset from the resolved
 * languages.json:
 *   - data/lang-index.json        — a compact grid index (~2 MB), one entry
 *     per card carrying ONLY the fields the grid, stats bar, category logic,
 *     and search use. The /languages page fetches THIS on load instead of the
 *     ~56 MB languages.json.
 *   - data/lang-cards/{code}.json — the full resolved card, lazy-fetched when
 *     the detail modal opens (mirrors the trading-cards `tc-lang/` pattern).
 *
 * Why: /languages used to fetch the entire ~56 MB languages.json AND render
 * every one of ~7,900 cards at once — unusable on mobile. The index is ~28x
 * smaller and the page now renders in batches (see src/pages/languages.js).
 *
 * Runs after generateLanguagesJson and reads its output, so card `extends`
 * inheritance is already resolved. Skipped when lang-index.json is newer than
 * languages.json (the 13-locale build re-runs loadContent per locale).
 *
 * Faithfulness notes (do not "optimize" these away):
 *   - methodSupport is copied VERBATIM, never synthesized. getLanguageCategory
 *     distinguishes `googleTranslate.supported === false` from an ABSENT entry
 *     — a flattened boolean would silently misclassify cards as low-resource.
 *   - encyclopedic.family is carried only when present (110/7927 cards today)
 *     so the grid's existing (mostly-empty) family row behaves identically.
 */

const path = require('path');
const fs = require('fs-extra');

/**
 * Build the compact grid-index entry for one resolved card. The shape mirrors
 * the card's nested structure for the fields the grid reads, so
 * src/pages/languages.js renders index entries with no JSX changes.
 */
function toIndexEntry(card) {
  const entry = {
    code: card.code,
    name: card.name,
    nativeName: card.nativeName,
    dir: card.dir,
    script: card.script,
  };
  if (card.encyclopedic && card.encyclopedic.family) {
    entry.encyclopedic = {family: card.encyclopedic.family};
  }
  // Verbatim — see the faithfulness note above.
  if (card.methodSupport) {
    entry.methodSupport = card.methodSupport;
  }
  return entry;
}

/**
 * Write per-card files in bounded-concurrency batches so a ~7,900-file write
 * never exhausts the file-descriptor table (EMFILE).
 */
async function writeCardFiles(cards, dir, batchSize = 200) {
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    await Promise.all(
      batch.map((card) => fs.writeJson(path.join(dir, `${card.code}.json`), card)),
    );
  }
}

/**
 * @param {object} opts
 * @param {string} opts.languagesFile — path to the resolved languages.json
 * @param {string} opts.indexFile — path to write lang-index.json
 * @param {string} opts.cardsOutDir — directory for lang-cards/{code}.json
 */
async function generateLangIndex({languagesFile, indexFile, cardsOutDir}) {
  // Freshness: languages.json is the single input. The index file's mtime
  // gates the (expensive) per-card regeneration too.
  if (await fs.pathExists(indexFile)) {
    const [outStat, inStat] = await Promise.all([
      fs.stat(indexFile),
      fs.stat(languagesFile),
    ]);
    if (outStat.mtimeMs >= inStat.mtimeMs) return;
  }

  const cards = await fs.readJson(languagesFile);
  // Same defensive code-filter loadLanguages() applied — drop reference rows
  // (e.g. a Glottolog tree blob) that lack a `code` and would break consumers.
  const valid = (Array.isArray(cards) ? cards : []).filter(
    (c) => c && typeof c.code === 'string' && c.code,
  );

  const index = valid.map(toIndexEntry);
  await fs.writeJson(indexFile, index);

  // Empty the per-card dir first so cards removed from the source don't linger
  // as stale deployed files.
  await fs.emptyDir(cardsOutDir);
  await writeCardFiles(valid, cardsOutDir);

  console.log(
    `[shared-data] Wrote lang-index.json (${index.length} entries) + ` +
    `lang-cards/ (${valid.length} files) from ${path.basename(languagesFile)}`,
  );
}

module.exports = {generateLangIndex, toIndexEntry};
