/**
 * placeholders.js — the placeholders a value carries, and what a translation
 * did to them. ONE rule for the sync quality gate (lib/validate.js) and for
 * verify (lib/verify.js, through lib/integrity.js): sync refuses what verify
 * would flag, so the fallback runs instead of the damage being written and
 * then reported (Round 12, i18next: the gate did not check {{…}}, so sync
 * wrote {{nom}} for {{name}}, verify flagged it, and the run exited 2).
 *
 * A leaf module (it imports only lib/icu-structure.js), so the gate and the
 * integrity audit can both use it without importing each other.
 */

import { parseMessage, hasArguments } from './icu-structure.js';

/**
 * i18next interpolation — `{{name}}`, `{{ user.name }}`, `{{- html}}`
 * (unescaped), `{{val, number}}` (formatted). A leading dot is Go template
 * syntax (Hugo "{{ .Count }}") and is not matched.
 */
const I18NEXT_INTERPOLATION = /\{\{\s*(-\s*)?([A-Za-z_$][\w.$]*)\s*(?:,\s*([^{}]*?))?\s*\}\}/g;

/**
 * Extract ICU-style placeholders from a string.
 *
 * Handles:
 *   - Simple: {name}, {count}            → "name", "count"
 *   - Nested ICU: {count, plural, one {# item} other {# items}}
 *   - React-intl: <bold>text</bold>       → "<bold>"
 *   - i18next: {{name}}, {{val, number}}  → "{{name}}", "{{val, number}}"
 *
 * The token's form names its syntax (placeholderSyntax). An i18next token
 * keeps its double braces: read as "name" it was indistinguishable from
 * "{name}", which i18next prints literally — a `{{name}}` → `{name}` loss
 * passed, and a `{{name}}` loss could not be reported as i18next (Round 12).
 *
 * @param {string} text - Translation string
 * @returns {string[]} Sorted array of placeholder tokens
 */
function extractPlaceholders(text) {
  if (typeof text !== 'string') return [];

  const placeholders = new Set();

  // i18next {{…}} first, then blanked out, so the single-brace scan below
  // does not read the inner "{name}" of "{{name}}" as an ICU argument.
  const rest = text.replace(I18NEXT_INTERPOLATION, (whole, unescaped, name, format) => {
    placeholders.add(`{{${unescaped ? '- ' : ''}${name}${format ? `, ${format.trim().replace(/\s+/g, ' ')}` : ''}}}`);
    return ' ';
  });

  // Simple ICU placeholders: {name}, {count}
  // Match top-level braces only (not nested plurals)
  const simplePattern = /\{(\w+)(?:[,}])/g;
  let match;
  while ((match = simplePattern.exec(rest)) !== null) {
    placeholders.add(match[1]);
  }

  // React-intl XML tags: <bold>, </bold>, <link>, </link>
  const xmlPattern = /<\/?(\w+)>/g;
  while ((match = xmlPattern.exec(text)) !== null) {
    placeholders.add(`<${match[1]}>`);
  }

  return [...placeholders].sort();
}

/**
 * The syntax a token from extractPlaceholders is written in — read off the
 * token's own form, which is how extractPlaceholders tells them apart:
 *   'i18next'  "{{name}}"  (i18next interpolation)
 *   'markup'   "<bold>"    (a tag: react-intl, react-i18next, HTML)
 *   'brace'    "name"      (a single-brace "{name}" — an ICU/MessageFormat
 *                           argument when the message parses as ICU, which
 *                           lib/icu-structure.js checkICUStructure judges)
 * printf conversions (%s, %(name)s) are not tokens here: checkICUStructure
 * compares them and tags its findings 'printf'.
 *
 * @param {string} token
 * @returns {'i18next'|'markup'|'brace'}
 */
function placeholderSyntax(token) {
  if (token.startsWith('{{')) return 'i18next';
  if (token.startsWith('<')) return 'markup';
  return 'brace';
}

/**
 * A token as the user wrote it: "name" was "{name}".
 *
 * @param {string} token
 * @returns {string}
 */
function showPlaceholder(token) {
  return placeholderSyntax(token) === 'brace' ? `{${token}}` : token;
}

/**
 * Compare placeholders between source and target strings.
 *
 * @param {string} sourceValue - Source locale value
 * @param {string} targetValue - Target locale value
 * @returns {{ missing: string[], extra: string[] }} Placeholder differences
 */
function comparePlaceholders(sourceValue, targetValue) {
  const sourcePH = extractPlaceholders(sourceValue);
  const targetPH = extractPlaceholders(targetValue);

  const missing = sourcePH.filter(p => !targetPH.includes(p));
  const extra = targetPH.filter(p => !sourcePH.includes(p));

  return { missing, extra };
}

/**
 * Does `text` parse as an ICU message with arguments (either apostrophe
 * reading — checkICUStructure's own test)? Its single-brace tokens are then
 * the ICU check's to judge, argument by argument.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
function parsesAsICU(text) {
  if (typeof text !== 'string' || !text.includes('{')) return false;
  return ['icu', 'literal'].some((apostrophes) => {
    const parsed = parseMessage(text, { apostrophes });
    return parsed.ok && hasArguments(parsed.nodes);
  });
}

/** What each syntax is called in a finding: "i18next {{…}} placeholder …". */
const PLACEHOLDER_SYNTAX_NAMES = Object.freeze({
  i18next: 'i18next {{…}}',
  brace: '{…}',
  markup: 'tag',
});

/**
 * What a translation did to the placeholders its source carries, each change
 * named by its syntax (placeholderSyntax) — the findings verify reports, and
 * the ones the sync gate refuses:
 *   { syntax: 'i18next', token: '{{name}}', issue: 'placeholder {{name}} was changed to {{nom}}' }
 *
 * A missing token and an extra one of the same name read as one change
 * ("{{name}} was changed to {name}") and are named by the SOURCE's syntax;
 * the remaining missing/extra tokens pair up in order. Left out:
 *   - a brace token (single or double) when the source parses as an ICU
 *     message — the ICU check compares its arguments, and the token scan
 *     reads a one-word plural branch ("other {articles}") as a placeholder
 *     and a branch holding only an argument ("other{{count}}") as i18next;
 *   - a tag when the markup check already reported the value
 *     (`markupReported`), said precisely there.
 * printf conversions are not tokens here: checkICUStructure compares them.
 *
 * @param {string} sourceValue
 * @param {string} targetValue
 * @param {{ markupReported?: boolean }} [options]
 * @returns {Array<{ syntax: 'i18next'|'brace'|'markup', token: string, issue: string }>}
 */
function placeholderChanges(sourceValue, targetValue, { markupReported = false } = {}) {
  if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') return [];
  const { missing, extra } = comparePlaceholders(sourceValue, targetValue);
  if (missing.length === 0 && extra.length === 0) return [];
  const nameOf = (token) => (/[A-Za-z_$][\w.$]*/.exec(token) || [token])[0];
  const changes = [];
  for (const m of [...missing]) {
    const e = extra.find(x => nameOf(x) === nameOf(m));
    if (!e) continue;
    changes.push([m, e]);
    missing.splice(missing.indexOf(m), 1);
    extra.splice(extra.indexOf(e), 1);
  }
  while (missing.length > 0 && extra.length > 0) changes.push([missing.shift(), extra.shift()]);
  const items = [
    ...changes.map(([m, e]) => [m, `placeholder ${showPlaceholder(m)} was changed to ${showPlaceholder(e)}`]),
    ...missing.map(m => [m, `placeholder ${showPlaceholder(m)} is missing`]),
    ...extra.map(e => [e, `placeholder ${showPlaceholder(e)} is not in the source`]),
  ];
  const icuSource = parsesAsICU(sourceValue);
  const out = [];
  for (const [token, issue] of items) {
    const syntax = placeholderSyntax(token);
    // In an ICU message, braces are ICU's: "other{{count}}" is a branch
    // holding the argument, not i18next (an i18next "{{name}}" message never
    // parses as ICU).
    if ((syntax === 'brace' || syntax === 'i18next') && icuSource) continue;
    if (syntax === 'markup' && markupReported) continue;
    out.push({ syntax, token, issue });
  }
  return out;
}

// ── A sentence break inserted beside a placeholder ──────────────────────────
//
// "Take this medicine at {time}." came back as "… sina. {time}." — a sentence
// end before the placeholder, so the app shows the time as a sentence of its
// own — and the gate and verify both passed it: every placeholder was there
// (Round 14, hospital persona; a medical string). The rule below is
// structural and narrow: it does not judge fluency, only a sentence boundary
// the TRANSLATION puts right beside a placeholder where the SOURCE has none.

/**
 * Sentence-final marks, across scripts: Latin/Cyrillic/Greek . ! ? (Greek's
 * question mark ";" is left out: it is also the semicolon), CJK 。！？ and the
 * halfwidth/fullwidth forms, Devanagari/Bengali danda । ॥, Arabic ؟ and the
 * Urdu full stop ۔, Ethiopic ። ፧, Armenian ։, Myanmar ။, Khmer ។ ៕,
 * Canadian Syllabics ᙮ (Cree, Inuktitut), and the doubled marks ‼ ⁇ ⁈ ⁉ ‽.
 * Script-agnostic: a mark from any script is a boundary in any text.
 */
const SENTENCE_MARKS = new Set([...'.!?。！？｡．।॥؟۔።፧։။។៕᙮‼⁇⁈⁉‽']);

/** Closing quotes and brackets that may stand between a mark and what follows it. */
const CLOSERS = new Set([...'"\'”’»›」』）)］]']);

/**
 * Clause punctuation: where the SOURCE already sets a placeholder apart
 * ("… corpora; {spec}.", "Error: {message}", "— {noncomp}, and …"), a
 * translation may make that clause a sentence of its own.
 */
const CLAUSE_MARKS = new Set([...';:,—–·|(（[［、，；：']);

/** Whitespace (JavaScript's \s includes no-break and narrow no-break space). */
const SPACE = /\s/;

/**
 * Placeholder spans with their positions: i18next / Hugo / Handlebars
 * `{{…}}`, a single-brace argument `{name}` / `{0}` / `{n, number}` (also
 * Ruby's `%{name}`), and printf `%(name)s`, `%1$s`, `%s`, `%d`, `%@`.
 * Nested ICU (plural/select) is not matched as one span — messages holding
 * it are left out of this check (see placeholderSentenceBreaks).
 */
const PLACEHOLDER_SPAN = /\{\{[^{}]*\}\}|%?\{\s*(?:[A-Za-z_$][\w.$]*|\d+)\s*(?:,[^{}]*)?\}|%\(\w+\)[a-zA-Z]|%\d+\$[a-zA-Z@]|%[sd@]/g;

/** An ICU plural/select/selectordinal argument — its branches are not placeholder spans. */
const ICU_BRANCHING = /\{\s*[\w.$]+\s*,\s*(?:plural|select|selectordinal)\s*,/;

function placeholderSpans(text) {
  const spans = [];
  for (const m of text.matchAll(PLACEHOLDER_SPAN)) {
    spans.push({ token: m[0].replace(/\s+/g, ''), shown: m[0], start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

/**
 * Is text[i] a sentence boundary? Any mark in SENTENCE_MARKS but a full stop
 * is one. A full stop "." is one unless it is:
 *   - part of an ellipsis ("..." — a pause, not an end),
 *   - followed directly by a letter, digit or "_" ("3.5", "{host}.com", "e.g"),
 *   - the stop of a one-letter word — an initial or an abbreviation
 *     ("M. {name}", "p. {page}", "z. B. {x}"),
 *   - the stop of a short capitalised word (two or three letters) — an
 *     abbreviation before a number or name ("Nr. {id}", "Dr. {name}",
 *     "Tel. {phone}", "Ca. {count}").
 * A stop right after a placeholder ("{time}.", "%(dose)s.") is never read as
 * an abbreviation: `afterPlaceholder` says the stop follows one.
 *
 * @param {string} text
 * @param {number} i
 * @param {boolean} [afterPlaceholder]
 * @returns {boolean}
 */
function isSentenceBoundaryAt(text, i, afterPlaceholder = false) {
  const ch = text[i];
  if (!SENTENCE_MARKS.has(ch)) return false;
  if (ch !== '.') return true;
  if (text[i - 1] === '.' || text[i + 1] === '.') return false;
  const next = text[i + 1];
  if (next !== undefined && /[\p{L}\p{N}_]/u.test(next)) return false;
  if (afterPlaceholder) return true;
  const word = /(\p{L}+)$/u.exec(text.slice(0, i))?.[1] || '';
  if (word.length === 1) return false;
  if (word.length <= 3 && /^\p{Lu}/u.test(word)) return false;
  return true;
}

/**
 * What stands on one side of a placeholder span, skipping spaces (and, on
 * the left, closing quotes/brackets): the message's edge, a sentence
 * boundary, clause punctuation, or a word (anything else, another
 * placeholder included).
 *
 * @returns {{ kind: 'edge'|'boundary'|'clause'|'word', at: number }}
 */
function sideOf(text, span, side, placeholderEnds = new Set()) {
  if (side === 'left') {
    let j = span.start - 1;
    while (j >= 0 && (SPACE.test(text[j]) || CLOSERS.has(text[j]))) j--;
    if (j < 0) return { kind: 'edge', at: -1 };
    if (isSentenceBoundaryAt(text, j, placeholderEnds.has(j))) return { kind: 'boundary', at: j };
    if (SENTENCE_MARKS.has(text[j]) || CLAUSE_MARKS.has(text[j])) return { kind: 'clause', at: j };
    return { kind: 'word', at: j };
  }
  let k = span.end;
  while (k < text.length && SPACE.test(text[k])) k++;
  if (k >= text.length) return { kind: 'edge', at: k };
  if (isSentenceBoundaryAt(text, k, k === span.end || /^\s*$/.test(text.slice(span.end, k)))) return { kind: 'boundary', at: k };
  if (SENTENCE_MARKS.has(text[k]) || CLAUSE_MARKS.has(text[k]) || CLOSERS.has(text[k])) return { kind: 'clause', at: k };
  return { kind: 'word', at: k };
}

/**
 * The sentence breaks a translation INSERTED beside a placeholder, leaving
 * it standing as a sentence of its own — the one rule the sync gate refuses
 * by (lib/validate.js) and verify flags by (lib/verify.js):
 *   { token: '{time}', side: 'before', issue: 'a sentence break was inserted before {time} ("medisina. {time}.") — {time} now stands as a sentence of its own; in the source it is part of one' }
 *
 * A finding needs:
 *   1. a placeholder the translation shares with the source, with a
 *      sentence boundary right BEFORE or right AFTER it in the translation
 *      ("medisina. {time}", "{time}. Kisik") — text before it, so a mark
 *      that opens nothing is not one;
 *   2. nothing of its sentence around it: on each side only a boundary or
 *      the message's edge (". {time}." — the time shown as a sentence);
 *   3. in the source, that placeholder inside a sentence: a word on one
 *      side, not a boundary, clause punctuation or the edge
 *      ("Take this medicine at {time}.").
 * Narrow on purpose (Round 14 measurement, lib/placeholders.js tests): a
 * placeholder that only starts or ends a sentence in the translation is
 * word order, not damage — "Open an issue on {github} or …" is rightly
 * "{github}에 이슈를 열거나 …" in Korean, and "Shipped by {carrier} on
 * {date}." rightly "Expédié le {date} par {carrier}." Left out: ICU
 * plural/select messages (the ICU check judges their branches).
 *
 * @param {string} sourceValue
 * @param {string} targetValue
 * @returns {Array<{ token: string, side: 'before'|'after', issue: string }>}
 */
function placeholderSentenceBreaks(sourceValue, targetValue) {
  if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') return [];
  if (sourceValue === targetValue) return [];
  if (ICU_BRANCHING.test(sourceValue) || ICU_BRANCHING.test(targetValue)) return [];
  const targetSpans = placeholderSpans(targetValue);
  if (targetSpans.length === 0) return [];
  const sourceSpans = placeholderSpans(sourceValue);

  // In the source the placeholder is part of a sentence: a word beside it.
  const inSentence = (token) => sourceSpans.some(s => s.token === token
    && (sideOf(sourceValue, s, 'left').kind === 'word' || sideOf(sourceValue, s, 'right').kind === 'word'));

  const ends = new Set(targetSpans.map(t => t.end));
  const found = [];
  const seen = new Set();
  for (const s of targetSpans) {
    if (seen.has(s.token) || !inSentence(s.token)) continue; // a missing/extra placeholder is placeholderChanges' finding
    const left = sideOf(targetValue, s, 'left', ends);
    const right = sideOf(targetValue, s, 'right');
    const alone = (left.kind === 'boundary' || left.kind === 'edge') && (right.kind === 'boundary' || right.kind === 'edge');
    if (!alone || (left.kind !== 'boundary' && right.kind !== 'boundary')) continue;
    // A boundary before it must close some text; one after it at the very
    // end of the message, with nothing before, is the message's own end.
    if (left.kind === 'boundary' && !/[\p{L}\p{N}]/u.test(targetValue.slice(0, left.at))) continue;
    seen.add(s.token);
    const side = left.kind === 'boundary' ? 'before' : 'after';
    // The word before the mark, the placeholder, the mark after it: "medisina. {time}."
    const from = left.kind === 'boundary' ? Math.max(0, targetValue.slice(0, left.at).search(/\S+\s*$/)) : s.start;
    const to = right.kind === 'boundary' ? right.at + 1 : s.end;
    const shown = targetValue.slice(from, to).trim();
    found.push({
      token: s.token,
      side,
      issue: `a sentence break was inserted ${side} ${s.shown} ("${shown}") — ${s.shown} now stands as a sentence of its own; in the source it is part of one`,
    });
  }
  return found;
}

/** Sentence boundaries in a text: runs of marks ("?!", "。") count once. */
function countSentenceBoundaries(text) {
  const ends = new Set(placeholderSpans(text).map(s => s.end));
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (!SENTENCE_MARKS.has(text[i])) continue;
    let j = i;
    while (j + 1 < text.length && SENTENCE_MARKS.has(text[j + 1])) j++;
    for (let k = i; k <= j; k++) {
      if (isSentenceBoundaryAt(text, k, ends.has(k))) { n++; break; }
    }
    i = j;
  }
  return n;
}

export {
  extractPlaceholders,
  comparePlaceholders,
  placeholderSyntax,
  showPlaceholder,
  parsesAsICU,
  placeholderChanges,
  placeholderSentenceBreaks,
  countSentenceBoundaries,
  PLACEHOLDER_SYNTAX_NAMES,
};
