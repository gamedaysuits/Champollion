/**
 * prompt-methods.js — which methods send the `llm` method's prompt, and so
 * carry a pair's free-text coaching (coachingFile / coachingPrompt).
 *
 * Dependency-free on purpose: the translation-memory key (lib/tm.js
 * tmMethodKey) reads it, and tm.js imports nothing but Node built-ins.
 */

/**
 * The plain LLM methods: one prompt (lib/methods/llm.js promptSettingsFor +
 * buildSystemMessage + buildUserMessage), different transports. Their system
 * message carries the pair's coaching text as a "Coaching guidance:" block.
 */
export const PLAIN_LLM_METHODS = new Set(['llm', 'openai', 'anthropic', 'gemini', 'local']);

/**
 * Every method whose prompt carries the pair's free-text coaching: the plain
 * LLM methods, and llm-coached (which adds its structured coaching).
 */
export const COACHING_PROMPT_METHODS = new Set([...PLAIN_LLM_METHODS, 'llm-coached']);
