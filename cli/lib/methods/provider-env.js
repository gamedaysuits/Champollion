/**
 * Provider environment-variable SSOT.
 *
 * WHY: The translation method *loader* (`_resolveApiKey`), the preflight
 * *readiness* check (`checkReadiness`), the `doctor` command, and the setup
 * *help* text each used to hardcode their own env-var names. They drifted —
 * e.g. the Microsoft loader read only MICROSOFT_TRANSLATOR_API_KEY while
 * `doctor` checked only AZURE_TRANSLATOR_KEY. A user who set
 * AZURE_TRANSLATOR_KEY got a green `doctor` ("✓ ready") but the loader
 * returned null at run time and the sync silently produced nothing.
 *
 * This module is the single source of truth: one canonical name per provider
 * plus the aliases the loader accepts. Every surface resolves keys through
 * here, so `doctor` can never report a key "ready" under a name the loader
 * won't read, and never report "not set" for a name the loader *would* read.
 *
 * The loader reads aliases too (so existing users with either name keep
 * working); the canonical name is what we print in help/setup guidance.
 */

import { getEnvOrFileVar } from '../api-key.js';

/**
 * provider method name → { canonical, aliases, kind }
 *
 * `kind: 'url'` marks an endpoint URL (LibreTranslate) rather than a secret
 * key — callers that only care about secrets can skip those.
 *
 * Keep these in sync with the harness loaders in
 * arena/mt_eval_harness/methods/*.py (which already accept the same aliases
 * via `_env_first(canonical, alias)`).
 */
export const PROVIDER_ENV = {
  'deepl': {
    canonical: 'DEEPL_API_KEY',
    aliases: [],
  },
  'google-translate': {
    canonical: 'GOOGLE_TRANSLATE_API_KEY',
    aliases: ['GOOGLE_API_KEY'],
  },
  'microsoft-translator': {
    canonical: 'MICROSOFT_TRANSLATOR_API_KEY',
    aliases: ['AZURE_TRANSLATOR_KEY'],
  },
  'libretranslate': {
    canonical: 'LIBRETRANSLATE_API_URL',
    aliases: ['LIBRETRANSLATE_URL', 'LIBRE_URL'],
    kind: 'url',
  },
  'tilde': {
    canonical: 'TILDE_API_KEY',
    aliases: [],
  },
  // Lara authenticates with a key PAIR; the adapter's readiness probe checks
  // the secret (LARA_ACCESS_KEY_SECRET) alongside this canonical id.
  'translated': {
    canonical: 'LARA_ACCESS_KEY_ID',
    aliases: [],
  },
};

/**
 * Ordered list of env var names for a provider: [canonical, ...aliases].
 * Empty array for an unknown provider.
 *
 * @param {string} method - Provider method name (e.g. 'google-translate')
 * @returns {string[]}
 */
export function providerEnvNames(method) {
  const entry = PROVIDER_ENV[method];
  return entry ? [entry.canonical, ...entry.aliases] : [];
}

/**
 * The canonical env var name for a provider (what help/setup text should show).
 *
 * @param {string} method - Provider method name
 * @returns {string|null}
 */
export function canonicalEnvName(method) {
  return PROVIDER_ENV[method]?.canonical ?? null;
}

/**
 * Resolve a provider's key by checking the canonical name then each alias,
 * across process.env AND .env.local/.env (via getEnvOrFileVar) — exactly the
 * surface the method loaders read. This is what readiness/doctor should use
 * so they agree with the loader.
 *
 * @param {string} method - Provider method name
 * @param {string} [cwd] - Project root for .env file lookup
 * @returns {{ value: string|null, name: string|null }}
 *   value: the resolved key/url, or null. name: the env var it came from.
 */
export function resolveProviderEnv(method, cwd) {
  for (const name of providerEnvNames(method)) {
    const value = getEnvOrFileVar(name, cwd);
    if (value) return { value, name };
  }
  return { value: null, name: null };
}

/**
 * Human-readable "NAME (or ALIAS)" string for messages.
 *
 * @param {string} method - Provider method name
 * @returns {string}
 */
export function envNamesLabel(method) {
  const names = providerEnvNames(method);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names[0]} (or ${names.slice(1).join(', ')})`;
}
