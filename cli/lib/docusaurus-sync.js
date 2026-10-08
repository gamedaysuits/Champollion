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
import { translateRawContent, getMethod } from './translate.js';
import {
  splitBlocks, buildBlockBatchPrompt, parseBlockBatchResponse,
  translateBlockBatchResilient,
  assertSegmentationMode,
} from './segment.js';
import { DEFAULT_REGISTERS } from './registers.js';
import { DEFAULT_JSON_CONCURRENCY } from './config.js';
import { compileNoTranslate } from './no-translate.js';
import { checkContentPreservation, contentGateFault, SharedOutputIndex } from './validate.js';
import { convertScript, applyScriptFallback } from './scripts.js';
import { pMap } from './concurrent.js';
import {
  loadTM, saveTM, tmSize, isTMDirty,
  lookupTM, peekTM, storeTM, evictTM, partitionByTM, tmMethodKey, setModelCarryover, bypassTMFor,
  describeTMChanges, adoptLegacyCoachingKeys,
} from './tm.js';
import {
  readLock, writeManifest, detectChangedKeys, hashValue,
} from './hash.js';
import {
  LockState, planQueue, recordRefusal, describeHeldKeys, describeFallbackOnlyKeys, keyFateNote, describeHeldNext,
  shortSourceHash,
} from './locale-state.js';
import { redoCommand } from './verify.js';
import { CONTENT_LOCK_FILENAME } from './content-sync.js';
import {
  parseMaxCost, abortForMaxCost, maxCostVerdict, reportDryRunMaxCost, printCostTable, warnModelSwitchStrandedTM, priceContentChars,
  preflightStopReason,
  summarizeEstimate,
} from './cost-report.js';
import { billableContentChars, translatableBlockSources } from './content-estimate.js';
import { compileFileScope } from './file-scope.js';
import { output } from './output.js';
import { missingKeyAdvice } from './missing-key.js';
import { translateWithFallback } from './translate-pair.js';
import {
  tmKeysForPair, tmHoldsValue, createFallbackBudget, newFallbackReport, addToTally,
  fallbackSummary, printFallbackReport, warnFallbackMajority, lookupContentTM, serveFieldsFromFallbackCache,
  translateFieldsWithFallback, translateBlocksWithFallback, translatePageWithFallback,
  refuseRepeatedCachedPage,
} from './fallback.js';
import { walkFiles } from './locale-layout.js';
import {
  readRefusals, contentHolds, nextRefusals, storeRefusals, blockUnit, fieldUnit, describeHeld, describeNewHold,
  describeFallenBack, previewHeld, PAGE_UNIT, PAGE_NAME, pendingLockValue, isPendingLock, logRefusal, reportLeftInSource,
} from './content-refusals.js';
import { applyNamedKeyRule, reportUnmatchedKeys, unmatchedKeysSummary, reportNamedFromCache } from './named-keys.js';

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
  // The shared folder-per-locale walk (lib/locale-layout.js). Docusaurus
  // keeps its historical reach: hidden entries are NOT skipped here.
  return walkFiles(sourceLocaleDir, name => name.endsWith('.json'), { skipHidden: false });
}

/**
 * What one (UI-string file × locale) queue becomes once the lock's refusal
 * records are consulted — the key-value lane's rule (lib/locale-state.js
 * planQueue), shared by the estimate and the sync so the estimate prices
 * exactly what the run sends. A key the gate refused for its current source
 * text is held back from the method that refused it (its fallback, when it
 * has not refused it, is asked instead) unless it is named for a redo
 * (`--redo keys:`), queued by `--redo all`, or the run is `--fresh`.
 *
 * Docusaurus records no written values, so no value counts as a person's
 * edit here (a bulk redo re-translates every UI string, as it always did),
 * and there is no pending retry: a UI string refused under a redo is held
 * back by the next plain sync, as a content block is.
 *
 * @param {object} p
 * @param {object} p.diff - diffLocale result for the file × locale
 * @param {object} p.sourceFlat
 * @param {object} p.targetFlat
 * @param {string} p.nsPrefix - "docusaurus:<relPath>:" (the lock's key space)
 * @param {object} p.localeState - LockState.of(code) / .peek(code)
 * @param {object} p.pairConfig
 * @param {{ named: Set<string>, bulk: boolean, fresh: boolean }} p.redo
 * @param {string} p.fallbackPrefix
 * @returns {{ held: string[], heldFromPrimary: string[] }}
 */
function planUIStrings({ diff, sourceFlat, targetFlat, nsPrefix, localeState, pairConfig, redo, fallbackPrefix }) {
  const plan = planQueue({
    diff, sourceFlat, targetFlat, lockKeyOf: (k) => nsPrefix + k, localeState,
    named: redo.named, bulk: redo.bulk, pending: new Set(), fresh: redo.fresh, pairConfig,
    classify: () => 'machine',
    fallbackPrefix,
  });
  return { held: plan.held, heldFromPrimary: plan.heldFromPrimary };
}

/**
 * UI strings refused for an older source text that the file still holds as
 * the English copy of that text (Docusaurus needs every id, so an untranslated
 * one is written as its source message): the source was edited since, which
 * lifts the hold — queued as changed. Without this the edit was invisible: the
 * refused string never had its source hash recorded, and the old English no
 * longer equals the new source, so nothing queued it.
 *
 * @returns {string[]}
 */
function editedSinceRefused(sourceFlat, targetFlat, nsPrefix, localeState) {
  const out = [];
  for (const [k, src] of Object.entries(sourceFlat)) {
    const rec = localeState.refused[nsPrefix + k];
    if (!rec || typeof src !== 'string' || typeof targetFlat[k] !== 'string') continue;
    if (rec.source !== shortSourceHash(src) && shortSourceHash(targetFlat[k]) === rec.source) out.push(k);
  }
  return out;
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
 * @param {import('./file-scope.js').FileScope|null} [fileScope] - --files / --retranslate
 *   too (action 're-translate'), WITHOUT clearing the manifest — a target
 *   with no lock entry and no '[EN] ' markers is a genuine hand-translated
 *   file, and force must never overwrite human work with machine output.
 * @returns {{ workItems: Array<object>, totalContentSkipped: number, recordedHashes: object }}
 */
function scanDocusaurusContentWork(contentSources, pairEntries, config, manifest, forceContent, fileScope = null) {
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
      const label = `${dirName}/${relPath}`;
      if (fileScope && !fileScope.includes(label)) continue;
      const retranslate = fileScope ? fileScope.retranslates(label) : false;

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

      for (const [pairKey, pairConfig] of pairEntries) {
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

        if (retranslate) {
          // --retranslate: named by the operator — no lock skip, no
          // adoption; the caller makes its text miss the TM.
          if (fs.existsSync(targetPath)) action = 're-translate';
        } else if (fs.existsSync(targetPath)) {
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
            // No stored hash — check for legacy [EN] fallback markers (pages
            // written before 2026-10-05; now such a page has a pending:<hash>
            // lock entry instead). This runs
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
          pairKey, pairConfig, code, targetPath, manifestKey, pluginName, action, retranslate,
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
async function printDocusaurusCostEstimate(pairEntries, config, sourceLocaleDir, tm, contentWorkItems, lockManifest, noTranslate, lockState = null, redo = null) {
  try {
    const { estimateCost } = await import('./pairs.js');
    const costEstimates = [];
    let totalEstimatedCost = 0;
    let hasUnknownCosts = false;

    // ── Phase 1: JSON UI strings, TM-partitioned per pair ───────────
    const sourceJSONFiles = discoverDocusaurusJSONFiles(sourceLocaleDir);
    const missesByPair = new Map(); // pairKey → miss count
    const hitsByPair = new Map();   // pairKey → TM hit count
    const heldByPair = new Map();   // pairKey → keys held back (refused before; not sent)

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
        // With a fallback, its cached values count too (lib/fallback.js).
        const estTmKeys = tmKeysForPair(pairConfig);
        const localeChanged = lockState
          ? [...new Set([...changedKeys, ...editedSinceRefused(sourceFlat, existingFlat, nsPrefix, lockState.peek(code))])]
          : changedKeys;
        const diff = diffLocale(
          sourceFlat, existingFlat, config.fallbackPrefix,
          config._forceAllKeys ? Object.keys(sourceFlat) : config.forceKeys, localeChanged,
          (key, sourceValue) => tmHoldsValue(tm, sourceValue, code, estTmKeys, sourceValue),
          noTranslate.active ? noTranslate.matches : null
        );
        const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');
        if (stringKeys.length === 0) continue;

        // Refused before (the lock's records): never sent to the method that
        // refused them — held keys cost nothing; a fallback is not priced.
        const notSent = new Set();
        if (lockState && redo) {
          const plan = planUIStrings({
            diff, sourceFlat, targetFlat: existingFlat, nsPrefix, localeState: lockState.peek(code), pairConfig, redo,
            fallbackPrefix: config.fallbackPrefix,
          });
          for (const k of [...plan.held, ...plan.heldFromPrimary]) notSent.add(k);
        }
        let { misses } = partitionByTM(tm, sourceFlat, stringKeys, code, tmMethodKey(pairConfig));
        if (estTmKeys.length > 1) misses = misses.filter(k => lookupTM(tm, sourceFlat[k], code, estTmKeys[1]) === null);
        const held = misses.filter(k => notSent.has(k)).length;
        misses = misses.filter(k => !notSent.has(k));
        missesByPair.set(pairKey, (missesByPair.get(pairKey) || 0) + misses.length);
        hitsByPair.set(pairKey, (hitsByPair.get(pairKey) || 0) + (stringKeys.length - misses.length - held));
        heldByPair.set(pairKey, (heldByPair.get(pairKey) || 0) + held);
      }
    }

    for (const [pairKey, pairConfig] of pairEntries) {
      const keysToTranslate = missesByPair.get(pairKey) || 0;
      const tmHits = hitsByPair.get(pairKey) || 0;
      const heldCount = heldByPair.get(pairKey) || 0;
      if (keysToTranslate === 0 && tmHits === 0 && heldCount === 0) continue;

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
          ...(heldCount > 0 && { held: heldCount }),
          estimatedCost: estimate.estimatedCost,
          source: estimate.source,
          ...(estimate.local && { local: true }),
          ...(estimate.note && { note: estimate.note }),
          // The rate it was priced at, its source and date (cost-report.js rateLine).
          ...(estimate.rate && { rate: estimate.rate }),
          // No price: the model it was looked up under, so the table can name it.
          ...(estimate.estimatedCost === null && estimate.model && { model: estimate.model }),
        });
      } else {
        // Fully TM-covered: zero API calls → a KNOWN $0, even for
        // unknown-pricing methods. Must not trip hasUnknownCosts.
        costEstimates.push({
          pair: pairKey,
          method: pairConfig.method || 'llm',
          keys: 0,
          tmHits,
          ...(heldCount > 0 && { held: heldCount }),
          estimatedCost: 0,
          source: tmHits > 0 ? 'translation-memory' : 'nothing-to-send',
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
      const roughCharsByPair = new Map(); // pairConfig → all source chars, as if the TM were empty
      const pendingSourceFiles = new Set();

      for (const item of contentWorkItems) {
        pendingSourceFiles.add(item.sourcePath);
        const code = item.code;
        const segMode = item.pairConfig.contentSegmentation || config.contentSegmentation || 'block';
        const { billedChars: chars, totalChars } = billableContentChars({
          tm,
          code,
          tmKey: tmMethodKey(item.pairConfig),
          fallbackTmKey: item.pairConfig.fallback ? tmMethodKey(item.pairConfig.fallback) : null,
          fields: item.fieldsToTranslate,
          body: item.parsed.body,
          segMode,
          blockSources: () => {
            if (!blockSourcesCache.has(item.sourcePath)) {
              blockSourcesCache.set(item.sourcePath, translatableBlockSources(item.parsed.body));
            }
            return blockSourcesCache.get(item.sourcePath);
          },
          holds: item.holds || null,
        });
        roughCharsByPair.set(item.pairConfig, (roughCharsByPair.get(item.pairConfig) || 0) + totalChars);

        if (chars > 0) {
          charsByPair.set(item.pairConfig, (charsByPair.get(item.pairConfig) || 0) + chars);
        }
      }

      const billed = await priceContentChars(charsByPair, pairEntries, estimateCost);
      const rough = await priceContentChars(roughCharsByPair, pairEntries, estimateCost);
      const contentCost = billed.cost;
      const contentUnknown = billed.unknown;

      content = {
        files: pendingSourceFiles.size,
        pendingTranslations: contentWorkItems.length,
        estimatedCost: contentUnknown ? null : contentCost,
        costWithoutTM: rough.unknown ? null : rough.cost,
        rough: true,
        // Which pairs have no price, and why (printCostTable names them).
        ...(contentUnknown && { unpriced: billed.unpriced }),
        // The rates the billed part was priced at.
        ...(billed.rates.length > 0 && { rates: billed.rates }),
      };
      if (contentUnknown) {
        hasUnknownCosts = true;
      } else {
        totalEstimatedCost += contentCost;
      }
    }

    printCostTable(costEstimates, content, totalEstimatedCost, hasUnknownCosts);

    return summarizeEstimate(costEstimates, content, totalEstimatedCost, hasUnknownCosts);
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

  // Keys named for a redo (--redo keys: / --force-keys) must exist — the
  // rule the key-value path applies (lib/named-keys.js). A name matching no
  // UI string used to re-queue nothing in silence and exit 0. Checked before
  // the preflight, the estimate or any spend: with no name matching nothing
  // runs; with some, those are redone and the run then fails naming the rest.
  // Docusaurus message ids are per file but named bare: a name re-queues
  // that id in every JSON file that has it (as the diff below applies it).
  const unmatchedNamed = applyNamedKeyRule({
    cliArgs, config,
    known: () => {
      const ids = new Set();
      for (const file of discoverDocusaurusJSONFiles(sourceLocaleDir)) {
        for (const key of Object.keys(extractDocusaurusMessages(JSON.parse(fs.readFileSync(file, 'utf-8'))))) {
          if (!isUnsafeKey(key)) ids.add(key);
        }
      }
      return ids;
    },
  });

  // Thread dryRun/audit into cliArgs so the preflight check can skip
  // when appropriate — same pattern as the main sync path in sync.js
  const { apiKey, pairEntries, preflightFailures = [] } = await resolveRuntime(config, cwd, { ...cliArgs, dryRun, audit });

  // Content needs what the pair's own method needs — a local model needs no
  // OPENROUTER_API_KEY (the lane used to demand it for every pair). Same
  // lazy, per-pair readiness check as the content lane (content-sync.js).
  const readinessCache = new Map();
  const requirePairReady = async (pairKey, pairConfig, code, what) => {
    if (!readinessCache.has(pairKey)) {
      const method = getMethod(pairConfig.method || 'llm', pairConfig);
      readinessCache.set(pairKey, Promise.resolve(method.checkReadiness({ apiKey, cwd })));
    }
    const readiness = await readinessCache.get(pairKey);
    if (!readiness.ready) {
      throw new Error(
        `Docusaurus ${what} for ${code}: method "${pairConfig.method || 'llm'}" cannot run — no API key or unmet prerequisite.\n` +
        `  ${readiness.reason}\n` +
        missingKeyAdvice({ reasons: [readiness.reason], setupHelp: ['  Set the key it names in .env.local (or your environment) to translate content.'] }).join('\n')
      );
    }
  };

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
  // Model carry-over (lib/tm.js) is on unless --fresh-on-model-change.
  const freshOnModelChange = !!cliArgs['fresh-on-model-change'];
  if (freshOnModelChange) setModelCarryover(tm, false);
  // Entries made before coaching was keyed, with today's coaching: still
  // served (lib/tm.js adoptLegacyCoachingKeys).
  if (!noTM) adoptLegacyCoachingKeys(tm, pairEntries.map(([, pc]) => pc));
  if (!noTM) warnModelSwitchStrandedTM(tm, pairEntries.map(([, pc]) => pc), { fresh: freshOnModelChange });

  // Phase-1 source-hash manifest (.champollion.lock) — read up front
  // because the cost estimator mirrors Phase 1's changed-key detection.
  // Keys are namespaced per source file ("docusaurus:<relPath>:<flatKey>")
  // because Docusaurus splits UI strings across many JSON files whose flat
  // keys can collide (e.g. two plugins both defining "title"). Without the
  // manifest, EDITING an English UI string never re-translated it: the
  // diff only sees missing keys and [EN] fallbacks, so a changed source
  // value looked "fully synced" forever.
  const lock = readLock(cwd);
  const lockManifest = lock.source;
  const updatedLockManifest = { ...lockManifest };
  // The lock's per-locale record (lib/locale-state.js): which UI strings the
  // quality gate refused, per (file × key × locale), for their current source
  // text and the method key that produced the refused answer. A plain sync
  // holds them back from that method — the key-value rule. Keyed like the
  // manifest ("docusaurus:<relPath>:<id>").
  const lockState = new LockState(lock.locales);
  // What counts as an explicit redo (always sent, never held back): ids named
  // by --redo keys: / --force-keys, every id under --redo all (--force), and
  // anything under --fresh.
  const redo = { named: new Set(config.forceKeys || []), bulk: !!config._forceAllKeys, fresh: noTM };

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
  // --files / --retranslate (lib/file-scope.js). Resolved at the scan, so a
  // pattern that matches nothing fails before the estimate or any spend.
  const fileScope = compileFileScope(cliArgs);
  const contentScan = scanDocusaurusContentWork(
    contentSources, pairEntries, config, docuContentManifest, forceContent, fileScope
  );
  if (fileScope) fileScope.assertAllMatched();
  // --retranslate files miss the TM for this run (estimate and sync alike),
  // so they are priced and translated fresh; new results replace the cache.
  for (const item of contentScan.workItems) {
    if (!item.retranslate) continue;
    bypassTMFor(tm, item.code, [
      ...Object.values(item.fieldsToTranslate), item.parsed.body, ...translatableBlockSources(item.parsed.body),
    ]);
  }
  // Blocks and front-matter fields the quality gate refused before
  // (lib/content-refusals.js): not sent to the method that refused them again
  // unless the page is named for a redo (--redo files: / --redo content /
  // --retranslate / --fresh). The estimate and the sync read the same holds.
  for (const item of contentScan.workItems) {
    item.refusalsBefore = readRefusals(docuContentManifest, item.manifestKey);
    item.holds = contentHolds(item.refusalsBefore, item.pairConfig, { redo: forceContent || item.retranslate || noTM });
  }

  // ── Pre-sync cost estimation + --max-cost gate ────────────────
  // Mirrors sync.js: without a cap the estimate is informational and
  // failures are non-blocking; with a cap it is a GATE — over-cap or
  // unknowable estimates abort before any API call (unknown ≠ free).
  // Dry-runs are exempt: they make no API calls, and the preview is the
  // exact thing a capped user needs to see.
  const maxCost = parseMaxCost(cliArgs['max-cost']);
  const costEstimate = await printDocusaurusCostEstimate(
    pairEntries, config, sourceLocaleDir, tm, contentScan.workItems, lockManifest, noTranslate, lockState, redo
  );
  // Machine-readable estimate BEFORE the gate (see sync.js).
  if (costEstimate) output.event('cost', costEstimate);
  // A dry run never stops at the cap, but says what the real run would do.
  let dryMaxCost = null;
  if (maxCost !== null && !dryRun) {
    const verdict = maxCostVerdict(maxCost, costEstimate);
    if (verdict.wouldStop) return abortForMaxCost(maxCost, verdict.estimatedCost, verdict.reason);
  } else if (maxCost !== null) {
    dryMaxCost = reportDryRunMaxCost(maxCost, costEstimate, { stopsEarlier: preflightStopReason(preflightFailures) });
  }

  // Fallback methods are outside the estimate (they translate what the
  // primary fails, unknown in advance). Under --max-cost each fallback batch
  // must fit in what the estimate left of the cap (lib/fallback.js).
  if (pairEntries.some(([, p]) => p.fallback)) {
    output.info(
      'Fallback methods are not in this estimate — they only translate what the primary method fails, '
      + 'which is not known in advance.'
      + (maxCost !== null ? ' Under --max-cost each fallback batch is priced before it runs and skipped if it would pass the cap.' : '')
    );
  }
  const fallbackBudget = createFallbackBudget({
    maxCost: dryRun ? null : maxCost,
    committed: costEstimate?.knownEstimatedCost ?? 0,
    cwd,
  });
  // Different inputs, same output (lib/validate.js SharedOutputIndex): one
  // index per locale for this run's UI strings and Markdown pages — cached
  // and fresh alike, as in the content lane (lib/content-sync.js).
  const sharedOutputIndexes = new Map();
  const sharedOutputsFor = (code) => {
    if (!sharedOutputIndexes.has(code)) {
      sharedOutputIndexes.set(code, new SharedOutputIndex({ protectedTerms: config.protectedTerms || [] }));
    }
    return sharedOutputIndexes.get(code);
  };
  // Per-pair tallies of what each fallback did: JSON keys, Markdown segments.
  const keyFallbackTallies = new Map();
  const contentFallbackTallies = new Map();
  // A page some of whose text the fallback produced (its answer or its
  // cache): named in the [FALLBACK] line.
  const notePage = (pairKey, page) => {
    const tally = contentFallbackTallies.get(pairKey);
    if (tally && !tally.produced.includes(page)) tally.produced.push(page);
  };
  const tallyContent = (pairKey, report, page) => {
    if (!contentFallbackTallies.has(pairKey)) return;
    addToTally(contentFallbackTallies.get(pairKey), report);
    if (report && (report.accepted > 0 || report.cached > 0)) notePage(pairKey, page);
  };
  if (!dryRun) {
    for (const [pairKey, pc] of pairEntries) {
      if (!pc.fallback) continue;
      keyFallbackTallies.set(pairKey, newFallbackReport(pc.fallback));
      contentFallbackTallies.set(pairKey, newFallbackReport(pc.fallback));
    }
  }

  // ── Phase 1: JSON UI strings ──────────────────────────────────

  const sourceJSONFiles = discoverDocusaurusJSONFiles(sourceLocaleDir);
  output.raw(`  Phase 1: JSON strings (${sourceJSONFiles.length} file(s))\n`);

  let totalJSONKeys = 0;
  let totalJSONCopied = 0;
  let totalJSONFailed = 0;
  // UI strings held back (refused before; not sent) and what the next sync
  // does with each one this run could not translate (lib/locale-state.js).
  let totalJSONHeld = 0;
  let totalJSONWritten = 0;
  const jsonFates = { retry: [], held: [] }; // { pair, key }
  // Every lock key the source still has (refused records for others are dropped).
  const liveLockKeys = new Set();

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
    for (const key of Object.keys(sourceFlat)) liveLockKeys.add(nsPrefix + key);
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
      const filename = `${code}/${relPath}`;

      // Security: verify target path stays within i18n directory
      if (!isPathContained(targetFilePath, config.localesDir)) {
        output.error(`${filename} — refusing to write outside i18n directory`);
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
      // A value the pair's fallback produced is cached under the fallback.
      const tmKeys = tmKeysForPair(pairConfig);
      const localeState = dryRun ? lockState.peek(code) : lockState.of(code);
      // A refused string whose source was edited since: queued (the hold lifts).
      const localeChanged = [...new Set([...changedKeys, ...editedSinceRefused(sourceFlat, existingFlat, nsPrefix, localeState)])];
      const diff = diffLocale(
        sourceFlat, existingFlat, config.fallbackPrefix,
        config._forceAllKeys ? Object.keys(sourceFlat) : config.forceKeys, localeChanged,
        (key, sourceValue) => tmHoldsValue(tm, sourceValue, code, tmKeys, sourceValue),
        noTranslate.active ? noTranslate.matches : null
      );

      if (diff.toProcess.length === 0 && diff.noTranslate.length === 0 && diff.extra.length === 0) {
        return { keys: 0, failedKeys: [] };
      }

      // Refused before (the lock's records): held back from the method that
      // refused them — the key-value rule (planUIStrings).
      const plan = planUIStrings({
        diff, sourceFlat, targetFlat: existingFlat, nsPrefix, localeState, pairConfig, redo,
        fallbackPrefix: config.fallbackPrefix,
      });
      const heldSet = new Set(plan.held);
      const lk = (k) => nsPrefix + k;

      let keysProcessed = 0;
      let keysCopied = 0;
      let keysWritten = 0; // translations written (the model, its fallback, the cache)
      const failedKeys = [];
      const heldKeys = [];
      const fates = { retry: [], held: [] };

      if (diff.toProcess.length > 0 || diff.noTranslate.length > 0) {
        // The per-file line counts what goes to the pipeline; held keys are
        // said on their own line below.
        const shown = heldSet.size === 0 ? diff : Object.fromEntries(Object.entries(diff).map(([k, v]) => (
          [k, Array.isArray(v) && k !== 'noTranslate' && k !== 'extra' ? v.filter(x => !heldSet.has(x)) : v])));
        const label = diffLabel(shown);
        output.info(`${filename} — ${plan.held.length > 0 ? `${label === 'fully synced' ? '' : `${label} + `}${plan.held.length} held back` : label}`);
        if (plan.held.length > 0) {
          output.warn(describeHeldKeys({ filename, keys: plan.held, pairConfig, command: redoCommand(plan.held, { pair: pairKey }) }));
        }
        if (plan.heldFromPrimary.length > 0) {
          output.info(describeFallbackOnlyKeys({ filename, keys: plan.heldFromPrimary, pairConfig }));
        }
        // Named for a redo but served from the cache (the model is not asked
        // without --fresh): said, with the command that asks the model again.
        const namedQueued = redo.fresh ? [] : diff.toProcess.filter(k => redo.named.has(k) && typeof sourceFlat[k] === 'string');

        if (!dryRun) {
          // Merged output starts from what's on disk, then takes the verbatim
          // no-translate copies. Applying them FIRST means a translation
          // failure below can still flush them — they don't depend on the
          // backend, so an outage must not strand a corrupted URL.
          const mergedFlat = { ...existingFlat };
          for (const key of diff.noTranslate) {
            mergedFlat[key] = sourceFlat[key];
            delete localeState.refused[lk(key)];
          }
          keysCopied = diff.noTranslate.length;
          const writeMerged = () => {
            const docuOutput = injectDocusaurusMessages(sourceRaw, mergedFlat);
            fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
            fs.writeFileSync(targetFilePath, JSON.stringify(docuOutput, null, 2) + '\n', 'utf-8');
          };
          // What the gate refused this run is remembered per key (held back
          // by the next plain sync); what got no usable answer is asked again.
          const settleUnfilled = (keys, refusedBy = {}) => {
            for (const k of keys) {
              recordRefusal(localeState, lk(k), sourceFlat[k], refusedBy[k]);
              fates[(refusedBy[k] || []).length > 0 ? 'held' : 'retry'].push(k);
            }
          };

          if (keysCopied > 0) {
            const sample = diff.noTranslate.slice(0, 3)
              .map(k => `${k} (${noTranslate.reason(k, sourceFlat[k])})`)
              .join(', ');
            const more = keysCopied > 3 ? `, +${keysCopied - 3} more` : '';
            output.info(`${filename} — copied ${keysCopied} no-translate key(s) verbatim: ${sample}${more}`);
          }

          let translated = null;
          let result = null;
          const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');

          if (stringKeys.length > 0) {
            // Shared pipeline: TM partition → API call → quality gate → TM
            // store, then the pair's fallback (if any) for what that left
            // untranslated (lib/translate-pair.js translateWithFallback).
            // Keys held back: the cache is still read, the method not asked.
            result = await translateWithFallback(stringKeys, sourceFlat, pairConfig, pairKey, {
              apiKey, tm, targetCode: code, descriptions, budget: fallbackBudget, cwd,
              // One per locale, as on the standard path: a memorized sentence
              // repeated across UI strings is refused (validate.js).
              sharedOutputs: sharedOutputsFor(code),
              noSendPrimary: new Set([...plan.held, ...plan.heldFromPrimary]),
              noSendFallback: heldSet,
            });
            translated = result.translated;
            if (keyFallbackTallies.has(pairKey)) addToTally(keyFallbackTallies.get(pairKey), result.fallback);
            const heldHere = new Set(result.heldKeys || []);
            heldKeys.push(...stringKeys.filter(k => heldHere.has(k) && !(translated && k in translated)));

            if (translated) {
              const notDone = stringKeys.filter(k => !(k in translated));
              const refusedHere = notDone.filter(k => (result.refusedBy?.[k] || []).length > 0);
              const heldNow = notDone.filter(k => heldHere.has(k));
              const noAnswer = notDone.length - refusedHere.length - heldNow.length;
              output.progressDone(filename, notDone.length === 0 ? '[OK]' : `[WARN] ${notDone.length} of ${stringKeys.length} key(s) not translated (${[
                refusedHere.length > 0 && `${refusedHere.length} refused by the quality gate`,
                heldNow.length > 0 && `${heldNow.length} held back`,
                noAnswer > 0 && `${noAnswer} not returned by the method`,
              ].filter(Boolean).join(', ')})`);
              const answered = new Set(result.answeredKeys || []);
              const fromCache = namedQueued.filter(k => k in translated && !answered.has(k));
              await reportNamedFromCache({
                filename, keys: fromCache, served: translated, onDisk: existingFlat, pairConfig, cwd,
                command: redoCommand(fromCache, { pair: pairKey, fresh: true }),
              });
            } else if (heldKeys.length === stringKeys.length) {
              // Everything queued was held back: nothing was asked, nothing failed anew.
              output.progressDone(filename, `[WARN] ${heldKeys.length} key(s) held back, not translated`);
              for (const k of heldKeys) fates.held.push(k);
              if (keysCopied > 0) writeMerged();
              return { keys: 0, copied: keysCopied, failedKeys: [], heldKeys, fates };
            } else if (result.apiReturnedNull || result.failures.length > 0) {
              output.progressDone(filename, result.apiReturnedNull ? '[ERR] translation failed' : '[ERR] all failed quality gate');
              output.error(result.apiReturnedNull
                ? `${filename}: Translation failed. Check API key and method configuration.`
                : `${filename}: all translations were rejected by the quality gate${pairConfig.fallback ? ` (and by its fallback, ${pairConfig.fallback.method})` : ''} — see the gate failures above.`);
              if (keysCopied > 0) writeMerged();
              const failedNow = stringKeys.filter(k => !heldKeys.includes(k));
              settleUnfilled(failedNow, result.refusedBy || {});
              for (const k of heldKeys) fates.held.push(k);
              return { keys: 0, copied: keysCopied, failedKeys: failedNow, heldKeys, fates };
            }
          }

          // Merge in the new translations. Script conversion mirrors the
          // flat-lane rule in sync.js: only when this pair's resolution asked
          // for it, fallbacks first, and a value with unmappable letters
          // stays whole in the working script (warned, not failed).
          const scriptConverterKey = pairConfig.scriptResolution?.converterKey || null;
          const heldNow = new Set(heldKeys);
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
                    `${filename}: key "${key}" kept in working script — `
                    + `unmapped letter(s): ${unmapped.join(', ')} (see "scriptFallback")`
                  );
                }
              }
              mergedFlat[key] = value;
              keysWritten++;
              // Filled (by the model, its fallback or the cache): no longer refused.
              delete localeState.refused[lk(key)];
            } else if (heldNow.has(key)) {
              // Held back: said above; not sent, not counted as failed.
              fates.held.push(key);
            } else if (typeof sourceFlat[key] === 'string') {
              const fate = (result?.refusedBy?.[key] || []).length > 0 ? 'held' : 'retry';
              output.warn(`${filename}: key "${key}" ${keyFateNote(fate, pairConfig)}`);
              failedKeys.push(key);
              settleUnfilled([key], result?.refusedBy || {});
            } else {
              mergedFlat[key] = sourceFlat[key];
            }
          }

          keysProcessed = diff.toProcess.length - heldKeys.length;

          // Inject back into Docusaurus format and write
          writeMerged();
        } else {
          // Held keys would not be sent: not counted.
          keysProcessed = diff.toProcess.length - plan.held.length;
          keysCopied = diff.noTranslate.length;
          if (namedQueued.length > 0) {
            // What the real run would serve from the cache (the pair's entry,
            // then its fallback's — the same partition the estimate makes).
            const served = {};
            for (const k of namedQueued.filter(x => !heldSet.has(x))) {
              for (const mk of tmKeys) {
                const v = peekTM(tm, sourceFlat[k], code, mk);
                if (v !== null) { served[k] = v; break; }
              }
            }
            const fromCache = Object.keys(served);
            await reportNamedFromCache({
              filename, keys: fromCache, served, onDisk: existingFlat, pairConfig, cwd, dryRun: true,
              command: redoCommand(fromCache, { pair: pairKey, fresh: true }),
            });
          }
          heldKeys.push(...plan.held);
        }
      }

      if (diff.extra.length > 0) {
        output.warn(`${filename} — ${diff.extra.length} extra key(s)`);
      }

      return { keys: keysProcessed, written: keysWritten, copied: keysCopied, failedKeys, heldKeys, fates };
    }, { concurrency: jsonConcurrency });

    // Aggregate results for this JSON file
    const fileFailedKeys = new Set();
    // Held keys keep their manifest hash too (an edited source must still
    // re-fire), but they are not failures.
    const fileUnfilledKeys = new Set();
    pairResults.forEach((r, i) => {
      totalJSONKeys += r.keys;
      totalJSONWritten += r.written || 0;
      totalJSONCopied += r.copied || 0;
      totalJSONHeld += (r.heldKeys || []).length;
      for (const k of r.failedKeys || []) { fileFailedKeys.add(k); fileUnfilledKeys.add(k); }
      for (const k of r.heldKeys || []) fileUnfilledKeys.add(k);
      const pair = pairEntries[i][0];
      for (const fate of ['retry', 'held']) {
        for (const key of r.fates?.[fate] || []) jsonFates[fate].push({ pair, key });
      }
    });
    totalJSONFailed += fileFailedKeys.size;

    // Update the manifest for this file: record the current hash ONLY for
    // keys that succeeded in every locale that attempted them. A failed
    // (or held) key keeps its OLD hash (or none) so it is detected as
    // changed and RE-FIRES on the next sync — advancing the hash for a failed
    // key would silently mark the stale translation as current forever.
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
        if (fileUnfilledKeys.has(key)) {
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

  // Persist the Phase 1 source-hash manifest and the refusal records (skip
  // in dry-run — a preview must not mark changed keys as resolved). Records
  // of UI strings the source no longer has are dropped for the locales this
  // run processed.
  if (!dryRun && sourceJSONFiles.length > 0) {
    for (const [, pc] of pairEntries) {
      const refused = lockState.of(pc.target).refused;
      for (const k of Object.keys(refused)) {
        if (k.startsWith('docusaurus:') && !liveLockKeys.has(k)) delete refused[k];
      }
    }
    writeManifest(cwd, updatedLockManifest, lockState.toJSON());
  }
  for (const [pairKey, tally] of keyFallbackTallies) {
    printFallbackReport(pairKey, pairEntries.find(([k]) => k === pairKey)[1].method, tally);
    warnFallbackMajority(pairKey, pairEntries.find(([k]) => k === pairKey)[1].method, tally);
  }

  const copiedNote = totalJSONCopied > 0
    ? ` (+${totalJSONCopied} copied verbatim, no-translate)`
    : '';
  const heldNote = totalJSONHeld > 0
    ? `; ${totalJSONHeld} held back (refused before; not sent, not billed)`
    : '';
  const failedNote = totalJSONFailed > 0 ? `; ${totalJSONFailed} failed (listed above)` : '';
  // A real run counts what it wrote; a dry run what it would send.
  const shownKeys = dryRun ? totalJSONKeys : totalJSONWritten;
  if (shownKeys > 0) {
    const action = dryRun ? 'Would process' : 'Synced';
    output.ok(`${action} ${shownKeys} JSON key(s)${copiedNote}${failedNote}${heldNote}`);
  } else if (totalJSONHeld > 0 || totalJSONFailed > 0) {
    output.warn(`No JSON key ${dryRun ? 'would be' : 'was'} translated${copiedNote}${failedNote}${heldNote}`);
  } else if (totalJSONCopied > 0) {
    output.ok(`All JSON files fully synced${copiedNote}`);
  } else {
    output.ok('All JSON files fully synced');
  }
  // What the next sync does with the UI strings this run could not translate
  // — said per outcome, in the key-value lane's words.
  if (!dryRun && (jsonFates.retry.length > 0 || jsonFates.held.length > 0)) {
    if (jsonFates.retry.length > 0) {
      output.warn(`  ${jsonFates.retry.length} UI string(s) got no usable answer (missing from the response, or the method failed) — the next sync asks for them again.`);
    }
    // Ids are named bare (a name re-queues that id in every JSON file that has it).
    const heldNext = [];
    const seen = new Set();
    for (const { pair, key } of jsonFates.held) {
      if (seen.has(`${pair}\u0000${key}`)) continue;
      seen.add(`${pair}\u0000${key}`);
      heldNext.push({ pair, key });
    }
    for (const line of describeHeldNext(heldNext, (keys, pair) => redoCommand(keys, { pair }))) output.warn(line);
  }

  // ── Phase 2: Markdown content (docs + blog) ───────────────────
  let contentFailures = 0; // read after the TM save, outside the content block
  let contentTranslated = 0;
  let contentFailedItems = [];
  // Blocks/fields refused before and held back this run, and refused this run.
  let contentHeldBack = 0;
  const contentHeldBackItems = [];
  let contentRefused = 0;
  // Parts this run left in the source language — said last, as an error.
  const leftInSource = [];

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
    // Refusals per translation (lib/content-refusals.js), applied to the lock
    // with each item's outcome.
    const refusalStates = new Map();
    // Every failed (file × locale), with what it was left as on disk — the
    // end-of-run list an operator needs to tell "failed, previous
    // translation kept" from "failed, will retry" (dogfood 2026-08-28,
    // finding 5).
    const failedItems = [];
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
          relPath, dirName, pairKey, pairConfig, code,
          targetPath, manifestKey, action,
        } = item;

        let itemFailed = false;
        // This translation's refusals, recorded with its outcome (held,
        // failed or written) — in the incremental lock writes too.
        const settleRefusals = () => {
          const st = refusalStates.get(manifestKey);
          if (!st || dryRun) return;
          storeRefusals(updatedDocuManifest, manifestKey, nextRefusals(st.prior, st));
          manifestDirty = true;
        };
        try {
          if (action === 'changed') {
            totalContentRetranslated++;
          }

          if (dryRun) {
            // What the quality gate refused before is held back by the real
            // run (lib/content-refusals.js) — said here.
            const preview = previewHeld({
              tm, code, pairConfig, fields: parsed.hasFrontMatter ? fieldsToTranslate : {}, body: parsed.body,
              segMode: pairConfig.contentSegmentation || config.contentSegmentation || 'block', holds: item.holds,
            });
            const held = preview.names.length > 0
              ? ` — ${preview.pageHeld ? 'would hold the page back:' : 'would hold back'} ${preview.names.join(', ')} (refused before; not sent)`
              : '';
            output.raw(`    [DRY] ${dirName}/${relPath} → ${code}${held}`);
            output.event('file', {
              lane: 'docusaurus', file: `${dirName}/${relPath}`, locale: code, status: preview.pageHeld ? 'would-hold' : 'would-translate', action,
              ...(preview.names.length > 0 && { held: preview.names.length }),
            });
            if (!preview.pageHeld) totalContent++;
            return;
          }

          const { rawFrontMatter, body, hasFrontMatter, frontMatterFormat } = parsed;
          const segModeHere = pairConfig.contentSegmentation || config.contentSegmentation || 'block';
          const label = `${dirName}/${relPath}`;
          const refusal = {
            file: label, locale: code, pageHeld: false,
            prior: item.refusalsBefore || {},
            refused: [], filled: new Set(), held: [],
            fields: hasFrontMatter ? fieldsToTranslate : {},
            blockSources: segModeHere === 'block' && body.trim() ? translatableBlockSources(body) : [],
            pageSource: segModeHere === 'page' && body.trim() ? body : null,
          };
          refusalStates.set(manifestKey, refusal);
          const { holds } = item;
          // A page translated whole that the gate refused before (and that
          // the cache does not hold): held before anything of it is sent —
          // its front matter included (a pure look; the body read below is
          // the one that serves).
          if (refusal.pageSource && holds.page(body) === 'held'
              && ![tmMethodKey(pairConfig), ...(pairConfig.fallback ? [tmMethodKey(pairConfig.fallback)] : [])]
                .some(k => peekTM(tm, body, code, k) !== null)) {
            const err = new Error('held');
            err.heldNames = [PAGE_NAME];
            throw err;
          }

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

          // This page's cached content through the repeat check, in one batch
          // and before any of it is served (lib/fallback.js): a text cached
          // for several different source strings is evicted, so the lookups
          // below miss it and it is translated again, checked the same way.
          const docLabel = `content:${dirName}/${relPath}`;
          const repeated = refuseRepeatedCachedPage({
            label: docLabel,
            fields: hasFrontMatter ? fieldsToTranslate : {},
            body,
            tm, code, pairConfig,
            sharedOutputs: sharedOutputsFor(code),
          });
          if (repeated.length > 0) {
            output.warn(
              `${dirName}/${relPath} → ${code}: cached ${repeated.join(', ')} held the same text as other, different source strings ` +
              '(a memorized sentence, not a translation) — removed from the cache and translated again.'
            );
          }

          // Translate front matter fields — TM first, API only for misses.
          // Each field is cached on its own source text (exactly like a
          // key-value sync key): a title edit re-pays only the title.
          const translatedFields = {};
          // A field left in the source language (refused, or held from an
          // earlier refusal): the page is written, its lock marked pending.
          let fieldsLeftInSource = false;
          if (hasFrontMatter && Object.keys(fieldsToTranslate).length > 0) {
            const { hits: fmHits, misses: fmMisses } = partitionByTM(
              tm, fieldsToTranslate, Object.keys(fieldsToTranslate), code, tmKey
            );
            // Validate cached hits BEFORE serving — an entry stored by a
            // gateless pipeline (hollowed titles were cached here) must not
            // outlive the gate. Failing hits are evicted and re-billed.
            for (const [field, cachedValue] of Object.entries(fmHits)) {
              if (contentGateFault(fieldsToTranslate[field], cachedValue, pairConfig)) {
                evictTM(tm, fieldsToTranslate[field], code, tmKey);
                delete fmHits[field];
                fmMisses.push(field);
              }
            }
            Object.assign(translatedFields, fmHits);
            // Then the fallback's cache (lib/fallback.js ladder).
            const fbCache = serveFieldsFromFallbackCache(tm, fieldsToTranslate, fmMisses, code, pairConfig);
            Object.assign(translatedFields, fbCache.hits);
            if (Object.keys(fbCache.hits).length > 0) notePage(pairKey, label);
            const fieldsToSend = fbCache.misses;
            for (const f of Object.keys(translatedFields)) refusal.filled.add(fieldUnit(f));
            // Refused before: a held field is not sent again; it keeps its
            // source text and the page is written (its lock marked pending).
            const heldFields = fieldsToSend.filter(f => holds.field(f, fieldsToTranslate[f]) === 'held');
            const fallbackOnlyFields = new Set(fieldsToSend.filter(f => holds.field(f, fieldsToTranslate[f]) === 'fallback-only'));
            if (heldFields.length > 0) {
              fieldsLeftInSource = true;
              const names = heldFields.map(f => `front matter "${f}"`);
              refusal.held.push(...names);
              output.warn(describeHeld({ file: label, code, pairKey, pairConfig, names }));
              for (const f of heldFields) fieldsToSend.splice(fieldsToSend.indexOf(f), 1);
            }

            if (fieldsToSend.length > 0) {
              await requirePairReady(pairKey, pairConfig, code, 'content sync');
              // The pair's method, then its fallback (if any) for every field
              // it returned nothing for or hollowed. Content-preservation
              // gate on every value — Phase 2 front matter once reached disk
              // AND the TM with no validation at all, so a hollowed page
              // title was written silently and then cached forever. Nothing
              // is cached until no field is left failing; a failing field
              // skips the file and leaves its lock entry alone, so the next
              // sync retries it.
              const fm = await translateFieldsWithFallback({
                fields: fieldsToTranslate,
                misses: fieldsToSend,
                pairConfig,
                budget: fallbackBudget,
                sharedOutputs: sharedOutputsFor(code),
                label: `${docLabel} front matter`,
                translate: (keys, cfg, extra = {}) => translateBatch(
                  keys, fieldsToTranslate, cfg,
                  { apiKey, model: cfg.model, batchSize: cfg.batchSize || 30, ...extra },
                ),
                fallbackOnly: fallbackOnlyFields,
              });
              tallyContent(pairKey, fm.report, label);
              // Refused fields are remembered, whatever happens to the page.
              for (const [field, methods] of Object.entries(fm.refusedBy || {})) {
                refusal.refused.push({ unit: fieldUnit(field), source: fieldsToTranslate[field], methods });
              }
              if (fm.hollowed.length > 0) {
                // Refused, and refused again when asked with the reason: the
                // field keeps its source text; the page is still written.
                fieldsLeftInSource = true;
                for (const h of fm.hollowed) {
                  leftInSource.push({ file: label, locale: code, pair: pairKey, where: `front matter "${h.field}"`, reason: h.reason });
                  logRefusal(cwd, {
                    pair: pairKey, method: tmMethodKey(pairConfig), file: label, locale: code,
                    field: h.field, reason: h.reason, source: fieldsToTranslate[h.field], answer: h.value ?? null,
                  });
                  output.warn(
                    `${label} → ${code}: front matter "${h.field}" kept in the source language — ${h.reason}`
                    + `${h.fallbackReason ? `; the fallback (${pairConfig.fallback.method}): ${h.fallbackReason}` : ''}.`
                  );
                }
                output.warn(describeNewHold({ file: label, pairKey, pairConfig, count: fm.hollowed.length }));
              }
              if (fm.noResults) {
                // Front matter translation failed — loud error
                throw new Error(
                  `Docusaurus content sync for ${code}: front matter translation returned no results`
                  + `${pairConfig.fallback ? ` (from the primary, ${pairConfig.method}, or its fallback, ${pairConfig.fallback.method})` : ''}.\n` +
                  '  Check your API key and method configuration.'
                );
              }
              // Cache only gate-passing values, each under the TM key of the
              // method that produced it.
              for (const st of fm.stores) storeTM(tm, st.text, code, st.tmKey, st.value);
              // A field only the fallback may be asked for that it did not
              // translate (skipped by --max-cost, or no answer): still refused
              // by the pair's method — the page is held, as with no fallback.
              const unfilled = [...fallbackOnlyFields].filter(f => !(f in fm.translated));
              if (unfilled.length > 0) {
                fieldsLeftInSource = true;
                const names = unfilled.map(f => `front matter "${f}"`);
                refusal.held.push(...names);
                output.warn(describeHeld({ file: label, code, pairKey, pairConfig, names }));
              }
              Object.assign(translatedFields, fm.translated);
              for (const f of Object.keys(fm.translated)) refusal.filled.add(fieldUnit(f));
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
            // The pair's cache, then its fallback's (lib/fallback.js ladder).
            const wholeBodyCached = lookupContentTM(tm, body, code, pairConfig);
            if (wholeBodyCached !== null) {
              translatedBody = wholeBodyCached.text;
              for (const src of refusal.blockSources) refusal.filled.add(blockUnit(src));
              if (refusal.pageSource) refusal.filled.add(PAGE_UNIT);
            } else {
              const segMode = pairConfig.contentSegmentation || config.contentSegmentation || 'block';
              const { protectedBody, blocks } = protectBlocks(body);
              const promptOptions = {
                sourceLanguageName: DEFAULT_REGISTERS[inputLocale]?.name || inputLocale,
                promptContext: pairConfig.promptContext || null,
                protectedTerms: pairConfig.protectedTerms || [],
              };

              // Block stores are deferred until the reassembled body passes
              // the orphaned-placeholder check — the TM must never hold a
              // value that would fail the gate on re-serve. Each carries the
              // TM key of the method that produced it.
              const pendingBlockStores = [];
              // The whole body is cached under one method's key — only when
              // one method produced all of it.
              let wholeBodyKey = tmKey;
              let mixedProducers = false;
              // Page mode: whose whole page the checks below refuse (the
              // lane remembers it — lib/content-refusals.js "page").
              let pageRefusedBy = null;

              if (segMode === 'page') {
                // Whole-page prompt — today's single-call behavior. Refused
                // before by this method (and the cache does not hold it): not
                // sent again (lib/content-refusals.js).
                const pageHold = holds.page(body);
                if (pageHold === 'held') {
                  const err = new Error('held');
                  err.heldNames = [PAGE_NAME];
                  throw err;
                }
                await requirePairReady(pairKey, pairConfig, code, 'body translation');
                const runPage = (cfg) => translateRawContent(
                  buildContentPrompt(protectedBody, cfg, promptOptions), { apiKey, pairConfig: cfg });
                let bodyResult;
                if (pairConfig.fallback) {
                  // When both fail, the primary's page goes to the checks
                  // below, which fail the file exactly as without a fallback.
                  // Refused before by the pair's method: only the fallback is asked.
                  const page = await translatePageWithFallback({
                    body, blocks, pairConfig, runPage, budget: fallbackBudget, fallbackOnly: pageHold === 'fallback-only',
                  });
                  tallyContent(pairKey, page.report, label);
                  if (page.refusedBy.length > 0) {
                    refusal.refused.push({ unit: PAGE_UNIT, source: body, methods: page.refusedBy });
                  }
                  if (pageHold === 'fallback-only' && page.body === null) {
                    // The fallback did not translate it: the pair's method
                    // refused it before, so it is not asked — refused now
                    // by the fallback too, or held (no answer, or skipped
                    // by --max-cost).
                    if (page.refusedBy.length > 0) {
                      const err = new Error(
                        `Docusaurus body for ${code}: the fallback (${pairConfig.fallback.method}) failed the whole-page checks too.\n` +
                        `  Nothing was written or cached. ${describeNewHold({ file: label, pairKey, pairConfig, count: 1 })}`
                      );
                      err.heldNext = true;
                      throw err;
                    }
                    const err = new Error('held');
                    err.heldNames = [PAGE_NAME];
                    throw err;
                  }
                  bodyResult = page.body ?? page.primaryBody;
                  if (page.body !== null) wholeBodyKey = page.tmKey;
                  else if (page.refusedBy.length > 0) pageRefusedBy = page.refusedBy;
                } else {
                  const raw = await runPage(pairConfig);
                  bodyResult = raw ? restoreBlocks(raw, blocks) : null;
                  if (bodyResult) pageRefusedBy = [tmKey];
                }
                if (!bodyResult) {
                  throw new Error(
                    `Docusaurus body for ${code}: translation returned no results`
                    + `${pairConfig.fallback ? ` (from the primary, ${pairConfig.method}, or its fallback, ${pairConfig.fallback.method})` : ''}.\n` +
                    '  Check your API key and method configuration.'
                  );
                }
                translatedBody = bodyResult;
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
                const heldBlocks = []; // refused before: not sent, the source text kept
                let position = 0; // place among the translatable blocks
                for (const r of rendered) {
                  if (r.seg.type !== 'translatable') {
                    // Separators + passthrough blocks: copied verbatim, never billed.
                    r.out = r.source;
                    continue;
                  }
                  // Its name in the repeat check (content:<file>#<n>).
                  r.pos = position++;
                  const cached = lookupContentTM(tm, r.source, code, pairConfig);
                  if (cached !== null) {
                    r.out = cached.text;
                    if (cached.fromFallback) { mixedProducers = true; notePage(pairKey, label); }
                    refusal.filled.add(blockUnit(r.source));
                    continue;
                  }
                  const hold = holds.block(r.source);
                  if (hold === 'held') {
                    // Refused before by this method (and its fallback): the
                    // source text stays, nothing is sent or billed.
                    r.out = r.source;
                    heldBlocks.push(r);
                    continue;
                  }
                  r.fallbackOnly = hold === 'fallback-only';
                  missed.push(r);
                }
                if (heldBlocks.length > 0) {
                  bodyUsedFallback = true;
                  const names = heldBlocks.map(r => `paragraph ${r.pos + 1}`);
                  refusal.held.push(...names);
                  output.warn(describeHeld({ file: label, code, pairKey, pairConfig, names }));
                }

                if (missed.length > 0) {
                  await requirePairReady(pairKey, pairConfig, code, 'body translation');
                  // Self-repair ladder (translateBlockBatchResilient): full
                  // batch → one missing-segments-only retry → (with a
                  // fallback method: one batch through it for every block the
                  // primary dropped or damaged — lib/fallback.js) → honest
                  // the source text, unmarked, for anything still missing. A
                  // duplicate/unknown marker or an empty first response
                  // still fails the file whole when no fallback rescues it.
                  const outcome = await translateBlocksWithFallback({
                    missed,
                    blocks,
                    pairConfig,
                    budget: fallbackBudget,
                    sharedOutputs: sharedOutputsFor(code),
                    label: docLabel,
                    runBatch: (texts, cfg) => translateBlockBatchResilient({
                      texts,
                      buildPrompt: (t) => buildBlockBatchPrompt(t, cfg, { ...promptOptions, pageTitle }),
                      callModel: (prompt) => translateRawContent(prompt, { apiKey, pairConfig: cfg }),
                    }),
                    fallbackOnly: new Set(missed.flatMap((r, i) => (r.fallbackOnly ? [i] : []))),
                  });
                  tallyContent(pairKey, outcome.report, label);
                  // Refused blocks are remembered; translated ones drop a record.
                  const fellSet = new Set(outcome.fellBack);
                  const newlyHeld = [];
                  missed.forEach((r, i) => {
                    if (!fellSet.has(i)) { refusal.filled.add(blockUnit(r.source)); return; }
                    const methods = outcome.refusedBy?.[i] || [];
                    if (methods.length > 0) {
                      refusal.refused.push({ unit: blockUnit(r.source), source: r.source, methods });
                      newlyHeld.push(i);
                    }
                  });
                  if (outcome.fromFallback > 0) mixedProducers = true;
                  if ((outcome.sharedOutput || []).length > 0) {
                    output.warn(
                      `Docusaurus body for ${code}: ${outcome.sharedOutput.length} block(s) of ${dirName}/${relPath} came back as the same text ` +
                      'the model gave for other, different source strings (a memorized sentence, not a translation) — refused.'
                    );
                  }
                  for (const r of outcome.refused || []) {
                    leftInSource.push({ file: `${dirName}/${relPath}`, locale: code, pair: pairKey, where: `paragraph ${r.block}`, reason: r.reason });
                    logRefusal(cwd, {
                      pair: pairKey, method: tmMethodKey(pairConfig), file: `${dirName}/${relPath}`, locale: code,
                      paragraph: r.block, reason: r.reason, source: missed[r.i].source, answer: r.answer,
                    });
                  }
                  if ((outcome.refused || []).length > 0) {
                    output.warn(
                      `Docusaurus body for ${code}: ${outcome.refused.length} block(s) of ${dirName}/${relPath} refused by the quality gate, also when asked again with the reason — `
                      + outcome.refused.slice(0, 3).map(r => `paragraph ${r.block}: ${r.reason}`).join('; ')
                      + `${outcome.refused.length > 3 ? '; …' : ''}.`
                    );
                  }
                  const { fellBack } = outcome;
                  if (fellBack.length > 0) {
                    bodyUsedFallback = true;
                    const refusedHere = (outcome.sharedOutput || []).length + (outcome.refused || []).length;
                    const why = outcome.report?.attempted > 0
                      ? `neither the primary (${pairConfig.method}) nor its fallback (${pairConfig.fallback.method}) translated safely`
                      : refusedHere >= fellBack.length ? 'refused (above)'
                        : refusedHere > 0 ? `refused (${refusedHere}, above) or missing from the model response after a retry`
                          : 'missing from the model response after a retry';
                    output.warn(
                      `Docusaurus body for ${code}: ${fellBack.length} of ${missed.length} ` +
                      `block(s) ${why} — left in the source language, unmarked (\`champollion status\` lists them). ` +
                      describeFallenBack({
                        file: label, pairKey, pairConfig, fellBack: fellBack.length, newlyHeld, refusedBy: outcome.refusedBy,
                      })
                    );
                  }
                  // Fallen-back segments are never TM-cached — an error
                  // cached is an error forever (they re-bill next sync).
                  missed.forEach((r, i) => { r.out = outcome.outs[i]; });
                  pendingBlockStores.push(...outcome.stores);
                }

                // Reassemble in order with the source's exact separators.
                translatedBody = rendered.map(r => r.out).join('');
              }

              // A page translated whole that fails the checks below is
              // remembered as refused: the next plain sync does not send it
              // to the same method again (lib/content-refusals.js "page").
              const refusePage = (err) => {
                if (!pageRefusedBy) return err;
                if (!refusal.refused.some(r => r.unit === PAGE_UNIT)) {
                  refusal.refused.push({ unit: PAGE_UNIT, source: body, methods: pageRefusedBy });
                }
                err.message += `\n  ${describeNewHold({ file: label, pairKey, pairConfig, count: 1 })}`;
                err.heldNext = true;
                return err;
              };

              // Orphaned-placeholder check on the REASSEMBLED body — the
              // same gate for both modes.
              if (hasOrphanedPlaceholders(translatedBody)) {
                throw refusePage(new Error(
                  `Docusaurus body for ${code}: placeholder corruption detected.\n` +
                  '  Code blocks were corrupted during translation.'
                ));
              }

              // Content-preservation check on the REASSEMBLED body — same
              // lane, same reasoning as the front matter above. Skipped for a
              // fallback body: it deliberately carries untranslated
              // source text and is neither cached nor lock-advanced already.
              const bodyHollowed = !bodyUsedFallback && checkContentPreservation(body, translatedBody);
              if (bodyHollowed) {
                throw refusePage(new Error(
                  `Docusaurus body for ${code}: ${bodyHollowed.reason}.\n` +
                  '  Nothing was written or cached. If this is a low-coverage target\n' +
                  '  language, the model has no vocabulary for this text.'
                ));
              }
              if (refusal.pageSource) refusal.filled.add(PAGE_UNIT);

              // Store per-block AND whole-body entries only after the check
              // passes (whole-body makes reverts/lock-loss re-runs free). A
              // fallback body is NEVER stored whole — it contains
              // untranslated source text.
              for (const s of pendingBlockStores) {
                storeTM(tm, s.source, code, s.tmKey, s.translation);
              }
              if (!bodyUsedFallback && !mixedProducers) {
                storeTM(tm, body, code, wholeBodyKey, translatedBody);
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
          updatedDocuManifest[manifestKey] = !bodyUsedFallback && !fieldsLeftInSource
            ? sourceHash : pendingLockValue(sourceHash);
          manifestDirty = true;

        } catch (contentErr) {
          if (contentErr.heldNames) {
            // A front-matter field refused before: held back, not failed —
            // nothing was sent, nothing written, the lock not advanced.
            const refusal = refusalStates.get(manifestKey);
            refusal.held.push(...contentErr.heldNames);
            refusal.pageHeld = true;
            settleRefusals();
            output.warn(describeHeld({
              file: `${dirName}/${relPath}`, code, pairKey, pairConfig, names: contentErr.heldNames, pageHeld: true,
            }));
            completed++;
            output.raw(`    [${completed}/${totalWork}] ${dirName}/${relPath} → ${code} [HELD]`);
            output.event('file', { lane: 'docusaurus', file: `${dirName}/${relPath}`, locale: code, status: 'held-refused', held: contentErr.heldNames.length, action });
            if (completed % MANIFEST_WRITE_INTERVAL === 0) writeManifestIfDirty();
            return;
          }
          itemFailed = true;
          contentFailures++;
          output.error(`${dirName}/${relPath} → ${code} — ${contentErr.message}`);
          // Nothing was written for this item, and its lock entry was not
          // advanced. If the lock already matches this source, the file on
          // disk is the PREVIOUS translation of the same text (a forced
          // re-translate that failed): it stays, and a plain sync will not
          // redo it. Otherwise the next sync retries it.
          const keptPrevious = updatedDocuManifest[manifestKey] === sourceHash && fs.existsSync(targetPath);
          failedItems.push({
            file: `${dirName}/${relPath}`,
            locale: code,
            error: contentErr.message,
            // held-back: refused by the quality gate — the next plain sync
            // does not send it again (lib/content-refusals.js).
            state: keptPrevious ? 'previous-translation-kept' : contentErr.heldNext ? 'held-back' : 'will-retry',
          });
        }

        settleRefusals();

        // Progress reporting
        completed++;
        const pct = Math.round(100 * completed / totalWork);
        const elapsedMs = Date.now() - syncStartTime;
        const msPerItem = elapsedMs / completed;
        const remainingMs = msPerItem * (totalWork - completed);
        const remainingSec = Math.ceil(remainingMs / 1000);
        const etaStr = remainingSec > 5 ? ` (~${remainingSec}s left)` : '';
        // The tag describes THIS item. (It used to read the run-wide failure
        // count, so whichever item finished last was tagged FAIL.)
        const displayTag = itemFailed
          ? 'FAIL'
          : action === 're-translate' ? 'RE-TRANSLATE' : action === 'changed' ? 'CHANGED' : 'OK';
        output.raw(`    [${completed}/${totalWork}] (${pct}%) ${dirName}/${relPath} → ${code} [${displayTag}]${etaStr}`);
        output.event('file', {
          lane: 'docusaurus', file: `${dirName}/${relPath}`, locale: code,
          status: itemFailed ? 'failed' : dryRun ? 'would-translate' : 'translated', action,
        });

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
      const unfinished = leftInSource.length > 0 ? ` — ${leftInSource.length} part(s) left in the source language (below)` : '';
      (unfinished ? output.warn : output.ok).call(output, `${action} ${totalContent} content file(s)${retranslateNote}, ${totalContentSkipped} unchanged${unfinished}`);
    }

    contentTranslated = totalContent;
    contentFailedItems = failedItems;
    for (const st of refusalStates.values()) {
      if (st.held.length > 0) {
        contentHeldBack += st.held.length;
        contentHeldBackItems.push({ file: st.file, locale: st.locale, units: st.held, ...(st.pageHeld && { pageNotWritten: true }) });
      }
      contentRefused += new Set(st.refused.map(r => r.unit)).size;
    }
    if (contentHeldBack > 0) {
      output.warn(
        `${contentHeldBack} content block(s)/field(s) held back in ${contentHeldBackItems.length} translation(s) — the quality gate refused `
        + 'the method\'s translation of their current text before; not sent, not billed (listed above). Ask again for all of them: '
        + '`champollion sync --redo content`; for one page: `champollion sync --redo files:<page>`.'
      );
    }
    for (const [pairKey, tally] of contentFallbackTallies) {
      printFallbackReport(pairKey, pairEntries.find(([k]) => k === pairKey)[1].method, tally, { unit: 'content segment(s)', producedLabel: 'pages' });
      warnFallbackMajority(pairKey, pairEntries.find(([k]) => k === pairKey)[1].method, tally, { unit: 'content segment(s)' });
    }
    if (failedItems.length > 0) {
      output.raw('');
      output.raw(`  Failed content translations (${failedItems.length}):`);
      for (const f of failedItems.sort((a, b) => (a.file + a.locale).localeCompare(b.file + b.locale))) {
        const state = f.state === 'previous-translation-kept'
          ? 'previous translation kept (it matches the current source); re-run with --force-content to try again'
          : f.state === 'held-back'
            ? `refused by the quality gate — held back: the next sync does not send it again (\`--redo files:${f.file}\` asks again)`
            : 'not recorded as done — the next sync retries it';
        output.raw(`    ${f.file} → ${f.locale}: ${state}`);
      }
    }
  }

  // Save TM if it was mutated during this Docusaurus sync (stores OR
  // evictions — a size check would miss eviction-only runs and same-key
  // replacements). Skip when --no-tm is active. Saved BEFORE any failure is
  // raised: the files that succeeded paid for their translations, and
  // throwing first discarded every one of them from the cache.
  if (!dryRun && !noTM && isTMDirty(tm)) {
    saveTM(cwd, tm);
    output.info(`[TM] Saved ${describeTMChanges(tm)} this sync`);
  }
  {
    // Last, so it is the run's closing word: what is still untranslated.
    reportLeftInSource(leftInSource);
  }

  // Failures are reported, not thrown: a partly failed run still did real
  // work, and the exit code says so (2 = partial, 1 = nothing succeeded).
  if (contentFailures > 0) {
    output.error(
      `${contentFailures} content translation(s) failed (listed above). ` +
      'Completed files and their translations are saved; re-run sync to retry.'
    );
  }

  // The --max-cost verdict, said once — at the end, before the summary
  // (lib/cost-report.js reportDryRunMaxCost).
  if (dryMaxCost) output[dryMaxCost.level](dryMaxCost.message);

  // One machine-readable record of the run — the Docusaurus path never had
  // one, so --json consumers saw nothing to tell success from failure.
  output.summary({
    command: 'sync',
    format: 'docusaurus',
    dryRun,
    totalProcessed: totalJSONKeys,
    totalFailed: totalJSONFailed,
    totalCopied: totalJSONCopied,
    // UI strings held back: the gate refused this method's translation of
    // their current text before — not sent, not billed (lib/locale-state.js).
    // A dry run sends nothing either way: said above, not counted (as on
    // the key-value path).
    totalHeld: dryRun ? 0 : totalJSONHeld,
    // What each pair's fallback method did for JSON keys (pairs with a
    // fallback, real runs); Markdown segments are under content.fallback.
    ...(keyFallbackTallies.size > 0 && {
      fallback: [...keyFallbackTallies].map(([pair, tally]) => ({ pair, ...fallbackSummary(tally) })),
    }),
    content: {
      translated: contentTranslated,
      skipped: contentScan.totalContentSkipped,
      failed: contentFailedItems.length,
      failedItems: contentFailedItems,
      // Refused before by the method, not sent this run (lib/content-refusals.js),
      // and refused this run (held back from the next).
      heldBack: contentHeldBack,
      heldBackItems: contentHeldBackItems,
      refused: contentRefused,
      ...(contentFallbackTallies.size > 0 && {
        fallback: [...contentFallbackTallies].map(([pair, tally]) => ({ pair, ...fallbackSummary(tally) })),
      }),
    },
    costEstimate,
    // Dry runs with --max-cost: whether the real run would stop at the cap.
    ...(dryMaxCost && { maxCost: {
      cap: dryMaxCost.cap, estimatedCost: dryMaxCost.estimatedCost, wouldStop: dryMaxCost.wouldStop,
      ...(dryMaxCost.wouldStop && { exitCode: 2, reason: dryMaxCost.reason }),
      ...(dryMaxCost.stopsEarlier && { exitCode: 1, stopsEarlier: dryMaxCost.stopsEarlier }),
    } }),
    // Keys named for a redo that match no UI string (the run exits 1), each
    // with the closest ids that exist.
    ...(unmatchedNamed.length > 0 && { unmatchedKeys: unmatchedKeysSummary(unmatchedNamed) }),
  });
  output.raw('');
  // Named keys that matched nothing: said again last, where a reader (or CI)
  // looks for the verdict — and the run fails (lib/commands/sync.js).
  reportUnmatchedKeys(unmatchedNamed, cliArgs);
  return {
    totalProcessed: totalJSONKeys,
    totalFailed: totalJSONFailed,
    totalCopied: totalJSONCopied,
    totalHeld: dryRun ? 0 : totalJSONHeld,
    contentTranslated,
    contentFailed: contentFailedItems.length,
    contentHeldBack,
    contentRefused,
    unmatchedKeys: unmatchedNamed.map(m => m.name),
  };
}

export { runDocusaurusSync, discoverDocusaurusJSONFiles };
