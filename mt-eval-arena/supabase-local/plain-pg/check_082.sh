#!/usr/bin/env bash
# check_082.sh — migration 082 (integrity backstops: D17, D18, D24) on a
# throwaway, loopback-only PostgreSQL. The three tables it guards are made as
# stand-ins of their live shapes (070; 076 + 077; 038 + 074 + 075, with 075's
# trigger), then 082 is applied twice (idempotency) and 082_behaviour.sql runs.
# Nothing touches any address but 127.0.0.1.
set -u
export LC_ALL=C LANG=C
HERE="$(cd "$(dirname "$0")" && pwd)"
M="$HERE/../../supabase/migrations"
PORT="${PORT:-55482}"
DATA="$(mktemp -d)"
initdb -D "$DATA" -U postgres --auth=trust --no-locale -E UTF8 >/dev/null || exit 1
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/pg.log" -w start >/dev/null \
  || { cat "$DATA/pg.log"; exit 1; }
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" <<'SQL' || exit 1
CREATE TABLE public.quarantined_id_patterns (
  pattern text PRIMARY KEY, reason text NOT NULL, recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.rankable_metrics (
  metric_id text PRIMARY KEY CHECK (metric_id ~ '^[a-z0-9][a-z0-9_]*$'), display_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('higher', 'lower')), recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz, retired_reason text);
CREATE TABLE public.authorization_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id text UNIQUE NOT NULL,
  sealed_set_id text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'authorized', 'denied', 'expired', 'completed')),
  fingerprint text NOT NULL, method_sha text NOT NULL, corpus_id text NOT NULL, corpus_version text NOT NULL,
  node_measurement text NOT NULL, emit text NOT NULL DEFAULT 'scores-only', threshold text DEFAULT '3 of 5',
  requested_by text, created_at timestamptz DEFAULT now(), decided_at timestamptz, execution_diagnostics jsonb);
SQL
"${PSQL[@]}" -f "$M/082_integrity_backstops.sql" 2>/dev/null || { "${PSQL[@]}" -f "$M/082_integrity_backstops.sql"; exit 1; }
"${PSQL[@]}" -f "$M/082_integrity_backstops.sql" 2>/dev/null || { echo "082 is not idempotent"; exit 1; }
# 075's trigger points at the function 082 replaces
"${PSQL[@]}" -c "CREATE TRIGGER authorization_requests_transition_guard BEFORE UPDATE ON public.authorization_requests
  FOR EACH ROW EXECUTE FUNCTION public.reject_illegal_request_transition();" || exit 1
"${PSQL[@]}" -t -A -f "$HERE/082_behaviour.sql" 2>&1 | grep -v '^$'
exit "${PIPESTATUS[0]}"
