/**
 * segment.js — Markdown block segmentation for translation.
 *
 * WHY THIS EXISTS: The Docusaurus content path used to translate every
 * page as ONE whole-body API call. A one-paragraph edit re-billed the
 * entire page for every locale. Splitting the body into top-level blocks
 * lets the Translation Memory serve every unchanged block for free and
 * bill only the blocks that actually changed.
 *
 * CONTRACT — whitespace-exact reassembly:
 *   joinBlocks(splitBlocks(x)) === x   for EVERY input string.
 *
 * The splitter operates on the OUTPUT of protectBlocks() (content.js):
 * fenced code blocks, MDX import/export lines, inline code, and HTML tags
 * arrive already collapsed to ⟦PROTECTED_N⟧ placeholders (single tokens,
 * no newlines), so splitting at blank-line boundaries can never cut a
 * protected region in half. Splitting raw markdown also round-trips
 * (the contract holds for any string) — it is only the *translation
 * safety* of the blocks that depends on prior protection.
 *
 * Segment kinds:
 *   - 'separator':    a run of blank lines between blocks. Never sent
 *                     anywhere; reattached verbatim on reassembly.
 *   - 'passthrough':  a block with no translatable text (pure placeholder
 *                     lines, whitespace, MDX import/export statements,
 *                     '---' thematic breaks, table rules). Never billed;
 *                     copied verbatim.
 *   - 'translatable': everything else — the units the TM caches and the
 *                     API translates.
 */

import { PLACEHOLDER_PREFIX } from './content.js';

// Block separator: a newline followed by one or more blank lines
// (whitespace-only lines count as blank — CommonMark treats them as
// paragraph breaks). The capturing group makes String.split() KEEP the
// separators, which is what makes reassembly whitespace-exact.
const BLOCK_SEPARATOR_REGEX = /(\r?\n(?:[ \t]*\r?\n)+)/;

// A complete protected-block placeholder token (see content.js).
const PLACEHOLDER_TOKEN_REGEX = /⟦PROTECTED_\d+⟧/g;

// MDX import/export statement lines. protectBlocks() already collapses
// these to placeholders; this is defense-in-depth for callers that
// segment unprotected text — JS statements must never be classified
// translatable.
const IMPORT_EXPORT_LINE_REGEX = /^[ \t]*(?:import|export)\b.*$/gm;

// Segment markers for the block-batch prompt. Same Unicode-bracket family
// as ⟦PROTECTED_N⟧ (extremely unlikely in real content), but a DISTINCT
// prefix so the orphaned-placeholder check and the segment parser can
// never confuse the two.
const SEGMENT_MARKER_PREFIX = '⟦SEG_';
const SEGMENT_MARKER_SUFFIX = '⟧';

/**
 * Does a block contain any text worth billing an API call for?
 *
 * A block is translatable when, after removing protected-block
 * placeholders and import/export statement lines, at least one letter or
 * digit remains. This classifies as passthrough: whitespace, pure
 * placeholder lines, '---'/'***'/'___' thematic breaks, table alignment
 * rules (| --- | --- |), and bare ':::' admonition fences — while keeping
 * anything with prose (including ':::tip Title' lines) translatable.
 * Conservative by design: when in doubt, translate — a false
 * "translatable" costs a few tokens; a false "passthrough" ships
 * untranslated prose.
 *
 * @param {string} text - Block text (protected or raw)
 * @returns {boolean} True if the block has translatable content
 */
function hasTranslatableText(text) {
  const stripped = text
    .replace(PLACEHOLDER_TOKEN_REGEX, '')
    .replace(IMPORT_EXPORT_LINE_REGEX, '');
  return /[\p{L}\p{N}]/u.test(stripped);
}

/**
 * Split a (placeholder-protected) markdown body into ordered segments at
 * top-level block boundaries.
 *
 * @param {string} protectedBody - Markdown body, ideally the output of
 *   protectBlocks() so fenced blocks are single placeholder tokens.
 * @returns {Array<{text: string, type: 'separator'|'passthrough'|'translatable'}>}
 *   Ordered segments. joinBlocks() of the result reproduces the input
 *   byte-for-byte.
 */
// A run of blank/whitespace-only lines at the START of a content piece
// (e.g. the single newline parseContentFile leaves before the first block).
const LEADING_NEWLINE_RUN = /^(?:[ \t]*\r?\n)+/;
// A trailing newline run at the END of a content piece (e.g. the file's
// final newline attached to the last block).
const TRAILING_NEWLINE_RUN = /(?:\r?\n[ \t]*)+$/;

function splitBlocks(protectedBody) {
  // split() with a capturing group alternates [content, sep, content, …].
  // Leading/trailing separators produce empty content strings — dropped,
  // since '' contributes nothing to the join.
  const parts = protectedBody.split(BLOCK_SEPARATOR_REGEX);
  const segments = [];

  for (let i = 0; i < parts.length; i++) {
    let text = parts[i];
    if (text === '') continue;
    const isSeparator = i % 2 === 1;
    if (isSeparator) {
      segments.push({ text, type: 'separator' });
      continue;
    }

    // Peel single-newline runs off the block's edges into separator
    // segments (only string-edge pieces can carry them — inter-block runs
    // are consumed by the separator regex). Without this, the parsed
    // body's leading '\n' and the file's final '\n' would pollute the
    // first/last block's TM key and API payload.
    const lead = text.match(LEADING_NEWLINE_RUN);
    if (lead) {
      segments.push({ text: lead[0], type: 'separator' });
      text = text.slice(lead[0].length);
    }
    let trail = null;
    const trailMatch = text.match(TRAILING_NEWLINE_RUN);
    if (trailMatch) {
      trail = trailMatch[0];
      text = text.slice(0, -trail.length);
    }
    if (text !== '') {
      segments.push({
        text,
        type: hasTranslatableText(text) ? 'translatable' : 'passthrough',
      });
    }
    if (trail !== null) {
      segments.push({ text: trail, type: 'separator' });
    }
  }

  return segments;
}

/**
 * Reassemble segments into the original string.
 *
 * @param {Array<{text: string}>} segments - Segments from splitBlocks()
 * @returns {string} Concatenation of every segment's text, in order
 */
function joinBlocks(segments) {
  let out = '';
  for (const seg of segments) out += seg.text;
  return out;
}

/**
 * Build ONE prompt that translates a batch of markdown blocks.
 *
 * Same protected-placeholder discipline as buildContentPrompt()
 * (content.js): the placeholder rule is only stated when a block actually
 * contains ⟦PROTECTED_N⟧ tokens, because some models echo the literal
 * token from the rules into placeholder-free output.
 *
 * @param {string[]} blockTexts - Protected block texts to translate, in order
 * @param {object} langConfig - { name, register }
 * @param {object} options - { sourceLanguageName, promptContext, pageTitle }
 *   pageTitle is the page's H1/front-matter title, given as terminology
 *   context so isolated blocks translate consistently with the page topic.
 * @returns {string} Complete translation prompt
 */
function buildBlockBatchPrompt(blockTexts, langConfig, options = {}) {
  const sourceLanguageName = options.sourceLanguageName || 'English';

  const contextBlock = options.promptContext
    ? `\nContext: ${options.promptContext}\n`
    : '';

  const titleBlock = options.pageTitle
    ? `\nThese segments come from a page titled "${options.pageTitle}" — use it as terminology context.\n`
    : '';

  const placeholderRule = blockTexts.some(t => t.includes(PLACEHOLDER_PREFIX))
    ? '\n- DO NOT translate or modify anything inside ⟦PROTECTED_N⟧ placeholders. Leave them exactly as they appear.'
    : '';

  const numbered = blockTexts
    .map((text, i) => `${SEGMENT_MARKER_PREFIX}${i}${SEGMENT_MARKER_SUFFIX}\n${text}`)
    .join('\n\n');

  return `You are translating Markdown content from ${sourceLanguageName} to ${langConfig.name}. The document was split into ${blockTexts.length} numbered segment(s); segments not shown are already translated.
${contextBlock}${titleBlock}
Register/tone: ${langConfig.register}

Rules:
- Translate ALL human-readable text in every segment.
- Preserve ALL Markdown formatting: headers (#), bold (**), italic (*), links, images, lists, blockquotes, tables, admonitions (:::), etc.${placeholderRule}
- Preserve line breaks and structure WITHIN each segment.
- Proper nouns, product names, and technical terms should remain in the source language.
- Translate link text but preserve link URLs. For example: [Read more](url) → [Lire la suite](url)
- Echo each ${SEGMENT_MARKER_PREFIX}N${SEGMENT_MARKER_SUFFIX} marker on its own line, EXACTLY as given, before its translated segment.
- Do NOT merge, drop, reorder, renumber, or add segments.
- Return ONLY the markers and the translated segments. No code fences, no explanation, no preamble.

${numbered}`;
}

// Parser for the model's response: captures the segment id so each piece
// can be matched back positionally AND validated.
const SEGMENT_SPLIT_REGEX = /⟦SEG_(\d+)⟧/g;

/**
 * Parse the model's response to a block-batch prompt.
 *
 * FAIL-LOUD by default: any structural violation (missing segment, duplicate
 * marker, unknown id, wrong count) throws — the caller fails the whole file
 * and nothing partial is written or cached. This is the block-level analogue
 * of the orphaned-placeholder check.
 *
 * LENIENT mode (`opts.lenient`) relaxes ONLY the missing-segment case: the
 * caller gets back what did arrive plus the list of missing indexes, so it
 * can retry just those (translateBlockBatchResilient below). Duplicate and
 * unknown markers still throw in lenient mode — they mean the mapping itself
 * cannot be trusted, and no partial result is safe to keep.
 *
 * @param {string} response - Raw model output
 * @param {number} expectedCount - Number of blocks that were sent
 * @param {{lenient?: boolean}} [opts]
 * @returns {string[]|{blocks: string[], missing: number[]}} Strict mode:
 *   translated block texts, index-aligned with the input. Lenient mode:
 *   `blocks` (sparse where missing) + `missing` (ascending indexes).
 * @throws {Error} On any structural violation (strict), or on duplicate/
 *   unknown markers (lenient)
 */
function parseBlockBatchResponse(response, expectedCount, opts = {}) {
  const parts = String(response).split(SEGMENT_SPLIT_REGEX);
  // parts[0] is preamble before the first marker — models occasionally
  // emit one despite instructions; it carries no segment and is dropped.
  const seen = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const id = parseInt(parts[i], 10);
    if (id >= expectedCount) {
      throw new Error(
        `block-batch response contains unknown segment marker ⟦SEG_${id}⟧ (sent ${expectedCount} segment(s))`
      );
    }
    if (seen.has(id)) {
      throw new Error(`block-batch response repeats segment marker ⟦SEG_${id}⟧`);
    }
    // Strip the newline that follows the marker line and trailing
    // blank-line padding — inter-block separators are reattached from the
    // SOURCE, never taken from the model. Leading indentation of the
    // first content line is preserved.
    const text = (parts[i + 1] ?? '').replace(/^\r?\n/, '').replace(/[\r\n]+[\s]*$/, '');
    seen.set(id, text);
  }

  if (seen.size !== expectedCount) {
    const missing = [];
    for (let i = 0; i < expectedCount; i++) {
      if (!seen.has(i)) missing.push(i);
    }
    if (!opts.lenient) {
      throw new Error(
        `block-batch response returned ${seen.size}/${expectedCount} segment(s) — missing marker(s): ` +
        missing.map(i => `⟦SEG_${i}⟧`).join(', ')
      );
    }
    const blocks = new Array(expectedCount);
    for (const [id, text] of seen) blocks[id] = text;
    return { blocks, missing };
  }

  const out = new Array(expectedCount);
  for (const [id, text] of seen) out[id] = text;
  return opts.lenient ? { blocks: out, missing: [] } : out;
}

/**
 * Block-batch translation with a bounded self-repair ladder.
 *
 * Born from a real gate-brick (2026-07-11): one locale's response dropped a
 * single ⟦SEG_N⟧ marker, deterministically, which hard-failed the whole file
 * — so the content lock never advanced and EVERY subsequent sync re-billed
 * every locale of that file. The ladder:
 *
 *   1. Send the full batch. Missing marker(s)? →
 *   2. ONE retry with only the missing segments (a fresh, smaller batch —
 *      different neighbors, usually enough). Still missing? →
 *   3. Honest fallback: `fallbackPrefix + source` for just those segments
 *      (the established '[EN] ' doctrine — visible, never silent).
 *
 * The CALLER's contract for fallen-back segments: never store them in the
 * TM (an error cached is an error forever) and never advance the file's
 * lock entry — so the file re-fires next sync, where every good block is a
 * TM hit and only the failed segment re-bills. Self-healing, bounded cost.
 *
 * @param {object} p
 * @param {string[]} p.texts - Protected block texts to translate
 * @param {(texts: string[]) => string} p.buildPrompt - Batch prompt builder
 * @param {(prompt: string) => Promise<string|null>} p.callModel - One API call
 * @param {string} p.fallbackPrefix - e.g. '[EN] ' — prepended to source text
 * @returns {Promise<{blocks: string[], fellBack: number[]}>} index-aligned
 *   translations; `fellBack` lists indexes that carry the fallback
 * @throws {Error} If the FIRST call returns nothing at all, or on
 *   duplicate/unknown markers (untrustworthy mapping)
 */
async function translateBlockBatchResilient({ texts, buildPrompt, callModel, fallbackPrefix }) {
  const first = await callModel(buildPrompt(texts));
  if (!first) {
    throw new Error('block-batch translation returned no results');
  }
  const { blocks, missing } = parseBlockBatchResponse(first, texts.length, { lenient: true });

  let stillMissing = missing;
  if (stillMissing.length > 0) {
    const retryTexts = stillMissing.map(i => texts[i]);
    const second = await callModel(buildPrompt(retryTexts));
    if (second) {
      // Duplicate/unknown markers in the RETRY are treated like a miss for
      // the retried segments, not a hard fail — the first response's good
      // segments are already safely mapped.
      try {
        const parsed = parseBlockBatchResponse(second, retryTexts.length, { lenient: true });
        stillMissing.forEach((origIdx, j) => {
          if (parsed.blocks[j] !== undefined) blocks[origIdx] = parsed.blocks[j];
        });
      } catch { /* retry response corrupt — fall through to fallback */ }
    }
    stillMissing = [];
    for (let i = 0; i < texts.length; i++) {
      if (blocks[i] === undefined) stillMissing.push(i);
    }
  }

  for (const i of stillMissing) {
    blocks[i] = fallbackPrefix + texts[i];
  }
  return { blocks, fellBack: stillMissing };
}

/**
 * Content segmentation modes for body translation — shared by the
 * Docusaurus (docusaurus-sync.js) and Hugo/generic (content-sync.js) paths.
 *   'block' (default): split the body into top-level blocks, serve
 *     unchanged blocks from the TM, and translate only the misses in one
 *     batched API call per file per locale.
 *   'page': single-prompt whole-body behavior (still TM-threaded at the
 *     whole-body level).
 */
const CONTENT_SEGMENTATION_MODES = new Set(['block', 'page']);

function assertSegmentationMode(value, where) {
  if (value != null && !CONTENT_SEGMENTATION_MODES.has(value)) {
    throw new Error(
      `Invalid contentSegmentation "${value}" in ${where} — expected "block" or "page".`
    );
  }
}

export {
  splitBlocks,
  joinBlocks,
  hasTranslatableText,
  buildBlockBatchPrompt,
  parseBlockBatchResponse,
  translateBlockBatchResilient,
  assertSegmentationMode,
  CONTENT_SEGMENTATION_MODES,
  SEGMENT_MARKER_PREFIX,
  SEGMENT_MARKER_SUFFIX,
};
