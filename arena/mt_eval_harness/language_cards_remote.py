"""
Remote language-card source — read-only access to the production Supabase
trading-card tables, used by language_cards.py when no local card directory
is present (a standalone ``pip install mt-eval-harness``).

This is the Python counterpart of ``cli/lib/cards/remote.js``. The project's
rule is **dynamic-from-source + fail-loud, never a baked-in stale copy**: the
harness ships NO bundled cards, fetches them live from Supabase, and raises
loudly when the source is unreachable rather than silently degrading to an
empty index (the bug this replaces).

TABLES (mt-eval-arena/supabase/migrations/012 + 032):
  trading_card_index   — one compact row per language. After migration 032 it
                         carries the resolution identity the harness needs to
                         build code→/alias→/name→ lookups WITHOUT pulling every
                         heavyweight detail blob: code, name, aliases, iso639_1.
  trading_card_detail  — { code, detail JSONB }. After the build-script change
                         in build-trading-card-data.mjs, ``detail`` is a
                         complete, ``extends``-resolved card projection (carries
                         methodSupport, resources incl. fsts, formality,
                         registers, metricModelSupport, evalPack/evalStandard/
                         evalMetrics, scoringProfile, …). Fetched lazily per code
                         by get_card().

Access is anon-key, SELECT-only (enforced by RLS). This module never writes.
Network/5xx errors RAISE (a failed read is not "no card"); a definitive
empty/404 result returns None ("this language genuinely has no card").
"""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

# Reuse the harness's single SSOT for the Supabase endpoint + public anon key
# (env-overridable via MT_EVAL_SUPABASE_URL / MT_EVAL_SUPABASE_ANON_KEY). Do NOT
# introduce a second spelling of these.
from mt_eval_harness.auth import SUPABASE_URL, SUPABASE_ANON_KEY

logger = logging.getLogger(__name__)

_REST_BASE = f"{SUPABASE_URL}/rest/v1"

# PostgREST caps a single response at 1000 rows on Supabase — paginate.
_MAX_PAGE = 1000

# Card codes are ISO 639-3 (3 letters), optionally with a region subtag
# (e.g. "fr-CA"), plus the curated parent codes. Validate before building a
# query so a malformed code can never be interpolated into a REST URL.
_VALID_CODE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})?$")


class LanguageCardsUnavailable(RuntimeError):
    """Raised when the language-card source cannot be reached.

    This is the fail-loud signal the design mandates: when there is no local
    card directory AND Supabase is unreachable (and the harness is not
    explicitly air-gapped with a local dir), the harness must stop with a clear
    error rather than continue against an empty, fabricated index.

    Deliberately NOT a subclass of FileNotFoundError — callers that catch
    FileNotFoundError for "no local cards" must not silently swallow a genuine
    source outage.
    """


def is_valid_card_code(code: str) -> bool:
    """True if ``code`` is shaped like a card code (safe to put in a query)."""
    return bool(code) and bool(_VALID_CODE.match(code))


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Accept": "application/json",
    }


def _get_json(url: str, *, timeout: float, retries: int = 2) -> Any:
    """GET a REST URL and parse JSON, with bounded retries.

    4xx responses raise immediately (they won't heal). A non-JSON body (e.g.
    an HTML holding page served over HTTP 200 while the host is gated or
    down) also raises immediately — as LanguageCardsUnavailable with a clear
    one-line reason, since retrying won't turn HTML into JSON. 5xx and
    network errors are retried with linear backoff; if they persist, the
    last error is raised (wrapped by the caller into LanguageCardsUnavailable
    where appropriate).
    """
    from mt_eval_harness.net_json import NotJSONResponseError, parse_json_response
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers=_headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content_type = resp.headers.get("Content-Type", "")
                body = resp.read()
            try:
                return parse_json_response(body, content_type=content_type,
                                           source=url)
            except NotJSONResponseError as exc:
                raise LanguageCardsUnavailable(
                    f"{url} is not serving JSON (got {exc.got}) — the card "
                    f"source may be gated or down; try again later or use a "
                    f"local cards directory."
                ) from exc
        except urllib.error.HTTPError as exc:
            # 4xx won't heal (bad request / auth / RLS) — surface immediately.
            if 400 <= exc.code < 500:
                raise
            last_err = exc
        except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError) as exc:
            last_err = exc
        if attempt < retries:
            time.sleep(0.5 * (attempt + 1))
    assert last_err is not None
    raise last_err


def fetch_index_rows(*, timeout: float = 30.0) -> list[dict[str, Any]]:
    """Fetch every trading_card_index row (paginated), for the resolution index.

    Selects only the resolution-identity columns (compact). Raises
    LanguageCardsUnavailable on a failed read — a read failure is NOT an empty
    catalogue, and silently continuing would rebuild the harness atop an empty,
    fabricated index (the precedent: generate_sweep_queue.py — "a failed read
    is not an empty board").
    """
    rows: list[dict[str, Any]] = []
    offset = 0
    try:
        while True:
            params = urllib.parse.urlencode({
                "select": "code,name,aliases,iso639_1",
                "order": "code.asc",
                "limit": str(_MAX_PAGE),
                "offset": str(offset),
            })
            page = _get_json(f"{_REST_BASE}/trading_card_index?{params}", timeout=timeout)
            if not isinstance(page, list):
                raise LanguageCardsUnavailable(
                    f"Unexpected trading_card_index response shape: {type(page).__name__}"
                )
            rows.extend(page)
            if len(page) < _MAX_PAGE:
                break
            offset += _MAX_PAGE
    except LanguageCardsUnavailable:
        raise
    except Exception as exc:  # network / HTTP / parse
        raise LanguageCardsUnavailable(
            f"Could not fetch the language-card index from {_REST_BASE}"
            f"/trading_card_index ({exc.__class__.__name__}: {exc})."
        ) from exc

    if not rows:
        # An empty catalogue from a successful query is itself a fail-loud
        # condition: prod always has ~8k rows. Zero means a misconfigured
        # endpoint/RLS, not a legitimate state to build a harness on.
        raise LanguageCardsUnavailable(
            f"The language-card index at {_REST_BASE}/trading_card_index "
            "returned zero rows. Refusing to run on an empty card catalogue."
        )
    return rows


def fetch_detail_card(code: str, *, timeout: float = 15.0) -> dict[str, Any] | None:
    """Fetch one card's full detail blob (the resolved card), or None if absent.

    Returns the ``detail`` JSONB (already card-shaped and ``extends``-resolved
    by the build script) for ``code``. Returns None when the language genuinely
    has no row (definitive "no card"). Raises LanguageCardsUnavailable on a
    network/server error — we must never report "no card" because of an outage.
    """
    if not is_valid_card_code(code):
        return None
    params = urllib.parse.urlencode({
        "select": "code,detail",
        "code": f"eq.{code}",
        "limit": "1",
    })
    try:
        rows = _get_json(f"{_REST_BASE}/trading_card_detail?{params}", timeout=timeout)
    except LanguageCardsUnavailable:
        raise  # already a clear one-line reason (e.g. HTML holding page)
    except Exception as exc:
        raise LanguageCardsUnavailable(
            f"Could not fetch language card {code!r} from "
            f"{_REST_BASE}/trading_card_detail ({exc.__class__.__name__}: {exc})."
        ) from exc
    if not isinstance(rows, list) or not rows:
        return None  # definitive: no such card
    detail = rows[0].get("detail")
    if not isinstance(detail, dict):
        return None
    return detail
