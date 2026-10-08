"""Tests for strategy factory and protocol compliance.

Key behaviors validated:
    - Default config resolves to SingleStrategy
    - batch_size > 1 resolves to BatchStrategy
    - tools_enabled resolves to ToolCallStrategy (requires provider)
    - tools_enabled without provider raises ValueError
    - Custom method resolves to MethodStrategy (via PluginProcessStrategy shim)
    - Method takes priority over tools_enabled
    - Method takes priority over batch_size
    - All strategies implement ExecutionStrategy protocol
"""

from __future__ import annotations

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.strategies import (
    ExecutionStrategy,
    resolve_strategy,
)
from mt_eval_harness.strategies.single import SingleStrategy
from mt_eval_harness.strategies.batch import BatchStrategy
from mt_eval_harness.strategies.tool_call import ToolCallStrategy
from mt_eval_harness.strategies.plugin_process import PluginProcessStrategy


# ---------------------------------------------------------------------------
# Mock dependencies for strategy construction
# ---------------------------------------------------------------------------

class MockToolProvider:
    """Minimal mock for ToolProvider — just enough to pass construction."""

    def get_schemas(self, config):
        return [{"type": "function", "function": {"name": "mock_tool"}}]

    async def execute(self, name, args):
        return {"result": "mock"}


class MockProcess:
    """Minimal mock for TranslationMethod plugin.

    Uses the old name 'MockProcess' to verify backward compat shim.
    """

    async def translate(self, entries, config):
        return [{"id": e["id"], "predicted": "mock"} for e in entries]


# ---------------------------------------------------------------------------
# Strategy factory resolution
# ---------------------------------------------------------------------------

class TestResolveStrategy:
    """Verify the factory resolves config to the correct strategy."""

    def test_default_resolves_to_single(self):
        """Default config (batch=1, no tools) should yield SingleStrategy."""
        config = RunConfig(batch_size=1)
        strategy = resolve_strategy(config)
        assert isinstance(strategy, SingleStrategy)

    def test_batch_resolves_to_batch(self):
        """batch_size > 1 should yield BatchStrategy."""
        config = RunConfig(batch_size=5)
        strategy = resolve_strategy(config)
        assert isinstance(strategy, BatchStrategy)

    def test_batch_size_one_not_batch(self):
        """batch_size=1 should NOT yield BatchStrategy."""
        config = RunConfig(batch_size=1)
        strategy = resolve_strategy(config)
        assert not isinstance(strategy, BatchStrategy)

    def test_tools_resolves_to_tool_call(self):
        """tools_enabled should yield ToolCallStrategy when provider given."""
        config = RunConfig(tools_enabled=True)
        strategy = resolve_strategy(config, tool_provider=MockToolProvider())
        assert isinstance(strategy, ToolCallStrategy)

    def test_tools_without_provider_raises(self):
        """tools_enabled without a provider should raise ValueError."""
        config = RunConfig(tools_enabled=True)
        with pytest.raises(ValueError, match="ToolProvider"):
            resolve_strategy(config)

    def test_process_resolves_to_plugin(self):
        """Custom method should yield PluginProcessStrategy (MethodStrategy)."""
        config = RunConfig()
        strategy = resolve_strategy(config, method=MockProcess())
        assert isinstance(strategy, PluginProcessStrategy)


# ---------------------------------------------------------------------------
# Priority ordering — process > tools > batch > single
# ---------------------------------------------------------------------------

class TestStrategyPriority:
    """Verify strategy selection follows the documented priority chain.

    Priority: Method > Tools > Batch > Single.
    This ensures method plugins always take precedence, which is the key
    architectural guarantee for custom pipelines (e.g., FST-gated).
    """

    def test_method_overrides_tools(self):
        """Method should win even if tools_enabled is True."""
        config = RunConfig(tools_enabled=True)
        strategy = resolve_strategy(
            config,
            method=MockProcess(),
            tool_provider=MockToolProvider(),
        )
        assert isinstance(strategy, PluginProcessStrategy)

    def test_method_overrides_batch(self):
        """Method should win even if batch_size > 1."""
        config = RunConfig(batch_size=10)
        strategy = resolve_strategy(config, method=MockProcess())
        assert isinstance(strategy, PluginProcessStrategy)

    def test_tools_overrides_batch(self):
        """Tools should win over batch_size when both are set."""
        config = RunConfig(tools_enabled=True, batch_size=5)
        strategy = resolve_strategy(config, tool_provider=MockToolProvider())
        assert isinstance(strategy, ToolCallStrategy)


# ---------------------------------------------------------------------------
# Protocol compliance
# ---------------------------------------------------------------------------

class TestProtocolCompliance:
    """Verify all strategies implement the ExecutionStrategy protocol."""

    def test_single_is_execution_strategy(self):
        assert isinstance(SingleStrategy(), ExecutionStrategy)

    def test_batch_is_execution_strategy(self):
        assert isinstance(BatchStrategy(), ExecutionStrategy)

    def test_tool_call_is_execution_strategy(self):
        assert isinstance(ToolCallStrategy(MockToolProvider()), ExecutionStrategy)

    def test_plugin_process_is_execution_strategy(self):
        assert isinstance(PluginProcessStrategy(MockProcess()), ExecutionStrategy)

    def test_all_strategies_have_execute_method(self):
        """Every strategy must have an async execute() method."""
        strategies = [
            SingleStrategy(),
            BatchStrategy(),
            ToolCallStrategy(MockToolProvider()),
            PluginProcessStrategy(MockProcess()),
        ]
        for s in strategies:
            assert hasattr(s, "execute"), f"{type(s).__name__} missing execute()"
            assert callable(s.execute), f"{type(s).__name__}.execute not callable"


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Verify edge cases in strategy resolution."""

    def test_batch_size_zero_resolves_to_single(self):
        """batch_size=0 (degenerate) should fall through to SingleStrategy."""
        config = RunConfig(batch_size=0)
        strategy = resolve_strategy(config)
        assert isinstance(strategy, SingleStrategy)

    def test_negative_batch_size_resolves_to_single(self):
        """Negative batch_size should fall through to SingleStrategy."""
        config = RunConfig(batch_size=-1)
        strategy = resolve_strategy(config)
        assert isinstance(strategy, SingleStrategy)

    def test_none_method_ignored(self):
        """Explicitly passing method=None should not trigger MethodStrategy."""
        config = RunConfig(batch_size=1)
        strategy = resolve_strategy(config, method=None)
        assert isinstance(strategy, SingleStrategy)
