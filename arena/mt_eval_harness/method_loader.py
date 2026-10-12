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

import hashlib
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

    return _complete_protocol(instance, manifest, method_dir, class_name,
                              module_file.name)


# Method-card fields a plugin's method.json may supply when the plugin class
# has no method_card() of its own. Only the leaderboard description ("what,
# not how") — never entry_point, dependency internals or arbitrary keys a
# manifest may carry. The names are the method-card spec's (methods.md
# §Method Card) plus `version`, which publish reads as method_version.
_CARD_FIELDS_FROM_MANIFEST = (
    "method_id", "name", "class", "paradigm", "description", "author",
    "version", "tools_used", "open_source", "prompt_published",
    "supported_pairs", "dependency_class",
)

# The class a plugin loaded from a directory carries when it declares none:
# the method-class vocabulary's own term for exactly that (config.
# VALID_METHOD_CLASSES). Without a card a plugin run published as `raw-llm`
# — the no-card fallback is the harness's own LLM path.
_UNDECLARED_PLUGIN_CLASS = "custom-plugin"


def default_method_card(manifest: dict, method_dir: Path) -> dict:
    """The method card a plugin gets when its class defines no method_card().

    Built from method.json alone: its method-card fields where it declares
    them; ``method_id`` falls back to the plugin directory's name (the same
    label config.method_id and the run id use), ``class`` to
    ``custom-plugin`` (a plugin loaded with --method <dir>), ``paradigm`` to
    ``unknown`` (config.DEFAULT_PARADIGM — the documented value for an
    undeclared paradigm). Nothing is inferred beyond that.
    """
    from mt_eval_harness.config import DEFAULT_PARADIGM
    card = {k: manifest[k] for k in _CARD_FIELDS_FROM_MANIFEST
            if manifest.get(k) not in (None, "")}
    card.setdefault("method_id", Path(method_dir).name)
    card.setdefault("class", _UNDECLARED_PLUGIN_CLASS)
    card.setdefault("paradigm", DEFAULT_PARADIGM)
    return card


class _PluginWithDefaults:
    """A loaded plugin with the protocol members it left out filled in.

    The TranslationMethod protocol has three members (name, method_card,
    translate); the Agent Guide's minimal plugin defines only translate, and
    the harness used to die with a raw AttributeError on the first missing
    one, then on the next. ``name`` comes from method.json (a required
    manifest field); ``method_card()`` from default_method_card(). Every
    other attribute — translate included — is the plugin's own.
    """

    def __init__(self, inner, name: str, card: dict, defaulted: list[str]):
        self._inner = inner
        self._name = name
        self._card = card
        # Which protocol members the harness supplied (runner prints them).
        self.harness_defaulted = defaulted

    @property
    def name(self) -> str:
        return self._name

    def method_card(self) -> dict | None:
        if "method_card" in self.harness_defaulted:
            return dict(self._card)
        return self._inner.method_card()

    def __getattr__(self, attr):
        return getattr(self._inner, attr)


def _complete_protocol(instance, manifest: dict, method_dir: Path,
                       class_name: str, module_filename: str):
    """Check a loaded plugin against the protocol; default what may be.

    ``translate`` cannot be defaulted. ``name`` and ``method_card()`` can, and
    are (see _PluginWithDefaults). Everything that is wrong is reported in ONE
    MethodLoadError, so a plugin author fixes it in one pass — and a card's
    class/paradigm must be in the canonical vocabulary (methods spec: an
    off-taxonomy card fails at load, not silently at the leaderboard).
    """
    from mt_eval_harness.config import validate_method_card

    problems: list[str] = []
    if not callable(getattr(instance, "translate", None)):
        problems.append(
            "translate — missing. Define `async def translate(self, entries, "
            "config) -> list[dict]` (one result dict per entry).")
    has_name = isinstance(getattr(instance, "name", None), str) and \
        bool(getattr(instance, "name").strip())
    if hasattr(instance, "name") and not has_name:
        problems.append(
            "name — present but not a non-empty string. Remove it (the "
            "harness then uses method.json's \"name\") or set it to one.")
    card_fn = getattr(instance, "method_card", None)
    if card_fn is not None and not callable(card_fn):
        problems.append(
            "method_card — present but not callable. Make it a method that "
            "returns a dict (or None), or remove it.")

    defaulted: list[str] = []
    card: dict | None = None
    if not problems:
        if card_fn is None:
            card = default_method_card(manifest, method_dir)
            defaulted.append("method_card")
        else:
            try:
                card = card_fn()
            except Exception as exc:
                problems.append(f"method_card() raised {type(exc).__name__}: {exc}")
        if card is not None and not problems:
            if not isinstance(card, dict):
                problems.append(
                    f"method_card() returned {type(card).__name__}; it must "
                    "return a dict or None.")
            else:
                # A card built from method.json must be a whole valid card
                # (it is ours); the plugin's own card is held to what the
                # spec promises — canonical class/paradigm vocabulary.
                own_card = "method_card" not in defaulted
                origin = "method_card()" if own_card else "method.json"
                for err in validate_method_card(card):
                    if own_card and not err.startswith(
                            ("Invalid class", "Invalid paradigm")):
                        continue
                    problems.append(f"method card (from {origin}): {err}")
    if problems:
        raise MethodLoadError(
            f"{class_name} ({module_filename} in {method_dir}) is not a usable "
            f"method plugin:\n" + "\n".join(f"  - {p}" for p in problems)
            + "\n  Contract: a class with `async def translate(entries, config)`;"
              " `name` and `method_card()` are optional (method.json supplies"
              " them). See champollion.dev/docs/network/specifications/methods"
              "#eval-harness-translationmethod-protocol")

    if not has_name:
        defaulted.insert(0, "name")
    if not defaulted:
        return instance
    return _PluginWithDefaults(instance, getattr(instance, "name", None)
                               if has_name else str(manifest["name"]),
                               card or {}, defaulted)


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


#: The methods spec's five dependency classes (most restrictive wins:
#: S < O < A1 < A2 < X) — champollion.dev/docs/network/specifications/methods
#: #method-validity-and-dependency-classes. ``(name, what it means for what
#: the run costs)``: the cost line and the publish preview read them here so a
#: plugin that declares A1 is never called "self-contained" (Round 10).
DEPENDENCY_CLASSES: dict[str, tuple[str, str]] = {
    "S": ("self-contained",
          "no external dependency — no API call to price; the cost is this "
          "machine's compute"),
    "O": ("open external",
          "open artifacts fetched or mirrored, no runtime API — no API call "
          "to price; the cost is this machine's compute"),
    "A1": ("API-dependent, substitutable",
           "the plugin calls an LLM itself — it makes and pays for those "
           "calls, so the harness has no token count to price"),
    "A2": ("API-dependent, non-substitutable",
           "the plugin calls an external service itself — its calls are its "
           "own cost, which the harness cannot see"),
    "X": ("closed",
          "bundles content without redistribution rights — inadmissible in "
          "every lane; its cost is its own"),
}


#: The dependency classes whose plugins call no API — the methods spec:
#: "an S or O plugin calls no API, while an A1 or A2 plugin makes and pays
#: for its own calls".
NO_API_DEPENDENCY_CLASSES = ("S", "O")
#: Dependency-manifest ``access`` values that ARE a runtime network call
#: (methods spec, dependency manifest: ``gateway`` = runtime LLM inference,
#: ``external-api`` = any other runtime network call). ``bundled`` and
#: ``mirrored`` artifacts are on disk when the method runs.
RUNTIME_NETWORK_ACCESS = ("gateway", "external-api")


def plugin_calls_no_api(record: dict | None) -> bool:
    """True when a method plugin DECLARES that it calls no API: its
    ``dependency_class`` is S or O and its ``dependencies`` is a list (S's
    ``[]`` is the spec's affirmative "no external dependencies") in which no
    entry's ``access`` is a runtime network call (gateway / external-api).

    ``record`` is a method.json manifest, or the run's recorded
    ``provenance.method_plugin`` (:func:`plugin_provenance` copies both
    fields verbatim). A declaration, as the methods spec defines it — the
    spec audits it (manifest audit, static analysis, the sandbox's
    default-deny egress); the harness does not watch a plugin's network use.
    It decides only how a run's cost is SAID: an S plugin with no
    dependencies was reported "unknown (plugin prices its own calls)" on
    every surface, against the spec (synthetic researcher, Round 12). A
    missing list, an undeclared or unknown class, or a list naming a gateway
    / external-api dependency (an O declaration that the manifest
    contradicts) stays unknown."""
    if not isinstance(record, dict):
        return False
    if str(record.get("dependency_class") or "").strip() not in NO_API_DEPENDENCY_CLASSES:
        return False
    deps = record.get("dependencies")
    if not isinstance(deps, list):
        return False
    for dep in deps:
        if not isinstance(dep, dict):
            return False
        if str(dep.get("access") or "").strip().lower() in RUNTIME_NETWORK_ACCESS:
            return False
    return True


def plugin_dependency_record(method_path: str | Path | None) -> dict | None:
    """``{dependency_class, dependencies}`` as a plugin's method.json declares
    them — what :func:`plugin_calls_no_api` reads before a run (the pre-spend
    estimate, the dry run); after it, the RunLog's provenance.method_plugin
    carries the same two fields as they were when the run started. None when
    there is no readable method.json."""
    if not method_path:
        return None
    try:
        manifest = load_manifest(method_path)
    except (MethodLoadError, OSError, ValueError):
        return None
    return {"dependency_class": manifest.get("dependency_class") or None,
            "dependencies": manifest.get("dependencies")}


def dependency_class_label(dep_class: str | None) -> str:
    """``A1 (API-dependent, substitutable)`` — or what was declared, as
    written, when it is not one of the five; or 'not declared'."""
    if not dep_class:
        return "not declared in method.json"
    known = DEPENDENCY_CLASSES.get(str(dep_class).strip())
    return (f"{dep_class} ({known[0]})" if known
            else f"{dep_class} (not one of S/O/A1/A2/X — recorded as written)")


def plugin_cost_basis(method_path: str | Path | None) -> str:
    """Why a method plugin's run has no harness cost estimate, in the terms
    of the dependency class its method.json declares."""
    try:
        dep_class = (load_manifest(method_path).get("dependency_class")
                     if method_path else None)
    except (MethodLoadError, OSError, ValueError):
        dep_class = None
    known = DEPENDENCY_CLASSES.get(str(dep_class or "").strip())
    if known:
        return (f"method plugin, dependency class {dep_class} ({known[0]}): "
                f"{known[1]}")
    if dep_class:
        return (f"method plugin declaring dependency class {dep_class!r} "
                f"(not one of S/O/A1/A2/X): its cost is its own")
    return ("method plugin with no dependency class declared in method.json: "
            "its cost is its own (unknown, never assumed $0)")


def plugin_provenance(method_path: str | Path) -> dict:
    """What identifies a method plugin's CODE, for the run log and run card.

    A plugin run used to publish with method_version and method_sha256 null
    (synthetic researcher, 2026-10-03): nothing said which version of which
    code produced the translations. Returns:

        version  the version method.json declares (None when it declares none
                 — never guessed)
        sha256   sha256 over a sha256sum-style manifest of the plugin's files:
                 method.json and every *.py under the plugin directory
                 (``__pycache__`` and dot-directories excluded), one
                 ``<sha256>  <relative path>`` line each, sorted by path — so
                 anyone can re-derive it with ``sha256sum``
        files    the relative paths that went into the hash
        dependencies      the ``dependencies`` list method.json declares,
                          verbatim (None when it declares none; ``[]`` is the
                          affirmative "no external dependencies" the methods
                          spec defines, and is kept as such)
        dependency_class  the ``dependency_class`` method.json declares, or
                          None
    """
    method_dir = Path(method_path).resolve()
    manifest = load_manifest(method_dir)
    files = [method_dir / "method.json"] + sorted(
        f for f in method_dir.rglob("*.py")
        if "__pycache__" not in f.parts
        and not any(part.startswith(".") for part in f.relative_to(method_dir).parts)
    )
    lines = []
    rels = []
    for f in sorted(files, key=lambda p: p.relative_to(method_dir).as_posix()):
        rel = f.relative_to(method_dir).as_posix()
        rels.append(rel)
        lines.append(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {rel}\n")
    return {
        "version": manifest.get("version") or None,
        "sha256": hashlib.sha256("".join(lines).encode("utf-8")).hexdigest(),
        "files": rels,
        "dependencies": manifest.get("dependencies"),
        "dependency_class": manifest.get("dependency_class") or None,
    }


def models_called(results: list[dict], method_card: dict | None,
                  manifest: dict | None = None) -> tuple[list[str], str | None]:
    """The underlying model(s) a plugin used, and how we know.

    Observed first: the distinct ``metadata["model"]`` values the plugin put
    on its results (what it actually called). Else declared: a ``model`` on
    its method card or method.json. ([], None) when the plugin exposes
    neither — the run card then says nothing rather than guess.
    """
    seen = sorted({
        str(m).strip() for r in results or []
        for m in [((r.get("metadata") or {}).get("model"))]
        if isinstance(m, str) and m.strip()
    })
    if seen:
        return seen, "observed"
    for source in (method_card or {}, manifest or {}):
        declared = source.get("model")
        if isinstance(declared, str) and declared.strip():
            return [declared.strip()], "declared"
    return [], None
