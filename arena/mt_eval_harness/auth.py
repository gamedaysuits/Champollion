"""
OAuth PKCE authentication for the mt-eval harness.

Supports GitHub and Google sign-in via Supabase Auth.
Tokens are stored locally in ~/.mt-eval/auth.json.

Security model:
    - The Supabase anon key (SUPABASE_ANON_KEY) is public and read-only.
      It's the same key embedded in the website frontend.
    - User identity is established via OAuth (GitHub or Google).
    - The resulting JWT grants INSERT permission via RLS policies
      on the run_cards table (authenticated users only).
    - No service role key is ever distributed to end users.
"""

from __future__ import annotations

import base64
import logging
import hashlib
import http.server
import json
import os
import secrets
import sys
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase public config
# These are safe to embed — identical to the values in the website frontend.
# The anon key only grants read access; writes require a valid user JWT.
#
# Both values are env-overridable so the harness can publish to a
# non-production Supabase project (e.g. a staging branch) without code
# changes. Without the env vars, behavior is identical to before:
#   MT_EVAL_SUPABASE_URL       — overrides the project URL
#   MT_EVAL_SUPABASE_ANON_KEY  — overrides the anon/publishable key
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get(
    "MT_EVAL_SUPABASE_URL",
    "https://sjdomynysdljkbemupqa.supabase.co",
)
SUPABASE_ANON_KEY = os.environ.get(
    "MT_EVAL_SUPABASE_ANON_KEY",
    "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp",
)

# Where we persist the user's refresh token between sessions.
# Env-overridable (MT_EVAL_TOKEN_PATH) so scripted/staging publishes can
# use a separate credential file without touching the default session.
TOKEN_PATH = Path(
    os.environ.get("MT_EVAL_TOKEN_PATH", str(Path.home() / ".mt-eval" / "auth.json"))
)


# ---------------------------------------------------------------------------
# PKCE helpers
# ---------------------------------------------------------------------------

def _generate_pkce() -> tuple[str, str]:
    """Generate a PKCE code verifier and challenge.

    Returns:
        (code_verifier, code_challenge) tuple.
    """
    verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ---------------------------------------------------------------------------
# Token persistence
# ---------------------------------------------------------------------------

def _save_tokens(session: dict) -> None:
    """Write session tokens to disk with owner-only permissions."""
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(json.dumps(session, indent=2), encoding="utf-8")
    os.chmod(TOKEN_PATH, 0o600)


def _load_tokens() -> dict | None:
    """Load saved session tokens, or None if not found / corrupt."""
    if not TOKEN_PATH.exists():
        return None
    try:
        return json.loads(TOKEN_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# ---------------------------------------------------------------------------
# Supabase Auth API calls
# ---------------------------------------------------------------------------

def _refresh_session(refresh_token: str) -> dict:
    """Exchange a refresh token for a new access token."""
    data = json.dumps({"refresh_token": refresh_token}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
        data=data,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def _exchange_code(code: str, code_verifier: str, redirect_uri: str) -> dict:
    """Exchange an OAuth authorization code + PKCE verifier for tokens.

    Per RFC 7636, the redirect_uri must match the one used in the
    original authorization request.
    """
    data = json.dumps({
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": redirect_uri,
    }).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=pkce",
        data=data,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# Local callback server
# ---------------------------------------------------------------------------

class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Minimal HTTP handler that captures the OAuth redirect."""

    auth_code: str | None = None
    error_message: str | None = None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            _CallbackHandler.auth_code = params["code"][0]
            self._respond(200, (
                "<h1>✅ Authenticated!</h1>"
                "<p>You can close this tab and return to the terminal.</p>"
            ))
        else:
            msg = params.get("error_description", ["Unknown error"])[0]
            _CallbackHandler.error_message = msg
            self._respond(400, f"<h1>❌ Error</h1><p>{msg}</p>")

    def _respond(self, code: int, body: str):
        html = (
            f'<html><body style="font-family:system-ui;text-align:center;'
            f'padding:4rem;color:#e0e0e0;background:#1a1a2e;">{body}</body></html>'
        )
        self.send_response(code)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        """Suppress default request logging."""
        pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_session() -> dict:
    """Get a valid Supabase session, refreshing or prompting login as needed.

    Returns:
        Session dict with 'access_token', 'refresh_token', and 'user'.

    Raises:
        SystemExit if authentication fails or the user cancels.
    """
    # Headless path (no browser): a refresh token from the environment lets a
    # server / container / CI authenticate without the interactive browser flow.
    # Sign in once on a machine with a browser (`mt-eval` interactively), copy
    # "refresh_token" from ~/.mt-eval/auth.json, and set MT_EVAL_REFRESH_TOKEN
    # on the headless box. Long-lived, so a donor sets it once.
    env_refresh = os.environ.get("MT_EVAL_REFRESH_TOKEN")
    if env_refresh:
        try:
            session = _refresh_session(env_refresh)
            _save_tokens(session)
            print(f"  Authenticated as {_extract_identity(session.get('user', {}))} (via MT_EVAL_REFRESH_TOKEN)")
            return session
        except Exception as e:
            raise SystemExit(
                f"MT_EVAL_REFRESH_TOKEN was set but the refresh failed ({e}). "
                "The token may have expired — re-copy \"refresh_token\" from "
                "~/.mt-eval/auth.json on a machine where you've signed in."
            )

    tokens = _load_tokens()

    # Reuse a still-valid access token as-is. Batch callers (e.g.
    # publish_all_reports.py) hit get_session once per report; refreshing
    # unconditionally rotates the refresh token on every call and trips
    # Supabase Auth's token-endpoint rate limit, stranding the batch.
    if tokens and tokens.get("access_token"):
        try:
            if float(tokens.get("expires_at", 0)) - time.time() > 60:
                return tokens
        except (TypeError, ValueError):
            pass  # malformed expires_at — fall through to refresh

    # Try refreshing an existing session first
    if tokens and tokens.get("refresh_token"):
        try:
            session = _refresh_session(tokens["refresh_token"])
            _save_tokens(session)
            user = session.get("user", {})
            identity = _extract_identity(user)
            print(f"  Authenticated as {identity}")
            return session
        except Exception as e:
            logger.debug(
                "Token refresh failed (will prompt for login): %s", e
            )

    # The interactive flow needs a human at a terminal; in batch/CI contexts
    # fail fast instead of EOFError-ing on input().
    if not sys.stdin.isatty():
        raise SystemExit(
            "Authentication required, but this is a non-interactive shell "
            "(no browser for the sign-in flow).\n"
            "  Headless donors: on a machine with a browser, sign in once "
            "(run `mt-eval` interactively), then copy \"refresh_token\" from "
            "~/.mt-eval/auth.json and set it here:\n"
            "      export MT_EVAL_REFRESH_TOKEN=<that token>\n"
            "  (Or copy the whole ~/.mt-eval/auth.json over, or run with "
            "--no-publish to skip publishing.)"
        )

    return _interactive_login()


def get_cached_session() -> dict | None:
    """Return a session from NON-INTERACTIVE credentials only, or None.

    Tries, in order: MT_EVAL_REFRESH_TOKEN (headless donors), a still-valid
    cached access token, then a cached refresh token. Never opens a browser
    and never prompts — callers wanting the interactive flow use
    ``get_session()``. The queue runner's publishing door uses this to keep
    returning donors attributed without re-prompting, while a first-time
    non-interactive run (curl | bash) falls through to the anonymous lane
    instead of dying on "authentication required".
    """
    env_refresh = os.environ.get("MT_EVAL_REFRESH_TOKEN")
    if env_refresh:
        try:
            session = _refresh_session(env_refresh)
            _save_tokens(session)
            return session
        except Exception as e:
            logger.debug("MT_EVAL_REFRESH_TOKEN refresh failed: %s", e)
            return None

    tokens = _load_tokens()
    if not tokens:
        return None

    # Reuse a still-valid access token as-is (same rationale as get_session:
    # unconditional refreshes rotate the token and trip the rate limit).
    if tokens.get("access_token"):
        try:
            if float(tokens.get("expires_at", 0)) - time.time() > 60:
                return tokens
        except (TypeError, ValueError):
            pass  # malformed expires_at — fall through to refresh

    if tokens.get("refresh_token"):
        try:
            session = _refresh_session(tokens["refresh_token"])
            _save_tokens(session)
            return session
        except Exception as e:
            logger.debug("cached-token refresh failed: %s", e)

    return None


def get_submitter_name(session: dict) -> str:
    """Extract a human-readable submitter name from a session.

    Priority: GitHub username > Google name > email. DISPLAY ONLY — any
    value an RLS policy compares against the JWT (contest_intake.submitted_by,
    storage folder paths) must use get_submitter_email() instead.
    """
    return _extract_identity(session.get("user", {}))


def get_submitter_email(session: dict) -> str:
    """The JWT email claim — the identity RLS binds to (043 contest_intake
    INSERT, 044 storage folder paths). A display identity (GitHub username /
    Google full name) would be refused by those policies. Fails loud when
    absent so nothing is uploaded under an identity that cannot insert.
    """
    email = ((session.get("user") or {}).get("email") or "").strip()
    if not email:
        raise RuntimeError(
            "Your session has no email claim — submission policies bind to "
            "the JWT email. Re-authenticate (mt-eval login).")
    return email


def logout() -> None:
    """Remove stored tokens."""
    if TOKEN_PATH.exists():
        TOKEN_PATH.unlink()
        print("  Logged out. Stored tokens removed.")
    else:
        print("  Not logged in.")


# ---------------------------------------------------------------------------
# Interactive login flow
# ---------------------------------------------------------------------------

def _interactive_login() -> dict:
    """Prompt the user to choose a provider and run the OAuth PKCE flow."""
    print("\n  No saved credentials. Sign in to publish results.\n")
    print("  Choose a provider:")
    print("    [1] GitHub")
    print("    [2] Google")

    choice = input("\n  > ").strip()

    provider_map = {"1": "github", "2": "google"}
    provider = provider_map.get(choice)
    if not provider:
        print("  Invalid choice. Use 1 or 2.")
        raise SystemExit(1)

    return _oauth_login(provider)


def _oauth_login(provider: str) -> dict:
    """Run the full OAuth PKCE flow for a given provider.

    1. Start a local HTTP server on a random port
    2. Open the browser to Supabase's /authorize endpoint
    3. Wait for the redirect callback with the auth code
    4. Exchange the code + PKCE verifier for session tokens
    """
    verifier, challenge = _generate_pkce()

    # Ephemeral local server on a random available port
    server = http.server.HTTPServer(("127.0.0.1", 0), _CallbackHandler)
    port = server.server_address[1]
    redirect_uri = f"http://localhost:{port}/callback"

    # Build the Supabase authorize URL
    params = urllib.parse.urlencode({
        "provider": provider,
        "redirect_to": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    auth_url = f"{SUPABASE_URL}/auth/v1/authorize?{params}"

    print(f"\n  Opening browser for {provider.title()} sign-in...")
    try:
        webbrowser.open(auth_url)
    except Exception:
        pass
    # Always print the URL: webbrowser.open() silently no-ops on a headless
    # box, and the contributor needs a way to complete sign-in manually.
    print("  If the browser didn't open, paste this URL into a browser on")
    print(f"  THIS machine:\n    {auth_url}")

    # Wait for the callback, with an overall deadline so a browser-less /
    # headless machine fails cleanly instead of looping forever (the old
    # 120s server.timeout only bounded a single handle_request(), not the
    # loop — with no request it spun indefinitely).
    _CallbackHandler.auth_code = None
    _CallbackHandler.error_message = None
    server.timeout = 1  # short poll so the deadline is actually checked
    deadline = time.time() + 180

    while (_CallbackHandler.auth_code is None
           and _CallbackHandler.error_message is None):
        if time.time() > deadline:
            server.server_close()
            raise SystemExit(
                "\n  Sign-in timed out after 3 minutes (no redirect "
                "received).\n  This usually means no browser is available on "
                "this machine.\n  Sign in once on a machine with a browser "
                "(tokens cache to\n  ~/.mt-eval/auth.json and are reused), or "
                "re-run there."
            )
        server.handle_request()

    server.server_close()

    if _CallbackHandler.error_message:
        print(f"\n  Authentication error: {_CallbackHandler.error_message}")
        raise SystemExit(1)

    code = _CallbackHandler.auth_code

    # Exchange the authorization code for tokens
    try:
        session = _exchange_code(code, verifier, redirect_uri)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        print(f"\n  Token exchange failed ({exc.code}): {body}")
        raise SystemExit(1)

    _save_tokens(session)

    user = session.get("user", {})
    identity = _extract_identity(user)
    print(f"\n  ✅ Authenticated as {identity}")

    return session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_identity(user: dict) -> str:
    """Pull the best available display name from the Supabase user object."""
    meta = user.get("user_metadata", {})
    return (
        meta.get("preferred_username")   # GitHub username
        or meta.get("user_name")         # GitHub fallback
        or meta.get("full_name")         # Google display name
        or user.get("email", "anonymous")
    )
