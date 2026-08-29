/**
 * shared-data — local Docusaurus plugin that serves the heavy language-card
 * dataset from a single, locale-independent location.
 *
 * Why this exists:
 *   The dataset (`website/data/` — tc-index.json, tc-lang/*.json,
 *   world-provinces.topo.json, languages.json) is ~600 MB. It used to live in
 *   `static/`, which Docusaurus copies into EVERY locale build (13 locales ×
 *   573 MB ≈ 7.4 GB). All pages fetch it from the absolute `/data/...` path
 *   (never locale-prefixed), so one copy at the build root is sufficient.
 *
 * What it does:
 *   1. loadContent  — generates `data/languages.json` from
 *      `cli/shared/language-cards/` (resolving `extends` inheritance against
 *      genera cards), so the frontend can fetch it at runtime instead of
 *      bundling 8,000 JSON files into webpack output. Also distills
 *      `data/wall.json` (~110 KB) for the homepage endonym wall.
 *   2. configureWebpack — serves `data/` at `/data` from the dev server so
 *      `npm start` behaves exactly like production.
 *   3. postBuild — copies `data/` ONCE into the build root (only when
 *      building the default locale, whose outDir IS the build root).
 */

const path = require('path');
const fs = require('fs-extra');
const {generateLanguagesJson} = require('./generateLanguagesJson');
const {generateWallJson} = require('./generateWallJson');
const {generateChannelJson} = require('./generateChannelJson');
const {generateLangIndex} = require('./generateLangIndex');
const {generateExplainersJson} = require('./generateExplainersJson');
const {generateFieldJson} = require('./generateFieldJson');
const {generateGraphJson} = require('./generateGraphJson');
const {generateCatalogueJson} = require('./generateCatalogueJson');
const {generateCardSpecExample} = require('./generateCardSpecExample');

module.exports = function sharedDataPlugin(context) {
  const dataDir = path.join(context.siteDir, 'data');
  const cardsDir = path.resolve(context.siteDir, '..', 'shared', 'language-cards');
  const explainersDir = path.resolve(context.siteDir, '..', 'shared', 'explainers');
  const monorepoRoot = path.resolve(context.siteDir, '..', '..');
  // SSOTs live in the monorepo-root shared/ (the source of truth); cli/shared/
  // is the bundled copy synced for cli-only deploys (sync:shared). Read the
  // root SSOT when present, else fall back to the bundled copy.
  const rootSharedDir = path.join(monorepoRoot, 'shared');
  const cliSharedDir = path.resolve(context.siteDir, '..', 'shared');
  const firstExisting = (...candidates) =>
    candidates.find((p) => fs.existsSync(p)) || candidates[0];
  const sharedFile = (...rel) =>
    firstExisting(path.join(rootSharedDir, ...rel), path.join(cliSharedDir, ...rel));

  return {
    name: 'shared-data-plugin',

    async loadContent() {
      // Guard: the production build runs one locale per process
      // (scripts/build-all-locales.mjs). This dataset is locale-INDEPENDENT
      // (fetched at runtime from the single /data path), so only the first
      // (default-locale) child regenerates it; every subsequent child sets
      // CHAMPOLLION_SKIP_DATA_REGEN=1 and reuses what it wrote, instead of
      // rebuilding all ~8,000 cards 12 more times. graph.json is the LAST file
      // loadContent writes, so its presence proves a prior run finished — we
      // only skip when it's actually there, never blindly.
      if (
        process.env.CHAMPOLLION_SKIP_DATA_REGEN === '1' &&
        fs.existsSync(path.join(dataDir, 'graph.json'))
      ) {
        console.log(
          '[shared-data] CHAMPOLLION_SKIP_DATA_REGEN=1 and data present — ' +
            'reusing dataset (skipping per-locale regeneration).',
        );
        return null;
      }

      // Guard: when the monorepo sibling directories are absent (e.g.
      // Vercel deploys of just cli/website), skip regeneration and use
      // the committed data/*.json snapshots instead.
      const hasCards = fs.existsSync(cardsDir);
      const hasExplainers = fs.existsSync(explainersDir);

      if (hasCards) {
        await generateLanguagesJson({
          cardsDir,
          outFile: path.join(dataDir, 'languages.json'),
        });
        // The Language Card Specification page's canonical example — the
        // live crk card (+ a fra-CA locale excerpt), verbatim, so the public
        // spec can never drift from the corpus again. Committed snapshot
        // (src/data/) covers checkouts without the corpus; webpack imports
        // it into the docs page at build time.
        await generateCardSpecExample({
          cardsDir,
          outFile: path.join(context.siteDir, 'src', 'data', 'card-spec-example.json'),
        });
      }
      // Distill the homepage endonym-wall dataset (~110 KB) from the
      // resolved cards so the homepage never fetches the 55 MB file.
      if (hasCards || fs.existsSync(path.join(dataDir, 'languages.json'))) {
        await generateWallJson({
          languagesFile: path.join(dataDir, 'languages.json'),
          outFile: path.join(dataDir, 'wall.json'),
        });
        // Distill the endonym CHANNEL dataset (v4 landing trust-badge
        // ticker): the FULL catalog with speaker counts + endonyms.
        await generateChannelJson({
          languagesFile: path.join(dataDir, 'languages.json'),
          outFile: path.join(dataDir, 'channel.json'),
        });
        // Split the /languages browsing dataset: a ~2 MB grid index +
        // per-card detail files, so the page never fetches the 56 MB file
        // (the last big mobile payload) or renders all ~7,900 cards at once.
        await generateLangIndex({
          languagesFile: path.join(dataDir, 'languages.json'),
          indexFile: path.join(dataDir, 'lang-index.json'),
          cardsOutDir: path.join(dataDir, 'lang-cards'),
        });
        // The public Index ("the Catalogue"): a browsable map of EVERYTHING in
        // the Network, distilled from the in-repo SSOTs (corpora registry,
        // resolved language cards, method registry, human services, and the
        // cite-only external-results SSOT). Reads languages.json (just written)
        // so per-language resources merge with benchmark coverage. Fail-soft:
        // a missing registry degrades the benchmark sections, never the page.
        await generateCatalogueJson({
          canonicalRegistry: path.join(monorepoRoot, 'arena', 'datasets', 'registry.json'),
          staticRegistry: path.join(context.siteDir, 'static', 'registry.json'),
          languagesFile: path.join(dataDir, 'languages.json'),
          methodRegistryFile: sharedFile('method-registry.json'),
          humanServicesFile: sharedFile('human-services.json'),
          externalResultsFile: sharedFile('catalogue', 'external-results.json'),
          // The bulk best-published index (both Helsinki leaderboards, commit-
          // pinned; monorepo-tracked, deliberately not npm-bundled) — powers
          // the External tab summary + per-language best-published depth.
          // Fail-soft when absent (cli-only / Vercel checkouts).
          externalMtIndexFile: sharedFile('catalogue', 'external-mt-index.json'),
          catalogueOut: path.join(dataDir, 'catalogue.json'),
          langsOut: path.join(dataDir, 'catalogue-langs.json'),
          // (The former external-edges.json /mesh overlay artifact was retired
          // 2026-07-07: /mesh 301s to / and nothing fetched it. The cite-only
          // external tier still ships via catalogue.json's external/externalIndex
          // and the homepage graph.json lighting.)
        });
      }
      // Stage the explanation-layer datasets (feature explainers + glossary)
      // so the UI can lazy-fetch them from /data/explainers/. i18nDir feeds
      // the localized glossary merge (glossary.<locale>.json artifacts).
      if (hasExplainers) {
        await generateExplainersJson({
          explainersDir,
          outDir: path.join(dataDir, 'explainers'),
          i18nDir: path.join(context.siteDir, 'i18n'),
          inputLocale: context.i18n && context.i18n.defaultLocale ? context.i18n.defaultLocale : 'en',
        });
      }
      // Distill the Translation Field dataset (homepage hero) from the Arena
      // scoreboard (Supabase run_cards / run_card_entries) — real corpus
      // sentences, real model outputs, each run's real corpus-level composite
      // (CLAIMS.md §"The Translation Field"). Built from the DB, never local
      // logs; pre-launch the scoreboard is empty so the field is written
      // sparse and self-populates as runs publish. Network-independent of
      // arena/ — runs in every build env (Vercel included).
      await generateFieldJson({
        outFile: path.join(dataDir, 'field.json'),
      });
      // THE TRANSLATION NETWORK dataset (graph hero, lab stage):
      // build-time force-directed layout of all 7,959 languages with
      // lit/queued/dark coverage states + real benchmarked routes. lit +
      // routes come from the DB scoreboard; nodes from tc-index.json. When
      // tc-index.json is absent (DB-derived, gitignored — e.g. Vercel) the
      // committed graph.json snapshot is kept.
      await generateGraphJson({
        tcIndexFile: path.join(dataDir, 'tc-index.json'),
        wallFile: path.join(dataDir, 'wall.json'),
        queueFile: path.join(context.siteDir, 'static', 'queue.json'),
        languagesFile: path.join(dataDir, 'languages.json'),
        fieldFile: path.join(dataDir, 'field.json'),
        outFile: path.join(dataDir, 'graph.json'),
        posterFile: path.join(context.siteDir, 'src', 'data', 'graph-poster.json'),
        // Cite-only external edges (flagged, not reproduced) for the hero's
        // distinct gold overlay — read straight from the committed SSOT.
        externalResultsFile: sharedFile('catalogue', 'external-results.json'),
        // The bulk published-results index: its languages join the hero's
        // "with a published benchmark" count (indexed, not reproduced) and
        // its pair total feeds the provenance copy. Fail-soft when absent.
        externalMtIndexFile: sharedFile('catalogue', 'external-mt-index.json'),
        // Per-method coverage (Google/Microsoft/DeepL/LibreTranslate/NLLB/
        // OPUS-MT/Tilde), imported cite-only from each provider's published
        // list. Translated (Lara) is count-only pending its language-list
        // import — see METHOD_BITS in generateGraphJson.js.
        // Authoritative for the per-method toggle layers when present; the
        // card methodSupport is the fallback. Graceful if absent.
        methodCoverageFile: sharedFile('catalogue', 'method-coverage.json'),
        // The queue mesh (registered/measured pair edges): the poster draws
        // the same classified pair routes the live hero draws, so the
        // SSR→canvas handoff is line-to-line. Fail-soft when absent.
        meshFile: path.join(context.siteDir, 'static', 'mesh.json'),
      });

      if (!hasCards) {
        console.log('[shared-data] Monorepo sibling dirs not found — using committed data snapshots.');
      }
      return null;
    },

    configureWebpack() {
      return {
        devServer: {
          static: [
            {
              directory: dataDir,
              publicPath: '/data',
              watch: false,
            },
          ],
        },
      };
    },

    async postBuild({outDir}) {
      const {currentLocale, defaultLocale} = context.i18n;
      // Only the default locale's outDir is the build root. Copying there
      // exactly once gives a single `/data` shared by all locale builds.
      if (currentLocale !== defaultLocale) {
        return;
      }
      const dest = path.join(outDir, 'data');
      console.log(`[shared-data] Copying dataset once to ${dest}`);
      // languages.json is a build-time distiller input ONLY — the /languages
      // page now fetches lang-index.json + lang-cards/{code}.json. Don't ship
      // the ~56 MB file; it was the last big mobile payload. (lang-index.json
      // and the lang-cards/ dir do not match this basename, so they copy.)
      await fs.copy(dataDir, dest, {
        filter: (src) => path.basename(src) !== 'languages.json',
      });
    },
  };
};
