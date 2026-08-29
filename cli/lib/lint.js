/**
 * i18n Coverage Linter — detects hardcoded strings that bypass i18n.
 * Zero external dependencies. All regex-based.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from './config.js';
import { flattenKeys } from './flatten.js';
import { readLocaleFile, detectFormatFromDir, getExtension } from './format.js';
import { isNonTranslatableString, isNonTranslatableLintExtended } from './string-classify.js';
import { output } from './output.js';

// -----------------------------------------------------------------
// Framework definitions
// -----------------------------------------------------------------

const FRAMEWORKS = {
  'next-intl': {
    name: 'next-intl',
    srcDirs: ['src', 'app', 'pages', 'components'],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    i18nCallPatterns: [
      /\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /useTranslations\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    ],
    frameworkImport: /from\s+['"]next-intl['"]/,
    translatableAttrs: ['placeholder', 'aria-label', 'alt', 'title', 'content', 'label'],
  },
  'react-i18next': {
    name: 'react-i18next',
    srcDirs: ['src', 'app', 'pages', 'components'],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    i18nCallPatterns: [
      /\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /i18nKey\s*=\s*['"`]([^'"`]+)['"`]/g,
    ],
    frameworkImport: /from\s+['"]react-i18next['"]/,
    translatableAttrs: ['placeholder', 'aria-label', 'alt', 'title', 'content', 'label'],
  },
  'vue-i18n': {
    name: 'vue-i18n',
    srcDirs: ['src', 'app', 'pages', 'components'],
    extensions: ['.vue', '.js', '.ts'],
    i18nCallPatterns: [
      /\$t\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /keypath\s*=\s*['"`]([^'"`]+)['"`]/g,
    ],
    frameworkImport: /from\s+['"]vue-i18n['"]/,
    translatableAttrs: ['placeholder', 'aria-label', 'alt', 'title', 'content', 'label'],
  },
  hugo: {
    name: 'Hugo',
    srcDirs: ['layouts', 'themes'],
    extensions: ['.html'],
    i18nCallPatterns: [
      /\{\{\s*(?:i18n|T)\s+['"`]([^'"`]+)['"`]/g,
    ],
    frameworkImport: null,
    translatableAttrs: ['alt', 'title', 'placeholder', 'aria-label', 'content'],
  },
};

// Default generic framework for unknown projects
const GENERIC_FRAMEWORK = {
  name: 'generic',
  srcDirs: ['src', 'app', 'pages', 'components'],
  extensions: ['.tsx', '.jsx', '.ts', '.js', '.vue', '.html'],
  i18nCallPatterns: [/\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g],
  frameworkImport: null,
  translatableAttrs: ['placeholder', 'aria-label', 'alt', 'title', 'content', 'label'],
};

// -----------------------------------------------------------------
// Framework detection
// -----------------------------------------------------------------

/**
 * Detect the i18n framework used in the project.
 *
 * Checks for Hugo config files, then falls back to package.json dependencies.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ name: string, extensions: string[], srcDirs: string[], i18nCallPatterns: RegExp[], frameworkImport: RegExp|null }} Framework detection result
 */
function detectFramework(cwd) {
  // Check for Hugo config files first
  const hugoConfigs = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'config.toml', 'config.yaml'];
  for (const cfg of hugoConfigs) {
    if (fs.existsSync(path.join(cwd, cfg))) return FRAMEWORKS.hugo;
  }

  // Check package.json dependencies
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['next-intl']) return FRAMEWORKS['next-intl'];
      if (allDeps['react-i18next'] || allDeps['i18next']) return FRAMEWORKS['react-i18next'];
      if (allDeps['vue-i18n']) return FRAMEWORKS['vue-i18n'];
    } catch (_) { /* ignore parse errors */ }
  }

  return GENERIC_FRAMEWORK;
}

// -----------------------------------------------------------------
// File walking
// -----------------------------------------------------------------

/**
 * Recursively walk a directory and collect files matching extensions.
 *
 * @param {string} dir - Absolute path to directory
 * @param {string[]} extensions - File extensions to include (e.g., ['.tsx', '.jsx'])
 * @param {string[]} ignore - Directory/file names to skip
 * @returns {string[]} Array of absolute file paths
 */
function walkDir(dir, extensions, ignore) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignore.some(ig => entry.name === ig)) continue;

    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, extensions, ignore));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// -----------------------------------------------------------------
// String analysis utilities
// -----------------------------------------------------------------

/**
 * Determine if a string should be flagged as hardcoded user-facing content.
 * Returns false for strings that look like code, URLs, identifiers, etc.
 *
 * @param {string} text - The string to evaluate
 * @param {number} minLength - Minimum length threshold
 * @returns {boolean} true if the string should be flagged for i18n wrapping
 */
function shouldFlagString(text, minLength) {
  // Shared core: checks common to both lint and autofix
  // (identifiers, numbers, URLs, hex colors, template expressions, etc.)
  if (isNonTranslatableString(text, minLength)) return false;

  // Lint-specific extensions: file paths, emails, HTML entities,
  // short HTML tags, and TypeScript type signatures.
  // These appear in source code scanning but not in autofix's JSX context.
  if (isNonTranslatableLintExtended(text)) return false;

  return true;
}

// -----------------------------------------------------------------
// Source file scanning
// -----------------------------------------------------------------

/**
 * Extract all i18n key references from file content.
 * Returns a Set of key strings found via t('key'), {{ i18n "key" }}, etc.
 *
 * @param {string} content - File content to scan
 * @param {{ i18nCallPatterns: RegExp[] }} framework - Framework with i18n call patterns
 * @returns {Set<string>} Set of referenced i18n key strings
 */
function extractI18nCalls(content, framework) {
  const keys = new Set();
  for (const pattern of framework.i18nCallPatterns) {
    // Reset lastIndex for each pattern (they have /g flag)
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/**
 * Extract hardcoded user-facing strings from a JSX/TSX/HTML file.
 *
 * @param {string} content - File content to scan
 * @param {string} filePath - File path (for context in results)
 * @param {{ name: string, i18nCallPatterns: RegExp[] }} framework - Detected framework
 * @param {number} minLength - Minimum string length to flag
 * @returns {Array<{ line: number, text: string, context: string }>} Array of hardcoded string hits
 */
function extractHardcodedStrings(content, filePath, framework, minLength) {
  const results = [];
  const lines = content.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comments
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }

    // Skip non-content lines
    if (trimmed.startsWith('//')) continue;
    if (/^\s*import\s/.test(trimmed)) continue;
    if (/^\s*(?:export\s+)?(?:type|interface|enum)\s/.test(trimmed)) continue;
    if (/^\s*console\.\w+\(/.test(trimmed)) continue;
    if (/^\s*(?:const|let|var)\s+\w+\s*=\s*['"`]/.test(trimmed)) continue;

    // Skip TypeScript-heavy lines (type annotations, function signatures, generics)
    // Lines that are purely function/type signatures: "): Promise<Response> {" etc.
    if (/^\s*[})\]]\s*[:,]\s*\w/.test(trimmed)) continue;
    // Lines with type assertions or generic declarations
    if (/^\s*(?:export\s+)?(?:function|async\s+function|const)\s+\w+.*:\s*\w+/.test(trimmed) && !trimmed.includes('>') && !trimmed.includes('"')) continue;

    // Skip lines that are purely JSX expressions or logic
    if (/^\s*\{.*\}\s*$/.test(trimmed) && !trimmed.includes('>')) continue;
    if (/^\s*(?:return|if|else|switch|case|for|while)\b/.test(trimmed) && !trimmed.includes('>')) continue;

    // --- Extract JSX text content: >text here< ---
    const textPattern = />([^<>{]+)</g;
    let match;
    while ((match = textPattern.exec(line)) !== null) {
      const text = match[1].trim();
      if (shouldFlagString(text, minLength)) {
        results.push({ line: i + 1, text, context: 'jsx-text' });
      }
    }

    // --- Extract translatable attribute values: attr="value" ---
    // Only flag string literals, not JSX expressions (attr={...})
    for (const attr of framework.translatableAttrs) {
      // Double-quoted
      const dq = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'g');
      while ((match = dq.exec(line)) !== null) {
        const text = match[1].trim();
        if (shouldFlagString(text, minLength)) {
          results.push({ line: i + 1, text, context: `attr:${attr}` });
        }
      }
      // Single-quoted
      const sq = new RegExp(`${attr}\\s*=\\s*'([^']*)'`, 'g');
      while ((match = sq.exec(line)) !== null) {
        const text = match[1].trim();
        if (shouldFlagString(text, minLength)) {
          results.push({ line: i + 1, text, context: `attr:${attr}` });
        }
      }
    }
  }

  return results;
}

/**
 * Check if files that should have i18n imports are missing them.
 *
 * @param {string[]} files - Array of absolute file paths to check
 * @param {{ frameworkImport: RegExp|null, extensions: string[] }} framework - Detected framework
 * @param {number} minLength - Minimum string length threshold
 * @returns {string[]} Array of file paths with user-facing content but no framework import
 */
function checkFrameworkWiring(files, framework, minLength) {
  if (!framework.frameworkImport) return [];

  const unwired = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Does the file have any user-facing content?
    const hardcoded = extractHardcodedStrings(content, filePath, framework, minLength);
    if (hardcoded.length === 0) continue;
    // Does it import the i18n framework?
    if (!framework.frameworkImport.test(content)) {
      unwired.push(filePath);
    }
  }
  return unwired;
}

// -----------------------------------------------------------------
// Cross-referencing
// -----------------------------------------------------------------

/**
 * Find locale keys that are never referenced in source code.
 *
 * @param {Set<string>} allI18nKeys - All i18n key references found in source files
 * @param {Object<string, string>} localeKeys - Flattened locale key-value map
 * @returns {string[]} Array of unreferenced key names
 */
function findDeadKeys(allI18nKeys, localeKeys) {
  return Object.keys(localeKeys).filter(k => {
    if (allI18nKeys.has(k)) return false;
    // Check namespace.key pattern: t('title') matches 'hero.title'
    for (const ref of allI18nKeys) {
      if (k.endsWith('.' + ref)) return false;
    }
    return true;
  });
}

/**
 * Try to find a matching locale key for a hardcoded string value.
 * Compares normalized strings against locale values.
 *
 * @param {string} text - The hardcoded string to match
 * @param {Array<[string, unknown]>} localeEntries - Entries from flattened locale object
 * @returns {{ key: string, confidence: 'exact'|'partial' }|null} Match result, or null if no match
 */
function findFuzzyMatch(text, localeEntries) {
  const norm = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (norm.length < 3) return null;

  for (const [key, value] of localeEntries) {
    if (typeof value !== 'string') continue;
    const normVal = value.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (norm === normVal) return { key, confidence: 'exact' };
  }

  // Partial match for longer strings
  for (const [key, value] of localeEntries) {
    if (typeof value !== 'string') continue;
    const normVal = value.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (norm.length > 10 && normVal.includes(norm)) return { key, confidence: 'partial' };
  }

  return null;
}

// -----------------------------------------------------------------
// Report generation
// -----------------------------------------------------------------

/**
 * Generate a human-readable lint coverage report and print to stdout.
 *
 * @param {{ framework: object, hardcoded: Array, deadKeys: string[], unwiredFiles: string[], localeKeyCount: number, i18nCallCount: number, fileCount: number, coverage: number }} results - Aggregated lint results
 */
function generateReport(results) {
  const { framework, hardcoded, deadKeys, unwiredFiles, localeKeyCount,
    i18nCallCount, fileCount, coverage } = results;

  const lines = [];
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  champollion lint — Coverage Report');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`  Framework: ${framework.name} (auto-detected)`);
  lines.push(`  Source locale: ${localeKeyCount} keys`);
  lines.push(`  Files scanned: ${fileCount}`);
  lines.push('');

  // Framework wiring warnings
  if (unwiredFiles.length > 0) {
    lines.push('  [WARN] FRAMEWORK SETUP');
    lines.push(`  └── ${framework.name} detected but ${unwiredFiles.length} file(s) have content without i18n import:`);
    for (const f of unwiredFiles.slice(0, 10)) {
      lines.push(`      ${f}`);
    }
    if (unwiredFiles.length > 10) lines.push(`      ... and ${unwiredFiles.length - 10} more`);
    lines.push('');
  }

  // Hardcoded strings
  if (hardcoded.length > 0) {
    lines.push(`  HARDCODED STRINGS (${hardcoded.length} found)`);
    lines.push('');

    // Group by file
    const byFile = {};
    for (const item of hardcoded) {
      const key = item.file;
      if (!byFile[key]) byFile[key] = [];
      byFile[key].push(item);
    }

    for (const [file, items] of Object.entries(byFile)) {
      lines.push(`  ${file}`);
      for (const item of items.slice(0, 15)) {
        const truncated = item.text.length > 60
          ? item.text.slice(0, 57) + '...'
          : item.text;
        lines.push(`  ├── L${item.line}: "${truncated}"`);
        if (item.suggestedKey) {
          lines.push(`  │   Match: ${item.suggestedKey}`);
        }
      }
      if (items.length > 15) {
        lines.push(`  └── ... and ${items.length - 15} more in this file`);
      }
      lines.push('');
    }
  }

  // Dead keys
  if (deadKeys.length > 0) {
    lines.push(`  [WARN] DEAD KEYS (${deadKeys.length} unreferenced)`);
    lines.push('  └── Keys in source locale not used by any source file:');
    for (const key of deadKeys.slice(0, 15)) {
      lines.push(`      ${key}`);
    }
    if (deadKeys.length > 15) lines.push(`      ... and ${deadKeys.length - 15} more`);
    lines.push('');
  }

  // Coverage
  const total = i18nCallCount + hardcoded.length;
  lines.push('  COVERAGE');
  lines.push(`  ├── i18n calls found: ${i18nCallCount}`);
  lines.push(`  ├── Hardcoded strings: ${hardcoded.length}`);
  lines.push(`  ├── Coverage: ${coverage}% (${i18nCallCount} / ${total})`);
  lines.push(`  └── Dead keys: ${deadKeys.length} / ${localeKeyCount}`);
  lines.push('');

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (hardcoded.length > 0) {
    lines.push(`  Result: FAIL — ${hardcoded.length} hardcoded string(s) detected`);
    lines.push('  Run with --warn-only to suppress exit code');
  } else {
    lines.push('  Result: PASS — all user-facing strings use i18n');
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  output.raw(lines.join('\n'));
}

// -----------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------

/**
 * Load ignore patterns from .champollionignore file.
 * Format: one pattern per line, # comments, blank lines ignored.
 * Patterns are directory/file basenames or globs matched against paths.
 *
 * @param {string} cwd - Project root directory
 * @returns {string[]} Array of ignore patterns
 */
function loadIgnorePatterns(cwd) {
  const ignorePath = path.join(cwd, '.champollionignore');
  if (!fs.existsSync(ignorePath)) return [];

  return fs.readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * Run the lint pipeline: detect framework, scan files, cross-reference, report.
 *
 * @param {{ cwd?: string, cliArgs?: import('./types.js').CLIArgs, warnOnly?: boolean }} [options] - Lint options
 * @returns {Promise<number>} Exit code (0 = clean, 1 = issues found)
 */
async function runLint(options = {}) {
  const { cwd = process.cwd(), cliArgs = {}, warnOnly = false } = options;
  const config = resolveConfig(cliArgs, cwd);
  const lintConfig = config.lint || {};

  const minLength = parseInt(cliArgs['min-length'] || lintConfig.minLength || 2, 10);
  const defaultIgnore = [
    'node_modules', '.next', 'dist', 'build', '.git', 'public', '.vercel',
    '__tests__', 'test', 'tests', 'coverage', '.turbo',
  ];

  // Merge: config ignore + .champollionignore file + CLI --ignore
  const fileIgnore = loadIgnorePatterns(cwd);
  const configIgnore = lintConfig.ignore || [];
  const cliIgnore = cliArgs.ignore ? cliArgs.ignore.split(',').map(s => s.trim()) : [];
  const ignorePatterns = [...new Set([...defaultIgnore, ...configIgnore, ...fileIgnore, ...cliIgnore])];

  // 1. Detect framework
  const framework = detectFramework(cwd);
  output.info(`Detected framework: ${framework.name}`);

  // 2. Find source files
  const srcDir = cliArgs.src || lintConfig.srcDir || null;
  let sourceFiles = [];

  if (srcDir) {
    // Explicit src dir
    sourceFiles = walkDir(path.resolve(cwd, srcDir), framework.extensions, ignorePatterns);
  } else {
    // Auto-detect from framework src dirs
    for (const dir of framework.srcDirs) {
      const resolved = path.resolve(cwd, dir);
      sourceFiles.push(...walkDir(resolved, framework.extensions, ignorePatterns));
    }
  }

  if (sourceFiles.length === 0) {
    if (cliArgs.json) {
      console.log(JSON.stringify({
        command: 'lint',
        framework: framework.name,
        filesScanned: 0,
        findings: [],
        count: 0,
      }, null, 2));
      return 0;
    }
    output.info('No source files found to lint.');
    return 0;
  }

  output.info(`Scanning ${sourceFiles.length} file(s)...`);

  // 3. Load locale keys for cross-referencing
  const format = config.format !== 'auto'
    ? config.format
    : detectFormatFromDir(config.localesDir);
  const ext = getExtension(format);
  const sourcePath = path.join(config.localesDir, `${config.inputLocale}${ext}`);

  let localeKeys = {};
  if (fs.existsSync(sourcePath)) {
    const raw = readLocaleFile(sourcePath, format);
    localeKeys = format === 'json' ? flattenKeys(raw) : raw;
  }
  const localeEntries = Object.entries(localeKeys);

  // 4. Scan all source files
  const allI18nKeys = new Set();
  const allHardcoded = [];
  let totalI18nCalls = 0;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(cwd, filePath);

    // Extract i18n calls
    const i18nKeys = extractI18nCalls(content, framework);
    for (const key of i18nKeys) allI18nKeys.add(key);
    totalI18nCalls += i18nKeys.size;

    // Extract hardcoded strings
    const hardcoded = extractHardcodedStrings(content, filePath, framework, minLength);
    for (const item of hardcoded) {
      item.file = relPath;
      // Try to find a matching locale key
      const match = findFuzzyMatch(item.text, localeEntries);
      if (match) item.suggestedKey = match.key;
      allHardcoded.push(item);
    }
  }

  // 5. Cross-reference
  const deadKeys = localeEntries.length > 0
    ? findDeadKeys(allI18nKeys, localeKeys)
    : [];

  // 6. Check framework wiring
  const unwiredFiles = checkFrameworkWiring(sourceFiles, framework, minLength)
    .map(f => path.relative(cwd, f));

  // 7. Calculate coverage
  const total = totalI18nCalls + allHardcoded.length;
  const coverage = total > 0 ? Math.round((totalI18nCalls / total) * 100) : 100;

  // 8. Generate report — single JSON document in --json mode (the human
  //    report stays the default), collected instead of print-only.
  if (cliArgs.json) {
    console.log(JSON.stringify({
      command: 'lint',
      framework: framework.name,
      filesScanned: sourceFiles.length,
      localeKeys: Object.keys(localeKeys).length,
      i18nCalls: totalI18nCalls,
      coverage,
      findings: allHardcoded.map(item => ({
        file: item.file,
        line: item.line,
        text: item.text,
        context: item.context,
        suggestedKey: item.suggestedKey || null,
      })),
      count: allHardcoded.length,
      deadKeys,
      unwiredFiles,
      warnOnly,
    }, null, 2));
  } else {
    generateReport({
      framework,
      hardcoded: allHardcoded,
      deadKeys,
      unwiredFiles,
      localeKeyCount: Object.keys(localeKeys).length,
      i18nCallCount: totalI18nCalls,
      fileCount: sourceFiles.length,
      coverage,
    });
  }

  // 9. Return exit code
  if (allHardcoded.length > 0 && !warnOnly) return 1;
  return 0;
}

export {
  runLint,
  detectFramework,
  extractI18nCalls,
  extractHardcodedStrings,
  shouldFlagString,
  findDeadKeys,
  findFuzzyMatch,
  walkDir,
  checkFrameworkWiring,
  loadIgnorePatterns,
  FRAMEWORKS,
  GENERIC_FRAMEWORK,
};
