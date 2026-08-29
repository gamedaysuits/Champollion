"""
Tests for mt_eval_harness.auth — environment overrides for the Supabase
endpoint configuration.

Covers:
    - Defaults: without env vars, the production URL/key are used
      (zero behavior change).
    - MT_EVAL_SUPABASE_URL / MT_EVAL_SUPABASE_ANON_KEY overrides
    - MT_EVAL_TOKEN_PATH override for the session token file

The module-level constants are read from the environment at import time,
so these tests reload the module under a patched environment and restore
the original module state afterwards.
"""

import importlib
from pathlib import Path

import pytest

from mt_eval_harness import auth

PROD_URL = "https://sjdomynysdljkbemupqa.supabase.co"
PROD_ANON_KEY = "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp"


@pytest.fixture
def reload_auth(monkeypatch):
    """Yield a reloader for the auth module; restore defaults afterwards."""

    def _reload():
        return importlib.reload(auth)

    yield _reload

    # Restore the module to its env-free default state for other tests.
    monkeypatch.delenv("MT_EVAL_SUPABASE_URL", raising=False)
    monkeypatch.delenv("MT_EVAL_SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("MT_EVAL_TOKEN_PATH", raising=False)
    importlib.reload(auth)


class TestSupabaseEnvOverrides:
    """MT_EVAL_SUPABASE_* env vars override the embedded prod values."""

    def test_defaults_without_env(self, monkeypatch, reload_auth):
        monkeypatch.delenv("MT_EVAL_SUPABASE_URL", raising=False)
        monkeypatch.delenv("MT_EVAL_SUPABASE_ANON_KEY", raising=False)
        monkeypatch.delenv("MT_EVAL_TOKEN_PATH", raising=False)
        mod = reload_auth()
        assert mod.SUPABASE_URL == PROD_URL
        assert mod.SUPABASE_ANON_KEY == PROD_ANON_KEY
        assert mod.TOKEN_PATH == Path.home() / ".mt-eval" / "auth.json"

    def test_url_override(self, monkeypatch, reload_auth):
        monkeypatch.setenv(
            "MT_EVAL_SUPABASE_URL", "https://staging.example.supabase.co"
        )
        mod = reload_auth()
        assert mod.SUPABASE_URL == "https://staging.example.supabase.co"
        # Key stays at default when only the URL is overridden
        assert mod.SUPABASE_ANON_KEY == PROD_ANON_KEY

    def test_anon_key_override(self, monkeypatch, reload_auth):
        monkeypatch.setenv("MT_EVAL_SUPABASE_ANON_KEY", "sb_test_key_123")
        mod = reload_auth()
        assert mod.SUPABASE_ANON_KEY == "sb_test_key_123"
        assert mod.SUPABASE_URL == PROD_URL

    def test_token_path_override(self, monkeypatch, reload_auth, tmp_path):
        custom = tmp_path / "auth.staging.json"
        monkeypatch.setenv("MT_EVAL_TOKEN_PATH", str(custom))
        mod = reload_auth()
        assert mod.TOKEN_PATH == custom

    def test_publish_imports_from_auth(self):
        """publish.py must source its endpoint from auth so the override
        propagates everywhere (it imports the constants by name)."""
        import inspect

        from mt_eval_harness import publish

        src = inspect.getsource(publish)
        assert "from mt_eval_harness.auth import" in src
        # No second hardcoded endpoint in publish.py
        assert PROD_URL not in src
