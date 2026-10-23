#!/usr/bin/env bash
# check_079.sh — migration 079 (registered projects) on a throwaway, loopback-only
# PostgreSQL with Supabase stand-ins (supabase_stubs.sql: the anon /
# authenticated / service_role roles, the storage schema, storage.foldername).
# For when the full local stack (../reset.sh: supabase CLI + Docker) is not
# available. It applies 079 twice (idempotency), then runs 079_behaviour.sql:
# each check acts as the owner, a helper, a stranger, an anonymous visitor or
# the curator, and fails loudly unless the database refuses or allows exactly
# what the design says. Needs PostgreSQL's initdb / pg_ctl / psql on PATH.
# Nothing here touches any network address but 127.0.0.1.
set -u
export LC_ALL=C LANG=C
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../supabase/migrations/079_registered_projects.sql"
PORT="${PORT:-55479}"
DATA="$(mktemp -d)"
initdb -D "$DATA" -U postgres --auth=trust --no-locale -E UTF8 >/dev/null || exit 1
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/pg.log" -w start >/dev/null \
  || { cat "$DATA/pg.log"; exit 1; }
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$HERE/supabase_stubs.sql" || exit 1
"${PSQL[@]}" -f "$MIG" 2>/dev/null || { "${PSQL[@]}" -f "$MIG"; exit 1; }
"${PSQL[@]}" -f "$MIG" 2>/dev/null || { echo "079 is not idempotent"; exit 1; }
"${PSQL[@]}" -t -A -f "$HERE/079_behaviour.sql" 2>&1 | grep -v '^$'
exit "${PIPESTATUS[0]}"
