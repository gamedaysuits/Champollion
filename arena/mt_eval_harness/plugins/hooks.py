"""
PostTranslationHook Protocol — Process translations after generation.

Hooks run after each translation result is produced. They can modify
the result (e.g. corrective re-prompting via an FST gate) or enrich
it with additional metadata (e.g. validation flags).

Hooks are applied in registration order. Each hook receives the
potentially-modified result from the previous hook.

Example:
    class FSTGateHook:
        name = "fst_gate"

        async def process(self, entry, result, config, api_fn):
            # Validate each word through the FST
            # If invalid words found, re-prompt with feedback
            # Return modified result with corrected translation
            ...
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Coroutine, Protocol, runtime_checkable

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig


@runtime_checkable
class PostTranslationHook(Protocol):
    """Protocol for post-translation processing hooks."""

    name: str
    """Unique identifier for this hook (e.g. 'fst_gate')."""

    async def process(
        self,
        entry: dict,
        result: dict,
        config: RunConfig,
        api_fn: Callable[..., Coroutine[Any, Any, dict]] | None = None,
    ) -> dict:
        """Process a translation result, potentially modifying it.

        Args:
            entry: The original corpus entry (english, expected, etc.).
            result: The current RunResult dict with 'predicted', 'usage', etc.
            config: The current RunConfig.
            api_fn: Optional async callable for making additional API calls
                (e.g. corrective re-prompting). Signature matches
                api.call_openrouter().

        Returns:
            The (potentially modified) result dict. Must preserve the
            RunResult schema. Hooks may update 'predicted', 'retries',
            'usage', etc.
        """
        ...
