/**
 * docusaurus-sync.js — Docusaurus-specific sync operation
 *
 * Extracted from sync.js to reduce god-module complexity.
 * Handles directory-per-locale JSON + Markdown translation for
 * Docusaurus projects. Two phases:
 *
 *   Phase 1: JSON UI strings — {message, description} files in i18n/{locale}/
 *   Phase 2: Markdown content — docs/ and blog/ mirrored into i18n/{locale}/
 *
 * Reuses the shared translation pipeline (lib/translate-pair.js) for
 * the TM→API→gate sequence, and Docusaurus-specific format helpers
 * (extractDocusaurusMessages, injectDocusaurusMessages) for round-trip.
 * Does NOT modify or share state with the main runSync() path.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { translateBatch, isUnsafeKey } from './translate.js';
import { diffLocale, diffLabel } from './diff.js';
import { isPathContained } from './security.js';
import {
  extractDocusaurusMessages, injectDocusaurusMessages,
  extractDocusaurusDescriptions,
} from './format.js';
import {
  parseContentFile, protectBlocks, restoreBlocks, hasOrphanedPlaceholders,
  buildContentPrompt, reassembleContentFile, DEFAULT_TRANSLATABLE_FIELDS,
  discoverDocusaurusContentFiles, getDocusaurusTargetPath,
  findUntranslatableNestedFields,
} from './content.js';
import { translateRawContent } from './translate.js';
import {
  splitBlocks, buildBlockBatchPrompt, parseBlockBatchResponse,
  translateBlockBatchResilient,
  assertSegmentationMode,
} from './segment.js';
import { DEFAULT_REGISTERS } from './registers.js';
import { DEFAULT_JSON_CONCURRENCY, EST_CHARS_PER_KEY } from './config.js';
import { compileNoTranslate } from './no-translate.js';
import { checkContentPreservation } from './validate.js';
import { convertScript, applyScriptFallback } from './scripts.js';
import { pMap } from './concurrent.js';
import {
  loadTM, saveTM, tmSize, isTMDirty,
  lookupTM, lookupTMValidated, storeTM, evictTM, partitionByTM, tmMethodKey,
} from './tm.js';
import {
  readManifest, writeManifest, detectChangedKeys, hashValue,
} from './hash.js';
import { CONTENT_LOCK_FILENAME } from './content-sync.js';
import { parseMaxCost, abortForMaxCost, printCostTable } from './cost-report.js';
import { output } from './output.js';
import { translateAndValidate } from './translate-pair.js';

/**
 * Discover all JSON locale files in a Docusaurus i18n source directory.
 *
 * Walks the source locale directory recursively and returns all .json files.
 * These include code.json and plugin-specific files in subdirectories.
 *
 * @param {string} sourceLocaleDir - e.g., /project/i18n/en
 * @returns {string[]} Absolute paths to JSON files
 */
function discoverDocusaurusJSONFiles(sourceLocaleDir) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  walk(sourceLocaleDir);
  return files.sort();
}

/**
 * Scan docs/ + blog/ for pending (file × locale) content translations.
 *
 * Single source of truth for "what content work exists": the cost estimator
 * and the Phase-2 translation loop both consume this, so the estimate can
 * never drift from what the sync actually does. Read-only — hand-translated
 * files it discovers are reported via recordedHashes for the CALLER to fold
 * into its manifest; nothing is written here.
 *
 * Work items carry the parsed source (body, front-matter fields, page
 * title) so the estimator can TM-partition them and the translation loop
 * never re-parses.
 *
 * @param {Array<{dir: string, plugin: string}>} contentSources - docs/blog dirs
 * @param {Array<[string, object]>} pairEntries - Resolved pair graph entries
 * @param {object} config - Resolved config (localesDir)
 * @param {object} manifest - Content lock manifest (hash per file × locale)
 * @param {boolean} forceContent - --force-content: re-process up-to-date files
 *   too (action 're-translate'), WITHOUT clearing the manifest — a target
 *   with no lock entry and no '[EN] ' markers is a genuine hand-translated
 *   file, and force must never overwrite human work with machine output.
 * @returns {{ workItems: Array<object>, totalContentSkipped: number, recordedHashes: object }}
 */
function scanDocusaurusContentWork(contentSources, pairEntries, config, manifest, forceContent) {
  const workItems = [];
  let totalContentSkipped = 0;
  const recordedHashes = {};
  // sourcePath → { parsed, fieldsToTranslate, pageTitle, sourceHash }
  const sourceCache = new Map();

  for (const { dir: sourceContentDir, plugin: pluginName } of contentSources) {
    const sourceFiles = discoverDocusaurusContentFiles(sourceContentDir);
    const dirName = path.basename(sourceContentDir);

    for (const sourcePath of sourceFiles) {
      const relPath = path.relative(sourceContentDir, sourcePath);

      // Read + parse source file once per source path. The staleness hash
      // covers the RAW file (same as the Hugo twin's hashFileContent): a
      // front-matter-noise edit must re-process the file so the metadata
      // propagates to every locale copy (reassembleContentFile copies the
      // source's full rawFrontMatter). Cost is NOT the hash's job — the
      // TM makes that re-run API-free for unchanged text.
      if (!sourceCache.has(sourcePath)) {
        const raw = fs.readFileSync(sourcePath, 'utf-8');
        const parsed = parseContentFile(raw);
        const fieldsToTranslate = {};
        if (parsed.hasFrontMatter) {
          for (const field of DEFAULT_TRANSLATABLE_FIELDS) {
            if (parsed.frontMatter[field] && typeof parsed.frontMatter[field] === 'string') {
              fieldsToTranslate[field] = parsed.frontMatter[field];
            }
          }
        }
        // Terminology context for block-batch prompts: the page's title
        // (front matter first, else the first H1 in the body).
        const pageTitle = fieldsToTranslate.title
          || (parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null);
        const sourceHash = crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');
        sourceCache.set(sourcePath, { parsed, fieldsToTranslate, pageTitle, sourceHash });
      }
      const { parsed, fieldsToTranslate, pageTitle, sourceHash } = sourceCache.get(sourcePath);

      for (const [, pairConfig] of pairEntries) {
        const code = pairConfig.target;
        const targetPath = getDocusaurusTargetPath(
          sourcePath, sourceContentDir, code, config.localesDir, pluginName
        );

        // Security: verify target stays within i18n directory
        if (!isPathContained(targetPath, config.localesDir)) {
          continue;
        }

        const manifestKey = `docusaurus:${dirName}/${relPath}:${code}`;
        let action = 'new'; // 'new' | 'changed' | 're-translate'

        if (fs.existsSync(targetPath)) {
          const storedHash = manifest[manifestKey];
          if (storedHash) {
            if (storedHash === sourceHash) {
              if (!forceContent) {
                // Source unchanged since last sync — skip
                totalContentSkipped++;
                continue;
              }
              // --force-content on an up-to-date file: honest label.
              action = 're-translate';
            } else {
              action = 'changed';
            }
          } else {
            // No stored hash — check for [EN] fallback markers. This runs
            // even under --force-content: a target with no lock entry and
            // no [EN] markers is a genuine hand-translated file, and force
            // must never overwrite human work with machine output.
            const existingContent = fs.readFileSync(targetPath, 'utf-8');
            const isLegacyFallback = existingContent.includes('[EN] ');
            if (!isLegacyFallback) {
              // Genuine hand-translated file — preserve it, record hash
              recordedHashes[manifestKey] = sourceHash;
              totalContentSkipped++;
              continue;
            }
            action = 're-translate';
          }
        }

        workItems.push({
          sourcePath, parsed, fieldsToTranslate, pageTitle, sourceHash,
          relPath, dirName,
          pairConfig, code, targetPath, manifestKey, pluginName, action,
        });
      }
    }
  }

  return { workItems, totalContentSkipped, recordedHashes };
}

/**
 * Estimate and display translation costs for a Docusaurus sync.
 *
 * Docusaurus flavor of cost-report.js's printCostEstimate, so --max-cost is
 * enforceable on this path too (it used to abort unconditionally — "no
 * estimator" ≠ free). Two components, mirroring the two sync phases:
 *
 *   Phase 1 (JSON UI strings): per (source JSON file × pair), the same
 *   extract → drop-unsafe-keys → changed-key-detect → diff → string-filter
 *   sequence the sync loop runs, then TM-partitioned with the pair's full
 *   method key — exactly what translateAndValidate will do. TM hits price
 *   at $0. Changed-key detection reads the same .champollion.lock manifest
 *   as Phase 1: an edited English string is invisible to the plain diff
 *   (the target still holds the old translation) but WILL re-fire, so the
 *   estimate must price it.
 *
 *   Phase 2 (Markdown content): the pending work items from
 *   scanDocusaurusContentWork (the SAME scan the sync consumes), priced
 *   TM-aware by walking the exact lookup ladder the sync runs per item:
 *   front-matter fields partition per field; the body is free on a
 *   whole-body TM hit, else split into blocks ('block' mode) with only
 *   TM-missed translatable blocks billed by their restored source chars
 *   ('page' mode bills the whole body on a miss). Billed chars price as
 *   EST_CHARS_PER_KEY-char key-equivalents — rough by design, conservative
 *   for token-priced models. Because the ladder is mirrored, a re-fire
 *   after a resilient-ladder '[EN]' fallback prices as ONLY its
 *   fallen-back blocks: successfully translated blocks were TM-stored and
 *   estimate as hits. All lookups are pure hash reads; no network, no TM
 *   mutation.
 *
 * @param {Array<[string, object]>} pairEntries - Resolved pair graph entries
 * @param {object} config - Resolved config (localesDir, fallbackPrefix, forceKeys)
 * @param {string} sourceLocaleDir - i18n/<inputLocale> absolute path
 * @param {object} tm - The loaded Translation Memory this run will use
 * @param {Array<object>} contentWorkItems - Pending items from scanDocusaurusContentWork
 * @param {object} lockManifest - Phase-1 source-hash manifest (readManifest),
 *   namespaced "docusaurus:<relPath>:<flatKey>" — the same object Phase 1 uses
 * @returns {Promise<import('./cost-report.js').CostEstimateSummary|null>}
 *   Structured estimate, or null when estimation itself failed (callers
 *   with --max-cost must fail safe: unknown ≠ free)
 */
async function printDocusaurusCostEstimate(pairEntries, config, sourceLocaleDir, tm, contentWorkItems, lockManifest, noTranslate) {
  try {
    const { estimateCost } = await import('./pairs.js');
    const costEstimates = [];
    let totalEstimatedCost = 0;
    let hasUnknownCosts = false;

    // ── Phase 1: JSON UI strings, TM-partitioned per pair ───────────
    const sourceJSONFiles = discoverDocusaurusJSONFiles(sourceLocaleDir);
    const missesByPair = new Map(); // pairKey → miss count
    const hitsByPair = new Map();   // pairKey → TM hit count

    for (const sourceFilePath of sourceJSONFiles) {
      const relPath = path.relative(sourceLocaleDir, sourceFilePath);
      const sourceRaw = JSON.parse(fs.readFileSync(sourceFilePath, 'utf-8'));
      const sourceFlat = extractDocusaurusMessages(sourceRaw);
      for (const key of Object.keys(sourceFlat)) {
        if (isUnsafeKey(key)) delete sourceFlat[key];
      }

      // Mirror Phase 1's changed-key detection (same manifest, same
      // per-file un-namespacing) so edited English strings are priced.
      const nsPrefix = `docusaurus:${relPath}:`;
      const fileOldManifest = {};
      for (const [nsKey, storedHash] of Object.entries(lockManifest)) {
        if (nsKey.startsWith(nsPrefix)) {
          fileOldManifest[nsKey.slice(nsPrefix.length)] = storedHash;
        }
      }
      const changedKeys = detectChangedKeys(sourceFlat, fileOldManifest);

      for (const [pairKey, pairConfig] of pairEntries) {
        const code = pairConfig.target;
        const targetFilePath = path.join(config.localesDir, code, relPath);
        if (!isPathContained(targetFilePath, config.localesDir)) continue;

        let existingFlat = {};
        if (fs.existsSync(targetFilePath)) {
          existingFlat = extractDocusaurusMessages(JSON.parse(fs.readFileSync(targetFilePath, 'utf-8')));
        }

        // Same confirmed-echo suppression as the Phase-1 sync below, so the
        // estimate prices exactly the keys the run will actually queue.
        const estTmKey = tmMethodKey(pairConfig);
        const diff = diffLocale(
          sourceFlat, existingFlat, config.fallbackPrefix,
          config._forceAllKeys ? Object.keys(sourceFlat) : config.forceKeys, changedKeys,
          (key, sourceValue) => lookupTM(tm, sourceValue, code, estTmKey) === sourceValue,
          noTranslate.active ? noTranslate.matches : null
        );
        const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');
        if (stringKeys.length === 0) continue;

        const { misses } = partitionByTM(tm, sourceFlat, stringKeys, code, tmMethodKey(pairConfig));
        missesByPair.set(pairKey, (missesByPair.get(pairKey) || 0) + misses.length);
        hitsByPair.set(pairKey, (hitsByPair.get(pairKey) || 0) + (stringKeys.length - misses.length));
      }
    }

    for (const [pairKey, pairConfig] of pairEntries) {
      const keysToTranslate = missesByPair.get(pairKey) || 0;
      const tmHits = hitsByPair.get(pairKey) || 0;
      if (keysToTranslate === 0 && tmHits === 0) continue;

      if (keysToTranslate > 0) {
        // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
        const estimate = await estimateCost(keysToTranslate, pairConfig);
        if (estimate.estimatedCost !== null) {
          totalEstimatedCost += estimate.estimatedCost;
        } else {
          hasUnknownCosts = true;
        }
        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: keysToTranslate,
          tmHits,
          estimatedCost: estimate.estimatedCost,
          source: estimate.source,
        });
      } else {
        // Fully TM-covered: zero API calls → a KNOWN $0, even for
        // unknown-pricing methods. Must not trip hasUnknownCosts.
        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: 0,
          tmHits,
          estimatedCost: 0,
          source: 'translation-memory',
        });
      }
    }

    // ── Phase 2: content work items, TM/block-aware ─────────────────
    let content = null;
    if (contentWorkItems.length > 0) {
      // Body segmentation is deterministic on the source text and
      // locale-independent — compute each file's restored translatable
      // block sources once (only needed for 'block' mode misses).
      const blockSourcesCache = new Map(); // sourcePath → string[]
      const charsByPair = new Map(); // pairConfig (by reference) → billed source chars
      const pendingSourceFiles = new Set();

      for (const item of contentWorkItems) {
        pendingSourceFiles.add(item.sourcePath);
        const code = item.code;
        const tmKey = tmMethodKey(item.pairConfig);
        let chars = 0;

        // Front-matter fields: each field is cached on its own source
        // text — only TM misses reach the API.
        for (const text of Object.values(item.fieldsToTranslate)) {
          if (lookupTM(tm, text, code, tmKey) === null) chars += text.length;
        }

        // Body: whole-body TM first (a revert or lock-loss re-run is
        // free), then per-block in 'block' mode — the same ladder the
        // sync runs below.
        const body = item.parsed.body;
        if (body.trim() && lookupTM(tm, body, code, tmKey) === null) {
          const segMode = item.pairConfig.contentSegmentation || config.contentSegmentation || 'block';
          if (segMode === 'page') {
            chars += body.length;
          } else {
            if (!blockSourcesCache.has(item.sourcePath)) {
              const { protectedBody, blocks } = protectBlocks(body);
              blockSourcesCache.set(
                item.sourcePath,
                splitBlocks(protectedBody)
                  .filter(seg => seg.type === 'translatable')
                  .map(seg => restoreBlocks(seg.text, blocks))
              );
            }
            for (const source of blockSourcesCache.get(item.sourcePath)) {
              if (lookupTM(tm, source, code, tmKey) === null) chars += source.length;
            }
          }
        }

        if (chars > 0) {
          charsByPair.set(item.pairConfig, (charsByPair.get(item.pairConfig) || 0) + chars);
        }
      }

      let contentCost = 0;
      let contentUnknown = false;
      for (const [, pairConfig] of pairEntries) {
        const chars = charsByPair.get(pairConfig);
        // Fully TM-covered pairs are a KNOWN $0 (zero API calls) — they
        // must not consult estimateCost, whose unknown-pricing null would
        // wrongly trip hasUnknownCosts and abort a free run under a cap.
        if (!chars) continue;
        const keyEquivalents = Math.ceil(chars / EST_CHARS_PER_KEY);
        // eslint-disable-next-line no-await-in-loop — sequential is fine for cost queries (cached)
        const estimate = await estimateCost(keyEquivalents, pairConfig);
        if (estimate.estimatedCost !== null) {
          contentCost += estimate.estimatedCost;
        } else {
          contentUnknown = true;
        }
      }

      content = {
        files: pendingSourceFiles.size,
        pendingTranslations: contentWorkItems.length,
        estimatedCost: contentUnknown ? null : contentCost,
        rough: true,
      };
      if (contentUnknown) {
        hasUnknownCosts = true;
      } else {
        totalEstimatedCost += contentCost;
      }
    }

    printCostTable(costEstimates, content, totalEstimatedCost, hasUnknownCosts);

    return {
      currency: 'USD',
      pairs: costEstimates,
      keyCost: content && content.estimatedCost !== null
        ? totalEstimatedCost - content.estimatedCost
        : totalEstimatedCost,
      content,
      totalEstimatedCost,
      hasUnknownCosts,
    };
  } catch (costError) {
    // Non-blocking without a cap — warn and continue. Callers enforcing
    // --max-cost must treat the null return as unknown (abort).
    output.warn(`Cost estimation failed: ${costError.message}`);
    return null;
  }
}

/**
 * Run the Docusaurus-specific sync operation.
 *
 * Two phases:
 *   Phase 1: JSON UI strings — {message, description} files in i18n/{locale}/
 *   Phase 2: Markdown content — docs/ and blog/ mirrored into i18n/{locale}/
 *
 * @param {object} options - { dryRun, audit, cwd, cliArgs }
 * @param {object} config - Resolved config from resolveConfig()
 * @param {string} cwd - Working directory
 * @param {Function} resolveRuntime - Injected from sync.js to avoid circular imports
 */
async function runDocusaurusSync(options, config, cwd, resolveRuntime) {
  const { dryRun = false, audit = false, cliArgs = {} } = options;
  const forceContent = cliArgs['force-content'] || false;

  // --force: re-queue every Phase-1 UI string (the whole-locale rebuild
  // verb; scope with --pair). Docusaurus keys are per-FILE, so the
  // expansion happens at each file's diff rather than globally. Markdown
  // content keeps its own switch (--force-content) — the two lanes have
  // different cost profiles and forcing one must not silently force the
  // other. Stored on config so the cost estimator prices the same rebuild
  // the sync will run.
  config._forceAllKeys = !!cliArgs.force;
  if (config._forceAllKeys) {
    output.info(`--force: re-queuing all JSON UI string(s)${cliArgs.pair ? ' for the selected pair(s)' : ''}`);
  }

  // No-translate matcher — one compiled instance shared by the cost estimate
  // and every Phase 1 diff, so exempt keys are excluded from the bill by the
  // same decision that excludes them from translation. Phase 2 (Markdown
  // bodies) has no key space to match against and is unaffected.
  const noTranslate = compileNoTranslate(config);
  if (noTranslate.patterns.length > 0) {
    output.info(`No-translate patterns: ${noTranslate.patterns.join(', ')}`);
  }

  // Wire CLI --concurrency into config so the content loop can pick it up
  if (cliArgs.concurrency) {
    config.concurrency = parseInt(cliArgs.concurrency, 10) || 48;
  }

  // --force-content: re-process every champollion-managed file × locale
  // regardless of stored hashes. Hand-translated files (no lock entry, no
  // '[EN] ' markers) are STILL preserved — force must never clobber human
  // work. With the TM threaded through Phase 2 this is usually cheap:
  // bodies/blocks and front matter fields translated by a TM-era sync come
  // back as cache hits. Text the TM has never seen (e.g. translated before
  // the TM existed, or after an eviction) is re-billed — which is exactly
  // what the --max-cost gate below prices before anything runs. The lock
  // file itself is never deleted: wiping it also destroyed the
  // hand-translated-file adoption record and any Hugo content entries
  // sharing the same lock.
  if (forceContent) {
    output.info('--force-content: ignoring the content lock — previously cached content is served from the Translation Memory.');
  }

  // Verify i18n directory exists
  if (!fs.existsSync(config.localesDir)) {
    throw new Error(`Docusaurus i18n directory not found: ${config.localesDir}. Run \`npx docusaurus write-translations\` first.`);
  }

  const inputLocale = config.inputLocale;
  const sourceLocaleDir = path.join(config.localesDir, inputLocale);

  if (!fs.existsSync(sourceLocaleDir)) {
    throw new Error(
      `Source locale directory not found: ${sourceLocaleDir}. ` +
      `Run \`npx docusaurus write-translations\` to generate source strings.`
    );
  }

  // Thread dryRun/audit into cliArgs so the preflight check can skip
  // when appropriate — same pattern as the main sync path in sync.js
  const { apiKey, pairEntries } = await resolveRuntime(config, cwd, { ...cliArgs, dryRun, audit });

  if (pairEntries.length === 0) {
    output.info('No target languages configured. Add pairs to champollion.config.json.');
    return;
  }

  // Reject invalid segmentation modes up front — before ANY file (JSON or
  // Markdown) is touched — rather than mid-sync. Mirrors content-sync.js.
  assertSegmentationMode(config.contentSegmentation, 'champollion.config.json');
  for (const [pairKey, pairConfig] of pairEntries) {
    assertSegmentationMode(pairConfig.contentSegmentation, `pair "${pairKey}"`);
  }

  output.raw(`\n  🦕 Docusaurus sync — ${pairEntries.length} language(s)`);
  output.raw(`  Source: i18n/${inputLocale}/`);
  if (dryRun) output.raw('  Mode: DRY RUN\n');
  else output.raw('');

  // Load Translation Memory for the Docusaurus path too.
  // Loaded BEFORE the cost estimate so it can partition against the exact
  // TM this run will use. --no-tm bypasses the cache entirely (see the
  // standard sync path for details); the empty TM makes the estimator
  // price every key and block too.
  const noTM = cliArgs['no-tm'] || false;
  const tm = noTM ? { _meta: { version: 1 } } : loadTM(cwd);
  const tmInitialSize = tmSize(tm);
  if (noTM) {
    output.info('Translation Memory disabled (--no-tm)');
  } else if (tmInitialSize > 0) {
    output.info(`[TM] ${tmInitialSize} cached entries loaded`);
  }

  // Phase-1 source-hash manifest (.champollion.lock) — read up front
  // because the cost estimator mirrors Phase 1's changed-key detection.
  // Keys are namespaced per source file ("docusaurus:<relPath>:<flatKey>")
  // because Docusaurus splits UI strings across many JSON files whose flat
  // keys can collide (e.g. two plugins both defining "title"). Without the
  // manifest, EDITING an English UI string never re-translated it: the
  // diff only sees missing keys and [EN] fallbacks, so a changed source
  // value looked "fully synced" forever.
  const lockManifest = readManifest(cwd);
  const updatedLockManifest = { ...lockManifest };

  // ── Content discovery + pending-work scan ─────────────────────
  // Done up front (not in Phase 2) because the cost estimate needs the
  // pending work items. Phase 2 consumes this same scan — one source of
  // truth for "what will be translated".
  const docsDir = path.join(cwd, 'docs');
  const blogDir = path.join(cwd, 'blog');
  const contentSources = [];
  if (fs.existsSync(docsDir)) {
    contentSources.push({ dir: docsDir, plugin: 'docusaurus-plugin-content-docs' });
  }
  if (fs.existsSync(blogDir)) {
    contentSources.push({ dir: blogDir, plugin: 'docusaurus-plugin-content-blog' });
  }

  // Content hash manifest for change detection (shared with Hugo content
  // sync). Manifest values are hashes of the RAW source file — same scheme
  // as the Hugo twin (content-sync.js hashFileContent) and every lock ever
  // shipped, so existing entries stay comparable. Raw hashing means a
  // front-matter-noise edit (sidebar_position, draft, slug, tags) DOES
  // re-process the file — deliberately: Docusaurus reads those fields
  // per-locale, so they must propagate to every locale copy. The re-run
  // is API-free when the TM has the file (unchanged fm fields and the
  // whole body are cache hits); billing is bounded by the TM, not by
  // this hash. Entries start as a full copy and are only advanced
  // per-item on SUCCESS: a failed or interrupted run keeps each old
  // entry, so the item re-fires on the next sync instead of being
  // silently frozen.
  const contentLockPath = path.join(cwd, CONTENT_LOCK_FILENAME);
  let docuContentManifest = {};
  if (fs.existsSync(contentLockPath)) {
    try { docuContentManifest = JSON.parse(fs.readFileSync(contentLockPath, 'utf-8')); } catch { /* first run */ }
  }
  const contentScan = scanDocusaurusContentWork(
    contentSources, pairEntries, config, docuContentManifest, forceContent
  );

  // ── Pre-sync cost estimation + --max-cost gate ────────────────
  // Mirrors sync.js: without a cap the estimate is informational and
  // failures are non-blocking; with a cap it is a GATE — over-cap or
  // unknowable estimates abort before any API call (unknown ≠ free).
  // Dry-runs are exempt: they make no API calls, and the preview is the
  // exact thing a capped user needs to see.
  const maxCost = parseMaxCost(cliArgs['max-cost']);
  const costEstimate = await printDocusaurusCostEstimate(
    pairEntries, config, sourceLocaleDir, tm, contentScan.workItems, lockManifest, noTranslate
  );
  if (maxCost !== null && !dryRun) {
    if (!costEstimate) {
      return abortForMaxCost(
        maxCost, null,
        'Cost estimation failed, so --max-cost cannot be enforced (unknown is not free).'
      );
    }
    if (costEstimate.hasUnknownCosts) {
      return abortForMaxCost(
        maxCost, null,
        'Some pairs have unknown pricing, so the total cost cannot be bounded (unknown is not free).'
      );
    }
    if (costEstimate.totalEstimatedCost > maxCost) {
      return abortForMaxCost(
        maxCost, costEstimate.totalEstimatedCost,
        'Estimated translation cost exceeds the --max-cost cap.'
      );
    }
  }

  // ── Phase 1: JSON UI strings ──────────────────────────────────

  const sourceJSONFiles = discoverDocusaurusJSONFiles(sourceLocaleDir);
  output.raw(`  Phase 1: JSON strings (${sourceJSONFiles.length} file(s))\n`);

  let totalJSONKeys = 0;
  let totalJSONCopied = 0;

  for (const sourceFilePath of sourceJSONFiles) {
    const relPath = path.relative(sourceLocaleDir, sourceFilePath);
    const sourceRaw = JSON.parse(fs.readFileSync(sourceFilePath, 'utf-8'));
    const sourceFlat = extractDocusaurusMessages(sourceRaw);

    // Extract developer-written context descriptions from Docusaurus format.
    // These help the LLM disambiguate polysemous terms (e.g., "Post" as
    // "submit" vs "blog post") by injecting the description alongside each key.
    const descriptions = extractDocusaurusDescriptions(sourceRaw);
    const keyCount = Object.keys(sourceFlat).length;

    // Defense: remove unsafe keys
    for (const key of Object.keys(sourceFlat)) {
      if (isUnsafeKey(key)) delete sourceFlat[key];
    }

    // Detect keys whose ENGLISH source value changed since the last sync.
    // The manifest stores namespaced keys; detectChangedKeys expects the
    // same key space as sourceFlat, so build a per-file un-namespaced view.
    const nsPrefix = `docusaurus:${relPath}:`;
    const fileOldManifest = {};
    for (const [nsKey, storedHash] of Object.entries(lockManifest)) {
      if (nsKey.startsWith(nsPrefix)) {
        fileOldManifest[nsKey.slice(nsPrefix.length)] = storedHash;
      }
    }
    const changedKeys = detectChangedKeys(sourceFlat, fileOldManifest);

    // ── Parallel locale processing for this JSON file ───────────
    // Each locale writes to its own target file, so zero data deps.
    const jsonConcurrency = config.jsonConcurrency ?? DEFAULT_JSON_CONCURRENCY;

    const pairResults = await pMap(pairEntries, async ([pairKey, pairConfig]) => {
      const code = pairConfig.target;
      const targetFilePath = path.join(config.localesDir, code, relPath);

      // Security: verify target path stays within i18n directory
      if (!isPathContained(targetFilePath, config.localesDir)) {
        output.error(`${code}/${relPath} — refusing to write outside i18n directory`);
        // Nothing was attempted, but nothing succeeded either: keep every
        // to-be-processed key out of the "succeeded" set so its manifest
        // hash is not advanced (an unwritable locale must re-fire).
        return { keys: 0, failedKeys: Object.keys(sourceFlat) };
      }

      // Load existing target if present
      let existingFlat = {};
      if (fs.existsSync(targetFilePath)) {
        const existingRaw = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8'));
        existingFlat = extractDocusaurusMessages(existingRaw);
      }

      // Diff against source — changedKeys makes edited English strings
      // re-translate (they are otherwise invisible to the diff). Echo keys
      // (target === source) the TM confirms as pipeline-produced are NOT
      // requeued — see lib/diff.js isConfirmedEcho.
      const tmKey = tmMethodKey(pairConfig);
      const diff = diffLocale(
        sourceFlat, existingFlat, config.fallbackPrefix,
        config._forceAllKeys ? Object.keys(sourceFlat) : config.forceKeys, changedKeys,
        (key, sourceValue) => lookupTM(tm, sourceValue, code, tmKey) === sourceValue,
        noTranslate.active ? noTranslate.matches : null
      );

      if (diff.toProcess.length === 0 && diff.noTranslate.length === 0 && diff.extra.length === 0) {
        return { keys: 0, failedKeys: [] };
      }

      let keysProcessed = 0;
      let keysCopied = 0;
      const failedKeys = [];

      if (diff.toProcess.length > 0 || diff.noTranslate.length > 0) {
        output.info(`${code}/${relPath} — ${diffLabel(diff)}`);

        if (!dryRun) {
          // Merged output starts from what's on disk, then takes the verbatim
          // no-translate copies. Applying them FIRST means a translation
          // failure below can still flush them — they don't depend on the
          // backend, so an outage must not strand a corrupted URL.
          const mergedFlat = { ...existingFlat };
          for (const key of diff.noTranslate) {
            mergedFlat[key] = sourceFlat[key];
          }
          keysCopied = diff.noTranslate.length;
          const writeMerged = () => {
            const docuOutput = injectDocusaurusMessages(sourceRaw, mergedFlat);
            fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
            fs.writeFileSync(targetFilePath, JSON.stringify(docuOutput, null, 2) + '\n', 'utf-8');
          };

          if (keysCopied > 0) {
            const sample = diff.noTranslate.slice(0, 3)
              .map(k => `${k} (${noTranslate.reason(k, sourceFlat[k])})`)
              .join(', ');
            const more = keysCopied > 3 ? `, +${keysCopied - 3} more` : '';
            output.info(`${code}/${relPath} — copied ${keysCopied} no-translate key(s) verbatim: ${sample}${more}`);
          }

          let translated = null;
          const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');

          if (stringKeys.length > 0) {
            // Shared pipeline: TM partition → API call → TM store → quality gate
            const result = await translateAndValidate(stringKeys, sourceFlat, pairConfig, pairKey, {
              apiKey, tm, targetCode: code, descriptions,
            });
            translated = result.translated;

            if (translated) {
              output.progress(result.failures.length > 0 ? ` [OK] (${result.failures.length} failed gate)\n` : ' [OK]\n');
            } else if (result.apiReturnedNull || (result.failures.length > 0 && !translated)) {
              output.progress(result.apiReturnedNull ? ' [ERR] translation failed\n' : ' [ERR] all failed quality gate\n');
              output.error(`${code}/${relPath}: Translation failed. Check API key and method configuration.`);
              if (keysCopied > 0) writeMerged();
              return { keys: 0, copied: keysCopied, failedKeys: stringKeys };
            }
          }

          // Merge in the new translations. Script conversion mirrors the
          // flat-lane rule in sync.js: only when this pair's resolution asked
          // for it, fallbacks first, and a value with unmappable letters
          // stays whole in the working script (warned, not failed).
          const scriptConverterKey = pairConfig.scriptResolution?.converterKey || null;
          for (const key of diff.toProcess) {
            if (translated && key in translated) {
              let value = translated[key];
              if (scriptConverterKey && typeof value === 'string') {
                const prepared = applyScriptFallback(value, pairConfig.scriptFallback);
                const { converted, unmapped } = convertScript(prepared, scriptConverterKey);
                if (unmapped.length === 0) {
                  value = converted;
                } else {
                  output.warn(
                    `${code}/${relPath}: key "${key}" kept in working script — `
                    + `unmapped letter(s): ${unmapped.join(', ')} (see "scriptFallback")`
                  );
                }
              }
              mergedFlat[key] = value;
            } else if (typeof sourceFlat[key] === 'string') {
              output.warn(`${code}/${relPath}: key "${key}" not translated — skipping`);
              failedKeys.push(key);
            } else {
              mergedFlat[key] = sourceFlat[key];
            }
          }

          keysProcessed = diff.toProcess.length;

          // Inject back into Docusaurus format and write
          writeMerged();
        } else {
          keysProcessed = diff.toProcess.length;
          keysCopied = diff.noTranslate.length;
        }
      }

      if (diff.extra.length > 0) {
        output.warn(`${code}/${relPath} — ${diff.extra.length} extra key(s)`);
      }

      return { keys: keysProcessed, copied: keysCopied, failedKeys };
    }, { concurrency: jsonConcurrency });

    // Aggregate results for this JSON file
    const fileFailedKeys = new Set();
    for (const r of pairResults) {
      totalJSONKeys += r.keys;
      totalJSONCopied += r.copied || 0;
      for (const k of r.failedKeys || []) fileFailedKeys.add(k);
    }

    // Update the manifest for this file: record the current hash ONLY for
    // keys that succeeded in every locale that attempted them. A failed
    // key keeps its OLD hash (or none) so it is detected as changed and
    // RE-FIRES on the next sync — advancing the hash for a failed key
    // would silently mark the stale translation as current forever.
    if (!dryRun) {
      for (const nsKey of Object.keys(updatedLockManifest)) {
        // Own-property check: `in` walks the prototype chain, so a source
        // key literally named "toString"/"valueOf" would mis-resolve.
        if (nsKey.startsWith(nsPrefix)
            && !Object.prototype.hasOwnProperty.call(sourceFlat, nsKey.slice(nsPrefix.length))) {
          delete updatedLockManifest[nsKey]; // key removed from source
        }
      }
      for (const [key, value] of Object.entries(sourceFlat)) {
        const nsKey = nsPrefix + key;
        if (fileFailedKeys.has(key)) {
          // Restore/keep the pre-sync state for failed keys.
          if (Object.prototype.hasOwnProperty.call(lockManifest, nsKey)) {
            updatedLockManifest[nsKey] = lockManifest[nsKey];
          } else {
            delete updatedLockManifest[nsKey];
          }
        } else {
          updatedLockManifest[nsKey] = hashValue(value);
        }
      }
    }
  }

  // Persist the Phase 1 source-hash manifest (skip in dry-run — a preview
  // must not mark changed keys as resolved).
  if (!dryRun && sourceJSONFiles.length > 0) {
    writeManifest(cwd, updatedLockManifest);
  }

  const copiedNote = totalJSONCopied > 0
    ? ` (+${totalJSONCopied} copied verbatim, no-translate)`
    : '';
  if (totalJSONKeys > 0) {
    const action = dryRun ? 'Would process' : 'Synced';
    output.ok(`${action} ${totalJSONKeys} JSON key(s)${copiedNote}`);
  } else if (totalJSONCopied > 0) {
    output.ok(`All JSON files fully synced${copiedNote}`);
  } else {
    output.ok('All JSON files fully synced');
  }

  // ── Phase 2: Markdown content (docs + blog) ───────────────────

  if (contentSources.length === 0) {
    output.info('No docs/ or blog/ directories found — skipping content sync.');
  } else {
    let totalContent = 0;
    let totalContentRetranslated = 0;

    // Pending work comes from the up-front scan (also used by the cost
    // estimate). Hand-translated files it discovered get their hashes
    // folded into the manifest here so they persist.
    const { workItems, recordedHashes } = contentScan;
    const totalContentSkipped = contentScan.totalContentSkipped;
    const updatedDocuManifest = { ...docuContentManifest, ...recordedHashes };

    // Concurrency for parallel content translation. Configurable via
    // --content-concurrency flag or config.contentConcurrency, defaults to 48.
    // Content calls are heavier (full markdown docs) so lower concurrency
    // than JSON (which defaults to 50) to avoid overwhelming the API.
    const concurrency = config.contentConcurrency || 48;

    const totalWork = workItems.length;
    let contentFailures = 0;
    // Warn at most once per source file about front matter fields we can't
    // translate (arrays / nested blocks like `related:`). The check + add are
    // synchronous (no await between), so this is race-free under pMap.
    const warnedFrontMatter = new Set();
    output.raw(`\n  Phase 2: content (${totalWork} translation(s) to process, ${totalContentSkipped} skipped, concurrency: ${concurrency})\n`);

    if (totalWork === 0) {
      output.ok('All content files are up to date.');
    } else {
      // ── Translate all work items in a single flat pool ──────────
      let completed = 0;
      const syncStartTime = Date.now();

      // Incremental manifest persistence — write every N completions
      // so killing the process doesn't lose all progress.
      const MANIFEST_WRITE_INTERVAL = 10;
      let manifestDirty = false;

      const writeManifestIfDirty = () => {
        if (!dryRun && manifestDirty) {
          const sorted = {};
          for (const key of Object.keys(updatedDocuManifest).sort()) {
            sorted[key] = updatedDocuManifest[key];
          }
          fs.writeFileSync(contentLockPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
          manifestDirty = false;
        }
      };

      await pMap(workItems, async (item) => {
        const {
          parsed, fieldsToTranslate, pageTitle, sourceHash,
          relPath, dirName, pairConfig, code,
          targetPath, manifestKey, action,
        } = item;

        try {
          if (action === 'changed') {
            totalContentRetranslated++;
          }

          if (dryRun) {
            const targetRel = path.relative(config.localesDir, targetPath);
            output.raw(`    [DRY] ${dirName}/${relPath} → ${code}`);
            totalContent++;
            return;
          }

          const { rawFrontMatter, body, hasFrontMatter, frontMatterFormat } = parsed;

          // Never silently drop translatable-looking nested/array front matter
          // (e.g. `related:` lists). The flat parser can't reach them — surface
          // them once per source file so the omission is visible.
          if (hasFrontMatter && !warnedFrontMatter.has(item.sourcePath)) {
            warnedFrontMatter.add(item.sourcePath);
            const skipped = findUntranslatableNestedFields(rawFrontMatter);
            if (skipped.length > 0) {
              output.warn(
                `${dirName}/${relPath}: front matter field(s) [${skipped.join(', ')}] are arrays/nested — ` +
                `left untranslated. Flatten them to top-level strings to translate, or translate by hand.`
              );
            }
          }

          // TM entries are keyed on the full method key (method|model|
          // register|coaching) — switching any of those must re-translate,
          // not re-serve. Mirrors content-sync.js.
          const tmKey = tmMethodKey(pairConfig);

          // Translate front matter fields — TM first, API only for misses.
          // Each field is cached on its own source text (exactly like a
          // key-value sync key): a title edit re-pays only the title.
          const translatedFields = {};
          if (hasFrontMatter && Object.keys(fieldsToTranslate).length > 0) {
            const { hits: fmHits, misses: fmMisses } = partitionByTM(
              tm, fieldsToTranslate, Object.keys(fieldsToTranslate), code, tmKey
            );
            // Validate cached hits BEFORE serving — an entry stored by a
            // gateless pipeline (hollowed titles were cached here) must not
            // outlive the gate. Failing hits are evicted and re-billed.
            for (const [field, cachedValue] of Object.entries(fmHits)) {
              if (checkContentPreservation(fieldsToTranslate[field], cachedValue)) {
                evictTM(tm, fieldsToTranslate[field], code, tmKey);
                delete fmHits[field];
                fmMisses.push(field);
              }
            }
            Object.assign(translatedFields, fmHits);

            if (fmMisses.length > 0) {
              if (!apiKey) {
                // No API key — fail loud
                throw new Error(
                  `Docusaurus content sync for ${code}: no API key available.\n` +
                  '  Set OPENROUTER_API_KEY in .env.local to translate content.'
                );
              }
              const fmResult = await translateBatch(
                fmMisses, fieldsToTranslate, pairConfig,
                { apiKey, model: pairConfig.model, batchSize: pairConfig.batchSize || 30 },
              );
              if (fmResult) {
                // Content-preservation gate — Phase 2 front matter reached
                // disk AND the TM with no validation at all, so a hollowed
                // page title was written silently and then cached forever.
                // Throwing skips the file and leaves its lock entry alone,
                // so the next sync retries it.
                for (const [field, value] of Object.entries(fmResult)) {
                  const sourceValue = fieldsToTranslate[field];
                  if (typeof value !== 'string' || typeof sourceValue !== 'string') continue;
                  const hollowed = checkContentPreservation(sourceValue, value);
                  if (hollowed) {
                    throw new Error(
                      `Docusaurus content sync for ${code}: front matter "${field}" — ${hollowed.reason}.\n` +
                      `  source: ${JSON.stringify(sourceValue)}\n` +
                      `  got:    ${JSON.stringify(value)}\n` +
                      '  Nothing was written or cached. If this is a low-coverage target\n' +
                      '  language, the model has no vocabulary for this string.'
                    );
                  }
                }
                Object.assign(translatedFields, fmResult);
                // Cache only what the API actually returned (the same
                // non-null check that gates writing it to the target file).
                for (const [field, value] of Object.entries(fmResult)) {
                  if (typeof value === 'string' && typeof fieldsToTranslate[field] === 'string') {
                    storeTM(tm, fieldsToTranslate[field], code, tmKey, value);
                  }
                }
              } else {
                // Front matter translation failed — loud error
                throw new Error(
                  `Docusaurus content sync for ${code}: front matter translation returned no results.\n` +
                  '  Check your API key and method configuration.'
                );
              }
            }
          }

          // Translate body — whole-body TM first (a revert or a lock-loss
          // re-run is free), then block-level TM + ONE batched API call
          // for the missed blocks ('block' mode), or the whole-page prompt
          // ('page' mode). If ANY part fails, the file fails whole:
          // nothing partial is written, nothing is cached.
          let translatedBody = body;
          let bodyUsedFallback = false;
          if (body.trim()) {
            const wholeBodyCached = lookupTMValidated(tm, body, code, tmKey,
              (src, cached) => !checkContentPreservation(src, cached));
            if (wholeBodyCached !== null) {
              translatedBody = wholeBodyCached;
            } else {
              const segMode = pairConfig.contentSegmentation || config.contentSegmentation || 'block';
              const { protectedBody, blocks } = protectBlocks(body);
              const promptOptions = {
                sourceLanguageName: DEFAULT_REGISTERS[inputLocale]?.name || inputLocale,
                promptContext: pairConfig.promptContext || null,
              };

              // Block stores are deferred until the reassembled body passes
              // the orphaned-placeholder check — the TM must never hold a
              // value that would fail the gate on re-serve.
              const pendingBlockStores = [];

              if (segMode === 'page') {
                // Whole-page prompt — today's single-call behavior.
                if (!apiKey) {
                  throw new Error(
                    `Docusaurus body translation for ${code}: no API key available.\n` +
                    '  Set OPENROUTER_API_KEY in .env.local to translate content.'
                  );
                }
                const prompt = buildContentPrompt(protectedBody, pairConfig, promptOptions);
                const bodyResult = await translateRawContent(prompt, { apiKey, pairConfig });
                if (!bodyResult) {
                  throw new Error(
                    `Docusaurus body for ${code}: translation returned no results.\n` +
                    '  Check your API key and method configuration.'
                  );
                }
                translatedBody = restoreBlocks(bodyResult, blocks);
              } else {
                // Block mode: segment the PROTECTED body (placeholders are
                // single tokens, so they can never be split), serve blocks
                // from the TM, and batch the misses into one API call.
                const segments = splitBlocks(protectedBody);

                // TM keys use each block's RESTORED source text: placeholder
                // numbering is positional per file, so the protected text of
                // an identical paragraph differs across files/edits, while
                // the restored text is stable and self-contained. Cached
                // values are likewise restored — they must never carry
                // another file's placeholder ids.
                const rendered = segments.map(seg => ({
                  seg,
                  source: restoreBlocks(seg.text, blocks),
                  out: null,
                }));

                const missed = [];
                for (const r of rendered) {
                  if (r.seg.type !== 'translatable') {
                    // Separators + passthrough blocks: copied verbatim, never billed.
                    r.out = r.source;
                    continue;
                  }
                  const cached = lookupTMValidated(tm, r.source, code, tmKey,
                    (src, c) => !checkContentPreservation(src, c));
                  if (cached !== null) {
                    r.out = cached;
                  } else {
                    missed.push(r);
                  }
                }

                if (missed.length > 0) {
                  if (!apiKey) {
                    throw new Error(
                      `Docusaurus body translation for ${code}: no API key available.\n` +
                      '  Set OPENROUTER_API_KEY in .env.local to translate content.'
                    );
                  }
                  // Self-repair ladder (translateBlockBatchResilient): full
                  // batch → one missing-segments-only retry → honest
                  // '[EN] '-prefixed source for anything still missing. A
                  // duplicate/unknown marker or an empty first response
                  // still fails the file whole.
                  const { blocks: translatedBlocks, fellBack } =
                    await translateBlockBatchResilient({
                      texts: missed.map(r => r.seg.text),
                      buildPrompt: (texts) => buildBlockBatchPrompt(
                        texts, pairConfig, { ...promptOptions, pageTitle }),
                      callModel: (prompt) => translateRawContent(prompt, { apiKey, pairConfig }),
                      fallbackPrefix: config.fallbackPrefix,
                    });
                  const fellBackSet = new Set(fellBack);
                  if (fellBack.length > 0) {
                    bodyUsedFallback = true;
                    output.warn(
                      `Docusaurus body for ${code}: ${fellBack.length} of ${missed.length} ` +
                      `block(s) missing from the model response after a retry — written as ` +
                      `'${config.fallbackPrefix}'-prefixed source. Not cached, lock not ` +
                      `advanced: the next sync retries just those block(s).`
                    );
                  }
                  missed.forEach((r, i) => {
                    r.out = restoreBlocks(translatedBlocks[i], blocks);
                    // Fallen-back segments are never TM-cached — an error
                    // cached is an error forever (they re-bill next sync).
                    if (!fellBackSet.has(i)) {
                      pendingBlockStores.push({ source: r.source, translation: r.out });
                    }
                  });
                }

                // Reassemble in order with the source's exact separators.
                translatedBody = rendered.map(r => r.out).join('');
              }

              // Orphaned-placeholder check on the REASSEMBLED body — the
              // same gate for both modes.
              if (hasOrphanedPlaceholders(translatedBody)) {
                throw new Error(
                  `Docusaurus body for ${code}: placeholder corruption detected.\n` +
                  '  Code blocks were corrupted during translation.'
                );
              }

              // Content-preservation check on the REASSEMBLED body — same
              // lane, same reasoning as the front matter above. Skipped for a
              // fallback body: it deliberately carries '[EN] '-prefixed
              // source text and is neither cached nor lock-advanced already.
              const bodyHollowed = !bodyUsedFallback && checkContentPreservation(body, translatedBody);
              if (bodyHollowed) {
                throw new Error(
                  `Docusaurus body for ${code}: ${bodyHollowed.reason}.\n` +
                  '  Nothing was written or cached. If this is a low-coverage target\n' +
                  '  language, the model has no vocabulary for this text.'
                );
              }

              // Store per-block AND whole-body entries only after the check
              // passes (whole-body makes reverts/lock-loss re-runs free). A
              // fallback body is NEVER stored whole — it contains
              // untranslated '[EN] ' text.
              for (const s of pendingBlockStores) {
                storeTM(tm, s.source, code, tmKey, s.translation);
              }
              if (!bodyUsedFallback) {
                storeTM(tm, body, code, tmKey, translatedBody);
              }
            }
          }

          // Reassemble and write
          const contentOutput = reassembleContentFile({
            rawFrontMatter, translatedFields, translatedBody,
            hasFrontMatter, frontMatterFormat,
          });
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, contentOutput, 'utf-8');

          totalContent++;
          // Advance the manifest entry ONLY here, on success. A failed item
          // keeps its old entry (or none), so it re-fires next sync — as
          // does a fallback body (its re-fire is TM-cheap: only the
          // fallen-back segment re-bills).
          if (!bodyUsedFallback) {
            updatedDocuManifest[manifestKey] = sourceHash;
            manifestDirty = true;
          }

        } catch (contentErr) {
          contentFailures++;
          output.error(`${dirName}/${relPath} → ${code} — ${contentErr.message}`);
        }

        // Progress reporting
        completed++;
        const pct = Math.round(100 * completed / totalWork);
        const elapsedMs = Date.now() - syncStartTime;
        const msPerItem = elapsedMs / completed;
        const remainingMs = msPerItem * (totalWork - completed);
        const remainingSec = Math.ceil(remainingMs / 1000);
        const etaStr = remainingSec > 5 ? ` (~${remainingSec}s left)` : '';
        const tag = contentFailures > 0 && completed === totalWork
          ? 'FAIL'
          : action === 're-translate' ? 'RE-TRANSLATE' : action === 'changed' ? 'CHANGED' : 'OK';
        // Show [FAIL] for items that just errored (contentErr was caught above)
        const itemFailed = updatedDocuManifest[manifestKey] !== sourceHash;
        const displayTag = itemFailed && !dryRun ? 'FAIL' : tag;
        output.raw(`    [${completed}/${totalWork}] (${pct}%) ${dirName}/${relPath} → ${code} [${displayTag}]${etaStr}`);

        // Incremental manifest write
        if (completed % MANIFEST_WRITE_INTERVAL === 0) {
          writeManifestIfDirty();
        }
      }, { concurrency });

      // Final manifest write
      writeManifestIfDirty();
    }

    // Also persist any skipped-file hash recordings
    if (!dryRun) {
      const sorted = {};
      for (const key of Object.keys(updatedDocuManifest).sort()) {
        sorted[key] = updatedDocuManifest[key];
      }
      fs.writeFileSync(contentLockPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    }

    if (totalContent > 0 || totalContentSkipped > 0 || totalContentRetranslated > 0) {
      const action = dryRun ? 'Would create' : 'Created';
      const retranslateNote = totalContentRetranslated > 0 ? ` (${totalContentRetranslated} re-translated)` : '';
      output.ok(`${action} ${totalContent} content file(s)${retranslateNote}, ${totalContentSkipped} unchanged`);
    }

    // Fail loud if any content translations failed — do NOT exit 0
    if (contentFailures > 0) {
      throw new Error(
        `${contentFailures} content translation(s) failed. ` +
        `Re-run sync to retry failed files (completed files are cached).`
      );
    }
  }

  // Save TM if it was mutated during this Docusaurus sync (stores OR
  // evictions — a size check would miss eviction-only runs and same-key
  // replacements). Skip when --no-tm is active.
  if (!dryRun && !noTM && isTMDirty(tm)) {
    const tmFinalSize = tmSize(tm);
    const delta = tmFinalSize - tmInitialSize;
    saveTM(cwd, tm);
    output.info(`[TM] Saved ${tmFinalSize} entries (${delta >= 0 ? '+' + delta : delta} this sync)`);
  }

  output.raw('');
}

export { runDocusaurusSync, discoverDocusaurusJSONFiles };
