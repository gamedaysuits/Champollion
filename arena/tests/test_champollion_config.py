"""
Tests for champollion_config — the harness ↔ champollion.config.json bridge.

Regression guarded here: the cards-directory auto-detect used to walk up
from CWD looking for `shared/language-cards/`, but the monorepo keeps cards
at `cli/shared/language-cards/`. From the monorepo root the old finder
returned None, so `load_champollion_config()` raised FileNotFoundError
unless the caller passed --champollion-cards-dir explicitly. The finder now
delegates to language_cards._find_cards_dir() (the SSOT), which knows the
real layout.
"""

from pathlib import Path

import pytest

from mt_eval_harness import champollion_config
from mt_eval_harness import language_cards

# tests/ -> arena/ -> <monorepo root>
MONOREPO_ROOT = Path(__file__).resolve().parent.parent.parent

# These tests assert the monorepo layout (cards at cli/shared/language-cards/).
# In a standalone / public-mirror checkout that directory doesn't exist (cards
# come from a bundled or npm-installed registry instead), so skip rather than
# fail there.
_MONOREPO_CARDS = MONOREPO_ROOT / "cli" / "shared" / "language-cards"
pytestmark = pytest.mark.skipif(
    not _MONOREPO_CARDS.is_dir(),
    reason="monorepo cli/shared/language-cards/ not present (standalone checkout)",
)


def test_find_cards_dir_succeeds_from_monorepo_root(monkeypatch):
    """Auto-detect must find the cards dir when CWD is the monorepo root."""
    monkeypatch.chdir(MONOREPO_ROOT)
    # This test is about AUTO-detection. Under the projected-corpus test-drive
    # the env override points at build/atlas/cards-language, which is the
    # opposite of what is being tested — remove it for this test only.
    monkeypatch.delenv("CHAMPOLLION_CARDS_DIR", raising=False)
    monkeypatch.delenv("MT_EVAL_CARDS_DIR", raising=False)

    found = champollion_config._find_cards_dir()

    assert found is not None, (
        "champollion_config._find_cards_dir() returned None from the monorepo "
        "root — the cards live at cli/shared/language-cards/, not shared/language-cards/."
    )
    assert found.is_dir()
    # Must be the real monorepo cards directory under cli/shared/.
    assert found.name == "language-cards"
    assert found.parent.name == "shared"
    assert found.parent.parent.name == "cli"


def test_find_cards_dir_delegates_to_ssot(monkeypatch):
    """The config finder must agree with the language_cards SSOT finder."""
    monkeypatch.chdir(MONOREPO_ROOT)

    assert champollion_config._find_cards_dir() == language_cards._find_cards_dir()


def test_load_config_auto_detects_cards_without_explicit_dir(monkeypatch, tmp_path):
    """End-to-end: load_champollion_config() resolves cards with no cards_dir.

    Before the fix this raised FileNotFoundError for the cards directory when
    run from the monorepo root.
    """
    monkeypatch.chdir(MONOREPO_ROOT)

    config_path = tmp_path / "champollion.config.json"
    config_path.write_text('{"sourceLocale": "en", "languages": ["fr"]}', encoding="utf-8")

    # Should not raise FileNotFoundError for the cards directory.
    rc = champollion_config.load_champollion_config(config_path, "fr")

    assert rc.target_lang_code == "fr"
    assert rc.target_lang_name  # a card was found and a name resolved
