"""The authorization_requests guard keeps EVERY rule across rewrites.

reject_illegal_request_transition() has been re-issued whole by 038, 074 and
075. Each rewrite replaces the function, so a rule left out of a later body is
silently gone. The first draft of 075 was written from 038's body and would
have dropped 074's closed-decision-record block on the live database; this
test makes whichever migration defines the function LAST carry all of them.
"""

from __future__ import annotations

import re
from pathlib import Path

MIG_DIR = Path(__file__).resolve().parents[2] / "mt-eval-arena" / "supabase" / "migrations"
FUNC = "CREATE OR REPLACE FUNCTION public.reject_illegal_request_transition()"


def _latest_body() -> tuple[str, str]:
    defining = sorted(p for p in MIG_DIR.glob("[0-9][0-9][0-9]_*.sql")
                      if FUNC in p.read_text(encoding="utf-8"))
    assert defining, "no migration defines reject_illegal_request_transition()"
    text = defining[-1].read_text(encoding="utf-8")
    start = text.index(FUNC)
    return defining[-1].name, text[start:text.index("$$;", start)]


def test_the_latest_guard_keeps_the_frozen_terms():
    name, body = _latest_body()
    for column in ("fingerprint", "method_sha", "corpus_id", "corpus_version",
                   "node_measurement", "sealed_set_id", "emit"):
        assert f"NEW.{column}" in body, f"{name} dropped the frozen term {column}"


def test_the_latest_guard_keeps_the_closed_decision_record():
    name, body = _latest_body()
    assert "OLD.decided_at IS NOT NULL" in body, f"{name} dropped 074's decided_at block"
    for column in ("request_id", "threshold", "requested_by", "created_at"):
        assert re.search(rf"NEW\.{column}\s+IS DISTINCT FROM OLD\.{column}", body), \
            f"{name} no longer freezes {column} after the decision"


def test_the_latest_guard_has_the_completed_edge_and_nothing_backward():
    name, body = _latest_body()
    assert "OLD.state = 'authorized' AND NEW.state IN ('expired', 'completed')" in body, name
    assert "OLD.state = 'pending' AND NEW.state IN ('authorized', 'denied', 'expired')" in body, name
