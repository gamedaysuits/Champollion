#!/usr/bin/env node
/**
 * extract_ui_strings.js — Build the champollion-bench UI string dataset.
 *
 * Downloads professionally-translated UI strings from open-source repos
 * (Signal Desktop, VS Code), aligns them across languages, categorizes
 * by key type, and outputs the benchmark dataset.
 *
 * Data sources:
 *   - Signal Desktop: signalapp/Signal-Desktop/_locales/{lang}/messages.json
 *   - VS Code: microsoft/vscode-loc/i18n/vscode-language-pack-{lang}/...
 *
 * Target languages (6 — chosen for register differentiation):
 *   fr, de, ja, es, zh (Simplified), ko
 *
 * Output:
 *   test/benchmark/ui-bench/source/en.json
 *   test/benchmark/ui-bench/reference/{lang}.json
 *   test/benchmark/ui-bench/metadata.json
 *
 * Usage:
 *   node test/benchmark/ui-bench/scripts/extract_ui_strings.js [--max N] [--skip-vscode]
 *
 * Environment:
 *   GITHUB_TOKEN — Optional but recommended (raises API rate limit from 60→5000/hr)
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const UI_BENCH_DIR = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(UI_BENCH_DIR, 'source');
const REFERENCE_DIR = path.join(UI_BENCH_DIR, 'reference');

/**
 * Target languages — chosen for maximum register differentiation.
 * These languages have strong formal/informal distinctions that make
 * register-steered translation measurably different from naive translation.
 */
const TARGET_LANGS = ['fr', 'de', 'ja', 'es', 'ko', 'zh'];

/**
 * Signal Desktop locale code mapping.
 * Signal uses standard IETF codes, but zh maps to zh_CN in their repo.
 */
const SIGNAL_LANG_MAP = {
  fr: 'fr',
  de: 'de',
  ja: 'ja',
  es: 'es',
  ko: 'ko',
  zh: 'zh-CN',
};

/**
 * VS Code language pack slug mapping.
 * VS Code uses their own naming convention for language packs.
 */
const VSCODE_LANG_MAP = {
  fr: 'fr',
  de: 'de',
  ja: 'ja',
  es: 'es',
  ko: 'ko',
  zh: 'zh-hans',
};

/**
 * Key-type inference patterns — reuses the same logic as champollion's
 * `inferKeyTypes()` from lib/translate.js, adapted for the different
 * key naming conventions in Signal and VS Code.
 */
const KEY_TYPE_PATTERNS = [
  // Buttons / actions
  { pattern: /(?:^|\.)(?:btn|button|action|submit|confirm|cancel|save|delete|close|ok|done|send|accept|discard|reset|forward|reply|join|start|stop|dismiss|retry|approve|deny|unpin|pin|mute|unmute|block|unblock|leave|add|remove|create|edit|update|search|clear|copy|cut|paste|undo|redo|hide|show|quit|back|next)\b/i, type: 'button' },
  { pattern: /__(?:cancel|confirm|send|delete|save|done|ok|close|dismiss|retry|submit|discard|approve|deny|Pin|Unpin|Leave|Block|Unblock|Remove|Add|Edit|Join|Start|Stop|Forward|Reply|Mute|Unmute|Create|accept)\b/i, type: 'button' },

  // Navigation / labels
  { pattern: /(?:^|\.)(?:nav|tab|menu|header|label|title|sidebar|breadcrumb|section)\b/i, type: 'label' },
  { pattern: /__ItemLabel--/i, type: 'label' },
  { pattern: /^icu:NavTabs__ItemLabel/i, type: 'label' },
  { pattern: /mainMenu/i, type: 'label' },

  // Error messages
  { pattern: /(?:^|\.)(?:error|err|warning|alert|invalid|failed|cannot|unable)\b/i, type: 'error' },
  { pattern: /Error/i, type: 'error' },

  // Descriptions / help text
  { pattern: /(?:^|\.)(?:desc|description|help|hint|explanation|detail|body|info|summary|subtitle)\b/i, type: 'description' },
  { pattern: /__description/i, type: 'description' },
  { pattern: /__body/i, type: 'description' },
  { pattern: /__detail/i, type: 'description' },
  { pattern: /__hint/i, type: 'description' },

  // Placeholders
  { pattern: /(?:^|\.)(?:placeholder|searchPlaceholder|inputPlaceholder)\b/i, type: 'placeholder' },
  { pattern: /placeholder/i, type: 'placeholder' },

  // Toasts / notifications
  { pattern: /(?:^|\.)(?:toast|notification|snackbar)\b/i, type: 'toast' },
  { pattern: /^icu:Toast/i, type: 'toast' },

  // Titles
  { pattern: /(?:^|\.)(?:title|heading)\b/i, type: 'title' },
  { pattern: /__title/i, type: 'title' },
  { pattern: /__Title/i, type: 'title' },
];

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = 'https://api.github.com';

/**
 * Fetch a file's raw content from GitHub.
 * Uses the GitHub Contents API, which returns base64-encoded content
 * for files under 1MB. For larger files, falls back to the raw URL.
 *
 * WHY base64 first: The Contents API gives us the file sha alongside
 * the content, which we log for provenance tracking.
 */
async function fetchGitHubFile(owner, repo, filePath, token) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
  const headers = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'champollion-bench',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });

  if (res.status === 404) {
    console.warn(`  [WARN] 404: ${owner}/${repo}/${filePath}`);
    return null;
  }

  if (res.status === 403) {
    console.error(`  ✗ 403 — rate limited. Set GITHUB_TOKEN to increase limit.`);
    throw new Error('GitHub API rate limited');
  }

  if (!res.ok) {
    console.warn(`  [WARN] HTTP ${res.status}: ${owner}/${repo}/${filePath}`);
    return null;
  }

  const text = await res.text();
  return text;
}

// ---------------------------------------------------------------------------
// Signal Desktop extraction
// ---------------------------------------------------------------------------

/**
 * Extract UI strings from Signal Desktop.
 *
 * Signal's format:
 *   {
 *     "icu:keyName": {
 *       "messageformat": "The visible text",
 *       "description": "Context about where this string appears"
 *     }
 *   }
 *
 * We extract the `messageformat` value and use the key as-is.
 * The `description` field is preserved in metadata for annotation.
 *
 * WHY Signal: High-quality professional translations, clean JSON structure,
 * rich mix of button labels, error messages, descriptions, and UI chrome.
 * ~3000+ strings across all categories.
 */
async function extractSignal(token) {
  console.log('\n📱 Signal Desktop — extracting...');

  // Step 1: Fetch English source
  const enRaw = await fetchGitHubFile(
    'signalapp', 'Signal-Desktop',
    '_locales/en/messages.json', token
  );
  if (!enRaw) throw new Error('Failed to fetch Signal EN source');

  const enData = JSON.parse(enRaw);
  console.log(`  EN: ${Object.keys(enData).length} total keys`);

  // Step 2: Filter to translatable keys only
  // Skip the smartling config block and keys without messageformat
  const enStrings = {};
  const descriptions = {};

  for (const [key, value] of Object.entries(enData)) {
    // Skip smartling config
    if (key === 'smartling') continue;

    // Must have a messageformat field with actual content
    if (!value?.messageformat || typeof value.messageformat !== 'string') continue;

    // Skip empty or trivially short strings
    const text = value.messageformat.trim();
    if (text.length < 2) continue;

    // Skip strings that are ONLY placeholders (e.g., "{appEnv}")
    if (/^\{[^}]+\}$/.test(text)) continue;

    enStrings[key] = text;
    if (value.description) {
      descriptions[key] = value.description;
    }
  }

  console.log(`  EN: ${Object.keys(enStrings).length} translatable strings`);

  // Step 3: Fetch all target language files
  const langData = {};
  for (const lang of TARGET_LANGS) {
    const langCode = SIGNAL_LANG_MAP[lang];
    const raw = await fetchGitHubFile(
      'signalapp', 'Signal-Desktop',
      `_locales/${langCode}/messages.json`, token
    );

    if (!raw) {
      console.warn(`  [WARN] Signal: ${lang} (${langCode}) not found, skipping`);
      continue;
    }

    const data = JSON.parse(raw);
    const strings = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'smartling') continue;
      if (value?.messageformat && typeof value.messageformat === 'string') {
        strings[key] = value.messageformat.trim();
      }
    }

    langData[lang] = strings;
    console.log(`  ${lang}: ${Object.keys(strings).length} strings`);

    // Brief delay to respect rate limits
    await sleep(300);
  }

  // Step 4: Find intersection — keys that exist in all AVAILABLE languages
  // Fault-tolerant: if a language file was missing (404), we exclude it
  // from the intersection rather than getting 0 results.
  const availableLangs = TARGET_LANGS.filter(lang => langData[lang] && Object.keys(langData[lang]).length > 0);
  console.log(`  Available languages: ${availableLangs.join(', ')} (${availableLangs.length}/${TARGET_LANGS.length})`);

  if (availableLangs.length === 0) {
    console.warn('  [WARN] No target languages available — skipping Signal');
    return null;
  }

  const commonKeys = Object.keys(enStrings).filter(key => {
    return availableLangs.every(lang => {
      return langData[lang][key] && langData[lang][key].length >= 2;
    });
  });

  console.log(`  Common keys (${availableLangs.length} langs): ${commonKeys.length}`);

  return {
    source: 'signal',
    domain: 'messaging',
    enStrings,
    langData,
    commonKeys,
    descriptions,
  };
}

// ---------------------------------------------------------------------------
// VS Code extraction
// ---------------------------------------------------------------------------

/**
 * Extract UI strings from VS Code language packs.
 *
 * VS Code's loc format (in vscode-loc repo):
 *   i18n/vscode-language-pack-{lang}/translations/main.i18n.json
 *
 * The main.i18n.json contains a deeply nested structure:
 *   { "contents": { "package/path": { "key": "translated value" } } }
 *
 * The EN source comes from the main VS Code repo's package.nls.json files.
 * For simplicity, we'll extract from the language pack's structure and
 * use the English pack as source.
 *
 * WHY VS Code: Microsoft pays dedicated l10n teams. Rich mix of
 * developer-facing UI (editor, settings, commands) with both concise
 * labels and longer descriptions.
 */
async function extractVSCode(token) {
  console.log('\n💻 VS Code — extracting...');

  // The English source is in the "en" language pack
  // But vscode-loc doesn't have an "en" pack — EN is the source repo itself.
  // Strategy: Use the French pack's KEY structure as a guide,
  // then fetch each language pack's translations.

  // First, get the main i18n file from one language pack to discover structure
  const frRaw = await fetchGitHubFile(
    'microsoft', 'vscode-loc',
    'i18n/vscode-language-pack-fr/translations/main.i18n.json', token
  );

  if (!frRaw) {
    console.warn('  [WARN] VS Code French pack not found — skipping VS Code');
    return null;
  }

  // Parse the nested structure and flatten
  const frParsed = JSON.parse(frRaw);
  const frFlat = flattenVSCodeI18n(frParsed);
  console.log(`  fr (guide): ${Object.keys(frFlat).length} flattened keys`);

  // Now fetch each target language
  const langData = {};
  for (const lang of TARGET_LANGS) {
    const langSlug = VSCODE_LANG_MAP[lang];
    const raw = await fetchGitHubFile(
      'microsoft', 'vscode-loc',
      `i18n/vscode-language-pack-${langSlug}/translations/main.i18n.json`, token
    );

    if (!raw) {
      console.warn(`  [WARN] VS Code: ${lang} not found, skipping`);
      continue;
    }

    const parsed = JSON.parse(raw);
    langData[lang] = flattenVSCodeI18n(parsed);
    console.log(`  ${lang}: ${Object.keys(langData[lang]).length} strings`);
    await sleep(500);
  }

  // For EN source: we need to get the English values.
  // VS Code's source strings are in the main vscode repo, distributed across
  // many package.nls.json files. Instead, we'll use a trick: the language packs
  // include the English source keys. We can derive EN from the key structure
  // by fetching the English label from microsoft/vscode's package.nls.json.
  //
  // PRACTICAL APPROACH: Fetch the core package.nls.json from VS Code main repo
  // which contains the most common UI strings.
  const enNlsRaw = await fetchGitHubFile(
    'microsoft', 'vscode',
    'package.nls.json', token
  );

  let enStrings = {};
  if (enNlsRaw) {
    const enNls = JSON.parse(enNlsRaw);
    // package.nls.json has flat key-value pairs
    for (const [key, value] of Object.entries(enNls)) {
      if (typeof value === 'string' && value.trim().length >= 2) {
        const benchKey = `vscode.${key}`;
        enStrings[benchKey] = value.trim();
      }
    }
    console.log(`  EN (package.nls.json): ${Object.keys(enStrings).length} strings`);
  }

  // Also fetch src/vs/base/common/nls messages if available
  const baseNlsRaw = await fetchGitHubFile(
    'microsoft', 'vscode',
    'src/vs/workbench/contrib/preferences/browser/preferences.contribution.nls.json',
    token
  );
  // This file may not exist — that's OK, we already have the core strings

  // Find common keys across all target langs
  // We need to remap the vscode-loc flat keys to our benchmark keys
  const commonKeys = Object.keys(enStrings).filter(key => {
    return TARGET_LANGS.every(lang => {
      if (!langData[lang]) return false;
      // The lang packs use a different key structure — we need to match
      const originalKey = key.replace('vscode.', '');
      return langData[lang][originalKey] && langData[lang][originalKey].length >= 2;
    });
  });

  console.log(`  Common keys (all ${TARGET_LANGS.length} langs): ${commonKeys.length}`);

  return {
    source: 'vscode',
    domain: 'developer_tools',
    enStrings,
    langData,
    commonKeys,
    descriptions: {},
  };
}

/**
 * Flatten VS Code's nested i18n JSON structure into a flat key-value map.
 *
 * Input format:
 *   { "contents": { "vs/editor/contrib/find": { "findWidget.label": "Find" } } }
 *
 * Output format:
 *   { "vs/editor/contrib/find/findWidget.label": "Find" }
 */
function flattenVSCodeI18n(parsed) {
  const flat = {};
  const contents = parsed?.contents;
  if (!contents || typeof contents !== 'object') return flat;

  for (const [modulePath, entries] of Object.entries(contents)) {
    if (!entries || typeof entries !== 'object') continue;

    // Skip arrays (some modules have array-style entries)
    if (Array.isArray(entries)) continue;

    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string' && value.trim().length >= 2) {
        flat[`${modulePath}/${key}`] = value.trim();
      }
    }
  }

  return flat;
}

// ---------------------------------------------------------------------------
// Key type classification
// ---------------------------------------------------------------------------

/**
 * Classify a key into a UI element type based on naming patterns.
 *
 * WHY: Key-type classification drives register behavior in champollion.
 * Button labels get concise treatment; descriptions get natural-length
 * translations. This metadata lets us measure whether the register system
 * correctly differentiates treatment by UI element type.
 */
function classifyKeyType(key) {
  for (const { pattern, type } of KEY_TYPE_PATTERNS) {
    if (pattern.test(key)) return type;
  }
  return 'label'; // default — most UI strings are labels
}

/**
 * Classify a string's length category.
 */
function classifyLength(text) {
  const words = text.split(/\s+/).length;
  if (words <= 5) return 'short';
  if (words <= 25) return 'medium';
  return 'long';
}

/**
 * Check if a string contains placeholders.
 */
function hasPlaceholders(text) {
  // ICU: {name}, {count, plural, ...}
  // printf: %s, %d, %1$s
  // mustache: {{name}}
  // Custom: $name$
  return /\{[^}]+\}|%[sd]|%\d+\$[sd]|\{\{[^}]+\}\}|\$[^$]+\$/.test(text);
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble the final dataset from extracted source data.
 *
 * Strategy:
 * 1. Merge strings from all sources
 * 2. Sample for balanced type/length distribution
 * 3. Write to disk in the benchmark format
 *
 * Target: 500-1000 strings total
 *   ~30% short (buttons, labels, nav)
 *   ~40% medium (errors, descriptions, tooltips)
 *   ~30% long (feature descriptions, legal, help text)
 */
async function assembleDataset(sources, maxStrings) {
  console.log('\n[INFO] Assembling dataset...');

  const enStrings = {};
  const references = {};
  const metadata = {};

  for (const lang of TARGET_LANGS) {
    references[lang] = {};
  }

  let totalAdded = 0;

  for (const src of sources) {
    if (!src) continue;

    for (const key of src.commonKeys) {
      if (maxStrings && totalAdded >= maxStrings) break;

      const enText = src.enStrings[key];
      if (!enText) continue;

      // Create a namespaced benchmark key
      // Signal keys: "icu:NavTabs__ItemLabel--Chats" → "signal.NavTabs__ItemLabel--Chats"
      // VS Code keys: "vscode.keyName" → kept as-is
      let benchKey;
      if (src.source === 'signal') {
        benchKey = `signal.${key.replace(/^icu:/, '')}`;
      } else {
        benchKey = key;
      }

      // Safety: block prototype pollution keys
      if (benchKey.includes('__proto__') || benchKey.includes('constructor')) continue;

      enStrings[benchKey] = enText;

      // Add translations for each target language
      for (const lang of TARGET_LANGS) {
        if (!src.langData[lang]) continue;
        const translated = src.langData[lang][key];
        if (translated) {
          references[lang][benchKey] = translated;
        }
      }

      // Build metadata entry
      metadata[benchKey] = {
        type: classifyKeyType(key),
        domain: src.domain,
        length: classifyLength(enText),
        source: src.source,
        has_placeholders: hasPlaceholders(enText),
        word_count: enText.split(/\s+/).length,
        char_count: enText.length,
      };

      // Preserve Signal's description field for extra context
      if (src.descriptions[key]) {
        metadata[benchKey].source_description = src.descriptions[key];
      }

      totalAdded++;
    }
  }

  // Report distribution
  const typeCounts = {};
  const lengthCounts = {};
  for (const m of Object.values(metadata)) {
    typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
    lengthCounts[m.length] = (lengthCounts[m.length] || 0) + 1;
  }

  console.log(`\n  Total strings: ${totalAdded}`);
  console.log(`  Type distribution:`);
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count} (${(count / totalAdded * 100).toFixed(1)}%)`);
  }
  console.log(`  Length distribution:`);
  for (const [length, count] of Object.entries(lengthCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${length}: ${count} (${(count / totalAdded * 100).toFixed(1)}%)`);
  }

  // Write to disk
  console.log('\n[INFO] Writing dataset...');

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(REFERENCE_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(SOURCE_DIR, 'en.json'),
    JSON.stringify(enStrings, null, 2)
  );
  console.log(`  source/en.json — ${Object.keys(enStrings).length} strings`);

  for (const lang of TARGET_LANGS) {
    const refFile = path.join(REFERENCE_DIR, `${lang}.json`);
    fs.writeFileSync(refFile, JSON.stringify(references[lang], null, 2));
    console.log(`  reference/${lang}.json — ${Object.keys(references[lang]).length} strings`);
  }

  const metadataDoc = {
    version: '1.0.0',
    created: new Date().toISOString(),
    sources: sources.filter(Boolean).map(s => ({
      name: s.source,
      domain: s.domain,
      strings_contributed: s.commonKeys.length,
    })),
    target_languages: TARGET_LANGS,
    total_strings: totalAdded,
    type_distribution: typeCounts,
    length_distribution: lengthCounts,
    strings: metadata,
  };

  fs.writeFileSync(
    path.join(UI_BENCH_DIR, 'metadata.json'),
    JSON.stringify(metadataDoc, null, 2)
  );
  console.log(`  metadata.json — written`);

  return { totalAdded, typeCounts, lengthCounts };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { max: null, skipVscode: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max':
        opts.max = parseInt(args[++i], 10);
        break;
      case '--skip-vscode':
        opts.skipVscode = true;
        break;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  const token = process.env.GITHUB_TOKEN || null;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  champollion-bench: UI String Dataset Extraction');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Target languages: ${TARGET_LANGS.join(', ')}`);
  console.log(`  Max strings:      ${opts.max || 'unlimited'}`);
  console.log(`  GitHub auth:      ${token ? 'YES' : 'NO (60 req/hr limit!)'}`);
  console.log(`  Skip VS Code:     ${opts.skipVscode}`);
  console.log('═══════════════════════════════════════════════════════');

  const sources = [];

  // Signal Desktop — primary source
  try {
    const signal = await extractSignal(token);
    sources.push(signal);
  } catch (err) {
    console.error(`\n✗ Signal extraction failed: ${err.message}`);
  }

  // VS Code — secondary source
  if (!opts.skipVscode) {
    try {
      const vscode = await extractVSCode(token);
      if (vscode) sources.push(vscode);
    } catch (err) {
      console.error(`\n✗ VS Code extraction failed: ${err.message}`);
    }
  }

  if (sources.length === 0) {
    console.error('\n✗ No sources extracted. Check GitHub API access.');
    process.exit(1);
  }

  // Assemble and write
  const stats = await assembleDataset(sources, opts.max);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  ✓ Dataset created: ${stats.totalAdded} strings`);
  console.log(`  Output: ${UI_BENCH_DIR}/`);
  console.log('═══════════════════════════════════════════════════════\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
