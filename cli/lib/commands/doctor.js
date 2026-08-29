/**
 * Command: doctor
 *
 * Comprehensive diagnostics tool for Champollion installations.
 * Checks system health, validates configuration, and troubleshoots
 * common issues with language cards, FSTs, methods, and scoring.
 *
 * Subcommands:
 *   (none)    — Run all checks (full system health report)
 *   cards     — Verify language cards load correctly
 *   config    — Validate project configuration
 *   fst [code] — Check FST installation for a specific language
 *   methods   — Check method dependencies and API keys
 *
 * Exit codes:
 *   0 — All checks passed (or warnings only)
 *   1 — One or more checks failed
 *
 * WHY this command exists:
 *   Champollion has many moving parts — language cards, FSTs, API keys,
 *   Python plugins, scoring specs. When something breaks, users need a
 *   single command that tells them exactly what's wrong and how to fix it.
 *   This is the "easy DX" philosophy: clear diagnostics, not cryptic errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { output } from '../output.js';
import { getAllLanguageCodes, getLanguageCard, resolveCode } from '../registers.js';
import { getEnvOrFileVar } from '../api-key.js';
import { resolveProviderEnv, canonicalEnvName } from '../methods/provider-env.js';

// ── Result tracking ──────────────────────────────────────────────

/**
 * Accumulates check results for the summary.
 * Each check pushes a { status, label, detail } entry.
 */
class DiagnosticReport {
  constructor() {
    this.results = [];
  }

  pass(label, detail = '') {
    this.results.push({ status: 'pass', label, detail });
    output.raw(`  ✅ ${label}${detail ? `     ${detail}` : ''}`);
  }

  warn(label, detail = '') {
    this.results.push({ status: 'warn', label, detail });
    output.raw(`  ⚠️  ${label}${detail ? `     ${detail}` : ''}`);
  }

  fail(label, detail = '') {
    this.results.push({ status: 'fail', label, detail });
    output.raw(`  ❌ ${label}${detail ? `\n     ${detail}` : ''}`);
  }

  /** Pass/warn/fail tallies — shared by summarize() and the --json payload. */
  counts() {
    return {
      passed: this.results.filter(r => r.status === 'pass').length,
      warned: this.results.filter(r => r.status === 'warn').length,
      failed: this.results.filter(r => r.status === 'fail').length,
    };
  }

  /** Print summary line and return exit code. */
  summarize() {
    const { passed, warned, failed } = this.counts();

    output.raw('');
    const parts = [];
    if (passed) parts.push(`${passed} passed`);
    if (warned) parts.push(`${warned} warning${warned > 1 ? 's' : ''}`);
    if (failed) parts.push(`${failed} failed`);
    output.raw(`  ${parts.join(', ')}`);
    output.raw('');

    return failed > 0 ? 1 : 0;
  }
}

// ── Check: Language Cards ────────────────────────────────────────

/**
 * Verify language cards load correctly and report coverage stats.
 */
function checkCards(report) {
  output.raw('');
  output.raw('  ── Language Cards ──');
  output.raw('');

  try {
    const allCodes = getAllLanguageCodes();
    const cardCount = allCodes.length;

    if (cardCount === 0) {
      report.fail('Language cards', 'No cards loaded. Check shared/language-cards/ directory.');
      return;
    }

    report.pass(`Language cards`, `${cardCount.toLocaleString()} cards loaded`);

    // Check for cards with missing required fields
    let missingScript = 0;
    let missingName = 0;
    let withFST = 0;
    let withFormality = 0;
    let withMetricModel = 0;

    for (const code of allCodes) {
      const card = getLanguageCard(code);
      if (!card) continue;
      if (!card.name) missingName++;
      if (!card.script && !card.scriptUnicodeName) missingScript++;
      const fsts = card.resources?.fsts || [];
      if (fsts.length > 0 && fsts[0].install) withFST++;
      if (card.formality) withFormality++;
      if (card.metricModelSupport) withMetricModel++;
    }

    // Stats line
    output.raw(`           FST install metadata: ${withFST} cards`);
    output.raw(`           Formality systems:    ${withFormality} cards`);
    output.raw(`           Metric model support: ${withMetricModel} cards`);

    if (missingName > 0) {
      report.warn(`Cards missing name`, `${missingName} cards have no 'name' field`);
    }

    // Check genus cards
    const genusDir = path.join(
      findCardsDir() || '',
      'genera'
    );
    if (fs.existsSync(genusDir)) {
      const genusFiles = fs.readdirSync(genusDir).filter(f => f.endsWith('.json'));
      report.pass(`Genus cards`, `${genusFiles.length} genus/family cards in genera/`);
    }
  } catch (err) {
    report.fail('Language cards', `Failed to load: ${err.message}`);
  }
}

// ── Check: Config ────────────────────────────────────────────────

/**
 * Validate the project configuration file.
 */
function checkConfig(report, cwd) {
  output.raw('');
  output.raw('  ── Project Config ──');
  output.raw('');

  // Find config file
  const configNames = ['champollion.config.json', 'champollion.config.js', '.champollionrc.json'];
  let configPath = null;

  for (const name of configNames) {
    const candidate = path.join(cwd, name);
    if (fs.existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    report.warn('Config file', `No config file found in ${cwd}. Run 'champollion init' to create one.`);
    return;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    report.pass('Config file', path.basename(configPath));

    // Validate language codes resolve
    const languages = Array.isArray(config.languages)
      ? config.languages
      : (config.languages ? Object.keys(config.languages) : []);

    if (languages.length === 0) {
      report.warn('Languages', 'No target languages configured');
    } else {
      let unresolved = 0;
      const unresolvedCodes = [];

      for (const code of languages) {
        const resolved = resolveCode(code);
        if (!resolved) {
          unresolved++;
          unresolvedCodes.push(code);
        }
      }

      if (unresolved > 0) {
        report.fail(
          'Language resolution',
          `${unresolved} code(s) not found in language cards: ${unresolvedCodes.join(', ')}`
        );
      } else {
        report.pass('Language resolution', `${languages.length} language(s) all resolve to valid cards`);
      }
    }

    // Check for input locale
    if (config.inputLocale) {
      const resolved = resolveCode(config.inputLocale);
      if (resolved) {
        report.pass('Input locale', `${config.inputLocale} → ${resolved}`);
      } else {
        report.fail('Input locale', `"${config.inputLocale}" does not resolve to a language card`);
      }
    }

    // Check method. The config schema field is `defaultMethod` (see config.js
    // DEFAULTS) — reading the non-existent `config.method` made doctor warn on
    // EVERY correct project, including the config `champollion init` writes.
    // Accept the legacy `method` alias too, and treat absence as the documented
    // default ('llm') rather than a misconfiguration.
    const method = config.defaultMethod || config.method;
    if (method) {
      report.pass('Method', method);
    } else {
      report.pass('Method', 'llm (default)');
    }

  } catch (err) {
    if (err instanceof SyntaxError) {
      report.fail('Config file', `Invalid JSON in ${path.basename(configPath)}: ${err.message}`);
    } else {
      report.fail('Config file', `Failed to read: ${err.message}`);
    }
  }
}

// ── Check: FST ───────────────────────────────────────────────────

/**
 * Check FST installation for a specific language or all configured.
 */
function checkFST(report, langCode) {
  output.raw('');
  output.raw(`  ── FST: ${langCode || 'all'} ──`);
  output.raw('');

  // If a specific code was given, check just that one
  const codesToCheck = langCode
    ? [resolveCode(langCode) || langCode]
    : getAllLanguageCodes().filter(code => {
        const card = getLanguageCard(code);
        const fsts = card?.resources?.fsts || [];
        return fsts.length > 0 && fsts[0].install;
      });

  if (codesToCheck.length === 0) {
    if (langCode) {
      report.warn(`FST (${langCode})`, 'No FST install metadata on this language card');
    } else {
      report.warn('FST', 'No languages have FST install metadata on their cards');
    }
    return;
  }

  for (const code of codesToCheck) {
    const card = getLanguageCard(code);
    if (!card) {
      report.fail(`FST (${code})`, `No language card found for "${code}"`);
      continue;
    }

    const fsts = card.resources?.fsts || [];
    const installInfo = fsts[0]?.install;

    if (!installInfo) {
      report.warn(`FST (${code})`, 'Card has resources.fsts but no install metadata');
      continue;
    }

    // Check local cache
    const cacheDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '/tmp',
      '.mt-eval', 'fsts', code
    );
    const cacheExists = fs.existsSync(cacheDir);

    if (cacheExists) {
      // Check for .hfstol files
      try {
        const files = fs.readdirSync(cacheDir).filter(f =>
          f.endsWith('.hfstol') || f.endsWith('.hfst')
        );

        if (files.length > 0) {
          const totalSize = files.reduce((sum, f) => {
            try { return sum + fs.statSync(path.join(cacheDir, f)).size; } catch { return sum; }
          }, 0);
          const sizeStr = totalSize > 1024 * 1024
            ? `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
            : `${(totalSize / 1024).toFixed(0)}KB`;

          const maturityNote = installInfo.maturity === 'stub'
            ? ' (stub — limited vocabulary)'
            : '';

          report.pass(
            `FST (${code} — ${card.name || code})`,
            `Installed: ${files.join(', ')} (${sizeStr})${maturityNote}`
          );
        } else {
          report.warn(
            `FST (${code})`,
            `Cache dir exists but no .hfstol/.hfst files found in ${cacheDir}`
          );
        }
      } catch (err) {
        report.warn(`FST (${code})`, `Could not read cache dir: ${err.message}`);
      }
    } else {
      // Not installed — give install guidance
      const detail = installInfo.format === 'manual'
        ? `Not installed. Manual setup required — see ${installInfo.repo}`
        : `Not installed. Run the eval harness to auto-download from ${installInfo.repo}@${installInfo.releaseTag || 'latest'}`;

      report.warn(`FST (${code} — ${card.name || code})`, detail);
    }
  }
}

// ── Check: Methods ───────────────────────────────────────────────

/**
 * Check method dependencies: API keys, packages, server reachability.
 *
 * @param {DiagnosticReport} report
 * @param {string} cwd - Project root, for .env.local/.env key lookup
 */
async function checkMethods(report, cwd) {
  output.raw('');
  output.raw('  ── Methods ──');
  output.raw('');

  // API key checks.
  //
  // Every lookup goes through getEnvOrFileVar (process.env → .env.local →
  // .env) — the SAME resolution chain the translation engine uses. Checking
  // process.env alone made doctor report "not set" for a key the engine
  // would happily read from .env.local (the very file our own setup help
  // tells users to put it in) — a false negative that sent users chasing a
  // problem they didn't have.
  //
  // For self-contained MT providers (deepl/google/microsoft) we resolve
  // through the provider-env SSOT so doctor agrees with the method loader:
  // it must never report "ready" under a name the loader won't read, nor
  // "not set" for a name the loader *would* read. `method` keys into the
  // SSOT; `key` is a single hardcoded name for providers not in the SSOT.
  const apiKeyChecks = [
    { method: 'deepl',                label: 'DeepL' },
    { method: 'google-translate',     label: 'Google Translate' },
    { method: 'microsoft-translator', label: 'Microsoft Translator' },
    { key: 'OPENAI_API_KEY',     label: 'OpenAI' },
    { key: 'ANTHROPIC_API_KEY',  label: 'Anthropic' },
    { key: 'GEMINI_API_KEY',     label: 'Gemini' },
  ];

  // LLM via OpenRouter
  const openRouterKey = getEnvOrFileVar('OPENROUTER_API_KEY', cwd);
  if (openRouterKey) {
    const source = process.env.OPENROUTER_API_KEY ? 'environment' : '.env.local/.env';
    report.pass('OpenRouter API key', `Set via ${source} (LLM methods available)`);

    // Try to validate by checking the /api/v1/models endpoint
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${openRouterKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const modelCount = data.data?.length || 0;
        report.pass('OpenRouter API', `Connected — ${modelCount} models available`);
      } else {
        report.warn('OpenRouter API', `HTTP ${resp.status} — key may be invalid`);
      }
    } catch (err) {
      report.warn('OpenRouter API', `Could not reach API: ${err.message}`);
    }
  } else {
    report.warn('OpenRouter API key', 'OPENROUTER_API_KEY not set (checked environment, .env.local, .env) — LLM methods unavailable');
  }

  // Check individual provider API keys
  for (const { method, key, label } of apiKeyChecks) {
    if (method) {
      // SSOT-backed provider: accept canonical + any alias, and report
      // exactly which name resolved so doctor and the loader can't disagree.
      const { value, name } = resolveProviderEnv(method, cwd);
      const canonical = canonicalEnvName(method);
      if (value) {
        const via = name === canonical ? `${name} is set` : `${name} is set (alias for ${canonical})`;
        report.pass(`${label}`, via);
      } else {
        // Not an error — just informational. Most users only use one or two providers.
        output.raw(`  ◻️  ${label}     ${canonical} not set`);
      }
    } else if (getEnvOrFileVar(key, cwd)) {
      report.pass(`${label}`, `${key} is set`);
    } else {
      // Not an error — just informational. Most users only use one or two providers.
      output.raw(`  ◻️  ${label}     ${key} not set`);
    }
  }

  // Check LibreTranslate server (if configured). Resolve the endpoint through
  // the SSOT (LIBRETRANSLATE_API_URL canonical, LIBRETRANSLATE_URL / LIBRE_URL
  // aliases) so doctor probes the same URL the LibreTranslate method reads.
  const libreUrl = resolveProviderEnv('libretranslate', cwd).value;
  if (libreUrl) {
    // LIBRETRANSLATE_API_URL is the full translate endpoint (…/translate),
    // but /languages hangs off the server base. Strip a trailing /translate
    // so we probe the same server the method talks to, whether the user set
    // the canonical endpoint var or a legacy base-URL alias.
    const libreBase = libreUrl.replace(/\/translate\/?$/, '').replace(/\/$/, '');
    try {
      const resp = await fetch(`${libreBase}/languages`, {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const langs = await resp.json();
        report.pass('LibreTranslate', `Server reachable at ${libreBase} — ${langs.length} languages`);
      } else {
        report.warn('LibreTranslate', `Server at ${libreBase} returned HTTP ${resp.status}`);
      }
    } catch (err) {
      report.fail('LibreTranslate', `Cannot reach ${libreBase}: ${err.message}`);
    }
  }

  // Check if crk-translate (or other external methods) are pip-installed
  try {
    const { execSync } = await import('node:child_process');
    const pipList = execSync('pip3 list --format=json 2>/dev/null || pip list --format=json 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const packages = JSON.parse(pipList);
    const mtPackages = packages.filter(p =>
      p.name.includes('translate') || p.name.includes('mt-eval') || p.name.includes('champollion')
    );
    if (mtPackages.length > 0) {
      report.pass(
        'Python packages',
        mtPackages.map(p => `${p.name}==${p.version}`).join(', ')
      );
    }
  } catch {
    // pip not available or failed — not critical for CLI-only users
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Find the language cards directory by walking up from CWD.
 */
function findCardsDir() {
  // The cards are always at cli/shared/language-cards/ relative to the monorepo root
  // Walk up looking for a cli/shared/language-cards/ directory
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'cli', 'shared', 'language-cards');
    if (fs.existsSync(candidate)) return candidate;

    // Also check shared/language-cards/ (when CWD is cli/)
    const candidate2 = path.join(dir, 'shared', 'language-cards');
    if (fs.existsSync(candidate2)) return candidate2;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── Main Entry Point ─────────────────────────────────────────────

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = errors found)
 */
async function run(args, cwd) {
  const subcommand = args._[1];
  const report = new DiagnosticReport();

  // --json: stdout carries exactly one JSON document. Quiet mode suppresses
  // every check's raw line; the results array captures the same information.
  const json = !!args.json;
  if (json) output.setMode('quiet');

  output.raw('');
  output.raw('  Champollion Doctor — System Health Check');
  output.raw('  ────────────────────────────────────────');

  if (!subcommand || subcommand === 'all') {
    // Full diagnostic
    checkCards(report);
    checkConfig(report, cwd);
    checkFST(report, null);
    await checkMethods(report, cwd);
  } else if (subcommand === 'cards') {
    checkCards(report);
  } else if (subcommand === 'config') {
    checkConfig(report, cwd);
  } else if (subcommand === 'fst') {
    const langCode = args._[2] || null;
    checkFST(report, langCode);
  } else if (subcommand === 'methods') {
    await checkMethods(report, cwd);
  } else {
    if (json) {
      console.log(JSON.stringify({
        command: 'doctor',
        error: `Unknown subcommand "${subcommand}"`,
        subcommands: ['all', 'cards', 'config', 'fst', 'methods'],
      }, null, 2));
      return 0;
    }
    output.raw(`
  Doctor Subcommands:

    champollion doctor               Run all checks
    champollion doctor cards         Verify language cards
    champollion doctor config        Validate project config
    champollion doctor fst [code]    Check FST installation
    champollion doctor methods       Check API keys and dependencies
    `);
    return 0;
  }

  if (json) {
    const { passed, warned, failed } = report.counts();
    console.log(JSON.stringify({
      command: 'doctor',
      subcommand: subcommand || 'all',
      results: report.results,
      passed,
      warned,
      failed,
    }, null, 2));
    return failed > 0 ? 1 : 0;
  }

  return report.summarize();
}

export { run };
