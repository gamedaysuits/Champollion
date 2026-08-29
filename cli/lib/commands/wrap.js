/**
 * Command: wrap
 *
 * Auto-wraps hardcoded user-facing strings in t() calls.
 * Includes safety gates:
 *   1. Git-clean check (skip in dry-run)
 *   2. Automatic backup to .champollion-backup/
 *   3. Diff preview before each file write
 *   4. --undo support to restore from backup
 *
 * After wrapping, adds the extracted keys to locale files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../config.js';
import { detectFramework, walkDir } from '../lint.js';
import {
  checkGitClean, createBackup, restoreFromBackup,
  processFile, generateDiff, addKeysToLocales,
} from '../autofix.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // Gate: Undo mode — restore from backup and exit
  if (args.undo) {
    const { restored, errors } = restoreFromBackup(cwd);
    if (errors.length > 0) {
      for (const err of errors) output.error(err);
      return 1;
    }
    output.ok(`Restored ${restored} file(s) from .champollion-backup/`);
    return 0;
  }

  const isDry = !!args.dry;

  // Gate: Git-clean check (skip in dry-run mode)
  if (!isDry) {
    const { clean, status } = checkGitClean(cwd);
    if (!clean) {
      output.error('Git working tree is not clean. Commit or stash first.');
      output.raw(`     ${status.split('\n').slice(0, 5).join('\n     ')}`);
      return 1;
    }
  }

  const config = resolveConfig(args, cwd);
  const framework = detectFramework(cwd);
  const minLength = parseInt(args['min-length'] || 2, 10);

  output.raw(`\n  champollion wrap${isDry ? ' (dry run)' : ''}`);
  output.raw(`  Framework: ${framework.name}`);
  output.raw('');

  // Find source files
  let sourceFiles = [];
  const srcDir = args.src || null;
  if (srcDir) {
    sourceFiles = walkDir(path.resolve(cwd, srcDir), framework.extensions, ['node_modules', '.next', 'dist', 'build', '.git']);
  } else {
    for (const dir of framework.srcDirs) {
      sourceFiles.push(...walkDir(path.resolve(cwd, dir), framework.extensions, ['node_modules', '.next', 'dist', 'build', '.git']));
    }
  }

  if (sourceFiles.length === 0) {
    output.info('No source files found to process.');
    return 0;
  }

  // Gate: Backup (only if not dry-run)
  if (!isDry) {
    createBackup(sourceFiles, cwd);
    output.info('Backup created at .champollion-backup/');
  }

  let totalFixes = 0;
  let totalAmbiguous = 0;
  const allFixes = [];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(cwd, filePath);

    const { modified, fixes, ambiguous } = processFile(
      content, framework.name, framework, minLength
    );

    if (fixes.length === 0 && ambiguous.length === 0) continue;

    // Show diff for applied fixes
    if (fixes.length > 0) {
      const diff = generateDiff(content, modified, relPath);
      if (diff) output.raw(diff);
    }

    // Report ambiguous cases that need human review
    for (const item of ambiguous) {
      output.warn(`${relPath}:${item.line} — "${item.text}" (${item.reason})`);
    }

    // Write only if not dry-run
    if (!isDry && fixes.length > 0) {
      fs.writeFileSync(filePath, modified, 'utf-8');
    }

    totalFixes += fixes.length;
    totalAmbiguous += ambiguous.length;
    allFixes.push(...fixes);
  }

  // Add extracted keys to locale files (only if not dry-run)
  if (!isDry && allFixes.length > 0) {
    const targetLocales = config.languages || [];
    addKeysToLocales(allFixes, config.localesDir, config.inputLocale, targetLocales);
    output.info(`Added ${allFixes.length} key(s) to locale files`);
  }

  output.raw('');
  output.ok(`${totalFixes} fix(es) applied${isDry ? ' (dry run)' : ''}`);
  if (totalAmbiguous > 0) {
    output.warn(`${totalAmbiguous} ambiguous case(s) flagged for review`);
  }
  if (!isDry && totalFixes > 0) {
    output.raw('  Run `champollion wrap --undo` to revert');
  }
  output.raw('');

  return 0;
}

export { run };
