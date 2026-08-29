/**
 * Autofix — the `wrap` command.
 *
 * Scans source files for hardcoded user-facing strings and wraps them
 * in the project's i18n translation function (e.g., t("key")).
 *
 * SIX SAFETY GATES:
 *   1. Git-clean gate — refuses unless `git status --porcelain` is empty
 *   2. Dry-run first — `wrap --dry` shows diffs without writing
 *   3. Atomic backup — .champollion-backup/ before any write
 *   4. Conservative matching — fix obvious cases, flag ambiguous for human review
 *   5. One-undo — `wrap --undo` restores from backup
 *   6. Diff output — prints git-style diff of every change
 *
 * KEY GENERATION:
 *   "Welcome to my portfolio" → t("general.welcome_to_my_portfolio")
 *   "Get in Touch" → t("general.get_in_touch")
 *   Alt text stays in its context: alt="My photo" → alt={t("general.my_photo")}
 *
 * Zero external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { isNonTranslatableString } from './string-classify.js';

// -----------------------------------------------------------------
// Key generation
// -----------------------------------------------------------------

/**
 * Generate a translation key from a hardcoded string.
 *
 * Strategy: prefix with "general." namespace, then snake_case the text.
 * Truncates at 5 words to keep keys manageable.
 *
 * @param {string} text - The hardcoded text
 * @param {string} namespace - Key namespace (default: 'general')
 * @returns {string} Generated key like "general.welcome_to_my"
 */
function generateKey(text, namespace = 'general') {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')    // Remove punctuation
    .trim()
    .split(/\s+/)               // Split on whitespace
    .filter(w => w.length > 0)
    .slice(0, 5);               // Max 5 words

  if (words.length === 0) return null;

  const slug = words.join('_');
  return `${namespace}.${slug}`;
}

// -----------------------------------------------------------------
// Replacement logic
// -----------------------------------------------------------------

/**
 * Generate a replacement for a JSX text node.
 *
 * "Welcome to my portfolio" → {t("general.welcome_to_my_portfolio")}
 *
 * @param {string} original - The original match (e.g., ">Text<")
 * @param {string} text - The extracted text
 * @param {string} key - The generated translation key
 * @param {string} framework - Framework name for t() syntax
 * @returns {string} The replacement string
 */
function replaceJsxText(original, text, key, framework) {
  if (framework === 'Hugo') {
    // >Text< → >{{ i18n "key" }}<
    return original.replace(text, `{{ i18n "${key}" }}`);
  }

  // React/Vue: >Text< → >{t("key")}<
  return original.replace(text, `{t("${key}")}`);
}

/**
 * Generate a replacement for a translatable attribute.
 *
 * placeholder="Search" → placeholder={t("general.search")}
 *
 * @param {string} attr - The attribute name
 * @param {string} value - The current value
 * @param {string} key - The generated translation key
 * @param {string} framework - Framework name
 * @returns {{ from: string, to: string }} Before/after for the replacement
 */
function replaceAttribute(attr, value, key, framework) {
  if (framework === 'Hugo') {
    return {
      from: `${attr}="${value}"`,
      to: `${attr}="{{ i18n "${key}" }}"`,
    };
  }

  return {
    from: `${attr}="${value}"`,
    to: `${attr}={t("${key}")}`,
  };
}

// -----------------------------------------------------------------
// Safety gates
// -----------------------------------------------------------------

/**
 * Gate 1: Check if git working tree is clean.
 *
 * @param {string} cwd - Working directory
 * @returns {{ clean: boolean, status: string }}
 */
function checkGitClean(cwd) {
  try {
    const status = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    return { clean: status.length === 0, status };
  } catch (_) {
    // Not a git repo — allow but warn
    return { clean: true, status: '(not a git repository)' };
  }
}

/**
 * Gate 3: Create a backup of files before modification.
 *
 * @param {string[]} filePaths - Absolute paths to back up
 * @param {string} cwd - Working directory
 * @returns {string} Backup directory path
 */
function createBackup(filePaths, cwd) {
  const backupDir = path.join(cwd, '.champollion-backup');
  fs.mkdirSync(backupDir, { recursive: true });

  for (const filePath of filePaths) {
    const relPath = path.relative(cwd, filePath);
    const backupPath = path.join(backupDir, relPath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(filePath, backupPath);
  }

  return backupDir;
}

/**
 * Gate 5: Restore files from backup.
 *
 * @param {string} cwd - Working directory
 * @returns {{ restored: number, errors: string[] }}
 */
function restoreFromBackup(cwd) {
  const backupDir = path.join(cwd, '.champollion-backup');
  if (!fs.existsSync(backupDir)) {
    return { restored: 0, errors: ['No backup found at .champollion-backup/'] };
  }

  const errors = [];
  let restored = 0;

  function walkRestore(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkRestore(fullPath);
      } else {
        const relPath = path.relative(backupDir, fullPath);
        const targetPath = path.join(cwd, relPath);
        try {
          fs.copyFileSync(fullPath, targetPath);
          restored++;
        } catch (err) {
          errors.push(`Failed to restore ${relPath}: ${err.message}`);
        }
      }
    }
  }

  walkRestore(backupDir);
  return { restored, errors };
}

// -----------------------------------------------------------------
// Diff generation
// -----------------------------------------------------------------

/**
 * Gate 6: Generate a simple text diff between original and modified content.
 *
 * This is a positional diff (compare lines by index), not a true
 * diff (LCS/Myers). Works correctly for autofix because all
 * replacements are in-place string swaps that preserve line count.
 * Would produce misleading output for insertions/deletions — but
 * autofix never inserts or deletes lines.
 *
 * @param {string} original - Original file content
 * @param {string} modified - Modified file content
 * @param {string} filePath - File path for the header
 * @returns {string} Diff output
 */
function generateDiff(original, modified, filePath) {
  if (original === modified) return '';

  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const lines = [];

  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  for (let i = 0; i < Math.max(origLines.length, modLines.length); i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];

    if (origLine !== modLine) {
      if (origLine !== undefined) lines.push(`- ${origLine}`);
      if (modLine !== undefined) lines.push(`+ ${modLine}`);
    }
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------
// Main autofix runner
// -----------------------------------------------------------------

/**
 * Process a single source file for hardcoded strings.
 *
 * @param {string} content - File content
 * @param {string} frameworkName - Framework name
 * @param {object} framework - Framework config (from lint.js)
 * @param {number} minLength - Minimum string length
 * @param {object} existingKeys - Already-existing locale keys (for dedup)
 * @returns {{ modified: string, fixes: object[], ambiguous: object[] }}
 */
function processFile(content, frameworkName, framework, minLength, existingKeys = {}) {
  const fixes = [];      // Applied fixes
  const ambiguous = [];  // Flagged for human review
  let modified = content;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip non-content lines (same logic as lint.js)
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    if (/^\s*import\s/.test(trimmed)) continue;
    if (/^\s*(?:export\s+)?(?:type|interface|enum)\s/.test(trimmed)) continue;
    if (/^\s*console\.\w+\(/.test(trimmed)) continue;

    // Check for JSX text nodes: >text here<
    const textPattern = />([^<>{]+)</g;
    let match;
    while ((match = textPattern.exec(line)) !== null) {
      const text = match[1].trim();
      if (text.length < minLength) continue;
      if (!shouldFixText(text)) continue;

      const key = generateKey(text);
      if (!key) continue;

      // Gate 4: Conservative — skip ambiguous cases
      if (isAmbiguous(text, line)) {
        ambiguous.push({ line: i + 1, text, reason: 'Complex context — review manually' });
        continue;
      }

      const fullMatch = match[0]; // >Text<
      const replacement = replaceJsxText(fullMatch, text, key, frameworkName);
      modified = modified.replace(fullMatch, replacement);
      fixes.push({ line: i + 1, text, key, type: 'jsx-text' });
    }

    // Check for translatable attributes
    for (const attr of (framework.translatableAttrs || [])) {
      const attrPattern = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'g');
      while ((match = attrPattern.exec(line)) !== null) {
        const value = match[1].trim();
        if (value.length < minLength) continue;
        if (!shouldFixText(value)) continue;

        const key = generateKey(value);
        if (!key) continue;

        const { from, to } = replaceAttribute(attr, match[1], key, frameworkName);
        modified = modified.replace(from, to);
        fixes.push({ line: i + 1, text: value, key, type: `attr:${attr}` });
      }
    }
  }

  return { modified, fixes, ambiguous };
}

/**
 * Check if a text string is a good candidate for auto-fix.
 *
 * Conservative: only fix obvious user-facing strings.
 *
 * @param {string} text - The string to evaluate
 * @returns {boolean} true if the string should be wrapped in t()
 */
function shouldFixText(text) {
  // Delegate to the shared core — same heuristics used by lint.js's
  // shouldFlagString, but without the lint-specific extensions
  // (file paths, emails, HTML entities, TypeScript types).
  // Autofix is more conservative: it only wraps obvious user-facing text.
  return !isNonTranslatableString(text, 2);
}

/**
 * Gate 4: Determine if a string is too ambiguous for auto-fix.
 *
 * Ambiguous cases are flagged for human review rather than auto-fixed.
 *
 * @param {string} text - The extracted string
 * @param {string} lineContext - The full line of source code for context
 * @returns {boolean} true if the string is too ambiguous to auto-fix
 */
function isAmbiguous(text, lineContext) {
  // String contains template expressions mixed with text
  if (/\{[^}]+\}/.test(text) && /\w{3,}/.test(text)) return true;
  // String contains HTML entities
  if (/&\w+;/.test(text)) return true;
  // String is inside a ternary or conditional
  if (/\?\s*['"`]/.test(lineContext) || /:\s*['"`]/.test(lineContext)) return true;
  // Very short (1-2 words) — might be an intentional label
  if (text.split(/\s+/).length <= 1 && text.length < 8) return true;

  return false;
}

/**
 * Add generated keys to locale files.
 *
 * @param {object[]} fixes - Array of { key, text } from processFile
 * @param {string} localesDir - Path to locale files directory
 * @param {string} sourceLocale - Source locale code (e.g., 'en')
 * @param {string[]} targetLocales - Target locale codes
 */
function addKeysToLocales(fixes, localesDir, sourceLocale, targetLocales) {
  if (fixes.length === 0) return;

  // Build key-value map from fixes
  const newKeys = {};
  for (const fix of fixes) {
    // Expand dot-notation key into nested object
    const parts = fix.key.split('.');
    let current = newKeys;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = fix.text;
  }

  // Update source locale file
  const sourcePath = path.join(localesDir, `${sourceLocale}.json`);
  if (fs.existsSync(sourcePath)) {
    const existing = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
    const merged = deepMerge(existing, newKeys);
    fs.writeFileSync(sourcePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  }

  // Add placeholder entries to target locale files
  for (const locale of targetLocales) {
    const targetPath = path.join(localesDir, `${locale}.json`);
    if (fs.existsSync(targetPath)) {
      const existing = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      // Use [EN] prefix for target locales as untranslated markers
      const placeholders = {};
      for (const fix of fixes) {
        const parts = fix.key.split('.');
        let current = placeholders;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = `[EN] ${fix.text}`;
      }
      const merged = deepMerge(existing, placeholders);
      fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    }
  }
}

/**
 * Deep merge two objects (source into target), without overwriting existing keys.
 *
 * @param {object} target - Base object
 * @param {object} source - Object to merge in (new keys only)
 * @returns {object} New merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else if (!(key in result)) {
      // Only add new keys, don't overwrite existing
      result[key] = value;
    }
  }
  return result;
}

export {
  generateKey,
  replaceJsxText,
  replaceAttribute,
  checkGitClean,
  createBackup,
  restoreFromBackup,
  generateDiff,
  processFile,
  shouldFixText,
  isAmbiguous,
  addKeysToLocales,
  deepMerge,
};
