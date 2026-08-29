"""
Champollion PromptProvider — Builds production-identical system prompts.

Integrates with the harness's plugin system to provide a "champollion"
prompt version that reads champollion.config.json and builds the
exact same system prompt as the production CLI.

Usage:
    mt-eval run --corpus data.tsv \\
        --champollion-config champollion.config.json \\
        --target-lang-code fr \\
        --prompt champollion

The --champollion-config flag auto-registers this provider, so users
only need to set --prompt champollion (or it's auto-set when
--champollion-config is provided without an explicit --prompt).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig

from mt_eval_harness.champollion_config import (
    load_champollion_config,
    build_champollion_system_prompt,
)


class ChampollionPromptProvider:
    """PromptProvider that builds prompts identical to champollion production.

    Reads the champollion config and language card files to produce the same
    system prompt as buildSystemMessage() in lib/methods/llm.js.

    This is the config interchangeability bridge: one config file works
    in both the production CLI and the evaluation harness.
    """

    def list_versions(self) -> list[str]:
        """Available prompt versions from this provider."""
        return ["champollion"]

    def load(self, version: str, config: RunConfig) -> str:
        """Build the champollion system prompt for the configured target language.

        Args:
            version: Must be "champollion".
            config: RunConfig with champollion_config_path and target_lang_code set.

        Returns:
            System prompt string identical to production buildSystemMessage().

        Raises:
            ValueError: If champollion_config_path or target_lang_code not set.
        """
        if not config.champollion_config_path:
            raise ValueError(
                "Cannot use --prompt champollion without --champollion-config. "
                "Provide the path to your champollion.config.json."
            )
        if not config.target_lang_code:
            raise ValueError(
                "Cannot use --prompt champollion without --target-lang-code. "
                "Provide the BCP-47 code for the target language (e.g., 'fr')."
            )

        rc = load_champollion_config(
            config.champollion_config_path,
            config.target_lang_code,
            cards_dir=config.champollion_cards_dir,
        )

        # Auto-populate target_lang on config if not set,
        # so the run card and naive prompt show the right language name.
        if not config.target_lang.strip():
            config.target_lang = rc.target_lang_name

        # Log what was resolved for transparency
        print(f"  Champollion config: {config.champollion_config_path}")
        print(f"  Target code:    {rc.target_lang_code} → {rc.target_lang_name}")
        print(f"  Register:       {rc.register[:80]}{'...' if len(rc.register) > 80 else ''}")
        if rc.prompt_context:
            ctx_preview = rc.prompt_context[:60]
            print(f"  Prompt context: {ctx_preview}{'...' if len(rc.prompt_context) > 60 else ''}")
        if rc.gender_guidance:
            print(f"  Gender:         (language-specific guidance from card)")
        else:
            print(f"  Gender:         (generic fallback)")

        return build_champollion_system_prompt(rc)
