/**
 * flutter-locales.js — does Flutter's own UI text cover a target locale?
 *
 * `flutter gen-l10n` builds the app's messages from the ARB files sync
 * writes, but Material and Cupertino widgets (date pickers, "Back",
 * "Cancel", text direction) take their own text from flutter_localizations
 * (GlobalMaterialLocalizations, GlobalCupertinoLocalizations,
 * GlobalWidgetsLocalizations), which cover a fixed list of languages. An app
 * whose supportedLocales include one outside that list — a private-use code
 * such as `qaa`, most low-resource languages — fails at runtime ("No
 * MaterialLocalizations found") unless it adds a fallback delegate (Round
 * 11, hospital persona: neither init nor the Flutter docs said so).
 *
 * The list is Flutter's own, read from the Flutter SDK on this machine
 * (FLUTTER_ROOT, or the `flutter` on PATH): one
 * `packages/flutter_localizations/lib/src/l10n/material_<locale>.arb` file
 * per covered locale. Nothing here guesses it: without an SDK, a private-use
 * code is reported as uncovered (no list can hold one) and every other code
 * is reported as unchecked, with where to read the rule.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isPrivateUseCode } from './registers.js';

/** Where the CLI's Flutter section explains the fallback delegate. */
export const FLUTTER_LOCALES_DOC = 'https://champollion.dev/docs/integrations/frameworks#flutter-locales-outside-flutters-own-list';

/** The directory of Flutter's material_<locale>.arb files, from an SDK root. */
const L10N_DIR = path.join('packages', 'flutter_localizations', 'lib', 'src', 'l10n');

/**
 * The Flutter SDK root on this machine: FLUTTER_ROOT, else the directory
 * above the `bin/` of the first `flutter` on PATH (symlinks resolved).
 *
 * @param {object} [env=process.env]
 * @returns {string|null}
 */
export function findFlutterSdk(env = process.env) {
  const isSdk = (root) => !!root && fs.existsSync(path.join(root, L10N_DIR));
  if (env.FLUTTER_ROOT && isSdk(env.FLUTTER_ROOT)) return env.FLUTTER_ROOT;
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of process.platform === 'win32' ? ['flutter.bat', 'flutter'] : ['flutter']) {
      const exe = path.join(dir, name);
      let real;
      try { real = fs.realpathSync(exe); } catch { continue; }
      const root = path.dirname(path.dirname(real));
      if (isSdk(root)) return root;
    }
  }
  return null;
}

/**
 * The language codes Flutter's Material localizations cover, read from the
 * SDK: `material_pt_BR.arb` → "pt". null when no SDK is found.
 *
 * @param {object} [env=process.env]
 * @returns {{ languages: Set<string>, from: string }|null}
 */
export function flutterMaterialLanguages(env = process.env) {
  const root = findFlutterSdk(env);
  if (!root) return null;
  const dir = path.join(root, L10N_DIR);
  let names;
  try { names = fs.readdirSync(dir); } catch { return null; }
  const languages = new Set();
  for (const n of names) {
    const m = /^material_([A-Za-z]{2,3})(?:_[A-Za-z0-9]+)*\.arb$/.exec(n);
    if (m) languages.add(m[1].toLowerCase());
  }
  return languages.size > 0 ? { languages, from: dir } : null;
}

/** "pt_BR" / "pt-BR" → "pt". */
function languageOf(code) {
  return String(code).split(/[-_]/)[0].toLowerCase();
}

/**
 * Which ARB target locales Flutter's own widget text does not cover.
 *
 * @param {string[]} codes - Target locales as the ARB files name them
 * @param {object} [env=process.env]
 * @returns {{ uncovered: string[], unchecked: string[], from: string|null }}
 *   uncovered: outside Flutter's list (or private-use); unchecked: no SDK here to check against
 */
export function flutterUncoveredLocales(codes, env = process.env) {
  const list = flutterMaterialLanguages(env);
  const uncovered = [];
  const unchecked = [];
  for (const code of codes) {
    // A private-use code (qaa–qtz) is in no published list.
    if (isPrivateUseCode(code)) uncovered.push(code);
    else if (!list) unchecked.push(code);
    else if (!list.languages.has(languageOf(code))) uncovered.push(code);
  }
  return { uncovered, unchecked, from: list ? list.from : null };
}

/**
 * The line(s) init and sync print for ARB targets: what to add for a locale
 * Flutter does not cover, or — with no SDK here — that it was not checked.
 * Empty when every target is covered.
 *
 * @param {string[]} codes
 * @param {object} [env=process.env]
 * @returns {Array<{ level: 'warn'|'info', text: string }>}
 */
export function flutterLocaleLines(codes, env = process.env) {
  const { uncovered, unchecked, from } = flutterUncoveredLocales(codes, env);
  const lines = [];
  if (uncovered.length > 0) {
    const basis = from ? `checked against ${from}` : 'a private-use code is in no list';
    lines.push({ level: 'warn', text: `Flutter: its own Material/Cupertino widget text (GlobalMaterialLocalizations) does not cover ${uncovered.join(', ')} (${basis}). `
      + `An app with ${uncovered.length > 1 ? 'these locales' : 'this locale'} in supportedLocales fails at runtime without a fallback delegate for it — add one: ${FLUTTER_LOCALES_DOC}` });
  }
  if (unchecked.length > 0) {
    lines.push({ level: 'info', text: `Flutter: no Flutter SDK found here (FLUTTER_ROOT, or flutter on PATH), so ${unchecked.join(', ')} ${unchecked.length > 1 ? 'were' : 'was'} not checked against `
      + `the languages Flutter's own widget text covers (GlobalMaterialLocalizations). A language outside that list needs a fallback delegate: ${FLUTTER_LOCALES_DOC}` });
  }
  return lines;
}
