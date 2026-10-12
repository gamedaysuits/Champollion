"""Tests for migration 074 — contest entries, phases, and frozen promises.

074 is the data layer under the sovereign-contest practices (founder rulings
2026-09-06: a contest is sovereign hosting; an entry is a METHOD handed to the
air-gapped node). It adds the entry declarations to ``contest_submissions``,
the ``contest_phases`` windows that make a deadline a rule rather than a
sentence on a web page, the deferred-results parking place, the counts-only
execution diagnostics channel, and — the part that matters most — it turns
twelve ``contests.metadata`` keys from SETTINGS into PROMISES by freezing them
once the contest has entries.

OFFLINE (always run): the migration must PARSE under the real PostgreSQL
grammar (pglast) and carry each structural guarantee as text — the
tests/test_contest_lifecycle_migration.py and
tests/test_contest_intake_migrations.py pattern. Every closed vocabulary the
SQL writes is asserted equal to its twin in
``mt_eval_harness.contest_policy``: one rule, two languages.

The live behaviour (overlapping phases refused, caps enforced, a second
primary refused, a promise change after an entry refused, …) is proved on the
LOCAL Supabase stack, not here; the probe transcript is the record of that.

DEV/LOCAL ONLY. 074 is not applied to production until the founder says so
(see the migration header).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pglast = pytest.importorskip(
    "pglast", reason="pip install pglast to validate migration SQL"
)

from mt_eval_harness.contest_policy import (  # noqa: E402
    DEFERRED_ROLES,
    FROZEN_PROMISE_KEYS,
    PHASE_NAMES,
    POST_CLOSE_KEYS,
    PRIZE_DECLARED_KEYS,
    PRIZE_DERIVED_ONLY_KEYS,
    PRIZE_DISPOSITION_DERIVED,
    PRIZE_DISPOSITION_OVERRIDES,
    PRIZE_DISPOSITIONS,
    PRIZE_ENUM_DIMENSIONS,
    PRIZE_RELEASE_LICENSE_ANY,
    PRIZE_RETIRED_KEYS,
    RESULTS_VISIBILITY,
    TEST_SUITE_KEYS,
    TICKET_KINDS,
    TIE_TESTS,
    TRACKS,
)
from mt_eval_harness.contest_rank import METRIC_VOCABULARY  # noqa: E402

MIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
MIGRATION = MIG_DIR / "074_contest_entries_phases_and_promises.sql"


def _sql() -> str:
    assert MIGRATION.exists(), f"migration missing: {MIGRATION}"
    return MIGRATION.read_text()


def _body() -> str:
    """The executable SQL only — comment lines (incl. the ROLLBACK recipe,
    which quotes the pre-074 statements verbatim) stripped out."""
    return "\n".join(
        line for line in _sql().splitlines() if not line.lstrip().startswith("--")
    )


def _literal_list(sql: str, pattern: str) -> tuple[str, ...]:
    """Pull one SQL literal list out of the migration text, in order."""
    m = re.search(pattern, sql)
    assert m, f"literal list not found for pattern: {pattern}"
    return tuple(
        s.strip().strip("'") for s in m.group(1).split(",") if s.strip()
    )


class TestMigrationParses:
    def test_parses_under_postgres_grammar(self):
        assert len(pglast.parse_sql(_sql())) > 0

    def test_is_unique_and_follows_073(self):
        numbers = sorted(int(p.name[:3]) for p in MIG_DIR.glob("[0-9][0-9][0-9]_*.sql"))
        assert numbers.count(74) == 1, "migration number 074 must be unique"
        assert 73 in numbers, "074 must follow 073 in the canonical sequence"

    def test_header_documents_hole_migration_rollback_and_dev_only(self):
        sql = _sql()
        low = sql.lower()
        assert "the hole" in low
        assert "this migration" in low
        assert "rollback" in low
        assert "dev/local only" in low
        assert "do not\n-- apply to production" in low or "do not apply to production" in low

    def test_rollback_names_every_new_object(self):
        sql = _sql()
        for needle in (
            "DROP TABLE IF EXISTS public.contest_phases CASCADE;",
            "DROP TABLE IF EXISTS public.contest_deferred_results CASCADE;",
            "DROP FUNCTION IF EXISTS public.contest_active_phase(text, timestamptz);",
            "DROP FUNCTION IF EXISTS public.contest_phase_guard();",
            "DROP FUNCTION IF EXISTS public.contest_sealed_set_ids(text);",
            "DROP FUNCTION IF EXISTS public.contest_for_sealed_set(text);",
            "DROP COLUMN IF EXISTS execution_diagnostics",
        ):
            assert needle in sql, needle


class TestIdempotence:
    """Every statement must be safely re-runnable (house rule)."""

    def test_tables_indexes_and_functions(self):
        for raw in pglast.parse_sql(_sql()):
            node = raw.stmt
            name = type(node).__name__
            if name == "CreateStmt":
                assert node.if_not_exists, "CREATE TABLE needs IF NOT EXISTS"
            elif name == "IndexStmt":
                assert node.if_not_exists, "CREATE INDEX needs IF NOT EXISTS"
            elif name == "CreateFunctionStmt":
                assert node.replace, "CREATE FUNCTION needs OR REPLACE"
            elif name == "DropStmt":
                assert node.missing_ok, "DROP needs IF EXISTS"

    def test_every_add_column_is_guarded(self):
        sql = _sql()
        assert sql.count("ADD COLUMN") == sql.count("ADD COLUMN IF NOT EXISTS")

    def test_the_one_add_constraint_is_preceded_by_a_drop(self):
        body = _body()
        adds = re.findall(r"ALTER TABLE (\S+) ADD CONSTRAINT (\w+)", body)
        assert adds == [("public.tickets", "tickets_kind_check")], adds
        assert "ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_kind_check;" in body

    def test_every_trigger_and_policy_is_dropped_first(self):
        sql = _sql()
        for trg, tbl in re.findall(r"CREATE TRIGGER (\w+)\s+BEFORE [^\n]*ON (\S+)", sql):
            assert f"DROP TRIGGER IF EXISTS {trg} ON {tbl};" in sql, trg
        for pol in re.findall(r"CREATE POLICY (\w+)", sql):
            assert f"DROP POLICY IF EXISTS {pol} ON" in sql, pol


class TestSubmissionColumns:
    def test_every_declared_column_is_added(self):
        sql = _sql()
        for col in ("is_primary", "track", "description", "method_release_url",
                    "constraints", "submitter_label", "authorization_request_id",
                    "phase"):
            assert re.search(
                rf"ALTER TABLE public\.contest_submissions\s+ADD COLUMN IF NOT EXISTS {col}\b",
                sql,
            ), col

    def test_defaults_and_shapes(self):
        sql = _sql()
        assert "is_primary BOOLEAN NOT NULL DEFAULT true" in sql
        assert "track TEXT NOT NULL DEFAULT 'unconstrained'" in sql
        assert "constraints JSONB NOT NULL DEFAULT '{}'::jsonb" in sql
        assert "char_length(description) <= 4000" in sql
        assert "method_release_url ~ '^https?://'" in sql
        assert "char_length(method_release_url) <= 2048" in sql
        assert "REFERENCES public.authorization_requests (request_id)" in sql

    def test_one_primary_per_team_partial_unique_index(self):
        sql = _sql()
        assert re.search(
            r"CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_one_primary\s+"
            r"ON public\.contest_submissions \(contest_id, COALESCE\(team, submitted_by\)\)\s+"
            r"WHERE is_primary;",
            sql,
        )

    def test_authorization_request_id_is_indexed(self):
        assert "CREATE INDEX IF NOT EXISTS idx_cs_auth_request" in _sql()

    def test_submitter_label_is_documented_as_never_the_email(self):
        sql = _sql()
        m = re.search(
            r"COMMENT ON COLUMN public\.contest_submissions\.submitter_label IS\s+'(.+?)';",
            sql, re.S)
        assert m, "submitter_label comment missing"
        assert "never the email" in m.group(1).lower()


class TestPhases:
    def test_table_and_window_constraints(self):
        sql = _sql()
        assert "CREATE TABLE IF NOT EXISTS public.contest_phases" in sql
        assert "CONSTRAINT contest_phases_window_ordered CHECK (ends_at > starts_at)" in sql
        assert "CONSTRAINT contest_phases_one_per_name UNIQUE (contest_id, name)" in sql
        assert re.search(
            r"max_submissions\s+INT CHECK \(max_submissions IS NULL OR max_submissions > 0\)", sql)
        assert re.search(
            r"max_submissions_per_day INT CHECK \(max_submissions_per_day IS NULL "
            r"OR max_submissions_per_day > 0\)", sql)

    def test_guard_covers_insert_update_and_delete(self):
        sql = _sql()
        assert re.search(
            r"CREATE TRIGGER contest_phases_guard\s+"
            r"BEFORE INSERT OR UPDATE OR DELETE ON public\.contest_phases\s+"
            r"FOR EACH ROW\s+EXECUTE FUNCTION public\.contest_phase_guard\(\);",
            sql,
        )

    def test_guard_refuses_overlap(self):
        sql = _sql()
        assert "tstzrange(p.starts_at, p.ends_at, '[)')" in sql
        assert "tstzrange(NEW.starts_at, NEW.ends_at, '[)')" in sql
        assert "overlaps phase" in sql

    def test_guard_freezes_started_windows_and_contests_with_entries(self):
        sql = _sql()
        assert "OLD.starts_at <= now()" in sql
        assert "a window that has opened is never edited or deleted" in sql
        assert "its phase windows are frozen" in sql
        assert "PHASE GUARD:" in sql

    def test_active_phase_function_signature(self):
        sql = _sql()
        assert re.search(
            r"CREATE OR REPLACE FUNCTION public\.contest_active_phase\(\s*"
            r"p_contest_id text,\s*p_at timestamptz DEFAULT now\(\)\)\s*"
            r"RETURNS public\.contest_phases",
            sql,
        )
        # half-open window: [starts_at, ends_at)
        assert "p_at >= p.starts_at" in sql
        assert "p_at <  p.ends_at" in sql

    def test_rls_public_select_owner_insert_no_anon_write(self):
        sql = _sql()
        assert "ALTER TABLE public.contest_phases ENABLE ROW LEVEL SECURITY;" in sql
        assert re.search(
            r"CREATE POLICY contest_phases_public_read\s+ON public\.contest_phases\s+"
            r"FOR SELECT\s+TO anon, authenticated", sql)
        assert re.search(
            r"CREATE POLICY contest_phases_owner_insert\s+ON public\.contest_phases\s+"
            r"FOR INSERT\s+TO authenticated", sql)
        # no INSERT/UPDATE/DELETE policy for anon anywhere on the table
        assert not re.search(r"ON public\.contest_phases\s+FOR (INSERT|UPDATE|DELETE|ALL)\s+TO anon", sql)


class TestRequestDoor:
    def test_keeps_every_045_check_and_prefix(self):
        sql = _sql()
        for needle in (
            "REQUEST GUARD: sealed set % is not registered.",
            "REQUEST GUARD: sealed set % is ''%'' (not active)",
            "REQUEST GUARD: a request must be born ''pending''",
            "REQUEST GUARD: decided_at cannot be set at proposal time.",
            "(sealed_sets.request_daily_limit).",
        ):
            assert needle in sql, needle

    def test_no_open_phase_is_the_deadline(self):
        sql = _sql()
        assert "REQUEST GUARD: no open phase for contest %" in sql

    def test_phase_caps_are_enforced_per_requester_per_contest(self):
        sql = _sql()
        assert "contest_phases.max_submissions_per_day" in sql
        assert "contest_phases.max_submissions" in sql
        assert "r.created_at    > NOW() - INTERVAL '24 hours'" in sql
        assert "r.created_at   >= v_phase.starts_at" in sql
        assert "r.created_at   <  v_phase.ends_at" in sql

    def test_unphased_contests_fall_back_to_the_flat_limit(self):
        sql = _sql()
        assert "v_contest_id := public.contest_for_sealed_set(NEW.sealed_set_id);" in sql
        assert "-- ---- Un-phased contests: the 045 flat throttle, exactly as before" in sql

    def test_ambiguous_ownership_is_a_finding_not_a_coin_toss(self):
        sql = _sql()
        assert "open phased contests" in sql
        assert "is ambiguous" in sql


class TestSubmissionDoor:
    def test_keeps_the_052_constant_and_prefix(self):
        sql = _sql()
        assert "v_limit CONSTANT int := 24;" in sql
        assert "SUBMISSION GUARD: submitted_by must be a non-empty identity" in sql
        assert "NEW.submitted_at := now();" in sql

    def test_phase_is_derived_from_the_request_created_at(self):
        sql = _sql()
        assert "SELECT r.created_at INTO v_req_created_at" in sql
        assert "v_req_created_at >= p.starts_at" in sql
        assert "v_req_created_at <  p.ends_at" in sql
        assert "NEW.phase := v_derived_phase;" in sql

    def test_a_disagreeing_client_phase_is_refused(self):
        sql = _sql()
        assert "NEW.phase IS DISTINCT FROM v_derived_phase AND NEW.phase IS NOT NULL" in sql
        assert "the phase is recorded by the server, not claimed by the client" in sql

    def test_update_cannot_walk_past_the_insert_time_derivation(self):
        """Local-stack probe P13: the 052 door is BEFORE INSERT only."""
        sql = _sql()
        assert re.search(
            r"CREATE TRIGGER contest_submissions_entry_freeze\s+"
            r"BEFORE UPDATE ON public\.contest_submissions\s+FOR EACH ROW\s+"
            r"EXECUTE FUNCTION public\.contest_submission_entry_freeze\(\);", sql)
        assert "NEW.phase IS DISTINCT FROM OLD.phase" in sql
        assert "NEW.authorization_request_id IS DISTINCT FROM OLD.authorization_request_id" in sql
        for col in ("contest_id", "run_card_id", "submitted_by", "submitted_at"):
            assert re.search(rf"NEW\.{col}\s+IS DISTINCT FROM OLD\.{col}", sql), col


class TestLifecycleGuardKeepsEverything072Did:
    def test_identity_freeze_and_one_way_lifecycle(self):
        sql = _sql()
        for col in ("id", "corpus_id", "language_pair", "lane", "use_context",
                    "created_by", "created_at"):
            assert re.search(rf"NEW\.{col}\s+IS DISTINCT FROM OLD\.{col}", sql), col
        assert "(OLD.status = 'open'   AND NEW.status = 'closed')" in sql
        assert "(OLD.status = 'closed' AND NEW.status = 'archived')" in sql

    def test_close_requires_a_result_and_stamps_the_server_time(self):
        sql = _sql()
        assert "jsonb_typeof(NEW.metadata -> 'final_ranking') IS DISTINCT FROM 'object'" in sql
        assert "NEW.intake_open := false;" in sql
        assert "jsonb_build_object('closed_at', now())" in sql

    def test_primary_metric_vocabulary_is_preserved(self):
        # 074 kept 072's four-metric list verbatim; 076 later moved the
        # vocabulary into the rankable_metrics table.
        sql = _sql()
        vocab = _literal_list(sql, r"v_metric NOT IN \(([^)]*)\)")
        assert set(vocab) == {"chrf_plus_plus", "bleu", "comet_score", "composite"}
        assert set(vocab) <= set(METRIC_VOCABULARY)

    def test_trigger_is_rebound(self):
        sql = _sql()
        assert re.search(
            r"CREATE TRIGGER contests_lifecycle_guard\s+BEFORE INSERT OR UPDATE ON public\.contests\s+"
            r"FOR EACH ROW\s+EXECUTE FUNCTION public\.contest_lifecycle_guard\(\);", sql)


class TestPromiseLayer:
    def test_entries_include_authorization_requests(self):
        sql = _sql()
        assert "public.contest_submissions cs WHERE cs.contest_id = OLD.id" in sql
        assert "public.contest_intake ci WHERE ci.contest_id = OLD.id" in sql
        assert "ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.id))" in sql

    def test_freeze_message_names_the_key(self):
        sql = _sql()
        assert "is a PROMISE to participants and is frozen" in sql

    def test_write_time_vocabulary_checks_exist(self):
        sql = _sql()
        assert "metadata.results_visibility must be one of immediate | hidden_until_close" in sql
        assert "metadata.tie_test must be one of ar | bootstrap" in sql
        assert "metadata.alpha must be strictly between 0 and 1" in sql
        assert "metadata.n_resamples must be an integer >= 1" in sql
        assert "metadata.allowed_tracks entry % is not a track" in sql
        assert "metadata.% must be a boolean" in sql
        assert "metadata.prize_terms must be an object" in sql
        assert "is not a registered sealed set (sealed_sets)" in sql


class TestPrizeDisposition:
    """metadata.prize_terms after the 2026-09-07 trinary ruling.

    Every vocabulary the guard writes is asserted equal to its twin in
    ``contest_policy`` — one rule, two languages. The live behaviour (all
    three dispositions accepted, every refusal named) is proved by probes on
    the local stack inside a rolled-back transaction; these tests keep the two
    texts from drifting between those runs.
    """

    def test_the_disposition_vocabulary_matches_contest_policy(self):
        vocab = _literal_list(
            _sql(), r"v_prize ->> 'disposition'\) NOT IN \(([^)]*)\)")
        assert vocab == PRIZE_DISPOSITIONS

    @pytest.mark.parametrize("disposition,key", [
        (d, k) for d, table in sorted(PRIZE_DISPOSITION_OVERRIDES.items())
        for k, vocabulary in table.items() if vocabulary is not None])
    def test_each_override_vocabulary_matches_contest_policy(
            self, disposition, key):
        vocab = _literal_list(
            _sql(), rf"v_prize ->> '{key}'\) NOT IN \(([^)]*)\)")
        assert vocab == PRIZE_DISPOSITION_OVERRIDES[disposition][key]

    def test_the_allowed_key_set_is_the_declarable_keys(self):
        keys = _literal_list(_sql(), r"v_prize_key NOT IN \(([^)]*)\)")
        assert keys == PRIZE_DECLARED_KEYS

    def test_the_derived_keys_are_refused_as_explicit_keys(self):
        sql = _sql()
        for key in PRIZE_DERIVED_ONLY_KEYS:
            assert f"v_prize ? '{key}'" in sql, key
        assert ("rights and host_use are DERIVED from disposition and are "
                "never declared") in sql

    def test_an_override_is_refused_on_a_disposition_that_does_not_offer_it(self):
        sql = _sql()
        assert ("metadata.prize_terms.retention is not an override disposition"
                in sql)
        assert ("metadata.prize_terms.release is not an override disposition"
                in sql)
        assert "Only ''retain_ip'' may set it" in sql

    def test_the_retired_switches_are_refused_by_name(self):
        sql = _sql()
        for key in PRIZE_RETIRED_KEYS:
            assert f"v_prize ? '{key}'" in sql, key
            assert f"metadata.prize_terms.{key} is RETIRED" in sql, key
        assert "the prize term is one choice of three" in sql
        assert "open / audit / community / strict were retired" in sql

    def test_release_license_is_required_exactly_under_release_open(self):
        sql = _sql()
        assert "disposition ''release_open'' requires release_license" in sql
        assert PRIZE_RELEASE_LICENSE_ANY in sql
        assert ("release_license is declared but disposition is" in sql)

    def test_community_terms_url_must_be_https(self):
        sql = _sql()
        assert "community_terms_url must be an https:// URL" in sql
        assert "'^https://[^[:space:]]+$'" in sql

    def test_the_derivation_contradiction_checks_are_gone(self):
        """Nothing is assembled any more, so nothing can contradict itself:
        the derived combinations come from ONE table in contest_policy."""
        assert "is self-contradictory" not in _sql()

    def test_money_is_kept_out_of_the_terms(self):
        assert ("Prize money is declared in metadata.prize, never inside the "
                "terms") in _sql()

    @pytest.mark.parametrize("disposition", sorted(PRIZE_DISPOSITIONS))
    def test_each_disposition_and_its_overrides_are_literals_in_the_guard(
            self, disposition):
        """The guard only ever sees DECLARED keys, so the literals it must
        carry are the three dispositions and the override values each one
        offers. Derived-only values (rights, host_use, and any derived default
        that has no override) are deliberately absent: the database never
        stores them."""
        sql = _sql()
        assert f"'{disposition}'" in sql
        for key, vocabulary in PRIZE_DISPOSITION_OVERRIDES[disposition].items():
            for value in (vocabulary or ()):
                assert f"'{value}'" in sql, f"{disposition}: {key}={value}"
        derived = PRIZE_DISPOSITION_DERIVED[disposition]
        for key in ("rights", "host_use"):
            assert f"NOT IN ('{derived[key]}'" not in sql

    def test_the_function_comment_describes_the_disposition(self):
        comment = _sql().split("COMMENT ON FUNCTION public.contest_lifecycle_guard()")[1]
        assert "PRIZE DISPOSITION" in comment
        for disposition in PRIZE_DISPOSITIONS:
            assert disposition in comment
        for name in PRIZE_ENUM_DIMENSIONS:
            assert name in comment

    def test_test_suite_elements_are_pinned_by_a_64_hex_sha(self):
        sql = _sql()
        assert "!~ '^[0-9a-f]{64}$'" in sql

    def test_after_close_only_human_eval_selection_may_change(self):
        sql = _sql()
        assert "human_eval_selection is the only key that may still change after close" in sql
        assert "v_old_md := v_old_md - v_key;" in sql
        assert "v_new_md IS DISTINCT FROM v_old_md" in sql


class TestDeferredResults:
    def test_table_shape(self):
        sql = _sql()
        assert "CREATE TABLE IF NOT EXISTS public.contest_deferred_results" in sql
        assert "request_id             TEXT PRIMARY KEY" in sql
        assert "contest_id             TEXT NOT NULL REFERENCES public.contests (id)" in sql
        assert "run_card_row           JSONB NOT NULL" in sql

    def test_partial_index_on_unpublished(self):
        sql = _sql()
        assert re.search(
            r"CREATE INDEX IF NOT EXISTS idx_deferred_unpublished\s+"
            r"ON public\.contest_deferred_results \(contest_id\)\s+"
            r"WHERE published_run_card_id IS NULL;", sql)

    def test_guard_makes_the_card_immutable_and_publication_set_once(self):
        sql = _sql()
        assert "NEW.run_card_row IS DISTINCT FROM OLD.run_card_row" in sql
        assert "OLD.published_run_card_id IS NOT NULL" in sql
        assert "set once and never cleared or re-pointed" in sql
        assert "DEFERRED RESULT GUARD:" in sql

    def test_rls_owner_select_service_write_no_anon(self):
        sql = _sql()
        assert "ALTER TABLE public.contest_deferred_results ENABLE ROW LEVEL SECURITY;" in sql
        assert "CREATE POLICY contest_deferred_results_owner_read" in sql
        assert "CREATE POLICY contest_deferred_results_service_write" in sql
        assert not re.search(r"ON public\.contest_deferred_results\s+FOR \w+\s+TO [^\n]*anon", sql)


class TestExecutionDiagnostics:
    def test_column_added(self):
        sql = _sql()
        assert ("ALTER TABLE public.authorization_requests\n"
                "  ADD COLUMN IF NOT EXISTS execution_diagnostics JSONB;") in sql

    def test_038_guard_permits_only_this_column_after_a_decision(self):
        sql = _sql()
        assert "IF OLD.decided_at IS NOT NULL THEN" in sql
        assert "only execution_diagnostics may still be written" in sql
        # the original 038 term freeze and state machine survive verbatim
        assert "AUTH REQUEST GUARD: request % terms are immutable" in sql
        assert "AUTH REQUEST GUARD: illegal state transition % -> % for request %" in sql

    def test_documented_as_counts_only(self):
        sql = _sql()
        m = re.search(
            r"COMMENT ON COLUMN public\.authorization_requests\.execution_diagnostics IS\s+'(.+?)';",
            sql, re.S)
        assert m
        assert "counts-only" in m.group(1).lower()
        assert "never per-entry text" in m.group(1).lower()


class TestSharedTaskReport:
    def test_columns_added(self):
        sql = _sql()
        assert "ADD COLUMN IF NOT EXISTS report_url TEXT" in sql
        assert "ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;" in sql

    def test_047_guard_freezes_identity_only(self):
        sql = _sql()
        m = re.search(
            r"CREATE OR REPLACE FUNCTION public\.reject_illegal_shared_task_mutation\(\)(.+?)\n\$\$;",
            sql, re.S)
        assert m, "047 guard not replaced in 074"
        body = m.group(1)
        for col in ("shared_task_id", "year", "created_at"):
            assert f"NEW.{col}" in body
        assert "report_url" not in body.replace(
            "report_url / report_generated_at are all freely correctable in place.", "")


class TestTickets:
    def test_subject_run_card_id_shape_and_no_fk(self):
        sql = _sql()
        assert "subject_run_card_id ~ '^[0-9a-f-]{36}$'" in sql
        assert re.search(
            r"ADD COLUMN IF NOT EXISTS subject_run_card_id TEXT\n(?!.*REFERENCES)", sql)
        assert "CREATE INDEX IF NOT EXISTS idx_tickets_subject_run_card" in sql

    def test_rls_is_untouched(self):
        sql = _sql()
        assert "tickets" in sql
        assert not re.search(r"CREATE POLICY \w+ ON (public\.)?tickets", sql)
        assert not re.search(r"ALTER TABLE (public\.)?tickets [^\n]*ROW LEVEL SECURITY", sql)


class TestVocabularyParity:
    """One rule, two languages: every SQL literal list equals its Python twin."""

    def test_tracks(self):
        assert _literal_list(_sql(), r"CHECK \(track IN \(([^)]*)\)\)") == TRACKS

    def test_allowed_tracks_vocabulary_matches(self):
        vocab = _literal_list(_sql(), r"\(v_track #>> '\{\}'\) NOT IN \(([^)]*)\)")
        assert vocab == TRACKS

    def test_phase_names_on_the_table(self):
        assert _literal_list(_sql(), r"CHECK \(name IN \(([^)]*)\)\)") == PHASE_NAMES

    def test_phase_names_on_the_submission_column(self):
        assert _literal_list(_sql(), r"OR phase IN \(([^)]*)\)") == PHASE_NAMES

    def test_results_visibility(self):
        vocab = _literal_list(_sql(), r"v_visibility NOT IN \(([^)]*)\)")
        assert vocab == RESULTS_VISIBILITY

    def test_tie_tests(self):
        assert _literal_list(_sql(), r"v_tie_test NOT IN \(([^)]*)\)") == TIE_TESTS

    def test_deferred_roles(self):
        assert _literal_list(_sql(), r"CHECK \(role IN \(([^)]*)\)\)") == DEFERRED_ROLES

    def test_ticket_kinds(self):
        assert _literal_list(_body(), r"CHECK \(kind IN \(([^)]*)\)\)") == TICKET_KINDS

    def test_ticket_kinds_extend_065_by_exactly_one_value(self):
        legacy = ("takedown", "objection", "correction", "question", "other")
        assert set(TICKET_KINDS) - set(legacy) == {"flag"}
        assert set(legacy) - set(TICKET_KINDS) == set()

    def test_frozen_promise_keys(self):
        sql = _sql()
        m = re.search(
            r"v_frozen_promise_keys CONSTANT text\[\] := ARRAY\[(.+?)\];", sql, re.S)
        assert m, "frozen promise key array not found"
        keys = tuple(s.strip().strip("'") for s in m.group(1).split(",") if s.strip())
        # 076 appended the two computation promises; 074 froze the rest.
        assert keys == tuple(k for k in FROZEN_PROMISE_KEYS
                             if k not in ("metric_signature", "harness_version",
                                          "declared_power"))

    def test_post_close_keys(self):
        sql = _sql()
        m = re.search(
            r"v_post_close_keys CONSTANT text\[\] := ARRAY\[(.+?)\];", sql, re.S)
        assert m, "post-close key array not found"
        keys = tuple(s.strip().strip("'") for s in m.group(1).split(",") if s.strip())
        assert keys == POST_CLOSE_KEYS

    def test_test_suite_keys(self):
        sql = _sql()
        m = re.search(
            r"FOREACH v_suite_key IN ARRAY ARRAY\[(.+?)\] LOOP", sql, re.S)
        assert m, "test-suite key array not found"
        keys = tuple(s.strip().strip("'") for s in m.group(1).split(",") if s.strip())
        assert keys == TEST_SUITE_KEYS

    def test_boolean_promise_keys_are_all_frozen_keys(self):
        sql = _sql()
        m = re.search(
            r"FOREACH v_key IN ARRAY ARRAY\[('open_weight_only'.+?)\] LOOP", sql, re.S)
        assert m, "boolean promise key array not found"
        keys = tuple(s.strip().strip("'") for s in m.group(1).split(",") if s.strip())
        assert set(keys) <= set(FROZEN_PROMISE_KEYS)


class TestPolicyModuleIsLeafOnly:
    def test_contest_policy_imports_nothing_from_the_harness(self):
        src = (Path(__file__).resolve().parents[1]
               / "mt_eval_harness" / "contest_policy.py").read_text()
        assert "from mt_eval_harness" not in src
        assert not re.search(r"^\s*import mt_eval_harness", src, re.M)
        assert not re.search(r"^\s*from \.", src, re.M)
