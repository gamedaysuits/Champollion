/**
 * Per-user card cache — ~/.champollion/cards/
 *
 * Layout:
 *   <code>.json   — { v, code, updatedAt, fetchedAt, card }
 *   _state.json   — { lastRefreshCheckAt, backoffUntil, missing: { code: ts } }
 *
 * updatedAt mirrors the per-language updated_at from the Supabase
 * trading-card tables; invalidation works by deleting entries whose
 * remote updated_at moved past the cached one (lib/cards/refresh.js)
 * and refetching lazily on next use.
 *
 * `missing` tombstones record codes prod definitively doesn't have, so
 * unknown locale codes don't trigger a network attempt on every CLI
 * run. Tombstones expire with MISSING_TTL_MS and are cleared by the
 * refresh pass when a language appears upstream.
 *
 * All writes are atomic (tmp + rename) and all reads tolerate missing
 * or corrupt files — a broken cache must never break the CLI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, isValidCardCode } from './env.js';

const ENTRY_VERSION = 1;
const STATE_FILE = '_state.json';

/** Failed-fetch backoff — don't hammer the network on every invocation. */
export const BACKOFF_MS = 15 * 60 * 1000;
/** Missing-language tombstone lifetime. */
export const MISSING_TTL_MS = 24 * 60 * 60 * 1000;

function entryPath(code) {
  return path.join(CACHE_DIR, `${code}.json`);
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf-8');
  fs.renameSync(tmp, file);
}

/** Read a cached card entry. Returns { card, updatedAt } or null. */
export function readCachedCard(code) {
  if (!isValidCardCode(code)) return null;
  const entry = readJsonSafe(entryPath(code));
  if (!entry || entry.v !== ENTRY_VERSION || entry.code !== code || !entry.card) return null;
  return { card: entry.card, updatedAt: entry.updatedAt || null };
}

export function writeCachedCard(code, card, updatedAt) {
  if (!isValidCardCode(code)) return false;
  try {
    writeJsonAtomic(entryPath(code), {
      v: ENTRY_VERSION,
      code,
      updatedAt: updatedAt || null,
      fetchedAt: new Date().toISOString(),
      card,
    });
    return true;
  } catch {
    return false; // read-only HOME etc. — cache is best-effort
  }
}

export function removeCachedCard(code) {
  if (!isValidCardCode(code)) return;
  try {
    fs.unlinkSync(entryPath(code));
  } catch {
    // already gone
  }
}

/** Codes currently materialized in the cache (excludes state/tmp files). */
export function listCachedCodes() {
  let entries;
  try {
    entries = fs.readdirSync(CACHE_DIR);
  } catch {
    return [];
  }
  const codes = [];
  for (const name of entries) {
    if (!name.endsWith('.json') || name === STATE_FILE) continue;
    const code = name.slice(0, -5);
    if (isValidCardCode(code)) codes.push(code);
  }
  return codes;
}

// -----------------------------------------------------------------
// Shared state — refresh stamp, network backoff, missing tombstones
// -----------------------------------------------------------------

export function readState() {
  const state = readJsonSafe(path.join(CACHE_DIR, STATE_FILE));
  return state && typeof state === 'object'
    ? state
    : { lastRefreshCheckAt: null, backoffUntil: null, missing: {} };
}

export function writeState(patch) {
  try {
    const next = { ...readState(), ...patch };
    writeJsonAtomic(path.join(CACHE_DIR, STATE_FILE), next);
    return next;
  } catch {
    return null;
  }
}

/** True while a previous network failure says "don't try again yet". */
export function inBackoff(state = readState()) {
  return Boolean(state.backoffUntil && Date.parse(state.backoffUntil) > Date.now());
}

export function noteNetworkFailure() {
  writeState({ backoffUntil: new Date(Date.now() + BACKOFF_MS).toISOString() });
}

export function clearBackoff() {
  writeState({ backoffUntil: null });
}

/** True when `code` was recently confirmed absent from prod. */
export function isTombstoned(code, state = readState()) {
  const ts = state.missing?.[code];
  return Boolean(ts && Date.now() - Date.parse(ts) < MISSING_TTL_MS);
}

export function tombstone(code) {
  if (!isValidCardCode(code)) return;
  const state = readState();
  const missing = { ...(state.missing || {}) };
  missing[code] = new Date().toISOString();
  // Don't let the tombstone map grow without bound.
  const keys = Object.keys(missing);
  if (keys.length > 500) {
    keys.sort((a, b) => Date.parse(missing[a]) - Date.parse(missing[b]));
    for (const key of keys.slice(0, keys.length - 500)) delete missing[key];
  }
  writeState({ missing });
}

export function clearTombstones(codes) {
  const state = readState();
  if (!state.missing) return;
  const missing = { ...state.missing };
  let changed = false;
  for (const code of codes) {
    if (code in missing) {
      delete missing[code];
      changed = true;
    }
  }
  if (changed) writeState({ missing });
}
