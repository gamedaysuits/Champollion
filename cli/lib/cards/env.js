/**
 * Card-loading environment — paths, endpoints, and mode detection.
 *
 * Deliberately tiny with zero heavy imports: bin/cli.js consults this
 * module on every invocation to decide whether the background cache
 * refresh applies, without paying the cost of loading the full card
 * registry (lib/registers.js eager-loads thousands of files in repo
 * checkouts).
 *
 * All values are read once at import. Override via environment for
 * tests and staging:
 *   CHAMPOLLION_CARDS_DIR        — full card directory (repo mode)
 *   CHAMPOLLION_CARDS_FALLBACK   — bundled fallback JSON (packaged mode)
 *   CHAMPOLLION_CARDS_CACHE_DIR  — per-user card cache
 *   CHAMPOLLION_SUPABASE_URL     — REST endpoint base
 *   CHAMPOLLION_SUPABASE_ANON_KEY— read-only publishable key
 *   CHAMPOLLION_OFFLINE=1        — never touch the network
 *   CHAMPOLLION_CARDS_TTL_HOURS  — staleness-check interval (default 24)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Production Supabase project (MT Eval Arena). The publishable anon key
 * is intentionally committed — Row Level Security restricts the anon
 * role to SELECT on the public trading-card tables (see
 * mt-eval-arena/supabase/migrations/012_create_trading_cards.sql).
 * The CLI only ever reads.
 */
export const SUPABASE_URL =
  process.env.CHAMPOLLION_SUPABASE_URL || 'https://sjdomynysdljkbemupqa.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.CHAMPOLLION_SUPABASE_ANON_KEY || 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

/** Full card directory — present in repo checkouts, excluded from the npm tarball. */
export const CARDS_DIR =
  process.env.CHAMPOLLION_CARDS_DIR ||
  path.join(import.meta.dirname, '..', '..', 'shared', 'language-cards');

/** Bundled fallback (core cards + parents + manifest) — ships in the package. */
export const FALLBACK_FILE =
  process.env.CHAMPOLLION_CARDS_FALLBACK ||
  path.join(import.meta.dirname, '..', '..', 'shared', 'cards-fallback.json');

/** Per-user cache of cards fetched from Supabase. */
export const CACHE_DIR =
  process.env.CHAMPOLLION_CARDS_CACHE_DIR ||
  path.join(os.homedir(), '.champollion', 'cards');

export const OFFLINE = process.env.CHAMPOLLION_OFFLINE === '1';

/** How often (hours) the CLI checks Supabase for per-language updated_at bumps. */
export const REFRESH_TTL_HOURS = Number(process.env.CHAMPOLLION_CARDS_TTL_HOURS) > 0
  ? Number(process.env.CHAMPOLLION_CARDS_TTL_HOURS)
  : 24;

/**
 * Repo mode = the full card directory exists on disk (git checkout,
 * monorepo dev). Packaged mode = npm install, where only the fallback
 * bundle ships and the long tail is fetched + cached on demand.
 */
export function hasLocalCardsDir() {
  try {
    return fs.existsSync(CARDS_DIR);
  } catch {
    return false;
  }
}

/**
 * Locale codes flow from user config into cache file paths and REST
 * query params, so gate them hard before any fs/network use.
 * Accepts ISO-ish tags: letters/digits with - or _ separators
 * ('fra', 'fra-CA', 'x-pirate', 'cmn-Hant'), max 5 segments.
 */
const CODE_RE = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+){0,4}$/;

export function isValidCardCode(code) {
  return typeof code === 'string' && code.length >= 2 && code.length <= 48 && CODE_RE.test(code);
}
