/**
 * How the network commands read and write a language pair — one parser for
 * `register-corpus --pair`, `leaderboard --pair`, `recommend <pair>` and the
 * pair fields of `submit`, so they accept the same spellings and print the
 * same one.
 *
 * WRITTEN (what these commands print): source>target — `eng>crk`. It is the
 * form the leaderboard stores (mt-eval's publish writes `eng>crk`), the form
 * the harness's own --pair flags take, and the form the docs show. In a
 * command it is quoted, `--pair "eng>crk"`: an unquoted > makes the shell
 * write the output to a file.
 *
 * READ (what they accept):
 *   eng>crk  eng-crk  eng:crk  eng→crk  eng->crk  eng,crk  "eng crk"
 *
 * The rule that keeps this unambiguous: `-` is also the separator INSIDE a
 * locale code (pt-BR, sr-Latn, crk-Cans). So
 *   - with an explicit separator (> : → -> , or a space), the value splits
 *     there and either side may carry its own hyphens: "en>pt-BR";
 *   - with hyphens only, the value is a pair only when it is exactly two bare
 *     language codes of two or three letters: eng-crk, en-fr. crk-Cans is one
 *     code with a script subtag, not crk → Cans; en-pt-BR could be en + pt-BR
 *     or en-PT + BR (and `br` is Breton). Those are refused, never guessed,
 *     and the refusal names the readings in the written form.
 * This is the harness's own rule (arena/mt_eval_harness/pair_notation.py),
 * so `mt-eval` and `champollion` read a dash pair the same way.
 *
 * Project pairs are a different key space: `sync`, `verify` and `serve`
 * --pair name pairs of champollion.config.json, whose keys are written
 * `en:fr`. They go through lib/pairs.js (filterPairGraph), which reads the
 * same separators and settles a many-hyphen dash form against the pairs the
 * project configures.
 *
 * @module language-pair
 */

/** The separator a written pair uses. */
export const PAIR_SEPARATOR = '>';

/** One line for help text: how to write a pair, and what else is accepted. */
export const PAIR_NOTATION_HELP =
  'source>target, e.g. "eng>crk" (quote it: an unquoted > sends the output to a file). '
  + 'eng-crk, eng:crk and "eng crk" are read the same way; a code with its own hyphen (pt-BR) needs >, e.g. "eng>pt-BR"';

// Longest first, so "->" is never read as "-" followed by ">".
const EXPLICIT_SEPARATORS = ['->', '→', '>', ':', ','];

// A language code or locale tag: letters first, then letters/digits, with
// optional -/_ subtags (eng, crk, pt-BR, sr-Latn, zh-Hant-TW, ace_Arab, qaa).
const CODE_SHAPE = /^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/;

// The dash form: exactly two bare ISO 639 codes (the harness's _HYPHEN_PAIR).
const DASH_PAIR = /^([A-Za-z]{2,3})-([A-Za-z]{2,3})$/;

/**
 * Write a pair in the one form these commands print: `eng>crk`.
 *
 * @param {{source: string, target: string}} pair
 * @returns {string}
 */
export function formatLanguagePair(pair) {
  return `${pair.source}${PAIR_SEPARATOR}${pair.target}`;
}

/**
 * The same, ready to paste into a command: `"eng>crk"` (quoted for the > ).
 *
 * @param {{source: string, target: string}} pair
 * @returns {string}
 */
export function quotedLanguagePair(pair) {
  return `"${formatLanguagePair(pair)}"`;
}

function sides(source, target, shown) {
  const s = source.trim();
  const t = target.trim();
  if (!s) return { ok: false, error: `${shown} names no source language — write source>target, e.g. "eng>crk".` };
  if (!t) return { ok: false, error: `${shown} names no target language — write source>target, e.g. "eng>crk".` };
  for (const code of [s, t]) {
    if (!CODE_SHAPE.test(code)) {
      return {
        ok: false,
        error: `${shown}: "${code}" is not a language code (letters and digits, with -subtags such as pt-BR). `
          + 'Write the pair source>target, e.g. "eng>crk".',
      };
    }
  }
  return { ok: true, source: s, target: t };
}

/**
 * Read a language pair in any accepted spelling (see the module comment).
 * Codes keep the case they were typed in — callers that key on lower case
 * (card ids, the leaderboard) lower it themselves.
 *
 * @param {*} value the raw value (a flag, a positional, a form line)
 * @param {object} [o]
 * @param {string} [o.label] how to name the value in an error (default: the value quoted)
 * @returns {{ok: true, source: string, target: string} | {ok: false, error: string}}
 */
export function parseLanguagePair(value, { label } = {}) {
  if (value === undefined || value === null || value === true || value === false) {
    return { ok: false, error: `${label || 'The pair'} needs a value: source>target, e.g. "eng>crk" (or eng-crk).` };
  }
  const raw = String(value).trim();
  const shown = label ? `${label} ${raw}` : `"${raw}"`;
  if (!raw) return { ok: false, error: `${label || 'The pair'} is empty — write source>target, e.g. "eng>crk" (or eng-crk).` };

  for (const sep of EXPLICIT_SEPARATORS) {
    if (!raw.includes(sep)) continue;
    const parts = raw.split(sep);
    if (parts.length !== 2) {
      return { ok: false, error: `${shown} has more than one "${sep}" — a pair is two codes: source>target, e.g. "eng>crk".` };
    }
    return sides(parts[0], parts[1], shown);
  }

  if (/\s/.test(raw)) {
    const words = raw.split(/\s+/);
    if (words.length === 2) return sides(words[0], words[1], shown);
    if (words.length === 3 && words[1] === '-') return sides(words[0], words[2], shown);
    return { ok: false, error: `${shown} is more than two codes — a pair is source>target, e.g. "eng>crk".` };
  }

  const dash = DASH_PAIR.exec(raw);
  if (dash) return { ok: true, source: dash[1], target: dash[2] };
  const hyphens = [];
  for (let i = raw.indexOf('-'); i !== -1; i = raw.indexOf('-', i + 1)) hyphens.push(i);
  if (hyphens.length === 1) {
    // One hyphen, but a side is not a bare 2–3 letter code: crk-Cans is a
    // code with a script subtag, not a pair.
    return {
      ok: false,
      error: `${shown} is not read as a pair: with a hyphen, a pair is two language codes of two or three `
        + 'letters (eng-crk), and a side of this one is not (crk-Cans, say, is one code with a script subtag). '
        + 'Write the pair with > between the two codes, e.g. "eng>crk-Cans".',
    };
  }
  if (hyphens.length === 0) {
    // One code, no separator. The commonest way to get here: `--pair eng>crk`
    // typed without quotes — the shell takes `>crk` as "write the output to a
    // file named crk" and passes just `eng`.
    return {
      ok: false,
      error: `${shown} names one language; a pair names two, source first: "eng>crk" or eng-crk. `
        + `If you typed ${raw}>… without quotes, the shell read the > as "send the output to a file" `
        + '(and may have made a file named after the second code): quote the pair, or use the dash form.',
    };
  }
  const readings = hyphens.map((i) => quotedLanguagePair({ source: raw.slice(0, i), target: raw.slice(i + 1) }));
  return {
    ok: false,
    error: `${shown} has ${hyphens.length} hyphens, so it can be read more than one way (${readings.join(' or ')}). `
      + 'A code with its own hyphen (pt-BR, sr-Latn) needs > between the two codes — write the one you mean.',
  };
}
