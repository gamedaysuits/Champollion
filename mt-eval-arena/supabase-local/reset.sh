#!/usr/bin/env bash
# Bring the local stack up from NOTHING and apply every migration 001 → 074.
#   supabase start   (docker: postgres, postgrest, gotrue, storage)
#   supabase db reset   (drops + re-creates the db, applies migrations/ in order)
# The first failing migration is reported by name as a FINDING (not swallowed),
# then sanity.sql asserts the tables/functions/buckets/extensions the rehearsal
# depends on. Writes a JSON record next to the log.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-${HERE}/.out}"
mkdir -p "${OUT}"
LOG="${OUT}/db-reset.log"
cd "${HERE}"

command -v supabase >/dev/null || { echo "✗ supabase CLI not on PATH" >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "✗ docker daemon not reachable" >&2; exit 2; }

# FINDING (2026-09-06): the canonical migrations directory is NOT self-contained.
# 001_add_comet_and_ci_columns.sql ALTERs run_cards, but run_cards and the
# datasets table were created by the CLI-era files kept read-only in
# ../supabase/historical/ (their README says "never apply" — meaning to prod,
# where they already ran). A from-nothing build must apply them first, in the
# order prod saw them. So supabase/migrations/ here is GENERATED, not a symlink:
#   20260101000000_001_create_run_cards.sql          (historical)
#   20260528023253_add_missing_columns_and_language_cards.sql
#   20260528024953_drop_language_cards_add_datasets.sql
#   20260601000001_001_add_comet_and_ci_columns.sql   (canonical 001 …)
#   …
# The CLI sorts by the numeric version prefix, so the canonical NNN files get a
# synthetic prefix that sorts after the historical ones while keeping NNN in
# the name. Nothing is edited; every file is a byte-for-byte copy.
GEN=supabase/migrations
rm -rf "${GEN}"; mkdir -p "${GEN}"
cp ../supabase/historical/001_create_run_cards.sql "${GEN}/20260101000000_001_create_run_cards.sql"
cp ../supabase/historical/20260528023253_add_missing_columns_and_language_cards.sql "${GEN}/"
cp ../supabase/historical/20260528024953_drop_language_cards_add_datasets.sql "${GEN}/"
for f in ../supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  n="$(basename "$f")"; num="${n%%_*}"
  cp "$f" "${GEN}/20260601$(printf '%06d' "$((10#$num))")_${n}"
done
echo "==> generated $(ls "${GEN}"/*.sql | wc -l | tr -d ' ') migration files (3 historical + $(ls ../supabase/migrations/[0-9][0-9][0-9]_*.sql | wc -l | tr -d ' ') canonical)"

echo "==> supabase start ($(supabase --version))"
supabase start 2>&1 | tee "${OUT}/start.log"
STATUS="$(supabase status -o env 2>/dev/null)"
echo "${STATUS}" > "${OUT}/status.env"

echo "==> supabase db reset (applies $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migrations: 3 historical + canonical)"
START_TS=$(date +%s)
supabase db reset --debug 2>&1 | tee "${LOG}"
RC=${PIPESTATUS[0]}
END_TS=$(date +%s)

APPLIED="$(grep -oE 'Applying migration [0-9]+_[A-Za-z0-9_.-]+' "${LOG}" | sed 's/Applying migration //' | sort -u | wc -l | tr -d ' ')"
FIRST_FAIL=""
if [ "${RC}" -ne 0 ]; then
  FIRST_FAIL="$(grep -oE 'Applying migration [0-9]+_[A-Za-z0-9_.-]+' "${LOG}" | tail -1 | sed 's/Applying migration //')"
  echo "✗ db reset failed (exit ${RC}); first failing migration: ${FIRST_FAIL:-unknown}" >&2
  grep -iE 'error|ERROR' "${LOG}" | tail -20 >&2
fi

echo "==> sanity.sql"
# `db reset` restarts the containers; `status` can answer "not running" for a
# few seconds afterwards (seen 2026-09-06: an empty status.env → no DB_URL →
# sanity skipped). Re-capture with a bounded retry so a race never masks a
# passing or failing sanity run.
for _try in $(seq 1 30); do
  STATUS="$(supabase status -o env 2>/dev/null)"
  echo "${STATUS}" | grep -q '^DB_URL=' && break
  sleep 2
done
echo "${STATUS}" > "${OUT}/status.env"
DB_URL="$(echo "${STATUS}" | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')"
SANITY_RC=1
# The organizer guest may have no psql of its own (found 2026-09-06: the
# sanity step "ran" and reported only "psql: command not found"). The Postgres
# container always ships one, so fall back to it — over the container's own
# socket, reading sanity.sql from stdin. Either way ON_ERROR_STOP makes the
# first broken assertion the exit code.
DB_CONTAINER="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)"
run_psql() {
  if command -v psql >/dev/null; then
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${HERE}/sanity.sql"
  else
    echo "(no psql on PATH; using ${DB_CONTAINER}'s psql)"
    docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "${HERE}/sanity.sql"
  fi
}
if [ -n "${DB_URL}" ]; then
  run_psql 2>&1 | tee "${OUT}/sanity.log"
  SANITY_RC=${PIPESTATUS[0]}
else
  echo "✗ no DB_URL from supabase status" >&2
fi

python3 - "${OUT}/record.json" <<EOF
import json, sys
json.dump({
  "reset_exit": ${RC}, "migrations_applied_seen": ${APPLIED:-0},
  "first_failing_migration": "${FIRST_FAIL}" or None,
  "seconds": $((END_TS - START_TS)), "sanity_exit": ${SANITY_RC},
}, open(sys.argv[1], "w"), indent=2)
EOF
cat "${OUT}/record.json"
[ "${RC}" -eq 0 ] && [ "${SANITY_RC}" -eq 0 ]
