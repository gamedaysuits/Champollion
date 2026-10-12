"""
Tests for champollion_config — the retired lane (0.2.0) and what went with it.

Also guarded here:

- The cards-directory auto-detect used to walk up from CWD looking for
  `shared/language-cards/`, but the monorepo keeps cards at
  `cli/shared/language-cards/`, so from the monorepo root it returned None.
  Card discovery lives in language_cards._find_cards_dir() (the SSOT).
- Analysis used to auto-load DoublePassCompliancePlugin when the target's card
  had a `rules` field, through a private reader that parsed every card file on
  each call. The atlas cutover dropped `rules` from every card, so the load was
  dead; it was removed with the reader, and --champollion-cards-dir (which only
  fed it) is refused.
"""

import json
from pathlib import Path

import pytest

from mt_eval_harness import champollion_config
from mt_eval_harness import language_cards

# tests/ -> arena/ -> <monorepo root>
MONOREPO_ROOT = Path(__file__).resolve().parent.parent.parent
_MONOREPO_CARDS = MONOREPO_ROOT / "cli" / "shared" / "language-cards"


# ---------------------------------------------------------------------------
# Card discovery (the SSOT finder)
# ---------------------------------------------------------------------------

# In a standalone / public-mirror checkout the monorepo cards directory doesn't
# exist (cards come from an npm-installed or hosted registry instead), so skip
# rather than fail there.
@pytest.mark.skipif(
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

    found = language_cards._find_cards_dir()

    assert found is not None, (
        "language_cards._find_cards_dir() returned None from the monorepo "
        "root — the cards live at cli/shared/language-cards/, not shared/language-cards/."
    )
    assert found.is_dir()
    assert found.name == "language-cards"
    assert found.parent.name == "shared"
    assert found.parent.parent.name == "cli"


# ---------------------------------------------------------------------------
# The retired lane (0.2.0): importable, refused, and says what to use instead
# ---------------------------------------------------------------------------

def test_retired_entry_points_raise_with_the_replacement():
    from mt_eval_harness.plugins.champollion_prompts import ChampollionPromptProvider
    import mt_eval_harness as harness
    for call in (lambda: harness.load_champollion_config("c.json", "fr"),
                 lambda: harness.build_champollion_system_prompt(None),
                 lambda: harness.ChampollionRunConfig(),
                 lambda: ChampollionPromptProvider()):
        with pytest.raises(champollion_config.RetiredLaneError, match="export-config"):
            call()


@pytest.mark.parametrize("kw", [{"prompt_version": "champollion"},
                                {"champollion_config_path": "champollion.config.json"}])
def test_run_config_refuses_the_retired_lane(kw):
    from mt_eval_harness.config import RunConfig
    cfg = RunConfig(dataset="all", corpus_path="", model="google/gemini-3.5-flash", **kw)
    assert champollion_config.RETIRED_MESSAGE in cfg.validate()


def test_old_command_line_still_parses_and_is_then_refused():
    from mt_eval_harness.cli import args_to_config, build_parser
    args = build_parser().parse_args(
        ["run", "--corpus", "x.json", "--champollion-config", "c.json",
         "--target-lang-code", "fr"])
    cfg = args_to_config(args)
    assert champollion_config.RETIRED_MESSAGE in cfg.validate()


# ---------------------------------------------------------------------------
# The private card reader and the compliance auto-load it served (0.2.0)
# ---------------------------------------------------------------------------

def test_private_card_reader_is_gone():
    """Card reads go through language_cards; the module keeps no reader of its own."""
    for name in ("load_language_card", "deep_merge_cards", "_find_cards_dir"):
        assert not hasattr(champollion_config, name), (
            f"champollion_config.{name} is back — a private card reader. "
            "Read cards through mt_eval_harness.language_cards."
        )


def test_analysis_never_autoloads_compliance_from_a_card(tmp_path, monkeypatch):
    """A card carrying `rules` must not pull a plugin into analysis.

    Under the old behaviour this card, reached through
    --champollion-cards-dir, made the tester add DoublePassCompliancePlugin
    and score every entry with it. Plugins now come only from the caller.
    """
    from mt_eval_harness.tester import analyze_run_log

    (tmp_path / "zzx.json").write_text(json.dumps({
        "code": "zzx",
        "name": "Test language",
        "rules": {"variables": {"format": "curly"}},
    }), encoding="utf-8")
    monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(tmp_path))
    run_log = {
        "run_id": "no_autoload",
        "config": {
            "model": "test-model",
            "target_lang_code": "zzx",
            "champollion_cards_dir": str(tmp_path),
        },
        "results": [{
            "id": "e1",
            "source": "Hello {user}!",
            "expected": "tawâw {user}!",
            "predicted": "tawâw!",
            "segment": "basic",
            "difficulty": 1,
            "latency_s": 0.1,
            "cost_usd": 0.0,
            "tool_call_count": 0,
            "error": None,
        }],
    }

    report = analyze_run_log(run_log, output_path=None, compute_ci=False)

    assert "error" not in report
    assert "double_pass_compliance" not in json.dumps(report, ensure_ascii=False)


def test_run_config_refuses_cards_dir():
    from mt_eval_harness.config import RunConfig
    cfg = RunConfig(dataset="all", corpus_path="", model="google/gemini-3.5-flash",
                    champollion_cards_dir="cards/")
    assert champollion_config.CARDS_DIR_RETIRED_MESSAGE in cfg.validate()


def test_old_cards_dir_flag_still_parses_and_is_then_refused():
    from mt_eval_harness.cli import args_to_config, build_parser
    args = build_parser().parse_args(
        ["run", "--corpus", "x.json", "--champollion-cards-dir", "cards/",
         "--target-lang-code", "fr"])
    cfg = args_to_config(args)
    errors = cfg.validate()
    assert champollion_config.CARDS_DIR_RETIRED_MESSAGE in errors
    assert "MT_EVAL_CARDS_DIR" in champollion_config.CARDS_DIR_RETIRED_MESSAGE
