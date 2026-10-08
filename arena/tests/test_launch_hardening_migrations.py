"""Tests for the 2026-07-18 launch-hardening migrations 052-055 + the H2/M2
edge-function changes that ship with them.

Audit findings closed here (docs/LAUNCH_READINESS_AUDIT_2026-07-18.md §1):

  M1 (052) — contests / contest_submissions INSERT policies now bind
       created_by / submitted_by to the JWT email (the 043/045/046 pattern),
       check the target contest's status + visibility, and both tables get
       birth throttles + server-stamped timestamps.
  M3 (053) — the use_context (commercial vs NC) eligibility rule gets its DB
       trigger; is_license_commercial_safe() must stay token-for-token in
       parity with license_use.is_commercial_safe() (itself the mirror of
       cli/lib/license-gate.mjs isPermissiveSpdx).
  L1 (054) — the prod-only rls_auto_enable() event trigger is committed
       verbatim so rebuilds keep the safety net.
  M2 (055 + regenerate-queue) — shared-secret authorization + debounce for
       the queue refresh; the Vault-fed pg_net trigger path keeps working.
  H2 (submit-run) — the per-IP rate-limit key is never the client-spoofable
       leftmost X-Forwarded-For hop.

All offline: these freeze SQL/TS/Python mirrors against silent drift.
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "mt-eval-arena" / "supabase" / "migrations"
FUNCTIONS = ROOT / "mt-eval-arena" / "supabase" / "functions"
LICENSE_USE = ROOT / "arena" / "mt_eval_harness" / "license_use.py"


def _read(path: Path) -> str:
    assert path.exists(), f"missing file: {path}"
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# 052 — contest identity binding (M1)
# ---------------------------------------------------------------------------

class TestContestIdentityBinding:
    SQL = MIGRATIONS / "052_contest_identity_binding.sql"

    def test_old_unbound_policies_are_dropped(self):
        sql = _read(self.SQL)
        assert 'DROP POLICY IF EXISTS "Authenticated create contests"' in sql
        assert 'DROP POLICY IF EXISTS "Authenticated submit"' in sql

    def test_insert_policies_bind_the_jwt_email_with_initplan_discipline(self):
        sql = _read(self.SQL)
        # The 031 initplan idiom: current_setting wrapped in a scalar SELECT.
        binder = re.compile(
            r"\(\(SELECT current_setting\('request\.jwt\.claims', true\)\)::json"
            r" ->> 'email'\)"
        )
        assert len(binder.findall(sql)) >= 3, (
            "created_by / submitted_by / team-creator checks must all use the "
            "initplan-wrapped email claim"
        )
        assert "created_by = ((SELECT current_setting" in sql
        assert "submitted_by = ((SELECT current_setting" in sql
        for policy in ("contests_create_own", "contest_submissions_submit_own"):
            assert policy in sql
        assert sql.count("TO authenticated") >= 2

    def test_submissions_policy_checks_the_target_contest(self):
        sql = _read(self.SQL)
        assert "c.status = 'open'" in sql
        assert "c.visibility IN ('public', 'private')" in sql
        # Team contests: fail-closed to the creator until team membership is
        # a JWT claim.
        assert "c.visibility = 'team'" in sql

    def test_admission_triggers_stamp_time_and_throttle(self):
        sql = _read(self.SQL)
        for trig, table in (
            ("contests_admission_guard", "contests"),
            ("contest_submissions_admission_guard", "contest_submissions"),
        ):
            assert re.search(
                rf"CREATE TRIGGER {trig}\s+BEFORE INSERT ON public\.{table}",
                sql,
            ), f"{trig} must be BEFORE INSERT on {table}"
        # Server-stamped timestamps (throttle-window integrity).
        assert "NEW.created_at := now();" in sql
        assert "NEW.submitted_at := now();" in sql
        # The 046-style documented constant.
        assert sql.count("v_limit CONSTANT int := 24") == 2
        assert "INTERVAL '24 hours'" in sql

    def test_contests_are_born_open(self):
        assert "NEW.status <> 'open'" in _read(self.SQL)

    def test_client_binds_email_everywhere(self):
        """The Python client half of M1: no display-name identities remain on
        the contest write paths, and the old opt-in flag is gone."""
        contest_py = _read(ROOT / "arena" / "mt_eval_harness" / "contest.py")
        assert "get_submitter_name" not in contest_py, (
            "contest.py write paths must stamp the JWT email only"
        )
        assert "bind_owner_email" not in contest_py
        assert contest_py.count("get_submitter_email") >= 2


# ---------------------------------------------------------------------------
# 053 — use_context guard (M3): SQL twin of license_use.is_commercial_safe
# ---------------------------------------------------------------------------

# The frozen token lists. license_use.is_commercial_safe carries these as
# inline literals (mirroring license-gate.mjs isPermissiveSpdx), so the
# parity freeze pins BOTH files against this one copy.
NEGATIVE_MARKERS = ("-NC", "-SA", "-ND")
RESTRICTED_TOKENS = (
    "UNCONFIRMED", "UNSTATED", "NO-PUBLIC", "MIXED", "SIL-TERMS",
    "PROPRIETARY", "RESTRICTED",
)
PERMISSIVE_PREFIXES = (
    "CC-BY", "CC0", "APACHE", "UNICODE", "BSD", "MIT",
    "PUBLIC DOMAIN", "PUBLICDOMAIN", "PD-",
)
LICENSEREF_PREFIXES = (
    "LICENSEREF-CHAMPOLLION-OWN", "LICENSEREF-PUBLICDOMAIN",
    "LICENSEREF-FACTUALDATA", "LICENSEREF-IANA",
)


class TestUseContextGuardParity:
    SQL = MIGRATIONS / "053_contest_use_context_guard.sql"

    def test_every_token_in_both_mirrors(self):
        sql = _read(self.SQL)
        py = _read(LICENSE_USE)
        for tok in (
            NEGATIVE_MARKERS + RESTRICTED_TOKENS + PERMISSIVE_PREFIXES
            + LICENSEREF_PREFIXES
        ):
            assert f"'{tok}'" in sql, f"migration 053 lost token {tok!r}"
            assert (f'"{tok}"' in py) or (f"'{tok}'" in py) or (
                # Python packs the restricted tokens into one regex literal.
                tok in py
            ), f"license_use.py lost token {tok!r}"

    def test_gpl_and_bare_cc_rules(self):
        sql = _read(self.SQL)
        assert "'GPL'" in sql
        assert "s = 'CC'" in sql, "bare 'CC' (unspecified version) must refuse"

    def test_sa_refusal_runs_before_the_ccby_prefix_test(self):
        """Order is load-bearing: CC-BY-SA starts with CC-BY, so the -SA
        refusal must be evaluated first (as in Python)."""
        sql = _read(self.SQL)
        assert sql.index("'-SA'") < sql.index("'CC-BY'")

    def test_prefixes_use_startswith_semantics(self):
        # Python startswith → SQL strpos(...) = 1, never a substring test.
        assert "strpos(s, pref) = 1" in _read(self.SQL)

    def test_trigger_shape_and_lanes(self):
        sql = _read(self.SQL)
        assert re.search(
            r"CREATE TRIGGER contests_use_context_guard\s+"
            r"BEFORE INSERT OR UPDATE ON public\.contests",
            sql,
        )
        # The sealed lane and the non-commercial lane pass through.
        assert "NEW.lane = 'sealed' OR NEW.use_context <> 'commercial'" in sql
        # Unregistered corpus in the commercial lane → fail-safe refusal.
        assert "not a registered dataset" in sql

    def test_041_is_not_weakened(self):
        sql = _read(self.SQL)
        assert "CREATE OR REPLACE FUNCTION public.contest_corpus_guard" not in sql
        assert "DROP TRIGGER IF EXISTS contests_corpus_guard" not in sql

    def test_guard_function_actually_raises(self):
        """Test-suite audit 2026-08-19 S4: token parity was pinned but nothing
        asserted the guard RAISES — neutering both RAISE EXCEPTION branches
        (turning the guard into a pass-everything no-op) failed zero tests.
        Mirrors test_quarantine_guard_migration.test_trigger_bound_to_a_raising_function:
        the trigger-bound function body must RAISE on both refusal branches."""
        sql = _read(self.SQL)
        body = re.search(
            r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.contest_use_context_guard\s*\(\)"
            r".*?\$\$(.*?)\$\$",
            sql, re.IGNORECASE | re.DOTALL,
        )
        assert body, "contest_use_context_guard() not defined in migration 053"
        fn_body = body.group(1)
        # Two RAISE branches: unregistered corpus (license unknown, fail-safe)
        # and a registered-but-not-commercial-safe license.
        assert fn_body.upper().count("RAISE EXCEPTION") >= 2, (
            "contest_use_context_guard must RAISE for both the unregistered-corpus "
            "and the non-commercial-safe-license branches "
            f"(found {fn_body.upper().count('RAISE EXCEPTION')})"
        )
        # Each refusal is a RAISE, not a silent RETURN: the license branch must
        # consult the classifier and the registry lookup must gate the first.
        assert "is_license_commercial_safe" in fn_body
        assert re.search(r"FROM\s+public\.datasets", fn_body, re.IGNORECASE)
        # And the trigger is BOUND to that raising function (a detached trigger
        # is the other way to neuter the guard without touching the body).
        assert re.search(
            r"CREATE\s+TRIGGER\s+contests_use_context_guard\s+"
            r"BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.contests\s+"
            r"FOR\s+EACH\s+ROW\s+"
            r"EXECUTE\s+FUNCTION\s+public\.contest_use_context_guard\(\)",
            sql, re.IGNORECASE,
        ), "trigger must execute public.contest_use_context_guard()"


# ---------------------------------------------------------------------------
# 053 — LIVE DB: the use-context guard is enforced by PostgreSQL itself, even
# for a service_role / RLS-bypassing connection. Same gate + fixture pattern as
# test_quarantine_guard_migration.TestQuarantineGuardLiveDB (MT_EVAL_TEST_DB_URL
# + a psycopg driver; skipped otherwise; everything rolls back).
# ---------------------------------------------------------------------------

def _connect_live_db():
    dsn = os.environ.get("MT_EVAL_TEST_DB_URL")
    if not dsn:
        return None
    try:
        import psycopg  # type: ignore
        return psycopg.connect(dsn, autocommit=False)
    except ImportError:
        pass
    try:
        import psycopg2  # type: ignore
        return psycopg2.connect(dsn)
    except ImportError:
        return None


_LIVE = _connect_live_db()
_live_db = pytest.mark.skipif(
    _LIVE is None,
    reason="set MT_EVAL_TEST_DB_URL (dev/staging branch) and install psycopg to run live-DB guard tests",
)


@_live_db
class TestUseContextGuardLiveDB:
    """Behavioral proof that migration 053 rejects a COMMERCIAL contest over an
    NC-licensed or unregistered corpus, and passes the allowed lanes. One shared
    transaction, rolled back in teardown — nothing persists on the branch."""

    @pytest.fixture(autouse=True)
    def _tx(self):
        conn = _LIVE
        self.conn, self.cur = conn, conn.cursor()
        sfx = uuid.uuid4().hex[:10]
        self.nc_ds = f"ucg-nc-{sfx}"       # registered, CC-BY-NC-SA (NC)
        self.open_ds = f"ucg-open-{sfx}"   # registered, CC-BY (commercial-safe)
        self._dataset(self.nc_ds, "CC-BY-NC-SA-4.0")
        self._dataset(self.open_ds, "CC-BY-4.0")
        yield
        conn.rollback()

    def _dataset(self, did, license_str):
        self.cur.execute(
            "INSERT INTO datasets (id, name, source_language, target_language,"
            " language_pair, license) VALUES (%s,%s,%s,%s,%s,%s)",
            (did, "use-context guard test", "English", "French", "en>fr",
             license_str),
        )

    def _insert_contest(self, cid, corpus_id, use_context):
        self.cur.execute(
            "INSERT INTO contests (id, name, corpus_id, language_pair,"
            " created_by, use_context) VALUES (%s,%s,%s,%s,%s,%s)",
            (cid, "use-context guard test", corpus_id, "en>fr",
             f"ucg-test-{cid}@example.invalid", use_context),
        )

    def _rejected(self, cid, corpus_id, use_context):
        """Try the insert inside a savepoint; return the error string if a
        trigger fired, else None (the insert succeeded)."""
        self.cur.execute("SAVEPOINT sp")
        try:
            self._insert_contest(cid, corpus_id, use_context)
        except Exception as exc:
            self.cur.execute("ROLLBACK TO SAVEPOINT sp")
            return str(exc)
        self.cur.execute("ROLLBACK TO SAVEPOINT sp")
        return None

    def test_commercial_contest_on_nc_dataset_is_rejected(self):
        err = self._rejected(
            f"ucg-com-nc-{uuid.uuid4().hex[:8]}", self.nc_ds, "commercial")
        assert err is not None, (
            "a commercial contest over an NC dataset must be rejected by the "
            "053 trigger, even for a service_role connection"
        )
        assert "USE-CONTEXT GUARD" in err.upper()

    def test_commercial_contest_on_unregistered_corpus_is_rejected(self):
        err = self._rejected(
            f"ucg-com-unreg-{uuid.uuid4().hex[:8]}",
            f"ucg-unregistered-{uuid.uuid4().hex[:8]}", "commercial")
        assert err is not None, (
            "an unregistered corpus (license unknown) must be fail-safe "
            "refused in the commercial lane"
        )
        assert "USE-CONTEXT GUARD" in err.upper()

    def test_noncommercial_contest_on_nc_dataset_is_allowed(self):
        # The safe lane: an NC dataset MAY back a non-commercial contest.
        err = self._rejected(
            f"ucg-nc-nc-{uuid.uuid4().hex[:8]}", self.nc_ds, "non-commercial")
        assert err is None, f"NC contest over an NC dataset must pass, got: {err}"

    def test_commercial_contest_on_permissive_dataset_is_allowed(self):
        err = self._rejected(
            f"ucg-com-ok-{uuid.uuid4().hex[:8]}", self.open_ds, "commercial")
        assert err is None, (
            f"a commercial contest over a CC-BY dataset must pass, got: {err}"
        )


# ---------------------------------------------------------------------------
# 054 — rls_auto_enable committed verbatim (L1)
# ---------------------------------------------------------------------------

class TestRlsAutoEnable:
    SQL = MIGRATIONS / "054_rls_auto_enable.sql"

    def test_function_matches_the_prod_object(self):
        sql = _read(self.SQL)
        assert "CREATE OR REPLACE FUNCTION public.rls_auto_enable()" in sql
        assert "RETURNS event_trigger" in sql
        assert "SECURITY DEFINER" in sql
        assert "SET search_path TO 'pg_catalog'" in sql
        assert "enable row level security" in sql
        # Failures log, never raise — the net must not break DDL replay.
        assert "RAISE LOG" in sql
        assert "WHEN OTHERS" in sql

    def test_event_trigger_created_conditionally_with_the_prod_tags(self):
        sql = _read(self.SQL)
        assert "pg_event_trigger WHERE evtname = 'ensure_rls'" in sql
        assert re.search(
            r"CREATE EVENT TRIGGER ensure_rls\s+ON ddl_command_end\s+"
            r"WHEN TAG IN \('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO'\)",
            sql,
        )


# ---------------------------------------------------------------------------
# 058 — rls_auto_enable EXECUTE re-revoke, replay-stable (DB2, audit 2026-07-20)
# ---------------------------------------------------------------------------
# 054's CREATE OR REPLACE restores default PUBLIC EXECUTE; 025's revoke ran before
# 054 exists on a linear replay and no-oped. 058 re-revokes AFTER 054 so a fresh
# rebuild of the (public-repo) migrations keeps advisor lints 0028/0029 clear.

class TestRlsAutoEnableRevoke:
    SQL = MIGRATIONS / "058_rls_auto_enable_execute_revoke.sql"

    def test_migration_exists_and_runs_after_054(self):
        assert self.SQL.exists(), "058 hardening migration is missing"
        # Ordering is by filename prefix; 058 > 054 guarantees it applies after.
        assert int(self.SQL.name[:3]) > 54

    def test_re_revokes_api_execute_on_rls_auto_enable(self):
        sql = _read(self.SQL)
        assert "rls_auto_enable" in sql
        assert re.search(
            r"REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public",
            sql,
        ), "058 must re-apply the API-facing EXECUTE revoke (same shape as 025)"
        # Must be a no-op when the function is absent (partial rebuild safety).
        assert "p.oid::regprocedure::text" in sql


# ---------------------------------------------------------------------------
# 059 — DB-as-queue foundation (B1, audit 2026-07-20)
# ---------------------------------------------------------------------------
# queue_items holds the ranked candidates; queue_top() serves an ordered page
# live-excluding VERIFIED-covered combos. The join keys MUST match the board.

class TestQueueItemsDbAsQueue:
    SQL = MIGRATIONS / "059_queue_items.sql"

    def test_migration_exists(self):
        assert self.SQL.exists(), "059 DB-as-queue migration is missing"

    def test_table_has_the_served_item_and_join_columns(self):
        sql = _read(self.SQL)
        assert "create table if not exists public.queue_items" in sql
        for col in ("rank_mode", "priority", "corpus_id", "model", "condition",
                    "language_pair", "est_cost_usd", "map_value", "diagnostics",
                    "generation_id"):
            assert col in sql, f"queue_items missing column {col}"

    def test_serving_rpc_excludes_verified_covered_combos(self):
        sql = _read(self.SQL)
        assert "function public.queue_top(" in sql
        # Live coverage filter must key on the exact board columns and only
        # count VERIFIED runs as "covered" (unverified must not suppress work).
        assert "rc.dataset_id = qi.corpus_id" in sql
        assert "rc.model_slug = qi.model" in sql
        assert "rc.condition  = qi.condition" in sql or "rc.condition = qi.condition" in sql
        assert "rc.trust      = 'verified'" in sql or "rc.trust = 'verified'" in sql
        assert "not exists" in sql.lower()

    def test_public_read_but_not_client_write(self):
        sql = _read(self.SQL)
        assert "enable row level security" in sql
        assert "for select using (true)" in sql
        # No client INSERT/UPDATE policy — only the service-role ranker writes.
        assert "for insert" not in sql.lower()
        assert "grant execute on function public.queue_top" in sql


# ---------------------------------------------------------------------------
# 062 — per-pair queue aggregation for the website (B1, audit 2026-07-20)
# ---------------------------------------------------------------------------
# queue_pairs() feeds the leaderboard waiting-count strip and the /contribute
# open-item total. Its coverage filter MUST be identical to queue_top's (059) so
# a bogus unverified run can never inflate a pair's count and the two never drift.
# (062, not 061: a parallel B1/B3 migration took 061; both are additive.)

class TestQueuePairsAggregation:
    SQL = MIGRATIONS / "062_queue_pairs.sql"
    QUEUE_TOP_SQL = MIGRATIONS / "059_queue_items.sql"

    def test_migration_exists_and_runs_after_059(self):
        assert self.SQL.exists(), "062 queue_pairs migration is missing"
        # Ordering is by filename prefix; 062 > 059 so queue_items/queue_top exist.
        assert int(self.SQL.name[:3]) > 59

    def test_function_shape_public_and_read_only(self):
        sql = _read(self.SQL)
        assert "function public.queue_pairs(" in sql
        # Returns a per-pair aggregation, not the raw items.
        assert "returns table" in sql.lower()
        for col in ("pair", "src", "tgt", "item_count", "min_cost"):
            assert col in sql, f"queue_pairs missing return column {col}"
        assert "group by qi.language_pair" in sql.lower()
        assert "count(*)" in sql.lower()
        assert "min(qi.est_cost_usd)" in sql.lower()
        # Same public-invoker + grant posture as queue_top; read-only by
        # construction (a STABLE `language sql` function whose body is a single
        # SELECT — no DML keywords).
        assert "security invoker" in sql.lower()
        assert "stable" in sql.lower()
        assert "language sql" in sql.lower()
        assert "grant execute on function public.queue_pairs" in sql.lower()
        for dml in ("insert into", "update ", "delete from", "drop "):
            assert dml not in sql.lower(), f"queue_pairs must be read-only (found {dml!r})"

    def test_coverage_filter_is_identical_to_queue_top(self):
        """The verified-coverage predicate must match queue_top's verbatim — a
        bogus UNVERIFIED run must never change a pair's count."""
        sql = _read(self.SQL)
        assert "not exists" in sql.lower()
        # Keyed on the exact board columns, VERIFIED-only (unverified ≠ covered).
        assert "rc.dataset_id = qi.corpus_id" in sql
        assert "rc.model_slug = qi.model" in sql
        assert "rc.condition  = qi.condition" in sql or "rc.condition = qi.condition" in sql
        assert "rc.trust      = 'verified'" in sql or "rc.trust = 'verified'" in sql
        # Filters by rank_mode like queue_top (queue_items holds 'map' + 'ecv';
        # aggregating across both would double-count).
        assert "qi.rank_mode = p_rank_mode" in sql

        # Structural parity: extract each function's coverage predicate (the real
        # NOT EXISTS subquery, anchored on the run_cards FROM clause so a prose
        # comment mentioning "NOT EXISTS" can't be mistaken for it) and require
        # the same three join keys + verified predicate appear in both.
        def _predicate_block(text: str) -> str:
            start = text.index("run_cards rc")
            end = text.index(")", text.index("trust", start))
            return text[start:end]

        top_block = _predicate_block(_read(self.QUEUE_TOP_SQL))
        pair_block = _predicate_block(sql)
        for needle in ("rc.dataset_id = qi.corpus_id",
                       "rc.model_slug = qi.model",
                       "'verified'"):
            assert needle in top_block, f"queue_top drifted: lost {needle!r}"
            assert needle in pair_block, f"queue_pairs drifted: lost {needle!r}"


# ---------------------------------------------------------------------------
# 055 + regenerate-queue — shared-secret + debounce (M2)
# ---------------------------------------------------------------------------

class TestRegenerateQueueAuth:
    SQL = MIGRATIONS / "055_regenerate_queue_auth.sql"
    INDEX = FUNCTIONS / "regenerate-queue" / "index.ts"
    LIB = FUNCTIONS / "regenerate-queue" / "lib.ts"

    def test_regen_state_is_single_row_and_service_role_only(self):
        sql = _read(self.SQL)
        assert "CREATE TABLE IF NOT EXISTS public.regen_state" in sql
        assert "CHECK (id = 1)" in sql
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "TO service_role" in sql
        assert "ON CONFLICT (id) DO NOTHING" in sql

    def test_notifier_sends_the_vault_secret_header(self):
        sql = _read(self.SQL)
        assert "regenerate_queue_secret" in sql
        assert "'x-regen-secret'" in sql
        # The 036 no-op-until-configured posture for url+token is preserved.
        assert "if fn_url is null or fn_token is null then" in sql

    def test_handler_and_migration_agree_on_names(self):
        """Cross-file drift freeze: header + env-var names must match
        between the SQL notifier and the TS handler."""
        index = _read(self.INDEX)
        sql = _read(self.SQL)
        for text in ("x-regen-secret", "REGEN_SHARED_SECRET"):
            assert text in index, f"index.ts lost {text!r}"
            assert text in sql, f"migration 055 lost {text!r}"

    def test_handler_fails_closed_and_debounces(self):
        index = _read(self.INDEX)
        assert "secretsMatch" in index
        assert "503" in index, "unconfigured secret must refuse, not run open"
        assert "401" in index
        assert "regen_state" in index
        assert "REGEN_MIN_INTERVAL_SECONDS" in index
        lib = _read(self.LIB)
        assert "export function secretsMatch" in lib
        assert "b.length > 0" in lib, "empty expected secret must never match"


# ---------------------------------------------------------------------------
# H2 — submit-run rate-limit key hardening
# ---------------------------------------------------------------------------

class TestSubmitRunClientIp:
    LIB = FUNCTIONS / "submit-run" / "lib.ts"
    INDEX = FUNCTIONS / "submit-run" / "index.ts"

    def test_leftmost_xff_hop_is_gone(self):
        lib = _read(self.LIB)
        assert 'xff.split(",")[0]' not in lib, (
            "the leftmost X-Forwarded-For hop is client-spoofable (audit H2)"
        )
        assert "isPublicIp" in lib
        # Right-to-left scan for the last proxy-appended public hop.
        assert "xff.length - 1" in lib

    def test_connection_peer_reaches_the_handler(self):
        index = _read(self.INDEX)
        assert "remoteAddr" in index
        assert "clientIpFrom(req.headers, connectionIp)" in index


# ---------------------------------------------------------------------------
# 063 — content-guard perf hoist (DB6, launch review 2026-07-20)
# ---------------------------------------------------------------------------
# 051's run_cards content guard re-serialized the <=1 MB row via to_jsonb(NEW)
# once per column (~13x/row). 063 hoists it to a single local; behaviour is
# byte-identical, only serialization cost drops. Deep behavioural coverage lives
# in test_run_card_content_guard_migration.py; this freezes the migration file.

class TestContentGuardPerfHoist063:
    SQL = MIGRATIONS / "063_run_cards_content_guard_perf.sql"

    def test_migration_exists_and_runs_after_051(self):
        assert self.SQL.exists(), "063 DB6 perf migration is missing"
        assert int(self.SQL.name[:3]) > 51

    def test_hoists_to_jsonb_new_to_one_call_and_keeps_search_path(self):
        sql = _read(self.SQL)
        body = sql[sql.index("AS $$"): sql.rindex("$$;")]
        assert body.count("to_jsonb(NEW)") == 1, (
            "to_jsonb(NEW) must be computed once (hoisted), not per column (DB6)"
        )
        assert "card_json := to_jsonb(NEW);" in body
        assert "to_jsonb(NEW) ->>" not in body, "the ~13x per-column re-serialize must be gone"
        assert "SET search_path = public" in sql, "the 051 search_path pin must survive"

    def test_preserves_the_guard_and_does_not_touch_trigger_or_walker(self):
        sql = _read(self.SQL)
        assert "CREATE OR REPLACE FUNCTION run_cards_content_guard_check()" in sql
        for tok in ("1048576", "262144", "run_card_shape_violation(NEW.run_card)"):
            assert tok in sql, f"063 lost preserved guard behaviour: {tok!r}"
        assert "DROP TRIGGER" not in sql.upper()
        assert "CREATE OR REPLACE FUNCTION run_card_shape_violation" not in sql


# ---------------------------------------------------------------------------
# 064 — anchored quarantine backstop (DB7 + E9, launch review 2026-07-20)
# ---------------------------------------------------------------------------
# The unanchored substring blocklist in 022 (and its 041 twin) permanently
# blocked legit future ids (crk-master-2026, dev-1240). 064 CREATE OR REPLACEs
# BOTH twins with an anchored, byte-identical regex, re-pinning search_path.
# Deep block/allow behaviour lives in test_quarantine_guard_migration.py.

class TestQuarantineGuardAnchor064:
    SQL = MIGRATIONS / "064_quarantine_guard_anchor.sql"

    def _regexes(self):
        sql = _read(self.SQL)
        return re.findall(r"NEW\.(?:dataset_id|corpus_id)\s*~\*\s*'([^']+)'", sql)

    def test_migration_exists_and_runs_after_022_and_041(self):
        assert self.SQL.exists(), "064 DB7 anchor migration is missing"
        assert int(self.SQL.name[:3]) > 41

    def test_replaces_both_twins_and_repins_search_path(self):
        sql = _read(self.SQL)
        assert "CREATE OR REPLACE FUNCTION reject_quarantined_datasets()" in sql
        assert "CREATE OR REPLACE FUNCTION public.contest_corpus_guard()" in sql
        # E9: 022's function had no pin (025 added it); both replacements re-pin.
        assert sql.count("SET search_path = public") >= 2
        assert "DROP TRIGGER" not in sql.upper()

    def test_twin_backstops_are_byte_identical_and_anchored(self):
        rxs = self._regexes()
        assert len(rxs) == 2 and rxs[0] == rxs[1], (
            "the 022 and 041 backstops must stay byte-identical twins"
        )
        assert "(?!" in rxs[0], "the regex must be anchored with lookahead boundaries"
        assert "-quarantined" not in rxs[0], "bare '-quarantined' alternative must be gone"

    def test_still_blocks_known_bad_but_allows_versioned_lookalikes(self):
        rx = re.compile(self._regexes()[0], re.IGNORECASE)
        # DO-NOT-BREAK: the known-improper crk slices stay rejected.
        for did in ("crk-master-corpus", "crk-phase1-test-90-quarantined",
                    "crk-edtekla-dev-124-quarantined", "crk-sample-62", "crk_master"):
            assert rx.search(did), f"known-improper id must stay blocked: {did!r}"
        # DB7: versioned / longer-number lookalikes are now allowed.
        for did in ("crk-master-2026", "dev-1240", "sample-620"):
            assert not rx.search(did), f"legit lookalike must be allowed: {did!r}"
