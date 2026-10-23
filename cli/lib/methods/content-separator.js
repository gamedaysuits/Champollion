/**
 * Content prompt separator — shared between all methods that handle
 * freeform Markdown content translation.
 *
 * buildContentPrompt() (content.js) constructs prompts as:
 *   [translation instructions]\n---\n[markdown body]
 *
 * API-based methods (DeepL, Google, Microsoft, LibreTranslate) need to
 * extract just the Markdown body because they don't understand instruction
 * prompts — they translate raw text. LLM methods send the full prompt as-is.
 *
 * WHY THIS MODULE: Four method files each defined `const separator = '\n---\n'`
 * and had their own split logic. If buildContentPrompt() ever changed its
 * separator format, all four would silently break. Single source of truth.
 */

/**
 * The separator string used by buildContentPrompt() to divide
 * translation instructions from the Markdown body.
 */
export const CONTENT_SEPARATOR = '\n---\n';

import { SEGMENT_MARKER_PREFIX, SEGMENT_MARKER_SUFFIX } from '../segment.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One block-batch segment marker on its own line (segment.js
// buildBlockBatchPrompt writes "⟦SEG_N⟧\n<block>" separated by blank lines).
const SEGMENT_LINE = new RegExp(
  `^${escapeRegExp(SEGMENT_MARKER_PREFIX)}(\\d+)${escapeRegExp(SEGMENT_MARKER_SUFFIX)}[ \\t]*$`,
  'gm',
);

/**
 * The Markdown a content prompt carries, without the LLM instructions.
 *
 * The content lane builds prompts for an LLM: the block-batch prompt
 * (instructions, then one ⟦SEG_N⟧ marker line per block) or the page prompt
 * (instructions, "---", the body). A method that is not an LLM must send
 * only the Markdown — never the instructions.
 *
 * @param {string} prompt
 * @returns {{ mode: 'segments', keys: object, ids: string[] } | { mode: 'page', keys: object } | null}
 */
export function parseContentPrompt(prompt) {
  const text = String(prompt);
  const marks = [...text.matchAll(SEGMENT_LINE)];
  if (marks.length > 0) {
    const keys = {};
    marks.forEach((m, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
      keys[`segment.${m[1]}`] = text
        .slice(m.index + m[0].length, end)
        .replace(/^\r?\n/, '')
        .replace(/[\r\n]+\s*$/, '');
    });
    return { mode: 'segments', keys, ids: marks.map((m) => m[1]) };
  }
  const sep = text.indexOf(CONTENT_SEPARATOR);
  if (sep !== -1) {
    return { mode: 'page', keys: { body: text.slice(sep + CONTENT_SEPARATOR.length) } };
  }
  return null;
}

/**
 * Extract the Markdown body from a content prompt.
 *
 * @param {string} prompt - Full prompt from buildContentPrompt()
 * @returns {string} The Markdown body after the separator, or the full
 *   prompt if no separator is found (with a warning logged).
 */
export function extractContentBody(prompt) {
  const sepIdx = prompt.indexOf(CONTENT_SEPARATOR);
  if (sepIdx === -1) {
    // Warn but don't throw — the caller may be passing raw content
    // that wasn't built by buildContentPrompt(). This is unexpected
    // in production but shouldn't crash edge cases or tests.
    if (typeof process !== 'undefined' && process.stderr) {
      process.stderr.write(
        '[WARN] Content prompt missing separator "\\n---\\n". ' +
        'Expected output from buildContentPrompt().\n'
      );
    }
    return prompt;
  }
  return prompt.slice(sepIdx + CONTENT_SEPARATOR.length);
}
