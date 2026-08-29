"""
DEPRECATED — Use method_strategy.py instead.

This file exists only for backward compatibility with existing tests
and any code that imported PluginProcessStrategy directly.
"""
from mt_eval_harness.strategies.method_strategy import MethodStrategy

# Backward-compatible alias
PluginProcessStrategy = MethodStrategy
