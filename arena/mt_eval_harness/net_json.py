"""
Strict JSON parsing for the harness's remote endpoints.

Several endpoints the harness depends on (champollion.dev/queue.json, the
remote dataset registry, the Supabase language-card REST API) MUST serve
JSON. When a host is gated, down, or fronted by a holding page, it can
answer HTTP 200 with an HTML document instead — and a raw
``json.JSONDecodeError`` traceback tells the contributor nothing actionable.
This module turns that failure into a typed error every fetch site can
render as a clear one-line message.

Shared by ``queue_runner.load_queue``, ``config._load_remote_registry``, and
``language_cards_remote._get_json``. No internal imports — safe anywhere.
"""

from __future__ import annotations

import json
from typing import Any


class NotJSONResponseError(ValueError):
    """An endpoint that must serve JSON returned something else.

    ``got`` is a short human phrase for what came back ("an HTML page",
    "a non-JSON response") — callers splice it into their own one-line
    error messages. Subclasses ValueError so existing
    ``except (..., ValueError)`` degradation paths keep working.
    """

    def __init__(self, message: str, *, got: str):
        super().__init__(message)
        self.got = got


def _looks_like_html(text: str) -> bool:
    """Heuristic: does this body look like an HTML document?"""
    head = text.lstrip()[:256].lower()
    return head.startswith(("<!doctype", "<html", "<head", "<body", "<?xml",
                            "<script", "<meta", "<title")) or "<html" in head


def parse_json_response(
    body: bytes | str,
    *,
    content_type: str | None = None,
    source: str = "",
) -> Any:
    """Parse an HTTP response body that is required to be JSON.

    Raises :class:`NotJSONResponseError` (a ValueError) when the declared
    Content-Type is HTML or the body does not parse as JSON — with a
    ``.got`` phrase distinguishing an HTML holding page from other garbage,
    so the caller's error can say "the site may be gated or down" instead
    of dumping a JSONDecodeError position.
    """
    text = (body.decode("utf-8", errors="replace")
            if isinstance(body, bytes) else body)
    where = f" from {source}" if source else ""
    if content_type and "html" in content_type.lower():
        raise NotJSONResponseError(
            f"expected JSON{where} but got an HTML page "
            f"(Content-Type: {content_type})",
            got="an HTML page",
        )
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        got = "an HTML page" if _looks_like_html(text) else "a non-JSON response"
        raise NotJSONResponseError(
            f"expected JSON{where} but got {got}", got=got,
        ) from exc
