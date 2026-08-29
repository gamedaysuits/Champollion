/**
 * Content sync — translates Hugo Markdown content files.
 *
 * WHY THIS EXISTS: This was extracted from sync.js to reduce the
 * god-module's line count and give content translation its own
 * testable, focused module.
 *
 * v3 PAIR GRAPH: This module now accepts the resolved pair Map
 * (from pairs.js + plugins.js) rather than the v2 `languages` object.
 * Each pair carries its method, model, register, and name — the same
 * pairConfig that the key-value sync path uses. This ensures method
 * dispatch is consistent across both key-value and content translation.
 *
 * Pipeline for each source file × target pair:
 *   1. Check if translated version already exists (skip if so)
 *   2. Parse front matter and body
 *   3. Protect code blocks, shortcodes, and HTML
 *   4. Translate front matter fields + body via pair's configured method
 *      (Translation Memory consulted first; body segmented into blocks
 *      by default — see below)
 *   5. Check for placeholder corruption (orphaned ⟦PROTECTED_N⟧ tokens)
 *   6. Reassemble and write the target file
 *
 * TRANSLATION MEMORY: The change-detection lockfile is per-FILE (SHA-256 of
 * the whole source file), so editing one front-matter field used to re-pay
 * the API for the entire document — front matter AND body. The TM makes the
 * unchanged parts free: front-matter fields are cached per field source text
 * (exactly like key-value sync keys) and the body is cached at TWO
 * granularities. A whole-body entry makes a reverted or duplicate body free;
 * beneath it, the body is split into top-level blocks (segment.js) and each
 * block is cached on its own restored source text — a one-paragraph edit
 * re-pays only that paragraph, with all missed blocks batched into ONE
 * translateRawContent call ('block' mode, the default;
 * contentSegmentation: 'page' keeps the single whole-body prompt). Only
 * results that pass the existing checks (non-null API result; structural
 * block-batch validation; body placeholder-corruption check on the
 * REASSEMBLED body) are stored, and --no-tm bypasses the cache entirely.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { translateBatch, translateRawContent, getMethod } from './translate.js';
import { checkContentPreservation } from './validate.js';
import { loadTM, saveTM, lookupTM, lookupTMValidated, storeTM, evictTM, isTMDirty, tmSize, tmMethodKey, partitionByTM } from './tm.js';
import { output } from './output.js';
import { DEFAULT_REGISTERS } from './registers.js';
import { isPathContained } from './security.js';
import { pMap } from './concurrent.js';
import {
  discoverContentFiles,
  getTargetContentPath,
  parseContentFile,
  protectBlocks,
  restoreBlocks,
  hasOrphanedPlaceholders,
  buildContentPrompt,
  reassembleContentFile,
  findUntranslatableNestedFields,
  DEFAULT_TRANSLATABLE_FIELDS,
} from './content.js';
import {
  splitBlocks, buildBlockBatchPrompt, parseBlockBatchResponse,
  translateBlockBatchResilient, assertSegmentationMode,
} from './segment.js';

/**
 * Run content sync — translate Hugo Markdown content files.
 *
 * @param {object} options
 * @param {string} options.contentDir - Path to Hugo content directory
 * @param {string} options.sourceLocale - Source language code
 * @param {Map<string, object>} options.pairs - Resolved pair graph (pairKey → pairConfig)
 * @param {string[]|null} options.translatableFields - Front matter fields to translate
 * @param {string|null} options.apiKey - OpenRouter API key. Only required for
 *   OpenRouter-routed methods (llm, llm-coached). Direct-provider methods
 *   (gemini, openai, anthropic, deepl, …) resolve their own env keys inside
 *   their method classes — a missing OpenRouter key must NOT block them.
 * @param {boolean} options.dryRun - Whether to write files
 * @param {boolean} [options.noTM] - Bypass the Translation Memory (--no-tm):
 *   every segment goes to the API and nothing is cached.
 */
async function runContentSync(options) {
  const {
    contentDir,
    sourceLocale,
    pairs,
    translatableFields,
    apiKey,
    dryRun = false,
    noTM = false,
    cwd = process.cwd(),
    concurrency = 48,
    // The honest-fallback marker (config.js default). Written in front of a
    // block's SOURCE text when the model drops its segment twice — visible,
    // never silent, never cached (see translateBlockBatchResilient).
    fallbackPrefix = '[EN] ',
  } = options;

  if (!fs.existsSync(contentDir)) {
    output.warn(`Content directory not found: ${contentDir}`);
    return;
  }

  const sourceFiles = discoverContentFiles(contentDir, sourceLocale);
  if (sourceFiles.length === 0) {
    output.info('No source content files found.');
    return;
  }

  const fieldsList = translatableFields || DEFAULT_TRANSLATABLE_FIELDS;

  // Warn at most once per source file about translatable-looking front matter
  // we can't reach (arrays / nested blocks). Never silently drop them. The
  // check + add are synchronous (no await between), so this is race-free.
  const warnedFrontMatter = new Set();

  // Load content hash manifest for change detection.
  // Maps "relPath:locale" → SHA-256 of source file at last sync time.
  // When the source changes, the hash won't match and the target is re-translated.
  const contentManifest = readContentManifest(cwd);
  const updatedManifest = { ...contentManifest };

  // Load Translation Memory — same store as key-value sync (.champollion/tm.json).
  // Front-matter fields and bodies whose source text hasn't changed are served
  // from cache instead of hitting the API. With --no-tm we use a throwaway
  // in-memory object (everything misses, nothing is persisted) — mirroring
  // the key-value path in sync.js.
  //
  // Safe under pMap concurrency: storeTM is a synchronous property assignment
  // and Node is single-threaded, so writes can't interleave between awaits.
  const tm = noTM ? { _meta: { version: 1 } } : loadTM(cwd);
  const tmInitialSize = tmSize(tm);
  if (noTM) {
    output.info('Content sync: Translation Memory disabled (--no-tm)');
  } else if (tmInitialSize > 0) {
    output.info(`Content sync: Translation Memory loaded (${tmInitialSize} cached entries)`);
  }
  let tmSegmentHits = 0; // front-matter fields + bodies served from cache

  // Per-pair readiness cache — GATE FIX for the prelaunch audit finding:
  // the old gate hard-required the OpenRouter `apiKey` for every pair
  // ("Set OPENROUTER_API_KEY in .env.local") and threw before ever trying
  // the configured provider, even when the pair's method is a direct
  // provider (gemini, openai, deepl, …) with its own valid env key.
  //
  // Instead, ask the pair's method what IT needs via checkReadiness():
  // only OpenRouter-routed methods (llm, llm-coached) require the
  // OpenRouter key; direct providers check their own env vars.
  //
  // Checked lazily (only when a pair actually has work to do) so keyless
  // skip/dry-run flows keep working, and cached per pair so a readiness
  // check that hits the network (apertium, libretranslate, external)
  // runs at most once per pair — not once per file × pair.
  const readinessCache = new Map();
  const checkPairReadiness = (pairKey, pairConfig) => {
    if (!readinessCache.has(pairKey)) {
      const method = getMethod(pairConfig.method || 'llm', pairConfig);
      readinessCache.set(pairKey, Promise.resolve(method.checkReadiness({ apiKey, cwd })));
    }
    return readinessCache.get(pairKey);
  };

  // Sort pair entries for deterministic output ordering
  const pairEntries = [...pairs.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Segmentation mode is resolved per pair by pairs.js (langConfig/pair
  // override → config fallback). Reject invalid values up front — before
  // any file is touched — rather than mid-sync.
  for (const [pairKey, pairConfig] of pairEntries) {
    assertSegmentationMode(pairConfig.contentSegmentation, `pair "${pairKey}"`);
  }

  output.info(`Content sync: ${sourceFiles.length} source file(s) × ${pairEntries.length} language(s), concurrency: ${concurrency}`);
  if (dryRun) output.info('Dry-run mode — no content files will be written.');

  let translated = 0;
  let retranslated = 0;
  let skipped = 0;

  const syncStartTime = Date.now();

  for (let fileIdx = 0; fileIdx < sourceFiles.length; fileIdx++) {
    const sourcePath = sourceFiles[fileIdx];
    const relPath = path.relative(contentDir, sourcePath);
    const fileNum = fileIdx + 1;
    const totalFiles = sourceFiles.length;

    // ETA calculation
    let etaStr = '';
    if (fileIdx > 0) {
      const elapsedMs = Date.now() - syncStartTime;
      const msPerFile = elapsedMs / fileIdx;
      const remainingMs = msPerFile * (totalFiles - fileIdx);
      const remainingMin = Math.ceil(remainingMs / 60000);
      etaStr = remainingMin > 1 ? `  (~${remainingMin} min remaining)` : '';
    }
    output.info(`[${fileNum}/${totalFiles}] ${relPath}${etaStr}`);

    // Read source file once — shared across all locale translations
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const currentSourceHash = hashFileContent(sourcePath);

    // Parallelize across locales for this file
    const perPairResults = await pMap(pairEntries, async ([pairKey, pairConfig]) => {
      const code = pairConfig.target;
      const result = { translated: false, fallback: false, skipped: false, retranslated: false };

      const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);

      // Security: verify target path stays within content directory
      if (!isPathContained(targetPath, contentDir)) {
        output.error(`${code} — refusing to write outside content directory`);
        return result;
      }

      // Change detection for existing files
      const manifestKey = `${relPath}:${code}`;

      if (fs.existsSync(targetPath)) {
        const storedHash = contentManifest[manifestKey];
        if (storedHash && storedHash === currentSourceHash) {
          result.skipped = true;
          return result;
        }
        if (storedHash && storedHash !== currentSourceHash) {
          output.info(`${code} — source updated, re-translating`);
          result.retranslated = true;
        } else if (!storedHash) {
          // No stored hash — check if this file was generated by a prior
          // champollion run (contains [EN] fallback markers) or is a genuine
          // hand-translated file that should be preserved.
          //
          // BUG FIX: Previously, this always skipped hashless files.
          // This meant [EN] fallback files were permanently cached and
          // never retried — the user had to manually delete them.
          const existingContent = fs.readFileSync(targetPath, 'utf-8');
          const isLegacyFallback = existingContent.includes('[EN] ');
          if (!isLegacyFallback) {
            updatedManifest[manifestKey] = currentSourceHash;
            result.skipped = true;
            return result;
          }
          output.info(`${code} — replacing [EN] fallback`);
        }
      }

      if (dryRun) {
        const targetRel = path.relative(contentDir, targetPath);
        output.info(`Would create: ${targetRel}`);
        result.translated = true;
        return result;
      }

      // Key gate — require only what the pair's resolved method actually
      // needs (see readinessCache above). Fail loud with the method's own
      // reason instead of blaming OPENROUTER_API_KEY unconditionally.
      const readiness = await checkPairReadiness(pairKey, pairConfig);
      if (!readiness.ready) {
        throw new Error(
          `Content sync for ${code}: method "${pairConfig.method || 'llm'}" cannot run — no API key or unmet prerequisite.\n` +
          `  ${readiness.reason}\n` +
          '  Set the key it names in .env.local (or your environment) to translate content.'
        );
      }

      // Parse source (shared raw content, parsing is stateless)
      const { frontMatter, rawFrontMatter, body, hasFrontMatter, frontMatterFormat } = parseContentFile(raw);

      // Never silently drop translatable-looking nested/array front matter
      // (e.g. `related:` lists) — surface it once per source file.
      if (hasFrontMatter && !warnedFrontMatter.has(sourcePath)) {
        warnedFrontMatter.add(sourcePath);
        const skipped = findUntranslatableNestedFields(rawFrontMatter);
        if (skipped.length > 0) {
          output.warn(
            `${relPath}: front matter field(s) [${skipped.join(', ')}] are arrays/nested — ` +
            `left untranslated. Flatten them to top-level strings to translate, or translate by hand.`
          );
        }
      }

      // TM entries are keyed on the full method key (method|model|register|
      // coaching) — switching any of those must re-translate, not re-serve.
      const tmKey = tmMethodKey(pairConfig);

      // Translate front matter fields — TM first, API for the misses.
      // Each field is cached on its own source text, exactly like a
      // key-value sync key: a title edit re-pays only the title.
      const translatedFields = {};
      if (hasFrontMatter) {
        const fieldsToTranslate = {};
        for (const field of fieldsList) {
          if (frontMatter[field] && typeof frontMatter[field] === 'string') {
            fieldsToTranslate[field] = frontMatter[field];
          }
        }

        const { hits: fmHits, misses: fmMisses } = partitionByTM(
          tm, fieldsToTranslate, Object.keys(fieldsToTranslate), code, tmKey
        );
        // Validate cached hits BEFORE serving. A cache is a time machine: an
        // entry stored before the content-preservation gate existed re-serves
        // exactly what that gate now rejects — hollowed titles sat here and
        // were re-served forever, because TM hits skipped every gate. A hit
        // that fails today's gate is evicted and re-billed as a miss.
        for (const [field, cachedValue] of Object.entries(fmHits)) {
          if (checkContentPreservation(fieldsToTranslate[field], cachedValue)) {
            evictTM(tm, fieldsToTranslate[field], code, tmKey);
            delete fmHits[field];
            fmMisses.push(field);
          }
        }
        Object.assign(translatedFields, fmHits);
        tmSegmentHits += Object.keys(fmHits).length;

        if (fmMisses.length > 0) {
          output.progress(`    [SYNC] ${code} front matter (${pairConfig.method})...`);
          const fmResult = await translateBatch(
            fmMisses,
            fieldsToTranslate,
            pairConfig,
            { apiKey, cwd, model: pairConfig.model, batchSize: pairConfig.batchSize || 30 },
          );
          if (fmResult) {
            // Content-preservation gate. Front matter (title, description,
            // summary) went from the API straight to disk AND into the TM
            // with no validation of any kind — which is how a hollowed
            // page title was written silently and then cached. Check before
            // either. Failing the file is consistent with the null-result
            // branch below: nothing written, manifest not advanced, retried.
            for (const [field, value] of Object.entries(fmResult)) {
              const sourceValue = fieldsToTranslate[field];
              if (typeof value !== 'string' || typeof sourceValue !== 'string') continue;
              const hollowed = checkContentPreservation(sourceValue, value);
              if (hollowed) {
                output.raw(' [ERR]');
                throw new Error(
                  `Content sync for ${code}: front matter "${field}" — ${hollowed.reason}.\n` +
                  `  source: ${JSON.stringify(sourceValue)}\n` +
                  `  got:    ${JSON.stringify(value)}\n` +
                  '  Nothing was written or cached. If this is a low-coverage target language,\n' +
                  '  the model has no vocabulary for this string — fix the prompt or the pair.'
                );
              }
            }
            Object.assign(translatedFields, fmResult);
            // Cache only what the API actually returned (the same non-null
            // check that gates writing it to the target file).
            for (const [field, value] of Object.entries(fmResult)) {
              if (typeof value === 'string' && typeof fieldsToTranslate[field] === 'string') {
                storeTM(tm, fieldsToTranslate[field], code, tmKey, value);
              }
            }
            output.raw(' [OK]');
          } else {
            // Front matter translation failed — loud error, skip this file
            output.raw(' [ERR]');
            throw new Error(
              `Content sync for ${code}: front matter translation returned no results.\n` +
              '  Check your API key and method configuration.'
            );
          }
        }
      }

      // Translate body — whole-body TM first (a reverted or duplicate body
      // is free), then block-level TM + ONE batched API call for the missed
      // blocks ('block' mode, the default), or the whole-page prompt
      // ('page' mode). A structural failure fails the file whole; a segment
      // the model drops TWICE degrades to the honest '[EN] ' fallback for
      // just that block (never cached, lock not advanced — re-fires next
      // sync as a TM-cheap retry). Mirrors docusaurus-sync.js.
      let translatedBody = body;
      let bodyUsedFallback = false;
      if (body.trim()) {
        // Read-time validation: a whole-body entry cached by a gateless
        // pipeline must not be re-served once the gate exists (evicts on fail).
        const cachedBody = lookupTMValidated(tm, body, code, tmKey,
          (src, cached) => !checkContentPreservation(src, cached));
        if (cachedBody !== null) {
          translatedBody = cachedBody;
          tmSegmentHits += 1;
        } else {
          const segMode = pairConfig.contentSegmentation || 'block';
          const { protectedBody, blocks } = protectBlocks(body);
          const promptOptions = {
            sourceLanguageName: DEFAULT_REGISTERS[sourceLocale]?.name || sourceLocale,
            promptContext: pairConfig.promptContext || null,
          };

          // Block stores are deferred until the reassembled body passes the
          // orphaned-placeholder check — the TM must never hold a value that
          // would fail the gate on re-serve.
          const pendingBlockStores = [];
          let apiCalled = false;

          if (segMode === 'page') {
            // Whole-page prompt — the pre-segmentation single-call behavior.
            output.progress(`    [SYNC] ${code} body (${pairConfig.method})...`);
            apiCalled = true;
            const prompt = buildContentPrompt(protectedBody, pairConfig, promptOptions);
            const bodyResult = await translateRawContent(prompt, {
              apiKey,
              cwd,
              pairConfig,
            });
            if (!bodyResult) {
              // Body translation returned null — loud error
              output.raw(' [ERR]');
              throw new Error(
                `Content sync body for ${code}: translation returned no results.\n` +
                '  Check your API key and method configuration.'
              );
            }
            translatedBody = restoreBlocks(bodyResult, blocks);
          } else {
            // Block mode: segment the PROTECTED body (placeholders are
            // single tokens, so they can never be split), serve blocks from
            // the TM, and batch the misses into one API call.
            const segments = splitBlocks(protectedBody);

            // TM keys use each block's RESTORED source text: placeholder
            // numbering is positional per file, so the protected text of an
            // identical paragraph differs across files/edits, while the
            // restored text is stable and self-contained. Cached values are
            // likewise restored — they must never carry another file's
            // placeholder ids.
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
                tmSegmentHits += 1;
              } else {
                missed.push(r);
              }
            }

            if (missed.length > 0) {
              output.progress(`    [SYNC] ${code} body (${missed.length} block(s), ${pairConfig.method})...`);
              apiCalled = true;
              // Terminology context for the block-batch prompt: the page's
              // title (front matter first, else the first H1 in the body).
              const pageTitle =
                (hasFrontMatter && typeof frontMatter.title === 'string' ? frontMatter.title : null)
                || (body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null);
              // Self-repair ladder (translateBlockBatchResilient): full
              // batch → one missing-segments-only retry → honest
              // '[EN] '-prefixed source for anything still missing. A
              // duplicate/unknown marker (untrustworthy mapping) or an
              // empty first response still fails the file whole.
              let batchOutcome;
              try {
                batchOutcome = await translateBlockBatchResilient({
                  texts: missed.map(r => r.seg.text),
                  buildPrompt: (texts) => buildBlockBatchPrompt(
                    texts, pairConfig, { ...promptOptions, pageTitle }),
                  callModel: (prompt) => translateRawContent(prompt, {
                    apiKey,
                    cwd,
                    pairConfig,
                  }),
                  fallbackPrefix,
                });
              } catch (batchErr) {
                output.raw(' [ERR]');
                throw batchErr;
              }
              const { blocks: translatedBlocks, fellBack } = batchOutcome;
              const fellBackSet = new Set(fellBack);
              if (fellBack.length > 0) {
                bodyUsedFallback = true;
                output.raw(' [FALLBACK]');
                output.warn(
                  `Content sync body for ${code}: ${fellBack.length} of ${missed.length} ` +
                  `block(s) missing from the model response after a retry — written as ` +
                  `'${fallbackPrefix}'-prefixed source. Not cached, lock not advanced: ` +
                  `the next sync retries just those block(s).`
                );
              }
              missed.forEach((r, i) => {
                r.out = restoreBlocks(translatedBlocks[i], blocks);
                // Fallen-back segments are never TM-cached — an error cached
                // is an error forever (they re-bill on the next sync).
                if (!fellBackSet.has(i)) {
                  pendingBlockStores.push({ source: r.source, translation: r.out });
                }
              });
            }

            // Reassemble in order with the source's exact separators.
            translatedBody = rendered.map(r => r.out).join('');
          }

          // Orphaned-placeholder check on the REASSEMBLED body — the same
          // gate for both modes.
          if (hasOrphanedPlaceholders(translatedBody)) {
            // Placeholder corruption — loud error, skip this file
            output.error('PLACEHOLDER CORRUPTION');
            throw new Error(
              `Content sync body for ${code}: placeholder corruption detected.\n` +
              '  Code blocks were corrupted during translation. Retry or report this issue.'
            );
          }

          // Content-preservation check on the REASSEMBLED body. This lane
          // never ran the quality gate at all — translateBatch/
          // translateRawContent output went straight to disk AND into the TM
          // — so a body hollowed of its letters was written silently and then
          // re-served from cache forever. Throwing here matches the
          // placeholder gate above: the file is skipped, its manifest entry is
          // not advanced, and nothing is cached, so the next sync retries.
          const bodyHollowed = !bodyUsedFallback && checkContentPreservation(body, translatedBody);
          if (bodyHollowed) {
            output.error('CONTENT LOSS');
            throw new Error(
              `Content sync body for ${code}: ${bodyHollowed.reason}.\n` +
              '  Nothing was written or cached. If this is a low-coverage target language,\n' +
              '  the model has no vocabulary for this text — fix the prompt or the pair, not the gate.'
            );
          }

          // Store per-block AND whole-body entries only AFTER the corruption
          // check — the whole-body entry makes reverts/duplicates free. A
          // fallback body is NEVER stored whole: it contains untranslated
          // '[EN] ' text, and an error cached is an error forever.
          for (const s of pendingBlockStores) {
            storeTM(tm, s.source, code, tmKey, s.translation);
          }
          if (!bodyUsedFallback) {
            storeTM(tm, body, code, tmKey, translatedBody);
          }
          if (apiCalled && !bodyUsedFallback) output.raw(' [OK]');
        }
      }

      // Reassemble and write
      const assembled = reassembleContentFile({
        rawFrontMatter, translatedFields, translatedBody,
        hasFrontMatter, frontMatterFormat,
      });
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, assembled, 'utf-8');

      result.translated = true;
      // A fallback body keeps its OLD manifest entry so the file re-fires
      // next sync — every good block is a TM hit, only the fallen-back
      // segment re-bills. Self-healing at bounded cost.
      if (!bodyUsedFallback) {
        updatedManifest[manifestKey] = currentSourceHash;
      }

      return result;
    }, { concurrency });

    // Aggregate per-pair results into totals
    for (const r of perPairResults) {
      if (r.translated) translated++;
      if (r.skipped) skipped++;
      if (r.retranslated) retranslated++;
    }
  }

  // Write updated content manifest (skip in dry-run)
  if (!dryRun) {
    writeContentManifest(cwd, updatedManifest);
  }

  if (tmSegmentHits > 0) {
    output.info(`[TM] ${tmSegmentHits} content segment(s) served from cache`);
  }

  // Persist TM if it was mutated during this content sync (same rationale as
  // the key-value path in sync.js: dirty tracking, not size comparison).
  // Skip when --no-tm is active — nothing was cached, nothing to save.
  if (!dryRun && !noTM && isTMDirty(tm)) {
    const tmFinalSize = tmSize(tm);
    const delta = tmFinalSize - tmInitialSize;
    saveTM(cwd, tm);
    output.info(`[TM] Saved ${tmFinalSize} entries (${delta >= 0 ? '+' + delta : delta} this sync)`);
  }

  const totalCreated = translated;
  if (totalCreated > 0 || skipped > 0 || retranslated > 0) {
    const retranslateNote = retranslated > 0 ? ` (${retranslated} re-translated)` : '';
    if (dryRun) {
      output.info(`Would have created ${totalCreated} content file(s)${retranslateNote}, ${skipped} unchanged.`);
    } else {
      output.ok(`Created ${totalCreated} content file(s)${retranslateNote}, ${skipped} unchanged.`);
    }
  }
}

// -----------------------------------------------------------------
// Content hash manifest — SHA-256 change detection for content files
//
// Mirrors the key-value hash manifest (.champollion.lock) but tracks
// source content files instead of key-value pairs. Stored separately
// to keep concerns clean and avoid conflicts.
// -----------------------------------------------------------------

const CONTENT_LOCK_FILENAME = '.champollion-content.lock';

/**
 * Read the content hash manifest from disk.
 * Maps "sourceRelPath:targetLocale" → SHA-256 hash of source content.
 * Returns empty object on first run.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Hash manifest
 */
function readContentManifest(cwd) {
  const lockPath = path.join(cwd, CONTENT_LOCK_FILENAME);
  if (!fs.existsSync(lockPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (err) {
    output.warn(`Failed to parse content lock file: ${err.message}`);
    return {};
  }
}

/**
 * Write the content hash manifest to disk.
 * Sorts keys for deterministic, diff-friendly output.
 *
 * @param {string} cwd - Project root directory
 * @param {object} manifest - Hash manifest
 */
function writeContentManifest(cwd, manifest) {
  const lockPath = path.join(cwd, CONTENT_LOCK_FILENAME);
  const sorted = {};
  for (const key of Object.keys(manifest).sort()) {
    sorted[key] = manifest[key];
  }
  fs.writeFileSync(lockPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

/**
 * Compute SHA-256 hash of a file's content.
 *
 * @param {string} filePath - Absolute path to file
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Count the (file × pair) content translations a sync would actually run.
 *
 * WHY: the pre-sync cost preview must include content files, but counting
 * EVERY source file would over-report on a no-op re-run (fully-synced files
 * are skipped by the hash manifest) — and with --max-cost that false
 * estimate would abort a run that costs nothing. This replicates the exact
 * skip logic of runContentSync's per-pair loop (target exists + manifest
 * hash match → skip; hashless non-[EN] target → skip) WITHOUT making any
 * API calls, so the preview counts only work that will be paid for.
 *
 * Local file I/O only — cheap relative to the API dollars it estimates.
 *
 * @param {string} contentDir - Path to Hugo content directory
 * @param {string} sourceLocale - Source language code
 * @param {Array<[string, object]>} pairEntries - Pair graph entries [pairKey, pairConfig]
 * @param {string} cwd - Project root (for the content lock file)
 * @returns {{ sourceFileCount: number, pendingTranslations: number, pendingSourceChars: number,
 *   byTarget: Object<string, { pendingTranslations: number, pendingSourceChars: number }> }}
 *   pendingSourceChars sums the source file characters of every pending
 *   (file × pair) translation — the rough basis for token estimation.
 *   byTarget breaks the same counts down per target code so the cost table
 *   can price each pair with its own method.
 */
function countPendingContentTranslations(contentDir, sourceLocale, pairEntries, cwd) {
  const result = { sourceFileCount: 0, pendingTranslations: 0, pendingSourceChars: 0, byTarget: {} };
  if (!contentDir || !fs.existsSync(contentDir)) return result;

  const sourceFiles = discoverContentFiles(contentDir, sourceLocale);
  result.sourceFileCount = sourceFiles.length;
  if (sourceFiles.length === 0) return result;

  const contentManifest = readContentManifest(cwd);

  for (const sourcePath of sourceFiles) {
    const relPath = path.relative(contentDir, sourcePath);
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const currentSourceHash = crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');

    for (const [, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);
      if (!isPathContained(targetPath, contentDir)) continue;

      const manifestKey = `${relPath}:${code}`;
      if (fs.existsSync(targetPath)) {
        const storedHash = contentManifest[manifestKey];
        if (storedHash && storedHash === currentSourceHash) continue; // unchanged — skipped by sync
        if (!storedHash) {
          // Hashless target: sync preserves it unless it is a legacy [EN] fallback
          const existingContent = fs.readFileSync(targetPath, 'utf-8');
          if (!existingContent.includes('[EN] ')) continue;
        }
      }

      result.pendingTranslations += 1;
      result.pendingSourceChars += raw.length;
      if (!result.byTarget[code]) {
        result.byTarget[code] = { pendingTranslations: 0, pendingSourceChars: 0 };
      }
      result.byTarget[code].pendingTranslations += 1;
      result.byTarget[code].pendingSourceChars += raw.length;
    }
  }

  return result;
}

export { runContentSync, countPendingContentTranslations, readContentManifest, CONTENT_LOCK_FILENAME };
