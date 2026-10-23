#!/usr/bin/env bash
# check_083.sh — migration 083 (D23: no late phase windows) on a throwaway,
# loopback-only PostgreSQL. The tables its guard reads are stand-ins of their
# live shapes (008's contests, 074's contest_phases + contest_submissions +
# contest_sealed_set_ids, 038's authorization_requests); 074's guard and trigger
# are put in place, then 083 is applied twice (idempotency) and
# 083_behaviour.sql runs. Nothing touches any address but 127.0.0.1.
set -u
export LC_ALL=C LANG=C
HERE="$(cd "$(dirname "$0")" && pwd)"
M="$HERE/../../supabase/migrations"
PORT="${PORT:-55483}"
DATA="$(mktemp -d)"
initdb -D "$DATA" -U postgres --auth=trust --no-locale -E UTF8 >/dev/null || exit 1
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/pg.log" -w start >/dev/null \
  || { cat "$DATA/pg.log"; exit 1; }
trap 'pg_ctl -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" <<'SQL' || exit 1
CREATE TABLE public.contests (id text PRIMARY KEY, corpus_id text, metadata jsonb DEFAULT '{}');
CREATE TABLE public.contest_phases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('practice', 'evaluation', 'post-evaluation')),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  max_submissions int, max_submissions_per_day int,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_phases_window_ordered CHECK (ends_at > starts_at),
  CONSTRAINT contest_phases_one_per_name UNIQUE (contest_id, name));
CREATE TABLE public.contest_submissions (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, contest_id text NOT NULL);
CREATE TABLE public.authorization_requests (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, sealed_set_id text NOT NULL);
CREATE OR REPLACE FUNCTION public.contest_sealed_set_ids(p_contest_id text) RETURNS text[]
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ARRAY(SELECT DISTINCT s FROM (
    SELECT c.corpus_id AS s FROM public.contests c WHERE c.id = p_contest_id
    UNION ALL
    SELECT c.metadata ->> 'sealed_holdout_set_id' FROM public.contests c WHERE c.id = p_contest_id) t
  WHERE s IS NOT NULL);
$$;
-- 074's guard function body is replaced by 083; its trigger stays as 074 made it
CREATE OR REPLACE FUNCTION public.contest_phase_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER contest_phases_guard BEFORE INSERT OR UPDATE OR DELETE ON public.contest_phases
  FOR EACH ROW EXECUTE FUNCTION public.contest_phase_guard();
SQL
"${PSQL[@]}" -f "$M/083_contest_phases_no_late_windows.sql" 2>/dev/null || { "${PSQL[@]}" -f "$M/083_contest_phases_no_late_windows.sql"; exit 1; }
"${PSQL[@]}" -f "$M/083_contest_phases_no_late_windows.sql" 2>/dev/null || { echo "083 is not idempotent"; exit 1; }
"${PSQL[@]}" -t -A -f "$HERE/083_behaviour.sql" 2>&1 | grep -v '^$'
exit "${PIPESTATUS[0]}"
