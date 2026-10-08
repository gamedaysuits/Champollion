"""retry_wait_seconds — graceful backoff that honors Retry-After.

This is the single source of truth for transient-error (429/5xx) backoff timing
across api.call_openrouter and every direct provider (openai/anthropic/gemini),
so rate-limit behavior can't diverge between them. Pure function, no network.
"""
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

from mt_eval_harness.api import RETRY_BASE_DELAY, RETRY_MAX_WAIT, retry_wait_seconds


def test_no_headers_uses_exponential_backoff():
    assert retry_wait_seconds(0) == min(RETRY_BASE_DELAY, RETRY_MAX_WAIT)
    assert retry_wait_seconds(2) == min(RETRY_BASE_DELAY * 4, RETRY_MAX_WAIT)


def test_missing_retry_after_falls_back():
    assert retry_wait_seconds(1, {}) == min(RETRY_BASE_DELAY * 2, RETRY_MAX_WAIT)
    assert retry_wait_seconds(1, None) == min(RETRY_BASE_DELAY * 2, RETRY_MAX_WAIT)


def test_retry_after_integer_seconds_is_honored():
    # Wait exactly as long as the server asks — even when that is LONGER than
    # the exponential would be (the whole point: don't re-hammer a 429).
    assert retry_wait_seconds(0, {"Retry-After": "5"}) == 5.0
    assert retry_wait_seconds(0, {"Retry-After": "30"}) == 30.0


def test_retry_after_is_capped():
    assert retry_wait_seconds(0, {"Retry-After": "9999"}) == RETRY_MAX_WAIT


def test_retry_after_garbage_falls_back_to_exponential():
    assert retry_wait_seconds(1, {"Retry-After": "soon"}) == min(
        RETRY_BASE_DELAY * 2, RETRY_MAX_WAIT
    )


def test_retry_after_http_date_future_is_honored():
    future = datetime.now(timezone.utc) + timedelta(seconds=10)
    w = retry_wait_seconds(0, {"Retry-After": format_datetime(future)})
    assert 5 <= w <= 12  # ~10s minus tiny execution slack, within the cap


def test_retry_after_http_date_in_past_falls_back():
    past = datetime.now(timezone.utc) - timedelta(seconds=60)
    assert retry_wait_seconds(0, {"Retry-After": format_datetime(past)}) == min(
        RETRY_BASE_DELAY, RETRY_MAX_WAIT
    )
