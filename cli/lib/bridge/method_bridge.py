"""
Method Bridge — ships with the champollion CLI npm package.

Loads Python translation method modules and exposes them via
stdin/stdout JSON-lines protocol. Self-contained — no Arena dependency.

The CLI's ExternalMethod class spawns this as a subprocess:
    python cli/lib/bridge/method_bridge.py --method path/to/method_plugin

The bridge also supports standalone discovery mode:
    python cli/lib/bridge/method_bridge.py --discover

Protocol (JSON-lines over stdin/stdout):
    stdin:  one JSON object per line with an "action" field
    stdout: one JSON response per line with an "ok" field
    stderr: human-readable logging (not parsed by CLI)

Actions:
    discover  → list installed method modules (via pip entry points)
    translate → translate key-value pairs through the loaded method
    method_card → return method metadata
    shutdown  → clean exit

This module has ZERO imports beyond Python 3.10+ stdlib (except for
the method modules themselves, which bring their own dependencies).

Why self-contained:
    The bridge inlines the method_loader logic (~60 lines) so the user
    does NOT need to pip install the Arena. Only the method module
    (e.g., pip install crk-translate) is required.

Maintained alongside the Arena's method_loader.py — if the manifest
format changes there, it must be updated here. Both live in the same
monorepo so this is easy to track.
"""

from __future__ import annotations

import asyncio
import importlib.metadata
import importlib.util
import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger("champollion.bridge")


# ── Inline method loader ─────────────────────────────────────────────
#
# Self-contained reimplementation of arena/mt_eval_harness/method_loader.py.
# Reads method.json, parses the entry_point, loads the Python module,
# and instantiates the TranslationMethod class.
#
# Kept in sync manually. If method.json schema changes in the Arena's
# method_loader.py, update this section to match.

_REQUIRED_MANIFEST_FIELDS = {"name", "entry_point"}


class MethodLoadError(Exception):
    """Raised when a method plugin cannot be loaded."""
    pass


def _load_method(method_dir: Path) -> tuple:
    """Load a TranslationMethod from a plugin directory.

    Returns:
        (instance, manifest) tuple — the method object and its parsed
        method.json for metadata access.

    Raises:
        MethodLoadError with human-readable messages explaining what
        went wrong and what the user should do about it.
    """
    method_dir = Path(method_dir).resolve()

    if not method_dir.is_dir():
        raise MethodLoadError(
            f"Not a directory: {method_dir}\n"
            f"  Expected a method plugin directory containing method.json.\n"
            f"  If you installed a method module via pip, try:\n"
            f"    python {__file__} --discover"
        )

    manifest_path = method_dir / "method.json"
    if not manifest_path.exists():
        raise MethodLoadError(
            f"No method.json found in {method_dir}\n"
            f"  A method plugin directory must contain a method.json manifest.\n"
            f"  See: https://champollion.dev/docs/guides/serving-a-method"
        )

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise MethodLoadError(
            f"Invalid JSON in {manifest_path}: {e}"
        ) from e

    missing = _REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
    if missing:
        raise MethodLoadError(
            f"method.json is missing required fields: {sorted(missing)}.\n"
            f"  Required: {sorted(_REQUIRED_MANIFEST_FIELDS)}"
        )

    entry_point = manifest["entry_point"]
    if ":" not in entry_point:
        raise MethodLoadError(
            f"Invalid entry_point: '{entry_point}'.\n"
            f"  Expected format: 'module_name:ClassName'\n"
            f"  Example: 'pipeline:CrkPipelineMethod'"
        )

    module_name, class_name = entry_point.split(":", 1)
    module_file = method_dir / f"{module_name}.py"
    if not module_file.exists():
        raise MethodLoadError(
            f"Entry point module not found: {module_file}\n"
            f"  The entry_point '{entry_point}' expects {module_name}.py\n"
            f"  in {method_dir}"
        )

    # Add method dir + parent to sys.path so the plugin can import siblings
    # (e.g., a method package imported from its method_plugin/ directory)
    for p in [str(method_dir), str(method_dir.parent)]:
        if p not in sys.path:
            sys.path.insert(0, p)

    spec = importlib.util.spec_from_file_location(
        f"method_plugin.{module_name}", module_file
    )
    if spec is None or spec.loader is None:
        raise MethodLoadError(
            f"Python could not create a module spec for {module_file}"
        )

    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as e:
        raise MethodLoadError(
            f"Failed to load {module_file}: {type(e).__name__}: {e}\n"
            f"  Check that the method module's dependencies are installed.\n"
            f"  Try: pip install -e {method_dir.parent}"
        ) from e

    if not hasattr(module, class_name):
        available = [n for n in dir(module) if not n.startswith("_")]
        raise MethodLoadError(
            f"{module_name}.py does not export '{class_name}'.\n"
            f"  Available names: {available}"
        )

    method_class = getattr(module, class_name)

    # Instantiate — try with manifest/method_dir, fall back to no-arg
    try:
        instance = method_class(manifest=manifest, method_dir=method_dir)
    except TypeError:
        try:
            instance = method_class()
        except Exception as e:
            raise MethodLoadError(
                f"Could not instantiate {class_name}: {e}"
            ) from e

    if not hasattr(instance, "translate") or not callable(instance.translate):
        raise MethodLoadError(
            f"{class_name} must have an async translate(entries, config) method.\n"
            f"  See: https://champollion.dev/docs/guides/serving-a-method"
        )

    return instance, manifest


# ── Entry-point discovery ─────────────────────────────────────────────


def _discover_installed_methods() -> list[dict]:
    """Find all pip-installed method modules via entry points.

    Method modules register in their pyproject.toml:

        [project.entry-points."champollion.methods"]
        crk-decomp-recomp = "method_plugin.pipeline:CrkPipelineMethod"

    Returns:
        List of dicts with name, method_id, entry_point, supported_pairs,
        and plugin_path for each discovered module.
    """
    methods = []

    try:
        eps = importlib.metadata.entry_points(group="champollion.methods")
    except Exception:
        # Python < 3.12 or no entry points registered
        return methods

    for ep in eps:
        try:
            # Resolve the entry point's module to find its file path
            module_ref = ep.value.split(":")[0]
            module_spec = importlib.util.find_spec(module_ref)

            if module_spec and module_spec.origin:
                method_dir = Path(module_spec.origin).parent
                manifest_path = method_dir / "method.json"

                if manifest_path.exists():
                    manifest = json.loads(
                        manifest_path.read_text(encoding="utf-8")
                    )
                    methods.append({
                        "name": manifest.get("name", ep.name),
                        "method_id": manifest.get("method_id", ep.name),
                        "supported_pairs": manifest.get("supported_pairs", []),
                        "entry_point": ep.value,
                        "plugin_path": str(method_dir),
                    })
                else:
                    logger.debug(
                        "Entry point %s has no method.json at %s",
                        ep.name, method_dir,
                    )
        except Exception as e:
            logger.debug("Skipping entry point %s: %s", ep.name, e)

    return methods


# ── Protocol ──────────────────────────────────────────────────────────


def _send(obj: dict) -> None:
    """Write a JSON response line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


async def _handle_translate(method, request: dict) -> dict:
    """Convert CLI key-value request → Arena entries → translate → CLI map.

    The CLI sends:
        { keys: { "greeting": "Hello", "farewell": "Goodbye" },
          source_locale: "en", target_locale: "crk",
          config: { model: "anthropic/claude-sonnet-4.6" } }

    The bridge converts to Arena format:
        [{ id: 0, source: "Hello" }, { id: 1, source: "Goodbye" }]

    Calls method.translate(entries, config), then converts results back:
        { translations: { "greeting": "tânisi", "farewell": "êkwa" } }
    """
    keys_payload = request.get("keys", {})
    config_overrides = request.get("config", {})

    # Build Arena-shaped entries from CLI key-value pairs
    entries = []
    key_order = []  # preserves insertion order for response mapping
    for idx, (key, source_text) in enumerate(keys_payload.items()):
        entries.append({"id": idx, "source": source_text})
        key_order.append(key)

    if not entries:
        return {"ok": True, "translations": {}, "meta": {}}

    # Build a minimal config namespace matching what method plugins read.
    # The bridge passes through whatever config the CLI sends — the method
    # plugin decides what it uses. At minimum, model and source/target lang.
    class BridgeConfig:
        """Minimal config namespace for method plugin compatibility."""
        pass

    cfg = BridgeConfig()
    cfg.model = config_overrides.get("model")
    cfg.model_id = config_overrides.get("model")  # CrkPipelineMethod reads this
    cfg.source_lang = request.get("source_locale", "en")
    cfg.target_lang = request.get("target_locale", "")
    cfg.temperature = config_overrides.get("temperature", 0.3)

    # Call the method's translate — same interface the Arena uses
    results = await method.translate(entries, cfg)

    # Convert Arena results back to CLI key-value map
    translations = {}
    meta = {"total_tokens": 0, "total_latency_s": 0.0, "errors": []}

    for result in results:
        idx = result.get("id", 0)
        if idx < len(key_order):
            key = key_order[idx]
            if result.get("error"):
                meta["errors"].append({"key": key, "error": result["error"]})
            else:
                predicted = result.get("predicted", "")
                if predicted:  # skip empty predictions
                    translations[key] = predicted

        usage = result.get("usage", {})
        meta["total_tokens"] += usage.get("total_tokens", 0)
        meta["total_latency_s"] += result.get("latency_s", 0)

    return {"ok": True, "translations": translations, "meta": meta}


async def _run_bridge(method_path: str | None = None) -> None:
    """Main loop: read JSON-lines from stdin, dispatch, respond.

    If method_path is given, load the method on startup.
    If not, run in discovery-only mode (responds to 'discover' only).
    """
    method = None
    manifest = None

    if method_path:
        try:
            method, manifest = _load_method(Path(method_path))
        except MethodLoadError as e:
            _send({"ok": False, "error": str(e)})
            return

        method_name = getattr(method, "name", manifest.get("name", "Unknown"))
        _send({"ok": True, "ready": True, "name": method_name})
    else:
        # Discovery-only mode — no method loaded
        _send({"ok": True, "ready": True, "name": "champollion-bridge"})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            _send({"ok": False, "error": f"Invalid JSON: {e}"})
            continue

        action = request.get("action", "")

        if action == "discover":
            methods = _discover_installed_methods()
            _send({"ok": True, "methods": methods})

        elif action == "translate":
            if not method:
                _send({
                    "ok": False,
                    "error": (
                        "No method loaded. Start the bridge with --method.\n"
                        "  Example: python method_bridge.py "
                        "--method ./my-method/method_plugin"
                    ),
                })
                continue
            try:
                response = await _handle_translate(method, request)
                _send(response)
            except Exception as e:
                logger.exception("Translation error")
                _send({
                    "ok": False,
                    "error": f"{type(e).__name__}: {e}",
                })

        elif action == "method_card":
            card = manifest or {}
            if method and hasattr(method, "method_card"):
                try:
                    card = method.method_card()
                except Exception:
                    pass  # fall back to manifest
            _send({"ok": True, "card": card})

        elif action == "shutdown":
            _send({"ok": True})
            break

        else:
            _send({
                "ok": False,
                "error": f"Unknown action: '{action}'",
            })


def main():
    """CLI entry point for the method bridge."""
    import argparse

    parser = argparse.ArgumentParser(
        description=(
            "Champollion method bridge — connects the CLI to Python "
            "translation method modules via JSON-lines protocol."
        ),
    )
    parser.add_argument(
        "--method",
        help=(
            "Path to method plugin directory (must contain method.json). "
            "Example: ./my-method/method_plugin"
        ),
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="List all pip-installed method modules and exit.",
    )
    args = parser.parse_args()

    # Logging goes to stderr — stdout is reserved for the JSON protocol
    logging.basicConfig(
        level=logging.INFO,
        format="%(name)s: %(message)s",
        stream=sys.stderr,
    )

    if args.discover:
        methods = _discover_installed_methods()
        _send({"ok": True, "methods": methods})
        return

    asyncio.run(_run_bridge(args.method))


if __name__ == "__main__":
    main()
