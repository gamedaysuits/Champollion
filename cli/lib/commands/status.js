/**
 * Command: status
 *
 * Shows the translation pair graph, config summary, installed plugins,
 * TM cache stats, and benchmark scores. A diagnostic tool for understanding
 * how the project is configured before running sync.
 */

import { resolveConfig, autoDetectLanguages } from '../config.js';
import { discoverLocaleLayout, loadSourceUnits, expectedForTarget, readLocaleFlat, lockKey } from '../locale-layout.js';
import { readLock } from '../hash.js';
import { LockState, localeHealth, countReplacedEdits, REPLACED_EDITS_FILENAME, decodeWritten, valueHash } from '../locale-state.js';
import { originKey } from '../plurals.js';
import { redoCommand } from '../verify.js';
import { tmProofTextsFor } from '../tm-evict.js';
import { resolvePairs, QUALITY_TIERS } from '../pairs.js';
import { loadPlugins, resolvePluginForPair } from '../plugins.js';
import { DEFAULT_REGISTERS, getLanguageCard, getRegisterPresets, DEFAULT_REGISTER_FALLBACK, summarizeGenderGuidance } from '../registers.js';
import { loadTM, tmSize, modelsBehindValues, tmMethodKey, canonicalWriterKey, fallbackWriterOf, describeMethodKey, adoptLegacyCoachingKeys, TM_DIR, TM_FILENAME } from '../tm.js';
import { COACHING_PROMPT_METHODS } from '../methods/prompt-methods.js';
import { getMethod } from '../translate.js';
import { contentStatus } from '../content-sync.js';
import { PLAIN_LLM_METHODS } from '../methods/llm.js';
import { output } from '../output.js';
import { FALLBACK_MAJORITY_SHARE } from '../fallback.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Did the config set this pair's quality tier? A pair resolved without one
 * carries the default label in `_defaults` (lib/pairs.js); a pair object
 * without that record (older callers) counts as set unless it is the
 * default, so nothing a person wrote is hidden.
 *
 * @param {object} pairConfig
 * @returns {boolean}
 */
function qualityTierSet(pairConfig) {
  if (!pairConfig.qualityTier) return false;
  if (pairConfig._defaults instanceof Set) return !pairConfig._defaults.has('qualityTier');
  return pairConfig.qualityTier !== 'standard';
}

/** Methods that run a model the config names (the LLM methods). */
function runsModel(method) {
  return PLAIN_LLM_METHODS.has(method) || method === 'llm-coached';
}

/**
 * The model a pair (or a fallback) will actually use: direct providers may
 * carry model=null (the method class picks its own default at runtime).
 * null for a method that runs no model the config names — `api` (the model
 * is whatever its endpoint serves) and the MT engines (deepl, google-translate…),
 * which used to be shown "model: auto".
 */
function displayModelFor(pairConfig) {
  if (!runsModel(pairConfig.method)) return null;
  if (pairConfig.model) return pairConfig.model;
  // llm-coached on a direct provider runs that provider's default model.
  const transport = pairConfig.method === 'llm-coached' && pairConfig.provider && pairConfig.provider !== 'openrouter'
    ? pairConfig.provider
    : pairConfig.method;
  try {
    return getMethod(transport)._getDefaultModel?.() || 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * The header's model/endpoint summary. "Default model" only when a pair
 * actually runs the top-level model (or, with no pairs yet, when the
 * default method runs one): an api-only project printed the built-in
 * OpenRouter default, a model nothing in it uses. The endpoints of `api`
 * pairs are listed instead.
 *
 * @returns {{ defaultModel: string|null, endpoints: string[] }}
 */
function headerModels(config, pairs) {
  const list = [...pairs.values()];
  const usesDefault = list.length === 0
    ? runsModel(config.defaultMethod || 'llm')
    : list.some(p => displayModelFor(p) === config.model);
  const endpoints = [...new Set(list.filter(p => p.method === 'api' && p.endpoint).map(p => p.endpoint))];
  return { defaultModel: usesDefault ? config.model : null, endpoints };
}

/** Methods that run a model the user picks — its licence is theirs to check. */
const MODEL_YOU_CHOOSE = new Set(['local', 'api', 'external']);
const MODEL_YOU_CHOOSE_NOTE = 'runs a model you choose — Champollion cannot check its licence; make sure your use of it is allowed';

/**
 * Per target locale: which models produced the values its files hold now
 * (lib/tm.js modelsBehindValues). Empty when there is no cache, or the
 * layout cannot be read — status is a diagnostic and never fails on it.
 *
 * @returns {Map<string, Array<{ model: string, keys: number, current: boolean }>>}
 */
function modelsInFiles(config, pairs, cwd) {
  const out = new Map();
  if (config.format === 'docusaurus') return out;
  const hasTM = fs.existsSync(path.join(cwd, TM_DIR, TM_FILENAME));
  let layout;
  let units;
  let state;
  try {
    layout = discoverLocaleLayout(config, { cwd });
    units = loadSourceUnits(layout);
    state = new LockState(readLock(cwd).locales);
  } catch {
    return out;
  }
  if (!hasTM && Object.values(state.locales).every(l => Object.keys(l.by || {}).length === 0)) return out;
  const tm = hasTM ? loadTM(cwd) : {};
  // A cache from before coaching was keyed reads as sync reads it (in memory).
  adoptLegacyCoachingKeys(tm, pairs.values());
  for (const [, pairConfig] of pairs) {
    const items = [];
    const localeState = state.peek(pairConfig.target);
    for (const unit of units) {
      let file;
      try { file = layout.fileFor(pairConfig.target, unit.ns); } catch { continue; }
      if (!file || !fs.existsSync(file.path)) continue;
      let target;
      try { target = readLocaleFlat(file); } catch { continue; }
      const { flat: expected, expansion } = expectedForTarget(unit, config.inputLocale, pairConfig.target);
      for (const [key, src] of Object.entries(expected)) {
        if (typeof src !== 'string' || typeof target[key] !== 'string') continue;
        // The lock's record of who wrote the value, while it is still the
        // value on disk (a hand edit since makes it no longer apply).
        const lk = lockKey(layout, unit.ns, key);
        const record = decodeWritten(localeState.written[lk]);
        const by = record && record.value === valueHash(target[key]) ? (localeState.by[lk] || null) : null;
        // A key from before coaching was keyed, for this same setup, reads
        // as today's (lib/tm.js canonicalWriterKey).
        const writtenBy = by ? canonicalWriterKey(tm, pairConfig.target, by) : null;
        items.push({ texts: tmProofTextsFor(key, src, expansion), value: target[key], writtenBy });
      }
    }
    out.set(pairConfig.target, modelsBehindValues(tm, pairConfig, items));
  }
  return out;
}

/**
 * Per target locale (pairs with a fallback): how many values in its files the
 * fallback method wrote — the lock's `by` record naming the fallback's method
 * key, while the value is still the one sync wrote. The files themselves do
 * not say which strings came from the fallback (Round 8, school + hospital
 * personas). Key-value files only; empty when nothing can be read.
 *
 * `earlier`: values the fallback wrote as it was set up BEFORE (another
 * model, register or coaching of it — lib/tm.js fallbackWriterOf), which a
 * redo re-translates (Round 10, school persona: after a coaching file was
 * added to the fallback, nothing showed that its values predate it).
 *
 * `written`: every value sync wrote that is still as it wrote it (any
 * method) — the whole the fallback's share is a part of (Round 11, school
 * persona: status said "8 value(s)" with nothing to measure it against).
 *
 * @returns {Map<string, { count: number, keys: string[], earlier: { count: number, keys: string[], by: string[] }, written: number }>}
 */
function fallbackValuesInFiles(config, pairs, cwd) {
  const out = new Map();
  if (config.format === 'docusaurus') return out;
  if (![...pairs.values()].some(pc => pc.fallback)) return out;
  let layout;
  let units;
  let state;
  try {
    layout = discoverLocaleLayout(config, { cwd });
    units = loadSourceUnits(layout);
    state = new LockState(readLock(cwd).locales);
  } catch {
    return out;
  }
  const tm = fs.existsSync(path.join(cwd, TM_DIR, TM_FILENAME)) ? loadTM(cwd) : {};
  adoptLegacyCoachingKeys(tm, pairs.values());
  for (const [, pairConfig] of pairs) {
    if (!pairConfig.fallback) continue;
    const localeState = state.peek(pairConfig.target);
    const keys = [];
    const earlier = { count: 0, keys: [], by: [] };
    let written = 0;
    for (const unit of units) {
      let file;
      try { file = layout.fileFor(pairConfig.target, unit.ns); } catch { continue; }
      if (!file || !fs.existsSync(file.path)) continue;
      let target;
      try { target = readLocaleFlat(file); } catch { continue; }
      const { flat: expected } = expectedForTarget(unit, config.inputLocale, pairConfig.target);
      for (const key of Object.keys(expected)) {
        const lk = lockKey(layout, unit.ns, key);
        if (typeof target[key] !== 'string') continue;
        const record = decodeWritten(localeState.written[lk]);
        if (!record || record.value !== valueHash(target[key])) continue;
        // A value sync wrote that is still as written: the share's whole.
        written++;
        const by = localeState.by?.[lk];
        if (!by) continue;
        const writer = fallbackWriterOf(pairConfig, canonicalWriterKey(tm, pairConfig.target, by));
        if (!writer) continue;
        if (writer === 'current') keys.push(lk);
        else {
          earlier.keys.push(lk);
          if (!earlier.by.includes(by)) earlier.by.push(by);
        }
      }
    }
    earlier.count = earlier.keys.length;
    out.set(pairConfig.target, { count: keys.length, keys, earlier, written });
  }
  return out;
}

/**
 * The status line for a locale whose files hold text from a model other than
 * the current one — a mix of two models, or ALL of it from an earlier model
 * (Round 4, Next.js persona: only the mixed case was reported) — or null.
 */
function mixedModelsLine(pairKey, models, currentModel = null) {
  if (!models || models.length === 0) return null;
  const unify = `champollion sync --pair ${pairKey} --redo all --fresh-on-model-change`;
  const plural = (n) => `${n} key${n === 1 ? '' : 's'}`;
  if (models.length === 1) {
    const only = models[0];
    if (only.current) return null;
    if (only.unknown) {
      return `      model unknown: ${plural(only.keys)} hold text that ${only.candidates.join(' and ')} cached identically, so which of them wrote it `
        + `cannot be told${currentModel ? ` (the current model is ${currentModel})` : ''}. To have the current model translate them: ${unify}`;
    }
    // Both directions: a one-off `sync --model` run wrote them, and the user
    // may want to keep that model (Round 10, Next.js persona).
    return `      earlier model: every translation in the files that can be attributed (${plural(only.keys)}) `
      + `came from ${only.model}${currentModel ? `, not the current model (${currentModel})` : ''}. To have the current model translate them: ${unify}`
      + ` — or, to keep ${only.model}'s text, make it the model: "model": "${only.model}" in champollion.config.json (nothing is sent)`;
  }
  const list = models.map(m => (m.unknown
    ? `model unknown (${plural(m.keys)}: ${m.candidates.join(' and ')} cached the same text)`
    : `${m.model} (${plural(m.keys)}${m.current ? ', current' : ''})`)).join(', ');
  const known = models.filter(m => !m.unknown).length;
  return `      mixed: the files hold text from ${known > 1 ? `${known} models` : 'more than one model'} — ${list}. To have the current model translate the ones an earlier model wrote: ${unify} (what the current model already translated comes from the cache)`;
}

/**
 * Per target locale: keys a redo left pending, translations made from an
 * older source text (out of date), and keys held back because the quality
 * gate refused this method's translation (lib/locale-state.js). Empty for a
 * locale with nothing to say; status never fails on it.
 *
 * @returns {Map<string, { stale: string[], pending: Array<{key: string, reason: string, held: boolean}>, held: string[] }>}
 */
function localeHealthMap(config, pairs, cwd) {
  const out = new Map();
  if (config.format === 'docusaurus') return out;
  let layout;
  let units;
  let lock;
  try {
    layout = discoverLocaleLayout(config, { cwd });
    units = loadSourceUnits(layout);
    lock = readLock(cwd);
  } catch {
    return out;
  }
  const state = new LockState(lock.locales);
  const tm = fs.existsSync(path.join(cwd, TM_DIR, TM_FILENAME)) ? loadTM(cwd) : null;
  for (const [, pairConfig] of pairs) {
    try {
      out.set(pairConfig.target, localeHealth({
        layout, units, inputLocale: config.inputLocale, code: pairConfig.target,
        localeState: state.peek(pairConfig.target), manifest: lock.source, tm, pairConfig,
        helpers: { expectedForTarget, readLocaleFlat, lockKey, originKey, fallbackPrefix: config.fallbackPrefix },
      }));
    } catch { /* a diagnostic: never fails */ }
  }
  return out;
}

/**
 * One line on a pair's gender guidance, or null when there is none to say.
 * @returns {string|null}
 */
function describeGenderSetting(pairConfig) {
  const how = '"genderGuidance" in champollion.config.json changes it (false = none, or your own words)';
  if (pairConfig.genderGuidanceSource === 'off') return `gender: no guidance (set off in the config) — ${how}`;
  const text = summarizeGenderGuidance(pairConfig.genderGuidance);
  if (!text) return null;
  const from = pairConfig.genderGuidanceSource === 'config' ? 'from your config' : 'Champollion\'s default for this language';
  return `gender (${from}; LLM methods): ${text} — ${how}`;
}

/** "a, b, c, +2 more" */
function sampleKeys(keys, n = 5) {
  const shown = keys.slice(0, n).map(k => String(k).replace(/\u0004/g, '\u2404'));
  return `${shown.join(', ')}${keys.length > n ? `, +${keys.length - n} more` : ''}`;
}

/** Status lines for one locale's health (pending / out of date / held back). */
function healthLines(pairKey, health) {
  if (!health) return [];
  const lines = [];
  const pendingHeld = health.pending.filter(p => p.held);
  const pendingNext = health.pending.filter(p => !p.held);
  if (pendingNext.length > 0) {
    const reasons = [...new Set(pendingNext.map(p => p.reason))].join('`, `');
    lines.push(`      pending: ${pendingNext.length} key(s) an earlier \`${reasons}\` could not finish (${sampleKeys(pendingNext.map(p => p.key))}) `
      + '— the next `champollion sync` asks the model for them once more.');
  }
  if (pendingHeld.length > 0) {
    const keys = pendingHeld.map(p => p.key);
    lines.push(`      pending, held back: ${keys.length} key(s) a redo could not finish, refused again on the retry (${sampleKeys(keys)}) `
      + `— not re-sent on a plain sync. Ask again: \`${redoCommand(keys.slice(0, 8), { pair: pairKey })}\`, or fill them `
      + '(a "fallback" method, "noTranslate", or by hand).');
  }
  if (health.held.length > 0) {
    lines.push(`      held back: ${health.held.length} key(s) the quality gate refused from this method (${sampleKeys(health.held)}) `
      + `— not re-sent on a plain sync. Ask again: \`${redoCommand(health.held.slice(0, 8), { pair: pairKey })}\`, or fill them `
      + '(a "fallback" method, "noTranslate", or by hand).');
  }
  if (health.stale.length > 0) {
    lines.push(`      out of date: ${health.stale.length} translation(s) were made from an older source text (${sampleKeys(health.stale)}) `
      + `— \`champollion sync --pair ${pairKey}\` re-translates them${health.held.some(k => health.stale.includes(k)) ? ' (the held-back ones only when named)' : ''}.`);
  }
  return lines;
}

/**
 * Where an OpenAI-compatible method (local, openai) sends its requests, and
 * the setting that chose it — LOCAL_API_BASE in the environment or in .env,
 * or the built-in default (Ollama) — exactly as a connection error names it
 * (Round 7, i18next persona: status did not say which address `local` would
 * call). null for a method with no configurable endpoint.
 *
 * @returns {{ url: string, from: string|null, line: string }|null}
 */
function resolvedEndpoint(pairConfig, cwd) {
  if (pairConfig.method === 'api') return null; // its endpoint is the pair's own, shown as [API]
  let method;
  try { method = getMethod(pairConfig.method, pairConfig); } catch { return null; }
  if (typeof method?._describeEndpoint !== 'function' || typeof method._resolveApiBaseSource !== 'function') return null;
  let line = null;
  let src = null;
  try {
    line = method._describeEndpoint({ cwd, ...(pairConfig.baseUrl ? { baseUrl: pairConfig.baseUrl } : {}) });
    src = method._resolveApiBaseSource({ cwd, ...(pairConfig.baseUrl ? { baseUrl: pairConfig.baseUrl } : {}) });
  } catch { return null; }
  if (!line || !src?.base) return null;
  return { url: src.base, from: src.from || null, line };
}

/** The content lane for status (null without a contentDir). */
function contentState(config, pairs, cwd) {
  if (!config.contentDir || config.format === 'docusaurus') return null;
  try {
    return contentStatus(config.contentDir, config.inputLocale, [...pairs.entries()], cwd, { fallbackPrefix: config.fallbackPrefix || '[EN] ' });
  } catch {
    return null;
  }
}

/** Human lines for the content lane: the folder, its files, each locale's state. */
function contentLines(config, pairs, cwd) {
  const st = contentState(config, pairs, cwd);
  if (!st) return [];
  const lines = [`  Content (Markdown): ${st.dir}/ — ${st.files} source file(s), each translated beside it as <name>.<locale>.md\n`];
  const few = (list) => `${list.slice(0, 3).join(', ')}${list.length > 3 ? `, +${list.length - 3} more` : ''}`;
  for (const [code, l] of Object.entries(st.locales)) {
    const parts = [`${l.translated} translated`];
    if (l.outOfDate.length > 0) parts.push(`${l.outOfDate.length} out of date (${few(l.outOfDate)})`);
    if (l.pending.length > 0) parts.push(`${l.pending.length} pending (${few(l.pending)})`);
    if (l.unrecorded.length > 0) parts.push(`${l.unrecorded.length} with no record — kept as they are (${few(l.unrecorded)})`);
    const todo = l.outOfDate.length + l.pending.length;
    lines.push(`    ${code}: ${parts.join(', ')}${todo > 0 ? ' — `champollion sync` translates the out-of-date and pending ones' : ''}`);
  }
  lines.push('');
  return lines;
}

/**
 * The coaching a pair (or a fallback) carries, for status: where it comes
 * from, and the fingerprint its cache key holds (the "coaching …" that sync's
 * notes name) — or null when it has none. A method that sends no coaching
 * says so: the file changes nothing there (Round 10, school persona: status
 * did not show the fallback's coaching at all).
 *
 * @returns {{ file: string|null, inline: boolean, fingerprint: string|null, sent: boolean }|null}
 */
function coachingOf(pairConfig) {
  const text = typeof pairConfig.coachingPrompt === 'string' && pairConfig.coachingPrompt.trim() ? pairConfig.coachingPrompt : null;
  const file = typeof pairConfig.coachingFile === 'string' && pairConfig.coachingFile.trim() ? pairConfig.coachingFile : null;
  if (!text && !file) return null;
  const sent = COACHING_PROMPT_METHODS.has(pairConfig.method);
  const fingerprint = sent ? (tmMethodKey(pairConfig).split('|')[3] || null) : null;
  return { file, inline: !file, fingerprint, sent };
}

/** "coaching: coaching.json (key f430948b)", or the reason it is not sent. */
function coachingLabel(pairConfig) {
  const c = coachingOf(pairConfig);
  if (!c) return null;
  const what = c.file ? c.file : 'inline coachingPrompt';
  return c.sent
    ? `coaching: ${what}${c.fingerprint ? ` (cache key coaching ${c.fingerprint})` : ''}`
    : `coaching: ${what} — not sent: ${pairConfig.method} takes no coaching`;
}

/** One line describing a pair's fallback, for the human status display. */
function describeFallback(fallback, cwd, pairConfig = null) {
  const model = displayModelFor(fallback);
  const resolved = resolvedEndpoint(fallback, cwd);
  const where = fallback.method === 'api' && fallback.endpoint ? `  |  endpoint: ${fallback.endpoint}`
    : resolved ? `  |  endpoint: ${resolved.line}` : '';
  const coaching = coachingLabel(fallback);
  // Its register only when it is not the pair's (a fallback inherits it).
  const register = pairConfig && (fallback.register !== pairConfig.register || fallback.registerPreset !== pairConfig.registerPreset)
    ? `  |  register: ${fallback.registerPreset || JSON.stringify(String(fallback.register || '').slice(0, 40))}` : '';
  return `      fallback: ${fallback.method}${model ? `  |  model: ${model}` : ''}${where}${coaching ? `  |  ${coaching}` : ''}${register}`
    + '  (translates what the method above cannot translate safely)';
}

// CLI version — read from package.json (the single source of truth), never a
// hardcoded literal. Mirrors bin/cli.js's --version read.
const { version: CLI_VERSION } = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
);

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // --json: stdout carries exactly one JSON document. Quiet mode keeps the
  // human status display off stdout.
  const json = !!args.json;
  if (json) output.setMode('quiet');

  const config = resolveConfig(args, cwd);

  // Auto-detect languages if not configured
  let languages = config.resolvedLanguages;
  if (Object.keys(languages).length === 0) {
    languages = autoDetectLanguages(config);
  }
  config.resolvedLanguages = languages;

  const pairs = resolvePairs(config, { cwd });

  // Load installed plugins to enrich status display
  const plugins = loadPlugins(cwd);

  if (json) {
    return runJson(config, pairs, plugins, cwd);
  }

  output.raw('\n  champollion v3 — Translation Status\n');
  output.raw(`  Input locale:  ${config.inputLocale}`);
  output.raw(`  Locales dir:   ${config.localesDir}`);
  // Multi-file layouts say which files make up a language — the question an
  // i18next user asks first. Flat projects print exactly what they did.
  if (config.format !== 'docusaurus') {
    const layout = discoverLocaleLayout(config, { cwd });
    if (layout.kind !== 'flat') {
      output.raw(`  Layout:        ${layout.kind} — ${layout.display} (${layout.sourceFiles.length} source file(s))`);
    }
  }
  const header = headerModels(config, pairs);
  if (header.defaultModel) output.raw(`  Default model: ${header.defaultModel}`);
  if (header.endpoints.length > 0) {
    output.raw(`  ${header.endpoints.length === 1 ? 'Endpoint:     ' : 'Endpoints:    '} ${header.endpoints.join(', ')}`);
  }
  if (config.temperature != null) {
    output.raw(`  Temperature:   ${config.temperature}`);
  }
  output.raw(`  Config version: ${config.version || '2 (legacy)'}`);


  // Show installed plugins summary
  if (plugins.size > 0) {
    output.raw(`  Plugins:       ${plugins.size} installed`);
  }

  // Show Translation Memory status — gives users immediate feedback
  // that caching is working and how much is cached.
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);
  if (fs.existsSync(tmPath)) {
    const tm = loadTM(cwd);
    const count = tmSize(tm);
    const stat = fs.statSync(tmPath);
    const sizeKB = (stat.size / 1024).toFixed(1);
    output.raw(`  TM cache:      ${count.toLocaleString()} entries (${sizeKB} KB)`);
  } else {
    output.raw('  TM cache:      empty (will populate on first sync)');
  }
  const replaced = countReplacedEdits(cwd);
  if (replaced > 0) {
    output.raw(`  Replaced edits: ${replaced} hand-edited translation(s) a sync replaced, with their wording, in ${REPLACED_EDITS_FILENAME}`);
  }
  output.raw('');

  if (pairs.size === 0) {
    output.raw('  No translation pairs configured.');
    output.raw('  Run `champollion init` or add languages to your config.\n');
  } else {
    output.raw(`  Translation Pairs (${pairs.size}):\n`);
    const mixed = modelsInFiles(config, pairs, cwd);
    const health = localeHealthMap(config, pairs, cwd);
    const fromFallback = fallbackValuesInFiles(config, pairs, cwd);
    for (const [pairKey, pairConfig] of pairs) {
      const tier = QUALITY_TIERS[pairConfig.qualityTier];
      const tierLabel = tier ? tier.label : pairConfig.qualityTier;
      const dirLabel = pairConfig.dir === 'rtl' ? ' [RTL]' : '';
      // Show the RESOLVED script decision, not the converter's existence.
      // The old label printed the registry key ("[crk]"), which read as if
      // conversion were happening whether or not it was.
      const res = pairConfig.scriptResolution;
      let scriptLabel = '';
      if (res?.converterKey) scriptLabel = ` [script: ${res.script ?? res.converterKey}]`;
      else if (res?.source === 'choice-required') scriptLabel = ' [script: CHOICE REQUIRED — see `champollion sync`]';
      else if (res?.source === 'default' && pairConfig.scripts) scriptLabel = ` [script: ${res.script} (converter available)]`;
      // Display arrow is a UI-only semantic element, not a data separator
      output.raw(`    ${pairKey}  →  ${pairConfig.name}${dirLabel}${scriptLabel}`);

      // Resolve display model — direct providers may have model=null in the
      // pair config, meaning the method class picks its own default at runtime.
      // Show the resolved model so users know what will actually be used; a
      // method with no model of ours (api, the MT engines) shows none.
      const displayModel = displayModelFor(pairConfig);
      const modelStr = displayModel ? `  |  model: ${displayModel}` : '';

      // A plugin's benchmarks, when it publishes them; a quality tier only
      // when the config sets one — and then said for what it is: a label
      // someone chose, not a measurement. "quality: Standard" was printed for
      // every pair, from a default nobody set, with no word on what it meant
      // (Round 14, Next.js persona).
      let qualityStr = '';
      if (pairConfig.methodPlugin) {
        const resolvedPair = resolvePluginForPair(plugins, pairConfig);
        const benchmarks = resolvedPair.pluginBenchmarks;
        if (benchmarks && benchmarks[pairConfig.target]) {
          const bm = benchmarks[pairConfig.target];
          const parts = [];
          if (bm.corpus_chrf) parts.push(`chrF++ ${bm.corpus_chrf}`);
          if (bm.exact_match_rate) parts.push(`exact ${Math.round(bm.exact_match_rate * 100)}%`);
          qualityStr = `  |  benchmarks: ${parts.join(', ')}`;
        } else {
          qualityStr = '  |  benchmarks: none in the plugin\'s manifest';
        }
      }
      output.raw(`      method: ${pairConfig.method}${modelStr}${qualityStr}`);
      if (qualityTierSet(pairConfig)) {
        output.raw(`      quality tier: ${tierLabel} — the "qualityTier" your config sets for this pair: a label you chose `
          + `(${Object.keys(QUALITY_TIERS).join(', ')}), not a measurement. Sync translates the same whatever it says; \`serve\` advertises it.`);
      }
      const endpoint = resolvedEndpoint(pairConfig, cwd);
      if (endpoint) output.raw(`      endpoint: ${endpoint.line}`);
      const ownCoaching = coachingLabel(pairConfig);
      if (ownCoaching) output.raw(`      ${ownCoaching}`);
      if (pairConfig.fallback) {
        output.raw(describeFallback(pairConfig.fallback, cwd, pairConfig));
        const fb = fromFallback.get(pairConfig.target);
        const few = (keys) => keys.slice(0, 5).map(k => String(k).replace(/\u0004/g, '\u2404')).join(', ') + (keys.length > 5 ? `, +${keys.length - 5} more` : '');
        if (fb && fb.count > 0) {
          // The share of what sync wrote, and — above FALLBACK_MAJORITY_SHARE —
          // that what ships is mostly the fallback's (as sync warns).
          const share = fb.written > 0 ? fb.count / fb.written : null;
          output.raw(`      from the fallback: ${fb.count} value(s) in the files (${few(fb.keys)})`
            + (share !== null ? ` — ${fb.count} of the ${fb.written} sync wrote (${Math.round(share * 100)}%)` : '')
            + (share !== null && share > FALLBACK_MAJORITY_SHARE
              ? `: most of this locale's text is the fallback's (${pairConfig.fallback.method}), not ${pairConfig.method}'s`
              : ''));
        }
        if (fb && fb.earlier?.count > 0) {
          output.raw(`      from the fallback as it was set up before: ${fb.earlier.count} value(s) (${few(fb.earlier.keys)}) — written by `
            + `${fb.earlier.by.map(describeMethodKey).join('; ')}, not by the fallback as it is now (${describeMethodKey(tmMethodKey(pairConfig.fallback))}). `
            + `A change of the fallback re-translates nothing on its own; to re-translate them: champollion sync --pair ${pairKey} --redo all`);
        }
      }
      // Said once by the first sync; here every time it is asked for.
      if (MODEL_YOU_CHOOSE.has(pairConfig.method)) output.raw(`      licence: ${MODEL_YOU_CHOOSE_NOTE}`);
      // After a model switch without a full re-translation (Round 3).
      const mixedLine = mixedModelsLine(pairKey, mixed.get(pairConfig.target), displayModel);
      if (mixedLine) output.raw(mixedLine);
      for (const line of healthLines(pairKey, health.get(pairConfig.target))) output.raw(line);

      // Plugin badge — show name and version (benchmarks already shown above)
      if (pairConfig.methodPlugin) {
        const resolvedPair = resolvePluginForPair(plugins, pairConfig);
        if (resolvedPair.pluginName) {
          let pluginLine = `      [PLUGIN] ${resolvedPair.pluginName}`;
          if (resolvedPair.pluginVersion) pluginLine += ` v${resolvedPair.pluginVersion}`;
          output.raw(pluginLine);
        }
      }

      // API badge
      if (pairConfig.method === 'api') {
        // Say where it runs: a loopback endpoint (nmt-forge serve, champollion
        // serve) is this machine, not a remote service.
        let host = '';
        try { host = new URL(pairConfig.endpoint || '').hostname; } catch { /* no/invalid endpoint */ }
        const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
        output.raw(local
          ? `      [API] Translation runs on this machine (${pairConfig.endpoint})`
          : `      [API] Translation runs on the endpoint's server${pairConfig.endpoint ? ` (${pairConfig.endpoint})` : ''} — the text is sent there`);
      }

      // Google Translate badge
      if (pairConfig.method === 'google-translate') {
        output.raw('      Google Cloud Translation API');
      }
    }
    output.raw('');

    // The content lane (contentDir: Markdown pages), beside the key-value
    // lane above — what each locale holds of it.
    for (const line of contentLines(config, pairs, cwd)) output.raw(line);

    // Show active registers for each pair with structured card info
    output.raw('  Registers:\n');
    for (const [pairKey, pairConfig] of pairs) {
      const card = getLanguageCard(pairConfig.target);
      const presets = getRegisterPresets(pairConfig.target);
      const systemLabel = card?.formality?.system ? ` (${card.formality.system})` : '';

      // Use registerPreset for direct lookup — no fragile prompt text matching
      const presetKey = pairConfig.registerPreset;
      const matchedPreset = presetKey
        ? presets.find(p => p.key === presetKey)
        : null;

      if (matchedPreset) {
        // Known preset — show key, label, and formality system
        const marker = matchedPreset.isDefault ? ' ★' : '';
        output.raw(`    ${pairConfig.target}  ${matchedPreset.key}${marker}${systemLabel} — ${matchedPreset.label}`);
      } else {
        // Custom register text — show truncated text
        const regText = pairConfig.register || DEFAULT_REGISTER_FALLBACK;
        const truncated = regText.length > 55 ? regText.slice(0, 52) + '...' : regText;
        output.raw(`    ${pairConfig.target}  (custom)${systemLabel} — "${truncated}"`);
      }
      // The gender guidance the prompt carries (LLM methods): visible, with
      // where it comes from and how to change it (Round 8, Django persona:
      // the French prompt asked for écriture inclusive and nothing said so).
      const genderLine = describeGenderSetting(pairConfig);
      if (genderLine) output.raw(`        ${genderLine}`);
    }
    output.raw('');
  }

  return 0;
}

/**
 * --json: assemble everything the human display computes into a single
 * JSON document — config summary, TM cache stats, pair graph with resolved
 * models/tiers/plugins, and per-pair register info.
 */
function runJson(config, pairs, plugins, cwd) {
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);
  let tm = { exists: false, entries: 0, sizeBytes: 0 };
  if (fs.existsSync(tmPath)) {
    const stat = fs.statSync(tmPath);
    tm = { exists: true, entries: tmSize(loadTM(cwd)), sizeBytes: stat.size };
  }

  const pairList = [];
  const mixed = modelsInFiles(config, pairs, cwd);
  const health = localeHealthMap(config, pairs, cwd);
  const fromFallback = fallbackValuesInFiles(config, pairs, cwd);
  for (const [pairKey, pairConfig] of pairs) {
    const tier = QUALITY_TIERS[pairConfig.qualityTier];
    const resolvedPair = resolvePluginForPair(plugins, pairConfig);

    // Same display-model resolution as the human path: direct providers may
    // have model=null (the method class picks its own default at runtime).
    const displayModel = displayModelFor(pairConfig);

    const presets = getRegisterPresets(pairConfig.target);
    const matchedPreset = pairConfig.registerPreset
      ? presets.find(p => p.key === pairConfig.registerPreset)
      : null;

    pairList.push({
      pair: pairKey,
      target: pairConfig.target,
      name: pairConfig.name,
      method: pairConfig.method,
      // null for a method that runs no model of ours (api, the MT engines).
      model: displayModel,
      // Where an `api` pair sends its text (null for every other method).
      endpoint: pairConfig.method === 'api' ? (pairConfig.endpoint || null) : null,
      // Its coaching: the file (null for inline text), the fingerprint its
      // cache key holds, and whether the method sends it (null: none).
      coaching: coachingOf(pairConfig),
      // Where an OpenAI-compatible method (local, openai) sends its requests
      // and the setting that chose it ({ url, from }; absent for other methods).
      ...(() => { const r = resolvedEndpoint(pairConfig, cwd); return r ? { requestsGoTo: { url: r.url, from: r.from } } : {}; })(),
      qualityTier: pairConfig.qualityTier,
      qualityTierLabel: tier ? tier.label : pairConfig.qualityTier,
      // Whether the config sets it (false: the default label, a claim nobody made).
      qualityTierSet: qualityTierSet(pairConfig),
      dir: pairConfig.dir || 'ltr',
      scripts: pairConfig.scripts || null,
      // Resolved script decision (kept alongside legacy `scripts` for compat)
      script: pairConfig.scriptResolution
        ? {
          resolved: pairConfig.scriptResolution.script,
          source: pairConfig.scriptResolution.source,
          converts: !!pairConfig.scriptResolution.converterKey,
        }
        : null,
      plugin: resolvedPair.pluginName
        ? { name: resolvedPair.pluginName, version: resolvedPair.pluginVersion || null }
        : null,
      benchmarks: resolvedPair.pluginBenchmarks?.[pairConfig.target] || null,
      register: matchedPreset
        ? { preset: matchedPreset.key, label: matchedPreset.label, isDefault: !!matchedPreset.isDefault }
        : { preset: null, custom: pairConfig.register || DEFAULT_REGISTER_FALLBACK },
      // The gender guidance LLM prompts carry: catalogue (the default for the
      // language), config (your own), off — and its text.
      genderGuidance: { source: pairConfig.genderGuidanceSource || null, text: pairConfig.genderGuidance || null },
      // Models whose cached output the files hold now (most keys first);
      // more than one = mixed after a model switch.
      modelsInFiles: mixed.get(pairConfig.target) || [],
      // Every attributable value came from a model other than the current one.
      fromEarlierModel: (() => {
        const m = mixed.get(pairConfig.target) || [];
        return m.length === 1 && !m[0].current && !m[0].unknown ? m[0].model : null;
      })(),
      // lib/locale-state.js: keys an unfinished redo left (asked again by the
      // next sync unless held), translations of an older source text, and
      // keys held back after a quality-gate refusal.
      pending: health.get(pairConfig.target)?.pending || [],
      stale: health.get(pairConfig.target)?.stale || [],
      heldBack: health.get(pairConfig.target)?.held || [],
      // A model the user picks: its licence is theirs to check (null otherwise).
      licenceNote: MODEL_YOU_CHOOSE.has(pairConfig.method) ? MODEL_YOU_CHOOSE_NOTE : null,
      // The second method for what this pair's own method cannot translate
      // safely (null when none is configured).
      fallback: pairConfig.fallback
        ? {
          method: pairConfig.fallback.method,
          model: displayModelFor(pairConfig.fallback),
          provider: pairConfig.fallback.provider || null,
          endpoint: pairConfig.fallback.endpoint || null,
          ...(() => { const r = resolvedEndpoint(pairConfig.fallback, cwd); return r ? { requestsGoTo: { url: r.url, from: r.from } } : {}; })(),
          // Its coaching, as for the pair; its register only when not the pair's.
          coaching: coachingOf(pairConfig.fallback),
          ...((pairConfig.fallback.register !== pairConfig.register || pairConfig.fallback.registerPreset !== pairConfig.registerPreset)
            && { register: pairConfig.fallback.registerPreset ? { preset: pairConfig.fallback.registerPreset } : { custom: pairConfig.fallback.register || null } }),
          // Values in the files this fallback wrote (the lock's record), and which.
          ...(fromFallback.has(pairConfig.target) && { valuesInFiles: fromFallback.get(pairConfig.target).count }),
          // Of how many values sync wrote (any method), and the share.
          ...(fromFallback.get(pairConfig.target)?.written > 0 && {
            valuesWritten: fromFallback.get(pairConfig.target).written,
            share: fromFallback.get(pairConfig.target).count / fromFallback.get(pairConfig.target).written,
          }),
          ...(fromFallback.get(pairConfig.target)?.count > 0 && { keys: fromFallback.get(pairConfig.target).keys }),
          // Values it wrote as it was set up before (another model, register
          // or coaching of it): `sync --redo all` re-translates them.
          ...(fromFallback.get(pairConfig.target)?.earlier?.count > 0 && {
            earlierSetup: {
              values: fromFallback.get(pairConfig.target).earlier.count,
              keys: fromFallback.get(pairConfig.target).earlier.keys,
              writtenBy: fromFallback.get(pairConfig.target).earlier.by.map(describeMethodKey),
            },
          }),
        }
        : null,
    });
  }

  const header = headerModels(config, pairs);
  console.log(JSON.stringify({
    command: 'status',
    version: CLI_VERSION,
    inputLocale: config.inputLocale,
    localesDir: config.localesDir,
    // The top-level model — null when no pair runs it (an api-only project).
    defaultModel: header.defaultModel,
    // The endpoints of `api` pairs (what they run is whatever those serve).
    endpoints: header.endpoints,
    temperature: config.temperature ?? null,
    configVersion: config.version || '2 (legacy)',
    format: config.format,
    contentDir: config.contentDir || null,
    plugins: plugins.size,
    tm,
    replacedEdits: { count: countReplacedEdits(cwd), file: REPLACED_EDITS_FILENAME },
    pairs: pairList,
    // The content lane (contentDir): the folder, its source files, and per
    // locale how many translations are current, out of date, pending, or
    // unrecorded (null without a contentDir).
    content: contentState(config, pairs, cwd),
  }, null, 2));

  return 0;
}

export { run };
