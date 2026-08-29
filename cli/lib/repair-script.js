/**
 * repair-script.js — undo script conversions that should never have happened.
 *
 * THE DAMAGE THIS REPAIRS: before 0.3.0, script conversion was unconditional,
 * so every tlh / x-elvish-s / x-kryptonian project had its translations
 * rewritten into Private Use Area codepoints — scripts that are NOT in
 * Unicode and render as nothing without a purpose-built font. A project
 * shipping Latin-transliteration fonts (the common case) displayed blank
 * strings. Worse, the converters silently passed through letters they could
 * not map, leaving values that are half PUA and half Latin.
 *
 * WHAT IT DOES: for every configured target locale whose converter emits PUA
 * and whose script resolution says conversion is OFF, scan the locale files
 * for PUA codepoints and reverse them back to the working script
 * (romanization) via the converter's own table. Values without PUA are never
 * touched.
 *
 * WHAT IT DOES NOT TOUCH:
 *   - The Translation Memory — it stores PRE-conversion values, so it was
 *     never damaged (verified: translate-pair.js stores before sync converts).
 *   - The hash manifest — it hashes SOURCE values, so a repair never
 *     triggers re-translation.
 *   - Locales whose conversion is opted ON (`script: "Piqd"` etc.) — there
 *     the PUA is the deliverable; the scan reports them as skipped.
 *   - Real-Unicode conversions (crk Syllabics, sr Cyrillic) — those render
 *     everywhere, and "reversing" them would destroy legitimate content.
 *
 * REVERSAL FIDELITY: pIqaD reverses exactly (the map is injective up to the
 * straight/curly apostrophe, both of which restore as '). Tengwar, Cree
 * syllabics and Kryptonian normalise case on the way in, so their reversals
 * are case-lossy — reported per file, never silent. Codepoints from a PUA
 * block the converter does not own are left in place and reported as
 * unreversible (they are damage from something else, and inventing a reading
 * for them would be fabrication).
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from './config.js';
import { resolvePairs } from './pairs.js';
import { getLanguageCard } from './registers.js';
import {
  SCRIPT_CONVERTERS, reverseScript, isPrivateUse, converterKeyForLocale, getConverterInfo,
} from './scripts.js';
import {
  readLocaleFile, writeLocaleFile, detectFormatFromDir, detectYAMLStyle, getExtension,
} from './format.js';
import { discoverDocusaurusJSONFiles } from './docusaurus-sync.js';
import { visualize } from './integrity.js';
import { output } from './output.js';

/** Does this string contain any Private Use Area codepoint? */
function hasPua(value) {
  if (typeof value !== 'string') return false;
  for (const ch of value) {
    if (isPrivateUse(ch.codePointAt(0))) return true;
  }
  return false;
}

/**
 * Repair every PUA-bearing string in a nested JSON structure, in place.
 *
 * Generic deep walk rather than Docusaurus-message surgery: only strings that
 * actually contain PUA are touched, so descriptions, URLs, and every other
 * field pass through byte-identical whatever the file's shape.
 *
 * @param {*} node - Parsed JSON value (object/array/primitive)
 * @param {string} converterKey - Converter whose table reverses the PUA
 * @param {object} stats - Mutated: { repaired, caseLossy, unreversed:Set, samples:[] }
 * @returns {*} The repaired node
 */
function repairNode(node, converterKey, stats) {
  if (typeof node === 'string') {
    if (!hasPua(node)) return node;
    const { reversed, caseLossy, unreversed } = reverseScript(node, converterKey);
    stats.repaired++;
    if (caseLossy) stats.caseLossy++;
    for (const ch of unreversed) stats.unreversed.add(ch);
    if (stats.samples.length < 3) {
      stats.samples.push({ before: node, after: reversed });
    }
    return reversed;
  }
  if (Array.isArray(node)) {
    return node.map(v => repairNode(v, converterKey, stats));
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      node[k] = repairNode(node[k], converterKey, stats);
    }
    return node;
  }
  return node;
}

/**
 * Run the repair across a project's configured locales.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root
 * @param {object} options.cliArgs - Parsed CLI args (dry, locale, json)
 * @returns {{ locales: Array, totals: object, exitCode: number }}
 */
function runRepairScript({ cwd = process.cwd(), cliArgs = {} } = {}) {
  const config = resolveConfig(cliArgs, cwd);
  const dry = !!cliArgs.dry;
  const localeFilter = cliArgs.locale || null;

  const pairs = resolvePairs(config);
  const report = [];
  const totals = { filesScanned: 0, valuesRepaired: 0, caseLossy: 0, unreversedCodepoints: 0 };
  let hadWriteFailure = false;

  for (const [, pairConfig] of pairs) {
    const locale = pairConfig.target;
    if (localeFilter && locale !== localeFilter) continue;

    const card = getLanguageCard(locale);
    const converterKey = converterKeyForLocale(locale, card);
    if (!converterKey) continue;
    const conv = SCRIPT_CONVERTERS[converterKey];
    // Real-Unicode converters (crk, sr) never emit PUA — nothing to repair.
    if (!conv.puaRange) continue;

    const resolution = pairConfig.scriptResolution || {};
    if (resolution.converterKey) {
      report.push({
        locale,
        converter: getConverterInfo(converterKey).to,
        skipped: 'conversion enabled — PUA is the configured output for this locale',
        files: [],
      });
      continue;
    }

    // Discover this locale's files. Docusaurus keeps a directory per locale;
    // everything else is one flat file per locale.
    const files = [];
    let flatFormat = null;
    if (config.format === 'docusaurus') {
      files.push(...discoverDocusaurusJSONFiles(path.join(config.localesDir, locale)));
    } else {
      flatFormat = config.format !== 'auto' ? config.format : detectFormatFromDir(config.localesDir);
      const filePath = path.join(config.localesDir, `${locale}${getExtension(flatFormat)}`);
      if (fs.existsSync(filePath)) files.push(filePath);
    }

    const localeReport = {
      locale,
      converter: getConverterInfo(converterKey).to,
      files: [],
    };

    for (const filePath of files) {
      totals.filesScanned++;
      const stats = { repaired: 0, caseLossy: 0, unreversed: new Set(), samples: [] };

      try {
        if (config.format === 'docusaurus' || flatFormat === 'json') {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const repaired = repairNode(parsed, converterKey, stats);
          if (stats.repaired > 0 && !dry) {
            fs.writeFileSync(filePath, JSON.stringify(repaired, null, 2) + '\n', 'utf-8');
          }
        } else {
          // TOML/YAML: readLocaleFile returns a flat map; repair values and
          // write back through the format-preserving serializer.
          const flat = readLocaleFile(filePath, flatFormat);
          const yamlStyle = flatFormat === 'yaml'
            ? detectYAMLStyle(fs.readFileSync(filePath, 'utf-8'))
            : null;
          for (const [k, v] of Object.entries(flat)) {
            flat[k] = repairNode(v, converterKey, stats);
          }
          if (stats.repaired > 0 && !dry) {
            writeLocaleFile(filePath, flat, flatFormat, flat, yamlStyle);
          }
        }
      } catch (err) {
        hadWriteFailure = true;
        localeReport.files.push({ file: filePath, error: err.message });
        output.error(`[repair-script] ${filePath}: ${err.message}`);
        continue;
      }

      if (stats.repaired > 0 || stats.unreversed.size > 0) {
        totals.valuesRepaired += stats.repaired;
        totals.caseLossy += stats.caseLossy;
        totals.unreversedCodepoints += stats.unreversed.size;
        localeReport.files.push({
          file: path.relative(cwd, filePath),
          repaired: stats.repaired,
          caseLossy: stats.caseLossy,
          unreversedCodepoints: [...stats.unreversed].map(
            ch => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'),
          ),
          samples: stats.samples,
        });
      }
    }

    if (localeReport.files.length > 0 || files.length > 0) {
      report.push(localeReport);
    }
  }

  // Unreversible PUA means the file STILL cannot render — the repair is
  // incomplete and the caller must know. Write failures likewise.
  const exitCode = (hadWriteFailure || totals.unreversedCodepoints > 0) ? 1 : 0;
  return { locales: report, totals, exitCode, dry };
}

/**
 * Print the human-readable repair report.
 *
 * @param {{locales: Array, totals: object, dry: boolean}} result
 */
function printRepairReport(result) {
  const { locales, totals, dry } = result;
  const verb = dry ? 'would repair' : 'repaired';

  output.raw('\n  champollion repair-script — reverse unintended script conversion\n');

  if (locales.length === 0) {
    output.raw('  No configured locale uses a PUA script converter — nothing to scan.');
  }

  for (const loc of locales) {
    if (loc.skipped) {
      output.raw(`  ── ${loc.locale} (${loc.converter}) — skipped: ${loc.skipped}`);
      continue;
    }
    if (loc.files.length === 0) {
      output.raw(`  ── ${loc.locale} (${loc.converter}) — clean, no PUA found`);
      continue;
    }
    output.raw(`  ── ${loc.locale} (${loc.converter}) ─────────────────────`);
    for (const f of loc.files) {
      if (f.error) {
        output.error(`    ${f.file}: ${f.error}`);
        continue;
      }
      const lossy = f.caseLossy > 0 ? ` (${f.caseLossy} case-lossy — reversal cannot recover capitalisation; review)` : '';
      output.raw(`    ${f.file}: ${verb} ${f.repaired} value(s)${lossy}`);
      for (const s of f.samples) {
        output.raw(`      ${visualize(s.before)}`);
        output.raw(`      → ${visualize(s.after)}`);
      }
      if (f.unreversedCodepoints.length > 0) {
        output.warn(`    ${f.file}: ${f.unreversedCodepoints.length} PUA codepoint(s) not in this converter's table, left in place: ${f.unreversedCodepoints.join(', ')}`);
      }
    }
  }

  output.raw('');
  const summary = `${totals.valuesRepaired} value(s) ${verb} across ${totals.filesScanned} file(s); ${totals.caseLossy} case-lossy; ${totals.unreversedCodepoints} unreversible codepoint(s).`;
  if (totals.unreversedCodepoints > 0) output.error(`  ${summary}`);
  else output.raw(`  ${summary}`);
  if (dry && totals.valuesRepaired > 0) {
    output.raw('  Dry run — nothing was written. Re-run without --dry to apply.');
  }
  output.raw('');
}

export { runRepairScript, printRepairReport, hasPua };
