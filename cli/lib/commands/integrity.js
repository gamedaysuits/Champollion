/**
 * Command: integrity
 *
 * Audits locale files for format, encoding, and placeholder consistency.
 * Catches: mismatched {placeholders}, encoding corruption, untranslated
 * copies, and orphan keys not in the source file.
 *
 * Returns exit code 1 if issues found (unless --warn-only is set).
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../config.js';
import { auditLocalePair, formatIntegrityReport } from '../integrity.js';
import { compileNoTranslate } from '../no-translate.js';
import { resolvePairs } from '../pairs.js';
import { loadTM, lookupTM, tmMethodKey } from '../tm.js';
import { getLanguageCard } from '../registers.js';
import { SCRIPT_CONVERTERS, converterKeyForLocale } from '../scripts.js';
import { flattenKeys } from '../flatten.js';
import { readLocaleFile, detectFormatFromDir, getExtension } from '../format.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // --json: stdout carries exactly one JSON document. Quiet mode keeps the
  // human report lines off stdout; errors still reach stderr.
  const json = !!args.json;
  if (json) output.setMode('quiet');

  const config = resolveConfig(args, cwd);
  const noTranslate = compileNoTranslate(config);

  // Per-locale script expectations for the unexpected-PUA check. Only locales
  // whose converter emits PUA matter here; the resolution says whether that
  // PUA is the configured output (converts) or damage. resolvePairs does not
  // throw on the choice-required state, so auditing an unconfigured crk/sr
  // project still works.
  const scriptExpectations = new Map();
  // TM method key per locale — echoes the TM confirms as pipeline-produced
  // are settled, not issues. This is the SAME suppression the sync diff
  // applies; without it, integrity reported thousands of "untranslated
  // copies" on a project sync calls fully synced. Read-only TM load.
  const tm = loadTM(cwd);
  const tmKeys = new Map();
  for (const [, pc] of resolvePairs(config)) {
    tmKeys.set(pc.target, tmMethodKey(pc));
    const key = converterKeyForLocale(pc.target, getLanguageCard(pc.target));
    if (!key || !SCRIPT_CONVERTERS[key].puaRange) continue;
    scriptExpectations.set(pc.target, {
      locale: pc.target,
      converts: !!pc.scriptResolution?.converterKey,
    });
  }

  const format = config.format !== 'auto'
    ? config.format
    : detectFormatFromDir(config.localesDir);
  const ext = getExtension(format);
  const sourcePath = path.join(config.localesDir, `${config.inputLocale}${ext}`);

  if (!fs.existsSync(sourcePath)) {
    if (json) {
      console.log(JSON.stringify({
        command: 'integrity',
        error: `Source locale file not found: ${sourcePath}`,
      }, null, 2));
      return 1;
    }
    output.error(`Source locale file not found: ${sourcePath}`);
    return 1;
  }

  const sourceRaw = readLocaleFile(sourcePath, format);
  const sourceFlat = format === 'json' ? flattenKeys(sourceRaw) : sourceRaw;

  // Detect target locales from directory listing
  const files = fs.readdirSync(config.localesDir);
  const targetLocales = files
    .filter(f => f.endsWith(ext) && !f.startsWith(config.inputLocale))
    .map(f => f.replace(ext, ''));

  output.raw('\n  champollion integrity — Locale File Audit\n');
  output.raw(`  Source: ${config.inputLocale} (${Object.keys(sourceFlat).length} keys)`);
  output.raw(`  Targets: ${targetLocales.join(', ')}\n`);

  let totalIssues = 0;
  const localeReports = [];

  for (const locale of targetLocales) {
    const targetPath = path.join(config.localesDir, `${locale}${ext}`);
    const targetRaw = readLocaleFile(targetPath, format);
    const targetFlat = format === 'json' ? flattenKeys(targetRaw) : targetRaw;

    const tmKey = tmKeys.get(locale) || null;
    const audit = auditLocalePair(sourceFlat, targetFlat, locale, {
      noTranslate,
      scriptExpectation: scriptExpectations.get(locale) || null,
      isConfirmedEcho: tmKey
        ? (key, sourceValue) => lookupTM(tm, sourceValue, locale, tmKey) === sourceValue
        : null,
    });
    const report = formatIntegrityReport(locale, audit);
    output.raw(report);

    // Only these five categories drive the exit code (pluralIssues and
    // bomFiles are reported but advisory) — issueCount matches that.
    //
    // noTranslateDrift is an error, not advisory: a declared-verbatim key
    // that isn't verbatim is a broken value in a shipped locale file (the
    // corrupted-URL class), and `champollion sync` repairs it deterministically.
    // unexpectedPua likewise: PUA with conversion off renders blank, and
    // `champollion repair-script` repairs it deterministically.
    // hollowedValues likewise: old-pipeline damage that sync considers
    // settled — only a forced re-translation fixes it, and only this audit
    // surfaces it.
    const issueCount = audit.placeholderIssues.length +
      audit.encodingIssues.length +
      audit.copies.length +
      audit.orphans.length +
      audit.noTranslateDrift.length +
      audit.unexpectedPua.length +
      audit.hollowedValues.length;
    totalIssues += issueCount;
    localeReports.push({ locale, issues: audit, issueCount });
  }

  output.raw(`  Total issues: ${totalIssues}`);

  const exitCode = (totalIssues > 0 && !args['warn-only']) ? 1 : 0;
  if (json) {
    console.log(JSON.stringify({
      command: 'integrity',
      source: config.inputLocale,
      sourceKeys: Object.keys(sourceFlat).length,
      locales: localeReports,
      totalIssues,
      warnOnly: !!args['warn-only'],
    }, null, 2));
  }
  return exitCode;
}

export { run };
