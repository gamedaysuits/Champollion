"""
Plugin auto-discovery — Automatically register metric plugins based on target language.

WHY THIS MODULE EXISTS:
    The harness ships with generic metrics (chrF++, BLEU, exact match). But for
    specific languages, we have domain-specific validators — most importantly the
    GiellaLT FST morphological checker, which verifies whether each output word
    is a valid form in the target language.

    Rather than forcing users to manually specify plugins on every run, this
    module auto-detects which plugins are available based on the target language.

FST QUALITY GATE:
    For languages that have a GiellaLT FST listed in the FST registry, the FST
    is REQUIRED for evaluations. If it's not installed, the harness will:
    1. Prompt the user to download and install it
    2. If user consents → auto-install and proceed
    3. If user declines → ABORT the eval (unless --skip-fst is set)

    This ensures that polysynthetic and low-resource language evals always
    include morphological validation — the most important quality signal
    for these languages.

BEHAVIORAL PLUGINS (language-agnostic):
    Three behavioral metric plugins are loaded for ALL language pairs:
    - CodeSwitchingPlugin: detects source-language word leakage (e.g. English
      words in Cree output). Auto-detects target script.
    - HallucinationPlugin: detects fabricated content via length ratio,
      repetition, entity preservation, and echo detection heuristics.
    - TerminologyPlugin: measures adherence to prescribed vocabulary when a
      glossary is provided in config. Returns null metrics without a glossary
      (harmlessly excluded from composite via re-normalization).

    Scoring weights reference these metrics (code_switching_rate, hallucination_rate,
    terminology_adherence), so they must be loaded for the composite to include them.

DESIGN DECISIONS:
    - The FST gate applies only to languages with FST install info in their card.
      Languages without known FSTs proceed normally without any gate.
    - Language-specific LYSS plugins (linters, semantic validators) are
      loaded from method.json manifests via the general method metric
      plugin loader. When --method is not provided, the harness auto-detects
      method plugins from the monorepo by matching supported_pairs to the
      target language. Any method module can declare its own metrics —
      no language gets hardcoded special treatment in this file.
    - Behavioral plugins load unconditionally — they're stdlib-only,
      language-agnostic, and zero-config.
    - The --skip-fst flag exists for CI/automation where interactive
      prompts aren't possible, but it logs a clear warning.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from pathlib import Path
from typing import Any

from mt_eval_harness.language_cards import resolve_code, resolve_name

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Language detection — uses language_cards SSOT
# ---------------------------------------------------------------------------
#
# Previously contained a hardcoded _LANG_NAME_TO_CODE dict with 14 entries.
# Deleted in v8 — all name→code resolution now goes through the shared
# language_cards module which indexes all 7,928 language card files.


def _detect_lang_code(config: dict) -> str | None:
    """Extract the ISO 639-3 language code from the run config.

    Resolution chain:
        1. Check target_lang / target_language config fields
        2. Fall back to language_pair field (extract target half)
        3. Resolve via language_cards SSOT (handles codes, aliases, names)

    Returns None if the language can't be identified.
    """
    target = (
        config.get("target_lang", "")
        or config.get("target_language", "")
        or ""
    ).strip()

    if not target:
        # Try language_pair field (e.g. "en>crk" or "en-crk")
        pair = config.get("language_pair", "")
        if pair:
            for sep in [">", "-", "_"]:
                if sep in pair:
                    target = pair.split(sep)[-1].strip()
                    break

    if not target:
        return None

    # Try resolving as a code or alias first (handles "crk", "fr", etc.)
    resolved = resolve_code(target)
    if resolved != target or (len(target) == 3 and target.isalpha()):
        # Either the code resolved to something different (alias match),
        # or it's already a 3-letter ISO code
        return resolved.lower() if len(resolved) <= 3 else resolved

    # Try resolving as a human-readable name
    # Handles "Plains Cree (nêhiyawêwin, SRO)" → "crk"
    code = resolve_name(target)
    if code:
        return code

    # Last resort: if it looks like a code (2-3 alpha chars), return as-is
    if len(target) <= 3 and target.isalpha():
        return target.lower()

    logger.warning(
        "Could not resolve target language '%s' to an ISO code. "
        "Consider using a 3-letter ISO 639-3 code instead.",
        target,
    )
    return None


def _detect_lang_name(config: dict) -> str:
    """Extract a human-readable language name from the config."""
    return (
        config.get("target_lang", "")
        or config.get("target_language", "")
        or "Unknown"
    )



# ---------------------------------------------------------------------------
# Behavioral plugins (language-agnostic — apply to all language pairs)
# ---------------------------------------------------------------------------

def _load_code_switching() -> object:
    """Load CodeSwitchingPlugin.

    This plugin SHIPS WITH the harness — it is not an optional external
    dependency. If it fails to import, something is broken and we must
    crash loudly rather than silently omitting it from scoring.
    """
    from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
    return CodeSwitchingPlugin()


def _load_hallucination() -> object:
    """Load HallucinationPlugin.

    This plugin SHIPS WITH the harness — it is not an optional external
    dependency. If it fails to import, something is broken and we must
    crash loudly.
    """
    from mt_eval_harness.plugins.hallucination import HallucinationPlugin
    return HallucinationPlugin()


def _load_terminology(config: dict) -> object:
    """Load TerminologyPlugin with glossary from config.

    This plugin SHIPS WITH the harness — it is not an optional external
    dependency. If it fails to import, something is broken and we must
    crash loudly.

    If no glossary is provided in the config, the plugin still loads but
    returns None for all terminology metrics — scoring.py treats None as
    "metric unavailable" and excludes it from composite re-normalization.
    This means loading it without a glossary is harmless.
    """
    from mt_eval_harness.plugins.terminology import TerminologyPlugin
    glossary = config.get("glossary")
    return TerminologyPlugin(glossary=glossary)


# ---------------------------------------------------------------------------
# Method-declared metric plugins (general loader)
# ---------------------------------------------------------------------------
#
# Any method module can declare its own metric plugins in method.json
# under the "metric_plugins" key. This is the general mechanism that
# replaces the old CRK-hardcoded plugin loading. Works for any language,
# any method — just declare your metrics in the manifest.
#
# Example method.json excerpt:
#   {
#     "metric_plugins": [
#       {
#         "entry_point": "metrics:CrkLinterMetric",
#         "name": "LYSS-eq",
#         "description": "Deterministic variant-class equivalence linter",
#         "dependencies": [],
#         "spacy_models": []
#       }
#     ]
#   }

import json as _json
import subprocess as _subprocess


def _load_method_metric_plugins(method_dir: str | Path) -> list:
    """Load metric plugins declared in a method module's method.json.

    Reads the 'metric_plugins' field from method.json and imports each
    class via importlib. Follows the same import pattern as method_loader.py:
    adds the method directory to sys.path so the plugin module can import
    its own siblings.

    For each declared plugin, checks runtime dependencies (pip packages,
    spaCy models) and offers to install if missing and stdin is interactive.

    Args:
        method_dir: Path to the method plugin directory containing method.json
                    and the metric module files.

    Returns:
        List of instantiated MetricPlugin instances (may be empty if
        the method declares no metrics or imports fail).
    """
    method_dir = Path(method_dir)
    manifest_path = method_dir / "method.json"

    if not manifest_path.exists():
        logger.debug("No method.json at %s — skipping metric plugin discovery", method_dir)
        return []

    try:
        manifest = _json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, _json.JSONDecodeError) as e:
        logger.warning("Failed to read method.json at %s: %s", manifest_path, e)
        return []

    metric_declarations = manifest.get("metric_plugins", [])
    if not metric_declarations:
        return []

    plugins = []

    # Ensure method directory is on sys.path for imports
    # (same pattern as method_loader.py L119-131)
    paths_to_add = []
    dir_str = str(method_dir)
    parent_str = str(method_dir.parent)
    if dir_str not in sys.path:
        paths_to_add.append(dir_str)
    if parent_str not in sys.path:
        paths_to_add.append(parent_str)
    for p in paths_to_add:
        sys.path.insert(0, p)

    for decl in metric_declarations:
        entry_point = decl.get("entry_point", "")
        name = decl.get("name", entry_point)
        description = decl.get("description", "")

        # A declared method metric that cannot be loaded FAILS LOUD — never a
        # silent skip that would score the run without a metric the method
        # claims to provide (consistent with the referee loader).
        if ":" not in entry_point:
            raise ValueError(
                f"Invalid metric_plugins entry_point {entry_point!r} in "
                f"{manifest_path} — expected 'module:ClassName'."
            )

        module_name, class_name = entry_point.split(":", 1)

        if not _check_metric_dependencies(decl, name):
            raise RuntimeError(
                f"Method metric '{name}' ({manifest_path}) is declared but its "
                f"runtime dependencies are not installed. Install them — refusing "
                f"to silently score without a declared metric."
            )

        module_file = method_dir / f"{module_name}.py"
        if not module_file.exists():
            raise FileNotFoundError(
                f"Method metric module not found: {module_file} (declared as "
                f"'{name}' in method.json). Cannot load a declared metric."
            )

        spec = importlib.util.spec_from_file_location(
            f"method_metric_plugin.{module_name}", module_file,
        )
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not create module spec for {module_file}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if not hasattr(module, class_name):
            raise ImportError(
                f"Module {module_name}.py does not export '{class_name}'. "
                f"Available: {[n for n in dir(module) if not n.startswith('_')]}"
            )

        instance = _validate_metric_plugin(
            getattr(module, class_name)(),
            f"method.json metric_plugins entry '{name}'",
        )
        plugins.append(instance)
        desc_suffix = f" — {description}" if description else ""
        print(f"  {name}: loaded ({class_name}{desc_suffix})")

    return plugins


def _validate_metric_plugin(instance, origin: str):
    """Fail LOUD at load time if a declared metric class does not satisfy the
    MetricPlugin protocol (plugins/metrics.py): a str `name`, a callable
    `compute`, and a callable `aggregate`.

    The runner calls all three unconditionally (tester.py wraps aggregate()
    in a try/except that records an error blob) — without this check a
    malformed plugin degrades SILENTLY into per-run error entries instead of
    refusing to load, which violates the no-silent-skip doctrine every other
    branch of this module follows.
    """
    problems = []
    if not isinstance(getattr(instance, "name", None), str) or not instance.name:
        problems.append("a non-empty str attribute 'name'")
    if not callable(getattr(instance, "compute", None)):
        problems.append("a callable 'compute(entry: dict) -> dict'")
    if not callable(getattr(instance, "aggregate", None)):
        problems.append("a callable 'aggregate(entry_results: list) -> dict'")
    if problems:
        raise TypeError(
            f"Metric plugin {type(instance).__name__} (from {origin}) does not "
            f"satisfy the MetricPlugin protocol — missing "
            f"{'; '.join(problems)}. See mt_eval_harness/plugins/metrics.py."
        )
    return instance


def _check_metric_dependencies(decl: dict, name: str) -> bool:
    """Check and optionally install runtime dependencies for a metric plugin.

    Checks pip dependencies and spaCy models listed in the metric declaration.
    If anything is missing and stdin is interactive, offers to install.

    Returns True if all dependencies are satisfied, False otherwise.
    """
    dependencies = decl.get("dependencies", [])
    spacy_models = decl.get("spacy_models", [])

    if not dependencies and not spacy_models:
        return True

    # Check pip dependencies
    missing_deps = []
    for dep in dependencies:
        # Extract package name from requirement spec (e.g., "spacy>=3.5" → "spacy")
        pkg_name = dep.split(">=")[0].split("==")[0].split("<")[0].strip()
        try:
            __import__(pkg_name)
        except ImportError:
            missing_deps.append(dep)

    # Check spaCy models
    missing_models = []
    for model_name in spacy_models:
        try:
            import spacy
            spacy.load(model_name)
        except (ImportError, OSError):
            missing_models.append(model_name)

    if not missing_deps and not missing_models:
        return True

    # Report what's missing
    all_missing = missing_deps + [f"spaCy model: {m}" for m in missing_models]
    print(f"  {name}: missing dependencies: {', '.join(all_missing)}")

    # Offer to install if interactive
    if sys.stdin.isatty():
        try:
            answer = input(f"  Install dependencies for {name}? [y/N]: ").strip().lower()
            if answer in ("y", "yes"):
                # Install pip packages
                for dep in missing_deps:
                    print(f"  Installing {dep}...")
                    _subprocess.check_call(
                        [sys.executable, "-m", "pip", "install", dep],
                        stdout=_subprocess.DEVNULL,
                    )
                # Download spaCy models
                for model_name in missing_models:
                    print(f"  Downloading spaCy model {model_name}...")
                    _subprocess.check_call(
                        [sys.executable, "-m", "spacy", "download", model_name],
                        stdout=_subprocess.DEVNULL,
                    )
                print(f"  ✓ Dependencies installed for {name}.")
                return True
        except (EOFError, KeyboardInterrupt):
            print()
        except (_subprocess.CalledProcessError, ImportError, OSError) as e:
            print(f"  ✗ Dependency install failed: {e}")

    print(f"  {name}: dependencies not installed ({', '.join(all_missing)})")
    logger.warning(
        "Metric plugin %s dependencies unavailable — missing: %s",
        name, ", ".join(all_missing),
    )
    return False


# ---------------------------------------------------------------------------
# Auto-detect method plugins from monorepo structure
# ---------------------------------------------------------------------------

def _auto_detect_method_dir(lang_code: str) -> Path | None:
    """Scan the monorepo for a method plugin that supports the target language.

    When no explicit --method is passed, this function walks the monorepo
    looking for method.json files whose 'supported_pairs' field matches
    the detected target language code. If found AND the manifest declares
    metric_plugins, returns the method directory path.

    Scan strategy:
        1. Walk up from this file's directory to find the monorepo root
           (the directory containing 'arena/' as a child).
        2. Scan sibling directories for 'method_plugin/method.json' files.
        3. Also check one level deeper (e.g., 'my-method/method_plugin/').

    This keeps the discovery generic — any language-specific module that
    follows the convention of 'method_plugin/method.json' with metric_plugins
    declared will be auto-detected. No hardcoded language knowledge needed.

    Args:
        lang_code: ISO 639-3 code for the target language (e.g., 'crk').

    Returns:
        Path to the method plugin directory, or None if no match found.
    """
    import json as _json_mod

    # Walk up from the arena package directory to find the monorepo root
    package_dir = Path(__file__).parent  # mt_eval_harness/
    arena_dir = package_dir.parent       # arena/

    # The monorepo root is the parent of arena/
    monorepo_root = arena_dir.parent
    if not monorepo_root.exists():
        return None

    # Scan sibling directories of arena/ for method.json files
    candidates = []
    try:
        for sibling in monorepo_root.iterdir():
            if not sibling.is_dir() or sibling.name.startswith("."):
                continue

            # Check method_plugin/ subdirectory (standard convention)
            method_dir = sibling / "method_plugin"
            manifest_path = method_dir / "method.json"

            if manifest_path.exists():
                candidates.append((method_dir, manifest_path))

            # Also check one level deeper for nested structures
            # (e.g., 'lang-translate/method_plugin/method.json')
            for child in sibling.iterdir():
                if not child.is_dir() or child.name.startswith("."):
                    continue
                nested_method = child / "method_plugin"
                nested_manifest = nested_method / "method.json"
                if nested_manifest.exists() and nested_method not in [c[0] for c in candidates]:
                    candidates.append((nested_method, nested_manifest))
    except PermissionError:
        return None

    # Check each candidate's supported_pairs for a match
    lang_lower = lang_code.lower()
    for method_dir, manifest_path in candidates:
        try:
            manifest = _json_mod.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, _json_mod.JSONDecodeError):
            continue

        # Only consider manifests that actually declare metric plugins
        metric_plugins = manifest.get("metric_plugins", [])
        if not metric_plugins:
            continue

        # Check supported_pairs for a target language match
        # Format: "eng>crk", "fra>crk", etc. We match the target half.
        supported_pairs = manifest.get("supported_pairs", [])
        for pair in supported_pairs:
            # Split on common separators
            for sep in [">", "-", "_"]:
                if sep in pair:
                    target_half = pair.split(sep)[-1].strip().lower()
                    if target_half == lang_lower:
                        logger.info(
                            "Auto-detected method plugin at %s "
                            "(supported_pairs includes '%s', "
                            "declares %d metric plugin(s))",
                            method_dir, pair, len(metric_plugins),
                        )
                        return method_dir

    return None


# ---------------------------------------------------------------------------
# Language-card-declared evaluation metrics
# ---------------------------------------------------------------------------

def _ensure_eval_standard_installed(
    eval_metrics: dict, eval_standard: dict | None, lang_code: str
) -> None:
    """Ensure the package(s) providing a card's evalMetrics are importable.

    The harness core ships NO language-specific scorer code. If a card's
    evalMetrics name modules whose top-level package is not installed, fetch +
    install the package declared in the card's ``evalStandard.pip`` (auto-fetch
    on demand, like FSTs / COMET models). FAIL LOUD if it cannot be installed —
    a declared eval standard that can't be loaded is a hard error, never a silent
    skip that would score the language without its referee metrics.
    """
    import os
    import importlib.util

    needed = {
        decl.get("module", "").split(".")[0]
        for decl in eval_metrics.values()
        if decl.get("module")
    }
    needed.discard("")
    missing = [pkg for pkg in sorted(needed) if importlib.util.find_spec(pkg) is None]
    if not missing:
        return

    pip_spec = (eval_standard or {}).get("pip")
    pkg_label = (eval_standard or {}).get("package") or ", ".join(missing)
    if not pip_spec:
        raise RuntimeError(
            f"The {lang_code!r} language card declares eval metrics from "
            f"{missing}, but that package is not installed and the card has no "
            f"'evalStandard.pip' to fetch it. Refusing to silently skip the "
            f"language's referee metrics — install it or fix the card."
        )

    # Card-declared IP / data-sovereignty notice, shown at the first touchpoint
    # (install). Language-neutral: the harness prints whatever the card declares
    # in ``evalStandard.ipNotice`` — no language-specific text lives here. For
    # Cree this surfaces the non-commercial / community-ownership terms before
    # any restricted data is fetched.
    ip_notice = (eval_standard or {}).get("ipNotice")
    if ip_notice:
        bar = "─" * 72
        print(f"\n  ┌{bar}┐")
        print(f"  │ IP / DATA-SOVEREIGNTY NOTICE — {pkg_label}")
        print(f"  └{bar}┘")
        for line in str(ip_notice).splitlines():
            print(f"    {line}")
        print()

    # Auto-fetch on demand (by design). Reuse the harness's
    # PEP-668-aware pip mechanism. Consent: auto in non-interactive / CI; prompt
    # otherwise. A declined OR failed install is a hard failure (fail loud).
    from mt_eval_harness import setup_wizard as _sw

    auto = (not sys.stdin.isatty()) or bool(os.environ.get("MT_EVAL_AUTO_SETUP"))
    if not auto:
        print(
            f"  {lang_code}: requires eval-standard package '{pkg_label}' — it "
            f"provides this language's referee metrics ({sorted(eval_metrics)})."
        )
        answer = input(f"  Install it now? ({pip_spec}) [y/N]: ").strip().lower()
        if answer not in ("y", "yes"):
            raise RuntimeError(
                f"Eval-standard package '{pkg_label}' is required to score "
                f"{lang_code!r} but installation was declined. Cannot score the "
                f"language's referee metrics without it."
            )

    print(f"  {lang_code}: fetching eval-standard package '{pkg_label}' …")
    if not _sw._pip_install(pip_spec, f"{lang_code} eval standard ({pkg_label})"):
        raise RuntimeError(
            f"Failed to install eval-standard package '{pkg_label}' ({pip_spec}) "
            f"for {lang_code!r}. Cannot score the language's referee metrics."
        )

    importlib.invalidate_caches()
    still_missing = [p for p in missing if importlib.util.find_spec(p) is None]
    if still_missing:
        raise RuntimeError(
            f"Installed '{pkg_label}' but {still_missing} is still not importable "
            f"for {lang_code!r}. The eval-standard package may be misconfigured."
        )


def _load_language_card_metrics(lang_code: str) -> list:
    """Load evaluation metrics declared on the language card (the REFEREE rubric).

    The card's ``evalMetrics`` field declares metrics that apply to ALL
    evaluations targeting this language, regardless of which method produced the
    output — they live with the language, not the contestant. The harness core
    ships none of this code: a ``module`` is a FULL importable path into an
    external eval-standard package (e.g. ``champollion_lyss.crk.metrics``), and
    that package is fetched on demand via the card's ``evalStandard``
    (see _ensure_eval_standard_installed).

    Fails LOUD on any problem — a declared referee metric that cannot be loaded
    is an error, never a silent skip that would score the language without it.

    Returns:
        List of MetricPlugin instances (empty only when the card declares none).
    """
    import importlib
    from mt_eval_harness import language_cards as _lc

    eval_metrics = _lc.get_eval_metrics(lang_code)
    if not eval_metrics:
        return []

    # Make sure the external package(s) that PROVIDE these metrics are installed.
    _ensure_eval_standard_installed(
        eval_metrics, _lc.get_eval_standard(lang_code), lang_code
    )

    plugins = []
    for metric_name, decl in eval_metrics.items():
        module_path = decl.get("module", "")
        class_name = decl.get("class", "")
        description = decl.get("description", "")

        if not module_path or not class_name:
            raise ValueError(
                f"Invalid evalMetrics entry '{metric_name}' on the {lang_code!r} "
                f"language card — missing 'module' or 'class'. A declared referee "
                f"metric must be loadable (no silent skip)."
            )

        if not _check_metric_dependencies(decl, metric_name):
            raise RuntimeError(
                f"Eval metric '{metric_name}' for {lang_code!r} is declared on the "
                f"card but its runtime dependencies are not installed. Install them "
                f"(e.g. `mt-eval setup --lang {lang_code}`) — refusing to silently "
                f"score without a declared referee metric."
            )

        module = importlib.import_module(module_path)  # FULL path, no harness prefix
        if not hasattr(module, class_name):
            raise ImportError(
                f"Module {module_path} (declared by the {lang_code!r} card) does "
                f"not export '{class_name}'. Available: "
                f"{[n for n in dir(module) if not n.startswith('_')]}"
            )
        instance = _validate_metric_plugin(
            getattr(module, class_name)(),
            f"evalMetrics entry '{metric_name}' on the {lang_code!r} card",
        )
        plugins.append(instance)
        desc_suffix = f" — {description}" if description else ""
        print(f"  {metric_name}: loaded ({class_name}{desc_suffix})")

    return plugins


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def discover_metric_plugins(
    config: dict,
    skip_fst: bool = False,
    method_dir: str | Path | None = None,
) -> list:
    """Auto-discover metric plugins appropriate for the target language.

    This is the main entry point for plugin auto-discovery. It:
        1. Detects the target language from the config dict
        2. Checks if the language has a known GiellaLT FST
        3. Enforces the FST quality gate (prompt → install → or abort)
        4. Loads language-card-declared eval metrics (e.g., LYSS for CRK)
        5. Falls back to method-declared metrics only if the language
           card has no evalMetrics

    The harness is **language-neutral** and the core wheel ships NO
    language-specific scorer code. Language-specific metrics are declared on the
    language card under "evalMetrics"/"evalStandard" and loaded from external
    packages (e.g. champollion-lyss) fetched on demand.

    Args:
        config: Dict containing at least 'target_lang' or 'target_language'.
                Can be a RunConfig.__dict__, a run_log['config'], or similar.
        skip_fst: If True, skip the FST gate (for --skip-fst flag).
        method_dir: Path to the method plugin directory containing method.json.
                    If provided, loads metric plugins declared in the manifest.
                    If None, auto-detects from monorepo structure.

    Returns:
        List of MetricPlugin instances (may be empty).

    Raises:
        SystemExit: If the FST is required but user declines to install
                    and skip_fst is False.
    """
    plugins = []

    lang_code = _detect_lang_code(config)
    lang_name = _detect_lang_name(config)

    if lang_code is None:
        logger.warning(
            "Could not detect target language from config keys "
            "'target_lang', 'target_language', or 'language_pair'. "
            "No language-specific plugins will be loaded. "
            "Config keys present: %s",
            list(config.keys()),
        )
        return plugins

    # --- FST quality gate ---
    from mt_eval_harness.plugins.fst_installer import ensure_fst_available
    from mt_eval_harness import language_cards as _lc

    fst_install_info = _lc.get_fst_install_info(lang_code)
    if fst_install_info is not None:
        fst_dir = ensure_fst_available(
            lang_code, lang_name, skip_fst=skip_fst
        )

        if fst_dir is not None:
            # FST is installed — create the metric plugin
            from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric
            fst_plugin = GiellaLTFSTMetric(lang_code=lang_code, fst_dir=fst_dir)
            plugins.append(fst_plugin)
            print(f"  FST metric: registered (GiellaLTFSTMetric for {lang_code})")
        elif not skip_fst:
            # FST is required but not available — abort
            card_name = _lc.get_name(lang_code) or lang_code
            print()
            print(f"  ✗ Evaluation aborted.")
            print(f"    {card_name} ({lang_code}) requires FST validation.")
            print(f"    Use --skip-fst to run without morphological checking.")
            raise SystemExit(1)

    # --- Language-card-declared eval metrics (REFEREE — applies to all methods) ---
    # These are the official evaluation standards for this language.
    # They come from the language card's evalMetrics field, NOT from any
    # translation method's method.json. This ensures fair scoring.
    if lang_code:
        card_metrics = _load_language_card_metrics(lang_code)
        if card_metrics:
            plugins.extend(card_metrics)
            print(f"  Language card eval metrics: {len(card_metrics)} loaded for {lang_code}")

    # --- Method-declared metric plugins (CONTESTANT-SPECIFIC) ---
    # These are method-specific metrics that a translation pipeline
    # declares for its own diagnostic purposes. They are NOT evaluation
    # standards — they supplement the language card metrics.
    # Only loaded if explicitly provided via --method flag.
    if method_dir is not None:
        method_plugins = _load_method_metric_plugins(method_dir)
        plugins.extend(method_plugins)

    # --- Behavioral plugins (language-agnostic, always loaded) ---
    # These detect specific failure modes in translation output.
    # They apply to all language pairs — no language-specific tools needed.
    # Scoring weights reference these metrics (code_switching_rate: 0.05–0.10,
    # hallucination_rate: 0.05, terminology_adherence: 0.05), so they must
    # be loaded for the composite to include them.

    cs_plugin = _load_code_switching()
    plugins.append(cs_plugin)
    print("  Code-switching: loaded (CodeSwitchingPlugin — source-language leakage)")

    hall_plugin = _load_hallucination()
    plugins.append(hall_plugin)
    print("  Hallucination: loaded (HallucinationPlugin — fabricated content)")

    term_plugin = _load_terminology(config)
    plugins.append(term_plugin)
    glossary_status = "with glossary" if config.get("glossary") else "no glossary (metric inactive)"
    print(f"  Terminology: loaded (TerminologyPlugin — {glossary_status})")

    # --- Writing style metric (informational, NOT in composite) ---
    # Measures register consistency, sentence length similarity, and
    # formality alignment. Always loaded but only produces meaningful
    # results when the corpus has register metadata or a style profile
    # is provided via --style-profile.
    try:
        from mt_eval_harness.plugins.writing_style import (
            WritingStyleMetric, StyleProfile,
        )
        style_profile = None
        style_profile_path = config.get("style_profile")
        if style_profile_path:
            import json
            from pathlib import Path
            profile_path = Path(style_profile_path)
            if profile_path.exists():
                profile_data = json.loads(profile_path.read_text(encoding="utf-8"))
                style_profile = StyleProfile.from_dict(profile_data)
                print(f"  Writing style: loaded with profile from {profile_path.name}")
            else:
                print(f"  Writing style: ⚠ profile not found at {style_profile_path}")
        else:
            print("  Writing style: loaded (no profile — auto-detecting from corpus)")

        style_plugin = WritingStyleMetric(style_profile=style_profile)
        plugins.append(style_plugin)
    except ImportError as e:
        # Should not happen — plugin ships with the harness
        logger.warning("WritingStyleMetric failed to import: %s", e)

    if plugins:
        print(f"  Auto-discovered {len(plugins)} metric plugin(s) for {lang_code}")

    return plugins
