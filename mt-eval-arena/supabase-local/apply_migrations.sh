#!/usr/bin/env bash
# Diagnostic fallback for reset.sh: apply the migrations one file at a time with
# psql, ON_ERROR_STOP=1, per-file timing, stopping at the FIRST error with its
# full text. Use when `supabase db reset` reports a failure and you need to know
# exactly which statement, or with --prereqs to create the extensions/schemas
# that prod has but a fresh local stack may not (vault, pg_net).
#   apply_migrations.sh [--prereqs] [--from NNN] [DB_URL]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREREQS=0; FROM="000"; DB_URL=""
while [ $# -gt 0 ]; do case "$1" in
  --prereqs) PREREQS=1; shift;; --from) FROM="$2"; shift 2;; *) DB_URL="$1"; shift;; esac; done
if [ -z "${DB_URL}" ]; then
  DB_URL="$(cd "${HERE}" && supabase status -o env 2>/dev/null | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')"
fi
[ -n "${DB_URL}" ] || { echo "✗ need DB_URL (arg) or a running local stack" >&2; exit 2; }
case "${DB_URL}" in *127.0.0.1*|*localhost*) ;; *) echo "✗ refusing: DB_URL is not loopback (${DB_URL})" >&2; exit 2;; esac

if [ "${PREREQS}" -eq 1 ]; then
  echo "==> prereqs: extensions/schemas prod has that a fresh stack may not"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pg_net;
create extension if not exists supabase_vault;
SQL
fi

for f in "${HERE}"/supabase/migrations/*.sql; do
  n="$(basename "$f")"; num="${n%%_*}"
  [[ "${num}" < "${FROM}" ]] && continue
  t0=$(date +%s.%N)
  if ! psql "${DB_URL}" -v ON_ERROR_STOP=1 -q -f "$f" 2>"${HERE}/.last-error.txt"; then
    echo "✗ FAILED at ${n} (first error):"; cat "${HERE}/.last-error.txt"; exit 1
  fi
  printf '  ✓ %-60s %6.2fs\n' "${n}" "$(echo "$(date +%s.%N) - ${t0}" | bc)"
done
echo "all migrations applied"
