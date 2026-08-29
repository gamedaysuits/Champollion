/**
 * XLIFF 1.2 export/import — zero-dependency.
 *
 * WHY THIS EXISTS:
 *   XLIFF (XML Localization Interchange File Format) is the universal
 *   exchange format between translation tools. Supporting it lets users:
 *     1. Export translations for professional review in memoQ/SDL Trados/Phrase
 *     2. Import reviewed translations back into their project
 *     3. Feed translations into existing CAT tool workflows
 *     4. Archive translations in a standard, tool-agnostic format
 *
 * WHY 1.2:
 *   XLIFF 2.0+ is cleaner but adoption is spotty. 1.2 is universally
 *   supported by every CAT tool, localization platform, and TM system
 *   in the industry. We generate 1.2 for maximum interoperability.
 *
 * WHAT THIS IS NOT:
 *   This is NOT a full XLIFF parser. We generate clean, well-formed XLIFF
 *   and parse our own output back. We DON'T handle arbitrary XLIFF from
 *   third-party tools with extensions, inline markup, etc. If a user
 *   imports XLIFF from memoQ, we extract <target> text and ignore the rest.
 *
 * ZERO DEPENDENCIES. Uses regex-based XML parsing because:
 *   1. Our XLIFF output is predictable and well-formed
 *   2. We only need to extract source/target text from <trans-unit> elements
 *   3. No DOM manipulation needed
 *   4. Keeps the zero-dep promise
 */

// -----------------------------------------------------------------
// XLIFF Export — flat key→value maps → XLIFF 1.2 XML string
// -----------------------------------------------------------------

/**
 * Export a source/target pair to XLIFF 1.2 format.
 *
 * @param {object} options
 * @param {string} options.sourceLocale - Source language code (e.g., 'en')
 * @param {string} options.targetLocale - Target language code (e.g., 'fr')
 * @param {object} options.sourceFlat - Source key→value map
 * @param {object} options.targetFlat - Target key→value map (can be partial)
 * @param {string} [options.original] - Original filename/path for metadata
 * @param {import('./no-translate.js').NoTranslateMatcher} [options.noTranslate] -
 *   Compiled no-translate matcher. Matching units are emitted with
 *   translate="no", state="final", and the source pre-filled as the target.
 * @returns {string} XLIFF 1.2 XML string
 */
function exportXLIFF({ sourceLocale, targetLocale, sourceFlat, targetFlat, original = 'locale.json', noTranslate = null }) {
  const units = [];

  for (const [key, sourceValue] of Object.entries(sourceFlat)) {
    if (typeof sourceValue !== 'string') continue;

    // Keys the project declared no-translate carry XLIFF 1.2's own
    // translate="no" and are pre-filled with the source, already final. The
    // unit still ships — dropping it would make the file an incomplete key
    // inventory — but a CAT tool will lock it, so nobody spends time
    // "translating" a URL only for the next sync to revert it.
    const exempt = !!(noTranslate && noTranslate.matches(key, sourceValue));

    const targetValue = targetFlat[key];
    const hasTarget = typeof targetValue === 'string' && targetValue.length > 0;

    // state: "translated" if we have a target, "new" if not
    const state = exempt ? 'final' : hasTarget ? 'translated' : 'new';
    const body = exempt ? sourceValue : (hasTarget ? targetValue : '');

    units.push(
      `      <trans-unit id="${escapeXML(key)}"${exempt ? ' translate="no"' : ''} xml:space="preserve">` +
      `\n        <source>${escapeXML(sourceValue)}</source>` +
      `\n        <target state="${state}">${escapeXML(body)}</target>` +
      `\n      </trans-unit>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${escapeXML(original)}" source-language="${escapeXML(sourceLocale)}" target-language="${escapeXML(targetLocale)}" datatype="plaintext">
    <header>
      <tool tool-id="champollion" tool-name="champollion" tool-version="1.0"/>
    </header>
    <body>
${units.join('\n')}
    </body>
  </file>
</xliff>
`;
}

// -----------------------------------------------------------------
// XLIFF Import — XLIFF 1.2 XML string → flat key→value map
// -----------------------------------------------------------------

/**
 * Import translations from an XLIFF 1.2 string.
 *
 * Extracts <trans-unit id="..."> <target>...</target> pairs.
 * Only includes units where the target has actual content.
 *
 * @param {string} xliffString - XLIFF 1.2 XML content
 * @returns {{ translations: object, metadata: { sourceLocale: string, targetLocale: string, original: string } }}
 */
function importXLIFF(xliffString) {
  const translations = {};

  // Extract file-level metadata
  const fileMatch = xliffString.match(
    /<file[^>]*source-language="([^"]*)"[^>]*target-language="([^"]*)"[^>]*(?:original="([^"]*)")?/
  );
  const metadata = {
    sourceLocale: fileMatch ? unescapeXML(fileMatch[1]) : '',
    targetLocale: fileMatch ? unescapeXML(fileMatch[2]) : '',
    original: fileMatch && fileMatch[3] ? unescapeXML(fileMatch[3]) : '',
  };

  // Also try original before target-language (attribute order varies)
  if (!metadata.original) {
    const origMatch = xliffString.match(/<file[^>]*original="([^"]*)"/);
    if (origMatch) metadata.original = unescapeXML(origMatch[1]);
  }

  // Extract trans-unit elements
  // Using a non-greedy match to handle each unit individually
  const unitPattern = /<trans-unit[^>]*id="([^"]*)"[^>]*>[\s\S]*?<\/trans-unit>/g;
  let match;

  while ((match = unitPattern.exec(xliffString)) !== null) {
    const unitId = unescapeXML(match[1]);
    const unitContent = match[0];

    // Extract target content (if present and non-empty)
    const targetMatch = unitContent.match(/<target[^>]*>([\s\S]*?)<\/target>/);
    if (targetMatch && targetMatch[1].length > 0) {
      translations[unitId] = unescapeXML(targetMatch[1]);
    }
  }

  return { translations, metadata };
}

// -----------------------------------------------------------------
// XML escaping
// -----------------------------------------------------------------

/**
 * Escape special XML characters in text content.
 *
 * @param {string} str - Raw string
 * @returns {string} XML-safe string
 */
function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML entities back to raw characters.
 *
 * @param {string} str - XML-escaped string
 * @returns {string} Raw string
 */
function unescapeXML(str) {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

// -----------------------------------------------------------------
// Exports
// -----------------------------------------------------------------

export {
  exportXLIFF,
  importXLIFF,
  escapeXML,
  unescapeXML,
};
