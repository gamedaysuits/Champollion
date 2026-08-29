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
