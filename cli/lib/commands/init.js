/**
 * Command: init
 *
 * Interactive setup wizard that creates a v3 config file.
 * Uses Node.js built-in readline — zero external dependencies.
 *
 * When run non-interactively (piped stdin, CI, or --yes flag), generates
 * a default config from flags (--langs, --method, --model, ...) instead.
 * In interactive mode the same flags prefill the wizard's defaults, so
 * `champollion init --langs fr,de` walks the wizard with fr,de ready to
 * accept. Flag values are validated up front — a typo'd --method or an
 * out-of-range --temperature fails loudly before anything is written.
 *
 * Wizard flow (6 steps):
 *   1. Languages — source locale + target languages (with presets)
 *   2. Registers — guided tone/formality selection per language
 *   3. Translation Method — accept defaults, pick one, or configure per language
 *   4. Temperature — sampling temperature for LLM determinism control
 *   5. Content Translation — Hugo, Docusaurus, or none
 *   6. Confirm — review summary, write config, show next steps
 *
 * WHY registers before method: After choosing languages, the user should
 * immediately learn about each language's formality system. This is the core
 * value proposition. Method selection then follows — the user can make an
 * informed choice knowing that LLM methods respect register prompts while
 * API methods (except DeepL) ignore them.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { CONFIG_FILENAMES, DEFAULT_OPENROUTER_MODEL, DEFAULT_BATCH_SIZE, DEFAULT_TEMPERATURE, DEFAULT_COACHED_TEMPERATURE, detectDocusaurus } from '../config.js';
import { DEFAULT_REGISTERS, getLanguageCard, getRegisterPresets, isMethodSupported, resolveCode, summarizeGenderGuidance, isPrivateUseCode } from '../registers.js';
import { getConverterInfo, resolveTargetScript, converterKeyForLocale } from '../scripts.js';
import { fetchAvailableModels, resolveProviderApiKey, isListableProvider, getProviderLabel, requireExactModelId } from '../models.js';
import { showCommandHelp } from '../command-help.js';
import { output } from '../output.js';
import { flutterLocaleLines } from '../flutter-locales.js';
import { detectFramework } from '../lint.js';
import { LOCALE_FILE_FORMATS } from '../format.js';
import {
  discoverLocaleLayout, createMissingTargetFiles, formatForExtension, walkLocaleFiles,
  compileLocalesPattern, detectFlutterL10n, detectGettextLayout,
} from '../locale-layout.js';
import { findLocalOnlyMarks } from '../local-only-marks.js';

const DEFAULT_CONFIG_FILENAME = CONFIG_FILENAMES[0]; // champollion.config.json

// Popular language groups for quick selection
const LANGUAGE_PRESETS = {
  european: ['fr', 'de', 'es', 'it', 'pt', 'nl'],
  asian: ['ja', 'zh', 'ko'],
  global: ['fr', 'es', 'de', 'ja', 'zh', 'ko', 'pt', 'ar'],
  nordic: ['da', 'fi', 'nb', 'sv'],
};

/**
 * Available translation methods — presented in the wizard as numbered options.
 * Order matters: OpenRouter first (default), then GT, then direct LLM APIs,
 * then other API services.
 *
 * Each entry contains the method name (matching METHOD_REGISTRY in translate.js),
 * a display label, a short description, the env var needed, and whether it's
 * an LLM method (which means we should ask about the model).
 */
const METHOD_OPTIONS = [
  {
    method: 'llm',
    label: 'OpenRouter',
    desc: '200+ models via one API. Most flexible.',
    envVar: 'OPENROUTER_API_KEY',
    isLLM: true,
    category: 'llm',
    sendsTo: 'OpenRouter, a hosted service, which passes them to the model\'s provider',
  },
  {
    method: 'openai',
    label: 'OpenAI (GPT-4o)',
    desc: 'Direct OpenAI API. Strong for European languages.',
    envVar: 'OPENAI_API_KEY',
    isLLM: true,
    category: 'llm',
    sendsTo: 'OpenAI\'s hosted API',
  },
  {
    method: 'anthropic',
    label: 'Anthropic (Claude)',
    desc: 'Direct Anthropic API. Strong for nuanced text.',
    envVar: 'ANTHROPIC_API_KEY',
    isLLM: true,
    category: 'llm',
    sendsTo: 'Anthropic\'s hosted API',
  },
  {
    method: 'gemini',
    label: 'Google Gemini',
    desc: 'Free tier available. Good quality.',
    envVar: 'GEMINI_API_KEY',
    isLLM: true,
    category: 'llm',
    sendsTo: 'Google\'s hosted Gemini API',
  },
  {
    // A model on this machine (or your own server) behind an
    // OpenAI-compatible endpoint: Ollama, vLLM, LM Studio, llama.cpp — or a
    // model you trained with nmt-forge (`nmt-forge serve`). It worked in sync
    // all along, but init refused it, so the one privacy-preserving setup
    // could not be configured (synthetic hospital persona, 2026-10-03).
    method: 'local',
    label: 'Local / self-hosted model',
    desc: 'Ollama, vLLM, LM Studio, or your own trained model. Text never leaves your machine.',
    envVar: 'LOCAL_API_BASE',
    envOptional: true,
    envExample: 'http://localhost:11434/v1   # default (Ollama)',
    isLLM: true,
    category: 'llm',
  },
  {
    method: 'deepl',
    label: 'DeepL',
    desc: 'Built-in formality for some languages. 30+ languages.',
    envVar: 'DEEPL_API_KEY',
    isLLM: false,
    category: 'api',
    sendsTo: 'DeepL\'s hosted API',
  },
  {
    method: 'microsoft-translator',
    label: 'Microsoft Translator',
    desc: 'Azure Cognitive Services. 100+ languages.',
    envVar: 'MICROSOFT_TRANSLATOR_API_KEY',
    isLLM: false,
    category: 'api',
    sendsTo: 'Microsoft\'s hosted Translator API',
  },
  {
    method: 'libretranslate',
    label: 'LibreTranslate',
    desc: 'Open source, self-hosted. Privacy-first.',
    envVar: 'LIBRETRANSLATE_API_URL',
    isLLM: false,
    category: 'api',
    sendsTo: 'the LibreTranslate server LIBRETRANSLATE_API_URL names (on this machine only if that URL is)',
  },
  {
    method: 'google-translate',
    label: 'Google Translate',
    desc: 'Cheapest at scale. 130+ languages.',
    envVar: 'GOOGLE_TRANSLATE_API_KEY',
    isLLM: false,
    category: 'api',
    sendsTo: 'Google\'s hosted Cloud Translation API',
  },
];

/**
 * `--method api`: a server speaking the champollion API contract — a model
 * you trained, served by `nmt-forge serve`, or any hosted endpoint. Flags
 * only (`--endpoint`), not a wizard choice: the endpoint is per pair, and the
 * persona who needed it hand-wrote the pair config from forge's DEPLOY.md
 * (Round 5, hospital persona). init writes the same pair entries DEPLOY.md
 * shows: { "method": "api", "endpoint": …, "acceptsInstructions": … }.
 */
const API_METHOD = 'api';
const API_KEY_ENV = 'CHAMPOLLION_API_KEY';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Whether the endpoint follows per-key instructions: the flag, else an
 * installed plugin manifest for the same endpoint (`champollion plugin
 * install` copies forge's plugin/method.json to .champollion/methods/), else
 * unknown (null — the CLI then sends the text alone, as for false).
 *
 * @param {object} args
 * @param {string} cwd
 * @returns {{ value: boolean|null, from: string|null }}
 */
function resolveAcceptsInstructions(args, cwd) {
  if (args['accepts-instructions'] != null) {
    return { value: String(args['accepts-instructions']) === 'true', from: '--accepts-instructions' };
  }
  const dir = path.join(cwd, '.champollion', 'methods');
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return { value: null, from: null }; }
  const want = String(args.endpoint).replace(/\/+$/, '');
  for (const name of names.sort()) {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(dir, name, 'method.json'), 'utf-8')); } catch { continue; }
    if (!manifest || typeof manifest.endpoint !== 'string' || manifest.endpoint.replace(/\/+$/, '') !== want) continue;
    if (typeof manifest.acceptsInstructions === 'boolean') {
      return { value: manifest.acceptsInstructions, from: `.champollion/methods/${name}/method.json` };
    }
  }
  return { value: null, from: null };
}

/**
 * One pair entry per target for `--method api`, exactly DEPLOY.md's shape.
 *
 * @param {object} config - Mutated: `pairs` gains `<source>:<target>` entries
 * @param {string[]} targets
 * @param {string} endpoint
 * @param {boolean|null} acceptsInstructions
 */
function writeApiPairs(config, targets, endpoint, acceptsInstructions) {
  config.pairs = config.pairs || {};
  for (const code of targets) {
    config.pairs[`${config.inputLocale}:${code}`] = {
      method: API_METHOD,
      endpoint,
      ...(typeof acceptsInstructions === 'boolean' && { acceptsInstructions }),
    };
  }
}

// -----------------------------------------------------------------
// Locale layout detection
// -----------------------------------------------------------------

/**
 * Where each framework keeps its locale files, keyed by the framework name
 * lib/lint.js detectFramework() reports. Probed IN ORDER and only trusted
 * when the source locale's file is actually on disk — a framework's
 * convention is a hint, never an answer.
 *
 * WHY: two synthetic users failed their first sync here. A next-intl app
 * (messages/en.json) got localesDir "./locales"; an i18next app
 * (public/locales/en/common.json — one folder per language, one file per
 * namespace) had no supported layout at all.
 *
 * Docusaurus is not listed: it has its own lane (format "docusaurus",
 * i18n/<locale>/), handled before these probes.
 */
const FRAMEWORK_LAYOUTS = {
  'next-intl': [
    { dir: 'messages', layout: 'flat', shape: 'messages/{lang}.json' },
    // App Router projects keep them under app/ or src/ (Round 3, school persona).
    { dir: 'app/messages', layout: 'flat', shape: 'app/messages/{lang}.json' },
    { dir: 'src/messages', layout: 'flat', shape: 'src/messages/{lang}.json' },
  ],
  'react-i18next': [
    { dir: 'public/locales', layout: 'dir', shape: 'public/locales/{lang}/{ns}.json' },
    { dir: 'locales', layout: 'dir', shape: 'locales/{lang}/{ns}.json' },
  ],
  'vue-i18n': [
    { dir: 'src/locales', layout: 'flat', shape: 'src/locales/{lang}.json' },
  ],
  Hugo: [
    { dir: 'i18n', layout: 'flat', formats: ['toml', 'yaml'], shape: 'i18n/{lang}.toml|yaml' },
  ],
};

/**
 * Framework-independent places projects keep locale files, probed after the
 * framework's own (each for both one-file-per-locale and folder-per-locale).
 */
const GENERIC_LOCALE_DIRS = [
  'locales', 'messages', 'i18n', 'lang', 'translations', 'public/locales', 'src/locales', 'src/i18n',
  'app/messages', 'src/messages', 'app/locales', 'app/i18n',
];

/**
 * When none of the named folders holds the source, init looks one or two
 * levels down for a folder with one of these names (apps/web/messages,
 * frontend/src/locales, …): a project whose locale files are not at the
 * root was configured with a localesDir pointing nowhere and hand-edited
 * (Round 3, school persona).
 */
const LOCALE_DIR_NAMES = new Set(['locales', 'locale', 'messages', 'i18n', 'lang', 'translations', 'l10n']);

/** Folders a project search never descends into. */
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'out', 'coverage', 'target', 'venv', 'env',
  '__pycache__', 'Pods', 'DerivedData', 'tmp', 'temp',
]);

/**
 * Folders at depth 1–2 (relative to cwd) whose name says "locales" —
 * the bounded fallback probe. Hidden folders and SKIP_DIRS are not searched.
 *
 * @param {string} cwd
 * @returns {string[]} project-relative paths, shallowest first
 */
function nestedLocaleDirs(cwd) {
  const out = [];
  const list = (abs) => {
    try { return fs.readdirSync(abs, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; }
  };
  const visible = (e) => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name);
  for (const a of list(cwd).filter(visible)) {
    for (const b of list(path.join(cwd, a.name)).filter(visible)) {
      if (LOCALE_DIR_NAMES.has(b.name)) out.push(`${a.name}/${b.name}`);
    }
  }
  for (const a of list(cwd).filter(visible)) {
    for (const b of list(path.join(cwd, a.name)).filter(visible)) {
      for (const c of list(path.join(cwd, a.name, b.name)).filter(visible)) {
        if (LOCALE_DIR_NAMES.has(c.name)) out.push(`${a.name}/${b.name}/${c.name}`);
      }
    }
  }
  return out;
}

/** Markdown files that are project paperwork, not content to translate. */
const PAPERWORK_MD = /^(readme|changelog|license|licence|contributing|code_of_conduct|security|authors|history|notice)(\.[a-z-]+)?\.mdx?$/i;

/**
 * Folders (depth 1–2) holding Markdown/MDX content — what init SUGGESTS for
 * --content-dir. Never enabled on its own: translating a folder of pages is
 * billed work the user chooses (Round 3, school persona's newsletter/).
 *
 * @param {string} cwd
 * @param {string[]} [exclude] - absolute paths not to suggest (the locales folder)
 * @returns {Array<{ dir: string, files: number }>} most files first, at most 2
 */
function suggestContentDirs(cwd, exclude = []) {
  const found = [];
  const visible = (e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name);
  const countMd = (abs, depth) => {
    let n = 0;
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
      if (e.isFile() && /\.mdx?$/i.test(e.name) && !PAPERWORK_MD.test(e.name)) n++;
      else if (depth > 0 && visible(e)) n += countMd(path.join(abs, e.name), depth - 1);
    }
    return n;
  };
  let top;
  try { top = fs.readdirSync(cwd, { withFileTypes: true }).filter(visible); } catch { return []; }
  for (const e of top) {
    const abs = path.join(cwd, e.name);
    if (exclude.some(x => abs === x || x.startsWith(abs + path.sep) || abs.startsWith(x + path.sep))) continue;
    const files = countMd(abs, 2);
    if (files > 0) found.push({ dir: e.name, files });
  }
  return found.sort((a, b) => b.files - a.files || a.dir.localeCompare(b.dir)).slice(0, 2);
}

/** "./messages" — the form written into champollion.config.json. */
function configPath(cwd, abs) {
  const rel = path.relative(cwd, abs).split(path.sep).join('/');
  return rel ? `./${rel}` : '.';
}
const projectRelative = configPath;

/**
 * Flutter and gettext projects, found BEFORE the folder probes: their
 * layouts are patterns (lib/l10n/app_{lang}.arb,
 * locale/{lang}/LC_MESSAGES/{ns}.po) that a "<dir>/<lang>.<ext>" probe
 * cannot express — a Django project's locale/ is not even on the generic
 * list. The detection itself lives with the layouts (lib/locale-layout.js
 * detectFlutterL10n / detectGettextLayout); this turns it into init's
 * `found` shape, or records why a project that IS Flutter/gettext was not
 * configured (no template / no source catalog) so init can say so.
 *
 * @param {string} cwd
 * @param {string} source - Source locale code
 * @param {object} result - detectLocaleSetup's result (framework + hints are set on it)
 * @returns {object|null} `found`
 */
function detectDocumentLayout(cwd, source, result) {
  const flutter = detectFlutterL10n(cwd);
  if (flutter) {
    result.framework = 'Flutter';
    if (flutter.templateExists) {
      const base = flutter.localesPattern.slice(0, flutter.localesPattern.lastIndexOf('/'));
      return {
        localesDir: `./${base}`,
        localesPattern: flutter.localesPattern,
        inputLocale: flutter.inputLocale,
        layout: 'pattern',
        format: 'arb',
        shape: flutter.localesPattern,
        why: flutter.l10nYaml ? 'Flutter project (l10n.yaml)' : 'Flutter project (gen-l10n defaults)',
        targets: flutter.targets,
        sourceFiles: [flutter.templateFile],
        ambiguous: false,
      };
    }
    result.hints.push(
      `Flutter project, but its gen-l10n template ${flutter.templateFile} does not exist — create it`
      + ' (or set template-arb-file in l10n.yaml) and re-run `champollion init --force`.');
  }

  const gettext = detectGettextLayout(cwd, { source });
  if (gettext) {
    result.framework = gettext.framework;
    const base = gettext.localesPattern
      ? gettext.localesPattern.slice(0, gettext.localesPattern.indexOf('/{lang}'))
      : gettext.localesDir.replace(/^\.\//, '');
    if (gettext.sourceFiles.length > 0) {
      return {
        localesDir: `./${base}`,
        ...(gettext.localesPattern && { localesPattern: gettext.localesPattern }),
        layout: gettext.localesPattern ? 'pattern' : 'flat',
        format: 'po',
        shape: gettext.localesPattern || `${base}/{lang}.po`,
        why: `${gettext.framework} project`,
        targets: gettext.targets,
        sourceFiles: gettext.sourceFiles,
        ambiguous: false,
      };
    }
    const shape = gettext.localesPattern || `${base}/{lang}.po`;
    const make = gettext.framework === 'Django' ? `django-admin makemessages -l ${source}`
      : (gettext.framework === 'Babel' ? `pybabel extract -o ${base}/messages.pot .` : `msginit --locale=${source}`);
    result.hints.push(
      `gettext catalogs found (${shape}${gettext.targets.length > 0 ? `: ${gettext.targets.join(', ')}` : ''}) but no `
      + `"${source}" source catalog or .pot template — create one (\`${make}\`) and re-run \`champollion init --force\`.`);
  }
  return null;
}

/**
 * Look for the project's locale files on disk.
 *
 * Probes the detected framework's conventional directories first, then the
 * generic ones (or ONLY `dir` when the user named one). A probe matches when
 * the SOURCE locale exists there: `<dir>/<source>.<ext>` (flat) or a
 * `<dir>/<source>/` folder holding locale files (folder per locale). Near
 * misses — a locale directory without the source file — are reported so the
 * user can fix --source instead of guessing.
 *
 * @param {string} cwd - Project root
 * @param {{ source?: string, dir?: string|null }} [options]
 * @returns {{
 *   framework: string,
 *   docusaurus: boolean,
 *   found: null | { localesDir: string, layout: 'flat'|'dir'|'pattern', format: string,
 *     shape: string, why: string, targets: string[], sourceFiles: string[],
 *     ambiguous: boolean, localesPattern?: string, inputLocale?: string },
 *   nearMisses: Array<{ localesDir: string, locales: string[] }>,
 *   hints: string[],
 * }} `localesPattern` (Flutter, gettext) is what the config should carry
 *   instead of localesDir; `inputLocale` is the source a Flutter template
 *   names (app_en.arb → en)
 */
function detectLocaleSetup(cwd, { source = 'en', dir = null } = {}) {
  const framework = detectFramework(cwd);
  const result = {
    framework: framework.name, docusaurus: framework.name === 'Docusaurus', found: null, nearMisses: [], hints: [],
  };
  if (result.docusaurus && !dir) return result;

  // Flutter (.arb) and gettext (.po) first — an explicit --dir names a
  // folder, so it is probed on its own instead.
  if (!dir) {
    const found = detectDocumentLayout(cwd, source, result);
    if (found) {
      result.found = found;
      return result;
    }
  }

  const probes = [];
  const seen = new Set();
  const add = (probe, why) => {
    const abs = path.resolve(cwd, probe.dir);
    if (seen.has(abs)) return;
    seen.add(abs);
    probes.push({ ...probe, abs, why });
  };
  if (dir) {
    add({ dir }, '--dir');
  } else {
    for (const probe of FRAMEWORK_LAYOUTS[framework.name] || []) {
      add(probe, `${framework.name} project`);
    }
    for (const d of GENERIC_LOCALE_DIRS) add({ dir: d }, 'common locale directory');
    // Last: a folder named like a locale folder one or two levels down.
    for (const d of nestedLocaleDirs(cwd)) add({ dir: d }, `locale folder found at ${d}/`);
  }

  for (const probe of probes) {
    let isDir = false;
    try { isDir = fs.statSync(probe.abs).isDirectory(); } catch { /* absent */ }
    if (!isDir) continue;

    const allowed = (ext) => {
      const fmt = formatForExtension(ext);
      return fmt && (!probe.formats || probe.formats.includes(fmt));
    };
    const flatSource = fs.readdirSync(probe.abs)
      .filter(f => f.startsWith(`${source}.`) && path.basename(f, path.extname(f)) === source && allowed(path.extname(f)));
    let folderFiles = [];
    try {
      if (fs.statSync(path.join(probe.abs, source)).isDirectory()) {
        folderFiles = walkLocaleFiles(path.join(probe.abs, source)).filter(f => allowed(path.extname(f)));
      }
    } catch { /* no source folder */ }

    if (flatSource.length === 0 && folderFiles.length === 0) {
      // A locale directory WITHOUT the source locale: say what is there.
      const locales = fs.readdirSync(probe.abs, { withFileTypes: true })
        .map(e => (e.isDirectory() ? e.name : (allowed(path.extname(e.name)) ? path.basename(e.name, path.extname(e.name)) : null)))
        .filter(n => n && !n.startsWith('.'));
      if (locales.length > 0) result.nearMisses.push({ localesDir: configPath(cwd, probe.abs), locales: [...new Set(locales)].sort() });
      continue;
    }

    const ambiguous = flatSource.length > 0 && folderFiles.length > 0;
    // Both shapes present: trust the framework's convention when it has
    // one, else the single file. The choice is WRITTEN (localesLayout) so
    // sync never has to guess.
    const layout = folderFiles.length > 0 && (flatSource.length === 0 || probe.layout === 'dir') ? 'dir' : 'flat';
    const layoutInfo = discoverLocaleLayout({
      inputLocale: source, localesDir: probe.abs, format: 'auto', localesLayout: layout,
    }, { cwd });
    const evidence = layout === 'dir'
      ? layoutInfo.sourceFiles.map(f => `${configPath(cwd, probe.abs).slice(2)}/${f.rel}`)
      : [`${configPath(cwd, probe.abs).slice(2)}/${layoutInfo.sourceFiles[0].rel}`];
    result.found = {
      localesDir: configPath(cwd, probe.abs),
      layout,
      format: layoutInfo.format,
      shape: layoutInfo.display,
      why: probe.why,
      targets: layoutInfo.listLocales(),
      sourceFiles: evidence,
      ambiguous,
    };
    return result;
  }
  return result;
}

/**
 * One-line hint for sync's "Locales directory not found" error: what init
 * WOULD configure, based on files on disk. Null when nothing was found.
 *
 * @param {string} cwd
 * @param {string} source - Source locale code
 * @returns {string|null}
 */
function describeLocaleSetupHint(cwd, source) {
  const { found, nearMisses, hints } = detectLocaleSetup(cwd, { source });
  if (found) {
    const setting = found.localesPattern
      ? `"localesPattern": "${found.localesPattern}"`
      : `"localesDir": "${found.localesDir}"`;
    return `Found ${found.sourceFiles[0]} (${found.shape}) — set ${setting} `
      + 'in champollion.config.json, or run `champollion init --force` to detect it.';
  }
  if (hints.length > 0) return hints[0];
  if (nearMisses.length > 0) {
    const m = nearMisses[0];
    return `${m.localesDir} holds locale(s) ${m.locales.join(', ')} but no "${source}" source — `
      + 'set "localesDir" and "inputLocale" in champollion.config.json.';
  }
  return null;
}

/**
 * Checks whether stdin is interactive (attached to a TTY).
 * If piped or in CI, we skip the interactive wizard.
 */
function isInteractive() {
  return process.stdin.isTTY === true;
}

/**
 * Prompt the user for a single line of input.
 * Returns the trimmed response, or the default if empty.
 */
function ask(rl, question, defaultValue) {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Parse a comma-separated language input string.
 * Supports preset names (e.g., "european") and individual codes.
 *
 * @param {string} input - Raw user input
 * @returns {string[]} Deduplicated array of locale codes
 */
function parseLanguageInput(input) {
  if (!input) return [];

  const codes = new Set();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const preset = LANGUAGE_PRESETS[part.toLowerCase()];
    if (preset) {
      // Expand preset into individual codes
      for (const code of preset) {
        codes.add(code);
      }
    } else {
      codes.add(canonicalLocaleCase(part));
    }
  }

  return [...codes];
}

/**
 * BCP 47 casing, separator kept: "PT-br" → "pt-BR", "zh_hant" → "zh_Hant".
 *
 * The code becomes a FILE NAME (fr.json, app_pt_BR.arb, pt-BR/common.json)
 * and, for Flutter, the "@@locale" gen-l10n compares with it. Lower-casing
 * the whole code (the old behaviour) wrote app_pt_br.arb — a locale no
 * device reports, and a file next-intl's "pt-BR" never finds.
 *
 * @param {string} code
 * @returns {string}
 */
function canonicalLocaleCase(code) {
  let first = true;
  return code.split(/([-_])/).map((part) => {
    if (part === '-' || part === '_') return part;
    if (first) { first = false; return part.toLowerCase(); }
    if (/^[a-z]{4}$/i.test(part)) return part[0].toUpperCase() + part.slice(1).toLowerCase();
    if (/^(?:[a-z]{2}|\d{3})$/i.test(part)) return part.toUpperCase();
    return part.toLowerCase();
  }).join('');
}

/**
 * Get the METHOD_OPTIONS entry by its 1-based index or method name.
 * Returns null if not found.
 */
function getMethodOption(input) {
  const num = parseInt(input, 10);
  if (num >= 1 && num <= METHOD_OPTIONS.length) {
    return METHOD_OPTIONS[num - 1];
  }
  // Also accept method name directly (e.g., "google-translate")
  return METHOD_OPTIONS.find(m => m.method === input) || null;
}

/**
 * Collect the set of unique env vars needed for the chosen methods.
 * Used in the "Next steps" output.
 *
 * @param {string} defaultMethod - The default method name
 * @param {object|null} languageOverrides - languages object with per-lang method overrides
 * @returns {Array<{envVar: string, label: string}>} Unique env vars needed
 */
function collectRequiredEnvVars(defaultMethod, languageOverrides) {
  const needed = new Map();

  // Add the default method's env var
  const defaultOpt = METHOD_OPTIONS.find(m => m.method === defaultMethod);
  if (defaultOpt) {
    needed.set(defaultOpt.envVar, defaultOpt.label);
  }

  // Add per-language method env vars
  if (languageOverrides && typeof languageOverrides === 'object') {
    for (const langConfig of Object.values(languageOverrides)) {
      if (typeof langConfig === 'object' && langConfig.method) {
        const opt = METHOD_OPTIONS.find(m => m.method === langConfig.method);
        if (opt && !needed.has(opt.envVar)) {
          needed.set(opt.envVar, opt.label);
        }
      }
    }
  }

  return [...needed.entries()].map(([envVar, label]) => ({ envVar, label }));
}

// ── Wizard Steps ──────────────────────────────────────────────

/**
 * Step 1: Languages — source locale and target languages.
 */
async function stepLanguages(rl, prefill = {}) {
  console.log('');
  console.log('  Step 1/6 — Languages');
  console.log('  ────────────────────────────────────────────────');
  console.log('');

  const source = await ask(rl, 'Source locale', prefill.source || 'en');

  console.log('');
  console.log('  Target languages — enter codes separated by commas.');
  console.log('  Presets: european (fr,de,es,it,pt,nl) | asian (ja,zh,ko)');
  console.log('           global (fr,es,de,ja,zh,ko,pt,ar) | nordic (da,fi,nb,sv)');
  console.log('  Example: fr, de, ja  or  european, ja');
  console.log('  Leave blank to auto-detect from your locales directory.');
  const langInput = await ask(rl, 'Target languages', prefill.langs || '');
  const languages = parseLanguageInput(langInput);
  const scriptChoices = {};

  if (languages.length > 0) {
    console.log('');
    console.log('  Selected:');
    for (const code of languages) {
      const card = getLanguageCard(code);
      const name = card ? card.name : (DEFAULT_REGISTERS[code]?.name || code);
      const system = card?.formality?.system;
      const systemLabel = system ? ` (${system})` : '';
      const unknown = !card && !DEFAULT_REGISTERS[code]
        ? (isPrivateUseCode(code) ? '   (private-use code: no language card — give it a name, e.g. --name ' + code + '="…")' : '   ⚠ unrecognized code — check spelling')
        : '';
      console.log(`    ${code} — ${name}${systemLabel}${unknown}`);
    }

    // Script decisions, made HERE — at language selection, while the user is
    // looking at the language — never defaulted later:
    //   - A locale with two real orthographies (crk: SRO/Syllabics, sr:
    //     Latin/Cyrillic) REQUIRES a choice. Champollion won't pick a
    //     community's writing system; sync refuses to run until one is set.
    //   - A locale whose display script is Private Use Area (tlh pIqaD,
    //     Tengwar, Kryptonian — not in Unicode) defaults to romanization,
    //     the only output that renders without a custom font; opting in is
    //     explained, not assumed.
    for (const code of languages) {
      const card = getLanguageCard(code);
      let resolution;
      try {
        resolution = resolveTargetScript(code, {}, card);
      } catch {
        continue; // unrecognized code — already flagged above
      }

      const preset = prefill.script ? parseScriptFlag(prefill.script, languages).map[code] : null;
      if (preset) {
        // --script on the command line: the choice is already made.
        scriptChoices[code] = resolveTargetScript(code, { script: preset }, card).script;
        console.log(`    → ${code}: "script": "${scriptChoices[code]}" (from --script)`);
        continue;
      }
      if (resolution.source === 'choice-required') {
        console.log('');
        console.log(`  ${code} is written in more than one orthography:`);
        resolution.choices.forEach((c, i) => {
          console.log(`    ${i + 1}. ${c.label} ("script": "${c.script}")`);
        });
        const pick = await ask(rl, `Which should Champollion write for ${code}?`, '1');
        const idx = parseInt(pick, 10) - 1;
        const chosen = resolution.choices[idx] || resolution.choices[0];
        scriptChoices[code] = chosen.script;
        console.log(`    → ${code}: "script": "${chosen.script}" (${chosen.label})`);
      } else if (resolution.source === 'default') {
        const info = getConverterInfo(converterKeyForLocale(code, card));
        console.log('');
        console.log(`  ℹ  ${code} will be written in ${info.from}.`);
        console.log(`     Its display script (${info.to}) is not in Unicode and needs a special font.`);
        console.log(`     To emit it instead, set "script": "${info.toScript || converterKeyForLocale(code, card)}" for ${code}`);
        console.log('     and run `champollion fonts install`.');
      }
    }
  }

  return { source, languages, scriptChoices };
}

/**
 * Step 3: Translation method — accept defaults, pick one, or per-language.
 *
 * Returns:
 *   { defaultMethod, defaultModel, perLanguage: null }       — options 1 or 2
 *   { defaultMethod, defaultModel, perLanguage: { ... } }    — option 3
 */
async function stepMethod(rl, languages, presetModel = null, { localMark = null, presetMethod = null } = {}) {
  // A local-only mark in the project makes a model on this machine the
  // default (lib/local-only-marks.js); --method given with it still wins.
  // Without a mark the wizard is as it was.
  const localDefault = !!localMark && (!presetMethod || presetMethod === 'local');
  const markedDefault = localMark && presetMethod && presetMethod !== 'local' && presetMethod !== API_METHOD
    ? METHOD_OPTIONS.find(m => m.method === presetMethod) || null
    : null;
  const defaultModel = localDefault || (markedDefault && markedDefault.method !== 'llm')
    ? (presetModel || null)
    : (presetModel || DEFAULT_OPENROUTER_MODEL);

  console.log('');
  console.log('  Step 3/6 — Translation Method');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  if (localDefault) {
    console.log(`  Default: Local / self-hosted model${defaultModel ? ` → ${defaultModel}` : ''} — ${localMark.why}`);
    console.log(`  ${localMark.needs}`);
    console.log('  A hosted method is your choice to make: option 2 lists them (each says where the strings go).');
  } else if (markedDefault) {
    console.log(`  Default: ${markedDefault.label}${defaultModel ? ` → ${defaultModel}` : ''} (--method ${presetMethod}) — ${localMark.why}`);
  } else {
    console.log(`  Default: OpenRouter → ${defaultModel}`);
  }
  console.log('');
  console.log('    1. Accept defaults');
  console.log('    2. Choose a different method for all languages');
  console.log('    3. Configure each language individually');
  console.log('');

  const choice = await ask(rl, 'Choose', '1');

  // ── Option 1: Accept defaults ──
  if (choice === '1') {
    if (localDefault) return { defaultMethod: 'local', defaultModel, perLanguage: null };
    if (markedDefault) return { defaultMethod: markedDefault.method, defaultModel, perLanguage: null };
    return {
      defaultMethod: 'llm',
      defaultModel,
      perLanguage: null,
    };
  }

  // ── Option 2: Single method for all ──
  if (choice === '2') {
    return await pickSingleMethod(rl, presetModel);
  }

  // ── Option 3: Per-language configuration ──
  if (choice === '3') {
    return await pickPerLanguageMethod(rl, languages, presetModel);
  }

  // Default fallback
  console.log(`  Unrecognized choice "${choice}" — accepting defaults.`);
  if (localDefault) return { defaultMethod: 'local', defaultModel, perLanguage: null };
  if (markedDefault) return { defaultMethod: markedDefault.method, defaultModel, perLanguage: null };
  return {
    defaultMethod: 'llm',
    defaultModel,
    perLanguage: null,
  };
}

/**
 * Show the method picker with categorized display and guidance.
 *
 * LLM methods are shown first (register-aware, best quality), then
 * API methods (fast/cheap, no register control except DeepL).
 */
async function pickSingleMethod(rl, presetModel = null) {
  const llmMethods = METHOD_OPTIONS.filter(m => m.category === 'llm');
  const apiMethods = METHOD_OPTIONS.filter(m => m.category === 'api');

  console.log('');
  console.log('  LLM methods — context-aware, uses your register presets:');
  console.log('');
  let idx = 1;
  for (const m of llmMethods) {
    const num = String(idx).padStart(4, ' ');
    console.log(`  ${num}. ${m.label.padEnd(24)} ${m.desc}`);
    idx++;
  }

  console.log('');
  console.log('  API methods — fast and affordable, no register control:');
  console.log('');
  for (const m of apiMethods) {
    const num = String(idx).padStart(4, ' ');
    console.log(`  ${num}. ${m.label.padEnd(24)} ${m.desc}`);
    idx++;
  }

  console.log('');
  console.log('  Tip: LLM methods use your register presets to control tone.');
  console.log('  API methods translate without tone guidance (except DeepL).');
  console.log('');

  const methodChoice = await ask(rl, 'Choose', '1');
  const num = parseInt(methodChoice, 10);
  const selected = (num >= 1 && num <= METHOD_OPTIONS.length)
    ? METHOD_OPTIONS[num - 1]
    : METHOD_OPTIONS.find(m => m.method === methodChoice) || null;

  if (!selected) {
    console.log('  Invalid choice — using default (OpenRouter).');
    return { defaultMethod: 'llm', defaultModel: DEFAULT_OPENROUTER_MODEL, perLanguage: null };
  }

  // Resolve model — the core of the provider-first workflow
  let model = null;
  if (selected.isLLM) {
    model = await pickModelForProvider(rl, selected.method, presetModel);
  }

  // Warn if an API method was chosen — registers won't have full effect
  if (selected.category === 'api' && selected.method !== 'deepl') {
    console.log('');
    console.log(`  Note: ${selected.label} doesn't use register presets — your formality`);
    console.log('  choices from Step 2 will only apply if you switch to an LLM method later.');
  }

  console.log(`  → ${selected.label}${model ? ' / ' + model : ''}`);

  return {
    defaultMethod: selected.method,
    defaultModel: model,
    perLanguage: null,
  };
}

/**
 * Pick a model for a direct LLM provider via the provider-first workflow.
 *
 * Flow:
 *   1. Check if the provider's API key is in the environment
 *   2. If found: fetch real model list, show numbered picker
 *   3. If not found: warn, return null (method uses its own default at runtime)
 *   4. If fetch fails: fallback to manual text input
 *
 * For OpenRouter (method='llm'): skips the dynamic picker because OpenRouter
 * has 200+ models with no popularity ranking. Users type their preferred slug.
 *
 * @param {object} rl - Readline interface
 * @param {string} method - Provider method name (e.g., 'gemini', 'openai')
 * @returns {Promise<string|null>} Selected model ID, or null
 */
async function pickModelForProvider(rl, method, presetModel = null) {
  // OpenRouter: too many models for a picker, user types their slug
  if (method === 'llm') {
    return await ask(rl, 'Model', presetModel || DEFAULT_OPENROUTER_MODEL);
  }

  // Direct providers: try to fetch the real model list
  if (!isListableProvider(method)) {
    // Not a provider we can query — manual input
    return await ask(rl, 'Model', presetModel || '');
  }

  const apiKey = resolveProviderApiKey(method);
  if (!apiKey) {
    const label = getProviderLabel(method);
    console.log('');
    console.log(`  ⚠  ${label} API key not found in environment.`);
    console.log(`     Set it, then run \`champollion models --method ${method}\` to see available models.`);
    console.log('     The method will use its built-in default model at runtime.');
    return null;
  }

  // Fetch real models from the provider API
  const label = getProviderLabel(method);
  console.log(`\n  Fetching models from ${label}...`);
  const models = await fetchAvailableModels(method, apiKey);

  if (!models || models.length === 0) {
    console.log('  Could not fetch model list. Enter a model ID manually:');
    return await ask(rl, 'Model', presetModel || '') || null;
  }

  // Display as a numbered picker — provider sort order (recency/capability)
  console.log('');
  const displayCount = Math.min(models.length, 20); // cap the list for readability
  for (let i = 0; i < displayCount; i++) {
    console.log(`    ${String(i + 1).padStart(3)}.  ${models[i]}`);
  }
  if (models.length > displayCount) {
    console.log(`    ... and ${models.length - displayCount} more (run \`champollion models --method ${method}\` to see all)`);
  }
  console.log('');

  // A typed id is checked here, as --model is: an alias or a floating id is
  // refused with the exact slug to write, and asked again — not written into
  // the config to fail at the first sync.
  for (;;) {
    const modelChoice = await ask(rl, 'Choose (number or model ID)', '1');
    const modelNum = parseInt(modelChoice, 10);
    if (modelNum >= 1 && modelNum <= models.length) return models[modelNum - 1];
    if (!modelChoice.trim()) return models[0];
    try {
      requireExactModelId(modelChoice.trim(), { from: 'typed' });
      return modelChoice.trim();
    } catch (err) {
      console.log(`  ${err.message}`);
    }
  }
}

/**
 * Walk through each target language and let the user pick a method.
 */
async function pickPerLanguageMethod(rl, languages, presetModel = null) {
  const fallbackModel = presetModel || DEFAULT_OPENROUTER_MODEL;

  if (languages.length === 0) {
    console.log('  No target languages specified — using defaults.');
    return { defaultMethod: 'llm', defaultModel: fallbackModel, perLanguage: null };
  }

  console.log('');
  console.log('  Configure method for each language:');
  console.log(`  (Enter a number 1-${METHOD_OPTIONS.length}, or press Enter for default)`);
  console.log('');

  // Show a compact method reference
  for (let i = 0; i < METHOD_OPTIONS.length; i++) {
    const m = METHOD_OPTIONS[i];
    console.log(`    ${i + 1}. ${m.label}`);
  }
  console.log('');

  const perLanguage = {};

  for (const code of languages) {
    const card = getLanguageCard(code);
    const name = card?.name || DEFAULT_REGISTERS[code]?.name || code;

    const methodChoice = await ask(rl, `  ${code} (${name}) — method`, '1');
    const selected = getMethodOption(methodChoice);

    if (!selected || selected.method === 'llm') {
      // Default — no per-language override needed
      console.log(`    → OpenRouter / ${fallbackModel}`);
      continue;
    }

    // Check if this method supports the language via card metadata.
    // WHY: A user picking DeepL for Swahili should know it's not supported.
    if (isMethodSupported(code, selected.method) === false) {
      console.log(`    ⚠  ${selected.label} may not support ${name}. Consider LLM instead.`);
    }

    // Build per-language config entry
    const langEntry = { method: selected.method };

    if (selected.isLLM) {
      // Use the same provider-first model picker for per-language selection
      const model = await pickModelForProvider(rl, selected.method, presetModel);
      if (model) {
        langEntry.model = model;
      }
      console.log(`    → ${selected.label}${model ? ' / ' + model : ''}`);
    } else {
      console.log(`    → ${selected.label}`);
    }

    perLanguage[code] = langEntry;
  }

  return {
    defaultMethod: 'llm',
    defaultModel: fallbackModel,
    perLanguage: Object.keys(perLanguage).length > 0 ? perLanguage : null,
  };
}

/**
 * Step 2: Registers — guided tone/formality selection per language.
 *
 * Compact view: shows each language's formality system and default preset.
 * Expand-on-demand: type a language code to see all available presets
 * with descriptions and pick one.
 *
 * Returns an object mapping language codes to preset keys (explicit, even
 * for defaults) so the config file is self-documenting.
 *
 * WHY proactive display: Registers are the core value proposition —
 * the init wizard should SHOW the user what formality systems exist
 * and explain the defaults, not hide them behind a y/N gate.
 *
 * @param {object} rl - Readline interface
 * @param {string[]} languages - Target language codes
 * @returns {object|null} Map of code → preset key, or null if no languages
 */
async function stepRegisters(rl, languages, current = null) {
  if (languages.length === 0) return null;

  console.log('');
  console.log('  Step 2/6 — Registers');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Registers tell the translator how your app should sound.');
  console.log('  Each language has a formality system — champollion picks a');
  console.log('  sensible default for software UI.');
  console.log('');

  // Build the per-language summary and track default preset keys.
  // selectedPresets stores the explicitly chosen (or default) key for each language.
  const selectedPresets = {};

  for (const code of languages) {
    const card = getLanguageCard(code);
    const presets = getRegisterPresets(code);
    const name = card?.name || DEFAULT_REGISTERS[code]?.name || code;
    const system = card?.formality?.system || null;
    const systemLabel = system ? `  [${system}]` : '';

    // `init --force` over a file: the register it already names is the
    // default here, so Enter keeps it (a custom register was lost).
    const kept = current && typeof current[code] === 'string' ? current[code] : null;
    if (kept) {
      selectedPresets[code] = kept;
      const preset = presets.find(p => p.key === kept);
      console.log(`    ${code.padEnd(6)} ${name}${systemLabel}`);
      console.log(`           → ${preset ? preset.label : `"${kept.length > 50 ? `${kept.slice(0, 47)}…` : kept}"`} (from your config)`);
    } else if (presets.length > 0) {
      const defaultPreset = presets.find(p => p.isDefault) || presets[0];
      // Explicitly store the default preset key — makes config self-documenting
      selectedPresets[code] = defaultPreset.key;

      // Compact display: code, name, system, default preset label
      const altCount = presets.length - 1;
      const altText = altCount > 0 ? `  (${altCount} alternative${altCount > 1 ? 's' : ''})` : '';
      console.log(`    ${code.padEnd(6)} ${name}${systemLabel}`);
      console.log(`           → ${defaultPreset.label} ★${altText}`);
    } else {
      // No card / no presets — use generic fallback
      selectedPresets[code] = null;
      console.log(`    ${code.padEnd(6)} ${name}`);
      console.log(`           → Professional register (default)`);
    }
  }

  console.log('');
  console.log('  ────────────────────────────────────────────────');
  console.log('  Press Enter to accept all defaults (★).');
  console.log('  Type a language code to see options and change it.');

  // Interactive loop: user can adjust one language at a time, or Enter to finish
  let adjusting = true;
  while (adjusting) {
    console.log('');
    const input = await ask(rl, 'Adjust a language (or Enter to continue)', '');

    if (!input) {
      adjusting = false;
      break;
    }

    // Find the matching language code
    const code = input.toLowerCase();
    if (!languages.includes(code)) {
      console.log(`  "${code}" is not in your target languages.`);
      continue;
    }

    const presets = getRegisterPresets(code);
    const card = getLanguageCard(code);
    const name = card?.name || DEFAULT_REGISTERS[code]?.name || code;

    if (presets.length === 0) {
      // No presets — offer custom text only
      const custom = await ask(rl, `  ${name} — custom register text`, '');
      if (custom) {
        selectedPresets[code] = custom;
        console.log(`  → Custom: "${custom.substring(0, 50)}${custom.length > 50 ? '...' : ''}"`);
      }
      continue;
    }

    // Expanded view: show all presets with descriptions
    console.log('');
    console.log(`  ${code} — ${name}${card?.formality?.system ? `  [${card.formality.system}]` : ''}`);

    // Show the formality system description from the card — this is the
    // "why this matters" context that makes the wizard prescriptive.
    if (card?.formality?.description) {
      // Wrap the description to ~64 chars for terminal readability
      const desc = card.formality.description;
      const words = desc.split(' ');
      let line = '  ';
      for (const word of words) {
        if (line.length + word.length > 68 && line.length > 4) {
          console.log(line);
          line = '  ' + word;
        } else {
          line += (line.length > 2 ? ' ' : '') + word;
        }
      }
      if (line.length > 2) console.log(line);
    }

    console.log('');
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i];
      const marker = p.isDefault ? ' ★' : '  ';
      const current = selectedPresets[code] === p.key ? ' (current)' : '';
      console.log(`    ${i + 1}.${marker} ${p.label}`);
      console.log(`         ${p.description}${current}`);
    }
    console.log(`    c.   Custom text`);
    console.log('');

    const defaultIdx = presets.findIndex(p => p.key === selectedPresets[code]) + 1 || 1;
    const choice = await ask(rl, `  Choose`, String(defaultIdx));

    if (choice.toLowerCase() === 'c') {
      const custom = await ask(rl, `  Custom register text`, '');
      if (custom) {
        selectedPresets[code] = custom;
        console.log(`  → Custom register set.`);
      }
    } else {
      const num = parseInt(choice, 10);
      if (num >= 1 && num <= presets.length) {
        const selected = presets[num - 1];
        selectedPresets[code] = selected.key;
        console.log(`  → ${selected.label}`);
      }
    }
  }

  return Object.keys(selectedPresets).length > 0 ? selectedPresets : null;
}

/**
 * Step 4: Temperature — sampling temperature for LLM determinism control.
 *
 * Explains temperature in plain language and lets the user accept the default
 * or enter a custom value. Returns null if default is accepted (so config
 * only includes temperature when explicitly set).
 *
 * @param {readline.Interface} rl - Readline interface
 * @param {string} defaultMethod - Selected method name (e.g., 'llm', 'llm-coached', 'deepl')
 * @param {string|number|null} [presetTemp] - --temperature flag value; becomes the prompt default
 * @returns {number|null} Custom temperature, or null for default
 */
async function stepTemperature(rl, defaultMethod, presetTemp = null) {
  // Temperature only applies to LLM methods — skip for API-only methods
  const isLLM = !defaultMethod || ['llm', 'llm-coached', 'openai', 'anthropic', 'gemini'].includes(defaultMethod);
  if (!isLLM) return null;

  const isCoached = defaultMethod === 'llm-coached';
  const methodDefault = isCoached ? DEFAULT_COACHED_TEMPERATURE : DEFAULT_TEMPERATURE;

  // --temperature prefill: a valid flag value becomes the prompt default,
  // so Enter accepts it (run() validates flags, but guard anyway)
  const preset = presetTemp != null ? parseFloat(presetTemp) : NaN;
  const promptDefault = !isNaN(preset) && preset >= 0 && preset <= 1 ? preset : methodDefault;

  console.log('');
  console.log('  Step 4/6 — Temperature');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Temperature controls how deterministic the translations are.');
  console.log('  Lower values (0.1–0.3) produce more consistent, predictable output.');
  console.log('  Higher values (0.5–0.8) allow more variation and creativity.');
  console.log('');
  console.log('  For software UI translation, lower is almost always better.');
  if (isCoached) {
    console.log('  The coached method uses 0.2 by default for extra consistency.');
  }
  console.log('');

  const answer = await ask(rl, `Temperature (0.0–1.0)`, String(promptDefault));

  const parsed = parseFloat(answer);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    console.log(`  Invalid temperature "${answer}" — using default ${methodDefault}.`);
    return null;
  }

  // Return null if the user accepted the default (no need to clutter config)
  if (parsed === methodDefault) return null;

  return parsed;
}

/**
 * Step 5: Content translation — a folder of Markdown/MDX (Hugo's content/,
 * a docs or newsletter folder), Docusaurus, or none.
 */
async function stepContent(rl, cwd) {
  console.log('');
  console.log('  Step 5/6 — Content Translation');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Do you have Markdown content to translate?');
  console.log('');
  console.log('    1. No — key-value locale files only');
  console.log('    2. Yes — a folder of Markdown/MDX (Hugo content/, docs, newsletters…)');

  // Auto-detect Docusaurus
  const hasDocusaurus = detectDocusaurus(cwd);
  if (hasDocusaurus) {
    console.log('    3. Yes — Docusaurus (auto-detected ✓)');
  } else {
    console.log('    3. Yes — Docusaurus');
  }
  console.log('');

  // Docusaurus detected → make it the default answer; Enter accepts it
  const choice = await ask(rl, 'Choose', hasDocusaurus ? '3' : '1');

  if (choice === '2') {
    // Default to a folder that really holds Markdown (suggestContentDirs).
    const seen = suggestContentDirs(cwd);
    const contentDir = await ask(rl, 'Folder of Markdown/MDX files', seen.length > 0 ? `./${seen[0].dir}` : './content');
    return { contentDir, format: null };
  }

  if (choice === '3') {
    console.log('  → Docusaurus mode enabled. Locale files in ./i18n/');
    return { contentDir: null, format: 'docusaurus' };
  }

  return { contentDir: null, format: null };
}

/**
 * Step 6: Confirm — show summary, write config, display next steps.
 */
async function stepConfirm(rl, config, envVars) {
  console.log('');
  console.log('  Step 6/6 — Confirm');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Config Summary:');
  console.log('  ──────────────────────────────────────');

  console.log(`    Source locale:   ${config.inputLocale}`);

  // Display languages — handle both array and object forms
  if (Array.isArray(config.languages)) {
    const display = config.languages.length > 0
      ? config.languages.join(', ')
      : '(auto-detect from directory)';
    console.log(`    Target locales:  ${display}`);
  } else {
    const codes = Object.keys(config.languages);
    console.log(`    Target locales:  ${codes.join(', ')}`);
    // Show per-language method overrides
    for (const [code, langConfig] of Object.entries(config.languages)) {
      if (typeof langConfig === 'object' && langConfig.method) {
        const opt = METHOD_OPTIONS.find(m => m.method === langConfig.method);
        const label = opt ? opt.label : langConfig.method;
        const modelStr = langConfig.model ? ` / ${langConfig.model}` : '';
        console.log(`      ${code}: ${label}${modelStr}`);
      }
    }
  }

  console.log(config.localesPattern
    ? `    Locale files:    ${config.localesPattern}`
    : `    Locales dir:     ${config.localesDir}`);
  console.log(`    Format:          ${config.format}`);

  // Show default method if not the default 'llm'
  if (config.defaultMethod && config.defaultMethod !== 'llm') {
    const opt = METHOD_OPTIONS.find(m => m.method === config.defaultMethod);
    console.log(`    Method:          ${opt ? opt.label : config.defaultMethod}`);
  } else {
    console.log(`    Method:          OpenRouter`);
  }

  if (config.model) {
    console.log(`    Model:           ${config.model}`);
  }

  if (config.contentDir) {
    console.log(`    Content dir:     ${config.contentDir}`);
  }

  console.log('  ──────────────────────────────────────');

  // Show required env vars
  if (envVars.length > 0) {
    console.log('');
    console.log('  Required API key(s):');
    for (const { envVar, label } of envVars) {
      console.log(`    ${envVar}  (${label})`);
    }
  }

  console.log('');
  const confirm = await ask(rl, 'Write this config?', 'yes');
  return confirm.toLowerCase().startsWith('y');
}

/**
 * Build the config object from wizard answers.
 *
 * The new register step stores explicit preset keys for every language
 * (including defaults), so customRegisters is always populated when
 * languages were selected. Per-language method overrides are merged in.
 *
 * Config languages format:
 *   - Object with preset keys: { "fr": "formal-vous", "ja": "polite" }
 *   - Object with full config: { "fr": { "register": "casual-tu", "method": "deepl" } }
 *   - Array: ["fr", "de", "ja"] — only when no registers or overrides
 */
function buildConfig(answers) {
  const {
    source, languages, defaultMethod, defaultModel,
    perLanguage, customRegisters, temperature,
    localesDir, localesPattern = null, format, contentDir, scriptChoices,
  } = answers;

  const hasPerLanguage = perLanguage && Object.keys(perLanguage).length > 0;
  const hasRegisters = customRegisters && Object.keys(customRegisters).length > 0;
  const hasScriptChoices = scriptChoices && Object.keys(scriptChoices).length > 0;
  const needsObjectForm = hasPerLanguage || hasRegisters || hasScriptChoices;

  let languagesConfig;
  if (needsObjectForm) {
    // Object form — stores preset keys and/or method overrides per language.
    // When a language has both a register preset and a method override,
    // it gets the full object form { register, method, model }.
    // When it only has a register preset, it's stored as a bare string.
    languagesConfig = {};
    for (const code of languages) {
      const methodOverride = perLanguage ? perLanguage[code] : null;
      const registerValue = customRegisters ? customRegisters[code] : null;
      // Orthography choice from the wizard (crk/sr-class dual-script
      // locales). Persisted so sync never has to ask — or refuse — again.
      const scriptValue = scriptChoices ? scriptChoices[code] : null;

      if (methodOverride || scriptValue) {
        // Needs full object form
        const entry = {};
        if (methodOverride?.method) entry.method = methodOverride.method;
        if (methodOverride?.model) entry.model = methodOverride.model;
        // Include register preset key if present
        if (registerValue) entry.register = registerValue;
        if (scriptValue) entry.script = scriptValue;
        languagesConfig[code] = entry;
      } else if (registerValue) {
        // Register only — store as bare preset key string
        languagesConfig[code] = registerValue;
      } else {
        // No overrides at all — store empty object to keep in object form
        languagesConfig[code] = {};
      }
    }
  } else {
    // Simple array form — no registers, no overrides
    languagesConfig = languages;
  }

  const config = {
    version: 3,
    inputLocale: source,
    // A pattern (Flutter, gettext) fixes the directory; never write both.
    ...(localesPattern ? { localesPattern } : { localesDir }),
    languages: languagesConfig,
    batchSize: DEFAULT_BATCH_SIZE,
    format,
  };

  // Only include model in config when the user explicitly chose one.
  // null means the method class picks its own default at runtime—
  // we don't want to write a stale hardcoded slug into the config.
  if (defaultModel) {
    config.model = defaultModel;
  }

  // Only include defaultMethod if it's not the default 'llm'
  if (defaultMethod && defaultMethod !== 'llm') {
    config.defaultMethod = defaultMethod;
  }

  // Only include contentDir if the user specified one
  if (contentDir) {
    config.contentDir = contentDir;
  }

  // Only include temperature if the user set a non-default value
  if (temperature != null) {
    config.temperature = temperature;
  }

  return config;
}

/**
 * Run the interactive init wizard.
 *
 * CLI flags (--langs, --source, --dir, --model, --temperature, --format)
 * prefill the wizard's defaults — Enter accepts them at each step.
 */
async function runInteractive(cwd, args = {}, detection = null, currentRegisters = null, localMark = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log('  champollion — Project Setup');
    console.log('  ════════════════════════════════════════════════');

    // Step 1: Languages (includes orthography choices for dual-script locales).
    // A Flutter template names the source (app_en.arb → en).
    const { source, languages, scriptChoices } = await stepLanguages(rl, {
      ...args, source: args.source || detection?.found?.inputLocale,
    });

    // Step 2: Registers — guided tone/formality per language.
    // Comes before method because register choice informs method selection.
    const customRegisters = await stepRegisters(rl, languages, currentRegisters);

    // Step 3: Translation Method
    const { defaultMethod, defaultModel, perLanguage } = await stepMethod(rl, languages, args.model, {
      localMark, presetMethod: args.method || null,
    });

    // Step 4: Temperature
    const temperature = await stepTemperature(rl, defaultMethod, args.temperature);

    // Step 5: Content Translation (--content-dir answers it)
    const { contentDir, format: contentFormat } = args['content-dir']
      ? { contentDir: args['content-dir'], format: null }
      : await stepContent(rl, cwd);

    // Step 6: Locales directory and format
    // These are simpler questions — asked inline before confirmation
    console.log('');
    // Default to what is actually on disk (detectLocaleSetup), not a guess.
    // Flutter and gettext layouts are patterns (lib/l10n/app_{lang}.arb),
    // asked for as a pattern rather than a directory.
    const detectedPattern = contentFormat !== 'docusaurus' && !args.dir ? detection?.found?.localesPattern : null;
    let localesDir = null;
    let localesPattern = null;
    if (detectedPattern) {
      localesPattern = await ask(rl, 'Locale file pattern ({lang} = language, {ns} = file/domain)', detectedPattern);
    } else {
      const detectedDir = contentFormat === 'docusaurus' ? './i18n' : (detection?.found?.localesDir || './locales');
      localesDir = await ask(rl, 'Locales directory', args.dir || detectedDir);
    }
    const formatDefault = args.format || (detection?.found?.format === 'po' && !detectedPattern ? 'po' : 'auto');
    const format = contentFormat || await ask(rl, `File format (${['auto', ...LOCALE_FILE_FORMATS].join('/')})`, formatDefault);

    // Build config
    const config = buildConfig({
      source, languages, defaultMethod, defaultModel,
      perLanguage, customRegisters, temperature,
      localesDir, localesPattern, format, contentDir, scriptChoices,
    });

    // Collect env vars needed
    const envVars = collectRequiredEnvVars(defaultMethod, config.languages);

    // Confirm
    const confirmed = await stepConfirm(rl, config, envVars);
    if (!confirmed) {
      console.log('  Cancelled. No files written.');
      return null;
    }

    // Return config + envVars for the caller to write and show next steps
    return { config, envVars };
  } finally {
    rl.close();
  }
}

/**
 * Generate a default config for non-interactive mode.
 *
 * Supports --langs to specify target languages in quick mode:
 *   npx champollion init --yes --langs fr,de,ja
 *
 * WHY --langs in quick mode: The user said "define your targets, state
 * the locales, click sync to use defaults." This flag enables that
 * one-liner workflow without the interactive wizard.
 */
async function buildDefaultConfig(args) {
  // Parse --langs flag: comma-separated list of language codes
  const languages = args.langs
    ? parseLanguageInput(args.langs)
    : [];

  // Resolve the model for --yes mode.
  // If --model is explicitly provided, use it directly.
  // Otherwise, try to fetch the top model from the provider API.
  // If no API key or fetch fails, leave model unset (method default fires at runtime).
  let model = args.model || null;
  const method = args.method || 'llm';
  // The endpoint serves its own model; api has none of ours to write.
  if (method === API_METHOD) model = null;

  if (!model && method !== 'llm' && isListableProvider(method)) {
    const apiKey = resolveProviderApiKey(method);
    if (apiKey) {
      const models = await fetchAvailableModels(method, apiKey);
      if (models && models.length > 0) {
        model = models[0]; // Top model from the provider
      }
    }
  }

  // For OpenRouter (default method), use the hardcoded default
  if (!model && method === 'llm') {
    model = DEFAULT_OPENROUTER_MODEL;
  }

  const config = {
    version: 3,
    inputLocale: args.source || 'en',
    localesDir: args.dir || './locales',
    languages,
    batchSize: DEFAULT_BATCH_SIZE,
    format: args.format || 'auto',
    ...(args.temperature != null && { temperature: parseFloat(args.temperature) }),
  };

  // Only include method if not the default
  if (method !== 'llm') {
    config.defaultMethod = method;
  }

  // Only write model to config when explicitly known
  if (model) {
    config.model = model;
  }

  // A folder of Markdown/MDX to translate (a newsletter archive, a docs
  // folder). Without the flag the folder had to be added by hand
  // (synthetic Cree school persona, 2026-10).
  if (args['content-dir']) {
    config.contentDir = args['content-dir'];
  }

  return config;
}

/**
 * --script for init: "Cans" (one target language) or "crk=Cans,sr=Latn"
 * (":" works as well as "="). Values are checked by the same resolver sync
 * uses (lib/scripts.js resolveTargetScript), so a value init accepts is one
 * sync can run with.
 *
 * @param {string|undefined} value
 * @param {string[]} languages - Target codes (--langs)
 * @returns {{ map: Object<string,string>, error: string|null }}
 */
function parseScriptFlag(value, languages) {
  const map = {};
  if (value == null || value === '') return { map, error: null };
  const parts = String(value).split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^([^=:]+)[=:](.+)$/.exec(part);
    if (m) {
      map[m[1].trim()] = m[2].trim();
    } else if (parts.length === 1 && languages.length === 1) {
      map[languages[0]] = part;
    } else {
      return { map, error: `--script "${part}": name the language — e.g. --script crk=Cans (one --script value may list several: crk=Cans,sr=Latn).` };
    }
  }
  for (const [code, script] of Object.entries(map)) {
    if (!languages.includes(code)) {
      return { map, error: `--script ${code}=${script}: ${code} is not one of the target languages (--langs ${languages.join(',') || '…'}).` };
    }
    try {
      resolveTargetScript(code, { script }, getLanguageCard(code));
    } catch (err) {
      return { map, error: `--script ${code}=${script}: ${err.message}` };
    }
  }
  return { map, error: null };
}

/**
 * --name for init: `qaa=Ayta (variety not yet confirmed)`, several separated
 * by ";" (a display name may hold commas), or a bare name when there is one
 * target language.
 *
 * @param {string|undefined} value
 * @returns {{ map: Record<string, string>, bare: string|null }}
 */
function parseNameFlag(value) {
  const map = {};
  let bare = null;
  if (value == null || value === '' || value === true) return { map, bare };
  for (const part of String(value).split(';').map(p => p.trim()).filter(Boolean)) {
    const m = /^([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)\s*=\s*(.+)$/.exec(part);
    if (m) map[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    else bare = part.replace(/^(["'])(.*)\1$/, '$2');
  }
  return { map, bare };
}

/**
 * Write --name display names into the object-form `languages` entries
 * (`"qaa": { "name": "Ayta (variety not yet confirmed)" }`).
 *
 * @returns {{ error: string|null }}
 */
function applyDisplayNames(config, args) {
  const { map, bare } = parseNameFlag(args.name);
  const languages = Array.isArray(config.languages) ? config.languages : Object.keys(config.languages || {});
  if (bare !== null) {
    if (languages.length !== 1) {
      return { error: `--name "${bare}": name the language — e.g. --name qaa="${bare}" (several: --name "qaa=…;qab=…").` };
    }
    map[languages[0]] = bare;
  }
  if (Object.keys(map).length === 0) return { error: null };
  for (const code of Object.keys(map)) {
    if (!languages.includes(code)) {
      return { error: `--name ${code}=…: ${code} is not one of the target languages (--langs ${languages.join(',') || '…'}).` };
    }
  }
  const asObject = Array.isArray(config.languages)
    ? Object.fromEntries(config.languages.map(c => [c, {}]))
    : { ...config.languages };
  for (const [code, name] of Object.entries(map)) {
    const prior = asObject[code];
    asObject[code] = typeof prior === 'string' ? { register: prior, name } : { ...(prior || {}), name };
  }
  config.languages = asObject;
  return { error: null };
}

/**
 * Writing systems on the non-interactive path. The wizard asks for a
 * language with more than one real orthography (Plains Cree: SRO or
 * Syllabics); `init --yes` used to skip that in silence and the first sync
 * refused (Round 4, school persona). Now --script records the choice, and
 * without it init says a choice is needed, lists the choices, and prints
 * exactly what to add — the same rule sync applies.
 *
 * @param {object} config - The config being written (languages mutated to object form when a script is set)
 * @param {object} args
 * @returns {{ error: string|null, needed: Array<{ code: string, choices: Array<{script: string, label: string}> }> }}
 */
function applyScriptChoices(config, args) {
  const languages = Array.isArray(config.languages) ? config.languages : Object.keys(config.languages || {});
  const { map, error } = parseScriptFlag(args.script, languages);
  if (error) return { error, needed: [] };
  const needed = [];
  for (const code of languages) {
    if (map[code]) continue;
    // A script the config already names (an existing file under --force).
    const entry = Array.isArray(config.languages) ? null : config.languages?.[code];
    if (entry && typeof entry === 'object' && entry.script) continue;
    let resolution;
    try { resolution = resolveTargetScript(code, {}, getLanguageCard(code)); } catch { continue; }
    if (resolution.source === 'choice-required') needed.push({ code, choices: resolution.choices });
  }
  if (Object.keys(map).length > 0) {
    const asObject = Array.isArray(config.languages)
      ? Object.fromEntries(config.languages.map(c => [c, {}]))
      : { ...config.languages };
    for (const [code, script] of Object.entries(map)) {
      const card = getLanguageCard(code);
      const resolved = resolveTargetScript(code, { script }, card).script || script;
      const prior = asObject[code];
      asObject[code] = typeof prior === 'string'
        ? { register: prior, script: resolved }
        : { ...(prior || {}), script: resolved };
    }
    config.languages = asObject;
  }
  return { error: null, needed };
}

/**
 * Validate init flag values before any config is written.
 * Returns an error message string, or null when the flags are fine.
 *
 * WHY fail-fast: agents drive `init --yes` with flags — a typo'd method
 * or a non-numeric temperature must error loudly here, not surface as a
 * broken config ("temperature": null) at first sync.
 */
function validateInitFlags(args) {
  // Same vocabulary resolveConfig() enforces — a config init writes must be
  // one sync can load.
  const formats = ['auto', 'docusaurus', ...LOCALE_FILE_FORMATS];
  if (args.format && !formats.includes(args.format)) {
    return `Unknown --format "${args.format}". Valid formats: ${formats.join(', ')}`;
  }
  if (args.method && args.method !== API_METHOD && !METHOD_OPTIONS.some(m => m.method === args.method)) {
    const valid = [...METHOD_OPTIONS.map(m => m.method), API_METHOD].join(', ');
    return `Unknown method "${args.method}". Valid methods: ${valid}`;
  }
  // --method api: a server speaking the champollion API contract (e.g. a
  // model served by `nmt-forge serve`) — the endpoint is the whole config.
  if (args.method === API_METHOD) {
    if (args.endpoint == null || args.endpoint === true || !String(args.endpoint).trim()) {
      return '--method api needs --endpoint <url>: the champollion API endpoint, e.g. '
        + '--endpoint http://127.0.0.1:8378/translate (what `nmt-forge serve` prints).';
    }
    let url = null;
    try { url = new URL(String(args.endpoint)); } catch { /* reported below */ }
    if (!url || !/^https?:$/.test(url.protocol)) {
      return `--endpoint ${args.endpoint}: not an http(s) URL. Example: --endpoint http://127.0.0.1:8378/translate`;
    }
    if (args.model) {
      return '--model does not apply to --method api: the endpoint serves its own model.';
    }
  } else if (args.endpoint != null) {
    return `--endpoint applies to --method api (a champollion API endpoint)${args.method ? `, not --method ${args.method}` : ''}. `
      + 'For an OpenAI-compatible server use --method local and LOCAL_API_BASE.';
  }
  // Exact model slugs only (founder ruling 2026-10-05): a retired alias or a
  // floating id is refused before init writes it into the config.
  if (typeof args.model === 'string' && args.model) {
    try { requireExactModelId(args.model, { from: 'from --model' }); } catch (err) { return err.message; }
  }
  if (args['accepts-instructions'] != null) {
    if (args.method !== API_METHOD) return '--accepts-instructions applies to --method api.';
    if (!['true', 'false'].includes(String(args['accepts-instructions']))) {
      return `--accepts-instructions must be true or false (got "${args['accepts-instructions']}").`;
    }
  }

  if (args.script != null && !args.langs) {
    return '--script needs --langs: it names the writing system of a target language (e.g. --langs crk --script crk=Cans).';
  }

  if (args.temperature != null) {
    const t = parseFloat(args.temperature);
    if (isNaN(t) || t < 0 || t > 1) {
      return `Invalid --temperature "${args.temperature}" — must be a number between 0.0 and 1.0.`;
    }
  }

  return null;
}

/**
 * Say what detectLocaleSetup() found, and why, before anything is written —
 * an agent driving `init --yes` reads this to know which files will sync.
 *
 * @param {ReturnType<typeof detectLocaleSetup>} detection
 * @param {string} source - Source locale code
 */
function reportDetection(detection, source) {
  if (detection.docusaurus && !detection.found) {
    output.info('Detected Docusaurus — locale files live in ./i18n/<locale>/ (Docusaurus lane).');
    return;
  }
  const { found } = detection;
  if (found) {
    const fw = detection.framework && detection.framework !== 'generic' ? ` (${detection.framework})` : '';
    output.info(`Detected locale files: ${found.shape}${fw} — ${found.why}`);
    const shown = found.sourceFiles.slice(0, 4).join(', ');
    const more = found.sourceFiles.length > 4 ? `, +${found.sourceFiles.length - 4} more` : '';
    output.raw(`   Source (${source}): ${shown}${more}`);
    if (found.layout === 'dir') {
      output.raw(`   One folder per locale; each file is a namespace (${found.sourceFiles.length} file(s)).`);
    }
    if (found.localesPattern) {
      output.raw(`   Writing "localesPattern": "${found.localesPattern}"${found.format === 'arb' ? ' (Flutter ARB)' : ' (gettext)'}.`);
    }
    if (found.targets.length > 0) output.raw(`   Target locales on disk: ${found.targets.join(', ')}`);
    if (found.ambiguous) {
      output.warn(`Both ${found.localesDir}/${source}.<ext> and ${found.localesDir}/${source}/ exist — writing "localesLayout": "${found.layout}" so sync does not have to guess.`);
    }
    return;
  }
  for (const hint of detection.hints || []) output.warn(hint);
  for (const miss of detection.nearMisses) {
    output.warn(`${miss.localesDir}/ holds locale(s) ${miss.locales.join(', ')} but no "${source}" — if your source language is one of those, re-run with --source <code>.`);
  }
  output.info(`No ${source} locale files found in the usual places (${GENERIC_LOCALE_DIRS.join(', ')}).`);
}

/**
 * Point a default (--yes) config at what detectLocaleSetup() found. An
 * explicit --dir always wins; it was probed on its own.
 *
 * @param {object} config - From buildDefaultConfig()
 * @param {ReturnType<typeof detectLocaleSetup>} detection
 * @param {object} args - CLI flags
 */
function applyDetection(config, detection, args) {
  if (detection.docusaurus && !args.dir) {
    if (!args.format) config.format = 'docusaurus';
    config.localesDir = './i18n';
    return;
  }
  if (detection.found) {
    const found = detection.found;
    if (found.localesPattern) {
      // The pattern replaces localesDir in place (config key order stays
      // readable); config.js refuses a localesDir that disagrees with it.
      const ordered = {};
      for (const [k, v] of Object.entries(config)) {
        if (k === 'localesDir') ordered.localesPattern = found.localesPattern;
        else ordered[k] = v;
      }
      for (const k of Object.keys(config)) delete config[k];
      Object.assign(config, ordered);
      // A Flutter template names the source (app_en.arb → en); --source wins.
      if (found.inputLocale && !args.source) config.inputLocale = found.inputLocale;
    } else {
      config.localesDir = found.localesDir;
    }
    // GNU po/ may hold only a .pot template and targets — say "po" so the
    // source is never looked up as a JSON file.
    if (found.format === 'po' && !found.localesPattern && !args.format) config.format = 'po';
  }
}

// -----------------------------------------------------------------
// `init --force` over an existing config: change what was asked, keep the rest
// -----------------------------------------------------------------
//
// `init --force` used to write a brand-new default config over the old one:
// `init --force --method local --model x` (what init itself printed as the way
// to switch model) dropped a custom register, the glossary and every other
// field, and reset batchSize to the default (Round 10, Next.js persona). Now
// a forced re-run starts from the existing file: the fields the flags name
// are rewritten (and the locale layout is re-detected when the file no longer
// finds the source), everything else stays as it was, the changes are printed,
// and the previous file is backed up first.

/** Plain-object copy of a JSON value. */
const cloneJSON = (v) => JSON.parse(JSON.stringify(v));

/** Target codes of a `languages` value (list or object form). */
function languageCodes(languages) {
  if (Array.isArray(languages)) return [...languages];
  return languages && typeof languages === 'object' ? Object.keys(languages) : [];
}

/**
 * Set `key` on `obj` to `value` (deleting it for undefined/null), keeping the
 * key's place in the file. `replaces` names a key the new one takes the place
 * of (localesPattern for localesDir), so the file still reads top to bottom.
 */
function setInPlace(obj, key, value, replaces = null) {
  if (value === undefined || value === null) { delete obj[key]; return; }
  if (Object.prototype.hasOwnProperty.call(obj, key) || !replaces || !Object.prototype.hasOwnProperty.call(obj, replaces)) {
    obj[key] = value;
    return;
  }
  const ordered = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === replaces) ordered[key] = value;
    else ordered[k] = v;
  }
  for (const k of Object.keys(obj)) delete obj[k];
  Object.assign(obj, ordered);
}

/**
 * Does the existing config still find the project's source locale files?
 * When it does, a forced re-run keeps its layout (localesDir/localesPattern,
 * localesLayout, format) unless --dir or --format names another; when it does
 * not (the folder moved, a Flutter template or a .pot was created since), the
 * layout is re-detected — what `init --force` is advised for.
 *
 * @param {object} existing - The parsed config file
 * @param {string} inputLocale - The source locale the run will use
 * @param {string} cwd
 * @returns {boolean}
 */
function existingLayoutHolds(existing, inputLocale, cwd) {
  if (existing.format === 'docusaurus') return true; // its lane reads i18n/ itself
  try {
    const patternAbs = typeof existing.localesPattern === 'string' && existing.localesPattern
      ? path.resolve(cwd, existing.localesPattern) : null;
    const localesAbs = patternAbs
      ? compileLocalesPattern(patternAbs).base
      : path.resolve(cwd, typeof existing.localesDir === 'string' && existing.localesDir ? existing.localesDir : './locales');
    if (!fs.existsSync(localesAbs)) return false;
    const layout = discoverLocaleLayout({
      inputLocale, localesDir: localesAbs, format: existing.format || 'auto',
      ...(patternAbs ? { localesPattern: patternAbs } : { localesLayout: existing.localesLayout || null }),
    }, { cwd });
    return layout.namespaced ? layout.sourceFiles.length > 0 : fs.existsSync(layout.sourceFiles[0].path);
  } catch {
    return false;
  }
}

/**
 * The non-interactive path's config over an existing file: start from the
 * file, and rewrite only what the flags name (built from them as for a new
 * project in `fresh`).
 *
 *   --source → inputLocale; --dir, or a layout that no longer finds the source
 *   → localesDir/localesPattern/localesLayout (re-detected); --format → format;
 *   --method → defaultMethod, and the model with it when the method changes
 *   (a model belongs to its method) unless --model names one; --model → model;
 *   --temperature; --content-dir → contentDir; --langs → the target list (a
 *   code already there keeps its entry — register, script, name — as it was).
 *
 * Everything else (batchSize, pairs, glossary, fallbacks, registers, …) is the
 * file's. --script, --name and --method api's pairs are applied afterwards by
 * the same code as for a new project.
 *
 * @param {object} existing - The parsed config file
 * @param {object} fresh - buildDefaultConfig() + applyDetection() for these flags
 * @param {object} args
 * @param {{ relayout: boolean, detection: object }} p
 * @returns {{ config: object, added: string[] }} added = target codes new to the file
 */
function overlayFlagsOnConfig(existing, fresh, args, { relayout, detection }) {
  const config = cloneJSON(existing);
  const take = (key, replaces = null) => setInPlace(config, key, fresh[key], replaces);
  if (config.version === undefined) config.version = fresh.version;
  if (args.source) take('inputLocale');
  if (relayout) {
    // A pattern replaces localesDir in place; never write both.
    take('localesPattern', 'localesDir');
    take('localesDir');
    take('localesLayout');
    // A Flutter template names the source (app_en.arb → en); --source wins.
    if (!args.source && detection?.found?.inputLocale) take('inputLocale');
  }
  if (args.format || relayout) take('format');
  const methodBefore = existing.defaultMethod || 'llm';
  const methodAfter = fresh.defaultMethod || 'llm';
  if (args.method) take('defaultMethod');
  if (args.model || (args.method && methodAfter !== methodBefore)) take('model');
  if (args.temperature != null) take('temperature');
  if (args['content-dir'] != null) take('contentDir');

  let added = [];
  if (args.langs) {
    const listed = languageCodes(fresh.languages);
    const prior = existing.languages;
    const priorEntry = Array.isArray(prior)
      ? Object.fromEntries(prior.map(c => [c, null]))
      : (prior && typeof prior === 'object' ? prior : {});
    const had = (c) => Object.prototype.hasOwnProperty.call(priorEntry, c);
    added = listed.filter(c => !had(c));
    // Plain codes stay a plain list (registers are recorded for the new ones later).
    config.languages = listed.every(c => priorEntry[c] == null)
      ? [...listed]
      : Object.fromEntries(listed.map(c => [c, priorEntry[c] ?? {}]));
  }
  return { config, added };
}

/**
 * The wizard's config over an existing file: the wizard asked for the source,
 * the targets and their registers, the method and model, the temperature, the
 * content folder and the locale layout — those are its answers; every field
 * it does not ask about (batchSize, pairs, glossary, …) is the file's, and a
 * target's entry keeps the fields the wizard does not set (script, name,
 * genderGuidance, …).
 *
 * @param {object} existing
 * @param {object} answered - buildConfig() from the wizard
 * @returns {object}
 */
function mergeWizardConfig(existing, answered) {
  const config = cloneJSON(existing);
  const take = (key, replaces = null) => setInPlace(config, key, answered[key], replaces);
  if (config.version === undefined) config.version = answered.version;
  take('inputLocale');
  take('localesPattern', 'localesDir');
  take('localesDir');
  if (answered.localesDir !== existing.localesDir || answered.localesPattern !== existing.localesPattern) delete config.localesLayout;
  take('format');
  take('defaultMethod');
  take('model');
  take('temperature');
  take('contentDir');

  const asObject = (v) => (typeof v === 'string' ? { register: v } : (v && typeof v === 'object' ? { ...v } : {}));
  const prior = Array.isArray(existing.languages)
    ? Object.fromEntries(existing.languages.map(c => [c, {}]))
    : (existing.languages && typeof existing.languages === 'object' ? existing.languages : {});
  if (Array.isArray(answered.languages)) {
    config.languages = answered.languages.every(c => !prior[c] || Object.keys(asObject(prior[c])).length === 0)
      ? [...answered.languages]
      : Object.fromEntries(answered.languages.map(c => [c, prior[c] ?? {}]));
  } else {
    const out = {};
    for (const [code, value] of Object.entries(answered.languages || {})) {
      const merged = { ...asObject(prior[code]), ...asObject(value) };
      const keys = Object.keys(merged);
      out[code] = keys.length === 1 && keys[0] === 'register' && typeof merged.register === 'string' ? merged.register : merged;
    }
    config.languages = out;
  }
  return config;
}

/** Each target's register in a config (code → preset key or own words). */
function registersOf(config) {
  const out = {};
  const langs = config.languages;
  if (!langs || typeof langs !== 'object' || Array.isArray(langs)) return out;
  for (const [code, value] of Object.entries(langs)) {
    const register = typeof value === 'string' ? value : (value && typeof value === 'object' ? value.register : null);
    if (typeof register === 'string' && register) out[code] = register;
  }
  return out;
}

/**
 * The wizard's defaults over an existing file: its source, targets,
 * temperature, content folder and (while it still finds the source) locale
 * folder — flags still win — so pressing Enter keeps what the file says.
 */
function prefillFromConfig(args, existing, relayout) {
  const out = { ...args };
  if (!out.source && typeof existing.inputLocale === 'string') out.source = existing.inputLocale;
  if (!out.langs) {
    const codes = languageCodes(existing.languages);
    if (codes.length > 0) out.langs = codes.join(',');
  }
  if (out.temperature == null && typeof existing.temperature === 'number') out.temperature = existing.temperature;
  if (out['content-dir'] == null && typeof existing.contentDir === 'string') out['content-dir'] = existing.contentDir;
  if (!out.dir && !relayout && !existing.localesPattern && typeof existing.localesDir === 'string') out.dir = existing.localesDir;
  if (!out.format && typeof existing.format === 'string') out.format = existing.format;
  if (!out.script && existing.languages && !Array.isArray(existing.languages)) {
    const scripts = Object.entries(existing.languages)
      .filter(([, v]) => v && typeof v === 'object' && typeof v.script === 'string')
      .map(([c, v]) => `${c}=${v.script}`);
    if (scripts.length > 0) out.script = scripts.join(',');
  }
  return out;
}

/** A config value, short, for a "was → now" line. */
function showValue(v) {
  if (v === undefined) return '(not set)';
  const s = JSON.stringify(v);
  return s.length > 70 ? `${s.slice(0, 67)}…` : s;
}

/**
 * What a forced re-run changes in the file, in words: one line per changed
 * field ("model: \"m1\" → \"x\""), the targets added or removed and each
 * target whose entry changed; and the fields left as they were.
 *
 * @param {object} before
 * @param {object} after
 * @returns {{ changed: string[], kept: string[] }}
 */
function describeConfigChanges(before, after) {
  const changed = [];
  const kept = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  for (const key of keys) {
    if (same(before[key], after[key])) {
      if (key in before) kept.push(key);
      continue;
    }
    if (key !== 'languages') {
      changed.push(`${key}: ${showValue(before[key])} → ${showValue(after[key])}`);
      continue;
    }
    const entry = (langs, code) => (Array.isArray(langs) ? (langs.includes(code) ? {} : undefined) : langs?.[code]);
    const was = languageCodes(before.languages);
    const now = languageCodes(after.languages);
    const added = now.filter(c => !was.includes(c));
    const removed = was.filter(c => !now.includes(c));
    const parts = [];
    if (added.length > 0) parts.push(`added ${added.map(c => `${c} (${showValue(entry(after.languages, c))})`).join(', ')}`);
    if (removed.length > 0) parts.push(`removed ${removed.join(', ')}`);
    for (const c of now.filter(c => was.includes(c))) {
      const a = entry(before.languages, c);
      const b = entry(after.languages, c);
      if (!same(a, b)) parts.push(`${c}: ${showValue(a)} → ${showValue(b)}`);
    }
    changed.push(`languages: ${parts.length > 0 ? parts.join('; ') : 'written as an object (the same targets and settings)'}`);
  }
  return { changed, kept };
}

/**
 * Keep a copy of the config file before init rewrites it:
 * champollion.config.json.bak, or — when that already holds an OLDER, different
 * file — the next free champollion.config.json.bak.2, .bak.3 … (an older
 * backup is never overwritten). A backup that already holds exactly this file
 * is reused.
 *
 * @param {string} configPath
 * @param {string} raw - The file's current text
 * @returns {{ path: string, reused: boolean }}
 */
function backupConfigFile(configPath, raw) {
  const base = `${configPath}.bak`;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}.${n}`;
    if (!fs.existsSync(candidate)) {
      fs.writeFileSync(candidate, raw, { encoding: 'utf-8', flag: 'wx' });
      return { path: candidate, reused: false };
    }
    if (fs.readFileSync(candidate, 'utf-8') === raw) return { path: candidate, reused: true };
  }
}

/**
 * Where a method sends the strings it translates, for a method that sends
 * them off this machine — said at init time, with how to keep them here
 * (Round 10, hospital persona: the default was a hosted model, and nothing
 * at init said so). Null for a method that runs here (`local`), and for an
 * `api` endpoint on this machine.
 *
 * @param {object} config
 * @param {{ endpoint: string }|null} apiSetup
 * @returns {string|null}
 */
function whereTextGoes(config, apiSetup) {
  const method = config.defaultMethod || 'llm';
  if (method === API_METHOD) {
    if (!apiSetup) return null;
    let host = '';
    try { host = new URL(apiSetup.endpoint).hostname; } catch { /* validated */ }
    return LOOPBACK_HOSTS.has(host) ? null : `the server at ${apiSetup.endpoint}`;
  }
  const opt = METHOD_OPTIONS.find(m => m.method === method);
  return opt?.sendsTo || null;
}

/**
 * What init says about a local-only mark in the project (lib/local-only-marks.js):
 * why the default is the local method — one line naming the marked file —
 * how to choose a hosted method deliberately, and what local needs.
 * Null when nothing in the project is marked.
 *
 * @param {string} cwd
 * @param {Array<{ sidecar: string, dataFile: string, unreadable: boolean }>} marks
 * @returns {{ why: string, hosted: string, needs: string }|null}
 */
function localOnlyNotice(cwd, marks) {
  if (!marks || marks.length === 0) return null;
  const rel = (p) => projectRelative(cwd, p).replace(/^\.\//, '');
  const first = marks[0];
  const more = marks.length > 1 ? ` (+${marks.length - 1} more marked file(s))` : '';
  const why = first.unreadable
    ? `${rel(first.sidecar)} could not be read, so ${rel(first.dataFile)} is treated as marked local-only${more}: only a model on this machine may see it.`
    : `${rel(first.dataFile)} is marked local-only (${rel(first.sidecar)})${more}: only a model on this machine may see it.`;
  return {
    why,
    hosted: `A hosted method is a deliberate choice: champollion init --force --method llm --model ${DEFAULT_OPENROUTER_MODEL} `
      + '(--force rewrites only the method and model; the strings sync translates then go to OpenRouter).',
    needs: 'Local needs a model server on this machine: Ollama\'s default (http://localhost:11434/v1), '
      + 'or LOCAL_API_BASE set to yours (LM Studio, vLLM).',
  };
}

async function run(args, cwd) {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILENAME);

  // ── Help ──
  // NOTE: `champollion init --help` is normally intercepted by bin/cli.js
  // before this module loads — this branch covers programmatic callers.
  // The help text SSOT is COMMAND_HELP.init in lib/command-help.js.
  if (args.help) {
    showCommandHelp('init');
    return 0;
  }

  // ── Fail fast on bad flag values (both modes, before anything is written) ──
  const flagError = validateInitFlags(args);
  if (flagError) {
    output.error(flagError);
    return 1;
  }
  // Like localesDir: never write a contentDir that does not exist.
  if (args['content-dir'] != null) {
    const contentAbs = path.resolve(cwd, String(args['content-dir']));
    let isDir = false;
    try { isDir = fs.statSync(contentAbs).isDirectory(); } catch { /* missing */ }
    if (!args['content-dir'] || !isDir) {
      output.error(`--content-dir ${args['content-dir'] || '(empty)'}: no such folder `
        + `(${projectRelative(cwd, contentAbs)}). Point it at the folder of Markdown/MDX files to translate.`);
      return 1;
    }
  }

  // ── Guard: config already exists ──
  // Without --force, refuse to clobber an existing config. Exit non-zero so
  // scripts (and the user) can tell "already initialized / not regenerated"
  // from a successful fresh init — a silent exit 0 here hid the no-op,
  // especially for a corrupt config that the user expected `init --yes` to fix.
  // Pass --force to re-run init over an existing config: it rewrites what the
  // flags ask for and keeps the rest (overlayFlagsOnConfig), after a backup.
  // A fresh project (no config yet) is where a new user decides to adopt
  // the CLI: init says the license there once (not on every --force rerun).
  const freshProject = !fs.existsSync(configPath);
  if (fs.existsSync(configPath) && !args.force) {
    output.warn(`Config file already exists: ${DEFAULT_CONFIG_FILENAME}`);
    output.raw('   To change a setting, edit it in the file (e.g. "model", "defaultMethod", "languages").');
    output.raw('   --force re-runs init over it: it rewrites only what the flags name, keeps every other');
    output.raw(`   setting, prints what changed and backs the file up first (${DEFAULT_CONFIG_FILENAME}.bak).`);
    return 1;
  }

  // ── --force over an existing config: read it, to keep what is not asked ──
  // A file that is not a JSON object cannot be kept: it is backed up and a
  // new one written (said below).
  let existing = null;
  let existingRaw = null;
  let existingUnreadable = null;
  if (!freshProject) {
    existingRaw = fs.readFileSync(configPath, 'utf-8');
    try {
      const parsed = JSON.parse(existingRaw.replace(/^﻿/, ''));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object');
      existing = parsed;
    } catch (err) {
      existingUnreadable = err.message;
    }
  }

  // ── Find the project's locale files BEFORE writing anything ──
  // A config whose localesDir points nowhere fails on the first sync; this
  // is where a next-intl (messages/en.json) or i18next
  // (public/locales/en/common.json) project gets its real layout.
  const sourceLocale = args.source
    || (existing && typeof existing.inputLocale === 'string' && existing.inputLocale) || 'en';
  const detection = detectLocaleSetup(cwd, { source: sourceLocale, dir: args.dir || null });
  // The existing file's layout is kept while it still finds the source files
  // (and no --dir/--format names another); otherwise it is re-detected.
  const relayout = !existing || !!args.dir || !existingLayoutHolds(existing, sourceLocale, cwd);
  reportDetection(detection, detection.found?.inputLocale && !args.source ? detection.found.inputLocale : sourceLocale);
  if (existing && !relayout) {
    const where = existing.localesPattern ? `"localesPattern": "${existing.localesPattern}"` : `"localesDir": "${existing.localesDir || './locales'}"`;
    output.info(`Keeping the config's locale layout (${where}) — it still finds the ${sourceLocale} source files. --dir changes it.`);
  }
  // Markdown pages: suggested, never switched on — translating them is work
  // (and, with a paid method, cost) the user chooses (Round 3, school persona).
  if (args['content-dir'] == null && !detection.docusaurus && !(existing && existing.contentDir)) {
    const exclude = detection.found ? [path.resolve(cwd, detection.found.localesDir)] : [];
    const md = suggestContentDirs(cwd, exclude);
    if (md.length > 0) {
      output.info(`Markdown found in ${md.map(m => `${m.dir}/ (${m.files} file(s))`).join(', ')} — not translated unless you ask: `
        + `add --content-dir ${md[0].dir} (or set "contentDir") to translate those pages too.`);
    }
  }
  if (args.source && detection.found?.inputLocale && detection.found.inputLocale !== args.source) {
    output.warn(`--source ${args.source}, but the Flutter template ${detection.found.sourceFiles[0]} is `
      + `"${detection.found.inputLocale}" — gen-l10n treats the template as the source. Using --source as given.`);
  }

  // ── A file in the project marked local-only: the DEFAULT method is local ──
  // (lib/local-only-marks.js). Only the default: an explicit --method wins,
  // and over an existing file the method it holds is kept. Without a mark
  // nothing here changes (Round 14, hospital persona: three rounds of
  // `init --yes` wrote OpenRouter beside a set marked local-only).
  const localMark = localOnlyNotice(cwd, findLocalOnlyMarks(cwd).marks);
  const markDefaultsToLocal = !!localMark && !args.method && !existing;

  // ── Choose mode: interactive wizard or silent defaults ──
  let config;
  let envVars = [];
  let apiSetup = null;

  let addedCodes = null; // --force over a file: the targets new to it (registers recorded for these only)
  if (!args.yes && isInteractive() && args.method !== API_METHOD) {
    // Over an existing file the wizard starts from its values (Enter keeps them).
    const wizardArgs = existing ? prefillFromConfig(args, existing, relayout) : args;
    const result = await runInteractive(cwd, wizardArgs, detection, existing ? registersOf(existing) : null,
      existing ? null : localMark);
    if (!result) return 0; // User cancelled
    config = existing ? mergeWizardConfig(existing, result.config) : result.config;
    envVars = existing ? collectRequiredEnvVars(config.defaultMethod || 'llm', config.languages) : result.envVars;
    if (existing) addedCodes = new Set();
  } else {
    // Say WHY the wizard was skipped — an agent (or CI) piping stdin
    // shouldn't have to guess which mode ran.
    if (!args.yes && args.method === API_METHOD && isInteractive()) {
      output.info('--method api is set up from flags (--endpoint, --langs) — skipping the wizard.');
    } else if (!args.yes) {
      output.info(existing
        ? `stdin is not a TTY — skipping the wizard: the flags say what to change in ${DEFAULT_CONFIG_FILENAME}.`
        : 'stdin is not a TTY — skipping the wizard, writing a default config.');
      output.raw('   Configure via flags (--langs, --method, --model, ...); see `champollion init --help`.');
    }
    if (markDefaultsToLocal) {
      output.info(`Method: local — ${localMark.why}`);
      output.raw(`   ${localMark.hosted}`);
      output.raw(`   ${localMark.needs}`);
    }
    config = await buildDefaultConfig({ ...args, source: sourceLocale, ...(markDefaultsToLocal && { method: 'local' }) });
    applyDetection(config, detection, args);
    // Over an existing file: the file, with only what the flags name rewritten.
    if (existing) {
      const overlaid = overlayFlagsOnConfig(existing, config, args, { relayout, detection });
      config = overlaid.config;
      addedCodes = new Set(overlaid.added);
    }
    // --method api: one pair per target, the shape forge's DEPLOY.md shows.
    if (args.method === API_METHOD) {
      const listed = Array.isArray(config.languages) ? config.languages : Object.keys(config.languages || {});
      const targets = listed.length > 0 ? listed : (detection.found?.targets || []);
      if (targets.length === 0) {
        output.error('--method api needs the target languages: the endpoint is set per pair. Add --langs <codes> (e.g. --langs abc).');
        return 1;
      }
      const endpoint = String(args.endpoint).trim();
      const instructions = resolveAcceptsInstructions(args, cwd);
      writeApiPairs(config, targets, endpoint, instructions.value);
      apiSetup = { endpoint, targets, instructions };
    }
    const scriptPlan = applyScriptChoices(config, args);
    if (scriptPlan.error) {
      output.error(scriptPlan.error);
      return 1;
    }
    for (const { code, choices } of scriptPlan.needed) {
      const options = choices.map(c => `"${c.script}" (${c.label})`).join(' or ');
      // The entry as the file will hold it, with the script added — one
      // field in the file, never a re-run of init (Round 10: `init --force`
      // advised for one setting rewrote the whole config).
      const prior = Array.isArray(config.languages) ? undefined : config.languages[code];
      const register = typeof prior === 'string' ? prior : (prior && typeof prior === 'object' && prior.register) || defaultRegisterKey(code);
      const entry = { ...(prior && typeof prior === 'object' ? prior : {}), ...(register && { register }), script: choices[0].script };
      output.warn(`${code} is written in more than one orthography — ${options}. Champollion will not choose one for a `
        + 'community, so `champollion sync` refuses to translate it until the config says which. Choose it in '
        + `${DEFAULT_CONFIG_FILENAME}: add "script" to ${code}'s entry in "languages" — `
        + `"${code}": ${JSON.stringify(entry).replace(/,"/g, ', "').replace(/":/g, '": ')} (or "script": "${choices[1].script}").`);
    }
    envVars = collectRequiredEnvVars(config.defaultMethod || 'llm', config.languages);
    // An api endpoint off this machine needs its bearer key (a loopback
    // server started without a token needs none — lib/methods/api.js).
    if (apiSetup) {
      let host = '';
      try { host = new URL(apiSetup.endpoint).hostname; } catch { /* validated above */ }
      if (!LOOPBACK_HOSTS.has(host)) envVars.push({ envVar: API_KEY_ENV, label: 'champollion API endpoint' });
    }

    // Typos in --langs write configs that only break at first sync — warn now.
    // A private-use code (qaa–qtz) is not a typo: it is the range kept for a
    // variety with no confirmed code (Round 8 personas: "check the spelling"
    // for the code the guide recommends).
    const named = parseNameFlag(args.name).map;
    for (const code of Array.isArray(config.languages) ? config.languages : Object.keys(config.languages || {})) {
      // Flutter writes locales with "_" (pt_BR); the cards know "pt-BR".
      if (getLanguageCard(code) || getLanguageCard(code.replace(/_/g, '-')) || DEFAULT_REGISTERS[code]) continue;
      if (isPrivateUseCode(code)) {
        output.info(`"${code}" is a private-use code (ISO 639 keeps qaa–qtz for a variety with no confirmed code): it has no language card, `
          + 'so no register presets, plural rules or script come from one. '
          + (named[code] ? `Its name in prompts and reports: "${named[code]}".` : `Give it a name, which is what the model is told: --name ${code}="<display name>".`));
        continue;
      }
      output.warn(`Unrecognized language code "${code}" — kept in config, but check the spelling.`);
    }
  }

  // --name code="Display name": written into the language's entry, so prompts
  // and reports name a language that has no card (a private-use code).
  {
    const { error } = applyDisplayNames(config, args);
    if (error) {
      output.error(error);
      return 1;
    }
  }

  // Each target's register goes into the file, not only into this output.
  // Over an existing file: only for the targets new to it (the others keep
  // their entries exactly as the file has them).
  recordRegisters(config, addedCodes);

  // Both shapes on disk (en.json AND en/…): the detection's choice is
  // written down so sync never has to guess between them (an existing
  // file's own choice stands while its layout holds).
  if (relayout && detection.found?.ambiguous && config.localesDir
      && path.resolve(cwd, config.localesDir) === path.resolve(cwd, detection.found.localesDir)) {
    config.localesLayout = detection.found.layout;
  }

  // ── Never write a localesDir that does not exist ──
  // Nothing found and no --dir: create the (default) directory so the
  // config is valid, and the next steps below say what to put in it.
  // Docusaurus is the exception: `docusaurus write-translations` creates
  // i18n/ with the files sync needs, and an empty one would only hide that.
  // A localesPattern (Flutter, gettext) was detected from files on disk:
  // its folder exists, and nothing is created — the pattern is the answer.
  const patternAbs = config.localesPattern ? path.resolve(cwd, config.localesPattern) : null;
  const localesAbs = patternAbs ? compileLocalesPattern(patternAbs).base : path.resolve(cwd, config.localesDir);
  // (run() shadows configPath with the config file's path.)
  const localesLabel = projectRelative(cwd, localesAbs);
  let createdLocalesDir = false;
  if (!patternAbs && config.format !== 'docusaurus' && !fs.existsSync(localesAbs)) {
    fs.mkdirSync(localesAbs, { recursive: true });
    createdLocalesDir = true;
  }

  // ── Write config ──
  // Over an existing file: backed up first (never over an older backup),
  // then what changed and what was kept, field by field.
  if (freshProject) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    output.ok(`Created ${DEFAULT_CONFIG_FILENAME}`);
  } else {
    const { changed, kept } = existing ? describeConfigChanges(existing, config) : { changed: null, kept: [] };
    if (changed && changed.length === 0) {
      output.ok(`${DEFAULT_CONFIG_FILENAME} unchanged — it already says what the flags ask for (nothing written, no backup needed).`);
    } else {
      const backup = backupConfigFile(configPath, existingRaw);
      const backupName = projectRelative(cwd, backup.path).replace(/^\.\//, '');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      if (!existing) {
        output.warn(`${DEFAULT_CONFIG_FILENAME} could not be read (${existingUnreadable}), so nothing in it could be kept: `
          + `wrote a new one from the flags and what is on disk. The old file is in ${backupName}${backup.reused ? ' (an earlier backup of the same file)' : ''} — copy back what you need.`);
      } else {
        output.ok(`Updated ${DEFAULT_CONFIG_FILENAME} — only what the flags ask for; the previous file is in ${backupName}`
          + `${backup.reused ? ' (an earlier backup of the same file)' : ''}.`);
        output.raw('   Changed:');
        for (const line of changed) output.raw(`     ${line}`);
        if (kept.length > 0) output.raw(`   Kept as they were: ${kept.join(', ')}`);
      }
    }
  }
  ensureCacheIgnored(cwd);
  if (createdLocalesDir) {
    output.ok(`Created ${localesLabel.replace(/^\.\//, '')}/ (no locale files were found to point at)`);
  }

  // ── Create the target locale files --langs asked for ──
  // Empty files of the right format, in the detected layout (fr.json, or
  // fr/common.json + fr/admin.json mirroring en/). Nobody should have to
  // hand-create an empty fr.json; sync fills them. Needs the source on
  // disk — the source's files decide the namespaces and the format.
  const targetCodes = Array.isArray(config.languages) ? config.languages : Object.keys(config.languages || {});
  let sourceReady = config.format === 'docusaurus';
  if (config.format !== 'docusaurus') {
    const layout = discoverLocaleLayout({
      inputLocale: config.inputLocale, localesDir: localesAbs, format: config.format,
      ...(patternAbs ? { localesPattern: patternAbs } : { localesLayout: config.localesLayout || null }),
    }, { cwd });
    sourceReady = layout.namespaced
      ? layout.sourceFiles.length > 0
      : fs.existsSync(layout.sourceFiles[0].path);
    if (sourceReady && targetCodes.length > 0) {
      const { created, unsupported, refused } = createMissingTargetFiles(layout, targetCodes);
      if (created.length > 0) {
        // Paths from the project root (locale/fr/LC_MESSAGES/django.po), not
        // from the locale folder: "fr/LC_MESSAGES/django.po" named no real
        // path (Round 3, Django persona).
        const shown = created.slice(0, 6).map(f => projectRelative(cwd, f.path).replace(/^\.\//, '')).join(', ');
        const more = created.length > 6 ? `, +${created.length - 6} more` : '';
        output.ok(`Created ${created.length} empty target file(s): ${shown}${more} — \`champollion sync\` fills them`);
      }
      for (const f of unsupported) {
        output.warn(`Did not create ${projectRelative(cwd, f.path).replace(/^\.\//, '')}: this version cannot write "${f.format}" files yet.`);
      }
      for (const f of refused) {
        output.warn(`Did not create ${f.rel}: the path leaves ${localesLabel}/ — check the language code.`);
      }
    }
    // Flutter: the app's own messages come from these ARB files, but
    // Material/Cupertino widget text comes from flutter_localizations, which
    // covers a fixed list of languages — a target outside it needs a
    // fallback delegate (Round 11, hospital persona; lib/flutter-locales.js).
    if (targetCodes.length > 0 && (layout.sourceFiles[0]?.format === 'arb' || /\.arb$/i.test(layout.sourceFiles[0]?.path || ''))) {
      for (const { level, text } of flutterLocaleLines(targetCodes)) output[level](text);
    }
  }
  // Django: a locale/ beside manage.py belongs to no app, so Django reads it
  // only through LOCALE_PATHS, and offers only the languages in LANGUAGES.
  // Without them CI compiled and committed catalogs the site never showed
  // (Round 12, Django persona).
  if (isDjangoRootLocale(cwd)) {
    output.info('Django reads locale/ only when LOCALE_PATHS in your settings names it, and offers only the languages '
      + 'LANGUAGES lists (its default: every language Django ships with): '
      + 'https://champollion.dev/docs/integrations/frameworks#django-locale-paths');
  }
  output.raw('');

  // ── Show register summary when languages are configured ──
  // What the config now says for each target, the other presets it could
  // say, and how to change it (Round 5, i18next persona).
  const langCount = Array.isArray(config.languages) ? config.languages.length : Object.keys(config.languages).length;
  if (langCount > 0) {
    output.raw('  Registers (written to "languages" in the config):');
    const entries = Array.isArray(config.languages)
      ? config.languages.map(code => [code, {}])
      : Object.entries(config.languages);
    let example = null;
    let genderShown = false;
    for (const [code, value] of entries) {
      const card = getLanguageCard(code);
      const name = (value && typeof value === 'object' && typeof value.name === 'string' && value.name) || card?.name || code;
      const chosen = typeof value === 'string' ? value : (value && typeof value === 'object' ? value.register : null);
      const others = getRegisterPresets(resolveCode(code)).map(p => p.key).filter(k => k !== chosen);
      const shown = chosen
        ? (chosen.length > 40 ? `"${chosen.slice(0, 37)}…"` : chosen)
        : '(no presets — a professional register)';
      output.raw(`    ${code.padEnd(6)} ${name} → ${shown}${others.length > 0 ? `   (others: ${others.join(', ')})` : ''}`);
      // The gender guidance its prompts carry by default (LLM methods) —
      // never a silent choice (Round 8: écriture inclusive was invisible).
      const ownGender = value && typeof value === 'object' ? value.genderGuidance : undefined;
      const genderSetting = ownGender !== undefined ? ownGender : config.genderGuidance;
      if (genderSetting === false) {
        output.raw('           gender: no guidance (set off in the config)');
      } else {
        const g = summarizeGenderGuidance(typeof genderSetting === 'string' ? genderSetting : getLanguageCard(resolveCode(code))?.gender?.inclusiveGuidance);
        if (g) {
          output.raw(`           gender (${typeof genderSetting === 'string' ? 'your config' : 'default'}): ${g}`);
          genderShown = true;
        }
      }
      if (!example && others.length > 0 && typeof value === 'string') example = { code, preset: others[0] };
    }
    if (genderShown) {
      output.raw('  Gender guidance: "genderGuidance" in the config (per language, or for all) — false for none, or your own words.');
    }
    if (example) {
      output.raw(`  To change one, edit "languages" in ${DEFAULT_CONFIG_FILENAME}: a preset name (e.g. "${example.code}": "${example.preset}")`);
      output.raw('  or your own words describing the tone and audience; `champollion status` shows what each pair uses.');
    }
    output.raw('');
  }

  // ── Next steps — skip env var instruction if already set ──
  // One blank line under the heading, none stacked: optional hints and the
  // numbered steps follow each other directly (two blank lines used to
  // open this list — hospital persona, 2026-10).
  output.raw('  Next steps:');
  output.raw('');
  let step = 1;

  // Only show env var setup if any required key is missing from the environment
  // An optional variable (LOCAL_API_BASE has a working default) is a hint,
  // not a step: telling someone to "set your API key" for a local model
  // would send them looking for a key that does not exist.
  const isOptional = (envVar) => METHOD_OPTIONS.some(m => m.envVar === envVar && m.envOptional);
  for (const { envVar } of envVars.filter(({ envVar }) => isOptional(envVar) && !process.env[envVar])) {
    const opt = METHOD_OPTIONS.find(m => m.envVar === envVar);
    output.raw(`  (Local model endpoint: export ${envVar}=${opt.envExample} — only if yours is elsewhere.)`);
  }
  const missingEnvVars = envVars.filter(({ envVar }) => !process.env[envVar] && !isOptional(envVar));
  if (missingEnvVars.length === 1) {
    output.raw(`  ${step}. Set your API key:`);
    output.raw(`     export ${missingEnvVars[0].envVar}=...`);
    // No key at all? A model on this machine needs none.
    if (missingEnvVars[0].envVar === 'OPENROUTER_API_KEY') {
      output.raw('     (or, with no key: a model on this machine — Ollama, LM Studio, a forge model:');
      output.raw(`      set "defaultMethod": "local" and "model": "llama3.1" (your model's name) in ${DEFAULT_CONFIG_FILENAME})`);
    }
    step++;
  } else if (missingEnvVars.length > 1) {
    output.raw(`  ${step}. Set your API key(s):`);
    for (const { envVar, label } of missingEnvVars) {
      output.raw(`     export ${envVar}=...    # ${label}`);
    }
    step++;
  }

  if (config.format === 'docusaurus' && !fs.existsSync(localesAbs)) {
    output.raw(`  ${step}. Generate the i18n files: npx docusaurus write-translations --locale ${targetCodes[0] || '<lang>'}`);
    step++;
  } else if (!sourceReady && patternAbs) {
    const where = projectRelative(cwd, compileLocalesPattern(patternAbs).render(config.inputLocale, '<ns>'));
    output.raw(`  ${step}. Put your source strings in ${where}`);
    step++;
  } else if (!sourceReady) {
    output.raw(`  ${step}. Put your source strings in ${localesLabel}/${config.inputLocale}.json`
      + ' (or a folder of files: ' + `${localesLabel}/${config.inputLocale}/common.json)`);
    step++;
  }
  if (langCount === 0) {
    const onDisk = detection.found && path.resolve(cwd, detection.found.localesDir) === localesAbs
      ? detection.found.targets : [];
    if (onDisk.length > 0) {
      output.raw(`  ${step}. Target locales found on disk: ${onDisk.join(', ')} — sync translates into them.`);
      output.raw(`     To add more: list every target in "languages" in ${DEFAULT_CONFIG_FILENAME} (e.g. "languages": ["fr", "de"]);`);
      output.raw('     sync creates the files a new one needs.');
    } else {
      output.raw(`  ${step}. Choose target languages: list them in "languages" in ${DEFAULT_CONFIG_FILENAME}`);
      output.raw('     (e.g. "languages": ["fr", "de"]); sync creates their empty target files.');
    }
    step++;
  }
  output.raw(`  ${step}. Run: champollion status    # verify your setup`);
  output.raw(`  ${step + 1}. Run: champollion sync      # translate!`);
  // Which method the config uses, and how to choose another without editing
  // JSON — a persona hand-edited the config to pick its local model (Round 3).
  const chosenMethod = config.defaultMethod || 'llm';
  // A model served on this machine: a CI runner has none, so a workflow
  // copied as-is fails there (Round 11, i18next persona — the CI guide said
  // so, init never mentioned CI). One line: what CI needs, and where to read.
  let apiHost = '';
  try { apiHost = apiSetup ? new URL(apiSetup.endpoint).hostname : ''; } catch { /* validated */ }
  if (chosenMethod === 'local' || (apiSetup && LOOPBACK_HOSTS.has(apiHost))) {
    output.raw(`  ${step + 2}. In CI: a runner has no model server — run a hosted method there (sync --method llm --model ${DEFAULT_OPENROUTER_MODEL}, `
      + `its key as a repository secret) or use a runner that can reach a model server (${chosenMethod === 'local' ? 'LOCAL_API_BASE' : 'the pair\'s "endpoint"'}): `
      + 'https://champollion.dev/docs/guides/ci-cd');
  }
  const chosenModel = config.model ? `, model ${config.model}` : '';
  output.raw('');
  if (apiSetup) {
    const { value, from } = apiSetup.instructions;
    output.raw(`  Method: api, endpoint ${apiSetup.endpoint} — written as "pairs" for ${apiSetup.targets.map(t => `${config.inputLocale}:${t}`).join(', ')}.`);
    output.raw(typeof value === 'boolean'
      ? `    acceptsInstructions: ${value} (from ${from})${value ? '' : ' — the quality gate\'s retries go to the pair\'s "fallback", if you add one'}.`
      : '    acceptsInstructions: not stated — the text is sent alone. If the server follows per-key instructions, '
        + 'set "acceptsInstructions": true in those "pairs" entries (a model trained with nmt-forge does not: false).');
    output.raw('    A "fallback" method for the strings it cannot translate safely is added by hand: see the DEPLOY.md beside the model.');
  } else {
    // How to switch: the config field (or a pair's own), never a re-run of
    // init (Round 10, Next.js persona: `init --force --method … --model …`
    // printed here rewrote the whole config). --method/--model on sync try
    // one for a single run.
    output.raw(`  Method: ${chosenMethod}${chosenModel}. To use another, edit "defaultMethod" and "model" in ${DEFAULT_CONFIG_FILENAME}`);
    output.raw('    (or a pair\'s own "method"/"model" in "pairs"). To try one for a single run: champollion sync --method <name> --model <model>');
    output.raw('    — the file is not changed. `champollion init --help` lists the methods.');
  }
  // Where the strings go — said at init, with how to keep them here
  // (Round 10, hospital persona: the default sent them to a hosted model and
  // nothing at init said so).
  const destination = whereTextGoes(config, apiSetup);
  if (destination) {
    output.raw(`  Where the text goes: ${chosenMethod} sends every string it translates to ${destination}.`);
    // A hosted method beside a local-only mark came from --method, the
    // wizard or the existing file — never from the default; said, with the file.
    if (localMark) output.raw(`    Note: ${localMark.why}`);
    output.raw('    To keep it on this machine, use a model served here (Ollama, LM Studio, vLLM): "defaultMethod": "local" and');
    output.raw('    "model": "<its name>" in the config — or try it for one run: champollion sync --method local --model <its name>.');
    output.raw('    A model served by `nmt-forge serve`: a pair\'s "method": "api" with its "endpoint" (`champollion init --help`).');
  }

  // ── Evidence hint — published results + live engine availability per pair ──
  // The configured targets, never an example code: a project that targets
  // only abc was told to `xliff export --locale fr` (hospital persona,
  // 2026-10). The canonical grouped command form, as the docs write it.
  const configuredTargets = Array.isArray(config.languages)
    ? config.languages
    : Object.keys(config.languages || {});
  const firstTarget = configuredTargets[0] || null;
  if (firstTarget) {
    output.raw('');
    output.raw('  Evidence for your pairs (published results + what’s runnable now):');
    for (const code of configuredTargets.slice(0, 3)) {
      output.raw(`    champollion network recommend ${config.inputLocale} ${code}`);
    }
    if (configuredTargets.length > 3) output.raw(`    … and the same for ${configuredTargets.slice(3).join(', ')}`);
  }

  // ── Cost-saving tips — help users discover TM early ──
  output.raw('');
  output.raw('  After your first sync:');
  output.raw('    champollion tm stats           # see cached translations');
  if (firstTarget) {
    output.raw(`    champollion xliff export --locale ${firstTarget}  # export for human review`);
  }
  output.raw('');
  output.raw('  Translations are cached in .champollion/tm.json \u2014 re-running sync');
  output.raw('  only calls the API for keys that actually changed.');
  if (freshProject) {
    output.raw('');
    output.raw(`  ${licenseLine()}`);
  }

  return 0;
}

/**
 * The register preset a language's card makes the default, or null when the
 * language has no presets. Resolved like config.js resolves it at run time
 * (resolveCode, then the card), so what init writes is what sync would use.
 *
 * @param {string} code
 * @returns {string|null}
 */
function defaultRegisterKey(code) {
  const presets = getRegisterPresets(resolveCode(code));
  return (presets.find(p => p.isDefault) || presets[0])?.key || null;
}

/**
 * Write each target's register into the config — the object form `languages`
 * already supports ({ "fr": "formal-vous", "es": "neutral-latam" }) — so the
 * choice is visible and editable in the file, not only in init's output
 * (Round 5, i18next persona: init printed "es → neutral-latam" but the config
 * said only ["fr","es"], so a team targeting Spain would not notice the
 * Latin-American default). The values are the presets sync would have used
 * anyway: behaviour does not change, only what the file shows.
 *
 * A list stays a list when no target has presets (nothing to show), and an
 * empty list (auto-detect from the folder) stays empty. Object-form entries
 * keep any register already chosen (the wizard); `{}` becomes the preset, and
 * an entry with other fields (method, script) gets a `register` beside them.
 * `onlyCodes` limits it to some targets — the ones `init --force` adds to an
 * existing file, whose other entries stay exactly as they were.
 *
 * @param {object} config - Mutated
 * @param {Set<string>|null} [onlyCodes]
 * @returns {object} config
 */
function recordRegisters(config, onlyCodes = null) {
  const langs = config.languages;
  const eligible = (code) => !onlyCodes || onlyCodes.has(code);
  if (Array.isArray(langs)) {
    if (langs.length === 0 || !langs.some(code => eligible(code) && defaultRegisterKey(code))) return config;
    const obj = {};
    for (const code of langs) obj[code] = (eligible(code) && defaultRegisterKey(code)) || {};
    config.languages = obj;
    return config;
  }
  if (langs && typeof langs === 'object') {
    for (const [code, value] of Object.entries(langs)) {
      if (!eligible(code)) continue;
      if (!value || typeof value !== 'object' || value.register) continue;
      const preset = defaultRegisterKey(code);
      if (!preset) continue;
      if (Object.keys(value).length === 0) langs[code] = preset;
      else value.register = preset;
    }
  }
  return config;
}

/** Where the CLI's license text is published (also LICENSE in the npm package). */
const LICENSE_URL = 'https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE';

/**
 * The one plain-language page on who each package's license covers
 * (cli/website/docs/getting-started/who-may-use-this.md) — the shop, clinic
 * and Django-clinic personas could not tell from "noncommercial" alone
 * whether they were covered (every round through Round 14).
 */
const WHO_MAY_USE_URL = 'https://champollion.dev/docs/getting-started/who-may-use-this';

/**
 * The license lines init prints once, on a fresh project: nothing on the setup
 * path said the CLI is noncommercial (Round 5, Next.js persona — a store's
 * codebase). The license id is read from package.json (the SSOT); the plain
 * words are only said for the license they describe.
 *
 * @returns {string}
 */
function licenseLine() {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
  if (pkg.license === 'PolyForm-Noncommercial-1.0.0') {
    return 'License: PolyForm Noncommercial 1.0.0 — free for noncommercial use; using it for a commercial purpose '
      + 'is not covered by this license.\n'
      + `  Who may use it (a school, a public hospital or clinic, a charity, a personal project — not a business's product): ${WHO_MAY_USE_URL}\n`
      + `  The license text governs: ${LICENSE_URL}`;
  }
  return `License: ${pkg.license} — see LICENSE in the champollion package (${LICENSE_URL}). Who may use it: ${WHO_MAY_USE_URL}`;
}

/**
 * A Django project (manage.py, as lib/locale-layout.js detectGettextLayout
 * tells Django apart) with a locale/ folder at its root — the folder Django
 * loads only when LOCALE_PATHS names it.
 */
function isDjangoRootLocale(cwd) {
  try {
    return fs.statSync(path.join(cwd, 'manage.py')).isFile()
      && fs.statSync(path.join(cwd, 'locale')).isDirectory();
  } catch {
    return false;
  }
}

/** .gitignore lines that already keep `.champollion/` out of git. */
const CACHE_IGNORE_LINES = new Set([
  '.champollion', '.champollion/', '/.champollion', '/.champollion/',
  '.champollion/*', '/.champollion/*', '.champollion/**', '/.champollion/**',
]);

/**
 * Keep the translation cache out of version control. `.champollion/` holds the
 * per-machine Translation Memory; the CI guide's `git add --all` would commit
 * it in a repo that does not ignore it. The lock files stay tracked (they are
 * how the next run knows what changed).
 *
 * ALWAYS, not only in a git repo. It used to skip a folder with no `.git` —
 * and a project that ran `git init` after `champollion init` (or lives in a
 * subfolder of a repo) then committed the cache with its first
 * `git add --all` (synthetic Django/i18next personas, 2026-10). A .gitignore
 * in a folder that is not (yet) a repo costs nothing. Idempotent: never
 * duplicates a line that already covers the folder.
 */
function ensureCacheIgnored(cwd) {
  const gitignore = path.join(cwd, '.gitignore');
  const exists = fs.existsSync(gitignore);
  const current = exists ? fs.readFileSync(gitignore, 'utf-8') : '';
  const covered = current.split(/\r?\n/).map((l) => l.trim()).some((l) => CACHE_IGNORE_LINES.has(l));
  if (covered) return;
  const lead = current && !current.endsWith('\n') ? '\n' : '';
  const gap = current ? '\n' : '';
  fs.writeFileSync(gitignore,
    `${current}${lead}${gap}# champollion: per-machine translation cache (commit the .champollion*.lock files)\n.champollion/\n`,
    'utf-8');
  output.ok(`${exists ? 'Added .champollion/ to' : 'Created'} .gitignore `
    + `(${exists ? '' : 'ignoring .champollion/: '}the translation cache is per-machine; the lock files stay tracked)`);
}

export {
  run, parseLanguageInput, buildDefaultConfig, buildConfig,
  detectLocaleSetup, describeLocaleSetupHint, FRAMEWORK_LAYOUTS, GENERIC_LOCALE_DIRS,
  mergeWizardConfig, describeConfigChanges,
};
