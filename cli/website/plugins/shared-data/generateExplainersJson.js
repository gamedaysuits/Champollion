/**
 * Stages `data/explainers/` — the language-card explanation layer datasets.
 *
 * Two files, copied verbatim from `cli/shared/explainers/`:
 *   tc-features.json — 571 typological feature explainers (WALS / Grambank /
 *                      APiCS / card composites). Joined in the UI via
 *                      propertyIndex["<fact.source>|<property>"].
 *   glossary.json    — 133 plain-language linguistic terms used for inline
 *                      glossary tooltips and the /glossary page.
 *
 * Plus the localized glossary artifacts, regenerated every run (a cheap JSON
 * merge): each champollion-translated i18n/<locale>/glossary.json is merged
 * over the English SSOT into `glossary.<locale>.json` (gitignored — see
 * mergeGlossaryLocale.js for the pipeline contract). The runtime loader
 * (explainerLoader.loadGlossary(locale)) fetches these with English fallback.
 *
 * Like wall.json, the copies land in `website/data/` which the shared-data
 * plugin serves at `/data` in dev and copies ONCE into the build root in
 * postBuild — never per-locale. The verbatim copies are freshness-guarded:
 * a copy is skipped when the staged file is at least as new as its source
 * (matters for the 13-locale build, which re-runs loadContent per locale).
 */

const path = require('path');
const fs = require('fs-extra');
const {mergeGlossaryLocale} = require('./mergeGlossaryLocale');

const EXPLAINER_FILES = ['tc-features.json', 'glossary.json'];

/**
 * @param {object} opts
 * @param {string} opts.explainersDir — path to cli/shared/explainers
 * @param {string} opts.outDir — path to website/data/explainers
 * @param {string} [opts.i18nDir] — path to website/i18n (locale glossary inputs)
 * @param {string} [opts.inputLocale] — the source locale to skip (default 'en')
 */
async function generateExplainersJson({explainersDir, outDir, i18nDir, inputLocale = 'en'}) {
  await fs.ensureDir(outDir);

  for (const name of EXPLAINER_FILES) {
    const src = path.join(explainersDir, name);
    const out = path.join(outDir, name);

    if (!(await fs.pathExists(src))) {
      console.warn(`[shared-data] Explainer source missing, skipping: ${src}`);
      continue;
    }

    // Freshness: skip when the staged copy is at least as new as the source.
    if (await fs.pathExists(out)) {
      const [outStat, srcStat] = await Promise.all([fs.stat(out), fs.stat(src)]);
      if (outStat.mtimeMs >= srcStat.mtimeMs) continue;
    }

    await fs.copy(src, out);
    console.log(`[shared-data] Staged explainer ${name} → ${out}`);
  }

  // Localized glossary artifacts — merge every translated locale file over
  // the SSOT. Locale-INDEPENDENT (all locales staged in one pass, fetched at
  // runtime from /data), so the per-locale build's first child stages them
  // all. Fail-soft: no i18n dir / no translated files → English-only, the
  // runtime loader falls back per-locale.
  const glossarySrc = path.join(explainersDir, 'glossary.json');
  if (i18nDir && (await fs.pathExists(i18nDir)) && (await fs.pathExists(glossarySrc))) {
    const ssot = await fs.readJson(glossarySrc);
    let staged = 0;
    for (const locale of (await fs.readdir(i18nDir)).sort()) {
      if (locale === inputLocale) continue;
      const translatedFile = path.join(i18nDir, locale, 'glossary.json');
      if (!(await fs.pathExists(translatedFile))) continue;

      let translated;
      try {
        translated = await fs.readJson(translatedFile);
      } catch (err) {
        console.warn(`[shared-data] Unreadable ${translatedFile} — skipping: ${err.message}`);
        continue;
      }
      const merged = mergeGlossaryLocale(ssot, translated, locale);
      await fs.writeJson(path.join(outDir, `glossary.${locale}.json`), merged, {spaces: 2});
      staged += 1;
    }
    if (staged > 0) {
      console.log(`[shared-data] Staged localized glossary for ${staged} locale(s) → ${outDir}`);
    }
  }
}

module.exports = {generateExplainersJson};
