/**
 * gettext catalogs (.po / .pot) — read into the flat key → value map the
 * sync engine diffs and translates, and write back without disturbing
 * anything sync did not translate.
 *
 * KEYS. An entry's key is its msgid. An entry with a context is keyed
 * `msgctxt + "\u0004" + msgid` — gettext's own encoding (the string a .mo
 * file stores and pgettext() looks up), so it cannot collide with any
 * msgid and does not clash with the `<ns>::<key>` namespace separator.
 *
 * VALUES.
 *   source (.pot, or the source-language .po)
 *       msgstr when filled, else msgid — a .pot and `makemessages -l en`
 *       both leave msgstr empty, so the msgid IS the English text.
 *   target
 *       msgstr. An empty msgstr, or an entry flagged `fuzzy`, is
 *       UNTRANSLATED: it is absent from the map, so sync translates it.
 *
 * PLURALS. An entry with msgid_plural is ONE key whose value is an ICU
 * plural message, e.g.
 *
 *   msgid "One file"  msgid_plural "%d files"
 *     → "{n, plural, one {One file} other {%d files}}"
 *
 * The model translates the whole message at once (each CLDR category of
 * the target language — Polish one/few/many/other), the ICU structure gate
 * protects it, and the writer maps categories onto the target's msgstr[i]
 * through its Plural-Forms header: each index takes the CLDR category of
 * the numbers that select it (Russian "n%10==1 && n%100!=11 ? 0 : …" →
 * [one, few, many]). Branch text is copied verbatim — nothing inside it is
 * interpreted — so %d, {name} and # survive byte for byte.
 *
 * PLURAL-FORMS. The target's own header is used when it has a valid one
 * (Django `makemessages`, `msginit` and `pybabel init` all write it). A
 * target without one (a catalog champollion creates) gets the header GNU
 * msginit writes for its language (shared/gettext-plural-forms.json —
 * French "nplurals=2; plural=(n > 1);"), so its msgstr[] slots are the ones
 * gettext and Django select. A CLDR-derived French header (nplurals=3, for
 * the rare "many" of 1 000 000) left every French plural carrying a
 * permanent "write them, then delete this line" comment (Round 6, Django
 * persona). A language msginit has no entry for gets a header derived from
 * CLDR: the categories Intl.PluralRules gives integers, in CLDR order, and
 * an expression synthesized from them and VERIFIED against
 * Intl.PluralRules over 0…3000 and large probes. A language whose integer
 * rules cannot be expressed that way fails loud with the msginit command to
 * run instead — a guessed expression would pick the wrong form at runtime.
 *
 * LOSSLESS. Every entry keeps its raw text. Writing re-emits an entry
 * byte-for-byte unless sync changed its value; a changed entry keeps its
 * translator comments, takes the source's references, extracted comments
 * and flags, loses `fuzzy` (and the `#|` previous-msgid lines that only
 * mean something on a fuzzy entry). Entries the source no longer has and
 * obsolete `#~` entries are kept, at the end, as they were.
 *
 * LIMITS (documented): UTF-8 catalogs only (others fail loud with the
 * msgconv command); a plural msgid whose braces do not balance cannot be
 * written as an ICU message and is reported, not translated.
 */

import fs from 'node:fs';
import { parseMessage } from './icu-structure.js';
import { pluralCategoriesFor } from './plurals.js';

/** msginit's Plural-Forms per language (shared/gettext-plural-forms.json), read once. */
let gettextForms = null;
function gettextPluralTable() {
  if (gettextForms === null) {
    const file = new URL('../shared/gettext-plural-forms.json', import.meta.url);
    // Fail loud: a missing table would silently give every new catalog the
    // CLDR header instead of the one gettext writes.
    gettextForms = JSON.parse(fs.readFileSync(file, 'utf-8')).forms;
  }
  return gettextForms;
}

/**
 * The Plural-Forms header GNU msginit writes for `locale` (its built-in
 * table, looked up as msginit does: the full code, then the language), or
 * null when msginit has none.
 *
 * @param {string} locale - "fr", "pt-BR", "pt_BR"
 * @returns {{ nplurals: number, expression: string, evaluate: Function }|null}
 */
function gettextPluralForms(locale) {
  if (!locale) return null;
  const parts = String(locale).replace(/-/g, '_').split('_');
  const lang = parts[0].toLowerCase();
  const region = parts.slice(1).find(p => /^[A-Za-z]{2}$|^\d{3}$/.test(p));
  const table = gettextPluralTable();
  const value = (region && table[`${lang}_${region.toUpperCase()}`]) || table[lang] || null;
  return value ? parsePluralForms(value) : null;
}

/** gettext's msgctxt/msgid separator (EOT). */
const PO_CONTEXT_SEPARATOR = '\u0004';

/**
 * A key as a report shows it: quoted, with the invisible context separator
 * as "␄" (what `--redo keys:` accepts back) — JSON.stringify printed it as
 * the six characters `\u0004`, which nothing accepts.
 */
function visibleKey(key) {
  return `"${String(key).replace(/\u0004/g, '\u2404').replace(/\n/g, '\\n')}"`;
}

/** The ICU variable name a plural entry is written with. */
const PO_PLURAL_ARG = 'n';

const CLDR_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

// -----------------------------------------------------------------
// Strings
// -----------------------------------------------------------------

function unescapeC(body) {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== '\\') { out += ch; continue; }
    const next = body[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 't': out += '\t'; break;
      case 'r': out += '\r'; break;
      case 'a': out += '\x07'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case 'v': out += '\v'; break;
      case '\\': out += '\\'; break;
      case '"': out += '"'; break;
      case "'": out += "'"; break;
      case '?': out += '?'; break;
      case 'x': {
        const m = /^[0-9a-fA-F]+/.exec(body.slice(i + 1));
        if (m) { out += String.fromCharCode(parseInt(m[0], 16)); i += m[0].length; } else out += 'x';
        break;
      }
      default:
        if (next >= '0' && next <= '7') {
          const m = /^[0-7]{1,3}/.exec(body.slice(i));
          out += String.fromCharCode(parseInt(m[0], 8));
          i += m[0].length - 1;
        } else if (next !== undefined) {
          out += next;
        }
    }
  }
  return out;
}

function escapeC(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

/** Body of a `"..."` token (the quotes stripped), or null. */
function quoted(text) {
  const t = text.trim();
  if (t.length < 2 || t[0] !== '"' || t[t.length - 1] !== '"') return null;
  return t.slice(1, -1);
}

/**
 * Lines for `keyword "value"` in gettext's own style: one line, or — when
 * the value has embedded newlines — an empty first string and one line per
 * newline-terminated chunk.
 */
function formatField(keyword, value) {
  const inner = value.slice(0, -1);
  if (!inner.includes('\n')) return [`${keyword} "${escapeC(value)}"`];
  const lines = [`${keyword} ""`];
  const chunks = value.split(/(?<=\n)/);
  for (const chunk of chunks) lines.push(`"${escapeC(chunk)}"`);
  return lines;
}

// -----------------------------------------------------------------
// Parser
// -----------------------------------------------------------------

/**
 * Parse a PO/POT file.
 *
 * @param {string} text - File content (BOM already stripped)
 * @param {string} [filePath] - For error messages
 * @returns {{ lines: string[], eol: string, entries: PoEntry[], header: PoEntry|null }}
 *
 * @typedef {object} PoEntry
 * @property {number} start - First line index (inclusive)
 * @property {number} end - Last line index (inclusive)
 * @property {'header'|'entry'|'obsolete'|'comment'} kind
 * @property {string[]} translatorComments - Raw `# …` lines
 * @property {string[]} extractedComments - Text of `#. …` lines
 * @property {string[]} references - Raw `#: …` lines
 * @property {string[]} flags - From `#, …` lines
 * @property {string|null} msgctxt
 * @property {string|null} msgid
 * @property {string|null} msgidPlural
 * @property {string[]} msgstr - msgstr, or msgstr[0..n]
 * @property {object} fieldLines - keyword → [start, end] raw line range
 */
function parsePO(text, filePath = '') {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let cur = null;
  let field = null; // { name, index } — the field continuation strings extend

  const begin = (i) => {
    cur = {
      start: i, end: i, kind: 'entry',
      translatorComments: [], extractedComments: [], references: [], flags: [], previous: [],
      msgctxt: null, msgid: null, msgidPlural: null, msgstr: [],
      fieldLines: {}, obsolete: false, seenKeyword: false, seenMsgid: false,
    };
    entries.push(cur);
    field = null;
  };
  const where = (i) => `${filePath ? `${filePath}:` : 'line '}${i + 1}`;

  const setField = (name, index, value, i) => {
    if (name === 'msgstr') {
      cur.msgstr[index] = (cur.msgstr[index] || '') + value;
    } else if (name === 'msgctxt') {
      cur.msgctxt = (cur.msgctxt || '') + value;
    } else if (name === 'msgid') {
      cur.msgid = (cur.msgid || '') + value;
    } else if (name === 'msgid_plural') {
      cur.msgidPlural = (cur.msgidPlural || '') + value;
    }
    const fl = name === 'msgstr' ? `msgstr[${index}]` : name;
    if (!cur.fieldLines[fl]) cur.fieldLines[fl] = [i, i];
    else cur.fieldLines[fl][1] = i;
    cur.end = i;
  };

  const keyword = (content, i, obsolete) => {
    const m = /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+(".*")\s*$/.exec(content);
    if (!m) throw new Error(`${where(i)}: cannot parse "${content.slice(0, 60)}"`);
    const [, name, idx, str] = m;
    // A new msgctxt/msgid after the previous entry's msgid starts a new entry.
    if (!cur || ((name === 'msgctxt' || name === 'msgid') && cur.seenMsgid)
        || (name === 'msgctxt' && cur.msgctxt !== null)) {
      begin(i);
    }
    if (obsolete) cur.obsolete = true;
    cur.seenKeyword = true;
    if (name === 'msgid') cur.seenMsgid = true;
    const body = quoted(str);
    if (body === null) throw new Error(`${where(i)}: malformed string ${str.slice(0, 60)}`);
    field = { name, index: idx === undefined ? 0 : Number(idx) };
    setField(name, field.index, unescapeC(body), i);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t === '') {
      if (cur && cur.seenKeyword) { cur = null; field = null; }
      continue;
    }
    if (t.startsWith('#~')) {
      const content = t.slice(2).trim();
      if (content.startsWith('|') || content === '') {
        if (!cur || cur.seenKeyword) begin(i);
        cur.obsolete = true;
        cur.end = i;
        continue;
      }
      if (content.startsWith('"')) {
        if (!cur || !field) throw new Error(`${where(i)}: string continuation without a keyword`);
        const body = quoted(content);
        if (body === null) throw new Error(`${where(i)}: malformed string`);
        setField(field.name, field.index, unescapeC(body), i);
        continue;
      }
      keyword(content, i, true);
      continue;
    }
    if (t.startsWith('#')) {
      if (!cur || cur.seenKeyword) begin(i);
      cur.end = i;
      field = null;
      if (t.startsWith('#.')) cur.extractedComments.push(t.slice(2).trim());
      else if (t.startsWith('#:')) cur.references.push(line);
      else if (t.startsWith('#,')) {
        for (const f of t.slice(2).split(',')) if (f.trim()) cur.flags.push(f.trim());
      } else if (t.startsWith('#|')) cur.previous.push(line);
      else cur.translatorComments.push(line);
      continue;
    }
    if (t.startsWith('"')) {
      if (!cur || !field) throw new Error(`${where(i)}: string continuation without a keyword`);
      const body = quoted(t);
      if (body === null) throw new Error(`${where(i)}: malformed string ${t.slice(0, 60)}`);
      setField(field.name, field.index, unescapeC(body), i);
      continue;
    }
    keyword(t, i, false);
  }

  let header = null;
  for (const e of entries) {
    if (!e.seenKeyword) e.kind = 'comment';
    else if (e.obsolete) e.kind = 'obsolete';
    else if (e.msgid === '' && e.msgctxt === null) {
      if (!header) { e.kind = 'header'; header = e; }
    }
    if (e.kind === 'entry' && e.msgid === null) {
      throw new Error(`${where(e.start)}: entry without msgid`);
    }
  }
  return { lines, eol, entries, header };
}

/** The flat-map key of an entry. */
function entryKey(e) {
  return e.msgctxt !== null ? `${e.msgctxt}${PO_CONTEXT_SEPARATOR}${e.msgid}` : e.msgid;
}

/** An entry's exact original text. */
function rawText(parsed, e) {
  return parsed.lines.slice(e.start, e.end + 1).join('\n');
}

/** Header fields in order: [[name, value], …]. */
function headerFields(header) {
  if (!header) return [];
  const out = [];
  for (const line of (header.msgstr[0] || '').split('\n')) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}

function headerField(header, name) {
  const f = headerFields(header).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return f ? f[1] : null;
}

/** Refuse a non-UTF-8 catalog: this module reads and writes UTF-8. */
function assertUtf8(header, filePath) {
  const ct = headerField(header, 'Content-Type');
  const m = ct && /charset\s*=\s*([^;\s]+)/i.exec(ct);
  if (!m) return;
  const cs = m[1].toUpperCase();
  if (cs === 'UTF-8' || cs === 'UTF8' || cs === 'CHARSET') return;
  throw new Error(
    `${filePath || 'PO file'}: charset ${m[1]} — champollion reads and writes UTF-8 catalogs. `
    + `Convert it first: msgconv --to-code=UTF-8 -o "${filePath || 'file.po'}" "${filePath || 'file.po'}"`);
}

// -----------------------------------------------------------------
// Plural-Forms
// -----------------------------------------------------------------

/**
 * Compile a gettext plural expression ("n%10==1 && n%100!=11 ? 0 : 1") into
 * a function. The grammar is gettext's (plural-exp.y): ?:, ||, &&, == !=,
 * < > <= >=, + -, * / %, unary !, parentheses, the variable n and
 * non-negative integers. No eval.
 *
 * @param {string} expression
 * @returns {(n: number) => number}
 */
function compilePluralExpression(expression) {
  const tokens = [];
  const re = /\s*(n|\d+|\?|:|\|\||&&|==|!=|<=|>=|<|>|\+|-|\*|\/|%|!|\(|\))/y;
  let pos = 0;
  const src = String(expression).trim().replace(/;$/, '');
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new Error(`unexpected "${src.slice(pos, pos + 10)}" in plural expression`);
    tokens.push(m[1]);
    pos = re.lastIndex;
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  }
  let i = 0;
  const peek = () => tokens[i];
  const take = (t) => {
    if (tokens[i] !== t) throw new Error(`expected "${t}" in plural expression, got "${tokens[i] ?? 'end'}"`);
    i++;
  };
  const bool = (v) => (v ? 1 : 0);

  function ternary() {
    const cond = or();
    if (peek() === '?') {
      i++;
      const a = ternary();
      take(':');
      const b = ternary();
      return (n) => (cond(n) ? a(n) : b(n));
    }
    return cond;
  }
  function binary(next, ops) {
    return function level() {
      let left = next();
      while (ops[peek()]) {
        const op = ops[tokens[i++]];
        const right = next();
        const l = left;
        left = (n) => op(l(n), right(n));
      }
      return left;
    };
  }
  function unary() {
    if (peek() === '!') { i++; const v = unary(); return (n) => bool(!v(n)); }
    return primary();
  }
  function primary() {
    const t = tokens[i++];
    if (t === undefined) throw new Error('plural expression ends early');
    if (t === '(') { const v = ternary(); take(')'); return v; }
    if (t === 'n') return (n) => n;
    if (/^\d+$/.test(t)) { const k = Number(t); return () => k; }
    throw new Error(`unexpected "${t}" in plural expression`);
  }
  const mul = binary(unary, {
    '*': (a, b) => a * b,
    '/': (a, b) => (b === 0 ? 0 : Math.trunc(a / b)),
    '%': (a, b) => (b === 0 ? 0 : a % b),
  });
  const add = binary(mul, { '+': (a, b) => a + b, '-': (a, b) => a - b });
  const rel = binary(add, {
    '<': (a, b) => bool(a < b), '>': (a, b) => bool(a > b),
    '<=': (a, b) => bool(a <= b), '>=': (a, b) => bool(a >= b),
  });
  const eq = binary(rel, { '==': (a, b) => bool(a === b), '!=': (a, b) => bool(a !== b) });
  const and = binary(eq, { '&&': (a, b) => bool(a && b) });
  const or = binary(and, { '||': (a, b) => bool(a || b) });

  const fn = ternary();
  if (i !== tokens.length) throw new Error(`unexpected "${tokens[i]}" in plural expression`);
  return (n) => Number(fn(n));
}

/**
 * Parse a `Plural-Forms:` header value. Template placeholders
 * ("nplurals=INTEGER; plural=EXPRESSION;") and invalid expressions are null.
 *
 * @param {string|null} value
 * @returns {{ nplurals: number, expression: string, evaluate: Function }|null}
 */
function parsePluralForms(value) {
  if (!value) return null;
  const m = /nplurals\s*=\s*(\d+)\s*;\s*plural\s*=\s*(.+?)\s*;?\s*$/.exec(value);
  if (!m) return null;
  const nplurals = Number(m[1]);
  if (!(nplurals >= 1)) return null;
  try {
    const evaluate = compilePluralExpression(m[2]);
    for (const n of [0, 1, 2, 3, 5, 11, 21, 101, 1000000]) {
      const k = evaluate(n);
      if (!Number.isInteger(k) || k < 0 || k >= nplurals) return null;
    }
    return { nplurals, expression: m[2].trim(), evaluate };
  } catch {
    return null;
  }
}

/** Integers probed beyond the exhaustive range (CLDR rules on n%1000000, …). */
const LARGE_PROBES = [];
for (const k of [1, 2, 3, 5, 10, 21, 100]) {
  for (const r of [0, 1, 2, 3, 5, 11, 12, 21, 100, 101]) LARGE_PROBES.push(k * 1000000 + r);
}
LARGE_PROBES.push(10000, 10001, 100000, 100001, 1000000000);

/** Render "v==a || (v>=b && v<=c)" for a sorted list of integers. */
function renderSet(v, values) {
  const runs = [];
  for (const x of values) {
    const last = runs[runs.length - 1];
    if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]);
  }
  const parts = runs.map(([a, b]) => {
    if (a === b) return `${v}==${a}`;
    return a === 0 ? `${v}<=${b}` : `(${v}>=${a} && ${v}<=${b})`;
  });
  return parts.length === 1 ? parts[0] : `(${parts.join(' || ')})`;
}

/** Shortest condition on n%100 (or n%10 with exceptions) for a residue set. */
function renderResidues(residues) {
  const direct = renderSet('n%100', residues);
  const set = new Set(residues);
  const digits = [];
  for (let a = 0; a < 10; a++) {
    let c = 0;
    for (let r = a; r < 100; r += 10) if (set.has(r)) c++;
    if (c > 5) digits.push(a);
  }
  if (digits.length === 0) return direct;
  const base = [];
  for (let r = 0; r < 100; r++) if (digits.includes(r % 10)) base.push(r);
  const except = base.filter(r => !set.has(r));
  const plus = residues.filter(r => !digits.includes(r % 10));
  let viaDigits = renderSet('n%10', digits);
  if (except.length > 0) {
    const set = renderSet('n%100', except);
    const not = except.length === 1 ? `n%100!=${except[0]}` : (set.startsWith('(') ? `!${set}` : `!(${set})`);
    viaDigits = `(${viaDigits} && ${not})`;
  }
  if (plus.length > 0) viaDigits = `(${viaDigits} || ${renderSet('n%100', plus)})`;
  return viaDigits.length < direct.length ? viaDigits : direct;
}

/**
 * A Plural-Forms header for `locale`, derived from CLDR (Intl.PluralRules)
 * and verified, or null when CLDR has no rules for the locale or its
 * integer rules do not reduce to small-number exceptions + a period of 100
 * (+ the n%1000000 rule some languages use for "millions of").
 *
 * @param {string} locale
 * @returns {{ nplurals: number, expression: string, categories: string[], evaluate: Function }|null}
 */
function synthesizePluralForms(locale) {
  if (!pluralCategoriesFor(locale)) return null;
  let rules;
  try { rules = new Intl.PluralRules(String(locale).replace(/_/g, '-')); } catch { return null; }
  const LIMIT = 3100;
  const cat = [];
  for (let n = 0; n < LIMIT; n++) cat.push(rules.select(n));
  const seen = new Set(cat);
  for (const n of LARGE_PROBES) seen.add(rules.select(n));
  const categories = CLDR_ORDER.filter(c => seen.has(c));
  if (categories.length === 1) {
    return { nplurals: 1, expression: '0', categories, evaluate: () => 0 };
  }
  const index = (c) => categories.indexOf(c);
  const fallback = categories.includes('other') ? 'other' : categories[categories.length - 1];

  // Periodic (mod 100) from T on.
  let T = 0;
  for (let n = 0; n + 100 < LIMIT; n++) if (cat[n] !== cat[n + 100]) T = n + 1;
  if (T > 200) return null;
  const P = [];
  for (let r = 0; r < 100; r++) P.push(cat[200 + r]);

  const million = rules.select(1000000);
  const special = million !== P[0] ? million : null;

  const predicate = (c, guard) => {
    const parts = [];
    const small = [];
    for (let n = 0; n < T; n++) if (cat[n] === c) small.push(n);
    if (small.length > 0) parts.push(renderSet('n', small));
    const residues = [];
    for (let r = 0; r < 100; r++) if (P[r] === c) residues.push(r);
    if (residues.length > 0) {
      const res = renderResidues(residues);
      parts.push(guard && T > 0 ? `(n>=${T} && ${res})` : res);
    }
    if (parts.length === 0) return null;
    return parts.length === 1 ? parts[0] : `(${parts.join(' || ')})`;
  };

  const build = (guard) => {
    let expr = String(index(fallback));
    for (const c of [...categories].reverse()) {
      if (c === fallback) continue;
      const p = predicate(c, guard);
      if (p) expr = `${p} ? ${index(c)} : ${expr}`;
    }
    if (special) expr = `(n!=0 && n%1000000==0) ? ${index(special)} : ${expr}`;
    return expr;
  };

  for (const guard of [false, true]) {
    const expression = build(guard);
    let evaluate;
    try { evaluate = compilePluralExpression(expression); } catch { continue; }
    let ok = true;
    for (let n = 0; n < LIMIT && ok; n++) if (evaluate(n) !== index(cat[n])) ok = false;
    for (const n of LARGE_PROBES) if (ok && evaluate(n) !== index(rules.select(n))) ok = false;
    if (ok) return { nplurals: categories.length, expression, categories, evaluate };
  }
  return null;
}

/**
 * The ICU selector each msgstr index stands for: the CLDR category most of
 * the numbers that select the index carry in `locale`. Ties and repeats
 * fall back to an exact `=N` selector (N = the smallest number selecting
 * the index), so every index is addressable.
 *
 * @param {number} nplurals
 * @param {(n: number) => number} evaluate
 * @param {string} locale
 * @returns {string[]}
 */
function pluralIndexSelectors(nplurals, evaluate, locale) {
  let rules = null;
  if (pluralCategoriesFor(locale)) {
    try { rules = new Intl.PluralRules(String(locale).replace(/_/g, '-')); } catch { rules = null; }
  }
  const byIndex = Array.from({ length: nplurals }, () => ({ count: 0, min: null, cats: new Map() }));
  const samples = [];
  for (let n = 0; n <= 1000; n++) samples.push(n);
  samples.push(...LARGE_PROBES);
  for (const n of samples) {
    const k = evaluate(n);
    if (!(k >= 0 && k < nplurals)) continue;
    const slot = byIndex[k];
    slot.count++;
    if (slot.min === null) slot.min = n;
    const c = rules ? rules.select(n) : (n === 1 ? 'one' : 'other');
    slot.cats.set(c, (slot.cats.get(c) || 0) + 1);
  }
  const best = byIndex.map((slot) => {
    let top = null;
    for (const [c, k] of slot.cats) if (!top || k > top[1]) top = [c, k];
    return top ? top[0] : null;
  });
  const selectors = new Array(nplurals).fill(null);
  const order = byIndex.map((s, i) => i).sort((a, b) => byIndex[b].count - byIndex[a].count);
  const taken = new Set();
  for (const i of order) {
    const c = best[i];
    if (c && !taken.has(c)) { selectors[i] = c; taken.add(c); continue; }
    const min = byIndex[i].min;
    selectors[i] = min === null ? `=${-1 - i}` : `=${min}`;
  }
  return selectors;
}

/**
 * How plural entries of a TARGET catalog map onto ICU categories: from its
 * own valid Plural-Forms header, else from the header msginit writes for
 * the language, else from CLDR.
 *
 * @returns {{ nplurals: number, expression: string, selectors: string[], fromHeader: boolean }|null}
 */
function targetPluralInfo(header, locale) {
  const fromHeader = parsePluralForms(headerField(header, 'Plural-Forms'));
  if (fromHeader) {
    return {
      nplurals: fromHeader.nplurals, expression: fromHeader.expression,
      selectors: pluralIndexSelectors(fromHeader.nplurals, fromHeader.evaluate, locale),
      fromHeader: true,
    };
  }
  const conventional = gettextPluralForms(locale);
  if (conventional) {
    return {
      nplurals: conventional.nplurals, expression: conventional.expression,
      selectors: pluralIndexSelectors(conventional.nplurals, conventional.evaluate, locale),
      fromHeader: false,
    };
  }
  const synth = locale ? synthesizePluralForms(locale) : null;
  if (!synth) return null;
  return { nplurals: synth.nplurals, expression: synth.expression, selectors: synth.categories, fromHeader: false };
}

/**
 * Keys of a TARGET catalog's entries flagged `fuzzy` — read as untranslated
 * (absent from the flat map), so sync re-translates them; the log names them
 * as fuzzy, not missing (Round 6, Django persona: an entry `makemessages`
 * marked fuzzy after its msgid changed was reported "missing").
 *
 * @param {string} text - Catalog content
 * @returns {Set<string>}
 */
function poFuzzyKeys(text) {
  const out = new Set();
  if (typeof text !== 'string' || !text.trim()) return out;
  let parsed;
  try { parsed = parsePO(text); } catch { return out; }
  for (const e of parsed.entries) {
    if (e.kind === 'entry' && e.flags.includes('fuzzy') && e.msgid) out.add(entryKey(e));
  }
  return out;
}

/**
 * The CLDR plural categories a catalog has a msgstr[] slot for — its own
 * header's, else the header a new catalog gets — or null when no plural
 * rules are known. A form without a slot cannot be written, so it is never
 * asked again for, marked or reported as missing (French "many" in a
 * two-form catalog).
 *
 * @param {string|null} text - Catalog content (null: a catalog not yet created)
 * @param {string} locale
 * @returns {string[]|null}
 */
function poPluralSlots(text, locale) {
  let header = null;
  if (typeof text === 'string' && text.trim()) {
    try { header = parsePO(text).header; } catch { header = null; }
  }
  const info = targetPluralInfo(header, locale || headerField(header, 'Language') || null);
  if (!info) return null;
  const slots = info.selectors.filter(c => c && !c.startsWith('='));
  // ICU's `other` always has a home: the last form when no index takes it.
  if (!slots.includes('other')) slots.push('other');
  return slots;
}

function pluralFormsUnavailable(locale, filePath) {
  return new Error(
    `${filePath || 'PO file'}: no usable Plural-Forms header, and CLDR's plural rules for "${locale}" cannot be `
    + 'turned into a gettext expression automatically. Add the header yourself — e.g. '
    + `\`msginit --locale=${locale} --input=<template>.pot --output=${filePath || '<file>.po'}\` writes it — and sync again.`);
}

// -----------------------------------------------------------------
// ICU plural values
// -----------------------------------------------------------------

/**
 * "{n, plural, one {…} other {…}}" from selectors and form texts.
 *
 * ICU requires `other`; a language whose integer forms do not include it
 * (Russian: one/few/many — CLDR's `other` is for fractions) gets the LAST
 * form as `other`, gettext's general plural.
 */
function formsToICU(selectors, forms) {
  const branches = [];
  forms.forEach((text, i) => {
    if (selectors[i] && !selectors[i].startsWith('=-')) branches.push(`${selectors[i]} {${text}}`);
  });
  if (!selectors.includes('other') && forms.length > 0) branches.push(`other {${forms[forms.length - 1]}}`);
  return `{${PO_PLURAL_ARG}, plural, ${branches.join(' ')}}`;
}

/** Does this ICU text parse back into exactly one plural argument? */
function icuPluralBranches(value) {
  const parsed = parseMessage(value, { apostrophes: 'literal' });
  if (!parsed.ok) return null;
  const meaningful = parsed.nodes.filter(n => !(n.type === 'text' && n.value.trim() === ''));
  if (meaningful.length !== 1 || meaningful[0].type !== 'branching') return null;
  return new Map(meaningful[0].options.map(o => [o.selector, o.raw]));
}

/**
 * msgstr[0..nplurals-1] from a translated ICU plural value. Branch text is
 * copied verbatim. Returns null when the value is not a plural message.
 */
function icuToForms(value, info, locale) {
  const mapped = icuToFormsWithCopies(value, info, locale);
  return mapped ? mapped.forms : null;
}

/**
 * icuToForms, plus the forms that had to REPEAT the `other` branch because
 * the translation has no branch for their CLDR category (a Russian message
 * with only one/other fills few and many from other). msgfmt needs every
 * msgstr[i], so the repeat is written — and marked (PO_COPIED_FORMS_MARK),
 * never passed off as a translation of that form. An index with no integer
 * counts (Django's Russian fraction form) takes `other` by right: CLDR's
 * `other` IS that form, so it is not a copy.
 *
 * @returns {{ forms: string[], copied: Array<{ index: number, category: string }> }|null}
 */
function icuToFormsWithCopies(value, info, locale) {
  const branches = icuPluralBranches(value);
  if (!branches) return null;
  let rules = null;
  try { if (pluralCategoriesFor(locale)) rules = new Intl.PluralRules(String(locale).replace(/_/g, '-')); } catch { rules = null; }
  const forms = [];
  const copied = [];
  for (let i = 0; i < info.nplurals; i++) {
    const sel = info.selectors[i];
    let text = branches.get(sel);
    if (text === undefined && sel && sel.startsWith('=') && rules) {
      const k = Number(sel.slice(1));
      if (k >= 0) text = branches.get(rules.select(k));
    }
    if (text === undefined) {
      text = branches.get('other');
      if (text !== undefined && sel && sel !== 'other' && !sel.startsWith('=')) copied.push({ index: i, category: sel });
    }
    if (text === undefined) return null;
    forms.push(text);
  }
  return { forms, copied };
}

/**
 * The translator comment a catalog entry carries while some of its plural
 * forms only repeat `other`: Poedit, Weblate and msgmerge keep `# ` comments
 * and show them to the reviewer, and `champollion verify` reads it back
 * (poPluralFindings) — in CI too, where there is no translation cache.
 * A sync that re-translates the entry replaces the line.
 */
const PO_COPIED_FORMS_MARK = '# champollion:';

function copiedFormsComment(copied) {
  const which = copied.map(c => `${c.category} (msgstr[${c.index}])`).join(', ');
  return `${PO_COPIED_FORMS_MARK} plural form(s) ${which} were not supplied by the translation — `
    + 'they repeat the "other" form; write them, then delete this line';
}

/**
 * Plural findings in a TARGET catalog that the flat map cannot show:
 *   - copied: forms marked as repeating `other` (see PO_COPIED_FORMS_MARK)
 *     whose text still repeats it (all marked forms identical — and equal
 *     to the `other` form when the catalog has one). A reviewer who wrote
 *     real forms has fixed it, comment or not.
 *   - extraForms: an entry with more msgstr[n] than nplurals (msgfmt
 *     rejects it; the reader treats the entry as untranslated).
 *
 * @param {string} text - Catalog content
 * @param {{ locale?: string|null, filePath?: string }} [options]
 * @returns {{ copied: Array<{ key: string, categories: string[] }>,
 *   extraForms: Array<{ key: string, forms: number, nplurals: number, categories: string[] }> }}
 */
function poPluralFindings(text, { locale = null, filePath = '' } = {}) {
  const parsed = parsePO(text, filePath);
  const lang = locale || headerField(parsed.header, 'Language') || null;
  const info = targetPluralInfo(parsed.header, lang);
  const copied = [];
  const extraForms = [];
  if (!info) return { copied, extraForms };
  for (const e of parsed.entries) {
    if (e.kind !== 'entry' || e.msgidPlural === null || e.flags.includes('fuzzy')) continue;
    const key = entryKey(e);
    if (e.msgstr.length > info.nplurals) {
      extraForms.push({ key, forms: e.msgstr.length, nplurals: info.nplurals, categories: info.selectors.filter(c => c && !c.startsWith('=')) });
      continue;
    }
    const mark = e.translatorComments.find(l => l.startsWith(PO_COPIED_FORMS_MARK));
    if (!mark || e.msgstr.length !== info.nplurals) continue;
    const marked = [...mark.matchAll(/(\w+) \(msgstr\[(\d+)\]\)/g)].map(m => ({ category: m[1], index: Number(m[2]) }))
      .filter(m => m.index < e.msgstr.length);
    if (marked.length === 0) continue;
    const texts = marked.map(m => e.msgstr[m.index]);
    const otherIndex = info.selectors.indexOf('other');
    const stillCopied = texts.every(t => t === texts[0])
      && (otherIndex < 0 || marked.some(m => m.index === otherIndex) || e.msgstr[otherIndex] === texts[0]);
    if (stillCopied) copied.push({ key, categories: marked.map(m => m.category) });
  }
  return { copied, extraForms };
}

// -----------------------------------------------------------------
// Read
// -----------------------------------------------------------------

/**
 * Read a catalog into the flat map (see the module header for the rules)
 * plus per-key translator context for the prompt (msgctxt, `#.` comments).
 *
 * @param {string} text - File content
 * @param {{ role?: 'source'|'target', locale?: string|null, filePath?: string }} [options]
 * @returns {{ flat: object, context: object }}
 */
function readPO(text, { role = 'target', locale = null, filePath = '' } = {}) {
  const parsed = parsePO(text, filePath);
  assertUtf8(parsed.header, filePath);
  const lang = locale || headerField(parsed.header, 'Language') || null;
  const flat = {};
  const context = {};
  let info;
  const plural = () => {
    if (info === undefined) info = targetPluralInfo(parsed.header, lang);
    return info;
  };

  for (const e of parsed.entries) {
    if (e.kind !== 'entry') continue;
    const key = entryKey(e);
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      console.warn(`  [WARN] Duplicate gettext entry ${visibleKey(key)} in ${filePath} — later entry wins.`);
    }
    const fuzzy = e.flags.includes('fuzzy');

    if (role === 'source') {
      const notes = [];
      if (e.msgctxt) notes.push(`Context (msgctxt): ${e.msgctxt}`);
      if (e.extractedComments.length > 0) notes.push(e.extractedComments.join(' '));
      if (e.msgidPlural === null) {
        flat[key] = (!fuzzy && e.msgstr[0]) ? e.msgstr[0] : e.msgid;
      } else {
        let value = null;
        const forms = e.msgstr;
        const filled = !fuzzy && forms.length > 0 && forms.every(f => f);
        const own = filled ? parsePluralForms(headerField(parsed.header, 'Plural-Forms')) : null;
        if (own && own.nplurals === forms.length) {
          value = formsToICU(pluralIndexSelectors(own.nplurals, own.evaluate, lang || 'en'), forms);
        } else {
          value = formsToICU(['one', 'other'], [e.msgid, e.msgidPlural]);
        }
        if (!icuPluralBranches(value)) {
          console.warn(`  [WARN] ${filePath}: plural entry ${visibleKey(key)} has unbalanced braces — it cannot be `
            + 'written as an ICU plural message and is NOT translated. Translate it by hand.');
          continue;
        }
        flat[key] = value;
        notes.push('gettext plural message, written as an ICU plural: give every plural category the target language needs.');
      }
      if (notes.length > 0) context[key] = notes.join(' — ');
      continue;
    }

    // Target: fuzzy and empty msgstr are untranslated.
    if (fuzzy) continue;
    if (e.msgidPlural === null) {
      if (e.msgstr[0]) flat[key] = e.msgstr[0];
      continue;
    }
    const forms = e.msgstr;
    if (forms.length === 0 || forms.some(f => !f)) continue;
    const pi = plural();
    if (!pi) {
      if (!lang) {
        throw new Error(`${filePath}: plural entries need a "Language:" or "Plural-Forms:" header to be read.`);
      }
      throw pluralFormsUnavailable(lang, filePath);
    }
    // A form count that disagrees with Plural-Forms is not a usable
    // translation (msgfmt rejects it) — re-translate it.
    if (forms.length !== pi.nplurals) continue;
    flat[key] = formsToICU(pi.selectors, forms);
  }
  return { flat, context };
}

// -----------------------------------------------------------------
// Write
// -----------------------------------------------------------------

/**
 * Serialize a target catalog.
 *
 * @param {object} options
 * @param {object} options.flat - Target key → value map (sync's edited data)
 * @param {string|null} options.sourceText - The template (source .po/.pot);
 *   null = the target is its own template (xliff import, autofix)
 * @param {string|null} options.targetText - Existing target content, or null
 * @param {string} options.locale - Target locale code
 * @param {string} [options.filePath]
 * @param {string|null} [options.projectName] - A NEW catalog's
 *   Project-Id-Version when the template carries no real one (see
 *   newHeaderFields)
 * @param {Date} [options.now] - A new catalog's PO-Revision-Date
 * @returns {string}
 */
function writePO({ flat, sourceText, targetText, locale, filePath = '', projectName = null, now = new Date() }) {
  const tgt = targetText ? parsePO(targetText, filePath) : null;
  const src = sourceText ? parsePO(sourceText, filePath) : tgt;
  if (tgt) assertUtf8(tgt.header, filePath);
  // Callers without a locale (xliff import, autofix) rely on the header.
  locale = locale || headerField(tgt?.header || null, 'Language') || null;
  const eol = (tgt || src)?.eol || '\n';
  const blocks = [];

  const tgtByKey = new Map();
  for (const e of tgt ? tgt.entries : []) if (e.kind === 'entry') tgtByKey.set(entryKey(e), e);
  const srcEntries = src ? src.entries.filter(e => e.kind === 'entry') : [];
  const hasPlural = srcEntries.some(e => e.msgidPlural !== null)
    || Object.values(flat).some(v => typeof v === 'string' && v.startsWith(`{${PO_PLURAL_ARG}, plural,`));

  let info = targetPluralInfo(tgt?.header || null, locale);
  if (!info && hasPlural) throw pluralFormsUnavailable(locale, filePath);

  // ── Header ──
  const header = tgt?.header || null;
  if (header) {
    const fields = headerFields(header);
    let changed = false;
    const pf = fields.find(([k]) => k.toLowerCase() === 'plural-forms');
    if (info && !info.fromHeader) {
      const value = `nplurals=${info.nplurals}; plural=${info.expression};`;
      if (pf) pf[1] = value; else fields.push(['Plural-Forms', value]);
      changed = true;
    }
    const ct = fields.find(([k]) => k.toLowerCase() === 'content-type');
    if (ct && /charset\s*=\s*CHARSET/i.test(ct[1])) {
      ct[1] = ct[1].replace(/charset\s*=\s*CHARSET/i, 'charset=UTF-8');
      changed = true;
    }
    if (!changed) blocks.push(rawText(tgt, header));
    else {
      const out = [];
      for (let i = header.start; i < (header.fieldLines.msgid?.[0] ?? header.start); i++) out.push(tgt.lines[i]);
      out.push('msgid ""', 'msgstr ""');
      for (const [k, v] of fields) out.push(`"${escapeC(`${k}: ${v}\n`)}"`);
      blocks.push(out.join('\n'));
    }
  } else {
    const fields = newHeaderFields({ srcHeader: src?.header || null, locale, info, projectName, now });
    blocks.push(['msgid ""', 'msgstr ""', ...fields.map(([k, v]) => `"${escapeC(`${k}: ${v}\n`)}"`)].join('\n'));
  }
  if (!info) info = { nplurals: 2, expression: '(n != 1)', selectors: ['one', 'other'], fromHeader: false };

  // What the reader returns for an existing target entry — "unchanged" is
  // judged against exactly this.
  const existingValue = (e) => {
    if (e.flags.includes('fuzzy')) return undefined;
    if (e.msgidPlural === null) return e.msgstr[0] || undefined;
    if (e.msgstr.length !== info.nplurals || e.msgstr.some(f => !f)) return undefined;
    return formsToICU(info.selectors, e.msgstr);
  };

  const fieldRaw = (parsed, e, name) => {
    const range = e.fieldLines[name];
    return range ? parsed.lines.slice(range[0], range[1] + 1) : null;
  };

  const render = (s, e, value) => {
    const out = [];
    // Our own "repeats other" line is re-decided for the new value below.
    if (e) out.push(...e.translatorComments.filter(l => !l.startsWith(PO_COPIED_FORMS_MARK)));
    const mapped = s.msgidPlural !== null && value !== null ? icuToFormsWithCopies(value, info, locale) : null;
    if (mapped && mapped.copied.length > 0) out.push(copiedFormsComment(mapped.copied));
    for (const c of s.extractedComments) out.push(`#. ${c}`);
    out.push(...s.references);
    const flags = [...new Set([...s.flags, ...(e ? e.flags : [])])]
      .filter(f => !(f === 'fuzzy' && value !== null));
    if (flags.length > 0) out.push(`#, ${flags.join(', ')}`);
    if (value === null && e) out.push(...e.previous);
    const srcParsed = s === e ? tgt : src;
    for (const name of ['msgctxt', 'msgid', 'msgid_plural']) {
      const raw = fieldRaw(srcParsed, s, name);
      if (raw) out.push(...raw);
      else if (name === 'msgctxt' && s.msgctxt !== null) out.push(...formatField('msgctxt', s.msgctxt));
      else if (name === 'msgid') out.push(...formatField('msgid', s.msgid));
      else if (name === 'msgid_plural' && s.msgidPlural !== null) out.push(...formatField('msgid_plural', s.msgidPlural));
    }
    if (s.msgidPlural === null) {
      out.push(...formatField('msgstr', value ?? ''));
    } else {
      const forms = value === null ? new Array(info.nplurals).fill('') : mapped.forms;
      for (let i = 0; i < info.nplurals; i++) out.push(...formatField(`msgstr[${i}]`, forms[i]));
    }
    return out.join('\n');
  };

  const srcKeys = new Set();
  for (const s of srcEntries) {
    const key = entryKey(s);
    srcKeys.add(key);
    const e = tgtByKey.get(key) || null;
    const wanted = flat[key];
    const have = e ? existingValue(e) : undefined;
    if (wanted === undefined || wanted === have) {
      blocks.push(e ? rawText(tgt, e) : render(s, null, null));
      continue;
    }
    if (s.msgidPlural !== null && !icuToForms(wanted, info, locale)) {
      console.warn(`  [WARN] ${filePath}: ${visibleKey(key)} — the translation is not an ICU plural message; left untranslated.`);
      blocks.push(e ? rawText(tgt, e) : render(s, null, null));
      continue;
    }
    blocks.push(render(s, e, wanted));
  }

  // Keys sync added that no template entry carries (xliff import of a new
  // key): plain singular entries.
  for (const [key, value] of Object.entries(flat)) {
    if (srcKeys.has(key) || typeof value !== 'string') continue;
    if (tgtByKey.has(key) && src !== tgt) continue;
    const sep = key.indexOf(PO_CONTEXT_SEPARATOR);
    const out = [];
    if (sep >= 0) out.push(...formatField('msgctxt', key.slice(0, sep)));
    out.push(...formatField('msgid', sep >= 0 ? key.slice(sep + 1) : key));
    out.push(...formatField('msgstr', value));
    blocks.push(out.join('\n'));
  }

  // Target entries the template no longer has, obsolete entries and loose
  // comment blocks: kept exactly as they were.
  if (tgt && src !== tgt) {
    for (const e of tgt.entries) {
      if (e.kind === 'header') continue;
      if (e.kind === 'entry' && srcKeys.has(entryKey(e))) continue;
      blocks.push(rawText(tgt, e));
    }
  } else if (tgt) {
    for (const e of tgt.entries) {
      if (e.kind === 'obsolete' || e.kind === 'comment') blocks.push(rawText(tgt, e));
    }
  }

  return blocks.join('\n\n').split('\n').join(eol) + eol;
}

/** xgettext's template value for Project-Id-Version (msgfmt -c: "still has the initial default value"). */
const PO_TEMPLATE_PROJECT_ID = 'PACKAGE VERSION';

/** "YYYY-MM-DD HH:MM+ZZZZ" in local time — the stamp gettext's tools write. */
function poTimestamp(date) {
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`
    + `${offset < 0 ? '-' : '+'}${pad(offset / 60)}${pad(offset % 60)}`;
}

/**
 * The header of a catalog champollion CREATES (init --langs, or sync for a
 * locale with no catalog yet). An existing catalog's header is never
 * rewritten — only a placeholder Plural-Forms/charset in it is filled.
 *
 * It used to carry five fields, and `msgfmt -c` warned about four missing
 * ones (Project-Id-Version, PO-Revision-Date, Last-Translator,
 * Language-Team; synthetic Django persona, 2026-10). The fields and values
 * are what `msginit --no-translator` writes — gettext's own non-interactive
 * way to start a catalog, whose output `msgfmt -c` accepts:
 *   - Project-Id-Version, Report-Msgid-Bugs-To, POT-Creation-Date: copied
 *     from the template (msginit copies them from the .pot). xgettext's
 *     "PACKAGE VERSION" placeholder is replaced, as msginit replaces it,
 *     by the project's name (its folder). No template date → no
 *     POT-Creation-Date: there was no .pot to date.
 *   - PO-Revision-Date: when the file was made.
 *   - Last-Translator "Automatically generated", Language-Team "none": no
 *     person has worked on it (msginit's own values for this case — not a
 *     made-up name, and not FULL NAME <EMAIL@ADDRESS>, which msgfmt -c
 *     reports as an unfilled template).
 *
 * @returns {Array<[string, string]>}
 */
function newHeaderFields({ srcHeader, locale, info, projectName, now }) {
  const fromSource = (name) => headerField(srcHeader, name);
  const projectId = fromSource('Project-Id-Version');
  const fields = [
    ['Project-Id-Version', projectId && projectId !== PO_TEMPLATE_PROJECT_ID
      ? projectId : (projectName || PO_TEMPLATE_PROJECT_ID)],
    ['Report-Msgid-Bugs-To', fromSource('Report-Msgid-Bugs-To') ?? ''],
  ];
  const potDate = fromSource('POT-Creation-Date');
  if (potDate) fields.push(['POT-Creation-Date', potDate]);
  fields.push(
    ['PO-Revision-Date', poTimestamp(now instanceof Date ? now : new Date())],
    ['Last-Translator', 'Automatically generated'],
    ['Language-Team', 'none'],
  );
  if (locale) fields.push(['Language', locale]);
  fields.push(
    ['MIME-Version', '1.0'],
    ['Content-Type', 'text/plain; charset=UTF-8'],
    ['Content-Transfer-Encoding', '8bit'],
  );
  if (info) fields.push(['Plural-Forms', `nplurals=${info.nplurals}; plural=${info.expression};`]);
  return fields;
}

/**
 * The content of a new, empty target catalog: a header only.
 *
 * @param {string} locale
 * @param {{ sourceText?: string|null, projectName?: string|null, now?: Date }} [options] -
 *   sourceText: the template the catalog will mirror (its header fields are
 *   carried over — see newHeaderFields); no entries are copied, sync fills them
 * @returns {string}
 */
function emptyPO(locale, { sourceText = null, projectName = null, now = new Date() } = {}) {
  const header = sourceText ? parsePO(sourceText).header : null;
  const info = targetPluralInfo(null, locale);
  const fields = newHeaderFields({ srcHeader: header, locale, info, projectName, now });
  return ['msgid ""', 'msgstr ""', ...fields.map(([k, v]) => `"${escapeC(`${k}: ${v}\n`)}"`)].join('\n') + '\n';
}

export {
  PO_CONTEXT_SEPARATOR,
  PO_PLURAL_ARG,
  parsePO,
  readPO,
  writePO,
  emptyPO,
  entryKey,
  headerField,
  parsePluralForms,
  compilePluralExpression,
  synthesizePluralForms,
  pluralIndexSelectors,
  targetPluralInfo,
  gettextPluralForms,
  poPluralSlots,
  poFuzzyKeys,
  poPluralFindings,
  icuToFormsWithCopies,
  PO_COPIED_FORMS_MARK,
};
