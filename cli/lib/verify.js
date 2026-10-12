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
 * DAMAGE LEAVES THE CACHE. A value verify finds damaged — ICU structure,
 * placeholders, hollowed — that the Translation Memory proves the pipeline
 * wrote is evicted from the TM (lib/tm-evict.js), so the next sync (or the
 * `--force-keys` the report names) re-translates it instead of re-serving
 * the damage for free. Hand-written values have no equal TM entry and are
 * never touched; the files themselves are never modified here.
 *
 * SCOPE. `options.locales` limits verification to the locales a run touched
 * — `sync --pair en:fr` verifies French only, not every locale on disk.
 *
 * OUTPUT: The decorative section headers and per-check [OK] lines go through
 * output.raw(), which is suppressed in --json mode. The real findings go
 * through output.ok/warn/error, which json-encode themselves — so
 * `champollion sync --json | jq` stays parseable while a human still gets
 * the readable report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractDocusaurusMessages } from './format.js';
import {
  discoverLocaleLayout, loadSourceUnits, expectedForTarget, readLocaleFlat, walkFiles, NS_SEPARATOR, lockKey,
} from './locale-layout.js';
import { readLock } from './hash.js';
import { LockState, localeHealth, decodeForm, decodeWritten, valueHash } from './locale-state.js';
import { getMethod } from './translate.js';
import { originKey } from './plurals.js';
import { auditLocalePair, auditARBDocument } from './integrity.js';
import { placeholderChanges, placeholderSentenceBreaks } from './placeholders.js';
import { NON_LATIN_LOCALES, isLatinOnly, hasForeignFullwidthLatin, isProtectedTermValue, SharedOutputIndex, sharedOutputItems, droppedTerminalMarks, describeDroppedMarks, contentGateFault } from './validate.js';
import { discoverContentFiles, getTargetContentPath, parseContentFile, DEFAULT_TRANSLATABLE_FIELDS } from './content.js';
import { translatableBlockSources } from './content-estimate.js';
import { compileNoTranslate } from './no-translate.js';
import { resolvePairs, filterPairGraph } from './pairs.js';
import { loadTM, saveTM, isTMDirty, adoptLegacyCoachingKeys } from './tm.js';
import { tmKeysForPair, tmHoldsValue } from './fallback.js';
import { tmTextFor, tmProofTextsFor, createTMEvictor } from './tm-evict.js';
import { parsePairKey } from './pairs.js';
import { pluralGaps, pluralCategoryUse, describeCategories, parseMessage, hasBranching, CLDR_CATEGORIES } from './icu-structure.js';
import { pluralCategoriesFor, pluralExtraKeys } from './plurals.js';
import { poPluralFindings, poPluralSlots } from './po.js';
import { output } from './output.js';
import { isPendingLock } from './content-refusals.js';

/**
 * The target locales a `--pair` value names (e.g. "en:fr,en:de"), resolved
 * against the project's pair graph — fails loud on an unknown pair, exactly
 * like `sync --pair`.
 *
 * @param {object} config - Resolved config
 * @param {string} pairFlag - The raw --pair value
 * @param {{ cwd?: string }} [options] - The project directory (coaching files)
 * @returns {string[]} Target locale codes
 */
function localesForPairFlag(config, pairFlag, { cwd = process.cwd() } = {}) {
  return [...filterPairGraph(pairFlag, resolvePairs(config, { cwd })).values()].map(p => p.target);
}

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
 * How verify names a placeholder finding, per syntax, in report order. The
 * syntax comes from the check that found it: checkICUStructure tags its
 * findings 'icu' or 'printf' (lib/icu-structure.js), and lib/placeholders.js
 * placeholderChanges names a token's syntax by its form ("{{name}}" i18next,
 * "<b>" a tag, "{name}" single-brace outside an ICU message).
 */
const PLACEHOLDER_SYNTAX_LABELS = {
  icu: 'ICU structure error(s)',
  printf: 'printf/python-format placeholder mismatch(es)',
  i18next: 'i18next {{…}} placeholder mismatch(es)',
  brace: '{…} placeholder mismatch(es)',
  markup: 'tag placeholder mismatch(es)',
  'sentence-break': 'sentence break(s) inserted beside a placeholder',
};

/**
 * One locale file's placeholder and ICU-structure findings, each named by
 * the syntax involved — one entry per (key, syntax), with what happened:
 *   { key: 'Hi %(name)s', syntax: 'printf', issues: ['printf placeholder %(name)s is missing'] }
 *   { key: 'greeting', syntax: 'i18next', issues: ['placeholder {{name}} was changed to {{nom}}'] }
 *
 * The token findings follow lib/placeholders.js placeholderChanges — the
 * rule the sync quality gate refuses by, so sync never writes what verify
 * flags (Round 12).
 *
 * @param {object} audit - auditLocalePair() result
 * @returns {Array<{ key: string, syntax: 'icu'|'printf'|'i18next'|'brace'|'markup', issues: string[] }>}
 *   (auditTranslations adds 'sentence-break' findings: lib/placeholders.js placeholderSentenceBreaks)
 */
function placeholderFindings(audit) {
  const byKey = new Map();
  const add = (syntax, key, issue) => {
    const id = `${syntax}\u0000${key}`;
    if (!byKey.has(id)) byKey.set(id, { key, syntax, issues: [] });
    byKey.get(id).issues.push(issue);
  };
  for (const i of audit.icuIssues || []) {
    i.issues.forEach((issue, n) => add(i.syntaxes?.[n] || 'icu', i.key, issue));
  }
  // The same rule the sync gate refuses by (lib/placeholders.js).
  const markupKeys = new Set((audit.markupIssues || []).map(m => m.key));
  for (const p of audit.placeholderIssues || []) {
    for (const c of placeholderChanges(p.sourceVal, p.targetVal, { markupReported: markupKeys.has(p.key) })) {
      add(c.syntax, p.key, c.issue);
    }
  }
  return [...byKey.values()];
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
 * @param {Function} [isConfirmedEcho] - (key, sourceValue) => true when the TM
 *   settled an identical value as correct
 * @param {{ fixFor?: (keys: string[]) => string }} [options] - fixFor: the
 *   command that re-translates these keys (the caller knows the pair and the
 *   namespace); default `champollion sync --redo keys:<keys>`
 * @returns {{ errors: string[], warnings: string[], sourceKeyCount: number, targetKeyCount: number,
 *   damaged: Array<{ key: string, value: string, sourceValue: string }>,
 *   placeholders: Array<{ key: string, syntax: string, issues: string[] }> }} `damaged`: values
 *   the quality gate refuses today (ICU structure, placeholders, hollowed) — the
 *   caller evicts the TM entries that produced them. `placeholders`: the
 *   placeholder/ICU findings by syntax (placeholderFindings), for --json
 */
function auditTranslations(sourceFlat, targetFlat, locale, config, noTranslate = null, isConfirmedEcho = null,
  { fixFor = (keys, opts) => redoCommand(keys, opts), pluralSlots = null, fillCommand = 'champollion sync' } = {}) {
  // A damaged value already on disk reads as settled to sync: a plain sync
  // keeps it. Every damage finding therefore names the command that repairs
  // it (synthetic Django/i18next personas, 2026-10: verify reported a
  // placeholder mismatch and stopped there).
  const fix = (items) => ` — fix: \`${fixFor([...new Set(items.map(i => i.key))])}\``;
  const errors = [];
  const warnings = [];
  const sourceKeyCount = Object.keys(sourceFlat).length;
  const targetKeyCount = Object.keys(targetFlat).length;

  // 1. Key parity — are all source keys present in target?
  const missingKeys = Object.keys(sourceFlat).filter(k => !(k in targetFlat));
  // The repair is named, as for every other finding (Round 9, i18next
  // persona: a missing plural form `count_many` said only "missing key(s)").
  // A few keys: the redo that asks for exactly them — it works even for a key
  // refused before and held back. Many: a sync of the pair fills every
  // missing key.
  if (missingKeys.length > 0) {
    const preview = missingKeys.slice(0, 5).join(', ');
    const suffix = missingKeys.length > 5 ? '...' : '';
    const repair = missingKeys.length <= 5
      ? `\`${fixFor(missingKeys)}\``
      : `\`${fillCommand}\` (a sync fills every missing key)`;
    errors.push(`${missingKeys.length} missing key(s): ${preview}${suffix} — fix: ${repair}`);
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

  // 4. Script compliance — non-Latin locales must not hold Latin-only text.
  // Letters are classified by Unicode SCRIPT, not by byte: an ASCII test let
  // fullwidth Latin ("Ｂｏｏｋ") and accented Latin ("Bóók") through in a
  // Russian catalog (Round 4, Django persona). And fullwidth Latin letters
  // are wrong in any value outside CJK typography.
  const isNonLatin = NON_LATIN_LOCALES.has(locale) || NON_LATIN_LOCALES.has(locale.split('-')[0]);
  const fullwidthKeys = Object.keys(targetFlat).filter(k => {
    const val = targetFlat[k];
    if (typeof val !== 'string' || val === sourceFlat[k]) return false;
    if (noTranslate && noTranslate.matches(k, sourceFlat[k])) return false;
    if (isProtectedTermValue(val, config.protectedTerms)) return false;
    return hasForeignFullwidthLatin(val, locale);
  });
  if (fullwidthKeys.length > 0) {
    errors.push(`${fullwidthKeys.length} wrong script (fullwidth Latin letters — English in disguise): `
      + `${fullwidthKeys.slice(0, 3).join(', ')}${fullwidthKeys.length > 3 ? '...' : ''}${fix(fullwidthKeys.map(key => ({ key })))}`);
  }
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
      // Names kept as written: declared ones (config.protectedTerms), and
      // ones the quality gate settled as names (a TM-stamped echo — the
      // model kept it in Latin script after being asked to translate it).
      // The gate already accepted these; verify must agree, or a clean sync
      // fails its own verification (curtisforbes.com had to run every sync
      // with --no-verify for this).
      if (isProtectedTermValue(val, config.protectedTerms)) return false;
      if (isConfirmedEcho && val === sourceFlat[k] && isConfirmedEcho(k, sourceFlat[k])) return false;
      if (fullwidthKeys.includes(k)) return false; // reported above
      return isLatinOnly(val, locale);
    });
    if (asciiOnlyKeys.length > 0) {
      const preview = asciiOnlyKeys.slice(0, 3).join(', ');
      const suffix = asciiOnlyKeys.length > 3 ? '...' : '';
      errors.push(`${asciiOnlyKeys.length} wrong script (Latin letters only, expected ${locale}'s script): ${preview}${suffix}`);
    }
  }

  // 5. Placeholders and ICU structure, named by the syntax involved — run the
  // integrity audit for placeholder + encoding checks. ICU structure damage
  // (a translated variable, keyword or selector, a lost #) and lost printf
  // conversions come from the gate's own check (lib/icu-structure.js); the
  // quality gate refuses these now, so this reports the ones written before
  // it did (they read as settled to sync). One line per syntax: a gettext
  // catalog's lost %(name)s used to be called an "ICU structure error" in a
  // catalog with no ICU in it (Round 12, Django persona), and an i18next
  // {{name}} loss a bare "placeholder mismatch".
  const audit = auditLocalePair(sourceFlat, targetFlat, locale, { noTranslate, isConfirmedEcho, pluralSlots });
  const placeholders = placeholderFindings(audit);
  // A sentence break inserted right beside a placeholder where the source
  // has none ("… sina. {time}." for "Take this medicine at {time}.") — the
  // rule the sync gate refuses by (lib/placeholders.js), so a value written
  // before the gate checked it is flagged here (Round 14, hospital persona).
  // Keys the gate never sees are left out: no-translate keys and declared
  // names (protectedTerms).
  for (const [k, src] of Object.entries(sourceFlat)) {
    const tgt = targetFlat[k];
    if (typeof src !== 'string' || typeof tgt !== 'string') continue;
    if (noTranslate && noTranslate.matches(k, src)) continue;
    if (isProtectedTermValue(tgt, config.protectedTerms)) continue;
    const breaks = placeholderSentenceBreaks(src, tgt);
    if (breaks.length > 0) placeholders.push({ key: k, syntax: 'sentence-break', issues: breaks.map(b => b.issue) });
  }
  for (const syntax of Object.keys(PLACEHOLDER_SYNTAX_LABELS)) {
    const found = placeholders.filter(p => p.syntax === syntax);
    if (found.length === 0) continue;
    const preview = found.slice(0, 3).map(p => `${p.key} (${p.issues[0]})`).join(', ');
    const suffix = found.length > 3 ? '...' : '';
    errors.push(`${found.length} ${PLACEHOLDER_SYNTAX_LABELS[syntax]}: ${preview}${suffix}${fix(found)}`);
  }

  // 6. Encoding issues (warning)
  if (audit.encodingIssues.length > 0) {
    const preview = audit.encodingIssues.slice(0, 3).map(i => i.key).join(', ');
    const suffix = audit.encodingIssues.length > 3 ? '...' : '';
    warnings.push(`${audit.encodingIssues.length} encoding issue(s): ${preview}${suffix}`);
  }

  // 7. Source echo — untranslated copies (warning, not error — some are legitimate)
  // A declared name (config.protectedTerms) is supposed to equal the source.
  const copies = audit.copies.filter(k => !isProtectedTermValue(targetFlat[k], config.protectedTerms));
  if (copies.length > 0) {
    const preview = copies.slice(0, 5).join(', ');
    const suffix = copies.length > 5 ? '...' : '';
    warnings.push(`${copies.length} source echo(es): ${preview}${suffix}`);
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
      + fix(audit.hollowedValues),
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

  // 10. (ICU structure damage is reported with the placeholders, by syntax — 5.)

  // 10b. Markup damage — a tag opened, closed or nested differently from the
  // source (a lost `</strong>` used to pass: tag names were compared as a set).
  if (audit.markupIssues && audit.markupIssues.length > 0) {
    const preview = audit.markupIssues.slice(0, 3).map(i => `${i.key} (${i.issues[0]})`).join(', ');
    const suffix = audit.markupIssues.length > 3 ? '...' : '';
    errors.push(`${audit.markupIssues.length} markup error(s): ${preview}${suffix}${fix(audit.markupIssues)}`);
  }

  // 11. Plural messages without a form the target language uses for
  // ordinary counts (Russian few/many): the runtime shows the "other" form
  // for 2, 3, 4 … Not damage — the message is valid ICU — but wrong
  // grammar nobody asked for (Round 3, Django persona). A gettext catalog
  // reads back with every msgstr[] filled; its repeated forms are found
  // from the catalog's own marker (poPluralFindings, in verifyLocales).
  // --fresh in the fix: the cache holds the same incomplete answer.
  const gapKeys = [];
  for (const [k, src] of Object.entries(sourceFlat)) {
    const tgt = targetFlat[k];
    if (typeof src !== 'string' || typeof tgt !== 'string' || !src.includes('{') || tgt === src) continue;
    const gaps = pluralGaps(src, tgt, locale, pluralSlots).filter(g => g.everyday.length > 0);
    if (gaps.length > 0) gapKeys.push({ key: k, missing: [...new Set(gaps.flatMap(g => g.everyday))] });
  }
  if (gapKeys.length > 0) {
    const preview = gapKeys.slice(0, 3).map(g => `${g.key} (${g.missing.join(', ')})`).join(', ');
    const suffix = gapKeys.length > 3 ? '...' : '';
    warnings.push(
      `${gapKeys.length} plural message(s) without a form ${locale} uses for ordinary counts: ${preview}${suffix}`
      + ` — the "other" form is shown for those counts; write the missing branches, or ask the model again — fix: \`${fixFor([...new Set(gapKeys.map(i => i.key))], { fresh: true })}\``,
    );
  }

  // 12. A question or exclamation that lost its closing "?" / "!" (Round 6,
  // hospital persona: "Where does it hurt?" written as a statement). A
  // warning: some languages mark a question with a particle instead.
  const dropped = droppedTerminalMarks(Object.keys(targetFlat)
    .filter(k => typeof sourceFlat[k] === 'string' && typeof targetFlat[k] === 'string')
    .filter(k => !(noTranslate && noTranslate.matches(k, sourceFlat[k])) && !isProtectedTermValue(targetFlat[k], config.protectedTerms))
    .map(k => [k, sourceFlat[k], targetFlat[k]]));
  if (dropped.length > 0) warnings.push(describeDroppedMarks(dropped, fixFor(dropped.map(f => f.key), { fresh: true })));

  // Only what was reported: a token difference placeholderFindings set aside
  // (a one-word ICU plural branch "{Brak}" read as a placeholder) is not
  // damage — evicting its cache entry would throw away a good translation.
  const reportedPlaceholderKeys = new Set(placeholders.filter(p => p.syntax !== 'sentence-break').map(p => p.key));
  const damaged = [
    ...audit.icuIssues.map(i => ({ key: i.key, value: i.actual })),
    ...(audit.markupIssues || []).map(i => ({ key: i.key, value: i.actual })),
    ...audit.placeholderIssues.filter(i => reportedPlaceholderKeys.has(i.key)).map(i => ({ key: i.key, value: i.targetVal })),
    ...audit.hollowedValues.map(h => ({ key: h.key, value: h.actual })),
    // The gate refuses these now: the cache entry that produced one is evicted like the rest.
    ...placeholders.filter(p => p.syntax === 'sentence-break').map(p => ({ key: p.key, value: targetFlat[p.key] })),
  ].map(d => ({ ...d, sourceValue: sourceFlat[d.key] }));

  return { errors, warnings, sourceKeyCount, targetKeyCount, damaged, placeholders };
}

/**
 * Make keys printable: a gettext key with a context is `msgctxt\u0004msgid`,
 * and U+0004 is invisible on a terminal — print it as "␄" (U+2404), which
 * `--force-keys` accepts back (lib/locale-layout.js keysForNamespace).
 */
function showKeys(text) {
  return String(text).replace(/\u0004/g, '\u2404');
}

/** One shell word, quoted only when it has to be (a msgid has spaces, `\,`…). */
function shellWord(word) {
  return /^[A-Za-z0-9_.:\/@%+=,-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/**
 * The command that re-translates exactly these keys — and nothing a human
 * wrote elsewhere: `--redo keys:` (lib/redo.js), scoped to the pair.
 *   - a namespaced layout names `<ns>::<key>` (one file's key; a bare key
 *     would re-queue it in every file that has it)
 *   - a comma inside a key is written `\,` (gettext msgids are sentences)
 *   - a gettext context separator is written ␄ — the way reports and the
 *     docs show it — and, when there is one, a shell comment says it can be
 *     typed as `\x04` (--redo accepts both; Round 7, Django persona: the
 *     docs said ␄, the suggested command \x04, and neither said the other
 *     works). The comment is part of the line, so the whole line still
 *     pastes into a shell.
 *
 * @param {string[]} keys
 * @param {{ pair?: string|null, ns?: string }} [scope]
 * @returns {string}
 */
function redoCommand(keys, { pair = null, ns = '', fresh = false } = {}) {
  // A gettext context separator (U+0004) is written ␄, as key lists and the
  // docs show it; the comment names the typeable `\x04`. --redo takes both.
  const names = keys.map(k => String(ns ? `${ns}${NS_SEPARATOR}${k}` : k).replace(/\u0004|\\x04/g, '\u2404').replace(/,/g, '\\,'));
  const typed = names.some(n => n.includes('\u2404')) ? '  # type ␄ as \\x04 if you cannot (both work)' : '';
  return `champollion sync${pair ? ` --pair ${shellWord(pair)}` : ''} --redo ${shellWord(`keys:${names.join(',')}`)}${fresh ? ' --fresh' : ''}${typed}`;
}

/**
 * Persist evictions, and say once whether the repair commands need --fresh.
 * They do not: every cached copy of a damaged value (under any model key)
 * has just been evicted from this project's cache, so `--redo keys:` either
 * re-translates the text or serves the cache's own, different translation
 * of it — never the damaged value again.
 */
function finishEviction(cwd, tm, evicted, result, damagedCount = 0) {
  if (evicted > 0 && tm && isTMDirty(tm)) {
    saveTM(cwd, tm);
    output.warn(
      `[TM] Evicted ${evicted} cached translation(s) that produced damaged values. A plain `
      + '`champollion sync` keeps values already on disk: run the `--redo keys:` command shown with each '
      + 'finding — no `--fresh` needed, the cache can no longer serve the damaged text.');
  } else if (damagedCount > 0) {
    output.warn(
      '[VERIFY] A plain `champollion sync` keeps values already on disk: run the `--redo keys:` command '
      + 'shown with each damage finding. No `--fresh` needed — none of the damaged values is in this '
      + 'project\'s translation cache.');
  }
  return evicted > 0 ? { ...result, tmEvicted: evicted } : result;
}

/**
 * The result of a verify that could not check anything: one error line that
 * names what it looked for and the setting that points there — and exit 1
 * through the caller (an error count), never a quiet pass.
 *
 * @returns {Promise<{ errors: number, warnings: number, nothingChecked: true }>}
 */
async function nothingVerified(cwd, config, reason) {
  let hint = '';
  try {
    // What init would configure from the files on disk (sync's own hint).
    const { describeLocaleSetupHint } = await import('./commands/init.js');
    const found = describeLocaleSetupHint(cwd, config.inputLocale);
    if (found) hint = ` ${found}`;
  } catch { /* the hint is a courtesy */ }
  output.error(`[VERIFY] Nothing verified: ${reason}${hint}`, { command: 'verify', errors: 1, warnings: 0, nothingChecked: true });
  return { errors: 1, warnings: 0, nothingChecked: true };
}

/**
 * Print the final verification summary line and return the counts.
 *
 * @param {number} totalErrors
 * @param {number} totalWarnings
 * @returns {{ errors: number, warnings: number }}
 */
function printSummary(totalErrors, totalWarnings, { strict = false, incomplete = null, scope = null } = {}) {
  // --json: the closing line keeps its level and message; it also carries
  // the counts (the per-locale records came before it as `verify` events),
  // and which locales were checked when not all of them were.
  const counts = {
    command: 'verify', errors: totalErrors, warnings: totalWarnings,
    ...(scope && { checked: scope.locales, scope: scope.afterSync ? 'synced-pairs' : 'pair-flag' }),
  };
  // A scoped check names what it looked at, and that the rest was not
  // looked at: after `sync --pair en:fr` the closing line said "intact in
  // every locale" over French alone while Spanish had a warning (Round 14,
  // i18next persona).
  const forWhere = scope ? ` for ${scope.locales.join(', ')}` : '';
  const which = scope ? ` (${describeScope(scope)})` : '';
  // Right after a sync that did not finish (keys not translated or held back,
  // a plural message without an everyday form): never an [OK] line as the
  // run's last word over an exit 2 (Round 9, Django persona: "[OK]
  // Verification passed with 1 warning(s)" closed a run that exited 2).
  if (incomplete && totalErrors === 0 && !(strict && totalWarnings > 0)) {
    output.warn(`Verification: ${scope ? `the files of ${scope.locales.join(', ')} are` : 'the files are'} structurally intact`
      + `${totalWarnings > 0 ? ` (${totalWarnings} warning(s), listed above)` : ''}${which}, `
      + `but this sync is incomplete — ${incomplete} (see the summary above).`, counts);
    return { errors: totalErrors, warnings: totalWarnings };
  }
  // What a pass means, in one line: verify checks structure, never meaning.
  // "All locales look good" read like a sign-off on a phrasebook whose
  // "Where does it hurt?" was an unrelated sentence (Round 3, hospital persona).
  if (totalErrors === 0 && totalWarnings === 0) {
    output.ok(`Verification passed${forWhere}: keys, placeholders, plurals, markup and script are intact${scope ? which : ' in every locale'} — `
      + 'the meaning is not checked; have a speaker review before relying on it.', counts);
  } else if (totalErrors === 0 && strict) {
    // Under --strict a warning fails the run (exit 1): never an [OK] line
    // over it (Round 8, Django persona: "[OK] … passed with 1 warning(s)",
    // then exit 1).
    output.error(`[FAIL] ${totalWarnings} warning(s)${forWhere} — --strict treats warnings as failures (listed above${scope ? `; ${describeScope(scope)}` : ''}).`, counts);
  } else if (totalErrors === 0) {
    output.ok(`Verification passed with ${totalWarnings} warning(s)${forWhere} — structure only; the meaning is not checked${which}.`, counts);
  } else {
    output.error(`Verification: ${totalErrors} error(s), ${totalWarnings} warning(s)${forWhere}${which}.`, counts);
  }
  return { errors: totalErrors, warnings: totalWarnings };
}

/**
 * A scoped check in words: what was synced (or asked for), so only those
 * locales were checked, and the command that checks all of them.
 *
 * @param {{ locales: string[], pairs: string[], afterSync: boolean }} scope
 * @returns {string}
 */
function describeScope(scope) {
  const pairs = scope.pairs.join(', ');
  return scope.afterSync
    ? `only ${pairs} ${scope.pairs.length > 1 ? 'were' : 'was'} synced; \`champollion verify\` checks every locale`
    : `only ${pairs}, as --pair asked; \`champollion verify\` without --pair checks every locale`;
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
 * @param {string[]|null} [options.locales] - Verify only these target
 *   locales (the pairs a `sync --pair` run touched). null = every locale.
 * @param {object|null} [options.tm] - The TM object to consult and evict
 *   from (sync passes its own); loaded from disk when omitted
 * @param {boolean} [options.afterSync] - Called by sync right after it wrote
 *   the files: the heading says "Post-Sync Verification" (else "Verification")
 * @param {string|null} [options.incomplete] - Called by a sync that did not
 *   finish (what it left undone, in words): the closing line is a warning
 *   naming it, never an [OK] over a run that exits 2
 * @param {boolean} [options.noTM] - The run did not READ the TM (--fresh /
 *   --no-tm). Its results were still cached, so damage is evicted as usual
 * @returns {Promise<{ errors: number, warnings: number, tmEvicted?: number }>} tmEvicted is
 *   present when cache entries were evicted
 */
async function verifyLocales(config, cwd, options = {}) {
  const noTranslate = options.noTranslate || compileNoTranslate(config);
  const scope = Array.isArray(options.locales) ? new Set(options.locales) : null;
  const inScope = (locale) => !scope || scope.has(locale);

  // TM-confirmed echoes are settled facts, not findings — the same
  // suppression the sync diff and `integrity` apply, so the three tools
  // cannot disagree about a healthy file.
  const tm = options.tm || loadTM(cwd);
  // Per locale: the pair's own TM key, then its fallback's — a value the
  // fallback produced is cached under the fallback (lib/fallback.js).
  const tmKeys = new Map();
  try {
    const graph = resolvePairs(config, { cwd });
    // A cache from before coaching was keyed reads as sync reads it
    // (lib/tm.js adoptLegacyCoachingKeys — once per cache).
    adoptLegacyCoachingKeys(tm, graph.values());
    for (const [, pc] of graph) tmKeys.set(pc.target, tmKeysForPair(pc));
  } catch { /* invalid pair config — sync reports it; verify still runs */ }
  // A borrowed i18next plural form is cached under its own text (tmTextFor).
  const echoPredicateFor = (locale, expansion = null) => {
    const keys = tmKeys.get(locale);
    return keys
      ? (key, sourceValue) => tmHoldsValue(tm, tmTextFor(key, sourceValue, expansion), locale, keys, sourceValue)
      : null;
  };

  // The pair each target locale belongs to, for the repair command
  // (`sync --pair en:fr --redo keys:…`).
  const pairOf = new Map();
  try {
    for (const [pairKey, pc] of resolvePairs(config, { cwd })) if (!pairOf.has(pc.target)) pairOf.set(pc.target, pairKey);
  } catch { /* invalid pair config — sync reports it */ }
  const fixFor = (locale, ns = '') => (keys, opts = {}) => redoCommand(keys, {
    pair: pairOf.get(locale) || `${config.inputLocale}:${locale}`, ns, ...opts,
  });

  // Damaged values the TM proves the pipeline wrote → evict those entries.
  const evictor = createTMEvictor(tm);
  let tmEvicted = 0;
  let damagedCount = 0;
  const evictDamaged = (locale, damaged, expansion = null) => {
    damagedCount += damaged.length;
    if (!evictor) return;
    const keys = tmKeys.get(locale) || [];
    for (const d of damaged) {
      if (typeof d.sourceValue !== 'string' || typeof d.value !== 'string') continue;
      for (const text of tmProofTextsFor(d.key, d.sourceValue, expansion)) {
        tmEvicted += evictor.evictProducing(text, locale, d.value, keys);
      }
    }
  };

  // Docusaurus uses a directory-per-locale layout (i18n/<locale>/code.json,
  // …/<plugin>/*.json) — NOT a flat i18n/<locale>.json file. The flat path
  // below would look for i18n/en.json, never find it, and exit 0 — a
  // false-green gate. Route Docusaurus projects to their own verifier.
  if (config.format === 'docusaurus') {
    const result = await verifyDocusaurusLocales(config, cwd, noTranslate, echoPredicateFor, {
      inScope, evictDamaged, fixFor, afterSync: !!options.afterSync, strict: !!options.strict, incomplete: options.incomplete || null,
      describeChecked: scope ? (locales) => checkedScope(locales, pairOf, config, !!options.afterSync) : null,
    });
    return finishEviction(cwd, tm, tmEvicted, result, damagedCount);
  }

  // Every locale's files come from the ONE layout module (flat, folder per
  // locale, or localesPattern) — the same files sync wrote.
  const rel = (p) => path.relative(cwd, p).split(path.sep).join('/') || '.';
  const setting = config.localesPattern ? '"localesPattern"' : '"localesDir"';
  if (!config.localesPattern && !fs.existsSync(config.localesDir)) {
    return nothingVerified(cwd, config,
      `the locales folder ${rel(config.localesDir)} does not exist (${setting} in champollion.config.json, default ./locales).`);
  }
  const layout = discoverLocaleLayout(config, { cwd });
  const sourceMissing = layout.namespaced
    ? layout.sourceFiles.length === 0
    : !fs.existsSync(layout.sourceFiles[0].path);
  if (sourceMissing) {
    // A verify that checked nothing is not a pass. It used to warn and exit
    // 0, so a CI gate with a mistyped localesDir stayed green while checking
    // nothing (Round 3, i18next persona).
    const where = layout.namespaced
      ? `${rel(layout.baseDir)}/${config.inputLocale}/ (no source files there)`
      : rel(layout.sourceFiles[0].path);
    return nothingVerified(cwd, config,
      `the source locale was not found — looked for ${where} (${setting} and "inputLocale": "${config.inputLocale}" in champollion.config.json).`);
  }

  const units = loadSourceUnits(layout);
  const sourceKeyCount = units.reduce((n, u) => n + Object.keys(u.flat).length, 0);

  // Target locales present on disk — EXACT code match. (The old listing
  // dropped every file that merely STARTED with the source code, so with
  // source "en" an en-GB.json was never verified.)
  const targetLocales = layout.listLocales().filter(inScope);

  // Configured locales with no file at all. These are invisible to the
  // listing above, so without this check a CI `verify` gate passed with zero
  // translation done. Only enforced when the source has keys to translate —
  // an empty source promises nothing.
  const missingTargets = sourceKeyCount === 0 ? [] :
    [...configuredTargetLocales(config)]
      .filter(inScope)
      .filter(l => !layout.filesFor(l).some(f => fs.existsSync(f.path)))
      .sort();

  if (targetLocales.length === 0 && missingTargets.length === 0) {
    // An empty source promises nothing; anything else with no target at all
    // (none on disk, none configured) is a gate that checked nothing.
    if (sourceKeyCount === 0) {
      output.info('[VERIFY] The source has no keys — nothing to verify.', { command: 'verify', errors: 0, warnings: 0 });
      return { errors: 0, warnings: 0 };
    }
    return nothingVerified(cwd, config, scope
      ? `no target locale file for ${[...scope].join(', ')} next to the source (${layout.display}).`
      : `no target locale files next to the source (${layout.display}) and no "languages" in champollion.config.json.`);
  }

  // "Post-Sync" only right after a sync: a standalone `verify` ran no sync
  // (Round 7, Django persona).
  output.raw(options.afterSync
    ? '\n  ── Post-Sync Verification ───────────────────────────────\n'
    : '\n  ── Verification ─────────────────────────────────────────\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const locale of missingTargets) {
    const expectedFiles = layout.filesFor(locale).map(f => f.rel);
    const where = layout.namespaced
      ? `expected ${expectedFiles.slice(0, 3).join(', ')}${expectedFiles.length > 3 ? `, +${expectedFiles.length - 3} more` : ''}`
      : expectedFiles[0];
    const message = `${locale}: locale file missing (${where}) — configured target has no translations. Run \`champollion sync\` to create it.`;
    output.error(`[VERIFY] ${message}`);
    totalErrors++;
    output.event('verify', {
      locale, pair: pairOf.get(locale) || `${config.inputLocale}:${locale}`, ok: false, fileMissing: true,
      expectedFiles: layout.filesFor(locale).map(f => f.rel), errors: [message], warnings: [], infos: [],
    });
  }

  // Every locale's values, for the cross-locale check after the loop.
  const valuesByLocale = new Map(targetLocales.map(l => [l, new Map()]));
  const sourceByKey = new Map();

  // The lock's per-locale record: which translations were made from an
  // older source text (lib/locale-state.js). Unreadable → sync says so loud;
  // verify skips this one check rather than fail on it.
  let lock = null;
  try { lock = readLock(cwd); } catch { lock = null; }
  const lockState = lock ? new LockState(lock.locales) : null;
  const pairConfigs = new Map();
  try {
    for (const [, pc] of resolvePairs(config, { cwd })) if (!pairConfigs.has(pc.target)) pairConfigs.set(pc.target, pc);
  } catch { /* invalid pair config — sync reports it */ }

  for (const locale of targetLocales) {
    const localeErrors = [];
    const localeWarnings = [];
    // Said, never counted: not a warning (`verify --strict` does not fail on it).
    const localeInfos = [];
    let targetKeyTotal = 0;
    let expectedKeyTotal = 0;
    // Keys the locale has that it should not (an `es` plural `count_two`),
    // and expected keys it lacks: either one means the count line is not OK.
    const extraKeyNames = [];
    let missingKeyTotal = 0;
    let anyFile = false;
    // For --json and the plural line: findings by placeholder syntax, and
    // the plural forms the locale's files are expected to have.
    const localePlaceholders = [];
    const pluralCoverage = new Map();

    for (const unit of units) {
      const file = layout.fileFor(locale, unit.ns);
      // Single-file layouts skip a vanished file (the listing raced a
      // delete). In a namespaced locale a missing namespace file is a real
      // gap — every key in it is untranslated — so it is audited as empty.
      if (!fs.existsSync(file.path) && !layout.namespaced) continue;
      anyFile = true;
      const targetFlat = fs.existsSync(file.path) ? readLocaleFlat(file) : {};
      // The keys THIS locale should have (i18next plurals → its own CLDR
      // categories), the same expectation sync translated against.
      const { flat: expected, expansion } = expectedForTarget(unit, config.inputLocale, locale);
      // A gettext catalog holds only the plural forms its header has slots for.
      const poText = file.format === 'po' && fs.existsSync(file.path) ? fs.readFileSync(file.path, 'utf-8') : null;
      const pluralSlots = poText !== null ? poPluralSlots(poText, locale) : null;
      const { errors, warnings, targetKeyCount, damaged, placeholders } = auditTranslations(
        expected, targetFlat, locale, config, noTranslate, echoPredicateFor(locale, expansion),
        { fixFor: fixFor(locale, layout.namespaced ? unit.ns : ''), pluralSlots,
          fillCommand: `champollion sync --pair ${shellWord(pairOf.get(locale) || `${config.inputLocale}:${locale}`)}` });
      evictDamaged(locale, damaged, expansion);
      const keyName = (k) => (layout.namespaced ? `${unit.ns}${NS_SEPARATOR}${k}` : k);
      for (const p of placeholders) localePlaceholders.push({ ...p, key: keyName(p.key) });
      // gettext forms sync marked as repeating `other` (the line the plural
      // warning below reads too); an unparsable catalog is readLocaleFlat's
      // error, reported above — nothing is marked in it.
      let marked = [];
      if (poText !== null) {
        try { marked = poPluralFindings(poText, { locale, filePath: file.rel }).copied; } catch { marked = []; }
      }
      addPluralCoverage(pluralCoverage, {
        unit, expected, expansion, targetFlat, locale, gettext: file.format === 'po', slots: pluralSlots, marked, keyName,
      });
      targetKeyTotal += targetKeyCount;
      expectedKeyTotal += Object.keys(expected).length;
      for (const k of Object.keys(targetFlat)) {
        if (!Object.prototype.hasOwnProperty.call(expected, k)) extraKeyNames.push(layout.namespaced ? `${unit.ns}${NS_SEPARATOR}${k}` : k);
      }
      missingKeyTotal += Object.keys(expected).filter(k => !Object.prototype.hasOwnProperty.call(targetFlat, k)).length;
      const prefix = layout.namespaced ? `${unit.ns}: ` : '';
      for (const e of errors) localeErrors.push(prefix + e);
      for (const w of warnings) localeWarnings.push(prefix + w);
      const plural = pluralFileWarnings(unit, file, targetFlat, locale, config, fixFor(locale, layout.namespaced ? unit.ns : ''), {
        expansion, localeState: lockState ? lockState.peek(locale) : null, lockKeyOf: (k) => lockKey(layout, unit.ns, k),
        pruneCommand: () => `champollion sync --pair ${shellWord(pairOf.get(locale) || `${config.inputLocale}:${locale}`)} --prune plural-extras`,
      });
      for (const w of plural.warnings) localeWarnings.push(prefix + w);
      for (const i of plural.infos) localeInfos.push(prefix + i);
      for (const [k, v] of Object.entries(targetFlat)) {
        if (typeof v === 'string') valuesByLocale.get(locale).set(layout.namespaced ? `${unit.ns}${NS_SEPARATOR}${k}` : k, v);
      }
      for (const [k, v] of Object.entries(expected)) {
        if (typeof v === 'string') sourceByKey.set(layout.namespaced ? `${unit.ns}${NS_SEPARATOR}${k}` : k, v);
      }
      // ARB: the document around the messages (@@locale, placeholder types).
      if (file.format === 'arb' && fs.existsSync(file.path)) {
        const docIssues = auditARBDocument(unit.file.path, file.path, locale);
        if (docIssues.length > 0) {
          localeErrors.push(`${prefix}${docIssues.length} ARB file error(s): ${docIssues.slice(0, 3).map(d => d.reason).join('; ')}`
            + ` — any sync that rewrites ${file.rel} repairs it (e.g. \`champollion sync --pair ${config.inputLocale}:${locale} --force\`, served from the cache)`);
        }
      }
    }
    if (!anyFile) continue;

    // Out of date: a value made from an older source text — structurally
    // intact (so a warning here; `audit` is the completeness gate that fails
    // on it, and `verify --strict` fails on any warning). A source edit whose
    // re-translation failed used to leave the old text behind with verify
    // and audit both green (Round 4, i18next persona).
    if (lockState) {
      try {
        const health = localeHealth({
          layout, units, inputLocale: config.inputLocale, code: locale, localeState: lockState.peek(locale),
          manifest: lock.source, tm, pairConfig: pairConfigs.get(locale) || null,
          helpers: { expectedForTarget, readLocaleFlat, lockKey, originKey, fallbackPrefix: config.fallbackPrefix || '[EN] ' },
        });
        if (health.stale.length > 0) {
          const pair = pairOf.get(locale) || `${config.inputLocale}:${locale}`;
          localeWarnings.push(`${health.stale.length} translation(s) out of date — made from an older source text: `
            + `${health.stale.slice(0, 5).join(', ')}${health.stale.length > 5 ? '...' : ''} — re-translate: \`champollion sync --pair ${shellWord(pair)}\``
            + (health.stale.some(k => health.held.includes(k))
              ? ` (refused before, held back until named: \`${redoCommand(health.stale.filter(k => health.held.includes(k)).slice(0, 8), { pair })}\`)`
              : ''));
        }
      } catch { /* a check that cannot run is not a finding */ }
    }

    // One text written for several different source strings — key values,
    // ICU branches and the locale's Markdown pages counted together: a model
    // repeating a memorized sentence (Round 4 and 5 personas). Sync's gate
    // refuses it; on disk it is an error, said inside this locale's block,
    // never after a "[OK]" line.
    const contentItems = contentItemsFor(config, cwd, locale);
    for (const e of sharedOutputErrors(locale, valuesByLocale.get(locale), sourceByKey, config, noTranslate, pairOf,
      contentItems, tm?._meta?.memorized?.[locale] || [])) {
      localeErrors.push(e);
    }
    // Markdown blocks and front-matter fields the quality gate refuses today
    // (a heading turned into a sentence): sync refuses them since Round 7;
    // what is on disk from before is named here, with the one repair.
    for (const w of contentGateWarnings(locale, contentItems, pairConfigs.get(locale) || { target: locale },
      pairOf.get(locale) || `${config.inputLocale}:${locale}`, config.fallbackPrefix || '[EN] ', tm)) {
      localeWarnings.push(w);
    }
    // Pages written with parts left in the source language — what the gate
    // refused twice (asked again with the reason). No marker is written into
    // the page, so the content lock says it: `pending:<hash>`.
    const pendingPages = pendingContentPages(cwd, locale);
    if (pendingPages.length > 0) {
      const pair = pairOf.get(locale) || `${config.inputLocale}:${locale}`;
      localeWarnings.push(`${pendingPages.length} page(s) with parts left in the source language, refused by the quality gate `
        + `(${pendingPages.slice(0, 3).join(', ')}${pendingPages.length > 3 ? ', …' : ''}) — sync names each part; `
        + `ask again: \`${contentRedoCommand(pendingPages[0], { pair })}\`${pendingPages.length > 1 ? ' (one per page)' : ''}`);
    }

    output.raw(`  ── ${locale} ──────────────────────────────────────`);

    // [OK] only for an exact match: "[OK] 9/8 keys present" was printed for a
    // locale holding an extra plural form, right above the warning about it
    // (Round 8, i18next persona).
    if (missingKeyTotal === 0 && extraKeyNames.length === 0) {
      output.raw(`  [OK] ${targetKeyTotal}/${expectedKeyTotal} keys present`);
    } else {
      const shown = extraKeyNames.slice(0, 5).map(k => k.replace(/\u0004/g, '\u2404')).join(', ') + (extraKeyNames.length > 5 ? ', …' : '');
      const parts = [
        missingKeyTotal > 0 && `${missingKeyTotal} missing`,
        extraKeyNames.length > 0 && `${extraKeyNames.length} extra: ${shown}`,
      ].filter(Boolean).join('; ');
      output.raw(`  ${expectedKeyTotal} expected, ${targetKeyTotal} present (${parts})`);
    }
    // The plural forms this locale is expected to have, and whether its
    // files have them — one line per kind (i18next keys, ICU messages,
    // gettext entries); none when the files carry no plurals.
    for (const line of pluralCoverageLines(locale, pluralCoverage)) output.raw(line);

    for (const err of localeErrors) {
      output.error(`[VERIFY] ${locale}: ${showKeys(err)}`);
      totalErrors++;
    }
    for (const warn of localeWarnings) {
      output.warn(`[VERIFY] ${locale}: ${showKeys(warn)}`);
      totalWarnings++;
    }
    for (const info of localeInfos) output.info(`[VERIFY] ${locale}: ${showKeys(info)}`);

    if (localeErrors.length === 0 && localeWarnings.length === 0) {
      output.raw(STRUCTURE_ONLY_OK);
    }
    output.raw('');
    // --json: this locale's results as one record on stdout (the findings
    // are also the [VERIFY] lines on stderr). Keys in structured fields are
    // exact (a gettext context key keeps its U+0004); messages show it as ␄.
    output.event('verify', {
      locale,
      pair: pairOf.get(locale) || `${config.inputLocale}:${locale}`,
      ok: localeErrors.length === 0 && localeWarnings.length === 0,
      keys: { expected: expectedKeyTotal, present: targetKeyTotal, missing: missingKeyTotal, extra: extraKeyNames },
      errors: localeErrors.map(showKeys),
      warnings: localeWarnings.map(showKeys),
      infos: localeInfos.map(showKeys),
      placeholders: localePlaceholders,
      plurals: pluralCoverageData(pluralCoverage),
    });
  }

  // Two locales holding the same text: one of them is probably in the
  // other's language (or a model ignored the target language).
  for (const w of identicalLocaleWarnings(valuesByLocale, sourceByKey, config, noTranslate, pairOf)) {
    output.warn(`[VERIFY] ${showKeys(w)}`);
    totalWarnings++;
  }

  // Scoped, and some locale left out: the closing line names what was checked.
  // (A --pair that names every locale is a full check, said as one.)
  const leftOut = scope && [...new Set([...layout.listLocales(), ...configuredTargetLocales(config)])]
    .some(l => l !== config.inputLocale && !inScope(l));
  return finishEviction(cwd, tm, tmEvicted, printSummary(totalErrors, totalWarnings, {
    strict: !!options.strict, incomplete: options.incomplete || null,
    scope: leftOut ? checkedScope([...missingTargets, ...targetLocales], pairOf, config, !!options.afterSync) : null,
  }), damagedCount);
}

/**
 * What a scoped verify checked: its locales (sorted) and their pairs.
 *
 * @param {string[]} locales - The locales checked
 * @param {Map<string, string>} pairOf - locale → pair key
 * @param {object} config
 * @param {boolean} afterSync
 * @returns {{ locales: string[], pairs: string[], afterSync: boolean }}
 */
function checkedScope(locales, pairOf, config, afterSync) {
  const sorted = [...new Set(locales)].sort();
  return { locales: sorted, pairs: sorted.map(l => pairOf.get(l) || `${config.inputLocale}:${l}`), afterSync };
}

/**
 * The method named by a lock `by` key ("deepl|||") when it cannot be told
 * which plural form to write (it reads no per-key instructions), else null.
 */
function untoldMethod(methodKey) {
  const method = String(methodKey).split('|')[0] || 'llm';
  try { return getMethod(method, { method }).acceptsKeyInstructions === true ? null : method; } catch { return null; }
}

/** The per-locale pass line: what was checked, and that meaning was not. */
const STRUCTURE_ONLY_OK = '  [OK] Structural checks passed (meaning is not checked)';

/**
 * Plural findings that need the FILE, not just its flat map:
 *   - i18next: a plural key whose CLDR category the locale does not have
 *     (French `count_two`) — i18next never selects it. `_zero` is never
 *     flagged: i18next uses it for 0 in every language.
 *   - i18next: a borrowed form holding the text of the form it is translated
 *     from, with no record of the model writing it as that form (an info
 *     line — decided from the committed lock, never from the cache).
 *   - gettext: forms marked as repeating `other` that still do (sync wrote
 *     them because the translation had no such form), and msgstr[n] beyond
 *     the catalog's nplurals.
 *
 * @returns {{ warnings: string[], infos: string[] }}
 */
function pluralFileWarnings(unit, file, targetFlat, locale, config, fixFor, { expansion = null, localeState = null, lockKeyOf = (k) => k, pruneCommand = null } = {}) {
  const out = [];
  const infos = [];
  // i18next: a borrowed form (French `count_many`, translated from the
  // English `count_other` text) holding exactly the text of the form it
  // borrows from. Some languages write the two alike; what tells "the model
  // wrote it this way" from "filled from the other form" is the lock's
  // forms-record (lib/locale-state.js), committed with the files — so every
  // clone of a commit gets the same answer. This used to consult each
  // machine's own cache: one commit passed `verify --strict` on the machine
  // that translated it and failed in CI, where it also suggested a redo that
  // would re-bill (Round 7, i18next persona).
  if (expansion?.borrowed) {
    const unproven = [];
    for (const [b, form] of Object.entries(expansion.borrowed)) {
      const s = expansion.origin?.[b];
      if (!s || expansion.origin[s] !== s || expansion.borrowed[s]) continue;
      const vb = targetFlat[b];
      if (typeof vb !== 'string' || vb.trim() === '' || vb !== targetFlat[s]) continue;
      const lk = lockKeyOf(b);
      const asked = decodeForm(localeState?.forms?.[lk]);
      if (asked && asked.value === valueHash(vb)) continue; // asked for this form; it answered so
      const written = decodeWritten(localeState?.written?.[lk]);
      const bySync = !!written && written.value === valueHash(vb);
      const by = bySync ? (localeState?.by?.[lk] || null) : null;
      unproven.push({ key: b, sibling: s, form, value: vb, bySync, untold: by ? untoldMethod(by) : null });
    }
    const preview = (list) => list.slice(0, 3).map(x => `${x.key} = ${x.sibling} (${JSON.stringify(x.value.length > 40 ? `${x.value.slice(0, 37)}...` : x.value)})`).join(', ')
      + (list.length > 3 ? '...' : '');
    const formsOf = (list) => describeCategories(locale, [...new Set(list.map(x => x.form.replace(/^ordinal-/, '')))],
      list[0].form.startsWith('ordinal-') ? 'ordinal' : 'cardinal');
    const redo = (list) => `\`${fixFor(list.map(x => x.key))}\` (sends ${list.length} key(s) to the model)`;
    const untold = unproven.filter(x => x.untold);
    const predates = unproven.filter(x => x.bySync && !x.untold);
    const noRecord = unproven.filter(x => !x.bySync);
    if (untold.length > 0) {
      infos.push(`${untold.length} plural form(s) hold the same text as the form they are translated from: ${preview(untold)}`
        + ` — written by ${untold[0].untold}, which cannot be told which plural form to write (${locale} uses ${formsOf(untold)}). `
        + 'Review them, or use an LLM method for this pair.');
    }
    if (predates.length > 0) {
      infos.push(`${predates.length} plural form(s) hold the same text as the form they are translated from: ${preview(predates)}`
        + ` — written before each form had its own cache entry, when a cached answer for one form could be written into both `
        + `(${locale} uses ${formsOf(predates)}). If they should differ, ask again: ${redo(predates)}`);
    }
    if (noRecord.length > 0) {
      infos.push(`${noRecord.length} plural form(s) hold the same text as the form they are translated from: ${preview(noRecord)}`
        + ` — Champollion has no record of the model writing them as that form (written by hand, by another tool, or by a `
        + `version before 0.4.0; ${locale} uses ${formsOf(noRecord)}). If they should differ: ${redo(noRecord)}`);
    }
  }
  // i18next keys for a form the language does not have — with the command
  // that removes exactly them (lib/plurals.js pluralExtraKeys, the same rule).
  const extra = pluralExtraKeys(unit, targetFlat, locale);
  if (extra.length > 0) {
    out.push(`${extra.length} plural key(s) for a form ${locale} does not have: ${extra.slice(0, 5).map(e => e.key).join(', ')}`
      + `${extra.length > 5 ? '...' : ''} (${locale} plural forms: ${extra[0].cats.join(', ')}) — i18next never uses them. `
      + `Remove them: \`${pruneCommand ? pruneCommand() : 'champollion sync --prune plural-extras'}\` (deletes only plural keys for forms ${locale} does not have, `
      + 'lists each one, sends nothing), or delete them by hand.');
  }
  if (file.format === 'po' && fs.existsSync(file.path)) {
    let findings = null;
    try { findings = poPluralFindings(fs.readFileSync(file.path, 'utf-8'), { locale, filePath: file.rel }); } catch { findings = null; }
    if (findings) {
      const everydayOf = (cats) => cats.filter(c => (pluralCategoryUseFor(locale) || []).includes(c));
      const copied = findings.copied.map(f => ({ key: f.key, cats: everydayOf(f.categories) })).filter(f => f.cats.length > 0);
      if (copied.length > 0) {
        const preview = copied.slice(0, 3).map(f => `${f.key} (${f.cats.join(', ')})`).join(', ');
        out.push(`${copied.length} plural entr(y/ies) repeat the "other" form where ${locale} has its own: ${preview}`
          + `${copied.length > 3 ? '...' : ''} — the translation did not supply those forms (marked "# champollion:" in ${file.rel}). `
          + `Write them and delete that line, or ask again: \`${fixFor(copied.map(f => f.key), { fresh: true })}\``);
      }
      if (findings.extraForms.length > 0) {
        const f0 = findings.extraForms[0];
        out.push(`${findings.extraForms.length} plural entr(y/ies) with more forms than the catalog's nplurals=${f0.nplurals} `
          + `(${locale}: ${f0.categories.join(', ')}): ${findings.extraForms.slice(0, 3).map(f => `${f.key} (msgstr[0..${f.forms - 1}])`).join(', ')}`
          + ' — msgfmt rejects them; delete the extra msgstr[] lines (sync then treats the entry as translated again).');
      }
    }
  }
  return { warnings: out, infos };
}

/**
 * Plural messages in one target file that lack a form the language uses for
 * ORDINARY counts (Russian few/many) — what `verify --strict` fails on, so
 * `audit` (the completeness gate) counts the same entries as incomplete
 * (Round 7, Django persona: verify warned, audit said "fully translated",
 * and wrong Russian plurals shipped with a green build).
 *   - ICU plural values (next-intl, ARB, i18next ICU): a missing branch;
 *   - gettext: msgstr[] forms sync marked "# champollion:" as repeating
 *     `other` (the translation had no such form).
 *
 * @returns {Array<{ key: string, missing: string[], marked: boolean }>}
 */
function pluralGapsInFile({ file, expected, targetFlat, locale }) {
  const out = [];
  const isPo = file.format === 'po' && fs.existsSync(file.path);
  const text = isPo ? fs.readFileSync(file.path, 'utf-8') : null;
  const pluralSlots = isPo ? poPluralSlots(text, locale) : null;
  for (const [k, src] of Object.entries(expected)) {
    const tgt = targetFlat[k];
    if (typeof src !== 'string' || typeof tgt !== 'string' || !src.includes('{') || tgt === src) continue;
    const gaps = pluralGaps(src, tgt, locale, pluralSlots).filter(g => g.everyday.length > 0);
    if (gaps.length > 0) out.push({ key: k, missing: [...new Set(gaps.flatMap(g => g.everyday))], marked: false });
  }
  if (isPo) {
    let findings = null;
    try { findings = poPluralFindings(text, { locale, filePath: file.rel }); } catch { findings = null; }
    for (const f of findings?.copied || []) {
      const cats = f.categories.filter(c => (pluralCategoryUseFor(locale) || []).includes(c));
      if (cats.length > 0 && !out.some(o => o.key === f.key)) out.push({ key: f.key, missing: cats, marked: true });
    }
  }
  return out;
}

/** Everyday plural categories of a locale (lib/icu-structure.js), memoized. */
const everydayCache = new Map();
function pluralCategoryUseFor(locale) {
  if (!everydayCache.has(locale)) everydayCache.set(locale, pluralCategoryUse(locale)?.everyday || null);
  return everydayCache.get(locale);
}

// -----------------------------------------------------------------
// Plural coverage — the forms each locale is expected to have, at a glance
// -----------------------------------------------------------------

/**
 * The plural / selectordinal arguments of an ICU message, nested ones too
 * (a gettext msgid_plural entry reads as one: lib/po.js). `inflects` is
 * false for an argument with nothing but `other` — count-agnostic by design,
 * and not judged (the rule lib/icu-structure.js pluralGaps applies).
 * Parsed under the apostrophe readings pluralGaps tries, in its order.
 *
 * @param {string} text
 * @returns {Array<{ name: string, type: 'cardinal'|'ordinal', inflects: boolean }>}
 */
function pluralArguments(text) {
  if (typeof text !== 'string' || !text.includes('{')) return [];
  for (const apostrophes of ['literal', 'icu']) {
    const parsed = parseMessage(text, { apostrophes });
    if (!parsed.ok || !hasBranching(parsed.nodes)) continue;
    const out = [];
    const visit = (nodes) => {
      for (const node of nodes) {
        if (node.type !== 'branching') continue;
        if (node.keyword === 'plural' || node.keyword === 'selectordinal') {
          out.push({
            name: node.name,
            type: node.keyword === 'selectordinal' ? 'ordinal' : 'cardinal',
            inflects: node.options.some(o => o.selector !== 'other'),
          });
        }
        for (const opt of node.options) visit(opt.nodes);
      }
    };
    visit(parsed.nodes);
    return out;
  }
  return [];
}

/** A value that holds text (a missing or empty form is not a form). */
const holdsText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Add one target file's plurals to its locale's coverage (`acc`, a Map the
 * caller keeps per locale). Two kinds, each judged by the expectation sync
 * translates against — never a hardcoded list:
 *   - i18next suffixed keys (`count_one`, `count_many`, …): the keys the
 *     locale's expansion expects (lib/plurals.js — CLDR's categories for the
 *     locale, `_zero` when the source has it; the source's own forms when
 *     CLDR has no rules for the locale). A group is complete when every
 *     expected key holds text.
 *   - ICU plural messages (next-intl, ARB, i18next ICU) and gettext
 *     msgid_plural entries: CLDR's categories (lib/icu-structure.js
 *     pluralCategoryUse), in a gettext catalog only those its Plural-Forms
 *     has a slot for. A message is complete when it keeps its plural and
 *     supplies every form ordinary counts use (no pluralGaps everyday gap,
 *     no msgstr[] marked as repeating `other`). A form only numbers above
 *     1000 or fractions use (French `many`) is counted apart: "other"
 *     stands in for it, which is not a finding.
 * Missing forms are already findings (a missing key, a plural warning);
 * this is the summary that confirms the plurals (Round 12, i18next persona:
 * confirming the forms needed a separate check).
 *
 * @param {Map} acc - Per-locale accumulator: `${kind}|${type}` → bucket
 * @param {object} args
 * @param {object} args.unit - Source unit (lib/locale-layout.js)
 * @param {object} args.expected - The keys this locale should have (expectedForTarget)
 * @param {object|null} args.expansion - Its plural expansion
 * @param {object} args.targetFlat - The locale file's values
 * @param {string} args.locale
 * @param {boolean} [args.gettext] - The file is a gettext catalog
 * @param {string[]|null} [args.slots] - Its plural slots (poPluralSlots; null = CLDR's)
 * @param {Array<{ key: string, categories: string[] }>} args.marked - gettext forms marked as repeating `other`
 * @param {(key: string) => string} args.keyName - Display key (namespaced)
 */
function addPluralCoverage(acc, { unit, expected, expansion, targetFlat, locale, gettext = false, slots = null, marked = [], keyName = (k) => k }) {
  const bucket = (kind, type, basis) => {
    const id = `${kind}|${type}`;
    if (!acc.has(id)) {
      acc.set(id, { kind, type, basis, categories: new Set(), rare: new Set(), total: 0, complete: 0, incomplete: [], leftToOther: new Map() });
    }
    return acc.get(id);
  };
  const has = (k) => Object.prototype.hasOwnProperty.call(expected, k);

  // i18next suffixed keys.
  if (expansion && unit.pluralGroups && unit.pluralGroups.size > 0) {
    for (const group of unit.pluralGroups.values()) {
      const type = group.ordinal ? 'ordinal' : 'cardinal';
      const prefix = `${group.base}${group.ordinal ? '_ordinal' : ''}_`;
      const cats = CLDR_CATEGORIES.filter(c => has(`${prefix}${c}`));
      if (cats.length === 0) continue;
      const b = bucket('i18next-keys', type, expansion.unknownLocale ? 'source' : 'cldr');
      for (const c of cats) b.categories.add(c);
      b.total++;
      const missing = cats.filter(c => !holdsText(targetFlat[`${prefix}${c}`]));
      if (missing.length === 0) b.complete++;
      else b.incomplete.push({ key: keyName(group.base), missing, keys: missing.map(c => keyName(`${prefix}${c}`)) });
    }
  }

  // ICU plural messages / gettext plural entries.
  const kind = gettext ? 'gettext-entries' : 'icu-messages';
  const markedOf = new Map(marked.map(f => [f.key, f.categories]));
  for (const [k, src] of Object.entries(expected)) {
    const srcArgs = pluralArguments(src).filter(a => a.inflects);
    if (srcArgs.length === 0) continue;
    const tgt = targetFlat[k];
    const tgtArgs = holdsText(tgt) ? pluralArguments(tgt) : [];
    const gaps = holdsText(tgt) ? pluralGaps(src, tgt, locale, slots) : [];
    for (const type of new Set(srcArgs.map(a => a.type))) {
      const use = pluralCategoryUse(locale, type);
      const holds = (c) => !slots || type !== 'cardinal' || slots.includes(c);
      const b = bucket(kind, type, !use ? 'none' : (slots && type === 'cardinal' ? 'gettext' : 'cldr'));
      b.total++;
      if (!use) continue; // CLDR has no rules for the locale: nothing to judge against
      const cats = use.categories.filter(holds);
      for (const c of cats) b.categories.add(c);
      for (const c of use.rare.filter(holds)) b.rare.add(c);
      const lost = srcArgs.some(a => a.type === type && !tgtArgs.some(t => t.name === a.name && t.type === type));
      let missing;
      const rareLeft = new Set();
      if (lost) {
        missing = cats; // the value has no such plural at all (or no text)
      } else {
        const ofType = gaps.filter(g => g.type === type);
        missing = [...new Set(ofType.flatMap(g => g.everyday))];
        for (const g of ofType) for (const c of g.rare) rareLeft.add(c);
        if (type === 'cardinal') {
          for (const c of markedOf.get(k) || []) {
            if (use.everyday.includes(c)) { if (!missing.includes(c)) missing.push(c); } else if (use.rare.includes(c)) rareLeft.add(c);
          }
        }
      }
      for (const c of rareLeft) b.leftToOther.set(c, (b.leftToOther.get(c) || 0) + 1);
      if (missing.length === 0) b.complete++;
      else b.incomplete.push({ key: keyName(k), missing: CLDR_CATEGORIES.filter(c => missing.includes(c)) });
    }
  }
}

/** A locale's plural coverage as --json data (one entry per kind and type). */
function pluralCoverageData(acc) {
  return [...acc.values()].map(b => ({
    kind: b.kind,
    type: b.type,
    // cldr: CLDR's categories for the locale; gettext: those the catalog's
    // Plural-Forms holds; source: CLDR has no rules — the source's forms;
    // none: CLDR has no rules, nothing judged.
    basis: b.basis,
    categories: CLDR_CATEGORIES.filter(c => b.categories.has(c)),
    total: b.total,
    complete: b.basis === 'none' ? null : b.complete,
    ok: b.basis === 'none' ? null : b.incomplete.length === 0,
    incomplete: b.incomplete,
    ...(b.rare.size > 0 && { rare: CLDR_CATEGORIES.filter(c => b.rare.has(c)) }),
    ...(b.leftToOther.size > 0 && { leftToOther: Object.fromEntries(b.leftToOther) }),
  }));
}

/**
 * The human lines for a locale's plural coverage, e.g.
 *   Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
 *
 * @param {string} locale
 * @param {Map} acc
 * @returns {string[]}
 */
function pluralCoverageLines(locale, acc) {
  const nouns = {
    'i18next-keys': 'i18next plural key group(s)',
    'icu-messages': 'ICU plural message(s)',
    'gettext-entries': 'gettext plural entr(y/ies)',
  };
  const lines = [];
  for (const b of pluralCoverageData(acc)) {
    const forms = b.type === 'ordinal' ? 'Ordinal forms' : 'Plural forms';
    const noun = nouns[b.kind];
    if (b.basis === 'none') {
      lines.push(`  ${forms} (CLDR has no plural rules for ${locale}): ${b.total} ${noun}, not checked`);
      continue;
    }
    const basis = {
      cldr: `CLDR ${locale}`,
      gettext: `CLDR ${locale}, the forms the catalog's Plural-Forms has`,
      source: `the source's — CLDR has no plural rules for ${locale}`,
    }[b.basis];
    const shown = b.incomplete.slice(0, 5).map(i => (i.keys ? i.keys.join(', ') : `${i.key} (${i.missing.join(', ')})`)).join(', ')
      + (b.incomplete.length > 5 ? ', …' : '');
    const left = Object.entries(b.leftToOther || {})
      .map(([c, n]) => `; ${c} is used only above 1000 or for fractions — "other" stands in for it in ${n}`).join('');
    const detail = b.ok
      ? `${b.total} ${noun}, every form ${left ? 'ordinary counts use ' : ''}present`
      : `${b.incomplete.length} of ${b.total} ${noun} lack a form: ${shown}`;
    // i18next looks `key_zero` up for 0 in every language: a source `_zero`
    // is expected even where CLDR has no zero category (lib/plurals.js).
    const cldr = pluralCategoriesFor(locale, b.type) || [];
    const zero = b.kind === 'i18next-keys' && b.basis === 'cldr' && b.categories.includes('zero') && !cldr.includes('zero')
      ? ' (zero: the source has _zero, which i18next uses for 0)' : '';
    lines.push(`  ${forms} (${basis}): ${b.categories.join(', ')}${zero} ${b.ok ? '✓' : '✗'} — ${detail}${left}`);
  }
  return lines;
}

/** A value with words in it — not a number, a placeholder, a URL or punctuation. */
function hasWords(value) {
  const text = String(value)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\{[^{}]*\}/g, '')
    .replace(/%(\([^)]*\))?[-#0 +]*\d*(\.\d+)?[sdifuxXoeEgGc]/g, '')
    .replace(/[\d\s\p{P}\p{S}]/gu, '');
  return text.length >= 2;
}

/**
 * A locale's Markdown pages as shared-output items: each front-matter field
 * and each block, beside its source (contentDir projects; a page whose block
 * count differs from its source's is compared field by field only). Sync
 * seeds its gate with the pages a run leaves alone from the same reading
 * (lib/shared-output-seed.js), so the two judge the same items.
 *
 * @param {object} config
 * @param {string} cwd
 * @param {string} locale
 * @param {{ only?: (sourcePath: string) => boolean }} [opts] - Read only these source pages
 * @returns {Array<{ key: string, source: string, value: string }>}
 */
function contentItemsFor(config, cwd, locale, { only = null } = {}) {
  if (!config.contentDir || config.format === 'docusaurus') return [];
  const contentDir = path.resolve(cwd, config.contentDir);
  if (!fs.existsSync(contentDir)) return [];
  const fields = config.translatableFields || DEFAULT_TRANSLATABLE_FIELDS;
  const items = [];
  let sources = [];
  try { sources = discoverContentFiles(contentDir, config.inputLocale); } catch { return []; }
  for (const sourcePath of sources) {
    if (only && !only(sourcePath)) continue;
    const targetPath = getTargetContentPath(sourcePath, locale, config.inputLocale);
    if (!fs.existsSync(targetPath)) continue;
    const rel = path.relative(contentDir, sourcePath).split(path.sep).join('/');
    let src;
    let tgt;
    try {
      src = parseContentFile(fs.readFileSync(sourcePath, 'utf-8'));
      tgt = parseContentFile(fs.readFileSync(targetPath, 'utf-8'));
    } catch { continue; }
    for (const field of fields) {
      const a = src.frontMatter?.[field];
      const b = tgt.frontMatter?.[field];
      if (typeof a === 'string' && typeof b === 'string') items.push({ key: `content:${rel} front matter:${field}`, source: a, value: b });
    }
    const srcBlocks = translatableBlockSources(src.body || '');
    const tgtBlocks = translatableBlockSources(tgt.body || '');
    if (srcBlocks.length !== tgtBlocks.length) continue;
    srcBlocks.forEach((block, i) => items.push({ key: `content:${rel}#${i + 1}`, source: block, value: tgtBlocks[i] }));
  }
  return items;
}

/**
 * Content pages of one locale whose lock entry is `pending:<hash>` (written
 * with parts left in the source language — lib/content-refusals.js), as sync
 * names them. Read straight from the content lock; never fails.
 *
 * @param {string} cwd
 * @param {string} locale
 * @returns {string[]}
 */
function pendingContentPages(cwd, locale) {
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(cwd, '.champollion-content.lock'), 'utf-8')); } catch { return []; }
  const pages = [];
  for (const [key, value] of Object.entries(lock)) {
    if (!isPendingLock(value) || !key.endsWith(`:${locale}`)) continue;
    pages.push(key.slice(0, -(locale.length + 1)).replace(/^docusaurus:/, ''));
  }
  return pages.sort();
}

/**
 * The command that re-translates one content file — the ONE repair sync and
 * verify both print for a content finding. `--redo files:` matches the path
 * relative to the contentDir (as sync names files) or to the project root
 * (lib/file-scope.js); the memorized sentence a finding names has been
 * evicted from the cache and is refused if the model answers with it again,
 * so no --fresh is needed (Round 6).
 *
 * @param {string} file - The content file as sync names it (relative to the contentDir)
 * @param {{ pair?: string|null }} [opts]
 * @returns {string}
 */
function contentRedoCommand(file, { pair = null } = {}) {
  return `champollion sync${pair ? ` --pair ${shellWord(pair)}` : ''} --redo files:${shellWord(file)}`;
}

/**
 * Per locale: Markdown blocks and front-matter fields on disk that the
 * quality gate refuses today (lib/validate.js contentGateFault — the
 * key-value gate's checks: length inflation, echo, truncation, script). A
 * warning: sync refuses such output, so on disk it predates the check, was
 * written around it, or by hand. '[EN] ' fallbacks are their own finding.
 *
 * @returns {string[]} warnings
 */
function contentGateWarnings(locale, items, pairConfig, pair, fallbackPrefix, tm = null) {
  const byFile = new Map();
  const tmKeys = tm ? tmKeysForPair(pairConfig) : [];
  for (const it of items || []) {
    if (typeof it.value !== 'string' || it.value.startsWith(fallbackPrefix)) continue;
    // What sync accepted and cached for this source — e.g. a name or citation
    // the model kept as written when asked again with the reason — is not
    // judged again here (it would name a deliberate answer as a fault).
    if (tm && tmHoldsValue(tm, it.source, locale, tmKeys, it.value)) continue;
    const reason = contentGateFault(it.source, it.value, pairConfig);
    if (!reason) continue;
    const rest = it.key.slice('content:'.length);
    const m = /^(.*?)(?:#(\d+)| front matter:(.*))$/.exec(rest);
    const file = m ? m[1] : rest;
    const where = m && m[2] ? `paragraph ${m[2]}` : m && m[3] !== undefined ? `front matter "${m[3]}"` : rest;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ where, reason });
  }
  const out = [];
  for (const [file, list] of byFile) {
    out.push(`${file}: ${list.length} Markdown block(s)/front-matter field(s) the quality gate refuses — `
      + list.slice(0, 3).map(x => `${x.where}: ${x.reason}`).join('; ') + (list.length > 3 ? '; …' : '')
      + ` — re-translate: \`${contentRedoCommand(file, { pair })}\``);
  }
  return out;
}

/**
 * Per locale: one value written for several different source strings
 * (lib/validate.js SharedOutputIndex — the gate's own rule, so synonyms
 * collapsing to one short word are not flagged). ICU messages count branch
 * by branch, and the locale's Markdown pages share the index with its keys.
 *
 * An ERROR, not a warning: sync's gate refuses the same group, so on disk
 * it is either older than the gate, written around it, or hand-made — and a
 * memorized sentence in place of three different clinical prompts passed a
 * warning-only verify (Round 5, hospital persona).
 *
 * @returns {string[]} errors
 */
function sharedOutputErrors(locale, values, sourceByKey, config, noTranslate, pairOf, contentItems = [], memorized = []) {
  const index = new SharedOutputIndex({ protectedTerms: config.protectedTerms || [] });
  // A sentence an earlier sync caught the model repeating (TM _meta.memorized):
  // on disk even once, it is that sentence, not a translation (Round 6).
  index.markMemorized(memorized);
  const items = [];
  for (const [key, value] of values || []) {
    const source = sourceByKey.get(key);
    if (typeof source !== 'string' || (noTranslate && noTranslate.matches(key, source))) continue;
    items.push(...sharedOutputItems(key, source, value));
  }
  items.push(...contentItems);
  const suspects = index.suspects(items);
  if (suspects.size === 0) return [];
  const groups = new Map();
  const remembered = new Set();
  for (const [key, g] of suspects) {
    if (!groups.has(g.value)) groups.set(g.value, []);
    groups.get(g.value).push(key);
    if (g.memorized) remembered.add(g.value);
  }
  const pair = pairOf.get(locale) || `${config.inputLocale}:${locale}`;
  const out = [];
  for (const [value, members] of groups) {
    const shown = value.length > 60 ? `${value.slice(0, 57)}...` : value;
    const keys = members.filter(k => !k.startsWith('content:'));
    const files = [...new Set(members.filter(k => k.startsWith('content:')).map(k => k.slice(8).replace(/(#\d+| front matter:.*)$/, '')))];
    // The content repair is the one sync prints for the same finding, word
    // for word (Round 7, school persona: the two named different commands).
    const redo = [
      keys.length > 0 && `\`${redoCommand(keys.slice(0, 8), { pair, fresh: true })}\``,
      ...files.slice(0, 3).map(f => `\`${contentRedoCommand(f, { pair })}\``),
    ].filter(Boolean).join(', ');
    out.push(remembered.has(value)
      ? `${members.length} value(s) hold the sentence an earlier sync caught the model repeating for different source strings — ${JSON.stringify(shown)} for `
        + `${members.map(k => k.replace(/^content:/, '')).slice(0, 5).join(', ')}${members.length > 5 ? '...' : ''} — a memorized sentence, `
        + `not a translation. Re-translate (a "fallback" method on the pair takes what the model can only answer this way): ${redo}`
      : `${members.length} value(s) hold the same text for different source strings — ${JSON.stringify(shown)} for `
        + `${members.map(k => k.replace(/^content:/, '')).slice(0, 5).join(', ')}${members.length > 5 ? '...' : ''} — a model repeating one memorized sentence, `
        + `not translations of each. Re-translate: ${redo}`);
  }
  return out;
}

/**
 * Two target locales whose values are the same text for most keys: one is
 * almost certainly in the other's language — the output of a model that
 * ignored the target language passes every per-locale check (Round 3,
 * Next.js persona: fr.json and de.json byte-identical, "All checks passed").
 *
 * Compared: keys both locales have whose values contain words, differ from
 * the source (an echo is its own finding), and are not no-translate or
 * declared names. Locales of one language (pt-BR / pt-PT, fr / fr-CA) are
 * not compared — they legitimately share most of their text. Flagged at
 * 80 % or more identical, over at least 4 compared keys.
 *
 * @returns {string[]} warnings
 */
function identicalLocaleWarnings(valuesByLocale, sourceByKey, config, noTranslate, pairOf) {
  const out = [];
  const locales = [...valuesByLocale.keys()];
  const lang = (l) => l.toLowerCase().split(/[-_]/)[0];
  for (let i = 0; i < locales.length; i++) {
    for (let j = i + 1; j < locales.length; j++) {
      const a = locales[i];
      const b = locales[j];
      if (lang(a) === lang(b)) continue;
      const va = valuesByLocale.get(a);
      const vb = valuesByLocale.get(b);
      let compared = 0;
      let identical = 0;
      for (const [key, x] of va) {
        const y = vb.get(key);
        const src = sourceByKey.get(key);
        if (typeof y !== 'string' || typeof src !== 'string') continue;
        if (x === src || y === src || !hasWords(x)) continue;
        if (noTranslate && noTranslate.matches(key, src)) continue;
        if (isProtectedTermValue(x, config.protectedTerms)) continue;
        compared++;
        if (x === y) identical++;
      }
      if (compared >= 4 && identical / compared >= 0.8) {
        const pa = pairOf.get(a) || `${config.inputLocale}:${a}`;
        const pb = pairOf.get(b) || `${config.inputLocale}:${b}`;
        out.push(`${a} and ${b}: ${identical} of ${compared} translated values are identical — one of them is probably `
          + `in the other's language (or the model ignored the target language). Check both files; re-translate the wrong one: `
          + `\`champollion sync --pair ${pa} --redo all --fresh\` (or --pair ${pb}).`);
      }
    }
  }
  return out;
}

/**
 * Recursively collect all .json files under a directory — the shared
 * folder walk (lib/locale-layout.js), with Docusaurus's historical reach
 * (hidden entries included), the same walk the Docusaurus sync uses.
 *
 * @param {string} dir - Directory to walk
 * @returns {string[]} Absolute paths to .json files, sorted
 */
function walkJSONFiles(dir) {
  return walkFiles(dir, name => name.endsWith('.json'), { skipHidden: false });
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
 * @param {Function} [echoPredicateFor]
 * @param {{ inScope?: (locale: string) => boolean, evictDamaged?: Function }} [hooks]
 * @returns {Promise<{ errors: number, warnings: number }>}
 */
async function verifyDocusaurusLocales(config, cwd, noTranslate = null, echoPredicateFor = () => null,
  { inScope = () => true, evictDamaged = () => {}, fixFor = () => (keys, opts) => redoCommand(keys, opts), afterSync = false, strict = false, incomplete = null,
    describeChecked = null } = {}) {
  const sourceLocaleDir = path.join(config.localesDir, config.inputLocale);

  const rel = (p) => path.relative(cwd, p).split(path.sep).join('/') || '.';
  if (!fs.existsSync(sourceLocaleDir)) {
    return nothingVerified(cwd, config, `the Docusaurus source folder ${rel(sourceLocaleDir)}/ does not exist `
      + `("localesDir" and "inputLocale": "${config.inputLocale}" in champollion.config.json) — `
      + `\`npx docusaurus write-translations --locale ${config.inputLocale}\` creates it.`);
  }

  const sourceFiles = walkJSONFiles(sourceLocaleDir);
  if (sourceFiles.length === 0) {
    return nothingVerified(cwd, config, `no source JSON strings under ${rel(sourceLocaleDir)}/.`);
  }

  // Target locales = subdirectories of i18n/ other than the source locale.
  const targetLocales = fs.readdirSync(config.localesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== config.inputLocale && !e.name.startsWith('.'))
    .map(e => e.name)
    .filter(inScope)
    .sort();

  // Same false-green hole as the flat path: a configured locale with no
  // i18n/<locale>/ directory is invisible to the listing above. Fail loud.
  const missingTargets = [...configuredTargetLocales(config)]
    .filter(inScope)
    .filter(l => !fs.existsSync(path.join(config.localesDir, l)))
    .sort();

  if (targetLocales.length === 0 && missingTargets.length === 0) {
    return nothingVerified(cwd, config, `no target locale folders under ${rel(config.localesDir)}/ and no "languages" in champollion.config.json.`);
  }

  output.raw(afterSync
    ? '\n  ── Post-Sync Verification (Docusaurus) ──────────────────\n'
    : '\n  ── Verification (Docusaurus) ────────────────────────────\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const locale of missingTargets) {
    const message = `${locale}: locale directory missing (${path.join(path.basename(config.localesDir), locale)}/) — configured target has no translations. Run \`champollion sync\` to create it.`;
    output.error(`[VERIFY] ${message}`);
    totalErrors++;
    output.event('verify', { locale, pair: `${config.inputLocale}:${locale}`, ok: false, fileMissing: true, errors: [message], warnings: [], infos: [] });
  }

  for (const locale of targetLocales) {
    output.raw(`  ── ${locale} ──────────────────────────────────────`);

    const localeErrors = [];
    const localeWarnings = [];
    const localePlaceholders = [];

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

      const { errors, warnings, damaged, placeholders } = auditTranslations(sourceFlat, targetFlat, locale, config, noTranslate,
        echoPredicateFor(locale), { fixFor: fixFor(locale) });
      evictDamaged(locale, damaged);
      for (const e of errors) localeErrors.push(`${relPath}: ${e}`);
      for (const w of warnings) localeWarnings.push(`${relPath}: ${w}`);
      for (const p of placeholders) localePlaceholders.push({ ...p, file: relPath.split(path.sep).join('/') });
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
      output.raw(STRUCTURE_ONLY_OK);
    }
    output.raw('');
    output.event('verify', {
      locale, pair: `${config.inputLocale}:${locale}`,
      ok: localeErrors.length === 0 && localeWarnings.length === 0,
      errors: localeErrors, warnings: localeWarnings, infos: [], placeholders: localePlaceholders,
    });
  }

  // Scoped, and some locale left out: the closing line names what was checked.
  const everyTarget = new Set([
    ...fs.readdirSync(config.localesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== config.inputLocale && !e.name.startsWith('.')).map(e => e.name),
    ...configuredTargetLocales(config),
  ]);
  const leftOut = [...everyTarget].some(l => !inScope(l));
  return printSummary(totalErrors, totalWarnings, {
    strict, incomplete, scope: describeChecked && leftOut ? describeChecked([...missingTargets, ...targetLocales]) : null,
  });
}

export { verifyLocales, auditTranslations, localesForPairFlag, redoCommand, contentRedoCommand, shellWord, pluralGapsInFile, contentItemsFor };
