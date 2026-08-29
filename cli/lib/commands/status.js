/**
 * Command: status
 *
 * Shows the translation pair graph, config summary, installed plugins,
 * TM cache stats, and benchmark scores. A diagnostic tool for understanding
 * how the project is configured before running sync.
 */

import { resolveConfig, autoDetectLanguages } from '../config.js';
import { resolvePairs, QUALITY_TIERS } from '../pairs.js';
import { loadPlugins, resolvePluginForPair } from '../plugins.js';
import { DEFAULT_REGISTERS, getLanguageCard, getRegisterPresets, DEFAULT_REGISTER_FALLBACK } from '../registers.js';
import { loadTM, tmSize, TM_DIR, TM_FILENAME } from '../tm.js';
import { getMethod } from '../translate.js';
import { output } from '../output.js';
import fs from 'node:fs';
import path from 'node:path';

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

  const pairs = resolvePairs(config);

  // Load installed plugins to enrich status display
  const plugins = loadPlugins(cwd);

  if (json) {
    return runJson(config, pairs, plugins, cwd);
  }

  output.raw('\n  champollion v3 — Translation Status\n');
  output.raw(`  Input locale:  ${config.inputLocale}`);
  output.raw(`  Locales dir:   ${config.localesDir}`);
  output.raw(`  Default model: ${config.model}`);
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
  output.raw('');

  if (pairs.size === 0) {
    output.raw('  No translation pairs configured.');
    output.raw('  Run `champollion init` or add languages to your config.\n');
  } else {
    output.raw(`  Translation Pairs (${pairs.size}):\n`);
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
      // Show the resolved model so users know what will actually be used.
      let displayModel = pairConfig.model;
      if (!displayModel && pairConfig.method !== 'api') {
        try {
          const method = getMethod(pairConfig.method);
          displayModel = method._getDefaultModel?.() || 'auto';
        } catch { displayModel = 'auto'; }
      }
      const modelStr = pairConfig.method === 'api' ? '' : `  |  model: ${displayModel || 'auto'}`;

      // Show benchmarks if plugin has them; otherwise show tier as self-reported
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
          qualityStr = `  |  quality: ${tierLabel} (self-reported, no benchmarks)`;
        }
      } else {
        qualityStr = `  |  quality: ${tierLabel}`;
      }
      output.raw(`      method: ${pairConfig.method}${modelStr}${qualityStr}`);

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
        output.raw('      [API] Translation runs server-side (IP protected)');
      }

      // Google Translate badge
      if (pairConfig.method === 'google-translate') {
        output.raw('      Google Cloud Translation API');
      }
    }
    output.raw('');

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
  for (const [pairKey, pairConfig] of pairs) {
    const tier = QUALITY_TIERS[pairConfig.qualityTier];
    const resolvedPair = resolvePluginForPair(plugins, pairConfig);

    // Same display-model resolution as the human path: direct providers may
    // have model=null (the method class picks its own default at runtime).
    let displayModel = pairConfig.model;
    if (!displayModel && pairConfig.method !== 'api') {
      try {
        const method = getMethod(pairConfig.method);
        displayModel = method._getDefaultModel?.() || 'auto';
      } catch { displayModel = 'auto'; }
    }

    const presets = getRegisterPresets(pairConfig.target);
    const matchedPreset = pairConfig.registerPreset
      ? presets.find(p => p.key === pairConfig.registerPreset)
      : null;

    pairList.push({
      pair: pairKey,
      target: pairConfig.target,
      name: pairConfig.name,
      method: pairConfig.method,
      model: pairConfig.method === 'api' ? null : (displayModel || 'auto'),
      qualityTier: pairConfig.qualityTier,
      qualityTierLabel: tier ? tier.label : pairConfig.qualityTier,
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
    });
  }

  console.log(JSON.stringify({
    command: 'status',
    version: CLI_VERSION,
    inputLocale: config.inputLocale,
    localesDir: config.localesDir,
    defaultModel: config.model,
    temperature: config.temperature ?? null,
    configVersion: config.version || '2 (legacy)',
    format: config.format,
    contentDir: config.contentDir || null,
    plugins: plugins.size,
    tm,
    pairs: pairList,
  }, null, 2));

  return 0;
}

export { run };
