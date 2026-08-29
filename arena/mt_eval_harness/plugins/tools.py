"""
ToolProvider Protocol — Register language-specific tools for LLM tool-calling.

When tool-calling is enabled, the model can invoke external tools (e.g.
morphological analyzers, dictionaries, generators) during translation.
The harness handles the multi-round tool-calling conversation loop;
the ToolProvider supplies the schemas and execution logic.

Example:
    class CreeTools:
        def get_schemas(self, config) -> list[dict]:
            return [
                {
                    "type": "function",
                    "function": {
                        "name": "fst_analyze",
                        "description": "Analyze a Cree word",
                        "parameters": {...}
                    }
                }
            ]

        async def execute(self, name, arguments):
            if name == "fst_analyze":
                return analyzer.analyze(arguments["word"])
            return {"error": f"Unknown tool: {name}"}
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig


@runtime_checkable
class ToolProvider(Protocol):
    """Protocol for pluggable LLM tool-calling integrations."""

    def get_schemas(self, config: RunConfig) -> list[dict]:
        """Return OpenAI-format tool schemas for the API payload.

        Args:
            config: Current RunConfig. Use config.tools_list to filter
                which tools to expose.

        Returns:
            List of tool schema dicts in OpenAI function-calling format.
        """
        ...

    async def execute(self, name: str, arguments: dict[str, Any]) -> Any:
        """Execute a tool call and return the result.

        Args:
            name: The function name from the tool call.
            arguments: The parsed arguments dict.

        Returns:
            The tool result (will be JSON-serialized into the
            conversation as a tool response message).
        """
        ...

    def list_available(self) -> list[str]:
        """Return the names of all available tools.

        Used by the CLI's `list tools` subcommand.
        """
        ...
