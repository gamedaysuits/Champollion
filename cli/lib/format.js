/**
 * Format adapter — reads and writes locale files in JSON, TOML, and YAML.
 *
 * WHY: Hugo uses TOML or YAML for i18n string files, not JSON.
 * Hugo's i18n/ structure looks like:
 *
 *   [home]                    # TOML section = translation key
 *   other = "Home"            # 'other' = the default/plural form
 *
 *   [items]
 *   one = "{{ .Count }} item"
 *   other = "{{ .Count }} items"
 *
 * This module converts between Hugo's format and our internal flat
 * key→value map, so the diff/translate/hash engine stays format-agnostic.
 *
 * ZERO DEPENDENCIES: Hugo i18n files have a constrained, predictable
 * structure. We don't need js-yaml or a full TOML parser — just
 * targeted parsers for the subset Hugo actually uses.
 */

import fs from 'node:fs';

// CLDR plural categories used by Hugo/go-i18n
const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

/**
 * Strip a leading UTF-8 BOM (U+FEFF) from a decoded string.
 *
 * WHY: Editors on Windows (and some export pipelines) prepend a BOM to
 * locale files. JSON.parse() and our hand-rolled TOML/YAML scanners choke
 * on the invisible leading character — JSON.parse throws "Unexpected token",
 * and the YAML/TOML line scanners fail to match the first key. A BOM is a
 * pure encoding artifact, never semantic content, so we drop it on read.
 *
 * @param {string} str - Decoded file content
 * @returns {string} Content with any leading BOM removed
 */
function stripBOM(str) {
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

// -----------------------------------------------------------------
// Format detection
// -----------------------------------------------------------------

/**
 * Detect the locale file format from a file path's extension.
 *
 * @param {string} filePath - Path to a locale file
 * @returns {'json'|'toml'|'yaml'} Detected format
 */
function detectFormat(filePath) {
  if (filePath.endsWith('.toml')) return 'toml';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
  return 'json';
}

/**
 * Get the file extension string for a format.
 *
 * @param {'json'|'toml'|'yaml'} format
 * @returns {string} File extension including the dot
 */
function getExtension(format) {
  if (format === 'toml') return '.toml';
  if (format === 'yaml') return '.yaml';
  return '.json';
}

/**
 * Auto-detect the format used in a locales directory by scanning
 * for the most common file extension present.
 *
 * @param {string} localesDir - Path to the locales directory
 * @returns {'json'|'toml'|'yaml'} Detected format, defaults to 'json'
 */
function detectFormatFromDir(localesDir) {
  if (!fs.existsSync(localesDir)) return 'json';

  const files = fs.readdirSync(localesDir);
  const counts = { json: 0, toml: 0, yaml: 0 };

  for (const file of files) {
    if (file.endsWith('.toml')) counts.toml++;
    else if (file.endsWith('.yaml') || file.endsWith('.yml')) counts.yaml++;
    else if (file.endsWith('.json')) counts.json++;
  }

  // Return whichever format has the most files
  if (counts.toml > counts.json && counts.toml >= counts.yaml) return 'toml';
  if (counts.yaml > counts.json && counts.yaml >= counts.toml) return 'yaml';
  return 'json';
}

// -----------------------------------------------------------------
// Read: format → flat key-value map
// -----------------------------------------------------------------

/**
 * Read a locale file and return a flat key→value map.
 *
 * For TOML/YAML Hugo files, simple keys (only 'other') flatten to
 * { "key": "value" }. Plural keys flatten to { "key.one": "...",
 * "key.other": "..." }.
 *
 * @param {string} filePath - Path to the locale file
 * @param {'json'|'toml'|'yaml'} format - File format
 * @returns {object} Flat key→value map
 */
function readLocaleFile(filePath, format) {
  if (!fs.existsSync(filePath)) return {};
  // Strip a leading BOM before any parsing — a U+FEFF prefix otherwise
  // hard-crashes JSON.parse() and silently breaks the first key match in
  // the TOML/YAML line scanners.
  const raw = stripBOM(fs.readFileSync(filePath, 'utf-8'));
  if (!raw.trim()) return {};

  if (format === 'toml') return parseTOMLToFlat(raw);
  if (format === 'yaml') return parseYAMLToFlat(raw);

  // JSON: caller handles flattening. Wrap the raw V8 SyntaxError (which only
  // gives a byte offset, no filename or hint) in a file-named, friendlier
  // error so the user can actually find and fix the broken file.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const hint = /,\s*[}\]]/.test(raw)
      ? ' (looks like a trailing comma — JSON does not allow them)'
      : '';
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}${hint}`);
  }
  // Duplicate JSON keys silently last-win in JSON.parse — warn so the loss
  // is visible (a copy-pasted key that quietly overwrote an earlier value).
  for (const dup of findDuplicateJSONKeys(raw)) {
    console.warn(`  [WARN] Duplicate JSON key "${dup}" in ${filePath} — later value wins, earlier value discarded.`);
  }
  return parsed;
}

/**
 * Find object keys that appear more than once within the same object in a
 * JSON document. JSON.parse() silently keeps the last value, masking
 * copy-paste mistakes; this scanner re-walks the raw text (string- and
 * escape-aware) so we can warn instead.
 *
 * @param {string} raw - Raw JSON text
 * @returns {string[]} Duplicate key names (deduplicated, in first-seen order)
 */
function findDuplicateJSONKeys(raw) {
  const duplicates = new Set();
  // Stack of Sets — one per open object — tracking keys seen at that depth.
  const objectStack = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  // `expectKey` is true when the next string token is an object key (i.e. we
  // just opened an object or saw a comma inside an object).
  let expectKey = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') {
        inString = false;
        // If this string was a key, record it against the current object.
        if (expectKey && objectStack.length > 0) {
          const key = raw.slice(stringStart + 1, i);
          const seen = objectStack[objectStack.length - 1];
          if (seen.has(key)) duplicates.add(key);
          else seen.add(key);
          expectKey = false; // next is ':' then a value
        }
      }
      continue;
    }

    switch (ch) {
      case '"':
        inString = true;
        stringStart = i;
        break;
      case '{':
        objectStack.push(new Set());
        expectKey = true;
        break;
      case '}':
        objectStack.pop();
        expectKey = false;
        break;
      case '[':
        // Array elements are never keys.
        objectStack.push(null);
        expectKey = false;
        break;
      case ']':
        objectStack.pop();
        expectKey = false;
        break;
      case ',':
        // Inside an object, a comma means another key follows.
        expectKey = objectStack.length > 0 &&
          objectStack[objectStack.length - 1] !== null;
        break;
      default:
        break;
    }
  }

  return [...duplicates];
}

/**
 * Write a nested data object to a locale file in the specified format.
 *
 * For JSON, this writes the nested structure directly.
 * For TOML/YAML, this converts to the appropriate section format.
 *
 * @param {string} filePath - Output file path
 * @param {object} data - Nested data object (for JSON) or flat map (for TOML/YAML)
 * @param {'json'|'toml'|'yaml'} format - Target format
 * @param {object} flatData - Flat key→value map (used for TOML/YAML reconstruction)
 * @param {'hugo'|'nested'|null} yamlStyle - YAML variant: 'hugo' for Hugo i18n, 'nested' for standard nested YAML
 */
function writeLocaleFile(filePath, data, format, flatData, yamlStyle) {
  let content;
  if (format === 'toml') {
    content = flatToTOML(flatData || data);
  } else if (format === 'yaml') {
    // Route to the correct YAML serializer based on detected style.
    // Hugo YAML uses CLDR plural sub-keys (other:, one:, etc.).
    // Standard nested YAML uses arbitrary nesting (nav: { home: ... }).
    const serializer = yamlStyle === 'nested' ? flatToNestedYAML : flatToYAML;
    content = serializer(flatData || data);
  } else {
    content = JSON.stringify(data, null, 2) + '\n';
  }
  writeFileAtomic(filePath, content);
}

/**
 * Write a file atomically: serialize to a sibling temp file, then rename over
 * the target. rename(2) is atomic within a filesystem, so a crash or a partial
 * write can never leave a half-written locale file on disk — readers see either
 * the old content or the complete new content, never garbage.
 *
 * @param {string} filePath - Destination path
 * @param {string} content - Full file content
 */
function writeFileAtomic(filePath, content) {
  // Co-locate the temp file in the same directory so the final rename stays on
  // the same filesystem (cross-device rename is not atomic and would EXDEV).
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up the temp file on failure so we don't litter the locales dir.
    try { fs.unlinkSync(tmpPath); } catch { /* temp may not exist */ }
    throw err;
  }
}

// -----------------------------------------------------------------
// TOML parser (Hugo i18n subset)
// -----------------------------------------------------------------

/**
 * Parse Hugo i18n TOML content into a flat key→value map.
 *
 * Handles:
 *   [section]           → section header (translation key)
 *   other = "value"     → simple string (flattens to { section: value })
 *   one = "singular"    → plural form (flattens to { section.one: value })
 *   # comments          → skipped
 *
 * @param {string} content - Raw TOML file content
 * @returns {object} Flat key→value map
 */
function parseTOMLToFlat(content) {
  const sections = parseTOMLSections(content);
  return sectionsToFlat(sections);
}

/**
 * Parse TOML into an intermediate section map.
 *
 * @param {string} content - Raw TOML content
 * @returns {Object<string, Object<string, string>>} Section map: { sectionName: { subKey: value } }
 */
function parseTOMLSections(content) {
  const sections = {};
  let currentSection = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section header: [key_name]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections[currentSection]) sections[currentSection] = {};
      continue;
    }

    // Key-value pair within a section
    if (currentSection) {
      const kv = parseTOMLKeyValue(trimmed);
      if (kv) {
        // Duplicate key within the same section silently last-wins, which can
        // mask a copy-paste mistake. Warn so the loss is visible.
        if (Object.prototype.hasOwnProperty.call(sections[currentSection], kv.key)) {
          console.warn(
            `  [WARN] Duplicate TOML key "${currentSection}.${kv.key}" — ` +
            `later value wins, earlier value discarded.`
          );
        }
        sections[currentSection][kv.key] = kv.value;
      }
    }
  }

  return sections;
}

/**
 * Parse a single TOML key = "value" line.
 * Handles double-quoted, single-quoted, and bare values.
 *
 * @param {string} line - Trimmed TOML line
 * @returns {{ key: string, value: string }|null} Parsed key-value pair, or null if not a valid pair
 */
function parseTOMLKeyValue(line) {
  const eqIdx = line.indexOf('=');
  if (eqIdx < 0) return null;

  const key = line.slice(0, eqIdx).trim();
  let value = line.slice(eqIdx + 1).trim();

  // Double-quoted string
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
    return { key, value };
  }

  // Single-quoted string (literal, no escapes in TOML spec)
  if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
    return { key, value };
  }

  // Bare value (shouldn't happen in i18n files, but handle gracefully)
  return { key, value };
}

/**
 * Serialize a flat key→value map to Hugo i18n TOML format.
 *
 * Simple keys write as:
 *   [key]
 *   other = "value"
 *
 * Plural keys (key.one, key.other) group under one section:
 *   [key]
 *   one = "singular"
 *   other = "plural"
 *
 * @param {object} flat - Flat key→value map
 * @returns {string} TOML content
 */
function flatToTOML(flat) {
  const grouped = groupFlatKeys(flat);
  const lines = [];

  for (const [section, values] of Object.entries(grouped)) {
    lines.push(`[${section}]`);
    for (const [subKey, value] of Object.entries(values)) {
      const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
      lines.push(`${subKey} = "${escaped}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------
// YAML parser (Hugo i18n subset)
// -----------------------------------------------------------------

/**
 * Parse Hugo i18n YAML content into a flat key→value map.
 *
 * Handles the standard Hugo format:
 *   key:
 *     other: "value"
 *   items:
 *     one: "singular"
 *     other: "plural"
 *
 * @param {string} content - Raw YAML file content
 * @returns {object} Flat key→value map
 */
function parseYAMLToFlat(content) {
  const tree = parseYAMLNested(content);
  return nestedTreeToFlat(tree);
}

/**
 * Parse YAML into an arbitrarily-deep nested object using an indentation
 * stack — the real fix for silently-dropped middle keys.
 *
 * The previous flat 2-level scanner (parseYAMLSections) could only see a
 * top-level section and its immediate children; a third level like
 * `nav:\n  menu:\n    home: ...` lost the `menu` container entirely, so the
 * write side (flatToNestedYAML, which DOES support arbitrary depth) round-
 * tripped to a corrupted file. This parser tracks indentation columns on a
 * stack so any depth re-nests correctly.
 *
 * Only the subset Hugo/Docusaurus i18n actually uses is supported: mappings
 * of scalar leaves. Block scalars / sequences are out of scope (and rare in
 * i18n files); a non-mapping line is treated as a scalar leaf.
 *
 * @param {string} content - Raw YAML content
 * @returns {object} Nested object tree
 */
function parseYAMLNested(content) {
  const root = {};
  // Stack of { indent, node } frames. The top frame is the mapping that
  // the next more-indented key belongs to.
  const stack = [{ indent: -1, node: root }];

  for (const rawLine of content.split('\n')) {
    // Strip a trailing \r (Windows line endings) and skip blank/comment lines.
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Find the key boundary. We only handle `key:` and `key: value` here.
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue; // not a mapping line — skip (out of subset)

    const key = trimmed.slice(0, colonIdx).trim();
    const valuePart = trimmed.slice(colonIdx + 1).trim();

    // Pop frames until the top frame is shallower than this line's indent,
    // so `node` is the correct parent mapping for this key.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;

    if (valuePart === '') {
      // A container key: its children live on the following, more-indented
      // lines. Create the child mapping and push it as the active frame.
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      // A scalar leaf.
      parent[key] = unquoteYAML(valuePart);
    }
  }

  return root;
}

/**
 * Flatten a nested YAML tree into the dotted-key map the rest of the
 * pipeline expects, applying Hugo-aware collapse rules:
 *   - A mapping whose ONLY child is `other` collapses to the parent key
 *     (Hugo's "simple string" shape: `home:\n  other: Home` → home).
 *   - Plural/sub-keys and arbitrary nesting flatten to dotted paths.
 *
 * @param {object} tree - Nested object from parseYAMLNested
 * @param {string} [prefix] - Accumulated dotted prefix (internal)
 * @param {object} [out] - Accumulator (internal)
 * @returns {object} Flat key→value map
 */
function nestedTreeToFlat(tree, prefix = '', out = {}) {
  const keys = Object.keys(tree);

  for (const key of keys) {
    const value = tree[key];
    const dotted = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object') {
      const childKeys = Object.keys(value);
      // Hugo simple-string collapse: a lone `other:` child becomes the
      // parent key itself (only at a Hugo plural section, i.e. leaf mapping).
      if (childKeys.length === 1 && childKeys[0] === 'other' &&
          typeof value.other !== 'object') {
        out[dotted] = value.other;
      } else {
        nestedTreeToFlat(value, dotted, out);
      }
    } else {
      out[dotted] = value;
    }
  }

  return out;
}

/**
 * Parse YAML into an intermediate section map.
 *
 * @param {string} content - Raw YAML content
 * @returns {Object<string, Object<string, string>>} Section map: { sectionName: { subKey: value } }
 */
function parseYAMLSections(content) {
  const sections = {};
  let currentSection = null;

  for (const line of content.split('\n')) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Top-level key (no leading whitespace)
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      // Section with sub-keys: "key:" (nothing after colon, or only whitespace)
      const sectionMatch = line.match(/^([^\s:]+):\s*$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = {};
        continue;
      }

      // Flat key-value: "key: value"
      const kvMatch = line.match(/^([^\s:]+):\s+(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = unquoteYAML(kvMatch[2]);
        sections[key] = { other: value };
        currentSection = null;
        continue;
      }
    }

    // Indented sub-key within a section
    if (currentSection && (line.startsWith('  ') || line.startsWith('\t'))) {
      const match = line.trim().match(/^([^\s:]+):\s+(.+)$/);
      if (match) {
        sections[currentSection][match[1]] = unquoteYAML(match[2]);
      }
    }
  }

  return sections;
}

/**
 * Remove surrounding quotes from a YAML value.
 *
 * @param {string} value - Raw YAML value string
 * @returns {string} Unquoted value
 */
function unquoteYAML(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Serialize a flat key→value map to Hugo i18n YAML format.
 *
 * @param {object} flat - Flat key→value map
 * @returns {string} YAML content
 */
function flatToYAML(flat) {
  const grouped = groupFlatKeys(flat);
  const lines = [];

  for (const [section, values] of Object.entries(grouped)) {
    lines.push(`${section}:`);
    for (const [subKey, value] of Object.entries(values)) {
      lines.push(`  ${subKey}: ${quoteYAMLValue(String(value))}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Serialize a flat key→value map to standard nested YAML.
 *
 * Re-nests dot-separated keys into a tree structure:
 *   { "nav.home": "Home", "nav.about": "About" }
 * Becomes:
 *   nav:
 *     home: Home
 *     about: About
 *
 * Does NOT add Hugo-specific "other:" wrapping.
 * Handles arbitrarily deep nesting (a.b.c.d → 4 levels).
 *
 * @param {object} flat - Flat key→value map
 * @returns {string} YAML content
 */
function flatToNestedYAML(flat) {
  // Build tree from flat keys
  const tree = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  // Recursively serialize the tree to YAML with proper indentation
  return serializeNestedYAML(tree, 0);
}

/**
 * Recursively serialize a nested object tree to YAML.
 *
 * @param {object} obj - Nested object
 * @param {number} indent - Current indentation level (in spaces)
 * @returns {string} YAML content
 */
function serializeNestedYAML(obj, indent) {
  const lines = [];
  const pad = ' '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${pad}${key}:`);
      lines.push(serializeNestedYAML(value, indent + 2));
    } else {
      lines.push(`${pad}${key}: ${quoteYAMLValue(String(value))}`);
    }
  }

  // Only add trailing newline at the top level
  return indent === 0 ? lines.join('\n') + '\n' : lines.join('\n');
}

/**
 * Quote a YAML value if it contains special characters.
 *
 * Shared by flatToYAML (Hugo) and flatToNestedYAML (standard) to ensure
 * consistent quoting behavior across both serializers.
 *
 * @param {string} strValue - Value to potentially quote
 * @returns {string} Quoted or bare value
 */
function quoteYAMLValue(strValue) {
  const needsQuotes = strValue.includes(':') || strValue.includes('#') ||
                      strValue.includes('{') || strValue.includes('}') ||
                      strValue.includes('[') || strValue.includes(']') ||
                      strValue.startsWith(' ') || strValue.endsWith(' ') ||
                      strValue.includes('"') || strValue.includes("'") ||
                      strValue === '' || strValue === 'true' || strValue === 'false' ||
                      strValue === 'null' || strValue === 'yes' || strValue === 'no';
  return needsQuotes
    ? `"${strValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : strValue;
}

/**
 * Detect whether a YAML file uses Hugo i18n format or standard nested format.
 *
 * Hugo i18n YAML uses CLDR plural sub-keys exclusively:
 *   home:
 *     other: "Home"
 *   items:
 *     one: "{{ .Count }} item"
 *     other: "{{ .Count }} items"
 *
 * Standard nested YAML uses arbitrary sub-keys:
 *   nav:
 *     home: Home
 *     about: About Us
 *
 * Detection: if ALL sub-keys across ALL sections are CLDR plural forms → 'hugo'.
 * If any sub-key is not a plural form → 'nested'.
 * Empty content defaults to 'nested'.
 *
 * @param {string} content - Raw YAML file content
 * @returns {'hugo'|'nested'} Detected YAML style
 */
function detectYAMLStyle(content) {
  if (!content || !content.trim()) return 'nested';

  // Use the full nested parser, not the old 2-level scanner: a deep file like
  // `nav:\n  menu:\n    home: …` would otherwise leave the parser blind to the
  // `menu` container and misclassify the file as 'hugo', re-serializing it
  // through the wrong writer and corrupting it.
  const tree = parseYAMLNested(content);
  const sectionEntries = Object.entries(tree);

  if (sectionEntries.length === 0) return 'nested';

  // Hugo i18n is exactly one level deep, and every section's sub-keys are
  // CLDR plural forms. Any non-plural sub-key, or any deeper nesting, means
  // standard nested YAML.
  for (const [, values] of sectionEntries) {
    if (values === null || typeof values !== 'object') continue;
    for (const [subKey, subVal] of Object.entries(values)) {
      if (!PLURAL_FORMS.has(subKey)) return 'nested';
      // A plural-named key that itself nests another mapping is not Hugo.
      if (subVal !== null && typeof subVal === 'object') return 'nested';
    }
  }

  return 'hugo';
}

// -----------------------------------------------------------------
// Shared utilities
// -----------------------------------------------------------------

/**
 * Convert an intermediate section map to a flat key→value map.
 *
 * If a section has only 'other', flatten to { section: value }.
 * If a section has plural forms, flatten to { section.one: ..., section.other: ... }.
 *
 * @param {object} sections - { sectionName: { subKey: value } }
 * @returns {object} Flat key→value map
 */
function sectionsToFlat(sections) {
  const flat = {};
  for (const [section, values] of Object.entries(sections)) {
    const subKeys = Object.keys(values);
    if (subKeys.length === 1 && subKeys[0] === 'other') {
      // Simple string — just use the section name as the flat key
      flat[section] = values.other;
    } else {
      // Plural forms or multiple sub-keys — preserve the structure
      for (const [subKey, value] of Object.entries(values)) {
        flat[`${section}.${subKey}`] = value;
      }
    }
  }
  return flat;
}

/**
 * Group flat keys back into section → { subKey: value } structure
 * for TOML/YAML serialization.
 *
 * Keys without plural suffixes get wrapped as { other: value }.
 * Keys ending in a CLDR plural form (one, other, few, etc.)
 * are grouped under their parent section.
 *
 * @param {object} flat - Flat key→value map
 * @returns {object} Grouped sections: { section: { subKey: value } }
 */
function groupFlatKeys(flat) {
  const sections = {};

  for (const [key, value] of Object.entries(flat)) {
    const lastDot = key.lastIndexOf('.');
    const possibleSection = lastDot > 0 ? key.substring(0, lastDot) : null;
    const possibleSubKey = lastDot > 0 ? key.substring(lastDot + 1) : null;

    if (possibleSubKey && PLURAL_FORMS.has(possibleSubKey)) {
      // This is a plural form — group under the parent section
      if (!sections[possibleSection]) sections[possibleSection] = {};
      sections[possibleSection][possibleSubKey] = value;
    } else {
      // Simple string — wrap as { other: value }
      if (!sections[key]) sections[key] = {};
      sections[key].other = value;
    }
  }

  return sections;
}

// -----------------------------------------------------------------
// Docusaurus format helpers
//
// Docusaurus i18n JSON files use a {message, description} wrapper:
//
//   {
//     "theme.blog.title": {
//       "message": "Blog",
//       "description": "The title of the blog page"
//     }
//   }
//
// These helpers convert between this format and the flat key→value
// strings that champollion's diff/translate pipeline expects.
//
// WHY separate functions (not modifying readLocaleFile/writeLocaleFile):
// The Docusaurus format is structurally different from nested JSON,
// TOML, or YAML. Routing it through readLocaleFile would require
// format-aware branching inside that function, which would risk
// breaking the existing JSON path. Keeping these as standalone
// helpers that the Docusaurus sync path calls directly is safer.
// -----------------------------------------------------------------

/**
 * Check if a parsed JSON object uses Docusaurus's {message, description} format.
 *
 * Detection heuristic: sample the first few values and check if they
 * are objects with a 'message' string field. Docusaurus code.json has
 * 90+ keys all in this format, so even a small sample is definitive.
 *
 * @param {object} data - Parsed JSON object
 * @returns {boolean} True if the data uses Docusaurus message format
 */
function isDocusaurusJSON(data) {
  if (!data || typeof data !== 'object') return false;

  const values = Object.values(data);
  if (values.length === 0) return false;

  // Sample up to 5 values — if all are {message: string} objects,
  // this is Docusaurus format. A single flat-string value disqualifies.
  const sample = values.slice(0, 5);
  return sample.every(
    val => typeof val === 'object' && val !== null && typeof val.message === 'string'
  );
}

/**
 * Extract translatable message strings from a Docusaurus JSON file.
 *
 * Converts:
 *   { "key": { "message": "Hello", "description": "..." } }
 * To:
 *   { "key": "Hello" }
 *
 * Keys whose values are plain strings (not wrapped in {message}) are
 * passed through as-is, for forward compatibility with any Docusaurus
 * files that mix formats.
 *
 * @param {object} data - Parsed Docusaurus JSON
 * @returns {object} Flat key→message map
 */
function extractDocusaurusMessages(data) {
  const flat = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'object' && val !== null && 'message' in val) {
      flat[key] = val.message;
    } else if (typeof val === 'string') {
      flat[key] = val;
    }
    // Skip non-string, non-object values (shouldn't exist in Docusaurus files)
  }
  return flat;
}

/**
 * Extract description context from Docusaurus {message, description} JSON.
 *
 * Returns a flat key→description map for entries that have a non-empty
 * description field. Keys without descriptions are omitted (not set to null).
 *
 * WHY: Docusaurus includes developer-written descriptions like
 *   "The title of the blog page" or "Button to submit a form"
 * that explain the string's UI context. Feeding these to the LLM
 * alongside the source text improves translation accuracy — the model
 * knows whether "Post" means "submit" or "blog post".
 *
 * @param {object} data - Parsed Docusaurus JSON
 * @returns {object} Flat key→description map (only keys with descriptions)
 */
function extractDocusaurusDescriptions(data) {
  const descriptions = {};
  for (const [key, val] of Object.entries(data)) {
    if (
      typeof val === 'object' &&
      val !== null &&
      typeof val.description === 'string' &&
      val.description.trim().length > 0
    ) {
      descriptions[key] = val.description;
    }
  }
  return descriptions;
}

/**
 * Inject translated messages back into the Docusaurus {message, description} format.
 *
 * Preserves the original 'description' field (and any other metadata Docusaurus
 * might add in future versions) for each key. Only the 'message' field is replaced.
 *
 * Keys in translatedFlat that don't exist in sourceData are ignored (defense).
 *
 * @param {object} sourceData - Original parsed Docusaurus JSON (with descriptions)
 * @param {object} translatedFlat - Flat key→translated message map
 * @returns {object} Docusaurus JSON with translated messages, descriptions preserved
 */
function injectDocusaurusMessages(sourceData, translatedFlat) {
  const result = {};
  for (const [key, val] of Object.entries(sourceData)) {
    if (typeof val === 'object' && val !== null && 'message' in val) {
      result[key] = {
        ...val, // preserve description and any other metadata
        message: key in translatedFlat ? translatedFlat[key] : val.message,
      };
    } else if (typeof val === 'string') {
      result[key] = key in translatedFlat ? translatedFlat[key] : val;
    } else {
      result[key] = val;
    }
  }
  return result;
}

export {
  detectFormat,
  detectFormatFromDir,
  getExtension,
  readLocaleFile,
  writeLocaleFile,
  parseTOMLToFlat,
  parseYAMLToFlat,
  flatToTOML,
  flatToYAML,
  flatToNestedYAML,
  detectYAMLStyle,
  quoteYAMLValue,
  sectionsToFlat,
  groupFlatKeys,
  PLURAL_FORMS,
  isDocusaurusJSON,
  extractDocusaurusMessages,
  extractDocusaurusDescriptions,
  injectDocusaurusMessages,
};

