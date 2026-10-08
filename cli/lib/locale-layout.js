/**
 * Locale layout — WHERE a project's key-value locale files live, for every
 * locale, in one place.
 *
 * WHY THIS EXISTS: every command used to rebuild `<localesDir>/<code><ext>`
 * by hand (sync, the cost estimate, verify, integrity, xliff, watch, lint,
 * repair-script, wrap). That single shape is right for Hugo, vue-i18n and
 * next-intl, and wrong for i18next — `public/locales/en/common.json`, one
 * folder per language, one file per namespace — which is the most common
 * layout in the React world. Users of those projects were told to write
 * their own flatten/unflatten wrapper. This module is the one answer to
 * "which files make up locale X?", so every caller agrees by construction.
 *
 * LAYOUTS
 *   flat     <localesDir>/<code><ext>             (today's behaviour; one file)
 *   dir      <localesDir>/<code>/**\/<ns><ext>     (one folder per locale; each
 *                                                  file is a namespace, which
 *                                                  may be a nested path such
 *                                                  as "admin/users")
 *   pattern  config `localesPattern` with {lang} and optional {ns}, e.g.
 *              public/locales/{lang}/{ns}.json
 *              lib/l10n/app_{lang}.arb
 *              locale/{lang}/LC_MESSAGES/{ns}.po
 *
 * AUTO-DETECTION (no localesPattern, no localesLayout): if
 * `<localesDir>/<inputLocale>/` is a directory holding locale files the
 * layout is `dir`; otherwise `flat`. When BOTH `<localesDir>/en.json` and a
 * populated `<localesDir>/en/` exist the answer is ambiguous and we refuse
 * to guess — silently picking one would translate the wrong files.
 *
 * FORMAT IS PASSED THROUGH, NEVER ASSUMED. Each file entry carries the format
 * implied by its real extension (.yml stays .yml — the old getExtension()
 * round trip turned a `.yml` source into a search for `.yaml`). A format the
 * reader does not implement is refused loudly, never parsed as JSON.
 *
 * DOCUMENT FORMATS (.po, .arb). A gettext catalog or an ARB file is a
 * document around the strings — headers, comments, plural forms, metadata.
 * Every target file therefore knows its SOURCE file (`sourcePath`), and the
 * writer rebuilds the target from the source's structure plus the target's
 * own untouched parts (lib/po.js, lib/format.js serializeARB). Each file
 * also knows its `role`: a gettext SOURCE reads msgid where msgstr is empty,
 * a target reads only translated, non-fuzzy entries.
 *
 * GETTEXT TEMPLATES. When the source language has no .po of its own, the
 * source is the template (.pot):
 *   flat         the one .pot in localesDir (po/fr.po + po/messages.pot);
 *   pattern      `<name>.pot` beside the source's would-be file, in the
 *                pattern's base folder or in the folder above it — <name>
 *                is the {ns} (one template per namespace) or the pattern's
 *                file name without {lang} ("messages.po" → messages.pot;
 *                a file name that is only {lang} takes the one .pot there);
 *   dir          not searched — a folder-per-language project keeps its
 *                source catalog in <localesDir>/<source>/ (Django:
 *                `django-admin makemessages -l en`).
 * Two candidate templates where one is expected is an error, never a guess.
 *
 * NAMESPACED KEYS. Wherever two files' keys share one space (the lock
 * manifest, XLIFF unit ids, dry-run key lists, --force-keys) a key is
 * written `<ns>::<key>`. Flat layouts (and a pattern without {ns}) have a
 * single file and keep bare keys, so their lock files are byte-for-byte what
 * they were. The Translation Memory is NOT namespaced: it is keyed by source
 * TEXT, so an identical string in two files is translated once and reused
 * for free (founder cost-first rule).
 *
 * Docusaurus keeps its own lane (lib/docusaurus-sync.js) — its JSON files
 * carry {message, description} objects and a plugin directory structure —
 * so this module refuses format 'docusaurus' rather than half-handling it.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  detectFormatFromDir, readLocaleFile, writeLocaleFile, detectYAMLStyle, LOCALE_FILE_FORMATS,
  readLocaleContext, emptyDocumentContent,
} from './format.js';
import { flattenKeys } from './flatten.js';
import { isUnsafeKey } from './security.js';
import { findPluralGroups, expandPluralsForLocale } from './plurals.js';

/** Separator between namespace and key in every shared key space. */
const NS_SEPARATOR = '::';

/** Values accepted by the `localesLayout` config field (pattern = localesPattern). */
const LAYOUT_KINDS = ['flat', 'dir'];

/**
 * Extension → format. Ordered: the first extension listed for a format is
 * the one written when a project has no file to copy it from. A gettext
 * template (.pot) is not a locale file — it is found separately, as a
 * source (see "GETTEXT TEMPLATES" above).
 */
const FORMAT_BY_EXT = Object.freeze({
  '.json': 'json',
  '.toml': 'toml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.po': 'po',
  '.arb': 'arb',
});

/** Directory names never walked when discovering locale files. */
const WALK_SKIP = new Set(['node_modules', '.git']);

/**
 * Map a file extension (".yml") to its locale format ("yaml").
 *
 * @param {string} ext - Extension including the dot
 * @returns {string|null} Format name, or null for an unrecognised extension
 */
function formatForExtension(ext) {
  return FORMAT_BY_EXT[String(ext).toLowerCase()] || null;
}

/**
 * Every extension that carries a given format, preferred first.
 *
 * @param {string} format - 'json' | 'toml' | 'yaml' | 'po' | 'arb'
 * @returns {string[]} Extensions including the dot (empty for unknown formats)
 */
function extensionsForFormat(format) {
  return Object.entries(FORMAT_BY_EXT).filter(([, f]) => f === format).map(([e]) => e);
}

/** Path → forward-slash form, so namespaces and patterns read the same on every OS. */
function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/**
 * Recursively list the files under `dir` that `accept` keeps — the ONE
 * folder walk behind every per-locale folder in the CLI: this module's
 * `dir` and `pattern` layouts, and the Docusaurus lane's i18n/<locale>/
 * JSON discovery (lib/docusaurus-sync.js discoverDocusaurusJSONFiles).
 *
 * @param {string} dir - Absolute directory (missing → [])
 * @param {(name: string) => boolean} accept - File-name filter
 * @param {{ skipHidden?: boolean, maxDepth?: number }} [options] -
 *   skipHidden (default true) also skips node_modules/.git; maxDepth 1 =
 *   only `dir` itself
 * @returns {string[]} Absolute paths, sorted
 */
function walkFiles(dir, accept, { skipHidden = true, maxDepth = Infinity } = {}) {
  const out = [];
  function walk(d, depth) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (skipHidden && (entry.name.startsWith('.') || WALK_SKIP.has(entry.name))) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth) walk(full, depth + 1);
      } else if (entry.isFile() && accept(entry.name)) {
        out.push(full);
      }
    }
  }
  walk(dir, 1);
  return out.sort();
}

/**
 * Locale files (any known locale extension) under `dir`.
 *
 * @param {string} dir - Absolute directory
 * @param {number} [maxDepth=Infinity]
 * @returns {string[]} Absolute paths, sorted
 */
function walkLocaleFiles(dir, maxDepth = Infinity) {
  return walkFiles(dir, name => !!formatForExtension(path.extname(name)), { maxDepth });
}

/**
 * Throw a config error with the code resolveConfig() and the CLI map to a
 * clean, unwrapped message.
 */
function layoutError(message) {
  const e = new Error(message);
  e.code = 'CHAMPOLLION_CONFIG_INVALID';
  return e;
}

// -----------------------------------------------------------------
// localesPattern
// -----------------------------------------------------------------

/**
 * Compile a `localesPattern` ("public/locales/{lang}/{ns}.json") into the
 * pieces discovery and rendering need.
 *
 * Rules (each violation fails loud — a pattern that silently matched
 * nothing would make sync report "fully synced" on a project it never read):
 *   - {lang} is required; {ns} is optional and may appear at most once.
 *   - No other {placeholder}.
 *   - The file name must end in an extension that is not a placeholder.
 *   - {lang} may repeat (e.g. "{lang}/app_{lang}.arb"); every occurrence
 *     must name the same locale.
 *
 * @param {string} pattern - Absolute (or cwd-relative) pattern
 * @returns {{ pattern: string, base: string, ext: string, hasNs: boolean,
 *   regex: RegExp, maxDepth: number, render: (lang: string, ns?: string) => string }}
 */
function compileLocalesPattern(pattern) {
  if (typeof pattern !== 'string' || pattern.trim() === '') {
    throw layoutError('"localesPattern" must be a non-empty string such as "public/locales/{lang}/{ns}.json".');
  }
  const abs = path.resolve(pattern);
  const posix = toPosix(abs);
  const placeholders = [...posix.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
  const unknown = placeholders.filter(p => p !== 'lang' && p !== 'ns');
  if (unknown.length > 0) {
    throw layoutError(
      `"localesPattern" has unknown placeholder(s) ${unknown.map(u => `{${u}}`).join(', ')} — `
      + 'only {lang} and {ns} are supported.');
  }
  if (!placeholders.includes('lang')) {
    throw layoutError(`"localesPattern" must contain {lang} (got "${pattern}").`);
  }
  if (placeholders.filter(p => p === 'ns').length > 1) {
    throw layoutError(`"localesPattern" may contain {ns} at most once (got "${pattern}").`);
  }
  const fileName = posix.slice(posix.lastIndexOf('/') + 1);
  const ext = path.extname(fileName.replace(/\{[^}]*\}/g, 'X'));
  if (!ext || /\{/.test(ext) || fileName.endsWith('}')) {
    throw layoutError(
      `"localesPattern" must end in a file extension, e.g. "{lang}/{ns}.json" (got "${pattern}").`);
  }

  // Static base directory: everything before the segment holding the first
  // placeholder. Discovery walks only this tree.
  const firstPh = posix.indexOf('{');
  const base = posix.slice(0, posix.lastIndexOf('/', firstPh)) || '/';

  // Build an anchored regex. {lang} is one path segment fragment (never a
  // slash); {ns} may span directories ("admin/users").
  let seenLang = false;
  let src = '';
  let last = 0;
  for (const m of posix.matchAll(/\{(lang|ns)\}/g)) {
    src += escapeRegex(posix.slice(last, m.index));
    if (m[1] === 'lang') {
      src += seenLang ? '\\k<lang>' : '(?<lang>[^/]+?)';
      seenLang = true;
    } else {
      src += '(?<ns>.+?)';
    }
    last = m.index + m[0].length;
  }
  src += escapeRegex(posix.slice(last));
  const regex = new RegExp(`^${src}$`);

  const hasNs = placeholders.includes('ns');
  // Without {ns} the depth below `base` is fixed by the pattern; with {ns}
  // namespaces may nest arbitrarily deep.
  const maxDepth = hasNs ? Infinity : posix.slice(base.length + 1).split('/').length;

  const render = (lang, ns = '') => {
    const out = posix.replace(/\{lang\}/g, lang).replace(/\{ns\}/g, ns);
    return path.normalize(out.split('/').join(path.sep));
  };

  return { pattern, base: path.normalize(base), ext, hasNs, regex, maxDepth, render };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -----------------------------------------------------------------
// Layout discovery
// -----------------------------------------------------------------

/**
 * Resolve the format + extension of a flat project's source file.
 *
 * Explicit format: that format's extensions, preferring one that exists
 * (so `format: "yaml"` finds `en.yml`). Auto: whichever `<inputLocale>.<ext>`
 * actually exists; when several do, the directory's majority format
 * (detectFormatFromDir — the pre-layout behaviour) breaks the tie; when none
 * does, the majority format names the file the "source not found" error
 * points at.
 */
function resolveFlatSource(localesDir, inputLocale, explicitFormat) {
  const exists = (ext) => isFile(path.join(localesDir, `${inputLocale}${ext}`));
  if (explicitFormat) {
    const exts = extensionsForFormat(explicitFormat);
    if (exts.length === 0) {
      throw layoutError(`Unknown locale format "${explicitFormat}".`);
    }
    return { format: explicitFormat, ext: exts.find(exists) || exts[0] };
  }
  const present = Object.keys(FORMAT_BY_EXT).filter(exists);
  const families = [...new Set(present.map(formatForExtension))];
  if (families.length === 1) {
    return { format: families[0], ext: present[0] };
  }
  const majority = detectFormatFromDir(localesDir);
  if (families.length === 0) {
    return { format: majority, ext: extensionsForFormat(majority)[0] };
  }
  if (families.includes(majority)) {
    return { format: majority, ext: present.find(e => formatForExtension(e) === majority) };
  }
  throw layoutError(
    `Found more than one source locale file (${present.map(e => inputLocale + e).join(', ')}) in ${localesDir} — `
    + 'set "format" in champollion.config.json to say which one is the source.');
}

/** gettext templates (*.pot) directly in `dir`, sorted. */
function findTemplates(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(n => n.endsWith('.pot') && isFile(path.join(dir, n)))
      .sort()
      .map(n => path.join(dir, n));
  } catch {
    return [];
  }
}

function tooManyTemplates(dir, pots, inputLocale) {
  return layoutError(
    `Found several gettext templates in ${dir} (${pots.map(p => path.basename(p)).join(', ')}) and no `
    + `${inputLocale} catalog — keep one template there, or create the source catalog `
    + `(e.g. \`msginit --locale=${inputLocale} --no-translator\`), so the source is not a guess.`);
}

/** A LocaleFile for a template standing in for the source. */
function templateFile(pot, ns, inputLocale, base) {
  return {
    ns, code: inputLocale, path: pot, ext: '.pot', format: 'po',
    rel: toPosix(path.relative(base, pot)), role: 'source', sourcePath: pot, template: true,
  };
}

/**
 * Add role + sourcePath to a layout's file factory: a target file knows the
 * source file it mirrors (the document formats are written from it).
 */
function withSource(fileFor, sourceFiles, inputLocale) {
  const byNs = new Map(sourceFiles.map(f => [f.ns, f.path]));
  return (code, ns = '') => {
    const f = fileFor(code, ns);
    const role = code === inputLocale ? 'source' : 'target';
    return { ...f, role, sourcePath: byNs.get(ns) ?? (role === 'source' ? f.path : null) };
  };
}

/**
 * Choose the format family for a set of discovered files: the explicit
 * format when configured, else the most common one (ties → FORMAT_BY_EXT
 * order, i.e. json first).
 */
function chooseFamily(files, explicitFormat) {
  if (explicitFormat) return explicitFormat;
  const counts = new Map();
  for (const f of files) {
    const fam = formatForExtension(path.extname(f));
    counts.set(fam, (counts.get(fam) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const fam of [...new Set(Object.values(FORMAT_BY_EXT))]) {
    const c = counts.get(fam) || 0;
    if (c > bestCount) { best = fam; bestCount = c; }
  }
  return best || 'json';
}

/**
 * Describe where every locale's files live for this project.
 *
 * @param {object} config - Resolved config (inputLocale, localesDir, format,
 *   optional localesPattern / localesLayout). Raw objects work too: a
 *   missing format means 'auto'.
 * @param {{ cwd?: string }} [options] - cwd only shapes the human-readable
 *   `display` path (relative to the project root)
 * @returns {LocaleLayout}
 *
 * @typedef {object} LocaleFile
 * @property {string} ns - Namespace ('' when the layout has one file per locale)
 * @property {string} code - Locale code this file belongs to
 * @property {string} path - Absolute path
 * @property {string} ext - Real extension, e.g. '.yml'
 * @property {string} format - 'json' | 'toml' | 'yaml' | 'po' | 'arb'
 * @property {string} rel - Display path relative to the layout base ('fr.json', 'fr/common.json')
 * @property {'source'|'target'} role - Which side of a translation this file is
 * @property {string|null} sourcePath - The source file this one mirrors (the
 *   document formats are written from it); the file's own path for a source
 * @property {boolean} [template] - A gettext template (.pot) standing in for
 *   the source language's catalog
 *
 * @typedef {object} LocaleLayout
 * @property {'flat'|'dir'|'pattern'} kind
 * @property {string} format - Format family of the source files
 * @property {string} sourceLocale
 * @property {string} baseDir - Directory every locale file lives under
 * @property {boolean} namespaced - True when a locale may span several files
 * @property {string} display - Human description, e.g. "public/locales/{lang}/{ns}.json"
 * @property {LocaleFile[]} sourceFiles - The source locale's files (flat: the
 *   expected file, which may not exist; dir/pattern: files found on disk)
 * @property {string[]} ignored - Source-side files skipped (other format family)
 * @property {(code: string, ns?: string) => LocaleFile} fileFor
 * @property {(code: string) => LocaleFile[]} filesFor - Mirror of sourceFiles for `code`
 * @property {() => string[]} listLocales - Target locale codes present on disk
 *   (exact code match, source excluded, sorted)
 */
function discoverLocaleLayout(config, { cwd = process.cwd() } = {}) {
  const inputLocale = config.inputLocale || 'en';
  const shown = (dir) => toPosix(path.relative(cwd, dir)) || '.';
  const fmt = config.format && config.format !== 'auto' ? config.format : null;
  if (fmt === 'docusaurus') {
    throw new Error('Docusaurus projects use their own locale lane (i18n/<locale>/…{message} JSON) — the key-value layout does not apply.');
  }
  if (config.localesLayout != null && !LAYOUT_KINDS.includes(config.localesLayout)) {
    throw layoutError(`"localesLayout" must be one of ${LAYOUT_KINDS.join(', ')} (got "${config.localesLayout}").`);
  }

  if (config.localesPattern) {
    if (config.localesLayout) {
      throw layoutError('Set either "localesPattern" or "localesLayout", not both — a pattern already fixes the layout.');
    }
    return patternLayout(config, inputLocale, fmt, shown);
  }

  const localesDir = path.resolve(config.localesDir || './locales');
  const sourceDir = path.join(localesDir, inputLocale);
  const dirCandidates = isDirectory(sourceDir) ? walkLocaleFiles(sourceDir) : [];
  const flatPresent = Object.keys(FORMAT_BY_EXT)
    .filter(ext => isFile(path.join(localesDir, `${inputLocale}${ext}`)));

  let kind = config.localesLayout || null;
  if (!kind) {
    if (dirCandidates.length > 0 && flatPresent.length > 0) {
      throw layoutError(
        `Both ${path.join(localesDir, inputLocale + flatPresent[0])} and a folder of locale files `
        + `${sourceDir}${path.sep} exist, so the layout is ambiguous. Set "localesLayout": "flat" `
        + '(one file per locale) or "dir" (one folder per locale) in champollion.config.json.');
    }
    kind = dirCandidates.length > 0 ? 'dir' : 'flat';
  }

  return kind === 'dir'
    ? dirLayout(localesDir, inputLocale, fmt, dirCandidates, shown)
    : flatLayout(localesDir, inputLocale, fmt, shown);
}

function flatLayout(localesDir, inputLocale, fmt, shown) {
  const { format, ext } = resolveFlatSource(localesDir, inputLocale, fmt);
  const baseFileFor = (code) => ({
    ns: '', code, path: path.join(localesDir, `${code}${ext}`), ext, format, rel: `${code}${ext}`,
  });
  let sourceFile = { ...baseFileFor(inputLocale), role: 'source' };
  sourceFile.sourcePath = sourceFile.path;
  // gettext: no <source>.po → the one template in the folder (GNU po/).
  if (format === 'po' && !isFile(sourceFile.path)) {
    const pots = findTemplates(localesDir);
    if (pots.length > 1) throw tooManyTemplates(localesDir, pots, inputLocale);
    if (pots.length === 1) sourceFile = templateFile(pots[0], '', inputLocale, localesDir);
  }
  const fileFor = withSource(baseFileFor, [sourceFile], inputLocale);
  return {
    kind: 'flat',
    format,
    sourceLocale: inputLocale,
    baseDir: localesDir,
    namespaced: false,
    display: `${shown(localesDir)}/{lang}${ext}`,
    sourceFiles: [sourceFile],
    ignored: [],
    fileFor,
    filesFor: (code) => [fileFor(code)],
    listLocales: () => {
      if (!isDirectory(localesDir)) return [];
      return fs.readdirSync(localesDir)
        .filter(f => f.endsWith(ext) && isFile(path.join(localesDir, f)))
        .map(f => f.slice(0, -ext.length))
        .filter(code => code && code !== inputLocale)
        .sort();
    },
  };
}

function dirLayout(localesDir, inputLocale, fmt, candidates, shown) {
  const sourceDir = path.join(localesDir, inputLocale);
  const all = candidates.length > 0 ? candidates : (isDirectory(sourceDir) ? walkLocaleFiles(sourceDir) : []);
  const format = chooseFamily(all, fmt);
  const exts = new Set(extensionsForFormat(format));
  const chosen = all.filter(f => exts.has(path.extname(f).toLowerCase()));
  const ignored = all.filter(f => !exts.has(path.extname(f).toLowerCase()))
    .map(f => toPosix(path.relative(localesDir, f)));

  const sourceFiles = chosen.map(f => {
    const ext = path.extname(f);
    const relInLocale = toPosix(path.relative(sourceDir, f));
    const ns = relInLocale.slice(0, -ext.length);
    return {
      ns, code: inputLocale, path: f, ext, format, rel: `${inputLocale}/${relInLocale}`,
      role: 'source', sourcePath: f,
    };
  }).sort((a, b) => a.ns.localeCompare(b.ns));
  const extByNs = new Map(sourceFiles.map(f => [f.ns, f.ext]));
  const defaultExt = extensionsForFormat(format)[0];

  const fileFor = withSource((code, ns) => {
    const ext = extByNs.get(ns) || defaultExt;
    return {
      ns, code, ext, format,
      path: path.join(localesDir, code, ...`${ns}${ext}`.split('/')),
      rel: `${code}/${ns}${ext}`,
    };
  }, sourceFiles, inputLocale);

  return {
    kind: 'dir',
    format,
    sourceLocale: inputLocale,
    baseDir: localesDir,
    namespaced: true,
    display: `${shown(localesDir)}/{lang}/{ns}${defaultExt}`,
    sourceFiles,
    ignored,
    fileFor,
    filesFor: (code) => sourceFiles.map(f => fileFor(code, f.ns)),
    // A locale is a sub-folder holding at least one file of this format, or
    // an empty sub-folder (a project that created fr/ to ask for French).
    // Folders holding only other files (utils/, components/) are not
    // locales; stray files at the root are never locales.
    listLocales: () => {
      if (!isDirectory(localesDir)) return [];
      return fs.readdirSync(localesDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && !WALK_SKIP.has(e.name) && e.name !== inputLocale)
        .filter(e => {
          const d = path.join(localesDir, e.name);
          const files = walkLocaleFiles(d);
          if (files.some(f => exts.has(path.extname(f).toLowerCase()))) return true;
          return fs.readdirSync(d).filter(n => !n.startsWith('.')).length === 0;
        })
        .map(e => e.name)
        .sort();
    },
  };
}

function patternLayout(config, inputLocale, fmt, shown) {
  const compiled = compileLocalesPattern(config.localesPattern);
  const extFormat = formatForExtension(compiled.ext);
  // An .arb read as plain JSON is exactly the reported Flutter breakage:
  // "@@locale" and every placeholder type in the @key metadata get
  // translated, and gen-l10n refuses to build. Never do it.
  if (fmt === 'json' && extFormat === 'arb') {
    throw layoutError(
      '"format": "json" would translate the @@locale and @key metadata of .arb files, which breaks '
      + '`flutter gen-l10n`. Remove "format" (ARB is detected from the extension) or set "format": "arb".');
  }
  // Explicit format wins; otherwise the extension decides, and an
  // extension we cannot place fails loud instead of being parsed as JSON.
  const format = fmt || extFormat;
  if (!format) {
    throw layoutError(
      `Cannot tell the format of "${compiled.ext}" files from "localesPattern" — set "format" in champollion.config.json.`);
  }

  const matches = [];
  if (isDirectory(compiled.base)) {
    for (const f of walkLocaleFilesAnyExt(compiled.base, compiled.ext, compiled.maxDepth)) {
      const m = compiled.regex.exec(toPosix(f));
      if (m) matches.push({ path: f, lang: m.groups.lang, ns: compiled.hasNs ? m.groups.ns : '' });
    }
  }

  const baseFileFor = (code, ns = '') => {
    const p = compiled.render(code, ns);
    return {
      ns, code, path: p, ext: compiled.ext, format,
      rel: toPosix(path.relative(compiled.base, p)),
    };
  };
  const asSource = (f) => ({ ...f, role: 'source', sourcePath: f.path });

  let sourceFiles;
  if (compiled.hasNs) {
    sourceFiles = matches.filter(m => m.lang === inputLocale)
      .map(m => asSource(baseFileFor(inputLocale, m.ns)))
      .sort((a, b) => a.ns.localeCompare(b.ns));
  } else {
    // One file per locale: the expected source file, existing or not, so
    // the caller's "source not found" error names the exact path.
    sourceFiles = [asSource(baseFileFor(inputLocale, ''))];
  }

  // gettext: no source-language catalog → its template (.pot).
  if (format === 'po') {
    const dirs = [...new Set([
      compiled.hasNs ? null : path.dirname(sourceFiles[0].path),
      compiled.base,
      path.dirname(compiled.base),
    ].filter(Boolean))];
    if (compiled.hasNs && sourceFiles.length === 0) {
      for (const d of dirs) {
        const pots = findTemplates(d);
        if (pots.length === 0) continue;
        sourceFiles = pots.map(p => templateFile(p, path.basename(p, '.pot'), inputLocale, compiled.base));
        break;
      }
    } else if (!compiled.hasNs && !isFile(sourceFiles[0].path)) {
      const fileName = compiled.pattern.split(/[\\/]/).pop();
      const name = fileName.slice(0, fileName.length - compiled.ext.length)
        .replace(/[_\-.]?\{lang\}[_\-.]?/g, '');
      for (const d of dirs) {
        if (name) {
          const p = path.join(d, `${name}.pot`);
          if (isFile(p)) { sourceFiles = [templateFile(p, '', inputLocale, compiled.base)]; break; }
          continue;
        }
        const pots = findTemplates(d);
        if (pots.length > 1) throw tooManyTemplates(d, pots, inputLocale);
        if (pots.length === 1) { sourceFiles = [templateFile(pots[0], '', inputLocale, compiled.base)]; break; }
      }
    }
  }
  const fileFor = withSource(baseFileFor, sourceFiles, inputLocale);

  return {
    kind: 'pattern',
    format,
    sourceLocale: inputLocale,
    baseDir: compiled.base,
    namespaced: compiled.hasNs,
    display: shown(compiled.render('{lang}', '{ns}')),
    sourceFiles,
    ignored: [],
    fileFor,
    filesFor: (code) => sourceFiles.map(f => fileFor(code, f.ns)),
    listLocales: () => [...new Set(matches.map(m => m.lang))]
      .filter(code => code !== inputLocale)
      .sort(),
  };
}

/** Files under a pattern's base carrying the pattern's own extension (which may be unknown, e.g. ".strings"). */
function walkLocaleFilesAnyExt(dir, ext, maxDepth) {
  return walkFiles(dir, name => name.endsWith(ext), { maxDepth });
}

/**
 * Files making up one locale: the source's files for the input locale, the
 * mirrored files for any other code.
 *
 * @param {object} config - Resolved config
 * @param {{ code?: string, layout?: LocaleLayout }} [options]
 * @returns {LocaleFile[]}
 */
function resolveLocaleFiles(config, { code, layout } = {}) {
  const l = layout || discoverLocaleLayout(config);
  const target = code || l.sourceLocale;
  return target === l.sourceLocale ? l.sourceFiles : l.filesFor(target);
}

/**
 * Throw the "source not found" error every command shares, worded for the
 * layout, when the source locale has no readable file.
 *
 * @param {LocaleLayout} layout
 */
function assertSourceFiles(layout) {
  if (layout.kind === 'flat' || (layout.kind === 'pattern' && !layout.namespaced)) {
    const p = layout.sourceFiles[0].path;
    if (!fs.existsSync(p)) {
      const pot = layout.format === 'po' ? ' (nor a gettext template, .pot, where one is looked for)' : '';
      throw new Error(`Source locale not found: ${p}${pot}`);
    }
    return;
  }
  if (layout.sourceFiles.length === 0) {
    const where = layout.kind === 'dir'
      ? path.join(layout.baseDir, layout.sourceLocale) + path.sep
      : `${layout.display} with {lang} = ${layout.sourceLocale}`;
    throw new Error(`Source locale not found: no ${layout.format} locale files in ${where}`);
  }
}

// -----------------------------------------------------------------
// Read / write
// -----------------------------------------------------------------

/**
 * Read one locale file into a flat key → value map (JSON flattened to
 * dot-paths; TOML/YAML/po/arb are already flat). A missing file reads as {}.
 *
 * Formats the reader does not implement fail loud here — never parsed as
 * JSON, which would report a confusing "Invalid JSON" for a .po file.
 *
 * @param {LocaleFile} file
 * @returns {object} Flat map
 */
function readLocaleFlat(file) {
  assertReadableFormat(file);
  const data = readLocaleFile(file.path, file.format, readOptions(file));
  return file.format === 'json' ? flattenKeys(data) : { ...data };
}

/**
 * Read one locale file in the shape sync edits: the nested object for
 * JSON (so untouched structure round-trips), the flat map otherwise.
 *
 * @param {LocaleFile} file
 * @returns {object}
 */
function readLocaleData(file) {
  assertReadableFormat(file);
  return readLocaleFile(file.path, file.format, readOptions(file));
}

/** gettext reads differ by side: a source falls back to msgid. */
function readOptions(file) {
  return { role: file.role || 'target', locale: file.code || null };
}

/**
 * Write a locale file produced by readLocaleData()-shaped data, creating
 * missing parent folders (a new locale in a dir layout has no folder yet).
 * Document formats (po, arb) are rebuilt from the file's source.
 *
 * @param {LocaleFile} file
 * @param {object} data - Nested object (JSON) or flat map (TOML/YAML/po/arb)
 * @param {'hugo'|'nested'|null} [yamlStyle]
 */
function writeLocaleData(file, data, yamlStyle = null) {
  assertReadableFormat(file);
  fs.mkdirSync(path.dirname(file.path), { recursive: true });
  writeLocaleFile(file.path, data, file.format, file.format !== 'json' ? data : undefined, yamlStyle, {
    sourcePath: file.sourcePath || null,
    locale: file.code || null,
  });
}

function assertReadableFormat(file) {
  if (!LOCALE_FILE_FORMATS.includes(file.format)) {
    throw new Error(
      `${file.rel}: locale format "${file.format}" is not supported by this version of champollion `
      + `(supported: ${LOCALE_FILE_FORMATS.join(', ')}).`);
  }
}

/**
 * The content of a brand-new, empty locale file of `format`, or null when
 * this version cannot write that format.
 *
 * @param {string} format
 * @param {string} [code] - The locale the file is for (po: the header's
 *   Language and Plural-Forms; arb: `@@locale`)
 * @param {{ sourcePath?: string|null }} [options] - po: the template whose
 *   header fields (Project-Id-Version, POT-Creation-Date…) a new catalog carries
 * @returns {string|null}
 */
function emptyLocaleContent(format, code = null, { sourcePath = null } = {}) {
  if (format === 'json') return '{}\n';
  // An empty TOML/YAML file reads back as {} (readLocaleFile short-circuits
  // blank files), and is valid in both languages.
  if (format === 'toml' || format === 'yaml') return '';
  if ((format === 'po' || format === 'arb') && code) return emptyDocumentContent(format, code, { sourcePath });
  return null;
}

/**
 * Create every missing target file for `codes`, mirroring the source's
 * namespaces, as an empty file of the right format. Existing files are
 * never touched. Used by `init --langs` and by sync for configured
 * locales, so nobody has to hand-create an empty fr.json.
 *
 * @param {LocaleLayout} layout
 * @param {string[]} codes - Target locale codes
 * @returns {{ created: LocaleFile[], unsupported: LocaleFile[], refused: LocaleFile[] }}
 *   `unsupported`: files of a format this version cannot write; `refused`:
 *   paths a crafted code would put outside the layout's base directory.
 */
function createMissingTargetFiles(layout, codes) {
  const created = [];
  const unsupported = [];
  const refused = [];
  for (const code of codes) {
    if (code === layout.sourceLocale) continue;
    for (const file of layout.filesFor(code)) {
      if (fs.existsSync(file.path)) continue;
      if (!isContained(file.path, layout.baseDir)) { refused.push(file); continue; }
      const content = emptyLocaleContent(file.format, code, { sourcePath: file.sourcePath || null });
      if (content === null) { unsupported.push(file); continue; }
      fs.mkdirSync(path.dirname(file.path), { recursive: true });
      fs.writeFileSync(file.path, content, 'utf-8');
      created.push(file);
    }
  }
  return { created, unsupported, refused };
}

function isContained(p, parent) {
  const r = path.resolve(p);
  const base = path.resolve(parent);
  return r.startsWith(base + path.sep) || r === base;
}

// -----------------------------------------------------------------
// Source units — the source locale, one entry per file
// -----------------------------------------------------------------

/**
 * Read every source file of the layout into a "unit": the per-file flat map
 * sync diffs, translates and writes against. Fails loud when the source is
 * missing (same message the flat path always gave).
 *
 * @param {LocaleLayout} layout
 * @returns {SourceUnit[]}
 *
 * @typedef {object} SourceUnit
 * @property {string} ns - Namespace ('' for single-file layouts)
 * @property {LocaleFile} file - The source file
 * @property {object} flat - Flat key → value map (unsafe keys removed)
 * @property {'hugo'|'nested'|null} yamlStyle - YAML serialization style of the source
 * @property {Map} pluralGroups - i18next plural groups (json only; empty otherwise)
 * @property {object} context - key → translator note the source file carries
 *   (ARB `@key.description`, gettext msgctxt and `#.` comments); {} otherwise
 */
function loadSourceUnits(layout) {
  assertSourceFiles(layout);
  return layout.sourceFiles.map((file) => {
    const flat = readLocaleFlat(file);
    // Defense-in-depth: drop keys that could cause prototype pollution.
    for (const key of Object.keys(flat)) {
      if (isUnsafeKey(key)) delete flat[key];
    }
    // YAML comes in two shapes (Hugo plural sub-keys vs standard nesting);
    // the writer must reproduce the SOURCE's, so probe the raw text once.
    const yamlStyle = file.format === 'yaml'
      ? detectYAMLStyle(fs.readFileSync(file.path, 'utf-8'))
      : null;
    // i18next plural suffixes are a JSON convention; TOML/YAML (Hugo,
    // go-i18n) carry plurals as sub-keys the format adapter already handles.
    const pluralGroups = file.format === 'json'
      ? findPluralGroups(flat, layout.sourceLocale)
      : new Map();
    const context = file.format === 'po' || file.format === 'arb'
      ? readLocaleContext(file.path, file.format)
      : {};
    return { ns: file.ns, file, flat, yamlStyle, pluralGroups, context };
  });
}

/**
 * What a target locale is expected to contain for one source unit: the
 * source map itself, or — when the file has i18next plural groups — the map
 * with the TARGET's CLDR plural categories (lib/plurals.js).
 *
 * A source file that carries translator notes (ARB descriptions, gettext
 * msgctxt / `#.` comments) returns an identity "expansion" holding only
 * those notes as `descriptions` — the prompt context sync already threads
 * from expansions — with no key mapping (origin {}), so lock keys,
 * --force-keys and verify behave exactly as for a plain map.
 *
 * @param {SourceUnit} unit
 * @param {string} sourceLocale
 * @param {string} code - Target locale
 * @returns {{ flat: object, expansion: ReturnType<typeof expandPluralsForLocale> }}
 */
function expectedForTarget(unit, sourceLocale, code) {
  if (!unit.pluralGroups || unit.pluralGroups.size === 0) {
    if (unit.context && Object.keys(unit.context).length > 0) {
      return {
        flat: unit.flat,
        expansion: {
          flat: unit.flat, origin: {}, descriptions: unit.context, unused: [], groups: 0, unknownLocale: false,
        },
      };
    }
    return { flat: unit.flat, expansion: null };
  }
  const expansion = expandPluralsForLocale(unit.flat, sourceLocale, code, unit.pluralGroups);
  return { flat: expansion.flat, expansion };
}

// -----------------------------------------------------------------
// Namespaced keys
// -----------------------------------------------------------------

/**
 * The key a (namespace, key) pair has in shared key spaces (lock manifest,
 * XLIFF ids, dry-run lists). Bare for single-file layouts — which is what
 * keeps a flat project's lock file unchanged.
 *
 * @param {LocaleLayout|{namespaced: boolean}} layout
 * @param {string} ns
 * @param {string} key
 * @returns {string}
 */
function lockKey(layout, ns, key) {
  return layout.namespaced ? `${ns}${NS_SEPARATOR}${key}` : key;
}

/**
 * Split a shared-space key back into (namespace, key). For namespaced
 * layouts the namespace is everything before the FIRST separator (a key
 * may itself contain "::"; a namespace is a file path and cannot).
 *
 * @param {LocaleLayout|{namespaced: boolean}} layout
 * @param {string} id
 * @returns {{ ns: string, key: string }|null} null when a namespaced layout
 *   gets an id with no namespace
 */
function splitLockKey(layout, id) {
  if (!layout.namespaced) return { ns: '', key: id };
  const i = id.indexOf(NS_SEPARATOR);
  if (i < 0) return null;
  return { ns: id.slice(0, i), key: id.slice(i + NS_SEPARATOR.length) };
}

/**
 * A user-typed key with its gettext context separator restored: "␄"
 * (U+2404) or the literal text `\x04` → U+0004.
 *
 * @param {string} key
 * @returns {string}
 */
function fromTypedContext(key) {
  return key.replace(/\u2404/g, '\u0004').replace(/\\x04/g, '\u0004');
}

/**
 * The subset of user-named keys (--force-keys) that applies to one
 * namespace. In a namespaced layout "common::nav.home" names one file's
 * key, and a bare "nav.home" names that key in every file that has it.
 *
 * @param {LocaleLayout|{namespaced: boolean}} layout
 * @param {string[]} keys
 * @param {string} ns
 * @returns {string[]}
 */
function keysForNamespace(layout, keys, ns) {
  if (!keys || keys.length === 0) return keys || [];
  // A gettext key with a context is `msgctxt\u0004msgid`. U+0004 cannot be
  // typed, so two stand-ins are accepted: "␄" (U+2404 — how reports print
  // it, so a printed key pastes back) and the literal four characters
  // `\x04` (what a person can type: `--redo 'keys:verb\x04Open'`). Neither
  // occurs in real msgids; the separator `::` and `\,` are unaffected.
  keys = keys.map(k => (typeof k === 'string' ? fromTypedContext(k) : k));
  if (!layout.namespaced) return keys;
  const out = [];
  for (const k of keys) {
    const i = k.indexOf(NS_SEPARATOR);
    if (i < 0) out.push(k);
    else if (k.slice(0, i) === ns) out.push(k.slice(i + NS_SEPARATOR.length));
  }
  return out;
}

// -----------------------------------------------------------------
// Framework detection for document formats (used by `init`)
// -----------------------------------------------------------------

/** `key: value` lines of a flat YAML file (l10n.yaml is flat). */
function readFlatYAML(file) {
  const out = {};
  let text;
  try { text = fs.readFileSync(file, 'utf-8'); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (m && m[2] !== '') out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/**
 * A Flutter app's gen-l10n layout, or null when `cwd` is not a Flutter
 * project. Reads l10n.yaml (`arb-dir`, `template-arb-file`) when present,
 * else Flutter's defaults (lib/l10n, app_en.arb).
 *
 * The template file name gives both the pattern and the source locale the
 * way gen-l10n reads it: the locale is what follows the first "_" that
 * starts a locale CLDR knows ("app_en.arb" → app_{lang}.arb, en;
 * "intl_pt_BR.arb" → intl_{lang}.arb, pt_BR).
 *
 * @param {string} cwd - Project root
 * @returns {null | { framework: 'Flutter', format: 'arb', localesPattern: string,
 *   inputLocale: string, templateFile: string, templateExists: boolean,
 *   l10nYaml: boolean, targets: string[] }}
 */
function detectFlutterL10n(cwd) {
  const pubspec = path.join(cwd, 'pubspec.yaml');
  if (!isFile(pubspec)) return null;
  const text = fs.readFileSync(pubspec, 'utf-8');
  if (!/^\s*flutter\s*:/m.test(text) && !/sdk:\s*flutter\b/.test(text)) return null;

  const l10nPath = path.join(cwd, 'l10n.yaml');
  const l10n = isFile(l10nPath) ? readFlatYAML(l10nPath) : {};
  const arbDir = (l10n['arb-dir'] || 'lib/l10n').replace(/\/+$/, '');
  const template = l10n['template-arb-file'] || 'app_en.arb';
  const stem = template.replace(/\.arb$/, '');

  let prefix = null;
  let inputLocale = null;
  for (let i = 0; i < stem.length; i++) {
    if (stem[i] !== '_') continue;
    const candidate = stem.slice(i + 1);
    const lang = candidate.split(/[_-]/)[0];
    if (/^[a-z]{2,3}$/.test(lang) && Intl.PluralRules.supportedLocalesOf([lang]).length > 0) {
      prefix = stem.slice(0, i + 1);
      inputLocale = candidate;
      break;
    }
  }
  if (!prefix) return null;

  const localesPattern = `${toPosix(arbDir)}/${prefix}{lang}.arb`;
  const templatePath = path.join(cwd, ...toPosix(arbDir).split('/'), template);
  let targets = [];
  try {
    targets = discoverLocaleLayout({ inputLocale, localesPattern: path.join(cwd, localesPattern), format: 'arb' }, { cwd })
      .listLocales();
  } catch { /* an unreadable arb dir lists nothing */ }
  return {
    framework: 'Flutter', format: 'arb', localesPattern, inputLocale,
    templateFile: toPosix(path.relative(cwd, templatePath)), templateExists: isFile(templatePath),
    l10nYaml: isFile(l10nPath), targets,
  };
}

/**
 * A gettext layout under `cwd`, or null. Probes the conventional shapes:
 *   <dir>/<lang>/LC_MESSAGES/<domain>.po   (Django locale/, Babel/Flask
 *                                           translations/, Sphinx locales/)
 *   po/<lang>.po + po/<domain>.pot          (GNU)
 * and reports the config that describes it. The source is the source
 * language's catalog when present, else a template (see GETTEXT TEMPLATES).
 *
 * @param {string} cwd - Project root
 * @param {{ source?: string }} [options]
 * @returns {null | { framework: string, format: 'po', localesPattern?: string,
 *   localesDir?: string, inputLocale: string, sourceFiles: string[], targets: string[] }}
 */
function detectGettextLayout(cwd, { source = 'en' } = {}) {
  const framework = isFile(path.join(cwd, 'manage.py')) ? 'Django'
    : (isFile(path.join(cwd, 'babel.cfg')) ? 'Babel' : 'gettext');
  const describe = (config) => {
    try {
      const layout = discoverLocaleLayout({ inputLocale: source, format: 'po', ...config }, { cwd });
      const sourceFiles = layout.sourceFiles.filter(f => isFile(f.path)).map(f => toPosix(path.relative(cwd, f.path)));
      return { sourceFiles, targets: layout.listLocales() };
    } catch {
      return null;
    }
  };

  for (const dir of ['locale', 'locales', 'translations', 'i18n', 'conf/locale']) {
    const abs = path.join(cwd, ...dir.split('/'));
    if (!isDirectory(abs)) continue;
    const hasCatalogs = fs.readdirSync(abs, { withFileTypes: true })
      .some(e => e.isDirectory() && walkFiles(path.join(abs, e.name, 'LC_MESSAGES'), n => n.endsWith('.po')).length > 0);
    if (!hasCatalogs) continue;
    const localesPattern = `${dir}/{lang}/LC_MESSAGES/{ns}.po`;
    const found = describe({ localesPattern: path.join(abs, '{lang}', 'LC_MESSAGES', '{ns}.po') });
    if (found) return { framework, format: 'po', localesPattern, inputLocale: source, ...found };
  }

  const po = path.join(cwd, 'po');
  if (isDirectory(po) && fs.readdirSync(po).some(n => n.endsWith('.po') || n.endsWith('.pot'))) {
    const found = describe({ localesDir: po, localesLayout: 'flat' });
    if (found) return { framework, format: 'po', localesDir: './po', inputLocale: source, ...found };
  }
  return null;
}

export {
  NS_SEPARATOR,
  LAYOUT_KINDS,
  FORMAT_BY_EXT,
  formatForExtension,
  extensionsForFormat,
  compileLocalesPattern,
  discoverLocaleLayout,
  resolveLocaleFiles,
  assertSourceFiles,
  readLocaleFlat,
  readLocaleData,
  writeLocaleData,
  emptyLocaleContent,
  createMissingTargetFiles,
  loadSourceUnits,
  expectedForTarget,
  lockKey,
  splitLockKey,
  keysForNamespace,
  fromTypedContext,
  walkFiles,
  walkLocaleFiles,
  detectFlutterL10n,
  detectGettextLayout,
};
