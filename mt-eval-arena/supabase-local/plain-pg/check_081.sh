#!/usr/bin/env bash
# check_081.sh — migrations 080 and 081 (a helper is never known by email; projects hardening) on a throwaway,
# loopback-only PostgreSQL with Supabase stand-ins: applies 079, 080, then 081 twice
# (idempotency), then runs 080_behaviour.sql and 081_behaviour.sql as owner, helper, stranger and
# curator. Same setup as check_079.sh. Nothing touches any address but 127.0.0.1.
set -u
export LC_ALL=C LANG=C
HERE="$(cd "$(dirname "$0")" && pwd)"
M="$HERE/../../supabase/migrations"
PORT="${PORT:-55481}"
DATA="$(mktemp -d)"
initdb -D "$DATA" -U postgres --auth=trust --no-locale -E UTF8 >/dev/null || exit 1
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/pg.log" -w start >/dev/null \
  || { cat "$DATA/pg.log"; exit 1; }
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$HERE/supabase_stubs.sql" || exit 1
"${PSQL[@]}" -f "$M/079_registered_projects.sql" 2>/dev/null || { "${PSQL[@]}" -f "$M/079_registered_projects.sql"; exit 1; }
"${PSQL[@]}" -f "$M/080_project_offers_no_email.sql" 2>/dev/null || { "${PSQL[@]}" -f "$M/080_project_offers_no_email.sql"; exit 1; }
"${PSQL[@]}" -f "$M/081_projects_hardening.sql" 2>/dev/null || { "${PSQL[@]}" -f "$M/081_projects_hardening.sql"; exit 1; }
"${PSQL[@]}" -f "$M/081_projects_hardening.sql" 2>/dev/null || { echo "081 is not idempotent"; exit 1; }
# 080's checks still hold with 081 on top, then 081's own
"${PSQL[@]}" -t -A -f "$HERE/080_behaviour.sql" 2>&1 | grep -v '^$'
[ "${PIPESTATUS[0]}" = 0 ] || exit 1
"${PSQL[@]}" -t -A -f "$HERE/081_behaviour.sql" 2>&1 | grep -v '^$'
exit "${PIPESTATUS[0]}"
