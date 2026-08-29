/**
 * Security utilities — filesystem guards and input sanitization.
 *
 * SECURITY SURFACE MAP:
 *
 *   Guard                  │ What it protects               │ Used by
 *   ───────────────────────┼────────────────────────────────┼──────────────────────────
 *   isPathContained()      │ Filesystem path traversal      │ sync.js, content-sync.js,
 *                          │ ("../../../etc/passwd")        │ docusaurus-sync.js
 *   isUnsafeKey()          │ Prototype pollution in JSON    │ translate.js, llm.js,
 *                          │ response parsing (__proto__,   │ llm-coached.js, sync.js,
 *                          │ constructor, prototype)        │ docusaurus-sync.js
 *   validateTranslations() │ Hallucination, wrong-script,   │ validate.js (via
 *                          │ length inflation, source echo  │ translate-pair.js)
 *   sanitizeInput()        │ (planned) Input sanitization   │
 *                          │ for user-provided config values│
 *
 * WHY THIS EXISTS: Locale codes, content paths, and translation keys all
 * come from user config or LLM responses. A crafted code like
 * "../../../etc/passwd" would resolve outside the expected directory, and
 * a key like "__proto__" could trigger prototype pollution. This module
 * centralizes these guards.
 */

import path from 'node:path';

/**
 * Verify that a resolved file path is contained within the expected
 * parent directory. Prevents path traversal via crafted language codes
 * or filenames in the config (e.g., "../../../etc/passwd.json").
 *
 * @param {string} filePath - Resolved absolute path to check
 * @param {string} parentDir - Expected parent directory
 * @returns {boolean} True if filePath is within parentDir
 */
function isPathContained(filePath, parentDir) {
  const resolved = path.resolve(filePath);
  const parent = path.resolve(parentDir);
  return resolved.startsWith(parent + path.sep) || resolved === parent;
}

/**
 * Keys that could trigger prototype pollution if accepted from LLM output.
 * Blocked in response validation as a defense-in-depth measure.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a key path contains any unsafe segments that could cause
 * prototype pollution when used with nested object assignment.
 *
 * @param {string} key - Dot-notation key path (e.g., "a.__proto__.b")
 * @returns {boolean} True if the key contains unsafe segments
 */
function isUnsafeKey(key) {
  return key.split('.').some(segment => UNSAFE_KEYS.has(segment));
}

export { isPathContained, isUnsafeKey };
