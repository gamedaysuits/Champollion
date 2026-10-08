"""Tests for migration 051 — the run_cards.run_card aggregate-content guard.

Launch-readiness audit 2026-07-18, H1: migration 033 guards corpus content on
run_card_entries only; the world-readable ``run_cards.run_card`` JSONB had no
content guard, so restricted corpus text could be laundered onto the public
board inside the aggregate blob. Migration
``051_run_cards_content_guard.sql`` closes that: it reuses 033's resolution
(dataset join + ``is_license_redistributable``) and enforces a strict
aggregate-only JSONB shape for corpora that are not redistribution-cleared.

Offline coverage (always run): the migration must keep the structural
promises its header makes — 033 reuse (never a re-definition), the BEFORE
INSERT OR UPDATE trigger, the documented caps, the single exempted long-text
path (top-level ``system_prompt_used``), and the neighboring text-column
caps. These freeze the SQL against silent drift; the live-DB behavior rides
the same MT_EVAL_TEST_DB_URL lane as test_content_guard_migration.py when a
branch database is configured.
"""

from __future__ import annotations

import re
from pathlib import Path

MIGRATIONS = (
    Path(__file__).resolve().parents[2]
    / "mt-eval-arena" / "supabase" / "migrations"
)
MIGRATION = MIGRATIONS / "051_run_cards_content_guard.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


class TestMigrationStructure:
    def test_migration_file_exists(self):
        assert MIGRATION.exists(), f"missing migration: {MIGRATION}"

    def test_trigger_fires_before_insert_and_update_per_row(self):
        sql = _sql()
        assert re.search(
            r"CREATE TRIGGER run_cards_content_guard\s+"
            r"BEFORE INSERT OR UPDATE ON run_cards\s+"
            r"FOR EACH ROW",
            sql,
        ), "guard must fire BEFORE INSERT OR UPDATE, per row, on run_cards"
        assert "DROP TRIGGER IF EXISTS run_cards_content_guard" in sql

    def test_reuses_033_license_classifier_without_redefining_it(self):
        sql = _sql()
        # The 033 function is CALLED (single license SSOT in SQL)…
        assert "is_license_redistributable(d_license)" in sql
        # …and never re-defined here — 033 stays the only definition.
        assert not re.search(
            r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+is_license_redistributable",
            sql,
            re.IGNORECASE,
        ), "051 must not redefine is_license_redistributable (033 is the SSOT)"

    def test_resolves_the_dataset_like_033(self):
        sql = _sql()
        assert "FROM datasets d" in sql
        assert "WHERE d.id = NEW.dataset_id" in sql


class TestDocumentedCaps:
    """The caps the migration header promises must appear in the SQL body."""

    def test_size_caps(self):
        sql = _sql()
        assert "1048576" in sql, "1 MB every-row cap"
        assert "262144" in sql, "256 KB non-cleared cap"

    def test_shape_caps(self):
        sql = _sql()
        assert "65536" in sql, "system_prompt_used 64 KB cap"
        assert "> 2000" in sql, "2000-char string-leaf cap"
        assert "> 512" in sql, "512-element array cap"
        assert "> 500" in sql, "500-char cap for strings in array-objects"
        assert "> 128" in sql, "128-char key cap"
        assert "> 32" in sql, "depth cap"

    def test_prompt_exemption_is_top_level_only(self):
        # The one long-text exemption must be path-anchored to the document
        # root — a nested {"anything": {"system_prompt_used": …}} smuggle
        # path gets the ordinary 2000-char leaf cap.
        assert re.search(
            r"path\s*=\s*'\$'\s*AND\s*k\s*=\s*'system_prompt_used'",
            _sql(),
        ), "system_prompt_used exemption must check path = '$'"

    def test_rejects_non_object_cards(self):
        assert "jsonb_typeof(NEW.run_card) <> 'object'" in _sql()


class TestNeighboringColumns:
    def test_text_columns_are_capped_too(self):
        sql = _sql()
        for col in (
            "submitter", "affirmation", "model_slug", "condition",
            "dataset_id", "language_pair", "harness_version",
            "fingerprint_hash", "api_provider", "method_class", "paradigm",
            "corpus_license", "corpus_attribution",
        ):
            assert f"['{col}'," in sql, (
                f"text column {col!r} must be in the cap table — the guard "
                "must not be sidestepped by stuffing a neighboring column"
            )


class TestIntakeParity:
    def test_card_cap_is_below_the_intake_body_cap(self):
        """The 10 MB submit-run body cap is for ENTRIES; the aggregate card
        itself must be bounded far below it (the H1 point)."""
        lib_ts = (
            MIGRATIONS.parent / "functions" / "submit-run" / "lib.ts"
        ).read_text(encoding="utf-8")
        m = re.search(r"MAX_BODY_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024", lib_ts)
        assert m, "submit-run lib.ts must declare MAX_BODY_BYTES"
        assert 1048576 < int(m.group(1)) * 1024 * 1024


# ---------------------------------------------------------------------------
# 063 — perf hoist of 051's content guard (DB6, launch review 2026-07-20).
# ---------------------------------------------------------------------------
# 051's guard called to_jsonb(NEW) once per column (~13x/row) + once per RAISE,
# re-serializing the <=1 MB run_card blob on every publish AND every verifier
# trust-update. 063 replaces the function with the whole-row JSONB hoisted to a
# single local. BEHAVIOUR is identical; only serialization cost changes.

MIGRATION_063 = MIGRATIONS / "063_run_cards_content_guard_perf.sql"


def _fn_body(sql: str) -> str:
    """The plpgsql body between the first ``AS $$`` and the last ``$$;`` — so
    doc-comment prose above the function never counts toward body assertions."""
    start = sql.index("AS $$")
    end = sql.rindex("$$;")
    return sql[start:end]


class TestContentGuardPerfHoist063:
    def test_migration_exists_and_replaces_the_guard_function(self):
        assert MIGRATION_063.exists(), f"missing DB6 migration: {MIGRATION_063}"
        sql = MIGRATION_063.read_text(encoding="utf-8")
        assert "CREATE OR REPLACE FUNCTION run_cards_content_guard_check()" in sql

    def test_to_jsonb_new_is_hoisted_to_exactly_one_call(self):
        """The whole DB6 point: to_jsonb(NEW) is computed ONCE, not per column."""
        body = _fn_body(MIGRATION_063.read_text(encoding="utf-8"))
        assert body.count("to_jsonb(NEW)") == 1, (
            "to_jsonb(NEW) must be serialized exactly once (hoisted); "
            f"found {body.count('to_jsonb(NEW)')} calls in the function body"
        )
        assert "card_json := to_jsonb(NEW);" in body, "the single hoist assignment"
        # The per-column loop and the RAISE must read the hoisted variable, never
        # re-serialize the row.
        assert "to_jsonb(NEW) ->>" not in body, (
            "063 must not index to_jsonb(NEW) directly — that is the ~13x cost DB6 removes"
        )
        assert body.count("card_json ->>") >= 2, (
            "the hoisted card_json must back both the column check and its RAISE"
        )

    def test_search_path_pin_is_preserved(self):
        """051 pinned SET search_path = public; a bare CREATE OR REPLACE would
        silently drop it and reintroduce advisor lint 0011."""
        sql = MIGRATION_063.read_text(encoding="utf-8")
        assert "SET search_path = public" in sql

    def test_all_guard_behavior_is_preserved_byte_for_byte(self):
        """Only the serialization is optimized — every cap, the object/size
        checks, the 033 license resolution, and the aggregate-only shape call
        survive unchanged."""
        sql = MIGRATION_063.read_text(encoding="utf-8")
        for tok in (
            "1048576",                                  # 1 MB every-row cap
            "262144",                                   # 256 KB non-cleared cap
            "jsonb_typeof(NEW.run_card) <> 'object'",   # object-only check
            "is_license_redistributable(d_license)",    # 033 resolution
            "run_card_shape_violation(NEW.run_card)",   # strict aggregate shape
        ):
            assert tok in sql, f"063 lost preserved guard behaviour: {tok!r}"
        # The 13 capped text columns must all remain.
        for col in (
            "submitter", "affirmation", "model_slug", "condition", "dataset_id",
            "language_pair", "harness_version", "fingerprint_hash", "api_provider",
            "method_class", "paradigm", "corpus_license", "corpus_attribution",
        ):
            assert f"['{col}'," in sql, f"063 dropped text-column cap for {col!r}"

    def test_does_not_touch_the_trigger_or_the_shape_walker(self):
        """CREATE OR REPLACE keeps the existing trigger bound; 051 stays the
        sole definer of run_card_shape_violation."""
        sql = MIGRATION_063.read_text(encoding="utf-8")
        assert "DROP TRIGGER" not in sql.upper()
        assert not re.search(
            r"CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+run_card_shape_violation",
            sql, re.IGNORECASE,
        ), "063 must not redefine run_card_shape_violation (051 is the SSOT)"
