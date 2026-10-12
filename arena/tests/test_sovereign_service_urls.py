"""The three characters that TRUNCATE a PostgREST URL client-side.

`service_request` builds filters by hand ("id=eq.x", "select=a,b",
"order=created_at.asc") because the operators and commas are meaningful, so
values are not blanket-encoded. But '#' starts a fragment, '?' a second query
and a raw space ends the URL — a value carrying one of those does not
mis-filter, it addresses a DIFFERENT row.

Measured 2026-09-07 in the air-gap rehearsal: the holdout's deferred-result
key was "<request_id>#holdout", the server only ever saw "<request_id>", every
read keyed on it came back with the MAIN result, and the holdout insert then
failed as a bogus "already has a withheld result" conflict. Both halves are
pinned here — the encoding, and the key that no longer needs it.
"""

from __future__ import annotations

import re

import pytest

from mt_eval_harness import sovereign_service
from mt_eval_harness.sandbox_runner import (
    HOLDOUT_DEFER_SUFFIX,
    holdout_defer_key,
)


class _Captured(Exception):
    pass


@pytest.fixture
def captured_url(monkeypatch):
    seen: dict = {}

    def fake_urlopen(req, timeout=None):
        seen["url"] = req.full_url
        raise _Captured()

    monkeypatch.setattr(sovereign_service, "assert_not_prod", lambda: None)
    monkeypatch.setattr(sovereign_service, "service_key", lambda: "svc-key")
    monkeypatch.setattr(sovereign_service.urllib.request, "urlopen",
                        fake_urlopen)

    def call(params):
        with pytest.raises((_Captured, RuntimeError)):
            sovereign_service.service_request(
                "GET", "contest_deferred_results", params=params)
        return seen["url"]

    return call


class TestFilterValuesCannotTruncateTheUrl:
    def test_hash_is_encoded(self, captured_url):
        url = captured_url({"request_id": "eq.authreq-abc~holdout"})
        assert "#" not in url
        url = captured_url({"request_id": "eq.authreq-abc#holdout"})
        assert "%23holdout" in url
        assert "#" not in url

    def test_question_mark_and_space_are_encoded(self, captured_url):
        url = captured_url({"notes": "eq.who? me"})
        assert "%3F" in url and "%20" in url
        # exactly one '?' — the one that starts the query string
        assert url.count("?") == 1

    def test_percent_is_encoded_first(self, captured_url):
        # Otherwise "%23" typed by a caller would decode to '#' server-side.
        url = captured_url({"request_id": "eq.a%23b"})
        assert "%2523b" in url

    def test_operators_and_commas_are_left_alone(self, captured_url):
        url = captured_url({"select": "request_id,role,run_card_row",
                            "order": "deferred_at.asc"})
        assert "select=request_id,role,run_card_row" in url
        assert "order=deferred_at.asc" in url


class TestHoldoutDeferKeyIsUrlSafe:
    def test_suffix_carries_no_url_delimiter(self):
        assert HOLDOUT_DEFER_SUFFIX == "~holdout"
        assert not re.search(r"[#?%&\s]", HOLDOUT_DEFER_SUFFIX)

    def test_key_is_the_request_id_plus_the_suffix(self):
        key = holdout_defer_key("authreq-1234")
        assert key == "authreq-1234~holdout"
        assert not re.search(r"[#?%&\s]", key)
