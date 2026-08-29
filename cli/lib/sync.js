/**
 * Main sync orchestrator — ties together config, diff, hash, translate, and file I/O.
 *
 * This is the core "do the thing" module. It:
 *   1. Prints version banner (e.g., "champollion v3.4.0")
 *   2. Reads the source locale file (JSON, TOML, or YAML)
 *   3. Logs detected format and framework (e.g., "Detected format: json (auto)", "Detected framework: Hugo")
 *   4. Loads the hash manifest to detect changed English content
 *   5. Iterates over all target pairs (v3 pair graph)
 *   6. Diffs each one against the source (missing + fallback + changed + forced)
 *   7. Delegates translation to lib/translate-pair.js (TM → API → quality gate)
 *      with an onProgress callback wired to output.progressBar()
 *   8. Applies post-translation steps (terminology, script conversion)
 *   9. Writes updated locale files
 *  10. Saves updated hash manifest
 *  11. Delegates Docusaurus sync to lib/docusaurus-sync.js
 *  12. Delegates content sync to lib/content-sync.js
 *
 * Modes:
 *   - sync:  one-shot, translate and write
 *   - dry:   report only, no writes
 *   - audit: list all [EN]-prefixed values still needing real translation
 *
 * Related modules:
 *   - lib/translate-pair.js  — shared TM→API→gate pipeline (used by both sync paths)
 *   - lib/docusaurus-sync.js — Docusaurus JSON + Markdown sync
 *   - lib/cost-report.js     — pre-sync cost estimation display
 *   - lib/content-sync.js    — Hugo/content Markdown sync
 *   - lib/watch.js           — file watcher for auto-sync
 *   - lib/output.js          — banner(), progressBar(), and all CLI output
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { flattenKeys, setNestedValue } from './flatten.js';
import { diffLocale, diffLabel } from './diff.js';
import { isUnsafeKey, getMethod } from './translate.js';
import { resolveConfig, autoDetectLanguages, DEFAULT_JSON_CONCURRENCY } from './config.js';
import { compileNoTranslate } from './no-translate.js';
import { buildHashManifest, detectChangedKeys, readManifest, writeManifest } from './hash.js';
import { detectFormatFromDir, getExtension, readLocaleFile, writeLocaleFile, detectYAMLStyle } from './format.js';
import { resolvePairs, filterPairGraph } from './pairs.js';
import { loadPlugins, resolvePluginForPair } from './plugins.js';
import { isPathContained } from './security.js';
import { loadApiKey } from './api-key.js';
import { runContentSync } from './content-sync.js';
import { auditProvenance } from './provenance.js';
import {
  convertScript, getConverterInfo, applyScriptFallback,
  converterKeyForLocale, formatScriptChoiceError,
} from './scripts.js';
import { getLanguageCard } from './registers.js';
import { loadTM, saveTM, tmSize, isTMDirty, lookupTM, tmMethodKey } from './tm.js';
import { verifyTerminology, logTermViolations } from './terminology.js';
import { output } from './output.js';
import { printCostEstimate, parseMaxCost, abortForMaxCost } from './cost-report.js';
import { runDocusaurusSync } from './docusaurus-sync.js';
import { translateAndValidate } from './translate-pair.js';
import { verifyLocales } from './verify.js';
import { pMap } from './concurrent.js';
import { resetTranslationError } from './methods/translation-error.js';


/**
 * Resolve the translation runtime — API key, method detection, pair graph.
 *
 * Shared by runSync and runDocusaurusSync to avoid drift in the
 * setup sequence (method detection, language resolution, plugin merging).
 *
 * @param {object} config - Resolved config (post-migration, post-defaults)
 * @param {string} cwd - Working directory
 * @param {object} cliArgs - CLI flags (method, fallback, etc.)
 * @returns {{ apiKey: string|null, resolvedPairs: Map, pairEntries: Array }}
 */
async function resolveRuntime(config, cwd, cliArgs = {}) {
  const apiKey = loadApiKey(config, cwd);

  // SAFETY: shallow copy so we don't mutate the caller's config object.
  // Currently harmless (config is fresh from resolveConfig per invocation),
  // but prevents subtle bugs if anyone adds code that reads config.defaultMethod
  // or config.resolvedLanguages after resolveRuntime returns.
  const runtimeConfig = { ...config };

  // Smart method detection: if no LLM API key is available but
  // Google Translate credentials are set, auto-switch the default method.
  // This lets developers get started with just a Google Cloud API key.
  if (!apiKey && !cliArgs.method && runtimeConfig.defaultMethod === 'llm') {
    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_API_KEY;
    if (googleKey) {
      runtimeConfig.defaultMethod = 'google-translate';
      output.info('No OPENROUTER_API_KEY found, but GOOGLE_TRANSLATE_API_KEY is set.');
      output.info('Auto-switching default method to google-translate.');
    }
  }

  // Resolve target languages — from config or auto-detect.
  let languages = runtimeConfig.resolvedLanguages;
  if (Object.keys(languages).length === 0) {
    languages = autoDetectLanguages(runtimeConfig);
    runtimeConfig.resolvedLanguages = languages;
  }

  // Build the pair graph — this is the v3 drivetrain.
  // Each pair carries its method, model, register, and plugin context.
  const pairs = resolvePairs(runtimeConfig);
  const plugins = loadPlugins(cwd);

  // Resolve plugin configs into each pair that references one.
  let resolvedPairs = new Map();
  for (const [pairKey, rawPairConfig] of pairs) {
    resolvedPairs.set(pairKey, resolvePluginForPair(plugins, rawPairConfig));
  }

  // ── --pair filter ──────────────────────────────────────────────────
  // `sync --pair en:fr` restricts THIS run to the named pair(s). The flag
  // used to be parsed by the CLI but never read here, so sync silently
  // translated every configured locale — a 5× spend for a user who asked
  // for one pair. An unknown or malformed value fails loud inside
  // filterPairGraph (same behavior class as an unknown flag), never a
  // silent no-op. Applied BEFORE preflight so readiness is only checked
  // for the pairs that will actually run.
  if (cliArgs.pair) {
    const configuredCount = resolvedPairs.size;
    resolvedPairs = filterPairGraph(cliArgs.pair, resolvedPairs);
    output.info(`Pair filter: ${[...resolvedPairs.keys()].join(', ')} (${resolvedPairs.size} of ${configuredCount} configured pair(s))`);
  }

  // Sort for deterministic output ordering
  const pairEntries = [...resolvedPairs.entries()].sort(([a], [b]) => a.localeCompare(b));

  // ── SCRIPT DECISION ────────────────────────────────────────────────
  // For every pair whose locale has a registered script converter, say what
  // will happen and why — once, up front, in dry runs too. Silence here is
  // what let unconditional PUA conversion ship unrenderable text: the user's
  // first sign was a blank page. Locales without a converter say nothing.
  //
  // A locale with more than one REAL orthography (crk: SRO/Syllabics,
  // sr: Latin/Cyrillic) refuses to translate until the config chooses —
  // that is a decision about a community's writing system, and it belongs
  // to the project, never to a default.
  const scriptChoiceErrors = [];
  for (const [pairKey, pairConfig] of pairEntries) {
    const res = pairConfig.scriptResolution;
    if (!res) continue;
    const registered = converterKeyForLocale(pairConfig.target, getLanguageCard(pairConfig.target));
    if (!registered) continue;
    const info = getConverterInfo(registered);

    if (res.source === 'choice-required') {
      scriptChoiceErrors.push(`  ✗ ${pairKey}: ${formatScriptChoiceError(pairConfig.target, res)}`);
    } else if (res.converterKey) {
      const fontNote = info.fontNote ? ` — ${info.fontNote}; run \`champollion fonts\`` : '';
      output.info(`[SCRIPT] ${pairKey} — converting ${info.from} → ${info.to} (script: ${res.script ?? res.converterKey}, from config)${fontNote}`);
    } else {
      const optIn = info.toScript ? `"script": "${info.toScript}"` : `"script": "${registered}"`;
      output.info(
        `[SCRIPT] ${pairKey} — writing ${info.from} (${res.source === 'config' ? 'from config' : 'default'}; no conversion). `
        + `Set ${optIn} to emit ${info.to}.`
      );
    }
  }
  if (scriptChoiceErrors.length > 0) {
    throw new Error([
      '',
      '  ┌─ ORTHOGRAPHY CHOICE REQUIRED ───────────────────────────────────┐',
      '  │ These locales have more than one real writing system.           │',
      '  │ Champollion will not choose one for a community.                │',
      '  └─────────────────────────────────────────────────────────────────┘',
      '',
      ...scriptChoiceErrors,
      '',
    ].join('\n'));
  }

  // ── PREFLIGHT READINESS CHECK ──────────────────────────────────────
  // Validate that every pair's translation method can actually execute
  // BEFORE entering the translation loop. Without this, a missing API
  // key was only discovered deep inside the loop — and for content sync,
  // it was never discovered at all (silently wrote English fallbacks).
  //
  // No gas, no ignition. If a method can't run, we fail here with
  // clear guidance instead of producing garbage 360 files later.
  // Skip preflight for dry-run (reporting only) and audit (listing fallbacks).
  // These are read-only operations that don't need an API key.
  const skipPreflight = cliArgs.dryRun || cliArgs.audit;
  if (!skipPreflight) {
    const failures = [];
    for (const [pairKey, pairConfig] of pairEntries) {
      const method = getMethod(pairConfig.method || 'llm', pairConfig);
      const readiness = await method.checkReadiness({ apiKey, cwd });
      if (!readiness.ready) {
        failures.push({ pairKey, pairConfig, reason: readiness.reason, method });
      }
    }

    if (failures.length > 0) {
      // Build a single, actionable error with all failures + setup help.
      // Use the first failure's method for setup help (they're likely all
      // the same method with the same missing key).
      const lines = [
        '',
        '  ┌─ PREFLIGHT FAILED ──────────────────────────────────────────────┐',
        '  │ Cannot start translation — method prerequisites not met.        │',
        '  └─────────────────────────────────────────────────────────────────┘',
        '',
      ];
      for (const { pairKey, pairConfig, reason } of failures) {
        lines.push(`  ✗ ${pairKey} (method: ${pairConfig.method || 'llm'}): ${reason}`);
      }
      lines.push('');

      // Append setup help from the first failing method (most actionable)
      const helpLines = failures[0].method.getSetupHelp();
      lines.push(...helpLines);

      throw new Error(lines.join('\n'));
    }
  }

  return { apiKey, resolvedPairs, pairEntries };
}

/**
 * Build the end-of-sync summary line, deciding success vs failure framing.
 *
 * Pure and total so it can be unit-tested directly. The key invariant: a sync
 * with ANY failed keys must NOT be reported as [OK] — a green marker on a
 * partially-failed run misleads CI and agents.
 *
 * @param {boolean} dryRun
 * @param {number} totalProcessed - Keys processed (or that WOULD be, in dry-run)
 * @param {number} totalFailed - Keys that failed translation / quality gate
 * @param {number} [totalCopied=0] - No-translate keys copied verbatim from the
 *   source. Reported separately because they cost nothing and cannot fail —
 *   folding them into totalProcessed would overstate the translation work done.
 * @returns {{ ok: boolean, message: string }} ok=false → caller logs as a warning
 */
function formatSyncSummary(dryRun, totalProcessed, totalFailed, totalCopied = 0) {
  const verb = dryRun ? 'Would have processed' : 'Synced';
  const copied = totalCopied > 0 ? ` (+${totalCopied} copied verbatim, no-translate)` : '';
  if (totalFailed > 0) {
    return { ok: false, message: `${verb} ${totalProcessed} key(s)${copied}; ${totalFailed} failed (see summary below).` };
  }
  return { ok: true, message: `${verb} ${totalProcessed} keys total${copied}.` };
}

/**
 * Run the main sync operation.
 *
 * @param {object} options - { dryRun, audit, cwd, cliArgs }
 */
async function runSync(options = {}) {
  const { dryRun = false, audit = false, cwd = process.cwd(), cliArgs = {} } = options;
  const config = resolveConfig(cliArgs, cwd);

  // --max-cost: parse eagerly so a malformed cap fails loud up front,
  // before anything (even read-only work) happens.
  const maxCost = parseMaxCost(cliArgs['max-cost']);

  // Clear any translation failure recorded by a prior in-process sync (watch
  // mode) so getSetupHelp() reflects THIS run's failure, not a stale one.
  resetTranslationError();

  // Early dispatch: Docusaurus projects get their own sync path.
  // This keeps the entire existing sync logic untouched. --max-cost is
  // enforced INSIDE runDocusaurusSync (it needs the resolved pair graph +
  // TM to estimate); an over-cap abort returns the same maxCostAborted
  // result shape, which commands/sync.js maps to exit code 2.
  if (config.format === 'docusaurus') {
    return runDocusaurusSync(options, config, cwd, resolveRuntime);
  }

  // Verify locales directory exists
  if (!fs.existsSync(config.localesDir)) {
    throw new Error(`Locales directory not found: ${config.localesDir}. Create it or set "localesDir" in your config file.`);
  }

  // --- Version banner ---
  const require = createRequire(import.meta.url);
  const { version } = require('../package.json');
  output.banner(version);

  // Detect locale file format (JSON, TOML, or YAML)
  // CLI flag takes priority, then config file, then auto-detect from directory
  const isAutoFormat = config.format === 'auto';
  const format = isAutoFormat
    ? detectFormatFromDir(config.localesDir)
    : config.format;
  const ext = getExtension(format);
  output.info(`Detected format: ${format} (${isAutoFormat ? 'auto' : 'config'})`);

  // Framework detection — Hugo (contentDir) or Docusaurus (already dispatched above)
  if (config.contentDir) {
    output.info('Detected framework: Hugo');
    output.info(`Content directory: ${config.contentDir}`);
  }

  const inputLocale = config.inputLocale;
  const sourceFile = `${inputLocale}${ext}`;
  const sourcePath = path.join(config.localesDir, sourceFile);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source locale not found: ${sourcePath}`);
  }

  // For JSON, read and flatten the nested structure.
  // For TOML/YAML, readLocaleFile already returns a flat map.
  const sourceRaw = readLocaleFile(sourcePath, format);
  const sourceFlat = format === 'json' ? flattenKeys(sourceRaw) : sourceRaw;

  // Detect YAML sub-format: Hugo (CLDR plural sub-keys only) vs standard nested.
  // Read the raw file content to inspect sub-key names before they're flattened.
  const yamlStyle = format === 'yaml'
    ? detectYAMLStyle(fs.readFileSync(sourcePath, 'utf-8'))
    : null;

  // Defense-in-depth: remove any keys that could cause prototype pollution.
  // Extremely unlikely in real locale files but important for a public package.
  for (const key of Object.keys(sourceFlat)) {
    if (isUnsafeKey(key)) {
      delete sourceFlat[key];
    }
  }

  const sourceKeyCount = Object.keys(sourceFlat).length;

  // --force: re-queue EVERY string key — the whole-locale rebuild verb.
  // Recovering from a bad version is exactly when someone needs this, and
  // the only prior route was deleting the locale file by hand. Scope with
  // --pair; combine with --no-tm when the cache itself is suspect (TM hits
  // are still gate-checked and poisoned entries evicted, but --no-tm forces
  // a fully fresh re-bill). Set BEFORE the cost estimator so the preview
  // prices the full rebuild, and --max-cost can cap it.
  if (cliArgs.force) {
    config.forceKeys = Object.keys(sourceFlat).filter(k => typeof sourceFlat[k] === 'string');
    output.info(`--force: re-queuing all ${config.forceKeys.length} source key(s)${cliArgs.pair ? ' for the selected pair(s)' : ''}`);
  }

  // Load the hash manifest and detect which English values changed
  // since the last sync. On first run (no manifest), this returns []
  // and everything flows through the normal missing-key detection.
  const oldManifest = readManifest(cwd);
  const changedKeys = detectChangedKeys(sourceFlat, oldManifest);
  const currentManifest = buildHashManifest(sourceFlat);

  // No-translate matcher — the ONE compiled instance for this run. The cost
  // estimator and every locale's diff share it, so the keys excluded from the
  // bill are exactly the keys excluded from translation, by construction.
  const noTranslate = compileNoTranslate(config);
  if (noTranslate.patterns.length > 0) {
    output.info(`No-translate patterns: ${noTranslate.patterns.join(', ')}`);
  }

  // Resolve the pair graph via the shared helper.
  // Thread dryRun/audit into cliArgs so the preflight check can skip
  // for read-only operations that don't need an API key.
  const { apiKey, resolvedPairs, pairEntries } = await resolveRuntime(config, cwd, { ...cliArgs, dryRun, audit });

  // Provenance check — warn about uncleared licensing before sync starts.
  // This is informational only (does not block execution).
  const provenanceAudit = auditProvenance(resolvedPairs);
  if (!provenanceAudit.allClear) {
    for (const blockedKey of provenanceAudit.blockedPairs) {
      const blockedPair = resolvedPairs.get(blockedKey);
      output.warn(`${blockedKey}: Method "${blockedPair.method}" has unverified licensing. Run \`champollion provenance\` for details.`);
    }
  }

  if (pairEntries.length === 0) {
    output.info('No target languages configured. Run `champollion init` to set up.');
    return;
  }

  // --- Audit mode ---
  if (audit) {
    output.info('Audit: scanning for untranslated values...');
    let total = 0;
    const auditLocales = [];
    const missingLocales = [];
    for (const [, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      const filename = `${code}${ext}`;
      const filePath = path.join(config.localesDir, filename);
      if (!fs.existsSync(filePath)) {
        // A configured locale with NO file is 100% untranslated, not "fully
        // translated". Skipping it silently let an audit wired as a CI gate
        // pass with zero translation done — every source key counts as
        // untranslated and the run must exit non-zero.
        if (sourceKeyCount > 0) {
          missingLocales.push(filename);
          auditLocales.push({
            locale: code,
            file: filename,
            missing: true,
            untranslatedCount: sourceKeyCount,
            untranslatedKeys: Object.keys(sourceFlat),
          });
          output.error(`${filename}: locale file missing — all ${sourceKeyCount} key(s) untranslated. Run \`champollion sync\` to create it.`);
          total += sourceKeyCount;
        }
        continue;
      }
      const dataRaw = readLocaleFile(filePath, format);
      const flat = format === 'json' ? flattenKeys(dataRaw) : dataRaw;
      const untranslated = Object.entries(flat)
        .filter(([, val]) => typeof val === 'string' && val.startsWith(config.fallbackPrefix));
      auditLocales.push({
        locale: code,
        file: filename,
        untranslatedCount: untranslated.length,
        untranslatedKeys: untranslated.map(([key]) => key),
      });
      if (untranslated.length > 0) {
        output.raw(`  ${filename}: ${untranslated.length} keys still need translation`);
        for (const [key] of untranslated) {
          output.raw(`     - ${key}`);
        }
        total += untranslated.length;
      }
    }
    if (missingLocales.length > 0) {
      output.raw(`\n  Total: ${total} keys need translation (${missingLocales.length} locale file(s) missing: ${missingLocales.join(', ')}).`);
    } else {
      output.raw(total === 0
        ? '\n  All locale files are fully translated.'
        : `\n  Total: ${total} keys need translation.`);
    }
    // Machine-readable end-of-command summary — in --json mode the raw lines
    // above are suppressed, so the key list must ride the summary object.
    output.summary({
      command: 'audit',
      untranslatedCount: total,
      missingLocales,
      locales: auditLocales,
    });
    return { untranslatedCount: total, missingLocaleCount: missingLocales.length };
  }

  // --- Sync mode ---
  const methodSummary = pairEntries.map(([, p]) => `${p.target}:${p.method}`).join(', ');
  output.info(`Source: ${sourceFile} (${sourceKeyCount} keys)`);
  output.info(`Pairs: ${methodSummary}`);
  if (changedKeys.length > 0) {
    output.info(`Changed: ${changedKeys.length} key(s) have updated source content`);
  }
  if (dryRun) output.info('Dry-run mode — no files will be modified.');

  // Load Translation Memory — provides same-project caching across syncs.
  // Keys whose source text + locale + method haven't changed will be served
  // from TM instead of hitting the API. This is the primary cost-saving
  // mechanism: re-running sync after a single key change only translates
  // that one key, not the entire file.
  //
  // Loaded BEFORE the cost estimate so the estimator partitions against the
  // exact TM this run will use — TM hits are $0, not fresh API calls.
  //
  // --no-tm bypasses the cache entirely: all keys go to the API and nothing
  // is stored. Useful when switching providers or debugging translation
  // quality. The empty TM object makes the estimator price every key too.
  const noTM = cliArgs['no-tm'] || false;
  const tm = noTM ? { _meta: { version: 1 } } : loadTM(cwd);
  const tmInitialSize = tmSize(tm);
  if (noTM) {
    output.info('Translation Memory disabled (--no-tm)');
  } else if (tmInitialSize > 0) {
    output.info(`Translation Memory: ${tmInitialSize} cached entries loaded`);
  }

  // --- Pre-sync cost estimation ---
  // Runs for EVERY engine (each method implements estimateCost, or honestly
  // reports "unknown"). Without --max-cost this stays non-blocking: failures
  // log a warning and the sync continues. With --max-cost the estimate is a
  // GATE: over-cap or unknowable estimates abort before any API call.
  const costEstimate = await printCostEstimate(
    pairEntries, sourceFlat, config, format, ext, changedKeys, { cwd, tm, noTranslate }
  );

  // Enforce the cap only for real runs: a dry-run makes zero API calls, and
  // aborting it would block the exact preview a capped user needs to see.
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

  output.raw('');

  let totalProcessed = 0;
  let totalTMHits = 0;
  let totalFailed = 0;
  let totalCopied = 0;
  let totalKeptWorkingScript = 0;
  const failedPairs = [];

  // ── Parallel locale processing ────────────────────────────────
  // Each locale writes to its own file and its own TM keys (keyed by
  // locale code), so there are zero data dependencies between locales.
  // Node.js is single-threaded so storeTM() property assignments can't
  // interleave between await points — fully safe under pMap concurrency.
  const jsonConcurrency = config.jsonConcurrency ?? DEFAULT_JSON_CONCURRENCY;
  output.info(`Translating ${pairEntries.length} locale(s) with concurrency ${jsonConcurrency}`);

  const localeResults = await pMap(pairEntries, async ([pairKey, pairConfig]) => {
    const code = pairConfig.target;
    const filename = `${code}${ext}`;
    const filePath = path.join(config.localesDir, filename);

    // Security: verify the resolved write path is still within localesDir.
    // Prevents path traversal via crafted language codes like "../../../etc/passwd".
    // A refusal means NO file was written — count it as a failure so the run
    // reports it and exits non-zero, instead of printing [OK] and exiting 0.
    if (!isPathContained(filePath, config.localesDir)) {
      output.error(`${filename} — refusing to write outside locales directory`);
      // Nothing ran for this locale, so every changed key is unresolved here.
      // Only changed keys matter for manifest retry-safety: missing keys
      // re-fire via missing-key detection regardless of the manifest.
      return { processed: 0, tmHits: 0, failed: 1, failedKeys: changedKeys, pairKey };
    }

    // If locale file doesn't exist yet, create it as empty
    let data = {};
    if (fs.existsSync(filePath)) {
      data = readLocaleFile(filePath, format);
    }

    // For JSON, flatten the nested structure. TOML/YAML is already flat.
    const targetFlat = format === 'json' ? flattenKeys(data) : { ...data };
    // Source-echo requeue suppression: a target value equal to its source is
    // only requeued when the TM does NOT confirm the echo came from the
    // pipeline. lookupTM === sourceValue means a previous run translated this
    // exact text to itself and the gate approved it — skip, don't re-bill.
    // With --no-tm the TM is empty, so nothing is suppressed.
    const tmKey = tmMethodKey(pairConfig);
    const diff = diffLocale(
      sourceFlat, targetFlat, config.fallbackPrefix, config.forceKeys, changedKeys,
      (key, sourceValue) => lookupTM(tm, sourceValue, code, tmKey) === sourceValue,
      noTranslate.active ? noTranslate.matches : null
    );

    if (diff.toProcess.length === 0 && diff.noTranslate.length === 0 && diff.extra.length === 0) {
      output.ok(`${filename} — fully synced`);
      return { processed: 0, tmHits: 0 };
    }

    let localeProcessed = 0;
    let localeTMHits = 0;
    let localeFailed = 0;
    let localeCopied = 0;
    let localeKeptWorkingScript = 0;
    // Key NAMES that failed in this locale — threaded back to the aggregator
    // so writeManifest can restore their OLD hashes. Persisting the NEW hash
    // for a failed key would mark it resolved and it would never be retried.
    const localeFailedKeys = [];

    if (diff.toProcess.length > 0 || diff.noTranslate.length > 0) {
      output.info(`${filename} — ${diffLabel(diff)}`);
    }

    // ── No-translate keys: copy the source value, verbatim ─────────────
    // Runs BEFORE the translation block so a dead backend can't strand a
    // corrupted URL for another cycle (see flushNoTranslateOnBail below).
    // No API call, no quality gate, no cost — and byte-identical by
    // construction, which is the only correct outcome for these values.
    if (diff.noTranslate.length > 0) {
      for (const key of diff.noTranslate) {
        if (dryRun) continue;
        if (format === 'json') setNestedValue(data, key, sourceFlat[key]);
        else data[key] = sourceFlat[key];
      }
      localeCopied = diff.noTranslate.length;
      const sample = diff.noTranslate.slice(0, 3)
        .map(k => `${k} (${noTranslate.reason(k, sourceFlat[k])})`)
        .join(', ');
      const more = diff.noTranslate.length > 3 ? `, +${diff.noTranslate.length - 3} more` : '';
      output.info(`${filename} — ${dryRun ? 'would copy' : 'copied'} ${localeCopied} no-translate key(s) verbatim: ${sample}${more}`);
    }

    // A whole-locale translation failure returns early and writes nothing, so
    // the verbatim copies above would be lost with it. They do not depend on
    // the backend, so flush them: a repair that is already computed and free
    // must not wait on an unrelated outage.
    const flushNoTranslateOnBail = () => {
      if (dryRun || diff.noTranslate.length === 0) return 0;
      try {
        writeLocaleFile(filePath, data, format, format !== 'json' ? data : undefined, yamlStyle);
        return localeCopied;
      } catch (err) {
        output.error(`${filename} — failed to write no-translate copies: ${err.message}`);
        return 0;
      }
    };

    if (diff.toProcess.length > 0) {
      if (dryRun) {
        // Dry-run does no API calls and writes nothing, but it must still
        // report what it WOULD process — otherwise the summary always reads
        // "Would have processed 0 keys total." even with pending work.
        localeProcessed += diff.toProcess.length;

        // --list-keys: NAME the queued keys, per reason. Counts alone made
        // investigating a surprise queue impossible without re-implementing
        // the diff by hand — integrity names damaged keys; a dry run must
        // name queued ones. (The --json summary always carries these lists
        // on dry runs; this is the human rendering.)
        if (cliArgs['list-keys']) {
          const sections = [
            ['missing', diff.missing],
            ['[EN] fallback', diff.needsTranslation],
            ['untranslated (unstamped echo)', diff.untranslated],
            ['changed', diff.changed],
            ['forced', diff.forced],
            ['copy verbatim (no-translate)', diff.noTranslate],
          ];
          for (const [label, keys] of sections) {
            if (keys.length === 0) continue;
            output.raw(`     ${label}:`);
            for (const k of keys) output.raw(`       - ${k}`);
          }
        }
      }

      if (!dryRun) {
        let translated = null;

        const stringKeys = diff.toProcess.filter(k => typeof sourceFlat[k] === 'string');
        if (stringKeys.length > 0) {
          // Shared pipeline: TM partition → API call → TM store → quality gate
          const result = await translateAndValidate(stringKeys, sourceFlat, pairConfig, pairKey, {
            apiKey, tm, targetCode: code,
            onProgress: (completed, total) => {
              output.progressBar(completed, total);
            },
          });
          translated = result.translated;
          localeTMHits += result.tmHitCount;

          // Terminology enforcement: check if dictionary terms were applied.
          // This only runs when the pair has coaching data with a dictionary.
          if (translated && pairConfig.coachingData?.dictionary) {
            const { violations } = verifyTerminology(translated, sourceFlat, pairConfig.coachingData.dictionary);
            if (violations.length > 0) {
              logTermViolations(violations, pairKey);
            }
          }

          if (translated) {
            localeFailed += result.failures.length;
            output.progress(result.failures.length > 0
              ? ` [OK] (${result.failures.length} key(s) failed quality gate)`
              : ' [OK]\n');
          } else if (result.apiReturnedNull) {
            // Method returned null — fail loud with actionable guidance.
            output.progress(' [ERR]\n');
            output.error(`${pairKey}: Translation method "${pairConfig.method}" returned no results.`);
            const methodInstance = getMethod(pairConfig.method, pairConfig);
            const helpLines = methodInstance.getSetupHelp();
            for (const line of helpLines) {
              output.error(line);
            }
            // Whole locale failed: every pending key must re-fire next sync.
            return { processed: 0, tmHits: localeTMHits, copied: flushNoTranslateOnBail(), failed: diff.toProcess.length, failedKeys: diff.toProcess, pairKey };
          } else if (result.failures.length > 0 && !translated) {
            // All translations failed quality gate — fail loud
            output.progress(' [ERR] all translations failed quality gate\n');
            output.error(`${pairKey}: All translations were rejected by the quality gate.`);
            output.error('Check your method configuration or review the gate failures above.');
            return { processed: 0, tmHits: localeTMHits, copied: flushNoTranslateOnBail(), failed: diff.toProcess.length, failedKeys: diff.toProcess, pairKey };
          }
        }

        // Post-translation script conversion — ONLY when this pair's script
        // resolution asked for it (config `script:`). The old gate was a bare
        // registry lookup, which converted every tlh/crk/… project into
        // display scripts (PUA for the conlangs) whether or not their fonts
        // could render them. See lib/scripts.js resolveTargetScript.
        const scriptConverterKey = pairConfig.scriptResolution?.converterKey || null;
        if (scriptConverterKey && translated && Object.keys(translated).length > 0) {
          const info = getConverterInfo(scriptConverterKey);
          output.info(`[SCRIPT] Converting ${info.from} → ${info.to} (${Object.keys(translated).length} keys)`);
        }

        for (const key of diff.toProcess) {
          const sourceValue = sourceFlat[key];
          let value;

          if (translated && key in translated) {
            value = translated[key];

            if (scriptConverterKey && typeof value === 'string') {
              // User-declared transliteration fallbacks first (validated at
              // pair build), then the converter. If letters remain that the
              // converter cannot map, the output would be an unreadable mix
              // of both scripts — keep the WHOLE value in the working script
              // instead, and say which letters and how to map them. Not a
              // failure: unmappable proper nouns would fail identically on
              // every retry, and a permanently red sync is the trap this
              // release exists to close.
              const prepared = applyScriptFallback(value, pairConfig.scriptFallback);
              const { converted, unmapped } = convertScript(prepared, scriptConverterKey);
              if (unmapped.length === 0) {
                value = converted;
              } else {
                const hint = unmapped.map(l => `"${l}": "?"`).join(', ');
                output.warn(
                  `${pairKey}: key "${key}" kept in ${getConverterInfo(scriptConverterKey).from} — `
                  + `letter(s) the converter cannot map: ${unmapped.join(', ')}. `
                  + `To transliterate them, add "scriptFallback": { ${hint} } for ${pairConfig.target}.`
                );
                localeKeptWorkingScript++;
              }
            }
          } else if (typeof sourceValue === 'string') {
            // Key not in translated result (gate rejection or partial API
            // response) — skip it, don't write garbage. Record the key so its
            // old manifest hash is restored and the retry actually happens.
            output.warn(`${pairKey}: key "${key}" not translated — skipping (will retry next sync)`);
            localeFailedKeys.push(key);
            continue;
          } else {
            value = sourceValue;
          }

          if (format === 'json') {
            setNestedValue(data, key, value);
          } else {
            data[key] = value;
          }
        }

        localeProcessed += diff.toProcess.length;
      }
    }

    if (diff.extra.length > 0) {
      output.warn(`${filename} — ${diff.extra.length} extra key(s) not in source`);
    }

    // Write updated file.
    // CRITICAL: isolate the write per-locale. If one locale file is unwritable
    // (e.g. read-only permissions, a full disk, a locked file), a thrown error
    // here used to reject the whole pMap and discard every SIBLING locale's
    // already-paid translations. Instead, catch it, count this locale's keys as
    // failed, and let the other locales write. The run reports the failure and
    // exits non-zero rather than aborting everything.
    if (!dryRun && (diff.toProcess.length > 0 || diff.noTranslate.length > 0)) {
      try {
        writeLocaleFile(filePath, data, format, format !== 'json' ? data : undefined, yamlStyle);
      } catch (err) {
        output.error(`${filename} — failed to write: ${err.message}`);
        // Everything we attempted for this locale is unwritten → all failed.
        // That includes the verbatim copies: they were staged in memory only.
        return {
          processed: 0,
          tmHits: localeTMHits,
          copied: 0,
          failed: diff.toProcess.length,
          failedKeys: diff.toProcess,
          pairKey,
        };
      }
    }

    return {
      processed: localeProcessed,
      tmHits: localeTMHits,
      copied: localeCopied,
      keptWorkingScript: localeKeptWorkingScript,
      failed: localeFailed,
      failedKeys: localeFailedKeys,
      pairKey,
      // Dry runs carry the NAMES of queued keys per reason, so agents can
      // read the plan from the --json summary instead of re-deriving the
      // diff. Omitted on real runs — per-key outcomes are reported there.
      ...(dryRun && {
        queuedKeys: {
          missing: diff.missing,
          fallback: diff.needsTranslation,
          untranslated: diff.untranslated,
          changed: diff.changed,
          forced: diff.forced,
          noTranslate: diff.noTranslate,
        },
      }),
    };
  }, { concurrency: jsonConcurrency });

  // Aggregate results across all locales
  const failedKeySet = new Set();
  for (const r of localeResults) {
    totalProcessed += r.processed;
    totalTMHits += r.tmHits;
    totalFailed += (r.failed || 0);
    totalCopied += (r.copied || 0);
    totalKeptWorkingScript += (r.keptWorkingScript || 0);
    if (r.failed > 0 && r.pairKey) {
      failedPairs.push({ pair: r.pairKey, count: r.failed });
    }
    for (const key of r.failedKeys || []) failedKeySet.add(key);
  }

  // Summary. Never print [OK] when keys failed — a green success marker on a
  // partially-failed sync misleads CI and agents into thinking all is well.
  const summary = formatSyncSummary(dryRun, totalProcessed, totalFailed, totalCopied);
  if (summary.ok) output.ok(summary.message);
  else output.warn(summary.message);

  // Keys kept in the working script (unmapped letters) are informational —
  // valid translations, just not converted. Surface the count once so the
  // per-key warnings above can't scroll away unnoticed.
  if (totalKeptWorkingScript > 0) {
    output.warn(
      `${totalKeptWorkingScript} key(s) kept in the working script — the converter could not map some letters. `
      + 'See the warnings above for a per-key "scriptFallback" suggestion.'
    );
  }

  // ── Failure summary ──────────────────────────────────────────────
  // Print a clear summary when any locale had partial failures.
  // This gives the user a single glanceable block at the end instead
  // of having to scroll back through per-locale output to find issues.
  if (failedPairs.length > 0) {
    output.raw('');
    output.warn('Failure summary:');
    for (const { pair, count } of failedPairs) {
      output.warn(`  ${pair}: ${count} key(s) failed translation or quality gate`);
    }
    output.warn(`Total: ${totalFailed} key(s) failed across ${failedPairs.length} locale(s).`);
    output.warn('Failed keys keep their previous manifest hash and will be retried on the next sync.');
  }

  // Write the updated hash manifest so the next sync knows
  // what state the translations are based on.
  // Skip in dry-run mode — don't mark stale keys as resolved.
  if (!dryRun) {
    // ── Manifest retry-safety ─────────────────────────────────────
    // A key that failed in ANY locale must keep its OLD hash: persisting the
    // NEW hash would mark the changed source as resolved, and the failed key
    // would never be re-detected as 'changed' (the locale file still has the
    // stale translation, so missing-key detection can't catch it either).
    //
    // CONSERVATIVE by design: one restore is global, so the key re-fires for
    // ALL locales next sync — but the re-fire is TM-served (zero API cost)
    // for locales that already succeeded, so the only real work is the retry
    // that actually failed. Keys with no prior hash are dropped from the
    // manifest entirely; they were never written, so missing-key detection
    // re-fires them regardless.
    for (const key of failedKeySet) {
      // Own-property check: `in` walks the prototype chain, so a key
      // literally named "toString"/"valueOf" would mis-resolve.
      if (Object.prototype.hasOwnProperty.call(oldManifest, key)) {
        currentManifest[key] = oldManifest[key];
      } else {
        delete currentManifest[key];
      }
    }
    writeManifest(cwd, currentManifest);

    // Persist TM if it was mutated during this sync (stores OR evictions —
    // a size check would miss eviction-only runs and same-key replacements).
    // Skip when --no-tm is active — nothing was cached, nothing to save.
    if (!noTM && isTMDirty(tm)) {
      const tmFinalSize = tmSize(tm);
      const delta = tmFinalSize - tmInitialSize;
      saveTM(cwd, tm);
      output.info(`[TM] Saved ${tmFinalSize} entries (${delta >= 0 ? '+' + delta : delta} this sync)`);
    }
  }

  // Content sync — translate Hugo Markdown content files if configured.
  // Uses the same resolved pair graph as key-value sync, ensuring method
  // dispatch is consistent across both translation modes.
  if (config.contentDir) {
    await runContentSync({
      contentDir: config.contentDir,
      sourceLocale: inputLocale,
      pairs: resolvedPairs,
      translatableFields: config.translatableFields,
      apiKey,
      dryRun,
      noTM,
      cwd,
      concurrency: config.contentConcurrency || 12,
    });
  }

  // ── Post-sync verification ──────────────────────────────────────
  // Re-read written locale files from disk and confirm translations
  // are actually present and correct. Catches the gap between the CLI
  // reporting "synced N keys" and keys being wrong in fact.
  // Skipped for dry-run (nothing written) and audit (read-only).
  //
  // Verification errors feed the exit code: a sync that wrote files but
  // left [EN] markers, missing keys, or wrong-script values is NOT a clean
  // pass, and a CI gate must see that.
  let verifyErrors = 0;
  let verifyWarnings = 0;
  if (!dryRun && !audit && !cliArgs['no-verify']) {
    const v = await verifyLocales(config, cwd, { noTranslate });
    verifyErrors = v.errors;
    verifyWarnings = v.warnings;
  }

  // Per-locale structured results (zip the parallel pMap output back to its
  // pair keys) — used by the --json summary so agents don't regex log lines.
  const localeSummary = pairEntries.map(([pairKey, pairConfig], i) => {
    const r = localeResults[i] || {};
    return {
      pair: pairKey,
      target: pairConfig.target,
      processed: r.processed || 0,
      failed: r.failed || 0,
      tmHits: r.tmHits || 0,
      copied: r.copied || 0,
      keptWorkingScript: r.keptWorkingScript || 0,
      ...(r.queuedKeys && { queuedKeys: r.queuedKeys }),
    };
  });

  // Machine-readable end-of-command summary. In --json mode output.summary
  // emits a single {level:'summary', ...} object; in default/quiet mode it
  // is a no-op (the human-readable lines above already cover it), so this is
  // additive and never double-prints.
  output.summary({
    command: 'sync',
    dryRun,
    totalProcessed,
    totalFailed,
    tmHits: totalTMHits,
    // No-translate keys copied verbatim: never sent to a backend, never
    // gated, never billed. Counted apart from totalProcessed so an agent
    // reading this can tell translation work from passthrough.
    totalCopied,
    // Valid translations left in the working script because the converter
    // could not map some of their letters (see scriptFallback).
    totalKeptWorkingScript,
    noTranslate: { patterns: noTranslate.patterns, autoDetectUrls: noTranslate.urls },
    verify: { errors: verifyErrors, warnings: verifyWarnings },
    failedPairs,
    locales: localeSummary,
    // Pre-run cost estimate (null when estimation failed) — the human table
    // is output.raw and therefore invisible in --json, so the structured
    // estimate must ride the summary for agents/CI.
    costEstimate,
  });

  // Return result for exit code determination.
  // totalFailed > 0 means some keys couldn't be translated; verifyErrors > 0
  // means written files didn't pass verification. The caller maps these to a
  // non-zero exit code (see lib/commands/sync.js computeExitCode).
  return { totalProcessed, totalFailed, totalCopied, totalKeptWorkingScript, failedPairs, verifyErrors, verifyWarnings };
}

export { runSync, runContentSync, resolveRuntime, loadApiKey, formatSyncSummary };

