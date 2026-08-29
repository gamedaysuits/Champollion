/**
 * Markdown content translation — translates Hugo content files.
 *
 * WHY: Hugo stores page content as Markdown files with YAML front matter.
 * Unlike i18n string files (key→value pairs), content files need:
 *   1. Front matter parsing — extract translatable fields (title, description)
 *   2. Block protection — shield code blocks, shortcodes, and inline code
 *      from the translation engine so they pass through untouched
 *   3. Body translation — send the protected Markdown to the LLM
 *   4. Reassembly — restore protected blocks and rebuild the file
 *
 * Hugo's translation-by-filename convention:
 *   content/posts/my-post.md       → default language
 *   content/posts/my-post.fr.md    → French
 *   content/posts/my-post.ja.md    → Japanese
 *
 * This module handles the parse→protect→translate→restore→write pipeline.
 */

import fs from 'node:fs';
import path from 'node:path';

// Sentinel used for protected block placeholders. Uses Unicode brackets
// that are extremely unlikely to appear in real content, making them
// safe to use as delimiters even if the LLM generates creative output.
const PLACEHOLDER_PREFIX = '⟦PROTECTED_';
const PLACEHOLDER_SUFFIX = '⟧';

// Front matter fields that should be translated by default.
// Other fields (date, draft, tags, slug, weight, etc.) are preserved as-is.
// `sidebar_label` is the Docusaurus sidebar/menu entry — user-facing prose that
// was previously left in the source language on every translated page.
const DEFAULT_TRANSLATABLE_FIELDS = [
  'title',
  'description',
  'summary',
  'subtitle',
  'caption',
  'linkTitle',
  'sidebar_label',
];

// Top-level front matter keys that are structural/taxonomy metadata, NOT human
// prose — safe to leave untranslated even when they appear as arrays or nested
// blocks the flat parser can't reach. Anything else that we skip as nested/array
// gets surfaced by findUntranslatableNestedFields() so it's never silently lost.
const NON_TRANSLATABLE_NESTED_FIELDS = new Set([
  'tags', 'keywords', 'slug', 'aliases', 'url', 'permalink',
  'date', 'lastmod', 'publishdate', 'expirydate', 'draft', 'weight',
  'type', 'layout', 'author', 'authors', 'categories', 'series',
  'image', 'images', 'id', 'sidebar_position', 'pagination_next',
  'pagination_prev', 'hide_table_of_contents', 'toc_min_heading_level',
  'toc_max_heading_level', 'sidebar_custom_props', 'tags_url',
]);

// Regex for YAML front matter delimiters (--- ... ---)
const YAML_FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Regex for TOML front matter delimiters (+++ ... +++)
const TOML_FM_REGEX = /^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?([\s\S]*)$/;

// -----------------------------------------------------------------
// Content file parsing
// -----------------------------------------------------------------

/**
 * Parse a Hugo Markdown content file into structured parts.
 *
 * Hugo supports both YAML (---) and TOML (+++) front matter.
 * We try YAML first (more common), then fall back to TOML.
 *
 * @param {string} raw - Raw file content
 * @returns {object} { frontMatter, rawFrontMatter, body, hasFrontMatter, frontMatterFormat }
 *   - frontMatter: parsed key→value map (simple flat parsing)
 *   - rawFrontMatter: the raw string between delimiters
 *   - body: everything after the front matter
 *   - hasFrontMatter: whether front matter was detected
 *   - frontMatterFormat: 'yaml' | 'toml' | null
 */
function parseContentFile(raw) {
  // Try YAML first (--- ... ---) — most common in Hugo
  const yamlMatch = raw.match(YAML_FM_REGEX);
  if (yamlMatch) {
    return {
      frontMatter: parseSimpleFrontMatter(yamlMatch[1]),
      rawFrontMatter: yamlMatch[1],
      body: yamlMatch[2],
      hasFrontMatter: true,
      frontMatterFormat: 'yaml',
    };
  }

  // Try TOML (+++ ... +++)
  const tomlMatch = raw.match(TOML_FM_REGEX);
  if (tomlMatch) {
    return {
      frontMatter: parseSimpleTomlFrontMatter(tomlMatch[1]),
      rawFrontMatter: tomlMatch[1],
      body: tomlMatch[2],
      hasFrontMatter: true,
      frontMatterFormat: 'toml',
    };
  }

  return { frontMatter: {}, rawFrontMatter: '', body: raw, hasFrontMatter: false, frontMatterFormat: null };
}

/**
 * Parse simple YAML front matter into a key→value map.
 *
 * WHY hand-rolled: Hugo front matter is almost always flat key-value
 * pairs (title, description, date, draft, etc.). We only need to
 * extract the translatable string fields. Complex nested YAML,
 * arrays, and multi-line values are preserved as raw strings so
 * they pass through unchanged.
 *
 * @param {string} yaml - Raw YAML content (between --- delimiters)
 * @returns {object} key→value map
 */
function parseSimpleFrontMatter(yaml) {
  const result = {};

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Simple key: value pairs only (skip arrays, nested objects)
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // Skip keys with empty values — they're YAML map/array parent keys
    // (e.g., "tags:" followed by indented array items)
    if (!value) continue;

    // Skip YAML block scalars (`>`, `|`, `>-`, `|-`, `>+`, indent variants).
    // The value on this line is only the block indicator; the real text lives
    // on the indented lines below (already skipped by the indent check above).
    // Extracting the indicator as a translatable field and re-quoting it on
    // rebuild would orphan those lines and emit invalid YAML — so, per this
    // parser's contract, multi-line values pass through raw and untranslated.
    if (/^[>|][0-9+-]*$/.test(value)) continue;

    // Unquote if quoted
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Find top-level front matter keys that hold array/nested values the flat
 * parser cannot reach — and that are NOT known structural/taxonomy metadata.
 *
 * WHY: parseSimpleFrontMatter() silently skips every indented/array line by
 * design. That's correct for `tags`, `slug`, `date`, etc., but it also means a
 * human-prose container like `related:` (a list of `{title, url}` entries) and
 * other nested fields pass through entirely untranslated with no signal. The
 * never-silent doctrine says: at minimum, tell the user. Callers surface these
 * as a warning so the omission is visible instead of shipping half-translated
 * pages that look complete.
 *
 * Block scalars (`>`, `|`) are intentionally excluded — they're a separate,
 * already-documented skip (extracting the indicator would emit invalid YAML).
 *
 * @param {string} rawFrontMatter - Raw YAML front matter (between --- delimiters)
 * @returns {string[]} Names of skipped, non-allowlisted nested/array fields
 */
function findUntranslatableNestedFields(rawFrontMatter) {
  const found = [];
  if (!rawFrontMatter) return found;

  for (const line of rawFrontMatter.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    // Only consider top-level keys — indented lines are the nested content.
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (NON_TRANSLATABLE_NESTED_FIELDS.has(key)) continue;
    if (/^[>|][0-9+-]*$/.test(value)) continue; // block scalar — separate case

    // Empty value → an indented block/array follows; or an inline array/object.
    if (value === '' || value.startsWith('[') || value.startsWith('{')) {
      found.push(key);
    }
  }

  return found;
}

/**
 * Parse simple TOML front matter into a key→value map.
 *
 * TOML front matter uses `key = "value"` syntax (with = instead of :).
 * Like the YAML parser, we only extract flat key-value pairs and
 * skip complex nested structures.
 *
 * @param {string} toml - Raw TOML content (between +++ delimiters)
 * @returns {object} key→value map
 */
function parseSimpleTomlFrontMatter(toml) {
  const result = {};
  // Track whether we're inside a nested table section.
  // Once we hit a [section] header, all subsequent keys belong to that
  // table and should NOT be treated as top-level front matter keys.
  // There's no way to "exit" a TOML table — a new top-level key after
  // a section is technically invalid TOML, but we handle it gracefully
  // by staying in nested mode until the end of the front matter block.
  let insideNestedTable = false;

  for (const line of toml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Detect TOML section headers ([section]) and array-of-tables ([[section]])
    // WHY we warn: Keys inside nested tables (e.g. [params] description = "...")
    // won't be parsed or translated. The user needs to know this so they don't
    // ship partially-translated content thinking everything was handled.
    if (trimmed.startsWith('[')) {
      insideNestedTable = true;
      const tableName = trimmed.replace(/^\[+|\]+$/g, '').trim();
      console.warn(
        `  [WARN] TOML front matter: nested table [${tableName}] detected — ` +
        `keys inside it will not be translated. Flatten translatable fields to the top level.`
      );
      continue;
    }

    // Skip all keys inside nested tables — they belong to the section,
    // not to the top-level front matter we're interested in.
    if (insideNestedTable) continue;

    // Match key = value pairs
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Skip keys with empty values
    if (!value) continue;

    // Unquote if quoted
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Rebuild front matter YAML with translated fields.
 *
 * Preserves the original formatting for non-translated fields by
 * doing line-by-line replacement rather than full re-serialization.
 * This keeps array fields, comments, and complex YAML intact.
 *
 * @param {string} rawYaml - Original raw YAML front matter
 * @param {object} translations - Map of field name → translated value
 * @returns {string} Updated YAML front matter
 */
function rebuildFrontMatter(rawYaml, translations) {
  const lines = rawYaml.split('\n');
  const result = [];

  for (const line of lines) {
    // Check if this line is a top-level key: value that we have a translation for
    const trimmed = line.trim();
    if (!trimmed.startsWith(' ') && !trimmed.startsWith('\t') && !trimmed.startsWith('#')) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const rawValue = trimmed.slice(colonIdx + 1).trim();
        // Never rewrite a block scalar (`>`, `|`, …): its text spans the
        // indented lines below, so replacing just this line would orphan them
        // and emit invalid YAML. Leave it raw (parseSimpleFrontMatter already
        // skips these, so this is defense-in-depth).
        if (key in translations && !/^[>|][0-9+-]*$/.test(rawValue)) {
          // Replace the value, preserving the key and indentation
          const value = translations[key];
          const needsQuotes = value.includes(':') || value.includes('#') ||
                              value.includes('"') || value.includes("'") ||
                              value.startsWith(' ') || value.endsWith(' ');
          const formatted = needsQuotes
            ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
            : `"${value}"`;
          result.push(`${key}: ${formatted}`);
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Rebuild TOML front matter with translated fields.
 *
 * Same approach as YAML — line-by-line replacement to preserve
 * formatting for non-translated fields.
 *
 * @param {string} rawToml - Original raw TOML front matter
 * @param {object} translations - Map of field name → translated value
 * @returns {string} Updated TOML front matter
 */
function rebuildTomlFrontMatter(rawToml, translations) {
  const lines = rawToml.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip section headers and comments
    if (trimmed.startsWith('[') || trimmed.startsWith('#') || !trimmed) {
      result.push(line);
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (key in translations) {
        const value = translations[key];
        // TOML always uses double quotes for strings
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        result.push(`${key} = "${escaped}"`);
        continue;
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

// -----------------------------------------------------------------
// Block protection — shield non-translatable content
// -----------------------------------------------------------------

/**
 * Protect non-translatable blocks in Markdown body text.
 *
 * Replaces code blocks, Hugo shortcodes, inline code, and raw HTML
 * with unique placeholders. The translation engine sees the
 * placeholders and leaves them intact. After translation, we
 * restore the original blocks.
 *
 * Protection order matters — we process larger/greedier patterns
 * first to prevent inner patterns from matching within outer blocks.
 *
 * @param {string} body - Raw Markdown body
 * @returns {object} { protectedBody, blocks }
 *   - protectedBody: body with placeholders
 *   - blocks: Map of placeholder → original content
 */
function protectBlocks(body) {
  const blocks = new Map();
  let counter = 0;
  let result = body;

  /**
   * Replace matches with numbered placeholders.
   * Each placeholder is unique and maps back to the original.
   */
  function protect(regex) {
    result = result.replace(regex, (match) => {
      const id = `${PLACEHOLDER_PREFIX}${counter++}${PLACEHOLDER_SUFFIX}`;
      blocks.set(id, match);
      return id;
    });
  }

  // 1. Fenced code blocks (```lang\n...\n```)
  //    Must be first — they can contain shortcodes, HTML, etc.
  protect(/```[\s\S]*?```/g);

  // 1b. Tilde-fenced code blocks (~~~lang\n...\n~~~)
  //     The CommonMark/MDX alternative fence. Without this, a ~~~ block's
  //     contents (often code or config that must NOT change) were fed to the
  //     LLM and silently translated/mangled.
  protect(/~~~[\s\S]*?~~~/g);

  // 1c. MDX import/export statements (whole line).
  //     MDX files begin lines with `import …` / `export …` that are JS, not
  //     prose — translating an identifier or a quoted path breaks the build.
  //     Anchored to line start (multiline) so it never matches the word
  //     "import"/"export" mid-sentence.
  protect(/^[ \t]*(?:import|export)\b.*$/gm);

  // 2. Hugo paired shortcodes: {{< name >}}...{{< /name >}} and {{% name %}}...{{% /name %}}
  //    Must come before standalone shortcodes so the entire block
  //    (including inner content like code) is protected as one unit.
  //    Example: {{% highlight go %}}...code...{{% /highlight %}}
  protect(/\{\{[<%]\s*(\w+)[^%>]*[%>]\}\}[\s\S]*?\{\{[<%]\s*\/\1\s*[%>]\}\}/g);

  // 3. Hugo standalone shortcodes: {{< name params >}} and {{% name params %}}
  //    These are unpaired (self-contained on one line).
  protect(/\{\{[<%][^%>]*[%>]\}\}/g);

  // 4. Inline code (`...`)
  protect(/`[^`\n]+`/g);

  // 5. HTML blocks and inline HTML tags
  protect(/<[a-zA-Z\/][^>]*>/g);

  return { protectedBody: result, blocks };
}

/**
 * Restore protected blocks after translation.
 *
 * Restores in reverse order (last captured first) so that
 * nested blocks resolve correctly. When a code block is inside
 * a paired shortcode, the shortcode's stored content contains
 * the code block's placeholder — restoring the shortcode first
 * (reverse order) then the code block ensures full resolution.
 *
 * @param {string} translatedBody - Translated body with placeholders
 * @param {Map} blocks - Map of placeholder → original content
 * @returns {string} Body with original blocks restored
 */
function restoreBlocks(translatedBody, blocks) {
  let restored = translatedBody;
  // Convert to array and reverse so innermost (last captured) blocks
  // are restored first, resolving nested placeholders correctly
  const entries = [...blocks.entries()].reverse();
  for (const [placeholder, original] of entries) {
    // Use split/join instead of replace to avoid regex special char issues
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/**
 * Check if a restored body still contains orphaned placeholder tokens.
 *
 * WHY: The block protection system relies on the LLM preserving
 * ⟦PROTECTED_N⟧ placeholders verbatim during translation. If the
 * model drops, duplicates, or subtly mangles a placeholder (e.g.
 * adds a space, changes 0 to O), restoreBlocks() will leave the
 * broken token in the output. Rather than silently writing corrupted
 * content with orphaned Unicode sentinels or missing code blocks,
 * we detect this and let the caller fall back to the English body
 * with a loud warning.
 *
 * @param {string} text - Body text after restoreBlocks()
 * @returns {boolean} True if orphaned placeholders remain
 */
function hasOrphanedPlaceholders(text) {
  return text.includes(PLACEHOLDER_PREFIX);
}

// -----------------------------------------------------------------
// Content file discovery
// -----------------------------------------------------------------

/**
 * Scan a Hugo content directory for source language Markdown files.
 *
 * Uses Hugo's filename convention: files without a language suffix
 * (e.g., my-post.md) or with the source language suffix
 * (e.g., my-post.en.md) are source files.
 *
 * @param {string} contentDir - Path to the content directory
 * @param {string} sourceLocale - Source language code (e.g., 'en')
 * @returns {string[]} Array of absolute paths to source content files
 */
function discoverContentFiles(contentDir, sourceLocale) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        // Check if this is a source file (no language suffix or source language suffix).
        // Strip the .md/.mdx extension before inspecting the language suffix so
        // foo.fr.mdx is recognized the same way foo.fr.md is.
        const base = entry.name.replace(/\.mdx?$/, '');
        const parts = base.split('.');
        const langSuffix = parts.length > 1 ? parts[parts.length - 1] : null;

        // It's a source file if:
        // 1. No language suffix (e.g., my-post.md)
        // 2. Language suffix matches source locale (e.g., my-post.en.md)
        if (!langSuffix || langSuffix === sourceLocale || !isLikelyLangCode(langSuffix)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(contentDir);
  return files.sort();
}

/**
 * Check if a string looks like a language code (2-3 lowercase letters,
 * optionally with a region suffix like zh-TW).
 *
 * WHY: We need to distinguish "my-post.md" (no lang suffix) from
 * "my-post.fr.md" (French) and "version.2.md" (not a lang code).
 */
function isLikelyLangCode(str) {
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(str);
}

/**
 * Generate the target file path for a translated content file.
 *
 * Follows Hugo's filename convention:
 *   my-post.md       → my-post.fr.md
 *   my-post.en.md    → my-post.fr.md
 *   index.md         → index.fr.md
 *
 * @param {string} sourcePath - Path to the source content file
 * @param {string} targetLang - Target language code
 * @param {string} sourceLocale - Source language code
 * @returns {string} Path to the target content file
 */
function getTargetContentPath(sourcePath, targetLang, sourceLocale) {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath); // .md
  const base = path.basename(sourcePath, ext);

  // Remove source locale suffix if present (my-post.en → my-post)
  const parts = base.split('.');
  const langSuffix = parts.length > 1 ? parts[parts.length - 1] : null;
  const cleanBase = langSuffix === sourceLocale
    ? parts.slice(0, -1).join('.')
    : base;

  return path.join(dir, `${cleanBase}.${targetLang}${ext}`);
}

/**
 * Build the prompt for translating Markdown content.
 *
 * @param {string} protectedBody - Markdown body with protected placeholders
 * @param {object} langConfig - { name, register }
 * @param {object} options - { sourceLanguageName, promptContext } (defaults to 'English', null)
 * @returns {string} Translation prompt
 */
function buildContentPrompt(protectedBody, langConfig, options = {}) {
  const sourceLanguageName = options.sourceLanguageName || 'English';

  // Inject user-provided promptContext between the role line and register.
  // This gives the LLM global context about what it's translating (e.g.,
  // "This is a developer tool README" or "This is medical documentation").
  const contextBlock = options.promptContext
    ? `\nContext: ${options.promptContext}\n`
    : '';

  // Only mention placeholders when the body actually contains them. When the
  // instruction appears without any ⟦PROTECTED_N⟧ in the text, some models
  // (observed: zh) echo the literal token from the rules into their output,
  // which the orphaned-placeholder check then (rightly) rejects — a
  // deterministic false "corruption" failure on placeholder-free documents.
  const placeholderRule = protectedBody.includes(PLACEHOLDER_PREFIX)
    ? '\n- DO NOT translate or modify anything inside ⟦PROTECTED_N⟧ placeholders. Leave them exactly as they appear.'
    : '';

  return `You are translating Markdown content from ${sourceLanguageName} to ${langConfig.name}.
${contextBlock}
Register/tone: ${langConfig.register}

Rules:
- Translate ALL human-readable text in the Markdown.
- Preserve ALL Markdown formatting: headers (#), bold (**), italic (*), links, images, lists, blockquotes, etc.${placeholderRule}
- Preserve all line breaks, paragraph spacing, and document structure.
- Proper nouns, product names, and technical terms should remain in the source language.
- Translate link text but preserve link URLs. For example: [Read more](url) → [Lire la suite](url)
- Return ONLY the translated Markdown. No code fences, no explanation, no preamble.

---
${protectedBody}`;
}

/**
 * Reassemble a complete Hugo content file from translated parts.
 *
 * @param {object} options
 * @param {string} options.rawFrontMatter - Original raw front matter
 * @param {object} options.translatedFields - Map of translated front matter fields
 * @param {string} options.translatedBody - Translated Markdown body
 * @param {boolean} options.hasFrontMatter - Whether the original had front matter
 * @param {string} options.frontMatterFormat - 'yaml' | 'toml' | null
 * @returns {string} Complete content file
 */
function reassembleContentFile({ rawFrontMatter, translatedFields, translatedBody, hasFrontMatter, frontMatterFormat }) {
  // Normalize the body's surrounding whitespace so we can re-apply the canonical
  // Markdown shape. The parse regex consumes the blank line after the closing
  // fence, and the LLM commonly strips the file's trailing newline — the old
  // reassembly preserved neither, so every synced file lost its post-front-matter
  // blank line and its final newline. We restore both here deterministically.
  const body = translatedBody.replace(/^\n+/, '').replace(/\s+$/, '');

  if (!hasFrontMatter) {
    return body.length ? `${body}\n` : '';
  }

  const fence = frontMatterFormat === 'toml' ? '+++' : '---';
  const updatedFrontMatter = frontMatterFormat === 'toml'
    ? rebuildTomlFrontMatter(rawFrontMatter, translatedFields)
    : rebuildFrontMatter(rawFrontMatter, translatedFields);

  // <fence> … <fence>, then a blank line (the Markdown convention Docusaurus and
  // Hugo emit), then the body, then exactly one trailing newline.
  return body.length
    ? `${fence}\n${updatedFrontMatter}\n${fence}\n\n${body}\n`
    : `${fence}\n${updatedFrontMatter}\n${fence}\n`;
}

// -----------------------------------------------------------------
// Docusaurus content discovery
//
// Docusaurus uses a directory-per-locale layout for content:
//   docs/intro.md → i18n/{locale}/docusaurus-plugin-content-docs/current/intro.md
//   blog/my-post.md → i18n/{locale}/docusaurus-plugin-content-blog/my-post.md
//
// Unlike Hugo (which uses filename suffixes like my-post.fr.md),
// Docusaurus mirrors the entire directory tree under each locale.
// The content parsing (front matter, block protection) is the same.
// -----------------------------------------------------------------

/**
 * Discover Docusaurus content files (Markdown and MDX) in a source directory.
 *
 * Walks the directory recursively. Unlike Hugo's discoverContentFiles,
 * there's no filename-based language filtering — all .md/.mdx files
 * in the source directory are source files.
 *
 * @param {string} contentDir - Path to the source content directory (e.g., docs/ or blog/)
 * @returns {string[]} Array of absolute paths to Markdown/MDX files
 */
function discoverDocusaurusContentFiles(contentDir) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories and common non-content dirs
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath);
      }
    }
  }

  walk(contentDir);
  return files.sort();
}

/**
 * Compute the Docusaurus i18n target path for a source content file.
 *
 * Docusaurus layout:
 *   Source: docs/guides/foo.md
 *   Target: i18n/fr/docusaurus-plugin-content-docs/current/guides/foo.md
 *
 *   Source: blog/2026-01-01-hello.md
 *   Target: i18n/fr/docusaurus-plugin-content-blog/2026-01-01-hello.md
 *
 * @param {string} sourcePath - Absolute path to the source content file
 * @param {string} sourceDir - Absolute path to the source directory (e.g., /project/docs)
 * @param {string} targetLocale - Target language code (e.g., 'fr')
 * @param {string} i18nDir - Absolute path to the i18n directory (e.g., /project/i18n)
 * @param {string} pluginName - Docusaurus plugin name (e.g., 'docusaurus-plugin-content-docs')
 * @param {string} [versionDir='current'] - Version directory name (Docusaurus versioned docs)
 * @returns {string} Absolute path to the target content file
 */
function getDocusaurusTargetPath(sourcePath, sourceDir, targetLocale, i18nDir, pluginName, versionDir = 'current') {
  const relPath = path.relative(sourceDir, sourcePath);
  // Docs go under a version directory ('current'), blog does not
  if (pluginName.includes('content-docs')) {
    return path.join(i18nDir, targetLocale, pluginName, versionDir, relPath);
  }
  return path.join(i18nDir, targetLocale, pluginName, relPath);
}

export {
  parseContentFile,
  parseSimpleFrontMatter,
  findUntranslatableNestedFields,
  parseSimpleTomlFrontMatter,
  rebuildFrontMatter,
  rebuildTomlFrontMatter,
  protectBlocks,
  restoreBlocks,
  hasOrphanedPlaceholders,
  discoverContentFiles,
  getTargetContentPath,
  buildContentPrompt,
  reassembleContentFile,
  isLikelyLangCode,
  DEFAULT_TRANSLATABLE_FIELDS,
  NON_TRANSLATABLE_NESTED_FIELDS,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
  discoverDocusaurusContentFiles,
  getDocusaurusTargetPath,
};
