"""
Method Loader — Load translation method plugins from directories.

A method plugin is a directory containing:
    method.json — manifest with name, class, entry_point, and metadata
    *.py        — Python module(s) implementing TranslationMethod

The harness discovers nothing automatically. The user explicitly points
to a method with `--method path/to/dir`. Explicit is better than implicit.

Example method.json:
    {
      "name": "CRK Decomp-Recomp Pipeline",
      "method_id": "crk-decomp-recomp-v1",
      "class": "pipeline",
      "entry_point": "pipeline:CrkPipelineMethod",
      "author": "Curtis Forbes",
      "description": "Multi-stage decomposition-recomposition..."
    }

The entry_point format is "module_name:ClassName" — the module is loaded
from the plugin directory via importlib, and the class is instantiated.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


# Required fields in method.json
_REQUIRED_MANIFEST_FIELDS = {"name", "entry_point"}


class MethodLoadError(Exception):
    """Raised when a method plugin cannot be loaded."""
    pass


def load_method(method_path: str | Path) -> Any:
    """Load a translation method plugin from a directory.

    Args:
        method_path: Path to the method plugin directory. Must contain
                     a method.json manifest and the Python module
                     specified by the manifest's entry_point.

    Returns:
        An instance of the method class that implements TranslationMethod.

    Raises:
        MethodLoadError: If the directory, manifest, or entry point is
                         invalid or the class cannot be instantiated.
    """
    method_dir = Path(method_path).resolve()

    # --- Validate directory ---
    if not method_dir.is_dir():
        raise MethodLoadError(
            f"Method path is not a directory: {method_dir}"
        )

    manifest_path = method_dir / "method.json"
    if not manifest_path.exists():
        raise MethodLoadError(
            f"No method.json found in {method_dir}. "
            f"A method plugin directory must contain a method.json manifest."
        )

    # --- Load manifest ---
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise MethodLoadError(
            f"Invalid JSON in {manifest_path}: {e}"
        ) from e

    missing = _REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
    if missing:
        raise MethodLoadError(
            f"method.json is missing required fields: {sorted(missing)}. "
            f"Required: {sorted(_REQUIRED_MANIFEST_FIELDS)}"
        )

    # --- Parse entry point ---
    entry_point = manifest["entry_point"]
    if ":" not in entry_point:
        raise MethodLoadError(
            f"Invalid entry_point format: '{entry_point}'. "
            f"Expected 'module_name:ClassName' (e.g., 'pipeline:CrkPipelineMethod')"
        )

    module_name, class_name = entry_point.split(":", 1)

    # --- Load the Python module ---
    module_file = method_dir / f"{module_name}.py"
    if not module_file.exists():
        raise MethodLoadError(
            f"Entry point module not found: {module_file}. "
            f"The entry_point '{entry_point}' requires {module_name}.py "
            f"in {method_dir}"
        )

    # Use importlib to load the module from the file path.
    # We add the method directory to sys.path temporarily so the module
    # can import its own siblings (e.g., helper modules in the same dir).
    spec = importlib.util.spec_from_file_location(
        f"method_plugin.{module_name}",
        module_file,
    )
    if spec is None or spec.loader is None:
        raise MethodLoadError(
            f"Could not create module spec for {module_file}"
        )

    # Add the method directory (and its parent) to sys.path so the
    # plugin module can import from its own package and from the
    # broader project (e.g., crk-translate's own modules).
    paths_to_add = []
    method_dir_str = str(method_dir)
    parent_dir_str = str(method_dir.parent)
    if method_dir_str not in sys.path:
        paths_to_add.append(method_dir_str)
    if parent_dir_str not in sys.path:
        paths_to_add.append(parent_dir_str)

    for p in paths_to_add:
        sys.path.insert(0, p)

    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as e:
        raise MethodLoadError(
            f"Failed to load module {module_file}: {e}"
        ) from e

    # --- Get the class ---
    if not hasattr(module, class_name):
        raise MethodLoadError(
            f"Module {module_name}.py does not export class '{class_name}'. "
            f"Available names: {[n for n in dir(module) if not n.startswith('_')]}"
        )

    method_class = getattr(module, class_name)

    # --- Instantiate ---
    # Pass the manifest and method directory to the constructor if it
    # accepts them, otherwise instantiate with no args.
    try:
        instance = method_class(
            manifest=manifest,
            method_dir=method_dir,
        )
    except TypeError:
        # Class doesn't accept manifest/method_dir — try no-arg construction
        try:
            instance = method_class()
        except Exception as e:
            raise MethodLoadError(
                f"Could not instantiate {class_name}: {e}"
            ) from e

    # --- Verify protocol ---
    if not hasattr(instance, "translate") or not callable(instance.translate):
        raise MethodLoadError(
            f"{class_name} does not implement the TranslationMethod protocol. "
            f"It must have an async translate(entries, config) method."
        )

    return instance


def load_manifest(method_path: str | Path) -> dict:
    """Load just the method.json manifest without importing any code.

    Useful for displaying method metadata (e.g., in the publish preview)
    without loading potentially heavy dependencies.
    """
    manifest_path = Path(method_path).resolve() / "method.json"
    if not manifest_path.exists():
        raise MethodLoadError(
            f"No method.json found in {method_path}"
        )
    return json.loads(manifest_path.read_text(encoding="utf-8"))
