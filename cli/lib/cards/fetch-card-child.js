/**
 * One-shot card fetcher — child-process entry point.
 *
 * The public registry API (getLanguageCard et al.) is synchronous, but
 * Node has no synchronous HTTP. When the packaged CLI misses on a code
 * that the manifest says exists, lib/registers.js runs this script via
 * execFileSync and parses the single JSON object it prints:
 *
 *   node fetch-card-child.js <code> [aliasesJson]
 *
 *   stdout: { ok: true, card, updatedAt }     — fetched
 *           { ok: true, missing: true }       — not in prod (tombstone it)
 *           { ok: false, error }              — network/server failure
 *
 * The parent owns all cache writes and backoff bookkeeping; this
 * process only talks to Supabase (read-only) and prints.
 */

import { fetchRemoteCard } from './remote.js';

const code = process.argv[2];
let aliases;
try {
  aliases = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
} catch {
  aliases = undefined;
}

try {
  const result = await fetchRemoteCard(code, { aliases });
  if (result.missing) {
    process.stdout.write(JSON.stringify({ ok: true, missing: true }));
  } else {
    process.stdout.write(JSON.stringify({ ok: true, card: result.card, updatedAt: result.updatedAt }));
  }
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: err?.message || String(err) }));
}
