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
import { resolveConfig } from '../config.js';
import { auditLocalePair, formatIntegrityReport, auditARBDocument } from '../integrity.js';
import { compileNoTranslate } from '../no-translate.js';
import { resolvePairs } from '../pairs.js';
import { loadTM, saveTM, isTMDirty } from '../tm.js';
import { tmTextFor, tmProofTextsFor, createTMEvictor } from '../tm-evict.js';
import { poPluralSlots } from '../po.js';
import { tmKeysForPair, tmHoldsValue } from '../fallback.js';
import { getLanguageCard } from '../registers.js';
import { SCRIPT_CONVERTERS, converterKeyForLocale } from '../scripts.js';
import {
  discoverLocaleLayout, loadSourceUnits, expectedForTarget, readLocaleFlat, NS_SEPARATOR,
} from '../locale-layout.js';
import { output } from '../output.js';

/**
 * Fold one file's audit into a locale's running audit. In a namespaced
 * layout every key is reported as "<ns>::<key>" so two files' findings for
 * "title" stay distinguishable (same convention as the lock manifest).
 *
 * @param {object|null} into - Accumulated audit (null to start one)
 * @param {object} audit - auditLocalePair() result for one file
 * @param {string|null} ns - Namespace to prefix, or null for single-file layouts
 * @returns {object} Merged audit
 */
function mergeAudits(into, audit, ns) {
  const tag = (k) => (ns === null ? k : `${ns}${NS_SEPARATOR}${k}`);
  const out = into || {
    placeholderIssues: [], encodingIssues: [], copies: [], orphans: [], noTranslateDrift: [],
    unexpectedPua: [], hollowedValues: [], icuIssues: [], documentIssues: [], pluralIssues: [], pluralNotes: [], bomFiles: [],
  };
  for (const field of ['placeholderIssues', 'encodingIssues', 'noTranslateDrift', 'unexpectedPua', 'hollowedValues', 'icuIssues', 'documentIssues', 'pluralIssues', 'pluralNotes']) {
    for (const item of audit[field] || []) out[field].push({ ...item, key: tag(item.key) });
  }
  for (const field of ['copies', 'orphans']) {
    for (const key of audit[field] || []) out[field].push(tag(key));
  }
  out.bomFiles.push(...(audit.bomFiles || []));
  return out;
}

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
  // Damaged values the TM proves the pipeline wrote are evicted from it, so
  // the `sync --force-keys` the report names re-translates them instead of
  // re-serving the damage for free (lib/tm-evict.js). Hand-written values
  // have no equal cache entry and are never touched.
  const evictor = createTMEvictor(tm);
  let tmEvicted = 0;
  const tmKeys = new Map();
  for (const [, pc] of resolvePairs(config, { cwd })) {
    // The pair's own key, then its fallback's: a value the fallback
    // produced is cached under the fallback (lib/fallback.js).
    tmKeys.set(pc.target, tmKeysForPair(pc));
    const key = converterKeyForLocale(pc.target, getLanguageCard(pc.target));
    if (!key || !SCRIPT_CONVERTERS[key].puaRange) continue;
    scriptExpectations.set(pc.target, {
      locale: pc.target,
      converts: !!pc.scriptResolution?.converterKey,
    });
  }

  // The project's files, per locale, from the ONE layout module (flat,
  // folder per locale, or localesPattern).
  const layout = discoverLocaleLayout(config, { cwd });
  const sourceMissing = layout.namespaced
    ? layout.sourceFiles.length === 0
    : !fs.existsSync(layout.sourceFiles[0].path);
  if (sourceMissing) {
    const where = layout.namespaced
      ? `${layout.display} (no ${layout.format} files for ${config.inputLocale})`
      : layout.sourceFiles[0].path;
    if (json) {
      console.log(JSON.stringify({
        command: 'integrity',
        error: `Source locale file not found: ${where}`,
      }, null, 2));
      return 1;
    }
    output.error(`Source locale file not found: ${where}`);
    return 1;
  }

  const units = loadSourceUnits(layout);
  const sourceKeyCount = units.reduce((n, u) => n + Object.keys(u.flat).length, 0);

  // Target locales present on disk — EXACT code match. The old prefix test
  // (`!f.startsWith(inputLocale)`) silently skipped en-GB/en-AU when the
  // source was en, so those files were never audited.
  const targetLocales = layout.listLocales();

  output.raw('\n  champollion integrity — Locale File Audit\n');
  output.raw(`  Source: ${config.inputLocale} (${sourceKeyCount} keys)`);
  output.raw(`  Targets: ${targetLocales.join(', ')}\n`);

  let totalIssues = 0;

  let totalAdvisory = 0;
  const localeReports = [];

  for (const locale of targetLocales) {
    const localeTmKeys = tmKeys.get(locale) || null;
    // A borrowed i18next plural form is cached under its own text (tmTextFor).
    const confirmedEchoFor = (expansion) => (localeTmKeys
      ? (key, sourceValue) => tmHoldsValue(tm, tmTextFor(key, sourceValue, expansion), locale, localeTmKeys, sourceValue)
      : null);
    // One audit per file; namespaced keys ("common::nav.home") keep the
    // per-file findings apart in the merged locale report.
    let audit = null;
    for (const unit of units) {
      const file = layout.fileFor(locale, unit.ns);
      if (!fs.existsSync(file.path) && !layout.namespaced) continue;
      const targetFlat = fs.existsSync(file.path) ? readLocaleFlat(file) : {};
      // Judge the file by the keys this locale should have — i18next
      // plurals expand to the target's own CLDR categories.
      const { flat: expected, expansion } = expectedForTarget(unit, config.inputLocale, locale);
      const fileAudit = auditLocalePair(expected, targetFlat, locale, {
        noTranslate,
        scriptExpectation: scriptExpectations.get(locale) || null,
        isConfirmedEcho: confirmedEchoFor(expansion),
        // A gettext catalog holds only the plural forms its header has slots for.
        pluralSlots: file.format === 'po' && fs.existsSync(file.path)
          ? poPluralSlots(fs.readFileSync(file.path, 'utf-8'), locale) : null,
      });
      fileAudit.documentIssues = file.format === 'arb' && fs.existsSync(file.path)
        ? auditARBDocument(unit.file.path, file.path, locale)
        : [];
      // Values damaged in a way the quality gate now refuses: evict the TM
      // entries that produced them.
      const damaged = [
        ...fileAudit.icuIssues.map(i => [i.key, i.actual]),
        ...fileAudit.placeholderIssues.map(i => [i.key, i.targetVal]),
        ...fileAudit.hollowedValues.map(i => [i.key, i.actual]),
      ];
      for (const [key, value] of damaged) {
        if (typeof expected[key] !== 'string') continue;
        for (const text of tmProofTextsFor(key, expected[key], expansion)) {
          tmEvicted += evictor.evictProducing(text, locale, value, localeTmKeys || []);
        }
      }
      // Single-file layouts keep auditLocalePair's own result object (and
      // its exact shape in --json); namespaced ones merge with ns tags.
      audit = layout.namespaced ? mergeAudits(audit, fileAudit, unit.ns) : fileAudit;
    }
    if (!audit) continue;
    const report = formatIntegrityReport(locale, audit);
    output.raw(report);

    // Only these categories drive the exit code (pluralIssues and
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
      audit.hollowedValues.length +
      // ICU structure damage and ARB document damage break the app at
      // runtime / build time — errors, like the hollowed values.
      (audit.icuIssues?.length || 0) +
      (audit.documentIssues?.length || 0);
    totalIssues += issueCount;
    totalAdvisory += (audit.pluralIssues?.length || 0) + (audit.bomFiles?.length || 0);
    localeReports.push({ locale, issues: audit, issueCount });
  }

  // Advisory findings (plural categories, BOMs) don't fail the run, but a
  // bare "Total issues: 0" under a printed warning read as a contradiction.
  output.raw(`  Total issues: ${totalIssues}`
    + (totalAdvisory > 0 ? ` (+${totalAdvisory} advisory, listed above — they don't fail the check)` : ''));
  if (tmEvicted > 0 && isTMDirty(tm)) {
    saveTM(cwd, tm);
    output.raw(`  [TM] Evicted ${tmEvicted} cached translation(s) that produced damaged values — `
      + '`champollion sync --force-keys <key>` now re-translates them instead of re-serving them.');
  }

  const exitCode = (totalIssues > 0 && !args['warn-only']) ? 1 : 0;
  if (json) {
    console.log(JSON.stringify({
      command: 'integrity',
      source: config.inputLocale,
      sourceKeys: sourceKeyCount,
      locales: localeReports,
      totalIssues,
      tmEvicted,
      warnOnly: !!args['warn-only'],
    }, null, 2));
  }
  return exitCode;
}

export { run };
