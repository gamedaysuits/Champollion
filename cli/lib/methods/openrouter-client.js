/**
 * OpenRouter API Client — shared HTTP client for all LLM-based methods.
 *
 * Centralizes the OpenRouter chat-completion call pattern that was
 * previously duplicated across llm.js, llm-coached.js, and their
 * translateContent variants. Each call site only needed to differ in:
 *   - prompt text
 *   - temperature
 *   - timeout multiplier
 *   - log label
 *
 * This module provides two functions:
 *   callOpenRouter()      — raw text response (for content translation)
 *   callOpenRouterJSON()  — parsed + validated JSON (for key-value translation)
 */

import {
  MAX_RETRIES, REQUEST_TIMEOUT_MS,
  isRetryable, getBackoffDelay, sleep, stripCodeFences,
} from './http-utils.js';
import { DEFAULT_TEMPERATURE } from '../config.js';
import { output } from '../output.js';
import { recordTranslationError } from './translation-error.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter's chat completion API with retry and backoff.
 *
 * Returns the raw text content from the model, with code fences stripped.
 * Returns null on permanent failure (non-retryable error or exhausted retries).
 *
 * @param {object} options
 * @param {string} options.prompt - The user message content
 * @param {string} options.apiKey - OpenRouter API key
 * @param {string} options.model - Model identifier (e.g. 'openai/gpt-4o-mini')
 * @param {number} [options.temperature=0.3] - Sampling temperature
 * @param {number} [options.timeoutMs] - Override timeout (default: REQUEST_TIMEOUT_MS)
 * @param {string} [options.label='LLM'] - Label for log messages (e.g. 'Batch 3', 'Coached batch 1')
 * @param {string} [options.xTitle='champollion'] - X-Title header value
 * @param {string} [options.systemMessage] - Optional system message for prompt caching.
 *   When provided, the system preamble (register, rules) is sent as a separate
 *   role:system message, enabling provider-level prompt caching across batches
 *   that share the same preamble for a given locale. The prompt parameter then
 *   contains only the batch-specific payload (JSON key-value pairs).
 * @returns {Promise<string|null>} Model response text, or null on failure
 */
async function callOpenRouter({
  prompt,
  apiKey,
  model,
  temperature = DEFAULT_TEMPERATURE,
  timeoutMs = REQUEST_TIMEOUT_MS,
  label = 'LLM',
  xTitle = 'champollion',
  systemMessage = null,
}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Build messages array — when systemMessage is provided, split preamble
      // from payload to enable provider-level prompt caching. The system message
      // (register + rules) is identical across batches for a given locale, so
      // providers like Anthropic and Google cache it automatically.
      const messages = systemMessage
        ? [{ role: 'system', content: systemMessage }, { role: 'user', content: prompt }]
        : [{ role: 'user', content: prompt }];

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/gamedaysuits/Champollion',
          'X-Title': xTitle,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Retryable status (429, 5xx) — back off and try again
      if (isRetryable(response.status)) {
        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ ${label}: ${response.status} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        output.error(`${label}: ${response.status} after ${MAX_RETRIES + 1} attempts`);
        recordTranslationError(response.status);
        return null;
      }

      if (!response.ok) {
        output.error(`${label}: API error ${response.status}`);
        recordTranslationError(response.status);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        // Empty responses are common with some models (especially for long
        // markdown). Retry with backoff — same as HTTP errors — instead of
        // giving up immediately and returning null (which skips the key).
        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ ${label}: empty response — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        output.error(`${label}: empty response after ${MAX_RETRIES + 1} attempts`);
        return null;
      }

      // Strip markdown code fences if the model wraps its response
      return stripCodeFences(content);

    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const errLabel = isTimeout ? 'timeout' : err.message;

      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        output.warn(`⏳ ${label}: ${errLabel} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
        continue;
      }

      output.error(`${label} failed: ${errLabel}`);
      return null;
    }
  }

  return null;
}

/**
 * Call OpenRouter and parse the response as validated JSON key-value pairs.
 *
 * This is the standard pattern for key-value batch translation:
 *   1. Send prompt to model
 *   2. Parse JSON response
 *   3. Validate: only accept keys from expectedKeys set
 *   4. Block prototype-pollution keys
 *
 * @param {object} options - Same as callOpenRouter, plus:
 * @param {Set<string>} options.expectedKeys - Set of keys to accept in the response
 * @param {function} options.isUnsafeKey - Function to check for unsafe key segments
 * @returns {Promise<object|null>} Validated key-value map, or null on failure
 */
async function callOpenRouterJSON({ expectedKeys, isUnsafeKey, ...callOptions }) {
  const content = await callOpenRouter(callOptions);
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    // Models translating quoted text (e.g. `never “not a language.”`) often
    // downgrade typographic quotes to unescaped ASCII quotes inside the JSON
    // string value, which kills the parse. At temperature 0 a blind retry
    // returns byte-identical output, so the cascade can never recover —
    // repair the response instead of rejecting it.
    try {
      parsed = JSON.parse(repairUnescapedQuotes(content));
      output.warn(`${callOptions.label || 'LLM'}: repaired unescaped quotes in model JSON.`);
    } catch {
      // Second recovery tier: the response keys are known exactly (models
      // keep keys as-is per the prompt rules), so values can be extracted
      // by anchoring on the key tokens even when quote damage confuses the
      // in-string heuristic above (e.g. an inner quote directly before a
      // comma: `... "geen taal", zei ...`).
      parsed = extractByExpectedKeys(content, expectedKeys);
      if (parsed) {
        output.warn(`${callOptions.label || 'LLM'}: recovered ${Object.keys(parsed).length} value(s) from malformed model JSON via key anchors.`);
      } else {
        // Return structured error instead of null — the retry cascade needs to
        // distinguish "API returned nothing" (null) from "API returned garbage
        // JSON that we can retry with a smaller batch" (_parseError).
        output.error(`${callOptions.label || 'LLM'}: JSON parse error — ${err.message}`);
        return { _parseError: true, rawContent: content, error: err.message };
      }
    }
  }

  // Validate: only accept keys we sent, block prototype pollution
  const validated = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (expectedKeys.has(key) && typeof value === 'string' && !isUnsafeKey(key)) {
      validated[key] = value;
    }
  }

  return Object.keys(validated).length > 0 ? validated : null;
}

/**
 * Escape unescaped ASCII double quotes inside JSON string values.
 *
 * Walks the text tracking in-string state. Inside a string, a `"` only
 * terminates it when the next non-whitespace character is a JSON structural
 * character (`:`, `,`, `}`, `]`) or end-of-input; any other `"` is an inner
 * quote the model forgot to escape and becomes `\"`.
 *
 * The heuristic can misread an inner quote that directly precedes a comma
 * (e.g. a value containing `"yes",`), in which case the repaired text still
 * fails to parse and the caller falls back to the retry cascade — the repair
 * never makes a previously-parseable response worse because it only runs
 * after JSON.parse has already failed.
 *
 * @param {string} text - Raw model output that failed JSON.parse
 * @returns {string} Text with inner quotes escaped
 */
function repairUnescapedQuotes(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '\\') {
      // Preserve existing escape pairs untouched
      out += ch + (text[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      if (next === undefined || next === ':' || next === ',' || next === '}' || next === ']') {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Extract string values from a malformed JSON response by anchoring on the
 * known key set.
 *
 * The prompt instructs models to keep keys exactly as sent, so every key in
 * the response appears as a literal `"<key>"` token. The value for a key is
 * the text between the quote that opens its value and the last quote before
 * the next key's token (or the end of the response). This survives arbitrary
 * unescaped-quote damage inside values — the failure mode that defeats both
 * JSON.parse and the in-string repair heuristic.
 *
 * Only used as the last recovery tier after JSON.parse and
 * repairUnescapedQuotes have both failed; extracted values still pass
 * through the caller's key validation and the downstream quality gate.
 *
 * @param {string} text - Raw model output that failed to parse
 * @param {Set<string>} expectedKeys - Keys that were sent in the batch
 * @returns {object|null} Recovered key→value map, or null if nothing anchored
 */
function extractByExpectedKeys(text, expectedKeys) {
  if (!expectedKeys || expectedKeys.size === 0) return null;

  const anchors = [];
  for (const key of expectedKeys) {
    const token = JSON.stringify(key);
    const idx = text.indexOf(token);
    if (idx >= 0) anchors.push({ key, idx, token });
  }
  if (anchors.length === 0) return null;
  anchors.sort((a, b) => a.idx - b.idx);

  const result = {};
  for (let i = 0; i < anchors.length; i++) {
    const { key, idx, token } = anchors[i];

    // Walk past `"<key>"` + whitespace + `:` + whitespace + opening `"`
    let p = idx + token.length;
    while (p < text.length && /\s/.test(text[p])) p++;
    if (text[p] !== ':') continue;
    p++;
    while (p < text.length && /\s/.test(text[p])) p++;
    if (text[p] !== '"') continue;

    const valStart = p + 1;
    const endLimit = i + 1 < anchors.length ? anchors[i + 1].idx : text.length;
    const segment = text.slice(valStart, endLimit);
    const lastQuote = segment.lastIndexOf('"');
    if (lastQuote < 0) continue;
    const raw = segment.slice(0, lastQuote);

    // Normalize quotes to escaped form (both already-escaped and bare), keep
    // every other escape sequence for JSON to decode, then parse as a single
    // JSON string. A value that still fails to decode is skipped — the
    // retry cascade handles it. U+0001 is a safe sentinel: raw control
    // characters are invalid inside JSON strings, so it cannot occur in
    // model output that reached us through the API's own JSON layer.
    const SENTINEL = '\u0001';
    const normalized = raw
      .replace(/\\"/g, SENTINEL)
      .replace(/"/g, '\\"')
      .split(SENTINEL).join('\\"');
    try {
      result[key] = JSON.parse(`"${normalized}"`);
    } catch {
      continue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export { callOpenRouter, callOpenRouterJSON, repairUnescapedQuotes, extractByExpectedKeys, OPENROUTER_URL };
