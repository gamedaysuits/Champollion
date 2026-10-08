/**
 * Main sync orchestrator — ties together config, diff, hash, translate, and file I/O.
 *
 * This is the core "do the thing" module. It:
 *   1. Prints version banner (e.g., "champollion v3.4.0")
 *   2. Reads the source locale file (JSON, TOML, or YAML)
 *   3. Logs detected format and content directory (e.g., "Detected format: json (auto)";
 *      "Detected framework: Hugo (hugo.toml)" only on real Hugo evidence)
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
 *   - lib/content-sync.js    — contentDir Markdown sync (Hugo or any Markdown folder)
 *   - lib/watch.js           — file watcher for auto-sync
 *   - lib/output.js          — banner(), progressBar(), and all CLI output
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { flattenKeys, setNestedValue, deleteNestedValue, assignInOrder } from './flatten.js';
import { diffLocale, diffLabel, queueReasons } from './diff.js';
import { getMethod } from './translate.js';
import { resolveConfig, autoDetectLanguages, DEFAULT_JSON_CONCURRENCY, DEFAULT_BATCH_SIZE } from './config.js';
import { compileNoTranslate } from './no-translate.js';
import { buildHashManifest, detectChangedKeys, readLock, writeManifest, LOCK_FILENAME } from './hash.js';
import {
  LockState, planQueue, createEditClassifier, encodeWritten, recordReplacedEdits,
  REPLACED_EDITS_FILENAME, localeHealth, decodeWritten, valueHash, encodeForm, decodeForm,
  recordRefusal, describeHeldKeys, describeFallbackOnlyKeys, keyFateNote, describeHeldNext,
} from './locale-state.js';
import { splitKeyList } from './redo.js';
import { applyNamedKeyRule, reportUnmatchedKeys, unmatchedKeysSummary, reportNamedFromCache as sayNamedFromCache } from './named-keys.js';
import { SharedOutputIndex, sharedOutputItems, droppedTerminalMarks, describeDroppedMarks, isProtectedTermValue } from './validate.js';
import {
  discoverLocaleLayout, loadSourceUnits, expectedForTarget, readLocaleData, readLocaleFlat,
  writeLocaleData, lockKey, keysForNamespace, NS_SEPARATOR,
} from './locale-layout.js';
import { mapSourceKeysToTarget, originKey, describePluralFormChanges, pluralExtraKeys } from './plurals.js';
import { planGapRedo, recordGap } from './plural-gap-redo.js';
import { resolvePairs, filterPairGraph, parsePairKey, estimateCost } from './pairs.js';
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
import {
  loadTM, saveTM, tmSize, isTMDirty, setModelCarryover, setTMReads, tmMethodKey, describeTMChanges,
  tmTranslationsOf, bypassTMFor, findOtherMethodEntries, describeMethodKey, lookupTM, peekTM, tmMethodKeysHolding,
  adoptLegacyCoachingKeys, canonicalWriterKey, fallbackWriterOf,
} from './tm.js';
import { tmSourceText, tmTextFor, tmProofTextsFor, splitSharedPluralEntries, createTMEvictor } from './tm-evict.js';
import { verifyTerminology, logTermViolations } from './terminology.js';
import { output } from './output.js';
import {
  printCostEstimate, parseMaxCost, abortForMaxCost, maxCostVerdict, reportDryRunMaxCost, warnModelSwitchStrandedTM, dryRunCiHint,
  translationsBreakdown,
  preflightStopReason,
} from './cost-report.js';
import { runDocusaurusSync } from './docusaurus-sync.js';
import { translateWithFallback, previewRequests } from './translate-pair.js';
import {
  tmKeysForPair, tmHoldsValue, createFallbackBudget, newFallbackReport, addToTally,
  fallbackSummary, printFallbackReport, warnFallbackMajority,
} from './fallback.js';
import { verifyLocales, redoCommand, contentRedoCommand, shellWord, pluralGapsInFile } from './verify.js';
import { projectSharedOutputIndex } from './shared-output-seed.js';
import { describeCategories, describePluralGap } from './icu-structure.js';
import { poPluralSlots, poFuzzyKeys } from './po.js';
import { pMap } from './concurrent.js';
import { costLabel } from './cost-label.js';
import { ciSecretLine, secretNamesIn, missingKeyAdvice, methodSetupAdvice, onCIRunner } from './missing-key.js';
import { resetTranslationError } from './methods/translation-error.js';
import { PLAIN_LLM_METHODS } from './methods/llm.js';
import { compileFileScope } from './file-scope.js';
import { flutterLocaleLines } from './flutter-locales.js';
import { discoverContentFiles, detectContentSite } from './content.js';


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
  const pairs = resolvePairs(runtimeConfig, { cwd });
  const plugins = loadPlugins(cwd);

  // Resolve plugin configs into each pair that references one.
  let resolvedPairs = new Map();
  for (const [pairKey, rawPairConfig] of pairs) {
    const resolved = resolvePluginForPair(plugins, rawPairConfig);
    // A fallback may name a plugin too — merged the same way, as its own pair.
    if (resolved.fallback) resolved.fallback = resolvePluginForPair(plugins, resolved.fallback);
    resolvedPairs.set(pairKey, resolved);
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

  // ── GLOSSARY CHECKS, every method ─────────────────────────────────
  // The project glossary (.champollion/coaching/<locale>.json → "dictionary")
  // was only read by the coached method and DeepL, and the terminology check
  // below needs it on the pair — which nothing set, so it never ran. Load it
  // for every pair: the check now warns when ANY method's output skips a
  // glossary term. Stored as `glossary`, not in coachingData, so coached
  // pairs keep their cache keys (tmMethodKey hashes coachingData).
  // Every LLM method is TOLD the glossary terms each batch contains too
  // (lib/methods/llm.js buildUserMessage), so the check never warns about a
  // term the model was not given. null = none for this locale.
  //
  // The file's grammar rules and style notes are coaching: only llm-coached
  // reads them. The plain LLM methods build one and the same prompt, so a
  // project with rules running a plain one is told, once, where they apply.
  {
    const { loadCoachingData, DEFAULT_COACHING_DIR } = await import('./methods/coaching-data.js');
    const coachingDir = path.join(cwd, DEFAULT_COACHING_DIR);
    const cache = new Map();
    for (const [pairKey, pc] of pairEntries) {
      const data = loadCoachingData(coachingDir, pc.target, cache);
      const glossary = data?.dictionary && Object.keys(data.dictionary).length > 0 ? data.dictionary : null;
      pc.glossary = glossary;
      if (pc.fallback) pc.fallback.glossary = glossary;
      const hasCoaching = data && (data.grammar_rules.length > 0 || data.style_notes);
      if (hasCoaching && PLAIN_LLM_METHODS.has(pc.method)) {
        const provider = pc.method === 'llm' ? '' : `, "provider": "${pc.method}"`;
        output.info(
          `${pairKey}: the grammar rules and style notes in ${DEFAULT_COACHING_DIR}/${pc.target}.json are read by the `
          + `llm-coached method only — ${pc.method} is ${glossary ? 'given its glossary, not them' : 'not given them'}. `
          + `To use them: "method": "llm-coached"${provider}.`
        );
      }
    }
  }

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
  // Audit (listing what is untranslated) needs no method at all: skipped.
  // A DRY RUN checks too, and warns instead of stopping: it used to skip
  // the check, exit 0 and say nothing, so a dry run in CI could not catch a
  // missing secret (Round 3, Django + Next.js personas). The exit code stays
  // 0 — a dry run is a preview and never fails, the same rule that keeps
  // --max-cost from aborting it — and the JSON summary carries `preflight`.
  let preflightFailures = [];
  // A model server that does not answer (local, LibreTranslate, Apertium),
  // off a CI runner, when the caller decides after its plan: a run that
  // sends nothing to that method (a redo served from the cache) does not
  // need it (Round 11, Django persona). See resolveDeferredProbes.
  let deferredProbeFailures = [];
  if (!cliArgs.audit) {
    const failures = [];
    for (const [pairKey, pairConfig] of pairEntries) {
      const method = getMethod(pairConfig.method || 'llm', pairConfig);
      const readiness = await method.checkReadiness({ apiKey, cwd });
      if (!readiness.ready) {
        failures.push({
          pairKey, pairConfig, reason: readiness.reason, method,
          unreachable: !!readiness.unreachable, endpoint: readiness.endpoint || null, pair: pairKey, target: pairConfig.target,
        });
      }
      // A configured fallback must be able to run too: discovering a
      // missing key only when the primary first fails would leave those
      // keys untranslated with the reason buried mid-run.
      if (pairConfig.fallback) {
        const fbMethod = getMethod(pairConfig.fallback.method, pairConfig.fallback);
        const fbReadiness = await fbMethod.checkReadiness({ apiKey, cwd });
        if (!fbReadiness.ready) {
          failures.push({
            pairKey: `${pairKey} fallback`, pairConfig: pairConfig.fallback, reason: fbReadiness.reason, method: fbMethod,
            unreachable: !!fbReadiness.unreachable, endpoint: fbReadiness.endpoint || null, pair: pairKey, target: pairConfig.target,
          });
        }
      }
    }
    // A CI runner keeps the Round 8 rule: a server that does not answer
    // stops the run at once, even when nothing is queued — a workflow that
    // still names "local" fails on its first push, not on the first string
    // that changes.
    const defer = !!cliArgs.deferUnreachable && !onCIRunner();
    deferredProbeFailures = defer ? failures.filter(f => f.unreachable) : [];
    const now = defer ? failures.filter(f => !f.unreachable) : failures;
    preflightFailures = stopForPreflight(now, cliArgs);
  }

  return { apiKey, resolvedPairs, pairEntries, preflightFailures, deferredProbeFailures };
}

/**
 * The preflight's verdict on failures: a dry run warns and returns them (the
 * JSON summary's `preflight.failures`); a real run throws the one error that
 * names every method that is not ready, with the setup help.
 *
 * @param {Array<{ pairKey: string, pairConfig: object, reason: string, method: object }>} failures
 * @param {{ dryRun?: boolean }} cliArgs
 * @returns {Array<{ pair: string, method: string, reason: string }>} for a dry run; [] when nothing failed
 */
function stopForPreflight(failures, cliArgs) {
  if (failures.length === 0) return [];
  // The secret(s) a missing-key failure names ("… (OPENROUTER_API_KEY).")
  // and what to do about them, by where the run is (lib/missing-key.js —
  // the one helper every missing-key message goes through).
  const ciLine = ciSecretLine(secretNamesIn(failures.map(f => f.reason)));
  if (cliArgs.dryRun) {
    const preflightFailures = failures.map(({ pairKey, pairConfig, reason }) => ({
      pair: pairKey, method: pairConfig.method || 'llm', reason,
    }));
    output.warn('Dry run only — the real sync would STOP here, before translating anything:');
    for (const f of preflightFailures) output.warn(`  ✗ ${f.pair} (method: ${f.method}): ${f.reason}`);
    output.warn(ciLine
      ? `  Set what is missing, then run the sync. ${ciLine}`
      : '  Set what is missing (in CI: add it as a secret and pass it to the sync step), then run the sync.');
    return preflightFailures;
  }
  // Build a single, actionable error with all failures + setup help.
  // The FIRST line says what happened: printed after "[ERR] sync failed:",
  // an empty one left that line blank in CI logs (Round 8, i18next
  // persona). It counts METHODS, not pairs: one method on two language
  // pairs is one method that is not ready, said with its pairs (Round 9:
  // "2 methods are not ready" for one).
  const byMethod = new Map();
  for (const f of failures) {
    const m = f.pairConfig.method || 'llm';
    if (!byMethod.has(m)) byMethod.set(m, { pairs: [], reasons: [] });
    const entry = byMethod.get(m);
    entry.pairs.push(f.pairKey);
    const reason = String(f.reason).replace(/[.;\s]+$/, '');
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
  }
  const head = byMethod.size === 1
    ? (() => { const [[m, e]] = [...byMethod]; return `the ${m} method is not ready for ${e.pairs.join(', ')}: ${e.reasons.join('; ')}`; })()
    : `${byMethod.size} methods are not ready: ${[...byMethod].map(([m, e]) => `${m} (${e.pairs.join(', ')}): ${e.reasons.join('; ')}`).join('; ')}`;
  const lines = [
    `cannot start translating — ${head}.`,
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

  // Setup help from the first failing method (most actionable) — on a CI
  // runner, the repository secret instead of the shell advice (export,
  // .env.local), which is not the fix there.
  lines.push(...missingKeyAdvice({ reasons: failures.map(f => f.reason), setupHelp: failures[0].method.getSetupHelp() }));

  throw new Error(lines.join('\n'));
}

/**
 * Decide, after the plan, on the model servers that did not answer at
 * startup (resolveRuntime's deferredProbeFailures): a pair whose run sends
 * nothing to its method — every queued key from the cache, or nothing
 * queued, and no Markdown to send — does not need the server: warn that it
 * is down and that nothing needed it, and go on. A pair that sends something
 * stops the run as the preflight always did (a dry run says the real run
 * would stop). A fallback is needed when its pair's method sends anything
 * (it takes what that refuses). No estimate (it failed) = needed.
 *
 * @param {Array<object>} deferred - resolveRuntime's deferredProbeFailures
 * @param {{ costEstimate: object|null, contentByTarget: object, cliArgs: object }} plan
 * @returns {Array<{ pair: string, method: string, reason: string }>} the dry run's added preflight failures
 */
function resolveDeferredProbes(deferred, { costEstimate, contentByTarget, cliArgs }) {
  if (!deferred || deferred.length === 0) return [];
  // What the plan sends to the pair's method: key-value keys the cache does
  // not hold, and Markdown the cache does not hold.
  const sends = (f) => {
    if (!costEstimate) return true;
    const row = costEstimate.pairs.find(e => e.pair === f.pair);
    return (row?.keys || 0) > 0 || (contentByTarget[f.target]?.billedChars || 0) > 0;
  };
  const needed = deferred.filter(f => sends(f));
  // One line per server (method + where), naming its pairs.
  const byServer = new Map();
  for (const f of deferred.filter(x => !needed.includes(x))) {
    const method = f.pairConfig.method || 'llm';
    const where = f.endpoint ? `no server answers at ${f.endpoint}` : String(f.reason).replace(/[.;\s]+$/, '');
    const id = `${method}\x00${where}`;
    if (!byServer.has(id)) byServer.set(id, { method, where, pairs: [], cached: 0, held: 0 });
    const g = byServer.get(id);
    g.pairs.push(f.pairKey);
    const row = costEstimate?.pairs.find(e => e.pair === f.pair);
    g.cached += row?.tmHits || 0;
    g.held += row?.held || 0;
  }
  for (const g of byServer.values()) {
    const what = g.cached + g.held > 0
      ? `every key queued for ${g.pairs.length > 1 ? 'them' : 'it'} comes from the cache (${g.cached})${g.held ? ` or is held back (${g.held})` : ''}`
      : 'nothing is queued';
    output.warn(`${g.pairs.join(', ')} (method: ${g.method}): ${g.where} — this run does not need it: ${what}, `
      + 'so it goes on. Start the server before a run that translates.');
  }
  return stopForPreflight(needed, cliArgs);
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
function formatSyncSummary(dryRun, totalProcessed, totalFailed, totalCopied = 0, work = null, totalHeld = 0, { contentPending = false, pluralGaps = 0, pluralRepair = null, pluralMarked = false } = {}) {
  const verb = dryRun ? 'Would have processed' : 'Synced';
  const copied = totalCopied > 0 ? ` (+${totalCopied} copied verbatim, no-translate)` : '';
  // "2 key(s) sent to the model, 10 served from the cache (free)" — what was
  // asked for (and billed, by a paid method) versus reused.
  let split = '';
  if (work && work.known && totalProcessed > 0) {
    const retried = work.retried > 0 ? ` (+${work.retried} re-sent with the quality gate's feedback)` : '';
    split = dryRun
      ? ` — ${work.sent} would be sent to the model, ${work.cached} served from the cache (free)`
      : ` — ${work.sent} key(s) sent to the model${retried}, ${work.cached} served from the cache (free)`;
  }
  // A plural message written without a form the language uses for ordinary
  // counts (Russian `few`, filled with the "other" form) is not a finished
  // translation: never an [OK] line over it, and the run exits 2 (Round 8,
  // Django persona: exit 0 over two marked gaps).
  if (totalFailed > 0 || totalHeld > 0 || pluralGaps > 0) {
    const bad = [
      totalFailed > 0 && `${totalFailed} failed`,
      totalHeld > 0 && `${totalHeld} held back (refused before; not sent, not billed)`,
      pluralGaps > 0 && `${pluralGaps} plural message(s) lack a form the language uses for ordinary counts (the "other" form stands in — listed above)`,
    ].filter(Boolean).join(', ');
    const where = totalFailed > 0 || totalHeld > 0 ? ' (see summary below)' : '';
    // A re-sync with nothing to translate still says what it cost — nothing
    // — and why it exits 2 (Round 10, Django persona: the "nothing billed"
    // line disappeared whenever a marked plural gap kept the run at exit 2).
    let after = '';
    if (!dryRun && totalProcessed === 0) {
      after = ' Nothing was sent to a model and nothing was billed.';
      if (pluralGaps > 0 && totalFailed === 0 && totalHeld === 0) {
        after += ` The exit code is 2 because of ${pluralGaps === 1 ? 'that plural message' : 'those plural messages'}: `
          + `write the missing forms by hand${pluralMarked ? ' (and delete each "# champollion:" line)' : ''}, or ask again`
          + `${pluralRepair ? `: \`${pluralRepair}\`` : ' with the command listed above for each file'}.`;
      }
    }
    return { ok: false, message: `${verb} ${totalProcessed} key(s)${copied}${split}; ${bad}${where}.${after}` };
  }
  // Nothing queued: say what that costs, which is the point of a re-sync —
  // a dry run too (Round 8: it ended on a bare "Would have processed 0 keys
  // total"). With content files still to translate, only the keys are free.
  if (totalProcessed === 0) {
    if (contentPending) {
      return {
        ok: true,
        message: `${dryRun ? 'Would have processed' : 'Synced'} 0 keys total${copied} — every key ${dryRun ? 'is' : 'was'} already up to date `
          + `(no key ${dryRun ? 'would be' : 'was'} sent); the content files ${dryRun ? 'are previewed' : 'follow'} below.`,
      };
    }
    return dryRun
      ? { ok: true, message: `Would have processed 0 keys total${copied} — $0: nothing would be sent or billed.` }
      : { ok: true, message: `Synced 0 keys total${copied} — everything was already up to date; no model calls, nothing billed.` };
  }
  return { ok: true, message: `${verb} ${totalProcessed} keys total${copied}${split}.` };
}

/**
 * The price of sending some keys to several pairs, in the words of
 * lib/cost-label.js: "$0 API cost (runs on this machine)" when every pair
 * runs on this machine, else the sum of the known prices ("est. ~$0.0022"),
 * or "cost unknown" when any pair has no published price.
 *
 * @param {Array<[number, object]>} sends - [key count, pair config]
 * @param {{ cwd?: string }} [context]
 * @returns {Promise<string>}
 */
async function priceOfSends(sends, context = {}) {
  const estimates = [];
  for (const [n, pc] of sends) {
    if (n <= 0) continue;
    try { estimates.push(await estimateCost(n, pc, context)); } catch { estimates.push(null); }
  }
  if (estimates.length === 0) return costLabel({ estimatedCost: 0 });
  if (estimates.every(e => e?.local && e.estimatedCost === 0)) return costLabel(estimates[0]);
  if (estimates.some(e => !e || typeof e.estimatedCost !== 'number')) return costLabel({ estimatedCost: null });
  return costLabel({ estimatedCost: estimates.reduce((sum, e) => sum + e.estimatedCost, 0) });
}

/** "a", "b" and "c" — a short human list. */
function listWords(words) {
  const quoted = words.map(w => `"${w}"`);
  return quoted.length <= 1 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

/** "llm (model x)" — the method a refusal is remembered for, in words. */
/** Does this pair's method read per-key instructions (lib/methods/base.js)? */
function methodTakesInstructions(pairConfig) {
  try { return getMethod(pairConfig.method || 'llm', pairConfig).acceptsKeyInstructions === true; } catch { return false; }
}

/**
 * Say which plural messages lack forms the target language has — never a
 * silent fill (Round 3, Django persona: Russian few/many were written from
 * `other` and verify said "All checks passed").
 *
 *   everyday categories (Russian few for 2, 3, 4): a warning per file,
 *     naming the keys, what the file now holds instead, and the command
 *     that asks again (--fresh: the cache holds the incomplete answer).
 *   rare categories (French many: 1 000 000): one info line.
 *
 * @param {object} p
 * @param {Object<string, { everyday: string[], rare: string[], type: string }>} p.gaps
 */
function reportPluralGaps({ gaps, filename, format, pairKey, pairConfig, code, layout, ns }) {
  const entries = Object.entries(gaps || {});
  if (entries.length === 0) return;
  const name = pairConfig.name || code;
  const everyday = entries.filter(([, g]) => g.everyday.length > 0);
  if (everyday.length > 0) {
    const cats = [...new Set(everyday.flatMap(([, g]) => g.everyday))];
    const type = everyday[0][1].type;
    const shown = everyday.slice(0, 5).map(([k, g]) => `"${k}" (${g.everyday.join(', ')})`).join(', ');
    const more = everyday.length > 5 ? `, +${everyday.length - 5} more` : '';
    const instead = format === 'po'
      ? `those msgstr[] repeat the "other" form (marked with a "# champollion:" comment in ${filename})`
      : 'the app will show the "other" form for those counts';
    const asked = methodTakesInstructions(pairConfig)
      ? 'The model was asked for every form and left these out.'
      : `${pairConfig.method} cannot be told which plural forms to write.`;
    const fix = redoCommand(everyday.map(([k]) => k), { pair: pairKey, ns: layout.namespaced ? ns : '', fresh: true });
    output.warn(`${filename}: ${everyday.length} plural message(s) have ${describePluralGap(code, cats, type, name, 'everyday')}`
      + `: ${shown}${more} — ${instead}. ${asked} `
      + `Write them by hand, or ask again (a stronger --model helps): \`${fix}\``);
  }
  const rare = entries.filter(([, g]) => g.everyday.length === 0 && g.rare.length > 0);
  if (rare.length > 0) {
    const cats = [...new Set(rare.flatMap(([, g]) => g.rare))];
    const type = rare[0][1].type;
    output.info(`${filename}: ${rare.length} plural message(s) have ${describePluralGap(code, cats, type, name, 'rare')}`
      + `${format === 'po' ? ' (marked in the catalog)' : ''}.`);
  }
}

/**
 * Plural messages in the run's target files that still lack a form the
 * language uses for ordinary counts — read from disk once the run has
 * written. A gap the model left is held to the same rule as a held refusal:
 * every sync exits 2 while it is there, not only the sync that wrote it
 * (Round 9, Django persona: the first sync exited 2, a re-sync with the same
 * marked gap on disk exited 0). The same entries `audit` counts and
 * `verify --strict` fails on (lib/verify.js pluralGapsInFile).
 *
 * @returns {Map<string, Array<{ unit: object, file: object, gaps: Array<{ key: string, missing: string[], marked: boolean }> }>>}
 *   pair key → its files with gaps
 */
function pluralGapsOnDisk({ layout, units, inputLocale, pairEntries }) {
  const out = new Map();
  for (const [pairKey, pc] of pairEntries) {
    const code = pc.target;
    const files = [];
    for (const unit of units) {
      let file;
      try { file = layout.fileFor(code, unit.ns); } catch { continue; }
      if (!file || !fs.existsSync(file.path)) continue;
      let targetFlat;
      try { targetFlat = readLocaleFlat(file) || {}; } catch { continue; }
      let expected;
      try { expected = expectedForTarget(unit, inputLocale, code).flat; } catch { continue; }
      const gaps = pluralGapsInFile({ file, expected, targetFlat, locale: code });
      if (gaps.length > 0) files.push({ unit, file, gaps });
    }
    if (files.length > 0) out.set(pairKey, files);
  }
  return out;
}

/**
 * Say the plural gaps a run found on disk that it did not write itself (an
 * earlier sync did): per file, the keys, why the run is incomplete, and the
 * repair — never a silent exit 2.
 */
function reportPluralGapsOnDisk({ pairKey, code, file, unit, gaps, layout, dryRun }) {
  const shown = gaps.slice(0, 5).map(g => `"${String(g.key).replace(/\u0004/g, '\u2404')}" (${g.missing.join(', ')})`).join(', ')
    + (gaps.length > 5 ? `, +${gaps.length - 5} more` : '');
  const marked = gaps.some(g => g.marked);
  const fix = redoCommand(gaps.map(g => g.key), { pair: pairKey, ns: layout.namespaced ? unit.ns : '', fresh: true });
  output.warn(`${file.rel}: ${gaps.length} plural message(s) still lack a form ${code} uses for ordinary counts — `
    + `the "other" form stands in${marked ? ` (marked "# champollion:" in ${file.rel})` : ''}: ${shown}. `
    + `${dryRun ? 'A real sync exits 2' : 'Every sync exits 2'} while they remain, as for keys held back. `
    + `Write them by hand${marked ? ' and delete the "# champollion:" line above each entry' : ''}, `
    + `or ask again (a stronger --model helps): \`${fix}\`. A sync that runs another method or model asks for them again `
    + `by itself; \`champollion sync --pair ${shellWord(pairKey)} --redo gaps\` asks for every such message (add --model for a stronger one).`);
}

// -----------------------------------------------------------------
// Keys named for a redo (--redo keys: / --force-keys) that match nothing
// (the rule itself: lib/named-keys.js, shared with the Docusaurus path)
// -----------------------------------------------------------------

/**
 * This lane's key space for the named-key rule: every source key, and every
 * plural form a target gets (French `count_many`), namespaced as the lock
 * names them in a layout with several files.
 *
 * @returns {Set<string>}
 */
function namedKeySpace({ layout, units, inputLocale, targets }) {
  const known = new Set();
  for (const unit of units) {
    const keys = new Set(Object.keys(unit.flat));
    for (const code of targets) {
      try { for (const k of Object.keys(expectedForTarget(unit, inputLocale, code).flat)) keys.add(k); } catch { /* unknown locale */ }
    }
    for (const k of keys) known.add(layout.namespaced ? `${unit.ns}${NS_SEPARATOR}${k}` : k);
  }
  return known;
}

/** A named key without its file's namespace ("common::nav.home" → "nav.home"). */
function bareNamedKey(layout, k) {
  return layout.namespaced && k.includes(NS_SEPARATOR) ? k.slice(k.indexOf(NS_SEPARATOR) + NS_SEPARATOR.length) : k;
}

/** A pair config (and its fallback) carrying a gettext catalog's plural slots for the gate. */
function withPluralSlots(pairConfig, pluralSlots) {
  return {
    ...pairConfig,
    pluralSlots,
    ...(pairConfig.fallback && { fallback: { ...pairConfig.fallback, pluralSlots } }),
  };
}

/**
 * i18next plural categories the SOURCE does not have (French `_many` from
 * English, which has only one/other): each is translated from the source's
 * `_other` text. Say so, and whether the method could be told which form to
 * write — an LLM is asked for it; a machine translation engine just
 * translates the `_other` text again (Round 3, i18next persona).
 */
function reportGeneratedPluralKeys({ keys, expansion, filename, pairConfig, code, sourceLocale }) {
  // Generated = translated from a DIFFERENT source key (French count_many
  // from count_other). gettext/ARB notes ride an identity expansion with
  // no origin map, so they never count.
  const generated = keys.filter(k => expansion?.origin?.[k] && expansion.origin[k] !== k);
  if (generated.length === 0) return;
  const cats = [...new Set(generated.map(k => k.slice(k.lastIndexOf('_') + 1)))];
  const shown = generated.slice(0, 4).join(', ') + (generated.length > 4 ? `, +${generated.length - 4} more` : '');
  const name = pairConfig.name || code;
  if (methodTakesInstructions(pairConfig)) {
    output.info(`${filename}: ${shown} — ${listWords(cats)} ${cats.length === 1 ? 'is a' : 'are'} ${name} plural form(s) `
      + `the ${sourceLocale} source has no key for; each is translated from the "_other" text, and the model is asked to write that form `
      + `(${describeCategories(code, cats, 'cardinal')}).`);
  } else {
    output.warn(`${filename}: ${shown} — ${listWords(cats)} ${cats.length === 1 ? 'is a' : 'are'} ${name} plural form(s) `
      + `the ${sourceLocale} source has no key for, translated from the "_other" text by ${pairConfig.method}, which cannot be told `
      + 'which plural form to write: they hold the "other" form. Review them, or use an LLM method for this pair.');
  }
}

/**
 * The per-key notes the method is given beside the source text: gettext
 * msgctxt and `#.` comments, ARB descriptions, the plural form a generated
 * i18next key needs (lib/locale-layout.js expectedForTarget). ONE helper for
 * the real call and for `--show-prompt`.
 *
 * @param {string[]} keys
 * @param {object|null} expansion
 * @returns {object}
 */
function promptNotesFor(keys, expansion) {
  const notes = {};
  if (!expansion?.descriptions) return notes;
  for (const k of keys) {
    if (expansion.descriptions[k]) notes[k] = expansion.descriptions[k];
  }
  return notes;
}

/** A captured request, readable: the messages as text, the rest as JSON. */
function renderRequest(request) {
  const lines = [`       ${request.method} ${request.url}`, `       headers: ${JSON.stringify(request.headers)}`];
  const body = request.body;
  if (body && typeof body === 'object' && Array.isArray(body.messages)) {
    const { messages, system, ...rest } = body;
    lines.push(`       ${JSON.stringify(rest)}`);
    const blocks = [];
    if (typeof system === 'string') blocks.push(['system', system]);
    for (const m of messages) {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2);
      blocks.push([m.role, text]);
    }
    for (const [role, text] of blocks) {
      lines.push(`       ── ${role} ──`);
      for (const l of String(text).split('\n')) lines.push(`       ${l}`);
    }
  } else {
    for (const l of JSON.stringify(body, null, 2).split('\n')) lines.push(`       ${l}`);
  }
  return lines;
}

/**
 * `sync --dry --show-prompt [key]` for one file of one locale: build the
 * request through the method's own code (lib/translate-pair.js
 * previewRequests) and print it. Nothing is sent; secrets are redacted.
 * Without a key it shows the first request this file would send (a cache
 * miss); with a key, the request for that key alone, whether or not it is
 * queued — so `verb␄Open` shows whether its msgctxt reaches the model.
 */
async function showRequestPreview({ cliArgs, layout, unit, pairKey, pairConfig, code, filename, sourceFlat, expansion, apiKey, tm, queued, held = new Set(), noteShown = null, cwd = null }) {
  const named = typeof cliArgs['show-prompt'] === 'string' ? cliArgs['show-prompt'] : null;
  let keys;
  let why;
  if (named) {
    // The whole value as one key first: a gettext msgid is a sentence, and
    // its comma is not a list separator ("Welcome back, %(name)s!").
    const asOne = keysForNamespace(layout, [named], unit.ns).filter(k => typeof sourceFlat[k] === 'string');
    keys = asOne.length > 0 ? asOne
      : keysForNamespace(layout, splitKeyList(named), unit.ns).filter(k => typeof sourceFlat[k] === 'string');
    if (keys.length === 0) return;
    why = keys.length === 1 ? 'the key you named' : 'the keys you named';
    // A named key a real run would not send: shown anyway (that is what was
    // asked for), and said plainly — the preview printed nothing at all for a
    // key already translated (Round 6, Django persona).
    const queuedSet = new Set(queued);
    const tmKey = tmMethodKey(pairConfig);
    const notSent = [];
    for (const k of keys) {
      let reason = null;
      if (held.has(k)) reason = 'held back (the quality gate refused this method\'s translation of its current text before)';
      else if (!queuedSet.has(k)) reason = 'up to date (translated, and its source has not changed)';
      else if (peekTM(tm, tmTextFor(k, sourceFlat[k], expansion), code, tmKey) !== null) reason = 'served from the cache';
      if (reason) notSent.push([k, reason]);
    }
    if (notSent.length > 0) {
      const ns = layout.namespaced ? unit.ns : '';
      output.info(`${pairKey} ${filename}: a real run would send nothing for ${notSent.map(([k, r]) => `${JSON.stringify(k.replace(/\u0004/g, '\u2404'))} — ${r}`).join('; ')}. `
        + 'The request below is what re-translating it would send; '
        + `\`${redoCommand(notSent.map(([k]) => k), { pair: pairKey, ns, fresh: true })}\` sends it. Nothing is sent now.`);
    }
  } else {
    // What this file would send: queued, not held back, not in the cache.
    const tmKey = tmMethodKey(pairConfig);
    const texts = {};
    for (const k of queued) texts[k] = tmTextFor(k, sourceFlat[k], expansion);
    const misses = queued.filter(k => lookupTM(tm, texts[k], code, tmKey) === null);
    const batch = pairConfig.batchSize || DEFAULT_BATCH_SIZE;
    keys = misses.slice(0, batch);
    if (keys.length === 0) return;
    why = misses.length > batch
      ? `the first ${batch} of the ${misses.length} key(s) this file would send`
      : `the ${misses.length} key(s) this file would send`;
  }
  const { supported, requests } = await previewRequests(keys, sourceFlat, pairConfig, {
    apiKey, targetCode: code, descriptions: promptNotesFor(keys, expansion), cwd,
  });
  if (!supported) {
    output.info(`${pairKey} ${filename}: no request preview for ${pairConfig.method} — it is sent the source text of each key `
      + 'and nothing else (no per-key notes or context reach it).');
    return;
  }
  if (noteShown) noteShown();
  for (const request of requests) {
    output.event('request', { pair: pairKey, file: filename, keys, request });
  }
  const lines = ['', `     Request preview — ${pairKey}, ${filename}, ${why} (${keys.length}): what ${pairConfig.method} would be sent. Not sent; secrets redacted.`];
  if (requests.length === 0) lines.push('       (the method built no request for these keys)');
  for (const request of requests) lines.push(...renderRequest(request));
  lines.push('');
  output.raw(lines.join('\n'));
}

/**
 * Sync ONE target file: diff it against the source file it mirrors,
 * translate what is pending, write it back. A flat locale is one call; a
 * folder-per-locale project makes one call per namespace file.
 *
 * Returns the per-file tallies runSync aggregates per locale. `failedKeys`
 * are in the shared lock key space (namespaced for multi-file layouts) so
 * the manifest restore stays exact. `backendDown` tells the caller the
 * method returned nothing at all, so the locale's remaining files are not
 * attempted against a dead backend.
 *
 * @param {object} ctx - Run context: { config, layout, inputLocale, dryRun,
 *   cliArgs, apiKey, tm, noTranslate, pluralFallbackReported }
 * @param {import('./locale-layout.js').SourceUnit} unit - Source file
 * @param {string} pairKey
 * @param {object} pairConfig
 * @param {{ backendDown?: boolean, fallbackDown?: boolean }} [state] - An
 *   earlier file of this locale got nothing from the pair's method
 *   (backendDown) or from its fallback (fallbackDown). With a working
 *   fallback, a file after a dead primary goes straight to the fallback.
 * @returns {Promise<object>}
 */
async function syncLocaleFile(ctx, unit, pairKey, pairConfig, { backendDown = false, fallbackDown = false } = {}) {
  const { config, layout, inputLocale, dryRun, cliArgs, apiKey, tm, noTranslate } = ctx;
  const code = pairConfig.target;
  const file = layout.fileFor(code, unit.ns);
  const filename = file.rel;
  const filePath = file.path;
  const format = file.format;

  // What THIS target must contain for this file: the source map, or — for
  // a file with i18next plural keys — the target's own CLDR plural forms,
  // each mapped back to the source key it is translated from.
  const { flat: sourceFlat, expansion } = expectedForTarget(unit, inputLocale, code);
  if (expansion?.unknownLocale && !ctx.pluralFallbackReported.has(code)) {
    ctx.pluralFallbackReported.add(code);
    output.info(`${code}: CLDR has no plural rules for this locale — keeping the source's plural forms.`);
  }
  // Key in the shared space (lock manifest, dry-run lists). Failed keys map
  // back to the SOURCE key they came from, so a failed generated `_many`
  // keeps the old hash of the `_other` it is translated from.
  const toLock = (key) => lockKey(layout, unit.ns, originKey(key, expansion));
  // Display form of a target key (dry-run lists): namespaced, NOT mapped to
  // its origin — the list names the keys this file will actually receive.
  const nsKey = (key) => lockKey(layout, unit.ns, key);

  // Security: verify the resolved write path is still within localesDir.
  // Prevents path traversal via crafted language codes like "../../../etc/passwd".
  // A refusal means NO file was written — count it as a failure so the run
  // reports it and exits non-zero, instead of printing [OK] and exiting 0.
  if (!isPathContained(filePath, layout.baseDir)) {
    output.error(`${filename} — refusing to write outside locales directory`);
    // Nothing ran for this locale, so every changed key is unresolved here.
    // Only changed keys matter for manifest retry-safety: missing keys
    // re-fire via missing-key detection regardless of the manifest.
    return { processed: 0, tmHits: 0, failed: 1, failedKeys: unit.changedKeys.map(k => lockKey(layout, unit.ns, k)), pairKey };
  }

  // If locale file doesn't exist yet, create it as empty
  let data = {};
  const existed = fs.existsSync(filePath);
  if (existed) {
    data = readLocaleData(file);
  }

  // For JSON, flatten the nested structure. TOML/YAML is already flat.
  const targetFlat = format === 'json' ? flattenKeys(data) : { ...data };
  // Source-echo requeue suppression: a target value equal to its source is
  // only requeued when the TM does NOT confirm the echo came from the
  // pipeline. lookupTM === sourceValue means a previous run translated this
  // exact text to itself and the gate approved it — skip, don't re-bill.
  // With --no-tm the TM is empty, so nothing is suppressed.
  // The TM is consulted under the text the pipeline cached the key under —
  // a gettext entry with a msgctxt folds its context in (lib/tm-evict.js),
  // so "Open" the verb is confirmed by the verb's entry, not the adjective's.
  // With a fallback, a value may be cached under the fallback's key: the
  // confirmations below consult both (lib/fallback.js tmKeysForPair).
  const tmKeys = tmKeysForPair(pairConfig);
  // A borrowed i18next plural form (French `_many` from `_other`) has its
  // own entry (lib/tm-evict.js tmTextFor).
  const cachedAs = (key, sourceValue) => tmTextFor(key, sourceValue, expansion);

  // Plural forms this locale does not use (Japanese has no `_one`) that an
  // earlier, plural-unaware sync wrote. Removed ONLY when the TM proves the
  // pipeline produced the value on disk — a hand-written value is kept and
  // reported as an extra key, never deleted.
  const removedPlurals = [];
  if (expansion && expansion.unused.length > 0 && format === 'json') {
    for (const key of expansion.unused) {
      if (!Object.prototype.hasOwnProperty.call(targetFlat, key)) continue;
      const src = unit.flat[key];
      if (typeof src === 'string' && tmHoldsValue(tm, cachedAs(key, src), code, tmKeys, targetFlat[key])) {
        removedPlurals.push(key);
      }
    }
    for (const key of removedPlurals) {
      delete targetFlat[key];
      if (!dryRun) deleteNestedValue(data, key);
    }
    if (removedPlurals.length > 0) {
      output.info(`${filename} — ${dryRun ? 'would remove' : 'removed'} ${removedPlurals.length} plural form(s) ${code} does not use (written by an earlier sync): ${removedPlurals.join(', ')}`);
    }
  }

  // --prune plural-extras: i18next keys for a plural form this language does
  // not have (Spanish `count_two`), whoever wrote them — the keys `verify`
  // names, and only those (lib/plurals.js pluralExtraKeys). Never without
  // the flag: a value may be a person's (Round 13, i18next persona).
  const prunedPlurals = [];
  if (ctx.prune?.has('plural-extras')) {
    const extras = pluralExtraKeys(unit, targetFlat, code);
    for (const { key } of extras) {
      prunedPlurals.push(key);
      delete targetFlat[key];
      if (!dryRun) {
        if (format === 'json') deleteNestedValue(data, key);
        else delete data[key];
      }
    }
    if (extras.length > 0) {
      ctx.pruned.push(...extras.map(e => ({ locale: code, file: filename, key: nsKey(e.key), category: e.category })));
      output.info(`${filename} — ${dryRun ? 'would remove' : 'removed'} ${extras.length} plural key(s) for a form ${code} does not have `
        + `(CLDR ${code}: ${extras[0].cats.join(', ')}): ${extras.map(e => nsKey(e.key)).join(', ')} — --prune plural-extras removes these and nothing else.`);
    }
  }
  const removedAny = removedPlurals.length > 0 || prunedPlurals.length > 0;

  // Forced / changed keys arrive in the unit's source key space; plural
  // expansion maps them onto the target keys translated from them.
  //
  // PENDING keys (a redo that could not finish, lib/locale-state.js) are
  // queued again as forced keys; they are already in the target key space.
  const localeState = ctx.lockState.of(code);
  const pendingKeys = new Set(
    keysForNamespace(layout, Object.keys(localeState.pending), unit.ns)
      .filter(k => Object.prototype.hasOwnProperty.call(sourceFlat, k) && typeof sourceFlat[k] === 'string'),
  );
  const namedKeys = new Set(mapSourceKeysToTarget(keysForNamespace(layout, ctx.namedKeys, unit.ns), expansion));
  // Plural messages on disk a model left without a form the language uses
  // (the "other" form standing in, marked in a catalog): asked again when
  // this run's setup has not answered them yet, or under --redo gaps
  // (lib/plural-gap-redo.js — the estimate makes the same plan).
  const gapPlan = existed
    ? planGapRedo({ file, expected: sourceFlat, targetFlat, locale: code, localeState, lockKeyOf: nsKey, pairConfig, all: !!ctx.redoGaps })
    : { keys: [], gaps: [], by: {}, missing: {} };
  ctx.gapsSeen += gapPlan.gaps.length;
  // A gap record for a message that has none on disk any more (its forms
  // were written by hand): forgotten.
  if (!dryRun && localeState.gaps) {
    const open = new Set(gapPlan.gaps.map(g => nsKey(g.key)));
    for (const k of keysForNamespace(layout, Object.keys(localeState.gaps), unit.ns)) {
      if (!open.has(nsKey(k))) delete localeState.gaps[nsKey(k)];
    }
  }
  const forceKeys = [...new Set([
    ...mapSourceKeysToTarget(keysForNamespace(layout, config.forceKeys, unit.ns), expansion),
    ...pendingKeys,
    ...gapPlan.keys,
  ])];
  const changedKeys = mapSourceKeysToTarget(unit.changedKeys, expansion);
  const diff = diffLocale(
    sourceFlat, targetFlat, config.fallbackPrefix, forceKeys, changedKeys,
    (key, sourceValue) => tmHoldsValue(tm, cachedAs(key, sourceValue), code, tmKeys, sourceValue),
    noTranslate.active ? noTranslate.matches : null
  );

  // What the queue becomes once the per-locale record is consulted: hand
  // edits a bulk redo keeps, keys refused before (held back from the method
  // that refused them), pending keys retried from the model (shared with the
  // cost estimate — lib/locale-state.js planQueue).
  const plan = planQueue({
    diff, sourceFlat, targetFlat, lockKeyOf: nsKey, localeState,
    named: namedKeys, bulk: !!cliArgs.force, pending: pendingKeys, fresh: !!cliArgs['no-tm'], pairConfig,
    classify: createEditClassifier({ tm, locale: code, written: localeState.written, expansion }),
    fallbackPrefix: config.fallbackPrefix,
    redoGaps: ctx.redoGaps ? new Set(gapPlan.keys) : null,
  });
  const queue = plan.toProcess;
  const keptSet = new Set(plan.kept);
  const heldSet = new Set(plan.held);
  // The plural messages this run asks again: sent to the model, never served
  // from the cache — it holds the incomplete answer (a later model's
  // carry-over would serve it straight back).
  const gapAsked = gapPlan.keys.filter(k => queue.includes(k) && !heldSet.has(k));
  if (gapAsked.length > 0) {
    if (!dryRun) bypassTMFor(tm, code, gapAsked.map(k => cachedAs(k, sourceFlat[k])));
    const asked = ctx.gapsAsked.get(pairKey) || [];
    asked.push(...gapAsked.map(nsKey));
    ctx.gapsAsked.set(pairKey, asked);
    const writers = [...new Set(gapAsked.map(k => gapPlan.by[k]).filter(Boolean))].map(describeMethodKey);
    const forms = [...new Set(gapAsked.flatMap(k => gapPlan.missing[k] || []))];
    const shownKeys = gapAsked.slice(0, 3).map(k => JSON.stringify(nsKey(k).replace(/\u0004/g, '\u2404'))).join(', ')
      + (gapAsked.length > 3 ? `, +${gapAsked.length - 3} more` : '');
    const who = ctx.redoGaps
      ? '--redo gaps'
      : `${writers.join('; ') || 'an earlier setup'} left ${gapAsked.length === 1 ? 'it' : 'them'} so, and ${describeMethodKey(tmMethodKey(pairConfig))} has not been asked`;
    output.info(`${filename} — ${dryRun ? 'would ask' : 'asking'} the model again for ${gapAsked.length} plural message(s) without a form `
      + `${code} uses for ordinary counts (${forms.join(', ')}): ${shownKeys} (${who}). A marked gap is not a translation: it is sent `
      + `to the model, not served from the cache, which holds the incomplete answer${dryRun ? ' (the estimate above prices it)' : ''}. `
      + 'If the answer lacks the forms too, the gap stays marked.');
  }
  // Borrowed plural forms whose own cache entry does not exist yet while the
  // entry they used to share does (a cache from before this release): each
  // goes to the model once. Said, because the estimate prices it.
  if (expansion?.borrowed && queue.length > 0) {
    const pk = tmMethodKey(pairConfig);
    const firstOwn = queue.filter(k => expansion.borrowed[k] && !heldSet.has(k) && typeof sourceFlat[k] === 'string'
      && peekTM(tm, cachedAs(k, sourceFlat[k]), code, pk) === null
      && peekTM(tm, tmSourceText(k, sourceFlat[k]), code, pk) !== null);
    if (firstOwn.length > 0) {
      output.info(`${filename} — ${firstOwn.length} plural form(s) translated from another form's source text (${firstOwn.slice(0, 3).map(nsKey).join(', ')}`
        + `${firstOwn.length > 3 ? ', …' : ''}) ${dryRun ? 'would be' : 'are'} sent to the model once: until this release each shared a cache entry with `
        + 'the form it borrows from, which holds that form\'s translation, so it is not reused. From now on each form has its own entry.');
    }
  }
  const redoFor = (keys, opts = {}) => redoCommand(keys, { pair: pairKey, ns: layout.namespaced ? unit.ns : '', ...opts });
  /**
   * Keys NAMED for a redo that the cache answered: the model was not asked,
   * and a redo without --fresh said nothing about it — the persona's
   * `--redo keys:<k>` wrote back the text it already had (Round 7, Django).
   * Said, with the --fresh command and what it costs.
   */
  const reportNamedFromCache = async (keys, served = {}) => {
    if (keys.length === 0 || cliArgs['no-tm']) return;
    await sayNamedFromCache({
      filename, keys, shown: keys.map(nsKey), served, onDisk: targetFlat, pairConfig, cwd: ctx.cwd, dryRun,
      command: redoFor(keys, { fresh: true }),
    });
  };
  const sample = (keys, n = 3) => `${keys.slice(0, n).join(', ')}${keys.length > n ? `, +${keys.length - n} more` : ''}`;

  // Lock state for this file, applied once its outcome is known (never in a
  // dry run). `written` holds the values as they are now on disk.
  const settle = ({ written = {}, failed = [], refusedBy = {}, producedBy = {}, askedForms = {}, gapped = {} } = {}) => {
    if (dryRun) return;
    for (const [k, value] of Object.entries(written)) {
      const lk = nsKey(k);
      if (typeof sourceFlat[k] !== 'string' || value === undefined) continue;
      localeState.written[lk] = encodeWritten(sourceFlat[k], value);
      // A plural message answered without a form the language uses: the
      // setup that answered is remembered, so it is not asked again for this
      // text — another setup is (lib/plural-gap-redo.js). A complete answer
      // clears the record.
      if (gapped[k] && producedBy[k]) recordGap(localeState, lk, sourceFlat[k], producedBy[k]);
      else if (!gapped[k] && localeState.gaps) delete localeState.gaps[lk];
      // A borrowed plural form the model was asked for as that form this run:
      // recorded with its value's fingerprint (verify decides from it). A
      // record for an earlier answer stays only while it is still the value.
      if (askedForms[k]) {
        localeState.forms[lk] = encodeForm(askedForms[k], value);
      } else {
        const prior = decodeForm(localeState.forms[lk]);
        if (!prior || prior.value !== valueHash(value)) delete localeState.forms[lk];
      }
      // Which method key produced it (a verbatim copy: none).
      if (producedBy[k]) localeState.by[lk] = producedBy[k];
      else delete localeState.by[lk];
      delete localeState.pending[lk];
      delete localeState.refused[lk];
    }
    for (const k of plan.kept) delete localeState.pending[nsKey(k)];
    for (const k of failed) {
      const lk = nsKey(k);
      // Refused under an explicit redo: the redo promised one more try, so
      // the next plain sync gets it once (then it is held back).
      recordRefusal(localeState, lk, sourceFlat[k], refusedBy[k], { redo: plan.forcedByRedo.has(k) });
      // A redo that could not finish: remembered until it does.
      if (plan.forcedByRedo.has(k)) localeState.pending[lk] = ctx.redoLabel;
    }
  };
  // What happens to a key this run could not translate, on the next sync:
  // a key an explicit redo queued is PENDING (asked once more); a key the
  // gate refused otherwise is HELD BACK (not re-sent to the same method);
  // a key that got no usable answer is simply asked again.
  const fateOf = (k, refusedBy) => {
    if (plan.forcedByRedo.has(k)) return 'pending-retry';
    return (refusedBy[k] || []).length > 0 ? 'held' : 'retry';
  };

  /**
   * Keys whose value on disk an EARLIER model of this pair wrote (the lock's
   * `by` record, still matching the file): model → count. A plain sync after
   * a model switch translated nothing and said nothing about it — only
   * `status` did (Round 6, Next.js persona).
   */
  const otherModelText = () => {
    const current = tmMethodKey(pairConfig);
    const [m, , r, c] = current.split('|');
    let onDisk = targetFlat;
    if (!dryRun) { try { onDisk = readLocaleFlat(file) || targetFlat; } catch { onDisk = targetFlat; } }
    const counts = {};
    for (const k of Object.keys(sourceFlat)) {
      const lk = nsKey(k);
      const mk = localeState.by?.[lk];
      if (!mk || mk === current) continue;
      const parts = mk.split('|');
      if (parts.length !== 4 || parts[0] !== m || parts[2] !== r || parts[3] !== c) continue;
      const record = decodeWritten(localeState.written[lk]);
      const v = onDisk[k];
      if (!record || typeof v !== 'string' || record.value !== valueHash(v)) continue;
      const model = parts[1] || '(none)';
      counts[model] = (counts[model] || 0) + 1;
    }
    return counts;
  };

  /**
   * Keys whose value on disk another METHOD (or register, or coaching file)
   * of this pair wrote — the lock's `by` record, still matching the file —
   * method key → count. A change of method re-translates nothing on a plain
   * sync, and a dry run said "fully synced, 0 keys" with no word that the
   * files keep the other method's text (Round 7, Next.js persona). Values the
   * pair's own fallback wrote are its by design, never counted.
   */
  // A dry run of a redo (--redo all / keys:) re-translates what it forces:
  // those keys are not "left with the other method's text" — the preview
  // counts them as what the run would send (Round 8, Next.js persona: a dry
  // `--redo all` after a method change said "Nothing would change" and
  // recommended the very command being previewed).
  const otherMethodForced = {};
  const otherMethodText = () => {
    const current = tmMethodKey(pairConfig);
    const [m, , r, c] = current.split('|');
    const fbKey = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
    let onDisk = targetFlat;
    if (!dryRun) { try { onDisk = readLocaleFlat(file) || targetFlat; } catch { onDisk = targetFlat; } }
    const counts = {};
    for (const k of Object.keys(sourceFlat)) {
      const lk = nsKey(k);
      const mk = localeState.by?.[lk];
      if (!mk || mk === current || mk === fbKey) continue;
      const parts = mk.split('|');
      if (parts.length !== 4 || (parts[0] === m && parts[2] === r && parts[3] === c)) continue;
      const record = decodeWritten(localeState.written[lk]);
      const v = onDisk[k];
      if (!record || typeof v !== 'string' || record.value !== valueHash(v)) continue;
      if (dryRun && plan.forcedByRedo.has(k) && !heldSet.has(k)) {
        otherMethodForced[mk] = (otherMethodForced[mk] || 0) + 1;
        continue;
      }
      counts[mk] = (counts[mk] || 0) + 1;
    }
    return counts;
  };

  if (queue.length === 0 && diff.noTranslate.length === 0 && diff.extra.length === 0
      && !removedAny) {
    if (plan.kept.length > 0) reportKept();
    // `--dry --show-prompt <key>` for a key this file holds up to date: the
    // request is still shown, with why a real run would not send it.
    if (dryRun && typeof cliArgs['show-prompt'] === 'string') {
      await showRequestPreview({
        cliArgs, layout, unit, pairKey, pairConfig, code, filename, sourceFlat, expansion, apiKey, tm,
        queued: [], held: heldSet, noteShown: ctx.notePreviewShown, cwd: ctx.cwd,
      });
    }
    // A namespace file with nothing to translate (an empty source file)
    // still belongs in every locale's folder — i18next requests it, and a
    // 404 per page load is not "fully synced". Flat layouts keep their
    // historical behaviour: no file is written for an empty source.
    if (!existed && layout.namespaced && !dryRun) {
      writeLocaleData(file, data, unit.yamlStyle);
      output.ok(`${filename} — created (source file has no keys)`);
      return { processed: 0, tmHits: 0 };
    }
    settle();
    adoptRecords();
    if (plan.kept.length === 0) {
      // A plural form left out (Russian few/many, the "other" form standing
      // in — marked "# champollion:" in a .po) is not "fully synced": never
      // an [OK] line over it (Round 10, Django persona). The keys and the
      // repair are said once the run has read every file.
      let gaps = [];
      try { gaps = existed ? pluralGapsInFile({ file, expected: sourceFlat, targetFlat, locale: code }) : []; } catch { gaps = []; }
      const forms = gaps.reduce((n, g) => n + g.missing.length, 0);
      if (forms > 0) {
        output.warn(`${filename} — nothing to translate, but INCOMPLETE: ${forms} plural form(s) `
          + `${gaps.some(g => g.marked) ? 'marked "# champollion:"' : 'missing'} (the "other" form stands in; the repair is below)`);
      } else {
        output.ok(`${filename} — fully synced`);
      }
    }
    return {
      processed: 0, tmHits: 0, kept: plan.kept.length, keptKeys: plan.kept.map(nsKey),
      otherModels: otherModelText(), otherMethods: otherMethodText(), otherMethodsForced: otherMethodForced,
    };
  }

  /** "kept N hand-edited value(s)" — said whenever a bulk redo leaves a person's text. */
  function reportKept() {
    const unrecorded = plan.kept.filter(k => plan.keptUnrecorded.includes(k));
    const edited = plan.kept.filter(k => !plan.keptUnrecorded.includes(k));
    const parts = [];
    if (edited.length > 0) parts.push(`${edited.length} hand-edited value(s) (${sample(edited)})`);
    if (unrecorded.length > 0) {
      parts.push(`${unrecorded.length} value(s) Champollion has no record of writing — made by hand, by another tool, `
        + `or by an older version (${sample(unrecorded)})`);
    }
    output.info(`${filename} — ${dryRun ? 'would keep' : 'kept'} ${parts.join(' and ')}: a bulk redo never replaces a person's text. `
      + `\`${redoFor([plan.kept[0]])}\` replaces one (name each key to replace).`);
  }

  /**
   * First record of values this version never recorded, when the cache proves
   * they are Champollion's translation of the CURRENT source text (the
   * bootstrap rule — lib/locale-state.js). Unproven values stay unrecorded,
   * so a bulk redo keeps them.
   */
  function adoptRecords(skip = new Set()) {
    if (dryRun) return;
    for (const [k, src] of Object.entries(sourceFlat)) {
      if (typeof src !== 'string' || skip.has(k)) continue;
      const lk = nsKey(k);
      if (localeState.written[lk] !== undefined) continue;
      const v = targetFlat[k];
      if (typeof v !== 'string' || v.trim() === '' || v.startsWith(config.fallbackPrefix)) continue;
      if (tmProofTextsFor(k, src, expansion).some(t => tmTranslationsOf(tm, t, code).has(v))) {
        localeState.written[lk] = encodeWritten(src, v);
        // The writer, when exactly one cached method holds this text; with
        // several (identical answers from two models) it stays unknown.
        const writers = new Set(tmProofTextsFor(k, src, expansion).flatMap(t => tmMethodKeysHolding(tm, t, code, v)));
        if (writers.size === 1) localeState.by[lk] = [...writers][0];
      }
    }
  }

  let localeProcessed = 0;
  let localeTMHits = 0;
  let localeSent = 0;
  let localeRetried = 0;
  // Plural messages accepted without forms the language uses (key → forms).
  const localeGaps = {};
  let localeFailed = 0;
  let localeCopied = 0;
  let localeKeptWorkingScript = 0;
  // Key NAMES that failed in this locale — threaded back to the aggregator
  // so writeManifest can restore their OLD hashes. Persisting the NEW hash
  // for a failed key would mark it resolved and it would never be retried.
  const localeFailedKeys = [];
  // Per-key outcome of what was not translated: next-sync fate → keys.
  const fates = { retry: [], 'pending-retry': [], held: [] };
  let localeHeldKeys = [];
  // Held back THIS run (not sent): lock keys.
  const heldThisRun = [];
  const replacedNotes = [];
  // What the pair's fallback did for this file (null without a fallback),
  // and whether either method returned nothing at all — so the locale's
  // next files skip a dead primary even when the fallback saved this one.
  let fallbackReport = null;
  let primaryDown = false;
  let secondDown = false;

  // Counts for the per-file line: what is queued, minus the hand edits kept
  // and the keys held back (said on their own lines below).
  // (Plural messages asked again are said on their own line, above.)
  const hidden = new Set([...keptSet, ...heldSet, ...gapAsked]);
  const shown = hidden.size === 0 ? diff : Object.fromEntries(Object.entries(diff).map(([k, v]) => (
    [k, Array.isArray(v) && k !== 'noTranslate' && k !== 'extra' ? v.filter(x => !hidden.has(x)) : v])));
  // gettext entries flagged fuzzy (makemessages after a msgid change) read as
  // missing; they are named as fuzzy (lib/po.js poFuzzyKeys).
  const fuzzyKeys = format === 'po' && existed && shown.missing.length > 0
    ? (() => { const f = poFuzzyKeys(fs.readFileSync(filePath, 'utf-8')); return shown.missing.filter(k => f.has(k)); })()
    : [];
  if (queue.length > 0 || diff.noTranslate.length > 0) {
    const pendingPart = plan.pendingRetry.length > 0 ? ` (${plan.pendingRetry.length} pending from an unfinished redo)` : '';
    const label = diffLabel({ ...shown, fuzzy: fuzzyKeys, fuzzyVerb: dryRun ? 'would be re-translated' : 're-translating' });
    const parts = [
      label === 'fully synced' ? null : label,
      gapAsked.length > 0 && `${gapAsked.length} plural message(s) asked again`,
      plan.held.length > 0 && `${plan.held.length} held back`,
    ].filter(Boolean);
    const heldPart = parts.length > 0 ? parts.join(' + ') : label;
    output.info(`${filename} — ${heldPart}${pendingPart}`);
  }
  if (plan.kept.length > 0) reportKept();
  if (plan.pendingRetry.length > 0) {
    const reasons = [...new Set(plan.pendingRetry.map(k => localeState.pending[nsKey(k)]).filter(Boolean))];
    output.info(`${filename} — ${dryRun ? 'would retry' : 'retrying'} ${plan.pendingRetry.length} key(s) an earlier `
      + `\`${reasons.join('`, `') || '--redo'}\` could not finish (${sample(plan.pendingRetry)}): sent to the model again, not served from the cache.`);
  }
  if (!dryRun && plan.pendingAll.length > 0) bypassTMFor(tm, code, plan.pendingAll.map(k => cachedAs(k, sourceFlat[k])));
  if (plan.held.length > 0) {
    output.warn(describeHeldKeys({ filename, keys: plan.held, pairConfig, command: redoFor(plan.held) }));
  }
  if (plan.heldFromPrimary.length > 0) {
    output.info(describeFallbackOnlyKeys({ filename, keys: plan.heldFromPrimary, pairConfig }));
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
      else assignInOrder(data, key, sourceFlat[key]);
    }
    localeCopied = diff.noTranslate.length;
    const sampleNT = diff.noTranslate.slice(0, 3)
      .map(k => `${k} (${noTranslate.reason(k, sourceFlat[k])})`)
      .join(', ');
    const more = diff.noTranslate.length > 3 ? `, +${diff.noTranslate.length - 3} more` : '';
    output.info(`${filename} — ${dryRun ? 'would copy' : 'copied'} ${localeCopied} no-translate key(s) verbatim: ${sampleNT}${more}`);
  }

  /** The values on disk after a write, for the written-record (null if unreadable). */
  const rereadAfterWrite = () => {
    try { return readLocaleFlat(file) || {}; } catch { return null; }
  };
  /** Record what a write left on disk for `keys`. */
  const writtenValues = (keys) => {
    const onDisk = rereadAfterWrite();
    if (!onDisk) return {};
    const out = {};
    for (const k of keys) if (onDisk[k] !== undefined) out[k] = onDisk[k];
    return out;
  };

  // A whole-locale translation failure returns early and writes nothing, so
  // the verbatim copies above would be lost with it. They do not depend on
  // the backend, so flush them: a repair that is already computed and free
  // must not wait on an unrelated outage.
  const flushNoTranslateOnBail = () => {
    if (dryRun || diff.noTranslate.length === 0) return 0;
    try {
      writeLocaleData(file, data, unit.yamlStyle);
      return localeCopied;
    } catch (err) {
      output.error(`${filename} — failed to write no-translate copies: ${err.message}`);
      return 0;
    }
  };
  /** A whole-file failure: settle the lock (pending redo keys, refusals), then flush the copies. */
  const bail = (failedKeys, refusedBy = {}) => {
    const copied = flushNoTranslateOnBail();
    settle({ written: copied > 0 ? writtenValues(diff.noTranslate) : {}, failed: failedKeys, refusedBy });
    for (const k of failedKeys) fates[fateOf(k, refusedBy)].push(nsKey(k));
    return copied;
  };

  // The locale's shared-output index starts with what this file already
  // holds for keys this run leaves alone: a model repeating one memorized
  // sentence across syncs (a key added per sync) used to be caught by no run,
  // because each run's index started empty (Round 5, hospital persona). Only
  // the new answers are refused; verify names the written ones.
  {
    const queuedSet = new Set(queue);
    const seed = [];
    for (const [k, v] of Object.entries(targetFlat)) {
      if (typeof v !== 'string' || typeof sourceFlat[k] !== 'string' || queuedSet.has(k)) continue;
      seed.push(...sharedOutputItems(nsKey(k), sourceFlat[k], v));
    }
    if (seed.length > 0) ctx.sharedOutputsFor(code).add(seed);
  }

  // `--dry --show-prompt [key]`: the exact request the method would get —
  // for the named key (queued or not), else for what this file would send.
  if (dryRun && cliArgs['show-prompt']) {
    await showRequestPreview({
      cliArgs, layout, unit, pairKey, pairConfig, code, filename, sourceFlat, expansion, apiKey, tm,
      queued: queue.filter(k => typeof sourceFlat[k] === 'string' && !heldSet.has(k)), held: heldSet,
      noteShown: ctx.notePreviewShown, cwd: ctx.cwd,
    });
  }

  if (queue.length > 0) {
    if (dryRun) {
      // Dry-run does no API calls and writes nothing, but it must still
      // report what it WOULD process — otherwise the summary always reads
      // "Would have processed 0 keys total." even with pending work.
      // (Keys held back would not be sent: not counted.)
      localeProcessed += queue.length - plan.held.length;
      // Named keys the real run would serve from the cache (the same
      // partition the estimate makes — the pair's entry, then its fallback's).
      if (namedKeys.size > 0 && !cliArgs['no-tm']) {
        const keysToCheck = queue.filter(k => namedKeys.has(k) && typeof sourceFlat[k] === 'string' && !heldSet.has(k));
        const served = {};
        for (const k of keysToCheck) {
          for (const mk of tmKeys) {
            const v = peekTM(tm, cachedAs(k, sourceFlat[k]), code, mk);
            if (v !== null) { served[k] = v; break; }
          }
        }
        await reportNamedFromCache(Object.keys(served), served);
      }

      // --list-keys: NAME the queued keys, per reason. Counts alone made
      // investigating a surprise queue impossible without re-implementing
      // the diff by hand — integrity names damaged keys; a dry run must
      // name queued ones. (The --json summary always carries these lists
      // on dry runs; this is the human rendering.)
      if (cliArgs['list-keys']) {
        // One key, one reason (the label's own partition).
        const once = queueReasons(shown);
        const sections = [
          ['missing', once.missing.filter(k => !fuzzyKeys.includes(k))],
          ['fuzzy (source changed)', fuzzyKeys],
          ['[EN] fallback', once.needsTranslation],
          ['untranslated (unstamped echo)', once.untranslated],
          ['changed', once.changed],
          ['forced', once.forced.filter(k => !plan.pendingRetry.includes(k) && !gapAsked.includes(k))],
          ['asked again (a plural form left out)', gapAsked],
          ['pending (an unfinished redo)', plan.pendingRetry],
          ['held back (refused before)', plan.held],
          ['kept (a person\'s edit)', plan.kept],
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

      const stringKeys = queue.filter(k => typeof sourceFlat[k] === 'string');
      // An earlier file of this locale got NO results from the method (dead
      // key, outage): every further call would fail the same way. Count this
      // file's pending keys as failed (they retry next sync) and keep the
      // free verbatim copies — do not hammer the backend once per namespace.
      // With a working fallback the file goes straight to the fallback.
      const skipPrimary = backendDown && !!pairConfig.fallback && !fallbackDown;
      if (backendDown && !skipPrimary && stringKeys.length > 0) {
        output.error(`${filename} — not attempted: the translation method returned no results for an earlier file of ${code}.`);
        const copied = bail(queue);
        return { processed: 0, tmHits: 0, copied, failed: queue.length, failedKeys: queue.map(toLock), pairKey, backendDown: true, fallbackDown, fates };
      }
      let result = null;
      if (stringKeys.length > 0) {
        // Prompt context for generated plural categories (French `_many`
        // is translated from the English `_other` text).
        const pluralDescriptions = promptNotesFor(stringKeys, expansion);
        // Shared pipeline: TM partition → API call → quality gate → TM
        // store, then the pair's fallback (if any) for what that left
        // untranslated (lib/translate-pair.js translateWithFallback).
        // A gettext catalog holds only the plural forms its header has slots
        // for: the gate does not ask again for one it cannot write, and the
        // report does not call it missing (lib/po.js poPluralSlots).
        const pluralSlots = format === 'po'
          ? poPluralSlots(existed ? fs.readFileSync(filePath, 'utf-8') : null, code) : null;
        const runConfig = pluralSlots ? withPluralSlots(pairConfig, pluralSlots) : pairConfig;
        result = await translateWithFallback(stringKeys, sourceFlat, runConfig, pairKey, {
          apiKey, tm, targetCode: code, cwd: ctx.cwd,
          ...(Object.keys(pluralDescriptions).length > 0 && { descriptions: pluralDescriptions }),
          // Borrowed plural forms: cached under their own identity.
          ...(expansion?.borrowed && Object.keys(expansion.borrowed).length > 0 && { pluralForms: expansion.borrowed }),
          onProgress: (completed, total) => {
            output.progressBar(completed, total, { item: filename });
          },
          skipPrimary,
          budget: ctx.fallbackBudget || null,
          noSendPrimary: new Set([...plan.held, ...plan.heldFromPrimary]),
          noSendFallback: heldSet,
          sharedOutputs: ctx.sharedOutputsFor(code),
        });
        translated = result.translated;
        fallbackReport = result.fallback;
        // Named as the run names keys (with the file's namespace).
        if (fallbackReport && Array.isArray(fallbackReport.produced)) fallbackReport.produced = fallbackReport.produced.map(nsKey);
        localeHeldKeys = result.heldKeys || [];
        if (pairConfig.fallback) {
          primaryDown = !!result.apiReturnedNull;
          secondDown = !!result.fallbackReturnedNull;
        }
        localeTMHits += result.tmHitCount;
        localeSent += result.sentCount || 0;
        localeRetried += result.retriedCount || 0;
        for (const [k, g] of Object.entries(result.pluralGaps || {})) {
          if (g.everyday.length > 0) localeGaps[nsKey(k)] = g.everyday;
        }
        if ((result.sentKeys || []).length > 0) ctx.noteCacheScope(pairKey, pairConfig, code, result.sentKeys.map(k => cachedAs(k, sourceFlat[k])));

        // Plural forms: generated i18next categories, and plural messages
        // that lack forms the target language has (never a silent fill).
        // Only forms actually sent: a cache hit was not "asked" anything.
        reportGeneratedPluralKeys({ keys: result.sentKeys || [], expansion, filename, pairConfig, code, sourceLocale: inputLocale });
        if (namedKeys.size > 0 && translated) {
          const answered = new Set(result.answeredKeys || []);
          await reportNamedFromCache(stringKeys.filter(k => namedKeys.has(k) && k in translated && !answered.has(k)), translated);
        }
        if (translated) {
          reportPluralGaps({ gaps: result.pluralGaps, filename, format, pairKey, pairConfig, code, layout, ns: unit.ns });
        }

        // Terminology enforcement: check the glossary terms were applied —
        // for every method (the glossary is loaded per pair above).
        const glossary = pairConfig.coachingData?.dictionary || pairConfig.glossary;
        if (translated && glossary) {
          const { violations } = verifyTerminology(translated, sourceFlat, glossary);
          if (violations.length > 0) {
            logTermViolations(violations, pairKey);
          }
        }

        const heldHere = new Set(localeHeldKeys);
        const notDone = stringKeys.filter(k => !(translated && k in translated));
        const refusedHere = notDone.filter(k => (result.refusedBy?.[k] || []).length > 0);
        const heldNow = notDone.filter(k => heldHere.has(k));
        const noAnswer = notDone.filter(k => !heldHere.has(k) && !refusedHere.includes(k));
        if (translated) {
          // Never [OK] for a file with keys left untranslated (Round 4,
          // Next.js persona: "fr.json [OK]" over 3 refused keys).
          // Nor over a plural form the translation left out (Round 10,
          // Django persona: "ru/LC_MESSAGES/django.po [OK]" over two forms
          // marked "# champollion:") — the warning above names them.
          const gapForms = Object.values(result.pluralGaps || {}).reduce((n, g) => n + (g.everyday?.length || 0), 0);
          const gapNote = gapForms > 0
            ? `${gapForms} plural form(s) ${format === 'po' ? 'marked "# champollion:"' : 'missing — the "other" form stands in'}`
            : null;
          if (notDone.length === 0) {
            output.progressDone(filename, gapNote ? `[INCOMPLETE: ${gapNote}]` : '[OK]');
          } else {
            const why = [
              refusedHere.length > 0 && `${refusedHere.length} refused by the quality gate`,
              heldNow.length > 0 && `${heldNow.length} held back`,
              noAnswer.length > 0 && `${noAnswer.length} not returned by the method`,
            ].filter(Boolean).join(', ');
            output.progressDone(filename, `[WARN] ${notDone.length} of ${stringKeys.length} key(s) not translated (${why})${gapNote ? `; ${gapNote}` : ''}`);
          }
        } else if (result.apiReturnedNull) {
          // Method returned null — fail loud with actionable guidance.
          // (When the primary was skipped, its help was printed for the
          // earlier file that found it down.)
          output.progressDone(filename, '[ERR]');
          if (!skipPrimary) {
            output.error(`${pairKey}: Translation method "${pairConfig.method}" returned no results.`);
            const methodInstance = getMethod(pairConfig.method, pairConfig);
            for (const line of await methodSetupAdvice(methodInstance, { apiKey, cwd: ctx.cwd })) {
              output.error(line);
            }
          }
          const fbDown = !!pairConfig.fallback && !!result.fallbackReturnedNull;
          if (fbDown) {
            output.error(`${pairKey}: the fallback method "${pairConfig.fallback.method}" returned no results either.`);
            for (const line of await methodSetupAdvice(getMethod(pairConfig.fallback.method, pairConfig.fallback), { apiKey, cwd: ctx.cwd })) {
              output.error(line);
            }
          }
          // Whole file failed: every pending key must re-fire next sync, and
          // the locale's remaining files are not attempted (backendDown).
          const copied = bail(queue, result.refusedBy || {});
          return { processed: 0, tmHits: localeTMHits, sent: localeSent, retried: localeRetried, copied, failed: queue.length, failedKeys: queue.map(toLock), pairKey, backendDown: true, fallbackDown: fbDown, fallback: fallbackReport, fates };
        } else if (heldNow.length === stringKeys.length) {
          // Everything queued was held back: nothing was asked, nothing failed anew.
          output.progressDone(filename, `[WARN] ${heldNow.length} key(s) held back, not translated`);
          for (const k of heldNow) fates.held.push(nsKey(k));
          localeFailedKeys.push(...heldNow.map(toLock));
          const copied = flushNoTranslateOnBail();
          settle({ written: copied > 0 ? writtenValues(diff.noTranslate) : {} });
          adoptRecords(new Set([...queue, ...diff.noTranslate]));
          return {
            processed: 0, tmHits: localeTMHits, sent: 0, retried: 0, copied, failed: 0,
            failedKeys: localeFailedKeys, held: heldNow.length, heldKeys: heldNow.map(nsKey), kept: plan.kept.length,
            keptKeys: plan.kept.map(nsKey), fates, pairKey, fallback: fallbackReport,
          };
        } else if (result.failures.length > 0 && !translated) {
          // All translations failed quality gate — fail loud
          output.progressDone(filename, '[ERR] all translations failed quality gate');
          output.error(`${pairKey}: All translations were rejected by the quality gate${pairConfig.fallback ? ` (and by its fallback, ${pairConfig.fallback.method})` : ''}.`);
          output.error('Check your method configuration or review the gate failures above.');
          const failedNow = queue.filter(k => !heldHere.has(k));
          const copied = bail(failedNow, result.refusedBy || {});
          for (const k of heldNow) fates.held.push(nsKey(k));
          return { processed: 0, tmHits: localeTMHits, sent: localeSent, retried: localeRetried, copied, failed: failedNow.length, held: heldNow.length, heldKeys: heldNow.map(nsKey), failedKeys: queue.map(toLock), pairKey, fallback: fallbackReport, fates };
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

      const writtenKeys = [];
      const heldHere = new Set(localeHeldKeys);
      for (const key of queue) {
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
          // Not translated (gate refusal, no answer, or held back) — skip
          // it, never write garbage. Its old manifest hash is restored so a
          // changed source is still detected; what the next sync does with
          // it is said here and in the summary (lib/locale-state.js).
          localeFailedKeys.push(toLock(key));
          if (heldHere.has(key)) {
            heldThisRun.push(nsKey(key));
            fates.held.push(nsKey(key));
            continue;
          }
          localeFailed++;
          const fate = fateOf(key, result?.refusedBy || {});
          fates[fate].push(nsKey(key));
          output.warn(`${pairKey}: key "${key}" ${keyFateNote(fate, pairConfig)}`);
          continue;
        } else {
          value = sourceValue;
        }

        // A new plural form lands beside its siblings in CLDR order (both
        // helpers), never after `_other` (Round 10, i18next persona).
        if (format === 'json') {
          setNestedValue(data, key, value);
        } else {
          assignInOrder(data, key, value);
        }
        writtenKeys.push(key);
      }

      // A question or exclamation that lost its "?" / "!" (Round 6, hospital
      // persona): a warning — some languages use a particle instead.
      const droppedMarks = droppedTerminalMarks(writtenKeys
        .filter(k => translated && k in translated && !isProtectedTermValue(translated[k], config.protectedTerms))
        .map(k => [k, sourceFlat[k], translated[k]]));
      if (droppedMarks.length > 0) {
        output.warn(`${filename}: ${describeDroppedMarks(droppedMarks, redoFor(droppedMarks.map(f => f.key), { fresh: true }))}`);
      }

      // Held-back keys were never sent: not counted as processed.
      localeProcessed += queue.length - heldThisRun.length;

      // Hand edits this run replaces (their source changed, or the key was
      // named): printed, and recorded once the file is written.
      const writtenSet = new Set(writtenKeys);
      for (const r of plan.replacing) {
        if (!writtenSet.has(r.key)) continue;
        replacedNotes.push(r);
      }

      // Write updated file (see below), then settle the lock.
      if (diff.toProcess.length > 0 || diff.noTranslate.length > 0 || removedAny) {
        try {
          writeLocaleData(file, data, unit.yamlStyle);
        } catch (err) {
          output.error(`${filename} — failed to write: ${err.message}`);
          // Everything we attempted for this locale is unwritten → all failed.
          // That includes the verbatim copies: they were staged in memory only.
          settle({ failed: queue, refusedBy: result?.refusedBy || {} });
          return {
            processed: 0,
            tmHits: localeTMHits,
            sent: localeSent,
            retried: localeRetried,
            copied: 0,
            failed: queue.length,
            failedKeys: queue.map(toLock),
            pairKey,
            fallback: fallbackReport,
          };
        }
      }
      const failedNow = queue.filter(k => typeof sourceFlat[k] === 'string' && !writtenSet.has(k) && !heldHere.has(k));
      // Borrowed plural forms this run's method was asked for AS that form
      // (its own answer, not a cache hit; a method that reads instructions —
      // a machine-translation engine is only given the "_other" text).
      const askedForms = {};
      if (expansion?.borrowed && result?.answeredKeys) {
        const fbKey = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
        for (const k of result.answeredKeys) {
          const form = expansion.borrowed[k];
          if (!form || !writtenSet.has(k)) continue;
          const byFallback = fbKey !== null && result.producedBy?.[k] === fbKey;
          if (methodTakesInstructions(byFallback ? pairConfig.fallback : pairConfig)) askedForms[k] = form;
        }
      }
      settle({
        written: writtenValues([...writtenKeys, ...diff.noTranslate]),
        failed: failedNow,
        refusedBy: result?.refusedBy || {},
        producedBy: result?.producedBy || {},
        askedForms,
        gapped: Object.fromEntries(Object.entries(result?.pluralGaps || {}).filter(([, g]) => g.everyday?.length > 0).map(([k]) => [k, true])),
      });
      adoptRecords(new Set([...queue, ...diff.noTranslate]));
      for (const r of replacedNotes) {
        const why = r.why === 'named' ? 'it was named for a redo' : 'its source text changed (the edit was for the old text)';
        output.warn(`${filename}: "${r.key}" — replaced ${r.unrecorded ? 'a value Champollion had no record of writing' : 'a hand-edited translation'} because ${why}. `
          + `The edited wording, to re-apply if it still fits: ${JSON.stringify(r.value)} (kept in ${REPLACED_EDITS_FILENAME})`);
        ctx.replacedEdits.push({
          locale: code, file: filename, key: nsKey(r.key), editedValue: r.value,
          why: r.why === 'named' ? 'named for a redo' : 'source changed', newSource: sourceFlat[r.key],
          ...(r.unrecorded && { note: 'no written-record (made by hand, by another tool, or by an older version)' }),
        });
      }
    }
  }

  if (diff.extra.length > 0) {
    // Plural keys for a form the language does not have are named, with the
    // flag that removes exactly them (Round 13, i18next persona).
    const pluralExtras = pluralExtraKeys(unit, targetFlat, code).map(e => e.key);
    output.warn(`${filename} — ${diff.extra.length} extra key(s) not in source`
      + (pluralExtras.length > 0
        ? ` (${pluralExtras.length} for a plural form ${code} does not have: ${pluralExtras.slice(0, 3).map(nsKey).join(', ')}${pluralExtras.length > 3 ? ', …' : ''} — `
          + `\`champollion sync --pair ${shellWord(pairKey)} --prune plural-extras\` removes ${pluralExtras.length === 1 ? 'it' : 'them'})`
        : ''));
  }

  // Only no-translate copies or plural cleanup (nothing queued to translate):
  // write and settle here. CRITICAL: isolate the write per-locale. If one
  // locale file is unwritable (read-only, a full disk, a locked file), a
  // thrown error must not reject the whole pMap and discard every SIBLING
  // locale's already-paid translations: count this locale's keys as failed
  // and let the other locales write.
  if (!dryRun && queue.length === 0 && (diff.noTranslate.length > 0 || removedAny)) {
    try {
      writeLocaleData(file, data, unit.yamlStyle);
    } catch (err) {
      output.error(`${filename} — failed to write: ${err.message}`);
      return { processed: 0, tmHits: 0, copied: 0, failed: 0, failedKeys: [], pairKey };
    }
    settle({ written: writtenValues(diff.noTranslate) });
    adoptRecords(new Set(diff.noTranslate));
  } else if (!dryRun && queue.length === 0) {
    settle();
    adoptRecords();
  }

  return {
    processed: localeProcessed,
    tmHits: localeTMHits,
    sent: localeSent,
    retried: localeRetried,
    otherModels: otherModelText(),
    otherMethods: otherMethodText(),
    otherMethodsForced: otherMethodForced,
    pluralGaps: localeGaps,
    copied: localeCopied,
    keptWorkingScript: localeKeptWorkingScript,
    failed: localeFailed,
    failedKeys: localeFailedKeys,
    held: heldThisRun.length,
    heldKeys: heldThisRun,
    kept: plan.kept.length,
    keptKeys: plan.kept.map(nsKey),
    replaced: replacedNotes.length,
    fates,
    pairKey,
    fallback: fallbackReport,
    ...(primaryDown && { backendDown: true }),
    ...(secondDown && { fallbackDown: true }),
    // Dry runs carry the NAMES of queued keys per reason, so agents can
    // read the plan from the --json summary instead of re-deriving the
    // diff. Omitted on real runs — per-key outcomes are reported there.
    ...(dryRun && {
      queuedKeys: {
        missing: queueReasons(shown).missing.map(nsKey),
        fallback: queueReasons(shown).needsTranslation.map(nsKey),
        untranslated: queueReasons(shown).untranslated.map(nsKey),
        changed: queueReasons(shown).changed.map(nsKey),
        forced: queueReasons(shown).forced.filter(k => !plan.pendingRetry.includes(k) && !gapAsked.includes(k)).map(nsKey),
        gaps: gapAsked.map(nsKey),
        noTranslate: diff.noTranslate.map(nsKey),
        pending: plan.pendingRetry.map(nsKey),
        held: plan.held.map(nsKey),
        kept: plan.kept.map(nsKey),
      },
    }),
  };
}

/**
 * The cache key each pair has as the config FILE sets it — without this
 * run's --method / --model — or null when neither flag was given.
 *
 * A CI job that runs `sync --method llm --model X` over a project whose
 * config names a local model has not changed the project's setup: the files
 * keep what the configured setup wrote, by design. Every such run printed,
 * per language, that the files were "written by local, not by llm" and
 * offered a paid `--redo all` (Round 12, Django persona). Text the configured
 * setup wrote is said once, quietly, as kept; a real change of the config
 * keeps its full note.
 *
 * Resolved exactly as the runtime resolves pairs (resolvePairs + plugins),
 * from the values resolveConfig recorded before the flags applied.
 *
 * @returns {Map<string, string>|null} pairKey → tmMethodKey
 */
function configuredPairKeys(config, cwd, cliArgs) {
  if (!cliArgs.method && !cliArgs.model) return null;
  const own = {
    ...config,
    defaultMethod: config._fileDefaultMethod ?? config.defaultMethod,
    model: config._fileModel,
    _modelExplicit: !!config._fileModelExplicit,
  };
  delete own._methodOverride;
  delete own._modelOverride;
  if (!own.resolvedLanguages || Object.keys(own.resolvedLanguages).length === 0) {
    own.resolvedLanguages = autoDetectLanguages(own);
  }
  try {
    const plugins = loadPlugins(cwd);
    const keys = new Map();
    for (const [pairKey, raw] of resolvePairs(own, { cwd })) keys.set(pairKey, tmMethodKey(resolvePluginForPair(plugins, raw)));
    return keys;
  } catch {
    // Unresolvable without the flags: every note stays the full one.
    return null;
  }
}

/** "local · model m1": the part of a cache key --method / --model change. */
function flagSetupOf(methodKey) {
  const [method, model] = String(methodKey).split('|');
  return model ? `${method || 'llm'} · model ${model}` : (method || 'llm');
}

/**
 * The exit code a real run would end with, from what a dry run knows
 * (lib/commands/sync.js computeExitCode has the real rules):
 *   1 — the preflight would stop it (a key or a model server it needs), or a
 *       key named for a redo matches nothing;
 *   2 — --max-cost would stop it before any API call, keys are held back
 *       (refused before), or plural messages on disk lack a form the
 *       language uses and this run does not ask for them again;
 *   0 — none of those. A refusal by the quality gate or a failed
 *       verification, which only the real run can find, can still make it 2.
 *
 * @returns {{ exitCode: 0|1|2, wouldStop: boolean, reasons: string[] }}
 */
function predictRealRun({ preflightFailures, dryMaxCost, unmatched, pluralGaps, gapsAskedAgain, costEstimate }) {
  const reasons = [];
  if (preflightFailures.length > 0) {
    reasons.push(`it would stop before translating: ${preflightStopReason(preflightFailures)}`);
    return { exitCode: 1, wouldStop: true, reasons };
  }
  if (unmatched > 0) {
    reasons.push(`${unmatched} key(s) named for a redo match nothing`);
    return { exitCode: 1, wouldStop: false, reasons };
  }
  if (dryMaxCost?.wouldStop) {
    // With the figures: a CI log that prints this reason says how far over.
    const est = typeof dryMaxCost.estimatedCost === 'number' ? `~$${dryMaxCost.estimatedCost.toFixed(4)}` : 'unknown';
    reasons.push(`--max-cost would stop it before any API call (${String(dryMaxCost.reason || 'over the cap').replace(/\.$/, '')}: `
      + `estimate ${est}, cap $${Number(dryMaxCost.cap).toFixed(4)})`);
    return { exitCode: 2, wouldStop: true, reasons };
  }
  const held = (costEstimate?.pairs || []).reduce((n, p) => n + (p.held || 0), 0);
  if (held > 0) reasons.push(`${held} key(s) held back — refused before, not sent again`);
  if (pluralGaps > 0) {
    reasons.push(`${pluralGaps} plural message(s) on disk lack a form the language uses for ordinary counts, and this run does not ask for them again`);
  }
  if (reasons.length === 0 && gapsAskedAgain > 0) {
    // Asked again: 0 when the model now supplies the forms, 2 when it does not.
    return { exitCode: 0, wouldStop: false, reasons: [`${gapsAskedAgain} plural message(s) are asked for again — the real run exits 2 if the answer lacks the forms too`] };
  }
  return { exitCode: reasons.length > 0 ? 2 : 0, wouldStop: false, reasons };
}

/**
 * The line before the per-locale work: what the run is about to do. It
 * said "Translating 2 locale(s) with concurrency 50" on a dry run and on a
 * run with nothing to send, which reads as model calls about to happen
 * (Round 14, Next.js persona). "Translating" is said only when the
 * estimate shows something will be sent — and of how many locales; a dry
 * run and a run that sends nothing say they are checking. With no estimate
 * (it failed) what will be sent is not known, and the line says so.
 *
 * @param {{ dryRun: boolean, pairEntries: Array<[string, object]>, costEstimate: object|null,
 *   contentByTarget: Record<string, { billedChars?: number }>, concurrency: number }} args
 * @returns {string}
 */
function describeLocaleWork({ dryRun, pairEntries, costEstimate, contentByTarget, concurrency }) {
  const n = pairEntries.length;
  if (dryRun) return `Checking ${n} locale(s) — a dry run: nothing is sent to a model, nothing is written`;
  if (!costEstimate) return `Translating up to ${n} locale(s) with concurrency ${concurrency} (no estimate: what is sent is not known in advance)`;
  const keysFor = new Map((costEstimate.pairs || []).map(p => [p.pair, p.keys || 0]));
  const sending = pairEntries.filter(([pairKey, pc]) => (keysFor.get(pairKey) || 0) > 0
    || (contentByTarget?.[pc.target]?.billedChars || 0) > 0).length;
  if (sending === 0) return `Checking ${n} locale(s) — nothing to send to a model this run`;
  return sending === n
    ? `Translating ${n} locale(s) with concurrency ${concurrency}`
    : `Translating ${sending} of ${n} locale(s) with concurrency ${concurrency} (the other ${n - sending}: nothing to send)`;
}

/** What `--prune` may remove (lib/plurals.js pluralExtraKeys). */
const PRUNE_SCOPES = ['plural-extras'];

/**
 * --prune values → the set of removals asked for. Unknown values fail loud
 * (a typo must not read as "nothing to prune").
 *
 * @param {string[]|string|boolean|undefined} raw
 * @returns {Set<string>}
 */
function parsePrune(raw) {
  const out = new Set();
  if (raw === undefined) return out;
  const values = [].concat(raw);
  if (values.some(v => typeof v !== 'string' || v.trim() === '')) {
    throw new Error(`--prune needs what to remove: ${PRUNE_SCOPES.join(' | ')} (e.g. --prune plural-extras).`);
  }
  for (const v of values.flatMap(x => x.split(',')).map(x => x.trim()).filter(Boolean)) {
    if (!PRUNE_SCOPES.includes(v)) {
      throw new Error(`--prune ${v}: unknown. Use --prune plural-extras (removes i18next plural keys for forms a language does not have — nothing else).`);
    }
    out.add(v);
  }
  return out;
}

/**
 * Run the main sync operation.
 *
 * @param {object} options - { dryRun, audit, cwd, cliArgs }
 */
async function runSync(options = {}) {
  const { dryRun = false, audit = false, cwd = process.cwd(), cliArgs = {} } = options;
  const config = resolveConfig(cliArgs, cwd);

  // --show-prompt: shows the request a real run would send, so only in a
  // dry run (which sends nothing). A bare flag before another flag is read by
  // the argument parser as its value ("--show-prompt --dry"): say so.
  if (cliArgs['show-prompt']) {
    if (typeof cliArgs['show-prompt'] === 'string' && cliArgs['show-prompt'].startsWith('--')) {
      throw new Error(`--show-prompt took "${cliArgs['show-prompt']}" as the key to show. Put --show-prompt last, `
        + 'or give it a key: sync --dry --show-prompt <key>.');
    }
    if (!dryRun) {
      throw new Error('--show-prompt shows the request a run would send, without sending it: add --dry '
        + '(sync --dry --show-prompt [key]).');
    }
  }

  // --max-cost: parse eagerly so a malformed cap fails loud up front,
  // before anything (even read-only work) happens.
  const maxCost = parseMaxCost(cliArgs['max-cost']);
  // --prune <what>: removals a run makes only when asked; --redo gaps: the
  // plural messages a model left incomplete, asked again. Both act on
  // key-value locale files (i18next plural keys, ICU and gettext plurals).
  const prune = parsePrune(cliArgs.prune);
  const redoGaps = !!cliArgs['redo-gaps'];
  if (config.format === 'docusaurus' && (prune.size > 0 || redoGaps)) {
    throw new Error(`${redoGaps ? '--redo gaps' : '--prune plural-extras'} acts on plural messages in key-value locale files `
      + '(i18next plural keys, ICU and gettext plurals); a Docusaurus project\'s translation files have none. Nothing was changed.');
  }

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

  // Verify locales directory exists. The hint names what `init` would find
  // on disk (messages/en.json, public/locales/en/…) — a project that never
  // ran init otherwise gets only "not found" for the default ./locales.
  if (!fs.existsSync(config.localesDir)) {
    const { describeLocaleSetupHint } = await import('./commands/init.js');
    const hint = describeLocaleSetupHint(cwd, config.inputLocale);
    throw new Error(
      `Locales directory not found: ${config.localesDir}. `
      + (hint || 'Create it or set "localesDir" in your config file (`champollion init` detects common layouts).'),
    );
  }

  // --- Version banner ---
  const require = createRequire(import.meta.url);
  const { version } = require('../package.json');
  output.banner(version);

  // Locale layout — WHERE every locale's files are (lib/locale-layout.js):
  // flat <dir>/<code>.<ext>, dir <dir>/<code>/<ns>.<ext>, or a configured
  // localesPattern. The format rides on each file's REAL extension, so a
  // `.yml` project writes `.yml`. CLI flag beats config beats detection.
  const layout = discoverLocaleLayout(config, { cwd });
  const isAutoFormat = config.format === 'auto';
  const format = layout.format;
  output.info(`Detected format: ${format} (${isAutoFormat ? 'auto' : 'config'})`);
  if (layout.kind !== 'flat') {
    output.info(`Locale layout: ${layout.kind} — ${layout.display}`);
  }
  for (const rel of layout.ignored) {
    output.warn(`Ignoring ${rel} — the source locale's files are ${format}; this file is a different format and is not synced.`);
  }

  // Content directory (Docusaurus was dispatched above). Hugo is named only
  // on real Hugo evidence (lib/content.js detectContentSite) — a plain folder
  // of Markdown is a Markdown folder. The naming rule is the same for both.
  if (config.contentDir) {
    const site = detectContentSite(config.contentDir, cwd);
    const shownDir = path.relative(cwd, config.contentDir) || '.';
    if (site.site === 'hugo') {
      output.info(`Detected framework: Hugo (${site.evidence})`);
      output.info(`Content directory: ${shownDir} — each translation is written beside its source as <name>.<locale>.md (Hugo's translation-by-filename)`);
    } else {
      output.info(`Content directory: ${shownDir} — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md`);
    }
  }

  const inputLocale = config.inputLocale;
  // One unit per source file (flat layouts: exactly one). Each carries its
  // flat map (JSON flattened, unsafe keys removed), YAML style and i18next
  // plural groups. Throws "Source locale not found: …" when missing.
  const units = loadSourceUnits(layout);
  // "en.json" for one file; "en/ (3 files, …)" for a folder of namespaces.
  const sourceLabel = (keyCount) => (layout.namespaced
    ? `${layout.kind === 'dir' ? `${inputLocale}/` : layout.display} (${units.length} file(s), ${keyCount} keys)`
    : `${units[0].file.rel} (${keyCount} keys)`);

  // The source in the SHARED key space: bare keys for single-file layouts
  // (so a flat project's lock file is exactly what it was), `<ns>::<key>`
  // for namespaced ones — two files may both define "title".
  const sourceLock = {};
  for (const unit of units) {
    for (const [key, value] of Object.entries(unit.flat)) {
      sourceLock[lockKey(layout, unit.ns, key)] = value;
    }
  }
  const sourceKeyCount = Object.keys(sourceLock).length;

  const pluralFiles = units.filter(u => u.pluralGroups.size > 0);
  if (pluralFiles.length > 0) {
    const groupCount = pluralFiles.reduce((n, u) => n + u.pluralGroups.size, 0);
    // What that means for THIS run's targets, read from CLDR (never a fixed
    // example: "French adds _many" was printed for a Spanish-only project).
    const targets = new Set(Object.keys(config.resolvedLanguages || {}));
    for (const k of Object.keys(config.pairs || {})) { const t = parsePairKey(k).target; if (t) targets.add(t); }
    const changes = describePluralFormChanges(inputLocale, [...targets]);
    output.info(`i18next plural keys: ${groupCount} group(s) — each locale gets its own CLDR plural forms${changes ? `: ${changes}` : ''}.`);
  }

  // Keys named for a redo must exist: a name that matches nothing fails the
  // run (exit 1) with the closest keys, instead of a silent "0 keys". With
  // some names matching, those are redone and the run then fails naming the
  // rest; with none, nothing runs (lib/named-keys.js — the Docusaurus path
  // applies the same rule).
  const unmatchedNamed = applyNamedKeyRule({
    cliArgs, config,
    known: () => {
      const targets = new Set(Object.keys(config.resolvedLanguages || {}));
      for (const k of Object.keys(config.pairs || {})) { const t = parsePairKey(k).target; if (t) targets.add(t); }
      return namedKeySpace({ layout, units, inputLocale, targets: [...targets] });
    },
    bare: (k) => bareNamedKey(layout, k),
    bareMatches: layout.namespaced,
  });

  // --force: re-queue EVERY string key — the whole-locale rebuild verb.
  // Recovering from a bad version is exactly when someone needs this, and
  // the only prior route was deleting the locale file by hand. Scope with
  // --pair; combine with --no-tm when the cache itself is suspect (TM hits
  // are still gate-checked and poisoned entries evicted, but --no-tm forces
  // a fully fresh re-bill). Set BEFORE the cost estimator so the preview
  // prices the full rebuild, and --max-cost can cap it.
  if (cliArgs.force) {
    config.forceKeys = Object.keys(sourceLock).filter(k => typeof sourceLock[k] === 'string');
    output.info(`${cliArgs.redo ? '--redo all' : '--force'}: re-queuing all ${config.forceKeys.length} source key(s)${cliArgs.pair ? ' for the selected pair(s)' : ''}`);
  }

  // Load the hash manifest and detect which English values changed
  // since the last sync. On first run (no manifest), this returns []
  // and everything flows through the normal missing-key detection.
  const lock = readLock(cwd);
  const oldManifest = lock.source;
  // Per-locale record (lib/locale-state.js): written values, pending redo
  // keys, refusals. Mutated by the run; written with the manifest.
  const lockState = new LockState(lock.locales);
  // No lock, but translations already on disk (a fresh clone of a repo that
  // never committed it, or a deleted lock): sync cannot tell which of them
  // are out of date, so it fills missing keys and keeps every existing
  // translation as it is. That used to happen in silence — say so once.
  if (!fs.existsSync(path.join(cwd, LOCK_FILENAME))) {
    const translated = [];
    for (const code of Object.keys(config.resolvedLanguages || {})) {
      for (const unit of units) {
        let file;
        try { file = layout.fileFor(code, unit.ns); } catch { continue; }
        if (!file || !fs.existsSync(file.path)) continue;
        try {
          if (Object.keys(readLocaleFlat(file) || {}).length > 0) translated.push(file.rel);
        } catch { /* unreadable targets are reported where they are synced */ }
      }
    }
    if (translated.length > 0) {
      output.warn(`No ${LOCK_FILENAME}, but ${translated.length} target file(s) already hold translations `
        + `(${translated.slice(0, 3).join(', ')}${translated.length > 3 ? ', …' : ''}). Without it, sync cannot tell `
        + 'which of them are out of date: it fills missing keys and keeps the rest as they are. If the source '
        + 'changed since they were made, run `champollion sync --redo all` once (cached translations are free), '
        + `then commit ${LOCK_FILENAME}.`);
    }
  }
  const changedKeys = detectChangedKeys(sourceLock, oldManifest);
  const currentManifest = buildHashManifest(sourceLock);
  // Each unit diffs in its own (un-namespaced) key space.
  for (const unit of units) {
    unit.changedKeys = keysForNamespace(layout, changedKeys, unit.ns);
  }

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
  // deferUnreachable: a model server that does not answer is judged after
  // the plan below (resolveDeferredProbes) — a run that sends it nothing
  // does not need it.
  const runtime = await resolveRuntime(config, cwd, { ...cliArgs, dryRun, audit, deferUnreachable: true });
  const { apiKey, resolvedPairs, pairEntries, deferredProbeFailures } = runtime;
  let { preflightFailures } = runtime;

  // Provenance check — warn about uncleared licensing before sync starts.
  // This is informational only (does not block execution).
  // Fallback methods translate too, so their licensing is audited the same way.
  const auditedRoutes = new Map(resolvedPairs);
  for (const [key, pc] of resolvedPairs) {
    if (pc.fallback) auditedRoutes.set(`${key} (fallback)`, pc.fallback);
  }
  const provenanceAudit = auditProvenance(auditedRoutes);
  // A project's first sync has no lock file yet: that is when the
  // "runs a model you choose" fact is news. After that it repeated on every
  // run (Round 3, Next.js persona); `status` and `provenance` keep saying it.
  const firstSync = !fs.existsSync(path.join(cwd, LOCK_FILENAME));
  if (!provenanceAudit.allClear) {
    for (const blockedKey of provenanceAudit.blockedPairs) {
      const blockedPair = auditedRoutes.get(blockedKey);
      // A model the user runs themselves (local server, own api endpoint,
      // external plugin): its licence is theirs to know, not ours to verify.
      // That is a fact to state once, not a warning on every run (Round 2).
      if (['local', 'api', 'external'].includes(blockedPair.method)) {
        if (firstSync) {
          output.info(`${blockedKey}: "${blockedPair.method}" runs a model you choose — Champollion cannot check its licence; `
            + 'make sure your use of it is allowed. (Said once; `champollion status` repeats it.)');
        }
      } else {
        output.warn(`${blockedKey}: Method "${blockedPair.method}" has unverified licensing. Run \`champollion provenance\` for details.`);
      }
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
    let gapTotal = 0;
    const pairKeyOf = (code) => (pairEntries.find(([, pc]) => pc.target === code) || [`${inputLocale}:${code}`])[0];
    const shownKeyName = (k) => String(k).replace(/\u0004/g, '\u2404');
    const auditLocales = [];
    const missingLocales = [];
    for (const [, pairConfig] of pairEntries) {
      const code = pairConfig.target;
      for (const unit of units) {
        const file = layout.fileFor(code, unit.ns);
        const filename = file.rel;
        if (!fs.existsSync(file.path)) {
          // A configured locale with NO file is 100% untranslated, not "fully
          // translated". Skipping it silently let an audit wired as a CI gate
          // pass with zero translation done — every source key counts as
          // untranslated and the run must exit non-zero.
          const expectedKeys = Object.keys(expectedForTarget(unit, inputLocale, code).flat);
          if (expectedKeys.length > 0) {
            missingLocales.push(filename);
            auditLocales.push({
              locale: code,
              file: filename,
              missing: true,
              untranslatedCount: expectedKeys.length,
              untranslatedKeys: expectedKeys.map(k => lockKey(layout, unit.ns, k)),
            });
            output.error(`${filename}: locale file missing — all ${expectedKeys.length} key(s) untranslated. Run \`champollion sync\` to create it.`);
            total += expectedKeys.length;
          }
          continue;
        }
        const flat = readLocaleFlat(file);
        // Untranslated = an [EN] fallback, OR a key the target should have
        // but does not (absent, or empty — an empty msgstr, a new msgid).
        // Only fallbacks used to count, so an audit wired as the CI gate
        // passed catalogs with keys missing (synthetic review, 2026-10-03).
        const expected = expectedForTarget(unit, inputLocale, code).flat;
        const fallbacks = Object.entries(flat)
          .filter(([, val]) => typeof val === 'string' && val.startsWith(config.fallbackPrefix));
        const absent = Object.keys(expected)
          .filter((k) => !(k in flat) || (typeof flat[k] === 'string' && flat[k].trim() === ''))
          .map((k) => [k, flat[k]]);
        const untranslated = [...fallbacks, ...absent];
        // Plural messages without a form the language uses for ordinary
        // counts — what `verify --strict` fails on — are not "fully
        // translated" either (Round 7, Django persona).
        const gone = new Set(untranslated.map(([k]) => k));
        const gaps = pluralGapsInFile({ file, expected, targetFlat: flat, locale: code }).filter(g => !gone.has(g.key));
        auditLocales.push({
          locale: code,
          file: filename,
          untranslatedCount: untranslated.length,
          untranslatedKeys: untranslated.map(([key]) => lockKey(layout, unit.ns, key)),
          ...(gaps.length > 0 && {
            pluralGapCount: gaps.length,
            pluralGaps: gaps.map(g => ({ key: lockKey(layout, unit.ns, g.key), missing: g.missing })),
          }),
        });
        if (untranslated.length > 0) {
          output.raw(`  ${filename}: ${untranslated.length} keys still need translation`);
          for (const [key] of untranslated) {
            output.raw(`     - ${key}`);
          }
          total += untranslated.length;
        }
        if (gaps.length > 0) {
          output.raw(`  ${filename}: ${gaps.length} plural message(s) without a form ${code} uses for ordinary counts — the "other" form is shown instead`);
          for (const g of gaps) output.raw(`     - ${shownKeyName(lockKey(layout, unit.ns, g.key))} (${g.missing.join(', ')})`);
          const marked = gaps.some(g => g.marked) ? ` (or write the forms by hand and delete the "# champollion:" line above each entry)` : '';
          output.raw(`     Repair: \`${redoCommand(gaps.map(g => g.key), { pair: pairKeyOf(code), ns: layout.namespaced ? unit.ns : '', fresh: true })}\`${marked}`);
          gapTotal += gaps.length;
        }
      }
    }
    // OUT OF DATE: a translation made from an older source text than the
    // current one (the lock's record — lib/locale-state.js). The file holds a
    // value, so the checks above pass it, but it says what the source USED
    // to say: a source edit whose re-translation failed left exactly this,
    // and audit used to call the locale "fully translated" (Round 4,
    // i18next persona).
    const tmForProof = loadTM(cwd);
    let staleTotal = 0;
    for (const [pairKey, pairConfig] of pairEntries) {
      const health = localeHealth({
        layout, units, inputLocale, code: pairConfig.target, localeState: lockState.peek(pairConfig.target),
        manifest: oldManifest, tm: tmForProof, pairConfig,
        helpers: { expectedForTarget, readLocaleFlat, lockKey, originKey, fallbackPrefix: config.fallbackPrefix },
      });
      if (health.stale.length === 0) continue;
      staleTotal += health.stale.length;
      const entry = auditLocales.find(l => l.locale === pairConfig.target && !l.missing);
      if (entry) entry.outOfDateKeys = [...(entry.outOfDateKeys || []), ...health.stale];
      else auditLocales.push({ locale: pairConfig.target, untranslatedCount: 0, untranslatedKeys: [], outOfDateKeys: health.stale });
      const heldStale = health.stale.filter(k => health.held.includes(k));
      output.raw(`  ${pairConfig.target}: ${health.stale.length} translation(s) out of date — made from an older source text`);
      for (const key of health.stale) output.raw(`     - ${key}`);
      output.raw(`     Repair: \`champollion sync --pair ${pairKey}\` re-translates them`
        + (heldStale.length > 0
          ? `; ${heldStale.length} of them were refused before and are held back — name them: \`${redoCommand(heldStale.slice(0, 8), { pair: pairKey })}\``
          : '.'));
    }
    const gapPart = gapTotal > 0 ? `, ${gapTotal} plural message(s) missing everyday forms` : '';
    if (missingLocales.length > 0) {
      output.raw(`\n  Total: ${total} keys need translation${gapPart} (${missingLocales.length} locale file(s) missing: ${missingLocales.join(', ')}).`);
    } else {
      output.raw(total === 0 && staleTotal === 0 && gapTotal === 0
        ? '\n  All locale files are fully translated and up to date.'
        : `\n  Total: ${total} keys need translation${staleTotal > 0 ? `, ${staleTotal} translation(s) out of date` : ''}${gapPart}.`);
    }
    // Machine-readable end-of-command summary — in --json mode the raw lines
    // above are suppressed, so the key list must ride the summary object.
    output.summary({
      command: 'audit',
      untranslatedCount: total,
      outOfDateCount: staleTotal,
      pluralGapCount: gapTotal,
      missingLocales,
      locales: auditLocales,
    });
    return { untranslatedCount: total, outOfDateCount: staleTotal, pluralGapCount: gapTotal, missingLocaleCount: missingLocales.length };
  }

  // --- Sync mode ---
  const methodSummary = pairEntries
    .map(([, p]) => `${p.target}:${p.method}${p.fallback ? ` (fallback: ${p.fallback.method})` : ''}`)
    .join(', ');
  output.info(`Source: ${sourceLabel(sourceKeyCount)}`);
  output.info(`Pairs: ${methodSummary}`);
  // --model / --method name the model or method for THIS run; the file is
  // not changed, and the next plain sync uses what it says (Round 10,
  // Next.js persona: the help called --model an "override" without saying
  // for how long, and the next sync then named the run's model as another).
  {
    const file = cliArgs.config ? path.basename(String(cliArgs.config)) : 'champollion.config.json';
    const oneRun = [];
    const fields = [];
    if (config._modelOverride && config._modelOverride !== config._fileModel) {
      oneRun.push(`--model ${config._modelOverride} (the config says ${config._fileModel ? `"model": "${config._fileModel}"` : 'no "model": each method uses its default'})`);
      fields.push('"model"');
    }
    if (config._methodOverride && config._methodOverride !== (config._fileDefaultMethod || 'llm')) {
      oneRun.push(`--method ${config._methodOverride} (the config says "defaultMethod": "${config._fileDefaultMethod || 'llm'}")`);
      fields.push('"defaultMethod"');
    }
    if (oneRun.length > 0) {
      output.info(`${oneRun.join(' and ')}: for this run only — ${file} is not changed, and a plain \`champollion sync\` uses it again. `
        + `To switch for good, edit ${fields.join(' and ')} in ${file}.`);
    }
  }
  // Named when there are few; otherwise the flag that names them (Round 9,
  // Next.js persona: "Changed: 1 key(s)" named nothing, and nothing said
  // that --list-keys would).
  if (changedKeys.length > 0) {
    const shownKeys = changedKeys.map(k => String(k).replace(/\u0004/g, '\u2404'));
    if (changedKeys.length <= 5) {
      output.info(`Changed: ${changedKeys.length} key(s) have updated source content: ${shownKeys.join(', ')}`);
    } else {
      const how = dryRun
        ? (cliArgs['list-keys'] ? 'each file lists its queued keys below' : 'add --list-keys to name every queued key')
        : '`champollion sync --dry --list-keys` names every queued key';
      output.info(`Changed: ${changedKeys.length} key(s) have updated source content (${shownKeys.slice(0, 3).join(', ')}, …) — ${how}`);
    }
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
  // --fresh (alias --no-tm): nothing is served from the cache, so every
  // queued key goes to the API and the estimator prices it — but the results
  // ARE stored, so the cache holds what this run paid for (lib/tm.js
  // setTMReads). It used to be a throwaway empty TM: a fresh re-translation
  // was never cached, and a later --redo served the older text again.
  const noTM = cliArgs['no-tm'] || false;
  const tm = loadTM(cwd);
  if (noTM) setTMReads(tm, false);
  const tmInitialSize = tmSize(tm);
  if (noTM) {
    output.info(`Translation Memory: not read this run (${cliArgs.fresh ? '--fresh' : '--no-tm'}) — everything queued is translated and billed, and the results are cached`);
  } else if (tmInitialSize > 0) {
    output.info(`Translation Memory: ${tmInitialSize} cached entries loaded`);
  }
  // Model carry-over (lib/tm.js) is on unless --fresh-on-model-change.
  const freshOnModelChange = !!cliArgs['fresh-on-model-change'];
  if (freshOnModelChange) setModelCarryover(tm, false);
  // Entries a pair (or its fallback) made before its coaching was part of
  // the cache key, with the coaching it has NOW: recorded so they are still
  // served, and the lock's writers read as today's key — an upgrade neither
  // re-translates nor reports "another coaching" (lib/tm.js
  // adoptLegacyCoachingKeys). A coaching the old version never sent (a
  // fallback's own coachingFile) gets no record: that is a change.
  adoptLegacyCoachingKeys(tm, resolvedPairs.values());
  for (const pc of resolvedPairs.values()) {
    const by = lockState.peek(pc.target).by || {};
    for (const [lk, mk] of Object.entries(by)) by[lk] = canonicalWriterKey(tm, pc.target, mk);
  }
  // A cache written before borrowed i18next plural forms had their own entry:
  // an entry that holds a borrowed form's text moves to that form's entry,
  // before the estimate prices anything (lib/tm-evict.js). A dry run does
  // it in memory only (the cache is not saved).
  for (const unit of units) {
    if (!unit.pluralGroups || unit.pluralGroups.size === 0) continue;
    for (const [, pc] of pairEntries) {
      const { expansion } = expectedForTarget(unit, inputLocale, pc.target);
      if (!expansion?.borrowed || Object.keys(expansion.borrowed).length === 0) continue;
      let file;
      try { file = layout.fileFor(pc.target, unit.ns); } catch { continue; }
      if (!file || !fs.existsSync(file.path)) continue;
      let targetFlat;
      try { targetFlat = readLocaleFlat(file); } catch { continue; }
      const moved = splitSharedPluralEntries(tm, { expansion, targetFlat, locale: pc.target });
      if (moved.length > 0) {
        output.info(`${file.rel}: ${moved.length} cached translation(s) of a plural form (${moved.slice(0, 3).join(', ')}${moved.length > 3 ? ', …' : ''}) `
          + 'were stored under the form they are translated from — until this release the two shared one cache entry. '
          + `Moved to their own entry${dryRun ? ' (in this dry run only)' : ''}; the form they borrow from (_other) is translated again the next time it is queued, `
          + 'instead of being served the wrong form.');
      }
    }
  }
  // Keys NAMED for a redo (--redo keys: / --force-keys), apart from a bulk
  // --redo all: a named key replaces even a person's edit (lib/locale-state.js).
  const namedKeys = cliArgs.force ? splitKeyList(cliArgs['force-keys'] || '') : (config.forceKeys || []);
  // The texts the current source strings are cached under: the notice
  // counts only translations the run could actually reuse. (A project with
  // a contentDir also caches Markdown blocks in the same TM; those texts are
  // not listed here, so its notice keeps counting every entry.)
  const currentSourceTexts = config.contentDir ? null : [];
  for (const unit of currentSourceTexts ? units : []) {
    for (const [key, value] of Object.entries(unit.flat)) {
      if (typeof value === 'string') currentSourceTexts.push(tmSourceText(key, value));
    }
    // Borrowed plural forms are cached under their own text (tmTextFor).
    if (unit.pluralGroups && unit.pluralGroups.size > 0) {
      for (const [, pc] of pairEntries) {
        const { flat, expansion } = expectedForTarget(unit, inputLocale, pc.target);
        for (const k of Object.keys(expansion?.borrowed || {})) currentSourceTexts.push(tmTextFor(k, flat[k], expansion));
      }
    }
  }
  // --fresh-on-model-change: said before the estimate (it changes what is
  // billed). The carry-over notice waits for the estimate: it is said only
  // when this run actually serves keys from the previous model's cache.
  let tmModelSwitch = noTM || !freshOnModelChange ? [] : warnModelSwitchStrandedTM(tm, resolvedPairs.values(), {
    fresh: true, redoAll: !!cliArgs.force, sourceTexts: currentSourceTexts,
  });

  // --- Pre-sync cost estimation ---
  // Runs for EVERY engine (each method implements estimateCost, or honestly
  // reports "unknown"). Without --max-cost this stays non-blocking: failures
  // log a warning and the sync continues. With --max-cost the estimate is a
  // GATE: over-cap or unknowable estimates abort before any API call.
  // --files / --retranslate scope the CONTENT files (lib/file-scope.js).
  // Resolved before the estimate so a pattern that matches nothing fails
  // here, before anything is spent, and so the estimate prices exactly the
  // scoped work.
  // A pattern matches the path sync prints (relative to the contentDir) and
  // the path from the project root ("newsletter/2026-10.md").
  const fileScope = compileFileScope(cliArgs, {
    rootPrefix: config.contentDir ? path.relative(cwd, config.contentDir).split(path.sep).join('/') : '',
  });
  if (fileScope) {
    if (!config.contentDir) {
      throw new Error('--files / --retranslate select content files, but this project has no contentDir.');
    }
    for (const p of discoverContentFiles(config.contentDir, inputLocale)) {
      fileScope.includes(path.relative(config.contentDir, p));
    }
    fileScope.assertAllMatched();
  }
  const forceContent = !!cliArgs['force-content'];

  // Said once per locale: why what goes to the model did not come from the
  // cache after a method change (the run as it sends; a dry run up front).
  const cacheScopeNoted = new Set();
  const noteCacheScope = (pairKey, pairConfig, code, sentTexts) => {
    if (noTM || cacheScopeNoted.has(code)) return;
    // Each text once (primary and fallback sends overlap), and never the
    // pair's own fallback: its entries are this run's, not "another method's"
    // (a pair with a fallback reported 6 of 7 keys as cached elsewhere).
    const texts = [...new Set(sentTexts)];
    const fallbackKey = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
    // A key from before coaching was keyed is named as the setup it was
    // (lib/tm.js canonicalWriterKey) — its coaching included.
    const others = findOtherMethodEntries(tm, pairConfig, texts)
      .map(o => ({ ...o, methodKey: canonicalWriterKey(tm, code, o.methodKey) }))
      .filter(o => o.methodKey !== fallbackKey && o.methodKey !== tmMethodKey(pairConfig));
    if (others.length === 0) return;
    cacheScopeNoted.add(code);
    const held = others.reduce((n, o) => Math.max(n, o.count), 0);
    output.info(`${pairKey}: ${held} of the ${texts.length} key(s) ${dryRun ? 'a real run would send' : 'sent'} to the model have translations in the cache from `
      + `${others.slice(0, 2).map(o => describeMethodKey(o.methodKey)).join('; ')} — not reused: the cache is kept per method, `
      + 'register and coaching, so a change of method (or register, or coaching file) translates again. '
      + '(A change of model alone reuses earlier translations — model carry-over — unless --fresh-on-model-change.)');
  };

  // Per pair: the texts the run would send, and the keys it would serve
  // from an earlier model's translations (cost-report.js options.collect).
  const estimateDetail = {};
  // Per target: the Markdown the run would send (cost-report.js collectContent).
  const contentByTarget = {};
  // Model carry-over: said BEFORE the estimate's figure, only when this run
  // serves keys from the previous model's cache. A project with Markdown
  // pages also caches their blocks, which the key estimate does not
  // partition: while pages are pending, the notice counts what the cache
  // holds, as before.
  let carryoverSaid = false;
  const sayCarryover = (content) => {
    carryoverSaid = true;
    if (noTM || freshOnModelChange) return;
    const contentPending = (content?.pendingTranslations || 0) > 0;
    const served = {};
    for (const d of Object.values(estimateDetail)) served[d.target] = d.carriedFrom;
    tmModelSwitch = warnModelSwitchStrandedTM(tm, resolvedPairs.values(), {
      sourceTexts: currentSourceTexts, served: contentPending || content === undefined ? null : served,
    });
  };
  const costEstimate = await printCostEstimate(
    pairEntries, units[0].flat, config, format, units[0].file.ext, changedKeys,
    {
      cwd, tm, noTranslate, fileScope, forceContent, layout, units,
      lockState, redo: { named: namedKeys, bulk: !!cliArgs.force, fresh: noTM, gaps: redoGaps }, collect: estimateDetail,
      collectContent: contentByTarget,
      beforeTable: ({ content }) => sayCarryover(content),
    }
  );
  // Machine-readable estimate BEFORE the gate (the summary comes too late
  // for an agent deciding whether to let the run proceed).
  if (costEstimate) output.event('cost', costEstimate);
  // The estimate failed before its table: the notice counts what the cache holds.
  if (!carryoverSaid) sayCarryover(undefined);
  // A dry run says why what it would send is not served from the cache after
  // a method change — the real run says it as it sends (Round 5, Next.js persona).
  if (dryRun) {
    for (const [pairKey, d] of Object.entries(estimateDetail)) {
      if (d.sendTexts.length > 0) noteCacheScope(pairKey, d.pairConfig, d.target, d.sendTexts);
    }
  }

  // A model server that did not answer at startup: now that the plan is
  // known, a pair that sends it nothing goes on (with a warning); one that
  // sends something stops here, before anything is sent — a dry run says the
  // real run would (Round 11, Django persona: a redo served entirely from
  // the cache failed because Ollama was not running).
  preflightFailures = [...preflightFailures, ...resolveDeferredProbes(deferredProbeFailures, { costEstimate, contentByTarget, cliArgs: { ...cliArgs, dryRun } })];

  // Fallbacks are not in the estimate: they only translate what the primary
  // fails, which nobody knows before the run. Say so, and how the cap
  // treats them (lib/fallback.js createFallbackBudget).
  if (pairEntries.some(([, p]) => p.fallback)) {
    output.info(
      'Fallback methods are not in this estimate — they only translate what the primary method fails, '
      + 'which is not known in advance.'
      + (maxCost !== null ? ' Under --max-cost each fallback batch is priced before it runs and skipped if it would pass the cap.' : '')
    );
  }

  // Enforce the cap only for real runs: a dry-run makes zero API calls, and
  // aborting it would block the exact preview a capped user needs to see.
  // A dry run says instead what the real run would do at the cap.
  let dryMaxCost = null;
  if (maxCost !== null && !dryRun) {
    const verdict = maxCostVerdict(maxCost, costEstimate);
    if (verdict.wouldStop) return abortForMaxCost(maxCost, verdict.estimatedCost, verdict.reason);
  } else if (maxCost !== null) {
    dryMaxCost = reportDryRunMaxCost(maxCost, costEstimate, { stopsEarlier: preflightStopReason(preflightFailures) });
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
  output.info(describeLocaleWork({ dryRun, pairEntries, costEstimate, contentByTarget, concurrency: jsonConcurrency }));
  // Flutter ARB targets this run is about to create: once written, each is
  // checked against the languages Flutter's own widget text covers (lib/flutter-locales.js).
  const newArbTargets = dryRun ? [] : pairEntries.map(([, pc]) => pc.target).filter((code) => {
    try {
      const f = layout.fileFor(code, units[0].ns);
      return f && f.format === 'arb' && !fs.existsSync(f.path);
    } catch { return false; }
  });

  // Shared, read-only context for the per-file worker (syncLocaleFile).
  // --max-cost for fallback batches: the cap admitted the pre-run estimate;
  // each fallback batch must fit in what is left (lib/fallback.js).
  const fallbackBudget = createFallbackBudget({
    maxCost: dryRun ? null : maxCost,
    committed: costEstimate?.knownEstimatedCost ?? 0,
    cwd,
  });
  // How a pending key is labelled in the lock and in status: the redo that left it.
  const redoLabel = [
    cliArgs.force ? '--redo all' : (namedKeys.length > 0 ? '--redo keys:' : null),
    redoGaps ? '--redo gaps' : null,
    noTM ? '--fresh' : null,
    freshOnModelChange ? '--fresh-on-model-change' : null,
  ].filter(Boolean).join(' ') || '--redo';
  // Per locale: what was pending before the run (a model switch completes
  // when its last pending key is translated).
  const pendingBefore = new Map(pairEntries.map(([, pc]) => [pc.target, Object.values(lockState.peek(pc.target).pending)]));
  // One different-inputs-same-output index per locale, shared by every file
  // of it — and by its content files after (lib/validate.js SharedOutputIndex).
  const sharedOutputIndexes = new Map();
  const ctx = {
    config, layout, inputLocale, dryRun, cliArgs, apiKey, tm, noTranslate, cwd,
    pluralFallbackReported: new Set(),
    fallbackBudget,
    lockState,
    namedKeys,
    redoLabel,
    replacedEdits: [],
    // --prune plural-extras: what was (or would be) removed, per file.
    prune,
    pruned: [],
    // --redo gaps, and every plural message this run asks again (pair → lock keys).
    redoGaps,
    gapsAsked: new Map(),
    gapsSeen: 0,
    sharedOutputsFor(code) {
      if (!sharedOutputIndexes.has(code)) {
        // Sentences an earlier sync caught a model repeating for different
        // source strings (refused from their first source on), and what the
        // locale already holds that this run leaves alone — every key-value
        // file and every Markdown page, as `verify` reads them — before
        // anything new is checked (lib/shared-output-seed.js).
        sharedOutputIndexes.set(code, projectSharedOutputIndex({
          config, cwd, code, tm, layout, units, localeState: lockState.peek(code), namedKeys, bulk: !!cliArgs.force,
          fileScope, forceContent,
        }));
      }
      return sharedOutputIndexes.get(code);
    },
    noteCacheScope,
    previewsShown: 0,
    notePreviewShown() { ctx.previewsShown++; },
  };

  const localeResults = await pMap(pairEntries, async ([pairKey, pairConfig]) => {
    // A locale is one file (flat) or several (one per namespace). The files
    // of ONE locale run in sequence, never in parallel: the Translation
    // Memory is keyed by source TEXT, so a string the first file paid for
    // is a free cache hit in the next — parallel files would each pay.
    const agg = {
      processed: 0, tmHits: 0, sent: 0, retried: 0, pluralGaps: {}, copied: 0, keptWorkingScript: 0, failed: 0, failedKeys: [], pairKey,
      held: 0, heldKeys: [], kept: 0, keptKeys: [], replaced: 0, fates: { retry: [], 'pending-retry': [], held: [] },
    };
    let queuedKeys = null;
    let backendDown = false;
    let fallbackDown = false;
    // One fallback tally per pair, across its files → one [FALLBACK] line.
    const fallbackTally = pairConfig.fallback && !dryRun ? newFallbackReport(pairConfig.fallback) : null;
    for (const unit of units) {
      const r = await syncLocaleFile(ctx, unit, pairKey, pairConfig, { backendDown, fallbackDown });
      if (fallbackTally) addToTally(fallbackTally, r.fallback);
      agg.processed += r.processed || 0;
      agg.tmHits += r.tmHits || 0;
      agg.sent += r.sent || 0;
      agg.retried += r.retried || 0;
      Object.assign(agg.pluralGaps, r.pluralGaps || {});
      agg.copied += r.copied || 0;
      agg.keptWorkingScript += r.keptWorkingScript || 0;
      agg.failed += r.failed || 0;
      agg.failedKeys.push(...(r.failedKeys || []));
      agg.held += r.held || 0;
      agg.heldKeys.push(...(r.heldKeys || []));
      agg.kept += r.kept || 0;
      agg.keptKeys.push(...(r.keptKeys || []));
      agg.replaced += r.replaced || 0;
      for (const [mk, n] of Object.entries(r.otherMethods || {})) {
        agg.otherMethods = agg.otherMethods || {};
        agg.otherMethods[mk] = (agg.otherMethods[mk] || 0) + n;
      }
      for (const [mk, n] of Object.entries(r.otherMethodsForced || {})) {
        agg.otherMethodsForced = agg.otherMethodsForced || {};
        agg.otherMethodsForced[mk] = (agg.otherMethodsForced[mk] || 0) + n;
      }
      for (const [model, n] of Object.entries(r.otherModels || {})) {
        agg.otherModels = agg.otherModels || {};
        agg.otherModels[model] = (agg.otherModels[model] || 0) + n;
      }
      for (const [fate, keys] of Object.entries(r.fates || {})) agg.fates[fate].push(...keys);
      if (r.queuedKeys) {
        queuedKeys = queuedKeys || {
          missing: [], fallback: [], untranslated: [], changed: [], forced: [], gaps: [], noTranslate: [], pending: [], held: [], kept: [],
        };
        for (const [reason, keys] of Object.entries(r.queuedKeys)) queuedKeys[reason].push(...keys);
      }
      if (r.backendDown) backendDown = true;
      if (r.fallbackDown) fallbackDown = true;
    }
    if (queuedKeys) agg.queuedKeys = queuedKeys;
    if (fallbackTally) {
      printFallbackReport(pairKey, pairConfig.method, fallbackTally);
      warnFallbackMajority(pairKey, pairConfig.method, fallbackTally);
      agg.fallback = fallbackTally;
    }
    return agg;
  }, { concurrency: jsonConcurrency });

  // --redo gaps with nothing to ask for: said, never a silent no-op.
  if (redoGaps && ctx.gapsSeen === 0) {
    output.info(`--redo gaps: no plural message in the ${cliArgs.pair ? 'selected pairs\'' : 'project\'s'} files lacks a form its language uses for ordinary counts — nothing to ask again.`);
  }
  // --prune plural-extras with nothing to remove: said too.
  if (prune.has('plural-extras') && ctx.pruned.length === 0) {
    output.info('--prune plural-extras: no plural key for a form its language does not have — nothing removed.');
  }

  // A new Flutter locale Flutter's own Material/Cupertino text does not
  // cover needs a fallback delegate in the app (Round 11, hospital persona).
  const arbWritten = newArbTargets.filter((code) => {
    try { return fs.existsSync(layout.fileFor(code, units[0].ns).path); } catch { return false; }
  });
  if (arbWritten.length > 0) {
    for (const { level, text } of flutterLocaleLines(arbWritten)) output[level](text);
  }

  // What the CONFIGURED setup wrote, when only this run's --method/--model
  // differ from it: kept by design, said once below (configuredPairKeys).
  // A DRY run keeps the full note with the redo and its price: that is where
  // a switch is tried and priced before it is committed (Rounds 7-9, Next.js
  // persona: `sync --dry --model m2`). A real run with the flags is a
  // deliberate per-run choice — the CI guide's one-run hosted model — and
  // repeating a paid redo on every such run is noise (Round 12, Django).
  const configuredKeys = dryRun ? null : configuredPairKeys(config, cwd, cliArgs);
  const keptFromConfig = [];

  // Files that still hold an earlier model's text: one line per pair, unless
  // the model-change notice above already said it for that locale (it names
  // the keys this run served from the previous model's cache).
  if (!(cliArgs.force && freshOnModelChange)) {
    const affected = [];
    pairEntries.forEach(([pairKey, pc], i) => {
      let counts = localeResults[i]?.otherModels;
      if (!counts || Object.keys(counts).length === 0) return;
      const own = configuredKeys?.get(pairKey);
      if (own) {
        // The same method, register and coaching as this run: only --model
        // differs, and the configured model's text is the project's own.
        const [om, omodel, or, oc] = own.split('|');
        const [cm, , cr, cc] = tmMethodKey(pc).split('|');
        const label = omodel || '(none)';
        if (om === cm && or === cr && oc === cc && counts[label]) {
          keptFromConfig.push({ pairKey, target: pc.target, n: counts[label], setup: flagSetupOf(own) });
          counts = { ...counts };
          delete counts[label];
          if (Object.keys(counts).length === 0) return;
        }
      }
      const said = (tmModelSwitch || []).some(row => row.target === pc.target && (freshOnModelChange || (row.servedThisRun || 0) > 0));
      if (said) return;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const from = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`).join(', ');
      const model = tmMethodKey(pc).split('|')[1] || pc.method;
      // `--model X` on this run: X is the model for THIS run, while the
      // config still names the old one (Round 7, Next.js persona).
      const which = cliArgs.model ? `the model for this run (--model ${model})` : `the configured model (${model})`;
      affected.push({ pairKey, pc, total, models: Object.keys(counts), line: `${total} translation(s) in the files were written by ${from}, not ${which}` });
    });
    // The redo is the same for every pair (the flags are the run's): ONE
    // command — project-wide when every pair this run covered is affected
    // and no --pair narrowed it, else the affected pairs together. One pair:
    // its own command, as before (Round 8: one command per pair, where the
    // docs show one).
    if (affected.length > 0) {
      const scope = affected.length > 1 && affected.length === pairEntries.length && !cliArgs.pair
        ? ''
        : ` --pair ${affected.map(a => a.pairKey).join(',')}`;
      const command = `champollion sync${scope}${cliArgs.model ? ` --model ${shellWord(String(cliArgs.model))}` : ''} --redo all --fresh-on-model-change`;
      // What that redo costs, so the note is enough to decide on (Round 9,
      // Next.js persona: it took a second dry run to learn the price).
      const keys = affected.reduce((n, a) => n + a.total, 0);
      const price = await priceOfSends(affected.map(a => [a.total, a.pc]), { cwd });
      // The other direction too: text written by a one-off `--model` run is
      // kept by making that model the configured one (Round 10, Next.js
      // persona: the note offered only to replace it).
      const others = [...new Set(affected.flatMap(a => a.models))];
      const file = cliArgs.config ? path.basename(String(cliArgs.config)) : 'champollion.config.json';
      const keep = !cliArgs.model && others.length === 1 && others[0] !== '(none)' && affected.every(a => a.models.length === 1)
        ? `. To keep ${others[0]}'s text instead and use ${others[0]} from now on, set "model": "${others[0]}" in ${file} (nothing is sent).`
        : '';
      const tail = ' — a model change alone re-translates nothing. To re-translate them with it: '
        + `\`${command}\` (sends up to ${keys} key(s) an earlier model wrote — ${price}; what this model already translated comes from the cache)${keep}`;
      if (affected.length === 1) {
        output.info(`${affected[0].pairKey}: ${affected[0].line}${tail}`);
      } else {
        for (const a of affected) output.info(`${a.pairKey}: ${a.line}.`);
        output.info(`${affected.length} pairs keep an earlier model's text${tail}`);
      }
    }
  }

  // Files that hold another METHOD's text (or another register's, or another
  // coaching file's): one line per pair, with the redo and what it costs.
  //
  // What the pair's FALLBACK wrote as it was set up before (another model,
  // register or coaching of the fallback) is said apart: the redo sends it
  // to the pair's method first and the fallback gets what that refuses — so
  // the line names both, and prices both (Round 10, school persona: a coaching
  // file added to the fallback changed nothing, and nothing said why).
  const byEarlierFallback = (pc, counts) => {
    const own = {};
    const fb = {};
    for (const [mk, n] of Object.entries(counts || {})) (fallbackWriterOf(pc, mk) === 'earlier' ? fb : own)[mk] = n;
    return { own, fb };
  };
  const listFrom = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([mk, n]) => `${describeMethodKey(mk)} (${n})`).join(', ');
  const priceOf = async (n, cfg) => { try { return costLabel(await estimateCost(n, cfg, { cwd })); } catch { return 'cost unknown'; } };
  // Pairs whose files hold another method's text: said together below, with
  // ONE redo for all of them and its total (Round 13, Next.js persona: a
  // dry run after a method change gave one command per language, each priced
  // on its own, and no total).
  const methodAffected = [];
  for (const [i, [pairKey, pc]] of pairEntries.entries()) {
    const forcedAll = byEarlierFallback(pc, localeResults[i]?.otherMethodsForced);
    const countsAll = byEarlierFallback(pc, localeResults[i]?.otherMethods);
    // The fallback's earlier setup: a dry run of the redo says what it would
    // send; any other run says what the files hold and the redo that changes it.
    for (const [counts, forcedNote] of [[forcedAll.fb, true], [countsAll.fb, false]]) {
      const n = Object.values(counts).reduce((a, b) => a + b, 0);
      if (n === 0 || (forcedNote && !dryRun)) continue;
      const nowKey = tmMethodKey(pc.fallback);
      const nowFb = describeMethodKey(nowKey);
      // Only another MODEL of the fallback: its translations are reused
      // (model carry-over, lib/tm.js) unless the redo turns that off.
      const [fm, , fr, fc] = nowKey.split('|');
      const modelOnly = Object.keys(counts).some((mk) => { const p = mk.split('|'); return p[0] === fm && p[2] === fr && p[3] === fc; });
      const fresh = modelOnly && !freshOnModelChange ? ' --fresh-on-model-change' : '';
      const prices = `${pc.method}: ${await priceOf(n, pc)}; ${pc.fallback.method}: ${await priceOf(n, pc.fallback)}`;
      output.info(forcedNote
        ? `${pairKey}: this redo would re-translate ${n} translation(s) the fallback wrote as it was set up before — ${listFrom(counts)} — `
          + `sending them to ${pc.method} first and what it refuses to the fallback as it is now (${nowFb})${fresh ? ' — those an earlier model of the fallback wrote are served from its cache unless --fresh-on-model-change' : ''} `
          + `(${prices}; the estimate above prices the pair's method only).`
        : `${pairKey}: ${n} translation(s) in the files were written by the fallback as it was set up before — ${listFrom(counts)} — `
          + `not as it is now (${nowFb}). ${dryRun ? 'Nothing would change' : 'Nothing changed'}: a change of the fallback's model, register or coaching `
          + `re-translates nothing on its own${modelOnly ? ' (a model change alone reuses its earlier translations)' : ''}. `
          + `To re-translate them: \`champollion sync --pair ${pairKey} --redo all${fresh}\` — sends up to ${n} key(s) `
          + `to ${pc.method} first, and what it refuses to the fallback (${prices}).`);
    }
    // A dry run of a redo that forces them: what it WOULD send, and the price
    // — never "nothing would change" over the command being previewed.
    const forced = forcedAll.own;
    if (dryRun && forced && Object.keys(forced).length > 0) {
      const n = Object.values(forced).reduce((a, b) => a + b, 0);
      const from = Object.entries(forced).sort((a, b) => b[1] - a[1]).map(([mk, c]) => `${describeMethodKey(mk)} (${c})`).join(', ');
      let price = 'cost unknown';
      try { price = costLabel(await estimateCost(n, pc, { cwd })); } catch { /* unknown */ }
      output.info(`${pairKey}: this redo would re-translate ${n} translation(s) written by ${from} — sends them to `
        + `${describeMethodKey(tmMethodKey(pc))} unless the cache already holds its translation (${price}; the estimate above prices the whole run).`);
    }
    let counts = countsAll.own;
    if (!counts || Object.keys(counts).length === 0) continue;
    const own = configuredKeys?.get(pairKey);
    if (own && counts[own]) {
      keptFromConfig.push({ pairKey, target: pc.target, n: counts[own], setup: flagSetupOf(own) });
      counts = { ...counts };
      delete counts[own];
      if (Object.keys(counts).length === 0) continue;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const from = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([mk, n]) => `${describeMethodKey(mk)} (${n})`).join(', ');
    methodAffected.push({ pairKey, pc, total, from, now: describeMethodKey(tmMethodKey(pc)) });
  }
  if (methodAffected.length > 0) {
    const byFlag = cliArgs.method || cliArgs.model ? ' (as this run sets it)' : '';
    const flags = [
      cliArgs.method ? `--method ${shellWord(String(cliArgs.method))}` : null,
      cliArgs.model ? `--model ${shellWord(String(cliArgs.model))}` : null,
    ].filter(Boolean).join(' ');
    const nothing = `${dryRun ? 'Nothing would change' : 'Nothing changed'}: a change of method, register or coaching re-translates nothing on its own — `
      + 'the files keep the other text.';
    if (methodAffected.length === 1) {
      const [{ pairKey, pc, total, from, now }] = methodAffected;
      output.info(`${pairKey}: ${total} translation(s) in the files were written by ${from}, not by ${now}${byFlag}. `
        + `${nothing} To have ${pc.method} translate them: `
        + `\`champollion sync --pair ${pairKey}${flags ? ` ${flags}` : ''} --redo all\` — sends ${total} key(s) to ${pc.method} (${await priceOf(total, pc)}).`);
    } else {
      // Each pair with its own count and price, then one command for all of
      // them: project-wide when every pair this run covered is affected and
      // no --pair narrowed it, else those pairs together.
      for (const a of methodAffected) {
        output.info(`${a.pairKey}: ${a.total} translation(s) in the files were written by ${a.from}, not by ${a.now}${byFlag} `
          + `(re-translating them: ${a.total} key(s) to ${a.pc.method}, ${await priceOf(a.total, a.pc)}).`);
      }
      const scope = methodAffected.length === pairEntries.length && !cliArgs.pair
        ? ''
        : ` --pair ${methodAffected.map(a => a.pairKey).join(',')}`;
      const keys = methodAffected.reduce((n, a) => n + a.total, 0);
      const methods = [...new Set(methodAffected.map(a => a.pc.method))];
      const price = await priceOfSends(methodAffected.map(a => [a.total, a.pc]), { cwd });
      output.info(`${methodAffected.length} pairs keep another method's text. ${nothing} `
        + `To have ${methods.length === 1 ? methods[0] : 'each pair\'s method'} translate them, all at once: `
        + `\`champollion sync${scope}${flags ? ` ${flags}` : ''} --redo all\` — sends ${keys} key(s) `
        + `(${methodAffected.map(a => `${a.total} for ${a.pairKey}`).join(', ')}) — total: ${price}.`);
    }
  }

  // Text the configured setup wrote, while this run's flags name another:
  // ONE quiet line for the whole run, no redo offered — the flags are for
  // this run (a CI job's hosted model over a project set up for a local
  // one). A change of the config itself still gets the full note above.
  if (keptFromConfig.length > 0) {
    const n = keptFromConfig.reduce((a, k) => a + k.n, 0);
    const flags = [
      cliArgs.method ? `--method ${shellWord(String(cliArgs.method))}` : null,
      cliArgs.model ? `--model ${shellWord(String(cliArgs.model))}` : null,
    ].filter(Boolean);
    const setups = [...new Set(keptFromConfig.map(k => k.setup))].join('; ');
    output.info(`${flags.join(' ')} ${flags.length > 1 ? 'apply' : 'applies'} to this run only: the `
      + `${n} translation${n === 1 ? '' : 's'} in the files the configured setup (${setups}) wrote `
      + `(${translationsBreakdown(keptFromConfig.map(k => ({ target: k.target, n: k.n })))}) ${n === 1 ? 'is' : 'are'} kept, `
      + `and nothing is redone — the flags translate new and changed keys only`
      + `${[...ctx.gapsAsked.values()].some(k => k.length > 0) ? ', and the plural messages another setup left incomplete (above)' : ''}.`);
  }

  // `--dry --show-prompt` that previewed nothing: say why, never silence.
  if (dryRun && cliArgs['show-prompt'] && ctx.previewsShown === 0) {
    const named = typeof cliArgs['show-prompt'] === 'string' ? cliArgs['show-prompt'] : null;
    output.info(named
      ? `--show-prompt ${JSON.stringify(named)}: no key by that name in the source files of the selected pair(s) `
        + `(name it as sync lists it${layout.namespaced ? ', with its file: <ns>::<key>' : ''}; a gettext context as msgctxt␄msgid; `
        + 'a comma inside a key in a list as \\,). Nothing was sent.'
      : 'Nothing to preview: no file would send anything to the model (every key is up to date or served from the cache). '
        + 'Name a key to see its request anyway: `champollion sync --dry --show-prompt <key>`.');
  }

  // Aggregate results across all locales
  const failedKeySet = new Set();
  let totalSent = 0;
  let totalRetried = 0;
  let totalHeld = 0;
  let totalKept = 0;
  for (const r of localeResults) {
    totalHeld += r.held || 0;
    totalKept += r.kept || 0;
    totalProcessed += r.processed;
    totalTMHits += r.tmHits;
    totalSent += r.sent || 0;
    totalRetried += r.retried || 0;
    totalFailed += (r.failed || 0);
    totalCopied += (r.copied || 0);
    totalKeptWorkingScript += (r.keptWorkingScript || 0);
    if ((r.failed > 0 || r.held > 0) && r.pairKey) {
      failedPairs.push({ pair: r.pairKey, count: r.failed, held: r.held || 0 });
    }
    for (const key of r.failedKeys || []) failedKeySet.add(key);
  }

  // Summary. Never print [OK] when keys failed — a green success marker on a
  // partially-failed sync misleads CI and agents into thinking all is well.
  // What this run asked a model/API for, and what came free from the cache
  // (Round 3: nothing said it outright). A dry run reports the estimate's
  // partition — what the real run would send.
  const work = dryRun
    ? {
      sent: (costEstimate?.pairs || []).reduce((n, p) => n + (p.keys || 0), 0),
      cached: (costEstimate?.pairs || []).reduce((n, p) => n + (p.tmHits || 0), 0),
      known: !!costEstimate,
    }
    : { sent: totalSent, retried: totalRetried, cached: totalTMHits, known: true };
  // Plural messages without an everyday form: the ones this run wrote (sync
  // warned per file), and the ones still on disk from an earlier sync — said
  // here with their repair, and counted, so every run exits 2 while they
  // remain (pluralGapsOnDisk).
  //
  // A dry run reads the same files, and counts them the same way: they stay
  // after the real run (it exits 2 over them), except the ones that run asks
  // for again — said per file above (Round 13, Django persona: `sync --dry
  // --json` said totalPluralGaps 0 over files a real sync exits 2 on).
  const gapsOnDisk = pluralGapsOnDisk({ layout, units, inputLocale, pairEntries });
  let gapsAskedAgain = 0;
  pairEntries.forEach(([pairKey, pc], i) => {
    const r = localeResults[i];
    if (!r) return;
    const askedNow = new Set(ctx.gapsAsked.get(pairKey) || []);
    if (dryRun) gapsAskedAgain += askedNow.size;
    for (const { unit, file, gaps } of gapsOnDisk.get(pairKey) || []) {
      const earlier = gaps.filter(g => !(r.pluralGaps && lockKey(layout, unit.ns, g.key) in r.pluralGaps)
        && !(dryRun && askedNow.has(lockKey(layout, unit.ns, g.key))));
      if (earlier.length === 0) continue;
      reportPluralGapsOnDisk({ pairKey, code: pc.target, file, unit, gaps: earlier, layout, dryRun });
      r.pluralGaps = r.pluralGaps || {};
      for (const g of earlier) r.pluralGaps[lockKey(layout, unit.ns, g.key)] = g.missing;
    }
  });
  const totalPluralGaps = localeResults.reduce((n, r) => n + Object.keys(r?.pluralGaps || {}).length, 0);
  // The one repair command when every gap is in one file (else each file's
  // own, printed above), and whether a catalog marks them.
  const gapFiles = [...gapsOnDisk.entries()].flatMap(([pairKey, files]) => files.map(f => ({ pairKey, ...f })));
  const pluralRepair = gapFiles.length === 1
    ? redoCommand(gapFiles[0].gaps.map(g => g.key), { pair: gapFiles[0].pairKey, ns: layout.namespaced ? gapFiles[0].unit.ns : '', fresh: true })
    : null;
  const summary = formatSyncSummary(dryRun, totalProcessed, totalFailed, totalCopied, work, totalHeld, {
    contentPending: (costEstimate?.content?.pendingTranslations || 0) > 0,
    pluralGaps: totalPluralGaps,
    pluralRepair,
    pluralMarked: gapFiles.some(f => f.gaps.some(g => g.marked)),
  });
  if (summary.ok) output.ok(summary.message);
  else output.warn(summary.message);
  // Said again at the end, where a dry run's reader looks for the verdict.
  if (dryRun && preflightFailures.length > 0) {
    // Each reason is a sentence of its own ("No OpenRouter API key (…)."):
    // joined without its full stop, so the list never reads ".;" (Round 8).
    output.warn(`A real run would stop before translating: ${preflightFailures.map(f => `${f.pair}: ${String(f.reason).replace(/[.;\s]+$/, '')}`).join('; ')}.`);
  }
  // The --max-cost verdict, said once — here, beside the preflight's (lib/cost-report.js reportDryRunMaxCost).
  if (dryMaxCost) output[dryMaxCost.level](dryMaxCost.message);
  // The exit code the real run would end with, as far as a preview can know
  // it: the dry run itself exits 0 (Round 11), and said this run's partial
  // verdict nowhere (Round 13, Django persona). What only the real run finds
  // — a refusal by the quality gate, a failed verification — can still turn
  // a 0 into a 2; the reasons a preview knows are named.
  const realRun = dryRun
    ? predictRealRun({ preflightFailures, dryMaxCost, unmatched: unmatchedNamed.length, pluralGaps: totalPluralGaps, gapsAskedAgain, costEstimate })
    : null;
  if (realRun && !realRun.wouldStop && realRun.exitCode !== 0) {
    output.warn(`A real sync would exit ${realRun.exitCode}${realRun.exitCode === 2 ? ' (partial)' : ''}: ${realRun.reasons.join('; ')}. `
      + dryRunCiHint('realRun.exitCode'));
  }

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
    for (const { pair, count, held } of failedPairs) {
      const parts = [count > 0 && `${count} key(s) not translated`, held > 0 && `${held} held back`].filter(Boolean);
      output.warn(`  ${pair}: ${parts.join(', ')}`);
    }
    output.warn(`Total: ${[totalFailed > 0 && `${totalFailed} key(s) not translated`, totalHeld > 0 && `${totalHeld} held back`]
      .filter(Boolean).join(', ')} across ${failedPairs.length} locale(s).`);
    // What the next sync does with them — said per outcome, so it is true
    // (lib/locale-state.js has the rules).
    const byFate = (fate) => localeResults.flatMap(r => (r.fates?.[fate] || []).map(k => ({ pair: r.pairKey, key: k })));
    const retry = byFate('retry');
    const pendingNext = byFate('pending-retry');
    const heldNext = byFate('held');
    if (retry.length > 0) {
      output.warn(`  ${retry.length} key(s) got no usable answer (missing from the response, or the method failed) — the next sync asks for them again.`);
    }
    if (pendingNext.length > 0) {
      output.warn(`  ${pendingNext.length} key(s) this redo could not finish are recorded as pending in ${LOCK_FILENAME} — the next plain `
        + '`champollion sync` asks the model for them once more (`champollion status` lists them). If it refuses them again, they are held back.');
    }
    for (const line of describeHeldNext(heldNext, (keys, pair) => redoCommand(keys, { pair }))) output.warn(line);
  }
  if (totalKept > 0 && !dryRun) {
    output.info(`Kept ${totalKept} hand-edited value(s) — a bulk redo never replaces a person's text; \`--redo keys:<key>\` replaces one.`);
  }

  // Write the updated hash manifest so the next sync knows
  // what state the translations are based on.
  // Skip in dry-run mode — don't mark stale keys as resolved.
  if (!dryRun) {
    // The locale files are already written: whatever goes wrong below, the
    // translations this run paid for must reach the cache (Round 3: a crash
    // here wrote the files and lost tm.json).
    try {
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
      // Per-locale record: drop locales the config no longer has and keys a
      // locale no longer expects (locales this run did not process keep theirs).
      const configured = new Set(Object.keys(config.resolvedLanguages || {}));
      for (const k of Object.keys(config.pairs || {})) {
        const t = parsePairKey(k).target;
        if (t) configured.add(t);
      }
      for (const [, pc] of pairEntries) configured.add(pc.target);
      const processed = new Set(pairEntries.map(([, pc]) => pc.target));
      const expectedByLocale = new Map();
      for (const code of configured) {
        if (!processed.has(code)) { expectedByLocale.set(code, null); continue; }
        const keys = new Set();
        for (const unit of units) {
          for (const k of Object.keys(expectedForTarget(unit, inputLocale, code).flat)) keys.add(lockKey(layout, unit.ns, k));
        }
        expectedByLocale.set(code, keys);
      }
      lockState.prune(expectedByLocale);
      writeManifest(cwd, currentManifest, lockState.toJSON());
      // A person's wording this run replaced: kept, in a tracked file.
      const recorded = recordReplacedEdits(cwd, ctx.replacedEdits);
      if (recorded) {
        output.warn(`Recorded ${ctx.replacedEdits.length} replaced hand edit(s) in ${recorded} (commit it with the lock — `
          + 'it is the only copy of that wording).');
      }

      // A model switch left keys pending and this run finished them: the
      // switch is done for that locale (the "Model changed" notice stops).
      pairEntries.forEach(([, pc], i) => {
        const before = pendingBefore.get(pc.target) || [];
        const nowPending = Object.keys(lockState.peek(pc.target).pending).length;
        if (before.some(r => String(r).includes('fresh-on-model-change')) && nowPending === 0
            && (localeResults[i]?.failed || 0) === 0 && (localeResults[i]?.held || 0) === 0) {
          tm._meta = tm._meta || {};
          tm._meta.switchedTo = tm._meta.switchedTo || {};
          tm._meta.switchedTo[pc.target] = tmMethodKey(pc);
        }
      });

      // A locale re-translated in full under the current model (--redo all
      // --fresh-on-model-change, no failures) has switched: record it so the
      // "Model changed" notice stops for it. The notice compares cached-entry
      // counts per model, and leftovers (strings since deleted) kept it firing
      // after the switch was done (Round 2, Next.js persona).
      if (cliArgs.force && freshOnModelChange) {
        tm._meta = tm._meta || {};
        tm._meta.switchedTo = tm._meta.switchedTo || {};
        pairEntries.forEach(([, pc], i) => {
          if ((localeResults[i]?.failed || 0) === 0) tm._meta.switchedTo[pc.target] = tmMethodKey(pc);
        });
      }

    } finally {
      // Persist TM if it was mutated during this sync (stores OR evictions —
      // a size check would miss eviction-only runs and same-key replacements).
      // Under --fresh/--no-tm too: what was paid for is cached.
      if (isTMDirty(tm)) {
        saveTM(cwd, tm);
        output.info(`[TM] Saved ${describeTMChanges(tm)} this sync`);
      }
    }
  }

  // Content sync — translate the contentDir Markdown files if configured.
  // Uses the same resolved pair graph as key-value sync, ensuring method
  // dispatch is consistent across both translation modes.
  let content = null;
  if (config.contentDir) {
    content = await runContentSync({
      contentDir: config.contentDir,
      sourceLocale: inputLocale,
      pairs: resolvedPairs,
      translatableFields: config.translatableFields,
      apiKey,
      dryRun,
      noTM,
      freshOnModelChange,
      forceContent,
      fileScope,
      cwd,
      concurrency: config.contentConcurrency || 12,
      fallbackBudget,
      sharedOutputsFor: ctx.sharedOutputsFor,
    });
  }

  // One text answering several different source strings (lib/validate.js
  // SharedOutputIndex): refused where it came back this run, but earlier
  // members of the group were already written — name them, with the redo.
  //
  // Two things outlive the run (Round 6, school persona: the printed repair
  // failed, and `--force-content` then re-served the same sentence from the
  // cache with no warning):
  //   - the cache entries that produced the written members are EVICTED, so
  //     any redo — with or without --fresh — asks the model again instead of
  //     re-serving the sentence for free;
  //   - the sentence is remembered per locale (TM _meta.memorized), so when
  //     the model answers a repair with it again, it is refused from its
  //     first source on (lib/validate.js markMemorized) and the key goes to
  //     the pair's fallback.
  // The key-value TM object was saved before the content lane loaded its
  // own; both are on disk now, so this works on a fresh read and the
  // verification below gets that same object (a stale one would drop the
  // content lane's entries if verify saved it).
  let tmAfter = tm;
  if (!dryRun && sharedOutputIndexes.size > 0) {
    const flaggedNow = [...sharedOutputIndexes].filter(([, index]) => index.flagged.size > 0);
    if (flaggedNow.length > 0) {
      tmAfter = config.contentDir ? loadTM(cwd) : tm;
      const evictor = createTMEvictor(tmAfter);
      let evicted = 0;
      for (const [code, index] of flaggedNow) {
        const memo = new Set((tmAfter._meta?.memorized?.[code]) || []);
        for (const g of index.flagged.values()) {
          memo.add(g.value);
          // Members accepted (and written) before the repeat showed.
          const members = [...(index.byOutput.get(SharedOutputIndex.outputForm(g.value))?.values() || [])];
          const written = members.map(v => v.key);
          for (const member of members) {
            // A sentence of a longer value: what was cached is the whole value.
            const m = member.whole ? { ...member, ...member.whole } : member;
            if (typeof m.source !== 'string' || typeof m.value !== 'string') continue;
            const texts = new Set([m.source]);
            if (!m.key.startsWith('content:')) {
              const bare = layout.namespaced && m.key.includes(NS_SEPARATOR) ? m.key.slice(m.key.indexOf(NS_SEPARATOR) + NS_SEPARATOR.length) : m.key;
              texts.add(tmSourceText(bare, m.source));
            }
            for (const t of texts) evicted += evictor.evictProducing(t, code, m.value);
          }
          if (written.length === 0) continue;
          const pairKey = pairEntries.find(([, pc]) => pc.target === code)?.[0] || `${inputLocale}:${code}`;
          const shown = g.value.length > 60 ? `${g.value.slice(0, 57)}...` : g.value;
          const keys = written.filter(k => !k.startsWith('content:'));
          // The path sync prints for a content file (relative to the
          // contentDir) — what `--redo files:` matches (lib/file-scope.js).
          const files = [...new Set(written.filter(k => k.startsWith('content:')).map(k => k.slice(8).replace(/(#\d+| front matter:.*)$/, '')))];
          const redo = [
            keys.length > 0 && `\`${redoCommand(keys.slice(0, 8), { pair: pairKey })}\``,
            ...files.slice(0, 3).map(f => `\`${contentRedoCommand(f, { pair: pairKey })}\``),
          ].filter(Boolean).join(', ');
          const fb = pairEntries.find(([, pc]) => pc.target === code)?.[1]?.fallback;
          output.warn(`${pairKey}: ${JSON.stringify(shown)} came back for ${g.sources.length} different source string(s) — a model `
            + `repeating a memorized sentence. Refused once the repeat showed, but it was already written (earlier in this run, or by an earlier sync) for `
            + `${written.map(k => k.replace(/^content:/, '')).slice(0, 6).join(', ')}${written.length > 6 ? ', …' : ''}. `
            + 'Removed from the cache, and remembered: if the model answers with it again, it is refused. '
            + `Check those and ask again: ${redo}${fb ? ` (what ${pairEntries.find(([, pc]) => pc.target === code)[1].method} refuses goes to the fallback, ${fb.method})` : ' — a "fallback" method on the pair takes what the model can only answer this way'}.`);
        }
        tmAfter._meta = tmAfter._meta || {};
        tmAfter._meta.memorized = tmAfter._meta.memorized || {};
        tmAfter._meta.memorized[code] = [...memo];
      }
      saveTM(cwd, tmAfter);
      if (evicted > 0) output.info(`[TM] Removed ${evicted} cached translation(s) holding a memorized sentence.`);
    }
  }
  if (tmAfter === tm && config.contentDir && content && !dryRun) tmAfter = loadTM(cwd);

  // ── Post-sync verification ──────────────────────────────────────
  // Re-read written locale files from disk and confirm translations
  // are actually present and correct. Catches the gap between the CLI
  // reporting "synced N keys" and keys being wrong in fact.
  // Skipped for dry-run (nothing written) and audit (read-only).
  //
  // Verification errors feed the exit code: a sync that wrote files but
  // left [EN] markers, missing keys, or wrong-script values is NOT a clean
  // pass, and a CI gate must see that.
  //
  // Scope: `sync --pair en:fr` verifies the pair(s) that ran — reporting
  // Spanish errors on a French-only run is noise about work nobody asked for.
  //
  // Damage verify finds (ICU structure, placeholders, hollowed values) that
  // THIS run's Translation Memory produced is evicted from it, so the next
  // sync — or the `--force-keys` the report names — re-translates instead
  // of re-serving it for free (lib/tm-evict.js). Not under --no-tm.
  let verifyErrors = 0;
  let verifyWarnings = 0;
  let tmEvicted = 0;
  const verifyRan = !dryRun && !audit && !cliArgs['no-verify'];
  if (verifyRan) {
    // Translation is done: verify consults the cache (TM-confirmed echoes are
    // not findings) even after a --fresh run, and evicts what it rejects.
    setTMReads(tmAfter, true);
    // What this run left undone: verify's closing line names it instead of
    // an [OK] over a run that exits 2 (lib/verify.js printSummary).
    const contentLeft = content ? (content.heldBack || 0) + (content.refused || 0) : 0;
    const incomplete = [
      totalFailed > 0 && `${totalFailed} key(s) not translated`,
      totalHeld > 0 && `${totalHeld} key(s) held back`,
      totalPluralGaps > 0 && `${totalPluralGaps} plural message(s) without a form the language uses for ordinary counts`,
      content && content.failed > 0 && `${content.failed} content file(s) not translated`,
      contentLeft > 0 && `${contentLeft} Markdown block(s) or field(s) not translated`,
    ].filter(Boolean).join(', ');
    const v = await verifyLocales(config, cwd, {
      afterSync: true,
      incomplete: incomplete || null,
      noTranslate,
      locales: cliArgs.pair ? pairEntries.map(([, p]) => p.target) : null,
      tm: tmAfter,
      noTM,
    });
    verifyErrors = v.errors;
    verifyWarnings = v.warnings;
    tmEvicted = v.tmEvicted || 0;
  }

  // Per-locale structured results (zip the parallel pMap output back to its
  // pair keys) — used by the --json summary so agents don't regex log lines.
  const localeSummary = pairEntries.map(([pairKey, pairConfig], i) => {
    const r = localeResults[i] || {};
    // A dry run sends nothing: what each locale WOULD send and serve from the
    // cache is the estimate's partition for its pair — the same numbers the
    // run-wide sentToModel sums, so the locales add up to it (Round 9,
    // i18next persona: every locale said 0 under a total of 4).
    const planned = dryRun ? (costEstimate?.pairs || []).find(p => p.pair === pairKey) : null;
    return {
      pair: pairKey,
      target: pairConfig.target,
      processed: r.processed || 0,
      failed: r.failed || 0,
      tmHits: dryRun ? (planned?.tmHits || 0) : (r.tmHits || 0),
      sentToModel: dryRun ? (planned?.keys || 0) : (r.sent || 0),
      // Plural messages written without forms the language uses for
      // ordinary counts: key → missing CLDR categories (sync warned).
      ...(r.pluralGaps && Object.keys(r.pluralGaps).length > 0 && { pluralGaps: r.pluralGaps }),
      copied: r.copied || 0,
      keptWorkingScript: r.keptWorkingScript || 0,
      // Refused before by this method: not sent, not billed (lib/locale-state.js).
      held: r.held || 0,
      ...(r.heldKeys && r.heldKeys.length > 0 && { heldKeys: r.heldKeys }),
      // Hand-edited values a bulk redo kept, and ones this run replaced (recorded).
      kept: r.kept || 0,
      ...(r.keptKeys && r.keptKeys.length > 0 && { keptKeys: r.keptKeys }),
      replacedEdits: r.replaced || 0,
      // Next-sync fate of each key left untranslated: retry | pending-retry | held.
      ...(r.fates && Object.values(r.fates).some(v => v.length > 0) && { nextSync: r.fates }),
      ...(r.queuedKeys && { queuedKeys: r.queuedKeys }),
      // What the pair's fallback method did (pairs with a fallback, real runs).
      ...(r.fallback && { fallback: fallbackSummary(r.fallback) }),
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
    totalHeld,
    // Plural messages without a form the language uses for ordinary counts:
    // after the run — in a dry run, those on disk the real run does not ask
    // for again (it exits 2 over them; realRun says so).
    totalPluralGaps,
    ...(dryRun && { pluralGapsAskedAgain: gapsAskedAgain }),
    // --prune plural-extras: each key removed (a dry run: would remove).
    ...(prune.size > 0 && { pruned: ctx.pruned }),
    totalKept,
    // A dry run: what the real run would serve from the cache (the estimate).
    tmHits: dryRun ? work.cached : totalTMHits,
    // Keys sent to the method (TM misses) and re-sent with gate feedback.
    sentToModel: dryRun ? work.sent : totalSent,
    resentWithFeedback: dryRun ? 0 : totalRetried,
    // No-translate keys copied verbatim: never sent to a backend, never
    // gated, never billed. Counted apart from totalProcessed so an agent
    // reading this can tell translation work from passthrough.
    totalCopied,
    // Valid translations left in the working script because the converter
    // could not map some of their letters (see scriptFallback).
    totalKeptWorkingScript,
    noTranslate: { patterns: noTranslate.patterns, autoDetectUrls: noTranslate.urls },
    // Not run in a dry run (nothing was written) or under --no-verify: its
    // counts are null then, never a 0 that reads as "verified".
    verify: verifyRan
      ? { ran: true, errors: verifyErrors, warnings: verifyWarnings, tmEvicted }
      : { ran: false, errors: null, warnings: null, tmEvicted: 0 },
    failedPairs,
    locales: localeSummary,
    // Pre-run cost estimate (null when estimation failed) — the human table
    // is output.raw and therefore invisible in --json, so the structured
    // estimate must ride the summary for agents/CI.
    costEstimate,
    // Dry runs: whether the real run's preflight would pass (missing keys).
    ...(dryRun && { preflight: { ready: preflightFailures.length === 0, failures: preflightFailures } }),
    // Dry runs: the exit code the real run would end with, as far as a
    // preview can know (predictRealRun): wouldStop = before translating.
    ...(realRun && { realRun }),
    // Dry runs with --max-cost: whether the real run would stop at the cap
    // (it would exit 2 before any API call); the dry run itself exits 0.
    ...(dryMaxCost && { maxCost: {
      cap: dryMaxCost.cap, estimatedCost: dryMaxCost.estimatedCost, wouldStop: dryMaxCost.wouldStop,
      ...(dryMaxCost.wouldStop && { exitCode: 2, reason: dryMaxCost.reason }),
      // The preflight would stop the real run first (exit 1), before the cap.
      ...(dryMaxCost.stopsEarlier && { exitCode: 1, stopsEarlier: dryMaxCost.stopsEarlier }),
    } }),
    tmModelSwitch,
    // Content files (contentDir): translated / failed / kept-edit / held counts and lists.
    content,
    // Keys named for a redo that match no key (the run exits 1), each with
    // the closest keys that exist.
    ...(unmatchedNamed.length > 0 && { unmatchedKeys: unmatchedKeysSummary(unmatchedNamed) }),
  });

  // Return result for exit code determination.
  // totalFailed > 0 means some keys couldn't be translated; verifyErrors > 0
  // means written files didn't pass verification. The caller maps these to a
  // non-zero exit code (see lib/commands/sync.js computeExitCode).
  // Named keys that matched nothing: said again at the end, where a reader
  // (or CI) looks for the verdict — and the run fails.
  reportUnmatchedKeys(unmatchedNamed, cliArgs);
  return {
    totalProcessed, totalFailed, totalHeld, totalKept, totalCopied, totalKeptWorkingScript, failedPairs, verifyErrors, verifyWarnings,
    // Plural messages left without a form the language uses (exit 2).
    totalPluralGaps: dryRun ? 0 : totalPluralGaps,
    contentTranslated: content ? content.translated : 0,
    contentFailed: content ? content.failed : 0,
    // Markdown blocks/fields refused before and held back, or refused this
    // run (lib/content-refusals.js): not translated — not a clean pass.
    contentHeldBack: content ? content.heldBack || 0 : 0,
    contentRefused: content ? content.refused || 0 : 0,
    unmatchedKeys: unmatchedNamed.map(m => m.name),
  };
}

export { runSync, runContentSync, resolveRuntime, loadApiKey, formatSyncSummary, reportGeneratedPluralKeys, reportPluralGaps };

