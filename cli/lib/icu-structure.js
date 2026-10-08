/**
 * ICU MessageFormat STRUCTURE check — what a translation may and may not
 * change in a message like
 *
 *   {count, plural, =0 {No events} one {# event this week} other {# events this week}}
 *
 * THE FINDING THIS EXISTS FOR (synthetic users, 2026-10):
 *   - next-intl: an ICU plural came back as
 *     "{cóúnt, plúrál, óné {# event this week} óthér …}" — the variable name,
 *     the `plural` keyword and the selectors were "translated". The quality
 *     gate passed it, sync wrote it, locked it and cached it.
 *   - Flutter: ICU plurals in an .arb had their keywords translated, so
 *     `flutter gen-l10n` refused to build — while sync's gate, `integrity`
 *     and `verify` all said "All checks passed".
 *
 * THE RULE — only the message TEXT inside the branches may change:
 *   - argument names ({count}, {name}) are code: never renamed, never dropped;
 *   - argument types (plural / select / selectordinal / number / date …) are
 *     syntax: never translated, never swapped;
 *   - selectors (=0, one, other, male …) are syntax:
 *       select          exactly the source's options;
 *       plural/ordinal  the source's selectors, PLUS any CLDR category the
 *                       TARGET language uses (Polish adds few/many, French
 *                       many) and exact `=N` matches; a source category the
 *                       target language does not have may be dropped
 *                       (Japanese has only `other`); `other` is required;
 *   - `#` (the number) stays in every plural branch where the source has it,
 *     except zero / one / two / =N, where a language may spell the number;
 *   - `offset:N` is kept; nested structure is compared branch by branch;
 *   - printf conversions (%s, %d, %(name)s, %1$s) are kept — gettext
 *     catalogs carry them and `msgfmt --check-format` rejects a mismatch.
 *
 * APOSTROPHES. ICU MessageFormat uses ' as a quote character before a
 * syntax character ('{' is a literal brace); Flutter's gen-l10n does NOT
 * (its use-escaping option is off by default), and neither do most
 * hand-written messages. A value is accepted when its structure matches the
 * source's under EITHER reading, so French "d'{name}" is never rejected for
 * an apostrophe — the check is about damage, not about which runtime reads it.
 *
 * Zero dependencies. The plural categories come from CLDR through
 * Intl.PluralRules (lib/plurals.js) — no hardcoded language table.
 */

import { pluralCategoriesFor } from './plurals.js';

/** Argument types whose body is a list of `selector {message}` branches. */
const BRANCHING_TYPES = new Set(['plural', 'select', 'selectordinal']);

/** Argument types with an optional style and no branches. */
const SIMPLE_TYPES = new Set(['number', 'date', 'time', 'spellout', 'ordinal', 'duration', 'list']);

/** Every CLDR plural category name. */
const CLDR_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** Plural selectors where a language may write the number as a word (no `#`). */
const NUMBER_WORD_SELECTOR = /^(?:zero|one|two|=\d+)$/;

/**
 * CLDR categories per (locale, type), memoized: the gate and verify ask
 * once per ICU value, and a project can hold thousands of them.
 */
const categoryCache = new Map();
function categoriesFor(locale, type) {
  const id = `${locale}\u0000${type}`;
  if (!categoryCache.has(id)) categoryCache.set(id, pluralCategoriesFor(locale, type));
  return categoryCache.get(id);
}

// -----------------------------------------------------------------
// Parser
// -----------------------------------------------------------------

/**
 * Parse an ICU MessageFormat string strictly.
 *
 * Node shapes:
 *   { type: 'text', value, raw }                 literal text (value has quoting resolved)
 *   { type: 'pound', raw: '#' }                  the number, inside a plural branch
 *   { type: 'arg', name, argType, style, raw }   {name} / {name, number} / {name, date, short}
 *   { type: 'branching', name, keyword, offset, options: [{ selector, nodes, raw }], raw }
 *        keyword is what was WRITTEN — 'plural', or a translated 'plúrál'
 *        (an unknown keyword followed by `sel {…}` branches still parses as
 *        branching, so the damage can be named precisely)
 *
 * @param {string} str
 * @param {{ apostrophes?: 'icu'|'literal' }} [options] - 'icu': ' quotes a
 *   following syntax character (ICU / formatjs); 'literal': ' is ordinary
 *   text (Flutter gen-l10n default)
 * @returns {{ ok: true, nodes: object[] } | { ok: false, error: string }}
 */
function parseMessage(str, { apostrophes = 'icu' } = {}) {
  if (typeof str !== 'string') return { ok: false, error: 'not a string' };
  let pos = 0;
  const quoting = apostrophes === 'icu';

  const fail = (msg) => {
    const e = new Error(msg);
    e.icuPos = pos;
    throw e;
  };

  const isSpace = (ch) => /\s/.test(ch);
  const skipSpace = () => { while (pos < str.length && isSpace(str[pos])) pos++; };

  /** A word: everything up to whitespace or a syntax character. */
  const readWord = () => {
    const start = pos;
    while (pos < str.length && !isSpace(str[pos]) && !',{}'.includes(str[pos])) pos++;
    return str.slice(start, pos);
  };

  function parseNodes(depth, inPlural) {
    const nodes = [];
    let text = '';
    let rawStart = pos;
    const flush = () => {
      if (pos > rawStart || text) nodes.push({ type: 'text', value: text, raw: str.slice(rawStart, pos) });
      text = '';
    };

    while (pos < str.length) {
      const ch = str[pos];
      if (ch === '}') {
        if (depth === 0) fail(`unmatched '}' at position ${pos}`);
        flush();
        return nodes;
      }
      if (ch === '{') {
        flush();
        nodes.push(parseArgument(depth, inPlural));
        rawStart = pos;
        continue;
      }
      if (ch === '#' && inPlural) {
        flush();
        nodes.push({ type: 'pound', raw: '#' });
        pos++;
        rawStart = pos;
        continue;
      }
      if (ch === "'" && quoting) {
        const next = str[pos + 1];
        if (next === "'") { text += "'"; pos += 2; continue; }
        if (next === '{' || next === '}' || next === '|' || (next === '#' && inPlural)) {
          // Quoted literal: runs to the next lone apostrophe ('' inside = ').
          pos++;
          while (pos < str.length) {
            if (str[pos] === "'") {
              if (str[pos + 1] === "'") { text += "'"; pos += 2; continue; }
              pos++;
              break;
            }
            text += str[pos];
            pos++;
          }
          continue;
        }
      }
      text += ch;
      pos++;
    }
    if (depth > 0) fail('unclosed \'{\' — a branch or argument is never closed');
    flush();
    return nodes;
  }

  function parseArgument(depth, inPlural) {
    const start = pos;
    pos++; // {
    skipSpace();
    if (str[pos] === '{') fail(`unexpected '{' at position ${pos} (an argument name was expected)`);
    const name = readWord();
    skipSpace();
    if (pos >= str.length) fail(`argument "{${name}" is never closed`);

    if (str[pos] === '}') {
      pos++;
      return { type: 'arg', name, argType: null, style: null, raw: str.slice(start, pos) };
    }
    if (str[pos] !== ',') fail(`unexpected '${str[pos]}' in argument "{${name}" at position ${pos}`);
    pos++;
    skipSpace();
    const keyword = readWord();
    skipSpace();
    if (!keyword) fail(`argument "{${name}," has no type`);

    if (str[pos] === '}') {
      pos++;
      return { type: 'arg', name, argType: keyword, style: null, raw: str.slice(start, pos) };
    }
    if (str[pos] !== ',') fail(`unexpected '${str[pos]}' after "{${name}, ${keyword}" at position ${pos}`);
    pos++;

    if (BRANCHING_TYPES.has(keyword)) {
      const body = parseBranches(depth, inPlural || keyword !== 'select');
      return { type: 'branching', name, keyword, ...body, raw: str.slice(start, pos) };
    }
    if (!SIMPLE_TYPES.has(keyword)) {
      // An unknown keyword followed by branches is a translated `plural` /
      // `select` — parse it as branching so the report can say exactly that.
      const save = pos;
      try {
        const body = parseBranches(depth, true);
        if (body.options.length > 0) {
          return { type: 'branching', name, keyword, ...body, raw: str.slice(start, pos) };
        }
      } catch { /* not branches — fall through to a style */ }
      pos = save;
    }
    // Style: everything up to the matching close brace.
    const styleStart = pos;
    let level = 1;
    while (pos < str.length) {
      if (str[pos] === '{') level++;
      else if (str[pos] === '}') { level--; if (level === 0) break; }
      pos++;
    }
    if (pos >= str.length) fail(`argument "{${name}, ${keyword}, …" is never closed`);
    const style = str.slice(styleStart, pos).trim();
    pos++;
    return { type: 'arg', name, argType: keyword, style, raw: str.slice(start, pos) };
  }

  function parseBranches(depth, inPlural) {
    const options = [];
    let offset = null;
    const seen = new Set();
    for (;;) {
      skipSpace();
      if (pos >= str.length) fail('a plural/select argument is never closed');
      if (str[pos] === '}') { pos++; break; }
      if (str.startsWith('offset:', pos)) {
        pos += 'offset:'.length;
        skipSpace();
        const m = /^\d+/.exec(str.slice(pos));
        if (!m) fail(`offset: needs a number at position ${pos}`);
        offset = Number(m[0]);
        pos += m[0].length;
        continue;
      }
      const selector = readWord();
      if (!selector) fail(`expected a selector at position ${pos}`);
      skipSpace();
      if (str[pos] !== '{') fail(`selector '${selector}' must be followed by '{' (position ${pos})`);
      pos++;
      const contentStart = pos;
      const nodes = parseNodes(depth + 1, inPlural);
      const raw = str.slice(contentStart, pos);
      pos++; // }
      if (seen.has(selector)) fail(`selector '${selector}' appears twice`);
      seen.add(selector);
      options.push({ selector, nodes, raw });
    }
    return { offset, options };
  }

  try {
    const nodes = parseNodes(0, false);
    return { ok: true, nodes };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// -----------------------------------------------------------------
// Inspection helpers
// -----------------------------------------------------------------

/** Every node of a tree, depth first. */
function* walk(nodes) {
  for (const node of nodes) {
    yield node;
    if (node.type === 'branching') {
      for (const opt of node.options) yield* walk(opt.nodes);
    }
  }
}

/** True when the parsed message has at least one argument. */
function hasArguments(nodes) {
  for (const node of walk(nodes)) {
    if (node.type === 'arg' || node.type === 'branching') return true;
  }
  return false;
}

/** True when the message has a plural / select / selectordinal argument. */
function hasBranching(nodes) {
  for (const node of walk(nodes)) {
    if (node.type === 'branching') return true;
  }
  return false;
}

/** `#` directly in this branch (not inside a nested branching argument). */
function hasPound(nodes) {
  return nodes.some(n => n.type === 'pound');
}

/** "name" or "name, number" — how a simple argument is shown in a report. */
function argLabel(a) {
  return a.argType ? `{${a.name}, ${a.argType}}` : `{${a.name}}`;
}

/**
 * The simple arguments (name + type) used anywhere in the tree, in order of
 * first appearance. A SET, not a multiset: a language that drops a plural
 * branch (Japanese has no `one`) legitimately uses {count} fewer times.
 */
function simpleArgIds(nodes) {
  const ids = [];
  for (const node of walk(nodes)) {
    if (node.type !== 'arg') continue;
    const id = `${node.name}\u0000${node.argType || ''}`;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// -----------------------------------------------------------------
// printf conversions (gettext c-format / python-format, Android, Rails)
// -----------------------------------------------------------------

/**
 * printf conversions in a string, normalized for comparison: positional
 * indexes are dropped ("%1$s" → "%s", so a translation may reorder), named
 * ones keep their name ("%(count)d"). "%%" is a literal percent sign.
 * The space flag is deliberately NOT recognised: "50% off" is text.
 *
 * @param {string} text
 * @returns {string[]} Sorted conversions
 */
function printfConversions(text) {
  if (typeof text !== 'string' || !text.includes('%')) return [];
  const out = [];
  const re = /%(?:(\d+)\$)?(\([^)\s]+\))?[-+#0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|q|j|z|t)?([sdifuxXoeEgGcpr@])/g;
  const stripped = text.replace(/%%/g, '');
  let m;
  while ((m = re.exec(stripped)) !== null) {
    // %i and %d are the same conversion (msgfmt --check-format agrees).
    out.push(`%${m[2] || ''}${m[3] === 'i' ? 'd' : m[3]}`);
  }
  return out.sort();
}

// -----------------------------------------------------------------
// Structural comparison
// -----------------------------------------------------------------

/**
 * Compare a translation's ICU structure with its source's (one apostrophe
 * reading). Returns the list of damage found; empty means only text changed.
 */
function compareParsed(srcNodes, tgtNodes, locale) {
  const issues = [];
  compareLevel(srcNodes, tgtNodes, locale, issues);

  // Simple arguments, anywhere in the message: never dropped, renamed or
  // retyped. (Compared over the whole message — a translation may move
  // {name} from one branch to the sentence around it.)
  const src = simpleArgIds(srcNodes);
  const tgt = simpleArgIds(tgtNodes);
  const label = (id) => {
    const [name, argType] = id.split('\u0000');
    return argLabel({ name, argType: argType || null });
  };
  const missing = src.filter(id => !tgt.includes(id));
  const extra = tgt.filter(id => !src.includes(id));
  // A renamed placeholder reads as one missing + one extra: say so.
  while (missing.length > 0 && extra.length > 0) {
    issues.push(`placeholder ${label(missing.shift())} was changed to ${label(extra.shift())}`);
  }
  for (const id of missing) issues.push(`placeholder ${label(id)} is missing`);
  for (const id of extra) issues.push(`placeholder ${label(id)} is not in the source`);
  return issues;
}

/**
 * Compare the branching arguments of one message level (the top level, or
 * the inside of one branch) and recurse into their branches.
 */
function compareLevel(srcNodes, tgtNodes, locale, issues) {
  const srcB = srcNodes.filter(n => n.type === 'branching');
  const tgtB = tgtNodes.filter(n => n.type === 'branching');
  const used = new Set();
  const pairs = [];
  const unmatchedSrc = [];
  for (const s of srcB) {
    const t = tgtB.find(c => !used.has(c) && c.name === s.name);
    if (t) { used.add(t); pairs.push([s, t]); } else unmatchedSrc.push(s);
  }
  const unmatchedTgt = tgtB.filter(t => !used.has(t));
  // A variable that is "missing" while an unknown one appears in its place
  // was translated: pair them in order and report the rename.
  while (unmatchedSrc.length > 0 && unmatchedTgt.length > 0) {
    const s = unmatchedSrc.shift();
    const t = unmatchedTgt.shift();
    issues.push(`ICU variable '${s.name}' was translated to '${t.name}'`);
    pairs.push([s, t]);
  }
  for (const s of unmatchedSrc) issues.push(`ICU ${s.keyword} argument '${s.name}' is missing`);
  for (const t of unmatchedTgt) {
    issues.push(`ICU argument '{${t.name}, ${t.keyword}, …}' is not in the source`);
  }
  for (const [s, t] of pairs) compareBranching(s, t, locale, issues);
}

/** Compare one plural/select/selectordinal argument with its translation. */
function compareBranching(s, t, locale, issues) {
  const kind = s.keyword; // the source is the reference
  if (t.keyword !== s.keyword) {
    issues.push(BRANCHING_TYPES.has(t.keyword)
      ? `ICU argument '${s.name}' changed from ${s.keyword} to ${t.keyword}`
      : `ICU keyword '${s.keyword}' was translated to '${t.keyword}'`);
  }
  if ((s.offset ?? null) !== (t.offset ?? null)) {
    issues.push(`ICU offset for '${s.name}' changed (${s.offset ?? 'none'} → ${t.offset ?? 'none'})`);
  }

  const isPlural = kind === 'plural' || kind === 'selectordinal';
  const targetCats = isPlural
    ? categoriesFor(locale, kind === 'selectordinal' ? 'ordinal' : 'cardinal')
    : null;
  const srcSel = s.options.map(o => o.selector);
  const tgtSel = t.options.map(o => o.selector);

  const mayAdd = (sel) => isPlural && (/^=\d+$/.test(sel)
    || (targetCats ? targetCats.includes(sel) : CLDR_CATEGORIES.includes(sel)));
  const mayDrop = (sel) => isPlural && sel !== 'other' && targetCats
    && CLDR_CATEGORIES.includes(sel) && !targetCats.includes(sel);

  const absent = srcSel.filter(sel => !tgtSel.includes(sel));
  let extra = tgtSel.filter(sel => !srcSel.includes(sel) && !mayAdd(sel));
  const renamedFrom = new Map(); // target selector → source selector it replaced
  const rename = (from, to) => {
    issues.push(`ICU keyword '${from}' was translated to '${to}'`);
    renamedFrom.set(to, from);
  };
  // An unknown selector standing where a source selector was is that
  // selector, translated ("óthér" in the slot of "other") — even one the
  // target language could have dropped. A real CLDR category name in the
  // wrong language ("few" in French) is not a translation; it is reported
  // as a category the language does not have.
  const translatable = (sel) => !isPlural || !(CLDR_CATEGORIES.includes(sel) || /^=\d+$/.test(sel));
  for (const to of [...extra]) {
    if (!translatable(to)) continue;
    const from = srcSel[tgtSel.indexOf(to)];
    if (from && absent.includes(from) && ![...renamedFrom.values()].includes(from)) {
      rename(from, to);
      extra = extra.filter(e => e !== to);
    }
  }
  const missing = absent.filter(sel => !mayDrop(sel) && ![...renamedFrom.values()].includes(sel));
  const words = extra.filter(translatable);
  while (missing.length > 0 && words.length > 0) {
    const to = words.shift();
    rename(missing.shift(), to);
    extra = extra.filter(e => e !== to);
  }
  for (const sel of missing) issues.push(`ICU selector '${sel}' of '${s.name}' was removed`);
  for (const sel of extra) {
    issues.push(isPlural
      ? `'${sel}' is not one of the ${kind === 'selectordinal' ? 'ordinal' : 'plural'} categories of ${locale}`
        + (targetCats ? ` (${targetCats.join(', ')})` : '')
      : `select option '${sel}' of '${s.name}' is not in the source`);
  }

  // Branch by branch: nested structure, and the number placeholder.
  const sourcePrintf = [...new Set(s.options.flatMap(o => printfConversions(o.raw)))];
  const sourceUsesPrintf = sourcePrintf.length > 0;
  const srcBySel = new Map(s.options.map(o => [o.selector, o]));
  const srcOther = srcBySel.get('other') || s.options[s.options.length - 1];
  for (const opt of t.options) {
    const ref = srcBySel.get(opt.selector)
      || srcBySel.get(renamedFrom.get(opt.selector))
      || srcOther;
    if (!ref) continue;
    compareLevel(ref.nodes, opt.nodes, locale, issues);
    if (isPlural && hasPound(ref.nodes) && !hasPound(opt.nodes)
        && !NUMBER_WORD_SELECTOR.test(opt.selector)) {
      issues.push(`the number placeholder # is missing from the '${opt.selector}' branch of '${s.name}'`);
    }
    // A plural whose branches count with printf conversions (a gettext
    // plural) has no `#`: an ICU `#` there would be written out literally.
    if (isPlural && sourceUsesPrintf && hasPound(opt.nodes) && !hasPound(ref.nodes)) {
      issues.push(`'#' in the '${opt.selector}' branch of '${s.name}' — this message counts with printf placeholders (${sourcePrintf.join(', ')}); keep those instead of #`);
    }
  }
}

/**
 * Check that a translation kept its source's ICU MessageFormat structure.
 *
 * @param {string} source - Source value
 * @param {string} translated - Candidate translation
 * @param {string} locale - Target locale (decides which plural categories it may add)
 * @returns {{ reason: string, issues: string[], syntaxes: Array<'icu'|'printf'> }|null}
 *   null when the source carries no ICU arguments / printf conversions, or
 *   the structure survived. `syntaxes[i]` names the placeholder syntax
 *   `issues[i]` is about — 'icu' (MessageFormat arguments, keywords,
 *   selectors, #) or 'printf' (%s, %d, %(name)s) — so a report can name a
 *   lost `%(name)s` in a gettext catalog as printf, not as ICU (Round 12,
 *   Django persona: verify called it an "ICU structure error")
 */
function checkICUStructure(source, translated, locale) {
  if (typeof source !== 'string' || typeof translated !== 'string') return null;

  let issues = null;
  let syntaxes = null;

  if (source.includes('{')) {
    let firstIssues = null;
    let applicable = false;
    for (const apostrophes of ['icu', 'literal']) {
      const src = parseMessage(source, { apostrophes });
      // A source that is not a well-formed message under this reading has
      // no structure to protect under it ({{count}}, Hugo "{{ .Count }}").
      if (!src.ok || !hasArguments(src.nodes)) continue;
      applicable = true;
      const tgt = parseMessage(translated, { apostrophes });
      const found = tgt.ok
        ? compareParsed(src.nodes, tgt.nodes, locale)
        : [`ICU syntax broken (${tgt.error})`];
      if (found.length === 0) { firstIssues = []; break; }
      if (firstIssues === null) firstIssues = found;
    }
    if (applicable && firstIssues && firstIssues.length > 0) {
      issues = firstIssues;
      syntaxes = firstIssues.map(() => 'icu');
    }
  }

  // printf conversions — independent of ICU (a gettext msgid has no braces).
  // Compared as SETS: a plural translation that adds a category (Russian
  // few/many) repeats %d legitimately.
  const srcPrintf = [...new Set(printfConversions(source))];
  if (srcPrintf.length > 0) {
    const tgtPrintf = [...new Set(printfConversions(translated))];
    const missing = srcPrintf.filter(c => !tgtPrintf.includes(c));
    const extra = tgtPrintf.filter(c => !srcPrintf.includes(c));
    if (missing.length > 0 || extra.length > 0) {
      issues = issues || [];
      syntaxes = syntaxes || [];
      for (const c of missing) { issues.push(`printf placeholder ${c} is missing`); syntaxes.push('printf'); }
      for (const c of extra) { issues.push(`printf placeholder ${c} is not in the source`); syntaxes.push('printf'); }
    }
  }

  if (!issues || issues.length === 0) return null;
  return { reason: `ICU/placeholder structure damaged: ${issues.join('; ')}`, issues, syntaxes };
}

/**
 * Prompt guidance for a source value carrying plural / select / selectordinal
 * syntax, naming the plural categories the TARGET language uses (CLDR).
 *
 * @param {string} source
 * @param {string} locale - Target locale
 * @param {string} [languageName] - Display name for the prompt
 * @returns {string|null}
 */
function icuGuidance(source, locale, languageName = locale) {
  if (typeof source !== 'string' || !source.includes('{')) return null;
  const parsed = parseMessage(source, { apostrophes: 'icu' });
  const nodes = parsed.ok ? parsed.nodes : (parseMessage(source, { apostrophes: 'literal' }).nodes || null);
  if (!nodes || !hasBranching(nodes)) return null;

  const kinds = new Set();
  const names = new Set();
  for (const node of walk(nodes)) {
    if (node.type === 'branching') { kinds.add(node.keyword); names.add(node.name); }
  }
  const parts = [
    `ICU MessageFormat: keep the syntax exactly — the variable name(s) ${[...names].map(n => `"${n}"`).join(', ')}, `
    + `the word(s) ${[...kinds].join('/')}, every selector (=0, one, other, …), # and {placeholders} — `
    + 'and translate only the text inside the branches.',
  ];
  if (kinds.has('plural')) {
    const cats = categoriesFor(locale, 'cardinal');
    if (cats) {
      parts.push(`${languageName} plural categories (CLDR): ${describeCategories(locale, cats, 'cardinal')}`
        + ' — write a branch for each one it needs, keep "other".');
    }
  }
  if (kinds.has('selectordinal')) {
    const cats = categoriesFor(locale, 'ordinal');
    if (cats) parts.push(`${languageName} ordinal categories (CLDR): ${describeCategories(locale, cats, 'ordinal')}.`);
  }
  return parts.join(' ');
}

// -----------------------------------------------------------------
// Plural forms a translation did not supply
// -----------------------------------------------------------------

/** The largest count treated as "everyday" (see pluralCategoryUse). */
const EVERYDAY_MAX = 1000;
const useCache = new Map();

/**
 * Which of a locale's CLDR plural categories ordinary counts reach.
 *
 *   everyday  categories CLDR assigns to some integer 0…1000 (besides
 *             `other`, which ICU requires anyway): Russian one/few/many,
 *             Polish one/few/many, Arabic zero/one/two/few/many. A message
 *             without one of them shows the wrong form for counts a UI
 *             displays all the time (Russian "2 файлов").
 *   rare      categories reached only by larger or fractional numbers
 *             (French/Spanish/Italian `many`: 1 000 000; Lithuanian `many`:
 *             fractions). Missing one is worth saying, not worth a warning.
 *
 * @param {string} locale
 * @param {'cardinal'|'ordinal'} [type='cardinal']
 * @returns {{ categories: string[], everyday: string[], rare: string[],
 *   members: Map<string, number[]> } | null} null when CLDR has no rules
 *   for the locale; `members` = the integers 0…EVERYDAY_MAX per category
 */
function pluralCategoryUse(locale, type = 'cardinal') {
  const id = `${locale}\u0000${type}`;
  if (useCache.has(id)) return useCache.get(id);
  const categories = categoriesFor(locale, type);
  let result = null;
  if (categories) {
    let rules = null;
    try { rules = new Intl.PluralRules(String(locale).replace(/_/g, '-'), { type }); } catch { rules = null; }
    const members = new Map(categories.map(c => [c, []]));
    if (rules) {
      for (let n = 0; n <= EVERYDAY_MAX; n++) members.get(rules.select(n))?.push(n);
    }
    const everyday = categories.filter(c => c !== 'other' && members.get(c).length > 0);
    const rare = categories.filter(c => c !== 'other' && members.get(c).length === 0);
    result = { categories, everyday, rare, members };
  }
  useCache.set(id, result);
  return result;
}

/** Parse under the first apostrophe reading that yields a plural/select. */
function parseBranching(text) {
  if (typeof text !== 'string' || !text.includes('{')) return null;
  for (const apostrophes of ['literal', 'icu']) {
    const parsed = parseMessage(text, { apostrophes });
    if (parsed.ok && hasBranching(parsed.nodes)) return parsed.nodes;
  }
  return null;
}

/**
 * The CLDR plural categories a translated ICU message does not supply for
 * its target locale — the forms the runtime will take from `other`
 * (ICU, next-intl, Flutter ARB) or that a gettext catalog repeats from it.
 *
 * Only arguments whose SOURCE inflects are judged: a source plural with
 * nothing but `other` ("{n, plural, other {Items: #}}") is count-agnostic
 * by design. An everyday category is also supplied when exact `=N`
 * branches cover every count it takes (French `one` is 0 and 1: `=0` and
 * `=1` together cover it).
 *
 * A gettext catalog holds only the forms its Plural-Forms header has slots
 * for (`slots`, lib/po.js poPluralSlots): a cardinal form without a slot
 * cannot be written, so it is not a gap (French "many" in a two-form
 * catalog; Hebrew "two" in msginit's two-form header).
 *
 * @param {string} source - Source message
 * @param {string} translated - Translated message
 * @param {string} locale - Target locale
 * @param {string[]|null} [slots] - Cardinal categories the target can hold (null = all CLDR's)
 * @returns {Array<{ name: string, type: 'cardinal'|'ordinal', everyday: string[], rare: string[] }>}
 *   one entry per plural/selectordinal argument with something missing
 */
function pluralGaps(source, translated, locale, slots = null) {
  const tgt = parseBranching(translated);
  const src = tgt ? parseBranching(source) : null;
  if (!tgt || !src) return [];
  const srcArgs = [...walk(src)].filter(n => n.type === 'branching');
  const gaps = [];
  for (const node of walk(tgt)) {
    if (node.type !== 'branching' || (node.keyword !== 'plural' && node.keyword !== 'selectordinal')) continue;
    const ref = srcArgs.find(s => s.name === node.name && s.keyword === node.keyword);
    if (!ref || ref.options.every(o => o.selector === 'other')) continue;
    const type = node.keyword === 'selectordinal' ? 'ordinal' : 'cardinal';
    const use = pluralCategoryUse(locale, type);
    if (!use) continue;
    const present = new Set(node.options.map(o => o.selector));
    const exact = new Set([...present].filter(sel => /^=\d+$/.test(sel)).map(sel => Number(sel.slice(1))));
    const covered = (cat) => present.has(cat)
      || (use.members.get(cat).length > 0 && use.members.get(cat).length <= exact.size
        && use.members.get(cat).every(n => exact.has(n)));
    const holds = (c) => !slots || type !== 'cardinal' || slots.includes(c);
    const everyday = use.everyday.filter(c => holds(c) && !covered(c));
    const rare = use.rare.filter(c => holds(c) && !present.has(c));
    if (everyday.length > 0 || rare.length > 0) gaps.push({ name: node.name, type, everyday, rare });
  }
  return gaps;
}

/**
 * The text of each translated plural/select branch beside the source branch
 * it translates: the same selector, or — for a category the target adds
 * (Russian few/many from English one/other) — the source's `other`. Nested
 * branching pairs recursively by argument name. So per-branch checks (an
 * echo of the English in ONE form) can run on a message whose whole string
 * differs from the source — a gettext msgstr[n] plural reads as one ICU
 * message here (lib/po.js).
 *
 * @param {string} source
 * @param {string} translated
 * @returns {Array<{ selector: string, source: string, translated: string }>} [] when
 *   either side has no plural/select
 */
function pluralBranchPairs(source, translated) {
  const tgt = parseBranching(translated);
  const src = tgt ? parseBranching(source) : null;
  if (!tgt || !src) return [];
  const out = [];
  const visit = (srcNodes, tgtNodes) => {
    const srcArgs = srcNodes.filter(n => n.type === 'branching');
    for (const node of tgtNodes) {
      if (node.type !== 'branching') continue;
      const ref = srcArgs.find(a => a.name === node.name) || null;
      if (!ref) continue;
      for (const opt of node.options) {
        const match = ref.options.find(o => o.selector === opt.selector)
          || ref.options.find(o => o.selector === 'other');
        if (!match) continue;
        if (opt.nodes.some(n => n.type === 'branching') && match.nodes.some(n => n.type === 'branching')) {
          visit(match.nodes, opt.nodes);
        } else {
          out.push({ selector: opt.selector, source: match.raw, translated: opt.raw, keyword: node.keyword, name: node.name });
        }
      }
    }
  };
  visit(src, tgt);
  return out;
}

/**
 * The leaf branch texts of a plural/select message (nested branching
 * flattened), or null when it has none. The repetition detector measures
 * each branch on its own: a Russian plural repeats one sentence in four
 * forms by design.
 *
 * @param {string} text
 * @returns {string[]|null}
 */
function pluralBranchTexts(text) {
  const nodes = parseBranching(text);
  if (!nodes) return null;
  const out = [];
  const visit = (list) => {
    for (const node of list) {
      if (node.type !== 'branching') continue;
      for (const opt of node.options) {
        if (opt.nodes.some(n => n.type === 'branching')) visit(opt.nodes);
        else out.push(opt.raw);
      }
    }
  };
  visit(nodes);
  return out.length > 0 ? out : null;
}

// -----------------------------------------------------------------
// Markup: tags are code too
// -----------------------------------------------------------------

/** A tag: <b>, </b>, <br/>, <a href="…">, react-intl <link>, react-i18next <0>. */
const TAG = /<(\/?)([A-Za-z][\w:.-]*|\d+)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
/** HTML elements that never close. */
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/**
 * Tags in a text, with their nesting: per tag name the open / close /
 * self-closing counts, the (tag, parent) pairs, and whether it nests.
 */
function readTags(text) {
  const counts = new Map();
  const parents = [];
  const stack = [];
  let wellNested = true;
  const bump = (name, field) => {
    if (!counts.has(name)) counts.set(name, { open: 0, close: 0, self: 0 });
    counts.get(name)[field]++;
  };
  for (const m of String(text).matchAll(TAG)) {
    const [, slash, name, , selfSlash] = m;
    const isVoid = VOID_ELEMENTS.has(name.toLowerCase());
    if (slash) {
      bump(name, 'close');
      if (stack.length > 0 && stack[stack.length - 1] === name) stack.pop();
      else wellNested = false;
    } else if (selfSlash || isVoid) {
      bump(name, 'self');
      parents.push(`${name}<${stack[stack.length - 1] || ''}`);
    } else {
      bump(name, 'open');
      parents.push(`${name}<${stack[stack.length - 1] || ''}`);
      stack.push(name);
    }
  }
  if (stack.length > 0) wellNested = false;
  return { counts, parents: parents.sort(), wellNested, any: counts.size > 0 };
}

/** Problems with one target text's tags against its source's. */
function compareTags(source, translated) {
  const src = readTags(source);
  const tgt = readTags(translated);
  if (!src.any && !tgt.any) return [];
  const issues = [];
  const names = [...new Set([...src.counts.keys(), ...tgt.counts.keys()])].sort();
  for (const name of names) {
    const a = src.counts.get(name) || { open: 0, close: 0, self: 0 };
    const b = tgt.counts.get(name) || { open: 0, close: 0, self: 0 };
    if (a.open === b.open && a.close === b.close && a.self === b.self) continue;
    if (a.open + a.close + a.self === 0) { issues.push(`<${name}> is not in the source`); continue; }
    if (b.open + b.close + b.self === 0) { issues.push(`<${name}> is missing`); continue; }
    if (a.open !== b.open) issues.push(`<${name}> is opened ${b.open} time(s), ${a.open} in the source`);
    if (a.close !== b.close) issues.push(`</${name}> closes ${b.close} time(s), ${a.close} in the source`);
    if (a.self !== b.self) issues.push(`<${name}/> appears ${b.self} time(s), ${a.self} in the source`);
  }
  if (issues.length === 0) {
    if (src.wellNested && !tgt.wellNested) issues.push('tags no longer nest (a tag closes inside another it opened before)');
    else if (src.parents.join('|') !== tgt.parents.join('|')) issues.push('tags nest differently (a tag moved into or out of another)');
  }
  return issues;
}

/**
 * Check that a translation kept its source's markup: per tag name the same
 * number of opening, closing and self-closing tags, nesting the same way.
 * Sibling order may change (word order does); what a tag contains may not.
 * `verify` used to compare tag NAMES as a set, so a lost `</strong>` passed
 * — only dropping both tags was caught (Round 4, Django persona). Shared by
 * the quality gate (lib/validate.js) and verify (lib/integrity.js).
 *
 * In a plural/select message each branch is compared with the source branch
 * it translates (a Russian few/many form repeats `other`'s tags).
 *
 * @param {string} source
 * @param {string} translated
 * @returns {{ reason: string, issues: string[] }|null}
 */
function checkMarkup(source, translated) {
  if (typeof source !== 'string' || typeof translated !== 'string') return null;
  if (!source.includes('<') && !translated.includes('<')) return null;
  const pairs = source.includes('{') ? pluralBranchPairs(source, translated) : [];
  let issues;
  if (pairs.length > 0) {
    issues = [];
    for (const p of pairs) {
      for (const issue of compareTags(p.source, p.translated)) issues.push(`${issue} (plural form "${p.selector}")`);
    }
  } else {
    issues = compareTags(source, translated);
  }
  if (issues.length === 0) return null;
  return { reason: `markup damaged: ${[...new Set(issues)].join('; ')}`, issues: [...new Set(issues)] };
}

/**
 * The words for plural forms a message lacks — ONE wording, and one
 * everyday/rare rule (pluralGaps), for sync and integrity alike (Round 5,
 * Next.js persona: sync called a missing French `many` fine while integrity
 * warned about it).
 *
 *   everyday → `no "few" and "many" form, which Russian uses for few (2, 3, 4), many (0, 5, 6)`
 *   rare     → `no "many" form — French uses it only above 1000 or for fractions (many (1000000)); the "other" form is used there`
 *
 * @param {string} locale
 * @param {string[]} cats - Missing categories
 * @param {'cardinal'|'ordinal'} type
 * @param {string} name - The language's display name
 * @param {'everyday'|'rare'} kind
 * @returns {string}
 */
function describePluralGap(locale, cats, type, name, kind) {
  const quoted = cats.map(c => `"${c}"`);
  const words = quoted.length <= 1 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
  const counts = describeCategories(locale, cats, type);
  if (kind === 'rare') {
    return `no ${words} form — ${name} uses ${cats.length === 1 ? 'it' : 'them'} only above ${EVERYDAY_MAX} or for fractions `
      + `(${counts}); the "other" form is used there`;
  }
  return `no ${words} form, which ${name} uses for ${counts}`;
}

/** "one (1, 21, 31), few (2, 3, 4), many (0, 5, 6), other" — counts from Intl.PluralRules. */
const descriptionCache = new Map();
function describeCategories(locale, cats, type) {
  // Keyed by the categories asked for too: a report about Russian few/many
  // must not get the description cached for all four.
  const id = `${locale}\u0000${type}\u0000${cats.join(',')}`;
  if (!descriptionCache.has(id)) descriptionCache.set(id, computeDescription(locale, cats, type));
  return descriptionCache.get(id);
}

function computeDescription(locale, cats, type) {
  let rules;
  try { rules = new Intl.PluralRules(String(locale).replace(/_/g, '-'), { type }); } catch { return cats.join(', '); }
  const samples = new Map(cats.map(c => [c, []]));
  const probe = [];
  for (let n = 0; n <= 120; n++) probe.push(n);
  probe.push(1000, 1000000);
  for (const n of probe) {
    const c = rules.select(n);
    const list = samples.get(c);
    if (list && list.length < 3) list.push(n);
  }
  return cats.map(c => (samples.get(c)?.length ? `${c} (${samples.get(c).join(', ')})` : c)).join(', ');
}

export {
  checkMarkup,
  pluralBranchPairs,
  pluralBranchTexts,
  parseMessage,
  checkICUStructure,
  icuGuidance,
  pluralGaps,
  pluralCategoryUse,
  describeCategories,
  describePluralGap,
  printfConversions,
  hasArguments,
  hasBranching,
  CLDR_CATEGORIES,
};
