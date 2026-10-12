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
import { resolveConfig, autoDetectLanguages } from '../config.js';
import { discoverLocaleLayout } from '../locale-layout.js';
import { detectFramework, walkDir } from '../lint.js';
import {
  checkGitClean, createBackup, restoreFromBackup,
  processFile, generateDiff, addKeysToLocales, wrapUnsupportedReason,
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

  // Decide WHERE extracted keys go before any source file is rewritten — a
  // wrap that rewrote components to t('…') and then could not store the
  // keys would leave the app showing raw key names.
  const destination = resolveWrapDestination(config, cwd);
  if (destination.error) {
    output.error(destination.error);
    return 1;
  }

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
    addKeysToLocales(allFixes, destination.source, destination.targets);
    output.info(`Added ${allFixes.length} key(s) to ${destination.source.rel}`
      + (destination.targets.length > 0 ? ' — run `champollion sync` to translate them into each target' : ''));
  } else if (isDry && allFixes.length > 0) {
    output.info(`Would add ${allFixes.length} key(s) to ${destination.source.rel}`);
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

/**
 * The locale files `wrap` writes extracted keys into: the source file (one
 * per flat project; the `defaultNamespace` file — or the only file — of a
 * folder-per-locale project) and the matching file of every configured
 * target locale.
 *
 * @param {object} config - Resolved config
 * @param {string} cwd
 * @returns {{ source?: object, targets?: object[], error?: string }}
 */
function resolveWrapDestination(config, cwd) {
  if (config.format === 'docusaurus') {
    return { error: 'wrap writes t() keys into key-value locale files; Docusaurus translates through <Translate> and `docusaurus write-translations` — wrap does not apply.' };
  }
  const layout = discoverLocaleLayout(config, { cwd });
  let ns = '';
  if (layout.namespaced) {
    const namespaces = layout.sourceFiles.map(f => f.ns);
    if (config.defaultNamespace) {
      if (!namespaces.includes(config.defaultNamespace)) {
        return { error: `"defaultNamespace" is "${config.defaultNamespace}", but the source locale has no such file (namespaces: ${namespaces.join(', ') || 'none'}).` };
      }
      ns = config.defaultNamespace;
    } else if (namespaces.length === 1) {
      ns = namespaces[0];
    } else {
      return { error: `This project has ${namespaces.length} namespace files (${namespaces.join(', ') || 'none'}). `
        + 'Set "defaultNamespace" in champollion.config.json to choose the file wrap adds keys to.' };
    }
  }
  const source = layout.sourceFiles.find(f => f.ns === ns) || layout.sourceFiles[0];
  // Flutter ARB and gettext catalogs cannot hold t('dotted.key') keys —
  // refuse before any component is rewritten.
  const refusal = source ? wrapUnsupportedReason(source) : null;
  if (refusal) return { error: refusal };
  if (!source || !fs.existsSync(source.path)) {
    return { error: `Source locale file not found: ${source ? source.path : layout.display} — wrap needs it to store the extracted keys.` };
  }
  // Configured targets, or — like sync — the ones on disk when none are.
  const languages = Object.keys(config.resolvedLanguages || {}).length > 0
    ? config.resolvedLanguages
    : autoDetectLanguages(config);
  const targetCodes = Object.keys(languages).filter(c => c !== config.inputLocale);
  return { source, targets: targetCodes.map(code => layout.fileFor(code, ns)) };
}

export { run };
