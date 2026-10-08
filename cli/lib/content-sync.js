/**
 * Content sync — translates the Markdown/MDX files of a contentDir (a Hugo
 * site's content/ or any folder of Markdown), each translation written beside
 * its source as <name>.<locale>.md (lib/content.js getTargetContentPath).
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
 *
 * EDITS MADE BY HAND (lib/content-review.js): every file this lane writes is
 * also recorded in the content lock ("written:<relPath>:<locale>"), block by
 * block. Before a changed source re-translates a file, the file on disk is
 * compared with that record: paragraphs and front-matter fields a person
 * changed are KEPT when the source text they translate is unchanged (never
 * sent to the API, never cached as machine output), and the run says so. An
 * edited paragraph whose own source changed is re-translated with its edited
 * wording printed; edits that cannot be matched paragraph by paragraph leave
 * the whole file as is until it is updated by hand or named for a redo.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { translateBatch, translateRawContent, getMethod } from './translate.js';
import { checkContentPreservation, contentGateFault } from './validate.js';
import { loadTM, saveTM, lookupTM, peekTM, storeTM, evictTM, isTMDirty, tmSize, tmMethodKey, partitionByTM, setModelCarryover, setTMReads, bypassTMFor, cacheKey, describeTMChanges, adoptLegacyCoachingKeys } from './tm.js';
import {
  writtenRecordKey, parseWrittenRecord, buildWrittenRecord, buildAdoptedRecord, buildBootstrapRecord,
  assessExistingTarget, matchEditedBlocks, matchEditedFields, describeEdits,
} from './content-review.js';
import { output } from './output.js';
import { missingKeyAdvice } from './missing-key.js';
import { billableContentChars, translatableBlockSources } from './content-estimate.js';
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
import {
  lookupContentTM, serveFieldsFromFallbackCache, translateFieldsWithFallback,
  translateBlocksWithFallback, translatePageWithFallback,
  newFallbackReport, addToTally, fallbackSummary, printFallbackReport, warnFallbackMajority,
  refuseRepeatedCachedPage,
} from './fallback.js';
import {
  readRefusals, contentHolds, nextRefusals, storeRefusals, blockUnit, fieldUnit, describeHeld, describeNewHold,
  describeFallenBack, previewHeld, PAGE_UNIT, PAGE_NAME, pendingLockValue, isPendingLock, logRefusal, reportLeftInSource,
} from './content-refusals.js';
import { contentRedoCommand } from './verify.js';

/**
 * Run content sync — translate the contentDir's Markdown/MDX files.
 *
 * @param {object} options
 * @param {string} options.contentDir - Path to the content directory (any folder of Markdown/MDX)
 * @param {string} options.sourceLocale - Source language code
 * @param {Map<string, object>} options.pairs - Resolved pair graph (pairKey → pairConfig)
 * @param {string[]|null} options.translatableFields - Front matter fields to translate
 * @param {string|null} options.apiKey - OpenRouter API key. Only required for
 *   OpenRouter-routed methods (llm, llm-coached). Direct-provider methods
 *   (gemini, openai, anthropic, deepl, …) resolve their own env keys inside
 *   their method classes — a missing OpenRouter key must NOT block them.
 * @param {boolean} options.dryRun - Whether to write files
 * @param {boolean} [options.freshOnModelChange] - --fresh-on-model-change: serve
 *   only exact-model TM hits (default reuses other models' translations)
 * @param {boolean} [options.noTM] - Bypass the Translation Memory (--no-tm):
 *   every segment goes to the API and nothing is cached.
 * @param {object|null} [options.fallbackBudget] - lib/fallback.js
 *   createFallbackBudget(): the --max-cost guard for pairs' fallback methods
 *   (null = no cap).
 */
async function runContentSync(options) {
  // Parts this run left in the source language — reported at the end, as an error.
  const leftInSource = [];
  const {
    contentDir,
    sourceLocale,
    pairs,
    translatableFields,
    apiKey,
    dryRun = false,
    noTM = false,
    freshOnModelChange = false,
    // --force-content: re-process up-to-date files (TM serves unchanged
    // text, so this rebuilds from cache rather than re-billing).
    forceContent = false,
    // --files / --retranslate (lib/file-scope.js); null = every file.
    fileScope = null,
    cwd = process.cwd(),
    concurrency = 48,
    // The honest-fallback marker (config.js default). Written in front of a
    // block's SOURCE text when the model drops its segment twice — visible,
    // never silent, never cached (see translateBlockBatchResilient).
    fallbackPrefix = '[EN] ',
    fallbackBudget = null,
    // (code) => the locale's different-inputs-same-output index, shared with
    // the key-value sync of the same run (lib/validate.js SharedOutputIndex).
    sharedOutputsFor = null,
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

  // --redo files:<glob> (= --files + --force-content) and --retranslate name
  // files: the one way a run replaces edits made by hand to a translation.
  // A bare --force-content / --redo content keeps them.
  const namedByFiles = Boolean(fileScope && fileScope.limitsFiles);

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
  // --fresh/--no-tm: serve nothing from the cache, but cache what is paid for
  // (lib/tm.js setTMReads) — same as the key-value path in sync.js.
  const tm = loadTM(cwd);
  if (noTM) setTMReads(tm, false);
  if (freshOnModelChange) setModelCarryover(tm, false); // see lib/tm.js "Model carry-over"
  // Blocks a pair cached before its coaching was keyed, with today's
  // coaching, stay served (lib/tm.js adoptLegacyCoachingKeys — sync records
  // it first; a dry run, which saves nothing, records it here too).
  adoptLegacyCoachingKeys(tm, pairs.values());
  const tmInitialSize = tmSize(tm);
  if (noTM) {
    output.info('Content sync: Translation Memory not read this run — content is translated fresh, and cached');
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

  // Per-pair tally of what each pair's fallback method did (lib/fallback.js)
  // — one [FALLBACK] line per pair at the end, and the --json summary.
  const fallbackTallies = new Map();
  for (const [pairKey, pairConfig] of pairEntries) {
    if (pairConfig.fallback) fallbackTallies.set(pairKey, newFallbackReport(pairConfig.fallback));
  }
  const tallyFallback = (pairKey, report, page = null) => {
    const tally = fallbackTallies.get(pairKey);
    if (!tally) return;
    addToTally(tally, report);
    if (page && report && (report.accepted > 0 || report.cached > 0)) notePage(pairKey, page);
  };
  // A page some of whose text the fallback produced (its answer or its
  // cache): named in the [FALLBACK] line.
  const notePage = (pairKey, page) => {
    const tally = fallbackTallies.get(pairKey);
    if (tally && !tally.produced.includes(page)) tally.produced.push(page);
  };

  output.info(`Content sync: ${sourceFiles.length} source file(s) × ${pairEntries.length} language(s), concurrency: ${concurrency}`);
  if (dryRun) output.info('Dry-run mode — no content files will be written.');

  let translated = 0;
  let retranslated = 0;
  let skipped = 0;

  const syncStartTime = Date.now();
  const failedItems = []; // { file, locale, error } — listed at the end
  // Files left as is because edits made by hand could not be merged with a
  // source change — { file, target, locale, reason }; listed at the end.
  const heldItems = [];
  let keptEditFiles = 0;
  let fatalError = null;
  // Blocks and front-matter fields the quality gate refused, per translation
  // (lib/content-refusals.js): what each run held back and what it learned.
  // Applied to the lock at the end, whatever each page's outcome.
  const refusalStates = new Map(); // manifestKey → { prior, refused, filled, held, … }
  let heldBackSeen = 0; // blocks/fields held back (a dry run: would be)

  // A written-record that does not parse must not silently turn into "no
  // edits": say so, then fall back to the pre-record behaviour for that file.
  const readRecord = (recordKey, label) => {
    try {
      return parseWrittenRecord(contentManifest[recordKey]);
    } catch (err) {
      output.warn(
        `${CONTENT_LOCK_FILENAME}: the record of ${label} is unreadable (${err.message}) — ` +
        'edits made by hand to that translation cannot be recognised this run. It is rewritten the next time sync writes the file.'
      );
      return null;
    }
  };

  try {
    for (let fileIdx = 0; fileIdx < sourceFiles.length; fileIdx++) {
      const sourcePath = sourceFiles[fileIdx];
      const relPath = path.relative(contentDir, sourcePath);
      if (fileScope && !fileScope.includes(relPath)) continue;
      const retranslate = fileScope ? fileScope.retranslates(relPath) : false;
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

      // Read and parse the source once — shared across all locale translations
      // (parsing is stateless; nothing below mutates the parsed parts).
      const raw = fs.readFileSync(sourcePath, 'utf-8');
      const currentSourceHash = hashFileContent(sourcePath);
      const { frontMatter, rawFrontMatter, body, hasFrontMatter, frontMatterFormat } = parseContentFile(raw);
      // The translatable front-matter values — the per-field TM unit, and
      // what the written-record fingerprints.
      const sourceFields = {};
      if (hasFrontMatter) {
        for (const field of fieldsList) {
          if (frontMatter[field] && typeof frontMatter[field] === 'string') sourceFields[field] = frontMatter[field];
        }
      }

      // Parallelize across locales for this file
      const translateOne = async ([pairKey, pairConfig]) => {
        const code = pairConfig.target;
        const result = { translated: false, fallback: false, skipped: false, retranslated: false, held: false, keptEdits: false };

        const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);

        // Security: verify target path stays within content directory
        if (!isPathContained(targetPath, contentDir)) {
          output.error(`${code} — refusing to write outside content directory`);
          return result;
        }

        // Change detection for existing files
        const manifestKey = `${relPath}:${code}`;
        // What sync last left on disk for this translation — how edits a
        // person made to it are told apart from ours (lib/content-review.js).
        const recordKey = writtenRecordKey(manifestKey);
        const targetRel = path.relative(contentDir, targetPath);
        const segMode = pairConfig.contentSegmentation || 'block';
        const targetExists = fs.existsSync(targetPath);
        const storedHash = contentManifest[manifestKey];
        const sourceCurrent = Boolean(storedHash) && storedHash === currentSourceHash;
        let edits = null; // a person's paragraphs and fields to keep (state 'edited')

        if (!retranslate && targetExists && sourceCurrent && !forceContent) {
          // Up to date — not touched. A translation no record exists for
          // (written by an older version) is recorded now, so edits made to
          // it from here on are recognised when its source changes.
          if (contentManifest[recordKey] === undefined) {
            const tmKeys = [tmMethodKey(pairConfig), pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null].filter(Boolean);
            updatedManifest[recordKey] = buildBootstrapRecord({
              sourceBody: body,
              sourceFields,
              written: fs.readFileSync(targetPath, 'utf-8'),
              // Exact cached machine translations of a source text (read
              // directly: a comparison, not a served hit).
              machineFor: (text) => tmKeys
                .map(k => tm[cacheKey(text, code, k)])
                .filter(e => e && typeof e.t === 'string')
                .map(e => e.t),
            });
          }
          result.skipped = true;
          return result;
        }

        if (!retranslate && targetExists && !storedHash) {
          // No stored hash — check if this file was generated by a prior
          // champollion run (a legacy '[EN] ' fallback marker, written before
          // 2026-10-05 — such pages are now recorded as pending:<hash>) or is a genuine
          // hand-translated file that should be preserved.
          //
          // BUG FIX: Previously, this always skipped hashless files.
          // This meant [EN] fallback files were permanently cached and
          // never retried — the user had to manually delete them.
          const existingContent = fs.readFileSync(targetPath, 'utf-8');
          const isLegacyFallback = existingContent.includes('[EN] ');
          if (!isLegacyFallback) {
            updatedManifest[manifestKey] = currentSourceHash;
            // Recorded as a person's file: each paragraph is kept when the
            // source later changes elsewhere (before, the first source edit
            // replaced the whole hand translation).
            updatedManifest[recordKey] = buildAdoptedRecord({ sourceBody: body, sourceFields, written: existingContent });
            result.skipped = true;
            output.event('file', { lane: 'content', file: relPath, locale: code, status: 'kept-hand-translated' });
            return result;
          }
        }

        if (targetExists) {
          // Before rewriting a translation: what did a person change in it?
          const record = readRecord(recordKey, targetRel);
          if (record) {
            const targetRaw = fs.readFileSync(targetPath, 'utf-8');
            const verdict = assessExistingTarget({
              targetRaw,
              record,
              segMode,
              replaceEdits: retranslate || (forceContent && namedByFiles),
              sourceCurrent,
            });
            if (verdict.action === 'keep') {
              // --force-content on an up-to-date file whose edits cannot be
              // merged: nothing is out of date, so nothing is replaced.
              output.info(
                `${code} — kept ${targetRel} as is: it was edited by hand (${verdict.reason}). ` +
                `To replace it with machine translation: champollion sync --redo files:${relPath}`
              );
              output.event('file', { lane: 'content', file: relPath, locale: code, status: 'kept-edits' });
              result.skipped = true;
              return result;
            }
            if (verdict.action === 'accept') {
              // Held on an earlier run and edited since: the person brought
              // it up to date. It is current now — and theirs.
              updatedManifest[manifestKey] = currentSourceHash;
              updatedManifest[recordKey] = buildAdoptedRecord({ sourceBody: body, sourceFields, written: targetRaw });
              output.info(`${code} — ${dryRun ? 'would take' : 'took'} your updated ${targetRel} as up to date with ${relPath}`);
              output.event('file', { lane: 'content', file: relPath, locale: code, status: 'accepted-edits' });
              result.skipped = true;
              return result;
            }
            if (verdict.action === 'hold') {
              // Lock NOT advanced: this warning repeats every run until the
              // file is brought up to date by hand or named for a redo.
              updatedManifest[recordKey] = { ...contentManifest[recordKey], held: verdict.heldHash };
              output.warn(
                `${targetRel} was left as is: it was edited by hand (${verdict.reason}), so the changes to ` +
                `${relPath} cannot be merged into it paragraph by paragraph. Bring it up to date by hand ` +
                '(the next sync then takes it as current), or replace it with machine translation: ' +
                `champollion sync --redo files:${relPath}`
              );
              heldItems.push({ file: relPath, target: targetRel, locale: code, reason: verdict.reason });
              output.event('file', { lane: 'content', file: relPath, locale: code, status: 'held-edits' });
              result.held = true;
              return result;
            }
            if (verdict.replaced) {
              const r = verdict.replaced;
              const what = r.state === 'edited'
                ? describeEdits({ paragraphs: r.ownedBlocks, fields: Object.keys(r.fields).filter(f => r.fields[f].owned) })
                : 'the file';
              output.info(
                `${code} — ${dryRun ? 'would replace' : 'replacing'} the edits made by hand to ${what} of ${targetRel} ` +
                `(you named it with ${retranslate ? '--retranslate' : '--redo files: / --files'})`
              );
            }
            edits = verdict.edits;
          }
        }

        if (retranslate) {
          // --retranslate: the operator named this file — skip the lock and
          // the adoption rule, and make its text miss the TM (below).
          result.retranslated = targetExists;
          if (!dryRun) output.info(`${code} — re-translating (--retranslate)`);
        } else if (targetExists) {
          if (sourceCurrent) {
            output.info(`${code} — re-processing (--force-content; cached text is reused)`);
            result.retranslated = true;
          } else if (storedHash === pendingLockValue(currentSourceHash)) {
            output.info(`${code} — re-checking what was left in the source language last time (cached text is free)`);
            result.retranslated = true;
          } else if (storedHash) {
            output.info(`${code} — source updated, re-translating`);
            result.retranslated = true;
          } else {
            output.info(`${code} — replacing an older '[EN] ' fallback`);
          }
        }

        if (dryRun) {
          const keeping = edits
            ? ` (keeping the edits made by hand to ${describeEdits({ paragraphs: edits.ownedBlocks, fields: Object.keys(edits.fields).filter(f => edits.fields[f].owned) })})`
            : '';
          // What the quality gate refused before is held back by the real run
          // (lib/content-refusals.js) — said here, not "would create".
          const preview = previewHeld({
            tm, code, pairConfig, fields: sourceFields, body, segMode,
            holds: contentHolds(readRefusals(contentManifest, manifestKey), pairConfig, { redo: retranslate || forceContent || noTM }),
          });
          if (preview.pageHeld) {
            output.info(`Would hold back ${targetRel}: ${preview.names.join(', ')} refused before — nothing sent, not written. `
              + `Ask again: \`${contentRedoCommand(relPath, { pair: pairKey })}\``);
            output.event('file', { lane: 'content', file: relPath, locale: code, status: 'would-hold', held: preview.names.length });
            result.heldBack = preview.names.length;
            return result;
          }
          const holding = preview.names.length > 0
            ? ` (holding back ${preview.names.join(', ')}: refused before — not sent; \`${contentRedoCommand(relPath, { pair: pairKey })}\` asks again)`
            : '';
          output.info(`Would ${targetExists ? 'update' : 'create'}: ${targetRel}${keeping}${holding}`);
          output.event('file', { lane: 'content', file: relPath, locale: code, status: 'would-translate', ...(preview.names.length > 0 && { held: preview.names.length }) });
          result.translated = true;
          return result;
        }

        // Key gate — require only what the pair's resolved method actually
        // needs (see readinessCache above). Fail loud with the method's own
        // reason instead of blaming OPENROUTER_API_KEY unconditionally.
        const readiness = await checkPairReadiness(pairKey, pairConfig);
        if (!readiness.ready) {
          const err = new Error(
            `Content sync for ${code}: method "${pairConfig.method || 'llm'}" cannot run — no API key or unmet prerequisite.\n` +
            `  ${readiness.reason}\n` +
            missingKeyAdvice({ reasons: [readiness.reason], setupHelp: ['  Set the key it names in .env.local (or your environment) to translate content.'] }).join('\n')
          );
          err.fatal = true; // every file would fail the same way — stop now
          throw err;
        }

        // The source was parsed once per file above (frontMatter, body, …).
        if (retranslate) {
          // Fresh translation for every field, the body and each block of
          // this file — new results still replace the cached ones.
          const fields = hasFrontMatter
            ? fieldsList.map(f => frontMatter[f]).filter(v => typeof v === 'string')
            : [];
          bypassTMFor(tm, code, [...fields, body, ...translatableBlockSources(body)]);
        }

        // Refused before (lib/content-refusals.js): blocks and fields the gate
        // refused this pair's method for are not sent to it again — unless this
        // page is named for a redo (--redo files: / --redo content /
        // --retranslate / --fresh). Recorded below whatever the page's outcome.
        const refusal = {
          file: relPath, locale: code, pageHeld: false,
          prior: readRefusals(contentManifest, manifestKey),
          refused: [], filled: new Set(), held: [],
          fields: sourceFields,
          blockSources: segMode === 'block' && body.trim() ? translatableBlockSources(body) : [],
          pageSource: segMode === 'page' && body.trim() ? body : null,
        };
        refusalStates.set(manifestKey, refusal);
        const holds = contentHolds(refusal.prior, pairConfig, { redo: retranslate || forceContent || noTM });
        // A front-matter field held back fails its page, as a refused one does:
        // nothing of the page is sent, nothing written, the lock not advanced.
        const holdPage = (names) => {
          refusal.held.push(...names);
          refusal.pageHeld = true;
          output.warn(describeHeld({ file: relPath, code, pairKey, pairConfig, names, pageHeld: true, handWritten: true }));
          output.event('file', { lane: 'content', file: relPath, locale: code, status: 'held-refused', held: names.length });
          result.heldBack = names.length;
          return result;
        };
        // A page translated whole that the gate refused before (and that the
        // cache does not hold): held before anything of it is sent — its
        // front matter included (a pure look; the body read below serves).
        if (refusal.pageSource && holds.page(body) === 'held'
            && ![tmMethodKey(pairConfig), ...(pairConfig.fallback ? [tmMethodKey(pairConfig.fallback)] : [])]
              .some(k => peekTM(tm, body, code, k) !== null)) {
          return holdPage([PAGE_NAME]);
        }

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

        // This page's cached content through the repeat check, in one batch
        // and before any of it is served (lib/fallback.js): a text cached for
        // several different source strings is evicted, so the lookups below
        // miss it and it is translated again, checked the same way. What a
        // person's edits keep is not served from the cache, so not checked.
        {
          const keptFields = hasFrontMatter && edits && edits.ownedFields > 0
            ? matchEditedFields(edits.fields, sourceFields).keep : {};
          const keptParagraphs = edits && edits.blocks && edits.ownedBlocks > 0
            ? matchEditedBlocks(edits.blocks, body.trim() ? translatableBlockSources(body) : []).keep : new Map();
          const repeated = refuseRepeatedCachedPage({
            label: `content:${relPath}`,
            fields: hasFrontMatter ? Object.fromEntries(Object.entries(sourceFields).filter(([f]) => !(f in keptFields))) : {},
            body,
            skipBlocks: new Set(keptParagraphs.keys()),
            wholeBody: keptParagraphs.size === 0,
            tm, code, pairConfig,
            sharedOutputs: sharedOutputsFor ? sharedOutputsFor(code) : null,
          });
          if (repeated.length > 0) {
            output.warn(
              `${relPath} → ${code}: cached ${repeated.join(', ')} held the same text as other, different source strings ` +
              '(a memorized sentence, not a translation) — removed from the cache and translated again.'
            );
          }
        }

        // TM entries are keyed on the full method key (method|model|register|
        // coaching). A method/register/coaching change re-translates; a MODEL
        // change reuses the previous model's entries unless
        // --fresh-on-model-change (see "Model carry-over" in lib/tm.js).
        const tmKey = tmMethodKey(pairConfig);

        // Translate front matter fields — TM first, API for the misses.
        // Each field is cached on its own source text, exactly like a
        // key-value sync key: a title edit re-pays only the title.
        const translatedFields = {};
        // A field left in the source language (refused, or held from an earlier
        // refusal): the page is written, its lock marked pending.
        let fieldsLeftInSource = false;
        // Edits made by hand that this write keeps, and the ones whose
        // source text changed under them (re-translated; wording printed).
        const keptFieldNames = new Set();
        const keptBlocks = new Set(); // source block positions
        const supersededNotes = [];
        if (hasFrontMatter) {
          const fieldsToTranslate = { ...sourceFields };
          if (edits && edits.ownedFields > 0) {
            const { keep, superseded } = matchEditedFields(edits.fields, sourceFields);
            for (const [field, text] of Object.entries(keep)) {
              // A person's value for an unchanged source value: written as
              // is, never sent to the API, never cached as machine output.
              translatedFields[field] = text;
              keptFieldNames.add(field);
              delete fieldsToTranslate[field];
            }
            for (const s of superseded) {
              supersededNotes.push(
                `${targetRel}: front matter "${s.field}" had been edited by hand, but its source value has changed, ` +
                `so it was re-translated. The edited wording, to re-apply if it still fits: ${JSON.stringify(s.text)}`
              );
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
            if (contentGateFault(fieldsToTranslate[field], cachedValue, pairConfig)) {
              evictTM(tm, fieldsToTranslate[field], code, tmKey);
              delete fmHits[field];
              fmMisses.push(field);
            }
          }
          Object.assign(translatedFields, fmHits);
          tmSegmentHits += Object.keys(fmHits).length;
          // Then the fallback's cache: fields it translated on an earlier run
          // are reused, not re-sent to the primary (lib/fallback.js ladder).
          const fbCache = serveFieldsFromFallbackCache(tm, fieldsToTranslate, fmMisses, code, pairConfig);
          Object.assign(translatedFields, fbCache.hits);
          tmSegmentHits += Object.keys(fbCache.hits).length;
          if (Object.keys(fbCache.hits).length > 0) notePage(pairKey, relPath);
          const fieldsToSend = fbCache.misses;
          // Filled without a call: the cache, a person's value.
          for (const f of Object.keys(translatedFields)) refusal.filled.add(fieldUnit(f));
          // Refused before: held back (the page with it), or the fallback's only.
          const heldFields = fieldsToSend.filter(f => holds.field(f, fieldsToTranslate[f]) === 'held');
          if (heldFields.length > 0) {
            // Not sent again: the field keeps its source text and the page is
            // written (its lock marked pending).
            fieldsLeftInSource = true;
            const names = heldFields.map(f => `front matter "${f}"`);
            refusal.held.push(...names);
            output.warn(describeHeld({ file: relPath, code, pairKey, pairConfig, names, handWritten: true }));
            for (const f of heldFields) fieldsToSend.splice(fieldsToSend.indexOf(f), 1);
          }
          const fallbackOnlyFields = new Set(fieldsToSend.filter(f => holds.field(f, fieldsToTranslate[f]) === 'fallback-only'));

          if (fieldsToSend.length > 0) {
            output.progress(`    [SYNC] ${code} front matter (${pairConfig.method})...`);
            // The pair's method, then its fallback (if any) for every field
            // it returned nothing for or hollowed. Content-preservation gate
            // on every value: front matter (title, description, summary)
            // once went from the API straight to disk AND into the TM with no
            // validation — which is how a hollowed page title was written
            // silently and then cached. Nothing is cached until no field is
            // left failing; a failing field fails the file (nothing written,
            // manifest not advanced, retried).
            const fm = await translateFieldsWithFallback({
              fields: fieldsToTranslate,
              misses: fieldsToSend,
              pairConfig,
              budget: fallbackBudget,
              sharedOutputs: sharedOutputsFor ? sharedOutputsFor(code) : null,
              label: `content:${relPath} front matter`,
              translate: (keys, cfg, extra = {}) => translateBatch(
                keys, fieldsToTranslate, cfg,
                { apiKey, cwd, model: cfg.model, batchSize: cfg.batchSize || 30, ...extra },
              ),
              fallbackOnly: fallbackOnlyFields,
            });
            tallyFallback(pairKey, fm.report, relPath);
            // Refused fields are remembered (held back from the method that
            // refused them), whatever happens to the page below.
            for (const [field, methods] of Object.entries(fm.refusedBy || {})) {
              refusal.refused.push({ unit: fieldUnit(field), source: fieldsToTranslate[field], methods });
            }
            if (fm.hollowed.length > 0) {
              // Refused, and refused again when asked with the reason: the
              // field keeps its source text; the page is still written.
              fieldsLeftInSource = true;
              for (const h of fm.hollowed) {
                leftInSource.push({ file: relPath, locale: code, pair: pairKey, where: `front matter "${h.field}"`, reason: h.reason });
                logRefusal(cwd, {
                  pair: pairKey, method: tmMethodKey(pairConfig), file: relPath, locale: code,
                  field: h.field, reason: h.reason, source: fieldsToTranslate[h.field], answer: h.value ?? null,
                });
                const advice = h.sharedOutput
                  ? ` ${pairConfig.method} answers it only with a sentence it gave for other strings — `
                    + `${pairConfig.fallback ? 'and the fallback did not translate it either' : 'add a "fallback" method to the pair'}, or write it in ${targetRel} by hand (kept).`
                  : '';
                output.warn(
                  `${relPath} → ${code}: front matter "${h.field}" kept in the source language — ${h.reason}`
                  + `${h.fallbackReason ? `; the fallback (${pairConfig.fallback.method}): ${h.fallbackReason}` : ''}.${advice}`
                );
              }
              output.warn(describeNewHold({ file: relPath, pairKey, pairConfig, count: fm.hollowed.length }));
            }
            if (fm.noResults) {
              // Front matter translation failed — loud error, skip this file
              output.raw(' [ERR]');
              throw new Error(
                `Content sync for ${code}: front matter translation returned no results`
                + `${pairConfig.fallback ? ` (from the primary, ${pairConfig.method}, or its fallback, ${pairConfig.fallback.method})` : ''}.\n` +
                '  Check your API key and method configuration.'
              );
            }
            // Cache only gate-passing values, each under the TM key of the
            // method that produced it.
            for (const st of fm.stores) storeTM(tm, st.text, code, st.tmKey, st.value);
            // A field only the fallback may be asked for that it did not
            // translate (skipped by --max-cost, or no answer): still refused by
            // the pair's method, so the page is held, as with no fallback.
            const unfilled = [...fallbackOnlyFields].filter(f => !(f in fm.translated));
            if (unfilled.length > 0) {
              fieldsLeftInSource = true;
              const names = unfilled.map(f => `front matter "${f}"`);
              refusal.held.push(...names);
              output.warn(describeHeld({ file: relPath, code, pairKey, pairConfig, names, handWritten: true }));
            }
            Object.assign(translatedFields, fm.translated);
            for (const f of Object.keys(fm.translated)) refusal.filled.add(fieldUnit(f));
            output.raw(' [OK]');
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
        // Paragraphs a person edited whose source paragraph is unchanged:
        // kept word for word (block mode only — assessExistingTarget never
        // lets a 'page'-mode file with edited paragraphs get this far). The
        // rest are reported, even when the source body is now empty.
        let keepPlan = null;
        if (edits && edits.blocks && edits.ownedBlocks > 0) {
          keepPlan = matchEditedBlocks(edits.blocks, body.trim() ? translatableBlockSources(body) : []);
          for (const s of keepPlan.superseded) {
            supersededNotes.push(
              `${targetRel}: paragraph ${s.paragraph} had been edited by hand, but the source paragraph it ` +
              'translates has changed, so it was re-translated. The edited wording, to re-apply if it still fits:\n' +
              s.text.split('\n').map(line => `      ${line}`).join('\n')
            );
          }
        }
        if (body.trim()) {
          // Read-time validation: a whole-body entry cached by a gateless
          // pipeline must not be re-served once the gate exists (evicts on fail).
          // The pair's cache, then its fallback's (lib/fallback.js ladder).
          // Not when a person's paragraphs are kept: a whole-body hit would
          // put the machine wording back over them.
          const cachedBody = keepPlan && keepPlan.keep.size > 0
            ? null
            : lookupContentTM(tm, body, code, pairConfig);
          if (cachedBody !== null) {
            translatedBody = cachedBody.text;
            tmSegmentHits += 1;
            for (const src of refusal.blockSources) refusal.filled.add(blockUnit(src));
            if (refusal.pageSource) refusal.filled.add(PAGE_UNIT);
          } else {
            const { protectedBody, blocks } = protectBlocks(body);
            const promptOptions = {
              sourceLanguageName: DEFAULT_REGISTERS[sourceLocale]?.name || sourceLocale,
              promptContext: pairConfig.promptContext || null,
              protectedTerms: pairConfig.protectedTerms || [],
            };

            // Block stores are deferred until the reassembled body passes the
            // orphaned-placeholder check — the TM must never hold a value that
            // would fail the gate on re-serve. Each carries the TM key of the
            // method that produced it (the pair's, or its fallback's).
            const pendingBlockStores = [];
            let apiCalled = false;
            // The whole body is cached under ONE method's key, so only when
            // one method produced all of it (a body mixing the primary's and
            // the fallback's blocks is cached block by block only).
            let wholeBodyKey = tmKey;
            let mixedProducers = false;
            // Page mode: whose whole page the checks below refuse (the lane
            // remembers it — lib/content-refusals.js "page").
            let pageRefusedBy = null;

            if (segMode === 'page') {
              // Refused before by this method (and the cache does not hold
              // it): not sent again (lib/content-refusals.js).
              const pageHold = holds.page(body);
              if (pageHold === 'held') return holdPage([PAGE_NAME]);
              // Whole-page prompt — the pre-segmentation single-call behavior.
              output.progress(`    [SYNC] ${code} body (${pairConfig.method})...`);
              apiCalled = true;
              const runPage = (cfg) => translateRawContent(buildContentPrompt(protectedBody, cfg, promptOptions), {
                apiKey,
                cwd,
                pairConfig: cfg,
              });
              let bodyResult;
              if (pairConfig.fallback) {
                // The fallback translates the page when the primary returns
                // nothing, damages a placeholder or hollows it. When both
                // fail, the primary's page goes to the checks below, which
                // fail the file exactly as without a fallback.
                // Refused before by the pair's method: only the fallback is asked.
                const page = await translatePageWithFallback({
                  body, blocks, pairConfig, runPage, budget: fallbackBudget, fallbackOnly: pageHold === 'fallback-only',
                });
                tallyFallback(pairKey, page.report, relPath);
                if (page.refusedBy.length > 0) {
                  refusal.refused.push({ unit: PAGE_UNIT, source: body, methods: page.refusedBy });
                }
                if (pageHold === 'fallback-only' && page.body === null) {
                  // The fallback did not translate it: the pair's method
                  // refused it before, so it is not asked — refused now by
                  // the fallback too, or held (no answer, or skipped by
                  // --max-cost).
                  if (page.refusedBy.length === 0) return holdPage([PAGE_NAME]);
                  output.raw(' [ERR]');
                  const err = new Error(
                    `Content sync body for ${code}: the fallback (${pairConfig.fallback.method}) failed the whole-page checks too.\n` +
                    `  Nothing was written or cached. ${describeNewHold({ file: relPath, pairKey, pairConfig, count: 1 })}`
                  );
                  err.heldNext = true;
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
                // Body translation returned null — loud error
                output.raw(' [ERR]');
                throw new Error(
                  `Content sync body for ${code}: translation returned no results`
                  + `${pairConfig.fallback ? ` (from the primary, ${pairConfig.method}, or its fallback, ${pairConfig.fallback.method})` : ''}.\n` +
                  '  Check your API key and method configuration.'
                );
              }
              translatedBody = bodyResult;
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
              const heldBlocks = []; // refused before: not sent, the source text kept
              let position = 0; // index among translatable blocks (= translatableBlockSources order)
              for (const r of rendered) {
                if (r.seg.type !== 'translatable') {
                  // Separators + passthrough blocks: copied verbatim, never billed.
                  r.out = r.source;
                  continue;
                }
                const j = position++;
                // Its name in the repeat check (content:<file>#<n>, as verify names it).
                r.pos = j;
                if (keepPlan && keepPlan.keep.has(j)) {
                  // A person's paragraph: written as is, not billed, not cached.
                  r.out = keepPlan.keep.get(j);
                  keptBlocks.add(j);
                  refusal.filled.add(blockUnit(r.source));
                  continue;
                }
                const cached = lookupContentTM(tm, r.source, code, pairConfig);
                if (cached !== null) {
                  r.out = cached.text;
                  tmSegmentHits += 1;
                  if (cached.fromFallback) { mixedProducers = true; notePage(pairKey, relPath); }
                  refusal.filled.add(blockUnit(r.source));
                  continue;
                }
                const hold = holds.block(r.source);
                if (hold === 'held') {
                  // Refused before by this method (and its fallback): the
                  // honest last resort stays, nothing is sent or billed.
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
                result.heldBack = (result.heldBack || 0) + names.length;
                output.warn(describeHeld({ file: relPath, code, pairKey, pairConfig, names, handWritten: true }));
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
                // batch → one missing-segments-only retry → (with a fallback
                // method: one batch through it for every block the primary
                // dropped or damaged — lib/fallback.js) → the source text,
                // unmarked, for anything still missing. A
                // duplicate/unknown marker (untrustworthy mapping) or an
                // empty first response still fails the file whole when no
                // fallback rescues it.
                let batchOutcome;
                try {
                  batchOutcome = await translateBlocksWithFallback({
                    missed,
                    blocks,
                    pairConfig,
                    budget: fallbackBudget,
                    sharedOutputs: sharedOutputsFor ? sharedOutputsFor(code) : null,
                    label: `content:${relPath}`,
                    runBatch: (texts, cfg) => translateBlockBatchResilient({
                      texts,
                      buildPrompt: (t) => buildBlockBatchPrompt(t, cfg, { ...promptOptions, pageTitle }),
                      callModel: (prompt) => translateRawContent(prompt, {
                        apiKey,
                        cwd,
                        pairConfig: cfg,
                      }),
                    }),
                    fallbackOnly: new Set(missed.flatMap((r, i) => (r.fallbackOnly ? [i] : []))),
                  });
                } catch (batchErr) {
                  output.raw(' [ERR]');
                  throw batchErr;
                }
                tallyFallback(pairKey, batchOutcome.report, relPath);
                if (batchOutcome.fromFallback > 0) mixedProducers = true;
                const { fellBack } = batchOutcome;
                // Refused blocks are remembered; translated ones drop a record.
                const fellSet = new Set(fellBack);
                const newlyHeld = [];
                missed.forEach((r, i) => {
                  if (!fellSet.has(i)) { refusal.filled.add(blockUnit(r.source)); return; }
                  const methods = batchOutcome.refusedBy?.[i] || [];
                  if (methods.length > 0) {
                    refusal.refused.push({ unit: blockUnit(r.source), source: r.source, methods });
                    newlyHeld.push(i);
                  }
                });
                if ((batchOutcome.sharedOutput || []).length > 0) {
                  output.warn(
                    `Content sync body for ${code}: ${batchOutcome.sharedOutput.length} block(s) of ${relPath} came back as the same text ` +
                    'the model gave for other, different source strings (a memorized sentence, not a translation) — refused' +
                    (pairConfig.fallback
                      ? `; sent to the fallback (${pairConfig.fallback.method}).`
                      : `. ${pairConfig.method} can only answer them with that sentence: add a "fallback" method to the pair, ` +
                        'or write those paragraphs by hand (a hand-written paragraph is kept).')
                  );
                }
                // Blocks the quality gate refused — the key-value gate's checks
                // (length inflation, echo, truncation, script), per block.
                const refusedByGate = batchOutcome.refused || [];
                for (const r of refusedByGate) {
                  leftInSource.push({ file: relPath, locale: code, pair: pairKey, where: `paragraph ${r.block}`, reason: r.reason });
                  logRefusal(cwd, {
                    pair: pairKey, method: tmMethodKey(pairConfig), file: relPath, locale: code,
                    paragraph: r.block, reason: r.reason, source: missed[r.i].source, answer: r.answer,
                  });
                }
                if (refusedByGate.length > 0) {
                  output.warn(
                    `Content sync body for ${code}: ${refusedByGate.length} block(s) of ${relPath} refused by the quality gate, also when asked again with the reason — `
                    + refusedByGate.slice(0, 3).map(r => `paragraph ${r.block}: ${r.reason}`).join('; ')
                    + `${refusedByGate.length > 3 ? '; …' : ''}`
                    + (pairConfig.fallback
                      ? '.'
                      : `. Add a "fallback" method to the pair (it is asked for what ${pairConfig.method}'s answer is refused for), `
                        + 'or write those paragraphs by hand (a hand-written paragraph is kept).')
                  );
                }
                if (fellBack.length > 0) {
                  bodyUsedFallback = true;
                  output.raw(' [PARTIAL]');
                  // Refused as a memorized sentence (said just above) is not
                  // "missing from the response".
                  const refusedShared = (batchOutcome.sharedOutput || []).length + refusedByGate.length;
                  const why = batchOutcome.report?.attempted > 0
                    ? `neither the primary (${pairConfig.method}) nor its fallback (${pairConfig.fallback.method}) translated safely`
                    : refusedShared >= fellBack.length
                      ? 'refused (above)'
                      : refusedShared > 0
                        ? `refused (${refusedShared}, above) or missing from the model response after a retry`
                        : 'missing from the model response after a retry';
                  output.warn(
                    `Content sync body for ${code}: ${fellBack.length} of ${missed.length} ` +
                    `block(s) ${why} — left in the source language, unmarked (\`champollion status\` lists them). ` +
                    describeFallenBack({
                      file: relPath, pairKey, pairConfig, fellBack: fellBack.length, newlyHeld, refusedBy: batchOutcome.refusedBy,
                    })
                  );
                }
                // Fallen-back segments are never TM-cached — an error cached
                // is an error forever (they re-bill on the next sync).
                missed.forEach((r, i) => { r.out = batchOutcome.outs[i]; });
                pendingBlockStores.push(...batchOutcome.stores);
              }

              // Reassemble in order with the source's exact separators.
              translatedBody = rendered.map(r => r.out).join('');
            }

            // A page translated whole that fails the checks below is
            // remembered as refused: the next plain sync does not send it to
            // the same method again (lib/content-refusals.js "page").
            const refusePage = (err) => {
              if (!pageRefusedBy) return err;
              if (!refusal.refused.some(r => r.unit === PAGE_UNIT)) {
                refusal.refused.push({ unit: PAGE_UNIT, source: body, methods: pageRefusedBy });
              }
              err.message += `\n  ${describeNewHold({ file: relPath, pairKey, pairConfig, count: 1 })}`;
              err.heldNext = true;
              return err;
            };

            // Orphaned-placeholder check on the REASSEMBLED body — the same
            // gate for both modes.
            if (hasOrphanedPlaceholders(translatedBody)) {
              // Placeholder corruption — loud error, skip this file
              output.error('PLACEHOLDER CORRUPTION');
              throw refusePage(new Error(
                `Content sync body for ${code}: placeholder corruption detected.\n` +
                '  Code blocks were corrupted during translation. Retry or report this issue.'
              ));
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
              throw refusePage(new Error(
                `Content sync body for ${code}: ${bodyHollowed.reason}.\n` +
                '  Nothing was written or cached. If this is a low-coverage target language,\n' +
                '  the model has no vocabulary for this text — fix the prompt or the pair, not the gate.'
              ));
            }
            if (refusal.pageSource) refusal.filled.add(PAGE_UNIT);

            // Store per-block AND whole-body entries only AFTER the corruption
            // check — the whole-body entry makes reverts/duplicates free. A
            // fallback body is NEVER stored whole: it contains untranslated
            // '[EN] ' text, and an error cached is an error forever.
            for (const s of pendingBlockStores) {
              storeTM(tm, s.source, code, s.tmKey, s.translation);
            }
            // Never a whole-body entry holding a person's paragraphs: the TM
            // holds machine output only, under the method that produced it.
            if (!bodyUsedFallback && !mixedProducers && keptBlocks.size === 0) {
              storeTM(tm, body, code, wholeBodyKey, translatedBody);
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

        // Record what is now on disk, block by block, with the paragraphs
        // and fields that are a person's marked — so the next sync can tell
        // a later edit from this write, and keeps these ones again.
        updatedManifest[recordKey] = buildWrittenRecord({
          sourceBody: body, sourceFields, written: assembled,
          ownedBlocks: keptBlocks, ownedFields: keptFieldNames,
        });

        result.translated = true;
        const keptCount = keptBlocks.size + keptFieldNames.size;
        output.event('file', {
          lane: 'content', file: relPath, locale: code,
          status: bodyUsedFallback ? 'fallback' : 'translated',
          ...(keptCount > 0 && { keptEdits: keptCount }),
        });
        if (keptCount > 0) {
          result.keptEdits = true;
          output.info(
            `${code} — kept the edits made by hand to ${describeEdits({ paragraphs: keptBlocks.size, fields: [...keptFieldNames] })} ` +
            `of ${targetRel}. To re-translate them: champollion sync --redo files:${relPath}`
          );
        }
        for (const note of supersededNotes) output.warn(note);
        // A fallback body keeps its OLD manifest entry so the file re-fires
        // next sync — every good block is a TM hit, only the fallen-back
        // segment re-bills. Self-healing at bounded cost.
        // Something left in the source language: `pending:<hash>` — the page
        // is processed again next sync (cache-free; held units not re-sent)
        // and stays the tool's, not taken for a person's file.
        updatedManifest[manifestKey] = !bodyUsedFallback && !fieldsLeftInSource
          ? currentSourceHash : pendingLockValue(currentSourceHash);

        return result;
      };

      // One (file × locale) failing must not stop the others — or discard
      // their work: the run carries on, and the lock + TM are saved below for
      // everything that succeeded (dogfood 2026-08-28, finding 5). Only a
      // FATAL error (a method that cannot run at all) stops the run.
      const perPairResults = await pMap(pairEntries, async (entry) => {
        try {
          return await translateOne(entry);
        } catch (err) {
          if (err.fatal) throw err;
          const code = entry[1].target;
          output.error(`${relPath} → ${code} — ${err.message}`);
          // heldNext: refused by the quality gate — held back from now on,
          // not retried by the next plain sync (lib/content-refusals.js).
          failedItems.push({ file: relPath, locale: code, error: err.message, ...(err.heldNext && { heldNext: true }) });
        output.event('file', { lane: 'content', file: relPath, locale: code, status: 'failed', error: err.message });
          return { translated: false, fallback: false, skipped: false, retranslated: false };
        }
      }, { concurrency });

      // Aggregate per-pair results into totals
      for (const r of perPairResults) {
        if (r.translated) translated++;
        if (r.skipped) skipped++;
        if (r.retranslated) retranslated++;
        if (r.keptEdits) keptEditFiles++;
        if (r.heldBack) heldBackSeen += r.heldBack;
      }
    }
  } catch (err) {
    // A fatal error still lets the saves below run: files finished before
    // it paid for their translations, and their lock entries + TM entries
    // are what make the retry cheap.
    fatalError = err;
  }

  // What each translation's refusals are now (lib/content-refusals.js):
  // earlier ones that still apply, plus this run's — held back from the
  // method that refused them until a redo names the page, the source text
  // changes, or the model/method does.
  const heldBackItems = [];
  let heldBack = 0;
  let refusedNow = 0;
  for (const [manifestKey, st] of refusalStates) {
    storeRefusals(updatedManifest, manifestKey, nextRefusals(st.prior, st));
    if (st.held.length > 0) {
      heldBack += st.held.length;
      heldBackItems.push({ file: st.file, locale: st.locale, units: st.held, ...(st.pageHeld && { pageNotWritten: true }) });
    }
    refusedNow += new Set(st.refused.map(r => r.unit)).size;
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
  // Under --fresh/--no-tm too: what was paid for is cached.
  if (!dryRun && isTMDirty(tm)) {
    saveTM(cwd, tm);
    output.info(`[TM] Saved ${describeTMChanges(tm)} this sync`);
  }

  const totalCreated = translated;
  if (totalCreated > 0 || skipped > 0 || retranslated > 0 || heldItems.length > 0 || (dryRun && heldBackSeen > 0)) {
    const retranslateNote = retranslated > 0 ? ` (${retranslated} re-translated)` : '';
    const keptNote = keptEditFiles > 0 ? `, ${keptEditFiles} keeping edits made by hand` : '';
    const heldNote = heldItems.length > 0 ? `, ${heldItems.length} left as is (edited by hand — listed below)` : '';
    if (dryRun) {
      const heldBackNote = heldBackSeen > 0 ? `; ${heldBackSeen} block(s)/field(s) refused before would be held back (not sent)` : '';
      output.info(`Would have created ${totalCreated} content file(s)${retranslateNote}${keptNote}, ${skipped} unchanged${heldNote}${heldBackNote}.`);
    } else {
      const unfinished = leftInSource.length > 0 ? ` — ${leftInSource.length} part(s) left in the source language (below)` : '';
      (unfinished ? output.warn : output.ok).call(output, `Created ${totalCreated} content file(s)${retranslateNote}${keptNote}, ${skipped} unchanged${heldNote}${unfinished}.`);
    }
  }
  reportLeftInSource(leftInSource);
  if (heldBack > 0) {
    // Not sent, not billed — but not translated either (exit 2, as for a
    // held-back key). Each page was named above with its own repair.
    output.warn(
      `${heldBack} content block(s)/field(s) held back in ${heldBackItems.length} translation(s) — the quality gate refused the method's `
      + 'translation of their current text before; not sent, not billed (listed above). Ask again for all of them: '
      + '`champollion sync --redo content`; for one page: `champollion sync --redo files:<page>`.'
    );
  }
  if (heldItems.length > 0) {
    // Not a failure (nothing was lost, nothing billed) — but out of date
    // with its source, so it is listed on every run until resolved.
    output.raw('');
    output.raw(`  Translations left as is because they were edited by hand and their source changed (${heldItems.length}):`);
    for (const h of heldItems) output.raw(`    ${h.target}  (source: ${h.file})`);
    output.raw('  Update each by hand (the next sync takes it as current), or replace it: champollion sync --redo files:<source>');
  }

  if (!dryRun) {
    for (const [pairKey, tally] of fallbackTallies) {
      printFallbackReport(pairKey, pairs.get(pairKey).method, tally, { unit: 'content segment(s)', producedLabel: 'pages' });
      warnFallbackMajority(pairKey, pairs.get(pairKey).method, tally, { unit: 'content segment(s)' });
    }
  }

  if (fatalError) throw fatalError;
  if (failedItems.length > 0) {
    output.raw('');
    output.raw(`  Failed content translations (${failedItems.length}) — not recorded as done; the next sync retries them`
      + `${failedItems.some(f => f.heldNext) ? ', except what the quality gate refused (held back — `--redo files:<page>` asks again)' : ''}:`);
    for (const f of failedItems) output.raw(`    ${f.file} → ${f.locale}${f.heldNext ? ' (refused by the quality gate: held back)' : ''}`);
    output.error(
      `${failedItems.length} content translation(s) failed (listed above). ` +
      'Completed files and their translations are saved; re-run sync to retry.'
    );
  }

  // Returned, not thrown: a partly failed run still did real work, and the
  // caller folds this into the run summary and the exit code (2 = partial).
  return {
    translated,
    skipped,
    retranslated,
    failed: failedItems.length,
    failedItems: failedItems.map(({ heldNext, ...f }) => ({ ...f, state: heldNext ? 'held-back' : 'will-retry' })),
    // Blocks/fields the quality gate refused before, not sent this run (the
    // '[EN] ' text stays; a page with a held front-matter field is not
    // written), and blocks/fields it refused this run (held from the next).
    heldBack,
    heldBackItems,
    refused: refusedNow,
    // Translations written with a person's edits kept, and translations
    // left as is because their edits could not be merged with a source change.
    keptEdits: keptEditFiles,
    held: heldItems.length,
    heldItems,
    // What each pair's fallback method did (pairs with a fallback, real runs).
    ...(!dryRun && fallbackTallies.size > 0 && {
      fallback: [...fallbackTallies].map(([pair, tally]) => ({ pair, ...fallbackSummary(tally) })),
    }),
  };
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
  // Nothing to record and no lock yet (e.g. the method could not run at
  // all): don't leave an empty lock file in a folder the user never synced.
  if (Object.keys(manifest).length === 0 && !fs.existsSync(lockPath)) return;
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
 * @param {string} contentDir - Path to the content directory
 * @param {string} sourceLocale - Source language code
 * @param {Array<[string, object]>} pairEntries - Pair graph entries [pairKey, pairConfig]
 * @param {string} cwd - Project root (for the content lock file)
 * @param {object} [options]
 * @param {object} [options.tm] - Loaded TM. When given, each pending item also
 *   reports billedChars: only the front-matter fields and body blocks the TM
 *   does NOT hold — what the run will actually pay for (lib/content-estimate.js).
 * @param {string[]|null} [options.translatableFields] - Front-matter fields
 *   (null → DEFAULT_TRANSLATABLE_FIELDS, as runContentSync)
 * @param {boolean} [options.fresh] - --fresh: nothing refused before is held back
 * @returns {{ sourceFileCount: number, pendingTranslations: number, pendingSourceChars: number,
 *   byTarget: Object<string, { pendingTranslations: number, pendingSourceChars: number,
 *     billedChars: number|null }> }}
 *   pendingSourceChars sums the source file characters of every pending
 *   (file × pair) translation — the rough basis for token estimation.
 *   byTarget breaks the same counts down per target code so the cost table
 *   can price each pair with its own method.
 */
function countPendingContentTranslations(contentDir, sourceLocale, pairEntries, cwd, {
  tm = null, translatableFields = null, fileScope = null, forceContent = false, fresh = false,
} = {}) {
  const result = { sourceFileCount: 0, pendingTranslations: 0, pendingSourceChars: 0, byTarget: {} };
  if (!contentDir || !fs.existsSync(contentDir)) return result;

  const sourceFiles = discoverContentFiles(contentDir, sourceLocale);
  result.sourceFileCount = sourceFiles.length;
  if (sourceFiles.length === 0) return result;

  const contentManifest = readContentManifest(cwd);
  const fieldsList = translatableFields || DEFAULT_TRANSLATABLE_FIELDS;
  const parsedCache = new Map(); // sourcePath → { parsed, blocks } (locale-independent)

  for (const sourcePath of sourceFiles) {
    const relPath = path.relative(contentDir, sourcePath);
    if (fileScope && !fileScope.includes(relPath)) continue;
    const retranslate = fileScope ? fileScope.retranslates(relPath) : false;
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const currentSourceHash = crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');

    for (const [, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);
      if (!isPathContained(targetPath, contentDir)) continue;

      const manifestKey = `${relPath}:${code}`;
      const targetExists = fs.existsSync(targetPath);
      const storedHash = contentManifest[manifestKey];
      if (!retranslate && targetExists) {
        if (storedHash && storedHash === currentSourceHash && !forceContent) continue; // unchanged — skipped by sync
        if (!storedHash) {
          // Hashless target: sync preserves it unless it is a legacy [EN] fallback
          const existingContent = fs.readFileSync(targetPath, 'utf-8');
          if (!existingContent.includes('[EN] ')) continue;
        }
      }
      if (targetExists) {
        // The same decision runContentSync makes (lib/content-review.js): a
        // translation edited by hand that the sync would leave as is costs
        // nothing. An unreadable record counts as pending (sync proceeds).
        let record = null;
        try { record = parseWrittenRecord(contentManifest[writtenRecordKey(manifestKey)]); } catch { record = null; }
        if (record) {
          const verdict = assessExistingTarget({
            targetRaw: fs.readFileSync(targetPath, 'utf-8'),
            record,
            segMode: pairConfig.contentSegmentation || 'block',
            replaceEdits: retranslate || (forceContent && Boolean(fileScope && fileScope.limitsFiles)),
            sourceCurrent: Boolean(storedHash) && storedHash === currentSourceHash,
          });
          if (verdict.action !== 'proceed') continue;
        }
      }

      result.pendingTranslations += 1;
      result.pendingSourceChars += raw.length;
      if (!result.byTarget[code]) {
        result.byTarget[code] = { pendingTranslations: 0, pendingSourceChars: 0, billedChars: tm ? 0 : null };
      }
      result.byTarget[code].pendingTranslations += 1;
      result.byTarget[code].pendingSourceChars += raw.length;

      if (tm) {
        // The same TM ladder runContentSync runs: per field, whole body,
        // then per block — only misses are billed.
        if (!parsedCache.has(sourcePath)) parsedCache.set(sourcePath, { parsed: parseContentFile(raw), blocks: null });
        const cached = parsedCache.get(sourcePath);
        const fields = {};
        if (cached.parsed.hasFrontMatter) {
          for (const field of fieldsList) {
            const v = cached.parsed.frontMatter[field];
            if (v && typeof v === 'string') fields[field] = v;
          }
        }
        const { billedChars, totalChars } = billableContentChars({
          tm,
          code,
          tmKey: tmMethodKey(pairConfig),
          fallbackTmKey: pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null,
          fields,
          body: cached.parsed.body,
          segMode: pairConfig.contentSegmentation || 'block',
          blockSources: () => (cached.blocks ??= translatableBlockSources(cached.parsed.body)),
          // What the gate refused before is not sent to the method again
          // (lib/content-refusals.js) — the same holds the sync applies.
          holds: contentHolds(readRefusals(contentManifest, manifestKey), pairConfig, {
            redo: retranslate || forceContent || fresh,
          }),
        });
        // --retranslate bypasses the TM for this file: all of it is billed.
        result.byTarget[code].billedChars += retranslate ? totalChars : billedChars;
      }
    }
  }

  return result;
}

/**
 * The state of the content lane (contentDir) per target locale, for
 * `champollion status` — which had shown only the key-value lane, so a
 * newsletter folder and its files' state were invisible (Round 7, school
 * persona). Local file reads only; never fails (a diagnostic).
 *
 *   translated  — the target exists and was made from the current source
 *                 (the content lock's hash matches) and nothing left untranslated
 *   outOfDate   — the target was made from an older source text
 *   pending     — no target yet, or parts the quality gate refused left in
 *                 the source language (the lock says `pending:<hash>`, or a
 *                 legacy '[EN] ' marker from before 2026-10-05 is in the file)
 *   unrecorded  — a target the lock has no record of (made by hand or by
 *                 another tool): sync keeps it as it is
 *
 * @param {string} contentDir
 * @param {string} sourceLocale
 * @param {Array<[string, object]>} pairEntries
 * @param {string} cwd
 * @param {{ fallbackPrefix?: string }} [opts] - the legacy marker to look for
 * @returns {{ dir: string, files: number, locales: Object<string, { translated: number,
 *   outOfDate: string[], pending: string[], unrecorded: string[] }> }|null}
 */
function contentStatus(contentDir, sourceLocale, pairEntries, cwd, { fallbackPrefix = '[EN] ' } = {}) {
  if (!contentDir || !fs.existsSync(contentDir)) return null;
  let sourceFiles = [];
  try { sourceFiles = discoverContentFiles(contentDir, sourceLocale); } catch { return null; }
  const manifest = readContentManifest(cwd);
  const out = { dir: path.relative(cwd, contentDir) || '.', files: sourceFiles.length, locales: {} };
  for (const [, pairConfig] of pairEntries) {
    out.locales[pairConfig.target] ??= { translated: 0, outOfDate: [], pending: [], unrecorded: [] };
  }
  for (const sourcePath of sourceFiles) {
    const relPath = path.relative(contentDir, sourcePath).split(path.sep).join('/');
    let hash;
    try { hash = hashFileContent(sourcePath); } catch { continue; }
    for (const [, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const state = out.locales[code];
      const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);
      if (!fs.existsSync(targetPath)) { state.pending.push(relPath); continue; }
      let text = '';
      try { text = fs.readFileSync(targetPath, 'utf-8'); } catch { /* unreadable: by its record only */ }
      const stored = manifest[`${path.relative(contentDir, sourcePath)}:${code}`];
      if (isPendingLock(stored) || text.includes(fallbackPrefix)) state.pending.push(relPath);
      else if (!stored) state.unrecorded.push(relPath);
      else if (stored !== hash) state.outOfDate.push(relPath);
      else state.translated += 1;
    }
  }
  return out;
}

export { runContentSync, countPendingContentTranslations, readContentManifest, contentStatus, CONTENT_LOCK_FILENAME };
