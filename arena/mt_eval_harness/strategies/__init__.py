"""
Execution Strategies — Pluggable translation execution backends.

Each strategy implements the same protocol: take a list of entries
and config, return a list of result dicts. The factory function
resolves the correct strategy based on the RunConfig, eliminating
the if/elif dispatch chain that previously lived in runner.py.

Why strategies instead of a simple function dispatch:
    - Each mode has fundamentally different concurrency patterns
      (gather vs sequential batches vs multi-round tool loops)
    - Strategies are independently testable with mock sessions
    - New execution modes (e.g., streaming, multi-agent) can be
      added without touching the orchestrator
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from mt_eval_harness.config import RunConfig, TranslationMethod


# ---------------------------------------------------------------------------
# Strategy protocol — every execution backend implements this
# ---------------------------------------------------------------------------

@runtime_checkable
class ExecutionStrategy(Protocol):
    """Protocol for translation execution strategies.

    Each strategy handles one execution mode (single, batch, tool-call,
    or custom method plugin). The orchestrator in runner.py resolves
    the correct strategy via the factory and delegates all execution.
    """

    async def execute(
        self,
        entries: list[dict],
        config: RunConfig,
        **kwargs,
    ) -> list[dict]:
        """Execute translation for a list of entries.

        Args:
            entries: Corpus entries to translate.
            config: Full run configuration.
            **kwargs: Strategy-specific dependencies (session, api_key,
                      semaphore, system_prompt, hooks, cache, etc.)

        Returns:
            List of result dicts, one per entry. Each result must include:
                id, predicted, latency_s, usage, tool_calls,
                tool_call_count, error, metadata
        """
        ...


# ---------------------------------------------------------------------------
# Strategy factory — resolves config → strategy
# ---------------------------------------------------------------------------

def resolve_strategy(
    config: RunConfig,
    method: TranslationMethod | None = None,
    tool_provider: Any | None = None,
) -> ExecutionStrategy:
    """Resolve the correct execution strategy based on config.

    Priority order (matches the original runner.py dispatch):
        1. Custom TranslationMethod plugin → MethodStrategy
        2. tools_enabled → ToolCallStrategy
        3. batch_size > 1 → BatchStrategy
        4. Default → SingleStrategy

    This replaces the if/elif chain in the old execute_run() and makes
    strategy selection deterministic, testable, and extensible.
    """
    if method is not None:
        from mt_eval_harness.strategies.method_strategy import MethodStrategy
        return MethodStrategy(method)

    if config.tools_enabled:
        if not tool_provider:
            raise ValueError(
                "Tool-calling enabled but no ToolProvider registered. "
                "Pass a ToolProvider plugin to execute_run()."
            )
        from mt_eval_harness.strategies.tool_call import ToolCallStrategy
        return ToolCallStrategy(tool_provider)

    if config.batch_size > 1:
        from mt_eval_harness.strategies.batch import BatchStrategy
        return BatchStrategy()

    from mt_eval_harness.strategies.single import SingleStrategy
    return SingleStrategy()
