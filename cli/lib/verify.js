/**
 * verify.js — Post-sync verification module.
 *
 * WHY: The sync pipeline can report "synced 30 keys" but some keys
 * might be wrong in fact — empty values, [EN] fallback markers from
 * prior runs, ASCII-only values for non-Latin locales, missing keys,
 * or broken ICU placeholders. This module re-reads the written locale
 * files from disk and confirms translations are actually present and
 * correct.
 *
 * DESIGN: Runs automatically at the end of every sync (unless --no-verify).
 * Also exposed as a standalone `verify` command for CI gates.
 * Reuses existing validation modules — no new check logic, just orchestration.
 *
 * PHILOSOPHY: This is a trust-but-verify gate. Sync does the work,
 * verify confirms the work is correct. Every issue is logged LOUD.
 *
 * OUTPUT: The decorative section headers and per-check [OK] lines go through
 * output.raw(), which is suppressed in --json mode. The real findings go
 * through output.ok/warn/error, which json-encode themselves — so
 * `champollion sync --json | jq` stays parseable while a human still gets
 * the readable report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readLocaleFile, detectFormatFromDir, getExtension, extractDocusaurusMessages } from './format.js';
import { flattenKeys } from './flatten.js';
import { auditLocalePair } from './integrity.js';
import { NON_LATIN_LOCALES, isAsciiOnly } from './validate.js';
import { compileNoTranslate } from './no-translate.js';
import { resolvePairs } from './pairs.js';
import { loadTM, lookupTM, tmMethodKey } from './tm.js';
import { parsePairKey } from './pairs.js';
import { output } from './output.js';

/**
 * Target locales the CONFIG promises, independent of what's on disk.
 *
 * Directory-derived discovery can't see a locale whose file was never
 * created — which made `verify` (and sync's post-verify) pass green on a
 * project with zero translation done. This reads the same config surfaces
 * the sync pair graph reads: `languages` (via resolvedLanguages) and the
 * targets of any `pairs` overrides. Auto-detect projects (no languages
 * configured) return an empty set — nothing is promised, nothing to enforce.
 *
 * @param {object} config - Resolved config from resolveConfig()
 * @returns {Set<string>} Configured target locale codes (input locale excluded)
 */
function configuredTargetLocales(config) {
  const targets = new Set(Object.keys(config.resolvedLanguages || {}));
  if (config.pairs && typeof config.pairs === 'object') {
    for (const key of Object.keys(config.pairs)) {
      const { target } = parsePairKey(key);
      if (target) targets.add(target);
    }
  }
  targets.delete(config.inputLocale);
  return targets;
}

/**
 * Run the per-locale correctness checks against a source/target flat map pair.
 *
 * Pure: collects findings into arrays and returns them; does NOT print. Both
 * the flat (JSON/TOML/YAML) path and the Docusaurus path call this so the two
 * can't drift in what they check.
 *
 * @param {object} sourceFlat - Flattened source locale map
 * @param {object} targetFlat - Flattened target locale map
 * @param {string} locale - Target locale code (for script detection)
 * @param {object} config - Resolved config (fallbackPrefix)
 * @param {import('./no-translate.js').NoTranslateMatcher} [noTranslate] -
 *   Compiled no-translate matcher. Exempt keys are excluded from the
 *   source-echo warning (identical IS correct for them) and checked for
 *   drift instead, which is an error.
 * @returns {{ errors: string[], warnings: string[], sourceKeyCount: number, targetKeyCount: number }}
 */
function auditTranslations(sourceFlat, targetFlat, locale, config, noTranslate = null, isConfirmedEcho = null) {
  const errors = [];
  const warnings = [];
  const sourceKeyCount = Object.keys(sourceFlat).length;
  const targetKeyCount = Object.keys(targetFlat).length;

  // 1. Key parity — are all source keys present in target?
  const missingKeys = Object.keys(sourceFlat).filter(k => !(k in targetFlat));
  if (missingKeys.length > 0) {
    const preview = missingKeys.slice(0, 5).join(', ');
    const suffix = missingKeys.length > 5 ? '...' : '';
    errors.push(`${missingKeys.length} missing key(s): ${preview}${suffix}`);
  }

  // 2. [EN] fallback marker scan — any legacy [EN]-prefixed values?
  const fallbackPrefix = config.fallbackPrefix || '[EN] ';
  const fallbackKeys = Object.keys(targetFlat).filter(k =>
    typeof targetFlat[k] === 'string' && targetFlat[k].startsWith(fallbackPrefix)
  );
  if (fallbackKeys.length > 0) {
    const preview = fallbackKeys.slice(0, 3).join(', ');
    const suffix = fallbackKeys.length > 3 ? '...' : '';
    errors.push(`${fallbackKeys.length} [EN] fallback marker(s): ${preview}${suffix}`);
  }

  // 3. Empty value scan
  const emptyKeys = Object.keys(targetFlat).filter(k =>
    typeof targetFlat[k] === 'string' && targetFlat[k].trim() === ''
  );
  if (emptyKeys.length > 0) {
    const preview = emptyKeys.slice(0, 3).join(', ');
    const suffix = emptyKeys.length > 3 ? '...' : '';
    errors.push(`${emptyKeys.length} empty translation(s): ${preview}${suffix}`);
  }

  // 4. Script compliance — non-Latin locales should have non-ASCII translations
  const isNonLatin = NON_LATIN_LOCALES.has(locale) || NON_LATIN_LOCALES.has(locale.split('-')[0]);
  if (isNonLatin) {
    const asciiOnlyKeys = Object.keys(targetFlat).filter(k => {
      const val = targetFlat[k];
      // Only check string values that are long enough to be real translations
      // (short values like "API", "OK", "ID" are often legitimately ASCII)
      if (typeof val !== 'string' || val.length < 6) return false;
      // A no-translate value is ASCII on purpose. `https://…` copied into an
      // Arabic locale is CORRECT, and flagging it as wrong-script would make
      // a clean sync fail its own post-sync verification.
      if (noTranslate && noTranslate.matches(k, sourceFlat[k])) return false;
      return isAsciiOnly(val);
    });
    if (asciiOnlyKeys.length > 0) {
      const preview = asciiOnlyKeys.slice(0, 3).join(', ');
      const suffix = asciiOnlyKeys.length > 3 ? '...' : '';
      errors.push(`${asciiOnlyKeys.length} wrong script (ASCII-only): ${preview}${suffix}`);
    }
  }

  // 5. Placeholder preservation — run the integrity audit for placeholder + encoding checks
  const audit = auditLocalePair(sourceFlat, targetFlat, locale, { noTranslate, isConfirmedEcho });

  if (audit.placeholderIssues.length > 0) {
    const preview = audit.placeholderIssues.slice(0, 3).map(i => i.key).join(', ');
    const suffix = audit.placeholderIssues.length > 3 ? '...' : '';
    errors.push(`${audit.placeholderIssues.length} placeholder mismatch(es): ${preview}${suffix}`);
  }

  // 6. Encoding issues (warning)
  if (audit.encodingIssues.length > 0) {
    const preview = audit.encodingIssues.slice(0, 3).map(i => i.key).join(', ');
    const suffix = audit.encodingIssues.length > 3 ? '...' : '';
    warnings.push(`${audit.encodingIssues.length} encoding issue(s): ${preview}${suffix}`);
  }

  // 7. Source echo — untranslated copies (warning, not error — some are legitimate)
  if (audit.copies.length > 0) {
    const preview = audit.copies.slice(0, 5).join(', ');
    const suffix = audit.copies.length > 5 ? '...' : '';
    warnings.push(`${audit.copies.length} source echo(es): ${preview}${suffix}`);
  }

  // 8. Hollowed values — the source with its letters deleted, written by a
  // pipeline older than the content-preservation gate. The gate can't reach
  // values already on disk (their manifest hashes read as settled), so this
  // is where old damage surfaces. Error: the value is unreadable in fact.
  if (audit.hollowedValues.length > 0) {
    const preview = audit.hollowedValues.slice(0, 3).map(h => h.key).join(', ');
    const suffix = audit.hollowedValues.length > 3 ? '...' : '';
    errors.push(
      `${audit.hollowedValues.length} hollowed value(s) (source with letters deleted): ${preview}${suffix}`
      + ' — re-translate with `champollion sync --force-keys <key>` or `--pair <pair> --force`',
    );
  }

  // 9. No-translate drift — a declared-verbatim key that is NOT verbatim.
  // An error, not a warning: unlike a source echo there is no legitimate
  // reading of it. The project declared exactly one correct value and the
  // file holds a different one. `champollion sync` repairs it.
  if (audit.noTranslateDrift.length > 0) {
    const preview = audit.noTranslateDrift.slice(0, 3).map(d => d.key).join(', ');
    const suffix = audit.noTranslateDrift.length > 3 ? '...' : '';
    errors.push(
      `${audit.noTranslateDrift.length} no-translate key(s) differ from the source: ${preview}${suffix}`
      + ' — run `champollion sync` to restore them verbatim',
    );
  }

  return { errors, warnings, sourceKeyCount, targetKeyCount };
}

/**
 * Print the final verification summary line and return the counts.
 *
 * @param {number} totalErrors
 * @param {number} totalWarnings
 * @returns {{ errors: number, warnings: number }}
 */
function printSummary(totalErrors, totalWarnings) {
  if (totalErrors === 0 && totalWarnings === 0) {
    output.ok('Verification passed — all locales look good.');
  } else if (totalErrors === 0) {
    output.ok(`Verification passed with ${totalWarnings} warning(s).`);
  } else {
    output.error(`Verification: ${totalErrors} error(s), ${totalWarnings} warning(s).`);
  }
  return { errors: totalErrors, warnings: totalWarnings };
}

/**
 * Verify all target locale files against the source.
 *
 * Re-reads files from disk (not memory) to confirm what was actually
 * written. Returns a summary of errors and warnings for the caller.
 *
 * @param {object} config - Resolved config from resolveConfig()
 * @param {string} cwd - Working directory
 * @param {object} [options]
 * @param {import('./no-translate.js').NoTranslateMatcher} [options.noTranslate] -
 *   Compiled matcher. Pass the SAME instance the sync used so verification
 *   judges the files by the rules that wrote them. Derived from config when
 *   omitted (the standalone `verify` command).
 * @returns {Promise<{ errors: number, warnings: number }>}
 */
async function verifyLocales(config, cwd, options = {}) {
  const noTranslate = options.noTranslate || compileNoTranslate(config);

  // TM-confirmed echoes are settled facts, not findings — the same
  // suppression the sync diff and `integrity` apply, so the three tools
  // cannot disagree about a healthy file. Read-only TM load.
  const tm = loadTM(cwd);
  const tmKeys = new Map();
  try {
    for (const [, pc] of resolvePairs(config)) tmKeys.set(pc.target, tmMethodKey(pc));
  } catch { /* invalid pair config — sync reports it; verify still runs */ }
  const echoPredicateFor = (locale) => {
    const tmKey = tmKeys.get(locale);
    return tmKey
      ? (key, sourceValue) => lookupTM(tm, sourceValue, locale, tmKey) === sourceValue
      : null;
  };

  // Docusaurus uses a directory-per-locale layout (i18n/<locale>/code.json,
  // …/<plugin>/*.json) — NOT a flat i18n/<locale>.json file. The flat path
  // below would look for i18n/en.json, never find it, and exit 0 — a
  // false-green gate. Route Docusaurus projects to their own verifier.
  if (config.format === 'docusaurus') {
    return verifyDocusaurusLocales(config, cwd, noTranslate, echoPredicateFor);
  }

  const format = config.format !== 'auto'
    ? config.format
    : detectFormatFromDir(config.localesDir);
  const ext = getExtension(format);
  const sourcePath = path.join(config.localesDir, `${config.inputLocale}${ext}`);

  if (!fs.existsSync(sourcePath)) {
    // No source file — can't verify. This shouldn't happen after a sync,
    // but don't crash the user's workflow over it.
    output.warn('[VERIFY] Source locale file not found — skipping verification.');
    return { errors: 0, warnings: 0 };
  }

  const sourceRaw = readLocaleFile(sourcePath, format);
  const sourceFlat = format === 'json' ? flattenKeys(sourceRaw) : sourceRaw;
  const sourceKeyCount = Object.keys(sourceFlat).length;

  // Detect target locales from directory listing
  const files = fs.readdirSync(config.localesDir);
  const targetLocales = files
    .filter(f => f.endsWith(ext) && !f.startsWith(config.inputLocale))
    .map(f => f.replace(ext, ''));

  // Configured locales whose file doesn't exist at all. These are invisible
  // to the directory listing above, so without this check a CI `verify` gate
  // passed with zero translation done. Only enforced when the source has
  // keys to translate — an empty source promises nothing.
  const missingTargets = sourceKeyCount === 0 ? [] :
    [...configuredTargetLocales(config)]
      .filter(l => !fs.existsSync(path.join(config.localesDir, `${l}${ext}`)))
      .sort();

  if (targetLocales.length === 0 && missingTargets.length === 0) {
    return { errors: 0, warnings: 0 };
  }

  output.raw('\n  ── Post-Sync Verification ───────────────────────────────\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const locale of missingTargets) {
    output.error(`[VERIFY] ${locale}: locale file missing (${locale}${ext}) — configured target has no translations. Run \`champollion sync\` to create it.`);
    totalErrors++;
  }

  for (const locale of targetLocales) {
    const targetPath = path.join(config.localesDir, `${locale}${ext}`);
    if (!fs.existsSync(targetPath)) continue;

    const targetRaw = readLocaleFile(targetPath, format);
    const targetFlat = format === 'json' ? flattenKeys(targetRaw) : targetRaw;

    output.raw(`  ── ${locale} ──────────────────────────────────────`);

    const { errors, warnings, targetKeyCount } = auditTranslations(sourceFlat, targetFlat, locale, config, noTranslate, echoPredicateFor(locale));

    if (!errors.some(e => e.includes('missing key'))) {
      output.raw(`  [OK] ${targetKeyCount}/${sourceKeyCount} keys present`);
    }

    for (const err of errors) {
      output.error(`[VERIFY] ${locale}: ${err}`);
      totalErrors++;
    }
    for (const warn of warnings) {
      output.warn(`[VERIFY] ${locale}: ${warn}`);
      totalWarnings++;
    }

    if (errors.length === 0 && warnings.length === 0) {
      output.raw('  [OK] All checks passed');
    }
    output.raw('');
  }

  return printSummary(totalErrors, totalWarnings);
}

/**
 * Recursively collect all .json files under a directory.
 *
 * @param {string} dir - Directory to walk
 * @returns {string[]} Absolute paths to .json files, sorted
 */
function walkJSONFiles(dir) {
  const files = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
  }
  walk(dir);
  return files.sort();
}

/**
 * Verify a Docusaurus i18n tree (directory-per-locale, {message} JSON files).
 *
 * Compares the UI-string JSON files under i18n/<locale>/ against the source
 * locale's files (i18n/<inputLocale>/), running the SAME checks as the flat
 * path. Markdown content (docs/blog mirrored under each locale) has no
 * key-parity model and is not key-checked here — this gate is for the
 * {message,description} UI strings that Phase 1 of the Docusaurus sync writes.
 *
 * @param {object} config - Resolved config (format === 'docusaurus')
 * @param {string} cwd - Working directory
 * @param {import('./no-translate.js').NoTranslateMatcher} [noTranslate] - Compiled matcher
 * @returns {Promise<{ errors: number, warnings: number }>}
 */
async function verifyDocusaurusLocales(config, cwd, noTranslate = null, echoPredicateFor = () => null) {
  const sourceLocaleDir = path.join(config.localesDir, config.inputLocale);

  if (!fs.existsSync(sourceLocaleDir)) {
    output.warn(`[VERIFY] Docusaurus source locale dir not found (${sourceLocaleDir}) — skipping verification.`);
    return { errors: 0, warnings: 0 };
  }

  const sourceFiles = walkJSONFiles(sourceLocaleDir);
  if (sourceFiles.length === 0) {
    output.warn('[VERIFY] No source JSON strings found — skipping verification.');
    return { errors: 0, warnings: 0 };
  }

  // Target locales = subdirectories of i18n/ other than the source locale.
  const targetLocales = fs.readdirSync(config.localesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== config.inputLocale && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort();

  // Same false-green hole as the flat path: a configured locale with no
  // i18n/<locale>/ directory is invisible to the listing above. Fail loud.
  const missingTargets = [...configuredTargetLocales(config)]
    .filter(l => !fs.existsSync(path.join(config.localesDir, l)))
    .sort();

  if (targetLocales.length === 0 && missingTargets.length === 0) {
    return { errors: 0, warnings: 0 };
  }

  output.raw('\n  ── Post-Sync Verification (Docusaurus) ──────────────────\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const locale of missingTargets) {
    output.error(`[VERIFY] ${locale}: locale directory missing (${path.join(path.basename(config.localesDir), locale)}/) — configured target has no translations. Run \`champollion sync\` to create it.`);
    totalErrors++;
  }

  for (const locale of targetLocales) {
    output.raw(`  ── ${locale} ──────────────────────────────────────`);

    const localeErrors = [];
    const localeWarnings = [];

    for (const sourceFile of sourceFiles) {
      const relPath = path.relative(sourceLocaleDir, sourceFile);
      const targetFile = path.join(config.localesDir, locale, relPath);

      let sourceFlat;
      try {
        sourceFlat = extractDocusaurusMessages(JSON.parse(fs.readFileSync(sourceFile, 'utf-8')));
      } catch (err) {
        // A malformed SOURCE file is a setup problem, not a translation gap.
        localeWarnings.push(`${relPath}: unreadable source JSON (${err.message})`);
        continue;
      }
      if (Object.keys(sourceFlat).length === 0) continue; // nothing to verify in this file

      let targetFlat = {};
      if (fs.existsSync(targetFile)) {
        try {
          targetFlat = extractDocusaurusMessages(JSON.parse(fs.readFileSync(targetFile, 'utf-8')));
        } catch (err) {
          localeErrors.push(`${relPath}: unreadable target JSON (${err.message})`);
          continue;
        }
      }

      const { errors, warnings } = auditTranslations(sourceFlat, targetFlat, locale, config, noTranslate, echoPredicateFor(locale));
      for (const e of errors) localeErrors.push(`${relPath}: ${e}`);
      for (const w of warnings) localeWarnings.push(`${relPath}: ${w}`);
    }

    for (const err of localeErrors) {
      output.error(`[VERIFY] ${locale}: ${err}`);
      totalErrors++;
    }
    for (const warn of localeWarnings) {
      output.warn(`[VERIFY] ${locale}: ${warn}`);
      totalWarnings++;
    }
    if (localeErrors.length === 0 && localeWarnings.length === 0) {
      output.raw('  [OK] All checks passed');
    }
    output.raw('');
  }

  return printSummary(totalErrors, totalWarnings);
}

export { verifyLocales, auditTranslations };
