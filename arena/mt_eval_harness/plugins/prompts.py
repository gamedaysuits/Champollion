"""
PromptProvider Protocol — Register custom system prompts.

The harness ships with two built-in prompt strategies:
  - 'naive': Minimal instruction ("Translate to [language]")
  - 'custom': Load from a user-specified .txt file

Language-specific prompts (grammar coaching, FST instructions, etc.)
are registered as PromptProvider instances by the consuming project.

Example:
    class CreePrompts:
        def list_versions(self) -> list[str]:
            return ["v8.2", "v8.1", "v6", "agent"]

        def load(self, version: str, config) -> str:
            prompts = {
                "v8.2": "You are a Plains Cree translator...",
                "v6": "Translate the following...",
            }
            return prompts[version]
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig


@runtime_checkable
class PromptProvider(Protocol):
    """Protocol for pluggable system prompt sources."""

    def list_versions(self) -> list[str]:
        """Return the prompt version identifiers this provider offers.

        These appear in `--prompt` CLI choices and in `list prompts` output.
        """
        ...

    def load(self, version: str, config: RunConfig) -> str:
        """Load and return the full system prompt text.

        Args:
            version: The prompt version identifier (from list_versions).
            config: The current RunConfig, in case the prompt needs to
                adapt to model, tools, or other settings.

        Returns:
            The complete system prompt string.
        """
        ...
