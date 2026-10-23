/**
 * Command: xliff
 *
 * Exports and imports XLIFF 1.2 files for professional translator review.
 *
 * Subcommands:
 *   export   Generate a .xliff file from source + target locale files.
 *   import   Merge reviewed translations from a .xliff file back into locale files.
 *
 * WHY THIS EXISTS:
 *   XLIFF is the industry-standard exchange format between translation tools
 *   and CAT (Computer-Assisted Translation) platforms. This command lets users:
 *     1. Export translations for professional review in memoQ/SDL Trados/Phrase
 *     2. Import reviewed translations back, then run sync to fill gaps
 *     3. Integrate champollion into existing localization workflows
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../config.js';
import { exportXLIFF, importXLIFF } from '../xliff.js';
import { compileNoTranslate } from '../no-translate.js';
import { setNestedValue, assignInOrder } from '../flatten.js';
import { writeLocaleFile, detectYAMLStyle } from '../format.js';
import {
  discoverLocaleLayout, loadSourceUnits, expectedForTarget, readLocaleFlat, lockKey, splitLockKey,
} from '../locale-layout.js';
import { output } from '../output.js';

/** Default output directory for exported XLIFF files */
const XLIFF_DIR = '.champollion/xliff';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const sub = args._[1];

  // --json: stdout carries exactly one JSON document. Quiet mode keeps the
  // human raws off stdout; warnings/errors still reach stderr.
  if (args.json) output.setMode('quiet');

  if (!sub || sub === 'help') {
    printUsage();
    return 0;
  }

  if (sub === 'export') {
    return runExport(args, cwd);
  }

  if (sub === 'import') {
    return runImport(args, cwd);
  }

  output.error(`Unknown subcommand: "${sub}". Run "champollion xliff --help" for usage.`);
  return 1;
}

// -----------------------------------------------------------------
// xliff export
// -----------------------------------------------------------------

/**
 * Export source + target locale as XLIFF 1.2.
 *
 * Reads the source locale and the specified target locale,
 * generates XLIFF, and writes it to .champollion/xliff/<locale>.xliff
 * (or a custom path via --out).
 */
function runExport(args, cwd) {
  const locale = args.locale;
  if (!locale) {
    output.error('Missing required --locale flag. Example: champollion xliff export --locale fr');
    return 1;
  }

  const config = resolveConfig(args, cwd);
  // The project's locale files from the ONE layout module. A folder-per-
  // locale project exports ALL of a locale's namespace files into one XLIFF
  // document; unit ids are "<ns>::<key>" (the lock-manifest convention), so
  // import can route every unit back to its file. Single-file layouts keep
  // bare keys — their XLIFF is exactly what it was.
  const layout = discoverLocaleLayout(config, { cwd });
  const sourceMissing = layout.namespaced
    ? layout.sourceFiles.length === 0
    : !fs.existsSync(layout.sourceFiles[0].path);
  if (sourceMissing) {
    const where = layout.namespaced ? `${layout.display} (no files for ${config.inputLocale})` : layout.sourceFiles[0].path;
    output.error(`Source locale file not found: ${where}`);
    return 1;
  }
  const units = loadSourceUnits(layout);

  // Source = what THIS locale must contain (i18next plurals expand to the
  // target's own CLDR categories); target = what its files hold today
  // (files that do not exist yet export as untranslated).
  const sourceFlat = {};
  const targetFlat = {};
  for (const unit of units) {
    const expected = expectedForTarget(unit, config.inputLocale, locale).flat;
    for (const [k, v] of Object.entries(expected)) sourceFlat[lockKey(layout, unit.ns, k)] = v;
    const file = layout.fileFor(locale, unit.ns);
    if (fs.existsSync(file.path)) {
      for (const [k, v] of Object.entries(readLocaleFlat(file))) targetFlat[lockKey(layout, unit.ns, k)] = v;
    }
  }

  // Generate XLIFF
  const xliff = exportXLIFF({
    sourceLocale: config.inputLocale,
    targetLocale: locale,
    sourceFlat,
    targetFlat,
    original: layout.namespaced
      ? (layout.kind === 'dir' ? `${config.inputLocale}/` : layout.display)
      : units[0].file.rel,
    // No-translate patterns match a key WITHIN its file — strip the
    // namespace before asking.
    noTranslate: namespacedMatcher(compileNoTranslate(config), layout),
  });

  // Determine output path
  const outDir = args.out || path.join(cwd, XLIFF_DIR);
  const outPath = args.out
    ? (args.out.endsWith('.xliff') ? args.out : path.join(args.out, `${locale}.xliff`))
    : path.join(outDir, `${locale}.xliff`);

  // Write
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, xliff, 'utf-8');

  const keyCount = Object.keys(sourceFlat).filter(k => typeof sourceFlat[k] === 'string').length;
  const translatedCount = Object.keys(targetFlat).filter(k =>
    typeof targetFlat[k] === 'string' && targetFlat[k].length > 0
  ).length;

  if (args.json) {
    console.log(JSON.stringify({
      command: 'xliff',
      action: 'export',
      locale,
      path: outPath,
      exported: keyCount,
      translated: translatedCount,
      pending: keyCount - translatedCount,
    }, null, 2));
    return 0;
  }

  output.raw(`\n  ✓ Exported XLIFF 1.2 for ${config.inputLocale} → ${locale}`);
  output.raw(`    Keys:        ${keyCount}`);
  output.raw(`    Translated:  ${translatedCount}`);
  output.raw(`    Pending:     ${keyCount - translatedCount}`);
  output.raw(`    Written to:  ${path.relative(cwd, outPath)}`);
  output.raw('');
  output.raw('  Send this file to your translator or open it in a CAT tool');
  output.raw('  (memoQ, SDL Trados, Phrase, etc.). When reviewed, import it back:');
  output.raw(`    champollion xliff import ${path.relative(cwd, outPath)}\n`);

  return 0;
}

// -----------------------------------------------------------------
// xliff import
// -----------------------------------------------------------------

/**
 * Import reviewed translations from an XLIFF file back into the locale file.
 *
 * Reads the XLIFF, extracts target translations, and merges them
 * into the corresponding locale file. Only keys present in the
 * XLIFF are overwritten — existing translations for other keys
 * are preserved.
 */
function runImport(args, cwd) {
  const xliffPath = args._[2];
  if (!xliffPath) {
    output.error('Missing XLIFF file path. Example: champollion xliff import .champollion/xliff/fr.xliff');
    return 1;
  }

  const resolvedPath = path.resolve(cwd, xliffPath);
  if (!fs.existsSync(resolvedPath)) {
    output.error(`XLIFF file not found: ${resolvedPath}`);
    return 1;
  }

  const xliffContent = fs.readFileSync(resolvedPath, 'utf-8');
  const { translations, metadata } = importXLIFF(xliffContent);

  if (Object.keys(translations).length === 0) {
    if (args.json) {
      console.log(JSON.stringify({
        command: 'xliff', action: 'import', locale: metadata.targetLocale || null,
        path: resolvedPath, imported: 0, updated: 0, added: 0, unchanged: 0,
        note: 'No translated entries found in the XLIFF file.',
      }, null, 2));
      return 0;
    }
    output.raw('\n  No translated entries found in the XLIFF file.');
    output.raw('  Make sure the XLIFF contains <target> elements with content.\n');
    return 0;
  }

  const locale = metadata.targetLocale;
  if (!locale) {
    output.error('Could not determine target locale from XLIFF metadata.');
    output.error('The <file> element must have a target-language attribute.');
    return 1;
  }

  const config = resolveConfig(args, cwd);
  const layout = discoverLocaleLayout(config, { cwd });

  const dryRun = args.dry || false;

  // Route every unit to its file. Namespaced layouts need "<ns>::<key>" ids
  // (what `xliff export` writes); an id without one — or naming a namespace
  // the source does not have — fails the whole import before anything is
  // written, rather than guessing a file.
  const byNs = new Map();
  const unroutable = [];
  const knownNs = new Set(layout.sourceFiles.map(f => f.ns));
  for (const [id, value] of Object.entries(translations)) {
    const parts = splitLockKey(layout, id);
    if (!parts || (layout.namespaced && knownNs.size > 0 && !knownNs.has(parts.ns))) {
      unroutable.push(id);
      continue;
    }
    if (!byNs.has(parts.ns)) byNs.set(parts.ns, {});
    byNs.get(parts.ns)[parts.key] = value;
  }
  if (unroutable.length > 0) {
    // A gettext context key prints its U+0004 as "␄", as it was exported.
    const sample = unroutable.slice(0, 5).map(id => id.replace(/\u0004/g, '\u2404')).join(', ');
    output.error(
      `${unroutable.length} XLIFF unit id(s) do not name one of this project's locale files: ${sample}`
      + `${unroutable.length > 5 ? ', …' : ''}. In a folder-per-locale project ids are "<namespace>::<key>" `
      + `(namespaces: ${[...knownNs].join(', ') || 'none found'}) — export with \`champollion xliff export\`.`);
    return 1;
  }

  // Merge: XLIFF translations overwrite existing values, file by file.
  let updated = 0;
  let added = 0;
  const writes = [];
  for (const [ns, entries] of byNs) {
    const file = layout.fileFor(locale, ns);
    const existingFlat = fs.existsSync(file.path) ? readLocaleFlat(file) : {};
    for (const [key, value] of Object.entries(entries)) {
      if (key in existingFlat) {
        if (existingFlat[key] !== value) {
          updated++;
        }
      } else {
        added++;
      }
      // A plural form new to the file goes beside its siblings in CLDR order.
      assignInOrder(existingFlat, key, value);
    }
    writes.push({ ns, file, existingFlat });
  }

  const skipped = Object.keys(translations).length - updated - added;
  // One file: report its path as before. Several: the layout's pattern.
  const targetPath = writes.length === 1 ? writes[0].file.path : layout.filesFor(locale)[0]?.path || layout.baseDir;
  const targetLabel = writes.length === 1
    ? path.relative(cwd, writes[0].file.path)
    : `${writes.length} files (${writes.map(w => w.file.rel).join(', ')})`;

  if (dryRun) {
    if (args.json) {
      console.log(JSON.stringify({
        command: 'xliff', action: 'import', dryRun: true, locale, path: targetPath,
        ...(writes.length > 1 && { files: writes.map(w => w.file.path) }),
        imported: Object.keys(translations).length, updated, added, unchanged: skipped,
      }, null, 2));
      return 0;
    }
    output.raw(`\n  [DRY RUN] Would import ${Object.keys(translations).length} translations for ${locale}`);
    output.raw(`    Updated:  ${updated} (changed from existing)`);
    output.raw(`    Added:    ${added} (new keys)`);
    output.raw(`    Unchanged: ${skipped}`);
    output.raw(`    Target:   ${targetLabel}\n`);
    return 0;
  }

  // Write back
  for (const { ns, file, existingFlat } of writes) {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    if (file.format === 'json') {
      // Re-nest the flat map into JSON structure using setNestedValue
      const nested = {};
      for (const [key, value] of Object.entries(existingFlat)) {
        setNestedValue(nested, key, value);
      }
      fs.writeFileSync(file.path, JSON.stringify(nested, null, 2) + '\n', 'utf-8');
    } else {
      // TOML/YAML — write the merged flat map back through the exact same
      // writer sync uses (lib/format.js writeLocaleFile), so an imported file
      // keeps the serialization style of a synced project. YAML needs the
      // style probe sync performs on the SOURCE locale file (Hugo plural
      // sub-keys vs standard nesting); fall back to the target file when the
      // source is missing.
      let yamlStyle = null;
      if (file.format === 'yaml') {
        const sourcePath = layout.sourceFiles.find(f => f.ns === ns)?.path;
        const stylePath = sourcePath && fs.existsSync(sourcePath) ? sourcePath
          : (fs.existsSync(file.path) ? file.path : null);
        yamlStyle = stylePath ? detectYAMLStyle(fs.readFileSync(stylePath, 'utf-8')) : null;
      }
      // Document formats (.po, .arb) are rebuilt from the SOURCE file's
      // structure — plural entries, metadata, @@locale — not from the flat
      // map alone (a brand-new target has no structure of its own).
      writeLocaleFile(file.path, existingFlat, file.format, existingFlat, yamlStyle, {
        sourcePath: file.sourcePath || null,
        locale: file.code || null,
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify({
      command: 'xliff', action: 'import', dryRun: false, locale, path: targetPath,
      ...(writes.length > 1 && { files: writes.map(w => w.file.path) }),
      imported: Object.keys(translations).length, updated, added, unchanged: skipped,
    }, null, 2));
    return 0;
  }

  output.raw(`\n  ✓ Imported ${Object.keys(translations).length} translations for ${locale}`);
  output.raw(`    Updated:    ${updated} (changed from existing)`);
  output.raw(`    Added:      ${added} (new keys)`);
  output.raw(`    Unchanged:  ${skipped}`);
  output.raw(`    Written to: ${targetLabel}\n`);

  return 0;
}

/**
 * Wrap a no-translate matcher so it receives the key WITHIN its file:
 * patterns are written against a file's own keys ("**.url"), never against
 * the "<ns>::" prefix the XLIFF ids carry.
 *
 * @param {import('../no-translate.js').NoTranslateMatcher} matcher
 * @param {{ namespaced: boolean }} layout
 */
function namespacedMatcher(matcher, layout) {
  if (!layout.namespaced) return matcher;
  return {
    ...matcher,
    matches: (id, value) => {
      const parts = splitLockKey(layout, id);
      return matcher.matches(parts ? parts.key : id, value);
    },
  };
}

// -----------------------------------------------------------------
// Usage
// -----------------------------------------------------------------

function printUsage() {
  output.raw(`
  champollion xliff — XLIFF 1.2 export/import for professional review

  SUBCOMMANDS
    export    Generate a .xliff file for a target locale
    import    Merge reviewed .xliff translations back into locale files

  OPTIONS
    --locale <code>   Target locale for export (required for export)
    --out <path>      Custom output path or directory (export)
    --dry             Preview import without writing files
    --json            Single JSON document output (export/import)
    --config <path>   Path to config file

  Import writes back in the project's locale format (JSON, TOML, or YAML)
  using the same serializers sync uses.

  WORKFLOW
    1. Export:  champollion xliff export --locale fr
    2. Review:  Send .champollion/xliff/fr.xliff to translator or CAT tool
    3. Import:  champollion xliff import .champollion/xliff/fr.xliff
    4. Sync:    champollion sync  (fills remaining gaps)

  EXAMPLES
    champollion xliff export --locale fr
    champollion xliff export --locale ja --out ./review/
    champollion xliff import .champollion/xliff/fr.xliff
    champollion xliff import ./reviewed.xliff --dry
  `);
}

export { run };
