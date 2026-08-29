/**
 * Loader for the shared method/provider registry SSOT (shared/method-registry.json).
 *
 * Single source of truth, shared with the Python arena harness
 * (arena/mt_eval_harness/method_manifest.py), for which translation METHODS
 * (MT engines) and LLM PROVIDERS exist and their declarative metadata.
 *
 * Mirrors lib/models.js's loader: prefer the package-bundled copy (cli/shared/,
 * shipped in the npm package), fall back to the monorepo-root SSOT for in-repo
 * dev. Returns null if neither is found, so the parity test skips rather than
 * failing in a context without the manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let _cache; // undefined = not loaded, null = not found, object = loaded

/** @returns {object|null} parsed manifest, or null if not found */
export function loadMethodManifest() {
  if (_cache !== undefined) return _cache;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '..', 'shared', 'method-registry.json'),
    path.resolve(__dirname, '..', '..', 'shared', 'method-registry.json'),
  ];
  for (const p of candidates) {
    try {
      _cache = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return _cache;
    } catch { /* try next */ }
  }
  _cache = null;
  return null;
}

/**
 * Return manifest entries, optionally filtered to one kind.
 * @param {string|null} kind
 * @returns {Object<string, object>}
 */
export function manifestEntries(kind = null) {
  const m = loadMethodManifest();
  if (!m || !m.entries) return {};
  const out = {};
  for (const [name, entry] of Object.entries(m.entries)) {
    if (kind === null || entry.kind === kind) out[name] = entry;
  }
  return out;
}

/**
 * The CLI METHOD_REGISTRY key for a manifest entry: the cli_name override if
 * present (e.g. the canonical "openrouter" provider is "llm" in the CLI), else
 * the canonical name.
 */
export function cliNameFor(name, entry) {
  return (entry && entry.cli_name) || name;
}
